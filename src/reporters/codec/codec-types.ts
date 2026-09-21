// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (v15.0.5)
// ============================================
// Версия: 15.0.5
//
// ИЗМЕНЕНИЯ v15.0.5 (gr.i.tf — индекс в fl.p):
//   - ✅ ИЗМЕНЕНО: `gr.i.tf` теперь содержит ИНДЕКС В `fl.p` (файлы),
//     а не индекс в `strs` (source-строка). -1 = внешний/неразрешённый.
//   - ✅ `gr.i.s` (source) — БЕЗ ИЗМЕНЕНИЙ, остаётся индексом в `strs`.
//   - ✅ `ImportData.toFileId` восстанавливается из `gr.i.tf`.
//   - ✅ CODEC_VERSION = '15.0.5'.
//
// ИЗМЕНЕНИЯ v15.0.4 (проброс реэкспортов через imports):
//   - ✅ ДОБАВЛЕНО: `ImportData.isReExport?: boolean`
//   - ✅ ДОБАВЛЕНО: `ImportData.isStarReExport?: boolean`
//     Это позволяет фронту строить полный граф файловых связей,
//     включая `export { X } from './foo'` и `export * from './foo'`.
//
// ИЗМЕНЕНИЯ v15.0.2 (устранение дублирования conditionals):
//   - ✅ УДАЛЕНО: поле `FullJSON.conditionals`.
//
//     ПРИЧИНА:
//     ---------
//     В v15.0.1 `conditionals` дублировались в двух местах
//     FullJSON:
//       1. `full.conditionals`            — верхний уровень
//       2. `full.templates[i].conditionals` — внутри templates
//
//     Один и тот же массив присваивался в оба места, поэтому
//     при сериализации через `safeJsonStringify` второй экземпляр
//     превращался в строку "[Circular]". Это ломало round-trip:
//       decode(compact).conditionals = undefined
//       full.conditionals = ["[Circular]", "[Circular]", ...]
//
//     РЕШЕНИЕ:
//     ---------
//     `conditionals` живут ТОЛЬКО в `templates[i].conditionals`.
//     Верхнеуровневое поле удалено полностью. Все потребители
//     (`codec-encode.ts`, `codec-decode.ts`, `verify-*.ts`)
//     обновлены для работы через `templates[]`.
//
// ИЗМЕНЕНИЯ v15.0.1 (fix imports[].type):
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '15.0.1'.
//   - ✅ ИСПРАВЛЕНО: тип `ImportData['type']` сужен до
//     `'named' | 'default' | 'namespace'`. Значение `'type'`
//     УДАЛЕНО — для type-only импортов используйте отдельный
//     флаг `isTypeOnly`.
//
// ИЗМЕНЕНИЯ v15.0.0 (полный round-trip расширенных секций):
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '15.0.0'.
//   - ✅ УТОЧНЕНО: тип CompactJSON для полей vt/lc/ef/inj/rx/cd/ty/tr —
//     массивы индексов в values[].
//
// ИЗМЕНЕНИЯ v13.0.2 (fix round-trip):
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '13.0.2'.
//
// ИЗМЕНЕНИЯ v13.0.0 (fix round-trip):
//   - ✅ ДОБАВЛЕНО: константа CODEC_VERSION — единый источник истины.
//   - ✅ ИСПРАВЛЕНО: тип mi.f — [startFileIdx, fileCount][].
//   - ✅ ДОБАВЛЕНО: mi и fl в CodecLegend.schemas.
//   - ✅ ОБНОВЛЕНО: valuesMode сохраняется в FullJSON и CompactJSON.
//
// ИЗМЕНЕНИЯ v12.0.0 (структурная оптимизация):
//   - ✅ CompactJSON переведён на columnar-структуру.
//
// ИЗМЕНЕНИЯ v11.0.0 (компактнее):
//   - fns/cls/cn: name → nameIdx, flags → number.
//
// ИЗМЕНЕНИЯ v10.4.0:
//   - Перестроен CodecLegend: how_to_read, flags, codes, dictionaries,
//     schemas.
//
// ИЗМЕНЕНИЯ v9.0.6:
//   - TemplateRefUsage / TemplateConditional реэкспортируются из '../../types.js'.
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - Добавлены LifecycleHook, EffectEdge, InjectionEdge, ReactivityEdge,
//     TemplateConditional, TypeNodeData, TypeRefData и связанные типы.
// ============================================

