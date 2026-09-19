// src/ci-cd/SemanticPipeline.ts

import type { SourceFile, Node, FunctionDeclaration } from 'ts-morph';
import { Project, SyntaxKind } from 'ts-morph';
import { CFGAnalyzer } from '../semantic/CFGAnalyzer.js';
import { CallGraphAnalyzer } from '../semantic/CallGraphAnalyzer.js';
import { TypeAnalyzer } from '../semantic/TypeAnalyzer.js';
import { DataFlowAnalyzer } from '../semantic/DataFlowAnalyzer.js';
import type { FunctionContract } from '../formal/Z3Verifier.js';
import { Z3Verifier, range } from '../formal/Z3Verifier.js';
import type { JSXAnalysisResult } from '../semantic/JSXAnalyzer.js';
import { JSXAnalyzer } from '../semantic/JSXAnalyzer.js';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { findWasmPath } from '../utils/wasm-utils.js';
import { Logger, LogLevel } from '../utils/Logger.js';

// ============================================
// ТИПЫ
// ============================================

export interface PipelineResult {
  success: boolean;
  metrics: {
    totalFunctions: number;
    totalFiles: number;
    unusedFunctions: number;
    unusedVariables: number;
    potentialBugs: number;
    verifiedFunctions: number;
    cyclomaticComplexity: number;
    dataFlowIssues: number;
    typeErrors: number;
    cyclicDependencies: number;
    unreachableBlocks: number;
  };
  issues: PipelineIssue[];
  verificationResults: VerificationResult[];
  timestamp: string;
  duration: number;
  jsxAnalysis?: JSXAnalysisResult;
  summary?: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export interface PipelineIssue {
  id: string;
  type:
    | 'unused_function'
    | 'unused_variable'
    | 'unreachable_code'
    | 'type_error'
    | 'data_flow'
    | 'cyclic_dependency'
    | 'complexity'
    | 'null_pointer';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  message: string;
  suggestion?: string;
  code?: string;
}

export interface VerificationResult {
  functionName: string;
  file: string;
  isValid: boolean;
  counterexample?: Map<string, any>;
  time: number;
  error?: string;
}

export interface PipelineOptions {
  formalVerification?: boolean;
  maxDepth?: number;
  criticalFunctions?: string[];
  maxComplexity?: number;
  checkNullPointers?: boolean;
  generateReport?: boolean;
  reportFormat?: 'json' | 'html' | 'markdown';
  outputDir?: string;
  failOnWarnings?: boolean;
  wasmPath?: string;
  verbose?: boolean;
  enableCFG?: boolean;
  enableCallGraph?: boolean;
  enableTypeAnalysis?: boolean;
  enableDataFlow?: boolean;
  enableJSX?: boolean;
}

// ============================================
// ОСНОВНОЙ КЛАСС
// ============================================

export class SemanticPipeline {
  private project: Project;
  private cfgAnalyzer: CFGAnalyzer;
  private callGraphAnalyzer: CallGraphAnalyzer;
  private z3Verifier: Z3Verifier;
  private dataFlowAnalyzer: DataFlowAnalyzer;
  private initialized = false;
  private wasmPath: string;
  private logger: Logger;

