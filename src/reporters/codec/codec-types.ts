// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (v16.0.8)
// ============================================
// Версия: 16.0.8
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.0.8-FIX (round-trip: identifier + id для component*):
//   - ✅ ИСПРАВЛЕНО: в VueSectionCompact.componentProps добавлено
//     опциональное поле 'idn' (индекс в strs, -1 = нет).
//   - ✅ ИСПРАВЛЕНО: в VueSectionCompact.componentEvents,
//     componentDirectives, componentSlots, htmlInterpolations
//     добавлено опциональное поле 'id' (индекс в ids[]).
//   - ✅ СИНХРОНИЗИРОВАНО с codec-legend.ts (FIX), codec-encode.ts
//     (FIX), codec-decode.ts (FIX).
//
// v16.0.8 (вынос типов Vue-шаблона + fix TS2304 + TS6196):
//   - ✅ ВЫНЕСЕНЫ типы ComponentUsage, HtmlElementUsage, ComponentProp,
//     ComponentEvent, ComponentDirective, ComponentSlot,
//     HtmlInterpolation, SourceChainItem, DomApi* в
//     src/types-vue-template.ts (разрыв циклического импорта
//     types.ts ↔ codec-types.ts).
//   - ✅ Реэкспорт из codec-types.ts сохранён для обратной совместимости.
//   - ✅ FIX TS2304: добавлен ЛОКАЛЬНЫЙ `import type` для типов,
//     которые реально используются ВНУТРИ файла (DomApiCall,
//     SFCComponent, HtmlUsage, FullJSON и т.д.). Без него
//     TypeScript не видит имена.
//     `export type { X } from '...'` НЕ вводит X в локальную
//     область видимости — нужны ДВА блока: import + export.
//   - ✅ FIX TS6196: из `import type` УБРАНЫ типы, которые
//     НЕ используются локально (только реэкспортируются):
//       • SourceChainItem   (используется в types-vue-template.ts)
//       • DomApiArgKind     (используется в types-vue-template.ts)
//       • DomApiArgSource   (используется в types-vue-template.ts)
//     Они остаются в `export type { ... }` для внешних потребителей.
//   - ✅ CODEC_VERSION = '16.0.8'.
//
// v16.0.7 (fix: projectRoot в GenerateReportOptions):
//   - ✅ ДОБАВЛЕНО: `projectRoot?: string` в `GenerateReportOptions`.
//     ПРИЧИНА: при запуске `compact-recursive ./infoenergo-ui/src/index.ts`
//     из корня пакета `ast-analyzer`, `process.cwd()` = корень пакета,
//     а Vue SFC лежат в `infoenergo-ui/src/`. В результате все 75 SFC
//     не находились на диске (`componentUsages`/`htmlElements` = 0).
//     РЕШЕНИЕ: проброс `projectRoot` из pipeline (ctx.options.projectRoot)
//     через `GenerateReportOptions` → `generateCompactReport` →
//     `collectFullJSON`.
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '16.0.7' (было '16.0.4').
//   - ✅ СИНХРОНИЗИРОВАНО с:
//       • codec-decode.ts     (v16.0.4)
//       • codec-encode.ts     (v16.0.4)
//       • codec-legend.ts     (v16.0.4)
//       • compact-reporter.ts (v16.0.7)
//       • pipeline/stages/build-report.ts (v2.1.0)
//
// v16.0.4 (fix: симметрия decode(compact) ↔ full по vue.componentProps*):
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '16.0.4' (было '16.0.1').
//   - ✅ ПРИЧИНА: decode(compact) не возвращал поля верхнего уровня
//     `vue.componentProps`, `vue.componentEvents`,
//     `vue.componentDirectives`, `vue.componentSlots`,
//     `vue.htmlInterpolations` — если они были пустыми. А
//     compact-reporter.ts ВСЕГДА добавляет эти поля (даже []) в full.vue.
//     Возникало расхождение L1/L2/DL и verify-consistency:
//       $.vue.componentProps  a: []   b: undefined
//     (5 расхождений × 3 уровня = 3 проваленных проверки).
//   - ✅ ФИКС: codec-decode.ts v16.0.4 — убраны 5 `delete`-строк
//     для этих полей из блока `if (!includeEmptyArrays)`. Теперь
//     decode ВСЕГДА возвращает их (даже пустыми []).
//   - ✅ СИНХРОНИЗИРОВАНО с:
//       • codec-decode.ts     (v16.0.4)
//       • codec-encode.ts     (v16.0.4)
//       • codec-legend.ts     (v16.0.4)
//       • compact-reporter.ts (v16.0.4)
//       • verify-roundtrip.ts (v16.0.4)
//       • verify-consistency.ts (v3.4.3)
//
// v16.0.1 (fix: экспорт PropUsage, DomApiHandlerUsage + hv в fns):
//   - ✅ FIX: добавлен экспорт `PropUsage` (был только в теле FullJSON,
//     но не как отдельный именованный экспорт — из-за этого
//     `compact-reporter.ts` не мог его импортировать).
//   - ✅ FIX: `DomApiHandlerUsage` уже был объявлен через `export interface`,
//     проверено — экспорт присутствует.
//   - ✅ FIX: `HtmlUsage` уже был объявлен через `export interface`,
//     проверено — экспорт присутствует.
//   - ✅ FIX: `SourceChainItem` уже был объявлен через `export interface`,
//     проверено — экспорт присутствует.
//   - ✅ NEW: добавлено поле `hv?: [number, number][]` в `CompactJSON.fns`
//     для RLE-кодирования `isHtmlVisible` (0/1). Это устраняет
//     расхождение L1/L2/DL: `decode(compact).functions[].isHtmlVisible`
//     теперь восстанавливается как `false`, а не `undefined`.
//   - ✅ NEW: `schemas.fns` расширена до 10 полей: добавлено `'hv'`.
//     Синхронизировано с `codec-legend.ts` и `verify-roundtrip.ts`.
//
// v16.0.0 (Component Usage + DOM API + sourceChains):
//   - ✅ CODEC_VERSION = '16.0.0' (breaking change)
//   - ✅ LEGEND_VERSION = '2.0.0' (новое поле legend.version)
//   - ✅ ДОБАВЛЕНО: ComponentUsage, ComponentProp, ComponentEvent,
//     ComponentDirective, ComponentSlot, SourceChainItem
//   - ✅ ДОБАВЛЕНО: HtmlElementUsage, HtmlInterpolation
//   - ✅ ДОБАВЛЕНО: HtmlUsage, HtmlOutputKind, PropUsage
//   - ✅ ДОБАВЛЕНО: DomApiCategory, DomApiEffect, DomApiTargetKind,
//     DomApiCall, DomApiArg, DomApiContext, DomApiHandlerUsage
//   - ✅ ДОБАВЛЕНО: FunctionData.htmlUsage / isHtmlVisible /
//     usagesAsPropSource / domApiCalls / domApiUsagesAsHandler
//   - ✅ ДОБАВЛЕНО: SFCComponent.componentUsages / htmlElements
//   - ✅ ДОБАВЛЕНО: VueSectionFull.componentProps / componentEvents /
//     componentDirectives / componentSlots / htmlInterpolations /
//     fnHtmlUsage / domApiCalls / domApiArgs / ids / sourceChains
//   - ✅ ДОБАВЛЕНО: FullJSON top-level поля (fnHtmlUsage, componentProps,
//     ..., domApiCalls, domApiArgs, sourceChains, ids)
//   - ✅ ДОБАВЛЕНО: CompactJSON top-level поля
//   - ✅ ОБНОВЛЕНО: VueSectionCompact.sfc — 30 полей (было 8)
//     Breaking change: p/e/x → pn/ps/en/es/xn/xs + cu_* / he_*
//   - ✅ ОБНОВЛЕНО: CompactJSON.params → (string | number[])[]
//   - ✅ ОБНОВЛЕНО: StatisticsData +8 счётчиков
//   - ✅ ОБНОВЛЕНО: CodecLegend.version (новое поле)
//   - ✅ ОБНОВЛЕНО: CodecLegend.codes +10 словарей
//   - ✅ ОБНОВЛЕНО: CodecLegend.schemas +11 схем
//
// v15.7.3 (fix: vue.sfc.c — индексы в strs, а не в vue.composables):
//   - ИСПРАВЛЕНО: VueSectionCompact.sfc.c — индексы в strs
//   - ДОБАВЛЕНО: VueSectionCompact.sfc.cs — slices
//
// v15.7.2 (fix: vue.sfc.c/cs — восстановление moduleId + счётчики)
// v15.7.1 (Vue-секция: ослабление проверки + moduleId)
// v15.7.0 (Vue-сущности)
// v15.6.0 (JSON-safe проверки)
// v15.5.0 (Vue entities)
// v15.4.3 (fix: единый источник истины для classifyValue)
// v15.4.0 (P3 — cross-file resolution)
// v15.3.0 (P2 — расширенный CallData)
// v15.2.0 (P1 — lexicalLinks)
// v15.1.0 (P0 — parentFunctionId)
// v15.0.6 (gr.i.tf — индекс в fl.p)
// v15.0.2 (устранение дублирования conditionals)
// v15.0.1 (fix imports[].type)
// v15.0.0 (100% round-trip расширенных секций)
// ============================================

