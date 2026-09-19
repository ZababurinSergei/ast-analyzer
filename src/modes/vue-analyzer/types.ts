// src/modes/vue-analyzer/types.ts
// ============================================
// ТИПЫ ДЛЯ VUE-АНАЛИЗАТОРА
// ============================================
// Версия: 5.1.0
//
// ИЗМЕНЕНИЯ v5.1.0:
//   - ✅ ДОБАВЛЕНО: LifecycleHookInfo — хуки жизненного цикла
//   - ✅ ДОБАВЛЕНО: EffectInfo — side-effects (timer, cleanup, promise, event, subscription)
//   - ✅ ДОБАВЛЕНО: InjectionInfo — provide/inject связи
//   - ✅ ДОБАВЛЕНО: ReactivityInfo — computed/watch/ref/reactive
//   - ✅ ДОБАВЛЕНО: поля lifecycle, effects, injections, reactivity
//     в интерфейс VueComponentAnalysis
//   - ✅ ДОБАВЛЕНО: поле isExposed в functions[] (для defineExpose)
//
// ИЗМЕНЕНИЯ v5.0.0:
//   - ✅ ДОБАВЛЕНО: TemplateConditional — условный рендеринг (v-if/v-else-if/v-else)
//   - ✅ ДОБАВЛЕНО: поле conditionals в template
//   - ✅ ДОБАВЛЕНО: resolvedComponents в TemplateDynamicComponent
//   - ✅ Обновлён импорт GlobalComponentMap (без изменений)
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

    // ✅ НОВОЕ v5.0.0: условный рендеринг (v-if / v-else-if / v-else)
    conditionals: TemplateConditional[];
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
    // ✅ НОВОЕ v5.1.0: функция экспонируется через defineExpose
    isExposed?: boolean;
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

  // ==========================================
  // ✅ НОВОЕ v5.1.0: расширенные секции анализа
  // ==========================================

  /** Хуки жизненного цикла (onMounted, onUnmounted, watch, ...) */
  lifecycle: LifecycleHookInfo[];

  /** Side-effects (setTimeout, clearTimeout, addEventListener, ...) */
  effects: EffectInfo[];

  /** Provide/inject связи */
  injections: InjectionInfo[];

  /** Реактивные связи (computed, watch, watchEffect, ref, reactive, ...) */
  reactivity: ReactivityInfo[];
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
 *
 * ✅ ОБНОВЛЕНО v5.0.0:
 *   Добавлено поле `resolvedComponents` — возможные значения
 *   expression, если удалось статически разрешить (например, из
 *   `computed(() => ...)` или `useFieldComponent`).
 */
export interface DynamicComponentUsage {
  /** Выражение из :is */
  isExpression: string;
  /** Строка в template */
  line: number;
  /** ✅ НОВОЕ v5.0.0: возможные значения expression (если разрешены) */
  resolvedComponents?: string[];
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
 * ✅ НОВОЕ v5.0.0: условный рендеринг (v-if / v-else-if / v-else).
 *
 * Хранит ССЫЛКИ (имена/примитивы), без дубликатов объектов.
 * Связи с компонентами восстанавливаются по имени при анализе отчёта.
 */
export interface TemplateConditional {
  /** Директива: v-if | v-else-if | v-else */
  directive: 'v-if' | 'v-else-if' | 'v-else';
  /** Строка в template */
  line: number;
  /** Выражение условия (только для v-if / v-else-if) */
  conditionExpression?: string;
  /** Компонент, отрендеренный в ветке (если удалось определить) */
  renderedComponent?: string;
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

// ============================================
// ✅ НОВОЕ v5.1.0: ТИПЫ ДЛЯ LIFECYCLE / EFFECTS / INJECTIONS / REACTIVITY
// ============================================

/**
 * Информация о хуке жизненного цикла Vue.
 *
 * Источник: extractLifecycle() из analyzers/index.ts
 */
export interface LifecycleHookInfo {
  /** Имя хука */
  hookName:
    | 'onMounted'
    | 'onUnmounted'
    | 'onScopeDispose'
    | 'onActivated'
    | 'onDeactivated'
    | 'watch'
    | 'watchEffect'
    | 'onErrorCaptured';
  /** Номер строки вызова */
  line: number;
  /** Имя функции, в которой вызван хук (если удалось определить) */
  functionName?: string;
  /** Имя callback-функции (если есть) */
  callbackName?: string;
  /** Контекст: setup / options-api */
  isSetupContext: boolean;
}

/**
 * Информация о side-effect.
 *
 * Источник: extractEffects() из analyzers/index.ts
 *
 * Типы эффектов:
 *   - timer:         setTimeout, setInterval, requestAnimationFrame
 *   - cleanup:       clearTimeout, clearInterval, removeEventListener, abort
 *   - promise:       .then(), .catch(), .finally()
 *   - event:         addEventListener
 *   - subscription:  .subscribe(), .unsubscribe()
 */
export interface EffectInfo {
  /** Тип эффекта */
  effectType: 'timer' | 'cleanup' | 'promise' | 'event' | 'subscription';
  /** Номер строки */
  line: number;
  /** Имя функции, в которой встретился эффект */
  functionName?: string;
  /** Имя вызываемой функции (setTimeout, clearTimeout, addEventListener, ...) */
  targetName: string;
  /** Дополнительное значение (например, '1000' для debounce) */
  metaValue?: string;
}

/**
 * Информация о provide/inject связи.
 *
 * Источник: extractInjections() из analyzers/index.ts
 */
export interface InjectionInfo {
  /** Тип: provide | inject */
  kind: 'provide' | 'inject';
  /** Номер строки */
  line: number;
  /** Нормализованное имя ключа (без кавычек для строковых литералов) */
  key: string;
  /** Используется ли Symbol (InjectionKey<T>) */
  isSymbolKey: boolean;
  /** Есть ли значение по умолчанию (для inject) */
  hasDefault: boolean;
}

/**
 * Информация о реактивной связи.
 *
 * Источник: extractReactivity() из analyzers/index.ts
 */
export interface ReactivityInfo {
  /** Тип реактивной связи */
  kind: 'computed' | 'watch' | 'watchEffect' | 'ref' | 'reactive' | 'shallowRef' | 'readonly';
  /** Номер строки */
  line: number;
  /** Имя функции/composable, в которой объявлена реактивность */
  functionName?: string;
  /** Имена реактивных полей, которые читаются */
  reads: string[];
  /** Имена реактивных полей, которые пишутся */
  writes: string[];
  /** Является ли computed writeable ({ get, set }) */
  isWriteable: boolean;
}
