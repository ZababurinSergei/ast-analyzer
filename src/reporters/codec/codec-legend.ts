// src/reporters/codec/codec-legend.ts
// ============================================
// ЛЕГЕНДА КОДЕКА (v16.0.2)
// ============================================
// Версия: 16.0.2
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.0.2 (синхронизация с симметричным round-trip):
//   - ✅ ОБНОВЛЕНО: schemas.fns — 10 полей (n, m, f, l, fl, p, rt,
//     parent, vk, hv). Поле 'hv' добавлено в v16.0.1, схема
//     синхронизирована с codec-decode.ts / codec-encode.ts /
//     compact-reporter.ts.
//   - ✅ ОБНОВЛЕНО: комментарий к схеме vue.sfc — 30 полей.
//   - ✅ ОБНОВЛЕНО: комментарий к vue.sfc.cu_sfc / he_sfc —
//     RLE [start, length, value?].
//   - ✅ СИНХРОНИЗИРОВАНО с:
//       • codec-types.ts   (CODEC_VERSION = '16.0.2', LEGEND_VERSION = '2.0.0')
//       • codec-encode.ts  (v16.0.1)
//       • codec-decode.ts  (v16.0.2)
//       • scripts/verify-roundtrip.ts (v16.0.3)
//       • scripts/verify-consistency.ts (v3.4.2)
//
// v16.0.1 (fix: schemas.fns — 10 полей):
//   - ✅ ИСПРАВЛЕНО: SCHEMAS.fns расширена до 10 полей.
//     Добавлено поле 'hv' в конец массива.
//     Причина: в v16.0.0 было добавлено поле `isHtmlVisible`
//     в `FunctionData`, но оно НЕ кодировалось в CompactJSON.
//     В v16.0.1 добавлено RLE-поле `fns.hv`.
//
//     Было: ['n','m','f','l','fl','p','rt','parent','vk']       (9)
//     Стало: ['n','m','f','l','fl','p','rt','parent','vk','hv']  (10)
//
//     Синхронизировано с:
//       - src/reporters/codec/codec-types.ts (CompactJSON.fns.hv)
//       - src/reporters/codec/codec-encode.ts (fnsHv + fns.hv)
//       - src/reporters/codec/codec-decode.ts (чтение fns.hv)
//       - scripts/verify-roundtrip.ts (checkLegendStructure: fns → 10)
//
// v16.0.0 (major — несовместимое расширение схем):
//   - ✅ BREAKING: vue.sfc — 8 → 30 полей
//   - ✅ BREAKING: +10 новых словарей в legend.codes (итого 29)
//   - ✅ BREAKING: +11 новых схем в legend.schemas
//   - ✅ ВВЕДЕНО: legend.version = '2.0.0' (в 15.7.3 отсутствовало)
//   - ✅ ДОБАВЛЕНО: DOM_* константы (9 штук)
//   - ✅ ДОБАВЛЕНО: COMPONENT_SOURCE_CODES, PROP_KIND_CODES,
//      EVENT_HANDLER_SOURCE_CODES, SOURCE_CHAIN_KIND_CODES,
//      HTML_OUTPUT_KIND_CODES
//
// v15.7.3 (уточнение семантики vue.sfc.c):
//   - ✅ ОБНОВЛЕНО: комментарий к схеме `vue.sfc`
//   - ✅ ОБНОВЛЕНО: заголовок v15.7.2 → v15.7.3
//
// v15.7.2 (fix round-trip vue.sfc.composables):
//   - ✅ ДОБАВЛЕНО: поле `cs` в схеме `vue.sfc`
//
// v15.5.0 (Vue-сущности):
//   - ✅ ДОБАВЛЕНО: codes.vueKind (7 кодов)
//   - ✅ ДОБАВЛЕНО: codes.sfcBlock (4 кода)
//   - ✅ ДОБАВЛЕНО: codes.hookName (12 кодов)
//   - ✅ ДОБАВЛЕНО: codes.reactivityKind (8 кодов)
//   - ✅ ДОБАВЛЕНО: codes.iconCategory (4 кода)
//   - ✅ ДОБАВЛЕНО: codes.composableKind (4 кода)
//   - ✅ ДОБАВЛЕНО: schemas.fns += 'vk'
//   - ✅ ДОБАВЛЕНО: schemas vue.*
//
// v15.4.0 (P3 — cross-file):
// v15.3.0 (P2 — расширенный CallData):
// v15.2.0 (P1 — lexicalLinks):
// v15.1.0 (P0 — parentFunctionId):
// v15.0.5 (gr.i.tf — индекс в fl.p):
// v15.0.4 (isReExport / isStarReExport в gr.i.ty):
// v15.0.2 (устранение дублирования conditionals):
// v13.0.0 (columnar-структура):
// v12.0.0 (структурная оптимизация):
//
// ════════════════════════════════════════════════════════════
// v16.0.2-FIX (round-trip: identifier + id для top-level component*):
//   - ✅ ИСПРАВЛЕНО: схема `vue.componentProps` расширена полем 'idn'
//     (identifier — первый идентификатор в value). Ранее identifier
//     кодировался, но не восстанавливался при decode → L1/L2/DL
//     падали с `null → "a"`.
//   - ✅ ИСПРАВЛЕНО: схемы `vue.componentEvents`, `vue.componentDirectives`,
//     `vue.componentSlots`, `vue.htmlInterpolations` расширены полем 'id'
//     (индекс в ids[]). Ранее id/usageId не восстанавливались → decode
//     возвращал `''`, а full содержал реальные `cu1:ce1` / `he2:hi1`.
//   - ✅ СИНХРОНИЗИРОВАНО с codec-encode.ts (FIX), codec-decode.ts (FIX),
//     codec-types.ts (FIX), scripts/verify-roundtrip.ts (FIX),
//     scripts/verify-wild-card.ts (FIX).
// ============================================

