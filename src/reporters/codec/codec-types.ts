// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (v17.1.0)
// ============================================
// Версия: 17.1.0
//
// ИЗМЕНЕНИЯ v17.1.0 (React flow-секции):
//   - ✅ ДОБАВЛЕНО: ReactSectionFull.stateFlows/eventFlows/
//     renderTree/fnJsxUsage (опциональные, пока any[])
//   - ✅ ДОБАВЛЕНО: ReactSectionCompact.stateFlows/eventFlows/
//     renderTree/fnJsxUsage (опциональные, прямая сериализация)
//   - ✅ ДОБАВЛЕНО: ReactSectionCompact.jsxElements.col (column)
//
// ИЗМЕНЕНИЯ v17.0.0 (React-секция):
//   - ✅ ДОБАВЛЕНО: FullJSON.react?: ReactSectionFull
//   - ✅ ДОБАВЛЕНО: StatisticsData.totalReact* (10 полей)
//   - ✅ ДОБАВЛЕНО: React-типы (ElementAttr, JsxElementEntity,
//     ReactComponentEntity, ReactHookEntity, ReactEffectEntity,
//     ReactContextEntity, ReactMemoEntity, ReactRefEntity,
//     JsxEventEntity, ReactConditionalEntity, ReactComponentUsage)
//   - ✅ ДОБАВЛЕНО: ReactSectionFull, ReactSectionCompact
//   - ✅ ДОБАВЛЕНО: ElementAttrKind, JsxNodeKind, ReactComponentKind,
//     ReactHookKind, ReactEffectKind, ReactContextKind, ReactMemoKind,
//     EventHandlerSource
// ============================================

export const CODEC_VERSION = '17.1.0';
export const LEGEND_VERSION = '3.1.0';

import type {
  // === Component Prop / Event / Directive / Slot ===
  ComponentProp,
  ComponentEvent,
  ComponentDirective,
  ComponentSlot,
  HtmlInterpolation,

  // === Component Usage / Html Element Usage ===
  ComponentUsage,
  HtmlElementUsage,

  // === DOM API types (только те, что используются локально) ===
  DomApiEffect,
  DomApiTargetKind,
  DomApiArg,
  DomApiContext,
} from '../../types-vue-template.js';

// ────────────────────────────────────────────────────────────
// 2. Реэкспорт (для внешних потребителей codec-types.ts)
// ────────────────────────────────────────────────────────────
export type {
  SourceChainItem,
  ComponentProp,
  ComponentEvent,
  ComponentDirective,
  ComponentSlot,
  HtmlInterpolation,
  ComponentUsage,
  HtmlElementUsage,
  DomApiEffect,
  DomApiTargetKind,
  DomApiArgKind,
  DomApiArgSource,
  DomApiArg,
  DomApiContext,
} from '../../types-vue-template.js';

// ============================================================
// РЕЭКСПОРТ TEMPLATE-ТИПОВ ИЗ src/types.ts
// ============================================================

import type {
  TemplateEventHandler,
  TemplateDynamicComponent,
  TemplateRefUsage,
  TemplateCssVariable,
  TemplateDeepSelector,
  TemplateConditional,
} from '../../types.js';

export type {
  /** Обработчик события из шаблона Vue (type alias на vue-analyzer) */
  TemplateEventHandler,
  /** Динамический компонент (type alias на vue-analyzer) */
  TemplateDynamicComponent,
  /** Template ref (type alias на vue-analyzer) */
  TemplateRefUsage,
  /** CSS-переменная из <style> (type alias на vue-analyzer) */
  TemplateCssVariable,
  /** :deep() селектор (type alias на vue-analyzer) */
  TemplateDeepSelector,
  /** Условный рендеринг (расширяет vue-analyzer + id?/fileId?) */
  TemplateConditional,
} from '../../types.js';

// ============================================================
// CONDITIONAL DIRECTIVE (type alias)
// ============================================================

/**
 * Директива условного рендеринга: v-if | v-else-if | v-else.
 */
export type ConditionalDirective = TemplateConditional['directive'];

// ============================================================
// ✅ v15.2.0 (P1): LEXICAL LINKS
// ============================================================

/**
 * Вид лексической связи между функциями.
 */
export type LexicalRelation =
  | 'nested'
  | 'arrow-var'
  | 'callback'
  | 'iife'
  | 'class-method'
  | 'object-prop'
  | 'return'
  | 'default-export';

/**
 * Лексическая связь: parent → child.
 */
export interface LexicalLink {
  id: string;
  parentFunctionId: string | null;
  childFunctionId: string;
  relation: LexicalRelation;
  line: number;
  argumentIndex?: number;
  calleeName?: string;
}

// ============================================================
// ✅ v15.4.0 (P3): CROSS-FILE TYPES (реэкспорт)
// ============================================================

export type {
  CrossFileCall,
  CrossFileResolverOptions,
  ResolveStats,
  ResolvedCallee,
} from '../../core/cross-file-resolver/types.js';

// ============================================================
// ✅ v15.5.0: VUE ENTITIES
// ============================================================

/**
 * Тип функции с точки зрения Vue.
 */
export type VueKind =
  'function' | 'composable' | 'macro' | 'hook' | 'reactivity' | 'callback' | 'arrow';

/**
 * Битовая маска блоков SFC-компонента.
 *
 *   1  = <script>
 *   2  = <script setup>
 *   4  = <template>
 *   8  = <style>
 */
export type SfcBlockMask = number;

