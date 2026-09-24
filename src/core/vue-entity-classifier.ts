// src/core/vue-entity-classifier.ts
// ============================================
// КЛАССИФИКАЦИЯ VUE-СУЩНОСТЕЙ
// ============================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Собирает агрегированную секцию `vue` для FullJSON из entitiesMap.
// Проходит по всем файлам и извлекает:
//   - SFC-компоненты (.vue) с битовой маской блоков
//   - Composables (use[A-Z]*) с kind/returnShape/returnedKeys
//   - Макросы (defineProps/Emits/Expose/Slots/Model/Options)
//   - Lifecycle hooks (onMounted, onUnmounted, watch, ...)
//   - Реактивные примитивы (computed, ref, reactive, watch)
//   - Иконки-компоненты (components/icons/**)
//
// ИСПОЛЬЗОВАНИЕ
// -------------
//   const vueEntities = classifyVueEntities(entitiesMap);
//   if (vueEntities.sfc.length > 0 || vueEntities.composables.length > 0) {
//     fullJson.vue = vueEntities;
//   }
//
// ИНТЕГРАЦИЯ
// ----------
// Вызывается из `compact-reporter.ts::collectFullJSON()` перед
// `canonicalizeFullJSON(result)`.
//
// СВЯЗАННЫЕ ФАЙЛЫ
// ---------------
//   - src/reporters/codec/codec-types.ts    — интерфейсы VueSection, SFCComponent, ...
//   - src/reporters/codec/codec-encode.ts   — encodeVueSection()
//   - src/reporters/codec/codec-decode.ts   — decodeVueSection()
//   - src/core/entity-extractor/helpers/classify-vue-kind.ts — classifyVueKind()
// ============================================

import path from 'path';
import type { EntitiesResult, FunctionInfo } from '../types.js';

// ============================================
// ТИПЫ
// ============================================

/**
 * Агрегированные Vue-сущности для FullJSON.vue.
 */
export interface VueEntities {
    /** SFC-компоненты (.vue файлы) */
    sfc: VueSfcComponent[];
    /** Composables (use[A-Z]*) */
    composables: VueComposableEntity[];
    /** Макросы (defineProps, defineEmits, ...) */
    macros: VueMacroEntity[];
    /** Lifecycle hooks (onMounted, onUnmounted, watch, ...) */
    hooks: VueHookEntity[];
    /** Реактивные примитивы (computed, ref, reactive, watch) */
    reactivity: VueReactivityEntity[];
    /** Иконки-компоненты (components/icons/**) */
    icons: VueIconEntity[];
}

/**
 * SFC-компонент.
 */
export interface VueSfcComponent {
    /** Путь к файлу (используется как fileId в FullJSON) */
    fileId: string;
    /** ID модуля (заполняется позже в compact-reporter) */
    moduleId: string;
    /** Имя компонента (PascalCase) */
    name: string;
    /**
     * Битовая маска блоков SFC:
     *   1 = <script>
     *   2 = <script setup>
     *   4 = <template>
     *   8 = <style>
     */
    blocks: number;
    /** Имена composables, используемых в компоненте */
    composables: string[];
    /** Имена props (из defineProps) */
    props: string[];
    /** Имена emits (из defineEmits) */
    emits: string[];
    /** Имена exposed-полей (из defineExpose) */
    exposed: string[];
}

/**
 * Composable-сущность (use[A-Z]*).
 */
export interface VueComposableEntity {
    /** ID функции (fn1, fn2, ... или сгенерированный) */
    id: string;
    /** Имя composable (useDataState) */
    name: string;
    /** Путь к файлу */
    fileId: string;
    /** Вид: composable | store | factory | utility */
    kind: 'composable' | 'store' | 'factory' | 'utility';
    /** Форма возвращаемого значения */
    returnShape: 'void' | 'object' | 'ref' | 'reactive' | 'function';
    /** Ключи, которые возвращает composable */
    returnedKeys: string[];
    /** Файлы, в которых вызывается этот composable */
    callers: string[];
}

/**
 * Макрос Vue-компилятора.
 */
export interface VueMacroEntity {
    /** ID (mac1, mac2, ... или сгенерированный) */
    id: string;
    /** Путь к файлу */
    fileId: string;
    /** Вид макроса */
    kind: 'props' | 'emits' | 'expose' | 'slots' | 'model' | 'options';
    /** Строка вызова */
    line: number;
}