import type { CodecLegend, CodesDict } from './codec-types.js';

import {
  // ✅ Существующие словари
  FLAG_MAP,
  EXPORT_TYPES,
  CALL_TYPES,
  RE_EXPORT_TYPES,
  LIFECYCLE_TYPES,
  EFFECT_TYPES,
  INJECTION_TYPES,
  REACTIVITY_TYPES,
  CONDITIONAL_TYPES,
  TYPE_KINDS,
  TYPE_USAGE_KINDS,

  // ✅ v15.2.0 (P1)
  LEXICAL_RELATION_CODES,

  // ✅ v15.3.0 (P2)
  CALL_KIND_CODES,
} from './codec-encode.js';

// ============================================================
// ✅ v15.5.0: VUE-КОДЫ
// ============================================================

/**
 * Коды для vueKind: 0..6.
 */
export const VUE_KIND_CODES: Record<string, number> = {
  function: 0,
  composable: 1,
  macro: 2,
  hook: 3,
  reactivity: 4,
  callback: 5,
  arrow: 6,
};

/**
 * Коды для SFC-блоков: 1=script, 2=script-setup, 4=template, 8=style.
 */
export const SFC_BLOCK_CODES: Record<string, number> = {
  script: 1,
  'script-setup': 2,
  template: 4,
  style: 8,
};

/**
 * Коды для hookName: 0..11.
 */
export const HOOK_NAME_CODES: Record<string, number> = {
  onMounted: 0,
  onUnmounted: 1,
  onActivated: 2,
  onDeactivated: 3,
  onErrorCaptured: 4,
  onScopeDispose: 5,
  watch: 6,
  watchEffect: 7,
  onBeforeMount: 8,
  onBeforeUnmount: 9,
  onUpdated: 10,
  onBeforeUpdate: 11,
};

/**
 * Коды для reactivityKind: 0..7.
 */
export const REACTIVITY_KIND_CODES: Record<string, number> = {
  computed: 0,
  ref: 1,
  reactive: 2,
  watch: 3,
  shallowRef: 4,
  readonly: 5,
  toRef: 6,
  toRefs: 7,
};

/**
 * Коды для iconCategory: 0..3.
 */
export const ICON_CATEGORY_CODES: Record<string, number> = {
  base: 0,
  filter: 1,
  toolbar: 2,
  sort: 3,
};

/**
 * Коды для composableKind: 0..3.
 */
export const COMPOSABLE_KIND_CODES: Record<string, number> = {
  composable: 0,
  store: 1,
  factory: 2,
  utility: 3,
};

/**
 * Коды для composableReturnShape: 0..4.
 */
export const COMPOSABLE_RETURN_SHAPE_CODES: Record<string, number> = {
  void: 0,
  object: 1,
  ref: 2,
  reactive: 3,
  function: 4,
};

/**
 * Коды для macroKind: 0..5.
 */
export const MACRO_KIND_CODES: Record<string, number> = {
  props: 0,
  emits: 1,
  expose: 2,
  slots: 3,
  model: 4,
  options: 5,
};

// ============================================================
// ✅ v16.0.0: DOM API CODES
// ============================================================

/**
 * Коды для domApiCategory: 0..49.
 *
 * ⚠️ Синхронизировано с legend.codes.domApiCategory.
 * ⚠️ Синхронизировано с DOM_METHOD_MAP + DOM_PROPERTY_MAP +
 *    DOM_OBSERVER_MAP в dom-api-detector.ts.
 */
