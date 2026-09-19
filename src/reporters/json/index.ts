// src/reporters/json/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ JSON-РЕПОРТЕРОВ
// ============================================================
// Версия: 2.0.1
//
// ИЗМЕНЕНИЯ v2.0.1 (исправление ошибок компиляции):
//   - ✅ УДАЛЕНЫ несуществующие экспорты типов:
//     PackageLockImportInfo, ImportSpecifier,
//     CompactReport, CompactModule, CompactFunction,
//     ExtendedFunctionEntity.
//     Эти типы либо не существуют, либо экспортируются
//     из других мест (src/types.ts).
//
// ИЗМЕНЕНИЯ v2.0.0 (устранение дублирования типов):
//   - ✅ УБРАНЫ реэкспорты типов из '../../types.js' — они больше
//     не нужны, потому что эти же типы уже реэкспортируются через
//     './types.js' (который в свою очередь реэкспортирует из '../../types.js').
//   - ✅ УБРАНЫ реэкспорты из '../../modules/types.js' — заменены
//     на реэкспорт из './types.js'.
//   - ✅ УБРАНЫ реэкспорты из '../../modules/utils.js' — теперь
//     реэкспортируются из './types.js' (если нужно) или напрямую.
//   - ✅ УБРАНЫ реэкспорты из '../../modules/metadata.js', './statistics.js',
//     './graphs.js', './flows.js', './architecture.js', './summary.js',
//     './packages.js' — они не относятся к json-репортерам напрямую.
//     Если нужно — импортируйте из '../../modules/...'.
//   - ✅ ОСТАВЛЕНЫ только те реэкспорты, которые действительно
//     относятся к json-репортерам:
//       * функции построения графов (graphs/*)
//       * функции-сохранятели (savers/*)
//       * построители отчётов (builders/*)
//       * утилиты (utils/*)
//       * импортёры/consumers (importers/*, consumers/*)
//       * extract-entities-from-file (extractors/*)
//       * relationships (relationships/*)
//   - ✅ ТИПЫ вынесены в './types.js' и реэкспортируются оттуда.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая структура: реэкспорт всех функций из подмодулей.
// ============================================================

// ============================================================
// 1. УТИЛИТЫ
// ============================================================
// Функции для работы с ID, путями, языками, конвертацией сущностей.
// ============================================================

export {
  /** Простой хеш строки в base36 */
  simpleHash,
  /** Стабильный ID файла */
  generateFileId,
  /** Стабильный ID функции */
  generateFunctionId,
  /** Стабильный ID модуля */
  generateModuleId,
  /** SHA-256 хеш контента */
  generateContentHash,
  /** Пара ID (файл + функция) одним вызовом */
  generateEntityIds,
  /** Проверка формата ID */
  isValidIdFormat,
} from './utils/id-generator.js';

export {
  /** Определение языка по расширению файла */
  detectLanguage,
  /** Проверка: TypeScript-подобный файл */
  isTypeScriptLike,
  /** Проверка: Vue SFC */
  isVueFile,
  /** Проверка: JSX/TSX */
  isJsxFile,
} from './utils/language-detector.js';

export {
  /** Расширенный резолвинг путей импортов (алиасы, относительные) */
  resolveImportPath,
  /** Упрощённый резолвинг путей (для consumers/flow) */
  resolveImportPathOld,
} from './utils/path-resolver.js';

export {
  /** Конвертация EntitiesResult → EnhancedEntityInfo */
  convertEntitiesToEnhanced,
  /** Создание пустого EntitiesResult */
  createEmptyEntitiesResult,
} from './utils/entities-converter.js';

// ============================================================
// 2. ИМПОРТЁРЫ И CONSUMERS
// ============================================================
// Функции для сбора импортёров, потребителей и вызывающих.
// ============================================================

export {
  /** Собрать импортёров для всех функций проекта */
  collectImporters,
  /** Получить локальное имя импортированной сущности (alias) */
  getImportedName,
  /** Найти все модули, вызывающие функцию */
  findFunctionCallers,
} from './importers/importers-collector.js';

