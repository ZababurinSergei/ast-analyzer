// packages/ast-analyzer/src/utils/path-utils.ts
// ОБНОВЛЕННЫЙ ФАЙЛ - Полный текст

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

// ============================================================
// 🔥 НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ПУТЯМИ
// ============================================================

/**
 * Разрешает абсолютный путь
 * @param filePath - Путь к файлу (может быть относительным)
 * @param baseDir - Базовая директория для разрешения (по умолчанию process.cwd())
 * @returns Абсолютный путь в нормализованном виде
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
 * @param filePath - Путь к файлу
 * @param baseDir - Базовая директория
 * @returns Абсолютный путь или null, если файл не существует
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

/**
 * Находит корень проекта (директорию с package.json)
 * @param startDir - Директория для начала поиска
 * @returns Путь к корню проекта или null
 */
export function findProjectRoot(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

/**
 * Находит корень монорепозитория (директорию с lerna.json или pnpm-workspace.yaml)
 * @param startDir - Директория для начала поиска
 * @returns Путь к корню монорепозитория или null
 */
export function findMonorepoRoot(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const lernaPath = path.join(currentDir, 'lerna.json');
    const pnpmWorkspacePath = path.join(currentDir, 'pnpm-workspace.yaml');
    const rushJsonPath = path.join(currentDir, 'rush.json');

    if (
      fs.existsSync(lernaPath) ||
      fs.existsSync(pnpmWorkspacePath) ||
      fs.existsSync(rushJsonPath)
    ) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

/**
 * Проверяет, является ли путь частью node_modules
 */
export function isInNodeModules(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = normalizePathForOS(filePath);
  return normalized.includes('/node_modules/') || normalized.includes('\\node_modules\\');
}

/**
 * Проверяет, является ли файл TypeScript файлом
 */
export function isTypeScriptFile(filePath: string): boolean {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.tsx', '.mts', '.cts'].includes(ext);
}

/**
 * Проверяет, является ли файл JavaScript файлом
 */
export function isJavaScriptFile(filePath: string): boolean {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.jsx', '.mjs', '.cjs'].includes(ext);
}

/**
 * Проверяет, является ли файл Vue файлом
 */
export function isVueFile(filePath: string): boolean {
  if (!filePath) return false;
  return path.extname(filePath).toLowerCase() === '.vue';
}

/**
 * Получает расширение файла без точки
 */
export function getExtensionWithoutDot(filePath: string): string {
  if (!filePath) return '';
  const ext = path.extname(filePath);
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

/**
 * Проверяет, является ли путь директорией
 */
export function isDirectory(filePath: string): boolean {
  if (!filePath) return false;
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Проверяет, является ли путь файлом
 */
export function isFile(filePath: string): boolean {
  if (!filePath) return false;
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Получает все файлы в директории рекурсивно с фильтрацией
 */
export function getAllFiles(
  dir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'],
  excludePatterns: string[] = ['node_modules', 'dist', 'build', 'coverage']
): string[] {
  const files: string[] = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);

      // Проверяем исключения
      if (excludePatterns.some(pattern => fullPath.includes(pattern))) {
        continue;
      }

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          files.push(...getAllFiles(fullPath, extensions, excludePatterns));
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      } catch {
        // Игнорируем ошибки доступа
      }
    }
  } catch {
    // Игнорируем ошибки чтения директории
  }

  return files;
}

/**
 * Создает относительный путь от корня проекта
 */
export function getRelativeFromProject(filePath: string): string {
  if (!filePath) return '';
  const root = findProjectRoot(filePath) || process.cwd();
  return normalizePathForOS(path.relative(root, filePath));
}

/**
 * Создает безопасное имя файла для использования в отчетах
 */
export function getSafeFileName(filePath: string): string {
  if (!filePath) return 'unknown';
  const name = path.basename(filePath);
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/**
 * Объединяет пути с безопасной нормализацией
 */
export function joinPaths(...paths: string[]): string {
  const joined = path.join(...paths);
  return normalizePathForOS(joined);
}

/**
 * Получает родительскую директорию на указанное количество уровней вверх
 */
export function getParentDir(filePath: string, levels: number = 1): string {
  if (!filePath || levels <= 0) return filePath;
  let current = path.dirname(filePath);
  for (let i = 1; i < levels; i++) {
    current = path.dirname(current);
  }
  return normalizePathForOS(current);
}

/**
 * Проверяет, является ли путь поддиректорией другой
 */
export function isSubdirectory(parent: string, child: string): boolean {
  if (!parent || !child) return false;
  const normalizedParent = normalizePathForOS(path.resolve(parent));
  const normalizedChild = normalizePathForOS(path.resolve(child));
  return normalizedChild.startsWith(normalizedParent + '/');
}

/**
 * Получает общий префикс для нескольких путей
 */
export function getCommonPrefix(paths: string[]): string {
  if (!paths || paths.length === 0) return '';
  if (paths.length === 1) return paths[0] || '';

  const normalized = paths.map(p => normalizePathForOS(p));
  const parts = normalized.map(p => p.split('/'));

  const common: string[] = [];
  const minLength = Math.min(...parts.map(p => p.length));

  for (let i = 0; i < minLength; i++) {
    const part = parts[0]?.[i];
    if (parts.every(p => p[i] === part)) {
      if (part) {
        common.push(part);
      }
    } else {
      break;
    }
  }

  return common.join('/');
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  normalizePathForDisplay,
  getFileNameForDisplay,
  getFileNameWithoutExt,
  normalizePathForOS,
  isAbsolutePath,
  shortenPath,
  getRelativePathForDisplay,
  normalizeRootKey,
  normalizeGraphPaths,
  resolveAbsolutePath,
  validateAndResolvePath,
  findProjectRoot,
  findMonorepoRoot,
  isInNodeModules,
  isTypeScriptFile,
  isJavaScriptFile,
  isVueFile,
  getExtensionWithoutDot,
  isDirectory,
  isFile,
  getAllFiles,
  getRelativeFromProject,
  getSafeFileName,
  joinPaths,
  getParentDir,
  isSubdirectory,
  getCommonPrefix,
};
