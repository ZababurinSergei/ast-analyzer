#!/usr/bin/env node
// scripts/verify-consistency.ts
import * as fs from 'fs';
import * as path from 'path';

import { encode } from '../src/reporters/codec/codec-encode.js';
import { decode } from '../src/reporters/codec/codec-decode.js';
import { deepEqual, collectDiffs } from '../src/reporters/codec/codec-verify.js';
import { isValueKept } from '../src/reporters/codec/values-filter.js';
import { isJsonSafe, stableStringify } from '../src/reporters/codec/stable-stringify.js';

import type { FullJSON, CompactJSON } from '../src/reporters/codec/codec-types.js';

function diffObjects(a: unknown, b: unknown, limit = 20) {
  return collectDiffs(a, b, '$', limit);
}

interface Args {
  compact: string;
  full: string;
  verbose: boolean;
  maxDiffs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    compact: 'ast-graph-viewer/index.json',
    full: 'ast-graph-viewer/index.full.json',
    verbose: false,
    maxDiffs: 20,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-v' || a === '--verbose') args.verbose = true;
    else if (a === '--compact' && argv[i + 1]) args.compact = argv[++i]!;
    else if (a === '--full' && argv[i + 1]) args.full = argv[++i]!;
    else if (a === '--max-diffs' && argv[i + 1]) args.maxDiffs = parseInt(argv[++i]!, 10);
  }

  return args;
}

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const OK = `${C.green}✅${C.reset}`;
const FAIL = `${C.red}❌${C.reset}`;
const WARN = `${C.yellow}⚠️${C.reset}`;
const INFO = `${C.blue}ℹ️${C.reset}`;

function printHeader(title: string): void {
  console.log('');
  console.log('='.repeat(70));
  console.log(`  ${C.bold}${title}${C.reset}`);
  console.log('='.repeat(70));
}

function printSection(title: string): void {
  console.log('');
  console.log(`  ${C.bold}${title}${C.reset}`);
  console.log('  ' + '-'.repeat(66));
}

function printResult(label: string, ok: boolean, detail?: string): void {
  const mark = ok ? OK : FAIL;
  const suffix = detail ? ` ${C.dim}${detail}${C.reset}` : '';
  console.log(`  ${mark} ${label}${suffix}`);
}

function formatSize(bytes: number): string {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
  return bytes + ' B';
}

