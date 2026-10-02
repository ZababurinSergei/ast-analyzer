// src/reporters/codec/codec-legend.ts
// ============================================
// ЛЕГЕНДА КОДЕКА (v17.1.0)
// ============================================
// Версия: 17.1.0
//
// v17.1.0: добавлены flow-схемы:
//   • 'react.stateFlows'
//   • 'react.eventFlows'
//   • 'react.renderTree'
//   • 'react.fnJsxUsage'
//   • 'react.jsxElements' — добавлено поле 'col' (column)
//
// v17.0.0: добавлены React-коды и схемы:
//   • REACT_COMPONENT_KIND_CODES (0..5)
//   • REACT_HOOK_KIND_CODES (0..15)
//   • REACT_EFFECT_KIND_CODES (0..4)
//   • REACT_CONTEXT_KIND_CODES (0..2)
//   • REACT_MEMO_KIND_CODES (0..2)
//   • JSX_NODE_KIND_CODES (0..6)
//   • REACT_CONDITIONAL_KIND_CODES (0..2)
//   • ELEMENT_ATTR_KIND_CODES (0..4)
//   • 10 схем 'react.*'

import type { CodecLegend, CodesDict } from './codec-types.js';
import { LEGEND_VERSION } from './codec-types.js';

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
// ✅ v17.0.0: REACT CODES
// ============================================================

/**
 * Коды для reactComponentKind: 0..5.
 */
export const REACT_COMPONENT_KIND_CODES: Record<string, number> = {
  function: 0,
  arrow: 1,
  class: 2,
  memo: 3,
  forwardRef: 4,
  lazy: 5,
};

/**
 * Коды для reactHookKind: 0..15.
 */
export const REACT_HOOK_KIND_CODES: Record<string, number> = {
  useState: 0,
  useReducer: 1,
  useEffect: 2,
  useLayoutEffect: 3,
  useInsertionEffect: 4,
  useMemo: 5,
  useCallback: 6,
  useRef: 7,
  useContext: 8,
  useImperativeHandle: 9,
  useTransition: 10,
  useDeferredValue: 11,
  useActionState: 12,
  useOptimistic: 13,
  useFormStatus: 14,
  use: 15,
};

/**
 * Коды для reactEffectKind: 0..4.
 */
export const REACT_EFFECT_KIND_CODES: Record<string, number> = {
  mount: 0,
  update: 1,
  every: 2,
  layout: 3,
  insertion: 4,
};

/**
 * Коды для reactContextKind: 0..2.
 */
export const REACT_CONTEXT_KIND_CODES: Record<string, number> = {
  create: 0,
  provide: 1,
  consume: 2,
};

/**
 * Коды для reactMemoKind: 0..2.
 */
export const REACT_MEMO_KIND_CODES: Record<string, number> = {
  memo: 0,
  useMemo: 1,
  useCallback: 2,
};

/**
 * Коды для jsxNodeKind: 0..6.
 */
export const JSX_NODE_KIND_CODES: Record<string, number> = {
  element: 0,
  component: 1,
  fragment: 2,
  text: 3,
  expression: 4,
  spread: 5,
  conditional: 6,
};

/**
 * Коды для reactConditionalKind: 0..2.
 */
export const REACT_CONDITIONAL_KIND_CODES: Record<string, number> = {
  '&&': 0,
  '||': 1,
  '?:': 2,
};

/**
 * Коды для elementAttrKind: 0..4.
 */
export const ELEMENT_ATTR_KIND_CODES: Record<string, number> = {
  string: 0,
  expression: 1,
  handler: 2,
  boolean: 3,
  spread: 4,
};

