// src/refactor/index.ts
import { Node } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { Project, ScriptTarget, ModuleKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModuleExtractor } from './ModuleExtractor.js';
import { TypeScriptValidator } from './TypeScriptValidator.js';
import { ESLintASTFixer } from './ESLintASTFixer.js';
import type { ValidationResult } from './CodeValidator.js';
import { CodeValidator } from './CodeValidator.js';
import type { FixResult } from './CodeFixer.js';
import { CodeFixer } from './CodeFixer.js';
import { ImportManager } from './ImportManager.js';
import { TemplateUpdater } from './TemplateUpdater.js';

// Семантические модули
import type { ControlFlowGraph } from '../semantic/CFGAnalyzer.js';
import { CFGAnalyzer } from '../semantic/CFGAnalyzer.js';
import type { CallGraph } from '../semantic/CallGraphAnalyzer.js';
import { CallGraphAnalyzer } from '../semantic/CallGraphAnalyzer.js';
import type { TypeAnalysisResult, TypeError } from '../semantic/TypeAnalyzer.js';
import { TypeAnalyzer } from '../semantic/TypeAnalyzer.js';
import type { DataFlowGraph } from '../semantic/DataFlowAnalyzer.js';
import { DataFlowAnalyzer } from '../semantic/DataFlowAnalyzer.js';
import type { FunctionContract, VerificationResult } from '../formal/Z3Verifier.js';
import { Z3Verifier, range } from '../formal/Z3Verifier.js';

// ✅ Импорты для Tree-sitter WASM
import { initTreeSitter } from '@codeflow-map/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RefactorOptions {
  modulesDir?: string;
  targetClusterSize?: number;
  maxClusterSize?: number;
  minCohesionScore?: number;
  dryRun?: boolean;
  createBackup?: boolean;
  updateTemplate?: boolean;
  verbose?: boolean;

  // Семантический анализ (ВСЕ ВКЛЮЧЕНЫ ПО УМОЛЧАНИЮ)
  semanticAnalysis?: boolean;
  formalVerification?: boolean;
  dataFlowAnalysis?: boolean;
  callGraphAnalysis?: boolean;
  jsxAnalysis?: boolean;
  vueAnalysis?: boolean;
  criticalFunctions?: string[];
  maxCallDepth?: number;

  // Валидация и исправление (ВСЕ ВКЛЮЧЕНЫ ПО УМОЛЧАНИЮ)
  eslintCheck?: boolean;
  eslintFix?: boolean;
  typeCheck?: boolean;
  codeValidation?: boolean;
  autoFix?: boolean;
  maxIterations?: number;

  // Импорты (ВСЕ ВКЛЮЧЕНЫ ПО УМОЛЧАНИЮ)
  fixUnusedImports?: boolean;
  fixUnusedVariables?: boolean;
  addMissingTypes?: boolean;
  optimizeImports?: boolean;

  // Кластеризация
  minClusterSize?: number;
  extractIsolatedFunctions?: boolean;
  groupByCallGraph?: boolean;
}

export interface ExtractedModule {
  name: string;
  path: string;
  exports: string[];
  dependencies: string[];
  originalNodes: any[];
}

export interface RefactorResult {
  success: boolean;
  modules: ExtractedModule[];
  backupPath?: string;
  error?: string;

  semanticResults?: {
    cfg?: ControlFlowGraph;
    callGraph?: CallGraph;
    typeAnalysis?: TypeAnalysisResult;
    dataFlow?: DataFlowGraph;
    typeErrors?: TypeError[];
    unusedFunctions?: string[];
    cyclicDependencies?: string[][];
    unreachableCode?: { file: string; line: number }[];
    jsx?: any;
    vue?: any;
  };

  verificationResults?: VerificationResult[];
  validationResults?: ValidationResult;
  eslintResults?: ESLintFixResult[];
  tsFixResults?: { fixedCount: number; remainingErrors: number };
  codeFixResults?: FixResult[];

  metrics?: {
    cyclomaticComplexity: number;
    totalFunctions: number;
    unusedFunctionsCount: number;
    typeErrorsCount: number;
    verifiedFunctionsCount: number;
    dataFlowIssuesCount: number;
    eslintFixesCount: number;
    tsFixesCount: number;
    codeFixesCount: number;
  };
}

export interface ESLintFixResult {
  success: boolean;
  file: string;
  fixes: number;
  errors: string[];
}

export class AutoRefactor {
  private project: Project;
  private extractor: ModuleExtractor;
  private importManager: ImportManager;
  private options: RefactorOptions;

  private cfgAnalyzer: CFGAnalyzer;
  private callGraphAnalyzer: CallGraphAnalyzer;
  private dataFlowAnalyzer: DataFlowAnalyzer;
  private z3Verifier: Z3Verifier;

  private tsValidator: TypeScriptValidator;
  private eslintFixer: ESLintASTFixer;
  private codeValidator: CodeValidator;
  private codeFixer: CodeFixer;
  private templateUpdater: TemplateUpdater;

  // ✅ WASM путь для Tree-sitter
  private wasmPath: string;
  private treeSitterInitialized = false;

