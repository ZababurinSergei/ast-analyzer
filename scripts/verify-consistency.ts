// scripts/verify-consistency.ts
// ============================================
// Проверка согласованности index.json ↔ index.full.json
// ============================================
// Версия: 1.0.1
//
// Назначение
// ----------
// Этот скрипт проверяет, что compact (index.json) и full
// (index.full.json) собраны из ОДНИХ И ТЕХ ЖЕ исходников.
//
// Это НЕ проверка round-trip кодека. Round-trip проверяет,
// что decode(encode(x)) === x для одного источника.
//
// Этот скрипт проверяет СОГЛАСОВАННОСТЬ ДВУХ АРТЕФАКТОВ
// СБОРКИ. Если они собраны в разное время / из разных
// исходников — скрипт покажет расхождения.
//
// Использование
// -------------
//   npx tsx scripts/verify-consistency.ts
//   npx tsx scripts/verify-consistency.ts --compact example/index.json --full example/index.full.json
//   npx tsx scripts/verify-consistency.ts -v --max-diffs 50
// ============================================

import * as fs from 'fs';
import * as path from 'path';

import { encode } from '../src/reporters/codec/codec-encode.js';
import { decode } from '../src/reporters/codec/codec-decode.js';
import { deepEqual, collectDiffs } from '../src/reporters/codec/codec-verify.js';

import type { FullJSON, CompactJSON } from '../src/reporters/codec/codec-types.js';

// Локальный diffObjects = collectDiffs с basePath='$'
function diffObjects(a: unknown, b: unknown, limit = 20) {
  return collectDiffs(a, b, '$', limit);
}

// ============================================
// АРГУМЕНТЫ КОМАНДНОЙ СТРОКИ
// ============================================

interface Args {
  compact: string;
  full: string;
  verbose: boolean;
  maxDiffs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    compact: 'example/index.json',
    full: 'example/index.full.json',
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

// ============================================
// ЦВЕТА
// ============================================

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

// ============================================
// УТИЛИТЫ
// ============================================

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

// ============================================
// stripServiceFields / stripForByteCompare
// ============================================

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

// ============================================
// СРАВНЕНИЕ СЛОВАРЕЙ
// ============================================

function compareDictionaries(
  label: string,
  a: { tokens: string[]; dict: (string | number[])[] },
  b: { tokens: string[]; dict: (string | number[])[] }
): { ok: boolean; diffs: { path: string; a: unknown; b: unknown }[] } {
  const diffs: { path: string; a: unknown; b: unknown }[] = [];

  const decodeEntry = (entry: string | number[], tokens: string[]): string => {
    if (typeof entry === 'string') return entry;
    return entry.map(i => tokens[i] || '').join('');
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

// ============================================
// ОСНОВНАЯ ПРОВЕРКА
// ============================================

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  diffs?: { path: string; a: unknown; b: unknown }[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  printHeader('🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ index.json ↔ index.full.json');
  console.log(`  ${INFO} compact: ${C.cyan}${path.resolve(args.compact)}${C.reset}`);
  console.log(`  ${INFO} full:    ${C.cyan}${path.resolve(args.full)}${C.reset}`);
  console.log(`  ${INFO} verbose: ${args.verbose}`);
  console.log(`  ${INFO} maxDiffs: ${args.maxDiffs}`);

  // ============================================
  // ЗАГРУЗКА
  // ============================================
  printSection('📂 ЗАГРУЗКА ФАЙЛОВ');

  const compactRaw = readJson(args.compact);
  const fullRaw = readJson(args.full);

  const compactSize = JSON.stringify(compactRaw).length;
  const fullSize = JSON.stringify(fullRaw).length;

  console.log(`  ${INFO} compact size: ${formatSize(compactSize)}`);
  console.log(`  ${INFO} full size:    ${formatSize(fullSize)}`);

  const compact = compactRaw as CompactJSON;
  const full = fullRaw as FullJSON;

  // ============================================
  // МЕТАДАННЫЕ
  // ============================================
  printSection('📅 МЕТАДАННЫЕ');

  const checks: CheckResult[] = [];

  // 1. timestamp
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

  // 2. version
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

  // 3. valuesMode
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

  // ============================================
  // STATISTICS
  // ============================================
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

  // ============================================
  // DECODE(COMPACT) ≟ FULL
  // ============================================
  printSection('🔁 decode(compact) ≟ full');

  let decodedCompact: FullJSON | null = null;
  {
    try {
      decodedCompact = decode(compact);
      const a = stripServiceFields(decodedCompact);
      const b = stripServiceFields(full);
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

  // ============================================
  // ENCODE(FULL) ≟ COMPACT
  // ============================================
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

  // ============================================
  // МОДУЛИ
  // ============================================
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

  // ============================================
  // СЛОВАРИ
  // ============================================
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

    // tokens
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

  // ============================================
  // ИТОГИ
  // ============================================
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
    console.log(`  ${C.dim}   1. Пересобрать index.full.json из тех же исходников,`);
    console.log(`      что и index.json.`);
    console.log(`   2. Либо удалить устаревший index.full.json — он больше`);
    console.log(`      не соответствует index.json.`);
    console.log(`   3. Проверить timestamp обоих файлов — они должны совпадать.${C.reset}`);
    process.exit(1);
  }
}

// ============================================
// ЗАПУСК
// ============================================

main().catch(err => {
  console.error(`${C.red}Фатальная ошибка:${C.reset}`, err);
  process.exit(2);
});
