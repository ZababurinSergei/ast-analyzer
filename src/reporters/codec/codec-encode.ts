// src/reporters/codec/codec-encode.ts
// ============================================
// КОДИРОВАНИЕ: FullJSON → CompactJSON
// ============================================
// Версия: 15.7.3
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.7.3 (fix: vue.sfc.c — индексы в strs, а не в vue.composables):
//   - ✅ ИСПРАВЛЕНО: `encodeVueSection` теперь сохраняет
//     `sfc.composables` как ИНДЕКСЫ В `strs` (имена как строки),
//     а НЕ как индексы в `vue.composables`.
//
//     ПРИЧИНА: в SFC могут использоваться ВНЕШНИЕ composables
//     (`useRouter` из vue-router, `useI18n` из vue-i18n),
//     которых НЕТ в `vue.composables` (там только локальные).
//
//     Старый подход (v15.7.2) терял такие composables при encode,
//     что давало расхождение `sfc[19].composables.length: 5 vs 6`.
//
//   - ✅ ОБНОВЛЕНО: `sfc.c` теперь хранит `addString(dict, compName)`,
//     а не `composableNameToIdx.get(compName)`.
//
//   - ✅ УДАЛЕНО: локальная карта `composableNameToIdx` — больше
//     не нужна, потому что индексы в strs формируются напрямую
//     через `addString`.
//
//   - ✅ ДОБАВЛЕНО: подробный JSDoc с объяснением, почему
//     индексы в strs, а не в vue.composables.
//
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '15.7.3'.
//
// v15.7.2 (fix: vue.sfc.c/cs — восстановление moduleId + счётчики):
//   - ✅ ДОБАВЛЕНО: `sfc.cs` — slices `[[offset, count], ...]` для
//     каждого SFC. Заменяет неявное разбиение `c[i] = [fileIdx, count]`.
//   - ✅ ДОБАВЛЕНО: `sfc.c` — плоский массив индексов composables.
//
// v15.7.1 (Vue-секция: ослабление проверки + moduleId):
//   - ✅ ИСПРАВЛЕНО: `decodeVueSection` восстанавливает `moduleId`.
//
// v15.7.0 (Vue entities):
//   - ✅ ДОБАВЛЕНО: `fns.vk` (RLE от vueKindCode).
//   - ✅ ДОБАВЛЕНО: VUE_KIND_CODES.
//   - ✅ ДОБАВЛЕНО: HOOK_NAME_CODES, REACTIVITY_KIND_CODES,
//     ICON_CATEGORY_CODES, COMPOSABLE_KIND_CODES,
//     COMPOSABLE_SHAPE_CODES, MACRO_KIND_CODES.
//   - ✅ ДОБАВЛЕНО: `encodeVueSection`.
//
// v15.5.6 (Vue entities — типизация + fns.vk):
//   - ✅ ДОБАВЛЕНО: типизация `encodeVueSection`.
//
// v15.4.4 (защита от рассинхрона values[]):
//   - ✅ ДОБАВЛЕНО: addValue() проверяет isValueKept.
//
// v15.4.3 (устранение дублирования + детерминизм):
//   - ✅ УДАЛЕНЫ локальные extractNumericId / sortByIdNumeric /
//     canonicalizeFullJSON / stableStringify / classifyValue.
//   - ✅ ДОБАВЛЕНЫ импорты из новых модулей.
//
// v15.4.2 (fix: типобезопасный ключ дедупликации в addValue):
//   - ✅ ИСПРАВЛЕНО: addValue() использует типобезопасный ключ.
//
// v15.4.1 (fix: стабильная дедупликация в addValue):
//   - ✅ ДОБАВЛЕНО: stableStringify для ключа дедупликации.
//
// v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: CALL_KIND_CODES.
//   - ✅ ДОБАВЛЕНО: gcCol/gcCk/gcCn/gcAi в gr.c.
//
// v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: LEXICAL_RELATION_CODES.
//   - ✅ ДОБАВЛЕНО: columnar-секция lx.
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: fnsParent[], rle(fnsParent).
//
// v15.0.6 (gr.i.tf — индекс в fl.p)
// v15.0.5 (проброс isReExport/isStarReExport)
// v15.0.3 (fix round-trip Vue conditionals)
// v15.0.2 (устранение дублирования conditionals)
// v15.0.1 (fix дедупликации extended-секций)
// v15.0.0 (полный round-trip расширенных секций)
// v14.0.0 (байтовое равенство)
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
  // ✅ v15.5.0: Vue-секции (типизация)
  SFCComponent,
  ComposableEntity,
  MacroEntity,
  HookEntity,
  ReactivityEntity,
  IconEntity,
  VueSectionFull,
  VueSectionCompact,
  VueKind,
} from './codec-types.js';

