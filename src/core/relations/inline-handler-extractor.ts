// src/core/relations/inline-handler-extractor.ts
// ============================================================
// ИЗВЛЕЧЕНИЕ INLINE HANDLERS
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ЯВНО указаны именованные экспорты + default-экспорт
//     (устраняет TS2614 при импорте { extractCallsFromInlineHandler })
//   - ✅ Добавлен тип возвращаемого значения
//   - ✅ Исправлено regex экранирование (\s вместо \\s)
// ============================================================

import type { InlineCall } from './types.js';

// ============================================================
// ВСТРОЕННЫЕ ФУНКЦИИ
// ============================================================

const BUILTIN_FUNCTIONS = new Set([
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

// ============================================================
// ИМЕНОВАННЫЙ ЭКСПОРТ
// ============================================================

/**
 * Извлекает вызовы из inline-выражения обработчика.
 *
 * @param expression — сырое выражение из @click="..."
 * @returns Массив InlineCall
 *
 * @example
 * ```ts
 * extractCallsFromInlineHandler('() => doSomething()')
 * // [{ name: 'doSomething', line: 0 }]
 *
 * extractCallsFromInlineHandler('cond ? foo() : bar()')
 * // [{ name: 'foo', line: 0 }, { name: 'bar', line: 0 }]
 * ```
 */
export function extractCallsFromInlineHandler(expression: string): InlineCall[] {
  if (!expression || typeof expression !== 'string') return [];

  const trimmed = expression.trim();
  if (!trimmed) return [];

  const calls: InlineCall[] = [];
  const seen = new Set<string>();

  const callRegex = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = callRegex.exec(trimmed)) !== null) {
    const name = match[1];
    if (!name) continue;
    if (BUILTIN_FUNCTIONS.has(name)) continue;
    if (seen.has(name)) continue;

    seen.add(name);
    calls.push({ name, line: 0 });
  }

  return calls;
}

/**
 * Проверяет, является ли выражение inline-функцией.
 *
 * Inline-обработчик — это выражение, которое содержит логику
 * (стрелку, `function`, `;`, тернарник, `&&`, `||`), а не просто
 * имя функции.
 *
 * @param expression — сырое выражение из @click="..."
 * @returns true, если это inline-обработчик
 *
 * @example
 * ```ts
 * isInlineHandler('handleClick')          // false
 * isInlineHandler('() => doSomething()')  // true
 * isInlineHandler('cond ? a() : b()')     // true
 * ```
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

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  extractCallsFromInlineHandler,
  isInlineHandler,
};
