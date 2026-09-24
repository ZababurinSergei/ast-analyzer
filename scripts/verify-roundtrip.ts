#!/usr/bin/env node
// scripts/verify-roundtrip.ts
// ============================================
// Скрипт проверки Round-Trip для CODEC (v15.7.3)
// ============================================
// Версия: 15.7.3
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.7.3 (Vue-секция: нормализация id + семантика sfc.c):
//   - ✅ ДОБАВЛЕНО: функция `normalizeVueForCompare(full)` —
//     убирает `id` из vue.composables/macros/hooks/reactivity/icons
//     перед сравнением в L1/L2/DL. Это устраняет ложные
//     расхождения, потому что `id` генерируется при decode
//     (`cmp1`, `mac1`, ...), а в compact не хранится.
//   - ✅ ПРИМЕНЕНО: `normalizeVueForCompare` в `semanticCompare`
//     и `byteExactCompare`.
//   - ✅ ОБНОВЛЕНО: заголовок v15.7.2 → v15.7.3.
//   - ✅ ОБНОВЛЕНО: codecVersion в jsonReport = '15.7.3'.
//   - ✅ ОБНОВЛЕНО: комментарий к I17 — `sfc.c` содержит
//     индексы в strs (имена composables), а не в vue.composables.
//   - ✅ ОБНОВЛЕНО: legend.schemas.vue.sfc ожидает 8 полей
//     (было 7 в v15.5.0, стало 8 в v15.7.2).
//
// v15.7.2 (Vue-секция: slices + новая схема vue.sfc):
//   - ✅ ДОБАВЛЕНО: проверка `vue.sfc.cs` в I17 — slices
//     `[[offset, count], ...]`.
//   - ✅ ОБНОВЛЕНО: legend.schemas.vue.sfc — 8 полей
//     (добавлено `cs`).
//   - ✅ ОБНОВЛЕНО: заголовок v15.7.1 → v15.7.2.
//
// v15.7.1 (Vue-секция: ослабление проверки + moduleId):
//   - ✅ ИСПРАВЛЕНО: `checkVueSection` — нормализация перед
//     сравнением:
//       • sfc.composables/props/emits/exposed → сравнение длин
//       • composables/macros/hooks/reactivity/icons → исключение `id`
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION упоминается как '15.7.1'.
//
// v15.7.0 (Vue-сущности):
//   - ✅ ДОБАВЛЕНО: проверка секции `vue` в sectionNames.
//   - ✅ ДОБАВЛЕНО: spot-check `functions[].vueKind`.
//   - ✅ ДОБАВЛЕНО: инвариант I17 — согласованность vue.sfc.c
//     с decoded.vue.sfc[].composables.length.
//   - ✅ ДОБАВЛЕНО: 6 новых legend.codes:
//     vueKind, sfcBlock, hookName, reactivityKind, iconCategory,
//     composableKind.
//   - ✅ ДОБАВЛЕНО: 6 новых legend.schemas:
//     vue.sfc, vue.composables, vue.macros, vue.hooks,
//     vue.reactivity, vue.icons.
//   - ✅ ОБНОВЛЕНО: legend.schemas.fns — 8 → 9 полей (добавлен vk).
//   - ✅ ОБНОВЛЕНО: заголовок v15.6.0 → v15.7.0.
//
// v15.6.0 (JSON-safe проверки):
//   - ✅ ДОБАВЛЕНО: инвариант I15 — compact.values[] содержит
//     только JSON-safe значения.
//   - ✅ ДОБАВЛЕНО: инвариант I16 — full.constants[].value
//     содержит только JSON-safe значения.
//   - ✅ ДОБАВЛЕНО: структурная проверка checkJsonSafetyInFile.
//
// v15.4.0 (P3 — cross-file resolution):
//   - ✅ ОБНОВЛЕНО: codecVersion в jsonReport = '15.4.0'
//
// v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: инвариант I13 — gr.c.col/ck/cn/ai — согласованность длин
//
// v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: инварианты I11, I12
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
//   I17 : vue.sfc.c/cs — согласованность с decoded — v15.7.3
//
// Проверки легенды:
//   L1  : legend.codes.* присутствуют (19 словарей)
//   L2  : legend.flags.bits содержит 18 битов
//   L3  : legend.schemas.* корректной длины (28 схем)
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

