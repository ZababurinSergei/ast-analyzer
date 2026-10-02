// src/reporters/codec/codec-decode.ts
// ============================================
// ДЕКОДИРОВАНИЕ: CompactJSON → FullJSON (v16.2.0)
// ============================================
// Версия: 16.2.3 (v17.0.0: React-секция)
// ============================================

import type {
  FullJSON,
  CompactJSON,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  ModuleData,
  FileData,
  EdgeData,
  DecodeOptions,
  TemplateData,
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TypeNodeData,
  TypeRefData,
  LexicalLink,
  LexicalRelation,
  SFCComponent,
  ComposableEntity,
  MacroEntity,
  HookEntity,
  ReactivityEntity,
  IconEntity,
  VueKind,
  VueSectionFull,
  VueSectionCompact,
  HtmlUsage,
  ComponentProp,
  ComponentEvent,
  ComponentDirective,
  ComponentSlot,
  HtmlInterpolation,
  ComponentUsage,
  HtmlElementUsage,
  DomApiCall,
  DomApiArg,
  DomApiContext,
  SourceChainItem,
} from './codec-types.js';

import { CODEC_VERSION } from './codec-types.js';

// ✅ v16.0.0: единый импорт deserializeSourceChain
import { deserializeSourceChain } from '../../core/source-chain-resolver.js';

// ============================================
// ✅ v15.2.0 (P1): LEXICAL RELATION BY CODE
// ============================================

const LEXICAL_RELATION_BY_CODE: Record<number, LexicalRelation> = {
  0: 'nested',
  1: 'arrow-var',
  2: 'callback',
  3: 'iife',
  4: 'class-method',
  5: 'object-prop',
  6: 'return',
  7: 'default-export',
};

// ============================================
// ✅ v15.3.0 (P2): CALL KIND BY CODE
// ============================================

const CALL_KIND_BY_CODE: Record<number, CallData['callKind']> = {
  0: 'direct',
  1: 'method',
  2: 'callback',
  3: 'constructor',
  4: 'tagged-template',
  5: 'optional-chain',
  6: 'spread',
  7: 'new',
};

// ============================================
// ✅ v15.5.0: VUE KIND BY CODE
// ============================================

const VUE_KIND_BY_CODE: Record<number, VueKind> = {
  0: 'function',
  1: 'composable',
  2: 'macro',
  3: 'hook',
  4: 'reactivity',
  5: 'callback',
  6: 'arrow',
};

// ============================================
// ✅ v15.5.0: HOOK NAME BY CODE
// ============================================

const HOOK_NAME_BY_CODE: Record<number, string> = {
  0: 'onMounted',
  1: 'onUnmounted',
  2: 'onActivated',
  3: 'onDeactivated',
  4: 'onErrorCaptured',
  5: 'onScopeDispose',
  6: 'watch',
  7: 'watchEffect',
  8: 'onBeforeMount',
  9: 'onBeforeUnmount',
  10: 'onUpdated',
  11: 'onBeforeUpdate',
};

// ============================================
// ✅ v15.5.0: REACTIVITY KIND BY CODE
// ============================================

const REACTIVITY_KIND_BY_CODE: Record<number, ReactivityEntity['kind']> = {
  0: 'computed',
  1: 'ref',
  2: 'reactive',
  3: 'watch',
  4: 'shallowRef',
  5: 'readonly',
  6: 'toRef',
  7: 'toRefs',
};

// ============================================
// ✅ v15.5.0: ICON CATEGORY BY CODE
// ============================================

const ICON_CATEGORY_BY_CODE: Record<number, IconEntity['category']> = {
  0: 'base',
  1: 'filter',
  2: 'toolbar',
  3: 'sort',
};

// ============================================
// ✅ v15.5.0: COMPOSABLE KIND BY CODE
// ============================================

const COMPOSABLE_KIND_BY_CODE: Record<number, ComposableEntity['kind']> = {
  0: 'composable',
  1: 'store',
  2: 'factory',
  3: 'utility',
};

// ============================================
// ✅ v15.5.0: COMPOSABLE RETURN SHAPE BY CODE
// ============================================

const COMPOSABLE_SHAPE_BY_CODE: Record<number, ComposableEntity['returnShape']> = {
  0: 'void',
  1: 'object',
  2: 'ref',
  3: 'reactive',
  4: 'function',
};

// ============================================
// ✅ v15.5.0: MACRO KIND BY CODE
// ============================================

const MACRO_KIND_BY_CODE: Record<number, MacroEntity['kind']> = {
  0: 'props',
  1: 'emits',
  2: 'expose',
  3: 'slots',
  4: 'model',
  5: 'options',
};

// ============================================
// ✅ v16.0.0: DOM API BY CODE
// ============================================

const DOM_CATEGORY_BY_CODE: Record<number, DomApiCall['category']> = {
  0: 'add-event-listener',
  1: 'remove-event-listener',
  2: 'dispatch-event',
  3: 'create-element',
  4: 'append-child',
  5: 'insert-before',
  6: 'remove-child',
  7: 'replace-child',
  8: 'clone-node',
  9: 'import-node',
  10: 'adopt-node',
  11: 'inner-html',
  12: 'outer-html',
  13: 'text-content',
  14: 'inner-text',
  15: 'insert-adjacent-html',
  16: 'insert-adjacent-element',
  17: 'insert-adjacent-text',
  18: 'set-attribute',
  19: 'remove-attribute',
  20: 'get-attribute',
  21: 'has-attribute',
  22: 'toggle-attribute',
  23: 'class-list',
  24: 'class-list-add',
  25: 'class-list-remove',
  26: 'class-list-toggle',
  27: 'dataset',
  28: 'set-property',
  29: 'style-set',
  30: 'style-remove',
  31: 'query-selector',
  32: 'query-selector-all',
  33: 'get-element-by-id',
  34: 'get-elements-by-class',
  35: 'get-elements-by-tag',
  36: 'get-elements-by-name',
  37: 'closest',
  38: 'matches',
  39: 'get-root-node',
  40: 'mutation-observer',
  41: 'resize-observer',
  42: 'intersection-observer',
  43: 'performance-observer',
  44: 'focus',
  45: 'blur',
  46: 'scroll-into-view',
  47: 'scroll-to',
  48: 'click-programmatic',
  49: 'other',
};

const DOM_EFFECT_BY_CODE: Record<number, DomApiCall['effect']> = {
  0: 'write',
  1: 'read',
  2: 'mixed',
};

const DOM_TARGET_KIND_BY_CODE: Record<number, DomApiCall['targetKind']> = {
  0: 'document',
  1: 'window',
  2: 'element',
  3: 'query',
  4: 'ref',
  5: 'variable',
  6: 'unknown',
};

const DOM_ARG_KIND_BY_CODE: Record<number, DomApiArg['kind']> = {
  0: 'literal-string',
  1: 'literal-number',
  2: 'literal-bool',
  3: 'identifier',
  4: 'member',
  5: 'call',
  6: 'arrow',
  7: 'object',
};

const DOM_ARG_SOURCE_BY_CODE: Record<number, NonNullable<DomApiArg['resolvedSource']>> = {
  0: 'local',
  1: 'import',
  2: 'global',
  3: 'unknown',
};

// ============================================
// ✅ v16.0.0: COMPONENT SOURCE BY CODE
// ============================================

const COMPONENT_SOURCE_BY_CODE: Record<number, ComponentUsage['source']> = {
  0: 'local',
  1: 'global',
  2: 'builtin',
  3: 'dynamic',
  4: 'unknown',
};

// ============================================
// ✅ v16.0.0: PROP KIND BY CODE
// ============================================

const PROP_KIND_BY_CODE: Record<number, ComponentProp['kind']> = {
  0: 'static',
  1: 'dynamic',
  2: 'boolean',
  3: 'spread',
};

// ============================================
// ✅ v16.0.1: EVENT_HANDLER_SOURCE_BY_CODE
// ============================================

const EVENT_HANDLER_SOURCE_BY_CODE: Record<
  number,
  NonNullable<DomApiContext['handlerSource']>
> = {
  0: 'local',
  1: 'import',
  2: 'global',
  3: 'inline',
  4: 'unknown',
};

// ============================================
// ✅ v16.0.0: HTML OUTPUT KIND BY CODE
// ============================================

const HTML_OUTPUT_KIND_BY_CODE: Record<number, HtmlUsage['kind']> = {
  0: 'rendered-text',
  1: 'rendered-attr',
  2: 'rendered-cond',
  3: 'rendered-list',
  4: 'rendered-class',
  5: 'rendered-style',
  6: 'passed-to-component',
  7: 'event-handler',
  8: 'slot-content',
  9: 'dom-api',
};

// ============================================
// ✅ v17.0.0: REACT CODES
// ============================================

const REACT_COMPONENT_KIND_NAMES = [
  'function', 'arrow', 'class', 'memo', 'forwardRef', 'lazy',
];

const REACT_HOOK_KIND_NAMES = [
  'useState', 'useReducer', 'useEffect', 'useLayoutEffect', 'useInsertionEffect',
  'useMemo', 'useCallback', 'useRef', 'useContext', 'useImperativeHandle',
  'useTransition', 'useDeferredValue', 'useActionState', 'useOptimistic',
  'useFormStatus', 'use',
];

