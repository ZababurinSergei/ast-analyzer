// types.ts - Все TypeScript интерфейсы и типы для graph-analyzer

// ==========================================
// КОНФИГУРАЦИОННЫЕ ТИПЫ
// ==========================================

export interface AnalyzerConfig {
  ignoreNodeModules: boolean;
  supportedExtensions: string[];
  defaultExcludePatterns: string[];
  vueScriptPattern: RegExp;
}

// ==========================================
// ТИПЫ ДЛЯ ПАРСИНГА И АНАЛИЗА ФАЙЛОВ
// ==========================================

export interface Location {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export interface ImportSpecifier {
  local: string;
  imported: string;
  type: string;
}

export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  loc: Location | null;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'constant' | 'value';
  isDefault?: boolean;
  loc: Location | null;
  params?: string[];
  async?: boolean;
  startLine?: number;
  endLine?: number;
}

export interface FunctionInfo {
  name: string;
  type: 'function';
  exported: boolean;
  loc: Location | null;
  params: string[];
  async: boolean;
  startLine: number;
  endLine: number;
  callCount?: number;
}

export interface ClassMethodInfo {
  name: string;
  kind: 'method' | 'get' | 'set' | 'constructor';
  static: boolean;
  loc: Location | null;
}

export interface ClassInfo {
  name: string;
  exported: boolean;
  loc: Location | null;
  methods: ClassMethodInfo[];
  startLine: number;
  endLine: number;
}

export interface ConstantInfo {
  name: string;
  type: 'constant';
  loc: Location | null;
  startLine: number;
  endLine: number;
}

export interface InterfaceInfo {
  name: string;
  exported: boolean;
  loc: Location | null;
  members: number;
  startLine: number;
  endLine: number;
}

export interface TypeInfo {
  name: string;
  exported: boolean;
  loc: Location | null;
}

export interface AnalysisStats {
  totalLines: number;
  totalExports: number;
  totalFunctions: number;
  totalClasses: number;
  totalConstants: number;
  totalInterfaces: number;
  totalTypes: number;
  totalImports: number;
}

export interface AnalysisResult {
  filePath: string;
  fileName: string;
  stats: AnalysisStats;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  callGraph: Record<string, string[]>;
  fullCode: string;
  lines: string[];
}

// ==========================================
// ТИПЫ ДЛЯ СУЩНОСТЕЙ (НОВЫЕ)
// ==========================================

import type {
  FunctionInfo as EntityFunctionInfo,
  ClassInfo as EntityClassInfo,
  ConstantInfo as EntityConstantInfo,
  InterfaceInfo as EntityInterfaceInfo,
  TypeInfo as EntityTypeInfo,
  VariableInfo as EntityVariableInfo,
  EntitiesResult,
} from './core/entity-extractor.js';

// Реэкспорт типов сущностей для удобства
export type {
  EntityFunctionInfo,
  EntityClassInfo,
  EntityConstantInfo,
  EntityInterfaceInfo,
  EntityTypeInfo,
  EntityVariableInfo,
  EntitiesResult,
};

// ==========================================
// ТИПЫ ДЛЯ ГРАФОВ (НОВЫЕ)
// ==========================================

export interface ModuleGraphNode {
  id: string;
  name: string;
  type: 'module' | 'component' | 'vue';
  level: number;
  metadata: {
    size: number;
    lines: number;
    language: string;
    isEntry: boolean;
  };
}

export interface ModuleGraphEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export';
  specifiers: string[];
}

export interface ModuleGraph {
  nodes: ModuleGraphNode[];
  edges: ModuleGraphEdge[];
}

export interface EntityGraphNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable';
  module: string;
  line: number;
  metadata: Record<string, any>;
}

export interface EntityGraphEdge {
  from: string;
  to: string;
  type:
    | 'function_call'
    | 'constant_reference'
    | 'class_extends'
    | 'class_implements'
    | 'interface_extends'
    | 'type_reference'
    | 'method_call'
    | 'property_access'
    | 'import_binding'
    | 'export_binding'
    | 'parameter_type'
    | 'return_type';
  line?: number;
}

export interface EntityGraph {
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
}

export interface FullAnalysis {
  version: string;
  root: string;
  timestamp: string;
  stats: {
    totalModules: number;
    totalEntities: number;
    hasCycles: boolean;
    cycles: string[][];
  };
  moduleGraph: ModuleGraph;
  entityGraph: EntityGraph;
}