/**
 * SFC-компонент (.vue).
 */
export interface SFCComponent {
  /** ID файла (f1, f2, ...) */
  fileId: string;

  /** ID модуля (m1, m2, ...) */
  moduleId: string;

  /** Имя компонента */
  name: string;

  /** Битовая маска блоков */
  blocks: SfcBlockMask;

  /** Composables, использованные в <script setup> */
  composables: string[];

  /** Props (реальные имена — v16.0.0) */
  props: string[];

  /** Emits (реальные имена — v16.0.0) */
  emits: string[];

  /** Exposed (реальные имена — v16.0.0) */
  exposed: string[];

  /**
   * Использования компонентов в <template>.
   */
  componentUsages?: ComponentUsage[];

  /**
   * Использования HTML-элементов в <template>.
   */
  htmlElements?: HtmlElementUsage[];
}

/**
 * Composable-функция.
 */
export interface ComposableEntity {
  id: string;
  name: string;
  fileId: string;
  kind: 'composable' | 'store' | 'factory' | 'utility';
  returnShape: 'void' | 'object' | 'ref' | 'reactive' | 'function';
  returnedKeys: string[];
  callers: string[];
}

/**
 * Vue-макрос.
 */
export interface MacroEntity {
  id: string;
  fileId: string;
  kind: 'props' | 'emits' | 'expose' | 'slots' | 'model' | 'options';
  line: number;
}

/**
 * Lifecycle hook или watcher.
 */
export interface HookEntity {
  id: string;
  fileId: string;
  hookName: string;
  line: number;
}

/**
 * Реактивный примитив или watcher.
 */
export interface ReactivityEntity {
  id: string;
  fileId: string;
  kind: 'computed' | 'ref' | 'reactive' | 'watch' | 'shallowRef' | 'readonly' | 'toRef' | 'toRefs';
  line: number;
  name?: string;

  /**
   * ✅ v16.2.0: используется ли переменная в <template>.
   */
  usedInTemplate?: boolean;
}

/**
 * Иконка-компонент.
 */
export interface IconEntity {
  id: string;
  fileId: string;
  name: string;
  category: 'base' | 'filter' | 'toolbar' | 'sort';
}

// ============================================================
// ✅ v16.0.0: HTML OUTPUT USAGE
// ============================================================

/**
 * Категория UI-вывода.
 */
export type HtmlOutputKind =
  // Vue-шаблон
  | 'rendered-text'
  | 'rendered-attr'
  | 'rendered-cond'
  | 'rendered-list'
  | 'rendered-class'
  | 'rendered-style'
  | 'passed-to-component'
  | 'event-handler'
  | 'slot-content'
  // DOM API (TS/JS)
  | 'dom-api';

/**
 * Использование функции в UI-выводе.
 */
export interface HtmlUsage {
  kind: HtmlOutputKind;
  usageId: string | null;
  tag: string;
  target: string;
  line: number;
  column?: number;

  // ⭐ Для kind === 'dom-api'
  domApiCategory?: DomApiCategory;
  domApiMethod?: string;
  domApiTarget?: string;
  domApiContext?: DomApiContext;
}

/**
 * Обратная связь: функция как источник prop.
 */
export interface PropUsage {
  usageId: string;
  propId: string;
  propName: string;
  tag: string;
  targetFileId: string | null;
}

// ============================================================
// ✅ v16.0.0: DOM API
// ============================================================

/**
 * Категория DOM API-вызова.
 */
export type DomApiCategory =
  // Слушатели событий (P0)
  | 'add-event-listener'
  | 'remove-event-listener'
  | 'dispatch-event'
  // Создание / вставка (P1)
  | 'create-element'
  | 'append-child'
  | 'insert-before'
  | 'remove-child'
  | 'replace-child'
  | 'clone-node'
  | 'import-node'
  | 'adopt-node'
  // Содержимое (P1)
  | 'inner-html'
  | 'outer-html'
  | 'text-content'
  | 'inner-text'
  | 'insert-adjacent-html'
  | 'insert-adjacent-element'
  | 'insert-adjacent-text'
  // Атрибуты (P1)
  | 'set-attribute'
  | 'remove-attribute'
  | 'get-attribute'
  | 'has-attribute'
  | 'toggle-attribute'
  // Стили (P1)
  | 'class-list'
  | 'class-list-add'
  | 'class-list-remove'
  | 'class-list-toggle'
  | 'dataset'
  | 'set-property'
  | 'style-set'
  | 'style-remove'
  // Запросы (P2)
  | 'query-selector'
  | 'query-selector-all'
  | 'get-element-by-id'
  | 'get-elements-by-class'
  | 'get-elements-by-tag'
  | 'get-elements-by-name'
  | 'closest'
  | 'matches'
  | 'get-root-node'
  // Наблюдатели (P2)
  | 'mutation-observer'
  | 'resize-observer'
  | 'intersection-observer'
  | 'performance-observer'
  // Прочее (P3)
  | 'focus'
  | 'blur'
  | 'scroll-into-view'
  | 'scroll-to'
  | 'click-programmatic'
  | 'other';

/**
 * DOM API-вызов.
 */
export interface DomApiCall {
  id: string;
  functionId: string;
  fileId: string;
  category: DomApiCategory;
  effect: DomApiEffect;
  method: string;
  target: string;
  targetKind: DomApiTargetKind;
  args: string[];
  argResolutions: DomApiArg[];
  line: number;
  column?: number;
  context: DomApiContext;
}

