// src/reporters/modules/statistics.ts

import type { EnhancedPackageInfo } from '../../types.js';

/**
 * Вычисляет статистику по сущностям
 */
export function calculateEntityStats(
  packages: Record<string, EnhancedPackageInfo>,
  _callGraph: Record<string, string[]> // ✅ Добавляем префикс _ для неиспользуемого параметра
): {
  totalFunctions: number;
  totalConstants: number;
  totalVariables: number;
  totalInterfaces: number;
  totalTypes: number;
  totalClasses: number;
  totalCalls: number;
  totalExportedFunctions: number;
  totalAsyncFunctions: number;
} {
  let totalFunctions = 0;
  let totalConstants = 0;
  let totalVariables = 0;
  let totalInterfaces = 0;
  let totalTypes = 0;
  let totalClasses = 0;
  let totalCalls = 0;
  let totalExportedFunctions = 0;
  let totalAsyncFunctions = 0;

  for (const pkg of Object.values(packages)) {
    if (!pkg) continue;

    // Функции
    const functions = pkg.entities?.functions || [];
    totalFunctions += functions.length;

    for (const func of functions) {
      if (func.calls) {
        totalCalls += func.calls.length;
      }
      if (func.isExported) {
        totalExportedFunctions++;
      }
      if (func.isAsync) {
        totalAsyncFunctions++;
      }
    }

    // Константы
    totalConstants += pkg.entities?.constants?.length || 0;

    // Переменные
    totalVariables += pkg.entities?.variables?.length || 0;

    // Интерфейсы
    totalInterfaces += pkg.entities?.interfaces?.length || 0;

    // Типы
    totalTypes += pkg.entities?.types?.length || 0;

    // Классы
    totalClasses += pkg.entities?.classes?.length || 0;
  }

  return {
    totalFunctions,
    totalConstants,
    totalVariables,
    totalInterfaces,
    totalTypes,
    totalClasses,
    totalCalls,
    totalExportedFunctions,
    totalAsyncFunctions,
  };
}

/**
 * Вычисляет статистику по файлам
 */
export function calculateFileStats(packages: Record<string, EnhancedPackageInfo>): {
  totalFiles: number;
  totalSize: number;
  totalLines: number;
} {
  let totalFiles = 0;
  let totalSize = 0;
  let totalLines = 0;

  for (const pkg of Object.values(packages)) {
    if (!pkg) continue;
    totalFiles++;
    totalSize += pkg.fileStats?.size || 0;
    totalLines += pkg.fileStats?.lines || 0;
  }

  return {
    totalFiles,
    totalSize,
    totalLines,
  };
}

/**
 * Экспорт по умолчанию
 */
export default {
  calculateEntityStats,
  calculateFileStats,
};
