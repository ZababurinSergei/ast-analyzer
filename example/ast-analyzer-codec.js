// ============================================================================
// AST ANALYZER — CODEC v13.0.2
// Только columnar + RLE + tokens. Обратная совместимость не поддерживается.
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
  rle,
  unrle,
} from './ast-analyzer-utils.js';

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

export const CODEC_VERSION = '13.0.2';

// ---------------------------------------------------------------------------
// СЛОВАРИ
// ---------------------------------------------------------------------------

export const FLAG_MAP = {
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

export const FLAG_CHAR_MAP = {
  a: 1,
  e: 2,
  m: 4,
  r: 8,
  v: 16,
  n: 32,
  s: 64,
  d: 128,
  c: 256,
  x: 512,
  t: 1024,
  A: 2048,
  l: 4096,
  y: 8192,
  g: 16384,
  p: 32768,
  P: 65536,
  S: 131072,
};

export const FLAG_NAMES = { ...FLAG_MAP };

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
export const IMPORT_TYPES = { n: 'named', df: 'default', ns: 'namespace', to: 'type' };
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

export const TYPE_KINDS = {
  i: 'interface',
  t: 'type-alias',
  e: 'enum',
  c: 'class',
};

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

export function encodeFlags(obj) {
  let flags = 0;
  if (!obj) return 0;
  for (const [bit, name] of Object.entries(FLAG_MAP)) {
    if (obj[name]) flags |= parseInt(bit, 10);
  }
  return flags;
}

export function flagsToString(flags) {
  if (flags === 0) return '0';
  let result = '';
  for (const [bitStr, char] of Object.entries(FLAG_MAP)) {
    if (flags & parseInt(bitStr, 10)) result += char;
  }
  return result || '0';
}

export function decodeFlagsFromNumber(num) {
  const r = createEmptyFlags();
  if (!num) return r;
  r.isAsync = !!(num & 1);
  r.isExported = !!(num & 2);
  r.isMethod = !!(num & 4);
  r.isArrow = !!(num & 8);
  r.isEventHandler = !!(num & 16);
  r.isNested = !!(num & 32);
  r.isSelf = !!(num & 64);
  r.isDynamic = !!(num & 128);
  r.isConfig = !!(num & 256);
  r.isExternal = !!(num & 512);
  r.isVueTemplate = !!(num & 1024);
  r.isAsyncChain = !!(num & 2048);
  r.isClosure = !!(num & 4096);
  r.isTypeDep = !!(num & 8192);
  r.isGenerator = !!(num & 16384);
  r.isPrivate = !!(num & 32768);
  r.isProtected = !!(num & 65536);
  r.isStatic = !!(num & 131072);
  return r;
}

export function decodeFlagsToObject(flagStr) {
  if (!flagStr || flagStr === '0') return createEmptyFlags();
  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }
  return decodeFlagsFromNumber(flags);
}

export function flagsStringToNumber(flagStr) {
  if (!flagStr || flagStr === '0') return 0;
  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }
  return flags;
}

// ---------------------------------------------------------------------------
// ТОКЕНЫ
// ---------------------------------------------------------------------------

export function decodeStr(entry, tokens) {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry)) return entry.map(i => tokens[i] || '').join('');
  return '';
}

function tokenizeStr(str) {
  if (!str) return [];
  return str.split(/(?=[A-Z])|[_\-\.0-9/]+/).filter(Boolean);
}

function buildTokenDict(strings) {
  const freq = new Map();
  for (const s of strings) {
    for (const t of tokenizeStr(s)) freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()].filter(([, c]) => c > 1).map(([t]) => t);
}

function encodeStr(str, tokenIndex) {
  if (!str || str.length < 8) return str;
  if (/[_\-\.0-9/:]/.test(str)) return str;
  const tokens = tokenizeStr(str);
  if (!tokens.length) return str;
  const idx = [];
  for (const t of tokens) {
    const i = tokenIndex.get(t);
    if (i === undefined) return str;
    idx.push(i);
  }
  if (tokens.length * 2 >= str.length) return str;
  return idx;
}