// ==========================================
// ТИПЫ ДЛЯ ГРАФОВ И КЛАСТЕРИЗАЦИИ
// ==========================================

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

export interface FileInternalGraph {
  rootKey: string;
  graph: Record<string, string[]>;
}

export interface Cluster {
  name: string;
  functions: string[];
  isExported: boolean;
  dependencies: string[];
  importers: string[];
  cohesionScore: number;
  type: 'core' | 'helper';
  size: number;
  recommendation: string;
}

export interface ClusterOptions {
  targetClusterSize?: number;
  maxClusterSize?: number;
}

// ==========================================
// ТИПЫ ДЛЯ РАЗЛИЧНЫХ РЕЖИМОВ
// ==========================================

// Split Module Mode
export interface SplitModuleOptions {
  outputFile?: string;
  includeFullCode?: boolean;
  includeMinified?: boolean;
  includeGraph?: boolean;
  includeStats?: boolean;
  includeSuggestions?: boolean;
  targetClusterSize?: number;
  maxClusterSize?: number;
  maxDepth?: number;
  excludePatterns?: string[];
  prefix?: string;
}

export interface SplitModuleResult {
  markdown: string;
  analysis: AnalysisResult;
  outputFiles: {
    prompt: string;
    context: string;
    graph: string;
    analysis: string;
  };
}

// Minify Folder Mode
export interface MinifyFolderOptions {
  outputFile?: string;
  extensions?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  showStructure?: boolean;
  addTableOfContents?: boolean;
  sortByType?: boolean;
}

export interface MinifyFolderResult {
  markdown: string;
  filesProcessed: number;
  totalOriginalSize: number;
  totalMinifiedSize: number;
}

// Prompt Pack Mode
export interface PromptPackOptions {
  maxDepth?: number;
  includeTargetFile?: boolean;
  includeDependencies?: boolean;
}

// Impact Analysis Mode
export interface ImpactUsage {
  file: string;
  usages: string[];
}

export interface ImpactReport {
  targetFile: string;
  entityName: string;
  impacts: ImpactUsage[];
  isSafe: boolean;
}

export interface ImpactOptions {
  targetFile: string;
  entityName: string;
}

// Dead Code Mode
export interface DeadCodeReport {
  targetFile: string;
  deadLocals: string[];
  deadExports: string[];
  hasDeadCode: boolean;
}

export interface DeadCodeOptions {
  targetFile: string;
}

// Project Graph Mode
export interface ProjectGraphOptions {
  maxDepth?: number;
  entryPoint: string;
}

// File Graph Mode
export interface FileGraphOptions {
  maxDepth?: number;
}

// ==========================================
// ТИПЫ ДЛЯ HTML ОТЧЕТОВ
// ==========================================

export interface HTMLReportOptions {
  svgContent: string;
  dotContent: string;
  jsonContent: string;
  title: string;
  hasCycles: boolean;
}

// ==========================================
// ТИПЫ ДЛЯ АРГУМЕНТОВ КОМАНДНОЙ СТРОКИ
// ==========================================

export type CLIMode =
  | 'project'
  | 'file'
  | 'minify'
  | 'minify-folder'
  | 'prompt-pack'
  | 'split-module'
  | 'split'
  | 'impact'
  | 'dead-code'
  | 'hybrid-report'
  | 'hybrid'
  | 'semantic'
  | 'verify'
  | 'refactor'
  | 'analyze'
  | 'vue-analyze'
  | 'vue';

export interface ProjectCLIArgs {
  mode: 'project';
  targetPath: string;
  extraArg?: string; // depth
  includeEntities?: boolean;
}

export interface FileCLIArgs {
  mode: 'file';
  targetPath: string;
  includeEntities?: boolean;
}

export interface MinifyCLIArgs {
  mode: 'minify';
  targetPath: string;
}

export interface MinifyFolderCLIArgs {
  mode: 'minify-folder';
  targetPath: string;
  options?: MinifyFolderOptions;
}

export interface PromptPackCLIArgs {
  mode: 'prompt-pack';
  targetPath: string;
  extraArg?: string; // depth
}

export interface SplitModuleCLIArgs {
  mode: 'split-module' | 'split';
  targetPath: string;
  options?: SplitModuleOptions;
}

export interface ImpactCLIArgs {
  mode: 'impact';
  targetPath: string;
  extraArg: string; // entityName
}

export interface DeadCodeCLIArgs {
  mode: 'dead-code';
  targetPath: string;
}

