// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (v15.4.3)
// ============================================
// Версия: 15.4.3
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.4.3 (fix: единый источник истины для classifyValue):
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '15.4.3'
//   - ✅ СИНХРОНИЗИРОВАНО с codec-encode.ts v15.4.3,
//     values-filter.ts v1.0.1.
//   - 📌 Причина: classifyValue дублировалась в codec-encode.ts
//     (использовала JSON.stringify) и в values-filter.ts
//     (использовала stableStringify). Это ломало детерминизм
//     valuesMeta[].kind, из-за чего:
//       • compact.values.length = 557
//       • encode(full).values.length = 558
//       • cn.nonEmptyV сдвигался на +1 → L0/L3/RE падали.
//     Фикс: classifyValue теперь ТОЛЬКО в values-filter.ts,
//     codec-encode.ts импортирует её.
//
// v15.4.0 (P3 — cross-file resolution):
//   - ✅ ДОБАВЛЕНО: реэкспорт CrossFileCall, ResolveStats, ResolvedCallee
//     из '../../core/cross-file-resolver/types.js'
//   - ✅ CODEC_VERSION = '15.4.0'
//
// v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: CallData.column / callKind / calleeName / argumentIndex
//   - ✅ ДОБАВЛЕНО: CompactJSON.gr.c.col / ck / cn / ai
//   - ✅ ОБНОВЛЕНО: CodecLegend.codes.callKind
//
// v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: LexicalLink, LexicalRelation
//   - ✅ ДОБАВЛЕНО: FullJSON.lexicalLinks
//   - ✅ ДОБАВЛЕНО: CompactJSON.lx (columnar-секция)
//   - ✅ ОБНОВЛЕНО: EdgeData.type += 'lexical'
//   - ✅ ОБНОВЛЕНО: StatisticsData.totalLexicalLinks
//   - ✅ ОБНОВЛЕНО: CodecLegend.schemas.lx
//   - ✅ ОБНОВЛЕНО: CodecLegend.codes.lexicalRelation
//   - ✅ ОБНОВЛЕНО: RoundTripResult.details.lexicalLinksDiff
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: FunctionData.parentFunctionId
//   - ✅ ДОБАВЛЕНО: CompactJSON.fns.parent (RLE)
//   - ✅ ОБНОВЛЕНО: CodecLegend.schemas.fns += 'parent'
//
// v15.0.6 (gr.i.tf — индекс в fl.p):
//   - ✅ ИЗМЕНЕНО: gr.i.tf читается как индекс в fl.p
//
// v15.0.5 (gr.i.tf — индекс в fl.p):
//   - ✅ ИЗМЕНЕНО: gr.i.tf — индекс в fl.p
//
// v15.0.4 (проброс реэкспортов через imports):
//   - ✅ ДОБАВЛЕНО: ImportData.isReExport / isStarReExport
//
// v15.0.2 (устранение дублирования conditionals):
//   - ✅ УДАЛЕНО: FullJSON.conditionals (верхний уровень)
//
// v15.0.1 (fix imports[].type):
//   - ✅ ИСПРАВЛЕНО: ImportData.type ∈ {named, default, namespace}
//
// v15.0.0 (100% round-trip расширенных секций):
//   - ✅ ДОБАВЛЕНО: секции vt/lc/ef/inj/rx/cd/ty/tr
// ============================================

// ============================================================
// ✅ v15.4.3: ЕДИНАЯ ВЕРСИЯ CODEC
// ============================================================
// Используется в:
//   - compact-reporter.ts (version в full.json)
//   - codec-encode.ts     (v в compact.json)
//   - codec-decode.ts     (version в full.json при decode)
//   - codec-legend.ts     (заголовок)
//   - verify-roundtrip.ts (codecVersion в jsonReport)
//   - verify-consistency.ts (заголовок)
//
// Единый источник истины — устраняет расхождение версий между
// full.json и compact.json.
// ============================================================

export const CODEC_VERSION = '15.4.3';

// ============================================================
// РЕЭКСПОРТ TEMPLATE-ТИПОВ ИЗ src/types.ts
// ============================================================

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

