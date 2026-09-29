// src/reporters/compact/pipeline/context.ts
// ============================================
// КОНТЕКСТ СБОРА FULLJSON
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Мутируемый объект, который передаётся между всеми проходами
// pipeline'а (pass1..pass6) и содержит ВСЁ состояние сбора:
//
//   • Входные данные (entitiesMap, verbose, valuesMode, ...)
//   • Результирующие массивы (modules, files, functions, ...)
//   • Индексы для быстрого доступа (moduleMap, fileMap, functionMap)
//   • Счётчики (для генерации ID: m1, f1, fn1, cls1, ...)
//   • Аккумуляторы allComponent* (для v16.1.0 Component Usage)
//   • Промежуточные результаты (vue, domApiCalls, lexicalLinks)
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ ОДИН ОБЪЕКТ, А НЕ МНОГО ПАРАМЕТРОВ
// ════════════════════════════════════════════════════════════
//
//   Раньше каждый passX принимал 10+ параметров (map'ы, счётчики,
//   массивы). Это приводило к:
//     • длинным сигнатурам
//     • ошибкам при передаче (легко перепутать порядок)
//     • сложности добавления нового поля (надо менять 6 файлов)
//
//   Теперь ОДИН объект ctx. Каждый проход читает и мутирует
//   нужные ему поля. Добавление нового поля — только в этом
//   файле + в createCollectContext.
//
// ════════════════════════════════════════════════════════════
// ЖИЗНЕННЫЙ ЦИКЛ
// ════════════════════════════════════════════════════════════
//
//   1. createCollectContext(entitiesMap, verbose, valuesMode,
//                           crossFileCalls, projectRoot)
//      → создаёт пустой ctx
//
//   2. pass1Modules(ctx)      — заполняет moduleMap/fileMap/functionMap
//   3. pass4Extended(ctx)     — заполняет templates/lifecycle/.../lexicalLinks
//   4. pass2Exports(ctx)      — заполняет exports/imports/reExports
//   5. pass3Calls(ctx)        — заполняет calls
//   6. pass5Vue(ctx)          — заполняет vue + allComponent*
//   7. pass6DomApi(ctx)       — заполняет domApiCalls + fn.htmlUsage
//
//   8. collectFullJSON собирает финальный FullJSON из ctx
//
// ════════════════════════════════════════════════════════════
// СОГЛАШЕНИЯ
// ════════════════════════════════════════════════════════════
//
//   • Все массивы в ctx — это ССЫЛКИ на реальные массивы.
//     Проходы делают `ctx.functions.push(...)`, а не
//     `ctx.functions = [...ctx.functions, ...]`.
//
//   • Все счётчики в ctx.counters — мутируются через
//     `ctx.counters.module++`.
//
//   • Индексы (moduleMap, fileMap, functionMap, sourceToFileIdMap)
//     заполняются в pass1 и далее только читаются.
//
//   • Аккумуляторы allComponent* заполняются в pass5.
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./collect-full-json.ts   — создаёт ctx, вызывает проходы
//   • ./pass-1-modules.ts      — заполняет moduleMap/fileMap/functionMap
//   • ./pass-2-exports.ts      — заполняет exports/imports/reExports
//   • ./pass-3-calls.ts        — заполняет calls
//   • ./pass-4-extended.ts     — заполняет templates/lifecycle/...
//   • ./pass-5-vue.ts          — заполняет vue + allComponent*
//   • ./pass-6-dom-api.ts      — заполняет domApiCalls
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   import { createCollectContext, getRelativePath } from './context.js';
//
//   const ctx = createCollectContext(
//     entitiesMap,
//     true,              // verbose
//     'relations',       // valuesMode
//     crossFileCalls,
//     process.cwd()
//   );
//
//   pass1Modules(ctx);
//   pass4Extended(ctx);
//   // ...
//
//   const relative = getRelativePath(ctx, '/abs/path/file.ts');
// ============================================

