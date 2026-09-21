// src/pipeline/types.ts
// ============================================================
// ТИПЫ PIPELINE
// ============================================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0 (интеграция relation-resolver):
//   - ✅ ДОБАВЛЕНО: RelationsResolvedMetrics — метрики
//     разрешённых связей (refCalls, eventHandlers, composables, ...)
//   - ✅ ДОБАВЛЕНО: TemplateRecord — тип для обогащённых templates
//     с relation-полями (refCalls, localBindings, exposedMethods, ...)
//   - ✅ ДОБАВЛЕНО: поле relationsResolved в PipelineMetrics
//   - ✅ ДОБАВЛЕНО: поле relationsStats в PipelineResult
//   - ✅ ДОБАВЛЕНО: ResolvedPipelineOptions вынесен в отдельный тип
//   - ✅ ОБНОВЛЕНО: версия типа 1.2.0 → 2.0.0
//
// ИЗМЕНЕНИЯ v1.2.0:
//   - ✅ ДОБАВЛЕНО в PipelineOptions: paths, inputPaths,
//     outputPath, saveFullJson, fullJsonSuffix, saveEdges,
//     edgesJsonSuffix
//   - ✅ РАСШИРЕНО PipelineMetrics
//   - ✅ РАСШИРЕНО PipelineResult: compactPath, fullPath, edgesPath
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ ДОБАВЛЕНО: PipelineOptions.paths
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
   * Явный список путей для анализа
   * (файлы и/или директории).
   *
   * ПРИОРИТЕТ: paths > inputPaths > projectRoot > cwd
   */
  paths?: string[];

  /**
   * @deprecated Используйте `paths`.
   * Синоним для обратной совместимости.
   */
  inputPaths?: string[];

  /**
   * Корень проекта. Используется, если paths/inputPaths не заданы.
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
   * Путь для сохранения сжатого отчёта.
   * Если задан — BuildReportStage сохранит compact на диск.
   */
  outputPath?: string;

  /**
   * Сохранять полный JSON рядом с compact.
   */
  saveFullJson?: boolean;

  /**
   * Суффикс для полного JSON.
   * По умолчанию '.full.json'.
   */
  fullJsonSuffix?: string;

  /**
   * Сохранять edges в отдельный файл.
   */
  saveEdges?: boolean;

  /**
   * Суффикс для edges JSON.
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
// ✅ НОВОЕ v2.0.0: TEMPLATE RECORD
// ============================================================
// Тип для обогащённого templates-объекта, который проходит
// через ResolveRelationsStage.
//
// Базовые поля берутся из EnhancedEntityInfo (templateXxx),
// relation-поля добавляются в ResolveRelationsStage.
// ============================================================

export interface TemplateRecord {
  // ──────────────────────────────────────────────────
  // БАЗОВЫЕ ПОЛЯ (из NormalizeEntitiesStage)
  // ──────────────────────────────────────────────────

  fileId: string;
  moduleId: string;
  reactivityDeps: string[];
  eventHandlers: any[];
  dynamicComponents: any[];
  directives: any[];
  usedComponents: any[];
  templateRefs: any[];
  cssVariables: any[];
  deepSelectors: any[];
  slots: any[];
  complexity: number;
  conditionals: any[];

  // ──────────────────────────────────────────────────
  // ✅ RELATION-ПОЛЯ (из ResolveRelationsStage)
  // ──────────────────────────────────────────────────

  /** Emits с consumers (emit → parent handler) */
  emits?: any[];

  /** Разрешённые ref-вызовы (contextMenu.value?.openContextMenu()) */
  refCalls?: any[];

  /** Local bindings (const { data } = useDataState()) */
  localBindings?: any[];

  /** defineExpose методы */
  exposedMethods?: any[];

  /** defineProps */
  props?: any[];

  /** defineModel */
  models?: any[];

  /** defineSlots */
  slotDefinitions?: any[];

  /** defineOptions */
  options?: any;

  /** Prop bindings (:title="props.title") */
  propBindings?: any[];

  /** v-model bindings */
  vModels?: any[];

  /** Инъекции provide/inject */
  templateInjections?: any[];
}

// ============================================================
// ✅ НОВОЕ v2.0.0: МЕТРИКИ RELATION-RESOLVER
// ============================================================

/**
 * Метрики разрешённых кросс-файловых связей.
 *
 * Заполняется в ResolveRelationsStage.
 */
export interface RelationsResolvedMetrics {
  /** Количество разрешённых refCall → exposedMethod */
  refCalls: number;

  /** Количество разрешённых @click → function.id */
  eventHandlers: number;

  /** Количество найденных composables */
  composables: number;

  /** Количество localBindings (деструктуризаций composables) */
  localBindings: number;

  /** Количество разрешённых props → source */
  props: number;

  /** Количество разрешённых emit → parent handler */
  emits: number;

  /** Количество разрешённых v-model → model + localVar */
  vModels: number;

  /** Количество разрешённых <component :is> → import/map */
  dynamicComponents: number;

  /** Количество разрешённых Pinia stores */
  stores: number;

  /** Количество разрешённых router.push → route */
  routes: number;

  /** Количество разрешённых v-my-directive → import/binding */
  directives: number;
}

// ============================================================
// МЕТРИКИ PIPELINE
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
  // ✅ НОВОЕ v2.0.0: RELATION-МЕТРИКИ
  // ──────────────────────────────────────────────────

  /**
   * Количество разрешённых кросс-файловых связей.
   * Заполняется в ResolveRelationsStage.
   */
  relationsResolved?: RelationsResolvedMetrics;

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

  /**
   * ✅ НОВОЕ v2.0.0: метрики разрешённых связей
   * (копия из metrics.relationsResolved для удобства).
   */
  relationsStats?: RelationsResolvedMetrics;
}

// ============================================================
// ИНТЕРФЕЙС STAGE
// ============================================================

export interface PipelineStage<TInput = PipelineContext, TOutput = PipelineContext> {
  readonly name: string;
  run(input: TInput): Promise<TOutput> | TOutput;
}