// ============================================================
// ✅ v16.0.8: ВЕРСИИ CODEC И LEGEND
// ============================================================
// CODEC_VERSION используется в:
//   - compact-reporter.ts (version в full.json)
//   - codec-encode.ts     (v в compact.json)
//   - codec-decode.ts     (version в full.json при decode)
//   - codec-legend.ts     (заголовок)
//   - verify-roundtrip.ts (codecVersion в jsonReport)
//   - verify-consistency.ts (заголовок)
//
// LEGEND_VERSION — новое поле legend.version (в 15.7.3 отсутствовало).
// Инвариант I40 проверяет его значение.
// ============================================================

export const CODEC_VERSION = '16.0.8';
export const LEGEND_VERSION = '2.0.0';

// ============================================================
// ✅ v16.0.8: ИМПОРТ И РЕЭКСПОРТ ТИПОВ VUE-ШАБЛОНА
// ============================================================
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ ЭТОТ БЛОК
// ════════════════════════════════════════════════════════════
//
// Раньше типы ComponentUsage, HtmlElementUsage, ComponentProp,
// ComponentEvent, ComponentDirective, ComponentSlot,
// HtmlInterpolation, SourceChainItem, DomApi* были ОПРЕДЕЛЕНЫ
// прямо в этом файле.
//
// Но это создавало ЦИКЛИЧЕСКИЙ ИМПОРТ:
//
//   types.ts → codec-types.ts → types.ts
//
// Потому что:
//   - types.ts (v16.0.8) хочет импортировать ComponentUsage
//     из codec-types.ts (для EntitiesResult.templateComponentUsages)
//   - codec-types.ts импортирует TemplateEventHandler и др.
//     из types.ts (для реэкспорта)
//
// TypeScript такое не любит: типы могут стать `any`,
// ломается автодополнение, vitest/ts-node падают.
//
// ════════════════════════════════════════════════════════════
// РЕШЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Все типы Vue-шаблона вынесены в `src/types-vue-template.ts` —
// отдельный файл БЕЗ зависимостей от types.ts и codec-types.ts.
//
// Теперь:
//   - `types.ts`        импортирует из types-vue-template.ts
//   - `codec-types.ts`  импортирует из types-vue-template.ts
//   - `codec-types.ts`  РЕЭКСПОРТИРУЕТ их для обратной совместимости
//
// Цикл разорван.
//
// ════════════════════════════════════════════════════════════
// ⚠️ ВАЖНО: ТРИ ПРАВИЛА
// ════════════════════════════════════════════════════════════
//
//   1. `import type { X } from '...'` — вводит X в ЛОКАЛЬНУЮ
//      область видимости. Нужен, если X используется внутри
//      этого файла (в объявлениях интерфейсов, type aliases).
//      Без него TypeScript выдаст TS2304.
//
//   2. `export type { X } from '...'` — РЕЭКСПОРТИРУЕТ X для
//      внешних потребителей. НЕ вводит X в локальную область
//      видимости. НЕ помогает против TS2304.
//
//   3. Если X НЕ используется локально — НЕ добавляйте его
//      в `import type`. Иначе TypeScript выдаст TS6196
//      (`X is declared but never used`).
//
//   Правильная комбинация:
//     • X используется локально  →  `import type` + `export type`
//     • X только реэкспортируется →  только `export type`
//     • X только локальный       →  только `import type`
//
// ════════════════════════════════════════════════════════════
// ОБРАТНАЯ СОВМЕСТИМОСТЬ
// ════════════════════════════════════════════════════════════
//
// Все, кто импортировал:
//   import type { ComponentUsage } from './codec-types.js';
//
// продолжают работать без изменений.
//
// ════════════════════════════════════════════════════════════
// ⚠️ ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ
// ════════════════════════════════════════════════════════════
//
// `src/types-vue-template.ts`. НЕ дублируйте определения здесь!
// ============================================================

