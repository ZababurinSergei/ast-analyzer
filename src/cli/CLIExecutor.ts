// packages/ast-analyzer/src/cli/CLIExecutor.ts
// НОВЫЙ ФАЙЛ - Полный текст

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';

// Импортируем новую команду
import { CompactRecursiveCommand } from './commands/CompactRecursiveCommand.js';

/**
 * Исполнитель CLI команд
 * Регистрирует и выполняет все команды AST Analyzer
 */
export class CLIExecutor {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('ast-analyzer')
      .description('🔍 AST Analyzer - AI Toolkit for Code Analysis')
      .version('3.0.0');

    // Регистрируем все команды
    this.registerProjectCommand();
    this.registerFileCommand();
    this.registerMinifyCommand();
    this.registerMinifyFolderCommand();
    this.registerPromptPackCommand();
    this.registerSplitModuleCommand();
    this.registerVueAnalyzeCommand();
    this.registerImpactCommand();
    this.registerDeadCodeCommand();
    this.registerSemanticCommand();
    this.registerVerifyCommand();
    this.registerRefactorCommand();
    this.registerCompactCommand();
    this.registerCompactRecursiveCommand(); // НОВАЯ КОМАНДА
    this.registerHybridReportCommand();
    this.registerInitCommand();
    this.registerStatusCommand();

