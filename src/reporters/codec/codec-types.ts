// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (Стратегия B — строгий round-trip)
// ============================================
// Версия: 9.0.0
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ ДОБАВЛЕНЫ: LifecycleHook, LifecycleHookName
//   - ✅ ДОБАВЛЕНЫ: EffectEdge, EffectType
//   - ✅ ДОБАВЛЕНЫ: InjectionEdge, InjectionKind
//   - ✅ ДОБАВЛЕНЫ: ReactivityEdge, ReactivityKind
//   - ✅ ДОБАВЛЕНЫ: TemplateConditional, ConditionalDirective
//   - ✅ ДОБАВЛЕНЫ: TypeNodeData, TypeKind, TypeRefData, TypeUsageKind
//   - ✅ РАСШИРЕН: TemplateDynamicComponent (resolvedComponents?)
//   - ✅ РАСШИРЕН: TemplateData (conditionals?)
//   - ✅ РАСШИРЕН: FullJSON (7 новых опциональных секций)
//   - ✅ РАСШИРЕН: CompactJSON (lc, ef, inj, rx, cd, ty, tr;
//                              vt.dynamicComponents → 3 элемента)
//   - ✅ РАСШИРЕН: CodecLegend (7 новых словарей + 7 новых схем)
//   - ✅ УНИФИЦИРОВАНЫ: GenerateReportOptions, GenerateReportResult
//                       (устранён TS2300: Duplicate identifier)
//
// ИЗМЕНЕНИЯ v4.1.0:
//   - ✅ НОВОЕ: TemplateData + вложенные типы
//   - ✅ НОВОЕ: templates?: TemplateData[] в FullJSON
//   - ✅ НОВОЕ: totalTemplates?: number в StatisticsData
//   - ✅ НОВОЕ: vt?: [...] в CompactJSON
//   - ✅ НОВОЕ: схемы vt.* в CodecLegend.arraySchemas
//
// ИЗМЕНЕНИЯ v3.1.0:
//   - Добавлен интерфейс DecodeOptions для Codec.decode()
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - CompactJSON: новые кортежи с индексами словарей
//   - CodecLegend: +stringDict, +paramDict, +methodDict, +valueDict
//   - CodecLegend: +arraySchemas (позиционные схемы массивов)
//   - ExportData: +isReExport, +isStarReExport, +isDefaultReExport, +source
//   - CompactJSON.mi: { n, f } вместо просто строки
//   - CompactJSON.fl: { p, m } вместо просто строки
//   - CompactJSON.gr.e: 10 элементов
//   - CompactJSON.gr.i: 8 элементов
//   - CompactJSON.gr.c: toIdxOrExternalIdx + typeCode 'e'
//   - CompactJSON.gr.re: 7 элементов
//   - Убран CompactJSON.edges (восстанавливается из gr.*)
//
// ✅ ESLint: все Array<T> заменены на T[]
// ============================================

// ============================================
// ПОЛНЫЙ (ЧИТАЕМЫЙ) JSON
// ============================================

/**
 * Полный (читаемый) JSON отчёта.
 *
 * Это «истина» в последней инстанции — из него генерируется сжатый JSON,
 * и в него же декодируется сжатый JSON обратно.
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
   * Vue-шаблоны (отдельные сущности).
   *
   * Каждый элемент — отдельный шаблон Vue-файла.
   * Хранит ССЫЛКИ (имена), а не дубликаты объектов.
   * Рёбра (event→handler, templateRef→expose) создаются
   * в `calls[]`, а не дублируются здесь.
   */
  templates?: TemplateData[];
  /** Статистика */
  statistics: StatisticsData;
  /**
   * Единый массив рёбер для сводного графа.
   * ⚠️ В compact.json НЕ хранится — восстанавливается из gr.*
   */
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
}

// ============================================
// МОДУЛЬ
// ============================================

/**
 * Модуль — директория с файлами.
 * Например: `core`, `modes`, `reporters`, `cli`.
 */
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

/**
 * Файл — конкретный .ts/.js/.vue файл.
 * Принадлежит одному модулю.
 */
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

/**
 * Функция — объявленная функция, метод класса,
 * стрелочная функция или обработчик события.
 */
export interface FunctionData {
  /** Уникальный ID функции (fn1, fn2, ...) */
  id: string;
  /** Имя функции */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки объявления */
  line: number;
  /** Экспортируется ли функция */
  isExported: boolean;
  /** Асинхронная ли функция */
  isAsync: boolean;
  /** Стрелочная ли функция */
  isArrow: boolean;
  /** Является ли методом класса */
  isMethod: boolean;
  /** Параметры функции */
  params: string[];
  /** Тип возвращаемого значения (если известен) */
  returnType?: string;

