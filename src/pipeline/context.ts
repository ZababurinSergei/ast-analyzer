// src/pipeline/context.ts
// ============================================================
// СОЗДАНИЕ КОНТЕКСТА PIPELINE
// ============================================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0:
//   - ✅ СИНХРОНИЗАЦИЯ С stages/: все поля, используемые в
//     build-report.ts, discover-files.ts, enrich-re-exports.ts,
//     normalize-entities.ts, parse-file.ts — теперь есть в типах.
//   - ✅ ДОБАВЛЕНА нормализация paths:
//       paths > inputPaths > projectRoot > cwd
//   - ✅ ДОБАВЛЕНЫ поля в createEmptyMetrics():
//       inputPathsCount, inputDirectories, inputFiles, inputMissing,
//       filesNormalized, filesWithConditionals, filesWithLifecycle,
//       filesWithReactivity, reExportFiles, reExportMaxDepth,
//       reExportSkipped, totalClasses, totalCalls, totalReExports,
//       totalModules, totalFiles, totalEffects, totalInjections,
//       totalTemplateRefs, totalTemplates,
//       compactSize, fullSize, edgesSize, compressionRatio, valuesCount,
//       compactPath, fullPath, edgesPath
//   - ✅ projectRoot автоматически выводится из первого path,
//     если явно не задан.
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ ДОБАВЛЕНО: paths — первоклассное поле для массива путей.
// ============================================================

import fs from 'fs';
import path from 'path';
import type {
  PipelineContext,
  PipelineOptions,
  PipelineMetrics,
  ResolvedPipelineOptions,
} from './types.js';

// ============================================================
// ДЕФОЛТЫ
// ============================================================

const DEFAULT_OPTIONS = {
  mode: 'compact' as const,
  valuesMode: 'relations' as const,
  recursive: true,
  additionalIgnore: [] as string[],
  maxReExportDepth: 10,
  includeBody: false,
  includeVSCode: true,
  includeExtended: true,
  saveFullJson: true,
  fullJsonSuffix: '.full.json',
  saveEdges: false,
  edgesJsonSuffix: '.edges.json',
  verbose: false,
  continueOnError: true,
};

// ============================================================
// СОЗДАНИЕ КОНТЕКСТА
// ============================================================

/**
 * Создаёт контекст pipeline.
 *
 * ═══════════════════════════════════════════════════════════
 * НОРМАЛИЗАЦИЯ paths
 * ═══════════════════════════════════════════════════════════
 *
 * Приоритет:
 *   1. options.paths        — первоклассное поле (v1.1.0)
 *   2. options.inputPaths   — синоним (обратная совместимость)
 *   3. options.projectRoot  — единственная директория
 *   4. process.cwd()        — fallback
 *
 * ═══════════════════════════════════════════════════════════
 * НОРМАЛИЗАЦИЯ projectRoot
 * ═══════════════════════════════════════════════════════════
 *
 *   - Если projectRoot задан явно → используем его.
 *   - Иначе выводим из первого пути (директория, если файл).
 *
 * ═══════════════════════════════════════════════════════════
 * ГАРАНТИИ
 * ═══════════════════════════════════════════════════════════
 *
 *   - options.paths ВСЕГДА непустой массив абсолютных путей.
 *   - options.inputPaths === options.paths (для совместимости).
 *   - options.projectRoot ВСЕГДА абсолютный путь.
 *   - metrics содержит ВСЕ поля (даже если не все используются).
 */
