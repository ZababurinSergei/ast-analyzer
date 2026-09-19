// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (v13.0.2 — columnar + RLE)
// ============================================
// Версия: 13.0.2
//
// ИЗМЕНЕНИЯ v13.0.2 (fix round-trip):
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '13.0.2'.
//     Причина: в v13.0.1 исправлена сортировка (удалён stableSortById),
//     в v13.0.2 исправлены:
//       • decode(): modules[].fileIds строятся через fl.m, а не через mi.f
//       • encode(): encodeStr() не токенизирует строки с разделителями
//         и двоеточием (потеря символов при join(''))
//     Это устраняет расхождения modules[].fileIds, imports[].toFileId,
//     external calls, L1/L2/DL/RE/ENC.
//
// ИЗМЕНЕНИЯ v13.0.1 (fix round-trip):
//   - ✅ УДАЛЕНА stableSortById из encode() (см. codec-encode.ts).
//
// ИЗМЕНЕНИЯ v13.0.0 (fix round-trip):
//   - ✅ ДОБАВЛЕНО: константа CODEC_VERSION — единый источник
//     истины для версии. Используется в compact-reporter.ts,
//     codec-encode.ts, codec-decode.ts.
//   - ✅ ИСПРАВЛЕНО: тип mi.f — теперь [startFileIdx, fileCount][],
//     а не RLE от moduleIdx. Раньше декодер интерпретировал moduleIdx
//     как fileIdx, что давало fileIds длиной 1 и "f10" вместо "f80".
//   - ✅ ДОБАВЛЕНО: mi и fl в CodecLegend.schemas.
//   - ✅ ОБНОВЛЕНО: valuesMode сохраняется в FullJSON и CompactJSON.
//
// ИЗМЕНЕНИЯ v12.0.0 (структурная оптимизация):
//   - ✅ CompactJSON переведён на columnar-структуру:
//       • mi, fl, fns, cls, cn, gr.* — объекты с параллельными массивами
//       • RLE для moduleIdx/fileIdx в fns, cls, cn
//       • битовые маски для булевых флагов
//       • числовые коды вместо строковых
//   - ✅ Удалены поля id (m1, f1, fn1) — позиция в массиве = ID
//   - ✅ CodecLegend упрощён: удалены how_to_read, flags.examples
//   - ✅ flags.bits — простой словарь { "1": "isAsync", ... }
//   - ✅ Токенизация словарей строк (strs, params, methods)
//   - ❌ Обратная совместимость со старыми compact.json НЕ поддерживается
//
// ИЗМЕНЕНИЯ v11.0.0 (компактнее):
//   - fns/cls/cn: name → nameIdx, flags → number
//
// ИЗМЕНЕНИЯ v10.4.1:
//   - Удалены 5 полей description из CodecLegend
//
// ИЗМЕНЕНИЯ v10.4.0:
//   - Перестроен CodecLegend: how_to_read, flags, codes, dictionaries, schemas
//
// ИЗМЕНЕНИЯ v9.0.6:
//   - TemplateRefUsage / TemplateConditional реэкспортируются из '../../types.js'
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - Добавлены LifecycleHook, EffectEdge, InjectionEdge, ReactivityEdge,
//     TemplateConditional, TypeNodeData, TypeRefData и связанные типы.
//   - Расширены FullJSON, CompactJSON, CodecLegend.
// ============================================

// ============================================================
// ✅ v13.0.2: ЕДИНАЯ ВЕРСИЯ CODEC
// ============================================================
// Используется в:
//   - compact-reporter.ts (version в full.json)
//   - codec-encode.ts     (v в compact.json)
//   - codec-decode.ts     (version в full.json при decode)
//
// Единый источник истины — устраняет расхождение "13.0.0" vs "11.1.0",
// которое ломало L1/L2/DL round-trip.
// ============================================================

export const CODEC_VERSION = '13.0.2';

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
// ПОЛНЫЙ (ЧИТАЕМЫЙ) JSON
// ============================================================