/**
 * Обратная связь: функция как обработчик DOM-события.
 */
export interface DomApiHandlerUsage {
  callId: string;
  category: DomApiCategory;
  eventName: string;
  target: string;
  line: number;
}

// ============================================================
// ✅ v16.0.0: VUE SECTION (FullJSON)
// ============================================================

/**
 * Секция Vue-сущностей в FullJSON.
 */
export interface VueSectionFull {
  /** SFC-компоненты */
  sfc: SFCComponent[];
  /** Composables */
  composables: ComposableEntity[];
  /** Макросы */
  macros: MacroEntity[];
  /** Hooks / watchers */
  hooks: HookEntity[];
  /** Реактивные примитивы */
  reactivity: ReactivityEntity[];
  /** Иконки */
  icons: IconEntity[];

  // ==========================================
  // ✅ v16.0.0: обратные связи и DOM API
  // ==========================================

  /** Component props (обратная связь) */
  componentProps?: ComponentProp[];
  /** Component events (обратная связь) */
  componentEvents?: ComponentEvent[];
  /** Component directives */
  componentDirectives?: ComponentDirective[];
  /** Component slots */
  componentSlots?: ComponentSlot[];
  /** HTML interpolations */
  htmlInterpolations?: HtmlInterpolation[];
  /** Function → html usage */
  fnHtmlUsage?: HtmlUsage[];
  /** DOM API calls */
  domApiCalls?: DomApiCall[];
  /** DOM API args */
  domApiArgs?: DomApiArg[];
  /** Сгенерированные id */
  ids?: string[];
  /** Сериализованные sourceChain */
  sourceChains?: string[];
}

// ============================================================
// ✅ v16.2.0: VUE SECTION (CompactJSON)
// ============================================================

export interface VueSectionCompact {
  sfc: {
    f: number[];
    n: number[];
    b: number[];
    c: number[];
    cs: Array<[number, number]>;

    pn?: number[];
    ps?: Array<[number, number]>;
    en?: number[];
    es?: Array<[number, number]>;
    xn?: number[];
    xs?: Array<[number, number]>;

    cu_id?: number[];
    cu_pf?: number[];

    cu_sfc?: [number, number, number?][];
    cu_tag?: number[];
    cu_file?: number[];
    cu_src?: number[];
    cu_pkg?: number[];
    cu_l?: number[];
    cu_col?: number[];
    cu_cp?: Array<[number, number]>;
    cu_ce?: Array<[number, number]>;
    cu_cd?: Array<[number, number]>;
    cu_csl?: Array<[number, number]>;

    he_id?: number[];
    he_pf?: number[];

    he_sfc?: [number, number, number?][];
    he_tag?: number[];
    he_l?: number[];
    he_col?: number[];
    he_cp?: Array<[number, number]>;
    he_cd?: Array<[number, number]>;
    he_ce?: Array<[number, number]>;
    he_ci?: Array<[number, number]>;
  };
  composables: {
    n: number[];
    f: [number, number][];
    k: number[];
    r: number[];
    v: [number, number][];
  };
  macros: {
    f: number[];
    k: number[];
    l: number[];
  };
  hooks: {
    f: number[];
    n: number[];
    l: number[];
  };
  reactivity: {
    f: number[];
    k: number[];
    l: number[];
    n: number[];
    usedInTemplate?: number[];
  };
  icons: {
    f: number[];
    n: number[];
    c: number[];
  };

  componentProps?: {
    n: number[];
    v: number[];
    k: number[];
    l: number[];
    id: number[];
    mc: number[];
    lv: number[];
    sc: [number, number, number?][];
    fns: number[];
    idn?: number[];
  };
  componentEvents?: {
    n: number[];
    h: number[];
    fn: number[];
    s: number[];
    m: number[];
    l: number[];
    sc: [number, number, number?][];
    id?: number[];
  };
  componentDirectives?: {
    n: number[];
    a: number[];
    m: number[];
    v: number[];
    l: number[];
    id?: number[];
  };
  componentSlots?: {
    n: number[];
    sc: number[];
    sn: number[];
    l: number[];
    id?: number[];
  };
  htmlInterpolations?: {
    e: number[];
    sc: [number, number, number?][];
    l: number[];
    id?: number[];
  };
}

// ============================================================
// ПОЛНЫЙ (ЧИТАЕМЫЙ) JSON
// ============================================================

export interface FullJSON {
  version: string;
  timestamp: string;
  root: string;

  modules: ModuleData[];
  files: FileData[];
  functions: FunctionData[];
  classes: ClassData[];
  constants: ConstantData[];
  exports: ExportData[];
  imports: ImportData[];
  calls: CallData[];
  reExports: ReExportData[];

  templates?: TemplateData[];
  lexicalLinks?: LexicalLink[];
  vue?: VueSectionFull;
  react?: ReactSectionFull;

  statistics: StatisticsData;
  edges?: EdgeData[];

  lifecycle?: LifecycleHook[];
  effects?: EffectEdge[];
  injections?: InjectionEdge[];
  reactivity?: ReactivityEdge[];
  types?: TypeNodeData[];
  typeRefs?: TypeRefData[];

  valuesMode?: 'full' | 'relations';

  fnHtmlUsage?: HtmlUsage[];
  componentProps?: ComponentProp[];
  componentEvents?: ComponentEvent[];
  componentDirectives?: ComponentDirective[];
  componentSlots?: ComponentSlot[];
  htmlInterpolations?: HtmlInterpolation[];
  domApiCalls?: DomApiCall[];
  domApiArgs?: DomApiArg[];
  sourceChains?: string[];
  ids?: string[];
}

