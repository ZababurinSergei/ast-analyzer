// src/types.ts
// ==========================================
// КОНФИГУРАЦИОННЫЕ ТИПЫ
// ==========================================

export interface AnalyzerConfig {
  ignoreNodeModules: boolean;
  supportedExtensions: string[];
  defaultExcludePatterns: string[];
  vueScriptPattern: RegExp;
}

// ==========================================
// ТИПЫ ДЛЯ ПАРСИНГА И АНАЛИЗА ФАЙЛОВ
// ==========================================

export interface Location {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export interface ImportSpecifier {
  local: string;
  imported: string;
  type: string;
}

export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  loc: Location | null;
  isTypeOnly?: boolean;

  // ✅ Поля для полного графа импортов/экспортов
  /** Номер строки импорта (из loc.start.line) */
  line?: number;
  /** ID файла-цели (или `external:xxx`, `unresolved:xxx`) */
  toFileId?: string | null;
  /** Является ли модуль внешним (node_modules) */
  isExternal?: boolean;
  /** Имя пакета (для внешних модулей) */
  packageName?: string;
  /** Структурированные specifiers (для точного графа) */
  specifiersStructured?: {
    imported: string;
    local: string;
    type: string;
  }[];

  // ✅ НОВОЕ v15.0.0: признак реэкспорта
  /** Является ли запись реэкспортом (`export { X } from './foo'` или `export * from './foo'`) */
  isReExport?: boolean;
  /** Является ли `export * from './foo'` (без явного имени) */
  isStarReExport?: boolean;
}

export interface ExportInfo {
  name: string;
  type:
    | 'function'
    | 'class'
    | 'constant'
    | 'value'
    | 'default'
    | 'interface'
    | 'type'
    | 'enum'
    | 'object'
    | 'all'
    | 're-export'
    | 'named';
  isDefault: boolean;
  loc: Location | null;
  params?: string[];
  async?: boolean;
  startLine?: number;
  endLine?: number;
  isReExport?: boolean;
  source?: string;
  isTypeOnly?: boolean;
  specifiers?: string[];

  // ✅ НОВЫЕ ПОЛЯ для полного графа импортов/экспортов и round-trip
  /** Номер строки (из loc.start.line) */
  line?: number;
  /** Локальное имя (при `export { a as b }` → `a`) */
  localName?: string;
  /** Является ли `export * from '...'` */
  isStarReExport?: boolean;
  /** Является ли `export { default } from '...'` */
  isDefaultReExport?: boolean;

  // ✅ НОВОЕ: Метаданные разворачивания re-exports
  /** Промежуточные файлы в цепочке re-export */
  _resolvedFrom?: string[];
  /** Глубина разворачивания (1 = прямая связь) */
  _depth?: number;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС ClassInfo
// ==========================================

export interface ClassInfo {
  name: string;
  line: number;
  isExported: boolean;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС ConstantInfo
// ==========================================

export interface ConstantInfo {
  name: string;
  line: number;
  value?: any;
  isExported: boolean;
  type?: string;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС InterfaceInfo
// ==========================================

export interface InterfaceInfo {
  name: string;
  line: number;
  isExported: boolean;
  properties: string[];
  extends?: string[];
  startLine: number;
  endLine: number;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС TypeInfo
// ==========================================

export interface TypeInfo {
  name: string;
  line: number;
  isExported: boolean;
  definition: string;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС VariableInfo
// ==========================================

export interface VariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type?: string;
  value?: any;
}

// ==========================================
// ТИПЫ ДЛЯ СВЯЗЕЙ (v3.0.1)
// ==========================================

export interface CallInfo {
  targetId: string;
  targetName: string;
  targetFile: string;
  targetLine: number;
  targetVscode: string;
  callLine: number;
  callType:
    'direct' | 'import' | 'computed' | 'watch' | 'event' | 'lifecycle' | 'method' | 'constructor';
}

export interface CalledByInfo {
  callerId: string;
  callerName: string;
  callerFile: string;
  callerLine: number;
  callerVscode: string;
  callLine: number;
  callType:
    'direct' | 'import' | 'computed' | 'watch' | 'event' | 'lifecycle' | 'method' | 'constructor';
}

export interface ImportedByInfo {
  importerId: string;
  importerFile: string;
  importerVscode: string;
  importLine: number;
  specifier: string;
  importType?: 'named' | 'default' | 'namespace' | 'type';
}

// ==========================================
// ✅ v15.2.0 (P1): LEXICAL LINKS
// ==========================================
//
// Лексические связи — статические связи между функциями,
// описывающие вложенность в AST (кто внутри кого объявлен).
//
// ════════════════════════════════════════════════════════════
// СИНХРОНИЗАЦИЯ С codec-types.ts
// ════════════════════════════════════════════════════════════
//
//   LexicalRelation и LexicalLink дублируются в:
//     - src/types.ts                     (этот файл)
//     - src/reporters/codec/codec-types.ts
//
//   Причина: codec-types.ts использует свой набор для сериализации,
//   а src/types.ts — для внутреннего представления.
//
//   Изменения в одном месте должны быть отражены в другом.
// ==========================================

/**
 * Вид лексической связи между функциями.
 *
 * ════════════════════════════════════════════════════════════
 * ЗНАЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - `'nested'`         — вложенная функция: `function outer() { function inner() {} }`
 *   - `'arrow-var'`      — arrow в переменной: `const fn = () => {}`
 *   - `'callback'`       — колбэк: `arr.map(x => x)`, `setTimeout(() => {}, 100)`
 *   - `'iife'`           — IIFE: `(function() {})()`
 *   - `'class-method'`   — метод класса: `class A { method() {} }`
 *   - `'object-prop'`    — метод объекта: `{ onClick: () => {} }`
 *   - `'return'`         — возврат функции: `return () => {}`
 *   - `'default-export'` — `export default () => {}`
 *
 * ════════════════════════════════════════════════════════════
 * СИНХРОНИЗАЦИЯ С inferFunctionName.ts
 * ════════════════════════════════════════════════════════════
 *
 *   `LexicalRelation` синхронизирован с логикой
 *   `helpers/infer-function-name.ts` (v2.1.0).
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
 *
 * ════════════════════════════════════════════════════════════
 * СЕМАНТИКА
 * ════════════════════════════════════════════════════════════
 *
 *   Описывает **статическую** связь: `child` объявлен **внутри**
 *   `parent` в AST. Это НЕ вызов — это вложенность.
 *
 *   Отличие от `CallInfo`:
 *     - `CallInfo` — динамическая связь (кто кого вызывает).
 *     - `LexicalLink` — статическая связь (кто внутри кого объявлен).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   function outer() {
 *     arr.map(x => x);
 *   }
 *
 *   → {
 *       id: 'lx1',
 *       parentFunctionId: 'fn1',   // outer
 *       childFunctionId: 'fn2',    // callback
 *       relation: 'callback',
 *       line: 2,
 *       argumentIndex: 0,
 *       calleeName: 'map',
 *     }
 */
export interface LexicalLink {
  /** Уникальный ID (lx1, lx2, ...) */
  id: string;

