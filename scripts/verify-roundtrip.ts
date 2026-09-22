#!/usr/bin/env node
// scripts/verify-roundtrip.ts
// ============================================
// Скрипт проверки Round-Trip для CODEC (v15.6.0)
// ============================================
// Версия: 15.6.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.6.0 (JSON-safe проверки):
//   - ✅ ДОБАВЛЕНО: инвариант I15 — compact.values[] содержит
//     только JSON-safe значения (Set/Map/RegExp/Date/class
//     instances ловятся здесь).
//   - ✅ ДОБАВЛЕНО: инвариант I16 — full.constants[].value
//     содержит только JSON-safe значения.
//   - ✅ ДОБАВЛЕНО: структурная проверка checkJsonSafetyInFile —
//     JSON.stringify(compact.values) ≟ JSON.parse(...).values
//     (ловит потерю данных при записи на диск).
//   - ✅ ОБНОВЛЕНО: заголовок v15.4.0 → v15.6.0.
//
// v15.4.0 (P3 — cross-file resolution):
//   - ✅ ОБНОВЛЕНО: codecVersion в jsonReport = '15.4.0'
//
// v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: инвариант I13 — gr.c.col/ck/cn/ai — согласованность длин
//   - ✅ ДОБАВЛЕНО: spot-check для callKind/calleeName/argumentIndex
//
// v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: инварианты I11, I12
//   - ✅ ДОБАВЛЕНО: spot-check lexicalLinks
//   - ✅ ДОБАВЛЕНО: countLexicalLinks(full)
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: инварианты I9, I10
//
// v15.0.6 (gr.i.tf — индекс в fl.p):
//   - ✅ ДОБАВЛЕНО: инвариант I8
//
// v15.0.2 (устранение дублирования conditionals):
//   - ✅ УБРАНО: 'conditionals' из sectionNames в compareSections
//   - ✅ ДОБАВЛЕНО: countConditionals(full)
//
// v15.0.1:
//   - ✅ ИСПРАВЛЕНО: инвариант I2 — imports[].type ∈ {named, default, namespace}
//   - ✅ ДОБАВЛЕНО: проверка isTypeOnly у импортов
//   - ✅ ДОБАВЛЕНО: явные проверки секций vt/lc/ef/inj/rx/cd/ty/tr
//
// Уровни round-trip:
//   L0  : encode(full) === compact          (семантически)
//   L1  : decode(compact) === full          (семантически)
//   L2  : decode(compact) === full          (побайтово, порядко-независимо)
//   L3  : compact на диске === encode(full) (побайтово, буквально)
//   L4  : encode(decode(encode(full))) === encode(full) (побайтово)
//   RE  : encode(decode(compact)) === compact
//   DL  : decode(encode(full)) === full
//   ENC : encode(full) === encode(decode(encode(full)))
//   DEC : decode(compact) === decode(encode(decode(compact)))
//
// Семантические инварианты:
//   I1  : calls[].type ∈ {direct, async, method, callback}
//   I2  : imports[].type ∈ {named, default, namespace}
//   I3  : exports[].type ∈ {named, default, type}
//   I4  : external calls → isExternal = 1 в compact.gr.c
//   I5  : external calls: сохранность типа (full vs decoded)
//   I6  : functions[].*Flags ∈ {true, false, undefined}
//   I7  : fns/cls/cn — columnar-структура
//   I8  : gr.i.tf — индекс в fl.p (-1 для внешних) — v15.0.6
//   I9  : fns.parent — валидный индекс или -1 — v15.1.0 (P0)
//   I10 : parentFunctionId — целостность — v15.1.0 (P0)
//   I11 : lx.p/lx.c — валидные индексы — v15.2.0 (P1)
//   I12 : lexicalLinks — целостность — v15.2.0 (P1)
//   I13 : gr.c.col/ck/cn/ai — согласованность длин — v15.3.0 (P2)
//   I15 : compact.values[] — только JSON-safe значения — v15.6.0
//   I16 : full.constants[].value — только JSON-safe значения — v15.6.0
//
// Проверки легенды:
//   L1  : legend.codes.* присутствуют
//   L2  : legend.flags.bits содержит 18 битов
//   L3  : legend.schemas.* корректной длины
//
// Exit code 0 — всё ок, 1 — есть расхождения.
// ============================================

import fs from 'fs';
import path from 'path';
import { Codec } from '../src/reporters/codec/codec.js';
import { verifyRoundTripBoth } from '../src/reporters/codec/codec-verify.js';
import type { CompactJSON, FullJSON, CallData } from '../src/reporters/codec/codec-types.js';

// ✅ v15.6.0: импорт isJsonSafe для I15/I16
import { isJsonSafe } from '../src/reporters/codec/stable-stringify.js';

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

interface ScriptOptions {
  compactPath: string;
  fullPath: string;
  verbose: boolean;
  maxDiffs: number;
  jsonReportPath: string | null;
  goldenDir: string | null;
  checkLegend: boolean;
}

const DEFAULT_OPTIONS: ScriptOptions = {
  compactPath: './ast-graph-viewer/index.json',
  fullPath: './ast-graph-viewer/index.full.json',
  verbose: false,
  maxDiffs: 10,
  jsonReportPath: null,
  goldenDir: './scripts/fixtures',
  checkLegend: true,
};

// ============================================
// ANSI-ЦВЕТА
// ============================================

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// ============================================
// ЛОГГЕРЫ
// ============================================

function log(msg: string): void {
  console.log(msg);
}
function ok(msg: string): void {
  console.log(`${C.green}✅ ${msg}${C.reset}`);
}
function fail(msg: string): void {
  console.log(`${C.red}❌ ${msg}${C.reset}`);
}
function warn(msg: string): void {
  console.log(`${C.yellow}⚠️  ${msg}${C.reset}`);
}
function info(msg: string): void {
  console.log(`${C.cyan}ℹ️  ${msg}${C.reset}`);
}

function section(title: string): void {
  console.log(`\n${C.bold}${C.blue}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bold}${C.blue}  ${title}${C.reset}`);
  console.log(`${C.bold}${C.blue}${'='.repeat(70)}${C.reset}`);
}

function subsection(title: string): void {
  console.log(`\n${C.bold}── ${title} ──${C.reset}`);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readJson<T>(filePath: string): T {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    fail(`Файл не найден: ${abs}`);
    process.exit(1);
  }
  const content = fs.readFileSync(abs, 'utf-8');
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    fail(`Не удалось распарсить JSON: ${abs}`);
    console.error(err);
    process.exit(1);
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(path.resolve(filePath));
  } catch {
    return false;
  }
}

// ============================================
// ХЕЛПЕРЫ СРАВНЕНИЯ
// ============================================

function stripEdges(value: any): any {
  if (!value || typeof value !== 'object') return value;
  const { edges, edgesStats, __codec, legend, ...rest } = value;
  return rest;
}

function stripLegend(value: any): any {
  if (!value || typeof value !== 'object') return value;
  const { legend, __codec, ...rest } = value;
  return rest;
}

function sortKeysRecursive(v: any): any {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(sortKeysRecursive);
  if (typeof v === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(v).sort()) {
      const nv = sortKeysRecursive(v[key]);
      if (nv !== undefined) out[key] = nv;
    }
    return out;
  }
  return v;
}

function normalizeForCompare(value: any): string {
  return JSON.stringify(sortKeysRecursive(value));
}

function collectDiffs(a: any, b: any, basePath: string = '$', limit: number = 100): any[] {
  const diffs: any[] = [];
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

function findFirstDiff(a: string, b: string): { pos: number; a: string; b: string } | null {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) {
      const ctx = 60;
      return {
        pos: i,
        a: a.substring(Math.max(0, i - ctx), i + ctx),
        b: b.substring(Math.max(0, i - ctx), i + ctx),
      };
    }
  }
  if (a.length !== b.length) {
    return {
      pos: minLen,
      a: a.substring(Math.max(0, minLen - 60)),
      b: b.substring(Math.max(0, minLen - 60)),
    };
  }
  return null;
}

interface LevelResult {
  ok: boolean;
  diffCount: number;
  diff: any[] | null;
  notes?: string;
}

function semanticCompare(a: any, b: any, limit: number): LevelResult {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na === nb) {
    return { ok: true, diffCount: 0, diff: null };
  }
  const diffs = collectDiffs(a, b, '$', limit);
  return { ok: false, diffCount: diffs.length, diff: diffs };
}

function byteExactCompare(a: any, b: any, limit: number): LevelResult {
  const sa = JSON.stringify(sortKeysRecursive(a));
  const sb = JSON.stringify(sortKeysRecursive(b));
  if (sa === sb) {
    return { ok: true, diffCount: 0, diff: null };
  }
  const diffs = collectDiffs(a, b, '$', limit);
  return { ok: false, diffCount: diffs.length, diff: diffs };
}

