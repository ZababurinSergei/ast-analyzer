#!/usr/bin/env node
/**
 * pack.js — структурное сжатие index.json с полным round-trip.
 * Без gzip, без delta, без бинарных форматов, без minify.
 *
 * Использование:
 *   node pack.js pack   index.json        index.packed.json
 *   node pack.js unpack index.packed.json index.restored.json
 *   node pack.js test   index.json        (pack + unpack + сравнение)
 */

const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// ТОКЕНИЗАЦИЯ СТРОК
// ─────────────────────────────────────────────────────────────

/** Разбивает строку на camelCase / PascalCase / snake_case / kebab-case токены. */
function tokenize(str) {
  if (typeof str !== 'string' || str.length === 0) return [str];
  return str.split(/(?=[A-Z])|[_\-\/\.\s]+/).filter(Boolean);
}

/** Строит словарь токенов, встречающихся > 1 раза. */
function buildTokenDict(strings) {
  const counts = new Map();
  for (const s of strings) {
    if (typeof s !== 'string') continue;
    for (const t of tokenize(s)) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()].filter(([_, c]) => c > 1).map(([t]) => t);
}

/** Кодирует одну строку: либо массив индексов токенов, либо исходную строку. */
function encodeStr(str, tokenIndex) {
  if (typeof str !== 'string' || str.length === 0) return str;
  const tokens = tokenize(str);

  // Если хоть один токен неизвестен — храним целиком
  const idx = [];
  for (const t of tokens) {
    const i = tokenIndex.get(t);
    if (i === undefined) return str;
    idx.push(i);
  }

  // Эвристика выгоды: длина массива индексов vs длина строки
  // (каждый индекс ~1-3 символа в JSON + запятая)
  if (idx.length * 3 >= str.length) return str;

  return idx;
}

/** Декодирует строку обратно. */
function decodeStr(entry, tokens) {
  if (typeof entry !== 'string') {
    return entry.map(i => tokens[i]).join('');
  }
  return entry;
}

// ─────────────────────────────────────────────────────────────
// RLE
// ─────────────────────────────────────────────────────────────

/** Простой RLE: [a,a,a,b,b,c] → [[a,3],[b,2],[c,1]] */
function rle(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i];
    let j = i;
    while (j < arr.length && arr[j] === v) j++;
    out.push([v, j - i]);
    i = j;
  }
  return out;
}

