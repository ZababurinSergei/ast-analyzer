// ============================================================================
// AST ANALYZER — CODEC v10.3
// Кодирование/декодирование между полным и компактным форматами.
//
//   Full    (index.full.json) — развёрнутый, читаемый, с длинными ключами
//   Compact (index.json)      — короткие ключи, tuple-массивы, словари строк
//
// Публичный API (совместим с TS-версией v9.0.x):
//
//   // --- Фасад ---
//   Codec.encode(full, opts?)         → compact
//   Codec.decode(compact, opts?)      → full
//   Codec.verifyRoundTrip(full)       → { ok, error?, details? }
//   Codec.verifyRoundTripBoth(f, c)   → ReversibilityReport
//   Codec.getCompactSize(compact)     → number
//   Codec.getFullSize(full)           → number
//   Codec.getCompressionRatio(full)   → number
//   Codec.stringify(compact, pretty?) → string
//   Codec.parse(json)                 → compact
//   Codec.getLegend()                 → legend
//   Codec.buildEdges(full)            → edges[]
//   Codec.buildEdgesStats(edges)      → stats
//
//   // --- Прямые функции ---
//   decodeCompactData(compact, opts?) → full
//   encodeToCompactData(full, opts?)  → compact
//   roundTripSemantic(compact)        → { ok, diff }
//   roundTripByteExact(compact)       → { ok, diff }
//   roundTripEncode(full)             → { ok, diff }
//   detectFormat(json)                → 'compact' | 'full' | 'unknown'
//   toFullData(json)                  → full
//   verifyRoundTrip(full, opts?)      → { ok, error?, details? }
//   verifyRoundTripBoth(full, compact)→ ReversibilityReport
//   collectDiffs(a, b, path?, limit?) → Diff[]
//   deepEqual(a, b)                   → boolean
//   normalizeForDiff(value)           → string
//
//   // --- Edges ---
//   buildEdgesFromFull(full)          → { edges, stats }
//   buildEdgesFromCompact(compact)    → { edges, stats }
//
//   // --- Флаги ---
//   encodeFlags(obj)                  → number
//   flagsToString(flags)              → string
//   decodeFlagsToObject(flagStr)      → DecodedFlags
//   flagsStringToNumber(flagStr)      → number
//   createEmptyFlags()                → DecodedFlags
//
//   // --- Словари ---
//   FLAG_MAP, FLAG_CHAR_MAP, FLAG_NAMES
//   RELATION_TYPES, EXPORT_TYPES, IMPORT_TYPES
//   CALL_TYPES, RE_EXPORT_TYPES
//   LIFECYCLE_TYPES, EFFECT_TYPES, INJECTION_TYPES
//   REACTIVITY_TYPES, CONDITIONAL_TYPES
//   TYPE_KINDS, TYPE_USAGE_KINDS
//
//   // --- Версия ---
//   CODEC_VERSION
//
// Изменения v10.3 (текущая версия):
//   - ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: симметрия для type-only импортов.
//
//       В encodeToCompactData (gr.i): код типа импорта теперь вычисляется
//       через i.isTypeOnly (приоритет) → 'to', иначе rev(IMPORT_TYPES, i.type).
//       Раньше при i.type='named' + i.isTypeOnly=true encoder терял флаг
//       isTypeOnly, и decode восстанавливал type='named' вместо 'type-only'.
//
//       Раньше:
//         rev(IMPORT_TYPES, i.type, 'n')
//       Теперь:
//         i.isTypeOnly ? 'to' : rev(IMPORT_TYPES, i.type, 'n')
//
//       В decodeCompactData (gr.i): isTypeOnly восстанавливается из кода 'to'.
//
//       Симптом: L1/L2/DL падали с расхождениями:
//         $.imports[N].type: a="type-only", b="named"
//       на 26 импортах.
//
//   - ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: пустые секции в decodeCompactData.
//
//       Раньше decodeCompactData всегда создавал в out все секции
//       (classes: [], constants: [], exports: [], imports: [], ...),
//       даже если в compact их не было. Это приводило к расхождению
//       с full.json, где collectFullJSON (compact-reporter.ts) пустые
//       секции записывает как undefined.
//
//       Симптом: L1/L2/DL падали с расхождением:
//         $.classes: a=[], b=undefined
//
//       Теперь в конце decodeCompactData удаляются те секции,
//       которых нет в compact: cls → classes, cn → constants,
//       gr.e → exports, gr.i → imports, gr.c → calls, gr.re → reExports,
//       vt → templates, cd → conditionals, lc → lifecycle,
//       ef → effects, inj → injections, rx → reactivity,
//       ty → types, tr → typeRefs.
//
//   - ✅ CODEC_VERSION: '10.2' → '10.3'
//
// Изменения v10.2:
//   - ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: в encodeToCompactData блок gr.c —
//       для external-вызовов сохраняется РЕАЛЬНЫЙ тип вызова
//       (direct / async / method / callback), а НЕ принудительный 'direct'.
//       Признак external передаётся отдельным 5-м полем кортежа gr.c
//       (isExternal), поэтому нет причин терять исходный тип.
//
//       Раньше (v10.0–v10.1):
//         rev(CALL_TYPES, isExt ? 'direct' : c.type, 'd')
//       Теперь:
//         rev(CALL_TYPES, c.type, 'd')
//
//       Симптом: L1_semantic и L3_byteExact падали с расхождениями
//         $.calls[N].type: a="async"/"callback", b="direct"
//         $.gr.c[N][3]:  a="a"/"c",               b="d"
//   - ✅ Обновлён JSDoc-комментарий к CALL_TYPES: пояснение, что тип
//       вызова и признак external — ОРТОГОНАЛЬНЫ.
//   - ✅ CODEC_VERSION: '10.1' → '10.2'
//
// Изменения v10.1:
//   - ✅ decodeCompactData(compact, options):
//       options.includeEdges (по умолчанию false) — если true, добавляет
//       в результат full.edges, восстановленный из gr.i + gr.e + gr.c + gr.re.
//       По умолчанию edges НЕ восстанавливаются — это устраняет расхождение
//       при DL (decode(encode(full)) === full), когда исходный full не
//       содержит edges (как и должно быть по спецификации v9.0.x).
//   - ✅ encodeToCompactData(full, options):
//       options.includeEdges (по умолчанию false) — игнорируется.
//       Поле full.edges никогда не кодируется (производное).
//   - ✅ НОВЫЕ ФУНКЦИИ:
//       buildEdgesFromFull(full)    → { edges, stats }
//       buildEdgesFromCompact(compact) → { edges, stats }
//       — собирают агрегированный массив edges из соответствующих секций.
//         Используются для отдельного файла *.edges.json в compact-reporter.ts.
//   - ✅ Codec.buildEdges(full) и Codec.buildEdgesStats(edges) — фасад.
//
// Изменения v10.0:
//   - ✅ 18 битов флагов (как в TS v9.0.x): a e m r v n s d c x t A l y g p P S
//   - ✅ gr.e: 12 полей (isStarReExport, isDefaultReExport)
//   - ✅ gr.c: 5 полей (isExternal)
//   - ✅ mi.mN.p: всегда (если path есть)
//   - ✅ effects (ef): чтение + запись
//   - ✅ Полная поддержка lifecycle / injections / reactivity /
//        conditionals / types / typeRefs / templates
//   - ✅ Экспорт всех словарей
//   - ✅ Экспорт Codec (фасад)
//   - ✅ verifyRoundTrip, verifyRoundTripBoth, collectDiffs,
//        normalizeForDiff, getCompactSize, getFullSize,
//        getCompressionRatio, stringify, parse
//   - ✅ decodeFlagsToObject, flagsStringToNumber, createEmptyFlags
//   - ✅ Сохранены обратно-совместимые API v9.4:
//        decodeCompactData, encodeToCompactData, roundTripSemantic,
//        roundTripByteExact, roundTripEncode, detectFormat, toFullData
//
// ============================================================================
//
// Изменения в этой версии (интеграция с ast-analyzer-utils.js):
//   - ✅ УБРАНЫ ДУБЛИ: deepEqual, diffObjects, collectDiffs, normalizeForDiff,
//       arrayEq, idToNum, stripServiceFields, stripForByteCompare
//       теперь импортируются из './ast-analyzer-utils.js' — единый источник.
//   - ✅ Реэкспорт утилит для обратной совместимости (Codec.__internals,
//       прямые экспорты).
// ============================================================================