/**
 * Lifecycle hook или watcher.
 */
export interface VueHookEntity {
    /** ID (hk1, hk2, ...) */
    id: string;
    /** Путь к файлу */
    fileId: string;
    /** Имя хука (onMounted, onUnmounted, watch, ...) */
    hookName: string;
    /** Строка вызова */
    line: number;
}

/**
 * Реактивный примитив.
 */
export interface VueReactivityEntity {
    /** ID (rx1, rx2, ...) */
    id: string;
    /** Путь к файлу */
    fileId: string;
    /** Вид: computed | ref | reactive | watch */
    kind: 'computed' | 'ref' | 'reactive' | 'watch';
    /** Строка вызова */
    line: number;
    /** Имя переменной (может отсутствовать для анонимных) */
    name?: string;
}

/**
 * Иконка-компонент.
 */
export interface VueIconEntity {
    /** ID (ic1, ic2, ...) */
    id: string;
    /** Путь к файлу */
    fileId: string;
    /** Имя иконки (AiCrossIcon) */
    name: string;
    /** Категория: base | filter | toolbar | sort */
    category: 'base' | 'filter' | 'toolbar' | 'sort';
}

// ============================================
// КОНСТАНТЫ
// ============================================

/**
 * Соответствие имени макроса → виду.
 */
const MACRO_KINDS = new Map<string, VueMacroEntity['kind']>([
    ['defineProps', 'props'],
    ['defineEmits', 'emits'],
    ['defineExpose', 'expose'],
    ['defineSlots', 'slots'],
    ['defineModel', 'model'],
    ['defineOptions', 'options'],
]);

/**
 * Lifecycle hooks и watchers.
 */
const HOOK_NAMES = new Set<string>([
    'onMounted',
    'onUnmounted',
    'onActivated',
    'onDeactivated',
    'onErrorCaptured',
    'onScopeDispose',
    'onBeforeMount',
    'onBeforeUnmount',
    'onUpdated',
    'onBeforeUpdate',
    'watch',
    'watchEffect',
]);

/**
 * Реактивные примитивы.
 */
const REACTIVITY_NAMES = new Set<string>([
    'computed',
    'ref',
    'shallowRef',
    'reactive',
    'readonly',
    'toRef',
    'toRefs',
    'customRef',
    'triggerRef',
]);

/**
 * Соответствие имени реактивности → виду.
 */
const REACTIVITY_KIND_MAP = new Map<string, VueReactivityEntity['kind']>([
    ['computed', 'computed'],
    ['ref', 'ref'],
    ['shallowRef', 'ref'],
    ['reactive', 'reactive'],
    ['readonly', 'reactive'],
    ['toRef', 'ref'],
    ['toRefs', 'ref'],
    ['customRef', 'ref'],
    ['triggerRef', 'ref'],
    ['watch', 'watch'],
    ['watchEffect', 'watch'],
]);

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================

/**
 * Собирает Vue-сущности из entitiesMap.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Итерируем по всем файлам в entitiesMap.
 *   2. Для .vue файлов:
 *        a. Определяем имя компонента.
 *        b. Вычисляем битовую маску блоков.
 *        c. Собираем composables/props/emits/exposed из templateXxx.
 *        d. Если файл в components/icons/ — добавляем в icons.
 *   3. Для всех функций:
 *        a. use[A-Z]* → composables
 *        b. define[A-Z]* → macros
 *        c. on* / watch* → hooks
 *        d. computed/ref/reactive → reactivity
 *   4. Возвращаем VueEntities.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕЧАНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - Функция НЕ парсит AST — работает с уже извлечёнными
 *     EntitiesResult из entity-extractor.
 *   - Все поля templateXxx уже присутствуют в EntitiesResult
 *     для .vue файлов (заполняются в convertVueAnalysisToEntities).
 *   - returnedKeys для composables берутся из `func.returnedKeys`
 *     (заполняется в extractComposableReturns).
 *
 * @param entitiesMap — карта { filePath → EntitiesResult }
 * @returns VueEntities — агрегированные Vue-сущности
 */
