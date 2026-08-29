// src/reporters/modules/utils.ts

import type { GraphData } from '../../types.js';
import path from 'path';
import fs from 'fs';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С МАССИВАМИ
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
 * Проверяет, является ли значение объектом (не массивом, не null)
 */
export function isRealObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Фильтрует массив, оставляя только реальные объекты
 */
export function filterRealObjects<T>(arr: any[]): T[] {
  return arr.filter(item => isRealObject(item)) as T[];
}

/**
 * Санитизирует сущности, удаляя циклические ссылки и опасные поля
 */
export function sanitizeEntities<T>(entities: T): T {
  const seen = new WeakSet();

  function sanitize(value: any): any {
    if (value === null || value === undefined) return value;

    // Обработка циклических ссылок
    if (typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }

    // Обработка массивов
    if (Array.isArray(value)) {
      return value.map(item => sanitize(item));
    }

    // Обработка объектов
    if (typeof value === 'object') {
      // Удаляем опасные поля
      const safeKeys = Object.keys(value).filter(
        key => !['_safeInfo', '__proto__', 'constructor', 'prototype'].includes(key)
      );

      const result: Record<string, any> = {};
      for (const key of safeKeys) {
        result[key] = sanitize(value[key]);
      }
      return result;
    }

    // Примитивные значения
    return value;
  }

  return sanitize(entities) as T;
}

/**
 * Безопасный обход AST (удаляет циклические ссылки)
 */
export function safeTraverseAST<T>(obj: T): T {
  return sanitizeEntities(obj);
}

/**
 * Находит корень проекта (где находится package.json)
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
export function findFileInProject(projectRoot: string, fileName: string): string | null {
  const possiblePaths = [
    path.resolve(projectRoot, fileName),
    path.resolve(projectRoot, 'src', fileName),
    path.resolve(projectRoot, 'packages', fileName),
    path.resolve(projectRoot, 'lib', fileName),
    path.resolve(projectRoot, 'dist', fileName),
  ];

  for (const candidate of possiblePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Находит модуль для сущности по имени
 */
export function findModuleForEntity(entityName: string, data: GraphData): string | null {
  const { graph } = data;

  // Проверяем, является ли имя сущности путем к модулю
  if (graph[entityName]) {
    return entityName;
  }

  // Ищем модуль, который содержит сущность
  for (const [modulePath, deps] of Object.entries(graph)) {
    // Проверяем, не является ли модуль самой сущностью
    if (modulePath.includes(entityName)) {
      return modulePath;
    }

    // Проверяем зависимости
    const depsArray = deps as string[];
    for (const dep of depsArray) {
      if (dep.includes(entityName)) {
        return dep;
      }
    }
  }

  return null;
}

/**
 * Нормализует путь для отображения
 */
export function normalizePathForDisplay(filePath: string): string {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  const cwd = process.cwd().replace(/\\/g, '/');
  if (normalized.startsWith(cwd + '/')) {
    return normalized.substring(cwd.length + 1);
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
 * Проверяет, является ли файл TypeScript
 */
export function isTypeScriptFile(filePath: string): boolean {
  return /\.(ts|tsx|mts|cts)$/i.test(filePath);
}

/**
 * Проверяет, является ли файл JavaScript
 */
export function isJavaScriptFile(filePath: string): boolean {
  return /\.(js|jsx|mjs|cjs)$/i.test(filePath);
}

/**
 * Проверяет, является ли файл Vue
 */
export function isVueFile(filePath: string): boolean {
  return /\.vue$/i.test(filePath);
}

/**
 * Проверяет, является ли файл JSX/TSX
 */
export function isJsxFile(filePath: string): boolean {
  return /\.(jsx|tsx)$/i.test(filePath);
}

/**
 * Определяет язык файла по расширению
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
  if (!filePath) return '';
  const normalized = normalizePathForDisplay(filePath);
  if (normalized.length <= maxLength) return normalized;

  const parts = normalized.split('/');
  if (parts.length <= 3) return normalized;

  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  const result = `${first}/.../${last}`;

  return result.length <= maxLength ? result : last;
}

/**
 * Генерирует VSCode ссылку для файла
 */
export function generateVscodeLink(filePath: string, line?: number): string {
  const normalized = normalizePathForDisplay(filePath);
  const fullPath = path.resolve(process.cwd(), normalized);
  return line ? `vscode://file/${fullPath}:${line}` : `vscode://file/${fullPath}`;
}

/**
 * Генерирует уникальный ID для функции
 */
export function generateFunctionId(filePath: string, funcName: string): string {
  const hash = simpleHash(filePath);
  return `func_${hash}_${funcName}`;
}

/**
 * Генерирует уникальный ID для файла
 */
export function generateFileId(filePath: string): string {
  const hash = simpleHash(filePath);
  return `file_${hash}`;
}

/**
 * Простой хеш для строки
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(4, '0');
}

/**
 * Проверяет, является ли путь абсолютным
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Получает относительный путь от одного файла к другому
 */
export function getRelativePath(from: string, to: string): string {
  const fromDir = path.dirname(from);
  let relative = path.relative(fromDir, to);
  if (!relative.startsWith('.') && !relative.startsWith('@')) {
    relative = './' + relative;
  }
  return relative.replace(/\\/g, '/');
}

/**
 * Экспорт по умолчанию
 */
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
  generateFunctionId,
  generateFileId,
  simpleHash,
  isAbsolutePath,
  getRelativePath,
};