const REACT_EFFECT_KIND_NAMES = ['mount', 'update', 'every', 'layout', 'insertion'];
const REACT_CONTEXT_KIND_NAMES = ['create', 'provide', 'consume'];
const REACT_MEMO_KIND_NAMES = ['memo', 'useMemo', 'useCallback'];
const REACT_JSX_KIND_NAMES = ['element', 'component', 'fragment', 'text', 'expression', 'spread', 'conditional'];
const REACT_SOURCE_KIND_NAMES = ['local', 'import', 'global', 'inline', 'unknown'];
const REACT_COND_KIND_NAMES: Array<'&&' | '||' | '?:'> = ['&&', '||', '?:'];

// ============================================
// ДЕКОДИРОВАНИЕ ФЛАГОВ
// ============================================

export interface DecodedFlags {
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  isArrow: boolean;
  isEventHandler: boolean;
  isNested: boolean;
  isSelf: boolean;
  isDynamic: boolean;
  isConfig: boolean;
  isExternal: boolean;
  isVueTemplate: boolean;
  isAsyncChain: boolean;
  isClosure: boolean;
  isTypeDep: boolean;
  isGenerator: boolean;
  isPrivate: boolean;
  isProtected: boolean;
  isStatic: boolean;
}

export function createEmptyFlags(): DecodedFlags {
  return {
    isAsync: false,
    isExported: false,
    isMethod: false,
    isArrow: false,
    isEventHandler: false,
    isNested: false,
    isSelf: false,
    isDynamic: false,
    isConfig: false,
    isExternal: false,
    isVueTemplate: false,
    isAsyncChain: false,
    isClosure: false,
    isTypeDep: false,
    isGenerator: false,
    isPrivate: false,
    isProtected: false,
    isStatic: false,
  };
}

export function decodeFlagsFromNumber(num: number): DecodedFlags {
  const result = createEmptyFlags();
  if (!num) return result;

  result.isAsync = !!(num & 1);
  result.isExported = !!(num & 2);
  result.isMethod = !!(num & 4);
  result.isArrow = !!(num & 8);
  result.isEventHandler = !!(num & 16);
  result.isNested = !!(num & 32);
  result.isSelf = !!(num & 64);
  result.isDynamic = !!(num & 128);
  result.isConfig = !!(num & 256);
  result.isExternal = !!(num & 512);
  result.isVueTemplate = !!(num & 1024);
  result.isAsyncChain = !!(num & 2048);
  result.isClosure = !!(num & 4096);
  result.isTypeDep = !!(num & 8192);
  result.isGenerator = !!(num & 16384);
  result.isPrivate = !!(num & 32768);
  result.isProtected = !!(num & 65536);
  result.isStatic = !!(num & 131072);

  return result;
}

export function decodeFlagsToObject(flagStr: string): DecodedFlags {
  const result = createEmptyFlags();
  if (!flagStr || flagStr === '0') return result;

  const FLAG_CHAR_MAP: Record<string, number> = {
    a: 1,
    e: 2,
    m: 4,
    r: 8,
    v: 16,
    n: 32,
    s: 64,
    d: 128,
    c: 256,
    x: 512,
    t: 1024,
    A: 2048,
    l: 4096,
    y: 8192,
    g: 16384,
    p: 32768,
    P: 65536,
    S: 131072,
  };

  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }

  return decodeFlagsFromNumber(flags);
}

export function flagsStringToNumber(flagStr: string): number {
  if (!flagStr || flagStr === '0') return 0;

  const FLAG_CHAR_MAP: Record<string, number> = {
    a: 1,
    e: 2,
    m: 4,
    r: 8,
    v: 16,
    n: 32,
    s: 64,
    d: 128,
    c: 256,
    x: 512,
    t: 1024,
    A: 2048,
    l: 4096,
    y: 8192,
    g: 16384,
    p: 32768,
    P: 65536,
    S: 131072,
  };

  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }
  return flags;
}

// ============================================
// УТИЛИТЫ
// ============================================

function unrle(rle: [number, number][]): number[] {
  const result: number[] = [];
  for (const [value, count] of rle) {
    for (let i = 0; i < count; i++) {
      result.push(value);
    }
  }
  return result;
}

/**
 * ✅ v16.0.2: RLE-развёртка для [start, length, value?].
 */
function unrleSequence(rle: Array<[number, number, number?]>): number[] {
  if (!Array.isArray(rle)) return [];
  const result: number[] = [];
  for (const entry of rle) {
    if (!Array.isArray(entry)) continue;
    const [start, length, value] = entry;
    if (value === undefined) {
      for (let i = 0; i < length; i++) result.push(start + i);
    } else {
      for (let i = 0; i < length; i++) result.push(value);
    }
  }
  return result;
}

function decodeStr(entry: string | number[], tokens: (string | number)[]): string {
  if (typeof entry === 'string') return entry;
  return entry.map(i => String(tokens[i] ?? '')).join('');
}

function safeJsonParse<T>(value: unknown): T | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// ============================================
// ✅ v16.0.0: decode sourceChain по индексу
// ============================================
function decodeSourceChainAt(idx: number, sourceChains: string[]): SourceChainItem[] {
  if (idx < 0 || idx >= sourceChains.length) return [];
  try {
    return deserializeSourceChain(sourceChains[idx]!);
  } catch {
    return [];
  }
}

// ============================================
// ✅ v16.0.9-FIX: decode literalValue с типом
// ============================================

function decodeLiteralValue(
  raw: string | undefined
): string | number | boolean | null | undefined {
  if (raw === undefined) return undefined;

  const colonIdx = raw.indexOf(':');
  if (colonIdx <= 0) {
    return raw;
  }

  const typePrefix = raw.slice(0, colonIdx);
  const valueStr = raw.slice(colonIdx + 1);

  switch (typePrefix) {
    case 'boolean':
      return valueStr === 'true';
    case 'number': {
      const n = Number(valueStr);
      return Number.isFinite(n) ? n : valueStr;
    }
    case 'null':
      return null;
    case 'string':
      return valueStr;
    case 'unknown':
      return valueStr;
    default:
      return raw;
  }
}

function decodeComponentProps(
  data: any,
  stringDict: string[],
  ids: string[],
  sourceChains: string[] = []
): ComponentProp[] {
  if (!data) return [];
  const result: ComponentProp[] = [];
  const n = (data.n || []).length;
  const scRle = data.sc || [];
  const mcArr = data.mc || [];
  const lvArr = data.lv || [];
  const idnArr = data.idn || [];

  for (let i = 0; i < n; i++) {
    const idIdx = data.id?.[i] ?? -1;
    const idStr = idIdx >= 0 ? (ids[idIdx] ?? '') : '';
    const usageId = idStr.includes(':') ? (idStr.split(':')[0] ?? '') : '';

    const scEntry = scRle[i];
    const scIdx = Array.isArray(scEntry) ? scEntry[0] : -1;
    const sourceChain = decodeSourceChainAt(scIdx, sourceChains);

    const idnIdxRaw = idnArr[i];
    const idnIdx =
      typeof idnIdxRaw === 'number' && idnIdxRaw >= 0 ? idnIdxRaw : -1;
    const identifier =
      idnIdx >= 0 && idnIdx < stringDict.length
        ? (stringDict[idnIdx] ?? null)
        : null;

    const lvIdxRaw = lvArr[i];
    const lvIdx =
      typeof lvIdxRaw === 'number' && lvIdxRaw >= 0 ? lvIdxRaw : -1;
    const literalValue =
      lvIdx >= 0 && lvIdx < stringDict.length
        ? decodeLiteralValue(stringDict[lvIdx])
        : undefined;

    result.push({
      id: idStr,
      usageId,
      name: stringDict[data.n[i]] || '',
      value: stringDict[data.v[i]] || '',
      kind: PROP_KIND_BY_CODE[data.k[i] ?? 0] ?? 'static',
      line: data.l[i] ?? 0,
      identifier,
      memberChain: mcArr[i] >= 0 ? (stringDict[mcArr[i]] || '').split('\u0002') : undefined,
      literalValue,
      sourceChain,
    });
  }
  return result;
}

function decodeComponentEvents(
  data: any,
  stringDict: string[],
  ids: string[],
  sourceChains: string[] = []
): ComponentEvent[] {
  if (!data) return [];
  const result: ComponentEvent[] = [];
  const scRle = data.sc || [];
  const idArr = data.id || [];

  for (let i = 0; i < (data.n || []).length; i++) {
    const scEntry = scRle[i];
    const scIdx = Array.isArray(scEntry) ? scEntry[0] : -1;
    const handlerChain = decodeSourceChainAt(scIdx, sourceChains);

    const mIdx = data.m?.[i] ?? -1;
    const modifiers =
      mIdx >= 0 && stringDict[mIdx] ? stringDict[mIdx]!.split('\u0002') : [];

    const hsIdx = data.s?.[i];
    const hsValue: any =
      hsIdx !== undefined && hsIdx >= 0
        ? (EVENT_HANDLER_SOURCE_BY_CODE[hsIdx] ?? 'unknown')
        : 'unknown';

    const idIdx = idArr[i] ?? -1;
    const idStr = idIdx >= 0 ? (ids[idIdx] ?? '') : '';
    const usageId = idStr.includes(':') ? (idStr.split(':')[0] ?? '') : '';

    result.push({
      id: idStr,
      usageId,
      eventName: stringDict[data.n[i]] || '',
      handler: stringDict[data.h[i]] || '',
      handlerFunctionId: data.fn[i] >= 0 ? `fn${data.fn[i] + 1}` : null,
      handlerSource: hsValue,
      modifiers,
      line: data.l[i] ?? 0,
      handlerChain,
    });
  }
  return result;
}

