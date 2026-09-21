// src/pipeline/types.ts
// ============================================================
// ТИПЫ PIPELINE
// ============================================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0:
//   - ✅ ДОБАВЛЕНО в PipelineOptions:
//       • paths          — первоклассное поле для массива путей
//       • inputPaths     — синоним (обратная совместимость)
//       • outputPath     — путь для сохранения отчёта
//       • saveFullJson   — сохранять .full.json
//       • fullJsonSuffix — суффикс .full.json
//       • saveEdges      — сохранять edges
//       • edgesJsonSuffix— суффикс edges
//   - ✅ РАСШИРЕНО PipelineMetrics:
//       • inputPathsCount, inputDirectories, inputFiles, inputMissing
//       • filesNormalized, filesWithConditionals, filesWithLifecycle,
//         filesWithReactivity
//       • reExportFiles, reExportMaxDepth, reExportSkipped
//       • totalEffects, totalInjections, totalTemplateRefs,
//         totalClasses, totalCalls, totalReExports, totalTemplates,
//         totalModules, totalFiles
//       • compactSize, fullSize, edgesSize, compressionRatio,
//         valuesCount, compactPath, fullPath, edgesPath
//   - ✅ РАСШИРЕНО PipelineResult: compactPath, fullPath, edgesPath
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ ДОБАВЛЕНО: PipelineOptions.paths — первоклассное поле.
//   - ✅ ПРИОРИТЕТ: paths > inputPaths > projectRoot > cwd.
// ============================================================

import type { EntitiesResult, EnhancedEntityInfo } from '../types.js';

import type { FullJSON, CompactJSON } from '../reporters/codec/codec-types.js';
// ============================================================
// РЕЖИМЫ
// ============================================================

export type PipelineMode = 'full' | 'compact' | 'entities-only';
export type ValuesMode = 'full' | 'relations';

// ============================================================
// ОПЦИИ
// ============================================================

export interface PipelineOptions {
  // ──────────────────────────────────────────────────
  // ВХОДНЫЕ ПУТИ
  // ──────────────────────────────────────────────────

  /**
   * ✅ НОВОЕ v1.1.0: явный список путей для анализа
   * (файлы и/или директории).
   *
   * ПРИОРИТЕТ: paths > inputPaths > projectRoot > cwd
   *
   * ПРИМЕРЫ:
   *   paths: ['./src', './tests/index.ts']
   *   paths: ['/abs/path/to/project']
   */
  paths?: string[];

  /**
   * @deprecated Используйте `paths`.
   * Синоним для обратной совместимости.
   */
  inputPaths?: string[];

  /**
   * Корень проекта. Используется, если paths/inputPaths не заданы.
   *
   * Дополнительно используется для:
   *   - резолвинга tsconfig.json (re-export resolver)
   *   - разрешения алиасов (@/, ~/, #/)
   *   - относительных путей в отчёте
   */
  projectRoot?: string;

  // ──────────────────────────────────────────────────
  // РЕЖИМЫ
  // ──────────────────────────────────────────────────

  /** Режим вывода: full | compact | entities-only */
  mode?: PipelineMode;

  /** Режим сериализации values (только для compact) */
  valuesMode?: ValuesMode;

  /** Рекурсивный обход директорий */
  recursive?: boolean;

  /** Дополнительные ignore-паттерны (мержатся с DEFAULT_IGNORE) */
  additionalIgnore?: string[];

  /** Максимальная глубина разворачивания re-exports */
  maxReExportDepth?: number;

  // ──────────────────────────────────────────────────
  // СОДЕРЖИМОЕ
  // ──────────────────────────────────────────────────

  /** Включать тела функций в отчёт */
  includeBody?: boolean;

  /** Включать VSCode-ссылки */
  includeVSCode?: boolean;

  /** Включать расширенные секции (lifecycle/effects/injections/reactivity) */
  includeExtended?: boolean;

  // ──────────────────────────────────────────────────
  // ВЫВОД
  // ──────────────────────────────────────────────────

  /**
   * ✅ НОВОЕ v1.2.0: путь для сохранения сжатого отчёта.
   * Если задан — BuildReportStage сохранит compact на диск.
   */
  outputPath?: string;

  /**
   * ✅ НОВОЕ v1.2.0: сохранять полный JSON рядом с compact.
   */
  saveFullJson?: boolean;

  /**
   * ✅ НОВОЕ v1.2.0: суффикс для полного JSON.
   * По умолчанию '.full.json'.
   */
  fullJsonSuffix?: string;

