// index.ts
// Точка входа для программы и внешнего API

// ==========================================
// ЭКСПОРТ ЯДРА (CORE)
// ==========================================
import { TypeAnalyzer } from './semantic/TypeAnalyzer.js';
// Парсинг и работа с AST
export {
  parseFile,
  isExternalModule,
  resolveFilePath,
  getAllProjectFiles,
  walk,
} from './core/ast-parser.js';

// Минификация кода
export { minifyCodeString, minifyForAI } from './core/minifier.js';

// Утилиты для работы с графами
export { findCyclicEdges, convertToDOT, dfs } from './core/graph-utils.js';

// Работа с tsconfig (алиасы)
export { setTsConfigPath, loadTsConfig, resolveAliasPath } from './core/tsconfig-resolver.js';

// ==========================================
// ЭКСПОРТ РЕЖИМОВ (MODES)
// ==========================================

// Режим 1: Проектный граф
export { buildProjectGraph } from './modes/project-graph.js';

// Режим 2: Внутренний граф файла
export { buildFileInternalGraph } from './modes/file-graph.js';

// Режим 3: Минификация одного файла
export { minifyFile } from './modes/minify-file.js';

// Режим 4: Рекурсивная минификация папки
export { minifyFolder, generateDirectoryTree, collectFiles } from './modes/minify-folder.js';

// Режим 5: Prompt Pack для ИИ
export { buildAiPromptPack } from './modes/prompt-pack.js';

// Режим 6: Разбиение файла на модули
export {
  buildSplitModulePrompt,
  analyzeModuleStructure,
  identifyClusters,
} from './modes/split-module.js';

// Режим 7: Анализ зоны влияния
export { runImpactAnalysis } from './modes/impact.js';

// Режим 8: Поиск мертвого кода
export { findDeadCode } from './modes/dead-code.js';

// ==========================================
// ЭКСПОРТ VUE АНАЛИЗАТОРА
// ==========================================

// Vue SFC парсер и анализатор
export {
  parseVueFile,
  analyzeVueComponent,
  generateVueComponentReport,
  enhanceWithVueAnalysis,
  type VueComponentAnalysis,
  type AnalysisOptions,
} from './modes/vue-analyzer.js';

// ==========================================
// ЭКСПОРТ СЕМАНТИЧЕСКОГО АНАЛИЗА (НОВЫЙ!)
// ==========================================

// CFG (Control Flow Graph) анализатор
export { CFGAnalyzer, type BasicBlock, type ControlFlowGraph } from './semantic/CFGAnalyzer.js';

// Call Graph анализатор
export {
  CallGraphAnalyzer,
  type CallGraphNode,
  type CallGraph,
} from './semantic/CallGraphAnalyzer.js';

// Type анализатор
export {
  TypeAnalyzer,
  type TypeInfo as TypeInfoType,
  type TypeAnalysisResult,
  type TypeError,
} from './semantic/TypeAnalyzer.js';

// Data Flow анализатор
export {
  DataFlowAnalyzer,
  type DataFlowNode,
  type DataFlowEdge,
  type DataFlowGraph,
} from './semantic/DataFlowAnalyzer.js';

// Семантический пайплайн
export {
  SemanticPipeline,
  type PipelineResult,
  type PipelineIssue,
  type VerificationResult as PipelineVerificationResult,
} from './ci-cd/SemanticPipeline.js';

// ==========================================
// ЭКСПОРТ ФОРМАЛЬНОЙ ВЕРИФИКАЦИИ (НОВЫЙ!)
// ==========================================

// Z3 верификатор
export {
  Z3Verifier,
  createIntParam,
  createBoolParam,
  createStringParam,
  eq,
  neq,
  range,
  implies,
  and,
  or,
  not,
  type VerificationConstraint,
  type VerificationResult as FormalVerificationResult,
  type FunctionContract,
} from './formal/Z3Verifier.js';

// Проверка эквивалентности
export { EquivalenceChecker, type EquivalenceResult } from './formal/EquivalenceChecker.js';

// ==========================================
// ЭКСПОРТ РЕПОРТЕРОВ
// ==========================================

// Генерация HTML отчётов
export { generateHTMLReport, escapeHtml } from './reporters/html-reporter.js';

// Генерация Markdown отчётов
export {
  generateStatsMarkdown,
  generateExportsMarkdown,
  generateImportsMarkdown,
  generateClustersMarkdown,
  generateCyclicEdgesMarkdown,
  generateSuggestedStructureMarkdown,
  generateCallGraphMarkdown,
  generateSplitModulePromptMarkdown,
  escapeMarkdown,
} from './reporters/markdown-reporter.js';

// ==========================================
// ЭКСПОРТ ТИПОВ
// ==========================================