export {
  /** Вычислить consumers для всех экспортов */
  computeExportConsumers,
} from './consumers/export-consumers.js';

// ============================================================
// 3. ГРАФЫ
// ============================================================
// Функции для построения графов модулей и сущностей.
// ============================================================

export {
  /** Построить граф модулей проекта */
  buildModuleGraph,
} from './graphs/module-graph.js';

export {
  /** Построить граф сущностей проекта */
  buildEntityGraph,
} from './graphs/entity-graph.js';

export {
  /** Построить полный анализ (модули + сущности) */
  buildFullAnalysis,
} from './graphs/full-analysis.js';

// ============================================================
// 4. СОХРАНЕНИЕ ГРАФОВ
// ============================================================
// Функции для сохранения графов на диск.
// ============================================================

export {
  /** Сохранить граф модулей */
  saveModuleGraph,
} from './savers/save-module-graph.js';

export {
  /** Сохранить граф сущностей */
  saveEntityGraph,
} from './savers/save-entity-graph.js';

export {
  /** Сохранить полный анализ */
  saveFullAnalysis,
} from './savers/save-full-analysis.js';

export {
  /** Сохранить результат анализа графа вызовов */
  saveCallGraphResult,
} from './savers/save-call-graph.js';

// ============================================================
// 5. СВЯЗИ
// ============================================================
// Функции для построения отношений между функциями.
// ============================================================

export {
  /** Построить отношения (calls, calledBy, importedBy) */
  buildOptimizedRelationships,
} from './relationships/optimized-relationships.js';

// ============================================================
// 6. EXTRACTORS
// ============================================================
// Извлечение сущностей из файла (fallback через entity-extractor).
// ============================================================

export {
  /** Извлечь сущности из файла (обёртка над entity-extractor) */
  extractEntitiesFromFile,
} from './extractors/extract-entities-from-file.js';

// ============================================================
// 7. ПОСТРОИТЕЛИ ОТЧЁТОВ
// ============================================================
// Функции для построения и сохранения отчётов.
// ============================================================

export {
  /** Построить EnhancedPackageLockReport (без сохранения) */
  buildEnhancedPackageLockReport,
} from './builders/enhanced-report.js';

export {
  /** Сохранить EnhancedPackageLockReport на диск */
  savePackageLockReport,
} from './builders/save-package-lock.js';

export {
  /** Сохранить оптимизированный отчёт со встроенными связями */
  saveOptimizedPackageLockReport,
} from './builders/save-optimized.js';

// ============================================================
// 8. ТИПЫ
// ============================================================
// Все типы собраны в './types.js', который реэкспортирует
// Enhanced-типы из '../../types.js' и определяет уникальные
// типы для reporters/modules.
//
// ✅ ИСПРАВЛЕНО v2.0.1: удалены несуществующие экспорты типов:
//   - PackageLockImportInfo
//   - ImportSpecifier
//   - CompactReport
//   - CompactModule
//   - CompactFunction
//   - ExtendedFunctionEntity
// ============================================================

export type {
  // ==========================================
  // Enhanced-сущности (из ../../types.js через ./types.js)
  // ==========================================
  EnhancedEntityInfo,
  EnhancedFunctionInfo,
  EnhancedConstantInfo,
  EnhancedVariableInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  EnhancedClassInfo,
  EnhancedPackageInfo,
  EnhancedPackageLockReport,

  // ==========================================
  // Базовые сущности
  // ==========================================
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,

  // ==========================================
  // Импорты/экспорты/связи
  // ==========================================
  ImportInfo,
  ExportInfo,
  Location,
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  ExtendedFunctionInfo,

  // ==========================================
  // Архитектура и резюме
  // ==========================================
  ArchitectureMetrics,
  ProjectSummary,

  // ==========================================
  // Vue
  // ==========================================
  VueAnalysis,

  // ==========================================
  // Опции
  // ==========================================
  OptimizedReportOptions,
} from './types.js';

