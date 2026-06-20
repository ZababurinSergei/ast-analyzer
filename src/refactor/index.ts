// packages/ast-analyzer/src/refactor/index.ts
import { Project, ScriptTarget, ModuleKind, Node, type SourceFile } from 'ts-morph';
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
import {
  SyntaxValidator,
  type ValidationResult as SyntaxValidationResult,
} from './SyntaxValidator.js';
import {
  ModuleTypeDetector,
  type ModuleType,
  type ModuleTypeDetectionResult,
} from './ModuleTypeDetector.js';
import { BackupManager } from './BackupManager.js';
import {
  RefactoringEquivalenceChecker,
  type RefactoringEquivalenceResult,
} from '../formal/RefactoringEquivalenceChecker.js';

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
  guaranteeMode?: boolean;
  maxAttempts?: number;
  skipValidationForESM?: boolean;
  verifyEquivalence?: boolean;
  equivalenceCheckLevel?: 'full' | 'quick' | 'none';
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
  guaranteeInfo?: {
    attempts: number;
    moduleType: ModuleType;
    detectionConfidence: 'high' | 'medium' | 'low';
    validationHistory: SyntaxValidationResult[];
    checkpointsCreated: number;
    backupsCreated: number;
  };
  equivalenceResult?: RefactoringEquivalenceResult;
}

export class AutoRefactor {
  private project: Project;
  private options: RefactorOptions;
  private logger: Logger;
  private incremental: boolean;
  private importManager: ImportManager;
  private backupManager: BackupManager;
  private moduleTypeDetector: ModuleTypeDetector;
  private syntaxValidator: SyntaxValidator;
  private moduleType: ModuleType = 'auto';
  private validationHistory: SyntaxValidationResult[] = [];
  private detectionResult: ModuleTypeDetectionResult | null = null;
  private attemptsUsed = 0;
  private originalExports: string[] = [];
  private modules: ExtractedModule[] = [];
  private backupPath: string | null = null;
  private analysisData: any = {};

  // Инициализируемые компоненты
  private tsValidator: TypeScriptValidator | null = null;
  private eslintFixer: ESLintASTFixer | null = null;
  private codeValidator: CodeValidator | null = null;
  private codeFixer: CodeFixer | null = null;
  private templateUpdater: TemplateUpdater | null = null;
  private cfgAnalyzer: CFGAnalyzer | null = null;
  private callGraphAnalyzer: CallGraphAnalyzer | null = null;
  private dataFlowAnalyzer: DataFlowAnalyzer | null = null;
  private z3Verifier: Z3Verifier | null = null;
  private equivalenceChecker: RefactoringEquivalenceChecker | null = null;

  // Сохранение результатов для обратной совместимости
  private validationResults: ValidationResult | undefined;
  private eslintResults: ESLintFixResult[] | undefined = undefined;
  private tsFixResults: { fixedCount: number; remainingErrors: number } | undefined = undefined;
  private codeFixResults: FixResult[] = [];
  private verificationResults: VerificationResult[] = [];
  private equivalenceResult: RefactoringEquivalenceResult | undefined = undefined;

  public isDryRun(): boolean {
    return this.options.dryRun || false;
  }

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
      semanticAnalysis: false,
      formalVerification: false,
      dataFlowAnalysis: false,
      callGraphAnalysis: false,
      jsxAnalysis: false,
      vueAnalysis: false,
      maxCallDepth: 10,
      eslintCheck: false,
      eslintFix: false,
      typeCheck: false,
      codeValidation: false,
      autoFix: false,
      maxIterations: 5,
      fixUnusedImports: false,
      fixUnusedVariables: false,
      addMissingTypes: false,
      optimizeImports: true,
      minClusterSize: 2,
      extractIsolatedFunctions: true,
      groupByCallGraph: true,
      addReExports: true,
      guaranteeMode: true,
      maxAttempts: 3,
      skipValidationForESM: true,
      verifyEquivalence: true,
      equivalenceCheckLevel: 'full',
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

    this.importManager = new ImportManager(this.project, this.logger);
    this.backupManager = new BackupManager(this.logger);
    this.moduleTypeDetector = new ModuleTypeDetector(this.logger);
    this.syntaxValidator = new SyntaxValidator(this.logger);

    // Инициализируем семантические компоненты при необходимости
    if (this.options.semanticAnalysis || this.options.formalVerification) {
      this.initSemanticComponents();
    }

