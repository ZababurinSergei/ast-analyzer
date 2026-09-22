// src/reporters/codec/codec-encode.ts
// ============================================
// КОДИРОВАНИЕ: FullJSON → CompactJSON
// ============================================
// Версия: 15.4.4
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.4.4 (защита от рассинхрона values[]):
//   - ✅ ДОБАВЛЕНО: `addValue()` теперь проверяет, что значение
//     прошло `isValueKept`. Если значение НЕ проходит фильтр,
//     оно НЕ добавляется в valueDict (возвращается -1).
//
//     Это гарантирует, что values[] не содержит значений,
//     которые будут удалены filterValues — и, следовательно,
//     encode(full) и compact на диске дают одинаковый
//     набор values[].
//
//   - ✅ ДОБАВЛЕНО: `addValue()` принимает параметр `mode: ValuesMode`
//     (по умолчанию 'relations'). Он передаётся в `isValueKept`.
//
//   - ✅ ИЗМЕНЕНО: в основном цикле `encode()` вызов `addValue()`
//     для констант теперь передаёт `valuesMode`.
//
//   - ✅ СИНХРОНИЗИРОВАНО с:
//       • values-filter.ts v1.1.0 (isValueKept, VALUE_THRESHOLDS)
//       • compact-reporter.ts v15.5.4 (isValueKept)
//       • thresholds.ts v1.0.0 (единый источник порогов)
//
// v15.4.3 (устранение дублирования + детерминизм):
//   - ✅ УДАЛЕНЫ локальные функции:
//       • extractNumericId       → ../utils/canonical-utils.js
//       • sortByIdNumeric        → ../utils/canonical-utils.js
//       • canonicalizeFullJSON   → ../utils/canonical-utils.js
//       • stableStringify        → ./stable-stringify.js
//       • classifyValue          → ./values-filter.js
//   - ✅ ДОБАВЛЕНЫ импорты из новых модулей:
//       • stableStringify        из './stable-stringify.js'
//       • canonicalizeFullJSON   из '../utils/canonical-utils.js'
//       • classifyValue          из './values-filter.js'
//   - ✅ УБРАН classifyValue из default-экспорта (теперь из
//     values-filter.js — единый источник истины).
//   - ✅ СИНХРОНИЗИРОВАНО: CODEC_VERSION = '15.4.3'.
//
// v15.4.2 (fix: типобезопасный ключ дедупликации в addValue):
//   - ✅ ИСПРАВЛЕНО: `addValue()` теперь использует
//     типобезопасный ключ дедупликации вместо `String(value)`.
//
//     ПРОБЛЕМА, КОТОРУЮ ЭТО РЕШАЕТ:
//     `String(value)` давал коллизии между значениями разных типов:
//       String(null)      === 'null'      === String('null')      // ← коллизия!
//       String(123)       === '123'       === String('123')       // ← коллизия!
//       String(true)      === 'true'      === String('true')      // ← коллизия!
//       String(0)         === '0'         === String('0')         // ← коллизия!
//
//     Если в проекте есть и `const a = null`, и `const b = \"null\"`,
//     они схлопывались в одну запись valueDict. Это ломало
//     детерминизм: values.length зависел от порядка обхода констант.
//
//     СИМПТОМ в check:roundtrip / check:consistency:
//       • values.length: 557 → 558
//       • cn.nonEmptyV[1111][1]: 34 → 279
//       • cn.nonEmptyV[1112][1]: 279 → 280
//       • ... все последующие индексы +1
//
//     РЕШЕНИЕ:
//     Префикс типа в ключе дедупликации:
//       null      → 'N'
//       string    → 'S:' + value
//       number    → 'D:' + value
//       boolean   → 'B:' + value
//       bigint    → 'I:' + value.toString()
//       object    → 'O:' + stableStringify(value)
//       function  → 'X:' + String(value)  (редко)
//       symbol    → 'X:' + String(value)  (редко)
//
//     Это гарантирует, что значения разных типов НИКОГДА
//     не дадут один и тот же ключ дедупликации.
//
// v15.4.1 (fix: стабильная дедупликация в addValue):
//   - ✅ ДОБАВЛЕНО: функция `stableStringify()` — рекурсивная
//     сортировка ключей перед JSON.stringify.
//   - ✅ ИСПРАВЛЕНО: `addValue()` теперь использует
//     `stableStringify(value)` вместо `JSON.stringify(value)`
//     для ключа дедупликации в `dict.valueMap`.
//
// v15.4.0 (P3 — cross-file resolution):
//   - ✅ CODEC_VERSION = '15.4.0'
//   - ✅ Поддержка CrossFileCall через обогащение calls
//
// v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: CALL_KIND_CODES
//   - ✅ ДОБАВЛЕНО: gcCol/gcCk/gcCn/gcAi в gr.c
//
// v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: LEXICAL_RELATION_CODES
//   - ✅ ДОБАВЛЕНО: columnar-секция lx
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: fnsParent[], rle(fnsParent)
//
// v15.0.6 (gr.i.tf — индекс в fl.p):
//   - ✅ ИЗМЕНЕНО: tf — индекс в fl.p
//
// v15.0.5 (проброс isReExport/isStarReExport):
//   - ✅ ДОБАВЛЕНО: биты 4, 5 в combinedTy для gr.i
//
// v15.0.3 (fix round-trip Vue conditionals):
//   - ✅ ИСПРАВЛЕНО: addAny делает structuredClone
//
// v15.0.2 (устранение дублирования conditionals):
//   - ✅ УБРАН fallback на canonical.conditionals
//
// v15.0.1 (fix дедупликации extended-секций):
//   - ✅ ИСПРАВЛЕНО: addAny не дедуплицирует объекты
//
// v15.0.0 (полный round-trip расширенных секций):
//   - ✅ ДОБАВЛЕНО: кодирование vt/lc/ef/inj/rx/cd/ty/tr
//
// v14.0.0 (байтовое равенство):
//   - ✅ ДОБАВЛЕНО: canonicalizeFullJSON в начале encode
// ============================================