  /** ID функции-родителя (null для top-level) */
  parentFunctionId: string | null;

  /** ID вложенной функции (колбэк, nested, ...) */
  childFunctionId: string;

  /** Вид лексической связи */
  relation: LexicalRelation;

  /** Строка объявления child (1-based) */
  line: number;

  /** Индекс аргумента (только для relation='callback') */
  argumentIndex?: number;

  /** Имя callee (только для relation='callback') */
  calleeName?: string;
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС FunctionInfo
// ==========================================
//
// ✅ v15.1.0 (P0): добавлено поле parentFunctionId.
// ==========================================

export interface FunctionInfo {
  name: string;
  line: number;
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  returnType?: string;
  calls: string[];
  calledBy: string[];
  body?: string;
  startLine: number;
  endLine: number;
  isMethod?: boolean;
  className?: string;
  isNested?: boolean;
  parentFunction?: string;
  isArrow?: boolean;
  isEventHandler?: boolean;
  eventType?: string;
  depth: number;
  complexity?: number;
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
  id?: string;
  vscode?: string;
  callsInfo?: CallInfo[];
  calledByInfo?: CalledByInfo[];
  importedBy?: ImportedByInfo[];
  filePath?: string;
  moduleName?: string;
  _modulePath?: string;
  _safeInfo?: any;
  isConst?: boolean;
  isMacro?: boolean;
  isComposable?: boolean;
  source?: string;
  signature?: string;
  moduleId?: string;
  fileId?: string;
  _uniqueKey?: string;
  _fullPath?: string;

  // ✅ НОВОЕ: функция экспонируется через defineExpose (Vue)
  isExposed?: boolean;

  // ✅ НОВЫЕ ПОЛЯ (синхронизация с json-reporter.ts):
  /** Является ли функция изолированной (никого не вызывает и её никто не вызывает) */
  isSelf?: boolean;
  /** Внутренний флаг для отладки — совпадает с isSelf */
  _isSelf?: boolean;

  // ==========================================
  // ✅ v15.1.0 (P0): лексический родитель
  // ==========================================

  /**
   * ID функции, внутри которой эта функция объявлена в AST.
   *
   * ════════════════════════════════════════════════════════════
   * ЗНАЧЕНИЯ
   * ════════════════════════════════════════════════════════════
   *
   *   - `string` — ID родительской функции (fn1, fn2, ...)
   *   - `null`   — top-level функция (объявлена на уровне модуля)
   *   - `undefined` — функция не имеет лексического родителя
   *     (не должно происходить в норме, но для совместимости)
   */
  parentFunctionId?: string | null;

  // ==========================================
  // ✅ v15.2.0 (P1): boundTo для колбэков
  // ==========================================

  /**
   * Информация о вызове, в который передана колбэк.
   *
   * Заполняется только для колбэков (relation === 'callback').
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   arr.map(x => x)
   *
   *   → {
   *       calleeName: 'map',
   *       argumentIndex: 0,
   *       line: 1,
   *     }
   */
  boundTo?: {
    /** Имя callee (`map`, `setTimeout`, `addEventListener`) */
    calleeName: string;
    /** Индекс аргумента в вызове */
    argumentIndex?: number;
    /** Строка вызова (1-based) */
    line: number;
  };
}

// ==========================================
// РАСШИРЕННАЯ ИНФОРМАЦИЯ О ФУНКЦИИ
// ==========================================
//
// ✅ ОБНОВЛЕНО: добавлены поля calls, calledBy, importedBy
// для совместимости с saveOptimizedPackageLockReport.
// ==========================================

export interface ExtendedFunctionInfo {
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
  importedBy: ImportedByInfo[];
  body?: string;
  returnType?: string;
  metadata?: Record<string, any>;
  _uniqueKey?: string;

  // ✅ ДОБАВЛЕНО: встроенные связи (используются в save-optimized.ts)
  /** Кого вызывает эта функция */
  calls?: CallInfo[];
  /** Кто вызывает эту функцию */
  calledBy?: CalledByInfo[];

