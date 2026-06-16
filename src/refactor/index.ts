// src/refactor/index.ts
import { Project, ScriptTarget, ModuleKind, Node } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger, parseLogLevel } from '../utils/Logger.js';
import { ModuleExtractor } from './ModuleExtractor.js';
import { ImportManager } from './ImportManager.js';
import { TypeScriptValidator } from './TypeScriptValidator.js';
import { ESLintASTFixer, type ESLintFixResult } from './ESLintASTFixer.js';
import { CodeValidator, type ValidationResult } from './CodeValidator.js';
import { CodeFixer, type FixResult } from './CodeFixer.js';
import { TemplateUpdater } from './TemplateUpdater.js';
import { initTreeSitter } from '@codeflow-map/core';
import { Z3Verifier, type VerificationResult } from '../formal/Z3Verifier.js';
import type { ControlFlowGraph } from '../semantic/CFGAnalyzer.js';
import { CFGAnalyzer } from '../semantic/CFGAnalyzer.js';
import type { CallGraph } from '../semantic/CallGraphAnalyzer.js';
import { CallGraphAnalyzer } from '../semantic/CallGraphAnalyzer.js';
import type { DataFlowGraph } from '../semantic/DataFlowAnalyzer.js';
import { DataFlowAnalyzer } from '../semantic/DataFlowAnalyzer.js';
import type { TypeError } from '../semantic/TypeAnalyzer.js';

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

  semanticAnalysis?: boolean;
  formalVerification?: boolean;
  dataFlowAnalysis?: boolean;
  callGraphAnalysis?: boolean;
  jsxAnalysis?: boolean;
  vueAnalysis?: boolean;
  criticalFunctions?: string[];
  maxCallDepth?: number;

  eslintCheck?: boolean;
  eslintFix?: boolean;
  typeCheck?: boolean;
  codeValidation?: boolean;
  autoFix?: boolean;
  maxIterations?: number;

  fixUnusedImports?: boolean;
  fixUnusedVariables?: boolean;
  addMissingTypes?: boolean;
  optimizeImports?: boolean;

  minClusterSize?: number;
  extractIsolatedFunctions?: boolean;
  groupByCallGraph?: boolean;
  addReExports?: boolean;

  incremental?: boolean;
  logLevel?: string;
  logFile?: string;
  maxRetries?: number;
}

export interface ExtractedModule {
  name: string;
  path: string;
  exports: string[];
  dependencies: string[];
  originalNodes: Node[];
}

export interface ClusterInfo {
  name: string;
  functions: string[];
  cohesionScore: number;
  size: number;
  type: 'core' | 'helper' | 'isolated';
  isExported: boolean;
  recommendation: string;
  dependencies: string[];
  importers: string[];
}

export interface RefactorResult {
  success: boolean;
  modules: ExtractedModule[];
  backupPath?: string;
  error?: string;
  lastSuccessfulStep?: number;
  failedStep?: string;

  semanticResults?: {
    cfg?: ControlFlowGraph;
    callGraph?: CallGraph;
    typeAnalysis?: any;
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

export class AutoRefactor {
  private project: Project;
  private options: RefactorOptions;
  private logger: Logger;
  private incremental: boolean;

  // Компоненты
  private extractor: ModuleExtractor;
  private importManager: ImportManager;
  private tsValidator: TypeScriptValidator;
  private eslintFixer: ESLintASTFixer;
  private codeValidator: CodeValidator;
  private codeFixer: CodeFixer;
  private templateUpdater: TemplateUpdater;
  private cfgAnalyzer: CFGAnalyzer;
  private callGraphAnalyzer: CallGraphAnalyzer;
  private dataFlowAnalyzer: DataFlowAnalyzer;
  private z3Verifier: Z3Verifier;

  // Состояние
  private modules: ExtractedModule[] = [];
  private backupPath: string | null = null;
  private semanticResults: NonNullable<RefactorResult['semanticResults']> = {};
  private verificationResults: VerificationResult[] = [];
  private validationResults: ValidationResult | undefined;
  private eslintResults: ESLintFixResult[] = [];
  private tsFixResults: { fixedCount: number; remainingErrors: number } = {
    fixedCount: 0,
    remainingErrors: 0,
  };
  private codeFixResults: FixResult[] = [];
  private analysisData: any = null;
  private sourceFileCache: any = null;

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
      incremental: true,
      maxRetries: 3,
      logLevel: 'info',
      logFile: './refactor.log',
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
      addReExports: true,
      ...options,
    };

    const logLevel = parseLogLevel(this.options.logLevel || 'info');
    this.logger = new Logger(logLevel, this.options.logFile, true);
    this.incremental = this.options.incremental !== false;

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

    // Инициализация компонентов
    this.extractor = new ModuleExtractor(this.project, this.options, this.logger);
    this.importManager = new ImportManager(this.project);
    this.tsValidator = new TypeScriptValidator();
    this.eslintFixer = new ESLintASTFixer();
    this.codeValidator = new CodeValidator();
    this.codeFixer = new CodeFixer();
    this.templateUpdater = new TemplateUpdater(this.options);
    this.cfgAnalyzer = new CFGAnalyzer();
    this.callGraphAnalyzer = new CallGraphAnalyzer();
    this.dataFlowAnalyzer = new DataFlowAnalyzer();
    this.z3Verifier = new Z3Verifier();
  }

