// src/reporters/codec/values-filter.ts
// ============================================
// ФИЛЬТРАЦИЯ values ДЛЯ КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0 (защита от не-JSON-объектов):
//   - ✅ ДОБАВЛЕНО: `isValueKept` теперь возвращает false
//     для Set, Map, RegExp, Date, class instances —
//     потому что они не сериализуются в JSON без потери данных.
//   - ✅ ДОБАВЛЕНО: `classifyValue` теперь возвращает
//     'other' для не-JSON-объектов, чтобы они не попали
//     в values[] (или были удалены filterValues).
//   - ✅ ДОБАВЛЕНО: импорт `isJsonSafe` из './stable-stringify.js'.
//   - ✅ СИНХРОНИЗИРОВАНО с compact-reporter.ts v15.5.5.
//
// ИЗМЕНЕНИЯ v1.1.0 (устранение рассинхрона порогов):
//   - ✅ УДАЛЕНЫ локальные константы:
//       STRING_TEMPLATE_THRESHOLD
//       OBJECT_CONFIG_THRESHOLD
//       ARRAY_FLAG_THRESHOLD
//     Заменены на импорт VALUE_THRESHOLDS из './thresholds.js'.
//   - ✅ ДОБАВЛЕНО: функция `isValueKept(value, mode)` —
//     ЕДИНЫЙ критерий «останется ли значение в relations».
//   - ✅ СИНХРОНИЗИРОВАНО с compact-reporter.ts v15.5.4.
//
// ИЗМЕНЕНИЯ v1.0.2 (устранение дублирования stableStringify):
//   - ✅ УДАЛЕНО: локальная `stableStringifyForClassify` (~50 строк).
//   - ✅ ДОБАВЛЕНО: импорт `stableStringify` из './stable-stringify.js'.
//
// ИЗМЕНЕНИЯ v1.0.1 (детерминизм classifyValue):
//   - ✅ ДОБАВЛЕНО: локальная `stableStringifyForClassify` —
//     рекурсивная сортировка ключей перед сериализацией.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация: filterValues, remapIndex,
//     remapNonEmptyV, classifyValue, RELATION_KEYS.
//
// НАЗНАЧЕНИЕ:
//   Определяет, какие значения из `values[]` нужно сохранять
//   в режиме `relations` (только те, что нужны для графа связей),
//   и переиндексирует ссылки во всём CompactJSON.
//
// ГАРАНТИИ:
//   - В режиме 'full' — no-op (возвращает исходный объект как есть).
//   - В режиме 'relations' — удаляет значения, не относящиеся к связям,
//     и переиндексирует все ссылки на них.
//   - Round-trip сохраняется ПОЛНОСТЬЮ для отфильтрованного full.json.
//   - ✅ v1.0.1: `classifyValue` ДЕТЕРМИНИРОВАНА (stableStringify).
//   - ✅ v1.0.2: `stableStringify` — единый источник истины
//     (импортируется из `./stable-stringify.js`).
//   - ✅ v1.2.0: не-JSON-объекты (Set, Map, RegExp, Date,
//     class instances) не попадают в values[] — это
//     гарантирует, что JSON.stringify не потеряет данные.
//
// АРХИТЕКТУРНОЕ РЕШЕНИЕ:
//   - Массив `values` существует ТОЛЬКО в CompactJSON (не в FullJSON).
//   - В CompactJSON есть ровно ОДНО место, где `values` индексируется
//     напрямую: `cn.nonEmptyV` — массив пар `[constIdx, valueIdx]`.
//   - Значит, фильтрация выполняется в `codec-encode.ts` МЕЖДУ сборкой
//     `dict.valueDict` и финальной сборкой CompactJSON.
//   - Переиндексация касается ТОЛЬКО `cn.nonEmptyV`.
//   - Никакие другие секции (`gr.e`, `gr.i`, `gr.c`, `gr.re`, `fns`, `cls`)
//     НЕ ссылаются на `values` напрямую — они ссылаются на `tokens`/`strs`,
//     которые фильтрации НЕ подлежат.
// ============================================

// ============================================
// ИМПОРТЫ
// ============================================