  // ✅ v15.1.0 (P0): лексический родитель
  parentFunctionId?: string | null;
}

// ==========================================
// ✅ НОВОЕ v9.0.0: TEMPLATE-ПОЛЯ VUE
// ==========================================
//
// Эти типы используются в EntitiesResult.templateXxx
// и в EnhancedEntityInfo.templateXxx.
//
// ⚠️ СИНХРОНИЗАЦИЯ С vue-analyzer/types.ts:
//   - TemplateEventHandler       → EventHandlerUsage
//   - TemplateDynamicComponent   → DynamicComponentUsage
//   - TemplateRefUsage           → TemplateRefUsage (одноимённый)
//   - TemplateCssVariable        → CssVariableUsage
//   - TemplateDeepSelector       → DeepSelectorUsage
//   - TemplateConditional        → TemplateConditionalUsage + {id?, fileId?}
// ==========================================

// Импорт типов из vue-analyzer для type aliases
import type {
  EventHandlerUsage as VueEventHandlerUsage,
  DynamicComponentUsage as VueDynamicComponentUsage,
  TemplateRefUsage as VueTemplateRefUsage,
  CssVariableUsage as VueCssVariableUsage,
  DeepSelectorUsage as VueDeepSelectorUsage,
  TemplateConditional as VueTemplateConditional,
} from './modes/vue-analyzer/types.js';

/**
 * Обработчик события из шаблона Vue.
 *
 * ✅ СИНХРОНИЗИРОВАНО: type alias на EventHandlerUsage из vue-analyzer.
 */
export type TemplateEventHandler = VueEventHandlerUsage;

/**
 * Динамический компонент (<component :is="...">).
 *
 * ✅ СИНХРОНИЗИРОВАНО: type alias на DynamicComponentUsage из vue-analyzer.
 */
export type TemplateDynamicComponent = VueDynamicComponentUsage;

/**
 * Template ref (ref="dataTable").
 *
 * ✅ СИНХРОНИЗИРОВАНО: type alias на TemplateRefUsage из vue-analyzer.
 *
 * ⚠️ КРИТИЧНО: без этого поля Codec.encode получает undefined
 * на позиции 9 vt[] и JSON.stringify обрезает массив до 9 элементов.
 */
export type TemplateRefUsage = VueTemplateRefUsage;

/**
 * CSS-переменная из <style>.
 *
 * ✅ СИНХРОНИЗИРОВАНО: type alias на CssVariableUsage из vue-analyzer.
 */
export type TemplateCssVariable = VueCssVariableUsage;

/**
 * :deep() селектор из <style scoped>.
 *
 * ✅ СИНХРОНИЗИРОВАНО: type alias на DeepSelectorUsage из vue-analyzer.
 */
export type TemplateDeepSelector = VueDeepSelectorUsage;

/**
 * ✅ НОВОЕ v9.0.0: Условный рендеринг (v-if / v-else-if / v-else).
 *
 * ⚠️ СИНХРОНИЗИРОВАНО: расширяет TemplateConditionalUsage из vue-analyzer
 * полями id и fileId, которые заполняются в compact-reporter.ts.
 */
export interface TemplateConditional extends VueTemplateConditional {
  /** Уникальный ID (cd1, cd2, ...). Заполняется в compact-reporter.ts */
  id?: string;
  /** ID файла (f1, f2, ...). Заполняется в compact-reporter.ts */
  fileId?: string;
}

// ==========================================
// ✅ НОВОЕ v9.0.0: ТИПЫ ДЛЯ LIFECYCLE / EFFECTS / INJECTIONS / REACTIVITY
// ==========================================

/**
 * Хук жизненного цикла Vue (собранный из кода).
 */
export interface TemplateLifecycle {
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
  /** Имя функции, в которой вызван хук */
  functionName: string;
  /** Номер строки */
  line: number;
  /** Имя callback-функции (если есть) */
  callbackFunctionName?: string;
  /** Контекст: setup / options-api */
  isSetupContext: boolean;
}

/**
 * Side-effect (setTimeout, clearTimeout, addEventListener, ...).
 */
export interface TemplateEffect {
  /** Тип эффекта */
  effectType: 'timer' | 'cleanup' | 'promise' | 'event' | 'subscription';
  /** Имя функции, в которой вызван эффект */
  functionName: string;
  /** Номер строки */
  line: number;
  /** Имя вызываемой функции (setTimeout / clearTimeout / ...) */
  targetName: string;
  /** Дополнительное значение (например, '1000' для debounce) */
  metaValue?: string;
}

/**
 * Ребро provide/inject.
 */
export interface TemplateInjection {
  /** Тип: provide | inject */
  kind: 'provide' | 'inject';
  /** Путь к файлу */
  filePath: string;
  /** Номер строки */
  line: number;
  /** Нормализованное имя ключа */
  key: string;
  /** Используется ли Symbol (InjectionKey<T>) */
  isSymbolKey: boolean;
  /** Есть ли значение по умолчанию (для inject) */
  hasDefault: boolean;
}

/**
 * Реактивная связь: computed/watch/watchEffect/ref/reactive.
 */
export interface TemplateReactivity {
  /** Тип реактивности */
  kind: 'computed' | 'watch' | 'watchEffect' | 'ref' | 'reactive' | 'shallowRef' | 'readonly';
  /** Имя функции/composable, в которой объявлена реактивность */
  functionName: string;
  /** Номер строки */
  line: number;
  /** Имена реактивных полей, которые читаются */
  reads: string[];
  /** Имена реактивных полей, которые пишутся */
  writes: string[];
  /** Является ли computed writeable ({ get, set }) */
  isWriteable: boolean;
}

// ==========================================
// ✅ НОВОЕ v9.0.0: ТИПЫ ДЛЯ ТИП-ГРАФА
// ==========================================

/**
 * Узел тип-графа (interface / type-alias / enum / class).
 */
export interface TypeNode {
  /** Вид типа */
  kind: 'interface' | 'type-alias' | 'enum' | 'class';
  /** Имя типа */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки */
  line: number;
  /** Члены типа (для интерфейсов/классов) */
  members: string[];
  /** Расширяемые типы (extends) */
  extendsTypes: string[];
}

/**
 * Ребро использования типа.
 */
export interface TypeRef {
  /** Имя используемого типа */
  typeName: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки */
  line: number;
  /** Вид использования */
  usageKind: 'param' | 'return' | 'field' | 'generic' | 'union' | 'extends';
}

// ==========================================
// ОСНОВНОЙ ИНТЕРФЕЙС EntitiesResult
// ==========================================
//
// ✅ v15.1.0 (P0): FunctionInfo теперь содержит parentFunctionId.
// ✅ v15.2.0 (P1): добавлено поле lexicalLinks.
// ==========================================

export interface EntitiesResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  variables: VariableInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;

