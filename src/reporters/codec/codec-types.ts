// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА (Стратегия B — строгий round-trip)
// ============================================
// Версия: 3.0.0
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - CompactJSON: новые кортежи с индексами словарей
//   - CodecLegend: +stringDict, +paramDict, +methodDict, +valueDict
//   - CodecLegend: +arraySchemas (позиционные схемы массивов)
//   - ExportData: +isReExport, +isStarReExport, +isDefaultReExport, +source
//   - ImportData: line, isExternal, packageName (актуализировано)
//   - CompactJSON.mi: { n, f } вместо просто строки
//   - CompactJSON.fl: { p, m } вместо просто строки
//   - CompactJSON.fns: +paramsIdx[], +returnTypeIdx
//   - CompactJSON.cls: +methodsIdx[]
//   - CompactJSON.cn: +valueIdx
//   - CompactJSON.gr.e: 10 элементов
//   - CompactJSON.gr.i: 8 элементов (toFileIdIdx — индекс)
//   - CompactJSON.gr.c: toIdxOrExternalIdx + typeCode 'e'
//   - CompactJSON.gr.re: 7 элементов (sourceIdx, exportNameIdx)
//   - Убран CompactJSON.edges (восстанавливается из gr.*)
//
// ✅ ESLint: все Array<T> заменены на T[] (правило @typescript-eslint/array-type)
// ============================================

// ============================================
// ПОЛНЫЙ (ЧИТАЕМЫЙ) JSON
// ============================================

/**
 * Полный (читаемый) JSON отчёта.
 *
 * Это «истина» в последней инстанции — из него генерируется сжатый JSON,
 * и в него же декодируется сжатый JSON обратно.
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
  /** Статистика */
  statistics: StatisticsData;
  /**
   * Единый массив рёбер для сводного графа.
   * ⚠️ В compact.json НЕ хранится — восстанавливается из gr.*
   */
  edges?: EdgeData[];
}

// ============================================
// МОДУЛЬ
// ============================================

/**
 * Модуль — директория с файлами.
 * Например: `core`, `modes`, `reporters`, `cli`.
 */
export interface ModuleData {
  /** Уникальный ID модуля (m1, m2, ...) */
  id: string;
  /** Имя модуля (например, 'core') */
  name: string;
  /** Путь к модулю (например, 'src/core') */
  path: string;
  /** ID файлов, входящих в этот модуль */
  fileIds: string[];
}

// ============================================
// ФАЙЛ
// ============================================

/**
 * Файл — конкретный .ts/.js/.vue файл.
 * Принадлежит одному модулю.
 */
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

/**
 * Функция — объявленная функция, метод класса,
 * стрелочная функция или обработчик события.
 */
export interface FunctionData {
  /** Уникальный ID функции (fn1, fn2, ...) */
  id: string;
  /** Имя функции */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки объявления */
  line: number;
  /** Экспортируется ли функция */
  isExported: boolean;
  /** Асинхронная ли функция */
  isAsync: boolean;
  /** Стрелочная ли функция */
  isArrow: boolean;
  /** Является ли методом класса */
  isMethod: boolean;
  /** Параметры функции */
  params: string[];
  /** Тип возвращаемого значения (если известен) */
  returnType?: string;

  // --- Опциональные флаги (используются в encodeFlags) ---
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
}

// ============================================
// КЛАСС
// ============================================

/**
 * Класс — объявление класса в файле.
 */
export interface ClassData {
  /** Уникальный ID класса (cls1, cls2, ...) */
  id: string;
  /** Имя класса */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки объявления */
  line: number;
  /** Экспортируется ли класс */
  isExported: boolean;
  /** Методы класса */
  methods: string[];
}

// ============================================
// КОНСТАНТА
// ============================================

/**
 * Константа — объявление `const` (обычно верхнего уровня).
 */
export interface ConstantData {
  /** Уникальный ID константы (cn1, cn2, ...) */
  id: string;
  /** Имя константы */
  name: string;
  /** ID модуля */
  moduleId: string;
  /** ID файла */
  fileId: string;
  /** Номер строки объявления */
  line: number;
  /** Экспортируется ли константа */
  isExported: boolean;
  /** Значение константы (если примитив) */
  value?: unknown;
}

// ============================================
// ЭКСПОРТ
// ============================================

/**
 * Экспорт — обычный `export { name }` или `export function name`.
 * НЕ включает реэкспорты (они в ReExportData).
 */