export const DOM_CATEGORY_CODES: Record<string, number> = {
  'add-event-listener': 0,
  'remove-event-listener': 1,
  'dispatch-event': 2,
  'create-element': 3,
  'append-child': 4,
  'insert-before': 5,
  'remove-child': 6,
  'replace-child': 7,
  'clone-node': 8,
  'import-node': 9,
  'adopt-node': 10,
  'inner-html': 11,
  'outer-html': 12,
  'text-content': 13,
  'inner-text': 14,
  'insert-adjacent-html': 15,
  'insert-adjacent-element': 16,
  'insert-adjacent-text': 17,
  'set-attribute': 18,
  'remove-attribute': 19,
  'get-attribute': 20,
  'has-attribute': 21,
  'toggle-attribute': 22,
  'class-list': 23,
  'class-list-add': 24,
  'class-list-remove': 25,
  'class-list-toggle': 26,
  dataset: 27,
  'set-property': 28,
  'style-set': 29,
  'style-remove': 30,
  'query-selector': 31,
  'query-selector-all': 32,
  'get-element-by-id': 33,
  'get-elements-by-class': 34,
  'get-elements-by-tag': 35,
  'get-elements-by-name': 36,
  closest: 37,
  matches: 38,
  'get-root-node': 39,
  'mutation-observer': 40,
  'resize-observer': 41,
  'intersection-observer': 42,
  'performance-observer': 43,
  focus: 44,
  blur: 45,
  'scroll-into-view': 46,
  'scroll-to': 47,
  'click-programmatic': 48,
  other: 49,
};

/**
 * Коды для domApiEffect: 0..2.
 */
export const DOM_EFFECT_CODES: Record<string, number> = {
  write: 0,
  read: 1,
  mixed: 2,
};

/**
 * Коды для domApiTargetKind: 0..6.
 */
export const DOM_TARGET_KIND_CODES: Record<string, number> = {
  document: 0,
  window: 1,
  element: 2,
  query: 3,
  ref: 4,
  variable: 5,
  unknown: 6,
};

/**
 * Коды для domApiArgKind: 0..7.
 */
export const DOM_ARG_KIND_CODES: Record<string, number> = {
  'literal-string': 0,
  'literal-number': 1,
  'literal-bool': 2,
  identifier: 3,
  member: 4,
  call: 5,
  arrow: 6,
  object: 7,
};

/**
 * Коды для domApiArgSource: 0..3.
 */
export const DOM_ARG_SOURCE_CODES: Record<string, number> = {
  local: 0,
  import: 1,
  global: 2,
  unknown: 3,
};

// ============================================================
// ✅ v16.0.0: COMPONENT USAGE CODES
// ============================================================

/**
 * Коды для componentSource: 0..4.
 */
export const COMPONENT_SOURCE_CODES: Record<string, number> = {
  local: 0,
  global: 1,
  builtin: 2,
  dynamic: 3,
  unknown: 4,
};

/**
 * Коды для propKind: 0..3.
 */
export const PROP_KIND_CODES: Record<string, number> = {
  static: 0,
  dynamic: 1,
  boolean: 2,
  spread: 3,
};

/**
 * Коды для eventHandlerSource: 0..4.
 */
export const EVENT_HANDLER_SOURCE_CODES: Record<string, number> = {
  local: 0,
  import: 1,
  global: 2,
  inline: 3,
  unknown: 4,
};

/**
 * Коды для sourceChainKind: 0..8.
 */
export const SOURCE_CHAIN_KIND_CODES: Record<string, number> = {
  local: 0,
  import: 1,
  prop: 2,
  emit: 3,
  global: 4,
  literal: 5,
  member: 6,
  call: 7,
  unknown: 8,
};

/**
 * Коды для htmlOutputKind: 0..9.
 */
export const HTML_OUTPUT_KIND_CODES: Record<string, number> = {
  'rendered-text': 0,
  'rendered-attr': 1,
  'rendered-cond': 2,
  'rendered-list': 3,
  'rendered-class': 4,
  'rendered-style': 5,
  'passed-to-component': 6,
  'event-handler': 7,
  'slot-content': 8,
  'dom-api': 9,
};

// ============================================================
// SCHEMAS — ПОЗИЦИОННЫЕ СХЕМЫ КОРТЕЖЕЙ
// ============================================================
//
// Схемы отражают columnar-структуру compact.json.
//
// ✅ v16.0.0: добавлены 11 новых схем (итого 28+11=39+).
// ✅ v16.0.2: schemas.fns расширена до 10 полей (добавлено 'hv').
//            Схема vue.sfc — 30 полей (было 8 в v15.7.3).
// ✅ v16.0.2-FIX: схемы vue.componentProps/Events/Directives/Slots/
//    htmlInterpolations расширены полем 'idn' (identifier) и 'id'
//    (индекс в ids[]). Ранее при decode терялись identifier и id/usageId,
//    что ломало L1/L2/DL/RE/ENC/DEC.
// ============================================================

