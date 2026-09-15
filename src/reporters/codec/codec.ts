// src/reporters/codec/codec.ts
// ============================================
// ЕДИНЫЙ МОДУЛЬ КОДЕКОВ
// ============================================
// Версия: 3.2.0 (Стратегия B — строгий round-trip + опции декодирования + Vue templates)
//
// ИЗМЕНЕНИЯ v3.2.0:
//   - ✅ ДОБАВЛЕНО: секция vt (Vue templates) в CompactJSON
//     vt — ОТДЕЛЬНАЯ СУЩНОСТЬ (шаблон Vue-файла), хранит ССЫЛКИ (индексы),
//     а не дубликаты объектов.
//   - ✅ encode: сбор vt из payload.templates
//   - ✅ decode: восстановление templates из vt
//   - ✅ decode: includeEmptyArrays удаляет пустой templates
//   - ✅ arraySchemas: добавлены схемы vt, vt.eventHandlers,
//     vt.dynamicComponents, vt.templateRefs, vt.cssVariables, vt.deepSelectors
//   - ✅ Импорт TemplateData из './codec-types.js'
//
// ИЗМЕНЕНИЯ v3.1.0:
//   - decode() принимает DecodeOptions:
//       * includeEdges      — собирать ли агрегированный массив edges
//       * includeEmptyArrays — включать ли пустые секции в результат
//       * includeStatistics — включать ли statistics
//   - Обратная совместимость: decode(compact) без опций работает как раньше
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - encode: словари (stringDict, paramDict, methodDict, valueDict)
//   - encode: новые кортежи с индексами словарей
//   - encode: mi/fl стали объектами {n,f}/{p,m}
//   - encode: gr.c использует 'e' для external-вызовов
//   - decode: восстановление из словарей
//   - decode: восстановление edges из gr.*
//   - decode: корректная обработка external:*
//   - CALL_TYPES: добавлен 'e' → 'external'
//   - getLegend: добавлены arraySchemas и словари
//   - verifyRoundTrip: глубокая проверка через JSON.stringify
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
  templates: 'vt', // ✅ НОВОЕ v3.2.0
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
    const dict = createDictBuilder();

    // ============================================
    // 1. Индексы модулей
    // ============================================
    const moduleIndex: Record<string, { n: string; f: string[] }> = {};
    const moduleReverse: Record<string, number> = {};
    payload.modules.forEach((mod, idx) => {
      moduleIndex[mod.id] = { n: mod.name, f: [...mod.fileIds] };
      moduleReverse[mod.id] = idx + 1; // m1, m2, ...
    });

    // ============================================
    // 2. Индексы файлов
    // ============================================
    const fileIndex: Record<string, { p: string; m: string }> = {};
    const fileReverse: Record<string, number> = {};
    payload.files.forEach((file, idx) => {
      fileIndex[file.id] = { p: file.path, m: file.moduleId };
      fileReverse[file.id] = idx + 1; // f1, f2, ...
    });

    // ============================================
    // 3. Индексы функций
    // ============================================
    const functionReverse: Record<string, number> = {};
    const functions: CompactJSON['fns'] = [];

    payload.functions.forEach((func, idx) => {
      functionReverse[func.id] = idx + 1;

      const flags = encodeFlags(func);
      const paramsIdx = (func.params || []).map(p => addParam(dict, p));
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
    const classes: CompactJSON['cls'] = payload.classes.map(cls => {
      const flags = encodeFlags(cls);
      const methodsIdx = (cls.methods || []).map(m => addMethod(dict, m));

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
    const constants: CompactJSON['cn'] = payload.constants.map(cn => {
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
    const exports: CompactJSON['gr']['e'] = payload.exports.map(exp => {
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
    const imports: CompactJSON['gr']['i'] = payload.imports.map(imp => {
      const fromFileIdx = fileReverse[imp.fromFileId] || 0;

      // toFileId может быть:
      //   'f5' | 'external:vue' | 'unresolved:./foo' | null
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
    const calls: CompactJSON['gr']['c'] = payload.calls.map(call => {
      const fromIdx = functionReverse[call.fromFunctionId] || 0;

      let toIdxOrExternalIdx: number;
      let typeCode: string;

      if (call.toFunctionId.startsWith('external:')) {
        // Внешний вызов — кодируем через stringDict + 'e'
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
    const reExports: CompactJSON['gr']['re'] = payload.reExports.map(re => {
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
    // vt хранит ССЫЛКИ (индексы в stringDict), а не дубликаты объектов.
    // Связи event → handler и templateRef → expose живут в calls (gr.c),
    // здесь — только описание самого шаблона.
    // ============================================
    const vueTemplates: NonNullable<CompactJSON['vt']> = [];

    for (const template of payload.templates || []) {
      const fileIdx = fileReverse[template.fileId] || 0;
      const moduleIdx = moduleReverse[template.moduleId] || 0;

      const reactivityDepsIdx = (template.reactivityDeps || []).map((d: string) =>
        addString(dict, d)
      );

      const eventHandlers: [
        number,
        number,
        number,
        number,
        number[],
        number,
      ][] = (template.eventHandlers || []).map((h: any) => [
        addString(dict, h.eventName),
        addString(dict, h.handlerName),
        addString(dict, h.tag),
        h.line || 0,
        (h.modifiers || []).map((m: string) => addString(dict, m)),
        h.isExternal ? 1 : 0,
      ]);

      const dynamicComponents: [number, number][] = (
        template.dynamicComponents || []
      ).map((d: any) => [addString(dict, d.isExpression), d.line || 0]);

      const directivesIdx = (template.directives || []).map((d: string) =>
        addString(dict, d)
      );

      const usedComponentsIdx = (template.usedComponents || []).map((c: string) =>
        addString(dict, c)
      );

      const templateRefs: [number, number, number, number[]][] = (
        template.templateRefs || []
      ).map((r: any) => [
        addString(dict, r.refValue),
        addString(dict, r.tag),
        r.line || 0,
        (r.exposedMethods || []).map((m: string) => addString(dict, m)),
      ]);

      const cssVariables: [number, number, number, number][] = (
        template.cssVariables || []
      ).map((v: any) => [
        addString(dict, v.name),
        addString(dict, v.value),
        v.line || 0,
        v.isMultiline ? 1 : 0,
      ]);

      const deepSelectors: [number, number][] = (template.deepSelectors || []).map(
        (s: any) => [addString(dict, s.selector), s.line || 0]
      );

      const slotsIdx = (template.slots || []).map((s: string) => addString(dict, s));

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
        // ✅ НОВОЕ v3.2.0: схемы для vt
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
        'vt.dynamicComponents': ['isExpressionIdx', 'line'],
        'vt.templateRefs': [
          'refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx',
        ],
        'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
        'vt.deepSelectors': ['selectorIdx', 'line'],
      },

      stringDict: dict.stringDict,
      paramDict: dict.paramDict,
      methodDict: dict.methodDict,
      valueDict: dict.valueDict,
    };

    // ============================================
    // 11. Сборка результата
    // ============================================
    return {
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
    };
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
   *
   * @example
   * // Полный результат (по умолчанию) — с edges и всеми секциями
   * const full = Codec.decode(compact);
   *
   * @example
   * // Без агрегированного графа edges и без пустых секций
   * const full = Codec.decode(compact, {
   *   includeEdges: false,
   *   includeEmptyArrays: false,
   * });
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
          // Внешний вызов — toIdxOrExternalIdx — индекс в stringDict
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
    // 9.5. Vue templates (vt) — восстановление
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
       ]) => ({
        fileId: `f${fileIdx}`,
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
        dynamicComponents: (dynamicComponents || []).map(
          ([isExpressionIdx, line]) => ({
            isExpression: readStringOrEmpty(isExpressionIdx),
            line,
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
      })
    );

    // ============================================
    // 10. Статистика
    // ============================================
    const statistics: StatisticsData = compact.st;

    // ============================================
    // 11. Восстановление edges из gr.* (опционально)
    // ============================================
    const edges: EdgeData[] = [];

    if (includeEdges) {
      // Импорты → edges
      for (const imp of imports) {
        edges.push({
          from: imp.fromFileId,
          to: imp.toFileId || 'unknown',
          type: 'import',
          symbol: imp.importedName,
          line: imp.line,
        });
      }

      // Экспорты → edges
      for (const exp of exports) {
        edges.push({
          from: exp.fileId,
          to: exp.functionId,
          type: 'export',
          symbol: exp.exportName,
          line: exp.line,
        });
      }

      // Вызовы → edges
      for (const call of calls) {
        edges.push({
          from: call.fromFunctionId,
          to: call.toFunctionId,
          type: 'call',
          line: call.line,
        });
      }

      // Реэкспорты → edges
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
    };

    // Убираем пустые массивы, если попросили
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
    }

    // Добавляем edges только если попросили и они непустые
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
        // ✅ НОВОЕ v3.2.0: схемы для vt
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
        'vt.dynamicComponents': ['isExpressionIdx', 'line'],
        'vt.templateRefs': [
          'refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx',
        ],
        'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
        'vt.deepSelectors': ['selectorIdx', 'line'],
      },

      stringDict: [],
      paramDict: [],
      methodDict: [],
      valueDict: [],
    };
  }

  // ============================================
  // VERIFY ROUND TRIP
  // ============================================

  /**
   * Проверяет, что encode → decode возвращает идентичный результат.
   *
   * @param payload - Полный JSON
   * @param options - Опции декодирования (по умолчанию все включены)
   * @returns Результат проверки
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
        // ✅ НОВОЕ v3.2.0
        templates: {
          original: payload.templates?.length || 0,
          decoded: decoded.templates?.length || 0,
        },
      };

      const errors: string[] = [];
      for (const [key, value] of Object.entries(details)) {
        if (value.original !== value.decoded) {
          errors.push(`${key}: ${value.original} → ${value.decoded}`);
        }
      }

      // Глубокая проверка: сравнение JSON-строк
      const origStr = JSON.stringify(payload, null, 0);
      const decStr = JSON.stringify(decoded, null, 0);

      if (origStr !== decStr) {
        const minLen = Math.min(origStr.length, decStr.length);
        let diffPos = minLen;
        for (let i = 0; i < minLen; i++) {
          if (origStr[i] !== decStr[i]) {
            diffPos = i;
            break;
          }
        }
        const ctx = 80;
        const start = Math.max(0, diffPos - ctx);
        const end = Math.min(minLen, diffPos + ctx);
        errors.push(
          `JSON mismatch at pos ${diffPos}: ` +
          `...${origStr.substring(start, end)}... ≠ ...${decStr.substring(
            start,
            end
          )}...`
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

  /**
   * Возвращает размер сжатого JSON в байтах.
   */
  static getCompactSize(compact: CompactJSON): number {
    return JSON.stringify(compact).length;
  }

  /**
   * Возвращает размер полного JSON в байтах.
   */
  static getFullSize(payload: FullJSON): number {
    return JSON.stringify(payload).length;
  }

  /**
   * Возвращает коэффициент сжатия.
   */
  static getCompressionRatio(payload: FullJSON): number {
    const compact = Codec.encode(payload);
    const fullSize = Codec.getFullSize(payload);
    const compactSize = Codec.getCompactSize(compact);
    if (fullSize === 0) return 0;
    return compactSize / fullSize;
  }

  /**
   * Сериализует компактный JSON в строку.
   */
  static stringify(compact: CompactJSON, pretty: boolean = false): string {
    return pretty
      ? JSON.stringify(compact, null, 2)
      : JSON.stringify(compact);
  }

  /**
   * Парсит компактный JSON из строки.
   */
  static parse(json: string): CompactJSON {
    return JSON.parse(json) as CompactJSON;
  }

  // ============================================
  // УТИЛИТЫ ДЛЯ РАБОТЫ С ИМПОРТАМИ
  // ============================================

  /**
   * Извлекает все импорты для указанного файла.
   */
  static getImportsForFile(
    compact: CompactJSON,
    fileId: string
  ): ImportData[] {
    const full = Codec.decode(compact);
    return full.imports.filter(imp => imp.fromFileId === fileId);
  }

  /**
   * Извлекает все файлы, которые импортируют указанный файл.
   */
  static getImportersOfFile(
    compact: CompactJSON,
    toFileId: string
  ): ImportData[] {
    const full = Codec.decode(compact);
    return full.imports.filter(imp => imp.toFileId === toFileId);
  }

  /**
   * Проверяет, что все импорты имеют разрешённый toFileId.
   */
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