import type {
  FullJSON,
  CompactJSON,
  CodecLegend,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  ModuleData,
  FileData,
  TemplateData,
  TemplateConditional,
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TypeNodeData,
  TypeRefData,
  // ✅ v15.2.0 (P1)
  LexicalLink,
  LexicalRelation,
} from './codec-types.js';

import { buildLegend } from './codec-legend.js';

// ✅ v15.4.3: единая версия
import { CODEC_VERSION } from './codec-types.js';

// ✅ v13.0.0: фильтрация values
// ✅ v15.4.4: добавлен импорт isValueKept
// ✅ v15.4.3: classifyValue — из values-filter.js
import {
  filterValues,
  remapIndex,
  classifyValue,       // ✅ v15.4.3: единый источник истины
  isValueKept,         // ✅ v15.4.4: единый критерий фильтрации
  type ValuesMode,
  type ValueMeta,
} from './values-filter.js';

// ✅ v15.4.3: устранение дублирования
import { stableStringify } from './stable-stringify.js';
import { canonicalizeFullJSON } from '../utils/canonical-utils.js';

// ============================================
// ✅ v15.2.0 (P1): LEXICAL RELATION CODES
// ============================================
//
// Числовые коды для relation в LexicalLink.
// Используются в columnar-секции lx (поле r).
//
// ⚠️ Синхронизировано с LEXICAL_RELATION_BY_CODE в codec-decode.ts.
// ⚠️ Синхронизировано с legend.codes.lexicalRelation.
// ============================================

export const LEXICAL_RELATION_CODES: Record<LexicalRelation, number> = {
  nested: 0,
  'arrow-var': 1,
  callback: 2,
  iife: 3,
  'class-method': 4,
  'object-prop': 5,
  return: 6,
  'default-export': 7,
};

// ============================================
// ✅ v15.3.0 (P2): CALL KIND CODES
// ============================================
//
// Числовые коды для callKind в CallData.
// Используются в columnar-секции gr.c (поле ck).
// ============================================

export const CALL_KIND_CODES: Record<string, number> = {
  direct: 0,
  method: 1,
  callback: 2,
  constructor: 3,
  'tagged-template': 4,
  'optional-chain': 5,
  spread: 6,
  new: 7,
};

// ============================================
// СЛОВАРИ ФЛАГОВ
// ============================================

/**
 * Карта флагов: бит → имя.
 *
 * Биты:
 *   1      = async
 *   2      = exported
 *   4      = method
 *   8      = arrow
 *   16     = event handler
 *   32     = nested
 *   64     = self
 *   128    = dynamic
 *   256    = config
 *   512    = external
 *   1024   = vue template
 *   2048   = async chain
 *   4096   = closure
 *   8192   = type dep
 *   16384  = generator
 *   32768  = private
 *   65536  = protected
 *   131072 = static
 */
export const FLAG_MAP: Record<number, string> = {
  1: 'isAsync',
  2: 'isExported',
  4: 'isMethod',
  8: 'isArrow',
  16: 'isEventHandler',
  32: 'isNested',
  64: 'isSelf',
  128: 'isDynamic',
  256: 'isConfig',
  512: 'isExternal',
  1024: 'isVueTemplate',
  2048: 'isAsyncChain',
  4096: 'isClosure',
  8192: 'isTypeDep',
  16384: 'isGenerator',
  32768: 'isPrivate',
  65536: 'isProtected',
  131072: 'isStatic',
};

/**
 * Обратная карта: имя → бит.
 */
export const FLAG_CHAR_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([bit, name]) => [name, parseInt(bit, 10)])
);

/**
 * Имена флагов: бит → имя.
 */
export const FLAG_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([bit, name]) => [parseInt(bit, 10), name])
);

/**
 * Типы связей.
 */
export const RELATION_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
  e: 'external',
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type-only',
  ne: 'named-export',
  de: 'default-export',
  te: 'type-export',
  re: 're-export',
  all: 'all',
};

/**
 * Типы экспортов.
 */
export const EXPORT_TYPES: Record<string, string> = {
  ne: 'named',
  de: 'default',
  te: 'type',
  re: 're-export',
};

/**
 * Типы импортов.
 */
export const IMPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type',
};

/**
 * Типы вызовов.
 */
export const CALL_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
};

/**
 * Типы реэкспортов.
 */
export const RE_EXPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  all: 'all',
};

/**
 * Хуки жизненного цикла Vue.
 */
export const LIFECYCLE_TYPES: Record<string, string> = {
  m: 'onMounted',
  u: 'onUnmounted',
  s: 'onScopeDispose',
  a: 'onActivated',
  d: 'onDeactivated',
  w: 'watch',
  W: 'watchEffect',
  e: 'onErrorCaptured',
};

/**
 * Типы side-эффектов.
 */
export const EFFECT_TYPES: Record<string, string> = {
  t: 'timer',
  c: 'cleanup',
  p: 'promise',
  e: 'event',
  s: 'subscription',
};

/**
 * Типы provide/inject.
 */
export const INJECTION_TYPES: Record<string, string> = {
  p: 'provide',
  i: 'inject',
};

/**
 * Типы реактивности Vue.
 */
export const REACTIVITY_TYPES: Record<string, string> = {
  c: 'computed',
  w: 'watch',
  W: 'watchEffect',
  r: 'ref',
  R: 'reactive',
  S: 'shallowRef',
  o: 'readonly',
};

