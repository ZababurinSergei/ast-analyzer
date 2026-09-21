// packages/ast-analyzer/src/cli/commands/CompactCommand.ts
// ============================================
// КОМАНДА COMPACT — ГЕНЕРАЦИЯ КОМПАКТНОГО ОТЧЁТА СУЩНОСТЕЙ
// ============================================
// Версия: 13.0.0
//
// ИЗМЕНЕНИЯ v13.0.0 (переход на AnalysisPipeline):
//   - ✅ ПЕРЕВЕДЕНО на AnalysisPipeline с paths.
//   - ✅ УДАЛЕНЫ: collectFiles, ручной цикл extractEntitiesFromFile,
//     импорты extractEntitiesFromFile и glob.
//   - ✅ ДОБАВЛЕНО: paths: paths в pipeline.run().
//   - ✅ ЕДИНЫЙ прогон вместо цикла по paths — дедупликация файлов
//     через Set внутри collectFilesForAnalysis.
//
// ИЗМЕНЕНИЯ v12.0.0 (values-mode):
//   - ✅ ДОБАВЛЕН флаг --values-mode <mode>
//     Допустимые значения: 'full' | 'relations'
//     По умолчанию: 'relations' (сжатый режим, экономия 5–15x)
//   - ✅ ДОБАВЛЕНА валидация значения флага (exit code 2 при ошибке)
//   - ✅ Проброс valuesMode в generateCompactReport
//   - ✅ valuesMode включён в вывод информации о сжатии
//   - ✅ valuesMode включён в вывод опций
//
// ИЗМЕНЕНИЯ v9.1.0 (интеграция с reporters/json):
//   - ✅ ИСПРАВЛЕНО: путь импорта entity-extractor:
//       '../../core/entity-extractor.js'
//       → '../../reporters/json/extractors/extract-entities-from-file.js'
//     Теперь используется ЕДИНЫЙ источник истины для извлечения
//     сущностей — `extractEntitiesFromFile` из reporters/json.
//   - ✅ УДАЛЕНО: ручной вызов `parseFile` + `extractEntities`.
//     Заменён на `extractEntitiesFromFile(absPath)`, который
//     сам делает parseFile + extractEntities + convertEntitiesToEnhanced.
//   - ✅ ИСПРАВЛЕНО: вместо `Record<string, any>` используется
//     типизированный `Record<string, EnhancedEntityInfo>`.
//   - ✅ ДОБАВЛЕНО: флаги `--edges` и `--edges-suffix` для
//     сохранения агрегированного массива edges в отдельный файл.
//   - ✅ ДОБАВЛЕНО: явный `try/catch` вокруг `extractEntitiesFromFile`
//     с логированием ошибок в verbose-режиме.
//
// ИЗМЕНЕНИЯ v9.0.4:
//   - ✅ v9.0.4: добавлены флаги --edges и --edges-suffix
//     для сохранения агрегированного массива edges в отдельный файл.
//
// ИЗМЕНЕНИЯ v6.1.0 (историческое):
//   - ✅ ИСПРАВЛЕНО: путь импорта '../core/entity-extractor.js'
//     заменён на '../../core/entity-extractor/index.js'
//     (для совместимости с директорией entity-extractor/).
//   - ✅ v9.0.4: добавлены флаги --edges и --edges-suffix.
//
// Назначение:
//   Команда для генерации компактного отчёта сущностей.
//
// Особенности:
//   - Минимизированные ключи (экономия до 45% размера)
//   - Короткие ID (m1, f1, fn1, sf1, ...)
//   - Битовые флаги вместо булевых полей
//   - Словари для параметров и типов
//   - Ультра-компактный режим (максимальное сжатие)
//   - Полная легенда для всех кодов и ключей
//   - Self functions — изолированные функции
//   - ✅ Сохраняет и полный JSON (для отладки) и сжатый JSON (для AI)
//   - ✅ v9.0.4: опциональное сохранение edges в отдельный файл
//   - ✅ v12.0.0: values-mode (full | relations) для управления размером
//   - ✅ v13.0.0: единый AnalysisPipeline
// ============================================

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';

