// packages/ast-analyzer/src/cli/commands/CompactRecursiveCommand.ts
// ПОЛНАЯ ВЕРСИЯ С ОБНОВЛЕНИЯМИ - БЕЗ ДУБЛЕЙ, ВСЕ ОШИБКИ TypeScript И ESLint ИСПРАВЛЕНЫ
// ДОБАВЛЕНА ПОДДЕРЖКА СЕКЦИИ SELF FUNCTIONS (sf) С ВОЗМОЖНОСТЬЮ ОТКЛЮЧЕНИЯ

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { generateCompactReport } from '../../reporters/compact-reporter.js';

// Используем any вместо несуществующего типа
type CompactReportStats = any;

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
 * - ВСЕ ОШИБКИ TypeScript И ESLint ИСПРАВЛЕНЫ
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
      .description('📋 Генерация компактного отчета для всего проекта (без дублирования)')
      .option('-o, --output <file>', 'Выходной файл', './reports/ast-analyzer-full.json')
      .option('-d, --depth <n>', 'Максимальная глубина анализа', '100')
      .option('--ultra', 'Ультра-компактный режим (максимальное сжатие)')
      .option(
        '--preset <name>',
        'Пресет: minimal, standard, full, relationshipsOnly, ultraCompact',
        'standard'
      )
      .option('--no-relations', 'Отключить дополнительные типы связей (только вызовы)')
      .option('--no-stats', 'Отключить статистику')
      .option('--no-templates', 'Отключить использование шаблонов')
      .option('--no-self-functions', 'Отключить секцию self functions (изолированные функции)') // ✅ НОВАЯ ОПЦИЯ
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
    console.log('📋 КОМПАКТНЫЙ ОТЧЕТ (БЕЗ ДУБЛИРОВАНИЯ)');
    console.log('='.repeat(70));
    console.log(`📄 Точка входа: ${entryPath}`);
    console.log(`📏 Глубина: ${options.depth}`);
    console.log(`🚀 Ультра-компактный: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📁 Выходной файл: ${options.output}`);
    console.log(
      `🔗 Дополнительные связи: ${options.relations !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`
    );
    console.log(`📊 Статистика: ${options.stats !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(
      `🧩 Self functions: ${options.selfFunctions !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}` // ✅
    );
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

    // Шаг 4: Генерируем отчет БЕЗ ДУБЛИРОВАНИЯ
    console.log('\n📋 Шаг 4: Генерация компактного отчета (без дублирования)...');

    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Используем ТОЛЬКО существующие опции generateCompactReport
    const report = generateCompactReport(entitiesMap, outputPath, {
      useBitFlags: true,
      useDictionaries: true,
      readableKeys: true,
      useTemplates: options.templates !== false,
      maxDepth: parseInt(options.depth, 10),
      includeRelations: options.relations !== false,
      includeStats: options.stats !== false,
      includeTypes: true,
      includeInheritance: true,
      includeExports: true,
      includeConstants: true,
      includeSelfFunctions: options.selfFunctions !== false, // ✅ ПЕРЕДАЕМ ОПЦИЮ
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Вывод результатов
    console.log('\n' + '='.repeat(70));
    console.log('✅ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`⏱️  Время: ${duration} сек`);

    // БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СТАТИСТИКИ
    const reportStats = (report.st || {}) as CompactReportStats;

    console.log('\n📊 СТАТИСТИКА ОТЧЕТА:');
    console.log(`   • Функций: ${reportStats.tf ?? 0}`);
    console.log(`   • Self функций: ${reportStats.tsf ?? 0}`); // ✅
    console.log(`   • Вызовов: ${reportStats.tc ?? 0}`);
    console.log(`   • Модулей: ${reportStats.tm ?? 0}`);
    console.log(`   • Файлов: ${reportStats.tfils ?? 0}`);
    console.log(`   • Импортов: ${reportStats.ti ?? 0}`);
    console.log(`   • Экспортов: ${reportStats.te ?? 0}`);
    console.log(`   • Наследований: ${reportStats.tr ?? 0}`);
    console.log(`   • Типовых зависимостей: ${reportStats.ttd ?? 0}`);
    console.log(`   • Циклов: ${reportStats.cy ? 'ЕСТЬ' : 'НЕТ'}`);

    console.log('\n📋 СТРУКТУРА ОТЧЕТА (БЕЗ ДУБЛЕЙ):');
    console.log('   📌 Индексы (только здесь!):');
    console.log('      • mi - moduleIndex (имена модулей)');
    console.log('      • fl - fileIndex (пути файлов)');
    console.log('      • fi - functionIndex (ссылки)');
    console.log('   📌 Данные (только здесь!):');
    console.log('      • fns - функции (БЕЗ calls!)');
    console.log('      • sf - self functions (изолированные функции) ✅ НОВОЕ');
    console.log('   📌 Связи (все в одном месте):');

    const hasRelations = report.gr !== undefined;
    if (hasRelations) {
      console.log('      • gr.c - вызовы (calls)');
      if (report.gr?.i) console.log('      • gr.i - импорты (imports) ✅ НОВОЕ');
      if (report.gr?.e) console.log('      • gr.e - экспорты (exports) ✅ НОВОЕ');
      if (report.gr?.h) console.log('      • gr.h - наследование (inheritance) ✅ НОВОЕ');
      if (report.gr?.td) console.log('      • gr.td - типовые зависимости (typeDeps) ✅ НОВОЕ');
    } else {
      console.log('      • graph - вызовы (только)');
    }

    console.log('   📌 Статистика (вычисляемые данные):');
    console.log('      • st - stats (включая tsf - total self functions)');

    // Информация о сжатии
    console.log('\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(
      `   • Дополнительные связи: ${options.relations !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`
    );
    console.log(`   • Статистика: ${options.stats !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(
      `   • Self functions: ${options.selfFunctions !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}` // ✅
    );

    // Размер файла
    if (fs.existsSync(outputPath)) {
      const stat = fs.statSync(outputPath);
      const sizeKB = (stat.size / 1024).toFixed(2);
      console.log(`   • Размер файла: ${sizeKB} KB`);
    }

    console.log('\n💡 ПРИНЦИП "ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ":');
    console.log('   ✅ Каждый тип данных хранится в одном месте');
    console.log('   ✅ Нет дублирования информации');
    console.log('   ✅ Все связи в едином графе');
    console.log('   ✅ Добавлены новые типы связей (без дублей)');
    console.log('   ✅ Self functions с индексами sf1, sf2, ...');

    // Подсказки по использованию
    console.log('\n💡 КАК ИСПОЛЬЗОВАТЬ ОТЧЕТ:');
    console.log('   • mi/fl/fi - для навигации по индексам');
    console.log('   • fns - все функции с метаданными');
    if (report.sf && report.sf.length > 0) {
      console.log(`   • sf - self функции (${report.sf.length} изолированных функций) ✅`); // ✅
    }
    if (hasRelations) {
      console.log('   • gr.c - кто кого вызывает');
      console.log('   • gr.i - кто от кого зависит (импорты)');
      console.log('   • gr.e - кто что экспортирует');
      console.log('   • gr.h - иерархия классов');
      console.log('   • gr.td - типовые зависимости');
    }
    console.log('   • st - общая статистика (включая tsf)');

    console.log('\n' + '='.repeat(70) + '\n');
  }

  getCommand(): Command {
    return this.program;
  }
}

export default CompactRecursiveCommand;
