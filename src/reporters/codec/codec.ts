// src/reporters/codec/codec.ts
// ============================================
// ЕДИНЫЙ МОДУЛЬ КОДЕКОВ
// ============================================
// Версия: 9.0.2 (Стратегия B — строгий round-trip + Vue templates + lifecycle + effects + injections + reactivity + conditionals + types)
//
// ИЗМЕНЕНИЯ v9.0.2 (ДИАГНОСТИКА):
//   - ✅ ДОБАВЛЕНО: подробное логирование входных данных в Codec.encode
//   - ✅ ДОБАВЛЕНО: проверка Array.isArray для всех секций
//   - ✅ ДОБАВЛЕНО: проверка на undefined-элементы в массивах
//   - ✅ ДОБАВЛЕНО: детальный вывод templates (все 12 полей)
//   - ✅ ДОБАВЛЕНО: try/catch вокруг цикла обработки templates
//   - ✅ ДОБАВЛЕНО: защита Array.isArray в vt-секции
//
// ИЗМЕНЕНИЯ v9.0.1:
//   - ✅ ИСПРАВЛЕНО: в encode для lc/ef/rx заменено `|| 0` на `?? -1`.
//     Ранее отсутствие функции-владельца превращалось в 0, который
//     выглядел как валидный индекс fn1. Теперь отсутствие = -1.
//   - ✅ ИСПРАВЛЕНО: в decode для lc/ef/rx корректно обрабатывается -1:
//     `fn${funcIdx}` → `funcIdx >= 0 ? 'fn${funcIdx}' : ''`.
//   - ✅ ДОБАВЛЕНО: диагностика vt.length !== 12 при AST_DEBUG_CODEC=true.
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ ДОБАВЛЕНО: секции lc, ef, inj, rx, cd, ty, tr в CompactJSON
//   - ✅ ДОБАВЛЕНО: словари LIFECYCLE_TYPES, EFFECT_TYPES, INJECTION_TYPES,
//     REACTIVITY_TYPES, CONDITIONAL_TYPES, TYPE_KINDS, TYPE_USAGE_KINDS
//   - ✅ ДОБАВЛЕНО: vt.dynamicComponents расширен до 3 элементов
//     (isExpressionIdx, line, resolvedComponentsIdx[])
//   - ✅ ДОБАВЛЕНО: хелпер reverseLookup для типобезопасного маппинга
//   - ✅ ДОБАВЛЕНО: Codec.deepEqual с нормализацией (порядок ключей, undefined)
//   - ✅ ИСПРАВЛЕНО: verifyRoundTrip использует deepEqual вместо JSON.stringify
//   - ✅ ИСПРАВЛЕНО: пустые секции → undefined (не [])
//
// ИЗМЕНЕНИЯ v8.5.0:
//   - encode: сбор vt из payload.templates
//   - decode: восстановление templates из vt
//   - decode: includeEmptyArrays удаляет пустой templates
//   - arraySchemas: добавлены схемы vt.*
//
// ИЗМЕНЕНИЯ v3.1.0:
//   - decode() принимает DecodeOptions (includeEdges, includeEmptyArrays, includeStatistics)
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - encode: словари (stringDict, paramDict, methodDict, valueDict)
//   - encode: новые кортежи с индексами словарей
//   - encode: mi/fl стали объектами {n,f}/{p,m}
//   - encode: gr.c использует 'e' для external-вызовов
//   - decode: восстановление из словарей
//   - decode: восстановление edges из gr.*
//   - CALL_TYPES: добавлен 'e' → 'external'
//   - getLegend: добавлены arraySchemas и словари
//   - ESLint: все Array<T> заменены на T[]
// ============================================

import type {
  FullJSON,
  CompactJSON,
  CodecLegend,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  StatisticsData,
  EdgeData,
  ModuleData,
  FileData,
  TemplateData,
  DecodeOptions,
  // ✅ НОВОЕ v9.0.0
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TemplateConditional,
  TypeNodeData,
  TypeRefData,
} from './codec-types.js';

// ============================================
// СЛОВАРИ (DICTIONARIES)
// ============================================

/**
 * Карта флагов: бит → символ
 *
 * Биты:
 *   1      = async
 *   2      = exported
 *   4      = method
 *   8      = arrow
 *   16     = event handler
 *   32     = nested
 *   64     = self
 *   128    = dynamic
 *   256    = config
 *   512    = external
 *   1024   = vue template
 *   2048   = async chain
 *   4096   = closure
 *   8192   = type dep
 *   16384  = generator
 *   32768  = private
 *   65536  = protected
 *   131072 = static
 */
export const FLAG_MAP: Record<number, string> = {
  1: 'a', // async
  2: 'e', // exported
  4: 'm', // method
  8: 'r', // arrow
  16: 'v', // event handler
  32: 'n', // nested
  64: 's', // self
  128: 'd', // dynamic
  256: 'c', // config
  512: 'x', // external
  1024: 't', // vue template
  2048: 'A', // async chain (ЗАГЛАВНАЯ A, чтобы не путать с async 'a')
  4096: 'l', // closure
  8192: 'y', // type dep
  16384: 'g', // generator
  32768: 'p', // private
  65536: 'P', // protected
  131072: 'S', // static
};

/**
 * Обратная карта: символ → бит
 */
export const FLAG_CHAR_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([bit, char]) => [char, parseInt(bit, 10)])
);

/**
 * Имена флагов: бит → имя
 */
export const FLAG_NAMES: Record<number, string> = {
  1: 'isAsync',
  2: 'isExported',
  4: 'isMethod',
  8: 'isArrow',
  16: 'isEventHandler',
  32: 'isNested',
  64: 'isSelf',
  128: 'isDynamic',
  256: 'isConfig',
  512: 'isExternal',
  1024: 'isVueTemplate',
  2048: 'isAsyncChain',
  4096: 'isClosure',
  8192: 'isTypeDep',
  16384: 'isGenerator',
  32768: 'isPrivate',
  65536: 'isProtected',
  131072: 'isStatic',
};

/**
 * Типы связей (общие)
 */
export const RELATION_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
  e: 'external',
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type-only',
  ne: 'named-export',
  de: 'default-export',
  te: 'type-export',
  re: 're-export',
  all: 'all',
};

/**
 * Типы экспортов
 */
export const EXPORT_TYPES: Record<string, string> = {
  ne: 'named',
  de: 'default',
  te: 'type',
  re: 're-export',
};

/**
 * Типы импортов
 */
export const IMPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type-only',
};

/**
 * Типы вызовов
 * 'e' — external (внешний вызов, toFunctionId — 'external:name')
 */
export const CALL_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
  e: 'external',
};

/**
 * Типы реэкспортов
 */
export const RE_EXPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  all: 'all',
};

// ============================================
// v9.0.0: СЛОВАРИ ТИПОВ
// ============================================

/**
 * Хуки жизненного цикла Vue
 */
export const LIFECYCLE_TYPES: Record<string, string> = {
  m: 'onMounted',
  u: 'onUnmounted',
  s: 'onScopeDispose',
  a: 'onActivated',
  d: 'onDeactivated',
  w: 'watch',
  W: 'watchEffect',
  e: 'onErrorCaptured',
};

export const LIFECYCLE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(LIFECYCLE_TYPES).map(([code, name]) => [name, code])
);

/**
 * Типы side-эффектов
 */
export const EFFECT_TYPES: Record<string, string> = {
  t: 'timer',        // setTimeout / setInterval
  c: 'cleanup',      // clearTimeout / AbortController.abort
  p: 'promise',      // then / catch / finally
  e: 'event',        // addEventListener
  s: 'subscription', // .subscribe / .unsubscribe
};

export const EFFECT_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(EFFECT_TYPES).map(([code, name]) => [name, code])
);

/**
 * Типы provide/inject
 */
export const INJECTION_TYPES: Record<string, string> = {
  p: 'provide',
  i: 'inject',
};

export const INJECTION_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(INJECTION_TYPES).map(([code, name]) => [name, code])
);

/**
 * Типы реактивности Vue
 */
export const REACTIVITY_TYPES: Record<string, string> = {
  c: 'computed',
  w: 'watch',
  W: 'watchEffect',
  r: 'ref',
  R: 'reactive',
  S: 'shallowRef',
  o: 'readonly',
};

export const REACTIVITY_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(REACTIVITY_TYPES).map(([code, name]) => [name, code])
);

/**
 * Типы условных директив
 */
export const CONDITIONAL_TYPES: Record<string, string> = {
  i: 'v-if',
  e: 'v-else-if',
  E: 'v-else',
};

export const CONDITIONAL_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(CONDITIONAL_TYPES).map(([code, name]) => [name, code])
);

/**
 * Виды type-узлов
 */
export const TYPE_KINDS: Record<string, string> = {
  i: 'interface',
  t: 'type-alias',
  e: 'enum',
  c: 'class',
};

export const TYPE_KINDS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_KINDS).map(([code, name]) => [name, code])
);

/**
 * Виды использования типов
 */
