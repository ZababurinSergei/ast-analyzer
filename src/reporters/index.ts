// src/reporters/index.ts
// Точка входа для всех репортеров

// ============================================================
// ИМПОРТ ВСЕХ НУЖНЫХ ФУНКЦИЙ
// ============================================================

// Основные репортеры
import { generateHTMLReport, escapeHtml } from './html-reporter.js';
import { generateInteractiveHTML } from './interactive-reporter.js';

// JSON репортеры
import {
  buildEnhancedPackageLockReport,
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  extractEntitiesFromFile,
} from './json-reporter.js';

// Компактный формат
import {
  compressReport,
  UniverseNavigator,
  loadUniverse,
  createNavigator,
} from './compressReport.js';

// Модули
import * as metadata from './modules/metadata.js';
import * as statistics from './modules/statistics.js';
import * as graphs from './modules/graphs.js';
import * as flows from './modules/flows.js';
import * as architecture from './modules/architecture.js';
import * as summary from './modules/summary.js';
import * as packages from './modules/packages.js';
import * as converters from './modules/converters.js';
import * as utils from './modules/utils.js';
import * as vue from './modules/vue.js';

// ============================================================
// ЭКСПОРТ ФУНКЦИЙ (для использования в других модулях)
// ============================================================

// Основные репортеры
export { generateHTMLReport, escapeHtml } from './html-reporter.js';
export { generateInteractiveHTML } from './interactive-reporter.js';

// JSON репортеры
export {
  buildEnhancedPackageLockReport,
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  extractEntitiesFromFile,
} from './json-reporter.js';

// Компактный формат
export {
  compressReport,
  UniverseNavigator,
  loadUniverse,
  createNavigator,
  type CompactUniverse,
  type CompactPackage,
  type CompactFunction,
  type CompactStats,
} from './compressReport.js';

// ============================================================
// ЭКСПОРТ ТИПОВ
// ============================================================

// Из json-reporter.js
export type {
  EnhancedPackageLockReport,
  EnhancedPackageInfo,
  EnhancedEntityInfo,
} from './json-reporter.js';

// Из modules/types.js
export type {
  FunctionEntity,
  EnhancedFunctionInfo,
  EnhancedClassInfo,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  ModuleGraph,
  EntityGraph,
  FullAnalysis,
} from './modules/types.js';

// Из modules/statistics.js
export type { EntityStats, FileStats } from './modules/statistics.js';

// ============================================================
// ЭКСПОРТ МОДУЛЕЙ
// ============================================================

export {
  metadata,
  statistics,
  graphs,
  flows,
  architecture,
  summary,
  packages,
  converters,
  utils,
  vue,
};

// ============================================================
// ЭКСПОРТ ENV
// ============================================================

export { getRootPath, getPathSymbol } from './env.js';

// ============================================================
// ФУНКЦИЯ-ОБЕРТКА
// ============================================================

import type { CompactUniverse } from './compressReport.js';
import type { EnhancedPackageLockReport } from './json-reporter.js';

/**
 * Создает компактную версию отчета для быстрой навигации
 * @param report - Полный отчет EnhancedPackageLockReport
 * @returns Сжатая "Вселенная" в компактном формате
 */
export function createUniverse(report: EnhancedPackageLockReport): CompactUniverse {
  return compressReport(report);
}

// ============================================================
// КОНСТАНТЫ
// ============================================================

export const REPORTERS_VERSION = '3.0.1';
export const REPORTERS_NAME = '@newkind/ast-analyzer/reporters';

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ (используем импортированные переменные)
// ============================================================

export default {
  // Основные репортеры
  generateHTMLReport,
  generateInteractiveHTML,
  escapeHtml,

  // JSON репортеры
  buildEnhancedPackageLockReport,
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  extractEntitiesFromFile,

  // Компактный формат
  compressReport,
  createUniverse,
  UniverseNavigator,
  loadUniverse,
  createNavigator,

  // Модули
  metadata,
  statistics,
  graphs,
  flows,
  architecture,
  summary,
  packages,
  converters,
  utils,
  vue,

  // Константы
  REPORTERS_VERSION,
  REPORTERS_NAME,
};
