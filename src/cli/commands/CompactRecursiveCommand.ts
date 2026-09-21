// packages/ast-analyzer/src/cli/commands/CompactRecursiveCommand.ts
// ============================================================
// ПОЛНАЯ ВЕРСИЯ С ОБНОВЛЕНИЯМИ
// ============================================================
// Версия: 13.1.0
//
// ИЗМЕНЕНИЯ v13.1.0 (фикс сборки файлов):
//   - ✅ ИСПРАВЛЕНО: `paths: [entryPath]` → `paths: [projectRoot]`.
//     `entryPath` — файл (./src/index.ts), `collectFilesForAnalysis`
//     не разворачивает его в директорию и возвращает 1 файл.
//     Теперь передаём `path.dirname(entryPath)` — обход всей
//     директории точки входа, как и требует семантика
//     "compact-RECURSIVE".
//   - ✅ ДОБАВЛЕНО: диагностика `Сканирование директории: ...`.
//
// ИЗМЕНЕНИЯ v13.0.0 (переход на AnalysisPipeline):
//   - ✅ ПЕРЕВЕДЕНО на AnalysisPipeline.
//   - ✅ УДАЛЕНЫ: collectProjectFiles, ручной цикл
//     extractEntitiesFromFile, импорты extractEntitiesFromFile
//     и collectFilesForAnalysis.
//   - ✅ УДАЛЕНЫ: stats от generateCompactReport, заменены на
//     pipeline.metrics.
//   - ✅ ДОБАВЛЕНО: paths в pipeline.run().
//
// ИЗМЕНЕНИЯ v12.0.0 (values-mode):
//   - ✅ ДОБАВЛЕН флаг --values-mode <mode>.
//
// ИЗМЕНЕНИЯ v11.0.1 (fix TS2451 + TS2339):
//   - ✅ ИСПРАВЛЕНО: переименовано `config` → `appConfig`.
//
// ИЗМЕНЕНИЯ v11.0.0 (config file integration):
//   - ✅ ДОБАВЛЕН флаг --config <file>, авто-поиск, mergeConfigWithCli.
//
// ИЗМЕНЕНИЯ v10.0.0:
//   - ✅ extractEntities импортируется из reporters/json.
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ Добавлены флаги --edges и --edges-suffix.
// ============================================================

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';

// ✅ ЕДИНЫЙ ИСТОЧНИК JSON-ОТЧЁТОВ
import { generateCompactReport } from '../../reporters/compact-reporter.js';
import { getPresetNames, createCompactConfig } from '../../reporters/CompactReportConfig.js';

// ✅ v11.0.0: загрузчик конфиг-файла
import { loadConfig, mergeConfigWithCli } from '../config/load-config.js';

// ✅ НОВОЕ v13.0.0: единый pipeline
import { AnalysisPipeline } from '../../pipeline/index.js';

/**
 * Команда для рекурсивного компакт-отчета.
 *
 * Работает как project + compact: обходит директорию точки входа,
 * собирает все файлы, извлекает сущности и генерирует компактный
 * отчёт через единый AnalysisPipeline.
 *
 * ═══════════════════════════════════════════════════════════
 * АРХИТЕКТУРА (v13.0.0+)
 * ═══════════════════════════════════════════════════════════
 *
 *   CompactRecursiveCommand
 *        │
 *        └──> AnalysisPipeline.run({ paths: [projectRoot] })
 *                 │
 *                 ├──> DiscoverFilesStage     (сбор файлов)
 *                 ├──> ParseFileStage          (диспетчер: Vue | TS/JS)
 *                 ├──> EnrichReExportsStage    (разворот export * from)
 *                 ├──> NormalizeEntitiesStage  (проброс template-полей)
 *                 └──> BuildReportStage        (FullJSON → CompactJSON)
 *
 *   Результат pipeline → generateCompactReport → сохранение файлов.
 *
 * ═══════════════════════════════════════════════════════════
 * КЛЮЧЕВОЕ ОТЛИЧИЕ v13.1.0
 * ═══════════════════════════════════════════════════════════
 *
 *   `paths: [projectRoot]`, где projectRoot = path.dirname(entryPath).
 *
 *   Это соответствует семантике "compact-RECURSIVE":
 *     - entryPath = ./src/index.ts (точка входа)
 *     - projectRoot = ./src (директория для рекурсивного обхода)
 *
 *   `collectFilesForAnalysis(['/src/index.ts'])` вернёт 1 файл.
 *   `collectFilesForAnalysis(['/src'])` вернёт все файлы проекта.
 */
