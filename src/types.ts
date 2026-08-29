// src/types.ts

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
  isTypeOnly?: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'constant' | 'value' | 'default';
  isDefault: boolean;
  loc: Location | null;
  params?: string[];
  async?: boolean;
  startLine?: number;
  endLine?: number;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС ClassInfo
// ==========================================

export interface ClassInfo {
  name: string;
  line: number;
  isExported: boolean;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС ConstantInfo
// ==========================================

export interface ConstantInfo {
  name: string;
  line: number;
  value?: any;
  isExported: boolean;
  type?: string;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС InterfaceInfo
// ==========================================

export interface InterfaceInfo {
  name: string;
  line: number;
  isExported: boolean;
  properties: string[];
  extends?: string[];
  startLine: number;
  endLine: number;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС TypeInfo
// ==========================================

export interface TypeInfo {
  name: string;
  line: number;
  isExported: boolean;
  definition: string;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС VariableInfo
// ==========================================

export interface VariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type?: string;
  value?: any;
}

// ==========================================
// ТИПЫ ДЛЯ СВЯЗЕЙ (v3.0.1)
// ==========================================

export interface CallInfo {
  targetId: string;
  targetName: string;
  targetFile: string;
  targetLine: number;
  targetVscode: string;
  callLine: number;
  callType:
    'direct' | 'import' | 'computed' | 'watch' | 'event' | 'lifecycle' | 'method' | 'constructor';
}

export interface CalledByInfo {
  callerId: string;
  callerName: string;
  callerFile: string;
  callerLine: number;
  callerVscode: string;
  callLine: number;
  callType:
    'direct' | 'import' | 'computed' | 'watch' | 'event' | 'lifecycle' | 'method' | 'constructor';
}

export interface ImportedByInfo {
  importerId: string;
  importerFile: string;
  importerVscode: string;
  importLine: number;
  specifier: string;
  importType?: 'named' | 'default' | 'namespace' | 'type';
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС FunctionInfo С РАСШИРЕННЫМИ ПОЛЯМИ
// ==========================================

export interface FunctionInfo {
  name: string;
  line: number;
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  returnType?: string;
  calls: string[];
  calledBy: string[];
  body?: string;
  startLine: number;
  endLine: number;
  isMethod?: boolean;
  className?: string;
  isNested?: boolean;
  parentFunction?: string;
  isArrow?: boolean;
  isEventHandler?: boolean;
  eventType?: string;
  depth: number;
  complexity?: number;
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };

  // ============================================
  // НОВЫЕ ПОЛЯ ДЛЯ ВСТРОЕННЫХ СВЯЗЕЙ (v3.0.1)
  // ============================================
  id?: string; // Уникальный ID сущности
  vscode?: string; // VSCode ссылка на функцию
  callsInfo?: CallInfo[]; // Полная информация о вызовах
  calledByInfo?: CalledByInfo[]; // Полная информация о вызывающих
  importedBy?: ImportedByInfo[]; // Полная информация об импортерах

  // Дополнительные поля для совместимости
  filePath?: string;
  moduleName?: string;
  _modulePath?: string;
  _safeInfo?: any;

  // Дополнительные поля для Vue
  isConst?: boolean;
  isMacro?: boolean;
  isComposable?: boolean;
  source?: string;

