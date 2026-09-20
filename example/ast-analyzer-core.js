// ============================================================================
// AST ANALYZER — CORE v13.0.7
// ============================================================================

import {
  decodeCompactData,
  encodeToCompactData,
  detectFormat,
  toFullData,
  roundTripSemantic,
  roundTripByteExact,
  roundTripEncode,
  buildEdgesFromFull,
  buildEdgesStats,
  CODEC_VERSION,
  decodeFlagsFromNumber,
  decodeStr,
} from './ast-analyzer-codec.js';

import {
  deepEqual,
  diffObjects,
  collectDiffs,
  normalizeForDiff,
  stripServiceFields,
  stripForByteCompare,
  debounce,
  unrle,
} from './ast-analyzer-utils.js';

import { showProgress, setProgress, hideProgress } from './ast-analyzer-progress.js';

export { deepEqual, diffObjects, collectDiffs, normalizeForDiff, debounce };

// ============================================================================
// STATE
// ============================================================================

export const state = {
  raw: null,
  originalFormat: null,
  originalCompact: null,
  __codec: null,
  rawCompact: null,
  rawFull: null,
  hasBothFormats: false,
  includeEdgesOnLoad: false,

  modules: {},
  files: {},
  functions: {},
  classes: {},
  constants: {},
  exports: [],
  imports: [],
  calls: [],
  reExports: [],

  fileExports: {},
  fileImports: {},
  fileFunctions: {},
  fileClasses: {},
  fileConstants: {},
  moduleFiles: {},

  fnById: {},
  fnCalls: {},
  fnCallers: {},
  fnExports: {},
  fnImportTargets: {},
  fnDetailedCallers: {},
  fnDetailedCalls: {},
  fnByName: {},

  constById: {},
  constByName: {},
  classById: {},
  classByName: {},

  fileDependents: {},
  fileDependencies: {},
  fileByPath: {},
  moduleByName: {},

  externalCallers: Object.create(null),

  deadExports: [],
  deadFunctions: [],
  cyclicDeps: [],
  hotFiles: [],
  hotFunctions: [],

  statistics: {},
  version: '?',
  timestamp: '',
  valuesMode: 'relations',

  selectedFileId: null,
  activeNode: null,
  searchQuery: '',
  depsOnly: false,
  expandAllFns: false,
  currentTab: 'overview',

  __fileDepsBuilt: false,
  __fnCallBuilt: false,
  __fnImportTargetsBuilt: false,
  __extCallersBuilt: false,
  __stats: null,
};

// ============================================================================
// УТИЛИТЫ
// ============================================================================

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );
}

export function shortPath(p, max = 40) {
  if (!p) return '';
  if (p.length <= max) return p;
  return '…' + p.slice(-(max - 1));
}

export function middleEllipsis(p, max = 40) {
  if (!p) return '';
  const s = String(p);
  if (s.length <= max) return s;
  const inner = max - 1;
  if (inner <= 0) return '…';
  const head = Math.ceil(inner / 2);
  const tail = Math.floor(inner / 2);
  return s.slice(0, head) + '…' + s.slice(-tail);
}

export function formatNumber(n) {
  if (n == null) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function formatDate(ts) {
  if (!ts) return '?';
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export function formatType(t, max = 80) {
  if (!t) return '';
  let s = String(t);
  s = s.replace(/import\(["']([^"']+)["']\)\./g, '');
  s = s.replace(/import\('([^']+)'\)\./g, '');
  s = s.replace(/\s+/g, ' ');
  if (s.length > max) s = s.slice(0, max - 1) + '…';
  return s;
}

export function copyToClipboard(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

export function downloadBlob(content, filename, mime = 'application/json') {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(data, filename) {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function downloadCSV(rows, columns, filename) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = columns.map((c) => esc(c.label || c.key)).join(',');
  const body = rows
    .map((r) =>
      columns
        .map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key]))
        .join(',')
    )
    .join('\n');
  downloadBlob('\uFEFF' + header + '\n' + body, filename, 'text/csv;charset=utf-8');
}

export function downloadSVG(svgEl, filename) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const s = new XMLSerializer().serializeToString(clone);
  downloadBlob(s, filename, 'image/svg+xml');
}

// ============================================================================
// YIELD / IDLE
// ============================================================================

function _yield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function _idle(fn, timeout = 2000) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(fn, { timeout });
  }
  return setTimeout(fn, 1);
}

// ============================================================================
// CHUNKED DECODE
// ============================================================================

/**
 * Асинхронная версия decodeCompactData: разбивает работу на фазы,
 * между фазами отдаёт управление UI. Возвращает Promise<full>.
 *
 * @param {object} compact
 * @param {(info: {phase: string, pct: number}) => void} [onProgress]
 * @returns {Promise<object>}
 */