/**
 * Полный (читаемый) JSON отчёта.
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
  /** Vue-шаблоны (отдельные сущности). */
  templates?: TemplateData[];
  /** Статистика */
  statistics: StatisticsData;
  /** Единый массив рёбер для сводного графа. */
  edges?: EdgeData[];

  // ==========================================
  // ✅ НОВОЕ v9.0.0
  // ==========================================

  /** Хуки жизненного цикла (onMounted, onUnmounted, ...) */
  lifecycle?: LifecycleHook[];
  /** Side-effects (timer, cleanup, promise, event, subscription) */
  effects?: EffectEdge[];
  /** Provide/Inject рёбра */
  injections?: InjectionEdge[];
  /** Реактивные связи (computed/watch/ref/...) */
  reactivity?: ReactivityEdge[];
  /** Условный рендеринг (v-if / v-else-if / v-else) */
  conditionals?: TemplateConditional[];
  /** Узлы тип-графа (interface / type-alias / enum / class) */
  types?: TypeNodeData[];
  /** Рёбра использования типов (param / return / field / ...) */
  typeRefs?: TypeRefData[];

  // ==========================================
  // ✅ НОВОЕ v12.0.0: values mode
  // ==========================================

  /**
   * Режим сериализации values, использованный при генерации.
   *
   * - `'full'`      — все значения сохранены (обратная совместимость)
   * - `'relations'` — только значения, нужные для восстановления связей
   *
   * Опционально для обратной совместимости: старые full.json без этого
   * поля читаются как `'full'`.
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
  type: 'named' | 'default' | 'namespace' | 'type';
  isDefault: boolean;
  isNamespace: boolean;
  isTypeOnly: boolean;
  isExternal: boolean;
  packageName?: string;
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
// ✅ НОВОЕ v9.0.0: LIFECYCLE
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
// ✅ НОВОЕ v9.0.0: EFFECTS
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
// ✅ НОВОЕ v9.0.0: INJECTIONS
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
// ✅ НОВОЕ v9.0.0: REACTIVITY
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
// ✅ НОВОЕ v9.0.0: TYPES
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
}

// ============================================
// ЕДИНОЕ РЕБРО ГРАФА
// ============================================

export interface EdgeData {
  from: string;
  to: string;
  type: 'import' | 'export' | 'call' | 're-export';
  symbol?: string;
  line?: number;
}

// ============================================================
// СЖАТЫЙ JSON (v13.0.2 — COLUMNAR + RLE)
// ============================================================

/**
 * Сжатый JSON — ПОЛНОСТЬЮ ОБРАТИМ.
 *
 * ✅ v13.0.2-fix: encodeStr() не токенизирует строки с разделителями
 *    и двоеточием (см. codec-encode.ts). decode() строит
 *    modules[].fileIds через fl.m, а не через mi.f.
 * ✅ v13.0.0-fix: mi.f — пары [startFileIdx, fileCount].
 * ✅ v12.0.0: columnar-структура + RLE + битовые маски.
 *
 * Формат кортежей (позиции фиксированы, см. legend.schemas):
 *
 *   mi:  { n: string[], f: [startFileIdx, fileCount][] }
 *   fl:  { p: string[], m: [moduleIdx, count][] }
 *   fns: { n: nameIdx[], m: [moduleIdx, count][], f: [fileIdx, count][],
 *          l: line[], fl: flags[], p: paramsIdx[][], rt: returnTypeIdx[] }
 *   cls: { n: nameIdx[], m: [moduleIdx, count][], f: [fileIdx, count][],
 *          l: line[], fl: flags[], methods: methodsIdx[][] }
 *   cn:  { n: nameIdx[], m: [moduleIdx, count][], f: [fileIdx, count][],
 *          l: line[], fl: flags[], nonEmptyV: [constIdx, valueIdx][] }
 *   gr.e:  { m, f, fn, l, ty, en, ln, s, flags }
 *   gr.i:  { ff, tf, s, im, ln, l, ty }
 *   gr.c:  { f, t, l, ty }
 *   gr.re: { m, fn, s, en, l, ty }
 */
export interface CompactJSON {
  /** Version */
  v: string;
  /** Timestamp */
  ts: string;
  /** Root module index */
  r: number;

  /**
   * ✅ v12.0.0: режим сериализации values.
   *
   * Опционально для обратной совместимости: старые compact.json
   * без этого поля читаются как `'full'`.
   */
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
   *
   * ✅ v13.0.0-fix: `f` — массив пар [startFileIdx, fileCount].
   * Раньше здесь был RLE от moduleIdx, что ломало round-trip:
   * decode интерпретировал moduleIdx как fileIdx, и modules[].fileIds
   * получал длину 1 вместо N (и "f10" вместо "f80").
   *
   * ✅ v13.0.2-fix: decode() больше НЕ использует mi.f для построения
   * modules[].fileIds — строит через fl.m. mi.f сохранён только для
   * обратной совместимости схемы (legend.schemas.mi = ['n', 'f']).
   */
  mi: {
    n: string[];
    f: [number, number][]; // [startFileIdx, fileCount]
  };

  /** File index: columnar */
  fl: {
    p: string[];
    m: [number, number][]; // RLE: [moduleIdx, count]
  };

  /** Functions: columnar */
  fns: {
    n: number[]; // nameIdx
    m: [number, number][]; // RLE moduleIdx
    f: [number, number][]; // RLE fileIdx
    l: number[]; // line
    fl: number[]; // flags (bitmask)
    p: number[][]; // paramsIdx
    rt: number[]; // returnTypeIdx
  };