// Импортируем их локально, чтобы использовать в интерфейсах ниже
import type {
  TemplateEventHandler,
  TemplateDynamicComponent,
  TemplateRefUsage,
  TemplateCssVariable,
  TemplateDeepSelector,
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
 * СИНХРОНИЗАЦИЯ С inferFunctionName
 * ════════════════════════════════════════════════════════════
 *
 *   `LexicalRelation` синхронизирован с логикой `inferFunctionName.ts`
 *   (helpers/infer-function-name.ts v2.1.0).
 *
 *   Любое расширение этого enum должно быть отражено в:
 *     - `LEXICAL_RELATION_CODES` (codec-encode.ts)
 *     - `LEXICAL_RELATION_BY_CODE` (codec-decode.ts)
 *     - `legend.codes.lexicalRelation` (codec-legend.ts)
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
 *   Отличие от `CallData`:
 *     - `CallData` — динамическая связь (кто кого вызывает).
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
 *       argumentIndex: 0,          // arr.map(callback) — 0-й аргумент
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

// ============================================================
// ✅ v15.4.3 (P3): CROSS-FILE TYPES (реэкспорт)
// ============================================================
// Реэкспортируем типы из cross-file-resolver, чтобы потребители
// codec-types.ts могли использовать их без дополнительных импортов.
// ============================================================

export type {
  CrossFileCall,
  CrossFileResolverOptions,
  ResolveStats,
  ResolvedCallee,
} from '../../core/cross-file-resolver/types.js';

// ============================================================
// ПОЛНЫЙ (ЧИТАЕМЫЙ) JSON
// ============================================================

/**
 * Полный (читаемый) JSON отчёта.
 *
 * ⚠️ v15.0.2: поле `conditionals` УДАЛЕНО с верхнего уровня.
 *    Единственное место хранения — `templates[i].conditionals`.
 *
 * ✅ v15.2.0 (P1): добавлено поле `lexicalLinks`.
 */
export interface FullJSON {
  /** Версия формата отчёта */
  version: string;

  /** Временная метка генерации (ISO 8601) */
  timestamp: string;

  /** ID корневого модуля */
  root: string;

  /** Список модулей (директорий) */
  modules: ModuleData[];

  /** Список файлов */
  files: FileData[];

  /** Список функций */
  functions: FunctionData[];

  /** Список классов */
  classes: ClassData[];

  /** Список констант */
  constants: ConstantData[];

  /** Список экспортов */
  exports: ExportData[];

  /** Список импортов */
  imports: ImportData[];

  /** Список вызовов */
  calls: CallData[];

  /** Список реэкспортов */
  reExports: ReExportData[];

  /**
   * Vue-шаблоны — отдельные сущности.
   *
   * ⚠️ v15.0.2: `conditionals` живут ВНУТРИ каждого TemplateData.
   */
  templates?: TemplateData[];

  /**
   * ✅ v15.2.0 (P1): лексические связи (parent → child).
   *
   * Опционально для обратной совместимости: старые full.json
   * без этого поля читаются как «нет лексических связей».
   */
  lexicalLinks?: LexicalLink[];

  /** Статистика */
  statistics: StatisticsData;

  /** Единый массив рёбер для сводного графа */
  edges?: EdgeData[];

  // ==========================================
  // РАСШИРЕННЫЕ СЕКЦИИ (v9.0.0+)
  // ==========================================

  /** Хуки жизненного цикла (onMounted, onUnmounted, ...) */
  lifecycle?: LifecycleHook[];

  /** Side-effects (timer, cleanup, promise, event, subscription) */
  effects?: EffectEdge[];

  /** Provide/Inject рёбра */
  injections?: InjectionEdge[];

  /** Реактивные связи (computed/watch/ref/...) */
  reactivity?: ReactivityEdge[];

  /** Узлы тип-графа (interface / type-alias / enum / class) */
  types?: TypeNodeData[];

  /** Рёбра использования типов (param / return / field / ...) */
  typeRefs?: TypeRefData[];

  // ==========================================
  // ✅ v12.0.0: values mode
  // ==========================================

  /**
   * Режим сериализации values, использованный при генерации.
   *
   * - `'full'`      — все значения сохранены
   * - `'relations'` — только значения, нужные для восстановления связей
   */
  valuesMode?: 'full' | 'relations';
}

// ============================================
// МОДУЛЬ
// ============================================

export interface ModuleData {
  /** Уникальный ID модуля (m1, m2, ...) */
  id: string;

  /** Имя модуля (например, 'core') */
  name: string;

  /** Путь к модулю (например, 'src/core') */
  path: string;

  /** ID файлов, входящих в этот модуль */
  fileIds: string[];
}

// ============================================
// ФАЙЛ
// ============================================

export interface FileData {
  /** Уникальный ID файла (f1, f2, ...) */
  id: string;

  /** Относительный путь к файлу */
  path: string;

  /** ID модуля, которому принадлежит файл */
  moduleId: string;
}

// ============================================
// ФУНКЦИЯ
// ============================================
//
// ✅ v15.1.0 (P0): добавлено поле `parentFunctionId`.
// ============================================

export interface FunctionData {
  /** Уникальный ID (fn1, fn2, ...) */
  id: string;

  /** Имя функции */
  name: string;

  /** ID модуля */
  moduleId: string;

  /** ID файла */
  fileId: string;

  /** Строка объявления (1-based) */
  line: number;

  /** Экспортируется ли функция */
  isExported: boolean;

  /** Асинхронная ли функция */
  isAsync: boolean;

  /** Стрелочная ли функция */
  isArrow: boolean;

  /** Метод класса */
  isMethod: boolean;

  /** Параметры */
  params: string[];

  /** Тип возвращаемого значения */
  returnType?: string;

  /** Обработчик события */
  isEventHandler?: boolean;

  /** Вложенная функция */
  isNested?: boolean;

  /** Изолированная функция (никого не вызывает и не вызывается) */
  isSelf?: boolean;

  /** Динамическая функция */
  isDynamic?: boolean;

  /** Конфигурационная функция */
  isConfig?: boolean;

  /** Внешняя функция */
  isExternal?: boolean;

  /** Vue-template функция */
  isVueTemplate?: boolean;

  /** В асинхронной цепочке */
  isAsyncChain?: boolean;

  /** Замыкание */
  isClosure?: boolean;

  /** Зависимость по типу */
  isTypeDep?: boolean;

  /** Генератор */
  isGenerator?: boolean;

  /** Приватный член */
  isPrivate?: boolean;

  /** Protected член */
  isProtected?: boolean;

  /** Статический член */
  isStatic?: boolean;

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
   *   - `undefined` — старый full.json без этого поля
   *
   * ════════════════════════════════════════════════════════════
   * ПОЧЕМУ ЭТО ВАЖНО
   * ════════════════════════════════════════════════════════════
   *
   *   Без parentFunctionId в дереве вызовов появляются «висячие»
   *   корни: `_idle_callback`, `map_callback`, `String.replace_callback`.
   *
   *   С parentFunctionId каждый колбэк становится ребёнком своей
   *   enclosing-функции.
   */
  parentFunctionId?: string | null;
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
//
// ✅ v15.0.1: `type` — только {named, default, namespace}.
// ✅ v15.0.4: добавлены флаги реэкспорта.
// ============================================

export interface ImportData {
  id: string;
  fromFileId: string;

  /**
   * ID файла-цели (f1, f2, ...).
   * null — если импорт внешний или не разрешён.
   */
  toFileId: string | null;

  source: string;
  importedName: string;
  localName: string;
  line: number;

  /** ✅ v15.0.1: вид импорта — БЕЗ 'type' */
  type: 'named' | 'default' | 'namespace';
  isDefault: boolean;
  isNamespace: boolean;
  isTypeOnly: boolean;
  isExternal: boolean;
  packageName?: string;

  // ==========================================
  // ✅ v15.0.4: признаки реэкспорта
  // ==========================================

  /**
   * Является ли этот импорт частью `export ... from`.
   */
  isReExport?: boolean;

  /**
   * Является ли `export * from './foo'` или `export * as ns from './foo'`.
   */
  isStarReExport?: boolean;
}

// ============================================
// ВЫЗОВ
// ============================================
//
// ✅ v15.3.0 (P2): добавлены column/callKind/calleeName/argumentIndex.
// ============================================

export interface CallData {
  id: string;
  fromFunctionId: string;
  toFunctionId: string;
  line: number;

  /** Вид вызова (старое поле, для совместимости) */
  type: 'direct' | 'async' | 'method' | 'callback';

  // ==========================================
  // ✅ v15.3.0 (P2)
  // ==========================================

  /** Точная колонка вызова (1-based) */
  column?: number;

  /**
   * Вид вызова (расширенный).
   *
   * ════════════════════════════════════════════════════════════
   * ЗНАЧЕНИЯ
   * ════════════════════════════════════════════════════════════
   *
   *   - `'direct'`          — прямой вызов `foo()`
   *   - `'method'`          — метод `obj.foo()`
   *   - `'callback'`        — колбэк
   *   - `'constructor'`     — `new Foo()`
   *   - `'tagged-template'` — `` tag`...` ``
   *   - `'optional-chain'`  — `obj?.foo()`
   *   - `'spread'`          — `foo(...args)`
   *   - `'new'`             — синоним `'constructor'`
   */
  callKind?:
    | 'direct'
    | 'method'
    | 'callback'
    | 'constructor'
    | 'tagged-template'
    | 'optional-chain'
    | 'spread'
    | 'new';

  /** Имя callee (`foo`, `map`, `setTimeout`) */
  calleeName?: string;

  /** Индекс аргумента (для колбэков: 0, 1, ...) */
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

  /**
   * ✅ v15.0.2: условный рендеринг (v-if / v-else-if / v-else).
   *
   * ЕДИНСТВЕННОЕ место хранения conditionals в FullJSON.
   */
  conditionals?: TemplateConditional[];
}

// ============================================
// ✅ LIFECYCLE
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
// ✅ EFFECTS
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
// ✅ INJECTIONS
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
// ✅ REACTIVITY
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
// ✅ TYPES
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

  /** ✅ v15.0.2: количество conditionals (через templates[]) */
  totalConditionals?: number;

  /** ✅ v15.2.0 (P1): количество лексических связей */
  totalLexicalLinks?: number;
}

// ============================================
// ЕДИНОЕ РЕБРО ГРАФА
// ============================================

export interface EdgeData {
  from: string;
  to: string;

  /**
   * ✅ v15.2.0 (P1): добавлен 'lexical'.
   *
   * - `'import'`    — импорт
   * - `'export'`    — экспорт
   * - `'call'`      — вызов
   * - `'re-export'` — реэкспорт
   * - `'lexical'`   — лексическая связь (P1)
   */
  type: 'import' | 'export' | 'call' | 're-export' | 'lexical';

  symbol?: string;
  line?: number;
}

// ============================================================
// СЖАТЫЙ JSON (v15.4.3)
// ============================================================
//
// Формат кортежей (позиции фиксированы, см. legend.schemas):
//
//   mi:  { n: string[], f: [startFileIdx, fileCount][] }
//   fl:  { p: string[], m: [moduleIdx, count][] }
//   fns: { n, m, f, l, fl, p, rt, parent? }
//   cls: { n, m, f, l, fl, methods }
//   cn:  { n, m, f, l, fl, nonEmptyV }
//   gr.e:  { m, f, fn, l, ty, en, ln, s, flags }
//   gr.i:  { ff, tf, s, im, ln, l, ty }
//   gr.c:  { f, t, l, ty, col?, ck?, cn?, ai? }
//   gr.re: { m, fn, s, en, l, ty }
//   lx:  { p, c, r, l, ai, cn }  ← v15.2.0 (P1)
// ============================================================

export interface CompactJSON {
  /** Version */
  v: string;

  /** Timestamp */
  ts: string;

  /** Root module index */
  r: number;

  /** ✅ v12.0.0: режим сериализации values */
  valuesMode?: 'full' | 'relations';

  /** Токены для словарей строк */
  tokens: string[];

  /** Токенизированный stringDict */
  strs: (string | number[])[];

  /** Токенизированный paramDict */
  params: (string | number[])[];

  /** Токенизированный methodDict */
  methods: (string | number[])[];

  /** valueDict — без изменений */
  values: unknown[];

  /**
   * Module index: columnar.
   */
  mi: {
    n: string[];
    f: [number, number][];
  };

  /** File index: columnar */
  fl: {
    p: string[];
    m: [number, number][];
  };

  /**
   * Functions: columnar.
   *
   * ✅ v15.1.0 (P0): добавлено поле `parent`.
   */
  fns: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    p: number[][];
    rt: number[];

    /** ✅ v15.1.0 (P0): RLE от parentFunctionIdx, -1 = null */
    parent?: [number, number][];
  };

  /** Classes: columnar */
  cls: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    methods: number[][];
  };

  /** Constants: columnar */
  cn: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    nonEmptyV: [number, number][];
  };

  /** Graph — все связи в одном месте */
  gr: {
    /** Exports: columnar */
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

    /**
     * Imports: columnar.
     */
    i: {
      ff: number[];
      tf: number[];
      s: number[];
      im: number[];
      ln: number[];
      l: number[];
      ty: number[];
    };

    /**
     * Calls: columnar.
     *
     * ✅ v15.3.0 (P2): добавлены col/ck/cn/ai.
     */
    c: {
      f: number[];
      t: number[];
      l: number[];
      ty: number[];

      /** ✅ v15.3.0 (P2): column */
      col?: number[];

      /** ✅ v15.3.0 (P2): callKind code */
      ck?: number[];

      /** ✅ v15.3.0 (P2): calleeNameIdx в strs */
      cn?: number[];

      /** ✅ v15.3.0 (P2): argumentIndex */
      ai?: number[];
    };

    /** Re-exports: columnar */
    re: {
      m: number[];
      fn: number[];
      s: number[];
      en: number[];
      l: number[];
      ty: number[];
    };
  };

  // ==========================================
  // ✅ v15.0.0: расширенные секции vt/lc/ef/inj/rx/cd/ty/tr
  // ==========================================

  vt?: number[];
  lc?: number[];
  ef?: number[];
  inj?: number[];
  rx?: number[];
  cd?: number[];
  ty?: number[];
  tr?: number[];

  // ==========================================
  // ✅ v15.2.0 (P1): columnar-секция lx
  // ==========================================

  /**
   * Лексические связи: columnar.
   *
   * Все массивы параллельны: длина совпадает.
   *
   * ════════════════════════════════════════════════════════════
   * СХЕМА
   * ════════════════════════════════════════════════════════════
   *
   *   p  — RLE parentFunctionIdx, -1 = null
   *   c  — RLE childFunctionIdx
   *   r  — relationCode (0..7, см. legend.codes.lexicalRelation)
   *   l  — line
   *   ai — argumentIndex, -1 = нет
   *   cn — calleeNameIdx в strs, -1 = нет
   */
  lx?: {
    p: [number, number][];
    c: [number, number][];
    r: number[];
    l: number[];
    ai: number[];
    cn: number[];
  };

  /** Statistics */
  st: StatisticsData;

  /** Legend (codes + flags + schemas) */
  legend: CodecLegend;
}

