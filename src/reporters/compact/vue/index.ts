// src/reporters/compact/vue/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ VUE
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Реэкспорт публичного API Vue-подсистемы. Используется в
// pipeline/pass-5-vue.ts.
//
// СОДЕРЖИМОЕ
// ----------
//   • convertVueEntitiesToFull   — VueEntities → VueSectionFull
//   • processComponentUsage      — Component Usage + HTML Elements
//                                  (v16.1.0: глобальные cu.id/he.id)
//   • fillComponentAccumulators  — заполнение top-level
//                                  allComponent* аккумуляторов
//
// ════════════════════════════════════════════════════════════
// ЗАВИСИМОСТИ
// ════════════════════════════════════════════════════════════
//
//   component-usage.ts импортирует value-extractors из
//   ../ids/value-extractors.js:
//     • extractIdentifierFromValue
//     • extractMemberChainFromValue
//     • extractLiteralFromValue
//
//   Это создаёт зависимость vue/* → ids/*, но НЕ наоборот.
//   Циклических импортов нет.
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • convert-section.ts   — конвертер VueEntities → VueSectionFull
//   • component-usage.ts   — Component Usage + HTML Elements (v16.1.0)
//
//   Pipeline:
//     • pass-5-vue.ts        — оркестратор Vue-прохода
//     • collect-full-json.ts — вызывает pass5Vue(ctx)
//
//   Типы:
//     • codec-types.ts       — VueSectionFull, ComponentUsage,
//                              HtmlElementUsage
//     • vue-entity-classifier.ts — VueEntities
// ============================================================

// ============================================================
// 1. КОНВЕРТЕР VUE-СУЩНОСТЕЙ
// ============================================================
// convertVueEntitiesToFull — преобразует VueEntities
//   (результат classifyVueEntities из core/vue-entity-classifier.ts)
//   в VueSectionFull (формат FullJSON.vue).
//
// Что конвертирует:
//   • sfc         — SFC-компоненты (.vue файлы)
//   • composables — use[A-Z]* функции
//   • macros      — defineProps/defineEmits/...
//   • hooks       — onMounted/onUnmounted/watch
//   • reactivity  — computed/ref/reactive
//   • icons       — components/icons/**
//
// Инициализирует пустыми []:
//   • componentUsages  — заполняется в processComponentUsage
//   • htmlElements     — заполняется в processComponentUsage
//   • componentProps   — заполняется в fillComponentAccumulators
//   • componentEvents  — заполняется в fillComponentAccumulators
//   • componentDirectives
//   • componentSlots
//   • htmlInterpolations
//
// Также резолвит fileId/moduleId для каждой сущности через
// fileMap и projectRoot.
// ============================================================

export { convertVueEntitiesToFull } from './convert-section.js';

// ============================================================
// 2. COMPONENT USAGE + HTML ELEMENTS (v16.1.0)
// ============================================================
// processComponentUsage — обрабатывает vue.sfc[]:
//   • Сортирует vue.sfc[] по индексу в files[]
//     (для стабильного порядка между прогонами).
//   • Для каждого SFC читает templateComponentUsages и
//     templateHtmlElements из enhancedMap.
//   • Присваивает ГЛОБАЛЬНО уникальные cu.id/he.id
//     (cu1, cu2, ... и he1, he2, ...).
//   • Явно устанавливает parentFileId = sfc.fileId.
//   • Переустанавливает usageId во всех вложенных элементах
//     (props/events/directives/slots/interpolations).
//   • Читает реальные props/emits/exposed из vueAnalysis.
//
// Возвращает { totalComponentUsages, totalHtmlElements }.
//
// ⚠️ ГЛАВНОЕ ИСПРАВЛЕНИЕ v16.1.0:
//   До v16.1.0 he.id = "he1" повторялся в каждом SFC, из-за чего
//   propsByUsage.get("he1") возвращал props из РАЗНЫХ SFC.
//   Это ломало L1/L2/DL/DEC.
//
//   Теперь he.id глобально уникальны, и propsByUsage.get(he.id)
//   возвращает props ТОЛЬКО этого he.
// ============================================================

export { processComponentUsage } from './component-usage.js';

// ============================================================
// 3. ЗАПОЛНЕНИЕ АККУМУЛЯТОРОВ COMPONENT*
// ============================================================
// fillComponentAccumulators — заполняет 5 top-level массивов
//   в CollectContext:
//     • allComponentProps
//     • allComponentEvents
//     • allComponentDirectives
//     • allComponentSlots
//     • allHtmlInterpolations
//
// Проходит по vue.sfc[].componentUsages[] и vue.sfc[].htmlElements[]
// и добавляет все вложенные элементы в соответствующий массив.
//
// Для каждого prop вызывает extractIdentifierFromValue,
// extractMemberChainFromValue, extractLiteralFromValue из
// ../ids/value-extractors.js.
//
// ⚠️ Эти массивы затем присваиваются:
//   • full.componentProps/Events/Directives/Slots/HtmlInterpolations
//   • vue.componentProps/Events/Directives/Slots/HtmlInterpolations
//
// Симметрия с codec-decode.ts v16.0.4: top-level component*
// поля ВСЕГДА присутствуют (даже пустые []).
// ============================================================

export { fillComponentAccumulators } from './component-usage.js';
