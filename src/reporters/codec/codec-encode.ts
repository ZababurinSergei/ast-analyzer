// src/reporters/codec/codec-encode.ts
// ============================================
// КОДИРОВАНИЕ: FullJSON → CompactJSON
// ============================================
// Версия: 9.0.6
//
// Содержит:
//   - Словари (FLAG_MAP, CALL_TYPES, EXPORT_TYPES, ...)
//   - Функции кодирования флагов (encodeFlags, flagsToString)
//   - Хелперы словарей (createDictBuilder, addString, addParam, ...)
//   - Codec.encode
//
// ИЗМЕНЕНИЯ v9.0.6 (import types fix):
//   - ✅ ИСПРАВЛЕНО: IMPORT_TYPES.to = 'type' (было 'type-only').
//     Это согласовано с compact-reporter.ts, который пишет `type: 'type'`
//     для type-only импортов (см. ImportData.type в codec-types.ts).
//     Раньше decode возвращал 'type-only', а compact-reporter — 'named'
//     или 'type' → расхождение L1/L2/DL.
//
// ИЗМЕНЕНИЯ v9.0.5 (external calls type fix):
//   - ✅ ИСПРАВЛЕНО: gr.c — для external-вызовов сохраняется РЕАЛЬНЫЙ
//     тип вызова (async / callback / method), а не принудительный 'direct'.
//
//     Раньше (v9.0.3):
//       rev(CALL_TYPES, isExt ? 'direct' : call.type, 'd')
//     Теперь:
//       rev(CALL_TYPES, call.type, 'd')
//
//     Признак external передаётся ОТДЕЛЬНЫМ 5-м полем кортежа
//     gr.c (isExternal), поэтому нет причин терять исходный тип.
//
//     Симптом: L1_semantic и L3_byteExact падали с расхождениями
//       $.calls[N].type: a="async"/"callback", b="direct"
//       $.gr.c[N][3]:  a="a"/"c",               b="d"
//     после чего Codec.verifyRoundTripBoth выдавал FAIL.
//
// ИЗМЕНЕНИЯ v9.0.3:
//   - ✅ gr.c: 4 → 5 полей (добавлен isExternal)
//     Это устраняет коллизию индексов: functionIdx и stringDictIdx
//     больше не смешиваются. External-вызовы явно помечаются
//     флагом isExternal === 1.
//
// ИЗМЕНЕНИЯ v9.0.0 (reversibility):
//   - ✅ encodeFlags: расширено с 4 до 18 битов
//   - ✅ gr.e: 10 → 12 полей (isStarReExport, isDefaultReExport)
//   - ✅ mi: { n, f } → { n, p, f } (добавлен path)
//   - ✅ gr.c: убран typeCode 'e' (L2 fix)
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
  ModuleData,
  FileData,
  TemplateData,
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TemplateConditional,
  TypeNodeData,
  TypeRefData,
} from './codec-types.js';

// ============================================
// СЛОВАРИ
// ============================================

/**
 * Карта флагов: бит → символ.
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
 * Обратная карта: символ → бит.
 */
export const FLAG_CHAR_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([bit, char]) => [char, parseInt(bit, 10)])
);

/**
 * Имена флагов: бит → имя.
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
 * Типы связей (общие).
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
 * Типы экспортов.
 */
export const EXPORT_TYPES: Record<string, string> = {
  ne: 'named',
  de: 'default',
  te: 'type',
  re: 're-export',
};

/**
 * Типы импортов.
 *
 * ✅ v9.0.6: 'to' → 'type' (не 'type-only').
 * Это согласовано с compact-reporter.ts, который пишет `type: 'type'`
 * для type-only импортов (см. ImportData.type в codec-types.ts).
 * Раньше decode возвращал 'type-only', что приводило к расхождению
 * с full.json в L1_semantic, L2_byteExact и DL.
 */
export const IMPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type',
};

/**
 * Типы вызовов.
 *
 * ✅ v9.0.5: содержит все 4 типа: direct / async / method / callback.
 *
 * ВАЖНО: в отличие от v9.0.2, здесь НЕТ кода 'e' (external).
 * Признак external определяется по 5-му полю кортежа gr.c (isExternal).
 *
 * При encode для external-вызовов сохраняется РЕАЛЬНЫЙ тип вызова
 * (async / callback / method / direct), а не принудительный 'direct'.
 * Это устраняет регрессию v9.0.4, из-за которой терялся тип
 * для всех external-вызовов.
 */
export const CALL_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
};

/**
 * Типы реэкспортов.
 */
export const RE_EXPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  all: 'all',
};

/**
 * Хуки жизненного цикла Vue.
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

/**
 * Типы side-эффектов.
 */
export const EFFECT_TYPES: Record<string, string> = {
  t: 'timer',
  c: 'cleanup',
  p: 'promise',
  e: 'event',
  s: 'subscription',
};