// ============================================
// МОДУЛЬ
// ============================================

export interface ModuleData {
  id: string;
  name: string;
  path: string;
  fileIds: string[];
}

// ============================================
// ФАЙЛ
// ============================================

export interface FileData {
  id: string;
  path: string;
  moduleId: string;
}

// ============================================
// ФУНКЦИЯ
// ============================================

export interface FunctionData {
  id: string;
  name: string;
  moduleId: string;
  fileId: string;
  line: number;

  isExported: boolean;
  isAsync: boolean;
  isArrow: boolean;
  isMethod: boolean;

  params: string[];
  returnType?: string;

  isEventHandler?: boolean;
  isNested?: boolean;
  isSelf?: boolean;
  isDynamic?: boolean;
  isConfig?: boolean;
  isExternal?: boolean;
  isVueTemplate?: boolean;
  isAsyncChain?: boolean;
  isClosure?: boolean;
  isTypeDep?: boolean;
  isGenerator?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  isStatic?: boolean;

  parentFunctionId?: string | null;
  vueKind?: VueKind;

  htmlUsage?: HtmlUsage[];
  isHtmlVisible?: boolean;
  usagesAsPropSource?: PropUsage[];
  domApiCalls?: string[];
  domApiUsagesAsHandler?: DomApiHandlerUsage[];
}

// ============================================
// КЛАСС
// ============================================

export interface ClassData {
  id: string;
  name: string;
  moduleId: string;
  fileId: string;
  line: number;
  isExported: boolean;
  methods: (string | null)[];
}

// ============================================
// КОНСТАНТА
// ============================================

export interface ConstantData {
  id: string;
  name: string;
  moduleId: string;
  fileId: string;
  line: number;
  isExported: boolean;
  value?: unknown;
}

// ============================================
// ЭКСПОРТ
// ============================================

export interface ExportData {
  id: string;
  moduleId: string;
  fileId: string;
  functionId: string;
  exportName: string;
  localName: string;
  line: number;
  type: 'named' | 'default' | 'type';
  isDefault: boolean;
  isTypeOnly: boolean;
  isReExport?: boolean;
  isStarReExport?: boolean;
  isDefaultReExport?: boolean;
  source?: string;
}

// ============================================
// ИМПОРТ
// ============================================

export interface ImportData {
  id: string;
  fromFileId: string;
  toFileId: string | null;
  source: string;
  importedName: string;
  localName: string;
  line: number;

  type: 'named' | 'default' | 'namespace';
  isDefault: boolean;
  isNamespace: boolean;
  isTypeOnly: boolean;
  isExternal: boolean;
  packageName?: string;

  isReExport?: boolean;
  isStarReExport?: boolean;
}

// ============================================
// ВЫЗОВ
// ============================================

export interface CallData {
  id: string;
  fromFunctionId: string;
  toFunctionId: string;
  line: number;

  type: 'direct' | 'async' | 'method' | 'callback';

  column?: number;

  callKind?:
    | 'direct'
    | 'method'
    | 'callback'
    | 'constructor'
    | 'tagged-template'
    | 'optional-chain'
    | 'spread'
    | 'new';

  calleeName?: string;
  argumentIndex?: number;
}

// ============================================
// РЕЭКСПОРТ
// ============================================

export interface ReExportData {
  id: string;
  moduleId: string;
  functionId: string;
  source: string;
  exportName: string;
  line: number;
  type: 'named' | 'default' | 'all';
  isDefault: boolean;
  isTypeOnly: boolean;
  isStarReExport: boolean;
}

// ============================================
// VUE TEMPLATE
// ============================================

export interface TemplateData {
  fileId: string;
  moduleId: string;
  reactivityDeps: string[];
  eventHandlers: TemplateEventHandler[];
  dynamicComponents: TemplateDynamicComponent[];
  directives: string[];
  usedComponents: string[];
  templateRefs: TemplateRefUsage[];
  cssVariables: TemplateCssVariable[];
  deepSelectors: TemplateDeepSelector[];
  slots: string[];
  complexity: number;

  conditionals?: TemplateConditional[];
}

// ============================================
// LIFECYCLE
// ============================================

export type LifecycleHookName =
  | 'onMounted'
  | 'onUnmounted'
  | 'onScopeDispose'
  | 'onActivated'
  | 'onDeactivated'
  | 'watch'
  | 'watchEffect'
  | 'onErrorCaptured';

export interface LifecycleHook {
  id: string;
  hookName: LifecycleHookName;
  functionId: string;
  line: number;
  callbackFunctionId?: string;
  isSetupContext: boolean;
}

// ============================================
// EFFECTS
// ============================================

export type EffectType = 'timer' | 'cleanup' | 'promise' | 'event' | 'subscription';

export interface EffectEdge {
  id: string;
  effectType: EffectType;
  functionId: string;
  line: number;
  targetName: string;
  metaValue?: string;
}

// ============================================
// INJECTIONS
// ============================================

export type InjectionKind = 'provide' | 'inject';

export interface InjectionEdge {
  id: string;
  kind: InjectionKind;
  fileId: string;
  line: number;
  key: string;
  isSymbolKey: boolean;
  hasDefault: boolean;
}

// ============================================
// REACTIVITY
// ============================================