function printLevelResult(name: string, result: LevelResult, maxDiffs: number): void {
  if (result.ok) {
    ok(`${name} — PASS (diffCount=0)`);
  } else {
    fail(`${name} — FAIL (diffCount=${result.diffCount})`);
    if (result.notes) {
      log(`${C.gray}     ${result.notes}${C.reset}`);
    }
    if (result.diff && result.diff.length > 0) {
      log(`  ${C.gray}Первые ${Math.min(result.diff.length, maxDiffs)} расхождений:${C.reset}`);
      for (const d of result.diff.slice(0, maxDiffs)) {
        log(`    ${C.red}•${C.reset} ${d.path}`);
        log(`        a: ${JSON.stringify(d.a)}`);
        log(`        b: ${JSON.stringify(d.b)}`);
      }
      if (result.diff.length > maxDiffs) {
        log(`    ${C.gray}... и ещё ${result.diff.length - maxDiffs}${C.reset}`);
      }
    }
  }
}

// ============================================
// RLE HELPER (нужен для инвариантов P0/P1)
// ============================================

/**
 * Распаковка RLE: [[value, count], ...] → [value, value, ...]
 */
function unrle(rle: [number, number][]): number[] {
  const result: number[] = [];
  for (const [value, count] of rle) {
    for (let i = 0; i < count; i++) result.push(value);
  }
  return result;
}

// ============================================
// ✅ v15.0.2: ПОДСЧЁТ CONDITIONALS ЧЕРЕЗ templates[]
// ============================================

/**
 * Считает все conditionals внутри templates[].
 *
 * ⚠️ v15.0.2: conditionals больше НЕ существуют на верхнем уровне
 * FullJSON. Единственное место хранения — templates[].conditionals.
 */
function countConditionals(full: FullJSON): number {
  let count = 0;
  for (const t of full.templates ?? []) {
    count += (t.conditionals ?? []).length;
  }
  return count;
}

// ============================================
// ✅ v15.2.0 (P1): ПОДСЧЁТ LEXICAL LINKS
// ============================================

/**
 * Считает количество lexicalLinks в full.json.
 */
function countLexicalLinks(full: FullJSON): number {
  return (full.lexicalLinks ?? []).length;
}

// ============================================
// ✅ v15.6.0: ДИАГНОСТИКА РАССИНХРОНА values[]
// ============================================

/**
 * При расхождении в cn.nonEmptyV показывает, какие именно
 * значения «лишние» в encode(full) по сравнению с compact.
 *
 * @param compact — compact на диске
 * @param encoded — encode(full)
 * @param limit   — максимум примеров
 */
function diagnoseValuesDesync(
  compact: CompactJSON,
  encoded: CompactJSON,
  limit: number = 10
): void {
  const compactValues = compact.values || [];
  const encodedValues = encoded.values || [];

  if (compactValues.length === encodedValues.length) return;

  console.log('');
  console.log('  🔍 ДИАГНОСТИКА РАССИНХРОНА values[]:');
  console.log(`     compact.values.length = ${compactValues.length}`);
  console.log(`     encoded.values.length = ${encodedValues.length}`);

  // Ищем первое расхождение
  const minLen = Math.min(compactValues.length, encodedValues.length);
  let firstDiffIdx = -1;

  for (let i = 0; i < minLen; i++) {
    const a = JSON.stringify(compactValues[i]);
    const b = JSON.stringify(encodedValues[i]);
    if (a !== b) {
      firstDiffIdx = i;
      break;
    }
  }

  if (firstDiffIdx === -1) {
    firstDiffIdx = minLen;
  }

  console.log(`     Первое расхождение на индексе: ${firstDiffIdx}`);

  // Показываем контекст
  const start = Math.max(0, firstDiffIdx - 3);
  const end = Math.min(
    Math.max(compactValues.length, encodedValues.length),
    firstDiffIdx + limit
  );

  console.log('     Контекст:');
  for (let i = start; i < end; i++) {
    const cv = i < compactValues.length ? JSON.stringify(compactValues[i]) : '<missing>';
    const ev = i < encodedValues.length ? JSON.stringify(encodedValues[i]) : '<missing>';
    const mark = cv === ev ? '  ' : '❌';
    console.log(`       ${mark} [${i}] compact: ${cv}`);
    console.log(`       ${mark} [${i}] encoded: ${ev}`);
  }

  // Ищем «лишние» значения в encoded
  const compactValueStrs = new Set(compactValues.map(v => JSON.stringify(v)));
  const extraInEncoded = encodedValues.filter(v => !compactValueStrs.has(JSON.stringify(v)));

  if (extraInEncoded.length > 0) {
    console.log('');
    console.log(`     Лишние значения в encoded (${extraInEncoded.length}):`);
    for (const v of extraInEncoded.slice(0, limit)) {
      console.log(`       • ${JSON.stringify(v)}`);
    }
  }
}

// ============================================
// ПРОВЕРКА ЛЕГЕНДЫ (v15.6.0)
// ============================================

interface LegendCheck {
  name: string;
  ok: boolean;
  note?: string;
}

function checkLegendStructure(compact: CompactJSON): LegendCheck[] {
  const legend = (compact as any).legend;
  const checks: LegendCheck[] = [];

  // codes
  const requiredCodes = [
    'export',
    'import',
    'call',
    'reExport',
    'lifecycle',
    'effect',
    'injection',
    'reactivity',
    'conditional',
    'typeKind',
    'typeUsage',
  ];

  for (const codeName of requiredCodes) {
    const dict = legend?.codes?.[codeName];
    const size = dict ? Object.keys(dict).length : 0;
    checks.push({
      name: `legend.codes.${codeName}`,
      ok: size > 0,
      note: dict ? `${size} кодов` : 'отсутствует',
    });
  }

  // ✅ v15.2.0 (P1): lexicalRelation
  {
    const dict = legend?.codes?.lexicalRelation;
    const size = dict ? Object.keys(dict).length : 0;
    checks.push({
      name: 'legend.codes.lexicalRelation',
      ok: size === 8,
      note: dict ? `${size} кодов` : 'отсутствует',
    });
  }

  // ✅ v15.3.0 (P2): callKind
  {
    const dict = legend?.codes?.callKind;
    const size = dict ? Object.keys(dict).length : 0;
    checks.push({
      name: 'legend.codes.callKind',
      ok: size === 8,
      note: dict ? `${size} кодов` : 'отсутствует',
    });
  }

  // flags.bits
  const bitsCount = legend?.flags?.bits ? Object.keys(legend.flags.bits).length : 0;
  checks.push({
    name: 'legend.flags.bits (18 битов)',
    ok: bitsCount === 18,
    note: legend?.flags?.bits ? `${bitsCount} битов` : 'отсутствует',
  });

  // schemas
  const schemaChecks: Array<{ key: string; expectedLength: number }> = [
    { key: 'mi', expectedLength: 2 },
    { key: 'fl', expectedLength: 2 },
    // ✅ v15.1.0 (P0): +1 поле 'parent'
    { key: 'fns', expectedLength: 8 },
    { key: 'cls', expectedLength: 6 },
    { key: 'cn', expectedLength: 6 },
    { key: 'gr.e', expectedLength: 9 },
    { key: 'gr.i', expectedLength: 7 },
    // ✅ v15.3.0 (P2): +4 поля col/ck/cn/ai
    { key: 'gr.c', expectedLength: 8 },
    { key: 'gr.re', expectedLength: 6 },
    { key: 'vt.eventHandlers', expectedLength: 6 },
    { key: 'vt.dynamicComponents', expectedLength: 3 },
    { key: 'vt.templateRefs', expectedLength: 4 },
    { key: 'vt.cssVariables', expectedLength: 4 },
    { key: 'vt.deepSelectors', expectedLength: 2 },
    { key: 'lc', expectedLength: 5 },
    { key: 'ef', expectedLength: 5 },
    { key: 'inj', expectedLength: 5 },
    { key: 'rx', expectedLength: 6 },
    { key: 'cd', expectedLength: 6 },
    { key: 'ty', expectedLength: 7 },
    { key: 'tr', expectedLength: 5 },
    // ✅ v15.2.0 (P1)
    { key: 'lx', expectedLength: 6 },
  ];

  for (const { key, expectedLength } of schemaChecks) {
    const schema = legend?.schemas?.[key];
    const actualLength = Array.isArray(schema) ? schema.length : 0;
    checks.push({
      name: `legend.schemas.${key} (${expectedLength} полей)`,
      ok: actualLength === expectedLength,
      note: Array.isArray(schema) ? `${actualLength} полей` : 'отсутствует',
    });
  }

  return checks;
}

// ============================================
// ✅ v15.6.0: ИНВАРИАНТ I15
// ============================================