export type {
  // Статистика
  AnalysisStats,

  // Информация о сущностях
  ImportInfo,
  ExportInfo,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  MethodInfo,

  // Структуры анализа
  AnalysisResult,
  CallGraph as CallGraphType,
  GraphData,

  // Кластеры
  Cluster,
  ClusterOptions,

  // Опции для режимов
  SplitModuleOptions,
  MinifyFolderOptions,
  PromptPackOptions,
  ImpactOptions,
  DeadCodeOptions,
  ProjectGraphOptions,
  FileGraphOptions,

  // Конфигурация
  Config,

  // Результаты
  SplitModuleResult,
  MinifyFolderResult,
  ImpactReport,
  DeadCodeReport,
} from './types.js';

// ==========================================
// ЭКСПОРТ КОНФИГУРАЦИИ
// ==========================================

export {
  IGNORE_NODE_MODULES,
  SUPPORTED_EXTENSIONS,
  DEFAULT_EXCLUDE_PATTERNS,
  VUE_SCRIPT_PATTERN,
} from './config.js';

// ==========================================
// ЭКСПОРТ УТИЛИТ
// ==========================================

export {
  showHelp,
  renderNode,
  formatFileSize,
  generateTempId,
  ensureDirectoryExists,
} from './utils.js';

// ==========================================
// CLI RUNNER
// ==========================================

export { runCLI } from './cli.js';

// ==========================================
// ВЕРСИЯ
// ==========================================

export const VERSION = '3.0.0';
export const NAME = 'ast-analyzer';

// ==========================================
// ОСНОВНЫЕ API ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
// ==========================================

import type { PipelineResult } from './ci-cd/SemanticPipeline.js';
import type { VerificationResult as FormalVerificationResult } from './formal/Z3Verifier.js';
import type { ControlFlowGraph } from './semantic/CFGAnalyzer.js';
import type { CallGraph } from './semantic/CallGraphAnalyzer.js';
import type { TypeAnalysisResult } from './semantic/TypeAnalyzer.js';
import type { DataFlowGraph } from './semantic/DataFlowAnalyzer.js';

/**
 * Быстрый анализ файла с семантикой
 * @param filePath Путь к файлу
 * @param options Опции анализа
 */
export async function analyzeWithSemantics(
  filePath: string,
  options: { formal?: boolean; critical?: string[] } = {}
): Promise<PipelineResult> {
  const { SemanticPipeline } = await import('./ci-cd/SemanticPipeline.js');
  const pipeline = new SemanticPipeline();
  return pipeline.run([filePath], {
    formalVerification: options.formal || false,
    criticalFunctions: options.critical || [],
  });
}

/**
 * Формальная верификация функции
 * @param filePath Путь к файлу
 * @param functionName Имя функции
 */
export async function verifyFunction(
  filePath: string,
  functionName: string
): Promise<FormalVerificationResult> {
  const { Z3Verifier, createIntParam, range } = await import('./formal/Z3Verifier.js');
  const { Project } = await import('ts-morph');

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const func = sourceFile.getFunction(functionName);

  if (!func) {
    throw new Error(`Function ${functionName} not found in ${filePath}`);
  }

  const verifier = new Z3Verifier();
  await verifier.initialize();

  // Создаем контракт на основе сигнатуры функции
  const params = func.getParameters().map(p => createIntParam(p.getName()));
  const returnType = func.getReturnType();

  const result = await verifier.verifyFunction({
    name: functionName,
    params,
    returnType: returnType.isNumber() ? 'int' : 'void',
    preconditions: params.map(p => range(p.name, -1000, 1000)),
    postconditions: [],
    invariants: [],
  });

  await verifier.dispose();
  return result;
}

/**
 * Получить CFG для файла
 * @param filePath Путь к файлу
 */
export async function getControlFlowGraph(filePath: string): Promise<ControlFlowGraph> {
  const { Project } = await import('ts-morph');
  const { CFGAnalyzer } = await import('./semantic/CFGAnalyzer.js');

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const analyzer = new CFGAnalyzer();

  return analyzer.build(sourceFile);
}

/**
 * Получить Call Graph для файла
 * @param entryPoint Точка входа
 * @param maxDepth Максимальная глубина
 */
export async function getCallGraph(entryPoint: string, maxDepth = 5): Promise<CallGraph> {
  const { CallGraphAnalyzer } = await import('./semantic/CallGraphAnalyzer.js');
  const analyzer = new CallGraphAnalyzer();

  return analyzer.analyze(entryPoint, maxDepth);
}

/**
 * Получить типы для файла
 * @param filePath Путь к файлу
 */
export function getTypeInfo(filePath: string): TypeAnalysisResult {
  const analyzer = new TypeAnalyzer(filePath);

  return analyzer.analyze();
}

/**
 * Получить Data Flow Graph для файла
 * @param filePath Путь к файлу
 */
export async function getDataFlowGraph(filePath: string): Promise<DataFlowGraph> {
  const { Project } = await import('ts-morph');
  const { DataFlowAnalyzer } = await import('./semantic/DataFlowAnalyzer.js');

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const analyzer = new DataFlowAnalyzer();

  return analyzer.analyze(sourceFile);
}
