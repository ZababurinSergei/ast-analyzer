// src/core/vue-entity-classifier.ts
// ============================================
// КЛАССИФИКАЦИЯ VUE-СУЩНОСТЕЙ
// ============================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0 (v16.2.0 PATCH: reactivity через templateReactivity):
//   - ✅ УДАЛЁН блок `if (REACTIVITY_NAMES.has(func.name))` из цикла
//     по `entities.functions` — он формировал reactivity БЕЗ
//     usedInTemplate и с `name` = имя функции ('computed', 'ref'),
//     а не имя переменной.
//
//   - ✅ ДОБАВЛЕН блок `templateReactivity` перед закрытием внешнего
//     цикла `for (const filePath of sortedFilePaths)`. Читает
//     `entities.templateReactivity` (заполняется в convert-analysis.ts),
//     где:
//       • name          — имя переменной ('count', 'displayText')
//       • usedInTemplate — флаг использования в шаблоне
//
//   - 📌 ЦЕПОЧКА ДАННЫХ:
//       vue-analyzer/index.ts
//         → reactivity[].name (обогащение из constants)
//         → convert-analysis.ts
//         → entities.templateReactivity[].usedInTemplate
//         → classifyVueEntities (эта функция)
//         → vueEntities.reactivity[].usedInTemplate
//
//   - 📌 ПРИЧИНА:
//       `const count = ref(0)` НЕ попадает в `entities.functions`
//       как функция. Анализатор Vue SFC извлекает reactivity
//       через extractReactivity + extractConstantsFromScript
//       (см. convert-analysis.ts). Поэтому старый блок
//       `if (REACTIVITY_NAMES.has(func.name))` давал пустой
//       reactivity для `<script setup>`.
//
// ИЗМЕНЕНИЯ v1.1.0 (v16.2.0: usedInTemplate для reactivity):
//   - ✅ ДОБАВЛЕНО: `usedInTemplate?: boolean` в `VueReactivityEntity`.
//     Показывает, используется ли переменная в <template>.
//     Заполняется позже — в convert-analysis.ts.
//   - 📌 НАЗНАЧЕНИЕ: дать UI возможность отрисовать иконку 👁️
//     только для тех reactivity, которые реально участвуют
//     в рендеринге.
//   - 📌 СИНХРОНИЗИРОВАНО С:
//       • src/types.ts::ReactivityEntity
//       • src/reporters/codec/codec-types.ts::ReactivityEntity
//
// ИЗМЕНЕНИЯ v1.0.1 (round-trip fix: стабильный порядок обхода):
//   - ✅ FIX: обход `entitiesMap` теперь идёт по ОТСОРТИРОВАННЫМ
//     ключам (`Object.keys(entitiesMap).sort()`), а не по
//     `Object.entries(entitiesMap)`.
//
//     ПРИЧИНА:
//       Порядок ключей в `Record<string, ...>` в JS зависит
//       от порядка вставки. При `encode(full)` порядок SFC берётся
//       из `Object.entries(workingEntitiesMap)`, а при повторном
//       `encode(decode(encode(full)))` — из `compact.vue.sfc.f[]`,
//       который восстанавливается из `decode` и имеет другой порядок.
//
//       Это ломало уровни L4/RE/ENC: `componentProps.n` сдвигался
//       (индексы 1821 → 1639).
//
//     РЕШЕНИЕ:
//       Явно сортировать ключи `entitiesMap` перед обходом во всех
//       циклах. Это гарантирует, что `vue.sfc[]` всегда собирается
//       в одном и том же порядке (по `fileId` файла, т.е. по
//       относительному пути), независимо от того, как карта была
//       построена.
//
//     СИНХРОНИЗИРОВАНО С:
//       • src/reporters/compact-reporter.ts (v16.0.9)
//       • src/reporters/codec/codec-encode.ts (v16.0.9)
//       • src/reporters/codec/codec-decode.ts (v16.0.9)
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

