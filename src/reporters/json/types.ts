// packages/ast-analyzer/src/reporters/json/types.ts

// ============================================================
// РЕЭКСПОРТ ТИПОВ ДЛЯ JSON-РЕПОРТЕРОВ
// ------------------------------------------------------------
// Все типы живут в основных модулях (`../../types.js`,
// `../modules/types.js`). Здесь — только агрегация, чтобы
// потребители json-reporter'а могли импортировать всё из
// одного места.
// ============================================================

// ============================================================
// ОСНОВНЫЕ ТИПЫ (из ../../types.js)
// ============================================================

export type {
  // === Сущности ===
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,

  // === Импорты/экспорты ===
  ImportInfo,
  ExportInfo,

  // === Связи (встроенный формат, v3.0.1) ===
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  ExtendedFunctionInfo,

  // === Основные структуры анализа ===
  EntitiesResult,
  GraphData,
  FullAnalysis,
  Location,

  // === Архитектурные метрики ===
  ArchitectureMetrics,
  ProjectSummary,

  // === Vue ===
  VueAnalysis,

  // === Опции отчётов ===
  OptimizedReportOptions,
} from '../../types.js';

// ============================================================
// ТИПЫ ПАКЕТОВ (из ../../types.js)
// ============================================================

export type {
  EnhancedPackageInfo,
  EnhancedPackageLockReport,
  EnhancedEntityInfo,
  EnhancedFunctionInfo,
  EnhancedConstantInfo,
  EnhancedVariableInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  EnhancedClassInfo,
  // ✅ ИСПРАВЛЕНО: PackageLockImportInfo и SecurityInfo
  //    не экспортируются из '../../types.js' → удалены
  // PackageLockImportInfo,
  // SecurityInfo,
} from '../../types.js';

// ============================================================
// ТИПЫ ГРАФОВ И СУЩНОСТЕЙ (из ../modules/types.js)
// ============================================================

export type {
  // === Граф модулей ===
  ModuleNode,
  ModuleEdge,
  ModuleGraph,

  // === Граф сущностей ===
  EntityNode,
  EntityEdge,
  EntityGraph,
  EntityStats,

  // === Сущности ===
  FunctionEntity,

  // === Статистика ===
  FileStats,

  // === Отчёт со встроенными связями ===
  RelationshipReport,

  // === Вспомогательные ===
  ImportExportItem,
} from '../modules/types.js';

// ============================================================
// ЛОКАЛЬНЫЕ ТИПЫ JSON-РЕПОРТЕРОВ
// ============================================================

// ✅ ИСПРАВЛЕНО: удалён неиспользуемый импорт ExportInfo
// import type { ExportInfo } from '../../types.js';

import type { EnhancedEntityInfo, ModuleNode, EntityNode } from '../modules/types.js';

// ------------------------------------------------------------
// 1. ReExportEntry — компактный формат реэкспорта (gr.re)
// ------------------------------------------------------------

/**
 * Запись о реэкспорте в компактном формате.
 *
 * Соответствует схеме `gr.re` (7 полей) в `ast-analyzer-codec.js`.
 * Используется в `compact-entity-reporter.ts`.
 *
 * Поля:
 *   moduleIdx     — индекс модуля в moduleIndex (m1 → 1)
 *   funcIdx       — индекс функции или -1 (для модульных реэкспортов всегда -1)
 *   sourceIdx     — индекс источника в stringDict ("./components/ui")
 *   exportNameIdx — индекс имени экспорта в stringDict ("*" или "ns")
 *   line          — строка в исходном файле
 *   typeCode      — "all" (star) | "n" (named) | "df" (default)
 *   isTypeOnly    — 0 | 1 (export type * from)
 */
export interface ReExportEntry {
  moduleIdx: number;
  funcIdx: number;
  sourceIdx: number;
  exportNameIdx: number;
  line: number;
  typeCode: 'all' | 'n' | 'df';
  isTypeOnly: boolean;
}

// ------------------------------------------------------------
// 2. Опции построения JSON-отчётов
// ------------------------------------------------------------

/**
 * Опции построения enhanced package-lock отчёта.
 */
export interface BuildReportOptions {
  /** Включать тела функций в отчёт */
  includeBody?: boolean;
  /** Включать VSCode-ссылки */
  includeVscodeLinks?: boolean;
  /** Включать статистику */
  includeStats?: boolean;
  /** Включать расширенные метаданные */
  includeMetadata?: boolean;
}

/**
 * Опции построения оптимизированного отчёта.
 * (Синоним `OptimizedReportOptions`, оставлен для удобства.)
 */
export type SaveOptimizedOptions = BuildReportOptions;

// ------------------------------------------------------------
// 3. Результаты работы builder'ов
// ------------------------------------------------------------