// ✅ v1.0.2: единый источник истины для stableStringify.
// Устраняет дублирование между values-filter.ts, codec-encode.ts
// и compact-reporter.ts.
import { stableStringify } from './stable-stringify.js';

// ✅ v1.2.0: проверка JSON-безопасности значения.
// Set, Map, RegExp, Date, class instances — НЕ безопасны,
// потому что JSON.stringify превращает их в '{}'.
import { isJsonSafe } from './stable-stringify.js';

// ✅ v1.1.0: единый источник истины для порогов.
// Устраняет рассинхрон между shouldKeepValue (compact-reporter)
// и classifyValue (values-filter).
import { VALUE_THRESHOLDS } from './thresholds.js';

// ============================================
// ТИПЫ
// ============================================

/**
 * Режим сериализации секции `values` в CompactJSON.
 *
 *   - `full`      — все значения сохраняются (обратная совместимость)
 *   - `relations` — только значения, относящиеся к связям между сущностями
 */
export type ValuesMode = 'full' | 'relations';

/**
 * Категория значения в `values`.
 *
 * Используется для принятия решения, оставлять ли значение
 * в режиме `relations`.
 *
 *   - `relation`   — значение нужно для восстановления связей
 *                    (типы, флаги, коды, схемы, ключи)
 *   - `config`     — большой объект конфигурации (CompactReportConfig,
 *                    PRESETS, descriptions и т.п.)
 *   - `template`   — HTML/CSS/JS-шаблон (стили, скрипты, разметка)
 *   - `code`       — сгенерированный код (tsconfig, .gitignore, шаблоны
 *                    фиксов, `declare module`, `@ts-ignore`)
 *   - `flag-array` — длинный массив флагов/чисел, не участвующих в связях
 *   - `other`      — всё остальное (включая не-JSON-объекты)
 */
export type ValueKind = 'relation' | 'config' | 'template' | 'code' | 'flag-array' | 'other';

/**
 * Метаданные для одного значения в `values[]`.
 *
 * Параллельный массив `valuesMeta[]` строится в `codec-encode.ts`
 * одновременно с массивом `values[]` — на каждый `push` в `valueDict`
 * делается соответствующий `push` в `valueMeta`.
 *
 * Поля:
 *   - `key`  — строковый идентификатор значения. Может быть:
 *              • именем константы из `codec-encode.ts` (например,
 *                `'CALL_TYPES'`, `'FLAG_MAP'`);
 *              • составным ключом (например, `'cn_value_<name>'`,
 *                `'func_body_<id>'`, `'template_css_<id>'`).
 *   - `kind` — категория (см. ValueKind).
 */
export interface ValueMeta {
  /** Строковый ключ значения (см. выше) */
  key: string;
  /** Категория значения (см. ValueKind) */
  kind: ValueKind;
}

/**
 * Результат фильтрации `values`.
 *
 *   - `values`   — отфильтрованный массив значений
 *   - `meta`     — параллельный массив метаданных (той же длины)
 *   - `indexMap` — карта `oldIndex → newIndex` для переиндексации
 *                  ссылок в CompactJSON
 */
export interface FilterValuesResult {
  /** Отфильтрованный массив значений */
  values: unknown[];
  /** Параллельный массив метаданных (той же длины, что `values`) */
  meta: ValueMeta[];
  /**
   * Карта переиндексации: `oldIndex → newIndex`.
   *
   * Индексы, отсутствующие в карте, были удалены при фильтрации.
   * Ссылки на них должны быть заменены на `null` или удалены
   * (в зависимости от семантики конкретной секции).
   */
  indexMap: Map<number, number>;
}

// ============================================
// WHITELIST КЛЮЧЕЙ
// ============================================

