// core/tsconfig-resolver.ts
import fs from 'fs';
import path from 'path';

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

export function loadTsConfig(startDir: string = process.cwd()): TsConfig | null {
  // Если указан явный путь, используем его
  if (explicitTsConfigPath) {
    const resolvedPath = path.resolve(process.cwd(), explicitTsConfigPath);
    if (fs.existsSync(resolvedPath)) {
      try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        console.log(`📄 Загружен tsconfig: ${resolvedPath}`);
        cachedTsConfig = JSON.parse(content) as TsConfig;
        cachedTsConfigDir = path.dirname(resolvedPath);
        return cachedTsConfig;
      } catch (error) {
        console.warn(`⚠️ Ошибка парсинга ${resolvedPath}:`, error);
      }
    } else {
      console.warn(`⚠️ Файл tsconfig не найден: ${resolvedPath}`);
    }
  }

  // Иначе ищем автоматически
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    const tsConfigPath = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      try {
        const content = fs.readFileSync(tsConfigPath, 'utf-8');
        cachedTsConfig = JSON.parse(content) as TsConfig;
        cachedTsConfigDir = path.dirname(tsConfigPath);
        console.log(`📄 Автоматически загружен tsconfig: ${tsConfigPath}`);
        return cachedTsConfig;
      } catch (error) {
        console.warn(`⚠️ Ошибка парсинга ${tsConfigPath}:`, error);
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
 * Резолвит путь с учётом алиасов из tsconfig
 * @param importPath - путь из import (например, '@/components/Button')
 * @param baseDir - директория для резолвинга baseUrl (обычно директория tsconfig)
 * @param tsConfig - загруженный tsconfig
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
  // Используем переданную директорию для резолвинга baseUrl
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

      // Проверяем существование файла с разными расширениями
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs', ''];
      for (const ext of extensions) {
        const testPath = resolvedPath + ext;
        if (fs.existsSync(testPath)) {
          return testPath;
        }
        // Проверка на index файл
        const indexPath = path.join(resolvedPath, `index${ext}`);
        if (ext && fs.existsSync(indexPath)) {
          return indexPath;
        }
      }

      return resolvedPath;
    }
  }

  return null;
}
