// src/reporters/modules/utils.ts

import path from 'path';
import fs from 'fs';
import { IdManager } from '../../core/IdManager.js';

// ============================================================
// БАЗОВЫЕ УТИЛИТЫ ДЛЯ РАБОТЫ С ДАННЫМИ
// ============================================================

/**
 * Гарантирует, что значение является массивом
 * Если это строка вида "[object Object]", преобразует в пустой массив
 */
export function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Безопасное преобразование в строку
 */
export function safeString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Безопасное преобразование в число
 */
export function safeNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return defaultValue;
}

/**
 * Безопасное преобразование в boolean
 */
export function safeBoolean(value: any, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return defaultValue;
  }
  if (typeof value === 'number') return value !== 0;
  return defaultValue;
}

/**
 * Проверяет, является ли значение реальным объектом (не null, не массив)
 */
export function isRealObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Фильтрует только реальные объекты из массива
 */
export function filterRealObjects(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => isRealObject(item));
}

/**
 * Санитайзит сущности, удаляя опасные поля
 */
export function sanitizeEntities<T>(entities: T[]): T[] {
  if (!Array.isArray(entities)) return [];
  return entities.map(entity => sanitize(entity));
}

/**
 * Санитайзит один объект
 */
function sanitize<T>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;

  const result = { ...entity } as any;

  // Удаляем опасные поля
  delete result._safeInfo;
  delete result.__proto__;
  delete result.constructor;

  // Рекурсивно обрабатываем вложенные объекты
  for (const key of Object.keys(result)) {
    if (result[key] && typeof result[key] === 'object') {
      result[key] = sanitize(result[key]);
    }
  }

  return result;
}

/**
 * Безопасно обходит AST и сохраняет только нужные поля
 * ✅ Сохраняет ID функций
 */
export function safeTraverseAST(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => safeTraverseAST(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // ✅ Сохраняем id и другие важные поля
    if (key === 'id' || key === 'vscode' || key === 'line' || key === 'name') {
      result[key] = value;
    } else if (key === 'metadata') {
      // ✅ Проверяем, что value является объектом перед использованием spread
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const safeMetadata = { ...value };
        // ✅ Проверяем наличие свойства перед удалением
        if ('_safeInfo' in safeMetadata) {
          delete safeMetadata._safeInfo;
        }
        result[key] = safeMetadata;
      } else {
        result[key] = value;
      }
    } else if (key !== '_safeInfo' && key !== '__proto__' && key !== 'constructor') {
      result[key] = safeTraverseAST(value);
    }
  }
  return result;
}

/**
 * Находит корень проекта (директорию с package.json)
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
 * Находит файл в проекте по имени
 */
export function findFileInProject(
  fileName: string,
  projectRoot: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.vue']
): string | null {
  const walk = (dir: string): string | null => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
            continue;
          }
          const result = walk(fullPath);
          if (result) return result;
        } else if (entry.isFile()) {
          const baseName = path.basename(entry.name, path.extname(entry.name));
          if (baseName === fileName) {
            return fullPath;
          }
          // Проверяем с расширениями
          for (const ext of extensions) {
            if (entry.name === fileName + ext) {
              return fullPath;
            }
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки доступа
    }
    return null;
  };

  return walk(projectRoot);
}

/**
 * Находит модуль для сущности по имени
 */
export function findModuleForEntity(
  entityName: string,
  data: { graph: Record<string, string[]> }
): string | null {
  for (const [modulePath, deps] of Object.entries(data.graph)) {
    if (modulePath.includes(entityName)) {
      return modulePath;
    }
    if (Array.isArray(deps)) {
      for (const dep of deps) {
        if (dep.includes(entityName)) {
          return dep;
        }
      }
    }
  }
  return null;
}

// ============================================================
// ✅ ФУНКЦИИ ДЛЯ ГЕНЕРАЦИИ ID - ИСПОЛЬЗУЮТ IdManager
// ============================================================

