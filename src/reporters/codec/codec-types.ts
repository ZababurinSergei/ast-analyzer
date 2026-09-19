// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (Стратегия B — строгий round-trip)
// ============================================
// Версия: 10.4.1
//
// ИЗМЕНЕНИЯ v10.4.1 (безопасное сокращение):
//   - ✅ УДАЛЕНЫ 5 полей `description` из интерфейса CodecLegend:
//       • legend.flags.description
//       • legend.codes.description
//       • legend.dictionaries.description
//       • legend.schemas.description
//     Причина: текстовые пояснения не несут данных.
//   - ✅ СОХРАНЕНО БЕЗ ИЗМЕНЕНИЙ:
//       • legend.flags.bits
//       • legend.flags.examples
//       • legend.codes.*
//       • legend.dictionaries.*
//       • legend.schemas.*
//       • legend.how_to_read
//     Это критично для round-trip и самодостаточности ИИ.
//   - ✅ ОБРАТНАЯ СОВМЕСТИМОСТЬ: сохранена.
//
// ИЗМЕНЕНИЯ v10.4.0 (легенда для ИИ):
//   - ✅ ПЕРЕСТРОЕН CodecLegend:
//       было:  flagMap, flagCharMap, relationTypes, exportTypes,
//              importTypes, callTypes, reExportTypes, lifecycleTypes,
//              effectTypes, injectionTypes, reactivityTypes,
//              conditionalTypes, typeKinds, typeUsageKinds,
//              stringDict, paramDict, methodDict, valueDict,
//              arraySchemas
//       стало: how_to_read, flags, codes, dictionaries, schemas
//   - ✅ ДОБАВЛЕНЫ типы: FlagBit, CodesDict
//   - ✅ ДОБАВЛЕНА секция how_to_read — пошаговая инструкция для ИИ
//   - ✅ Флаги переехали в legend.flags.{bits, examples}
//   - ✅ Коды типов переехали в legend.codes.{export, import, call,
//       reExport, lifecycle, effect, injection, reactivity,
//       conditional, typeKind, typeUsage}
//   - ✅ Словари переехали в legend.dictionaries.{stringDict,
//       paramDict, methodDict, valueDict}
//   - ✅ Схемы кортежей переехали в legend.schemas.{fns, cls, cn,
//       gr.e, gr.i, gr.c, gr.re, vt, ..., ty, tr}
//
// ИЗМЕНЕНИЯ v9.0.6 (синхронизация с src/types.ts):
//   - ✅ ИСПРАВЛЕНО: путь импорта '../../../types.js' → '../../types.js'
//   - ✅ ИСПРАВЛЕНО: TemplateRefUsage реэкспортируется из '../../types.js'
//   - ✅ ИСПРАВЛЕНО: TemplateConditional реэкспортируется из '../../types.js'
//   - ✅ ИСПРАВЛЕНО: TemplateEventHandler реэкспортируется из '../../types.js'
//   - ✅ ИСПРАВЛЕНО: TemplateDynamicComponent реэкспортируется из '../../types.js'
//   - ✅ ИСПРАВЛЕНО: TemplateCssVariable и TemplateDeepSelector реэкспортируются
//   - ✅ ДОБАВЛЕНО: ConditionalDirective — type alias
//
// ИЗМЕНЕНИЯ v9.0.5:
//   - ✅ ДОБАВЛЕНО: DecodeOptions.includeEdges по умолчанию false.
//   - ✅ ДОБАВЛЕНО: GenerateReportOptions.saveEdges и edgesJsonSuffix.
//   - ✅ ДОБАВЛЕНО: GenerateReportResult.edgesPath и stats.edgesSize.
//
// ИЗМЕНЕНИЯ v9.0.3:
//   - ✅ CompactJSON.gr.c: 4 → 5 полей (isExternal).
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ ДОБАВЛЕНЫ: LifecycleHook, EffectEdge, InjectionEdge, ReactivityEdge,
//     TemplateConditional, TypeNodeData, TypeRefData и связанные типы.
//   - ✅ РАСШИРЕН: FullJSON (7 новых опциональных секций).
//   - ✅ РАСШИРЕН: CompactJSON (lc, ef, inj, rx, cd, ty, tr).
//   - ✅ РАСШИРЕН: CodecLegend (7 новых словарей + 7 новых схем).
// ============================================

