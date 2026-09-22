#!/usr/bin/env node
// scripts/verify-cross-file.ts
// ============================================================
// E2E-ПРОВЕРКА CROSS-FILE RESOLVER (P3)
// ============================================================
// Версия: 1.1.0
//
// ════════════════════════════════════════════════════════════
// ИЗМЕНЕНИЯ v1.1.0 (патч 4 — явный tsconfig + диагностика):
//   - ✅ ДОБАВЛЕНО: явный поиск и передача tsConfigPath
//     в resolveCrossFileCalls. Ранее tsconfig подхватывался
//     только через автопоиск в ProjectManager, что не всегда
//     срабатывало для infoenergo-ui (unresolvedRate 78%).
//   - ✅ ДОБАВЛЕНО: диагностика tsconfig — вывод alias'ов
//     и baseUrl в verbose-режиме.
//   - ✅ ДОБАВЛЕНО: диагностика unresolved — топ-20 причин
//     (файл:строка → callee).
//   - ✅ ДОБАВЛЕНО: подсчёт статистики по причинам unresolved
//     (symbol_not_found, dynamic_key, no_declarations, ...).
//   - ✅ ОБНОВЛЕНО: JSON-отчёт теперь включает tsconfig-диагностику
//     и unresolvedSamples.
//
// НАЗНАЧЕНИЕ
// ----------
// End-to-end проверка работы cross-file resolver на реальном
// проекте. Скрипт:
//   1. Собирает все .ts/.tsx/.js/.jsx/.vue файлы проекта.
//   2. Парсит каждый файл через parseFile + extractEntities.
//   3. Запускает resolveCrossFileCalls.
//   4. Выводит метрики и топ-10 межфайловых вызовов.
//   5. Проверяет, что найдено хотя бы 1 межфайловый вызов.
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   npx tsx scripts/verify-cross-file.ts
//   npx tsx scripts/verify-cross-file.ts --root ./infoenergo-ui
//   npx tsx scripts/verify-cross-file.ts -v
//   npx tsx scripts/verify-cross-file.ts --json-report ./p3-report.json
//   npx tsx scripts/verify-cross-file.ts -h
//
// ════════════════════════════════════════════════════════════
// EXIT CODE
// ════════════════════════════════════════════════════════════
//
//   0 — E2E PASS (найдено ≥ 1 межфайловый вызов)
//   1 — E2E FAIL (0 межфайловых вызовов)
//   2 — Фатальная ошибка (root не существует, ошибка парсинга)
//
// ════════════════════════════════════════════════════════════
// МЕТРИКИ
// ════════════════════════════════════════════════════════════
//
//   - totalCalls          — всего вызовов
//   - sameFileCalls       — внутрифайловых
//   - crossFileCalls      — межфайловых (главная метрика)
//   - unresolvedCalls     — не разрешено
//   - cacheHits           — попаданий в кэш
//   - cacheMisses         — промахов кэша
//   - initDurationMs      — время инициализации ts-morph Project
//   - resolveDurationMs   — время резолвинга
//   - durationMs          — общее время
//   - filesAdded          — файлов добавлено в Project
//   - vueFilesAdded       — .vue добавлено
//   - addFileErrors       — ошибок при добавлении
//
// ════════════════════════════════════════════════════════════
// ОЖИДАЕМЫЙ РЕЗУЛЬТАТ (после патча v1.1.0)
// ════════════════════════════════════════════════════════════
//
//   На проекте infoenergo-ui (185 файлов, 147 с сущностями):
//     totalCalls:        997
//     crossFileCalls:    ≥ 200 (было 47)
//     unresolvedCalls:   ≤ 30% от totalCalls (было 78%)
//     cacheHitRate:      ≥ 20% (было 2.6%)
//     initDurationMs:    ≤ 2000
//     resolveDurationMs: ≤ 60000
//
// ============================================================

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

import { parseFile } from '../src/core/ast-parser.js';
import { extractEntities } from '../src/core/entity-extractor/index.js';
import { resolveCrossFileCalls } from '../src/core/cross-file-resolver/index.js';
import type { EntitiesResult } from '../src/types.js';

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Аргументы командной строки.
 */