  /** Classes: columnar */
  cls: {
    n: number[]; // nameIdx
    m: [number, number][]; // RLE moduleIdx
    f: [number, number][]; // RLE fileIdx
    l: number[]; // line
    fl: number[]; // flags
    methods: number[][]; // methodsIdx
  };

  /** Constants: columnar */
  cn: {
    n: number[]; // nameIdx
    m: [number, number][]; // RLE moduleIdx
    f: [number, number][]; // RLE fileIdx
    l: number[]; // line
    fl: number[]; // flags
    nonEmptyV: [number, number][]; // [constIdx, valueIdx] для непустых
  };

  /** Graph — все связи в одном месте */
  gr: {
    /** Exports: columnar */
    e: {
      m: number[]; // moduleIdx
      f: number[]; // fileIdx
      fn: number[]; // funcIdx
      l: number[]; // line
      ty: number[]; // typeCode (0=ne, 1=de, 2=te, 3=re)
      en: number[]; // exportNameIdx
      ln: number[]; // localNameIdx
      s: number[]; // sourceIdx
      flags: number[]; // isTypeOnly | isReExport<<1 | isStarReExport<<2 | isDefaultReExport<<3
    };

    /** Imports: columnar */
    i: {
      ff: number[]; // fromFileIdx
      tf: number[]; // toFileIdIdx
      s: number[]; // sourceIdx
      im: number[]; // importedNameIdx
      ln: number[]; // localNameIdx
      l: number[]; // line
      ty: number[]; // typeCode | (isExternal << 2)
    };

    /** Calls: columnar */
    c: {
      f: number[]; // fromIdx
      t: number[]; // toIdx
      l: number[]; // line
      ty: number[]; // typeCode | (isExternal << 2)
    };

    /** Re-exports: columnar */
    re: {
      m: number[]; // moduleIdx
      fn: number[]; // funcIdx
      s: number[]; // sourceIdx
      en: number[]; // exportNameIdx
      l: number[]; // line
      ty: number[]; // typeCode | (isTypeOnly << 2)
    };
  };

  /** Vue templates */
  vt?: any[];

  /** Statistics */
  st: StatisticsData;

  /** Legend (codes + flags + schemas) */
  legend: CodecLegend;

  /** Lifecycle */
  lc?: any[];
  /** Effects */
  ef?: any[];
  /** Injections */
  inj?: any[];
  /** Reactivity */
  rx?: any[];
  /** Conditionals */
  cd?: any[];
  /** Types */
  ty?: any[];
  /** Type refs */
  tr?: any[];
}

// ============================================================
// ЛЕГЕНДА (v13.0.2)
// ============================================================

/**
 * Один бит в поле flags.
 */
export interface FlagBit {
  bit: number;
  name: string;
  description: string;
}

/**
 * Словарь { код: описание }.
 */
export interface CodesDict {
  [code: string]: string;
}

/**
 * Легенда — все словари и схемы, необходимые для декодирования.
 *
 * ✅ v13.0.2-fix: версия синхронизирована с CODEC_VERSION.
 * ✅ v13.0.0-fix: добавлены mi и fl в schemas.
 * ✅ v12.0.0: упрощена.
 *   - УДАЛЕНЫ: how_to_read, flags.examples, dictionaries.
 *   - flags.bits — простой словарь { "1": "isAsync", ... }.
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
  };

  /** Расшифровка битовых флагов */
  flags: {
    bits: Record<string, string>;
  };

  /** Позиционные схемы кортежей */
  schemas: {
    // ✅ v13.0.0-fix: добавлены mi и fl
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

  // ==========================================
  // ✅ НОВОЕ v12.0.0: values mode
  // ==========================================

  /**
   * Режим сериализации секции values.
   *
   * - `'full'`      — все значения сохраняются (обратная совместимость)
   * - `'relations'` — только значения, нужные для восстановления связей
   *                   (сжатый режим, экономия 5–15x по размеру)
   *
   * Default: 'relations'.
   */
  valuesMode?: 'full' | 'relations';
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

    // ==========================================
    // ✅ НОВОЕ v12.0.0: values mode
    // ==========================================

    /**
     * Режим сериализации values, использованный при генерации.
     * Возвращается, чтобы вызывающий код мог логировать/сохранять его.
     */
    valuesMode?: 'full' | 'relations';

    // ✅ v13.0.0-fix: добавлено для диагностики
    /** Количество значений в compact.values[] */
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

  // ==========================================
  // ✅ НОВОЕ v12.0.0: values mode
  // ==========================================

  /**
   * Режим сериализации values.
   *
   * Влияет только на переиндексацию `cn.nonEmptyV` при декодировании.
   * В режиме `relations` декодер ожидает, что `compact.values` уже
   * отфильтрован, и корректно восстанавливает `constants[].value`.
   *
   * Опционально для обратной совместимости: если не задан,
   * используется значение из `compact.valuesMode` (или 'full').
   */
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
  // Все типы экспортируются автоматически
};
