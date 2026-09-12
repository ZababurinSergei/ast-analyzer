// src/index.ts
// ИСПРАВЛЕННЫЙ ФАЙЛ - Правильный импорт runCLI из cli.js
// + Исправлен экспорт типов из reporters (удалён CompactReport, добавлены реальные типы)

/**
 * AST Analyzer - основной экспортный файл
 * Все API сохранены для обратной совместимости
 */

// ============================================\
// ОСНОВНЫЕ ЭКСПОРТЫ (всегда нужны)\
// ============================================\

// Ядро
export { parseFile, isExternalModule, resolveFilePath } from './core/ast-parser.js';
export { minifyCodeString, minifyForAI } from './core/minifier.js';
export { findCyclicEdges, convertToDOT } from './core/graph-utils.js';
export { setTsConfigPath, loadTsConfig, resolveAliasPath } from './core/tsconfig-resolver.js';

// ID Manager
export { IdManager, idManager } from './core/IdManager.js';
export type { IdContext } from './core/IdManager.js';

// Project Graph
export { ProjectGraphBuilder } from './core/ProjectGraphBuilder.js';

// ============================================\
// РЕЖИМЫ (modes)\
// ============================================\

// Project graph
export { buildProjectGraph } from './modes/project-graph.js';

// File graph
export { buildFileInternalGraph } from './modes/file-graph.js';

// Minify
export { minifyFile } from './modes/minify-file.js';
export { minifyFolder, generateDirectoryTree, collectFiles } from './modes/minify-folder.js';

// Prompt pack
export { buildAiPromptPack } from './modes/prompt-pack.js';

// Split module
export {
  buildSplitModulePrompt,
  analyzeModuleStructure,
  identifyClusters,
} from './modes/split-module.js';

// Impact
export { runImpactAnalysis } from './modes/impact.js';

// Dead code
export { findDeadCode } from './modes/dead-code.js';

// ============================================\
// VUE АНАЛИЗАТОР\
// ============================================\

export {
  parseVueFile,
  analyzeVueComponent,
  generateVueComponentReport,
  enhanceWithVueAnalysis,
  type VueComponentAnalysis,
  type AnalysisOptions,
} from './modes/vue-analyzer/index.js';

// ============================================\
// СЕМАНТИЧЕСКИЙ АНАЛИЗ\
// ============================================\

export { CFGAnalyzer, type BasicBlock, type ControlFlowGraph } from './semantic/CFGAnalyzer.js';

export {
  CallGraphAnalyzer,
  type CallGraphNode,
  type CallGraph,
} from './semantic/CallGraphAnalyzer.js';

export {
  TypeAnalyzer,
  type TypeInfo as TypeInfoType,
  type TypeAnalysisResult,
  type TypeError,
} from './semantic/TypeAnalyzer.js';

export {
  DataFlowAnalyzer,
  type DataFlowNode,
  type DataFlowEdge,
  type DataFlowGraph,
} from './semantic/DataFlowAnalyzer.js';

export {
  SemanticPipeline,
  type PipelineResult,
  type PipelineIssue,
  type VerificationResult as PipelineVerificationResult,
} from './ci-cd/SemanticPipeline.js';

// ============================================\
// ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ\
// ============================================\

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

// ============================================\
// РЕФАКТОРИНГ\
// ============================================\

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

// ============================================\
// РЕПОРТЕРЫ\
// ✅ ИСПРАВЛЕНО: убран CompactReport (нет в reporters/index.ts),\
//    добавлены реальные экспортируемые типы\
// ============================================\

// Значения (функции)
export {
  generateFullReport,
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,
  Codec,
  generateHTMLReport,
  escapeHtml,
  generateInteractiveHTML,
  REPORTERS_VERSION,
  REPORTERS_NAME,
} from './reporters/index.js';

// Типы
export type {
  // Полный отчёт
  FullReport,

  // Компактный отчёт
  GenerateReportOptions,
  GenerateReportResult,

  // Codec
  FullJSON,
  CompactJSON,
  CodecLegend,
  ModuleData,
  FileData,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  StatisticsData,
} from './reporters/index.js';

// ============================================\
// АНАЛИЗАТОРЫ\
// ============================================\

export {
  extractDynamicImports,
  extractConfigRefs,
  extractExternalLibs,
  extractVueTemplates,
  extractAsyncChains,
  extractClosures,
  extractTypeDeps,
  analyzeContent,
  type DynamicImport,
  type ConfigRef,
  type ExternalLib,
  type VueTemplate,
  type AsyncChain,
  type Closure,
  type TypeDep,
  type AnalysisResult,
} from './analyzers/index.js';

// ============================================\
// ТИПЫ\
// ============================================\

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
  CallGraph as CallGraphType,

  // Кластеры
  Cluster,
  ClusterOptions,

  // Опции для режимов
  SplitModuleOptions,
  MinifyFolderOptions,
  PromptPackOptions,
  ImpactOptions,
  DeadCodeOptions,
  FileGraphOptions,

  // Конфигурация
  Config,

  // Результаты
  SplitModuleResult,
  MinifyFolderResult,
  ImpactReport,
  DeadCodeReport,

  // Связи
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  ExtendedFunctionInfo,

  // Графы
  GraphData,
  ProjectGraphOptions,

  // 🆕 Компактный отчёт (из types.ts, не из reporters)
  CompactReport,
  CompactModule,
  CompactFunction,
  CompactCall,
} from './types.js';

// ============================================\
// КОНФИГУРАЦИЯ И УТИЛИТЫ\
// ============================================\

export {
  SUPPORTED_EXTENSIONS,
  DEFAULT_EXCLUDE_PATTERNS,
  VUE_SCRIPT_PATTERN,
  IGNORE_NODE_MODULES,
} from './config.js';

export {
  showHelp,
  renderNode,
  formatFileSize,
  generateTempId,
  ensureDirectoryExists,
} from './utils.js';

// ============================================\
// ВЕРСИЯ\
// ============================================\

export const VERSION = '5.0.0';
export const NAME = 'ast-analyzer';

// ============================================\
// CLI - БЕЗ ЦИКЛИЧЕСКОЙ ЗАВИСИМОСТИ\
// ============================================\

export { CLIExecutor } from './cli/CLIExecutor.js';

// ✅ ИСПРАВЛЕНО: runCLI - это default экспорт из cli.js
// Используем import с правильным синтаксисом
import cli from './cli.js';

/**
 * Запуск CLI из командной строки
 * Используется как точка входа для CLI
 */
export const runCLI = cli.run.bind(cli);

// ============================================\
// ЭКСПОРТ ПО УМОЛЧАНИЮ\
// ============================================\

export default runCLI;
