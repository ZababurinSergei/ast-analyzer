// packages/ast-analyzer/src/core/entity-extractor.ts
import { walk } from 'estree-walker';
import path from 'path';

export interface FunctionInfo {
  name: string;
  line: number;
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  returnType?: string;
  calls: string[];
  calledBy: string[];
  body?: string;
  startLine: number;
  endLine: number;
  isMethod?: boolean;
  className?: string;
  isNested?: boolean;
  parentFunction?: string;
  isArrow?: boolean;
  isEventHandler?: boolean;
  eventType?: string;
  depth: number;
}

export interface ClassInfo {
  name: string;
  line: number;
  isExported: boolean;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
}

export interface ConstantInfo {
  name: string;
  line: number;
  value?: any;
  isExported: boolean;
  type?: string;
}

export interface InterfaceInfo {
  name: string;
  line: number;
  isExported: boolean;
  properties: string[];
  extends?: string[];
  startLine: number;
  endLine: number;
}

export interface TypeInfo {
  name: string;
  line: number;
  isExported: boolean;
  definition: string;
}

export interface VariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type?: string;
  value?: any;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'default';
  isDefault: boolean;
  line: number;
}

export interface EntitiesResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  variables: VariableInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

/**
 * Безопасная проверка, является ли объект массивом
 */
function isArraySafe(value: any): boolean {
  return value && Array.isArray(value);
}

/**
 * Безопасно получает тип узла для отладки
 */
function getNodeType(node: any): string {
  if (!node) return 'null';
  if (typeof node !== 'object') return typeof node;
  if (node.type) return node.type;
  if (node.constructor?.name) return node.constructor.name;
  return 'unknown';
}

/**
 * Безопасно получает местоположение узла для отладки
 * Используется для логирования ошибок и отладки
 */
function getNodeLocation(node: any): string {
  if (!node) return 'unknown';
  if (node.loc?.start) {
    return `line ${node.loc.start.line}, column ${node.loc.start.column}`;
  }
  if (node.start !== undefined) {
    return `position ${node.start}`;
  }
  return 'unknown location';
}

/**
 * Проверяет, является ли узел обработчиком событий
 */
function isEventHandler(node: any): boolean {
  if (!node) return false;

  // Проверка вызовов addEventListener, on, once
  if (node.type === 'CallExpression' && node.callee) {
    const callee = node.callee;
    if (callee.type === 'Identifier') {
      const name = callee.name;
      if (
        ['addEventListener', 'on', 'once', 'emit', 'dispatchEvent', 'addListener'].includes(name)
      ) {
        return true;
      }
    }
    if (callee.type === 'MemberExpression' && callee.property) {
      const propName = callee.property.name || callee.property.value;
      if (
        ['addEventListener', 'on', 'once', 'emit', 'dispatchEvent', 'addListener'].includes(
          propName
        )
      ) {
        return true;
      }
    }
  }

  // Проверка JSX событий
  if (node.type === 'JSXAttribute' && node.name) {
    const attrName = node.name.name || node.name.value;
    if (typeof attrName === 'string' && attrName.startsWith('on')) {
      return true;
    }
  }

  return false;
}

/**
 * Извлекает тип события из узла
 */
function extractEventType(node: any): string | undefined {
  if (!node) return undefined;

  if (node.type === 'CallExpression' && node.callee) {
    // addEventListener('click', handler)
    if (node.arguments && node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
        return firstArg.value;
      }
      if (firstArg && firstArg.type === 'Identifier') {
        return firstArg.name;
      }
    }
  }

  if (node.type === 'JSXAttribute' && node.name) {
    const attrName = node.name.name || node.name.value;
    if (typeof attrName === 'string' && attrName.startsWith('on')) {
      return attrName.slice(2).toLowerCase();
    }
  }

  return undefined;
}

/**
 * Извлекает все сущности из AST с рекурсивным обходом вложенных функций
 */