export interface HybridReportCLIArgs {
  mode: 'hybrid-report' | 'hybrid';
  targetPath: string;
  extraArg?: string; // depth
}

export interface SemanticCLIArgs {
  mode: 'semantic';
  targetPath: string;
  extraArg?: string;
  options?: {
    recursive?: boolean;
    formalVerification?: boolean;
    maxDepth?: number;
    criticalFunctions?: string[];
    outputDir?: string;
  };
}

export interface VerifyCLIArgs {
  mode: 'verify';
  targetPath: string;
  options?: {
    functionName?: string;
    contractPath?: string;
  };
}

export interface RefactorCLIArgs {
  mode: 'refactor';
  targetPath: string;
  options?: {
    modulesDir?: string;
    targetClusterSize?: number;
    maxClusterSize?: number;
    minCohesionScore?: number;
    dryRun?: boolean;
    createBackup?: boolean;
    updateTemplate?: boolean;
    verbose?: boolean;
    semanticAnalysis?: boolean;
  };
}

export interface AnalyzeCLIArgs {
  mode: 'analyze';
  targetPath: string;
  options?: {
    targetClusterSize?: number;
    maxClusterSize?: number;
    minCohesionScore?: number;
    dryRun?: boolean;
  };
}

export interface VueAnalyzeCLIArgs {
  mode: 'vue-analyze' | 'vue';
  targetPath: string;
  options?: {
    includeTemplateAST?: boolean;
    includeScriptAST?: boolean;
    extractComposableCalls?: boolean;
  };
}

export type CLIArgs =
  | ProjectCLIArgs
  | FileCLIArgs
  | MinifyCLIArgs
  | MinifyFolderCLIArgs
  | PromptPackCLIArgs
  | SplitModuleCLIArgs
  | ImpactCLIArgs
  | DeadCodeCLIArgs
  | HybridReportCLIArgs
  | SemanticCLIArgs
  | VerifyCLIArgs
  | RefactorCLIArgs
  | AnalyzeCLIArgs
  | VueAnalyzeCLIArgs
  | null;

// ==========================================
// ТИПЫ ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ
// ==========================================

export interface CallEdge {
  from: string;
  to: string;
}

export interface CodeCut {
  start: number;
  end: number;
  replaceWith: string;
}

export interface DirectoryTree {
  [key: string]: DirectoryTree | null;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  ext: string;
  size: number;
}

// ==========================================
// ТИПЫ ДЛЯ ОШИБОК И ЛОГГИРОВАНИЯ
// ==========================================

export interface ParseError {
  filePath: string;
  message: string;
  stack?: string;
}

export interface AnalysisWarning {
  type: 'parse' | 'resolve' | 'readdir' | 'vue-script';
  filePath: string;
  message: string;
}

// ==========================================
// ТИПЫ ДЛЯ AST ВАЛКЕРА И ОБРАБОТКИ
// ==========================================

export interface ASTNode {
  type: string;
  loc?: Location | null;
  range?: [number, number];
  [key: string]: any;
}

export interface WalkerOptions {
  enter?: (node: ASTNode, parent?: ASTNode) => void;
  leave?: (node: ASTNode, parent?: ASTNode) => void;
}

// ==========================================
// ТИПЫ ДЛЯ ГЕНЕРАЦИИ ОТЧЕТОВ
// ==========================================

export interface MarkdownSection {
  title: string;
  level: number;
  content: string;
}

export interface TableRow {
  [key: string]: string | number;
}

export interface TableOptions {
  headers: string[];
  rows: TableRow[];
  alignment?: ('left' | 'center' | 'right')[];
}

// ==========================================
// ТИПЫ ДЛЯ ВАЛИДАЦИИ
// ==========================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileValidationOptions {
  checkExists?: boolean;
  checkExtension?: boolean;
  checkSize?: boolean;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
}

// ==========================================
// НОВЫЕ ТИПЫ (ДОБАВЛЕНЫ)
// ==========================================

export interface MethodInfo {
  name: string;
  kind: string;
  static: boolean;
  loc: Location | null;
}

export type CallGraph = Record<string, string[]>;

export interface Config {
  directories?: any[];
  excludePatterns?: any;
  scanOptions?: any;
  report?: any;
  supportedExtensions?: string[];
  specialFiles?: string[];
}

// ==========================================
// 🆕 НОВЫЕ ТИПЫ ДЛЯ ИНТЕЛЛЕКТУАЛЬНОЙ ПЛАТФОРМЫ
// ==========================================

