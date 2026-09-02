// packages/ast-analyzer/src/cli/commands/FileCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import fs from 'fs';
import path from 'path';
import type { Command } from 'commander';
import { Graphviz } from '@hpcc-js/wasm-graphviz';
import { findCyclicEdges, convertToDOT } from '../../core/graph-utils.js';
import { generateHTMLReport } from '../../reporters/html-reporter.js';
import { normalizeGraphPaths } from '../../utils/path-utils.js';

/**
 * Команда: file - построение внутреннего графа файла
 *
 * Использование:
 *   ast-analyzer file <file> [options]
 *
 * Опции:
 *   --entities          Включить анализ сущностей
 *   -o, --output <dir>  Выходная директория
 *   --no-svg            Не генерировать SVG
 *   --no-html           Не генерировать HTML
 *   --no-json           Не генерировать JSON
 *   --max-depth <n>     Максимальная глубина анализа (по умолчанию: 10)
 */
export class FileCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('file <file>')
      .description('Build internal dependency graph of a single file')
      .option('--entities', 'Include entity analysis (functions, classes, etc.)')
      .option('-o, --output <dir>', 'Output directory', '.')
      .option('--no-svg', 'Skip SVG generation')
      .option('--no-html', 'Skip HTML report generation')
      .option('--no-json', 'Skip JSON output')
      .option('--max-depth <n>', 'Maximum depth for analysis', '10')
      .option('--no-cycles', 'Skip cycle detection')
      .option('-v, --verbose', 'Verbose output')
      .action(async (file, options) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          console.error('❌ Error:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет команду
   */
  private async execute(file: string, options: any): Promise<void> {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(60));
    console.log('📄 ВНУТРЕННИЙ ГРАФ ФАЙЛА');
    console.log('='.repeat(60));
    console.log(`📄 Файл: ${file}`);
    console.log(`📏 Глубина: ${options.maxDepth}`);
    console.log(`🔍 Анализ сущностей: ${options.entities ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`📁 Выходная директория: ${options.output}`);

    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ Файл не найден: ${absolutePath}`);
      process.exit(1);
    }

    // Создаем выходную директорию
    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Импортируем необходимые модули
    const { buildFileInternalGraph } = await import('../../modes/file-graph.js');
    const { extractEntities } = await import('../../core/entity-extractor.js');
    const { parseFile } = await import('../../core/ast-parser.js');

    // Строим граф
    console.log('\n🔨 Построение внутреннего графа...');

    const resultData = buildFileInternalGraph(absolutePath, {
      maxDepth: parseInt(options.maxDepth),
    });

    if (!resultData || Object.keys(resultData.graph).length === 0) {
      console.log('⚠️ Зависимости не найдены');
      return;
    }

    const normalizedData = normalizeGraphPaths(resultData);

    // Находим циклические зависимости
    let cyclicEdges = new Set<string>();
    if (options.cycles !== false) {
      cyclicEdges = findCyclicEdges(normalizedData.graph);
    }

    const hasCycles = cyclicEdges.size > 0;

    const graphDataWithCycles = {
      ...normalizedData,
      hasCycles: hasCycles,
      cyclicEdges: Array.from(cyclicEdges),
    };

    // Сохраняем JSON
    if (options.json !== false) {
      const jsonPath = path.join(outputDir, 'file-graph.json');
      fs.writeFileSync(jsonPath, JSON.stringify(graphDataWithCycles, null, 2));
      console.log(`   ✅ JSON: ${jsonPath}`);
    }

    // Генерируем DOT и SVG
    if (options.svg !== false) {
      const dotContent = convertToDOT(graphDataWithCycles, cyclicEdges);
      const dotPath = path.join(outputDir, 'file-graph.dot');
      fs.writeFileSync(dotPath, dotContent);
      console.log(`   ✅ DOT: ${dotPath}`);

      // Генерируем SVG через Graphviz
      try {
        console.log('   ⚙️ Генерация SVG...');
        const graphviz = await Graphviz.load();
        const svgContent = graphviz.dot(dotContent);
        const svgPath = path.join(outputDir, 'file-graph.svg');
        fs.writeFileSync(svgPath, svgContent);
        console.log(`   ✅ SVG: ${svgPath}`);
      } catch (error) {
        console.warn(
          `   ⚠️ Не удалось сгенерировать SVG: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Генерируем HTML отчет
    if (options.html !== false) {
      console.log('   📄 Генерация HTML отчета...');

      const svgContent = fs.existsSync(path.join(outputDir, 'file-graph.svg'))
        ? fs.readFileSync(path.join(outputDir, 'file-graph.svg'), 'utf-8')
        : '';

      const dotContent = fs.existsSync(path.join(outputDir, 'file-graph.dot'))
        ? fs.readFileSync(path.join(outputDir, 'file-graph.dot'), 'utf-8')
        : '';

      const jsonContent = fs.existsSync(path.join(outputDir, 'file-graph.json'))
        ? fs.readFileSync(path.join(outputDir, 'file-graph.json'), 'utf-8')
        : '{}';

      const htmlContent = generateHTMLReport(
        svgContent,
        dotContent,
        jsonContent,
        path.basename(file),
        hasCycles
      );

      const htmlPath = path.join(outputDir, 'file-report.html');
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`   ✅ HTML: ${htmlPath}`);
    }

    // Анализ сущностей
    if (options.entities) {
      console.log('\n📊 Генерация графов сущностей...');

      const parsed = parseFile(absolutePath);
      if (parsed) {
        const ast = parsed.ast;
        const entities = extractEntities(ast, absolutePath);

        // Сохраняем сущности
        const entitiesPath = path.join(outputDir, 'file-entities.json');
        fs.writeFileSync(entitiesPath, JSON.stringify(entities, null, 2));
        console.log(`   ✅ Сущности: ${entitiesPath}`);

        // Выводим статистику
        console.log('\n📊 СТАТИСТИКА СУЩНОСТЕЙ:');
        console.log(`   • Функций: ${entities.functions.length}`);
        console.log(`   • Классов: ${entities.classes.length}`);
        console.log(`   • Констант: ${entities.constants.length}`);
        console.log(`   • Интерфейсов: ${entities.interfaces.length}`);
        console.log(`   • Типов: ${entities.types.length}`);
        console.log(`   • Переменных: ${entities.variables.length}`);
        console.log(`   • Импортов: ${entities.imports.length}`);
        console.log(`   • Экспортов: ${entities.exports.length}`);

        // Генерация графа вызовов
        if (Object.keys(entities.callGraph).length > 0) {
          const callGraphPath = path.join(outputDir, 'file-callgraph.json');
          fs.writeFileSync(callGraphPath, JSON.stringify(entities.callGraph, null, 2));
          console.log(`   ✅ Граф вызовов: ${callGraphPath}`);

          // Генерация DOT для графа вызовов
          let dot = 'digraph CallGraph {\n';
          dot += '  rankdir=LR;\n';
          dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
          dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

          for (const [caller, callees] of Object.entries(entities.callGraph)) {
            if (callees.length > 0) {
              for (const callee of callees) {
                dot += `  "${caller}" -> "${callee}";\n`;
              }
            }
          }

          dot += '}\n';

          const callGraphDotPath = path.join(outputDir, 'file-callgraph.dot');
          fs.writeFileSync(callGraphDotPath, dot);
          console.log(`   ✅ Граф вызовов DOT: ${callGraphDotPath}`);

          // Генерируем SVG для графа вызовов
          try {
            const graphviz = await Graphviz.load();
            const svgContent = graphviz.dot(dot);
            const svgPath = path.join(outputDir, 'file-callgraph.svg');
            fs.writeFileSync(svgPath, svgContent);
            console.log(`   ✅ Граф вызовов SVG: ${svgPath}`);
          } catch (error) {
            console.warn(
              `   ⚠️ Не удалось сгенерировать SVG для графа вызовов: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        // Детальный отчет о функциях
        if (entities.functions.length > 0) {
          const funcReport = this.generateFunctionsReport(entities.functions, absolutePath);
          const funcReportPath = path.join(outputDir, 'file-functions-report.md');
          fs.writeFileSync(funcReportPath, funcReport);
          console.log(`   ✅ Отчет о функциях: ${funcReportPath}`);
        }
      }
    }

    // Финальная статистика
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГИ АНАЛИЗА');
    console.log('='.repeat(60));
    console.log(`⏱️  Время: ${duration} сек`);
    console.log(`📁 Узлов в графе: ${Object.keys(normalizedData.graph).length}`);
    console.log(`🔗 Связей: ${this.countEdges(normalizedData.graph)}`);
    console.log(`🔄 Циклов: ${hasCycles ? cyclicEdges.size : 0}`);

    if (hasCycles) {
      console.log('\n⚠️ Обнаружены циклические зависимости:');
      const cyclesByEntity = new Map<string, Set<string>>();
      for (const edge of cyclicEdges) {
        const parts = edge.split('->');
        const from = parts[0];
        const to = parts[1];
        if (from && to) {
          if (!cyclesByEntity.has(from)) cyclesByEntity.set(from, new Set());
          cyclesByEntity.get(from)!.add(to);
        }
      }

      for (const [from, toSet] of cyclesByEntity) {
        console.log(`   📄 ${from}`);
        for (const to of toSet) {
          console.log(`      └─ 🔄 вызывает: ${to}`);
        }
      }
    }

    console.log(`\n📁 Файлы сохранены в: ${outputDir}`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Подсчитывает количество ребер в графе
   */
  private countEdges(graph: Record<string, string[]>): number {
    let count = 0;
    for (const deps of Object.values(graph)) {
      count += deps.length;
    }
    return count;
  }

  /**
   * Генерирует отчет о функциях в Markdown формате
   */
  private generateFunctionsReport(functions: any[], filePath: string): string {
    let report = '# 📊 Отчет о функциях\n\n';
    report += `**Файл:** \`${path.basename(filePath)}\`\n\n`;
    report += `**Всего функций:** ${functions.length}\n\n`;

    // Экспортированные функции
    const exported = functions.filter((f: any) => f.isExported);
    if (exported.length > 0) {
      report += '## 📤 Экспортированные функции\n\n';
      report += '| Имя | Строка | Async | Параметры | Возврат |\n';
      report += '|-----|--------|-------|-----------|---------|\n';
      for (const func of exported) {
        report += `| \`${func.name}\` | ${func.line} | ${func.isAsync ? '✅' : '❌'} | ${(func.params || []).join(', ') || '-'} | ${func.returnType || 'any'} |\n`;
      }
      report += '\n';
    }

    // Внутренние функции
    const internal = functions.filter((f: any) => !f.isExported);
    if (internal.length > 0) {
      report += '## 🔒 Внутренние функции\n\n';
      report += '| Имя | Строка | Async | Параметры | Возврат |\n';
      report += '|-----|--------|-------|-----------|---------|\n';
      for (const func of internal) {
        report += `| \`${func.name}\` | ${func.line} | ${func.isAsync ? '✅' : '❌'} | ${(func.params || []).join(', ') || '-'} | ${func.returnType || 'any'} |\n`;
      }
      report += '\n';
    }

    // Функции с вызовами
    const withCalls = functions.filter((f: any) => (f.calls || []).length > 0);
    if (withCalls.length > 0) {
      report += '## 🔗 Функции с вызовами\n\n';
      report += '```\n';
      for (const func of withCalls) {
        report += `${func.name} → ${(func.calls || []).join(', ')}\n`;
      }
      report += '```\n\n';
    }

    // Статистика
    report += '## 📊 Статистика\n\n';
    report += '| Показатель | Значение |\n';
    report += '|------------|----------|\n';
    report += `| Всего функций | ${functions.length} |\n`;
    report += `| Экспортировано | ${exported.length} |\n`;
    report += `| Async функций | ${functions.filter((f: any) => f.isAsync).length} |\n`;
    report += `| Функций с вызовами | ${withCalls.length} |\n`;
    report += `| Средняя сложность | ${(functions.reduce((sum: number, f: any) => sum + (f.complexity || 1), 0) / functions.length).toFixed(1)} |\n`;
    report += `| Макс. сложность | ${Math.max(...functions.map((f: any) => f.complexity || 1))} |\n`;
    report += '\n';

    report += '---\n';
    report += `*Сгенерировано: ${new Date().toLocaleString()}*\n`;

    return report;
  }

  /**
   * Возвращает команду для регистрации в CLI
   */
  getCommand(): Command {
    return this.program;
  }
}

// ============================================================
// ФАБРИКА ДЛЯ СОЗДАНИЯ КОМАНДЫ
// ============================================================

export function createFileCommand(program: Command): FileCommand {
  return new FileCommand(program);
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default FileCommand;