function readJson(filePath: string): any {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Файл не найден: ${abs}`);
  }
  const raw = fs.readFileSync(abs, 'utf-8');
  return JSON.parse(raw);
}

function stripServiceFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const { __codec, legend, ...rest } = obj;
  const clean: any = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) continue;
    if (k === 'edges' || k === 'edgesStats') continue;
    clean[k] = v;
  }
  return clean;
}

function stripForByteCompare(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const { legend, __codec, ...rest } = obj;
  const clean: any = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) continue;
    if (k === 'edges' || k === 'edgesStats') continue;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    clean[k] = v;
  }
  return clean;
}

function normalizeSfc(arr: any[]): any[] {
  return arr.map(s => ({
    fileId: s.fileId,
    moduleId: s.moduleId,
    name: s.name,
    blocks: s.blocks,
    composablesCount: Array.isArray(s.composables) ? s.composables.length : 0,
    propsCount: Array.isArray(s.props) ? s.props.length : 0,
    emitsCount: Array.isArray(s.emits) ? s.emits.length : 0,
    exposedCount: Array.isArray(s.exposed) ? s.exposed.length : 0,
    componentUsagesCount: Array.isArray(s.componentUsages) ? s.componentUsages.length : 0,
    htmlElementsCount: Array.isArray(s.htmlElements) ? s.htmlElements.length : 0,
  }));
}

function normalizeComposables(arr: any[]): any[] {
  return arr.map(c => ({
    name: c.name,
    fileId: c.fileId,
    kind: c.kind,
    returnShape: c.returnShape,
    returnedKeysCount: Array.isArray(c.returnedKeys) ? c.returnedKeys.length : 0,
    callersCount: Array.isArray(c.callers) ? c.callers.length : 0,
  }));
}

function normalizeWithoutId(arr: any[]): any[] {
  return arr.map(item => {
    const { id, ...rest } = item;
    void id;
    return rest;
  });
}

function normalizeVueSection(vue: any): any {
  if (!vue || typeof vue !== 'object') return vue;

  return {
    sfc: normalizeSfc(vue.sfc ?? []),
    composables: normalizeComposables(vue.composables ?? []),
    macros: normalizeWithoutId(vue.macros ?? []),
    hooks: normalizeWithoutId(vue.hooks ?? []),
    reactivity: normalizeWithoutId(vue.reactivity ?? []),
    icons: normalizeWithoutId(vue.icons ?? []),
    componentProps: vue.componentProps,
    componentEvents: vue.componentEvents,
    componentDirectives: vue.componentDirectives,
    componentSlots: vue.componentSlots,
    htmlInterpolations: vue.htmlInterpolations,
    fnHtmlUsage: vue.fnHtmlUsage,
    domApiCalls: vue.domApiCalls,
    domApiArgs: vue.domApiArgs,
    ids: vue.ids,
    sourceChains: vue.sourceChains,
  };
}

function countConditionals(full: FullJSON): number {
  let count = 0;
  for (const t of full.templates ?? []) {
    count += (t.conditionals ?? []).length;
  }
  return count;
}

// ============================================================
// ✅ v3.4.5: РАЗВЁРТКА RLE-МАССИВОВ
// ============================================================
//
// `cu_sfc` и `he_sfc` в compact.vue.sfc — это RLE-массивы
// (RLE = Run-Length Encoding). Формат каждого элемента:
//   [start, length, value?]
//
// Чтобы получить «фактическое» количество записей, нужно
// просуммировать `length` по всем сегментам, а НЕ брать
// `array.length` (это количество сегментов, а не элементов).
//
// Без этой функции проверки I51–I54 дают ложные расхождения:
//   len(he_id)=238 ≠ len(he_sfc)=69   (69 — количество RLE-сегментов)
//   len(cu_id)=77  ≠ len(cu_sfc)=33   (33 — количество RLE-сегментов)
//
// После развёртки:
//   len(he_id) === rleLength(he_sfc)  → 238 === 238 ✅
//   len(cu_id) === rleLength(cu_sfc)  → 77  === 77  ✅
// ============================================================

/**
 * Разворачивает RLE-массив и возвращает суммарную длину.
 *
 * @param rle — массив сегментов [start, length, value?]
 * @returns сумма всех `length` (или 0, если rle не массив)
 */
function rleLength(rle: Array<[number, number, number?]> | undefined): number {
  if (!Array.isArray(rle)) return 0;
  let total = 0;
  for (const entry of rle) {
    if (Array.isArray(entry) && typeof entry[1] === 'number') {
      total += entry[1];
    }
  }
  return total;
}

// ============================================================
// ✅ v3.4.5-FIX: ПРОВЕРКА isExternal ↔ toFileId
// ============================================================
//
// БАГ v3.4.4: regex `/^f\\d+$/` — двойное экранирование.
// Внутри regex-литерала `\\d` означает «буквальный \ + d»,
// а НЕ «цифра». В результате toFileId = "f1", "f28" и т.д.
// не проходили проверку и ложно помечались как «невалидный
// префикс» (568 из 974 импортов).
//
// FIX: использовать `/^f\d+$/` — одинарное экранирование.
// ============================================================

function checkImportsIsExternalConsistency(full: FullJSON): {
  ok: boolean;
  violations: string[];
  detail: string;
} {
  const imports = full.imports ?? [];
  const violations: string[] = [];

  for (const imp of imports) {
    if (!imp || !imp.id) continue;

    const toFileId = imp.toFileId;
    const isExternal = imp.isExternal === true;

    let expectedExternal: boolean;
    let kind: string;

    if (toFileId === null || toFileId === undefined) {
      expectedExternal = false;
      kind = 'null';
    } else if (toFileId.startsWith('external:')) {
      expectedExternal = true;
      kind = 'external:';
    } else if (toFileId.startsWith('unresolved:')) {
      expectedExternal = false;
      kind = 'unresolved:';
    } else if (/^f\d+$/.test(toFileId)) {
      // ✅ v3.4.5-FIX: было `/^f\\d+$/` — ложные срабатывания.
      expectedExternal = false;
      kind = 'local-f*';
    } else {
      violations.push(
        `${imp.id}: toFileId="${toFileId}" — невалидный префикс (ожидается external:*, unresolved:*, f*, null)`
      );
      continue;
    }

    if (isExternal !== expectedExternal) {
      violations.push(
        `${imp.id}: isExternal=${isExternal}, toFileId="${toFileId}" (${kind}) — ожидается isExternal=${expectedExternal}`
      );
      if (violations.length >= 50) break;
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    detail:
      violations.length === 0
        ? `${imports.length} импортов согласованы`
        : `${violations.length} нарушений из ${imports.length}`,
  };
}

function canonicalizeForComparison(value: unknown): string {
  if (value === undefined) return 'U';
  if (value === null) return 'N';

  const t = typeof value;
  if (t === 'string') return 'S:' + value;
  if (t === 'number') return 'D:' + value;
  if (t === 'boolean') return 'B:' + value;
  if (t === 'bigint') return 'I:' + value.toString();
  if (t === 'object') return 'O:' + stableStringify(value);
  if (t === 'function') return 'X:' + String(value);
  if (t === 'symbol') return 'X:' + String(value);

  return 'X:' + String(value);
}

function checkValuesConsistency(
  compact: CompactJSON,
  full: FullJSON,
  limit: number = 20
): {
  ok: boolean;
  detail: string;
  violations: string[];
  expectedKept: number;
  uniqueCount: number;
  actualUnique: number;
} {
  const violations: string[] = [];
  const mode = full.valuesMode ?? 'relations';

  const compactValues = compact.values || [];

  const compactValueSet = new Set<string>();
  for (const v of compactValues) {
    compactValueSet.add(canonicalizeForComparison(v));
  }

  const expectedUniqueKept = new Set<string>();

  let expectedKeptTotal = 0;
  let expectedRemovedTotal = 0;

  for (const cn of full.constants || []) {
    if (cn.value === undefined) continue;

    const kept = isValueKept(cn.value, mode);

    if (kept) {
      expectedKeptTotal++;
      expectedUniqueKept.add(canonicalizeForComparison(cn.value));
    } else {
      expectedRemovedTotal++;
    }
  }

  for (const expectedKey of expectedUniqueKept) {
    if (!compactValueSet.has(expectedKey)) {
      violations.push(`Уникальное значение ${expectedKey} отсутствует в compact.values[]`);
      if (violations.length >= limit) break;
    }
  }

  const expectedUniqueCount = expectedUniqueKept.size;
  const actualUniqueCount = compactValueSet.size;
  const dedupRatio =
    expectedUniqueCount > 0 ? (expectedKeptTotal / expectedUniqueCount).toFixed(2) : '1.00';

  const ok = violations.length === 0;

  const detail = ok
    ? `expectedKept=${expectedKeptTotal} (уникальных=${expectedUniqueCount}), ` +
    `compact.values=${actualUniqueCount} (dedup=${dedupRatio}x), ` +
    `removed=${expectedRemovedTotal}`
    : `${violations.length} нарушений ` +
    `(expectedKept=${expectedKeptTotal}, unique=${expectedUniqueCount}, ` +
    `compact.values=${actualUniqueCount})`;

  return {
    ok,
    detail,
    violations,
    expectedKept: expectedKeptTotal,
    uniqueCount: expectedUniqueCount,
    actualUnique: actualUniqueCount,
  };
}

function checkJsonSafetyFull(
  full: FullJSON,
  limit: number
): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const violations: string[] = [];

  for (let i = 0; i < (full.constants || []).length; i++) {
    const cn = full.constants[i];
    if (!cn || cn.value === undefined) continue;

    if (!isJsonSafe(cn.value)) {
      const ctorName =
        typeof cn.value === 'object' && cn.value !== null
          ? ((cn.value as any).constructor?.name ?? 'Object')
          : typeof cn.value;
      violations.push(`constants[${i}] (${cn.name}): ${ctorName}`);
      if (violations.length >= limit) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${full.constants?.length ?? 0} констант JSON-safe`
        : `${violations.length} не-JSON значений`,
    violations,
  };
}

function checkJsonRoundTripCompact(
  compact: CompactJSON,
  limit: number
): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const violations: string[] = [];
  const values = compact.values || [];

  const beforeJson = JSON.stringify(values);
  const afterParse = JSON.parse(beforeJson) as unknown[];

  for (let i = 0; i < Math.min(values.length, afterParse.length); i++) {
    const before = JSON.stringify(values[i]);
    const after = JSON.stringify(afterParse[i]);
    if (before !== after) {
      violations.push(`values[${i}]: "${before}" → "${after}"`);
      if (violations.length >= limit) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${values.length} значений JSON-safe`
        : `${violations.length} значений теряют данные`,
    violations,
  };
}

// ============================================================
// ✅ v3.4.4: ОЖИДАЕМАЯ СХЕМА vue.sfc — 34 поля
// ============================================================

const EXPECTED_VUE_SFC_SCHEMA: readonly string[] = [
  'f', 'n', 'b', 'c', 'cs',
  'pn', 'ps', 'en', 'es', 'xn', 'xs',
  'cu_id', 'cu_pf',
  'cu_sfc', 'cu_tag', 'cu_file', 'cu_src', 'cu_pkg', 'cu_l', 'cu_col',
  'cu_cp', 'cu_ce', 'cu_cd', 'cu_csl',
  'he_id', 'he_pf',
  'he_sfc', 'he_tag', 'he_l', 'he_col', 'he_cp', 'he_cd', 'he_ce', 'he_ci',
] as const;

function checkVueSfcMigration(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const violations: string[] = [];
  const schema = (compact as any).legend?.schemas?.['vue.sfc'];

  if (!Array.isArray(schema)) {
    return {
      ok: false,
      detail: 'legend.schemas.vue.sfc отсутствует',
      violations: ['schema missing'],
    };
  }

  const expected = EXPECTED_VUE_SFC_SCHEMA;

  if (schema.length !== expected.length) {
    violations.push(`длина схемы ${schema.length}, ожидается ${expected.length}`);
  }

  for (let i = 0; i < Math.min(schema.length, expected.length); i++) {
    if (schema[i] !== expected[i]) {
      violations.push(`индекс ${i}: "${schema[i]}" ≠ "${expected[i]}"`);
      if (violations.length >= 10) break;
    }
  }

  for (const oldKey of ['p', 'e', 'x']) {
    if (schema.includes(oldKey)) {
      violations.push(`старый ключ "${oldKey}" не должен присутствовать`);
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${schema.length} полей, миграция корректна`
        : `${violations.length} нарушений`,
    violations,
  };
}