export interface ExportData {
  /** Уникальный ID экспорта (e1, e2, ...) */
  id: string;
  /** ID модуля, из которого экспортируется */
  moduleId: string;
  /** ID файла, из которого экспортируется */
  fileId: string;
  /** ID экспортируемой функции */
  functionId: string;
  /** Имя, под которым экспортируется */
  exportName: string;
  /** Локальное имя (может отличаться при `export { a as b }`) */
  localName: string;
  /** Номер строки */
  line: number;
  /** Тип экспорта */
  type: 'named' | 'default' | 'type';
  /** Является ли default-экспортом */
  isDefault: boolean;
  /** Только для типов */
  isTypeOnly: boolean;
  /** Является ли реэкспортом (для совместимости; в compact → gr.re) */
  isReExport?: boolean;
  /** Является ли `export * from '...'` */
  isStarReExport?: boolean;
  /** Является ли `export { default } from '...'` */
  isDefaultReExport?: boolean;
  /** Источник (для реэкспортов) */
  source?: string;
}

// ============================================
// ИМПОРТ
// ============================================

/**
 * Импорт — `import { name } from 'source'`.
 * Каждый specifier — отдельная запись.
 */
export interface ImportData {
  /** Уникальный ID импорта (i1, i2, ...) */
  id: string;
  /** ID файла-импортёра */
  fromFileId: string;
  /**
   * ID файла-цели.
   * - ID файла проекта (например, 'f5')
   * - 'external:vue' — внешний пакет
   * - 'unresolved:./foo' — не удалось разрешить
   * - null — если вообще не удалось определить
   */
  toFileId: string | null;
  /** Исходный путь импорта (как в коде) */
  source: string;
  /** Имя импортируемой сущности */
  importedName: string;
  /** Локальное имя (при `import { a as b }`) */
  localName: string;
  /** Номер строки */
  line: number;
  /** Тип импорта */
  type: 'named' | 'default' | 'namespace' | 'type';
  /** Является ли default-импортом */
  isDefault: boolean;
  /** Является ли namespace-импортом */
  isNamespace: boolean;
  /** Только для типов */
  isTypeOnly: boolean;
  /** Внешний ли модуль (node_modules) */
  isExternal: boolean;
  /** Имя пакета (для внешних) */
  packageName?: string;
}

// ============================================
// ВЫЗОВ
// ============================================

/**
 * Вызов — `funcName(...)` внутри другой функции.
 * Позволяет строить граф вызовов.
 */
export interface CallData {
  /** Уникальный ID вызова (c1, c2, ...) */
  id: string;
  /** ID функции-источника (кто вызывает) */
  fromFunctionId: string;
  /**
   * ID функции-цели (кого вызывают).
   * Может быть 'external:readFileSync' для внешних вызовов.
   */
  toFunctionId: string;
  /** Номер строки вызова */
  line: number;
  /** Тип вызова */
  type: 'direct' | 'async' | 'method' | 'callback';
}

// ============================================
// РЕЭКСПОРТ
// ============================================

/**
 * Реэкспорт — `export { name } from 'source'`.
 * Используется в barrel-файлах (например, index.ts).
 */
export interface ReExportData {
  /** Уникальный ID реэкспорта (re1, re2, ...) */
  id: string;
  /** ID модуля, из которого реэкспортируется */
  moduleId: string;
  /** ID реэкспортируемой функции */
  functionId: string;
  /** Источник (`./core/ast-parser.js`) */
  source: string;
  /** Имя, под которым реэкспортируется */
  exportName: string;
  /** Номер строки */
  line: number;
  /** Тип реэкспорта */
  type: 'named' | 'default' | 'all';
  /** Является ли default-реэкспортом */
  isDefault: boolean;
  /** Только для типов */
  isTypeOnly: boolean;
  /** Является ли `export * from` */
  isStarReExport: boolean;
}

// ============================================
// СТАТИСТИКА
// ============================================

/**
 * Статистика по всему проекту.
 */
export interface StatisticsData {
  /** Общее количество модулей */
  totalModules: number;
  /** Общее количество файлов */
  totalFiles: number;
  /** Общее количество функций */
  totalFunctions: number;
  /** Общее количество классов */
  totalClasses: number;
  /** Общее количество констант */
  totalConstants: number;
  /** Общее количество экспортов */
  totalExports: number;
  /** Общее количество импортов */
  totalImports: number;
  /** Общее количество вызовов */
  totalCalls: number;
  /** Общее количество реэкспортов */
  totalReExports: number;
}

// ============================================
// ЕДИНОЕ РЕБРО ГРАФА
// ============================================

