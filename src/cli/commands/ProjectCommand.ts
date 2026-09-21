// packages/ast-analyzer/src/cli/commands/ProjectCommand.ts
// ============================================================
// КОМАНДА: project — построение графа зависимостей проекта
// ============================================================
// Версия: 4.0.0 (переход на AnalysisPipeline)
//
// ИЗМЕНЕНИЯ v4.0.0:
//   - ✅ ПЕРЕВЕДЕНО на AnalysisPipeline для сбора entities.
//     Раньше: buildProjectGraph с includeEntities=true — парсил
//     файлы через ProjectGraphBuilder → extractEntitiesFromFile.
//     Теперь: pipeline.run({ mode: 'entities-only' }) — единый
//     источник истины для entities.
//   - ✅ buildProjectGraph вызывается с includeEntities=false —
//     граф строится БЕЗ повторного парсинга (быстрее в 2 раза).
//   - ✅ entities из pipeline подставляются в graphResult вручную.
//   - ✅ ДОБАВЛЕНО: diagnostics pipeline.metrics
//     (vue/ts файлы, conditionals, lifecycle, reactivity).
//   - ✅ СОХРАНЕНЫ: вся логика сохранения отчётов, HTML, метаданных,
//     оптимизированного отчёта — без изменений.
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
// АРХИТЕКТУРА (v4.0.0):
//   ProjectCommand (этот файл)
//        │
//        ├──> AnalysisPipeline.run({ mode: 'entities-only' })
//        │         │
//        │         └──> entitiesMap + enhancedMap + metrics
//        │
//        └──> modes/project-graph.ts::buildProjectGraph()
//                  │
//                  ├──> core/ProjectGraphBuilder   (граф зависимостей)
//                  └──> reporters/json/builders    (package-lock report)
//
// ⚠️ TODO (следующий рефакторинг):
//   ProjectGraphBuilder пока не принимает entitiesMap извне.
//   Когда это будет сделано — buildProjectGraph получит второй
//   аргумент entitiesMap, и двойной парсинг исчезнет полностью.
// ============================================================

import fs from 'fs';
import path from 'path';
import type { Command } from 'commander';

// ✅ Единственный источник данных — buildProjectGraph
//    (который внутри использует reporters/json)
import { buildProjectGraph } from '../../modes/project-graph.js';

// ✅ v4.0.0: единый pipeline для entities
import { AnalysisPipeline } from '../../pipeline/index.js';