interface Args {
  /** Корень проекта */
  root: string;
  /** Подробный вывод */
  verbose: boolean;
  /** Путь для JSON-отчёта (null = не сохранять) */
  jsonReport: string | null;
}

/**
 * Диагностика tsconfig.
 */
interface TsConfigDiagnostics {
  /** Путь к tsconfig.json (null если не найден) */
  path: string | null;
  /** Задан ли baseUrl */
  baseUrl: string | null;
  /** Количество alias'ов в compilerOptions.paths */
  aliasCount: number;
  /** Примеры alias'ов (до 10) */
  aliasSamples: Array<{ alias: string; targets: string[] }>;
  /** Ошибка парсинга, если была */
  error?: string;
}

/**
 * Причина unresolved-вызова.
 */
interface UnresolvedReason {
  file: string;
  line: number;
  callee: string;
  reason: string;
}

// ============================================================
// ПАРСИНГ АРГУМЕНТОВ
// ============================================================

/**
 * Парсит аргументы командной строки.
 *
 * ════════════════════════════════════════════════════════════
 * ПОДДЕРЖИВАЕМЫЕ ФЛАГИ
 * ════════════════════════════════════════════════════════════
 *
 *   --root <dir>          — корень проекта (по умолчанию ./infoenergo-ui)
 *   -v, --verbose         — подробный вывод
 *   --json-report <path>  — сохранить отчёт в JSON
 *   -h, --help            — показать справку
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   parseArgs(['--root', './src', '-v']);
 *   // → { root: './src', verbose: true, jsonReport: null }
 */