// ────────────────────────────────────────────────────────────
// 1. Локальный импорт (для использования внутри файла)
// ────────────────────────────────────────────────────────────
//
// ⚠️ ВАЖНО: импортируем ТОЛЬКО те типы, которые реально
// используются в объявлениях этого файла (DomApiCall,
// SFCComponent, HtmlUsage, FullJSON, VueSectionFull и т.д.).
//
// Типы, которые НЕ используются локально (только реэкспортируются),
// НЕ включаем сюда — иначе TS6196:
//
//   ❌ SourceChainItem
//      Используется только в types-vue-template.ts:
//        ComponentProp.sourceChain, ComponentEvent.handlerChain,
//        HtmlInterpolation.sourceChain
//
//   ❌ DomApiArgKind
//      Используется только в types-vue-template.ts:
//        DomApiArg.kind
//
//   ❌ DomApiArgSource
//      Используется только в types-vue-template.ts:
//        DomApiArg.resolvedSource
//
// Все перечисленные типы (включая SourceChainItem, DomApiArgKind,
// DomApiArgSource) реэкспортируются ниже через `export type { ... }`
// для внешних потребителей.
//
// А те, что ниже — используются локально:
//   ✅ ComponentProp        — SFCComponent.componentUsages[].props,
//                             VueSectionFull.componentProps,
//                             FullJSON.componentProps
//   ✅ ComponentEvent       — VueSectionFull.componentEvents,
//                             FullJSON.componentEvents
//   ✅ ComponentDirective   — VueSectionFull.componentDirectives,
//                             FullJSON.componentDirectives
//   ✅ ComponentSlot        — VueSectionFull.componentSlots,
//                             FullJSON.componentSlots
//   ✅ HtmlInterpolation    — VueSectionFull.htmlInterpolations,
//                             FullJSON.htmlInterpolations
//   ✅ ComponentUsage       — SFCComponent.componentUsages
//   ✅ HtmlElementUsage     — SFCComponent.htmlElements
//   ✅ DomApiEffect         — DomApiCall.effect
//   ✅ DomApiTargetKind     — DomApiCall.targetKind
//   ✅ DomApiArg            — DomApiCall.argResolutions,
//                             VueSectionFull.domApiArgs,
//                             FullJSON.domApiArgs
//   ✅ DomApiContext        — DomApiCall.context, HtmlUsage.domApiContext
// ────────────────────────────────────────────────────────────
import type {
  // === Component Prop / Event / Directive / Slot ===
  ComponentProp,
  ComponentEvent,
  ComponentDirective,
  ComponentSlot,
  HtmlInterpolation,

  // === Component Usage / Html Element Usage ===
  ComponentUsage,
  HtmlElementUsage,

  // === DOM API types (только те, что используются локально) ===
  DomApiEffect,
  DomApiTargetKind,
  DomApiArg,
  DomApiContext,
} from '../../types-vue-template.js';

// ────────────────────────────────────────────────────────────
// 2. Реэкспорт (для внешних потребителей codec-types.ts)
// ────────────────────────────────────────────────────────────
//
// Реэкспортируем ВСЕ типы из types-vue-template.ts, включая
// те, что не используются локально (SourceChainItem,
// DomApiArgKind, DomApiArgSource). Это сохраняет обратную
// совместимость для тех, кто импортировал их из codec-types.ts
// в версиях ≤ 16.0.7.
// ────────────────────────────────────────────────────────────
export type {
  SourceChainItem,
  ComponentProp,
  ComponentEvent,
  ComponentDirective,
  ComponentSlot,
  HtmlInterpolation,
  ComponentUsage,
  HtmlElementUsage,
  DomApiEffect,
  DomApiTargetKind,
  DomApiArgKind,
  DomApiArgSource,
  DomApiArg,
  DomApiContext,
} from '../../types-vue-template.js';

// ============================================================
// РЕЭКСПОРТ TEMPLATE-ТИПОВ ИЗ src/types.ts
// ============================================================
//
// Эти типы — Vue-специфичные, но определены в src/types.ts.
// Реэкспортируем их из codec-types.ts для обратной совместимости:
// потребители codec-types.ts могут импортировать их отсюда.
//
// ⚠️ НЕ ПУТАТЬ с типами из types-vue-template.ts:
//   - TemplateEventHandler       → EventHandlerUsage (vue-analyzer)
//   - TemplateDynamicComponent   → DynamicComponentUsage (vue-analyzer)
//   - TemplateRefUsage           → TemplateRefUsage (vue-analyzer)
//   - TemplateCssVariable        → CssVariableUsage (vue-analyzer)
//   - TemplateDeepSelector       → DeepSelectorUsage (vue-analyzer)
//   - TemplateConditional        → расширяет TemplateConditionalUsage
//
// А типы из types-vue-template.ts — это ComponentUsage, ComponentProp
// и т.д. — они описывают РЕЗУЛЬТАТ парсинга <template>.
//
// ⚠️ По той же причине, что и выше (TS2304/TS6196), здесь нужны
// ОБА блока: import type + export type. Все шесть типов ниже
// реально используются внутри файла (см. TemplateData,
// ConditionalDirective), поэтому TS6196 здесь не сработает.
// ============================================================

// ────────────────────────────────────────────────────────────
// 1. Локальный импорт (для использования внутри файла)
// ────────────────────────────────────────────────────────────
import type {
  TemplateEventHandler,
  TemplateDynamicComponent,
  TemplateRefUsage,
  TemplateCssVariable,
  TemplateDeepSelector,
  TemplateConditional,
} from '../../types.js';

// ────────────────────────────────────────────────────────────
// 2. Реэкспорт (для внешних потребителей codec-types.ts)
// ────────────────────────────────────────────────────────────
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

// ============================================================
// CONDITIONAL DIRECTIVE (type alias)
// ============================================================

/**
 * Директива условного рендеринга: v-if | v-else-if | v-else.
 */
export type ConditionalDirective = TemplateConditional['directive'];

// ============================================================
// ✅ v15.2.0 (P1): LEXICAL LINKS
// ============================================================

/**
 * Вид лексической связи между функциями.
 */
export type LexicalRelation =
  | 'nested'
  | 'arrow-var'
  | 'callback'
  | 'iife'
  | 'class-method'
  | 'object-prop'
  | 'return'
  | 'default-export';

/**
 * Лексическая связь: parent → child.
 */