export function createContext(options: PipelineOptions = {}): PipelineContext {
  // ──────────────────────────────────────────────────
  // 1. Нормализация paths (приоритет: paths > inputPaths)
  // ──────────────────────────────────────────────────
  const explicitPaths = firstNonEmpty(options.paths, options.inputPaths);

  let normalizedPaths: string[];

  if (explicitPaths.length > 0) {
    // Приоритет 1-2: явный список путей
    normalizedPaths = explicitPaths.map(p => path.resolve(p));
  } else if (options.projectRoot) {
    // Приоритет 3: projectRoot
    normalizedPaths = [path.resolve(options.projectRoot)];
  } else {
    // Приоритет 4: cwd
    normalizedPaths = [process.cwd()];
  }

  // ──────────────────────────────────────────────────
  // 2. Нормализация projectRoot
  // ──────────────────────────────────────────────────
  const firstPath = normalizedPaths[0]!;
  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : deriveProjectRoot(firstPath);

  // ──────────────────────────────────────────────────
  // 3. Сборка resolved options
  // ──────────────────────────────────────────────────
  const resolvedOptions: ResolvedPipelineOptions = {
    // Режимы
    mode: options.mode ?? DEFAULT_OPTIONS.mode,
    valuesMode: options.valuesMode ?? DEFAULT_OPTIONS.valuesMode,
    recursive: options.recursive ?? DEFAULT_OPTIONS.recursive,
    additionalIgnore: options.additionalIgnore ?? DEFAULT_OPTIONS.additionalIgnore,
    maxReExportDepth: options.maxReExportDepth ?? DEFAULT_OPTIONS.maxReExportDepth,

    // Содержимое
    includeBody: options.includeBody ?? DEFAULT_OPTIONS.includeBody,
    includeVSCode: options.includeVSCode ?? DEFAULT_OPTIONS.includeVSCode,
    includeExtended: options.includeExtended ?? DEFAULT_OPTIONS.includeExtended,

    // Вывод
    saveFullJson: options.saveFullJson ?? DEFAULT_OPTIONS.saveFullJson,
    fullJsonSuffix: options.fullJsonSuffix ?? DEFAULT_OPTIONS.fullJsonSuffix,
    saveEdges: options.saveEdges ?? DEFAULT_OPTIONS.saveEdges,
    edgesJsonSuffix: options.edgesJsonSuffix ?? DEFAULT_OPTIONS.edgesJsonSuffix,

    // Отладка
    verbose: options.verbose ?? DEFAULT_OPTIONS.verbose,
    continueOnError: options.continueOnError ?? DEFAULT_OPTIONS.continueOnError,

    // Пути
    paths: normalizedPaths,
    inputPaths: normalizedPaths,
    projectRoot,
    outputPath: options.outputPath,
  };

  // ──────────────────────────────────────────────────
  // 4. Сборка контекста
  // ──────────────────────────────────────────────────
  return {
    options: resolvedOptions,
    files: [],
    entitiesMap: {},
    enhancedMap: {},
    errors: [],
    metrics: createEmptyMetrics(),
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Возвращает первый непустой массив строк из кандидатов.
 *
 * Используется для нормализации paths с приоритетом:
 *   paths > inputPaths
 *
 * Фильтрует пустые строки и пробелы.
 */
function firstNonEmpty(...candidates: (string[] | undefined)[]): string[] {
  for (const c of candidates) {
    if (!Array.isArray(c)) continue;
    const filtered = c.filter(p => typeof p === 'string' && p.trim().length > 0);
    if (filtered.length > 0) return filtered;
  }
  return [];
}

/**
 * Выводит projectRoot из первого пути.
 *
 *   - файл          → директория файла
 *   - директория    → сама директория
 *   - не существует → cwd
 */
function deriveProjectRoot(p: string): string {
  try {
    const stat = fs.statSync(p);
    return stat.isDirectory() ? p : path.dirname(p);
  } catch {
    return process.cwd();
  }
}

// ============================================================
// ПУСТЫЕ МЕТРИКИ
// ============================================================

/**
 * Создаёт объект метрик со всеми полями = 0 (или undefined для optional).
 *
 * ⚠️ ВАЖНО: список полей должен синхронизироваться с
 * интерфейсом PipelineMetrics в types.ts. Если добавили поле
 * в PipelineMetrics — добавьте его и здесь.
 */
export function createEmptyMetrics(): PipelineMetrics {
  return {
    // ─── ФАЙЛЫ ───
    filesDiscovered: 0,
    filesParsed: 0,
    filesFailed: 0,
    filesNormalized: 0,
    vueFiles: 0,
    tsFiles: 0,

    // ─── ВХОДНЫЕ ПУТИ ───
    inputPathsCount: 0,
    inputDirectories: 0,
    inputFiles: 0,
    inputMissing: 0,

    // ─── RE-EXPORTS ───
    reExportChains: 0,
    reExportFiles: 0,
    reExportMaxDepth: 0,
    reExportSkipped: 0,

    // ─── СУЩНОСТИ ───
    totalFunctions: 0,
    totalClasses: 0,
    totalConstants: 0,
    totalImports: 0,
    totalExports: 0,
    totalReExports: 0,
    totalCalls: 0,
    totalModules: 0,
    totalFiles: 0,

    // ─── VUE-СЕКЦИИ ───
    totalConditionals: 0,
    totalLifecycle: 0,
    totalEffects: 0,
    totalInjections: 0,
    totalReactivity: 0,
    totalTemplateRefs: 0,
    totalTemplates: 0,

    // ─── ФАЙЛЫ С VUE-СЕКЦИЯМИ ───
    filesWithConditionals: 0,
    filesWithLifecycle: 0,
    filesWithReactivity: 0,

    // ─── РАЗМЕРЫ / СЖАТИЕ (optional) ───
    compactSize: undefined,
    fullSize: undefined,
    edgesSize: undefined,
    compressionRatio: undefined,
    valuesCount: undefined,
    compactPath: undefined,
    fullPath: undefined,
    edgesPath: undefined,

    // ─── ВРЕМЯ ───
    durationMs: 0,
    stageTimings: {},
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  createContext,
  createEmptyMetrics,
};
