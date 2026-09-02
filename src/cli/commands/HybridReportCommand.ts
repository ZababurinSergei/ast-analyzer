// packages/ast-analyzer/src/cli/commands/HybridReportCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';

/**
 * Команда для генерации гибридного отчета
 *
 * Гибридный отчет объединяет:
 * - Граф зависимостей модулей (project graph)
 * - Внутренние графы файлов (file graph)
 * - Функции и их вызовы
 * - 3D координатную систему уровней
 * - Интерактивную визуализацию
 *
 * Использование:
 *   npx ast-analyzer hybrid-report <file> [options]
 *   npx ast-analyzer hybrid <file> --depth 5
 */
export class HybridReportCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('hybrid-report <file>')
      .description('Generate hybrid report: modules + functions with 3D coordinate system')
      .alias('hybrid')
      .option('-d, --depth <n>', 'Maximum depth for analysis', '5')
      .option('-o, --output <dir>', 'Output directory for reports', './hybrid-reports')
      .option('--no-json', 'Skip JSON report generation')
      .option('--no-md', 'Skip Markdown report generation')
      .option('--no-dot', 'Skip DOT graph generation')
      .option('--no-html', 'Skip HTML report generation')
      .option('--no-internal-graphs', 'Skip internal file graphs')
      .option('--min-level <n>', 'Minimum level for 3D coordinate system', '0')
      .option('-v, --verbose', 'Verbose output')
      .action(async (file, options) => {
        console.log('\n' + '='.repeat(70));
        console.log('🔀 ГИБРИДНЫЙ ОТЧЕТ: МОДУЛИ + ФУНКЦИИ');
        console.log('='.repeat(70));
        console.log(`📄 Точка входа: ${file}`);
        console.log(`📏 Глубина анализа: ${options.depth}`);
        console.log(`📁 Выходная директория: ${options.output}`);
        console.log(`🎯 Минимальный уровень: ${options.minLevel}`);
        console.log(`🔧 Форматы: ${this.getFormats(options)}`);
        console.log('='.repeat(70) + '\n');

        // Проверяем существование файла
        const absolutePath = path.resolve(file);
        if (!fs.existsSync(absolutePath)) {
          console.error(`❌ Файл не найден: ${absolutePath}`);
          process.exit(1);
        }

        // Создаем выходную директорию
        const outputDir = path.resolve(options.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
          console.log(`📁 Создана выходная директория: ${outputDir}\n`);
        }

        // Проверяем доступность Graphviz для SVG
        try {
          const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
          await Graphviz.load();
          console.log('✅ Graphviz доступен для генерации SVG\n');
        } catch (error) {
          console.warn('⚠️ Graphviz не доступен, SVG генерация будет пропущена');
          console.warn('   Установите: npm install @hpcc-js/wasm-graphviz\n');
        }

        try {
          // Импортируем функции для генерации отчета
          const { runHybridReport } = await import('../../modes/hybrid-report/index.js');
          const { generateHybridDOT, generateHybridHTML, generateHybridMarkdown } = await import('../../modes/hybrid-report/index.js');

          // Строим отчет
          console.log('📊 Построение гибридного отчета...');
          const startTime = Date.now();

          // Сначала строим базовый отчет
          const report = await runHybridReport(absolutePath, parseInt(options.depth), outputDir);

          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`\n⏱️ Отчет построен за ${duration} сек`);

          // Проверяем наличие данных
          if (!report || !report.modules || report.modules.length === 0) {
            console.error('❌ Отчет не содержит данных');
            process.exit(1);
          }

          // Сохраняем JSON отчет
          if (options.json !== false) {
            const jsonPath = path.join(outputDir, 'hybrid-report.json');
            fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
            console.log(`📄 JSON отчет сохранен: ${jsonPath}`);
          }

          // Сохраняем Markdown отчет
          if (options.md !== false) {
            const mdPath = path.join(outputDir, 'hybrid-report.md');
            const md = generateHybridMarkdown(report);
            fs.writeFileSync(mdPath, md);
            console.log(`📄 Markdown отчет сохранен: ${mdPath}`);
          }

          // Сохраняем DOT граф
          if (options.dot !== false) {
            const dotPath = path.join(outputDir, 'hybrid-report.dot');
            const dot = generateHybridDOT(report);
            fs.writeFileSync(dotPath, dot);
            console.log(`📄 DOT граф сохранен: ${dotPath}`);
          }

          // Сохраняем HTML отчет
          if (options.html !== false) {
            console.log('📄 Генерация HTML отчета...');
            const html = await generateHybridHTML(report, parseInt(options.depth));
            const htmlPath = path.join(outputDir, 'hybrid-report.html');
            fs.writeFileSync(htmlPath, html);
            console.log(`📄 HTML отчет сохранен: ${htmlPath}`);
          }

          // Сохраняем внутренние графы файлов
          if (options.internalGraphs !== false) {
            console.log('\n📄 Генерация внутренних графов файлов...');
            const { buildFileInternalGraph } = await import('../../modes/file-graph.js');
            const { findCyclicEdges, convertToDOT } = await import('../../core/graph-utils.js');

            let internalGraphsCount = 0;
            for (const module of report.modules) {
              try {
                const internalGraph = buildFileInternalGraph(module.path);
                if (internalGraph && Object.keys(internalGraph.graph).length > 0) {
                  const baseName = module.name.replace(/\.[^.]+$/, '');

                  // Сохраняем JSON
                  const graphPath = path.join(outputDir, `internal-${baseName}.json`);
                  fs.writeFileSync(graphPath, JSON.stringify(internalGraph, null, 2));
                  console.log(`   ✅ internal-${baseName}.json`);

                  // Сохраняем DOT
                  const cyclicEdges = findCyclicEdges(internalGraph.graph);
                  const dotContent = convertToDOT(internalGraph, cyclicEdges);
                  const dotInternalPath = path.join(outputDir, `internal-${baseName}.dot`);
                  fs.writeFileSync(dotInternalPath, dotContent);
                  console.log(`   ✅ internal-${baseName}.dot`);

                  internalGraphsCount++;
                }
              } catch (error) {
                if (options.verbose) {
                  console.warn(
                    `   ⚠️ Не удалось построить граф для ${module.name}:`,
                    error instanceof Error ? error.message : String(error)
                  );
                }
              }
            }
            console.log(`   📊 Сгенерировано внутренних графов: ${internalGraphsCount}`);
          }

          // Вывод статистики по уровням
          console.log('\n📊 СТАТИСТИКА ПО УРОВНЯМ:');
          const sortedLevels = Object.entries(report.stats.byLevel).sort(
            (a, b) => parseInt(a[0]) - parseInt(b[0])
          );

          for (const [level, data] of sortedLevels) {
            const levelNum = parseInt(level);
            const barLength = Math.min(data.modules, 20);
            const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
            console.log(
              `   Уровень ${levelNum}: ${bar} ${data.modules} модулей, ${data.functions} функций`
            );
          }

          // Вывод циклических зависимостей
          if (report.stats.cycles > 0) {
            console.log(`\n⚠️ Обнаружено ${report.stats.cycles} циклических зависимостей:`);
            for (const cycle of report.cycles.slice(0, 5)) {
              console.log(`   🔄 ${cycle.join(' → ')}`);
            }
            if (report.cycles.length > 5) {
              console.log(`   ... и ещё ${report.cycles.length - 5} циклов`);
            }
            console.log('   💡 Проверьте файл hybrid-report.md для деталей');
          } else {
            console.log('\n✅ Циклических зависимостей не обнаружено');
          }

          // Вывод итоговой статистики
          console.log('\n' + '='.repeat(70));
          console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
          console.log('='.repeat(70));
          console.log(`   📁 Модулей: ${report.stats.totalModules}`);
          console.log(`   🔧 Функций: ${report.stats.totalFunctions}`);
          console.log(`   📤 Экспортов: ${report.stats.totalExports}`);
          console.log(`   📥 Импортов: ${report.stats.totalImports}`);
          console.log(`   🧩 Компонентов: ${report.stats.totalComponents}`);
          console.log(`   🧬 Композаблов: ${report.stats.totalComposables}`);
          console.log(`   🔄 Циклов: ${report.stats.cycles}`);
          console.log(`   📏 Глубина: ${report.stats.maxDepth}`);
          console.log(`   📄 Файлов отчетов: ${this.getFileCount(options)}`);
          console.log(`   ⏱️ Время выполнения: ${duration} сек`);
          console.log('='.repeat(70) + '\n');

          // Советы по использованию
          console.log('💡 СОВЕТЫ:');
          console.log('   • Откройте hybrid-report.html в браузере для интерактивной визуализации');
          console.log('   • Используйте hybrid-report.md для чтения в текстовом редакторе');
          console.log('   • Импортируйте hybrid-report.json в другие инструменты анализа');
          console.log('   • Визуализируйте internal-*.dot с помощью Graphviz');

          if (report.stats.cycles > 0) {
            console.log('\n   ⚠️ Для устранения циклических зависимостей:');
            console.log('   1. Выделите общий код в отдельный модуль');
            console.log('   2. Используйте Dependency Injection');
            console.log('   3. Внедрите интерфейсы для разрыва связей');
          }

          console.log('\n✨ Гибридный отчет успешно создан!');
        } catch (error) {
          console.error('\n❌ Ошибка при генерации гибридного отчета:');
          console.error(error instanceof Error ? error.message : String(error));
          if (options.verbose && error instanceof Error && error.stack) {
            console.error('\n📚 Стек вызовов:');
            console.error(error.stack);
          }
          process.exit(1);
        }
      });
  }

  /**
   * Возвращает список форматов для вывода
   */
  private getFormats(options: any): string {
    const formats: string[] = [];
    if (options.json !== false) formats.push('JSON');
    if (options.md !== false) formats.push('Markdown');
    if (options.dot !== false) formats.push('DOT');
    if (options.html !== false) formats.push('HTML');
    if (options.internalGraphs !== false) formats.push('Internal Graphs');
    return formats.join(', ') || 'none';
  }

  /**
   * Возвращает количество файлов отчетов
   */
  private getFileCount(options: any): number {
    let count = 0;
    if (options.json !== false) count++;
    if (options.md !== false) count++;
    if (options.dot !== false) count++;
    if (options.html !== false) count++;
    if (options.internalGraphs !== false) count += 2; // JSON + DOT для каждого файла
    return count;
  }
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ОТЧЕТОМ
// ============================================