// ---------------------------------------------------------------------------
// КЛАССИФИКАЦИЯ ЗНАЧЕНИЙ (v13.0.2)
// ---------------------------------------------------------------------------

/**
 * Эвристика категоризации значения.
 *
 * Возвращает:
 *   - 'relation'    — примитивы, короткие строки, короткие массивы/объекты
 *   - 'flag-array'  — длинные массивы (>50 элементов)
 *   - 'config'      — большие объекты (JSON > 500 символов)
 *   - 'template'    — строки 200..500 или HTML/Vue-шаблоны
 *   - 'code'        — строки > 500 символов
 *   - 'other'       — null/undefined/несериализуемое
 */
export function classifyValue(value) {
  if (value === null || value === undefined) return 'other';

  if (typeof value === 'number' || typeof value === 'boolean') return 'relation';

  if (typeof value === 'string') {
    if (value.length > 500) return 'code';
    if (value.length > 200) return 'template';
    return 'relation';
  }

  if (Array.isArray(value)) {
    if (value.length > 50) return 'flag-array';
    return 'relation';
  }

  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      if (json.length > 500) return 'config';
      if (json.includes('<style') || json.includes('<script') || json.includes('</html>')) {
        return 'template';
      }
      return 'relation';
    } catch {
      return 'other';
    }
  }

  return 'other';
}

// ---------------------------------------------------------------------------
// ФИЛЬТРАЦИЯ VALUES (v13.0.2)
// ---------------------------------------------------------------------------

/**
 * Фильтрует values + метаданные для режима 'relations'.
 *
 * Оставляет:
 *   - kind === 'relation'    — всегда
 *   - kind === 'flag-array'  — всегда
 *   - kind === 'config'      — только если JSON ≤ 200 символов
 *
 * Выбрасывает:
 *   - kind === 'template'
 *   - kind === 'code'
 *   - kind === 'other'
 *
 * @returns {{ values: unknown[], meta: object[], indexMap: Map<number, number> }}
 */
export function filterValues(values, meta) {
  const keptIndices = new Set();

  for (let i = 0; i < values.length; i++) {
    const m = meta[i];
    if (!m) continue;

    if (m.kind === 'relation' || m.kind === 'flag-array') {
      keptIndices.add(i);
      continue;
    }

    if (m.kind === 'config') {
      const v = values[i];
      try {
        const json = JSON.stringify(v);
        if (json.length <= 200) keptIndices.add(i);
      } catch {
        // пропускаем
      }
      continue;
    }

    // template / code / other — выбрасываем
  }

  const newValues = [];
  const newMeta = [];
  const indexMap = new Map();

  for (let i = 0; i < values.length; i++) {
    if (keptIndices.has(i)) {
      const newIdx = newValues.length;
      newValues.push(values[i]);
      newMeta.push(meta[i]);
      indexMap.set(i, newIdx);
    }
  }

  return { values: newValues, meta: newMeta, indexMap };
}

/**
 * Переиндексирует один индекс через indexMap.
 * Возвращает null, если индекс был отфильтрован или некорректен.
 */
export function remapIndex(idx, indexMap) {
  if (idx === null || idx === undefined || idx < 0) return null;
  const mapped = indexMap.get(idx);
  return mapped === undefined ? null : mapped;
}

// ---------------------------------------------------------------------------
// DICT BUILDERS
// ---------------------------------------------------------------------------

class DictBuilder {
  constructor() {
    this.list = [];
    this.map = new Map();
  }
  add(v) {
    if (v === null || v === undefined || v === '') return -1;
    const k = String(v);
    if (this.map.has(k)) return this.map.get(k);
    const i = this.list.length;
    this.list.push(k);
    this.map.set(k, i);
    return i;
  }
}

class ValueDictBuilder {
  constructor() {
    this.list = [];
    this.map = new Map();
    this.meta = [];
  }
  add(v, key = '') {
    if (v === undefined) return -1;
    const k = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
    if (this.map.has(k)) return this.map.get(k);
    const i = this.list.length;
    this.list.push(v);
    this.map.set(k, i);
    this.meta.push({ key: key || `v_${i}`, kind: classifyValue(v) });
    return i;
  }
}

