// src/reporters/modules/utils.ts
// Вспомогательные функции

import fs from 'fs';
import path from 'path';
import { GraphData } from './types.js';

// ============================================================
// БЕЗОПАСНАЯ РАБОТА С ТИПАМИ
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
 * Безопасно преобразует значение в строку
 */
export function safeString(value: any): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
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
 * Безопасно преобразует значение в число
 */
export function safeNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return 0;
}

/**
 * Безопасно преобразует значение в булево
 */
export function safeBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value === 'true' || value === '1' || value === 'yes';
  }
  if (typeof value === 'number') return value !== 0;
  return !!value;
}

/**
 * Проверяет, является ли объект реальным (не строковым представлением)
 */
export function isRealObject(item: any): boolean {
  if (!item) return false;
  if (typeof item !== 'object') return false;
  if (Array.isArray(item)) return false;
  if (item.name === undefined) return false;
  if (item.toString && item.toString() === '[object Object]') return false;
  return true;
}

/**
 * Фильтрует массив, оставляя только реальные объекты
 */
export function filterRealObjects(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item: any) => isRealObject(item));
}

// ============================================================
// САНИТАЙЗИНГ ДАННЫХ
// ============================================================

/**
 * Очищает отчет от некорректных данных
 */
export function sanitizeEntities(report: any): any {
  if (!report || !report.packages) return report;

  const sanitized = { ...report };
  sanitized.packages = {};

  for (const [modulePath, pkg] of Object.entries(report.packages)) {
    if (!pkg || typeof pkg !== 'object') {
      sanitized.packages[modulePath] = pkg;
      continue;
    }

    const entities = (pkg as any).entities || {};

    sanitized.packages[modulePath] = {
      ...pkg,
      entities: {
        functions: filterRealObjects(ensureArray(entities.functions)),
        constants: filterRealObjects(ensureArray(entities.constants)),
        variables: filterRealObjects(ensureArray(entities.variables)),
        interfaces: filterRealObjects(ensureArray(entities.interfaces)),
        types: filterRealObjects(ensureArray(entities.types)),
        classes: filterRealObjects(ensureArray(entities.classes)),
      },
    };
  }

  return sanitized;
}

// ============================================================
// БЕЗОПАСНЫЙ ОБХОД AST
// ============================================================

/**
 * Безопасно обходит AST, защищая от циклических ссылок и переполнения стека
 */
export function safeTraverseAST(
  node: any,
  depth: number = 0,
  visited: WeakSet<any> = new WeakSet()
): any {
  // Базовые случаи
  if (!node || typeof node !== 'object') return node;

  // Защита от циклических ссылок
  if (visited.has(node)) {
    return '[Circular]';
  }
  visited.add(node);

  // Ограничение глубины
  const MAX_DEPTH = 50;
  if (depth > MAX_DEPTH) {
    return '[Max Depth]';
  }

  // Обработка массивов
  if (Array.isArray(node)) {
    return node.map((item: any) => safeTraverseAST(item, depth + 1, visited));
  }

  // Обработка объектов
  if (node.constructor && node.constructor.name === 'Object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(node)) {
      // Пропускаем внутренние/несериализуемые свойства
      if (shouldSkipKey(key)) {
        continue;
      }

      const value = node[key];
      if (typeof value === 'function') {
        result[key] = '[Function]';
      } else if (value && typeof value === 'object') {
        result[key] = safeTraverseAST(value, depth + 1, visited);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // Обработка других объектов (Date, RegExp, Map, Set и т.д.)
  try {
    if (node.toString && node.toString() !== '[object Object]') {
      return node.toString();
    }

    // Для объектов без понятного toString, пытаемся извлечь свойства
    const result: Record<string, any> = {};
    for (const key of Object.keys(node)) {
      if (shouldSkipKey(key)) continue;

      try {
        const value = node[key];
        if (typeof value === 'function') {
          result[key] = '[Function]';
        } else if (value && typeof value === 'object') {
          result[key] = safeTraverseAST(value, depth + 1, visited);
        } else {
          result[key] = value;
        }
      } catch {
        result[key] = '[Error]';
      }
    }
    return Object.keys(result).length > 0 ? result : '[Object]';
  } catch {
    return '[Object]';
  }
}

/**
 * Проверяет, нужно ли пропустить ключ при сериализации
 */
function shouldSkipKey(key: string): boolean {
  const skipKeys = new Set([
    // Внутренние свойства AST
    'parent',
    'context',
    'scope',
    'ancestor',
    'parentNode',
    'parentElement',
    'parentPath',
    'parentObject',
    'parentScope',
    // Служебные свойства
    '_safeCopy',
    '_safeInfo',
    'constructor',
    'prototype',
    '__proto__',
    // Свойства, которые могут вызвать циклы
    'parentSymbol',
    'symbol',
    'typeChecker',
    'program',
  ]);
  return skipKeys.has(key);
}

// ============================================================
// РАБОТА С ФАЙЛАМИ И ПРОЕКТОМ
// ============================================================

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
export function findFileInProject(filePath: string, projectRoot: string): string | null {
  const fileName = path.basename(filePath);

  // Проверяем основные пути
  const candidates = [
    path.resolve(projectRoot, filePath),
    path.resolve(projectRoot, 'src', filePath),
    path.resolve(projectRoot, 'packages/ast-analyzer/src', filePath),
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), 'src', filePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // Рекурсивный поиск по имени файла в src
  const srcDir = path.resolve(projectRoot, 'src');
  if (fs.existsSync(srcDir)) {
    const walkDir = (dir: string): string | null => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            const result = walkDir(fullPath);
            if (result) return result;
          } else if (file === fileName) {
            return fullPath;
          }
        }
      } catch (error: any) {
        // Игнорируем ошибки
      }
      return null;
    };

    const foundPath = walkDir(srcDir);
    if (foundPath) {
      return foundPath;
    }
  }

  return null;
}