/**
 * Типы условных директив.
 */
export const CONDITIONAL_TYPES: Record<string, string> = {
  i: 'v-if',
  e: 'v-else-if',
  E: 'v-else',
};

/**
 * Виды type-узлов.
 */
export const TYPE_KINDS: Record<string, string> = {
  i: 'interface',
  t: 'type-alias',
  e: 'enum',
  c: 'class',
};

/**
 * Виды использования типов.
 */
export const TYPE_USAGE_KINDS: Record<string, string> = {
  p: 'param',
  r: 'return',
  f: 'field',
  g: 'generic',
  u: 'union',
  x: 'extends',
};

// ============================================
// КОДИРОВАНИЕ ФЛАГОВ
// ============================================

/**
 * Кодирует булевы флаги функции в число.
 */
export function encodeFlags(obj: Partial<FunctionData & ClassData & ConstantData>): number {
  let flags = 0;
  for (const [bitStr, name] of Object.entries(FLAG_MAP)) {
    if ((obj as any)[name]) {
      flags |= parseInt(bitStr, 10);
    }
  }
  return flags;
}

/**
 * Кодирует число флагов в строку символов.
 *
 * ⚠️ Не используется в `encode()` для fns/cls/cn (там пишется число).
 * Оставлено для отладки и обратной совместимости публичного API.
 */
export function flagsToString(flags: number): string {
  if (flags === 0) return '0';
  let result = '';
  for (const [bitStr, char] of Object.entries(FLAG_MAP)) {
    if (flags & parseInt(bitStr, 10)) {
      result += char;
    }
  }
  return result || '0';
}

// ============================================
// ХЕЛПЕРЫ СЛОВАРЕЙ
// ============================================

interface DictBuilder {
  stringDict: string[];
  stringMap: Map<string, number>;
  paramDict: string[];
  paramMap: Map<string, number>;
  methodDict: string[];
  methodMap: Map<string, number>;
  valueDict: unknown[];
  valueMap: Map<string, number>;
  valueMeta: ValueMeta[];
}

export function createDictBuilder(): DictBuilder {
  return {
    stringDict: [],
    stringMap: new Map(),
    paramDict: [],
    paramMap: new Map(),
    methodDict: [],
    methodMap: new Map(),
    valueDict: [],
    valueMap: new Map(),
    valueMeta: [],
  };
}

/**
 * Добавить строку в stringDict, вернуть индекс.
 * Пустая строка, undefined или null → -1.
 */
export function addString(dict: DictBuilder, str: string | undefined | null): number {
  if (str === undefined || str === null || str === '') return -1;
  const existing = dict.stringMap.get(str);
  if (existing !== undefined) return existing;
  const idx = dict.stringDict.length;
  dict.stringDict.push(str);
  dict.stringMap.set(str, idx);
  return idx;
}

/**
 * Добавить параметр в paramDict, вернуть индекс.
 */
export function addParam(dict: DictBuilder, param: string): number {
  if (!param) return -1;
  const existing = dict.paramMap.get(param);
  if (existing !== undefined) return existing;
  const idx = dict.paramDict.length;
  dict.paramDict.push(param);
  dict.paramMap.set(param, idx);
  return idx;
}

/**
 * Добавить метод в methodDict, вернуть индекс.
 */
export function addMethod(dict: DictBuilder, method: string): number {
  if (!method) return -1;
  const existing = dict.methodMap.get(method);
  if (existing !== undefined) return existing;
  const idx = dict.methodDict.length;
  dict.methodDict.push(method);
  dict.methodMap.set(method, idx);
  return idx;
}

// ============================================
// ADD VALUE — ТИПОБЕЗОПАСНЫЙ КЛЮЧ (v15.4.2)
// + ЗАЩИТА ОТ РАССИНХРОНА (v15.4.4)
// ============================================
//
// Проблема (v15.4.2):
//   String(value) даёт коллизии между разными типами:
//     String(null)      === 'null'      === String('null')       // ← коллизия!
//     String(123)       === '123'       === String('123')        // ← коллизия!
//     String(true)      === 'true'      === String('true')       // ← коллизия!
//     String(0)         === '0'         === String('0')          // ← коллизия!
//
//   Если в проекте есть и `const a = null`, и `const b = \"null\"`,
//   они схлопываются в одну запись valueDict. Это ломает
//   детерминизм: values.length зависел от порядка обхода констант.
//
// Решение (v15.4.2):
//   Префикс типа в ключе дедупликации:
//     null      → 'N'                   (сам null, без значения)
//     string    → 'S:' + value
//     number    → 'D:' + value
//     boolean   → 'B:' + value
//     bigint    → 'I:' + value.toString()
//     object    → 'O:' + stableStringify(value)
//     function  → 'X:' + String(value)  (редко, но на всякий случай)
//     symbol    → 'X:' + String(value)  (редко)
//
// Проблема (v15.4.4):
//   `shouldKeepValue` в compact-reporter.ts и `classifyValue` в
//   values-filter.ts использовали РАЗНЫЕ пороги. Значение могло
//   пройти shouldKeepValue (попасть в full.constants[].value),
//   но НЕ пройти classifyValue (не попасть в valueDict).
//
//   Это давало рассинхрон values[]:
//     $.values.length          a: 206  b: 208
//     $.cn.nonEmptyV[180][1]   a: 3    b: 54
//
// Решение (v15.4.4):
//   `addValue()` теперь проверяет `isValueKept(value, mode)`.
//   Если значение НЕ проходит фильтр — возвращается -1.
//   Это гарантирует, что values[] не содержит значений,
//   которые будут удалены filterValues.
// ============================================

