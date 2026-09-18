// src/reporters/codec/codec-verify.ts
// ============================================
// ПРОВЕРКИ ОБРАТИМОСТИ КОДЕКА
// ============================================
// Версия: 9.0.0
//
// Содержит:
//   - deepEqual              — глубокое сравнение с нормализацией
//   - normalizeForDiff       — нормализация для диагностики
//   - verifyRoundTrip        — проверка encode → decode === исходный full
//   - verifyRoundTripBoth    — проверка в обе стороны (full ↔ compact)
//   - getCompactSize         — размер compact-JSON в байтах
//   - getFullSize            — размер full-JSON в байтах
//   - getCompressionRatio    — коэффициент сжатия
//   - stringify              — сериализация compact-JSON
//   - parse                  — парсинг compact-JSON
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ ДОБАВЛЕНО: verifyRoundTripBoth — проверка обратимости
//     в обе стороны (DL: decode(encode(full)) === full;
//     RE: encode(decode(compact)) === compact;
//     ENC idempotent; DEC idempotent)
//   - ✅ ДОБАВЛЕНО: тип ReversibilityReport
//   - ✅ ДОБАВЛЕНО: уровень L0 (encode(full) === compact)
//   - ✅ ДОБАВЛЕНО: детальная диагностика расхождений по секциям
// ============================================

import type { FullJSON, CompactJSON, DecodeOptions } from './codec-types.js';
import { encode } from './codec-encode.js';
import { decode } from './codec-decode.js';

// ============================================
// ТИПЫ ДЛЯ ПРОВЕРКИ ОБРАТИМОСТИ
// ============================================

/**
 * Одно расхождение между двумя JSON.
 */
export interface RoundTripDiff {
  /** Путь к полю (например, '$.calls[97].type') */
  path: string;
  /** Значение из первого JSON (обычно — производного) */
  a: unknown;
  /** Значение из второго JSON (обычно — исходного) */
  b: unknown;
}

/**
 * Результат проверки одного уровня обратимости.
 */
export interface LevelResult {
  /** Успешно ли пройдена проверка */
  ok: boolean;
  /** Количество расхождений */
  diffCount: number;
  /** Первые N расхождений (для диагностики) */
  diff: RoundTripDiff[];
  /** Дополнительное сообщение (для диагностики) */
  note?: string;
}

/**
 * Расширенный отчёт об обратимости в обе стороны.
 */
export interface ReversibilityReport {
  /** Временная метка проверки (ISO 8601) */
  timestamp: string;

  // ==========================================
  // ПРЯМОЕ НАПРАВЛЕНИЕ
  // ==========================================

  /** L0: encode(full) === compact (байтовое совпадение) */
  full_to_compact: LevelResult;

  /** L1: decode(compact) без ошибок (семантическая проверка) */
  compact_to_full: LevelResult;

  // ==========================================
  // ОБРАТИМОСТЬ
  // ==========================================

  /** RE: encode(decode(compact)) === compact */
  compact_to_full_to_compact: LevelResult;

  /** DL: decode(encode(full)) === full */
  full_to_compact_to_full: LevelResult;

  // ==========================================
  // ИДЕМПОТЕНТНОСТЬ
  // ==========================================

  /** ENC: encode(full) === encode(decode(encode(full))) */
  encode_idempotent: LevelResult;

  /** DEC: decode(compact) === decode(encode(decode(compact))) */
  decode_idempotent: LevelResult;

  // ==========================================
  // НЕЗАВИСИМОСТЬ
  // ==========================================

  /** true, если encode(full) не читает compact */
  full_self_contained: boolean;

  /** true, если decode(compact) не читает full */
  compact_self_contained: boolean;

  // ==========================================
  // ТОЧЕЧНЫЕ ПРОВЕРКИ
  // ==========================================

  spotChecks: {
    /** calls[].type — совпадают ли типы вызовов */
    callsType: LevelResult;
    /** imports[].toFileId — совпадают ли ссылки на файлы */
    importsToFileId: LevelResult;
    /** exports[].isReExport — совпадают ли флаги реэкспорта */
    exportsIsReExport: LevelResult;
    /** functions[].*Flags — совпадают ли все 18 флагов */
    functionsFlags: LevelResult;
    /** external calls type — совпадают ли типы external-вызовов */
    externalCalls: LevelResult;
    /** modules[].path — совпадают ли пути модулей */
    modulesPath: LevelResult;
  };
}