// ============================================
// ✅ v15.7.3: НОРМАЛИЗАЦИЯ VUE-СЕКЦИИ
// ============================================

/**
 * ✅ v15.7.3: Нормализует Vue-секцию для сравнения в L1/L2/DL.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО НОРМАЛИЗУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   • vue.composables[].id — УДАЛЯЕМ.
 *   • vue.macros[].id — УДАЛЯЕМ.
 *   • vue.hooks[].id — УДАЛЯЕМ.
 *   • vue.reactivity[].id — УДАЛЯЕМ.
 *   • vue.icons[].id — УДАЛЯЕМ.
 *
 *   Поля `sfc[].composables/props/emits/exposed` НЕ трогаем —
 *   после v15.7.3 они совпадают точно.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ
 * ════════════════════════════════════════════════════════════
 *
 *   В compact `id` не хранится (по схеме). При decode `id`
 *   генерируется как `cmp1`, `mac1`, `hk1`, `rx1`, `ic1`.
 *   В full — реальные ID из IdManager (`f5_23`, `f19_59`).
 *
 *   Это by design: `id` не нужен для графа связей.
 *   Composable идентифицируется по `name + fileId`,
 *   macro — по `fileId + kind + line` и т.д.
 *
 *   Без нормализации L1/L2/DL всегда будут падать на `id`.
 */
function normalizeVueForCompare(full: any): any {
  if (!full || typeof full !== 'object') return full;

  const vue = full.vue;
  if (!vue) return full;

  const stripId = (arr: any[] | undefined): any[] | undefined => {
    if (!Array.isArray(arr)) return arr;
    return arr.map(item => {
      if (!item || typeof item !== 'object') return item;
      const { id, ...rest } = item;
      void id;
      return rest;
    });
  };

  return {
    ...full,
    vue: {
      sfc: vue.sfc, // ✅ sfc не имеет id
      composables: stripId(vue.composables),
      macros: stripId(vue.macros),
      hooks: stripId(vue.hooks),
      reactivity: stripId(vue.reactivity),
      icons: stripId(vue.icons),
    },
  };
}

// ============================================
// СБОР РАСХОЖДЕНИЙ
// ============================================

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
  // ✅ v15.7.3: нормализуем Vue-секцию (убираем id)
  const na = normalizeForCompare(normalizeVueForCompare(a));
  const nb = normalizeForCompare(normalizeVueForCompare(b));
  if (na === nb) {
    return { ok: true, diffCount: 0, diff: null };
  }
  const diffs = collectDiffs(normalizeVueForCompare(a), normalizeVueForCompare(b), '$', limit);
  return { ok: false, diffCount: diffs.length, diff: diffs };
}