  // --- Опциональные флаги (используются в encodeFlags) ---
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

/**
 * Класс — объявление класса в файле.
 */
export interface ClassData {
  /** Уникальный ID класса (cls1, cls2, ...) */
  id: string;
  /** Имя класса */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки объявления */
  line: number;
  /** Экспортируется ли класс */
  isExported: boolean;
  /** Методы класса */
  methods: string[];
}

// ============================================
// КОНСТАНТА
// ============================================

/**
 * Константа — объявление `const` (обычно верхнего уровня).
 */
export interface ConstantData {
  /** Уникальный ID константы (cn1, cn2, ...) */
  id: string;
  /** Имя константы */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки объявления */
  line: number;
  /** Экспортируется ли константа */
  isExported: boolean;
  /** Значение константы (если примитив) */
  value?: unknown;
}

// ============================================
// ЭКСПОРТ
// ============================================

/**
 * Экспорт — обычный `export { name }` или `export function name`.
 * НЕ включает реэкспорты (они в ReExportData).
 */
export interface ExportData {
  /** Уникальный ID экспорта (e1, e2, ...) */
  id: string;
  /** ID модуля, из которого экспортируется */
  moduleId: string;
  /** ID файла, из которого экспортируется */
  fileId: string;
  /** ID экспортируемой функции */
  functionId: string;
  /** Имя, под которым экспортируется */
  exportName: string;
  /** Локальное имя (может отличаться при `export { a as b }`) */
  localName: string;
  /** Номер строки */
  line: number;
  /** Тип экспорта */
  type: 'named' | 'default' | 'type';
  /** Является ли default-экспортом */
  isDefault: boolean;
  /** Только для типов */
  isTypeOnly: boolean;
  /** Является ли реэкспортом (для совместимости; в compact → gr.re) */
  isReExport?: boolean;
  /** Является ли `export * from '...'` */
  isStarReExport?: boolean;
  /** Является ли `export { default } from '...'` */
  isDefaultReExport?: boolean;
  /** Источник (для реэкспортов) */
  source?: string;
}

// ============================================
// ИМПОРТ
// ============================================

/**
 * Импорт — `import { name } from 'source'`.
 * Каждый specifier — отдельная запись.
 */
export interface ImportData {
  /** Уникальный ID импорта (i1, i2, ...) */
  id: string;
  /** ID файла-импортёра */
  fromFileId: string;
  /**
   * ID файла-цели.
   * - ID файла проекта (например, 'f5')
   * - 'external:vue' — внешний пакет
   * - 'unresolved:./foo' — не удалось разрешить
   * - null — если вообще не удалось определить
   */
  toFileId: string | null;
  /** Исходный путь импорта (как в коде) */
  source: string;
  /** Имя импортируемой сущности */
  importedName: string;
  /** Локальное имя (при `import { a as b }`) */
  localName: string;
  /** Номер строки */
  line: number;
  /** Тип импорта */
  type: 'named' | 'default' | 'namespace' | 'type';
  /** Является ли default-импортом */
  isDefault: boolean;
  /** Является ли namespace-импортом */
  isNamespace: boolean;
  /** Только для типов */
  isTypeOnly: boolean;
  /** Внешний ли модуль (node_modules) */
  isExternal: boolean;
  /** Имя пакета (для внешних) */
  packageName?: string;
}

// ============================================
// ВЫЗОВ
// ============================================

/**
 * Вызов — `funcName(...)` внутри другой функции.
 * Позволяет строить граф вызовов.
 */
export interface CallData {
  /** Уникальный ID вызова (c1, c2, ...) */
  id: string;
  /** ID функции-источника (кто вызывает) */
  fromFunctionId: string;
  /**
   * ID функции-цели (кого вызывают).
   * Может быть 'external:readFileSync' для внешних вызовов.
   */
  toFunctionId: string;
  /** Номер строки вызова */
  line: number;
  /** Тип вызова */
  type: 'direct' | 'async' | 'method' | 'callback';
}

// ============================================
// РЕЭКСПОРТ
// ============================================

/**
 * Реэкспорт — `export { name } from 'source'`.
 * Используется в barrel-файлах (например, index.ts).
 */
export interface ReExportData {
  /** Уникальный ID реэкспорта (re1, re2, ...) */
  id: string;
  /** ID модуля, из которого реэкспортируется */
  moduleId: string;
  /** ID реэкспортируемой функции */
  functionId: string;
  /** Источник (`./core/ast-parser.js`) */
  source: string;
  /** Имя, под которым реэкспортируется */
  exportName: string;
  /** Номер строки */
  line: number;
  /** Тип реэкспорта */
  type: 'named' | 'default' | 'all';
  /** Является ли default-реэкспортом */
  isDefault: boolean;
  /** Только для типов */
  isTypeOnly: boolean;
  /** Является ли `export * from` */
  isStarReExport: boolean;
}

// ============================================
// VUE TEMPLATE
// ============================================
//
// vt — это ОТДЕЛЬНАЯ СУЩНОСТЬ (шаблон Vue-файла),
// а не агрегатор связей. Хранит ССЫЛКИ (имена),
// а не дубликаты объектов.
//
// Рёбра (event→handler, templateRef→expose) создаются
// в CallData[], а не дублируются внутри TemplateData.
// ============================================

export interface TemplateEventHandler {
  /** Имя события (click, update:value, ...) */
  eventName: string;
  /** Имя обработчика (onClick, handleUpdate, ...) */
  handlerName: string;
  /** Тег (<button>, <AiButton>, ...) */
  tag: string;
  /** Строка */
  line: number;
  /** Модификаторы (.stop, .prevent, ...) */
  modifiers: string[];
  /** Внешний обработчик (emit/console/Math и т.п.) */
  isExternal: boolean;
}

/**
 * Динамический компонент (<component :is="...">).
 *
 * ✅ v9.0.0: добавлено поле `resolvedComponents` —
 * возможные значения expression (если удалось статически разрешить).
 */
export interface TemplateDynamicComponent {
  /** Выражение из :is / v-bind:is */
  isExpression: string;
  /** Строка */
  line: number;
  /** ✅ НОВОЕ v9.0.0: возможные значения expression (если удалось разрешить) */
  resolvedComponents?: string[];
}

export interface TemplateRefUsage {
  /** Значение ref="dataTable" */
  refValue: string;
  /** Тег */
  tag: string;
  /** Строка */
  line: number;
  /** Методы из defineExpose дочернего компонента */
  exposedMethods?: string[];
}

export interface TemplateCssVariable {
  /** Имя переменной: --blue-700 */
  name: string;
  /** Значение: #1a5fb4 (если есть) */
  value?: string;
  /** Строка */
  line: number;
  /** Многострочное значение */
  isMultiline?: boolean;
}

export interface TemplateDeepSelector {
  /** Селектор: .n-data-table-td */
  selector: string;
  /** Строка */
  line: number;
}

// ============================================
// ✅ НОВОЕ v9.0.0: CONDITIONALS
// ============================================

export type ConditionalDirective = 'v-if' | 'v-else-if' | 'v-else';

/**
 * Условный рендеринг в шаблоне Vue.
 */
export interface TemplateConditional {
  /** Уникальный ID (cd1, cd2, ...) */
  id: string;
  /** Директива условного рендеринга */
  directive: ConditionalDirective;
  /** ID файла */
  fileId: string;
  /** Номер строки */
  line: number;
  /** Условие (для v-if / v-else-if) */
  conditionExpression?: string;
  /** Компонент внутри ветки */
  renderedComponent?: string;
}

/**
 * Шаблон Vue-файла — отдельная сущность.
 *
 * Хранит ТОЛЬКО ссылки (имена), без дубликатов объектов.
 * Связи шаблона с функциями (event→handler, ref→expose)
 * восстанавливаются из CallData[] по именам.
 */
export interface TemplateData {
  /** ID файла (f1, f2, ...) */
  fileId: string;
  /** ID модуля (m1, m2, ...) */
  moduleId: string;
  /** root-идентификаторы шаблона (user, items, isLoading) */
  reactivityDeps: string[];
  /** Обработчики @click → handlerName */
  eventHandlers: TemplateEventHandler[];
  /** <component :is="..."> и v-bind:is */
  dynamicComponents: TemplateDynamicComponent[];
  /** Директивы (v-html, v-text, v-pre, v-once, v-memo, v-model, ...) */
  directives: string[];
  /** Использованные компоненты (PascalCase + kebab-case) */
  usedComponents: string[];
  /** Template refs */
  templateRefs: TemplateRefUsage[];
  /** CSS-переменные из <style> */
  cssVariables: TemplateCssVariable[];
  /** :deep() селекторы */
  deepSelectors: TemplateDeepSelector[];
  /** Слоты (из <slot name> и defineSlots<T>) */
  slots: string[];
  /** Сложность шаблона */
  complexity: number;
  /** ✅ НОВОЕ v9.0.0: условный рендеринг */
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

/**
 * Хук жизненного цикла Vue.
 */
export interface LifecycleHook {
  /** Уникальный ID (lc1, lc2, ...) */
  id: string;
  /** Имя хука */
  hookName: LifecycleHookName;
  /** ID функции, в которой вызван hook */
  functionId: string;
  /** Номер строки */
  line: number;
  /** ID функции-callback (если есть) */
  callbackFunctionId?: string;
  /** Контекст: setup / options-api */
  isSetupContext: boolean;
}

// ============================================
// ✅ НОВОЕ v9.0.0: EFFECTS
// ============================================

export type EffectType = 'timer' | 'cleanup' | 'promise' | 'event' | 'subscription';

/**
 * Ребро side-effect (setTimeout, clearTimeout, addEventListener, ...).
 */
export interface EffectEdge {
  /** Уникальный ID (ef1, ef2, ...) */
  id: string;
  /** Тип side-effect */
  effectType: EffectType;
  /** ID функции, в которой вызван эффект */
  functionId: string;
  /** Номер строки */
  line: number;
  /** Имя вызываемой функции (setTimeout / clearTimeout / addEventListener / ...) */
  targetName: string;
  /** Дополнительное значение (например, '1000' для debounce) */
  metaValue?: string;
}

// ============================================
// ✅ НОВОЕ v9.0.0: INJECTIONS
// ============================================

export type InjectionKind = 'provide' | 'inject';

/**
 * Ребро provide/inject.
 */
export interface InjectionEdge {
  /** Уникальный ID (in1, in2, ...) */
  id: string;
  /** Тип ребра */
  kind: InjectionKind;
  /** ID файла */
  fileId: string;
  /** Номер строки */
  line: number;
  /** Нормализованное имя ключа */
  key: string;
  /** Является ли ключ символьным (InjectionKey<T>) */
  isSymbolKey: boolean;
  /** Есть ли значение по умолчанию (для inject) */
  hasDefault: boolean;
}

// ============================================
// ✅ НОВОЕ v9.0.0: REACTIVITY
// ============================================

export type ReactivityKind =
  | 'computed'
  | 'watch'
  | 'watchEffect'
  | 'ref'
  | 'reactive'
  | 'shallowRef'
  | 'readonly';

/**
 * Ребро реактивной связи (computed/watch/ref/...).
 */
export interface ReactivityEdge {
  /** Уникальный ID (rx1, rx2, ...) */
  id: string;
  /** Тип реактивной связи */
  kind: ReactivityKind;
  /** ID функции */
  functionId: string;
  /** Номер строки */
  line: number;
  /** Имена реактивных полей, которые читаются */
  reads: string[];
  /** Имена реактивных полей, которые пишутся */
  writes: string[];
  /** Является ли writeable (для computed({get,set})) */
  isWriteable: boolean;
}

// ============================================
// ✅ НОВОЕ v9.0.0: TYPES
// ============================================

export type TypeKind = 'interface' | 'type-alias' | 'enum' | 'class';

/**
 * Узел тип-графа.
 */
export interface TypeNodeData {
  /** Уникальный ID (t1, t2, ...) */
  id: string;
  /** Вид типа */
  kind: TypeKind;
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

export type TypeUsageKind = 'param' | 'return' | 'field' | 'generic' | 'union' | 'extends';

/**
 * Ребро использования типа.
 */
export interface TypeRefData {
  /** Уникальный ID (tr1, tr2, ...) */
  id: string;
  /** Имя используемого типа */
  typeName: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки */
  line: number;
  /** Вид использования */
  usageKind: TypeUsageKind;
}

// ============================================
// СТАТИСТИКА
// ============================================

/**
 * Статистика по всему проекту.
 */
export interface StatisticsData {
  /** Общее количество модулей */
  totalModules: number;
  /** Общее количество файлов */
  totalFiles: number;
  /** Общее количество функций */
  totalFunctions: number;
  /** Общее количество классов */
  totalClasses: number;
  /** Общее количество констант */
  totalConstants: number;
  /** Общее количество экспортов */
  totalExports: number;
  /** Общее количество импортов */
  totalImports: number;
  /** Общее количество вызовов */
  totalCalls: number;
  /** Общее количество реэкспортов */
  totalReExports: number;
  /** Количество Vue-шаблонов */
  totalTemplates?: number;
}

// ============================================
// ЕДИНОЕ РЕБРО ГРАФА
// ============================================

/**
 * Единое ребро графа.
 * Позволяет строить любой граф фильтрацией по типу.
 * ⚠️ В compact.json НЕ хранится — восстанавливается из gr.*
 */
export interface EdgeData {
  /** Откуда (ID источника) */
  from: string;
  /** Куда (ID цели) */
  to: string;
  /** Тип связи */
  type: 'import' | 'export' | 'call' | 're-export';
  /** Имя символа (опционально) */
  symbol?: string;
  /** Номер строки (опционально) */
  line?: number;
}

// ============================================
// СЖАТЫЙ JSON (СТРАТЕГИЯ B — СТРОГИЙ ROUND-TRIP)
// ============================================

/**
 * Сжатый JSON — ПОЛНОСТЬЮ ОБРАТИМ.
 *
 * Формат кортежей (позиции фиксированы, см. legend.arraySchemas):
 *
 *   fns:   [id, name, moduleId, fileId, line, flags, paramsIdx[], returnTypeIdx]
 *   cls:   [id, name, moduleId, fileId, line, flags, methodsIdx[]]
 *   cn:    [id, name, moduleId, fileId, line, flags, valueIdx]
 *
 *   gr.e:  [moduleIdx, fileIdx, funcIdx, line, typeCode,
 *           exportNameIdx, localNameIdx, isTypeOnly,
 *           isReExport, sourceIdx]
 *   gr.i:  [fromFileIdx, toFileIdIdx, sourceIdx,
 *           importedNameIdx, localNameIdx, line,
 *           typeCode, isExternal]
 *   gr.c:  [fromIdx, toIdxOrExternalIdx, line, typeCode]
 *   gr.re: [moduleIdx, funcIdx, sourceIdx, exportNameIdx,
 *           line, typeCode, isTypeOnly]
 *
 *   vt:    [fileIdx, moduleIdx, complexity,
 *           reactivityDepsIdx[],
 *           eventHandlers: [eventNameIdx, handlerNameIdx, tagIdx, line,
 *                           modifiersIdx[], isExternal][],
 *           dynamicComponents: [isExpressionIdx, line, resolvedComponentsIdx[]][],
 *           directivesIdx[],
 *           usedComponentsIdx[],
 *           templateRefs: [refValueIdx, tagIdx, line, exposedMethodsIdx[]][],
 *           cssVariables: [nameIdx, valueIdx, line, isMultiline][],
 *           deepSelectors: [selectorIdx, line][],
 *           slotsIdx[]]
 *
 *   lc:    [hookCode, funcIdx, line, callbackFnIdx, flags]
 *   ef:    [effectCode, funcIdx, line, targetIdx, metaIdx]
 *   inj:   [kindCode, fileIdx, line, keyIdx, flags]
 *   rx:    [kindCode, funcIdx, line, readsIdx[], writesIdx[], flags]
 *   cd:    [directiveCode, fileIdx, line, condIdx, compIdx, flags]
 *   ty:    [kindCode, nameIdx, moduleIdx, fileIdx, line, membersIdx[], extendsIdx[]]
 *   tr:    [typeNameIdx, moduleIdx, fileIdx, line, usageCode]
 *
 * Все *Idx — индексы в legend.stringDict (кроме paramsIdx/methodsIdx/valueIdx).
 *   -1 означает undefined/null.
 *
 * ⚠️ edges НЕ хранятся — восстанавливаются из gr.i + gr.e + gr.c + gr.re.
 */
export interface CompactJSON {
  /** Version */
  v: string;
  /** Timestamp */
  ts: string;
  /** Root module ID */
  r: string;