  constructor(options?: { wasmPath?: string; logLevel?: string }) {
    // Определяем путь к WASM
    if (options?.wasmPath) {
      this.wasmPath = options.wasmPath;
    } else {
      this.wasmPath = findWasmPath();
    }

    this.logger = new Logger(
      options?.logLevel ? this.parseLogLevel(options.logLevel) : LogLevel.INFO,
      './semantic-pipeline.log'
    );

    this.logger.info(`🔧 WASM path: ${this.wasmPath}`);

    this.project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        jsx: 2,
      },
    });

    this.cfgAnalyzer = new CFGAnalyzer();
    this.callGraphAnalyzer = new CallGraphAnalyzer(this.wasmPath);
    this.dataFlowAnalyzer = new DataFlowAnalyzer();
    this.z3Verifier = new Z3Verifier();
  }

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================

  private parseLogLevel(level: string): LogLevel {
    const map: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
      none: LogLevel.NONE,
    };
    return map[level.toLowerCase()] || LogLevel.INFO;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('SemanticPipeline already initialized');
      return;
    }

    this.logger.info('🚀 Initializing Semantic Pipeline...');

    try {
      await this.z3Verifier.initialize();
      this.initialized = true;
      this.logger.info('✅ All components initialized successfully');
    } catch (error) {
      this.logger.error('❌ Initialization failed:', { error: String(error) });
      throw error;
    }
  }

  // ============================================
  // ОСНОВНОЙ МЕТОД RUN
  // ============================================

  async run(filePaths: string[], options: PipelineOptions = {}): Promise<PipelineResult> {
    const startTime = Date.now();

    await this.initialize();

    this.logger.info('\n' + '='.repeat(70));
    this.logger.info('🔬 SEMANTIC ANALYSIS PIPELINE');
    this.logger.info('='.repeat(70));
    this.logger.info(`📁 Files: ${filePaths.length}`);
    this.logger.info(`🔧 Formal verification: ${options.formalVerification ? 'ON' : 'OFF'}`);
    this.logger.info(`📊 Max complexity threshold: ${options.maxComplexity || 10}`);
    this.logger.info(`🎯 Critical functions: ${options.criticalFunctions?.length || 0}\n`);

    const issues: PipelineIssue[] = [];
    const verificationResults: VerificationResult[] = [];
    const jsxResults = new Map<string, JSXAnalysisResult>();

    let totalFunctions = 0;
    let totalFiles = 0;
    let unusedFunctions = 0;
    let unusedVariables = 0;
    let cyclomaticComplexity = 0;
    let typeErrors = 0;
    let cyclicDependencies = 0;
    let unreachableBlocks = 0;

    // Проверяем доступность WASM
    const wasmAvailable =
      fs.existsSync(this.wasmPath) && fs.readdirSync(this.wasmPath).some(f => f.endsWith('.wasm'));

    if (!wasmAvailable) {
      this.logger.warn('⚠️ WASM not available, Call Graph analysis will be skipped');
      this.logger.warn(`   Looking for WASM in: ${this.wasmPath}`);
    }

    // Собираем все файлы для анализа
    const allFiles = await this.collectFiles(filePaths);

    if (allFiles.length === 0) {
      this.logger.error('❌ No files found for analysis');
      return this.createEmptyResult(startTime);
    }

    for (const filePath of allFiles) {
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`⚠️ File not found: ${filePath}`);
        continue;
      }

      this.logger.info(`\n📄 Analyzing: ${path.basename(filePath)}`);
      totalFiles++;

      let sourceFile: SourceFile | undefined;
      try {
        sourceFile = this.project.addSourceFileAtPath(filePath);
        if (!sourceFile) {
          this.logger.error(`  ❌ Failed to load: ${filePath}`);
          continue;
        }
      } catch (error) {
        this.logger.error(`  ❌ Error loading:`, { error: String(error) });
        continue;
      }

      // ============================================
      // 1. JSX/TSX АНАЛИЗ
      // ============================================
      if (options.enableJSX !== false && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))) {
        this.logger.info('  ⚛️ Analyzing JSX/TSX...');

        try {
          const jsxAnalyzer = new JSXAnalyzer(filePath);
          const jsxAnalysis = jsxAnalyzer.analyze(sourceFile);

          jsxResults.set(filePath, jsxAnalysis);

          for (const error of jsxAnalysis.propTypeErrors) {
            issues.push({
              id: `jsx_${Date.now()}_${Math.random()}`,
              type: 'type_error',
              severity: 'error',
              file: filePath,
              line: error.location.line,
              column: error.location.column,
              message: error.message,
              suggestion: 'Check prop types for component',
            });
          }

          this.logger.info(`     📊 JSX elements: ${jsxAnalysis.elements.length}`);
          this.logger.info(`     🧩 Components: ${jsxAnalysis.componentProps.size}`);

          if (jsxAnalysis.missingImports.length > 0) {
            this.logger.info(`     ⚠️ Missing imports: ${jsxAnalysis.missingImports.join(', ')}`);
          }
        } catch (error) {
          this.logger.warn(`     ⚠️ JSX analysis failed:`, { error: String(error) });
        }
      }

      // ============================================
      // 2. CFG АНАЛИЗ (Control Flow Graph)
      // ============================================
      if (options.enableCFG !== false) {
        this.logger.info('  🔀 Building Control Flow Graph...');
        try {
          const cfg = this.cfgAnalyzer.build(sourceFile);
          const unreachable = cfg.findUnreachableBlocks();

          for (const block of unreachable) {
            const firstInst = block.instructions[0];
            if (firstInst) {
              issues.push({
                id: `unreachable_${Date.now()}_${Math.random()}`,
                type: 'unreachable_code',
                severity: 'warning',
                file: filePath,
                line: firstInst.getStartLineNumber(),
                column: firstInst.getStartLinePos(),
                message: 'Unreachable code detected',
                suggestion:
                  'Remove or refactor this code block, or check the condition that makes it unreachable',
              });
            }
            unreachableBlocks++;
          }

          const complexity = this.calculateComplexity(cfg);
          cyclomaticComplexity += complexity;

          if (complexity > (options.maxComplexity || 10)) {
            issues.push({
              id: `complexity_${Date.now()}_${Math.random()}`,
              type: 'complexity',
              severity: 'warning',
              file: filePath,
              line: 1,
              column: 1,
              message: `High cyclomatic complexity: ${complexity} (threshold: ${options.maxComplexity || 10})`,
              suggestion:
                'Consider breaking down the function into smaller, more focused functions',
            });
          }
        } catch (error) {
          this.logger.warn(`  ❌ CFG analysis failed:`, { error: String(error) });
        }
      }

      // ============================================
      // 3. CALL GRAPH АНАЛИЗ
      // ============================================
      if (options.enableCallGraph !== false && wasmAvailable) {
        this.logger.info('  🕸️ Building Call Graph...');
        try {
          const callGraph = await this.callGraphAnalyzer.analyze(filePath, options.maxDepth || 10);
          const unused = callGraph.findUnusedFunctions();
          const cycles = callGraph.findCyclicDependencies();

          totalFunctions += callGraph.nodes.size;
          unusedFunctions += unused.length;

          for (const func of unused) {
            issues.push({
              id: `unused_func_${Date.now()}_${Math.random()}`,
              type: 'unused_function',
              severity: 'warning',
              file: func.file,
              line: func.line,
              column: func.column,
              message: `Function '${func.name}' is never used`,
              suggestion: func.isExported
                ? 'Remove export or use the function elsewhere'
                : 'Remove the function or add a reference',
              code: func.name,
            });
          }

          for (const cycle of cycles) {
            cyclicDependencies++;
            const cycleStr = cycle.map(e => `${e.from} → ${e.to}`).join(' → ');
            issues.push({
              id: `cycle_${Date.now()}_${Math.random()}`,
              type: 'cyclic_dependency',
              severity: 'error',
              file: filePath,
              line: 1,
              column: 1,
              message: `Cyclic dependency detected: ${cycleStr}`,
              suggestion:
                'Refactor to break the cycle using dependency inversion, extract common code, or use event emitters',
            });
          }

          // JSX компонент зависимости
          try {
            const rootDir = path.dirname(filePath);
            const jsxDeps = await this.callGraphAnalyzer.analyzeAllJSXComponents(rootDir);
            if (jsxDeps.size > 0) {
              this.logger.info(`     📦 JSX component dependencies: ${jsxDeps.size}`);
              for (const [component, deps] of jsxDeps) {
                this.logger.info(`       ${component} → ${deps.join(', ')}`);
              }
            }
          } catch (jsxError) {
            this.logger.warn('     ⚠️ JSX analysis error:', { error: String(jsxError) });
          }
        } catch (error) {
          this.logger.warn(`  ❌ Call graph analysis failed:`, { error: String(error) });
        }
      } else if (options.enableCallGraph !== false && !wasmAvailable) {
        this.logger.info('  ⏭️ Call Graph analysis skipped (WASM not available)');
      }

      // ============================================
      // 4. TYPE АНАЛИЗ
      // ============================================
      if (options.enableTypeAnalysis !== false) {
        this.logger.info('  📝 Analyzing Types...');
        try {
          const typeAnalyzer = new TypeAnalyzer(filePath);
          const typeAnalysis = typeAnalyzer.analyze();
          const errors = typeAnalysis.findTypeErrors();

          typeErrors += errors.length;

          for (const error of errors) {
            issues.push({
              id: `type_${Date.now()}_${Math.random()}`,
              type: 'type_error',
              severity: 'error',
              file: filePath,
              line: error.location.line,
              column: error.location.column,
              message: `Type mismatch: ${error.message}`,
              suggestion: `Change type to '${error.expected}' or use type assertion 'as ${error.expected}'`,
              code: `Expected: ${error.expected}, Got: ${error.actual}`,
            });
          }
        } catch (error) {
          this.logger.warn(`  ❌ Type analysis failed:`, { error: String(error) });
        }
      }

      // ============================================
      // 5. DATA FLOW АНАЛИЗ
      // ============================================
      if (options.enableDataFlow !== false) {
        this.logger.info('  🌊 Analyzing Data Flow...');
        try {
          const dataFlow = this.dataFlowAnalyzer.analyze(sourceFile);
          const unusedVars = dataFlow.findUnusedVariables();
          const reassignedConsts = dataFlow.findReassignedConstants();

          unusedVariables += unusedVars.length;

          for (const varNode of unusedVars) {
            issues.push({
              id: `unused_var_${Date.now()}_${Math.random()}`,
              type: 'unused_variable',
              severity: 'info',
              file: filePath,
              line: varNode.line,
              column: varNode.column,
              message: `Variable '${varNode.name}' is declared but never used`,
              suggestion: 'Remove the variable or use it in the code',
              code: varNode.name,
            });
          }

          for (const constNode of reassignedConsts) {
            issues.push({
              id: `reassign_${Date.now()}_${Math.random()}`,
              type: 'data_flow',
              severity: 'error',
              file: filePath,
              line: constNode.line,
              column: constNode.column,
              message: `Constant '${constNode.name}' is reassigned`,
              suggestion: "Use 'let' instead of 'const' or remove the reassignment",
              code: constNode.name,
            });
          }

          if (options.checkNullPointers) {
            const nullIssues = await this.checkNullPointers(sourceFile);
            for (const issue of nullIssues) {
              issues.push(issue);
            }
          }
        } catch (error) {
          this.logger.warn(`  ❌ Data flow analysis failed:`, { error: String(error) });
        }
      }

      // ============================================
      // 6. ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ
      // ============================================
      if (options.formalVerification) {
        this.logger.info('  🔬 Running Formal Verification...');

        const functions = sourceFile.getFunctions();
        const criticalSet = new Set(options.criticalFunctions || []);

        for (const func of functions) {
          const funcName = func.getName();
          if (!funcName) continue;

          if (criticalSet.size === 0 || criticalSet.has(funcName)) {
            try {
              const contract = await this.extractContract(func);
              const result = await this.z3Verifier.verifyFunction(contract);

              verificationResults.push({
                functionName: funcName,
                file: filePath,
                isValid: result.isValid,
                counterexample: result.counterexample,
                time: result.time || 0,
                error: result.error,
              });

              if (!result.isValid) {
                issues.push({
                  id: `verification_${Date.now()}_${Math.random()}`,
                  type: 'type_error',
                  severity: 'error',
                  file: filePath,
                  line: func.getStartLineNumber(),
                  column: func.getStartLinePos(),
                  message: `Formal verification failed for '${funcName}'`,
                  suggestion: result.counterexample
                    ? `Counterexample found: ${JSON.stringify(Object.fromEntries(result.counterexample))}`
                    : 'Check function logic, preconditions, postconditions, and loop invariants',
                  code: result.error,
                });
              } else {
                this.logger.info(`    ✅ ${funcName} verified (${result.time}ms)`);
              }
            } catch (error) {
              this.logger.error(`    ❌ Verification failed for ${funcName}:`, { error: String(error) });
            }
          }
        }
      }
    }

    // ============================================
    // 7. ИТОГИ
    // ============================================

    const duration = Date.now() - startTime;
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;
    const success = errorCount === 0 && (!options.failOnWarnings || warningCount === 0);

    const metrics = {
      totalFunctions,
      totalFiles,
      unusedFunctions,
      unusedVariables,
      potentialBugs: issues.length,
      verifiedFunctions: verificationResults.filter(r => r.isValid).length,
      cyclomaticComplexity,
      dataFlowIssues: issues.filter(i => i.type === 'data_flow').length,
      typeErrors,
      cyclicDependencies,
      unreachableBlocks,
    };

    const result: PipelineResult = {
      success,
      metrics,
      issues,
      verificationResults,
      timestamp: new Date().toISOString(),
      duration,
      jsxAnalysis: jsxResults.size > 0 ? Array.from(jsxResults.values())[0] : undefined,
      summary: {
        errors: errorCount,
        warnings: warningCount,
        info: infoCount,
      },
    };

    this.printReport(result);

    if (options.generateReport !== false) {
      const format = options.reportFormat || 'html';
      const outputDir = options.outputDir || './semantic-reports';
      await this.saveReport(result, format, outputDir);
    }

    await this.z3Verifier.dispose();

    return result;
  }

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================

  private async collectFiles(paths: string[]): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];

    for (const inputPath of paths) {
      const resolvedPath = path.resolve(inputPath);

      if (!fs.existsSync(resolvedPath)) {
        this.logger.warn(`⚠️ Path does not exist: ${inputPath}`);
        continue;
      }

      const stat = fs.statSync(resolvedPath);

      if (stat.isFile()) {
        if (extensions.includes(path.extname(resolvedPath))) {
          files.push(resolvedPath);
        }
      } else if (stat.isDirectory()) {
        const pattern = `${resolvedPath}/**/*{${extensions.join(',')}}`;
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
        files.push(...matched);
      }
    }

    return [...new Set(files)];
  }

  private createEmptyResult(startTime: number): PipelineResult {
    return {
      success: false,
      metrics: {
        totalFunctions: 0,
        totalFiles: 0,
        unusedFunctions: 0,
        unusedVariables: 0,
        potentialBugs: 0,
        verifiedFunctions: 0,
        cyclomaticComplexity: 0,
        dataFlowIssues: 0,
        typeErrors: 0,
        cyclicDependencies: 0,
        unreachableBlocks: 0,
      },
      issues: [],
      verificationResults: [],
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  }

  private async extractContract(func: FunctionDeclaration): Promise<FunctionContract> {
    const name = func.getName() || 'anonymous';
    const params: { name: string; type: 'int' | 'bool' | 'string' }[] = [];

    for (const param of func.getParameters()) {
      const paramName = param.getName();
      const paramType = param.getType();

      let type: 'int' | 'bool' | 'string' = 'int';
      if (paramType.isString()) type = 'string';
      else if (paramType.isBoolean()) type = 'bool';

      params.push({ name: paramName, type });
    }

    const returnType = func.getReturnType();
    let retType: 'int' | 'bool' | 'string' | 'void' = 'void';
    if (returnType.isString()) retType = 'string';
    else if (returnType.isBoolean()) retType = 'bool';
    else if (returnType.isNumber()) retType = 'int';

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
              preconditions.push(range(paramName, 1, Number.MAX_SAFE_INTEGER));
            }
            if (paramName && (comment.includes('non-negative') || comment.includes('>=0'))) {
              preconditions.push(range(paramName, 0, Number.MAX_SAFE_INTEGER));
            }
          }
        }

        if (tagName === 'returns' && comment) {
          if (comment.includes('positive')) {
            postconditions.push(range('result', 1, Number.MAX_SAFE_INTEGER));
          }
          if (comment.includes('non-negative')) {
            postconditions.push(range('result', 0, Number.MAX_SAFE_INTEGER));
          }
        }
      }
    }

    if (retType !== 'void') {
      if (retType === 'int') {
        postconditions.push(range('result', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
      }
    }

    return {
      name,
      params,
      returnType: retType,
      preconditions,
      postconditions,
      invariants,
    };
  }

  private async checkNullPointers(sourceFile: SourceFile): Promise<PipelineIssue[]> {
    const issues: PipelineIssue[] = [];

    const functions = sourceFile.getFunctions();

    for (const func of functions) {
      const body = func.getBody();
      if (!body) continue;

      const propertyAccesses = body.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);

      for (const access of propertyAccesses) {
        const expression = access.getExpression();
        const exprText = expression.getText();

        const hasNullCheck = this.hasNullCheckBefore(access, sourceFile);

        if (!hasNullCheck) {
          issues.push({
            id: `null_${Date.now()}_${Math.random()}`,
            type: 'null_pointer',
            severity: 'warning',
            file: sourceFile.getFilePath(),
            line: access.getStartLineNumber(),
            column: access.getStartLinePos(),
            message: `Possible null/undefined access: '${exprText}'`,
            suggestion: `Add null check: if (${exprText} !== null && ${exprText} !== undefined)`,
          });
        }
      }
    }

    return issues;
  }

  private hasNullCheckBefore(node: Node, sourceFile: SourceFile): boolean {
    const parent = node.getParent();
    if (!parent) return false;

    const text = sourceFile.getText();
    const nodeStart = node.getStart();

    const beforeText = text.substring(Math.max(0, nodeStart - 500), nodeStart);

    const patterns = [
      /if\s*\(\s*(\w+)\s*!==\s*null\s*\)/g,
      /if\s*\(\s*(\w+)\s*&&\s*\1\./g,
      /(\w+)\?\./g,
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(beforeText);
      if (match) return true;
    }

    return false;
  }

  private calculateComplexity(cfg: any): number {
    const nodes = cfg.blocks.length;
    const edges = cfg.blocks.reduce((sum: number, block: any) => sum + block.successors.length, 0);
    return Math.max(1, edges - nodes + 2);
  }

  // ============================================
  // ОТЧЕТЫ
  // ============================================

  private printReport(result: PipelineResult): void {
    const { logger } = this;

    logger.info('\n' + '='.repeat(70));
    logger.info('📊 SEMANTIC ANALYSIS REPORT');
    logger.info('='.repeat(70));

    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? 'PASSED' : 'FAILED';
    logger.info(`${statusIcon} Status: ${statusText}`);
    logger.info(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    logger.info(`📅 Timestamp: ${new Date(result.timestamp).toLocaleString()}`);

    logger.info('\n📈 Metrics:');
    logger.info(`   • Total files analyzed: ${result.metrics.totalFiles}`);
    logger.info(`   • Total functions: ${result.metrics.totalFunctions}`);
    logger.info(`   • Unused functions: ${result.metrics.unusedFunctions}`);
    logger.info(`   • Unused variables: ${result.metrics.unusedVariables}`);
    logger.info(`   • Cyclomatic complexity (total): ${result.metrics.cyclomaticComplexity}`);
    logger.info(`   • Type errors: ${result.metrics.typeErrors}`);
    logger.info(`   • Cyclic dependencies: ${result.metrics.cyclicDependencies}`);
    logger.info(`   • Unreachable blocks: ${result.metrics.unreachableBlocks}`);
    logger.info(
      `   • Verified functions: ${result.metrics.verifiedFunctions}/${result.verificationResults.length}`
    );

    if (result.jsxAnalysis) {
      logger.info('\n⚛️ JSX/TSX Statistics:');
      logger.info(`   • JSX elements: ${result.jsxAnalysis.elements.length}`);
      logger.info(`   • Components: ${result.jsxAnalysis.componentProps.size}`);
      logger.info(`   • Prop type errors: ${result.jsxAnalysis.propTypeErrors.length}`);
    }

    const errorCount = result.issues.filter(i => i.severity === 'error').length;
    const warningCount = result.issues.filter(i => i.severity === 'warning').length;
    const infoCount = result.issues.filter(i => i.severity === 'info').length;

    logger.info('\n⚠️ Issues Summary:');
    logger.info(`   • Errors: ${errorCount}`);
    logger.info(`   • Warnings: ${warningCount}`);
    logger.info(`   • Info: ${infoCount}`);

    if (errorCount > 0) {
      logger.info('\n🔴 Top Errors (first 10):');
      for (const error of result.issues.slice(0, 10)) {
        const fileName = path.basename(error.file);
        logger.info(`   • ${fileName}:${error.line} - ${error.message}`);
        if (error.suggestion) {
          logger.info(`     💡 ${error.suggestion}`);
        }
      }
      if (errorCount > 10) {
        logger.info(`   ... and ${errorCount - 10} more errors`);
      }
    }

    if (warningCount > 0 && result.success) {
      logger.info('\n🟡 Warnings (first 5):');
      for (const warning of result.issues.slice(0, 5)) {
        const fileName = path.basename(warning.file);
        logger.info(`   • ${fileName}:${warning.line} - ${warning.message}`);
      }
      if (warningCount > 5) {
        logger.info(`   ... and ${warningCount - 5} more warnings`);
      }
    }

    if (result.verificationResults.length > 0) {
      const verified = result.verificationResults.filter(r => r.isValid);
      const failed = result.verificationResults.filter(r => !r.isValid);

      logger.info('\n🔬 Formal Verification Results:');
      logger.info(`   • Verified: ${verified.length}`);
      logger.info(`   • Failed: ${failed.length}`);

      if (failed.length > 0) {
        logger.info('\n   Failed functions:');
        for (const fail of failed.slice(0, 5)) {
          logger.info(`   • ${fail.functionName} (${fail.file})`);
          if (fail.counterexample) {
            logger.info(
              `     Counterexample: ${JSON.stringify(Object.fromEntries(fail.counterexample))}`
            );
          }
        }
      }
    }

    logger.info('\n' + '='.repeat(70));

    if (result.success) {
      logger.info('✨ PIPELINE COMPLETED SUCCESSFULLY');
    } else {
      logger.info('❌ PIPELINE FAILED - Please fix the errors above');
    }
    logger.info('='.repeat(70) + '\n');
  }

  private async saveReport(
    result: PipelineResult,
    format: 'json' | 'html' | 'markdown',
    outputDir: string
  ): Promise<void> {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `semantic-report-${timestamp}`;

    if (format === 'json' || format === 'html') {
      const jsonPath = path.join(outputDir, `${baseName}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      this.logger.info(`📄 JSON report saved: ${jsonPath}`);
    }

    if (format === 'html') {
      const htmlPath = path.join(outputDir, `${baseName}.html`);
      fs.writeFileSync(htmlPath, this.generateHTMLReport(result));
      this.logger.info(`📊 HTML report saved: ${htmlPath}`);
    }

    if (format === 'markdown') {
      const mdPath = path.join(outputDir, `${baseName}.md`);
      fs.writeFileSync(mdPath, this.generateMarkdownReport(result));
      this.logger.info(`📝 Markdown report saved: ${mdPath}`);
    }
  }

  private generateHTMLReport(result: PipelineResult): string {
    // const errorCount = result.issues.filter(i => i.severity === 'error').length;
    // const warningCount = result.issues.filter(i => i.severity === 'warning').length;
    // const infoCount = result.issues.filter(i => i.severity === 'info').length;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Semantic Analysis Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 40px;
    }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .timestamp { opacity: 0.9; font-size: 14px; margin-bottom: 15px; }
    .status {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }
    .status.passed { background: #4caf50; color: white; }
    .status.failed { background: #f44336; color: white; }
    .duration {
      display: inline-block;
      margin-left: 15px;
      padding: 6px 14px;
      background: rgba(255,255,255,0.2);
      border-radius: 20px;
      font-size: 14px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 20px;
      padding: 30px 40px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .metric-card:hover { transform: translateY(-2px); }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .metric-value.error { color: #f44336; }
    .metric-value.warning { color: #ff9800; }
    .metric-value.success { color: #4caf50; }
    .metric-label { color: #6c757d; font-size: 13px; }
    .content { padding: 30px 40px; }
    .section { margin-bottom: 30px; }
    .section h2 {
      font-size: 20px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e9ecef;
    }
    .issues-list { margin-top: 15px; }
    .issue {
      padding: 15px;
      margin: 10px 0;
      border-left: 4px solid;
      border-radius: 8px;
      background: #f8f9fa;
    }
    .issue.error { border-left-color: #f44336; background: #ffebee; }
    .issue.warning { border-left-color: #ff9800; background: #fff3e0; }
    .issue.info { border-left-color: #2196f3; background: #e3f2fd; }
    .issue-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .issue-type {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }
    .issue-location {
      font-family: monospace;
      font-size: 11px;
      color: #666;
    }
    .issue-message { margin: 8px 0; font-size: 14px; }
    .issue-suggestion {
      margin-top: 8px;
      padding: 8px;
      background: rgba(76, 175, 80, 0.1);
      border-radius: 6px;
      font-size: 12px;
      color: #2e7d32;
    }
    .issue-code {
      margin-top: 8px;
      padding: 8px;
      background: #263238;
      color: #a5d6a7;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      overflow-x: auto;
    }
    .jsx-section {
      background: #f3e5f5;
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }
    .jsx-section h3 { color: #7b1fa2; margin-bottom: 10px; }
    .verification-results { margin-top: 20px; }
    .verification-item {
      padding: 10px 15px;
      margin: 5px 0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .verification-item.valid { background: #e8f5e9; }
    .verification-item.invalid { background: #ffebee; }
    .verification-icon { font-size: 20px; }
    .verification-name { font-weight: 600; flex: 1; }
    .verification-time { font-size: 12px; color: #666; }
    .footer {
      padding: 20px 40px;
      background: #f8f9fa;
      text-align: center;
      color: #6c757d;
      font-size: 12px;
      border-top: 1px solid #e9ecef;
    }
    @media (max-width: 768px) {
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .content { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔬 Semantic Analysis Report</h1>
      <div class="timestamp">${new Date(result.timestamp).toLocaleString()}</div>
      <div>
        <span class="status ${result.success ? 'passed' : 'failed'}">
          ${result.success ? '✓ PASSED' : '✗ FAILED'}
        </span>
        <span class="duration">⏱️ ${(result.duration / 1000).toFixed(2)}s</span>
      </div>
    </div>
    
    <div class="metrics">
      <div class="metric-card">
        <div class="metric-value">${result.metrics.totalFiles}</div>
        <div class="metric-label">Files Analyzed</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${result.metrics.totalFunctions}</div>
        <div class="metric-label">Functions</div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${result.metrics.unusedFunctions > 0 ? 'warning' : 'success'}">
          ${result.metrics.unusedFunctions}
        </div>
        <div class="metric-label">Unused Functions</div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${result.metrics.typeErrors > 0 ? 'error' : 'success'}">
          ${result.metrics.typeErrors}
        </div>
        <div class="metric-label">Type Errors</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${result.metrics.cyclomaticComplexity}</div>
        <div class="metric-label">Cyclomatic Complexity</div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${result.metrics.cyclicDependencies > 0 ? 'error' : 'success'}">
          ${result.metrics.cyclicDependencies}
        </div>
        <div class="metric-label">Cyclic Dependencies</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${result.metrics.verifiedFunctions}</div>
        <div class="metric-label">Verified Functions</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${result.issues.length}</div>
        <div class="metric-label">Total Issues</div>
      </div>
    </div>
    
    <div class="content">
      ${
      result.jsxAnalysis && result.jsxAnalysis.elements.length > 0
        ? `
      <div class="jsx-section">
        <h3>⚛️ JSX/TSX Analysis</h3>
        <p><strong>Elements:</strong> ${result.jsxAnalysis.elements.length}</p>
        <p><strong>Components:</strong> ${result.jsxAnalysis.componentProps.size}</p>
        <p><strong>Prop Errors:</strong> ${result.jsxAnalysis.propTypeErrors.length}</p>
      </div>
      `
        : ''
    }
      
      <div class="section">
        <h2>⚠️ Issues (${result.issues.length})</h2>
        <div class="issues-list">
          ${result.issues
      .slice(0, 50)
      .map(
        issue => `
            <div class="issue ${issue.severity}">
              <div class="issue-header">
                <span class="issue-type">${issue.type}</span>
                <span class="issue-location">${issue.file}:${issue.line}</span>
              </div>
              <div class="issue-message">${this.escapeHtml(issue.message)}</div>
              ${issue.suggestion ? `<div class="issue-suggestion">💡 ${this.escapeHtml(issue.suggestion)}</div>` : ''}
              ${issue.code ? `<div class="issue-code">${this.escapeHtml(issue.code)}</div>` : ''}
            </div>
          `
      )
      .join('')}
          ${result.issues.length > 50 ? `<p style="margin-top: 15px; text-align: center;">... and ${result.issues.length - 50} more issues</p>` : ''}
        </div>
      </div>
      
      ${
      result.verificationResults.length > 0
        ? `
      <div class="section">
        <h2>🔬 Formal Verification (${result.verificationResults.length})</h2>
        <div class="verification-results">
          ${result.verificationResults
          .map(
            vr => `
            <div class="verification-item ${vr.isValid ? 'valid' : 'invalid'}">
              <div class="verification-icon">${vr.isValid ? '✅' : '❌'}</div>
              <div class="verification-name">${vr.functionName}</div>
              <div class="verification-time">${vr.time}ms</div>
            </div>
          `
          )
          .join('')}
        </div>
      </div>
      `
        : ''
    }
    </div>
    
    <div class="footer">
      <p>Generated by AST Analyzer Semantic Pipeline v3.0.0</p>
      <p>Powered by ts-morph, @codeflow-map, @jitl/ts-simple-type, @hpcc-js/dataflow, Z3</p>
    </div>
  </div>
</body>
</html>`;
  }

  private generateMarkdownReport(result: PipelineResult): string {
    let md = '# 🔬 Semantic Analysis Report\n\n';
    md += `**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`;
    md += `**Timestamp:** ${new Date(result.timestamp).toLocaleString()}\n`;
    md += `**Duration:** ${(result.duration / 1000).toFixed(2)}s\n\n`;

    md += '## 📈 Metrics\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    md += `| Files Analyzed | ${result.metrics.totalFiles} |\n`;
    md += `| Total Functions | ${result.metrics.totalFunctions} |\n`;
    md += `| Unused Functions | ${result.metrics.unusedFunctions} |\n`;
    md += `| Unused Variables | ${result.metrics.unusedVariables} |\n`;
    md += `| Type Errors | ${result.metrics.typeErrors} |\n`;
    md += `| Cyclic Dependencies | ${result.metrics.cyclicDependencies} |\n`;
    md += `| Cyclomatic Complexity | ${result.metrics.cyclomaticComplexity} |\n`;
    md += `| Verified Functions | ${result.metrics.verifiedFunctions} |\n`;
    md += `| Total Issues | ${result.issues.length} |\n\n`;

    if (result.jsxAnalysis && result.jsxAnalysis.elements.length > 0) {
      md += '## ⚛️ JSX/TSX Analysis\n\n';
      md += '| Metric | Value |\n';
      md += '|--------|-------|\n';
      md += `| JSX Elements | ${result.jsxAnalysis.elements.length} |\n`;
      md += `| Components | ${result.jsxAnalysis.componentProps.size} |\n`;
      md += `| Prop Type Errors | ${result.jsxAnalysis.propTypeErrors.length} |\n\n`;
    }

    md += '## ⚠️ Issues\n\n';
    const byFile = new Map<string, PipelineIssue[]>();
    for (const issue of result.issues) {
      if (!byFile.has(issue.file)) byFile.set(issue.file, []);
      byFile.get(issue.file)!.push(issue);
    }

    for (const [file, issues] of byFile) {
      md += `### 📄 ${path.basename(file)}\n\n`;
      md += '| Type | Line | Message | Severity |\n';
      md += '|------|------|---------|----------|\n';
      for (const issue of issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        md += `| ${icon} ${issue.type} | ${issue.line} | ${issue.message} | ${issue.severity} |\n`;
      }
      md += '\n';
    }

    if (result.verificationResults.length > 0) {
      md += '## 🔬 Formal Verification\n\n';
      md += '| Function | Status | Time |\n';
      md += '|----------|--------|------|\n';
      for (const vr of result.verificationResults) {
        md += `| ${vr.functionName} | ${vr.isValid ? '✅ Verified' : '❌ Failed'} | ${vr.time}ms |\n`;
      }
      md += '\n';
    }

    return md;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================
  // ДИСПОЗИЦИЯ
  // ============================================

  async dispose(): Promise<void> {
    await this.z3Verifier.dispose();
    this.logger.close();
    this.initialized = false;
    this.logger.info('✅ SemanticPipeline disposed');
  }
}

// ============================================
// УТИЛИТНАЯ ФУНКЦИЯ ДЛЯ ЗАПУСКА
// ============================================

export async function runSemanticPipeline(
  paths: string[],
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const pipeline = new SemanticPipeline({ wasmPath: options.wasmPath });

  const files: string[] = [];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (
        stat.isFile() &&
        (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx'))
      ) {
        files.push(path.resolve(p));
      } else if (stat.isDirectory()) {
        const pattern = `${p}/**/*.{ts,tsx,js,jsx}`;
        const matched = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        });
        files.push(...matched.map(f => path.resolve(f)));
      }
    }
  }

  if (files.length === 0) {
    console.error('❌ No files found to analyze');
    return {
      success: false,
      metrics: {
        totalFunctions: 0,
        totalFiles: 0,
        unusedFunctions: 0,
        unusedVariables: 0,
        potentialBugs: 0,
        verifiedFunctions: 0,
        cyclomaticComplexity: 0,
        dataFlowIssues: 0,
        typeErrors: 0,
        cyclicDependencies: 0,
        unreachableBlocks: 0,
      },
      issues: [],
      verificationResults: [],
      timestamp: new Date().toISOString(),
      duration: 0,
    };
  }

  return pipeline.run(files, options);
}

export default SemanticPipeline;