/**
 * Добавить значение в valueDict, вернуть индекс.
 *
 * ✅ v15.4.4-fix: если значение НЕ проходит фильтр isValueKept —
 * возвращается -1 (значение НЕ добавляется).
 *
 * ✅ v15.4.2-fix: типобезопасный ключ дедупликации.
 * ✅ v15.4.1-fix: stableStringify для объектов (порядко-независимость).
 *
 * @param dict  — словарь
 * @param value — значение
 * @param key   — строковый ключ для отладки
 * @param kind  — категория (если не задана, вычисляется через classifyValue)
 * @param mode  — режим values (по умолчанию 'relations'). Влияет на isValueKept.
 * @returns индекс в valueDict или -1
 *
 * @see addAny() — для extended-секций, где дедупликация ЗАПРЕЩЕНА.
 */
export function addValue(
  dict: DictBuilder,
  value: unknown,
  key: string = '',
  kind?: ValueMeta['kind'],
  mode: ValuesMode = 'relations'
): number {
  if (value === undefined) return -1;

  // ✅ v15.4.4-fix: пропускаем значения, которые не пройдут фильтр
  // (isValueKept синхронизирован с classifyValue через VALUE_THRESHOLDS)
  if (!isValueKept(value, mode)) return -1;

  // ✅ v15.4.2-fix: типобезопасный ключ дедупликации
  let dedupKey: string;

  if (value === null) {
    // null — единственный ключ без ':'
    dedupKey = 'N';
  } else if (typeof value === 'string') {
    // Строка: префикс 'S:'
    dedupKey = 'S:' + value;
  } else if (typeof value === 'number') {
    // Число: префикс 'D:' (D = Digit)
    dedupKey = 'D:' + value;
  } else if (typeof value === 'boolean') {
    // Boolean: префикс 'B:'
    dedupKey = 'B:' + value;
  } else if (typeof value === 'bigint') {
    // BigInt: префикс 'I:' (I = Integer big)
    dedupKey = 'I:' + value.toString();
  } else if (typeof value === 'object') {
    // Объект/массив: префикс 'O:' + stableStringify
    dedupKey = 'O:' + stableStringify(value);
  } else if (typeof value === 'function') {
    dedupKey = 'X:' + String(value);
  } else if (typeof value === 'symbol') {
    dedupKey = 'X:' + String(value);
  } else {
    // Fallback (не должно происходить, но для type-safety)
    dedupKey = 'X:' + String(value);
  }

  const existing = dict.valueMap.get(dedupKey);
  if (existing !== undefined) return existing;

  const idx = dict.valueDict.length;
  dict.valueDict.push(value);
  dict.valueMap.set(dedupKey, idx);

  dict.valueMeta.push({
    key: key || `value_${idx}`,
    kind: kind ?? classifyValue(value),
  });

  return idx;
}

// ============================================
// addAny — БЕЗ ДЕДУПЛИКАЦИИ + structuredClone (v15.0.3)
// ============================================
//
// Extended-секции (vt/lc/ef/inj/rx/cd/ty/tr) — это СТРУКТУРНЫЕ
// СУЩНОСТИ. Каждая запись — отдельная сущность. Их НЕЛЬЗЯ
// дедуплицировать, даже если они структурно совпадают.
//
// ✅ v15.0.3: `addAny` делает `structuredClone(value)`.
// Это разрывает общую ссылку между `templates[].conditionals`
// и `values[]`, из-за которой `safeJsonStringify` заменял второй
// экземпляр на \"[Circular]\".
// ============================================

/**
 * Добавить произвольный объект/массив/примитив в valueDict.
 *
 * Отличия от addValue():
 *   - НЕ дедуплицирует. Каждый вызов = новый value с новым индексом.
 *   - НЕ применяет фильтрацию values (kind = 'relation').
 *   - ✅ v15.0.3: делает `structuredClone(value)` перед push.
 *   - Используется ТОЛЬКО для extended-секций (vt/lc/ef/inj/rx/cd/ty/tr).
 *
 * @param dict  — словарь
 * @param value — произвольное значение
 * @param key   — строковый ключ для отладки
 * @returns индекс в valueDict
 */
function addAny(dict: DictBuilder, value: unknown, key: string): number {
  if (value === undefined) return -1;

  const idx = dict.valueDict.length;

  // ✅ v15.0.3 (fix round-trip Vue conditionals):
  // structuredClone разрывает общую ссылку, сохраняя все данные,
  // включая undefined-поля (важно для v-else).
  const stored: unknown =
    value !== null && typeof value === 'object' ? structuredClone(value) : value;

  dict.valueDict.push(stored);

  dict.valueMeta.push({
    key: key || `value_${idx}`,
    kind: 'relation',
  });

  return idx;
}

/**
 * Типобезопасный reverse lookup.
 */
export function reverseLookup(dict: Record<string, string>, name: string | undefined): string {
  if (!name) return Object.keys(dict)[0] ?? '?';
  const reverse = Object.fromEntries(Object.entries(dict).map(([c, n]) => [n, c]));
  return reverse[name] ?? Object.keys(dict)[0] ?? '?';
}

/**
 * Проверяет, является ли значение массивом, и возвращает его.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ============================================
// RLE ХЕЛПЕРЫ
// ============================================

/**
 * Сжимает массив чисел в RLE: [[value, count], ...]
 */
function rle(arr: number[]): [number, number][] {
  if (arr.length === 0) return [];
  const result: [number, number][] = [];
  let current = arr[0]!;
  let count = 1;

  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]!;
    if (v === current) {
      count++;
    } else {
      result.push([current, count]);
      current = v;
      count = 1;
    }
  }
  result.push([current, count]);
  return result;
}