import path from 'path';
import type { EntitiesResult } from '../../../types.js';
import type { ValuesMode } from '../../codec/values-filter.js';
import type {
    ModuleData,
    FileData,
    FunctionData,
    ClassData,
    ConstantData,
    ExportData,
    ImportData,
    CallData,
    ReExportData,
    TemplateData,
    LifecycleHook,
    EffectEdge,
    InjectionEdge,
    ReactivityEdge,
    TypeNodeData,
    TypeRefData,
    LexicalLink,
    VueSectionFull,
    DomApiCall,
    ComponentProp,
    ComponentEvent,
    ComponentDirective,
    ComponentSlot,
    HtmlInterpolation,
} from '../../codec/codec-types.js';
import type { CrossFileCall } from '../../../core/cross-file-resolver/types.js';

// ============================================================
// ТИП КОНТЕКСТА
// ============================================================

/**
 * Мутируемый контекст сбора FullJSON.
 *
 * ════════════════════════════════════════════════════════════
 * ГРУППЫ ПОЛЕЙ
 * ════════════════════════════════════════════════════════════
 *
 *   1. ВХОДНЫЕ ДАННЫЕ           — entitiesMap, verbose, valuesMode, ...
 *   2. СТАБИЛЬНЫЙ ПОРЯДОК       — sortedFilePaths
 *   3. РЕЗУЛЬТИРУЮЩИЕ МАССИВЫ   — modules, files, functions, ...
 *   4. ИНДЕКСЫ                  — moduleMap, fileMap, functionMap, ...
 *   5. СЧЁТЧИКИ                 — counters.{module, file, function, ...}
 *   6. АККУМУЛЯТОРЫ COMPONENT*  — allComponentProps, allComponentEvents, ...
 *   7. ПРОМЕЖУТОЧНЫЕ РЕЗУЛЬТАТЫ — vue, domApiCalls, lexicalLinks
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ ВСЕ ПОЛЯ МУТИРУЕМЫЕ
 * ════════════════════════════════════════════════════════════
 *
 *   Не помечаем `readonly`, потому что проходы делают:
 *     ctx.functions.push(...)
 *     ctx.counters.module++
 *     ctx.moduleMap.set(...)
 *
 *   Единственное, что не меняется — это ссылки на объекты
 *   (сам ctx не переприсваивается).
 */
export interface CollectContext {
    // ────────────────────────────────────────────────────────
    // 1. ВХОДНЫЕ ДАННЫЕ
    // ────────────────────────────────────────────────────────

    /** Исходные сущности: { filePath → EntitiesResult } */
    entitiesMap: Record<string, EntitiesResult>;

    /** Подробный вывод (console.log по ходу сбора) */
    verbose: boolean;

    /** Режим сериализации values: 'full' | 'relations' */
    valuesMode: ValuesMode;

    /** Результаты cross-file resolver (для обогащения calls) */
    crossFileCalls: CrossFileCall[] | undefined;

    /** Абсолютный путь к корню проекта (для резолва SFC) */
    projectRoot: string;

    // ────────────────────────────────────────────────────────
    // 2. СТАБИЛЬНЫЙ ПОРЯДОК ОБХОДА
    // ────────────────────────────────────────────────────────

    /**
     * Отсортированные ключи entitiesMap.
     *
     * ════════════════════════════════════════════════════════
     * ЗАЧЕМ СОРТИРОВКА
     * ════════════════════════════════════════════════════════
     *
     *   Порядок ключей в `Record<string, ...>` в JS зависит
     *   от порядка вставки. Это ломает round-trip:
     *     - encode(full) собирает ids в одном порядке
     *     - encode(decode(encode(full))) собирает в другом
     *
     *   Сортировка по имени файла даёт стабильный порядок,
     *   одинаковый при любом построении карты.
     *
     *   См. verify-roundtrip.ts (L4, RE, ENC).
     */
    sortedFilePaths: string[];

    // ────────────────────────────────────────────────────────
    // 3. РЕЗУЛЬТИРУЮЩИЕ МАССИВЫ
    // ────────────────────────────────────────────────────────
    // Заполняются проходами. Порядок элементов критичен
    // для round-trip (индексы в CompactJSON).
    // ────────────────────────────────────────────────────────

    /** Модули (директории) */
    modules: ModuleData[];

    /** Файлы */
    files: FileData[];

    /** Функции */
    functions: FunctionData[];

    /** Классы */
    classes: ClassData[];

    /** Константы */
    constants: ConstantData[];

    /** Экспорты */
    exports: ExportData[];

