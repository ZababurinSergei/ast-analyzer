// src/reporters/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ВСЕХ РЕПОРТЕРОВ
// ============================================================
// Версия: 10.0.0
//
// ИЗМЕНЕНИЯ v10.0.0 (устранение дублирования):
//   - ✅ УДАЛЁН реэкспорт типов из './compact-reporter.js' —
//     канонические определения GenerateReportOptions и
//     GenerateReportResult теперь ТОЛЬКО в './codec/codec-types.js'.
//     Это устраняет TS2300 (Duplicate identifier) и путаницу,
//     когда один и тот же тип экспортируется из двух мест.
//   - ✅ УДАЛЁН реэкспорт из './json-reporter.js' — файл УДАЛЁН.
//     Его функциональность полностью покрыта модулем './json/'.
//   - ✅ ДОБАВЛЕН явный реэкспорт всего из './json/index.js' —
//     это ЕДИНСТВЕННЫЙ источник JSON-отчётов в проекте.
//   - ✅ ДОБАВЛЕНЫ реэкспорты типов CompactReport, CompactModule,
//     CompactFunction из './../types.js' (обратная совместимость).
//   - ✅ ОБНОВЛЕНО: REPORTERS_VERSION = '10.0.0'
//   - ✅ ОБНОВЛЕНО: комментарии-заголовки для каждой секции.
//   - ✅ УБРАНЫ дублирующие экспорты: escapeHtml (был и в html-reporter,
//     и в utils.ts — теперь только один).
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ ДОБАВЛЕНЫ экспорты типов новых секций:
//       LifecycleHook, LifecycleHookName, EffectEdge, EffectType,
//       InjectionEdge, InjectionKind, ReactivityEdge, ReactivityKind,
//       TemplateConditional, ConditionalDirective, TypeNodeData, TypeKind,
//       TypeRefData, TypeUsageKind
//   - ✅ ИСПРАВЛЕНО TS2300: Duplicate identifier
//       'GenerateReportOptions' / 'GenerateReportResult'
//   - REPORTERS_VERSION = '9.0.0'
//
// ИЗМЕНЕНИЯ v6.1.0:
//   - ✅ ДОБАВЛЕН экспорт типов Vue template (TemplateData и вложенные)
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
// 1. ПОЛНЫЙ ОТЧЁТ (FullReport)
// ============================================================
// Классический «читаемый» отчёт со ВСЕМИ полями.
// Используется для детального аудита кода.
//
// Экспортирует:
//   - generateFullReport — функция генерации
//   - FullReport         — тип результата
// ============================================================

export { generateFullReport } from './full-reporter.js';
export type { FullReport } from './full-reporter.js';

// ============================================================
// 2. КОМПАКТНЫЙ ОТЧЁТ (CompactReport v9.0.5)
// ============================================================
// Тонкий оркестратор сжатого JSON.
//
// ⚠️ ВАЖНО: типы GenerateReportOptions и GenerateReportResult
//    НЕ реэкспортируются отсюда, чтобы избежать TS2300.
//    Их каноническое определение — в './codec/codec-types.js',
//    откуда они экспортируются в блоке №3 ниже.
//
// Экспортирует:
//   - generateCompactReport  — генерация сжатого отчёта
//   - decodeCompactReport    — декодирование compact → full
//   - readAndDecode          — чтение файла + декодирование
//   - readFullJson           — чтение полного JSON
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
// 3. CODEC — сериализация FullJSON ↔ CompactJSON (v9.0.0)
// ============================================================
// Codec — единая точка входа для кодирования/декодирования
// сжатого JSON. Обеспечивает round-trip (DL / RE).
//
// Экспортирует:
//   - Codec (класс с методами encode/decode/verifyRoundTrip/...)
//   - Все типы FullJSON, CompactJSON, CodecLegend, ModuleData, ...
//   - Опции DecodeOptions, GenerateReportOptions, GenerateReportResult
//   - RoundTripResult для проверки обратимости
//   - Расширенные типы ExtendedFunctionData, ExtendedExportData,
//     ExtendedImportData (для отладки)
//
// ✅ КАНОНИЧЕСКИЕ ОПРЕДЕЛЕНИЯ:
//    Все типы секций (ModuleData, FunctionData, ..., LifecycleHook,
//    EffectEdge, InjectionEdge, ReactivityEdge, TemplateConditional,
//    TypeNodeData, TypeRefData) определены ИМЕННО здесь, в
//    './codec/codec-types.js'. Не дублируйте их в других местах.
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
  // ✅ LIFECYCLE
  // ============================================

  /** Хук жизненного цикла Vue */
  LifecycleHook,
  /** Имя хука жизненного цикла */
  LifecycleHookName,

  // ============================================
  // ✅ EFFECTS
  // ============================================

  /** Ребро side-effect (timer, cleanup, promise, event, subscription) */
  EffectEdge,
  /** Тип side-effect */
  EffectType,

  // ============================================
  // ✅ INJECTIONS
  // ============================================

  /** Ребро provide/inject */
  InjectionEdge,
  /** Тип injection-ребра */
  InjectionKind,

  // ============================================
  // ✅ REACTIVITY
  // ============================================

  /** Ребро реактивной связи (computed/watch/ref/...) */
  ReactivityEdge,
  /** Тип реактивной связи */
  ReactivityKind,

  // ============================================
  // ✅ CONDITIONALS
  // ============================================

  /** Условный рендеринг (v-if / v-else-if / v-else) */
  TemplateConditional,
  /** Директива условного рендеринга */
  ConditionalDirective,

  // ============================================
  // ✅ TYPES
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
// 4. JSON REPORTERS — ЕДИНСТВЕННЫЙ ИСТОЧНИК JSON-ОТЧЁТОВ
// ============================================================
// Вся логика анализа/построения JSON-отчётов сосредоточена
// в модуле './json/'. Снаружи модуля НИКТО не должен:
//   - обходить AST самостоятельно
//   - строить EnhancedEntityInfo вручную
//   - собирать entitiesMap вручную
//   - реализовывать packageLockReport / relationshipGraph / fullAnalysis
//
// Экспортирует:
//   - extractEntitiesFromFile          — единая точка извлечения сущностей
//   - buildEnhancedPackageLockReport   — полный package-lock-подобный отчёт
//   - savePackageLockReport            — сохранение отчёта
//   - saveOptimizedPackageLockReport   — оптимизированный отчёт
//   - buildModuleGraph                 — граф модулей
//   - buildEntityGraph                 — граф сущностей
//   - buildFullAnalysis                — полный анализ
//   - buildOptimizedRelationships      — встроенные связи
//   - computeExportConsumers           — потребители экспортов
//   - collectImporters                 — импортёры
//   - resolveImportPath                — резолвер путей
//   - detectLanguage                   — определение языка
//   - convertEntitiesToEnhanced        — конвертер сущностей
//   - и другие утилиты из './json/'
// ============================================================