  // Поле signature для совместимости
  signature?: string;
}

// ==========================================
// РАСШИРЕННАЯ ИНФОРМАЦИЯ О ФУНКЦИИ (С ВСТРОЕННЫМИ СВЯЗЯМИ)
// ==========================================

export interface ExtendedFunctionInfo {
  id: string;
  name: string;
  file: string;
  line: number;
  kind: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'macro';
  isExported: boolean;
  isAsync: boolean;
  params: string[];
  paramsCount: number;
  vscode: string;
  calls: CallInfo[];
  calledBy: CalledByInfo[];
  importedBy: ImportedByInfo[];
  body?: string;
  returnType?: string;
  metadata?: Record<string, any>;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС EntitiesResult
// ==========================================

export interface EntitiesResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  variables: VariableInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

// ==========================================
// ВОССТАНОВЛЕННЫЕ ТИПЫ
// ==========================================

export interface MethodInfo {
  name: string;
  kind: 'method' | 'get' | 'set' | 'constructor';
  static: boolean;
  loc: Location | null;
}

export interface CallGraphNode {
  name: string;
  file: string;
  line: number;
  column: number;
  calls: CallGraphNode[];
  callers: CallGraphNode[];
  isEntry: boolean;
  isAsync: boolean;
  isExported: boolean;
}

export interface CallEdge {
  from: string;
  to: string;
  type?: string;
  line?: number;
}

export interface CallGraph {
  nodes: Map<string, CallGraphNode>;
  edges: CallEdge[];
  entryPoints: CallGraphNode[];
  cycles: CallEdge[][];
  findUnusedFunctions(): CallGraphNode[];
  findCyclicDependencies(): CallEdge[][];
}

export interface Config {
  ignoreNodeModules: boolean;
  supportedExtensions: string[];
  defaultExcludePatterns: string[];
  vueScriptPattern: RegExp;
}

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

// ==========================================
// ТИПЫ ДЛЯ КЛАССОВ
// ==========================================

export interface ClassMethodInfo {
  name: string;
  kind: 'method' | 'get' | 'set' | 'constructor';
  static: boolean;
  loc: Location | null;
}

export interface ClassInfoLegacy {
  name: string;
  exported: boolean;
  loc: Location | null;
  methods: ClassMethodInfo[];
  startLine: number;
  endLine: number;
}

// ==========================================
// ТИПЫ ДЛЯ КОНСТАНТ И ПЕРЕМЕННЫХ
// ==========================================

export interface ConstantInfoLegacy {
  name: string;
  type: 'constant';
  loc: Location | null;
  startLine: number;
  endLine: number;
}

export interface InterfaceInfoLegacy {
  name: string;
  exported: boolean;
  loc: Location | null;
  members: number;
  startLine: number;
  endLine: number;
}

export interface TypeInfoLegacy {
  name: string;
  exported: boolean;
  loc: Location | null;
}

// ==========================================
// СТАТИСТИКА АНАЛИЗА
// ==========================================

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
// ТИПЫ ДЛЯ СУЩНОСТЕЙ (устаревшие, для обратной совместимости)
// ==========================================

export interface EntitiesResultLegacy {
  functions: FunctionInfo[];
  classes: ClassInfoLegacy[];
  constants: ConstantInfoLegacy[];
  interfaces: InterfaceInfoLegacy[];
  types: TypeInfoLegacy[];
  variables: VariableInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

// ==========================================
// ТИПЫ ДЛЯ ГРАФОВ
// ==========================================

export interface FileInternalGraph {
  rootKey: string;
  graph: Record<string, string[]>;
}

// ==========================================
// ТИПЫ ДЛЯ ГРАФОВ МОДУЛЕЙ И СУЩНОСТЕЙ
// ==========================================

export interface ModuleGraphNode {
  id: string;
  name: string;
  type: 'module' | 'component' | 'vue' | 'external';
  level: number;
  metadata: {
    size: number;
    lines: number;
    language: string;
    isEntry: boolean;
    functionsCount?: number;
    classesCount?: number;
    exportsCount?: number;
  };
}

export interface ModuleGraphEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  specifiers: string[];
  sourceCode?: string;
}

export interface ModuleGraph {
  nodes: ModuleGraphNode[];
  edges: ModuleGraphEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

export interface EntityGraphNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'enum' | 'module';
  module: string;
  line: number;
  metadata: {
    isExported: boolean;
    dataType?: string;
    value?: any;
    params?: string[];
    returnType?: string;
    isAsync?: boolean;
    isMethod?: boolean;
    className?: string;
    properties?: string[];
    methods?: string[];
    extends?: string;
    implements?: string[];
    extendsInterfaces?: string[];
    definition?: string;
    calledBy?: string[];
    calls?: string[];
    startLine?: number;
    endLine?: number;
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    tags?: string[];
    complexity?: number;
    security?: {
      hasEval: boolean;
      hasProcessEnv: boolean;
      hasSensitiveData: boolean;
      hasExec: boolean;
      hasPassword: boolean;
    };
    body?: string;
    vscode?: string;
    id?: string;
    signature?: string;
    importedFrom?: string;
    type?: string; // Для обратной совместимости
  };
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
    | 'return_type'
    | 'variable_reference'
    | 'enum_member';
  line?: number;
  count?: number;
}

export interface EntityGraph {
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    functionsCount: number;
    classesCount: number;
    constantsCount: number;
    interfacesCount: number;
    typesCount: number;
    variablesCount: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

// ==========================================
// ПОЛНЫЙ АНАЛИЗ (ОБЪЕДИНЕНИЕ ДВУХ ГРАФОВ)
// ==========================================

export interface FullAnalysis {
  version: string;
  root: string;
  timestamp: string;
  stats: {
    totalModules: number;
    totalEntities: number;
    hasCycles: boolean;
    cycles: string[][];
    totalFunctions: number;
    totalClasses: number;
    totalConstants: number;
    totalInterfaces: number;
    totalTypes: number;
    totalVariables: number;
    maxDepth: number;
  };
  moduleGraph: ModuleGraph;
  entityGraph: EntityGraph;
}

// ==========================================
// ТИПЫ ДЛЯ АРХИТЕКТУРНЫХ МЕТРИК
// ==========================================

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

// ==========================================
// ТИПЫ ДЛЯ РЕЗЮМЕ ПРОЕКТА
// ==========================================

export interface ProjectSummary {
  projectType: 'monorepo' | 'single' | 'unknown';
  entryPoint: string;
  totalModules: number;
  totalFunctions: number;
  vueComponents: number;
  hasCycles: boolean;
  maxDepth: number;
  architectureHealth: string;
  quickSummary?: string;
  technologies?: string[];
}

// ==========================================
// ТИПЫ ДЛЯ VUE АНАЛИЗА
// ==========================================

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

// ==========================================
// ТИПЫ ДЛЯ КЛАСТЕРОВ
// ==========================================

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

export interface PromptPackOptions {
  maxDepth?: number;
  includeTargetFile?: boolean;
  includeDependencies?: boolean;
}

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

export interface DeadCodeReport {
  targetFile: string;
  deadLocals: string[];
  deadExports: string[];
  hasDeadCode: boolean;
}

export interface DeadCodeOptions {
  targetFile: string;
}

export interface ProjectGraphOptions {
  maxDepth?: number;
  entryPoint: string;
}

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
// ТИПЫ ДЛЯ CLI
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
  extraArg?: string;
  includeEntities?: boolean;
  includeBody?: boolean;
  includeVueAnalysis?: boolean;
  fromFunction?: string;
  toFunction?: string;
  optimized?: boolean;
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
  extraArg?: string;
}

export interface SplitModuleCLIArgs {
  mode: 'split-module' | 'split';
  targetPath: string;
  options?: SplitModuleOptions;
}

export interface ImpactCLIArgs {
  mode: 'impact';
  targetPath: string;
  extraArg: string;
}

export interface DeadCodeCLIArgs {
  mode: 'dead-code';
  targetPath: string;
}

export interface HybridReportCLIArgs {
  mode: 'hybrid-report' | 'hybrid';
  targetPath: string;
  extraArg?: string;
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
// ТИПЫ ДЛЯ AST ВАЛКЕРА
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
// ТИПЫ ДЛЯ ОТЧЕТОВ
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
// ТИПЫ ДЛЯ ОПТИМИЗИРОВАННОГО ОТЧЕТА
// ==========================================

export interface OptimizedReportOptions {
  includeBody?: boolean;
  compression?: 'full' | 'minimal' | 'relationships-only';
  includeVscodeLinks?: boolean;
  includeStats?: boolean;
  includeMetadata?: boolean;
}

// ==========================================
// ТИПЫ ДЛЯ ENHANCED PACKAGE LOCK REPORT
// ==========================================

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
    functions: FunctionInfo[];
    constants: ConstantInfo[];
    variables: VariableInfo[];
    interfaces: InterfaceInfo[];
    types: TypeInfo[];
    classes: ClassInfo[];
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
  vueAnalysis?: VueAnalysis;
  complexity?: {
    average: number;
    max: number;
    functions: Record<string, number>;
  };
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    issues: string[];
  };
  vscode?: string;
  sourceCode?: string;
}

// ==========================================
// РАСШИРЕННАЯ ИНФОРМАЦИЯ О СУЩНОСТЯХ
// ==========================================

export interface EnhancedFunctionInfo extends FunctionInfo {
  paramTypes: string[];
  isMethod: boolean;
  className: string;
  isNested: boolean;
  parentFunction: string;
  isArrow: boolean;
  isEventHandler: boolean;
  eventType: string;
  depth: number;
  complexity: number;
  security: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
  vscode: string;
  signature: string;
  _safeInfo: any;
}

export interface EnhancedConstantInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
}

export interface EnhancedVariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
}

export interface EnhancedInterfaceInfo {
  name: string;
  properties: string[];
  line: number;
  startLine: number;
  endLine: number;
  isExported: boolean;
  extends: string[];
  _safeInfo: any;
}

export interface EnhancedTypeInfo {
  name: string;
  definition: string;
  line: number;
  isExported: boolean;
  _safeInfo: any;
}

export interface EnhancedClassInfo {
  name: string;
  methods: string[];
  properties: string[];
  line: number;
  startLine: number;
  endLine: number;
  isExported: boolean;
  extends?: string;
  implements: string[];
  _safeInfo: any;
}

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];
  imports?: PackageLockImportInfo[];
}

