// src/reporters/codec/codec-types.ts
// ============================================
// ТИПЫ ДЛЯ КОДЕКА
// ============================================
// Этот файл содержит ВСЕ типы, необходимые для:
// 1. Полного (читаемого) JSON — FullJSON
// 2. Сжатого JSON — CompactJSON
// 3. Легенды для декодирования — CodecLegend
// ============================================

// ============================================
// ПОЛНЫЙ (ЧИТАЕМЫЙ) JSON
// ============================================

/**
 * Полный (читаемый) JSON отчёта
 * Это "истина" в последней инстанции — из него генерируется сжатый JSON,
 * и в него же можно декодировать сжатый JSON обратно.
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
}

// ============================================
// МОДУЛЬ
// ============================================

/**
 * Модуль — это директория с файлами.
 * Например: `core`, `modes`, `reporters`, `cli`.
 * Используется для группировки файлов в графе.
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
    /** Дополнительные флаги (опционально) */
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
    /** ID файла-цели (null, если внешний модуль) */
    toFileId: string | null;
    /** Имя импортируемой сущности */
    importedName: string;
    /** Локальное имя (при `import { a as b }`) */
    localName: string;
    /** Номер строки */
    line: number;
    /** Тип импорта */
    type: 'named' | 'default' | 'namespace' | 'type';
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
    /** ID функции-цели (кого вызывают) */
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
}

// ============================================
// СТАТИСТИКА
// ============================================

/**
 * Статистика по всему проекту.
 * Заполняется при сборе FullJSON.
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
// СЖАТЫЙ JSON
// ============================================

/**
 * Сжатый JSON — компактное представление FullJSON.
 * Использует короткие ключи и массивы вместо объектов.
 *
 * Пример: вместо `{ id: 'fn1', name: 'parseFile', ... }`
 *         используется `['fn1', 'parseFile', ...]`.
 */
export interface CompactJSON {
    /** Version */
    v: string;
    /** Timestamp */
    ts: string;
    /** Root module ID */
    r: string;
    /** Module index: id → name */
    mi: Record<string, string>;
    /** File index: id → path */
    fl: Record<string, string>;
    /** Functions: [id, name, moduleId, fileId, line, flags] */
    fns: Array<[string, string, string, string, number, string]>;
    /** Classes: [id, name, moduleId, fileId, line, flags] */
    cls: Array<[string, string, string, string, number, string]>;
    /** Constants: [id, name, moduleId, fileId, line, flags] */
    cn: Array<[string, string, string, string, number, string]>;
    /** Graph — все связи в одном месте */
    gr: {
        /** Exports: [moduleIdx, funcIdx, line, typeCode, exportName, localName] */
        e: Array<[number, number, number, string, string, string]>;
        /** Imports: [fromFileId, toFileId, importedName, typeCode, fileId, line] */
        i: Array<[string, string, string, string, string, number]>;
        /** Calls: [fromIdx, toIdx, line, typeCode] */
        c: Array<[number, number, number, string]>;
        /** Re-exports: [moduleIdx, funcIdx, source, exportName, line] */
        re: Array<[number, number, string, string, number]>;
    };
    /** Statistics */
    st: StatisticsData;
    /** Legend (dictionaries) */
    legend: CodecLegend;
}

// ============================================
// ЛЕГЕНДА (ДЛЯ ДЕКОДИРОВАНИЯ)
// ============================================

/**
 * Легенда — все словари и карты, необходимые для декодирования.
 * Встраивается в CompactJSON, чтобы декодер мог работать автономно.
 */
export interface CodecLegend {
    /** Карта флагов: символ → бит (для декодирования) */
    flagMap: Record<string, string>;
    /** Карта флагов: символ → бит (числовое значение) */
    flagCharMap: Record<string, number>;
    /** Типы связей */
    relationTypes: Record<string, string>;
    /** Типы экспортов */
    exportTypes: Record<string, string>;
    /** Типы импортов */
    importTypes: Record<string, string>;
    /** Типы вызовов */
    callTypes: Record<string, string>;
    /** Ключи для полного JSON (short → full) */
    keyMap: Record<string, string>;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================

/**
 * Опции для генерации отчёта
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

/**
 * Результат генерации отчёта
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

/**
 * Результат проверки обратимости
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
 * Расширенная информация о функции (для внутреннего использования)
 * Наследует FunctionData и добавляет поля, которые нужны только внутри.
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
 * Расширенная информация об экспорте (для внутреннего использования)
 */
export interface ExtendedExportData extends ExportData {
    /** Является ли реэкспортом (дублирует информацию для удобства) */
    _isReExport?: boolean;
    /** Источник реэкспорта */
    _source?: string;
    /** Локальное имя в исходном модуле */
    _localName?: string;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
    // Все типы экспортируются автоматически через `export interface`
    // Этот default-экспорт нужен только для обратной совместимости
};