export class CompactRecursiveCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('compact-recursive <entry>')
      .description('📋 Генерация компактного отчета для всего проекта с гибкой настройкой полей')

      // === ОСНОВНЫЕ ОПЦИИ ===
      .option('-o, --output <file>', 'Выходной файл', './reports/ast-analyzer-full.json')
      .option('-d, --depth <n>', 'Максимальная глубина анализа', '100')
      .option('--preset <name>', `Пресет: ${getPresetNames().join(', ')}`, 'standard')
      .option('--ultra', 'Ультра-компактный режим (максимальное сжатие, экономия ~70%)')

      // === ✅ v11.0.0: CONFIG FILE ===
      .option(
        '--config <file>',
        'Путь к конфиг-файлу (по умолчанию: автопоиск ast-analyzer.config.json)'
      )

      // === ✅ v12.0.0: VALUES MODE ===
      .option(
        '--values-mode <mode>',
        'Режим сериализации values: "full" | "relations" (по умолчанию: "relations")',
        'relations'
      )

      // === ВКЛЮЧЕНИЕ/ОТКЛЮЧЕНИЕ СУЩНОСТЕЙ ===
      .option('--no-functions', 'Отключить функции (fns)')
      .option('--no-constants', 'Отключить константы (cn)')
      .option('--no-self-functions', 'Отключить self-функции (sf)')

      // === ВКЛЮЧЕНИЕ/ОТКЛЮЧЕНИЕ СВЯЗЕЙ ===
      .option('--no-relations', 'Отключить все связи (gr.*)')
      .option('--no-calls', 'Отключить вызовы (gr.c)')
      .option('--no-imports', 'Отключить импорты (gr.i)')
      .option('--no-exports', 'Отключить экспорты (gr.e)')
      .option('--no-inheritance', 'Отключить наследование (gr.h)')
      .option('--no-type-deps', 'Отключить типовые зависимости (gr.td)')
      .option('--no-re-exports', 'Отключить re-экспорты (gr.re)')
      .option('--no-const-uses', 'Отключить использование констант (gr.uc)')
      .option('--no-const-deps', 'Отключить зависимости констант (gr.cd)')
      .option('--no-const-exports', 'Отключить экспорты констант (gr.ce)')

      // === РАСШИРЕННЫЙ АНАЛИЗ ===
      .option('--no-dynamic-imports', 'Отключить динамические импорты (gr.di)')
      .option('--no-config-refs', 'Отключить конфигурации (gr.cfg)')
      .option('--no-external-libs', 'Отключить внешние библиотеки (gr.ext)')
      .option('--no-vue-templates', 'Отключить Vue шаблоны (gr.vt)')
      .option('--no-async-chains', 'Отключить асинхронные цепочки (gr.async)')
      .option('--no-closures', 'Отключить замыкания (gr.closures)')

      // === СТАТИСТИКА ===
      .option('--no-stats', 'Отключить статистику (st)')
      .option('--no-extended-stats', 'Отключить расширенную статистику')

      // === ✅ EDGES (отдельный файл, по умолчанию выключено) ===
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

      // === МЕТАДАННЫЕ ===
      .option('--no-flags', 'Отключить битовые флаги (flg)')
      .option('--no-types', 'Отключить типы (types)')
      .option('--no-legend', 'Отключить легенду (legend)')
      .option('--include-body', 'Включить тела функций (увеличивает размер)', false)
      .option('--include-security', 'Включить информацию о безопасности', false)
      .option('--include-vscode', 'Включить VSCode ссылки для функций', false)

      // === ФОРМАТИРОВАНИЕ ===
      .option('--minify-keys', 'Минифицировать ключи (более короткие имена)')
      .option('--no-bit-flags', 'Отключить битовые флаги (использовать полные булевы поля)')
      .option('--no-dictionaries', 'Отключить словари для параметров и типов')
      .option('--no-templates', 'Отключить использование шаблонов')
      .option('--readable-keys', 'Использовать читаемые ключи (вместо сокращений)')

      // === ✅ v11.0.0: EXCLUDE ===
      .option(
        '-x, --exclude <patterns>',
        'Паттерны исключения (через запятую). Пример: "**/__tests__/**,**/fixtures/**"'
      )

      .option('-v, --verbose', 'Подробный вывод', false)
      .action(async (entry: string, options: any) => {
        try {
          await this.execute(entry, options);
        } catch (error) {
          console.error('❌ CompactRecursiveCommand error:', error);
          process.exit(1);
        }
      });
  }

  // ============================================================
  // ОСНОВНОЙ МЕТОД
  // ============================================================

  private async execute(entry: string, rawOptions: any): Promise<void> {
    // ============================================================
    // ✅ v12.0.0: ВАЛИДАЦИЯ --values-mode
    // ============================================================
    if (
      rawOptions.valuesMode !== undefined &&
      rawOptions.valuesMode !== 'full' &&
      rawOptions.valuesMode !== 'relations'
    ) {
      console.error(
        `Error: Invalid --values-mode value "${rawOptions.valuesMode}". Expected "full" or "relations".`
      );
      process.exit(2);
    }

    // ============================================================
    // ✅ v11.0.0: ЗАГРУЗКА КОНФИГА И МЕРЖ С CLI
    // ============================================================
    // Приоритет: CLI > config > пресет > дефолты
    // ============================================================
    const appConfig = loadConfig(rawOptions.config, process.cwd());
    const options = mergeConfigWithCli(appConfig, rawOptions);

    // Извлекаем outputOptions (не CLI-поля, а из конфига)
    const outputOpts = options.__outputOptions ?? {};

    // Парсим exclude-паттерны
    const excludePatterns = this.parseExcludePatterns(options.exclude);

    const startTime = Date.now();
    const entryPath = path.resolve(entry);

    // ============================================================
    // ШАПКА
    // ============================================================
    console.log('\n' + '='.repeat(70));
    console.log('📋 КОМПАКТНЫЙ ОТЧЕТ С ГИБКОЙ НАСТРОЙКОЙ');
    console.log('='.repeat(70));
    console.log(`📄 Точка входа: ${entryPath}`);
    console.log(`📏 Глубина: ${options.depth}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📁 Выходной файл: ${options.output}`);
    console.log(`🚀 Ультра-компактный: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`🗂️  Values mode: ${options.valuesMode || 'relations'}`);
    console.log(`🔗 Edges в отдельный файл: ${options.edges === true ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
    if (excludePatterns.length > 0) {
      console.log(`🚫 Исключения: ${excludePatterns.join(', ')}`);
    }

    // Показываем что включено
    console.log('\n📊 ВКЛЮЧЕННЫЕ КОМПОНЕНТЫ:');
    console.log(`   • Функции: ${options.functions !== false ? '✅' : '❌'}`);
    console.log(`   • Константы: ${options.constants !== false ? '✅' : '❌'}`);
    console.log(`   • Self-функции: ${options.selfFunctions !== false ? '✅' : '❌'}`);
    console.log(
      `   • Вызовы: ${options.calls !== false && options.relations !== false ? '✅' : '❌'}`
    );
    console.log(
      `   • Импорты: ${options.imports !== false && options.relations !== false ? '✅' : '❌'}`
    );
    console.log(
      `   • Экспорты: ${options.exports !== false && options.relations !== false ? '✅' : '❌'}`
    );
    console.log(
      `   • Наследование: ${options.inheritance !== false && options.relations !== false ? '✅' : '❌'}`
    );
    console.log(
      `   • Типовые зависимости: ${options.typeDeps !== false && options.relations !== false ? '✅' : '❌'}`
    );
    console.log(`   • Статистика: ${options.stats !== false ? '✅' : '❌'}`);
    console.log(`   • Расширенный анализ: ${options.extendedStats !== false ? '✅' : '❌'}`);
    console.log(`   • Тела функций: ${options.includeBody === true ? '✅' : '❌'}`);
    console.log(`   • VSCode ссылки: ${options.includeVSCode === true ? '✅' : '❌'}`);
    console.log(`   • Edges в отдельный файл: ${options.edges === true ? '✅' : '❌'}`);
    console.log('');

    if (!fs.existsSync(entryPath)) {
      console.error(`❌ Файл не найден: ${entryPath}`);
      process.exit(1);
    }

    // ============================================================
    // ✅ v13.1.0: ШАГ 1: ЕДИНЫЙ PIPELINE
    // ============================================================
    //
    // ⚠️ КЛЮЧЕВОЙ МОМЕНТ:
    //   Обходим ДИРЕКТОРИЮ точки входа, а не сам файл.
    //
    //   `collectFilesForAnalysis` НЕ разворачивает файл в директорию:
    //   если передать `./src/index.ts`, вернётся 1 файл.
    //   Если передать `./src`, вернутся все файлы проекта.
    //
    //   Это соответствует семантике `compact-RECURSIVE`:
    //   рекурсивный обход проекта от директории точки входа.
    // ============================================================
    console.log('📁 Шаг 1: Сбор и парсинг файлов (единый pipeline)...');

    const projectRoot = path.dirname(entryPath);

    if (options.verbose) {
      console.log(`   📂 Сканирование директории: ${projectRoot}`);
    }

    const pipeline = new AnalysisPipeline();
    const pipelineResult = await pipeline.run({
      paths: [projectRoot], // ← ✅ ДИРЕКТОРИЯ, а не entryPath
      recursive: true,
      additionalIgnore: excludePatterns,
      mode: 'compact',
      valuesMode: (options.valuesMode as 'full' | 'relations') ?? 'relations',
      maxReExportDepth: parseInt(options.depth, 10) || 10,
      includeBody: options.includeBody === true,
      includeVSCode: options.includeVSCode === true,
      includeExtended: true,
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
        console.log(`   🔄 Re-exports развёрнуто: ${m.reExportChains}`);
      }
    }

    if (Object.keys(pipelineResult.entitiesMap).length === 0) {
      console.error('❌ Не найдено сущностей для анализа');
      process.exit(1);
    }

    // ============================================================
    // ШАГ 2: Генерация компактного отчета
    // ============================================================
    console.log('\n📋 Шаг 3: Генерация компактного отчета с применением конфига...');

    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Создаём конфиг из опций
    const configBuilder = createCompactConfig(options.preset || 'standard');

    // ============================================================
    // Форматирование
    // ============================================================
    if (options.ultra) {
      configBuilder.setMinifyKeys(true).setUseBitFlags(true).setUseDictionaries(true);
    }
    if (options.minifyKeys) configBuilder.setMinifyKeys(true);
    if (options.bitFlags === false) configBuilder.setUseBitFlags(false);
    if (options.dictionaries === false) configBuilder.setUseDictionaries(false);
    if (options.templates === false) configBuilder.setUseTemplates(false);
    if (options.readableKeys) configBuilder.setReadableKeys(true);

    // Строгая проверка === true
    if (options.includeBody === true) configBuilder.setIncludeBody(true);
    if (options.includeSecurity === true) configBuilder.setIncludeSecurity(true);
    if (options.includeVSCode === true) configBuilder.setIncludeVSCode(true);

    if (options.depth) configBuilder.setMaxDepth(parseInt(options.depth, 10));

    // Сущности
    if (options.functions === false) configBuilder.includeFunctions(false);
    if (options.constants === false) configBuilder.includeConstants(false);
    if (options.selfFunctions === false) configBuilder.includeSelfFunctions(false);

    // Связи — если relations отключены, отключаем всё
    if (options.relations === false) {
      configBuilder
        .includeCalls(false)
        .includeImports(false)
        .includeExports(false)
        .includeInheritance(false)
        .includeTypeDeps(false)
        .includeReExports(false)
        .includeConstUses(false)
        .includeConstDeps(false)
        .includeConstExports(false);
    } else {
      if (options.calls === false) configBuilder.includeCalls(false);
      if (options.imports === false) configBuilder.includeImports(false);
      if (options.exports === false) configBuilder.includeExports(false);
      if (options.inheritance === false) configBuilder.includeInheritance(false);
      if (options.typeDeps === false) configBuilder.includeTypeDeps(false);
      if (options.reExports === false) configBuilder.includeReExports(false);
      if (options.constUses === false) configBuilder.includeConstUses(false);
      if (options.constDeps === false) configBuilder.includeConstDeps(false);
      if (options.constExports === false) configBuilder.includeConstExports(false);
    }

    // Расширенный анализ
    if (options.dynamicImports === false) configBuilder.includeDynamicImports(false);
    if (options.configRefs === false) configBuilder.includeConfigRefs(false);
    if (options.externalLibs === false) configBuilder.includeExternalLibs(false);
    if (options.vueTemplates === false) configBuilder.includeVueTemplates(false);
    if (options.asyncChains === false) configBuilder.includeAsyncChains(false);
    if (options.closures === false) configBuilder.includeClosures(false);

    // Статистика
    if (options.stats === false) {
      configBuilder.includeBasicStats(false).includeExtendedStats(false);
    }
    if (options.extendedStats === false) {
      configBuilder.includeExtendedStats(false);
    }

    // Метаданные
    if (options.flags === false) configBuilder.includeFlags(false);
    if (options.types === false) configBuilder.includeTypes(false);
    if (options.legend === false) configBuilder.includeLegend(false);

    const config = configBuilder.build();
    const genOptions = configBuilder.toGeneratorOptions();

    console.log('\n📋 ИТОГОВАЯ КОНФИГУРАЦИЯ:');
    console.log(`   • Пресет: ${options.preset}`);
    console.log(`   • Функции: ${config.functions ? '✅' : '❌'}`);
    console.log(`   • Константы: ${config.constants ? '✅' : '❌'}`);
    console.log(`   • Self-функции: ${config.selfFunctions ? '✅' : '❌'}`);
    console.log(`   • Вызовы: ${config.relations.calls ? '✅' : '❌'}`);
    console.log(`   • Импорты: ${config.relations.imports ? '✅' : '❌'}`);
    console.log(`   • Экспорты: ${config.relations.exports ? '✅' : '❌'}`);
    console.log(`   • Наследование: ${config.relations.inheritance ? '✅' : '❌'}`);
    console.log(`   • Типовые зависимости: ${config.relations.typeDeps ? '✅' : '❌'}`);
    console.log(`   • Re-экспорты: ${config.relations.reExports ? '✅' : '❌'}`);
    console.log(`   • Использование констант: ${config.relations.constUses ? '✅' : '❌'}`);
    console.log(`   • Зависимости констант: ${config.relations.constDeps ? '✅' : '❌'}`);
    console.log(`   • Экспорты констант: ${config.relations.constExports ? '✅' : '❌'}`);
    console.log(`   • Динамические импорты: ${config.extended.dynamicImports ? '✅' : '❌'}`);
    console.log(`   • Конфигурации: ${config.extended.configRefs ? '✅' : '❌'}`);
    console.log(`   • Внешние библиотеки: ${config.extended.externalLibs ? '✅' : '❌'}`);
    console.log(`   • Vue шаблоны: ${config.extended.vueTemplates ? '✅' : '❌'}`);
    console.log(`   • Асинхронные цепочки: ${config.extended.asyncChains ? '✅' : '❌'}`);
    console.log(`   • Замыкания: ${config.extended.closures ? '✅' : '❌'}`);
    console.log(`   • Баз. статистика: ${config.stats.basic ? '✅' : '❌'}`);
    console.log(`   • Расш. статистика: ${config.stats.extended ? '✅' : '❌'}`);
    console.log(`   • Битовые флаги: ${config.useBitFlags ? '✅' : '❌'}`);
    console.log(`   • Словари: ${config.useDictionaries ? '✅' : '❌'}`);
    console.log(`   • Шаблоны: ${config.useTemplates ? '✅' : '❌'}`);
    console.log(`   • Тела функций: ${config.includeBody ? '✅' : '❌'}`);
    console.log(`   • VSCode ссылки: ${config.includeVSCode ? '✅' : '❌'}`);
    console.log(`   • Values mode: ${options.valuesMode || 'relations'}`);
    console.log(`   • Edges в отдельный файл: ${options.edges === true ? '✅' : '❌'}`);
    if (options.edges === true) {
      console.log(`   • Суффикс edges: ${options.edgesSuffix || '.edges.json'}`);
    }
    console.log('');

    // ============================================================
    // ✅ v11.0.0 + v12.0.0: применяем outputOptions из конфига
    // ============================================================
    const report = generateCompactReport(pipelineResult.enhancedMap as any, outputPath, {
      ...genOptions,
      ultra: options.ultra || false,
      preset: options.preset,
      verbose: options.verbose,

      // ✅ v12.0.0: values-mode
      valuesMode: options.valuesMode || 'relations',

      // ✅ Из конфига (outputOptions)
      compress: outputOpts.compress !== false,
      saveFullJson: outputOpts.saveFullJson !== false,
      fullJsonSuffix: outputOpts.fullJsonSuffix || '.full.json',

      // ✅ Edges
      saveEdges: options.edges === true || outputOpts.saveEdges === true,
      edgesJsonSuffix: options.edgesSuffix || outputOpts.edgesJsonSuffix || '.edges.json',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // ============================================================
    // ФИНАЛЬНАЯ СТАТИСТИКА
    // ============================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`⏱️  Время: ${duration} сек`);

    // ✅ Статистика из pipeline (более полная и всегда актуальная)
    console.log('\n📊 СТАТИСТИКА (pipeline metrics):');
    console.log(`   • Файлов: ${m.filesParsed}/${m.filesDiscovered}`);
    console.log(`   • Vue: ${m.vueFiles}, TS/JS: ${m.tsFiles}`);
    console.log(`   • Функций: ${m.totalFunctions}`);
    console.log(`   • Констант: ${m.totalConstants}`);
    console.log(`   • Импортов: ${m.totalImports}`);
    console.log(`   • Экспортов: ${m.totalExports}`);
    if (m.totalConditionals > 0) {
      console.log(`   • Conditionals: ${m.totalConditionals}`);
    }
    if (m.totalLifecycle > 0) {
      console.log(`   • Lifecycle: ${m.totalLifecycle}`);
    }
    if (m.totalReactivity > 0) {
      console.log(`   • Reactivity: ${m.totalReactivity}`);
    }
    if (m.reExportChains > 0) {
      console.log(`   • Re-exports: ${m.reExportChains}`);
    }

    // Безопасное получение статистики из отчёта
    const fullStats = report.full?.statistics;

    console.log('\n📊 СТАТИСТИКА ОТЧЕТА:');
    if (fullStats) {
      console.log(`   • Модулей: ${fullStats.totalModules}`);
      console.log(`   • Файлов: ${fullStats.totalFiles}`);
      console.log(`   • Функций: ${fullStats.totalFunctions}`);
      console.log(`   • Классов: ${fullStats.totalClasses}`);
      console.log(`   • Констант: ${fullStats.totalConstants}`);
      console.log(`   • Вызовов: ${fullStats.totalCalls}`);
      console.log(`   • Импортов: ${fullStats.totalImports}`);
      console.log(`   • Экспортов: ${fullStats.totalExports}`);
      console.log(`   • Реэкспортов: ${fullStats.totalReExports}`);
    } else {
      console.log('   ⚠️ Статистика недоступна');
    }

    // Информация о сжатии
    console.log('\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(`   • Пресет: ${options.preset}`);
    console.log(`   • Values mode: ${options.valuesMode || 'relations'}`);
    console.log(`   • Битовые флаги: ${config.useBitFlags ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Словари: ${config.useDictionaries ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Минификация ключей: ${config.minifyKeys ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Шаблоны: ${config.useTemplates ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Легенда: ${config.legend ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Self functions: ${config.selfFunctions ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Тела функций: ${config.includeBody ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • VSCode ссылки: ${config.includeVSCode ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);

    if (report.stats.compactSize !== undefined) {
      const sizeKB = (report.stats.compactSize / 1024).toFixed(2);
      const sizeMB = (report.stats.compactSize / 1024 / 1024).toFixed(2);
      console.log(`   • Размер сжатого: ${sizeKB} KB (${sizeMB} MB)`);
    }
    if (report.stats.fullSize !== undefined) {
      const fullSizeKB = (report.stats.fullSize / 1024).toFixed(2);
      console.log(`   • Размер полного: ${fullSizeKB} KB`);
    }
    if (report.stats.compressionRatio !== undefined) {
      console.log(`   • Коэффициент сжатия: ${report.stats.compressionRatio.toFixed(1)}%`);
    }

    // Информация о путях файлов
    if (report.compactPath) {
      console.log(`   • Сжатый JSON: ${report.compactPath}`);
    }
    if (report.fullPath) {
      console.log(`   • Полный JSON: ${report.fullPath}`);
    }
    if (report.edgesPath) {
      const edgesSizeKB = report.stats.edgesSize ? (report.stats.edgesSize / 1024).toFixed(2) : '0';
      console.log(`   • Edges JSON: ${report.edgesPath} (${edgesSizeKB} KB)`);
    }

    // Тайминги stages
    if (options.verbose) {
      console.log('\n⏱️  Тайминги pipeline:');
      for (const [stage, ms] of Object.entries(m.stageTimings)) {
        console.log(`   ${stage.padEnd(24)} ${ms}ms`);
      }
    }

    // ============================================================
    // Подсказки
    // ============================================================
    console.log('\n💡 ПРИНЦИП "ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ":');
    console.log('   ✅ Каждый тип данных хранится в одном месте');
    console.log('   ✅ Нет дублирования информации');
    console.log('   ✅ Все связи в едином графе');
    console.log('   ✅ Self functions с индексами sf1, sf2, ...');
    console.log('   ✅ Edges восстанавливаются из gr.* только по запросу (--edges)');
    console.log('   ✅ Values mode управляет размером секции values');
    console.log('   ✅ Единый AnalysisPipeline для всех парсеров (v13.0.0)');

    console.log('\n💡 КАК ИСПОЛЬЗОВАТЬ ОТЧЕТ:');
    console.log('   • mi/fl/fi - для навигации по индексам');
    console.log('   • fns - все функции с метаданными');
    if (report.compact?.legend) {
      console.log('   • sf - self функции (изолированные)');
    }
    console.log('   • gr.c - кто кого вызывает');
    console.log('   • gr.i - кто от кого зависит (импорты)');
    console.log('   • gr.e - кто что экспортирует');
    console.log('   • gr.h - иерархия классов');
    console.log('   • gr.td - типовые зависимости');
    console.log('   • gr.re - re-экспорты');
    console.log('   • st - общая статистика');
    console.log('   • legend - легенда для расшифровки всех кодов');

    console.log('\n💡 ПРИМЕРЫ КОМАНД:');
    console.log('   # Полный отчет');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --preset full --depth 1000');
    console.log('');
    console.log('   # Только графы (минимальный размер)');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --preset relationships');
    console.log('');
    console.log('   # Ультра-компактный');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --preset ultra --ultra');
    console.log('');
    console.log('   # С телами функций');
    console.log(
      '   npx ast-analyzer compact-recursive ./src/index.ts --preset full --include-body'
    );
    console.log('');
    console.log('   # С VSCode ссылками');
    console.log(
      '   npx ast-analyzer compact-recursive ./src/index.ts --preset full --include-vscode'
    );
    console.log('');
    console.log('   # Без импортов и экспортов (только вызовы)');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --no-imports --no-exports');
    console.log('');
    console.log('   # С edges в отдельном файле');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --preset full --edges');
    console.log('');
    console.log('   # ✅ v11.0.0: с конфиг-файлом');
    console.log(
      '   npx ast-analyzer compact-recursive ./src/index.ts --config ./ast-analyzer.config.json'
    );
    console.log('');
    console.log('   # ✅ v11.0.0: с исключениями через CLI');
    console.log(
      '   npx ast-analyzer compact-recursive ./src/index.ts --exclude "**/__tests__/**,**/fixtures/**"'
    );
    console.log('');
    console.log('   # ✅ v12.0.0: с полным values (обратная совместимость)');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --values-mode full');
    console.log('');
    console.log('   # ✅ v12.0.0: явное указание сжатого режима (по умолчанию)');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --values-mode relations');
    console.log('');

    console.log('='.repeat(70) + '\n');
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  private parseExcludePatterns(exclude: unknown): string[] {
    if (!exclude) return [];

    if (Array.isArray(exclude)) {
      return exclude.filter((p): p is string => typeof p === 'string' && p.length > 0);
    }

    if (typeof exclude === 'string') {
      return exclude
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    }

    return [];
  }

  /**
   * ✅ v13.1.0: метод collectProjectFiles УДАЛЁН.
   * Обход директории выполняет DiscoverFilesStage внутри pipeline.
   * Семантика: paths: [path.dirname(entryPath)] → рекурсивный сбор.
   */

  getCommand(): Command {
    return this.program;
  }
}

export default CompactRecursiveCommand;
