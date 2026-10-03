// src/modes/vue-analyzer/types.ts
// ============================================
// ТИПЫ ДЛЯ VUE-АНАЛИЗАТОРА
// ============================================
// Версия: 18.0.0
//
// ИЗМЕНЕНИЯ v18.0.0 (Vue-flow типы — симметрия с React):
//   - ✅ ДОБАВЛЕНО: VueFlowStep       — шаг цепочки flow
//   - ✅ ДОБАВЛЕНО: VueStateFlow      — reactivity ↔ mutation ↔ read ↔ render
//   - ✅ ДОБАВЛЕНО: VueEventFlow      — @click → handler → call → state → render
//   - ✅ ДОБАВЛЕНО: VueRenderNode     — узел дерева рендера
//   - ✅ ДОБАВЛЕНО: VueFnHtmlUsage    — обратный индекс функция → HTML
//   - 📌 Симметрия с React (core/react-entity-classifier.ts):
//         ReactStateFlow  ↔ VueStateFlow
//         ReactEventFlow  ↔ VueEventFlow
//         ReactRenderNode ↔ VueRenderNode
//         ReactFnJsxUsage ↔ VueFnHtmlUsage
//         EventFlowStep   ↔ VueFlowStep
//   - 📌 Используется в:
//         • modes/vue-analyzer/flows/*.ts   (билдеры)
//         • reporters/codec/codec-types.ts  (VueSectionFull)
//         • reporters/codec/codec-legend.ts (схемы)
//         • scripts/verify-roundtrip.ts     (инварианты)
//
// ИЗМЕНЕНИЯ v5.2.0 (v16.0.8: Component Usage + HTML Elements):
//   - ✅ ДОБАВЛЕНО: импорт ComponentUsage, HtmlElementUsage
//     из '../../types-vue-template.js' (разрыв циклического импорта
//     types.ts ↔ codec-types.ts).
//   - ✅ ДОБАВЛЕНО: поля componentUsages и htmlElements
//     в интерфейс VueComponentAnalysis.
//   - 📌 Назначение: analyzeVueComponent вызывает parseVueTemplate
//     ОДИН РАЗ и заполняет эти поля. Затем они пробрасываются:
//       VueComponentAnalysis
//         → convertVueAnalysisToEntities
//         → EntitiesResult.templateComponentUsages
//         → convertEntitiesToEnhanced
//         → EnhancedEntityInfo.templateComponentUsages
//         → compact-reporter.ts (ЧИТАЕТ, НЕ ПАРСИТ)
//   - 🐛 Причина: ранее compact-reporter.ts перезапускал
//     analyzeVueSFC для каждого SFC, что приводило к:
//       • двойному парсингу <template> (~8 сек лишней работы);
//       • рассинхрону projectRoot (баг с Vue SFC);
//       • дублированию логики extractSFCNamesForVue.
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

// ✅ v5.2.0 (v16.0.8): типы Vue-шаблона вынесены в отдельный файл
// для разрыва циклического импорта types.ts ↔ codec-types.ts.
// ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ — src/types-vue-template.ts.
import type { ComponentUsage, HtmlElementUsage } from '../../types-vue-template.js';

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

  // ==========================================
  // ✅ НОВОЕ v5.2.0 (v16.0.8): Component Usage + HTML Elements
  // ==========================================
  //
  // ⚠️ КРИТИЧНО: эти поля заполняются ОДИН РАЗ в analyzeVueComponent
  // (modes/vue-analyzer/index.ts) через parseVueTemplate.
  //
  // РАНЬШЕ: compact-reporter.ts перезапускал analyzeVueSFC для каждого
  // SFC, что приводило к двойному парсингу <template>.
  //
  // ТЕПЕРЬ: данные уже собраны в pipeline и проброшены через:
  //   VueComponentAnalysis.componentUsages/htmlElements
  //     → convertVueAnalysisToEntities
  //     → EntitiesResult.templateComponentUsages/templateHtmlElements
  //     → convertEntitiesToEnhanced
  //     → EnhancedEntityInfo.templateComponentUsages/templateHtmlElements
  //     → compact-reporter.ts (ЧИТАЕТ, НЕ ПАРСИТ)
  //
  // Источник: src/core/vue-template-parser.js::parseVueTemplate()
  // ==========================================

  /** Использования компонентов в <template> */
  componentUsages?: ComponentUsage[];

  /** Использования HTML-элементов в <template> */
  htmlElements?: HtmlElementUsage[];
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
  name?: string;
}

