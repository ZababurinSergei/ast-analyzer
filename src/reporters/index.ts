// src/reporters/index.ts

// ============================================================
// ТОЛЬКО ДВА ГЕНЕРАТОРА
// ============================================================

// 1. Полный отчет
export { generateFullReport } from './full-reporter.js';
export type { FullReport } from './full-reporter.js';

// 2. Компактный отчет
export {
  generateCompactReport,
  findFunctionByName,
  getFunctionCalls,
  getFunctionCallers,
  getFileName,
  getModuleName,
  getFunctionInfo,
  decodeFlags,
  CompactFlags,
} from './compact-reporter.js';
export type { CompactReport } from './compact-reporter.js';

// ============================================================
// HTML РЕПОРТЕРЫ (оставляем)
// ============================================================

export { generateHTMLReport, escapeHtml } from './html-reporter.js';
export { generateInteractiveHTML } from './interactive-reporter.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

export const REPORTERS_VERSION = '5.0.0';
export const REPORTERS_NAME = 'reporters';
