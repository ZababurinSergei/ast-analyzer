// src/cli/config/load-config.ts
// ============================================
// ЗАГРУЗЧИК КОНФИГ-ФАЙЛА
// ============================================
// Версия: 1.0.0
//
// Назначение:
//   Читает ast-analyzer.config.json (или путь из --config),
//   валидирует, мержит с дефолтами, возвращает нормализованный
//   объект для CompactRecursiveCommand.
//
// Приоритет:
//   1. CLI-флаги (highest)
//   2. Конфиг-файл
//   3. Пресет из CompactReportConfig
//   4. Встроенные дефолты (lowest)
// ============================================

import fs from 'fs';
import path from 'path';
import { safeJsonParse } from '../../utils/safe-json.js';

// ============================================
// ТИПЫ
// ============================================

export interface CompactRecursiveConfig {
  preset?: 'minimal' | 'standard' | 'full' | 'relationships' | 'ultra';
  depth?: number;
  output?: string;

  includeBody?: boolean;
  includeSecurity?: boolean;
  includeVSCode?: boolean;

  functions?: boolean;
  constants?: boolean;
  selfFunctions?: boolean;

  relations?: {
    calls?: boolean;
    imports?: boolean;
    exports?: boolean;
    inheritance?: boolean;
    typeDeps?: boolean;
    reExports?: boolean;
    constUses?: boolean;
    constDeps?: boolean;
    constExports?: boolean;
  };

  extended?: {
    dynamicImports?: boolean;
    configRefs?: boolean;
    externalLibs?: boolean;
    vueTemplates?: boolean;
    asyncChains?: boolean;
    closures?: boolean;
    reflections?: boolean;
  };

  stats?: {
    basic?: boolean;
    extended?: boolean;
    byModule?: boolean;
    byFile?: boolean;
    byType?: boolean;
  };

  metadata?: {
    flags?: boolean;
    types?: boolean;
    errors?: boolean;
  };

  formatting?: {
    minifyKeys?: boolean;
    useBitFlags?: boolean;
    useDictionaries?: boolean;
    useTemplates?: boolean;
    readableKeys?: boolean;
  };

  outputOptions?: {
    compress?: boolean;
    saveFullJson?: boolean;
    fullJsonSuffix?: string;
    saveEdges?: boolean;
    edgesJsonSuffix?: string;
  };

  exclude?: string[];
}

export interface AstAnalyzerConfig {
  version?: string;
  compactRecursive?: CompactRecursiveConfig;
}

// ============================================
// ПОИСК КОНФИГ-ФАЙЛА
// ============================================

const CONFIG_FILENAMES = ['ast-analyzer.config.json', '.ast-analyzer.json', '.ast-analyzerrc.json'];

/**
 * Ищет конфиг-файл вверх по дереву от startDir.
 * Возвращает абсолютный путь или null.
 */
export function findConfigFile(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = path.join(current, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

// ============================================
// ЗАГРУЗКА
// ============================================

/**
 * Загружает конфиг из указанного пути.
 * Если путь не указан — ищет автоматически вверх от cwd.
 *
 * При ошибках парсинга — возвращает пустой объект и пишет warning.
 */
export function loadConfig(
  explicitPath?: string,
  startDir: string = process.cwd()
): AstAnalyzerConfig {
  let configPath: string | null = null;

  if (explicitPath) {
    configPath = path.resolve(explicitPath);
    if (!fs.existsSync(configPath)) {
      console.warn(`⚠️ Config file not found: ${configPath}`);
      return {};
    }
  } else {
    configPath = findConfigFile(startDir);
  }

  if (!configPath) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = safeJsonParse<AstAnalyzerConfig>(raw, {});

    if (!parsed || typeof parsed !== 'object') {
      console.warn(`⚠️ Invalid config (not an object): ${configPath}`);
      return {};
    }

    console.log(`📋 Config loaded: ${configPath}`);
    return parsed;
  } catch (error) {
    console.warn(
      `⚠️ Failed to read config ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {};
  }
}

// ============================================
// МЕРЖ: CONFIG + CLI FLAGS
// ============================================

/**
 * Мержит конфиг-файл с CLI-опциями.
 *
 * Приоритет:
 *   CLI > config > undefined (пусть пресет решает)
 *
 * Возвращает объект, готовый к передаче в CompactRecursiveCommand.
 */
export function mergeConfigWithCli(
  config: AstAnalyzerConfig,
  cliOptions: Record<string, any>
): Record<string, any> {
  const cfg = config.compactRecursive ?? {};

  const merged: Record<string, any> = { ...cliOptions };

  // preset
  if (cliOptions.preset === undefined && cfg.preset !== undefined) {
    merged.preset = cfg.preset;
  }

  // depth
  if (cliOptions.depth === undefined && cfg.depth !== undefined) {
    merged.depth = String(cfg.depth);
  }

  // output
  if (cliOptions.output === undefined && cfg.output !== undefined) {
    merged.output = cfg.output;
  }

  // includeBody / includeSecurity / includeVSCode
  if (cliOptions.includeBody === undefined && cfg.includeBody !== undefined) {
    merged.includeBody = cfg.includeBody;
  }
  if (cliOptions.includeSecurity === undefined && cfg.includeSecurity !== undefined) {
    merged.includeSecurity = cfg.includeSecurity;
  }
  if (cliOptions.includeVSCode === undefined && cfg.includeVSCode !== undefined) {
    merged.includeVSCode = cfg.includeVSCode;
  }

  // functions / constants / selfFunctions
  if (cliOptions.functions === undefined && cfg.functions !== undefined) {
    merged.functions = cfg.functions;
  }
  if (cliOptions.constants === undefined && cfg.constants !== undefined) {
    merged.constants = cfg.constants;
  }
  if (cliOptions.selfFunctions === undefined && cfg.selfFunctions !== undefined) {
    merged.selfFunctions = cfg.selfFunctions;
  }

  // relations.*
  if (cfg.relations) {
    for (const [key, value] of Object.entries(cfg.relations)) {
      if (cliOptions[key] === undefined && value !== undefined) {
        merged[key] = value;
      }
    }
  }

  // extended.*
  if (cfg.extended) {
    for (const [key, value] of Object.entries(cfg.extended)) {
      if (cliOptions[key] === undefined && value !== undefined) {
        merged[key] = value;
      }
    }
  }

  // stats.*
  if (cfg.stats) {
    for (const [key, value] of Object.entries(cfg.stats)) {
      if (cliOptions[key] === undefined && value !== undefined) {
        merged[key] = value;
      }
    }
  }

  // metadata.*
  if (cfg.metadata) {
    for (const [key, value] of Object.entries(cfg.metadata)) {
      if (cliOptions[key] === undefined && value !== undefined) {
        merged[key] = value;
      }
    }
  }

  // formatting.*
  if (cfg.formatting) {
    for (const [key, value] of Object.entries(cfg.formatting)) {
      if (cliOptions[key] === undefined && value !== undefined) {
        merged[key] = value;
      }
    }
  }

  // output.* → outputOptions
  if (cfg.outputOptions) {
    merged.__outputOptions = { ...cfg.outputOptions };
  }

  // exclude
  if (cliOptions.exclude === undefined && cfg.exclude !== undefined) {
    merged.exclude = cfg.exclude;
  }

  return merged;
}

export default { loadConfig, mergeConfigWithCli, findConfigFile };
