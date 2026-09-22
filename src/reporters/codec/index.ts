// src/reporters/codec/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ CODEC
// ============================================
// Версия: 15.4.3
//
// ИЗМЕНЕНИЯ v15.4.3 (устранение дублирования classifyValue):
//   - ✅ ИСПРАВЛЕНО: `classifyValue` теперь реэкспортируется из
//     './values-filter.js', а НЕ из './codec-encode.js'.
//     Причина: в codec-encode.ts осталась legacy-копия
//     `classifyValue` с нативным JSON.stringify, которая
//     давала недетерминированный результат и ломала
//     round-trip (L0/L3/RE падали с values.length: 557 → 558).
//     Теперь ЕДИНСТВЕННЫЙ источник истины — values-filter.ts
//     (v1.0.1 с stableStringifyForClassify).
//   - ✅ ОБНОВЛЕНО: CODEC_MODULE_VERSION = '15.4.3'
//   - ✅ Синхронизировано с codec-encode.ts (v15.4.3),
//     codec-decode.ts (v15.4.3), codec-legend.ts (v15.4.3)
//     и codec-types.ts (CODEC_VERSION = '15.4.3').
//
// ИЗМЕНЕНИЯ v15.0.6 (gr.i.tf — индекс в fl.p):
//   - ✅ ОБНОВЛЕНО: CODEC_MODULE_VERSION = '15.0.6'
//   - ✅ Синхронизировано с codec-encode.ts (v15.0.6),
//     codec-decode.ts (v15.0.6), codec-legend.ts (v15.0.6)
//     и codec-types.ts (CODEC_VERSION = '15.0.5').
//
// ИЗМЕНЕНИЯ v11.0.0 (компактнее):
//   - ✅ ДОБАВЛЕН реэкспорт `decodeFlagsFromNumber` из './codec-decode.js'
//     (новая функция для парсинга флагов-чисел в compact.json v11.0.0).
//   - ✅ ОБНОВЛЕНО: CODEC_MODULE_VERSION = '11.0.0'
//   - ✅ default-экспорт включает decodeFlagsFromNumber
//
// ИЗМЕНЕНИЯ v10.4.0 (легенда для ИИ):
//   - ✅ ДОБАВЛЕНО: реэкспорт из './codec-legend.js':
//       • buildLegend         — сборка легенды с словарями
//       • buildEmptyLegend    — легенда с пустыми словарями
//       • SCHEMAS             — позиционные схемы кортежей
//       • LegendDictionaries  — тип словарей
//   - ✅ ДОБАВЛЕНО: реэкспорт новых типов из './codec-types.js':
//       • FlagBit             — один бит в поле flags
//       • CodesDict           — словарь { код: описание }
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - Базовая структура: реэкспорт Codec, словарей, функций флагов,
//     утилит проверки, типов FullJSON/CompactJSON/CodecLegend.
// ============================================

// ============================================
// 1. ОСНОВНОЙ КЛАСС CODEC
// ============================================
// Единая точка входа для encode/decode/verifyRoundTrip.
// ============================================

export { Codec } from './codec.js';

// ============================================
// 2. СЛОВАРИ (из codec-encode.ts)
// ============================================
// Экспортируются для обратной совместимости и для
// внешних потребителей, которым нужны «сырые» словари.
//
// ⚠️ ВАЖНО: в v10.4.0 эти словари больше НЕ попадают
//    напрямую в compact.json. Вместо них используется
//    legend.flags / legend.codes / legend.schemas
//    (см. codec-legend.ts).
//
// ⚠️ v15.4.3: `classifyValue` УБРАН отсюда — он теперь
//    реэкспортируется из './values-filter.js' (см. секцию 4.5).
// ============================================

export {
  // Карты флагов
  FLAG_MAP,
  FLAG_CHAR_MAP,
  FLAG_NAMES,

  // Типы связей
  RELATION_TYPES,
  EXPORT_TYPES,
  IMPORT_TYPES,
  CALL_TYPES,
  RE_EXPORT_TYPES,

  // Типы v9.0.0
  LIFECYCLE_TYPES,
  EFFECT_TYPES,
  INJECTION_TYPES,
  REACTIVITY_TYPES,
  CONDITIONAL_TYPES,
  TYPE_KINDS,
  TYPE_USAGE_KINDS,
} from './codec-encode.js';

// ============================================
// 3. ФУНКЦИИ ФЛАГОВ
// ============================================
// Кодирование/декодирование битовых флагов.
// ============================================

// --- Из codec-encode.ts (кодирование) ---
export { encodeFlags, flagsToString, reverseLookup } from './codec-encode.js';