export type ReactivityKind =
  'computed' | 'watch' | 'watchEffect' | 'ref' | 'reactive' | 'shallowRef' | 'readonly';

export interface ReactivityEdge {
  id: string;
  kind: ReactivityKind;
  functionId: string;
  line: number;
  reads: string[];
  writes: string[];
  isWriteable: boolean;
}

// ============================================
// TYPES
// ============================================

export type TypeKind = 'interface' | 'type-alias' | 'enum' | 'class';

export interface TypeNodeData {
  id: string;
  kind: TypeKind;
  name: string;
  moduleId: string;
  fileId: string;
  line: number;
  members: string[];
  extendsTypes: string[];
}

export type TypeUsageKind = 'param' | 'return' | 'field' | 'generic' | 'union' | 'extends';

export interface TypeRefData {
  id: string;
  typeName: string;
  moduleId: string;
  fileId: string;
  line: number;
  usageKind: TypeUsageKind;
}

// ============================================
// СТАТИСТИКА
// ============================================

export interface StatisticsData {
  // Существующие 18 (15.7.3)
  totalModules: number;
  totalFiles: number;
  totalFunctions: number;
  totalClasses: number;
  totalConstants: number;
  totalExports: number;
  totalImports: number;
  totalCalls: number;
  totalReExports: number;
  totalTemplates?: number;
  totalConditionals?: number;
  totalLexicalLinks?: number;
  totalVueSfc?: number;
  totalComposables?: number;
  totalMacros?: number;
  totalHooks?: number;
  totalReactivity?: number;
  totalIcons?: number;

  // ✅ v16.0.0: новые 8 счётчиков
  totalComponentUsages?: number;
  totalHtmlElements?: number;
  totalComponentProps?: number;
  totalComponentEvents?: number;
  totalDomApiCalls?: number;
  totalSourceChains?: number;
  totalHtmlVisibleFns?: number;
  totalDomApiVisibleFns?: number;

  // ✅ v17.0.0: React-счётчики (10 полей)
  totalReactComponents?: number;
  totalReactHooks?: number;
  totalReactEffects?: number;
  totalReactContexts?: number;
  totalReactMemoization?: number;
  totalReactRefs?: number;
  totalJsxElements?: number;
  totalJsxEvents?: number;
  totalReactConditionals?: number;
  totalReactComponentUsages?: number;
}

// ============================================
// ЕДИНОЕ РЕБРО ГРАФА
// ============================================

export interface EdgeData {
  from: string;
  to: string;
  type: 'import' | 'export' | 'call' | 're-export' | 'lexical';
  symbol?: string;
  line?: number;
}

// ============================================================
// СЖАТЫЙ JSON (v17.1.0)
// ============================================================

export interface CompactJSON {
  v: string;
  ts: string;
  r: number;
  valuesMode?: 'full' | 'relations';

  tokens: (string | number)[];
  strs: (string | number[])[];
  params: (string | number[])[];
  methods: (string | number[])[];
  values: unknown[];

  mi: {
    n: string[];
    f: [number, number][];
  };

  fl: {
    p: string[];
    m: [number, number][];
  };

  fns: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    p: number[][];
    rt: number[];
    parent?: [number, number][];
    vk?: [number, number][];
    hv?: [number, number][];
  };

  cls: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    methods: number[][];
  };

  cn: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    nonEmptyV: [number, number][];
  };

  gr: {
    e: {
      m: number[];
      f: number[];
      fn: number[];
      l: number[];
      ty: number[];
      en: number[];
      ln: number[];
      s: number[];
      flags: number[];
    };
    i: {
      ff: number[];
      tf: number[];
      s: number[];
      im: number[];
      ln: number[];
      l: number[];
      ty: number[];
    };
    c: {
      f: number[];
      t: number[];
      l: number[];
      ty: number[];
      col?: number[];
      ck?: number[];
      cn?: number[];
      ai?: number[];
    };
    re: {
      m: number[];
      fn: number[];
      s: number[];
      en: number[];
      l: number[];
      ty: number[];
    };
  };

  vt?: number[];
  lc?: number[];
  ef?: number[];
  inj?: number[];
  rx?: number[];
  cd?: number[];
  ty?: number[];
  tr?: number[];

  lx?: {
    p: [number, number][];
    c: [number, number][];
    r: number[];
    l: number[];
    ai: number[];
    cn: number[];
  };

  vue?: VueSectionCompact;
  react?: ReactSectionCompact;

  fnHtmlUsage?: {
    fn: number[];
    k: number[];
    u: number[];
    t: number[];
    tg: number[];
    l: number[];
    col: number[];
    dcat: number[];
    dctx: number[];
  };

  componentProps?: {
    n: number[];
    v: number[];
    k: number[];
    l: number[];
    id: number[];
    mc: number[];
    lv: number[];
    sc: [number, number, number?][];
    fns: number[];
    idn?: number[];
  };

  componentEvents?: {
    n: number[];
    h: number[];
    fn: number[];
    s: number[];
    m: number[];
    l: number[];
    sc: [number, number, number?][];
    id?: number[];
  };

  componentDirectives?: {
    n: number[];
    a: number[];
    m: number[];
    v: number[];
    l: number[];
    id?: number[];
  };

  componentSlots?: {
    n: number[];
    sc: number[];
    sn: number[];
    l: number[];
    id?: number[];
  };

  htmlInterpolations?: {
    e: number[];
    sc: [number, number, number?][];
    l: number[];
    id?: number[];
  };

  domApiCalls?: {
    fn: number[];
    f: [number, number, number?][];
    cat: number[];
    eff: number[];
    m: number[];
    t: number[];
    tk: number[];
    l: number[];
    col: number[];
    argSlices: [number, number][];
    en: number[];
    hfn: number[];
    hs: number[];
    sel: number[];
    hv: number[];
    cn: number[];
    sp: number[];
    an: number[];
    oo: number[];
  };

  domApiArgs?: {
    r: number[];
    k: number[];
    fn: number[];
    s: number[];
  };

  ids?: string[];
  sourceChains?: string[];

  st: StatisticsData;
  legend: CodecLegend;
}

