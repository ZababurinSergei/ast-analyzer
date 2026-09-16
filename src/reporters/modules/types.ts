// src/reporters/modules/types.ts
// ============================================
// ТИПЫ ДЛЯ МОДУЛЕЙ РЕПОРТЕРОВ
// ============================================

import type { ImportInfo } from '../../types.js';

// ============================================================
// ТИПЫ ДЛЯ ENHANCED PACKAGE LOCK REPORT
// ============================================================

export interface PackageLockImportInfo {
  from: string;
  type: 'named' | 'default' | 'namespace' | 'type';
  imports: string[];
}

// ============================================================
// ✅ ENHANCED FUNCTION INFO
// ============================================================

export interface EnhancedFunctionInfo {
  name: string;
  params: string[];
  paramTypes: string[];
  line: number;
  startLine: number;
  endLine: number;
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  className: string;
  calls: string[];
  calledBy: string[];
  returnType: string;
  body: string;
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
  _modulePath?: string;
  filePath?: string;
  moduleName?: string;
  id?: string;
  isSelf?: boolean;
  _isSelf?: boolean;
  isConst?: boolean;
  isMacro?: boolean;
  isComposable?: boolean;
  source?: string;
  isDefaultExport?: boolean;
  isStatic?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  isReadonly?: boolean;
  isOptional?: boolean;
  isNullable?: boolean;
  isGenerator?: boolean;
  isDynamic?: boolean;
  isConfig?: boolean;
  isExternal?: boolean;
  isVueTemplate?: boolean;
  isAsyncChain?: boolean;
  isClosure?: boolean;
  isTypeDep?: boolean;
  moduleId?: string;
  fileId?: string;
  _uniqueKey?: string;
  _fullPath?: string;
}

// ============================================================
// ✅ ENHANCED CONSTANT INFO
// ============================================================

export interface EnhancedConstantInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

// ============================================================
// ✅ ENHANCED VARIABLE INFO
// ============================================================

export interface EnhancedVariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

// ============================================================
// ✅ ENHANCED INTERFACE INFO
// ============================================================

export interface EnhancedInterfaceInfo {
  name: string;
  properties: string[];
  line: number;
  startLine: number;
  endLine: number;
  isExported: boolean;
  extends: string[];
  _safeInfo: any;
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

// ============================================================
// ✅ ENHANCED TYPE INFO
// ============================================================

export interface EnhancedTypeInfo {
  name: string;
  definition: string;
  line: number;
  isExported: boolean;
  _safeInfo: any;
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

// ============================================================
// ✅ ENHANCED CLASS INFO
// ============================================================

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
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

// ============================================================
// ✅ НОВОЕ v9.0.0: ТИПЫ ДЛЯ TEMPLATE-СЕКЦИЙ VUE
// ============================================================

/**
 * Обработчик события из шаблона (@click="handleClick").
 */
export interface TemplateEventHandlerInfo {
  eventName: string;
  handlerName: string;
  tag: string;
  line: number;
  modifiers: string[];
  isExternal?: boolean;
}

/**
 * Динамический компонент (<component :is="..." />).
 */
export interface TemplateDynamicComponentInfo {
  isExpression: string;
  line: number;
  /** ✅ НОВОЕ v9.0.0: возможные значения expression */
  resolvedComponents?: string[];
}

/**
 * Условный рендеринг (v-if / v-else-if / v-else).
 */
export interface TemplateConditionalInfo {
  directive: 'v-if' | 'v-else-if' | 'v-else';
  line: number;
  conditionExpression?: string;
  renderedComponent?: string;
}

/**
 * Реактивная связь (computed / watch / watchEffect / ref / reactive).
 */
export interface TemplateReactivityInfo {
  kind: 'computed' | 'watch' | 'watchEffect' | 'ref' | 'reactive' | 'shallowRef' | 'readonly';
  functionName: string;
  line: number;
  reads: string[];
  writes: string[];
  isWriteable: boolean;
}

/**
 * Хук жизненного цикла Vue.
 */
export interface TemplateLifecycleInfo {
  hookName:
    | 'onMounted'
    | 'onUnmounted'
    | 'onScopeDispose'
    | 'onActivated'
    | 'onDeactivated'
    | 'watch'
    | 'watchEffect'
    | 'onErrorCaptured';
  functionName: string;
  line: number;
  callbackFunctionName?: string;
  isSetupContext: boolean;
}

/**
 * Side-effect (таймер, cleanup, promise, event, subscription).
 */
export interface TemplateEffectInfo {
  effectType: 'timer' | 'cleanup' | 'promise' | 'event' | 'subscription';
  functionName: string;
  line: number;
  targetName: string;
  metaValue?: string;
}

/**
 * Ребро provide / inject.
 */
export interface TemplateInjectionInfo {
  kind: 'provide' | 'inject';
  filePath: string;
  line: number;
  key: string;
  isSymbolKey: boolean;
  hasDefault: boolean;
}

// ============================================================
// ✅ НОВОЕ v9.0.0: ТИПЫ ДЛЯ ТИП-ГРАФА
// ============================================================

/**
 * Узел тип-графа.
 */
export interface TypeNodeInfo {
  kind: 'interface' | 'type-alias' | 'enum' | 'class';
  name: string;
  moduleId: string;
  fileId: string;
  line: number;
  members: string[];
  extendsTypes: string[];
}

/**
 * Ребро использования типа.
 */
export interface TypeRefInfo {
  typeName: string;
  moduleId: string;
  fileId: string;
  line: number;
  usageKind: 'param' | 'return' | 'field' | 'generic' | 'union' | 'extends';
}

// ============================================================
// ✅ ОБНОВЛЕННЫЙ EnhancedEntityInfo
// ============================================================

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];