// ============================================================
// ✅ v15.0.5: ЕДИНАЯ ВЕРСИЯ CODEC
// ============================================================
// Используется в:
//   - compact-reporter.ts (version в full.json)
//   - codec-encode.ts     (v в compact.json)
//   - codec-decode.ts     (version в full.json при decode)
//
// Единый источник истины — устраняет расхождение версий между
// full.json и compact.json.
// ============================================================

export const CODEC_VERSION = '15.0.5';

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
 *
 * ⚠️ v15.0.2: поле `conditionals` УДАЛЕНО с верхнего уровня.
 *    Единственное место хранения — `templates[i].conditionals`.
 *
 *    Причина: дублирование на верхнем уровне и в templates[]
 *    приводило к тому, что `safeJsonStringify` заменял второй
 *    экземпляр на "[Circular]", и conditionals терялись при
 *    чтении с диска.
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
   *    На верхнем уровне FullJSON их нет.
   */
  templates?: TemplateData[];

  /** Статистика */
  statistics: StatisticsData;
  /** Единый массив рёбер для сводного графа. */
  edges?: EdgeData[];

  // ==========================================
  // ✅ РАСШИРЕННЫЕ СЕКЦИИ (v9.0.0+)
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
//
// ✅ v15.0.1: семантика полей `type` и `isTypeOnly` УНИФИЦИРОВАНА.
//
//   type        — вид импорта: 'named' | 'default' | 'namespace'
//                 Значение 'type' УДАЛЕНО. Для type-only импортов
//                 используйте `isTypeOnly: true` — это ОТДЕЛЬНЫЙ флаг.
//
//   isTypeOnly  — отдельный флаг (`import type ...`)
//
// ════════════════════════════════════════════════════════════
// ПРИМЕРЫ
// ════════════════════════════════════════════════════════════
//
//   import { X } from '...'         → type: 'named',     isTypeOnly: false
//   import type { X } from '...'    → type: 'named',     isTypeOnly: true
//   import Foo from '...'           → type: 'default',   isTypeOnly: false
//   import type Foo from '...'      → type: 'default',   isTypeOnly: true
//   import * as ns from '...'       → type: 'namespace', isTypeOnly: false
//   import type * as ns from '...'  → type: 'namespace', isTypeOnly: true
//
// ✅ v15.0.4: добавлены флаги реэкспорта.
//
//   export { X } from './foo'       → type: 'named',     isReExport: true
//   export { default } from './foo' → type: 'default',   isReExport: true
//   export * from './foo'           → type: 'namespace', isReExport: true,
//                                     isStarReExport: true
//   export * as ns from './foo'     → type: 'namespace', isReExport: true,
//                                     isStarReExport: true
// ============================================

export interface ImportData {
  id: string;
  fromFileId: string;

  /**
   * ID файла-цели (f1, f2, ...).
   * null — если импорт внешний (node_modules) или не разрешён.
   *
   * ✅ v15.0.5: восстанавливается из `gr.i.tf` (индекс в `fl.p`),
   * а не из `gr.i.s` (source-строка).
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
  // ✅ НОВОЕ v15.0.4: признаки реэкспорта
  // ==========================================

  /**
   * Является ли этот импорт частью конструкции `export ... from`.
   *
   * Используется фронтом для построения полного графа связей:
   * цепочка `AiDataTable.vue ← ui/index.ts ← src/index.ts`
   * строится в том числе по рёбрам от реэкспортов.
   *
   * Примеры:
   *   export { X } from './foo'   → isReExport: true
   *   export * from './foo'       → isReExport: true, isStarReExport: true
   *   export * as ns from './foo' → isReExport: true, isStarReExport: true
   *   import { X } from './foo'   → undefined (обычный импорт)
   */
  isReExport?: boolean;