function decodeComponentDirectives(
  data: any,
  stringDict: string[],
  ids: string[] = []
): ComponentDirective[] {
  if (!data) return [];
  const result: ComponentDirective[] = [];
  const idArr = data.id || [];

  for (let i = 0; i < (data.n || []).length; i++) {
    const mIdx = data.m?.[i] ?? -1;
    const modifiers =
      mIdx >= 0 && stringDict[mIdx] ? stringDict[mIdx]!.split('\u0002') : [];

    const idIdx = idArr[i] ?? -1;
    const idStr = idIdx >= 0 ? (ids[idIdx] ?? '') : '';
    const usageId = idStr.includes(':') ? (idStr.split(':')[0] ?? '') : '';

    result.push({
      id: idStr,
      usageId,
      name: stringDict[data.n[i]] || '',
      argument: data.a[i] >= 0 ? stringDict[data.a[i]] : undefined,
      modifiers,
      value: stringDict[data.v[i]] || '',
      line: data.l[i] ?? 0,
    });
  }
  return result;
}

function decodeComponentSlots(
  data: any,
  stringDict: string[],
  ids: string[] = []
): ComponentSlot[] {
  if (!data) return [];
  const result: ComponentSlot[] = [];
  const idArr = data.id || [];

  for (let i = 0; i < (data.n || []).length; i++) {
    const idIdx = idArr[i] ?? -1;
    const idStr = idIdx >= 0 ? (ids[idIdx] ?? '') : '';
    const usageId = idStr.includes(':') ? (idStr.split(':')[0] ?? '') : '';

    const snIdx = data.sn?.[i] ?? -1;
    const scopeNames =
      snIdx >= 0 && stringDict[snIdx]
        ? stringDict[snIdx]!.split('\u0002').filter(Boolean)
        : [];

    result.push({
      id: idStr,
      usageId,
      slotName: stringDict[data.n[i]] || '',
      isScoped: data.sc[i] === 1,
      scopeNames,
      line: data.l[i] ?? 0,
    });
  }
  return result;
}

function decodeHtmlInterpolations(
  data: any,
  stringDict: string[],
  sourceChains: string[],
  ids: string[] = []
): HtmlInterpolation[] {
  if (!data) return [];
  const result: HtmlInterpolation[] = [];
  const scRle = data.sc || [];
  const idArr = data.id || [];

  for (let i = 0; i < (data.e || []).length; i++) {
    const scEntry = scRle[i];
    const scIdx = Array.isArray(scEntry) ? scEntry[0] : -1;
    const sourceChain = decodeSourceChainAt(scIdx, sourceChains);

    const idIdx = idArr[i] ?? -1;
    const idStr = idIdx >= 0 ? (ids[idIdx] ?? '') : '';
    const usageId = idStr.includes(':') ? (idStr.split(':')[0] ?? '') : '';

    result.push({
      id: idStr,
      usageId,
      expression: stringDict[data.e[i]] || '',
      sourceChain,
      line: data.l[i] ?? 0,
    });
  }
  return result;
}

function decodeDomApiCalls(
  data: any,
  stringDict: string[],
  ids: string[],
  functions: FunctionData[],
  domApiArgs: DomApiArg[] = []
): DomApiCall[] {
  if (!data) return [];
  const result: DomApiCall[] = [];

  const n = (data.fn || []).length;
  for (let i = 0; i < n; i++) {
    const fnIdx = data.fn[i] ?? -1;
    const fn = functions[fnIdx];
    const fileId = fn?.fileId ?? '';

    const slice = data.argSlices?.[i];
    const start = Array.isArray(slice) ? slice[0] : 0;
    const length = Array.isArray(slice) ? slice[1] : 0;
    const argsResolved = domApiArgs.slice(start, start + length);

    const ctx: DomApiContext = {};
    if (data.en?.[i] >= 0) ctx.eventName = stringDict[data.en[i]];
    if (data.hfn?.[i] >= 0) ctx.handlerFunctionId = `fn${data.hfn[i] + 1}`;
    if (data.hs?.[i] >= 0) {
      const hsValue = EVENT_HANDLER_SOURCE_BY_CODE[data.hs[i]];
      if (hsValue) ctx.handlerSource = hsValue;
    }
    if (data.sel?.[i] >= 0) ctx.cssSelector = stringDict[data.sel[i]];
    if (data.hv?.[i] >= 0) ctx.htmlValue = stringDict[data.hv[i]];
    if (data.cn?.[i] >= 0) ctx.className = stringDict[data.cn[i]];
    if (data.sp?.[i] >= 0) ctx.styleProp = stringDict[data.sp[i]];
    if (data.an?.[i] >= 0) ctx.attributeName = stringDict[data.an[i]];
    if (data.oo?.[i] >= 0) {
      ctx.observeOptions = (stringDict[data.oo[i]] || '').split('\u0002');
    }

    result.push({
      id: data.t?.[i] >= 0 && ids[data.t[i]] ? ids[data.t[i]]! : `d${i + 1}`,
      functionId: fn?.id ?? '',
      fileId,
      category: DOM_CATEGORY_BY_CODE[data.cat?.[i] ?? 49] ?? 'other',
      effect: DOM_EFFECT_BY_CODE[data.eff?.[i] ?? 0] ?? 'write',
      method: stringDict[data.m[i]] || '',
      target: data.t?.[i] >= 0 ? (ids[data.t[i]] ?? '') : '',
      targetKind: DOM_TARGET_KIND_BY_CODE[data.tk?.[i] ?? 6] ?? 'unknown',
      args: argsResolved.map(a => a.raw),
      argResolutions: argsResolved,
      line: data.l[i] ?? 0,
      column: data.col?.[i] >= 0 ? data.col[i] : undefined,
      context: ctx,
    });
  }
  return result;
}

function decodeDomApiArgs(data: any, stringDict: string[], ids: string[]): DomApiArg[] {
  if (!data) return [];
  const result: DomApiArg[] = [];
  for (let i = 0; i < (data.r || []).length; i++) {
    const arg: DomApiArg = {
      index: i,
      raw: stringDict[data.r[i]] || '',
      kind: DOM_ARG_KIND_BY_CODE[data.k[i] ?? 3] ?? 'identifier',
    };
    if (data.fn?.[i] >= 0) arg.resolvedFunctionId = ids[data.fn[i]];
    if (data.s?.[i] >= 0) {
      const srcValue = DOM_ARG_SOURCE_BY_CODE[data.s[i]];
      if (srcValue) arg.resolvedSource = srcValue;
    }
    result.push(arg);
  }
  return result;
}

function decodeFnHtmlUsage(
  data: any,
  stringDict: string[],
  ids: string[],
  functions: FunctionData[]
): void {
  if (!data) return;
  const { fn, k, u, t, tg, l, col, dcat, dctx } = data;

  for (let i = 0; i < fn.length; i++) {
    const fIdx = fn[i];
    const f = functions[fIdx];
    if (!f) continue;

    if (!f.htmlUsage) f.htmlUsage = [];

    const usage: HtmlUsage = {
      kind: HTML_OUTPUT_KIND_BY_CODE[k[i] ?? 0] ?? 'rendered-attr',
      usageId: u[i] >= 0 ? (ids[u[i]] ?? null) : null,
      tag: t[i] >= 0 ? stringDict[t[i]] || '' : '',
      target: tg[i] >= 0 ? stringDict[tg[i]] || '' : '',
      line: l[i] ?? 0,
      column: col[i] >= 0 ? col[i] : undefined,
    };

    if (dcat[i] >= 0) usage.domApiCategory = DOM_CATEGORY_BY_CODE[dcat[i]];
    if (dctx[i] >= 0) {
      const parsed = safeJsonParse<DomApiContext>(stringDict[dctx[i]]);
      if (parsed) usage.domApiContext = parsed;
    }

    f.htmlUsage.push(usage);
  }
}

// ============================================
// ✅ v17.0.0: DECODE REACT SECTION
// ============================================

