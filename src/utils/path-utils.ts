// src/utils/path-utils.ts
import path from 'path';

/**
 * Нормализует путь для отображения в отчетах (всегда с прямыми слешами)
 * @param filePath - Путь для нормализации
 * @param baseDir - Базовая директория для вычисления относительного пути (по умолчанию process.cwd())
 * @param options - Опции нормализации
 * @returns Нормализованный путь с прямыми слешами
 */
export function normalizePathForDisplay(
  filePath: string,
  baseDir: string = process.cwd(),
  options: { absolute?: boolean; relative?: boolean } = {}
): string {
  if (!filePath) return '';

  let normalized = filePath;

  // Если путь абсолютный и нужно сделать относительным
  if (path.isAbsolute(normalized) && options.relative !== false) {
    try {
      normalized = path.relative(baseDir, normalized);
    } catch {
      // Если не удалось сделать относительным, оставляем как есть
    }
  }

  // Заменяем обратные слеши на прямые (Windows → Unix)
  normalized = normalized.replace(/\\/g, '/');

  // Убираем избыточные точки в начале пути (если они есть)
  // Например: "../../../src/index.ts" → "src/index.ts"
  if (normalized.startsWith('../')) {
    const parts = normalized.split('/');
    const filtered = parts.filter(p => p !== '..' && p !== '.');
    if (filtered.length > 0) {
      const candidate = filtered.join('/');
      if (candidate && candidate.length > 0) {
        normalized = candidate;
      }
    }
  }

  return normalized;
}

/**
 * Получает имя файла из пути с нормализацией
 * @param filePath - Путь к файлу
 * @returns Имя файла с расширением
 */
export function getFileNameForDisplay(filePath: string): string {
  const normalized = normalizePathForDisplay(filePath);
  return path.basename(normalized);
}

/**
 * Получает имя файла без расширения
 * @param filePath - Путь к файлу
 * @returns Имя файла без расширения
 */
export function getFileNameWithoutExt(filePath: string): string {
  const normalized = normalizePathForDisplay(filePath);
  return path.basename(normalized, path.extname(normalized));
}

/**
 * Нормализует корневой ключ графа для отображения
 * @param rootKey - Ключ корневого узла графа
 * @param baseDir - Базовая директория
 * @returns Нормализованный ключ
 */
export function normalizeRootKey(rootKey: string, baseDir: string = process.cwd()): string {
  return normalizePathForDisplay(rootKey, baseDir, { relative: true });
}

/**
 * Нормализует все пути в графе зависимостей
 * @param graph - Граф зависимостей { rootKey: string; graph: Record<string, string[]> }
 * @param baseDir - Базовая директория
 * @returns Нормализованный граф
 */
export function normalizeGraphPaths<T extends { rootKey: string; graph: Record<string, string[]> }>(
  graph: T,
  baseDir: string = process.cwd()
): T {
  return {
    ...graph,
    rootKey: normalizeRootKey(graph.rootKey, baseDir),
    graph: Object.fromEntries(
      Object.entries(graph.graph).map(([key, deps]) => [
        normalizePathForDisplay(key, baseDir, { relative: true }),
        deps.map(d => normalizePathForDisplay(d, baseDir, { relative: true })),
      ])
    ),
  };
}

/**
 * Проверяет, является ли путь абсолютным (кросс-платформенно)
 * @param filePath - Путь для проверки
 * @returns true если путь абсолютный
 */
export function isAbsolutePath(filePath: string): boolean {
  // Проверяем Windows (C:\), Unix (/home) и сетевые пути (\\server\share)
  return (
    /^[a-zA-Z]:\\/.test(filePath) || /^\/[^/]/.test(filePath) || /^\\\\[^\\]+\\/.test(filePath)
  );
}

/**
 * Сокращает длинный путь для отображения в отчетах
 * @param filePath - Путь к файлу
 * @param maxLength - Максимальная длина (по умолчанию 80 символов)
 * @returns Сокращенный путь
 */
export function shortenPath(filePath: string, maxLength: number = 80): string {
  const normalized = normalizePathForDisplay(filePath);
  if (normalized.length <= maxLength) return normalized;

  const parts = normalized.split('/');
  if (parts.length <= 2) return normalized;

  // ✅ Упрощенная логика: берем первый и последние 2 элемента
  // Например: /home/user/project/src/very/long/nested/directory/structure/file.ts
  // → /home/.../directory/structure/file.ts
  let prefix = '';
  let startIndex = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '..' || parts[i] === '.') {
      prefix += parts[i] + '/';
      startIndex = i + 1;
    } else {
      break;
    }
  }

  const remaining = parts.slice(startIndex);
  if (remaining.length <= 2) return normalized;

  // ✅ Используем все части напрямую
  const first = remaining[0] || '';
  const lastTwo = remaining.slice(-2);

  // Формируем сокращенный путь
  let result = prefix;
  if (first) {
    result += first + '/.../';
  }
  result += lastTwo.join('/');

  return result;
}