export * from './json/index.js';

// ============================================================
// 5. HTML РЕПОРТЕРЫ
// ============================================================
// Экспортирует:
//   - generateHTMLReport       — HTML отчёт с графом
//   - generateInteractiveHTML  — интерактивный HTML отчёт
//   - escapeHtml               — экранирование HTML (только здесь!)
//
// ⚠️ escapeHtml определён ТОЛЬКО в './html-reporter.js'.
//    НЕ дублируйте его в './utils.ts'.
// ============================================================

export { generateHTMLReport, escapeHtml } from './html-reporter.js';
export { generateInteractiveHTML } from './interactive-reporter.js';

// ============================================================
// 6. MARKDOWN РЕПОРТЕР
// ============================================================
// Экспортирует:
//   - escapeMarkdown
//   - generateStatsMarkdown
//   - generateExportsMarkdown
//   - generateImportsMarkdown
//   - generateClustersMarkdown
//   - generateCyclicEdgesMarkdown
//   - generateSuggestedStructureMarkdown
//   - generateCallGraphMarkdown
//   - generateSplitModulePromptMarkdown
// ============================================================

export {
  escapeMarkdown,
  generateStatsMarkdown,
  generateExportsMarkdown,
  generateImportsMarkdown,
  generateClustersMarkdown,
  generateCyclicEdgesMarkdown,
  generateSuggestedStructureMarkdown,
  generateCallGraphMarkdown,
  generateSplitModulePromptMarkdown,
} from './markdown-reporter.js';

// ============================================================
// 7. КОНСТАНТЫ МОДУЛЯ
// ============================================================

/** Версия модуля reporters */
export const REPORTERS_VERSION = '10.0.0';

/** Имя модуля reporters */
export const REPORTERS_NAME = '@newkind/ast-analyzer/reporters';

// ============================================================
// 8. РЕЭКСПОРТ ТИПОВ CompactReport (обратная совместимость)
// ============================================================
// CompactReport, CompactModule, CompactFunction определены
// в главном `src/types.ts`. Реэкспортируем их для удобства:
// потребители могут импортировать всё из './reporters/index.js'.
//
// ⚠️ НЕ путать с FullJSON/CompactJSON из './codec/codec-types.js'.
//    CompactReport — это СТАРАЯ структура (v4.0.0),
//    FullJSON/CompactJSON — это НОВАЯ (v9.0.x).
// ============================================================

export type {
  /** Компактный отчёт (v4.0.0, обратная совместимость) */
  CompactReport,
  /** Компактный модуль */
  CompactModule,
  /** Компактная функция */
  CompactFunction,
  /** Компактный вызов */
  CompactCall,
} from '../types.js';

// ============================================================
// 9. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
// Собираем все основные функции в один default-объект для
// удобства: `import reporters from './reporters/index.js'`.
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
import {
  escapeMarkdown,
  generateStatsMarkdown,
  generateExportsMarkdown,
  generateImportsMarkdown,
  generateClustersMarkdown,
  generateCyclicEdgesMarkdown,
  generateSuggestedStructureMarkdown,
  generateCallGraphMarkdown,
  generateSplitModulePromptMarkdown,
} from './markdown-reporter.js';

// Реэкспорт JSON-модуля для default-экспорта
import * as jsonReporters from './json/index.js';

export default {
  // ============================================
  // Полный отчёт
  // ============================================
  generateFullReport,

  // ============================================
  // Компактный отчёт
  // ============================================
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,

  // ============================================
  // Codec
  // ============================================
  Codec,

  // ============================================
  // JSON reporters (единственный источник JSON)
  // ============================================
  ...jsonReporters,

  // ============================================
  // HTML
  // ============================================
  generateHTMLReport,
  generateInteractiveHTML,
  escapeHtml,

  // ============================================
  // Markdown
  // ============================================
  escapeMarkdown,
  generateStatsMarkdown,
  generateExportsMarkdown,
  generateImportsMarkdown,
  generateClustersMarkdown,
  generateCyclicEdgesMarkdown,
  generateSuggestedStructureMarkdown,
  generateCallGraphMarkdown,
  generateSplitModulePromptMarkdown,

  // ============================================
  // Константы
  // ============================================
  REPORTERS_VERSION,
  REPORTERS_NAME,
};
