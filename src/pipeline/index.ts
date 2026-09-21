// src/pipeline/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ANALYSIS PIPELINE
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Публичный API pipeline-модуля. Здесь собраны:
//   - Основной класс `AnalysisPipeline` — оркестратор
//   - Все stages по отдельности (для тестов и кастомных pipeline)
//   - Ветки парсинга: TS/JS и Vue (ответвление)
//   - Типы, контекст, ошибки
//
// АРХИТЕКТУРА
// ------------------------------------------------------------
//
//                    ┌─────────────────────────┐
//                    │   AnalysisPipeline      │
//                    │   (единая точка входа)  │
//                    └───────────┬─────────────┘
//                                │
//                    ┌───────────▼─────────────┐
//                    │  Stage 1: DiscoverFiles │
//                    └───────────┬─────────────┘
//                                │
//                    ┌───────────▼─────────────┐
//                    │  Stage 2: ParseFile     │
//                    │  (диспетчер)            │
//                    └──┬──────────────┬───────┘
//                       │              │
//        ┌──────────────▼───┐    ┌────▼────────────────┐
//        │  TS/JS/TSX/JSX   │    │      Vue SFC        │
//        │  parseTypeScript │    │  parseVueFile       │
//        │    File()        │    │    ↓                │
//        │       ↓          │    │  analyzeVueComponent│
//        │  extractEntities │    │       ↓             │
//        │    FromAST()     │    │  convertVueAnalysis │
//        │                  │    │    ToEntities()     │
//        └──────────┬───────┘    └────────┬────────────┘
//                   │                     │
//                   └──────────┬──────────┘
//                              │
//                    ┌─────────▼──────────┐
//                    │ Stage 3: Enrich    │
//                    │  ReExports         │
//                    └─────────┬──────────┘
//                              │
//                    ┌─────────▼──────────┐
//                    │ Stage 4: Normalize │
//                    │  Entities          │
//                    └─────────┬──────────┘
//                              │
//                    ┌─────────▼──────────┐
//                    │ Stage 5: Build     │
//                    │  Report            │
//                    └────────────────────┘
//
// ИСПОЛЬЗОВАНИЕ
// ------------------------------------------------------------
//
//   import { AnalysisPipeline } from './pipeline/index.js';
//
//   const pipeline = new AnalysisPipeline();
//   const result = await pipeline.run({
//     projectRoot: './src',
//     mode: 'compact',
//     valuesMode: 'relations',
//     verbose: true,
//   });
//
//   // result.compact  → CompactJSON
//   // result.full     → FullJSON
//   // result.metrics  → метрики pipeline
//   // result.errors   → ошибки файлов
//
// ЗАЧЕМ ЭТОТ МОДУЛЬ
// ------------------------------------------------------------
// Ранее логика анализа была разбросана по:
//   - cli.ts / CompactRecursiveCommand.ts  — цикл по файлам
//   - core/entity-extractor/extract-entities.ts — Vue-ветка внутри
//   - reporters/compact-reporter.ts        — enrich re-exports
//
// Это давало:
//   - дублирование логики сбора файлов
//   - неявное ветвление для Vue (внутри extractEntities)
//   - трудности с тестированием отдельных этапов
//   - потерю template-полей при normalize (баг с conditionals)
//
// Теперь:
//   - единый `AnalysisPipeline.run()`
//   - явный `ParseFileStage.dispatch()` для ветвления
//   - каждый stage — отдельный класс (тестируемый)
//   - явный проброс template-полей в NormalizeEntitiesStage
// ============================================================

// ============================================================
// 1. ОСНОВНОЙ КЛАСС PIPELINE
// ============================================================
// Оркестратор. Запускает stages последовательно, собирает
// метрики, обрабатывает ошибки.
// ============================================================

export { AnalysisPipeline } from './AnalysisPipeline.js';

// ============================================================
// 2. КОНТЕКСТ PIPELINE
// ============================================================
// `createContext(options)` — фабрика контекста.
//
// Контекст мутируется stages последовательно:
//   - Stage 1: ctx.files
//   - Stage 2: ctx.entitiesMap, ctx.metrics
//   - Stage 3: ctx.entitiesMap (обогащённый), ctx.metrics
//   - Stage 4: ctx.enhancedMap
//   - Stage 5: ctx.full, ctx.compact
// ============================================================

export { createContext } from './context.js';

// ============================================================
// 3. ТИПЫ PIPELINE
// ============================================================
// Все публичные типы для работы с pipeline.
//
// ⚠️ ВАЖНО: канонические определения — в './types.js'.
// Не дублируйте их в других местах.
// ============================================================

