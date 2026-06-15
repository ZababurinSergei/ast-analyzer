// src/semantic/TypeAnalyzer.ts

import ts from 'typescript';
import { toSimpleType, isAssignableToType, typeToString } from '@jitl/ts-simple-type';
import type { SimpleType } from '@jitl/ts-simple-type';

export interface TypeInfo {
  type: SimpleType;
  typeString: string;
  isNullable: boolean;
  isOptional: boolean;
  properties?: Map<string, TypeInfo>;
  elementType?: TypeInfo;
}

export interface TypeAnalysisResult {
  getTypeOfNode(node: ts.Node): TypeInfo | null;
  isTypeCompatible(node: ts.Node, expectedType: string): boolean;
  findTypeErrors(): TypeError[];
  inferReturnType(funcName: string): TypeInfo | null;
}

export interface TypeError {
  node: ts.Node;
  message: string;
  expected: string;
  actual: string;
  location: { line: number; column: number };
}

export class TypeAnalyzer {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;
  private sourceFile: ts.SourceFile;
  private typeInfoCache: Map<ts.Node, TypeInfo> = new Map();

  constructor(filePath: string) {
    // Создаем программу TypeScript
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowJs: true,
    };

    this.program = ts.createProgram([filePath], compilerOptions);
    this.typeChecker = this.program.getTypeChecker();
    this.sourceFile = this.program.getSourceFile(filePath)!;
  }

  analyze(): TypeAnalysisResult {
    const typeErrors = this.findTypeErrors();

    return {
      getTypeOfNode: (node: ts.Node) => this.getTypeInfo(node),
      isTypeCompatible: (node, expectedType) => this.checkTypeCompatibility(node, expectedType),
      findTypeErrors: () => typeErrors,
      inferReturnType: funcName => this.inferFunctionReturnType(funcName),
    };
  }

  private getTypeInfo(node: ts.Node): TypeInfo | null {
    if (this.typeInfoCache.has(node)) {
      return this.typeInfoCache.get(node)!;
    }

    const tsType = this.typeChecker.getTypeAtLocation(node);
    if (!tsType) return null;

    const simpleType = toSimpleType(tsType, this.typeChecker);
    const typeString = typeToString(simpleType, this.typeChecker);

    const info: TypeInfo = {
      type: simpleType,
      typeString,
      isNullable: this.isNullable(tsType),
      isOptional: this.isOptional(node),
    };

    // Рекурсивно анализируем свойства для объектов
    if (this.isObjectType(simpleType)) {
      const properties = new Map<string, TypeInfo>();
      const props = this.getPropertyOfSimpleType(simpleType);

      if (props && typeof props === 'object') {
        for (const [name, propType] of Object.entries(props)) {
          const propInfo = this.getTypeInfoFromSimpleType(propType as SimpleType);
          if (propInfo) properties.set(name, propInfo);
        }
      }
      info.properties = properties;
    }

    // Анализируем элементы для массивов
    if (this.isArrayType(simpleType)) {
      const elementType = this.getElementType(simpleType);
      if (elementType) {
        info.elementType = this.getTypeInfoFromSimpleType(elementType) || undefined;
      }
    }

    this.typeInfoCache.set(node, info);
    return info;
  }

  private getTypeInfoFromSimpleType(simpleType: SimpleType): TypeInfo | null {
    return {
      type: simpleType,
      typeString: typeToString(simpleType, this.typeChecker),
      isNullable: false,
      isOptional: false,
    };
  }

  private checkTypeCompatibility(node: ts.Node, expectedType: string): boolean {
    const actualType = this.getTypeInfo(node);
    if (!actualType) return true;

    // Создаем простой тип для ожидаемого типа
    const expectedSimpleType = this.parseTypeString(expectedType);
    if (!expectedSimpleType) return true;

    return isAssignableToType(actualType.type, expectedSimpleType, this.typeChecker);
  }

  private findTypeErrors(): TypeError[] {
    const errors: TypeError[] = [];

    const visit = (node: ts.Node) => {
      // Проверяем присвоения
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const leftType = this.getTypeInfo(node.left);
        const rightType = this.getTypeInfo(node.right);

        if (leftType && rightType) {
          const isAssignable = isAssignableToType(rightType.type, leftType.type, this.typeChecker);

          if (!isAssignable) {
            errors.push({
              node,
              message: 'Type mismatch in assignment',
              expected: leftType.typeString,
              actual: rightType.typeString,
              location: this.getNodeLocation(node),
            });
          }
        }
      }

      // Проверяем аргументы функций
      if (ts.isCallExpression(node)) {
        const signature = this.typeChecker.getResolvedSignature(node);
        if (signature) {
          const parameters = signature.getParameters();
          const args = node.arguments;

          for (let i = 0; i < Math.min(parameters.length, args.length); i++) {
            const param = parameters[i];
            const arg = args[i];

            if (param && arg) {
              const paramType = this.typeChecker.getTypeOfSymbolAtLocation(param, node);
              const argType = this.getTypeInfo(arg);

              if (argType) {
                const isAssignable = isAssignableToType(
                  argType.type,
                  toSimpleType(paramType, this.typeChecker),
                  this.typeChecker
                );

                if (!isAssignable) {
                  errors.push({
                    node: arg,
                    message: `Argument type mismatch for parameter ${param.getName()}`,
                    expected: typeToString(
                      toSimpleType(paramType, this.typeChecker),
                      this.typeChecker
                    ),
                    actual: argType.typeString,
                    location: this.getNodeLocation(arg),
                  });
                }
              }
            }
          }
        }
      }

      // Проверяем return операторы
      if (ts.isReturnStatement(node) && node.expression) {
        const enclosingFunction = this.getEnclosingFunction(node);
        if (enclosingFunction) {
          const returnType = this.typeChecker.getTypeAtLocation(enclosingFunction);
          const exprType = this.getTypeInfo(node.expression);

          if (exprType) {
            const isAssignable = isAssignableToType(
              exprType.type,
              toSimpleType(returnType, this.typeChecker),
              this.typeChecker
            );

            if (!isAssignable) {
              errors.push({
                node,
                message: 'Return type mismatch',
                expected: typeToString(
                  toSimpleType(returnType, this.typeChecker),
                  this.typeChecker
                ),
                actual: exprType.typeString,
                location: this.getNodeLocation(node),
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return errors;
  }

  private inferFunctionReturnType(funcName: string): TypeInfo | null {
    const functionDecl = this.findFunctionDeclaration(funcName);
    if (!functionDecl) return null;

    const returnType = this.typeChecker.getTypeAtLocation(functionDecl);
    return this.getTypeInfoFromSimpleType(toSimpleType(returnType, this.typeChecker));
  }

  private findFunctionDeclaration(name: string): ts.FunctionDeclaration | null {
    let result: ts.FunctionDeclaration | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.getText() === name) {
        result = node;
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return result;
  }

  private isNullable(tsType: ts.Type): boolean {
    return (
      (tsType.flags & ts.TypeFlags.Null) !== 0 || (tsType.flags & ts.TypeFlags.Undefined) !== 0
    );
  }

  private isOptional(node: ts.Node): boolean {
    if (ts.isPropertySignature(node)) {
      return !!node.questionToken;
    }
    if (ts.isParameter(node)) {
      return !!node.questionToken;
    }
    return false;
  }

  private getElementType(arrayType: any): SimpleType | null {
    if (this.isArrayType(arrayType) && arrayType.elementType) {
      return arrayType.elementType || null;
    }
    return null;
  }

  private getEnclosingFunction(node: ts.Node): ts.Node | undefined {
    let current = node.parent;
    while (current) {
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return undefined;
  }

  private parseTypeString(typeStr: string): SimpleType | null {
    // Простой парсинг строк типов (можно улучшить)
    if (typeStr === 'string') return { kind: 'STRING' } as any;
    if (typeStr === 'number') return { kind: 'NUMBER' } as any;
    if (typeStr === 'boolean') return { kind: 'BOOLEAN' } as any;
    if (typeStr === 'any') return { kind: 'ANY' } as any;

    return null;
  }

  private getNodeLocation(node: ts.Node): { line: number; column: number } {
    const start = node.getStart();
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
    return { line: line + 1, column: character + 1 };
  }

  // ==========================================
  // ИСПРАВЛЕННЫЕ МЕТОДЫ - используем kind вместо type
  // ==========================================

  /**
   * Проверяет, является ли тип массивом
   * Исправлено: используем kind вместо type
   */
  private isArrayType(type: any): boolean {
    if (!type) return false;
    // Проверяем по kind (исправлено с type на kind)
    return type.kind === 'ARRAY' || (type.kind === 'OBJECT' && type.array === true);
  }

  /**
   * Проверяет, является ли тип объектом
   * Исправлено: используем kind вместо type
   */
  private isObjectType(type: any): boolean {
    if (!type) return false;
    // Проверяем по kind (исправлено с type на kind)
    return type.kind === 'OBJECT' || type.kind === 'INTERFACE' || type.kind === 'CLASS';
  }

  /**
   * Получает свойства простого типа
   * Исправлено: проверка на существование type
   */
  private getPropertyOfSimpleType(type: any): any {
    if (!type) return {};

    // Проверяем по kind (исправлено с type на kind)
    if (type.kind === 'OBJECT' || type.kind === 'INTERFACE' || type.kind === 'CLASS') {
      return type.properties || {};
    }

    // Для других типов (UNION, INTERSECTION и т.д.)
    if (type.kind === 'UNION' && type.types) {
      // Для union типов объединяем свойства
      const allProps: Record<string, any> = {};
      for (const subType of type.types) {
        const props = this.getPropertyOfSimpleType(subType);
        Object.assign(allProps, props);
      }
      return allProps;
    }

    return {};
  }
}

// Экспорт вспомогательных функций
export function isTypeCompatible(
  type1: SimpleType,
  type2: SimpleType,
  typeChecker: ts.TypeChecker
): boolean {
  return isAssignableToType(type1, type2, typeChecker);
}

export function getTypeString(type: SimpleType, typeChecker: ts.TypeChecker): string {
  return typeToString(type, typeChecker);
}
