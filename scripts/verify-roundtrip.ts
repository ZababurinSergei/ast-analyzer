#!/usr/bin/env node
// scripts/verify-roundtrip.ts
// ============================================
// ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ ДЛЯ ROUND-TRIP ПРОВЕРОК CODEC
// ============================================
// Уровни round-trip:
//   L0  : encode(full) === compact          (семантически)
//   L1  : decode(compact) === full          (семантически)
//   L2  : decode(compact) === full          (побайтово)
//   L3  : compact на диске === encode(full) (побайтово, БЕЗ сортировки)
//   RE  : encode(decode(compact)) === compact
//   DL  : decode(encode(full)) === full
//   ENC : encode(full) === encode(decode(encode(full)))
//   DEC : decode(compact) === decode(encode(decode(compact)))
//
// Семантические инварианты:
//   I1  : calls[].type ∈ {direct, async, method, callback}
//   I2  : imports[].type ∈ {named, default, namespace, type}
//   I3  : exports[].type ∈ {named, default, type}
//   I4  : external calls → isExternal = 1 в compact.gr.c
//   I5  : external calls: не все type='direct' (регрессия v9.0.4)
//   I6  : functions[].*Flags ∈ {true, false, undefined}
//
// Эталон (golden):
//   G1  : full ≈ scripts/fixtures/index.full.golden.json
//   G2  : compact ≈ scripts/fixtures/index.golden.json
//
// Exit code 0 — всё ок, 1 — есть расхождения.
// ============================================

import fs from 'fs';
import path from 'path';
import { Codec } from '../src/reporters/codec/codec.js';
import { verifyRoundTripBoth } from '../src/reporters/codec/codec-verify.js';
import type { CompactJSON, FullJSON } from '../src/reporters/codec/codec-types.js';

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
}

