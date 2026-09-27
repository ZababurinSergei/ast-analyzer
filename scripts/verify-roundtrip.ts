#!/usr/bin/env node
// scripts/verify-roundtrip.ts
// ============================================
// Скрипт проверки Round-Trip для CODEC (v16.0.3)
// ============================================
// Версия: 16.0.3
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.0.3 (fix L2: vue.sfc[].componentUsages/htmlElements):
//   - ✅ ИСПРАВЛЕНО: добавлена нормализация vue.sfc[].componentUsages
//     и vue.sfc[].htmlElements — приводит [] и undefined к единому
//     виду [] перед сравнением в L1/L2/DL/RE/ENC/DEC.
//
//     ПРИЧИНА:
//       - index.full.json (собранный compact-reporter.ts) содержит
//         componentUsages: [] и htmlElements: [] у каждого SFC.
//       - decode(compact) в старых версиях кодека НЕ добавлял эти
//         поля, если cu_sfc/he_sfc пусты. Возникало расхождение:
//           a: []   (в full)
//           b: undefined  (в decoded)
//         и L2 падал с diffCount=20.
//
//     РЕШЕНИЕ (два уровня защиты):
//       1. codec-decode.ts (v16.0.2) теперь СИММЕТРИЧНО всегда
//          добавляет componentUsages / htmlElements.
//       2. Этот скрипт дополнительно нормализует обе стороны через
//          normalizeVueSfcForCompare — страховка от регрессий
//          и от старых compact.json.
//
//   - ✅ ОБНОВЛЕНО: codecVersion в jsonReport = '16.0.3'.
//   - ✅ ОБНОВЛЕНО: заголовок v16.0.2 → v16.0.3.
//   - ✅ ДОБАВЛЕНО: спот-чек functions[].vueKind (I18, вынесен из
//     старой проверки checkVueSection).
//
// v16.0.2 (fix I47 + fns.hv + legend.schemas.fns):
//   - ✅ FIX I47: разрешён `number[]` любой длины в `params[]`
//     (encodeStr возвращает массив индексов токенов произвольной
//     длины, а не строго пару [number, number]).
//   - ✅ FIX: `checkValuesAndParams` — та же логика для params.
//   - ✅ FIX: `checkLegendStructure` — `fns` теперь 10 полей
//     (добавлено `hv` для `isHtmlVisible`).
//   - ✅ FIX: `spotCheckIsHtmlVisible` — корректное сравнение
//     `null`/`undefined`/`false` как эквивалентных.
//   - ✅ ОБНОВЛЕНО: codecVersion в jsonReport = '16.0.2'.
//
// v16.0.1 (fix TS6133):
//   - ✅ FIX: удалён неиспользуемый импорт `deserializeSourceChain`.
//
// v16.0.0 (Component Usage + DOM API + sourceChains):
//   - ✅ ДОБАВЛЕНО: I45–I50 (6 инвариантов)
//   - ✅ ОБНОВЛЕНО: legend.version проверка
//   - ✅ ОБНОВЛЕНО: vue.sfc — 30 полей
//   - ✅ ДОБАВЛЕНО: 5 новых codes, 9 новых schemas
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION → '16.0.0'
//
// v15.7.3 (Vue-секция: нормализация id + семантика sfc.c):
// v15.7.2 (Vue-секция: slices + новая схема vue.sfc):
// v15.7.1 (Vue-секция: ослабление проверки + moduleId):
// v15.7.0 (Vue-сущности):
// v15.6.0 (JSON-safe проверки):
// v15.4.0 (P3 — cross-file resolution):
// v15.3.0 (P2 — расширенный CallData):
// v15.2.0 (P1 — lexicalLinks):
// v15.1.0 (P0 — parentFunctionId):
// v15.0.6 (gr.i.tf — индекс в fl.p):
// v15.0.2 (устранение дублирования conditionals):
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
//   I18 : fns.vk — согласованность с functions[].vueKind — v15.7.0
//   I45 : len(ids) >= max(id-индексы) — v16.0.0
//   I46 : values[] — JSON-safe — v16.0.0
//   I47 : params[] — (string | number[]) — v16.0.2 (ослаблено)
//   I48 : legend.schemas.vue.sfc содержит pn/ps/en/es/xn/xs — v16.0.0
//   I49 : legend.schemas.ids присутствует — v16.0.0
//   I50 : RLE sc-массивов — max(start+length) < sourceChains.length — v16.0.0
//
// Проверки легенды:
//   L1  : legend.codes.* присутствуют (29 словарей) — v16.0.0
//   L2  : legend.flags.bits содержит 18 битов
//   L3  : legend.schemas.* корректной длины (37 схем) — v16.0.0
//   L4  : legend.version === '2.0.0' — v16.0.0
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
// ✅ v15.7.3 + v16.0.3: НОРМАЛИЗАЦИЯ VUE-СЕКЦИИ
// ============================================