// ============================================================
// SCHEMAS — ПОЗИЦИОННЫЕ СХЕМЫ КОРТЕЖЕЙ
// ============================================================
//
// ✅ v17.1.0: react.jsxElements расширено полем 'col' (12 полей).
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
  // vue.sfc — 34 поля
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
    'cu_id',
    'cu_pf',
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
    'he_id',
    'he_pf',
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
  'vue.composables': ['n', 'f', 'k', 'r', 'v'],

  // ==========================================
  // vue.macros
  // ==========================================
  'vue.macros': ['f', 'k', 'l'],

  // ==========================================
  // vue.hooks
  // ==========================================
  'vue.hooks': ['f', 'n', 'l'],

  // ==========================================
  // vue.reactivity — 5 полей
  // ==========================================
  'vue.reactivity': ['f', 'k', 'l', 'n', 'usedInTemplate'],

  // ==========================================
  // vue.icons
  // ==========================================
  'vue.icons': ['f', 'n', 'c'],

  // ==========================================
  // vue.componentProps
  // ==========================================
  'vue.componentProps': ['n', 'v', 'k', 'l', 'id', 'mc', 'lv', 'sc', 'fns', 'idn'],

  // ==========================================
  // vue.componentEvents
  // ==========================================
  'vue.componentEvents': ['n', 'h', 'fn', 's', 'm', 'l', 'sc', 'id'],

  // ==========================================
  // vue.componentDirectives
  // ==========================================
  'vue.componentDirectives': ['n', 'a', 'm', 'v', 'l', 'id'],

  // ==========================================
  // vue.componentSlots
  // ==========================================
  'vue.componentSlots': ['n', 'sc', 'sn', 'l', 'id'],

  // ==========================================
  // vue.htmlInterpolations
  // ==========================================
  'vue.htmlInterpolations': ['e', 'sc', 'l', 'id'],

  // ==========================================
  // vue.fnHtmlUsage
  // ==========================================
  'vue.fnHtmlUsage': ['fn', 'k', 'u', 't', 'tg', 'l', 'col', 'dcat', 'dctx'],

  // ==========================================
  // domApiCalls
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

  // ==========================================
  // domApiArgs
  // ==========================================
  domApiArgs: ['r', 'k', 'fn', 's'],

  // ==========================================
  // ids
  // ==========================================
  ids: ['(string[])'],

  // ==========================================
  // ✅ v17.0.0: react.components
  // ==========================================
  'react.components': ['f', 'm', 'n', 'k', 'l', 'p', 'h', 'j', 'fl'],

  // ==========================================
  // ✅ v17.0.0: react.hooks
  // ==========================================
  'react.hooks': ['f', 'c', 'k', 'l', 'sn', 'tn', 'iv', 'd', 'fl'],

  // ==========================================
  // ✅ v17.0.0: react.effects
  // ==========================================
  'react.effects': ['f', 'c', 'hk', 'k', 'l', 'd', 'fl', 'r', 'mu'],

  // ==========================================
  // ✅ v17.0.0: react.contexts
  // ==========================================
  'react.contexts': ['f', 'c', 'k', 'l', 'n'],

  // ==========================================
  // ✅ v17.0.0: react.memoization
  // ==========================================
  'react.memoization': ['f', 'c', 'k', 'l', 'd'],

  // ==========================================
  // ✅ v17.0.0: react.refs
  // ==========================================
  'react.refs': ['f', 'c', 'l', 'n', 'fl'],

  // ==========================================
  // ✅ v17.0.0: react.jsxElements — 12 полей (v17.1.0: +col)
  // ==========================================
  'react.jsxElements': ['f', 'c', 'k', 'n', 'l', 'col', 'a', 'ch', 'tx', 'ex', 'pa', 'ck'],

  // ==========================================
  // ✅ v17.0.0: react.jsxEvents
  // ==========================================
  'react.jsxEvents': ['f', 'e', 'n', 'l', 'h', 'hf', 's'],

  // ==========================================
  // ✅ v17.0.0: react.conditionals
  // ==========================================
  'react.conditionals': ['f', 'c', 'k', 'cd', 'r', 'l', 'g'],

  // ==========================================
  // ✅ v17.0.0: react.componentUsages
  // ==========================================
  'react.componentUsages': ['u', 'n', 'c', 'l', 't', 'im', 'fl', 'p', 'e', 's'],

  // ==========================================
  // ✅ v17.1.0: react flow-секции
  // ==========================================
  'react.stateFlows': [
    'id',
    'hookId',
    'stateName',
    'setterName',
    'mutatedBy',
    'readBy',
    'renderedIn',
  ],
  'react.eventFlows': [
    'id',
    'eventId',
    'eventName',
    'elementId',
    'handlerFunctionId',
    'handlerName',
    'calls',
    'mutatedStates',
    'reRendered',
    'chain',
  ],
  'react.renderTree': ['elementId', 'tagName', 'kind', 'parentId', 'dependsOn', 'conditionals'],
  'react.fnJsxUsage': ['functionId', 'functionName', 'usedIn'],
};

// ============================================================
// СБОРКА КОДОВ
// ============================================================

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