// ============================================================
// ЛЕГЕНДА (v17.1.0)
// ============================================================

export interface FlagBit {
  bit: number;
  name: string;
  description: string;
}

export interface CodesDict {
  [code: string]: string;
}

export interface CodecLegend {
  version?: string;

  codes: {
    export: CodesDict;
    import: CodesDict;
    call: CodesDict;
    reExport: CodesDict;
    lifecycle: CodesDict;
    effect: CodesDict;
    injection: CodesDict;
    reactivity: CodesDict;
    conditional: CodesDict;
    typeKind: CodesDict;
    typeUsage: CodesDict;
    lexicalRelation?: CodesDict;
    callKind?: CodesDict;
    vueKind?: CodesDict;
    sfcBlock?: CodesDict;
    hookName?: CodesDict;
    reactivityKind?: CodesDict;
    iconCategory?: CodesDict;
    composableKind?: CodesDict;

    componentSource?: CodesDict;
    propKind?: CodesDict;
    eventHandlerSource?: CodesDict;
    htmlOutputKind?: CodesDict;
    sourceChainKind?: CodesDict;
    domApiCategory?: CodesDict;
    domApiEffect?: CodesDict;
    domApiTargetKind?: CodesDict;
    domApiArgKind?: CodesDict;
    domApiArgSource?: CodesDict;

    // ✅ v17.0.0: React-словари
    reactComponentKind?: CodesDict;
    reactHookKind?: CodesDict;
    reactEffectKind?: CodesDict;
    reactContextKind?: CodesDict;
    reactMemoKind?: CodesDict;
    jsxNodeKind?: CodesDict;
    reactConditionalKind?: CodesDict;
    elementAttrKind?: CodesDict;
  };

  flags: {
    bits: Record<string, string>;
  };

  schemas: {
    mi: string[];
    fl: string[];
    fns: string[];
    cls: string[];
    cn: string[];
    'gr.e': string[];
    'gr.i': string[];
    'gr.c': string[];
    'gr.re': string[];

    vt: string[];
    'vt.eventHandlers': string[];
    'vt.dynamicComponents': string[];
    'vt.templateRefs': string[];
    'vt.cssVariables': string[];
    'vt.deepSelectors': string[];

    lc: string[];
    ef: string[];
    inj: string[];
    rx: string[];
    cd: string[];
    ty: string[];
    tr: string[];

    lx?: string[];

    // Vue-схемы
    'vue.sfc'?: string[];
    'vue.composables'?: string[];
    'vue.macros'?: string[];
    'vue.hooks'?: string[];
    'vue.reactivity'?: string[];
    'vue.icons'?: string[];
    'vue.componentProps'?: string[];
    'vue.componentEvents'?: string[];
    'vue.componentDirectives'?: string[];
    'vue.componentSlots'?: string[];
    'vue.htmlInterpolations'?: string[];
    'vue.fnHtmlUsage'?: string[];
    domApiCalls?: string[];
    domApiArgs?: string[];
    ids?: string[];

    // ✅ v17.0.0: React-схемы
    'react.components'?: string[];
    'react.hooks'?: string[];
    'react.effects'?: string[];
    'react.contexts'?: string[];
    'react.memoization'?: string[];
    'react.refs'?: string[];
    'react.jsxElements'?: string[];
    'react.jsxEvents'?: string[];
    'react.conditionals'?: string[];
    'react.componentUsages'?: string[];

    // ✅ v17.1.0: React flow-схемы
    'react.stateFlows'?: string[];
    'react.eventFlows'?: string[];
    'react.renderTree'?: string[];
    'react.fnJsxUsage'?: string[];
  };
}

// ============================================
// ОПЦИИ ГЕНЕРАЦИИ ОТЧЁТА
// ============================================

export interface GenerateReportOptions {
  outputPath?: string;
  compress?: boolean;
  saveFullJson?: boolean;
  saveFull?: boolean;
  fullJsonSuffix?: string;
  verbose?: boolean;
  useBitFlags?: boolean;
  useDictionaries?: boolean;
  saveEdges?: boolean;
  edgesJsonSuffix?: string;

  valuesMode?: 'full' | 'relations';

  includeBody?: boolean;
  includeVSCode?: boolean;
  projectRoot?: string;
}

// ============================================
// РЕЗУЛЬТАТ ГЕНЕРАЦИИ ОТЧЁТА
// ============================================

export interface GenerateReportResult {
  full: FullJSON;
  compact?: CompactJSON;
  compactPath?: string;
  fullPath?: string;
  edgesPath?: string;

  stats: {
    duration: number;
    compactSize?: number;
    fullSize?: number;
    edgesSize?: number;
    compressionRatio?: number;
    valuesMode?: 'full' | 'relations';
    valuesCount?: number;
  };

