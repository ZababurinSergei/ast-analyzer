// packages/ast-analyzer/src/reporters/modules/types.ts

// ============================================================
// ТИПЫ ДЛЯ МОДУЛЕЙ REPORTERS
// ============================================================
// Версия: 2.2.0
//
// ИЗМЕНЕНИЯ v2.2.0:
//   - ✅ ДОБАВЛЕНО: импорт ExtendedFunctionInfo из ../../types.js
//     (устранена ошибка TS2304: Cannot find name 'ExtendedFunctionInfo')
//
// ИЗМЕНЕНИЯ v2.1.0:
//   - ✅ ДОБАВЛЕНО: поля parentFunction и depth в FunctionEntity
//     (для устранения TS2339 в entity-graph.ts)
//   - ✅ УДАЛЕНО: PackageLockImportInfo из реэкспорта ../../types.js
//     (тип не экспортируется из основного types.ts)
//   - ✅ ДОБАВЛЕНО: импорт ExtendedFunctionInfo из ../../types.js
//     для использования в RelationshipReport
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - Реэкспорт типов из ../../types.js
//   - Определение локальных типов для graph'ов и статистики
// ============================================================

// ============================================================
// ИМПОРТ ТИПОВ ИЗ ОСНОВНОГО types.ts
// ============================================================
// ✅ ИСПРАВЛЕНО v2.2.0: ExtendedFunctionInfo импортируется для
// использования в RelationshipReport (устранена ошибка TS2304)
// ============================================================

import type { ExtendedFunctionInfo } from '../../types.js';

// ============================================================
// РЕЭКСПОРТ ТИПОВ ИЗ ОСНОВНОГО types.ts
// ============================================================

export type {
  // === Базовые сущности ===
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,

  // === Импорты/экспорты ===
  ImportInfo,
  ExportInfo,
  Location,

  // === Связи ===
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  ExtendedFunctionInfo,

  // === Основные структуры ===
  EntitiesResult,
  GraphData,
  FullAnalysis,

  // === Архитектура ===
  ArchitectureMetrics,
  ProjectSummary,

  // === Vue ===
  VueAnalysis,

  // === Enhanced-типы ===
  EnhancedPackageInfo,
  EnhancedPackageLockReport,
  EnhancedEntityInfo,
  EnhancedFunctionInfo,
  EnhancedConstantInfo,
  EnhancedVariableInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  EnhancedClassInfo,

  // === Опции ===
  OptimizedReportOptions,
} from '../../types.js';

// ============================================================
// ТИПЫ ДЛЯ ГРАФА МОДУЛЕЙ
// ============================================================

/**
 * Узел графа модулей.
 */
export interface ModuleNode {
  /** Уникальный идентификатор модуля (путь к файлу) */
  id: string;
  /** Имя файла */
  name: string;
  /** Путь к файлу */
  path: string;
  /** Тип модуля */
  type: 'module' | 'component' | 'vue' | 'external';
  /** Уровень в дереве зависимостей (0 = корень) */
  level: number;
  /** Метаданные модуля */
  metadata: {
    /** Размер файла в байтах */
    size: number;
    /** Количество строк */
    lines: number;
    /** Язык программирования */
    language: 'javascript' | 'typescript' | 'vue' | 'jsx' | 'unknown';
    /** Является ли точкой входа */
    isEntry: boolean;
    /** Количество функций */
    functionsCount?: number;
    /** Количество классов */
    classesCount?: number;
    /** Количество экспортов */
    exportsCount?: number;
  };
}

/**
 * Ребро графа модулей.
 */
export interface ModuleEdge {
  /** Откуда (модуль-источник) */
  from: string;
  /** Куда (модуль-цель) */
  to: string;
  /** Тип связи */
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  /** Что именно импортируется */
  specifiers: string[];
  /** Исходный код */
  sourceCode?: string;
}

/**
 * Граф модулей.
 */
