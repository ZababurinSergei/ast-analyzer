// ============================================================================
// AST ANALYZER — UTILS v1.1
// Общие утилиты: deepEqual, diffObjects, collectDiffs, normalizeForDiff,
// stripServiceFields, stripForByteCompare, arrayEq, idToNum, debounce.
// Единый источник истины — не дублировать в других модулях.
//
// Публичный API:
//   // --- Сравнение ---
//   deepEqual(a, b)                   → boolean
//   diffObjects(a, b, limit?)         → {path, a, b}[]
//   collectDiffs(a, b, base?, limit?) → {path, a, b}[]
//   normalizeForDiff(value)           → string (JSON с сортировкой ключей)
//   arrayEq(a, b)                     → boolean
//
//   // --- Служебные ---
//   idToNum(id)                       → number (-1 если не найдено)
//   stripServiceFields(obj)           → obj без __*/legend/edges/edgesStats
//   stripForByteCompare(obj)          → obj без пустых полей, для L3
//
//   // --- Прочее ---
//   debounce(fn, ms?)                 → debounced-функция
//
// Изменения v1.1:
//   - ✅ Добавлен debounce (используется в main.js для поиска в дереве).
//   - ✅ stripServiceFields и stripForByteCompare экспортируются наружу
//        и реэкспортируются из ast-analyzer-codec.js для совместимости.
//   - ✅ Все функции — чистые, без побочных эффектов, без зависимости от state.
// ============================================================================

// ---------------------------------------------------------------------------
// DEEP EQUAL
// ---------------------------------------------------------------------------

/**
 * Глубокое сравнение двух значений.
 *
 * Особенности:
 *   - undefined, null, [] и {} считаются "пустыми" и эквивалентными друг другу;
 *   - ключи со значением undefined игнорируются;
 *   - порядок ключей в объектах не важен.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  const isEmptyA =
    a === undefined ||
    a === null ||
    (Array.isArray(a) && a.length === 0) ||
    (typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 0);

  const isEmptyB =
    b === undefined ||
    b === null ||
    (Array.isArray(b) && b.length === 0) ||
    (typeof b === 'object' && !Array.isArray(b) && Object.keys(b).length === 0);

  if (isEmptyA && isEmptyB) {return true;}
  if (a === b) {return true;}
  if (typeof a !== typeof b) {return false;}
  if (a === null || b === null) {return a === b;}
  if (Array.isArray(a) !== Array.isArray(b)) {return false;}

  if (Array.isArray(a)) {
    if (a.length !== b.length) {return false;}
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {return false;}
    }
    return true;
  }

  if (typeof a === 'object') {
    const ka = Object.keys(a).filter(k => a[k] !== undefined);
    const kb = Object.keys(b).filter(k => b[k] !== undefined);
    if (ka.length !== kb.length) {return false;}
    for (const k of ka) {
      if (!deepEqual(a[k], b[k])) {return false;}
    }
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// DIFF
// ---------------------------------------------------------------------------

/**
 * Собирает расхождения между двумя значениями.
 * Возвращает массив {path, a, b}, где path — JSON-путь до расхождения.
 *
 * @param {*} a
 * @param {*} b
 * @param {number} [limit=20] — максимальное число расхождений
 * @returns {Array<{path: string, a: *, b: *}>}
 */
export function diffObjects(a, b, limit = 20) {
  const diffs = [];

  const walk = (x, y, path) => {
    if (diffs.length >= limit) {return;}
    if (deepEqual(x, y)) {return;}

    if (Array.isArray(x) && Array.isArray(y)) {
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i++) {
        walk(x[i], y[i], `${path}[${i}]`);
        if (diffs.length >= limit) {return;}
      }
      return;
    }

    if (x && y && typeof x === 'object' && typeof y === 'object') {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of keys) {
        walk(x[k], y[k], `${path}.${k}`);
        if (diffs.length >= limit) {return;}
      }
      return;
    }

    diffs.push({ path, a: x, b: y });
  };

  walk(a, b, '$');
  return diffs;
}

/**
 * TS-совместимый API для сбора расхождений.
 * Отличается от diffObjects сигнатурой (basePath, limit).
 *
 * @param {*} a
 * @param {*} b
 * @param {string} [basePath='$']
 * @param {number} [limit=20]
 * @returns {Array<{path: string, a: *, b: *}>}
 */