const DEFAULT_OPTIONS: ScriptOptions = {
  compactPath: './index.json',
  fullPath: './index.full.json',
  verbose: false,
  maxDiffs: 10,
  jsonReportPath: null,
  goldenDir: './scripts/fixtures',
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
// ХЕЛПЕРЫ
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
// УТИЛИТЫ СРАВНЕНИЯ
// ============================================

/**
 * Удаляет производные поля (edges, edgesStats, legend, __codec)
 * для семантического сравнения FullJSON.
 */
function stripEdges(value: any): any {
  if (!value || typeof value !== 'object') return value;
  const { edges, edgesStats, __codec, legend, ...rest } = value;
  return rest;
}

/**
 * Удаляет legend и __codec для сравнения CompactJSON.
 * legend содержит словари, которые могут отличаться порядком/составом
 * при одинаковой семантике.
 */
function stripLegend(value: any): any {
  if (!value || typeof value !== 'object') return value;
  const { legend, __codec, ...rest } = value;
  return rest;
}

function normalizeForCompare(value: any): string {
  const norm = (v: any): any => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const key of Object.keys(v).sort()) {
        const nv = norm(v[key]);
        if (nv !== undefined) out[key] = nv;
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

function byteExactStringify(value: any): string {
  return JSON.stringify(value);
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
  const sa = byteExactStringify(a);
  const sb = byteExactStringify(b);
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
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  section('🔬 ROUND-TRIP ВЕРИФИКАЦИЯ CODEC (единый источник истины)');
  info(`Compact: ${path.resolve(options.compactPath)}`);
  info(`Full:    ${path.resolve(options.fullPath)}`);
  info(`Verbose: ${options.verbose}`);
  info(`MaxDiffs: ${options.maxDiffs}`);
  info(`Golden:  ${options.goldenDir ? path.resolve(options.goldenDir) : 'disabled'}`);
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
    conditionals: full.conditionals?.length ?? 0,
    types: full.types?.length ?? 0,
    typeRefs: full.typeRefs?.length ?? 0,
  };

  log('  FullJSON секции:');
  for (const [key, value] of Object.entries(sections)) {
    log(`    ${key.padEnd(14)} ${value}`);
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

  subsection('L1: decode(compact) === full (семантически)');
  const l1 = semanticCompare(decoded, full, options.maxDiffs);
  printLevelResult('L1', l1, options.maxDiffs);

  subsection('L2: decode(compact) === full (побайтово)');
  const l2 = byteExactCompare(decoded, full, options.maxDiffs);
  printLevelResult('L2', l2, options.maxDiffs);

  subsection('L3: compact (на диске) === encode(full) (побайтово)');
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
      notes: firstDiff ? `Первое расхождение на позиции ${firstDiff.pos}` : undefined,
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
  }

  subsection('RE: encode(decode(compact)) === compact (семантически)');
  const reEncoded = Codec.encode(decoded);
  const re = semanticCompare(reEncoded, compact, options.maxDiffs);
  printLevelResult('RE', re, options.maxDiffs);

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
  // 4. ТОЧЕЧНЫЕ ПРОВЕРКИ
  // ============================================

  section('🎯 ТОЧЕЧНЫЕ ПРОВЕРКИ');

  const spotChecks: Array<{ name: string; result: LevelResult }> = [
    { name: 'calls[].type', result: baseReport.spotChecks.callsType },
    { name: 'imports[].toFileId', result: baseReport.spotChecks.importsToFileId },
    { name: 'exports[].isReExport', result: baseReport.spotChecks.exportsIsReExport },
    { name: 'functions[].*Flags', result: baseReport.spotChecks.functionsFlags },
    { name: 'external calls type', result: baseReport.spotChecks.externalCalls },
    { name: 'modules[].path', result: baseReport.spotChecks.modulesPath },
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
  // 5. СЕМАНТИЧЕСКИЕ ИНВАРИАНТЫ
  // ============================================

  section('🧭 СЕМАНТИЧЕСКИЕ ИНВАРИАНТЫ');

  interface InvariantResult {
    name: string;
    ok: boolean;
    violations: string[];
  }

  const invariantResults: InvariantResult[] = [];

  // --- I1: calls[].type ∈ {direct, async, method, callback} ---
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

  // --- I2: imports[].type ∈ {named, default, namespace, type} ---
  {
    const validTypes = new Set(['named', 'default', 'namespace', 'type']);
    const violations: string[] = [];
    for (const i of full.imports || []) {
      if (!validTypes.has(i.type)) {
        violations.push(`${i.id || '?'}: type="${i.type}"`);
      }
    }
    invariantResults.push({
      name: 'I2: imports[].type ∈ {named, default, namespace, type}',
      ok: violations.length === 0,
      violations,
    });
  }

  // --- I3: exports[].type ∈ {named, default, type} ---
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

  // --- I4: external calls → isExternal = 1 в compact.gr.c ---
  {
    const violations: string[] = [];
    const compactCalls = (compact.gr?.c || []) as any[];
    for (let i = 0; i < compactCalls.length; i++) {
      const row = compactCalls[i];
      if (!row) continue;
      const isExternal = row[4];
      const fullCall = (full.calls || [])[i];
      if (fullCall && fullCall.toFunctionId?.startsWith('external:')) {
        if (isExternal !== 1) {
          violations.push(`compact.gr.c[${i}]: isExternal=${isExternal}, ожидалось 1`);
        }
      }
    }
    invariantResults.push({
      name: 'I4: external calls → isExternal = 1 в compact.gr.c',
      ok: violations.length === 0,
      violations,
    });
  }

  // --- I5: external calls: не все type='direct' (регрессия v9.0.4) ---
  {
    const externalCalls = (full.calls || []).filter(c => c.toFunctionId?.startsWith('external:'));
    const directCount = externalCalls.filter(c => c.type === 'direct').length;
    const nonDirectCount = externalCalls.length - directCount;

    // Эвристика: если ВСЕ external-вызовы имеют type='direct' — подозрительно.
    // Исключение: если external-вызовов мало (< 3) — статистика недостоверна.
    const suspicious = externalCalls.length >= 3 && nonDirectCount === 0;

    invariantResults.push({
      name: "I5: external calls: не все type='direct' (регрессия v9.0.4)",
      ok: !suspicious,
      violations: suspicious
        ? [
            `Все ${externalCalls.length} external-вызовов имеют type='direct' — вероятна регрессия v9.0.4`,
          ]
        : [],
    });
  }

  // --- I6: functions[].*Flags ∈ {true, false, undefined} ---
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
  // 6. ЭТАЛОН (GOLDEN)
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

    // --- G1: full ≈ golden.full ---
    if (fileExists(goldenFullPath)) {
      const goldenFull = readJson<FullJSON>(goldenFullPath);
      // Сравниваем семантически, игнорируя edges (производное поле)
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

    // --- G2: compact ≈ golden.compact ---
    if (fileExists(goldenCompactPath)) {
      const goldenCompact = readJson<CompactJSON>(goldenCompactPath);
      // Сравниваем семантически, игнорируя legend (динамический)
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
    { name: 'L2 (decode(compact) === full, побайтово)', ok: l2.ok },
    { name: 'L3 (compact на диске === encode(full), побайтово)', ok: l3.ok },
    { name: 'RE (encode(decode(compact)) === compact)', ok: re.ok },
    { name: 'DL (decode(encode(full)) === full)', ok: dl.ok },
    { name: 'ENC (encode идемпотентен)', ok: enc.ok },
    { name: 'DEC (decode идемпотентен)', ok: dec.ok },
    { name: 'full_self_contained', ok: baseReport.full_self_contained },
    { name: 'compact_self_contained', ok: baseReport.compact_self_contained },
    { name: 'spotCheck: calls[].type', ok: baseReport.spotChecks.callsType.ok },
    { name: 'spotCheck: imports[].toFileId', ok: baseReport.spotChecks.importsToFileId.ok },
    { name: 'spotCheck: exports[].isReExport', ok: baseReport.spotChecks.exportsIsReExport.ok },
    { name: 'spotCheck: functions[].*Flags', ok: baseReport.spotChecks.functionsFlags.ok },
    { name: 'spotCheck: external calls', ok: baseReport.spotChecks.externalCalls.ok },
    { name: 'spotCheck: modules[].path', ok: baseReport.spotChecks.modulesPath.ok },
  ];

  // Добавляем инварианты
  for (const inv of invariantResults) {
    levels.push({ name: `invariant: ${inv.name}`, ok: inv.ok });
  }

  // Добавляем golden-проверки (только не-skipped)
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

  // Показываем skipped golden-проверки отдельно
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
    originalFormat: 'compact',
    bothFormats: false,

    // Round-trip уровни
    L0_encodeFullVsCompact: l0,
    L1_semantic: l1,
    L2_decodeCompactVsFull: l2,
    L3_byteExact: l3,
    reverse: re,
    dl,
    enc_idempotent: enc,
    dec_idempotent: dec,

    // Spot checks
    spotChecks,

    // Семантические инварианты
    invariants: invariantResults,

    // Эталон
    golden: goldenResults,

    // Размеры и статистика
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
// HELP
// ============================================

function printHelp(): void {
  log(`
${C.bold}Использование:${C.reset}
  npx tsx scripts/verify-roundtrip.ts [options]

${C.bold}Опции:${C.reset}
  --compact <path>       Путь к compact JSON (по умолчанию ./index.json)
  --full <path>          Путь к full JSON (по умолчанию ./index.full.json)
  -v, --verbose          Подробный вывод с расхождениями
  --max-diffs <n>        Максимум расхождений для вывода (по умолчанию 10)
  --json-report <path>   Сохранить отчёт в JSON-файл
  --golden <dir>         Директория с эталонами (по умолчанию ./scripts/fixtures)
  --no-golden            Отключить проверку против эталона
  -h, --help             Показать эту справку

${C.bold}Уровни round-trip:${C.reset}
  L0  : encode(full) === compact (семантически)
  L1  : decode(compact) === full (семантически)
  L2  : decode(compact) === full (побайтово)
  L3  : compact на диске === encode(full) (побайтово)
  RE  : encode(decode(compact)) === compact
  DL  : decode(encode(full)) === full
  ENC : encode(full) === encode(decode(encode(full)))
  DEC : decode(compact) === decode(encode(decode(compact)))

${C.bold}Семантические инварианты:${C.reset}
  I1  : calls[].type ∈ {direct, async, method, callback}
  I2  : imports[].type ∈ {named, default, namespace, type}
  I3  : exports[].type ∈ {named, default, type}
  I4  : external calls → isExternal = 1 в compact.gr.c
  I5  : external calls: не все type='direct' (регрессия v9.0.4)
  I6  : functions[].*Flags ∈ {true, false, undefined}

${C.bold}Эталон (golden):${C.reset}
  G1  : full ≈ scripts/fixtures/index.full.golden.json
  G2  : compact ≈ scripts/fixtures/index.golden.json

${C.bold}Примеры:${C.reset}
  npx tsx scripts/verify-roundtrip.ts
  npx tsx scripts/verify-roundtrip.ts --json-report ./round-trip-report.json
  npx tsx scripts/verify-roundtrip.ts -v --max-diffs 20
  npx tsx scripts/verify-roundtrip.ts --no-golden
  npx tsx scripts/verify-roundtrip.ts --golden ./my-fixtures
`);
}

// ============================================
// ЗАПУСК
// ============================================

main().catch(err => {
  console.error(`${C.red}💥 Необработанная ошибка:${C.reset}`, err);
  process.exit(1);
});