export const TYPE_USAGE_KINDS: Record<string, string> = {
  p: 'param',
  r: 'return',
  f: 'field',
  g: 'generic',
  u: 'union',
  x: 'extends',
};

export const TYPE_USAGE_KINDS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_USAGE_KINDS).map(([code, name]) => [name, code])
);

/**
 * Карта ключей: полное имя → короткое
 */
export const KEY_MAP: Record<string, string> = {
  version: 'v',
  timestamp: 'ts',
  root: 'r',
  modules: 'mi',
  files: 'fl',
  functions: 'fns',
  classes: 'cls',
  constants: 'cn',
  exports: 'e',
  imports: 'i',
  calls: 'c',
  reExports: 're',
  templates: 'vt',
  statistics: 'st',
  legend: 'legend',
  edges: 'edges',
  id: 'id',
  name: 'n',
  moduleId: 'm',
  fileId: 'f',
  line: 'l',
  isExported: 'e',
  isAsync: 'a',
  isArrow: 'r',
  isMethod: 'mt',
  params: 'p',
  returnType: 'rt',
  methods: 'm',
  value: 'val',
  functionId: 'fn',
  exportName: 'en',
  localName: 'ln',
  type: 't',
  isDefault: 'df',
  isTypeOnly: 'to',
  isStarReExport: 'sr',
  fromFileId: 'ff',
  toFileId: 'tf',
  importedName: 'in',
  isNamespace: 'ns',
  isExternal: 'ext',
  packageName: 'pkg',
  fromFunctionId: 'ffn',
  toFunctionId: 'tfn',
  source: 'src',
};

/**
 * Обратная карта: короткое → полное
 */
export const KEY_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([full, short]) => [short, full])
);

// ============================================
// ФУНКЦИИ КОДИРОВАНИЯ ФЛАГОВ
// ============================================

/**
 * Кодирует булевы флаги в число
 */
export function encodeFlags(
  obj: Partial<FunctionData & ClassData & ConstantData>
): number {
  let flags = 0;
  if (obj.isAsync) flags |= 1;
  if (obj.isExported) flags |= 2;
  if (obj.isMethod) flags |= 4;
  if (obj.isArrow) flags |= 8;
  return flags;
}

/**
 * Кодирует число флагов в строку символов
 */
export function flagsToString(flags: number): string {
  if (flags === 0) return '0';
  let result = '';
  for (const [bitStr, char] of Object.entries(FLAG_MAP)) {
    if (flags & parseInt(bitStr, 10)) {
      result += char;
    }
  }
  return result || '0';
}

/**
 * Декодирует строку символов в число флагов
 */
export function flagsStringToNumber(flagStr: string): number {
  if (!flagStr || flagStr === '0') return 0;
  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }
  return flags;
}

/**
 * Результат декодирования флагов
 */
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

/**
 * Создаёт «пустой» объект флагов
 */
function createEmptyFlags(): DecodedFlags {
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

/**
 * Декодирует строку символов в объект с булевыми полями
 */
export function decodeFlagsToObject(flagStr: string): DecodedFlags {
  const result = createEmptyFlags();
  if (!flagStr || flagStr === '0') return result;

  const flags = flagsStringToNumber(flagStr);

  result.isAsync = !!(flags & 1);
  result.isExported = !!(flags & 2);
  result.isMethod = !!(flags & 4);
  result.isArrow = !!(flags & 8);
  result.isEventHandler = !!(flags & 16);
  result.isNested = !!(flags & 32);
  result.isSelf = !!(flags & 64);
  result.isDynamic = !!(flags & 128);
  result.isConfig = !!(flags & 256);
  result.isExternal = !!(flags & 512);
  result.isVueTemplate = !!(flags & 1024);
  result.isAsyncChain = !!(flags & 2048);
  result.isClosure = !!(flags & 4096);
  result.isTypeDep = !!(flags & 8192);
  result.isGenerator = !!(flags & 16384);
  result.isPrivate = !!(flags & 32768);
  result.isProtected = !!(flags & 65536);
  result.isStatic = !!(flags & 131072);

  return result;
}

/**
 * Декодирует строку флагов в массив имён
 */
export function decodeFlagsToNames(flagStr: string): string[] {
  const flags = flagsStringToNumber(flagStr);
  if (flags === 0) return [];

  const names: string[] = [];
  for (const [bitStr, name] of Object.entries(FLAG_NAMES)) {
    if (flags & parseInt(bitStr, 10)) {
      names.push(name);
    }
  }
  return names;
}

// ============================================
// ХЕЛПЕРЫ ДЛЯ СЛОВАРЕЙ
// ============================================

interface DictBuilder {
  stringDict: string[];
  stringMap: Map<string, number>;
  paramDict: string[];
  paramMap: Map<string, number>;
  methodDict: string[];
  methodMap: Map<string, number>;
  valueDict: unknown[];
  valueMap: Map<string, number>;
}

function createDictBuilder(): DictBuilder {
  return {
    stringDict: [],
    stringMap: new Map(),
    paramDict: [],
    paramMap: new Map(),
    methodDict: [],
    methodMap: new Map(),
    valueDict: [],
    valueMap: new Map(),
  };
}

/**
 * Добавить строку в stringDict, вернуть индекс.
 * Пустая строка, undefined или null → -1.
 */
function addString(dict: DictBuilder, str: string | undefined | null): number {
  if (str === undefined || str === null || str === '') return -1;
  const existing = dict.stringMap.get(str);
  if (existing !== undefined) return existing;
  const idx = dict.stringDict.length;
  dict.stringDict.push(str);
  dict.stringMap.set(str, idx);
  return idx;
}

/**
 * Добавить параметр в paramDict, вернуть индекс.
 */
function addParam(dict: DictBuilder, param: string): number {
  if (!param) return -1;
  const existing = dict.paramMap.get(param);
  if (existing !== undefined) return existing;
  const idx = dict.paramDict.length;
  dict.paramDict.push(param);
  dict.paramMap.set(param, idx);
  return idx;
}

/**
 * Добавить метод в methodDict, вернуть индекс.
 */
function addMethod(dict: DictBuilder, method: string): number {
  if (!method) return -1;
  const existing = dict.methodMap.get(method);
  if (existing !== undefined) return existing;
  const idx = dict.methodDict.length;
  dict.methodDict.push(method);
  dict.methodMap.set(method, idx);
  return idx;
}

/**
 * Добавить значение в valueDict, вернуть индекс.
 * Для примитивов — ключ = String(value).
 * Для объектов — ключ = JSON.stringify(value).
 */
function addValue(dict: DictBuilder, value: unknown): number {
  if (value === undefined) return -1;
  const key =
    typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value);
  const existing = dict.valueMap.get(key);
  if (existing !== undefined) return existing;
  const idx = dict.valueDict.length;
  dict.valueDict.push(value);
  dict.valueMap.set(key, idx);
  return idx;
}

/**
 * ✅ v9.0.0: типобезопасный reverse lookup.
 * Возвращает код по имени. Если имени нет — первый код словаря
 * (гарантирует round-trip: undefined → код → имя из словаря).
 */
function reverseLookup(dict: Record<string, string>, name: string | undefined): string {
  if (!name) return Object.keys(dict)[0] ?? '?';
  const reverse = Object.fromEntries(Object.entries(dict).map(([c, n]) => [n, c]));
  return reverse[name] ?? Object.keys(dict)[0] ?? '?';
}

// ============================================
// ДИАГНОСТИЧЕСКИЕ ХЕЛПЕРЫ
// ============================================

/**
 * Проверяет, является ли значение массивом, и возвращает его
 * (или пустой массив, если нет).
 */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Логирует состояние входных данных для Codec.encode
 */
