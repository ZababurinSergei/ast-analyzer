// src/reporters/modules/statistics.ts
// Статистика по сущностям и файлам

import { EnhancedPackageInfo } from './types.js';

export interface EntityStats {
  totalFunctions: number;
  totalConstants: number;
  totalVariables: number;
  totalInterfaces: number;
  totalTypes: number;
  totalClasses: number;
  totalCalls: number;
  totalExportedFunctions: number;
  totalAsyncFunctions: number;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  totalLines: number;
}

export function calculateEntityStats(
  packages: Record<string, EnhancedPackageInfo>,
  callGraph: Record<string, string[]>
): EntityStats {
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
    totalFunctions += pkg.entities?.functions?.length || 0;
    totalConstants += pkg.entities?.constants?.length || 0;
    totalVariables += pkg.entities?.variables?.length || 0;
    totalInterfaces += pkg.entities?.interfaces?.length || 0;
    totalTypes += pkg.entities?.types?.length || 0;
    totalClasses += pkg.entities?.classes?.length || 0;

    for (const func of pkg.entities?.functions || []) {
      if (func.isExported) totalExportedFunctions++;
      if (func.isAsync) totalAsyncFunctions++;
    }
  }

  for (const calls of Object.values(callGraph)) {
    totalCalls += calls.length;
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

export function calculateFileStats(packages: Record<string, EnhancedPackageInfo>): FileStats {
  let totalFiles = Object.keys(packages).length;
  let totalSize = 0;
  let totalLines = 0;

  for (const pkg of Object.values(packages)) {
    totalSize += pkg.fileStats?.size || 0;
    totalLines += pkg.fileStats?.lines || 0;
  }

  return {
    totalFiles,
    totalSize,
    totalLines,
  };
}