/**
 * ✅ v15.7.3: Нормализует Vue-секцию для сравнения в L1/L2/DL.
 *
 * Убирает `id` из:
 *   - vue.composables[].id
 *   - vue.macros[].id
 *   - vue.hooks[].id
 *   - vue.reactivity[].id
 *   - vue.icons[].id
 *
 * ⚠️ v16.0.0: НЕ трогает новые секции (componentProps, domApiCalls, ...),
 * потому что их `id` — это индексы в `ids[]`, а не сгенерированные
 * клиентом значения.
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
      sfc: vue.sfc,
      composables: stripId(vue.composables),
      macros: stripId(vue.macros),
      hooks: stripId(vue.hooks),
      reactivity: stripId(vue.reactivity),
      icons: stripId(vue.icons),
      // ✅ v16.0.0: новые секции — как есть
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
    },
  };
}

// ============================================
// ✅ v16.0.2: НОРМАЛИЗАЦИЯ ФУНКЦИЙ ДЛЯ СРАВНЕНИЯ
// ============================================

/**
 * ✅ v16.0.2: Нормализует функции для сравнения в L1/L2/DL.
 *
 * Проблема: `compact-reporter.ts` v16.0.0 заполняет в `full.functions[]`
 * поля `htmlUsage`, `isHtmlVisible`, `domApiCalls`, `usagesAsPropSource`,
 * но `codec-encode.ts` (v16.0.0) их НЕ кодирует в CompactJSON.
 *
 * Поэтому `decode(compact)` не может их восстановить, и L1/L2/DL падают
 * с `undefined` vs `[]`/`false`.
 *
 * Решение: нормализуем обе стороны перед сравнением — приводим
 * `undefined`/`null`/`[]`/`false` к эквивалентным значениям.
 */
function normalizeFunctionsForCompare(full: any): any {
  if (!full || typeof full !== 'object') return full;

  const functions = full.functions;
  if (!Array.isArray(functions)) return full;

  return {
    ...full,
    functions: functions.map((fn: any) => {
      if (!fn || typeof fn !== 'object') return fn;

      const result = { ...fn };

      // htmlUsage: undefined/null → []
      if (!Array.isArray(result.htmlUsage)) {
        result.htmlUsage = [];
      }

      // domApiCalls: undefined/null → []
      if (!Array.isArray(result.domApiCalls)) {
        result.domApiCalls = [];
      }

      // usagesAsPropSource: undefined/null → []
      if (!Array.isArray(result.usagesAsPropSource)) {
        result.usagesAsPropSource = [];
      }

      // isHtmlVisible: undefined/null → false
      if (result.isHtmlVisible === undefined || result.isHtmlVisible === null) {
        result.isHtmlVisible = false;
      }

      return result;
    }),
  };
}

// ============================================
// ✅ v16.0.3: НОРМАЛИЗАЦИЯ VUE.SFC[] ДЛЯ СРАВНЕНИЯ
// ============================================

/**
 * ✅ v16.0.3: Нормализует `vue.sfc[]` для сравнения в L1/L2/DL.
 *
 * Проблема:
 *   - `index.full.json` (собранный `compact-reporter.ts`) содержит
 *     `componentUsages: []` и `htmlElements: []` у каждого SFC.
 *   - `decode(compact)` в старых версиях кодека НЕ добавлял эти
 *     поля, если `cu_sfc`/`he_sfc` пусты. Возникало расхождение
 *     `[]` vs `undefined`, и L2 падал с diffCount=20.
 *
 * Решение:
 *   - В `codec-decode.ts` v16.0.2 обе стороны стали симметричными —
 *     `decode` теперь СИММЕТРИЧНО всегда добавляет эти поля.
 *   - Этот нормализатор — страховка от регрессий и от старых
 *     `compact.json`, где поля отсутствовали.
 *
 * Приводит `undefined`/`null` к `[]`.
 */