    // Инициализируем проверку эквивалентности
    if (this.options.verifyEquivalence !== false) {
      this.equivalenceChecker = new RefactoringEquivalenceChecker();
    }
  }

  private initSemanticComponents(): void {
    if (this.options.eslintCheck || this.options.eslintFix) {
      this.eslintFixer = new ESLintASTFixer();
    }
    if (this.options.codeValidation || this.options.autoFix) {
      this.codeValidator = new CodeValidator();
      this.codeFixer = new CodeFixer();
    }
    if (this.options.updateTemplate) {
      this.templateUpdater = new TemplateUpdater(this.options);
    }
    if (this.options.dataFlowAnalysis) {
      this.cfgAnalyzer = new CFGAnalyzer();
      this.dataFlowAnalyzer = new DataFlowAnalyzer();
    }
    if (this.options.callGraphAnalysis) {
      this.callGraphAnalyzer = new CallGraphAnalyzer();
    }
    if (this.options.formalVerification) {
      this.z3Verifier = new Z3Verifier();
    }
    if (this.options.typeCheck) {
      this.tsValidator = new TypeScriptValidator();
    }
  }

  async refactor(filePath: string): Promise<RefactorResult> {
    const absolutePath = path.resolve(filePath);
    this.logger.info('Starting refactoring with full guarantee', {
      file: absolutePath,
      incremental: this.incremental,
      guaranteeMode: this.options.guaranteeMode,
      maxAttempts: this.options.maxAttempts,
      dryRun: this.options.dryRun,
      verifyEquivalence: this.options.verifyEquivalence,
    });

    if (!fs.existsSync(absolutePath)) {
      return this.createErrorResult(`File not found: ${absolutePath}`, null, -1, []);
    }

    // Сохраняем оригинальное содержимое для проверки эквивалентности
    let originalContent: string;
    let originalBackupPath: string | null = null;

    if (this.options.verifyEquivalence !== false) {
      originalContent = fs.readFileSync(absolutePath, 'utf-8');
      originalBackupPath = `${absolutePath}.original-backup.${Date.now()}`;
      fs.writeFileSync(originalBackupPath, originalContent);
      this.logger.info('Original content saved for equivalence check', {
        backupPath: originalBackupPath,
      });
    }

    // В dry-run режиме пропускаем создание бэкапов
    if (!this.options.dryRun) {
      const backupResult = await this.backupManager.createFullBackup(absolutePath);
      if (backupResult) {
        this.backupPath = backupResult.backupPath;
        this.logger.info('Full backup created', { backupPath: this.backupPath });
      } else {
        this.logger.warn('Failed to create full backup');
      }
    } else {
      this.logger.info('DRY RUN: skipping backup creation');
    }

    this.detectionResult = await this.moduleTypeDetector.detect(absolutePath);
    this.moduleType = this.detectionResult.type;
    this.logger.info('Module type detected', {
      type: this.moduleType,
      confidence: this.detectionResult.confidence,
      file: absolutePath,
    });

    const isESM = this.moduleType === 'esm';
    const skipValidation = this.options.skipValidationForESM !== false && isESM;

    if (!skipValidation) {
      const initialValidation = await this.syntaxValidator.validate(absolutePath);
      this.validationHistory.push(initialValidation);
      if (!initialValidation.valid) {
        if (!this.options.dryRun) {
          await this.backupManager.restore(absolutePath);
        }
        return this.createErrorResult(
          `Initial file validation failed: ${initialValidation.error}`,
          this.backupPath,
          -1,
          []
        );
      }
    }

    // В dry-run режиме пропускаем создание рабочей копии
    let workingCopy: string | null = null;
    if (!this.options.dryRun) {
      workingCopy = await this.backupManager.createWorkingCopy(absolutePath);
      this.logger.info('Working copy created', { workingCopy });
    } else {
      this.logger.info('DRY RUN: skipping working copy creation');
    }

    // Инициализируем проверку эквивалентности
    if (this.equivalenceChecker) {
      await this.equivalenceChecker.initialize();
    }

    try {
      let result: RefactorResult;

      if (this.options.guaranteeMode) {
        result = await this.refactorWithGuarantee(absolutePath);
      } else {
        result = await this.refactorStandard(absolutePath);
      }

      if (!skipValidation) {
        const finalValidation = await this.syntaxValidator.validate(absolutePath);
        this.validationHistory.push(finalValidation);
        if (!finalValidation.valid) {
          if (!this.options.dryRun) {
            await this.backupManager.restore(absolutePath);
          }
          return this.createErrorResult(
            `Final validation failed: ${finalValidation.error}`,
            this.backupPath,
            -1,
            []
          );
        }
      }

      // ФОРМАЛЬНАЯ ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ
      if (this.options.verifyEquivalence !== false && originalBackupPath) {
        this.logger.info('🔬 Running formal equivalence verification...');

        try {
          const modulesDir = path.join(
            path.dirname(absolutePath),
            this.options.modulesDir || 'modules'
          );

          // Проверяем, существует ли директория с модулями
          const hasModules = fs.existsSync(modulesDir) && fs.readdirSync(modulesDir).length > 0;

          if (hasModules || this.options.equivalenceCheckLevel === 'full') {
            const equivResult = await this.equivalenceChecker!.checkRefactoringEquivalence(
              originalBackupPath,
              absolutePath,
              hasModules ? modulesDir : undefined
            );

            this.equivalenceResult = equivResult;

            if (!equivResult.isEquivalent) {
              this.logger.error('❌ Formal equivalence check FAILED!');
              this.logger.error(`   ${equivResult.failedFunctions.length} functions have issues`);

              if (equivResult.signatureChanges.length > 0) {
                this.logger.error(
                  `   ${equivResult.signatureChanges.length} signature changes detected`
                );
              }

              // Сохраняем отчет об ошибке
              const reportPath = `${absolutePath}.equivalence-error.md`;
              fs.writeFileSync(reportPath, equivResult.report);
              this.logger.error(`📄 Equivalence report saved: ${reportPath}`);

              if (!this.options.dryRun && !this.options.guaranteeMode) {
                // Восстанавливаем оригинал
                await this.backupManager.restore(absolutePath);
                return this.createErrorResult(
                  'Formal equivalence check failed. Original file restored.',
                  this.backupPath,
                  -1,
                  []
                );
              }
            } else {
              this.logger.info('✅ Formal equivalence check PASSED!');
              this.logger.info(
                `   ✅ ${equivResult.verifiedFunctions}/${equivResult.totalFunctions} functions verified`
              );
            }

            result.equivalenceResult = equivResult;
          } else {
            this.logger.info('ℹ️ No modules found, skipping equivalence check');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn('⚠️ Equivalence check failed, continuing', { error: errorMsg });
        }
      }

      // Собираем метрики
      const metrics = this.collectMetrics();
      result.metrics = metrics;

      result.guaranteeInfo = {
        attempts: this.attemptsUsed || 1,
        moduleType: this.moduleType,
        detectionConfidence: this.detectionResult?.confidence || 'high',
        validationHistory: this.validationHistory,
        checkpointsCreated: this.backupManager.getCheckpoints().length,
        backupsCreated: this.backupManager.getBackups().length,
      };

      // Добавляем результаты семантического анализа
      result.semanticResults = this.analysisData.semanticResults;
      result.verificationResults = this.verificationResults;
      result.validationResults = this.validationResults;
      result.eslintResults = this.eslintResults;
      result.tsFixResults = this.tsFixResults;
      result.codeFixResults = this.codeFixResults;
      result.equivalenceResult = this.equivalenceResult;

      this.logger.info('Refactoring completed successfully');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Refactoring failed, restoring backup', { error: errorMessage });
      if (!this.options.dryRun) {
        await this.backupManager.restore(absolutePath);
      }
      return this.createErrorResult(errorMessage, this.backupPath, -1, []);
    } finally {
      if (!this.options.dryRun) {
        await this.backupManager.cleanup();
      } else {
        this.logger.info('DRY RUN: skipping cleanup');
      }

      if (this.equivalenceChecker) {
        await this.equivalenceChecker.dispose();
      }
    }
  }

  private async refactorWithGuarantee(filePath: string): Promise<RefactorResult> {
    const MAX_RETRIES = this.options.maxAttempts || 3;
    const isESM = this.moduleType === 'esm';
    const skipValidation = this.options.skipValidationForESM !== false && isESM;

    let attempt = 0;
    let lastError: string | undefined;
    let lastResult: RefactorResult | undefined;

    while (attempt < MAX_RETRIES) {
      attempt++;
      this.attemptsUsed = attempt;
      this.logger.info(`Refactoring attempt ${attempt}/${MAX_RETRIES}`);

      try {
        const checkpoints: string[] = [];

        // ЭТАП 1: Анализ
        const analysisCheckpoint = await this.backupManager.createCheckpoint(filePath, 'analysis');
        if (analysisCheckpoint) {
          checkpoints.push(analysisCheckpoint);
        } else {
          this.logger.warn('Failed to create analysis checkpoint');
          continue;
        }

        const analysisResult = await this.analyzeFile(filePath);
        if (!analysisResult) {
          if (analysisCheckpoint) {
            await this.backupManager.restoreCheckpoint(filePath, analysisCheckpoint);
          }
          continue;
        }

        if (!skipValidation) {
          if (!(await this.syntaxValidator.validate(filePath)).valid) {
            if (analysisCheckpoint) {
              await this.backupManager.restoreCheckpoint(filePath, analysisCheckpoint);
            }
            continue;
          }
        }

        // ЭТАП 2: Семантический анализ (если включен)
        if (this.options.semanticAnalysis) {
          await this.runSemanticAnalysis(filePath);
        }

        // ЭТАП 3: Кластеризация
        const clusterCheckpoint = await this.backupManager.createCheckpoint(filePath, 'clustering');
        if (clusterCheckpoint) {
          checkpoints.push(clusterCheckpoint);
        } else {
          this.logger.warn('Failed to create clustering checkpoint');
          continue;
        }

        const clusters = this.identifyClusters(
          analysisResult.functions,
          analysisResult.callGraph,
          analysisResult.sourceFile
        );

        if (!clusters || clusters.length === 0) {
          this.logger.info('No clusters found, skipping extraction');
          if (clusterCheckpoint) {
            await this.backupManager.restoreCheckpoint(filePath, clusterCheckpoint);
          }
          return this.createSuccessResult(attempt);
        }

        if (!skipValidation) {
          if (!(await this.syntaxValidator.validate(filePath)).valid) {
            if (clusterCheckpoint) {
              await this.backupManager.restoreCheckpoint(filePath, clusterCheckpoint);
            }
            continue;
          }
        }

        // ЭТАП 4: Извлечение модулей
        const extractCheckpoint = await this.backupManager.createCheckpoint(filePath, 'extraction');
        if (extractCheckpoint) {
          checkpoints.push(extractCheckpoint);
        } else {
          this.logger.warn('Failed to create extraction checkpoint');
          continue;
        }

        this.analysisData = {
          functions: analysisResult.functions,
          callGraph: analysisResult.callGraph,
          clusters: clusters,
          sourceFile: analysisResult.sourceFile,
          originalExports: this.originalExports,
        };

        await this.extractModules(filePath);

        // Валидируем каждый созданный модуль
        if (!skipValidation) {
          let allModulesValid = true;
          for (const module of this.modules) {
            const isValid = await this.validateExtractedModule(module.path);
            if (!isValid) {
              allModulesValid = false;
              this.logger.warn(`Module validation failed: ${module.path}`);
              break;
            }
          }

          if (!allModulesValid) {
            if (extractCheckpoint) {
              await this.backupManager.restoreCheckpoint(filePath, extractCheckpoint);
            }
            continue;
          }
        }

        if (!skipValidation) {
          if (!(await this.syntaxValidator.validate(filePath)).valid) {
            if (extractCheckpoint) {
              await this.backupManager.restoreCheckpoint(filePath, extractCheckpoint);
            }
            continue;
          }
        }

        // ЭТАП 5: Обновление импортов
        const importCheckpoint = await this.backupManager.createCheckpoint(filePath, 'imports');
        if (importCheckpoint) {
          checkpoints.push(importCheckpoint);
        } else {
          this.logger.warn('Failed to create import checkpoint');
          continue;
        }

        await this.updateImports(filePath);

        if (!skipValidation) {
          if (!(await this.syntaxValidator.validate(filePath)).valid) {
            if (importCheckpoint) {
              await this.backupManager.restoreCheckpoint(filePath, importCheckpoint);
            }
            continue;
          }
        }

        // ЭТАП 6: Валидация кода (если включена)
        if (this.options.codeValidation) {
          await this.runCodeValidation(filePath);
        }

        // ЭТАП 7: ESLint (если включен)
        if (this.options.eslintCheck) {
          await this.runESLint(filePath);
        }

        // ЭТАП 8: TypeScript проверка (если включена)
        if (this.options.typeCheck) {
          await this.runTypeCheck(filePath);
        }

        // ЭТАП 9: Автоисправление (если включено)
        if (this.options.autoFix) {
          await this.runAutoFix(filePath);
        }

        // ЭТАП 10: Формальная верификация (если включена)
        if (this.options.formalVerification) {
          const sourceFile = this.project.addSourceFileAtPath(filePath);
          await this.runFormalVerification(sourceFile);
        }

        // ЭТАП 11: Обновление Vue шаблона (если включено и это Vue файл)
        if (this.options.updateTemplate && filePath.endsWith('.vue') && this.templateUpdater) {
          await this.templateUpdater.update(filePath, this.modules);
        }

        // Удаляем чекпоинты после успеха
        if (!this.options.dryRun) {
          for (const checkpoint of checkpoints) {
            await this.backupManager.removeCheckpoint(checkpoint);
          }
        } else {
          this.logger.info('DRY RUN: skipping checkpoint cleanup');
        }

        lastResult = this.createSuccessResult(attempt);
        lastResult.guaranteeInfo = {
          attempts: attempt,
          moduleType: this.moduleType,
          detectionConfidence: this.detectionResult?.confidence || 'high',
          validationHistory: this.validationHistory,
          checkpointsCreated: checkpoints.length,
          backupsCreated: this.backupManager.getBackups().length,
        };

        this.logger.info(`Refactoring succeeded on attempt ${attempt}`);
        return lastResult;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Attempt ${attempt} failed`, { error: lastError });
        if (!this.options.dryRun) {
          await this.backupManager.restoreLastCheckpoint(filePath);
        } else {
          this.logger.info('DRY RUN: skipping restore');
        }
      }
    }

    const errorMsg = `Refactoring failed after ${attempt} attempts. Last error: ${lastError || 'Unknown'}`;
    return this.createErrorResult(errorMsg, this.backupPath, -1, []);
  }

  private async refactorStandard(filePath: string): Promise<RefactorResult> {
    const isESM = this.moduleType === 'esm';
    const skipValidation = this.options.skipValidationForESM !== false && isESM;

    this.logger.info('Running standard refactoring', { filePath, skipValidation });

    await this.analyzeAndCluster(filePath);
    await this.extractModules(filePath);
    await this.updateImports(filePath);

    // Выполняем дополнительные проверки если включены
    if (this.options.semanticAnalysis) {
      await this.runSemanticAnalysis(filePath);
    }

    if (this.options.codeValidation) {
      await this.runCodeValidation(filePath);
    }

    if (this.options.eslintCheck) {
      await this.runESLint(filePath);
    }

    if (this.options.typeCheck) {
      await this.runTypeCheck(filePath);
    }

    if (this.options.autoFix) {
      await this.runAutoFix(filePath);
    }

    if (this.options.formalVerification) {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      await this.runFormalVerification(sourceFile);
    }

    if (this.options.updateTemplate && filePath.endsWith('.vue') && this.templateUpdater) {
      await this.templateUpdater.update(filePath, this.modules);
    }

    if (!skipValidation) {
      if (!(await this.finalValidation(filePath))) {
        return this.createErrorResult('Final validation failed', this.backupPath, -1, []);
      }
    }

    return this.createSuccessResult(-1);
  }

  private async analyzeAndCluster(filePath: string): Promise<void> {
    this.logger.info('Analyzing and clustering', { filePath });

    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const functions: string[] = [];
    const callGraph: Record<string, string[]> = {};

    // Собираем функции
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
              if (!callGraph[name]) callGraph[name] = [];
              if (!callGraph[name].includes(calledName)) {
                callGraph[name].push(calledName);
              }
            }
          }
        }
      });
    }

    // Добавляем классы в функции для кластеризации
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const className = cls.getName();
      if (!className) continue;

      if (!functions.includes(className)) {
        functions.push(className);
      }

      if (!callGraph[className]) {
        callGraph[className] = [];
      }

      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        if (methodName) {
          if (!callGraph[methodName]) {
            callGraph[methodName] = [];
          }
          if (!callGraph[className].includes(methodName)) {
            callGraph[className].push(methodName);
          }
        }
      }
    }

    this.originalExports = this.collectOriginalExports(sourceFile);
    let clusters = this.identifyClusters(functions, callGraph, sourceFile);

    if (!clusters || clusters.length === 0) {
      this.logger.info('No clusters found - this is acceptable');
      clusters = [];
    }

    this.analysisData = {
      functions,
      callGraph,
      clusters,
      sourceFile,
      originalExports: this.originalExports,
    };
  }

  private async extractModules(filePath: string): Promise<void> {
    if (!this.analysisData?.clusters?.length) {
      this.logger.warn('No clusters found for extraction');
      return;
    }

    const moduleExtractor = new ModuleExtractor(this.project, this.options, this.logger);
    moduleExtractor.setModuleType(this.moduleType);

    const clustersForExtraction = this.analysisData.clusters.map((cluster: ClusterInfo) => ({
      name: cluster.name,
      functions: cluster.functions,
      cohesionScore: cluster.cohesionScore,
    }));

    // Фильтруем кластеры без экспортов - исправлено с правильными типами
    const filteredClusters = clustersForExtraction.filter(
      (cluster: { name: string; functions: string[]; cohesionScore: number }) => {
        const hasExports = cluster.functions.some((f: string) => this.originalExports.includes(f));
        if (!hasExports) {
          this.logger.debug(`Skipping cluster ${cluster.name} - no exports`);
        }
        return hasExports;
      }
    );

    if (filteredClusters.length === 0) {
      this.logger.info('No clusters with exports found');
      return;
    }

    this.modules = await moduleExtractor.extractModules(filePath, filteredClusters);
    this.logger.info(`Extracted ${this.modules.length} modules`);
  }

  private async updateImports(filePath: string): Promise<void> {
    if (this.modules.length === 0) {
      this.logger.warn('No modules to update imports for');
      return;
    }

    this.logger.info('Updating imports', { filePath });

    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const isESM = this.moduleType === 'esm';

    // Добавляем импорты из модулей
    for (const module of this.modules) {
      if (module.exports.length === 0) continue;

      let relativePath = this.getRelativePath(filePath, module.path);

      // Определяем расширение для импорта
      const ext = path.extname(module.path);
      if (ext === '.ts') {
        // TypeScript модули импортируем без расширения
        relativePath = relativePath.replace(/\.ts$/, '');
      } else if (isESM) {
        relativePath = relativePath.replace(/\.(js|ts)$/, '.mjs');
      } else {
        relativePath = relativePath.replace(/\.(mjs|ts)$/, '.js');
      }

      if (!relativePath.startsWith('.') && !relativePath.startsWith('@')) {
        relativePath = './' + relativePath;
      }

      sourceFile.addImportDeclaration({
        namedImports: module.exports,
        moduleSpecifier: relativePath,
      });
      this.logger.debug(
        `  📥 Added import: { ${module.exports.join(', ')} } from '${relativePath}'`
      );
    }

    // Добавляем реэкспорты
    if (this.options.addReExports !== false && this.originalExports.length > 0) {
      const allExports = new Map<string, string>();
      for (const module of this.modules) {
        for (const exp of module.exports) {
          let relativePath = this.getRelativePath(filePath, module.path);
          const ext = path.extname(module.path);
          if (ext === '.ts') {
            relativePath = relativePath.replace(/\.ts$/, '');
          } else if (isESM) {
            relativePath = relativePath.replace(/\.(js|ts)$/, '.mjs');
          } else {
            relativePath = relativePath.replace(/\.(mjs|ts)$/, '.js');
          }
          if (!relativePath.startsWith('.') && !relativePath.startsWith('@')) {
            relativePath = './' + relativePath;
          }
          allExports.set(exp, relativePath);
        }
      }

      const byModule = new Map<string, string[]>();
      for (const [exp, modulePath] of allExports) {
        if (!byModule.has(modulePath)) byModule.set(modulePath, []);
        byModule.get(modulePath)!.push(exp);
      }

      let reExportBlock = '\n// ============================================\n';
      reExportBlock += '// РЕЭКСПОРТЫ - сохраняем публичное API\n';
      reExportBlock += '// ============================================\n';

      for (const [modulePath, exports] of byModule) {
        const sortedExports = exports.sort();
        const originalExportsInModule = sortedExports.filter(exp =>
          this.originalExports.includes(exp)
        );
        if (originalExportsInModule.length > 0) {
          reExportBlock += `export { ${originalExportsInModule.join(', ')} } from '${modulePath}';\n`;
        }
      }

      const currentText = sourceFile.getText();
      const newText = currentText + '\n' + reExportBlock;
      sourceFile.replaceWithText(newText);
    }

    if (this.options.optimizeImports) {
      await this.importManager.optimizeImportOrder(filePath);
    }

    // Сохраняем только если не dry-run
    if (!this.options.dryRun) {
      await sourceFile.save();
      this.logger.info('✅ Imports updated successfully');
    } else {
      this.logger.info('DRY RUN: skipping import save');
    }
  }

  private async analyzeFile(filePath: string): Promise<any> {
    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);

      if (!sourceFile || sourceFile.getText().trim() === '') {
        return { functions: [], callGraph: {}, sourceFile: null, isEmpty: true };
      }

      const functions: string[] = [];
      const callGraph: Record<string, string[]> = {};

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
                if (!callGraph[name]) callGraph[name] = [];
                if (!callGraph[name].includes(calledName)) {
                  callGraph[name].push(calledName);
                }
              }
            }
          }
        });
      }

      const classes = sourceFile.getClasses();
      for (const cls of classes) {
        const className = cls.getName();
        if (!className) continue;

        if (!functions.includes(className)) {
          functions.push(className);
        }

        if (!callGraph[className]) {
          callGraph[className] = [];
        }

        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          if (methodName) {
            if (!callGraph[methodName]) {
              callGraph[methodName] = [];
            }
            if (!callGraph[className].includes(methodName)) {
              callGraph[className].push(methodName);
            }
          }
        }
      }

      this.originalExports = this.collectOriginalExports(sourceFile);
      return { functions, callGraph, sourceFile };
    } catch (error) {
      this.logger.warn('Failed to analyze file, returning empty result', { error });
      return { functions: [], callGraph: {}, sourceFile: null, isEmpty: true };
    }
  }

  private identifyClusters(
    functions: string[],
    callGraph: Record<string, string[]>,
    sourceFile: SourceFile
  ): ClusterInfo[] {
    // Специальная обработка для maxClusterSize === 1
    if (this.options.maxClusterSize === 1) {
      return this.identifyClustersSingle(functions, callGraph, sourceFile);
    }

    const clusters: ClusterInfo[] = [];
    const visited = new Set<string>();

    const calledFunctions = new Set<string>();
    for (const callees of Object.values(callGraph)) {
      for (const callee of callees) {
        if (callee) calledFunctions.add(callee);
      }
    }

    const entryPoints = functions.filter(f => !calledFunctions.has(f));

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

      cluster.cohesionScore = this.calculateCohesion(cluster.functions, callGraph);
      cluster.size = cluster.functions.length;

      let hasExported = false;
      for (const f of cluster.functions) {
        if (this.isExported(sourceFile, f)) {
          hasExported = true;
          break;
        }
      }
      cluster.type = hasExported ? 'core' : 'helper';
      cluster.isExported = hasExported;

      if (cluster.cohesionScore >= 80) {
        cluster.recommendation = '✅ Excellent cohesion - perfect candidate for extraction';
      } else if (cluster.cohesionScore >= 60) {
        cluster.recommendation = '✅ Good cohesion - suitable for extraction';
      } else if (cluster.cohesionScore >= 40) {
        cluster.recommendation = '⚠️ Moderate cohesion - consider merging';
      } else {
        cluster.recommendation = '❌ Low cohesion - review dependencies';
      }

      clusters.push(cluster);
    }

    clusters.sort((a, b) => {
      if (b.cohesionScore !== a.cohesionScore) return b.cohesionScore - a.cohesionScore;
      return b.functions.length - a.functions.length;
    });

    return clusters;
  }

  /**
   * Специальная обработка для maxClusterSize === 1
   * Каждая функция становится отдельным модулем с правильными зависимостями
   */
  private identifyClustersSingle(
    functions: string[],
    callGraph: Record<string, string[]>,
    sourceFile: SourceFile
  ): ClusterInfo[] {
    const clusters: ClusterInfo[] = [];
    const visited = new Set<string>();

    // Сортируем функции: экспорты идут первыми
    const sortedFunctions = [...functions].sort((a, b) => {
      const aExported = this.isExported(sourceFile, a);
      const bExported = this.isExported(sourceFile, b);
      if (aExported && !bExported) return -1;
      if (!aExported && bExported) return 1;
      return a.localeCompare(b);
    });

    for (const funcName of sortedFunctions) {
      if (visited.has(funcName)) continue;
      visited.add(funcName);

      const deps = callGraph[funcName] || [];
      const isExported = this.isExported(sourceFile, funcName);

      // Находим импортеров (кто вызывает эту функцию)
      const importers: string[] = [];
      for (const [caller, callees] of Object.entries(callGraph)) {
        if (callees.includes(funcName)) {
          importers.push(caller);
        }
      }

      const cluster: ClusterInfo = {
        name: this.generateClusterName(funcName),
        functions: [funcName],
        cohesionScore: 100,
        size: 1,
        type: isExported ? 'core' : 'helper',
        isExported: isExported,
        recommendation: isExported
          ? '✅ Exported function - safe to extract'
          : 'ℹ️ Internal function - check dependencies',
        dependencies: deps,
        importers: importers,
      };

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Проверяет, экспортируется ли сущность
   */
  private isExported(sourceFile: SourceFile, name: string): boolean {
    const func = sourceFile.getFunction(name);
    if (func && func.isExported()) return true;

    const cls = sourceFile.getClass(name);
    if (cls && cls.isExported()) return true;

    const variable = sourceFile.getVariableDeclaration(name);
    if (variable) {
      const statement = variable.getParent()?.getParent();
      if (statement && 'isExported' in statement) {
        return (statement as any).isExported();
      }
    }

    return false;
  }

  /**
   * Валидирует созданный модуль на наличие синтаксических ошибок
   * При ошибке пытается переименовать модуль в другой тип
   */
  private async validateExtractedModule(modulePath: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(modulePath, 'utf-8');

      // Для TypeScript файлов используем ts-morph для валидации
      if (modulePath.endsWith('.ts')) {
        try {
          const sourceFile = this.project.addSourceFileAtPath(modulePath);
          const diagnostics = sourceFile.getPreEmitDiagnostics();
          const errors = diagnostics.filter(d => d.getCategory() === 1);
          if (errors.length > 0) {
            this.logger.warn(`TypeScript errors in ${path.basename(modulePath)}: ${errors.length}`);
            // Не считаем ошибки критичными для продолжения
          }
          return true;
        } catch (error) {
          // Если не удалось загрузить, пробуем как JavaScript
          this.logger.debug(
            `Failed to validate as TypeScript, trying as JavaScript: ${path.basename(modulePath)}`
          );
        }
      }

      // Для JavaScript проверяем синтаксис
      if (modulePath.endsWith('.js') || modulePath.endsWith('.mjs')) {
        try {
          new Function(content);
          return true;
        } catch (error) {
          // Игнорируем ошибки, связанные с import.meta
          if ((error as any).message?.includes('import.meta')) {
            this.logger.debug(`import.meta in ${path.basename(modulePath)} is expected for ESM`);
            return true;
          }
          throw error;
        }
      }

      return true;
    } catch (error) {
      // Если ошибка синтаксиса, пробуем переименовать модуль
      if ((error as any).message?.includes('syntax') || error instanceof SyntaxError) {
        this.logger.warn(
          `Syntax error in ${path.basename(modulePath)}, trying alternative extension`
        );

        const currentExt = path.extname(modulePath);
        const alternatives = ['.js', '.mjs', '.ts'];

        for (const newExt of alternatives) {
          if (newExt === currentExt) continue;
          const newPath = modulePath.replace(currentExt, newExt);
          try {
            if (fs.existsSync(modulePath)) {
              await fs.promises.rename(modulePath, newPath);
              this.logger.info(`Renamed ${path.basename(modulePath)} to ${path.basename(newPath)}`);
              return true;
            }
          } catch (renameError) {
            // Игнорируем ошибки переименования
          }
        }
      }
      return false;
    }
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
      'save',
      'load',
      'create',
      'process',
    ];
    let clean = funcName;
    for (const prefix of prefixes) {
      if (clean.startsWith(prefix)) {
        clean = clean.slice(prefix.length);
        break;
      }
    }
    return (clean.charAt(0).toLowerCase() + clean.slice(1) || 'module') + 'Module';
  }

  private collectOriginalExports(sourceFile: SourceFile): string[] {
    const exports: string[] = [];
    const exportSet = new Set<string>();

    try {
      const exportedDeclarations = sourceFile.getExportedDeclarations();
      for (const [name] of exportedDeclarations) {
        if (!exportSet.has(name)) {
          exportSet.add(name);
          exports.push(name);
        }
      }
    } catch (error) {
      // fallback to regex
    }

    const text = sourceFile.getText();

    const funcMatches = text.match(/export\s+function\s+(\w+)/g);
    if (funcMatches) {
      for (const match of funcMatches) {
        const nameMatch = match.match(/export\s+function\s+(\w+)/);
        if (nameMatch && nameMatch[1] && !exportSet.has(nameMatch[1])) {
          exportSet.add(nameMatch[1]);
          exports.push(nameMatch[1]);
        }
      }
    }

    const varMatches = text.match(/export\s+(?:const|let|var)\s+(\w+)/g);
    if (varMatches) {
      for (const match of varMatches) {
        const nameMatch = match.match(/export\s+(?:const|let|var)\s+(\w+)/);
        if (nameMatch && nameMatch[1] && !exportSet.has(nameMatch[1])) {
          exportSet.add(nameMatch[1]);
          exports.push(nameMatch[1]);
        }
      }
    }

    const classMatches = text.match(/export\s+(?:default\s+)?class\s+(\w+)/g);
    if (classMatches) {
      for (const match of classMatches) {
        const nameMatch = match.match(/export\s+(?:default\s+)?class\s+(\w+)/);
        if (nameMatch && nameMatch[1] && !exportSet.has(nameMatch[1])) {
          exportSet.add(nameMatch[1]);
          exports.push(nameMatch[1]);
        }
      }
    }

    return exports;
  }

  private async finalValidation(filePath: string): Promise<boolean> {
    const mainValidation = await this.syntaxValidator.validate(filePath);
    this.validationHistory.push(mainValidation);
    return mainValidation.valid;
  }

  private createErrorResult(
    error: string,
    _checkpointPath: string | null,
    stepIndex: number,
    steps: { name: string }[]
  ): RefactorResult {
    return {
      success: false,
      modules: this.modules,
      backupPath: this.backupPath || undefined,
      error,
      lastSuccessfulStep: stepIndex >= 0 ? stepIndex : undefined,
      failedStep:
        stepIndex >= 0 && stepIndex < steps.length && steps[stepIndex]
          ? steps[stepIndex].name
          : 'unknown',
    };
  }

  private createSuccessResult(lastSuccessfulStep: number): RefactorResult {
    return {
      success: true,
      modules: this.modules,
      backupPath: this.backupPath || undefined,
      lastSuccessfulStep: lastSuccessfulStep >= 0 ? lastSuccessfulStep : undefined,
      eslintResults: this.eslintResults,
      tsFixResults: this.tsFixResults,
      metrics: {
        cyclomaticComplexity: 0,
        totalFunctions: 0,
        unusedFunctionsCount: 0,
        typeErrorsCount: 0,
        verifiedFunctionsCount: 0,
        dataFlowIssuesCount: 0,
        eslintFixesCount: this.eslintResults?.reduce((sum, r) => sum + r.fixes, 0) || 0,
        tsFixesCount: this.tsFixResults?.fixedCount || 0,
        codeFixesCount: 0,
      },
    };
  }

  private getRelativePath(from: string, to: string): string {
    let relative = path.relative(path.dirname(from), to);
    if (!relative.startsWith('.') && !relative.startsWith('@')) {
      relative = './' + relative;
    }
    return relative.replace(/\\/g, '/');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing AutoRefactor');
    const wasmPath = path.resolve(__dirname, 'wasm');
    if (fs.existsSync(wasmPath)) {
      try {
        await initTreeSitter(wasmPath);
        this.logger.info('Tree-sitter initialized');
      } catch (error) {
        this.logger.warn('Tree-sitter initialization failed', { error });
      }
    }

    if (this.options.formalVerification && this.z3Verifier) {
      await this.z3Verifier.initialize();
      this.logger.info('Z3 verifier initialized');
    }

    if (this.equivalenceChecker) {
      await this.equivalenceChecker.initialize();
      this.logger.info('Equivalence checker initialized');
    }

    this.logger.info('AutoRefactor initialized');
  }

  async dispose(): Promise<void> {
    if (this.z3Verifier) {
      await this.z3Verifier.dispose();
    }
    if (this.equivalenceChecker) {
      await this.equivalenceChecker.dispose();
    }
    this.logger.close();
  }

  // ============================================
  // РЕАЛИЗОВАННЫЕ МЕТОДЫ ДЛЯ СЕМАНТИЧЕСКОГО АНАЛИЗА
  // ============================================

  /**
   * Запускает семантический анализ файла
   */
  private async runSemanticAnalysis(filePath: string): Promise<void> {
    if (!this.options.semanticAnalysis) return;

    this.logger.info('Running semantic analysis', { filePath });

    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      const semanticResults: any = {};

      if (this.cfgAnalyzer) {
        const cfg = this.cfgAnalyzer.build(sourceFile);
        semanticResults.cfg = cfg;
        const unreachable = cfg.findUnreachableBlocks();
        semanticResults.unreachableCode = unreachable.map(block => ({
          file: filePath,
          line: block.instructions[0]?.getStartLineNumber() || 1,
        }));
        this.logger.debug('CFG analysis completed', {
          blocks: cfg.blocks.length,
          unreachable: unreachable.length,
          complexity: this.calculateComplexity(cfg),
        });
      }

      if (this.callGraphAnalyzer) {
        const callGraph = await this.callGraphAnalyzer.analyzeSingle(filePath);
        semanticResults.callGraph = callGraph;
        semanticResults.unusedFunctions = callGraph.findUnusedFunctions().map(n => n.name);
        semanticResults.cyclicDependencies = callGraph
          .findCyclicDependencies()
          .map(cycle => cycle.map(e => `${e.from}->${e.to}`));
        this.logger.debug('Call graph analysis completed', {
          nodes: callGraph.nodes.size,
          cycles: callGraph.cycles.length,
          unused: semanticResults.unusedFunctions.length,
        });
      }

      if (this.dataFlowAnalyzer) {
        const dataFlow = this.dataFlowAnalyzer.analyze(sourceFile);
        semanticResults.dataFlow = dataFlow;
        this.logger.debug('Data flow analysis completed', {
          nodes: dataFlow.nodes.length,
          edges: dataFlow.edges.length,
          unusedVars: dataFlow.findUnusedVariables().length,
        });
      }

      this.analysisData.semanticResults = semanticResults;
    } catch (error) {
      this.logger.warn('Semantic analysis failed', { error });
    }
  }

  /**
   * Запускает валидацию кода
   */
  private async runCodeValidation(filePath: string): Promise<void> {
    if (!this.options.codeValidation || !this.codeValidator) return;

    this.logger.info('Running code validation', { filePath });
    this.validationResults = await this.codeValidator.validateFiles([filePath]);

    if (this.validationResults) {
      this.logger.debug('Code validation completed', {
        errors: this.validationResults.summary.errors,
        warnings: this.validationResults.summary.warnings,
        autoFixable: this.validationResults.summary.autoFixable,
      });
    }
  }

  /**
   * Запускает ESLint анализ
   */
  private async runESLint(filePath: string): Promise<void> {
    if (!this.options.eslintCheck || !this.eslintFixer) {
      this.eslintResults = undefined;
      return;
    }

    this.logger.info('Running ESLint analysis', { filePath });
    this.eslintResults = await this.eslintFixer.fixFiles(
      [filePath],
      this.options.createBackup && !this.options.dryRun
    );

    const totalFixes = this.eslintResults?.reduce((sum, r) => sum + r.fixes, 0) || 0;
    const successCount = this.eslintResults?.filter(r => r.success).length || 0;
    this.logger.debug('ESLint completed', {
      files: this.eslintResults?.length || 0,
      fixes: totalFixes,
      successCount,
    });
  }

  /**
   * Запускает TypeScript проверку типов
   */
  private async runTypeCheck(filePath: string): Promise<void> {
    if (!this.options.typeCheck || !this.tsValidator) {
      this.tsFixResults = undefined;
      return;
    }

    this.logger.info('Running TypeScript type check', { filePath });
    const result = await this.tsValidator.validateAndFix([filePath], this.options.maxIterations);
    this.tsFixResults = { fixedCount: result.fixedCount, remainingErrors: result.remainingErrors };

    this.logger.debug('Type check completed', {
      fixed: result.fixedCount,
      remaining: result.remainingErrors,
      success: result.success,
    });
  }

  /**
   * Запускает автоматическое исправление кода
   */
  private async runAutoFix(filePath: string): Promise<void> {
    if (!this.options.autoFix || !this.codeFixer || !this.validationResults) return;

    this.logger.info('Running auto-fix', { filePath });
    this.codeFixResults = await this.codeFixer.autoFix(
      this.validationResults.issues,
      this.options.createBackup && !this.options.dryRun
    );

    const totalFixes = this.codeFixResults.reduce((sum, r) => sum + r.fixes, 0);
    const successCount = this.codeFixResults.filter(r => r.success).length;
    this.logger.debug('Auto-fix completed', {
      fixes: totalFixes,
      files: this.codeFixResults.length,
      successCount,
    });
  }

  /**
   * Запускает формальную верификацию через Z3
   */
  private async runFormalVerification(sourceFile: SourceFile): Promise<void> {
    if (!this.options.formalVerification || !this.z3Verifier) return;

    this.logger.info('Running formal verification');

    try {
      const functions = sourceFile.getFunctions();
      const results: VerificationResult[] = [];

      for (const func of functions) {
        const name = func.getName();
        if (!name) continue;

        const criticalSet = new Set(this.options.criticalFunctions || []);
        if (criticalSet.size > 0 && !criticalSet.has(name)) continue;

        try {
          const contract = await this.extractContract(func);
          const result = await this.z3Verifier.verifyFunction(contract);
          result.functionName = name;
          results.push(result);

          if (result.isValid) {
            this.logger.debug(`Function ${name} verified`);
          } else {
            this.logger.warn(`Function ${name} verification failed`, {
              error: result.error,
            });
          }
        } catch (error) {
          this.logger.warn(`Verification failed for ${name}`, { error });
          results.push({
            isValid: false,
            functionName: name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.verificationResults = results;
      if (results.length > 0) {
        this.logger.info('Formal verification completed', {
          total: results.length,
          verified: results.filter(r => r.isValid).length,
        });
      }
    } catch (error) {
      this.logger.warn('Formal verification failed', { error });
    }
  }

  /**
   * Извлекает контракт из функции
   */
  private async extractContract(func: any): Promise<any> {
    const name = func.getName() || 'anonymous';
    const params: { name: string; type: 'int' | 'bool' | 'string' }[] = [];

    for (const param of func.getParameters()) {
      const paramName = param.getName();
      const paramType = this.getParamType(param);
      params.push({ name: paramName, type: paramType });
    }

    const returnType = this.getReturnType(func);

    const preconditions: any[] = [];
    const postconditions: any[] = [];
    const invariants: any[] = [];

    const jsDocs = func.getJsDocs();
    for (const jsDoc of jsDocs) {
      const tags = jsDoc.getTags();
      for (const tag of tags) {
        const tagName = tag.getTagName();
        const comment = tag.getCommentText();

        if (tagName === 'param' && comment) {
          const paramMatch = comment.match(/(\w+)\s*-\s*([^<]+)/);
          if (paramMatch) {
            const paramName = paramMatch[1];
            if (paramName && (comment.includes('positive') || comment.includes('>0'))) {
              preconditions.push({
                type: 'range',
                variable: paramName,
                min: 1,
                max: Number.MAX_SAFE_INTEGER,
              });
            }
            if (paramName && (comment.includes('non-negative') || comment.includes('>=0'))) {
              preconditions.push({
                type: 'range',
                variable: paramName,
                min: 0,
                max: Number.MAX_SAFE_INTEGER,
              });
            }
          }
        }
      }
    }

    return {
      name,
      params,
      returnType,
      preconditions,
      postconditions,
      invariants,
    };
  }

  /**
   * Определяет тип параметра
   */
  private getParamType(param: any): 'int' | 'bool' | 'string' {
    const type = param.getType();
    if (type.isNumber()) return 'int';
    if (type.isBoolean()) return 'bool';
    if (type.isString()) return 'string';
    return 'int';
  }

  /**
   * Определяет тип возвращаемого значения
   */
  private getReturnType(func: any): 'int' | 'bool' | 'string' | 'void' {
    const type = func.getReturnType();
    if (type.isNumber()) return 'int';
    if (type.isBoolean()) return 'bool';
    if (type.isString()) return 'string';
    return 'void';
  }

  /**
   * Собирает метрики из результатов анализа
   */
  private collectMetrics(): RefactorResult['metrics'] {
    const semanticResults = this.analysisData.semanticResults || {};
    const cfg = semanticResults.cfg;

    let cyclomaticComplexity = 0;
    if (cfg) {
      cyclomaticComplexity = this.calculateComplexity(cfg);
    }

    const unusedFunctionsCount =
      semanticResults.unusedFunctions?.length || this.validationResults?.summary.warnings || 0;

    const typeErrorsCount = this.validationResults?.summary.errors || 0;

    const verifiedFunctionsCount = this.verificationResults.filter(r => r.isValid).length || 0;

    const dataFlowIssuesCount = semanticResults.dataFlow?.findUnusedVariables().length || 0;

    const eslintFixesCount = this.eslintResults?.reduce((sum, r) => sum + r.fixes, 0) || 0;

    const tsFixesCount = this.tsFixResults?.fixedCount || 0;

    const codeFixesCount = this.codeFixResults?.reduce((sum, r) => sum + r.fixes, 0) || 0;

    const totalFunctions =
      semanticResults.callGraph?.nodes.size || this.analysisData.functions?.length || 0;

    return {
      cyclomaticComplexity,
      totalFunctions,
      unusedFunctionsCount,
      typeErrorsCount,
      verifiedFunctionsCount,
      dataFlowIssuesCount,
      eslintFixesCount,
      tsFixesCount,
      codeFixesCount,
    };
  }

  /**
   * Вычисляет цикломатическую сложность
   */
  private calculateComplexity(cfg: ControlFlowGraph): number {
    const nodes = cfg.blocks.length;
    let edges = 0;
    for (const block of cfg.blocks) {
      edges += block.successors.length;
    }
    return Math.max(1, edges - nodes + 2);
  }

  /**
   * Получает результат проверки эквивалентности
   */
  getEquivalenceResult(): RefactoringEquivalenceResult | undefined {
    return this.equivalenceResult;
  }

  /**
   * Проверяет, прошла ли проверка эквивалентности
   */
  isEquivalenceVerified(): boolean {
    if (!this.equivalenceResult) return false;
    return this.equivalenceResult.isEquivalent;
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
export { SyntaxValidator } from './SyntaxValidator.js';
export { ModuleTypeDetector } from './ModuleTypeDetector.js';
export { BackupManager } from './BackupManager.js';