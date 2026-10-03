// src/reporters/compact/pipeline/pass-5-vue.ts
// ============================================
// ПРОХОД 5: VUE-СЕКЦИЯ + COMPONENT USAGE + VUE-FLOW
// ============================================
// Версия: 18.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v18.1.0 (A3: ENTERPRISE Vue-flow data):
//   - ✅ ОБНОВЛЕНО: extractAllFunctionsFromEntitiesMap теперь
//     читает ТАКЖЕ из entitiesMap[.vue].templateFunctions[].
//     Это позволяет находить функции из <script setup>,
//     которые отсутствуют в top-level functions[].
//   - ✅ ОБНОВЛЕНО: buildVueStateFlows получает entitiesMap
//     для доступа к templateReactivityInfo[] (reads/writes).
//   - 📌 Почему это важно:
//     • .vue парсится общим TS-парсером, который не понимает
//       <script setup>.
//     • Реальные функции (.vue) и их calls терялись.
//     • Теперь они проброшены через templateFunctions[].
//
// v18.0.0 (Vue-flow секции — симметрия с React):
//   - ✅ ДОБАВЛЕНО: Шаг 6 — Vue-flow секции.
//     После fillComponentAccumulators вызываются 4 билдера:
//       • buildVueStateFlows    — reactivity ↔ mutation ↔ read ↔ render
//       • buildVueEventFlows    — @click → handler → call → state → render
//       • buildVueRenderTree    — иерархия template с зависимостями
//       • buildVueFnHtmlUsage   — обратный индекс: функция → HTML
//     Результаты записываются в ctx.vue:
//       • ctx.vue.stateFlows
//       • ctx.vue.eventFlows
//       • ctx.vue.renderTree
//       • ctx.vue.flowFnHtmlUsage
//     Симметрия с pass-7-react.ts (buildStateFlows/buildEventFlows/
//     buildRenderTree/buildFnJsxUsage).
//   - ✅ ДОБАВЛЕНО: helper extractAllFunctionsFromEntitiesMap —
//     собирает FunctionLike[] из entitiesMap для билдеров.
//   - ✅ ДОБАВЛЕНО: verbose-логирование flow-секций.
//   - 📌 Вставка ПОСЛЕ fillComponentAccumulators — потому что
//     билдеры используют ctx.vue.sfc[].htmlElements[] (уже
//     перезаписанные processComponentUsage).
//
// v16.1.0 (рефакторинг: выделение в отдельный модуль):
//   - ✅ ПЕРЕПИСАНО: логика Vue-секции вынесена из
//     collectFullJSON в отдельный модуль.
//   - ✅ ИСПОЛЬЗУЕТСЯ: CollectContext (../pipeline/context.ts)
//   - ✅ ИСПОЛЬЗУЕТСЯ: classifyVueEntities (core/vue-entity-classifier)
//   - ✅ ИСПОЛЬЗУЕТСЯ: convertVueEntitiesToFull (../vue/convert-section.ts)
//   - ✅ ИСПОЛЬЗУЕТСЯ: processComponentUsage + fillComponentAccumulators
//     (../vue/component-usage.ts) — единые источники.
//   - ✅ 100% поведение сохранено.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Пятый проход pipeline'а. Отвечает за:
//
//     1. Классификацию Vue-сущностей через classifyVueEntities()
//        (SFC, composables, macros, hooks, reactivity, icons)
//
//     2. Конвертацию в FullJSON-секцию vue (VueSectionFull)
//        через convertVueEntitiesToFull()
//
//     3. Component Usage + HTML Elements (v16.1.0):
//        • Глобально уникальные cu.id/he.id
//        • Явная установка parentFileId = sfc.fileId
//        • Переустановка usageId во всех вложенных элементах
//        через processComponentUsage()
//
//     4. Заполнение аккумуляторов allComponent*:
//        • allComponentProps
//        • allComponentEvents
//        • allComponentDirectives
//        • allComponentSlots
//        • allHtmlInterpolations
//        через fillComponentAccumulators()
//
//     5. ✅ v18.0.0: Vue-flow секции (симметрия с React):
//        • ctx.vue.stateFlows
//        • ctx.vue.eventFlows
//        • ctx.vue.renderTree
//        • ctx.vue.flowFnHtmlUsage
//        через билдеры из modes/vue-analyzer/flows/*.
//
// ════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ МОМЕНТЫ
// ════════════════════════════════════════════════════════════
//
//   1. ГЛОБАЛЬНО УНИКАЛЬНЫЕ cu.id/he.id
//
//      ПРОБЛЕМА (до v16.1.0):
//        `he.id = 'he1'` повторялся в каждом SFC.
//        При decode `propsByUsage.get('he1')` возвращал
//        props из РАЗНЫХ SFC → L1/L2/DL/DEC падали.
//
//      РЕШЕНИЕ (v16.1.0):
//        processComponentUsage() использует глобальные
//        счётчики globalCuCounter/globalHeCounter без
//        сброса между SFC.
//
//   2. СОРТИРОВКА vue.sfc[] ПО ИНДЕКСУ В files[]
//
//      Порядок vue.sfc[] зависит от порядка обхода
//      entitiesMap (Object.entries). Это ломает round-trip.
//
//   3. ЯВНАЯ УСТАНОВКА parentFileId
//
//      Каждый cu/he получает parentFileId = sfc.fileId.
//
//   4. ПЕРЕУСТАНОВКА usageId
//
//      Во всех вложенных элементах usageId переустанавливается
//      в новый глобальный cu.id/he.id.
//
//   5. ✅ v18.0.0/v18.1.0: VUE-FLOW СЕКЦИИ
//
//      Билдеры из modes/vue-analyzer/flows/ используют:
//        • ctx.vue.sfc[].htmlElements[]      — HTML-элементы
//        • ctx.vue.sfc[].componentUsages[]   — компоненты
//        • ctx.vue.reactivity[]              — reactivity
//        • ctx.vue.componentEvents[]         — @click
//        • ctx.vue.componentProps[]          — props
//        • ctx.vue.componentDirectives[]     — v-if/v-for
//        • ctx.vue.componentSlots[]          — slots
//        • ctx.vue.htmlInterpolations[]      — {{ ... }}
//        • entitiesMap[file].functions[]         — TS/JS функции
//        • entitiesMap[file].templateFunctions[] — ✅ v18.1.0: Vue-функции из <script setup>
//        • entitiesMap[file].templateReactivityInfo[] — ✅ v18.1.0: reads/writes
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ВЫЗОВОВ
// ════════════════════════════════════════════════════════════
//
//   1. classifyVueEntities(ctx.entitiesMap) → vueEntities
//   2. Проверка hasAnyVue — если все секции пусты, ctx.vue
//      остаётся undefined, и проход завершается.
//   3. convertVueEntitiesToFull(vueEntities, fileMap, projectRoot)
//      → ctx.vue (VueSectionFull)
//   4. processComponentUsage(ctx.vue, ctx.files, entitiesMap, verbose)
//      → глобальные cu.id/he.id + сортировка sfc[]
//   5. fillComponentAccumulators(...)
//      → allComponentProps/.../HtmlInterpolations
//   6. ✅ v18.0.0/v18.1.0: Vue-flow секции
//      • ctx.vue.stateFlows       = buildVueStateFlows(vue, fns, entitiesMap)
//      • ctx.vue.eventFlows       = buildVueEventFlows(vue, sfc, fns)
//      • ctx.vue.renderTree       = buildVueRenderTree(vue)
//      • ctx.vue.flowFnHtmlUsage  = buildVueFnHtmlUsage(vue, fns)
//
// ════════════════════════════════════════════════════════════
// ОБРАБОТКА ОШИБОК
// ════════════════════════════════════════════════════════════
//
//   Вся логика обёрнута в try/catch. При ошибке:
//     • если verbose — console.warn с сообщением
//     • ctx.vue остаётся undefined
//     • pipeline продолжается
//
//   Это важно: Vue-секция не критична для TS/JS-проектов,
//   и ошибка в ней не должна ронять весь pipeline.
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./context.ts                             — CollectContext
//   • ./collect-full-json.ts                   — вызывает этот проход пятым
//   • ../../../core/vue-entity-classifier.ts   — classifyVueEntities
//   • ../vue/convert-section.ts                — convertVueEntitiesToFull
//   • ../vue/component-usage.ts                — processComponentUsage +
//                                                fillComponentAccumulators
//   • ../../../modes/vue-analyzer/flows/index.js — Vue-flow билдеры (v18.0.0)
//   • ../../codec/codec-types.ts               — VueSectionFull
// ============================================