export function collectDiffs(a, b, basePath = '$', limit = 20) {
  const diffs = [];

  const walk = (x, y, p) => {
    if (diffs.length >= limit) {return;}
    if (deepEqual(x, y)) {return;}

    // null/undefined — терминальные значения
    if (x === undefined || y === undefined || x === null || y === null) {
      if (x !== y) {diffs.push({ path: p, a: x, b: y });}
      return;
    }

    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) {
        diffs.push({ path: `${p}.length`, a: x.length, b: y.length });
      }
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) {
        walk(x[i], y[i], `${p}[${i}]`);
        if (diffs.length >= limit) {return;}
      }
      return;
    }

    if (typeof x === 'object' && typeof y === 'object') {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of keys) {
        walk(x[k], y[k], `${p}.${k}`);
        if (diffs.length >= limit) {return;}
      }
      return;
    }

    if (x !== y) {diffs.push({ path: p, a: x, b: y });}
  };

  walk(a, b, basePath);
  return diffs;
}

// ---------------------------------------------------------------------------
// NORMALIZE
// ---------------------------------------------------------------------------

/**
 * Нормализует значение для диагностики:
 *   - сортирует ключи объектов;
 *   - удаляет undefined-поля;
 *   - возвращает строку (JSON).
 *
 * @param {*} value
 * @returns {string}
 */
export function normalizeForDiff(value) {
  const norm = v => {
    if (v === undefined) {return undefined;}
    if (v === null) {return null;}
    if (Array.isArray(v)) {return v.map(norm);}
    if (typeof v === 'object') {
      const out = {};
      for (const key of Object.keys(v).sort()) {
        const nv = norm(v[key]);
        if (nv !== undefined) {out[key] = nv;}
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

// ---------------------------------------------------------------------------
// ARRAY / ID
// ---------------------------------------------------------------------------

/**
 * Сравнение двух массивов примитивов (по значению).
 *
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
export function arrayEq(a, b) {
  if (a.length !== b.length) {return false;}
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {return false;}
  }
  return true;
}

/**
 * Извлекает числовой суффикс из id.
 *   idToNum('fn12')  → 12
 *   idToNum('m5')    → 5
 *   idToNum('f131')  → 131
 *   idToNum(null)    → -1
 *
 * @param {string} id
 * @returns {number}
 */
export function idToNum(id) {
  if (!id || typeof id !== 'string') {return -1;}
  const m = id.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}

// ---------------------------------------------------------------------------
// STRIP (СЛУЖЕБНЫЕ ПОЛЯ)
// ---------------------------------------------------------------------------

/**
 * Убирает служебные поля перед семантическим сравнением:
 *   - __codec, legend;
 *   - поля, начинающиеся с __;
 *   - edges, edgesStats (производные поля).
 *
 * @param {object} obj
 * @returns {object}
 */
export function stripServiceFields(obj) {
  if (!obj || typeof obj !== 'object') {return obj;}
  const { __codec, legend, ...rest } = obj;
  const clean = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) {continue;}
    if (k === 'edges' || k === 'edgesStats') {continue;}
    clean[k] = v;
  }
  return clean;
}

/**
 * Убирает служебные поля и пустые значения перед побайтовым сравнением:
 *   - __codec, legend;
 *   - поля, начинающиеся с __;
 *   - edges, edgesStats;
 *   - undefined / null;
 *   - пустые массивы;
 *   - пустые объекты.
 *
 * @param {object} obj
 * @returns {object}
 */
export function stripForByteCompare(obj) {
  if (!obj || typeof obj !== 'object') {return obj;}
  const { legend, __codec, ...rest } = obj;
  const clean = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) {continue;}
    if (k === 'edges' || k === 'edgesStats') {continue;}
    if (v === undefined || v === null) {continue;}
    if (Array.isArray(v) && v.length === 0) {continue;}
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) {continue;}
    clean[k] = v;
  }
  return clean;
}

// ---------------------------------------------------------------------------
// DEBOUNCE
// ---------------------------------------------------------------------------

/**
 * Возвращает debounced-версию функции: вызов откладывается на ms мс,
 * повторные вызовы сбрасывают таймер.
 *
 * Используется для поиска в дереве проекта (main.js).
 *
 * @param {Function} fn
 * @param {number} [ms=200]
 * @returns {Function}
 */
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ ДЛЯ ОТЛАДКИ
// ---------------------------------------------------------------------------
export const __internals = {
  deepEqual,
  diffObjects,
  collectDiffs,
  normalizeForDiff,
  arrayEq,
  idToNum,
  stripServiceFields,
  stripForByteCompare,
  debounce,
};

export default {
  deepEqual,
  diffObjects,
  collectDiffs,
  normalizeForDiff,
  arrayEq,
  idToNum,
  stripServiceFields,
  stripForByteCompare,
  debounce,
};
