// core/tsconfig-resolver.ts
import fs from 'fs';
import path from 'path';
import { normalizePathForOS } from '../utils/path-utils.js';

export interface TsConfig {
  compilerOptions?: {
    paths?: Record<string, string[]>;
    baseUrl?: string;
  };
}

export interface AliasMapping {
  [alias: string]: string[];
}

// Глобальная переменная для явного пути к tsconfig
let explicitTsConfigPath: string | null = null;
let cachedTsConfig: TsConfig | null = null;
let cachedTsConfigDir: string | null = null;

export function setTsConfigPath(configPath: string) {
  explicitTsConfigPath = configPath;
  cachedTsConfig = null;
  cachedTsConfigDir = null;
}

/**
 * Загружает tsconfig с поддержкой кэширования и Windows
 * @param startDir - Директория для поиска tsconfig.json
 * @returns TsConfig или null если не найден
 */
export function loadTsConfig(startDir: string = process.cwd()): TsConfig | null {
  // Если указан явный путь, используем его
  if (explicitTsConfigPath) {
    const resolvedPath = path.resolve(process.cwd(), explicitTsConfigPath);
    const normalizedPath = normalizePathForOS(resolvedPath);

    if (fs.existsSync(normalizedPath)) {
      try {
        const content = fs.readFileSync(normalizedPath, 'utf-8');
        console.log(`📄 Загружен tsconfig: ${normalizedPath}`);
        cachedTsConfig = JSON.parse(content) as TsConfig;
        cachedTsConfigDir = path.dirname(normalizedPath);
        return cachedTsConfig;
      } catch (error) {
        console.warn(`⚠️ Ошибка парсинга ${normalizedPath}:`, error);
      }
    } else {
      console.warn(`⚠️ Файл tsconfig не найден: ${normalizedPath}`);
    }
  }

  // Иначе ищем автоматически
  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const tsConfigPath = path.join(currentDir, 'tsconfig.json');
    const normalizedTsConfigPath = normalizePathForOS(tsConfigPath);

    if (fs.existsSync(normalizedTsConfigPath)) {
      try {
        const content = fs.readFileSync(normalizedTsConfigPath, 'utf-8');
        cachedTsConfig = JSON.parse(content) as TsConfig;
        cachedTsConfigDir = path.dirname(normalizedTsConfigPath);
        console.log(`📄 Автоматически загружен tsconfig: ${normalizedTsConfigPath}`);
        return cachedTsConfig;
      } catch (error) {
        console.warn(`⚠️ Ошибка парсинга ${normalizedTsConfigPath}:`, error);
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Получить директорию, в которой находится tsconfig.json
 */
export function getTsConfigDir(): string | null {
  return cachedTsConfigDir;
}

/**
 * Получить закэшированный tsconfig
 */
export function getCachedTsConfig(): TsConfig | null {
  return cachedTsConfig;
}

/**
 * Очистить кэш tsconfig
 */
export function clearTsConfigCache(): void {
  cachedTsConfig = null;
  cachedTsConfigDir = null;
  explicitTsConfigPath = null;
}

/**
 * Резолвит путь с учётом алиасов из tsconfig
 * @param importPath - путь из import (например, '@/components/Button')
 * @param baseDir - директория для резолвинга baseUrl (обычно директория tsconfig)
 * @param tsConfig - загруженный tsconfig
 * @returns Абсолютный путь к файлу или null
 */
export function resolveAliasPath(
  importPath: string,
  baseDir: string,
  tsConfig: TsConfig | null
): string | null {
  if (!tsConfig?.compilerOptions?.paths) {
    return null;
  }

  const { paths, baseUrl = '.' } = tsConfig.compilerOptions;
  const baseUrlPath = path.resolve(baseDir, baseUrl);

  for (const [alias, targets] of Object.entries(paths)) {
    if (!targets || targets.length === 0) continue;

    // Преобразуем паттерн алиаса в регулярное выражение
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escapedAlias.replace(/\\\*/g, '(.*)');
    const regex = new RegExp(`^${pattern}$`);
    const match = importPath.match(regex);

    if (match) {
      // Берём первый целевой путь
      let targetPath = targets[0];
      if (!targetPath) continue;

      // Заменяем * на захваченные группы
      for (let i = 1; i < match.length; i++) {
        const replacement = match[i];
        if (replacement !== undefined) {
          targetPath = targetPath.replace('*', replacement);
        }
      }

      // Резолвим относительно baseUrl
      const resolvedPath = path.resolve(baseUrlPath, targetPath);
      const normalizedResolvedPath = normalizePathForOS(resolvedPath);

      // Проверяем существование файла с разными расширениями
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs', ''];
      for (const ext of extensions) {
        const testPath = normalizedResolvedPath + ext;
        if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
          return testPath;
        }
        // Проверка на index файл
        const indexPath = path.join(normalizedResolvedPath, `index${ext}`);
        if (ext && fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
          return normalizePathForOS(indexPath);
        }
      }

      return normalizedResolvedPath;
    }
  }

  return null;
}

/**
 * Проверяет, есть ли алиасы в tsconfig
 */
export function hasAliases(tsConfig: TsConfig | null): boolean {
  if (!tsConfig?.compilerOptions?.paths) {
    return false;
  }
  return Object.keys(tsConfig.compilerOptions.paths).length > 0;
}

/**
 * Получить все алиасы из tsconfig
 */
export function getAliases(tsConfig: TsConfig | null): AliasMapping {
  if (!tsConfig?.compilerOptions?.paths) {
    return {};
  }
  return tsConfig.compilerOptions.paths;
}

/**
 * Получить baseUrl из tsconfig
 */
export function getBaseUrl(tsConfig: TsConfig | null): string | null {
  if (!tsConfig?.compilerOptions?.baseUrl) {
    return null;
  }
  return tsConfig.compilerOptions.baseUrl;
}

/**
 * Проверяет, является ли путь алиасом
 */
export function isAliasPath(importPath: string, tsConfig: TsConfig | null): boolean {
  if (!tsConfig?.compilerOptions?.paths) {
    return false;
  }

  for (const alias of Object.keys(tsConfig.compilerOptions.paths)) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escapedAlias.replace(/\\\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(importPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Резолвит путь алиаса без проверки существования файла
 * (только преобразование паттерна)
 */
export function resolveAliasPattern(
  importPath: string,
  tsConfig: TsConfig | null,
  baseDir: string
): string | null {
  if (!tsConfig?.compilerOptions?.paths) {
    return null;
  }

  const { paths, baseUrl = '.' } = tsConfig.compilerOptions;
  const baseUrlPath = path.resolve(baseDir, baseUrl);

  for (const [alias, targets] of Object.entries(paths)) {
    if (!targets || targets.length === 0) continue;

    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escapedAlias.replace(/\\\*/g, '(.*)');
    const regex = new RegExp(`^${pattern}$`);
    const match = importPath.match(regex);

    if (match) {
      let targetPath = targets[0];
      if (!targetPath) continue;

      for (let i = 1; i < match.length; i++) {
        const replacement = match[i];
        if (replacement !== undefined) {
          targetPath = targetPath.replace('*', replacement);
        }
      }

      return normalizePathForOS(path.resolve(baseUrlPath, targetPath));
    }
  }

  return null;
}

/**
 * Добавляет алиас в tsconfig (в память, не сохраняет на диск)
 */
export function addAlias(
  tsConfig: TsConfig | null,
  alias: string,
  target: string
): TsConfig | null {
  if (!tsConfig) {
    tsConfig = { compilerOptions: {} };
  }

  if (!tsConfig.compilerOptions) {
    tsConfig.compilerOptions = {};
  }

  if (!tsConfig.compilerOptions.paths) {
    tsConfig.compilerOptions.paths = {};
  }

  tsConfig.compilerOptions.paths[alias] = [target];
  return tsConfig;
}

/**
 * Удаляет алиас из tsconfig (в памяти)
 */
export function removeAlias(tsConfig: TsConfig | null, alias: string): TsConfig | null {
  if (!tsConfig?.compilerOptions?.paths) {
    return tsConfig;
  }

  delete tsConfig.compilerOptions.paths[alias];
  return tsConfig;
}

export default {
  loadTsConfig,
  setTsConfigPath,
  getTsConfigDir,
  getCachedTsConfig,
  clearTsConfigCache,
  resolveAliasPath,
  resolveAliasPattern,
  hasAliases,
  getAliases,
  getBaseUrl,
  isAliasPath,
  addAlias,
  removeAlias,
};