  /**
   * ✅ ИСПРАВЛЕНО (v8.4.2): тип `ImportInfo[]` вместо устаревшего
   * `{ source: string; specifiers: string[]; isTypeOnly: boolean }[]`.
   *
   * Причина: в v7.1.0 структура import specifiers изменилась —
   * теперь это `ImportSpecifier[]` (массив объектов `{ local, imported, type }`),
   * а не `string[]`. Присваивание `entities.imports` (тип `ImportInfo[]`)
   * в `EnhancedEntityInfo` давало TS2322.
   */
  imports?: ImportInfo[];

  /** ✅ ДОБАВЛЕНО: экспорты из файла */
  exports?: {
    name: string;
    type: string;
    isDefault: boolean;
    line?: number;
    isReExport?: boolean;
    source?: string;
    loc?: any;
    specifier?: string;
  }[];

  // ==========================================
  // ✅ НОВОЕ: template-поля Vue
  // Хранят ТОЛЬКО ссылки (имена/примитивы),
  // без дубликатов объектов.
  // ==========================================

  /** root-идентификаторы шаблона (user, items, isLoading) */
  templateReactivityDeps?: string[];

  /** Обработчики событий @click → handlerName */
  templateEventHandlers?: TemplateEventHandlerInfo[];

  /** <component :is="..."> и v-bind:is */
  templateDynamicComponents?: TemplateDynamicComponentInfo[];

  /**
   * ✅ ИСПРАВЛЕНО (v9.0.0): template refs.
   *
   * Без этого поля:
   *   1. `json-reporter.ts` не может обратиться к `result.templateRefs`
   *      (TS2339: Property 'templateRefs' does not exist on type
   *       'EnhancedEntityInfo').
   *   2. `compact-reporter.ts` не может собрать 9-е поле vt[]
   *      (templateRefs) — из-за этого в `index.json` массив vt
   *      содержал 9 полей вместо 12, что ломает round-trip.
   *
   * Формат — массив объектов, каждый из которых описывает один
   * `ref="..."` в шаблоне:
   *   - refValue       — значение атрибута ref (например, "dataTable")
   *   - tag            — тег элемента/компонента (например, "DataTable")
   *   - line           — строка в шаблоне
   *   - exposedMethods — методы из defineExpose дочернего компонента
   *                      (заполняется при двухпроходном анализе)
   */
  templateRefs?: {
    refValue: string;
    tag: string;
    line: number;
    exposedMethods?: string[];
  }[];

  /** CSS-переменные из <style> */
  templateCssVariables?: {
    name: string;
    value?: string;
    line: number;
    isMultiline?: boolean;
  }[];

  /** :deep() селекторы */
  templateDeepSelectors?: {
    selector: string;
    line: number;
  }[];

  /** Директивы (v-html, v-text, v-pre, v-once, v-memo, v-model, ...) */
  templateDirectives?: string[];

  /** Использованные компоненты (PascalCase + kebab-case) */
  templateUsedComponents?: string[];

  /** Слоты (из <slot name="..."> и defineSlots<T>()) */
  templateSlots?: string[];

  /** Сложность шаблона */
  templateComplexity?: number;

  // ==========================================
  // ✅ НОВОЕ v9.0.0: расширенные template-секции
  // ==========================================

  /** Условный рендеринг (v-if / v-else-if / v-else) */
  templateConditionals?: TemplateConditionalInfo[];