/**
 * I15: compact.values[] содержит только JSON-safe значения.
 *
 * Если в values[] попадает Set, Map, RegExp, Date или
 * class instance, при записи на диск JSON.stringify
 * превратит их в '{}', и round-trip потеряет данные.
 *
 * ════════════════════════════════════════════════════════════
 * СИМПТОМ В verify-roundtrip.ts (без этого инварианта)
 * ════════════════════════════════════════════════════════════
 *
 *   $.values.length          a: 703  b: 553
 *   $.cn.nonEmptyV[8][1]     a: 1    b: 5
 *   L0/L1/L2/L3/RE — FAIL
 *
 * ════════════════════════════════════════════════════════════
 * ФИКС
 * ════════════════════════════════════════════════════════════
 *
 *   • `isValueKept` возвращает false для не-JSON-объектов
 *     (см. values-filter.ts v1.2.0).
 *   • `sanitizeForJson` превращает их в безопасные
 *     представления перед записью (см. stable-stringify.ts v1.0.2).
 *   • `jsonSafeStringify` используется в saveJsonFile.
 */
function invariantI15(compact: CompactJSON, limit: number): LevelResult {
  const violations: string[] = [];
  const values = compact.values || [];

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === undefined || v === null) continue;

    if (!isJsonSafe(v)) {
      const ctorName =
        typeof v === 'object' && v !== null
          ? (v as any).constructor?.name ?? 'Object'
          : typeof v;
      violations.push(
        `values[${i}]: ${ctorName} (не JSON-safe) — при записи на диск превратится в '{}'`
      );
      if (violations.length >= limit) break;
    }
  }

  return {
    ok: violations.length === 0,
    diffCount: violations.length,
    diff: violations.map(v => ({ path: '$.values[]', a: v, b: 'JSON-safe expected' })),
  };
}

// ============================================
// ✅ v15.6.0: ИНВАРИАНТ I16
// ============================================

/**
 * I16: full.constants[].value содержит только JSON-safe значения.
 *
 * Аналогично I15, но для full.constants[].
 */
function invariantI16(full: FullJSON, limit: number): LevelResult {
  const violations: string[] = [];

  for (let i = 0; i < (full.constants || []).length; i++) {
    const cn = full.constants[i];
    if (!cn || cn.value === undefined) continue;

    if (!isJsonSafe(cn.value)) {
      const ctorName =
        typeof cn.value === 'object' && cn.value !== null
          ? (cn.value as any).constructor?.name ?? 'Object'
          : typeof cn.value;
      violations.push(`constants[${i}] (${cn.name}): ${ctorName} (не JSON-safe)`);
      if (violations.length >= limit) break;
    }
  }

  return {
    ok: violations.length === 0,
    diffCount: violations.length,
    diff: violations.map(v => ({
      path: '$.constants[].value',
      a: v,
      b: 'JSON-safe expected',
    })),
  };
}

// ============================================
// ✅ v15.6.0: ПРОВЕРКА JSON-SAFE "НА ДИСКЕ"
// ============================================

/**
 * Проверяет, что JSON-сериализация compact не теряет данные.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Берёт `compact.values` (в памяти).
 *   2. Прогоняет `JSON.stringify` → `JSON.parse`.
 *   3. Сравнивает `values[]` до и после.
 *   4. Если различаются — значит, есть не-JSON-объекты.
 *
 * Это ловит случай, когда `compact` в памяти содержит Set,
 * а на диск записывается '{}'.
 */
function checkJsonSafetyInFile(compact: CompactJSON, limit: number): LevelResult {
  const violations: string[] = [];
  const values = compact.values || [];

  // Сериализация через JSON (как при сохранении на диск)
  const beforeJson = JSON.stringify(values);
  const afterParse = JSON.parse(beforeJson) as unknown[];

  // Сравниваем поэлементно
  for (let i = 0; i < Math.min(values.length, afterParse.length); i++) {
    const before = values[i];
    const after = afterParse[i];

    const beforeStr = JSON.stringify(before);
    const afterStr = JSON.stringify(after);

    if (beforeStr !== afterStr) {
      violations.push(`values[${i}]: до JSON "${beforeStr}", после JSON "${afterStr}"`);
      if (violations.length >= limit) break;
    }
  }

  return {
    ok: violations.length === 0,
    diffCount: violations.length,
    diff: violations.map(v => ({
      path: '$.values[]',
      a: v,
      b: 'JSON round-trip expected',
    })),
  };
}