export const SCHEMAS: CodecLegend['schemas'] = {
  // ==========================================
  // mi — модули
  // ==========================================
  mi: ['n', 'f'],

  // ==========================================
  // fl — файлы
  // ==========================================
  fl: ['p', 'm'],

  // ==========================================
  // fns — функции: 10 параллельных массивов
  // ==========================================
  //
  // ✅ v16.0.2: добавлено поле 'hv' (isHtmlVisible, RLE 0/1).
  // Раньше было 9 полей, теперь 10.
  //
  // Синхронизировано с:
  //   - src/reporters/codec/codec-types.ts (CompactJSON.fns.hv)
  //   - src/reporters/codec/codec-encode.ts (fnsHv + fns.hv)
  //   - src/reporters/codec/codec-decode.ts (чтение fns.hv)
  //   - scripts/verify-roundtrip.ts (checkLegendStructure: 10)
  //
  //   n     — nameIdx в strs (имя функции)
  //   m     — moduleIdx (RLE)
  //   f     — fileIdx (RLE)
  //   l     — line
  //   fl    — flags (битовая маска)
  //   p     — paramsIdx[] (индексы в params)
  //   rt    — returnTypeIdx в strs (-1 = нет)
  //   parent — parentFunctionIdx (RLE, -1 = top-level)
  //   vk    — vueKindCode (RLE)
  //   hv    — isHtmlVisible (RLE 0/1)  ⭐ v16.0.2
  // ==========================================
  fns: ['n', 'm', 'f', 'l', 'fl', 'p', 'rt', 'parent', 'vk', 'hv'],

  // ==========================================
  // cls — классы
  // ==========================================
  cls: ['n', 'm', 'f', 'l', 'fl', 'methods'],

  // ==========================================
  // cn — константы
  // ==========================================
  cn: ['n', 'm', 'f', 'l', 'fl', 'nonEmptyV'],

  // ==========================================
  // gr.e — экспорты
  // ==========================================
  'gr.e': ['m', 'f', 'fn', 'l', 'ty', 'en', 'ln', 's', 'flags'],

  // ==========================================
  // gr.i — импорты
  // ==========================================
  'gr.i': ['ff', 'tf', 's', 'im', 'ln', 'l', 'ty'],

  // ==========================================
  // gr.c — вызовы
  // ==========================================
  'gr.c': ['f', 't', 'l', 'ty', 'col', 'ck', 'cn', 'ai'],

  // ==========================================
  // gr.re — реэкспорты
  // ==========================================
  'gr.re': ['m', 'fn', 's', 'en', 'l', 'ty'],

  // ==========================================
  // vt — Vue шаблоны
  // ==========================================
  vt: [
    'fileIdx',
    'moduleIdx',
    'complexity',
    'reactivityDepsIdx',
    'eventHandlers',
    'dynamicComponents',
    'directivesIdx',
    'usedComponentsIdx',
    'templateRefs',
    'cssVariables',
    'deepSelectors',
    'slotsIdx',
  ],

  // ==========================================
  // vt.eventHandlers
  // ==========================================
  'vt.eventHandlers': [
    'eventNameIdx',
    'handlerNameIdx',
    'tagIdx',
    'line',
    'modifiersIdx',
    'isExternal',
  ],

  // ==========================================
  // vt.dynamicComponents
  // ==========================================
  'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],

  // ==========================================
  // vt.templateRefs
  // ==========================================
  'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],

  // ==========================================
  // vt.cssVariables
  // ==========================================
  'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],

  // ==========================================
  // vt.deepSelectors
  // ==========================================
  'vt.deepSelectors': ['selectorIdx', 'line'],

  // ==========================================
  // lc — lifecycle
  // ==========================================
  lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],

  // ==========================================
  // ef — effects
  // ==========================================
  ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],

  // ==========================================
  // inj — injections
  // ==========================================
  inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],

  // ==========================================
  // rx — reactivity
  // ==========================================
  rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],

  // ==========================================
  // cd — conditionals
  // ==========================================
  cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],

  // ==========================================
  // ty — types
  // ==========================================
  ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line', 'membersIdx', 'extendsIdx'],

  // ==========================================
  // tr — typeRefs
  // ==========================================
  tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],

  // ==========================================
  // lx — lexicalLinks
  // ==========================================
  lx: ['p', 'c', 'r', 'l', 'ai', 'cn'],

  // ==========================================
  // ✅ v16.0.2: vue.sfc — 30 полей
  // ==========================================
  //
  // ⚠️ BREAKING CHANGE относительно 15.7.3:
  //   Старая схема: ['f','n','b','c','cs','p','e','x']   (8 полей)
  //   Новая схема:  30 полей (см. ниже)
  //
  //   p → pn + ps
  //   e → en + es
  //   x → xn + xs
  //
  // ⚠️ Индексы 5, 6, 7 СДВИГАЮТСЯ. Клиенты, использующие
  //    числовые литералы, ОБЯЗАНЫ перейти на именованные ключи
  //    через legend.schemas['vue.sfc'].indexOf(...).
  //
  // Схема:
  //   f       — fileIdx в fl.p
  //   n       — nameIdx в strs
  //   b       — bitmask блоков SFC
  //   c       — индексы в strs (имена composables)
  //   cs      — slices [offset, count] для разбиения c по SFC
  //   pn      — nameIdx для props
  //   ps      — slices [offset, count] для props
  //   en      — nameIdx для emits
  //   es      — slices [offset, count] для emits
  //   xn      — nameIdx для exposed
  //   xs      — slices [offset, count] для exposed
  //   cu_sfc  — RLE [start, length, value?] → SFC-индекс
  //   cu_tag  — индексы в strs
  //   cu_file — индексы в fl.p (-1 = null)
  //   cu_src  — коды COMPONENT_SOURCE_BY_CODE
  //   cu_pkg  — индексы в strs (-1 = нет пакета)
  //   cu_l    — line
  //   cu_col  — column (-1 = нет)
  //   cu_cp   — slices [offset, count] для props
  //   cu_ce   — slices [offset, count] для events
  //   cu_cd   — slices [offset, count] для directives
  //   cu_csl  — slices [offset, count] для slots
  //   he_sfc  — RLE [start, length, value?] → SFC-индекс
  //   he_tag  — индексы в strs
  //   he_l    — line
  //   he_col  — column (-1 = нет)
  //   he_cp   — slices [offset, count] для props
  //   he_cd   — slices [offset, count] для directives
  //   he_ce   — slices [offset, count] для events
  //   he_ci   — slices [offset, count] для interpolations
  // ==========================================
  'vue.sfc': [
    'f',
    'n',
    'b',
    'c',
    'cs',
    'pn',
    'ps',
    'en',
    'es',
    'xn',
    'xs',
    'cu_sfc',
    'cu_tag',
    'cu_file',
    'cu_src',
    'cu_pkg',
    'cu_l',
    'cu_col',
    'cu_cp',
    'cu_ce',
    'cu_cd',
    'cu_csl',
    'he_sfc',
    'he_tag',
    'he_l',
    'he_col',
    'he_cp',
    'he_cd',
    'he_ce',
    'he_ci',
  ],

  // ==========================================
  // vue.composables
  // ==========================================
  //
  //   n — nameIdx в strs
  //   f — fileIdx в fl.p (RLE)
  //   k — composableKindCode
  //   r — composableReturnShapeCode
  //   v — [index, returnedKeysCount]
  // ==========================================
  'vue.composables': ['n', 'f', 'k', 'r', 'v'],

  // ==========================================
  // vue.macros
  // ==========================================
  //
  //   f — fileIdx
  //   k — macroKindCode
  //   l — line
  // ==========================================
  'vue.macros': ['f', 'k', 'l'],

  // ==========================================
  // vue.hooks
  // ==========================================
  //
  //   f — fileIdx
  //   n — hookNameCode
  //   l — line
  // ==========================================
  'vue.hooks': ['f', 'n', 'l'],

  // ==========================================
  // vue.reactivity
  // ==========================================
  //
  //   f — fileIdx
  //   k — reactivityKindCode
  //   l — line
  //   n — nameIdx в strs (-1 = нет)
  // ==========================================
  'vue.reactivity': ['f', 'k', 'l', 'n'],

  // ==========================================
  // vue.icons
  // ==========================================
  //
  //   f — fileIdx
  //   n — nameIdx в strs
  //   c — iconCategoryCode
  // ==========================================
  'vue.icons': ['f', 'n', 'c'],

  // ==========================================
  // ✅ v16.0.0: component props / events / directives / slots
  // ==========================================
  //
  // ⚠️ v16.0.2: эти секции — соседи sfc, не вложены в него.
  // Их значения сгруппированы по usageId через cu_cp/cu_ce/...
  // slices.
  //
  // ✅ v16.0.2-FIX: добавлено поле 'idn' (identifier) в componentProps
  //    и поле 'id' (индекс в ids[]) в componentEvents/Directives/
  //    Slots/Interpolations.
  //
  // componentProps:
  //   n   — nameIdx в strs
  //   v   — valueIdx в strs
  //   k   — propKindCode
  //   l   — line
  //   id  — idIdx в ids[] (генерированный id 'cu1:cp6')
  //   mc  — memberChainIdx в strs (разделитель \u0002)
  //   lv  — literalValueIdx в strs
  //   sc  — RLE [start, length, value?] → sourceChainIdx
  //   fns — reserved (всегда -1)
  //   idn — identifierIdx в strs (первый идентификатор в value)
  //
  // componentEvents:
  //   n   — eventNameIdx в strs
  //   h   — handlerIdx в strs
  //   fn  — reserved (всегда -1)
  //   s   — eventHandlerSourceCode
  //   m   — modifiersIdx в strs (разделитель \u0002)
  //   l   — line
  //   sc  — RLE [start, length, value?] → sourceChainIdx
  //   id  — idIdx в ids[] ('cu1:ce1')
  //
  // componentDirectives:
  //   n   — nameIdx в strs
  //   a   — argumentIdx в strs (-1 = нет)
  //   m   — modifiersIdx в strs (разделитель \u0002)
  //   v   — valueIdx в strs
  //   l   — line
  //   id  — idIdx в ids[] ('cu1:cd1')
  //
  // componentSlots:
  //   n   — slotNameIdx в strs
  //   sc  — isScoped (0/1)
  //   sn  — scopeNamesIdx в strs (разделитель \u0002)
  //   l   — line
  //   id  — idIdx в ids[] ('cu1:csl1')
  //
  // htmlInterpolations:
  //   e   — expressionIdx в strs
  //   sc  — RLE [start, length, value?] → sourceChainIdx
  //   l   — line
  //   id  — idIdx в ids[] ('he2:hi1')
  // ==========================================
  'vue.componentProps': ['n', 'v', 'k', 'l', 'id', 'mc', 'lv', 'sc', 'fns', 'idn'],
  'vue.componentEvents': ['n', 'h', 'fn', 's', 'm', 'l', 'sc', 'id'],
  'vue.componentDirectives': ['n', 'a', 'm', 'v', 'l', 'id'],
  'vue.componentSlots': ['n', 'sc', 'sn', 'l', 'id'],
  'vue.htmlInterpolations': ['e', 'sc', 'l', 'id'],

  // ==========================================
  // vue.fnHtmlUsage — обратная связь
  // ==========================================
  //
  //   fn   — functionIdx в functions[]
  //   k    — htmlOutputKindCode
  //   u    — usageIdIdx в ids[]
  //   t    — tagIdx в strs
  //   tg   — targetIdx в strs
  //   l    — line
  //   col  — column (-1 = нет)
  //   dcat — domApiCategoryCode (-1 = нет)
  //   dctx — domApiContextIdx в strs (JSON)
  // ==========================================
  'vue.fnHtmlUsage': ['fn', 'k', 'u', 't', 'tg', 'l', 'col', 'dcat', 'dctx'],

  // ==========================================
  // ✅ v16.0.0: DOM API
  // ==========================================
  //
  // domApiCalls:
  //   fn        — functionIdx
  //   f         — fileIdx (RLE, не используется — [0,0])
  //   cat       — domApiCategoryCode (0..49)
  //   eff       — domApiEffectCode (0..2)
  //   m         — methodIdx в strs
  //   t         — targetIdx в ids[]
  //   tk        — domApiTargetKindCode (0..6)
  //   l         — line
  //   col       — column (-1 = нет)
  //   argSlices — slices [start, count] для domApiArgs
  //   en        — eventNameIdx в strs
  //   hfn       — handlerFunctionIdx
  //   hs        — eventHandlerSourceCode
  //   sel       — cssSelectorIdx в strs
  //   hv        — htmlValueIdx в strs
  //   cn        — classNameIdx в strs
  //   sp        — stylePropIdx в strs
  //   an        — attributeNameIdx в strs
  //   oo        — observeOptionsIdx в strs (разделитель \u0002)
  //
  // domApiArgs:
  //   r  — rawIdx в strs
  //   k  — domApiArgKindCode (0..7)
  //   fn — resolvedFunctionIdIdx в ids[]
  //   s  — domApiArgSourceCode (0..3)
  // ==========================================
  domApiCalls: [
    'fn',
    'f',
    'cat',
    'eff',
    'm',
    't',
    'tk',
    'l',
    'col',
    'argSlices',
    'en',
    'hfn',
    'hs',
    'sel',
    'hv',
    'cn',
    'sp',
    'an',
    'oo',
  ],
  domApiArgs: ['r', 'k', 'fn', 's'],

  // ==========================================
  // ✅ v16.0.0: служебные
  // ==========================================
  //
  // ids — append-only массив сгенерированных id
  // (cu1, he1, d1, cu1:cp6, cu1:ce3, ...).
  // Отличается от strs (те — интернированные строки из кода).
  //
  // ⚠️ sourceChains НЕ включён в schemas, потому что это
  //    МАССИВ СТРОК (как tokens/strs/params/values), а не
  //    объект с параллельными массивами.
  // ==========================================
  ids: ['(string[])'],
};