  // ==========================================
  // ✅ v15.2.0 (P1): лексические связи
  // ==========================================

  /**
   * Лексические связи: parent → child.
   *
   * Опционально для обратной совместимости.
   * Заполняется в `extractEntitiesFromAST`.
   */
  lexicalLinks?: LexicalLink[];

  // ==========================================
  // ✅ НОВОЕ v4.1.0: template-поля Vue
  // Хранят ТОЛЬКО ссылки (имена/примитивы),
  // без дубликатов объектов.
  // ==========================================

  /** root-идентификаторы шаблона (user, items, isLoading) */
  templateReactivityDeps?: string[];

  /** Обработчики событий @click → handlerName */
  templateEventHandlers?: TemplateEventHandler[];

  /** <component :is="..."> и v-bind:is */
  templateDynamicComponents?: TemplateDynamicComponent[];

  /**
   * ✅ ИСПРАВЛЕНО: template refs (ref="dataTable" → exposedMethods).
   */
  templateRefs?: TemplateRefUsage[];

  /** CSS-переменные из <style> */
  templateCssVariables?: TemplateCssVariable[];

  /** :deep() селекторы */
  templateDeepSelectors?: TemplateDeepSelector[];

  /** Директивы (v-html, v-text, v-pre, v-once, v-memo, v-model, ...) */
  templateDirectives?: string[];

  /** Использованные компоненты (PascalCase + kebab-case) */
  templateUsedComponents?: string[];

  /** Слоты (из <slot name="..."> и defineSlots<T>()) */
  templateSlots?: string[];

  /** Сложность шаблона */
  templateComplexity?: number;

  // ==========================================
  // ✅ НОВОЕ v9.0.0: условный рендеринг
  // ==========================================

  /** Условный рендеринг (v-if / v-else-if / v-else) */
  templateConditionals?: TemplateConditional[];

  // ==========================================
  // ✅ НОВОЕ v9.0.0: lifecycle / effects / injections / reactivity
  // ==========================================

  /** Хуки жизненного цикла (onMounted, onUnmounted, ...) */
  templateLifecycle?: TemplateLifecycle[];

  /** Side-effects (setTimeout, clearTimeout, AbortController, ...) */
  templateEffects?: TemplateEffect[];

  /** Ребра provide / inject */
  templateInjections?: TemplateInjection[];

  /** Реактивные связи (computed, watch, ref, reactive, ...) */
  templateReactivity?: TemplateReactivity[];

  // ==========================================
  // ✅ НОВОЕ v9.0.0: тип-граф
  // ==========================================

  /** Узлы тип-графа (interface / type-alias / enum / class) */
  typesGraph?: TypeNode[];

