// src/utils/internal/PathUtils.ts
/**
 * ВНУТРЕННЯЯ РЕАЛИЗАЦИЯ - НЕ ЭКСПОРТИРУЕТСЯ НАПРЯМУЮ
 * Используйте фасад из ../path-utils.js
 *
 * Все методы кэшируются для производительности
 * API полностью сохранен для внешних пользователей
 */

import path from 'path';
import fs from 'fs';

export class PathUtils {
  private static instance: PathUtils;
  private cache = new Map<string, string>();
  private index = new Map<string, number>();
  private indexCounter = 0;

  private constructor() {}

  static getInstance(): PathUtils {
    if (!PathUtils.instance) {
      PathUtils.instance = new PathUtils();
    }
    return PathUtils.instance;
  }

  /**
   * Нормализует путь для отображения
   */
  normalizeForDisplay(filePath: string, rootDir?: string, maxLength?: number): string {
    if (!filePath) return '';

    const key = `${filePath}|${rootDir || ''}|${maxLength || ''}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

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
        const result = first + '/.../' + lastTwo.join('/');
        this.cache.set(key, result);
        return result;
      }
    }

    this.cache.set(key, normalized);
    return normalized;
  }

  /**
   * Получает имя файла из пути
   */
  getFileName(filePath: string): string {
    if (!filePath) return '';
    const normalized = this.normalizeForDisplay(filePath);
    return path.basename(normalized);
  }

  /**
   * Нормализует путь для ОС
   */
  normalizeForOS(filePath: string): string {
    if (!filePath) return '';
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Нормализует граф путей
   */
  normalizeGraph(graphData: { rootKey: string; graph: Record<string, string[]> }): {
    rootKey: string;
    graph: Record<string, string[]>;
  } {
    if (!graphData) return { rootKey: '', graph: {} };

    const rootKey = this.normalizeForDisplay(graphData.rootKey);
    const graph: Record<string, string[]> = {};

    for (const [key, deps] of Object.entries(graphData.graph)) {
      const normalizedKey = this.normalizeForDisplay(key);
      graph[normalizedKey] = deps.map(d => this.normalizeForDisplay(d));
    }

    return { rootKey, graph };
  }

  /**
   * Разрешает абсолютный путь
   */
  resolveAbsolute(filePath: string, baseDir?: string): string {
    if (!filePath) return '';
    if (path.isAbsolute(filePath)) {
      return this.normalizeForOS(filePath);
    }
    const base = baseDir || process.cwd();
    return this.normalizeForOS(path.resolve(base, filePath));
  }

  /**
   * Проверяет существование файла
   */
  validateAndResolve(filePath: string, baseDir?: string): string | null {
    const absolutePath = this.resolveAbsolute(filePath, baseDir);
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
   * Сжимает путь для компактного хранения
   */
  compress(filePath: string, maxLength: number = 30): string {
    if (!filePath) return '';
    const normalized = this.normalizeForDisplay(filePath);

    if (normalized.length <= maxLength) return normalized;

    const parts = normalized.split('/');
    if (parts.length > 3) {
      const first = parts[0] || '';
      const lastTwo = parts.slice(-2);
      return first + '/.../' + lastTwo.join('/');
    }

    return normalized;
  }

  /**
   * Преобразует путь в числовой индекс
   */
  toIndex(filePath: string): number {
    if (!filePath) return -1;

    if (this.index.has(filePath)) {
      return this.index.get(filePath)!;
    }

    const idx = this.indexCounter++;
    this.index.set(filePath, idx);
    return idx;
  }

  /**
   * Получает путь по индексу
   */
  fromIndex(index: number): string | null {
    for (const [path, idx] of this.index) {
      if (idx === index) return path;
    }
    return null;
  }

  /**
   * Очищает кэш
   */
  clearCache(): void {
    this.cache.clear();
    this.index.clear();
    this.indexCounter = 0;
  }

  /**
   * Получает статистику кэша
   */
  getCacheStats(): { cacheSize: number; indexSize: number } {
    return {
      cacheSize: this.cache.size,
      indexSize: this.index.size,
    };
  }
}

export const pathUtils = PathUtils.getInstance();