/**
 * Явный whitelist ключей, которые ВСЕГДА остаются в режиме `relations`.
 *
 * Содержит словари, необходимые для декодирования связей:
 *   - типы связей (`RELATION_TYPES`, `EXPORT_TYPES`, `IMPORT_TYPES`,
 *     `CALL_TYPES`, `RE_EXPORT_TYPES`)
 *   - типы сущностей (`TYPE_KINDS`, `TYPE_USAGE_KINDS`)
 *   - типы Vue-специфичных связей (`LIFECYCLE_TYPES`, `EFFECT_TYPES`,
 *     `INJECTION_TYPES`, `REACTIVITY_TYPES`, `CONDITIONAL_TYPES`,
 *     `HOOK_NAMES`)
 *   - словари флагов (`FLAG_MAP`, `FLAG_CHAR_MAP`, `FLAG_NAMES`)
 *   - схемы колоночных массивов (`SCHEMAS`)
 *
 * Если значение имеет ключ из этого набора — оно сохраняется
 * НЕЗАВИСИМО от категории, вычисленной эвристикой `classifyValue`.
 *
 * Это страховка: если эвристика ошибётся и пометит нужный
 * словарь как `config`/`other`, whitelist его спасёт.
 */
export const RELATION_KEYS: ReadonlySet<string> = new Set<string>([
  // --- Словари типов связей ---
  'RELATION_TYPES',
  'EXPORT_TYPES',
  'IMPORT_TYPES',
  'CALL_TYPES',
  'RE_EXPORT_TYPES',
  'TYPE_KINDS',
  'TYPE_USAGE_KINDS',
  'LIFECYCLE_TYPES',
  'EFFECT_TYPES',
  'INJECTION_TYPES',
  'REACTIVITY_TYPES',
  'CONDITIONAL_TYPES',
  'HOOK_NAMES',
  // --- Словари флагов ---
  'FLAG_MAP',
  'FLAG_CHAR_MAP',
  'FLAG_NAMES',
  'SCHEMAS',
]);

// ============================================
// ✅ v1.2.0: ЕДИНЫЙ КРИТЕРИЙ "ОСТАНЕТСЯ ЛИ ЗНАЧЕНИЕ"
// ============================================

/**
 * Проверяет, останется ли значение в `values[]` в режиме `relations`.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 * Это ЕДИНЫЙ критерий, который должен использоваться:
 *   • в compact-reporter.ts::shouldKeepValue (для фильтрации
 *     cn.value в full.constants[]);
 *   • в values-filter.ts::filterValues (для фильтрации values[]);
 *   • в codec-encode.ts::addValue (для пропуска не-JSON-значений);
 *   • в verify-roundtrip.ts::invariantI14 (для проверки
 *     согласованности).
 *
 * ════════════════════════════════════════════════════════════
 * ЛОГИКА
 * ════════════════════════════════════════════════════════════
 *
 *   mode === 'full'          → всегда true (никакой фильтрации)
 *   value === undefined      → true (undefined не фильтруется)
 *   value === null           → true (null не фильтруется)
 *   !isJsonSafe(value)       → false (Set/Map/RegExp/Date/class)
 *   string                   → length <= STRING_LENGTH
 *   array                    → length <= ARRAY_LENGTH
 *   object                   → stableStringify(value).length <= OBJECT_JSON_LENGTH
 *   прочее                   → true
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ ДОБАВЛЕН isJsonSafe (v1.2.0)
 * ════════════════════════════════════════════════════════════
 *
 * Set, Map, RegExp, Date, class instances при записи в JSON
 * превращаются в '{}'. Если такое значение попадёт в values[]:
 *   • encode(full) положит в valueDict реальный Set;
 *   • JSON.stringify при сохранении на диск превратит его в '{}';
 *   • decode(compact) прочитает '{}', а не Set;
 *   • round-trip потеряет данные → L0/L1/L2/L3/RE — FAIL.
 *
 * Симптом в verify-roundtrip.ts:
 *   $.values.length          a: 703  b: 553
 *   $.constants[1571].value  a: undefined  b: {}
 *
 * Поэтому НЕ-JSON-объекты не должны попадать в values[].
 * Вместо этого они должны быть санитизированы через
 * `sanitizeForJson` (см. stable-stringify.ts v1.0.2).
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ ЭТОТ КРИТЕРИЙ СОГЛАСОВАН С classifyValue
 * ════════════════════════════════════════════════════════════
 *
 *   • если classifyValue вернул 'relation'   → isValueKept === true
 *   • если classifyValue вернул 'template'   → isValueKept === false (для длинных строк)
 *   • если classifyValue вернул 'config'     → isValueKept === false (для длинных объектов)
 *   • если classifyValue вернул 'flag-array' → isValueKept === false (для длинных массивов)
 *   • если classifyValue вернул 'other'      → isValueKept === false (для не-JSON-объектов)
 *
 * Это гарантирует, что значение, прошедшее isValueKept,
 * НЕ будет удалено filterValues, и наоборот.
 *
 * @param value — значение для проверки
 * @param mode  — режим ('full' | 'relations')
 * @returns true, если значение останется в values[]
 */
