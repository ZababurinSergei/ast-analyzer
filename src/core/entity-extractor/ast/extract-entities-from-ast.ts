// packages/ast-analyzer/src/core/entity-extractor/ast/extract-entities-from-ast.ts
// ============================================
// ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ ИЗ AST — v17.4.1
// ============================================
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v17.4.1 (fix: argumentIndex из walk, а не indexOf):
//   - ✅ ИСПРАВЛЕНО: argumentIndex для колбэков теперь берётся
//     из 4-го аргумента enter() — index (индекс в родительском
//     массиве), а не из parent.arguments.indexOf(node).
//     Раньше indexOf мог вернуть -1, что ломало round-trip
//     (L1/L2/DL: -1 vs undefined в lexicalLinks).
//   - ✅ ПРОКИНУТО: key, index через handleNode →
//     handleFunction / handleArrowFunction.
//
// v17.4.0 (Вариант A: estree-walker + WeakMap parent):
//   - ✅ УДАЛЕНО: самописный traverse
//   - ✅ УДАЛЕНО: node.parent = parent (ломало pipeline — циклы)
//   - ✅ ДОБАВЛЕНО: walk() из estree-walker
//   - ✅ ДОБАВЛЕНО: parentMap (WeakMap<node, parent>)
//   - ✅ ДОБАВЛЕНО: classStack для handleMethodDefinition
//   - ✅ ДОБАВЛЕНО: boundTo для колбэков через (parent, index) из walk
//   - ✅ ИЗМЕНЕНО: collectParentFunctions → parentMap
//   - ✅ ИЗМЕНЕНО: handleFunction / handleArrowFunction — без ранних return
//   - ✅ ИЗМЕНЕНО: handleMethodDefinition — через classStack
//   - ✅ ИЗМЕНЕНО: handleArrowFunction — isExported через parentMap
//
// v17.3.0 (имя класса → имя модуля):
//   - ✅ ДОБАВЛЕНО: импорт inferClassName из helpers/infer-class-name.js
//
// v17.1.0 (Vue-сущности):
//   - ✅ ДОБАВЛЕНО: вызов classifyVueKind() в registerFunction
//   - ✅ ДОБАВЛЕНО: поле vueKind в FunctionInfo
//
// v17.0.0 (MVP P0/P1/P2):
//   - ✅ [P0] functionStack + enterFunction/exitFunction
//   - ✅ [P0] parentFunctionId в registerFunction
//   - ✅ [P1] lexicalLinks + addLexicalLink
//   - ✅ [P1] boundTo у колбэков
//   - ✅ [P2] callsInfo + detectCallKind
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: functionStack, enterFunction/exitFunction
//   - ✅ ДОБАВЛЕНО: parentFunctionId в FunctionInfo
//
// v15.0.0 (удаление callback-логики):
//   - ✅ УДАЛЕНО: v14.0.0 callback-логика (перенесена в relation-resolver)
//
// v7.1.0 (правильная обработка реэкспортов):
//   - ✅ ИСПРАВЛЕНО: handleImportDeclaration заполняет local/imported
//   - ✅ ДОБАВЛЕНО: handleExportAllAsImport
//   - ✅ ДОБАВЛЕНО: handleExportNamedAsImport
//   - ✅ ДОБАВЛЕНО: resolveImportPathSafe
// ============================================

import path from 'path';
import { walk } from 'estree-walker';

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
  LexicalLink,
  LexicalRelation,
} from '../../../types.js';
import idManager from '../../IdManager.js';
import { collectExportsFromAST, resolveFilePath } from '../../ast-parser.js';
import { isNodeExported } from '../helpers/is-node-exported.js';
import { isEventHandler } from '../helpers/is-event-handler.js';
import { extractEventType } from '../helpers/extract-event-type.js';
import { extractBodyText } from '../helpers/extract-body-text.js';
import { extractValue } from '../helpers/extract-value.js';
import { calculateComplexity } from '../helpers/calculate-complexity.js';
import { analyzeSecurity } from '../helpers/analyze-security.js';
import { createEmptyEntitiesResult } from '../helpers/create-empty-result.js';
import { inferFunctionName } from '../helpers/infer-function-name.js';