  /**
   * Module index: id → { n: name, f: [fileIds] }
   */
  mi: Record<string, { n: string; f: string[] }>;

  /**
   * File index: id → { p: path, m: moduleId }
   */
  fl: Record<string, { p: string; m: string }>;

  /**
   * Functions:
   * [id, name, moduleId, fileId, line, flags, paramsIdx[], returnTypeIdx]
   */
  fns: [
    string,
    string,
    string,
    string,
    number,
    string,
    number[],
    number,
  ][];

  /**
   * Classes:
   * [id, name, moduleId, fileId, line, flags, methodsIdx[]]
   */
  cls: [
    string,
    string,
    string,
    string,
    number,
    string,
    number[],
  ][];

  /**
   * Constants:
   * [id, name, moduleId, fileId, line, flags, valueIdx]
   */
  cn: [
    string,
    string,
    string,
    string,
    number,
    string,
    number,
  ][];

  /** Graph — все связи в одном месте */
  gr: {
    /**
     * Exports:
     * [moduleIdx, fileIdx, funcIdx, line, typeCode,
     *  exportNameIdx, localNameIdx, isTypeOnly,
     *  isReExport, sourceIdx]
     */
    e: [
      number,
      number,
      number,
      number,
      string,
      number,
      number,
      number,
      number,
      number,
    ][];

    /**
     * Imports:
     * [fromFileIdx, toFileIdIdx, sourceIdx,
     *  importedNameIdx, localNameIdx, line,
     *  typeCode, isExternal]
     */
    i: [
      number,
      number,
      number,
      number,
      number,
      number,
      string,
      number,
    ][];

    /**
     * Calls:
     * [fromIdx, toIdxOrExternalIdx, line, typeCode]
     */
    c: [
      number,
      number,
      number,
      string,
    ][];

    /**
     * Re-exports:
     * [moduleIdx, funcIdx, sourceIdx, exportNameIdx,
     *  line, typeCode, isTypeOnly]
     */
    re: [
      number,
      number,
      number,
      number,
      number,
      string,
      number,
    ][];
  };