import {
  deepEqual,
  diffObjects,
  collectDiffs,
  normalizeForDiff,
  arrayEq,
  idToNum,
  stripServiceFields,
  stripForByteCompare,
} from './ast-analyzer-utils.js';

// Реэкспортируем утилиты для обратной совместимости:
// любой, кто импортировал их из codec, продолжит работать.
export {
  deepEqual,
  diffObjects,
  collectDiffs,
  normalizeForDiff,
  arrayEq,
  idToNum,
  stripServiceFields,
  stripForByteCompare,
};

// ---------------------------------------------------------------------------
// ВЕРСИЯ
// ---------------------------------------------------------------------------
export const CODEC_VERSION = '10.3';

// ---------------------------------------------------------------------------
// СЛОВАРИ (экспортируемые)
// ---------------------------------------------------------------------------

/** Карта флагов: бит → символ. */
export const FLAG_MAP = {
  1: 'a', // async
  2: 'e', // exported
  4: 'm', // method
  8: 'r', // arrow
  16: 'v', // event handler
  32: 'n', // nested
  64: 's', // self
  128: 'd', // dynamic
  256: 'c', // config
  512: 'x', // external
  1024: 't', // vue template
  2048: 'A', // async chain
  4096: 'l', // closure
  8192: 'y', // type dep
  16384: 'g', // generator
  32768: 'p', // private
  65536: 'P', // protected
  131072: 'S', // static
};

/** Обратная карта: символ → бит. */
export const FLAG_CHAR_MAP = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([bit, char]) => [char, parseInt(bit, 10)])
);

