#!/usr/bin/env node
// scripts/save-golden.ts
// ============================================================
// СОХРАНЕНИЕ GOLDEN-ФИКСТУР (v1.0.0)
// ============================================================
// Сохраняет текущие compact/full в scripts/fixtures/ как golden
// для конкретного проекта.
//
// Использование:
//   npx tsx scripts/save-golden.ts --project=ast-graph-viewer
//   npx tsx scripts/save-golden.ts --project=src --source=./src
//
// Опции:
//   --project=<name>   Имя проекта (обязательно)
//   --source=<dir>     Директория с index.json (по умолчанию: ./ast-graph-viewer)
//   --out=<dir>        Директория для golden (по умолчанию: ./scripts/fixtures)
// ============================================================

import fs from 'fs';
import path from 'path';

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function ok(msg: string): void {
  console.log(`${C.green}✅ ${msg}${C.reset}`);
}
function fail(msg: string): void {
  console.log(`${C.red}❌ ${msg}${C.reset}`);
}
function info(msg: string): void {
  console.log(`${C.cyan}ℹ️  ${msg}${C.reset}`);
}

interface Options {
  project: string | null;
  source: string;
  out: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    project: null,
    source: './ast-graph-viewer',
    out: './scripts/fixtures',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--project=')) {
      opts.project = arg.substring('--project='.length);
    } else if (arg === '--project' && args[i + 1]) {
      opts.project = args[++i]!;
    } else if (arg.startsWith('--source=')) {
      opts.source = arg.substring('--source='.length);
    } else if (arg === '--source' && args[i + 1]) {
      opts.source = args[++i]!;
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.substring('--out='.length);
    } else if (arg === '--out' && args[i + 1]) {
      opts.out = args[++i]!;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Использование: save-golden [опции]

Опции:
  --project=<name>   Имя проекта (обязательно)
  --source=<dir>     Директория с index.json (по умолчанию: ./ast-graph-viewer)
  --out=<dir>        Директория для golden (по умолчанию: ./scripts/fixtures)
  --help, -h         Показать эту справку

Примеры:
  npx tsx scripts/save-golden.ts --project=ast-graph-viewer
  npx tsx scripts/save-golden.ts --project=src --source=./reports
`);
      process.exit(0);
    }
  }

  return opts;
}

function main(): void {
  const opts = parseArgs();

  if (!opts.project) {
    fail('--project=<name> обязателен');
    console.log('Пример: npx tsx scripts/save-golden.ts --project=ast-graph-viewer');
    process.exit(1);
  }

  const sourceDir = path.resolve(opts.source);
  const outDir = path.resolve(opts.out);

  const srcCompact = path.join(sourceDir, 'index.json');
  const srcFull = path.join(sourceDir, 'index.full.json');

  if (!fs.existsSync(srcCompact)) {
    fail(`Compact не найден: ${srcCompact}`);
    process.exit(1);
  }
  if (!fs.existsSync(srcFull)) {
    fail(`Full не найден: ${srcFull}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const dstCompact = path.join(outDir, `${opts.project}.golden.json`);
  const dstFull = path.join(outDir, `${opts.project}.full.golden.json`);

  fs.copyFileSync(srcCompact, dstCompact);
  fs.copyFileSync(srcFull, dstFull);

  const compactSize = fs.statSync(dstCompact).size;
  const fullSize = fs.statSync(dstFull).size;

  info(`Project: ${opts.project}`);
  info(`Source:  ${sourceDir}`);
  info(`Out:     ${outDir}`);
  console.log('');
  ok(`Compact: ${path.relative(process.cwd(), dstCompact)} (${(compactSize / 1024).toFixed(2)} KB)`);
  ok(`Full:    ${path.relative(process.cwd(), dstFull)} (${(fullSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log('');
  console.log(`${C.green}${C.bold}🎉 Golden сохранён.${C.reset}`);
  console.log('');
  console.log('Проверить:');
  console.log(`  npx tsx scripts/verify-roundtrip.ts --project=${opts.project} -v --max-diffs 10`);
}

main();
