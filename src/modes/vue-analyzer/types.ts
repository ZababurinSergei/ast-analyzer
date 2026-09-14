// src/modes/vue-analyzer/types.ts
// ============================================
// ТИПЫ ДЛЯ VUE-АНАЛИЗАТОРА
// ============================================
// Версия: 4.1.0
//
// ИЗМЕНЕНИЯ v4.1.0:
//   - ✅ ДОБАВЛЕНО: поле reactivityDeps в template
//     (агрегация root-идентификаторов из expressions)
//
// ИЗМЕНЕНИЯ v4.0.1:
//   - ✅ ИСПРАВЛЕНО: ESLint @typescript-eslint/consistent-type-imports
//     Inline import('./global-component-map.js') заменён на top-level import type
//
// ИЗМЕНЕНИЯ v4.0.0:
//   - ✅ ДОБАВЛЕНО: AnalyzeVueOptions (extends AnalysisOptions)
//   - ✅ ДОБАВЛЕНО: поле verbose в AnalysisOptions
// ============================================

// ✅ ИСПРАВЛЕНО: top-level import type вместо inline import()
import type { GlobalComponentMap } from './global-component-map.js';

// ============================================
// ОСНОВНОЙ ИНТЕРФЕЙС
// ============================================

export interface VueComponentAnalysis {
  componentName: string;
  filePath: string;

  script: {
    content: string;
    ast: any | null;
    isSetup: boolean;
    isTS: boolean;
    size: number;
  };

  template: {
    content: string | null;
    ast: any | null;
    complexity: number;
    rootElements: string[];
    slots: string[];
    directives: string[];
    events: string[];

    usedComponents: TemplateComponentUsage[];
    templateRefs: TemplateRefUsage[];
    eventHandlers: EventHandlerUsage[];
    expressions: TemplateExpressionUsage[];
    dynamicComponents: DynamicComponentUsage[];
    cssVariables: CssVariableUsage[];
    deepSelectors: DeepSelectorUsage[];

    // ✅ НОВОЕ v4.1.0: зависимости реактивности (root-идентификаторы из шаблона)
    reactivityDeps: string[];
  };

  props: {
    names: string[];
    types: Record<string, string>;
    required: Record<string, boolean>;
    defaults: Record<string, any>;
  };

  emits: {
    names: string[];
    types: Record<string, string>;
  };

  expose: string[];
  slots: string[];

  imports: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
  }[];

  composables: {
    name: string;
    source: string;
    args: string[];
  }[];

  functions: {
    name: string;
    line: number;
    isAsync: boolean;
    isExported: boolean;
    params: string[];
    returnType?: string;
    body?: string;
    calls?: string[];
    calledBy?: string[];
  }[];

  constants: {
    name: string;
    value: any;
    line: number;
    isExported: boolean;
    type?: string;
  }[];

  variables: {
    name: string;
    value: any;
    line: number;
    isExported: boolean;
    type?: string;
  }[];

  types: {
    name: string;
    definition: string;
    line: number;
    isExported: boolean;
  }[];

  interfaces: {
    name: string;
    properties: string[];
    line: number;
    isExported: boolean;
    extends?: string[];
  }[];

  callGraph: Record<string, string[]>;

  stats: {
    scriptLines: number;
    templateLines: number;
    styleCount: number;
    totalSize: number;
  };

  setupAttributes?: SFCSetupAttributes;
}

// ============================================
// ОПЦИИ АНАЛИЗА
// ============================================

export interface AnalysisOptions {
  /** Включать анализ AST шаблона */
  includeTemplateAST?: boolean;
  /** Включать анализ AST скрипта */
  includeScriptAST?: boolean;
  /** Извлекать вызовы composables */
  extractComposableCalls?: boolean;
  /** Максимальная глубина анализа */
  maxDepth?: number;
  /** Подробный вывод */
  verbose?: boolean;
}

/**
 * ✅ НОВОЕ v4.0.0: расширенные опции для двухпроходного анализа.
 *
 * Используется в analyzeVueComponent() для связи templateRefs
 * с defineExpose целевого компонента через глобальную карту.
 */
export interface AnalyzeVueOptions extends AnalysisOptions {
  /**
   * Глобальная карта компонентов проекта.
   * Строится первым проходом через buildGlobalComponentMap().
   */
  globalMap?: GlobalComponentMap;
}

// ============================================
// ТИПЫ ДЛЯ TEMPLATE ANALYSIS
// ============================================

/**
 * Использование компонента в <template>
 */
export interface TemplateComponentUsage {
  /** Имя компонента (PascalCase или kebab-case) */
  name: string;
  /** Строка в template */
  line: number;
  /** Родительский элемент (или null, если корневой) */
  parent: string | null;
  /** Является ли динамическим (<component :is>) */
  isDynamic: boolean;
  /** ✅ НОВОЕ v3.0.0: компонент в kebab-case */
  isKebabCase?: boolean;
}

/**
 * Template ref (ref="dataTable")
 */
export interface TemplateRefUsage {
  /** Значение ref="dataTable" */
  refValue: string;
  /** Тег элемента/компонента */
  tag: string;
  /** Строка в template */
  line: number;
  /** ✅ НОВОЕ v3.0.0: методы, экспонированные через defineExpose целевого компонента */
  exposedMethods?: string[];
}

/**
 * Event handler из template (@click="handleClick")
 */
export interface EventHandlerUsage {
  /** Имя события (click, update:value, ...) */
  eventName: string;
  /** Обработчик из template (@click="handleClick") */
  handlerName: string;
  /** Тег элемента/компонента */
  tag: string;
  /** Строка в template */
  line: number;
  /** Модификаторы (.stop, .prevent, ...) */
  modifiers: string[];
  /** ✅ НОВОЕ v3.0.0: внешний обработчик (emit/console/Math и т.п.) */
  isExternal?: boolean;
}

/**
 * Template expression ({{ displayText }}, :class="{...}")
 */
export interface TemplateExpressionUsage {
  /** Выражение: displayText, isModified, row.key */
  expression: string;
  /** Тип: interpolation | binding | directive */
  kind: 'interpolation' | 'binding' | 'directive';
  /** Строка в template */
  line: number;
  /** ✅ НОВОЕ v3.0.0: root-идентификаторы (без свойств: `user.name` → `user`) */
  rootIdentifiers?: string[];
}

/**
 * Динамический компонент (<component :is="...">)
 */
export interface DynamicComponentUsage {
  /** Выражение из :is */
  isExpression: string;
  /** Строка в template */
  line: number;
}

/**
 * CSS-переменная из <style>
 */
export interface CssVariableUsage {
  /** Имя переменной: --blue-700 */
  name: string;
  /** Значение: #1a5fb4 (если есть) */
  value?: string;
  /** Строка в style */
  line: number;
  /** ✅ НОВОЕ v3.0.0: значение многострочное */
  isMultiline?: boolean;
}

/**
 * :deep() селектор из <style scoped>
 */
export interface DeepSelectorUsage {
  /** Селектор: .n-data-table-td */
  selector: string;
  /** Строка в style */
  line: number;
}

/**
 * Определение слота из defineSlots<T>()
 */
export interface SlotDefinition {
  /** Имя слота */
  name: string;
  /** Props слота (опционально) */
  props?: Record<string, string>;
}

/**
 * Атрибуты <script setup>
 */
export interface SFCSetupAttributes {
  /** Язык скрипта */
  lang?: 'ts' | 'js';
  /** Generic-параметр */
  generic?: string;
  /** Является ли setup-скриптом */
  isSetup: boolean;
}
