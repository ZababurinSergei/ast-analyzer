// packages/ast-analyzer/src/utils/path-utils.ts
// ОБНОВЛЕННЫЙ ФАЙЛ - Добавлено сжатие путей, индексация и кэширование

import path from 'path';
import fs from 'fs';

/**
 * Нормализует путь для отображения в отчетах
 * Заменяет обратные слеши на прямые и делает путь относительным от cwd
 */
export function normalizePathForDisplay(
  filePath: string,
  rootDir?: string,
  maxLength?: number
): string {
  if (!filePath) return '';

  let normalized = filePath.replace(/\\/g, '/');

  const cwd = rootDir || process.cwd();
  const relativePath = path.relative(cwd, normalized).replace(/\\/g, '/');

  if (relativePath && !relativePath.startsWith('..')) {
    normalized = relativePath;
  }

  if (maxLength && normalized.length > maxLength) {
    const parts = normalized.split('/');
    if (parts.length > 3) {
      const first = parts[0] || '';
      const lastTwo = parts.slice(-2);
      return first + '/.../' + lastTwo.join('/');
    }
  }

  return normalized;
}

/**
 * Получает имя файла для отображения
 */
export function getFileNameForDisplay(filePath: string): string {
  if (!filePath) return '';
  const normalized = normalizePathForDisplay(filePath);
  return path.basename(normalized);
}

/**
 * Нормализует путь для ОС (заменяет обратные слеши на прямые)
 */
export function normalizePathForOS(filePath: string): string {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/');
}

/**
 * Нормализует пути в графе для отображения
 */
export function normalizeGraphPaths(graphData: {
  rootKey: string;
  graph: Record<string, string[]>;
}): {
  rootKey: string;
  graph: Record<string, string[]>;
} {
  if (!graphData) return { rootKey: '', graph: {} };

  const rootKey = normalizePathForDisplay(graphData.rootKey);
  const graph: Record<string, string[]> = {};

  for (const [key, deps] of Object.entries(graphData.graph)) {
    const normalizedKey = normalizePathForDisplay(key);
    graph[normalizedKey] = deps.map(d => normalizePathForDisplay(d));
  }

  return { rootKey, graph };
}

/**
 * Разрешает абсолютный путь
 */
export function resolveAbsolutePath(filePath: string, baseDir?: string): string {
  if (!filePath) return '';
  if (path.isAbsolute(filePath)) {
    return normalizePathForOS(filePath);
  }
  const base = baseDir || process.cwd();
  return normalizePathForOS(path.resolve(base, filePath));
}

/**
 * Проверяет существование файла и возвращает абсолютный путь
 */
export function validateAndResolvePath(filePath: string, baseDir?: string): string | null {
  const absolutePath = resolveAbsolutePath(filePath, baseDir);
  try {
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  } catch {
    // Игнорируем ошибки доступа
  }
  return null;
}

// ============================================================
// НОВОЕ: СЖАТИЕ ПУТЕЙ, ИНДЕКСАЦИЯ И КЭШИРОВАНИЕ
// ============================================================

/**
 * Кэш для сжатых путей
 * Используется для быстрого получения ранее сжатых путей
 */
const pathCache = new Map<string, string>();

/**
 * Индекс путей для компактного хранения
 * Каждому уникальному пути соответствует числовой индекс
 */
const pathIndex = new Map<string, number>();

/**
 * Сжимает путь для компактного хранения в отчетах
 * @param filePath - Исходный путь
 * @param maxLength - Максимальная длина (по умолчанию 30 символов)
 * @returns Сжатый путь
 *
 * @example
 * compressPath('/home/user/project/src/core/ast-parser.ts')
 * // => '/home/.../core/ast-parser.ts'
 */
export function compressPath(filePath: string, maxLength: number = 30): string {
  if (!filePath) return '';

  // Проверяем кэш
  if (pathCache.has(filePath)) {
    return pathCache.get(filePath)!;
  }

  let normalized = normalizePathForDisplay(filePath);

  // Сокращаем длинные пути
  if (normalized.length > maxLength) {
    const parts = normalized.split('/');
    if (parts.length > 3) {
      const first = parts[0] || '';
      const lastTwo = parts.slice(-2);
      const compressed = first + '/.../' + lastTwo.join('/');
      pathCache.set(filePath, compressed);
      return compressed;
    }
  }

  pathCache.set(filePath, normalized);
  return normalized;
}

/**
 * Преобразует путь в числовой индекс для компактного хранения
 * @param filePath - Путь для индексации
 * @returns Числовой индекс пути
 *
 * @example
 * pathToIndex('/home/user/project/src/index.ts')
 * // => 0
 * pathToIndex('/home/user/project/src/core/ast-parser.ts')
 * // => 1
 */
export function pathToIndex(filePath: string): number {
  if (!filePath) return -1;

  if (pathIndex.has(filePath)) {
    return pathIndex.get(filePath)!;
  }

  const idx = pathIndex.size;
  pathIndex.set(filePath, idx);
  return idx;
}

/**
 * Получает путь по числовому индексу
 * @param index - Числовой индекс
 * @returns Путь или null если индекс не найден
 */
export function indexToPath(index: number): string | null {
  for (const [path, idx] of pathIndex) {
    if (idx === index) {
      return path;
    }
  }
  return null;
}

/**
 * Получает карту индексов путей
 * @returns Map с путями и их индексами
 */
export function getPathIndexMap(): Map<string, number> {
  return new Map(pathIndex);
}

/**
 * Получает количество уникальных путей в индексе
 */
export function getPathIndexCount(): number {
  return pathIndex.size;
}

/**
 * Очищает кэш путей и индекс
 */
export function clearPathCache(): void {
  pathCache.clear();
  pathIndex.clear();
}

/**
 * Проверяет, есть ли путь в кэше
 */
export function isPathCached(filePath: string): boolean {
  return pathCache.has(filePath);
}

/**
 * Получает статистику кэша путей
 */
export function getPathCacheStats(): {
  cacheSize: number;
  indexSize: number;
  totalUniquePaths: number;
} {
  return {
    cacheSize: pathCache.size,
    indexSize: pathIndex.size,
    totalUniquePaths: pathIndex.size,
  };
}

/**
 * Массовое сжатие путей
 * @param filePaths - Массив путей для сжатия
 * @param maxLength - Максимальная длина
 * @returns Массив сжатых путей
 */
export function compressPaths(filePaths: string[], maxLength: number = 30): string[] {
  return filePaths.map(p => compressPath(p, maxLength));
}

/**
 * Массовое индексирование путей
 * @param filePaths - Массив путей для индексирования
 * @returns Массив числовых индексов
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
  for (const [original, compressed] of pathCache) {
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
        pathCache.set(original, compressedPath);
        return original;
      }
    }
  }

  // Прямой поиск в индексе
  for (const [original, compressed] of pathCache) {
    if (compressed === compressedPath) {
      return original;
    }
  }

  return null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  // Существующие функции
  normalizePathForDisplay,
  getFileNameForDisplay,
  normalizePathForOS,
  normalizeGraphPaths,
  resolveAbsolutePath,
  validateAndResolvePath,

  // Новые функции
  compressPath,
  pathToIndex,
  indexToPath,
  getPathIndexMap,
  getPathIndexCount,
  clearPathCache,
  isPathCached,
  getPathCacheStats,
  compressPaths,
  pathsToIndices,
  decompressPath,
};
