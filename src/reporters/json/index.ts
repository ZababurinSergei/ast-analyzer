// packages/ast-analyzer/src/reporters/json/index.ts

// ============================================================
// JSON REPORTER - РЕФАКТОРИНГ v2.0
// ============================================================
// Единая точка входа для всех JSON-репортеров.
// Вся логика вынесена в подмодули для удобства поддержки.
//
// Структура:
//   json/
//   ├── index.ts                       — этот файл (реэкспорт всего)
//   ├── types.ts                       — реэкспорт типов
//   ├── utils/
//   │   ├── id-generator.ts            — simpleHash, generateFileId, generateFunctionId
//   │   ├── language-detector.ts       — detectLanguage
//   │   ├── path-resolver.ts           — resolveImportPath, resolveImportPathOld
//   │   └── entities-converter.ts      — convertEntitiesToEnhanced, createEmptyEntitiesResult
//   ├── importers/
//   │   └── importers-collector.ts     — collectImporters, getImportedName, findFunctionCallers
//   ├── consumers/
//   │   └── export-consumers.ts        — computeExportConsumers
//   ├── graphs/
//   │   ├── module-graph.ts            — buildModuleGraph
//   │   ├── entity-graph.ts            — buildEntityGraph
//   │   └── full-analysis.ts           — buildFullAnalysis
//   ├── savers/
//   │   ├── save-module-graph.ts       — saveModuleGraph
//   │   ├── save-entity-graph.ts       — saveEntityGraph
//   │   ├── save-full-analysis.ts      — saveFullAnalysis
//   │   └── save-call-graph.ts         — saveCallGraphResult
//   ├── relationships/
//   │   └── optimized-relationships.ts — buildOptimizedRelationships
//   ├── extractors/
//   │   └── extract-entities-from-file.ts — extractEntitiesFromFile
//   └── builders/
//       ├── enhanced-report.ts         — buildEnhancedPackageLockReport
//       ├── save-package-lock.ts       — savePackageLockReport
//       └── save-optimized.ts          — saveOptimizedPackageLockReport
// ============================================================

// ============================================================
// УТИЛИТЫ
// ============================================================

export {
  simpleHash,
  generateFileId,
  generateFunctionId,
} from './utils/id-generator.js';

export { detectLanguage } from './utils/language-detector.js';

export {
  resolveImportPath,
  resolveImportPathOld,
} from './utils/path-resolver.js';

export {
  convertEntitiesToEnhanced,
  createEmptyEntitiesResult,
} from './utils/entities-converter.js';

// ============================================================
// ИМПОРТЁРЫ И CONSUMERS
// ============================================================

export {
  collectImporters,
  getImportedName,
  findFunctionCallers,
} from './importers/importers-collector.js';

export { computeExportConsumers } from './consumers/export-consumers.js';

// ============================================================
// ГРАФЫ
// ============================================================

export { buildModuleGraph } from './graphs/module-graph.js';
export { buildEntityGraph } from './graphs/entity-graph.js';
export { buildFullAnalysis } from './graphs/full-analysis.js';

// ============================================================
// СОХРАНЕНИЕ ГРАФОВ
// ============================================================

export { saveModuleGraph } from './savers/save-module-graph.js';
export { saveEntityGraph } from './savers/save-entity-graph.js';
export { saveFullAnalysis } from './savers/save-full-analysis.js';
export { saveCallGraphResult } from './savers/save-call-graph.js';

// ============================================================
// СВЯЗИ
// ============================================================

export { buildOptimizedRelationships } from './relationships/optimized-relationships.js';

// ============================================================
// FALLBACK ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ
// ============================================================

export { extractEntitiesFromFile } from './extractors/extract-entities-from-file.js';

// ============================================================
// ПОСТРОИТЕЛИ ОТЧЁТОВ
// ============================================================

export { buildEnhancedPackageLockReport } from './builders/enhanced-report.js';
export { savePackageLockReport } from './builders/save-package-lock.js';
export { saveOptimizedPackageLockReport } from './builders/save-optimized.js';

// ============================================================
// РЕЭКСПОРТ ТИПОВ (из ./types.ts)
// ============================================================

export type {
  EnhancedPackageLockReport,
  EnhancedPackageInfo,
  EnhancedEntityInfo,
} from './types.js';

// ============================================================
// РЕЭКСПОРТ ТИПОВ (из ../../types.js — основной)
// ============================================================

