// src/utils/path-utils.ts
import path from 'path';

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
 * Получает имя файла без расширения
 */
export function getFileNameWithoutExt(filePath: string): string {
  if (!filePath) return '';
  const normalized = normalizePathForDisplay(filePath);
  const ext = path.extname(normalized);
  return path.basename(normalized, ext);
}

/**
 * Нормализует путь для ОС (заменяет обратные слеши на прямые)
 */
export function normalizePathForOS(filePath: string): string {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/');
}

/**
 * Проверяет, является ли путь абсолютным
 */
export function isAbsolutePath(filePath: string): boolean {
  if (!filePath) return false;
  return path.isAbsolute(filePath);
}

/**
 * Сокращает путь для отображения
 */
export function shortenPath(filePath: string, maxLength: number = 60): string {
  if (!filePath) return '';
  const relative = normalizePathForDisplay(filePath);
  if (relative.length <= maxLength) return relative;

  const parts = relative.split('/');
  if (parts.length <= 2) return relative;

  const first = parts[0] || '';
  const lastTwo = parts.slice(-2);
  return first + '/.../' + lastTwo.join('/');
}

/**
 * Получает относительный путь для отображения
 */
export function getRelativePathForDisplay(from: string, to: string): string {
  if (!from || !to) return '';
  const relative = path.relative(path.dirname(from), to).replace(/\\/g, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/**
 * Нормализует корневой ключ для отображения
 */
export function normalizeRootKey(rootKey: string): string {
  if (!rootKey) return '';
  return normalizePathForDisplay(rootKey);
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

  const rootKey = normalizeRootKey(graphData.rootKey);
  const graph: Record<string, string[]> = {};

  for (const [key, deps] of Object.entries(graphData.graph)) {
    const normalizedKey = normalizePathForDisplay(key);
    graph[normalizedKey] = deps.map(d => normalizePathForDisplay(d));
  }

  return { rootKey, graph };
}