// ============================================================
// РЕЭКСПОРТ TEMPLATE-ТИПОВ ИЗ src/types.ts
// ============================================================
// ⚠️ ВАЖНО: эти типы теперь живут в src/types.ts,
// а не здесь. Это устраняет дублирование определений
// между codec-types.ts и src/types.ts.
//
// ✅ ИСПРАВЛЕНО v9.0.6: путь '../../types.js' (было '../../../types.js')
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
// ✅ ИСПРАВЛЕНО v9.0.6: путь '../../types.js'
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
// ✅ ДОБАВЛЕНО v9.0.6: тип директивы условного рендеринга.
// Используется в TemplateConditional['directive'].
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
     *
     * ✅ v9.0.5: НЕ хранится в compact.json и НЕ восстанавливается
     *   по умолчанию при decode. Если нужен — передайте
     *   `{ includeEdges: true }` в DecodeOptions или используйте
     *   `saveEdges: true` в GenerateReportOptions (сохраняется
     *   в отдельный файл `*.edges.json`).
     *
     * ⚠️ По спецификации v9.0.x это ПОЛЕ ПРОИЗВОДНОЕ —
     *   оно собирается из gr.i + gr.e + gr.c + gr.re и не должно
     *   храниться в full.json (иначе DL падает).
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
 *
 * ✅ ИЗМЕНЕНО v9.0.6: methods теперь допускает null.
 *   Причина: extractEntitiesFromAST может вернуть null для
 *   безымянных методов/геттеров/сеттеров, и full.json
 *   сохраняет это как null. Раньше decode возвращал "",
 *   что ломало DL (decode(encode(full)) === full).
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
    /** Методы класса (null для безымянных) */
    methods: (string | null)[];
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
 *
 * ✅ v9.0.4: тип вызова сохраняется для ВСЕХ вызовов,
 *   включая external. Признак external передаётся отдельным
 *   полем в CompactJSON.gr.c (isExternal).
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
    /**
     * Тип вызова.
     *
     * ✅ v9.0.4: тип вызова ортогонален признаку external —
     *   external-вызов может быть 'direct' | 'async' | 'method' | 'callback'.
     *   Признак external хранится отдельно (в compact — 5-е поле gr.c).
     */
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
//
// ⚠️ ВАЖНО: TemplateEventHandler, TemplateDynamicComponent,
//   TemplateRefUsage, TemplateCssVariable, TemplateDeepSelector,
//   TemplateConditional — реэкспортированы из '../../types.js'
//   в начале этого файла (устраняет дублирование).
// ============================================

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
    /**
     * ✅ v9.0.0: условный рендеринг.
     *
     * ⚠️ СИНХРОНИЗИРОВАНО: используется TemplateConditional
     * из '../../types.js' (с id?/fileId?), а НЕ локальное
     * определение.
     */
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
 * ⚠️ ✅ v9.0.5: НЕ добавляется в full.json по умолчанию —
 *    только если передан `{ includeEdges: true }` в DecodeOptions.
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
 * Формат кортежей (позиции фиксированы, см. legend.schemas):
 *
 *   fns:   [id, name, moduleId, fileId, line, flags, paramsIdx[], returnTypeIdx]
 *   cls:   [id, name, moduleId, fileId, line, flags, methodsIdx[]]
 *   cn:    [id, name, moduleId, fileId, line, flags, valueIdx]
 *
 *   gr.e:  [moduleIdx, fileIdx, funcIdx, line, typeCode,
 *           exportNameIdx, localNameIdx, isTypeOnly,
 *           isReExport, sourceIdx, isStarReExport, isDefaultReExport]
 *   gr.i:  [fromFileIdx, toFileIdIdx, sourceIdx,
 *           importedNameIdx, localNameIdx, line,
 *           typeCode, isExternal]
 *   gr.c:  [fromIdx, toIdx, line, typeCode, isExternal]
 *          isExternal: 0 — toIdx это functionIdx
 *                      1 — toIdx это stringDictIdx (external:...)
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
 * Все *Idx — индексы в legend.dictionaries.stringDict
 * (кроме paramsIdx/methodsIdx/valueIdx).
 *   -1 означает undefined/null.
 *
 * ⚠️ edges НЕ хранятся — восстанавливаются из gr.i + gr.e + gr.c + gr.re
 *    (и только если includeEdges: true при decode).
 */