// ============================================
// ОСНОВНАЯ ЛОГИКА
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: ScriptOptions = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--compact' && args[i + 1]) {
      options.compactPath = args[++i]!;
    } else if (arg === '--full' && args[i + 1]) {
      options.fullPath = args[++i]!;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--max-diffs' && args[i + 1]) {
      options.maxDiffs = parseInt(args[++i]!, 10);
    } else if (arg === '--json-report' && args[i + 1]) {
      options.jsonReportPath = args[++i]!;
    } else if (arg === '--golden' && args[i + 1]) {
      options.goldenDir = args[++i]!;
    } else if (arg === '--no-golden') {
      options.goldenDir = null;
    } else if (arg === '--no-check-legend') {
      options.checkLegend = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  section('🔬 ROUND-TRIP ВЕРИФИКАЦИЯ CODEC (v15.6.0)');
  info(`Compact: ${path.resolve(options.compactPath)}`);
  info(`Full:    ${path.resolve(options.fullPath)}`);
  info(`Verbose: ${options.verbose}`);
  info(`MaxDiffs: ${options.maxDiffs}`);
  info(`Golden:  ${options.goldenDir ? path.resolve(options.goldenDir) : 'disabled'}`);
  info(`CheckLegend: ${options.checkLegend}`);
  if (options.jsonReportPath) {
    info(`JSON report: ${path.resolve(options.jsonReportPath)}`);
  }

  // ============================================
  // 1. ЗАГРУЗКА ФАЙЛОВ
  // ============================================

  section('📂 ЗАГРУЗКА ФАЙЛОВ');

  const compact = readJson<CompactJSON>(options.compactPath);
  const full = readJson<FullJSON>(options.fullPath);

  const compactSize = fs.statSync(path.resolve(options.compactPath)).size;
  const fullSize = fs.statSync(path.resolve(options.fullPath)).size;

  info(`Compact size: ${formatSize(compactSize)}`);
  info(`Full size:    ${formatSize(fullSize)}`);
  info(`Compression:  ${((compactSize / fullSize) * 100).toFixed(2)}%`);

  // ============================================
  // 2. БАЗОВАЯ СТРУКТУРА
  // ============================================

  section('🧱 БАЗОВАЯ СТРУКТУРА');

  // ✅ v15.0.2: conditionals через templates[]
  const conditionalsCount = countConditionals(full);

  // ✅ v15.2.0 (P1): lexicalLinks
  const lexicalLinksCount = countLexicalLinks(full);

  const sections: Record<string, number> = {
    modules: full.modules?.length ?? 0,
    files: full.files?.length ?? 0,
    functions: full.functions?.length ?? 0,
    classes: full.classes?.length ?? 0,
    constants: full.constants?.length ?? 0,
    exports: full.exports?.length ?? 0,
    imports: full.imports?.length ?? 0,
    calls: full.calls?.length ?? 0,
    reExports: full.reExports?.length ?? 0,
    templates: full.templates?.length ?? 0,
    lifecycle: full.lifecycle?.length ?? 0,
    effects: full.effects?.length ?? 0,
    injections: full.injections?.length ?? 0,
    reactivity: full.reactivity?.length ?? 0,
    // ✅ v15.0.2: через countConditionals(full)
    conditionals: conditionalsCount,
    types: full.types?.length ?? 0,
    typeRefs: full.typeRefs?.length ?? 0,
    // ✅ v15.2.0 (P1)
    lexicalLinks: lexicalLinksCount,
  };

  log('  FullJSON секции:');
  for (const [key, value] of Object.entries(sections)) {
    log(`    ${key.padEnd(14)} ${value}`);
  }

  // ============================================
  // 2.5. ПРОВЕРКА СТРУКТУРЫ ЛЕГЕНДЫ
  // ============================================

  let legendChecks: LegendCheck[] = [];
  let legendPassed = 0;
  let legendFailed = 0;

  if (options.checkLegend) {
    section('📖 СТРУКТУРА ЛЕГЕНДЫ (v15.6.0)');

    legendChecks = checkLegendStructure(compact);

    for (const check of legendChecks) {
      if (check.ok) {
        ok(`${check.name}${check.note ? ` — ${check.note}` : ''}`);
        legendPassed++;
      } else {
        fail(`${check.name}${check.note ? ` — ${check.note}` : ''}`);
        legendFailed++;
      }
    }

    log('');
    if (legendFailed === 0) {
      log(
        `  ${C.green}Легенда: ${legendPassed}/${legendChecks.length} проверок пройдено${C.reset}`
      );
    } else {
      log(
        `  ${C.red}Легенда: ${legendPassed}/${legendChecks.length} проверок пройдено, ${legendFailed} провалено${C.reset}`
      );
    }
  }

  // ============================================
  // 3. ROUND-TRIP УРОВНИ
  // ============================================

  section('🔁 ВСЕ УРОВНИ ROUND-TRIP');

  const baseReport = verifyRoundTripBoth(full, compact);

  const encoded = Codec.encode(full);
  const decoded = Codec.decode(compact);

  subsection('L0: encode(full) === compact (семантически)');
  const l0 = semanticCompare(encoded, compact, options.maxDiffs);
  printLevelResult('L0', l0, options.maxDiffs);

  // ✅ v15.6.0: если L0 упал — диагностируем values[] рассинхрон
  if (!l0.ok) {
    diagnoseValuesDesync(compact, encoded, options.maxDiffs);
  }

  subsection('L1: decode(compact) === full (семантически)');
  const l1 = semanticCompare(decoded, full, options.maxDiffs);
  printLevelResult('L1', l1, options.maxDiffs);

  subsection('L2: decode(compact) === full (побайтово, порядко-независимо)');
  const l2 = byteExactCompare(decoded, full, options.maxDiffs);
  printLevelResult('L2', l2, options.maxDiffs);

  subsection('L3: compact (на диске) === encode(full) (побайтово, буквально)');
  const compactRaw = JSON.stringify(compact);
  const encodedRaw = JSON.stringify(encoded);
  let l3: LevelResult;
  if (compactRaw === encodedRaw) {
    l3 = { ok: true, diffCount: 0, diff: null };
    ok('L3 — PASS (diffCount=0)');
  } else {
    const diffs = collectDiffs(compact, encoded, '$', options.maxDiffs);
    const firstDiff = findFirstDiff(compactRaw, encodedRaw);
    l3 = {
      ok: false,
      diffCount: diffs.length,
      diff: diffs,
      notes: firstDiff ? `первое расхождение на позиции ${firstDiff.pos}` : undefined,
    };
    fail(`L3 — FAIL (diffCount=${diffs.length})`);
    if (firstDiff) {
      log(`  Первое расхождение на позиции ${firstDiff.pos}:`);
      log(`    compact: ...${firstDiff.a}...`);
      log(`    encoded: ...${firstDiff.b}...`);
    }
    if (options.verbose && diffs.length > 0) {
      log(`  ${C.gray}Первые ${Math.min(diffs.length, options.maxDiffs)} расхождений:${C.reset}`);
      for (const d of diffs.slice(0, options.maxDiffs)) {
        log(`    ${C.red}•${C.reset} ${d.path}`);
        log(`        a: ${JSON.stringify(d.a)}`);
        log(`        b: ${JSON.stringify(d.b)}`);
      }
      if (diffs.length > options.maxDiffs) {
        log(`    ${C.gray}... и ещё ${diffs.length - options.maxDiffs}${C.reset}`);
      }
    }

    // ✅ v15.6.0: диагностика рассинхрона values[]
    diagnoseValuesDesync(compact, encoded, options.maxDiffs);
  }

  subsection('L4: encode(decode(encode(full))) === encode(full) (побайтово)');

  const enc1 = Codec.encode(full);
  const dec1 = Codec.decode(enc1);
  const enc2 = Codec.encode(dec1);

  const enc1Raw = JSON.stringify(enc1);
  const enc2Raw = JSON.stringify(enc2);

  let l4: LevelResult;
  if (enc1Raw === enc2Raw) {
    l4 = { ok: true, diffCount: 0, diff: null };
    ok('L4 — PASS (байтовое равенство)');
  } else {
    const diffs = collectDiffs(enc1, enc2, '$', options.maxDiffs);
    const firstDiff = findFirstDiff(enc1Raw, enc2Raw);
    l4 = {
      ok: false,
      diffCount: diffs.length,
      diff: diffs,
      notes: firstDiff ? `первое расхождение на позиции ${firstDiff.pos}` : undefined,
    };
    fail(`L4 — FAIL (diffCount=${diffs.length})`);
    if (firstDiff) {
      log(`  Первое расхождение на позиции ${firstDiff.pos}:`);
      log(`    enc1: ...${firstDiff.a}...`);
      log(`    enc2: ...${firstDiff.b}...`);
    }
    if (options.verbose && diffs.length > 0) {
      log(`  ${C.gray}Первые ${Math.min(diffs.length, options.maxDiffs)} расхождений:${C.reset}`);
      for (const d of diffs.slice(0, options.maxDiffs)) {
        log(`    ${C.red}•${C.reset} ${d.path}`);
        log(`        a: ${JSON.stringify(d.a)}`);
        log(`        b: ${JSON.stringify(d.b)}`);
      }
      if (diffs.length > options.maxDiffs) {
        log(`    ${C.gray}... и ещё ${diffs.length - options.maxDiffs}${C.reset}`);
      }
    }
  }

  subsection('RE: encode(decode(compact)) === compact (семантически)');
  const reEncoded = Codec.encode(decoded);
  const re = semanticCompare(reEncoded, compact, options.maxDiffs);
  printLevelResult('RE', re, options.maxDiffs);

  // ✅ v15.6.0: если RE упал — диагностируем values[]
  if (!re.ok) {
    diagnoseValuesDesync(compact, reEncoded, options.maxDiffs);
  }

  subsection('DL: decode(encode(full)) === full (семантически)');
  const dlDecoded = Codec.decode(encoded);
  const dl = semanticCompare(dlDecoded, full, options.maxDiffs);
  printLevelResult('DL', dl, options.maxDiffs);

  subsection('ENC: encode(full) === encode(decode(encode(full)))');
  const encRound = Codec.encode(Codec.decode(encoded));
  const enc = semanticCompare(encoded, encRound, options.maxDiffs);
  printLevelResult('ENC', enc, options.maxDiffs);

  subsection('DEC: decode(compact) === decode(encode(decode(compact)))');
  const decRound = Codec.decode(Codec.encode(decoded));
  const dec = semanticCompare(decoded, decRound, options.maxDiffs);
  printLevelResult('DEC', dec, options.maxDiffs);

  subsection('Независимость');
  if (baseReport.full_self_contained) {
    ok('full_self_contained — encode(full) не читает compact');
  } else {
    fail('full_self_contained — encode(full) зависит от compact');
  }
  if (baseReport.compact_self_contained) {
    ok('compact_self_contained — decode(compact) не читает full');
  } else {
    fail('compact_self_contained — decode(compact) зависит от full');
  }

  // ============================================
  // 3.5. ПРОВЕРКА СЕКЦИЙ vt/lc/ef/inj/rx/ty/tr
  // ============================================

  section('🎨 ПРОВЕРКА СЕКЦИЙ vt/lc/ef/inj/rx/ty/tr');

  const sectionNames = [
    'templates',
    'lifecycle',
    'effects',
    'injections',
    'reactivity',
    'types',
    'typeRefs',
    // ✅ v15.2.0 (P1)
    'lexicalLinks',
  ] as const;

  interface SectionResult {
    name: string;
    fullCount: number;
    decodedCount: number;
    ok: boolean;
    result?: LevelResult;
  }

  const sectionResults: SectionResult[] = [];

  for (const name of sectionNames) {
    const fullArr = (full as any)[name];
    const decodedArr = (decoded as any)[name];
    const fullCount = Array.isArray(fullArr) ? fullArr.length : 0;
    const decodedCount = Array.isArray(decodedArr) ? decodedArr.length : 0;

    const result = semanticCompare(fullArr ?? null, decodedArr ?? null, options.maxDiffs);

    sectionResults.push({
      name,
      fullCount,
      decodedCount,
      ok: result.ok,
      result,
    });

    if (result.ok) {
      ok(`${name} — PASS (${fullCount} элементов)`);
    } else {
      fail(
        `${name} — FAIL (full=${fullCount}, decoded=${decodedCount}, diffCount=${result.diffCount})`
      );
      if (options.verbose && result.diff) {
        for (const d of result.diff.slice(0, Math.min(options.maxDiffs, 5))) {
          log(`    ${C.red}•${C.reset} ${d.path}`);
          log(`        a: ${JSON.stringify(d.a)}`);
          log(`        b: ${JSON.stringify(d.b)}`);
        }
      }
    }
  }

  // ✅ v15.0.2: отдельная проверка conditionals через templates[]
  subsection('conditionals (через templates[])');
  const decodedConditionals = countConditionals(decoded);
  const fullConditionals = countConditionals(full);
  const conditionalsOk = decodedConditionals === fullConditionals;

  if (conditionalsOk) {
    ok(`conditionals — PASS (${fullConditionals} элементов в templates[])`);
  } else {
    fail(`conditionals — FAIL (full=${fullConditionals}, decoded=${decodedConditionals})`);
  }

  // ============================================
  // 4. ТОЧЕЧНЫЕ ПРОВЕРКИ
  // ============================================

  section('🎯 ТОЧЕЧНЫЕ ПРОВЕРКИ');

  const spotChecks: Array<{ name: string; result: LevelResult }> = [
    { name: 'calls[].type', result: baseReport.spotChecks.callsType },
    { name: 'imports[].toFileId', result: baseReport.spotChecks.importsToFileId },
    {
      name: 'imports[].isTypeOnly',
      result: spotCheckImportsIsTypeOnly(decoded, full, options.maxDiffs),
    },
    { name: 'exports[].isReExport', result: baseReport.spotChecks.exportsIsReExport },
    { name: 'functions[].*Flags', result: baseReport.spotChecks.functionsFlags },
    { name: 'external calls type', result: baseReport.spotChecks.externalCalls },
    { name: 'modules[].path', result: baseReport.spotChecks.modulesPath },
    // ✅ v15.1.0 (P0)
    {
      name: 'functions[].parentFunctionId',
      result: spotCheckParentFunctionId(decoded, full, options.maxDiffs),
    },
    // ✅ v15.2.0 (P1)
    {
      name: 'lexicalLinks',
      result: spotCheckLexicalLinks(decoded, full, options.maxDiffs),
    },
    // ✅ v15.3.0 (P2)
    {
      name: 'calls[].callKind',
      result: spotCheckCallKind(decoded, full, options.maxDiffs),
    },
    {
      name: 'calls[].calleeName',
      result: spotCheckCalleeName(decoded, full, options.maxDiffs),
    },
    {
      name: 'calls[].argumentIndex',
      result: spotCheckArgumentIndex(decoded, full, options.maxDiffs),
    },
  ];

  for (const spot of spotChecks) {
    if (spot.result.ok) {
      ok(`${spot.name} — PASS (diffCount=0)`);
    } else {
      fail(`${spot.name} — FAIL (diffCount=${spot.result.diffCount})`);
      if (options.verbose && spot.result.diff) {
        for (const d of spot.result.diff.slice(0, options.maxDiffs)) {
          log(`    ${C.red}•${C.reset} ${d.path}`);
          log(`        a: ${JSON.stringify(d.a)}`);
          log(`        b: ${JSON.stringify(d.b)}`);
        }
      }
    }
  }

  // ============================================
  // 4.5. СТРУКТУРНЫЕ ПРОВЕРКИ
  // ============================================

  section('🏗️  СТРУКТУРНЫЕ ПРОВЕРКИ');

  // ✅ v15.6.0: JSON-safe round-trip проверка
  const jsonSafeCheck = checkJsonSafetyInFile(compact, options.maxDiffs);

  const structChecks: Array<{ name: string; result: LevelResult }> = [
    { name: 'columnar structure', result: baseReport.structuralChecks.columnarStructure },
    { name: 'RLE structure', result: baseReport.structuralChecks.rleStructure },
    { name: 'tokenized strings', result: checkTokenizedStrings(compact) },
    // ✅ v15.6.0: JSON-safe round-trip
    { name: 'JSON-safe round-trip значений', result: jsonSafeCheck },
  ];

  for (const sc of structChecks) {
    if (sc.result.ok) {
      ok(`${sc.name} — PASS`);
    } else {
      fail(`${sc.name} — FAIL (diffCount=${sc.result.diffCount})`);
      const diffs = sc.result.diff;
      if (Array.isArray(diffs)) {
        for (const d of diffs.slice(0, options.maxDiffs)) {
          log(`    ${C.red}•${C.reset} ${d.path}`);
          log(`        a: ${JSON.stringify(d.a)}`);
          log(`        b: ${JSON.stringify(d.b)}`);
        }
      }
    }
  }

  // ============================================
  // 5. СЕМАНТИЧЕСКИЕ ИНВАРИАНТЫ
  // ============================================

  section('🧭 СЕМАНТИЧЕСКИЕ ИНВАРИАНТЫ');

  interface InvariantResult {
    name: string;
    ok: boolean;
    violations: string[];
  }

  const invariantResults: InvariantResult[] = [];

  // I1
  {
    const validTypes = new Set(['direct', 'async', 'method', 'callback']);
    const violations: string[] = [];
    for (const c of full.calls || []) {
      if (!validTypes.has(c.type)) {
        violations.push(`${c.id || '?'}: type="${c.type}"`);
      }
    }
    invariantResults.push({
      name: 'I1: calls[].type ∈ {direct, async, method, callback}',
      ok: violations.length === 0,
      violations,
    });
  }

  // I2
  {
    const validTypes = new Set(['named', 'default', 'namespace']);
    const violations: string[] = [];
    for (const i of full.imports || []) {
      if (!validTypes.has(i.type)) {
        violations.push(`${i.id || '?'}: type="${i.type}"`);
      }
    }
    invariantResults.push({
      name: 'I2: imports[].type ∈ {named, default, namespace}',
      ok: violations.length === 0,
      violations,
    });
  }

  // I3
  {
    const validTypes = new Set(['named', 'default', 'type']);
    const violations: string[] = [];
    for (const e of full.exports || []) {
      if (!validTypes.has(e.type)) {
        violations.push(`${e.id || '?'}: type="${e.type}"`);
      }
    }
    invariantResults.push({
      name: 'I3: exports[].type ∈ {named, default, type}',
      ok: violations.length === 0,
      violations,
    });
  }

  // I4
  {
    const violations: string[] = [];
    const compactCalls = compact.gr?.c || { t: [], ty: [] };
    const gcT = compactCalls.t || [];
    const gcTy = compactCalls.ty || [];

    for (let i = 0; i < gcT.length; i++) {
      const combinedTy = gcTy[i] ?? 0;
      const isExternal = (combinedTy & 4) !== 0;
      const fullCall = (full.calls || [])[i];
      if (fullCall && fullCall.toFunctionId?.startsWith('external:')) {
        if (!isExternal) {
          violations.push(`compact.gr.c[${i}]: isExternal=0, ожидалось 1`);
        }
      }
    }
    invariantResults.push({
      name: 'I4: external calls → isExternal = 1 в compact.gr.c.ty',
      ok: violations.length === 0,
      violations,
    });
  }

  // I5
  {
    const violations: string[] = [];
    const externalFull = (full.calls || []).filter(c => c.toFunctionId?.startsWith('external:'));
    const externalDecoded = (decoded.calls || []).filter(c =>
      c.toFunctionId?.startsWith('external:')
    );

    for (const fc of externalFull) {
      const dc = externalDecoded.find(
        c =>
          c.fromFunctionId === fc.fromFunctionId &&
          c.toFunctionId === fc.toFunctionId &&
          c.line === fc.line
      );
      if (!dc) {
        violations.push(`external call ${fc.toFunctionId} не найден в decoded`);
        continue;
      }
      if (dc.type !== fc.type) {
        violations.push(`external call ${fc.toFunctionId}: type "${fc.type}" → "${dc.type}"`);
      }
    }
    invariantResults.push({
      name: 'I5: external calls: сохранность типа',
      ok: violations.length === 0,
      violations,
    });
  }

  // I6
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
    const violations: string[] = [];
    for (const fn of full.functions || []) {
      for (const field of flagFields) {
        const v = (fn as any)[field];
        if (v !== undefined && v !== true && v !== false) {
          violations.push(`${fn.id}.${field} = ${JSON.stringify(v)}`);
        }
      }
    }
    invariantResults.push({
      name: 'I6: functions[].*Flags ∈ {true, false, undefined}',
      ok: violations.length === 0,
      violations,
    });
  }

  // I7 — columnar structure
  {
    const violations: string[] = [];

    if (!compact.fns || !Array.isArray(compact.fns.n)) {
      violations.push('fns.n не является массивом');
    }
    if (!compact.cls || !Array.isArray(compact.cls.n)) {
      violations.push('cls.n не является массивом');
    }
    if (!compact.cn || !Array.isArray(compact.cn.n)) {
      violations.push('cn.n не является массивом');
    }
    if (!compact.gr?.e || !Array.isArray(compact.gr.e.m)) {
      violations.push('gr.e.m не является массивом');
    }
    if (!compact.gr?.i || !Array.isArray(compact.gr.i.ff)) {
      violations.push('gr.i.ff не является массивом');
    }
    if (!compact.gr?.c || !Array.isArray(compact.gr.c.f)) {
      violations.push('gr.c.f не является массивом');
    }

    invariantResults.push({
      name: 'I7: columnar-структура fns/cls/cn/gr.*',
      ok: violations.length === 0,
      violations,
    });
  }

  // I8 — gr.i.tf ∈ [-1, fl.p.length)
  {
    const violations: string[] = [];
    const flPLength = compact.fl?.p?.length ?? 0;
    const tf = compact.gr?.i?.tf ?? [];

    for (let i = 0; i < tf.length; i++) {
      const tfVal = tf[i]!;

      if (tfVal !== -1 && (tfVal < 0 || tfVal >= flPLength)) {
        violations.push(`gr.i.tf[${i}] = ${tfVal} вне fl.p (length=${flPLength})`);
        if (violations.length >= 20) break;
      }
    }

    invariantResults.push({
      name: 'I8: gr.i.tf — индекс в fl.p (-1 для внешних)',
      ok: violations.length === 0,
      violations,
    });
  }

  // ✅ v15.1.0 (P0): I9 — fns.parent — валидный индекс или -1
  {
    const violations: string[] = [];
    const fnsLength = (full.functions || []).length;
    const parent = compact.fns?.parent;

    if (parent !== undefined) {
      const parentUnrle = unrle(parent as [number, number][]);
      for (let i = 0; i < parentUnrle.length; i++) {
        const p = parentUnrle[i]!;
        if (p !== -1 && (p < 0 || p >= fnsLength)) {
          violations.push(`fns.parent[${i}] = ${p} вне [0, ${fnsLength})`);
          if (violations.length >= 20) break;
        }
      }
    }

    invariantResults.push({
      name: 'I9: fns.parent — валидный индекс или -1',
      ok: violations.length === 0,
      violations,
    });
  }

  // ✅ v15.1.0 (P0): I10 — parentFunctionId целостность
  {
    const violations: string[] = [];
    const fnIds = new Set((full.functions || []).map(f => f.id));
    for (const fn of full.functions || []) {
      if (fn.parentFunctionId && !fnIds.has(fn.parentFunctionId)) {
        violations.push(`${fn.id} (${fn.name}): parent=${fn.parentFunctionId} не найден`);
        if (violations.length >= 20) break;
      }
    }
    invariantResults.push({
      name: 'I10: parentFunctionId ссылается на существующую функцию',
      ok: violations.length === 0,
      violations,
    });
  }

  // ✅ v15.2.0 (P1): I11 — lx.p/lx.c — валидные индексы
  {
    const violations: string[] = [];
    const fnsLength = (full.functions || []).length;
    const lx = compact.lx;

    if (lx) {
      const pUnrle = unrle(lx.p);
      const cUnrle = unrle(lx.c);

      for (let i = 0; i < lx.r.length; i++) {
        const p = pUnrle[i]!;
        const c = cUnrle[i]!;
        if (p !== -1 && (p < 0 || p >= fnsLength)) {
          violations.push(`lx.p[${i}] = ${p} вне [0, ${fnsLength})`);
        }
        if (c < 0 || c >= fnsLength) {
          violations.push(`lx.c[${i}] = ${c} вне [0, ${fnsLength})`);
        }
        if (violations.length >= 20) break;
      }
    }

    invariantResults.push({
      name: 'I11: lx.p/lx.c — валидные индексы',
      ok: violations.length === 0,
      violations,
    });
  }

  // ✅ v15.2.0 (P1): I12 — lexicalLinks целостность
  {
    const violations: string[] = [];
    const fnIds = new Set((full.functions || []).map(f => f.id));
    for (const l of full.lexicalLinks ?? []) {
      if (l.parentFunctionId && !fnIds.has(l.parentFunctionId)) {
        violations.push(`${l.id}: parent=${l.parentFunctionId} не найден`);
      }
      if (!fnIds.has(l.childFunctionId)) {
        violations.push(`${l.id}: child=${l.childFunctionId} не найден`);
      }
      if (violations.length >= 20) break;
    }
    invariantResults.push({
      name: 'I12: lexicalLinks — целостность',
      ok: violations.length === 0,
      violations,
    });
  }

  // ✅ v15.3.0 (P2): I13 — gr.c.col/ck/cn/ai — согласованность длин
  {
    const violations: string[] = [];
    const gc = compact.gr?.c;
    if (gc) {
      const len = gc.f?.length ?? 0;
      if (gc.col && gc.col.length !== len)
        violations.push(`gc.col.length=${gc.col.length}, f.length=${len}`);
      if (gc.ck && gc.ck.length !== len)
        violations.push(`gc.ck.length=${gc.ck.length}, f.length=${len}`);
      if (gc.cn && gc.cn.length !== len)
        violations.push(`gc.cn.length=${gc.cn.length}, f.length=${len}`);
      if (gc.ai && gc.ai.length !== len)
        violations.push(`gc.ai.length=${gc.ai.length}, f.length=${len}`);
    }
    invariantResults.push({
      name: 'I13: gr.c.col/ck/cn/ai — согласованность длин',
      ok: violations.length === 0,
      violations,
    });
  }

  // ✅ v15.6.0: I15 — compact.values[] — только JSON-safe значения
  {
    const i15 = invariantI15(compact, options.maxDiffs);
    invariantResults.push({
      name: 'I15: compact.values[] — только JSON-safe значения',
      ok: i15.ok,
      violations: (i15.diff || []).map((d: any) => d.a),
    });
  }

  // ✅ v15.6.0: I16 — full.constants[].value — только JSON-safe значения
  {
    const i16 = invariantI16(full, options.maxDiffs);
    invariantResults.push({
      name: 'I16: full.constants[].value — только JSON-safe значения',
      ok: i16.ok,
      violations: (i16.diff || []).map((d: any) => d.a),
    });
  }

  for (const inv of invariantResults) {
    if (inv.ok) {
      ok(`${inv.name} — PASS`);
    } else {
      fail(`${inv.name} — FAIL (${inv.violations.length})`);
      for (const v of inv.violations.slice(0, 5)) {
        log(`    ${C.red}•${C.reset} ${v}`);
      }
      if (inv.violations.length > 5) {
        log(`    ${C.gray}... и ещё ${inv.violations.length - 5}${C.reset}`);
      }
    }
  }

  // ============================================
  // 6. ЭТАЛОНЫ (GOLDEN)
  // ============================================

  interface GoldenResult {
    name: string;
    ok: boolean;
    skipped: boolean;
    reason?: string;
    result?: LevelResult;
  }

  const goldenResults: GoldenResult[] = [];

  if (options.goldenDir) {
    section('🏆 ЭТАЛОН (GOLDEN)');

    const goldenCompactPath = path.join(options.goldenDir, 'index.golden.json');
    const goldenFullPath = path.join(options.goldenDir, 'index.full.golden.json');

    // G1: full ≈ golden.full
    if (fileExists(goldenFullPath)) {
      const goldenFull = readJson<FullJSON>(goldenFullPath);
      const a = stripEdges(full);
      const b = stripEdges(goldenFull);
      const result = semanticCompare(a, b, options.maxDiffs);
      goldenResults.push({
        name: `G1: full ≈ ${path.relative(process.cwd(), goldenFullPath)}`,
        ok: result.ok,
        skipped: false,
        result,
      });
      printLevelResult(goldenResults[goldenResults.length - 1]!.name, result, options.maxDiffs);
    } else {
      goldenResults.push({
        name: `G1: full ≈ ${path.relative(process.cwd(), goldenFullPath)}`,
        ok: true,
        skipped: true,
        reason: 'Файл эталона не найден',
      });
      warn(`G1 — SKIP: ${path.relative(process.cwd(), goldenFullPath)} не найден`);
    }

    // G2: compact ≈ golden.compact
    if (fileExists(goldenCompactPath)) {
      const goldenCompact = readJson<CompactJSON>(goldenCompactPath);
      const a = stripLegend(compact);
      const b = stripLegend(goldenCompact);
      const result = semanticCompare(a, b, options.maxDiffs);
      goldenResults.push({
        name: `G2: compact ≈ ${path.relative(process.cwd(), goldenCompactPath)}`,
        ok: result.ok,
        skipped: false,
        result,
      });
      printLevelResult(goldenResults[goldenResults.length - 1]!.name, result, options.maxDiffs);
    } else {
      goldenResults.push({
        name: `G2: compact ≈ ${path.relative(process.cwd(), goldenCompactPath)}`,
        ok: true,
        skipped: true,
        reason: 'Файл эталона не найден',
      });
      warn(`G2 — SKIP: ${path.relative(process.cwd(), goldenCompactPath)} не найден`);
    }
  }

  // ============================================
  // 7. РАЗМЕРЫ
  // ============================================

  section('📊 РАЗМЕРЫ');

  const encodedSize = Buffer.byteLength(encodedRaw, 'utf-8');
  log(`  encode(full) size:    ${formatSize(encodedSize)}`);
  log(`  compact file size:    ${formatSize(compactSize)}`);
  log(`  full file size:       ${formatSize(fullSize)}`);
  log(`  compression ratio:    ${((compactSize / fullSize) * 100).toFixed(2)}%`);

  // ============================================
  // 8. ИТОГИ
  // ============================================

  section('📊 ИТОГИ');

  const levels: Array<{ name: string; ok: boolean }> = [
    { name: 'L0 (encode(full) === compact, семантически)', ok: l0.ok },
    { name: 'L1 (decode(compact) === full, семантически)', ok: l1.ok },
    { name: 'L2 (decode(compact) === full, побайтово, порядко-независимо)', ok: l2.ok },
    { name: 'L3 (compact на диске === encode(full), побайтово)', ok: l3.ok },
    { name: 'L4 (encode(decode(encode(full))) === encode(full), побайтово)', ok: l4.ok },
    { name: 'RE (encode(decode(compact)) === compact)', ok: re.ok },
    { name: 'DL (decode(encode(full)) === full)', ok: dl.ok },
    { name: 'ENC (encode идемпотентен)', ok: enc.ok },
    { name: 'DEC (decode идемпотентен)', ok: dec.ok },
    { name: 'full_self_contained', ok: baseReport.full_self_contained },
    { name: 'compact_self_contained', ok: baseReport.compact_self_contained },
    { name: 'spotCheck: calls[].type', ok: baseReport.spotChecks.callsType.ok },
    { name: 'spotCheck: imports[].toFileId', ok: baseReport.spotChecks.importsToFileId.ok },
    {
      name: 'spotCheck: imports[].isTypeOnly',
      ok: spotChecks.find(s => s.name === 'imports[].isTypeOnly')!.result.ok,
    },
    { name: 'spotCheck: exports[].isReExport', ok: baseReport.spotChecks.exportsIsReExport.ok },
    { name: 'spotCheck: functions[].*Flags', ok: baseReport.spotChecks.functionsFlags.ok },
    { name: 'spotCheck: external calls', ok: baseReport.spotChecks.externalCalls.ok },
    { name: 'spotCheck: modules[].path', ok: baseReport.spotChecks.modulesPath.ok },
    // ✅ v15.1.0 (P0)
    {
      name: 'spotCheck: functions[].parentFunctionId',
      ok: spotChecks.find(s => s.name === 'functions[].parentFunctionId')!.result.ok,
    },
    // ✅ v15.2.0 (P1)
    {
      name: 'spotCheck: lexicalLinks',
      ok: spotChecks.find(s => s.name === 'lexicalLinks')!.result.ok,
    },
    // ✅ v15.3.0 (P2)
    {
      name: 'spotCheck: calls[].callKind',
      ok: spotChecks.find(s => s.name === 'calls[].callKind')!.result.ok,
    },
    {
      name: 'spotCheck: calls[].calleeName',
      ok: spotChecks.find(s => s.name === 'calls[].calleeName')!.result.ok,
    },
    {
      name: 'spotCheck: calls[].argumentIndex',
      ok: spotChecks.find(s => s.name === 'calls[].argumentIndex')!.result.ok,
    },
  ];

  // Секции
  for (const sr of sectionResults) {
    levels.push({ name: `section: ${sr.name}`, ok: sr.ok });
  }

  // ✅ v15.0.2: отдельная проверка conditionals через templates[]
  levels.push({ name: 'section: conditionals (via templates[])', ok: conditionalsOk });

  // Легенда
  for (const check of legendChecks) {
    levels.push({ name: `legend: ${check.name}`, ok: check.ok });
  }

  // Инварианты
  for (const inv of invariantResults) {
    levels.push({ name: `invariant: ${inv.name}`, ok: inv.ok });
  }

  // Структурные проверки
  for (const sc of structChecks) {
    levels.push({ name: `struct: ${sc.name}`, ok: sc.result.ok });
  }

  // Golden
  for (const g of goldenResults) {
    if (!g.skipped) {
      levels.push({ name: `golden: ${g.name}`, ok: g.ok });
    }
  }

  let passed = 0;
  let failed = 0;

  log('');
  for (const level of levels) {
    if (level.ok) {
      log(`  ${C.green}✅${C.reset} ${level.name}`);
      passed++;
    } else {
      log(`  ${C.red}❌${C.reset} ${level.name}`);
      failed++;
    }
  }

  const skippedGolden = goldenResults.filter(g => g.skipped);
  if (skippedGolden.length > 0) {
    log('');
    log(`  ${C.yellow}⏭️  Skipped golden checks:${C.reset}`);
    for (const g of skippedGolden) {
      log(`  ${C.yellow}⏭️${C.reset} ${g.name} — ${g.reason || 'skipped'}`);
    }
  }

  log('');
  log(`  Всего:  ${levels.length}`);
  log(`  ${C.green}Прошло: ${passed}${C.reset}`);
  log(`  ${C.red}Провалено: ${failed}${C.reset}`);

  const allOk = failed === 0;

  log('');
  if (allOk) {
    log(`${C.green}${C.bold}🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ — 100% ROUND-TRIP!${C.reset}`);
  } else {
    log(`${C.red}${C.bold}💥 ЕСТЬ РАСХОЖДЕНИЯ — ROUND-TRIP НЕ 100%${C.reset}`);
  }

  // ============================================
  // 9. JSON-ОТЧЁТ
  // ============================================

  const jsonReport = {
    timestamp: new Date().toISOString(),
    // ✅ v15.6.0
    codecVersion: '15.6.0',
    originalFormat: 'compact',
    bothFormats: false,

    L0_encodeFullVsCompact: l0,
    L1_semantic: l1,
    L2_decodeCompactVsFull: l2,
    L3_byteExact: l3,
    L4_byteExactIdempotent: l4,
    reverse: re,
    dl,
    enc_idempotent: enc,
    dec_idempotent: dec,

    spotChecks,
    invariants: invariantResults,
    structuralChecks: structChecks,
    sectionChecks: sectionResults.map(sr => ({
      name: sr.name,
      fullCount: sr.fullCount,
      decodedCount: sr.decodedCount,
      ok: sr.ok,
    })),
    conditionalsCheck: {
      fullCount: fullConditionals,
      decodedCount: decodedConditionals,
      ok: conditionalsOk,
    },

    legend: {
      enabled: options.checkLegend,
      checks: legendChecks,
      passed: legendPassed,
      failed: legendFailed,
    },

    golden: goldenResults,

    stats: {
      compactSize,
      fullSize,
      encodedSize,
      compressionRatio: compactSize / fullSize,
      sections,
    },
    summary: {
      total: levels.length,
      passed,
      failed,
      allOk,
    },
  };

  if (options.jsonReportPath) {
    const reportPath = path.resolve(options.jsonReportPath);
    fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
    ok(`JSON-отчёт сохранён: ${reportPath}`);
  }

  process.exit(allOk ? 0 : 1);
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ
// ============================================