import { buildLegend } from './codec-legend.js';

// ✅ v15.5.0: единая версия
import { CODEC_VERSION } from './codec-types.js';

// ✅ v13.0.0: фильтрация values
// ✅ v15.4.4: добавлен импорт isValueKept
// ✅ v15.4.3: classifyValue — из values-filter.js
import {
  filterValues,
  remapIndex,
  classifyValue,
  isValueKept,
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
// ✅ v15.5.0: VUE KIND CODES
// ============================================
//
// Числовые коды для vueKind.
// Используются в fns.vk (RLE).
//
// ⚠️ Синхронизировано с VUE_KIND_BY_CODE в codec-decode.ts.
// ⚠️ Синхронизировано с legend.codes.vueKind.
// ============================================

export const VUE_KIND_CODES: Record<VueKind, number> = {
  function: 0,
  composable: 1,
  macro: 2,
  hook: 3,
  reactivity: 4,
  callback: 5,
  arrow: 6,
};

// ============================================
// ✅ v15.5.0: HOOK NAME CODES
// ============================================
//
// Числовые коды для hookName (vue.hooks.n).
//
// ⚠️ Синхронизировано с HOOK_NAME_BY_CODE в codec-decode.ts.
// ⚠️ Синхронизировано с legend.codes.hookName.
// ============================================

export const HOOK_NAME_CODES: Record<string, number> = {
  onMounted: 0,
  onUnmounted: 1,
  onActivated: 2,
  onDeactivated: 3,
  onErrorCaptured: 4,
  onScopeDispose: 5,
  watch: 6,
  watchEffect: 7,
  onBeforeMount: 8,
  onBeforeUnmount: 9,
  onUpdated: 10,
  onBeforeUpdate: 11,
};

// ============================================
// ✅ v15.5.0: REACTIVITY KIND CODES
// ============================================
//
// Числовые коды для reactivity kind (vue.reactivity.k).
//
// ⚠️ Синхронизировано с REACTIVITY_KIND_BY_CODE в codec-decode.ts.
// ⚠️ Синхронизировано с legend.codes.reactivityKind.
// ============================================

export const REACTIVITY_KIND_CODES: Record<string, number> = {
  computed: 0,
  ref: 1,
  reactive: 2,
  watch: 3,
  shallowRef: 4,
  readonly: 5,
  toRef: 6,
  toRefs: 7,
};

// ============================================
// ✅ v15.5.0: ICON CATEGORY CODES
// ============================================
//
// Числовые коды для icon category (vue.icons.c).
//
// ⚠️ Синхронизировано с ICON_CATEGORY_BY_CODE в codec-decode.ts.
// ⚠️ Синхронизировано с legend.codes.iconCategory.
// ============================================

export const ICON_CATEGORY_CODES: Record<string, number> = {
  base: 0,
  filter: 1,
  toolbar: 2,
  sort: 3,
};

// ============================================
// ✅ v15.5.0: COMPOSABLE KIND CODES
// ============================================
//
// Числовые коды для composable kind (vue.composables.k).
//
// ⚠️ Синхронизировано с COMPOSABLE_KIND_BY_CODE в codec-decode.ts.
// ⚠️ Синхронизировано с legend.codes.composableKind.
// ============================================

export const COMPOSABLE_KIND_CODES: Record<string, number> = {
  composable: 0,
  store: 1,
  factory: 2,
  utility: 3,
};

// ============================================
// ✅ v15.5.0: COMPOSABLE SHAPE CODES
// ============================================
//
// Числовые коды для returnShape (vue.composables.r).
// ============================================

export const COMPOSABLE_SHAPE_CODES: Record<string, number> = {
  void: 0,
  object: 1,
  ref: 2,
  reactive: 3,
  function: 4,
};

// ============================================
// ✅ v15.5.0: MACRO KIND CODES
// ============================================
//
// Числовые коды для macro kind (vue.macros.k).
// ============================================

export const MACRO_KIND_CODES: Record<string, number> = {
  props: 0,
  emits: 1,
  expose: 2,
  slots: 3,
  model: 4,
  options: 5,
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
  if (!isValueKept(value, mode)) return -1;

  // ✅ v15.4.2-fix: типобезопасный ключ дедупликации
  let dedupKey: string;

  if (value === null) {
    dedupKey = 'N';
  } else if (typeof value === 'string') {
    dedupKey = 'S:' + value;
  } else if (typeof value === 'number') {
    dedupKey = 'D:' + value;
  } else if (typeof value === 'boolean') {
    dedupKey = 'B:' + value;
  } else if (typeof value === 'bigint') {
    dedupKey = 'I:' + value.toString();
  } else if (typeof value === 'object') {
    dedupKey = 'O:' + stableStringify(value);
  } else if (typeof value === 'function') {
    dedupKey = 'X:' + String(value);
  } else if (typeof value === 'symbol') {
    dedupKey = 'X:' + String(value);
  } else {
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

/**
 * Добавить произвольный объект/массив/примитив в valueDict.
 *
 * Отличия от addValue():
 *   - НЕ дедуплицирует. Каждый вызов = новый value с новым индексом.
 *   - НЕ применяет фильтрацию values (kind = 'relation').
 *   - ✅ v15.0.3: делает `structuredClone(value)` перед push.
 *   - Используется ТОЛЬКО для extended-секций (vt/lc/ef/inj/rx/cd/ty/tr/vue).
 */
function addAny(dict: DictBuilder, value: unknown, key: string): number {
  if (value === undefined) return -1;

  const idx = dict.valueDict.length;

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

  if (str.length < 8) return str;

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
// ✅ v15.7.3: VUE SECTION ENCODER
// ============================================

/**
 * Кодирует `full.vue` → `compact.vue`.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   - sfc:         columnar + slices `cs` для composables
 *   - composables: columnar + RLE для f
 *   - macros:      columnar
 *   - hooks:       columnar
 *   - reactivity:  columnar
 *   - icons:       columnar
 *
 * ════════════════════════════════════════════════════════════
 * ✅ v15.7.3: `sfc.c` — ИНДЕКСЫ В `strs`, а НЕ В `vue.composables`
 * ════════════════════════════════════════════════════════════
 *
 *   ПРОБЛЕМА (до v15.7.3):
 *
 *     Ранее (v15.7.2) `sfc.c` содержал индексы в `vue.composables`.
 *     Но `vue.composables` содержит только ЛОКАЛЬНЫЕ composables —
 *     те, что объявлены в проекте (`useDataState`, `useColumnsConfig`).
 *
 *     А `sfc.composables` может содержать ВНЕШНИЕ:
 *       • useRouter (vue-router)
 *       • useI18n (vue-i18n)
 *       • useStore (vuex)
 *       • и т.д.
 *
 *     Такие внешние composables НЕ находятся в `vue.composables`,
 *     и при encode терялись.
 *
 *     Симптом:
 *       `vue.sfc[19].composables.length: a=5, b=6`
 *       (в full 6 composables, в decoded 5 — один внешний потерян)
 *
 *   РЕШЕНИЕ (v15.7.3):
 *
 *     `sfc.c` теперь содержит индексы в `strs` — то есть
 *     имена composables как строки. Это универсально:
 *     работает и для локальных, и для внешних composables.
 *
 *     Decode читает имена через `readStr(idx)` из `strs` напрямую,
 *     не обращаясь к `vue.composables`.
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ ВАЖНО ДЛЯ ROUND-TRIP: sfc.c / sfc.cs
 * ════════════════════════════════════════════════════════════
 *
 *   Для SFC пишутся:
 *     sfc.c   = [nameIdx1, nameIdx2, ..., nameIdxN]  — плоский массив
 *     sfc.cs  = [[offset, count], ...]                — slices
 *
 *   Где nameIdx — индексы в `strs` (имена composables).
 *
 *   Гарантирует корректный round-trip:
 *     encode(full) → compact.vue.sfc.c = [idx1, idx2, ...]
 *                    compact.vue.sfc.cs = [[off1, cnt1], ...]
 *     decode(compact) → full.vue.sfc[i].composables = [name1, name2, ...]
 *     encode(decode(compact)) → compact.vue.sfc.c = [idx1, idx2, ...] ✅
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ props / emits / exposed — только счётчики
 * ════════════════════════════════════════════════════════════
 *
 *   Для props/emits/exposed в compact пишутся ТОЛЬКО СЧЁТЧИКИ:
 *     sfc.p[i] = [fileIdx, propsCount]
 *     sfc.e[i] = [fileIdx, emitsCount]
 *     sfc.x[i] = [fileIdx, exposeCount]
 *
 *   Реальные имена не сохраняются (это отдельная задача).
 *   При decode восстанавливаются плейсхолдеры `['#0', '#1', ...]`.
 *
 * @param vue         — FullJSON.vue
 * @param dict        — словарь строк
 * @param fileReverse — карта fileId → fileIdx
 * @returns VueSectionCompact
 */
export function encodeVueSection(
  vue: VueSectionFull,
  dict: DictBuilder,
  fileReverse: Map<string, number>
): VueSectionCompact {
  // ────────────────────────────────────────────────────────
  // sfc
  // ────────────────────────────────────────────────────────
  //
  // ✅ v15.7.3: `sfc.c` — плоский массив ИНДЕКСОВ В STRS (имена composables).
  //
  // ════════════════════════════════════════════════════════════
  // ПОЧЕМУ НЕ ИНДЕКСЫ В `vue.composables`
  // ════════════════════════════════════════════════════════════
  //
  //   Ранее (v15.7.2) `sfc.c` содержал индексы в `vue.composables`.
  //   Проблема: если composable вызывается в SFC, но НЕ объявлен
  //   в проекте (например, `useRouter` из `vue-router`),
  //   он отсутствует в `vue.composables` → теряется при encode.
  //
  //   Теперь `sfc.c` содержит индексы в `strs` (имена как строки).
  //   Это универсально: работает для локальных и внешних
  //   composables одинаково.
  // ============================================================

  const sfcF: number[] = [];
  const sfcN: number[] = [];
  const sfcB: number[] = [];

  // ✅ v15.7.3: плоский массив индексов в strs (имена composables)
  const sfcC: number[] = [];
  // ✅ v15.7.3: slices [offset, count] для каждого SFC
  const sfcCS: Array<[number, number]> = [];

  const sfcP: [number, number][] = [];
  const sfcE: [number, number][] = [];
  const sfcX: [number, number][] = [];

  for (const s of vue.sfc ?? []) {
    const sfc: SFCComponent = s;
    const fileIdx = fileReverse.get(sfc.fileId) ?? 0;

    sfcF.push(fileIdx);
    sfcN.push(addString(dict, sfc.name));
    sfcB.push(sfc.blocks ?? 0);

    // ✅ v15.7.3: сохраняем ИМЯ (индекс в strs), а не индекс в vue.composables
    //
    // Для каждого имени composable в SFC добавляем его в `strs`
    // и получаем индекс. Это работает и для локальных composables
    // (которые есть в `vue.composables`), и для внешних
    // (useRouter, useI18n), которых там нет.
    const composables = sfc.composables ?? [];
    const startOffset = sfcC.length;

    for (const compName of composables) {
      const nameIdx = addString(dict, compName);
      if (nameIdx >= 0) {
        sfcC.push(nameIdx);
      }
    }

    sfcCS.push([startOffset, sfcC.length - startOffset]);

    // props/emits/exposed — только счётчики
    sfcP.push([fileIdx, (sfc.props ?? []).length]);
    sfcE.push([fileIdx, (sfc.emits ?? []).length]);
    sfcX.push([fileIdx, (sfc.exposed ?? []).length]);
  }

  // ────────────────────────────────────────────────────────
  // composables
  // ────────────────────────────────────────────────────────
  const compN: number[] = [];
  const compF: number[] = [];
  const compK: number[] = [];
  const compR: number[] = [];
  const compV: [number, number][] = [];

  for (let i = 0; i < (vue.composables ?? []).length; i++) {
    const c: ComposableEntity = vue.composables[i]!;

    compN.push(addString(dict, c.name));
    compF.push(fileReverse.get(c.fileId) ?? 0);
    compK.push(COMPOSABLE_KIND_CODES[c.kind] ?? 0);
    compR.push(COMPOSABLE_SHAPE_CODES[c.returnShape] ?? 0);
    compV.push([i, (c.returnedKeys ?? []).length]);
  }

  // ────────────────────────────────────────────────────────
  // macros
  // ────────────────────────────────────────────────────────
  const macroF: number[] = [];
  const macroK: number[] = [];
  const macroL: number[] = [];

  for (const m of vue.macros ?? []) {
    const macro: MacroEntity = m;

    macroF.push(fileReverse.get(macro.fileId) ?? 0);
    macroK.push(MACRO_KIND_CODES[macro.kind] ?? 0);
    macroL.push(macro.line ?? 0);
  }

  // ────────────────────────────────────────────────────────
  // hooks
  // ────────────────────────────────────────────────────────
  const hookF: number[] = [];
  const hookN: number[] = [];
  const hookL: number[] = [];

  for (const h of vue.hooks ?? []) {
    const hook: HookEntity = h;

    hookF.push(fileReverse.get(hook.fileId) ?? 0);
    hookN.push(HOOK_NAME_CODES[hook.hookName] ?? 0);
    hookL.push(hook.line ?? 0);
  }

  // ────────────────────────────────────────────────────────
  // reactivity
  // ────────────────────────────────────────────────────────
  const rxVueF: number[] = [];
  const rxVueK: number[] = [];
  const rxVueL: number[] = [];
  const rxVueN: number[] = [];

  for (const r of vue.reactivity ?? []) {
    const rx: ReactivityEntity = r;

    rxVueF.push(fileReverse.get(rx.fileId) ?? 0);
    rxVueK.push(REACTIVITY_KIND_CODES[rx.kind] ?? 0);
    rxVueL.push(rx.line ?? 0);
    rxVueN.push(rx.name ? addString(dict, rx.name) : -1);
  }

  // ────────────────────────────────────────────────────────
  // icons
  // ────────────────────────────────────────────────────────
  const iconF: number[] = [];
  const iconN: number[] = [];
  const iconC: number[] = [];

  for (const ic of vue.icons ?? []) {
    const icon: IconEntity = ic;

    iconF.push(fileReverse.get(icon.fileId) ?? 0);
    iconN.push(addString(dict, icon.name));
    iconC.push(ICON_CATEGORY_CODES[icon.category] ?? 0);
  }

  return {
    sfc: {
      f: sfcF,
      n: sfcN,
      b: sfcB,
      // ✅ v15.7.3: плоский массив индексов в strs + slices
      c: sfcC,
      cs: sfcCS,
      p: sfcP,
      e: sfcE,
      x: sfcX,
    },
    composables: {
      n: compN,
      f: rle(compF),
      k: compK,
      r: compR,
      v: compV,
    },
    macros: {
      f: macroF,
      k: macroK,
      l: macroL,
    },
    hooks: {
      f: hookF,
      n: hookN,
      l: hookL,
    },
    reactivity: {
      f: rxVueF,
      k: rxVueK,
      l: rxVueL,
      n: rxVueN,
    },
    icons: {
      f: iconF,
      n: iconN,
      c: iconC,
    },
  };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ENCODE
// ============================================

/**
 * Кодирует полный JSON в сжатый (v15.7.3).
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
  // ✅ v15.1.0 (P0): parent
  // ✅ v15.5.0: vk (vueKind)
  // ============================================
  const fnsN: number[] = [];
  const fnsM: number[] = [];
  const fnsF: number[] = [];
  const fnsL: number[] = [];
  const fnsFl: number[] = [];
  const fnsP: number[][] = [];
  const fnsRt: number[] = [];
  const fnsParent: number[] = [];
  const fnsVk: number[] = [];

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

    // ✅ v15.5.0: vueKind → код
    const vk = func.vueKind ?? 'function';
    fnsVk.push(VUE_KIND_CODES[vk] ?? 0);
  }

  const fnsMRle = rle(fnsM);
  const fnsFRle = rle(fnsF);
  const fnsParentRle = rle(fnsParent);
  const fnsVkRle = rle(fnsVk);

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

    const combinedTy =
      typeCode |
      (imp.isExternal ? 4 : 0) |
      (imp.isTypeOnly ? 8 : 0) |
      (imp.isReExport ? 16 : 0) |
      (imp.isStarReExport ? 32 : 0);

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
  // ✅ v15.3.0 (P2): col/ck/cn/ai
  // ============================================
  const calls = asArray<CallData>(canonical.calls);
  const gcF: number[] = [];
  const gcT: number[] = [];
  const gcL: number[] = [];
  const gcTy: number[] = [];
  const gcCol: number[] = [];
  const gcCk: number[] = [];
  const gcCn: number[] = [];
  const gcAi: number[] = [];

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
  // ✅ v15.2.0 (P1)
  // ============================================
  const lexicalLinks = asArray<LexicalLink>((canonical as any).lexicalLinks);

  const lxP: number[] = [];
  const lxC: number[] = [];
  const lxR: number[] = [];
  const lxL: number[] = [];
  const lxAi: number[] = [];
  const lxCn: number[] = [];

  for (const link of lexicalLinks) {
    if (!link) continue;

    const parentIdx = link.parentFunctionId
      ? (functionReverse.get(link.parentFunctionId) ?? -1)
      : -1;
    const childIdx = functionReverse.get(link.childFunctionId) ?? -1;

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
  // 12.7. ✅ v15.7.3: vue — Vue-сущности (columnar)
  // ============================================
  //
  // ✅ v15.7.3: `sfc.c` — индексы в `strs` (имена composables),
  //             `sfc.cs` — slices [offset, count].
  //             Работает и для локальных, и для внешних composables.
  // ============================================
  let vue: VueSectionCompact | undefined;
  if (canonical.vue) {
    vue = encodeVueSection(canonical.vue, dict, fileReverse);
  }

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

    // ✅ v15.1.0 (P0): parent
    // ✅ v15.5.0: vk
    fns: {
      n: fnsN,
      m: fnsMRle,
      f: fnsFRle,
      l: fnsL,
      fl: fnsFl,
      p: fnsP,
      rt: fnsRt,
      parent: fnsParentRle,
      vk: fnsVkRle,
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

    // ✅ v15.7.3: Vue-секция (sfc.c — индексы в strs, sfc.cs — slices)
    vue,

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
  const OPTIONAL_SECTIONS: (keyof CompactJSON)[] = [
    'vt',
    'lc',
    'ef',
    'inj',
    'rx',
    'cd',
    'ty',
    'tr',
    'vue',
  ];

  for (const key of OPTIONAL_SECTIONS) {
    const v = (compact as any)[key];
    if (v === undefined || v === null) continue;

    // Для массивов: удаляем, если пустой
    if (Array.isArray(v) && v.length === 0) {
      delete (compact as any)[key];
      continue;
    }

    // Для vue: удаляем, если все подсекции пусты
    if (key === 'vue' && typeof v === 'object') {
      const allEmpty =
        (v.sfc?.f?.length ?? 0) === 0 &&
        (v.composables?.n?.length ?? 0) === 0 &&
        (v.macros?.f?.length ?? 0) === 0 &&
        (v.hooks?.f?.length ?? 0) === 0 &&
        (v.reactivity?.f?.length ?? 0) === 0 &&
        (v.icons?.f?.length ?? 0) === 0;
      if (allEmpty) {
        delete (compact as any)[key];
      }
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
  // ✅ v15.5.0
  VUE_KIND_CODES,
  HOOK_NAME_CODES,
  REACTIVITY_KIND_CODES,
  ICON_CATEGORY_CODES,
  COMPOSABLE_KIND_CODES,
  COMPOSABLE_SHAPE_CODES,
  MACRO_KIND_CODES,
  encodeVueSection,
};