export type {
  // Основные типы
  GraphData,
  EntitiesResult,
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  OptimizedReportOptions,

  // Функции
  FunctionInfo,
  ExtendedFunctionInfo,
  EnhancedFunctionInfo,
  FunctionEntity,

  // Классы и структуры
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,

  // Импорты/экспорты
  ImportInfo,
  ExportInfo,
  CallInfo,
  CalledByInfo,
  ImportedByInfo,

  // Пакеты
  PackageLockImportInfo,

  // Связи
  SecurityInfo,
  ImportExportItem,
  Location,
} from '../../types.js';

// ============================================================
// РЕЭКСПОРТ ТИПОВ (из ../../modules/types.js)
// ============================================================

export type {
  ModuleNode,
  ModuleEdge,
  ModuleGraph,
  EntityNode,
  EntityEdge,
  EntityGraph,
  EntityStats,
  FileStats,
  RelationshipReport,
  ExtendedFunctionEntity,
} from '../../modules/types.js';

// ============================================================
// РЕЭКСПОРТ УТИЛИТ ИЗ modules/
// ============================================================

// Утилиты общего назначения (массивы, безопасные преобразования)
export {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
  normalizePathForDisplay,
  getFileName,
  getFileExtension,
  getFileDirectory,
  isTypeScriptFile,
  isJavaScriptFile,
  isVueFile,
  isJsxFile,
  shortenPath,
  generateVscodeLink,
  generateFunctionId as generateFunctionIdFromUtils,
  generateFileId as generateFileIdFromUtils,
  isAbsolutePath,
  getRelativePath,
} from '../../modules/utils.js';

// Метаданные
export {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from '../../modules/metadata.js';

// Статистика
export {
  calculateEntityStats,
  calculateFileStats,
} from '../../modules/statistics.js';

// Графы
export {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from '../../modules/graphs.js';

// Потоки
export {
  buildExecutionGraph,
  buildImportExportFlow,
} from '../../modules/flows.js';

// Архитектура
export { buildArchitectureMetrics } from '../../modules/architecture.js';

// Резюме
export { buildSummary } from '../../modules/summary.js';

// Пакеты
export { buildPackages } from '../../modules/packages.js';

// Default security
export { createDefaultSecurity } from '../../modules/types.js';

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

// Импортируем функции для default-экспорта (они уже реэкспортированы выше,
// но нужно получить их локально, чтобы собрать в один объект)
import { buildEnhancedPackageLockReport } from './builders/enhanced-report.js';
import { savePackageLockReport } from './builders/save-package-lock.js';
import { saveOptimizedPackageLockReport } from './builders/save-optimized.js';
import { extractEntitiesFromFile } from './extractors/extract-entities-from-file.js';
import { buildModuleGraph } from './graphs/module-graph.js';
import { buildEntityGraph } from './graphs/entity-graph.js';
import { buildFullAnalysis } from './graphs/full-analysis.js';
import { saveModuleGraph } from './savers/save-module-graph.js';
import { saveEntityGraph } from './savers/save-entity-graph.js';
import { saveFullAnalysis } from './savers/save-full-analysis.js';
import { saveCallGraphResult } from './savers/save-call-graph.js';
import { buildOptimizedRelationships } from './relationships/optimized-relationships.js';
import { computeExportConsumers } from './consumers/export-consumers.js';
import {
  collectImporters,
  getImportedName,
  findFunctionCallers,
} from './importers/importers-collector.js';
import {
  simpleHash,
  generateFileId,
  generateFunctionId,
} from './utils/id-generator.js';
import { detectLanguage } from './utils/language-detector.js';
import {
  resolveImportPath,
  resolveImportPathOld,
} from './utils/path-resolver.js';
import {
  convertEntitiesToEnhanced,
  createEmptyEntitiesResult,
} from './utils/entities-converter.js';

export default {
  // === Построители отчётов ===
  buildEnhancedPackageLockReport,
  savePackageLockReport,
  saveOptimizedPackageLockReport,

  // === Fallback ===
  extractEntitiesFromFile,

  // === Графы ===
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,

  // === Сохранение графов ===
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  saveCallGraphResult,

  // === Связи ===
  buildOptimizedRelationships,

  // === Consumers / Importers ===
  computeExportConsumers,
  collectImporters,
  getImportedName,
  findFunctionCallers,

  // === Утилиты ===
  simpleHash,
  generateFileId,
  generateFunctionId,
  detectLanguage,
  resolveImportPath,
  resolveImportPathOld,
  convertEntitiesToEnhanced,
  createEmptyEntitiesResult,
};

// ============================================================
// ВЕРСИЯ МОДУЛЯ
// ============================================================

export const JSON_REPORTER_VERSION = '2.0.0';
export const JSON_REPORTER_NAME = '@newkind/ast-analyzer/reporters/json';