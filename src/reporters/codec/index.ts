// src/reporters/codec/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ КОДЕКА
// ============================================
// Экспортирует всё необходимое для кодирования/декодирования
// компактных JSON-отчётов.
// ============================================

// ============================================
// ОСНОВНОЙ КЛАСС КОДЕКА
// ============================================

export { Codec } from './codec.js';

// ============================================
// СЛОВАРИ И КАРТЫ (DICTIONARIES)
// ============================================

export {
    /** Карта флагов: бит → символ */
        FLAG_MAP,
    /** Обратная карта: символ → бит */
        FLAG_CHAR_MAP,
    /** Типы связей (direct, async, method, ...) */
        RELATION_TYPES,
    /** Типы экспортов (named, default, type, re-export) */
        EXPORT_TYPES,
    /** Типы импортов (named, default, namespace, type-only) */
        IMPORT_TYPES,
    /** Типы вызовов (direct, async, method, callback) */
        CALL_TYPES,
    /** Карта ключей: полное имя → короткое */
        KEY_MAP,
    /** Обратная карта: короткое → полное */
        KEY_REVERSE_MAP,
} from './codec.js';

// ============================================
// ФУНКЦИИ КОДИРОВАНИЯ/ДЕКОДИРОВАНИЯ ФЛАГОВ
// ============================================

export {
    /** Кодирует булевы флаги в число */
        encodeFlags,
    /** Кодирует число флагов в строку символов */
        flagsToString,
    /** Декодирует строку символов в объект с булевыми полями */
        decodeFlagsToObject,
} from './codec.js';

// ============================================
// ТИПЫ
// ============================================

export type {
    /** Полный (читаемый) JSON */
        FullJSON,
    /** Сжатый JSON (короткие ключи, массивы вместо объектов) */
        CompactJSON,
    /** Легенда — словари для декодирования */
        CodecLegend,
    /** Данные модуля */
        ModuleData,
    /** Данные файла */
        FileData,
    /** Данные функции */
        FunctionData,
    /** Данные класса */
        ClassData,
    /** Данные константы */
        ConstantData,
    /** Данные экспорта */
        ExportData,
    /** Данные импорта */
        ImportData,
    /** Данные вызова */
        CallData,
    /** Данные реэкспорта */
        ReExportData,
    /** Статистика */
        StatisticsData,
} from './codec-types.js';

// ============================================
// ВЕРСИЯ МОДУЛЯ
// ============================================

export const CODEC_MODULE_VERSION = '1.0.0';
export const CODEC_MODULE_NAME = '@newkind/ast-analyzer/reporters/codec';

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

import { Codec } from './codec.js';
import {
    FLAG_MAP,
    FLAG_CHAR_MAP,
    RELATION_TYPES,
    EXPORT_TYPES,
    IMPORT_TYPES,
    CALL_TYPES,
    KEY_MAP,
    KEY_REVERSE_MAP,
    encodeFlags,
    flagsToString,
    decodeFlagsToObject,
} from './codec.js';

export default {
    // Основной класс
    Codec,

    // Словари
    FLAG_MAP,
    FLAG_CHAR_MAP,
    RELATION_TYPES,
    EXPORT_TYPES,
    IMPORT_TYPES,
    CALL_TYPES,
    KEY_MAP,
    KEY_REVERSE_MAP,

    // Функции
    encodeFlags,
    flagsToString,
    decodeFlagsToObject,

    // Константы
    CODEC_MODULE_VERSION,
    CODEC_MODULE_NAME,
};