// ============================================================
// 9. УНИКАЛЬНЫЕ ТИПЫ REPORTERS/MODULES
// ============================================================
// Типы, которые не дублируются в других местах и специфичны
// для reporters/modules.
//
// ✅ ИСПРАВЛЕНО v2.0.1: удалён несуществующий тип
//   ExtendedFunctionEntity.
// ============================================================

export type {
  // ==========================================
  // Граф модулей
  // ==========================================
  ModuleNode,
  ModuleEdge,
  ModuleGraph,

  // ==========================================
  // Граф сущностей
  // ==========================================
  EntityNode,
  EntityEdge,
  EntityGraph,

  // ==========================================
  // Сущность-функция
  // ==========================================
  FunctionEntity,

  // ==========================================
  // Статистика
  // ==========================================
  EntityStats,
  FileStats,

  // ==========================================
  // Отчёт со встроенными связями
  // ==========================================
  RelationshipReport,

  // ==========================================
  // Вспомогательные
  // ==========================================
  ImportExportItem,
} from './types.js';

// ============================================================
// 10. КОНСТАНТЫ МОДУЛЯ
// ============================================================

/**
 * Версия модуля reporters/json.
 */
export const JSON_REPORTER_VERSION = '2.0.1';

/**
 * Имя модуля reporters/json.
 */
export const JSON_REPORTER_NAME = '@newkind/ast-analyzer/reporters/json';

// ============================================================
// 11. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
// Импортируем все функции локально, чтобы собрать их в один
// объект для удобного использования:
//
//   import jsonReporter from './reporters/json/index.js';
//   jsonReporter.extractEntitiesFromFile(path);
//   jsonReporter.buildFullAnalysis(data, entities, root);
// ============================================================

import {
  // Утилиты
  simpleHash,
  generateFileId,
  generateFunctionId,
  generateModuleId,
  generateContentHash,
  generateEntityIds,
  isValidIdFormat,
  detectLanguage,
  isTypeScriptLike,
  isVueFile,
  isJsxFile,
  resolveImportPath,
  resolveImportPathOld,
  convertEntitiesToEnhanced,
  createEmptyEntitiesResult,
  // Импортёры/consumers
  collectImporters,
  getImportedName,
  findFunctionCallers,
  computeExportConsumers,
  // Графы
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  // Сохранение
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  saveCallGraphResult,
  // Связи
  buildOptimizedRelationships,
  // Extractors
  extractEntitiesFromFile,
  // Построители
  buildEnhancedPackageLockReport,
  savePackageLockReport,
  saveOptimizedPackageLockReport,
} from './index.js';

export default {
  // ==========================================
  // Утилиты
  // ==========================================
  simpleHash,
  generateFileId,
  generateFunctionId,
  generateModuleId,
  generateContentHash,
  generateEntityIds,
  isValidIdFormat,
  detectLanguage,
  isTypeScriptLike,
  isVueFile,
  isJsxFile,
  resolveImportPath,
  resolveImportPathOld,
  convertEntitiesToEnhanced,
  createEmptyEntitiesResult,

  // ==========================================
  // Импортёры/consumers
  // ==========================================
  collectImporters,
  getImportedName,
  findFunctionCallers,
  computeExportConsumers,

  // ==========================================
  // Графы
  // ==========================================
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,

  // ==========================================
  // Сохранение
  // ==========================================
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  saveCallGraphResult,

  // ==========================================
  // Связи
  // ==========================================
  buildOptimizedRelationships,

  // ==========================================
  // Extractors
  // ==========================================
  extractEntitiesFromFile,

  // ==========================================
  // Построители отчётов
  // ==========================================
  buildEnhancedPackageLockReport,
  savePackageLockReport,
  saveOptimizedPackageLockReport,

  // ==========================================
  // Константы
  // ==========================================
  JSON_REPORTER_VERSION,
  JSON_REPORTER_NAME,
};
