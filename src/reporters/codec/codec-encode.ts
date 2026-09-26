// src/reporters/codec/codec-encode.ts
// ============================================
// КОДИРОВАНИЕ: FullJSON → CompactJSON (v16.0.1)
// ============================================
// Версия: 16.0.1
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.0.1 (fix round-trip: fns.hv — RLE для isHtmlVisible):
//   - ✅ ДОБАВЛЕНО: `fnsHv` — RLE-массив для `isHtmlVisible` (0 | 1).
//     Поле добавляется в `compact.fns.hv`.
//   - ✅ ПРИЧИНА: в v16.0.0 `FunctionData.isHtmlVisible` заполнялся
//     в `compact-reporter.ts`, но НЕ кодировался в CompactJSON.
//     Это давало расхождение L1/L2/DL:
//       $.functions[0].isHtmlVisible  a: undefined  b: false
//     Теперь `isHtmlVisible` кодируется через RLE `hv`, и при
//     `decode` восстанавливается корректно (false для всех функций,
//     т.к. domApiCalls = 0).
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION → '16.0.1' (через codec-types.js).
//   - ✅ СИНХРОНИЗИРОВАНО: schemas.fns теперь 10 полей
//     (n, m, f, l, fl, p, rt, parent, vk, hv).
//
// v16.0.0 (major — несовместимое расширение схем):
//   - ✅ BREAKING: vue.sfc — 8 → 30 полей
//   - ✅ BREAKING: +10 top-level секций CompactJSON
//   - ✅ ДОБАВЛЕНО: addId(dict, id) — интернирование сгенерированных id
//   - ✅ ДОБАВЛЕНО: addSourceChain(dict, chain) — интернирование sourceChain
//   - ✅ ДОБАВЛЕНО: rleArray(values) — RLE-кодирование
//   - ✅ ДОБАВЛЕНО: 9 функций encode*
//      (encodeFnHtmlUsage, encodeComponentProps, encodeComponentEvents,
//       encodeComponentDirectives, encodeComponentSlots,
//       encodeHtmlInterpolations, encodeDomApiCalls, encodeDomApiArgs,
//       encodeVueSection расширена)
//   - ✅ ДОБАВЛЕНО: заполнение st.total*
//   - ✅ ДОБАВЛЕНО: ids[], sourceChains[] в CompactJSON
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION → '16.0.0'
//
// v15.7.3 (fix: vue.sfc.c — индексы в strs, а не в vue.composables):
// v15.7.2 (fix: vue.sfc.c/cs — восстановление moduleId + счётчики):
// v15.7.1 (Vue-секция: ослабление проверки + moduleId):
// v15.7.0 (Vue entities):
// v15.5.6 (Vue entities — типизация + fns.vk):
// v15.4.4 (защита от рассинхрона values[]):
// v15.4.3 (устранение дублирования + детерминизм):
// v15.4.2 (fix: типобезопасный ключ дедупликации в addValue):
// v15.4.1 (fix: стабильная дедупликация в addValue):
// v15.3.0 (P2 — расширенный CallData):
// v15.2.0 (P1 — lexicalLinks):
// v15.1.0 (P0 — parentFunctionId):
// v15.0.6 (gr.i.tf — индекс в fl.p):
// v15.0.5 (проброс isReExport/isStarReExport):
// v15.0.3 (fix round-trip Vue conditionals):
// v15.0.2 (устранение дублирования conditionals):
// v15.0.1 (fix дедупликации extended-секций):
// v15.0.0 (полный round-trip расширенных секций):
// v14.0.0 (байтовое равенство):
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
  LexicalLink,
  LexicalRelation,
  ComposableEntity,
  MacroEntity,
  HookEntity,
  ReactivityEntity,
  IconEntity,
  VueSectionFull,
  VueSectionCompact,
  VueKind,
  // ✅ v16.0.0
  ComponentProp,
  ComponentEvent,
  ComponentDirective,
  ComponentSlot,
  HtmlInterpolation,
  DomApiArg,
  SourceChainItem,
} from './codec-types.js';

import { buildLegend } from './codec-legend.js';

// ✅ v15.5.0: единая версия
import { CODEC_VERSION } from './codec-types.js';