import { classifyVueEntities } from '../../../core/vue-entity-classifier.js';
import type { VueEntities } from '../../../core/vue-entity-classifier.js';
import { convertVueEntitiesToFull } from '../vue/convert-section.js';
import { processComponentUsage, fillComponentAccumulators } from '../vue/component-usage.js';
import type { CollectContext } from './context.js';

// ✅ v18.0.0: Vue flow-билдеры (симметрия с pass-7-react.ts)
import {
  buildVueStateFlows,
  buildVueEventFlows,
  buildVueRenderTree,
  buildVueFnHtmlUsage,
  type FunctionLike,
} from '../../../modes/vue-analyzer/flows/index.js';

import type { EntitiesResult } from '../../../types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ПРОХОДА
// ============================================================

/**
 * Проход 5: Vue-секция + Component Usage + Vue-flow.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. classifyVueEntities(ctx.entitiesMap)
 *      → VueEntities (SFC, composables, macros, hooks,
 *                      reactivity, icons)
 *
 *   2. Проверка hasAnyVue:
 *      Если ВСЕ секции пусты — early return.
 *      ctx.vue остаётся undefined.
 *
 *   3. convertVueEntitiesToFull(vueEntities, fileMap, projectRoot)
 *      → ctx.vue (VueSectionFull с resolveFileId/resolveModuleId)
 *
 *   4. processComponentUsage(ctx.vue, ctx.files, entitiesMap, verbose)
 *      • Сортировка vue.sfc[] по индексу в files[]
 *      • Глобально уникальные cu.id/he.id
 *      • Явная установка parentFileId = sfc.fileId
 *      • Переустановка usageId во вложенных элементах
 *      • Реальные props/emits/exposed из vueAnalysis
 *
 *   5. fillComponentAccumulators(...)
 *      • Заполнение ctx.allComponentProps/Events/...
 *
 *   6. ✅ v18.0.0/v18.1.0: Vue-flow секции
 *      • ctx.vue.stateFlows       = buildVueStateFlows(ctx.vue, fns, entitiesMap)
 *      • ctx.vue.eventFlows       = buildVueEventFlows(ctx.vue, sfc, fns)
 *      • ctx.vue.renderTree       = buildVueRenderTree(ctx.vue)
 *      • ctx.vue.flowFnHtmlUsage  = buildVueFnHtmlUsage(ctx.vue, fns)
 *
 * ════════════════════════════════════════════════════════════
 * МУТИРУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ctx.vue
 *   ctx.allComponentProps
 *   ctx.allComponentEvents
 *   ctx.allComponentDirectives
 *   ctx.allComponentSlots
 *   ctx.allHtmlInterpolations
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param ctx — контекст сбора (мутируется)
 */