export function isValueKept(value: unknown, mode: ValuesMode = 'relations'): boolean {
  if (mode === 'full') return true;
  if (value === undefined || value === null) return true;

  // ✅ v1.2.0: не-JSON-объекты не должны попадать в values[]
  // Set, Map, RegExp, Date, class instances — при записи в JSON
  // превратятся в '{}' и потеряют данные.
  if (!isJsonSafe(value)) return false;

  if (typeof value === 'string') {
    return value.length <= VALUE_THRESHOLDS.STRING_LENGTH;
  }

  if (Array.isArray(value)) {
    return value.length <= VALUE_THRESHOLDS.ARRAY_LENGTH;
  }

  if (typeof value === 'object') {
    try {
      const json = stableStringify(value);
      return json.length <= VALUE_THRESHOLDS.OBJECT_JSON_LENGTH;
    } catch {
      return false;
    }
  }

  return true;
}

// ============================================
// КЛАССИФИКАЦИЯ ЗНАЧЕНИЙ
// ============================================

/**
 * Классифицирует значение `values` по его типу и размеру.
 *
 * Это эвристика — она не идеальна, но покрывает ~90% случаев:
 *   - примитивы (числа, boolean, короткие строки) → `relation`
 *   - длинные строки → `template` (HTML/CSS/JS)
 *   - короткие массивы → `relation`
 *   - длинные массивы → `flag-array`
 *   - короткие объекты → `relation`
 *   - длинные объекты → `config`
 *   - не-JSON-объекты → `other` (v1.2.0)
 *
 * Точную категоризацию можно задать через `key` (см. `RELATION_KEYS`).
 *
 * ✅ v1.0.1: использует `stableStringify` вместо нативного
 *   `JSON.stringify` для объектов. Это гарантирует
 *   ДЕТЕРМИНИЗМ: один и тот же объект (независимо от порядка
 *   ключей) всегда даёт один и тот же `kind`.
 *
 * ✅ v1.0.2: `stableStringify` импортируется из `./stable-stringify.js`
 *   — единый источник истины для всех трёх мест (codec-encode,
 *   values-filter, compact-reporter).
 *
 * ✅ v1.2.0: для не-JSON-объектов (Set, Map, RegExp, Date,
 *   class instances) возвращает 'other'. Это гарантирует,
 *   что они не попадут в values[] через filterValues.
 *
 * ⚠️ ВАЖНО: classifyValue СОГЛАСОВАН с isValueKept:
 *   • classifyValue(v) === 'relation'   → isValueKept(v) === true
 *   • classifyValue(v) !== 'relation'   → isValueKept(v) === false
 *     (для string/array/object, прошедших пороги, и для
 *      не-JSON-объектов)
 *
 * @param value — значение из `values[]`
 * @returns категория значения
 */