/**
 * Типы provide/inject.
 */
export const INJECTION_TYPES: Record<string, string> = {
  p: 'provide',
  i: 'inject',
};

/**
 * Типы реактивности Vue.
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

/**
 * Типы условных директив.
 */
export const CONDITIONAL_TYPES: Record<string, string> = {
  i: 'v-if',
  e: 'v-else-if',
  E: 'v-else',
};

/**
 * Виды type-узлов.
 */
export const TYPE_KINDS: Record<string, string> = {
  i: 'interface',
  t: 'type-alias',
  e: 'enum',
  c: 'class',
};

/**
 * Виды использования типов.
 */
export const TYPE_USAGE_KINDS: Record<string, string> = {
  p: 'param',
  r: 'return',
  f: 'field',
  g: 'generic',
  u: 'union',
  x: 'extends',
};

// ============================================
// КОДИРОВАНИЕ ФЛАГОВ
// ============================================

/**
 * Кодирует булевы флаги функции в число.
 *
 * ✅ ИСПРАВЛЕНО (reversibility):
 *   Расширено с 4 битов до 18. Ранее кодировались только
 *   isAsync/isExported/isMethod/isArrow, остальные 14 флагов
 *   терялись при encode, что ломало DL (decode(encode(full)) !== full)
 *   и RE (encode(decode(compact)) !== compact).
 *
 *   Биты соответствуют FLAG_MAP (см. выше).
 */
export function encodeFlags(obj: Partial<FunctionData & ClassData & ConstantData>): number {
  let flags = 0;
  if (obj.isAsync) flags |= 1;
  if (obj.isExported) flags |= 2;
  if (obj.isMethod) flags |= 4;
  if (obj.isArrow) flags |= 8;
  if (obj.isEventHandler) flags |= 16;
  if (obj.isNested) flags |= 32;
  if (obj.isSelf) flags |= 64;
  if (obj.isDynamic) flags |= 128;
  if (obj.isConfig) flags |= 256;
  if (obj.isExternal) flags |= 512;
  if (obj.isVueTemplate) flags |= 1024;
  if (obj.isAsyncChain) flags |= 2048;
  if (obj.isClosure) flags |= 4096;
  if (obj.isTypeDep) flags |= 8192;
  if (obj.isGenerator) flags |= 16384;
  if (obj.isPrivate) flags |= 32768;
  if (obj.isProtected) flags |= 65536;
  if (obj.isStatic) flags |= 131072;
  return flags;
}

/**
 * Кодирует число флагов в строку символов.
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

// ============================================
// ХЕЛПЕРЫ СЛОВАРЕЙ
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

export function createDictBuilder(): DictBuilder {
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
export function addString(dict: DictBuilder, str: string | undefined | null): number {
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
export function addParam(dict: DictBuilder, param: string): number {
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
export function addMethod(dict: DictBuilder, method: string): number {
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
export function addValue(dict: DictBuilder, value: unknown): number {
  if (value === undefined) return -1;
  const key = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
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
export function reverseLookup(dict: Record<string, string>, name: string | undefined): string {
  if (!name) return Object.keys(dict)[0] ?? '?';
  const reverse = Object.fromEntries(Object.entries(dict).map(([c, n]) => [n, c]));
  return reverse[name] ?? Object.keys(dict)[0] ?? '?';
}

/**
 * Проверяет, является ли значение массивом, и возвращает его
 * (или пустой массив, если нет).
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ENCODE
// ============================================

/**
 * Кодирует полный JSON в сжатый.
 *
 * @param payload - Полный JSON
 * @returns Сжатый JSON с легендой
 */
