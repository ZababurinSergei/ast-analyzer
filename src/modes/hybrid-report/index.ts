// src/modes/hybrid-report/index.ts
import type { HybridReport, HybridModule, HybridFunction } from './types.js';
import { runHybridReport } from './cli.js';
import { buildHybridReport } from './builder.js';
import { analyzeModule } from './analyzer.js';
import { generateHybridDOT } from './generators/dot.js';
import { generateHybridHTML } from './generators/html.js';
import { generateHybridMarkdown } from './generators/markdown.js';

/**
 * Гибридный отчет: Модули + Функции
 *
 * Этот модуль анализирует проект и строит гибридный отчет,
 * который объединяет связи между модулями (компонентами/файлами)
 * и внутренние функции каждого модуля.
 *
 * Основные возможности:
 * - Построение дерева зависимостей модулей с уровнями
 * - Анализ функций внутри каждого модуля
 * - Выявление связей между функциями (кто кого вызывает)
 * - Определение источников экспорта (self, external, re-export)
 * - Визуализация в форматах: HTML, DOT, JSON, Markdown
 * - 3D координатная система с уровнями
 *
 * @module hybrid-report
 */

// ============================================
// ЭКСПОРТ ОСНОВНЫХ ФУНКЦИЙ
// ============================================

/**
 * Основная функция для запуска гибридного отчета из CLI
 * @param entryPoint - Точка входа (путь к файлу)
 * @param maxDepth - Максимальная глубина анализа
 * @param outputDir - Директория для сохранения отчетов
 * @returns Promise с объектом HybridReport
 */
export { runHybridReport } from './cli.js';

/**
 * Построение гибридного отчета
 * @param entryPoint - Точка входа
 * @param maxDepth - Максимальная глубина
 * @returns Объект HybridReport
 */
export { buildHybridReport } from './builder.js';

/**
 * Анализ отдельного модуля (файла)
 * @param filePath - Путь к файлу
 * @param level - Уровень модуля
 * @returns Объект HybridModule или null
 */
export { analyzeModule } from './analyzer.js';

// ============================================
// ЭКСПОРТ ГЕНЕРАТОРОВ ОТЧЕТОВ
// ============================================

/**
 * Генерация DOT графа для визуализации
 * @param report - Объект HybridReport
 * @returns Строка в формате DOT
 */
export { generateHybridDOT } from './generators/dot.js';

/**
 * Генерация HTML отчета с интерактивным графом
 * @param report - Объект HybridReport
 * @param maxDepth - Максимальная глубина для координатной системы
 * @returns Строка HTML
 */
export { generateHybridHTML } from './generators/html.js';

/**
 * Генерация Markdown отчета
 * @param report - Объект HybridReport
 * @returns Строка Markdown
 */
export { generateHybridMarkdown } from './generators/markdown.js';

// ============================================
// ЭКСПОРТ ТИПОВ
// ============================================

export type {
  /**
   * Информация о функции в модуле
   * @property name - Имя функции
   * @property line - Номер строки
   * @property isExported - Экспортируется ли функция
   * @property isAsync - Асинхронная ли функция
   * @property calls - Список вызываемых функций
   * @property calledBy - Список функций, которые вызывают эту
   * @property params - Параметры функции
   * @property returnType - Тип возвращаемого значения
   * @property body - Тело функции
   * @property startLine - Начальная строка
   * @property endLine - Конечная строка
   * @property exportSource - Источник экспорта: 'self' | 'external' | 're-export'
   * @property exportModule - Модуль, из которого экспортирована функция (для external)
   */
  HybridFunction,

  /**
   * Информация о модуле
   * @property path - Путь к файлу
   * @property name - Имя файла
   * @property type - Тип модуля: 'vue' | 'ts' | 'js' | 'tsx' | 'jsx'
   * @property exports - Список экспортов
   * @property imports - Список импортов
   * @property functions - Список функций
   * @property components - Список компонентов (для Vue/React)
   * @property composables - Список композаблов (для Vue)
   * @property dependencies - Зависимости модуля
   * @property dependents - Модули, зависящие от этого
   * @property level - Уровень модуля в дереве зависимостей
   */
  HybridModule,

  /**
   * Узел графа
   * @property id - Уникальный идентификатор
   * @property type - Тип узла
   * @property name - Имя узла
   * @property file - Путь к файлу
   * @property line - Номер строки
   * @property exports - Экспорты (для модуля)
   * @property imports - Импорты (для модуля)
   * @property functions - Функции (для модуля)
   * @property children - Дочерние узлы
   * @property calls - Вызовы (для функции)
   * @property calledBy - Кем вызвана (для функции)
   * @property metadata - Дополнительные метаданные
   * @property level - Уровень
   */
  HybridNode,

  /**
   * Полный отчет
   * @property root - Точка входа
   * @property modules - Список модулей
   * @property graph - Граф связей
   * @property stats - Статистика
   * @property cycles - Циклические зависимости
   * @property levels - Уровни модулей
   */
  HybridReport,
} from './types.js';