  /**
   * Vue templates.
   *
   * ✅ v9.0.0: dynamicComponents теперь 3-элементный:
   * [isExpressionIdx, line, resolvedComponentsIdx[]]
   */
  vt?: [
    number,
    number,
    number,
    number[],
    [number, number, number, number, number[], number][],
    [number, number, number[]][],
    number[],
    number[],
    [number, number, number, number[]][],
    [number, number, number, number][],
    [number, number][],
    number[],
  ][];

  /** Statistics */
  st: StatisticsData;

  /** Legend (dictionaries + schemas) */
  legend: CodecLegend;

  // ==========================================
  // ✅ НОВОЕ v9.0.0
  // ==========================================

  /**
   * Lifecycle:
   * [hookCode, funcIdx, line, callbackFnIdx, flags]
   */
  lc?: [string, number, number, number, string][];

  /**
   * Effects:
   * [effectCode, funcIdx, line, targetIdx, metaIdx]
   */
  ef?: [string, number, number, number, number][];

  /**
   * Injections:
   * [kindCode, fileIdx, line, keyIdx, flags]
   */
  inj?: [string, number, number, number, number][];

  /**
   * Reactivity:
   * [kindCode, funcIdx, line, readsIdx[], writesIdx[], flags]
   */
  rx?: [string, number, number, number[], number[], number][];