export function encode(payload: FullJSON): CompactJSON {
  const dict = createDictBuilder();

  // ============================================
  // 1. Индексы модулей
  // ============================================
  // ✅ reversibility: добавлено поле `p` (path)
  const moduleIndex: Record<string, { n: string; p: string; f: string[] }> = {};
  const moduleReverse: Record<string, number> = {};
  asArray<ModuleData>(payload.modules).forEach((mod, idx) => {
    if (!mod) return;
    moduleIndex[mod.id] = {
      n: mod.name,
      p: mod.path,
      f: asArray<string>(mod.fileIds),
    };
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
  // ✅ reversibility: encodeFlags теперь кодирует все 18 битов
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

    return [cls.id, cls.name, cls.moduleId, cls.fileId, cls.line, flagsToString(flags), methodsIdx];
  });

  // ============================================
  // 5. Индексы констант
  // ============================================
  const constants: CompactJSON['cn'] = asArray<ConstantData>(payload.constants).map(cn => {
    const flags = encodeFlags(cn);
    const valueIdx = addValue(dict, cn.value);

    return [cn.id, cn.name, cn.moduleId, cn.fileId, cn.line, flagsToString(flags), valueIdx];
  });

  // ============================================
  // 6. Экспорты (gr.e)
  // ============================================
  // ✅ reversibility: 12 полей вместо 10
  //   добавлены isStarReExport, isDefaultReExport
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
      exp.isStarReExport ? 1 : 0,
      exp.isDefaultReExport ? 1 : 0,
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
  // ✅ v9.0.5: ИСПРАВЛЕНО — для external-вызовов сохраняется РЕАЛЬНЫЙ
  //   тип вызова (async / callback / method / direct), а не 'direct'.
  //
  //   Раньше (v9.0.3):
  //     rev(CALL_TYPES, isExt ? 'direct' : call.type, 'd')
  //   Теперь:
  //     rev(CALL_TYPES, call.type, 'd')
  //
  //   Признак external передаётся отдельным 5-м полем кортежа gr.c
  //   (isExternal). Это устраняет регрессию, при которой для всех
  //   external-вызовов терялся реальный тип (async/callback/method).
  //
  //   Симптом: L1_semantic и L3_byteExact падали с расхождениями:
  //     $.calls[N].type: a="async"/"callback", b="direct"
  //     $.gr.c[N][3]:  a="a"/"c",               b="d"
  // ============================================
  const calls: CompactJSON['gr']['c'] = asArray<CallData>(payload.calls).map(call => {
    const fromIdx = functionReverse[call.fromFunctionId] || 0;

    let toIdx: number;
    let isExternal: 0 | 1;

    if (call.toFunctionId.startsWith('external:')) {
      toIdx = addString(dict, call.toFunctionId);
      isExternal = 1;
    } else {
      toIdx = functionReverse[call.toFunctionId] || 0;
      isExternal = 0;
    }

    // ✅ v9.0.5: сохраняем РЕАЛЬНЫЙ тип вызова даже для external.
    // Признак external передаётся отдельным флагом `isExternal` (5-е поле),
    // поэтому нет причин терять тип (async / callback / method).
    const typeCode =
      call.type === 'direct'
        ? 'd'
        : call.type === 'async'
          ? 'a'
          : call.type === 'method'
            ? 'm'
            : call.type === 'callback'
              ? 'c'
              : 'd';

    return [fromIdx, toIdx, call.line, typeCode, isExternal];
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

    return [moduleIdx, funcIdx, sourceIdx, exportNameIdx, re.line, typeCode, re.isTypeOnly ? 1 : 0];
  });

  // ============================================
  // 10. Vue templates (vt)
  // ============================================
  const vueTemplates: NonNullable<CompactJSON['vt']> = [];

  for (const template of asArray<TemplateData>(payload.templates)) {
    if (!template) continue;

    const fileIdx = fileReverse[template.fileId] || 0;
    const moduleIdx = moduleReverse[template.moduleId] || 0;

    const reactivityDepsIdx = asArray<string>(template.reactivityDeps).map((d: string) =>
      addString(dict, d)
    );

    const eventHandlers: [number, number, number, number, number[], number][] = asArray<any>(
      template.eventHandlers
    ).map((h: any) =>
      h
        ? [
            addString(dict, h.eventName),
            addString(dict, h.handlerName),
            addString(dict, h.tag),
            h.line || 0,
            asArray<string>(h.modifiers).map((m: string) => addString(dict, m)),
            h.isExternal ? 1 : 0,
          ]
        : [0, 0, 0, 0, [], 0]
    );

    const dynamicComponents: [number, number, number[]][] = asArray<any>(
      template.dynamicComponents
    ).map((d: any) =>
      d
        ? [
            addString(dict, d.isExpression),
            d.line || 0,
            asArray<string>(d.resolvedComponents).map((c: string) => addString(dict, c)),
          ]
        : [0, 0, []]
    );

    const directivesIdx = asArray<string>(template.directives).map((d: string) =>
      addString(dict, d)
    );

    const usedComponentsIdx = asArray<string>(template.usedComponents).map((c: string) =>
      addString(dict, c)
    );

    const templateRefs: [number, number, number, number[]][] = asArray<any>(
      template.templateRefs
    ).map((r: any) =>
      r
        ? [
            addString(dict, r.refValue),
            addString(dict, r.tag),
            r.line || 0,
            asArray<string>(r.exposedMethods).map((m: string) => addString(dict, m)),
          ]
        : [0, 0, 0, []]
    );

    const cssVariables: [number, number, number, number][] = asArray<any>(
      template.cssVariables
    ).map((v: any) =>
      v
        ? [addString(dict, v.name), addString(dict, v.value), v.line || 0, v.isMultiline ? 1 : 0]
        : [0, -1, 0, 0]
    );

    const deepSelectors: [number, number][] = asArray<any>(template.deepSelectors).map((s: any) =>
      s ? [addString(dict, s.selector), s.line || 0] : [0, 0]
    );

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
  }

  // ============================================
  // 11. LIFECYCLE (lc)
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
  // 12. EFFECTS (ef)
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
  // 13. INJECTIONS (inj)
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
  // 14. REACTIVITY (rx)
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
  // 15. CONDITIONALS (cd)
  // ============================================
  const conditionals: NonNullable<CompactJSON['cd']> = [];
  for (const cd of asArray<TemplateConditional>(payload.conditionals)) {
    if (!cd) continue;
    const fileIdx = cd.fileId ? fileReverse[cd.fileId] || 0 : 0;
    const condIdx = addString(dict, cd.conditionExpression);
    const compIdx = addString(dict, cd.renderedComponent);
    const directiveCode = reverseLookup(CONDITIONAL_TYPES, cd.directive);
    conditionals.push([directiveCode, fileIdx, cd.line, condIdx, compIdx, 0]);
  }

  // ============================================
  // 16. TYPES (ty)
  // ============================================
  const types: NonNullable<CompactJSON['ty']> = [];
  for (const ty of asArray<TypeNodeData>(payload.types)) {
    if (!ty) continue;
    const moduleIdx = moduleReverse[ty.moduleId] || 0;
    const fileIdx = fileReverse[ty.fileId] || 0;
    const nameIdx = addString(dict, ty.name);
    const membersIdx = asArray<string>(ty.members).map((m: string) => addString(dict, m));
    const extendsIdx = asArray<string>(ty.extendsTypes).map((e: string) => addString(dict, e));
    const kindCode = reverseLookup(TYPE_KINDS, ty.kind);
    types.push([kindCode, nameIdx, moduleIdx, fileIdx, ty.line, membersIdx, extendsIdx]);
  }

  // ============================================
  // 17. TYPE REFS (tr)
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
  // 18. Сборка легенды с словарями
  // ============================================
  const legend: CodecLegend = {
    flagMap: Object.fromEntries(Object.entries(FLAG_MAP).map(([bit, char]) => [char, bit])),
    flagCharMap: { ...FLAG_CHAR_MAP },
    relationTypes: { ...RELATION_TYPES },
    exportTypes: { ...EXPORT_TYPES },
    importTypes: { ...IMPORT_TYPES },
    callTypes: { ...CALL_TYPES },
    reExportTypes: { ...RE_EXPORT_TYPES },
    lifecycleTypes: { ...LIFECYCLE_TYPES },
    effectTypes: { ...EFFECT_TYPES },
    injectionTypes: { ...INJECTION_TYPES },
    reactivityTypes: { ...REACTIVITY_TYPES },
    conditionalTypes: { ...CONDITIONAL_TYPES },
    typeKinds: { ...TYPE_KINDS },
    typeUsageKinds: { ...TYPE_USAGE_KINDS },

    arraySchemas: {
      fns: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'paramsIdx', 'returnTypeIdx'],
      cls: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'methodsIdx'],
      cn: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'valueIdx'],
      // ✅ reversibility: 12 полей
      'gr.e': [
        'moduleIdx',
        'fileIdx',
        'funcIdx',
        'line',
        'typeCode',
        'exportNameIdx',
        'localNameIdx',
        'isTypeOnly',
        'isReExport',
        'sourceIdx',
        'isStarReExport',
        'isDefaultReExport',
      ],
      'gr.i': [
        'fromFileIdx',
        'toFileIdIdx',
        'sourceIdx',
        'importedNameIdx',
        'localNameIdx',
        'line',
        'typeCode',
        'isExternal',
      ],
      // ✅ v9.0.5: 5 полей (fromIdx, toIdx, line, typeCode, isExternal)
      // typeCode содержит РЕАЛЬНЫЙ тип (d/a/m/c) даже для external
      'gr.c': ['fromIdx', 'toIdx', 'line', 'typeCode', 'isExternal'],
      'gr.re': [
        'moduleIdx',
        'funcIdx',
        'sourceIdx',
        'exportNameIdx',
        'line',
        'typeCode',
        'isTypeOnly',
      ],
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
      'vt.eventHandlers': [
        'eventNameIdx',
        'handlerNameIdx',
        'tagIdx',
        'line',
        'modifiersIdx',
        'isExternal',
      ],
      'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],
      'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],
      'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
      'vt.deepSelectors': ['selectorIdx', 'line'],
      lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],
      ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],
      inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],
      rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],
      cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],
      ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line', 'membersIdx', 'extendsIdx'],
      tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
    },

    stringDict: dict.stringDict,
    paramDict: dict.paramDict,
    methodDict: dict.methodDict,
    valueDict: dict.valueDict,
  };

  // ============================================
  // 19. Сборка CompactJSON
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

  return compact;
}
