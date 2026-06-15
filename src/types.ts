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
  | 'dead-code';

export interface ProjectCLIArgs {
  mode: 'project';
  targetPath: string;
  extraArg?: string; // depth
}

export interface FileCLIArgs {
  mode: 'file';
  targetPath: string;
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

export type CLIArgs =
  | ProjectCLIArgs
  | FileCLIArgs
  | MinifyCLIArgs
  | MinifyFolderCLIArgs
  | PromptPackCLIArgs
  | SplitModuleCLIArgs
  | ImpactCLIArgs
  | DeadCodeCLIArgs
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
