// src/reporters/codec/codec.ts
// ============================================
// ЕДИНЫЙ МОДУЛЬ КОДЕКОВ
// ============================================
// Версия: 1.0.1
// Назначение: обратимое сжатие полного JSON в компактный формат
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
} from './codec-types.js';

// ============================================
// СЛОВАРИ (DICTIONARIES)
// ============================================

/**
 * Карта флагов: бит → символ
 * Каждый символ — это флаг, установленный в 1
 *
 * ВАЖНО: символы должны быть уникальными!
 * Биты:
 *   1     = async
 *   2     = exported
 *   4     = method
 *   8     = arrow
 *   16    = event handler
 *   32    = nested
 *   64    = self
 *   128   = dynamic
 *   256   = config
 *   512   = external
 *   1024  = vue template
 *   2048  = async chain
 *   4096  = closure
 *   8192  = type dep
 *   16384 = generator
 *   32768 = private
 *   65536 = protected
 *   131072= static
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
 * Автоматически генерируется из FLAG_MAP
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
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type-only',
  ne: 'named-export',
  de: 'default-export',
  te: 'type-export',
  re: 're-export',
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
 */
export const CALL_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
};

/**
 * Карта ключей: полное имя → короткое
 * Используется для сжатия ключей в JSON
 */
export const KEY_MAP: Record<string, string> = {
  // Верхний уровень
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
  statistics: 'st',
  legend: 'legend',
  // Функции
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
  // Классы
  methods: 'm',
  // Константы
  value: 'val',
  // Экспорты
  functionId: 'fn',
  exportName: 'en',
  localName: 'ln',
  type: 't',
  isDefault: 'df',
  // Импорты
  fromFileId: 'ff',
  toFileId: 'tf',
  importedName: 'in',
  // Вызовы
  fromFunctionId: 'ffn',
  toFunctionId: 'tfn',
  // Реэкспорты
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
export function encodeFlags(obj: Partial<FunctionData & ClassData & ConstantData>): number {
  let flags = 0;
  if (obj.isAsync) flags |= 1;
  if (obj.isExported) flags |= 2;
  if (obj.isMethod) flags |= 4;
  if (obj.isArrow) flags |= 8;
  return flags;
}

/**
 * Кодирует число флагов в строку символов
 *
 * Пример:
 *   flags = 3 (async + exported) → 'ae'
 *   flags = 0                    → '0'
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
 * Создаёт "пустой" объект флагов
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
 * (только установленные флаги)
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
// СТАТИСТИКА
// ============================================

/**
 * Создаёт пустую статистику
 */
function createEmptyStatistics(): StatisticsData {
  return {
    totalModules: 0,
    totalFiles: 0,
    totalFunctions: 0,
    totalClasses: 0,
    totalConstants: 0,
    totalExports: 0,
    totalImports: 0,
    totalCalls: 0,
    totalReExports: 0,
  };
}

// ============================================
// ОСНОВНОЙ КОДЕК
// ============================================

export class Codec {
  // ============================================
  // ENCODE: FullJSON → CompactJSON
  // ============================================

  /**
   * Кодирует полный JSON в сжатый
   *
   * @param payload - Полный JSON
   * @returns Сжатый JSON с легендой
   */
  static encode(payload: FullJSON): CompactJSON {
    // ============================================
    // 1. Индексы модулей
    // ============================================
    const moduleIndex: Record<string, string> = {};
    const moduleReverse: Record<string, number> = {};
    payload.modules.forEach((mod, idx) => {
      moduleIndex[mod.id] = mod.name;
      moduleReverse[mod.id] = idx + 1; // m1, m2, ...
    });

    // ============================================
    // 2. Индексы файлов
    // ============================================
    const fileIndex: Record<string, string> = {};
    const fileReverse: Record<string, number> = {};
    payload.files.forEach((file, idx) => {
      fileIndex[file.id] = file.path;
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
      functions.push([
        func.id,
        func.name,
        `m${moduleReverse[func.moduleId] || 0}`,
        `f${fileReverse[func.fileId] || 0}`,
        func.line,
        flagsToString(flags),
      ]);
    });

    // ============================================
    // 4. Индексы классов
    // ============================================
    const classes: CompactJSON['cls'] = payload.classes.map(cls => {
      const flags = encodeFlags(cls);
      return [
        cls.id,
        cls.name,
        `m${moduleReverse[cls.moduleId] || 0}`,
        `f${fileReverse[cls.fileId] || 0}`,
        cls.line,
        flagsToString(flags),
      ];
    });

    // ============================================
    // 5. Индексы констант
    // ============================================
    const constants: CompactJSON['cn'] = payload.constants.map(cn => {
      const flags = encodeFlags(cn);
      return [
        cn.id,
        cn.name,
        `m${moduleReverse[cn.moduleId] || 0}`,
        `f${fileReverse[cn.fileId] || 0}`,
        cn.line,
        flagsToString(flags),
      ];
    });

    // ============================================
    // 6. Экспорты (gr.e)
    // ============================================
    const exports: CompactJSON['gr']['e'] = payload.exports.map(exp => {
      const moduleIdx = moduleReverse[exp.moduleId] || 0;
      const funcIdx = functionReverse[exp.functionId] || 0;
      const typeCode = exp.isDefault ? 'de' : exp.type === 'type' ? 'te' : 'ne';
      return [moduleIdx, funcIdx, exp.line, typeCode, exp.exportName, exp.localName];
    });

    // ============================================
    // 7. Импорты (gr.i)
    // ============================================
    const imports: CompactJSON['gr']['i'] = payload.imports.map(imp => [
      imp.fromFileId,
      imp.toFileId || '',
      imp.importedName,
      imp.type,
      imp.fromFileId,
      imp.line,
    ]);

    // ============================================
    // 8. Вызовы (gr.c)
    // ============================================
    const calls: CompactJSON['gr']['c'] = payload.calls.map(call => {
      const fromIdx = functionReverse[call.fromFunctionId] || 0;
      const toIdx = functionReverse[call.toFunctionId] || 0;
      return [fromIdx, toIdx, call.line, call.type.charAt(0)];
    });

    // ============================================
    // 9. Реэкспорты (gr.re)
    // ============================================
    const reExports: CompactJSON['gr']['re'] = payload.reExports.map(re => {
      const moduleIdx = moduleReverse[re.moduleId] || 0;
      const funcIdx = functionReverse[re.functionId] || 0;
      return [moduleIdx, funcIdx, re.source, re.exportName, re.line];
    });

    // ============================================
    // 10. Сборка результата
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
      gr: {
        e: exports,
        i: imports,
        c: calls,
        re: reExports,
      },
      // ✅ ИСПРАВЛЕНО: убираем приведение к Record<string, number>,
      // так как CompactJSON.st ожидает StatisticsData
      st: payload.statistics,
      legend: Codec.getLegend(),
    };
  }

  // ============================================
  // DECODE: CompactJSON → FullJSON
  // ============================================

  /**
   * Декодирует сжатый JSON обратно в полный
   *
   * @param compact - Сжатый JSON с легендой
   * @returns Полный JSON
   */
  static decode(compact: CompactJSON): FullJSON {
    // ============================================
    // 1. Восстанавливаем модули
    // ============================================
    const modules: FullJSON['modules'] = Object.entries(compact.mi).map(([id, name]) => ({
      id,
      name,
      path: name,
      fileIds: [],
    }));

    // ============================================
    // 2. Восстанавливаем файлы
    // ============================================
    const files: FullJSON['files'] = Object.entries(compact.fl).map(([id, path]) => ({
      id,
      path,
      moduleId: '',
    }));

    // ============================================
    // 3. Восстанавливаем функции
    // ============================================
    const functions: FunctionData[] = (compact.fns || []).map(
      ([id, name, moduleId, fileId, line, flagsStr]) => {
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
          params: [],
        };
      }
    );

    // ============================================
    // 4. Восстанавливаем классы
    // ============================================
    const classes: ClassData[] = (compact.cls || []).map(
      ([id, name, moduleId, fileId, line, flagsStr]) => {
        const flags = decodeFlagsToObject(flagsStr);
        return {
          id,
          name,
          moduleId,
          fileId,
          line,
          isExported: flags.isExported,
          methods: [],
        };
      }
    );

    // ============================================
    // 5. Восстанавливаем константы
    // ============================================
    const constants: ConstantData[] = (compact.cn || []).map(
      ([id, name, moduleId, fileId, line, flagsStr]) => {
        const flags = decodeFlagsToObject(flagsStr);
        return {
          id,
          name,
          moduleId,
          fileId,
          line,
          isExported: flags.isExported,
        };
      }
    );

    // ============================================
    // 6. Восстанавливаем экспорты
    // ============================================
    const exports: ExportData[] = (compact.gr?.e || []).map(
      ([moduleIdx, funcIdx, line, typeCode, exportName, localName]) => ({
        id: `e${moduleIdx}_${funcIdx}`,
        moduleId: `m${moduleIdx}`,
        functionId: `fn${funcIdx}`,
        exportName,
        localName,
        line,
        type: (EXPORT_TYPES[typeCode] || 'named') as ExportData['type'],
        isDefault: typeCode === 'de',
      })
    );

    // ============================================
    // 7. Восстанавливаем импорты
    // ============================================
    const imports: ImportData[] = (compact.gr?.i || []).map(
      ([fromFileId, toFileId, importedName, type, , line], idx) => ({
        id: `i${idx}`,
        fromFileId,
        toFileId: toFileId || null,
        importedName,
        localName: importedName,
        line,
        type: (IMPORT_TYPES[type] || 'named') as ImportData['type'],
      })
    );

    // ============================================
    // 8. Восстанавливаем вызовы
    // ============================================
    const calls: CallData[] = (compact.gr?.c || []).map(
      ([fromIdx, toIdx, line, typeChar], idx) => ({
        id: `c${idx}`,
        fromFunctionId: `fn${fromIdx}`,
        toFunctionId: `fn${toIdx}`,
        line,
        type: (CALL_TYPES[typeChar] || 'direct') as CallData['type'],
      })
    );

    // ============================================
    // 9. Восстанавливаем реэкспорты
    // ============================================
    const reExports: ReExportData[] = (compact.gr?.re || []).map(
      ([moduleIdx, funcIdx, source, exportName, line]) => ({
        id: `re${moduleIdx}_${funcIdx}`,
        moduleId: `m${moduleIdx}`,
        functionId: `fn${funcIdx}`,
        source,
        exportName,
        line,
      })
    );

    // ============================================
    // 10. Восстанавливаем статистику
    // ============================================
    const statistics: StatisticsData = compact.st
      ? (compact.st as StatisticsData)
      : createEmptyStatistics();

    // ============================================
    // 11. Сборка результата
    // ============================================
    return {
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
      statistics,
    };
  }

  // ============================================
  // LEGEND
  // ============================================

  /**
   * Возвращает легенду для декодирования
   */
  static getLegend(): CodecLegend {
    return {
      flagMap: Object.fromEntries(Object.entries(FLAG_MAP).map(([bit, char]) => [char, bit])),
      flagCharMap: { ...FLAG_CHAR_MAP },
      relationTypes: { ...RELATION_TYPES },
      exportTypes: { ...EXPORT_TYPES },
      importTypes: { ...IMPORT_TYPES },
      callTypes: { ...CALL_TYPES },
      keyMap: { ...KEY_MAP },
    };
  }

  // ============================================
  // VERIFY ROUND TRIP
  // ============================================

  /**
   * Проверяет, что encode → decode возвращает тот же результат
   *
   * @param payload - Полный JSON
   * @returns Результат проверки
   */
  static verifyRoundTrip(payload: FullJSON): {
    ok: boolean;
    error?: string;
    details?: {
      functions: { original: number; decoded: number };
      classes: { original: number; decoded: number };
      constants: { original: number; decoded: number };
      exports: { original: number; decoded: number };
      imports: { original: number; decoded: number };
      calls: { original: number; decoded: number };
      reExports: { original: number; decoded: number };
    };
  } {
    try {
      const compact = Codec.encode(payload);
      const decoded = Codec.decode(compact);

      const details = {
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
      };

      const errors: string[] = [];
      for (const [key, value] of Object.entries(details)) {
        if (value.original !== value.decoded) {
          errors.push(
            `${key}: ${value.original} → ${value.decoded} (потеряно ${value.original - value.decoded})`
          );
        }
      }

      if (errors.length > 0) {
        return {
          ok: false,
          error: errors.join('; '),
          details,
        };
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
   * Возвращает размер сжатого JSON в байтах
   */
  static getCompactSize(compact: CompactJSON): number {
    return JSON.stringify(compact).length;
  }

  /**
   * Возвращает размер полного JSON в байтах
   */
  static getFullSize(payload: FullJSON): number {
    return JSON.stringify(payload).length;
  }

  /**
   * Возвращает коэффициент сжатия
   */
  static getCompressionRatio(payload: FullJSON): number {
    const compact = Codec.encode(payload);
    const fullSize = Codec.getFullSize(payload);
    const compactSize = Codec.getCompactSize(compact);
    if (fullSize === 0) return 0;
    return compactSize / fullSize;
  }

  /**
   * Сериализует компактный JSON в строку
   */
  static stringify(compact: CompactJSON, pretty: boolean = false): string {
    return pretty ? JSON.stringify(compact, null, 2) : JSON.stringify(compact);
  }

  /**
   * Парсит компактный JSON из строки
   */
  static parse(json: string): CompactJSON {
    return JSON.parse(json) as CompactJSON;
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default Codec;