export interface LexicalLink {
  id: string;
  parentFunctionId: string | null;
  childFunctionId: string;
  relation: LexicalRelation;
  line: number;
  argumentIndex?: number;
  calleeName?: string;
}

// ============================================================
// ✅ v15.4.0 (P3): CROSS-FILE TYPES (реэкспорт)
// ============================================================

export type {
  CrossFileCall,
  CrossFileResolverOptions,
  ResolveStats,
  ResolvedCallee,
} from '../../core/cross-file-resolver/types.js';

// ============================================================
// ✅ v15.5.0: VUE ENTITIES
// ============================================================

/**
 * Тип функции с точки зрения Vue.
 */
export type VueKind =
  'function' | 'composable' | 'macro' | 'hook' | 'reactivity' | 'callback' | 'arrow';

/**
 * Битовая маска блоков SFC-компонента.
 *
 *   1  = <script>
 *   2  = <script setup>
 *   4  = <template>
 *   8  = <style>
 */
export type SfcBlockMask = number;

/**
 * SFC-компонент (.vue).
 *
 * ✅ v16.0.0: добавлены componentUsages и htmlElements.
 * ✅ v16.0.8: componentUsages/htmlElements заполняются в
 *   compact-reporter.ts ИЗ enhancedMap (поля
 *   templateComponentUsages/templateHtmlElements),
 *   а НЕ через analyzeVueSFC.
 */
export interface SFCComponent {
  /** ID файла (f1, f2, ...) */
  fileId: string;

  /** ID модуля (m1, m2, ...) */
  moduleId: string;

  /** Имя компонента */
  name: string;

  /** Битовая маска блоков */
  blocks: SfcBlockMask;

  /** Composables, использованные в <script setup> */
  composables: string[];

  /** Props (реальные имена — v16.0.0) */
  props: string[];

  /** Emits (реальные имена — v16.0.0) */
  emits: string[];

  /** Exposed (реальные имена — v16.0.0) */
  exposed: string[];

  // ==========================================
  // ✅ v16.0.0: Vue-шаблон
  // ==========================================

  /**
   * Использования компонентов в <template>.
   *
   * ⚠️ v16.0.8: заполняется в compact-reporter.ts ИЗ enhancedMap
   * (поле templateComponentUsages), а НЕ через analyzeVueSFC.
   */
  componentUsages?: ComponentUsage[];

  /**
   * Использования HTML-элементов в <template>.
   *
   * ⚠️ v16.0.8: заполняется в compact-reporter.ts ИЗ enhancedMap
   * (поле templateHtmlElements), а НЕ через analyzeVueSFC.
   */
  htmlElements?: HtmlElementUsage[];
}

/**
 * Composable-функция.
 */
export interface ComposableEntity {
  id: string;
  name: string;
  fileId: string;
  kind: 'composable' | 'store' | 'factory' | 'utility';
  returnShape: 'void' | 'object' | 'ref' | 'reactive' | 'function';
  returnedKeys: string[];
  callers: string[];
}

/**
 * Vue-макрос.
 */
export interface MacroEntity {
  id: string;
  fileId: string;
  kind: 'props' | 'emits' | 'expose' | 'slots' | 'model' | 'options';
  line: number;
}

/**
 * Lifecycle hook или watcher.
 */
export interface HookEntity {
  id: string;
  fileId: string;
  hookName: string;
  line: number;
}

/**
 * Реактивный примитив или watcher.
 */
export interface ReactivityEntity {
  id: string;
  fileId: string;
  kind: 'computed' | 'ref' | 'reactive' | 'watch' | 'shallowRef' | 'readonly' | 'toRef' | 'toRefs';
  line: number;
  name?: string;
}

/**
 * Иконка-компонент.
 */
export interface IconEntity {
  id: string;
  fileId: string;
  name: string;
  category: 'base' | 'filter' | 'toolbar' | 'sort';
}

// ============================================================
// ✅ v16.0.0: HTML OUTPUT USAGE
// ============================================================

/**
 * Категория UI-вывода.
 *
 * kind='none' УБРАН — мёртвый enum.
 */
export type HtmlOutputKind =
// Vue-шаблон
  | 'rendered-text'
  | 'rendered-attr'
  | 'rendered-cond'
  | 'rendered-list'
  | 'rendered-class'
  | 'rendered-style'
  | 'passed-to-component'
  | 'event-handler'
  | 'slot-content'
  // DOM API (TS/JS)
  | 'dom-api';

/**
 * Использование функции в UI-выводе.
 */
export interface HtmlUsage {
  kind: HtmlOutputKind;
  usageId: string | null;
  tag: string;
  target: string;
  line: number;
  column?: number;

  // ⭐ Для kind === 'dom-api'
  domApiCategory?: DomApiCategory;
  domApiMethod?: string;
  domApiTarget?: string;
  domApiContext?: DomApiContext;
}

/**
 * Обратная связь: функция как источник prop.
 *
 * ✅ FIX v16.0.1: этот интерфейс теперь экспортируется как
 * отдельный именованный экспорт. Ранее он был доступен только
 * внутри FullJSON, из-за чего `compact-reporter.ts` не мог его
 * импортировать (TS2305 / TS6133).
 */
export interface PropUsage {
  usageId: string;
  propId: string;
  propName: string;
  tag: string;
  targetFileId: string | null;
}

// ============================================================
// ✅ v16.0.0: DOM API
// ============================================================

/**
 * Категория DOM API-вызова.
 *
 * 50 кодов (см. legend.codes.domApiCategory).
 *
 * ⚠️ DomApiCategory НЕ выносился в types-vue-template.ts:
 *    он не участвует в циклическом импорте и используется
 *    только внутри codec-types.ts.
 */
export type DomApiCategory =
// Слушатели событий (P0)
  | 'add-event-listener'
  | 'remove-event-listener'
  | 'dispatch-event'
  // Создание / вставка (P1)
  | 'create-element'
  | 'append-child'
  | 'insert-before'
  | 'remove-child'
  | 'replace-child'
  | 'clone-node'
  | 'import-node'
  | 'adopt-node'
  // Содержимое (P1)
  | 'inner-html'
  | 'outer-html'
  | 'text-content'
  | 'inner-text'
  | 'insert-adjacent-html'
  | 'insert-adjacent-element'
  | 'insert-adjacent-text'
  // Атрибуты (P1)
  | 'set-attribute'
  | 'remove-attribute'
  | 'get-attribute'
  | 'has-attribute'
  | 'toggle-attribute'
  // Стили (P1)
  | 'class-list'
  | 'class-list-add'
  | 'class-list-remove'
  | 'class-list-toggle'
  | 'dataset'
  | 'set-property'
  | 'style-set'
  | 'style-remove'
  // Запросы (P2)
  | 'query-selector'
  | 'query-selector-all'
  | 'get-element-by-id'
  | 'get-elements-by-class'
  | 'get-elements-by-tag'
  | 'get-elements-by-name'
  | 'closest'
  | 'matches'
  | 'get-root-node'
  // Наблюдатели (P2)
  | 'mutation-observer'
  | 'resize-observer'
  | 'intersection-observer'
  | 'performance-observer'
  // Прочее (P3)
  | 'focus'
  | 'blur'
  | 'scroll-into-view'
  | 'scroll-to'
  | 'click-programmatic'
  | 'other';