  /**
   * Является ли `export * from './foo'` или `export * as ns from './foo'`.
   *
   * Только для `isReExport === true`. Используется фронтом для
   * визуального выделения star-реэкспортов (синий цвет в UI).
   */
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
//
// ⚠️ v15.0.2: `conditionals` живут ТОЛЬКО ЗДЕСЬ.
//    На верхнем уровне FullJSON их больше нет.
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
   * На верхнем уровне FullJSON этого поля нет.
   *
   * Каждый элемент содержит:
   *   - id                 (cd1, cd2, ...)
   *   - directive          ('v-if' | 'v-else-if' | 'v-else')
   *   - fileId             (f1, f2, ...)
   *   - line               (номер строки в шаблоне)
   *   - conditionExpression (для v-if / v-else-if)
   *   - renderedComponent   (опционально)
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
    | 'computed'
    | 'watch'
    | 'watchEffect'
    | 'ref'
    | 'reactive'
    | 'shallowRef'
    | 'readonly';

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
  /** ✅ v15.0.2: количество conditionals (считается через templates[]) */
  totalConditionals?: number;
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
// СЖАТЫЙ JSON (v15.0.5 — COLUMNAR + RLE + РАСШИРЕННЫЕ СЕКЦИИ)
// ============================================================
//
// ✅ v15.0.5: `gr.i.tf` — ИНДЕКС В `fl.p` (файлы), а не в `strs`.
//    -1 = внешний/неразрешённый импорт.
//
//    `gr.i.s` — ПО-ПРЕЖНЕМУ индекс в `strs` (source-строка).
//    Не удалять — нужен для UI и диагностики.
//
//    combinedTy (`gr.i.ty`) — биты:
//      0-1 : typeCode (0=named, 1=default, 2=namespace)
//      2   : isExternal
//      3   : isTypeOnly
//      4   : isReExport
//      5   : isStarReExport
//
// ✅ v15.0.2: расширенные секции vt/lc/ef/inj/rx/cd/ty/tr хранятся
//    как массивы индексов в values[]. Каждый элемент values[i] — это
//    ОБЪЕКТ (после не-дедуплицирующего addAny).
//
//    Секция `cd` собирается из `templates[].conditionals` (см.
//    codec-encode.ts). Верхнеуровневого `conditionals` в FullJSON
//    больше нет.
//
// ✅ v13.0.2-fix: encodeStr() не токенизирует строки с разделителями
//    и двоеточием. decode() строит modules[].fileIds через fl.m.
// ✅ v13.0.0-fix: mi.f — пары [startFileIdx, fileCount].
// ✅ v12.0.0: columnar-структура + RLE + битовые маски.
//
// Формат кортежей (позиции фиксированы, см. legend.schemas):
//
//   mi:  { n: string[], f: [startFileIdx, fileCount][] }
//   fl:  { p: string[], m: [moduleIdx, count][] }
//   fns: { n: nameIdx[], m: [moduleIdx, count][], f: [fileIdx, count][],
//          l: line[], fl: flags[], p: paramsIdx[][], rt: returnTypeIdx[] }
//   cls: { n: nameIdx[], m: [moduleIdx, count][], f: [fileIdx, count][],
//          l: line[], fl: flags[], methods: methodsIdx[][] }
//   cn:  { n: nameIdx[], m: [moduleIdx, count][], f: [fileIdx, count][],
//          l: line[], fl: flags[], nonEmptyV: [constIdx, valueIdx][] }
//   gr.e:  { m, f, fn, l, ty, en, ln, s, flags }
//   gr.i:  { ff, tf, s, im, ln, l, ty }
//   gr.c:  { f, t, l, ty }
//   gr.re: { m, fn, s, en, l, ty }
// ============================================================

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