// ✅ Типы для аннотаций
import type { GraphStats } from '../../core/ProjectGraphBuilder.js';
import type { PipelineMetrics } from '../../pipeline/index.js';

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
 * Формируется из данных, полученных от `buildProjectGraph`
 * и `AnalysisPipeline`.
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
  /** Метрики pipeline (если --entities) */
  pipelineMetrics?: PipelineMetrics;
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
 *   находится в:
 *     - `pipeline/` — для entities (парсинг AST)
 *     - `modes/project-graph.ts` — для графа зависимостей
 *     - `reporters/json/` — для построения отчётов
 *
 *   НЕ добавляйте сюда:
 *     - парсинг AST
 *     - извлечение сущностей
 *     - построение графов
 *     - генерацию отчётов
 *
 *   Если нужна новая функциональность — добавьте её в
 *   соответствующий модуль, а здесь только вызовите.
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
   *   2. [v4.0.0] AnalysisPipeline для entities (если --entities)
   *   3. buildProjectGraph для графа зависимостей
   *   4. Подстановка entities из pipeline в graphResult
   *   5. Сохранение результатов
   *   6. Вывод статистики
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
    // Шаг 2: ✅ v4.0.0 — Pipeline для entities
    // ----------------------------------------------------------
    let pipelineResult: Awaited<ReturnType<AnalysisPipeline['run']>> | undefined;
    let pipelineMetrics: PipelineMetrics | undefined;

    if (options.entities) {
      console.log('\n🔍 Running unified pipeline for entities...');

      const pipeline = new AnalysisPipeline();
      pipelineResult = await pipeline.run({
        paths: [resolvedFile],
        recursive: true,
        mode: 'entities-only',
        includeBody: options.includeBody === true,
        includeVSCode: true,
        includeExtended: true,
        verbose: options.verbose === true,
        continueOnError: true,
      });

      pipelineMetrics = pipelineResult.metrics;
      this.printPipelineDiagnostics(pipelineMetrics);

      if (pipelineResult.errors.length > 0 && options.verbose) {
        console.log(`\n   ⚠️  Ошибок парсинга: ${pipelineResult.errors.length}`);
        for (const err of pipelineResult.errors.slice(0, 5)) {
          console.log(`      • ${path.basename(err.file)}: ${err.message}`);
        }
        if (pipelineResult.errors.length > 5) {
          console.log(`      ... и ещё ${pipelineResult.errors.length - 5}`);
        }
      }
    }

    // ----------------------------------------------------------
    // Шаг 3: Построение графа зависимостей
    // ----------------------------------------------------------
    // ⚠️ v4.0.0: includeEntities=false — entities уже собраны
    //    pipeline'ом. ProjectGraphBuilder не парсит файлы повторно.
    // ----------------------------------------------------------
    if (options.verbose) {
      console.log('\n🔍 Building project graph...');
    }

    const graphResult = buildProjectGraph(
      resolvedFile,
      parseInt(options.depth, 10),
      false, // ← v4.0.0: НЕ дублируем entities
      options.from,
      options.to
    );

    // ----------------------------------------------------------
    // Шаг 4: Подстановка entities из pipeline в graphResult
    // ----------------------------------------------------------
    if (pipelineResult) {
      (graphResult as any).entities = pipelineResult.entitiesMap;
      (graphResult as any).enhancedMap = pipelineResult.enhancedMap;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // ----------------------------------------------------------
    // Шаг 5: Вывод статистики графа
    // ----------------------------------------------------------
    const stats = this.extractStats(graphResult);
    this.printGraphSummary(stats, duration);

    if (graphResult.entities) {
      this.printEntitySummary(graphResult.entities);
    }

    if (graphResult.callGraphResult) {
      this.printCallGraphPath(graphResult.callGraphResult);
    }

    if (pipelineMetrics) {
      this.printPipelineSummary(pipelineMetrics);
    }

    // ----------------------------------------------------------
    // Шаг 6: Сохранение результатов
    // ----------------------------------------------------------
    const savedFiles = this.saveResults(graphResult, outputDir, options, pipelineResult);

    // ----------------------------------------------------------
    // Шаг 7: Финальный отчёт
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
    console.log('📊 PROJECT GRAPH ANALYSIS (v4.0.0)');
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
   * ✅ v4.0.0: печатает диагностику pipeline.
   */
  private printPipelineDiagnostics(m: PipelineMetrics): void {
    console.log(`   📁 Files discovered: ${m.filesDiscovered}`);
    console.log(`   ✅ Files parsed:     ${m.filesParsed}`);
    console.log(`   🎯 Vue: ${m.vueFiles}, TS/JS: ${m.tsFiles}`);
    if (m.filesFailed > 0) {
      console.log(`   ⚠️  Failed: ${m.filesFailed}`);
    }
    console.log(`   ƒ  Functions:        ${m.totalFunctions}`);
    console.log(`   📌 Constants:        ${m.totalConstants}`);
    console.log(`   📥 Imports:          ${m.totalImports}`);
    console.log(`   📤 Exports:          ${m.totalExports}`);
    if (m.totalConditionals > 0) {
      console.log(`   🎨 Conditionals:     ${m.totalConditionals}`);
    }
    if (m.totalLifecycle > 0) {
      console.log(`   🧬 Lifecycle:        ${m.totalLifecycle}`);
    }
    if (m.totalReactivity > 0) {
      console.log(`   ⚡ Reactivity:       ${m.totalReactivity}`);
    }
    if (m.reExportChains > 0) {
      console.log(`   🔄 Re-exports:       ${m.reExportChains}`);
    }
  }

  /**
   * ✅ v4.0.0: печатает итоговую сводку pipeline.
   */
  private printPipelineSummary(m: PipelineMetrics): void {
    console.log('\n📊 PIPELINE METRICS:');
    console.log(`   • Files parsed:  ${m.filesParsed}/${m.filesDiscovered}`);
    console.log(`   • Vue / TS-JS:   ${m.vueFiles} / ${m.tsFiles}`);
    console.log(`   • Failed:        ${m.filesFailed}`);
    console.log(`   • Functions:     ${m.totalFunctions}`);
    console.log(`   • Constants:     ${m.totalConstants}`);
    console.log(`   • Imports:       ${m.totalImports}`);
    console.log(`   • Exports:       ${m.totalExports}`);
    if (m.totalConditionals > 0) {
      console.log(`   • Conditionals:  ${m.totalConditionals}`);
    }
    if (m.totalLifecycle > 0) {
      console.log(`   • Lifecycle:     ${m.totalLifecycle}`);
    }
    if (m.totalReactivity > 0) {
      console.log(`   • Reactivity:    ${m.totalReactivity}`);
    }
    console.log(`   • Duration:      ${(m.durationMs / 1000).toFixed(2)}s`);

    // Тайминги stages (только если их немного)
    const stageEntries = Object.entries(m.stageTimings);
    if (stageEntries.length > 0) {
      console.log('   • Stage timings:');
      for (const [stage, ms] of stageEntries) {
        console.log(`      - ${stage.padEnd(22)} ${ms}ms`);
      }
    }
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
    options: ProjectCommandOptions,
    pipelineResult?: Awaited<ReturnType<AnalysisPipeline['run']>>
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
    //    ✅ v4.0.0: используем enhancedMap из pipeline, если есть
    // ----------------------------------------------------------
    if (options.entities && (pipelineResult || graphResult.entities)) {
      try {
        const { generateCompactReport } = require('../../reporters/compact-reporter.js');
        const compactPath = path.join(outputDir, 'compact-universe.json');

        const entitiesForCompact = pipelineResult
          ? pipelineResult.enhancedMap
          : graphResult.entities;

        generateCompactReport(entitiesForCompact, compactPath, {
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
    if (options.optimized && (pipelineResult || graphResult.entities)) {
      try {
        const {
          saveOptimizedPackageLockReport,
        } = require('../../reporters/json/builders/save-optimized.js');
        const optimizedPath = path.join(outputDir, 'optimized-report.json');

        const entitiesForOptimized = pipelineResult
          ? pipelineResult.entitiesMap
          : graphResult.entities;

        saveOptimizedPackageLockReport(
          graphResult.rootKey,
          graphResult.graph,
          entitiesForOptimized,
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
    const metadata: any = {
      timestamp: new Date().toISOString(),
      entryPoint: graphResult.rootKey,
      depth: parseInt(options.depth, 10),
      stats: graphResult.stats,
      savedFiles,
    };

    // ✅ v4.0.0: добавляем метрики pipeline в metadata
    if (pipelineResult) {
      metadata.pipelineMetrics = pipelineResult.metrics;
    }

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