    /** Импорты */
    imports: ImportData[];

    /** Вызовы */
    calls: CallData[];

    /** Реэкспорты */
    reExports: ReExportData[];

    /** Vue-шаблоны */
    templates: TemplateData[];

    /** Lifecycle hooks (onMounted, onUnmounted, ...) */
    lifecycle: LifecycleHook[];

    /** Side-effects (setTimeout, clearTimeout, ...) */
    effects: EffectEdge[];

    /** Provide/inject рёбра */
    injections: InjectionEdge[];

    /** Реактивные связи (computed, watch, ref, ...) */
    reactivity: ReactivityEdge[];

    /** Узлы тип-графа (interface, type-alias, ...) */
    types: TypeNodeData[];

    /** Рёбра использования типов */
    typeRefs: TypeRefData[];

    // ────────────────────────────────────────────────────────
    // 4. ИНДЕКСЫ
    // ────────────────────────────────────────────────────────
    // Заполняются в pass1, далее только читаются.
    // ────────────────────────────────────────────────────────

    /** dirName → ModuleData */
    moduleMap: Map<string, ModuleData>;

    /** relativePath → FileData */
    fileMap: Map<string, FileData>;

    /** funcName → FunctionData[] (для резолва вызовов по имени) */
    functionMap: Map<string, FunctionData[]>;

    /**
     * Все ключи, по которым можно найти fileId:
     *   - абсолютный путь
     *   - относительный путь
     *   - basename
     *   - basename без расширения
     *   - путь без расширения
     *   - нормализованный (с прямыми слэшами)
     */
    sourceToFileIdMap: Map<string, string>;

    // ────────────────────────────────────────────────────────
    // 5. СЧЁТЧИКИ
    // ────────────────────────────────────────────────────────
    // Для генерации ID: m1, f1, fn1, cls1, cn1, e1, i1, ...
    // ────────────────────────────────────────────────────────

    counters: {
        module: number;
        file: number;
        function: number;
        class: number;
        constant: number;
        export: number;
        import: number;
        call: number;
        reExport: number;
        conditional: number;
        lifecycle: number;
        effect: number;
        injection: number;
        reactivity: number;
        type: number;
        typeRef: number;
        emptyNameFix: number;
        lexical: number;
    };

    // ────────────────────────────────────────────────────────
    // 6. АККУМУЛЯТОРЫ COMPONENT*
    // ────────────────────────────────────────────────────────
    // v16.0.4 + v16.1.0: top-level секции compact.json.
    // Заполняются в pass5Vue из vue.sfc[].componentUsages/htmlElements.
    //
    // ⚠️ Эти массивы кладутся в FullJSON на top-level И в vue.*
    //    (симметрия с codec-decode.ts v16.0.4).
    // ────────────────────────────────────────────────────────

    /** Все props из всех componentUsages/htmlElements */
    allComponentProps: ComponentProp[];

    /** Все events */
    allComponentEvents: ComponentEvent[];

    /** Все directives */
    allComponentDirectives: ComponentDirective[];

    /** Все slots */
    allComponentSlots: ComponentSlot[];

    /** Все interpolations */
    allHtmlInterpolations: HtmlInterpolation[];

    // ────────────────────────────────────────────────────────
    // 7. ПРОМЕЖУТОЧНЫЕ РЕЗУЛЬТАТЫ
    // ────────────────────────────────────────────────────────

    /** Vue-секция (заполняется в pass5Vue) */
    vue: VueSectionFull | undefined;

    /** DOM API-вызовы (заполняется в pass6DomApi) */
    domApiCalls: DomApiCall[];

    /** Лексические связи (заполняется в pass4Extended) */
    lexicalLinks: LexicalLink[];
}

// ============================================================
// ФАБРИКА КОНТЕКСТА
// ============================================================

