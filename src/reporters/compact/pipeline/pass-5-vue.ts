// src/reporters/compact/pipeline/pass-5-vue.ts
// ============================================
// ПРОХОД 5: VUE-СЕКЦИЯ + COMPONENT USAGE
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
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
// ════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ МОМЕНТЫ v16.1.0
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
//        Теперь cu.id/he.id уникальны в масштабе всего проекта.
//
//   2. СОРТИРОВКА vue.sfc[] ПО ИНДЕКСУ В files[]
//
//      ПРОБЛЕМА:
//        Порядок vue.sfc[] зависит от порядка обхода
//        entitiesMap (Object.entries). Это ломает
//        round-trip: при encode(full) и
//        encode(decode(encode(full))) порядок разный.
//
//      РЕШЕНИЕ:
//        processComponentUsage() сортирует vue.sfc[] по
//        fileIdToIndex.get(fileId).
//
//   3. ЯВНАЯ УСТАНОВКА parentFileId
//
//      Каждый cu/he получает parentFileId = sfc.fileId.
//      Это критично для decode — без явного parentFileId
//      decode использует fileId(fileIdx), что может
//      дать неверный результат при сортировке.
//
//   4. ПЕРЕУСТАНОВКА usageId
//
//      Во всех вложенных элементах (props/events/directives/
//      slots/interpolations) usageId переустанавливается
//      в новый глобальный cu.id/he.id.
//
//      Это гарантирует, что propsByUsage.get(usageId)
//      возвращает props ТОЛЬКО этого cu/he.
//
//   5. РЕАЛЬНЫЕ props/emits/exposed ИЗ vueAnalysis
//
//      Если в enhanced.vueAnalysis есть реальные имена
//      (props.names, emits.names, expose), они перезаписывают
//      placeholder-имена в sfc.props/emits/exposed.
//
//      Это нужно, потому что:
//        • sfc.props заполнен через defineProps в vue-analyzer
//        • decode возвращает имена через propsByUsage
//        • без этого симметрия L1/L2 ломается
//
//   6. ЗАПОЛНЕНИЕ АККУМУЛЯТОРОВ
//
//      После processComponentUsage() обходим все cu/he
//      и заполняем top-level аккумуляторы:
//        • allComponentProps[]
//        • allComponentEvents[]
//        • allComponentDirectives[]
//        • allComponentSlots[]
//        • allHtmlInterpolations[]
//
//      Эти массивы попадают в FullJSON на top-level
//      И в vue.component* (симметрия с codec-decode.ts v16.0.4).
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
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   pass5Vue(ctx);
//
//   ctx.vue → {
//     sfc: [
//       {
//         fileId: 'f1',
//         moduleId: 'm1',
//         name: 'App',
//         blocks: 6,
//         composables: ['useDataState'],
//         props: ['title'],
//         emits: ['update'],
//         exposed: ['reset'],
//         componentUsages: [
//           {
//             id: 'cu1',              // ← глобальный, уникальный
//             parentFileId: 'f1',     // ← явно установлен
//             tag: 'AiToolbar',
//             props: [
//               { id: 'cu1:cp1', usageId: 'cu1', ... }
//             ],
//             events: [...],
//             directives: [...],
//             slots: [...],
//           }
//         ],
//         htmlElements: [
//           {
//             id: 'he1',              // ← глобальный, уникальный
//             parentFileId: 'f1',     // ← явно установлен
//             tag: 'div',
//             props: [
//               { id: 'he1:cp1', usageId: 'he1', ... }
//             ],
//             ...
//           }
//         ],
//       }
//     ],
//     composables: [...],
//     macros: [...],
//     hooks: [...],
//     reactivity: [...],
//     icons: [...],
//     componentProps: [...],       // ← заполнено в fillComponentAccumulators
//     componentEvents: [...],
//     componentDirectives: [...],
//     componentSlots: [...],
//     htmlInterpolations: [...],
//   }
//
//   ctx.allComponentProps     → заполнены для top-level FullJSON
//   ctx.allComponentEvents    → заполнены
//   ctx.allComponentDirectives→ заполнены
//   ctx.allComponentSlots     → заполнены
//   ctx.allHtmlInterpolations → заполнены
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
//   • ../../../core/vue-entity-classifier.ts   — VueEntities тип
//   • ../../codec/codec-types.ts               — VueSectionFull
// ============================================

import { classifyVueEntities } from '../../../core/vue-entity-classifier.js';
import type { VueEntities } from '../../../core/vue-entity-classifier.js';
import { convertVueEntitiesToFull } from '../vue/convert-section.js';
import {
    processComponentUsage,
    fillComponentAccumulators,
} from '../vue/component-usage.js';
import type { CollectContext } from './context.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ПРОХОДА
// ============================================================

/**
 * Проход 5: Vue-секция + Component Usage.
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
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass5Vue;