  /**
   * Conditionals:
   * [directiveCode, fileIdx, line, condIdx, compIdx, flags]
   */
  cd?: [string, number, number, number, number, number][];

  /**
   * Types:
   * [kindCode, nameIdx, moduleIdx, fileIdx, line, membersIdx[], extendsIdx[]]
   */
  ty?: [string, number, number, number, number, number[], number[]][];

  /**
   * Type refs:
   * [typeNameIdx, moduleIdx, fileIdx, line, usageCode]
   */
  tr?: [number, number, number, number, string][];

  // ⚠️ НЕТ поля `edges` — восстанавливается при decode из gr.*
}

// ============================================
// ЛЕГЕНДА (ДЛЯ ДЕКОДИРОВАНИЯ)
// ============================================

/**
 * Легенда — все словари и карты, необходимые для декодирования.
 * Встраивается в CompactJSON, чтобы декодер мог работать автономно.
 */
export interface CodecLegend {
  // ============================================
  // КАРТЫ ФЛАГОВ
  // ============================================

  /** Карта флагов: символ → строковое имя бита */
  flagMap: Record<string, string>;
  /** Карта флагов: символ → числовое значение бита */
  flagCharMap: Record<string, number>;

  // ============================================
  // ТИПЫ СВЯЗЕЙ
  // ============================================