export type {
  // ============================================
  // Режимы и опции
  // ============================================

  /**
   * Режим вывода pipeline:
   *   - 'full'           — полный FullJSON + CompactJSON
   *   - 'compact'        — только CompactJSON (без full на диске)
   *   - 'entities-only'  — только entitiesMap (без отчёта)
   */
  PipelineMode,

  /**
   * Режим сериализации секции values в CompactJSON:
   *   - 'full'      — все значения (обратная совместимость)
   *   - 'relations' — только значения для восстановления связей
   */
  ValuesMode,

  /**
   * Опции pipeline. Все опциональны, дефолты — в context.ts.
   */
  PipelineOptions,

  // ============================================
  // Контекст
  // ============================================

  /**
   * Контекст pipeline. Мутируется stages последовательно.
   */
  PipelineContext,

  // ============================================
  // Результат
  // ============================================

  /**
   * Результат выполнения pipeline.
   */
  PipelineResult,

  // ============================================
  // Метрики и ошибки
  // ============================================

  /**
   * Метрики pipeline: количество файлов, функций, тайминги.
   */
  PipelineMetrics,

  /**
   * Ошибка обработки одного файла.
   * Собирается в `ctx.errors` при `continueOnError: true`.
   */
  FileError,

  // ============================================
  // Интерфейс stage
  // ============================================

  /**
   * Интерфейс stage. Реализуется каждым этапом pipeline.
   *
   * Позволяет:
   *   - собирать кастомные pipeline
   *   - тестировать stages по отдельности
   *   - добавлять/удалять stages
   */
  PipelineStage,
} from './types.js';

// ============================================================
// 4. ОШИБКИ PIPELINE
// ============================================================
// Иерархия ошибок:
//
//   Error
//     └── PipelineError        (базовая)
//           └── StageError     (ошибка конкретного stage)
//
// `StageError` содержит поле `stage` — имя stage, где произошла
// ошибка. Это упрощает отладку и логирование.
// ============================================================

export {
  /** Базовая ошибка pipeline */
  PipelineError,
  /** Ошибка конкретного stage */
  StageError,
} from './errors.js';

// ============================================================
// 5. STAGES — ОТДЕЛЬНЫЕ ЭТАПЫ PIPELINE
// ============================================================
// Каждый stage — самостоятельный класс, реализующий
// `PipelineStage`. Можно использовать:
//
//   - как часть `AnalysisPipeline` (по умолчанию)
//   - в кастомном pipeline (передать в конструктор)
//   - в unit-тестах (запустить изолированно)
//
// ПОСЛЕДОВАТЕЛЬНОСТЬ ПО УМОЛЧАНИЮ:
//
//   1. DiscoverFilesStage     — собрать файлы
//   2. ParseFileStage         — диспетчер: TS/JS или Vue
//   3. EnrichReExportsStage   — развернуть re-exports
//   4. NormalizeEntitiesStage — EntitiesResult → EnhancedEntityInfo
//   5. BuildReportStage       — FullJSON → CompactJSON
// ============================================================

// ------------------------------------------------------------
// 5.1. Stage 1: DiscoverFiles
// ------------------------------------------------------------
// Собирает файлы проекта через `collectFilesForAnalysis`.
//
// Делегирует в ЕДИНЫЙ источник — `ci-cd/collect-files.ts`.
// Здесь НЕ дублируется логика обхода директорий.
// ------------------------------------------------------------

export { DiscoverFilesStage } from './stages/discover-files.js';

// ------------------------------------------------------------
// 5.2. Stage 2: ParseFile (диспетчер)
// ------------------------------------------------------------
// Ключевой stage. Определяет, какой парсер использовать:
//
//   - .vue                       → Vue-ветка
//   - .ts/.tsx/.js/.jsx/.mjs/.cjs → TS/JS-ветка
//
// ⚠️ ЭТО ЕДИНСТВЕННОЕ МЕСТО, где принимается решение
// о выборе ветки. Обе ветки возвращают EntitiesResult
// — единый формат для дальнейших stages.
// ------------------------------------------------------------

export { ParseFileStage } from './stages/parse-file.js';

// ------------------------------------------------------------
// 5.3. Stage 3: EnrichReExports
// ------------------------------------------------------------
// Разворачивает re-exports (`export * from`, `export { x } from`)
// в прямые связи. Применяется К ОБЕИМ ВЕТКАМ.
//
// Использует `enrichWithReExports` из entity-extractor.
// ------------------------------------------------------------

export { EnrichReExportsStage } from './stages/enrich-re-exports.js';

