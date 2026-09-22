// src/pipeline/types.ts
// ============================================================
// ТИПЫ PIPELINE
// ============================================================
// Версия: 3.0.0
//
// ИЗМЕНЕНИЯ v3.0.0 (P3 — cross-file resolution):
//   - ✅ ДОБАВЛЕНО: PipelineOptions.enableCrossFileResolution
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileCalls
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileSameFileCalls
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileUnresolved
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileDuration
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileInitDuration
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileCacheHits
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileCacheMisses
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileFilesAdded
//   - ✅ ДОБАВЛЕНО: PipelineMetrics.crossFileVueFilesAdded
//   - ✅ ОБНОВЛЕНО: версия типа 2.0.0 → 3.0.0
//
// ИЗМЕНЕНИЯ v2.0.0 (интеграция relation-resolver):
//   - ✅ ДОБАВЛЕНО: RelationsResolvedMetrics
//   - ✅ ДОБАВЛЕНО: TemplateRecord
//   - ✅ ДОБАВЛЕНО: поле relationsResolved в PipelineMetrics
//   - ✅ ДОБАВЛЕНО: поле relationsStats в PipelineResult
//   - ✅ ДОБАВЛЕНО: ResolvedPipelineOptions вынесен в отдельный тип
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

  // ──────────────────────────────────────────────────
  // ✅ НОВОЕ v3.0.0 (P3): CROSS-FILE RESOLUTION
  // ──────────────────────────────────────────────────

  /**
   * Включить cross-file resolution через ts-morph.
   *
   * Если `true` (по умолчанию) — запускается
   * `ResolveCrossFileStage` после `ResolveRelationsStage`.
   *
   * Если `false` — этап пропускается, межфайловые вызовы
   * остаются неразрешёнными (как до P3).
   *
   * По умолчанию: `true`.
   */
  enableCrossFileResolution?: boolean;

  /**
   * Максимум файлов для cross-file analysis.
   * Защита от очень больших проектов (10k+ файлов).
   *
   * По умолчанию: 5000.
   */
  crossFileMaxFiles?: number;

  /**
   * Включать `.vue`-файлы в cross-file analysis
   * (через виртуальные SourceFile).
   *
   * По умолчанию: `true`.
   */
  crossFileIncludeVue?: boolean;

  /**
   * Включать `.js`/`.jsx` в cross-file analysis.
   *
   * По умолчанию: `true`.
   */
  crossFileIncludeJs?: boolean;

  /**
   * Использовать кэш резолвинга (symbol cache + call site cache).
   *
   * По умолчанию: `true`.
   */
  crossFileCache?: boolean;

  /**
   * Путь к `tsconfig.json` для cross-file resolution.
   *
   * Если не задан — ищется автоматически вверх по иерархии
   * от `projectRoot`.
   */
  crossFileTsConfigPath?: string;

  /**
   * Коллбэк прогресса cross-file resolution.
   *
   * Вызывается каждые N обработанных файлов.
   */
  crossFileOnProgress?: (processed: number, total: number) => void;
}

/**
 * Опции, гарантированно заполненные дефолтами.
 * `paths`, `inputPaths` и `projectRoot` — уже нормализованы
 * до абсолютных путей.
 */
export type ResolvedPipelineOptions = Required<
  Omit<
    PipelineOptions,
    | 'paths'
    | 'inputPaths'
    | 'projectRoot'
    | 'outputPath'
    | 'crossFileTsConfigPath'
    | 'crossFileOnProgress'
  >
> & {
  paths: string[];
  inputPaths: string[];
  projectRoot: string;
  outputPath?: string;
  crossFileTsConfigPath?: string;
  crossFileOnProgress?: (processed: number, total: number) => void;
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

  /**
   * ✅ НОВОЕ v3.0.0 (P3): разрешённые межфайловые вызовы.
   *
   * Заполняется `ResolveCrossFileStage`. Используется
   * в `BuildReportStage` для обогащения `calls[]`.
   */
  crossFileCalls?: CrossFileCallRecord[];
}

export interface FileError {
  file: string;
  stage: string;
  message: string;
  stack?: string;
}

// ============================================================
// ✅ НОВОЕ v3.0.0 (P3): CROSS-FILE CALL RECORD
// ============================================================
//
// Внутренний формат разрешённого межфайлового вызова,
// который передаётся из `ResolveCrossFileStage` в
// `BuildReportStage` через `ctx.crossFileCalls`.
//
// ⚠️ Это НЕ `CallData` из `codec-types.ts`. `CallData` —
// публичный формат отчёта. `CrossFileCallRecord` — внутренний
// промежуточный формат с полем `isCrossFile` для фильтрации.
// ============================================================

export interface CrossFileCallRecord {
  /** ID вызывающей функции (fn1, fn2, ...) */
  fromFunctionId: string;

  /** ID вызываемой функции (fn1, fn2, ...) */
  toFunctionId: string;

  /** Строка вызова в исходном файле */
  line: number;