  /** Типы связей (общие) */
  relationTypes: Record<string, string>;
  /** Типы экспортов: 'ne' | 'de' | 'te' | 're' */
  exportTypes: Record<string, string>;
  /** Типы импортов: 'n' | 'df' | 'ns' | 'to' */
  importTypes: Record<string, string>;
  /** Типы вызовов: 'd' | 'a' | 'm' | 'c' | 'e' */
  callTypes: Record<string, string>;
  /** Типы реэкспортов: 'n' | 'df' | 'all' */
  reExportTypes: Record<string, string>;

  // ============================================
  // ✅ НОВОЕ v9.0.0: СЛОВАРИ ТИПОВ
  // ============================================

  /** Типы lifecycle-хуков */
  lifecycleTypes: Record<string, string>;
  /** Типы side-effects */
  effectTypes: Record<string, string>;
  /** Типы provide/inject */
  injectionTypes: Record<string, string>;
  /** Типы реактивных связей */
  reactivityTypes: Record<string, string>;
  /** Типы условного рендеринга */
  conditionalTypes: Record<string, string>;
  /** Виды типов */
  typeKinds: Record<string, string>;
  /** Виды использования типов */
  typeUsageKinds: Record<string, string>;

  // ============================================
  // ПОЗИЦИОННЫЕ СХЕМЫ МАССИВОВ
  // ============================================