  /** Ребра использования типов */
  typeRefsGraph?: TypeRef[];
}

// ==========================================
// ВОССТАНОВЛЕННЫЕ ТИПЫ
// ==========================================

export interface MethodInfo {
  name: string;
  kind: 'method' | 'get' | 'set' | 'constructor';
  static: boolean;
  loc: Location | null;
}

export interface CallGraphNode {
  name: string;
  file: string;
  line: number;
  column: number;
  calls: CallGraphNode[];
  callers: CallGraphNode[];
  isEntry: boolean;
  isAsync: boolean;
  isExported: boolean;
}

export interface CallEdge {
  from: string;
  to: string;
  type?: string;
  line?: number;
}

export interface CallGraph {
  nodes: Map<string, CallGraphNode>;
  edges: CallEdge[];
  entryPoints: CallGraphNode[];
  cycles: CallEdge[][];
  findUnusedFunctions(): CallGraphNode[];
  findCyclicDependencies(): CallEdge[][];
}

export interface Config {
  ignoreNodeModules: boolean;
  supportedExtensions: string[];
  defaultExcludePatterns: string[];
  vueScriptPattern: RegExp;
}

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

// ==========================================
// ТИПЫ ДЛЯ КЛАССОВ
// ==========================================

export interface ClassMethodInfo {
  name: string;
  kind: 'method' | 'get' | 'set' | 'constructor';
  static: boolean;
  loc: Location | null;
}

export interface ClassInfoLegacy {
  name: string;
  exported: boolean;
  loc: Location | null;
  methods: ClassMethodInfo[];
  startLine: number;
  endLine: number;
}

// ==========================================
// ТИПЫ ДЛЯ КОНСТАНТ И ПЕРЕМЕННЫХ
// ==========================================

export interface ConstantInfoLegacy {
  name: string;
  type: 'constant';
  loc: Location | null;
  startLine: number;
  endLine: number;
}

export interface InterfaceInfoLegacy {
  name: string;
  exported: boolean;
  loc: Location | null;
  members: number;
  startLine: number;
  endLine: number;
}

export interface TypeInfoLegacy {
  name: string;
  exported: boolean;
  loc: Location | null;
}

// ==========================================
// СТАТИСТИКА АНАЛИЗА
// ==========================================

export interface AnalysisStats {
  totalLines: number;
  totalExports: number;
  totalFunctions: number;
  totalClasses: number;
  totalConstants: number;
  totalInterfaces: number;
  totalTypes: number;
  totalImports: number;
}

export interface AnalysisResult {
  filePath: string;
  fileName: string;
  stats: AnalysisStats;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  callGraph: Record<string, string[]>;
  fullCode: string;
  lines: string[];
}

// ==========================================
// ТИПЫ ДЛЯ СУЩНОСТЕЙ (устаревшие)
// ==========================================

export interface EntitiesResultLegacy {
  functions: FunctionInfo[];
  classes: ClassInfoLegacy[];
  constants: ConstantInfoLegacy[];
  interfaces: InterfaceInfoLegacy[];
  types: TypeInfoLegacy[];
  variables: VariableInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

// ==========================================
// ТИПЫ ДЛЯ ГРАФОВ
// ==========================================

export interface FileInternalGraph {
  rootKey: string;
  graph: Record<string, string[]>;
}

// ==========================================
// ТИПЫ ДЛЯ ГРАФОВ МОДУЛЕЙ И СУЩНОСТЕЙ
// ==========================================

export interface ModuleGraphNode {
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

export interface ModuleGraphEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  specifiers: string[];
  sourceCode?: string;
}

export interface ModuleGraph {
  nodes: ModuleGraphNode[];
  edges: ModuleGraphEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

export interface EntityGraphNode {
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

export interface EntityGraphEdge {
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
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
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

// ==========================================
// ПОЛНЫЙ АНАЛИЗ
// ==========================================

export interface FullAnalysis {
  version: string;
  root: string;
  timestamp: string;
  stats: {
    totalModules: number;
    totalEntities: number;
    hasCycles: boolean;
    cycles: string[][];
    totalFunctions: number;
    totalClasses: number;
    totalConstants: number;
    totalInterfaces: number;
    totalTypes: number;
    totalVariables: number;
    maxDepth: number;
  };
  moduleGraph: ModuleGraph;
  entityGraph: EntityGraph;
}

// ==========================================
// ТИПЫ ДЛЯ АРХИТЕКТУРНЫХ МЕТРИК
// ==========================================

export interface ArchitectureMetrics {
  totalModules: number;
  totalFunctions: number;
  totalClasses: number;
  totalConstants: number;
  totalInterfaces: number;
  totalTypes: number;
  totalVariables: number;
  totalCalls: number;
  vueComponents: number;
  totalComposables: number;
  hasCycles: boolean;
  maxDepth: number;
  modulesByLevel: Record<number, string[]>;
  isAcyclic: boolean;
  averageComplexity?: number;
  maxComplexity?: number;
  totalSecurityIssues?: number;
  securityIssuesByType?: {
    hasEval: number;
    hasProcessEnv: number;
    hasSensitiveData: number;
    hasExec: number;
  };
}

// ==========================================
// ТИПЫ ДЛЯ РЕЗЮМЕ ПРОЕКТА
// ==========================================

export interface ProjectSummary {
  projectType: 'monorepo' | 'single' | 'unknown';
  entryPoint: string;
  totalModules: number;
  totalFunctions: number;
  vueComponents: number;
  hasCycles: boolean;
  maxDepth: number;
  architectureHealth: string;
  quickSummary?: string;
  technologies?: string[];
}

// ==========================================
// ТИПЫ ДЛЯ VUE АНАЛИЗА
// ==========================================

export interface VueAnalysis {
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
  slots: string[];
  composables: string[];
  templateComplexity: number;
  scriptType: 'setup' | 'options';
  isTS: boolean;
  stats: {
    scriptLines: number;
    templateLines: number;
    styleCount: number;
  };
}

// ==========================================
// ТИПЫ ДЛЯ КЛАСТЕРОВ
// ==========================================

export interface Cluster {
  name: string;
  functions: string[];
  isExported: boolean;
  dependencies: string[];
  importers: string[];
  cohesionScore: number;
  type: 'core' | 'helper';
  size: number;
  recommendation: string;
}

export interface ClusterOptions {
  targetClusterSize?: number;
  maxClusterSize?: number;
}

// ==========================================
// ТИПЫ ДЛЯ РАЗЛИЧНЫХ РЕЖИМОВ
// ==========================================

export interface SplitModuleOptions {
  outputFile?: string;
  includeFullCode?: boolean;
  includeMinified?: boolean;
  includeGraph?: boolean;
  includeStats?: boolean;
  includeSuggestions?: boolean;
  targetClusterSize?: number;
  maxClusterSize?: number;
  maxDepth?: number;
  excludePatterns?: string[];
  prefix?: string;
}

export interface SplitModuleResult {
  markdown: string;
  analysis: AnalysisResult;
  outputFiles: {
    prompt: string;
    context: string;
    graph: string;
    analysis: string;
  };
}

export interface MinifyFolderOptions {
  outputFile?: string;
  extensions?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  showStructure?: boolean;
  addTableOfContents?: boolean;
  sortByType?: boolean;
}

export interface MinifyFolderResult {
  markdown: string;
  filesProcessed: number;
  totalOriginalSize: number;
  totalMinifiedSize: number;
}

export interface PromptPackOptions {
  maxDepth?: number;
  includeTargetFile?: boolean;
  includeDependencies?: boolean;
}

export interface ImpactUsage {
  file: string;
  usages: string[];
}

export interface ImpactReport {
  targetFile: string;
  entityName: string;
  impacts: ImpactUsage[];
  isSafe: boolean;
}

export interface ImpactOptions {
  targetFile: string;
  entityName: string;
}

export interface DeadCodeReport {
  targetFile: string;
  deadLocals: string[];
  deadExports: string[];
  hasDeadCode: boolean;
}

export interface DeadCodeOptions {
  targetFile: string;
}

export interface ProjectGraphOptions {
  maxDepth?: number;
  entryPoint: string;
}

export interface FileGraphOptions {
  maxDepth?: number;
}

// ==========================================
// ТИПЫ ДЛЯ HTML ОТЧЕТОВ
// ==========================================

export interface HTMLReportOptions {
  svgContent: string;
  dotContent: string;
  jsonContent: string;
  title: string;
  hasCycles: boolean;
}

// ==========================================
// ТИПЫ ДЛЯ CLI
// ==========================================

export type CLIMode =
  | 'project'
  | 'file'
  | 'minify'
  | 'minify-folder'
  | 'prompt-pack'
  | 'split-module'
  | 'split'
  | 'impact'
  | 'dead-code'
  | 'hybrid-report'
  | 'hybrid'
  | 'semantic'
  | 'verify'
  | 'refactor'
  | 'analyze'
  | 'vue-analyze'
  | 'vue'
  | 'compact';

export interface ProjectCLIArgs {
  mode: 'project';
  targetPath: string;
  extraArg?: string;
  includeEntities?: boolean;
  includeBody?: boolean;
  includeVueAnalysis?: boolean;
  fromFunction?: string;
  toFunction?: string;
  optimized?: boolean;
}

export interface FileCLIArgs {
  mode: 'file';
  targetPath: string;
  includeEntities?: boolean;
}

export interface MinifyCLIArgs {
  mode: 'minify';
  targetPath: string;
}

export interface MinifyFolderCLIArgs {
  mode: 'minify-folder';
  targetPath: string;
  options?: MinifyFolderOptions;
}

export interface PromptPackCLIArgs {
  mode: 'prompt-pack';
  targetPath: string;
  extraArg?: string;
}

export interface SplitModuleCLIArgs {
  mode: 'split-module' | 'split';
  targetPath: string;
  options?: SplitModuleOptions;
}

export interface ImpactCLIArgs {
  mode: 'impact';
  targetPath: string;
  extraArg: string;
}

export interface DeadCodeCLIArgs {
  mode: 'dead-code';
  targetPath: string;
}

export interface HybridReportCLIArgs {
  mode: 'hybrid-report' | 'hybrid';
  targetPath: string;
  extraArg?: string;
}

export interface SemanticCLIArgs {
  mode: 'semantic';
  targetPath: string;
  extraArg?: string;
  options?: {
    recursive?: boolean;
    formalVerification?: boolean;
    maxDepth?: number;
    criticalFunctions?: string[];
    outputDir?: string;
  };
}

export interface VerifyCLIArgs {
  mode: 'verify';
  targetPath: string;
  options?: {
    functionName?: string;
    contractPath?: string;
  };
}

export interface RefactorCLIArgs {
  mode: 'refactor';
  targetPath: string;
  options?: {
    modulesDir?: string;
    targetClusterSize?: number;
    maxClusterSize?: number;
    minCohesionScore?: number;
    dryRun?: boolean;
    createBackup?: boolean;
    updateTemplate?: boolean;
    verbose?: boolean;
    semanticAnalysis?: boolean;
  };
}

export interface AnalyzeCLIArgs {
  mode: 'analyze';
  targetPath: string;
  options?: {
    targetClusterSize?: number;
    maxClusterSize?: number;
    minCohesionScore?: number;
    dryRun?: boolean;
  };
}

export interface VueAnalyzeCLIArgs {
  mode: 'vue-analyze' | 'vue';
  targetPath: string;
  options?: {
    includeTemplateAST?: boolean;
    includeScriptAST?: boolean;
    extractComposableCalls?: boolean;
  };
}

export interface CompactCLIArgs {
  mode: 'compact';
  targetPath: string;
  outputPath?: string;
  options?: {
    ultraCompact?: boolean;
    useBitFlags?: boolean;
    useDictionaries?: boolean;
    readableKeys?: boolean;
    useTemplates?: boolean;
    maxDepth?: number;
  };
}

export type CLIArgs =
  | ProjectCLIArgs
  | FileCLIArgs
  | MinifyCLIArgs
  | MinifyFolderCLIArgs
  | PromptPackCLIArgs
  | SplitModuleCLIArgs
  | ImpactCLIArgs
  | DeadCodeCLIArgs
  | HybridReportCLIArgs
  | SemanticCLIArgs
  | VerifyCLIArgs
  | RefactorCLIArgs
  | AnalyzeCLIArgs
  | VueAnalyzeCLIArgs
  | CompactCLIArgs
  | null;

// ==========================================
// ТИПЫ ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ
// ==========================================

export interface CodeCut {
  start: number;
  end: number;
  replaceWith: string;
}

export interface DirectoryTree {
  [key: string]: DirectoryTree | null;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  ext: string;
  size: number;
}

// ==========================================
// ТИПЫ ДЛЯ ОШИБОК И ЛОГГИРОВАНИЯ
// ==========================================

export interface ParseError {
  filePath: string;
  message: string;
  stack?: string;
}

export interface AnalysisWarning {
  type: 'parse' | 'resolve' | 'readdir' | 'vue-script';
  filePath: string;
  message: string;
}

// ==========================================
// ТИПЫ ДЛЯ AST ВАЛКЕРА (ОБЪЕДИНЕННАЯ ВЕРСИЯ)
// ==========================================

/**
 * Базовый тип для AST-узлов с type guard.
 * Объединяет оригинальный интерфейс и улучшенные типы.
 */
export interface ASTNode {
  type: string;
  loc?: Location | null;
  range?: [number, number];
  [key: string]: any;
}

export interface WalkerOptions {
  enter?: (node: ASTNode, parent?: ASTNode) => void;
  leave?: (node: ASTNode, parent?: ASTNode) => void;
}

// ==========================================
// ТИПЫ ДЛЯ ОТЧЕТОВ
// ==========================================

export interface MarkdownSection {
  title: string;
  level: number;
  content: string;
}

export interface TableRow {
  [key: string]: string | number;
}

export interface TableOptions {
  headers: string[];
  rows: TableRow[];
  alignment?: ('left' | 'center' | 'right')[];
}

// ==========================================
// ТИПЫ ДЛЯ ВАЛИДАЦИИ
// ==========================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileValidationOptions {
  checkExists?: boolean;
  checkExtension?: boolean;
  checkSize?: boolean;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
}

// ==========================================
// ТИПЫ ДЛЯ ОПТИМИЗИРОВАННОГО ОТЧЕТА
// ==========================================

export interface OptimizedReportOptions {
  includeBody?: boolean;
  compression?: 'full' | 'minimal' | 'relationships-only';
  includeVscodeLinks?: boolean;
  includeStats?: boolean;
  includeMetadata?: boolean;
}

// ==========================================
// ТИПЫ ДЛЯ ENHANCED PACKAGE LOCK REPORT
// ==========================================

export interface EnhancedPackageInfo {
  version: string;
  resolved: string;
  displayPath?: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, any>;
  exports: Record<string, any>;
  entities: {
    functions: FunctionInfo[];
    constants: ConstantInfo[];
    variables: VariableInfo[];
    interfaces: InterfaceInfo[];
    types: TypeInfo[];
    classes: ClassInfo[];
  };
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
  vueAnalysis?: VueAnalysis;
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

// ==========================================
// РАСШИРЕННАЯ ИНФОРМАЦИЯ О СУЩНОСТЯХ
// ==========================================

export interface EnhancedFunctionInfo extends FunctionInfo {
  paramTypes: string[];
  isMethod: boolean;
  className: string;
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
  _uniqueKey?: string;

