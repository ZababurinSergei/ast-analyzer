// packages/ast-analyzer/src/core/entity-extractor/ast/extract-entities-from-ast.ts
import path from 'path';
import type {
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
  EntitiesResult,
} from '../../../types.js';
import type { ASTExport } from '../types.js';
import idManager from '../../IdManager.js';
import { collectExportsFromAST } from '../../ast-parser.js';
import { isNodeExported } from '../helpers/is-node-exported.js';
import { isEventHandler } from '../helpers/is-event-handler.js';
import { extractEventType } from '../helpers/extract-event-type.js';
import { extractBodyText } from '../helpers/extract-body-text.js';
import { extractValue } from '../helpers/extract-value.js';
import { calculateComplexity } from '../helpers/calculate-complexity.js';
import { analyzeSecurity } from '../helpers/analyze-security.js';
import { createEmptyEntitiesResult } from '../helpers/create-empty-result.js';
import { findFunctionNode } from './find-function-node.js';
import { collectAllCallsRecursive } from './collect-all-calls-recursive.js';
import { processExports } from './process-exports.js';

// ==========================================\\
// ОПЦИИ РЕКУРСИВНОГО ОБХОДА\\
// ==========================================\\

export interface TraverseOptions {
  /**
   * Максимальная глубина рекурсии.
   * - `0` — обработать только корневые узлы (без захода в детей)
   * - `Infinity` (по умолчанию) — обойти всё дерево
   * - `N` — зайти на N уровней вглубь
   */
  maxDepth?: number;
}

// ==========================================\\
// ГЛАВНАЯ ФУНКЦИЯ\\
// ==========================================\\

/**
 * Стандартный анализ AST.
 *
 * Всё состояние (контекст, глубина, обработчики) инкапсулировано
 * внутри замыкания этой функции. Потокобезопасно.
 *
 * @param ast      — AST-дерево
 * @param filePath — путь к файлу
 * @param options  — опции обхода (по умолчанию: всё дерево)
 */