// ------------------------------------------------------------
// 5.4. Stage 4: NormalizeEntities
// ------------------------------------------------------------
// Конвертирует EntitiesResult → EnhancedEntityInfo.
//
// ⚠️ КРИТИЧНО ДЛЯ VUE: здесь ЯВНО пробрасываются
// template-поля (conditionals, lifecycle, effects, injections,
// reactivity, refs, cssVariables, deepSelectors, directives,
// usedComponents, slots, complexity).
//
// Без этого проброса секция `conditionals` теряется на этапе
// normalize, и в FullJSON попадает пустой массив — что даёт
// расхождение `decoded=0, full=30` при round-trip.
// ------------------------------------------------------------

export { NormalizeEntitiesStage } from './stages/normalize-entities.js';

// ------------------------------------------------------------
// 5.5. Stage 5: BuildReport
// ------------------------------------------------------------
// Генерирует финальный отчёт через `generateCompactReport`.
//
// НЕ дублирует логику сборки FullJSON — делегирует в
// `reporters/compact-reporter.ts` (единый источник).
//
// В режиме 'entities-only' — no-op.
// ------------------------------------------------------------

export { BuildReportStage } from './stages/build-report.js';

// ============================================================
// 6. ВЕТКИ ПАРСИНГА — TS/JS И VUE
// ============================================================
// Экспортируются отдельно для:
//   - прямого использования (без pipeline)
//   - unit-тестов каждой ветки
//   - кастомных pipeline (своя логика ветвления)
//
// ФУНКЦИИ:
//   - parseTypeScriptFile(file, ctx) → EntitiesResult | null
//   - parseVueFile(file, ctx)        → EntitiesResult | null
// ============================================================

// ------------------------------------------------------------
// 6.1. TS/JS-ветка
// ------------------------------------------------------------
// Использует:
//   - parseFile              (ESTree AST через @typescript-eslint/parser)
//   - extractEntitiesFromAST (стандартное извлечение сущностей)
//
// НЕ использует Vue-специфичную логику.
// ------------------------------------------------------------

export { parseTypeScriptFile } from './stages/parse-typescript.js';

// ------------------------------------------------------------
// 6.2. Vue-ветка (ответвление)
// ------------------------------------------------------------
// Использует:
//   - analyzeVueComponent            (@vue/compiler-sfc)
//   - convertVueAnalysisToEntities   (VueAnalysis → EntitiesResult)
//
// Возвращает EntitiesResult с ДОПОЛНИТЕЛЬНЫМИ template-полями:
//   - templateConditionals
//   - templateLifecycle
//   - templateEffects
//   - templateInjections
//   - templateReactivity
//   - templateRefs
//   - templateCssVariables
//   - templateDeepSelectors
//   - templateDirectives
//   - templateUsedComponents
//   - templateSlots
//   - templateComplexity
//
// ⚠️ После возврата в основной pipeline — продолжается
// общими stages 3-5.
// ------------------------------------------------------------

export { parseVueFile } from './stages/parse-vue.js';

// ============================================================
// 7. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
// Собираем все основные экспорты в один объект для удобства:
//
//   import pipeline from './pipeline/index.js';
//   pipeline.AnalysisPipeline  → класс
//   pipeline.DiscoverFilesStage → stage
//   pipeline.PipelineError      → ошибка
// ============================================================

import { AnalysisPipeline } from './AnalysisPipeline.js';
import { createContext } from './context.js';
import { PipelineError, StageError } from './errors.js';
import { DiscoverFilesStage } from './stages/discover-files.js';
import { ParseFileStage } from './stages/parse-file.js';
import { EnrichReExportsStage } from './stages/enrich-re-exports.js';
import { NormalizeEntitiesStage } from './stages/normalize-entities.js';
import { BuildReportStage } from './stages/build-report.js';
import { parseTypeScriptFile } from './stages/parse-typescript.js';
import { parseVueFile } from './stages/parse-vue.js';

/**
 * Версия модуля pipeline.
 *
 * ⚠️ При изменении публичного API (добавлении/удалении
 * экспортов, изменении сигнатур) — поднимать версию.
 */
export const PIPELINE_MODULE_VERSION = '1.0.0';

/**
 * Имя модуля pipeline.
 */
export const PIPELINE_MODULE_NAME = '@newkind/ast-analyzer/pipeline';

export default {
  // ============================================
  // Основной класс
  // ============================================
  AnalysisPipeline,

  // ============================================
  // Контекст
  // ============================================
  createContext,

  // ============================================
  // Ошибки
  // ============================================
  PipelineError,
  StageError,

  // ============================================
  // Stages
  // ============================================
  DiscoverFilesStage,
  ParseFileStage,
  EnrichReExportsStage,
  NormalizeEntitiesStage,
  BuildReportStage,

  // ============================================
  // Ветки парсинга
  // ============================================
  parseTypeScriptFile,
  parseVueFile,

  // ============================================
  // Константы
  // ============================================
  PIPELINE_MODULE_VERSION,
  PIPELINE_MODULE_NAME,
};