  // ==========================================
  // ✅ НОВОЕ (P0/P1): проброс лексических полей
  // ==========================================
  //
  // Эти поля уже есть в FunctionInfo, но EnhancedEntityInfo —
  // это отдельный тип, который собирается в convertFunctions.
  // Без явного объявления здесь TypeScript выдаст ошибку
  // при `parentFunctionId: func.parentFunctionId ?? null`.
  //
  // ⚠️ Фактически это дубликаты полей FunctionInfo, но нужны
  // для type-safety в EnhancedEntityInfo.
  // ==========================================

  /** ✅ P0: ID лексического родителя (null для top-level) */
  parentFunctionId?: string | null;

  /** ✅ P1: информация о вызове, в который передан колбэк */
  boundTo?: {
    calleeName: string;
    argumentIndex?: number;
    line: number;
  };
}

export interface EnhancedConstantInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
}

export interface EnhancedVariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
}

export interface EnhancedInterfaceInfo {
  name: string;
  properties: string[];
  line: number;
  startLine: number;
  endLine: number;
  isExported: boolean;
  extends: string[];
  _safeInfo: any;
}

export interface EnhancedTypeInfo {
  name: string;
  definition: string;
  line: number;
  isExported: boolean;
  _safeInfo: any;
}

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
}

// ==========================================
// ТИПЫ ДЛЯ ENHANCED PACKAGE LOCK REPORT
// ==========================================

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
  /**
   * ✅ ИСПРАВЛЕНО: callGraph может быть как простым словарём
   * (Record<string, string[]>), так и структурированным объектом
   * с полями from/to/path/found/nodes/edges.
   */
  callGraph?:
    | Record<string, string[]>
    | {
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
    totalFunctions: number;
    totalConstants: number;
    totalVariables: number;
    totalInterfaces: number;
    totalTypes: number;
    totalClasses: number;
    totalCalls: number;
    totalExportedFunctions: number;
    totalAsyncFunctions: number;
    /** ✅ ДОБАВЛЕНО: количество импортов */
    totalImports?: number;
  };
  fileStats: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  architectureMetrics?: ArchitectureMetrics;
  summary?: ProjectSummary;
  timestamp: string;
}

// ==========================================
// ТИП ДЛЯ ENHANCED ENTITY INFO
// ==========================================
//
// ✅ ОБНОВЛЕНО: добавлены поля imports и exports.
// ✅ v15.2.0 (P1): добавлены template-поля + lexicalLinks.
// ==========================================

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];