/**
 * Явная проверка imports[].isTypeOnly.
 */
function spotCheckImportsIsTypeOnly(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.imports || []).map((i: any, idx: number) => ({
    idx,
    id: i.id,
    isTypeOnly: i.isTypeOnly,
    isNamespace: i.isNamespace,
    type: i.type,
  }));
  const b = (full.imports || []).map((i: any, idx: number) => ({
    idx,
    id: i.id,
    isTypeOnly: i.isTypeOnly,
    isNamespace: i.isNamespace,
    type: i.type,
  }));

  const diffs: any[] = [];
  const n = Math.min(a.length, b.length);

  if (a.length !== b.length) {
    diffs.push({ path: '$.imports.length', a: a.length, b: b.length });
  }

  for (let i = 0; i < n && diffs.length < limit; i++) {
    const ai = a[i];
    const bi = b[i];
    if (!ai || !bi) continue;
    if (ai.isTypeOnly !== bi.isTypeOnly) {
      diffs.push({
        path: `$.imports[${i}].isTypeOnly`,
        a: ai.isTypeOnly,
        b: bi.isTypeOnly,
      });
    }
    if (ai.isNamespace !== bi.isNamespace) {
      diffs.push({
        path: `$.imports[${i}].isNamespace`,
        a: ai.isNamespace,
        b: bi.isNamespace,
      });
    }
    if (ai.type !== bi.type) {
      diffs.push({
        path: `$.imports[${i}].type`,
        a: ai.type,
        b: bi.type,
      });
    }
  }

  return {
    ok: diffs.length === 0,
    diffCount: diffs.length,
    diff: diffs,
  };
}

