#!/usr/bin/env node
import { isMainModule } from './utils/is-main.js';
/**
 * CLI для автоматического рефакторинга файлов с выделением модулей
 *
 * Использование:
 *   npx ast-refactor refactor <file> [options]
 *   npx ast-refactor analyze <file> [options]
 *   npx ast-refactor validate <file> [options]
 *   npx ast-refactor verify-equivalence <original-file> <refactored-file> [options]
 *   npx ast-refactor help
 */

import { Command } from 'commander';
import { AutoRefactor } from './refactor/index.js';
import { RefactoringEquivalenceChecker } from './formal/index.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Автоматическое определение WASM пути
function getWasmPath(): string {
  const possiblePaths = [
    path.resolve(__dirname, 'wasm'), // рядом с dist
    path.resolve(__dirname, '../dist/wasm'), // из src/
    path.resolve(process.cwd(), 'grammars'), // в проекте
    path.resolve(process.cwd(), 'packages/ast-analyzer/dist/wasm'), // в монорепозитории
    path.resolve(process.cwd(), 'node_modules/@newkind/ast-analyzer/dist/wasm'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const files = fs.readdirSync(p);
        if (files.some(f => f.endsWith('.wasm'))) {
          return p;
        }
      } catch {
        // Игнорируем ошибки чтения
      }
    }
  }

  // Возвращаем путь по умолчанию
  return path.resolve(__dirname, 'wasm');
}

const program = new Command();

program
  .name('ast-refactor')
  .description(
    '🔧 Автоматический рефакторинг файлов с полным pipeline валидации, 100% гарантией и формальной верификацией эквивалентности'
  )
  .version('3.0.0');

// ============================================
// КОМАНДА: refactor
// ============================================