export function classifyValue(value: unknown): ValueKind {
  // --- null / undefined ---
  if (value === null || value === undefined) {
    return 'other';
  }

  // ✅ v1.2.0: Set, Map, RegExp, Date, class instances → 'other'
  // (проверяем до всех остальных веток, потому что это
  //  самые опасные для round-trip значения)
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (!isJsonSafe(value)) {
      return 'other';
    }
  }

  // --- Строки ---
  if (typeof value === 'string') {
    if (value.length > VALUE_THRESHOLDS.STRING_LENGTH) {
      return 'template';
    }
    return 'relation';
  }

  // --- Числа / boolean / bigint ---
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return 'relation';
  }

  // --- Массивы ---
  if (Array.isArray(value)) {
    // ✅ v1.2.0: массив с не-JSON-элементами → 'other'
    if (!isJsonSafe(value)) {
      return 'other';
    }
    if (value.length > VALUE_THRESHOLDS.ARRAY_LENGTH) {
      return 'flag-array';
    }
    return 'relation';
  }

  // --- Объекты ---
  if (typeof value === 'object') {
    try {
      // ✅ v1.0.2: stableStringify из ./stable-stringify.js.
      // Это делает классификацию порядко-независимой и
      // детерминированной между прогонами.
      const json = stableStringify(value);
      if (json.length > VALUE_THRESHOLDS.OBJECT_JSON_LENGTH) {
        return 'config';
      }
      // Эвристика для HTML/CSS/JS-шаблонов
      if (json.includes('<style') || json.includes('<script') || json.includes('</html>')) {
        return 'template';
      }
      return 'relation';
    } catch {
      // Циклические ссылки / BigInt / иное — считаем конфигом
      return 'config';
    }
  }

  // --- Функции / символы / прочее ---
  return 'other';
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ФИЛЬТРАЦИИ
// ============================================

/**
 * Фильтрует массив `values` + параллельный массив `meta`
 * и возвращает отфильтрованные массивы + карту переиндексации.
 *
 * Логика:
 *   1. Проходим по всем значениям `values[]`.
 *   2. Для каждого значения `i` проверяем:
 *      - `meta[i].kind === 'relation'` — оставляем;
 *      - `RELATION_KEYS.has(meta[i].key)` — оставляем (приоритет
 *        над kind — на случай ошибки эвристики).
 *   3. Оставленные значения пушим в `newValues[]`, их метаданные —
 *      в `newMeta[]`, а соответствие `i → newIdx` — в `indexMap`.
 *   4. Удалённые значения НЕ попадают в `newValues[]` и НЕ имеют
 *      записи в `indexMap`.
 *
 * Возвращаемый `indexMap` используется вызывающим кодом для
 * переиндексации ссылок на `values[]` (в CompactJSON — это
 * `cn.nonEmptyV`).
 *
 * ✅ v1.2.0: дополнительно проверяет `isJsonSafe(value)` —
 * если значение не JSON-safe, оно удаляется даже при
 * `kind === 'relation'`. Это защита от регрессий, когда
 * `classifyValue` по какой-то причине вернул 'relation'
 * для не-JSON-объекта.
 *
 * @param values — исходный массив значений (из `dict.valueDict`)
 * @param meta   — параллельный массив метаданных (из `dict.valueMeta`)
 * @returns отфильтрованные массивы + карта переиндексации
 */
export function filterValues(values: unknown[], meta: ValueMeta[]): FilterValuesResult {
  const indexMap = new Map<number, number>();
  const newValues: unknown[] = [];
  const newMeta: ValueMeta[] = [];

  // Защита от невалидного входа
  if (!Array.isArray(values) || values.length === 0) {
    return { values: newValues, meta: newMeta, indexMap };
  }

  if (!Array.isArray(meta) || meta.length !== values.length) {
    // Если meta отсутствует или не совпадает по длине —
    // не фильтруем вообще (обратная совместимость).
    return {
      values: [...values],
      meta: Array.isArray(meta) ? [...meta] : [],
      indexMap,
    };
  }

  for (let i = 0; i < values.length; i++) {
    const m = meta[i];
    if (!m) {
      // Нет метаданных — не рискуем, оставляем
      indexMap.set(i, newValues.length);
      newValues.push(values[i]);
      newMeta.push({ key: '', kind: 'other' });
      continue;
    }

    // ✅ v1.2.0: дополнительная защита — не-JSON-объекты
    // удаляются, даже если kind === 'relation'.
    if (!isJsonSafe(values[i])) {
      continue;
    }

    // Приоритет: whitelist > kind === 'relation'
    const isRelation = m.kind === 'relation' || RELATION_KEYS.has(m.key);

    if (isRelation) {
      indexMap.set(i, newValues.length);
      newValues.push(values[i]);
      newMeta.push(m);
    }
    // Иначе — значение удаляется (не попадает в newValues и indexMap)
  }

  return { values: newValues, meta: newMeta, indexMap };
}

// ============================================
// ПЕРЕИНДЕКСАЦИЯ ССЫЛОК
// ============================================