export function extractEntities(ast: any, filePath?: string): EntitiesResult {
  // Проверка на null/undefined
  if (!ast || !ast.body) {
    return {
      functions: [],
      classes: [],
      constants: [],
      interfaces: [],
      types: [],
      variables: [],
      imports: [],
      exports: [],
      callGraph: {},
      moduleName: filePath ? path.basename(filePath) : 'unknown',
      filePath: filePath || 'unknown',
    };
  }

  // Убеждаемся, что body это массив
  if (!isArraySafe(ast.body)) {
    const nodeType = getNodeType(ast.body);
    const location = getNodeLocation(ast.body);
    console.warn(
      `⚠️ AST.body не является массивом для ${filePath || 'unknown'}, тип: ${nodeType}, ${location}, пропускаем`
    );
    return {
      functions: [],
      classes: [],
      constants: [],
      interfaces: [],
      types: [],
      variables: [],
      imports: [],
      exports: [],
      callGraph: {},
      moduleName: filePath ? path.basename(filePath) : 'unknown',
      filePath: filePath || 'unknown',
    };
  }

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const constants: ConstantInfo[] = [];
  const interfaces: InterfaceInfo[] = [];
  const types: TypeInfo[] = [];
  const variables: VariableInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const callGraph: Record<string, string[]> = {};

  let currentFunction: string | null = null;
  let currentClass: string | null = null;
  const functionStack: string[] = [];

  // ============================================
  // РЕКУРСИВНЫЙ ОБХОД AST С СОБРАНИЕМ ВСЕХ ФУНКЦИЙ
  // ============================================

  function traverseNode(node: any, parent: any, depth: number, parentFunction?: string) {
    if (!node || typeof node !== 'object') return;

    // Используем parentFunction для отслеживания иерархии вызовов
    // Сохраняем parentFunction в контексте для использования в логировании
    // и для построения полного имени функции
    const currentContext = parentFunction || 'global';

    // Для отладки используем getNodeLocation с parentFunction
    if (process.env.DEBUG === 'true' && node.type === 'FunctionDeclaration') {
      const location = getNodeLocation(node);
      console.log(`🔍 Обнаружена функция в контексте: ${currentContext} в ${location}`);
    }

    // === ИМПОРТЫ ===
    if (node.type === 'ImportDeclaration' && node.source) {
      const source = node.source.value;
      const isTypeOnly = node.importKind === 'type';
      const specifiers: string[] = [];
      let isDefault = false;
      let isNamespace = false;

      if (isArraySafe(node.specifiers)) {
        for (const spec of node.specifiers) {
          if (!spec) continue;
          if (spec.type === 'ImportSpecifier') {
            const importedName = spec.imported?.name || 'unknown';
            const localName = spec.local?.name || 'unknown';
            specifiers.push(
              importedName === localName ? importedName : `${importedName} as ${localName}`
            );
          } else if (spec.type === 'ImportDefaultSpecifier') {
            const localName = spec.local?.name || 'unknown';
            specifiers.push(`default as ${localName}`);
            isDefault = true;
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            const localName = spec.local?.name || 'unknown';
            specifiers.push(`* as ${localName}`);
            isNamespace = true;
          }
        }
      }

      imports.push({
        source: source || 'unknown',
        specifiers,
        isTypeOnly,
        isDefault,
        isNamespace,
        line: node.loc?.start?.line || 1,
      });
    }

    // === ЭКСПОРТЫ ===
    if (node.type === 'ExportNamedDeclaration') {
      let exportName = '';
      let exportType: ExportInfo['type'] = 'default';

      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          exportName = decl.id.name;
          exportType = 'function';
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          exportName = decl.id.name;
          exportType = 'class';
        } else if (decl.type === 'VariableDeclaration') {
          if (isArraySafe(decl.declarations)) {
            for (const d of decl.declarations) {
              if (d.id?.name) {
                exportName = d.id.name;
                exportType = 'constant';
              }
            }
          }
        }
      } else if (isArraySafe(node.specifiers)) {
        for (const spec of node.specifiers) {
          if (spec.exported) {
            exportName = spec.exported.name;
            exportType = 'variable';
          }
        }
      }

      if (exportName) {
        exports.push({
          name: exportName,
          type: exportType,
          isDefault: false,
          line: node.loc?.start?.line || 1,
        });
      }
    }

    if (node.type === 'ExportDefaultDeclaration') {
      let exportName = 'default';
      let exportType: ExportInfo['type'] = 'default';

      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          exportName = decl.id.name || 'default';
          exportType = 'function';
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          exportName = decl.id.name || 'default';
          exportType = 'class';
        } else if (decl.type === 'Identifier') {
          exportName = decl.name || 'default';
          exportType = 'variable';
        }
      }

      exports.push({
        name: exportName,
        type: exportType,
        isDefault: true,
        line: node.loc?.start?.line || 1,
      });
    }

    // ============================================
    // === ФУНКЦИИ (включая вложенные) ===
    // ============================================

    if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);
      const isMethod = parent?.type === 'MethodDefinition' || parent?.type === 'ClassMethod';
      const isArrow = false;
      const isEventHandlerNode = isEventHandler(node) || isEventHandler(parent);
      const eventType = isEventHandlerNode ? extractEventType(parent || node) : undefined;

      // Строим полное имя с учетом вложенности
      let fullName = name;
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
        // Проверяем методы классов
        if (current.type === 'MethodDefinition' && current.key) {
          const methodName = current.key.name || current.key.value;
          if (methodName) {
            // Ищем имя класса
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

      if (parentFunctions.length > 0) {
        fullName = parentFunctions.join('.') + '.' + name;
      }

      // Если это метод класса, добавляем имя класса
      let className: string | undefined = undefined;
      if (isMethod) {
        let classParent = parent;
        while (classParent && classParent.type !== 'Program') {
          if (classParent.type === 'ClassDeclaration' && classParent.id) {
            className = classParent.id.name;
            break;
          }
          classParent = classParent.parent;
        }
        if (className) {
          fullName = className + '.' + name;
        }
      }

      const params = isArraySafe(node.params)
        ? node.params.map((p: any) => {
            if (p.type === 'Identifier') return p.name || 'unknown';
            if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
            if (p.type === 'RestElement' && p.argument) return `...${p.argument.name || 'unknown'}`;
            return 'unknown';
          })
        : [];

      // Используем parentFunction для определения вложенности
      const isNested = parentFunctions.length > 0 || depth > 0;
      const parentFunc = parentFunctions.length > 0 ? parentFunctions.join('.') : undefined;

      const funcInfo: FunctionInfo = {
        name: fullName,
        line: node.loc?.start?.line || 1,
        isAsync: node.async || false,
        isExported,
        params,
        returnType: node.returnType?.typeName?.name || node.returnType?.name || undefined,
        calls: [],
        calledBy: [],
        startLine: node.loc?.start?.line || 1,
        endLine: node.loc?.end?.line || 1,
        body: node.body ? extractBodyText(node.body) : undefined,
        isMethod,
        className,
        isNested,
        parentFunction: parentFunc,
        isArrow,
        isEventHandler: isEventHandlerNode,
        eventType,
        depth: depth,
      };

      functions.push(funcInfo);

      // Добавляем в callGraph
      if (!callGraph[fullName]) {
        callGraph[fullName] = [];
      }

      // Сохраняем текущую функцию для контекста
      const previousFunction = currentFunction;
      currentFunction = fullName;
      functionStack.push(fullName);

      // Рекурсивно обходим тело функции, передавая parentFunction
      if (node.body) {
        // Для BlockStatement обходим body
        if (node.body.type === 'BlockStatement' && isArraySafe(node.body.body)) {
          for (const child of node.body.body) {
            traverseNode(child, node, depth + 1, fullName);
          }
        } else {
          // Для других типов тел (стрелочные с выражением)
          traverseNode(node.body, node, depth + 1, fullName);
        }
      }

      // Восстанавливаем контекст
      functionStack.pop();
      currentFunction = previousFunction;
    }

    // ============================================
    // === СТРЕЛОЧНЫЕ ФУНКЦИИ ===
    // ============================================

    if (node.type === 'ArrowFunctionExpression') {
      // Проверяем, присвоена ли стрелочная функция переменной
      let name = 'anonymous_arrow';
      let isExported = false;
      let parentFunc: string | undefined = undefined;
      const isEventHandlerNode = isEventHandler(node) || isEventHandler(parent);
      const eventType = isEventHandlerNode ? extractEventType(parent || node) : undefined;

      let current = parent;
      const parentFuncs: string[] = [];
      let depthCount = 0;

      while (current && current.type !== 'Program' && depthCount < 50) {
        if (
          (current.type === 'FunctionDeclaration' || current.type === 'FunctionExpression') &&
          current.id
        ) {
          parentFuncs.unshift(current.id.name);
          depthCount++;
        }
        if (current.type === 'MethodDefinition' && current.key) {
          const methodName = current.key.name || current.key.value;
          if (methodName) {
            let classParent = current.parent;
            while (classParent && classParent.type !== 'Program') {
              if (classParent.type === 'ClassDeclaration' && classParent.id) {
                parentFuncs.unshift(classParent.id.name);
                break;
              }
              classParent = classParent.parent;
            }
            parentFuncs.push(methodName);
          }
        }
        current = current.parent;
      }

      // Ищем имя переменной для стрелочной функции
      if (parent && parent.type === 'VariableDeclarator' && parent.id) {
        const varName = parent.id.name;
        if (varName) {
          name = varName;
          // Проверяем экспорт
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
      }

      if (parent && parent.type === 'Property' && parent.key) {
        const propName = parent.key.name || parent.key.value;
        if (propName) {
          // Это метод объекта
          if (parentFuncs.length > 0) {
            name = parentFuncs.join('.') + '.' + propName;
          } else {
            name = propName;
          }
        }
      }

      if (parentFuncs.length > 0 && !parent?.type?.includes('Property')) {
        name = parentFuncs.join('.') + '.' + name;
      }

      // Если это обработчик события в JSX
      if (isEventHandlerNode && parent?.type === 'JSXAttribute') {
        const attrName = parent.name?.name || parent.name?.value;
        if (attrName && typeof attrName === 'string') {
          name = `on${attrName.slice(2)}Handler`;
        }
      }

      const params = isArraySafe(node.params)
        ? node.params.map((p: any) => {
            if (p.type === 'Identifier') return p.name || 'unknown';
            if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
            if (p.type === 'RestElement' && p.argument) return `...${p.argument.name || 'unknown'}`;
            return 'unknown';
          })
        : [];

      // Используем parentFuncs для определения вложенности
      const isNested = parentFuncs.length > 0 || depth > 0;
      parentFunc = parentFuncs.length > 0 ? parentFuncs.join('.') : undefined;

      const funcInfo: FunctionInfo = {
        name,
        line: node.loc?.start?.line || 1,
        isAsync: node.async || false,
        isExported,
        params,
        returnType: node.returnType?.typeName?.name || undefined,
        calls: [],
        calledBy: [],
        startLine: node.loc?.start?.line || 1,
        endLine: node.loc?.end?.line || 1,
        body: node.body ? extractBodyText(node.body) : undefined,
        isMethod: false,
        className: undefined,
        isNested,
        parentFunction: parentFunc,
        isArrow: true,
        isEventHandler: isEventHandlerNode,
        eventType,
        depth: depth,
      };

      functions.push(funcInfo);

      if (!callGraph[name]) {
        callGraph[name] = [];
      }

      // Рекурсивно обходим тело стрелочной функции
      if (node.body) {
        if (node.body.type === 'BlockStatement' && isArraySafe(node.body.body)) {
          for (const child of node.body.body) {
            traverseNode(child, node, depth + 1, name);
          }
        } else {
          traverseNode(node.body, node, depth + 1, name);
        }
      }
    }

    // ============================================
    // === МЕТОДЫ КЛАССОВ ===
    // ============================================

    if (node.type === 'MethodDefinition' && node.key) {
      const methodName = node.key.name || node.key.value;
      const className = currentClass || parent?.id?.name || 'Anonymous';

      if (methodName) {
        const isExported = isNodeExported(node, parent);
        const fullName = `${className}.${methodName}`;

        const params = isArraySafe(node.value?.params)
          ? node.value.params.map((p: any) => {
              if (p.type === 'Identifier') return p.name || 'unknown';
              if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
              return 'unknown';
            })
          : [];

        // Используем className как parentFunction для методов
        const parentFunc = className;

        const funcInfo: FunctionInfo = {
          name: fullName,
          line: node.loc?.start?.line || 1,
          isAsync: node.value?.async || false,
          isExported,
          params,
          returnType: node.value?.returnType?.typeName?.name || undefined,
          calls: [],
          calledBy: [],
          startLine: node.loc?.start?.line || 1,
          endLine: node.loc?.end?.line || 1,
          isMethod: true,
          className,
          isNested: false,
          parentFunction: parentFunc,
          isArrow: false,
          isEventHandler: false,
          depth: depth,
        };

        functions.push(funcInfo);

        if (!callGraph[fullName]) {
          callGraph[fullName] = [];
        }

        // Рекурсивно обходим тело метода
        if (node.value && node.value.body) {
          if (node.value.body.type === 'BlockStatement' && isArraySafe(node.value.body.body)) {
            for (const child of node.value.body.body) {
              traverseNode(child, node, depth + 1, fullName);
            }
          }
        }
      }
    }

    // === КЛАССЫ ===
    if (node.type === 'ClassDeclaration' && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);

      const methods: string[] = [];
      const properties: string[] = [];

      if (isArraySafe(node.body?.body)) {
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

      classes.push(classInfo);

      const previousClass = currentClass;
      currentClass = name;

      // Рекурсивно обходим тело класса
      if (node.body && isArraySafe(node.body.body)) {
        for (const member of node.body.body) {
          traverseNode(member, node, depth + 1, name);
        }
      }

      currentClass = previousClass;
    }

    // === КОНСТАНТЫ ===
    if (node.type === 'VariableDeclaration') {
      const isExported = isNodeExported(node, parent);
      const kind = node.kind;

      if (isArraySafe(node.declarations)) {
        for (const decl of node.declarations) {
          if (!decl) continue;
          if (decl.id?.type === 'Identifier') {
            const name = decl.id.name;
            const isConst = kind === 'const';

            if (isConst) {
              constants.push({
                name: name || 'unknown',
                line: decl.loc?.start?.line || node.loc?.start?.line || 1,
                value: extractValue(decl.init),
                isExported,
                type: decl.init?.type || undefined,
              });
            } else {
              variables.push({
                name: name || 'unknown',
                line: decl.loc?.start?.line || node.loc?.start?.line || 1,
                isExported,
                type: decl.init?.type || undefined,
                value: extractValue(decl.init),
              });
            }
          }
        }
      }
    }

    // === ИНТЕРФЕЙСЫ ===
    if (node.type === 'TSInterfaceDeclaration' && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);

      const properties: string[] = [];
      if (isArraySafe(node.body?.body)) {
        for (const member of node.body.body) {
          if (!member) continue;
          if (member.key?.name) {
            properties.push(member.key.name);
          }
        }
      }

      interfaces.push({
        name: name || 'unknown',
        line: node.loc?.start?.line || 1,
        isExported,
        properties,
        extends: node.extends?.map((e: any) => e.expression?.name || e.name) || [],
        startLine: node.loc?.start?.line || 1,
        endLine: node.loc?.end?.line || 1,
      });
    }

    // === ТИПЫ ===
    if (node.type === 'TSTypeAliasDeclaration' && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);

      types.push({
        name: name || 'unknown',
        line: node.loc?.start?.line || 1,
        isExported,
        definition: node.typeAnnotation?.type || 'unknown',
      });
    }

    // ============================================
    // РЕКУРСИВНЫЙ ОБХОД ДЕТЕЙ
    // ============================================

    const childrenToTraverse: any[] = [];

    // body - проверяем, что это массив или объект
    if (node.body) {
      if (Array.isArray(node.body)) {
        childrenToTraverse.push(...node.body);
      } else if (typeof node.body === 'object') {
        childrenToTraverse.push(node.body);
      }
    }

    // Дополнительные поля для обхода
    if (node.consequent) childrenToTraverse.push(node.consequent);
    if (node.alternate) childrenToTraverse.push(node.alternate);
    if (node.init) childrenToTraverse.push(node.init);
    if (node.update) childrenToTraverse.push(node.update);
    if (node.test) childrenToTraverse.push(node.test);
    if (node.handler) childrenToTraverse.push(node.handler);
    if (node.finalizer) childrenToTraverse.push(node.finalizer);
    if (node.param) childrenToTraverse.push(node.param);
    if (node.argument) childrenToTraverse.push(node.argument);
    if (node.expression) childrenToTraverse.push(node.expression);
    if (node.callee) childrenToTraverse.push(node.callee);
    if (node.object) childrenToTraverse.push(node.object);
    if (node.property) childrenToTraverse.push(node.property);

    if (isArraySafe(node.arguments)) {
      childrenToTraverse.push(...node.arguments);
    }
    if (isArraySafe(node.properties)) {
      childrenToTraverse.push(...node.properties);
    }
    if (isArraySafe(node.elements)) {
      childrenToTraverse.push(...node.elements);
    }
    if (isArraySafe(node.cases)) {
      for (const caseNode of node.cases) {
        if (caseNode.consequent) {
          childrenToTraverse.push(...caseNode.consequent);
        }
      }
    }
    if (isArraySafe(node.handlers)) {
      childrenToTraverse.push(...node.handlers);
    }

    const validChildren = childrenToTraverse.filter(child => child && typeof child === 'object');

    for (const child of validChildren) {
      traverseNode(child, node, depth + 1, parentFunction);
    }
  }

  // ============================================
  // ЗАПУСК РЕКУРСИВНОГО ОБХОДА
  // ============================================

  try {
    for (const node of ast.body) {
      traverseNode(node, null, 0, undefined);
    }
  } catch (error) {
    console.warn(`⚠️ Ошибка при обходе AST для ${filePath || 'unknown'}:`, error);
  }

  // ============================================
  // ПОСТРОЕНИЕ ГРАФА ВЫЗОВОВ
  // ============================================

  // Собираем все имена функций для быстрого поиска
  const functionNames = new Set<string>();
  for (const func of functions) {
    functionNames.add(func.name);
  }

  // Собираем вызовы для каждой функции через обход AST
  function collectCallsFromBody(body: string, funcName: string): string[] {
    const calls: string[] = [];
    if (!body) return calls;

    // Ищем вызовы функций в теле
    const callRegex = /\b(\w+)\s*\(/g;
    let match;
    while ((match = callRegex.exec(body)) !== null) {
      const calledName = match[1];
      if (calledName && calledName !== funcName && functionNames.has(calledName)) {
        calls.push(calledName);
      }
    }

    return calls;
  }

  // Заполняем вызовы для каждой функции
  for (const func of functions) {
    if (func.body) {
      const calls = collectCallsFromBody(func.body, func.name);
      func.calls = [...new Set(calls)];
    }
  }

  // Заполняем calledBy для каждой функции
  for (const func of functions) {
    for (const otherFunc of functions) {
      if (otherFunc.calls.includes(func.name) && !func.calledBy.includes(otherFunc.name)) {
        func.calledBy.push(otherFunc.name);
      }
    }
  }

  // Обновляем callGraph из функций
  for (const func of functions) {
    if (!callGraph[func.name]) {
      callGraph[func.name] = [];
    }
    // Проверяем, что callGraph[func.name] существует перед добавлением
    const funcCalls = callGraph[func.name];
    if (funcCalls) {
      for (const call of func.calls) {
        if (!funcCalls.includes(call)) {
          funcCalls.push(call);
        }
      }
    }
  }

  // Используем parentFunction для построения иерархии вызовов
  // Добавляем информацию о parentFunction в метаданные функций
  for (const func of functions) {
    if (func.parentFunction) {
      // Проверяем, что callGraph[func.parentFunction] существует
      if (!callGraph[func.parentFunction]) {
        callGraph[func.parentFunction] = [];
      }
      // Добавляем связь родитель -> дочерняя функция
      const parentCalls = callGraph[func.parentFunction];
      if (parentCalls && !parentCalls.includes(func.name)) {
        parentCalls.push(func.name);
      }
    }
  }

  // Используем currentClass и currentFunction для контекста при логировании
  // Это помогает отлаживать, в каком контексте происходит обход
  if (currentClass || currentFunction) {
    // Логируем только если есть контекст (для отладки)
    // Используем getNodeLocation для получения позиции
    const contextInfo = [];
    if (currentClass) contextInfo.push(`class: ${currentClass}`);
    if (currentFunction) contextInfo.push(`function: ${currentFunction}`);
    if (contextInfo.length > 0) {
      // Используем getNodeLocation для получения позиции (используется для отладки)
      const location = getNodeLocation(ast);
      // Логируем только в режиме отладки
      if (process.env.DEBUG === 'true') {
        console.log(`📊 Контекст обхода: ${contextInfo.join(', ')} в ${location}`);
      }
    }
  }

  return {
    functions,
    classes,
    constants,
    interfaces,
    types,
    variables,
    imports,
    exports,
    callGraph,
    moduleName: filePath ? path.basename(filePath) : 'unknown',
    filePath: filePath || 'unknown',
  };
}