export interface CompactJSON {
    /** Version */
    v: string;
    /** Timestamp */
    ts: string;
    /** Root module ID */
    r: string;

    /**
     * Module index: id → { n: name, p: path, f: [fileIds] }
     */
    mi: Record<string, { n: string; p: string; f: string[] }>;

    /**
     * File index: id → { p: path, m: moduleId }
     */
    fl: Record<string, { p: string; m: string }>;

    /**
     * Functions:
     * [id, name, moduleId, fileId, line, flags, paramsIdx[], returnTypeIdx]
     */
    fns: [string, string, string, string, number, string, number[], number][];

    /**
     * Classes:
     * [id, name, moduleId, fileId, line, flags, methodsIdx[]]
     */
    cls: [string, string, string, string, number, string, number[]][];

    /**
     * Constants:
     * [id, name, moduleId, fileId, line, flags, valueIdx]
     */
    cn: [string, string, string, string, number, string, number][];

    /** Graph — все связи в одном месте */
    gr: {
        /**
         * Exports:
         * [moduleIdx, fileIdx, funcIdx, line, typeCode,
         *  exportNameIdx, localNameIdx, isTypeOnly,
         *  isReExport, sourceIdx, isStarReExport, isDefaultReExport]
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
            number, // isStarReExport
            number, // isDefaultReExport
        ][];

        /**
         * Imports:
         * [fromFileIdx, toFileIdIdx, sourceIdx,
         *  importedNameIdx, localNameIdx, line,
         *  typeCode, isExternal]
         */
        i: [number, number, number, number, number, number, string, number][];

        /**
         * Calls:
         * [fromIdx, toIdx, line, typeCode, isExternal]
         *
         *   isExternal === 0 → toIdx это индекс функции (functionReverse)
         *   isExternal === 1 → toIdx это индекс строки в stringDict
         *                      (значение начинается с 'external:')
         *
         * ✅ v9.0.4: typeCode (4-е поле) — РЕАЛЬНЫЙ тип вызова, включая
         *   external-вызовы. Он НЕ принудительно 'd'. Признак external —
         *   отдельное поле isExternal (5-е).
         */
        c: [
            number, // fromIdx
            number, // toIdx (functionIdx ИЛИ stringDictIdx)
            number, // line
            string, // typeCode
            number, // isExternal (0 | 1)
        ][];

        /**
         * Re-exports:
         * [moduleIdx, funcIdx, sourceIdx, exportNameIdx,
         *  line, typeCode, isTypeOnly]
         */
        re: [number, number, number, number, number, string, number][];
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

    /** Legend (dictionaries + schemas + codes + flags + how_to_read) */
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

// ============================================================
// ЛЕГЕНДА (v10.4.1) — САМОДОСТАТОЧНАЯ ДЛЯ ИИ
// ============================================================
//
// Структура:
//   how_to_read  — пошаговая инструкция для ИИ (сокращена)
//   flags        — расшифровка битовых флагов
//   codes        — расшифровка строковых кодов
//   dictionaries — словари значений
//   schemas      — позиционные схемы кортежей
//
// ИЗМЕНЕНИЯ v10.4.1:
//   - ✅ УДАЛЕНЫ 5 полей `description`:
//       • legend.flags.description
//       • legend.codes.description
//       • legend.dictionaries.description
//       • legend.schemas.description
//     Причина: текстовые пояснения не несут данных.
//   - ✅ СОХРАНЕНО БЕЗ ИЗМЕНЕНИЙ:
//       • legend.how_to_read
//       • legend.flags.bits
//       • legend.flags.examples
//       • legend.codes.*
//       • legend.dictionaries.*
//       • legend.schemas.*
//
// ⚠️ УДАЛЕНО (v10.4.0):
//   - flagMap, flagCharMap        — дубликаты flags.bits
//   - relationTypes, exportTypes, importTypes, callTypes,
//     reExportTypes, lifecycleTypes, effectTypes,
//     injectionTypes, reactivityTypes, conditionalTypes,
//     typeKinds, typeUsageKinds   — переехали в codes.*
//   - stringDict, paramDict,
//     methodDict, valueDict       — переехали в dictionaries.*
//   - arraySchemas                — переехало в schemas.*
// ============================================================

/**
 * Один бит в поле flags.
 *
 * Пример:
 *   {
 *     bit: 2,
 *     name: "isExported",
 *     description: "Экспортируется"
 *   }
 */
export interface FlagBit {
    /** Числовое значение бита */
    bit: number;
    /** Имя поля (isAsync, isExported, ...) */
    name: string;
    /** Человекочитаемое описание */
    description: string;
}

/**
 * Словарь { код: описание }.
 *
 * Пример:
 *   { ne: "named (именованный экспорт)", de: "default (экспорт по умолчанию)" }
 */
export interface CodesDict {
    [code: string]: string;
}

/**
 * Легенда — все словари и схемы, необходимые
 * для декодирования и для чтения ИИ.
 *
 * ✅ Структура v10.4.1:
 *   how_to_read  — массив строк с пошаговой инструкцией
 *   flags        — расшифровка флагов (bits + examples)
 *   codes        — расшифровка кодов типов
 *   dictionaries — словари значений
 *   schemas      — позиционные схемы кортежей
 *
 * ⚠️ ВАЖНО: все секции (кроме `description`) сохранены.
 *    Это критично для round-trip и самодостаточности ИИ.
 */
export interface CodecLegend {
    // ==========================================
    // 1. ИНСТРУКЦИЯ ДЛЯ ИИ
    // ==========================================
    /**
     * Пошаговая инструкция: как развернуть кортежи в объекты.
     *
     * Содержит:
     *   - общий алгоритм развёртки
     *   - описание словарей (dictionaries.*)
     *   - описание кодов типов (codes.*)
     *   - описание флагов (flags.*)
     *   - полный пример развёртки одного кортежа fns[0]
     *   - связи между секциями (mi → fns[2], fl → fns[3], ...)
     *
     * ✅ v10.4.1: сокращено с ~4 КБ до ~1.2 КБ.
     */
    how_to_read: string[];

    // ==========================================
    // 2. РАСШИФРОВКА ФЛАГОВ
    // ==========================================
    /**
     * Расшифровка битовых флагов в поле flags.
     *
     * Поле flags — это строка символов, каждый символ — установленный
     * бит. Например, "ae" = isAsync + isExported.
     *
     * Использование:
     *   flags.bits[char] → { bit, name, description }
     *   flags.examples   → примеры разбора
     *
     * ✅ v10.4.1: поле `description` удалено.
     */
    flags: {
        /** Символ → { bit, name, description } */
        bits: Record<string, FlagBit>;
        /** Примеры разбора: 'ar' → 'isAsync=true, isArrow=true' */
        examples: Record<string, string>;
    };

    // ==========================================
    // 3. РАСШИФРОВКА КОДОВ ТИПОВ
    // ==========================================
    /**
     * Расшифровка строковых кодов в кортежах.
     *
     * Использование:
     *   gr.e[4]  typeCode → codes.export[typeCode]
     *   gr.i[6]  typeCode → codes.import[typeCode]
     *   gr.c[3]  typeCode → codes.call[typeCode]
     *   gr.re[5] typeCode → codes.reExport[typeCode]
     *   lc[0]    hookCode → codes.lifecycle[hookCode]
     *   ef[0]    effectCode → codes.effect[effectCode]
     *   inj[0]   kindCode → codes.injection[kindCode]
     *   rx[0]    kindCode → codes.reactivity[kindCode]
     *   cd[0]    directiveCode → codes.conditional[directiveCode]
     *   ty[0]    kindCode → codes.typeKind[kindCode]
     *   tr[4]    usageCode → codes.typeUsage[usageCode]
     *
     * ✅ v10.4.1: поле `description` удалено.
     */
    codes: {
        /** Коды экспортов: ne=named, de=default, te=type, re=re-export */
        export: CodesDict;
        /** Коды импортов: n=named, df=default, ns=namespace, to=type */
        import: CodesDict;
        /** Коды вызовов: d=direct, a=async, m=method, c=callback */
        call: CodesDict;
        /** Коды реэкспортов: n=named, df=default, all=export * */
        reExport: CodesDict;
        /** Коды lifecycle-хуков: m=onMounted, u=onUnmounted, ... */
        lifecycle: CodesDict;
        /** Коды эффектов: t=timer, c=cleanup, p=promise, e=event, s=subscription */
        effect: CodesDict;
        /** Коды provide/inject: p=provide, i=inject */
        injection: CodesDict;
        /** Коды реактивности: c=computed, w=watch, r=ref, ... */
        reactivity: CodesDict;
        /** Коды условного рендеринга: i=v-if, e=v-else-if, E=v-else */
        conditional: CodesDict;
        /** Коды типов: i=interface, t=type-alias, e=enum, c=class */
        typeKind: CodesDict;
        /** Коды использования типов: p=param, r=return, f=field, ... */
        typeUsage: CodesDict;
    };

    // ==========================================
    // 4. СЛОВАРИ ЗНАЧЕНИЙ
    // ==========================================
    /**
     * Все *Idx в кортежах — это индексы в этих массивах.
     * Индекс -1 означает null/undefined.
     *
     * Использование:
     *   fns[N][6] paramsIdx[]    → dictionaries.paramDict
     *   cls[N][6] methodsIdx[]   → dictionaries.methodDict
     *   cn[N][6]  valueIdx       → dictionaries.valueDict
     *   все остальные *Idx       → dictionaries.stringDict
     *
     * ✅ v10.4.1: поле `description` удалено.
     */
    dictionaries: {
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
         * Используется в fns.paramsIdx[].
         */
        paramDict: string[];
        /**
         * Словарь имён методов классов.
         * Используется в cls.methodsIdx[].
         */
        methodDict: string[];
        /**
         * Словарь значений констант.
         * Может содержать примитивы, массивы, объекты.
         * Используется в cn.valueIdx.
         */
        valueDict: unknown[];
    };

    // ==========================================
    // 5. ПОЗИЦИОННЫЕ СХЕМЫ КОРТЕЖЕЙ
    // ==========================================
    /**
     * Позиционные схемы кортежей. Каждое имя = индекс в кортеже.
     * Используется вместе с dictionaries и codes для полной развёртки.
     *
     * Пример:
     *   schemas.fns = [id, name, moduleId, fileId, line, flags, paramsIdx, returnTypeIdx]
     *   кортеж fns[0] = ["fn1", "escapeHtml", "m1", "f1", 10, "e", [0], -1]
     *   →
     *   {
     *     id: "fn1",
     *     name: "escapeHtml",
     *     moduleId: "m1",
     *     fileId: "f1",
     *     line: 10,
     *     flags: "e" → flags.bits["e"] → { isExported: true },
     *     paramsIdx: [0] → dictionaries.paramDict[0] = "str",
     *     returnTypeIdx: -1 → undefined
     *   }
     *
     * ✅ v10.4.1: поле `description` удалено.
     */
    schemas: {
        /** Схема fns: 8 полей */
        fns: string[];
        /** Схема cls: 7 полей */
        cls: string[];
        /** Схема cn: 7 полей */
        cn: string[];
        /** Схема gr.e: 12 полей */
        'gr.e': string[];
        /** Схема gr.i: 8 полей */
        'gr.i': string[];
        /** Схема gr.c: 5 полей */
        'gr.c': string[];
        /** Схема gr.re: 7 полей */
        'gr.re': string[];
        /** Схема vt: 12 полей */
        vt: string[];
        /** Схема vt.eventHandlers: 6 полей */
        'vt.eventHandlers': string[];
        /** Схема vt.dynamicComponents: 3 поля */
        'vt.dynamicComponents': string[];
        /** Схема vt.templateRefs: 4 поля */
        'vt.templateRefs': string[];
        /** Схема vt.cssVariables: 4 поля */
        'vt.cssVariables': string[];
        /** Схема vt.deepSelectors: 2 поля */
        'vt.deepSelectors': string[];
        /** Схема lc: 5 полей */
        lc: string[];
        /** Схема ef: 5 полей */
        ef: string[];
        /** Схема inj: 5 полей */
        inj: string[];
        /** Схема rx: 6 полей */
        rx: string[];
        /** Схема cd: 6 полей */
        cd: string[];
        /** Схема ty: 7 полей */
        ty: string[];
        /** Схема tr: 5 полей */
        tr: string[];
    };
}

// ============================================
// ОПЦИИ ГЕНЕРАЦИИ ОТЧЁТА (унифицированы в v9.0.0)
// ============================================

/**
 * Опции для генерации отчёта.
 *
 * ✅ УНИФИЦИРОВАНО v9.0.0: объединены поля из
 *    compact-reporter.ts и codec-types.ts (устранён TS2300).
 *
 * ✅ v9.0.5: добавлены saveEdges и edgesJsonSuffix.
 *
 * ✅ v10.4.0: добавлены saveAIReport и aiJsonSuffix (для будущего).
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

    // ==========================================
    // ✅ v9.0.5: edges — в отдельный файл, по умолчанию выключено
    // ==========================================

    /**
     * Сохранять ли агрегированный массив edges в отдельный файл.
     *
     * - `false` (по умолчанию) — edges НЕ сохраняются.
     *   Это соответствует спецификации v9.0.x: edges — производное поле,
     *   его можно собрать из gr.i + gr.e + gr.c + gr.re при необходимости.
     * - `true` — edges восстанавливаются через
     *   `Codec.decode(compact, { includeEdges: true })` и сохраняются
     *   в файл с суффиксом edgesJsonSuffix.
     *
     * @default false
     */
    saveEdges?: boolean;

    /**
     * Суффикс для файла с edges (по умолчанию: '.edges.json').
     *
     * Пример: для outputPath='index.json' edges будут в 'index.edges.json'.
     *
     * @default '.edges.json'
     */
    edgesJsonSuffix?: string;
}

// ============================================
// РЕЗУЛЬТАТ ГЕНЕРАЦИИ ОТЧЁТА (унифицирован v9.0.0)
// ============================================

/**
 * Результат генерации отчёта.
 *
 * ✅ УНИФИЦИРОВАНО v9.0.0: объединены поля из
 *    compact-reporter.ts и codec-types.ts (устранён TS2300).
 *
 * ✅ v9.0.5: добавлено edgesPath и stats.edgesSize.
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
    /** ✅ v9.0.5: путь к сохранённому файлу edges (если saveEdges: true) */
    edgesPath?: string;
    /** Статистика генерации */
    stats: {
        /** Длительность в миллисекундах */
        duration: number;
        /** Размер сжатого файла в байтах */
        compactSize?: number;
        /** Размер полного файла в байтах */
        fullSize?: number;
        /** ✅ v9.0.5: размер файла edges в байтах */
        edgesSize?: number;
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
// ОПЦИИ ДЕКОДИРОВАНИЯ (v3.1.0 → v9.0.5)
// ============================================

/**
 * Опции для Codec.decode().
 *
 * Позволяют управлять тем, какие производные поля
 * восстанавливаются при декодировании CompactJSON → FullJSON.
 *
 * ✅ v9.0.5: includeEdges по умолчанию false.
 *    Поле edges — производное (восстанавливается из gr.i + gr.e + gr.c + gr.re),
 *    поэтому по умолчанию НЕ добавляется в результат.
 *    Это устраняет расхождение при DL (decode(encode(full)) === full),
 *    когда исходный full не содержит edges (как и должно быть).
 *
 * @example
 * ```ts
 * // Декодировать без агрегированного графа edges (по умолчанию)
 * const full = Codec.decode(compact);
 *
 * // Декодировать с edges (для отдельного файла *.edges.json)
 * const fullWithEdges = Codec.decode(compact, { includeEdges: true });
 * ```
 */
export interface DecodeOptions {
    /**
     * Включать ли агрегированный массив `edges` в результат.
     *
     * - `false` (по умолчанию) — `edges` НЕ добавляется.
     *   Это соответствует поведению `collectFullJSON` в compact-reporter,
     *   который тоже не создаёт edges (по спецификации v9.0.x).
     * - `true` — `edges` собирается из `gr.*` и добавляется в результат.
     *   Используется, например, для сохранения edges в отдельный файл.
     *
     * @default false
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
    // Все типы экспортируются автоматически через `export interface` /
    // `export type`. Этот default-экспорт нужен только для обратной
    // совместимости с инструментами, которые ожидают его наличие.
};