// ============================================================
// СБОРКА КОДОВ
// ============================================================

/**
 * Собирает словарь кодов.
 *
 * ⚠️ Синхронизировано с codec-encode.ts и codec-decode.ts.
 */
function mergeDict(base: Record<string, string>, overrides: CodesDict): CodesDict {
  const result: CodesDict = {};

  for (const [code, name] of Object.entries(base)) {
    result[code] = overrides[code] ?? name;
  }

  for (const [code, desc] of Object.entries(overrides)) {
    if (!(code in result)) {
      result[code] = desc;
    }
  }

  return result;
}

/**
 * Преобразует словарь { name: code } → { code: name }.
 */
function reverseCodeDict(dict: Record<string, number>): CodesDict {
  const result: CodesDict = {};
  for (const [name, code] of Object.entries(dict)) {
    result[String(code)] = name;
  }
  return result;
}

// ============================================================
// СОБОРКА ЛЕГЕНДЫ КОДОВ
// ============================================================

/**
 * Собирает все словари кодов.
 *
 * ✅ v16.0.2: 29 словарей (было 19 в 15.7.3).
 */
function buildCodesLegend(): CodecLegend['codes'] {
  return {
    // ==========================================
    // ЭКСПОРТЫ
    // ==========================================
    export: mergeDict(EXPORT_TYPES, {
      ne: 'named (именованный экспорт)',
      de: 'default (экспорт по умолчанию)',
      te: 'type (экспорт типа)',
      re: 're-export (реэкспорт)',
    }),

    // ==========================================
    // ИМПОРТЫ
    // ==========================================
    import: {
      n: 'named (именованный импорт)',
      df: 'default (импорт по умолчанию)',
      ns: 'namespace (import * as)',
    },

    // ==========================================
    // ВЫЗОВЫ
    // ==========================================
    call: mergeDict(CALL_TYPES, {
      d: 'direct (прямой вызов func())',
      a: 'async (await func())',
      m: 'method (obj.method())',
      c: 'callback (функция как аргумент)',
    }),

    // ==========================================
    // РЕЭКСПОРТЫ
    // ==========================================
    reExport: mergeDict(RE_EXPORT_TYPES, {
      n: 'named (именованный)',
      df: 'default (по умолчанию)',
      all: 'export * from',
    }),

    // ==========================================
    // LIFECYCLE
    // ==========================================
    lifecycle: mergeDict(LIFECYCLE_TYPES, {
      m: 'onMounted',
      u: 'onUnmounted',
      s: 'onScopeDispose',
      a: 'onActivated',
      d: 'onDeactivated',
      w: 'watch',
      W: 'watchEffect',
      e: 'onErrorCaptured',
    }),

    // ==========================================
    // EFFECTS
    // ==========================================
    effect: mergeDict(EFFECT_TYPES, {
      t: 'timer (setTimeout / setInterval)',
      c: 'cleanup (clearTimeout / abort)',
      p: 'promise (.then / .catch)',
      e: 'event (addEventListener)',
      s: 'subscription (.subscribe)',
    }),

    // ==========================================
    // INJECTIONS
    // ==========================================
    injection: mergeDict(INJECTION_TYPES, {
      p: 'provide',
      i: 'inject',
    }),

    // ==========================================
    // REACTIVITY
    // ==========================================
    reactivity: mergeDict(REACTIVITY_TYPES, {
      c: 'computed',
      w: 'watch',
      W: 'watchEffect',
      r: 'ref',
      R: 'reactive',
      S: 'shallowRef',
      o: 'readonly',
    }),

    // ==========================================
    // CONDITIONALS
    // ==========================================
    conditional: mergeDict(CONDITIONAL_TYPES, {
      i: 'v-if',
      e: 'v-else-if',
      E: 'v-else',
    }),

    // ==========================================
    // TYPE KINDS
    // ==========================================
    typeKind: mergeDict(TYPE_KINDS, {
      i: 'interface',
      t: 'type-alias',
      e: 'enum',
      c: 'class',
    }),

    // ==========================================
    // TYPE USAGE
    // ==========================================
    typeUsage: mergeDict(TYPE_USAGE_KINDS, {
      p: 'param (тип параметра)',
      r: 'return (тип возврата)',
      f: 'field (тип поля)',
      g: 'generic (generic-параметр)',
      u: 'union (union-тип)',
      x: 'extends (расширяемый тип)',
    }),

    // ==========================================
    // LEXICAL RELATION
    // ==========================================
    lexicalRelation: reverseCodeDict(LEXICAL_RELATION_CODES),

    // ==========================================
    // CALL KIND
    // ==========================================
    callKind: reverseCodeDict(CALL_KIND_CODES),

    // ==========================================
    // VUE KIND
    // ==========================================
    vueKind: reverseCodeDict(VUE_KIND_CODES),

    // ==========================================
    // SFC BLOCK
    // ==========================================
    sfcBlock: reverseCodeDict(SFC_BLOCK_CODES),

    // ==========================================
    // HOOK NAME
    // ==========================================
    hookName: reverseCodeDict(HOOK_NAME_CODES),

    // ==========================================
    // REACTIVITY KIND
    // ==========================================
    reactivityKind: reverseCodeDict(REACTIVITY_KIND_CODES),

    // ==========================================
    // ICON CATEGORY
    // ==========================================
    iconCategory: reverseCodeDict(ICON_CATEGORY_CODES),

    // ==========================================
    // COMPOSABLE KIND
    // ==========================================
    composableKind: reverseCodeDict(COMPOSABLE_KIND_CODES),

    // ==========================================
    // ✅ v16.0.0: COMPONENT SOURCE
    // ==========================================
    componentSource: reverseCodeDict(COMPONENT_SOURCE_CODES),

    // ==========================================
    // ✅ v16.0.0: PROP KIND
    // ==========================================
    propKind: reverseCodeDict(PROP_KIND_CODES),

    // ==========================================
    // ✅ v16.0.0: EVENT HANDLER SOURCE
    // ==========================================
    eventHandlerSource: reverseCodeDict(EVENT_HANDLER_SOURCE_CODES),

    // ==========================================
    // ✅ v16.0.0: HTML OUTPUT KIND
    // ==========================================
    htmlOutputKind: reverseCodeDict(HTML_OUTPUT_KIND_CODES),

    // ==========================================
    // ✅ v16.0.0: SOURCE CHAIN KIND
    // ==========================================
    sourceChainKind: reverseCodeDict(SOURCE_CHAIN_KIND_CODES),

    // ==========================================
    // ✅ v16.0.0: DOM API CATEGORY
    // ==========================================
    domApiCategory: reverseCodeDict(DOM_CATEGORY_CODES),

    // ==========================================
    // ✅ v16.0.0: DOM API EFFECT
    // ==========================================
    domApiEffect: reverseCodeDict(DOM_EFFECT_CODES),

    // ==========================================
    // ✅ v16.0.0: DOM API TARGET KIND
    // ==========================================
    domApiTargetKind: reverseCodeDict(DOM_TARGET_KIND_CODES),

    // ==========================================
    // ✅ v16.0.0: DOM API ARG KIND
    // ==========================================
    domApiArgKind: reverseCodeDict(DOM_ARG_KIND_CODES),

    // ==========================================
    // ✅ v16.0.0: DOM API ARG SOURCE
    // ==========================================
    domApiArgSource: reverseCodeDict(DOM_ARG_SOURCE_CODES),
  };
}