/**
 * ✅ v15.1.0 (P0): проверка functions[].parentFunctionId.
 */
function spotCheckParentFunctionId(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.functions || []).map((f: any) => ({
    id: f.id,
    parentFunctionId: f.parentFunctionId ?? null,
  }));
  const b = (full.functions || []).map((f: any) => ({
    id: f.id,
    parentFunctionId: f.parentFunctionId ?? null,
  }));

  const diffs: any[] = [];
  const n = Math.min(a.length, b.length);

  if (a.length !== b.length) {
    diffs.push({ path: '$.functions.length', a: a.length, b: b.length });
  }

  for (let i = 0; i < n && diffs.length < limit; i++) {
    const ai = a[i];
    const bi = b[i];
    if (!ai || !bi) continue;
    if (ai.parentFunctionId !== bi.parentFunctionId) {
      diffs.push({
        path: `$.functions[${i}].parentFunctionId`,
        a: ai.parentFunctionId,
        b: bi.parentFunctionId,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

/**
 * ✅ v15.2.0 (P1): проверка lexicalLinks.
 */
function spotCheckLexicalLinks(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = decoded.lexicalLinks ?? [];
  const b = full.lexicalLinks ?? [];

  const diffs: any[] = [];

  if (a.length !== b.length) {
    diffs.push({ path: '$.lexicalLinks.length', a: a.length, b: b.length });
    return { ok: false, diffCount: diffs.length, diff: diffs };
  }

  for (let i = 0; i < a.length && diffs.length < limit; i++) {
    const ai = a[i];
    const bi = b[i];
    if (!ai || !bi) continue;
    if (ai.parentFunctionId !== bi.parentFunctionId) {
      diffs.push({
        path: `$.lexicalLinks[${i}].parentFunctionId`,
        a: ai.parentFunctionId,
        b: bi.parentFunctionId,
      });
    }
    if (ai.childFunctionId !== bi.childFunctionId) {
      diffs.push({
        path: `$.lexicalLinks[${i}].childFunctionId`,
        a: ai.childFunctionId,
        b: bi.childFunctionId,
      });
    }
    if (ai.relation !== bi.relation) {
      diffs.push({
        path: `$.lexicalLinks[${i}].relation`,
        a: ai.relation,
        b: bi.relation,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

/**
 * ✅ v15.3.0 (P2): проверка calls[].callKind.
 */
function spotCheckCallKind(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.calls || []).map((c: CallData) => ({
    id: c.id,
    callKind: c.callKind ?? null,
  }));
  const b = (full.calls || []).map((c: CallData) => ({
    id: c.id,
    callKind: c.callKind ?? null,
  }));

  const diffs: any[] = [];
  const n = Math.min(a.length, b.length);

  if (a.length !== b.length) {
    diffs.push({ path: '$.calls.length', a: a.length, b: b.length });
  }

  for (let i = 0; i < n && diffs.length < limit; i++) {
    const ai = a[i];
    const bi = b[i];
    if (!ai || !bi) continue;
    if (ai.callKind !== bi.callKind) {
      diffs.push({
        path: `$.calls[${i}].callKind`,
        a: ai.callKind,
        b: bi.callKind,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

/**
 * ✅ v15.3.0 (P2): проверка calls[].calleeName.
 */
function spotCheckCalleeName(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.calls || []).map((c: CallData) => ({
    id: c.id,
    calleeName: c.calleeName ?? null,
  }));
  const b = (full.calls || []).map((c: CallData) => ({
    id: c.id,
    calleeName: c.calleeName ?? null,
  }));

  const diffs: any[] = [];
  const n = Math.min(a.length, b.length);

  if (a.length !== b.length) {
    diffs.push({ path: '$.calls.length', a: a.length, b: b.length });
  }

  for (let i = 0; i < n && diffs.length < limit; i++) {
    const ai = a[i];
    const bi = b[i];
    if (!ai || !bi) continue;
    if (ai.calleeName !== bi.calleeName) {
      diffs.push({
        path: `$.calls[${i}].calleeName`,
        a: ai.calleeName,
        b: bi.calleeName,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

/**
 * ✅ v15.3.0 (P2): проверка calls[].argumentIndex.
 */
function spotCheckArgumentIndex(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.calls || []).map((c: CallData) => ({
    id: c.id,
    argumentIndex: c.argumentIndex ?? null,
  }));
  const b = (full.calls || []).map((c: CallData) => ({
    id: c.id,
    argumentIndex: c.argumentIndex ?? null,
  }));

  const diffs: any[] = [];
  const n = Math.min(a.length, b.length);

  if (a.length !== b.length) {
    diffs.push({ path: '$.calls.length', a: a.length, b: b.length });
  }

  for (let i = 0; i < n && diffs.length < limit; i++) {
    const ai = a[i];
    const bi = b[i];
    if (!ai || !bi) continue;
    if (ai.argumentIndex !== bi.argumentIndex) {
      diffs.push({
        path: `$.calls[${i}].argumentIndex`,
        a: ai.argumentIndex,
        b: bi.argumentIndex,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

/**
 * Проверка tokenized strings.
 */
function checkTokenizedStrings(compact: CompactJSON): LevelResult {
  const diffs: any[] = [];

  if (!Array.isArray(compact.tokens)) {
    diffs.push({ path: '$.tokens', a: 'missing', b: 'array expected' });
  }
  if (!Array.isArray(compact.strs)) {
    diffs.push({ path: '$.strs', a: 'missing', b: 'array expected' });
  }
  if (!Array.isArray(compact.params)) {
    diffs.push({ path: '$.params', a: 'missing', b: 'array expected' });
  }
  if (compact.methods !== undefined && !Array.isArray(compact.methods)) {
    diffs.push({ path: '$.methods', a: 'not array', b: 'array expected' });
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

// ============================================
// HELP
// ============================================

function printHelp(): void {
  log(
    `\n${C.bold}Использование:${C.reset}\n  npx tsx scripts/verify-roundtrip.ts [options]\n\n${C.bold}Опции:${C.reset}\n  --compact <path>       Путь к compact JSON (по умолчанию ./ast-graph-viewer/index.json)\n  --full <path>          Путь к full JSON (по умолчанию ./ast-graph-viewer/index.full.json)\n  -v, --verbose          Подробный вывод\n  --max-diffs <n>        Максимум расхождений для вывода (по умолчанию 10)\n  --json-report <path>   Сохранить отчёт в JSON-файл\n  --golden <dir>         Директория с эталонами (по умолчанию ./scripts/fixtures)\n  --no-golden            Отключить проверку эталонов\n  --no-check-legend      Отключить проверку структуры легенды\n  -h, --help             Показать эту справку\n\n${C.bold}Уровни round-trip:${C.reset}\n  L0  : encode(full) === compact (семантически)\n  L1  : decode(compact) === full (семантически)\n  L2  : decode(compact) === full (побайтово, порядко-независимо)\n  L3  : compact на диске === encode(full) (побайтово, буквально)\n  L4  : encode(decode(encode(full))) === encode(full) (побайтово)\n  RE  : encode(decode(compact)) === compact\n  DL  : decode(encode(full)) === full\n  ENC : encode(full) === encode(decode(encode(full)))\n  DEC : decode(compact) === decode(encode(decode(compact)))\n\n${C.bold}Семантические инварианты (v15.6.0):${C.reset}\n  I1  : calls[].type ∈ {direct, async, method, callback}\n  I2  : imports[].type ∈ {named, default, namespace}\n  I3  : exports[].type ∈ {named, default, type}\n  I4  : external calls → isExternal = 1 в compact.gr.c.ty\n  I5  : external calls: сохранность типа\n  I6  : functions[].*Flags ∈ {true, false, undefined}\n  I7  : fns/cls/cn — columnar-структура\n  I8  : gr.i.tf — индекс в fl.p (-1 для внешних)\n  I9  : fns.parent — валидный индекс или -1 (P0)\n  I10 : parentFunctionId — целостность (P0)\n  I11 : lx.p/lx.c — валидные индексы (P1)\n  I12 : lexicalLinks — целостность (P1)\n  I13 : gr.c.col/ck/cn/ai — согласованность длин (P2)\n  I15 : compact.values[] — только JSON-safe значения (v15.6.0)\n  I16 : full.constants[].value — только JSON-safe значения (v15.6.0)\n\n${C.bold}Проверки секций:${C.reset}\n  templates, lifecycle, effects, injections, reactivity,\n  types, typeRefs, lexicalLinks (P1)\n\n${C.bold}Структурные проверки:${C.reset}\n  columnar structure, RLE structure, tokenized strings,\n  JSON-safe round-trip значений (v15.6.0)\n\n${C.bold}Проверки легенды:${C.reset}\n  legend.codes.* (13 словарей, включая lexicalRelation и callKind)\n  legend.flags.bits (18 битов)\n  legend.schemas.* (22 схемы, включая lx и gr.c с 8 полями)\n\n${C.bold}Примеры:${C.reset}\n  npx tsx scripts/verify-roundtrip.ts\n  npx tsx scripts/verify-roundtrip.ts --json-report ./round-trip-report.json\n  npx tsx scripts/verify-roundtrip.ts -v --max-diffs 20\n  npx tsx scripts/verify-roundtrip.ts --no-golden\n  npx tsx scripts/verify-roundtrip.ts --golden ./my-fixtures\n`
  );
}

// ============================================
// ЗАПУСК
// ============================================

main().catch(err => {
  console.error(`${C.red}❌ Непредвиденная ошибка:${C.reset}`, err);
  process.exit(1);
});