export interface PackageLockImportInfo {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
}

export interface SecurityInfo {
  hasEval: boolean;
  hasProcessEnv: boolean;
  hasSensitiveData: boolean;
  hasExec: boolean;
  hasPassword: boolean;
}

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
  architectureMetrics?: ArchitectureMetrics;
  summary?: ProjectSummary;
}

// ==========================================
// ТИПЫ ДЛЯ МОДУЛЕЙ ИЗ REPORTERS
// ==========================================

export interface ModuleNode {
  id: string;
  name: string;
  path: string;
  type: 'module' | 'component' | 'vue' | 'external';
  level: number;
  metadata: {
    size: number;
    lines: number;
    language: string;
    isEntry: boolean;
    functionsCount?: number;
    classesCount?: number;
    exportsCount?: number;
  };
}

export interface ModuleEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  specifiers: string[];
  sourceCode?: string;
}

export interface EntityNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'enum' | 'module';
  module: string;
  line: number;
  metadata: {
    isExported: boolean;
    dataType?: string;
    value?: any;
    params?: string[];
    returnType?: string;
    isAsync?: boolean;
    isMethod?: boolean;
    className?: string;
    properties?: string[];
    methods?: string[];
    extends?: string;
    implements?: string[];
    extendsInterfaces?: string[];
    definition?: string;
    calledBy?: string[];
    calls?: string[];
    startLine?: number;
    endLine?: number;
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    tags?: string[];
    complexity?: number;
    security?: {
      hasEval: boolean;
      hasProcessEnv: boolean;
      hasSensitiveData: boolean;
      hasExec: boolean;
      hasPassword: boolean;
    };
    body?: string;
    vscode?: string;
    id?: string;
  };
}