// ============================================================
// ✅ v3.4.5: checkHtmlElementIds — инварианты I51–I54
// ============================================================
//
// cu_sfc и he_sfc — это RLE-массивы. Их длины нужно считать
// через rleLength() (развёртка), а не через .length
// (количество RLE-сегментов).
// ============================================================

function checkHtmlElementIds(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const sfc = (compact as any).vue?.sfc;
  if (!sfc) {
    return { ok: true, detail: 'vue.sfc отсутствует', violations: [] };
  }

  const violations: string[] = [];

  const cuSfc = sfc.cu_sfc;
  const heSfc = sfc.he_sfc;

  // ✅ v3.4.5-FIX: используем rleLength() вместо .length
  const cuSfcLen = rleLength(cuSfc);
  const heSfcLen = rleLength(heSfc);

  const cuIdLen = Array.isArray(sfc.cu_id) ? sfc.cu_id.length : 0;
  const cuPfLen = Array.isArray(sfc.cu_pf) ? sfc.cu_pf.length : 0;
  const heIdLen = Array.isArray(sfc.he_id) ? sfc.he_id.length : 0;
  const hePfLen = Array.isArray(sfc.he_pf) ? sfc.he_pf.length : 0;

  // I51: he_id ↔ he_sfc
  if (heIdLen !== heSfcLen) {
    violations.push(`I51: len(he_id)=${heIdLen} ≠ rleLength(he_sfc)=${heSfcLen}`);
  }

  // I52: he_pf ↔ he_sfc
  if (hePfLen !== heSfcLen) {
    violations.push(`I52: len(he_pf)=${hePfLen} ≠ rleLength(he_sfc)=${heSfcLen}`);
  }

  // I53: cu_id ↔ cu_sfc
  if (cuIdLen !== cuSfcLen) {
    violations.push(`I53: len(cu_id)=${cuIdLen} ≠ rleLength(cu_sfc)=${cuSfcLen}`);
  }

  // I54: cu_pf ↔ cu_sfc
  if (cuPfLen !== cuSfcLen) {
    violations.push(`I54: len(cu_pf)=${cuPfLen} ≠ rleLength(cu_sfc)=${cuSfcLen}`);
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `he_id/he_pf (${heIdLen}) = rleLength(he_sfc) (${heSfcLen}), ` +
        `cu_id/cu_pf (${cuIdLen}) = rleLength(cu_sfc) (${cuSfcLen})`
        : `${violations.length} нарушений`,
    violations,
  };
}

// ============================================================
// ✅ v3.4.5: checkLegendVersion — теперь '2.1.0'
// ============================================================

function checkLegendVersion(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const version = (compact as any).legend?.version;
  // ✅ v3.4.5: было '2.0.1' → стало '2.1.0'
  if (version !== '2.1.0') {
    return {
      ok: false,
      detail: `legend.version = ${version}, ожидается '2.1.0'`,
      violations: [`legend.version = ${version}`],
    };
  }
  return { ok: true, detail: "'2.1.0'", violations: [] };
}

function checkTokensType(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const tokens = (compact as any).tokens || [];
  const violations: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const typeofT = typeof t;
    if (typeofT !== 'string' && typeofT !== 'number') {
      violations.push(`tokens[${i}] = ${typeofT} (ожидается string|number)`);
      if (violations.length >= 10) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${tokens.length} элементов, тип (string|number) корректен`
        : `${violations.length} нарушений типа`,
    violations,
  };
}

function checkGrReVsReM(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const grRe = (compact as any).gr?.re;
  const re = (compact as any).re;

  if (!grRe || !re) {
    return {
      ok: true,
      detail: 'gr.re или re отсутствует — проверка пропущена',
      violations: [],
    };
  }

  const grReM = grRe.m || [];
  const reM = re.m || [];

  if (reM.length > grReM.length) {
    return {
      ok: false,
      detail: `re.m.length=${reM.length} > gr.re.m.length=${grReM.length}`,
      violations: ['re.m должен быть подмножеством gr.re.m'],
    };
  }

  return {
    ok: true,
    detail: `gr.re.m=${grReM.length}, re.m=${reM.length} (подмножество)`,
    violations: [],
  };
}

function checkFlM(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const flM = (compact as any).fl?.m || [];
  const violations: string[] = [];

  for (let i = 0; i < flM.length; i++) {
    const pair = flM[i];
    if (!Array.isArray(pair) || pair.length !== 2) {
      violations.push(`fl.m[${i}] не является парой [moduleIdx, fileIdx]`);
      if (violations.length >= 10) break;
      continue;
    }
    if (typeof pair[0] !== 'number' || typeof pair[1] !== 'number') {
      violations.push(`fl.m[${i}] содержит не-числа`);
      if (violations.length >= 10) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${flM.length} пар, формат корректен`
        : `${violations.length} нарушений`,
    violations,
  };
}

function checkFnsHv(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const fns = (compact as any).fns;
  if (!fns) {
    return { ok: true, detail: 'fns отсутствует', violations: [] };
  }

  const fnsHv = fns.hv;
  if (!Array.isArray(fnsHv)) {
    return { ok: true, detail: 'fns.hv отсутствует (опционально)', violations: [] };
  }

  const violations: string[] = [];

  let totalLength = 0;
  for (let i = 0; i < fnsHv.length; i++) {
    const entry = fnsHv[i];
    if (!Array.isArray(entry) || entry.length !== 2) {
      violations.push(`fns.hv[${i}] не является парой [value, count]`);
      if (violations.length >= 10) break;
      continue;
    }
    const [value, count] = entry;
    if (value !== 0 && value !== 1) {
      violations.push(`fns.hv[${i}][0] = ${value} (ожидается 0 или 1)`);
      if (violations.length >= 10) break;
    }
    if (typeof count !== 'number' || count < 0) {
      violations.push(`fns.hv[${i}][1] = ${count} (ожидается неотрицательное число)`);
      if (violations.length >= 10) break;
    }
    totalLength += count;
  }

  const fnsNLength = Array.isArray(fns.n) ? fns.n.length : 0;
  if (totalLength !== fnsNLength) {
    violations.push(
      `сумма counts fns.hv = ${totalLength}, но len(fns.n) = ${fnsNLength}`
    );
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${fnsHv.length} RLE-пар, развёртка = ${totalLength}, формат корректен`
        : `${violations.length} нарушений`,
    violations,
  };
}

function checkValuesAndParams(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const values = (compact as any).values || [];
  const params = (compact as any).params || [];
  const violations: string[] = [];

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const t = typeof v;
    if (v !== null && t !== 'string' && t !== 'number' && t !== 'boolean' && t !== 'object') {
      violations.push(`values[${i}] имеет недопустимый тип ${t}`);
      if (violations.length >= 10) break;
    }
  }

  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    const t = typeof p;
    const isString = t === 'string';
    const isNumberArray = Array.isArray(p) && p.every((x: any) => typeof x === 'number');
    if (!isString && !isNumberArray) {
      violations.push(
        `params[${i}] = ${JSON.stringify(p)} (ожидается string | number[])`
      );
      if (violations.length >= 10) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `values=${values.length}, params=${params.length} — форматы корректны`
        : `${violations.length} нарушений`,
    violations,
  };
}

function checkLxNonEmptyV(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const nonEmptyV = (compact as any).lx?.nonEmptyV;
  if (!Array.isArray(nonEmptyV)) {
    return { ok: true, detail: 'lx.nonEmptyV отсутствует', violations: [] };
  }

  const violations: string[] = [];
  for (let i = 0; i < nonEmptyV.length; i++) {
    const pair = nonEmptyV[i];
    if (!Array.isArray(pair) || pair.length !== 2) {
      violations.push(`lx.nonEmptyV[${i}] не является парой [index, value]`);
      if (violations.length >= 10) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${nonEmptyV.length} пар, формат корректен`
        : `${violations.length} нарушений`,
    violations,
  };
}

