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
  saveOptimizedPackageLockReport,
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

// Ультра-компактный формат (НОВОЕ!)
import { generateUltraCompactReport } from './compact-entity-reporter.js';

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
// ЭКСПОРТ ФУНКЦИЙ
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
  saveOptimizedPackageLockReport,
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

// Ультра-компактный формат (НОВОЕ!)
export { generateUltraCompactReport } from './compact-entity-reporter.js';

// ============================================================
// ЭКСПОРТ ТИПОВ (inline re-export без импорта)
// ============================================================

// ✅ Из json-reporter.js
export type {
  EnhancedPackageLockReport,
  EnhancedPackageInfo,
  EnhancedEntityInfo,
} from './json-reporter.js';

// ✅ Из modules/types.js - ТОЛЬКО СУЩЕСТВУЮЩИЕ ТИПЫ
export type {
  ModuleNode,
  ModuleEdge,
  EntityNode,
  EntityEdge,
  EntityStats,
  FileStats,
  FunctionEntity,
  EnhancedFunctionInfo,
  EnhancedClassInfo,
  EnhancedConstantInfo,
  EnhancedVariableInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  ModuleGraph,
  EntityGraph,
  PackageLockImportInfo,
  GraphData,
  EntitiesResult,
} from './modules/types.js';

// ✅ Из ../types.js
export type {
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  OptimizedReportOptions,
  ExtendedFunctionInfo,
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
} from '../types.js';

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
import type { EntitiesResult } from '../types.js';

/**
 * Создает компактную версию отчета для быстрой навигации
 * @param report - Полный отчет EnhancedPackageLockReport
 * @returns Сжатая "Вселенная" в компактном формате
 */
export function createUniverse(report: EnhancedPackageLockReport): CompactUniverse {
  return compressReport(report);
}

/**
 * Создает ультра-компактную версию отчета с удалением дублей (НОВОЕ!)
 * @param entitiesMap - Карта сущностей
 * @param outputPath - Путь для сохранения
 * @param options - Опции генерации
 * @returns Объект ультра-компактного отчета
 */
export function createUltraUniverse(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath?: string,
  options?: {
    useBitFlags?: boolean;
    useDictionaries?: boolean;
    readableKeys?: boolean;
    useTemplates?: boolean;
    maxDepth?: number;
  }
): any {
  // Используем generateUltraCompactReport с передачей опций
  // Функция возвращает отчет и (опционально) сохраняет его
  const report = generateUltraCompactReport(entitiesMap, outputPath || './ultra-universe.json', {
    useBitFlags: options?.useBitFlags !== false,
    useDictionaries: options?.useDictionaries !== false,
    readableKeys: options?.readableKeys !== false,
    useTemplates: options?.useTemplates !== false,
    maxDepth: options?.maxDepth || 10,
  });

  return report;
}

// ============================================================
// КОНСТАНТЫ
// ============================================================

export const REPORTERS_VERSION = '4.0.0';
export const REPORTERS_NAME = 'reporters';

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
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
  saveOptimizedPackageLockReport,
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

  // Ультра-компактный формат (НОВОЕ!)
  generateUltraCompactReport,
  createUltraUniverse,

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
