// packages/ast-analyzer/src/cli/commands/ProjectCommand.ts
// ============================================================
// КОМАНДА: project — построение графа зависимостей проекта
// ============================================================
// Версия: 3.0.0
//
// ИЗМЕНЕНИЯ v3.0.0 (упрощение через reporters/json):
//   - ✅ УДАЛЕНА вся дублирующая логика анализа:
//       - ручной сбор entitiesMap
//       - ручные вызовы extractEntitiesFromFile
//       - ручная генерация compact-universe.json / optimized-report.json
//       - ручной buildInwardDependencies
//   - ✅ ВСЕ данные берутся из buildProjectGraph, который
//       сам использует reporters/json под капотом
//   - ✅ Сохранение отчётов делегировано reporters/json
//   - ✅ Файл стал тонким оркестратором: вызов + сохранение
//
// АРХИТЕКТУРА:
//   ProjectCommand (этот файл)
//        │
//        └──> modes/project-graph.ts::buildProjectGraph()
//                 │
//                 ├──> core/ProjectGraphBuilder           (граф зависимостей)
//                 ├──> reporters/json/extractors          (extractEntitiesFromFile)
//                 └──> reporters/json/builders            (buildEnhancedPackageLockReport)
//
// ИСПОЛЬЗОВАНИЕ:
//   ast-analyzer project <file> [options]
//
// ОПЦИИ:
//   -d, --depth <n>      Максимальная глубина (по умолчанию: 5)
//   --entities           Включить анализ сущностей
//   --include-body       Включить тела функций в отчёт
//   --vue                Включить анализ Vue компонентов
//   --from <function>    Начальная функция для графа вызовов
//   --to <function>      Конечная функция для графа вызовов
//   --optimized          Сгенерировать оптимизированный отчёт
//   -o, --output <dir>   Выходная директория
//   -v, --verbose        Подробный вывод
// ============================================================

import fs from 'fs';
import path from 'path';
import type { Command } from 'commander';

// ✅ Единственный источник данных — buildProjectGraph
//    (который внутри использует reporters/json)
import { buildProjectGraph } from '../../modes/project-graph.js';

// ✅ Типы для аннотаций
import type { GraphStats } from '../../core/ProjectGraphBuilder.js';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

/**
 * Опции CLI-команды `project`.
 */
interface ProjectCommandOptions {
  depth: string;
  entities?: boolean;
  includeBody?: boolean;
  vue?: boolean;
  from?: string;
  to?: string;
  optimized?: boolean;
  output: string;
  verbose?: boolean;
}

/**
 * Результат работы команды `project`.
 *
 * Формируется из данных, полученных от `buildProjectGraph`.
 */
interface ProjectCommandResult {
  /** Точка входа */
  entryPoint: string;
  /** Глубина анализа */
  depth: number;
  /** Время выполнения (сек) */
  duration: number;
  /** Количество модулей */
  totalModules: number;
  /** Количество рёбер */
  totalEdges: number;
  /** Есть ли циклы */
  hasCycles: boolean;
  /** Количество циклов */
  cyclesCount: number;
  /** Пути к сохранённым файлам */
  savedFiles: {
    projectGraph?: string;
    packageLock?: string;
    compactUniverse?: string;
    optimizedReport?: string;
    htmlReport?: string;
    metadata?: string;
  };
}

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Команда: project
 *
 * Строит граф зависимостей проекта от точки входа.
 *
 * ⚠️ АРХИТЕКТУРНОЕ ПРАВИЛО:
 *   Этот файл — только оркестратор. Вся логика анализа
 *   находится в `modes/project-graph.ts`, который в свою
 *   очередь делегирует в `reporters/json`.
 *
 *   НЕ добавляйте сюда:
 *     - парсинг AST
 *     - извлечение сущностей
 *     - построение графов
 *     - генерацию отчётов
 *
 *   Если нужна новая функциональность — добавьте её в
 *   `reporters/json`, а здесь только вызовите.
 */