function buildCodesLegend(): CodecLegend['codes'] {
  return {
    export: mergeDict(EXPORT_TYPES, {
      ne: 'named (именованный экспорт)',
      de: 'default (экспорт по умолчанию)',
      te: 'type (экспорт типа)',
      re: 're-export (реэкспорт)',
    }),

    import: {
      n: 'named (именованный импорт)',
      df: 'default (импорт по умолчанию)',
      ns: 'namespace (import * as)',
    },

    call: mergeDict(CALL_TYPES, {
      d: 'direct (прямой вызов func())',
      a: 'async (await func())',
      m: 'method (obj.method())',
      c: 'callback (функция как аргумент)',
    }),

    reExport: mergeDict(RE_EXPORT_TYPES, {
      n: 'named (именованный)',
      df: 'default (по умолчанию)',
      all: 'export * from',
    }),

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

    effect: mergeDict(EFFECT_TYPES, {
      t: 'timer (setTimeout / setInterval)',
      c: 'cleanup (clearTimeout / abort)',
      p: 'promise (.then / .catch)',
      e: 'event (addEventListener)',
      s: 'subscription (.subscribe)',
    }),

    injection: mergeDict(INJECTION_TYPES, {
      p: 'provide',
      i: 'inject',
    }),

    reactivity: mergeDict(REACTIVITY_TYPES, {
      c: 'computed',
      w: 'watch',
      W: 'watchEffect',
      r: 'ref',
      R: 'reactive',
      S: 'shallowRef',
      o: 'readonly',
    }),

    conditional: mergeDict(CONDITIONAL_TYPES, {
      i: 'v-if',
      e: 'v-else-if',
      E: 'v-else',
    }),

    typeKind: mergeDict(TYPE_KINDS, {
      i: 'interface',
      t: 'type-alias',
      e: 'enum',
      c: 'class',
    }),

    typeUsage: mergeDict(TYPE_USAGE_KINDS, {
      p: 'param (тип параметра)',
      r: 'return (тип возврата)',
      f: 'field (тип поля)',
      g: 'generic (generic-параметр)',
      u: 'union (union-тип)',
      x: 'extends (расширяемый тип)',
    }),

    lexicalRelation: reverseCodeDict(LEXICAL_RELATION_CODES),
    callKind: reverseCodeDict(CALL_KIND_CODES),
    vueKind: reverseCodeDict(VUE_KIND_CODES),
    sfcBlock: reverseCodeDict(SFC_BLOCK_CODES),
    hookName: reverseCodeDict(HOOK_NAME_CODES),
    reactivityKind: reverseCodeDict(REACTIVITY_KIND_CODES),
    iconCategory: reverseCodeDict(ICON_CATEGORY_CODES),
    composableKind: reverseCodeDict(COMPOSABLE_KIND_CODES),
    componentSource: reverseCodeDict(COMPONENT_SOURCE_CODES),
    propKind: reverseCodeDict(PROP_KIND_CODES),
    eventHandlerSource: reverseCodeDict(EVENT_HANDLER_SOURCE_CODES),
    htmlOutputKind: reverseCodeDict(HTML_OUTPUT_KIND_CODES),
    sourceChainKind: reverseCodeDict(SOURCE_CHAIN_KIND_CODES),
    domApiCategory: reverseCodeDict(DOM_CATEGORY_CODES),
    domApiEffect: reverseCodeDict(DOM_EFFECT_CODES),
    domApiTargetKind: reverseCodeDict(DOM_TARGET_KIND_CODES),
    domApiArgKind: reverseCodeDict(DOM_ARG_KIND_CODES),
    domApiArgSource: reverseCodeDict(DOM_ARG_SOURCE_CODES),

    // ✅ v17.0.0: REACT CODES
    reactComponentKind: reverseCodeDict(REACT_COMPONENT_KIND_CODES),
    reactHookKind: reverseCodeDict(REACT_HOOK_KIND_CODES),
    reactEffectKind: reverseCodeDict(REACT_EFFECT_KIND_CODES),
    reactContextKind: reverseCodeDict(REACT_CONTEXT_KIND_CODES),
    reactMemoKind: reverseCodeDict(REACT_MEMO_KIND_CODES),
    jsxNodeKind: reverseCodeDict(JSX_NODE_KIND_CODES),
    reactConditionalKind: reverseCodeDict(REACT_CONDITIONAL_KIND_CODES),
    elementAttrKind: reverseCodeDict(ELEMENT_ATTR_KIND_CODES),
  };
}

// ============================================================
// СБОРКА ФЛАГОВ
// ============================================================

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
 * ✅ v17.1.0: schemas['react.jsxElements'] — 12 полей (было 11).
 *            Добавлено поле 'col' (column).
 *            legend.version = LEGEND_VERSION ('3.1.0').
 */
export function buildLegend(_dict: LegendDictionaries): CodecLegend {
  return {
    version: LEGEND_VERSION,
    codes: buildCodesLegend(),
    flags: buildFlagsLegend(),
    schemas: SCHEMAS,
  };
}

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
  VUE_KIND_CODES,
  SFC_BLOCK_CODES,
  HOOK_NAME_CODES,
  REACTIVITY_KIND_CODES,
  ICON_CATEGORY_CODES,
  COMPOSABLE_KIND_CODES,
  COMPOSABLE_RETURN_SHAPE_CODES,
  MACRO_KIND_CODES,
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
  REACT_COMPONENT_KIND_CODES,
  REACT_HOOK_KIND_CODES,
  REACT_EFFECT_KIND_CODES,
  REACT_CONTEXT_KIND_CODES,
  REACT_MEMO_KIND_CODES,
  JSX_NODE_KIND_CODES,
  REACT_CONDITIONAL_KIND_CODES,
  ELEMENT_ATTR_KIND_CODES,
};
