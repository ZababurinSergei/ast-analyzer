// packages/ast-analyzer/src/cli/commands/ProjectCommand.ts
// ПОЛНАЯ ВЕРСИЯ - все ошибки исправлены

import fs from 'fs';
import path from 'path';
import type { Command } from 'commander';

/**
 * Команда: project
 *
 * Строит граф зависимостей проекта от точки входа
 *
 * Использование:
 *   ast-analyzer project <file> [options]
 *
 * Опции:
 *   -d, --depth <n>      Максимальная глубина (по умолчанию: 5)
 *   --entities           Включить анализ сущностей
 *   --include-body       Включить тела функций в отчет
 *   --vue                Включить анализ Vue компонентов
 *   --from <function>    Начальная функция для графа вызовов
 *   --to <function>      Конечная функция для графа вызовов
 *   --optimized          Сгенерировать оптимизированный отчет
 *   -o, --output <dir>   Выходная директория
 *   -v, --verbose        Подробный вывод
 */
export class ProjectCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

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
      .action(async (file: string, options: any) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          console.error('❌ Error:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет команду project
   */
  private async execute(file: string, options: any): Promise<void> {
    const startTime = Date.now();

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

    // Проверяем существование файла
    const resolvedFile = path.resolve(file);
    if (!fs.existsSync(resolvedFile)) {
      console.error(`❌ File not found: ${resolvedFile}`);
      process.exit(1);
    }

    // Проверяем выходную директорию
    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('\n🔍 Building project graph...');

    // Импортируем buildProjectGraph
    const { buildProjectGraph } = await import('../../modes/project-graph.js');

    // Запускаем построение графа
    const result = buildProjectGraph(
      resolvedFile,
      parseInt(options.depth),
      options.entities,
      options.from,
      options.to
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Выводим информацию о графе
    const totalModules = Object.keys(result.graph).length;
    let totalEdges = 0;
    for (const deps of Object.values(result.graph)) {
      totalEdges += deps.length;
    }

    console.log(`\n✅ Graph built in ${duration}s`);
    console.log(`   📦 Modules: ${totalModules}`);
    console.log(`   🔗 Dependencies: ${totalEdges}`);

    // Если есть сущности, выводим статистику
    if (result.entities) {
      let totalFunctions = 0;
      let totalClasses = 0;
      let totalConstants = 0;
      let totalInterfaces = 0;
      let totalTypes = 0;
      let totalVariables = 0;
      let totalCalls = 0;

      for (const entities of Object.values(result.entities)) {
        if (entities) {
          totalFunctions += entities.functions?.length || 0;
          totalClasses += entities.classes?.length || 0;
          totalConstants += entities.constants?.length || 0;
          totalInterfaces += entities.interfaces?.length || 0;
          totalTypes += entities.types?.length || 0;
          totalVariables += entities.variables?.length || 0;
          for (const func of entities.functions || []) {
            totalCalls += func.calls?.length || 0;
          }
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

      // Если есть relationships, выводим статистику
      if (result.relationshipGraph) {
        const relCount = Object.keys(result.relationshipGraph).length;
        let totalCallsInfo = 0;
        let totalCalledBy = 0;
        let totalImportedBy = 0;

        for (const func of Object.values(result.relationshipGraph)) {
          const f = func as any;
          totalCallsInfo += f.calls?.length || 0;
          totalCalledBy += f.calledBy?.length || 0;
          totalImportedBy += f.importedBy?.length || 0;
        }

        console.log(`\n🔗 Relationships:`);
        console.log(`   • Functions with relationships: ${relCount}`);
        console.log(`   • Calls: ${totalCallsInfo}`);
        console.log(`   • Called by: ${totalCalledBy}`);
        console.log(`   • Imported by: ${totalImportedBy}`);
      }
    }

    // Если есть callGraphResult, выводим путь
    if (result.callGraphResult) {
      console.log(`\n🕸️ Call Graph Path:`);
      if (result.callGraphResult.found) {
        console.log(`   ✅ Path found: ${result.callGraphResult.path?.join(' → ') || 'empty'}`);
        console.log(`   📊 Nodes in path: ${result.callGraphResult.nodes?.length || 0}`);
        console.log(`   📊 Edges in path: ${result.callGraphResult.edges?.length || 0}`);
      } else {
        console.log(`   ❌ Path not found: ${result.callGraphResult.reason}`);
      }
    }

    // Сохраняем результаты
    console.log('\n💾 Saving results...');

    // Основной JSON отчет
    const jsonPath = path.join(outputDir, 'project-graph.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    console.log(`   ✅ ${jsonPath}`);

    // ✅ ИСПРАВЛЕНО: используем generateCompactReport вместо удаленной функции
    if (options.optimized && result.entities) {
      console.log('\n📊 Generating optimized report with embedded relationships...');
      const { generateCompactReport } = await import('../../reporters/compact-reporter.js');

      const optimizedPath = path.join(outputDir, 'optimized-report.json');

      // Генерируем компактный отчет с опциями
      generateCompactReport(result.entities, optimizedPath, {
        useBitFlags: true,
        useDictionaries: true,
        readableKeys: true,
        useTemplates: true,
        maxDepth: parseInt(options.depth),
        includeRelations: true,
        includeStats: true,
        includeTypes: true,
        includeInheritance: true,
        includeExports: true,
        includeConstants: true,
        // ✅ НЕ ИСПОЛЬЗУЕМ ultraCompact здесь
      });

      console.log(`   ✅ ${optimizedPath}`);
      console.log(`   💡 All relationships embedded in entities for fast navigation`);
    }

    // Если есть Vue анализ, сохраняем отдельно
    if (options.vue && result.entities) {
      const vueFiles: string[] = [];
      for (const filePath of Object.keys(result.graph)) {
        if (filePath.endsWith('.vue')) {
          vueFiles.push(filePath);
        }
      }

      if (vueFiles.length > 0) {
        console.log(`\n⚛️ Found ${vueFiles.length} Vue files`);

        const { analyzeVueComponent } = await import('../../modes/vue-analyzer/index.js');

        for (const vueFile of vueFiles) {
          try {
            const absPath = path.resolve(vueFile);
            if (fs.existsSync(absPath)) {
              const vueAnalysis = analyzeVueComponent(absPath, {
                includeTemplateAST: true,
                includeScriptAST: true,
                extractComposableCalls: true,
              });

              if (vueAnalysis) {
                const vueReportPath = path.join(
                  outputDir,
                  `vue-analysis-${path.basename(vueFile, '.vue')}.json`
                );
                fs.writeFileSync(vueReportPath, JSON.stringify(vueAnalysis, null, 2));
                console.log(`   ✅ ${path.basename(vueReportPath)}`);
              }
            }
          } catch (error) {
            console.warn(`   ⚠️ Failed to analyze ${vueFile}:`, error);
          }
        }
      }
    }

    // Генерируем компактный отчет (исправленный импорт)
    if (options.entities && result.entities) {
      console.log('\n📦 Generating compact universe report...');

      const { generateCompactReport } = await import('../../reporters/compact-reporter.js');

      const compactPath = path.join(outputDir, 'compact-universe.json');
      generateCompactReport(result.entities, compactPath, {
        useBitFlags: true,
        useDictionaries: true,
        readableKeys: true,
        useTemplates: true,
        maxDepth: parseInt(options.depth),
        includeRelations: true,
        includeStats: true,
      });
      console.log(`   ✅ ${compactPath}`);
    }

    // Генерируем HTML отчет если есть graph
    if (result.graph && Object.keys(result.graph).length > 0) {
      console.log('\n📄 Generating HTML report...');

      const { convertToDOT, findCyclicEdges } = await import('../../core/graph-utils.js');
      const { generateHTMLReport } = await import('../../reporters/html-reporter.js');
      const { Graphviz } = await import('@hpcc-js/wasm-graphviz');

      const cyclicEdges = findCyclicEdges(result.graph);
      const hasCycles = cyclicEdges.size > 0;

      const dotContent = convertToDOT(
        { rootKey: result.rootKey, graph: result.graph },
        cyclicEdges
      );

      const graphviz = await Graphviz.load();
      const svgContent = graphviz.dot(dotContent);

      const htmlContent = generateHTMLReport(
        svgContent,
        dotContent,
        JSON.stringify(result, null, 2),
        result.rootKey,
        hasCycles
      );

      const htmlPath = path.join(outputDir, 'project-report.html');
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`   ✅ ${htmlPath}`);

      if (hasCycles) {
        console.log(`\n⚠️ Found ${cyclicEdges.size} cyclic dependencies!`);
        console.log('   Check project-report.html for visualization');
      }
    }

    // Финальный вывод
    console.log('\n' + '='.repeat(70));
    console.log('✨ PROJECT GRAPH ANALYSIS COMPLETE');
    console.log('='.repeat(70));
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`📁 Output directory: ${outputDir}`);
    console.log(`📊 Modules: ${totalModules}`);
    console.log(`🔗 Dependencies: ${totalEdges}`);

    if (result.entities) {
      console.log(
        `📊 Entities: ${Object.values(result.entities).reduce((sum, e) => sum + (e?.functions?.length || 0), 0)} functions`
      );
    }

    if (result.callGraphResult?.found && result.callGraphResult.path) {
      console.log(`🕸️ Path: ${result.callGraphResult.path.join(' → ')}`);
    }

    console.log('='.repeat(70) + '\n');

    // Сохраняем метаданные
    const hasCyclesFlag = result.stats?.hasCycles || false;

    const metadata = {
      timestamp: new Date().toISOString(),
      entryPoint: file,
      depth: parseInt(options.depth),
      totalModules,
      totalEdges,
      hasCycles: hasCyclesFlag,
      duration: parseFloat(duration),
      entities: result.entities
        ? {
            totalFunctions: Object.values(result.entities).reduce(
              (sum, e) => sum + (e?.functions?.length || 0),
              0
            ),
            totalClasses: Object.values(result.entities).reduce(
              (sum, e) => sum + (e?.classes?.length || 0),
              0
            ),
            totalConstants: Object.values(result.entities).reduce(
              (sum, e) => sum + (e?.constants?.length || 0),
              0
            ),
            totalInterfaces: Object.values(result.entities).reduce(
              (sum, e) => sum + (e?.interfaces?.length || 0),
              0
            ),
            totalTypes: Object.values(result.entities).reduce(
              (sum, e) => sum + (e?.types?.length || 0),
              0
            ),
            totalVariables: Object.values(result.entities).reduce(
              (sum, e) => sum + (e?.variables?.length || 0),
              0
            ),
            totalCalls: Object.values(result.entities).reduce((sum, e) => {
              let calls = 0;
              for (const func of e?.functions || []) {
                calls += func.calls?.length || 0;
              }
              return sum + calls;
            }, 0),
          }
        : undefined,
    };

    const metadataPath = path.join(outputDir, 'project-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`   ✅ ${metadataPath}`);
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default ProjectCommand;
