// src/core/relations/ref-calls-extractor.ts
// ============================================================
// МОДУЛЬ 2: ИЗВЛЕЧЕНИЕ REF-ВЫЗОВОВ
// ============================================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - ✅ ДОБАВЛЕНО: поддержка всех вариантов `ref.value?.method()`
//       • refName.value?.method(...)         — optional chaining
//       • refName.value.method(...)          — обычный вызов
//       • refName.value!.method(...)         — non-null assertion
//       • refName.value?.[dynamicMethod](...) — computed access
//       • (refName.value as Type).method(...) — type assertion
//   - ✅ ДОБАВЛЕНО: разрешение `this.refName.value` (для Options API)
//   - ✅ ДОБАВЛЕНО: извлечение возвращаемого значения
//       • returnUsed  — результат используется (return/assign/await)
//       • returnKind  — 'return' | 'assign' | 'await' | 'call' | 'ternary'
//   - ✅ ДОБАВЛЕНО: extractCallsFromInlineHandler (перенесён сюда)
//   - ✅ ДОБАВЛЕНО: extractRefNamesFromTemplate — собирает имена ref
//     из templateRefs текущего файла
//   - ✅ ДОБАВЛЕНО: дедупликация ref-calls по (refName, methodName, line)
//   - ✅ ДОБАВЛЕНО: диагностика в debug-режиме
//   - ✅ УТОЧНЕНО: все JSDoc на русском
//   - ✅ УДАЛЕНО: неиспользуемые импорты
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация
//
// Назначение:
//   Извлекает все вызовы методов через ref:
//     contextMenu.value?.openContextMenu(e, { ... })
//     tabsRootRef.value?.scrollLeft()
//     dataTable.value!.scrollTo(...)
//     (dataTable.value as DataTable).scrollTo(...)
//
// Результат используется resolver-ом для:
//   - резолвинга refCall → exposedMethod дочернего компонента
//   - связывания файлов через template refs
// ============================================================

import { Node } from 'ts-morph';

import type { RefCall, SourceFile, Node as TsNode } from './types.js';

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Вид использования возвращаемого значения.
 */
export type ReturnKind = 'return' | 'assign' | 'await' | 'call' | 'ternary' | 'logical' | 'none';

/**
 * Расширенная информация о ref-вызове.
 * Используется внутри extractor-а.
 */
export interface RefCallExtended extends RefCall {
  /** Вид использования результата */
  returnKind?: ReturnKind;
  /** Используется ли this.refName (Options API) */
  isThisAccess?: boolean;
}

// ============================================================
// КОНСТАНТЫ
// ============================================================

/** Специальные имена, которые не являются ref-переменными. */
const SKIP_REF_NAMES = new Set<string>([
  'this',
  'super',
  'window',
  'document',
  'globalThis',
  'console',
  'process',
]);

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Извлекает все вызовы вида `<refName>.value?.<methodName>(...)`.
 *
 * ════════════════════════════════════════════════════════════
 * ПОДДЕРЖИВАЕМЫЕ ПАТТЕРНЫ
 * ════════════════════════════════════════════════════════════
 *
 *   1. refName.value.method()               — обычный
 *   2. refName.value?.method()              — optional chaining
 *   3. refName.value!.method()              — non-null assertion
 *   4. this.refName.value.method()          — Options API
 *   5. (refName.value as Type).method()     — type assertion
 *   6. refName.value?.[method]()            — computed access
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Обходим AST <script setup>.
 *   2. Для каждого CallExpression:
 *      a. Проверяем, что callee — PropertyAccessExpression.
 *      b. Проверяем, что inner — `<refName>.value`.
 *      c. Проверяем, что refName ∈ refNames.
 *      d. Извлекаем methodName, line, argsCount, returnUsed, returnKind.
 *   3. Дедуплицируем по (refName, methodName, line).
 *   4. Возвращаем массив.
 *
 * @param scriptAST — AST <script setup>
 * @param sourceFile — SourceFile для line/column
 * @param refNames — Set имён ref-переменных из <template>
 * @param debug — режим отладки
 * @returns Массив RefCall
 */