// ✅ v13.0.0: единый pipeline
import { AnalysisPipeline } from '../../pipeline/index.js';

// ✅ v13.0.0: используется для генерации отчёта
import { generateCompactReport } from '../../reporters/compact-reporter.js';

/**
 * Опции команды compact.
 *
 * Используется для типизации `options` в action-колбэке.
 */
interface CompactCommandOptions {
  /** Выходной файл (по умолчанию: entities.json) */
  output: string;
  /** Рекурсивный поиск файлов */
  recursive: boolean;
  /** Ультра-компактный режим */
  ultra?: boolean;
  /** Отключить битовые флаги */
  bitFlags?: boolean;
  /** Отключить словари */
  dictionaries?: boolean;
  /** Минифицировать ключи */
  minifyKeys?: boolean;
  /** Максимальная глубина анализа */
  maxDepth?: string;
  /** Пресет */
  preset?: string;
  /** Включать тела функций */
  includeBody?: boolean;
  /** Включать информацию о безопасности */
  includeSecurity?: boolean;
  /** Использовать шаблоны */
  templates?: boolean;
  /** Включать легенду */
  legend?: boolean;
  /** Включать self functions */
  selfFunctions?: boolean;
  /** Сохранять полный JSON */
  fullJson?: boolean;
  /** ✅ v9.0.4: сохранять edges в отдельный файл */
  edges?: boolean;
  /** ✅ v9.0.4: суффикс для файла edges */
  edgesSuffix?: string;
  /** ✅ v12.0.0: режим сериализации values ('full' | 'relations') */
  valuesMode?: string;
  /** Подробный вывод */
  verbose?: boolean;
}

/**
 * Команда для генерации компактного отчёта сущностей.
 *
 * Особенности:
 * - Минимизированные ключи (экономия до 45% размера)
 * - Короткие ID (m1, f1, fn1, sf1, ...)
 * - Битовые флаги вместо булевых полей
 * - Словари для параметров и типов
 * - Ультра-компактный режим (максимальное сжатие)
 * - Полная легенда для всех кодов и ключей
 * - Self functions — изолированные функции
 * - ✅ Сохраняет и полный JSON и сжатый JSON
 * - ✅ v9.0.4: опциональное сохранение edges в отдельный файл
 * - ✅ v12.0.0: values-mode (full | relations) для управления размером
 * - ✅ v13.0.0: единый AnalysisPipeline
 */