export function classifyVueEntities(
    entitiesMap: Record<string, EntitiesResult>
): VueEntities {
    const result: VueEntities = {
        sfc: [],
        composables: [],
        macros: [],
        hooks: [],
        reactivity: [],
        icons: [],
    };

    // Счётчики для генерации ID
    let macroCounter = 0;
    let hookCounter = 0;
    let reactivityCounter = 0;
    let iconCounter = 0;

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
        if (!entities) continue;

        const isVue = filePath.endsWith('.vue');
        const isIcon = filePath.includes('components/icons/');

        // ============================================================
        // 1. SFC-КОМПОНЕНТЫ
        // ============================================================
        if (isVue) {
            const componentName = path.basename(filePath, '.vue');
            const e = entities as any;

            // --- Биты блоков ---
            // 1 = <script>, 2 = <script setup>, 4 = <template>, 8 = <style>
            let blocks = 0;

            // script setup: если есть templateXxx или функции с vueKind
            if (e.templateReactivityDeps !== undefined) blocks |= 2;
            // template: если есть conditionals или usedComponents
            if (
                e.templateConditionals !== undefined ||
                e.templateUsedComponents !== undefined
            ) {
                blocks |= 4;
            }
            // style: если есть cssVariables или deepSelectors
            if (
                e.templateCssVariables !== undefined ||
                e.templateDeepSelectors !== undefined
            ) {
                blocks |= 8;
            }
            // script (не setup): если есть функции без templateXxx
            if (
                e.templateReactivityDeps === undefined &&
                (entities.functions?.length ?? 0) > 0
            ) {
                blocks |= 1;
            }

            // --- Composables, используемые в SFC ---
            const sfcComposables: string[] = [];
            for (const fn of entities.functions ?? []) {
                if (fn.name && /^use[A-Z]/.test(fn.name)) {
                    if (!sfcComposables.includes(fn.name)) {
                        sfcComposables.push(fn.name);
                    }
                }
            }

            // --- Props из defineProps ---
            const sfcProps: string[] = [];
            const sfcEmits: string[] = [];
            const sfcExposed: string[] = [];

            // Из templateLifecycle можно получить имена composables
            // Из templateReactivity — реактивные связи
            // Props/emits/exposed извлекаются через vue-macros-extractor,
            // но в EntitiesResult они не сохраняются напрямую.
            // Здесь мы можем использовать templateProps/templateEmits,
            // если они были проброшены в convertVueAnalysisToEntities.

            if (Array.isArray(e.templateProps)) {
                for (const p of e.templateProps) {
                    if (p && p.name) sfcProps.push(p.name);
                }
            }

            if (Array.isArray(e.templateEmits)) {
                for (const em of e.templateEmits) {
                    if (em && em.name) sfcEmits.push(em.name);
                }
            }

            if (Array.isArray(e.templateExposedMethods)) {
                for (const ex of e.templateExposedMethods) {
                    if (ex && ex.name) sfcExposed.push(ex.name);
                }
            }

            result.sfc.push({
                fileId: filePath,
                moduleId: '',
                name: componentName,
                blocks,
                composables: sfcComposables,
                props: sfcProps,
                emits: sfcEmits,
                exposed: sfcExposed,
            });

            // ============================================================
            // 2. ИКОНКИ
            // ============================================================
            if (isIcon) {
                iconCounter++;
                const category = detectIconCategory(filePath);
                result.icons.push({
                    id: `ic${iconCounter}`,
                    fileId: filePath,
                    name: componentName,
                    category,
                });
            }
        }

        // ============================================================
        // 3. ФУНКЦИИ (composables, macros, hooks, reactivity)
        // ============================================================
        for (const func of entities.functions ?? []) {
            if (!func || !func.name) continue;

            // --- Composables: use[A-Z] ---
            if (/^use[A-Z]/.test(func.name) && !isVueBuiltin(func.name)) {
                const kind = detectComposableKind(filePath);
                const returnShape = detectReturnShape(func);
                const returnedKeys = (func as any).returnedKeys ?? [];

                result.composables.push({
                    id: func.id ?? func.name,
                    name: func.name,
                    fileId: filePath,
                    kind,
                    returnShape,
                    returnedKeys,
                    callers: [],
                });
                continue;
            }

            // --- Макросы: define[A-Z] ---
            const macroKind = MACRO_KINDS.get(func.name);
            if (macroKind) {
                macroCounter++;
                result.macros.push({
                    id: `mac${macroCounter}`,
                    fileId: filePath,
                    kind: macroKind,
                    line: func.line ?? 0,
                });
                continue;
            }

            // --- Lifecycle hooks и watchers ---
            if (HOOK_NAMES.has(func.name)) {
                hookCounter++;
                result.hooks.push({
                    id: `hk${hookCounter}`,
                    fileId: filePath,
                    hookName: func.name,
                    line: func.line ?? 0,
                });
                continue;
            }

            // --- Реактивные примитивы ---
            if (REACTIVITY_NAMES.has(func.name)) {
                reactivityCounter++;
                const rxKind = REACTIVITY_KIND_MAP.get(func.name) ?? 'ref';
                result.reactivity.push({
                    id: `rx${reactivityCounter}`,
                    fileId: filePath,
                    kind: rxKind,
                    line: func.line ?? 0,
                    name: func.name,
                });
                continue;
            }
        }
    }

    return result;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Проверяет, является ли composable встроенным Vue-хуком.
 *
 * Встроенные (useSlots, useAttrs, useId, useTemplateRef,
 * useCssModule, useCssVars) НЕ считаются пользовательскими
 * composables.
 */