  constructor(options: RefactorOptions = {}) {
    this.options = {
      modulesDir: 'modules',
      targetClusterSize: 3,
      maxClusterSize: 10,
      minCohesionScore: 60,
      dryRun: false,
      createBackup: true,
      updateTemplate: true,
      verbose: false,

      semanticAnalysis: true,
      formalVerification: true,
      dataFlowAnalysis: true,
      callGraphAnalysis: true,
      jsxAnalysis: true,
      vueAnalysis: true,
      maxCallDepth: 10,

      eslintCheck: true,
      eslintFix: true,
      typeCheck: true,
      codeValidation: true,
      autoFix: true,
      maxIterations: 5,

      fixUnusedImports: true,
      fixUnusedVariables: true,
      addMissingTypes: true,
      optimizeImports: true,

      minClusterSize: 2,
      extractIsolatedFunctions: true,
      groupByCallGraph: true,

      ...options,
    };

    this.project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2020,
        module: ModuleKind.ESNext,
        allowJs: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: false,
    });

    this.cfgAnalyzer = new CFGAnalyzer();
    // ✅ Создаём CallGraphAnalyzer без пути, потом обновим
    this.callGraphAnalyzer = new CallGraphAnalyzer();
    this.dataFlowAnalyzer = new DataFlowAnalyzer();
    this.z3Verifier = new Z3Verifier();

    this.extractor = new ModuleExtractor(this.project, this.options);
    this.importManager = new ImportManager(this.project);

    // ✅ Создаём временный tsconfig для анализа
    const tsConfigPath = this.ensureTsConfig();
    this.tsValidator = new TypeScriptValidator(tsConfigPath);

    this.eslintFixer = new ESLintASTFixer();
    this.codeValidator = new CodeValidator();
    this.codeFixer = new CodeFixer();
    this.templateUpdater = new TemplateUpdater(this.options);

    // ✅ Определяем путь к WASM файлам
    let foundPath = '';

    const possiblePaths = [
      path.resolve(__dirname, 'wasm'),
      path.resolve(process.cwd(), 'dist/wasm'),
      path.resolve(process.cwd(), 'grammars'),
      path.resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const files = fs.readdirSync(p);
        const hasWasm = files.some((f: string) => f.endsWith('.wasm'));
        if (hasWasm) {
          foundPath = p;
          break;
        }
      }
    }

    if (!foundPath) {
      const targetWasmDir = path.resolve(__dirname, 'wasm');
      const sourceGrammars = path.resolve(
        process.cwd(),
        '../../Directory/callsight-vscode/grammars'
      );

      if (fs.existsSync(sourceGrammars) && !fs.existsSync(targetWasmDir)) {
        this.log(`📋 Копирование WASM файлов из ${sourceGrammars} в ${targetWasmDir}`);
        try {
          fs.mkdirSync(targetWasmDir, { recursive: true });
          const files = fs.readdirSync(sourceGrammars);
          for (const file of files) {
            if (file.endsWith('.wasm')) {
              fs.copyFileSync(path.join(sourceGrammars, file), path.join(targetWasmDir, file));
            }
          }
          foundPath = targetWasmDir;
          this.log(`✅ WASM файлы скопированы в ${foundPath}`);
        } catch (error) {
          this.log(`⚠️ Не удалось скопировать WASM файлы: ${error}`);
        }
      }
    }

    this.wasmPath = foundPath || path.resolve(__dirname, 'wasm');
    this.log(`📍 WASM directory: ${this.wasmPath}`);

    // ✅ Обновляем CallGraphAnalyzer с правильным путём
    if (this.wasmPath && fs.existsSync(this.wasmPath)) {
      this.callGraphAnalyzer.setWasmPath(this.wasmPath);
      const wasmFiles = fs.readdirSync(this.wasmPath).filter((f: string) => f.endsWith('.wasm'));
      this.log(`📦 Найдено WASM файлов: ${wasmFiles.length}`);
      if (wasmFiles.length > 0) {
        this.log(
          `   Пример: ${wasmFiles.slice(0, 3).join(', ')}${wasmFiles.length > 3 ? '...' : ''}`
        );
      }
    } else {
      this.log(`⚠️ Директория WASM не найдена: ${this.wasmPath}`);
      this.log('   Call Graph анализ будет недоступен');
    }
  }

  /**
   * ✅ Создаёт временный tsconfig.json для анализа JS файлов
   */
  private ensureTsConfig(): string | undefined {
    const tsConfigPath = path.resolve(process.cwd(), 'tsconfig.analyzer.json');

    if (fs.existsSync(tsConfigPath)) {
      return tsConfigPath;
    }

    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'node',
        allowJs: true,
        checkJs: true,
        jsx: 'preserve',
        strict: false,
        noImplicitAny: false,
        strictNullChecks: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        isolatedModules: false,
        noEmit: true,
        types: ['node'],
        typeRoots: [
          path.resolve(process.cwd(), 'node_modules/@types'),
          path.resolve(process.cwd(), 'node_modules/@types/node'),
        ],
      },
      include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      exclude: ['node_modules', 'dist', 'build', 'coverage'],
    };

    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    this.log(`📄 Создан tsconfig для анализа: ${tsConfigPath}`);

    return tsConfigPath;
  }

  async refactor(filePath: string): Promise<RefactorResult> {
    const absolutePath = path.resolve(filePath);

    this.logHeader('АВТОМАТИЧЕСКИЙ РЕФАКТОРИНГ С ПОЛНЫМ PIPELINE');
    this.log(`📄 Целевой файл: ${absolutePath}`);
    this.log(`📁 Выходная директория: ${this.options.modulesDir}`);
    this.log(
      `🎯 Параметры: размер кластера=${this.options.targetClusterSize}, связность=${this.options.minCohesionScore}%`
    );

    this.logSemanticStatus();

    if (this.options.callGraphAnalysis) {
      if (this.treeSitterInitialized) {
        this.log('🕸️ Call Graph анализ: ВКЛЮЧЕН (Tree-sitter готов)');
      } else {
        this.log(
          '⚠️ Call Graph анализ: Tree-sitter не инициализирован, анализ может быть неполным'
        );
      }
    }

    if (this.options.dryRun) {
      this.log('⚠️ РЕЖИМ DRY RUN: изменения не будут применены к файлам\n');
    }

    if (!fs.existsSync(absolutePath)) {
      return { success: false, modules: [], error: `Файл не найден: ${absolutePath}` };
    }

    let backupPath: string | undefined;
    if (this.options.createBackup && !this.options.dryRun) {
      backupPath = await this.createBackup(absolutePath);
    }

    let semanticResults: RefactorResult['semanticResults'] = {};
    let verificationResults: VerificationResult[] = [];
    let validationResults: ValidationResult | undefined = undefined;
    let eslintResults: ESLintFixResult[] = [];
    let tsFixResults: { fixedCount: number; remainingErrors: number } = {
      fixedCount: 0,
      remainingErrors: 0,
    };
    let codeFixResults: FixResult[] = [];
    let metrics: RefactorResult['metrics'] = {
      cyclomaticComplexity: 0,
      totalFunctions: 0,
      unusedFunctionsCount: 0,
      typeErrorsCount: 0,
      verifiedFunctionsCount: 0,
      dataFlowIssuesCount: 0,
      eslintFixesCount: 0,
      tsFixesCount: 0,
      codeFixesCount: 0,
    };

    try {
      const sourceFile = this.project.addSourceFileAtPath(absolutePath);

      if (this.options.semanticAnalysis) {
        this.logSection('СЕМАНТИЧЕСКИЙ АНАЛИЗ');
        semanticResults = await this.runSemanticAnalysis(sourceFile, absolutePath);

        if (semanticResults) {
          if (
            this.options.jsxAnalysis &&
            (absolutePath.endsWith('.tsx') || absolutePath.endsWith('.jsx'))
          ) {
            this.log('  ⚛️ Анализ JSX/TSX...');
            const { JSXAnalyzer } = await import('../semantic/JSXAnalyzer.js');
            const jsxAnalyzer = new JSXAnalyzer(absolutePath);
            const jsxResult = jsxAnalyzer.analyze(sourceFile);
            semanticResults.jsx = jsxResult;

            if (jsxResult.elements.length > 0) {
              this.log(`     ⚛️ Найдено JSX элементов: ${jsxResult.elements.length}`);
              this.log(`     🧩 Компонентов: ${jsxResult.componentProps.size}`);
            }
          }

          if (this.options.vueAnalysis && absolutePath.endsWith('.vue')) {
            this.log('  🎯 Анализ Vue компонента...');
            const { analyzeVueComponent } = await import('../modes/vue-analyzer.js');
            const vueAnalysis = analyzeVueComponent(absolutePath);
            semanticResults.vue = vueAnalysis;

            if (vueAnalysis) {
              this.log(`     📥 Props: ${vueAnalysis.props.names.length}`);
              this.log(`     📤 Events: ${vueAnalysis.emits.names.length}`);
              this.log(`     🎭 Slots: ${vueAnalysis.slots.length}`);
              this.log(`     🧩 Composables: ${vueAnalysis.composables.length}`);
            }
          }
        }
      }

      if (this.options.formalVerification) {
        this.logSection('ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ (Z3)');
        verificationResults = await this.runFormalVerification(sourceFile);
      }

      if (this.options.codeValidation) {
        this.logSection('CODE VALIDATION');
        validationResults = await this.runCodeValidation([absolutePath]);
      }

      if (this.options.eslintCheck) {
        this.logSection('ESLint АНАЛИЗ И ИСПРАВЛЕНИЕ');
        eslintResults = await this.runESLintFix([absolutePath]);
      }

      if (this.options.typeCheck) {
        this.logSection('TYPESCRIPT ВАЛИДАЦИЯ И ИСПРАВЛЕНИЕ');
        tsFixResults = await this.runTypeScriptFix([absolutePath]);
      }

      if (this.options.autoFix && validationResults) {
        this.logSection('АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ КОДА');
        codeFixResults = await this.runCodeFix(validationResults);
      }

      this.logSection('АНАЛИЗ СТРУКТУРЫ ФАЙЛА');
      const analysis = await this.analyzeFile(sourceFile);
      if (!analysis) {
        return this.createErrorResult('Не удалось проанализировать файл', backupPath, {
          semanticResults,
          verificationResults,
          validationResults,
          eslintResults,
          tsFixResults,
          codeFixResults,
          metrics,
        });
      }

      this.logSection('КЛАСТЕРИЗАЦИЯ ФУНКЦИЙ');
      const clusters = this.identifyClusters(analysis);

      const filteredClusters = clusters.filter(
        c => c.functions.length >= (this.options.minClusterSize || 2)
      );

      let finalClusters = filteredClusters;
      if (this.options.extractIsolatedFunctions) {
        const isolated = this.findIsolatedFunctions(analysis, filteredClusters);
        finalClusters = [...filteredClusters, ...isolated];
      }

      if (finalClusters.length === 0) {
        this.log('ℹ️ Не найдено кандидатов для выделения в модули');
        return this.createSuccessResult([], backupPath, {
          semanticResults,
          verificationResults,
          validationResults,
          eslintResults,
          tsFixResults,
          codeFixResults,
          metrics,
        });
      }

      this.logClusters(finalClusters);

      if (this.options.dryRun) {
        this.log('⚠️ DRY RUN: Изменения не будут применены');
        return this.createSuccessResult([], backupPath, {
          semanticResults,
          verificationResults,
          validationResults,
          eslintResults,
          tsFixResults,
          codeFixResults,
          metrics,
        });
      }

      this.logSection('ИЗВЛЕЧЕНИЕ МОДУЛЕЙ');
      const modules = await this.extractor.extractModules(absolutePath, finalClusters);

      this.logSection('ОБНОВЛЕНИЕ ИМПОРТОВ');
      await this.updateImports(sourceFile, modules);

      if (this.options.optimizeImports) {
        this.logSection('ОПТИМИЗАЦИЯ ИМПОРТОВ');
        await this.optimizeImportOrder(sourceFile);
      }

      if (this.options.updateTemplate && absolutePath.endsWith('.vue')) {
        this.logSection('ОБНОВЛЕНИЕ VUE ШАБЛОНА');
        await this.templateUpdater.update(absolutePath, modules);
      }

      this.logSection('ФИНАЛЬНАЯ ВАЛИДАЦИЯ');
      await this.project.save();

      const finalValidation = await this.runCodeValidation([absolutePath]);
      const finalESLint = await this.runESLintFix([absolutePath]);
      const finalTS = await this.runTypeScriptFix([absolutePath]);

      metrics = this.collectMetrics({
        semanticResults,
        verificationResults,
        validationResults: finalValidation,
        eslintResults: finalESLint,
        tsFixResults: finalTS,
        codeFixResults,
        clusters: finalClusters,
      });

      this.logMetrics(metrics);
      this.logSuccess(modules, backupPath);

      return this.createSuccessResult(modules, backupPath, {
        semanticResults,
        verificationResults,
        validationResults: finalValidation,
        eslintResults: finalESLint,
        tsFixResults: finalTS,
        codeFixResults,
        metrics,
      });
    } catch (error) {
      this.logError(error);

      if (backupPath && !this.options.dryRun) {
        await this.restoreBackup(absolutePath, backupPath);
      }

      return this.createErrorResult(
        error instanceof Error ? error.message : String(error),
        backupPath,
        {
          semanticResults,
          verificationResults,
          validationResults,
          eslintResults,
          tsFixResults,
          codeFixResults,
          metrics,
        }
      );
    }
  }

  private async runSemanticAnalysis(
    sourceFile: SourceFile,
    filePath: string
  ): Promise<RefactorResult['semanticResults']> {
    const results: RefactorResult['semanticResults'] = {};
    const fileInfo = {
      name: path.basename(filePath),
      path: filePath,
      size: fs.statSync(filePath).size,
      lines: sourceFile.getFullText().split('\n').length,
    };

    this.log('\n  📄 ИНФОРМАЦИЯ О ФАЙЛЕ:');
    this.log(`     Имя: ${fileInfo.name}`);
    this.log(`     Размер: ${(fileInfo.size / 1024).toFixed(2)} KB`);
    this.log(`     Строк: ${fileInfo.lines}`);
    this.log(
      `     Тип: ${filePath.endsWith('.ts') ? 'TypeScript' : filePath.endsWith('.vue') ? 'Vue' : 'JavaScript'}`
    );

    // 1. CFG Анализ
    this.log('\n  🔀 1. CONTROL FLOW GRAPH (CFG) АНАЛИЗ');
    this.log('     ─────────────────────────────────────');
    const cfgStart = Date.now();
    try {
      const cfg = this.cfgAnalyzer.build(sourceFile);
      results.cfg = cfg;

      const unreachable = cfg.findUnreachableBlocks();
      const loops = cfg.findLoops();

      this.log(`     ✅ Анализ завершен за ${Date.now() - cfgStart}ms`);
      this.log('     📊 Результаты CFG:');
      this.log(`        • Базовых блоков: ${cfg.blocks.length}`);
      this.log('        • Входных точек: 1');
      this.log('        • Выходных точек: 1');
      this.log(`        • Циклов: ${loops.length}`);
      this.log(`        • Недостижимых блоков: ${unreachable.length}`);

      if (unreachable.length > 0) {
        this.log('        ⚠️ Недостижимый код найден в блоках:');
        for (const block of unreachable.slice(0, 5)) {
          const line = block.instructions[0]?.getStartLineNumber() || 1;
          this.log(`           • строка ${line}`);
        }
        results.unreachableCode = unreachable.map(block => ({
          file: sourceFile.getFilePath(),
          line: block.instructions[0]?.getStartLineNumber() || 1,
        }));
      }

      const cyclomaticComplexity = this.calculateCyclomaticComplexity(cfg);
      this.log(`        • Цикломатическая сложность: ${cyclomaticComplexity}`);

      if (cyclomaticComplexity > 10) {
        this.log('        ⚠️ Сложность выше рекомендуемой (10). Рекомендуется рефакторинг.');
      } else if (cyclomaticComplexity > 20) {
        this.log('        🔴 КРИТИЧЕСКАЯ сложность! Необходим рефакторинг.');
      }
    } catch (error) {
      this.log(`     ❌ Ошибка CFG анализа: ${error}`);
    }

    // 2. Call Graph Анализ
    this.log('\n  🕸️ 2. CALL GRAPH АНАЛИЗ');
    this.log('     ────────────────────');

    if (!this.treeSitterInitialized && this.options.callGraphAnalysis) {
      this.log('     ⚠️ Tree-sitter не инициализирован. Call Graph анализ может быть неполным.');
      this.log('     💡 Убедитесь, что WASM файлы доступны по пути: ' + this.wasmPath);
    }

    const cgStart = Date.now();
    try {
      const callGraph = await this.callGraphAnalyzer.analyzeSingle(
        filePath,
        this.options.maxCallDepth || 10
      );
      results.callGraph = callGraph;

      this.log(`     ✅ Анализ завершен за ${Date.now() - cgStart}ms`);
      this.log('     📊 Результаты Call Graph:');
      this.log(`        • Функций: ${callGraph.nodes.size}`);
      this.log(`        • Вызовов: ${callGraph.edges.length}`);
      this.log(`        • Entry points: ${callGraph.entryPoints.length}`);
      this.log(`        • Циклических зависимостей: ${callGraph.cycles.length}`);

      const unused = callGraph.findUnusedFunctions();
      if (unused.length > 0) {
        this.log(`        ⚠️ Неиспользуемых функций: ${unused.length}`);
        results.unusedFunctions = unused.map(f => f.name);
        for (const func of unused.slice(0, 10)) {
          this.log(`           • ${func.name} (строка ${func.line})`);
        }
        if (unused.length > 10) {
          this.log(`           ... и ещё ${unused.length - 10} функций`);
        }
      }

      const cycles = callGraph.findCyclicDependencies();
      if (cycles.length > 0) {
        this.log(`        🔴 ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ: ${cycles.length}`);
        results.cyclicDependencies = cycles.map(cycleEdges =>
          cycleEdges.map(edge => `${edge.from}->${edge.to}`)
        );
        for (const cycle of cycles.slice(0, 5)) {
          const cycleStr = cycle.map(e => `${e.from} → ${e.to}`).join(' → ');
          this.log(`           • ${cycleStr}`);
        }
      }
    } catch (error) {
      this.log(`     ❌ Ошибка Call Graph анализа: ${error}`);
      if (!this.treeSitterInitialized) {
        this.log('     💡 Возможная причина: Tree-sitter не инициализирован.');
      }
    }

    // 3. TypeScript Анализ (только для TS/TSX файлов)
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      this.log('\n  📝 3. TYPESCRIPT АНАЛИЗ');
      this.log('     ────────────────────');
      const tsStart = Date.now();
      try {
        const typeAnalyzer = new TypeAnalyzer(filePath);
        const typeAnalysis = typeAnalyzer.analyze();
        results.typeAnalysis = typeAnalysis;

        const typeErrors = typeAnalysis.findTypeErrors();

        this.log(`     ✅ Анализ завершен за ${Date.now() - tsStart}ms`);
        this.log('     📊 Результаты TypeScript:');
        this.log(`        • Ошибок типов: ${typeErrors.length}`);

        if (typeErrors.length > 0) {
          results.typeErrors = typeErrors;
          for (const error of typeErrors.slice(0, 10)) {
            this.log(`           • ${error.message}`);
            this.log(`             Expected: ${error.expected}, Got: ${error.actual}`);
          }
        }
      } catch (error) {
        this.log(`     ❌ Ошибка TypeScript анализа: ${error}`);
      }
    } else {
      this.log('\n  📝 3. TYPESCRIPT АНАЛИЗ');
      this.log('     ────────────────────');
      this.log('     ⏭️ Пропущен (файл не является TypeScript)');
    }

    // 4. Data Flow Анализ
    this.log('\n  🌊 4. DATA FLOW АНАЛИЗ');
    this.log('     ────────────────────');
    const dfStart = Date.now();
    try {
      const dataFlow = this.dataFlowAnalyzer.analyze(sourceFile);
      results.dataFlow = dataFlow;

      const unusedVars = dataFlow.findUnusedVariables();
      const reassignedConsts = dataFlow.findReassignedConstants();
      const stats = dataFlow.getVariableStats();

      this.log(`     ✅ Анализ завершен за ${Date.now() - dfStart}ms`);
      this.log('     📊 Результаты Data Flow:');
      this.log(`        • Всего переменных: ${stats.total}`);
      this.log(`        • Используемых: ${stats.used}`);
      this.log(`        • Неиспользуемых: ${stats.unused}`);
      this.log(`        • Констант: ${stats.constants}`);
      this.log(`        • Переопределенных констант: ${stats.reassignedConstants}`);

      if (unusedVars.length > 0) {
        this.log('        ⚠️ Неиспользуемые переменные:');
        for (const v of unusedVars.slice(0, 10)) {
          this.log(`           • ${v.name} (строка ${v.line})`);
        }
      }

      if (reassignedConsts.length > 0) {
        this.log('        🔴 Переопределенные константы:');
        for (const c of reassignedConsts) {
          this.log(`           • ${c.name} (строка ${c.line}) - используйте 'let' вместо 'const'`);
        }
      }
    } catch (error) {
      this.log(`     ❌ Ошибка Data Flow анализа: ${error}`);
    }

    // 5. JSX Анализ (для TSX/JSX файлов)
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      this.log('\n  ⚛️ 5. JSX/TSX АНАЛИЗ');
      this.log('     ──────────────────');
      const jsxStart = Date.now();
      try {
        const { JSXAnalyzer } = await import('../semantic/JSXAnalyzer.js');
        const jsxAnalyzer = new JSXAnalyzer(filePath);
        const jsxResult = jsxAnalyzer.analyze(sourceFile);
        results.jsx = jsxResult;

        this.log(`     ✅ Анализ завершен за ${Date.now() - jsxStart}ms`);
        this.log('     📊 Результаты JSX анализа:');
        this.log(`        • JSX элементов: ${jsxResult.elements.length}`);
        this.log(`        • Компонентов: ${jsxResult.componentProps.size}`);
        this.log(`        • Ошибок типов пропсов: ${jsxResult.propTypeErrors.length}`);
        this.log(`        • Проблем линтинга: ${jsxResult.jsxLintingIssues.length}`);
        this.log(`        • Отсутствующих импортов: ${jsxResult.missingImports.length}`);

        if (jsxResult.jsxLintingIssues.length > 0) {
          this.log('        ⚠️ Проблемы линтинга:');
          for (const issue of jsxResult.jsxLintingIssues.slice(0, 5)) {
            this.log(`           • [${issue.ruleId}] ${issue.message}`);
          }
        }
      } catch (error) {
        this.log(`     ❌ Ошибка JSX анализа: ${error}`);
      }
    }

    // 6. Vue Анализ (для Vue файлов)
    if (filePath.endsWith('.vue')) {
      this.log('\n  🎯 6. VUE КОМПОНЕНТ АНАЛИЗ');
      this.log('     ────────────────────────');
      const vueStart = Date.now();
      try {
        const { analyzeVueComponent } = await import('../modes/vue-analyzer.js');
        const vueAnalysis = analyzeVueComponent(filePath);
        results.vue = vueAnalysis;

        if (vueAnalysis) {
          this.log(`     ✅ Анализ завершен за ${Date.now() - vueStart}ms`);
          this.log('     📊 Результаты Vue анализа:');
          this.log(`        • Props: ${vueAnalysis.props.names.length}`);
          this.log(`        • Events: ${vueAnalysis.emits.names.length}`);
          this.log(`        • Slots: ${vueAnalysis.slots.length}`);
          this.log(`        • Composables: ${vueAnalysis.composables.length}`);
          this.log(`        • Импортов: ${vueAnalysis.imports.length}`);
          this.log(`        • Строк скрипта: ${vueAnalysis.stats.scriptLines}`);
          this.log(`        • Строк шаблона: ${vueAnalysis.stats.templateLines}`);
          this.log(`        • Стилей: ${vueAnalysis.stats.styleCount}`);

          if (vueAnalysis.template.complexity > 50) {
            this.log(
              `        ⚠️ Шаблон слишком сложный (${vueAnalysis.template.complexity} элементов)`
            );
          }

          if (vueAnalysis.props.names.length > 10) {
            this.log(`        ⚠️ Много props (${vueAnalysis.props.names.length})`);
          }
        }
      } catch (error) {
        this.log(`     ❌ Ошибка Vue анализа: ${error}`);
      }
    }

    // 7. ИТОГОВЫЙ ОТЧЕТ С РЕКОМЕНДАЦИЯМИ
    this.log('\n  📊 ИТОГОВЫЙ ОТЧЕТ И РЕКОМЕНДАЦИИ');
    this.log('     =================================');

    const collectedMetrics = this.collectMetrics({ semanticResults: results });

    if (!collectedMetrics) {
      this.log('     ⚠️ Не удалось собрать метрики качества');
      return results;
    }

    const metricsData = collectedMetrics;

    this.log('\n  📈 МЕТРИКИ КАЧЕСТВА КОДА:');
    this.log('     ─────────────────────────');
    const complexityIcon =
      metricsData.cyclomaticComplexity > 10
        ? '🔴'
        : metricsData.cyclomaticComplexity > 5
          ? '🟡'
          : '✅';
    this.log(
      `     • Цикломатическая сложность: ${metricsData.cyclomaticComplexity} ${complexityIcon}`
    );
    this.log(`     • Функций: ${metricsData.totalFunctions}`);
    this.log(`     • Неиспользуемых функций: ${metricsData.unusedFunctionsCount}`);
    this.log(`     • Ошибок типов: ${metricsData.typeErrorsCount}`);
    this.log(`     • Проблем Data Flow: ${metricsData.dataFlowIssuesCount}`);

    this.log('\n  💡 РЕКОМЕНДАЦИИ ПО ОПТИМАЛЬНЫМ НАСТРОЙКАМ:');
    this.log('     ───────────────────────────────────────────');

    if (metricsData.cyclomaticComplexity > 15) {
      this.log('     🔧 Для сложного кода (>15):');
      this.log('        --target-size 4   (увеличить размер кластера)');
      this.log('        --max-size 12     (разрешить большие кластеры)');
      this.log('        --min-cohesion 50 (снизить требования к связности)');
    } else if (metricsData.totalFunctions > 30) {
      this.log('     🔧 Для большого количества функций (>30):');
      this.log('        --target-size 3   (стандартный размер кластера)');
      this.log('        --max-size 10     (ограничить размер кластера)');
      this.log('        --min-cohesion 60 (стандартная связность)');
    } else if (metricsData.totalFunctions < 10) {
      this.log('     🔧 Для небольшого файла (<10 функций):');
      this.log('        --target-size 2   (меньшие кластеры)');
      this.log('        --max-size 5      (максимальный размер кластера)');
      this.log('        --min-cohesion 70 (высокая связность)');
    } else {
      this.log('     🔧 Стандартные настройки:');
      this.log('        --target-size 3   (стандартный размер кластера)');
      this.log('        --max-size 10     (максимальный размер кластера)');
      this.log('        --min-cohesion 60 (минимальная связность)');
    }

    this.log('\n     📋 Рекомендуемые флаги анализа:');
    if (metricsData.typeErrorsCount > 0) {
      this.log('        --formal         (формальная верификация для поиска ошибок)');
    }

    if (filePath.endsWith('.vue')) {
      this.log('        --no-vue         (отключить Vue анализ для ускорения)');
    }

    if (metricsData.unusedFunctionsCount > 5) {
      this.log('\n     🗑️ Код нуждается в очистке:');
      this.log(`        • Удалите ${metricsData.unusedFunctionsCount} неиспользуемых функций`);
      this.log('        • Используйте --fix-imports для автоисправления импортов');
    }

    const score = this.calculateQualityScore(metricsData);
    this.log('\n  🎯 ОБЩАЯ ОЦЕНКА КАЧЕСТВА КОДА:');
    this.log('     ───────────────────────────────');
    this.log(`     Оценка: ${score}/100`);

    if (score >= 80) {
      this.log('     ✅ Отличное качество кода!');
    } else if (score >= 60) {
      this.log('     🟡 Хорошее качество, есть что улучшить');
    } else if (score >= 40) {
      this.log('     ⚠️ Среднее качество, требуется рефакторинг');
    } else {
      this.log('     🔴 Низкое качество, необходим серьезный рефакторинг');
    }

    return results;
  }

  private async runFormalVerification(sourceFile: SourceFile): Promise<VerificationResult[]> {
    const verificationResults: VerificationResult[] = [];

    await this.z3Verifier.initialize();

    const functions = sourceFile.getFunctions();
    const criticalSet = new Set(this.options.criticalFunctions || []);

    for (const func of functions) {
      const funcName = func.getName();
      if (!funcName) continue;

      if (criticalSet.size === 0 || criticalSet.has(funcName)) {
        const contract = this.extractFunctionContract(func);
        if (contract) {
          const result = await this.z3Verifier.verifyFunction(contract);
          verificationResults.push({ ...result, functionName: funcName });
          if (result.isValid) {
            this.log(`     ✅ ${funcName} - ВЕРИФИЦИРОВАНА`);
          } else {
            this.log(`     ❌ ${funcName} - НЕ ПРОШЛА верификацию`);
          }
        }
      }
    }

    return verificationResults;
  }

  private async runCodeValidation(filePaths: string[]): Promise<ValidationResult> {
    this.log('  🔍 Запуск валидации кода...');
    const result = await this.codeValidator.validateFiles(filePaths);
    this.log(`     ❌ Ошибок: ${result.summary.errors}`);
    this.log(`     ⚠️ Предупреждений: ${result.summary.warnings}`);
    this.log(`     🔧 Автоисправимых: ${result.summary.autoFixable}`);
    return result;
  }

  private async runESLintFix(filePaths: string[]): Promise<ESLintFixResult[]> {
    this.log('  📝 Запуск ESLint анализа...');
    const results = await this.eslintFixer.fixFiles(filePaths, this.options.createBackup);
    const totalFixes = results.reduce((sum, r) => sum + r.fixes, 0);
    const fixedFiles = results.filter(r => r.success && r.fixes > 0).length;
    this.log(`     ✅ Исправлено файлов: ${fixedFiles}`);
    this.log(`     🔧 Всего исправлений: ${totalFixes}`);
    return results;
  }

  private async runTypeScriptFix(
    filePaths: string[]
  ): Promise<{ fixedCount: number; remainingErrors: number }> {
    this.log('  🔷 Запуск TypeScript валидации...');
    const result = await this.tsValidator.validateAndFix(filePaths, this.options.maxIterations);
    this.log(`     ✅ Исправлено: ${result.fixedCount}`);
    this.log(`     ❌ Осталось ошибок: ${result.remainingErrors}`);
    return { fixedCount: result.fixedCount, remainingErrors: result.remainingErrors };
  }

  private async runCodeFix(validationResult: ValidationResult): Promise<FixResult[]> {
    this.log('  🔧 Запуск автоматического исправления...');
    const results = await this.codeFixer.autoFix(
      validationResult.issues,
      this.options.createBackup
    );
    const totalFixes = results.reduce((sum, r) => sum + r.fixes, 0);
    const successFiles = results.filter(r => r.success).length;
    this.log(`     ✅ Исправлено файлов: ${successFiles}`);
    this.log(`     🔧 Всего исправлений: ${totalFixes}`);
    return results;
  }

  private async analyzeFile(sourceFile: SourceFile): Promise<any> {
    const functions: string[] = [];
    const callGraph: Record<string, string[]> = {};

    const functionDeclarations = sourceFile.getFunctions();
    for (const func of functionDeclarations) {
      const name = func.getName();
      if (!name) continue;
      functions.push(name);
      callGraph[name] = [];
      func.forEachDescendant(node => {
        if (Node.isCallExpression(node)) {
          const expression = node.getExpression();
          if (Node.isIdentifier(expression)) {
            const calledName = expression.getText();
            if (calledName !== name) {
              const currentCalls = callGraph[name];
              if (currentCalls && !currentCalls.includes(calledName)) {
                currentCalls.push(calledName);
              }
            }
          }
        }
      });
    }

    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const variable of variableDeclarations) {
      const name = variable.getName();
      const initializer = variable.getInitializer();
      if (
        initializer &&
        (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
      ) {
        if (!functions.includes(name)) {
          functions.push(name);
          callGraph[name] = [];
          initializer.forEachDescendant(node => {
            if (Node.isCallExpression(node)) {
              const expression = node.getExpression();
              if (Node.isIdentifier(expression)) {
                const calledName = expression.getText();
                if (calledName !== name) {
                  const currentCalls = callGraph[name];
                  if (currentCalls && !currentCalls.includes(calledName)) {
                    currentCalls.push(calledName);
                  }
                }
              }
            }
          });
        }
      }
    }

    if (this.options.verbose) {
      this.log(`\n📊 Анализ AST: найдено ${functions.length} функций`);
      for (const [fn, deps] of Object.entries(callGraph)) {
        if (deps.length > 0) {
          this.log(`   ${fn} → ${deps.join(', ')}`);
        }
      }
    }

    return { functions, callGraph, sourceFile };
  }

  private identifyClusters(analysis: any): any[] {
    const { functions, callGraph } = analysis;
    const clusters: any[] = [];
    const visited = new Set<string>();

    const importance = new Map<string, number>();
    for (const [caller, callees] of Object.entries(callGraph)) {
      if (Array.isArray(callees)) {
        for (const callee of callees) {
          importance.set(callee, (importance.get(callee) || 0) + 1);
        }
      }
      importance.set(caller, (importance.get(caller) || 0) + 0.5);
    }

    const entryPoints = this.findEntryPoints(callGraph, functions);

    for (const entryPoint of entryPoints) {
      if (visited.has(entryPoint)) continue;

      const cluster: any = {
        name: this.generateClusterName(entryPoint),
        functions: [entryPoint],
        cohesionScore: 0,
        isEntryPoint: true,
        type: 'unknown',
        recommendation: '',
      };

      const queue = [entryPoint];
      visited.add(entryPoint);

      while (queue.length > 0 && cluster.functions.length < (this.options.maxClusterSize || 10)) {
        const current = queue.shift()!;
        const deps = callGraph[current] || [];
        const callers = this.findCallers(callGraph, current);

        for (const dep of deps) {
          if (!visited.has(dep) && functions.includes(dep)) {
            visited.add(dep);
            cluster.functions.push(dep);
            if (cluster.functions.length < (this.options.maxClusterSize || 10)) {
              queue.push(dep);
            }
          }
        }

        for (const caller of callers) {
          if (!visited.has(caller) && functions.includes(caller)) {
            visited.add(caller);
            cluster.functions.unshift(caller);
            if (cluster.functions.length < (this.options.maxClusterSize || 10)) {
              queue.unshift(caller);
            }
          }
        }
      }

      if (cluster.functions.length > 0) {
        cluster.cohesionScore = this.calculateCohesion(cluster.functions, callGraph);
        cluster.type = this.determineClusterType(cluster, callGraph);
        cluster.recommendation = this.getClusterRecommendation(cluster);
        clusters.push(cluster);
      }
    }

    for (const func of functions) {
      if (!visited.has(func)) {
        const deps = callGraph[func] || [];
        const callers = this.findCallers(callGraph, func);

        if (deps.length === 0 && callers.length === 0) {
          clusters.push({
            name: this.generateClusterName(func),
            functions: [func],
            cohesionScore: 100,
            type: 'isolated',
            recommendation: '⚡ Изолированная функция - можно оставить или вынести в utils',
            isEntryPoint: false,
          });
        } else if (deps.length > 0 || callers.length > 0) {
          clusters.push({
            name: this.generateClusterName(func),
            functions: [func],
            cohesionScore: 0,
            type: 'orphan',
            recommendation: '❓ Функция имеет связи, но не вошла в кластер',
            isEntryPoint: false,
            dependencies: deps,
            callers: callers,
          });
        }
        visited.add(func);
      }
    }

    clusters.sort((a, b) => {
      if (a.cohesionScore !== b.cohesionScore) return b.cohesionScore - a.cohesionScore;
      if (a.functions.length !== b.functions.length) return b.functions.length - a.functions.length;
      return a.name.localeCompare(b.name);
    });

    if (this.options.verbose) {
      this.log('\n📊 Детальный анализ кластеров:');
      for (const cluster of clusters) {
        this.log(`\n   📦 ${cluster.name}:`);
        this.log(`      Функции: ${cluster.functions.join(', ')}`);
        this.log(`      Связность: ${cluster.cohesionScore}%`);
        this.log(`      Тип: ${cluster.type}`);
        this.log(`      Рекомендация: ${cluster.recommendation}`);
      }
    }

    return clusters;
  }

  private findEntryPoints(callGraph: Record<string, string[]>, functions: string[]): string[] {
    const calledFunctions = new Set<string>();
    for (const callees of Object.values(callGraph)) {
      if (Array.isArray(callees)) {
        for (const callee of callees) {
          calledFunctions.add(callee);
        }
      }
    }
    const entryPoints = functions.filter(f => !calledFunctions.has(f));
    if (entryPoints.length === 0) {
      const callCount = new Map<string, number>();
      for (const [caller, callees] of Object.entries(callGraph)) {
        if (Array.isArray(callees)) {
          callCount.set(caller, (callCount.get(caller) || 0) + callees.length);
        }
      }
      const sorted = Array.from(callCount.entries()).sort((a, b) => b[1] - a[1]);
      return sorted.slice(0, 3).map(([func]) => func);
    }
    return entryPoints;
  }

  private findCallers(callGraph: Record<string, string[]>, target: string): string[] {
    const callers: string[] = [];
    for (const [caller, callees] of Object.entries(callGraph)) {
      if (Array.isArray(callees) && callees.includes(target)) {
        callers.push(caller);
      }
    }
    return callers;
  }

  private calculateCohesion(functions: string[], callGraph: Record<string, string[]>): number {
    if (functions.length <= 1) return 100;
    let internalEdges = 0;
    for (const fn of functions) {
      const deps = callGraph[fn] || [];
      if (Array.isArray(deps)) {
        internalEdges += deps.filter(dep => functions.includes(dep)).length;
      }
    }
    const totalPossibleEdges = functions.length * (functions.length - 1);
    return totalPossibleEdges > 0 ? Math.round((internalEdges / totalPossibleEdges) * 100) : 0;
  }

  private determineClusterType(cluster: any, callGraph: Record<string, string[]>): string {
    const hasExternalDeps = cluster.functions.some((fn: string) => {
      const deps = callGraph[fn] || [];
      if (Array.isArray(deps)) {
        return deps.some((dep: string) => !cluster.functions.includes(dep));
      }
      return false;
    });
    const isCalledExternally = cluster.functions.some((fn: string) => {
      for (const [caller, callees] of Object.entries(callGraph)) {
        if (Array.isArray(callees) && !cluster.functions.includes(caller) && callees.includes(fn)) {
          return true;
        }
      }
      return false;
    });
    if (cluster.isEntryPoint && hasExternalDeps) return 'core';
    if (isCalledExternally && !hasExternalDeps) return 'library';
    if (!hasExternalDeps && !isCalledExternally) return 'internal';
    return 'utility';
  }

  private getClusterRecommendation(cluster: any): string {
    if (cluster.type === 'core')
      return '🔷 Основной модуль - рекомендуется выделить в отдельный файл';
    if (cluster.type === 'library')
      return '📚 Библиотечный модуль - можно вынести для переиспользования';
    if (cluster.type === 'internal') return '🔒 Внутренний модуль - хороший кандидат для выделения';
    if (cluster.type === 'isolated')
      return '⚡ Изолированная функция - можно оставить или вынести в utils';
    return '❓ Требует анализа - проверьте зависимости';
  }

  private findIsolatedFunctions(analysis: any, existingClusters: any[]): any[] {
    const allFunctionsInClusters = new Set<string>();
    for (const cluster of existingClusters) {
      for (const fn of cluster.functions) {
        allFunctionsInClusters.add(fn);
      }
    }
    const isolated: any[] = [];
    for (const func of analysis.functions) {
      if (!allFunctionsInClusters.has(func)) {
        const deps = analysis.callGraph[func] || [];
        if (deps.length === 0) {
          isolated.push({
            name: this.generateClusterName(func),
            functions: [func],
            cohesionScore: 100,
            type: 'isolated',
            recommendation: '⚡ Изолированная функция',
          });
        }
      }
    }
    return isolated;
  }

  private async updateImports(sourceFile: SourceFile, modules: ExtractedModule[]): Promise<void> {
    if (modules.length === 0) return;
    await this.importManager.updateImports(sourceFile.getFilePath(), modules);
  }

  private async optimizeImportOrder(sourceFile: SourceFile): Promise<void> {
    await this.importManager.optimizeImportOrder(sourceFile.getFilePath());
  }

  private extractFunctionContract(func: any): FunctionContract | null {
    const name = func.getName();
    if (!name) return null;

    const params = func.getParameters().map((p: any) => ({
      name: p.getName(),
      type: this.getParamType(p),
    }));

    const returnType = this.getReturnType(func);
    const preconditions: any[] = [];
    const postconditions: any[] = [];

    for (const param of params) {
      if (param.type === 'int') {
        preconditions.push(range(param.name, -1000, 1000));
      }
    }

    return { name, params, returnType, preconditions, postconditions, invariants: [] };
  }

  private getParamType(param: any): 'int' | 'bool' | 'string' {
    const type = param.getType();
    if (type.isNumber()) return 'int';
    if (type.isBoolean()) return 'bool';
    if (type.isString()) return 'string';
    return 'int';
  }

  private getReturnType(func: any): 'int' | 'bool' | 'string' | 'void' {
    const returnType = func.getReturnType();
    if (returnType.isNumber()) return 'int';
    if (returnType.isBoolean()) return 'bool';
    if (returnType.isString()) return 'string';
    return 'void';
  }

  private generateClusterName(funcName: string): string {
    let name = funcName.replace(
      /^(get|set|is|has|use|fetch|handle|on|validate|process|calculate)/,
      ''
    );
    name = name.charAt(0).toLowerCase() + name.slice(1);
    return name + 'Module';
  }

  private async createBackup(filePath: string): Promise<string> {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.promises.copyFile(filePath, backupPath);
    this.log(`💾 Бэкап создан: ${path.basename(backupPath)}`);
    return backupPath;
  }

  private async restoreBackup(filePath: string, backupPath: string): Promise<void> {
    if (fs.existsSync(backupPath)) {
      await fs.promises.copyFile(backupPath, filePath);
      this.log(`🔄 Восстановлен бэкап: ${path.basename(backupPath)}`);
    }
  }

  private collectMetrics(data: any): RefactorResult['metrics'] {
    return {
      cyclomaticComplexity: data?.semanticResults?.cfg
        ? this.calculateCyclomaticComplexity(data.semanticResults.cfg)
        : 0,
      totalFunctions: data?.semanticResults?.callGraph?.nodes.size || 0,
      unusedFunctionsCount: data?.semanticResults?.unusedFunctions?.length || 0,
      typeErrorsCount: data?.semanticResults?.typeErrors?.length || 0,
      verifiedFunctionsCount:
        data?.verificationResults?.filter((r: VerificationResult) => r.isValid).length || 0,
      dataFlowIssuesCount: data?.semanticResults?.dataFlow?.findUnusedVariables().length || 0,
      eslintFixesCount:
        data?.eslintResults?.reduce((sum: number, r: ESLintFixResult) => sum + r.fixes, 0) || 0,
      tsFixesCount: data?.tsFixResults?.fixedCount || 0,
      codeFixesCount:
        data?.codeFixResults?.reduce((sum: number, r: FixResult) => sum + r.fixes, 0) || 0,
    };
  }

  private calculateCyclomaticComplexity(cfg: ControlFlowGraph): number {
    const nodes = cfg.blocks.length;
    let edges = 0;
    for (const block of cfg.blocks) {
      edges += block.successors.length;
    }
    return Math.max(1, edges - nodes + 2);
  }

  private calculateQualityScore(metrics: RefactorResult['metrics']): number {
    let score = 100;

    if (!metrics) {
      return 0;
    }

    if (metrics.cyclomaticComplexity > 20) score -= 30;
    else if (metrics.cyclomaticComplexity > 15) score -= 20;
    else if (metrics.cyclomaticComplexity > 10) score -= 10;

    if (metrics.unusedFunctionsCount > 10) score -= 20;
    else if (metrics.unusedFunctionsCount > 5) score -= 10;
    else if (metrics.unusedFunctionsCount > 0) score -= 5;

    if (metrics.typeErrorsCount > 10) score -= 25;
    else if (metrics.typeErrorsCount > 5) score -= 15;
    else if (metrics.typeErrorsCount > 0) score -= 5;

    if (metrics.dataFlowIssuesCount > 10) score -= 15;
    else if (metrics.dataFlowIssuesCount > 5) score -= 10;
    else if (metrics.dataFlowIssuesCount > 0) score -= 5;

    return Math.max(0, score);
  }

  private logHeader(title: string): void {
    console.log('\n' + '='.repeat(60));
    console.log(`🔧 ${title}`);
    console.log('='.repeat(60));
  }

  private logSection(title: string): void {
    console.log(`\n📌 ${title}`);
    console.log('-'.repeat(40));
  }

  private log(message: string): void {
    console.log(message);
  }

  private logSemanticStatus(): void {
    if (this.options.semanticAnalysis) {
      this.log('🧠 Семантический анализ: ВКЛЮЧЕН');
      if (this.options.formalVerification) this.log('🔬 Формальная верификация: ВКЛЮЧЕНА (Z3)');
      if (this.options.dataFlowAnalysis) this.log('🌊 Data Flow анализ: ВКЛЮЧЕН');
      if (this.options.callGraphAnalysis) this.log('🕸️ Call Graph анализ: ВКЛЮЧЕН');
      if (this.options.jsxAnalysis) this.log('⚛️ JSX/TSX анализ: ВКЛЮЧЕН');
      if (this.options.vueAnalysis) this.log('🎯 Vue анализ: ВКЛЮЧЕН');
    }
    if (this.options.eslintCheck)
      this.log(`📝 ESLint: ВКЛЮЧЕН${this.options.eslintFix ? ' (с автоисправлением)' : ''}`);
    if (this.options.typeCheck) this.log('🔷 TypeScript проверка: ВКЛЮЧЕНА');
    if (this.options.autoFix) this.log('🔧 Автоисправление: ВКЛЮЧЕНО');
    if (this.options.optimizeImports) this.log('📦 Оптимизация импортов: ВКЛЮЧЕНА');
    if (this.options.extractIsolatedFunctions)
      this.log('⚡ Выделение изолированных функций: ВКЛЮЧЕНО');
  }

  private logClusters(clusters: any[]): void {
    this.log(`\n📊 Найдено кластеров: ${clusters.length}`);
    clusters.forEach((cluster, i) => {
      this.log(
        `   ${i + 1}. ${cluster.name}: [${cluster.functions.join(', ')}] (связность: ${cluster.cohesionScore}%, тип: ${cluster.type})`
      );
    });
  }

  private logMetrics(metrics: RefactorResult['metrics']): void {
    if (!metrics) return;
    this.log('\n📊 ИТОГОВЫЕ МЕТРИКИ:');
    this.log(`   • Цикломатическая сложность: ${metrics.cyclomaticComplexity}`);
    this.log(`   • Всего функций: ${metrics.totalFunctions}`);
    this.log(`   • Неиспользуемых функций: ${metrics.unusedFunctionsCount}`);
    this.log(`   • Ошибок типов: ${metrics.typeErrorsCount}`);
    this.log(`   • Верифицировано функций: ${metrics.verifiedFunctionsCount}`);
    this.log(`   • Проблем Data Flow: ${metrics.dataFlowIssuesCount}`);
    this.log(`   • ESLint исправлений: ${metrics.eslintFixesCount}`);
    this.log(`   • TypeScript исправлений: ${metrics.tsFixesCount}`);
    this.log(`   • Code исправлений: ${metrics.codeFixesCount}`);
  }

  private logSuccess(modules: ExtractedModule[], backupPath?: string): void {
    this.log('\n✨ РЕФАКТОРИНГ УСПЕШНО ЗАВЕРШЁН!');
    this.log(`📦 Создано модулей: ${modules.length}`);
    if (modules.length > 0) {
      this.log('\n📁 СОЗДАННЫЕ МОДУЛИ:');
      for (const module of modules) {
        const relativePath = path.relative(process.cwd(), module.path);
        this.log(`   ✅ ${relativePath} (${module.exports.length} экспортов)`);
      }
    }
    if (backupPath) this.log(`\n💾 Бэкап: ${path.relative(process.cwd(), backupPath)}`);
    this.log('\n💡 Совет: Запустите линтер и тесты после рефакторинга');
  }

  private logError(error: unknown): void {
    this.log('\n❌ КРИТИЧЕСКАЯ ОШИБКА:');
    this.log(error instanceof Error ? error.message : String(error));
    if (this.options.verbose && error instanceof Error && error.stack) {
      this.log('\nСтек вызовов:');
      this.log(error.stack);
    }
  }

  private createSuccessResult(
    modules: ExtractedModule[],
    backupPath: string | undefined,
    extra: any
  ): RefactorResult {
    return { success: true, modules, backupPath, ...extra };
  }

  private createErrorResult(
    error: string,
    backupPath: string | undefined,
    extra: any
  ): RefactorResult {
    return { success: false, modules: [], backupPath, error, ...extra };
  }

  async initialize(): Promise<void> {
    this.log('🚀 Инициализация AutoRefactor с полным pipeline...');

    if (fs.existsSync(this.wasmPath)) {
      const wasmFiles = fs.readdirSync(this.wasmPath).filter((f: string) => f.endsWith('.wasm'));
      if (wasmFiles.length > 0) {
        try {
          await initTreeSitter(this.wasmPath);
          this.treeSitterInitialized = true;
          this.log('✅ Tree-sitter инициализирован');
          this.log(`   📂 Путь: ${this.wasmPath}`);
          this.log(`   📦 Грамматик: ${wasmFiles.length}`);
        } catch (error) {
          this.treeSitterInitialized = false;
          this.log(`⚠️ Tree-sitter инициализация не удалась: ${error}`);
          this.log('   Call Graph анализ будет ограничен или отключен');
        }
      } else {
        this.treeSitterInitialized = false;
        this.log('⚠️ WASM файлы не найдены в директории: ' + this.wasmPath);
        this.log('   Для полноценного Call Graph анализа скопируйте WASM файлы в dist/wasm/');
      }
    } else {
      this.treeSitterInitialized = false;
      this.log('⚠️ Директория WASM не найдена: ' + this.wasmPath);
      this.log('   Call Graph анализ будет недоступен');
    }

    if (this.options.formalVerification) {
      await this.z3Verifier.initialize();
    }
    this.log('✅ Все компоненты инициализированы');
  }

  async dispose(): Promise<void> {
    if (this.z3Verifier) await this.z3Verifier.dispose();
  }
}

export { TypeScriptValidator } from './TypeScriptValidator.js';
export { ESLintASTFixer } from './ESLintASTFixer.js';
export { CodeValidator } from './CodeValidator.js';
export type { ValidationResult } from './CodeValidator.js';
export { CodeFixer } from './CodeFixer.js';
export type { FixResult } from './CodeFixer.js';
export { ImportManager } from './ImportManager.js';
export { TemplateUpdater } from './TemplateUpdater.js';
export { ModuleExtractor } from './ModuleExtractor.js';