// --- Из codec-decode.ts (декодирование) ---
// ✅ v11.0.0: добавлен decodeFlagsFromNumber (парсит число-флаги).
export {
  decodeFlagsToObject,
  decodeFlagsFromNumber, // ✅ v11.0.0
  flagsStringToNumber,
  createEmptyFlags,
} from './codec-decode.js';

export type { DecodedFlags } from './codec-decode.js';

// ============================================
// 4. УТИЛИТЫ ПРОВЕРКИ (из codec-verify.ts)
// ============================================
// Round-trip проверки, размеры, сериализация.
// ============================================

export {
  verifyRoundTrip,
  verifyRoundTripBoth,
  deepEqual,
  normalizeForDiff,
  collectDiffs,
  getCompactSize,
  getFullSize,
  getCompressionRatio,
  stringify,
  parse,
} from './codec-verify.js';

export type { RoundTripDiff, LevelResult, ReversibilityReport } from './codec-verify.js';

// ============================================
// 4.5. ✅ v15.4.3: ФИЛЬТРАЦИЯ VALUES И classifyValue
// ============================================
// ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ для classifyValue.
//
// Ранее `classifyValue` реэкспортировался из './codec-encode.js',
// где оставалась legacy-копия с нативным JSON.stringify.
// Это давало недетерминированный `kind` для объектов
// (порядок ключей влиял на результат), из-за чего:
//   • compact.values.length = 557
//   • encode(full).values.length = 558
//   • cn.nonEmptyV сдвигался на +1
//   • L0/L3/RE в verify-roundtrip.ts падали
//   • encode(full) ≟ compact в verify-consistency.ts падал
//
// Теперь classifyValue живёт ТОЛЬКО в values-filter.ts
// (v1.0.1 с stableStringifyForClassify).
// ============================================

export {
  // ✅ v15.4.3: classifyValue из values-filter.ts (единый источник истины)
  classifyValue,
  filterValues,
  remapIndex,
  remapNonEmptyV,
  isValidValuesMode,
  normalizeValuesMode,
  getFilterStats,
  RELATION_KEYS,
} from './values-filter.js';

export type { ValuesMode, ValueKind, ValueMeta, FilterValuesResult } from './values-filter.js';

// ============================================
// 5. ✅ v10.4.0: ЛЕГЕНДА ДЛЯ ИИ (из codec-legend.ts)
// ============================================
// Единая точка сборки legend для compact.json.
//
// Содержит 3 секции:
//   • codes        — расшифровка строковых кодов типов
//   • flags        — расшифровка битовых флагов
//   • schemas      — позиционные схемы кортежей
// ============================================

export {
  /** Собирает полную legend с словарями (используется в encode) */
  buildLegend,
  /** Собирает legend с ПУСТЫМИ словарями (для getLegend) */
  buildEmptyLegend,
  /** Позиционные схемы кортежей (константа) */
  SCHEMAS,
} from './codec-legend.js';

export type { LegendDictionaries } from './codec-legend.js';

// ============================================
// 6. ТИПЫ (из codec-types.ts)
// ============================================
// Все публичные типы кодека.
//
// ⚠️ Канонические определения здесь. Не дублируйте
//    их в других местах — используйте реэкспорт.
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
  // ✅ v10.4.0: НОВЫЕ ТИПЫ ЛЕГЕНДЫ
  // ============================================

  /** Один бит в поле flags */
  FlagBit,
  /** Словарь { код: описание } */
  CodesDict,

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
  // VUE TEMPLATES
  // ============================================

  /** Шаблон Vue-файла */
  TemplateData,
  /** Обработчик события из шаблона */
  TemplateEventHandler,
  /** Динамический компонент */
  TemplateDynamicComponent,
  /** Template ref */
  TemplateRefUsage,
  /** CSS-переменная */
  TemplateCssVariable,
  /** :deep() селектор */
  TemplateDeepSelector,

  // ============================================
  // LIFECYCLE
  // ============================================

  /** Хук жизненного цикла Vue */
  LifecycleHook,
  /** Имя хука жизненного цикла */
  LifecycleHookName,

  // ============================================
  // EFFECTS
  // ============================================

  /** Ребро side-effect */
  EffectEdge,
  /** Тип side-effect */
  EffectType,

  // ============================================
  // INJECTIONS
  // ============================================

  /** Ребро provide/inject */
  InjectionEdge,
  /** Тип injection-ребра */
  InjectionKind,

  // ============================================
  // REACTIVITY
  // ============================================

  /** Ребро реактивной связи */
  ReactivityEdge,
  /** Тип реактивной связи */
  ReactivityKind,

  // ============================================
  // CONDITIONALS
  // ============================================

  /** Условный рендеринг (v-if / v-else-if / v-else) */
  TemplateConditional,
  /** Директива условного рендеринга */
  ConditionalDirective,

  // ============================================
  // TYPES
  // ============================================

  /** Узел тип-графа */
  TypeNodeData,
  /** Вид типа */
  TypeKind,
  /** Ребро использования типа */
  TypeRefData,
  /** Вид использования типа */
  TypeUsageKind,

  // ============================================
  // ✅ v15.2.0 (P1): LEXICAL LINKS
  // ============================================

  /** Лексическая связь между функциями (parent → child) */
  LexicalLink,
  /** Вид лексической связи */
  LexicalRelation,

  // ============================================
  // ✅ v15.4.0 (P3): CROSS-FILE TYPES (реэкспорт)
  // ============================================

  /** Разрешённый межфайловый вызов */
  CrossFileCall,
  /** Опции cross-file resolver */
  CrossFileResolverOptions,
  /** Метрики cross-file resolver */
  ResolveStats,
  /** Результат разрешения callee */
  ResolvedCallee,

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
// 7. КОНСТАНТЫ МОДУЛЯ
// ============================================