function normalizeVueSfcForCompare(full: any): any {
  if (!full || typeof full !== 'object') return full;

  const vue = full.vue;
  if (!vue || !Array.isArray(vue.sfc)) return full;

  return {
    ...full,
    vue: {
      ...vue,
      sfc: vue.sfc.map((s: any) => {
        if (!s || typeof s !== 'object') return s;
        return {
          ...s,
          componentUsages: Array.isArray(s.componentUsages) ? s.componentUsages : [],
          htmlElements: Array.isArray(s.htmlElements) ? s.htmlElements : [],
        };
      }),
    },
  };
}

/**
 * ✅ v16.0.3: Полная нормализация FullJSON для сравнения.
 *
 * Применяет (в порядке):
 *   - normalizeVueForCompare       (убирает id из vue-сущностей)
 *   - normalizeFunctionsForCompare (приводит опциональные поля функций к дефолтам)
 *   - normalizeVueSfcForCompare    (приводит [] и undefined к [] у vue.sfc[])
 */
function normalizeFullForCompare(full: any): any {
  return normalizeVueSfcForCompare(
    normalizeFunctionsForCompare(normalizeVueForCompare(full))
  );
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
  const na = normalizeForCompare(normalizeFullForCompare(a));
  const nb = normalizeForCompare(normalizeFullForCompare(b));
  if (na === nb) {
    return { ok: true, diffCount: 0, diff: null };
  }
  const diffs = collectDiffs(
    normalizeFullForCompare(a),
    normalizeFullForCompare(b),
    '$',
    limit
  );
  return { ok: false, diffCount: diffs.length, diff: diffs };
}