/**
 * Результат построения enhanced report (без записи на диск).
 */
export interface EnhancedReportResult {
  report: import('../../types.js').EnhancedPackageLockReport;
  /** Путь, куда был сохранён отчёт (если сохранялся) */
  reportPath?: string;
}

/**
 * Результат построения оптимизированного отчёта.
 */
export interface OptimizedReportResult {
  entities: Record<string, import('../../types.js').ExtendedFunctionInfo>;
  stats: {
    totalFunctions: number;
    totalCalls: number;
    totalCalledBy: number;
    totalImportedBy: number;
    totalFiles: number;
  };
}

// ------------------------------------------------------------
// 4. Промежуточные структуры для builder'ов
// ------------------------------------------------------------

/**
 * Запись экспорта в `exportsMap` (мутируется при вычислении consumers).
 */
export interface ExportEntry {
  direction: 'outward';
  type: string;
  line: number;
  consumers: Array<{
    module: string;
    direction: 'inward';
    type: 'import' | 'call';
    specifier?: string;
    localName?: string;
    line?: number;
    viaReExport?: string;
  }>;
  // Поля, специфичные для функций
  isAsync?: boolean;
  params?: string[];
  returns?: string;
  id?: string;
  vscode?: string;
  // Поля, специфичные для констант/переменных
  value?: any;
  // Поля, специфичные для классов
  methods?: string[];
  // Поля, специфичные для интерфейсов
  properties?: string[];
  // Поля, специфичные для типов
  definition?: string;
  // Поля, специфичные для реэкспортов
  exportName?: string;
  localName?: string;
  source?: string;
  isTypeOnly?: boolean;
  isReExport?: boolean;
  isStarReExport?: boolean;
  isDefaultReExport?: boolean;
}

/**
 * Запись импорта в `importsMap`.
 */
export interface ImportEntry {
  direction: 'inward';
  type: string;
  specifiers: string[];
  functions: Record<string, any>;
}

// ------------------------------------------------------------
// 5. Вспомогательные типы для consumers
// ------------------------------------------------------------

/**
 * Информация об импортёре функции.
 * Используется в `collectImporters`.
 */
export interface ImporterRecord {
  importerId: string;
  importerFile: string;
  importerVscode: string;
  importLine: number;
  specifier: string;
  importType?: 'named' | 'default' | 'namespace' | 'type';
}

/**
 * Отношения между функциями (calls, calledBy, importedBy).
 * Используется в `buildOptimizedRelationships`.
 */
export interface FunctionRelationships {
  calls: Record<string, import('../../types.js').CallInfo[]>;
  calledBy: Record<string, import('../../types.js').CalledByInfo[]>;
  importedBy: Record<string, import('../../types.js').ImportedByInfo[]>;
}

// ------------------------------------------------------------
// 6. Агрегированные типы для удобства
// ------------------------------------------------------------

/**
 * Всё, что может вернуть `extractEntitiesFromFile`.
 */
export type ExtractedEntities = EnhancedEntityInfo;

/**
 * Всё, что может вернуть `buildModuleGraph`.
 */
export type BuiltModuleGraph = {
  nodes: ModuleNode[];
  edges: Array<{
    from: string;
    to: string;
    type: 'import' | 'external' | 're-export' | 'dynamic_import';
    specifiers: string[];
    sourceCode?: string;
  }>;
};

/**
 * Узел графа сущностей (синоним для удобства).
 */
export type BuiltEntityNode = EntityNode;

// ------------------------------------------------------------
// 7. Типы для внутренней логики savePackageLockReport
// ------------------------------------------------------------

/**
 * Результат `buildPackagesAndMaps`.
 */
export interface PackagesAndMapsResult {
  packages: Record<string, any>;
  exportsMap: Record<string, Record<string, ExportEntry>>;
}

/**
 * Параметры `buildFinalReport`.
 */
export interface BuildFinalReportParams {
  rootKey: string;
  graph: Record<string, string[]>;
  normalizedEntitiesMap: Record<string, import('../../types.js').EntitiesResult>;
  packages: Record<string, any>;
  dependencyGraph: {
    inwardDependencies: Record<string, string[]>;
    outwardDependencies: Record<string, string[]>;
  };
  executionGraph: any;
  rawImportExportFlow: any;
}

// ============================================================
// РЕЭКСПОРТ ЛОКАЛЬНЫХ ТИПОВ (для потребителей)
// ============================================================

export type {
  // Из entities-converter
  EnhancedEntityInfo as ConvertedEntityInfo,
};

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  // Типы экспортируются только через `export type`, значение
  // по умолчанию оставлено пустым для совместимости с
  // инструментами, которые ожидают default export.
};