export interface EntityEdge {
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
    | 'return_type'
    | 'variable_reference'
    | 'enum_member';
  line?: number;
  count?: number;
}

export interface EntityStats {
  total: number;
  exported: number;
  private: number;
  byModule: Record<string, number>;
  byType: {
    functions: number;
    classes: number;
    constants: number;
    interfaces: number;
    types: number;
    variables: number;
    enums: number;
  };
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  totalLines: number;
}

export interface FunctionEntity {
  name: string;
  params: string[];
  paramTypes: string[];
  line: number;
  startLine: number;
  endLine: number;
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  className: string;
  calls: string[];
  calledBy: string[];
  returnType: string;
  body: string;
  isNested: boolean;
  parentFunction: string;
  isArrow: boolean;
  isEventHandler: boolean;
  eventType: string;
  depth: number;
  complexity: number;
  security: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
  vscode?: string;
  signature?: string;
  _safeInfo?: any;
  id?: string;
  callsInfo?: CallInfo[];
  calledByInfo?: CalledByInfo[];
  importedBy?: ImportedByInfo[];
}

// ==========================================
// ТИПЫ ДЛЯ КОМПАКТНОЙ ВСЕЛЕННОЙ (ast-universe.json)
// ==========================================

export interface CompactUniverse {
  version: string;
  level: number;
  root: number;
  timestamp: string;
  modules: string[];
  packages: Record<number, any>;
  functions: CompactFunction[];
  moduleGraph: Record<number, number[]>;
  functionGraph: Record<number, number[]>;
  levels: Record<number, number[]>;
  stats: {
    functions: number;
    modules: number;
    calls: number;
    size: number;
    depth: number;
    cycles: boolean;
  };
  callDetails?: Record<number, {
    calls: { to: number; line: number; isAsync: boolean }[];
    calledBy: { from: number; line: number }[];
  }>;
  callContext?: Record<number, {
    params: string[];
    returnType: string;
    isExported: boolean;
    isAsync: boolean;
    line: number;
    endLine: number;
    calls: { to: number; line: number; column: number; isAsync: boolean; isMethod: boolean; className?: string }[];
    calledBy: { from: number; line: number; column: number }[];
    dependencies: number[];
  }>;
}