export function extractEntitiesFromAST(
  ast: any,
  filePath?: string,
  options: TraverseOptions = {}
): EntitiesResult {
  const result = createEmptyEntitiesResult(filePath);

  // ==========================================\\
  // ГЛУБИНА: минимум 0, по умолчанию Infinity\\
  // ==========================================\\
  const maxDepth = options.maxDepth === undefined ? Infinity : Math.max(0, options.maxDepth);

  // ==========================================\\
  // КОНТЕКСТ (мутируется в процессе обхода)\\
  // ==========================================\\
  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const constants: ConstantInfo[] = [];
  const interfaces: InterfaceInfo[] = [];
  const types: TypeInfo[] = [];
  const variables: VariableInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const callGraph: Record<string, string[]> = {};

  const moduleId = filePath && idManager.getModuleId ? idManager.getModuleId(filePath) : undefined;
  const fileId = filePath && idManager.getFileId ? idManager.getFileId(filePath) : undefined;

  // ==========================================\\
  // ЭКСПОРТЫ ИЗ AST (собираются заранее)\\
  // ==========================================\\
  const exportsFromAST = collectExportsFromAST(ast);

  if (exportsFromAST.length > 0) {
    const reExports = exportsFromAST.filter((e: ASTExport) => e.isReExport);
    const namedExports = exportsFromAST.filter((e: ASTExport) => !e.isReExport && !e.isDefault);
    const defaultExports = exportsFromAST.filter((e: ASTExport) => e.isDefault);

    console.log(`📤 Найдено экспортов в ${filePath || 'unknown'}: ${exportsFromAST.length}`);
    if (reExports.length > 0) {
      console.log(`   🔄 Реэкспортов: ${reExports.length}`);
      for (const re of reExports.slice(0, 3)) {
        console.log(`      • ${re.name} из '${re.source}'`);
      }
      if (reExports.length > 3) {
        console.log(`      ... и ещё ${reExports.length - 3}`);
      }
    }
    if (namedExports.length > 0) {
      console.log(`   📤 Обычных экспортов: ${namedExports.length}`);
    }
    if (defaultExports.length > 0) {
      console.log(`   📤 Default экспортов: ${defaultExports.length}`);
    }
  }

  // ==========================================\\
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (внутри замыкания)\\
  // ==========================================\\

  /**
   * Собирает цепочку родительских функций для узла.
   */
  function collectParentFunctions(parent: any): string[] {
    const parentFunctions: string[] = [];
    let current = parent;
    let depthCount = 0;

    while (current && current.type !== 'Program' && depthCount < 50) {
      if (
        (current.type === 'FunctionDeclaration' || current.type === 'FunctionExpression') &&
        current.id
      ) {
        parentFunctions.unshift(current.id.name);
        depthCount++;
      }
      if (current.type === 'MethodDefinition' && current.key) {
        const methodName = current.key.name || current.key.value;
        if (methodName) {
          let classParent = current.parent;
          while (classParent && classParent.type !== 'Program') {
            if (classParent.type === 'ClassDeclaration' && classParent.id) {
              parentFunctions.unshift(classParent.id.name);
              break;
            }
            classParent = classParent.parent;
          }
          parentFunctions.push(methodName);
        }
      }
      current = current.parent;
    }

    return parentFunctions;
  }

  /**
   * Извлекает имена параметров из узла функции.
   */
  function extractParamNames(params: any[]): string[] {
    if (!Array.isArray(params)) return [];
    return params.map((p: any) => {
      if (p.type === 'Identifier') return p.name || 'unknown';
      if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
      if (p.type === 'RestElement' && p.argument) return `...${p.argument.name || 'unknown'}`;
      return 'unknown';
    });
  }

  /**
   * Создаёт и регистрирует FunctionInfo.
   */
  function registerFunction(
    name: string,
    node: any,
    opts: {
      isExported: boolean;
      isAsync: boolean;
      isMethod: boolean;
      isArrow: boolean;
      className?: string;
      parentFunc?: string;
      isNested: boolean;
      depth: number;
      isEventHandler: boolean;
      eventType?: string;
    }
  ): void {
    const params = extractParamNames(node.params);
    const bodyText = node.body ? extractBodyText(node.body) : undefined;

    const funcId = idManager.generateCompactId({
      filePath: filePath || 'unknown',
      funcName: name,
      line: node.loc?.start?.line || 1,
      parentFunction: opts.parentFunc,
      depth: opts.depth,
      type: 'function',
    });

    const funcInfo: FunctionInfo = {
      name,
      line: node.loc?.start?.line || 1,
      isAsync: opts.isAsync,
      isExported: opts.isExported,
      params,
      returnType: node.returnType?.typeName?.name || node.returnType?.name || undefined,
      calls: [],
      calledBy: [],
      startLine: node.loc?.start?.line || 1,
      endLine: node.loc?.end?.line || 1,
      body: bodyText,
      isMethod: opts.isMethod,
      className: opts.className,
      isNested: opts.isNested,
      parentFunction: opts.parentFunc,
      isArrow: opts.isArrow,
      isEventHandler: opts.isEventHandler,
      eventType: opts.eventType,
      depth: opts.depth,
      complexity: calculateComplexity(node),
      security: analyzeSecurity(bodyText || ''),
      id: funcId,
      vscode: filePath ? `vscode://file/${filePath}:${node.loc?.start?.line || 1}` : '',
      moduleId,
      fileId,
    };

    functions.push(funcInfo);

    if (!callGraph[name]) {
      callGraph[name] = [];
    }
  }

  // ==========================================\\
  // ЕДИНЫЙ РЕКУРСИВНЫЙ МЕТОД ОБХОДА\\
  // ==========================================\\

  /**
   * Рекурсивный обход дерева.
   *
   * @param node   — текущий узел
   * @param parent — родительский узел
   * @param depth  — текущая глубина (0 для корня)
   */
  function traverse(node: any, parent: any, depth: number): void {
    // Защита от некорректных узлов
    if (!node || typeof node !== 'object') return;
    if (!node.type) return;

    // Ограничение глубины
    if (depth > maxDepth) return;

    // Обработка текущего узла
    handleNode(node, parent, depth);

    // Рекурсивный обход детей
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;

      const child = node[key];
      if (!child || typeof child !== 'object') continue;

      if (Array.isArray(child)) {
        for (const item of child) {
          traverse(item, node, depth + 1);
        }
      } else {
        traverse(child, node, depth + 1);
      }
    }
  }

  // ==========================================\\
  // ДИСПЕТЧЕР ПО ТИПУ УЗЛА\\
  // ==========================================\\

  function handleNode(node: any, parent: any, depth: number): void {
    switch (node.type) {
      case 'ImportDeclaration':
        handleImportDeclaration(node);
        break;

      case 'FunctionDeclaration':
      case 'FunctionExpression':
        handleFunction(node, parent, depth);
        break;

      case 'ArrowFunctionExpression':
        handleArrowFunction(node, parent, depth);
        break;

      case 'MethodDefinition':
        handleMethodDefinition(node, parent, depth);
        break;

      case 'ClassDeclaration':
        handleClassDeclaration(node, parent);
        break;

      case 'VariableDeclaration':
        handleVariableDeclaration(node, parent);
        break;

      case 'TSInterfaceDeclaration':
        handleInterfaceDeclaration(node, parent);
        break;

      case 'TSTypeAliasDeclaration':
        handleTypeAliasDeclaration(node, parent);
        break;

      default:
        break;
    }
  }

  // ==========================================\\
  // ОБРАБОТЧИК: IMPORT DECLARATION\\
  // ==========================================\\

  function handleImportDeclaration(node: any): void {
    if (!node.source) return;

    const source = node.source.value;
    const isTypeOnly = node.importKind === 'type';
    const specifiers: { local: string; imported: string; type: string }[] = [];

    if (Array.isArray(node.specifiers)) {
      for (const spec of node.specifiers) {
        if (!spec) continue;
        if (spec.type === 'ImportSpecifier') {
          specifiers.push({
            local: spec.local?.name || 'unknown',
            imported: spec.imported?.name || 'unknown',
            type: 'ImportSpecifier',
          });
        } else if (spec.type === 'ImportDefaultSpecifier') {
          specifiers.push({
            local: spec.local?.name || 'unknown',
            imported: 'default',
            type: 'ImportDefaultSpecifier',
          });
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          specifiers.push({
            local: spec.local?.name || 'unknown',
            imported: '*',
            type: 'ImportNamespaceSpecifier',
          });
        }
      }
    }

    imports.push({
      source: source || 'unknown',
      specifiers,
      loc: node.loc,
      isTypeOnly,
    });
  }

  // ==========================================\\
  // ОБРАБОТЧИК: FUNCTION DECLARATION / EXPRESSION\\
  // ==========================================\\

  function handleFunction(node: any, parent: any, depth: number): void {
    if (!node.id) return;

    const name = node.id.name;
    const isExported = isNodeExported(node, parent);
    const isMethod = parent?.type === 'MethodDefinition' || parent?.type === 'ClassMethod';
    const isEventHandlerNode = isEventHandler(node) || isEventHandler(parent);
    const eventType = isEventHandlerNode ? extractEventType(parent || node) : undefined;

    const parentFunctions = collectParentFunctions(parent);
    let fullName = name;
    if (parentFunctions.length > 0) {
      fullName = parentFunctions.join('.') + '.' + name;
    }

    let className: string | undefined;
    if (isMethod) {
      let classParent = parent;
      while (classParent && classParent.type !== 'Program') {
        if (classParent.type === 'ClassDeclaration' && classParent.id) {
          className = classParent.id.name;
          break;
        }
        classParent = classParent.parent;
      }
      if (className) fullName = className + '.' + name;
    }

    const isNested = parentFunctions.length > 0 || depth > 0;
    const parentFunc = parentFunctions.length > 0 ? parentFunctions.join('.') : undefined;

    registerFunction(fullName, node, {
      isExported,
      isAsync: node.async || false,
      isMethod,
      isArrow: false,
      className,
      parentFunc,
      isNested,
      depth,
      isEventHandler: isEventHandlerNode,
      eventType,
    });
  }

  // ==========================================\\
  // ОБРАБОТЧИК: ARROW FUNCTION\\
  // ==========================================\\

  function handleArrowFunction(node: any, parent: any, depth: number): void {
    // Определяем имя: из VariableDeclarator или из Property
    let name = 'anonymous_arrow';
    let isExported = false;

    if (parent && parent.type === 'VariableDeclarator' && parent.id?.name) {
      name = parent.id.name;
      let exportParent = parent.parent;
      while (exportParent && exportParent.type !== 'Program') {
        if (
          exportParent.type === 'ExportNamedDeclaration' ||
          exportParent.type === 'ExportDefaultDeclaration'
        ) {
          isExported = true;
          break;
        }
        exportParent = exportParent.parent;
      }
    }

    if (parent && parent.type === 'Property' && parent.key) {
      const propName = parent.key.name || parent.key.value;
      if (propName) {
        name = propName;
      }
    }

    // Определяем цепочку родителей
    const parentFunctions = collectParentFunctions(parent);
    if (parentFunctions.length > 0 && !parent?.type?.includes('Property')) {
      name = parentFunctions.join('.') + '.' + name;
    }

    const isEventHandlerNode = isEventHandler(node) || isEventHandler(parent);
    const eventType = isEventHandlerNode ? extractEventType(parent || node) : undefined;

    const isNested = parentFunctions.length > 0 || depth > 0;
    const parentFunc = parentFunctions.length > 0 ? parentFunctions.join('.') : undefined;

    registerFunction(name, node, {
      isExported,
      isAsync: node.async || false,
      isMethod: false,
      isArrow: true,
      className: undefined,
      parentFunc,
      isNested,
      depth,
      isEventHandler: isEventHandlerNode,
      eventType,
    });
  }

  // ==========================================\\
  // ОБРАБОТЧИК: METHOD DEFINITION\\
  // ==========================================\\

  function handleMethodDefinition(node: any, parent: any, depth: number): void {
    if (!node.key) return;

    const methodName = node.key.name || node.key.value;
    if (!methodName) return;

    // Определяем имя класса
    let className = 'Anonymous';
    let classParent = parent;
    while (classParent && classParent.type !== 'Program') {
      if (classParent.type === 'ClassDeclaration' && classParent.id) {
        className = classParent.id.name;
        break;
      }
      classParent = classParent.parent;
    }

    const fullName = `${className}.${methodName}`;

    // Проверяем, экспортируется ли класс
    let isExported = false;
    let classNode: any = parent;
    while (classNode && classNode.type !== 'Program') {
      if (classNode.type === 'ClassDeclaration') {
        isExported = isNodeExported(classNode, classNode.parent);
        break;
      }
      classNode = classNode.parent;
    }

    registerFunction(fullName, node.value || node, {
      isExported,
      isAsync: node.value?.async || false,
      isMethod: true,
      isArrow: false,
      className,
      parentFunc: className,
      isNested: false,
      depth,
      isEventHandler: false,
      eventType: undefined,
    });
  }

  // ==========================================\\
  // ОБРАБОТЧИК: CLASS DECLARATION\\
  // ==========================================\\

  function handleClassDeclaration(node: any, parent: any): void {
    if (!node.id) return;

    const name = node.id.name;
    const isExported = isNodeExported(node, parent);

    const methods: string[] = [];
    const properties: string[] = [];

    if (Array.isArray(node.body?.body)) {
      for (const member of node.body.body) {
        if (!member) continue;
        if (member.type === 'MethodDefinition' && member.key) {
          methods.push(member.key.name);
        }
        if (member.type === 'PropertyDefinition' && member.key) {
          properties.push(member.key.name);
        }
      }
    }

    const classInfo: ClassInfo = {
      name: name || 'anonymous',
      line: node.loc?.start?.line || 1,
      isExported,
      methods,
      properties,
      extends: node.superClass?.name || undefined,
      implements: node.implements?.map((i: any) => i.expression?.name || i.name) || [],
      startLine: node.loc?.start?.line || 1,
      endLine: node.loc?.end?.line || 1,
    };

    (classInfo as any).moduleId = moduleId;
    (classInfo as any).fileId = fileId;

    classes.push(classInfo);
  }

  // ==========================================\\
  // ОБРАБОТЧИК: VARIABLE DECLARATION\\
  // ==========================================\\

  function handleVariableDeclaration(node: any, parent: any): void {
    const isExported = isNodeExported(node, parent);
    const kind = node.kind;

    if (!Array.isArray(node.declarations)) return;

    for (const decl of node.declarations) {
      if (!decl) continue;
      if (decl.id?.type !== 'Identifier') continue;

      const name = decl.id.name;
      const isConst = kind === 'const';

      // Пропускаем стрелочные функции — они обрабатываются в handleArrowFunction
      if (
        decl.init &&
        (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')
      ) {
        continue;
      }

      if (isConst) {
        const constInfo: ConstantInfo = {
          name: name || 'unknown',
          line: decl.loc?.start?.line || node.loc?.start?.line || 1,
          value: extractValue(decl.init),
          isExported,
          type: decl.init?.type || undefined,
        };
        (constInfo as any).moduleId = moduleId;
        (constInfo as any).fileId = fileId;
        constants.push(constInfo);
      } else {
        const varInfo: VariableInfo = {
          name: name || 'unknown',
          line: decl.loc?.start?.line || node.loc?.start?.line || 1,
          isExported,
          type: decl.init?.type || undefined,
          value: extractValue(decl.init),
        };
        (varInfo as any).moduleId = moduleId;
        (varInfo as any).fileId = fileId;
        variables.push(varInfo);
      }
    }
  }

  // ==========================================\\
  // ОБРАБОТЧИК: TS INTERFACE DECLARATION\\
  // ==========================================\\

  function handleInterfaceDeclaration(node: any, parent: any): void {
    if (!node.id) return;

    const name = node.id.name;
    const isExported = isNodeExported(node, parent);

    const properties: string[] = [];
    if (Array.isArray(node.body?.body)) {
      for (const member of node.body.body) {
        if (!member) continue;
        if (member.key?.name) {
          properties.push(member.key.name);
        }
      }
    }

    const intfInfo: InterfaceInfo = {
      name: name || 'unknown',
      line: node.loc?.start?.line || 1,
      isExported,
      properties,
      extends: node.extends?.map((e: any) => e.expression?.name || e.name) || [],
      startLine: node.loc?.start?.line || 1,
      endLine: node.loc?.end?.line || 1,
    };
    (intfInfo as any).moduleId = moduleId;
    (intfInfo as any).fileId = fileId;
    interfaces.push(intfInfo);
  }

  // ==========================================\\
  // ОБРАБОТЧИК: TS TYPE ALIAS DECLARATION\\
  // ==========================================\\

  function handleTypeAliasDeclaration(node: any, parent: any): void {
    if (!node.id) return;

    const name = node.id.name;
    const isExported = isNodeExported(node, parent);

    const typeInfo: TypeInfo = {
      name: name || 'unknown',
      line: node.loc?.start?.line || 1,
      isExported,
      definition: node.typeAnnotation?.type || 'unknown',
    };
    (typeInfo as any).moduleId = moduleId;
    (typeInfo as any).fileId = fileId;
    types.push(typeInfo);
  }

  // ==========================================\\
  // ЗАПУСК РЕКУРСИВНОГО ОБХОДА\\
  // ==========================================\\

  if (ast && Array.isArray(ast.body)) {
    for (const rootNode of ast.body) {
      traverse(rootNode, null, 0);
    }
  }

  // ==========================================\\
  // ДОБАВЛЯЕМ ЭКСПОРТЫ (БЕЗ isTypeOnly)\\
  // ==========================================\\

  const processedExports = processExports(exportsFromAST);
  exports.push(...processedExports);

  // ==========================================\\
  // СБОР ВЫЗОВОВ (второй проход по функциям)\\
  // ==========================================\\

  for (const func of functions) {
    const { node: funcNode } = findFunctionNode(ast, func.name);
    if (funcNode) {
      const calls = collectAllCallsRecursive(funcNode, new Set());
      const filteredCalls = calls.filter((call: string) => call !== func.name);
      if (!callGraph[func.name]) {
        callGraph[func.name] = [];
      }
      for (const call of filteredCalls) {
        const funcCalls = callGraph[func.name];
        if (funcCalls && !funcCalls.includes(call)) {
          funcCalls.push(call);
        }
      }
      func.calls = callGraph[func.name] || [];
    }
  }

  // ==========================================\\
  // ПОСТРОЕНИЕ calledBy\\
  // ==========================================\\

  for (const func of functions) {
    func.calledBy = [];
    for (const otherFunc of functions) {
      if (otherFunc.calls && otherFunc.calls.includes(func.name)) {
        if (!func.calledBy.includes(otherFunc.name)) {
          func.calledBy.push(otherFunc.name);
        }
      }
    }
  }

  // ==========================================\\
  // ЗАПОЛНЕНИЕ РЕЗУЛЬТАТА\\
  // ==========================================\\

  result.functions = functions;
  result.classes = classes;
  result.constants = constants;
  result.interfaces = interfaces;
  result.types = types;
  result.variables = variables;
  result.imports = imports;
  result.exports = exports;
  result.callGraph = callGraph;
  result.moduleName = filePath ? path.basename(filePath) : 'unknown';
  result.filePath = filePath || 'unknown';

  if (filePath) {
    (result as any)._moduleId = moduleId;
    (result as any)._fileId = fileId;
  }

  // ==========================================\\
  // ЛОГИРОВАНИЕ\\
  // ==========================================\\

  console.log(`📤 Экспортов собрано: ${exports.length}`);
  if (exports.length > 0) {
    const reExports = exports.filter(e => e.isReExport);
    const namedExports = exports.filter(e => !e.isReExport && !e.isDefault);
    const defaultExports = exports.filter(e => e.isDefault);
    console.log(`   • Обычных экспортов: ${namedExports.length}`);
    console.log(`   • Реэкспортов: ${reExports.length}`);
    console.log(`   • Default экспортов: ${defaultExports.length}`);
  }

  return result;
}