export interface ModuleGraph {
  /** Узлы графа */
  nodes: ModuleNode[];
  /** Ребра графа */
  edges: ModuleEdge[];
  /** Статистика графа */
  stats?: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

// ============================================================
// ТИПЫ ДЛЯ ГРАФА СУЩНОСТЕЙ
// ============================================================

/**
 * Функция как сущность графа.
 *
 * ✅ v2.1.0: добавлены поля parentFunction и depth
 * для совместимости с entity-graph.ts.
 */
export interface FunctionEntity {
  /** Имя функции */
  name: string;
  /** ID функции */
  id?: string;
  /** Номер строки */
  line: number;
  /** Начальная строка */
  startLine: number;
  /** Конечная строка */
  endLine: number;
  /** Асинхронная ли функция */
  isAsync: boolean;
  /** Экспортируется ли */
  isExported: boolean;
  /** Параметры */
  params: string[];
  /** Тип возвращаемого значения */
  returnType?: string;
  /** Кого вызывает */
  calls: string[];
  /** Кто вызывает */
  calledBy: string[];
  /** Тело функции */
  body?: string;
  /** Является ли методом класса */
  isMethod?: boolean;
  /** Имя класса */
  className?: string;
  /** Является ли вложенной */
  isNested?: boolean;
  /** ✅ НОВОЕ v2.1.0: имя родительской функции */
  parentFunction?: string;
  /** ✅ НОВОЕ v2.1.0: глубина вложенности */
  depth?: number;
  /** Является ли стрелочной */
  isArrow?: boolean;
  /** Является ли обработчиком события */
  isEventHandler?: boolean;
  /** Тип события */
  eventType?: string;
  /** Цикломатическая сложность */
  complexity?: number;
  /** Информация о безопасности */
  security?: SecurityInfo;
  /** VSCode-ссылка */
  vscode?: string;
  /** Сигнатура */
  signature?: string;
  /** Является ли изолированной (self) функцией */
  isSelf?: boolean;
  /** Внутренний флаг isSelf */
  _isSelf?: boolean;
  /** Путь к файлу */
  filePath?: string;
  /** Имя модуля */
  moduleName?: string;
  /** Путь к модулю */
  _modulePath?: string;
  /** ID модуля */
  moduleId?: string;
  /** ID файла */
  fileId?: string;
  /** Уникальный ключ */
  _uniqueKey?: string;
  /** Полный путь */
  _fullPath?: string;
}

/**
 * Расширенная информация о функции (в графе сущностей).
 */
export interface ExtendedFunctionEntity extends FunctionEntity {
  /** ID модуля */
  moduleId?: string;
  /** ID файла */
  fileId?: string;
}

/**
 * Узел графа сущностей.
 */
export interface EntityNode {
  /** Уникальный идентификатор: {module}#{entity} */
  id: string;
  /** Имя сущности */
  name: string;
  /** Тип сущности */
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'enum' | 'module';
  /** Родительский модуль */
  module: string;
  /** Строка объявления */
  line: number;
  /** Метаданные сущности */
  metadata: {
    /** Экспортируется ли */
    isExported: boolean;
    /** Тип данных */
    dataType?: string;
    /** Значение */
    value?: unknown;
    /** Параметры функции */
    params?: string[];
    /** Тип возврата */
    returnType?: string;
    /** Async */
    isAsync?: boolean;
    /** Метод класса */
    isMethod?: boolean;
    /** Имя класса */
    className?: string;
    /** Свойства */
    properties?: string[];
    /** Методы */
    methods?: string[];
    /** Наследование */
    extends?: string;
    /** Имплементация */
    implements?: string[];
    /** Расширение интерфейса */
    extendsInterfaces?: string[];
    /** Определение типа */
    definition?: string;
    /** Кем вызывается */
    calledBy?: string[];
    /** Кого вызывает */
    calls?: string[];
    /** Начальная строка */
    startLine?: number;
    /** Конечная строка */
    endLine?: number;
    /** Видимость */
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    /** Теги */
    tags?: string[];
    /** Сложность */
    complexity?: number;
    /** Информация о безопасности */
    security?: SecurityInfo;
    /** Тело */
    body?: string;
    /** VSCode-ссылка */
    vscode?: string;
    /** ID */
    id?: string;
    /** Сигнатура */
    signature?: string;
    /** Импортировано из */
    importedFrom?: string;
    /** Тип */
    type?: string;
  };
}

/**
 * Ребро графа сущностей.
 */
export interface EntityEdge {
  /** Откуда */
  from: string;
  /** Куда */
  to: string;
  /** Тип связи */
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
  /** Строка */
  line?: number;
  /** Количество */
  count?: number;
}

/**
 * Граф сущностей.
 */
export interface EntityGraph {
  /** Узлы графа */
  nodes: EntityNode[];
  /** Ребра графа */
  edges: EntityEdge[];
  /** Статистика графа */
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

// ============================================================
// СТАТИСТИКА
// ============================================================

/**
 * Статистика по сущностям.
 */
export interface EntityStats {
  /** Общее количество */
  total: number;
  /** Экспортированные */
  exported: number;
  /** Приватные */
  private: number;
  /** По модулям */
  byModule: Record<string, number>;
  /** По типам */
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

/**
 * Статистика по файлам.
 */
export interface FileStats {
  /** Всего файлов */
  totalFiles: number;
  /** Общий размер */
  totalSize: number;
  /** Общее количество строк */
  totalLines: number;
  /** По языкам */
  byLanguage?: Record<string, number>;
}

// ============================================================
// ОТЧЁТ СО ВСТРОЕННЫМИ СВЯЗЯМИ
// ============================================================

/**
 * Отчёт со встроенными связями.
 *
 * ✅ v2.2.0: используем ExtendedFunctionInfo из ../../types.js
 * (устранена ошибка TS2304: Cannot find name 'ExtendedFunctionInfo').
 */
export interface RelationshipReport {
  /** Версия */
  version: string;
  /** Timestamp */
  timestamp: string;
  /** Корневой модуль */
  root: string;
  /** Сущности с встроенными связями */
  entities: Record<string, ExtendedFunctionInfo>;
  /** Статистика */
  stats?: {
    totalFunctions: number;
    totalCalls: number;
    totalCalledBy: number;
    totalImportedBy: number;
    totalFiles: number;
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

/**
 * Элемент импорта/экспорта.
 */
export interface ImportExportItem {
  /** Имя */
  name: string;
  /** Тип */
  type: 'import' | 'export';
  /** Источник */
  source: string;
  /** Строка */
  line: number;
}

/**
 * Информация о безопасности функции.
 */
export interface SecurityInfo {
  hasEval: boolean;
  hasProcessEnv: boolean;
  hasSensitiveData: boolean;
  hasExec: boolean;
  hasPassword: boolean;
}

/**
 * Создаёт объект SecurityInfo по умолчанию.
 *
 * ✅ v2.1.0: функция перенесена сюда, чтобы её можно было
 * импортировать из '../../modules/types.js'. Ранее она
 * использовалась как `createDefaultSecurity` в:
 *   - save-package-lock.ts
 *   - entity-graph.ts
 *   - entities-converter.ts
 */
export function createDefaultSecurity(): SecurityInfo {
  return {
    hasEval: false,
    hasProcessEnv: false,
    hasSensitiveData: false,
    hasExec: false,
    hasPassword: false,
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  createDefaultSecurity,
};