/**
 * Создаёт пустой контекст сбора.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Сортирует ключи entitiesMap (стабильный порядок).
 *   2. Инициализирует все массивы пустыми.
 *   3. Инициализирует все Map'ы пустыми.
 *   4. Обнуляет все счётчики.
 *   5. Возвращает готовый ctx.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ СОРТИРОВКА ЗДЕСЬ
 * ════════════════════════════════════════════════════════════
 *
 *   `Object.keys(entitiesMap).sort()` — единственное место,
 *   где порядок фиксируется. Все проходы идут по
 *   ctx.sortedFilePaths, а не по Object.keys(entitiesMap).
 *
 *   Это гарантирует:
 *     • одинаковый порядок modules[] во всех прогонах
 *     • одинаковый порядок files[]
 *     • одинаковый порядок functions[]
 *     • стабильные ids[] (см. collectUniqueIds)
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param entitiesMap     — карта { filePath → EntitiesResult }
 *   @param verbose         — подробный вывод
 *   @param valuesMode      — 'full' | 'relations'
 *   @param crossFileCalls  — результат cross-file resolver (может быть undefined)
 *   @param projectRoot     — абсолютный путь к корню проекта
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const ctx = createCollectContext(
 *     entitiesMap,
 *     true,
 *     'relations',
 *     undefined,
 *     '/project/root'
 *   );
 */
export function createCollectContext(
    entitiesMap: Record<string, EntitiesResult>,
    verbose: boolean,
    valuesMode: ValuesMode,
    crossFileCalls: CrossFileCall[] | undefined,
    projectRoot: string
): CollectContext {
    // ✅ Стабильный порядок обхода — сортируем ключи один раз
    const sortedFilePaths = Object.keys(entitiesMap).sort();

    return {
        // ── Входные данные ──
        entitiesMap,
        verbose,
        valuesMode,
        crossFileCalls,
        projectRoot,

        // ── Стабильный порядок ──
        sortedFilePaths,

        // ── Результирующие массивы ──
        modules: [],
        files: [],
        functions: [],
        classes: [],
        constants: [],
        exports: [],
        imports: [],
        calls: [],
        reExports: [],
        templates: [],
        lifecycle: [],
        effects: [],
        injections: [],
        reactivity: [],
        types: [],
        typeRefs: [],

        // ── Индексы ──
        moduleMap: new Map(),
        fileMap: new Map(),
        functionMap: new Map(),
        sourceToFileIdMap: new Map(),

        // ── Счётчики ──
        counters: {
            module: 0,
            file: 0,
            function: 0,
            class: 0,
            constant: 0,
            export: 0,
            import: 0,
            call: 0,
            reExport: 0,
            conditional: 0,
            lifecycle: 0,
            effect: 0,
            injection: 0,
            reactivity: 0,
            type: 0,
            typeRef: 0,
            emptyNameFix: 0,
            lexical: 0,
        },

        // ── Аккумуляторы component* ──
        allComponentProps: [],
        allComponentEvents: [],
        allComponentDirectives: [],
        allComponentSlots: [],
        allHtmlInterpolations: [],

        // ── Промежуточные результаты ──
        vue: undefined,
        domApiCalls: [],
        lexicalLinks: [],
    };
}

// ============================================================
// УТИЛИТА: ОТНОСИТЕЛЬНЫЙ ПУТЬ
// ============================================================

/**
 * Возвращает относительный путь от projectRoot с прямыми слэшами.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   `filePath` из entitiesMap может быть:
 *     • абсолютным (если DiscoverFilesStage не нормализовал)
 *     • относительным от cwd
 *     • относительным от projectRoot
 *
 *   Для round-trip нужен ЕДИНЫЙ формат:
 *     • относительный от projectRoot
 *     • с прямыми слэшами (кроссплатформенность)
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   getRelativePath(ctx, '/project/root/src/utils.ts')
 *   // → 'src/utils.ts'
 *
 *   getRelativePath(ctx, '/project/root/src/App.vue')
 *   // → 'src/App.vue'
 *
 *   // Windows:
 *   getRelativePath(ctx, 'C:\\\\project\\\\root\\\\src\\\\utils.ts')
 *   // → 'src/utils.ts'  (не 'src\\\\utils.ts')
 *
 * @param ctx      — контекст (для projectRoot)
 * @param filePath — путь к файлу (абсолютный или относительный)
 * @returns относительный путь с прямыми слэшами
 */
export function getRelativePath(ctx: CollectContext, filePath: string): string {
    const absolutePath = path.resolve(filePath);
    return path.relative(ctx.projectRoot, absolutePath).replace(/\\/g, '/');
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
    createCollectContext,
    getRelativePath,
};