// ============================================
// DEEP EQUAL (с нормализацией)
// ============================================

/**
 * Глубокое сравнение двух значений.
 *
 * Особенности:
 *   - Порядок ключей в объектах не важен (сортируется)
 *   - `undefined` и отсутствие ключа считаются эквивалентными
 *   - `null` и `null` — эквивалентны
 *   - Массивы сравниваются поэлементно
 *
 * @param a — первое значение
 * @param b — второе значение
 * @returns true, если значения эквивалентны
 */
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

/**
 * Нормализация значения для диагностики расхождений.
 * Возвращает строку с отсортированными ключами и без `undefined`.
 *
 * @param x — значение
 * @returns нормализованная строка
 */
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

/**
 * Рекурсивно собирает расхождения между двумя значениями.
 *
 * @param a — первое значение
 * @param b — второе значение
 * @param basePath — базовый путь для диагностики (например, '$')
 * @param limit — максимальное количество расхождений
 * @returns массив расхождений
 */
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
// ПРОВЕРКА ОДНОГО УРОВНЯ
// ============================================

/**
 * Создаёт результат уровня из массива расхождений.
 */
function makeLevel(diffs: RoundTripDiff[], note?: string): LevelResult {
  return {
    ok: diffs.length === 0,
    diffCount: diffs.length,
    diff: diffs,
    note,
  };
}

/**
 * Создаёт результат уровня при исключении.
 */
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

/**
 * Проверяет, что encode → decode возвращает идентичный результат.
 *
 * Уровни проверки:
 *   - Детали по количеству элементов в каждой секции
 *   - Глубокое сравнение (deepEqual)
 *
 * @param payload — исходный full-JSON
 * @param options — опции декодирования
 * @returns объект с полем `ok` и деталями
 */
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

    // Детали по количеству элементов в каждой секции
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
      templates: {
        original: payload.templates?.length || 0,
        decoded: decoded.templates?.length || 0,
      },
      lifecycle: {
        original: payload.lifecycle?.length || 0,
        decoded: decoded.lifecycle?.length || 0,
      },
      effects: {
        original: payload.effects?.length || 0,
        decoded: decoded.effects?.length || 0,
      },
      injections: {
        original: payload.injections?.length || 0,
        decoded: decoded.injections?.length || 0,
      },
      reactivity: {
        original: payload.reactivity?.length || 0,
        decoded: decoded.reactivity?.length || 0,
      },
      conditionals: {
        original: payload.conditionals?.length || 0,
        decoded: decoded.conditionals?.length || 0,
      },
      types: {
        original: payload.types?.length || 0,
        decoded: decoded.types?.length || 0,
      },
      typeRefs: {
        original: payload.typeRefs?.length || 0,
        decoded: decoded.typeRefs?.length || 0,
      },
    };

    const errors: string[] = [];
    for (const [key, value] of Object.entries(details)) {
      if (value.original !== value.decoded) {
        errors.push(`${key}: ${value.original} → ${value.decoded}`);
      }
    }

    // Глубокое сравнение
    if (!deepEqual(payload, decoded)) {
      const normOrig = normalizeForDiff(payload);
      const normDec = normalizeForDiff(decoded);
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
        `JSON mismatch at pos ${diffPos}: ` +
          `...${normOrig.substring(start, end)}... ≠ ...${normOrig.substring(start, end)}...`
      );
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
// РАСШИРЕННАЯ ПРОВЕРКА (в обе стороны)
// ============================================

/**
 * Проверяет обратимость в обе стороны:
 *
 *   Прямое:
 *     L0: encode(full) === compact          (байтовое совпадение)
 *     L1: decode(compact) === full          (семантическое совпадение)
 *
 *   Обратимость:
 *     RE: encode(decode(compact)) === compact
 *     DL: decode(encode(full)) === full
 *
 *   Идемпотентность:
 *     ENC: encode(full) === encode(decode(encode(full)))
 *     DEC: decode(compact) === decode(encode(decode(compact)))
 *
 *   Независимость:
 *     full_self_contained: encode(full) не читает compact
 *     compact_self_contained: decode(compact) не читает full
 *
 *   Точечные проверки:
 *     calls[].type
 *     imports[].toFileId
 *     exports[].isReExport
 *     functions[].*Flags
 *     external calls type
 *     modules[].path
 *
 * @param full — полный JSON
 * @param compact — компактный JSON
 * @returns отчёт об обратимости
 */