  /**
   * Позиционные схемы для декодирования кортежей.
   * Ключ — имя массива, значение — массив имён полей по позициям.
   */
  arraySchemas: {
    /** fns: [id, name, moduleId, fileId, line, flags, paramsIdx, returnTypeIdx] */
    fns: string[];
    /** cls: [id, name, moduleId, fileId, line, flags, methodsIdx] */
    cls: string[];
    /** cn: [id, name, moduleId, fileId, line, flags, valueIdx] */
    cn: string[];
    /** gr.e: 10 полей */
    'gr.e': string[];
    /** gr.i: 8 полей */
    'gr.i': string[];
    /** gr.c: 4 поля */
    'gr.c': string[];
    /** gr.re: 7 полей */
    'gr.re': string[];
    /** vt — 12 полей */
    vt: string[];
    /** vt.eventHandlers — 6 полей */
    'vt.eventHandlers': string[];
    /** ✅ v9.0.0: vt.dynamicComponents — 3 поля */
    'vt.dynamicComponents': string[];
    /** vt.templateRefs — 4 поля */
    'vt.templateRefs': string[];
    /** vt.cssVariables — 4 поля */
    'vt.cssVariables': string[];
    /** vt.deepSelectors — 2 поля */
    'vt.deepSelectors': string[];

    // ============================================
    // ✅ НОВОЕ v9.0.0: СХЕМЫ
    // ============================================

    /** lc: 5 полей */
    lc: string[];
    /** ef: 5 полей */
    ef: string[];
    /** inj: 5 полей */
    inj: string[];
    /** rx: 6 полей */
    rx: string[];
    /** cd: 6 полей */
    cd: string[];
    /** ty: 7 полей */
    ty: string[];
    /** tr: 5 полей */
    tr: string[];
  };

  // ============================================
  // СЛОВАРИ (для обратимого сжатия)
  // ============================================

  /**
   * Словарь всех уникальных строк.
   * Используется для:
   *   - returnType (functions)
   *   - exportName, localName, source (exports)
   *   - toFileId, source, importedName, localName (imports)
   *   - external:* (calls)
   *   - source, exportName (reExports)
   *   - reactivityDeps, eventName, handlerName, tag,
   *     isExpression, resolvedComponents, directives, usedComponents,
   *     refValue, exposedMethods, cssVariable name/value,
   *     deepSelector, slots (templates)
   *   - targetName, metaValue (effects)
   *   - key (injections)
   *   - reads, writes (reactivity)
   *   - conditionExpression, renderedComponent (conditionals)
   *   - name, members, extendsTypes (types)
   *   - typeName (typeRefs)
   */
  stringDict: string[];

  /**
   * Словарь имён параметров функций.
   * Используется в fns.paramsIdx[]
   */
  paramDict: string[];

  /**
   * Словарь имён методов классов.
   * Используется в cls.methodsIdx[]
   */
  methodDict: string[];

  /**
   * Словарь значений констант.
   * Может содержать примитивы, массивы, объекты.
   * Используется в cn.valueIdx.
   */
  valueDict: unknown[];
}

// ============================================
// ОПЦИИ ГЕНЕРАЦИИ ОТЧЁТА (унифицированы в v9.0.0)
// ============================================

/**
 * Опции для генерации отчёта.
 *
 * ✅ УНИФИЦИРОВАНО v9.0.0: объединены поля из
 *    compact-reporter.ts и codec-types.ts (устранён TS2300).
 */
export interface GenerateReportOptions {
  /** Путь к выходному файлу (сжатый JSON) */
  outputPath?: string;
  /** Использовать сжатие (по умолчанию: true) */
  compress?: boolean;
  /** Сохранять полный JSON для отладки (по умолчанию: true) */
  saveFullJson?: boolean;
  /** @deprecated используйте saveFullJson */
  saveFull?: boolean;
  /** Дополнительный суффикс для полного JSON (по умолчанию: '.full.json') */
  fullJsonSuffix?: string;
  /** Подробный вывод (по умолчанию: false) */
  verbose?: boolean;
  /** Использовать ли битовые флаги (по умолчанию: true) */
  useBitFlags?: boolean;
  /** Использовать ли словари (по умолчанию: true) */
  useDictionaries?: boolean;
}

// ============================================
// РЕЗУЛЬТАТ ГЕНЕРАЦИИ ОТЧЁТА (унифицирован v9.0.0)
// ============================================

/**
 * Результат генерации отчёта.
 *
 * ✅ УНИФИЦИРОВАНО v9.0.0: объединены поля из
 *    compact-reporter.ts и codec-types.ts (устранён TS2300).
 */
export interface GenerateReportResult {
  /** Полный (читаемый) JSON */
  full: FullJSON;
  /** Сжатый JSON (если compress: true) */
  compact?: CompactJSON;
  /** Путь к сохранённому сжатому файлу */
  compactPath?: string;
  /** Путь к сохранённому полному файлу */
  fullPath?: string;
  /** Статистика генерации */
  stats: {
    /** Длительность в миллисекундах */
    duration: number;
    /** Размер сжатого файла в байтах */
    compactSize?: number;
    /** Размер полного файла в байтах */
    fullSize?: number;
    /** Коэффициент сжатия (%) */
    compressionRatio?: number;
  };
  /** @deprecated используйте stats */
  compressionStats?: {
    fullSize: number;
    compactSize: number;
    ratio: number;
    savedPercent: number;
  };
}

// ============================================
// ОПЦИИ ДЕКОДИРОВАНИЯ (v3.1.0)
// ============================================

/**
 * Опции для Codec.decode().
 *
 * Позволяют управлять тем, какие производные поля
 * восстанавливаются при декодировании CompactJSON → FullJSON.
 *
 * @example
 * ```ts
 * // Декодировать без агрегированного графа edges
 * const full = Codec.decode(compact, { includeEdges: false });
 * ```
 */
export interface DecodeOptions {
  /**
   * Включать ли агрегированный массив `edges` в результат.
   *
   * - `true` (по умолчанию) — `edges` собирается из `gr.*`
   * - `false` — `edges` будет `undefined`, что экономит память
   *   и время при работе с большими отчётами
   *
   * @default true
   */
  includeEdges?: boolean;