// ✅ v17.3.0: единый helper для имени класса
// (имя класса → контекст → имя модуля → 'AnonymousClass')
import { inferClassName } from '../helpers/infer-class-name.js';

// ✅ v17.1.0: классификация Vue-сущностей
import { classifyVueKind } from '../helpers/classify-vue-kind.js';

import { findFunctionNode } from './find-function-node.js';
import { collectAllCallsRecursive } from './collect-all-calls-recursive.js';
import { processExports } from './process-exports.js';

// ==========================================
// ✅ [P2]: ExtendedCallInfo — расширенная информация о вызове
// ==========================================

export interface ExtendedCallInfo {
  targetName: string;
  line: number;
  column?: number;
  callKind?:
    | 'direct'
    | 'method'
    | 'callback'
    | 'constructor'
    | 'tagged-template'
    | 'optional-chain'
    | 'spread'
    | 'new';
  calleeName?: string;
  argumentIndex?: number;
}

// ==========================================
// ОПЦИИ РЕКУРСИВНОГО ОБХОДА
// ==========================================

export interface TraverseOptions {
  maxDepth?: number;
}

// ==========================================
// ГЛАВНАЯ ФУНКЦИЯ
// ==========================================

export function extractEntitiesFromAST(
  ast: any,
  filePath?: string,
  options: TraverseOptions = {}
): EntitiesResult {
  const result = createEmptyEntitiesResult(filePath);

  const maxDepth = options.maxDepth === undefined ? Infinity : Math.max(0, options.maxDepth);

  // ==========================================
  // КОНТЕКСТ (мутируется в процессе обхода)
  // ==========================================
  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const constants: ConstantInfo[] = [];
  const interfaces: InterfaceInfo[] = [];
  const types: TypeInfo[] = [];
  const variables: VariableInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const callGraph: Record<string, string[]> = {};

  // ✅ [P0] Стек функций для parentFunctionId
  const functionStack: FunctionInfo[] = [];

  // ✅ v17.4.0: parentMap — заменяет node.parent
  const parentMap = new WeakMap<any, any>();

  // ✅ v17.4.0: classStack — для handleMethodDefinition
  const classStack: any[] = [];

  function currentParent(): FunctionInfo | null {
    return functionStack[functionStack.length - 1] ?? null;
  }

  function enterFunction(fn: FunctionInfo): void {
    functionStack.push(fn);
  }

  function exitFunction(): void {
    functionStack.pop();
  }

  // ✅ [P1] Коллекция lexicalLinks
  const lexicalLinks: LexicalLink[] = [];
  let lexicalCounter = 0;

  function addLexicalLink(
    parentFunctionId: string | null,
    childFunctionId: string,
    relation: LexicalRelation,
    line: number,
    argumentIndex?: number,
    calleeName?: string
  ): void {
    lexicalCounter++;
    lexicalLinks.push({
      id: `lx${lexicalCounter}`,
      parentFunctionId,
      childFunctionId,
      relation,
      line,
      argumentIndex,
      calleeName,
    });
  }

  const moduleId = filePath && idManager.getModuleId ? idManager.getModuleId(filePath) : undefined;
  const fileId = filePath && idManager.getFileId ? idManager.getFileId(filePath) : undefined;
  const fileDir = filePath ? path.dirname(filePath) : process.cwd();

  // ==========================================
  // ЭКСПОРТЫ ИЗ AST (собираются заранее)
  // ==========================================
  const exportsFromAST = collectExportsFromAST(ast);

  // ==========================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ==========================================

  /**
   * Собирает цепочку родительских функций для узла.
   * ✅ v17.4.0: через parentMap.
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
          let classParent = parentMap.get(current);
          while (classParent && classParent.type !== 'Program') {
            if (classParent.type === 'ClassDeclaration' && classParent.id) {
              parentFunctions.unshift(classParent.id.name);
              break;
            }
            classParent = parentMap.get(classParent);
          }
          parentFunctions.push(methodName);
        }
      }
      current = parentMap.get(current);
    }

    return parentFunctions;
  }

  function extractParamNames(params: any[]): string[] {
    if (!Array.isArray(params)) return [];
    return params.map((p: any) => {
      if (p.type === 'Identifier') return p.name || 'unknown';
      if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
      if (p.type === 'RestElement' && p.argument) return `...${p.argument.name || 'unknown'}`;
      return 'unknown';
    });
  }

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
      relation?: LexicalRelation;
      argumentIndex?: number;
      calleeName?: string;
    }
  ): FunctionInfo {
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

    const lexParent = currentParent();

    // ✅ v17.4.0: parentType через parentMap
    const parentType = parentMap.get(node)?.type;
    // FE-34-FIX: передаём isNested — без него useEffect_callback
    // (isNested=true) не классифицируется как callback.
    const vueKind = classifyVueKind(name, opts.isArrow, parentType, opts.isNested);

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
      parentFunctionId: lexParent?.id ?? null,
      callsInfo: [],
      vueKind,
    } as FunctionInfo;

    if (opts.calleeName !== undefined) {
      (funcInfo as any).boundTo = {
        calleeName: opts.calleeName,
        argumentIndex: opts.argumentIndex,
        line: node.loc?.start?.line || 1,
      };
    }

    functions.push(funcInfo);

    const relation: LexicalRelation =
      opts.relation ?? (opts.isMethod ? 'class-method' : opts.isArrow ? 'arrow-var' : 'nested');

    addLexicalLink(
      lexParent?.id ?? null,
      funcId,
      relation,
      node.loc?.start?.line || 1,
      opts.argumentIndex,
      opts.calleeName
    );

    if (!callGraph[name]) {
      callGraph[name] = [];
    }

    return funcInfo;
  }

  function detectCallKind(node: any): ExtendedCallInfo['callKind'] {
    if (!node) return 'direct';
    if (node.type === 'NewExpression') return 'constructor';
    if (node.type === 'TaggedTemplateExpression') return 'tagged-template';
    if (node.optional === true) return 'optional-chain';
    if (node.callee?.optional === true) return 'optional-chain';

    if (
      Array.isArray(node.arguments) &&
      node.arguments.some((a: any) => a?.type === 'SpreadElement')
    ) {
      return 'spread';
    }

    if (
      Array.isArray(node.arguments) &&
      node.arguments.some(
        (a: any) => a?.type === 'ArrowFunctionExpression' || a?.type === 'FunctionExpression'
      )
    ) {
      return 'callback';
    }

    if (node.callee?.type === 'MemberExpression') return 'method';

    return 'direct';
  }

  function getCalleeName(callee: any): string {
    if (!callee) return 'unknown';
    if (callee.type === 'Identifier') return callee.name || 'unknown';
    if (callee.type === 'MemberExpression' && callee.property) {
      if (callee.property.type === 'Identifier') return callee.property.name || 'unknown';
      if (callee.property.type === 'Literal') return String(callee.property.value);
    }
    if (callee.type === 'ChainExpression' && callee.expression) {
      return getCalleeName(callee.expression);
    }
    return 'unknown';
  }

  // ==========================================
  // ДИСПЕТЧЕР ПО ТИПУ УЗЛА
  // ==========================================

  function handleNode(node: any, parent: any, depth: number, key?: any, index?: any): void {
    switch (node.type) {
      case 'ImportDeclaration':
        handleImportDeclaration(node);
        break;

      case 'ExportNamedDeclaration':
        if (node.source && Array.isArray(node.specifiers) && node.specifiers.length > 0) {
          handleExportNamedAsImport(node);
        }
        break;

      case 'ExportAllDeclaration':
        if (node.source) handleExportAllAsImport(node);
        break;

      case 'FunctionDeclaration':
      case 'FunctionExpression':
        handleFunction(node, parent, depth, key, index);
        break;

      case 'ArrowFunctionExpression':
        handleArrowFunction(node, parent, depth, key, index);
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

  // ==========================================
  // ОБРАБОТЧИКИ
  // ==========================================

  function handleImportDeclaration(node: any): void {
    if (!node.source) return;

    const source = node.source.value;
    const isTypeOnly = node.importKind === 'type';
    const specifiers: { local: string; imported: string; type: string }[] = [];

    if (Array.isArray(node.specifiers)) {
      for (const spec of node.specifiers) {
        if (!spec) continue;

        if (spec.type === 'ImportSpecifier') {
          const importedName = spec.imported?.name ?? spec.local?.name;
          const localName = spec.local?.name ?? spec.imported?.name;
          if (importedName && localName) {
            specifiers.push({ local: localName, imported: importedName, type: 'ImportSpecifier' });
          }
        } else if (spec.type === 'ImportDefaultSpecifier') {
          const localName = spec.local?.name;
          if (localName) {
            specifiers.push({
              local: localName,
              imported: 'default',
              type: 'ImportDefaultSpecifier',
            });
          }
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          const localName = spec.local?.name;
          if (localName) {
            specifiers.push({ local: localName, imported: '*', type: 'ImportNamespaceSpecifier' });
          }
        }
      }
    }

    const toFileId = resolveImportPathSafe(source, fileDir);

    imports.push({
      source: source || '',
      specifiers,
      loc: node.loc || null,
      isTypeOnly,
      line: node.loc?.start?.line ?? 0,
      toFileId,
      specifiersStructured: specifiers,
      isReExport: false,
      isStarReExport: false,
    });
  }

  function handleExportNamedAsImport(node: any): void {
    if (!node.source) return;
    if (!Array.isArray(node.specifiers) || node.specifiers.length === 0) return;

    const source = node.source.value;
    const isTypeOnly = node.exportKind === 'type';
    const specifiers: { local: string; imported: string; type: string }[] = [];

    for (const spec of node.specifiers) {
      if (!spec) continue;
      if (spec.type === 'ExportSpecifier') {
        const importedName = spec.local?.name ?? spec.exported?.name;
        const localName = spec.exported?.name ?? spec.local?.name;
        if (importedName && localName) {
          specifiers.push({ local: localName, imported: importedName, type: 'ExportSpecifier' });
        }
      }
    }

    if (specifiers.length === 0) return;

    const toFileId = resolveImportPathSafe(source, fileDir);

    imports.push({
      source,
      specifiers,
      loc: node.loc || null,
      isTypeOnly,
      line: node.loc?.start?.line ?? 0,
      toFileId,
      specifiersStructured: specifiers,
      isReExport: true,
      isStarReExport: false,
    });
  }

  function handleExportAllAsImport(node: any): void {
    if (!node.source) return;

    const source = node.source.value;
    const isTypeOnly = node.exportKind === 'type';

    let localName = '*';
    let importedName = '*';

    if (node.exported?.name) {
      localName = node.exported.name;
      importedName = '*';
    }

    const toFileId = resolveImportPathSafe(source, fileDir);

    imports.push({
      source,
      specifiers: [{ local: localName, imported: importedName, type: 'ExportAllSpecifier' }],
      loc: node.loc || null,
      isTypeOnly,
      line: node.loc?.start?.line ?? 0,
      toFileId,
      specifiersStructured: [
        { local: localName, imported: importedName, type: 'ExportAllSpecifier' },
      ],
      isReExport: true,
      isStarReExport: true,
    });
  }

  function resolveImportPathSafe(source: string, baseDir: string): string | null {
    if (!source) return null;
    if (source.startsWith('.') || source.startsWith('/')) {
      try {
        return resolveFilePath(baseDir, source) ?? null;
      } catch {
        return null;
      }
    }
    if (source.startsWith('@/') || source.startsWith('~') || source.startsWith('#')) {
      try {
        return resolveFilePath(baseDir, source) ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * ✅ v17.4.0: колбэки больше не пропускаются —
   * walk сам зайдёт в них, и registerFunction будет вызван здесь.
   * ✅ v17.4.1: index берётся из walk (4-й аргумент enter).
   */
  function handleFunction(node: any, parent: any, depth: number, _key?: any, index?: any): void {
    const name = node.id?.name ?? inferFunctionName(node, parent);

    if (name === 'anonymous_function' && parent?.type !== 'ExportDefaultDeclaration') {
      return;
    }

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
      // ✅ v17.4.0: имя класса из classStack
      const classNode = classStack[classStack.length - 1];
      if (classNode) {
        className = inferClassName(classNode, filePath);
      }
      if (className) fullName = className + '.' + name;
    }

    const isNested = parentFunctions.length > 0 || depth > 0;
    const parentFunc = parentFunctions.length > 0 ? parentFunctions.join('.') : undefined;

    let relation: LexicalRelation = 'nested';
    if (isMethod) {
      relation = 'class-method';
    } else if (parent?.type === 'ExportDefaultDeclaration') {
      relation = 'default-export';
    } else if (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') {
      relation = 'callback';
    }

    // ✅ v17.4.1: boundTo для колбэков (index из walk, а не indexOf)
    const isCallback = parent?.type === 'CallExpression' || parent?.type === 'NewExpression';
    const calleeName = isCallback ? getCalleeName(parent.callee) : undefined;
    const argumentIndex = isCallback && typeof index === 'number' ? index : undefined;

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
      relation,
      calleeName,
      argumentIndex,
    });
  }

  /**
   * ✅ v17.4.0: колбэки больше не пропускаются.
   * ✅ v17.4.1: index берётся из walk (4-й аргумент enter).
   */
  function handleArrowFunction(
    node: any,
    parent: any,
    depth: number,
    _key?: any,
    index?: any
  ): void {
    let name = inferFunctionName(node, parent);
    let isExported = false;

    // isExported через parentMap
    if (parent && parent.type === 'VariableDeclarator' && parent.id?.name) {
      let exportParent = parentMap.get(parent);
      while (exportParent && exportParent.type !== 'Program') {
        if (
          exportParent.type === 'ExportNamedDeclaration' ||
          exportParent.type === 'ExportDefaultDeclaration'
        ) {
          isExported = true;
          break;
        }
        exportParent = parentMap.get(exportParent);
      }
    }

    const parentFunctions = collectParentFunctions(parent);

    const alreadyNamed =
      parent?.type === 'Property' ||
      parent?.type === 'PropertyDefinition' ||
      parent?.type === 'VariableDeclarator';

    if (parentFunctions.length > 0 && !alreadyNamed) {
      name = parentFunctions.join('.') + '.' + name;
    }

    const isEventHandlerNode = isEventHandler(node) || isEventHandler(parent);
    const eventType = isEventHandlerNode ? extractEventType(parent || node) : undefined;

    const isNested = parentFunctions.length > 0 || depth > 0;
    const parentFunc = parentFunctions.length > 0 ? parentFunctions.join('.') : undefined;

    let relation: LexicalRelation = 'arrow-var';
    if (parent?.type === 'Property' || parent?.type === 'PropertyDefinition') {
      relation = 'object-prop';
    } else if (parent?.type === 'ReturnStatement') {
      relation = 'return';
    } else if (parent?.type === 'ExportDefaultDeclaration') {
      relation = 'default-export';
    } else if (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') {
      relation = 'callback';
    }

    // ✅ v17.4.1: boundTo для колбэков (index из walk, а не indexOf)
    const isCallback = parent?.type === 'CallExpression' || parent?.type === 'NewExpression';
    const calleeName = isCallback ? getCalleeName(parent.callee) : undefined;
    const argumentIndex = isCallback && typeof index === 'number' ? index : undefined;

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
      relation,
      calleeName,
      argumentIndex,
    });
  }

  /**
   * ✅ v17.4.0: имя класса из classStack — без циклов по .parent.
   */
  function handleMethodDefinition(node: any, _parent: any, depth: number): void {
    if (!node.key) return;

    const methodName = node.key.name || node.key.value;
    if (!methodName) return;

    // ✅ v17.4.0: класс из стека
    const classNode = classStack[classStack.length - 1];
    const className = classNode ? inferClassName(classNode, filePath) : 'AnonymousClass';
    const fullName = `${className}.${methodName}`;

    // isExported: класс экспортируется?
    let isExported = false;
    if (classNode) {
      isExported = isNodeExported(classNode, parentMap.get(classNode));
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
      relation: 'class-method',
    });
  }

  function handleClassDeclaration(node: any, parent: any): void {
    const name = node.id?.name ?? inferClassName(node, filePath);
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
      name: name || 'AnonymousClass',
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

  function handleVariableDeclaration(node: any, parent: any): void {
    const isExported = isNodeExported(node, parent);
    const kind = node.kind;

    if (!Array.isArray(node.declarations)) return;

    for (const decl of node.declarations) {
      if (!decl) continue;
      if (decl.id?.type !== 'Identifier') continue;

      const name = decl.id.name;
      const isConst = kind === 'const';

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

  // ==========================================
  // ✅ v17.4.0: ЗАПУСК ОБХОДА ЧЕРЕЗ estree-walker
  // ✅ v17.4.1: прокидываем key, index в handleNode
  // ==========================================

  if (ast) {
    const depths = new WeakMap<any, number>();
    const pushedFns = new WeakSet<any>();
    const pushedClasses = new WeakSet<any>();

    walk(ast, {
      enter(node: any, parent: any, key: any, index: any) {
        if (!node || typeof node !== 'object') return;
        if (!node.type) return;

        // 1. parentMap
        if (parent) parentMap.set(node, parent);

        // 2. depth
        const parentDepth = parent ? (depths.get(parent) ?? 0) : -1;
        const depth = parentDepth + 1;
        depths.set(node, depth);

        if (depth > maxDepth) {
          this.skip();
          return;
        }

        // 3. callsInfo
        if (node.type === 'CallExpression' || node.type === 'NewExpression') {
          const calleeName = getCalleeName(node.callee);
          const currentFn = currentParent();
          if (currentFn) {
            (currentFn as any).callsInfo = (currentFn as any).callsInfo || [];
            (currentFn as any).callsInfo.push({
              targetName: calleeName,
              line: node.loc?.start?.line ?? 0,
              column: node.loc?.start?.column,
              callKind: detectCallKind(node),
              calleeName,
            } as ExtendedCallInfo);
          }
        }

        // 4. classStack
        if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
          classStack.push(node);
          pushedClasses.add(node);
        }

        // 5. диспетчер (с key, index — для boundTo у колбэков)
        handleNode(node, parent, depth, key, index);

        // 6. functionStack
        const isFunctionLike =
          node.type === 'FunctionDeclaration' ||
          node.type === 'FunctionExpression' ||
          node.type === 'ArrowFunctionExpression' ||
          (node.type === 'MethodDefinition' &&
            node.value &&
            node.value.type === 'FunctionExpression');

        if (isFunctionLike) {
          const registered = functions[functions.length - 1];
          if (registered && registered.id) {
            enterFunction(registered);
            pushedFns.add(node);
          }
        }
      },

      leave(node: any) {
        if (pushedFns.has(node)) {
          exitFunction();
          pushedFns.delete(node);
        }
        if (pushedClasses.has(node)) {
          classStack.pop();
          pushedClasses.delete(node);
        }
      },
    });
  }

  // ==========================================
  // ДОБАВЛЯЕМ ЭКСПОРТЫ
  // ==========================================

  const processedExports = processExports(exportsFromAST);
  exports.push(...processedExports);

  // ==========================================
  // СБОР ВЫЗОВОВ (второй проход)
  // ==========================================

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

  // ==========================================
  // ПОСТРОЕНИЕ calledBy
  // ==========================================

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

  // ==========================================
  // ✅ [P1]: помечаем self-функции
  // ==========================================

  for (const func of functions) {
    const hasCalls = (func.calls?.length ?? 0) > 0;
    const hasCalledBy = (func.calledBy?.length ?? 0) > 0;
    const isSelf = !hasCalls && !hasCalledBy;
    (func as any).isSelf = isSelf;
    (func as any)._isSelf = isSelf;
  }

  // ==========================================
  // ЗАПОЛНЕНИЕ РЕЗУЛЬТАТА
  // ==========================================

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
  result.lexicalLinks = lexicalLinks;

  if (filePath) {
    (result as any)._moduleId = moduleId;
    (result as any)._fileId = fileId;
  }

  return result;
}