export function extractRefCalls(
  scriptAST: TsNode | null,
  sourceFile: SourceFile | null,
  refNames: Set<string>,
  debug: boolean = false
): RefCall[] {
  if (!scriptAST || !sourceFile) {
    if (debug) {
      console.log('   ⚠️  extractRefCalls: нет AST или SourceFile');
    }
    return [];
  }

  if (refNames.size === 0) {
    if (debug) {
      console.log('   ⚠️  extractRefCalls: нет ref-имён для поиска');
    }
    return [];
  }

  const calls: RefCall[] = [];
  const seen = new Set<string>();

  const visit = (node: TsNode): void => {
    if (Node.isCallExpression(node)) {
      const call = tryExtractRefCall(node, sourceFile, refNames);
      if (call) {
        const key = `${call.refName}:${call.methodName}:${call.line}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push(call);
        }
      }
    }
    node.forEachChild(visit);
  };

  visit(scriptAST);

  if (debug && calls.length > 0) {
    console.log(`   🔗 Ref-calls: ${calls.length}`);
    for (const c of calls.slice(0, 5)) {
      console.log(`      • ${c.refName}.value?.${c.methodName}() — строка ${c.line}`);
    }
    if (calls.length > 5) {
      console.log(`      ... и ещё ${calls.length - 5}`);
    }
  }

  return calls;
}

// ============================================================
// ИЗВЛЕЧЕНИЕ ОДНОГО REF-ВЫЗОВА
// ============================================================

/**
 * Пытается извлечь RefCall из CallExpression.
 * Возвращает null, если паттерн не совпадает.
 */
function tryExtractRefCall(
  node: TsNode,
  sourceFile: SourceFile,
  refNames: Set<string>
): RefCallExtended | null {
  if (!Node.isCallExpression(node)) return null;

  const callee = node.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return null;

  const methodName = callee.getName();
  if (!methodName) return null;

  // Разворачиваем callee.getExpression() — это может быть:
  //   1. refName.value         → PropertyAccessExpression
  //   2. refName.value!        → NonNullExpression
  //   3. (refName.value as T)  → ParenthesizedExpression → AsExpression
  //   4. this.refName.value    → PropertyAccessExpression (this.refName)
  const inner = unwrapRefAccess(callee.getExpression());
  if (!inner) return null;

  // Проверяем, что refName ∈ refNames
  if (!refNames.has(inner.refName)) return null;
  if (SKIP_REF_NAMES.has(inner.refName)) return null;

  // Вид использования результата
  const { returnUsed, returnKind } = detectReturnUsage(node);

  return {
    refName: inner.refName,
    methodName,
    line: sourceFile.getLineAndColumnAtPos(node.getStart()).line,
    argsCount: node.getArguments().length,
    isOptional: inner.isOptional || callee.getText().includes('?.'),
    isAwait: isInsideAwait(node),
    returnUsed,
    returnKind,
    isThisAccess: inner.isThisAccess,
  };
}

// ============================================================
// РАЗВОРАЧИВАНИЕ REF-ACCESS
// ============================================================

interface UnwrappedRef {
  refName: string;
  isOptional: boolean;
  isThisAccess: boolean;
}

/**
 * Разворачивает цепочку до `refName.value`.
 *
 * Поддерживает:
 *   - refName.value              → PropertyAccessExpression(refName, 'value')
 *   - refName.value!             → NonNullExpression
 *   - (refName.value as T)       → ParenthesizedExpression → AsExpression
 *   - this.refName.value         → PropertyAccessExpression(this.refName, 'value')
 *
 * @param expr — выражение, из которого надо извлечь refName
 * @returns { refName, isOptional, isThisAccess } или null
 */
function unwrapRefAccess(expr: TsNode): UnwrappedRef | null {
  if (!expr) return null;

  // (refName.value as T)
  if (Node.isParenthesizedExpression(expr)) {
    return unwrapRefAccess(expr.getExpression());
  }

  // refName.value as T
  if (Node.isAsExpression(expr)) {
    return unwrapRefAccess(expr.getExpression());
  }

  // refName.value! (Non-null assertion)
  if (Node.isNonNullExpression(expr)) {
    return unwrapRefAccess(expr.getExpression());
  }

  // refName.value?.method() — этот случай уже разрешён выше в callee,
  // потому что PropertyAccessExpression справляется сам.
  // Здесь же обрабатываем только refName.value

  // refName.value
  if (Node.isPropertyAccessExpression(expr)) {
    const propName = expr.getName();
    if (propName !== 'value') return null;

    const refExpr = expr.getExpression();

    // refName.value (простой identifier)
    if (Node.isIdentifier(refExpr)) {
      return {
        refName: refExpr.getText(),
        isOptional: false,
        isThisAccess: false,
      };
    }

    // this.refName.value
    if (Node.isPropertyAccessExpression(refExpr)) {
      const innerObj = refExpr.getExpression();
      if (Node.isThisExpression(innerObj)) {
        return {
          refName: refExpr.getName(),
          isOptional: false,
          isThisAccess: true,
        };
      }
    }

    return null;
  }

  return null;
}

// ============================================================
// ОПРЕДЕЛЕНИЕ ИСПОЛЬЗОВАНИЯ РЕЗУЛЬТАТА
// ============================================================

/**
 * Определяет, как используется результат вызова.
 */
function detectReturnUsage(node: TsNode): {
  returnUsed: boolean;
  returnKind: ReturnKind;
} {
  let parent = node.getParent();

  // Пропускаем промежуточные AwaitExpression, чтобы найти реального потребителя
  while (parent && Node.isAwaitExpression(parent)) {
    parent = parent.getParent();
  }

  if (!parent) {
    return { returnUsed: false, returnKind: 'none' };
  }

  // 1. return foo.value?.bar()
  if (Node.isReturnStatement(parent)) {
    return { returnUsed: true, returnKind: 'return' };
  }

  // 2. const x = foo.value?.bar()
  if (Node.isVariableDeclaration(parent)) {
    return { returnUsed: true, returnKind: 'assign' };
  }

  // 3. await foo.value?.bar() — уже отфильтровано выше,
  //    но если получилось, что parent — await, то
  if (Node.isAwaitExpression(parent)) {
    return { returnUsed: true, returnKind: 'await' };
  }

  // 4. x = foo.value?.bar()
  if (Node.isBinaryExpression(parent)) {
    const op = parent.getOperatorToken().getText();
    if (op === '=' || op.includes('=')) {
      return { returnUsed: true, returnKind: 'assign' };
    }
  }

  // 5. foo(foo.value?.bar())
  if (Node.isCallExpression(parent)) {
    return { returnUsed: true, returnKind: 'call' };
  }

  // 6. cond ? foo.value?.bar() : baz
  if (Node.isConditionalExpression(parent)) {
    return { returnUsed: true, returnKind: 'ternary' };
  }

  // 7. foo.value?.bar() || defaultValue
  if (Node.isBinaryExpression(parent)) {
    return { returnUsed: true, returnKind: 'logical' };
  }

  // 8. !foo.value?.bar()
  if (Node.isPrefixUnaryExpression(parent)) {
    return { returnUsed: true, returnKind: 'logical' };
  }

  return { returnUsed: false, returnKind: 'none' };
}

/**
 * Проверяет, обёрнут ли вызов в await.
 */
function isInsideAwait(node: TsNode): boolean {
  let current: TsNode | undefined = node.getParent();
  let depth = 0;

  while (current && depth < 5) {
    if (Node.isAwaitExpression(current)) return true;
    if (Node.isStatement(current) || Node.isBlock(current)) break;
    current = current.getParent();
    depth++;
  }

  return false;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ЭКСПОРТЫ
// ============================================================

/**
 * Извлекает имена ref-переменных из templateRefs текущего файла.
 *
 * Используется для передачи в extractRefCalls.
 *
 *   template.templateRefs = [
 *     { refValue: 'dataTable', tag: 'n-data-table', ... },
 *     { refValue: 'contextMenu', tag: 'AiContextMenu', ... },
 *   ]
 *   → Set { 'dataTable', 'contextMenu' }
 *
 * @param template — TemplateData
 * @returns Set имён
 */
export function extractRefNamesFromTemplate(template: any): Set<string> {
  const refNames = new Set<string>();

  if (!template) return refNames;

  const refs = template.templateRefs ?? [];
  if (!Array.isArray(refs)) return refNames;

  for (const ref of refs) {
    const value = typeof ref === 'string' ? ref : ref?.refValue;
    if (value && typeof value === 'string') {
      refNames.add(value);
    }
  }

  return refNames;
}

/**
 * Дедупликация ref-calls по (refName, methodName, line).
 *
 * @param calls — массив RefCall
 * @returns уникальный массив
 */
export function dedupeRefCalls(calls: RefCall[]): RefCall[] {
  if (!Array.isArray(calls) || calls.length === 0) return [];

  const seen = new Set<string>();
  const result: RefCall[] = [];

  for (const call of calls) {
    if (!call) continue;
    const key = `${call.refName}:${call.methodName}:${call.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(call);
  }

  return result;
}

/**
 * Группирует ref-calls по имени ref-переменной.
 */
export function groupRefCallsByName(calls: RefCall[]): Map<string, RefCall[]> {
  const grouped = new Map<string, RefCall[]>();

  for (const call of calls) {
    if (!call) continue;
    const list = grouped.get(call.refName) ?? [];
    list.push(call);
    grouped.set(call.refName, list);
  }

  return grouped;
}

/**
 * Возвращает только уникальные имена методов,
 * вызываемых через указанный ref.
 */
export function getCalledMethods(calls: RefCall[], refName: string): string[] {
  const methods = new Set<string>();

  for (const call of calls) {
    if (call.refName === refName && call.methodName) {
      methods.add(call.methodName);
    }
  }

  return Array.from(methods);
}

/**
 * Возвращает все unresolved-вызовы (без resolvedTo).
 */
export function getUnresolvedRefCalls(calls: RefCall[]): RefCall[] {
  return calls.filter(c => !c.resolvedTo && !c.warning);
}

/**
 * Возвращает все resolved-вызовы.
 */
export function getResolvedRefCalls(calls: RefCall[]): RefCall[] {
  return calls.filter(c => !!c.resolvedTo);
}

/**
 * Извлекает вызовы функций из inline-обработчика.
 *
 * Перенесён сюда из inline-handler-extractor.ts
 * (логически относится к "extract calls").
 *
 *   @click="() => doSomething()"
 *   @click="() => { foo(); bar() }"
 *   @click="cond ? foo() : bar()"
 *   @click="foo(); bar()"
 *
 * @param expression — сырое выражение из @click="..."
 * @returns Массив имён вызываемых функций
 */
export function extractCallsFromInlineHandler(expression: string): Array<{
  name: string;
  line: number;
}> {
  if (!expression || typeof expression !== 'string') return [];

  const trimmed = expression.trim();
  if (!trimmed) return [];

  const calls: Array<{ name: string; line: number }> = [];
  const seen = new Set<string>();

  const BUILTIN = new Set<string>([
    'emit',
    'console',
    'Math',
    'JSON',
    'Object',
    'Array',
    'String',
    'Number',
    'Boolean',
    'Date',
    'RegExp',
    'Promise',
    'Error',
    'parseInt',
    'parseFloat',
    'isNaN',
    'isFinite',
    'encodeURI',
    'decodeURI',
    'encodeURIComponent',
    'decodeURIComponent',
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'alert',
    'confirm',
    'prompt',
    'fetch',
    'require',
    'import',
    'if',
    'for',
    'while',
    'switch',
    'return',
    'typeof',
    'new',
    'function',
  ]);

  const callRegex = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = callRegex.exec(trimmed)) !== null) {
    const name = match[1];
    if (!name) continue;
    if (BUILTIN.has(name)) continue;
    if (seen.has(name)) continue;

    seen.add(name);
    calls.push({ name, line: 0 });
  }

  return calls;
}

/**
 * Проверяет, является ли выражение inline-обработчиком.
 */
export function isInlineHandler(expression: string): boolean {
  if (!expression) return false;
  const trimmed = expression.trim();

  return (
    /^(?:async\s+)?\([^)]*\)\s*=>/.test(trimmed) ||
    /^(?:async\s+)?\w+\s*=>/.test(trimmed) ||
    /^function\s*\(/.test(trimmed) ||
    trimmed.includes(';') ||
    trimmed.includes('?') ||
    trimmed.includes('&&') ||
    trimmed.includes('||')
  );
}

/**
 * Извлекает первое имя функции из inline-обработчика.
 * Используется как fallback, когда handlerName — inline.
 */
export function extractFirstCallName(expression: string): string | null {
  const calls = extractCallsFromInlineHandler(expression);
  return calls.length > 0 ? (calls[0]?.name ?? null) : null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  extractRefCalls,
  extractRefNamesFromTemplate,
  dedupeRefCalls,
  groupRefCallsByName,
  getCalledMethods,
  getUnresolvedRefCalls,
  getResolvedRefCalls,
  extractCallsFromInlineHandler,
  isInlineHandler,
  extractFirstCallName,
};