    /**
     * Imports: columnar.
     *
     * ✅ v15.0.5: `tf` — ИНДЕКС В `fl.p` (файлы), а не в `strs`.
     *   -1 = внешний/неразрешённый импорт.
     *   Ранее (v15.0.4): `tf` — индекс в `strs` (source-строка).
     *
     * ✅ v15.0.5: `s` — ПО-ПРЕЖНЕМУ индекс в `strs` (source-строка).
     *   Не удалять — нужен для UI и диагностики.
     *
     * combinedTy (`ty`) — биты:
     *   0-1: typeCode (0=named, 1=default, 2=namespace)
     *   2:   isExternal
     *   3:   isTypeOnly
     *   4:   isReExport
     *   5:   isStarReExport
     */
    i: {
      ff: number[]; // fromFileIdx (индекс в fl.p)
      tf: number[]; // ✅ v15.0.5: toFileIdx (индекс в fl.p), -1 = внешний
      s: number[]; // sourceIdx (индекс в strs) — БЕЗ ИЗМЕНЕНИЙ
      im: number[]; // importedNameIdx (индекс в strs)
      ln: number[]; // localNameIdx (индекс в strs)
      l: number[]; // line
      ty: number[]; // combinedTy
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

  // ==========================================
  // ✅ v15.0.0: расширенные секции vt/lc/ef/inj/rx/cd/ty/tr
  // ==========================================
  //
  // Каждая секция — массив индексов в values[].
  // Сами объекты лежат в values[idx] (ОБЪЕКТ, не строка).
  //
  // ⚠️ v15.0.1: `addAny` больше НЕ дедуплицирует. Это гарантирует
  //    1-к-1 соответствие: compact.cd[i] ↔ full.templates[].conditionals[i].
  //
  // ⚠️ v15.0.2: секция `cd` собирается из templates[].conditionals
  //    (см. codec-encode.ts). Верхнеуровневого `conditionals` в
  //    FullJSON больше нет.
  // ==========================================

  /** Vue templates: number[] — индексы в values[] */
  vt?: number[];
  /** Lifecycle: number[] — индексы в values[] */
  lc?: number[];
  /** Effects: number[] — индексы в values[] */
  ef?: number[];
  /** Injections: number[] — индексы в values[] */
  inj?: number[];
  /** Reactivity: number[] — индексы в values[] */
  rx?: number[];
  /** Conditionals: number[] — индексы в values[] */
  cd?: number[];
  /** Types: number[] — индексы в values[] */
  ty?: number[];
  /** Type refs: number[] — индексы в values[] */
  tr?: number[];

  /** Statistics */
  st: StatisticsData;

  /** Legend (codes + flags + schemas) */
  legend: CodecLegend;
}

// ============================================================
// ЛЕГЕНДА (v15.0.5)
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
 * ✅ v15.0.5: версия синхронизирована с CODEC_VERSION.
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
  // ✅ v12.0.0: values mode
  // ==========================================

  /**
   * Режим сериализации секции values.
   *
   * - `'full'`      — все значения сохраняются (обратная совместимость)
   * - `'relations'` — только значения, нужные для восстановления связей
   *
   * Default: 'relations'.
   */
  valuesMode?: 'full' | 'relations';

  // ==========================================
  // ✅ v15.0.5: проброс в BuildReportStage
  // ==========================================

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

    // ==========================================
    // ✅ v12.0.0: values mode
    // ==========================================

    /**
     * Режим сериализации values, использованный при генерации.
     */
    valuesMode?: 'full' | 'relations';

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
  // ✅ v12.0.0: values mode
  // ==========================================

  /**
   * Режим сериализации values.
   *
   * Влияет только на переиндексацию `cn.nonEmptyV` при декодировании.
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
};