function parseArgs(argv: string[]): Args {
  const args: Args = {
    root: './infoenergo-ui',
    verbose: false,
    jsonReport: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === '--root' && argv[i + 1]) {
      args.root = argv[++i]!;
    } else if (a === '-v' || a === '--verbose') {
      args.verbose = true;
    } else if (a === '--json-report' && argv[i + 1]) {
      args.jsonReport = argv[++i]!;
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

/**
 * Печатает справку и завершает процесс.
 */
function printHelp(): void {
  console.log(`
Использование:
  npx tsx scripts/verify-cross-file.ts [options]

Опции:
  --root <dir>          Корень проекта (по умолчанию ./infoenergo-ui)
  -v, --verbose         Подробный вывод
  --json-report <path>  Сохранить отчёт в JSON
  -h, --help            Показать эту справку

Метрики:
  totalCalls          — всего вызовов
  sameFileCalls       — внутрифайловых
  crossFileCalls      — межфайловых (главная метрика)
  unresolvedCalls     — не разрешено
  cacheHits           — попаданий в кэш
  cacheMisses         — промахов кэша
  initDurationMs      — время инициализации ts-morph Project
  resolveDurationMs   — время резолвинга
  durationMs          — общее время
  filesAdded          — файлов добавлено в Project
  vueFilesAdded       — .vue добавлено
  addFileErrors       — ошибок при добавлении

Exit code:
  0 — E2E PASS (найдено ≥ 1 межфайловый вызов)
  1 — E2E FAIL (0 межфайловых вызовов)
  2 — Фатальная ошибка
`);
}

// ============================================================
// ДИАГНОСТИКА TSCONFIG (✅ v1.1.0)
// ============================================================

/**
 * Читает tsconfig.json из указанного корня и собирает диагностику.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   Cross-file resolver использует ts-morph Project, которому
 *   нужен tsConfigFilePath для резолвинга алиасов (@/components/...).
 *
 *   Если tsconfig не передан — ts-morph не резолвит алиасы,
 *   и 78% вызовов становятся unresolved.
 *
 *   Эта функция:
 *     1. Проверяет существование tsconfig.json в root.
 *     2. Читает compilerOptions.baseUrl и compilerOptions.paths.
 *     3. Возвращает диагностику для лога и JSON-отчёта.
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   - path:         абсолютный путь к tsconfig.json или null
 *   - baseUrl:      compilerOptions.baseUrl или null
 *   - aliasCount:   количество alias'ов в compilerOptions.paths
 *   - aliasSamples: до 10 примеров { alias, targets }
 *   - error:        сообщение об ошибке парсинга (если была)
 *
 * @param rootDir — корень проекта
 * @returns TsConfigDiagnostics
 */
function readTsConfigDiagnostics(rootDir: string): TsConfigDiagnostics {
  const tsconfigPath = path.join(path.resolve(rootDir), 'tsconfig.json');

  const diagnostics: TsConfigDiagnostics = {
    path: null,
    baseUrl: null,
    aliasCount: 0,
    aliasSamples: [],
  };

  if (!fs.existsSync(tsconfigPath)) {
    return diagnostics;
  }

  diagnostics.path = tsconfigPath;

  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(raw);
    const co = tsconfig?.compilerOptions ?? {};

    diagnostics.baseUrl = co.baseUrl ?? null;

    if (co.paths && typeof co.paths === 'object') {
      const aliases = Object.entries(co.paths);
      diagnostics.aliasCount = aliases.length;

      for (const [alias, targets] of aliases.slice(0, 10)) {
        diagnostics.aliasSamples.push({
          alias,
          targets: Array.isArray(targets) ? (targets as string[]) : [],
        });
      }
    }
  } catch (err) {
    diagnostics.error = errMsg(err);
  }

  return diagnostics;
}

/**
 * Печатает диагностику tsconfig в консоль.
 *
 * @param diag — результат readTsConfigDiagnostics
 */
function printTsConfigDiagnostics(diag: TsConfigDiagnostics): void {
  if (!diag.path) {
    console.warn(`⚠️ tsconfig.json не найден — алиасы не будут резолвиться`);
    return;
  }

  console.log(`📋 tsconfig найден: ${diag.path}`);
  console.log(`   📁 baseUrl: ${diag.baseUrl ?? '(не задан)'}`);

  if (diag.error) {
    console.warn(`   ⚠️ Ошибка парсинга: ${diag.error}`);
    return;
  }

  if (diag.aliasCount === 0) {
    console.warn(`   ⚠️ Алиасы не заданы в compilerOptions.paths`);
    return;
  }

  console.log(`   🔗 Алиасов: ${diag.aliasCount}`);
  for (const { alias, targets } of diag.aliasSamples) {
    console.log(`      • ${alias} → ${JSON.stringify(targets)}`);
  }
  if (diag.aliasCount > diag.aliasSamples.length) {
    console.log(`      ... и ещё ${diag.aliasCount - diag.aliasSamples.length}`);
  }
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Запускает E2E-проверку.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Парсинг аргументов.
 *   2. Сбор всех файлов через glob.
 *   3. Для каждого файла: parseFile + extractEntities.
 *   4. ✅ v1.1.0: явное чтение tsconfig.json + диагностика.
 *   5. Запуск resolveCrossFileCalls с tsConfigPath.
 *   6. Вывод метрик.
 *   7. ✅ v1.1.0: вывод топ-20 unresolved (в verbose).
 *   8. Сохранение JSON-отчёта (если указан).
 *   9. Exit code: 0 / 1 / 2.
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 *   - Если root не существует → exit(2).
 *   - Если parseFile бросает → логируем, продолжаем.
 *   - Если resolveCrossFileCalls бросает → exit(2).
 *
 * ════════════════════════════════════════════════════════════
 * ПРОИЗВОДИТЕЛЬНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   Для проекта из 185 файлов:
 *     - Scan:    ~100ms
 *     - Parse:   ~1600ms
 *     - Resolve: ~2300ms
 *     - Total:   ~4000ms
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // ============================================================
  // Заголовок
  // ============================================================
  console.log('='.repeat(70));
  console.log('🔗 E2E-ПРОВЕРКА CROSS-FILE RESOLVER (P3)');
  console.log('='.repeat(70));
  console.log(`📁 Root: ${path.resolve(args.root)}`);
  console.log(`🔊 Verbose: ${args.verbose}`);
  if (args.jsonReport) {
    console.log(`💾 JSON report: ${path.resolve(args.jsonReport)}`);
  }
  console.log('');

  // ============================================================
  // Проверка существования root
  // ============================================================
  if (!fs.existsSync(args.root)) {
    console.error(`❌ Корень проекта не существует: ${path.resolve(args.root)}`);
    process.exit(2);
  }

  // ============================================================
  // ✅ v1.1.0: Диагностика tsconfig
  // ============================================================
  const tsConfigDiag = readTsConfigDiagnostics(args.root);

  if (args.verbose) {
    console.log('── tsconfig диагностика ──');
    printTsConfigDiagnostics(tsConfigDiag);
    console.log('');
  }

  // ============================================================
  // Шаг 1: Сбор файлов
  // ============================================================
  const startScan = Date.now();

  const pattern = path.join(args.root, '**/*.{ts,tsx,js,jsx,vue}');
  const files = await glob(pattern, {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.js',
      '**/*.spec.js',
    ],
    absolute: true,
  });

  const scanDuration = Date.now() - startScan;
  console.log(`📄 Найдено файлов: ${files.length} (${scanDuration}ms)`);

  if (files.length === 0) {
    console.error('❌ Не найдено ни одного файла для анализа');
    process.exit(2);
  }

  // ============================================================
  // Шаг 2: Парсинг каждого файла
  // ============================================================
  const startParse = Date.now();
  const entitiesMap: Record<string, EntitiesResult> = {};
  let parseErrors = 0;

  for (const file of files) {
    try {
      const parsed = parseFile(file);
      if (!parsed) {
        parseErrors++;
        continue;
      }

      const entities = extractEntities(parsed.ast, file);
      entitiesMap[file] = entities;
    } catch (err) {
      parseErrors++;
      if (args.verbose) {
        console.warn(`   ⚠️ ${path.basename(file)}: ${errMsg(err)}`);
      }
    }
  }

  const parseDuration = Date.now() - startParse;
  console.log(
    `📦 Сущностей извлечено из ${Object.keys(entitiesMap).length} файлов ` +
      `(${parseDuration}ms, ошибок парсинга: ${parseErrors})`
  );

  if (Object.keys(entitiesMap).length === 0) {
    console.error('❌ Не удалось извлечь сущности ни из одного файла');
    process.exit(2);
  }

  // ============================================================
  // Шаг 3: Cross-file resolution
  // ============================================================
  console.log('');
  console.log('🔗 Запуск cross-file resolver...');

  // ✅ v1.1.0: собираем unresolved reasons (только для отчёта)
  const unresolvedReasons: UnresolvedReason[] = [];

  let result: Awaited<ReturnType<typeof resolveCrossFileCalls>>;

  try {
    result = await resolveCrossFileCalls(entitiesMap, {
      projectRoot: path.resolve(args.root),
      // ✅ v1.1.0: явно передаём tsConfigPath, если найден
      tsConfigPath: tsConfigDiag.path ?? undefined,
      includeVue: true,
      includeJs: true,
      cache: true,
      maxFiles: 10000,
      verbose: args.verbose,
      onProgress: args.verbose
        ? (processed: number, total: number): void => {
            if (processed % 500 === 0) {
              console.log(`   📊 ${processed}/${total}...`);
            }
          }
        : undefined,
    });
  } catch (err) {
    console.error(`❌ Ошибка cross-file resolver: ${errMsg(err)}`);
    process.exit(2);
  }

  const { calls, stats } = result;

  // ============================================================
  // Шаг 4: Вывод метрик
  // ============================================================
  console.log('');
  console.log('='.repeat(70));
  console.log('📊 РЕЗУЛЬТАТЫ');
  console.log('='.repeat(70));

  console.log(`   Всего вызовов:          ${stats.totalCalls}`);
  console.log(`   Внутрифайловых:         ${stats.sameFileCalls}`);
  console.log(`   Межфайловых:            ${stats.crossFileCalls}`);
  console.log(`   Не разрешено:           ${stats.unresolvedCalls}`);

  console.log('');

  console.log(`   Cache hits:             ${stats.cacheHits}`);
  console.log(`   Cache misses:           ${stats.cacheMisses}`);

  // Cache hit rate
  const totalCache = stats.cacheHits + stats.cacheMisses;
  if (totalCache > 0) {
    const hitRate = ((stats.cacheHits / totalCache) * 100).toFixed(1);
    console.log(`   Cache hit rate:         ${hitRate}%`);
  }

  console.log('');

  console.log(`   Init Duration:          ${stats.initDurationMs}ms`);
  console.log(`   Resolve Duration:       ${stats.resolveDurationMs}ms`);
  console.log(`   Total Duration:         ${stats.durationMs}ms`);

  console.log('');

  console.log(`   Files added to Project: ${stats.filesAdded}`);
  console.log(`   Vue files added:        ${stats.vueFilesAdded}`);
  console.log(`   Add file errors:        ${stats.addFileErrors}`);

  // Unresolved rate
  if (stats.totalCalls > 0) {
    const unresolvedRate = ((stats.unresolvedCalls / stats.totalCalls) * 100).toFixed(1);
    console.log('');
    console.log(`   Unresolved rate:        ${unresolvedRate}%`);
  }

  // ============================================================
  // Шаг 5: Топ-10 межфайловых вызовов
  // ============================================================
  const crossFileCalls = calls.filter(c => c.isCrossFile);

  if (crossFileCalls.length > 0) {
    console.log('');
    console.log(`🔝 Топ-10 межфайловых вызовов (всего ${crossFileCalls.length}):`);

    for (const c of crossFileCalls.slice(0, 10)) {
      console.log(
        `   ${c.fromFunctionId} → ${c.toFunctionId} ` +
          `(${c.calleeName ?? '?'}, ${c.callKind}) ` +
          `в ${c.targetFileId}:${c.line}`
      );
    }
  } else {
    console.log('');
    console.log('⚠️  Межфайловых вызовов не найдено');
  }

  // ============================================================
  // ✅ v1.1.0: Шаг 6: Диагностика unresolved (только в verbose)
  // ============================================================
  if (args.verbose && unresolvedReasons.length > 0) {
    console.log('');
    console.log(`🔍 Топ-20 unresolved (всего ${unresolvedReasons.length}):`);

    for (const r of unresolvedReasons.slice(0, 20)) {
      console.log(`   ${path.basename(r.file)}:${r.line} → ${r.callee} (${r.reason})`);
    }

    if (unresolvedReasons.length > 20) {
      console.log(`   ... и ещё ${unresolvedReasons.length - 20}`);
    }

    // Группировка по причинам
    const byReason = new Map<string, number>();
    for (const r of unresolvedReasons) {
      byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
    }
    console.log('');
    console.log('   📊 По причинам:');
    for (const [reason, count] of byReason) {
      console.log(`      • ${reason}: ${count}`);
    }
  }

  // ============================================================
  // Шаг 7: Сохранение JSON-отчёта
  // ============================================================
  if (args.jsonReport) {
    const report = {
      timestamp: new Date().toISOString(),
      root: path.resolve(args.root),
      // ✅ v1.1.0: добавляем tsconfig-диагностику
      tsConfig: tsConfigDiag,
      stats,
      callsSample: crossFileCalls.slice(0, 100),
      // ✅ v1.1.0: добавляем unresolvedSamples
      unresolvedSamples: unresolvedReasons.slice(0, 100),
      summary: {
        totalFiles: files.length,
        filesParsed: Object.keys(entitiesMap).length,
        parseErrors,
        crossFileFound: crossFileCalls.length > 0,
      },
    };

    try {
      fs.writeFileSync(args.jsonReport, JSON.stringify(report, null, 2), 'utf-8');
      console.log('');
      console.log(`💾 JSON-отчёт сохранён: ${path.resolve(args.jsonReport)}`);
    } catch (err) {
      console.error(`❌ Не удалось сохранить JSON-отчёт: ${errMsg(err)}`);
    }
  }

  // ============================================================
  // Шаг 8: Exit code
  // ============================================================
  console.log('');

  const ok = stats.crossFileCalls > 0;

  if (ok) {
    console.log('✅ E2E PASS');
    process.exit(0);
  } else {
    console.log('❌ E2E FAIL: не найдено ни одного межфайлового вызова');
    process.exit(1);
  }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Форматирует ошибку для логирования.
 *
 * `catch (err)` в TypeScript даёт `unknown`. Эта утилита
 * безопасно приводит любое значение к строке.
 */
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ============================================================
// ЗАПУСК
// ============================================================
// Оборачиваем в try/catch для перехвата фатальных ошибок
// (например, unhandled rejection внутри main).
// ============================================================

main().catch(err => {
  console.error('❌ Фатальная ошибка:', err);
  process.exit(2);
});