/** Обратный RLE. */
function unrle(encoded) {
  const out = [];
  for (const [v, count] of encoded) {
    for (let k = 0; k < count; k++) out.push(v);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// ХЕЛПЕРЫ ДЛЯ ID → ИНДЕКС
// ─────────────────────────────────────────────────────────────

function buildIndexMap(keys) {
  const m = new Map();
  keys.forEach((k, i) => m.set(k, i));
  return m;
}

function getModuleIds(mi) {
  return Object.keys(mi);
}
function getFileIds(fl) {
  return Object.keys(fl);
}

// ─────────────────────────────────────────────────────────────
// PACK
// ─────────────────────────────────────────────────────────────

function pack(src) {
  // ---- 0. Токенизация словарей ----
  const rawStrings = src.legend.dictionaries.stringDict;
  const rawMethods = src.legend.dictionaries.methodDict;
  const rawParams = src.legend.dictionaries.paramDict;

  // Единый словарь токенов по всем трём словарям — больше пересечений
  const allTokens = buildTokenDict([...rawStrings, ...rawMethods, ...rawParams]);
  const tokenIndex = new Map(allTokens.map((t, i) => [t, i]));

  const strs = rawStrings.map(s => encodeStr(s, tokenIndex));
  const methods = rawMethods.map(s => encodeStr(s, tokenIndex));
  const params = rawParams.map(s => encodeStr(s, tokenIndex));

  // ---- 1. Модули ----
  const moduleIds = getModuleIds(src.mi);
  const moduleIndex = buildIndexMap(moduleIds);
  const fileIds = getFileIds(src.fl);
  const fileIndex = buildIndexMap(fileIds);

  const mi_n = moduleIds.map(id => src.mi[id].n);
  const mi_f = moduleIds.map(id => rle(src.mi[id].f.map(fid => fileIndex.get(fid))));

  // ---- 2. Файлы ----
  const fl_p = fileIds.map(id => src.fl[id].p);
  const fl_m = rle(fileIds.map(id => moduleIndex.get(src.fl[id].m)));

  // ---- 3. Функции (columnar) ----
  const fns = {
    n: src.fns.map(f => f[1]),
    m: rle(src.fns.map(f => moduleIndex.get(f[2]))),
    f: rle(src.fns.map(f => fileIndex.get(f[3]))),
    l: src.fns.map(f => f[4]),
    fl: src.fns.map(f => f[5]),
    p: src.fns.map(f => f[6]),
    rt: src.fns.map(f => f[7]),
  };

  // ---- 4. Классы (columnar) ----
  const cls = {
    n: src.cls.map(c => c[1]),
    m: rle(src.cls.map(c => moduleIndex.get(c[2]))),
    f: rle(src.cls.map(c => fileIndex.get(c[3]))),
    l: src.cls.map(c => c[4]),
    fl: src.cls.map(c => c[5]),
    methods: src.cls.map(c => c[6]),
  };

  // ---- 5. Константы (columnar + вынос непустых valueIdx) ----
  const cn_n = src.cn.map(c => c[1]);
  const cn_m = rle(src.cn.map(c => moduleIndex.get(c[2])));
  const cn_f = rle(src.cn.map(c => fileIndex.get(c[3])));
  const cn_l = src.cn.map(c => c[4]);
  const cn_fl = src.cn.map(c => c[5]);
  const cn_v = src.cn.map(c => c[6]);

  const nonEmptyV = [];
  for (let i = 0; i < cn_v.length; i++) {
    if (cn_v[i] !== -1) nonEmptyV.push([i, cn_v[i]]);
  }
  const cn = { n: cn_n, m: cn_m, f: cn_f, l: cn_l, fl: cn_fl, nonEmptyV };

  // ---- 6. Графовые связи ----
  // Enum'ы для typeCode
  const EXPORT_MAP = { ne: 0, de: 1, te: 2, re: 3 };
  const IMPORT_MAP = { n: 0, df: 1, ns: 2, to: 3 };
  const CALL_MAP = { d: 0, a: 1, m: 2, c: 3 };
  const RE_MAP = { n: 0, df: 1, all: 2 };

  // gr.e:  [moduleIdx, fileIdx, funcIdx, line, typeCode, exportNameIdx, localNameIdx,
  //         isTypeOnly, isReExport, sourceIdx, isStarReExport, isDefaultReExport]
  const gr_e = {
    m: src.gr.e.map(e => e[0]),
    f: src.gr.e.map(e => e[1]),
    fn: src.gr.e.map(e => e[2]),
    l: src.gr.e.map(e => e[3]),
    ty: src.gr.e.map(e => EXPORT_MAP[e[4]]),
    en: src.gr.e.map(e => e[5]),
    ln: src.gr.e.map(e => e[6]),
    // Упаковываем 4 флага в одно число
    fl: src.gr.e.map(e => (e[7] ? 1 : 0) | (e[8] ? 2 : 0) | (e[10] ? 4 : 0) | (e[11] ? 8 : 0)),
    s: src.gr.e.map(e => e[9]),
  };

  // gr.i: [fromFileIdx, toFileIdIdx, sourceIdx, importedNameIdx, localNameIdx,
  //        line, typeCode, isExternal]
  const gr_i = {
    ff: src.gr.i.map(e => e[0]),
    tf: src.gr.i.map(e => e[1]),
    s: src.gr.i.map(e => e[2]),
    im: src.gr.i.map(e => e[3]),
    ln: src.gr.i.map(e => e[4]),
    l: src.gr.i.map(e => e[5]),
    ty: src.gr.i.map(e => IMPORT_MAP[e[6]]),
    ex: src.gr.i.map(e => e[7]),
  };

  // gr.c: [fromIdx, toIdx, line, typeCode, isExternal]
  // упаковка typeCode|isExternal<<2 в одно число 0..7
  const gr_c = {
    f: src.gr.c.map(c => c[0]),
    t: src.gr.c.map(c => c[1]),
    l: src.gr.c.map(c => c[2]),
    ty: src.gr.c.map(c => CALL_MAP[c[3]] | (c[4] << 2)),
  };

  // gr.re: [moduleIdx, funcIdx, sourceIdx, exportNameIdx, line, typeCode, isTypeOnly]
  const gr_re = {
    m: src.gr.re.map(r => r[0]),
    fn: src.gr.re.map(r => r[1]),
    s: src.gr.re.map(r => r[2]),
    en: src.gr.re.map(r => r[3]),
    l: src.gr.re.map(r => r[4]),
    ty: src.gr.re.map(r => RE_MAP[r[5]]),
    fl: src.gr.re.map(r => (r[6] ? 1 : 0)),
  };

  // ---- 7. Легенда (без how_to_read, examples, без bit/description) ----
  const flagBits = {};
  for (const [k, v] of Object.entries(src.legend.flags.bits)) {
    flagBits[k] = v.name;
  }

  // ---- 8. Сборка ----
  return {
    v: src.v,
    ts: src.ts,
    r: moduleIndex.get(src.r),

    tokens: allTokens,
    strs: strs,
    methods: methods,
    params: params,
    values: src.legend.dictionaries.valueDict,

    mi: { n: mi_n, f: mi_f },
    fl: { p: fl_p, m: fl_m },

    fns: fns,
    cls: cls,
    cn: cn,

    gr: {
      e: gr_e,
      i: gr_i,
      c: gr_c,
      re: gr_re,
    },

    st: src.st,

    legend: {
      codes: src.legend.codes,
      flags: { bits: flagBits },
      schemas: src.legend.schemas,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// UNPACK
// ─────────────────────────────────────────────────────────────

function unpack(p) {
  // ---- 0. Декодируем словари ----
  const strings = p.strs.map(e => decodeStr(e, p.tokens));
  const methods = p.methods.map(e => decodeStr(e, p.tokens));
  const params = p.params.map(e => decodeStr(e, p.tokens));

  // ---- 1. Модули / файлы: восстанавливаем ID и разворачиваем RLE ----
  const moduleIds = p.mi.n.map((_, i) => `m${i + 1}`);
  const fileIds = p.fl.p.map((_, i) => `f${i + 1}`);

  const mi = {};
  for (let i = 0; i < p.mi.n.length; i++) {
    const fileIdxs = unrle(p.mi.f[i]);
    mi[moduleIds[i]] = {
      n: p.mi.n[i],
      p: p.mi.n[i], // восстановили дубликат
      f: fileIdxs.map(fi => fileIds[fi]),
    };
  }

  const fl = {};
  const flModuleIdxs = unrle(p.fl.m);
  for (let i = 0; i < p.fl.p.length; i++) {
    fl[fileIds[i]] = {
      p: p.fl.p[i],
      m: moduleIds[flModuleIdxs[i]],
    };
  }

  // ---- 2. Функции ----
  const fns = [];
  const fnsM = unrle(p.fns.m);
  const fnsF = unrle(p.fns.f);
  for (let i = 0; i < p.fns.n.length; i++) {
    fns.push([
      `fn${i + 1}`,
      p.fns.n[i],
      moduleIds[fnsM[i]],
      fileIds[fnsF[i]],
      p.fns.l[i],
      p.fns.fl[i],
      p.fns.p[i],
      p.fns.rt[i],
    ]);
  }

  // ---- 3. Классы ----
  const cls = [];
  const clsM = unrle(p.cls.m);
  const clsF = unrle(p.cls.f);
  for (let i = 0; i < p.cls.n.length; i++) {
    cls.push([
      `cls${i + 1}`,
      p.cls.n[i],
      moduleIds[clsM[i]],
      fileIds[clsF[i]],
      p.cls.l[i],
      p.cls.fl[i],
      p.cls.methods[i],
    ]);
  }

  // ---- 4. Константы (восстанавливаем v из nonEmptyV) ----
  const cnV = new Array(p.cn.n.length).fill(-1);
  for (const [idx, v] of p.cn.nonEmptyV) cnV[idx] = v;

  const cn = [];
  const cnM = unrle(p.cn.m);
  const cnF = unrle(p.cn.f);
  for (let i = 0; i < p.cn.n.length; i++) {
    cn.push([
      `cn${i + 1}`,
      p.cn.n[i],
      moduleIds[cnM[i]],
      fileIds[cnF[i]],
      p.cn.l[i],
      p.cn.fl[i],
      cnV[i],
    ]);
  }

  // ---- 5. Графовые связи ----
  const EXPORT_REV = ['ne', 'de', 'te', 're'];
  const IMPORT_REV = ['n', 'df', 'ns', 'to'];
  const CALL_REV = ['d', 'a', 'm', 'c'];
  const RE_REV = ['n', 'df', 'all'];

  const gr_e = p.gr.e.m.map((_, i) => {
    const fl = p.gr.e.fl[i];
    return [
      p.gr.e.m[i],
      p.gr.e.f[i],
      p.gr.e.fn[i],
      p.gr.e.l[i],
      EXPORT_REV[p.gr.e.ty[i]],
      p.gr.e.en[i],
      p.gr.e.ln[i],
      !!(fl & 1), // isTypeOnly
      !!(fl & 2), // isReExport
      p.gr.e.s[i],
      !!(fl & 4), // isStarReExport
      !!(fl & 8), // isDefaultReExport
    ];
  });

  const gr_i = p.gr.i.ff.map((_, i) => [
    p.gr.i.ff[i],
    p.gr.i.tf[i],
    p.gr.i.s[i],
    p.gr.i.im[i],
    p.gr.i.ln[i],
    p.gr.i.l[i],
    IMPORT_REV[p.gr.i.ty[i]],
    p.gr.i.ex[i],
  ]);

  const gr_c = p.gr.c.f.map((_, i) => {
    const packedTy = p.gr.c.ty[i];
    return [p.gr.c.f[i], p.gr.c.t[i], p.gr.c.l[i], CALL_REV[packedTy & 3], packedTy >> 2];
  });

  const gr_re = p.gr.re.m.map((_, i) => [
    p.gr.re.m[i],
    p.gr.re.fn[i],
    p.gr.re.s[i],
    p.gr.re.en[i],
    p.gr.re.l[i],
    RE_REV[p.gr.re.ty[i]],
    !!p.gr.re.fl[i],
  ]);

  // ---- 6. Легенда: восстанавливаем структуру flags.bits ----
  const flagBits = {};
  for (const [k, name] of Object.entries(p.legend.flags.bits)) {
    flagBits[k] = { bit: Number(k), name, description: '' };
  }

  return {
    v: p.v,
    ts: p.ts,
    r: moduleIds[p.r],

    mi: mi,
    fl: fl,
    fns: fns,
    cls: cls,
    cn: cn,

    gr: { e: gr_e, i: gr_i, c: gr_c, re: gr_re },

    st: p.st,

    legend: {
      how_to_read: [],
      flags: { bits: flagBits, examples: {} },
      codes: p.legend.codes,
      dictionaries: {
        stringDict: strings,
        paramDict: params,
        methodDict: methods,
        valueDict: p.values,
      },
      schemas: p.legend.schemas,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// ROUND-TRIP TEST
// ─────────────────────────────────────────────────────────────

/** Глубокое сравнение двух значений (с игнором порядка ключей). */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a),
      kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

function compareSections(orig, restored) {
  const sections = ['v', 'ts', 'r', 'mi', 'fl', 'fns', 'cls', 'cn', 'st'];
  const results = [];

  for (const s of sections) {
    const ok = deepEqual(orig[s], restored[s]);
    results.push({ section: s, ok });
  }

  // Графовые секции
  for (const s of ['e', 'i', 'c', 're']) {
    const ok = deepEqual(orig.gr[s], restored.gr[s]);
    results.push({ section: `gr.${s}`, ok });
  }

  // Словари
  const origDict = orig.legend.dictionaries;
  const restDict = restored.legend.dictionaries;
  for (const s of ['stringDict', 'paramDict', 'methodDict', 'valueDict']) {
    const ok = deepEqual(origDict[s], restDict[s]);
    results.push({ section: `legend.dict.${s}`, ok });
  }

  // Codes, schemas
  results.push({
    section: 'legend.codes',
    ok: deepEqual(orig.legend.codes, restored.legend.codes),
  });
  results.push({
    section: 'legend.schemas',
    ok: deepEqual(orig.legend.schemas, restored.legend.schemas),
  });

  // flags.bits — сравниваем только name (описание и bit мы удаляли)
  const origBits = orig.legend.flags.bits;
  const restBits = restored.legend.flags.bits;
  let bitsOk = Object.keys(origBits).length === Object.keys(restBits).length;
  for (const k of Object.keys(origBits)) {
    if (!restBits[k] || restBits[k].name !== origBits[k].name) bitsOk = false;
  }
  results.push({ section: 'legend.flags.bits (name only)', ok: bitsOk });

  return results;
}

// ─────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function main() {
  const [cmd, inPath, outPath] = process.argv.slice(2);

  if (cmd === 'pack') {
    const src = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    const packed = pack(src);
    fs.writeFileSync(outPath, JSON.stringify(packed, null, 2));

    const inSize = fs.statSync(inPath).size;
    const outSize = fs.statSync(outPath).size;
    console.log(`✔ pack:   ${inPath} → ${outPath}`);
    console.log(`  Было:   ${fmtSize(inSize)}`);
    console.log(`  Стало:  ${fmtSize(outSize)}`);
    console.log(`  Сжатие: ${(inSize / outSize).toFixed(2)}×`);
  } else if (cmd === 'unpack') {
    const packed = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    const restored = unpack(packed);
    fs.writeFileSync(outPath, JSON.stringify(restored, null, 2));
    console.log(`✔ unpack: ${inPath} → ${outPath}`);
  } else if (cmd === 'test') {
    const src = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    const packed = pack(src);

    // Пишем во временные файлы
    const tmpPacked = inPath + '.tmp.packed.json';
    fs.writeFileSync(tmpPacked, JSON.stringify(packed, null, 2));
    const reloaded = JSON.parse(fs.readFileSync(tmpPacked, 'utf8'));
    const restored = unpack(reloaded);

    const inSize = fs.statSync(inPath).size;
    const packedSize = fs.statSync(tmpPacked).size;
    console.log(`✔ Тест: ${inPath}`);
    console.log(`  Было:   ${fmtSize(inSize)}`);
    console.log(`  Стало:  ${fmtSize(packedSize)}`);
    console.log(`  Сжатие: ${(inSize / packedSize).toFixed(2)}×`);
    console.log('');

    const results = compareSections(src, restored);
    let failed = 0;
    for (const r of results) {
      const mark = r.ok ? '✔' : '✘';
      if (!r.ok) failed++;
      console.log(`  ${mark} ${r.section}`);
    }
    console.log('');
    console.log(
      failed === 0
        ? '✅ ROUND-TRIP OK — все секции совпадают'
        : `❌ ROUND-TRIP FAILED — ${failed} секц. расходятся`
    );

    try {
      fs.unlinkSync(tmpPacked);
    } catch {}
  } else {
    console.log('Использование:');
    console.log('  node pack.js pack   <in.json>        <out.json>');
    console.log('  node pack.js unpack <in.packed.json> <out.json>');
    console.log('  node pack.js test   <in.json>');
    process.exit(1);
  }
}

main();