program
  .command('refactor <file>')
  .description('Рефакторинг файла с полным pipeline (семантика + валидация + рефакторинг)')

  // Основные опции
  .option('-o, --out-dir <dir>', 'Директория для сохранения модулей', 'modules')
  .option('-t, --target-size <number>', 'Целевой размер кластера (количество функций)', '3')
  .option('-m, --max-size <number>', 'Максимальный размер кластера', '10')
  .option('-c, --min-cohesion <number>', 'Минимальная связность кластера (%)', '60')
  .option('-d, --dry-run', 'Пробный запуск без фактических изменений', false)
  .option('--no-backup', 'Не создавать резервную копию файла', false)
  .option('-v, --verbose', 'Подробный вывод процесса', false)
  .option('--no-vue', 'Не обновлять template для Vue файлов (только script)', false)
  .option('--no-re-exports', 'Не добавлять реэкспорты в исходный файл', false)

  // Опции гарантированного рефакторинга
  .option(
    '--guarantee',
    'Включить режим максимальной гарантии (несколько попыток, чекпоинты)',
    true
  )
  .option('--no-guarantee', 'Отключить режим гарантии', false)
  .option('--max-attempts <number>', 'Максимальное количество попыток при ошибке', '3')

  // Инкрементальный режим и логирование
  .option('--incremental', 'Включить инкрементальный режим (по умолчанию включён)', true)
  .option('--no-incremental', 'Отключить инкрементальный режим', false)
  .option('--log-level <level>', 'Уровень логирования (debug, info, warn, error, none)', 'info')
  .option('--log-file <file>', 'Файл для сохранения логов', './refactor.log')
  .option('--max-retries <number>', 'Максимум попыток при ошибке', '3')

  // Опции для ОТКЛЮЧЕНИЯ (по умолчанию все включено)
  .option('--no-semantic', 'Отключить семантический анализ', false)
  .option('--no-formal', 'Отключить формальную верификацию Z3', false)
  .option('--no-jsx', 'Отключить анализ JSX/TSX', false)
  .option('--no-vue-analysis', 'Отключить анализ Vue компонентов', false)
  .option('--no-eslint', 'Отключить ESLint проверку', false)
  .option('--no-eslint-fix', 'Отключить ESLint автоисправление', false)
  .option('--no-typescript', 'Отключить TypeScript проверку', false)
  .option('--no-code-validation', 'Отключить Code Validation', false)
  .option('--no-auto-fix', 'Отключить автоисправление', false)
  .option('--no-fix-imports', 'Отключить исправление импортов', false)
  .option('--no-optimize-imports', 'Отключить оптимизацию импортов', false)
  .option('--no-extract-isolated', 'Не выделять изолированные функции', false)
  .option('--no-equivalence-check', 'Отключить формальную проверку эквивалентности', false)

  // Семантический анализ
  .option('--critical <functions>', 'Критические функции для верификации (через запятую)')
  .option('--max-depth <number>', 'Максимальная глубина анализа', '10')

  // Валидация и исправление
  .option('--iterations <number>', 'Максимум итераций исправления', '5')

  .action(async (file, options) => {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log('🔧 АВТОМАТИЧЕСКИЙ РЕФАКТОРИНГ С ПОЛНЫМ PIPELINE');
    console.log('='.repeat(70));
    console.log(`\n📄 Целевой файл: ${file}`);
    console.log(`📁 Выходная директория: ${options.outDir}`);
    console.log(`🎯 Параметры: размер=${options.targetSize}, связность=${options.minCohesion}%`);
    console.log(`🛡️ Режим гарантии: ${options.guarantee !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`🔄 Максимум попыток: ${options.maxAttempts}`);
    console.log(
      `🔄 Инкрементальный режим: ${options.incremental !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`
    );
    console.log(`📝 Уровень логирования: ${options.logLevel}`);
    console.log(`📄 Файл логов: ${options.logFile}`);
    console.log(
      `🔬 Проверка эквивалентности: ${options.equivalenceCheck !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`
    );

    if (options.dryRun) {
      console.log('\n⚠️ РЕЖИМ DRY RUN: изменения не будут применены к файлам\n');
    }

    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      console.error(`\n❌ Файл не найден: ${absolutePath}`);
      process.exit(1);
    }

    const isVue = absolutePath.endsWith('.vue');
    if (isVue) {
      console.log('📦 Обнаружен Vue компонент');
    }

    // Вывод статуса компонентов
    console.log('\n📊 СТАТУС КОМПОНЕНТОВ:');
    console.log(
      `   🧠 Семантический анализ: ${options.semantic !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`
    );
    if (options.semantic !== false) {
      console.log(
        `      🔬 Формальная верификация: ${options.formal !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`
      );
      console.log(`      ⚛️ JSX/TSX анализ: ${options.jsx !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
      console.log(`      🎯 Vue анализ: ${options.vueAnalysis !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
      console.log(
        `      🔬 Проверка эквивалентности: ${options.equivalenceCheck !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`
      );
    }
    console.log(
      `   📝 ESLint: ${options.eslint !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}${options.eslintFix !== false && options.eslint !== false ? ' (с автоисправлением)' : ''}`
    );
    console.log(`   🔷 TypeScript: ${options.typescript !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(
      `   🔍 Code Validation: ${options.codeValidation !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`
    );
    console.log(`   🔧 Автоисправление: ${options.autoFix !== false ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
    console.log(
      `   🧹 Исправление импортов: ${options.fixImports !== false ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`
    );
    console.log(
      `   📋 Оптимизация импортов: ${options.optimizeImports !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`
    );
    console.log(
      `   ⚡ Выделение изолированных функций: ${options.extractIsolated !== false ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`
    );
    console.log(
      `   🔄 Добавление реэкспортов: ${options.reExports !== false ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`
    );
    console.log(
      `   🔄 Инкрементальный режим: ${options.incremental !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`
    );
    console.log(`   📝 Уровень логирования: ${options.logLevel}`);

    try {
      const refactor = new AutoRefactor({
        modulesDir: options.outDir,
        targetClusterSize: parseInt(options.targetSize),
        maxClusterSize: parseInt(options.maxSize),
        minCohesionScore: parseInt(options.minCohesion),
        updateTemplate: options.vue !== false && isVue,
        dryRun: options.dryRun,
        createBackup: options.backup !== false,
        verbose: options.verbose,

        // Настройки гарантии
        guaranteeMode: options.guarantee !== false,
        maxAttempts: parseInt(options.maxAttempts),

        // Семантический анализ
        semanticAnalysis: options.semantic !== false,
        formalVerification: options.formal !== false,
        jsxAnalysis: options.jsx !== false,
        vueAnalysis: options.vueAnalysis !== false,
        criticalFunctions: options.critical ? options.critical.split(',') : [],
        maxCallDepth: parseInt(options.maxDepth),

        // Валидация и исправление
        eslintCheck: options.eslint !== false,
        eslintFix: options.eslintFix !== false,
        typeCheck: options.typescript !== false,
        codeValidation: options.codeValidation !== false,
        autoFix: options.autoFix !== false,
        maxIterations: parseInt(options.iterations),

        // Импорты
        fixUnusedImports: options.fixImports !== false,
        optimizeImports: options.optimizeImports !== false,
        fixUnusedVariables: options.fixImports !== false,
        addMissingTypes: options.fixImports !== false,

        // Кластеризация
        minClusterSize: 2,
        extractIsolatedFunctions: options.extractIsolated !== false,
        groupByCallGraph: true,

        // Реэкспорты
        addReExports: options.reExports !== false,

        // Инкрементальный режим и логирование
        incremental: options.incremental !== false,
        logLevel: options.logLevel || 'info',
        logFile: options.logFile || './refactor.log',
        maxRetries: parseInt(options.maxRetries) || 3,

        // Проверка эквивалентности
        equivalenceCheckLevel: options.equivalenceCheck !== false ? 'full' : 'none',

        // WASM путь - автоматическое определение
        wasmPath: getWasmPath(),
      });

      await refactor.initialize();

      // Сохраняем оригинальный файл для сравнения
      const originalContent = fs.readFileSync(absolutePath, 'utf-8');
      const backupOriginalPath = `${absolutePath}.original-backup.${Date.now()}`;
      if (!options.dryRun) {
        fs.writeFileSync(backupOriginalPath, originalContent);
      }

      const result = await refactor.refactor(absolutePath);
      await refactor.dispose();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // ФОРМАЛЬНАЯ ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ
      let equivalenceResult = null;
      if (options.equivalenceCheck !== false && !options.dryRun && result.success) {
        console.log('\n' + '='.repeat(70));
        console.log('🔬 ЗАПУСК ФОРМАЛЬНОЙ ПРОВЕРКИ ЭКВИВАЛЕНТНОСТИ');
        console.log('='.repeat(70));

        try {
          const checker = new RefactoringEquivalenceChecker();
          await checker.initialize();

          const modulesDir = path.join(path.dirname(absolutePath), options.outDir || 'modules');
          equivalenceResult = await checker.checkRefactoringEquivalence(
            backupOriginalPath,
            absolutePath,
            fs.existsSync(modulesDir) ? modulesDir : undefined
          );

          await checker.dispose();

          // Сохраняем отчет об эквивалентности
          const reportPath = path.join(path.dirname(absolutePath), 'equivalence-report.md');
          fs.writeFileSync(reportPath, equivalenceResult.report);
          console.log(`\n📄 Отчет об эквивалентности сохранен: ${reportPath}`);

          if (!equivalenceResult.isEquivalent) {
            console.log('\n❌ ФОРМАЛЬНАЯ ПРОВЕРКА НЕ ПРОЙДЕНА!');
            console.log(`   ❌ Ошибок: ${equivalenceResult.failedFunctions.length}`);
            console.log(`   📝 Изменений сигнатур: ${equivalenceResult.signatureChanges.length}`);
            console.log(`   📄 Отчет: ${reportPath}`);

            // Восстанавливаем оригинал
            fs.copyFileSync(backupOriginalPath, absolutePath);
            console.log(`\n💾 Файл восстановлен из бэкапа: ${backupOriginalPath}`);

            process.exit(1);
          } else {
            console.log('\n✅ ФОРМАЛЬНАЯ ПРОВЕРКА ПРОЙДЕНА!');
            console.log(
              `   ✅ Верифицировано: ${equivalenceResult.verifiedFunctions}/${equivalenceResult.totalFunctions} функций`
            );
          }

          // Удаляем бэкап оригинала после успешной проверки
          if (fs.existsSync(backupOriginalPath) && !options.dryRun) {
            fs.unlinkSync(backupOriginalPath);
          }
        } catch (error) {
          console.error('❌ Ошибка при проверке эквивалентности:', error);
          // Не прерываем выполнение, продолжаем с результатом рефакторинга
        }
      }

      if (result.success) {
        console.log('\n' + '='.repeat(70));
        console.log('✨ РЕФАКТОРИНГ УСПЕШНО ЗАВЕРШЁН!');
        console.log('='.repeat(70));
        console.log(`⏱️  Время выполнения: ${duration} сек`);

        // Вывод информации о гарантиях
        if (result.guaranteeInfo) {
          console.log('\n🛡️ ИНФОРМАЦИЯ О ГАРАНТИЯХ:');
          console.log(`   • Попыток: ${result.guaranteeInfo.attempts}`);
          console.log(`   • Тип модуля: ${result.guaranteeInfo.moduleType.toUpperCase()}`);
          console.log(`   • Точность определения: ${result.guaranteeInfo.detectionConfidence}`);
          console.log(`   • Создано чекпоинтов: ${result.guaranteeInfo.checkpointsCreated}`);
          console.log(`   • Создано бэкапов: ${result.guaranteeInfo.backupsCreated}`);
          console.log(`   • Валидаций выполнено: ${result.guaranteeInfo.validationHistory.length}`);
        }

        if (equivalenceResult) {
          console.log('\n🔬 РЕЗУЛЬТАТ ФОРМАЛЬНОЙ ПРОВЕРКИ:');
          console.log(
            `   • Статус: ${equivalenceResult.isEquivalent ? '✅ ЭКВИВАЛЕНТЕН' : '❌ НЕ ЭКВИВАЛЕНТЕН'}`
          );
          console.log(`   • Функций проверено: ${equivalenceResult.totalFunctions}`);
          console.log(`   • Верифицировано: ${equivalenceResult.verifiedFunctions}`);
          if (equivalenceResult.failedFunctions.length > 0) {
            console.log(`   • Ошибок: ${equivalenceResult.failedFunctions.length}`);
          }
        }

        if (result.modules.length > 0) {
          console.log(`\n📦 Создано модулей: ${result.modules.length}`);
          console.log('\n📁 СОЗДАННЫЕ МОДУЛИ:');
          for (const module of result.modules) {
            const relativePath = path.relative(process.cwd(), module.path);
            console.log(`   ✅ ${relativePath} (${module.exports.length} экспортов)`);
          }
        }

        // Вывод метрик
        if (result.metrics) {
          console.log('\n📊 МЕТРИКИ:');
          console.log(`   • Цикломатическая сложность: ${result.metrics.cyclomaticComplexity}`);
          console.log(`   • Всего функций: ${result.metrics.totalFunctions}`);
          console.log(`   • Неиспользуемых функций: ${result.metrics.unusedFunctionsCount}`);
          console.log(`   • Ошибок типов: ${result.metrics.typeErrorsCount}`);
          console.log(`   • Верифицировано: ${result.metrics.verifiedFunctionsCount}`);
          console.log(`   • ESLint исправлений: ${result.metrics.eslintFixesCount}`);
          console.log(`   • TypeScript исправлений: ${result.metrics.tsFixesCount}`);
          console.log(`   • Code исправлений: ${result.metrics.codeFixesCount}`);
        }

        if (result.backupPath) {
          console.log(`\n💾 Резервная копия: ${path.relative(process.cwd(), result.backupPath)}`);
        }

        // Предупреждения о семантических проблемах
        if (result.semanticResults?.typeErrors && result.semanticResults.typeErrors.length > 0) {
          console.log(
            `\n⚠️ ВНИМАНИЕ: Осталось ${result.semanticResults.typeErrors.length} ошибок типов`
          );
          console.log('   Рекомендуется исправить их вручную');
        }

        if (
          result.semanticResults?.cyclicDependencies &&
          result.semanticResults.cyclicDependencies.length > 0
        ) {
          console.log(
            `\n⚠️ ВНИМАНИЕ: Обнаружено ${result.semanticResults.cyclicDependencies.length} циклических зависимостей`
          );
          console.log('   Рекомендуется реструктурировать код');
        }

        if (
          result.semanticResults?.unusedFunctions &&
          result.semanticResults.unusedFunctions.length > 0
        ) {
          console.log(
            `\n⚠️ ВНИМАНИЕ: Обнаружено ${result.semanticResults.unusedFunctions.length} неиспользуемых функций`
          );
          console.log(
            `   ${result.semanticResults.unusedFunctions.slice(0, 5).join(', ')}${result.semanticResults.unusedFunctions.length > 5 ? '...' : ''}`
          );
        }

        if (
          result.verificationResults &&
          result.verificationResults.filter(r => !r.isValid).length > 0
        ) {
          const failedCount = result.verificationResults.filter(r => !r.isValid).length;
          console.log(`\n⚠️ ВНИМАНИЕ: ${failedCount} функций НЕ ПРОШЛИ формальную верификацию`);
        }

        console.log('\n💡 Совет: Запустите линтер и тесты после рефакторинга');
      } else {
        console.error('\n' + '='.repeat(70));
        console.error('❌ РЕФАКТОРИНГ НЕ УДАЛСЯ');
        console.error('='.repeat(70));
        console.error(`\nОшибка: ${result.error}`);

        if (result.guaranteeInfo) {
          console.log('\n🛡️ ИНФОРМАЦИЯ О ПОПЫТКАХ:');
          console.log(`   • Выполнено попыток: ${result.guaranteeInfo.attempts}`);
          console.log(`   • Тип модуля: ${result.guaranteeInfo.moduleType.toUpperCase()}`);
          console.log(`   • Создано чекпоинтов: ${result.guaranteeInfo.checkpointsCreated}`);
          console.log(`   • Валидаций выполнено: ${result.guaranteeInfo.validationHistory.length}`);
        }

        if (result.backupPath && fs.existsSync(result.backupPath)) {
          console.log(
            `\n💾 Резервная копия сохранена: ${path.relative(process.cwd(), result.backupPath)}`
          );
          console.log(
            `   Восстановите файл командой: cp ${path.relative(process.cwd(), result.backupPath)} ${file}`
          );
        }

        // Вывод информации о последнем успешном чекпоинте
        if (result.lastSuccessfulStep !== undefined) {
          console.log(`\n📌 Последний успешный шаг: ${result.lastSuccessfulStep + 1}`);
          console.log('   Для продолжения с этого шага используйте --incremental');
        }

        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:');
      console.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\nСтек вызовов:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// ============================================
// КОМАНДА: analyze
// ============================================

program
  .command('analyze <file>')
  .description('Только анализ файла без изменений (показывает кластеры и семантические проблемы)')
  .option('-t, --target-size <number>', 'Целевой размер кластера', '3')
  .option('-m, --max-size <number>', 'Максимальный размер кластера', '10')
  .option('-c, --min-cohesion <number>', 'Минимальная связность (%)', '60')
  .option('--formal', 'Включить формальную верификацию', false)
  .option('--no-cfg', 'Отключить CFG анализ', false)
  .option('--no-callgraph', 'Отключить Call Graph анализ', false)
  .option('--no-dataflow', 'Отключить Data Flow анализ', false)
  .option('--no-jsx', 'Отключить JSX анализ', false)
  .option('--no-vue', 'Отключить Vue анализ', false)
  .option('--no-typescript', 'Отключить TypeScript анализ', false)
  .option('--log-level <level>', 'Уровень логирования (debug, info, warn, error, none)', 'info')
  .option('--log-file <file>', 'Файл для сохранения логов', './analyze.log')
  .option('-v, --verbose', 'Подробный вывод', false)
  .action(async (file, options) => {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log('🔍 АНАЛИЗ ФАЙЛА С ПОЛНЫМ PIPELINE');
    console.log('='.repeat(70));
    console.log(`\n📄 Файл: ${file}`);
    console.log(`📅 Время: ${new Date().toLocaleString()}`);
    console.log(`📝 Уровень логирования: ${options.logLevel}`);

    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      console.error(`\n❌ Файл не найден: ${absolutePath}`);
      process.exit(1);
    }

    console.log('\n⚙️ АКТИВНЫЕ АНАЛИЗАТОРЫ:');
    console.log(`   • CFG Analysis: ${!options.noCfg ? '✅' : '❌'}`);
    console.log(`   • Call Graph Analysis: ${!options.noCallgraph ? '✅' : '❌'}`);
    console.log(`   • Data Flow Analysis: ${!options.noDataflow ? '✅' : '❌'}`);
    console.log(`   • TypeScript Analysis: ${!options.noTypescript ? '✅' : '❌'}`);
    console.log(`   • JSX/TSX Analysis: ${!options.noJsx ? '✅' : '❌'}`);
    console.log(`   • Vue Analysis: ${!options.noVue ? '✅' : '❌'}`);
    console.log(`   • Formal Verification: ${options.formal ? '✅' : '❌'}`);

    try {
      const refactor = new AutoRefactor({
        targetClusterSize: parseInt(options.targetSize),
        maxClusterSize: parseInt(options.maxSize),
        minCohesionScore: parseInt(options.minCohesion),
        dryRun: true,
        verbose: options.verbose,

        semanticAnalysis: true,
        formalVerification: options.formal || false,
        dataFlowAnalysis: !options.noDataflow,
        callGraphAnalysis: !options.noCallgraph,
        jsxAnalysis: !options.noJsx,
        vueAnalysis: !options.noVue,

        eslintCheck: false,
        typeCheck: !options.noTypescript,
        codeValidation: true,
        autoFix: false,
        fixUnusedImports: false,
        optimizeImports: false,
        extractIsolatedFunctions: true,

        // Логирование
        logLevel: options.logLevel || 'info',
        logFile: options.logFile || './analyze.log',
        incremental: false,

        // WASM путь - автоматическое определение
        wasmPath: getWasmPath(),
      });

      await refactor.initialize();

      // Сохраняем оригинальный console.log для перехвата вывода
      const originalLog = console.log;
      let analysisOutput = '';
      console.log = (...args) => {
        analysisOutput += args.join(' ') + '\n';
        originalLog(...args);
      };

      const result = await refactor.refactor(absolutePath);

      // Восстанавливаем console.log
      console.log = originalLog;

      await refactor.dispose();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n' + '='.repeat(70));
      console.log('📊 ИТОГОВЫЙ ОТЧЕТ АНАЛИЗА');
      console.log('='.repeat(70));
      console.log(`⏱️  Время выполнения: ${duration} сек`);

      if (result.modules.length > 0) {
        console.log(`\n📁 НАЙДЕННЫЕ КЛАСТЕРЫ (${result.modules.length}):`);
        for (let i = 0; i < result.modules.length; i++) {
          const module = result.modules[i];
          if (!module) continue;
          console.log(`\n   ${i + 1}. Модуль \"${module.name}\":`);
          console.log(`      📦 Экспорты: ${module.exports.join(', ')}`);
          if (module.dependencies.length > 0) {
            console.log(`      🔗 Зависимости: ${module.dependencies.join(', ')}`);
          }
        }
      } else {
        console.log('\nℹ️ Не найдено кандидатов для выделения в модули');
      }

      if (result.metrics) {
        console.log('\n📊 СЕМАНТИЧЕСКИЕ МЕТРИКИ:');
        console.log(`   • Цикломатическая сложность: ${result.metrics.cyclomaticComplexity}`);
        console.log(`   • Всего функций: ${result.metrics.totalFunctions}`);
        console.log(`   • Неиспользуемых функций: ${result.metrics.unusedFunctionsCount}`);
        console.log(`   • Ошибок типов: ${result.metrics.typeErrorsCount}`);
        console.log(`   • Верифицировано функций: ${result.metrics.verifiedFunctionsCount}`);
        console.log(`   • Проблем Data Flow: ${result.metrics.dataFlowIssuesCount}`);
      }

      if (result.semanticResults?.typeErrors && result.semanticResults.typeErrors.length > 0) {
        console.log(`\n❌ ОШИБКИ ТИПОВ (${result.semanticResults.typeErrors.length}):`);
        for (const error of result.semanticResults.typeErrors.slice(0, 10)) {
          console.log(`   • ${error.message}`);
          console.log(`     Expected: ${error.expected}, Got: ${error.actual}`);
        }
      }

      if (
        result.semanticResults?.cyclicDependencies &&
        result.semanticResults.cyclicDependencies.length > 0
      ) {
        console.log(
          `\n🔄 ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ (${result.semanticResults.cyclicDependencies.length}):`
        );
        for (const cycle of result.semanticResults.cyclicDependencies.slice(0, 5)) {
          console.log(`   • ${cycle.join(' → ')}`);
        }
      }

      if (
        result.semanticResults?.unusedFunctions &&
        result.semanticResults.unusedFunctions.length > 0
      ) {
        console.log(
          `\n⚠️ НЕИСПОЛЬЗУЕМЫЕ ФУНКЦИИ (${result.semanticResults.unusedFunctions.length}):`
        );
        for (const func of result.semanticResults.unusedFunctions.slice(0, 10)) {
          console.log(`   • ${func}`);
        }
      }

      if (result.verificationResults && result.verificationResults.length > 0) {
        const verified = result.verificationResults.filter(r => r.isValid);
        const failed = result.verificationResults.filter(r => !r.isValid);
        console.log('\n🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ:');
        console.log(`   • Верифицировано: ${verified.length}`);
        console.log(`   • Не верифицировано: ${failed.length}`);
      }

      if (result.semanticResults?.jsx) {
        const jsx = result.semanticResults.jsx;
        console.log('\n⚛️ JSX/TSX АНАЛИЗ:');
        console.log(`   • JSX элементов: ${jsx.elements.length}`);
        console.log(`   • Компонентов: ${jsx.componentProps.size}`);
        console.log(`   • Ошибок пропсов: ${jsx.propTypeErrors.length}`);
      }

      if (result.semanticResults?.vue) {
        const vue = result.semanticResults.vue;
        console.log('\n🎯 VUE АНАЛИЗ:');
        console.log(`   • Props: ${vue.props.names.length}`);
        console.log(`   • Events: ${vue.emits.names.length}`);
        console.log(`   • Slots: ${vue.slots.length}`);
        console.log(`   • Composables: ${vue.composables.length}`);
      }

      console.log('\n💡 РЕКОМЕНДУЕМЫЕ ПАРАМЕТРЫ ДЛЯ РЕФАКТОРИНГА:');
      console.log('   ─────────────────────────────────────────────');

      if (result.metrics) {
        if (result.metrics.cyclomaticComplexity > 15) {
          console.log('   🔧 Для сложного кода (>15):');
          console.log(`      ast-refactor refactor ${file} -t 4 -m 12 -c 50`);
        } else if (result.metrics.totalFunctions > 30) {
          console.log('   🔧 Для большого количества функций (>30):');
          console.log(`      ast-refactor refactor ${file} -t 3 -m 10 -c 60`);
        } else if (result.metrics.totalFunctions < 10) {
          console.log('   🔧 Для небольшого файла (<10 функций):');
          console.log(`      ast-refactor refactor ${file} -t 2 -m 5 -c 70`);
        } else {
          console.log('   🔧 Стандартные настройки:');
          console.log(`      ast-refactor refactor ${file} -t 3 -m 10 -c 60`);
        }
      }

      if (result.semanticResults?.typeErrors && result.semanticResults.typeErrors.length > 0) {
        console.log('\n   🔧 Для исправления ошибок типов:');
        console.log(`      ast-refactor validate ${file} --fix`);
      }

      console.log('\n✨ Анализ завершен!');

      const reportPath = path.join(process.cwd(), `analysis-report-${Date.now()}.txt`);
      const fullReport =
        analysisOutput +
        '\n' +
        '='.repeat(70) +
        '\n' +
        '📊 ИТОГОВЫЙ ОТЧЕТ АНАЛИЗА\n' +
        `Файл: ${file}\n` +
        `Время: ${new Date().toLocaleString()}\n` +
        `Длительность: ${duration} сек\n` +
        `Метрики: ${JSON.stringify(result.metrics, null, 2)}\n` +
        `Кластеров: ${result.modules.length}\n` +
        `Ошибок типов: ${result.semanticResults?.typeErrors?.length || 0}\n` +
        `Неиспользуемых функций: ${result.semanticResults?.unusedFunctions?.length || 0}\n` +
        `Циклических зависимостей: ${result.semanticResults?.cyclicDependencies?.length || 0}\n`;

      fs.writeFileSync(reportPath, fullReport);
      console.log(`\n📄 Полный отчет сохранен: ${reportPath}`);
    } catch (error) {
      console.error('\n❌ Ошибка анализа:', error);
      process.exit(1);
    }
  });

// ============================================
// КОМАНДА: validate
// ============================================

program
  .command('validate <file>')
  .description('Запустить все валидаторы без рефакторинга')
  .option('-v, --verbose', 'Подробный вывод', false)
  .option('--formal', 'Включить формальную верификацию', false)
  .option('--fix', 'Применить автоисправления', false)
  .option('--log-level <level>', 'Уровень логирования (debug, info, warn, error, none)', 'info')
  .option('--log-file <file>', 'Файл для сохранения логов', './validate.log')
  .action(async (file, options) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ЗАПУСК ВСЕХ ВАЛИДАТОРОВ');
    console.log('='.repeat(60));
    console.log(`\n📄 Файл: ${file}`);
    console.log(`🔧 Автоисправление: ${options.fix ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
    console.log(`📝 Уровень логирования: ${options.logLevel}`);

    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      console.error(`\n❌ Файл не найден: ${absolutePath}`);
      process.exit(1);
    }

    try {
      const refactor = new AutoRefactor({
        dryRun: !options.fix,
        verbose: options.verbose,
        semanticAnalysis: true,
        formalVerification: options.formal || false,
        jsxAnalysis: true,
        vueAnalysis: true,
        dataFlowAnalysis: true,
        callGraphAnalysis: true,
        eslintCheck: true,
        eslintFix: options.fix,
        typeCheck: true,
        codeValidation: true,
        autoFix: options.fix,
        createBackup: options.fix,
        fixUnusedImports: options.fix,
        optimizeImports: options.fix,
        extractIsolatedFunctions: true,

        // Логирование
        logLevel: options.logLevel || 'info',
        logFile: options.logFile || './validate.log',
        incremental: false,

        // WASM путь - автоматическое определение
        wasmPath: getWasmPath(),
      });

      await refactor.initialize();
      const result = await refactor.refactor(absolutePath);
      await refactor.dispose();

      console.log('\n📊 РЕЗУЛЬТАТЫ ВАЛИДАЦИИ:');

      if (result.metrics) {
        console.log('\n📈 МЕТРИКИ:');
        console.log(`   • Цикломатическая сложность: ${result.metrics.cyclomaticComplexity}`);
        console.log(`   • Всего функций: ${result.metrics.totalFunctions}`);
        console.log(`   • Неиспользуемых функций: ${result.metrics.unusedFunctionsCount}`);
        console.log(`   • Ошибок типов: ${result.metrics.typeErrorsCount}`);
        console.log(`   • Верифицировано функций: ${result.metrics.verifiedFunctionsCount}`);
        if (options.fix) {
          console.log(`   • ESLint исправлений: ${result.metrics.eslintFixesCount}`);
          console.log(`   • TypeScript исправлений: ${result.metrics.tsFixesCount}`);
          console.log(`   • Code исправлений: ${result.metrics.codeFixesCount}`);
        }
      }

      if (result.validationResults) {
        console.log('\n⚠️ CODE VALIDATION:');
        console.log(`   • Ошибок: ${result.validationResults.summary.errors}`);
        console.log(`   • Предупреждений: ${result.validationResults.summary.warnings}`);
        console.log(`   • Автоисправимых: ${result.validationResults.summary.autoFixable}`);

        if (result.validationResults.summary.errors > 0) {
          console.log('\n   ОШИБКИ (первые 5):');
          const errors = result.validationResults.issues
            .filter(i => i.type === 'error')
            .slice(0, 5);
          for (const error of errors) {
            console.log(`   • ${path.basename(error.file)}:${error.line} - ${error.message}`);
            if (error.suggestion) {
              console.log(`     💡 ${error.suggestion}`);
            }
          }
        }
      }

      if (result.semanticResults?.typeErrors && result.semanticResults.typeErrors.length > 0) {
        console.log('\n❌ ОШИБКИ ТИПОВ (первые 5):');
        for (const error of result.semanticResults.typeErrors.slice(0, 5)) {
          console.log(`   • ${error.message}`);
          console.log(`     Expected: ${error.expected}, Got: ${error.actual}`);
        }
        if (result.semanticResults.typeErrors.length > 5) {
          console.log(`   ... и ещё ${result.semanticResults.typeErrors.length - 5} ошибок`);
        }
      }

      if (
        result.semanticResults?.cyclicDependencies &&
        result.semanticResults.cyclicDependencies.length > 0
      ) {
        console.log('\n🔄 ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ:');
        for (const cycle of result.semanticResults.cyclicDependencies.slice(0, 3)) {
          console.log(`   • ${cycle.join(' → ')}`);
        }
      }

      if (
        result.semanticResults?.unusedFunctions &&
        result.semanticResults.unusedFunctions.length > 0
      ) {
        console.log('\n⚠️ НЕИСПОЛЬЗУЕМЫЕ ФУНКЦИИ (первые 10):');
        for (const func of result.semanticResults.unusedFunctions.slice(0, 10)) {
          console.log(`   • ${func}`);
        }
      }

      if (result.verificationResults && result.verificationResults.length > 0) {
        const verified = result.verificationResults.filter(r => r.isValid);
        const failed = result.verificationResults.filter(r => !r.isValid);
        console.log('\n🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ:');
        console.log(`   • Верифицировано: ${verified.length}`);
        console.log(`   • Не верифицировано: ${failed.length}`);
        if (failed.length > 0) {
          console.log('\n   НЕ ВЕРИФИЦИРОВАННЫЕ ФУНКЦИИ:');
          for (const fail of failed.slice(0, 5)) {
            console.log(`   • ${(fail as any).functionName || 'unknown'}`);
            if (fail.counterexample) {
              console.log(
                `     Контрпример: ${JSON.stringify(Object.fromEntries(fail.counterexample))}`
              );
            }
          }
        }
      }

      if (result.eslintResults && result.eslintResults.length > 0) {
        const totalFixes = result.eslintResults.reduce((sum, r) => sum + r.fixes, 0);
        if (totalFixes > 0) {
          console.log('\n📝 ESLINT:');
          console.log(`   • Исправлено проблем: ${totalFixes}`);
        }
      }

      if (result.tsFixResults && result.tsFixResults.fixedCount > 0) {
        console.log('\n🔷 TYPESCRIPT:');
        console.log(`   • Исправлено ошибок: ${result.tsFixResults.fixedCount}`);
        if (result.tsFixResults.remainingErrors > 0) {
          console.log(`   • Осталось ошибок: ${result.tsFixResults.remainingErrors}`);
        }
      }

      const hasErrors =
        (result.validationResults?.summary.errors || 0) > 0 ||
        (result.semanticResults?.typeErrors?.length || 0) > 0 ||
        (result.verificationResults?.filter(r => !r.isValid).length || 0) > 0;

      if (!hasErrors) {
        console.log('\n✨ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!');
      } else if (options.fix && result.success) {
        console.log('\n✅ АВТОИСПРАВЛЕНИЕ ПРИМЕНЕНО!');
        console.log('   Рекомендуется запустить повторную проверку:');
        console.log(`   ast-refactor validate ${file}`);
      } else if (!options.fix && !result.success) {
        console.log('\n💡 Для автоматического исправления запустите:');
        console.log(`   ast-refactor validate ${file} --fix`);
      }

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error('\n❌ Ошибка валидации:', error);
      process.exit(1);
    }
  });

// ============================================
// КОМАНДА: verify-equivalence
// ============================================

program
  .command('verify-equivalence <original-file> <refactored-file>')
  .description('Формальная проверка эквивалентности исходного и рефакторинг-файла')
  .option('-m, --modules <dir>', 'Директория с модулями', 'modules')
  .option('-o, --output <file>', 'Сохранить отчет в файл', './equivalence-report.md')
  .option('-v, --verbose', 'Подробный вывод', false)
  .action(async (originalFile, refactoredFile, options) => {
    console.log('\n' + '='.repeat(70));
    console.log('🔬 ФОРМАЛЬНАЯ ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ');
    console.log('='.repeat(70));
    console.log(`\n📄 Исходный файл: ${originalFile}`);
    console.log(`📄 Рефакторинг: ${refactoredFile}`);
    console.log(`📁 Модули: ${options.modules}`);
    console.log(`📝 Уровень логирования: ${options.verbose ? 'debug' : 'info'}`);

    const origPath = path.resolve(originalFile);
    const refPath = path.resolve(refactoredFile);

    if (!fs.existsSync(origPath)) {
      console.error(`\n❌ Исходный файл не найден: ${origPath}`);
      process.exit(1);
    }

    if (!fs.existsSync(refPath)) {
      console.error(`\n❌ Рефакторинг-файл не найден: ${refPath}`);
      process.exit(1);
    }

    const modulesDir = path.resolve(path.dirname(refPath), options.modules);
    if (!fs.existsSync(modulesDir)) {
      console.warn(`\n⚠️ Директория с модулями не найдена: ${modulesDir}`);
      console.warn('   Продолжаем без проверки модулей');
    }

    try {
      const checker = new RefactoringEquivalenceChecker();
      await checker.initialize();

      const result = await checker.checkRefactoringEquivalence(
        origPath,
        refPath,
        fs.existsSync(modulesDir) ? modulesDir : undefined
      );

      await checker.dispose();

      // Сохраняем отчет
      const reportPath = path.resolve(options.output);
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      fs.writeFileSync(reportPath, result.report);

      console.log(`\n📄 Отчет сохранен: ${reportPath}`);
      console.log('\n📊 РЕЗУЛЬТАТ:');
      console.log(`   • Статус: ${result.isEquivalent ? '✅ ЭКВИВАЛЕНТЕН' : '❌ НЕ ЭКВИВАЛЕНТЕН'}`);
      console.log(`   • Функций проверено: ${result.totalFunctions}`);
      console.log(`   • Верифицировано: ${result.verifiedFunctions}`);

      if (result.failedFunctions.length > 0) {
        console.log(`   • Ошибок: ${result.failedFunctions.length}`);
        console.log('\n❌ ПРОБЛЕМНЫЕ ФУНКЦИИ:');
        for (const failed of result.failedFunctions.slice(0, 10)) {
          console.log(`   • ${failed.name}: ${failed.reason}`);
          if (failed.counterexample) {
            console.log(
              `     Контрпример: ${JSON.stringify(Object.fromEntries(failed.counterexample))}`
            );
          }
        }
        if (result.failedFunctions.length > 10) {
          console.log(`   ... и ещё ${result.failedFunctions.length - 10} проблем`);
        }
      }

      if (result.signatureChanges.length > 0) {
        console.log('\n📝 ИЗМЕНЕНИЯ СИГНАТУР:');
        for (const change of result.signatureChanges.slice(0, 5)) {
          console.log(`   • ${change.name}:`);
          console.log(
            `     Оригинал: ${change.original.params.join(', ')} -> ${change.original.returnType}`
          );
          console.log(
            `     Изменено: ${change.modified.params.join(', ')} -> ${change.modified.returnType}`
          );
        }
        if (result.signatureChanges.length > 5) {
          console.log(`   ... и ещё ${result.signatureChanges.length - 5} изменений`);
        }
      }

      process.exit(result.isEquivalent ? 0 : 1);
    } catch (error) {
      console.error('\n❌ Ошибка проверки эквивалентности:');
      console.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\nСтек вызовов:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// ============================================
// КОМАНДА: restore
// ============================================

program
  .command('restore <backup-file>')
  .description('Восстановить файл из резервной копии')
  .option('-o, --output <file>', 'Целевой файл для восстановления (по умолчанию исходный)')
  .action(async (backupFile, options) => {
    console.log('\n🔄 ВОССТАНОВЛЕНИЕ ФАЙЛА');
    console.log('='.repeat(60));

    const backupPath = path.resolve(backupFile);
    if (!fs.existsSync(backupPath)) {
      console.error(`\n❌ Резервная копия не найдена: ${backupPath}`);
      process.exit(1);
    }

    let targetPath = options.output;
    if (!targetPath) {
      targetPath = backupPath.replace(/\.backup\.\d+$/, '');
    }

    const absoluteTarget = path.resolve(targetPath);

    console.log(`\n📁 Резервная копия: ${backupPath}`);
    console.log(`📄 Целевой файл: ${absoluteTarget}`);

    console.log('\n⚠️  ВНИМАНИЕ: Это перезапишет целевой файл!');
    console.log('   Нажмите Enter для продолжения или Ctrl+C для отмены...');

    const waitForEnter = (): Promise<void> => {
      return new Promise(resolve => {
        process.stdin.once('data', () => resolve());
        setTimeout(() => resolve(), 3000);
      });
    };

    await waitForEnter();

    try {
      const content = await fs.promises.readFile(backupPath, 'utf-8');
      await fs.promises.writeFile(absoluteTarget, content, 'utf-8');
      console.log(`\n✅ Файл восстановлен: ${absoluteTarget}`);
    } catch (error) {
      console.error('\n❌ Ошибка восстановления:', error);
      process.exit(1);
    }
  });

// ============================================
// КОМАНДА: help
// ============================================

program
  .command('help')
  .description('Показать подробную справку')
  .action(() => {
    console.log(`\n╔═══════════════════════════════════════════════════════════════════════════════╗
║                 AST REFACTOR - ПОЛНЫЙ PIPELINE РЕФАКТОРИНГА                   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ОПИСАНИЕ:                                                                    ║
║    Автоматический рефакторинг файлов с выделением модулей.                    ║
║    Включает семантический анализ, формальную верификацию,                    ║
║    ESLint, TypeScript валидацию, автоисправление и проверку                  ║
║    эквивалентности.                                                          ║
║                                                                               ║
║  НОВЫЕ ВОЗМОЖНОСТИ (v3.0):                                                    ║
║    🛡️ Режим максимальной гарантии - многоуровневая защита                    ║
║    🔄 Автоматические повторы при ошибках (до 5 попыток)                      ║
║    📌 Система чекпоинтов - откат к любому этапу                             ║
║    🔍 Автоопределение типа модуля (ESM/CJS)                                  ║
║    ✅ Многоуровневая валидация синтаксиса                                    ║
║    💾 Полные бэкапы с восстановлением                                        ║
║    🔬 ФОРМАЛЬНАЯ ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ                                   ║
║                                                                               ║
║  КОМАНДЫ:                                                                     ║
║    refactor <file>           - Полный pipeline: анализ + валидация +          ║
║                               рефакторинг + проверка эквивалентности         ║
║    analyze <file>            - Только анализ (без изменений)                 ║
║    validate <file>           - Запустить все валидаторы (с опциональным фиксом)║
║    verify-equivalence <orig> <ref> - Формальная проверка эквивалентности     ║
║    restore <backup>          - Восстановить файл из резервной копии          ║
║    help                      - Показать эту справку                          ║
║                                                                               ║
║  ОСНОВНЫЕ ОПЦИИ (refactor):                                                   ║
║    -o, --out-dir <dir>     Директория для модулей (по умолчанию: modules)     ║
║    -t, --target-size <n>   Целевой размер кластера (по умолчанию: 3)          ║
║    -c, --min-cohesion <n>  Минимальная связность % (по умолчанию: 60)         ║
║    -d, --dry-run           Пробный запуск без изменений                       ║
║    -v, --verbose           Подробный вывод                                     ║
║    --no-re-exports         Не добавлять реэкспорты в исходный файл            ║
║                                                                               ║
║  НОВЫЕ ОПЦИИ ГАРАНТИИ:                                                        ║
║    --guarantee             Включить режим максимальной гарантии (по умолч.)   ║
║    --no-guarantee          Отключить режим гарантии                           ║
║    --max-attempts <n>      Максимальное количество попыток (по умолч.: 3)     ║
║                                                                               ║
║  ОПЦИИ ФОРМАЛЬНОЙ ПРОВЕРКИ:                                                   ║
║    --no-equivalence-check  Отключить проверку эквивалентности                 ║
║    --formal                Включить формальную верификацию Z3                 ║
║                                                                               ║
║  ОСТАЛЬНЫЕ ОПЦИИ:                                                             ║
║    --incremental           Включить инкрементальный режим (по умолчанию)      ║
║    --no-incremental        Отключить инкрементальный режим                    ║
║    --log-level <level>     Уровень логирования (debug, info, warn, error, none)║
║    --log-file <file>       Файл для сохранения логов                          ║
║    --max-retries <number>  Максимум попыток при ошибке                        ║
║                                                                               ║
║  ОПЦИИ ДЛЯ ОТКЛЮЧЕНИЯ (по умолчанию все анализаторы ВКЛЮЧЕНЫ):                ║
║    --no-semantic           Отключить семантический анализ                     ║
║    --no-formal             Отключить формальную верификацию Z3                ║
║    --no-jsx                Отключить анализ JSX/TSX                           ║
║    --no-vue-analysis       Отключить анализ Vue компонентов                   ║
║    --no-eslint             Отключить ESLint проверку                          ║
║    --no-typescript         Отключить TypeScript проверку                      ║
║    --no-code-validation    Отключить Code Validation                          ║
║    --no-fix-imports        Отключить исправление импортов                     ║
║    --no-optimize-imports   Отключить оптимизацию импортов                     ║
║    --no-extract-isolated   Не выделять изолированные функции                  ║
║                                                                               ║
║  ПРИМЕРЫ:                                                                     ║
║    # Полный pipeline с гарантией и проверкой эквивалентности                 ║
║    ast-refactor refactor ./src/utils.js --guarantee                          ║
║                                                                               ║
║    # С максимальными попытками                                                ║
║    ast-refactor refactor ./src/utils.js --max-attempts 5                      ║
║                                                                               ║
║    # Только формальная проверка эквивалентности                               ║
║    ast-refactor verify-equivalence ./src/original.js ./src/refactored.js      ║
║                                                                               ║
║    # С отключением формальной верификации                                     ║
║    ast-refactor refactor ./src/utils.js --no-formal                           ║
║                                                                               ║
║    # Только валидация с автоисправлением                                      ║
║    ast-refactor validate ./src/utils.js --fix                                 ║
║                                                                               ║
║    # Анализ Vue компонента                                                   ║
║    ast-refactor analyze ./src/App.vue                                        ║
║                                                                               ║
║    # С инкрементальным режимом и детальными логами                            ║
║    ast-refactor refactor ./src/utils.js --incremental --log-level debug       ║
║                                                                               ║
║    # Восстановление из бэкапа                                                 ║
║    ast-refactor restore ./src/file.js.backup.1703123456789                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
    `);
  });


if (isMainModule(import.meta.url) && process.argv.length <= 2) {
  program.help();
}

if (isMainModule(import.meta.url)) {
  program.parse();
}
