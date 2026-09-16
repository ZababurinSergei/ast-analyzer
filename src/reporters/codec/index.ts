// src/reporters/codec/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ КОДЕКА
// ============================================
// Версия: 9.0.0 (Стратегия B — строгий round-trip + v9-секции)
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ ДОБАВЛЕНЫ экспорты словарей типов v9:
//       LIFECYCLE_TYPES, LIFECYCLE_REVERSE,
//       EFFECT_TYPES, EFFECT_REVERSE,
//       INJECTION_TYPES, INJECTION_REVERSE,
//       REACTIVITY_TYPES, REACTIVITY_REVERSE,
//       CONDITIONAL_TYPES, CONDITIONAL_REVERSE,
//       TYPE_KINDS, TYPE_KINDS_REVERSE,
//       TYPE_USAGE_KINDS, TYPE_USAGE_KINDS_REVERSE
//   - ✅ ДОБАВЛЕНЫ экспорты типов v9:
//       LifecycleHook, LifecycleHookName,
//       EffectEdge, EffectType,
//       InjectionEdge, InjectionKind,
//       ReactivityEdge, ReactivityKind,
//       TemplateConditional, ConditionalDirective,
//       TypeNodeData, TypeKind,
//       TypeRefData, TypeUsageKind
//   - ✅ CODEC_MODULE_VERSION обновлён до 9.0.0
//   - ✅ CODEC_MODULE_NAME обновлён
//
// ИЗМЕНЕНИЯ v3.2.0:
//   - ✅ ДОБАВЛЕНЫ экспорты типов Vue-шаблонов:
//       TemplateData, TemplateEventHandler, TemplateDynamicComponent,
//       TemplateRefUsage, TemplateCssVariable, TemplateDeepSelector
//
// ИЗМЕНЕНИЯ v3.1.0:
//   - Добавлен экспорт типа DecodeOptions
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - Добавлен экспорт RE_EXPORT_TYPES
//   - Добавлен экспорт arraySchemas (через CodecLegend)
//   - Добавлены экспорты словарей (stringDict, paramDict, methodDict, valueDict)
//   - Добавлен экспорт типа EdgeData
//
// ИЗМЕНЕНИЯ v2.0.1:
//   - DecodedFlags реэкспортируется из './codec.js'
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
  /** Типы реэкспортов (named, default, all) */
  RE_EXPORT_TYPES,
  /** Карта ключей: полное имя → короткое */
  KEY_MAP,
  /** Обратная карта: короткое → полное */
  KEY_REVERSE_MAP,

  // ============================================
  // ✅ НОВОЕ v9.0.0: СЛОВАРИ ТИПОВ
  // ============================================

  /** Типы lifecycle-хуков (onMounted, onUnmounted, ...) */
  LIFECYCLE_TYPES,
  /** Обратная карта lifecycle: имя → код */
  LIFECYCLE_REVERSE,
  /** Типы эффектов (timer, cleanup, promise, event, subscription) */
  EFFECT_TYPES,
  /** Обратная карта эффектов: имя → код */
  EFFECT_REVERSE,
  /** Типы injections (provide, inject) */
  INJECTION_TYPES,
  /** Обратная карта injections: имя → код */
  INJECTION_REVERSE,
  /** Типы реактивности (computed, watch, ref, reactive, ...) */
  REACTIVITY_TYPES,
  /** Обратная карта реактивности: имя → код */
  REACTIVITY_REVERSE,
  /** Типы условного рендеринга (v-if, v-else-if, v-else) */
  CONDITIONAL_TYPES,
  /** Обратная карта условного рендеринга: имя → код */
  CONDITIONAL_REVERSE,
  /** Типы TS-сущностей (interface, type-alias, enum, class) */
  TYPE_KINDS,
  /** Обратная карта TS-сущностей: имя → код */
  TYPE_KINDS_REVERSE,
  /** Способы использования типов (param, return, field, ...) */
  TYPE_USAGE_KINDS,
  /** Обратная карта использования типов: имя → код */
  TYPE_USAGE_KINDS_REVERSE,
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
  // VUE TEMPLATES (v3.2.0)
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
  // ✅ НОВОЕ v9.0.0: LIFECYCLE
  // ============================================

  /** Имя lifecycle-хука */
  LifecycleHookName,
  /** Ребро lifecycle-хука */
  LifecycleHook,

  // ============================================
  // ✅ НОВОЕ v9.0.0: EFFECTS
  // ============================================

  /** Тип эффекта */
  EffectType,
  /** Ребро эффекта */
  EffectEdge,

  // ============================================
  // ✅ НОВОЕ v9.0.0: INJECTIONS
  // ============================================

  /** Тип injection (provide / inject) */
  InjectionKind,
  /** Ребро injection */
  InjectionEdge,

  // ============================================
  // ✅ НОВОЕ v9.0.0: REACTIVITY
  // ============================================

  /** Тип реактивности */
  ReactivityKind,
  /** Ребро реактивности */
  ReactivityEdge,

  // ============================================
  // ✅ НОВОЕ v9.0.0: CONDITIONALS
  // ============================================

  /** Тип условной директивы */
  ConditionalDirective,
  /** Ребро условного рендеринга */
  TemplateConditional,

  // ============================================
  // ✅ НОВОЕ v9.0.0: TYPES
  // ============================================

  /** Тип TS-сущности */
  TypeKind,
  /** Узел типа */
  TypeNodeData,
  /** Способ использования типа */
  TypeUsageKind,
  /** Ссылка на тип */
  TypeRefData,

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
  /** Опции декодирования CompactJSON → FullJSON */
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

export const CODEC_MODULE_VERSION = '9.0.0';
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
  // ✅ v9.0.0
  LIFECYCLE_TYPES,
  LIFECYCLE_REVERSE,
  EFFECT_TYPES,
  EFFECT_REVERSE,
  INJECTION_TYPES,
  INJECTION_REVERSE,
  REACTIVITY_TYPES,
  REACTIVITY_REVERSE,
  CONDITIONAL_TYPES,
  CONDITIONAL_REVERSE,
  TYPE_KINDS,
  TYPE_KINDS_REVERSE,
  TYPE_USAGE_KINDS,
  TYPE_USAGE_KINDS_REVERSE,
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

  // ✅ v9.0.0
  LIFECYCLE_TYPES,
  LIFECYCLE_REVERSE,
  EFFECT_TYPES,
  EFFECT_REVERSE,
  INJECTION_TYPES,
  INJECTION_REVERSE,
  REACTIVITY_TYPES,
  REACTIVITY_REVERSE,
  CONDITIONAL_TYPES,
  CONDITIONAL_REVERSE,
  TYPE_KINDS,
  TYPE_KINDS_REVERSE,
  TYPE_USAGE_KINDS,
  TYPE_USAGE_KINDS_REVERSE,

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
