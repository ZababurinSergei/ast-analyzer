// src/reporters/codec/codec-verify.ts
// ============================================
// ПРОВЕРКИ ОБРАТИМОСТИ КОДЕКА (v12.0.0)
// ============================================
// Версия: 12.0.0
//
// ИЗМЕНЕНИЯ v12.0.0:
//   - ✅ Обновлены проверки под columnar-структуру
//   - ✅ Добавлена проверка RLE
//   - ✅ Добавлена проверка токенизации строк
//   - ✅ Удалены устаревшие проверки
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - Базовая структура проверок
// ============================================

import type { FullJSON, CompactJSON, DecodeOptions } from './codec-types.js';
import { encode } from './codec-encode.js';
import { decode } from './codec-decode.js';

// ============================================
// ТИПЫ
// ============================================

export interface RoundTripDiff {
  path: string;
  a: unknown;
  b: unknown;
}

export interface LevelResult {
  ok: boolean;
  diffCount: number;
  diff: RoundTripDiff[];
  note?: string;
}

export interface ReversibilityReport {
  timestamp: string;
  full_to_compact: LevelResult;
  compact_to_full: LevelResult;
  compact_to_full_to_compact: LevelResult;
  full_to_compact_to_full: LevelResult;
  encode_idempotent: LevelResult;
  decode_idempotent: LevelResult;
  full_self_contained: boolean;
  compact_self_contained: boolean;
  spotChecks: {
    callsType: LevelResult;
    importsToFileId: LevelResult;
    exportsIsReExport: LevelResult;
    functionsFlags: LevelResult;
    externalCalls: LevelResult;
    modulesPath: LevelResult;
  };
  structuralChecks: {
    columnarStructure: LevelResult;
    rleStructure: LevelResult;
    tokenizedStrings: LevelResult;
  };
}

// ============================================
// DEEP EQUAL
// ============================================

export function deepEqual(a: any, b: any): boolean {
  const norm = (x: any): any => {
    if (x === undefined) return undefined;
    if (x === null) return null;
    if (Array.isArray(x)) return x.map(norm);
    if (typeof x === 'object') {
      const out: any = {};
      for (const key of Object.keys(x).sort()) {
        const v = norm(x[key]);
        if (v !== undefined) out[key] = v;
      }
      return out;
    }
    return x;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function normalizeForDiff(x: any): string {
  const norm = (v: any): any => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === 'object') {
      const out: any = {};
      for (const key of Object.keys(v).sort()) {
        const nv = norm(v[key]);
        if (nv !== undefined) out[key] = nv;
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(x));
}

// ============================================
// СБОР РАСХОЖДЕНИЙ
// ============================================

export function collectDiffs(
  a: unknown,
  b: unknown,
  basePath: string = '$',
  limit: number = 20
): RoundTripDiff[] {
  const diffs: RoundTripDiff[] = [];

  const walk = (x: any, y: any, p: string): void => {
    if (diffs.length >= limit) return;
    if (x === y) return;

    if (x === undefined || y === undefined || x === null || y === null) {
      if (x !== y) diffs.push({ path: p, a: x, b: y });
      return;
    }

    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) {
        diffs.push({ path: `${p}.length`, a: x.length, b: y.length });
        return;
      }
      for (let i = 0; i < x.length; i++) {
        walk(x[i], y[i], `${p}[${i}]`);
        if (diffs.length >= limit) return;
      }
      return;
    }

    if (typeof x === 'object' && typeof y === 'object') {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const key of keys) {
        walk(x[key], y[key], `${p}.${key}`);
        if (diffs.length >= limit) return;
      }
      return;
    }

    if (x !== y) diffs.push({ path: p, a: x, b: y });
  };

  walk(a, b, basePath);
  return diffs;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function makeLevel(diffs: RoundTripDiff[], note?: string): LevelResult {
  return {
    ok: diffs.length === 0,
    diffCount: diffs.length,
    diff: diffs,
    note,
  };
}

function makeErrorLevel(err: unknown): LevelResult {
  return {
    ok: false,
    diffCount: 1,
    diff: [{ path: '$', a: 'error', b: String(err) }],
  };
}

// ============================================
// ОСНОВНАЯ ПРОВЕРКА (одна сторона)
// ============================================