// ✅ v15.4.3: устранение дублирования
import { stableStringify } from './stable-stringify.js';
import { canonicalizeFullJSON } from '../utils/canonical-utils.js';

// ✅ v13.0.0: фильтрация values
import {
  filterValues,
  remapIndex,
  classifyValue,
  isValueKept,
  type ValuesMode,
  type ValueMeta,
} from './values-filter.js';

// ✅ v16.0.0: коды
import {
  DOM_CATEGORY_CODES,
  DOM_EFFECT_CODES,
  DOM_TARGET_KIND_CODES,
  DOM_ARG_KIND_CODES,
  DOM_ARG_SOURCE_CODES,
  COMPONENT_SOURCE_CODES,
  PROP_KIND_CODES,
  EVENT_HANDLER_SOURCE_CODES,
  HTML_OUTPUT_KIND_CODES,
  COMPOSABLE_KIND_CODES,
  COMPOSABLE_RETURN_SHAPE_CODES,
  MACRO_KIND_CODES,
  HOOK_NAME_CODES,
  REACTIVITY_KIND_CODES,
  ICON_CATEGORY_CODES,
  VUE_KIND_CODES,
} from './codec-legend.js';

// ✅ v16.0.0: сериализация sourceChain
import { serializeSourceChain } from '../../core/source-chain-resolver.js';

// ============================================
// ✅ v15.2.0 (P1): LEXICAL RELATION CODES
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

export const VUE_KIND_CODES_LOCAL: Record<VueKind, number> = {
  function: 0,
  composable: 1,
  macro: 2,
  hook: 3,
  reactivity: 4,
  callback: 5,
  arrow: 6,
};

// ============================================
// СЛОВАРИ ФЛАГОВ
// ============================================

/**
 * Карта флагов: бит → имя.
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
  /** ✅ v16.0.0: интернирование сгенерированных id */
  idDict: string[];
  idMap: Map<string, number>;
  /** ✅ v16.0.0: интернирование sourceChain */
  sourceChainDict: string[];
  sourceChainMap: Map<string, number>;
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
    idDict: [],
    idMap: new Map(),
    sourceChainDict: [],
    sourceChainMap: new Map(),
  };
}

/**
 * ✅ v16.0.0: добавить сгенерированный id в idDict.
 */
export function addId(dict: DictBuilder, id: string): number {
  if (!id) return -1;
  const existing = dict.idMap.get(id);
  if (existing !== undefined) return existing;
  const idx = dict.idDict.length;
  dict.idDict.push(id);
  dict.idMap.set(id, idx);
  return idx;
}

/**
 * ✅ v16.0.0: добавить sourceChain в sourceChainDict (интернирование).
 */
export function addSourceChain(dict: DictBuilder, chain: SourceChainItem[]): number {
  if (!chain || chain.length === 0) return -1;
  const serialized = serializeSourceChain(chain);
  const existing = dict.sourceChainMap.get(serialized);
  if (existing !== undefined) return existing;
  const idx = dict.sourceChainDict.length;
  dict.sourceChainDict.push(serialized);
  dict.sourceChainMap.set(serialized, idx);
  return idx;
}

/**
 * ✅ v16.0.0: RLE-кодирование массива чисел.
 *
 * Возвращает [[start, length, value], ...].
 * Если все значения уникальны (последовательность 0,1,2,...),
 * можно использовать value === undefined (RLE-последовательность).
 */
export function rleArray(values: number[]): [number, number, number?][] {
  if (values.length === 0) return [];
  const result: [number, number, number?][] = [];
  let start = 0;
  let current = values[0]!;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== current) {
      result.push([start, i - start, current]);
      start = i;
      current = values[i]!;
    }
  }
  result.push([start, values.length - start, current]);
  return result;
}

/**
 * Добавить строку в stringDict, вернуть индекс.
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
// ADD VALUE
// ============================================

/**
 * Добавить значение в valueDict, вернуть индекс.
 */