/**
 * Версия модуля codec.
 *
 * ✅ v15.4.3: синхронизирована с codec-legend.ts,
 *    codec-encode.ts, codec-decode.ts, codec-types.ts
 *    (CODEC_VERSION = '15.4.3') и compact-reporter.ts.
 */
export const CODEC_MODULE_VERSION = '15.4.3';

/**
 * Имя модуля codec.
 */
export const CODEC_MODULE_NAME = '@newkind/ast-analyzer/reporters/codec';

// ============================================
// 8. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================
// Собираем основные функции в один объект для удобства:
//
//   import codec from './reporters/codec/index.js';
//   codec.Codec.encode(full);
//   codec.buildLegend(dict);
//   codec.verifyRoundTripBoth(full, compact);
// ============================================

import { Codec } from './codec.js';
import { buildLegend, buildEmptyLegend, SCHEMAS } from './codec-legend.js';
import {
  encodeFlags,
  flagsToString,
  reverseLookup,
  FLAG_MAP,
  FLAG_CHAR_MAP,
  FLAG_NAMES,
} from './codec-encode.js';
import {
  decodeFlagsToObject,
  decodeFlagsFromNumber, // ✅ v11.0.0
  flagsStringToNumber,
  createEmptyFlags,
} from './codec-decode.js';
import {
  verifyRoundTrip,
  verifyRoundTripBoth,
  deepEqual,
  normalizeForDiff,
  collectDiffs,
  getCompactSize,
  getFullSize,
  getCompressionRatio,
  stringify,
  parse,
} from './codec-verify.js';

// ✅ v15.4.3: classifyValue из values-filter.js (единый источник истины)
import {
  classifyValue,
  filterValues,
  remapIndex,
  remapNonEmptyV,
  isValidValuesMode,
  normalizeValuesMode,
  getFilterStats,
  RELATION_KEYS,
} from './values-filter.js';

export default {
  // ============================================
  // Основной класс
  // ============================================
  Codec,

  // ============================================
  // ✅ v10.4.0: Легенда
  // ============================================
  buildLegend,
  buildEmptyLegend,
  SCHEMAS,

  // ============================================
  // Флаги
  // ============================================
  encodeFlags,
  decodeFlagsToObject,
  decodeFlagsFromNumber, // ✅ v11.0.0
  flagsToString,
  flagsStringToNumber,
  createEmptyFlags,
  reverseLookup,

  // ============================================
  // Словари
  // ============================================
  FLAG_MAP,
  FLAG_CHAR_MAP,
  FLAG_NAMES,

  // ============================================
  // ✅ v15.4.3: Фильтрация values
  // ============================================
  classifyValue,
  filterValues,
  remapIndex,
  remapNonEmptyV,
  isValidValuesMode,
  normalizeValuesMode,
  getFilterStats,
  RELATION_KEYS,

  // ============================================
  // Проверки
  // ============================================
  verifyRoundTrip,
  verifyRoundTripBoth,
  deepEqual,
  normalizeForDiff,
  collectDiffs,
  getCompactSize,
  getFullSize,
  getCompressionRatio,
  stringify,
  parse,

  // ============================================
  // Константы
  // ============================================
  CODEC_MODULE_VERSION,
  CODEC_MODULE_NAME,
};