export class CompactCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('compact <paths...>')
      .description('📋 Генерация компактного отчета сущностей с минимизированными ключами')
      .option('-o, --output <file>', 'Выходной файл', 'entities.json')
      .option('-r, --recursive', 'Рекурсивный поиск файлов', true)
      .option('--ultra', 'Ультра-компактный режим (максимальное сжатие, экономия ~70%)')
      .option('--no-bit-flags', 'Отключить битовые флаги (использовать полные булевы поля)')
      .option('--no-dictionaries', 'Отключить словари для параметров и типов')
      .option('--minify-keys', 'Минифицировать ключи (более короткие имена)')
      .option('--max-depth <n>', 'Максимальная глубина анализа', '10')
      .option(
        '--preset <name>',
        'Пресет: minimal, standard, full, relationshipsOnly, ultraCompact',
        'standard'
      )
      .option('--include-body', 'Включить тела функций в отчет', false)
      .option('--include-security', 'Включить информацию о безопасности', false)
      .option('--no-templates', 'Отключить использование шаблонов')
      .option('--no-legend', 'Отключить легенду (экономия места)')
      .option(
        '--no-self-functions',
        'Отключить секцию self functions (изолированные функции)',
        false
      )
      .option('--no-full-json', 'Не сохранять полный JSON (только сжатый)', false)
      // ✅ v9.0.4: edges в отдельный файл (по умолчанию выключено)
      .option(
        '--edges',
        'Сохранять агрегированный массив edges в отдельный файл (по умолчанию: выключено)',
        false
      )
      .option(
        '--edges-suffix <suffix>',
        'Суффикс для файла edges (по умолчанию: .edges.json)',
        '.edges.json'
      )
      // ✅ v12.0.0: values-mode (по умолчанию 'relations')
      .option(
        '--values-mode <mode>',
        'Режим сериализации values: "full" | "relations" (по умолчанию: "relations")',
        'relations'
      )
      .option('-v, --verbose', 'Подробный вывод', false)
      .action(async (paths: string[], options: CompactCommandOptions) => {
        try {
          await this.execute(paths, options);
        } catch (error) {
          console.error('❌ Compact report generation failed:', error);
          process.exit(1);
        }
      });
  }

  /**
   * Основной метод выполнения команды.
   *
   * ✅ v13.0.0: использует AnalysisPipeline для сбора, парсинга
   * и нормализации сущностей. Никакого ручного цикла по paths —
   * pipeline сам разбирается с массивом путей.
   */
  private async execute(paths: string[], options: CompactCommandOptions): Promise<void> {
    // ============================================================
    // ✅ v12.0.0: ВАЛИДАЦИЯ --values-mode
    // ============================================================
    // Допустимые значения: 'full' | 'relations'.
    // При неверном значении — exit code 2 с понятным сообщением.
    // ============================================================
    if (
      options.valuesMode !== undefined &&
      options.valuesMode !== 'full' &&
      options.valuesMode !== 'relations'
    ) {
      console.error(
        `Error: Invalid --values-mode value "${options.valuesMode}". Expected "full" or "relations".`
      );
      process.exit(2);
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 ГЕНЕРАЦИЯ КОМПАКТНОГО ОТЧЕТА СУЩНОСТЕЙ (v13.0.0)');
    console.log('='.repeat(70));
    console.log(`📁 Пути: ${paths.join(', ')}`);
    console.log(`📄 Выходной файл: ${options.output}`);
    console.log(`🚀 Ультра-компактный режим: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📏 Глубина: ${options.maxDepth}`);
    console.log(`📝 Включить тела функций: ${options.includeBody ? 'ДА' : 'НЕТ'}`);
    console.log(`🔒 Информация о безопасности: ${options.includeSecurity ? 'ДА' : 'НЕТ'}`);
    console.log(`🔍 Self functions: ${options.selfFunctions !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`💾 Полный JSON: ${options.fullJson !== false ? 'СОХРАНЯТЬ' : 'НЕ СОХРАНЯТЬ'}`);
    console.log(`🗂️  Values mode: ${options.valuesMode || 'relations'}`);
    // ✅ v9.0.4: информация про edges
    console.log(`🔗 Edges в отдельный файл: ${options.edges === true ? 'ДА' : 'НЕТ'}`);
    if (options.edges === true) {
      console.log(`   Суффикс: ${options.edgesSuffix || '.edges.json'}`);
    }
    console.log('');

    // Проверяем пресет
    const presets = ['minimal', 'standard', 'full', 'relationshipsOnly', 'ultraCompact'];
    if (options.preset && !presets.includes(options.preset)) {
      console.warn(`⚠️ Неизвестный пресет: ${options.preset}, используем 'standard'`);
    }

    // Проверяем выходную директорию
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ============================================================
    // ✅ v13.0.0: ЕДИНЫЙ PIPELINE
    // ============================================================
    //
    // Раньше (v12.0.0):
    //   const files = await this.collectFiles(paths, options.recursive);
    //   const entitiesMap = {};
    //   for (const filePath of files) {
    //     const entities = extractEntitiesFromFile(filePath);
    //     if (entities) entitiesMap[relativePath] = entities;
    //   }
    //
    // Теперь (v13.0.0):
    //   pipeline.run({ paths, recursive, mode: 'entities-only' })
    //
    // Преимущества:
    //   - ОДИН прогон вместо ручного цикла
    //   - Дедупликация файлов через Set в collectFilesForAnalysis
    //   - Единый projectRoot (вычисляется из первого path)
    //   - Единые метрики
    //   - Единый errors[]
    //   - Диспетчеризация Vue vs TS/JS внутри ParseFileStage
    //   - Явный проброс template-полей в NormalizeEntitiesStage
    // ============================================================

    console.log('📁 Шаг 1: Сбор и парсинг (единый pipeline)...');

    const pipeline = new AnalysisPipeline();
    const pipelineResult = await pipeline.run({
      paths,
      recursive: options.recursive !== false,
      mode: 'entities-only',
      verbose: options.verbose === true,
      continueOnError: true,
    });

    // ============================================================
    // ДИАГНОСТИКА PIPELINE
    // ============================================================
    const m = pipelineResult.metrics;
    console.log(`   📁 Найдено файлов: ${m.filesDiscovered}`);
    console.log(`   ✅ Разобрано: ${m.filesParsed}`);
    console.log(`   🎯 Vue: ${m.vueFiles}, TS/JS: ${m.tsFiles}`);
    if (m.filesFailed > 0) {
      console.log(`   ⚠️  Ошибок парсинга: ${m.filesFailed}`);
    }
    if (options.verbose) {
      console.log(`   ƒ  Функций: ${m.totalFunctions}`);
      console.log(`   📌 Констант: ${m.totalConstants}`);
      console.log(`   📥 Импортов: ${m.totalImports}`);
      console.log(`   📤 Экспортов: ${m.totalExports}`);
      if (m.totalConditionals > 0) {
        console.log(`   🎨 Conditionals: ${m.totalConditionals}`);
      }
      if (m.totalLifecycle > 0) {
        console.log(`   🧬 Lifecycle: ${m.totalLifecycle}`);
      }
      if (m.totalReactivity > 0) {
        console.log(`   ⚡ Reactivity: ${m.totalReactivity}`);
      }
      if (m.reExportChains > 0) {
        console.log(`   🔄 Re-exports: ${m.reExportChains}`);
      }
    }
    console.log('');

    if (Object.keys(pipelineResult.enhancedMap).length === 0) {
      console.error('❌ Не найдено сущностей для анализа');
      process.exit(1);
    }

    try {
      // ============================================================
      // ШАГ 2: Генерация отчёта
      // ============================================================
      console.log(
        `📋 Шаг 2: Генерация ${options.ultra ? 'ультра-компактного' : 'компактного'} отчета...`
      );

      const reportOptions = {
        compress: true,
        saveFullJson: options.fullJson !== false,
        verbose: options.verbose,
        // ✅ v9.0.4: edges — только если явно запрошено
        saveEdges: options.edges === true,
        edgesJsonSuffix: options.edgesSuffix || '.edges.json',
        // ✅ v12.0.0: values-mode
        valuesMode: (options.valuesMode as 'full' | 'relations') || 'relations',
      };

      const startTime = Date.now();
      const report = generateCompactReport(
        pipelineResult.enhancedMap as any,
        outputPath,
        reportOptions
      );
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // ✅ ИСПРАВЛЕНО: выводим результаты, используя новую структуру GenerateReportResult
      this.printResults(report, outputPath, duration, options);

      // Сохраняем дополнительную информацию в verbose режиме
      if (options.verbose) {
        this.saveVerboseInfo(report, outputDir, pipelineResult.enhancedMap);
      }
    } catch (error) {
      console.error('❌ Ошибка при генерации отчета:', error);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\n📚 Стек ошибки:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Выводит результаты генерации отчёта.
   *
   * ✅ ИСПРАВЛЕНО: принимает GenerateReportResult (новая структура v6.0.0+).
   * ✅ v12.0.0: добавлена строка про valuesMode.
   */
  private printResults(
    report: any,
    outputPath: string,
    duration: string,
    options: CompactCommandOptions
  ): void {
    // Размер сжатого файла
    const compactSizeKB = report.stats?.compactSize
      ? (report.stats.compactSize / 1024).toFixed(2)
      : '0';

    // Размер полного файла
    const fullSizeKB = report.stats?.fullSize ? (report.stats.fullSize / 1024).toFixed(2) : '0';

    // ✅ v9.0.4: размер файла edges
    const edgesSizeKB = report.stats?.edgesSize ? (report.stats.edgesSize / 1024).toFixed(2) : '0';

    console.log('\n' + '='.repeat(70));
    console.log('✅ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`📊 Размер: ${compactSizeKB} KB`);
    console.log(`⏱️  Время: ${duration} сек`);

    // ✅ ИСПРАВЛЕНО: статистика берётся из report.full.statistics
    const stats = report.full?.statistics;
    if (stats) {
      console.log('\n📊 СТАТИСТИКА ОТЧЕТА:');
      console.log(`   • Модулей: ${stats.totalModules || 0}`);
      console.log(`   • Файлов: ${stats.totalFiles || 0}`);
      console.log(`   • Функций: ${stats.totalFunctions || 0}`);
      console.log(`   • Классов: ${stats.totalClasses || 0}`);
      console.log(`   • Констант: ${stats.totalConstants || 0}`);
      console.log(`   • Экспортов: ${stats.totalExports || 0}`);
      console.log(`   • Импортов: ${stats.totalImports || 0}`);
      console.log(`   • Вызовов: ${stats.totalCalls || 0}`);
      console.log(`   • Реэкспортов: ${stats.totalReExports || 0}`);
    } else {
      console.log('\n⚠️ Статистика недоступна');
    }

    // ✅ ДОБАВЛЕНО: информация о сжатии
    console.log('\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(`   • Пресет: ${options.preset}`);
    console.log(`   • Values mode: ${options.valuesMode || 'relations'}`);
    console.log(`   • Битовые флаги: ${options.bitFlags !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Словари: ${options.dictionaries !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Минификация ключей: ${options.minifyKeys ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Шаблоны: ${options.templates !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Легенда: ${options.legend !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(
      `   • Self functions: ${options.selfFunctions !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`
    );
    // ✅ v9.0.4: строка про edges
    console.log(`   • Edges в отдельный файл: ${options.edges === true ? 'ДА' : 'НЕТ'}`);

    if (report.stats?.compressionRatio !== undefined) {
      console.log(
        `   • Коэффициент сжатия: ${report.stats.compressionRatio.toFixed(1)}% от полного размера`
      );
    }

    // ✅ ДОБАВЛЕНО: информация о файлах
    if (report.fullPath) {
      console.log('\n💾 ФАЙЛЫ:');
      console.log(`   • Сжатый JSON: ${outputPath} (${compactSizeKB} KB)`);
      console.log(`   • Полный JSON:  ${report.fullPath} (${fullSizeKB} KB)`);
      // ✅ v9.0.4: файл edges
      if (report.edgesPath) {
        console.log(`   • Edges JSON:   ${report.edgesPath} (${edgesSizeKB} KB)`);
      }
    }

    // ✅ Легенда (если есть в compact)
    if (report.compact?.legend && options.legend !== false) {
      console.log('\n📖 ЛЕГЕНДА (кратко):');
      const legend = report.compact.legend;
      const legendKeys = Object.keys(legend).slice(0, 5);
      for (const key of legendKeys) {
        const desc = (legend as any)[key];
        if (typeof desc === 'string') {
          console.log(`   • ${key}: ${desc.substring(0, 60)}${desc.length > 60 ? '...' : ''}`);
        } else if (typeof desc === 'object' && desc !== null) {
          const subKeys = Object.keys(desc).length;
          console.log(`   • ${key}: { ... ${subKeys} записей ... }`);
        }
      }
      if (Object.keys(legend).length > 5) {
        console.log(`   ... и ещё ${Object.keys(legend).length - 5} ключей`);
      }
    }

    // ✅ Self functions статистика (из full.statistics)
    if (options.selfFunctions !== false && stats) {
      console.log(`\n🔍 SELF FUNCTIONS (изолированные функции):`);
      console.log(`   ℹ️ В новой версии отчёта self functions не выделены в отдельную секцию.`);
      console.log(`   ℹ️ Используйте 'analyze-extended' или 'self' команду для их поиска.`);
    }

    console.log('\n' + '='.repeat(70));

    // ✅ Советы по использованию (обновлены)
    console.log('\n💡 КАК ИСПОЛЬЗОВАТЬ ОТЧЕТ:');
    console.log('   • Откройте сжатый файл (compact) для отправки в AI');
    console.log('   • Откройте полный файл (.full.json) для отладки');
    console.log('   • Используйте Codec.decode() для разжатия сжатого JSON');
    console.log('   • mi/fl — индексы модулей и файлов');
    console.log('   • fns — список всех функций');
    console.log('   • cls — список классов');
    console.log('   • cn — список констант');
    console.log('   • gr.c — граф вызовов');
    console.log('   • gr.i — граф импортов');
    console.log('   • gr.e — граф экспортов');
    console.log('   • gr.re — реэкспорты');
    console.log('   • st — общая статистика');
    console.log('   • legend — легенда для расшифровки');
    // ✅ v9.0.4: совет про edges
    if (report.edgesPath) {
      console.log(
        '   • *.edges.json — агрегированный граф всех связей (imports/exports/calls/re-exports)'
      );
    }

    if (options.ultra) {
      console.log('   🚀 Ультра-компактный режим: идеально для отправки в AI');
      console.log('   📊 Экономия места: ~70% по сравнению со стандартным форматом');
    }

    // ✅ v12.0.0: совет про values-mode
    if (options.valuesMode === 'relations') {
      console.log('   🗂️  values-mode=relations: только данные для восстановления связей');
      console.log('   📊 Экономия места: 5–15x по сравнению с values-mode=full');
    } else if (options.valuesMode === 'full') {
      console.log('   🗂️  values-mode=full: полный набор значений (обратная совместимость)');
    }

    console.log('');
  }

  /**
   * Сохраняет дополнительную информацию в verbose режиме.
   *
   * ✅ ИСПРАВЛЕНО: принимает GenerateReportResult (новая структура v6.0.0+).
   */
  private saveVerboseInfo(report: any, outputDir: string, entitiesMap: Record<string, any>): void {
    // Сохраняем полную статистику по модулям (из full JSON)
    const statsPath = path.join(outputDir, 'compact-stats.json');
    const fullStats = report.full?.statistics;

    const stats = {
      version: report.full?.version || '6.0.0',
      timestamp: report.full?.timestamp || new Date().toISOString(),
      root: report.full?.root || '',
      statistics: fullStats || {},
      compression: {
        compactSize: report.stats?.compactSize || 0,
        fullSize: report.stats?.fullSize || 0,
        edgesSize: report.stats?.edgesSize || 0, // ✅ v9.0.4
        ratio: report.stats?.compressionRatio || 0,
      },
      modules: report.full?.modules?.length || 0,
      files: report.full?.files?.length || 0,
      functions: report.full?.functions?.length || 0,
      classes: report.full?.classes?.length || 0,
      constants: report.full?.constants?.length || 0,
      exports: report.full?.exports?.length || 0,
      imports: report.full?.imports?.length || 0,
      calls: report.full?.calls?.length || 0,
      reExports: report.full?.reExports?.length || 0,
      // ✅ v9.0.4: путь к edges
      edgesPath: report.edgesPath || null,
      // ✅ v12.0.0: valuesMode
      valuesMode: report.full?.valuesMode || 'relations',
    };
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`📄 Детальная статистика сохранена: ${statsPath}`);

    // Сохраняем информацию о сущностях в читаемом формате
    const entitiesPath = path.join(outputDir, 'compact-entities-readable.json');
    const readableEntities: Record<string, any> = {};
    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const e = entities as any;
      readableEntities[filePath] = {
        functionsCount: e.functions?.length || 0,
        classesCount: e.classes?.length || 0,
        constantsCount: e.constants?.length || 0,
        importsCount: e.imports?.length || 0,
        exportsCount: e.exports?.length || 0,
        interfacesCount: e.interfaces?.length || 0,
        typesCount: e.types?.length || 0,
        variablesCount: e.variables?.length || 0,
        selfFunctionsCount: (e.functions || []).filter(
          (f: any) => !(f.calls && f.calls.length > 0) && !(f.calledBy && f.calledBy.length > 0)
        ).length,
        // ✅ v9.0.0: Vue секции
        templateConditionalsCount: e.templateConditionals?.length || 0,
        templateLifecycleCount: e.templateLifecycle?.length || 0,
        templateEffectsCount: e.templateEffects?.length || 0,
        templateInjectionsCount: e.templateInjections?.length || 0,
        templateReactivityCount: e.templateReactivity?.length || 0,
      };
    }
    fs.writeFileSync(entitiesPath, JSON.stringify(readableEntities, null, 2));
    console.log(`📄 Информация о сущностях сохранена: ${entitiesPath}`);

    // Сохраняем граф вызовов в DOT формате для визуализации
    if (report.full?.calls && report.full.calls.length > 0) {
      const dotPath = path.join(outputDir, 'compact-callgraph.dot');
      const dot = this.generateDOT(report);
      fs.writeFileSync(dotPath, dot);
      console.log(`📄 DOT граф сохранен: ${dotPath}`);
    }

    // Сохраняем self functions в отдельный файл
    const selfFunctionsList: any[] = [];
    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const e = entities as any;
      for (const func of e.functions || []) {
        const hasCalls = func.calls && func.calls.length > 0;
        const hasCalledBy = func.calledBy && func.calledBy.length > 0;
        if (!hasCalls && !hasCalledBy) {
          selfFunctionsList.push({
            id: func.id || '',
            name: func.name,
            file: filePath,
            line: func.line,
            isExported: func.isExported || false,
            isAsync: func.isAsync || false,
            params: func.params || [],
          });
        }
      }
    }

    if (selfFunctionsList.length > 0) {
      const sfPath = path.join(outputDir, 'compact-self-functions.json');
      fs.writeFileSync(sfPath, JSON.stringify(selfFunctionsList, null, 2));
      console.log(`📄 Self functions сохранены: ${sfPath} (${selfFunctionsList.length} шт.)`);
    }
  }

  /**
   * Генерирует DOT из новой структуры full JSON.
   */
  private generateDOT(report: any): string {
    let dot = 'digraph CallGraph {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
    dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

    const full = report.full;
    if (!full) {
      dot += '}\n';
      return dot;
    }

    // Карта: id функции -> имя
    const functionNames: Record<string, string> = {};
    for (const func of full.functions || []) {
      functionNames[func.id] = func.name;
    }

    // Множество всех функций
    const nodes = new Set<string>();
    for (const func of full.functions || []) {
      nodes.add(func.id);
    }

    // Определяем точки входа (функции, которые никто не вызывает)
    const called = new Set<string>();
    for (const call of full.calls || []) {
      called.add(call.toFunctionId);
    }

    // Определяем self functions
    const selfIds = new Set<string>();
    const hasCalls = new Set<string>();
    const hasCalledBy = new Set<string>();
    for (const call of full.calls || []) {
      hasCalls.add(call.fromFunctionId);
      hasCalledBy.add(call.toFunctionId);
    }
    for (const id of nodes) {
      if (!hasCalls.has(id) && !hasCalledBy.has(id)) {
        selfIds.add(id);
      }
    }

    // Узлы
    for (const nodeId of nodes) {
      const name = functionNames[nodeId] || nodeId;
      const isEntry = !called.has(nodeId);
      const isSelf = selfIds.has(nodeId);
      let color = '#f3f4f6';
      let fontColor = '#1f2937';
      let label = name;
      let shape = 'box';

      if (isEntry) {
        color = '#4f46e5';
        fontColor = '#ffffff';
        label = `⭐ ${name}`;
      } else if (isSelf) {
        color = '#22d3ee';
        fontColor = '#0f172a';
        shape = 'ellipse';
        label = `🔹 ${name}`;
      }

      dot += `  "${nodeId}" [fillcolor="${color}", fontcolor="${fontColor}", label="${label}", shape="${shape}"];\n`;
    }

    dot += '\n';

    // Рёбра
    for (const call of full.calls || []) {
      const from = call.fromFunctionId;
      const to = call.toFunctionId;
      const line = call.line || 0;
      const type = call.type || 'direct';
      const color = type === 'async' ? '#ef4444' : type === 'method' ? '#f59e0b' : '#3b82f6';
      const style = type === 'async' ? 'dashed' : 'solid';
      const isSelfFrom = selfIds.has(from);
      const isSelfTo = selfIds.has(to);
      const penwidth = isSelfFrom || isSelfTo ? '0.5' : '1';
      dot += `  "${from}" -> "${to}" [color="${color}", style="${style}", penwidth=${penwidth}, label="${type}${
        line ? ` [${line}]` : ''
      }"];\n`;
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Получить экземпляр Command.
   */
  getCommand(): Command {
    return this.program;
  }
}

export default CompactCommand;