  /**
   * ✅ ИСПРАВЛЕНО: используем ImportInfo[] вместо устаревшего
   * `{ source: string; specifiers: string[]; isTypeOnly: boolean }[]`.
   */
  imports?: ImportInfo[];

  /**
   * ✅ ДОБАВЛЕНО: экспорты.
   */
  exports?: ExportInfo[];

  // ==========================================
  // ✅ НОВОЕ v4.1.0: template-поля Vue.
  // ==========================================

  /** root-идентификаторы шаблона (user, items, isLoading) */
  templateReactivityDeps?: string[];

  /** Обработчики событий @click → handlerName */
  templateEventHandlers?: TemplateEventHandler[];

  /** <component :is="..."> и v-bind:is */
  templateDynamicComponents?: TemplateDynamicComponent[];

  /** template refs (ref="dataTable" → exposedMethods) */
  templateRefs?: TemplateRefUsage[];

  /** CSS-переменные из <style> */
  templateCssVariables?: TemplateCssVariable[];

  /** :deep() селекторы */
  templateDeepSelectors?: TemplateDeepSelector[];

  /** Директивы (v-html, v-text, v-pre, v-once, v-memo, v-model, ...) */
  templateDirectives?: string[];

  /** Использованные компоненты (PascalCase + kebab-case) */
  templateUsedComponents?: string[];