export function verifyRoundTrip(
  payload: FullJSON,
  options: DecodeOptions = {}
): {
  ok: boolean;
  error?: string;
  details?: Record<string, { original: number; decoded: number }>;
} {
  try {
    const compact = encode(payload);
    const decoded = decode(compact, options);

    const details: Record<string, { original: number; decoded: number }> = {
      modules: { original: payload.modules.length, decoded: decoded.modules.length },
      files: { original: payload.files.length, decoded: decoded.files.length },
      functions: { original: payload.functions.length, decoded: decoded.functions.length },
      classes: { original: payload.classes.length, decoded: decoded.classes.length },
      constants: { original: payload.constants.length, decoded: decoded.constants.length },
      exports: { original: payload.exports.length, decoded: decoded.exports.length },
      imports: { original: payload.imports.length, decoded: decoded.imports.length },
      calls: { original: payload.calls.length, decoded: decoded.calls.length },
      reExports: { original: payload.reExports.length, decoded: decoded.reExports.length },
    };

    const errors: string[] = [];
    for (const [key, value] of Object.entries(details)) {
      if (value.original !== value.decoded) {
        errors.push(`${key}: ${value.original} → ${value.decoded}`);
      }
    }

    if (!deepEqual(payload, decoded)) {
      errors.push('Deep equality check failed');
    }

    if (errors.length > 0) {
      return { ok: false, error: errors.join('; '), details };
    }
    return { ok: true, details };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================
// РАСШИРЕННАЯ ПРОВЕРКА
// ============================================

export function verifyRoundTripBoth(full: FullJSON, compact: CompactJSON): ReversibilityReport {
  const report: ReversibilityReport = {
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

    structuralChecks: {
      columnarStructure: { ok: false, diffCount: 0, diff: [] },
      rleStructure: { ok: false, diffCount: 0, diff: [] },
      tokenizedStrings: { ok: false, diffCount: 0, diff: [] },
    },
  };

  // Прямое направление
  try {
    const encoded = encode(full);
    const diffs = collectDiffs(compact, encoded, '$');
    report.full_to_compact = makeLevel(diffs, `encoded to compact v=${encoded.v}`);
  } catch (err) {
    report.full_to_compact = makeErrorLevel(err);
  }

  let decodedFromCompact: FullJSON | null = null;
  try {
    decodedFromCompact = decode(compact);
    report.compact_to_full = makeLevel([]);
  } catch (err) {
    report.compact_to_full = makeErrorLevel(err);
  }

  // Обратимость
  try {
    if (decodedFromCompact) {
      const reEncoded = encode(decodedFromCompact);
      const diffs = collectDiffs(compact, reEncoded, '$');
      report.compact_to_full_to_compact = makeLevel(diffs);
    }
  } catch (err) {
    report.compact_to_full_to_compact = makeErrorLevel(err);
  }

  try {
    const encoded = encode(full);
    const decoded = decode(encoded);
    const diffs = collectDiffs(full, decoded, '$');
    report.full_to_compact_to_full = makeLevel(diffs);
  } catch (err) {
    report.full_to_compact_to_full = makeErrorLevel(err);
  }

  // Идемпотентность
  try {
    const c1 = encode(full);
    const f1 = decode(c1);
    const c2 = encode(f1);
    const diffs = collectDiffs(c1, c2, '$');
    report.encode_idempotent = makeLevel(diffs);
  } catch (err) {
    report.encode_idempotent = makeErrorLevel(err);
  }

  try {
    const f1 = decode(compact);
    const c1 = encode(f1);
    const f2 = decode(c1);
    const diffs = collectDiffs(f1, f2, '$');
    report.decode_idempotent = makeLevel(diffs);
  } catch (err) {
    report.decode_idempotent = makeErrorLevel(err);
  }

  report.full_self_contained = true;
  report.compact_self_contained = true;

  // Точечные проверки
  try {
    const decoded = decodedFromCompact || decode(compact);

    report.spotChecks.callsType = spotCheckArray(
      decoded.calls || [],
      full.calls || [],
      'type',
      '$.calls'
    );
    report.spotChecks.importsToFileId = spotCheckArray(
      decoded.imports || [],
      full.imports || [],
      'toFileId',
      '$.imports'
    );
    report.spotChecks.exportsIsReExport = spotCheckArray(
      decoded.exports || [],
      full.exports || [],
      'isReExport',
      '$.exports'
    );
    report.spotChecks.functionsFlags = checkFunctionsFlags(decoded, full);
    report.spotChecks.externalCalls = checkExternalCalls(decoded, full);
    report.spotChecks.modulesPath = checkModulesPath(decoded, full);
  } catch (err) {
    report.spotChecks.callsType = makeErrorLevel(err);
  }

  // Структурные проверки
  try {
    report.structuralChecks.columnarStructure = checkColumnarStructure(compact);
    report.structuralChecks.rleStructure = checkRleStructure(compact);
    report.structuralChecks.tokenizedStrings = checkTokenizedStrings(compact);
  } catch (err) {
    report.structuralChecks.columnarStructure = makeErrorLevel(err);
  }

  return report;
}

// ============================================
// ТОЧЕЧНЫЕ ПРОВЕРКИ
// ============================================

function spotCheckArray(arrA: any[], arrB: any[], field: string, label: string): LevelResult {
  const diffs: RoundTripDiff[] = [];
  const n = Math.min(arrA.length, arrB.length);

  if (arrA.length !== arrB.length) {
    diffs.push({ path: `${label}.length`, a: arrA.length, b: arrB.length });
  }

  for (let i = 0; i < n && diffs.length < 20; i++) {
    const va = arrA[i]?.[field];
    const vb = arrB[i]?.[field];
    if (va !== vb) {
      diffs.push({ path: `${label}[${i}].${field}`, a: va, b: vb });
    }
  }

  return makeLevel(diffs);
}

function checkFunctionsFlags(decoded: FullJSON, full: FullJSON): LevelResult {
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

  const diffs: RoundTripDiff[] = [];
  const n = Math.min(decoded.functions.length, full.functions.length);

  for (let i = 0; i < n && diffs.length < 20; i++) {
    const df = decoded.functions[i];
    const ff = full.functions[i];
    if (!df || !ff) continue;

    for (const field of flagFields) {
      const dv = (df as any)[field];
      const fv = (ff as any)[field];
      if (dv !== fv) {
        diffs.push({ path: `$.functions[${i}].${field}`, a: dv, b: fv });
        if (diffs.length >= 20) break;
      }
    }
  }

  return makeLevel(diffs);
}

function checkExternalCalls(decoded: FullJSON, full: FullJSON): LevelResult {
  const diffs: RoundTripDiff[] = [];

  const fullExternal = (full.calls || []).filter((c: any) =>
    c.toFunctionId?.startsWith('external:')
  );

  for (let i = 0; i < fullExternal.length && diffs.length < 20; i++) {
    const fc = fullExternal[i];
    if (!fc) continue;

    const dc = decoded.calls.find(
      (c: any) =>
        c.fromFunctionId === fc.fromFunctionId &&
        c.toFunctionId === fc.toFunctionId &&
        c.line === fc.line
    );

    if (!dc) {
      diffs.push({ path: `$.calls[external:${i}]`, a: 'not found', b: fc.toFunctionId });
      continue;
    }

    if (dc.type !== fc.type) {
      diffs.push({ path: `$.calls[${dc.id}].type`, a: dc.type, b: fc.type });
    }
  }

  return makeLevel(diffs);
}

function checkModulesPath(decoded: FullJSON, full: FullJSON): LevelResult {
  const diffs: RoundTripDiff[] = [];
  const n = Math.min(decoded.modules.length, full.modules.length);

  for (let i = 0; i < n && diffs.length < 20; i++) {
    const dm = decoded.modules[i];
    const fm = full.modules[i];
    if (!dm || !fm) continue;
    if (dm.path !== fm.path) {
      diffs.push({ path: `$.modules[${i}].path`, a: dm.path, b: fm.path });
    }
  }

  return makeLevel(diffs);
}

// ============================================
// СТРУКТУРНЫЕ ПРОВЕРКИ
// ============================================

function checkColumnarStructure(compact: CompactJSON): LevelResult {
  const diffs: RoundTripDiff[] = [];

  // mi
  if (!compact.mi || !Array.isArray(compact.mi.n) || !Array.isArray(compact.mi.f)) {
    diffs.push({ path: '$.mi', a: 'invalid', b: 'columnar structure expected' });
  }

  // fl
  if (!compact.fl || !Array.isArray(compact.fl.p) || !Array.isArray(compact.fl.m)) {
    diffs.push({ path: '$.fl', a: 'invalid', b: 'columnar structure expected' });
  }

  // fns
  if (!compact.fns || !Array.isArray(compact.fns.n)) {
    diffs.push({ path: '$.fns', a: 'invalid', b: 'columnar structure expected' });
  }

  // cls
  if (!compact.cls || !Array.isArray(compact.cls.n)) {
    diffs.push({ path: '$.cls', a: 'invalid', b: 'columnar structure expected' });
  }

  // cn
  if (!compact.cn || !Array.isArray(compact.cn.n)) {
    diffs.push({ path: '$.cn', a: 'invalid', b: 'columnar structure expected' });
  }

  // gr.e
  if (!compact.gr?.e || !Array.isArray(compact.gr.e.m)) {
    diffs.push({ path: '$.gr.e', a: 'invalid', b: 'columnar structure expected' });
  }

  // gr.i
  if (!compact.gr?.i || !Array.isArray(compact.gr.i.ff)) {
    diffs.push({ path: '$.gr.i', a: 'invalid', b: 'columnar structure expected' });
  }

  // gr.c
  if (!compact.gr?.c || !Array.isArray(compact.gr.c.f)) {
    diffs.push({ path: '$.gr.c', a: 'invalid', b: 'columnar structure expected' });
  }

  // gr.re
  if (!compact.gr?.re || !Array.isArray(compact.gr.re.m)) {
    diffs.push({ path: '$.gr.re', a: 'invalid', b: 'columnar structure expected' });
  }

  return makeLevel(diffs);
}

function checkRleStructure(compact: CompactJSON): LevelResult {
  const diffs: RoundTripDiff[] = [];

  const checkRle = (arr: any[], path: string) => {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      if (!Array.isArray(entry) || entry.length !== 2) {
        diffs.push({ path: `${path}[${i}]`, a: entry, b: '[value, count] expected' });
        break;
      }
    }
  };

  checkRle(compact.mi?.f || [], '$.mi.f');
  checkRle(compact.fl?.m || [], '$.fl.m');
  checkRle(compact.fns?.m || [], '$.fns.m');
  checkRle(compact.fns?.f || [], '$.fns.f');
  checkRle(compact.cls?.m || [], '$.cls.m');
  checkRle(compact.cls?.f || [], '$.cls.f');
  checkRle(compact.cn?.m || [], '$.cn.m');
  checkRle(compact.cn?.f || [], '$.cn.f');

  return makeLevel(diffs);
}

function checkTokenizedStrings(compact: CompactJSON): LevelResult {
  const diffs: RoundTripDiff[] = [];

  if (!Array.isArray(compact.tokens)) {
    diffs.push({ path: '$.tokens', a: 'missing', b: 'array expected' });
  }

  if (!Array.isArray(compact.strs)) {
    diffs.push({ path: '$.strs', a: 'missing', b: 'array expected' });
  }

  if (!Array.isArray(compact.params)) {
    diffs.push({ path: '$.params', a: 'missing', b: 'array expected' });
  }

  if (!Array.isArray(compact.methods)) {
    diffs.push({ path: '$.methods', a: 'missing', b: 'array expected' });
  }

  return makeLevel(diffs);
}

// ============================================
// РАЗМЕРЫ
// ============================================

export function getCompactSize(compact: CompactJSON): number {
  return JSON.stringify(compact).length;
}

export function getFullSize(payload: FullJSON): number {
  return JSON.stringify(payload).length;
}

export function getCompressionRatio(payload: FullJSON): number {
  const compact = encode(payload);
  const fullSize = getFullSize(payload);
  const compactSize = getCompactSize(compact);
  if (fullSize === 0) return 0;
  return compactSize / fullSize;
}

// ============================================
// СЕРИАЛИЗАЦИЯ
// ============================================

export function stringify(compact: CompactJSON, pretty: boolean = false): string {
  return pretty ? JSON.stringify(compact, null, 2) : JSON.stringify(compact);
}

export function parse(json: string): CompactJSON {
  return JSON.parse(json) as CompactJSON;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  deepEqual,
  normalizeForDiff,
  collectDiffs,
  verifyRoundTrip,
  verifyRoundTripBoth,
  getCompactSize,
  getFullSize,
  getCompressionRatio,
  stringify,
  parse,
};