// ============================================================
// ЛЕГЕНДА (v15.4.3)
// ============================================================

/** Один бит в поле flags */
export interface FlagBit {
  bit: number;
  name: string;
  description: string;
}

/** Словарь { код: описание } */
export interface CodesDict {
  [code: string]: string;
}

/**
 * Легенда — все словари и схемы для декодирования.
 *
 * ✅ v15.4.3: синхронизирована с CODEC_VERSION = '15.4.3'.
 */
export interface CodecLegend {
  /** Расшифровка строковых кодов */
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

    /** ✅ v15.2.0 (P1): коды для relation в lexicalLinks */
    lexicalRelation?: CodesDict;

    /** ✅ v15.3.0 (P2): коды для callKind */
    callKind?: CodesDict;
  };

  /** Расшифровка битовых флагов */
  flags: {
    bits: Record<string, string>;
  };

  /** Позиционные схемы кортежей */
  schemas: {
    mi: string[];
    fl: string[];

    /** ✅ v15.1.0 (P0): добавлен 'parent' */
    fns: string[];

    cls: string[];
    cn: string[];
    'gr.e': string[];
    'gr.i': string[];

    /** ✅ v15.3.0 (P2): добавлены col/ck/cn/ai */
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

    /** ✅ v15.2.0 (P1): схема lx */
    lx?: string[];
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

  /** ✅ v12.0.0: режим сериализации values */
  valuesMode?: 'full' | 'relations';

  /** Включать тела функций в отчёт */
  includeBody?: boolean;

  /** Включать VSCode-ссылки */
  includeVSCode?: boolean;
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

  /** ✅ v12.0.0: режим сериализации values */
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

    /** ✅ v15.2.0 (P1) */
    lexicalLinksDiff?: number;
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
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  CODEC_VERSION,
};
