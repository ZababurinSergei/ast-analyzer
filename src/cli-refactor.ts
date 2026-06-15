#!/usr/bin/env node

/**
 * CLI для автоматического рефакторинга файлов с выделением модулей
 *
 * Использование:
 *   npx ast-refactor refactor <file> [options]
 *   npx ast-refactor analyze <file> [options]
 *   npx ast-refactor validate <file> [options]
 *   npx ast-refactor help
 */

import { Command } from 'commander';
import { AutoRefactor } from './refactor/index.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('ast-refactor')
  .description('🔧 Автоматический рефакторинг файлов с полным pipeline валидации')
  .version('2.0.0');

program
  .command('refactor <file>')
  .description('Рефакторинг файла с полным pipeline (семантика + валидация + исправление)')

  // Основные опции
  .option('-o, --out-dir <dir>', 'Директория для сохранения модулей', 'modules')
  .option('-t, --target-size <number>', 'Целевой размер кластера (количество функций)', '3')
  .option('-m, --max-size <number>', 'Максимальный размер кластера', '10')
  .option('-c, --min-cohesion <number>', 'Минимальная связность кластера (%)', '60')
  .option('-d, --dry-run', 'Пробный запуск без фактических изменений', false)
  .option('--no-backup', 'Не создавать резервную копию файла', false)
  .option('-v, --verbose', 'Подробный вывод процесса', false)
  .option('--no-vue', 'Не обновлять template для Vue файлов (только script)', false)

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

  // Семантический анализ
  .option('--critical <functions>', 'Критические функции для верификации (через запятую)')
  .option('--max-depth <number>', 'Максимальная глубина анализа', '10')

  // Валидация и исправление
  .option('--iterations <number>', 'Максимум итераций исправления', '5')

  .action(async (file, options) => {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(60));
    console.log('🔧 АВТОМАТИЧЕСКИЙ РЕФАКТОРИНГ С ПОЛНЫМ PIPELINE');
    console.log('='.repeat(60));
    console.log(`\n📄 Целевой файл: ${file}`);
    console.log(`📁 Выходная директория: ${options.outDir}`);
    console.log(`🎯 Параметры: размер=${options.targetSize}, связность=${options.minCohesion}%`);

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
      });

      await refactor.initialize();
      const result = await refactor.refactor(absolutePath);
      await refactor.dispose();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (result.success) {
        console.log('\n' + '='.repeat(60));
        console.log('✨ РЕФАКТОРИНГ УСПЕШНО ЗАВЕРШЁН!');
        console.log('='.repeat(60));
        console.log(`⏱️  Время выполнения: ${duration} сек`);

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
        console.error('\n' + '='.repeat(60));
        console.error('❌ РЕФАКТОРИНГ НЕ УДАЛСЯ');
        console.error('='.repeat(60));
        console.error(`\nОшибка: ${result.error}`);

        if (result.backupPath && fs.existsSync(result.backupPath)) {
          console.log(
            `\n💾 Резервная копия сохранена: ${path.relative(process.cwd(), result.backupPath)}`
          );
          console.log(
            `   Восстановите файл командой: cp ${path.relative(process.cwd(), result.backupPath)} ${file}`
          );
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
  .option('-v, --verbose', 'Подробный вывод', false)
  .action(async (file, options) => {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log('🔍 АНАЛИЗ ФАЙЛА С ПОЛНЫМ PIPELINE');
    console.log('='.repeat(70));
    console.log(`\n📄 Файл: ${file}`);
    console.log(`📅 Время: ${new Date().toLocaleString()}`);

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
          console.log(`\n   ${i + 1}. Модуль "${module.name}":`);
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

program
  .command('validate <file>')
  .description('Запустить все валидаторы без рефакторинга')
  .option('-v, --verbose', 'Подробный вывод', false)
  .option('--formal', 'Включить формальную верификацию', false)
  .option('--fix', 'Применить автоисправления', false)
  .action(async (file, options) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ЗАПУСК ВСЕХ ВАЛИДАТОРОВ');
    console.log('='.repeat(60));
    console.log(`\n📄 Файл: ${file}`);
    console.log(`🔧 Автоисправление: ${options.fix ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);

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
║    ESLint, TypeScript валидацию и автоисправление.                           ║
║                                                                               ║
║  КОМАНДЫ:                                                                     ║
║    refactor <file>     - Полный pipeline: анализ + валидация + рефакторинг    ║
║    analyze <file>      - Только анализ (без изменений)                        ║
║    validate <file>     - Запустить все валидаторы (с опциональным фиксом)     ║
║    restore <backup>    - Восстановить файл из резервной копии                 ║
║    help                - Показать эту справку                                 ║
║                                                                               ║
║  ОСНОВНЫЕ ОПЦИИ (refactor):                                                   ║
║    -o, --out-dir <dir>     Директория для модулей (по умолчанию: modules)     ║
║    -t, --target-size <n>   Целевой размер кластера (по умолчанию: 3)          ║
║    -c, --min-cohesion <n>  Минимальная связность % (по умолчанию: 60)         ║
║    -d, --dry-run           Пробный запуск без изменений                       ║
║    -v, --verbose           Подробный вывод                                     ║
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
║    # Полный pipeline со всеми анализаторами                                   ║
║    ast-refactor refactor ./src/utils.js                                       ║
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
║    # Восстановление из бэкапа                                                 ║
║    ast-refactor restore ./src/file.js.backup.1703123456789                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
    `);
  });

// Если нет аргументов, показываем справку
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