/**
 * Единое ребро графа.
 * Позволяет строить любой граф фильтрацией по типу.
 * ⚠️ В compact.json НЕ хранится — восстанавливается из gr.*
 */
export interface EdgeData {
  /** Откуда (ID источника) */
  from: string;
  /** Куда (ID цели) */
  to: string;
  /** Тип связи */
  type: 'import' | 'export' | 'call' | 're-export';
  /** Имя символа (опционально) */
  symbol?: string;
  /** Номер строки (опционально) */
  line?: number;
}

// ============================================
// СЖАТЫЙ JSON (СТРАТЕГИЯ B — СТРОГИЙ ROUND-TRIP)
// ============================================

/**
 * Сжатый JSON — ПОЛНОСТЬЮ ОБРАТИМ.
 *
 * Формат кортежей (позиции фиксированы, см. legend.arraySchemas):
 *
 *   fns:   [id, name, moduleId, fileId, line, flags, paramsIdx[], returnTypeIdx]
 *   cls:   [id, name, moduleId, fileId, line, flags, methodsIdx[]]
 *   cn:    [id, name, moduleId, fileId, line, flags, valueIdx]
 *
 *   gr.e:  [moduleIdx, fileIdx, funcIdx, line, typeCode,
 *           exportNameIdx, localNameIdx, isTypeOnly,
 *           isReExport, sourceIdx]
 *   gr.i:  [fromFileIdx, toFileIdIdx, sourceIdx,
 *           importedNameIdx, localNameIdx, line,
 *           typeCode, isExternal]
 *   gr.c:  [fromIdx, toIdxOrExternalIdx, line, typeCode]
 *   gr.re: [moduleIdx, funcIdx, sourceIdx, exportNameIdx,
 *           line, typeCode, isTypeOnly]
 *
 * Все *Idx — индексы в legend.stringDict (кроме paramsIdx/methodsIdx/valueIdx).
 *   -1 означает undefined/null.
 *
 * ⚠️ edges НЕ хранятся — восстанавливаются из gr.i + gr.e + gr.c + gr.re.
 */
export interface CompactJSON {
  /** Version */
  v: string;
  /** Timestamp */
  ts: string;
  /** Root module ID */
  r: string;

  /**
   * Module index: id → { n: name, f: [fileIds] }
   */
  mi: Record<string, { n: string; f: string[] }>;

  /**
   * File index: id → { p: path, m: moduleId }
   */
  fl: Record<string, { p: string; m: string }>;

  /**
   * Functions:
   * [id, name, moduleId, fileId, line, flags, paramsIdx[], returnTypeIdx]
   */
  fns: [
    string, // id
    string, // name
    string, // moduleId
    string, // fileId
    number, // line
    string, // flags
    number[], // paramsIdx[]
    number, // returnTypeIdx (-1 = undefined)
  ][];

  /**
   * Classes:
   * [id, name, moduleId, fileId, line, flags, methodsIdx[]]
   */
  cls: [
    string, // id
    string, // name
    string, // moduleId
    string, // fileId
    number, // line
    string, // flags
    number[], // methodsIdx[]
  ][];

  /**
   * Constants:
   * [id, name, moduleId, fileId, line, flags, valueIdx]
   */
  cn: [
    string, // id
    string, // name
    string, // moduleId
    string, // fileId
    number, // line
    string, // flags
    number, // valueIdx (-1 = undefined)
  ][];