/** Имена флагов: бит → имя. */
export const FLAG_NAMES = {
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

export const RELATION_TYPES = {
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

export const EXPORT_TYPES = { ne: 'named', de: 'default', te: 'type', re: 're-export' };
export const IMPORT_TYPES = { n: 'named', df: 'default', ns: 'namespace', to: 'type-only' };

/**
 * Типы вызовов.
 *
 * ✅ v10.2: тип вызова (direct / async / method / callback) и признак
 * external (isExternal, 5-е поле gr.c) — ОРТОГОНАЛЬНЫ. Тип сохраняется
 * для ВСЕХ вызовов, включая external. Это устраняет потерю типа
 * (async / callback / method) для external-вызовов.
 *
 * Раньше (v10.0–v10.1) для external-вызовов тип принудительно
 * заменялся на 'direct', что приводило к ошибкам L1_semantic и
 * L3_byteExact в verify-roundtrip.ts.
 */
export const CALL_TYPES = { d: 'direct', a: 'async', m: 'method', c: 'callback' };

export const RE_EXPORT_TYPES = { n: 'named', df: 'default', all: 'all' };

export const LIFECYCLE_TYPES = {
  m: 'onMounted',
  u: 'onUnmounted',
  s: 'onScopeDispose',
  a: 'onActivated',
  d: 'onDeactivated',
  w: 'watch',
  W: 'watchEffect',
  e: 'onErrorCaptured',
};

export const EFFECT_TYPES = {
  t: 'timer',
  c: 'cleanup',
  p: 'promise',
  e: 'event',
  s: 'subscription',
};

export const INJECTION_TYPES = { p: 'provide', i: 'inject' };

export const REACTIVITY_TYPES = {
  c: 'computed',
  w: 'watch',
  W: 'watchEffect',
  r: 'ref',
  R: 'reactive',
  S: 'shallowRef',
  o: 'readonly',
};

export const CONDITIONAL_TYPES = { i: 'v-if', e: 'v-else-if', E: 'v-else' };

export const TYPE_KINDS = { i: 'interface', t: 'type-alias', e: 'enum', c: 'class' };

export const TYPE_USAGE_KINDS = {
  p: 'param',
  r: 'return',
  f: 'field',
  g: 'generic',
  u: 'union',
  x: 'extends',
};

// ---------------------------------------------------------------------------
// ФЛАГИ
// ---------------------------------------------------------------------------

/**
 * Создаёт «пустой» объект флагов (все false).
 */
export function createEmptyFlags() {
  return {
    isAsync: false,
    isExported: false,
    isMethod: false,
    isArrow: false,
    isEventHandler: false,
    isNested: false,
    isSelf: false,
    isDynamic: false,
    isConfig: false,
    isExternal: false,
    isVueTemplate: false,
    isAsyncChain: false,
    isClosure: false,
    isTypeDep: false,
    isGenerator: false,
    isPrivate: false,
    isProtected: false,
    isStatic: false,
  };
}

/**
 * Кодирует булевы флаги функции/класса/константы в число.
 */
export function encodeFlags(obj) {
  let flags = 0;
  if (!obj) return 0;
  if (obj.isAsync) flags |= 1;
  if (obj.isExported) flags |= 2;
  if (obj.isMethod) flags |= 4;
  if (obj.isArrow) flags |= 8;
  if (obj.isEventHandler) flags |= 16;
  if (obj.isNested) flags |= 32;
  if (obj.isSelf) flags |= 64;
  if (obj.isDynamic) flags |= 128;
  if (obj.isConfig) flags |= 256;
  if (obj.isExternal) flags |= 512;
  if (obj.isVueTemplate) flags |= 1024;
  if (obj.isAsyncChain) flags |= 2048;
  if (obj.isClosure) flags |= 4096;
  if (obj.isTypeDep) flags |= 8192;
  if (obj.isGenerator) flags |= 16384;
  if (obj.isPrivate) flags |= 32768;
  if (obj.isProtected) flags |= 65536;
  if (obj.isStatic) flags |= 131072;
  return flags;
}

/**
 * Кодирует число флагов в строку символов.
 */
export function flagsToString(flags) {
  if (flags === 0) return '0';
  let result = '';
  for (const [bitStr, char] of Object.entries(FLAG_MAP)) {
    if (flags & parseInt(bitStr, 10)) {
      result += char;
    }
  }
  return result || '0';
}

/**
 * Декодирует строку символов в число флагов.
 */
export function flagsStringToNumber(flagStr) {
  if (!flagStr || flagStr === '0') return 0;
  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }
  return flags;
}

/**
 * Декодирует строку символов в объект с булевыми полями (все 18).
 */
export function decodeFlagsToObject(flagStr) {
  const result = createEmptyFlags();
  if (!flagStr || flagStr === '0') return result;
  const flags = flagsStringToNumber(flagStr);
  result.isAsync = !!(flags & 1);
  result.isExported = !!(flags & 2);
  result.isMethod = !!(flags & 4);
  result.isArrow = !!(flags & 8);
  result.isEventHandler = !!(flags & 16);
  result.isNested = !!(flags & 32);
  result.isSelf = !!(flags & 64);
  result.isDynamic = !!(flags & 128);
  result.isConfig = !!(flags & 256);
  result.isExternal = !!(flags & 512);
  result.isVueTemplate = !!(flags & 1024);
  result.isAsyncChain = !!(flags & 2048);
  result.isClosure = !!(flags & 4096);
  result.isTypeDep = !!(flags & 8192);
  result.isGenerator = !!(flags & 16384);
  result.isPrivate = !!(flags & 32768);
  result.isProtected = !!(flags & 65536);
  result.isStatic = !!(flags & 131072);
  return result;
}

// ---------------------------------------------------------------------------
// СЛУЖЕБНЫЕ КЛАССЫ ДЛЯ СБОРКИ СЛОВАРЕЙ
// ---------------------------------------------------------------------------

class DictBuilder {
  constructor() {
    this.map = new Map();
    this.list = [];
  }
  add(value) {
    if (value === null || value === undefined || value === '') return -1;
    const key = String(value);
    if (this.map.has(key)) return this.map.get(key);
    const idx = this.list.length;
    this.list.push(key);
    this.map.set(key, idx);
    return idx;
  }
}

class ValueDictBuilder {
  constructor() {
    this.map = new Map();
    this.list = [];
  }
  add(value) {
    if (value === null || value === undefined) return -1;
    const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (this.map.has(key)) return this.map.get(key);
    const idx = this.list.length;
    this.list.push(value);
    this.map.set(key, idx);
    return idx;
  }
}

class FrozenDictBuilder {
  constructor(initialList, strict = false) {
    this.list = (initialList || []).slice();
    this.map = new Map();
    this.strict = strict;
    for (let i = 0; i < this.list.length; i++) this.map.set(this.list[i], i);
  }
  add(value) {
    if (value === null || value === undefined || value === '') return -1;
    const key = String(value);
    if (this.map.has(key)) return this.map.get(key);
    if (this.strict) {
      throw new Error(`FrozenDictBuilder: значение "${key}" отсутствует в исходном словаре.`);
    }
    const idx = this.list.length;
    this.list.push(key);
    this.map.set(key, idx);
    return idx;
  }
}

class FrozenValueDictBuilder {
  constructor(initialList, strict = false) {
    this.list = (initialList || []).slice();
    this.map = new Map();
    this.strict = strict;
    for (let i = 0; i < this.list.length; i++) {
      const v = this.list[i];
      const key = typeof v === 'object' ? JSON.stringify(v) : String(v);
      this.map.set(key, i);
    }
  }
  add(value) {
    if (value === null || value === undefined) return -1;
    const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (this.map.has(key)) return this.map.get(key);
    if (this.strict) {
      throw new Error(`FrozenValueDictBuilder: значение "${key}" отсутствует в исходном словаре.`);
    }
    const idx = this.list.length;
    this.list.push(value);
    this.map.set(key, idx);
    return idx;
  }
}

// ---------------------------------------------------------------------------
// ДЕКОДИРОВАНИЕ: compact → full
// ---------------------------------------------------------------------------

/**
 * Декодирует компактный JSON в полный.
 *
 * @param {object} compact — компактный JSON (index.json)
 * @param {object} [options]
 * @param {boolean} [options.includeEdges=false] — если true, добавляет
 *   в результат поле `edges`, восстановленное из gr.i + gr.e + gr.c + gr.re.
 *   По умолчанию false — это соответствует поведению TS-версии v9.0.4+
 *   и устраняет расхождение при DL (decode(encode(full)) === full),
 *   когда исходный full не содержит edges.
 * @returns {object} — полный JSON (index.full.json)
 */
export function decodeCompactData(compact, options = {}) {
  if (!compact || typeof compact !== 'object') {
    throw new Error('decodeCompactData: ожидается объект');
  }

  const { includeEdges = false } = options;

  const legend = compact.legend || {};
  const S = legend.stringDict || [];
  const P = legend.paramDict || [];
  const V = legend.valueDict || [];

  const str = i => (i === -1 || i == null ? '' : (S[i] ?? ''));
  const par = i => (i === -1 || i == null ? '' : (P[i] ?? ''));
  const val = i => (i === -1 || i == null ? undefined : V[i]);
  const code = (map, c, fb) => map[c] || c || fb || '';

  const moduleList = Object.keys(compact.mi || {});
  const fileList = Object.keys(compact.fl || {});
  const funcList = (compact.fns || []).map(a => a[0]);

  const moduleByIdx = i => (i == null || i <= 0 ? '' : (moduleList[i - 1] ?? ''));
  const fileByIdx = i => (i == null || i <= 0 ? '' : (fileList[i - 1] ?? ''));
  const funcByIdx = i => (i == null || i <= 0 ? '' : (funcList[i - 1] ?? ''));
  const strByIdx = i => (i == null || i < 0 ? '' : (S[i] ?? ''));

  const out = {
    version: compact.v || compact.version || '?',
    timestamp: compact.ts || compact.timestamp || '',
    root: compact.r || compact.root || '',
    modules: [],
    files: [],
    functions: [],
    classes: [],
    constants: [],
    exports: [],
    imports: [],
    calls: [],
    reExports: [],
    templates: [],
    statistics: compact.st || compact.statistics || {},
    conditionals: [],
    lifecycle: [],
    effects: [],
    injections: [],
    reactivity: [],
    types: [],
    typeRefs: [],
    legend: legend,
  };

  // ---- modules ----
  if (compact.mi) {
    out.modules = Object.entries(compact.mi).map(([id, m]) => ({
      id,
      name: m.n || '',
      path: m.p || m.n || '',
      fileIds: m.f || [],
    }));
  }

  // ---- files ----
  if (compact.fl) {
    out.files = Object.entries(compact.fl).map(([id, f]) => ({
      id,
      path: f.p || '',
      moduleId: f.m || '',
    }));
  }

  // ---- functions (18 флагов) ----
  if (compact.fns) {
    out.functions = compact.fns.map(a => {
      const fl = decodeFlagsToObject(a[5]);
      const fn = {
        id: a[0],
        name: a[1],
        moduleId: a[2],
        fileId: a[3],
        line: a[4],
        isExported: fl.isExported,
        isAsync: fl.isAsync,
        isArrow: fl.isArrow,
        isMethod: fl.isMethod,
        params: (a[6] || []).map(par),
        returnType: str(a[7]),
      };
      if (fl.isEventHandler) fn.isEventHandler = true;
      if (fl.isNested) fn.isNested = true;
      if (fl.isSelf) fn.isSelf = true;
      if (fl.isDynamic) fn.isDynamic = true;
      if (fl.isConfig) fn.isConfig = true;
      if (fl.isExternal) fn.isExternal = true;
      if (fl.isVueTemplate) fn.isVueTemplate = true;
      if (fl.isAsyncChain) fn.isAsyncChain = true;
      if (fl.isClosure) fn.isClosure = true;
      if (fl.isTypeDep) fn.isTypeDep = true;
      if (fl.isGenerator) fn.isGenerator = true;
      if (fl.isPrivate) fn.isPrivate = true;
      if (fl.isProtected) fn.isProtected = true;
      if (fl.isStatic) fn.isStatic = true;
      return fn;
    });
  }

  // ---- classes ----
  if (compact.cls) {
    out.classes = compact.cls.map(a => {
      const fl = decodeFlagsToObject(a[5]);
      const cls = {
        id: a[0],
        name: a[1],
        moduleId: a[2],
        fileId: a[3],
        line: a[4],
        isExported: fl.isExported,
        methods: (a[6] || []).map(x => str(x)),
      };
      if (fl.isPrivate) cls.isPrivate = true;
      if (fl.isProtected) cls.isProtected = true;
      if (fl.isStatic) cls.isStatic = true;
      return cls;
    });
  }

  // ---- constants ----
  if (compact.cn) {
    out.constants = compact.cn.map(a => {
      const fl = decodeFlagsToObject(a[5]);
      const cn = {
        id: a[0],
        name: a[1],
        moduleId: a[2],
        fileId: a[3],
        line: a[4],
        isExported: fl.isExported,
        value: val(a[6]),
      };
      if (fl.isPrivate) cn.isPrivate = true;
      if (fl.isProtected) cn.isProtected = true;
      return cn;
    });
  }

  // ---- graph ----
  if (compact.gr) {
    // exports: 12 полей
    if (compact.gr.e) {
      out.exports = compact.gr.e.map((a, i) => ({
        id: `e${i + 1}`,
        moduleId: moduleByIdx(a[0]),
        fileId: fileByIdx(a[1]),
        functionId: a[2] != null && a[2] > 0 ? funcByIdx(a[2]) : undefined,
        line: a[3],
        type: code(EXPORT_TYPES, a[4], 'named'),
        exportName: str(a[5]),
        localName: str(a[6]),
        isTypeOnly: !!a[7],
        isReExport: !!a[8],
        source: str(a[9]),
        isStarReExport: !!a[10],
        isDefaultReExport: !!a[11],
      }));
    }

    // imports: 8 полей
    // ✅ v10.3: isTypeOnly восстанавливается из кода 'to'.
    if (compact.gr.i) {
      out.imports = compact.gr.i.map((a, i) => {
        const isExternal = !!a[7];
        const toNumRaw = a[1];
        const resolvedToFileId = isExternal ? '' : fileByIdx(toNumRaw);
        const importTypeCode = a[6];
        const isTypeOnly = importTypeCode === 'to';
        return {
          id: `i${i + 1}`,
          fromFileId: fileByIdx(a[0]),
          toFileId: resolvedToFileId,
          __rawToFileNum: toNumRaw != null && toNumRaw > 0 ? toNumRaw : undefined,
          source: str(a[2]),
          importedName: str(a[3]),
          localName: str(a[4]),
          line: a[5],
          type: code(IMPORT_TYPES, importTypeCode, 'named'),
          isTypeOnly,
          isExternal,
        };
      });
    }

    // calls: 5 полей (fromIdx, toIdx, line, typeCode, isExternal)
    if (compact.gr.c) {
      out.calls = compact.gr.c.map((a, i) => {
        const isExternal = a[4] === 1;
        const toIdx = a[1];
        return {
          id: `c${i + 1}`,
          fromFunctionId: funcByIdx(a[0]),
          toFunctionId: isExternal ? strByIdx(toIdx) : funcByIdx(toIdx),
          line: a[2],
          type: code(CALL_TYPES, a[3], 'direct'),
        };
      });
    }

    // reExports: 7 полей
    if (compact.gr.re) {
      out.reExports = compact.gr.re.map((a, i) => ({
        id: `re${i + 1}`,
        moduleId: moduleByIdx(a[0]),
        functionId: a[1] != null && a[1] > 0 ? funcByIdx(a[1]) : undefined,
        source: str(a[2]),
        exportName: str(a[3]),
        line: a[4],
        type: code(RE_EXPORT_TYPES, a[5], 'named'),
        isTypeOnly: !!a[6],
      }));
    }
  }

  // ---- templates ----
  if (compact.vt) {
    out.templates = compact.vt.map(a => ({
      fileId: fileByIdx(a[0]),
      moduleId: moduleByIdx(a[1]),
      complexity: a[2] || 0,
      reactivityDeps: (a[3] || []).map(str),
      eventHandlers: (a[4] || []).map(ev => ({
        eventName: str(ev[0]),
        handlerName: str(ev[1]),
        tag: str(ev[2]),
        line: ev[3],
        modifiers: (ev[4] || []).map(str),
        isExternal: !!ev[5],
      })),
      dynamicComponents: (a[5] || []).map(dc => ({
        isExpression: str(dc[0]),
        line: dc[1],
        resolvedComponents: (dc[2] || []).map(str),
      })),
      directives: (a[6] || []).map(str),
      usedComponents: (a[7] || []).map(str),
      templateRefs: (a[8] || []).map(tr => ({
        refValue: str(tr[0]),
        tag: str(tr[1]),
        line: tr[2],
        exposedMethods: (tr[3] || []).map(str),
      })),
      cssVariables: (a[9] || []).map(cv => ({
        name: str(cv[0]),
        value: str(cv[1]),
        line: cv[2],
        isMultiline: !!cv[3],
      })),
      deepSelectors: (a[10] || []).map(ds => ({
        selector: str(ds[0]),
        line: ds[1],
      })),
      slots: (a[11] || []).map(str),
    }));
  }

  // ---- lifecycle ----
  if (compact.lc) {
    out.lifecycle = compact.lc.map((a, i) => ({
      id: `lc${i + 1}`,
      hookName: code(LIFECYCLE_TYPES, a[0], a[0]),
      functionId: funcByIdx(a[1]) || undefined,
      line: a[2],
      callbackFunctionId: funcByIdx(a[3]) || undefined,
      isSetupContext: a[4] === 's',
    }));
  }

  // ---- effects (ef) ----
  if (compact.ef) {
    out.effects = compact.ef.map((a, i) => ({
      id: `ef${i + 1}`,
      effectType: code(EFFECT_TYPES, a[0], a[0]),
      functionId: funcByIdx(a[1]) || undefined,
      line: a[2],
      targetName: str(a[3]),
      metaValue: a[4] >= 0 ? str(a[4]) : undefined,
    }));
  }

  // ---- injections ----
  if (compact.inj) {
    out.injections = compact.inj.map((a, i) => ({
      id: `in${i + 1}`,
      kind: code(INJECTION_TYPES, a[0], a[0]),
      fileId: fileByIdx(a[1]),
      line: a[2],
      key: str(a[3]),
      isSymbolKey: (a[4] & 1) !== 0,
      hasDefault: (a[4] & 2) !== 0,
    }));
  }

  // ---- reactivity ----
  if (compact.rx) {
    out.reactivity = compact.rx.map((a, i) => ({
      id: `rx${i + 1}`,
      kind: code(REACTIVITY_TYPES, a[0], a[0]),
      functionId: funcByIdx(a[1]) || undefined,
      line: a[2],
      reads: (a[3] || []).map(str),
      writes: (a[4] || []).map(str),
      isWriteable: a[5] === 1,
    }));
  }

  // ---- conditionals ----
  if (compact.cd) {
    out.conditionals = compact.cd.map((a, i) => ({
      id: `cd${i + 1}`,
      directive: code(CONDITIONAL_TYPES, a[0], a[0]),
      fileId: fileByIdx(a[1]),
      line: a[2],
      conditionExpression: a[3] >= 0 ? str(a[3]) : undefined,
      renderedComponent: a[4] >= 0 ? str(a[4]) : undefined,
    }));
  }

  // ---- types ----
  if (compact.ty) {
    out.types = compact.ty.map((a, i) => ({
      id: `t${i + 1}`,
      kind: code(TYPE_KINDS, a[0], a[0]),
      name: str(a[1]),
      moduleId: moduleByIdx(a[2]),
      fileId: fileByIdx(a[3]),
      line: a[4],
      members: (a[5] || []).map(str),
      extendsTypes: (a[6] || []).map(str),
    }));
  }

  // ---- typeRefs ----
  if (compact.tr) {
    out.typeRefs = compact.tr.map((a, i) => ({
      id: `tr${i + 1}`,
      typeName: str(a[0]),
      moduleId: moduleByIdx(a[1]),
      fileId: fileByIdx(a[2]),
      line: a[3],
      usageKind: code(TYPE_USAGE_KINDS, a[4], a[4]),
    }));
  }

  // ---- СЛУЖЕБНЫЕ ПОЛЯ ДЛЯ СИММЕТРИИ ----
  out.__codec = {
    stringDict: S.slice(),
    paramDict: P.slice(),
    valueDict: V.slice(),
    legend: JSON.parse(JSON.stringify(legend)),
  };

  // ============================================
  // ✅ v10.3: удаляем пустые секции, которых не было в compact.
  // ============================================
  // collectFullJSON (compact-reporter.ts) пустые секции записывает
  // как undefined, а не []. Чтобы DL (decode(encode(full)) === full)
  // не падал с расхождением "$.classes: a=[] b=undefined",
  // удаляем секции, для которых в compact нет соответствующего ключа.
  //
  // Соответствие compact ↔ full:
  //   compact.cls  → full.classes
  //   compact.cn   → full.constants
  //   compact.gr.e → full.exports
  //   compact.gr.i → full.imports
  //   compact.gr.c → full.calls
  //   compact.gr.re → full.reExports
  //   compact.vt   → full.templates
  //   compact.cd   → full.conditionals
  //   compact.lc   → full.lifecycle
  //   compact.ef   → full.effects
  //   compact.inj  → full.injections
  //   compact.rx   → full.reactivity
  //   compact.ty   → full.types
  //   compact.tr   → full.typeRefs
  // ============================================
  if (!compact.cls) delete out.classes;
  if (!compact.cn) delete out.constants;
  if (!compact.gr || !compact.gr.e) delete out.exports;
  if (!compact.gr || !compact.gr.i) delete out.imports;
  if (!compact.gr || !compact.gr.c) delete out.calls;
  if (!compact.gr || !compact.gr.re) delete out.reExports;
  if (!compact.vt) delete out.templates;
  if (!compact.cd) delete out.conditionals;
  if (!compact.lc) delete out.lifecycle;
  if (!compact.ef) delete out.effects;
  if (!compact.inj) delete out.injections;
  if (!compact.rx) delete out.reactivity;
  if (!compact.ty) delete out.types;
  if (!compact.tr) delete out.typeRefs;

  // ============================================
  // ✅ v10.1: edges — восстанавливаются ТОЛЬКО если includeEdges === true
  // ============================================
  // По умолчанию edges НЕ восстанавливаются — это производное поле,
  // которое можно собрать из gr.i + gr.e + gr.c + gr.re.
  //
  // Если edges нужны (например, для отдельного файла *.edges.json) —
  // передайте { includeEdges: true } в options.
  // ============================================
  if (includeEdges) {
    const { edges, stats } = buildEdgesFromFull(out);
    out.edges = edges;
    out.edgesStats = stats;
  }

  return out;
}

// ---------------------------------------------------------------------------
// КОДИРОВАНИЕ: full → compact
// ---------------------------------------------------------------------------

export function encodeToCompactData(full, options = {}) {
  if (!full || typeof full !== 'object') {
    throw new Error('encodeToCompactData: ожидается объект');
  }

  const { reuseDicts = false, strict = false, omitEmpty = true } = options;

  let S, P, VD;
  if (reuseDicts && full.__codec) {
    S = new FrozenDictBuilder(full.__codec.stringDict, strict);
    P = new FrozenDictBuilder(full.__codec.paramDict, strict);
    VD = new FrozenValueDictBuilder(full.__codec.valueDict, strict);
  } else {
    S = new DictBuilder();
    P = new DictBuilder();
    VD = new ValueDictBuilder();
  }

  const rev = (map, name, fb) => {
    for (const [k, v] of Object.entries(map)) if (v === name) return k;
    return fb || name;
  };

  const mi = id => idToNum(id);
  const fi = id => idToNum(id);
  const fni = id => idToNum(id);

  const si = v => S.add(v);
  const pi = v => P.add(v);
  const vi = v => VD.add(v);

  const setArr = (key, arr) => {
    if (omitEmpty && (!arr || arr.length === 0)) return;
    out[key] = arr;
  };

  const out = {
    v: full.version || '?',
    ts: full.timestamp || '',
    r: full.root || '',
    mi: {},
    fl: {},
    gr: { e: [], i: [], c: [], re: [] },
    st: full.statistics || {},
  };

  // ---- modules (p пишется всегда, если path есть) ----
  for (const m of full.modules || []) {
    const entry = { n: m.name || '', f: m.fileIds || [] };
    if (m.path) entry.p = m.path;
    out.mi[m.id] = entry;
  }
  if (omitEmpty && Object.keys(out.mi).length === 0) delete out.mi;

  // ---- files ----
  for (const f of full.files || []) {
    out.fl[f.id] = { p: f.path || '', m: f.moduleId || '' };
  }
  if (omitEmpty && Object.keys(out.fl).length === 0) delete out.fl;

  // ---- functions (18 флагов) ----
  setArr(
    'fns',
    (full.functions || []).map(fn => {
      const flags = encodeFlags(fn);
      return [
        fn.id,
        fn.name,
        fn.moduleId,
        fn.fileId,
        fn.line,
        flagsToString(flags),
        (fn.params || []).map(pi),
        si(fn.returnType),
      ];
    })
  );

  // ---- classes ----
  setArr(
    'cls',
    (full.classes || []).map(c => {
      const flags = encodeFlags(c);
      return [
        c.id,
        c.name,
        c.moduleId,
        c.fileId,
        c.line,
        flagsToString(flags),
        (c.methods || []).map(si),
      ];
    })
  );

  // ---- constants ----
  setArr(
    'cn',
    (full.constants || []).map(c => {
      const flags = encodeFlags(c);
      return [c.id, c.name, c.moduleId, c.fileId, c.line, flagsToString(flags), vi(c.value)];
    })
  );

  // ---- exports (gr.e) — 12 полей ----
  out.gr.e = (full.exports || []).map(e => [
    mi(e.moduleId),
    fi(e.fileId),
    e.functionId ? fni(e.functionId) : -1,
    e.line,
    rev(EXPORT_TYPES, e.type, 'ne'),
    si(e.exportName),
    si(e.localName),
    e.isTypeOnly ? 1 : 0,
    e.isReExport ? 1 : 0,
    si(e.source),
    e.isStarReExport ? 1 : 0,
    e.isDefaultReExport ? 1 : 0,
  ]);

  // ---- imports (gr.i) — 8 полей ----
  // ✅ v10.3: isTypeOnly приоритетнее, чем i.type.
  // В full.json для type-only импортов может быть записано
  // type: 'named' + isTypeOnly: true (см. compact-reporter.ts).
  // Раньше encode терял флаг isTypeOnly, и decode восстанавливал
  // type='named' вместо 'type-only' (26 расхождений в L1/L2/DL).
  out.gr.i = (full.imports || []).map(i => {
    const isExt = !!i.isExternal;
    let toNum;
    if (i.__rawToFileNum != null) toNum = i.__rawToFileNum;
    else if (isExt) toNum = -1;
    else if (i.toFileId) toNum = fi(i.toFileId);
    else toNum = -1;

    const importTypeCode = i.isTypeOnly ? 'to' : rev(IMPORT_TYPES, i.type, 'n');

    return [
      fi(i.fromFileId),
      toNum,
      si(i.source),
      si(i.importedName),
      si(i.localName),
      i.line,
      importTypeCode,
      isExt ? 1 : 0,
    ];
  });

  // ---- calls (gr.c) — 5 полей ----
  // ✅ v10.2: ИСПРАВЛЕНО — для external-вызовов сохраняется РЕАЛЬНЫЙ
  // тип вызова (async / callback / method / direct), а не 'direct'.
  //
  // Раньше (v10.0–v10.1):
  //   rev(CALL_TYPES, isExt ? 'direct' : c.type, 'd')
  // Теперь:
  //   rev(CALL_TYPES, c.type, 'd')
  //
  // Признак external передаётся отдельным 5-м полем кортежа gr.c
  // (isExternal). Это устраняет регрессию, при которой для всех
  // external-вызовов терялся реальный тип (async/callback/method).
  //
  // Симптом: L1_semantic и L3_byteExact падали с расхождениями:
  //   $.calls[N].type: a="async"/"callback", b="direct"
  //   $.gr.c[N][3]:  a="a"/"c",               b="d"
  out.gr.c = (full.calls || []).map(c => {
    const isExt =
      c.type === 'external' ||
      (typeof c.toFunctionId === 'string' && c.toFunctionId.startsWith('external:'));
    return [
      fni(c.fromFunctionId),
      isExt ? si(c.toFunctionId) : fni(c.toFunctionId),
      c.line,
      rev(CALL_TYPES, c.type, 'd'),
      isExt ? 1 : 0,
    ];
  });

  // ---- reExports (gr.re) — 7 полей ----
  out.gr.re = (full.reExports || []).map(r => [
    mi(r.moduleId),
    r.functionId ? fni(r.functionId) : -1,
    si(r.source),
    si(r.exportName),
    r.line,
    rev(RE_EXPORT_TYPES, r.type, 'n'),
    r.isTypeOnly ? 1 : 0,
  ]);

  if (
    omitEmpty &&
    out.gr.e.length === 0 &&
    out.gr.i.length === 0 &&
    out.gr.c.length === 0 &&
    out.gr.re.length === 0
  ) {
    delete out.gr;
  }

  // ---- templates ----
  setArr(
    'vt',
    (full.templates || []).map(t => [
      fi(t.fileId),
      mi(t.moduleId),
      t.complexity || 0,
      (t.reactivityDeps || []).map(si),
      (t.eventHandlers || []).map(ev => [
        si(ev.eventName),
        si(ev.handlerName),
        si(ev.tag),
        ev.line,
        (ev.modifiers || []).map(si),
        ev.isExternal ? 1 : 0,
      ]),
      (t.dynamicComponents || []).map(dc => [
        si(dc.isExpression),
        dc.line,
        (dc.resolvedComponents || []).map(si),
      ]),
      (t.directives || []).map(si),
      (t.usedComponents || []).map(si),
      (t.templateRefs || []).map(tr => [
        si(tr.refValue),
        si(tr.tag),
        tr.line,
        (tr.exposedMethods || []).map(si),
      ]),
      (t.cssVariables || []).map(cv => [
        si(cv.name),
        si(cv.value),
        cv.line,
        cv.isMultiline ? 1 : 0,
      ]),
      (t.deepSelectors || []).map(ds => [si(ds.selector), ds.line]),
      (t.slots || []).map(si),
    ])
  );

  // ---- lifecycle (lc) ----
  setArr(
    'lc',
    (full.lifecycle || []).map(l => [
      rev(LIFECYCLE_TYPES, l.hookName, l.hookName),
      l.functionId ? fni(l.functionId) : -1,
      l.line,
      l.callbackFunctionId ? fni(l.callbackFunctionId) : -1,
      l.isSetupContext ? 's' : '0',
    ])
  );

  // ---- effects (ef) ----
  setArr(
    'ef',
    (full.effects || []).map(ef => [
      rev(EFFECT_TYPES, ef.effectType, ef.effectType),
      ef.functionId ? fni(ef.functionId) : -1,
      ef.line,
      si(ef.targetName),
      si(ef.metaValue),
    ])
  );

  // ---- injections (inj) ----
  setArr(
    'inj',
    (full.injections || []).map(x => {
      let flags = 0;
      if (x.isSymbolKey) flags |= 1;
      if (x.hasDefault) flags |= 2;
      return [rev(INJECTION_TYPES, x.kind, x.kind), fi(x.fileId), x.line, si(x.key), flags];
    })
  );

  // ---- reactivity (rx) ----
  setArr(
    'rx',
    (full.reactivity || []).map(x => [
      rev(REACTIVITY_TYPES, x.kind, x.kind),
      x.functionId ? fni(x.functionId) : -1,
      x.line,
      (x.reads || []).map(si),
      (x.writes || []).map(si),
      x.isWriteable ? 1 : 0,
    ])
  );

  // ---- conditionals (cd) ----
  setArr(
    'cd',
    (full.conditionals || []).map(x => [
      rev(CONDITIONAL_TYPES, x.directive, x.directive),
      fi(x.fileId),
      x.line,
      si(x.conditionExpression),
      si(x.renderedComponent),
      0,
    ])
  );

  // ---- types (ty) ----
  setArr(
    'ty',
    (full.types || []).map(x => [
      rev(TYPE_KINDS, x.kind, x.kind),
      si(x.name),
      mi(x.moduleId),
      fi(x.fileId),
      x.line,
      (x.members || []).map(si),
      (x.extendsTypes || []).map(si),
    ])
  );

  // ---- typeRefs (tr) ----
  setArr(
    'tr',
    (full.typeRefs || []).map(x => [
      si(x.typeName),
      mi(x.moduleId),
      fi(x.fileId),
      x.line,
      rev(TYPE_USAGE_KINDS, x.usageKind, x.usageKind),
    ])
  );

  // ---- legend ----
  out.legend = {
    flagMap: Object.fromEntries(Object.entries(FLAG_MAP).map(([k, v]) => [k, String(v)])),
    flagCharMap: { ...FLAG_CHAR_MAP },
    relationTypes: { ...RELATION_TYPES },
    exportTypes: { ...EXPORT_TYPES },
    importTypes: { ...IMPORT_TYPES },
    callTypes: { ...CALL_TYPES },
    reExportTypes: { ...RE_EXPORT_TYPES },
    lifecycleTypes: { ...LIFECYCLE_TYPES },
    effectTypes: { ...EFFECT_TYPES },
    injectionTypes: { ...INJECTION_TYPES },
    reactivityTypes: { ...REACTIVITY_TYPES },
    conditionalTypes: { ...CONDITIONAL_TYPES },
    typeKinds: { ...TYPE_KINDS },
    typeUsageKinds: { ...TYPE_USAGE_KINDS },
    arraySchemas: {
      fns: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'paramsIdx', 'returnTypeIdx'],
      cls: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'methodsIdx'],
      cn: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'valueIdx'],
      'gr.e': [
        'moduleIdx',
        'fileIdx',
        'funcIdx',
        'line',
        'typeCode',
        'exportNameIdx',
        'localNameIdx',
        'isTypeOnly',
        'isReExport',
        'sourceIdx',
        'isStarReExport',
        'isDefaultReExport',
      ],
      'gr.i': [
        'fromFileIdx',
        'toFileIdIdx',
        'sourceIdx',
        'importedNameIdx',
        'localNameIdx',
        'line',
        'typeCode',
        'isExternal',
      ],
      'gr.c': ['fromIdx', 'toIdx', 'line', 'typeCode', 'isExternal'],
      'gr.re': [
        'moduleIdx',
        'funcIdx',
        'sourceIdx',
        'exportNameIdx',
        'line',
        'typeCode',
        'isTypeOnly',
      ],
      vt: [
        'fileIdx',
        'moduleIdx',
        'complexity',
        'reactivityDepsIdx',
        'eventHandlers',
        'dynamicComponents',
        'directivesIdx',
        'usedComponentsIdx',
        'templateRefs',
        'cssVariables',
        'deepSelectors',
        'slotsIdx',
      ],
      'vt.eventHandlers': [
        'eventNameIdx',
        'handlerNameIdx',
        'tagIdx',
        'line',
        'modifiersIdx',
        'isExternal',
      ],
      'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],
      'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],
      'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
      'vt.deepSelectors': ['selectorIdx', 'line'],
      lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],
      ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],
      inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],
      rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],
      cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],
      ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line', 'membersIdx', 'extendsIdx'],
      tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
    },
    stringDict: S.list,
    paramDict: P.list,
    valueDict: VD.list,
  };

  // ---- Проверка симметрии при reuseDicts ----
  if (reuseDicts && full.__codec && strict) {
    if (!arrayEq(S.list, full.__codec.stringDict)) {
      throw new Error(`Симметрия нарушена: stringDict изменился.`);
    }
    if (!arrayEq(P.list, full.__codec.paramDict)) {
      throw new Error(`Симметрия нарушена: paramDict изменился.`);
    }
    if (!arrayEq(VD.list, full.__codec.valueDict)) {
      throw new Error(`Симметрия нарушена: valueDict изменился.`);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// СБОРКА EDGES (агрегированный массив связей)
// ---------------------------------------------------------------------------

/**
 * Собирает агрегированный массив edges из полного JSON.
 *
 * edges — производное поле: его можно построить из
 *   full.imports  → type='import'
 *   full.exports  → type='export'
 *   full.calls    → type='call'
 *   full.reExports → type='re-export'
 *
 * По умолчанию это поле НЕ хранится в full.json и НЕ кодируется в compact.
 * Если edges нужны — используйте:
 *   - buildEdgesFromFull(full)    — для готового full
 *   - buildEdgesFromCompact(compact) — для compact (сначала decode)
 *   - decodeCompactData(compact, { includeEdges: true }) — сразу с edges
 *
 * @param {object} full — полный JSON
 * @returns {{ edges: Array<{from, to, type, symbol?, line?}>, stats: object }}
 */
export function buildEdgesFromFull(full) {
  if (!full || typeof full !== 'object') {
    return { edges: [], stats: { totalEdges: 0, byType: {} } };
  }

  const edges = [];

  // ---- imports ----
  for (const imp of full.imports || []) {
    edges.push({
      from: imp.fromFileId,
      to:
        imp.toFileId || (imp.isExternal ? `external:${imp.packageName || imp.source}` : 'unknown'),
      type: 'import',
      symbol: imp.importedName,
      line: imp.line || 0,
    });
  }

  // ---- exports ----
  for (const exp of full.exports || []) {
    edges.push({
      from: exp.fileId,
      to: exp.functionId || exp.moduleId || 'unknown',
      type: 'export',
      symbol: exp.exportName,
      line: exp.line || 0,
    });
  }

  // ---- calls ----
  for (const call of full.calls || []) {
    edges.push({
      from: call.fromFunctionId,
      to: call.toFunctionId || 'unknown',
      type: 'call',
      line: call.line || 0,
    });
  }

  // ---- re-exports ----
  for (const re of full.reExports || []) {
    edges.push({
      from: re.moduleId,
      to: re.functionId || 'unknown',
      type: 're-export',
      symbol: re.exportName,
      line: re.line || 0,
    });
  }

  return { edges, stats: buildEdgesStats(edges) };
}

/**
 * Собирает edges из компактного JSON.
 * Внутри вызывает decodeCompactData с includeEdges: false, затем buildEdgesFromFull.
 */
export function buildEdgesFromCompact(compact) {
  const full = decodeCompactData(compact, { includeEdges: false });
  return buildEdgesFromFull(full);
}

/**
 * Статистика по массиву edges: total + разбивка по типам.
 */
export function buildEdgesStats(edges) {
  const byType = {};
  for (const e of edges || []) {
    const t = e.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }
  return {
    totalEdges: (edges || []).length,
    byType,
  };
}

// ---------------------------------------------------------------------------
// DEEP EQUAL / DIFF — реэкспортированы из utils (см. начало файла).
// Локальных дублей больше нет.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ROUND-TRIP ПРОВЕРКИ
// ---------------------------------------------------------------------------

export function roundTripSemantic(compact) {
  const full1 = decodeCompactData(compact);
  const compact2 = encodeToCompactData(full1, { reuseDicts: false });
  const full2 = decodeCompactData(compact2);
  const a = stripServiceFields(full1);
  const b = stripServiceFields(full2);
  const ok = deepEqual(a, b);
  return {
    full: full1,
    compact: compact2,
    reDecoded: full2,
    ok,
    diff: ok ? null : diffObjects(a, b),
  };
}

export function roundTripByteExact(compact) {
  const full = decodeCompactData(compact);
  const compact2 = encodeToCompactData(full, { reuseDicts: true, strict: true });
  const a = stripForByteCompare(compact);
  const b = stripForByteCompare(compact2);
  const ok = deepEqual(a, b);
  return { full, compact: compact2, ok, diff: ok ? null : diffObjects(a, b) };
}

export function roundTripEncode(full) {
  const compact1 = encodeToCompactData(full, { reuseDicts: false });
  const full2 = decodeCompactData(compact1);
  const compact2 = encodeToCompactData(full2, { reuseDicts: false });
  const ok = deepEqual(compact1, compact2);
  return {
    compact: compact1,
    full: full2,
    reEncoded: compact2,
    ok,
    diff: ok ? null : diffObjects(compact1, compact2),
  };
}

// ---------------------------------------------------------------------------
// TS-СОВМЕСТИМЫЕ ПРОВЕРКИ
// ---------------------------------------------------------------------------

/**
 * Проверяет, что encode → decode возвращает идентичный результат.
 */
export function verifyRoundTrip(payload, options = {}) {
  try {
    const compact = encodeToCompactData(payload);
    const decoded = decodeCompactData(compact, options);

    const details = {
      modules: {
        original: (payload.modules || []).length,
        decoded: (decoded.modules || []).length,
      },
      files: { original: (payload.files || []).length, decoded: (decoded.files || []).length },
      functions: {
        original: (payload.functions || []).length,
        decoded: (decoded.functions || []).length,
      },
      classes: {
        original: (payload.classes || []).length,
        decoded: (decoded.classes || []).length,
      },
      constants: {
        original: (payload.constants || []).length,
        decoded: (decoded.constants || []).length,
      },
      exports: {
        original: (payload.exports || []).length,
        decoded: (decoded.exports || []).length,
      },
      imports: {
        original: (payload.imports || []).length,
        decoded: (decoded.imports || []).length,
      },
      calls: { original: (payload.calls || []).length, decoded: (decoded.calls || []).length },
      reExports: {
        original: (payload.reExports || []).length,
        decoded: (decoded.reExports || []).length,
      },
      templates: {
        original: (payload.templates || []).length,
        decoded: (decoded.templates || []).length,
      },
      lifecycle: {
        original: (payload.lifecycle || []).length,
        decoded: (decoded.lifecycle || []).length,
      },
      effects: {
        original: (payload.effects || []).length,
        decoded: (decoded.effects || []).length,
      },
      injections: {
        original: (payload.injections || []).length,
        decoded: (decoded.injections || []).length,
      },
      reactivity: {
        original: (payload.reactivity || []).length,
        decoded: (decoded.reactivity || []).length,
      },
      conditionals: {
        original: (payload.conditionals || []).length,
        decoded: (decoded.conditionals || []).length,
      },
      types: { original: (payload.types || []).length, decoded: (decoded.types || []).length },
      typeRefs: {
        original: (payload.typeRefs || []).length,
        decoded: (decoded.typeRefs || []).length,
      },
    };

    const errors = [];
    for (const [key, value] of Object.entries(details)) {
      if (value.original !== value.decoded) {
        errors.push(`${key}: ${value.original} → ${value.decoded}`);
      }
    }

    const a = stripServiceFields(payload);
    const b = stripServiceFields(decoded);
    if (!deepEqual(a, b)) {
      const normOrig = normalizeForDiff(a);
      const normDec = normalizeForDiff(b);
      const minLen = Math.min(normOrig.length, normDec.length);
      let diffPos = minLen;
      for (let i = 0; i < minLen; i++) {
        if (normOrig[i] !== normDec[i]) {
          diffPos = i;
          break;
        }
      }
      const ctx = 80;
      const start = Math.max(0, diffPos - ctx);
      const end = Math.min(minLen, diffPos + ctx);
      errors.push(
        `JSON mismatch at pos ${diffPos}: ...${normOrig.substring(start, end)}... ≠ ...${normDec.substring(start, end)}...`
      );
    }

    if (errors.length > 0) return { ok: false, error: errors.join('; '), details };
    return { ok: true, details };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function makeLevel(diffs, note) {
  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs, note };
}

function makeErrorLevel(err) {
  return { ok: false, diffCount: 1, diff: [{ path: '$', a: 'error', b: String(err) }] };
}

/**
 * Проверяет обратимость в обе стороны (TS-совместимый отчёт).
 */
export function verifyRoundTripBoth(full, compact) {
  const report = {
    timestamp: new Date().toISOString(),
    full_to_compact: { ok: false, diffCount: 0, diff: [] },
    compact_to_full: { ok: false, diffCount: 0, diff: [] },
    compact_to_full_to_compact: { ok: false, diffCount: 0, diff: [] },
    full_to_compact_to_full: { ok: false, diffCount: 0, diff: [] },
    encode_idempotent: { ok: false, diffCount: 0, diff: [] },
    decode_idempotent: { ok: false, diffCount: 0, diff: [] },
    full_self_contained: false,
    compact_self_contained: false,
    spotChecks: {
      callsType: { ok: false, diffCount: 0, diff: [] },
      importsToFileId: { ok: false, diffCount: 0, diff: [] },
      exportsIsReExport: { ok: false, diffCount: 0, diff: [] },
      functionsFlags: { ok: false, diffCount: 0, diff: [] },
      externalCalls: { ok: false, diffCount: 0, diff: [] },
      modulesPath: { ok: false, diffCount: 0, diff: [] },
    },
  };

  // L0: encode(full) === compact
  try {
    const encoded = encodeToCompactData(full);
    report.full_to_compact = makeLevel(
      collectDiffs(compact, encoded, '$'),
      `encoded to compact v=${encoded.v}`
    );
  } catch (err) {
    report.full_to_compact = makeErrorLevel(err);
  }

  // L1: decode(compact) без ошибок
  let decodedFromCompact = null;
  try {
    decodedFromCompact = decodeCompactData(compact);
    report.compact_to_full = makeLevel([]);
  } catch (err) {
    report.compact_to_full = makeErrorLevel(err);
  }

  // RE: encode(decode(compact)) === compact
  try {
    if (decodedFromCompact) {
      const reEncoded = encodeToCompactData(decodedFromCompact);
      report.compact_to_full_to_compact = makeLevel(collectDiffs(compact, reEncoded, '$'));
    }
  } catch (err) {
    report.compact_to_full_to_compact = makeErrorLevel(err);
  }

  // DL: decode(encode(full)) === full
  try {
    const encoded = encodeToCompactData(full);
    const decoded = decodeCompactData(encoded);
    const a = stripServiceFields(full);
    const b = stripServiceFields(decoded);
    report.full_to_compact_to_full = makeLevel(collectDiffs(a, b, '$'));
  } catch (err) {
    report.full_to_compact_to_full = makeErrorLevel(err);
  }

  // ENC
  try {
    const c1 = encodeToCompactData(full);
    const f1 = decodeCompactData(c1);
    const c2 = encodeToCompactData(f1);
    report.encode_idempotent = makeLevel(collectDiffs(c1, c2, '$'));
  } catch (err) {
    report.encode_idempotent = makeErrorLevel(err);
  }

  // DEC
  try {
    const f1 = decodeCompactData(compact);
    const c1 = encodeToCompactData(f1);
    const f2 = decodeCompactData(c1);
    report.decode_idempotent = makeLevel(collectDiffs(f1, f2, '$'));
  } catch (err) {
    report.decode_idempotent = makeErrorLevel(err);
  }

  report.full_self_contained = true;
  report.compact_self_contained = true;

  // SpotChecks
  try {
    const decoded = decodedFromCompact || decodeCompactData(compact);

    // calls[].type
    {
      const diffs = [];
      const n = Math.min((decoded.calls || []).length, (full.calls || []).length);
      for (let i = 0; i < n && diffs.length < 20; i++) {
        if (decoded.calls[i]?.type !== full.calls[i]?.type) {
          diffs.push({
            path: `$.calls[${i}].type`,
            a: decoded.calls[i]?.type,
            b: full.calls[i]?.type,
          });
        }
      }
      report.spotChecks.callsType = makeLevel(diffs);
    }

    // imports[].toFileId
    {
      const diffs = [];
      const n = Math.min((decoded.imports || []).length, (full.imports || []).length);
      for (let i = 0; i < n && diffs.length < 20; i++) {
        if (decoded.imports[i]?.toFileId !== full.imports[i]?.toFileId) {
          diffs.push({
            path: `$.imports[${i}].toFileId`,
            a: decoded.imports[i]?.toFileId,
            b: full.imports[i]?.toFileId,
          });
        }
      }
      report.spotChecks.importsToFileId = makeLevel(diffs);
    }

    // exports[].isReExport
    {
      const diffs = [];
      const n = Math.min((decoded.exports || []).length, (full.exports || []).length);
      for (let i = 0; i < n && diffs.length < 20; i++) {
        if (decoded.exports[i]?.isReExport !== full.exports[i]?.isReExport) {
          diffs.push({
            path: `$.exports[${i}].isReExport`,
            a: decoded.exports[i]?.isReExport,
            b: full.exports[i]?.isReExport,
          });
        }
      }
      report.spotChecks.exportsIsReExport = makeLevel(diffs);
    }

    // functions[].*Flags
    {
      const flagFields = [
        'isAsync',
        'isExported',
        'isMethod',
        'isArrow',
        'isEventHandler',
        'isNested',
        'isSelf',
        'isDynamic',
        'isConfig',
        'isExternal',
        'isVueTemplate',
        'isAsyncChain',
        'isClosure',
        'isTypeDep',
        'isGenerator',
        'isPrivate',
        'isProtected',
        'isStatic',
      ];
      const diffs = [];
      const n = Math.min((decoded.functions || []).length, (full.functions || []).length);
      for (let i = 0; i < n && diffs.length < 20; i++) {
        for (const field of flagFields) {
          const dv = decoded.functions[i]?.[field];
          const fv = full.functions[i]?.[field];
          if (dv !== fv) {
            diffs.push({ path: `$.functions[${i}].${field}`, a: dv, b: fv });
            if (diffs.length >= 20) break;
          }
        }
      }
      report.spotChecks.functionsFlags = makeLevel(diffs);
    }

    // external calls
    {
      const diffs = [];
      const fullExternal = (full.calls || []).filter(
        c => c.toFunctionId?.startsWith?.('external:') || c.type === 'external'
      );
      for (let i = 0; i < fullExternal.length && diffs.length < 20; i++) {
        const fc = fullExternal[i];
        if (!fc) continue;
        const dc = (decoded.calls || []).find(
          c =>
            c.fromFunctionId === fc.fromFunctionId &&
            c.toFunctionId === fc.toFunctionId &&
            c.line === fc.line
        );
        if (!dc) {
          diffs.push({ path: `$.calls[external:${i}]`, a: 'not found', b: fc.toFunctionId });
          continue;
        }
        if (dc.type !== fc.type)
          diffs.push({ path: `$.calls[${dc.id}].type`, a: dc.type, b: fc.type });
      }
      report.spotChecks.externalCalls = makeLevel(diffs);
    }

    // modules[].path
    {
      const diffs = [];
      const n = Math.min((decoded.modules || []).length, (full.modules || []).length);
      for (let i = 0; i < n && diffs.length < 20; i++) {
        if (decoded.modules[i]?.path !== full.modules[i]?.path) {
          diffs.push({
            path: `$.modules[${i}].path`,
            a: decoded.modules[i]?.path,
            b: full.modules[i]?.path,
          });
        }
      }
      report.spotChecks.modulesPath = makeLevel(diffs);
    }
  } catch (err) {
    report.spotChecks.callsType = makeErrorLevel(err);
  }

  return report;
}

// ---------------------------------------------------------------------------
// РАЗМЕРЫ И СЕРИАЛИЗАЦИЯ
// ---------------------------------------------------------------------------

export function getCompactSize(compact) {
  return JSON.stringify(compact).length;
}
export function getFullSize(full) {
  return JSON.stringify(full).length;
}

export function getCompressionRatio(full) {
  const compact = encodeToCompactData(full);
  const fullSize = getFullSize(full);
  const compactSize = getCompactSize(compact);
  if (fullSize === 0) return 0;
  return compactSize / fullSize;
}

export function stringify(compact, pretty = false) {
  return pretty ? JSON.stringify(compact, null, 2) : JSON.stringify(compact);
}

export function parse(json) {
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// АВТООПРЕДЕЛЕНИЕ ФОРМАТА
// ---------------------------------------------------------------------------

export function detectFormat(json) {
  if (!json || typeof json !== 'object') return 'unknown';
  if (json.v && json.mi && json.fl) return 'compact';
  if (json.version && json.modules && json.files) return 'full';
  return 'unknown';
}

export function toFullData(json) {
  const fmt = detectFormat(json);
  if (fmt === 'compact') return decodeCompactData(json);
  if (fmt === 'full') return json;
  throw new Error('toFullData: неизвестный формат JSON');
}

// ---------------------------------------------------------------------------
// ФАСАД Codec (совместим с TS-версией)
// ---------------------------------------------------------------------------

function getLegend() {
  return {
    flagMap: Object.fromEntries(Object.entries(FLAG_MAP).map(([bit, char]) => [char, bit])),
    flagCharMap: { ...FLAG_CHAR_MAP },
    relationTypes: { ...RELATION_TYPES },
    exportTypes: { ...EXPORT_TYPES },
    importTypes: { ...IMPORT_TYPES },
    callTypes: { ...CALL_TYPES },
    reExportTypes: { ...RE_EXPORT_TYPES },
    lifecycleTypes: { ...LIFECYCLE_TYPES },
    effectTypes: { ...EFFECT_TYPES },
    injectionTypes: { ...INJECTION_TYPES },
    reactivityTypes: { ...REACTIVITY_TYPES },
    conditionalTypes: { ...CONDITIONAL_TYPES },
    typeKinds: { ...TYPE_KINDS },
    typeUsageKinds: { ...TYPE_USAGE_KINDS },
    arraySchemas: {
      fns: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'paramsIdx', 'returnTypeIdx'],
      cls: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'methodsIdx'],
      cn: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'valueIdx'],
      'gr.e': [
        'moduleIdx',
        'fileIdx',
        'funcIdx',
        'line',
        'typeCode',
        'exportNameIdx',
        'localNameIdx',
        'isTypeOnly',
        'isReExport',
        'sourceIdx',
        'isStarReExport',
        'isDefaultReExport',
      ],
      'gr.i': [
        'fromFileIdx',
        'toFileIdIdx',
        'sourceIdx',
        'importedNameIdx',
        'localNameIdx',
        'line',
        'typeCode',
        'isExternal',
      ],
      'gr.c': ['fromIdx', 'toIdx', 'line', 'typeCode', 'isExternal'],
      'gr.re': [
        'moduleIdx',
        'funcIdx',
        'sourceIdx',
        'exportNameIdx',
        'line',
        'typeCode',
        'isTypeOnly',
      ],
      vt: [
        'fileIdx',
        'moduleIdx',
        'complexity',
        'reactivityDepsIdx',
        'eventHandlers',
        'dynamicComponents',
        'directivesIdx',
        'usedComponentsIdx',
        'templateRefs',
        'cssVariables',
        'deepSelectors',
        'slotsIdx',
      ],
      'vt.eventHandlers': [
        'eventNameIdx',
        'handlerNameIdx',
        'tagIdx',
        'line',
        'modifiersIdx',
        'isExternal',
      ],
      'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],
      'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],
      'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
      'vt.deepSelectors': ['selectorIdx', 'line'],
      lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],
      ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],
      inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],
      rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],
      cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],
      ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line', 'membersIdx', 'extendsIdx'],
      tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
    },
    stringDict: [],
    paramDict: [],
    methodDict: [],
    valueDict: [],
  };
}