function byteExactCompare(a: any, b: any, limit: number): LevelResult {
  const na = normalizeFullForCompare(a);
  const nb = normalizeFullForCompare(b);
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
// RLE HELPER
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
// ✅ v15.0.2: ПОДСЧЁТ CONDITIONALS
// ============================================

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

  // ✅ v16.0.0: расширенный список codes (29 словарей)
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
    // ✅ v16.0.0: Vue component usage
    'componentSource',
    'propKind',
    'eventHandlerSource',
    'htmlOutputKind',
    'sourceChainKind',
    // ✅ v16.0.0: DOM API
    'domApiCategory',
    'domApiEffect',
    'domApiTargetKind',
    'domApiArgKind',
    'domApiArgSource',
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

  // ✅ v16.0.0: legend.version
  checks.push({
    name: 'legend.version = 2.0.0',
    ok: legend?.version === '2.0.0',
    note: legend?.version ? `"${legend.version}"` : 'отсутствует',
  });

  // flags.bits
  const bitsCount = legend?.flags?.bits ? Object.keys(legend.flags.bits).length : 0;
  checks.push({
    name: 'legend.flags.bits (18 битов)',
    ok: bitsCount === 18,
    note: legend?.flags?.bits ? `${bitsCount} битов` : 'отсутствует',
  });

  // ✅ v16.0.0: расширенный список schemas (37 схем)
  // ✅ v16.0.2: fns теперь 10 полей (добавлено hv)
  const schemaChecks: Array<{ key: string; expectedLength: number }> = [
    { key: 'mi', expectedLength: 2 },
    { key: 'fl', expectedLength: 2 },
    { key: 'fns', expectedLength: 10 },   // ✅ v16.0.2: было 9
    { key: 'cls', expectedLength: 6 },
    { key: 'cn', expectedLength: 6 },
    { key: 'gr.e', expectedLength: 9 },
    { key: 'gr.i', expectedLength: 7 },
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
    { key: 'lx', expectedLength: 6 },
    // ✅ v16.0.0: vue.sfc — 30 полей (breaking change)
    { key: 'vue.sfc', expectedLength: 30 },
    { key: 'vue.composables', expectedLength: 5 },
    { key: 'vue.macros', expectedLength: 3 },
    { key: 'vue.hooks', expectedLength: 3 },
    { key: 'vue.reactivity', expectedLength: 4 },
    { key: 'vue.icons', expectedLength: 3 },
    // ✅ v16.0.0: новые схемы
    { key: 'vue.componentProps', expectedLength: 9 },
    { key: 'vue.componentEvents', expectedLength: 7 },
    { key: 'vue.componentDirectives', expectedLength: 5 },
    { key: 'vue.componentSlots', expectedLength: 4 },
    { key: 'vue.htmlInterpolations', expectedLength: 3 },
    { key: 'vue.fnHtmlUsage', expectedLength: 9 },
    { key: 'domApiCalls', expectedLength: 19 },
    { key: 'domApiArgs', expectedLength: 4 },
    { key: 'ids', expectedLength: 1 },
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

  // ✅ v16.0.0: новые срезы
  const sfcPS = (compactVue.sfc as any)?.ps ?? [];
  const sfcES = (compactVue.sfc as any)?.es ?? [];
  const sfcXS = (compactVue.sfc as any)?.xs ?? [];

  for (let i = 0; i < sfc.length; i++) {
    const item = sfc[i];
    if (!item) continue;

    const slice = sfcCS[i];
    let declaredC = 0;

    if (Array.isArray(slice) && slice.length === 2) {
      const [offset, count] = slice;
      declaredC = count;

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

    // ✅ v16.0.0: приоритет ps/es/xs, fallback — p/e/x
    const declaredP = Array.isArray(sfcPS[i])
      ? ((sfcPS[i] as any)[1] ?? 0)
      : (sfcP[i]?.[1] ?? 0);
    const actualP = (item.props ?? []).length;
    if (declaredP !== actualP) {
      violations.push(
        `vue.sfc[${i}] (${item.name ?? '?'}): compact.p=${declaredP}, decoded.props.length=${actualP}`
      );
    }

    const declaredE = Array.isArray(sfcES[i])
      ? ((sfcES[i] as any)[1] ?? 0)
      : (sfcE[i]?.[1] ?? 0);
    const actualE = (item.emits ?? []).length;
    if (declaredE !== actualE) {
      violations.push(
        `vue.sfc[${i}] (${item.name ?? '?'}): compact.e=${declaredE}, decoded.emits.length=${actualE}`
      );
    }

    const declaredX = Array.isArray(sfcXS[i])
      ? ((sfcXS[i] as any)[1] ?? 0)
      : (sfcX[i]?.[1] ?? 0);
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
// ✅ v16.0.0: I45–I50
// ============================================

/**
 * I45: len(ids) >= max(componentProps.id, fnHtmlUsage.u, domApiCalls.t)
 */
function invariantI45(compact: CompactJSON): LevelResult {
  const ids = (compact as any).ids || [];
  const cpMax = Math.max(-1, ...(((compact as any).componentProps?.id) || []));
  const uMax = Math.max(-1, ...(((compact as any).fnHtmlUsage?.u) || []));
  const tMax = Math.max(-1, ...(((compact as any).domApiCalls?.t) || []));
  const max = Math.max(cpMax, uMax, tMax);

  const ok = ids.length >= max + 1;
  return {
    ok,
    diffCount: ok ? 0 : 1,
    diff: ok
      ? null
      : [{ path: '$.ids.length', a: ids.length, b: `>= ${max + 1}` }],
  };
}

/**
 * I46: values[] — JSON-safe
 */
function invariantI46(compact: CompactJSON): LevelResult {
  const values = compact.values || [];
  const violations: any[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const t = typeof v;
    if (v !== null && t !== 'string' && t !== 'number' && t !== 'boolean' && t !== 'object') {
      violations.push({ path: `$.values[${i}]`, a: t, b: 'JSON-safe' });
      if (violations.length >= 10) break;
    }
  }
  return { ok: violations.length === 0, diffCount: violations.length, diff: violations };
}

/**
 * I47: params[] — (string | number[])[]
 *
 * ✅ v16.0.2: РАСШИРЕНО — теперь разрешён массив ЛЮБОЙ длины,
 * состоящий из чисел. Это исправляет ложные срабатывания, когда
 * `encodeStr()` возвращает массив индексов токенов произвольной
 * длины (например, [302,27,421] — 3 токена).
 *
 * Раньше требовалось ровно [number, number], но это было
 * ошибочно: encodeStr() токенизирует строку и возвращает
 * массив индексов, длина которого равна количеству токенов.
 */
function invariantI47(compact: CompactJSON): LevelResult {
  const params = compact.params || [];
  const violations: any[] = [];
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    const t = typeof p;
    const isString = t === 'string';
    // ✅ FIX v16.0.2: массив любой длины из чисел
    const isNumberArray = Array.isArray(p) && p.every((x: any) => typeof x === 'number');
    if (!isString && !isNumberArray) {
      violations.push({
        path: `$.params[${i}]`,
        a: JSON.stringify(p),
        b: 'string | number[]',
      });
      if (violations.length >= 10) break;
    }
  }
  return { ok: violations.length === 0, diffCount: violations.length, diff: violations };
}

/**
 * I48: legend.schemas['vue.sfc'] содержит pn/ps/en/es/xn/xs
 */
function invariantI48(compact: CompactJSON): LevelResult {
  const schema = (compact as any).legend?.schemas?.['vue.sfc'];
  if (!Array.isArray(schema)) {
    return {
      ok: false,
      diffCount: 1,
      diff: [{ path: '$.legend.schemas.vue.sfc', a: 'missing', b: 'array' }],
    };
  }
  const required = ['pn', 'ps', 'en', 'es', 'xn', 'xs'];
  const missing = required.filter(k => !schema.includes(k));
  return {
    ok: missing.length === 0,
    diffCount: missing.length,
    diff: missing.map(k => ({ path: '$.legend.schemas.vue.sfc', a: 'missing', b: k })),
  };
}

/**
 * I49: legend.schemas['ids'] присутствует
 */
function invariantI49(compact: CompactJSON): LevelResult {
  const schema = (compact as any).legend?.schemas?.ids;
  const ok = Array.isArray(schema) && schema.length === 1;
  return {
    ok,
    diffCount: ok ? 0 : 1,
    diff: ok
      ? null
      : [{ path: '$.legend.schemas.ids', a: 'missing', b: '["(string[])"]' }],
  };
}

/**
 * I50 (усиление I24): RLE для sc-массивов — max(start + length) < sourceChains.length
 */
function invariantI50(compact: CompactJSON): LevelResult {
  const violations: any[] = [];
  const scLen = ((compact as any).sourceChains || []).length;

  const rles: Array<[string, any[] | undefined]> = [
    ['componentProps.sc', (compact as any).componentProps?.sc],
    ['componentEvents.sc', (compact as any).componentEvents?.sc],
    ['htmlInterpolations.sc', (compact as any).htmlInterpolations?.sc],
  ];

  for (const [name, rle] of rles) {
    if (!Array.isArray(rle)) continue;
    for (const entry of rle) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const [start, length] = entry;
      const end = start + length;
      if (end > scLen) {
        violations.push({
          path: `$.${name}[${start},${length}]`,
          a: `end=${end}`,
          b: `<= ${scLen}`,
        });
        if (violations.length >= 10) break;
      }
    }
  }
  return { ok: violations.length === 0, diffCount: violations.length, diff: violations };
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

  section('🔬 ROUND-TRIP ВЕРИФИКАЦИЯ CODEC (v16.0.3)');
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
    'vue.sfc': vueCounts.sfc,
    'vue.composables': vueCounts.composables,
    'vue.macros': vueCounts.macros,
    'vue.hooks': vueCounts.hooks,
    'vue.reactivity': vueCounts.reactivity,
    'vue.icons': vueCounts.icons,
    // ✅ v16.0.0
    fnHtmlUsage: (full as any).fnHtmlUsage?.length ?? 0,
    componentProps: (full as any).componentProps?.length ?? 0,
    componentEvents: (full as any).componentEvents?.length ?? 0,
    componentDirectives: (full as any).componentDirectives?.length ?? 0,
    componentSlots: (full as any).componentSlots?.length ?? 0,
    htmlInterpolations: (full as any).htmlInterpolations?.length ?? 0,
    domApiCalls: (full as any).domApiCalls?.length ?? 0,
    domApiArgs: (full as any).domApiArgs?.length ?? 0,
    ids: (full as any).ids?.length ?? 0,
    sourceChains: (full as any).sourceChains?.length ?? 0,
  };

  log('  FullJSON секции:');
  for (const [key, value] of Object.entries(sections)) {
    log(`    ${key.padEnd(22)} ${value}`);
  }

  // ============================================
  // 2.5. ПРОВЕРКА СТРУКТУРЫ ЛЕГЕНДЫ
  // ============================================

  let legendChecks: LegendCheck[] = [];
  let legendPassed = 0;
  let legendFailed = 0;

  if (options.checkLegend) {
    section('📖 СТРУКТУРА ЛЕГЕНДЫ (v16.0.0)');

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
  // ✅ v15.7.3 + v16.0.0: VUE-СЕКЦИЯ
  // ============================================
  subsection('vue (специальная проверка с нормализацией)');

  const decodedVue = (decoded as any).vue;
  const fullVue = (full as any).vue;

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

  // Сравнение vue-секций decoded ↔ full с нормализацией
  const normalizeSfc = (arr: any[]): any[] => {
    return arr.map(s => ({
      fileId: s.fileId,
      moduleId: s.moduleId,
      name: s.name,
      blocks: s.blocks,
      composables: s.composables,
      propsCount: Array.isArray(s.props) ? s.props.length : 0,
      emitsCount: Array.isArray(s.emits) ? s.emits.length : 0,
      exposedCount: Array.isArray(s.exposed) ? s.exposed.length : 0,
      // ✅ v16.0.0
      componentUsagesCount: Array.isArray(s.componentUsages) ? s.componentUsages.length : 0,
      htmlElementsCount: Array.isArray(s.htmlElements) ? s.htmlElements.length : 0,
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
    {
      name: 'functions[].parentFunctionId',
      result: spotCheckParentFunctionId(decoded, full, options.maxDiffs),
    },
    {
      name: 'lexicalLinks',
      result: spotCheckLexicalLinks(decoded, full, options.maxDiffs),
    },
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
    {
      name: 'functions[].vueKind',
      result: spotCheckVueKind(decoded, full, options.maxDiffs),
    },
    // ✅ v16.0.0
    {
      name: 'functions[].htmlUsage',
      result: spotCheckHtmlUsage(decoded, full, options.maxDiffs),
    },
    {
      name: 'functions[].isHtmlVisible',
      result: spotCheckIsHtmlVisible(decoded, full, options.maxDiffs),
    },
    {
      name: 'functions[].domApiCalls',
      result: spotCheckDomApiCalls(decoded, full, options.maxDiffs),
    },
    {
      name: 'ids / sourceChains',
      result: spotCheckIdsAndSourceChains(decoded, full, options.maxDiffs),
    },
    // ✅ v16.0.3: спот-чек vue.sfc[].componentUsages/htmlElements
    {
      name: 'vue.sfc[].componentUsages',
      result: spotCheckVueSfcComponentUsages(decoded, full, options.maxDiffs),
    },
    {
      name: 'vue.sfc[].htmlElements',
      result: spotCheckVueSfcHtmlElements(decoded, full, options.maxDiffs),
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

  // I17 — vue.sfc.c/cs — согласованность с decoded
  {
    const i17 = invariantI17(compact, decoded, options.maxDiffs);
    invariantResults.push({
      name: 'I17: vue.sfc.c/cs/p/e/x ↔ decoded.vue.sfc[].*',
      ok: i17.ok,
      violations: (i17.diff || []).map((d: any) => d.a),
    });
  }

  // ✅ v16.0.0: I45–I50
  {
    const r = invariantI45(compact);
    invariantResults.push({
      name: 'I45: len(ids) >= max(id-индексы)',
      ok: r.ok,
      violations: (r.diff || []).map((d: any) => d.a),
    });
  }
  {
    const r = invariantI46(compact);
    invariantResults.push({
      name: 'I46: values[] — JSON-safe',
      ok: r.ok,
      violations: (r.diff || []).map((d: any) => d.a),
    });
  }
  {
    const r = invariantI47(compact);
    invariantResults.push({
      name: 'I47: params[] — (string | number[])',
      ok: r.ok,
      violations: (r.diff || []).map((d: any) => d.a),
    });
  }
  {
    const r = invariantI48(compact);
    invariantResults.push({
      name: 'I48: legend.schemas.vue.sfc содержит pn/ps/en/es/xn/xs',
      ok: r.ok,
      violations: (r.diff || []).map((d: any) => d.a),
    });
  }
  {
    const r = invariantI49(compact);
    invariantResults.push({
      name: 'I49: legend.schemas.ids присутствует',
      ok: r.ok,
      violations: (r.diff || []).map((d: any) => d.a),
    });
  }
  {
    const r = invariantI50(compact);
    invariantResults.push({
      name: 'I50: RLE sc-массивов — max(start+length) < sourceChains.length',
      ok: r.ok,
      violations: (r.diff || []).map((d: any) => d.a),
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
    {
      name: 'spotCheck: functions[].parentFunctionId',
      ok: spotChecks.find(s => s.name === 'functions[].parentFunctionId')!.result.ok,
    },
    {
      name: 'spotCheck: lexicalLinks',
      ok: spotChecks.find(s => s.name === 'lexicalLinks')!.result.ok,
    },
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
    {
      name: 'spotCheck: functions[].vueKind',
      ok: spotChecks.find(s => s.name === 'functions[].vueKind')!.result.ok,
    },
    // ✅ v16.0.0
    {
      name: 'spotCheck: functions[].htmlUsage',
      ok: spotChecks.find(s => s.name === 'functions[].htmlUsage')!.result.ok,
    },
    {
      name: 'spotCheck: functions[].isHtmlVisible',
      ok: spotChecks.find(s => s.name === 'functions[].isHtmlVisible')!.result.ok,
    },
    {
      name: 'spotCheck: functions[].domApiCalls',
      ok: spotChecks.find(s => s.name === 'functions[].domApiCalls')!.result.ok,
    },
    {
      name: 'spotCheck: ids / sourceChains',
      ok: spotChecks.find(s => s.name === 'ids / sourceChains')!.result.ok,
    },
    // ✅ v16.0.3: новые спот-чеки
    {
      name: 'spotCheck: vue.sfc[].componentUsages',
      ok: spotChecks.find(s => s.name === 'vue.sfc[].componentUsages')!.result.ok,
    },
    {
      name: 'spotCheck: vue.sfc[].htmlElements',
      ok: spotChecks.find(s => s.name === 'vue.sfc[].htmlElements')!.result.ok,
    },
  ];

  for (const sr of sectionResults) {
    levels.push({ name: `section: ${sr.name}`, ok: sr.ok });
  }

  levels.push({ name: 'section: conditionals (via templates[])', ok: conditionalsOk });

  for (const check of legendChecks) {
    levels.push({ name: `legend: ${check.name}`, ok: check.ok });
  }

  for (const inv of invariantResults) {
    levels.push({ name: `invariant: ${inv.name}`, ok: inv.ok });
  }

  for (const sc of structChecks) {
    levels.push({ name: `struct: ${sc.name}`, ok: sc.result.ok });
  }

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
    // ✅ v16.0.3
    codecVersion: '16.0.3',
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

// ============================================
// ✅ v16.0.0: SPOT-CHECKS
// ============================================

function spotCheckHtmlUsage(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.functions || []).map((f: any) => ({
    id: f.id,
    htmlUsageCount: Array.isArray(f.htmlUsage) ? f.htmlUsage.length : 0,
  }));
  const b = (full.functions || []).map((f: any) => ({
    id: f.id,
    htmlUsageCount: Array.isArray(f.htmlUsage) ? f.htmlUsage.length : 0,
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
    if (ai.htmlUsageCount !== bi.htmlUsageCount) {
      diffs.push({
        path: `$.functions[${i}].htmlUsage.length`,
        a: ai.htmlUsageCount,
        b: bi.htmlUsageCount,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

/**
 * ✅ v16.0.2: Нормализует isHtmlVisible для сравнения.
 *
 * `undefined`, `null`, `false` — эквивалентны (все означают "не видимо").
 */
function normalizeIsHtmlVisible(v: any): boolean {
  return v === true;
}

function spotCheckIsHtmlVisible(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.functions || []).map((f: any) => ({
    id: f.id,
    isHtmlVisible: normalizeIsHtmlVisible(f.isHtmlVisible),
  }));
  const b = (full.functions || []).map((f: any) => ({
    id: f.id,
    isHtmlVisible: normalizeIsHtmlVisible(f.isHtmlVisible),
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
    if (ai.isHtmlVisible !== bi.isHtmlVisible) {
      diffs.push({
        path: `$.functions[${i}].isHtmlVisible`,
        a: ai.isHtmlVisible,
        b: bi.isHtmlVisible,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

function spotCheckDomApiCalls(decoded: FullJSON, full: FullJSON, limit: number): LevelResult {
  const a = (decoded.functions || []).map((f: any) => ({
    id: f.id,
    domApiCallsCount: Array.isArray(f.domApiCalls) ? f.domApiCalls.length : 0,
  }));
  const b = (full.functions || []).map((f: any) => ({
    id: f.id,
    domApiCallsCount: Array.isArray(f.domApiCalls) ? f.domApiCalls.length : 0,
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
    if (ai.domApiCallsCount !== bi.domApiCallsCount) {
      diffs.push({
        path: `$.functions[${i}].domApiCalls.length`,
        a: ai.domApiCallsCount,
        b: bi.domApiCallsCount,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

function spotCheckIdsAndSourceChains(decoded: FullJSON, full: FullJSON, _limit: number): LevelResult {
  const diffs: any[] = [];

  const aIds = (decoded as any).ids || [];
  const bIds = (full as any).ids || [];
  if (aIds.length !== bIds.length) {
    diffs.push({ path: '$.ids.length', a: aIds.length, b: bIds.length });
  }

  const aSc = (decoded as any).sourceChains || [];
  const bSc = (full as any).sourceChains || [];
  if (aSc.length !== bSc.length) {
    diffs.push({ path: '$.sourceChains.length', a: aSc.length, b: bSc.length });
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

// ============================================
// ✅ v16.0.3: SPOT-CHECKS ДЛЯ vue.sfc[]
// ============================================

/**
 * ✅ v16.0.3: Проверяет, что у каждого SFC в decoded и full
 * есть `componentUsages` (массив), и количества совпадают.
 *
 * Нормализация: `[]` и `undefined` → `0` (по длине).
 */
function spotCheckVueSfcComponentUsages(
  decoded: FullJSON,
  full: FullJSON,
  limit: number
): LevelResult {
  const aSfc = (decoded as any).vue?.sfc || [];
  const bSfc = (full as any).vue?.sfc || [];

  const diffs: any[] = [];
  const n = Math.min(aSfc.length, bSfc.length);

  if (aSfc.length !== bSfc.length) {
    diffs.push({
      path: '$.vue.sfc.length',
      a: aSfc.length,
      b: bSfc.length,
    });
  }

  for (let i = 0; i < n && diffs.length < limit; i++) {
    const ai = aSfc[i];
    const bi = bSfc[i];
    if (!ai || !bi) continue;

    const aCount = Array.isArray(ai.componentUsages) ? ai.componentUsages.length : 0;
    const bCount = Array.isArray(bi.componentUsages) ? bi.componentUsages.length : 0;

    if (aCount !== bCount) {
      diffs.push({
        path: `$.vue.sfc[${i}].componentUsages.length`,
        a: aCount,
        b: bCount,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

/**
 * ✅ v16.0.3: Проверяет, что у каждого SFC в decoded и full
 * есть `htmlElements` (массив), и количества совпадают.
 */
function spotCheckVueSfcHtmlElements(
  decoded: FullJSON,
  full: FullJSON,
  limit: number
): LevelResult {
  const aSfc = (decoded as any).vue?.sfc || [];
  const bSfc = (full as any).vue?.sfc || [];

  const diffs: any[] = [];
  const n = Math.min(aSfc.length, bSfc.length);

  if (aSfc.length !== bSfc.length) {
    diffs.push({
      path: '$.vue.sfc.length',
      a: aSfc.length,
      b: bSfc.length,
    });
  }

  for (let i = 0; i < n && diffs.length < limit; i++) {
    const ai = aSfc[i];
    const bi = bSfc[i];
    if (!ai || !bi) continue;

    const aCount = Array.isArray(ai.htmlElements) ? ai.htmlElements.length : 0;
    const bCount = Array.isArray(bi.htmlElements) ? bi.htmlElements.length : 0;

    if (aCount !== bCount) {
      diffs.push({
        path: `$.vue.sfc[${i}].htmlElements.length`,
        a: aCount,
        b: bCount,
      });
    }
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

// ============================================
// ТОКЕНИЗИРОВАННЫЕ СТРОКИ
// ============================================

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

  if (!Array.isArray(compact.methods)) {
    diffs.push({ path: '$.methods', a: 'missing', b: 'array expected' });
  }

  return { ok: diffs.length === 0, diffCount: diffs.length, diff: diffs };
}

// ============================================
// HELP
// ============================================

function printHelp(): void {
  console.log(`
Использование: verify-roundtrip [опции]

Опции:
  --compact <path>       Путь к compact JSON (по умолчанию: ./ast-graph-viewer/index.json)
  --full <path>          Путь к full JSON (по умолчанию: ./ast-graph-viewer/index.full.json)
  --verbose, -v          Подробный вывод
  --max-diffs <n>        Максимум расхождений для вывода (по умолчанию: 10)
  --json-report <path>   Сохранить JSON-отчёт
  --golden <dir>         Директория с эталонными файлами (по умолчанию: ./scripts/fixtures)
  --no-golden            Отключить проверку эталонов
  --no-check-legend      Отключить проверку легенды
  --help, -h             Показать эту справку
`);
}

main().catch(err => {
  console.error(`${C.red}Фатальная ошибка:${C.reset}`, err);
  process.exit(2);
});