/**
 * Находит модуль для сущности в графе
 */
export function findModuleForEntity(entityName: string, data: GraphData): string | null {
  if (!entityName || !data) return null;

  // Прямой поиск
  for (const [modulePath, deps] of Object.entries(data.graph)) {
    if (modulePath.includes(entityName)) return modulePath;
    for (const dep of deps) {
      if (dep.includes(entityName)) return dep;
    }
  }

  // Поиск по базовому имени (без расширения)
  const baseName = entityName.replace(/\.[^.]+$/, '');
  if (baseName !== entityName) {
    for (const [modulePath, deps] of Object.entries(data.graph)) {
      if (modulePath.includes(baseName)) return modulePath;
      for (const dep of deps) {
        if (dep.includes(baseName)) return dep;
      }
    }
  }

  return null;
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
// ============================================================

/**
 * Проверяет, является ли строка валидным JSON
 */
export function isValidJSON(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Безопасно парсит JSON, возвращая значение по умолчанию при ошибке
 */
export function safeJSONParse<T>(str: string, defaultValue: T): T {
  if (!str || typeof str !== 'string') return defaultValue;
  try {
    const parsed = JSON.parse(str);
    return parsed !== null && parsed !== undefined ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Создает уникальный идентификатор для сущности
 */
export function createEntityId(modulePath: string, name: string): string {
  const safeModule = safeString(modulePath).replace(/[^a-zA-Z0-9]/g, '_');
  const safeName = safeString(name).replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeModule}#${safeName}`;
}

/**
 * Извлекает имя файла из пути
 */
export function getFileName(filePath: string): string {
  if (!filePath) return '';
  return path.basename(filePath);
}

/**
 * Извлекает расширение файла из пути
 */
export function getFileExtension(filePath: string): string {
  if (!filePath) return '';
  const ext = path.extname(filePath);
  return ext ? ext.slice(1) : '';
}

/**
 * Проверяет, является ли файл TypeScript файлом
 */
export function isTypeScriptFile(filePath: string): boolean {
  if (!filePath) return false;
  const ext = getFileExtension(filePath);
  return ['ts', 'tsx', 'mts', 'cts'].includes(ext);
}

/**
 * Проверяет, является ли файл JavaScript файлом
 */
export function isJavaScriptFile(filePath: string): boolean {
  if (!filePath) return false;
  const ext = getFileExtension(filePath);
  return ['js', 'jsx', 'mjs', 'cjs'].includes(ext);
}

/**
 * Проверяет, является ли файл Vue файлом
 */
export function isVueFile(filePath: string): boolean {
  if (!filePath) return false;
  return filePath.endsWith('.vue');
}

/**
 * Определяет язык файла
 */
export function detectLanguage(
  filePath: string
): 'typescript' | 'javascript' | 'vue' | 'jsx' | 'unknown' {
  if (!filePath) return 'unknown';
  if (isVueFile(filePath)) return 'vue';
  if (isTypeScriptFile(filePath)) {
    if (filePath.endsWith('.tsx')) return 'jsx';
    return 'typescript';
  }
  if (isJavaScriptFile(filePath)) {
    if (filePath.endsWith('.jsx')) return 'jsx';
    return 'javascript';
  }
  return 'unknown';
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  // Безопасная работа с типами
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,

  // Санитайзинг
  sanitizeEntities,

  // Безопасный обход AST
  safeTraverseAST,

  // Работа с файлами и проектом
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,

  // Дополнительные утилиты
  isValidJSON,
  safeJSONParse,
  createEntityId,
  getFileName,
  getFileExtension,
  isTypeScriptFile,
  isJavaScriptFile,
  isVueFile,
  detectLanguage,
};