export class ProjectCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  // ============================================================
  // РЕГИСТРАЦИЯ КОМАНДЫ
  // ============================================================

  private register(): void {
    this.program
      .command('project <file>')
      .description('Build project dependency graph with entities and relationships')
      .option('-d, --depth <n>', 'Maximum depth for dependency resolution', '5')
      .option('--entities', 'Include detailed entity analysis (functions, classes, etc.)')
      .option('--include-body', 'Include function bodies in the report')
      .option('--vue', 'Include Vue component analysis')
      .option('--from <function>', 'Start function for call graph path finding')
      .option('--to <function>', 'End function for call graph path finding')
      .option('--optimized', 'Generate optimized report with embedded relationships')
      .option('-o, --output <dir>', 'Output directory for reports', '.')
      .option('-v, --verbose', 'Verbose output')
      .action(async (file: string, options: ProjectCommandOptions) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          console.error('❌ Error:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      });
  }

  // ============================================================
  // ОСНОВНОЙ МЕТОД ВЫПОЛНЕНИЯ
  // ============================================================

  /**
   * Выполняет команду `project`.
   *
   * Шаги:
   *   1. Валидация входных данных
   *   2. Вызов buildProjectGraph (вся тяжёлая работа там)
   *   3. Сохранение результатов
   *   4. Вывод статистики
   */
  private async execute(file: string, options: ProjectCommandOptions): Promise<void> {
    const startTime = Date.now();

    // ----------------------------------------------------------
    // Шаг 1: Приветствие и валидация
    // ----------------------------------------------------------
    this.printHeader(file, options);

    const resolvedFile = path.resolve(file);
    if (!fs.existsSync(resolvedFile)) {
      console.error(`❌ File not found: ${resolvedFile}`);
      process.exit(1);
    }

    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ----------------------------------------------------------
    // Шаг 2: Построение графа
    //         ★ Вся логика анализа — внутри buildProjectGraph
    // ----------------------------------------------------------
    if (options.verbose) {
      console.log('🔍 Building project graph...\n');
    }

    const graphResult = buildProjectGraph(
      resolvedFile,
      parseInt(options.depth, 10),
      options.entities === true,
      options.from,
      options.to
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // ----------------------------------------------------------
    // Шаг 3: Вывод статистики графа
    // ----------------------------------------------------------
    const stats = this.extractStats(graphResult);
    this.printGraphSummary(stats, duration);

    if (graphResult.entities) {
      this.printEntitySummary(graphResult.entities);
    }

    if (graphResult.callGraphResult) {
      this.printCallGraphPath(graphResult.callGraphResult);
    }

    // ----------------------------------------------------------
    // Шаг 4: Сохранение результатов
    //         ★ Сохранение делегируется reporters/json через
    //           buildProjectGraph → buildEnhancedPackageLockReport
    // ----------------------------------------------------------
    const savedFiles = this.saveResults(graphResult, outputDir, options);

    // ----------------------------------------------------------
    // Шаг 5: Финальный отчёт
    // ----------------------------------------------------------
    this.printFinalReport(stats, savedFiles, outputDir, duration);
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  /**
   * Печатает заголовок команды.
   */
  private printHeader(file: string, options: ProjectCommandOptions): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 PROJECT GRAPH ANALYSIS');
    console.log('='.repeat(70));
    console.log(`📄 Entry point: ${file}`);
    console.log(`📏 Max depth: ${options.depth}`);
    console.log(`🔍 Entity analysis: ${options.entities ? 'ON' : 'OFF'}`);
    console.log(`📝 Include body: ${options.includeBody ? 'ON' : 'OFF'}`);
    console.log(`⚛️ Vue analysis: ${options.vue ? 'ON' : 'OFF'}`);
    console.log(`🎯 From: ${options.from || 'auto'}`);
    console.log(`🎯 To: ${options.to || 'auto'}`);
    console.log(`📁 Output: ${options.output}`);
    console.log(`🚀 Optimized: ${options.optimized ? 'ON' : 'OFF'}`);
  }

  /**
   * Извлекает статистику из результата `buildProjectGraph`.
   */
  private extractStats(graphResult: any): {
    totalModules: number;
    totalEdges: number;
    hasCycles: boolean;
    cyclesCount: number;
    stats?: GraphStats;
  } {
    const totalModules = Object.keys(graphResult.graph).length;

    let totalEdges = 0;
    for (const deps of Object.values(graphResult.graph)) {
      totalEdges += (deps as string[]).length;
    }

    return {
      totalModules,
      totalEdges,
      hasCycles: graphResult.stats?.hasCycles || false,
      cyclesCount: graphResult.stats?.cyclesCount || 0,
      stats: graphResult.stats,
    };
  }

  /**
   * Печатает краткую сводку по графу.
   */
  private printGraphSummary(
    stats: {
      totalModules: number;
      totalEdges: number;
      hasCycles: boolean;
      cyclesCount: number;
    },
    duration: string
  ): void {
    console.log(`\n✅ Graph built in ${duration}s`);
    console.log(`   📦 Modules: ${stats.totalModules}`);
    console.log(`   🔗 Dependencies: ${stats.totalEdges}`);

    if (stats.hasCycles) {
      console.log(`   🔄 Cycles: ${stats.cyclesCount} (⚠️ detected)`);
    }
  }

  /**
   * Печатает сводку по сущностям.
   */
  private printEntitySummary(entities: Record<string, any>): void {
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalConstants = 0;
    let totalInterfaces = 0;
    let totalTypes = 0;
    let totalVariables = 0;
    let totalCalls = 0;

    for (const entity of Object.values(entities)) {
      if (!entity) continue;
      totalFunctions += entity.functions?.length || 0;
      totalClasses += entity.classes?.length || 0;
      totalConstants += entity.constants?.length || 0;
      totalInterfaces += entity.interfaces?.length || 0;
      totalTypes += entity.types?.length || 0;
      totalVariables += entity.variables?.length || 0;

      for (const func of entity.functions || []) {
        totalCalls += func.calls?.length || 0;
      }
    }

    console.log(`\n📊 Entities:`);
    console.log(`   • Functions: ${totalFunctions}`);
    console.log(`   • Classes: ${totalClasses}`);
    console.log(`   • Constants: ${totalConstants}`);
    console.log(`   • Interfaces: ${totalInterfaces}`);
    console.log(`   • Types: ${totalTypes}`);
    console.log(`   • Variables: ${totalVariables}`);
    console.log(`   • Calls: ${totalCalls}`);
  }

  /**
   * Печатает информацию о найденном пути в графе вызовов.
   */
  private printCallGraphPath(callGraphResult: any): void {
    console.log(`\n🕸️ Call Graph Path:`);
    if (callGraphResult.found) {
      console.log(`   ✅ Path found: ${callGraphResult.path?.join(' → ') || 'empty'}`);
      console.log(`   📊 Nodes in path: ${callGraphResult.nodes?.length || 0}`);
      console.log(`   📊 Edges in path: ${callGraphResult.edges?.length || 0}`);
    } else {
      console.log(`   ❌ Path not found: ${callGraphResult.reason || 'unknown reason'}`);
    }
  }

  /**
   * Сохраняет результаты работы команды на диск.
   *
   * Все файлы формируются на основе данных из `buildProjectGraph`
   * и `buildEnhancedPackageLockReport`, которые уже содержат всё
   * необходимое.
   */
  private saveResults(
    graphResult: any,
    outputDir: string,
    options: ProjectCommandOptions
  ): ProjectCommandResult['savedFiles'] {
    console.log('\n💾 Saving results...');
    const savedFiles: ProjectCommandResult['savedFiles'] = {};

    // ----------------------------------------------------------
    // 1. Основной JSON отчёт (project-graph.json)
    // ----------------------------------------------------------
    const graphJsonPath = path.join(outputDir, 'project-graph.json');
    fs.writeFileSync(graphJsonPath, JSON.stringify(graphResult, null, 2));
    savedFiles.projectGraph = graphJsonPath;
    console.log(`   ✅ ${graphJsonPath}`);

    // ----------------------------------------------------------
    // 2. Package-lock-like отчёт (если есть entities)
    //    ★ Формируется внутри buildProjectGraph через
    //      buildEnhancedPackageLockReport
    // ----------------------------------------------------------
    if (graphResult.packageLockReport) {
      const packageLockPath = path.join(outputDir, 'package-lock-report.json');
      fs.writeFileSync(packageLockPath, JSON.stringify(graphResult.packageLockReport, null, 2));
      savedFiles.packageLock = packageLockPath;
      console.log(`   ✅ ${packageLockPath}`);
    }

    // ----------------------------------------------------------
    // 3. Compact universe отчёт
    //    ★ Генерируется через reporters/json/compact-reporter
    // ----------------------------------------------------------
    if (options.entities && graphResult.entities) {
      try {
        const { generateCompactReport } = require('../../reporters/compact-reporter.js');
        const compactPath = path.join(outputDir, 'compact-universe.json');

        generateCompactReport(graphResult.entities, compactPath, {
          compress: true,
          saveFullJson: true,
          verbose: options.verbose === true,
        });

        savedFiles.compactUniverse = compactPath;
        console.log(`   ✅ ${compactPath}`);
      } catch (error) {
        console.warn(
          `   ⚠️ Compact report failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // ----------------------------------------------------------
    // 4. Optimized report (встроенные связи)
    //    ★ Генерируется через reporters/json/builders/save-optimized
    // ----------------------------------------------------------
    if (options.optimized && graphResult.entities) {
      try {
        const {
          saveOptimizedPackageLockReport,
        } = require('../../reporters/json/builders/save-optimized.js');
        const optimizedPath = path.join(outputDir, 'optimized-report.json');

        saveOptimizedPackageLockReport(
          graphResult.rootKey,
          graphResult.graph,
          graphResult.entities,
          optimizedPath,
          {
            includeBody: options.includeBody === true,
            includeVscodeLinks: true,
            includeStats: true,
          }
        );

        savedFiles.optimizedReport = optimizedPath;
        console.log(`   ✅ ${optimizedPath}`);
        console.log(`   💡 All relationships embedded in entities for fast navigation`);
      } catch (error) {
        console.warn(
          `   ⚠️ Optimized report failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // ----------------------------------------------------------
    // 5. HTML отчёт (если есть graph)
    // ----------------------------------------------------------
    if (graphResult.graph && Object.keys(graphResult.graph).length > 0) {
      try {
        this.generateHtmlReport(graphResult, outputDir, savedFiles);
      } catch (error) {
        console.warn(
          `   ⚠️ HTML report failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // ----------------------------------------------------------
    // 6. Metadata (метаданные о запуске)
    // ----------------------------------------------------------
    const metadata = {
      timestamp: new Date().toISOString(),
      entryPoint: options.output,
      depth: parseInt(options.depth, 10),
      stats: graphResult.stats,
      savedFiles,
    };

    const metadataPath = path.join(outputDir, 'project-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    savedFiles.metadata = metadataPath;
    console.log(`   ✅ ${metadataPath}`);

    return savedFiles;
  }

  /**
   * Генерирует HTML отчёт для графа модулей.
   */
  private async generateHtmlReport(
    graphResult: any,
    outputDir: string,
    savedFiles: ProjectCommandResult['savedFiles']
  ): Promise<void> {
    const { convertToDOT, findCyclicEdges } = await import('../../core/graph-utils.js');
    const { generateHTMLReport } = await import('../../reporters/html-reporter.js');
    const { Graphviz } = await import('@hpcc-js/wasm-graphviz');

    const cyclicEdges = findCyclicEdges(graphResult.graph);
    const hasCycles = cyclicEdges.size > 0;

    const dotContent = convertToDOT(
      { rootKey: graphResult.rootKey, graph: graphResult.graph },
      cyclicEdges
    );

    const graphviz = await Graphviz.load();
    const svgContent = graphviz.dot(dotContent);

    const htmlContent = generateHTMLReport(
      svgContent,
      dotContent,
      JSON.stringify(graphResult, null, 2),
      graphResult.rootKey,
      hasCycles
    );

    const htmlPath = path.join(outputDir, 'project-report.html');
    fs.writeFileSync(htmlPath, htmlContent);
    savedFiles.htmlReport = htmlPath;
    console.log(`   ✅ ${htmlPath}`);

    if (hasCycles) {
      console.log(`\n⚠️ Found ${cyclicEdges.size} cyclic dependencies!`);
      console.log('   Check project-report.html for visualization');
    }
  }

  /**
   * Печатает финальный отчёт.
   */
  private printFinalReport(
    stats: {
      totalModules: number;
      totalEdges: number;
      hasCycles: boolean;
      cyclesCount: number;
    },
    savedFiles: ProjectCommandResult['savedFiles'],
    outputDir: string,
    duration: string
  ): void {
    console.log('\n' + '='.repeat(70));
    console.log('✨ PROJECT GRAPH ANALYSIS COMPLETE');
    console.log('='.repeat(70));
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`📁 Output directory: ${outputDir}`);
    console.log(`📊 Modules: ${stats.totalModules}`);
    console.log(`🔗 Dependencies: ${stats.totalEdges}`);

    if (stats.hasCycles) {
      console.log(`🔄 Cycles: ${stats.cyclesCount}`);
    }

    const savedCount = Object.values(savedFiles).filter(Boolean).length;
    console.log(`💾 Files saved: ${savedCount}`);

    console.log('='.repeat(70) + '\n');
  }

  /**
   * Возвращает команду для регистрации в CLI.
   */
  getCommand(): Command {
    return this.program;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default ProjectCommand;
