// src/reporters/utils/canonical-utils.ts
// ============================================
// КАНОНИЗАЦИЯ FULLJSON
// ============================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Единый источник истины для канонизации FullJSON.
// Устраняет дублирование между:
//   - codec-encode.ts::extractNumericId / sortByIdNumeric / canonicalizeFullJSON
//   - compact-reporter.ts::extractNumericId / sortByIdNumeric / canonicalizeFullJSON
//
// ЧТО ТАКОЕ КАНОНИЗАЦИЯ
// ---------------------
// Это приведение FullJSON к детерминированному порядку
// для сравнения и кодирования. Ключевой принцип:
//   - все массивы сортируются по числовому id (fn1 < fn2 < ... < fn10)
//   - порядок ключей внутри объектов НЕ меняется
//   - вложенные массивы (fileIds, methods, params) НЕ сортируются
//
// ⚠️ ВАЖНО: `sortByIdNumeric` использует `extractNumericId`,
// который извлекает ЧИСЛОВОЙ суффикс из id:
//   'fn1'   → 1
//   'fn42'  → 42
//   'fn100' → 100
//   'cn9799'→ 9799
//
// Без этого `Array.prototype.sort()` дал бы строковую сортировку:
//   ['fn1', 'fn10', 'fn2'] вместо ['fn1', 'fn2', 'fn10']
//
// ПРИМЕНЕНИЕ
// ----------
// Вызывается в конце сбора FullJSON:
//   • compact-reporter.ts::collectFullJSON → canonicalizeFullJSON(result)
//   • codec-encode.ts::encode             → canonicalizeFullJSON(payload)
//
// Это гарантирует, что:
//   1. full.json на диске имеет детерминированный порядок.
//   2. encode(full) даёт тот же порядок, что compact на диске.
//   3. Round-trip L0/L3/RE не падает из-за порядка массивов.
//
// ИСТОРИЯ
// -------
// v1.0.0 — первая версия. Вынесено из compact-reporter.ts и
//          codec-encode.ts для устранения дублирования.
// ============================================

import type { FullJSON } from '../codec/codec-types.js';

// ============================================
// ИЗВЛЕЧЕНИЕ ЧИСЛОВОГО ID
// ============================================

/**
 * Извлекает числовой суффикс из `id` (`fn123` → 123).
 *
 * ════════════════════════════════════════════════════════════
 * ПРАВИЛА
 * ════════════════════════════════════════════════════════════
 *
 *   - `'fn1'`    → 1
 *   - `'fn42'`   → 42
 *   - `'fn100'`  → 100
 *   - `'cn9799'` → 9799
 *   - `'m5'`     → 5
 *   - `'e123'`   → 123
 *   - `'re456'`  → 456
 *   - `'cls7'`   → 7
 *   - `'lx4094'` → 4094
 *   - `'t1'`     → 1
 *   - `'tr99'`   → 99
 *
 * Если суффикс НЕ числовой (например, `'external:fs'`),
 * возвращается `Infinity` — такие элементы уходят в конец
 * при сортировке.
 *
 * Если `id` пустой / undefined — тоже `Infinity`.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ НЕ ПРОСТО `parseInt(id.slice(2), 10)`
 * ════════════════════════════════════════════════════════════
 *
 *   Префиксы разные: `fn`, `cn`, `cls`, `m`, `e`, `re`, `lx`,
 *   `t`, `tr`, `f`, `in`, `ef`, `rx`, `cd`, `ty`, `dt`, `tf`, `vc`.
 *
 *   Длина префикса может быть 1, 2, 3 символа. Поэтому
 *   используется regex `/(\d+)$/` — он ловит **любую**
 *   последовательность цифр в конце строки, независимо от
 *   длины префикса.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   extractNumericId('fn1')     // → 1
 *   extractNumericId('fn42')    // → 42
 *   extractNumericId('cn9799')  // → 9799
 *   extractNumericId('external:fs')  // → Infinity
 *   extractNumericId('unresolved:./foo') // → Infinity
 *   extractNumericId(undefined) // → Infinity
 *   extractNumericId('')        // → Infinity
 *
 * @param id — строковый id (fn1, cn42, ...)
 * @returns числовой суффикс или Infinity
 */
export function extractNumericId(id: string | undefined): number {
  if (!id) return Infinity;
  const match = id.match(/(\d+)$/);
  const suffix = match?.[1];
  return suffix ? parseInt(suffix, 10) : Infinity;
}

// ============================================
// СОРТИРОВКА ПО ЧИСЛОВОМУ ID
// ============================================