// ============================================================
// FE-29-FIX: REACT_HOOKS — исключить React-хуки из Vue-composables
// ============================================================
// В React-проектах (mkb) функции useEffect_callback, useSelector_callback,
// useRef, useState и т.п. формально подходят под /^use[A-Z]/ и попадают
// в vue.composables. Это создаёт 249 мусорных записей.
//
// РЕШЕНИЕ:
//   1. Исключить известные React-хуки по имени.
//   2. Исключить все функции с суффиксом _callback —
//      это искусственные обёртки анализатора для колбэков.
// ============================================================
const REACT_HOOKS = new Set<string>([
    'useState', 'useReducer', 'useEffect', 'useLayoutEffect',
    'useInsertionEffect', 'useMemo', 'useCallback', 'useRef',
    'useContext', 'useImperativeHandle', 'useTransition',
    'useDeferredValue', 'useActionState', 'useOptimistic',
    'useFormStatus', 'use', 'useId', 'useSyncExternalStore',
    'useDebugValue', 'useMutableSource',
    'useSelector', 'useDispatch', 'useStore',
    'useNavigate', 'useParams', 'useLocation', 'useSearchParams',
    'useHistory', 'useForm', 'useController', 'useFormContext',
    'useTranslation', 'useMediaQuery', 'useWindowSize',
    'useLocalStorage', 'useDebounce', 'useThrottle', 'useToggle',
    'useClickOutside', 'useHover', 'useKeyPress',
    'useIntersectionObserver', 'useResizeObserver', 'useMutationObserver',
    'useFetch', 'useQuery', 'useMutation', 'useQueryClient',
    // FE-33-FIX: пользовательские React-хуки из mkb
    'useOutsideAlerter', 'useAuth', 'useTree', 'usePrevious',
    'useOutsideClick', 'useInputPostCoord', 'useMutationObservable',
]);

/**
 * FE-29-FIX: проверяет, является ли имя React-хуком.
 */