  /** Graph — все связи в одном месте */
  gr: {
    /**
     * Exports:
     * [moduleIdx, fileIdx, funcIdx, line, typeCode,
     *  exportNameIdx, localNameIdx, isTypeOnly,
     *  isReExport, sourceIdx]
     *
     * - moduleIdx      : number — индекс модуля (1-based)
     * - fileIdx        : number — индекс файла (1-based)
     * - funcIdx        : number — индекс функции (1-based)
     * - line           : number — номер строки
     * - typeCode       : string — 'ne' | 'de' | 'te'
     * - exportNameIdx  : number — индекс в stringDict
     * - localNameIdx   : number — индекс в stringDict
     * - isTypeOnly     : number — 0 | 1
     * - isReExport     : number — 0 | 1
     * - sourceIdx      : number — индекс в stringDict (-1 = undefined)
     */
    e: [
      number, // moduleIdx
      number, // fileIdx
      number, // funcIdx
      number, // line
      string, // typeCode
      number, // exportNameIdx
      number, // localNameIdx
      number, // isTypeOnly
      number, // isReExport
      number, // sourceIdx
    ][];

    /**
     * Imports:
     * [fromFileIdx, toFileIdIdx, sourceIdx,
     *  importedNameIdx, localNameIdx, line,
     *  typeCode, isExternal]
     *
     * - fromFileIdx     : number — индекс файла-импортёра
     * - toFileIdIdx     : number — индекс toFileId в stringDict (-1 = null)
     * - sourceIdx       : number — индекс source в stringDict
     * - importedNameIdx : number — индекс importedName в stringDict
     * - localNameIdx    : number — индекс localName в stringDict
     * - line            : number — номер строки
     * - typeCode        : string — 'n' | 'df' | 'ns' | 'to'
     * - isExternal      : number — 0 | 1
     */
    i: [
      number, // fromFileIdx
      number, // toFileIdIdx
      number, // sourceIdx
      number, // importedNameIdx
      number, // localNameIdx
      number, // line
      string, // typeCode
      number, // isExternal
    ][];

    /**
     * Calls:
     * [fromIdx, toIdxOrExternalIdx, line, typeCode]
     *
     * - fromIdx              : number — индекс вызывающей функции
     * - toIdxOrExternalIdx   : number
     *     • если typeCode !== 'e' → индекс в functionReverse (fnN)
     *     • если typeCode === 'e' → индекс в stringDict (external:...)
     * - line                 : number — номер строки
     * - typeCode             : string — 'd' | 'a' | 'm' | 'c' | 'e'
     */
    c: [
      number, // fromIdx
      number, // toIdxOrExternalIdx
      number, // line
      string, // typeCode
    ][];

    /**
     * Re-exports:
     * [moduleIdx, funcIdx, sourceIdx, exportNameIdx,
     *  line, typeCode, isTypeOnly]
     *
     * - moduleIdx      : number — индекс модуля
     * - funcIdx        : number — индекс функции
     * - sourceIdx      : number — индекс source в stringDict
     * - exportNameIdx  : number — индекс exportName в stringDict
     * - line           : number — номер строки
     * - typeCode       : string — 'n' | 'df' | 'all'
     * - isTypeOnly     : number — 0 | 1
     */
    re: [
      number, // moduleIdx
      number, // funcIdx
      number, // sourceIdx
      number, // exportNameIdx
      number, // line
      string, // typeCode
      number, // isTypeOnly
    ][];
  };

  /** Statistics */
  st: StatisticsData;

  /** Legend (dictionaries + schemas) */
  legend: CodecLegend;

  // ⚠️ НЕТ поля `edges` — восстанавливается при decode из gr.*
}

// ============================================
// ЛЕГЕНДА (ДЛЯ ДЕКОДИРОВАНИЯ)
// ============================================

/**
 * Легенда — все словари и карты, необходимые для декодирования.
 * Встраивается в CompactJSON, чтобы декодер мог работать автономно.
 */
export interface CodecLegend {
  // ============================================
  // КАРТЫ ФЛАГОВ
  // ============================================

  /** Карта флагов: символ → строковое имя бита */
  flagMap: Record<string, string>;
  /** Карта флагов: символ → числовое значение бита */
  flagCharMap: Record<string, number>;

  // ============================================
  // ТИПЫ СВЯЗЕЙ
  // ============================================

  /** Типы связей (общие) */
  relationTypes: Record<string, string>;
  /** Типы экспортов: 'ne' | 'de' | 'te' | 're' */
  exportTypes: Record<string, string>;
  /** Типы импортов: 'n' | 'df' | 'ns' | 'to' */
  importTypes: Record<string, string>;
  /** Типы вызовов: 'd' | 'a' | 'm' | 'c' | 'e' */
  callTypes: Record<string, string>;
  /** Типы реэкспортов: 'n' | 'df' | 'all' */
  reExportTypes: Record<string, string>;

  // ============================================
  // ПОЗИЦИОННЫЕ СХЕМЫ МАССИВОВ
  // ============================================

  /**
   * Позиционные схемы для декодирования кортежей.
   * Ключ — имя массива, значение — массив имён полей по позициям.
   */
  arraySchemas: {
    /** fns: [id, name, moduleId, fileId, line, flags, paramsIdx, returnTypeIdx] */
    fns: string[];
    /** cls: [id, name, moduleId, fileId, line, flags, methodsIdx] */
    cls: string[];
    /** cn: [id, name, moduleId, fileId, line, flags, valueIdx] */
    cn: string[];
    /** gr.e: 10 полей */
    'gr.e': string[];
    /** gr.i: 8 полей */
    'gr.i': string[];
    /** gr.c: 4 поля */
    'gr.c': string[];
    /** gr.re: 7 полей */
    'gr.re': string[];
  };