/**
 * Переиндексирует одну ссылку на `values[]`.
 *
 * Возвращает:
 *   - новый индекс, если старое значение сохранилось;
 *   - `null`, если старое значение было удалено;
 *   - `oldIdx` как есть, если он невалиден (undefined, -1).
 *
 * Соглашение: ссылки на удалённые значения в CompactJSON
 * заменяются на `null`. Это безопасно для round-trip, потому что
 * `decode` уже умеет обрабатывать `null` как «значения нет».
 *
 * @param oldIdx   — старый индекс (или undefined / -1)
 * @param indexMap — карта переиндексации из `filterValues`
 * @returns новый индекс или null
 */
export function remapIndex(
  oldIdx: number | undefined,
  indexMap: Map<number, number>
): number | null {
  // Невалидный вход — возвращаем как есть
  if (oldIdx === undefined || oldIdx === null) {
    return null;
  }
  if (oldIdx < 0) {
    return oldIdx;
  }

  const newIdx = indexMap.get(oldIdx);
  return newIdx !== undefined ? newIdx : null;
}

/**
 * Переиндексирует массив пар `[constIdx, valueIdx]` (для `cn.nonEmptyV`).
 *
 * Если `valueIdx` ссылается на удалённое значение — пара
 * ИСКЛЮЧАЕТСЯ из результата (значение для этой константы теряется,
 * что эквивалентно `value === undefined`).
 *
 * @param nonEmptyV — исходный массив пар
 * @param indexMap  — карта переиндексации
 * @returns переиндексированный массив пар
 */
export function remapNonEmptyV(
  nonEmptyV: [number, number][],
  indexMap: Map<number, number>
): [number, number][] {
  if (!Array.isArray(nonEmptyV) || nonEmptyV.length === 0) {
    return [];
  }

  const result: [number, number][] = [];

  for (const pair of nonEmptyV) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;

    const [constIdx, oldValueIdx] = pair;
    const newValueIdx = remapIndex(oldValueIdx, indexMap);

    // Значение удалено — пропускаем пару
    if (newValueIdx === null) continue;

    result.push([constIdx, newValueIdx]);
  }

  return result;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Проверяет, является ли строка валидным режимом.
 *
 * Используется в CLI для валидации `--values-mode`.
 *
 * @param mode — строка для проверки
 * @returns true, если mode === 'full' | 'relations'
 */
export function isValidValuesMode(mode: unknown): mode is ValuesMode {
  return mode === 'full' || mode === 'relations';
}

/**
 * Нормализует режим: приводит к валидному значению
 * с fallback на 'relations'.
 *
 * Используется для чтения старого `compact.json` без поля
 * `valuesMode` — такой отчёт читается как 'full' (обратная
 * совместимость), но при отсутствии явного указания
 * по умолчанию ставится 'relations'.
 *
 * @param mode — исходное значение (может быть undefined / мусором)
 * @param fallback — значение по умолчанию
 * @returns нормализованный режим
 */
export function normalizeValuesMode(mode: unknown, fallback: ValuesMode = 'relations'): ValuesMode {
  if (isValidValuesMode(mode)) return mode;
  return fallback;
}

/**
 * Возвращает статистику по фильтрации — для логирования.
 *
 * @param original — исходное количество значений
 * @param filtered — отфильтрованное количество значений
 * @returns объект со статистикой
 */
export function getFilterStats(
  original: number,
  filtered: number
): {
  original: number;
  filtered: number;
  removed: number;
  removedPercent: number;
  savedRatio: number;
} {
  const removed = original - filtered;
  const removedPercent = original > 0 ? (removed / original) * 100 : 0;
  const savedRatio = filtered > 0 ? original / filtered : 1;

  return {
    original,
    filtered,
    removed,
    removedPercent,
    savedRatio,
  };
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  // Типы
  // (экспортируются автоматически через `export type`)

  // Основные функции
  filterValues,
  remapIndex,
  remapNonEmptyV,
  classifyValue,
  isValueKept,

  // Утилиты
  isValidValuesMode,
  normalizeValuesMode,
  getFilterStats,

  // Константы
  RELATION_KEYS,
  VALUE_THRESHOLDS,
};