  /** Колонка вызова (опционально) */
  column?: number;

  /**
   * Вид вызова.
   *
   * Заполняется `SymbolResolver` на основе типа declaration:
   *   - 'function'    → 'direct'
   *   - 'method'      → 'method'
   *   - 'constructor' → 'constructor' | 'new'
   *   - 'arrow'       → 'direct'
   *   - 'callback'    → 'callback'
   */
  callKind: 'direct' | 'method' | 'constructor' | 'new' | 'callback';

  /** Имя callee (для отладки) */
  calleeName?: string;

  /**
   * Является ли вызов межфайловым.
   *
   * `true`  — from и to в разных файлах.
   * `false` — внутрифайловый (не добавляется в `calls[]`,
   *           потому что уже есть в основном графе).
   */
  isCrossFile: boolean;

  /** ID файла-цели (f1, f2, ...) */
  targetFileId: string;
}

// ============================================================
// ✅ v2.0.0: TEMPLATE RECORD
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
// ✅ v2.0.0: МЕТРИКИ RELATION-RESOLVER
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
// ✅ НОВОЕ v3.0.0 (P3): МЕТРИКИ CROSS-FILE RESOLVER
// ============================================================

/**
 * Метрики cross-file resolution.
 *
 * Заполняется в `ResolveCrossFileStage`.
 *
 * ⚠️ Дублируется с `ResolveStats` из `cross-file-resolver/types.ts`,
 * но в `PipelineMetrics` вынесено плоско (без вложенности),
 * чтобы не менять структуру `PipelineMetrics`.
 */
export interface CrossFileResolvedMetrics {
  /** Всего вызовов найдено */
  totalCalls: number;

  /** Разрешено внутри файла (не добавляется в `calls[]`) */
  sameFileCalls: number;

  /** Разрешено между файлами (добавляется в `calls[]`) */
  crossFileCalls: number;

  /** Не разрешено */
  unresolvedCalls: number;

  /** Попаданий в кэш */
  cacheHits: number;

  /** Промахов кэша */
  cacheMisses: number;

  /** Время выполнения (мс) */
  durationMs: number;

  /** Время инициализации ts-morph Project (мс) */
  initDurationMs: number;

  /** Время резолвинга (мс) */
  resolveDurationMs: number;

  /** Количество файлов, добавленных в Project */
  filesAdded: number;

  /** Количество `.vue`-файлов */
  vueFilesAdded: number;

  /** Ошибки при добавлении файлов */
  addFileErrors: number;
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
  // ✅ v2.0.0: RELATION-МЕТРИКИ
  // ──────────────────────────────────────────────────

  /**
   * Количество разрешённых кросс-файловых связей.
   * Заполняется в ResolveRelationsStage.
   */
  relationsResolved?: RelationsResolvedMetrics;

  // ──────────────────────────────────────────────────
  // ✅ НОВОЕ v3.0.0 (P3): CROSS-FILE МЕТРИКИ
  // ──────────────────────────────────────────────────
  //
  // Дублируем плоско (без вложенности), чтобы не менять
  // структуру PipelineMetrics. Внутри — те же поля, что
  // в `CrossFileResolvedMetrics`.
  //
  // Если нужно — можно использовать вложенный объект
  // `crossFile?: CrossFileResolvedMetrics`, но плоско —
  // проще для чтения в консоли и JSON.
  // ──────────────────────────────────────────────────

  /** Всего вызовов найдено */
  crossFileCalls?: number;

  /** Разрешено внутри файла */
  crossFileSameFileCalls?: number;

  /** Разрешено между файлами */
  crossFileCrossFileCalls?: number;

  /** Не разрешено */
  crossFileUnresolved?: number;

  /** Попаданий в кэш */
  crossFileCacheHits?: number;

  /** Промахов кэша */
  crossFileCacheMisses?: number;

  /** Время cross-file resolution (мс) */
  crossFileDuration?: number;

  /** Время инициализации ts-morph Project (мс) */
  crossFileInitDuration?: number;

  /** Время резолвинга (мс) */
  crossFileResolveDuration?: number;

  /** Количество файлов, добавленных в Project */
  crossFileFilesAdded?: number;

  /** Количество `.vue`-файлов */
  crossFileVueFilesAdded?: number;

  /** Ошибки при добавлении файлов */
  crossFileAddFileErrors?: number;

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
   * ✅ v2.0.0: метрики разрешённых связей
   * (копия из metrics.relationsResolved для удобства).
   */
  relationsStats?: RelationsResolvedMetrics;

  /**
   * ✅ НОВОЕ v3.0.0 (P3): метрики cross-file resolution
   * (копия из metrics для удобства).
   */
  crossFileStats?: CrossFileResolvedMetrics;
}

// ============================================================
// ИНТЕРФЕЙС STAGE
// ============================================================

export interface PipelineStage<TInput = PipelineContext, TOutput = PipelineContext> {
  readonly name: string;
  run(input: TInput): Promise<TOutput> | TOutput;
}