function decodeReactSection(
  react: any,
  stringDict: string[],
  ids: string[] = []
): any {
  if (!react) return undefined;

  const readStr = (idx: number): string => (idx < 0 || idx == null ? '' : (stringDict[idx] ?? ''));
  const readId = (idx: number): string => (idx < 0 || idx == null ? '' : (ids[idx] ?? ''));
  const readIdOrUndef = (idx: number): string | undefined =>
    idx < 0 || idx == null ? undefined : ids[idx];
  const splitParts = (s: string): string[] => (s ? s.split('\u0002').filter(Boolean) : []);

  // ────────────────────────────────────────────────────────
  // 1. COMPONENTS
  // ────────────────────────────────────────────────────────
  const components: any[] = [];
  const c = react.components ?? {};
  const cLen = c.f?.length ?? 0;

  for (let i = 0; i < cLen; i++) {
    const [pStart, pLen] = c.p?.[i] ?? [0, 0];
    void pStart;
    const [, hLen] = c.h?.[i] ?? [0, 0];
    const [, jLen] = c.j?.[i] ?? [0, 0];
    void pLen;

    const flags = c.fl?.[i] ?? 0;

    components.push({
      id: `rc${i + 1}`,
      fileId: '',
      moduleId: c.m?.[i] >= 0 ? readStr(c.m[i]) : '',
      name: readStr(c.n?.[i] ?? -1),
      kind: REACT_COMPONENT_KIND_NAMES[c.k?.[i] ?? 0] ?? 'function',
      line: c.l?.[i] ?? 0,
      props: [] as string[],
      hooks: new Array(hLen).fill('') as string[],
      jsxElements: new Array(jLen).fill('') as string[],
      isMemoized: (flags & 1) !== 0,
      isForwardRef: (flags & 2) !== 0,
      isDefaultExport: (flags & 4) !== 0,
      isExported: (flags & 8) !== 0,
    });
  }

  // ────────────────────────────────────────────────────────
  // 2. HOOKS
  // ────────────────────────────────────────────────────────
  const hooks: any[] = [];
  const h = react.hooks ?? {};
  const hLen = h.f?.length ?? 0;

  for (let i = 0; i < hLen; i++) {
    const flags = h.fl?.[i] ?? 0;
    const depsRaw = readStr(h.d?.[i] ?? -1);
    hooks.push({
      id: `rh${i + 1}`,
      fileId: '',
      componentId: readId(h.c?.[i] ?? -1),
      kind: REACT_HOOK_KIND_NAMES[h.k?.[i] ?? 0] ?? 'useState',
      line: h.l?.[i] ?? 0,
      stateName: h.sn?.[i] >= 0 ? readStr(h.sn[i]) : undefined,
      setterName: h.tn?.[i] >= 0 ? readStr(h.tn[i]) : undefined,
      initialValue: h.iv?.[i] >= 0 ? readStr(h.iv[i]) : undefined,
      deps: depsRaw ? splitParts(depsRaw) : [],
      hasCleanup: (flags & 1) !== 0,
      usedInRender: (flags & 2) !== 0,
    });
  }

  // ────────────────────────────────────────────────────────
  // 3. EFFECTS
  // ────────────────────────────────────────────────────────
  const effects: any[] = [];
  const e = react.effects ?? {};
  const eLen = e.f?.length ?? 0;

  for (let i = 0; i < eLen; i++) {
    const depsRaw = readStr(e.d?.[i] ?? -1);
    const readsRaw = readStr(e.r?.[i] ?? -1);
    const mutatesRaw = readStr(e.mu?.[i] ?? -1);
    effects.push({
      id: `re${i + 1}`,
      fileId: '',
      componentId: readId(e.c?.[i] ?? -1),
      hookId: readId(e.hk?.[i] ?? -1),
      kind: REACT_EFFECT_KIND_NAMES[e.k?.[i] ?? 0] ?? 'mount',
      line: e.l?.[i] ?? 0,
      deps: depsRaw ? splitParts(depsRaw) : [],
      hasCleanup: (e.fl?.[i] ?? 0) !== 0,
      reads: readsRaw ? splitParts(readsRaw) : [],
      mutates: mutatesRaw ? splitParts(mutatesRaw) : [],
    });
  }

  // ────────────────────────────────────────────────────────
  // 4. CONTEXTS
  // ────────────────────────────────────────────────────────
  const contexts: any[] = [];
  const ctx = react.contexts ?? {};
  const ctxLen = ctx.f?.length ?? 0;

  for (let i = 0; i < ctxLen; i++) {
    contexts.push({
      id: `rctx${i + 1}`,
      fileId: '',
      componentId: readId(ctx.c?.[i] ?? -1),
      kind: REACT_CONTEXT_KIND_NAMES[ctx.k?.[i] ?? 0] ?? 'create',
      line: ctx.l?.[i] ?? 0,
      name: ctx.n?.[i] >= 0 ? readStr(ctx.n[i]) : undefined,
    });
  }

  // ────────────────────────────────────────────────────────
  // 5. MEMOIZATION
  // ────────────────────────────────────────────────────────
  const memoization: any[] = [];
  const m = react.memoization ?? {};
  const mLen = m.f?.length ?? 0;

  for (let i = 0; i < mLen; i++) {
    const depsRaw = readStr(m.d?.[i] ?? -1);
    memoization.push({
      id: `rm${i + 1}`,
      fileId: '',
      componentId: readId(m.c?.[i] ?? -1),
      kind: REACT_MEMO_KIND_NAMES[m.k?.[i] ?? 0] ?? 'memo',
      line: m.l?.[i] ?? 0,
      deps: depsRaw ? splitParts(depsRaw) : [],
    });
  }

  // ────────────────────────────────────────────────────────
  // 6. REFS
  // ────────────────────────────────────────────────────────
  const refs: any[] = [];
  const r = react.refs ?? {};
  const rLen = r.f?.length ?? 0;

  for (let i = 0; i < rLen; i++) {
    refs.push({
      id: `rr${i + 1}`,
      fileId: '',
      componentId: readId(r.c?.[i] ?? -1),
      line: r.l?.[i] ?? 0,
      name: r.n?.[i] >= 0 ? readStr(r.n[i]) : undefined,
      isForwardRef: (r.fl?.[i] ?? 0) !== 0,
    });
  }

  // ────────────────────────────────────────────────────────
  // 7. JSX ELEMENTS
  // ────────────────────────────────────────────────────────
  const jsxElements: any[] = [];
  const j = react.jsxElements ?? {};
  const jLen = j.f?.length ?? 0;

  for (let i = 0; i < jLen; i++) {
    let attrs: any[] = [];
    const attrsRaw = readStr(j.a?.[i] ?? -1);
    if (attrsRaw) {
      try {
        const parsed = JSON.parse(attrsRaw);
        if (Array.isArray(parsed)) {
          attrs = parsed.map((a: any) => ({
            name: a.n ?? '',
            rawValue: a.v ?? '',
            value: a.v ?? '',
            kind: a.k ?? 'expression',
            refs: a.r ?? [],
          }));
        }
      } catch {
        attrs = [];
      }
    }

    const childrenRaw = readStr(j.ch?.[i] ?? -1);
    const children = childrenRaw ? splitParts(childrenRaw) : [];

    jsxElements.push({
      id: `rj${i + 1}`,
      fileId: '',
      componentId: readId(j.c?.[i] ?? -1),
      kind: REACT_JSX_KIND_NAMES[j.k?.[i] ?? 0] ?? 'element',
      tagName: readStr(j.n?.[i] ?? -1),
      line: j.l?.[i] ?? 0,
      column: undefined,
      attrs,
      children,
      textContent: j.tx?.[i] >= 0 ? readStr(j.tx[i]) : undefined,
      expression: j.ex?.[i] >= 0 ? readStr(j.ex[i]) : undefined,
      expressionRefs: [] as string[],
      parentElementId: j.pa?.[i] >= 0 ? readIdOrUndef(j.pa[i]) ?? null : null,
      conditionalKind: j.ck?.[i] >= 0 ? REACT_COND_KIND_NAMES[j.ck[i]] : undefined,
      eventIds: [] as string[],
      stateUsages: [] as string[],
      propUsages: [] as string[],
      callExpressions: [] as string[],
    });
  }

  // ────────────────────────────────────────────────────────
  // 8. JSX EVENTS
  // ────────────────────────────────────────────────────────
  const jsxEvents: any[] = [];
  const ev = react.jsxEvents ?? {};
  const evLen = ev.f?.length ?? 0;

  for (let i = 0; i < evLen; i++) {
    jsxEvents.push({
      id: `rje${i + 1}`,
      fileId: '',
      elementId: readId(ev.e?.[i] ?? -1),
      eventName: readStr(ev.n?.[i] ?? -1),
      line: ev.l?.[i] ?? 0,
      handler: readStr(ev.h?.[i] ?? -1),
      handlerFunctionId: ev.hf?.[i] >= 0 ? readIdOrUndef(ev.hf[i]) : undefined,
      source: REACT_SOURCE_KIND_NAMES[ev.s?.[i] ?? 4] ?? 'unknown',
    });
  }

  // ────────────────────────────────────────────────────────
  // 9. CONDITIONALS
  // ────────────────────────────────────────────────────────
  const conditionals: any[] = [];
  const cd = react.conditionals ?? {};
  const cdLen = cd.f?.length ?? 0;

  for (let i = 0; i < cdLen; i++) {
    const refsRaw = readStr(cd.r?.[i] ?? -1);
    const guardsRaw = readStr(cd.g?.[i] ?? -1);
    conditionals.push({
      id: `rcd${i + 1}`,
      fileId: '',
      componentId: readId(cd.c?.[i] ?? -1),
      kind: REACT_COND_KIND_NAMES[cd.k?.[i] ?? 0] ?? '&&',
      condition: readStr(cd.cd?.[i] ?? -1),
      refs: refsRaw ? splitParts(refsRaw) : [],
      line: cd.l?.[i] ?? 0,
      guards: guardsRaw ? splitParts(guardsRaw) : [],
    });
  }

  // ────────────────────────────────────────────────────────
  // 10. COMPONENT USAGES
  // ────────────────────────────────────────────────────────
  const componentUsages: any[] = [];
  const u = react.componentUsages ?? {};
  const uLen = u.n?.length ?? 0;

  for (let i = 0; i < uLen; i++) {
    const propsRaw = readStr(u.p?.[i] ?? -1);
    const eventsRaw = readStr(u.e?.[i] ?? -1);
    const slotsRaw = readStr(u.s?.[i] ?? -1);
    componentUsages.push({
      id: `rcu${i + 1}`,
      usageId: readId(u.u?.[i] ?? -1),
      tagName: readStr(u.n?.[i] ?? -1),
      parentComponentId: readId(u.c?.[i] ?? -1),
      line: u.l?.[i] ?? 0,
      targetComponentId: u.t?.[i] >= 0 ? readIdOrUndef(u.t[i]) : undefined,
      importedFrom: u.im?.[i] >= 0 ? readIdOrUndef(u.im[i]) : undefined,
      isExternal: (u.fl?.[i] ?? 0) !== 0,
      props: propsRaw ? splitParts(propsRaw) : [],
      events: eventsRaw ? splitParts(eventsRaw) : [],
      slots: slotsRaw ? splitParts(slotsRaw) : [],
    });
  }

  // ────────────────────────────────────────────────────────
  // Результат
  // ────────────────────────────────────────────────────────
  return {
    components,
    hooks,
    effects,
    contexts,
    memoization,
    refs,
    jsxElements,
    jsxEvents,
    conditionals,
    componentUsages,
    ids: [],
    sourceChains: [],
  };
}