// ============================================
// ✅ v18.0.0: VUE FLOW-ТИПЫ (симметрия с React)
// ============================================
//
// Симметрия с React (`core/react-entity-classifier.ts`):
//   ReactStateFlow  ↔ VueStateFlow
//   ReactEventFlow  ↔ VueEventFlow
//   ReactRenderNode ↔ VueRenderNode
//   ReactFnJsxUsage ↔ VueFnHtmlUsage
//   EventFlowStep   ↔ VueFlowStep
//
// Используется в:
//   • modes/vue-analyzer/flows/*.ts   (билдеры)
//   • reporters/codec/codec-types.ts  (VueSectionFull, VueSectionCompact)
//   • reporters/codec/codec-legend.ts (схемы)
//   • scripts/verify-roundtrip.ts     (инварианты)
//
// Данные источника:
//   • vue.sfc[].htmlElements[]        — HTML-элементы с props/events/directives/interpolations
//   • vue.sfc[].componentUsages[]     — использования компонентов
//   • vue.reactivity[]                — ref/reactive/computed/watch
//   • vue.componentEvents[]           — @click, @change и т.д.
//   • vue.componentProps[]            — обратные связи props
//   • vue.componentDirectives[]       — v-if, v-for и т.д.
//   • vue.htmlInterpolations[]        — {{ ... }}
//   • entitiesMap[file].templateEventHandlers[]  — «сырые» eventHandlers
//   • entitiesMap[file].templateReactivityDeps[] — reactivity в template
//
// ============================================

/**
 * Шаг цепочки flow.
 *
 * Симметрично `EventFlowStep` из React.
 *
 * Пример (event flow):
 *   [
 *     { step: 'event',   refId: 'cu1:ce1', label: 'click on AiButton', line: 7 },
 *     { step: 'handler', refId: 'fn42',    label: 'onClick()',          line: 22 },
 *     { step: 'call',    refId: 'fn42:c1', label: 'setIsOpen(true)',    line: 25 },
 *     { step: 'state',   refId: 'rx3',     label: 'isOpen (mutated)',   line: 18 },
 *     { step: 'render',  refId: 'he5',     label: '<Modal v-if="isOpen">', line: 30 },
 *   ]
 */
export interface VueFlowStep {
  step: 'event' | 'handler' | 'call' | 'state' | 'render';
  /** ID шага (eventId, functionId, callId, reactivityId, htmlElementId) */
  refId: string;
  /** Человеко-читаемая метка */
  label: string;
  /** Номер строки */
  line: number;
}

/**
 * Поток состояния: reactivity ↔ mutation ↔ read ↔ render.
 *
 * Пример:
 *   const isOpen = ref(false)   → reactivityId: 'rx3', kind: 'ref', name: 'isOpen'
 *   isOpen.value = true         → mutatedBy[0] = { functionId: 'fn42', ... }
 *   if (isOpen.value) ...       → readBy[0]    = { functionId: 'fn50', ... }
 *   <Modal v-if="isOpen">       → renderedIn[0] = { htmlElementId: 'he5', kind: 'conditional' }
 */
export interface VueStateFlow {
  /** Уникальный ID (vsf1, vsf2, ...) */
  id: string;

  /** ID reactivity из vue.reactivity[] */
  reactivityId: string;

  /** Имя реактивной переменной (isOpen, count, ...) */
  stateName: string;

  /**
   * Вид реактивности.
   *
   * Допустимые значения — подмножество `ReactivityInfo['kind']`:
   *   'ref'      — ref() / shallowRef()
   *   'reactive' — reactive()
   *   'computed' — computed()
   *   'readonly' — readonly()
   *   'watch'    — watch() / watchEffect()
   */
  kind: 'ref' | 'reactive' | 'computed' | 'readonly' | 'watch';

  /**
   * Где переменная **мутируется** (X.value = ..., X.value.push, reactive.X = ...).
   *
   * Источник: entitiesMap[file].functions[].calls — если call совпадает
   * с stateName или `${stateName}.value`.
   */
  mutatedBy: Array<{
    /** ID функции, в которой мутация */
    functionId: string;
    /** ID вызова (fn42:line) */
    callId: string;
    /** Номер строки */
    line: number;
  }>;

