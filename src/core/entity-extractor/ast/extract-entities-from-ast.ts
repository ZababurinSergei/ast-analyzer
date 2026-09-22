// packages/ast-analyzer/src/core/entity-extractor/ast/extract-entities-from-ast.ts
// ============================================
// ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ ИЗ AST — v17.0.0
// ============================================
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v17.0.0 (MVP P0/P1/P2 — минимальные изменения):
//   - ✅ [P0] functionStack + enterFunction/exitFunction
//   - ✅ [P0] parentFunctionId в registerFunction
//   - ✅ [P0] try/finally в traverse для function-like узлов
//   - ✅ [P1] lexicalLinks + addLexicalLink
//   - ✅ [P1] обработка колбэков в traverse(CallExpression)
//   - ✅ [P1] boundTo у колбэков
//   - ✅ [P2] callsInfo + detectCallKind
//   - ✅ [P2] ранний return в handleFunction/handleArrowFunction
//     для колбэков (parent.type === 'CallExpression')
//
// v16.0.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: сбор lexicalLinks
//   - ✅ ДОБАВЛЕНО: обработка колбэков в traverse(CallExpression)
//   - ✅ ДОБАВЛЕНО: boundTo у колбэков
//   - ✅ ДОБАВЛЕНО: relation — для всех типов вложенности
//   - ✅ ОБНОВЛЕНО: handleFunction пропускает колбэки (parent CallExpression)
//   - ✅ ОБНОВЛЕНО: handleArrowFunction пропускает колбэки
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: functionStack, enterFunction/exitFunction
//   - ✅ ДОБАВЛЕНО: parentFunctionId в FunctionInfo
//   - ✅ ИЗМЕНЕНО: traverse с try/finally
//   - ✅ ИЗМЕНЕНО: handleFunction/handleArrowFunction возвращают FunctionInfo
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
  LexicalLink,       // ✅ v15.2.0 (P1)
  LexicalRelation,   // ✅ v15.2.0 (P1)
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
  /**
   * Максимальная глубина рекурсии.
   * - `0` — обработать только корневые узлы (без захода в детей)
   * - `Infinity` (по умолчанию) — обойти всё дерево
   * - `N` — зайти на N уровней вглубь
   */
  maxDepth?: number;
}