function isReactHook(name: string | undefined | null): boolean {
    if (!name || typeof name !== 'string') return false;
    // FE-33-FIX: явные React-хуки
    if (REACT_HOOKS.has(name)) return true;
    // FE-33-FIX: любые use*-функции с суффиксом _callback —
    // искусственные обёртки анализатора для колбэков.
    if (name.endsWith('_callback') && /^use[A-Z]/.test(name)) return true;
    // FE-33-FIX: точечные имена (useOutsideAlerter.anonymous_arrow,
    // useOutsideAlerter.handleClickOutside) — вложенные функции
    // внутри React-хуков.
    if (name.includes('.') && /^use[A-Z]/.test(name)) return true;
    // FE-33-FIX: пользовательские React-хуки из проекта mkb
    // (не в стандартном списке, но точно не Vue-composables).
    if (name.startsWith('use') && name.length > 3 && /[A-Z]/.test(name[3])) {
        // Проверяем: если функция НЕ объявлена в .vue-файле
        // (по fileId) — это React-хук. Но у нас нет fileId здесь.
        // Возвращаем true для известных пользовательских хуков.
        const USER_HOOKS = new Set([
            'useOutsideAlerter', 'useAuth', 'useTree', 'usePrevious',
            'useOutsideClick', 'useInputPostCoord', 'useMutationObservable',
        ]);
        if (USER_HOOKS.has(name)) return true;
    }
    return false;
}


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
 *
 * ✅ v16.2.0: добавлено поле usedInTemplate.
 *   Показывает, используется ли переменная в <template>.
 *   Заполняется в convert-analysis.ts на основе
 *   template.reactivityDeps.
 *
 * ⚠️ СИНХРОНИЗИРОВАНО С:
 *   • src/types.ts::ReactivityEntity
 *   • src/reporters/codec/codec-types.ts::ReactivityEntity
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

  /**
   * ✅ v16.2.0: используется ли переменная в <template>.
   *
   * ════════════════════════════════════════════════════════════
   * ЛОГИКА
   * ════════════════════════════════════════════════════════════
   *
   *   Заполняется в convert-analysis.ts:
   *     usedInTemplate = template.reactivityDeps.includes(name)
   *
   *   ПРИМЕР:
   *     const count = ref(0);                    // reactivity, name='count'
   *     const displayText = computed(...);       // reactivity, name='displayText'
   *     <template>{{ displayText }}</template>   // reactivityDeps=['displayText']
   *     →
   *       { name: 'count',       usedInTemplate: false }
   *       { name: 'displayText', usedInTemplate: true  }
   *
   * ════════════════════════════════════════════════════════════
   * ЗАЧЕМ
   * ════════════════════════════════════════════════════════════
   *
   *   UI может отрисовать иконку 👁️ только для тех reactivity,
   *   которые реально участвуют в рендеринге.
   */
  usedInTemplate?: boolean;
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
 *   1. ✅ v1.0.1: сортируем ключи entitiesMap для стабильного
 *      порядка обхода.
 *   2. Итерируем по отсортированным ключам.
 *   3. Для .vue файлов:
 *        a. Определяем имя компонента.
 *        b. Вычисляем битовую маску блоков.
 *        c. Собираем composables/props/emits/exposed из templateXxx.
 *        d. Если файл в components/icons/ — добавляем в icons.
 *   4. Для всех функций:
 *        a. use[A-Z]* → composables
 *        b. define[A-Z]* → macros
 *        c. on* / watch* → hooks
 *   5. ✅ v1.2.0: reactivity берётся из entities.templateReactivity
 *      (name = имя переменной, usedInTemplate = флаг).
 *   6. Возвращаем VueEntities.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ СОРТИРОВКА КЛЮЧЕЙ КРИТИЧНА (v1.0.1)
 * ════════════════════════════════════════════════════════════
 *
 *   `vue.sfc[]`, `vue.composables[]`, `vue.macros[]` и т.д.
 *   заполняются в порядке обхода `entitiesMap`. Порядок
 *   ключей в `Record<string, ...>` в JS — insertion order.
 *
 *   Если на вход подать одну и ту же карту, но с разным
 *   порядком ключей (что происходит при `encode(full)` vs
 *   `encode(decode(encode(full)))`), порядок SFC будет
 *   разным, и `compact.vue.sfc.f[]` тоже будет разным,
 *   что ломает `L4`/`RE`/`ENC`.
 *
 *   Сортировка по `filePath` (относительный путь) даёт
 *   стабильный порядок, одинаковый при любом построении
 *   карты. Это устраняет рассинхрон.
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
export function classifyVueEntities(entitiesMap: Record<string, EntitiesResult>): VueEntities {
  const result: VueEntities = {
    sfc: [],
    composables: [],
    macros: [],
    hooks: [],
    reactivity: [],
    icons: [],
  };

  // ✅ v1.0.1: стабильный порядок обхода
  // Сортируем ключи один раз — все последующие циклы
  // идут в одном и том же порядке.
  const sortedFilePaths = Object.keys(entitiesMap).sort();

  // Счётчики для генерации ID
  let macroCounter = 0;
  let hookCounter = 0;
  let reactivityCounter = 0;
  let iconCounter = 0;

  for (const filePath of sortedFilePaths) {
    const entities = entitiesMap[filePath];
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
      if (e.templateConditionals !== undefined || e.templateUsedComponents !== undefined) {
        blocks |= 4;
      }
      // style: если есть cssVariables или deepSelectors
      if (e.templateCssVariables !== undefined || e.templateDeepSelectors !== undefined) {
        blocks |= 8;
      }
      // script (не setup): если есть функции без templateXxx
      if (e.templateReactivityDeps === undefined && (entities.functions?.length ?? 0) > 0) {
        blocks |= 1;
      }

      // --- Composables, используемые в SFC ---
      const sfcComposables: string[] = [];
      for (const fn of entities.functions ?? []) {
        if (fn.name && /^use[A-Z]/.test(fn.name) && !isReactHook(fn.name)) {
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
    // 3. ФУНКЦИИ (composables, macros, hooks)
    // ============================================================
    //
    // ✅ v16.2.0 PATCH: из этого цикла УДАЛЁН блок
    //   `if (REACTIVITY_NAMES.has(func.name))`.
    //
    // ПРИЧИНА:
    //   `const count = ref(0)` НЕ попадает в `entities.functions`
    //   как функция. Поэтому блок никогда не срабатывал для
    //   <script setup>. А если срабатывал (для редких случаев,
    //   когда `computed` — реально функция), то `name` было
    //   равно 'computed'/'ref', а не имени переменной.
    //
    // ЧТО ВМЕСТО:
    //   Новый блок 4. REACTIVITY (см. ниже) читает
    //   `entities.templateReactivity`, где:
    //     • name          — имя переменной ('count', 'displayText')
    //     • usedInTemplate — флаг использования в шаблоне
    //
    //   Данные заполняются в convert-analysis.ts:
    //     (result as any).templateReactivity = vueAnalysis.reactivity.map(...)
    //
    //   vueAnalysis.reactivity обогащается именами в vue-analyzer/index.ts
    //   на основе constants (const count = ref(0)).
    for (const func of entities.functions ?? []) {
      if (!func || !func.name) continue;

      // --- Composables: use[A-Z] ---
      if (/^use[A-Z]/.test(func.name) && !isVueBuiltin(func.name) && !isReactHook(func.name)) {
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

      // ✅ v16.2.0 PATCH: блок `if (REACTIVITY_NAMES.has(func.name))`
      //   удалён. См. блок 4. REACTIVITY ниже.
    }

    // ============================================================
    // 4. REACTIVITY (v16.2.0 PATCH)
    // ============================================================
    //
    // ✅ Реактивные примитивы (computed/ref/reactive/watch) берём
    //    из templateReactivity, где:
    //      • name          — имя переменной ('count', 'displayText')
    //      • usedInTemplate — флаг использования в шаблоне
    //
    //    Заполняется в convert-analysis.ts:
    //      (result as any).templateReactivity = vueAnalysis.reactivity.map(...)
    //
    //    vueAnalysis.reactivity обогащается именами в vue-analyzer/index.ts
    //    на основе constants (const count = ref(0)).
    //
    //    ⚠️ ПОЧЕМУ НЕ entities.functions:
    //      `const count = ref(0)` НЕ является функцией в AST,
    //      поэтому не попадает в entities.functions. Реактивные
    //      переменные извлекаются отдельно (extractReactivity +
    //      extractConstantsFromScript) и обогащаются именами.
    //
    //    ⚠️ FALLBACK:
    //      Если по какой-то причине templateReactivity пуст
    //      (старый формат EntitiesResult, или вызов из другого
    //      места), reactivity просто не будет заполнен. Это
    //      допустимо — поле не критичное.
    const templateReactivity = (entities as any).templateReactivity || [];

    for (const rx of templateReactivity) {
      reactivityCounter++;
      result.reactivity.push({
        id: `rx${reactivityCounter}`,
        fileId: filePath,
        kind: rx.kind,
        line: rx.line ?? 0,
        name: rx.name,
        usedInTemplate: rx.usedInTemplate,
      });
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
 *   - factory  — файл в *\/factories\/* или содержит Factory
 *   - utility  — файл в *\/utils\/*
 *   - composable — иначе
 */
function detectComposableKind(filePath: string): 'composable' | 'store' | 'factory' | 'utility' {
  const normalized = filePath.replace(/\\/g, '/');

  if (
    normalized.includes('/store/') ||
    normalized.endsWith('store.ts') ||
    normalized.endsWith('Store.ts')
  ) {
    return 'store';
  }

  if (normalized.includes('/factories/') || normalized.includes('Factory')) {
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
function detectIconCategory(filePath: string): 'base' | 'filter' | 'toolbar' | 'sort' {
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