function checkSourceChainsInterning(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const sourceChains = (compact as any).sourceChains || [];
  const seen = new Set<string>();
  const violations: string[] = [];

  for (let i = 0; i < sourceChains.length; i++) {
    const s = sourceChains[i];
    if (typeof s !== 'string') {
      violations.push(`sourceChains[${i}] не является строкой`);
      if (violations.length >= 10) break;
      continue;
    }
    if (seen.has(s)) {
      violations.push(`sourceChains[${i}] дублирует более раннюю запись (интернирование нарушено)`);
      if (violations.length >= 10) break;
    }
    seen.add(s);
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${sourceChains.length} уникальных sourceChain`
        : `${violations.length} нарушений интернирования`,
    violations,
  };
}

function checkStatisticsExtended(compact: CompactJSON): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const st = (compact as any).st || {};
  const violations: string[] = [];

  const sourceChains = (compact as any).sourceChains || [];
  if (st.totalSourceChains !== undefined && st.totalSourceChains !== sourceChains.length) {
    violations.push(
      `st.totalSourceChains=${st.totalSourceChains}, len(sourceChains)=${sourceChains.length}`
    );
  }

  const domApiCalls = (compact as any).domApiCalls;
  if (
    st.totalDomApiCalls !== undefined &&
    domApiCalls &&
    st.totalDomApiCalls !== (domApiCalls.fn || []).length
  ) {
    violations.push(
      `st.totalDomApiCalls=${st.totalDomApiCalls}, len(domApiCalls.fn)=${(domApiCalls.fn || []).length}`
    );
  }

  const componentProps = (compact as any).componentProps;
  if (
    st.totalComponentProps !== undefined &&
    componentProps &&
    st.totalComponentProps !== (componentProps.n || []).length
  ) {
    violations.push(
      `st.totalComponentProps=${st.totalComponentProps}, len(componentProps.n)=${(componentProps.n || []).length}`
    );
  }

  const componentEvents = (compact as any).componentEvents;
  if (
    st.totalComponentEvents !== undefined &&
    componentEvents &&
    st.totalComponentEvents !== (componentEvents.n || []).length
  ) {
    violations.push(
      `st.totalComponentEvents=${st.totalComponentEvents}, len(componentEvents.n)=${(componentEvents.n || []).length}`
    );
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0 ? 'все счётчики st согласованы' : `${violations.length} нарушений`,
    violations,
  };
}

function checkVueSection(
  decoded: FullJSON,
  full: FullJSON,
  compact: CompactJSON,
  maxDiffs: number
): Array<{ name: string; ok: boolean; detail: string; diffs?: any[] }> {
  const results: Array<{ name: string; ok: boolean; detail: string; diffs?: any[] }> = [];

  {
    const violations: string[] = [];
    const sfc = decoded.vue?.sfc ?? [];
    const sfcCompact = compact.vue?.sfc;

    if (sfcCompact) {
      const sfcCS = sfcCompact.cs ?? [];
      const sfcPN = (sfcCompact as any).pn ?? [];
      const sfcPS = (sfcCompact as any).ps ?? [];
      const sfcEN = (sfcCompact as any).en ?? [];
      const sfcES = (sfcCompact as any).es ?? [];
      const sfcXN = (sfcCompact as any).xn ?? [];
      const sfcXS = (sfcCompact as any).xs ?? [];

      const sfcP = (sfcCompact as any).p ?? [];
      const sfcE = (sfcCompact as any).e ?? [];
      const sfcX = (sfcCompact as any).x ?? [];

      const sfcCLegacy =
        Array.isArray(sfcCompact.c) && Array.isArray(sfcCompact.c[0])
          ? (sfcCompact.c as any)
          : null;

      void sfcPN;
      void sfcEN;
      void sfcXN;

      for (let i = 0; i < sfc.length; i++) {
        const sfcI = sfc[i];
        if (!sfcI) continue;

        let cCount = 0;

        const csEntry = sfcCS[i];
        if (Array.isArray(csEntry) && csEntry.length === 2) {
          const value = csEntry[1];
          cCount = typeof value === 'number' ? value : 0;
        } else {
          const legacyEntry = sfcCLegacy ? sfcCLegacy[i] : undefined;
          if (Array.isArray(legacyEntry) && legacyEntry.length === 2) {
            const value = legacyEntry[1];
            cCount = typeof value === 'number' ? value : 0;
          }
        }

        const pCount =
          (Array.isArray(sfcPS[i]) ? (sfcPS[i] as any)[1] : 0) ||
          (Array.isArray(sfcP[i]) ? (sfcP[i] as any)[1] : 0) ||
          0;
        const eCount =
          (Array.isArray(sfcES[i]) ? (sfcES[i] as any)[1] : 0) ||
          (Array.isArray(sfcE[i]) ? (sfcE[i] as any)[1] : 0) ||
          0;
        const xCount =
          (Array.isArray(sfcXS[i]) ? (sfcXS[i] as any)[1] : 0) ||
          (Array.isArray(sfcX[i]) ? (sfcX[i] as any)[1] : 0) ||
          0;

        if ((sfcI.composables?.length ?? 0) !== cCount) {
          violations.push(
            `sfc[${i}]: c/cs.count=${cCount}, composables.length=${sfcI.composables?.length ?? 0}`
          );
        }
        if ((sfcI.props?.length ?? 0) !== pCount) {
          violations.push(`sfc[${i}]: p[1]=${pCount}, props.length=${sfcI.props?.length ?? 0}`);
        }
        if ((sfcI.emits?.length ?? 0) !== eCount) {
          violations.push(`sfc[${i}]: e[1]=${eCount}, emits.length=${sfcI.emits?.length ?? 0}`);
        }
        if ((sfcI.exposed?.length ?? 0) !== xCount) {
          violations.push(`sfc[${i}]: x[1]=${xCount}, exposed.length=${sfcI.exposed?.length ?? 0}`);
        }

        if (violations.length >= maxDiffs) break;
      }
    }

    results.push({
      name: 'I17: vue.sfc.c/cs/p/e/x ↔ decoded.vue.sfc[].*',
      ok: violations.length === 0,
      detail:
        violations.length === 0
          ? `${sfc.length} SFC согласованы`
          : `${violations.length} нарушений`,
      diffs: violations.map(v => ({ path: '$.vue.sfc', a: v, b: '—' })),
    });
  }

  {
    const violations: string[] = [];
    const fnsVkRaw = compact.fns?.vk;

    if (Array.isArray(fnsVkRaw)) {
      const vk: number[] = [];
      for (const entry of fnsVkRaw) {
        if (Array.isArray(entry) && entry.length === 2) {
          const [val, count] = entry;
          for (let k = 0; k < count; k++) vk.push(val);
        }
      }

      const VUE_KIND_BY_CODE: Record<number, string> = {
        0: 'function',
        1: 'composable',
        2: 'macro',
        3: 'hook',
        4: 'reactivity',
        5: 'callback',
        6: 'arrow',
      };

      const functions = decoded.functions ?? [];
      for (let i = 0; i < functions.length; i++) {
        const fn = functions[i];
        if (!fn) continue;
        const expected = VUE_KIND_BY_CODE[vk[i] ?? 0] ?? 'function';
        const actual = fn.vueKind ?? 'function';
        if (actual !== expected) {
          violations.push(`fns[${i}] (${fn.name}): vk=${vk[i]}, vueKind="${actual}"`);
          if (violations.length >= maxDiffs) break;
        }
      }
    }

    results.push({
      name: 'I18: fns.vk ↔ functions[].vueKind',
      ok: violations.length === 0,
      detail:
        violations.length === 0
          ? `${(decoded.functions ?? []).length} функций согласованы`
          : `${violations.length} нарушений`,
      diffs: violations.map(v => ({ path: '$.functions[].vueKind', a: v, b: '—' })),
    });
  }

  const decodedVue = (decoded as any).vue;
  const fullVue = (full as any).vue;

  if (decodedVue || fullVue) {
    const normDecoded = normalizeVueSection(decodedVue);
    const normFull = normalizeVueSection(fullVue);

    const vueSubsections = [
      'sfc',
      'composables',
      'macros',
      'hooks',
      'reactivity',
      'icons',
      'componentProps',
      'componentEvents',
      'componentDirectives',
      'componentSlots',
      'htmlInterpolations',
      'fnHtmlUsage',
      'domApiCalls',
      'domApiArgs',
    ] as const;

    for (const sub of vueSubsections) {
      const a = normDecoded?.[sub] ?? [];
      const b = normFull?.[sub] ?? [];

      const aArr = Array.isArray(a) ? a : [];
      const bArr = Array.isArray(b) ? b : [];

      const ok = deepEqual(aArr, bArr);
      const detail = ok
        ? `${aArr.length} элементов`
        : `decoded=${aArr.length}, full=${bArr.length}`;

      const result: { name: string; ok: boolean; detail: string; diffs?: any[] } = {
        name: `vue.${sub}`,
        ok,
        detail,
      };

      if (!ok) {
        result.diffs = diffObjects(aArr, bArr, maxDiffs);
      }

      results.push(result);
    }
  }

  return results;
}

function compareDictionaries(
  label: string,
  a: { tokens: (string | number)[]; dict: (string | number[])[] },
  b: { tokens: (string | number)[]; dict: (string | number[])[] }
): { ok: boolean; diffs: { path: string; a: unknown; b: unknown }[] } {
  const diffs: { path: string; a: unknown; b: unknown }[] = [];

  const decodeEntry = (
    entry: string | number[],
    tokens: (string | number)[]
  ): string => {
    if (typeof entry === 'string') return entry;
    return entry.map(i => String(tokens[i] ?? '')).join('');
  };

  const aSet = new Set(a.dict.map(e => decodeEntry(e, a.tokens)));
  const bSet = new Set(b.dict.map(e => decodeEntry(e, b.tokens)));

  if (aSet.size !== bSet.size) {
    diffs.push({
      path: `${label}.size`,
      a: aSet.size,
      b: bSet.size,
    });
  }

  const onlyInA = [...aSet].filter(s => !bSet.has(s));
  const onlyInB = [...bSet].filter(s => !aSet.has(s));

  if (onlyInA.length > 0) {
    diffs.push({
      path: `${label}.onlyInA`,
      a: onlyInA.slice(0, 10),
      b: `(${onlyInA.length} всего)`,
    });
  }
  if (onlyInB.length > 0) {
    diffs.push({
      path: `${label}.onlyInB`,
      a: `(${onlyInB.length} всего)`,
      b: onlyInB.slice(0, 10),
    });
  }

  return { ok: diffs.length === 0, diffs };
}

function compareSections(
  decoded: FullJSON,
  full: FullJSON,
  maxDiffs: number
): Array<{ name: string; ok: boolean; detail: string; diffs?: any[] }> {
  const sectionNames = [
    'templates',
    'lifecycle',
    'effects',
    'injections',
    'reactivity',
    'types',
    'typeRefs',
  ] as const;

  const results: Array<{ name: string; ok: boolean; detail: string; diffs?: any[] }> = [];

  for (const name of sectionNames) {
    const a = (decoded as any)[name];
    const b = (full as any)[name];

    const normA = Array.isArray(a) ? a : [];
    const normB = Array.isArray(b) ? b : [];

    const ok = deepEqual(normA, normB);
    const detail = ok
      ? `${normA.length} элементов`
      : `decoded=${normA.length}, full=${normB.length}`;

    const result: { name: string; ok: boolean; detail: string; diffs?: any[] } = {
      name,
      ok,
      detail,
    };

    if (!ok) {
      result.diffs = diffObjects(normA, normB, maxDiffs);
    }

    results.push(result);
  }

  return results;
}

function compareImportsTypeOnly(
  decoded: FullJSON,
  full: FullJSON,
  maxDiffs: number
): { ok: boolean; detail: string; diffs?: any[]; variant: 'A' | 'B' } {
  const usesTypeLiteral = (full.imports || []).some((i: any) => i.type === 'type');
  const variant: 'A' | 'B' = usesTypeLiteral ? 'B' : 'A';

  const a = (decoded.imports || []).map((i: any) => ({
    id: i.id,
    isTypeOnly: i.isTypeOnly,
    isNamespace: i.isNamespace,
    type: i.type,
  }));
  const b = (full.imports || []).map((i: any) => ({
    id: i.id,
    isTypeOnly: i.isTypeOnly,
    isNamespace: i.isNamespace,
    type: i.type,
  }));

  const ok = deepEqual(a, b);
  if (ok) {
    return {
      ok: true,
      detail: `${a.length} импортов (вариант ${variant})`,
      variant,
    };
  }

  const diffs = diffObjects(a, b, maxDiffs);
  return {
    ok: false,
    detail: `${diffs.length} расхождений (вариант ${variant})`,
    diffs,
    variant,
  };
}

function checkConditionalsDedup(
  compact: CompactJSON,
  decoded: FullJSON,
  full: FullJSON
): { ok: boolean; detail: string; diffs?: any[] } {
  const cdIndices = (compact as any).cd;

  const decodedCd = countConditionals(decoded);
  const fullCd = countConditionals(full);

  if (!Array.isArray(cdIndices)) {
    if (fullCd === 0) {
      return { ok: true, detail: 'conditionals отсутствуют (0)' };
    }
    return {
      ok: false,
      detail: `compact.cd отсутствует, а full.templates[].conditionals = ${fullCd}`,
      diffs: [{ path: '$.cd', a: 'missing', b: `${fullCd} элементов в templates[]` }],
    };
  }

  const compactCdLen = cdIndices.length;
  const ok = compactCdLen === decodedCd && decodedCd === fullCd;

  if (ok) {
    return {
      ok: true,
      detail: `compact.cd=${compactCdLen}, templates=${decodedCd}/${fullCd}`,
    };
  }

  const uniqueIndices = new Set(cdIndices.filter((x: any) => typeof x === 'number'));
  const uniqueCount = uniqueIndices.size;

  const diffs: { path: string; a: unknown; b: unknown }[] = [
    {
      path: '$.cd.length',
      a: compactCdLen,
      b: `${fullCd} (unique values: ${uniqueCount})`,
    },
  ];

  if (uniqueCount < compactCdLen) {
    diffs.push({
      path: '$.cd (дедупликация)',
      a: `${compactCdLen} ссылок, но только ${uniqueCount} уникальных value`,
      b: 'ожидается 1:1 (addAny не должен дедуплицировать extended-секции)',
    });
  }

  return {
    ok: false,
    detail: `compact.cd=${compactCdLen}, decoded.templates=${decodedCd}, full.templates=${fullCd}, unique=${uniqueCount}`,
    diffs,
  };
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  diffs?: { path: string; a: unknown; b: unknown }[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // ✅ v3.4.5: заголовок обновлён
  printHeader('🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ index.json ↔ index.full.json (v3.4.5)');
  console.log(`  ${INFO} compact: ${C.cyan}${path.resolve(args.compact)}${C.reset}`);
  console.log(`  ${INFO} full:    ${C.cyan}${path.resolve(args.full)}${C.reset}`);
  console.log(`  ${INFO} verbose: ${args.verbose}`);
  console.log(`  ${INFO} maxDiffs: ${args.maxDiffs}`);

  printSection('📂 ЗАГРУЗКА ФАЙЛОВ');

  const compactRaw = readJson(args.compact);
  const fullRaw = readJson(args.full);

  const compactSize = JSON.stringify(compactRaw).length;
  const fullSize = JSON.stringify(fullRaw).length;

  console.log(`  ${INFO} compact size: ${formatSize(compactSize)}`);
  console.log(`  ${INFO} full size:    ${formatSize(fullSize)}`);

  const compact = compactRaw as CompactJSON;
  const full = fullRaw as FullJSON;

  printSection('📅 МЕТАДАННЫЕ');

  const checks: CheckResult[] = [];

  {
    const a = compact.ts;
    const b = full.timestamp;
    const ok = a === b;
    checks.push({
      name: 'timestamp',
      ok,
      detail: ok ? `"${a}"` : `"${a}" vs "${b}"`,
    });
    printResult('timestamp', ok, ok ? `"${a}"` : `compact="${a}" full="${b}"`);
  }

  {
    const a = compact.v;
    const b = full.version;
    const ok = a === b;
    checks.push({
      name: 'version',
      ok,
      detail: ok ? `"${a}"` : `"${a}" vs "${b}"`,
    });
    printResult('version', ok, ok ? `"${a}"` : `compact="${a}" full="${b}"`);
  }

  {
    const a = compact.valuesMode ?? 'full';
    const b = full.valuesMode ?? 'full';
    const ok = a === b;
    checks.push({
      name: 'valuesMode',
      ok,
      detail: ok ? `"${a}"` : `"${a}" vs "${b}"`,
    });
    printResult('valuesMode', ok, ok ? `"${a}"` : `compact="${a}" full="${b}"`);
  }

  printSection('📊 STATISTICS');

  {
    const a = compact.st || {};
    const b = full.statistics || {};
    const ok = deepEqual(a, b);
    const diffs = ok ? [] : diffObjects(a, b, args.maxDiffs);
    checks.push({ name: 'statistics', ok, diffs });
    printResult(
      'statistics',
      ok,
      ok ? '' : `${diffs.length} расхождений (показано до ${args.maxDiffs})`
    );
    if (!ok && args.verbose) {
      for (const d of diffs.slice(0, args.maxDiffs)) {
        console.log(
          `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
        );
      }
    }
  }

  printSection('🔁 decode(compact) ≟ full');

  let decodedCompact: FullJSON | null = null;
  {
    try {
      decodedCompact = decode(compact);
      const aRaw = stripServiceFields(decodedCompact);
      const bRaw = stripServiceFields(full);

      const a = { ...aRaw, vue: normalizeVueSection(aRaw.vue) };
      const b = { ...bRaw, vue: normalizeVueSection(bRaw.vue) };

      const ok = deepEqual(a, b);
      const diffs = ok ? [] : diffObjects(a, b, args.maxDiffs);
      checks.push({ name: 'decode(compact) ≟ full', ok, diffs });
      printResult(
        'decode(compact) ≟ full',
        ok,
        ok ? '' : `${diffs.length} расхождений (показано до ${args.maxDiffs})`
      );
      if (!ok && args.verbose) {
        for (const d of diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
    } catch (err) {
      checks.push({ name: 'decode(compact) ≟ full', ok: false, detail: (err as Error).message });
      printResult('decode(compact) ≟ full', false, (err as Error).message);
    }
  }

  printSection('🔁 encode(full) ≟ compact');

  let encodedFull: CompactJSON | null = null;
  {
    try {
      encodedFull = encode(full, full.valuesMode ?? 'relations');
      const a = stripForByteCompare(encodedFull);
      const b = stripForByteCompare(compact);
      const ok = deepEqual(a, b);
      const diffs = ok ? [] : diffObjects(a, b, args.maxDiffs);
      checks.push({ name: 'encode(full) ≟ compact', ok, diffs });
      printResult(
        'encode(full) ≟ compact',
        ok,
        ok ? '' : `${diffs.length} расхождений (показано до ${args.maxDiffs})`
      );
      if (!ok && args.verbose) {
        for (const d of diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
    } catch (err) {
      checks.push({ name: 'encode(full) ≟ compact', ok: false, detail: (err as Error).message });
      printResult('encode(full) ≟ compact', false, (err as Error).message);
    }
  }

  printSection('🔗 СОГЛАСОВАННОСТЬ IMPORTS (isExternal ↔ toFileId)');

  {
    const result = checkImportsIsExternalConsistency(full);
    printResult('imports[].isExternal ↔ toFileId', result.ok, result.detail);

    if (!result.ok && args.verbose) {
      for (const v of result.violations.slice(0, args.maxDiffs)) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
      if (result.violations.length > args.maxDiffs) {
        console.log(`     ${C.dim}... и ещё ${result.violations.length - args.maxDiffs}${C.reset}`);
      }
    }

    checks.push({
      name: 'imports[].isExternal ↔ toFileId',
      ok: result.ok,
      detail: result.detail,
    });
  }

  printSection('🔢 СОГЛАСОВАННОСТЬ VALUES (compact.values ↔ full.constants)');

  {
    const result = checkValuesConsistency(compact, full, args.maxDiffs);
    printResult('values[] consistency', result.ok, result.detail);

    if (!result.ok && args.verbose) {
      for (const v of result.violations.slice(0, args.maxDiffs)) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
      if (result.violations.length > args.maxDiffs) {
        console.log(`     ${C.dim}... и ещё ${result.violations.length - args.maxDiffs}${C.reset}`);
      }
    }

    if (args.verbose && result.ok) {
      const dedupRatio =
        result.uniqueCount > 0 ? (result.expectedKept / result.uniqueCount).toFixed(2) : '1.00';
      console.log(
        `     ${C.dim}ℹ️  Дедупликация: ${result.expectedKept} → ${result.uniqueCount} (${dedupRatio}x)${C.reset}`
      );
    }

    checks.push({
      name: 'values[] consistency',
      ok: result.ok,
      detail: result.detail,
    });
  }

  printSection('🔒 JSON-SAFE ПРОВЕРКИ');

  {
    const fullSafe = checkJsonSafetyFull(full, args.maxDiffs);
    printResult('full.constants[].value JSON-safe', fullSafe.ok, fullSafe.detail);
    if (!fullSafe.ok && args.verbose) {
      for (const v of fullSafe.violations) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
    }
    checks.push({
      name: 'full.constants[].value JSON-safe',
      ok: fullSafe.ok,
      detail: fullSafe.detail,
    });
  }

  {
    const compactSafe = checkJsonRoundTripCompact(compact, args.maxDiffs);
    printResult('compact.values[] JSON round-trip', compactSafe.ok, compactSafe.detail);
    if (!compactSafe.ok && args.verbose) {
      for (const v of compactSafe.violations) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
    }
    checks.push({
      name: 'compact.values[] JSON round-trip',
      ok: compactSafe.ok,
      detail: compactSafe.detail,
    });
  }

  // ✅ v3.4.5: заголовок секции обновлён
  printSection('🔧 v3.4.5: НОВЫЕ ПРОВЕРКИ (миграция, типы, интернирование, ids)');

  {
    const r = checkLegendVersion(compact);
    // ✅ v3.4.5: ожидается '2.1.0'
    printResult('legend.version = 2.1.0', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'legend.version', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkVueSfcMigration(compact);
    // ✅ v3.4.4: 34 поля
    printResult('vue.sfc миграция (34 поля)', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'vue.sfc миграция', ok: r.ok, detail: r.detail });
  }

  // ✅ v3.4.5-FIX: проверка ids с rleLength()
  {
    const r = checkHtmlElementIds(compact);
    printResult('he_id/he_pf/cu_id/cu_pf ↔ he_sfc/cu_sfc', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'vue.sfc ids (I51–I54)', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkTokensType(compact);
    printResult('tokens (string | number)[]', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'tokens type', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkGrReVsReM(compact);
    printResult('gr.re vs re.m', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'gr.re vs re.m', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkFlM(compact);
    printResult('fl.m — пары [moduleIdx, fileIdx]', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'fl.m format', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkFnsHv(compact);
    printResult('fns.hv — RLE-массив isHtmlVisible (0/1)', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'fns.hv format', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkValuesAndParams(compact);
    printResult('values / params — форматы', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'values/params format', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkLxNonEmptyV(compact);
    printResult('lx.nonEmptyV — пары [index, value]', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'lx.nonEmptyV', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkSourceChainsInterning(compact);
    printResult('sourceChains — интернирование', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'sourceChains interning', ok: r.ok, detail: r.detail });
  }

  {
    const r = checkStatisticsExtended(compact);
    printResult('st — расширенные счётчики', r.ok, r.detail);
    if (!r.ok) for (const v of r.violations) console.log(`     ${C.red}•${C.reset} ${v}`);
    checks.push({ name: 'st extended', ok: r.ok, detail: r.detail });
  }

  printSection('🌿 СОГЛАСОВАННОСТЬ VUE-СЕКЦИИ');

  if (decodedCompact) {
    const vueResults = checkVueSection(decodedCompact, full, compact, args.maxDiffs);

    for (const vr of vueResults) {
      printResult(vr.name, vr.ok, vr.detail);
      if (!vr.ok && args.verbose && vr.diffs) {
        for (const d of vr.diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
        if (vr.diffs.length > args.maxDiffs) {
          console.log(`     ${C.dim}... и ещё ${vr.diffs.length - args.maxDiffs}${C.reset}`);
        }
      }
      checks.push({ name: `vue.${vr.name}`, ok: vr.ok, detail: vr.detail });
    }
  } else {
    printResult('vue section', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'vue section', ok: false, detail: 'decode failed' });
  }

  printSection('📦 МОДУЛИ (name и fileIds по индексам)');

  if (decodedCompact) {
    const aMods = decodedCompact.modules || [];
    const bMods = full.modules || [];
    const n = Math.min(aMods.length, bMods.length);

    if (aMods.length !== bMods.length) {
      printResult('modules.length', false, `compact=${aMods.length} full=${bMods.length}`);
      checks.push({
        name: 'modules.length',
        ok: false,
        detail: `compact=${aMods.length} full=${bMods.length}`,
      });
    }

    let nameDiffs = 0;
    let fileIdsDiffs = 0;

    for (let i = 0; i < n; i++) {
      const a = aMods[i];
      const b = bMods[i];
      if (!a || !b) continue;

      if (a.name !== b.name) {
        nameDiffs++;
        if (args.verbose && nameDiffs <= args.maxDiffs) {
          console.log(
            `  ${FAIL} modules[${i}].name: ${C.red}"${a.name}"${C.reset} → ${C.green}"${b.name}"${C.reset}`
          );
        }
      }

      const aIds = a.fileIds || [];
      const bIds = b.fileIds || [];
      if (!deepEqual(aIds, bIds)) {
        fileIdsDiffs++;
        if (args.verbose && fileIdsDiffs <= args.maxDiffs) {
          console.log(`  ${FAIL} modules[${i}].fileIds (name="${a.name}")`);
          console.log(`     ${C.red}${JSON.stringify(aIds)}${C.reset}`);
          console.log(`     ${C.green}${JSON.stringify(bIds)}${C.reset}`);
        }
      }
    }

    printResult(
      'modules[].name совпадают',
      nameDiffs === 0,
      nameDiffs === 0 ? `${n} модулей` : `${nameDiffs} расхождений`
    );
    printResult(
      'modules[].fileIds совпадают',
      fileIdsDiffs === 0,
      fileIdsDiffs === 0 ? `${n} модулей` : `${fileIdsDiffs} расхождений`
    );

    checks.push({ name: 'modules[].name', ok: nameDiffs === 0 });
    checks.push({ name: 'modules[].fileIds', ok: fileIdsDiffs === 0 });
  } else {
    printResult('modules', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'modules', ok: false, detail: 'decode failed' });
  }

  printSection(
    '🎨 СЕКЦИИ (templates, lifecycle, effects, injections, reactivity, types, typeRefs)'
  );

  if (decodedCompact) {
    const sectionResults = compareSections(decodedCompact, full, args.maxDiffs);

    for (const sr of sectionResults) {
      printResult(sr.name, sr.ok, sr.detail);
      if (!sr.ok && args.verbose && sr.diffs) {
        for (const d of sr.diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
      checks.push({ name: `section.${sr.name}`, ok: sr.ok, detail: sr.detail });
    }
  } else {
    printResult('sections', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'sections', ok: false, detail: 'decode failed' });
  }

  printSection('📥 ИМПОРТЫ (isTypeOnly / isNamespace / type)');

  if (decodedCompact) {
    const impResult = compareImportsTypeOnly(decodedCompact, full, args.maxDiffs);
    printResult('imports[].isTypeOnly', impResult.ok, impResult.detail);
    if (!impResult.ok && args.verbose && impResult.diffs) {
      for (const d of impResult.diffs.slice(0, args.maxDiffs)) {
        console.log(
          `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
        );
      }
    }
    checks.push({
      name: 'imports[].isTypeOnly',
      ok: impResult.ok,
      detail: impResult.detail,
    });
  } else {
    printResult('imports', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'imports', ok: false, detail: 'decode failed' });
  }

  printSection('🎯 CONDITIONALS (через templates[], проверка дедупликации compact.cd[])');

  if (decodedCompact) {
    const dedupResult = checkConditionalsDedup(compact, decodedCompact, full);
    printResult('conditionals dedup', dedupResult.ok, dedupResult.detail);
    if (!dedupResult.ok && args.verbose && dedupResult.diffs) {
      for (const d of dedupResult.diffs.slice(0, args.maxDiffs)) {
        console.log(
          `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
        );
      }
    }
    checks.push({
      name: 'conditionals dedup',
      ok: dedupResult.ok,
      detail: dedupResult.detail,
    });
  } else {
    printResult('conditionals dedup', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'conditionals dedup', ok: false, detail: 'decode failed' });
  }

  printSection('📚 СЛОВАРИ (tokens/strs/params/methods)');

  if (encodedFull) {
    const dictChecks = [
      {
        label: 'strs',
        a: { tokens: compact.tokens || [], dict: compact.strs || [] },
        b: { tokens: encodedFull.tokens || [], dict: encodedFull.strs || [] },
      },
      {
        label: 'params',
        a: { tokens: compact.tokens || [], dict: compact.params || [] },
        b: { tokens: encodedFull.tokens || [], dict: encodedFull.params || [] },
      },
      {
        label: 'methods',
        a: { tokens: compact.tokens || [], dict: compact.methods || [] },
        b: { tokens: encodedFull.tokens || [], dict: encodedFull.methods || [] },
      },
    ];

    for (const { label, a, b } of dictChecks) {
      const { ok, diffs } = compareDictionaries(label, a, b);
      printResult(
        `${label} (семантически)`,
        ok,
        ok ? `${a.dict.length} записей` : `${diffs.length} расхождений`
      );
      if (!ok && args.verbose) {
        for (const d of diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}:${C.reset} ${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
      checks.push({ name: `dict.${label}`, ok });
    }

    {
      const aSet = new Set(compact.tokens || []);
      const bSet = new Set(encodedFull.tokens || []);
      const ok = aSet.size === bSet.size && [...aSet].every(t => bSet.has(t));
      printResult(
        'tokens (семантически)',
        ok,
        ok ? `${aSet.size} токенов` : `compact=${aSet.size} encoded=${bSet.size}`
      );
      checks.push({ name: 'dict.tokens', ok });
    }
  } else {
    printResult('словари', false, 'encode(full) не удался — пропускаем');
    checks.push({ name: 'dictionaries', ok: false, detail: 'encode failed' });
  }

  printHeader('📊 ИТОГИ');

  const total = checks.length;
  const passed = checks.filter(c => c.ok).length;
  const failed = checks.filter(c => !c.ok).length;

  for (const c of checks) {
    const mark = c.ok ? OK : FAIL;
    const detail = c.detail ? ` ${C.dim}(${c.detail})${C.reset}` : '';
    console.log(`  ${mark} ${c.name}${detail}`);
  }

  console.log('');
  console.log(`  Всего:  ${total}`);
  console.log(`  ${C.green}Прошло: ${passed}${C.reset}`);
  if (failed > 0) {
    console.log(`  ${C.red}Провалено: ${failed}${C.reset}`);
  } else {
    console.log(`  ${C.dim}Провалено: 0${C.reset}`);
  }

  console.log('');
  if (failed === 0) {
    console.log(
      `  ${C.green}${C.bold}✅ СОГЛАСОВАНО — index.json и index.full.json собраны из одних исходников${C.reset}`
    );
    process.exit(0);
  } else {
    console.log(
      `  ${C.red}${C.bold}❌ РАССИНХРОНИЗИРОВАНО — index.json и index.full.json из разных сборок${C.reset}`
    );
    console.log('');
    console.log(`  ${WARN} Что делать:`);
    console.log('');
    console.log(`  ${C.bold}1. Пересобрать index.full.json${C.reset} из тех же исходников,`);
    console.log(`     что и index.json, ОДНИМ прогоном.`);
    console.log('');
    // ✅ v3.4.5: CODEC_VERSION = '16.1.0'
    console.log(`  ${C.bold}2. Проверить CODEC_VERSION${C.reset} в обоих файлах — должен`);
    console.log(`     быть ${C.cyan}'16.1.0'${C.reset}.`);
    console.log('');
    // ✅ v3.4.5: legend.version = '2.1.0'
    console.log(`  ${C.bold}3. Проверить legend.version${C.reset} — должен быть`);
    console.log(`     ${C.cyan}'2.1.0'${C.reset}.`);
    console.log('');
    console.log(`  ${C.bold}4. Если расхождение в vue.sfc${C.reset} — проверить миграцию`);
    console.log(`     8 → 34 поля (см. checkVueSfcMigration).`);
    console.log('');
    console.log(`  ${C.bold}5. Если расхождение в sourceChains${C.reset} — проверить`);
    console.log(`     интернирование (см. checkSourceChainsInterning).`);
    console.log('');
    console.log(`  ${C.bold}6. Если расхождение в st${C.reset} — проверить счётчики`);
    console.log(`     (см. checkStatisticsExtended).`);
    console.log('');
    console.log(`  ${C.bold}7. Если расхождение в fns.hv${C.reset} — проверить`);
    console.log(`     RLE-массив isHtmlVisible (см. checkFnsHv).`);
    console.log('');
    // ✅ v3.4.5: пункт 8 про he_id/he_pf/cu_id/cu_pf + rleLength
    console.log(`  ${C.bold}8. Если расхождение в he_id/he_pf/cu_id/cu_pf${C.reset} — проверить`);
    console.log(`     длины массивов (см. checkHtmlElementIds, инварианты I51–I54).`);
    console.log(`     ${C.cyan}⚠️  cu_sfc и he_sfc — это RLE-массивы, их длины нужно`);
    console.log(`     считать через rleLength() (развёртка), а не через .length.${C.reset}`);
    console.log('');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`${C.red}Фатальная ошибка:${C.reset}`, err);
  process.exit(2);
});