  async refactor(filePath: string): Promise<RefactorResult> {
    const absolutePath = path.resolve(filePath);
    this.logger.info('Starting refactoring', { file: absolutePath, incremental: this.incremental });

    if (!fs.existsSync(absolutePath)) {
      return this.createErrorResult(`File not found: ${absolutePath}`, null, -1, []);
    }

    // Создаём бэкап
    if (this.options.createBackup && !this.options.dryRun) {
      this.backupPath = await this.createBackup(absolutePath);
    }

    try {
      if (this.incremental) {
        return await this.refactorIncremental(absolutePath);
      } else {
        return await this.refactorSinglePass(absolutePath);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Refactoring failed', { error: errorMessage });
      await this.restoreBackup(absolutePath);
      return this.createErrorResult(errorMessage, this.backupPath, -1, []);
    }
  }

  private async refactorIncremental(filePath: string): Promise<RefactorResult> {
    this.logger.info('Running incremental refactoring', { file: filePath });

    const steps: { name: string; action: () => Promise<boolean> }[] = [
      {
        name: 'semantic analysis',
        action: async () => {
          await this.runSemanticAnalysis(filePath);
          return true;
        },
      },
      {
        name: 'code validation',
        action: async () => {
          await this.runCodeValidation(filePath);
          return true;
        },
      },
      {
        name: 'eslint analysis',
        action: async () => {
          await this.runESLint(filePath);
          return true;
        },
      },
      {
        name: 'type check',
        action: async () => {
          await this.runTypeCheck(filePath);
          return true;
        },
      },
      {
        name: 'auto fix',
        action: async () => {
          await this.runAutoFix(filePath);
          return true;
        },
      },
      {
        name: 'analyze and cluster',
        action: async () => {
          await this.analyzeAndCluster(filePath);
          return true;
        },
      },
      {
        name: 'extract modules',
        action: async () => {
          await this.extractModules(filePath);
          return true;
        },
      },
      {
        name: 'update imports',
        action: async () => {
          await this.updateImports(filePath);
          return true;
        },
      },
      {
        name: 'final validation',
        action: async () => {
          return await this.finalValidation(filePath);
        },
      },
    ];

    let lastSuccessfulStep = -1;
    let checkpointPath: string | null = null;

    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      if (!step) continue;

      this.logger.info(`Executing step ${stepIndex + 1}/${steps.length}: ${step.name}`);

      checkpointPath = await this.createCheckpoint(filePath, step.name);

      try {
        const success = await step.action();

        if (!success) {
          this.logger.error(`Step "${step.name}" failed`);
          await this.restoreCheckpoint(filePath, checkpointPath);
          return this.createErrorResult(
            `Step "${step.name}" failed`,
            checkpointPath,
            stepIndex,
            steps
          );
        }

        if (await this.validateSyntax(filePath)) {
          lastSuccessfulStep = stepIndex;
          this.logger.info(`Step "${step.name}" completed successfully`);
        } else {
          this.logger.error(`Syntax validation failed after step "${step.name}"`);
          await this.restoreCheckpoint(filePath, checkpointPath);
          return this.createErrorResult(
            `Syntax error after step: ${step.name}`,
            checkpointPath,
            stepIndex,
            steps
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Step "${step.name}" threw exception`, { error: errorMessage });
        await this.restoreCheckpoint(filePath, checkpointPath);
        return this.createErrorResult(
          `Exception in step "${step.name}": ${errorMessage}`,
          checkpointPath,
          stepIndex,
          steps
        );
      } finally {
        if (checkpointPath && fs.existsSync(checkpointPath)) {
          try {
            fs.unlinkSync(checkpointPath);
          } catch {
            /* ignore */
          }
        }
      }
    }

    // Проверка созданных модулей
    const modulesDir = path.join(path.dirname(filePath), this.options.modulesDir || 'modules');
    if (fs.existsSync(modulesDir)) {
      const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
      for (const moduleFile of moduleFiles) {
        const modulePath = path.join(modulesDir, moduleFile);
        if (!(await this.validateSyntax(modulePath))) {
          return this.createErrorResult(
            `Syntax error in generated module: ${modulePath}`,
            null,
            steps.length,
            steps
          );
        }
      }
    }

    this.logger.info('Incremental refactoring completed successfully');
    return this.createSuccessResult(lastSuccessfulStep);
  }

  private async refactorSinglePass(filePath: string): Promise<RefactorResult> {
    this.logger.info('Running single-pass refactoring', { file: filePath });

    await this.runSemanticAnalysis(filePath);
    await this.runCodeValidation(filePath);
    await this.runESLint(filePath);
    await this.runTypeCheck(filePath);
    await this.runAutoFix(filePath);
    await this.analyzeAndCluster(filePath);
    await this.extractModules(filePath);
    await this.updateImports(filePath);

    if (!(await this.finalValidation(filePath))) {
      return this.createErrorResult('Final validation failed', this.backupPath, -1, []);
    }

    this.logger.info('Single-pass refactoring completed successfully');
    return this.createSuccessResult(-1);
  }

  // ============================================
  // ОСНОВНЫЕ МЕТОДЫ
  // ============================================

  private async runSemanticAnalysis(filePath: string): Promise<void> {
    if (!this.options.semanticAnalysis) return;

    this.logger.info('Running semantic analysis', { file: filePath });

    this.sourceFileCache = this.project.addSourceFileAtPath(filePath);
    const sourceFile = this.sourceFileCache;

    // 1. CFG анализ
    if (this.options.dataFlowAnalysis) {
      try {
        const cfg = this.cfgAnalyzer.build(sourceFile);
        this.semanticResults.cfg = cfg;
        this.logger.debug('CFG analysis complete', { blocks: cfg.blocks.length });

        const unreachable = cfg.findUnreachableBlocks();
        if (unreachable.length > 0) {
          this.semanticResults.unreachableCode = unreachable.map(block => ({
            file: filePath,
            line: block.instructions[0]?.getStartLineNumber() || 1,
          }));
          this.logger.debug(`Found ${unreachable.length} unreachable blocks`);
        }
      } catch (error) {
        this.logger.warn('CFG analysis failed', { error });
      }
    }

    // 2. Call Graph анализ
    if (this.options.callGraphAnalysis) {
      try {
        const callGraph = await this.callGraphAnalyzer.analyzeSingle(
          filePath,
          this.options.maxCallDepth
        );
        this.semanticResults.callGraph = callGraph;
        this.logger.debug('Call Graph analysis complete', { nodes: callGraph.nodes.size });

        const unused = callGraph.findUnusedFunctions();
        if (unused.length > 0) {
          this.semanticResults.unusedFunctions = unused.map(f => f.name);
          this.logger.debug(`Found ${unused.length} unused functions`);
        }

        const cycles = callGraph.findCyclicDependencies();
        if (cycles.length > 0) {
          this.semanticResults.cyclicDependencies = cycles.map(cycleEdges =>
            cycleEdges.map(edge => `${edge.from}->${edge.to}`)
          );
          this.logger.debug(`Found ${cycles.length} cyclic dependencies`);
        }
      } catch (error) {
        this.logger.warn('Call Graph analysis failed', { error });
      }
    }

    // 3. Data Flow анализ
    if (this.options.dataFlowAnalysis) {
      try {
        const dataFlow = this.dataFlowAnalyzer.analyze(sourceFile);
        this.semanticResults.dataFlow = dataFlow;
        this.logger.debug('Data Flow analysis complete', { nodes: dataFlow.nodes.length });

        const unusedVars = dataFlow.findUnusedVariables();
        if (unusedVars.length > 0) {
          this.logger.debug(`Found ${unusedVars.length} unused variables`);
        }

        const reassignedConsts = dataFlow.findReassignedConstants();
        if (reassignedConsts.length > 0) {
          this.logger.debug(`Found ${reassignedConsts.length} reassigned constants`);
        }
      } catch (error) {
        this.logger.warn('Data Flow analysis failed', { error });
      }
    }

    // 4. TypeScript анализ
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      try {
        const { TypeAnalyzer } = await import('../semantic/TypeAnalyzer.js');
        const typeAnalyzer = new TypeAnalyzer(filePath);
        const typeAnalysis = typeAnalyzer.analyze();
        this.semanticResults.typeAnalysis = typeAnalysis;

        const typeErrors = typeAnalysis.findTypeErrors();
        if (typeErrors.length > 0) {
          this.semanticResults.typeErrors = typeErrors;
          this.logger.debug(`Found ${typeErrors.length} type errors`);
        }
      } catch (error) {
        this.logger.warn('TypeScript analysis failed', { error });
      }
    }

    // 5. JSX анализ
    if (this.options.jsxAnalysis && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))) {
      try {
        const { JSXAnalyzer } = await import('../semantic/JSXAnalyzer.js');
        const jsxAnalyzer = new JSXAnalyzer(filePath);
        const jsxResult = jsxAnalyzer.analyze(sourceFile);
        this.semanticResults.jsx = jsxResult;
        this.logger.debug('JSX analysis complete', { elements: jsxResult.elements.length });
      } catch (error) {
        this.logger.warn('JSX analysis failed', { error });
      }
    }

    // 6. Vue анализ
    if (this.options.vueAnalysis && filePath.endsWith('.vue')) {
      try {
        const { analyzeVueComponent } = await import('../modes/vue-analyzer.js');
        const vueAnalysis = analyzeVueComponent(filePath);
        this.semanticResults.vue = vueAnalysis;
        if (vueAnalysis) {
          this.logger.debug('Vue analysis complete', {
            props: vueAnalysis.props.names.length,
            events: vueAnalysis.emits.names.length,
            slots: vueAnalysis.slots.length,
          });
        }
      } catch (error) {
        this.logger.warn('Vue analysis failed', { error });
      }
    }

    // 7. Формальная верификация
    if (this.options.formalVerification) {
      await this.runFormalVerification(sourceFile);
    }
  }

  private async runFormalVerification(sourceFile: any): Promise<void> {
    this.logger.info('Running formal verification');

    const functions = sourceFile.getFunctions();
    const criticalSet = new Set(this.options.criticalFunctions || []);

    for (const func of functions) {
      const funcName = func.getName();
      if (!funcName) continue;
      if (criticalSet.size > 0 && !criticalSet.has(funcName)) continue;

      try {
        const contract = this.extractContract(func);
        const result = await this.z3Verifier.verifyFunction(contract);
        this.verificationResults.push({ ...result, functionName: funcName });
        this.logger.debug(`Function ${funcName}: ${result.isValid ? '✅ verified' : '❌ failed'}`);
      } catch (error) {
        this.logger.warn(`Verification failed for ${funcName}`, { error });
      }
    }
  }

  private extractContract(func: any): any {
    const name = func.getName() || 'anonymous';
    const params = func.getParameters().map((p: any) => ({
      name: p.getName(),
      type: this.getParamType(p),
    }));
    const returnType = this.getReturnType(func);
    return { name, params, returnType, preconditions: [], postconditions: [], invariants: [] };
  }

  private getParamType(param: any): 'int' | 'bool' | 'string' {
    const type = param.getType();
    if (type.isNumber()) return 'int';
    if (type.isBoolean()) return 'bool';
    if (type.isString()) return 'string';
    return 'int';
  }

  private getReturnType(func: any): 'int' | 'bool' | 'string' | 'void' {
    const type = func.getReturnType();
    if (type.isNumber()) return 'int';
    if (type.isBoolean()) return 'bool';
    if (type.isString()) return 'string';
    return 'void';
  }

  private async runCodeValidation(filePath: string): Promise<void> {
    if (!this.options.codeValidation) return;

    this.logger.info('Running code validation', { file: filePath });
    this.validationResults = await this.codeValidator.validateFiles([filePath]);
    this.logger.debug('Code validation complete', {
      errors: this.validationResults.summary.errors,
      warnings: this.validationResults.summary.warnings,
    });
  }

  private async runESLint(filePath: string): Promise<void> {
    if (!this.options.eslintCheck) return;

    this.logger.info('Running ESLint analysis', { file: filePath });
    this.eslintResults = await this.eslintFixer.fixFiles([filePath], this.options.createBackup);
    const totalFixes = this.eslintResults.reduce((sum, r) => sum + r.fixes, 0);
    this.logger.debug('ESLint complete', { fixes: totalFixes });
  }

  private async runTypeCheck(filePath: string): Promise<void> {
    if (!this.options.typeCheck) return;

    this.logger.info('Running TypeScript type check', { file: filePath });
    const result = await this.tsValidator.validateAndFix([filePath], this.options.maxIterations);
    this.tsFixResults = { fixedCount: result.fixedCount, remainingErrors: result.remainingErrors };
    this.logger.debug('Type check complete', {
      fixed: result.fixedCount,
      remaining: result.remainingErrors,
    });
  }

  private async runAutoFix(filePath: string): Promise<void> {
    if (!this.options.autoFix || !this.validationResults) return;

    this.logger.info('Running auto-fix', { file: filePath });
    this.codeFixResults = await this.codeFixer.autoFix(
      this.validationResults.issues,
      this.options.createBackup
    );
    const totalFixes = this.codeFixResults.reduce((sum, r) => sum + r.fixes, 0);
    this.logger.debug('Auto-fix complete', { fixes: totalFixes });
  }

  private async analyzeAndCluster(filePath: string): Promise<void> {
    this.logger.info('Analyzing and clustering', { filePath });

    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const functions: string[] = [];
    const callGraph: Record<string, string[]> = {};

    // Сбор функций
    for (const func of sourceFile.getFunctions()) {
      const name = func.getName();
      if (!name) continue;
      functions.push(name);
      callGraph[name] = [];

      func.forEachDescendant(node => {
        if (Node.isCallExpression(node)) {
          const expr = node.getExpression();
          if (Node.isIdentifier(expr)) {
            const calledName = expr.getText();
            if (calledName && calledName !== name) {
              if (!callGraph[name]) {
                callGraph[name] = [];
              }
              if (!callGraph[name].includes(calledName)) {
                callGraph[name].push(calledName);
              }
            }
          }
        }
      });
    }

    // Сбор переменных-функций
    for (const variable of sourceFile.getVariableDeclarations()) {
      const name = variable.getName();
      const initializer = variable.getInitializer();
      if (
        initializer &&
        (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
      ) {
        if (!functions.includes(name)) {
          functions.push(name);
          callGraph[name] = [];
        }
      }
    }

    // Кластеризация
    const clusters = this.identifyClusters(functions, callGraph, sourceFile);
    this.logger.info(`Found ${clusters.length} clusters`);

    // Фильтрация по минимальному размеру и связности
    const filteredClusters = clusters.filter(
      c =>
        c.functions.length >= (this.options.minClusterSize || 2) &&
        c.cohesionScore >= (this.options.minCohesionScore || 60)
    );

    // Добавление изолированных функций если включено
    let finalClusters = filteredClusters;
    if (this.options.extractIsolatedFunctions) {
      const isolated = this.findIsolatedFunctions(functions, callGraph, filteredClusters);
      finalClusters = [...filteredClusters, ...isolated];
    }

    this.logger.info(
      `Final clusters: ${finalClusters.length} (${filteredClusters.length} filtered + ${finalClusters.length - filteredClusters.length} isolated)`
    );

    // Сохраняем для дальнейшего использования
    this.analysisData = { functions, callGraph, clusters: finalClusters, sourceFile };
  }

  private identifyClusters(
    functions: string[],
    callGraph: Record<string, string[]>,
    sourceFile: any
  ): ClusterInfo[] {
    const clusters: ClusterInfo[] = [];
    const visited = new Set<string>();

    // Находим entry points (функции, которые никто не вызывает)
    const calledFunctions = new Set<string>();
    for (const callees of Object.values(callGraph)) {
      for (const callee of callees) {
        if (callee) calledFunctions.add(callee);
      }
    }
    const entryPoints = functions.filter(f => !calledFunctions.has(f));

    // BFS от каждой entry point
    for (const entryPoint of entryPoints) {
      if (visited.has(entryPoint)) continue;

      const cluster: ClusterInfo = {
        name: this.generateClusterName(entryPoint),
        functions: [entryPoint],
        cohesionScore: 100,
        size: 1,
        type: 'core',
        isExported: false,
        recommendation: '',
        dependencies: [],
        importers: [],
      };

      const queue = [entryPoint];
      visited.add(entryPoint);

      while (queue.length > 0 && cluster.functions.length < (this.options.maxClusterSize || 10)) {
        const current = queue.shift()!;
        const deps = callGraph[current] || [];

        for (const dep of deps) {
          if (!dep) continue;
          if (!visited.has(dep) && functions.includes(dep)) {
            if (cluster.functions.length >= (this.options.maxClusterSize || 10)) break;
            visited.add(dep);
            cluster.functions.push(dep);
            queue.push(dep);
          }
        }
      }

      // Вычисляем связность
      cluster.cohesionScore = this.calculateCohesion(cluster.functions, callGraph);
      cluster.size = cluster.functions.length;

      // Определяем тип
      let hasExported = false;
      try {
        for (const f of cluster.functions) {
          const func = sourceFile?.getFunction(f);
          if (func?.isExported()) {
            hasExported = true;
            break;
          }
        }
      } catch {
        hasExported = false;
      }
      cluster.type = hasExported ? 'core' : 'helper';
      cluster.isExported = hasExported;

      // Рекомендация
      if (cluster.cohesionScore >= 80) {
        cluster.recommendation = '✅ Excellent cohesion - perfect candidate for extraction';
      } else if (cluster.cohesionScore >= 60) {
        cluster.recommendation = '✅ Good cohesion - suitable for extraction';
      } else if (cluster.cohesionScore >= 40) {
        cluster.recommendation = '⚠️ Moderate cohesion - consider merging with related clusters';
      } else {
        cluster.recommendation = '❌ Low cohesion - review dependencies';
      }

      clusters.push(cluster);
    }

    // Сортируем по связности и размеру
    clusters.sort((a, b) => {
      if (b.cohesionScore !== a.cohesionScore) return b.cohesionScore - a.cohesionScore;
      return b.functions.length - a.functions.length;
    });

    return clusters;
  }

  private findIsolatedFunctions(
    functions: string[],
    callGraph: Record<string, string[]>,
    existingClusters: ClusterInfo[]
  ): ClusterInfo[] {
    const clusteredFunctions = new Set<string>();
    for (const cluster of existingClusters) {
      for (const fn of cluster.functions) {
        clusteredFunctions.add(fn);
      }
    }

    const isolated: ClusterInfo[] = [];
    for (const func of functions) {
      if (!clusteredFunctions.has(func)) {
        const deps = callGraph[func] || [];
        if (deps.length === 0) {
          isolated.push({
            name: this.generateClusterName(func) + 'Isolated',
            functions: [func],
            cohesionScore: 100,
            size: 1,
            type: 'isolated',
            isExported: false,
            recommendation: '⚡ Isolated function - good for utils or helpers',
            dependencies: [],
            importers: [],
          });
        }
      }
    }

    return isolated;
  }

  private calculateCohesion(functions: string[], callGraph: Record<string, string[]>): number {
    if (functions.length <= 1) return 100;

    let internalEdges = 0;
    let totalEdges = 0;

    for (const fn of functions) {
      const deps = callGraph[fn] || [];
      totalEdges += deps.length;
      internalEdges += deps.filter(dep => dep && functions.includes(dep)).length;
    }

    if (totalEdges === 0) return 0;
    return Math.round((internalEdges / totalEdges) * 100);
  }

  private generateClusterName(funcName: string): string {
    const prefixes = [
      'get',
      'set',
      'is',
      'has',
      'use',
      'fetch',
      'handle',
      'on',
      'validate',
      'process',
      'calculate',
      'create',
      'update',
      'delete',
      'find',
      'format',
      'parse',
      'render',
    ];
    let clean = funcName;
    for (const prefix of prefixes) {
      if (clean.startsWith(prefix)) {
        clean = clean.slice(prefix.length);
        break;
      }
    }
    const result = clean.charAt(0).toLowerCase() + clean.slice(1) || 'module';
    return result + 'Module';
  }

  private async extractModules(filePath: string): Promise<void> {
    this.logger.info('Extracting modules', { filePath });

    if (!this.analysisData?.clusters?.length) {
      this.logger.warn('No clusters found for extraction');
      return;
    }

    try {
      // Конвертируем ClusterInfo в Cluster для ModuleExtractor
      const clustersForExtractor = this.analysisData.clusters.map((c: ClusterInfo) => ({
        name: c.name,
        functions: c.functions,
        cohesionScore: c.cohesionScore,
      }));

      this.modules = await this.extractor.extractModules(filePath, clustersForExtractor);
      this.logger.info(`Extracted ${this.modules.length} modules`);

      for (const module of this.modules) {
        this.logger.debug(`Module: ${module.name} (${module.exports.length} exports)`, {
          path: module.path,
          exports: module.exports,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Module extraction failed', { error: errorMessage });
      throw error;
    }
  }

  private async updateImports(filePath: string): Promise<void> {
    if (this.modules.length === 0) {
      this.logger.warn('No modules to update imports for');
      return;
    }

    this.logger.info('Updating imports', { filePath });

    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);

      // Обновляем импорты
      await this.importManager.updateImports(filePath, this.modules);
      this.logger.debug('Imports updated');

      // Добавляем реэкспорты
      if (this.options.addReExports) {
        await this.importManager.addReExports(filePath, this.modules);
        this.logger.debug('Re-exports added');
      }

      // Оптимизируем импорты
      if (this.options.optimizeImports) {
        await this.importManager.optimizeImportOrder(filePath);
        this.logger.debug('Import order optimized');
      }

      // Обновляем Vue template если нужно
      if (this.options.updateTemplate && filePath.endsWith('.vue')) {
        await this.templateUpdater.update(filePath, this.modules);
        this.logger.debug('Vue template updated');
      }

      await sourceFile.save();
      this.logger.info('Imports updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Import update failed', { error: errorMessage });
      throw error;
    }
  }

  private async finalValidation(filePath: string): Promise<boolean> {
    this.logger.info('Running final validation', { filePath });

    // Проверка синтаксиса основного файла
    if (!(await this.validateSyntax(filePath))) {
      this.logger.error('Final validation failed: syntax error in main file');
      return false;
    }

    // Проверка созданных модулей
    const modulesDir = path.join(path.dirname(filePath), this.options.modulesDir || 'modules');
    if (fs.existsSync(modulesDir)) {
      const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
      for (const moduleFile of moduleFiles) {
        const modulePath = path.join(modulesDir, moduleFile);
        if (!(await this.validateSyntax(modulePath))) {
          this.logger.error(`Final validation failed: syntax error in ${moduleFile}`);
          return false;
        }
      }
    }

    // Валидация кода
    if (this.options.codeValidation) {
      const filesToValidate = [filePath];
      const modulesDirPath = path.join(
        path.dirname(filePath),
        this.options.modulesDir || 'modules'
      );
      if (fs.existsSync(modulesDirPath)) {
        const moduleFiles = fs.readdirSync(modulesDirPath).filter(f => f.endsWith('.js'));
        for (const moduleFile of moduleFiles) {
          filesToValidate.push(path.join(modulesDirPath, moduleFile));
        }
      }

      const validationResult = await this.codeValidator.validateFiles(filesToValidate);
      if (validationResult.summary.errors > 0) {
        this.logger.error(`Final validation found ${validationResult.summary.errors} errors`);
        for (const issue of validationResult.issues.filter(i => i.type === 'error').slice(0, 5)) {
          this.logger.error(`  - ${issue.file}:${issue.line} ${issue.message}`);
        }
        return false;
      }
    }

    // ESLint проверка
    if (this.options.eslintCheck) {
      const filesToLint = [filePath];
      const modulesDirPath = path.join(
        path.dirname(filePath),
        this.options.modulesDir || 'modules'
      );
      if (fs.existsSync(modulesDirPath)) {
        const moduleFiles = fs.readdirSync(modulesDirPath).filter(f => f.endsWith('.js'));
        for (const moduleFile of moduleFiles) {
          filesToLint.push(path.join(modulesDirPath, moduleFile));
        }
      }

      const eslintResults = await this.eslintFixer.fixFiles(filesToLint, false);
      const issues = eslintResults.reduce((sum, r) => sum + r.fixes, 0);
      if (issues > 0) {
        this.logger.warn(`ESLint found ${issues} issues that could be fixed`);
      }
    }

    this.logger.info('Final validation passed successfully');
    return true;
  }

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================

  private async createCheckpoint(filePath: string, stepName: string): Promise<string> {
    const checkpointPath = `${filePath}.checkpoint.${stepName.replace(/\s+/g, '-')}.${Date.now()}`;
    await fs.promises.copyFile(filePath, checkpointPath);
    this.logger.debug('Checkpoint created', { stepName, checkpointPath });
    return checkpointPath;
  }

  private async restoreCheckpoint(filePath: string, checkpointPath: string): Promise<void> {
    if (fs.existsSync(checkpointPath)) {
      await fs.promises.copyFile(checkpointPath, filePath);
      this.logger.warn('Checkpoint restored', { filePath, checkpointPath });
      try {
        fs.unlinkSync(checkpointPath);
      } catch {
        /* ignore */
      }
    }
  }

  private async createBackup(filePath: string): Promise<string> {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.promises.copyFile(filePath, backupPath);
    this.logger.info('Backup created', { backupPath });
    return backupPath;
  }

  private async restoreBackup(filePath: string): Promise<void> {
    if (this.backupPath && fs.existsSync(this.backupPath)) {
      await fs.promises.copyFile(this.backupPath, filePath);
      this.logger.warn('Backup restored', { filePath, backupPath: this.backupPath });
    }
  }

  private async validateSyntax(filePath: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      new Function(content);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Syntax validation failed', { filePath, error: errorMessage });
      return false;
    }
  }

  private createErrorResult(
    error: string,
    _checkpointPath: string | null,
    stepIndex: number,
    steps: { name: string }[]
  ): RefactorResult {
    const failedStep =
      stepIndex >= 0 && stepIndex < steps.length && steps[stepIndex]
        ? steps[stepIndex].name
        : 'unknown';

    return {
      success: false,
      modules: this.modules,
      backupPath: this.backupPath || undefined,
      error,
      lastSuccessfulStep: stepIndex >= 0 ? stepIndex : undefined,
      failedStep,
      semanticResults: this.semanticResults,
      verificationResults: this.verificationResults,
      validationResults: this.validationResults,
      eslintResults: this.eslintResults,
      tsFixResults: this.tsFixResults,
      codeFixResults: this.codeFixResults,
      metrics: this.collectMetrics(),
    };
  }

  private createSuccessResult(lastSuccessfulStep: number): RefactorResult {
    return {
      success: true,
      modules: this.modules,
      backupPath: this.backupPath || undefined,
      lastSuccessfulStep: lastSuccessfulStep >= 0 ? lastSuccessfulStep : undefined,
      semanticResults: this.semanticResults,
      verificationResults: this.verificationResults,
      validationResults: this.validationResults,
      eslintResults: this.eslintResults,
      tsFixResults: this.tsFixResults,
      codeFixResults: this.codeFixResults,
      metrics: this.collectMetrics(),
    };
  }

  private collectMetrics(): RefactorResult['metrics'] {
    return {
      cyclomaticComplexity: this.semanticResults.cfg
        ? this.calculateComplexity(this.semanticResults.cfg)
        : 0,
      totalFunctions: this.semanticResults.callGraph?.nodes.size || 0,
      unusedFunctionsCount: this.semanticResults.unusedFunctions?.length || 0,
      typeErrorsCount: this.semanticResults.typeErrors?.length || 0,
      verifiedFunctionsCount: this.verificationResults.filter(r => r.isValid).length || 0,
      dataFlowIssuesCount: this.semanticResults.dataFlow?.findUnusedVariables().length || 0,
      eslintFixesCount: this.eslintResults.reduce((sum, r) => sum + r.fixes, 0) || 0,
      tsFixesCount: this.tsFixResults.fixedCount || 0,
      codeFixesCount: this.codeFixResults.reduce((sum, r) => sum + r.fixes, 0) || 0,
    };
  }

  private calculateComplexity(cfg: ControlFlowGraph): number {
    const nodes = cfg.blocks.length;
    let edges = 0;
    for (const block of cfg.blocks) {
      edges += block.successors.length;
    }
    return Math.max(1, edges - nodes + 2);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing AutoRefactor');

    // Инициализация WASM для Tree-sitter
    const wasmPath = path.resolve(__dirname, 'wasm');
    if (fs.existsSync(wasmPath)) {
      try {
        await initTreeSitter(wasmPath);
        this.logger.info('Tree-sitter initialized');
      } catch (error) {
        this.logger.warn('Tree-sitter initialization failed', { error });
      }
    }

    // Инициализация Z3
    if (this.options.formalVerification) {
      await this.z3Verifier.initialize();
      this.logger.info('Z3 verifier initialized');
    }

    this.logger.info('AutoRefactor initialized');
  }

  async dispose(): Promise<void> {
    await this.z3Verifier.dispose();
    this.logger.close();
  }
}

// Экспорты
export { ModuleExtractor } from './ModuleExtractor.js';
export { ImportManager } from './ImportManager.js';
export { TypeScriptValidator } from './TypeScriptValidator.js';
export { ESLintASTFixer } from './ESLintASTFixer.js';
export { CodeValidator, type ValidationResult } from './CodeValidator.js';
export { CodeFixer, type FixResult } from './CodeFixer.js';
export { TemplateUpdater } from './TemplateUpdater.js';