  compressionStats?: {
    fullSize: number;
    compactSize: number;
    ratio: number;
    savedPercent: number;
  };
}

// ============================================
// ОПЦИИ ДЕКОДИРОВАНИЯ
// ============================================

export interface DecodeOptions {
  includeEdges?: boolean;
  includeEmptyArrays?: boolean;
  includeStatistics?: boolean;

  valuesMode?: 'full' | 'relations';
}

// ============================================
// РЕЗУЛЬТАТ ПРОВЕРКИ ОБРАТИМОСТИ
// ============================================

export interface RoundTripResult {
  ok: boolean;
  error?: string;

  details?: {
    functionsDiff?: number;
    exportsDiff?: number;
    reExportsDiff?: number;
    callsDiff?: number;
    templatesDiff?: number;
    lifecycleDiff?: number;
    effectsDiff?: number;
    injectionsDiff?: number;
    reactivityDiff?: number;
    conditionalsDiff?: number;
    typesDiff?: number;
    typeRefsDiff?: number;
    lexicalLinksDiff?: number;
    vueDiff?: number;
    reactDiff?: number;
  };
}

// ============================================
// ТИПЫ ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ
// ============================================

export interface ExtendedFunctionData extends FunctionData {
  _uniqueKey?: string;
  _fullPath?: string;
  _moduleDir?: string;
  _body?: string;
  _complexity?: number;
  _security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
}

export interface ExtendedExportData extends ExportData {
  _isReExport?: boolean;
  _source?: string;
  _localName?: string;
}

export interface ExtendedImportData extends ImportData {
  _specifiersStructured?: {
    imported: string;
    local: string;
    type: string;
  }[];
  _boundTo?: string;
  _usageLines?: number[];
}

// ============================================
// RLE ТИП
// ============================================

export type RleArray = Array<[number, number, number?]>;

// ============================================================
// ✅ v17.0.0: REACT SECTION (FullJSON.react)
// ============================================================

export type ElementAttrKind = 'string' | 'expression' | 'handler' | 'boolean' | 'spread';

export interface ElementAttr {
  name: string;
  rawValue: string;
  value: string;
  kind: ElementAttrKind;
  refs: string[];
  handlerFunctionId?: string;
  stateRef?: string;
}

export type JsxNodeKind =
  'element' | 'component' | 'fragment' | 'text' | 'expression' | 'spread' | 'conditional';

export type ReactComponentKind = 'function' | 'arrow' | 'class' | 'memo' | 'forwardRef' | 'lazy';

export type ReactHookKind =
  | 'useState'
  | 'useReducer'
  | 'useEffect'
  | 'useLayoutEffect'
  | 'useInsertionEffect'
  | 'useMemo'
  | 'useCallback'
  | 'useRef'
  | 'useContext'
  | 'useImperativeHandle'
  | 'useTransition'
  | 'useDeferredValue'
  | 'useActionState'
  | 'useOptimistic'
  | 'useFormStatus'
  | 'use';

export type ReactEffectKind = 'mount' | 'update' | 'every' | 'layout' | 'insertion';

export type ReactContextKind = 'create' | 'provide' | 'consume';

export type ReactMemoKind = 'memo' | 'useMemo' | 'useCallback';

export type EventHandlerSource = 'local' | 'import' | 'global' | 'inline' | 'unknown';

export interface ReactComponentEntity {
  id: string;
  fileId: string;
  moduleId: string;
  name: string;
  kind: ReactComponentKind;
  line: number;
  props: string[];
  hooks: string[];
  jsxElements: string[];
  isMemoized: boolean;
  isForwardRef: boolean;
  isDefaultExport: boolean;
  isExported: boolean;
}

export interface ReactHookEntity {
  id: string;
  fileId: string;
  componentId: string;
  kind: ReactHookKind;
  line: number;
  stateName?: string;
  setterName?: string;
  initialValue?: string;
  deps?: string[];
  hasCleanup?: boolean;
  usedInRender?: boolean;
}

export interface ReactEffectEntity {
  id: string;
  fileId: string;
  componentId: string;
  hookId: string;
  kind: ReactEffectKind;
  line: number;
  deps: string[];
  hasCleanup: boolean;
  reads: string[];
  mutates: string[];
}

export interface ReactContextEntity {
  id: string;
  fileId: string;
  componentId: string;
  kind: ReactContextKind;
  line: number;
  name?: string;
}

export interface ReactMemoEntity {
  id: string;
  fileId: string;
  componentId: string;
  kind: ReactMemoKind;
  line: number;
  deps?: string[];
}

export interface ReactRefEntity {
  id: string;
  fileId: string;
  componentId: string;
  line: number;
  name?: string;
  isForwardRef: boolean;
}

export interface JsxElementEntity {
  id: string;
  fileId: string;
  componentId: string;
  kind: JsxNodeKind;
  tagName: string;
  line: number;
  column?: number;
  attrs: ElementAttr[];
  children: string[];
  textContent?: string;
  expression?: string;
  expressionRefs?: string[];
  parentElementId: string | null;
  conditionalKind?: '&&' | '||' | '?:';
  eventIds: string[];
  stateUsages: string[];
  propUsages: string[];
  callExpressions: string[];
}

export interface JsxEventEntity {
  id: string;
  fileId: string;
  elementId: string;
  eventName: string;
  line: number;
  handler: string;
  handlerFunctionId?: string;
  source: EventHandlerSource;
  modifiers?: string[];
}