// ============================================
// ТОКЕНИЗАЦИЯ СТРОК
// ============================================

/**
 * Разбивает строку на camelCase/PascalCase токены.
 */
function tokenizeStr(str: string): string[] {
  if (!str) return [];
  const tokens = str.split(/(?=[A-Z])|[_\-/.0-9]+/).filter(Boolean);
  return tokens;
}

/**
 * Строит словарь токенов из массива строк.
 */
function buildTokenDict(strings: string[]): string[] {
  const freq = new Map<string, number>();
  for (const str of strings) {
    for (const token of tokenizeStr(str)) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .filter(([, count]) => count > 1)
    .map(([token]) => token);
}

/**
 * Кодирует строку через токены.
 */
function encodeStr(str: string, tokenIndex: Map<string, number>): string | number[] {
  if (!str) return str;

  // ✅ v13.0.0-fix: не токенизируем короткие строки
  if (str.length < 8) return str;

  // ✅ v13.0.2-fix: не токенизируем строки с разделителями и цифрами
  if (/[_\-/.:0-9]/.test(str)) return str;

  const tokens = tokenizeStr(str);
  if (tokens.length === 0) return str;

  const indices: number[] = [];
  for (const token of tokens) {
    const idx = tokenIndex.get(token);
    if (idx === undefined) return str;
    indices.push(idx);
  }

  if (tokens.length * 2 >= str.length) return str;

  return indices;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ENCODE
// ============================================

/**
 * Кодирует полный JSON в сжатый (v15.4.4).
 *
 * @param payload    — Полный JSON
 * @param valuesMode — Режим сериализации values ('full' | 'relations')
 * @returns Сжатый JSON с легендой
 */
export function encode(payload: FullJSON, valuesMode: ValuesMode = 'relations'): CompactJSON {
  const dict = createDictBuilder();

  // ============================================
  // v14.0.0: КАНОНИЗАЦИЯ ВХОДА
  // ============================================
  const canonical = canonicalizeFullJSON(payload);

  // ============================================
  // 1. Индексы модулей
  // ============================================
  const modules = asArray<ModuleData>(canonical.modules);
  const moduleReverse = new Map<string, number>();
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    if (mod && mod.id) {
      moduleReverse.set(mod.id, i);
    }
  }

  // ============================================
  // 2. Индексы файлов
  // ============================================
  const files = asArray<FileData>(canonical.files);
  const fileReverse = new Map<string, number>();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file && file.id) {
      fileReverse.set(file.id, i);
    }
  }

  // ============================================
  // 3. Индексы функций
  // ============================================
  const functions = asArray<FunctionData>(canonical.functions);
  const functionReverse = new Map<string, number>();
  for (let i = 0; i < functions.length; i++) {
    const func = functions[i];
    if (func && func.id) {
      functionReverse.set(func.id, i);
    }
  }

  // ============================================
  // 4. mi — columnar
  // ============================================
  const miN: string[] = [];
  const miF: [number, number][] = [];

  const filesByModuleIdx = new Map<number, number[]>();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const modIdx = moduleReverse.get(file.moduleId) ?? 0;
    if (!filesByModuleIdx.has(modIdx)) {
      filesByModuleIdx.set(modIdx, []);
    }
    filesByModuleIdx.get(modIdx)!.push(i);
  }

  for (const mod of modules) {
    if (!mod) continue;
    const modIdx = moduleReverse.get(mod.id) ?? 0;
    const fileIdxs = filesByModuleIdx.get(modIdx) ?? [];
    miN.push(mod.name);
    miF.push([fileIdxs[0] ?? 0, fileIdxs.length]);
  }

  // ============================================
  // 5. fl — columnar
  // ============================================
  const flP: string[] = [];
  const flM: number[] = [];
  for (const file of files) {
    if (!file) continue;
    flP.push(file.path);
    flM.push(moduleReverse.get(file.moduleId) ?? 0);
  }
  const flMRle = rle(flM);

  // ============================================
  // 6. fns — columnar
  // ============================================
  // ✅ v15.1.0 (P0): добавлено поле parent
  // ============================================
  const fnsN: number[] = [];
  const fnsM: number[] = [];
  const fnsF: number[] = [];
  const fnsL: number[] = [];
  const fnsFl: number[] = [];
  const fnsP: number[][] = [];
  const fnsRt: number[] = [];
  const fnsParent: number[] = []; // ✅ v15.1.0 (P0)

  for (const func of functions) {
    if (!func) continue;

    const nameIdx = addString(dict, func.name);
    const flags = encodeFlags(func);
    const paramsIdx = asArray<string>(func.params).map(p => addParam(dict, p));
    const returnTypeIdx = addString(dict, func.returnType);

    fnsN.push(nameIdx);
    fnsM.push(moduleReverse.get(func.moduleId) ?? 0);
    fnsF.push(fileReverse.get(func.fileId) ?? 0);
    fnsL.push(func.line);
    fnsFl.push(flags);
    fnsP.push(paramsIdx);
    fnsRt.push(returnTypeIdx);

    // ✅ v15.1.0 (P0): parentFunctionId → индекс в fns, -1 = null
    const parentId = func.parentFunctionId;
    const parentIdx = parentId ? (functionReverse.get(parentId) ?? -1) : -1;
    fnsParent.push(parentIdx);
  }

  const fnsMRle = rle(fnsM);
  const fnsFRle = rle(fnsF);
  const fnsParentRle = rle(fnsParent); // ✅ v15.1.0 (P0)

  // ============================================
  // 7. cls — columnar
  // ============================================
  const classes = asArray<ClassData>(canonical.classes);
  const clsN: number[] = [];
  const clsM: number[] = [];
  const clsF: number[] = [];
  const clsL: number[] = [];
  const clsFl: number[] = [];
  const clsMethods: number[][] = [];

  for (const cls of classes) {
    if (!cls) continue;

    const nameIdx = addString(dict, cls.name);
    const flags = encodeFlags(cls);
    const methodsIdx = asArray<string>(cls.methods).map(m => addMethod(dict, m));

    clsN.push(nameIdx);
    clsM.push(moduleReverse.get(cls.moduleId) ?? 0);
    clsF.push(fileReverse.get(cls.fileId) ?? 0);
    clsL.push(cls.line);
    clsFl.push(flags);
    clsMethods.push(methodsIdx);
  }

  const clsMRle = rle(clsM);
  const clsFRle = rle(clsF);

  // ============================================
  // 8. cn — columnar
  // ============================================
  const constants = asArray<ConstantData>(canonical.constants);
  const cnN: number[] = [];
  const cnM: number[] = [];
  const cnF: number[] = [];
  const cnL: number[] = [];
  const cnFl: number[] = [];
  const cnNonEmptyV: [number, number][] = [];

  for (let i = 0; i < constants.length; i++) {
    const cn = constants[i];
    if (!cn) continue;

    const nameIdx = addString(dict, cn.name);
    const flags = encodeFlags(cn);

    // ✅ v15.4.1-fix: stableStringify для объектов
    // ✅ v15.4.2-fix: типобезопасный ключ для примитивов
    // ✅ v15.4.4-fix: передаём valuesMode в addValue (защита от рассинхрона)
    const valueIdx = addValue(
      dict,
      cn.value,
      `cn_value_${cn.name}`,
      classifyValue(cn.value),
      valuesMode
    );

    cnN.push(nameIdx);
    cnM.push(moduleReverse.get(cn.moduleId) ?? 0);
    cnF.push(fileReverse.get(cn.fileId) ?? 0);
    cnL.push(cn.line);
    cnFl.push(flags);

    if (valueIdx >= 0) {
      cnNonEmptyV.push([i, valueIdx]);
    }
  }

  const cnMRle = rle(cnM);
  const cnFRle = rle(cnF);

  // ============================================
  // 9. gr.e — columnar
  // ============================================
  const exports = asArray<ExportData>(canonical.exports);
  const geM: number[] = [];
  const geF: number[] = [];
  const geFn: number[] = [];
  const geL: number[] = [];
  const geTy: number[] = [];
  const geEn: number[] = [];
  const geLn: number[] = [];
  const geS: number[] = [];
  const geFlags: number[] = [];

  for (const exp of exports) {
    if (!exp) continue;

    const typeCode = exp.isDefault ? 1 : exp.isTypeOnly || exp.type === 'type' ? 2 : 0;
    let flags = 0;
    if (exp.isTypeOnly) flags |= 1;
    if (exp.isReExport) flags |= 2;
    if (exp.isStarReExport) flags |= 4;
    if (exp.isDefaultReExport) flags |= 8;

    geM.push(moduleReverse.get(exp.moduleId) ?? 0);
    geF.push(fileReverse.get(exp.fileId) ?? 0);
    geFn.push(functionReverse.get(exp.functionId) ?? 0);
    geL.push(exp.line);
    geTy.push(typeCode);
    geEn.push(addString(dict, exp.exportName));
    geLn.push(addString(dict, exp.localName));
    geS.push(addString(dict, exp.source));
    geFlags.push(flags);
  }

  // ============================================
  // 10. gr.i — columnar
  // ============================================
  const imports = asArray<ImportData>(canonical.imports);
  const giFf: number[] = [];
  const giTf: number[] = [];
  const giS: number[] = [];
  const giIm: number[] = [];
  const giLn: number[] = [];
  const giL: number[] = [];
  const giTy: number[] = [];

  for (const imp of imports) {
    if (!imp) continue;

    const typeCode = imp.isDefault ? 1 : imp.isNamespace ? 2 : 0;

    // ✅ v15.0.5: собираем combinedTy со всеми битами
    const combinedTy =
      typeCode |
      (imp.isExternal ? 4 : 0) |
      (imp.isTypeOnly ? 8 : 0) |
      (imp.isReExport ? 16 : 0) |
      (imp.isStarReExport ? 32 : 0);

    // ✅ v15.0.6: tf — индекс в fl.p (файлы), -1 = внешний/неразрешённый
    const toFileIdx = imp.toFileId ? (fileReverse.get(imp.toFileId) ?? -1) : -1;

    giFf.push(fileReverse.get(imp.fromFileId) ?? 0);
    giTf.push(toFileIdx);
    giS.push(addString(dict, imp.source));
    giIm.push(addString(dict, imp.importedName));
    giLn.push(addString(dict, imp.localName));
    giL.push(imp.line);
    giTy.push(combinedTy);
  }

  // ✅ v15.0.6: диагностика согласованности ff/tf в debug-режиме
  if (process.env.AST_DEBUG_CODEC === 'true') {
    for (let i = 0; i < giFf.length; i++) {
      const ff = giFf[i]!;
      const tf = giTf[i]!;
      if (tf !== -1 && ff === tf) {
        console.warn(`⚠️ gr.i[${i}]: ff === tf (${ff}) — файл импортирует сам себя`);
      }
    }
  }

  // ============================================
  // 11. gr.c — columnar
  // ============================================
  // ✅ v15.3.0 (P2): добавлены col/ck/cn/ai
  // ============================================
  const calls = asArray<CallData>(canonical.calls);
  const gcF: number[] = [];
  const gcT: number[] = [];
  const gcL: number[] = [];
  const gcTy: number[] = [];
  const gcCol: number[] = []; // ✅ v15.3.0 (P2)
  const gcCk: number[] = []; // ✅ v15.3.0 (P2)
  const gcCn: number[] = []; // ✅ v15.3.0 (P2)
  const gcAi: number[] = []; // ✅ v15.3.0 (P2)

  for (const call of calls) {
    if (!call) continue;

    const isExternal = call.toFunctionId.startsWith('external:');
    const typeCode =
      call.type === 'direct' ? 0 : call.type === 'async' ? 1 : call.type === 'method' ? 2 : 3;
    const combinedTy = typeCode | (isExternal ? 4 : 0);

    gcF.push(functionReverse.get(call.fromFunctionId) ?? 0);
    gcT.push(
      isExternal
        ? addString(dict, call.toFunctionId)
        : (functionReverse.get(call.toFunctionId) ?? 0)
    );
    gcL.push(call.line);
    gcTy.push(combinedTy);

    // ✅ v15.3.0 (P2): column / callKind / calleeName / argumentIndex
    gcCol.push(call.column ?? -1);
    gcCk.push(call.callKind ? (CALL_KIND_CODES[call.callKind] ?? -1) : -1);
    gcCn.push(call.calleeName ? addString(dict, call.calleeName) : -1);
    gcAi.push(call.argumentIndex ?? -1);
  }

  // ============================================
  // 12. gr.re — columnar
  // ============================================
  const reExports = asArray<ReExportData>(canonical.reExports);
  const greM: number[] = [];
  const greFn: number[] = [];
  const greS: number[] = [];
  const greEn: number[] = [];
  const greL: number[] = [];
  const greTy: number[] = [];

  for (const re of reExports) {
    if (!re) continue;

    const typeCode = re.isStarReExport ? 2 : re.isDefault ? 1 : 0;
    const combinedTy = typeCode | (re.isTypeOnly ? 4 : 0);

    greM.push(moduleReverse.get(re.moduleId) ?? 0);
    greFn.push(functionReverse.get(re.functionId) ?? 0);
    greS.push(addString(dict, re.source));
    greEn.push(addString(dict, re.exportName));
    greL.push(re.line);
    greTy.push(combinedTy);
  }

  // ============================================
  // 12.5. Кодирование расширенных секций
  //       vt/lc/ef/inj/rx/cd/ty/tr
  // ============================================
  function encodeExtendedSection<T>(items: T[] | undefined, prefix: string): number[] {
    if (!items || items.length === 0) return [];
    const result: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === undefined || item === null) continue;
      const idx = addAny(dict, item, `${prefix}[${i}]`);
      if (idx >= 0) result.push(idx);
    }
    return result;
  }

  const vt = encodeExtendedSection<TemplateData>(canonical.templates, 'vt');
  const lc = encodeExtendedSection<LifecycleHook>(canonical.lifecycle, 'lc');
  const ef = encodeExtendedSection<EffectEdge>(canonical.effects, 'ef');
  const inj = encodeExtendedSection<InjectionEdge>(canonical.injections, 'inj');
  const rx = encodeExtendedSection<ReactivityEdge>(canonical.reactivity, 'rx');

  // ✅ v15.0.2: cd — conditionals
  const allConditionals: TemplateConditional[] = [];
  for (const template of canonical.templates ?? []) {
    for (const cd of template.conditionals ?? []) {
      allConditionals.push(cd);
    }
  }
  const cd = encodeExtendedSection<TemplateConditional>(allConditionals, 'cd');

  const ty = encodeExtendedSection<TypeNodeData>(canonical.types, 'ty');
  const tr = encodeExtendedSection<TypeRefData>(canonical.typeRefs, 'tr');

  // ============================================
  // 12.6. lx — lexical links (columnar)
  // ============================================
  // ✅ v15.2.0 (P1): columnar-секция для лексических связей
  // ============================================
  const lexicalLinks = asArray<LexicalLink>((canonical as any).lexicalLinks);

  const lxP: number[] = []; // parentFunctionIdx, -1 = null
  const lxC: number[] = []; // childFunctionIdx
  const lxR: number[] = []; // relationCode
  const lxL: number[] = []; // line
  const lxAi: number[] = []; // argumentIndex, -1 = нет
  const lxCn: number[] = []; // calleeNameIdx, -1 = нет

  for (const link of lexicalLinks) {
    if (!link) continue;

    const parentIdx = link.parentFunctionId
      ? (functionReverse.get(link.parentFunctionId) ?? -1)
      : -1;
    const childIdx = functionReverse.get(link.childFunctionId) ?? -1;

    // Битый линк — пропускаем
    if (childIdx < 0) continue;

    const relCode = LEXICAL_RELATION_CODES[link.relation] ?? 0;
    const argIdx = link.argumentIndex ?? -1;
    const calleeIdx = link.calleeName ? addString(dict, link.calleeName) : -1;

    lxP.push(parentIdx);
    lxC.push(childIdx);
    lxR.push(relCode);
    lxL.push(link.line);
    lxAi.push(argIdx);
    lxCn.push(calleeIdx);
  }

  const lxP_Rle = rle(lxP);
  const lxC_Rle = rle(lxC);

  // ============================================
  // 13. ФИЛЬТРАЦИЯ VALUES
  // ============================================
  let finalValueDict: unknown[] = dict.valueDict;
  let valueIndexMap: Map<number, number> | null = null;

  if (valuesMode === 'relations') {
    const filtered = filterValues(dict.valueDict, dict.valueMeta);
    finalValueDict = filtered.values;
    valueIndexMap = filtered.indexMap;

    if (process.env.AST_DEBUG_CODEC === 'true') {
      console.log(
        `   🗜️  values-mode=relations: ${dict.valueDict.length} → ${finalValueDict.length} значений ` +
        `(${(
          ((dict.valueDict.length - finalValueDict.length) / dict.valueDict.length) *
          100
        ).toFixed(1)}% сжатие)`
      );
    }
  }

  // ============================================
  // Переиндексация ссылок в расширенных секциях
  // ============================================
  function remapIndices(indices: number[]): number[] {
    if (!valueIndexMap) return indices;
    const result: number[] = [];
    for (const oldIdx of indices) {
      const newIdx = remapIndex(oldIdx, valueIndexMap);
      if (newIdx !== null) result.push(newIdx);
    }
    return result;
  }

  const finalVt = remapIndices(vt);
  const finalLc = remapIndices(lc);
  const finalEf = remapIndices(ef);
  const finalInj = remapIndices(inj);
  const finalRx = remapIndices(rx);
  const finalCd = remapIndices(cd);
  const finalTy = remapIndices(ty);
  const finalTr = remapIndices(tr);

  // Переиндексация cn.nonEmptyV
  const finalNonEmptyV: [number, number][] = [];
  for (const [cnIdx, valIdx] of cnNonEmptyV) {
    if (valueIndexMap) {
      const newValIdx = remapIndex(valIdx, valueIndexMap);
      if (newValIdx === null) continue;
      finalNonEmptyV.push([cnIdx, newValIdx]);
    } else {
      finalNonEmptyV.push([cnIdx, valIdx]);
    }
  }

  // ============================================
  // 14. Легенда
  // ============================================
  const legend: CodecLegend = buildLegend({
    stringDict: dict.stringDict,
    paramDict: dict.paramDict,
    methodDict: dict.methodDict,
    valueDict: finalValueDict,
  });

  // ============================================
  // 15. Сборка CompactJSON
  // ============================================
  const compact: CompactJSON = {
    v: CODEC_VERSION,
    ts: canonical.timestamp,
    r: moduleReverse.get(canonical.root) ?? 0,
    valuesMode,

    tokens: [],
    strs: [],
    params: [],
    methods: [],
    values: finalValueDict,

    mi: { n: miN, f: miF },
    fl: { p: flP, m: flMRle },

    // ✅ v15.1.0 (P0): добавлено parent
    fns: {
      n: fnsN,
      m: fnsMRle,
      f: fnsFRle,
      l: fnsL,
      fl: fnsFl,
      p: fnsP,
      rt: fnsRt,
      parent: fnsParentRle,
    },
    cls: { n: clsN, m: clsMRle, f: clsFRle, l: clsL, fl: clsFl, methods: clsMethods },
    cn: { n: cnN, m: cnMRle, f: cnFRle, l: cnL, fl: cnFl, nonEmptyV: finalNonEmptyV },

    gr: {
      e: {
        m: geM,
        f: geF,
        fn: geFn,
        l: geL,
        ty: geTy,
        en: geEn,
        ln: geLn,
        s: geS,
        flags: geFlags,
      },
      i: { ff: giFf, tf: giTf, s: giS, im: giIm, ln: giLn, l: giL, ty: giTy },
      // ✅ v15.3.0 (P2): добавлены col/ck/cn/ai
      c: {
        f: gcF,
        t: gcT,
        l: gcL,
        ty: gcTy,
        col: gcCol,
        ck: gcCk,
        cn: gcCn,
        ai: gcAi,
      },
      re: { m: greM, fn: greFn, s: greS, en: greEn, l: greL, ty: greTy },
    },

    // Расширенные секции
    vt: finalVt,
    lc: finalLc,
    ef: finalEf,
    inj: finalInj,
    rx: finalRx,
    cd: finalCd,
    ty: finalTy,
    tr: finalTr,

    // ✅ v15.2.0 (P1): columnar-секция lx
    lx: {
      p: lxP_Rle,
      c: lxC_Rle,
      r: lxR,
      l: lxL,
      ai: lxAi,
      cn: lxCn,
    },

    st: canonical.statistics,
    legend,
  };

  // ============================================
  // Токенизация словарей строк
  // ============================================
  const allStrings = [...dict.stringDict, ...dict.paramDict, ...dict.methodDict];
  const tokens = buildTokenDict(allStrings);
  const tokenIndex = new Map(tokens.map((t, i) => [t, i]));

  compact.tokens = tokens;
  compact.strs = dict.stringDict.map(s => encodeStr(s, tokenIndex));
  compact.params = dict.paramDict.map(s => encodeStr(s, tokenIndex));
  compact.methods = dict.methodDict.map(s => encodeStr(s, tokenIndex));

  // ============================================
  // Удаляем пустые опциональные секции
  // ============================================
  // ⚠️ v15.2.0 (P1): lx НЕ удаляем как пустой — оставляем
  // пустой объект { p: [], c: [], r: [], l: [], ai: [], cn: [] },
  // чтобы decode мог корректно обработать.
  const OPTIONAL_SECTIONS: (keyof CompactJSON)[] = [
    'vt',
    'lc',
    'ef',
    'inj',
    'rx',
    'cd',
    'ty',
    'tr',
  ];

  for (const key of OPTIONAL_SECTIONS) {
    const v = (compact as any)[key];
    if (Array.isArray(v) && v.length === 0) {
      delete (compact as any)[key];
    }
  }

  return compact;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  encode,
  encodeFlags,
  flagsToString,
  createDictBuilder,
  addString,
  addParam,
  addMethod,
  addValue,
  reverseLookup,
  asArray,
  // ✅ v15.2.0 (P1)
  LEXICAL_RELATION_CODES,
  // ✅ v15.3.0 (P2)
  CALL_KIND_CODES,
};