function logEncodeInput(payload: FullJSON): void {
  console.log('\n🔍 [Codec.encode] ВХОДНЫЕ ДАННЫЕ:');
  console.log('   version:', payload?.version);
  console.log('   root:', payload?.root);
  console.log(
    '   modules:',
    Array.isArray(payload?.modules) ? payload.modules.length : 'NOT ARRAY'
  );
  console.log(
    '   files:',
    Array.isArray(payload?.files) ? payload.files.length : 'NOT ARRAY'
  );
  console.log(
    '   functions:',
    Array.isArray(payload?.functions) ? payload.functions.length : 'NOT ARRAY'
  );
  console.log(
    '   classes:',
    Array.isArray(payload?.classes) ? payload.classes.length : 'NOT ARRAY'
  );
  console.log(
    '   constants:',
    Array.isArray(payload?.constants) ? payload.constants.length : 'NOT ARRAY'
  );
  console.log(
    '   exports:',
    Array.isArray(payload?.exports) ? payload.exports.length : 'NOT ARRAY'
  );
  console.log(
    '   imports:',
    Array.isArray(payload?.imports) ? payload.imports.length : 'NOT ARRAY'
  );
  console.log(
    '   calls:',
    Array.isArray(payload?.calls) ? payload.calls.length : 'NOT ARRAY'
  );
  console.log(
    '   reExports:',
    Array.isArray(payload?.reExports) ? payload.reExports.length : 'NOT ARRAY'
  );
  console.log(
    '   templates:',
    Array.isArray(payload?.templates) ? payload.templates.length : 'NOT ARRAY'
  );
  console.log(
    '   lifecycle:',
    Array.isArray(payload?.lifecycle) ? payload.lifecycle.length : 'NOT ARRAY'
  );
  console.log(
    '   effects:',
    Array.isArray(payload?.effects) ? payload.effects.length : 'NOT ARRAY'
  );
  console.log(
    '   injections:',
    Array.isArray(payload?.injections) ? payload.injections.length : 'NOT ARRAY'
  );
  console.log(
    '   reactivity:',
    Array.isArray(payload?.reactivity) ? payload.reactivity.length : 'NOT ARRAY'
  );
  console.log(
    '   conditionals:',
    Array.isArray(payload?.conditionals) ? payload.conditionals.length : 'NOT ARRAY'
  );
  console.log(
    '   types:',
    Array.isArray(payload?.types) ? payload.types.length : 'NOT ARRAY'
  );
  console.log(
    '   typeRefs:',
    Array.isArray(payload?.typeRefs) ? payload.typeRefs.length : 'NOT ARRAY'
  );

  // Проверка на undefined-элементы
  const checkArray = (name: string, arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === undefined || arr[i] === null) {
        console.error(`   ❌ ${name}[${i}] === ${arr[i]}`);
      }
    }
  };
  checkArray('templates', payload?.templates);
  checkArray('lifecycle', payload?.lifecycle);
  checkArray('effects', payload?.effects);
  checkArray('injections', payload?.injections);
  checkArray('reactivity', payload?.reactivity);
  checkArray('conditionals', payload?.conditionals);
  checkArray('types', payload?.types);
  checkArray('typeRefs', payload?.typeRefs);
  checkArray('functions', payload?.functions);
  checkArray('classes', payload?.classes);
  checkArray('constants', payload?.constants);
  checkArray('exports', payload?.exports);
  checkArray('imports', payload?.imports);
  checkArray('calls', payload?.calls);
  checkArray('reExports', payload?.reExports);

  // Детальная проверка templates
  if (Array.isArray(payload?.templates)) {
    console.log('\n🔍 [Codec.encode] ДЕТАЛИ templates:');
    payload.templates.forEach((t: any, i: number) => {
      if (!t) {
        console.error(`   ❌ templates[${i}] === ${t}`);
        return;
      }
      console.log(`   templates[${i}]:`);
      console.log(`      fileId: ${t.fileId}`);
      console.log(`      moduleId: ${t.moduleId}`);
      console.log(
        `      reactivityDeps: ${Array.isArray(t.reactivityDeps) ? `[${t.reactivityDeps.length}]` : typeof t.reactivityDeps} (${t.reactivityDeps === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      eventHandlers: ${Array.isArray(t.eventHandlers) ? `[${t.eventHandlers.length}]` : typeof t.eventHandlers} (${t.eventHandlers === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      dynamicComponents: ${Array.isArray(t.dynamicComponents) ? `[${t.dynamicComponents.length}]` : typeof t.dynamicComponents} (${t.dynamicComponents === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      directives: ${Array.isArray(t.directives) ? `[${t.directives.length}]` : typeof t.directives} (${t.directives === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      usedComponents: ${Array.isArray(t.usedComponents) ? `[${t.usedComponents.length}]` : typeof t.usedComponents} (${t.usedComponents === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      templateRefs: ${Array.isArray(t.templateRefs) ? `[${t.templateRefs.length}]` : typeof t.templateRefs} (${t.templateRefs === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      cssVariables: ${Array.isArray(t.cssVariables) ? `[${t.cssVariables.length}]` : typeof t.cssVariables} (${t.cssVariables === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      deepSelectors: ${Array.isArray(t.deepSelectors) ? `[${t.deepSelectors.length}]` : typeof t.deepSelectors} (${t.deepSelectors === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(
        `      slots: ${Array.isArray(t.slots) ? `[${t.slots.length}]` : typeof t.slots} (${t.slots === undefined ? 'UNDEFINED' : 'ok'})`
      );
      console.log(`      complexity: ${t.complexity}`);
      console.log(
        `      conditionals: ${Array.isArray(t.conditionals) ? `[${t.conditionals.length}]` : typeof t.conditionals} (${t.conditionals === undefined ? 'UNDEFINED' : 'ok'})`
      );
    });
  }
}

// ============================================
// ОСНОВНОЙ КОДЕК
// ============================================

export class Codec {
  // ============================================
  // ENCODE: FullJSON → CompactJSON
  // ============================================

  /**
   * Кодирует полный JSON в сжатый.
   *
   * @param payload - Полный JSON
   * @returns Сжатый JSON с легендой
   */
  static encode(payload: FullJSON): CompactJSON {
    // ============================================
    // 🔍 ДИАГНОСТИКА (v9.0.2)
    // ============================================
    if (process.env.AST_DEBUG_CODEC === 'true' || true) {
      // Всегда логируем для отладки проблемы с .map()
      logEncodeInput(payload);
    }

    const dict = createDictBuilder();

    // ============================================
    // 1. Индексы модулей
    // ============================================
    const moduleIndex: Record<string, { n: string; f: string[] }> = {};
    const moduleReverse: Record<string, number> = {};
    asArray<ModuleData>(payload.modules).forEach((mod, idx) => {
      if (!mod) return;
      moduleIndex[mod.id] = { n: mod.name, f: asArray<string>(mod.fileIds) };
      moduleReverse[mod.id] = idx + 1;
    });

    // ============================================
    // 2. Индексы файлов
    // ============================================
    const fileIndex: Record<string, { p: string; m: string }> = {};
    const fileReverse: Record<string, number> = {};
    asArray<FileData>(payload.files).forEach((file, idx) => {
      if (!file) return;
      fileIndex[file.id] = { p: file.path, m: file.moduleId };
      fileReverse[file.id] = idx + 1;
    });

    // ============================================
    // 3. Индексы функций
    // ============================================
    const functionReverse: Record<string, number> = {};
    const functions: CompactJSON['fns'] = [];

    asArray<FunctionData>(payload.functions).forEach((func, idx) => {
      if (!func) return;
      functionReverse[func.id] = idx + 1;

      const flags = encodeFlags(func);
      const paramsIdx = asArray<string>(func.params).map(p => addParam(dict, p));
      const returnTypeIdx = addString(dict, func.returnType);

      functions.push([
        func.id,
        func.name,
        func.moduleId,
        func.fileId,
        func.line,
        flagsToString(flags),
        paramsIdx,
        returnTypeIdx,
      ]);
    });

    // ============================================
    // 4. Индексы классов
    // ============================================
    const classes: CompactJSON['cls'] = asArray<ClassData>(payload.classes).map(cls => {
      const flags = encodeFlags(cls);
      const methodsIdx = asArray<string>(cls.methods).map(m => addMethod(dict, m));

      return [
        cls.id,
        cls.name,
        cls.moduleId,
        cls.fileId,
        cls.line,
        flagsToString(flags),
        methodsIdx,
      ];
    });

    // ============================================
    // 5. Индексы констант
    // ============================================
    const constants: CompactJSON['cn'] = asArray<ConstantData>(payload.constants).map(cn => {
      const flags = encodeFlags(cn);
      const valueIdx = addValue(dict, cn.value);

      return [
        cn.id,
        cn.name,
        cn.moduleId,
        cn.fileId,
        cn.line,
        flagsToString(flags),
        valueIdx,
      ];
    });

    // ============================================
    // 6. Экспорты (gr.e)
    // ============================================
    const exports: CompactJSON['gr']['e'] = asArray<ExportData>(payload.exports).map(exp => {
      const moduleIdx = moduleReverse[exp.moduleId] || 0;
      const fileIdx = fileReverse[exp.fileId] || 0;
      const funcIdx = functionReverse[exp.functionId] || 0;

      let typeCode = 'ne';
      if (exp.isDefault) typeCode = 'de';
      else if (exp.isTypeOnly || exp.type === 'type') typeCode = 'te';

      const exportNameIdx = addString(dict, exp.exportName);
      const localNameIdx = addString(dict, exp.localName);
      const sourceIdx = addString(dict, exp.source);

      return [
        moduleIdx,
        fileIdx,
        funcIdx,
        exp.line,
        typeCode,
        exportNameIdx,
        localNameIdx,
        exp.isTypeOnly ? 1 : 0,
        exp.isReExport ? 1 : 0,
        sourceIdx,
      ];
    });

    // ============================================
    // 7. Импорты (gr.i)
    // ============================================
    const imports: CompactJSON['gr']['i'] = asArray<ImportData>(payload.imports).map(imp => {
      const fromFileIdx = fileReverse[imp.fromFileId] || 0;
      const toFileIdIdx = addString(dict, imp.toFileId ?? '');
      const sourceIdx = addString(dict, imp.source);
      const importedNameIdx = addString(dict, imp.importedName);
      const localNameIdx = addString(dict, imp.localName);

      let typeCode = 'n';
      if (imp.isDefault) typeCode = 'df';
      else if (imp.isNamespace) typeCode = 'ns';
      else if (imp.isTypeOnly) typeCode = 'to';

      return [
        fromFileIdx,
        toFileIdIdx,
        sourceIdx,
        importedNameIdx,
        localNameIdx,
        imp.line,
        typeCode,
        imp.isExternal ? 1 : 0,
      ];
    });

    // ============================================
    // 8. Вызовы (gr.c)
    // ============================================
    const calls: CompactJSON['gr']['c'] = asArray<CallData>(payload.calls).map(call => {
      const fromIdx = functionReverse[call.fromFunctionId] || 0;

      let toIdxOrExternalIdx: number;
      let typeCode: string;

      if (call.toFunctionId.startsWith('external:')) {
        toIdxOrExternalIdx = addString(dict, call.toFunctionId);
        typeCode = 'e';
      } else {
        toIdxOrExternalIdx = functionReverse[call.toFunctionId] || 0;
        typeCode = call.type.charAt(0);
      }

      return [fromIdx, toIdxOrExternalIdx, call.line, typeCode];
    });

    // ============================================
    // 9. Реэкспорты (gr.re)
    // ============================================
    const reExports: CompactJSON['gr']['re'] = asArray<ReExportData>(payload.reExports).map(re => {
      const moduleIdx = moduleReverse[re.moduleId] || 0;
      const funcIdx = functionReverse[re.functionId] || 0;

      let typeCode = 'n';
      if (re.isStarReExport) typeCode = 'all';
      else if (re.isDefault) typeCode = 'df';

      const sourceIdx = addString(dict, re.source);
      const exportNameIdx = addString(dict, re.exportName);

      return [
        moduleIdx,
        funcIdx,
        sourceIdx,
        exportNameIdx,
        re.line,
        typeCode,
        re.isTypeOnly ? 1 : 0,
      ];
    });

    // ============================================
    // 9.5. Vue templates (vt) — ОТДЕЛЬНЫЕ СУЩНОСТИ
    // ============================================
    const vueTemplates: NonNullable<CompactJSON['vt']> = [];

    for (const template of asArray<TemplateData>(payload.templates)) {
      // 🔍 ДИАГНОСТИКА: проверка template
      if (!template) {
        console.error('❌ [Codec.encode] template === undefined, skip');
        continue;
      }

      if (process.env.AST_DEBUG_CODEC === 'true' || true) {
        console.log(`\n🔍 [Codec.encode] Обработка template: ${template.fileId || 'unknown'}`);
        console.log('   reactivityDeps is array?', Array.isArray(template.reactivityDeps));
        console.log('   eventHandlers is array?', Array.isArray(template.eventHandlers));
        console.log('   dynamicComponents is array?', Array.isArray(template.dynamicComponents));
        console.log('   directives is array?', Array.isArray(template.directives));
        console.log('   usedComponents is array?', Array.isArray(template.usedComponents));
        console.log('   templateRefs is array?', Array.isArray(template.templateRefs));
        console.log('   cssVariables is array?', Array.isArray(template.cssVariables));
        console.log('   deepSelectors is array?', Array.isArray(template.deepSelectors));
        console.log('   slots is array?', Array.isArray(template.slots));
        console.log('   conditionals is array?', Array.isArray(template.conditionals));
      }

      try {
        const fileIdx = fileReverse[template.fileId] || 0;
        const moduleIdx = moduleReverse[template.moduleId] || 0;

        // ✅ v9.0.2: используем asArray вместо || []
        const reactivityDepsIdx = asArray<string>(template.reactivityDeps).map((d: string) =>
          addString(dict, d)
        );

        // ✅ v9.0.2: защита от undefined-элементов в eventHandlers
        const eventHandlersRaw = asArray<any>(template.eventHandlers);
        console.log(`   → eventHandlers длина: ${eventHandlersRaw.length}`);

        const eventHandlers: [
          number,
          number,
          number,
          number,
          number[],
          number,
        ][] = eventHandlersRaw.map((h: any) => {
          if (!h) {
            console.error('   ❌ eventHandler === undefined');
            return [0, 0, 0, 0, [], 0];
          }
          return [
            addString(dict, h.eventName),
            addString(dict, h.handlerName),
            addString(dict, h.tag),
            h.line || 0,
            asArray<string>(h.modifiers).map((m: string) => addString(dict, m)),
            h.isExternal ? 1 : 0,
          ];
        });

        // ✅ v9.0.2: защита от undefined-элементов в dynamicComponents
        const dynamicComponentsRaw = asArray<any>(template.dynamicComponents);
        console.log(`   → dynamicComponents длина: ${dynamicComponentsRaw.length}`);

        const dynamicComponents: [number, number, number[]][] = dynamicComponentsRaw.map(
          (d: any) => {
            if (!d) {
              console.error('   ❌ dynamicComponent === undefined');
              return [0, 0, []];
            }
            return [
              addString(dict, d.isExpression),
              d.line || 0,
              asArray<string>(d.resolvedComponents).map((c: string) => addString(dict, c)),
            ];
          }
        );

        const directivesIdx = asArray<string>(template.directives).map((d: string) =>
          addString(dict, d)
        );

        const usedComponentsIdx = asArray<string>(template.usedComponents).map((c: string) =>
          addString(dict, c)
        );

        // ✅ v9.0.2: защита от undefined-элементов в templateRefs
        const templateRefsRaw = asArray<any>(template.templateRefs);
        console.log(`   → templateRefs длина: ${templateRefsRaw.length}`);

        const templateRefs: [number, number, number, number[]][] = templateRefsRaw.map(
          (r: any) => {
            if (!r) {
              console.error('   ❌ templateRef === undefined');
              return [0, 0, 0, []];
            }
            return [
              addString(dict, r.refValue),
              addString(dict, r.tag),
              r.line || 0,
              asArray<string>(r.exposedMethods).map((m: string) => addString(dict, m)),
            ];
          }
        );

        // ✅ v9.0.2: защита от undefined-элементов в cssVariables
        const cssVariablesRaw = asArray<any>(template.cssVariables);
        console.log(`   → cssVariables длина: ${cssVariablesRaw.length}`);

        const cssVariables: [number, number, number, number][] = cssVariablesRaw.map(
          (v: any) => {
            if (!v) {
              console.error('   ❌ cssVariable === undefined');
              return [0, -1, 0, 0];
            }
            return [
              addString(dict, v.name),
              addString(dict, v.value),
              v.line || 0,
              v.isMultiline ? 1 : 0,
            ];
          }
        );

        // ✅ v9.0.2: защита от undefined-элементов в deepSelectors
        const deepSelectorsRaw = asArray<any>(template.deepSelectors);
        console.log(`   → deepSelectors длина: ${deepSelectorsRaw.length}`);

        const deepSelectors: [number, number][] = deepSelectorsRaw.map((s: any) => {
          if (!s) {
            console.error('   ❌ deepSelector === undefined');
            return [0, 0];
          }
          return [addString(dict, s.selector), s.line || 0];
        });

        const slotsIdx = asArray<string>(template.slots).map((s: string) => addString(dict, s));

        vueTemplates.push([
          fileIdx,
          moduleIdx,
          template.complexity || 0,
          reactivityDepsIdx,
          eventHandlers,
          dynamicComponents,
          directivesIdx,
          usedComponentsIdx,
          templateRefs,
          cssVariables,
          deepSelectors,
          slotsIdx,
        ]);
      } catch (err) {
        console.error('❌ [Codec.encode] Ошибка в template:', template?.fileId, err);
        console.error(
          '   template =',
          JSON.stringify(template, null, 2).substring(0, 2000)
        );
      }
    }

    // ✅ v9.0.1: диагностика vt.length !== 12
    if (process.env.AST_DEBUG_CODEC === 'true') {
      for (let i = 0; i < vueTemplates.length; i++) {
        const vt = vueTemplates[i];
        if (vt && vt.length !== 12) {
          console.warn(
            `⚠️ [Codec.encode] vt[${i}] содержит ${vt.length} полей вместо 12. ` +
            `Поля 9-12 (templateRefs, cssVariables, deepSelectors, slotsIdx) ` +
            `отсутствуют в TemplateData. Проверьте compact-reporter.ts::collectFullJSON ` +
            `и json-reporter.ts::extractEntitiesFromFile (.vue ветка).`
          );
        }
      }
    }

    // ============================================
    // 9.6. v9.0.0: LIFECYCLE (lc)
    // ============================================
    const lifecycle: NonNullable<CompactJSON['lc']> = [];
    for (const lc of asArray<LifecycleHook>(payload.lifecycle)) {
      if (!lc) continue;
      const funcIdx = functionReverse[lc.functionId] ?? -1;
      const callbackFnIdx = lc.callbackFunctionId
        ? (functionReverse[lc.callbackFunctionId] ?? -1)
        : -1;
      const hookCode = reverseLookup(LIFECYCLE_TYPES, lc.hookName);
      const flags = lc.isSetupContext ? 's' : '0';
      lifecycle.push([hookCode, funcIdx, lc.line, callbackFnIdx, flags]);
    }

    // ============================================
    // 9.7. v9.0.0: EFFECTS (ef)
    // ============================================
    const effects: NonNullable<CompactJSON['ef']> = [];
    for (const ef of asArray<EffectEdge>(payload.effects)) {
      if (!ef) continue;
      const funcIdx = functionReverse[ef.functionId] ?? -1;
      const targetIdx = addString(dict, ef.targetName);
      const metaIdx = addString(dict, ef.metaValue);
      const effectCode = reverseLookup(EFFECT_TYPES, ef.effectType);
      effects.push([effectCode, funcIdx, ef.line, targetIdx, metaIdx]);
    }

    // ============================================
    // 9.8. v9.0.0: INJECTIONS (inj)
    // ============================================
    const injections: NonNullable<CompactJSON['inj']> = [];
    for (const inj of asArray<InjectionEdge>(payload.injections)) {
      if (!inj) continue;
      const fileIdx = fileReverse[inj.fileId] || 0;
      const keyIdx = addString(dict, inj.key);
      const kindCode = reverseLookup(INJECTION_TYPES, inj.kind);
      let flags = 0;
      if (inj.isSymbolKey) flags |= 1;
      if (inj.hasDefault) flags |= 2;
      injections.push([kindCode, fileIdx, inj.line, keyIdx, flags]);
    }

    // ============================================
    // 9.9. v9.0.0: REACTIVITY (rx)
    // ============================================
    const reactivity: NonNullable<CompactJSON['rx']> = [];
    for (const rx of asArray<ReactivityEdge>(payload.reactivity)) {
      if (!rx) continue;
      const funcIdx = functionReverse[rx.functionId] ?? -1;
      const readsIdx = asArray<string>(rx.reads).map((r: string) => addString(dict, r));
      const writesIdx = asArray<string>(rx.writes).map((w: string) => addString(dict, w));
      const kindCode = reverseLookup(REACTIVITY_TYPES, rx.kind);
      const flags = rx.isWriteable ? 1 : 0;
      reactivity.push([kindCode, funcIdx, rx.line, readsIdx, writesIdx, flags]);
    }

    // ============================================
    // 9.10. v9.0.0: CONDITIONALS (cd)
    // ============================================
    const conditionals: NonNullable<CompactJSON['cd']> = [];
    for (const cd of asArray<TemplateConditional>(payload.conditionals)) {
      if (!cd) continue;
      const fileIdx = fileReverse[cd.fileId] || 0;
      const condIdx = addString(dict, cd.conditionExpression);
      const compIdx = addString(dict, cd.renderedComponent);
      const directiveCode = reverseLookup(CONDITIONAL_TYPES, cd.directive);
      const flags = 0;
      conditionals.push([directiveCode, fileIdx, cd.line, condIdx, compIdx, flags]);
    }

    // ============================================
    // 9.11. v9.0.0: TYPES (ty)
    // ============================================
    const types: NonNullable<CompactJSON['ty']> = [];
    for (const ty of asArray<TypeNodeData>(payload.types)) {
      if (!ty) continue;
      const moduleIdx = moduleReverse[ty.moduleId] || 0;
      const fileIdx = fileReverse[ty.fileId] || 0;
      const nameIdx = addString(dict, ty.name);
      const membersIdx = asArray<string>(ty.members).map((m: string) => addString(dict, m));
      const extendsIdx = asArray<string>(ty.extendsTypes).map((e: string) =>
        addString(dict, e)
      );
      const kindCode = reverseLookup(TYPE_KINDS, ty.kind);
      types.push([
        kindCode,
        nameIdx,
        moduleIdx,
        fileIdx,
        ty.line,
        membersIdx,
        extendsIdx,
      ]);
    }

    // ============================================
    // 9.12. v9.0.0: TYPE REFS (tr)
    // ============================================
    const typeRefs: NonNullable<CompactJSON['tr']> = [];
    for (const tr of asArray<TypeRefData>(payload.typeRefs)) {
      if (!tr) continue;
      const moduleIdx = moduleReverse[tr.moduleId] || 0;
      const fileIdx = fileReverse[tr.fileId] || 0;
      const typeNameIdx = addString(dict, tr.typeName);
      const usageCode = reverseLookup(TYPE_USAGE_KINDS, tr.usageKind);
      typeRefs.push([typeNameIdx, moduleIdx, fileIdx, tr.line, usageCode]);
    }

    // ============================================
    // 10. Сборка легенды с словарями
    // ============================================
    const legend: CodecLegend = {
      flagMap: Object.fromEntries(
        Object.entries(FLAG_MAP).map(([bit, char]) => [char, bit])
      ),
      flagCharMap: { ...FLAG_CHAR_MAP },
      relationTypes: { ...RELATION_TYPES },
      exportTypes: { ...EXPORT_TYPES },
      importTypes: { ...IMPORT_TYPES },
      callTypes: { ...CALL_TYPES },
      reExportTypes: { ...RE_EXPORT_TYPES },
      // ✅ v9.0.0
      lifecycleTypes: { ...LIFECYCLE_TYPES },
      effectTypes: { ...EFFECT_TYPES },
      injectionTypes: { ...INJECTION_TYPES },
      reactivityTypes: { ...REACTIVITY_TYPES },
      conditionalTypes: { ...CONDITIONAL_TYPES },
      typeKinds: { ...TYPE_KINDS },
      typeUsageKinds: { ...TYPE_USAGE_KINDS },

      arraySchemas: {
        fns: [
          'id', 'name', 'moduleId', 'fileId',
          'line', 'flags', 'paramsIdx', 'returnTypeIdx',
        ],
        cls: [
          'id', 'name', 'moduleId', 'fileId',
          'line', 'flags', 'methodsIdx',
        ],
        cn: [
          'id', 'name', 'moduleId', 'fileId',
          'line', 'flags', 'valueIdx',
        ],
        'gr.e': [
          'moduleIdx', 'fileIdx', 'funcIdx', 'line', 'typeCode',
          'exportNameIdx', 'localNameIdx', 'isTypeOnly',
          'isReExport', 'sourceIdx',
        ],
        'gr.i': [
          'fromFileIdx', 'toFileIdIdx', 'sourceIdx',
          'importedNameIdx', 'localNameIdx', 'line',
          'typeCode', 'isExternal',
        ],
        'gr.c': ['fromIdx', 'toIdxOrExternalIdx', 'line', 'typeCode'],
        'gr.re': [
          'moduleIdx', 'funcIdx', 'sourceIdx', 'exportNameIdx',
          'line', 'typeCode', 'isTypeOnly',
        ],
        vt: [
          'fileIdx', 'moduleIdx', 'complexity',
          'reactivityDepsIdx', 'eventHandlers', 'dynamicComponents',
          'directivesIdx', 'usedComponentsIdx', 'templateRefs',
          'cssVariables', 'deepSelectors', 'slotsIdx',
        ],
        'vt.eventHandlers': [
          'eventNameIdx', 'handlerNameIdx', 'tagIdx',
          'line', 'modifiersIdx', 'isExternal',
        ],
        // ✅ v9.0.0: расширено до 3 полей
        'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],
        'vt.templateRefs': [
          'refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx',
        ],
        'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
        'vt.deepSelectors': ['selectorIdx', 'line'],
        // ✅ v9.0.0
        lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],
        ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],
        inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],
        rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],
        cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],
        ty: [
          'kindCode', 'nameIdx', 'moduleIdx', 'fileIdx',
          'line', 'membersIdx', 'extendsIdx',
        ],
        tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
      },

      stringDict: dict.stringDict,
      paramDict: dict.paramDict,
      methodDict: dict.methodDict,
      valueDict: dict.valueDict,
    };

    // ============================================
    // 11. Сборка результата
    // ============================================
    const compact: CompactJSON = {
      v: payload.version,
      ts: payload.timestamp,
      r: payload.root,
      mi: moduleIndex,
      fl: fileIndex,
      fns: functions,
      cls: classes,
      cn: constants,
      gr: { e: exports, i: imports, c: calls, re: reExports },
      vt: vueTemplates.length > 0 ? vueTemplates : undefined,
      st: payload.statistics,
      legend,
      lc: lifecycle.length > 0 ? lifecycle : undefined,
      ef: effects.length > 0 ? effects : undefined,
      inj: injections.length > 0 ? injections : undefined,
      rx: reactivity.length > 0 ? reactivity : undefined,
      cd: conditionals.length > 0 ? conditionals : undefined,
      ty: types.length > 0 ? types : undefined,
      tr: typeRefs.length > 0 ? typeRefs : undefined,
    };

    // ✅ v9.0.0: удаляем пустые секции (кроме gr)
    for (const key of Object.keys(compact) as (keyof CompactJSON)[]) {
      if (key === 'gr') continue;
      const v = compact[key];
      if (Array.isArray(v) && v.length === 0) {
        delete (compact as any)[key];
      }
    }

    console.log('\n🔍 [Codec.encode] ГОТОВО:');
    console.log('   vt:', compact.vt?.length ?? 0);
    console.log('   lc:', compact.lc?.length ?? 0);
    console.log('   ef:', compact.ef?.length ?? 0);
    console.log('   inj:', compact.inj?.length ?? 0);
    console.log('   rx:', compact.rx?.length ?? 0);
    console.log('   cd:', compact.cd?.length ?? 0);
    console.log('   ty:', compact.ty?.length ?? 0);
    console.log('   tr:', compact.tr?.length ?? 0);

    return compact;
  }

  // ============================================
  // DECODE: CompactJSON → FullJSON
  // ============================================

  /**
   * Декодирует сжатый JSON обратно в полный.
   *
   * @param compact - Сжатый JSON с легендой
   * @param options - Опции декодирования (см. DecodeOptions)
   * @returns Полный JSON
   */
  static decode(compact: CompactJSON, options: DecodeOptions = {}): FullJSON {
    const {
      includeEdges = true,
      includeEmptyArrays = true,
      includeStatistics = true,
    } = options;

    const legend = compact.legend;

    // ============================================
    // Хелперы для чтения словарей
    // ============================================
    const readString = (idx: number): string | undefined =>
      idx < 0 ? undefined : legend.stringDict[idx];

    const readStringOrEmpty = (idx: number): string =>
      idx < 0 ? '' : (legend.stringDict[idx] ?? '');

    const readParam = (idx: number): string =>
      idx < 0 ? '' : (legend.paramDict[idx] ?? '');

    const readMethod = (idx: number): string =>
      idx < 0 ? '' : (legend.methodDict[idx] ?? '');

    const readValue = (idx: number): unknown =>
      idx < 0 ? undefined : legend.valueDict[idx];

    // ============================================
    // 1. Модули
    // ============================================
    const modules: ModuleData[] = Object.entries(compact.mi).map(
      ([id, data]) => ({
        id,
        name: data.n,
        path: data.n,
        fileIds: [...data.f],
      })
    );

    // ============================================
    // 2. Файлы
    // ============================================
    const files: FileData[] = Object.entries(compact.fl).map(
      ([id, data]) => ({
        id,
        path: data.p,
        moduleId: data.m,
      })
    );

    // ============================================
    // 3. Функции
    // ============================================
    const functions: FunctionData[] = (compact.fns || []).map(
      ([
         id,
         name,
         moduleId,
         fileId,
         line,
         flagsStr,
         paramsIdx,
         returnTypeIdx,
       ]) => {
        const flags = decodeFlagsToObject(flagsStr);
        return {
          id,
          name,
          moduleId,
          fileId,
          line,
          isExported: flags.isExported,
          isAsync: flags.isAsync,
          isArrow: flags.isArrow,
          isMethod: flags.isMethod,
          params: (paramsIdx || []).map(readParam),
          returnType: readString(returnTypeIdx),
        };
      }
    );

    // ============================================
    // 4. Классы
    // ============================================
    const classes: ClassData[] = (compact.cls || []).map(
      ([id, name, moduleId, fileId, line, flagsStr, methodsIdx]) => {
        const flags = decodeFlagsToObject(flagsStr);
        return {
          id,
          name,
          moduleId,
          fileId,
          line,
          isExported: flags.isExported,
          methods: (methodsIdx || []).map(readMethod),
        };
      }
    );

    // ============================================
    // 5. Константы
    // ============================================
    const constants: ConstantData[] = (compact.cn || []).map(
      ([id, name, moduleId, fileId, line, flagsStr, valueIdx]) => {
        const flags = decodeFlagsToObject(flagsStr);
        return {
          id,
          name,
          moduleId,
          fileId,
          line,
          isExported: flags.isExported,
          value: readValue(valueIdx),
        };
      }
    );

    // ============================================
    // 6. Экспорты
    // ============================================
    const exports: ExportData[] = (compact.gr?.e || []).map(
      (
        [
          moduleIdx,
          fileIdx,
          funcIdx,
          line,
          typeCode,
          exportNameIdx,
          localNameIdx,
          isTypeOnly,
          isReExport,
          sourceIdx,
        ],
        idx
      ) => ({
        id: `e${idx + 1}`,
        moduleId: `m${moduleIdx}`,
        fileId: `f${fileIdx}`,
        functionId: `fn${funcIdx}`,
        exportName: readStringOrEmpty(exportNameIdx),
        localName: readStringOrEmpty(localNameIdx),
        line,
        type: (EXPORT_TYPES[typeCode] || 'named') as ExportData['type'],
        isDefault: typeCode === 'de',
        isTypeOnly: isTypeOnly === 1,
        isReExport: isReExport === 1,
        isStarReExport: false,
        isDefaultReExport: false,
        source: readString(sourceIdx),
      })
    );

    // ============================================
    // 7. Импорты
    // ============================================
    const imports: ImportData[] = (compact.gr?.i || []).map(
      (
        [
          fromFileIdx,
          toFileIdIdx,
          sourceIdx,
          importedNameIdx,
          localNameIdx,
          line,
          typeCode,
          isExternal,
        ],
        idx
      ) => {
        const source = readStringOrEmpty(sourceIdx);
        const toFileId = readString(toFileIdIdx) ?? null;

        return {
          id: `i${idx + 1}`,
          fromFileId: `f${fromFileIdx}`,
          toFileId,
          source,
          importedName: readStringOrEmpty(importedNameIdx),
          localName: readStringOrEmpty(localNameIdx),
          line,
          type: (IMPORT_TYPES[typeCode] || 'named') as ImportData['type'],
          isDefault: typeCode === 'df',
          isNamespace: typeCode === 'ns',
          isTypeOnly: typeCode === 'to',
          isExternal: isExternal === 1,
          packageName:
            isExternal === 1
              ? source.startsWith('@')
                ? source.split('/').slice(0, 2).join('/')
                : source.split('/')[0]
              : undefined,
        };
      }
    );

    // ============================================
    // 8. Вызовы
    // ============================================
    const calls: CallData[] = (compact.gr?.c || []).map(
      ([fromIdx, toIdxOrExternalIdx, line, typeChar], idx) => {
        let toFunctionId: string;
        let callType: CallData['type'];

        if (typeChar === 'e') {
          toFunctionId = readStringOrEmpty(toIdxOrExternalIdx);
          callType = 'direct';
        } else {
          toFunctionId = `fn${toIdxOrExternalIdx}`;
          callType = (CALL_TYPES[typeChar] || 'direct') as CallData['type'];
        }

        return {
          id: `c${idx + 1}`,
          fromFunctionId: `fn${fromIdx}`,
          toFunctionId,
          line,
          type: callType,
        };
      }
    );

    // ============================================
    // 9. Реэкспорты
    // ============================================
    const reExports: ReExportData[] = (compact.gr?.re || []).map(
      (
        [
          moduleIdx,
          funcIdx,
          sourceIdx,
          exportNameIdx,
          line,
          typeCode,
          isTypeOnly,
        ],
        idx
      ) => ({
        id: `re${idx + 1}`,
        moduleId: `m${moduleIdx}`,
        functionId: `fn${funcIdx}`,
        source: readStringOrEmpty(sourceIdx),
        exportName: readStringOrEmpty(exportNameIdx),
        line,
        type: (RE_EXPORT_TYPES[typeCode] || 'named') as ReExportData['type'],
        isDefault: typeCode === 'df',
        isTypeOnly: isTypeOnly === 1,
        isStarReExport: typeCode === 'all',
      })
    );

    // ============================================
    // 9.5. v9.0.0: CONDITIONALS (cd) — восстановление
    // ============================================
    const conditionals: TemplateConditional[] | undefined = compact.cd
      ? compact.cd.map(([directiveCode, fileIdx, line, condIdx, compIdx], idx) => ({
        id: `cd${idx + 1}`,
        directive: (CONDITIONAL_TYPES[directiveCode] ||
          'v-if') as TemplateConditional['directive'],
        fileId: `f${fileIdx}`,
        line,
        conditionExpression: condIdx >= 0 ? readString(condIdx) : undefined,
        renderedComponent: compIdx >= 0 ? readString(compIdx) : undefined,
      }))
      : undefined;

    // ============================================
    // 9.6. Vue templates (vt) — восстановление
    // ============================================
    const templates: TemplateData[] = (compact.vt || []).map(
      ([
         fileIdx,
         moduleIdx,
         complexity,
         reactivityDepsIdx,
         eventHandlers,
         dynamicComponents,
         directivesIdx,
         usedComponentsIdx,
         templateRefs,
         cssVariables,
         deepSelectors,
         slotsIdx,
       ]) => {
        const fileId = `f${fileIdx}`;
        return {
          fileId,
          moduleId: `m${moduleIdx}`,
          complexity,
          reactivityDeps: (reactivityDepsIdx || []).map(readStringOrEmpty),
          eventHandlers: (eventHandlers || []).map(
            ([
               eventNameIdx,
               handlerNameIdx,
               tagIdx,
               line,
               modifiersIdx,
               isExternal,
             ]) => ({
              eventName: readStringOrEmpty(eventNameIdx),
              handlerName: readStringOrEmpty(handlerNameIdx),
              tag: readStringOrEmpty(tagIdx),
              line,
              modifiers: (modifiersIdx || []).map(readStringOrEmpty),
              isExternal: isExternal === 1,
            })
          ),
          // ✅ v9.0.0: восстановление resolvedComponents
          dynamicComponents: (dynamicComponents || []).map(
            ([isExpressionIdx, line, resolvedComponentsIdx]) => ({
              isExpression: readStringOrEmpty(isExpressionIdx),
              line,
              resolvedComponents: (resolvedComponentsIdx || [])
                .map(readStringOrEmpty)
                .filter((s: string) => s !== ''),
            })
          ),
          directives: (directivesIdx || []).map(readStringOrEmpty),
          usedComponents: (usedComponentsIdx || []).map(readStringOrEmpty),
          templateRefs: (templateRefs || []).map(
            ([refValueIdx, tagIdx, line, exposedMethodsIdx]) => ({
              refValue: readStringOrEmpty(refValueIdx),
              tag: readStringOrEmpty(tagIdx),
              line,
              exposedMethods: (exposedMethodsIdx || []).map(readStringOrEmpty),
            })
          ),
          cssVariables: (cssVariables || []).map(
            ([nameIdx, valueIdx, line, isMultiline]) => ({
              name: readStringOrEmpty(nameIdx),
              value: valueIdx >= 0 ? readStringOrEmpty(valueIdx) : undefined,
              line,
              isMultiline: isMultiline === 1,
            })
          ),
          deepSelectors: (deepSelectors || []).map(([selectorIdx, line]) => ({
            selector: readStringOrEmpty(selectorIdx),
            line,
          })),
          slots: (slotsIdx || []).map(readStringOrEmpty),
          // ✅ v9.0.0: условный рендеринг — фильтруем по этому файлу
          conditionals: conditionals
            ? conditionals
              .filter(c => c.fileId === fileId)
              .map(c => ({
                id: c.id,
                directive: c.directive,
                fileId: c.fileId,
                line: c.line,
                conditionExpression: c.conditionExpression,
                renderedComponent: c.renderedComponent,
              }))
            : undefined,
        };
      }
    );

    // ============================================
    // 9.7. v9.0.0: LIFECYCLE (lc) — восстановление
    // ============================================
    const lifecycle: LifecycleHook[] | undefined = compact.lc
      ? compact.lc.map(([hookCode, funcIdx, line, callbackFnIdx, flagsStr], idx) => ({
        id: `lc${idx + 1}`,
        hookName: (LIFECYCLE_TYPES[hookCode] ||
          'onMounted') as LifecycleHook['hookName'],
        functionId: funcIdx >= 0 ? `fn${funcIdx}` : '',
        line,
        callbackFunctionId: callbackFnIdx >= 0 ? `fn${callbackFnIdx}` : undefined,
        isSetupContext: flagsStr === 's',
      }))
      : undefined;

    // ============================================
    // 9.8. v9.0.0: EFFECTS (ef) — восстановление
    // ============================================
    const effects: EffectEdge[] | undefined = compact.ef
      ? compact.ef.map(([effectCode, funcIdx, line, targetIdx, metaIdx], idx) => ({
        id: `ef${idx + 1}`,
        effectType: (EFFECT_TYPES[effectCode] || 'timer') as EffectEdge['effectType'],
        functionId: funcIdx >= 0 ? `fn${funcIdx}` : '',
        line,
        targetName: readStringOrEmpty(targetIdx),
        metaValue: metaIdx >= 0 ? readStringOrEmpty(metaIdx) : undefined,
      }))
      : undefined;

    // ============================================
    // 9.9. v9.0.0: INJECTIONS (inj) — восстановление
    // ============================================
    const injections: InjectionEdge[] | undefined = compact.inj
      ? compact.inj.map(([kindCode, fileIdx, line, keyIdx, flags], idx) => ({
        id: `in${idx + 1}`,
        kind: (INJECTION_TYPES[kindCode] || 'provide') as InjectionEdge['kind'],
        fileId: `f${fileIdx}`,
        line,
        key: readStringOrEmpty(keyIdx),
        isSymbolKey: (flags & 1) !== 0,
        hasDefault: (flags & 2) !== 0,
      }))
      : undefined;

    // ============================================
    // 9.10. v9.0.0: REACTIVITY (rx) — восстановление
    // ============================================
    const reactivity: ReactivityEdge[] | undefined = compact.rx
      ? compact.rx.map(
        ([kindCode, funcIdx, line, readsIdx, writesIdx, flags], idx) => ({
          id: `rx${idx + 1}`,
          kind: (REACTIVITY_TYPES[kindCode] ||
            'computed') as ReactivityEdge['kind'],
          functionId: funcIdx >= 0 ? `fn${funcIdx}` : '',
          line,
          reads: (readsIdx || []).map(readStringOrEmpty),
          writes: (writesIdx || []).map(readStringOrEmpty),
          isWriteable: flags === 1,
        })
      )
      : undefined;

    // ============================================
    // 9.11. v9.0.0: TYPES (ty) — восстановление
    // ============================================
    const types: TypeNodeData[] | undefined = compact.ty
      ? compact.ty.map(
        (
          [
            kindCode,
            nameIdx,
            moduleIdx,
            fileIdx,
            line,
            membersIdx,
            extendsIdx,
          ],
          idx
        ) => ({
          id: `t${idx + 1}`,
          kind: (TYPE_KINDS[kindCode] || 'interface') as TypeNodeData['kind'],
          name: readStringOrEmpty(nameIdx),
          moduleId: `m${moduleIdx}`,
          fileId: `f${fileIdx}`,
          line,
          members: (membersIdx || []).map(readStringOrEmpty),
          extendsTypes: (extendsIdx || []).map(readStringOrEmpty),
        })
      )
      : undefined;

    // ============================================
    // 9.12. v9.0.0: TYPE REFS (tr) — восстановление
    // ============================================
    const typeRefs: TypeRefData[] | undefined = compact.tr
      ? compact.tr.map(([typeNameIdx, moduleIdx, fileIdx, line, usageCode], idx) => ({
        id: `tr${idx + 1}`,
        typeName: readStringOrEmpty(typeNameIdx),
        moduleId: `m${moduleIdx}`,
        fileId: `f${fileIdx}`,
        line,
        usageKind: (TYPE_USAGE_KINDS[usageCode] ||
          'param') as TypeRefData['usageKind'],
      }))
      : undefined;

    // ============================================
    // 10. Статистика
    // ============================================
    const statistics: StatisticsData = compact.st;

    // ============================================
    // 11. Восстановление edges из gr.* (опционально)
    // ============================================
    const edges: EdgeData[] = [];

    if (includeEdges) {
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
    }

    // ============================================
    // 12. Сборка результата (с учётом опций)
    // ============================================
    const result: FullJSON = {
      version: compact.v,
      timestamp: compact.ts,
      root: compact.r,
      modules,
      files,
      functions,
      classes,
      constants,
      exports,
      imports,
      calls,
      reExports,
      templates: templates.length > 0 ? templates : undefined,
      statistics: includeStatistics ? statistics : ({} as StatisticsData),
      // ✅ v9.0.0
      lifecycle,
      effects,
      injections,
      reactivity,
      conditionals,
      types,
      typeRefs,
    };

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
      if (templates.length === 0) delete (result as any).templates;
      // ✅ v9.0.0
      if (!lifecycle) delete (result as any).lifecycle;
      if (!effects) delete (result as any).effects;
      if (!injections) delete (result as any).injections;
      if (!reactivity) delete (result as any).reactivity;
      if (!conditionals) delete (result as any).conditionals;
      if (!types) delete (result as any).types;
      if (!typeRefs) delete (result as any).typeRefs;
    }

    if (includeEdges && edges.length > 0) {
      result.edges = edges;
    }

    return result;
  }

  // ============================================
  // LEGEND
  // ============================================

  /**
   * Возвращает легенду для декодирования.
   * ВНИМАНИЕ: словари пустые — используйте encode() для получения словарей.
   */
  static getLegend(): CodecLegend {
    return {
      flagMap: Object.fromEntries(
        Object.entries(FLAG_MAP).map(([bit, char]) => [char, bit])
      ),
      flagCharMap: { ...FLAG_CHAR_MAP },
      relationTypes: { ...RELATION_TYPES },
      exportTypes: { ...EXPORT_TYPES },
      importTypes: { ...IMPORT_TYPES },
      callTypes: { ...CALL_TYPES },
      reExportTypes: { ...RE_EXPORT_TYPES },
      // ✅ v9.0.0
      lifecycleTypes: { ...LIFECYCLE_TYPES },
      effectTypes: { ...EFFECT_TYPES },
      injectionTypes: { ...INJECTION_TYPES },
      reactivityTypes: { ...REACTIVITY_TYPES },
      conditionalTypes: { ...CONDITIONAL_TYPES },
      typeKinds: { ...TYPE_KINDS },
      typeUsageKinds: { ...TYPE_USAGE_KINDS },

      arraySchemas: {
        fns: [
          'id', 'name', 'moduleId', 'fileId',
          'line', 'flags', 'paramsIdx', 'returnTypeIdx',
        ],
        cls: [
          'id', 'name', 'moduleId', 'fileId',
          'line', 'flags', 'methodsIdx',
        ],
        cn: [
          'id', 'name', 'moduleId', 'fileId',
          'line', 'flags', 'valueIdx',
        ],
        'gr.e': [
          'moduleIdx', 'fileIdx', 'funcIdx', 'line', 'typeCode',
          'exportNameIdx', 'localNameIdx', 'isTypeOnly',
          'isReExport', 'sourceIdx',
        ],
        'gr.i': [
          'fromFileIdx', 'toFileIdIdx', 'sourceIdx',
          'importedNameIdx', 'localNameIdx', 'line',
          'typeCode', 'isExternal',
        ],
        'gr.c': ['fromIdx', 'toIdxOrExternalIdx', 'line', 'typeCode'],
        'gr.re': [
          'moduleIdx', 'funcIdx', 'sourceIdx', 'exportNameIdx',
          'line', 'typeCode', 'isTypeOnly',
        ],
        vt: [
          'fileIdx', 'moduleIdx', 'complexity',
          'reactivityDepsIdx', 'eventHandlers', 'dynamicComponents',
          'directivesIdx', 'usedComponentsIdx', 'templateRefs',
          'cssVariables', 'deepSelectors', 'slotsIdx',
        ],
        'vt.eventHandlers': [
          'eventNameIdx', 'handlerNameIdx', 'tagIdx',
          'line', 'modifiersIdx', 'isExternal',
        ],
        // ✅ v9.0.0
        'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],
        'vt.templateRefs': [
          'refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx',
        ],
        'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
        'vt.deepSelectors': ['selectorIdx', 'line'],
        // ✅ v9.0.0
        lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],
        ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],
        inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],
        rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],
        cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],
        ty: [
          'kindCode', 'nameIdx', 'moduleIdx', 'fileIdx',
          'line', 'membersIdx', 'extendsIdx',
        ],
        tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
      },

      stringDict: [],
      paramDict: [],
      methodDict: [],
      valueDict: [],
    };
  }

  // ============================================
  // DEEP EQUAL + VERIFY ROUND TRIP
  // ============================================

  /**
   * ✅ v9.0.0: Глубокое сравнение с нормализацией.
   */
  private static deepEqual(a: any, b: any): boolean {
    const norm = (x: any): any => {
      if (x === undefined) return undefined;
      if (x === null) return null;
      if (Array.isArray(x)) return x.map(norm);
      if (typeof x === 'object') {
        const out: any = {};
        for (const key of Object.keys(x).sort()) {
          const v = norm(x[key]);
          if (v !== undefined) out[key] = v;
        }
        return out;
      }
      return x;
    };
    return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
  }

  /**
   * ✅ v9.0.0: Нормализация для диагностики расхождений.
   */
  private static normalizeForDiff(x: any): string {
    const norm = (v: any): any => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (Array.isArray(v)) return v.map(norm);
      if (typeof v === 'object') {
        const out: any = {};
        for (const key of Object.keys(v).sort()) {
          const nv = norm(v[key]);
          if (nv !== undefined) out[key] = nv;
        }
        return out;
      }
      return v;
    };
    return JSON.stringify(norm(x));
  }

  /**
   * Проверяет, что encode → decode возвращает идентичный результат.
   */
  static verifyRoundTrip(
    payload: FullJSON,
    options: DecodeOptions = {}
  ): {
    ok: boolean;
    error?: string;
    details?: Record<string, { original: number; decoded: number }>;
  } {
    try {
      const compact = Codec.encode(payload);
      const decoded = Codec.decode(compact, options);

      const details: Record<string, { original: number; decoded: number }> = {
        modules: {
          original: payload.modules.length,
          decoded: decoded.modules.length,
        },
        files: {
          original: payload.files.length,
          decoded: decoded.files.length,
        },
        functions: {
          original: payload.functions.length,
          decoded: decoded.functions.length,
        },
        classes: {
          original: payload.classes.length,
          decoded: decoded.classes.length,
        },
        constants: {
          original: payload.constants.length,
          decoded: decoded.constants.length,
        },
        exports: {
          original: payload.exports.length,
          decoded: decoded.exports.length,
        },
        imports: {
          original: payload.imports.length,
          decoded: decoded.imports.length,
        },
        calls: {
          original: payload.calls.length,
          decoded: decoded.calls.length,
        },
        reExports: {
          original: payload.reExports.length,
          decoded: decoded.reExports.length,
        },
        templates: {
          original: payload.templates?.length || 0,
          decoded: decoded.templates?.length || 0,
        },
        // ✅ v9.0.0
        lifecycle: {
          original: payload.lifecycle?.length || 0,
          decoded: decoded.lifecycle?.length || 0,
        },
        effects: {
          original: payload.effects?.length || 0,
          decoded: decoded.effects?.length || 0,
        },
        injections: {
          original: payload.injections?.length || 0,
          decoded: decoded.injections?.length || 0,
        },
        reactivity: {
          original: payload.reactivity?.length || 0,
          decoded: decoded.reactivity?.length || 0,
        },
        conditionals: {
          original: payload.conditionals?.length || 0,
          decoded: decoded.conditionals?.length || 0,
        },
        types: {
          original: payload.types?.length || 0,
          decoded: decoded.types?.length || 0,
        },
        typeRefs: {
          original: payload.typeRefs?.length || 0,
          decoded: decoded.typeRefs?.length || 0,
        },
      };

      const errors: string[] = [];
      for (const [key, value] of Object.entries(details)) {
        if (value.original !== value.decoded) {
          errors.push(`${key}: ${value.original} → ${value.decoded}`);
        }
      }

      if (!Codec.deepEqual(payload, decoded)) {
        const normOrig = Codec.normalizeForDiff(payload);
        const normDec = Codec.normalizeForDiff(decoded);
        const minLen = Math.min(normOrig.length, normDec.length);
        let diffPos = minLen;
        for (let i = 0; i < minLen; i++) {
          if (normOrig[i] !== normDec[i]) {
            diffPos = i;
            break;
          }
        }
        const ctx = 80;
        const start = Math.max(0, diffPos - ctx);
        const end = Math.min(minLen, diffPos + ctx);
        errors.push(
          `JSON mismatch at pos ${diffPos}: ` +
          `...${normOrig.substring(start, end)}... ≠ ...${normDec.substring(start, end)}...`
        );
      }

      if (errors.length > 0) {
        return { ok: false, error: errors.join('; '), details };
      }
      return { ok: true, details };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ============================================
  // ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
  // ============================================

  static getCompactSize(compact: CompactJSON): number {
    return JSON.stringify(compact).length;
  }

  static getFullSize(payload: FullJSON): number {
    return JSON.stringify(payload).length;
  }

  static getCompressionRatio(payload: FullJSON): number {
    const compact = Codec.encode(payload);
    const fullSize = Codec.getFullSize(payload);
    const compactSize = Codec.getCompactSize(compact);
    if (fullSize === 0) return 0;
    return compactSize / fullSize;
  }

  static stringify(compact: CompactJSON, pretty: boolean = false): string {
    return pretty ? JSON.stringify(compact, null, 2) : JSON.stringify(compact);
  }

  static parse(json: string): CompactJSON {
    return JSON.parse(json) as CompactJSON;
  }

  // ============================================
  // УТИЛИТЫ ДЛЯ РАБОТЫ С ИМПОРТАМИ
  // ============================================

  static getImportsForFile(compact: CompactJSON, fileId: string): ImportData[] {
    const full = Codec.decode(compact);
    return full.imports.filter(imp => imp.fromFileId === fileId);
  }

  static getImportersOfFile(compact: CompactJSON, toFileId: string): ImportData[] {
    const full = Codec.decode(compact);
    return full.imports.filter(imp => imp.toFileId === toFileId);
  }

  static verifyImportsResolved(compact: CompactJSON): {
    ok: boolean;
    total: number;
    resolved: number;
    external: number;
    unresolved: number;
    nullCount: number;
  } {
    const full = Codec.decode(compact);
    let resolved = 0;
    let external = 0;
    let unresolved = 0;
    let nullCount = 0;

    for (const imp of full.imports) {
      if (imp.isExternal) {
        external++;
      } else if (!imp.toFileId) {
        nullCount++;
      } else if (imp.toFileId.startsWith('unresolved:')) {
        unresolved++;
      } else if (imp.toFileId.startsWith('external:')) {
        external++;
      } else {
        resolved++;
      }
    }

    return {
      ok: nullCount === 0,
      total: full.imports.length,
      resolved,
      external,
      unresolved,
      nullCount,
    };
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default Codec;
