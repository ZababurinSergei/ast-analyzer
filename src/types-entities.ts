// packages/ast-analyzer/src/types-entities.ts

export * from './core/entity-extractor.js';

// ============================================
// ТИПЫ ДЛЯ ГРАФА МОДУЛЕЙ
// ============================================

export interface ModuleGraphNode {
  /** Уникальный идентификатор модуля (путь к файлу) */
  id: string;
  /** Имя файла */
  name: string;
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
    /** Количество функций в модуле */
    functionsCount?: number;
    /** Количество классов в модуле */
    classesCount?: number;
    /** Количество экспортов */
    exportsCount?: number;
  };
}

export interface ModuleGraphEdge {
  /** Откуда (модуль-источник) */
  from: string;
  /** Куда (модуль-цель) */
  to: string;
  /** Тип связи */
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  /** Что именно импортируется (имена сущностей) */
  specifiers: string[];
  /** Строка импорта (оригинальный код) */
  sourceCode?: string;
}

export interface ModuleGraph {
  /** Узлы графа модулей */
  nodes: ModuleGraphNode[];
  /** Ребра графа модулей */
  edges: ModuleGraphEdge[];
  /** Статистика графа */
  stats?: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

// ============================================
// ТИПЫ ДЛЯ ГРАФА СУЩНОСТЕЙ
// ============================================

export interface EntityGraphNode {
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
  /** Метаданные сущности (зависят от типа) */
  metadata: {
    /** Экспортируется ли */
    isExported: boolean;
    /** Тип данных (для переменных/констант) */
    dataType?: string;
    /** Значение (для констант) */
    value?: any;
    /** Параметры (для функций) */
    params?: string[];
    /** Возвращаемый тип (для функций) */
    returnType?: string;
    /** Асинхронная ли функция */
    isAsync?: boolean;
    /** Является ли методом класса */
    isMethod?: boolean;
    /** Имя класса (для методов) */
    className?: string;
    /** Свойства (для классов/интерфейсов) */
    properties?: string[];
    /** Методы (для классов) */
    methods?: string[];
    /** Наследование (для классов) */
    extends?: string;
    /** Имплементация (для классов) */
    implements?: string[];
    /** Расширение (для интерфейсов) */
    extendsInterfaces?: string[];
    /** Определение (для типов) */
    definition?: string;
    /** Кем вызывается (для функций) */
    calledBy?: string[];
    /** Кого вызывает (для функций) */
    calls?: string[];
    /** Начальная строка */
    startLine?: number;
    /** Конечная строка */
    endLine?: number;
    /** Видимость */
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    /** Дополнительные теги */
    tags?: string[];
  };
}

export interface EntityGraphEdge {
  /** Откуда (сущность-источник) */
  from: string;
  /** Куда (сущность-цель) */
  to: string;
  /** Тип связи */
  type:
    | 'function_call' // вызов функции
    | 'constant_reference' // ссылка на константу
    | 'class_extends' // наследование класса
    | 'class_implements' // имплементация интерфейса
    | 'interface_extends' // расширение интерфейса
    | 'type_reference' // ссылка на тип
    | 'method_call' // вызов метода класса
    | 'property_access' // доступ к свойству
    | 'import_binding' // импорт сущности
    | 'export_binding' // экспорт сущности
    | 'parameter_type' // тип параметра
    | 'return_type' // возвращаемый тип
    | 'variable_reference' // ссылка на переменную
    | 'enum_member'; // член перечисления
  /** Строка кода (опционально) */
  line?: number;
  /** Количество вызовов (для агрегированных данных) */
  count?: number;
}

export interface EntityGraph {
  /** Узлы графа сущностей */
  nodes: EntityGraphNode[];
  /** Ребра графа сущностей */
  edges: EntityGraphEdge[];
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

// ============================================
// ПОЛНЫЙ АНАЛИЗ (ОБЪЕДИНЕНИЕ ДВУХ ГРАФОВ)
// ============================================

export interface FullAnalysis {
  /** Версия формата */
  version: string;
  /** Точка входа */
  root: string;
  /** Временная метка */
  timestamp: string;
  /** Общая статистика */
  stats: {
    /** Всего модулей */
    totalModules: number;
    /** Всего сущностей */
    totalEntities: number;
    /** Есть ли циклы */
    hasCycles: boolean;
    /** Список циклических зависимостей */
    cycles: string[][];
    /** Количество функций */
    totalFunctions: number;
    /** Количество классов */
    totalClasses: number;
    /** Количество констант */
    totalConstants: number;
    /** Количество интерфейсов */
    totalInterfaces: number;
    /** Количество типов */
    totalTypes: number;
    /** Количество переменных */
    totalVariables: number;
    /** Максимальная глубина */
    maxDepth: number;
  };
  /** Граф модулей */
  moduleGraph: ModuleGraph;
  /** Граф сущностей */
  entityGraph: EntityGraph;
}

// ============================================
// ТИПЫ ДЛЯ АНАЛИЗА ВЛИЯНИЯ
// ============================================

export interface ImpactAnalysis {
  /** Сущность, для которой проводится анализ */
  entity: {
    id: string;
    name: string;
    type: string;
    module: string;
  };
  /** Прямые зависимости (кто зависит от сущности) */
  dependents: {
    id: string;
    name: string;
    type: string;
    module: string;
    distance: number;
  }[];
  /** Транзитивные зависимости */
  transitiveDependents: {
    id: string;
    name: string;
    type: string;
    module: string;
    distance: number;
    path: string[];
  }[];
  /** Сущности, от которых зависит данная */
  dependencies: {
    id: string;
    name: string;
    type: string;
    module: string;
  }[];
}

// ============================================
// ТИПЫ ДЛЯ СТАТИСТИКИ
// ============================================

export interface EntityStats {
  /** Общее количество */
  total: number;
  /** Экспортированные */
  exported: number;
  /** Неэкспортированные (приватные) */
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

export interface ModuleStats {
  /** Всего модулей */
  total: number;
  /** По уровням */
  byLevel: Record<
    number,
    {
      modules: number;
      functions: number;
      classes: number;
    }
  >;
  /** По типам */
  byType: {
    module: number;
    component: number;
    vue: number;
    external: number;
  };
  /** По языкам */
  byLanguage: {
    typescript: number;
    javascript: number;
    vue: number;
    jsx: number;
  };
}

// ============================================
// УТИЛИТЫ ДЛЯ ТИПОВ
// ============================================

export type EntityType = EntityGraphNode['type'];
export type EdgeType = EntityGraphEdge['type'];

/**
 * Проверяет, является ли сущность экспортируемой
 */
export function isExported(node: EntityGraphNode): boolean {
  return node.metadata.isExported || false;
}

/**
 * Проверяет, является ли сущность функцией
 */
export function isFunction(node: EntityGraphNode): boolean {
  return node.type === 'function';
}

/**
 * Проверяет, является ли сущность классом
 */
export function isClass(node: EntityGraphNode): boolean {
  return node.type === 'class';
}

/**
 * Проверяет, является ли сущность константой
 */
export function isConstant(node: EntityGraphNode): boolean {
  return node.type === 'constant';
}

/**
 * Проверяет, является ли сущность интерфейсом
 */
export function isInterface(node: EntityGraphNode): boolean {
  return node.type === 'interface';
}

/**
 * Проверяет, является ли сущность типом
 */
export function isType(node: EntityGraphNode): boolean {
  return node.type === 'type';
}

/**
 * Проверяет, является ли сущность переменной
 */
export function isVariable(node: EntityGraphNode): boolean {
  return node.type === 'variable';
}

/**
 * Возвращает цвет для типа сущности (для визуализации)
 */
export function getEntityColor(type: EntityType): string {
  switch (type) {
    case 'function':
      return '#4f46e5'; // indigo
    case 'class':
      return '#7c3aed'; // purple
    case 'constant':
      return '#059669'; // emerald
    case 'interface':
      return '#0ea5e9'; // sky
    case 'type':
      return '#f59e0b'; // amber
    case 'variable':
      return '#ef4444'; // red
    case 'enum':
      return '#8b5cf6'; // violet
    case 'module':
      return '#6b7280'; // gray
    default:
      return '#9ca3af'; // gray
  }
}

/**
 * Возвращает иконку для типа сущности (для визуализации)
 */
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

/**
 * Возвращает цвет для типа ребра (для визуализации)
 */
export function getEdgeColor(type: EdgeType): string {
  switch (type) {
    case 'function_call':
      return '#f59e0b'; // amber
    case 'constant_reference':
      return '#059669'; // emerald
    case 'class_extends':
      return '#7c3aed'; // purple
    case 'class_implements':
      return '#8b5cf6'; // violet
    case 'interface_extends':
      return '#0ea5e9'; // sky
    case 'type_reference':
      return '#f59e0b'; // amber
    case 'method_call':
      return '#f97316'; // orange
    case 'property_access':
      return '#ec4899'; // pink
    case 'import_binding':
      return '#3b82f6'; // blue
    case 'export_binding':
      return '#22c55e'; // green
    case 'parameter_type':
      return '#8b5cf6'; // violet
    case 'return_type':
      return '#ef4444'; // red
    case 'variable_reference':
      return '#f43f5e'; // rose
    case 'enum_member':
      return '#a855f7'; // purple
    default:
      return '#6b7280'; // gray
  }
}

// Экспорт по умолчанию
export default {
  // Типы экспортируются автоматически
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
