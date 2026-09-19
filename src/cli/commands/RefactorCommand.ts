// packages/ast-analyzer/src/cli/commands/RefactorCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Команда для автоматического рефакторинга файлов
 *
 * Выполняет:
 * - Семантический анализ
 * - Кластеризацию функций
 * - Выделение модулей
 * - Валидацию (TypeScript, ESLint, Code Validation)
 * - Формальную верификацию (опционально)
 * - Проверку эквивалентности (опционально)
 * - Обновление импортов и реэкспортов
 * - Обновление Vue шаблонов (для Vue файлов)
 */
export class RefactorCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('refactor <file>')
      .description(
        '🔧 Автоматический рефакторинг файла с полным пайплайном (семантика + валидация + выделение модулей)'
      )

      // Основные опции
      .option('-o, --out-dir <dir>', 'Директория для сохранения модулей', 'modules')
      .option('-t, --target-size <n>', 'Целевой размер кластера (количество функций)', '3')
      .option('-m, --max-size <n>', 'Максимальный размер кластера', '10')
      .option('-c, --min-cohesion <n>', 'Минимальная связность кластера (%)', '60')
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
      .option('--max-attempts <n>', 'Максимальное количество попыток при ошибке', '3')

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
      .option('--max-depth <n>', 'Максимальная глубина анализа Call Graph', '10')

      // Валидация и исправление
      .option('--iterations <n>', 'Максимум итераций исправления', '5')

      .action(async (file: string, options: any) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          console.error('❌ Refactoring failed:', error);
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет рефакторинг
   */
  private async execute(file: string, options: any): Promise<void> {
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
      // Импортируем AutoRefactor
      const { AutoRefactor } = await import('../../refactor/AutoRefactor.js');

      // Создаем экземпляр с опциями
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
        wasmPath: this.getWasmPath(),
      });

      // Инициализация
      await refactor.initialize();

      // Сохраняем оригинальный файл для сравнения
      const originalContent = fs.readFileSync(absolutePath, 'utf-8');
      const backupOriginalPath = `${absolutePath}.original-backup.${Date.now()}`;
      if (!options.dryRun) {
        fs.writeFileSync(backupOriginalPath, originalContent);
      }

      // Запускаем рефакторинг
      const result = await refactor.refactor(absolutePath);
      await refactor.dispose();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Формальная проверка эквивалентности
      let equivalenceResult = null;
      if (options.equivalenceCheck !== false && !options.dryRun && result.success) {
        equivalenceResult = await this.runEquivalenceCheck(
          backupOriginalPath,
          absolutePath,
          options,
          result
        );
      }

      // Вывод результатов
      if (result.success) {
        this.printSuccessResult(result, duration, equivalenceResult);
      } else {
        this.printErrorResult(result);
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
  }

  /**
   * Запускает проверку эквивалентности
   */
  private async runEquivalenceCheck(
    originalPath: string,
    refactoredPath: string,
    options: any,
    _result: any
  ): Promise<any> {
    console.log('\n' + '='.repeat(70));
    console.log('🔬 ЗАПУСК ФОРМАЛЬНОЙ ПРОВЕРКИ ЭКВИВАЛЕНТНОСТИ');
    console.log('='.repeat(70));

    try {
      const { RefactoringEquivalenceChecker } = await import('../../formal/index.js');
      const checker = new RefactoringEquivalenceChecker();
      await checker.initialize();

      const modulesDir = path.join(path.dirname(refactoredPath), options.outDir || 'modules');
      const equivalenceResult = await checker.checkRefactoringEquivalence(
        originalPath,
        refactoredPath,
        fs.existsSync(modulesDir) ? modulesDir : undefined
      );

      await checker.dispose();

      // Сохраняем отчет об эквивалентности
      const reportPath = path.join(path.dirname(refactoredPath), 'equivalence-report.md');
      fs.writeFileSync(reportPath, equivalenceResult.report);
      console.log(`\n📄 Отчет об эквивалентности сохранен: ${reportPath}`);

      if (!equivalenceResult.isEquivalent) {
        console.log('\n❌ ФОРМАЛЬНАЯ ПРОВЕРКА НЕ ПРОЙДЕНА!');
        console.log(`   ❌ Ошибок: ${equivalenceResult.failedFunctions.length}`);
        console.log(`   📝 Изменений сигнатур: ${equivalenceResult.signatureChanges.length}`);
        console.log(`   📄 Отчет: ${reportPath}`);

        // Восстанавливаем оригинал
        fs.copyFileSync(originalPath, refactoredPath);
        console.log(`\n💾 Файл восстановлен из бэкапа: ${originalPath}`);

        return equivalenceResult;
      } else {
        console.log('\n✅ ФОРМАЛЬНАЯ ПРОВЕРКА ПРОЙДЕНА!');
        console.log(
          `   ✅ Верифицировано: ${equivalenceResult.verifiedFunctions}/${equivalenceResult.totalFunctions} функций`
        );
      }

      // Удаляем бэкап оригинала после успешной проверки
      if (fs.existsSync(originalPath) && !options.dryRun) {
        fs.unlinkSync(originalPath);
      }

      return equivalenceResult;
    } catch (error) {
      console.error('❌ Ошибка при проверке эквивалентности:', error);
      return null;
    }
  }

  /**
   * Выводит результат успешного рефакторинга
   */
  private printSuccessResult(result: any, duration: string, equivalenceResult: any): void {
    console.log('\n' + '='.repeat(70));
    console.log('✨ РЕФАКТОРИНГ УСПЕШНО ЗАВЕРШЁН!');
    console.log('='.repeat(70));
    console.log(`⏱️ Время выполнения: ${duration} сек`);

    // Информация о гарантиях
    if (result.guaranteeInfo) {
      console.log('\n🛡️ ИНФОРМАЦИЯ О ГАРАНТИЯХ:');
      console.log(`   • Попыток: ${result.guaranteeInfo.attempts}`);
      console.log(`   • Тип модуля: ${result.guaranteeInfo.moduleType.toUpperCase()}`);
      console.log(`   • Точность определения: ${result.guaranteeInfo.detectionConfidence}`);
      console.log(`   • Создано чекпоинтов: ${result.guaranteeInfo.checkpointsCreated}`);
      console.log(`   • Создано бэкапов: ${result.guaranteeInfo.backupsCreated}`);
      console.log(`   • Валидаций выполнено: ${result.guaranteeInfo.validationHistory.length}`);
    }

    // Результат формальной проверки
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

    // Модули
    if (result.modules.length > 0) {
      console.log(`\n📦 Создано модулей: ${result.modules.length}`);
      console.log('\n📁 СОЗДАННЫЕ МОДУЛИ:');
      for (const module of result.modules) {
        const relativePath = path.relative(process.cwd(), module.path);
        console.log(`   ✅ ${relativePath} (${module.exports.length} экспортов)`);
      }
    }

    // Метрики
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
      const funcs = result.semanticResults.unusedFunctions.slice(0, 5);
      console.log(
        `   ${funcs.join(', ')}${result.semanticResults.unusedFunctions.length > 5 ? '...' : ''}`
      );
    }

    if (
      result.verificationResults &&
      result.verificationResults.filter((r: any) => !r.isValid).length > 0
    ) {
      const failedCount = result.verificationResults.filter((r: any) => !r.isValid).length;
      console.log(`\n⚠️ ВНИМАНИЕ: ${failedCount} функций НЕ ПРОШЛИ формальную верификацию`);
    }

    console.log('\n💡 Совет: Запустите линтер и тесты после рефакторинга');
  }

  /**
   * Выводит результат неудачного рефакторинга
   */
  private printErrorResult(result: any): void {
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
        `   Восстановите файл командой: cp ${path.relative(process.cwd(), result.backupPath)} ${result.failedStep || 'file'}`
      );
    }

    if (result.lastSuccessfulStep !== undefined) {
      console.log(`\n📌 Последний успешный шаг: ${result.lastSuccessfulStep + 1}`);
      console.log('   Для продолжения с этого шага используйте --incremental');
    }
  }

  /**
   * Автоматическое определение WASM пути
   */
  private getWasmPath(): string {
    const possiblePaths = [
      path.resolve(__dirname, 'wasm'),
      path.resolve(__dirname, '../dist/wasm'),
      path.resolve(process.cwd(), 'grammars'),
      path.resolve(process.cwd(), 'packages/ast-analyzer/dist/wasm'),
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

    return path.resolve(__dirname, 'wasm');
  }

  /**
   * Возвращает команду для регистрации
   */
  getCommand(): Command {
    return this.program;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default RefactorCommand;