export interface ReactConditionalEntity {
  id: string;
  fileId: string;
  componentId: string;
  kind: '&&' | '||' | '?:';
  condition: string;
  refs: string[];
  line: number;
  guards: string[];
}

export interface ReactComponentUsage {
  id: string;
  usageId: string;
  tagName: string;
  parentComponentId: string;
  line: number;
  targetComponentId?: string;
  importedFrom?: string;
  isExternal: boolean;
  props: string[];
  events: string[];
  slots: string[];
}

// ============================================================
// ✅ v17.1.0: REACT FLOW-СУЩНОСТИ
// ============================================================

/**
 * Один шаг в цепочке eventFlow.
 */
export interface EventFlowStep {
  step: 'event' | 'handler' | 'call' | 'state' | 'render';
  refId: string;
  label: string;
  line: number;
}

/**
 * Поток события: onClick → handler → call → setState → render.
 */
export interface ReactEventFlow {
  id: string;
  eventId: string;
  eventName: string;
  elementId: string;
  handlerFunctionId: string;
  handlerName: string;
  calls: Array<{
    functionId: string;
    calleeName: string;
    line: number;
  }>;
  mutatedStates: string[];
  reRendered: string[];
  chain: EventFlowStep[];
}

/**
 * Поток состояния.
 */
export interface ReactStateFlow {
  id: string;
  hookId: string;
  stateName: string;
  setterName: string;
  mutatedBy: Array<{
    functionId: string;
    callId: string;
    line: number;
  }>;
  readBy: Array<{
    functionId: string;
    line: number;
  }>;
  renderedIn: Array<{
    jsxElementId: string;
    attrName: string;
    kind: 'attr' | 'text' | 'conditional' | 'handler';
    line: number;
  }>;
}

/**
 * Узел дерева рендера.
 */
export interface ReactRenderNode {
  elementId: string;
  tagName: string;
  kind: 'element' | 'component' | 'fragment';
  parentId: string | null;
  dependsOn: {
    stateIds: string[];
    propIds: string[];
    contextIds: string[];
  };
  conditionals: Array<{
    kind: '&&' | '||' | '?:';
    condition: string;
    refs: string[];
  }>;
}

/**
 * Обратный индекс: функция → JSX-элементы.
 */
export interface ReactFnJsxUsage {
  functionId: string;
  functionName: string;
  usedIn: Array<{
    jsxElementId: string;
    usage: 'handler' | 'value' | 'condition' | 'render';
    line: number;
  }>;
}

/**
 * Полная (читаемая) структура React-секции.
 */
export interface ReactSectionFull {
  components: ReactComponentEntity[];
  hooks: ReactHookEntity[];
  effects: ReactEffectEntity[];
  contexts: ReactContextEntity[];
  memoization: ReactMemoEntity[];
  refs: ReactRefEntity[];
  jsxElements: JsxElementEntity[];
  jsxEvents: JsxEventEntity[];
  conditionals: ReactConditionalEntity[];
  componentUsages: ReactComponentUsage[];

  // ✅ v17.1.0: flow-секции
  stateFlows?: ReactStateFlow[];
  eventFlows?: ReactEventFlow[];
  renderTree?: ReactRenderNode[];
  fnJsxUsage?: ReactFnJsxUsage[];

  // Служебные
  ids?: string[];
  sourceChains?: string[];
}

// ============================================================
// ✅ v17.1.0: REACT SECTION (CompactJSON.react)
// ============================================================

export interface ReactSectionCompact {
  components: {
    f: number[];
    m: number[];
    n: number[];
    k: number[];
    l: number[];
    p: [number, number][];
    h: [number, number][];
    j: [number, number][];
    fl: number[];
  };

  hooks: {
    f: number[];
    c: number[];
    k: number[];
    l: number[];
    sn: number[];
    tn: number[];
    iv: number[];
    d: number[];
    fl: number[];
  };

  effects: {
    f: number[];
    c: number[];
    hk: number[];
    k: number[];
    l: number[];
    d: number[];
    fl: number[];
    r: number[];
    mu: number[];
  };

  contexts: {
    f: number[];
    c: number[];
    k: number[];
    l: number[];
    n: number[];
  };

  memoization: {
    f: number[];
    c: number[];
    k: number[];
    l: number[];
    d: number[];
  };

  refs: {
    f: number[];
    c: number[];
    l: number[];
    n: number[];
    fl: number[];
  };

  jsxElements: {
    f: number[];
    c: number[];
    k: number[];
    n: number[];
    l: number[];
    /** ✅ v17.1.0: column (позиция в строке) */
    col: number[];
    a: number[];
    ch: number[];
    tx: number[];
    ex: number[];
    pa: number[];
    ck: number[];
  };

  jsxEvents: {
    f: number[];
    e: number[];
    n: number[];
    l: number[];
    h: number[];
    hf: number[];
    s: number[];
  };

  conditionals: {
    f: number[];
    c: number[];
    k: number[];
    cd: number[];
    r: number[];
    l: number[];
    g: number[];
  };

  componentUsages: {
    u: number[];
    n: number[];
    c: number[];
    l: number[];
    t: number[];
    im: number[];
    fl: number[];
    p: number[];
    e: number[];
    s: number[];
  };

  // ✅ v17.1.0: flow-секции (прямая сериализация, без columnar)
  stateFlows?: any[];
  eventFlows?: any[];
  renderTree?: any[];
  fnJsxUsage?: any[];
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  CODEC_VERSION,
  LEGEND_VERSION,
};