  /** Хуки жизненного цикла (onMounted, onUnmounted, ...) */
  templateLifecycle?: TemplateLifecycleInfo[];

  /** Side-effects (setTimeout, clearTimeout, AbortController, ...) */
  templateEffects?: TemplateEffectInfo[];

  /** Реактивные связи (computed, watch, ref, reactive, ...) */
  templateReactivity?: TemplateReactivityInfo[];

  /** Ребра provide / inject */
  templateInjections?: TemplateInjectionInfo[];

  /** Узлы тип-графа (interface / type-alias / enum / class) */
  typesGraph?: TypeNodeInfo[];

  /** Ребра использования типов */
  typeRefsGraph?: TypeRefInfo[];

  /** ID файла для conditional/lifecycle/effect/injection секций */
  fileId?: string;

  /** ID модуля */
  moduleId?: string;
}

// ============================================================
// ✅ ENHANCED PACKAGE INFO
// ============================================================

export interface EnhancedPackageInfo {
  version: string;
  resolved: string;
  displayPath?: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, any>;
  exports: Record<string, any>;
  entities: EnhancedEntityInfo;
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
  vueAnalysis?: any;
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

// ============================================================
// ✅ ENHANCED PACKAGE LOCK REPORT
// ============================================================

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
    // ==========================================
    // Базовые поля (уже существовали)
    // ==========================================
    totalFunctions: number;
    totalConstants: number;
    totalVariables: number;
    totalInterfaces: number;
    /**
     * Общее количество типов TypeScript (interface / type-alias / enum).
     * ⚠️ Это поле УЖЕ существовало как обязательное `number`.
     * НЕ добавлять дубликат `totalTypes?: number` в блок v9.0.0 —
     * это даёт TS2300/TS2687/TS2717.
     */
    totalTypes: number;
    totalClasses: number;
    totalCalls: number;
    totalExportedFunctions: number;
    totalAsyncFunctions: number;

    /** ✅ ДОБАВЛЕНО (v6.x): общее количество экспортов */
    totalExports?: number;
    /** ✅ ДОБАВЛЕНО (v6.x): общее количество реэкспортов */
    totalReExports?: number;

    // ==========================================
    // ✅ НОВОЕ v9.0.0
    // ==========================================
    /** Общее количество Vue-шаблонов */
    totalTemplates?: number;
    /** Общее количество условных рендеров (v-if / v-else-if / v-else) */
    totalConditionals?: number;
    /** Общее количество хуков жизненного цикла */
    totalLifecycle?: number;
    /** Общее количество side-effects */
    totalEffects?: number;
    /** Общее количество provide/inject ребер */
    totalInjections?: number;
    /** Общее количество реактивных связей */
    totalReactivity?: number;
    /** Общее количество ребер использования типов */
    totalTypeRefs?: number;

    // ⚠️ totalTypes НЕ дублируется — см. выше (базовые поля).
  };
  fileStats: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  architectureMetrics?: any;
  summary?: any;
  timestamp: string;
}

// ============================================================
// ТИПЫ ДЛЯ ГРАФОВ
// ============================================================

export interface ModuleNode {
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

export interface ModuleEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  specifiers: string[];
  sourceCode?: string;
}

export interface ModuleGraph {
  nodes: ModuleNode[];
  edges: ModuleEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

export interface EntityNode {
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
    type?: string;
  };
}

export interface EntityEdge {
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
  nodes: EntityNode[];
  edges: EntityEdge[];
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
// ТИПЫ ДЛЯ СТАТИСТИКИ
// ============================================================

export interface EntityStats {
  total: number;
  exported: number;
  private: number;
  byModule: Record<string, number>;
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

export interface FileStats {
  total: number;
  byExtension: Record<
    string,
    {
      count: number;
      lines: number;
      size: number;
    }
  >;
}

// ============================================================
// ТИП ДЛЯ CALL GRAPH RESULT
// ============================================================

export interface CallGraphResult {
  nodes: string[];
  edges: [number, number, number, number, number][];
  types: string[];
  edgeFlags: Record<string, Record<string, string>>;
  cycles: string[][];
}

// ============================================================
// ТИП ДЛЯ ФУНКЦИИ-СУЩНОСТИ
// ============================================================

export interface FunctionEntity {
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
  importedBy: {
    importerId: string;
    importerFile: string;
    importerVscode: string;
    importLine: number;
    specifier: string;
    importType?: 'named' | 'default' | 'namespace' | 'type';
  }[];
  body?: string;
  returnType?: string;
  metadata?: Record<string, any>;
  _uniqueKey?: string;
  _fullPath?: string;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  // Типы экспортируются автоматически
};
