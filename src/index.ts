// packages/ast-analyzer/src/index.ts
// Точка входа для программы и внешнего API

// ==========================================
// ЭКСПОРТ ЯДРА (CORE)
// ==========================================

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
export { findCyclicEdges, convertToDOT } from './core/graph-utils.js';

// Работа с tsconfig (алиасы)
export { setTsConfigPath, loadTsConfig, resolveAliasPath } from './core/tsconfig-resolver.js';

// ==========================================
// ЭКСПОРТ IdManager
// ==========================================

export { IdManager, idManager } from './core/IdManager.js';
export type { IdContext } from './core/IdManager.js';

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
// ЭКСПОРТ СЕМАНТИЧЕСКОГО АНАЛИЗА
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
// ЭКСПОРТ ФОРМАЛЬНОЙ ВЕРИФИКАЦИИ (ИЗ formal/index.ts)
// ==========================================

// Все экспорты из formal модуля
export {
  // Основные классы
  Z3Verifier,
  ExpressionParser,
  FunctionBodyModeler,
  FileEquivalenceChecker,
  RefactoringEquivalenceChecker,

  // Z3Verifier функции
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
  if_,
  compare,
  assign,
  add,
  sub,
  mul,
  div,
  addExpr,
  subExpr,
  mulExpr,
  divExpr,

  // ExpressionParser функции
  createExpressionParser,
  parseExpression,
  validateExpression,
  extractVariables,
  isValidForZ3,
  toZ3String,
  parseFunctionBody,
  createFunctionVariables,
  verifyFunctionWithBody,
  createContractFromExpression,
  createContractWithAutoPreconditions,
  canParseExpression,
  isSimpleExpression,
  extractVariablesFromExpression,

  // RefactoringEquivalenceChecker утилиты
  isRefactoringEquivalent,
  needsRefactoringReview,
  hasCriticalIssues,

  // Типы
  type VerificationConstraint,
  type VerificationResult as FormalVerificationResult,
  type FunctionContract,
  type FunctionBodyModel,
  type FileEquivalenceResult,
  type FileEquivalenceOptions,
  type RefactoringEquivalenceResult,
  type EquivalenceCheckOptions,

  // Утилиты для контрактов
  createContractTemplate,
  addPrecondition,
  addPostcondition,
  addInvariant,
  addBody,
  buildContract,
  createContractFromSignature,
  validatePostconditions,
  generateVerificationReport,
  areContractsEquivalent,

  // Фасадные функции
  checkFileEquivalence,
  checkRefactoringEquivalence,
  checkFunctionEquivalence,
  checkExpressionEquivalence,
  verifyFunction as formalVerifyFunction,

  // Константы
  FORMAL_MODULE_VERSION,
  FORMAL_MODULE_NAME,
} from './formal/index.js';

// ==========================================
// ЭКСПОРТ РЕФАКТОРИНГА
// ==========================================

export {
  AutoRefactor,
  ModuleExtractor,
  ImportManager,
  TypeScriptValidator,
  ESLintASTFixer,
  CodeValidator,
  CodeFixer,
  TemplateUpdater,
  SyntaxValidator,
  ModuleTypeDetector,
  BackupManager,
  type RefactorOptions,
  type RefactorResult,
  type ExtractedModule,
  type ValidationResult,
  type FixResult,
} from './refactor/index.js';

// ==========================================
// ЭКСПОРТ РЕПОРТЕРОВ
// ==========================================

// Генерация HTML отчётов
export { generateHTMLReport, escapeHtml } from './reporters/html-reporter.js';

// Генерация интерактивных HTML отчётов
export { generateInteractiveHTML } from './reporters/interactive-reporter.js';

// JSON репортеры
export {
  buildEnhancedPackageLockReport,
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  saveOptimizedPackageLockReport,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  extractEntitiesFromFile,
} from './reporters/json-reporter.js';

// Компактный формат (Universe)
export {
  compressReport,
  UniverseNavigator,
  loadUniverse,
  createNavigator,
  type CompactUniverse,
  type CompactPackage,
  type CompactFunction,
  type CompactStats,
} from './reporters/compressReport.js';

// createUniverse экспортируется из reporters/index.js
export { createUniverse } from './reporters/index.js';

// Модули репортеров
export {
  metadata,
  statistics,
  graphs,
  flows,
  architecture,
  summary,
  packages,
  converters,
  utils,
  vue,
} from './reporters/index.js';

// Константы репортеров
export { REPORTERS_VERSION, REPORTERS_NAME } from './reporters/index.js';

// ENV для репортеров
export { getRootPath, getPathSymbol } from './reporters/env.js';

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

  // ==========================================
  // НОВЫЕ ТИПЫ ДЛЯ ВСТРОЕННЫХ СВЯЗЕЙ (v3.0.1)
  // ==========================================
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  ExtendedFunctionInfo,
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
import type { VerificationResult as FormalVerificationResult } from './formal/index.js';
import type { ControlFlowGraph } from './semantic/CFGAnalyzer.js';
import type { CallGraph } from './semantic/CallGraphAnalyzer.js';
import type { TypeAnalysisResult } from './semantic/TypeAnalyzer.js';
import type { DataFlowGraph } from './semantic/DataFlowAnalyzer.js';

// Импортируем TypeAnalyzer для использования в функции getTypeInfo
// (он уже экспортирован выше, но для TypeScript нужно явно импортировать для использования)
import { TypeAnalyzer as TypeAnalyzerClass } from './semantic/TypeAnalyzer.js';

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
  const { Z3Verifier, createIntParam, range } = await import('./formal/index.js');
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
  // Используем импортированный класс TypeAnalyzerClass
  const analyzer = new TypeAnalyzerClass(filePath);
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

// ==========================================
// ЭКСПОРТ ВСЕХ CLI МОДУЛЕЙ (только run функции)
// ==========================================

// Экспортируем только run функции из CLI модулей
// program не экспортируется, так как это внутренняя деталь реализации
export { runCLI as runMainCLI } from './cli.js';

// Для остальных CLI модулей экспортируем только если они экспортируют run функцию
// Если нет - не экспортируем