/**
 * DOM API-вызов.
 */
export interface DomApiCall {
  /** Уникальный ID (d1, d2, ...) — глобальный */
  id: string;

  /** ID функции-источника */
  functionId: string;

  /** ID файла */
  fileId: string;

  /** Категория вызова */
  category: DomApiCategory;

  /** Эффект (write/read/mixed) */
  effect: DomApiEffect;

  /** Имя метода (appendChild, addEventListener) */
  method: string;

  /** Target (document, window, ref:btn, ...) */
  target: string;

  /** Вид target */
  targetKind: DomApiTargetKind;

  /** Аргументы (сырые строки) */
  args: string[];

  /** Разрешённые аргументы */
  argResolutions: DomApiArg[];

  /** Номер строки */
  line: number;

  /** Номер колонки */
  column?: number;

  /** Контекст вызова */
  context: DomApiContext;
}

/**
 * Обратная связь: функция как обработчик DOM-события.
 */
export interface DomApiHandlerUsage {
  callId: string;
  category: DomApiCategory;
  eventName: string;
  target: string;
  line: number;
}

// ============================================================
// ✅ v16.0.0: VUE SECTION (FullJSON)
// ============================================================

/**
 * Секция Vue-сущностей в FullJSON.
 *
 * ✅ v16.0.0: добавлены componentProps, componentEvents,
 * componentDirectives, componentSlots, htmlInterpolations,
 * fnHtmlUsage, domApiCalls, domApiArgs, ids, sourceChains.
 */
export interface VueSectionFull {
  /** SFC-компоненты */
  sfc: SFCComponent[];
  /** Composables */
  composables: ComposableEntity[];
  /** Макросы */
  macros: MacroEntity[];
  /** Hooks / watchers */
  hooks: HookEntity[];
  /** Реактивные примитивы */
  reactivity: ReactivityEntity[];
  /** Иконки */
  icons: IconEntity[];

  // ==========================================
  // ✅ v16.0.0: обратные связи и DOM API
  // ==========================================

  /** Component props (обратная связь) */
  componentProps?: ComponentProp[];
  /** Component events (обратная связь) */
  componentEvents?: ComponentEvent[];
  /** Component directives */
  componentDirectives?: ComponentDirective[];
  /** Component slots */
  componentSlots?: ComponentSlot[];
  /** HTML interpolations */
  htmlInterpolations?: HtmlInterpolation[];
  /** Function → html usage */
  fnHtmlUsage?: HtmlUsage[];
  /** DOM API calls */
  domApiCalls?: DomApiCall[];
  /** DOM API args */
  domApiArgs?: DomApiArg[];
  /** Сгенерированные id */
  ids?: string[];
  /** Сериализованные sourceChain */
  sourceChains?: string[];
}

// ============================================================
// ✅ v16.0.0: VUE SECTION (CompactJSON)
// ============================================================
//
// СХЕМА (см. legend.schemas['vue.*'])
//
// ✅ v16.0.0: vue.sfc — 30 полей (было 8):
//   f, n, b, c, cs, pn, ps, en, es, xn, xs,
//   cu_sfc, cu_tag, cu_file, cu_src, cu_pkg, cu_l, cu_col,
//   cu_cp, cu_ce, cu_cd, cu_csl,
//   he_sfc, he_tag, he_l, he_col, he_cp, he_cd, he_ce, he_ci
//
// Breaking change:
//   p (props placeholders)   → pn + ps
//   e (emits placeholders)   → en + es
//   x (exposed placeholders) → xn + xs
//
// ✅ v16.0.8-FIX: schemas vue.component* — +1 поле (idn / id)
// ============================================================

export interface VueSectionCompact {
  sfc: {
    f: number[];
    n: number[];
    b: number[];
    c: number[];
    cs: Array<[number, number]>;

    // ⭐ v16.0.0: реальные имена (замена старых p/e/x)
    pn?: number[];
    ps?: Array<[number, number]>;
    en?: number[];
    es?: Array<[number, number]>;
    xn?: number[];
    xs?: Array<[number, number]>;

    // ⭐ v16.0.0: component usages — RLE
    cu_sfc?: [number, number, number?][];
    cu_tag?: number[];
    cu_file?: number[];
    cu_src?: number[];
    cu_pkg?: number[];
    cu_l?: number[];
    cu_col?: number[];
    cu_cp?: Array<[number, number]>;
    cu_ce?: Array<[number, number]>;
    cu_cd?: Array<[number, number]>;
    cu_csl?: Array<[number, number]>;

    // ⭐ v16.0.0: html elements — RLE
    he_sfc?: [number, number, number?][];
    he_tag?: number[];
    he_l?: number[];
    he_col?: number[];
    he_cp?: Array<[number, number]>;
    he_cd?: Array<[number, number]>;
    he_ce?: Array<[number, number]>;
    he_ci?: Array<[number, number]>;
  };
  composables: {
    n: number[];
    f: [number, number][];
    k: number[];
    r: number[];
    v: [number, number][];
  };
  macros: {
    f: number[];
    k: number[];
    l: number[];
  };
  hooks: {
    f: number[];
    n: number[];
    l: number[];
  };
  reactivity: {
    f: number[];
    k: number[];
    l: number[];
    n: number[];
  };
  icons: {
    f: number[];
    n: number[];
    c: number[];
  };

  // ✅ v16.0.0: обратные связи (в CompactJSON они также на top-level)
  componentProps?: {
    n: number[];
    v: number[];
    k: number[];
    l: number[];
    id: number[];
    mc: number[];
    lv: number[];
    sc: [number, number, number?][];
    fns: number[];
    // ✅ v16.0.8-FIX: identifier (индекс в strs, -1 = нет)
    idn?: number[];
  };
  componentEvents?: {
    n: number[];
    h: number[];
    fn: number[];
    s: number[];
    m: number[];
    l: number[];
    sc: [number, number, number?][];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };
  componentDirectives?: {
    n: number[];
    a: number[];
    m: number[];
    v: number[];
    l: number[];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };
  componentSlots?: {
    n: number[];
    sc: number[];
    sn: number[];
    l: number[];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };
  htmlInterpolations?: {
    e: number[];
    sc: [number, number, number?][];
    l: number[];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };
}

