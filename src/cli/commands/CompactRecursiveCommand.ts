// packages/ast-analyzer/src/cli/commands/CompactRecursiveCommand.ts
// ПОЛНАЯ ВЕРСИЯ С ОБНОВЛЕНИЯМИ - УНИФИЦИРОВАННЫЙ ГРАФ (v7.0.0)

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { generateCompactReport } from '../../reporters/compact-reporter.js';
import { getPresetNames, createCompactConfig } from '../../reporters/CompactReportConfig.js';

// Используем any вместо несуществующего типа
type CompactReportStats = any;

/**
 * Команда для рекурсивного компакт-отчета
 * Работает как project + compact: строит граф зависимостей,
 * собирает все файлы и генерирует унифицированный граф (v7.0.0)
 *
 * ОСОБЕННОСТИ:
 * - УНИФИЦИРОВАННЫЙ ГРАФ: все сущности в единой структуре
 * - Узлы: file, module, function, constant, class, interface, type, variable
 * - Ребра: contains, calls, imports, exports, inherits, implements, type_ref
 * - СЖАТИЕ: словари для имен, типов, отношений
 * - ГИБКИЙ КОНФИГ: 5 пресетов + 30+ опций для тонкой настройки
 * - РАЗМЕР: ~80% меньше по сравнению со старым форматом
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
      .description('📋 Генерация унифицированного графа (файл → модуль → функция)')

      // === ОСНОВНЫЕ ОПЦИИ ===
      .option('-o, --output <file>', 'Выходной файл', './reports/ast-analyzer-full.json')
      .option('-d, --depth <n>', 'Максимальная глубина анализа', '100')
      .option(
        '--preset <name>',
        `Пресет: ${getPresetNames().join(', ')}. Подробнее: https://docs.ast-analyzer.dev/presets`,
        'standard'
      )
      .option('--ultra', 'Ультра-компактный режим (максимальное сжатие, экономия ~80%)')

      // === ВКЛЮЧЕНИЕ/ОТКЛЮЧЕНИЕ СУЩНОСТЕЙ ===
      .option('--no-files', 'Отключить файлы')
      .option('--no-modules', 'Отключить модули')
      .option('--no-functions', 'Отключить функции')
      .option('--no-constants', 'Отключить константы')
      .option('--no-classes', 'Отключить классы')
      .option('--no-interfaces', 'Отключить интерфейсы')
      .option('--no-types', 'Отключить типы')
      .option('--no-variables', 'Отключить переменные')

      // === ВКЛЮЧЕНИЕ/ОТКЛЮЧЕНИЕ СВЯЗЕЙ ===
      .option('--no-calls', 'Отключить вызовы')
      .option('--no-imports', 'Отключить импорты')
      .option('--no-exports', 'Отключить экспорты')
      .option('--no-inheritance', 'Отключить наследование')
      .option('--no-type-deps', 'Отключить типовые зависимости')

      // === СТАТИСТИКА ===
      .option('--no-stats', 'Отключить статистику')
      .option('--no-cycles', 'Отключить поиск циклов')

      // === ФОРМАТИРОВАНИЕ ===
      .option('--minify-keys', 'Минифицировать ключи (более короткие имена)')
      .option('--no-bit-flags', 'Отключить битовые флаги (использовать полные булевы поля)')
      .option('--no-dictionaries', 'Отключить словари для параметров и типов')
      .option('--no-templates', 'Отключить использование шаблонов')
      .option('--readable-keys', 'Использовать читаемые ключи (вместо сокращений)')
      .option('--include-body', 'Включить тела функций (увеличивает размер)')
      .option('--include-security', 'Включить информацию о безопасности')
      .option('--include-vscode', 'Включить VSCode ссылки для функций')

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
    console.log('📋 УНИФИЦИРОВАННЫЙ ГРАФ (v7.0.0)');
    console.log('='.repeat(70));
    console.log(`📄 Точка входа: ${entryPath}`);
    console.log(`📏 Глубина: ${options.depth}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📁 Выходной файл: ${options.output}`);
    console.log(`🚀 Ультра-компактный: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);

    // Показываем что включено
    console.log('\n📊 ВКЛЮЧЕННЫЕ КОМПОНЕНТЫ:');
    console.log(`   • Файлы: ${options.files !== false ? '✅' : '❌'}`);
    console.log(`   • Модули: ${options.modules !== false ? '✅' : '❌'}`);
    console.log(`   • Функции: ${options.functions !== false ? '✅' : '❌'}`);
    console.log(`   • Константы: ${options.constants !== false ? '✅' : '❌'}`);
    console.log(`   • Классы: ${options.classes !== false ? '✅' : '❌'}`);
    console.log(`   • Интерфейсы: ${options.interfaces !== false ? '✅' : '❌'}`);
    console.log(`   • Типы: ${options.types !== false ? '✅' : '❌'}`);
    console.log(`   • Переменные: ${options.variables !== false ? '✅' : '❌'}`);
    console.log(`   • Вызовы: ${options.calls !== false ? '✅' : '❌'}`);
    console.log(`   • Импорты: ${options.imports !== false ? '✅' : '❌'}`);
    console.log(`   • Экспорты: ${options.exports !== false ? '✅' : '❌'}`);
    console.log(`   • Наследование: ${options.inheritance !== false ? '✅' : '❌'}`);
    console.log(`   • Типовые зависимости: ${options.typeDeps !== false ? '✅' : '❌'}`);
    console.log(`   • Статистика: ${options.stats !== false ? '✅' : '❌'}`);
    console.log(`   • Поиск циклов: ${options.cycles !== false ? '✅' : '❌'}`);
    console.log(`   • Тела функций: ${options.includeBody ? '✅' : '❌'}`);
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

    // Шаг 4: Генерируем унифицированный граф
    console.log('\n📋 Шаг 4: Генерация унифицированного графа (v7.0.0)...');

    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Создаем конфиг из опций
    const configBuilder = createCompactConfig(options.preset || 'standard');

    // Применяем опции из командной строки
    // Форматирование
    if (options.ultra) {
      configBuilder
        .setMinifyKeys(true)
        .setUseBitFlags(true)
        .setUseDictionaries(true)
        .setUseTemplates(true)
        .setReadableKeys(false);
    }
    if (options.minifyKeys) configBuilder.setMinifyKeys(true);
    if (options.bitFlags === false) configBuilder.setUseBitFlags(false);
    if (options.dictionaries === false) configBuilder.setUseDictionaries(false);
    if (options.templates === false) configBuilder.setUseTemplates(false);
    if (options.readableKeys) configBuilder.setReadableKeys(true);
    if (options.includeBody) configBuilder.setIncludeBody(true);
    if (options.includeSecurity) configBuilder.setIncludeSecurity(true);
    if (options.includeVSCode) configBuilder.setIncludeVSCode(true);
    if (options.depth) configBuilder.setMaxDepth(parseInt(options.depth, 10));

    // Сущности
    if (options.files === false) configBuilder.includeFiles(false);
    if (options.modules === false) configBuilder.includeModules(false);
    if (options.functions === false) configBuilder.includeFunctions(false);
    if (options.constants === false) configBuilder.includeConstants(false);
    if (options.classes === false) configBuilder.includeClasses(false);
    if (options.interfaces === false) configBuilder.includeInterfaces(false);
    if (options.types === false) configBuilder.includeTypes(false);
    if (options.variables === false) configBuilder.includeVariables(false);

    // Связи
    if (options.calls === false) configBuilder.includeCalls(false);
    if (options.imports === false) configBuilder.includeImports(false);
    if (options.exports === false) configBuilder.includeExports(false);
    if (options.inheritance === false) configBuilder.includeInheritance(false);
    if (options.typeDeps === false) configBuilder.includeTypeDeps(false);

    // Статистика
    if (options.stats === false) configBuilder.includeStats(false);
    if (options.cycles === false) configBuilder.includeCycles(false);

    const config = configBuilder.build();
    const genOptions = configBuilder.toGeneratorOptions();

    console.log('\n📋 ИТОГОВАЯ КОНФИГУРАЦИЯ:');
    console.log(`   • Пресет: ${options.preset}`);
    console.log(`   • Файлы: ${config.includeFiles ? '✅' : '❌'}`);
    console.log(`   • Модули: ${config.includeModules ? '✅' : '❌'}`);
    console.log(`   • Функции: ${config.includeFunctions ? '✅' : '❌'}`);
    console.log(`   • Константы: ${config.includeConstants ? '✅' : '❌'}`);
    console.log(`   • Классы: ${config.includeClasses ? '✅' : '❌'}`);
    console.log(`   • Интерфейсы: ${config.includeInterfaces ? '✅' : '❌'}`);
    console.log(`   • Типы: ${config.includeTypes ? '✅' : '❌'}`);
    console.log(`   • Переменные: ${config.includeVariables ? '✅' : '❌'}`);
    console.log(`   • Вызовы: ${config.includeCalls ? '✅' : '❌'}`);
    console.log(`   • Импорты: ${config.includeImports ? '✅' : '❌'}`);
    console.log(`   • Экспорты: ${config.includeExports ? '✅' : '❌'}`);
    console.log(`   • Наследование: ${config.includeInheritance ? '✅' : '❌'}`);
    console.log(`   • Типовые зависимости: ${config.includeTypeDeps ? '✅' : '❌'}`);
    console.log(`   • Статистика: ${config.includeStats ? '✅' : '❌'}`);
    console.log(`   • Поиск циклов: ${config.includeCycles ? '✅' : '❌'}`);
    console.log(`   • Битовые флаги: ${config.useBitFlags ? '✅' : '❌'}`);
    console.log(`   • Словари: ${config.useDictionaries ? '✅' : '❌'}`);
    console.log(`   • Шаблоны: ${config.useTemplates ? '✅' : '❌'}`);
    console.log(`   • Тела функций: ${config.includeBody ? '✅' : '❌'}`);
    console.log(`   • VSCode ссылки: ${config.includeVSCode ? '✅' : '❌'}`);
    console.log('');

    // Генерируем отчет с использованием конфига
    const report = generateCompactReport(entitiesMap, outputPath, {
      ...genOptions,
      ultra: options.ultra || false,
      preset: options.preset,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Вывод результатов
    console.log('\n' + '='.repeat(70));
    console.log('✅ УНИФИЦИРОВАННЫЙ ГРАФ СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`⏱️  Время: ${duration} сек`);

    // БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СТАТИСТИКИ
    const reportStats = (report.st || {}) as CompactReportStats;

    console.log('\n📊 СТАТИСТИКА ГРАФА:');
    console.log(`   • Узлов: ${reportStats.totalNodes ?? 0}`);
    console.log(`   • Ребер: ${reportStats.totalEdges ?? 0}`);
    console.log(`   • Файлов: ${reportStats.totalFiles ?? 0}`);
    console.log(`   • Модулей: ${reportStats.totalModules ?? 0}`);
    console.log(`   • Функций: ${reportStats.totalFunctions ?? 0}`);
    console.log(`   • Констант: ${reportStats.totalConstants ?? 0}`);
    console.log(`   • Классов: ${reportStats.totalClasses ?? 0}`);
    console.log(`   • Интерфейсов: ${reportStats.totalInterfaces ?? 0}`);
    console.log(`   • Типов: ${reportStats.totalTypes ?? 0}`);
    console.log(`   • Переменных: ${reportStats.totalVariables ?? 0}`);
    console.log(`   • Вызовов: ${reportStats.totalCalls ?? 0}`);
    console.log(`   • Импортов: ${reportStats.totalImports ?? 0}`);
    console.log(`   • Экспортов: ${reportStats.totalExports ?? 0}`);
    console.log(`   • Циклов: ${reportStats.cyclesCount ?? 0}`);

    // Информация о сжатии
    console.log('\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(`   • Пресет: ${options.preset}`);
    console.log(`   • Битовые флаги: ${config.useBitFlags ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Словари: ${config.useDictionaries ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Минификация ключей: ${config.minifyKeys ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Шаблоны: ${config.useTemplates ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Тела функций: ${config.includeBody ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);

    // Размер файла
    if (fs.existsSync(outputPath)) {
      const stat = fs.statSync(outputPath);
      const sizeKB = (stat.size / 1024).toFixed(2);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      console.log(`   • Размер файла: ${sizeKB} KB (${sizeMB} MB)`);
    }

    console.log('\n💡 СТРУКТУРА УНИФИЦИРОВАННОГО ГРАФА:');
    console.log('   • file → module (contains)');
    console.log('   • module → function/class/constant/interface/type/variable (contains)');
    console.log('   • function → function (calls)');
    console.log('   • file → file (imports)');
    console.log('   • module → function/class/constant/interface/type/variable (exports)');
    console.log('   • class → class (inherits, implements)');
    console.log('   • interface → interface (inherits)');
    console.log('   • type → type (type_ref)');

    console.log('\n💡 ПРИМЕРЫ ЗАПРОСОВ К ГРАФУ:');
    console.log('   // Найти все функции в модуле');
    console.log('   const containsIdx = report.dict.relations.indexOf("contains");');
    console.log(
      '   const moduleEdges = report.edges.filter(e => e[0] === moduleId && e[2] === containsIdx);'
    );
    console.log('');
    console.log('   // Найти все вызовы функции');
    console.log('   const callsIdx = report.dict.relations.indexOf("calls");');
    console.log('   const calls = report.edges.filter(e => e[0] === funcId && e[2] === callsIdx);');
    console.log('');
    console.log('   // Найти все импорты файла');
    console.log('   const importsIdx = report.dict.relations.indexOf("imports");');
    console.log(
      '   const imports = report.edges.filter(e => e[0] === fileId && e[2] === importsIdx);'
    );
    console.log('');
    console.log('   // Получить имя узла');
    console.log('   const node = report.nodes[nodeId];');
    console.log('   const name = report.dict.names[node[1]];');
    console.log('');
    console.log('   // Получить метаданные узла');
    console.log('   const meta = report.dict.metadata[node[2]];');

    console.log('\n💡 ПРИМЕРЫ КОМАНД:');
    console.log('   # Полный граф');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --preset full --depth 1000');
    console.log('');
    console.log('   # Только граф зависимостей (минимальный размер)');
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
    console.log('   # Без импортов и экспортов (только вызовы)');
    console.log('   npx ast-analyzer compact-recursive ./src/index.ts --no-imports --no-exports');

    console.log('\n' + '='.repeat(70) + '\n');
  }

  getCommand(): Command {
    return this.program;
  }
}

export default CompactRecursiveCommand;