export interface CompactFunction {
  name: string;
  module: number;
  line: number;
  isExported?: boolean;
  isAsync?: boolean;
  params?: string[];
  returnType?: string;
  calls?: number[];
  startLine?: number;
  endLine?: number;
  body?: string;
  vscode?: string;
  security?: any;
  signature?: string;
}

// ==========================================
// УТИЛИТЫ ДЛЯ ТИПОВ
// ==========================================

export type EntityType = EntityNode['type'];
export type EdgeType = EntityEdge['type'];

export function isExported(node: EntityNode): boolean {
  return node.metadata.isExported || false;
}

export function isFunction(node: EntityNode): boolean {
  return node.type === 'function';
}

export function isClass(node: EntityNode): boolean {
  return node.type === 'class';
}

export function isConstant(node: EntityNode): boolean {
  return node.type === 'constant';
}

export function isInterface(node: EntityNode): boolean {
  return node.type === 'interface';
}

export function isType(node: EntityNode): boolean {
  return node.type === 'type';
}

export function isVariable(node: EntityNode): boolean {
  return node.type === 'variable';
}

export function getEntityColor(type: EntityType): string {
  switch (type) {
    case 'function':
      return '#4f46e5';
    case 'class':
      return '#7c3aed';
    case 'constant':
      return '#059669';
    case 'interface':
      return '#0ea5e9';
    case 'type':
      return '#f59e0b';
    case 'variable':
      return '#ef4444';
    case 'enum':
      return '#8b5cf6';
    case 'module':
      return '#6b7280';
    default:
      return '#9ca3af';
  }
}

export function getEntityIcon(type: EntityType): string {
  switch (type) {
    case 'function':
      return 'ƒ';
    case 'class':
      return '📦';
    case 'constant':
      return '📌';
    case 'interface':
      return '📋';
    case 'type':
      return '📝';
    case 'variable':
      return '📄';
    case 'enum':
      return '🔢';
    case 'module':
      return '📁';
    default:
      return '•';
  }
}

export function getEdgeColor(type: EdgeType): string {
  switch (type) {
    case 'function_call':
      return '#f59e0b';
    case 'constant_reference':
      return '#059669';
    case 'class_extends':
      return '#7c3aed';
    case 'class_implements':
      return '#8b5cf6';
    case 'interface_extends':
      return '#0ea5e9';
    case 'type_reference':
      return '#f59e0b';
    case 'method_call':
      return '#f97316';
    case 'property_access':
      return '#ec4899';
    case 'import_binding':
      return '#3b82f6';
    case 'export_binding':
      return '#22c55e';
    case 'parameter_type':
      return '#8b5cf6';
    case 'return_type':
      return '#ef4444';
    case 'variable_reference':
      return '#f43f5e';
    case 'enum_member':
      return '#a855f7';
    default:
      return '#6b7280';
  }
}

export default {
  isExported,
  isFunction,
  isClass,
  isConstant,
  isInterface,
  isType,
  isVariable,
  getEntityColor,
  getEntityIcon,
  getEdgeColor,
};