  /**
   * ✅ НОВОЕ v1.2.0: сохранять edges в отдельный файл.
   */
  saveEdges?: boolean;

  /**
   * ✅ НОВОЕ v1.2.0: суффикс для edges JSON.
   * По умолчанию '.edges.json'.
   */
  edgesJsonSuffix?: string;

  // ──────────────────────────────────────────────────
  // ОТЛАДКА
  // ──────────────────────────────────────────────────

  /** Подробный вывод */
  verbose?: boolean;

  /** Продолжать при ошибках отдельных файлов */
  continueOnError?: boolean;
}

/**
 * Опции, гарантированно заполненные дефолтами.
 * `paths`, `inputPaths` и `projectRoot` — уже нормализованы
 * до абсолютных путей.
 */
export type ResolvedPipelineOptions = Required<
  Omit<PipelineOptions, 'paths' | 'inputPaths' | 'projectRoot' | 'outputPath'>
> & {
  paths: string[];
  inputPaths: string[];
  projectRoot: string;
  outputPath?: string;
};

// ============================================================
// КОНТЕКСТ
// ============================================================

export interface PipelineContext {
  options: ResolvedPipelineOptions;
  files: string[];
  entitiesMap: Record<string, EntitiesResult>;
  enhancedMap: Record<string, EnhancedEntityInfo>;
  full?: FullJSON;
  compact?: CompactJSON;
  errors: FileError[];
  metrics: PipelineMetrics;
}

export interface FileError {
  file: string;
  stage: string;
  message: string;
  stack?: string;
}

// ============================================================
// МЕТРИКИ (расширенные)
// ============================================================

export interface PipelineMetrics {
  // ──────────────────────────────────────────────────
  // ФАЙЛЫ
  // ──────────────────────────────────────────────────

  filesDiscovered: number;
  filesParsed: number;
  filesFailed: number;
  filesNormalized: number;
  vueFiles: number;
  tsFiles: number;

  // ──────────────────────────────────────────────────
  // ВХОДНЫЕ ПУТИ
  // ──────────────────────────────────────────────────

  inputPathsCount: number;
  inputDirectories: number;
  inputFiles: number;
  inputMissing: number;

  // ──────────────────────────────────────────────────
  // RE-EXPORTS
  // ──────────────────────────────────────────────────

  reExportChains: number;
  reExportFiles: number;
  reExportMaxDepth: number;
  reExportSkipped: number;

  // ──────────────────────────────────────────────────
  // СУЩНОСТИ
  // ──────────────────────────────────────────────────

  totalFunctions: number;
  totalClasses: number;
  totalConstants: number;
  totalImports: number;
  totalExports: number;
  totalReExports: number;
  totalCalls: number;
  totalModules: number;
  totalFiles: number;

  // ──────────────────────────────────────────────────
  // VUE-СЕКЦИИ
  // ──────────────────────────────────────────────────

  totalConditionals: number;
  totalLifecycle: number;
  totalEffects: number;
  totalInjections: number;
  totalReactivity: number;
  totalTemplateRefs: number;
  totalTemplates: number;

  // ──────────────────────────────────────────────────
  // ФАЙЛЫ С VUE-СЕКЦИЯМИ
  // ──────────────────────────────────────────────────

  filesWithConditionals: number;
  filesWithLifecycle: number;
  filesWithReactivity: number;

  // ──────────────────────────────────────────────────
  // РАЗМЕРЫ / СЖАТИЕ
  // ──────────────────────────────────────────────────

  compactSize?: number;
  fullSize?: number;
  edgesSize?: number;
  compressionRatio?: number;
  valuesCount?: number;
  compactPath?: string;
  fullPath?: string;
  edgesPath?: string;

  // ──────────────────────────────────────────────────
  // ВРЕМЯ
  // ──────────────────────────────────────────────────

  durationMs: number;
  stageTimings: Record<string, number>;
}

// ============================================================
// РЕЗУЛЬТАТ
// ============================================================

export interface PipelineResult {
  full?: FullJSON;
  compact?: CompactJSON;
  entitiesMap: Record<string, EntitiesResult>;
  enhancedMap: Record<string, EnhancedEntityInfo>;
  metrics: PipelineMetrics;
  errors: FileError[];
  compactPath?: string;
  fullPath?: string;
  edgesPath?: string;
}

// ============================================================
// ИНТЕРФЕЙС STAGE
// ============================================================

export interface PipelineStage<TInput = PipelineContext, TOutput = PipelineContext> {
  readonly name: string;
  run(input: TInput): Promise<TOutput> | TOutput;
}