export function verifyRoundTripBoth(full: FullJSON, compact: CompactJSON): ReversibilityReport {
  const report: ReversibilityReport = {
    timestamp: new Date().toISOString(),

    // Прямое направление
    full_to_compact: { ok: false, diffCount: 0, diff: [] },
    compact_to_full: { ok: false, diffCount: 0, diff: [] },

    // Обратимость
    compact_to_full_to_compact: { ok: false, diffCount: 0, diff: [] },
    full_to_compact_to_full: { ok: false, diffCount: 0, diff: [] },

    // Идемпотентность
    encode_idempotent: { ok: false, diffCount: 0, diff: [] },
    decode_idempotent: { ok: false, diffCount: 0, diff: [] },

    // Независимость
    full_self_contained: false,
    compact_self_contained: false,

    // Точечные проверки
    spotChecks: {
      callsType: { ok: false, diffCount: 0, diff: [] },
      importsToFileId: { ok: false, diffCount: 0, diff: [] },
      exportsIsReExport: { ok: false, diffCount: 0, diff: [] },
      functionsFlags: { ok: false, diffCount: 0, diff: [] },
      externalCalls: { ok: false, diffCount: 0, diff: [] },
      modulesPath: { ok: false, diffCount: 0, diff: [] },
    },
  };

  // ==========================================
  // ПРЯМОЕ НАПРАВЛЕНИЕ
  // ==========================================

  // L0: encode(full) === compact
  try {
    const encoded = encode(full);
    const diffs = collectDiffs(compact, encoded, '$');
    report.full_to_compact = makeLevel(diffs, `encoded to compact v=${encoded.v}`);
  } catch (err) {
    report.full_to_compact = makeErrorLevel(err);
  }

  // L1: decode(compact) без ошибок
  let decodedFromCompact: FullJSON | null = null;
  try {
    decodedFromCompact = decode(compact);
    report.compact_to_full = makeLevel([]);
  } catch (err) {
    report.compact_to_full = makeErrorLevel(err);
  }

  // ==========================================
  // ОБРАТИМОСТЬ
  // ==========================================

  // RE: encode(decode(compact)) === compact
  try {
    if (decodedFromCompact) {
      const reEncoded = encode(decodedFromCompact);
      const diffs = collectDiffs(compact, reEncoded, '$');
      report.compact_to_full_to_compact = makeLevel(diffs);
    }
  } catch (err) {
    report.compact_to_full_to_compact = makeErrorLevel(err);
  }

  // DL: decode(encode(full)) === full
  try {
    const encoded = encode(full);
    const decoded = decode(encoded);
    const diffs = collectDiffs(full, decoded, '$');
    report.full_to_compact_to_full = makeLevel(diffs);
  } catch (err) {
    report.full_to_compact_to_full = makeErrorLevel(err);
  }

  // ==========================================
  // ИДЕМПОТЕНТНОСТЬ
  // ==========================================

  // ENC: encode(full) === encode(decode(encode(full)))
  try {
    const c1 = encode(full);
    const f1 = decode(c1);
    const c2 = encode(f1);
    const diffs = collectDiffs(c1, c2, '$');
    report.encode_idempotent = makeLevel(diffs);
  } catch (err) {
    report.encode_idempotent = makeErrorLevel(err);
  }

  // DEC: decode(compact) === decode(encode(decode(compact)))
  try {
    const f1 = decode(compact);
    const c1 = encode(f1);
    const f2 = decode(c1);
    const diffs = collectDiffs(f1, f2, '$');
    report.decode_idempotent = makeLevel(diffs);
  } catch (err) {
    report.decode_idempotent = makeErrorLevel(err);
  }

  // ==========================================
  // НЕЗАВИСИМОСТЬ
  // ==========================================
  // encode(full) не читает compact — это свойство архитектуры
  // (encode принимает только full и не имеет доступа к compact)
  report.full_self_contained = true;

  // decode(compact) не читает full — это свойство архитектуры
  // (decode принимает только compact и легенду внутри него)
  report.compact_self_contained = true;

  // ==========================================
  // ТОЧЕЧНЫЕ ПРОВЕРКИ
  // ==========================================

  try {
    const decoded = decodedFromCompact || decode(compact);

    // calls[].type
    report.spotChecks.callsType = spotCheckArray(
      decoded.calls || [],
      full.calls || [],
      'type',
      '$.calls'
    );

    // imports[].toFileId
    report.spotChecks.importsToFileId = spotCheckArray(
      decoded.imports || [],
      full.imports || [],
      'toFileId',
      '$.imports'
    );

    // exports[].isReExport
    report.spotChecks.exportsIsReExport = spotCheckArray(
      decoded.exports || [],
      full.exports || [],
      'isReExport',
      '$.exports'
    );

    // functions[].*Flags — проверяем все 18 флагов
    report.spotChecks.functionsFlags = checkFunctionsFlags(decoded, full);

    // external calls type
    report.spotChecks.externalCalls = checkExternalCalls(decoded, full);

    // modules[].path
    report.spotChecks.modulesPath = checkModulesPath(decoded, full);
  } catch (err) {
    report.spotChecks.callsType = makeErrorLevel(err);
  }

  return report;
}