function byteExactCompare(a: any, b: any, limit: number): LevelResult {
  // ✅ v15.7.3: нормализуем Vue-секцию (убираем id)
  const na = normalizeVueForCompare(a);
  const nb = normalizeVueForCompare(b);
  const sa = JSON.stringify(sortKeysRecursive(na));
  const sb = JSON.stringify(sortKeysRecursive(nb));
  if (sa === sb) {
    return { ok: true, diffCount: 0, diff: null };
  }
  const diffs = collectDiffs(na, nb, '$', limit);
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
// RLE HELPER (нужен для инвариантов P0/P1/P2)
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
// ✅ v15.7.0: ПОДСЧЁТ VUE-СУЩНОСТЕЙ
// ============================================

interface VueCounts {
  sfc: number;
  composables: number;
  macros: number;
  hooks: number;
  reactivity: number;
  icons: number;
}

/**
 * Считает количество Vue-сущностей в full.json.
 */
function countVueEntities(full: FullJSON): VueCounts {
  const v = (full as any).vue;
  return {
    sfc: v?.sfc?.length ?? 0,
    composables: v?.composables?.length ?? 0,
    macros: v?.macros?.length ?? 0,
    hooks: v?.hooks?.length ?? 0,
    reactivity: v?.reactivity?.length ?? 0,
    icons: v?.icons?.length ?? 0,
  };
}

// ============================================
// ✅ v15.6.0: ДИАГНОСТИКА РАССИНХРОНА values[]
// ============================================

/**
 * При расхождении в cn.nonEmptyV показывает, какие именно
 * значения «лишние» в encode(full) по сравнению с compact.
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
// ✅ v15.7.0: ПРОВЕРКА ЛЕГЕНДЫ
// ============================================

interface LegendCheck {
  name: string;
  ok: boolean;
  note?: string;
}

function checkLegendStructure(compact: CompactJSON): LegendCheck[] {
  const legend = (compact as any).legend;
  const checks: LegendCheck[] = [];

  // ✅ v15.7.0: расширенный список codes (19 словарей)
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
    // ✅ v15.2.0 (P1)
    'lexicalRelation',
    // ✅ v15.3.0 (P2)
    'callKind',
    // ✅ v15.7.0: Vue-сущности
    'vueKind',
    'sfcBlock',
    'hookName',
    'reactivityKind',
    'iconCategory',
    'composableKind',
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

  // flags.bits
  const bitsCount = legend?.flags?.bits ? Object.keys(legend.flags.bits).length : 0;
  checks.push({
    name: 'legend.flags.bits (18 битов)',
    ok: bitsCount === 18,
    note: legend?.flags?.bits ? `${bitsCount} битов` : 'отсутствует',
  });

  // ✅ v15.7.2: расширенный список schemas (28 схем)
  // ✅ v15.7.3: `vue.sfc` — 8 полей (f, n, b, c, cs, p, e, x)
  const schemaChecks: Array<{ key: string; expectedLength: number }> = [
    { key: 'mi', expectedLength: 2 },
    { key: 'fl', expectedLength: 2 },
    // ✅ v15.7.0: fns — 9 полей (добавлен vk)
    { key: 'fns', expectedLength: 9 },
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
    // ✅ v15.7.2: Vue-схемы
    // ✅ v15.7.3: `vue.sfc` — 8 полей (добавлено `cs`)
    { key: 'vue.sfc', expectedLength: 8 },
    { key: 'vue.composables', expectedLength: 5 },
    { key: 'vue.macros', expectedLength: 3 },
    { key: 'vue.hooks', expectedLength: 3 },
    { key: 'vue.reactivity', expectedLength: 4 },
    { key: 'vue.icons', expectedLength: 3 },
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
// ✅ v15.7.3: ИНВАРИАНТ I17 — vue.sfc.c/cs согласованность
// ============================================

/**
 * I17: `compact.vue.sfc.cs[i]` (slice для i-го SFC)
 * должен иметь длину, совпадающую с
 * `decoded.vue.sfc[i].composables.length`.
 *
 * Аналогично для p/e/x — props/emits/exposed (счётчики).
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v15.7.3
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ `sfc.c` содержит ИНДЕКСЫ В STRS (имена composables),
 *     а НЕ индексы в `vue.composables`.
 *   - ✅ Проверяем, что `cs[i] = [offset, count]` валиден:
 *     `offset + count <= sfc.c.length`.
 *   - ✅ Проверяем, что `decoded.vue.sfc[i].composables.length === count`.
 */
function invariantI17(compact: CompactJSON, decoded: FullJSON, limit: number): LevelResult {
  const violations: string[] = [];

  const compactVue = (compact as any).vue;
  const decodedVue = (decoded as any).vue;

  if (!compactVue || !decodedVue) {
    return { ok: true, diffCount: 0, diff: null };
  }

  const sfc = decodedVue.sfc ?? [];
  const sfcC = compactVue.sfc?.c ?? [];
  const sfcCS = compactVue.sfc?.cs ?? [];
  const sfcP = compactVue.sfc?.p ?? [];
  const sfcE = compactVue.sfc?.e ?? [];
  const sfcX = compactVue.sfc?.x ?? [];

  for (let i = 0; i < sfc.length; i++) {
    const item = sfc[i];
    if (!item) continue;

    // ✅ v15.7.3: cs[i] = [offset, count]
    const slice = sfcCS[i];
    let declaredC = 0;

    if (Array.isArray(slice) && slice.length === 2) {
      const [offset, count] = slice;
      declaredC = count;

      // Проверяем, что offset + count <= sfc.c.length
      if (offset + count > sfcC.length) {
        violations.push(
          `vue.sfc[${i}]: cs=[${offset}, ${count}], но sfc.c.length=${sfcC.length}`
        );
      }
    }

    const actualC = (item.composables ?? []).length;
    if (declaredC !== actualC) {
      violations.push(
        `vue.sfc[${i}] (${item.name ?? '?'}): cs.count=${declaredC}, decoded.composables.length=${actualC}`
      );
    }

    const declaredP = sfcP[i]?.[1] ?? 0;
    const actualP = (item.props ?? []).length;
    if (declaredP !== actualP) {
      violations.push(
        `vue.sfc[${i}] (${item.name ?? '?'}): compact.p=${declaredP}, decoded.props.length=${actualP}`
      );
    }

    const declaredE = sfcE[i]?.[1] ?? 0;
    const actualE = (item.emits ?? []).length;
    if (declaredE !== actualE) {
      violations.push(
        `vue.sfc[${i}] (${item.name ?? '?'}): compact.e=${declaredE}, decoded.emits.length=${actualE}`
      );
    }

    const declaredX = sfcX[i]?.[1] ?? 0;
    const actualX = (item.exposed ?? []).length;
    if (declaredX !== actualX) {
      violations.push(
        `vue.sfc[${i}] (${item.name ?? '?'}): compact.x=${declaredX}, decoded.exposed.length=${actualX}`
      );
    }

    if (violations.length >= limit) break;
  }

  return {
    ok: violations.length === 0,
    diffCount: violations.length,
    diff: violations.map(v => ({ path: '$.vue.sfc.c/cs', a: v, b: 'consistent expected' })),
  };
}

// ============================================
// ✅ v15.6.0: ПРОВЕРКА JSON-SAFE "НА ДИСКЕ"
// ============================================

/**
 * Проверяет, что JSON-сериализация compact не теряет данные.
 */
function checkJsonSafetyInFile(compact: CompactJSON, limit: number): LevelResult {
  const violations: string[] = [];
  const values = compact.values || [];

  const beforeJson = JSON.stringify(values);
  const afterParse = JSON.parse(beforeJson) as unknown[];

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

  section('🔬 ROUND-TRIP ВЕРИФИКАЦИЯ CODEC (v15.7.3)');
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

  const conditionalsCount = countConditionals(full);
  const lexicalLinksCount = countLexicalLinks(full);

  // ✅ v15.7.0: Vue-сущности
  const vueCounts = countVueEntities(full);

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
    conditionals: conditionalsCount,
    types: full.types?.length ?? 0,
    typeRefs: full.typeRefs?.length ?? 0,
    lexicalLinks: lexicalLinksCount,
    // ✅ v15.7.0: Vue-сущности
    'vue.sfc': vueCounts.sfc,
    'vue.composables': vueCounts.composables,
    'vue.macros': vueCounts.macros,
    'vue.hooks': vueCounts.hooks,
    'vue.reactivity': vueCounts.reactivity,
    'vue.icons': vueCounts.icons,
  };

  log('  FullJSON секции:');
  for (const [key, value] of Object.entries(sections)) {
    log(`    ${key.padEnd(18)} ${value}`);
  }

  // ============================================
  // 2.5. ПРОВЕРКА СТРУКТУРЫ ЛЕГЕНДЫ
  // ============================================

  let legendChecks: LegendCheck[] = [];
  let legendPassed = 0;
  let legendFailed = 0;

  if (options.checkLegend) {
    section('📖 СТРУКТУРА ЛЕГЕНДЫ (v15.7.3)');

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
  // 3.5. ПРОВЕРКА СЕКЦИЙ
  // ============================================

  section('🎨 ПРОВЕРКА СЕКЦИЙ (vt/lc/ef/inj/rx/ty/tr/lx/vue)');

  // ✅ v15.7.0: добавлена 'vue'
  const sectionNames = [
    'templates',
    'lifecycle',
    'effects',
    'injections',
    'reactivity',
    'types',
    'typeRefs',
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

  // ============================================
  // ✅ v15.7.3: VUE-СЕКЦИЯ (специальная проверка)
  // ============================================
  subsection('vue (специальная проверка с нормализацией)');

  const decodedVue = (decoded as any).vue;
  const fullVue = (full as any).vue;

  // I17: vue.sfc.c/cs/p/e/x ↔ decoded.vue.sfc[].*
  const i17Result = invariantI17(compact, decoded, options.maxDiffs);
  if (i17Result.ok) {
    ok(`I17: vue.sfc.c/cs/p/e/x ↔ decoded.vue.sfc[].* — PASS`);
  } else {
    fail(`I17: vue.sfc.c/cs/p/e/x ↔ decoded.vue.sfc[].* — FAIL (${i17Result.diffCount})`);
    if (i17Result.diff) {
      for (const d of i17Result.diff.slice(0, options.maxDiffs)) {
        log(`    ${C.red}•${C.reset} ${d.a}`);
      }
    }
  }

  // I18: fns.vk ↔ functions[].vueKind
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
          if (violations.length >= options.maxDiffs) break;
        }
      }
    }

    if (violations.length === 0) {
      ok(`I18: fns.vk ↔ functions[].vueKind — PASS`);
    } else {
      fail(`I18: fns.vk ↔ functions[].vueKind — FAIL (${violations.length})`);
      for (const v of violations) {
        log(`    ${C.red}•${C.reset} ${v}`);
      }
    }
  }

  // ============================================
  // ✅ v15.7.3: Сравнение vue-секций decoded ↔ full
  // с нормализацией
  // ============================================

  /**
   * ✅ v15.7.3: Нормализует SFC для сравнения.
   *
   * После v15.7.3 `composables` восстанавливаются точно,
   * поэтому сравниваем их ЗНАЧЕНИЯ.
   *
   * `props`/`emits`/`exposed` — по-прежнему сравниваем длины,
   * потому что имена не сохраняются в compact.
   */
  const normalizeSfc = (arr: any[]): any[] => {
    return arr.map(s => ({
      fileId: s.fileId,
      moduleId: s.moduleId,
      name: s.name,
      blocks: s.blocks,
      // ✅ v15.7.3: теперь можно сравнивать ЗНАЧЕНИЯ composables
      composables: s.composables,
      // props/emits/exposed — по-прежнему сравниваем длины
      propsCount: Array.isArray(s.props) ? s.props.length : 0,
      emitsCount: Array.isArray(s.emits) ? s.emits.length : 0,
      exposedCount: Array.isArray(s.exposed) ? s.exposed.length : 0,
    }));
  };

  const normalizeWithoutId = (arr: any[]): any[] => {
    return arr.map(item => {
      const { id, ...rest } = item;
      void id;
      return rest;
    });
  };

  const vueSubsections: Array<{
    name: string;
    normalize: (arr: any[]) => any[];
  }> = [
    { name: 'sfc', normalize: normalizeSfc },
    { name: 'composables', normalize: normalizeWithoutId },
    { name: 'macros', normalize: normalizeWithoutId },
    { name: 'hooks', normalize: normalizeWithoutId },
    { name: 'reactivity', normalize: normalizeWithoutId },
    { name: 'icons', normalize: normalizeWithoutId },
  ];

  for (const sub of vueSubsections) {
    const a = decodedVue?.[sub.name] ?? null;
    const b = fullVue?.[sub.name] ?? null;

    const aArr = Array.isArray(a) ? a : a === null ? [] : [a];
    const bArr = Array.isArray(b) ? b : b === null ? [] : [b];

    const normA = sub.normalize(aArr);
    const normB = sub.normalize(bArr);

    const result = semanticCompare(normA, normB, options.maxDiffs);

    if (result.ok) {
      ok(`vue.${sub.name} — PASS (${normA.length} элементов)`);
    } else {
      fail(
        `vue.${sub.name} — FAIL (decoded=${normA.length}, full=${normB.length}, diffCount=${result.diffCount})`
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

  // ============================================
  // ✅ v15.0.2: conditionals (через templates[])
  // ============================================
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
    // ✅ v15.7.0: vueKind
    {
      name: 'functions[].vueKind',
      result: spotCheckVueKind(decoded, full, options.maxDiffs),
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

  const jsonSafeCheck = checkJsonSafetyInFile(compact, options.maxDiffs);

  const structChecks: Array<{ name: string; result: LevelResult }> = [
    { name: 'columnar structure', result: baseReport.structuralChecks.columnarStructure },
    { name: 'RLE structure', result: baseReport.structuralChecks.rleStructure },
    { name: 'tokenized strings', result: checkTokenizedStrings(compact) },
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

  // I9 — fns.parent — валидный индекс или -1
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

  // I10 — parentFunctionId целостность
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

  // I11 — lx.p/lx.c — валидные индексы
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

  // I12 — lexicalLinks целостность
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

  // I13 — gr.c.col/ck/cn/ai — согласованность длин
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

  // I15 — compact.values[] — только JSON-safe значения
  {
    const i15 = invariantI15(compact, options.maxDiffs);
    invariantResults.push({
      name: 'I15: compact.values[] — только JSON-safe значения',
      ok: i15.ok,
      violations: (i15.diff || []).map((d: any) => d.a),
    });
  }

  // I16 — full.constants[].value — только JSON-safe значения
  {
    const i16 = invariantI16(full, options.maxDiffs);
    invariantResults.push({
      name: 'I16: full.constants[].value — только JSON-safe значения',
      ok: i16.ok,
      violations: (i16.diff || []).map((d: any) => d.a),
    });
  }

  // ✅ v15.7.3: I17 — vue.sfc.c/cs — согласованность с decoded
  {
    const i17 = invariantI17(compact, decoded, options.maxDiffs);
    invariantResults.push({
      name: 'I17: vue.sfc.c/cs/p/e/x ↔ decoded.vue.sfc[].*',
      ok: i17.ok,
      violations: (i17.diff || []).map((d: any) => d.a),
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
    // ✅ v15.7.0: vueKind
    {
      name: 'spotCheck: functions[].vueKind',
      ok: spotChecks.find(s => s.name === 'functions[].vueKind')!.result.ok,
    },
  ];

  // Секции
  for (const sr of sectionResults) {
    levels.push({ name: `section: ${sr.name}`, ok: sr.ok });
  }

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
    // ✅ v15.7.3
    codecVersion: '15.7.3',
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
    vueCheck: {
      counts: vueCounts,
      ok: sectionResults.find(s => s.name === 'vue')?.ok ?? true,
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
 * ✅ v15.7.0: проверка functions[].vueKind.
 */
function spotCheckVueKind(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.functions || []).map((f: any) => ({
    id: f.id,
    vueKind: f.vueKind ?? 'function',
  }));
  const b = (full.functions || []).map((f: any) => ({
    id: f.id,
    vueKind: f.vueKind ?? 'function',
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
    if (ai.vueKind !== bi.vueKind) {
      diffs.push({
        path: `$.functions[${i}].vueKind`,
        a: ai.vueKind,
        b: bi.vueKind,
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
  log(`
Использование:
  npx tsx scripts/verify-roundtrip.ts [options]

Опции:
  --compact <path>       Путь к compact JSON
  --full <path>          Путь к full JSON
  -v, --verbose          Подробный вывод
  --max-diffs <n>        Максимум расхождений для вывода
  --json-report <path>   Сохранить отчёт в JSON-файл
  --golden <dir>         Директория с эталонами
  --no-golden            Отключить проверку эталонов
  --no-check-legend      Отключить проверку структуры легенды
  -h, --help             Показать эту справку

Уровни round-trip:
  L0, L1, L2, L3, L4, RE, DL, ENC, DEC

Инварианты: I1–I17 (см. комментарии в коде)

Exit code: 0 — OK, 1 — есть расхождения.
  `);
}

// ============================================
// ЗАПУСК
// ============================================

main().catch(err => {
  console.error(`${C.red}❌ Непредвиденная ошибка:${C.reset}`, err);
  process.exit(1);
});