  /**
   * Включать ли пустые массивы (`modules`, `files`, ...) в результат.
   *
   * - `true` (по умолчанию) — все секции присутствуют, даже если пустые
   * - `false` — пустые секции не добавляются в результат
   *
   * @default true
   */
  includeEmptyArrays?: boolean;

  /**
   * Включать ли поле `statistics` в результат.
   *
   * - `true` (по умолчанию) — статистика копируется из `st`
   * - `false` — `statistics` не добавляется
   *
   * @default true
   */
  includeStatistics?: boolean;
}

// ============================================
// РЕЗУЛЬТАТ ПРОВЕРКИ ОБРАТИМОСТИ
// ============================================

/**
 * Результат проверки обратимости (round-trip).
 */
export interface RoundTripResult {
  /** Успешно ли прошла проверка */
  ok: boolean;
  /** Ошибка, если есть */
  error?: string;
  /** Детали расхождений */
  details?: {
    /** Расхождение в количестве функций */
    functionsDiff?: number;
    /** Расхождение в количестве экспортов */
    exportsDiff?: number;
    /** Расхождение в количестве реэкспортов */
    reExportsDiff?: number;
    /** Расхождение в количестве вызовов */
    callsDiff?: number;
    /** Расхождение в количестве шаблонов */
    templatesDiff?: number;
    /** ✅ v9.0.0: расхождение в lifecycle */
    lifecycleDiff?: number;
    /** ✅ v9.0.0: расхождение в effects */
    effectsDiff?: number;
    /** ✅ v9.0.0: расхождение в injections */
    injectionsDiff?: number;
    /** ✅ v9.0.0: расхождение в reactivity */
    reactivityDiff?: number;
    /** ✅ v9.0.0: расхождение в conditionals */
    conditionalsDiff?: number;
    /** ✅ v9.0.0: расхождение в types */
    typesDiff?: number;
    /** ✅ v9.0.0: расхождение в typeRefs */
    typeRefsDiff?: number;
  };
}

// ============================================
// ТИПЫ ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ
// ============================================

/**
 * Расширенная информация о функции (для внутреннего использования).
 */
export interface ExtendedFunctionData extends FunctionData {
  /** Уникальный ключ (moduleId:fileId:name) */
  _uniqueKey?: string;
  /** Полный путь к файлу */
  _fullPath?: string;
  /** Модуль (директория) */
  _moduleDir?: string;
  /** Тело функции (опционально) */
  _body?: string;
  /** Сложность (опционально) */
  _complexity?: number;
  /** Безопасность (опционально) */
  _security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
}

/**
 * Расширенная информация об экспорте (для внутреннего использования).
 */
export interface ExtendedExportData extends ExportData {
  /** Является ли реэкспортом */
  _isReExport?: boolean;
  /** Источник реэкспорта */
  _source?: string;
  /** Локальное имя в исходном модуле */
  _localName?: string;
}

/**
 * Расширенная информация об импорте (для внутреннего использования).
 */
export interface ExtendedImportData extends ImportData {
  /** Структурированные specifiers (если их несколько) */
  _specifiersStructured?: {
    imported: string;
    local: string;
    type: string;
  }[];
  /** Привязан ли импорт к конкретной функции/классу */
  _boundTo?: string;
  /** Строки использования импорта в файле */
  _usageLines?: number[];
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  // Все типы экспортируются автоматически через `export interface`
  // Этот default-экспорт нужен только для обратной совместимости
};
