// src/core/detect-framework.ts
// ============================================================
// ДЕТЕКЦИЯ ФРЕЙМВОРКОВ (React / Vue)
// ============================================================
// Версия: 1.0.0
//
// МИНИМАЛЬНАЯ РЕАЛИЗАЦИЯ.
//
// Задачи:
//   • Определить, является ли файл React-файлом (.tsx/.jsx)
//   • Определить, содержит ли проект React-код вообще
//
// НЕ делаем:
//   • Парсинг AST (это в react-analyzer)
//   • Резолвинг импортов (это в relation-resolver)
//   • Определение версии React (не нужно)
//
// Принцип: эвристика по расширению + простой regex по содержимому.
// ============================================================

import path from 'path';
import type { EntitiesResult } from '../types.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

const REACT_EXTENSIONS = new Set(['.tsx', '.jsx']);

/**
 * Regex для детекции JSX-синтаксиса.
 *   <Component ... />       — self-closing компонент
 *   <div ...>               — открытый тег
 *   <>                      — фрагмент
 *   </Something>            — закрытый тег
 */
const JSX_SYNTAX_RE = /(<\s*[A-Za-z][\w.]*[\s/>]|<\s*\/\s*[A-Za-z]|<\s*>|<\s*Fragment[\s>])/;

/**
 * Regex для детекции импорта React.
 */
const REACT_IMPORT_RE = /import\s+(?:\*\s+as\s+\w+|\{[^}]*\}|\w+)\s+from\s+['"]react['"]/;

/**
 * Regex для детекции хуков React.
 */
const REACT_HOOKS_RE = /\buse[A-Z][A-Za-z0-9_]*\s*\(/;

// ============================================================
// ПУБЛИЧНОЕ API
// ============================================================

/**
 * Является ли файл React-файлом по расширению.
 */
export function isReactFileByExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return REACT_EXTENSIONS.has(ext);
}

/**
 * Является ли файл React-файлом по содержимому.
 */
export function isReactFileByContent(source: string): boolean {
  if (!source) return false;
  if (REACT_IMPORT_RE.test(source)) return true;
  if (JSX_SYNTAX_RE.test(source)) return true;
  if (REACT_HOOKS_RE.test(source)) return true;
  return false;
}

/**
 * Комплексная проверка: является ли файл React-файлом.
 */
export function isReactFile(filePath: string, sourceCode?: string): boolean {
  if (isReactFileByExtension(filePath)) return true;
  if (sourceCode && isReactFileByContent(sourceCode)) return true;
  return false;
}

/**
 * Результат детекции фреймворков в проекте.
 */
export interface FrameworkDetection {
  hasVue: boolean;
  hasReact: boolean;
  vueFileCount: number;
  reactFileCount: number;
  reactFiles: string[];
  vueFiles: string[];
}

/**
 * Детектирует фреймворки в проекте по entitiesMap.
 */
export function detectProjectFrameworks(
  entitiesMap: Record<string, EntitiesResult>
): FrameworkDetection {
  const vueFiles: string[] = [];
  const reactFiles: string[] = [];

  for (const filePath of Object.keys(entitiesMap)) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.vue') {
      vueFiles.push(filePath);
      continue;
    }

    if (REACT_EXTENSIONS.has(ext)) {
      reactFiles.push(filePath);
    }
  }

  return {
    hasVue: vueFiles.length > 0,
    hasReact: reactFiles.length > 0,
    vueFileCount: vueFiles.length,
    reactFileCount: reactFiles.length,
    reactFiles,
    vueFiles,
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  isReactFile,
  isReactFileByExtension,
  isReactFileByContent,
  detectProjectFrameworks,
};