// ============================================================
// ПОЛНЫЙ (ЧИТАЕМЫЙ) JSON
// ============================================================

/**
 * Полный (читаемый) JSON отчёта.
 *
 * ✅ v15.0.2: поле conditionals УДАЛЕНО с верхнего уровня.
 * ✅ v15.2.0 (P1): добавлено поле lexicalLinks.
 * ✅ v15.5.0: добавлено поле vue.
 * ✅ v16.0.0: добавлены top-level поля для обратных связей и DOM API.
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

  /** Vue-шаблоны — отдельные сущности */
  templates?: TemplateData[];

  /** ✅ v15.2.0 (P1): лексические связи (parent → child) */
  lexicalLinks?: LexicalLink[];

  /** ✅ v15.5.0: Vue-сущности */
  vue?: VueSectionFull;

  /** Статистика */
  statistics: StatisticsData;

  /** Единый массив рёбер для сводного графа */
  edges?: EdgeData[];

  // ==========================================
  // РАСШИРЕННЫЕ СЕКЦИИ (v9.0.0+)
  // ==========================================

  /** Хуки жизненного цикла */
  lifecycle?: LifecycleHook[];

  /** Side-effects */
  effects?: EffectEdge[];

  /** Provide/Inject рёбра */
  injections?: InjectionEdge[];

  /** Реактивные связи */
  reactivity?: ReactivityEdge[];

  /** Узлы тип-графа */
  types?: TypeNodeData[];

  /** Рёбра использования типов */
  typeRefs?: TypeRefData[];

  // ==========================================
  // ✅ v12.0.0: values mode
  // ==========================================

  /** Режим сериализации values */
  valuesMode?: 'full' | 'relations';

  // ==========================================
  // ✅ v16.0.0: top-level обратные связи
  // ==========================================

  /** Function → html usage */
  fnHtmlUsage?: HtmlUsage[];
  /** Component props (top-level) */
  componentProps?: ComponentProp[];
  /** Component events (top-level) */
  componentEvents?: ComponentEvent[];
  /** Component directives (top-level) */
  componentDirectives?: ComponentDirective[];
  /** Component slots (top-level) */
  componentSlots?: ComponentSlot[];
  /** HTML interpolations (top-level) */
  htmlInterpolations?: HtmlInterpolation[];
  /** DOM API calls (top-level) */
  domApiCalls?: DomApiCall[];
  /** DOM API args (top-level) */
  domApiArgs?: DomApiArg[];
  /** Сериализованные sourceChain (интернированные) */
  sourceChains?: string[];
  /** Сгенерированные id (cu1, he1, d1, cu1:cp6, ...) */
  ids?: string[];
}

// ============================================
// МОДУЛЬ
// ============================================

export interface ModuleData {
  /** Уникальный ID модуля (m1, m2, ...) */
  id: string;
  /** Имя модуля (например, 'core') */
  name: string;
  /** Путь к модулю */
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
//
// ✅ v15.1.0 (P0): добавлено поле parentFunctionId.
// ✅ v15.5.0: добавлено поле vueKind.
// ✅ v16.0.0: добавлены htmlUsage, isHtmlVisible, usagesAsPropSource,
//            domApiCalls, domApiUsagesAsHandler.
// ============================================

export interface FunctionData {
  /** Уникальный ID (fn1, fn2, ...) */
  id: string;
  /** Имя функции */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Строка объявления (1-based) */
  line: number;

  // Флаги
  isExported: boolean;
  isAsync: boolean;
  isArrow: boolean;
  isMethod: boolean;

  /** Параметры */
  params: string[];
  /** Тип возвращаемого значения */
  returnType?: string;

  // Дополнительные флаги (опциональные)
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

  /** ✅ v15.1.0 (P0): ID лексического родителя */
  parentFunctionId?: string | null;

  /** ✅ v15.5.0: Vue-классификация */
  vueKind?: VueKind;

  // ==========================================
  // ✅ v16.0.0: HTML / DOM API
  // ==========================================

  /** HTML-вывод функции */
  htmlUsage?: HtmlUsage[];

  /** Влияет ли функция на UI */
  isHtmlVisible?: boolean;

  /** Обратная связь: функция как источник props */
  usagesAsPropSource?: PropUsage[];

  /** DOM API-вызовы (ID) */
  domApiCalls?: string[];

  /** Обратная связь: функция как обработчик DOM-события */
  domApiUsagesAsHandler?: DomApiHandlerUsage[];
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

export interface ImportData {
  id: string;
  fromFileId: string;
  /** ID файла-цели (f1, f2, ...) или null */
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

  /** ✅ v15.0.4: признаки реэкспорта */
  isReExport?: boolean;
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

  /** Вид вызова (старое поле) */
  type: 'direct' | 'async' | 'method' | 'callback';

  /** ✅ v15.3.0 (P2): точная колонка */
  column?: number;

  /** ✅ v15.3.0 (P2): расширенный вид вызова */
  callKind?:
    | 'direct'
    | 'method'
    | 'callback'
    | 'constructor'
    | 'tagged-template'
    | 'optional-chain'
    | 'spread'
    | 'new';

  /** ✅ v15.3.0 (P2): имя callee */
  calleeName?: string;

  /** ✅ v15.3.0 (P2): индекс аргумента */
  argumentIndex?: number;
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

  /** ✅ v15.0.2: условный рендеринг */
  conditionals?: TemplateConditional[];
}

// ============================================
// LIFECYCLE
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
// EFFECTS
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
// INJECTIONS
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
// REACTIVITY
// ============================================

export type ReactivityKind =
  'computed' | 'watch' | 'watchEffect' | 'ref' | 'reactive' | 'shallowRef' | 'readonly';

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
// TYPES
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

/**
 * Статистика.
 *
 * ✅ v16.0.0: добавлены 8 новых счётчиков.
 */
export interface StatisticsData {
  // Существующие 18 (15.7.3)
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
  totalConditionals?: number;
  totalLexicalLinks?: number;
  totalVueSfc?: number;
  totalComposables?: number;
  totalMacros?: number;
  totalHooks?: number;
  totalReactivity?: number;
  totalIcons?: number;