// ============================================================
// СБОРКА ФЛАГОВ
// ============================================================

/**
 * Собирает словарь флагов: { "1": "isAsync", ... }.
 */
function buildFlagsLegend(): CodecLegend['flags'] {
  const bits: Record<string, string> = {};

  for (const [bitStr, name] of Object.entries(FLAG_MAP)) {
    bits[bitStr] = name;
  }

  return { bits };
}

// ============================================================
// СБОРКА ПОЛНОЙ ЛЕГЕНДЫ
// ============================================================

export interface LegendDictionaries {
  stringDict: string[];
  paramDict: string[];
  methodDict: string[];
  valueDict: unknown[];
}

/**
 * Собирает полную легенду.
 *
 * ✅ v16.0.0: добавлено поле `version` = '2.0.0'.
 * ✅ v16.0.2: schemas.fns — 10 полей.
 * ✅ v16.0.2-FIX: schemas vue.component* — +1 поле (idn / id).
 */
export function buildLegend(_dict: LegendDictionaries): CodecLegend {
  return {
    version: '2.0.0',
    codes: buildCodesLegend(),
    flags: buildFlagsLegend(),
    schemas: SCHEMAS,
  };
}

/**
 * Собирает пустую легенду (для getLegend()).
 */
export function buildEmptyLegend(): CodecLegend {
  return buildLegend({
    stringDict: [],
    paramDict: [],
    methodDict: [],
    valueDict: [],
  });
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  buildLegend,
  buildEmptyLegend,
  SCHEMAS,
  // ✅ v15.5.0
  VUE_KIND_CODES,
  SFC_BLOCK_CODES,
  HOOK_NAME_CODES,
  REACTIVITY_KIND_CODES,
  ICON_CATEGORY_CODES,
  COMPOSABLE_KIND_CODES,
  COMPOSABLE_RETURN_SHAPE_CODES,
  MACRO_KIND_CODES,
  // ✅ v16.0.0
  DOM_CATEGORY_CODES,
  DOM_EFFECT_CODES,
  DOM_TARGET_KIND_CODES,
  DOM_ARG_KIND_CODES,
  DOM_ARG_SOURCE_CODES,
  COMPONENT_SOURCE_CODES,
  PROP_KIND_CODES,
  EVENT_HANDLER_SOURCE_CODES,
  SOURCE_CHAIN_KIND_CODES,
  HTML_OUTPUT_KIND_CODES,
};