/**
 * Извлекает все функции из отчета
 */
export function extractAllFunctions(report: any): any[] {
  const functions: any[] = [];
  for (const module of report.modules || []) {
    for (const func of module.functions || []) {
      functions.push({
        ...func,
        module: module.name,
        modulePath: module.path,
        level: module.level,
      });
    }
  }
  return functions;
}

/**
 * Находит функцию по имени в отчете
 */
export function findFunctionByName(report: any, name: string): any | null {
  for (const module of report.modules || []) {
    for (const func of module.functions || []) {
      if (func.name === name) {
        return {
          ...func,
          module: module.name,
          modulePath: module.path,
          level: module.level,
        };
      }
    }
  }
  return null;
}

/**
 * Возвращает функции на указанном уровне
 */
export function getFunctionsByLevel(report: any, level: number): any[] {
  const functions: any[] = [];
  for (const module of report.modules || []) {
    if (module.level === level) {
      for (const func of module.functions || []) {
        functions.push({
          ...func,
          module: module.name,
          modulePath: module.path,
          level: module.level,
        });
      }
    }
  }
  return functions;
}

/**
 * Возвращает экспортированные функции
 */
export function getExportedFunctions(report: any): any[] {
  const functions: any[] = [];
  for (const module of report.modules || []) {
    for (const func of module.functions || []) {
      if (func.isExported) {
        functions.push({
          ...func,
          module: module.name,
          modulePath: module.path,
          level: module.level,
        });
      }
    }
  }
  return functions;
}