/**
 * Проверяет, экспортируется ли узел
 */
function isNodeExported(node: any, parent: any): boolean {
  if (!node) return false;

  // Прямой export
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

  // Проверка родителя
  if (parent) {
    if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
      return true;
    }
    if (parent.type === 'VariableDeclaration' && isNodeExported(parent, parent.parent)) {
      return true;
    }
  }

  // Проверка наличия export в тексте
  if (node.leadingComments) {
    for (const comment of node.leadingComments) {
      if (comment.value && comment.value.includes('@export')) {
        return true;
      }
    }
  }

  // Проверка декораторов
  if (node.decorators) {
    for (const decorator of node.decorators) {
      if (
        decorator.expression?.name === 'export' ||
        decorator.expression?.callee?.name === 'export'
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Извлекает текст тела функции
 */
function extractBodyText(body: any): string | undefined {
  if (!body) return undefined;

  if (body.type === 'BlockStatement') {
    const statements = body.body || [];
    if (statements.length === 0) return '{}';

    const firstStatement = statements[0];
    if (firstStatement && firstStatement.type === 'ReturnStatement') {
      if (firstStatement.argument) {
        const argType = firstStatement.argument.type;
        if (argType === 'Identifier') return `return ${firstStatement.argument.name}`;
        if (argType === 'Literal') return `return ${firstStatement.argument.value}`;
        return 'return ...';
      }
      return 'return';
    }

    return `{ ${statements.length} statements }`;
  }

  if (body.type === 'Identifier') {
    return body.name;
  }

  if (body.type === 'Literal') {
    return String(body.value);
  }

  if (body.type === 'BinaryExpression') {
    return `${extractBodyText(body.left)} ${body.operator} ${extractBodyText(body.right)}`;
  }

  return body.type || undefined;
}

/**
 * Извлекает значение из узла
 */
function extractValue(node: any): any {
  if (!node) return undefined;

  if (node.type === 'Literal') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'UnaryExpression') {
    return `${node.operator}${extractValue(node.argument)}`;
  }

  if (node.type === 'BinaryExpression') {
    return `${extractValue(node.left)} ${node.operator} ${extractValue(node.right)}`;
  }

  if (node.type === 'ArrayExpression') {
    if (isArraySafe(node.elements)) {
      return node.elements.map((e: any) => extractValue(e)).filter((v: any) => v !== undefined);
    }
    return [];
  }

  if (node.type === 'ObjectExpression') {
    const obj: Record<string, any> = {};
    if (isArraySafe(node.properties)) {
      for (const prop of node.properties) {
        if (prop.type === 'Property' && prop.key) {
          const key = prop.key.name || prop.key.value;
          if (key !== undefined) {
            obj[key] = extractValue(prop.value);
          }
        }
      }
    }
    return obj;
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return '[Function]';
  }

  if (node.type === 'TemplateLiteral') {
    if (isArraySafe(node.quasis)) {
      return node.quasis.map((q: any) => q.value?.raw || '').join('');
    }
    return '';
  }

  if (node.type === 'NewExpression') {
    return `new ${node.callee?.name || '...'}()`;
  }

  return undefined;
}

/**
 * Получает все вызовы функций из AST
 */
export function extractCallGraph(ast: any): Record<string, string[]> {
  const callGraph: Record<string, string[]> = {};
  let currentFunction: string | null = null;

  try {
    walk(ast, {
      enter(node: any) {
        if (!node || typeof node !== 'object') return;

        if (node.type === 'FunctionDeclaration' && node.id) {
          currentFunction = node.id.name;
          if (currentFunction && !callGraph[currentFunction]) {
            callGraph[currentFunction] = [];
          }
        }

        if (node.type === 'CallExpression' && node.callee && currentFunction) {
          let calleeName: string | null = null;
          if (node.callee.type === 'Identifier') {
            calleeName = node.callee.name;
          } else if (node.callee.type === 'MemberExpression' && node.callee.property) {
            calleeName = node.callee.property.name;
          }

          if (calleeName && currentFunction) {
            const funcKey = currentFunction;
            if (!callGraph[funcKey]) {
              callGraph[funcKey] = [];
            }
            const funcCalls = callGraph[funcKey];
            if (funcCalls && !funcCalls.includes(calleeName)) {
              funcCalls.push(calleeName);
            }
          }
        }
      },
      leave(node: any) {
        if (node.type === 'FunctionDeclaration' && node.id) {
          currentFunction = null;
        }
      },
    });
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении графа вызовов:', error);
  }

  return callGraph;
}

/**
 * Экспорт утилит
 */
export default {
  extractEntities,
  extractCallGraph,
};