  // ✅ v16.0.0: новые 8 счётчиков
  totalComponentUsages?: number;
  totalHtmlElements?: number;
  totalComponentProps?: number;
  totalComponentEvents?: number;
  totalDomApiCalls?: number;
  totalSourceChains?: number;
  totalHtmlVisibleFns?: number;
  totalDomApiVisibleFns?: number;
}

// ============================================
// ЕДИНОЕ РЕБРО ГРАФА
// ============================================

export interface EdgeData {
  from: string;
  to: string;
  type: 'import' | 'export' | 'call' | 're-export' | 'lexical';
  symbol?: string;
  line?: number;
}

// ============================================================
// СЖАТЫЙ JSON (v16.0.8)
// ============================================================

export interface CompactJSON {
  /** Version */
  v: string;

  /** Timestamp */
  ts: string;

  /** Root module index */
  r: number;

  /** ✅ v12.0.0: режим сериализации values */
  valuesMode?: 'full' | 'relations';

  /** Токены для словарей строк */
  tokens: (string | number)[];

  /** Токенизированный stringDict */
  strs: (string | number[])[];

  /**
   * Токенизированный paramDict.
   *
   * ✅ v16.0.1: тип `(string | number[])[]` — массив может содержать
   * либо строку, либо массив индексов токенов произвольной длины
   * (encodeStr возвращает массив индексов, а не пару [number, number]).
   */
  params: (string | number[])[];

  /** Токенизированный methodDict */
  methods: (string | number[])[];

  /** valueDict — без изменений */
  values: unknown[];

  /** Module index: columnar */
  mi: {
    n: string[];
    f: [number, number][];
  };

  /** File index: columnar */
  fl: {
    p: string[];
    m: [number, number][];
  };

  /**
   * Functions: columnar.
   *
   * ✅ v16.0.1: добавлено поле `hv` — RLE для `isHtmlVisible` (0/1).
   * Это устраняет расхождение L1/L2/DL: `decode(compact).functions[].isHtmlVisible`
   * теперь восстанавливается как `false`, а не `undefined`.
   *
   * Схема (10 полей): n, m, f, l, fl, p, rt, parent, vk, hv
   */
  fns: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    p: number[][];
    rt: number[];
    parent?: [number, number][];
    vk?: [number, number][];
    /** ✅ v16.0.1: isHtmlVisible (0 | 1), RLE */
    hv?: [number, number][];
  };

  /** Classes: columnar */
  cls: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    methods: number[][];
  };

  /** Constants: columnar */
  cn: {
    n: number[];
    m: [number, number][];
    f: [number, number][];
    l: number[];
    fl: number[];
    nonEmptyV: [number, number][];
  };

  /** Graph — все связи в одном месте */
  gr: {
    e: {
      m: number[];
      f: number[];
      fn: number[];
      l: number[];
      ty: number[];
      en: number[];
      ln: number[];
      s: number[];
      flags: number[];
    };
    i: {
      ff: number[];
      tf: number[];
      s: number[];
      im: number[];
      ln: number[];
      l: number[];
      ty: number[];
    };
    c: {
      f: number[];
      t: number[];
      l: number[];
      ty: number[];
      col?: number[];
      ck?: number[];
      cn?: number[];
      ai?: number[];
    };
    re: {
      m: number[];
      fn: number[];
      s: number[];
      en: number[];
      l: number[];
      ty: number[];
    };
  };

  // Расширенные секции
  vt?: number[];
  lc?: number[];
  ef?: number[];
  inj?: number[];
  rx?: number[];
  cd?: number[];
  ty?: number[];
  tr?: number[];

  /** ✅ v15.2.0 (P1): columnar-секция lx */
  lx?: {
    p: [number, number][];
    c: [number, number][];
    r: number[];
    l: number[];
    ai: number[];
    cn: number[];
  };

  /** ✅ v15.5.0: Vue-сущности (columnar + RLE) */
  vue?: VueSectionCompact;

  // ==========================================
  // ✅ v16.0.0: НОВЫЕ TOP-LEVEL СЕКЦИИ
  // ==========================================

  /** Function → html usage */
  fnHtmlUsage?: {
    fn: number[];
    k: number[];
    u: number[];
    t: number[];
    tg: number[];
    l: number[];
    col: number[];
    dcat: number[];
    dctx: number[];
  };

  /** Component props */
  componentProps?: {
    n: number[];
    v: number[];
    k: number[];
    l: number[];
    id: number[];
    mc: number[];
    lv: number[];
    sc: [number, number, number?][];
    fns: number[];
    // ✅ v16.0.8-FIX: identifier (индекс в strs, -1 = нет)
    idn?: number[];
  };

  /** Component events */
  componentEvents?: {
    n: number[];
    h: number[];
    fn: number[];
    s: number[];
    m: number[];
    l: number[];
    sc: [number, number, number?][];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };

  /** Component directives */
  componentDirectives?: {
    n: number[];
    a: number[];
    m: number[];
    v: number[];
    l: number[];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };

  /** Component slots */
  componentSlots?: {
    n: number[];
    sc: number[];
    sn: number[];
    l: number[];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };

  /** HTML interpolations */
  htmlInterpolations?: {
    e: number[];
    sc: [number, number, number?][];
    l: number[];
    // ✅ v16.0.8-FIX: id (индекс в ids[])
    id?: number[];
  };

  /** DOM API calls */
  domApiCalls?: {
    fn: number[];
    f: [number, number, number?][];
    cat: number[];
    eff: number[];
    m: number[];
    t: number[];
    tk: number[];
    l: number[];
    col: number[];
    argSlices: [number, number][];
    en: number[];
    hfn: number[];
    hs: number[];
    sel: number[];
    hv: number[];
    cn: number[];
    sp: number[];
    an: number[];
    oo: number[];
  };

  /** DOM API args */
  domApiArgs?: {
    r: number[];
    k: number[];
    fn: number[];
    s: number[];
  };

  /** ✅ v16.0.0: сгенерированные id (append-only) */
  ids?: string[];

  /** ✅ v16.0.0: сериализованные sourceChain (append-only) */
  sourceChains?: string[];

  /** Statistics */
  st: StatisticsData;

  /** Legend (version + codes + flags + schemas) */
  legend: CodecLegend;
}

// ============================================================
// ЛЕГЕНДА (v16.0.8)
// ============================================================

/** Один бит в поле flags */
export interface FlagBit {
  bit: number;
  name: string;
  description: string;
}

/** Словарь { код: описание } */
export interface CodesDict {
  [code: string]: string;
}

