// packages/ast-analyzer/src/cli/commands/CompactRecursiveCommand.ts
// ПОЛНАЯ ВЕРСИЯ С ОБНОВЛЕНИЯМИ - БЕЗ ДУБЛЕЙ, ВСЕ ОШИБКИ TypeScript И ESLint ИСПРАВЛЕНЫ
// ДОБАВЛЕНА ПОДДЕРЖКА СЕКЦИИ SELF FUNCTIONS (sf) С ВОЗМОЖНОСТЬЮ ОТКЛЮЧЕНИЯ
// ДОБАВЛЕНА ПОДДЕРЖКА ГИБКОГО КОНФИГА С ПРЕСЕТАМИ
// ✅ ОБНОВЛЕНО: адаптация под новую структуру GenerateReportResult (compact-reporter v6.0.0)
// ✅ ОБНОВЛЕНО v2: добавлен .default(false) для --include-body/--include-security/--include-vscode
// ✅ ОБНОВЛЕНО v3: строгая проверка options.includeBody === true при применении опций
// ✅ ОБНОВЛЕНО v4: добавлена поддержка --include-vscode (проброс в configBuilder)
// ✅ ОБНОВЛЕНО v5: строгая проверка options.includeVSCode === true при применении опций
// ✅ ОБНОВЛЕНО v6: добавлена поддержка self functions через full.statistics (совместимость)
// ✅ ОБНОВЛЕНО v7: добавлена строка "VSCode ссылки" в блок "ВКЛЮЧЕННЫЕ КОМПОНЕНТЫ"
// ✅ ОБНОВЛЕНО v8: добавлены флаги --edges и --edges-suffix для сохранения edges в отдельный файл
// ✅ ОБНОВЛЕНО v9: проброс saveEdges / edgesJsonSuffix в generateCompactReport

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { generateCompactReport } from '../../reporters/compact-reporter.js';
import { getPresetNames, createCompactConfig } from '../../reporters/CompactReportConfig.js';

