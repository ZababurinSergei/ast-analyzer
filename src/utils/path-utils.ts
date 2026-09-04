// packages/ast-analyzer/src/utils/path-utils.ts
// ОБНОВЛЕННЫЙ ФАЙЛ - Удалены неиспользуемые функции

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
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  normalizePathForDisplay,
  getFileNameForDisplay,
  normalizePathForOS,
  normalizeGraphPaths,
  resolveAbsolutePath,
  validateAndResolvePath,
};