// ============================================
// ✅ v16.2.0: VUE SECTION DECODER
// ============================================

function decodeVueSection(
  vue: VueSectionCompact | undefined,
  stringDict: string[],
  files: FileData[],
  ids: string[] = [],
  sourceChains: string[] = [],
  topLevelComponentProps?: any,
  topLevelComponentEvents?: any,
  topLevelComponentDirectives?: any,
  topLevelComponentSlots?: any,
  topLevelHtmlInterpolations?: any
): VueSectionFull | undefined {
  if (!vue) return undefined;

  const readStr = (idx: number): string => (idx < 0 || idx == null ? '' : (stringDict[idx] ?? ''));
  const fileId = (idx: number): string => (idx < 0 || idx == null ? '' : (files[idx]?.id ?? `f${idx + 1}`));
  const moduleIdForFile = (idx: number): string => (idx < 0 || idx == null ? '' : (files[idx]?.moduleId ?? ''));

  const sfcAny = vue.sfc as any;

  const pickSource = (top: any, sfcAnyVal: any, requiredField: string): any => {
    const topHas = top && Array.isArray(top[requiredField]);
    const sfcHas = sfcAnyVal && Array.isArray(sfcAnyVal[requiredField]);

    if (sfcHas) return sfcAnyVal;
    if (topHas) return top;
    return sfcAnyVal ?? top;
  };

  const propsSource = pickSource(topLevelComponentProps, sfcAny.componentProps, 'idn');
  const eventsSource = pickSource(topLevelComponentEvents, sfcAny.componentEvents, 'id');
  const directivesSource = pickSource(
    topLevelComponentDirectives,
    sfcAny.componentDirectives,
    'id'
  );
  const slotsSource = pickSource(topLevelComponentSlots, sfcAny.componentSlots, 'id');
  const interpolationsSource = pickSource(
    topLevelHtmlInterpolations,
    sfcAny.htmlInterpolations,
    'id'
  );

  const allComponentProps = propsSource
    ? decodeComponentProps(propsSource, stringDict, ids, sourceChains)
    : [];
  const allComponentEvents = eventsSource
    ? decodeComponentEvents(eventsSource, stringDict, ids, sourceChains)
    : [];
  const allComponentDirectives = directivesSource
    ? decodeComponentDirectives(directivesSource, stringDict, ids)
    : [];
  const allComponentSlots = slotsSource
    ? decodeComponentSlots(slotsSource, stringDict, ids)
    : [];
  const allHtmlInterpolations = interpolationsSource
    ? decodeHtmlInterpolations(interpolationsSource, stringDict, sourceChains, ids)
    : [];

  const groupBy = <T extends { usageId: string }>(arr: T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const item of arr) {
      if (!item.usageId) continue;
      if (!m.has(item.usageId)) m.set(item.usageId, []);
      m.get(item.usageId)!.push(item);
    }
    return m;
  };
  const propsByUsage = groupBy(allComponentProps);
  const eventsByUsage = groupBy(allComponentEvents);
  const dirsByUsage = groupBy(allComponentDirectives);
  const slotsByUsage = groupBy(allComponentSlots);
  const interpByUsage = groupBy(allHtmlInterpolations);

  const cuSfcArr = unrleSequence(sfcAny.cu_sfc ?? []);
  const heSfcArr = unrleSequence(sfcAny.he_sfc ?? []);

  const cuTag = sfcAny.cu_tag ?? [];
  const cuFile = sfcAny.cu_file ?? [];
  const cuSrc = sfcAny.cu_src ?? [];
  const cuPkg = sfcAny.cu_pkg ?? [];
  const cuL = sfcAny.cu_l ?? [];
  const cuCol = sfcAny.cu_col ?? [];

  const heTag = sfcAny.he_tag ?? [];
  const heL = sfcAny.he_l ?? [];
  const heCol = sfcAny.he_col ?? [];

  const cuIdArr = (sfcAny.cu_id ?? []) as number[];
  const cuPfArr = (sfcAny.cu_pf ?? []) as number[];
  const heIdArr = (sfcAny.he_id ?? []) as number[];
  const hePfArr = (sfcAny.he_pf ?? []) as number[];

  const sfc: SFCComponent[] = (vue.sfc?.f ?? []).map((fileIdx: number, i: number) => {
    const readSliceFn = (
      nameArr: number[] | undefined,
      slicesArr: Array<[number, number]> | undefined,
      idx: number
    ): string[] => {
      const slice = slicesArr?.[idx];
      if (!Array.isArray(slice) || slice.length !== 2) return [];
      const [offset, count] = slice;
      const out: string[] = [];
      for (let k = 0; k < count; k++) {
        const strIdx = nameArr?.[offset + k];
        if (strIdx != null && strIdx >= 0) out.push(readStr(strIdx));
      }
      return out;
    };

    const propsList = (sfcAny.pn && sfcAny.ps) ? readSliceFn(sfcAny.pn, sfcAny.ps, i) : [];
    const emitsList = (sfcAny.en && sfcAny.es) ? readSliceFn(sfcAny.en, sfcAny.es, i) : [];
    const exposedList = (sfcAny.xn && sfcAny.xs) ? readSliceFn(sfcAny.xn, sfcAny.xs, i) : [];

    const sfcPS = (sfcAny.ps ?? []) as [number, number][];
    const sfcES = (sfcAny.es ?? []) as [number, number][];
    const sfcXS = (sfcAny.xs ?? []) as [number, number][];
    const sfcP = (sfcAny.p ?? []) as [number, number][];
    const sfcE = (sfcAny.e ?? []) as [number, number][];
    const sfcX = (sfcAny.x ?? []) as [number, number][];

    const propsCount =
      propsList.length ||
      (Array.isArray(sfcPS[i]) ? (sfcPS[i] as any)[1] : 0) ||
      (Array.isArray(sfcP[i]) ? (sfcP[i] as any)[1] : 0) ||
      0;
    const emitsCount =
      emitsList.length ||
      (Array.isArray(sfcES[i]) ? (sfcES[i] as any)[1] : 0) ||
      (Array.isArray(sfcE[i]) ? (sfcE[i] as any)[1] : 0) ||
      0;
    const exposeCount =
      exposedList.length ||
      (Array.isArray(sfcXS[i]) ? (sfcXS[i] as any)[1] : 0) ||
      (Array.isArray(sfcX[i]) ? (sfcX[i] as any)[1] : 0) ||
      0;

    const props = propsList.length > 0
      ? propsList
      : Array.from({ length: propsCount }, (_, k) => `#${k}`);
    const emits = emitsList.length > 0
      ? emitsList
      : Array.from({ length: emitsCount }, (_, k) => `#${k}`);
    const exposed = exposedList.length > 0
      ? exposedList
      : Array.from({ length: exposeCount }, (_, k) => `#${k}`);

    const sfcC = vue.sfc.c ?? [];
    const sfcCS = vue.sfc.cs ?? [];
    let composables: string[] = [];
    const cSlice = sfcCS[i];
    if (Array.isArray(cSlice) && cSlice.length === 2) {
      const [offset, count] = cSlice;
      composables = sfcC.slice(offset, offset + count).map(idx => readStr(idx));
    }

    const componentUsages: ComponentUsage[] = [];
    for (let k = 0; k < cuSfcArr.length; k++) {
      if (cuSfcArr[k] !== i) continue;

      const cuIdIdx = cuIdArr[k] ?? -1;
      const usageId = cuIdIdx >= 0 ? (ids[cuIdIdx] ?? `cu${k + 1}`) : `cu${k + 1}`;

      const cuPfIdx = cuPfArr[k];
      let parentFileId: string;
      if (cuPfIdx === -1 || cuPfIdx === undefined) {
        parentFileId = '';
      } else if (cuPfIdx === -2) {
        parentFileId = fileId(fileIdx);
      } else {
        parentFileId = ids[cuPfIdx] ?? '';
      }

      const compFileIdx = cuFile[k];

      const rawCuProps = propsByUsage.get(usageId) || [];
      const rawCuEvents = eventsByUsage.get(usageId) || [];
      const rawCuDirectives = dirsByUsage.get(usageId) || [];
      const rawCuSlots = slotsByUsage.get(usageId) || [];

      const finalCuProps = rawCuProps.map((p, idx) => ({
        ...p,
        id: `${usageId}:cp${idx + 1}`,
        usageId,
      }));
      const finalCuEvents = rawCuEvents.map((e, idx) => ({
        ...e,
        id: `${usageId}:ce${idx + 1}`,
        usageId,
      }));
      const finalCuDirectives = rawCuDirectives.map((d, idx) => ({
        ...d,
        id: `${usageId}:cd${idx + 1}`,
        usageId,
      }));
      const finalCuSlots = rawCuSlots.map((s, idx) => ({
        ...s,
        id: `${usageId}:csl${idx + 1}`,
        usageId,
      }));

      componentUsages.push({
        id: usageId,
        parentFileId,
        tag: readStr(cuTag[k]),
        componentFileId: compFileIdx >= 0 ? fileId(compFileIdx) : null,
        source: COMPONENT_SOURCE_BY_CODE[cuSrc[k] ?? 4] ?? 'unknown',
        packageName: cuPkg[k] >= 0 ? readStr(cuPkg[k]) : undefined,
        line: cuL[k] ?? 0,
        column: cuCol[k] >= 0 ? cuCol[k] : undefined,
        props: finalCuProps,
        events: finalCuEvents,
        directives: finalCuDirectives,
        slots: finalCuSlots,
      });
    }

    const htmlElements: HtmlElementUsage[] = [];
    for (let k = 0; k < heSfcArr.length; k++) {
      if (heSfcArr[k] !== i) continue;

      const heIdIdx = heIdArr[k] ?? -1;
      const usageId = heIdIdx >= 0 ? (ids[heIdIdx] ?? `he${k + 1}`) : `he${k + 1}`;

      const hePfIdx = hePfArr[k];
      let parentFileId: string;
      if (hePfIdx === -1 || hePfIdx === undefined) {
        parentFileId = '';
      } else if (hePfIdx === -2) {
        parentFileId = fileId(fileIdx);
      } else {
        parentFileId = ids[hePfIdx] ?? '';
      }

      const rawHeProps = propsByUsage.get(usageId) || [];
      const rawHeEvents = eventsByUsage.get(usageId) || [];
      const rawHeDirectives = dirsByUsage.get(usageId) || [];
      const rawHeInterps = interpByUsage.get(usageId) || [];

      const finalHeProps = rawHeProps.map((p, idx) => ({
        ...p,
        id: `${usageId}:cp${idx + 1}`,
        usageId,
      }));
      const finalHeEvents = rawHeEvents.map((e, idx) => ({
        ...e,
        id: `${usageId}:ce${idx + 1}`,
        usageId,
      }));
      const finalHeDirectives = rawHeDirectives.map((d, idx) => ({
        ...d,
        id: `${usageId}:cd${idx + 1}`,
        usageId,
      }));
      const finalHeInterps = rawHeInterps.map((it, idx) => ({
        ...it,
        id: `${usageId}:hi${idx + 1}`,
        usageId,
      }));

      htmlElements.push({
        id: usageId,
        parentFileId,
        tag: readStr(heTag[k]),
        line: heL[k] ?? 0,
        column: heCol[k] >= 0 ? heCol[k] : undefined,
        props: finalHeProps,
        directives: finalHeDirectives,
        events: finalHeEvents,
        interpolations: finalHeInterps,
      });
    }

    return {
      fileId: fileId(fileIdx),
      moduleId: moduleIdForFile(fileIdx),
      name: readStr(vue.sfc.n[i] ?? -1),
      blocks: vue.sfc.b[i] ?? 0,
      composables,
      props,
      emits,
      exposed,
      componentUsages,
      htmlElements,
    };
  });

  const composables: ComposableEntity[] = (vue.composables?.n ?? []).map(
    (nameIdx: number, i: number) => {
      const fRle = vue.composables.f ?? [];
      const fUnrle = unrle(fRle);
      const fileIdx = fUnrle[i] ?? 0;

      const vEntry = vue.composables.v?.[i];
      const returnedKeysCount = vEntry?.[1] ?? 0;

      return {
        id: `cmp${i + 1}`,
        name: readStr(nameIdx),
        fileId: fileId(fileIdx),
        kind: COMPOSABLE_KIND_BY_CODE[vue.composables.k[i] ?? 0] ?? 'composable',
        returnShape: COMPOSABLE_SHAPE_BY_CODE[vue.composables.r[i] ?? 0] ?? 'object',
        returnedKeys: Array.from({ length: returnedKeysCount }, (_, k) => `#${k}`),
        callers: [],
      };
    }
  );

  const macros: MacroEntity[] = (vue.macros?.f ?? []).map((fileIdx: number, i: number) => ({
    id: `mac${i + 1}`,
    fileId: fileId(fileIdx),
    kind: MACRO_KIND_BY_CODE[vue.macros.k[i] ?? 0] ?? 'props',
    line: vue.macros.l[i] ?? 0,
  }));

  const hooks: HookEntity[] = (vue.hooks?.f ?? []).map((fileIdx: number, i: number) => ({
    id: `hk${i + 1}`,
    fileId: fileId(fileIdx),
    hookName: HOOK_NAME_BY_CODE[vue.hooks.n[i] ?? 0] ?? 'onMounted',
    line: vue.hooks.l[i] ?? 0,
  }));

  const rxUsedInTemplateRaw = vue.reactivity?.usedInTemplate;
  const rxHasUsedInTemplate = Array.isArray(rxUsedInTemplateRaw);

  const reactivity: ReactivityEntity[] = (vue.reactivity?.f ?? []).map(
    (fileIdx: number, i: number) => {
      const nameIdx = vue.reactivity.n?.[i] ?? -1;

      const usedInTemplate = rxHasUsedInTemplate
        ? rxUsedInTemplateRaw![i] === 1
        : undefined;

      return {
        id: `rx${i + 1}`,
        fileId: fileId(fileIdx),
        kind: REACTIVITY_KIND_BY_CODE[vue.reactivity.k[i] ?? 0] ?? 'computed',
        line: vue.reactivity.l[i] ?? 0,
        name: nameIdx >= 0 ? readStr(nameIdx) : undefined,
        usedInTemplate,
      };
    }
  );

  const icons: IconEntity[] = (vue.icons?.f ?? []).map((fileIdx: number, i: number) => ({
    id: `ic${i + 1}`,
    fileId: fileId(fileIdx),
    name: readStr(vue.icons.n[i] ?? -1),
    category: ICON_CATEGORY_BY_CODE[vue.icons.c[i] ?? 0] ?? 'base',
  }));

  return {
    sfc,
    composables,
    macros,
    hooks,
    reactivity,
    icons,
    componentProps: allComponentProps,
    componentEvents: allComponentEvents,
    componentDirectives: allComponentDirectives,
    componentSlots: allComponentSlots,
    htmlInterpolations: allHtmlInterpolations,
  };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ DECODE