// ---------------------------------------------------------------------------
// DECODE
// ---------------------------------------------------------------------------

export function decodeCompactData(compact, options = {}) {
  if (!compact || typeof compact !== 'object') {
    throw new Error('decodeCompactData: ожидается объект');
  }
  const { includeEdges = false } = options;

  const tokens = compact.tokens || [];
  const stringDict = (compact.strs || []).map(s => decodeStr(s, tokens));
  const paramDict = (compact.params || []).map(s => decodeStr(s, tokens));
  const methodDict = (compact.methods || []).map(s => decodeStr(s, tokens));
  const valueDict = compact.values || [];

  const readStr = i => (i == null || i < 0 ? '' : (stringDict[i] ?? ''));
  const readStrOpt = i => (i == null || i < 0 ? undefined : stringDict[i]);
  const readPar = i => (i == null || i < 0 ? '' : (paramDict[i] ?? ''));
  const readMeth = i => (i == null || i < 0 ? null : (methodDict[i] ?? null));
  const readVal = i => (i == null || i < 0 ? undefined : valueDict[i]);

  // --- files ---
  const flP = compact.fl?.p || [];
  const flM = unrle(compact.fl?.m || []);
  const files = flP.map((p, i) => ({
    id: `f${i + 1}`,
    path: p || '',
    moduleId: `m${(flM[i] ?? 0) + 1}`,
  }));

  // --- modules (через fl.m, а не mi.f) ---
  const miN = compact.mi?.n || [];
  const moduleFileIds = miN.map(() => []);
  for (let i = 0; i < files.length; i++) {
    const modIdx = flM[i] ?? 0;
    if (modIdx >= 0 && modIdx < moduleFileIds.length) {
      moduleFileIds[modIdx].push(`f${i + 1}`);
    }
  }
  const modules = miN.map((n, i) => ({
    id: `m${i + 1}`,
    name: n || '',
    path: n || '',
    fileIds: moduleFileIds[i] || [],
  }));

  // --- functions ---
  const fns = compact.fns || { n: [], m: [], f: [], l: [], fl: [], p: [], rt: [] };
  const fnsM = unrle(fns.m || []);
  const fnsF = unrle(fns.f || []);
  const functions = (fns.n || []).map((nIdx, i) => {
    const fl = decodeFlagsFromNumber(fns.fl?.[i] ?? 0);
    const fn = {
      id: `fn${i + 1}`,
      name: readStr(nIdx),
      moduleId: `m${(fnsM[i] ?? 0) + 1}`,
      fileId: `f${(fnsF[i] ?? 0) + 1}`,
      line: fns.l?.[i] ?? 0,
      isExported: fl.isExported,
      isAsync: fl.isAsync,
      isArrow: fl.isArrow,
      isMethod: fl.isMethod,
      params: (fns.p?.[i] || []).map(readPar),
      returnType: readStrOpt(fns.rt?.[i]),
    };
    const extras = [
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
    for (const k of extras) if (fl[k]) fn[k] = true;
    return fn;
  });

  // --- classes ---
  const cls = compact.cls || { n: [], m: [], f: [], l: [], fl: [], methods: [] };
  const clsM = unrle(cls.m || []);
  const clsF = unrle(cls.f || []);
  const classes = (cls.n || []).map((nIdx, i) => {
    const fl = decodeFlagsFromNumber(cls.fl?.[i] ?? 0);
    return {
      id: `cls${i + 1}`,
      name: readStr(nIdx),
      moduleId: `m${(clsM[i] ?? 0) + 1}`,
      fileId: `f${(clsF[i] ?? 0) + 1}`,
      line: cls.l?.[i] ?? 0,
      isExported: fl.isExported,
      methods: (cls.methods?.[i] || []).map(readMeth),
    };
  });

  // --- constants ---
  const cn = compact.cn || { n: [], m: [], f: [], l: [], fl: [], nonEmptyV: [] };
  const cnM = unrle(cn.m || []);
  const cnF = unrle(cn.f || []);
  const valueMap = new Map();
  for (const [ci, vi] of cn.nonEmptyV || []) valueMap.set(ci, vi);
  const constants = (cn.n || []).map((nIdx, i) => {
    const fl = decodeFlagsFromNumber(cn.fl?.[i] ?? 0);
    const vi = valueMap.get(i);
    return {
      id: `cn${i + 1}`,
      name: readStr(nIdx),
      moduleId: `m${(cnM[i] ?? 0) + 1}`,
      fileId: `f${(cnF[i] ?? 0) + 1}`,
      line: cn.l?.[i] ?? 0,
      isExported: fl.isExported,
      value: vi !== undefined ? readVal(vi) : undefined,
    };
  });

  // --- exports ---
  const ge = compact.gr?.e || {
    m: [],
    f: [],
    fn: [],
    l: [],
    ty: [],
    en: [],
    ln: [],
    s: [],
    flags: [],
  };
  const exports = (ge.m || []).map((mIdx, i) => {
    const ty = ge.ty?.[i] ?? 0;
    const type = ty === 1 ? 'default' : ty === 2 ? 'type' : 'named';
    const flags = ge.flags?.[i] ?? 0;
    return {
      id: `e${i + 1}`,
      moduleId: `m${mIdx + 1}`,
      fileId: `f${(ge.f?.[i] ?? 0) + 1}`,
      functionId: `fn${(ge.fn?.[i] ?? 0) + 1}`,
      exportName: readStr(ge.en?.[i]),
      localName: readStr(ge.ln?.[i]),
      line: ge.l?.[i] ?? 0,
      type,
      isDefault: type === 'default',
      isTypeOnly: (flags & 1) !== 0,
      isReExport: (flags & 2) !== 0,
      isStarReExport: (flags & 4) !== 0,
      isDefaultReExport: (flags & 8) !== 0,
      source: readStrOpt(ge.s?.[i]),
    };
  });

  // --- imports ---
  const gi = compact.gr?.i || { ff: [], tf: [], s: [], im: [], ln: [], l: [], ty: [] };
  const imports = (gi.ff || []).map((ff, i) => {
    const c = gi.ty?.[i] ?? 0;
    const tc = c & 3;
    const isExt = (c & 4) !== 0;
    const type = tc === 1 ? 'default' : tc === 2 ? 'namespace' : tc === 3 ? 'type' : 'named';
    const source = readStr(gi.s?.[i]);
    return {
      id: `i${i + 1}`,
      fromFileId: `f${ff + 1}`,
      toFileId: readStrOpt(gi.tf?.[i]) ?? null,
      source,
      importedName: readStr(gi.im?.[i]),
      localName: readStr(gi.ln?.[i]),
      line: gi.l?.[i] ?? 0,
      type,
      isDefault: type === 'default',
      isNamespace: type === 'namespace',
      isTypeOnly: type === 'type',
      isExternal: isExt,
      packageName: isExt
        ? source.startsWith('@')
          ? source.split('/').slice(0, 2).join('/')
          : source.split('/')[0]
        : undefined,
    };
  });

  // --- calls ---
  const gc = compact.gr?.c || { f: [], t: [], l: [], ty: [] };
  const calls = (gc.f || []).map((fromIdx, i) => {
    const c = gc.ty?.[i] ?? 0;
    const tc = c & 3;
    const isExt = (c & 4) !== 0;
    const type = tc === 1 ? 'async' : tc === 2 ? 'method' : tc === 3 ? 'callback' : 'direct';
    return {
      id: `c${i + 1}`,
      fromFunctionId: `fn${fromIdx + 1}`,
      toFunctionId: isExt ? readStr(gc.t?.[i]) : `fn${(gc.t?.[i] ?? 0) + 1}`,
      line: gc.l?.[i] ?? 0,
      type,
    };
  });

  // --- re-exports ---
  const gre = compact.gr?.re || { m: [], fn: [], s: [], en: [], l: [], ty: [] };
  const reExports = (gre.m || []).map((mIdx, i) => {
    const c = gre.ty?.[i] ?? 0;
    const tc = c & 3;
    const isTypeOnly = (c & 4) !== 0;
    const type = tc === 2 ? 'all' : tc === 1 ? 'default' : 'named';
    return {
      id: `re${i + 1}`,
      moduleId: `m${mIdx + 1}`,
      functionId: `fn${(gre.fn?.[i] ?? 0) + 1}`,
      source: readStr(gre.s?.[i]),
      exportName: readStr(gre.en?.[i]),
      line: gre.l?.[i] ?? 0,
      type,
      isDefault: type === 'default',
      isTypeOnly,
      isStarReExport: type === 'all',
    };
  });

  const out = {
    version: CODEC_VERSION,
    timestamp: compact.ts || '',
    root: `m${(compact.r ?? 0) + 1}`,
    valuesMode: compact.valuesMode,
    modules,
    files,
    functions,
    classes,
    constants,
    exports,
    imports,
    calls,
    reExports,
    statistics: compact.st || {},
    legend: compact.legend,
  };

  if (includeEdges) {
    const { edges } = buildEdgesFromFull(out);
    out.edges = edges;
  }

  return out;
}

// ---------------------------------------------------------------------------
// ENCODE
// ---------------------------------------------------------------------------

export function encodeToCompactData(full, options = {}) {
  if (!full || typeof full !== 'object') {
    throw new Error('encodeToCompactData: ожидается объект');
  }
  const { valuesMode = 'relations' } = options;

  const S = new DictBuilder();
  const P = new DictBuilder();
  const M = new DictBuilder();
  const VD = new ValueDictBuilder();

  const moduleReverse = new Map((full.modules || []).map((m, i) => [m.id, i]));
  const fileReverse = new Map((full.files || []).map((f, i) => [f.id, i]));
  const funcReverse = new Map((full.functions || []).map((f, i) => [f.id, i]));

  // --- mi ---
  const miN = [];
  const miF = [];
  const filesByMod = new Map();
  (full.files || []).forEach((f, i) => {
    const mIdx = moduleReverse.get(f.moduleId) ?? 0;
    if (!filesByMod.has(mIdx)) filesByMod.set(mIdx, []);
    filesByMod.get(mIdx).push(i);
  });
  (full.modules || []).forEach((m, i) => {
    miN.push(m.name);
    const fIdxs = filesByMod.get(i) || [];
    miF.push([fIdxs[0] ?? 0, fIdxs.length]);
  });

  // --- fl ---
  const flP = [];
  const flM = [];
  (full.files || []).forEach(f => {
    flP.push(f.path);
    flM.push(moduleReverse.get(f.moduleId) ?? 0);
  });

  // --- fns ---
  const fnsN = [],
    fnsM = [],
    fnsF = [],
    fnsL = [],
    fnsFl = [],
    fnsP = [],
    fnsRt = [];
  (full.functions || []).forEach(fn => {
    fnsN.push(S.add(fn.name));
    fnsM.push(moduleReverse.get(fn.moduleId) ?? 0);
    fnsF.push(fileReverse.get(fn.fileId) ?? 0);
    fnsL.push(fn.line);
    fnsFl.push(encodeFlags(fn));
    fnsP.push((fn.params || []).map(p => P.add(p)));
    fnsRt.push(S.add(fn.returnType));
  });

  // --- cls ---
  const clsN = [],
    clsM = [],
    clsF = [],
    clsL = [],
    clsFl = [],
    clsMethods = [];
  (full.classes || []).forEach(c => {
    clsN.push(S.add(c.name));
    clsM.push(moduleReverse.get(c.moduleId) ?? 0);
    clsF.push(fileReverse.get(c.fileId) ?? 0);
    clsL.push(c.line);
    clsFl.push(encodeFlags(c));
    clsMethods.push((c.methods || []).map(m => M.add(m)));
  });

  // --- cn ---
  const cnN = [],
    cnM = [],
    cnF = [],
    cnL = [],
    cnFl = [],
    cnV = [];
  (full.constants || []).forEach((c, idx) => {
    cnN.push(S.add(c.name));
    cnM.push(moduleReverse.get(c.moduleId) ?? 0);
    cnF.push(fileReverse.get(c.fileId) ?? 0);
    cnL.push(c.line);
    cnFl.push(encodeFlags(c));
    const vi = VD.add(c.value, `cn_${c.name}`);
    if (vi >= 0) cnV.push([idx, vi]);
  });

  // --- gr.e ---
  const geM = [],
    geF = [],
    geFn = [],
    geL = [],
    geTy = [];
  const geEn = [],
    geLn = [],
    geS = [],
    geFlags = [];
  (full.exports || []).forEach(e => {
    const ty = e.isDefault ? 1 : e.isTypeOnly || e.type === 'type' ? 2 : 0;
    let fl = 0;
    if (e.isTypeOnly) fl |= 1;
    if (e.isReExport) fl |= 2;
    if (e.isStarReExport) fl |= 4;
    if (e.isDefaultReExport) fl |= 8;
    geM.push(moduleReverse.get(e.moduleId) ?? 0);
    geF.push(fileReverse.get(e.fileId) ?? 0);
    geFn.push(funcReverse.get(e.functionId) ?? 0);
    geL.push(e.line);
    geTy.push(ty);
    geEn.push(S.add(e.exportName));
    geLn.push(S.add(e.localName));
    geS.push(S.add(e.source));
    geFlags.push(fl);
  });

  // --- gr.i ---
  const giFf = [],
    giTf = [],
    giS = [],
    giIm = [],
    giLn = [],
    giL = [],
    giTy = [];
  (full.imports || []).forEach(im => {
    const tc = im.isDefault ? 1 : im.isNamespace ? 2 : im.isTypeOnly ? 3 : 0;
    giFf.push(fileReverse.get(im.fromFileId) ?? 0);
    giTf.push(S.add(im.toFileId));
    giS.push(S.add(im.source));
    giIm.push(S.add(im.importedName));
    giLn.push(S.add(im.localName));
    giL.push(im.line);
    giTy.push(tc | (im.isExternal ? 4 : 0));
  });

  // --- gr.c ---
  const gcF = [],
    gcT = [],
    gcL = [],
    gcTy = [];
  (full.calls || []).forEach(c => {
    const isExt = c.toFunctionId.startsWith('external:');
    const tc = c.type === 'direct' ? 0 : c.type === 'async' ? 1 : c.type === 'method' ? 2 : 3;
    gcF.push(funcReverse.get(c.fromFunctionId) ?? 0);
    gcT.push(isExt ? S.add(c.toFunctionId) : (funcReverse.get(c.toFunctionId) ?? 0));
    gcL.push(c.line);
    gcTy.push(tc | (isExt ? 4 : 0));
  });

  // --- gr.re ---
  const greM = [],
    greFn = [],
    greS = [],
    greEn = [],
    greL = [],
    greTy = [];
  (full.reExports || []).forEach(r => {
    const tc = r.isStarReExport ? 2 : r.isDefault ? 1 : 0;
    greM.push(moduleReverse.get(r.moduleId) ?? 0);
    greFn.push(funcReverse.get(r.functionId) ?? 0);
    greS.push(S.add(r.source));
    greEn.push(S.add(r.exportName));
    greL.push(r.line);
    greTy.push(tc | (r.isTypeOnly ? 4 : 0));
  });

  // --- ✅ v13.0.2: фильтрация values в режиме 'relations' ---
  let finalValueDict = VD.list;
  let valueIndexMap = null;

  if (valuesMode === 'relations') {
    const filtered = filterValues(VD.list, VD.meta);
    finalValueDict = filtered.values;
    valueIndexMap = filtered.indexMap;
  }

  // Переиндексация cn.nonEmptyV после фильтрации
  const finalCnV = [];
  for (const [cnIdx, valIdx] of cnV) {
    if (valueIndexMap) {
      const newValIdx = remapIndex(valIdx, valueIndexMap);
      if (newValIdx === null) continue;
      finalCnV.push([cnIdx, newValIdx]);
    } else {
      finalCnV.push([cnIdx, valIdx]);
    }
  }

  // --- tokens ---
  const allStrings = [...S.list, ...P.list, ...M.list];
  const tokens = buildTokenDict(allStrings);
  const tokenIndex = new Map(tokens.map((t, i) => [t, i]));

  return {
    v: CODEC_VERSION,
    ts: full.timestamp || '',
    r: moduleReverse.get(full.root) ?? 0,
    valuesMode,
    tokens,
    strs: S.list.map(s => encodeStr(s, tokenIndex)),
    params: P.list.map(s => encodeStr(s, tokenIndex)),
    methods: M.list.map(s => encodeStr(s, tokenIndex)),
    values: finalValueDict,
    mi: { n: miN, f: miF },
    fl: { p: flP, m: rle(flM) },
    fns: {
      n: fnsN,
      m: rle(fnsM),
      f: rle(fnsF),
      l: fnsL,
      fl: fnsFl,
      p: fnsP,
      rt: fnsRt,
    },
    cls: {
      n: clsN,
      m: rle(clsM),
      f: rle(clsF),
      l: clsL,
      fl: clsFl,
      methods: clsMethods,
    },
    cn: {
      n: cnN,
      m: rle(cnM),
      f: rle(cnF),
      l: cnL,
      fl: cnFl,
      nonEmptyV: finalCnV,
    },
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
      i: {
        ff: giFf,
        tf: giTf,
        s: giS,
        im: giIm,
        ln: giLn,
        l: giL,
        ty: giTy,
      },
      c: { f: gcF, t: gcT, l: gcL, ty: gcTy },
      re: { m: greM, fn: greFn, s: greS, en: greEn, l: greL, ty: greTy },
    },
    st: full.statistics || {},
    legend: buildLegend(),
  };
}