export async function decodeCompactDataChunked(compact, onProgress = null) {
  if (!compact || typeof compact !== 'object') {
    throw new Error('decodeCompactDataChunked: ожидается объект');
  }

  const report = (phase, pct) => {
    if (onProgress) onProgress({ phase, pct });
  };

  const tokens = compact.tokens || [];
  const stringDict = (compact.strs || []).map((s) => decodeStr(s, tokens));
  const paramDict = (compact.params || []).map((s) => decodeStr(s, tokens));
  const methodDict = (compact.methods || []).map((s) => decodeStr(s, tokens));
  const valueDict = compact.values || [];

  const readStr = (i) => (i == null || i < 0 ? '' : stringDict[i] ?? '');
  const readStrOpt = (i) => (i == null || i < 0 ? undefined : stringDict[i]);
  const readPar = (i) => (i == null || i < 0 ? '' : paramDict[i] ?? '');
  const readMeth = (i) => (i == null || i < 0 ? null : methodDict[i] ?? null);
  const readVal = (i) => (i == null || i < 0 ? undefined : valueDict[i]);

  // ---- 1. files + modules ----
  report('files', 5);
  await _yield();

  const flP = compact.fl?.p || [];
  const flM = unrle(compact.fl?.m || []);
  const files = flP.map((p, i) => ({
    id: `f${i + 1}`,
    path: p || '',
    moduleId: `m${(flM[i] ?? 0) + 1}`,
  }));

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

  // ---- 2. functions ----
  report('functions', 25);
  await _yield();

  const fns = compact.fns || { n: [], m: [], f: [], l: [], fl: [], p: [], rt: [] };
  const fnsM = unrle(fns.m || []);
  const fnsF = unrle(fns.f || []);
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
    for (const k of extras) if (fl[k]) fn[k] = true;
    return fn;
  });

  // ---- 3. classes ----
  report('classes', 40);
  await _yield();

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

  // ---- 4. constants ----
  report('constants', 55);
  await _yield();

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

  // ---- 5. exports ----
  report('exports', 70);
  await _yield();

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

  // ---- 6. imports ----
  report('imports', 80);
  await _yield();

  const gi = compact.gr?.i || { ff: [], tf: [], s: [], im: [], ln: [], l: [], ty: [] };
  const imports = (gi.ff || []).map((ff, i) => {
    const c = gi.ty?.[i] ?? 0;
    const tc = c & 3;
    const isExt = (c & 4) !== 0;
    const type =
      tc === 1 ? 'default' : tc === 2 ? 'namespace' : tc === 3 ? 'type' : 'named';
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

  // ---- 7. calls + reExports ----
  report('calls', 90);
  await _yield();

  const gc = compact.gr?.c || { f: [], t: [], l: [], ty: [] };
  const calls = (gc.f || []).map((fromIdx, i) => {
    const c = gc.ty?.[i] ?? 0;
    const tc = c & 3;
    const isExt = (c & 4) !== 0;
    const type =
      tc === 1 ? 'async' : tc === 2 ? 'method' : tc === 3 ? 'callback' : 'direct';
    return {
      id: `c${i + 1}`,
      fromFunctionId: `fn${fromIdx + 1}`,
      toFunctionId: isExt ? readStr(gc.t?.[i]) : `fn${(gc.t?.[i] ?? 0) + 1}`,
      line: gc.l?.[i] ?? 0,
      type,
    };
  });

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

  report('done', 100);

  return {
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
}

// ============================================================================
// PREPROCESS — только быстрые индексы (по ID)
// ============================================================================

export function preprocess(rawData) {
  const d = {
    modules: {},
    files: {},
    functions: {},
    classes: {},
    constants: {},
    exports: [],
    imports: [],
    calls: [],
    reExports: [],

    fileExports: {},
    fileImports: {},
    fileFunctions: {},
    fileClasses: {},
    fileConstants: {},
    moduleFiles: {},

    fnById: {},
    fnCalls: {},
    fnCallers: {},
    fnExports: {},
    fnImportTargets: {},
    fnDetailedCallers: {},
    fnDetailedCalls: {},
    fnByName: {},

    constById: {},
    constByName: {},
    classById: {},
    classByName: {},

    fileDependents: {},
    fileDependencies: {},
    fileByPath: {},
    moduleByName: {},

    externalCallers: Object.create(null),

    deadExports: [],
    deadFunctions: [],
    cyclicDeps: [],
    hotFiles: [],
    hotFunctions: [],

    statistics: rawData.statistics || {},
    version: rawData.version || '?',
    timestamp: rawData.timestamp || '',
  };

  // ---- modules ----
  for (const m of rawData.modules || []) {
    d.modules[m.id] = m;
    d.moduleFiles[m.id] = m.fileIds || [];
    d.moduleByName[m.name] = m;
  }

  // ---- files ----
  for (const f of rawData.files || []) {
    d.files[f.id] = f;
    d.fileExports[f.id] = [];
    d.fileImports[f.id] = [];
    d.fileFunctions[f.id] = [];
    d.fileClasses[f.id] = [];
    d.fileConstants[f.id] = [];
    d.fileDependents[f.id] = [];
    d.fileDependencies[f.id] = [];
    d.fileByPath[f.path] = f;
  }

  // ---- functions ----
  for (const fn of rawData.functions || []) {
    d.functions[fn.id] = fn;
    d.fnById[fn.id] = fn;
    d.fnCalls[fn.id] = [];
    d.fnCallers[fn.id] = [];
    d.fnExports[fn.id] = [];
    d.fnImportTargets[fn.id] = [];
    d.fnDetailedCallers[fn.id] = [];
    d.fnDetailedCalls[fn.id] = [];
    if (d.fileFunctions[fn.fileId]) d.fileFunctions[fn.fileId].push(fn);
    if (!d.fnByName[fn.name]) d.fnByName[fn.name] = [];
    d.fnByName[fn.name].push(fn.id);
  }

  // ---- classes ----
  for (const c of rawData.classes || []) {
    d.classes[c.id] = c;
    d.classById[c.id] = c;
    d.classByName[c.name] = c;
    if (d.fileClasses[c.fileId]) d.fileClasses[c.fileId].push(c);
  }

  // ---- constants ----
  for (const cn of rawData.constants || []) {
    d.constants[cn.id] = cn;
    d.constById[cn.id] = cn;
    if (!d.constByName[cn.name]) d.constByName[cn.name] = [];
    d.constByName[cn.name].push(cn.id);
    if (d.fileConstants[cn.fileId]) d.fileConstants[cn.fileId].push(cn);
  }

  // ---- exports ----
  for (const e of rawData.exports || []) {
    d.exports.push(e);
    if (d.fileExports[e.fileId]) d.fileExports[e.fileId].push(e);
    if (e.functionId && d.fnExports[e.functionId]) d.fnExports[e.functionId].push(e);
  }

  // ---- imports (только fileImports — быстро) ----
  for (const i of rawData.imports || []) {
    d.imports.push(i);
    if (d.fileImports[i.fromFileId]) d.fileImports[i.fromFileId].push(i);
  }

  // ---- calls ----
  for (const c of rawData.calls || []) {
    d.calls.push(c);
  }

  // ---- reExports ----
  for (const r of rawData.reExports || []) {
    d.reExports.push(r);
  }

  return d;
}

// ============================================================================
// LAZY INDEXES
// ============================================================================

const _lazyBuilt = new Set();

function _ensure(key, builder) {
  if (_lazyBuilt.has(key)) return;
  builder();
  _lazyBuilt.add(key);
}

function _resetLazy() {
  _lazyBuilt.clear();
}

function _buildFileDepsIndex() {
  if (state.__fileDepsBuilt) return;
  state.fileDependents = {};
  state.fileDependencies = {};
  for (const f of Object.values(state.files)) {
    state.fileDependents[f.id] = [];
    state.fileDependencies[f.id] = [];
  }
  for (const i of state.imports) {
    if (!i.toFileId || i.isExternal) continue;
    if (state.fileDependencies[i.fromFileId])
      state.fileDependencies[i.fromFileId].push(i.toFileId);
    if (state.fileDependents[i.toFileId])
      state.fileDependents[i.toFileId].push(i.fromFileId);
  }
  state.__fileDepsBuilt = true;
}

function _buildFnCallIndex() {
  if (state.__fnCallBuilt) return;
  for (const fn of Object.values(state.functions)) {
    state.fnCalls[fn.id] = [];
    state.fnCallers[fn.id] = [];
    state.fnDetailedCalls[fn.id] = [];
    state.fnDetailedCallers[fn.id] = [];
  }

  for (const c of state.calls) {
    if (state.fnCalls[c.fromFunctionId]) state.fnCalls[c.fromFunctionId].push(c);
    if (state.fnCallers[c.toFunctionId]) state.fnCallers[c.toFunctionId].push(c);

    const fromFn = state.fnById[c.fromFunctionId];
    const toFn = state.fnById[c.toFunctionId];

    if (fromFn && state.fnDetailedCalls[c.fromFunctionId]) {
      state.fnDetailedCalls[c.fromFunctionId].push({
        toFnId: c.toFunctionId,
        toFnName: toFn ? toFn.name : c.toFunctionId,
        toFilePath: toFn
          ? state.files[toFn.fileId]?.path || '?'
          : c.toFunctionId.startsWith('external:')
            ? '🌐 external'
            : '?',
        toModuleName: toFn
          ? state.modules[state.files[toFn.fileId]?.moduleId]?.name || '?'
          : 'external',
        callLine: c.line,
        callType: c.type || 'direct',
        isExternal: c.toFunctionId.startsWith('external:'),
      });
    }
    if (toFn && state.fnDetailedCallers[c.toFunctionId]) {
      state.fnDetailedCallers[c.toFunctionId].push({
        fromFnId: c.fromFunctionId,
        fromFnName: fromFn ? fromFn.name : c.fromFunctionId,
        fromFilePath: fromFn ? state.files[fromFn.fileId]?.path || '?' : '?',
        fromModuleName: fromFn
          ? state.modules[state.files[fromFn.fileId]?.moduleId]?.name || '?'
          : '?',
        callLine: c.line,
        callType: c.type || 'direct',
      });
    }
  }
  state.__fnCallBuilt = true;
}

function _buildFnImportTargetsIndex() {
  if (state.__fnImportTargetsBuilt) return;
  for (const fn of Object.values(state.functions)) {
    state.fnImportTargets[fn.id] = [];
  }
  for (const i of state.imports) {
    if (!i.toFileId || i.isExternal) continue;
    const targetExports = state.fileExports[i.toFileId] || [];
    const importName = i.importedName;
    const matched = targetExports.find(
      (e) =>
        e.exportName === importName ||
        e.localName === importName ||
        (importName === 'default' && e.isDefault) ||
        (i.isNamespace && e.isExported)
    );
    if (matched && matched.functionId && state.fnImportTargets[matched.functionId]) {
      state.fnImportTargets[matched.functionId].push({
        toFileId: i.fromFileId,
        toFilePath: state.files[i.fromFileId]?.path || '?',
        toModuleName:
          state.modules[state.files[i.fromFileId]?.moduleId]?.name || '?',
        importName: i.localName || importName,
        originalName: importName,
        source: i.source,
        line: i.line,
        isDefault: i.isDefault,
        isNamespace: i.isNamespace,
        isTypeOnly: i.isTypeOnly,
        importId: i.id,
      });
    }
  }
  state.__fnImportTargetsBuilt = true;
}

function _buildExternalCallersIndex() {
  if (state.__extCallersBuilt) return;
  state.externalCallers = Object.create(null);
  for (const c of state.calls) {
    if (!c.toFunctionId.startsWith('external:')) continue;
    const extName = c.toFunctionId.replace('external:', '');
    const fromFn = state.fnById[c.fromFunctionId];
    if (!Array.isArray(state.externalCallers[extName])) {
      state.externalCallers[extName] = [];
    }
    state.externalCallers[extName].push({
      fromFnId: c.fromFunctionId,
      fromFnName: fromFn ? fromFn.name : c.fromFunctionId,
      fromFilePath: fromFn ? state.files[fromFn.fileId]?.path || '?' : '?',
      fromModuleName: fromFn
        ? state.modules[state.files[fromFn.fileId]?.moduleId]?.name || '?'
        : '?',
      callLine: c.line,
      callType: c.type || 'direct',
    });
  }
  state.__extCallersBuilt = true;
}

export function ensureIndexes() {
  _ensure('fileDeps', _buildFileDepsIndex);
  _ensure('fnCall', _buildFnCallIndex);
  _ensure('fnImportTargets', _buildFnImportTargetsIndex);
  _ensure('extCallers', _buildExternalCallersIndex);
}

export function scheduleIdleIndexing() {
  _idle(() => _buildFileDepsIndex(), 500);
  _idle(() => _buildFnCallIndex(), 1500);
  _idle(() => _buildFnImportTargetsIndex(), 3000);
  _idle(() => _buildExternalCallersIndex(), 4000);
  _idle(() => computeDeadExports(), 4500);
  _idle(() => computeDeadFunctions(), 5000);
  _idle(() => computeCyclicDeps(), 5500);
  _idle(() => computeHotFiles(), 6000);
  _idle(() => computeHotFunctions(), 6500);
}

// ============================================================================
// SECTION CACHE
// ============================================================================

const _sectionCache = new Map();
const _sectionOrder = [];
const _SECTION_MAX = 200;

export function renderSectionCached(key, builder) {
  if (_sectionCache.has(key)) {
    const idx = _sectionOrder.indexOf(key);
    if (idx >= 0) {
      _sectionOrder.splice(idx, 1);
      _sectionOrder.push(key);
    }
    return _sectionCache.get(key);
  }
  const html = builder();
  _sectionCache.set(key, html);
  _sectionOrder.push(key);
  if (_sectionOrder.length > _SECTION_MAX) {
    const evict = _sectionOrder.shift();
    _sectionCache.delete(evict);
  }
  return html;
}

export function invalidateSectionCache(prefix = null) {
  if (!prefix) {
    _sectionCache.clear();
    _sectionOrder.length = 0;
    return;
  }
  for (const k of [..._sectionCache.keys()]) {
    if (k.startsWith(prefix)) {
      _sectionCache.delete(k);
      const idx = _sectionOrder.indexOf(k);
      if (idx >= 0) _sectionOrder.splice(idx, 1);
    }
  }
}

// ============================================================================
// LOAD DECODED + BUILD INDEXES
// ============================================================================

export function loadDecoded(full, originalJson, fmt) {
  resetState();

  state.raw = full;
  state.originalFormat = fmt;
  state.originalCompact = fmt === 'compact' ? originalJson : null;
  state.valuesMode = full.valuesMode || 'relations';

  if (fmt === 'compact') {
    state.rawCompact = originalJson;
    const tokens = originalJson.tokens || [];
    const decodeStrEntry = (entry) => {
      if (typeof entry === 'string') return entry;
      if (Array.isArray(entry)) return entry.map((i) => tokens[i] || '').join('');
      return '';
    };
    state.__codec = {
      stringDict: (originalJson.strs || []).map(decodeStrEntry),
      paramDict: (originalJson.params || []).map(decodeStrEntry),
      methodDict: (originalJson.methods || []).map(decodeStrEntry),
      valueDict: originalJson.values || [],
      legend: originalJson.legend,
      schemas: originalJson.legend?.schemas || {},
    };
  } else if (fmt === 'full') {
    state.rawFull = originalJson;
    state.__codec = full.__codec || null;
  }

  const pre = preprocess(full);
  Object.assign(state, pre);

  _resetLazy();
  invalidateSectionCache();

  return state;
}

export function buildIndexes() {
  const t0 = performance.now();
  _buildFileDepsIndex();
  const t1 = performance.now();
  _buildFnCallIndex();
  const t2 = performance.now();
  _buildFnImportTargetsIndex();
  _buildExternalCallersIndex();
  const t3 = performance.now();

  state.__stats = getProjectStats();

  console.log(
    `[AST] buildIndexes: fileDeps=${(t1 - t0).toFixed(0)}ms, ` +
    `fnCalls=${(t2 - t1).toFixed(0)}ms, ` +
    `importTargets=${(t3 - t2).toFixed(0)}ms`
  );
  return state;
}

export function getProjectStatsCached() {
  if (!state.__stats) state.__stats = getProjectStats();
  return state.__stats;
}

// ============================================================================
// LOAD DATA (синхронный, для совместимости)
// ============================================================================

export function loadData(json, options = {}) {
  const fmt = detectFormat(json);
  const { includeEdges = false } = options;
  console.log(`[AST] Формат входа: ${fmt} (includeEdges=${includeEdges})`);

  let full;
  try {
    full = toFullData(json);
  } catch (e) {
    throw new Error(`Не удалось декодировать JSON: ${e.message}`);
  }

  if (includeEdges) {
    try {
      const { edges, stats } = buildEdgesFromFull(full);
      full.edges = edges;
      full.edgesStats = stats;
    } catch (e) {
      console.warn('[AST] Не удалось собрать edges:', e.message);
    }
  }

  if (!full.files || !full.modules) {
    throw new Error('Неверный формат JSON: ожидаются поля files и modules');
  }

  return loadDecoded(full, json, fmt);
}

// ============================================================================
// RESET
// ============================================================================

function resetState() {
  state.raw = null;
  state.originalFormat = null;
  state.originalCompact = null;
  state.__codec = null;
  state.rawCompact = null;
  state.rawFull = null;
  state.hasBothFormats = false;
  state.includeEdgesOnLoad = false;

  state.modules = {};
  state.files = {};
  state.functions = {};
  state.classes = {};
  state.constants = {};
  state.exports = [];
  state.imports = [];
  state.calls = [];
  state.reExports = [];

  state.fileExports = {};
  state.fileImports = {};
  state.fileFunctions = {};
  state.fileClasses = {};
  state.fileConstants = {};
  state.moduleFiles = {};

  state.fnById = {};
  state.fnCalls = {};
  state.fnCallers = {};
  state.fnExports = {};
  state.fnImportTargets = {};
  state.fnDetailedCallers = {};
  state.fnDetailedCalls = {};
  state.fnByName = {};

  state.constById = {};
  state.constByName = {};
  state.classById = {};
  state.classByName = {};

  state.fileDependents = {};
  state.fileDependencies = {};
  state.fileByPath = {};
  state.moduleByName = {};

  state.externalCallers = Object.create(null);

  state.deadExports = [];
  state.deadFunctions = [];
  state.cyclicDeps = [];
  state.hotFiles = [];
  state.hotFunctions = [];

  state.statistics = {};
  state.version = '?';
  state.timestamp = '';
  state.valuesMode = 'relations';

  state.selectedFileId = null;
  state.activeNode = null;
  state.searchQuery = '';
  state.depsOnly = false;
  state.expandAllFns = false;
  state.currentTab = 'overview';

  state.__fileDepsBuilt = false;
  state.__fnCallBuilt = false;
  state.__fnImportTargetsBuilt = false;
  state.__extCallersBuilt = false;
  state.__stats = null;

  _resetLazy();
  invalidateSectionCache();
}

// ============================================================================
// COMPUTE ANALYTICS (лениво — через scheduleIdleIndexing)
// ============================================================================

export function computeAnalytics() {
  // Намеренно пусто: аналитика строится лениво в scheduleIdleIndexing()
  // или принудительно через ensureAnalytics().
}

export function ensureAnalytics() {
  _ensure('deadExports', () => computeDeadExports());
  _ensure('deadFunctions', () => computeDeadFunctions());
  _ensure('cyclicDeps', () => computeCyclicDeps());
  _ensure('hotFiles', () => computeHotFiles());
  _ensure('hotFunctions', () => computeHotFunctions());
}

function computeDeadExports() {
  const used = new Set();
  for (const imp of state.imports) {
    if (imp.isExternal) continue;
    if (imp.importedName) used.add(imp.toFileId + '::' + imp.importedName);
  }
  state.deadExports = state.exports.filter((e) => {
    if (e.isDefault) return false;
    return !used.has(e.fileId + '::' + (e.exportName || e.localName));
  });
}

function computeDeadFunctions() {
  state.deadFunctions = Object.values(state.functions).filter((fn) => {
    const hasCallers = (state.fnDetailedCallers[fn.id] || []).length > 0;
    const isExported = (state.fnExports[fn.id] || []).length > 0;
    const isImported = (state.fnImportTargets[fn.id] || []).length > 0;
    return !hasCallers && !isExported && !isImported;
  });
}

function computeCyclicDeps() {
  const cycles = [];
  const visited = new Set();
  const stack = [];
  const inStack = new Set();

  function dfs(fileId) {
    if (inStack.has(fileId)) {
      const idx = stack.indexOf(fileId);
      if (idx >= 0) cycles.push(stack.slice(idx).concat(fileId));
      return;
    }
    if (visited.has(fileId)) return;
    visited.add(fileId);
    inStack.add(fileId);
    stack.push(fileId);
    for (const dep of new Set(state.fileDependencies[fileId] || [])) dfs(dep);
    stack.pop();
    inStack.delete(fileId);
  }

  for (const fileId of Object.keys(state.files)) dfs(fileId);

  const seen = new Set();
  state.cyclicDeps = cycles.filter((c) => {
    const key = [...new Set(c)].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeHotFiles() {
  const arr = Object.keys(state.files).map((id) => {
    const out = new Set(state.fileDependencies[id] || []).size;
    const inc = new Set(state.fileDependents[id] || []).size;
    return { id, out, inc, total: out + inc };
  });
  arr.sort((a, b) => b.total - a.total);
  state.hotFiles = arr.slice(0, 30);
}

function computeHotFunctions() {
  const arr = Object.values(state.functions).map((fn) => {
    const callers = (state.fnDetailedCallers[fn.id] || []).length;
    const calls = (state.fnDetailedCalls[fn.id] || []).length;
    return { id: fn.id, callers, calls, total: callers + calls };
  });
  arr.sort((a, b) => b.total - a.total);
  state.hotFunctions = arr.slice(0, 30);
}

// ============================================================================
// ТРАНЗИТИВНЫЕ ВЫЗОВЫ
// ============================================================================

export function getTransitiveCallers(fnId, maxDepth = 5) {
  const result = new Set();
  const queue = [{ id: fnId, depth: 0 }];
  const seen = new Set([fnId]);
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth >= maxDepth) continue;
    for (const c of state.fnDetailedCallers[id] || []) {
      if (!result.has(c.fromFnId)) {
        result.add(c.fromFnId);
        if (!seen.has(c.fromFnId)) {
          seen.add(c.fromFnId);
          queue.push({ id: c.fromFnId, depth: depth + 1 });
        }
      }
    }
  }
  return Array.from(result)
    .map((id) => state.fnById[id])
    .filter(Boolean);
}

export function getTransitiveCallees(fnId, maxDepth = 5) {
  const result = new Set();
  const queue = [{ id: fnId, depth: 0 }];
  const seen = new Set([fnId]);
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth >= maxDepth) continue;
    for (const c of state.fnDetailedCalls[id] || []) {
      if (c.isExternal) continue;
      if (!result.has(c.toFnId)) {
        result.add(c.toFnId);
        if (!seen.has(c.toFnId)) {
          seen.add(c.toFnId);
          queue.push({ id: c.toFnId, depth: depth + 1 });
        }
      }
    }
  }
  return Array.from(result)
    .map((id) => state.fnById[id])
    .filter(Boolean);
}

export function findCallPaths(fromFnId, toFnId, maxDepth = 5) {
  const paths = [];
  const stack = [fromFnId];
  const visited = new Set();

  function dfs(current) {
    if (stack.length > maxDepth) return;
    if (current === toFnId) {
      paths.push([...stack]);
      return;
    }
    visited.add(current);
    for (const c of state.fnDetailedCalls[current] || []) {
      if (c.isExternal) continue;
      if (visited.has(c.toFnId)) continue;
      stack.push(c.toFnId);
      dfs(c.toFnId);
      stack.pop();
    }
    visited.delete(current);
  }

  dfs(fromFnId);
  return paths;
}

// ============================================================================
// ПОИСК
// ============================================================================

export function findFunctions(query, { caseSensitive = false, exact = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  const m = exact
    ? (s) => (caseSensitive ? s : s.toLowerCase()) === q
    : (s) => (caseSensitive ? s : s.toLowerCase()).includes(q);
  return Object.values(state.functions).filter((fn) => m(fn.name));
}

export function findConstants(query, { caseSensitive = false, exact = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  const m = exact
    ? (s) => (caseSensitive ? s : s.toLowerCase()) === q
    : (s) => (caseSensitive ? s : s.toLowerCase()).includes(q);
  return Object.values(state.constants).filter((c) => m(c.name));
}

export function findFiles(query, { caseSensitive = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  return Object.values(state.files).filter((f) =>
    (caseSensitive ? f.path : f.path.toLowerCase()).includes(q)
  );
}

export function findModules(query, { caseSensitive = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  return Object.values(state.modules).filter((m) =>
    (caseSensitive ? m.name : m.name.toLowerCase()).includes(q)
  );
}

// ============================================================================
// СТАТИСТИКА
// ============================================================================

export function getProjectStats() {
  const externalPkgs = new Set();
  for (const i of state.imports) {
    if (i.isExternal && i.packageName) externalPkgs.add(i.packageName);
  }

  return {
    totalFiles: Object.keys(state.files).length,
    totalFunctions: Object.keys(state.functions).length,
    totalModules: Object.keys(state.modules).length,
    totalConstants: Object.keys(state.constants).length,
    totalCalls: state.calls.length,
    totalImports: state.imports.length,
    totalExports: state.exports.length,
    totalReExports: state.reExports.length,
    internalImports: state.imports.filter((i) => !i.isExternal).length,
    externalImports: state.imports.filter((i) => i.isExternal).length,
    externalPackages: Array.from(externalPkgs).sort(),
    deadExports: state.deadExports.length,
    deadFunctions: state.deadFunctions.length,
    cyclicDeps: state.cyclicDeps.length,
    version: state.version,
    timestamp: state.timestamp,
    valuesMode: state.valuesMode,
  };
}

export function getModuleStats(moduleId) {
  const m = state.modules[moduleId];
  if (!m) return null;
  const fileIds = state.moduleFiles[moduleId] || [];
  let fnCount = 0;
  let constCount = 0;
  let exportCount = 0;
  let importCount = 0;
  for (const fid of fileIds) {
    fnCount += (state.fileFunctions[fid] || []).length;
    constCount += (state.fileConstants[fid] || []).length;
    exportCount += (state.fileExports[fid] || []).length;
    importCount += (state.fileImports[fid] || []).length;
  }
  return {
    ...m,
    fileCount: fileIds.length,
    fnCount,
    constCount,
    exportCount,
    importCount,
  };
}

// ============================================================================
// ДОСТУП
// ============================================================================

export function getModuleName(id) {
  return state.modules[id]?.name || id;
}

export function getFilePath(id) {
  return state.files[id]?.path || id;
}

export function getFnById(id) {
  return state.fnById[id] || null;
}

export function getFileById(id) {
  return state.files[id] || null;
}

export function getModuleById(id) {
  return state.modules[id] || null;
}

export function getFnFullInfo(fnId) {
  const fn = state.fnById[fnId];
  if (!fn) return null;
  const file = state.files[fn.fileId];
  const module = file ? state.modules[file.moduleId] : null;
  return {
    fn,
    file,
    module,
    exports: state.fnExports[fnId] || [],
    imports: state.fnImportTargets[fnId] || [],
    calls: state.fnDetailedCalls[fnId] || [],
    callers: state.fnDetailedCallers[fnId] || [],
  };
}

export function getImportedNames(importerId, targetId) {
  const list = (state.fileImports[importerId] || []).filter(
    (i) => i.toFileId === targetId
  );
  const names = [];
  for (const i of list) {
    if (i.isNamespace) names.push('*');
    else if (i.isDefault) names.push('default');
    else if (i.importedName) names.push(i.importedName);
  }
  return [...new Set(names)];
}

// ============================================================================
// ЭКСПОРТ
// ============================================================================

export function exportAll() {
  return {
    version: CODEC_VERSION,
    timestamp: state.timestamp,
    valuesMode: state.valuesMode,
    root: state.raw?.root || 'm1',
    statistics: state.statistics,
    modules: Object.values(state.modules),
    files: Object.values(state.files),
    functions: Object.values(state.functions),
    classes: Object.values(state.classes),
    constants: Object.values(state.constants),
    exports: state.exports,
    imports: state.imports,
    calls: state.calls,
    reExports: state.reExports,
  };
}

export function exportCompact(options = {}) {
  const { valuesMode = state.valuesMode || 'relations' } = options;
  const full = exportAll();
  if (state.__codec) full.__codec = state.__codec;
  return encodeToCompactData(full, { valuesMode });
}

export function downloadCompact(filename = 'index.json', options = {}) {
  const compact = exportCompact(options);
  downloadJSON(compact, filename);
  return compact;
}

export function downloadFull(filename = 'index.full.json') {
  const full = exportAll();
  downloadJSON(full, filename);
  return full;
}

export function exportEdges() {
  const full = exportAll();
  return buildEdgesFromFull(full);
}

export function downloadEdges(filename = 'index.edges.json') {
  const { edges, stats } = exportEdges();
  const payload = {
    version: state.version,
    timestamp: state.timestamp || new Date().toISOString(),
    root: state.raw?.root || '',
    edges,
    stats,
  };
  downloadJSON(payload, filename);
  return { edges, stats };
}

export function getEdgesStats() {
  return exportEdges().stats;
}

// ============================================================================
// ROUND-TRIP ОБЁРТКИ
// ============================================================================

export function verifyRoundTripSemantic() {
  if (!state.originalCompact) {
    return { ok: false, reason: 'Исходный файл не в компактном формате' };
  }
  return roundTripSemantic(state.originalCompact);
}

export function verifyRoundTripByteExact() {
  if (!state.originalCompact) {
    return { ok: false, reason: 'Исходный файл не в компактном формате' };
  }
  return roundTripByteExact(state.originalCompact);
}

export function verifyRoundTripEncode() {
  const full = exportAll();
  if (state.__codec) full.__codec = state.__codec;
  return roundTripEncode(full);
}

export function verifyRoundTripBothFormats() {
  const hasCompact = !!state.rawCompact;
  const hasFull = !!state.rawFull;

  if (!hasCompact && !hasFull) {
    return { ok: false, reason: 'Не загружен ни один файл' };
  }

  const result = {
    hasCompact,
    hasFull,
    L0: null,
    L1: null,
    L2: null,
    L3: null,
    RE: null,
  };

  if (hasCompact && hasFull) {
    try {
      const decodedCompact = decodeCompactData(state.rawCompact, {
        includeEdges: state.includeEdgesOnLoad,
      });
      const a = stripServiceFields(decodedCompact);
      const b = stripServiceFields(state.rawFull);
      const ok = deepEqual(a, b);
      result.L2 = { ok, diff: ok ? null : diffObjects(a, b) };
    } catch (e) {
      result.L2 = { ok: false, error: e.message };
    }
  }

  if (hasCompact && hasFull) {
    try {
      const fullForEncoding = {
        ...state.rawFull,
        __codec: state.rawCompact?.__codec,
      };
      const encodedFromFull = encodeToCompactData(fullForEncoding, {
        reuseDicts: true,
        strict: true,
      });
      const a = stripForByteCompare(state.rawCompact);
      const b = stripForByteCompare(encodedFromFull);
      const ok = deepEqual(a, b);
      result.L0 = { ok, diff: ok ? null : diffObjects(a, b) };
    } catch (e) {
      result.L0 = { ok: false, error: e.message };
    }
  }

  if (hasCompact) {
    try {
      result.L1 = roundTripSemantic(state.rawCompact);
    } catch (e) {
      result.L1 = { ok: false, error: e.message };
    }
    try {
      result.L3 = roundTripByteExact(state.rawCompact);
    } catch (e) {
      result.L3 = { ok: false, error: e.message };
    }
  }

  try {
    const full = exportAll();
    if (state.__codec) full.__codec = state.__codec;
    result.RE = roundTripEncode(full);
  } catch (e) {
    result.RE = { ok: false, error: e.message };
  }

  const checked = ['L0', 'L1', 'L2', 'L3', 'RE'].filter((k) => result[k] !== null);
  result.ok = checked.every((k) => result[k].ok);
  result.checkedLevels = checked;

  return result;
}

// ============================================================================
// ЗАГРУЗКА ОБОИХ ФОРМАТОВ
// ============================================================================

export function loadBothFormats(json, fmt = null, filename = '') {
  const realFmt = fmt || detectFormat(json);
  if (realFmt === 'compact') state.rawCompact = json;
  else if (realFmt === 'full') state.rawFull = json;
  else {
    console.warn('[AST] loadBothFormats: неизвестный формат', filename);
    return;
  }
  if (state.rawCompact && state.rawFull) {
    state.hasBothFormats = true;
    console.log(`[AST] Загружены оба формата: compact + full (${filename})`);
  }
}

export function clearBothFormats() {
  state.rawCompact = null;
  state.rawFull = null;
  state.hasBothFormats = false;
}

// ============================================================================
// ЗАГРУЗКА ИЗ КОРНЯ
// ============================================================================

const LS_DATA_KEY = 'ast-analyzer:v13:data';
const LS_URL_KEY = 'ast-analyzer:v13:url';
const DEFAULT_CACHE_TTL = 3600_000;

export function clearRootCache() {
  localStorage.removeItem(LS_DATA_KEY);
  localStorage.removeItem(LS_URL_KEY);
}

export function getRootCacheInfo() {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    if (!raw) return null;
    const { url, ts } = JSON.parse(raw);
    return {
      url,
      ts,
      age: Date.now() - ts,
      ageHuman: formatAge(Date.now() - ts),
    };
  } catch {
    return null;
  }
}

function formatAge(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} сек назад`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function readCache(ttl) {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    if (!raw) return null;
    const { url, ts, json } = JSON.parse(raw);
    if (!ts || Date.now() - ts > ttl) {
      localStorage.removeItem(LS_DATA_KEY);
      localStorage.removeItem(LS_URL_KEY);
      return null;
    }
    return { url, json };
  } catch {
    return null;
  }
}

function writeCache(url, json) {
  try {
    localStorage.setItem(
      LS_DATA_KEY,
      JSON.stringify({ url, ts: Date.now(), json })
    );
  } catch (e) {
    console.warn('[AST] Не удалось записать кэш:', e.message);
  }
}

async function scanDirectoryForIndex(basePath, silent) {
  const url = basePath || './';
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return [];
    const html = await res.text();
    const found = new Set();
    const re = /href="([^"]*index[^"]*\.json)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      let href = m[1];
      href = href.split('?')[0];
      const name = href.replace(/^\.?\//, '');
      if (name && !name.includes('/')) found.add(name);
    }
    return [...found].sort((a, b) => a.localeCompare(b));
  } catch (e) {
    if (!silent) console.warn('[AST] scanDirectoryForIndex:', e.message);
    return [];
  }
}

function pickFileAndParse() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    let resolved = false;
    const cleanup = () => {
      if (input.parentNode) document.body.removeChild(input);
    };

    input.addEventListener('change', () => {
      if (resolved) return;
      resolved = true;
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          resolve(JSON.parse(ev.target.result));
        } catch (e) {
          console.error('[AST] Ошибка парсинга JSON:', e);
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });

    input.addEventListener('cancel', () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(null);
    });

    input.click();
  });
}

/**
 * Загружает JSON из корня проекта.
 * Всегда использует chunked decode + buildIndexes.
 */
export async function loadFromRoot(options = {}) {
  const {
    basePath = '',
    candidates = ['index.json', 'index.full.json'],
    useCache = true,
    cacheTTL = DEFAULT_CACHE_TTL,
    fallbackToFilePicker = true,
    silent = false,
    scanDir = false,
    includeEdges = false,
  } = options;

  const log = silent ? () => {} : (...a) => console.log('[AST]', ...a);
  const warn = silent ? () => {} : (...a) => console.warn('[AST]', ...a);

  const tryLoadSecondFormat = async (primaryFormat) => {
    for (const name of candidates) {
      if (primaryFormat === 'compact' && name === 'index.json') continue;
      if (primaryFormat === 'full' && name === 'index.full.json') continue;
      const url = basePath + name;
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) continue;
        const rawJson = await res.json();
        const fmt = detectFormat(rawJson);
        loadBothFormats(rawJson, fmt, url);
        log(`✓ Догружен второй формат: ${url} (${fmt})`);
      } catch (e) {
        warn(`Второй формат ${url} не догружен:`, e.message);
      }
    }
  };

  // 1. Кэш
  if (useCache) {
    const cached = readCache(cacheTTL);
    if (cached) {
      log(`✓ Из кэша: ${cached.url}`);
      try {
        const fmt = detectFormat(cached.json);
        let full;
        if (fmt === 'compact') {
          showProgress('Декодирование (кэш)…');
          full = await decodeCompactDataChunked(
            cached.json,
            ({ phase, pct }) => {
              setProgress(pct, `Декодирование: ${phase} (${pct}%)`);
            }
          );
        } else {
          full = cached.json;
        }
        loadDecoded(full, cached.json, fmt);
        buildIndexes();
        hideProgress();

        await tryLoadSecondFormat(state.originalFormat);
        return state;
      } catch (e) {
        hideProgress();
        warn('Кэш повреждён, перезагружаем:', e.message);
        clearRootCache();
      }
    }
  }

  // 2. Сканирование
  let effectiveCandidates = candidates.slice();
  if (scanDir) {
    try {
      const found = await scanDirectoryForIndex(basePath, silent);
      if (found.length) {
        effectiveCandidates = [
          ...found,
          ...candidates.filter((c) => !found.includes(c)),
        ];
        log(`Найдено через сканирование: ${found.join(', ')}`);
      }
    } catch (e) {
      warn('Сканирование не удалось:', e.message);
    }
  }

  // 3. Fetch с перебором всех кандидатов
  const errors = [];
  const loaded = [];

  for (const name of effectiveCandidates) {
    const url = basePath + name;
    try {
      log(`Пробуем: ${url}`);
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        errors.push(`${url}: HTML вместо JSON`);
        continue;
      }
      const rawJson = await res.json();
      const fmt = detectFormat(rawJson);
      log(`✓ Загружено: ${url} (формат: ${fmt})`);
      loaded.push({ url, json: rawJson, fmt });
      if (useCache && loaded.length === 1) {
        writeCache(url, rawJson);
        try {
          localStorage.setItem(LS_URL_KEY, url);
        } catch {}
      }
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }

  if (loaded.length === 0) {
    if (fallbackToFilePicker) {
      log('Переключаемся на выбор файла…');
      const picked = await pickFileAndParse();
      if (picked) {
        const fmt = detectFormat(picked);
        let full;
        if (fmt === 'compact') {
          showProgress('Декодирование (файл)…');
          full = await decodeCompactDataChunked(picked, ({ phase, pct }) => {
            setProgress(pct, `Декодирование: ${phase} (${pct}%)`);
          });
        } else {
          full = picked;
        }
        loadDecoded(full, picked, fmt);
        buildIndexes();
        hideProgress();
        if (useCache) writeCache('(manual)', picked);
        return state;
      }
    }
    throw new Error(
      `Не удалось загрузить JSON из корня проекта.\nПопытки:\n  - ${errors.join('\n  - ')}`
    );
  }

  const primary = loaded.find((x) => x.fmt === 'compact') || loaded[0];

  let full;
  if (primary.fmt === 'compact') {
    showProgress('Декодирование…');
    full = await decodeCompactDataChunked(primary.json, ({ phase, pct }) => {
      setProgress(pct, `Декодирование: ${phase} (${pct}%)`);
    });
  } else {
    full = primary.json;
  }

  loadDecoded(full, primary.json, primary.fmt);
  buildIndexes();
  hideProgress();

  for (const other of loaded) {
    if (other === primary) continue;
    try {
      loadBothFormats(other.json, other.fmt, other.url);
    } catch (e) {
      warn('loadBothFormats не удался:', e.message);
    }
  }

  return state;
}

// ============================================================================
// РЕЭКСПОРТ ИЗ КОДЕКА
// ============================================================================

export {
  decodeCompactData,
  encodeToCompactData,
  detectFormat,
  toFullData,
  roundTripSemantic,
  roundTripByteExact,
  roundTripEncode,
  buildEdgesFromFull,
  buildEdgesStats,
  CODEC_VERSION,
};