export const Codec = {
  encode(full, options = {}) {
    return encodeToCompactData(full, options);
  },
  decode(compact, options = {}) {
    return decodeCompactData(compact, options);
  },
  verifyRoundTrip(payload, options = {}) {
    return verifyRoundTrip(payload, options);
  },
  verifyRoundTripBoth(full, compact) {
    return verifyRoundTripBoth(full, compact);
  },
  getCompactSize(compact) {
    return getCompactSize(compact);
  },
  getFullSize(full) {
    return getFullSize(full);
  },
  getCompressionRatio(full) {
    return getCompressionRatio(full);
  },
  stringify(compact, pretty = false) {
    return stringify(compact, pretty);
  },
  parse(json) {
    return parse(json);
  },
  getLegend() {
    return getLegend();
  },

  buildEdges(full) {
    return buildEdgesFromFull(full);
  },
  buildEdgesStats(edges) {
    return buildEdgesStats(edges);
  },
};

// ---------------------------------------------------------------------------
// ЭКСПОРТ ДЛЯ ОТЛАДКИ
// ---------------------------------------------------------------------------

export const __internals = {
  DictBuilder,
  ValueDictBuilder,
  FrozenDictBuilder,
  FrozenValueDictBuilder,
  deepEqual,
  diffObjects,
  arrayEq,
  stripServiceFields,
  stripForByteCompare,
  idToNum,
};

export default Codec;