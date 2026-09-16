// src/reporters/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ВСЕХ РЕПОРТЕРОВ
// ============================================================
// Версия: 9.0.0
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ ДОБАВЛЕНЫ экспорты типов новых секций:
//       LifecycleHook, LifecycleHookName,
//       EffectEdge, EffectType,
//       InjectionEdge, InjectionKind,
//       ReactivityEdge, ReactivityKind,
//       TemplateConditional, ConditionalDirective,
//       TypeNodeData, TypeKind,
//       TypeRefData, TypeUsageKind
//   - ✅ ИСПРАВЛЕНО TS2300: Duplicate identifier
//       'GenerateReportOptions' / 'GenerateReportResult'
//       Удалён дублирующий реэкспорт из './compact-reporter.js'.
//       Каноническое определение — в './codec/codec-types.js'.
//   - REPORTERS_VERSION обновлён до 9.0.0
//
// ИЗМЕНЕНИЯ v6.1.0:
//   - ✅ ДОБАВЛЕН экспорт типов Vue template (TemplateData и вложенные)
//   - Обновлена версия REPORTERS_VERSION до 6.1.0
//
// ИЗМЕНЕНИЯ v6.0.2:
//   - Добавлен экспорт типа DecodeOptions (для опций Codec.decode)
//
// ИЗМЕНЕНИЯ v6.0.1:
//   - Удалены несуществующие экспорты из './compact-reporter.js'
//     (findFunctionByName, getFunctionCalls, getFunctionCallers,
//      getFileName, getModuleName, getFunctionInfo, decodeFlags,
//      CompactFlags, CompactReport)
//   - Добавлены корректные типы из compact-reporter и codec
// ============================================================

// ============================================================
// 1. ПОЛНЫЙ ОТЧЁТ
// ============================================================

export { generateFullReport } from './full-reporter.js';
export type { FullReport } from './full-reporter.js';

// ============================================================
// 2. КОМПАКТНЫЙ ОТЧЁТ (v9.0.0)
// ============================================================
// ⚠️ Типы GenerateReportOptions и GenerateReportResult
//    НЕ реэкспортируются отсюда во избежание TS2300.
//    Их каноническое определение — в './codec/codec-types.js',
//    откуда они экспортируются в блоке №3 ниже.
// ============================================================

export {
  /** Генерация компактного отчёта */
  generateCompactReport,
  /** Декодирование сжатого JSON обратно в полный */
  decodeCompactReport,
  /** Чтение сжатого JSON из файла и декодирование */
  readAndDecode,
  /** Чтение полного JSON из файла */
  readFullJson,
} from './compact-reporter.js';

// ============================================================
// 3. ТИПЫ ИЗ CODEC (полный/сжатый JSON)
// ============================================================

export { Codec } from './codec/codec.js';

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
  // VUE TEMPLATES
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

  /** Хук жизненного цикла Vue */
  LifecycleHook,
  /** Имя хука жизненного цикла */
  LifecycleHookName,

  // ============================================
  // ✅ НОВОЕ v9.0.0: EFFECTS
  // ============================================

  /** Ребро side-effect (timer, cleanup, promise, event, subscription) */
  EffectEdge,
  /** Тип side-effect */
  EffectType,

  // ============================================
  // ✅ НОВОЕ v9.0.0: INJECTIONS
  // ============================================

  /** Ребро provide/inject */
  InjectionEdge,
  /** Тип injection-ребра */
  InjectionKind,

  // ============================================
  // ✅ НОВОЕ v9.0.0: REACTIVITY
  // ============================================

  /** Ребро реактивной связи (computed/watch/ref/...) */
  ReactivityEdge,
  /** Тип реактивной связи */
  ReactivityKind,

  // ============================================
  // ✅ НОВОЕ v9.0.0: CONDITIONALS
  // ============================================

  /** Условный рендеринг (v-if / v-else-if / v-else) */
  TemplateConditional,
  /** Директива условного рендеринга */
  ConditionalDirective,

  // ============================================
  // ✅ НОВОЕ v9.0.0: TYPES
  // ============================================

  /** Узел тип-графа (interface / type-alias / enum / class) */
  TypeNodeData,
  /** Вид типа */
  TypeKind,
  /** Ребро использования типа */
  TypeRefData,
  /** Вид использования типа */
  TypeUsageKind,

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
  // ✅ Канонические определения — здесь.
  //    Из './compact-reporter.js' НЕ реэкспортируются (TS2300).

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
} from './codec/codec-types.js';

// ============================================================
// 4. HTML РЕПОРТЕРЫ
// ============================================================

export { generateHTMLReport, escapeHtml } from './html-reporter.js';
export { generateInteractiveHTML } from './interactive-reporter.js';

// ============================================================
// 5. КОНСТАНТЫ МОДУЛЯ
// ============================================================

export const REPORTERS_VERSION = '9.0.0';
export const REPORTERS_NAME = '@newkind/ast-analyzer/reporters';

// ============================================================
// 6. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

import { generateFullReport } from './full-reporter.js';
import {
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,
} from './compact-reporter.js';
import { Codec } from './codec/codec.js';
import { generateHTMLReport, escapeHtml } from './html-reporter.js';
import { generateInteractiveHTML } from './interactive-reporter.js';

export default {
  // Полный отчёт
  generateFullReport,

  // Компактный отчёт
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,

  // Codec
  Codec,

  // HTML
  generateHTMLReport,
  generateInteractiveHTML,
  escapeHtml,

  // Константы
  REPORTERS_VERSION,
  REPORTERS_NAME,
};