// ============================================
// КОНСТАНТЫ МОДУЛЯ
// ============================================

/**
 * Версия модуля
 */
export const HYBRID_REPORT_VERSION = '1.0.0';

/**
 * Имя модуля
 */
export const HYBRID_REPORT_NAME = '@newkind/ast-analyzer/hybrid-report';

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ ДЛЯ УДОБСТВА
// ============================================

/**
 * Объект со всеми экспортами для использования как default
 */
export default {
  // Основные функции
  runHybridReport,
  buildHybridReport,
  analyzeModule,

  // Генераторы
  generateHybridDOT,
  generateHybridHTML,
  generateHybridMarkdown,

  // Константы
  HYBRID_REPORT_VERSION,
  HYBRID_REPORT_NAME,
};

// ============================================
// ТИПЫ ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
// ============================================

/**
 * Опции для гибридного отчета
 */
export interface HybridReportOptions {
  /** Максимальная глубина анализа */
  maxDepth?: number;
  /** Выходная директория */
  outputDir?: string;
  /** Форматы отчетов */
  formats?: ('json' | 'html' | 'md' | 'dot')[];
  /** Включить внутренние графы файлов */
  includeInternalGraphs?: boolean;
  /** Включить 3D координатную систему */
  include3DCoordinates?: boolean;
  /** Минимальный уровень (по умолчанию 0) */
  minLevel?: number;
}

/**
 * Результат генерации отчета
 */
export interface HybridReportResult {
  /** Путь к JSON отчету */
  jsonPath?: string;
  /** Путь к HTML отчету */
  htmlPath?: string;
  /** Путь к Markdown отчету */
  mdPath?: string;
  /** Путь к DOT графу */
  dotPath?: string;
  /** Объект отчета */
  report: HybridReport;
  /** Статистика генерации */
  stats: {
    /** Время выполнения в мс */
    duration: number;
    /** Количество модулей */
    modulesCount: number;
    /** Количество функций */
    functionsCount: number;
    /** Количество циклических зависимостей */
    cyclesCount: number;
  };
}

// ============================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ОТЧЕТОМ
// ============================================

/**
 * Проверяет, есть ли в отчете циклические зависимости
 */
export function hasCyclicDependencies(report: HybridReport): boolean {
  return report.cycles && report.cycles.length > 0;
}

/**
 * Возвращает количество модулей на уровне
 */
export function getModulesByLevel(report: HybridReport, level: number): HybridModule[] {
  return report.modules.filter((m: HybridModule) => m.level === level);
}

/**
 * Возвращает все функции из всех модулей
 */
export function getAllFunctions(report: HybridReport): HybridFunction[] {
  const allFunctions: HybridFunction[] = [];
  for (const module of report.modules) {
    allFunctions.push(...module.functions);
  }
  return allFunctions;
}

/**
 * Возвращает функции с указанным источником экспорта
 */
export function getFunctionsByExportSource(
  report: HybridReport,
  source: 'self' | 'external' | 're-export'
): HybridFunction[] {
  const result: HybridFunction[] = [];
  for (const module of report.modules) {
    for (const func of module.functions) {
      if (func.exportSource === source) {
        result.push(func);
      }
    }
  }
  return result;
}

/**
 * Возвращает статистику по функциям
 */
export function getFunctionsStats(report: HybridReport): {
  total: number;
  self: number;
  external: number;
  reExport: number;
  exported: number;
  async: number;
} {
  const allFunctions = getAllFunctions(report);
  return {
    total: allFunctions.length,
    self: allFunctions.filter((f: HybridFunction) => f.exportSource === 'self').length,
    external: allFunctions.filter((f: HybridFunction) => f.exportSource === 'external').length,
    reExport: allFunctions.filter((f: HybridFunction) => f.exportSource === 're-export').length,
    exported: allFunctions.filter((f: HybridFunction) => f.isExported).length,
    async: allFunctions.filter((f: HybridFunction) => f.isAsync).length,
  };
}