/**
 * Команда для рекурсивного компакт-отчета
 * Работает как project + compact: строит граф зависимостей,
 * собирает все файлы и генерирует компактный отчет
 *
 * ОСОБЕННОСТИ:
 * - НЕТ ДУБЛИРОВАНИЯ: каждый тип данных в одном месте
 * - НОВЫЕ ТИПЫ СВЯЗЕЙ: импорты, экспорты, наследование, типовые зависимости
 * - СЖАТИЕ: короткие ключи, сжатые флаги
 * - SELF FUNCTIONS: изолированные функции с индексами sf1, sf2, ...
 * - ГИБКИЙ КОНФИГ: 5 пресетов + 30+ опций для тонкой настройки
 * - ВСЕ ОШИБКИ TypeScript И ESLint ИСПРАВЛЕНЫ
 * - ✅ EDGES: опционально, по умолчанию выключено, сохраняется в отдельный файл
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
      .option(
        '--preset <name>',
        `Пресет: ${getPresetNames().join(', ')}. Подробнее: https://docs.ast-analyzer.dev/presets`,
        'standard'
      )
      .option('--ultra', 'Ультра-компактный режим (максимальное сжатие, экономия ~70%)')

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

      // === ✅ v8: EDGES (отдельный файл, по умолчанию выключено) ===
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
      // ✅ ИСПРАВЛЕНО v2: добавлен .default(false) для boolean-флагов
      .option('--no-flags', 'Отключить битовые флаги (flg)')
      .option('--no-types', 'Отключить типы (types)')
      .option('--no-legend', 'Отключить легенду (legend)')
      .option('--include-body', 'Включить тела функций (увеличивает размер)', false)
      .option('--include-security', 'Включить информацию о безопасности', false)
      // ✅ ИСПРАВЛЕНО v4: добавлена опция --include-vscode
      .option('--include-vscode', 'Включить VSCode ссылки для функций', false)

      // === ФОРМАТИРОВАНИЕ ===
      .option('--minify-keys', 'Минифицировать ключи (более короткие имена)')
      .option('--no-bit-flags', 'Отключить битовые флаги (использовать полные булевы поля)')
      .option('--no-dictionaries', 'Отключить словари для параметров и типов')
      .option('--no-templates', 'Отключить использование шаблонов')
      .option('--readable-keys', 'Использовать читаемые ключи (вместо сокращений)')

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

  private async execute(entry: string, options: any): Promise<void> {
    const startTime = Date.now();
    const entryPath = path.resolve(entry);

    console.log('\n' + '='.repeat(70));
    console.log('📋 КОМПАКТНЫЙ ОТЧЕТ С ГИБКОЙ НАСТРОЙКОЙ');
    console.log('='.repeat(70));
    console.log(`📄 Точка входа: ${entryPath}`);
    console.log(`📏 Глубина: ${options.depth}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📁 Выходной файл: ${options.output}`);
    console.log(`🚀 Ультра-компактный: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`🔗 Edges в отдельный файл: ${options.edges === true ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);

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
    // ✅ ИСПРАВЛЕНО v2: показываем состояние includeBody в логе
    console.log(`   • Тела функций: ${options.includeBody === true ? '✅' : '❌'}`);
    // ✅ НОВОЕ v7: показываем состояние includeVSCode в логе "ВКЛЮЧЕННЫЕ КОМПОНЕНТЫ"
    console.log(`   • VSCode ссылки: ${options.includeVSCode === true ? '✅' : '❌'}`);
    // ✅ НОВОЕ v8: показываем состояние edges в логе "ВКЛЮЧЕННЫЕ КОМПОНЕНТЫ"
    console.log(`   • Edges в отдельный файл: ${options.edges === true ? '✅' : '❌'}`);
    console.log('');

    if (!fs.existsSync(entryPath)) {
      console.error(`❌ Файл не найден: ${entryPath}`);
      process.exit(1);
    }

    // Шаг 1: Строим граф проекта
    console.log('📊 Шаг 1: Построение графа зависимостей проекта...');
    const { ProjectGraphBuilder } = await import('../../core/ProjectGraphBuilder.js');

    const builder = new ProjectGraphBuilder({
      maxDepth: parseInt(options.depth, 10),
      includeExternal: false,
    });

    const graphData = builder.build(entryPath);
    const graphStats = builder.getStats();

    console.log(
      `   ✅ Граф построен: ${graphStats.totalNodes} узлов, ${graphStats.totalEdges} ребер`
    );
    console.log(`   🔄 Циклов: ${graphStats.cyclesCount}`);

    // Шаг 2: Собираем все файлы из графа
    console.log('\n📁 Шаг 2: Сбор всех файлов проекта...');
    const allFiles = Object.keys(graphData.graph);

    if (allFiles.length === 0) {
      console.error('❌ Не найдено файлов для анализа');
      process.exit(1);
    }

    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];
    const validFiles = allFiles.filter(file => {
      if (!fs.existsSync(file)) return false;
      const ext = path.extname(file);
      return supportedExtensions.includes(ext);
    });

    console.log(`   📄 Найдено файлов: ${validFiles.length}`);
    console.log(`   📊 Из них уникальных: ${new Set(validFiles).size}`);

    if (validFiles.length === 0) {
      console.error('❌ Нет валидных файлов для анализа');
      process.exit(1);
    }

    // Шаг 3: Извлекаем сущности
    console.log('\n🔍 Шаг 3: Извлечение сущностей из всех файлов...');
    const { extractEntitiesFromFile } = await import('../../reporters/json-reporter.js');

    const entitiesMap: Record<string, any> = {};
    let processedFiles = 0;

    for (const file of validFiles) {
      try {
        if (options.verbose) {
          console.log(`   📄 Обработка: ${path.basename(file)}`);
        }

        const entities = extractEntitiesFromFile(file);
        if (entities && Object.keys(entities).length > 0) {
          const relativePath = path.relative(process.cwd(), file);
          entitiesMap[relativePath] = entities;
          processedFiles++;
        }
      } catch (error) {
        if (options.verbose) {
          console.warn(`   ⚠️ Ошибка при обработке ${path.basename(file)}:`, error);
        }
      }
    }

    console.log(`   ✅ Обработано файлов: ${processedFiles}/${validFiles.length}`);

    if (Object.keys(entitiesMap).length === 0) {
      console.error('❌ Не найдено сущностей для анализа');
      process.exit(1);
    }

    // Шаг 4: Генерируем отчет с применением конфига
    console.log('\n📋 Шаг 4: Генерация компактного отчета с применением конфига...');

    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Создаем конфиг из опций
    const configBuilder = createCompactConfig(options.preset || 'standard');

    // ============================================
    // ✅ ИСПРАВЛЕНО v3: строгая проверка === true
    // ============================================
    // Commander без .default() возвращает undefined для boolean-флагов,
    // поэтому `if (undefined)` НЕ срабатывает. Используем строгое сравнение.
    // ============================================

    // Форматирование
    if (options.ultra)
      configBuilder.setMinifyKeys(true).setUseBitFlags(true).setUseDictionaries(true);
    if (options.minifyKeys) configBuilder.setMinifyKeys(true);
    if (options.bitFlags === false) configBuilder.setUseBitFlags(false);
    if (options.dictionaries === false) configBuilder.setUseDictionaries(false);
    if (options.templates === false) configBuilder.setUseTemplates(false);
    if (options.readableKeys) configBuilder.setReadableKeys(true);

    // ✅ ИСПРАВЛЕНО: строгая проверка === true
    if (options.includeBody === true) configBuilder.setIncludeBody(true);
    if (options.includeSecurity === true) configBuilder.setIncludeSecurity(true);
    // ✅ ИСПРАВЛЕНО v5: строгая проверка === true для includeVSCode
    if (options.includeVSCode === true) configBuilder.setIncludeVSCode(true);

    if (options.depth) configBuilder.setMaxDepth(parseInt(options.depth, 10));

    // Сущности
    if (options.functions === false) configBuilder.includeFunctions(false);
    if (options.constants === false) configBuilder.includeConstants(false);
    if (options.selfFunctions === false) configBuilder.includeSelfFunctions(false);

    // Связи - если relations отключены, отключаем всё
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
      // Иначе применяем индивидуальные опции
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

    // ✅ ИСПРАВЛЕНО v2: показываем реальное состояние includeBody
    // ✅ ИСПРАВЛЕНО v5: показываем реальное состояние includeVSCode
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
    // ✅ НОВОЕ v8: строка про edges в итоговой конфигурации
    console.log(`   • Edges в отдельный файл: ${options.edges === true ? '✅' : '❌'}`);
    if (options.edges === true) {
      console.log(`   • Суффикс edges: ${options.edgesSuffix || '.edges.json'}`);
    }
    console.log('');

    // ============================================
    // ✅ ИСПРАВЛЕНО: используем новую структуру GenerateReportResult
    // ✅ v8: пробрасываем saveEdges и edgesJsonSuffix
    // ============================================
    const report = generateCompactReport(entitiesMap, outputPath, {
      ...genOptions,
      ultra: options.ultra || false,
      preset: options.preset,
      verbose: options.verbose,
      compress: true,
      saveFullJson: true,
      // ✅ v8: edges — только если явно запрошено
      saveEdges: options.edges === true,
      edgesJsonSuffix: options.edgesSuffix || '.edges.json',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Вывод результатов
    console.log('\n' + '='.repeat(70));
    console.log('✅ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`⏱️  Время: ${duration} сек`);

    // ============================================
    // ✅ ИСПРАВЛЕНО: безопасное получение статистики из новой структуры
    // ============================================
    const fullStats = report.full?.statistics;

    console.log('\n📊 СТАТИСТИКА ОТЧЕТА:');
    if (fullStats) {
      console.log(`   • Функций: ${fullStats.totalFunctions}`);
      console.log(`   • Классов: ${fullStats.totalClasses}`);
      console.log(`   • Констант: ${fullStats.totalConstants}`);
      console.log(`   • Вызовов: ${fullStats.totalCalls}`);
      console.log(`   • Модулей: ${fullStats.totalModules}`);
      console.log(`   • Файлов: ${fullStats.totalFiles}`);
      console.log(`   • Импортов: ${fullStats.totalImports}`);
      console.log(`   • Экспортов: ${fullStats.totalExports}`);
      console.log(`   • Реэкспортов: ${fullStats.totalReExports}`);
    } else {
      console.log('   ⚠️ Статистика недоступна');
    }

    // ============================================
    // ✅ ИСПРАВЛЕНО: размеры из report.stats
    // ============================================
    console.log('\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(`   • Пресет: ${options.preset}`);
    console.log(`   • Битовые флаги: ${config.useBitFlags ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Словари: ${config.useDictionaries ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Минификация ключей: ${config.minifyKeys ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Шаблоны: ${config.useTemplates ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Легенда: ${config.legend ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Self functions: ${config.selfFunctions ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Тела функций: ${config.includeBody ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    // ✅ ИСПРАВЛЕНО v5: показываем реальное состояние includeVSCode
    console.log(`   • VSCode ссылки: ${config.includeVSCode ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);

    // Размеры файлов
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
    // ✅ НОВОЕ v8: информация о файле edges
    if (report.edgesPath) {
      const edgesSizeKB = report.stats.edgesSize ? (report.stats.edgesSize / 1024).toFixed(2) : '0';
      console.log(`   • Edges JSON: ${report.edgesPath} (${edgesSizeKB} KB)`);
    }

    console.log('\n💡 ПРИНЦИП "ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ":');
    console.log('   ✅ Каждый тип данных хранится в одном месте');
    console.log('   ✅ Нет дублирования информации');
    console.log('   ✅ Все связи в едином графе');
    console.log('   ✅ Добавлены новые типы связей (без дублей)');
    console.log('   ✅ Self functions с индексами sf1, sf2, ...');
    console.log('   ✅ Edges восстанавливаются из gr.* только по запросу (--edges)');

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
    // ✅ НОВОЕ v8: примеры с --edges
    console.log('   # С edges в отдельном файле');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --preset full --edges');
    console.log('');
    console.log('   # С кастомным суффиксом для edges');
    console.log(
      '   npx ast-analyzer compact-recursive ./src/index.ts --edges --edges-suffix .graph.json'
    );
    console.log('');

    console.log('='.repeat(70) + '\n');
  }

  getCommand(): Command {
    return this.program;
  }
}

export default CompactRecursiveCommand;