function isVueBuiltin(name: string): boolean {
    return (
        name === 'useSlots' ||
        name === 'useAttrs' ||
        name === 'useId' ||
        name === 'useTemplateRef' ||
        name === 'useCssModule' ||
        name === 'useCssVars'
    );
}

/**
 * Определяет вид composable по пути файла.
 *
 *   - store    — файл в *\/store.ts или *\/store\/*
*   - factory  — файл в *\/factories//* или содержит Factory
*   - utility  — файл в *\/utils\/*
*   - composable — иначе
*/
function detectComposableKind(
    filePath: string
): 'composable' | 'store' | 'factory' | 'utility' {
    const normalized = filePath.replace(/\\/g, '/');

    if (
        normalized.includes('/store/') ||
        normalized.endsWith('store.ts') ||
        normalized.endsWith('Store.ts')
    ) {
        return 'store';
    }

    if (
        normalized.includes('/factories/') ||
        normalized.includes('Factory')
    ) {
        return 'factory';
    }

    if (normalized.includes('/utils/')) {
        return 'utility';
    }

    return 'composable';
}

/**
 * Определяет форму возвращаемого значения composable по его телу.
 *
 *   - void     — нет return
 *   - object   — return { ... }
 *   - ref      — return ref(...) / shallowRef(...)
 *   - reactive — return reactive(...)
 *   - function — return () => {} / return function
 */
function detectReturnShape(
    func: FunctionInfo
): 'void' | 'object' | 'ref' | 'reactive' | 'function' {
    const body = func.body ?? '';

    if (!body.includes('return')) return 'void';

    if (body.includes('return {')) return 'object';

    if (/return\s+ref\s*\(/.test(body)) return 'ref';
    if (/return\s+shallowRef\s*\(/.test(body)) return 'ref';
    if (/return\s+computed\s*\(/.test(body)) return 'ref';

    if (/return\s+reactive\s*\(/.test(body)) return 'reactive';
    if (/return\s+readonly\s*\(/.test(body)) return 'reactive';

    if (/return\s+\(/.test(body)) return 'function';
    if (/return\s+function/.test(body)) return 'function';
    if (/return\s+async/.test(body)) return 'function';

    return 'object';
}

/**
 * Определяет категорию иконки по пути файла.
 *
 *   - filter  — *\/icons\/filter\/*
 *   - toolbar — *\/icons\/toolbar\/*
 *   - sort    — *\/icons\/sort\/*
 *   - base    — иначе
 */
function detectIconCategory(
    filePath: string
): 'base' | 'filter' | 'toolbar' | 'sort' {
    const normalized = filePath.replace(/\\/g, '/');

    if (normalized.includes('/icons/filter/')) return 'filter';
    if (normalized.includes('/icons/toolbar/')) return 'toolbar';
    if (normalized.includes('/icons/sort/')) return 'sort';

    return 'base';
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default classifyVueEntities;