// ============================================

export function decode(compact: CompactJSON, options: DecodeOptions = {}): FullJSON {
  const { includeEdges = false, includeEmptyArrays = true, includeStatistics = true } = options;

  // ============================================
  // 0. Детокенизация словарей
  // ============================================
  const tokens = compact.tokens || [];

  const stringDict = (compact.strs || []).map((s: string | number[]) => decodeStr(s, tokens));
  const paramDict = (compact.params || []).map((s: string | number[]) => decodeStr(s, tokens));
  const methodDict = (compact.methods || []).map((s: string | number[]) => decodeStr(s, tokens));
  const valueDict = compact.values || [];

  const readString = (idx: number): string | undefined => (idx < 0 ? undefined : stringDict[idx]);
  const readStringOrEmpty = (idx: number): string => (idx < 0 ? '' : (stringDict[idx] ?? ''));
  const readParam = (idx: number): string => (idx < 0 ? '' : (paramDict[idx] ?? ''));
  const readMethod = (idx: number): string | null => (idx < 0 ? null : (methodDict[idx] ?? null));
  const readValue = (idx: number): unknown => (idx < 0 ? undefined : valueDict[idx]);

  const ids: string[] = (compact as any).ids || [];
  const sourceChains: string[] = (compact as any).sourceChains || [];

  // ============================================
  // 1. Файлы
  // ============================================
  const flP = compact.fl?.p || [];
  const flM = compact.fl?.m || [];
  const flMUnrle = unrle(flM as [number, number][]);

  const files: FileData[] = [];
  for (let i = 0; i < flP.length; i++) {
    files.push({
      id: `f${i + 1}`,
      path: flP[i] || '',
      moduleId: `m${(flMUnrle[i] ?? 0) + 1}`,
    });
  }

  // ============================================
  // 2. Модули
  // ============================================
  const miN = compact.mi?.n || [];

  const moduleFileIds: string[][] = miN.map(() => []);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const modIdx = flMUnrle[i] ?? 0;
    if (modIdx >= 0 && modIdx < moduleFileIds.length) {
      const bucket = moduleFileIds[modIdx];
      if (bucket) {
        bucket.push(`f${i + 1}`);
      }
    }
  }

  const modules: ModuleData[] = [];
  for (let i = 0; i < miN.length; i++) {
    modules.push({
      id: `m${i + 1}`,
      name: miN[i] || '',
      path: miN[i] || '',
      fileIds: moduleFileIds[i] ?? [],
    });
  }

  // ============================================
  // 3. Функции
  // ============================================
  const fns = compact.fns || { n: [], m: [], f: [], l: [], fl: [], p: [], rt: [] };
  const fnsM = unrle(fns.m || []);
  const fnsF = unrle(fns.f || []);

  const fnsParent = fns.parent ? unrle(fns.parent as [number, number][]) : [];
  const fnsVk = fns.vk ? unrle(fns.vk as [number, number][]) : [];
  const fnsHv = fns.hv ? unrle(fns.hv as [number, number][]) : [];

  const functions: FunctionData[] = [];
  for (let i = 0; i < (fns.n || []).length; i++) {
    const name = readStringOrEmpty(fns.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(fns.fl[i] ?? 0);

    const parentIdx = fnsParent[i] ?? -1;
    const parentFunctionId = parentIdx >= 0 ? `fn${parentIdx + 1}` : null;

    const vkCode = fnsVk[i] ?? 0;
    const vueKind = VUE_KIND_BY_CODE[vkCode] ?? 'function';

    const func: FunctionData = {
      id: `fn${i + 1}`,
      name,
      moduleId: `m${(fnsM[i] ?? 0) + 1}`,
      fileId: `f${(fnsF[i] ?? 0) + 1}`,
      line: fns.l[i] ?? 0,
      isExported: flags.isExported,
      isAsync: flags.isAsync,
      isArrow: flags.isArrow,
      isMethod: flags.isMethod,
      params: (fns.p[i] || []).map(readParam),
      returnType: readString(fns.rt[i] ?? -1),
      parentFunctionId,
      vueKind,

      htmlUsage: [],
      domApiCalls: [],
      usagesAsPropSource: [],

      isHtmlVisible: (fnsHv[i] ?? 0) === 1,
    };

    if (flags.isEventHandler) func.isEventHandler = true;
    if (flags.isNested) func.isNested = true;
    if (flags.isSelf) func.isSelf = true;
    if (flags.isDynamic) func.isDynamic = true;
    if (flags.isConfig) func.isConfig = true;
    if (flags.isExternal) func.isExternal = true;
    if (flags.isVueTemplate) func.isVueTemplate = true;
    if (flags.isAsyncChain) func.isAsyncChain = true;
    if (flags.isClosure) func.isClosure = true;
    if (flags.isTypeDep) func.isTypeDep = true;
    if (flags.isGenerator) func.isGenerator = true;
    if (flags.isPrivate) func.isPrivate = true;
    if (flags.isProtected) func.isProtected = true;
    if (flags.isStatic) func.isStatic = true;

    functions.push(func);
  }

  // ============================================
  // 4. Классы
  // ============================================
  const cls = compact.cls || { n: [], m: [], f: [], l: [], fl: [], methods: [] };
  const clsM = unrle(cls.m || []);
  const clsF = unrle(cls.f || []);

  const classes: ClassData[] = [];
  for (let i = 0; i < (cls.n || []).length; i++) {
    const name = readStringOrEmpty(cls.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(cls.fl[i] ?? 0);

    classes.push({
      id: `cls${i + 1}`,
      name,
      moduleId: `m${(clsM[i] ?? 0) + 1}`,
      fileId: `f${(clsF[i] ?? 0) + 1}`,
      line: cls.l[i] ?? 0,
      isExported: flags.isExported,
      methods: (cls.methods[i] || []).map(readMethod),
    });
  }

  // ============================================
  // 5. Константы
  // ============================================
  const cn = compact.cn || { n: [], m: [], f: [], l: [], fl: [], nonEmptyV: [] };
  const cnM = unrle(cn.m || []);
  const cnF = unrle(cn.f || []);

  const valueMap = new Map<number, number>();
  for (const [constIdx, valIdx] of cn.nonEmptyV || []) {
    valueMap.set(constIdx, valIdx);
  }

  const constants: ConstantData[] = [];
  for (let i = 0; i < (cn.n || []).length; i++) {
    const name = readStringOrEmpty(cn.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(cn.fl[i] ?? 0);
    const valueIdx = valueMap.get(i);

    constants.push({
      id: `cn${i + 1}`,
      name,
      moduleId: `m${(cnM[i] ?? 0) + 1}`,
      fileId: `f${(cnF[i] ?? 0) + 1}`,
      line: cn.l[i] ?? 0,
      isExported: flags.isExported,
      value: valueIdx !== undefined ? readValue(valueIdx) : undefined,
    });
  }

  // ============================================
  // 6. Экспорты
  // ============================================
  const ge = compact.gr?.e || {
    m: [],
    f: [],
    fn: [],
    l: [],
    ty: [],
    en: [],
    ln: [],
    s: [],
    flags: [],
  };
  const exports: ExportData[] = [];

  for (let i = 0; i < (ge.m || []).length; i++) {
    const typeCode = ge.ty[i] ?? 0;
    let type: 'named' | 'default' | 'type';
    if (typeCode === 1) type = 'default';
    else if (typeCode === 2) type = 'type';
    else type = 'named';

    const flags = ge.flags[i] ?? 0;

    exports.push({
      id: `e${i + 1}`,
      moduleId: `m${(ge.m[i] ?? 0) + 1}`,
      fileId: `f${(ge.f[i] ?? 0) + 1}`,
      functionId: `fn${(ge.fn[i] ?? 0) + 1}`,
      exportName: readStringOrEmpty(ge.en[i] ?? -1),
      localName: readStringOrEmpty(ge.ln[i] ?? -1),
      line: ge.l[i] ?? 0,
      type,
      isDefault: type === 'default',
      isTypeOnly: (flags & 1) !== 0,
      isReExport: (flags & 2) !== 0,
      isStarReExport: (flags & 4) !== 0,
      isDefaultReExport: (flags & 8) !== 0,
      source: readString(ge.s[i] ?? -1),
    });
  }

  // ============================================
  // 7. Импорты
  // ============================================
  const gi = compact.gr?.i || { ff: [], tf: [], s: [], im: [], ln: [], l: [], ty: [] };
  const imports: ImportData[] = [];

  for (let i = 0; i < (gi.ff || []).length; i++) {
    const combinedTy = gi.ty[i] ?? 0;
    const typeCode = combinedTy & 3;
    const isExternal = (combinedTy & 4) !== 0;
    const isTypeOnly = (combinedTy & 8) !== 0;
    const isReExport = (combinedTy & 16) !== 0;
    const isStarReExport = (combinedTy & 32) !== 0;

    let type: 'named' | 'default' | 'namespace';
    if (typeCode === 1) type = 'default';
    else if (typeCode === 2) type = 'namespace';
    else type = 'named';

    const source = readStringOrEmpty(gi.s[i] ?? -1);

    const toFileIdx = gi.tf[i] ?? -1;
    let toFileId: string | null = null;

    if (toFileIdx >= 0) {
      toFileId = `f${toFileIdx + 1}`;
    } else if (isExternal) {
      const pkg = source.startsWith('@')
        ? source.split('/').slice(0, 2).join('/')
        : source.split('/')[0];
      toFileId = pkg ? `external:${pkg}` : null;
    } else if (source) {
      toFileId = `unresolved:${source}`;
    }

    const importData: ImportData = {
      id: `i${i + 1}`,
      fromFileId: `f${(gi.ff[i] ?? 0) + 1}`,
      toFileId,
      source,
      importedName: readStringOrEmpty(gi.im[i] ?? -1),
      localName: readStringOrEmpty(gi.ln[i] ?? -1),
      line: gi.l[i] ?? 0,
      type,
      isDefault: type === 'default',
      isNamespace: type === 'namespace',
      isTypeOnly,
      isExternal,
      packageName: isExternal
        ? source.startsWith('@')
          ? source.split('/').slice(0, 2).join('/')
          : source.split('/')[0]
        : undefined,
    };

    if (isReExport) {
      importData.isReExport = true;
      if (isStarReExport) {
        importData.isStarReExport = true;
      }
    }

    imports.push(importData);
  }

  // ============================================
  // 8. Вызовы
  // ============================================
  const gc = compact.gr?.c || { f: [], t: [], l: [], ty: [] };
  const calls: CallData[] = [];

  const gcCol = gc.col ?? [];
  const gcCk = gc.ck ?? [];
  const gcCn = gc.cn ?? [];
  const gcAi = gc.ai ?? [];

  for (let i = 0; i < (gc.f || []).length; i++) {
    const combinedTy = gc.ty[i] ?? 0;
    const typeCode = combinedTy & 3;
    const isExternal = (combinedTy & 4) !== 0;

    let type: 'direct' | 'async' | 'method' | 'callback';
    if (typeCode === 1) type = 'async';
    else if (typeCode === 2) type = 'method';
    else if (typeCode === 3) type = 'callback';
    else type = 'direct';

    const toFunctionId = isExternal ? readStringOrEmpty(gc.t[i] ?? -1) : `fn${(gc.t[i] ?? 0) + 1}`;

    const call: CallData = {
      id: `c${i + 1}`,
      fromFunctionId: `fn${(gc.f[i] ?? 0) + 1}`,
      toFunctionId,
      line: gc.l[i] ?? 0,
      type,
    };

    if (gcCol[i] !== undefined && gcCol[i]! >= 0) {
      call.column = gcCol[i]!;
    }
    if (gcCk[i] !== undefined && gcCk[i]! >= 0) {
      call.callKind = CALL_KIND_BY_CODE[gcCk[i]!];
    }
    if (gcCn[i] !== undefined && gcCn[i]! >= 0) {
      call.calleeName = stringDict[gcCn[i]!];
    }
    if (gcAi[i] !== undefined && gcAi[i]! >= 0) {
      call.argumentIndex = gcAi[i]!;
    }

    calls.push(call);
  }

  // ============================================
  // 9. Реэкспорты
  // ============================================
  const gre = compact.gr?.re || { m: [], fn: [], s: [], en: [], l: [], ty: [] };
  const reExports: ReExportData[] = [];

  for (let i = 0; i < (gre.m || []).length; i++) {
    const combinedTy = gre.ty[i] ?? 0;
    const typeCode = combinedTy & 3;
    const isTypeOnly = (combinedTy & 4) !== 0;

    let type: 'named' | 'default' | 'all';
    if (typeCode === 2) type = 'all';
    else if (typeCode === 1) type = 'default';
    else type = 'named';

    reExports.push({
      id: `re${i + 1}`,
      moduleId: `m${(gre.m[i] ?? 0) + 1}`,
      functionId: `fn${(gre.fn[i] ?? 0) + 1}`,
      source: readStringOrEmpty(gre.s[i] ?? -1),
      exportName: readStringOrEmpty(gre.en[i] ?? -1),
      line: gre.l[i] ?? 0,
      type,
      isDefault: type === 'default',
      isTypeOnly,
      isStarReExport: type === 'all',
    });
  }

  // ============================================
  // 9.5. lexicalLinks
  // ============================================
  const lexicalLinks: LexicalLink[] = [];

  if (compact.lx) {
    const { p, c, r, l, ai, cn } = compact.lx;
    const pUnrle = unrle(p as [number, number][]);
    const cUnrle = unrle(c as [number, number][]);

    for (let i = 0; i < r.length; i++) {
      const parentIdx = pUnrle[i] ?? -1;
      const childIdx = cUnrle[i] ?? -1;
      const relCode = r[i] ?? 0;
      const argIdx = ai?.[i] ?? -1;
      const calleeIdx = cn?.[i] ?? -1;

      lexicalLinks.push({
        id: `lx${i + 1}`,
        parentFunctionId: parentIdx >= 0 ? `fn${parentIdx + 1}` : null,
        childFunctionId: `fn${childIdx + 1}`,
        relation: LEXICAL_RELATION_BY_CODE[relCode] ?? 'nested',
        line: l[i] ?? 0,
        argumentIndex: argIdx >= 0 ? argIdx : undefined,
        calleeName: calleeIdx >= 0 ? stringDict[calleeIdx] : undefined,
      });
    }
  }

  // ============================================
  // 10. Statistics
  // ============================================
  const statistics = includeStatistics ? compact.st : ({} as any);

  // ============================================
  // 10.5. Расширенные секции
  // ============================================
  const decodeSection = <T>(section: unknown): T[] | undefined => {
    if (!Array.isArray(section)) return undefined;
    const result: T[] = [];
    for (const idx of section) {
      if (typeof idx !== 'number' || idx < 0) continue;
      const raw = readValue(idx);
      if (raw === undefined || raw === null) continue;

      if (typeof raw === 'string') {
        const parsed = safeJsonParse<T>(raw);
        if (parsed !== null) result.push(parsed);
      } else if (typeof raw === 'object') {
        result.push(raw as T);
      }
    }
    return result.length > 0 ? result : undefined;
  };

  const templates = decodeSection<TemplateData>(compact.vt);
  const lifecycle = decodeSection<LifecycleHook>(compact.lc);
  const effects = decodeSection<EffectEdge>(compact.ef);
  const injections = decodeSection<InjectionEdge>(compact.inj);
  const reactivity = decodeSection<ReactivityEdge>(compact.rx);
  const types = decodeSection<TypeNodeData>(compact.ty);
  const typeRefs = decodeSection<TypeRefData>(compact.tr);

  // ============================================
  // 10.6. VUE-СЕКЦИЯ
  // ============================================
  const vue = decodeVueSection(
    compact.vue,
    stringDict,
    files,
    ids,
    sourceChains,
    (compact as any).componentProps,
    (compact as any).componentEvents,
    (compact as any).componentDirectives,
    (compact as any).componentSlots,
    (compact as any).htmlInterpolations
  );

  // ============================================
  // 10.6.1. ✅ v17.0.0: REACT-СЕКЦИЯ
  // ============================================
  const react = decodeReactSection(
    (compact as any).react,
    stringDict,
    ids
  );

  // ============================================
  // 10.7. ✅ v16.0.0: DOM API
  // ============================================
  const domApiArgs = compact.domApiArgs
    ? decodeDomApiArgs(compact.domApiArgs, stringDict, ids)
    : [];
  const domApiCalls = compact.domApiCalls
    ? decodeDomApiCalls(compact.domApiCalls, stringDict, ids, functions, domApiArgs)
    : [];

  // ============================================
  // 10.8. ✅ v16.0.0: fnHtmlUsage
  // ============================================
  if (compact.fnHtmlUsage) {
    decodeFnHtmlUsage(compact.fnHtmlUsage, stringDict, ids, functions);
  }

  // ============================================
  // 10.9. ✅ v16.0.2: usagesAsPropSource
  // ============================================
  if (vue?.componentProps && vue.componentProps.length > 0) {
    for (const prop of vue.componentProps) {
      const firstFnId = prop.sourceChain?.[0]?.functionId;
      if (!firstFnId) continue;
      const fn = functions.find(f => f.id === firstFnId);
      if (!fn) continue;
      if (!fn.usagesAsPropSource) fn.usagesAsPropSource = [];
      fn.usagesAsPropSource.push({
        usageId: prop.usageId,
        propId: prop.id,
        propName: prop.name,
        tag: '',
        targetFileId: null,
      });
    }
  }

  // ============================================
  // 10.10. ✅ v16.0.2: fnHtmlUsage top-level
  // ============================================
  const fnHtmlUsageTopLevel: HtmlUsage[] = [];
  for (const fn of functions) {
    if (Array.isArray(fn.htmlUsage)) {
      for (const u of fn.htmlUsage) {
        fnHtmlUsageTopLevel.push({ ...u, functionId: fn.id } as any);
      }
    }
  }

  // ============================================
  // 11. Edges
  // ============================================
  const shouldIncludeEdges = includeEdges === true;
  const edges: EdgeData[] = [];

  if (shouldIncludeEdges) {
    for (const imp of imports) {
      edges.push({
        from: imp.fromFileId,
        to: imp.toFileId || 'unknown',
        type: 'import',
        symbol: imp.importedName,
        line: imp.line,
      });
    }

    for (const exp of exports) {
      edges.push({
        from: exp.fileId,
        to: exp.functionId,
        type: 'export',
        symbol: exp.exportName,
        line: exp.line,
      });
    }

    for (const call of calls) {
      edges.push({
        from: call.fromFunctionId,
        to: call.toFunctionId,
        type: 'call',
        line: call.line,
      });
    }

    for (const re of reExports) {
      edges.push({
        from: re.moduleId,
        to: re.functionId,
        type: 're-export',
        symbol: re.exportName,
        line: re.line,
      });
    }

    for (const link of lexicalLinks) {
      if (!link.parentFunctionId) continue;
      edges.push({
        from: link.parentFunctionId,
        to: link.childFunctionId,
        type: 'lexical',
        symbol: link.relation,
        line: link.line,
      });
    }
  }

  // ============================================
  // 12. Сборка результата
  // ============================================
  const result: FullJSON = {
    version: CODEC_VERSION,
    timestamp: compact.ts,
    root: `m${(compact.r ?? 0) + 1}`,
    modules,
    files,
    functions,
    classes,
    constants,
    exports,
    imports,
    calls,
    reExports,
    templates,
    statistics,
    lifecycle,
    effects,
    injections,
    reactivity,
    types,
    typeRefs,
    valuesMode: compact.valuesMode,
    lexicalLinks: lexicalLinks.length > 0 ? lexicalLinks : undefined,
    vue,
    react,
  };

  // ============================================
  // ✅ v16.0.4: Top-level component* — ВСЕГДА
  // ============================================
  (result as any).domApiCalls = domApiCalls.length > 0 ? domApiCalls : undefined;
  (result as any).domApiArgs = domApiArgs.length > 0 ? domApiArgs : undefined;
  (result as any).ids = ids.length > 0 ? ids : undefined;
  (result as any).sourceChains = sourceChains.length > 0 ? sourceChains : undefined;

  (result as any).fnHtmlUsage = fnHtmlUsageTopLevel.length > 0 ? fnHtmlUsageTopLevel : undefined;

  (result as any).componentProps = vue?.componentProps ?? [];
  (result as any).componentEvents = vue?.componentEvents ?? [];
  (result as any).componentDirectives = vue?.componentDirectives ?? [];
  (result as any).componentSlots = vue?.componentSlots ?? [];
  (result as any).htmlInterpolations = vue?.htmlInterpolations ?? [];

  // ============================================
  // ✅ v16.0.4: Удаление пустых опциональных секций
  // ============================================
  if (!includeEmptyArrays) {
    if (modules.length === 0) delete (result as any).modules;
    if (files.length === 0) delete (result as any).files;
    if (functions.length === 0) delete (result as any).functions;
    if (classes.length === 0) delete (result as any).classes;
    if (constants.length === 0) delete (result as any).constants;
    if (exports.length === 0) delete (result as any).exports;
    if (imports.length === 0) delete (result as any).imports;
    if (calls.length === 0) delete (result as any).calls;
    if (reExports.length === 0) delete (result as any).reExports;
    if (lexicalLinks.length === 0) delete (result as any).lexicalLinks;
    if (vue === undefined) delete (result as any).vue;
    if (react === undefined) delete (result as any).react;
    if (domApiCalls.length === 0) delete (result as any).domApiCalls;
    if (domApiArgs.length === 0) delete (result as any).domApiArgs;
    if (ids.length === 0) delete (result as any).ids;
    if (sourceChains.length === 0) delete (result as any).sourceChains;
    if (fnHtmlUsageTopLevel.length === 0) delete (result as any).fnHtmlUsage;
  }

  if (shouldIncludeEdges && edges.length > 0) {
    result.edges = edges;
  }

  return result;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default decode;