/**
 * Сортирует массив по числовому `id`. Не мутирует исходный массив.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Если arr === undefined → возвращаем [].
 *   2. Делаем копию массива (`[...arr]`) — не мутируем вход.
 *   3. Сортируем по числовому id.
 *   4. При равенстве чисел — сортируем лексикографически
 *      по строке id (для детерминизма при коллизиях).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const arr = [
 *     { id: 'fn10', name: 'c' },
 *     { id: 'fn2',  name: 'b' },
 *     { id: 'fn1',  name: 'a' },
 *   ];
 *
 *   sortByIdNumeric(arr);
 *   // → [
 *   //     { id: 'fn1',  name: 'a' },
 *   //     { id: 'fn2',  name: 'b' },
 *   //     { id: 'fn10', name: 'c' },
 *   //   ]
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ НЕ МУТИРУЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   `canonicalizeFullJSON` применяет `sortByIdNumeric` к
 *   каждому массиву FullJSON. Если бы функция мутировала
 *   входной массив, то:
 *     • `canonicalizeFullJSON(payload)` изменял бы `payload`
 *       (тот же объект в памяти).
 *     • `payload === result` — не безопасно, потому что
 *       caller может ожидать, что `payload` не изменится.
 *
 *   Поэтому возвращаем новый массив.
 *
 * @param arr — массив объектов с полем `id`
 * @returns новый отсортированный массив
 */
export function sortByIdNumeric<T extends { id?: string }>(arr: T[] | undefined): T[] {
  if (!arr) return [];
  return [...arr].sort((a, b) => {
    const na = extractNumericId(a.id);
    const nb = extractNumericId(b.id);
    if (na !== nb) return na - nb;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

// ============================================
// КАНОНИЗАЦИЯ FULLJSON
// ============================================

/**
 * Канонизирует `FullJSON`.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   Сортирует по числовому `id` следующие массивы:
 *     • modules
 *     • files
 *     • functions
 *     • classes
 *     • constants
 *     • exports
 *     • imports
 *     • calls
 *     • reExports
 *     • lexicalLinks (если задан)
 *
 * ════════════════════════════════════════════════════════════
 * ЧЕГО НЕ ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   • НЕ трогает `id` внутри элементов.
 *   • НЕ трогает вложенные массивы (`fileIds`, `methods`,
 *     `params`, `calls`, `calledBy`, `specifiers` и т.п.).
 *   • НЕ трогает порядок ключей объектов.
 *   • НЕ трогает `templates`, `lifecycle`, `effects`,
 *     `injections`, `reactivity`, `types`, `typeRefs` —
 *     они уже в детерминированном порядке (собираются
 *     в порядке обхода `sortedFilePaths`).
 *   • НЕ трогает `statistics` и `edges` — они производные.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕНЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   // В compact-reporter.ts::collectFullJSON:
 *   const result: FullJSON = { ... };
 *   return canonicalizeFullJSON(result);
 *
 *   // В codec-encode.ts::encode:
 *   const canonical = canonicalizeFullJSON(payload);
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ ЭТО НУЖНО
 * ════════════════════════════════════════════════════════════
 *
 *   1. **Детерминизм full.json** — порядок массивов не зависит
 *      от порядка обхода `entitiesMap`.
 *   2. **Совпадение порядка с encode(full)** — `encode` внутри
 *      вызывает `canonicalizeFullJSON`, поэтому `encode(full)`
 *      даёт тот же порядок, что и `full` на диске.
 *   3. **Round-trip L0/L3/RE** — сравнение `compact === encode(full)`
 *      требует одинакового порядка `constants[]`, `functions[]` и т.д.
 *   4. **Стабильность diff-ов** — при сравнении двух `full.json`
 *      порядок массивов одинаков, diff-ы не «плавают».
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ НЕ СОРТИРУЕМ `templates`, `lifecycle`, `effects` И Т.П.
 * ════════════════════════════════════════════════════════════
 *
 *   Эти секции собираются в `compact-reporter.ts::collectFullJSON`
 *   в порядке обхода `sortedFilePaths` (лексикографически
 *   отсортированные пути файлов). Такой порядок уже
 *   детерминирован, и сортировка по `id` может его нарушить
 *   (например, `templates` не имеют поля `id`).
 *
 *   В `codec-encode.ts::encode` эти секции кодируются
 *   через `addAny` (по порядку массива) в `values[]`,
 *   поэтому их порядок ВАЖЕН и должен совпадать с
 *   порядком в `compact`.
 *
 * @param payload — FullJSON
 * @returns новый FullJSON с отсортированными массивами
 */
export function canonicalizeFullJSON(payload: FullJSON): FullJSON {
  return {
    ...payload,
    modules: sortByIdNumeric(payload.modules),
    files: sortByIdNumeric(payload.files),
    functions: sortByIdNumeric(payload.functions),
    classes: sortByIdNumeric(payload.classes),
    constants: sortByIdNumeric(payload.constants),
    exports: sortByIdNumeric(payload.exports),
    imports: sortByIdNumeric(payload.imports),
    calls: sortByIdNumeric(payload.calls),
    reExports: sortByIdNumeric(payload.reExports),
    // ✅ v15.2.0 (P1): lexicalLinks
    lexicalLinks: payload.lexicalLinks ? sortByIdNumeric(payload.lexicalLinks) : undefined,
  };
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  extractNumericId,
  sortByIdNumeric,
  canonicalizeFullJSON,
};