/**
 * Легенда — все словари и схемы для декодирования.
 *
 * ✅ v16.0.0: добавлено поле `version` (в 15.7.3 отсутствовало).
 * ✅ v16.0.0: +10 словарей в codes, +11 схем.
 * ✅ v16.0.1: `schemas.fns` расширена до 10 полей (добавлено 'hv').
 * ✅ v16.0.8-FIX: `schemas['vue.componentProps']` — 10 полей (добавлено 'idn').
 *                `schemas['vue.componentEvents']` — 8 полей (добавлено 'id').
 *                `schemas['vue.componentDirectives']` — 6 полей (добавлено 'id').
 *                `schemas['vue.componentSlots']` — 5 полей (добавлено 'id').
 *                `schemas['vue.htmlInterpolations']` — 4 поля (добавлено 'id').
 */
export interface CodecLegend {
  /** ✅ v16.0.0: версия legend */
  version?: string;

  /** Расшифровка строковых кодов */
  codes: {
    // Существующие 19 (15.7.3)
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
    lexicalRelation?: CodesDict;
    callKind?: CodesDict;
    vueKind?: CodesDict;
    sfcBlock?: CodesDict;
    hookName?: CodesDict;
    reactivityKind?: CodesDict;
    iconCategory?: CodesDict;
    composableKind?: CodesDict;

    // ✅ v16.0.0: новые 10 словарей
    componentSource?: CodesDict;
    propKind?: CodesDict;
    eventHandlerSource?: CodesDict;
    htmlOutputKind?: CodesDict;
    sourceChainKind?: CodesDict;
    domApiCategory?: CodesDict;
    domApiEffect?: CodesDict;
    domApiTargetKind?: CodesDict;
    domApiArgKind?: CodesDict;
    domApiArgSource?: CodesDict;
  };

  /** Расшифровка битовых флагов */
  flags: {
    bits: Record<string, string>;
  };

  /** Позиционные схемы кортежей */
  schemas: {
    mi: string[];
    fl: string[];

    /**
     * ✅ v16.0.1: 10 полей: n, m, f, l, fl, p, rt, parent, vk, hv.
     * Ранее было 9 полей (без 'hv'). Изменение связано с добавлением
     * RLE-массива для `isHtmlVisible` в CompactJSON.fns.
     */
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

    /** ✅ v15.2.0 (P1): схема lx */
    lx?: string[];

    // ==========================================
    // ✅ v15.5.0 + v16.0.0: схемы Vue-секции
    // ==========================================

    /** ✅ v16.0.0: 30 полей (было 8) */
    'vue.sfc'?: string[];

    'vue.composables'?: string[];
    'vue.macros'?: string[];
    'vue.hooks'?: string[];
    'vue.reactivity'?: string[];
    'vue.icons'?: string[];

    // ✅ v16.0.0: новые схемы
    // ✅ v16.0.8-FIX: длины увеличены на 1 (добавлены idn / id)
    'vue.componentProps'?: string[];
    'vue.componentEvents'?: string[];
    'vue.componentDirectives'?: string[];
    'vue.componentSlots'?: string[];
    'vue.htmlInterpolations'?: string[];
    'vue.fnHtmlUsage'?: string[];
    domApiCalls?: string[];
    domApiArgs?: string[];
    ids?: string[];
    // sourceChains НЕ включается — это массив строк, а не объект
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

  /** ✅ v12.0.0: режим сериализации values */
  valuesMode?: 'full' | 'relations';

  /** Включать тела функций в отчёт */
  includeBody?: boolean;

  /** Включать VSCode-ссылки */
  includeVSCode?: boolean;

  /**
   * ✅ v16.0.7: корень проекта (абсолютный путь).
   *
   * ════════════════════════════════════════════════════════════
   * ЗАЧЕМ ЭТО ПОЛЕ
   * ════════════════════════════════════════════════════════════
   *
   * ПРИЧИНА БАГА v16.0.6:
   *   При запуске `compact-recursive ./infoenergo-ui/src/index.ts`
   *   из корня пакета `ast-analyzer`, `process.cwd()` = корень
   *   пакета. Но Vue SFC лежат в `infoenergo-ui/src/`.
   *
   *   `DiscoverFilesStage` v1.1.0 нормализует пути относительно
   *   `ctx.options.projectRoot` (например, `infoenergo-ui/src/`),
   *   поэтому `sfcFile.path` = `components/icons/AiCrossIcon.vue`.
   *
   *   Но `compact-reporter.ts::collectFullJSON` использовал
   *   `process.cwd()` для резолвинга, и получалось:
   *     path.resolve('/.../ast-analyzer', 'components/icons/AiCrossIcon.vue')
   *     = '/.../ast-analyzer/components/icons/AiCrossIcon.vue'
   *
   *   Файл не находился → все 75 SFC пропускались →
   *   `componentUsages`/`htmlElements` = 0.
   *
   * ════════════════════════════════════════════════════════════
   * РЕШЕНИЕ
   * ════════════════════════════════════════════════════════════
   *
   *   Пробрасываем `ctx.options.projectRoot` из pipeline в
   *   `generateCompactReport` через это поле. `collectFullJSON`
   *   использует переданное значение вместо `process.cwd()`.
   *
   * ════════════════════════════════════════════════════════════
   * ГДЕ УСТАНАВЛИВАЕТСЯ
   * ════════════════════════════════════════════════════════════
   *
   *   - `pipeline/stages/build-report.ts`:
   *       generateCompactReport(ctx.enhancedMap, outputPath, {
   *         ...
   *         projectRoot: options.projectRoot,
   *       });
   *
   * ════════════════════════════════════════════════════════════
   * ПОВЕДЕНИЕ ПО УМОЛЧАНИЮ
   * ════════════════════════════════════════════════════════════
   *
   *   Если поле не задано — используется `process.cwd()`
   *   (обратная совместимость). Но при работе через pipeline
   *   это поле ВСЕГДА будет заполнено.
   */
  projectRoot?: string;
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
    valuesMode?: 'full' | 'relations';
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

  /** ✅ v12.0.0: режим сериализации values */
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
    lexicalLinksDiff?: number;
    vueDiff?: number;
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
// RLE ТИП
// ============================================

/**
 * RLE-массив.
 *
 * Формат: [start, length, value?]
 *   - value определён  → RLE повторяющегося значения
 *   - value отсутствует → RLE последовательности индексов
 */
export type RleArray = Array<[number, number, number?]>;

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  CODEC_VERSION,
  LEGEND_VERSION,
};