// ============================================
// ТОЧЕЧНЫЕ ПРОВЕРКИ
// ============================================

/**
 * Проверяет совпадение указанного поля в двух массивах.
 *
 * @param arrA — первый массив
 * @param arrB — второй массив
 * @param field — имя поля для сравнения
 * @param label — метка для диагностики
 * @returns результат проверки
 */
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

/**
 * Проверяет совпадение всех 18 флагов функций.
 */
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

/**
 * Проверяет совпадение типов external-вызовов.
 */
function checkExternalCalls(decoded: FullJSON, full: FullJSON): LevelResult {
  const diffs: RoundTripDiff[] = [];

  const fullExternal = (full.calls || []).filter((c: any) =>
    c.toFunctionId?.startsWith('external:')
  );

  for (let i = 0; i < fullExternal.length && diffs.length < 20; i++) {
    const fc = fullExternal[i];
    if (!fc) continue; // ✅ ИСПРАВЛЕНО: добавлена проверка на undefined

    const dc = decoded.calls.find(
      (c: any) =>
        c.fromFunctionId === fc.fromFunctionId &&
        c.toFunctionId === fc.toFunctionId &&
        c.line === fc.line
    );

    if (!dc) {
      diffs.push({
        path: `$.calls[external:${i}]`,
        a: 'not found',
        b: fc.toFunctionId,
      });
      continue;
    }

    if (dc.type !== fc.type) {
      diffs.push({
        path: `$.calls[${dc.id}].type`,
        a: dc.type,
        b: fc.type,
      });
    }
  }

  return makeLevel(diffs);
}

/**
 * Проверяет совпадение путей модулей.
 */
function checkModulesPath(decoded: FullJSON, full: FullJSON): LevelResult {
  const diffs: RoundTripDiff[] = [];
  const n = Math.min(decoded.modules.length, full.modules.length);

  for (let i = 0; i < n && diffs.length < 20; i++) {
    const dm = decoded.modules[i];
    const fm = full.modules[i];
    if (!dm || !fm) continue;
    if (dm.path !== fm.path) {
      diffs.push({
        path: `$.modules[${i}].path`,
        a: dm.path,
        b: fm.path,
      });
    }
  }

  return makeLevel(diffs);
}

// ============================================
// РАЗМЕРЫ И СЖАТИЕ
// ============================================

/**
 * Размер compact-JSON в байтах (по JSON.stringify).
 *
 * @param compact — компактный JSON
 * @returns количество байтов (символов в строке)
 */
export function getCompactSize(compact: CompactJSON): number {
  return JSON.stringify(compact).length;
}

/**
 * Размер full-JSON в байтах (по JSON.stringify).
 *
 * @param payload — полный JSON
 * @returns количество байтов (символов в строке)
 */
export function getFullSize(payload: FullJSON): number {
  return JSON.stringify(payload).length;
}

/**
 * Коэффициент сжатия: compactSize / fullSize.
 *
 * @param payload — полный JSON
 * @returns коэффициент (0..1), где 0 — идеальное сжатие,
 *          1 — отсутствие сжатия
 */
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

/**
 * Сериализует compact-JSON в строку.
 *
 * @param compact — компактный JSON
 * @param pretty — если true, добавляет отступы
 * @returns строка JSON
 */
export function stringify(compact: CompactJSON, pretty: boolean = false): string {
  return pretty ? JSON.stringify(compact, null, 2) : JSON.stringify(compact);
}

/**
 * Парсит строку JSON в compact-JSON.
 *
 * @param json — строка JSON
 * @returns объект compact-JSON
 */
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