  /**
   * Где переменная **читается** (X.value, computed(() => X.value), etc).
   *
   * Источник: entitiesMap[file].functions[].calls.
   */
  readBy: Array<{
    /** ID функции, в которой чтение */
    functionId: string;
    /** Номер строки */
    line: number;
  }>;

  /**
   * Где переменная **используется в шаблоне** (HTML).
   *
   * Источник: vue.sfc[].htmlElements[].props / directives / interpolations.
   */
  renderedIn: Array<{
    /** ID HTML-элемента (he1) */
    htmlElementId: string;
    /** Имя атрибута или '<expression>' для интерполяций */
    attrName: string;
    /** Вид использования */
    kind: 'text' | 'attr' | 'conditional' | 'handler';
    /** Номер строки */
    line: number;
  }>;
}

/**
 * Поток события: @click → handler → call → state → render.
 *
 * Пример:
 *   <AiButton @click="onClick">   → eventId: 'cu1:ce1', eventName: 'click', elementId: 'cu1'
 *   const onClick = () => {       → handlerFunctionId: 'fn42', handlerName: 'onClick'
 *     setIsOpen(true);            → calls[0] = { calleeName: 'setIsOpen', ... }
 *     console.log(isOpen.value);  → calls[1] = ...
 *   }
 *   <Modal v-if="isOpen">         → chain[last] = { step: 'render', ... }
 */
export interface VueEventFlow {
  /** Уникальный ID (vef1, vef2, ...) */
  id: string;

  /** ID события (cu1:ce1 для компонента, he1:ce1 для HTML) */
  eventId: string;

  /** Имя события (click, change, ...) */
  eventName: string;

  /** ID элемента (cu1, he1) */
  elementId: string;

  /** ID функции-обработчика (fn42) или '' если не найдена */
  handlerFunctionId: string;

  /** Имя обработчика (onClick, handleClick, ...) */
  handlerName: string;

  /** Вызовы внутри обработчика */
  calls: Array<{
    /** ID функции (или fn42:line для синтетического) */
    functionId: string;
    /** Имя вызываемой функции */
    calleeName: string;
    /** Номер строки */
    line: number;
  }>;

  /** ID reactivity, которые мутируются этим обработчиком */
  mutatedStates: string[];

  /** ID SFC, которые перерисовываются */
  reRendered: string[];

  /** Плоская цепочка шагов */
  chain: VueFlowStep[];
}

/**
 * Узел дерева рендера.
 *
 * Плоский список (как ReactRenderNode), а не дерево.
 * Родитель указывается через `parentId`.
 *
 * Для HTML-элементов: elementId = he1, he2, ...
 * Для компонентов:   elementId = cu1, cu2, ...
 * Для slot:          elementId = csl1, ...
 */
export interface VueRenderNode {
  /** ID элемента (he1, cu1) */
  elementId: string;

  /** Имя тега (div, AiButton, slot) */
  tagName: string;

  /** Вид узла */
  kind: 'element' | 'component' | 'slot';

  /** ID родителя (null для корневых) */
  parentId: string | null;

  /** Зависимости: что влияет на рендеринг */
  dependsOn: {
    /** ID reactivity (rx1, rx2, ...) */
    reactivityIds: string[];
    /** ID props (если компонент) */
    propIds: string[];
  };

  /** Условный рендеринг (v-if / v-else-if / v-else / v-for) */
  conditionals: Array<{
    kind: 'v-if' | 'v-else-if' | 'v-else' | 'v-for';
    /** Условие: 'isOpen', 'item in items', ... */
    condition: string;
    /** Root-идентификаторы условия: ['isOpen'], ['items'] */
    refs: string[];
  }>;
}

/**
 * Обратный индекс: функция → HTML-элементы.
 *
 * Симметрично `ReactFnJsxUsage`.
 *
 * Используется для быстрого поиска:
 *   «где эта функция используется в шаблоне?»
 */
export interface VueFnHtmlUsage {
  /** ID функции */
  functionId: string;

  /** Имя функции */
  functionName: string;

  /** Где используется */
  usedIn: Array<{
    /** ID HTML-элемента (he1) или компонента (cu1) */
    htmlElementId: string;
    /** Вид использования */
    usage: 'handler' | 'value' | 'condition' | 'render';
    /** Номер строки */
    line: number;
  }>;
}