export function addValue(
  dict: DictBuilder,
  value: unknown,
  key: string = '',
  kind?: ValueMeta['kind'],
  mode: ValuesMode = 'relations'
): number {
  if (value === undefined) return -1;

  if (!isValueKept(value, mode)) return -1;

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
// addAny — БЕЗ ДЕДУПЛИКАЦИИ + structuredClone
// ============================================

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

export function reverseLookup(dict: Record<string, string>, name: string | undefined): string {
  if (!name) return Object.keys(dict)[0] ?? '?';
  const reverse = Object.fromEntries(Object.entries(dict).map(([c, n]) => [n, c]));
  return reverse[name] ?? Object.keys(dict)[0] ?? '?';
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ============================================
// RLE ХЕЛПЕРЫ
// ============================================

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

function tokenizeStr(str: string): string[] {
  if (!str) return [];
  const tokens = str.split(/(?=[A-Z])|[_\-/.0-9]+/).filter(Boolean);
  return tokens;
}

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
// ✅ v16.0.0: VUE SECTION ENCODER (расширена)
// ============================================

/**
 * Кодирует `full.vue` → `compact.vue`.
 *
 * ✅ v16.0.0: sfc расширена до 30 полей:
 *   - реальные имена props/emits/exposed (pn/ps/en/es/xn/xs)
 *   - component usages (cu_*)
 *   - html elements (he_*)
 */
export function encodeVueSection(
  vue: VueSectionFull,
  dict: DictBuilder,
  fileReverse: Map<string, number>
): VueSectionCompact {
  // ────────────────────────────────────────────────────────
  // sfc — расширенная схема (30 полей)
  // ────────────────────────────────────────────────────────
  const sfcF: number[] = [];
  const sfcN: number[] = [];
  const sfcB: number[] = [];

  const sfcC: number[] = [];
  const sfcCS: Array<[number, number]> = [];

  // ✅ v16.0.0: реальные имена
  const sfcPN: number[] = [];
  const sfcPS: Array<[number, number]> = [];
  const sfcEN: number[] = [];
  const sfcES: Array<[number, number]> = [];
  const sfcXN: number[] = [];
  const sfcXS: Array<[number, number]> = [];

  // ✅ v16.0.0: component usages (RLE)
  const cuSfc: number[] = [];
  const cuTag: number[] = [];
  const cuFile: number[] = [];
  const cuSrc: number[] = [];
  const cuPkg: number[] = [];
  const cuL: number[] = [];
  const cuCol: number[] = [];
  const cuCp: Array<[number, number]> = [];
  const cuCe: Array<[number, number]> = [];
  const cuCd: Array<[number, number]> = [];
  const cuCsl: Array<[number, number]> = [];

  // ✅ v16.0.0: html elements (RLE)
  const heSfc: number[] = [];
  const heTag: number[] = [];
  const heL: number[] = [];
  const heCol: number[] = [];
  const heCp: Array<[number, number]> = [];
  const heCd: Array<[number, number]> = [];
  const heCe: Array<[number, number]> = [];
  const heCi: Array<[number, number]> = [];

  // Накопители для componentProps/Events/Directives/Slots/Interpolations
  const allComponentProps: ComponentProp[] = [];
  const allComponentEvents: ComponentEvent[] = [];
  const allComponentDirectives: ComponentDirective[] = [];
  const allComponentSlots: ComponentSlot[] = [];
  const allHtmlInterpolations: HtmlInterpolation[] = [];

  for (const sfc of vue.sfc ?? []) {
    const fileIdx = fileReverse.get(sfc.fileId) ?? 0;
    sfcF.push(fileIdx);
    sfcN.push(addString(dict, sfc.name));
    sfcB.push(sfc.blocks ?? 0);

    // Composables — из sfc.composables
    const composables = sfc.composables ?? [];
    const startOffset = sfcC.length;
    for (const compName of composables) {
      const nameIdx = addString(dict, compName);
      if (nameIdx >= 0) sfcC.push(nameIdx);
    }
    sfcCS.push([startOffset, sfcC.length - startOffset]);

    // ✅ v16.0.0: реальные имена props/emits/exposed
    const pStart = sfcPN.length;
    for (const p of sfc.props ?? []) {
      const idx = addString(dict, p);
      if (idx >= 0) sfcPN.push(idx);
    }
    sfcPS.push([pStart, sfcPN.length - pStart]);

    const eStart = sfcEN.length;
    for (const e of sfc.emits ?? []) {
      const idx = addString(dict, e);
      if (idx >= 0) sfcEN.push(idx);
    }
    sfcES.push([eStart, sfcEN.length - eStart]);

    const xStart = sfcXN.length;
    for (const x of sfc.exposed ?? []) {
      const idx = addString(dict, x);
      if (idx >= 0) sfcXN.push(idx);
    }
    sfcXS.push([xStart, sfcXN.length - xStart]);

    // ✅ v16.0.0: component usages
    const sfcIdxForCu = sfcF.length - 1;
    for (const cu of sfc.componentUsages ?? []) {
      cuSfc.push(sfcIdxForCu);
      cuTag.push(addString(dict, cu.tag));

      const compFileIdx = cu.componentFileId
        ? (fileReverse.get(cu.componentFileId) ?? -1)
        : -1;
      cuFile.push(compFileIdx);
      cuSrc.push(COMPONENT_SOURCE_CODES[cu.source] ?? 4);
      cuPkg.push(cu.packageName ? addString(dict, cu.packageName) : -1);
      cuL.push(cu.line ?? 0);
      cuCol.push(cu.column ?? -1);

      // Props
      const cpStart = allComponentProps.length;
      for (const p of cu.props ?? []) {
        allComponentProps.push(p);
      }
      cuCp.push([cpStart, allComponentProps.length - cpStart]);

      // Events
      const ceStart = allComponentEvents.length;
      for (const e of cu.events ?? []) {
        allComponentEvents.push(e);
      }
      cuCe.push([ceStart, allComponentEvents.length - ceStart]);

      // Directives
      const cdStart = allComponentDirectives.length;
      for (const d of cu.directives ?? []) {
        allComponentDirectives.push(d);
      }
      cuCd.push([cdStart, allComponentDirectives.length - cdStart]);

      // Slots
      const cslStart = allComponentSlots.length;
      for (const sl of cu.slots ?? []) {
        allComponentSlots.push(sl);
      }
      cuCsl.push([cslStart, allComponentSlots.length - cslStart]);
    }

    // ✅ v16.0.0: html elements
    for (const he of sfc.htmlElements ?? []) {
      heSfc.push(sfcIdxForCu);
      heTag.push(addString(dict, he.tag));
      heL.push(he.line ?? 0);
      heCol.push(he.column ?? -1);

      // Props
      const hcpStart = allComponentProps.length;
      for (const p of he.props ?? []) {
        allComponentProps.push(p);
      }
      heCp.push([hcpStart, allComponentProps.length - hcpStart]);

      // Directives
      const hcdStart = allComponentDirectives.length;
      for (const d of he.directives ?? []) {
        allComponentDirectives.push(d);
      }
      heCd.push([hcdStart, allComponentDirectives.length - hcdStart]);

      // Events
      const hceStart = allComponentEvents.length;
      for (const e of he.events ?? []) {
        allComponentEvents.push(e);
      }
      heCe.push([hceStart, allComponentEvents.length - hceStart]);

      // Interpolations
      const hciStart = allHtmlInterpolations.length;
      for (const i of he.interpolations ?? []) {
        allHtmlInterpolations.push(i);
      }
      heCi.push([hciStart, allHtmlInterpolations.length - hciStart]);
    }
  }

  // ────────────────────────────────────────────────────────
  // composables — остаётся как было
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
    compR.push(COMPOSABLE_RETURN_SHAPE_CODES[c.returnShape] ?? 0);
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

  // ────────────────────────────────────────────────────────
  // Сборка результата
  // ────────────────────────────────────────────────────────
  const result: VueSectionCompact = {
    sfc: {
      f: sfcF,
      n: sfcN,
      b: sfcB,
      c: sfcC,
      cs: sfcCS,
      pn: sfcPN,
      ps: sfcPS,
      en: sfcEN,
      es: sfcES,
      xn: sfcXN,
      xs: sfcXS,
      cu_sfc: rleArray(cuSfc),
      cu_tag: cuTag,
      cu_file: cuFile,
      cu_src: cuSrc,
      cu_pkg: cuPkg,
      cu_l: cuL,
      cu_col: cuCol,
      cu_cp: cuCp,
      cu_ce: cuCe,
      cu_cd: cuCd,
      cu_csl: cuCsl,
      he_sfc: rleArray(heSfc),
      he_tag: heTag,
      he_l: heL,
      he_col: heCol,
      he_cp: heCp,
      he_cd: heCd,
      he_ce: heCe,
      he_ci: heCi,
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
    // ✅ v16.0.0: component props/events/directives/slots/interpolations
    componentProps: encodeComponentPropsInline(allComponentProps, dict),
    componentEvents: encodeComponentEventsInline(allComponentEvents, dict),
    componentDirectives: encodeComponentDirectivesInline(allComponentDirectives, dict),
    componentSlots: encodeComponentSlotsInline(allComponentSlots, dict),
    htmlInterpolations: encodeHtmlInterpolationsInline(allHtmlInterpolations, dict),
  };

  return result;
}

// ============================================
// ✅ v16.0.0: inline-энкодеры подсекций vue.sfc
// ============================================

function encodeComponentPropsInline(
  props: ComponentProp[],
  dict: DictBuilder
): VueSectionCompact['componentProps'] {
  if (props.length === 0) return undefined;

  const n: number[] = [];
  const v: number[] = [];
  const k: number[] = [];
  const l: number[] = [];
  const id: number[] = [];
  const mc: number[] = [];
  const lv: number[] = [];
  const sc: [number, number, number?][] = [];
  const fns: number[] = [];

  for (const p of props) {
    n.push(addString(dict, p.name || ''));
    v.push(addString(dict, p.value || ''));
    k.push(PROP_KIND_CODES[p.kind] ?? 0);
    l.push(p.line ?? 0);
    id.push(addId(dict, p.id || ''));
    mc.push(p.memberChain ? addString(dict, p.memberChain.join('\u0002')) : -1);
    lv.push(p.literalValue !== undefined ? addString(dict, String(p.literalValue)) : -1);

    const scIdx = addSourceChain(dict, p.sourceChain || []);
    sc.push(scIdx >= 0 ? [scIdx, 1, 1] : [0, 0]);

    const firstFn = p.sourceChain?.[0]?.functionId;
    fns.push(firstFn ? -1 : -1); // резолвинг fn-id делает compact-reporter
  }

  return { n, v, k, l, id, mc, lv, sc, fns };
}

function encodeComponentEventsInline(
  events: ComponentEvent[],
  dict: DictBuilder
): VueSectionCompact['componentEvents'] {
  if (events.length === 0) return undefined;

  const n: number[] = [];
  const h: number[] = [];
  const fn: number[] = [];
  const s: number[] = [];
  const m: number[] = [];
  const l: number[] = [];
  const sc: [number, number, number?][] = [];

  for (const e of events) {
    n.push(addString(dict, e.eventName || ''));
    h.push(addString(dict, e.handler || ''));
    fn.push(-1); // резолвинг fn-id делает compact-reporter
    s.push(EVENT_HANDLER_SOURCE_CODES[e.handlerSource] ?? 4);
    m.push(e.modifiers?.length ? addString(dict, e.modifiers.join('\u0002')) : -1);
    l.push(e.line ?? 0);

    const scIdx = addSourceChain(dict, e.handlerChain || []);
    sc.push(scIdx >= 0 ? [scIdx, 1, 1] : [0, 0]);
  }

  return { n, h, fn, s, m, l, sc };
}

function encodeComponentDirectivesInline(
  dirs: ComponentDirective[],
  dict: DictBuilder
): VueSectionCompact['componentDirectives'] {
  if (dirs.length === 0) return undefined;

  const n: number[] = [];
  const a: number[] = [];
  const m: number[] = [];
  const v: number[] = [];
  const l: number[] = [];

  for (const d of dirs) {
    n.push(addString(dict, d.name || ''));
    a.push(d.argument ? addString(dict, d.argument) : -1);
    m.push(d.modifiers?.length ? addString(dict, d.modifiers.join('\u0002')) : -1);
    v.push(addString(dict, d.value || ''));
    l.push(d.line ?? 0);
  }

  return { n, a, m, v, l };
}

function encodeComponentSlotsInline(
  slots: ComponentSlot[],
  dict: DictBuilder
): VueSectionCompact['componentSlots'] {
  if (slots.length === 0) return undefined;

  const n: number[] = [];
  const sc: number[] = [];
  const sn: number[] = [];
  const l: number[] = [];

  for (const sl of slots) {
    n.push(addString(dict, sl.slotName || ''));
    sc.push(sl.isScoped ? 1 : 0);
    sn.push(sl.scopeNames?.length ? addString(dict, sl.scopeNames.join('\u0002')) : -1);
    l.push(sl.line ?? 0);
  }

  return { n, sc, sn, l };
}

function encodeHtmlInterpolationsInline(
  interps: HtmlInterpolation[],
  dict: DictBuilder
): VueSectionCompact['htmlInterpolations'] {
  if (interps.length === 0) return undefined;

  const e: number[] = [];
  const sc: [number, number, number?][] = [];
  const l: number[] = [];

  for (const i of interps) {
    e.push(addString(dict, i.expression || ''));
    const scIdx = addSourceChain(dict, i.sourceChain || []);
    sc.push(scIdx >= 0 ? [scIdx, 1, 1] : [0, 0]);
    l.push(i.line ?? 0);
  }

  return { e, sc, l };
}

// ============================================
// ✅ v16.0.0: TOP-LEVEL ENCODERS
// ============================================

/**
 * Аккумулятор для domApiArgs (собирается в encodeDomApiCalls,
 * потребляется в encodeDomApiArgs).
 */
const domApiArgsAccumulator: DomApiArg[] = [];

/**
 * ✅ v16.0.0: encode fnHtmlUsage.
 */
function encodeFnHtmlUsage(full: any, dict: DictBuilder): any {
  const fns = full.functions || [];
  if (fns.length === 0) return undefined;

  const fnIdx: number[] = [];
  const k: number[] = [];
  const u: number[] = [];
  const t: number[] = [];
  const tg: number[] = [];
  const l: number[] = [];
  const col: number[] = [];
  const dcat: number[] = [];
  const dctx: number[] = [];

  const fnIdMap = new Map<string, number>();
  fns.forEach((f: any, i: number) => {
    if (f.id) fnIdMap.set(f.id, i);
  });

  for (const f of fns) {
    const usages = f.htmlUsage || [];
    const fnId = fnIdMap.get(f.id) ?? -1;

    for (const ux of usages) {
      fnIdx.push(fnId);
      k.push(HTML_OUTPUT_KIND_CODES[ux.kind] ?? 0);
      u.push(ux.usageId ? addId(dict, ux.usageId) : -1);
      t.push(addString(dict, ux.tag || ''));
      tg.push(addString(dict, ux.target || ''));
      l.push(ux.line ?? 0);
      col.push(ux.column ?? -1);
      dcat.push(
        ux.domApiCategory ? (DOM_CATEGORY_CODES[ux.domApiCategory] ?? -1) : -1
      );
      dctx.push(
        ux.domApiContext ? addString(dict, JSON.stringify(ux.domApiContext)) : -1
      );
    }
  }

  if (fnIdx.length === 0) return undefined;
  return { fn: fnIdx, k, u, t, tg, l, col, dcat, dctx };
}

/**
 * ✅ v16.0.0: encode domApiCalls (top-level).
 */
function encodeDomApiCalls(full: any, dict: DictBuilder): any {
  const calls = full.domApiCalls || [];
  if (calls.length === 0) return undefined;

  const fnIdMap = new Map<string, number>();
  (full.functions || []).forEach((f: any, i: number) => {
    if (f.id) fnIdMap.set(f.id, i);
  });

  const fn: number[] = [];
  const f: [number, number, number?][] = [];
  const cat: number[] = [];
  const eff: number[] = [];
  const m: number[] = [];
  const t: number[] = [];
  const tk: number[] = [];
  const l: number[] = [];
  const col: number[] = [];
  const argSlices: [number, number][] = [];
  const en: number[] = [];
  const hfn: number[] = [];
  const hs: number[] = [];
  const sel: number[] = [];
  const hv: number[] = [];
  const cn: number[] = [];
  const sp: number[] = [];
  const an: number[] = [];
  const oo: number[] = [];

  for (const c of calls) {
    fn.push(fnIdMap.get(c.functionId) ?? -1);
    f.push([0, 0]);
    cat.push(DOM_CATEGORY_CODES[c.category] ?? 49);
    eff.push(DOM_EFFECT_CODES[c.effect] ?? 0);
    m.push(addString(dict, c.method || ''));
    t.push(addId(dict, c.target || ''));
    tk.push(DOM_TARGET_KIND_CODES[c.targetKind] ?? 6);
    l.push(c.line ?? 0);
    col.push(c.column ?? -1);

    const start = domApiArgsAccumulator.length;
    for (const arg of c.argResolutions || []) {
      domApiArgsAccumulator.push(arg);
    }
    argSlices.push([start, (c.argResolutions || []).length]);

    en.push(c.context?.eventName ? addString(dict, c.context.eventName) : -1);
    hfn.push(
      c.context?.handlerFunctionId ? (fnIdMap.get(c.context.handlerFunctionId) ?? -1) : -1
    );
    hs.push(
      c.context?.handlerSource
        ? (EVENT_HANDLER_SOURCE_CODES[c.context.handlerSource] ?? 4)
        : -1
    );
    sel.push(c.context?.cssSelector ? addString(dict, c.context.cssSelector) : -1);
    hv.push(c.context?.htmlValue ? addString(dict, c.context.htmlValue) : -1);
    cn.push(c.context?.className ? addString(dict, c.context.className) : -1);
    sp.push(c.context?.styleProp ? addString(dict, c.context.styleProp) : -1);
    an.push(c.context?.attributeName ? addString(dict, c.context.attributeName) : -1);
    oo.push(
      c.context?.observeOptions?.length
        ? addString(dict, c.context.observeOptions.join('\u0002'))
        : -1
    );
  }

  return { fn, f, cat, eff, m, t, tk, l, col, argSlices, en, hfn, hs, sel, hv, cn, sp, an, oo };
}

/**
 * ✅ v16.0.0: encode domApiArgs (top-level).
 */
function encodeDomApiArgs(_full: any, dict: DictBuilder): any {
  const args = domApiArgsAccumulator;
  if (args.length === 0) return undefined;

  const r: number[] = [];
  const k: number[] = [];
  const fn: number[] = [];
  const s: number[] = [];

  for (const a of args) {
    r.push(addString(dict, a.raw || ''));
    k.push(DOM_ARG_KIND_CODES[a.kind] ?? 3);
    fn.push(a.resolvedFunctionId ? addId(dict, a.resolvedFunctionId) : -1);
    s.push(
      a.resolvedSource ? (DOM_ARG_SOURCE_CODES[a.resolvedSource] ?? 3) : -1
    );
  }

  return { r, k, fn, s };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ENCODE
// ============================================

/**
 * Кодирует полный JSON в сжатый (v16.0.1).
 */
export function encode(
  payload: FullJSON,
  valuesMode: ValuesMode = 'relations'
): CompactJSON {
  const dict = createDictBuilder();
  domApiArgsAccumulator.length = 0; // ✅ v16.0.0: очистка

  // v14.0.0: канонизация
  const canonical = canonicalizeFullJSON(payload);

  // ============================================
  // 1. Индексы модулей
  // ============================================
  const modules = asArray<ModuleData>(canonical.modules);
  const moduleReverse = new Map<string, number>();
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    if (mod && mod.id) moduleReverse.set(mod.id, i);
  }

  // ============================================
  // 2. Индексы файлов
  // ============================================
  const files = asArray<FileData>(canonical.files);
  const fileReverse = new Map<string, number>();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file && file.id) fileReverse.set(file.id, i);
  }

  // ============================================
  // 3. Индексы функций
  // ============================================
  const functions = asArray<FunctionData>(canonical.functions);
  const functionReverse = new Map<string, number>();
  for (let i = 0; i < functions.length; i++) {
    const func = functions[i];
    if (func && func.id) functionReverse.set(func.id, i);
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
    if (!filesByModuleIdx.has(modIdx)) filesByModuleIdx.set(modIdx, []);
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
  //
  // ✅ v16.0.1: добавлен массив `fnsHv` — RLE для `isHtmlVisible` (0|1).
  // Это устраняет расхождение L1/L2/DL:
  //   $.functions[0].isHtmlVisible  a: undefined  b: false
  //
  // Схема (10 полей): n, m, f, l, fl, p, rt, parent, vk, hv
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
  const fnsHv: number[] = []; // ✅ v16.0.1

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

    const parentId = func.parentFunctionId;
    const parentIdx = parentId ? (functionReverse.get(parentId) ?? -1) : -1;
    fnsParent.push(parentIdx);

    const vk = func.vueKind ?? 'function';
    fnsVk.push(VUE_KIND_CODES[vk] ?? 0);

    // ✅ v16.0.1: isHtmlVisible → 0/1
    fnsHv.push(func.isHtmlVisible === true ? 1 : 0);
  }

  const fnsMRle = rle(fnsM);
  const fnsFRle = rle(fnsF);
  const fnsParentRle = rle(fnsParent);
  const fnsVkRle = rle(fnsVk);
  const fnsHvRle = rle(fnsHv); // ✅ v16.0.1

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

    if (valueIdx >= 0) cnNonEmptyV.push([i, valueIdx]);
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

  // ============================================
  // 11. gr.c — columnar
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
  // 12.5. Расширенные секции
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
  // 12.6.5. ✅ v16.0.0: новые top-level секции
  // ============================================
  const fnHtmlUsageData = encodeFnHtmlUsage(canonical as any, dict);
  const domApiCallsData = encodeDomApiCalls(canonical as any, dict);
  const domApiArgsData = encodeDomApiArgs(canonical as any, dict);

  // ============================================
  // 12.7. vue — Vue-сущности
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
        `(${(((dict.valueDict.length - finalValueDict.length) / dict.valueDict.length) * 100).toFixed(1)}% сжатие)`
      );
    }
  }

  // Переиндексация ссылок в extended-секциях
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
      hv: fnsHvRle, // ✅ v16.0.1
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

    vt: finalVt,
    lc: finalLc,
    ef: finalEf,
    inj: finalInj,
    rx: finalRx,
    cd: finalCd,
    ty: finalTy,
    tr: finalTr,

    lx: {
      p: lxP_Rle,
      c: lxC_Rle,
      r: lxR,
      l: lxL,
      ai: lxAi,
      cn: lxCn,
    },

    vue,

    // ✅ v16.0.0: новые top-level секции
    fnHtmlUsage: fnHtmlUsageData,
    domApiCalls: domApiCallsData,
    domApiArgs: domApiArgsData,
    ids: dict.idDict.length > 0 ? dict.idDict : undefined,
    sourceChains: dict.sourceChainDict.length > 0 ? dict.sourceChainDict : undefined,

    st: canonical.statistics,
    legend,
  };

  // ============================================
  // Токенизация словарей
  // ============================================
  const allStrings = [...dict.stringDict, ...dict.paramDict, ...dict.methodDict];
  const tokens = buildTokenDict(allStrings);
  const tokenIndex = new Map(tokens.map((t, i) => [t, i]));

  compact.tokens = tokens;
  compact.strs = dict.stringDict.map(s => encodeStr(s, tokenIndex));
  compact.params = dict.paramDict.map(s => encodeStr(s, tokenIndex));
  compact.methods = dict.methodDict.map(s => encodeStr(s, tokenIndex));

  // ============================================
  // Удаление пустых опциональных секций
  // ============================================
  const OPTIONAL_SECTIONS: (keyof CompactJSON)[] = [
    'vt', 'lc', 'ef', 'inj', 'rx', 'cd', 'ty', 'tr', 'vue',
    'fnHtmlUsage', 'domApiCalls', 'domApiArgs', 'ids', 'sourceChains',
  ];

  for (const key of OPTIONAL_SECTIONS) {
    const v = (compact as any)[key];
    if (v === undefined || v === null) continue;

    if (Array.isArray(v) && v.length === 0) {
      delete (compact as any)[key];
      continue;
    }

    if (key === 'vue' && typeof v === 'object') {
      const allEmpty =
        (v.sfc?.f?.length ?? 0) === 0 &&
        (v.composables?.n?.length ?? 0) === 0 &&
        (v.macros?.f?.length ?? 0) === 0 &&
        (v.hooks?.f?.length ?? 0) === 0 &&
        (v.reactivity?.f?.length ?? 0) === 0 &&
        (v.icons?.f?.length ?? 0) === 0;
      if (allEmpty) delete (compact as any)[key];
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
  addId,
  addSourceChain,
  rleArray,
  reverseLookup,
  asArray,
  // ✅ v15.2.0 (P1)
  LEXICAL_RELATION_CODES,
  // ✅ v15.3.0 (P2)
  CALL_KIND_CODES,
  // ✅ v15.5.0
  VUE_KIND_CODES_LOCAL,
  encodeVueSection,
};