/**
 * Анализ Vue компонента
 */
export interface VueAnalysis {
  props: {
    names: string[];
    types: Record<string, string>;
    required: Record<string, boolean>;
    defaults: Record<string, any>;
  };
  emits: {
    names: string[];
    types: Record<string, string>;
  };
  slots: string[];
  composables: string[];
  templateComplexity: number;
  scriptType: 'setup' | 'options';
  isTS: boolean;
  stats: {
    scriptLines: number;
    templateLines: number;
    styleCount: number;
  };
}

/**
 * Метрики архитектуры проекта
 */
export interface ArchitectureMetrics {
  totalModules: number;
  totalFunctions: number;
  totalClasses: number;
  totalConstants: number;
  totalInterfaces: number;
  totalTypes: number;
  totalVariables: number;
  totalCalls: number;
  vueComponents: number;
  totalComposables: number;
  hasCycles: boolean;
  maxDepth: number;
  modulesByLevel: Record<number, string[]>;
  isAcyclic: boolean;
  // Дополнительные метрики
  averageComplexity?: number;
  maxComplexity?: number;
  totalSecurityIssues?: number;
  securityIssuesByType?: {
    hasEval: number;
    hasProcessEnv: number;
    hasSensitiveData: number;
    hasExec: number;
  };
}

/**
 * Краткое резюме проекта для ИИ-агентов
 */
export interface ProjectSummary {
  projectType: 'monorepo' | 'single' | 'unknown';
  entryPoint: string;
  totalModules: number;
  totalFunctions: number;
  vueComponents: number;
  hasCycles: boolean;
  maxDepth: number;
  architectureHealth: string;
  // Краткое описание для быстрого понимания
  quickSummary?: string;
  // Ключевые технологии
  technologies?: string[];
}

/**
 * Обновленный EnhancedPackageInfo с поддержкой Vue
 */
export interface EnhancedPackageInfo {
  version: string;
  resolved: string;
  displayPath?: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, any>;
  exports: Record<string, any>;
  entities: {
    functions: any[];
    constants: any[];
    variables: any[];
    interfaces: any[];
    types: any[];
    classes: any[];
  };
  fileStats: {
    size: number;
    lines: number;
    functions: number;
    classes: number;
    constants: number;
    interfaces: number;
    types: number;
    variables: number;
  };
  // 🆕 Vue-анализ (опционально)
  vueAnalysis?: VueAnalysis;
  // 🆕 Метрики сложности для файла
  complexity?: {
    average: number;
    max: number;
    functions: Record<string, number>;
  };
  // 🆕 Безопасность файла
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    issues: string[];
  };
}

/**
 * Обновленный EnhancedPackageLockReport
 */
export interface EnhancedPackageLockReport {
  name: string;
  version: string;
  lockfileVersion: number;
  packages: Record<string, EnhancedPackageInfo>;
  dependencyGraph: {
    direction: 'bidirectional';
    inwardDependencies: Record<string, string[]>;
    outwardDependencies: Record<string, string[]>;
  };
  executionGraph: {
    entryPoint: string;
    direction: 'top-down';
    entryFunctions: string[];
    executionFlow: {
      type: 'sequential' | 'parallel' | 'conditional';
      steps: {
        func: string;
        module: string;
        direction: 'inward' | 'outward' | 'self';
        isAsync: boolean;
        branches?: Record<string, any>;
      }[];
    };
  };
  importExportFlow: {
    imports: Record<
      string,
      {
        importsFrom: {
          module: string;
          type: 'named' | 'default' | 'namespace';
          imports: string[];
        }[];
      }
    >;
    exports: Record<
      string,
      {
        exportsTo: {
          module: string;
          type: 'named' | 'default';
          exports: string[];
        }[];
      }
    >;
  };
  callGraph?: Record<string, string[]>;
  entityStats?: {
    totalFunctions: number;
    totalConstants: number;
    totalVariables: number;
    totalInterfaces: number;
    totalTypes: number;
    totalClasses: number;
    totalCalls: number;
    totalExportedFunctions: number;
    totalAsyncFunctions: number;
  };
  fileStats?: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  timestamp?: string;
  // 🆕 Метрики архитектуры
  architectureMetrics?: ArchitectureMetrics;
  // 🆕 Краткое резюме
  summary?: ProjectSummary;
}

// ==========================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ==========================================

export default {
  // Существующие типы экспортируются автоматически
  // Новые типы доступны через импорт
};
