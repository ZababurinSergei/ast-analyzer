// packages/ast-analyzer/src/refactor/types.ts
import type { Node } from 'ts-morph';
import type { ControlFlowGraph } from '../semantic/CFGAnalyzer.js';
import type { CallGraph } from '../semantic/CallGraphAnalyzer.js';
import type { DataFlowGraph } from '../semantic/DataFlowAnalyzer.js';
import type { TypeError } from '../semantic/TypeAnalyzer.js';
import type { VerificationResult, RefactoringEquivalenceResult } from '../formal/index.js';
import type { ESLintFixResult } from './ESLintASTFixer.js';
import type { ValidationResult } from './CodeValidator.js';
import type { FixResult } from './CodeFixer.js';
import type { ModuleType } from './ModuleTypeDetector.js';
import type { ValidationResult as SyntaxValidationResult } from './SyntaxValidator.js';

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
  wasmPath?: string;
  excludePatterns?: string[];
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
