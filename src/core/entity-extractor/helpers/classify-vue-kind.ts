// packages/ast-analyzer/src/core/entity-extractor/helpers/classify-vue-kind.ts
// ============================================================
// КЛАССИФИКАЦИЯ VUE-СУЩНОСТЕЙ (vueKind)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Определяет тип функции по её имени и контексту объявления.
// Используется в extract-entities-from-ast.ts для заполнения
// поля FunctionInfo.vueKind.
//
// КОДЫ VUEKIND (0..6)
// -------------------
//   0 = function     — обычная функция
//   1 = composable   — use[A-Z]* (кроме Vue-встроенных)
//   2 = macro        — define[A-Z]* (defineProps, defineEmits, ...)
//   3 = hook         — onMounted, onUnmounted, watch, watchEffect
//   4 = reactivity   — computed, ref, reactive, readonly, toRef, ...
//   5 = callback     — стрелка в аргументе вызова
//   6 = arrow        — стрелка в переменной
//
// ПРИОРИТЕТ
// ---------
//   1. use[A-Z] && !VUE_BUILTINS       → composable
//   2. define[A-Z]                     → macro
//   3. HOOK_NAMES.has(name)            → hook
//   4. REACTIVITY_NAMES.has(name)      → reactivity
//   5. WATCHER_NAMES.has(name)         → reactivity
//   6. isArrow && parent === CallExpr  → callback
//   7. isArrow                         → arrow
//   8. иначе                           → function
//
// ВАЖНО
// -----
//   - VUE_BUILTINS исключаются из composable, потому что
//     useSlots/useAttrs/useId/useTemplateRef/useCssModule/useCssVars
//     — встроенные Vue composables, а не пользовательские.
//   - Порядок проверок критичен: composable проверяется ДО macro,
//     чтобы `useDefineProps` (если такое встретится) считался
//     composable, а не macro.
//   - Если name пустой или не строка — возвращается 'function'.
// ============================================================

// ============================================================
// ТИП
// ============================================================

/**
 * Vue-классификация функции.
 *
 * ════════════════════════════════════════════════════════════
 * ЗНАЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - `'function'`   — обычная функция (0)
 *   - `'composable'` — use[A-Z]* (1)
 *   - `'macro'`      — define[A-Z]* (2)
 *   - `'hook'`       — onMounted, onUnmounted, watch, ... (3)
 *   - `'reactivity'` — computed, ref, reactive, ... (4)
 *   - `'callback'`   — стрелка в аргументе вызова (5)
 *   - `'arrow'`      — стрелка в переменной (6)
 */
export type VueKind =
    | 'function'
    | 'composable'
    | 'macro'
    | 'hook'
    | 'reactivity'
    | 'callback'
    | 'arrow';

// ============================================================
// КОДЫ (для CODEC)
// ============================================================

/**
 * Числовые коды для `fns.vk` в CompactJSON.
 *
 * ⚠️ Синхронизировано с:
 *   - legend.codes.vueKind (codec-legend.ts)
 *   - VUE_KIND_CODES в codec-encode.ts
 */
export const VUE_KIND_CODES: Record<VueKind, number> = {
    function: 0,
    composable: 1,
    macro: 2,
    hook: 3,
    reactivity: 4,
    callback: 5,
    arrow: 6,
};

/**
 * Обратная карта: код → VueKind.
 *
 * Используется в codec-decode.ts при чтении `fns.vk`.
 */
export const VUE_KIND_BY_CODE: Record<number, VueKind> = {
    0: 'function',
    1: 'composable',
    2: 'macro',
    3: 'hook',
    4: 'reactivity',
    5: 'callback',
    6: 'arrow',
};

// ============================================================
// КОНСТАНТЫ
// ============================================================

/**
 * Встроенные Vue composables.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 * Формально подходят под паттерн `use[A-Z]*`, но НЕ являются
 * пользовательскими composables. Если их не исключить, в
 * секции `vue.composables` CompactJSON появятся записи вида
 * `useSlots`, `useAttrs`, `useId`, `useTemplateRef`,
 * `useCssModule`, `useCssVars` — это мусор.
 *
 * ════════════════════════════════════════════════════════════
 * РАСШИРЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 * Список можно расширять:
 *   - useRoute, useRouter       — Vue Router
 *   - useStore                  — Vuex
 *   - useI18n                   — vue-i18n
 *   - useHead, useFetch, ...    — Nuxt
 *   - useQuasar                 — Quasar
 *
 * Но по умолчанию ограничиваемся ядром Vue 3, чтобы не
 * скрывать пользовательские composables с теми же именами
 * (маловероятно, но возможно).
 */
const VUE_BUILTINS = new Set<string>([
    'useSlots',
    'useAttrs',
    'useId',
    'useTemplateRef',
    'useCssModule',
    'useCssVars',
]);

/**
 * Lifecycle hooks Vue 3.
 *
 * Все `on[A-Z]*`, которые вызывает пользователь, а не объявляет.
 * При классификации функции в `extract-entities-from-ast.ts`
 * эти имена появляются как `calls` (вызовы), а не как
 * объявления. Поэтому в `vueKind='hook'` попадают только те
 * случаи, когда пользователь явно объявил функцию с таким
 * именем (что нетипично, но возможно — например,
 * `function onMounted() { ... }` как обёртка).
 */
const HOOK_NAMES = new Set<string>([
    // onMounted / onUnmounted
    'onMounted',
    'onUnmounted',
    // Activation
    'onActivated',
    'onDeactivated',
    // Error handling
    'onErrorCaptured',
    // Scope
    'onScopeDispose',
    // Before/After
    'onBeforeMount',
    'onBeforeUnmount',
    'onUpdated',
    'onBeforeUpdate',
]);

