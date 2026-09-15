// src/reporters/codec/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ КОДЕКА
// ============================================
// Версия: 3.2.0 (Стратегия B — строгий round-trip + Vue templates)
//
// ИЗМЕНЕНИЯ v3.2.0:
//   - ✅ ДОБАВЛЕНЫ экспорты типов Vue-шаблонов:
//       TemplateData, TemplateEventHandler, TemplateDynamicComponent,
//       TemplateRefUsage, TemplateCssVariable, TemplateDeepSelector
//   - ✅ CODEC_MODULE_VERSION обновлён до 3.2.0
//
// ИЗМЕНЕНИЯ v3.1.0:
//   - Добавлен экспорт типа DecodeOptions
//   - CODEC_MODULE_VERSION обновлён до 3.1.0
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - Добавлен экспорт RE_EXPORT_TYPES
//   - Добавлен экспорт arraySchemas (через CodecLegend)
//   - Добавлены экспорты словарей (stringDict, paramDict, methodDict, valueDict)
//   - Обновлены типы: CompactJSON, CodecLegend, ExportData, ImportData
//   - Добавлен экспорт типа EdgeData
//   - CODEC_MODULE_VERSION обновлён до 3.0.0
//
// ИЗМЕНЕНИЯ v2.0.1:
//   - DecodedFlags теперь реэкспортируется из './codec.js'
//     (был ошибочно указан './codec-types.js', где его нет)
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
  /** Имена флагов: бит → имя */
  FLAG_NAMES,
  /** Типы связей (direct, async, method, callback, external, ...) */
  RELATION_TYPES,
  /** Типы экспортов (named, default, type, re-export) */
  EXPORT_TYPES,
  /** Типы импортов (named, default, namespace, type-only) */
  IMPORT_TYPES,
  /** Типы вызовов (direct, async, method, callback, external) */
  CALL_TYPES,
  /** ✅ НОВОЕ v3.0.0: Типы реэкспортов (named, default, all) */
  RE_EXPORT_TYPES,
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
  /** Декодирует строку символов в число флагов */
  flagsStringToNumber,
  /** Декодирует строку символов в объект с булевыми полями */
  decodeFlagsToObject,
  /** Декодирует строку флагов в массив имён установленных флагов */
  decodeFlagsToNames,
} from './codec.js';

// ============================================
// ТИПЫ ИЗ codec-types.ts
// ============================================

export type {
  // ============================================
  // ВЕРХНИЙ УРОВЕНЬ
  // ============================================

  /** Полный (читаемый) JSON */
  FullJSON,
  /** Сжатый JSON (короткие ключи, массивы вместо объектов) */
  CompactJSON,
  /** Легенда — словари для декодирования */
  CodecLegend,

  // ============================================
  // СУЩНОСТИ
  // ============================================

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

  // ============================================
  // СВЯЗИ
  // ============================================

  /** Данные экспорта */
  ExportData,
  /** Данные импорта */
  ImportData,
  /** Данные вызова */
  CallData,
  /** Данные реэкспорта */
  ReExportData,

  // ============================================
  // ✅ НОВОЕ v3.2.0: VUE TEMPLATES
  // ============================================

  /**
   * Шаблон Vue-файла — отдельная сущность.
   * Хранит ТОЛЬКО ссылки (имена, индексы), без дубликатов объектов.
   */
  TemplateData,
  /** Обработчик события из шаблона (@click → handlerName) */
  TemplateEventHandler,
  /** Динамический компонент (<component :is="...">) */
  TemplateDynamicComponent,
  /** Template ref (ref="dataTable" → exposedMethods) */
  TemplateRefUsage,
  /** CSS-переменная из <style> */
  TemplateCssVariable,
  /** :deep() селектор */
  TemplateDeepSelector,

  // ============================================
  // МЕТАДАННЫЕ
  // ============================================

  /** Статистика */
  StatisticsData,
  /** Данные единого ребра графа */
  EdgeData,

  // ============================================
  // ОПЦИИ И РЕЗУЛЬТАТЫ
  // ============================================

  /** Опции генерации отчёта */
  GenerateReportOptions,
  /** Результат генерации отчёта */
  GenerateReportResult,
  /** Результат проверки обратимости */
  RoundTripResult,
  /** ✅ v3.1.0: Опции декодирования CompactJSON → FullJSON */
  DecodeOptions,

  // ============================================
  // ВНУТРЕННИЕ (для отладки)
  // ============================================

  /** Расширенная информация о функции */
  ExtendedFunctionData,
  /** Расширенная информация об экспорте */
  ExtendedExportData,
  /** Расширенная информация об импорте */
  ExtendedImportData,
} from './codec-types.js';

// ============================================
// ТИПЫ ИЗ codec.ts
// ============================================

export type {
  /** Результат декодирования битовых флагов */
  DecodedFlags,
} from './codec.js';

// ============================================
// ВЕРСИЯ МОДУЛЯ
// ============================================

export const CODEC_MODULE_VERSION = '3.2.0';
export const CODEC_MODULE_NAME = '@newkind/ast-analyzer/reporters/codec';

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

import { Codec } from './codec.js';
import {
  FLAG_MAP,
  FLAG_CHAR_MAP,
  FLAG_NAMES,
  RELATION_TYPES,
  EXPORT_TYPES,
  IMPORT_TYPES,
  CALL_TYPES,
  RE_EXPORT_TYPES,
  KEY_MAP,
  KEY_REVERSE_MAP,
  encodeFlags,
  flagsToString,
  flagsStringToNumber,
  decodeFlagsToObject,
  decodeFlagsToNames,
} from './codec.js';

export default {
  // ============================================
  // Основной класс
  // ============================================
  Codec,

  // ============================================
  // Словари
  // ============================================
  FLAG_MAP,
  FLAG_CHAR_MAP,
  FLAG_NAMES,
  RELATION_TYPES,
  EXPORT_TYPES,
  IMPORT_TYPES,
  CALL_TYPES,
  RE_EXPORT_TYPES,
  KEY_MAP,
  KEY_REVERSE_MAP,

  // ============================================
  // Функции флагов
  // ============================================
  encodeFlags,
  flagsToString,
  flagsStringToNumber,
  decodeFlagsToObject,
  decodeFlagsToNames,

  // ============================================
  // Константы
  // ============================================
  CODEC_MODULE_VERSION,
  CODEC_MODULE_NAME,
};