    // ============================================
    // ✅ НОВЫЕ КОМАНДЫ (v5.1.0)
    // ============================================
    this.registerSelfCommand();
    this.registerAnalyzeExtendedCommand();
    this.registerCacheCommand();
  }

  // ============================================
  // 1. PROJECT COMMAND
  // ============================================

  private registerProjectCommand(): void {
    this.program
      .command('project <file>')
      .description('Build project dependency graph')
      .option('-d, --depth <n>', 'Maximum depth', '5')
      .option('--entities', 'Include entity analysis')
      .option('--include-body', 'Include function bodies')
      .option('--vue', 'Include Vue analysis')
      .option('--from <function>', 'Start function for call graph')
      .option('--to <function>', 'End function for call graph')
      .option('--optimized', 'Generate optimized report with embedded relationships')
      .option('-o, --output <dir>', 'Output directory')
      .action(async (file, options) => {
        console.log('📊 Building project graph...');
        console.log(`📄 Entry point: ${file}`);
        console.log(`📏 Depth: ${options.depth}`);
        console.log(`🔍 Entities: ${options.entities ? 'ON' : 'OFF'}`);
        console.log(`📝 Include body: ${options.includeBody ? 'ON' : 'OFF'}`);
        console.log(`⚛️ Vue analysis: ${options.vue ? 'ON' : 'OFF'}`);

        const { buildProjectGraph } = await import('../modes/project-graph.js');
        const result = buildProjectGraph(
          file,
          parseInt(options.depth),
          options.entities,
          options.from,
          options.to
        );

        if (options.output) {
          const outputDir = path.resolve(options.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const outputFile = path.join(outputDir, 'project-graph.json');
          fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
          console.log(`✅ Graph saved: ${outputFile}`);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      });
  }

  // ============================================
  // 2. FILE COMMAND
  // ============================================

  private registerFileCommand(): void {
    this.program
      .command('file <file>')
      .description('Build internal file graph')
      .option('--entities', 'Include entity analysis')
      .option('-o, --output <dir>', 'Output directory')
      .action(async (file, options) => {
        console.log(`📄 Building internal graph for: ${file}`);

        const { buildFileInternalGraph } = await import('../modes/file-graph.js');
        const result = buildFileInternalGraph(file);

        if (options.output) {
          const outputDir = path.resolve(options.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const outputFile = path.join(outputDir, 'file-graph.json');
          fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
          console.log(`✅ Graph saved: ${outputFile}`);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      });
  }

  // ============================================
  // 3. MINIFY COMMAND
  // ============================================

  private registerMinifyCommand(): void {
    this.program
      .command('minify <file>')
      .description('Minify file for AI (remove implementations, keep signatures)')
      .option('-o, --output <file>', 'Output file', 'ai-context.txt')
      .action(async (file, options) => {
        console.log(`✂️ Minifying: ${file}`);

        const { minifyForAI } = await import('../core/minifier.js');
        const result = minifyForAI(file);

        if (result) {
          const outputPath = path.resolve(options.output);
          fs.writeFileSync(outputPath, result);
          console.log(`✅ Minified code saved: ${outputPath}`);
          console.log(`📊 Size: ${(result.length / 1024).toFixed(2)} KB`);
        } else {
          console.error('❌ Failed to minify file');
          process.exit(1);
        }
      });
  }

  // ============================================
  // 4. MINIFY-FOLDER COMMAND
  // ============================================

  private registerMinifyFolderCommand(): void {
    this.program
      .command('minify-folder <dir>')
      .description('Recursively minify entire project for AI')
      .option('-o, --output <file>', 'Output file', 'ai-project-context.md')
      .option('-d, --depth <n>', 'Maximum depth', '10')
      .option(
        '-e, --extensions <list>',
        'File extensions (comma-separated)',
        '.js,.ts,.tsx,.jsx,.vue,.mjs,.cjs'
      )
      .option('-x, --exclude <list>', 'Exclude patterns (comma-separated)')
      .option('--no-structure', 'Hide directory structure')
      .option('--no-toc', 'Hide table of contents')
      .action(async (dir, options) => {
        console.log(`📁 Minifying folder: ${dir}`);

        const { minifyFolder } = await import('../modes/minify-folder.js');
        const excludePatterns = options.exclude
          ? options.exclude.split(',').map((p: string) => p.trim())
          : undefined;

        const result = minifyFolder(dir, {
          outputFile: options.output,
          maxDepth: parseInt(options.depth),
          extensions: options.extensions.split(',').map((e: string) => e.trim()),
          excludePatterns,
          showStructure: options.structure !== false,
          addTableOfContents: options.toc !== false,
          sortByType: true,
        });

        if (!result) {
          console.error('❌ Failed to minify folder');
          process.exit(1);
        }
      });
  }

  // ============================================
  // 5. PROMPT-PACK COMMAND
  // ============================================

  private registerPromptPackCommand(): void {
    this.program
      .command('prompt-pack <file>')
      .description('Build AI prompt pack: target file + minified dependencies')
      .option('-d, --depth <n>', 'Maximum depth', '2')
      .option('-o, --output <file>', 'Output file', 'ai-prompt-bundle.md')
      .action(async (file, options) => {
        console.log(`🎒 Building prompt pack for: ${file}`);
        console.log(`📏 Depth: ${options.depth}`);

        const { buildAiPromptPack } = await import('../modes/prompt-pack.js');
        const result = buildAiPromptPack(file, parseInt(options.depth));

        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, result);
        console.log(`✅ Prompt pack saved: ${outputPath}`);
        console.log(`📊 Size: ${(result.length / 1024).toFixed(2)} KB`);
      });
  }

  // ============================================
  // 6. SPLIT-MODULE COMMAND
  // ============================================

  private registerSplitModuleCommand(): void {
    this.program
      .command('split-module <file>')
      .description('Split file into modules (generate AI prompt)')
      .option('-o, --output <file>', 'Output file', 'ai-split-module-prompt.md')
      .option('-t, --target-size <n>', 'Target cluster size', '3')
      .option('-m, --max-size <n>', 'Maximum cluster size', '10')
      .option('-d, --max-depth <n>', 'Maximum depth', '5')
      .option('-x, --exclude <list>', 'Exclude patterns (comma-separated)')
      .option('--prefix <str>', 'File prefix')
      .option('--no-full-code', 'Exclude full code')
      .option('--no-minified', 'Exclude minified version')
      .option('--no-graph', 'Exclude call graph')
      .option('--no-stats', 'Exclude statistics')
      .option('--no-suggestions', 'Exclude suggestions')
      .option('--no-vue', 'Skip Vue analysis')
      .action(async (file, options) => {
        console.log(`🔪 Splitting module: ${file}`);

        const { buildSplitModulePrompt } = await import('../modes/split-module.js');
        const excludePatterns = options.exclude
          ? options.exclude.split(',').map((p: string) => p.trim())
          : undefined;

        const result = buildSplitModulePrompt(file, {
          outputFile: options.output,
          targetClusterSize: parseInt(options.targetSize),
          maxClusterSize: parseInt(options.maxSize),
          maxDepth: parseInt(options.maxDepth),
          excludePatterns,
          prefix: options.prefix,
          includeFullCode: options.fullCode !== false,
          includeMinified: options.minified !== false,
          includeGraph: options.graph !== false,
          includeStats: options.stats !== false,
          includeSuggestions: options.suggestions !== false,
          includeVueAnalysis: options.vue !== false,
        });

        if (!result) {
          console.error('❌ Failed to analyze file');
          process.exit(1);
        }
      });
  }

  // ============================================
  // 7. VUE-ANALYZE COMMAND
  // ============================================

  private registerVueAnalyzeCommand(): void {
    this.program
      .command('vue-analyze <file>')
      .description('Analyze Vue component')
      .alias('vue')
      .option('--no-template-ast', 'Skip template AST')
      .option('--no-script-ast', 'Skip script AST')
      .option('--no-composables', 'Skip composable extraction')
      .option('-o, --output <dir>', 'Output directory')
      .action(async (file, options) => {
        console.log(`🎯 Analyzing Vue component: ${file}`);

        const { analyzeVueComponentCli } = await import('../modes/vue-analyzer/index.js');

        const outputDir = options.output ? path.resolve(options.output) : process.cwd();
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Временно меняем CWD для сохранения файлов в нужную директорию
        const originalCwd = process.cwd();
        process.chdir(outputDir);

        try {
          await analyzeVueComponentCli(file, {
            includeTemplateAST: options.templateAst !== false,
            includeScriptAST: options.scriptAst !== false,
            extractComposableCalls: options.composables !== false,
          });
        } finally {
          process.chdir(originalCwd);
        }
      });
  }

  // ============================================
  // 8. IMPACT COMMAND
  // ============================================

  private registerImpactCommand(): void {
    this.program
      .command('impact <file> <entity>')
      .description('Analyze impact zone: find all files using the entity')
      .option('-o, --output <file>', 'Output file', 'ai-impact-report.md')
      .action(async (file, entity, options) => {
        console.log(`💥 Analyzing impact of: ${entity}`);
        console.log(`📄 In file: ${file}`);

        const { runImpactAnalysis } = await import('../modes/impact.js');
        const result = runImpactAnalysis(file, entity);

        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, result);
        console.log(`✅ Impact report saved: ${outputPath}`);
      });
  }

  // ============================================
  // 9. DEAD-CODE COMMAND
  // ============================================

  private registerDeadCodeCommand(): void {
    this.program
      .command('dead-code <file>')
      .description('Find dead code (unused functions, exports, variables)')
      .option('-o, --output <file>', 'Output file', 'ai-dead-code-report.md')
      .action(async (file, options) => {
        console.log(`🗑️ Finding dead code in: ${file}`);

        const { findDeadCode } = await import('../modes/dead-code.js');
        const result = findDeadCode(file);

        if (result) {
          const outputPath = path.resolve(options.output);
          fs.writeFileSync(outputPath, result);
          console.log(`✅ Dead code report saved: ${outputPath}`);
        } else {
          console.error('❌ Failed to analyze file');
          process.exit(1);
        }
      });
  }

  // ============================================
  // 10. SEMANTIC COMMAND
  // ============================================

  private registerSemanticCommand(): void {
    this.program
      .command('semantic <paths...>')
      .description('Run full semantic analysis (CFG + Call Graph + Types + Data Flow)')
      .option('-r, --recursive', 'Search recursively')
      .option('--formal', 'Enable formal verification with Z3')
      .option('--max-depth <n>', 'Maximum depth', '5')
      .option('--critical <functions>', 'Critical functions (comma-separated)')
      .option('-o, --output <dir>', 'Output directory', './semantic-reports')
      .option('--format <format>', 'Report format (json, html, markdown)', 'html')
      .option('-v, --verbose', 'Verbose output')
      .action(async (paths, options) => {
        console.log('🔬 Running semantic analysis...');
        console.log(`📁 Paths: ${paths.join(', ')}`);
        console.log(`🔬 Formal verification: ${options.formal ? 'ON' : 'OFF'}`);

        const { SemanticPipeline } = await import('../ci-cd/SemanticPipeline.js');
        const pipeline = new SemanticPipeline();
        const result = await pipeline.run(paths, {
          formalVerification: options.formal || false,
          maxDepth: parseInt(options.maxDepth),
          criticalFunctions: options.critical ? options.critical.split(',') : [],
          generateReport: true,
          reportFormat: options.format,
          outputDir: options.output,
        });

        console.log(`✅ Semantic analysis complete (${(result.duration / 1000).toFixed(2)}s)`);
        console.log(`📊 Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`📊 Issues: ${result.issues.length}`);

        if (options.verbose) {
          console.log(JSON.stringify(result, null, 2));
        }
      });
  }

  // ============================================
  // 11. VERIFY COMMAND
  // ============================================

  private registerVerifyCommand(): void {
    this.program
      .command('verify <file>')
      .description('Formal verification with Z3')
      .option('-f, --function <name>', 'Function name to verify')
      .option('-c, --contract <file>', 'Contract file (JSON)')
      .option('-o, --output <file>', 'Save result to file')
      .action(async (file, options) => {
        console.log('🔬 Formal verification...');
        console.log(`📄 File: ${file}`);

        const { Z3Verifier, range } = await import('../formal/Z3Verifier.js');
        const z3 = new Z3Verifier();
        await z3.initialize();

        let contract: any = null;

        if (options.contract) {
          const contractPath = path.resolve(options.contract);
          if (!fs.existsSync(contractPath)) {
            console.error(`❌ Contract not found: ${contractPath}`);
            process.exit(1);
          }
          contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
          console.log(`📋 Contract loaded: ${contractPath}`);
        } else if (options.function) {
          const { Project } = await import('ts-morph');
          const project = new Project({
            compilerOptions: {
              target: 99,
              module: 99,
              allowJs: true,
              checkJs: false,
              skipLibCheck: true,
            },
          });
          const sourceFile = project.addSourceFileAtPath(file);
          const func = sourceFile.getFunction(options.function);

          if (!func) {
            console.error(`❌ Function '${options.function}' not found in ${file}`);
            process.exit(1);
          }

          const params = func.getParameters().map((p: any) => ({
            name: p.getName(),
            type: 'int' as const,
          }));

          const returnType = func.getReturnType();
          let retType: 'int' | 'bool' | 'string' | 'void' = 'int';
          if (returnType.isBoolean()) retType = 'bool';
          else if (returnType.isString()) retType = 'string';
          else if (returnType.isVoid()) retType = 'void';

          contract = {
            name: options.function,
            params,
            returnType: retType,
            preconditions: params.map((p: any) => range(p.name, -1000, 1000)),
            postconditions: [],
            invariants: [],
          };

          console.log(`📋 Contract extracted from function: ${options.function}`);
        } else {
          console.error('❌ Please specify --function <name> or --contract <file>');
          process.exit(1);
        }

        console.log(`\\n📋 Contract:`);
        console.log(`   Function: ${contract.name}`);
        console.log(
          `   Params: ${contract.params.map((p: any) => `${p.name}:${p.type}`).join(', ')}`
        );
        console.log(`   Return: ${contract.returnType}`);
        console.log(`   Preconditions: ${contract.preconditions.length}`);

        const result = await z3.verifyFunction(contract);

        if (result.isValid) {
          console.log(`\\n✅ Function VERIFIED!`);
          console.log(`   ${contract.name} satisfies all contracts`);
        } else {
          console.log(`\\n❌ Function NOT VERIFIED!`);
          if (result.counterexample) {
            console.log(`\\n🔍 Counterexample:`);
            for (const [key, value] of result.counterexample) {
              console.log(`   ${key} = ${value}`);
            }
          }
          if (result.error) {
            console.log(`\\n⚠️ Error: ${result.error}`);
          }
        }

        console.log(`⏱️ Time: ${result.time || 0}ms`);

        if (options.output) {
          const outputPath = path.resolve(options.output);
          fs.writeFileSync(outputPath, JSON.stringify({ contract, result }, null, 2));
          console.log(`📄 Result saved: ${outputPath}`);
        }

        await z3.dispose();
        process.exit(result.isValid ? 0 : 1);
      });
  }

  // ============================================
  // 12. REFACTOR COMMAND
  // ============================================

  private registerRefactorCommand(): void {
    this.program
      .command('refactor <file>')
      .description('Auto-refactor file with full pipeline (semantic + validation + extraction)')
      .option('-o, --out-dir <dir>', 'Output directory', 'modules')
      .option('-t, --target-size <n>', 'Target cluster size', '3')
      .option('-m, --max-size <n>', 'Maximum cluster size', '10')
      .option('-c, --min-cohesion <n>', 'Minimum cohesion score (%)', '60')
      .option('-d, --dry-run', 'Dry run without changes')
      .option('--no-backup', 'Skip backup creation')
      .option('--no-semantic', 'Skip semantic analysis')
      .option('--no-formal', 'Skip formal verification')
      .option('--no-vue', 'Skip Vue template update')
      .option('--no-eslint', 'Skip ESLint')
      .option('--no-typescript', 'Skip TypeScript check')
      .option('--guarantee', 'Enable guarantee mode', true)
      .option('--max-attempts <n>', 'Maximum attempts', '3')
      .option('-v, --verbose', 'Verbose output')
      .action(async (file, options) => {
        console.log(`🔧 Auto-refactoring: ${file}`);
        console.log(`📁 Output directory: ${options.outDir}`);
        console.log(`🎯 Target size: ${options.targetSize}`);
        console.log(`🛡️ Guarantee mode: ${options.guarantee ? 'ON' : 'OFF'}`);

        const { AutoRefactor } = await import('../refactor/AutoRefactor.js');
        const refactor = new AutoRefactor({
          modulesDir: options.outDir,
          targetClusterSize: parseInt(options.targetSize),
          maxClusterSize: parseInt(options.maxSize),
          minCohesionScore: parseInt(options.minCohesion),
          dryRun: options.dryRun || false,
          createBackup: options.backup !== false,
          updateTemplate: options.vue !== false,
          semanticAnalysis: options.semantic !== false,
          formalVerification: options.formal !== false,
          eslintCheck: options.eslint !== false,
          typeCheck: options.typescript !== false,
          guaranteeMode: options.guarantee !== false,
          maxAttempts: parseInt(options.maxAttempts),
          verbose: options.verbose || false,
        });

        await refactor.initialize();
        const result = await refactor.refactor(file);
        await refactor.dispose();

        if (result.success) {
          console.log(`\\n✅ Refactoring COMPLETED!`);
          console.log(`📦 Modules created: ${result.modules.length}`);
          if (result.modules.length > 0) {
            for (const module of result.modules) {
              console.log(`   ✅ ${module.name} (${module.exports.length} exports)`);
            }
          }
          if (result.backupPath) {
            console.log(`💾 Backup: ${result.backupPath}`);
          }
          if (result.metrics) {
            console.log(`\\n📊 Metrics:`);
            console.log(`   • Functions: ${result.metrics.totalFunctions}`);
            console.log(`   • Complexity: ${result.metrics.cyclomaticComplexity}`);
            console.log(`   • Verified: ${result.metrics.verifiedFunctionsCount}`);
            console.log(`   • ESLint fixes: ${result.metrics.eslintFixesCount}`);
          }
        } else {
          console.error(`\\n❌ Refactoring FAILED: ${result.error}`);
          if (result.backupPath) {
            console.log(`💾 Backup saved: ${result.backupPath}`);
          }
          process.exit(1);
        }
      });
  }

  // ============================================
  // 13. COMPACT COMMAND
  // ============================================

  private registerCompactCommand(): void {
    this.program
      .command('compact <file>')
      .description('Generate compact entity report (minimized, with short IDs)')
      .option('-o, --output <file>', 'Output file', 'entities.json')
      .option('--ultra', 'Ultra-compact mode (max compression)')
      .option('--no-bit-flags', 'Disable bit flags (use full booleans)')
      .option('--no-dictionaries', 'Disable dictionaries')
      .option('--minify-keys', 'Minify keys (shorter JSON)')
      .option('--max-depth <n>', 'Maximum depth', '10')
      .option(
        '--preset <name>',
        'Preset: minimal, standard, full, relationshipsOnly, ultraCompact',
        'standard'
      )
      .action(async (file, options) => {
        console.log(`📋 Generating compact report: ${file}`);
        console.log(`🚀 Ultra-compact: ${options.ultra ? 'ON' : 'OFF'}`);
        console.log(`📋 Preset: ${options.preset}`);

        const { parseFile } = await import('../core/ast-parser.js');
        const { extractEntities } = await import('../core/entity-extractor.js');
        const { generateCompactReport } = await import('../reporters/compact-reporter.js');

        const parsed = parseFile(file);
        if (!parsed) {
          console.error('❌ Failed to parse file');
          process.exit(1);
        }

        const entities = extractEntities(parsed.ast, file);
        const entitiesMap = { [file]: entities };

        // Применяем пресет
        const presets = ['minimal', 'standard', 'full', 'relationshipsOnly', 'ultraCompact'];
        if (!presets.includes(options.preset)) {
          console.warn(`⚠️ Unknown preset: ${options.preset}, using 'standard'`);
        }

        const outputPath = path.resolve(options.output);
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const report = generateCompactReport(entitiesMap, outputPath, {
          useBitFlags: options.bitFlags !== false,
          useDictionaries: options.dictionaries !== false,
          readableKeys: !options.minifyKeys,
          useTemplates: true,
          maxDepth: parseInt(options.maxDepth),
          includeSelfFunctions: true, // ✅ ВКЛЮЧАЕМ SELF FUNCTIONS
        });

        console.log(`\\n✅ Report saved: ${outputPath}`);
        console.log(`📊 Stats:`);
        console.log(`   • Modules: ${report.stats.tm}`);
        console.log(`   • Files: ${report.files?.length || 0}`);
        console.log(`   • Functions: ${report.stats.tf}`);
        console.log(`   • Self functions: ${report.stats.tsf || 0}`); // ✅ НОВОЕ
        console.log(`   • Calls: ${report.stats.tc}`);
        console.log(`   • Imports: ${report.stats.ti || 0}`);
        console.log(`   • Exports: ${report.stats.tex || 0}`);
        console.log(`   • Unresolved: ${report.stats.tun || 0}`);
      });
  }

  // ============================================
  // 13.5. COMPACT-RECURSIVE COMMAND
  // ============================================

  private registerCompactRecursiveCommand(): void {
    // Регистрируем новую команду через отдельный класс
    new CompactRecursiveCommand(this.program);
  }

  // ============================================
  // 14. HYBRID-REPORT COMMAND
  // ============================================

  private registerHybridReportCommand(): void {
    this.program
      .command('hybrid-report <file>')
      .description('Generate hybrid report: modules + functions with 3D coordinates')
      .alias('hybrid')
      .option('-d, --depth <n>', 'Maximum depth', '5')
      .option('-o, --output <dir>', 'Output directory', './hybrid-reports')
      .action(async (file, options) => {
        console.log(`🔀 Generating hybrid report: ${file}`);
        console.log(`📏 Depth: ${options.depth}`);

        const { runHybridReport } = await import('../modes/hybrid-report/index.js');
        const outputDir = path.resolve(options.output);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const report = await runHybridReport(file, parseInt(options.depth), outputDir);

        console.log(`\\n✅ Hybrid report complete!`);
        console.log(`📁 Output: ${outputDir}`);
        console.log(`📊 Modules: ${report.stats.totalModules}`);
        console.log(`📊 Functions: ${report.stats.totalFunctions}`);
        console.log(`🔄 Cycles: ${report.stats.cycles}`);
      });
  }

  // ============================================
  // 15. INIT COMMAND
  // ============================================

  private registerInitCommand(): void {
    this.program
      .command('init')
      .description('Create configuration file .ast-cicd.json')
      .action(async () => {
        const configPath = path.resolve(process.cwd(), '.ast-cicd.json');

        if (fs.existsSync(configPath)) {
          console.log('⚠️ File .ast-cicd.json already exists');
          const { askYesNo } = await import('../utils/askQuestion.js');
          const overwrite = await askYesNo('Overwrite?', 'n');
          if (!overwrite) {
            console.log('❌ Cancelled');
            process.exit(0);
          }
        }

        const defaultConfig = {
          $schema: './node_modules/ast-analyzer/ci-cd-schema.json',
          version: '1.0.0',
          typescript: {
            strict: true,
            noImplicitAny: true,
            strictNullChecks: true,
            jsx: true,
          },
          eslint: {
            enabled: true,
            config: '.eslintrc.json',
            autoFix: true,
          },
          autoFix: {
            enabled: true,
            createBackup: true,
            maxIterations: 3,
          },
          ignore: {
            files: ['**/*.test.ts', '**/*.spec.ts', '**/dist/**', '**/build/**'],
            errors: [2307, 2304],
          },
        };

        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(`✅ Created: ${configPath}`);

        // Создаем ESLint конфиг если нет
        const eslintConfigPath = path.resolve(process.cwd(), '.eslintrc.json');
        if (!fs.existsSync(eslintConfigPath)) {
          console.log('\\n📝 Creating ESLint configuration...');
          const { ESLintPipeline } = await import('../ci-cd/ESLintPipeline.js');
          const eslintPipeline = new ESLintPipeline();
          await eslintPipeline.generateConfig(process.cwd());
        }
      });
  }

  // ============================================
  // 16. STATUS COMMAND
  // ============================================

  private registerStatusCommand(): void {
    this.program
      .command('status')
      .description('Show project status overview')
      .option('-p, --path <dir>', 'Project path', '.')
      .action(async options => {
        console.log('📊 Project Status');
        console.log('='.repeat(60));

        const projectPath = path.resolve(options.path);
        console.log(`📁 Project: ${projectPath}\n`);

        const { glob } = await import('glob');

        // Собираем все файлы
        const allTsFiles = await glob('**/*.{ts,tsx}', {
          cwd: projectPath,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/*.test.ts',
            '**/*.spec.ts',
          ],
          absolute: true,
        });

        const allJsFiles = await glob('**/*.{js,jsx}', {
          cwd: projectPath,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/*.test.js',
            '**/*.spec.js',
          ],
          absolute: true,
        });

        const tsxFiles = allTsFiles.filter((f: string) => f.endsWith('.tsx'));
        const jsxFiles = allJsFiles.filter((f: string) => f.endsWith('.jsx'));

        console.log(`📄 TypeScript files: ${allTsFiles.length}`);
        console.log(`   📘 TSX files: ${tsxFiles.length}`);
        console.log(`📄 JavaScript files: ${allJsFiles.length}`);
        console.log(`   ⚛️ JSX files: ${jsxFiles.length}`);
        console.log(`   📦 Total JSX/TSX: ${tsxFiles.length + jsxFiles.length}`);

        // Проверяем ESLint
        const eslintConfigPath = path.join(projectPath, '.eslintrc.json');
        if (fs.existsSync(eslintConfigPath)) {
          console.log('\n📝 ESLint config: ✅ found');
        } else {
          console.log('\n📝 ESLint config: ❌ missing');
          console.log('   💡 Run: npx ast-analyzer init');
        }

        // Проверяем tsconfig
        const tsconfigPath = path.join(projectPath, 'tsconfig.json');
        if (fs.existsSync(tsconfigPath)) {
          console.log('📝 TypeScript config: ✅ found');
        } else {
          console.log('📝 TypeScript config: ❌ missing');
          console.log('   💡 Run: npx ast-analyzer init');
        }

        console.log('\n💡 Commands to try:');
        console.log('   • npx ast-analyzer project . --entities');
        console.log('   • npx ast-analyzer status');
        console.log('   • npx ast-analyzer compact . --ultra');
        console.log('   • npx ast-analyzer self . --output self.json'); // ✅ НОВАЯ КОМАНДА
        console.log('   • npx ast-analyzer analyze-extended .'); // ✅ НОВАЯ КОМАНДА
      });
  }

  // ============================================
  // ✅ НОВАЯ КОМАНДА: SELF — поиск изолированных функций
  // ============================================

  private registerSelfCommand(): void {
    this.program
      .command('self <paths...>')
      .description('🔍 Find isolated functions (self functions) — functions with no calls')
      .option('-o, --output <file>', 'Output file', 'self-functions.json')
      .option('-r, --recursive', 'Search recursively', true)
      .option('--with-calls', 'Include functions that have calls but are not called', false)
      .option('--format <format>', 'Output format (json, markdown, text)', 'json')
      .option('-v, --verbose', 'Verbose output')
      .action(async (paths: string[], options: any) => {
        console.log('🔍 Searching for self functions (isolated functions)...');
        console.log(`📁 Paths: ${paths.join(', ')}`);
        console.log(`📄 Output: ${options.output}`);
        console.log(`📋 Format: ${options.format}`);

        const { glob } = await import('glob');
        const { idManager } = await import('../core/IdManager.js');

        const allFiles: string[] = [];
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

        for (const inputPath of paths) {
          const resolvedPath = path.resolve(inputPath);
          if (!fs.existsSync(resolvedPath)) continue;

          const stat = fs.statSync(resolvedPath);
          if (stat.isFile()) {
            if (extensions.includes(path.extname(resolvedPath))) {
              allFiles.push(resolvedPath);
            }
          } else if (stat.isDirectory()) {
            const pattern = options.recursive
              ? `${resolvedPath}/**/*{${extensions.join(',')}}`
              : `${resolvedPath}/*{${extensions.join(',')}}`;

            const matched = await glob(pattern, {
              nodir: true,
              ignore: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/coverage/**',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.spec.ts',
              ],
              absolute: true,
            });
            allFiles.push(...matched);
          }
        }

        const uniqueFiles = [...new Set(allFiles)];
        console.log(`📊 Found ${uniqueFiles.length} files to analyze\n`);

        const selfFunctions: {
          id: string;
          name: string;
          file: string;
          line: number;
          isExported: boolean;
          isAsync: boolean;
          params: string[];
        }[] = [];

        const allFunctions: {
          name: string;
          file: string;
          line: number;
          calls: string[];
          calledBy: string[];
          isExported: boolean;
          isAsync: boolean;
          params: string[];
        }[] = [];

        let processed = 0;
        for (const filePath of uniqueFiles) {
          processed++;
          if (options.verbose) {
            process.stdout.write(`\r   📄 Processing: ${processed}/${uniqueFiles.length}`);
          }

          try {
            const { parseFile } = await import('../core/ast-parser.js');
            const { extractEntities } = await import('../core/entity-extractor.js');

            const parsed = parseFile(filePath);
            if (!parsed) continue;

            const entities = extractEntities(parsed.ast, filePath);
            if (!entities || !entities.functions) continue;

            const fileFunctions = entities.functions || [];

            // Собираем все функции для анализа
            for (const func of fileFunctions) {
              if (!func.name) continue;

              const calls = (func.calls || []).filter(c => c && c !== func.name);
              const calledBy = (func.calledBy || []).filter(c => c && c !== func.name);

              // Проверяем, является ли функция self (изолированной)
              const hasCalls = calls.length > 0;
              const hasCalledBy = calledBy.length > 0;

              if (!hasCalls && !hasCalledBy) {
                const selfId = idManager.generateSelfId(
                  func.name,
                  filePath,
                  func.line || 0
                );

                selfFunctions.push({
                  id: selfId,
                  name: func.name,
                  file: path.relative(process.cwd(), filePath),
                  line: func.line || 0,
                  isExported: func.isExported || false,
                  isAsync: func.isAsync || false,
                  params: func.params || [],
                });
              }

              // Собираем все функции для статистики
              allFunctions.push({
                name: func.name,
                file: path.relative(process.cwd(), filePath),
                line: func.line || 0,
                calls,
                calledBy,
                isExported: func.isExported || false,
                isAsync: func.isAsync || false,
                params: func.params || [],
              });
            }
          } catch (error) {
            if (options.verbose) {
              console.warn(`\n   ⚠️ Error processing ${filePath}:`, error);
            }
          }
        }

        if (options.verbose) {
          console.log('\n');
        }

        // Статистика
        const totalFunctions = allFunctions.length;
        const selfCount = selfFunctions.length;
        const exportedSelf = selfFunctions.filter(f => f.isExported).length;
        const asyncSelf = selfFunctions.filter(f => f.isAsync).length;

        // Формируем результат
        const result = {
          version: '5.1.0',
          timestamp: new Date().toISOString(),
          stats: {
            totalFunctions,
            selfFunctions: selfCount,
            exportedSelf,
            asyncSelf,
            percentSelf: totalFunctions > 0 ? ((selfCount / totalFunctions) * 100).toFixed(1) : '0',
          },
          selfFunctions,
          allFunctions: options.withCalls ? allFunctions : undefined,
        };

        // Сохраняем результат
        const outputPath = path.resolve(options.output);
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        let content: string;
        switch (options.format) {
          case 'markdown':
            content = this.generateSelfMarkdown(result);
            break;
          case 'text':
            content = this.generateSelfText(result);
            break;
          case 'json':
          default:
            content = JSON.stringify(result, null, 2);
        }

        fs.writeFileSync(outputPath, content);
        console.log(`\n✅ Self functions report saved: ${outputPath}`);
        console.log(`\n📊 STATISTICS:`);
        console.log(`   • Total functions: ${totalFunctions}`);
        console.log(`   • Self functions: ${selfCount} (${result.stats.percentSelf}%)`);
        console.log(`   • Exported self: ${exportedSelf}`);
        console.log(`   • Async self: ${asyncSelf}`);

        if (selfCount > 0 && options.verbose) {
          console.log('\n📋 Top self functions:');
          for (const sf of selfFunctions.slice(0, 10)) {
            console.log(`   • ${sf.name} (${sf.file}:${sf.line})`);
          }
          if (selfCount > 10) {
            console.log(`   ... and ${selfCount - 10} more`);
          }
        }

        if (selfCount === 0) {
          console.log('\n💡 No self functions found. Try:');
          console.log('   • Check if your code has isolated helper functions');
          console.log('   • Look for utility functions without dependencies');
        }
      });
  }

  // ============================================
  // ✅ НОВАЯ КОМАНДА: ANALYZE-EXTENDED — расширенный анализ
  // ============================================

  private registerAnalyzeExtendedCommand(): void {
    this.program
      .command('analyze-extended <paths...>')
      .description('🔬 Extended analysis: dynamic imports, configs, external libs, Vue templates, async chains, closures, type deps')
      .option('-o, --output <file>', 'Output file', 'extended-analysis.json')
      .option('-r, --recursive', 'Search recursively', true)
      .option('--no-dynamic', 'Disable dynamic imports analysis')
      .option('--no-config', 'Disable config references analysis')
      .option('--no-libs', 'Disable external libraries analysis')
      .option('--no-vue', 'Disable Vue templates analysis')
      .option('--no-async', 'Disable async chains analysis')
      .option('--no-closures', 'Disable closures analysis')
      .option('--no-types', 'Disable type dependencies analysis')
      .option('--format <format>', 'Output format (json, markdown)', 'json')
      .option('-v, --verbose', 'Verbose output')
      .action(async (paths: string[], options: any) => {
        console.log('🔬 Running extended analysis...');
        console.log(`📁 Paths: ${paths.join(', ')}`);
        console.log(`📄 Output: ${options.output}`);
        console.log(`📋 Format: ${options.format}`);

        const { glob } = await import('glob');

        const allFiles: string[] = [];
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];

        for (const inputPath of paths) {
          const resolvedPath = path.resolve(inputPath);
          if (!fs.existsSync(resolvedPath)) continue;

          const stat = fs.statSync(resolvedPath);
          if (stat.isFile()) {
            if (extensions.includes(path.extname(resolvedPath))) {
              allFiles.push(resolvedPath);
            }
          } else if (stat.isDirectory()) {
            const pattern = options.recursive
              ? `${resolvedPath}/**/*{${extensions.join(',')}}`
              : `${resolvedPath}/*{${extensions.join(',')}}`;

            const matched = await glob(pattern, {
              nodir: true,
              ignore: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/coverage/**',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.spec.ts',
              ],
              absolute: true,
            });
            allFiles.push(...matched);
          }
        }

        const uniqueFiles = [...new Set(allFiles)];
        console.log(`📊 Found ${uniqueFiles.length} files to analyze\n`);

        // Результаты анализа
        const results: any = {
          version: '5.1.0',
          timestamp: new Date().toISOString(),
          files: uniqueFiles.length,
          analysis: {
            dynamicImports: [] as any[],
            configRefs: [] as any[],
            externalLibs: [] as any[],
            vueTemplates: [] as any[],
            asyncChains: [] as any[],
            closures: [] as any[],
            typeDeps: [] as any[],
          },
          stats: {
            dynamicImports: 0,
            configRefs: 0,
            externalLibs: 0,
            vueTemplates: 0,
            asyncChains: 0,
            closures: 0,
            typeDeps: 0,
          },
        };

        let processed = 0;
        for (const filePath of uniqueFiles) {
          processed++;
          if (options.verbose) {
            process.stdout.write(`\r   📄 Processing: ${processed}/${uniqueFiles.length}`);
          }

          try {
            const content = fs.readFileSync(filePath, 'utf-8');

            // 1. Динамические импорты
            if (options.dynamic !== false) {
              const imports = this.extractDynamicImports(content);
              if (imports.length > 0) {
                results.analysis.dynamicImports.push({
                  file: path.relative(process.cwd(), filePath),
                  imports,
                });
                results.stats.dynamicImports += imports.length;
              }
            }

            // 2. Конфигурации
            if (options.config !== false) {
              const configs = this.extractConfigRefs(content);
              if (configs.length > 0) {
                results.analysis.configRefs.push({
                  file: path.relative(process.cwd(), filePath),
                  configs,
                });
                results.stats.configRefs += configs.length;
              }
            }

            // 3. Внешние библиотеки
            if (options.libs !== false) {
              const libs = this.extractExternalLibs(content);
              if (libs.length > 0) {
                results.analysis.externalLibs.push({
                  file: path.relative(process.cwd(), filePath),
                  libs,
                });
                results.stats.externalLibs += libs.length;
              }
            }

            // 4. Vue шаблоны
            if (options.vue !== false) {
              const templates = this.extractVueTemplates(content);
              if (templates.length > 0) {
                results.analysis.vueTemplates.push({
                  file: path.relative(process.cwd(), filePath),
                  templates,
                });
                results.stats.vueTemplates += templates.length;
              }
            }

            // 5. Асинхронные цепочки
            if (options.async !== false) {
              const chains = this.extractAsyncChains(content);
              if (chains.length > 0) {
                results.analysis.asyncChains.push({
                  file: path.relative(process.cwd(), filePath),
                  chains,
                });
                results.stats.asyncChains += chains.length;
              }
            }

            // 6. Замыкания
            if (options.closures !== false) {
              const closures = this.extractClosures(content);
              if (closures.length > 0) {
                results.analysis.closures.push({
                  file: path.relative(process.cwd(), filePath),
                  closures,
                });
                results.stats.closures += closures.length;
              }
            }

            // 7. Типовые зависимости
            if (options.types !== false) {
              const types = this.extractTypeDeps(content);
              if (types.length > 0) {
                results.analysis.typeDeps.push({
                  file: path.relative(process.cwd(), filePath),
                  types,
                });
                results.stats.typeDeps += types.length;
              }
            }
          } catch (error) {
            if (options.verbose) {
              console.warn(`\n   ⚠️ Error processing ${filePath}:`, error);
            }
          }
        }

        if (options.verbose) {
          console.log('\n');
        }

        // Сохраняем результат
        const outputPath = path.resolve(options.output);
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        let content: string;
        if (options.format === 'markdown') {
          content = this.generateExtendedMarkdown(results);
        } else {
          content = JSON.stringify(results, null, 2);
        }

        fs.writeFileSync(outputPath, content);
        console.log(`\n✅ Extended analysis saved: ${outputPath}`);
        console.log(`\n📊 STATISTICS:`);
        console.log(`   • Dynamic imports: ${results.stats.dynamicImports}`);
        console.log(`   • Config refs: ${results.stats.configRefs}`);
        console.log(`   • External libs: ${results.stats.externalLibs}`);
        console.log(`   • Vue templates: ${results.stats.vueTemplates}`);
        console.log(`   • Async chains: ${results.stats.asyncChains}`);
        console.log(`   • Closures: ${results.stats.closures}`);
        console.log(`   • Type deps: ${results.stats.typeDeps}`);
      });
  }

  // ============================================
  // ✅ НОВАЯ КОМАНДА: CACHE — управление кэшем
  // ============================================

  private registerCacheCommand(): void {
    this.program
      .command('cache')
      .description('📦 Manage analysis cache')
      .option('--clear', 'Clear all cache')
      .option('--stats', 'Show cache statistics')
      .option('--ttl <ms>', 'Set cache TTL in milliseconds', '300000')
      .action(async (options) => {
        console.log('📦 Cache Management');
        console.log('='.repeat(40));

        // Импортируем кэш из json-reporter
        let analysisCache: any = null;
        try {
          const module = await import('../reporters/json-reporter.js');
          analysisCache = (module as any).analysisCache;
        } catch {
          console.log('⚠️ Cache module not loaded');
        }

        if (options.clear) {
          if (analysisCache && typeof analysisCache.clear === 'function') {
            analysisCache.clear();
            console.log('✅ Cache cleared');
          } else {
            console.log('ℹ️ Cache is empty or not available');
          }
          return;
        }

        if (options.stats) {
          if (analysisCache && typeof analysisCache.getStats === 'function') {
            const stats = analysisCache.getStats();
            console.log(`\n📊 Cache Statistics:`);
            console.log(`   • Entries: ${stats.size || 0}`);
            console.log(`   • TTL: ${options.ttl}ms`);
            console.log(`   • Memory: ${stats.memory || 'N/A'}`);
          } else {
            console.log('ℹ️ Cache statistics not available');
          }
          return;
        }

        // Показываем справку
        console.log('\n📖 Cache Commands:');
        console.log('   • npx ast-analyzer cache --stats    - Show cache stats');
        console.log('   • npx ast-analyzer cache --clear    - Clear cache');
        console.log('   • npx ast-analyzer cache --ttl 600000 - Set TTL to 10 minutes');
        console.log('\n💡 Cache stores analysis results for 5 minutes by default');
      });
  }

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ НОВЫХ КОМАНД
  // ============================================

  private extractDynamicImports(content: string): any[] {
    const imports: any[] = [];
    const regex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const pathMatch = match[1];
      imports.push({
        path: pathMatch || '',
        line: content.substring(0, match.index).split('\n').length + 1,
        type: pathMatch && pathMatch.includes('${') ? 'template' : 'literal',
      });
    }
    return imports;
  }

  private extractConfigRefs(content: string): any[] {
    const configs: any[] = [];
    const patterns = [
      /process\.env\.(\w+)/g,
      /require\s*\(\s*['"](.*\.config\.(js|ts))['"]\s*\)/g,
      /import\s+.*\s+from\s+['"](.*\.config\.(js|ts))['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1] || match[2] || '';
        configs.push({
          name: name,
          line: content.substring(0, match.index).split('\n').length + 1,
          type: pattern === patterns[0] ? 'env' : 'config',
        });
      }
    }
    return configs;
  }

  private extractExternalLibs(content: string): any[] {
    const libs: any[] = [];
    const regex = /import\s+.*\s+from\s+['"]([^.'"][^'"]*)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const libName = match[1];
      if (libName && !libName.startsWith('.') && !libName.startsWith('/')) {
        const existing = libs.find(l => l.name === libName);
        if (existing) {
          existing.count++;
        } else {
          libs.push({ name: libName, count: 1 });
        }
      }
    }
    return libs;
  }

  private extractVueTemplates(content: string): any[] {
    const templates: any[] = [];
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      const template = templateMatch[1] || '';
      const componentRegex = /<([A-Z][a-zA-Z]*)/g;
      let match;
      while ((match = componentRegex.exec(template)) !== null) {
        templates.push({
          name: match[1] || '',
          line: template ? template.substring(0, match.index).split('\n').length + 1 : 0,
        });
      }
    }
    return templates;
  }

  private extractAsyncChains(content: string): any[] {
    const chains: any[] = [];
    const asyncRegex = /async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\s*\(/g;
    let match;
    while ((match = asyncRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || '';
      if (name) {
        const start = match.index;
        const end = content.indexOf('}', start);
        const body = content.substring(start, end);
        const awaitCount = (body.match(/await/g) || []).length;
        chains.push({
          name,
          awaitCount,
          line: content.substring(0, match.index).split('\n').length + 1,
        });
      }
    }
    return chains;
  }

  private extractClosures(content: string): any[] {
    const closures: any[] = [];
    const funcRegex = /function\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const body = match[1] || '';
      const varRegex = /\b(\w+)\b/g;
      let varMatch;
      const declared = new Set<string>();
      const used = new Set<string>();

      const declRegex = /(?:var|let|const)\s+(\w+)/g;
      let declMatch;
      while ((declMatch = declRegex.exec(body)) !== null) {
        declared.add(declMatch[1] || '');
      }

      while ((varMatch = varRegex.exec(body)) !== null) {
        const name = varMatch[1] || '';
        if (!declared.has(name) && !['function', 'return', 'if', 'for', 'while'].includes(name)) {
          used.add(name);
        }
      }

      if (used.size > 0) {
        closures.push({
          line: content.substring(0, match.index).split('\n').length + 1,
          variables: Array.from(used),
        });
      }
    }
    return closures;
  }

  private extractTypeDeps(content: string): any[] {
    const deps: any[] = [];

    // Интерфейсы
    const interfaceRegex = /interface\s+(\w+)\s*(?:extends\s+([^{]+))?/g;
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      deps.push({
        name: match[1] || '',
        type: 'interface',
        extends: match[2] ? match[2].split(',').map((e: string) => e.trim()) : [],
      });
    }

    // Type aliases
    const typeRegex = /type\s+(\w+)\s*=\s*([^;]+)/g;
    while ((match = typeRegex.exec(content)) !== null) {
      deps.push({
        name: match[1] || '',
        type: 'type-alias',
        definition: (match[2] || '').trim(),
      });
    }

    // Generics
    const genericRegex = /<(\w+)(?:\s+extends\s+(\w+))?>/g;
    while ((match = genericRegex.exec(content)) !== null) {
      deps.push({
        name: match[1] || '',
        type: 'generic',
        extends: match[2] || null,
      });
    }

    return deps;
  }

  private generateSelfMarkdown(result: any): string {
    let md = '# 🔍 Self Functions Report\n\n';
    md += `**Generated:** ${new Date(result.timestamp).toLocaleString()}\n`;
    md += `**Version:** ${result.version}\n\n`;

    md += '## 📊 Statistics\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    md += `| Total functions | ${result.stats.totalFunctions} |\n`;
    md += `| Self functions | ${result.stats.selfFunctions} |\n`;
    md += `| Percentage | ${result.stats.percentSelf}% |\n`;
    md += `| Exported self | ${result.stats.exportedSelf} |\n`;
    md += `| Async self | ${result.stats.asyncSelf} |\n\n`;

    if (result.selfFunctions.length > 0) {
      md += '## 📋 Self Functions\n\n';
      md += '| ID | Name | File | Line | Exported | Async |\n';
      md += '|----|------|------|------|----------|-------|\n';
      for (const sf of result.selfFunctions) {
        md += `| ${sf.id} | ${sf.name} | ${sf.file} | ${sf.line} | ${sf.isExported ? '✅' : '❌'} | ${sf.isAsync ? '✅' : '❌'} |\n`;
      }
      md += '\n';
    }

    return md;
  }

  private generateSelfText(result: any): string {
    let text = '🔍 SELF FUNCTIONS REPORT\n';
    text += '='.repeat(50) + '\n\n';
    text += `Total functions: ${result.stats.totalFunctions}\n`;
    text += `Self functions: ${result.stats.selfFunctions} (${result.stats.percentSelf}%)\n`;
    text += `Exported self: ${result.stats.exportedSelf}\n`;
    text += `Async self: ${result.stats.asyncSelf}\n\n`;

    if (result.selfFunctions.length > 0) {
      text += 'SELF FUNCTIONS:\n';
      text += '-'.repeat(40) + '\n';
      for (const sf of result.selfFunctions) {
        text += `  ${sf.id}: ${sf.name} (${sf.file}:${sf.line})\n`;
      }
    }

    return text;
  }

  private generateExtendedMarkdown(results: any): string {
    let md = '# 🔬 Extended Analysis Report\n\n';
    md += `**Generated:** ${new Date(results.timestamp).toLocaleString()}\n`;
    md += `**Files analyzed:** ${results.files}\n\n`;

    md += '## 📊 Statistics\n\n';
    md += '| Category | Count |\n';
    md += '|----------|-------|\n';
    md += `| Dynamic imports | ${results.stats.dynamicImports} |\n`;
    md += `| Config refs | ${results.stats.configRefs} |\n`;
    md += `| External libs | ${results.stats.externalLibs} |\n`;
    md += `| Vue templates | ${results.stats.vueTemplates} |\n`;
    md += `| Async chains | ${results.stats.asyncChains} |\n`;
    md += `| Closures | ${results.stats.closures} |\n`;
    md += `| Type deps | ${results.stats.typeDeps} |\n\n`;

    // Dynamic imports
    if (results.analysis.dynamicImports.length > 0) {
      md += '## 🔗 Dynamic Imports\n\n';
      for (const item of results.analysis.dynamicImports) {
        md += `### ${item.file}\n\n`;
        for (const imp of item.imports) {
          md += `- ${imp.path} (line ${imp.line})\n`;
        }
        md += '\n';
      }
    }

    // External libs
    if (results.analysis.externalLibs.length > 0) {
      md += '## 📦 External Libraries\n\n';
      const allLibs: Record<string, number> = {};
      for (const item of results.analysis.externalLibs) {
        for (const lib of item.libs) {
          allLibs[lib.name] = (allLibs[lib.name] || 0) + lib.count;
        }
      }
      const sorted = Object.entries(allLibs).sort((a, b) => b[1] - a[1]);
      md += '| Library | Usage count |\n';
      md += '|---------|-------------|\n';
      for (const [name, count] of sorted.slice(0, 20)) {
        md += `| ${name} | ${count} |\n`;
      }
      md += '\n';
    }

    return md;
  }

  // ============================================
  // RUN
  // ============================================

  /**
   * Запускает CLI
   */
  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ CLI error:', error.message);
      } else {
        console.error('❌ CLI error:', error);
      }
      process.exit(1);
    }
  }

  /**
   * Показывает справку
   */
  showHelp(): void {
    this.program.help();
  }

  /**
   * Получает экземпляр Program для тестирования
   */
  getProgram(): Command {
    return this.program;
  }
}

// Экспорт по умолчанию
export default CLIExecutor;