export function pass5Vue(ctx: CollectContext): void {
  const { entitiesMap, verbose } = ctx;

  try {
    // ────────────────────────────────────────────────────────
    // Шаг 1: Классификация Vue-сущностей
    // ────────────────────────────────────────────────────────
    //
    // classifyVueEntities обходит все .vue-файлы и агрегирует:
    //   • sfc          — SFC-компоненты с битовой маской блоков
    //   • composables  — use[A-Z]*
    //   • macros       — defineProps/Emits/Expose/Slots/Model/Options
    //   • hooks        — onMounted/onUnmounted/watch/...
    //   • reactivity   — computed/ref/reactive/watch
    //   • icons        — components/icons/**
    //
    // ⚠️ v1.0.1: обход идёт по ОТСОРТИРОВАННЫМ ключам
    //    (Object.keys(...).sort()), чтобы порядок sfc[] был
    //    стабильным.
    // ────────────────────────────────────────────────────────
    const vueEntities: VueEntities = classifyVueEntities(entitiesMap);

    // ────────────────────────────────────────────────────────
    // Шаг 2: Проверка наличия Vue-сущностей
    // ────────────────────────────────────────────────────────
    //
    // Если ВСЕ секции пусты — early return.
    // Это позволяет не создавать пустую vue-секцию в FullJSON.
    //
    // ПРИМЕЧАНИЕ: hasAnyVue может быть false, даже если
    // в проекте есть .vue-файлы — например, если все SFC
    // без <script> (иконки).
    // ────────────────────────────────────────────────────────
    const hasAnyVue =
      vueEntities.sfc.length > 0 ||
      vueEntities.composables.length > 0 ||
      vueEntities.macros.length > 0 ||
      vueEntities.hooks.length > 0 ||
      vueEntities.reactivity.length > 0 ||
      vueEntities.icons.length > 0;

    if (!hasAnyVue) {
      if (verbose) {
        console.log('   ℹ️  Vue-сущностей не найдено — секция vue пропущена');
      }
      return;
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: Конвертация в VueSectionFull
    // ────────────────────────────────────────────────────────
    //
    // convertVueEntitiesToFull:
    //   • Преобразует filePath → fileId через fileMap
    //   • Преобразует filePath → moduleId через fileMap
    //   • Инициализирует componentUsages/htmlElements = [] в sfc[]
    //   • Инициализирует componentProps/Events/.../HtmlInterpolations = []
    //     (будут заполнены в processComponentUsage + fillComponentAccumulators)
    //
    // ⚠️ Реальные componentUsages/htmlElements заполняются
    //    НЕ здесь, а в processComponentUsage (шаг 4).
    // ────────────────────────────────────────────────────────
    ctx.vue = convertVueEntitiesToFull(vueEntities, ctx.fileMap, ctx.projectRoot);

    // ────────────────────────────────────────────────────────
    // Шаг 3.1: Verbose-логирование
    // ────────────────────────────────────────────────────────
    if (verbose) {
      console.log(`   📦 Vue SFC: ${ctx.vue.sfc.length}`);
      console.log(`   ◇  Composables: ${ctx.vue.composables.length}`);
      console.log(`   ⚙  Macros: ${ctx.vue.macros.length}`);
      console.log(`   ⚓ Hooks: ${ctx.vue.hooks.length}`);
      console.log(`   ⚡ Reactivity: ${ctx.vue.reactivity.length}`);
      console.log(`   🖼  Icons: ${ctx.vue.icons.length}`);
    }

    // ────────────────────────────────────────────────────────
    // Шаг 4: Component Usage + HTML Elements (v16.1.0)
    // ────────────────────────────────────────────────────────
    //
    // processComponentUsage:
    //   1. Сортирует vue.sfc[] по индексу в files[]
    //   2. Обходит каждый sfc:
    //      a. Находит enhanced в workingEntitiesMap (по fileId)
    //      b. Читает rawCu = enhanced.templateComponentUsages || []
    //         rawHe = enhanced.templateHtmlElements || []
    //      c. Создаёт newCu с глобально уникальным cu.id
    //         (cu1, cu2, ... без сброса между SFC)
    //      d. Создаёт newHe с глобально уникальным he.id
    //         (he1, he2, ... без сброса между SFC)
    //      e. Устанавливает parentFileId = sfc.fileId
    //      f. Переустанавливает usageId во всех вложенных
    //         элементах (props/events/directives/slots/interpolations)
    //      g. Перезаписывает sfc.props/emits/exposed реальными
    //         именами из vueAnalysis (если есть)
    //   3. Возвращает { totalComponentUsages, totalHtmlElements }
    //
    // ⚠️ КРИТИЧНО: processComponentUsage СОРТИРУЕТ sfc[] и
    //    МУТИРУЕТ каждый sfc (sfc.componentUsages = newCu).
    // ────────────────────────────────────────────────────────
    processComponentUsage(ctx.vue, ctx.files, entitiesMap, verbose);

    // ────────────────────────────────────────────────────────
    // Шаг 5: Заполнение аккумуляторов allComponent*
    // ────────────────────────────────────────────────────────
    //
    // fillComponentAccumulators:
    //   Обходит все sfc[].componentUsages[] и sfc[].htmlElements[]
    //   и заполняет:
    //     • allComponentProps[]        — из cu.props + he.props
    //     • allComponentEvents[]       — из cu.events + he.events
    //     • allComponentDirectives[]   — из cu.directives + he.directives
    //     • allComponentSlots[]        — из cu.slots
    //     • allHtmlInterpolations[]    — из he.interpolations
    //
    //   Для каждого prop вычисляет:
    //     • identifier     — extractIdentifierFromValue(value)
    //     • memberChain    — extractMemberChainFromValue(value)
    //     • literalValue   — extractLiteralFromValue(value)
    //
    // ⚠️ Эти массивы попадают в FullJSON на top-level И
    //    в vue.component* (симметрия с codec-decode.ts v16.0.4).
    // ────────────────────────────────────────────────────────
    fillComponentAccumulators(
      ctx.vue,
      ctx.allComponentProps,
      ctx.allComponentEvents,
      ctx.allComponentDirectives,
      ctx.allComponentSlots,
      ctx.allHtmlInterpolations
    );

    // ────────────────────────────────────────────────────────
    // Шаг 5.1: Дополнительное verbose-логирование
    // ────────────────────────────────────────────────────────
    if (verbose) {
      console.log(`   🌐 Component Props: ${ctx.allComponentProps.length}`);
      console.log(`   📢 Component Events: ${ctx.allComponentEvents.length}`);
      console.log(`   📋 Component Directives: ${ctx.allComponentDirectives.length}`);
      console.log(`   📦 Component Slots: ${ctx.allComponentSlots.length}`);
      console.log(`   💬 HTML Interpolations: ${ctx.allHtmlInterpolations.length}`);
    }

    // ────────────────────────────────────────────────────────
    // Шаг 6 (v18.0.0/v18.1.0): Vue-flow секции
    // ────────────────────────────────────────────────────────
    //
    // Симметрия с pass-7-react.ts:
    //   buildStateFlows  ↔ buildVueStateFlows
    //   buildEventFlows  ↔ buildVueEventFlows
    //   buildRenderTree  ↔ buildVueRenderTree
    //   buildFnJsxUsage  ↔ buildVueFnHtmlUsage
    //
    // ⚠️ Вставка ПОСЛЕ fillComponentAccumulators — потому что
    //    билдеры используют ctx.vue.sfc[].htmlElements[] (уже
    //    перезаписанные processComponentUsage).
    //
    // ⚠️ Имена полей в ctx.vue (VueSectionFull):
    //    • ctx.vue.stateFlows       — VueStateFlow[]
    //    • ctx.vue.eventFlows       — VueEventFlow[]
    //    • ctx.vue.renderTree       — VueRenderNode[]
    //    • ctx.vue.flowFnHtmlUsage  — VueFnHtmlUsage[]
    //      (переименовано из fnHtmlUsage для избежания конфликта
    //       с существующим HtmlUsage[] из v16.0.0)
    //
    // ⚠️ v18.1.0: extractAllFunctionsFromEntitiesMap теперь
    //    читает ТАКЖЕ entitiesMap[file].templateFunctions[] —
    //    функции из <script setup>.
    // ────────────────────────────────────────────────────────

    const allFunctions = extractAllFunctionsFromEntitiesMap(entitiesMap);

    // ✅ v18.1.0: передаём entitiesMap в buildVueStateFlows
    //   для доступа к templateReactivityInfo[] (reads/writes).
    ctx.vue.stateFlows = buildVueStateFlows(ctx.vue, allFunctions, entitiesMap);

    // ⚠️ buildVueEventFlows и buildVueFnHtmlUsage пока не принимают
    //   entitiesMap — обновятся в A5.
    ctx.vue.eventFlows = buildVueEventFlows(ctx.vue, ctx.vue.sfc, allFunctions);
    ctx.vue.renderTree = buildVueRenderTree(ctx.vue);
    ctx.vue.flowFnHtmlUsage = buildVueFnHtmlUsage(ctx.vue, allFunctions);

    if (verbose) {
      console.log(`   🔗 Vue State Flows: ${ctx.vue.stateFlows.length}`);
      console.log(`   🎬 Vue Event Flows: ${ctx.vue.eventFlows.length}`);
      console.log(`   🌲 Vue Render Tree: ${ctx.vue.renderTree.length}`);
      console.log(`   🔍 Vue Flow Fn HTML Usage: ${ctx.vue.flowFnHtmlUsage.length}`);
    }
  } catch (err) {
    // ────────────────────────────────────────────────────────
    // Обработка ошибок
    // ────────────────────────────────────────────────────────
    //
    // Vue-секция НЕ КРИТИЧНА для TS/JS-проектов. При ошибке:
    //   • если verbose — console.warn
    //   • ctx.vue остаётся undefined или частично заполненным
    //   • pipeline продолжается (pass6DomApi выполнится)
    //
    // ⚠️ Мы НЕ сбрасываем ctx.vue в undefined при ошибке,
    //    потому что он мог быть частично заполнен. Это
    //    может привести к неполной vue-секции, но не к
    //    падению всего pipeline.
    // ────────────────────────────────────────────────────────
    if (verbose) {
      console.warn(
        `   ⚠️  Ошибка classifyVueEntities/pass5Vue: ` +
          `${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Извлекает все функции из entitiesMap для flow-билдеров.
 *
 * ════════════════════════════════════════════════════════════
 * ИСТОЧНИКИ (v18.1.0 ENTERPRISE):
 * ════════════════════════════════════════════════════════════
 *
 *   1. ent.functions[]         — TS/JS функции (top-level)
 *   2. ent.templateFunctions[] — ✅ v18.1.0: функции из <script setup>
 *
 * ⚠️ templateFunctions — единственный способ получить функции
 *    из .vue с calls[], потому что .vue парсится общим TS-парсером,
 *    который не понимает <script setup>.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   entitiesMap = {
 *     '/path/AiButton.vue': {
 *       functions: [],
 *       templateFunctions: [
 *         { name: 'onClick', line: 22, calls: ['emit'] }
 *       ]
 *     }
 *   }
 *
 *   extractAllFunctionsFromEntitiesMap(entitiesMap)
 *   → [
 *       {
 *         id: '/path/AiButton.vue:onClick:22',
 *         name: 'onClick',
 *         fileId: undefined,
 *         line: 22,
 *         calls: ['emit'],
 *       }
 *     ]
 */
function extractAllFunctionsFromEntitiesMap(
  entitiesMap: Record<string, EntitiesResult>
): FunctionLike[] {
  const all: FunctionLike[] = [];
  const seen = new Set<string>();

  for (const [filePath, ent] of Object.entries(entitiesMap)) {
    if (!ent) continue;

    // 1. TS/JS функции (top-level)
    for (const fn of ent.functions ?? []) {
      if (!fn || !fn.name) continue;

      const id = (fn as any).id ?? `${filePath}:${fn.name}:${fn.line}`;
      if (seen.has(id)) continue;
      seen.add(id);

      all.push({
        id,
        name: fn.name,
        fileId: (fn as any).fileId,
        line: fn.line,
        calls: Array.isArray(fn.calls) ? fn.calls : [],
      });
    }

    // 2. ✅ v18.1.0: Vue-функции из <script setup>
    const vueFns = (ent as any).templateFunctions ?? [];
    for (const fn of vueFns) {
      if (!fn || !fn.name) continue;

      const id = `${filePath}:${fn.name}:${fn.line}`;
      if (seen.has(id)) continue;
      seen.add(id);

      all.push({
        id,
        name: fn.name,
        fileId: undefined, // резолвится по filePath позже
        line: fn.line,
        calls: Array.isArray(fn.calls) ? fn.calls : [],
      });
    }
  }

  return all;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass5Vue;