  // ============================================
  // СЛОВАРИ (для обратимого сжатия)
  // ============================================

  /**
   * Словарь всех уникальных строк.
   * Используется для:
   *   - returnType (functions)
   *   - exportName, localName, source (exports)
   *   - toFileId, source, importedName, localName (imports)
   *   - external:* (calls)
   *   - source, exportName (reExports)
   */
  stringDict: string[];

  /**
   * Словарь имён параметров функций.
   * Используется в fns.paramsIdx[]
   */
  paramDict: string[];

  /**
   * Словарь имён методов классов.
   * Используется в cls.methodsIdx[]
   */
  methodDict: string[];

  /**
   * Словарь значений констант.
   * Может содержать примитивы, массивы, объекты.
   * Используется в cn.valueIdx.
   */
  valueDict: unknown[];
}

// ============================================
// ОПЦИИ ГЕНЕРАЦИИ ОТЧЁТА
// ============================================

/**
 * Опции для генерации отчёта.
 */
export interface GenerateReportOptions {
  /** Путь к выходному файлу (сжатый JSON) */
  outputPath?: string;
  /** Использовать сжатие (по умолчанию true) */
  compress?: boolean;
  /** Сохранять ли полный JSON рядом со сжатым (по умолчанию true) */
  saveFull?: boolean;
  /** Использовать ли битовые флаги (по умолчанию true) */
  useBitFlags?: boolean;
  /** Использовать ли словари (по умолчанию true) */
  useDictionaries?: boolean;
}

// ============================================
// РЕЗУЛЬТАТ ГЕНЕРАЦИИ ОТЧЁТА
// ============================================

/**
 * Результат генерации отчёта.
 */
export interface GenerateReportResult {
  /** Полный (читаемый) JSON */
  full: FullJSON;
  /** Сжатый JSON (если compress: true) */
  compact?: CompactJSON;
  /** Путь к сохранённому сжатому файлу */
  compactPath?: string;
  /** Путь к сохранённому полному файлу */
  fullPath?: string;
  /** Метрики сжатия */
  compressionStats?: {
    /** Размер полного JSON в байтах */
    fullSize: number;
    /** Размер сжатого JSON в байтах */
    compactSize: number;
    /** Коэффициент сжатия (compactSize / fullSize) */
    ratio: number;
    /** Экономия в процентах */
    savedPercent: number;
  };
}

// ============================================
// РЕЗУЛЬТАТ ПРОВЕРКИ ОБРАТИМОСТИ
// ============================================

/**
 * Результат проверки обратимости (round-trip).
 */
export interface RoundTripResult {
  /** Успешно ли прошла проверка */
  ok: boolean;
  /** Ошибка, если есть */
  error?: string;
  /** Детали расхождений */
  details?: {
    /** Расхождение в количестве функций */
    functionsDiff?: number;
    /** Расхождение в количестве экспортов */
    exportsDiff?: number;
    /** Расхождение в количестве реэкспортов */
    reExportsDiff?: number;
    /** Расхождение в количестве вызовов */
    callsDiff?: number;
  };
}

// ============================================
// ТИПЫ ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ
// ============================================

/**
 * Расширенная информация о функции (для внутреннего использования).
 */
export interface ExtendedFunctionData extends FunctionData {
  /** Уникальный ключ (moduleId:fileId:name) */
  _uniqueKey?: string;
  /** Полный путь к файлу */
  _fullPath?: string;
  /** Модуль (директория) */
  _moduleDir?: string;
  /** Тело функции (опционально) */
  _body?: string;
  /** Сложность (опционально) */
  _complexity?: number;
  /** Безопасность (опционально) */
  _security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
}

/**
 * Расширенная информация об экспорте (для внутреннего использования).
 */
export interface ExtendedExportData extends ExportData {
  /** Является ли реэкспортом */
  _isReExport?: boolean;
  /** Источник реэкспорта */
  _source?: string;
  /** Локальное имя в исходном модуле */
  _localName?: string;
}

/**
 * Расширенная информация об импорте (для внутреннего использования).
 */
export interface ExtendedImportData extends ImportData {
  /** Структурированные specifiers (если их несколько) */
  _specifiersStructured?: {
    imported: string;
    local: string;
    type: string;
  }[];
  /** Привязан ли импорт к конкретной функции/классу */
  _boundTo?: string;
  /** Строки использования импорта в файле */
  _usageLines?: number[];
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  // Все типы экспортируются автоматически через `export interface`
  // Этот default-экспорт нужен только для обратной совместимости
};