/**
 * Watchers.
 */
const WATCHER_NAMES = new Set<string>([
    'watch',
    'watchEffect',
    'watchPostEffect',
    'watchSyncEffect',
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

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Определяет vueKind функции.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Защита от некорректного входа (name не строка / пусто).
 *   2. composable:  /^use[A-Z]/ && !VUE_BUILTINS.
 *   3. macro:       /^define[A-Z]/.
 *   4. hook:        HOOK_NAMES.
 *   5. reactivity:  REACTIVITY_NAMES или WATCHER_NAMES.
 *   6. callback:    isArrow && parentType === 'CallExpression'.
 *   7. arrow:       isArrow.
 *   8. function:    fallback.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   classifyVueKind('useDataState', false)
 *   // → 'composable'
 *
 *   classifyVueKind('useSlots', false)
 *   // → 'function'  (Vue builtin)
 *
 *   classifyVueKind('defineProps', false)
 *   // → 'macro'
 *
 *   classifyVueKind('onMounted', false)
 *   // → 'hook'
 *
 *   classifyVueKind('watch', false)
 *   // → 'reactivity'
 *
 *   classifyVueKind('computed', false)
 *   // → 'reactivity'
 *
 *   classifyVueKind('map_callback', true, 'CallExpression')
 *   // → 'callback'
 *
 *   classifyVueKind('foo', true, 'VariableDeclarator')
 *   // → 'arrow'
 *
 *   classifyVueKind('foo', false)
 *   // → 'function'
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ parentType СТРОКОЙ, А НЕ NODE
 * ════════════════════════════════════════════════════════════
 *
 *   Функция живёт в helpers/ и не должна зависеть от типа
 *   Node из ts-morph или ESTree. Достаточно знать тип родителя
 *   как строку ('CallExpression', 'VariableDeclarator').
 *
 *   Это:
 *     - делает функцию чистой (только строки на входе);
 *     - упрощает unit-тесты;
 *     - не создаёт циклических импортов.
 *
 * @param name       — имя функции
 * @param isArrow    — является ли функция стрелочной
 * @param parentType — тип родительского узла (опционально)
 * @returns VueKind
 */
export function classifyVueKind(
    name: string | undefined | null,
    isArrow: boolean,
    parentType?: string
): VueKind {
    // ────────────────────────────────────────────────────────
    // Шаг 1: защита от некорректного входа
    // ────────────────────────────────────────────────────────
    if (!name || typeof name !== 'string') {
        return 'function';
    }

    // ────────────────────────────────────────────────────────
    // Шаг 2: composable — use[A-Z]*
    // ────────────────────────────────────────────────────────
    if (/^use[A-Z]/.test(name) && !VUE_BUILTINS.has(name)) {
        return 'composable';
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: macro — define[A-Z]*
    // ────────────────────────────────────────────────────────
    if (/^define[A-Z]/.test(name)) {
        return 'macro';
    }

    // ────────────────────────────────────────────────────────
    // Шаг 4: hook — onMounted, onUnmounted, ...
    // ────────────────────────────────────────────────────────
    if (HOOK_NAMES.has(name)) {
        return 'hook';
    }

    // ────────────────────────────────────────────────────────
    // Шаг 5: reactivity — computed, ref, reactive, watch, ...
    // ────────────────────────────────────────────────────────
    if (REACTIVITY_NAMES.has(name) || WATCHER_NAMES.has(name)) {
        return 'reactivity';
    }

    // ────────────────────────────────────────────────────────
    // Шаг 6: callback — стрелка в аргументе вызова
    // ────────────────────────────────────────────────────────
    if (isArrow && parentType === 'CallExpression') {
        return 'callback';
    }

    // ────────────────────────────────────────────────────────
    // Шаг 7: arrow — стрелка в переменной
    // ────────────────────────────────────────────────────────
    if (isArrow) {
        return 'arrow';
    }

    // ────────────────────────────────────────────────────────
    // Шаг 8: fallback
    // ────────────────────────────────────────────────────────
    return 'function';
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Проверяет, является ли имя пользовательским composable.
 *
 * Отличие от classifyVueKind: только проверка паттерна,
 * без учёта VUE_BUILTINS. Полезно для отладки.
 *
 * @param name — имя функции
 * @returns true, если паттерн use[A-Z]
 */
export function isComposableName(name: string | undefined | null): boolean {
    if (!name || typeof name !== 'string') return false;
    return /^use[A-Z]/.test(name);
}

/**
 * Проверяет, является ли имя Vue-макросом.
 */
export function isMacroName(name: string | undefined | null): boolean {
    if (!name || typeof name !== 'string') return false;
    return /^define[A-Z]/.test(name);
}

/**
 * Проверяет, является ли имя lifecycle-хуком или watcher-ом.
 */
export function isHookName(name: string | undefined | null): boolean {
    if (!name || typeof name !== 'string') return false;
    return HOOK_NAMES.has(name) || WATCHER_NAMES.has(name);
}

/**
 * Проверяет, является ли имя реактивным примитивом.
 */
export function isReactivityName(name: string | undefined | null): boolean {
    if (!name || typeof name !== 'string') return false;
    return REACTIVITY_NAMES.has(name);
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
    classifyVueKind,
    VUE_KIND_CODES,
    VUE_KIND_BY_CODE,
    isComposableName,
    isMacroName,
    isHookName,
    isReactivityName,
};