/**
 * ✅ Использует статический метод из IdManager
 * Генерирует уникальный ID для функции с номером строки
 * @param filePath - Путь к файлу
 * @param funcName - Имя функции
 * @param line - Номер строки (ОБЯЗАТЕЛЬНЫЙ)
 * @returns Уникальный ID функции
 */
export function generateFunctionId(filePath: string, funcName: string, line: number): string {
  return IdManager.generateFunctionId(filePath, funcName, line);
}

/**
 * ✅ Использует статический метод из IdManager
 * Генерирует ID для файла
 * @param filePath - Путь к файлу
 * @returns Уникальный ID файла
 */
export function generateFileId(filePath: string): string {
  return IdManager.generateFileId(filePath);
}

/**
 * ✅ Использует статический метод из IdManager
 * Генерирует ID для модуля
 * @param moduleName - Имя модуля
 * @returns Уникальный ID модуля
 */
export function generateModuleId(moduleName: string): string {
  return IdManager.generateModuleId(moduleName);
}

// ============================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ПУТЯМИ
// ============================================================

/**
 * Нормализует путь для отображения
 */
export function normalizePathForDisplay(filePath: string, baseDir: string = process.cwd()): string {
  if (!filePath) return '';

  let normalized = filePath;

  // Делаем относительным
  if (path.isAbsolute(normalized)) {
    try {
      normalized = path.relative(baseDir, normalized);
    } catch {
      // Оставляем как есть
    }
  }

  // Заменяем обратные слеши на прямые
  normalized = normalized.replace(/\\/g, '/');

  // Убираем избыточные точки
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
 * Получает имя файла из пути
 */
export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Получает расширение файла
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath);
}

/**
 * Получает директорию файла
 */
export function getFileDirectory(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Проверяет, является ли файл TypeScript файлом
 */
export function isTypeScriptFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return ['.ts', '.tsx', '.mts', '.cts'].includes(ext);
}

/**
 * Проверяет, является ли файл JavaScript файлом
 */
export function isJavaScriptFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return ['.js', '.jsx', '.mjs', '.cjs'].includes(ext);
}

/**
 * Проверяет, является ли файл Vue файлом
 */
export function isVueFile(filePath: string): boolean {
  return filePath.endsWith('.vue');
}

/**
 * Проверяет, является ли файл JSX файлом
 */
export function isJsxFile(filePath: string): boolean {
  return filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
}

/**
 * Определяет язык файла
 */
export function detectLanguage(
  filePath: string
): 'typescript' | 'javascript' | 'vue' | 'jsx' | 'unknown' {
  if (isVueFile(filePath)) return 'vue';
  if (isJsxFile(filePath)) return 'jsx';
  if (isTypeScriptFile(filePath)) return 'typescript';
  if (isJavaScriptFile(filePath)) return 'javascript';
  return 'unknown';
}

/**
 * Сокращает длинный путь для отображения
 */
export function shortenPath(filePath: string, maxLength: number = 60): string {
  const normalized = normalizePathForDisplay(filePath);
  if (normalized.length <= maxLength) return normalized;

  const parts = normalized.split('/');
  if (parts.length <= 2) return normalized;

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

  const first = remaining[0] || '';
  const lastTwo = remaining.slice(-2);

  let result = prefix;
  if (first) {
    result += first + '/.../';
  }
  result += lastTwo.join('/');

  return result;
}

/**
 * Генерирует VSCode ссылку для файла
 */
export function generateVscodeLink(filePath: string, line?: number, column?: number): string {
  let link = `vscode://file/${filePath}`;
  if (line !== undefined) {
    link += `:${line}`;
    if (column !== undefined) {
      link += `:${column}`;
    }
  }
  return link;
}

/**
 * Проверяет, является ли путь абсолютным
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Получает относительный путь
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
  generateFunctionId,
  generateFileId,
  generateModuleId,
  normalizePathForDisplay,
  getFileName,
  getFileExtension,
  getFileDirectory,
  isTypeScriptFile,
  isJavaScriptFile,
  isVueFile,
  isJsxFile,
  detectLanguage,
  shortenPath,
  generateVscodeLink,
  isAbsolutePath,
  getRelativePath,
};