function buildLegend() {
  return {
    codes: {
      export: EXPORT_TYPES,
      import: IMPORT_TYPES,
      call: CALL_TYPES,
      reExport: RE_EXPORT_TYPES,
      lifecycle: LIFECYCLE_TYPES,
      effect: EFFECT_TYPES,
      injection: INJECTION_TYPES,
      reactivity: REACTIVITY_TYPES,
      conditional: CONDITIONAL_TYPES,
      typeKind: TYPE_KINDS,
      typeUsage: TYPE_USAGE_KINDS,
    },
    flags: {
      bits: Object.fromEntries(Object.entries(FLAG_MAP).map(([b, n]) => [b, n])),
    },
    schemas: {
      mi: ['n', 'f'],
      fl: ['p', 'm'],
      fns: ['n', 'm', 'f', 'l', 'fl', 'p', 'rt'],
      cls: ['n', 'm', 'f', 'l', 'fl', 'methods'],
      cn: ['n', 'm', 'f', 'l', 'fl', 'nonEmptyV'],
      'gr.e': ['m', 'f', 'fn', 'l', 'ty', 'en', 'ln', 's', 'flags'],
      'gr.i': ['ff', 'tf', 's', 'im', 'ln', 'l', 'ty'],
      'gr.c': ['f', 't', 'l', 'ty'],
      'gr.re': ['m', 'fn', 's', 'en', 'l', 'ty'],
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
  };
}

// ---------------------------------------------------------------------------
// EDGES
// ---------------------------------------------------------------------------

export function buildEdgesFromFull(full) {
  const edges = [];

  for (const im of full.imports || []) {
    edges.push({
      from: im.fromFileId,
      to: im.toFileId || (im.isExternal ? `external:${im.packageName || im.source}` : 'unknown'),
      type: 'import',
      symbol: im.importedName,
      line: im.line || 0,
    });
  }

  for (const ex of full.exports || []) {
    edges.push({
      from: ex.fileId,
      to: ex.functionId || ex.moduleId,
      type: 'export',
      symbol: ex.exportName,
      line: ex.line || 0,
    });
  }

  for (const c of full.calls || []) {
    edges.push({
      from: c.fromFunctionId,
      to: c.toFunctionId || 'unknown',
      type: 'call',
      line: c.line || 0,
    });
  }

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

export function buildEdgesStats(edges) {
  const byType = {};
  for (const e of edges || []) {
    const t = e.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }
  return { totalEdges: (edges || []).length, byType };
}

// ---------------------------------------------------------------------------
// ROUND-TRIP
// ---------------------------------------------------------------------------

export function roundTripSemantic(compact) {
  const full1 = decodeCompactData(compact);
  const compact2 = encodeToCompactData(full1);
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
  const compact2 = encodeToCompactData(full);
  const a = stripForByteCompare(compact);
  const b = stripForByteCompare(compact2);
  const ok = deepEqual(a, b);
  return {
    full,
    compact: compact2,
    ok,
    diff: ok ? null : diffObjects(a, b),
  };
}

export function roundTripEncode(full) {
  const c1 = encodeToCompactData(full);
  const f2 = decodeCompactData(c1);
  const c2 = encodeToCompactData(f2);
  const ok = deepEqual(c1, c2);
  return {
    compact: c1,
    full: f2,
    reEncoded: c2,
    ok,
    diff: ok ? null : diffObjects(c1, c2),
  };
}

// ---------------------------------------------------------------------------
// АВТООПРЕДЕЛЕНИЕ
// ---------------------------------------------------------------------------

export function detectFormat(json) {
  if (!json || typeof json !== 'object') return 'unknown';
  if (json.v && json.mi && typeof json.mi === 'object' && !Array.isArray(json.mi)) {
    return 'compact';
  }
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
// ВЕРИФИКАЦИЯ
// ---------------------------------------------------------------------------

function verifyRoundTrip(payload, options = {}) {
  try {
    const compact = encodeToCompactData(payload);
    const decoded = decodeCompactData(compact, options);
    const a = stripServiceFields(payload);
    const b = stripServiceFields(decoded);
    const ok = deepEqual(a, b);
    return {
      ok,
      error: ok ? undefined : 'Mismatch',
      details: ok ? undefined : { diff: diffObjects(a, b) },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function check(fn) {
  try {
    const diffs = fn() || [];
    return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
  } catch (e) {
    return {
      ok: false,
      diffCount: 1,
      diff: [{ path: '$', a: 'error', b: e.message }],
    };
  }
}

function verifyRoundTripBoth(full, compact) {
  const report = {
    timestamp: new Date().toISOString(),
    full_to_compact: check(() => collectDiffs(compact, encodeToCompactData(full))),
    compact_to_full: check(() => {
      decodeCompactData(compact);
      return [];
    }),
    compact_to_full_to_compact: check(() => {
      const d = decodeCompactData(compact);
      return collectDiffs(compact, encodeToCompactData(d));
    }),
    full_to_compact_to_full: check(() => {
      const d = decodeCompactData(encodeToCompactData(full));
      return collectDiffs(stripServiceFields(full), stripServiceFields(d));
    }),
    encode_idempotent: check(() => {
      const c1 = encodeToCompactData(full);
      const f1 = decodeCompactData(c1);
      return collectDiffs(c1, encodeToCompactData(f1));
    }),
    decode_idempotent: check(() => {
      const f1 = decodeCompactData(compact);
      return collectDiffs(f1, decodeCompactData(encodeToCompactData(f1)));
    }),
  };
  report.ok = Object.values(report).every(v => typeof v !== 'object' || v.ok !== false);
  return report;
}

// ---------------------------------------------------------------------------
// ФАСАД
// ---------------------------------------------------------------------------

export const Codec = {
  encode: encodeToCompactData,
  decode: decodeCompactData,
  verifyRoundTrip,
  verifyRoundTripBoth,
  getLegend: () => buildLegend(),
  buildEdges: buildEdgesFromFull,
  buildEdgesStats,
};

// ---------------------------------------------------------------------------
// ЭКСПОРТ ДЛЯ ОТЛАДКИ
// ---------------------------------------------------------------------------

export const __internals = {
  DictBuilder,
  ValueDictBuilder,
  decodeStr,
  tokenizeStr,
  buildTokenDict,
  encodeStr,
  classifyValue,
  filterValues,
  remapIndex,
  deepEqual,
  diffObjects,
  arrayEq,
  stripServiceFields,
  stripForByteCompare,
  idToNum,
};

export default Codec;