// ==========================================
// ГЛАВНАЯ ФУНКЦИЯ
// ==========================================

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

  // ==========================================
  // ГЛУБИНА: минимум 0, по умолчанию Infinity
  // ==========================================
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

  /**
   * Добавляет лексическую связь.
   */
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

  if (exportsFromAST.length > 0) {
    const reExports = exportsFromAST.filter((e: any) => e.isReExport);
    const namedExports = exportsFromAST.filter((e: any) => !e.isReExport && !e.isDefault);
    const defaultExports = exportsFromAST.filter((e: any) => e.isDefault);

    // ✅ ИСПРАВЛЕНО: console.log → console.debug
    console.debug(`📤 Найдено экспортов в ${filePath || 'unknown'}: ${exportsFromAST.length}`);
    if (reExports.length > 0) {
      console.debug(`   🔄 Реэкспортов: ${reExports.length}`);
      for (const re of reExports.slice(0, 3)) {
        console.debug(`      • ${re.name} из '${re.source}'`);
      }
      if (reExports.length > 3) {
        console.debug(`      ... и ещё ${reExports.length - 3}`);
      }
    }
    if (namedExports.length > 0) {
      console.debug(`   📤 Обычных экспортов: ${namedExports.length}`);
    }
    if (defaultExports.length > 0) {
      console.debug(`   📤 Default экспортов: ${defaultExports.length}`);
    }
  }

  // ==========================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (внутри замыкания)
  // ==========================================

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
   *
   * ✅ [P0] заполняет parentFunctionId
   * ✅ [P1] добавляет lexicalLink и boundTo
   * ✅ [P2] сохраняет callsInfo (заполняется позже в traverse)
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
      // ✅ v15.2.0 (P1): опции для lexicalLink
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

    // ✅ [P0]: лексический родитель
    const lexParent = currentParent();

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
      // ✅ [P0] parentFunctionId
      parentFunctionId: lexParent?.id ?? null,
      // ✅ [P2] callsInfo будет заполнен позже в traverse
      callsInfo: [],
    } as FunctionInfo;

    // ✅ [P1]: boundTo для колбэков
    if (opts.calleeName !== undefined) {
      (funcInfo as any).boundTo = {
        calleeName: opts.calleeName,
        argumentIndex: opts.argumentIndex,
        line: node.loc?.start?.line || 1,
      };
    }

    functions.push(funcInfo);

    // ✅ [P1]: лексическая связь
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

  /**
   * ✅ [P2]: определяет callKind по узлу CallExpression.
   */
  function detectCallKind(node: any): ExtendedCallInfo['callKind'] {
    if (!node) return 'direct';

    // new Foo()
    if (node.type === 'NewExpression') return 'constructor';

    // tagged template: tag`...`
    if (node.type === 'TaggedTemplateExpression') return 'tagged-template';

    // optional chaining: obj?.foo()
    if (node.optional === true) return 'optional-chain';
    if (node.callee?.optional === true) return 'optional-chain';

    // spread: foo(...args)
    if (Array.isArray(node.arguments) && node.arguments.some((a: any) => a?.type === 'SpreadElement')) {
      return 'spread';
    }

    // callback: foo(() => {})
    if (
      Array.isArray(node.arguments) &&
      node.arguments.some(
        (a: any) => a?.type === 'ArrowFunctionExpression' || a?.type === 'FunctionExpression'
      )
    ) {
      return 'callback';
    }

    // method: obj.foo()
    if (node.callee?.type === 'MemberExpression') return 'method';

    return 'direct';
  }

  /**
   * ✅ [P2]: извлекает имя callee.
   */
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
  // ЕДИНЫЙ РЕКУРСИВНЫЙ МЕТОД ОБХОДА
  // ==========================================

  /**
   * Рекурсивный обход дерева.
   *
   * ✅ [P0] заходит в стек функций через try/finally
   * ✅ [P1] обрабатывает колбэки в CallExpression
   * ✅ [P2] собирает callsInfo для CallExpression
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

    // ==========================================
    // ✅ [P1][P2]: обработка CallExpression — колбэки + callsInfo
    // ==========================================
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const calleeName = getCalleeName(node.callee);
      const line = node.loc?.start?.line ?? 0;

      // ✅ [P2]: сохраняем расширенную информацию о вызове
      const currentFn = currentParent();
      if (currentFn) {
        const callInfo: ExtendedCallInfo = {
          targetName: calleeName,
          line,
          column: node.loc?.start?.column,
          callKind: detectCallKind(node),
          calleeName,
        };
        (currentFn as any).callsInfo = (currentFn as any).callsInfo || [];
        (currentFn as any).callsInfo.push(callInfo);
      }

      // ✅ [P1]: обходим аргументы — ищем колбэки
      if (Array.isArray(node.arguments)) {
        node.arguments.forEach((arg: any, index: number) => {
          if (
            arg &&
            (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')
          ) {
            const cbName = inferFunctionName(arg, node);

            const cb = registerFunction(cbName, arg, {
              isExported: false,
              isAsync: arg.async || false,
              isMethod: false,
              isArrow: arg.type === 'ArrowFunctionExpression',
              parentFunc: currentParent()?.name,
              isNested: currentParent() !== null,
              depth,
              isEventHandler: false,
              eventType: undefined,
              relation: 'callback',      // ✅ [P1]
              argumentIndex: index,      // ✅ [P1]
              calleeName,                // ✅ [P1]
            });

            // Обход тела колбэка со стеком
            enterFunction(cb);
            try {
              if (arg.body) {
                traverse(arg.body, arg, depth + 1);
              }
              if (Array.isArray(arg.params)) {
                for (const p of arg.params) {
                  traverse(p, arg, depth + 1);
                }
              }
            } finally {
              exitFunction();
            }
          }
        });
      }

      // Обходим callee
      if (node.callee) {
        traverse(node.callee, node, depth + 1);
      }

      // Обходим остальные аргументы (кроме колбэков)
      if (Array.isArray(node.arguments)) {
        for (const arg of node.arguments) {
          if (
            arg &&
            (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')
          ) {
            continue; // уже обработали
          }
          traverse(arg, node, depth + 1);
        }
      }

      // Обходим typeArguments
      if (node.typeArguments) {
        traverse(node.typeArguments, node, depth + 1);
      }

      return;
    }

    // ==========================================
    // Обработка текущего узла (диспетчер)
    // ==========================================
    handleNode(node, parent, depth);

    // ==========================================
    // ✅ [P0]: если функция — зайти в стек
    // ==========================================
    const isFunctionLike =
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      (node.type === 'MethodDefinition' && node.value && node.value.type === 'FunctionExpression');

    if (isFunctionLike) {
      // Находим только что зарегистрированную функцию
      const registered = functions[functions.length - 1];
      if (registered && registered.id) {
        enterFunction(registered);
        try {
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
        } finally {
          exitFunction();
        }
        return; // ← детей уже обошли внутри try
      }
    }

    // ==========================================
    // Обычный обход детей (не-функций)
    // ==========================================
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

  // ==========================================
  // ДИСПЕТЧЕР ПО ТИПУ УЗЛА
  // ==========================================

  function handleNode(node: any, parent: any, depth: number): void {
    switch (node.type) {
      case 'ImportDeclaration':
        handleImportDeclaration(node);
        break;

      // ✅ НОВОЕ v15.0.0: реэкспорты дают рёбра в imports[]
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

  // ==========================================
  // ОБРАБОТЧИК: IMPORT DECLARATION
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
            specifiers.push({
              local: localName,
              imported: importedName,
              type: 'ImportSpecifier',
            });
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
            specifiers.push({
              local: localName,
              imported: '*',
              type: 'ImportNamespaceSpecifier',
            });
          }
        }
      }
    }

    // ✅ Резолвим toFileId
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

  // ==========================================
  // ✅ v15.0.0: RE-EXPORT as IMPORT
  // ==========================================

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
          specifiers.push({
            local: localName,
            imported: importedName,
            type: 'ExportSpecifier',
          });
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
      specifiers: [
        {
          local: localName,
          imported: importedName,
          type: 'ExportAllSpecifier',
        },
      ],
      loc: node.loc || null,
      isTypeOnly,
      line: node.loc?.start?.line ?? 0,
      toFileId,
      specifiersStructured: [
        {
          local: localName,
          imported: importedName,
          type: 'ExportAllSpecifier',
        },
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

  // ==========================================
  // ОБРАБОТЧИК: FUNCTION DECLARATION / EXPRESSION
  // ==========================================

  /**
   * ✅ [P1]: пропускаем колбэки — они уже обработаны в traverse(CallExpression)
   */
  function handleFunction(node: any, parent: any, depth: number): void {
    // ✅ [P1]: колбэки уже зарегистрированы в traverse(CallExpression)
    if (parent && (parent.type === 'CallExpression' || parent.type === 'NewExpression')) {
      return;
    }

    const name = node.id?.name ?? inferFunctionName(node, parent);

    // Если имя всё равно анонимное и это не export default — пропускаем
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

    // ✅ v15.2.0 (P1): определяем relation
    let relation: LexicalRelation = 'nested';
    if (isMethod) {
      relation = 'class-method';
    } else if (parent?.type === 'ExportDefaultDeclaration') {
      relation = 'default-export';
    }

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
    });
  }

  // ==========================================
  // ОБРАБОТЧИК: ARROW FUNCTION
  // ==========================================

  /**
   * ✅ [P1]: пропускаем колбэки
   */
  function handleArrowFunction(node: any, parent: any, depth: number): void {
    // ✅ [P1]: колбэки уже обработаны в traverse(CallExpression)
    if (parent && (parent.type === 'CallExpression' || parent.type === 'NewExpression')) {
      return;
    }

    let name = inferFunctionName(node, parent);
    let isExported = false;

    // Определяем экспортируемость
    if (parent && parent.type === 'VariableDeclarator' && parent.id?.name) {
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

    // Определяем цепочку родителей
    const parentFunctions = collectParentFunctions(parent);

    // Не префиксуем, если имя уже получено из Property/PropertyDefinition/VariableDeclarator
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

    // ✅ v15.2.0 (P1): определяем relation по контексту
    let relation: LexicalRelation = 'arrow-var';
    if (parent?.type === 'Property' || parent?.type === 'PropertyDefinition') {
      relation = 'object-prop';
    } else if (parent?.type === 'ReturnStatement') {
      relation = 'return';
    } else if (parent?.type === 'ExportDefaultDeclaration') {
      relation = 'default-export';
    } else if (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') {
      // На самом деле сюда не дойдём (см. проверку выше), но на всякий случай
      relation = 'callback';
    }

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
    });
  }

  // ==========================================
  // ОБРАБОТЧИК: METHOD DEFINITION
  // ==========================================

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

    // ✅ v15.0.0: если класс анонимный — берём имя из контекста
    if (className === 'Anonymous') {
      let ctx: any = parent;
      let guard = 0;
      while (ctx && ctx.type !== 'Program' && guard < 50) {
        if (ctx.type === 'VariableDeclarator' && ctx.id?.name) {
          className = ctx.id.name;
          break;
        }
        if (ctx.type === 'ExportDefaultDeclaration') {
          className = 'default';
          break;
        }
        if (
          (ctx.type === 'FunctionDeclaration' || ctx.type === 'FunctionExpression') &&
          ctx.id?.name
        ) {
          className = ctx.id.name;
          break;
        }
        if (ctx.type === 'MethodDefinition' && ctx.key?.name) {
          className = ctx.key.name;
          break;
        }
        ctx = ctx.parent;
        guard++;
      }
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
      relation: 'class-method',
    });
  }

  // ==========================================
  // ОБРАБОТЧИК: CLASS DECLARATION
  // ==========================================

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

  // ==========================================
  // ОБРАБОТЧИК: VARIABLE DECLARATION
  // ==========================================

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

  // ==========================================
  // ОБРАБОТЧИК: TS INTERFACE DECLARATION
  // ==========================================

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

  // ==========================================
  // ОБРАБОТЧИК: TS TYPE ALIAS DECLARATION
  // ==========================================

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
  // ЗАПУСК РЕКУРСИВНОГО ОБХОДА
  // ==========================================

  if (ast && Array.isArray(ast.body)) {
    for (const rootNode of ast.body) {
      traverse(rootNode, null, 0);
    }
  }

  // ==========================================
  // ДОБАВЛЯЕМ ЭКСПОРТЫ
  // ==========================================

  const processedExports = processExports(exportsFromAST);
  exports.push(...processedExports);

  // ==========================================
  // СБОР ВЫЗОВОВ (второй проход по функциям)
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

  // ✅ [P1]: лексические связи
  result.lexicalLinks = lexicalLinks;

  if (filePath) {
    (result as any)._moduleId = moduleId;
    (result as any)._fileId = fileId;
  }

  // ==========================================
  // ЛОГИРОВАНИЕ
  // ==========================================

  console.debug(`📤 Экспортов собрано: ${exports.length}`);
  if (exports.length > 0) {
    const reExports = exports.filter(e => e.isReExport);
    const namedExports = exports.filter(e => !e.isReExport && !e.isDefault);
    const defaultExports = exports.filter(e => e.isDefault);
    console.debug(`   • Обычных экспортов: ${namedExports.length}`);
    console.debug(`   • Реэкспортов: ${reExports.length}`);
    console.debug(`   • Default экспортов: ${defaultExports.length}`);
  }

  // ✅ [P1]: логирование lexicalLinks
  if (lexicalLinks.length > 0) {
    console.debug(`🔗 Лексических связей: ${lexicalLinks.length}`);
    const byRelation: Record<string, number> = {};
    for (const link of lexicalLinks) {
      byRelation[link.relation] = (byRelation[link.relation] ?? 0) + 1;
    }
    for (const [rel, count] of Object.entries(byRelation)) {
      console.debug(`   • ${rel}: ${count}`);
    }
  }

  // ✅ [P0]: логирование parentFunctionId
  const withParent = functions.filter(f => f.parentFunctionId != null).length;
  if (withParent > 0) {
    console.debug(`🧬 Функций с parentFunctionId: ${withParent}/${functions.length}`);
  }

  // ✅ [P2]: логирование callsInfo
  const withCallsInfo = functions.filter(f => ((f as any).callsInfo?.length ?? 0) > 0).length;
  if (withCallsInfo > 0) {
    console.debug(`📞 Функций с callsInfo: ${withCallsInfo}/${functions.length}`);
  }

  return result;
}
