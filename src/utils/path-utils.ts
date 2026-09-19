// src/utils/path-utils.ts - ОБНОВЛЕННЫЙ ФАЙЛ
/**
 * Фасад для утилит работы с путями
 * Все функции делегируют внутреннему PathUtils
 * API полностью сохранен для обратной совместимости
 */

import { pathUtils } from './internal/PathUtils.js';

// ============================================
// ОСНОВНЫЕ ЭКСПОРТЫ (API сохранен)
// ============================================

export function normalizePathForDisplay(
  filePath: string,
  rootDir?: string,
  maxLength?: number
): string {
  return pathUtils.normalizeForDisplay(filePath, rootDir, maxLength);
}

export function getFileNameForDisplay(filePath: string): string {
  return pathUtils.getFileName(filePath);
}

export function normalizePathForOS(filePath: string): string {
  return pathUtils.normalizeForOS(filePath);
}

export function normalizeGraphPaths(graphData: {
  rootKey: string;
  graph: Record<string, string[]>;
}): {
  rootKey: string;
  graph: Record<string, string[]>;
} {
  return pathUtils.normalizeGraph(graphData);
}

export function resolveAbsolutePath(filePath: string, baseDir?: string): string {
  return pathUtils.resolveAbsolute(filePath, baseDir);
}

export function validateAndResolvePath(filePath: string, baseDir?: string): string | null {
  return pathUtils.validateAndResolve(filePath, baseDir);
}

// ============================================
// НОВЫЕ ФУНКЦИИ (добавлены для полноты)
// ============================================

export function compressPath(filePath: string, maxLength: number = 30): string {
  return pathUtils.compress(filePath, maxLength);
}

export function pathToIndex(filePath: string): number {
  return pathUtils.toIndex(filePath);
}

export function indexToPath(index: number): string | null {
  return pathUtils.fromIndex(index);
}

export function clearPathCache(): void {
  pathUtils.clearCache();
}

export function getPathCacheStats(): { cacheSize: number; indexSize: number } {
  return pathUtils.getCacheStats();
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
// ============================================

/**
 * Массовое сжатие путей
 */
export function compressPaths(filePaths: string[], maxLength: number = 30): string[] {
  return filePaths.map(p => compressPath(p, maxLength));
}

/**
 * Массовое индексирование путей
 */
export function pathsToIndices(filePaths: string[]): number[] {
  return filePaths.map(p => pathToIndex(p));
}

/**
 * Декомпрессия пути (восстановление из сжатого вида)
 * @param compressedPath - Сжатый путь
 * @param originalPaths - Список оригинальных путей для поиска
 * @returns Оригинальный путь или null
 */
export function decompressPath(compressedPath: string, originalPaths: string[]): string | null {
  if (!compressedPath || !originalPaths) return null;

  // Если в кэше есть соответствие
  for (const [original, compressed] of pathUtils['cache']) {
    if (compressed === compressedPath) {
      return original;
    }
  }

  // Пробуем найти по паттерну
  if (compressedPath.includes('/.../')) {
    const parts = compressedPath.split('/.../');
    const prefix = parts[0] || '';
    const suffix = parts[1] || '';

    for (const original of originalPaths) {
      const normalized = normalizePathForDisplay(original);
      if (normalized.startsWith(prefix) && normalized.endsWith(suffix)) {
        return original;
      }
    }
  }

  return null;
}

/**
 * Получает карту индексов путей
 * @returns Map с путями и их индексами
 */
export function getPathIndexMap(): Map<string, number> {
  const map = new Map<string, number>();
  const index = pathUtils['index'];
  for (const [path, idx] of index) {
    map.set(path, idx);
  }
  return map;
}

/**
 * Получает количество уникальных путей в индексе
 */
export function getPathIndexCount(): number {
  return pathUtils['index'].size;
}

/**
 * Проверяет, есть ли путь в кэше
 */
export function isPathCached(filePath: string): boolean {
  return pathUtils['cache'].has(filePath);
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  normalizePathForDisplay,
  getFileNameForDisplay,
  normalizePathForOS,
  normalizeGraphPaths,
  resolveAbsolutePath,
  validateAndResolvePath,
  compressPath,
  pathToIndex,
  indexToPath,
  clearPathCache,
  getPathCacheStats,
  compressPaths,
  pathsToIndices,
  decompressPath,
  getPathIndexMap,
  getPathIndexCount,
  isPathCached,
};
