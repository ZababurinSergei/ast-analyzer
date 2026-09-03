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
  // НОВЫЕ ПОЛЯ ДЛЯ RE-ЭКСПОРТОВ
  isReExport?: boolean;   // Является ли re-экспортом
  source?: string;        // Исходный модуль для re-экспорта
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
    | 'direct'
    | 'import'
    | 'computed'
    | 'watch'
    | 'event'
    | 'lifecycle'
    | 'method'
    | 'constructor';
}

export interface CalledByInfo {
  callerId: string;
  callerName: string;
  callerFile: string;
  callerLine: number;
  callerVscode: string;
  callLine: number;
  callType:
    | 'direct'
    | 'import'
    | 'computed'
    | 'watch'
    | 'event'
    | 'lifecycle'
    | 'method'
    | 'constructor';
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
  /** @deprecated Используйте callGraph.edges для получения вызовов */
  calls: string[];
  /** @deprecated Используйте callGraph.edges для получения вызывающих */
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
  /** @deprecated Используйте callGraph.edges для получения информации о вызовах */
  callsInfo?: CallInfo[];
  /** @deprecated Используйте callGraph.edges для получения информации о вызывающих */
  calledByInfo?: CalledByInfo[];
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

  // 🆕 НОВЫЕ ПОЛЯ ДЛЯ КОМПАКТНОГО ФОРМАТА
  moduleId?: string; // Короткий ID модуля (m1, m2, ...)
  fileId?: string; // Короткий ID файла (f1, f2, ...)

  // 🆕 НОВОЕ ПОЛЕ ДЛЯ УНИКАЛЬНОЙ ИДЕНТИФИКАЦИИ
  /** Уникальный ключ функции: moduleId:fileId:functionName */
  _uniqueKey?: string;
  /** Полный путь для идентификации: module/file/function */
  _fullPath?: string;
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
  importedBy: ImportedByInfo[];
  body?: string;
  returnType?: string;
  metadata?: Record<string, any>;
  /** Уникальный ключ: moduleId:fileId:functionName */
  _uniqueKey?: string;
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
  | 'vue'
  | 'compact'; // 🆕 НОВЫЙ РЕЖИМ

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

// 🆕 НОВЫЙ ТИП ДЛЯ КОМПАКТНОГО РЕЖИМА
export interface CompactCLIArgs {
  mode: 'compact';
  targetPath: string;
  outputPath?: string;
  options?: {
    ultraCompact?: boolean;
    useBitFlags?: boolean;
    useDictionaries?: boolean;
    readableKeys?: boolean;
    useTemplates?: boolean;
    maxDepth?: number;
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
  | CompactCLIArgs
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
  /** Уникальный ключ: moduleId:fileId:functionName */
  _uniqueKey?: string;
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

// ==========================================
// 🆕 ТИПЫ ДЛЯ ENHANCED PACKAGE LOCK REPORT
// ==========================================

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
  callGraph?: {
    from: string;
    to: string;
    path: string[];
    found: boolean;
    reason?: string;
    nodes: {
      function: string;
      module: string;
      line: number;
      isAsync: boolean;
    }[];
    edges: {
      from: string;
      to: string;
      line?: number;
    }[];
  };
  entityStats: {
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
  fileStats: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  architectureMetrics?: ArchitectureMetrics;
  summary?: ProjectSummary;
  timestamp: string;
}

// ==========================================
// ТИП ДЛЯ ENHANCED ENTITY INFO
// ==========================================

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];
  imports?: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
  }[];
}

// ==========================================
// 🆕 НОВЫЕ ТИПЫ ДЛЯ КОМПАКТНОГО ФОРМАТА (v4.0.0)
// ==========================================

/**
 * Компактный отчет - самодостаточный формат с короткими индексами
 * и читаемыми ключами объектов
 */
export interface CompactReport {
  /** Версия формата */
  version: string;
  /** Время генерации */
  timestamp: string;
  /** Корневой модуль (m1, m2, ...) */
  root: string;
  /** Легенда для расшифровки ключей */
  legend: Record<string, string>;

  /** Индекс модулей: m1 → "cli" */
  moduleIndex: Record<string, string>;
  /** Индекс файлов: f1 → { path, module } */
  fileIndex: Record<string, { path: string; module: string }>;
  /** Индекс функций: fn1 → { name, module, file } */
  functionIndex: Record<string, { name: string; module: string; file: string }>;

  /** Данные модулей */
  modules: Record<string, CompactModule>;

  /** Обратные индексы */
  reverseIndex: {
    /** Кто импортирует функцию: fn1 → [{ from: "m1", line: 45 }] */
    importedBy: Record<string, { from: string; line: number }[]>;
  };

  /** Неразрешенные импорты */
  unresolved: {
    module: string;
    target: string;
    line: number;
  }[];

  /** Общая статистика */
  stats: {
    totalModules: number;
    totalFiles: number;
    totalFunctions: number;
    totalCalls: number;
    totalImports: number;
    totalExports: number;
    totalUnresolved: number;
  };
}

/**
 * Компактный модуль
 */
export interface CompactModule {
  /** Имя модуля */
  name: string;
  /** Путь к файлу */
  path: string;
  /** Ссылка на файл (f1, f2, ...) */
  file: string;

  /** Импорты модуля */
  imports: {
    from: string; // moduleId
    specifiers: string[];
    line: number;
    type?: 'named' | 'default' | 'namespace' | 'type';
  }[];

  /** Экспорты модуля */
  exports: {
    function: string; // functionId
    name: string;
  }[];

  /** Функции модуля */
  functions: Record<string, CompactFunction>;

  /** Статистика модуля */
  stats: {
    functions: number;
    imports: number;
    exports: number;
    dependencies: number;
  };
}

/**
 * Компактная функция
 */
export interface CompactFunction {
  /** Имя функции */
  name: string;
  /** Строка определения */
  line: number;
  /** Битовые флаги: 1=async, 2=nested, 4=arrow, 8=method, 16=event, 32=exported */
  flags: number;
  /** Параметры */
  params: string[];
  /** Асинхронная */
  isAsync: boolean;
  /** Экспортируется */
  isExported: boolean;

  /** Вызовы функции */
  calls: {
    to: string; // functionId
    line: number;
    type: 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event';
  }[];
}

// ==========================================
// ТИП ДЛЯ COMPACT CALL
// ==========================================

export interface CompactCall {
  to: string;
  line: number;
  type: 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event';
}

// ==========================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ==========================================

export default {
  // Типы экспортируются автоматически
};