  /** Слоты (из <slot name="..."> и defineSlots<T>()) */
  templateSlots?: string[];

  /** Сложность шаблона */
  templateComplexity?: number;

  // ==========================================
  // ✅ НОВОЕ v9.0.0: условный рендеринг
  // ==========================================

  /** Условный рендеринг (v-if / v-else-if / v-else) */
  templateConditionals?: TemplateConditional[];

  // ==========================================
  // ✅ НОВОЕ v9.0.0: lifecycle / effects / injections / reactivity
  // ==========================================

  /** Хуки жизненного цикла (onMounted, onUnmounted, ...) */
  templateLifecycle?: TemplateLifecycle[];

  /** Side-effects (setTimeout, clearTimeout, AbortController, ...) */
  templateEffects?: TemplateEffect[];

  /** Ребра provide / inject */
  templateInjections?: TemplateInjection[];

  /** Реактивные связи (computed, watch, ref, reactive, ...) */
  templateReactivity?: TemplateReactivity[];

  // ==========================================
  // ✅ НОВОЕ v9.0.0: тип-граф
  // ==========================================

  /** Узлы тип-графа (interface / type-alias / enum / class) */
  typesGraph?: TypeNode[];

  /** Ребра использования типов */
  typeRefsGraph?: TypeRef[];

  // ==========================================
  // ✅ НОВОЕ v15.2.0 (P1): лексические связи
  // ==========================================
  //
  // Без этого поля:
  //   - compact.lx = { p: [], c: [], r: [], l: [], ai: [], cn: [] }
  //   - fns.parent RLE = [[-1, N]]
  //   - decode(compact).lexicalLinks = undefined
  //   - фронт не может построить дерево вложенности
  //
  // Источник: EntitiesResult.lexicalLinks
  // (заполняется в extractEntitiesFromAST).
  // ==========================================

  /** ✅ P1: лексические связи (parent → child) */
  lexicalLinks?: LexicalLink[];
}

// ==========================================
// 🆕 НОВЫЕ ТИПЫ ДЛЯ КОМПАКТНОГО ФОРМАТА (v4.0.0)
// ==========================================

export interface CompactReport {
  version: string;
  timestamp: string;
  root: string;
  legend: Record<string, string>;
  moduleIndex: Record<string, string>;
  fileIndex: Record<string, { path: string; module: string }>;
  functionIndex: Record<string, { name: string; module: string; file: string }>;
  modules: Record<string, CompactModule>;
  reverseIndex: {
    importedBy: Record<string, { from: string; line: number }[]>;
  };
  unresolved: {
    module: string;
    target: string;
    line: number;
  }[];
  stats: {
    totalModules: number;
    totalFiles: number;
    totalFunctions: number;
    totalCalls: number;
    totalImports: number;
    totalExports: number;
    totalUnresolved: number;
  };
}

export interface CompactModule {
  name: string;
  path: string;
  file: string;
  imports: {
    from: string;
    specifiers: string[];
    line: number;
    type?: 'named' | 'default' | 'namespace' | 'type';
  }[];
  exports: {
    function: string;
    name: string;
  }[];
  functions: Record<string, CompactFunction>;
  stats: {
    functions: number;
    imports: number;
    exports: number;
    dependencies: number;
  };
}

export interface CompactFunction {
  name: string;
  line: number;
  flags: number;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  calls: {
    to: string;
    line: number;
    type: 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event';
  }[];
}

export interface CompactCall {
  to: string;
  line: number;
  type: 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event';
}

// ==========================================
// 🆕 НОВЫЕ ТИПЫ ДЛЯ UI ТРЁХКОЛОНОЧНОГО ИНТЕРФЕЙСА (с короткими ключами)
// ==========================================

/**
 * Импорт/экспорт связи: [fromFile, name, line]
 */
export type UIImportTuple = [string | null, string, number];

/**
 * Вызов функции: [callerFn, calleeFn, line, type]
 */
export type UICallTuple = [string, string, number, string];

/**
 * Данные для одного файла в UI.
 */
export interface UIFileData {
  /** importedBy — кто импортирует этот файл (левая панель) */
  ib: UIImportTuple[];
  /** imports — что импортирует этот файл (правая панель) */
  im: UIImportTuple[];
  /** calls — вызовы функций из этого файла (правая панель) */
  ca: UICallTuple[];
  /** exports — экспорты файла (центр) */
  ex: string[];
  /** functions — функции в файле (центр) */
  fn: string[];
}

/**
 * UI индекс для быстрой навигации по трём колонкам.
 */
export interface UIIndex {
  /** activeFileId — текущий активный файл */
  a: string;
  /** files — данные по каждому файлу */
  f: Record<string, UIFileData>;
}

// ==========================================
// УЛУЧШЕННЫЕ ТИПЫ ДЛЯ СТАТИСТИКИ
// ==========================================

export interface MutableStats {
  totalFunctions: number;
  totalCalls: number;
  totalModules: number;
  totalFiles: number;
  totalExports: number;
  totalReExports: number;
  totalConstExports: number;
  totalUnused: number;
  totalAsync: number;
  totalConstants: number;
  totalConstUses: number;
  totalConstDeps: number;
  totalInheritance: number;
  totalTypeDeps: number;
  totalImports: number;
  totalSelfFunctions: number;
  totalDynamicImports: number;
  totalConfigRefs: number;
  totalExternalLibs: number;
  totalVueTemplates: number;
  totalAsyncChains: number;
  totalClosures: number;
  totalReflections: number;
}

export type ReadonlyStats = Readonly<MutableStats>;

// ==========================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ==========================================

export default {
  // Типы экспортируются автоматически
};
