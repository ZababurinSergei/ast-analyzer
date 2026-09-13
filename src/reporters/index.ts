// src/reporters/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ВСЕХ РЕПОРТЕРОВ
// ============================================================
// Версия: 6.0.2
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
// 2. КОМПАКТНЫЙ ОТЧЁТ (v6.0.2)
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

// Типы опций и результата
export type {
  /** Опции генерации компактного отчёта */
  GenerateReportOptions,
  /** Результат генерации компактного отчёта */
  GenerateReportResult,
} from './compact-reporter.js';

// ============================================================
// 3. ТИПЫ ИЗ CODEC (полный/сжатый JSON)
// ============================================================

export { Codec } from './codec/codec.js';

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
  /** ✅ НОВОЕ: Опции декодирования CompactJSON → FullJSON */
  DecodeOptions,
} from './codec/codec-types.js';

// ============================================================
// 4. HTML РЕПОРТЕРЫ
// ============================================================

export { generateHTMLReport, escapeHtml } from './html-reporter.js';
export { generateInteractiveHTML } from './interactive-reporter.js';

// ============================================================
// 5. КОНСТАНТЫ МОДУЛЯ
// ============================================================

export const REPORTERS_VERSION = '6.0.2';
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