/**
 * Получает относительный путь от одной директории к другой
 * @param from - Откуда
 * @param to - Куда
 * @returns Относительный путь с прямыми слешами
 */
export function getRelativePathForDisplay(from: string, to: string): string {
  const relative = path.relative(path.dirname(from), to);
  return normalizePathForDisplay(relative);
}

// ============================================
// 🆕 НОВЫЕ ФУНКЦИИ ДЛЯ КРОСС-ПЛАТФОРМЕННОСТИ
// ============================================

/**
 * Нормализует путь для текущей ОС (Windows/Linux/macOS)
 * Всегда использует прямые слеши для совместимости
 * @param filePath - Путь для нормализации
 * @returns Нормализованный путь с прямыми слешами
 */
export function normalizePathForOS(filePath: string): string {
  if (!filePath) return '';
  // Заменяем обратные слеши на прямые (Windows → Unix)
  return filePath.replace(/\\/g, '/');
}

/**
 * Проверяет, существует ли файл с учетом регистра (для Linux)
 * @param filePath - Путь к файлу
 * @returns true если файл существует
 */
export function fileExistsCaseSensitive(filePath: string): boolean {
  if (!filePath) return false;

  // Нормализуем путь
  const normalizedPath = normalizePathForOS(filePath);

  if (!fs.existsSync(normalizedPath)) return false;

  // Для Windows/macOS - регистр не важен
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return true;
  }

  // Для Linux - проверяем регистр
  const dir = path.dirname(normalizedPath);
  const base = path.basename(normalizedPath);
  if (!fs.existsSync(dir)) return false;

  try {
    const files = fs.readdirSync(dir);
    return files.includes(base);
  } catch {
    return false;
  }
}

/**
 * Получает корректный путь для импорта (с правильными слешами)
 * @param from - Путь к файлу, из которого делается импорт
 * @param to - Путь к целевому файлу
 * @returns Относительный путь для импорта
 */
export function getImportPath(from: string, to: string): string {
  // Нормализуем пути
  const normalizedFrom = normalizePathForOS(from);
  const normalizedTo = normalizePathForOS(to);

  // Получаем относительный путь
  let relative = path.relative(path.dirname(normalizedFrom), normalizedTo);

  // Всегда используем прямые слеши
  relative = relative.replace(/\\/g, '/');

  // Добавляем ./ для относительных путей
  if (!relative.startsWith('.') && !relative.startsWith('@') && !path.isAbsolute(relative)) {
    relative = './' + relative;
  }

  return relative;
}

/**
 * Проверяет, является ли путь валидным для Windows
 * @param filePath - Путь для проверки
 * @returns true если путь валиден для Windows
 */
export function isValidWindowsPath(filePath: string): boolean {
  if (!filePath) return false;

  // Проверяем длину пути (Windows ограничение 260 символов)
  if (filePath.length > 260) return false;

  // Проверяем запрещенные символы в Windows
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(filePath)) return false;

  // Проверяем зарезервированные имена
  const reservedNames = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ];

  const baseName = path.basename(filePath).toUpperCase();
  if (reservedNames.includes(baseName)) return false;

  return true;
}

/**
 * Преобразует путь для Windows (если нужно)
 * @param filePath - Путь для преобразования
 * @returns Путь, совместимый с Windows
 */
export function toWindowsPath(filePath: string): string {
  if (!filePath) return '';

  // Если уже Windows-путь, возвращаем как есть
  if (/^[a-zA-Z]:\\/.test(filePath)) return filePath;

  // Если Unix-путь, конвертируем в Windows
  if (filePath.startsWith('/')) {
    // Простая конвертация: заменяем / на \
    return filePath.replace(/\//g, '\\');
  }

  // Если относительный путь, просто заменяем слеши
  return filePath.replace(/\//g, '\\');
}

/**
 * Преобразует путь для Unix (Linux/macOS)
 * @param filePath - Путь для преобразования
 * @returns Путь, совместимый с Unix
 */
export function toUnixPath(filePath: string): string {
  if (!filePath) return '';

  // Заменяем обратные слеши на прямые
  return filePath.replace(/\\/g, '/');
}

// Импортируем fs для fileExistsCaseSensitive
import fs from 'fs';

// Экспорт по умолчанию
export default {
  normalizePathForDisplay,
  getFileNameForDisplay,
  getFileNameWithoutExt,
  normalizeRootKey,
  normalizeGraphPaths,
  isAbsolutePath,
  shortenPath,
  getRelativePathForDisplay,
  // Новые функции
  normalizePathForOS,
  fileExistsCaseSensitive,
  getImportPath,
  isValidWindowsPath,
  toWindowsPath,
  toUnixPath,
};