/**
 * Возвращает асинхронные функции
 */
export function getAsyncFunctions(report: any): any[] {
  const functions: any[] = [];
  for (const module of report.modules || []) {
    for (const func of module.functions || []) {
      if (func.isAsync) {
        functions.push({
          ...func,
          module: module.name,
          modulePath: module.path,
          level: module.level,
        });
      }
    }
  }
  return functions;
}

/**
 * Возвращает статистику по функциям
 */
export function getFunctionStats(report: any): {
  total: number;
  exported: number;
  async: number;
  byLevel: Record<number, number>;
  byModule: Record<string, number>;
} {
  const stats = {
    total: 0,
    exported: 0,
    async: 0,
    byLevel: {} as Record<number, number>,
    byModule: {} as Record<string, number>,
  };

  for (const module of report.modules || []) {
    const level = module.level || 0;
    const moduleName = module.name || 'unknown';

    if (!stats.byLevel[level]) stats.byLevel[level] = 0;
    if (!stats.byModule[moduleName]) stats.byModule[moduleName] = 0;

    for (const func of module.functions || []) {
      stats.total++;
      stats.byLevel[level]++;
      stats.byModule[moduleName]++;

      if (func.isExported) stats.exported++;
      if (func.isAsync) stats.async++;
    }
  }

  return stats;
}

// Экспорт по умолчанию
export default HybridReportCommand;
