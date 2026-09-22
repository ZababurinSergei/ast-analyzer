// src/pipeline/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ANALYSIS PIPELINE
// ============================================================
// Версия: 2.1.0
//
// ИЗМЕНЕНИЯ v2.1.0 (P3 — cross-file resolution):
//   - ✅ ДОБАВЛЕН реэкспорт ResolveCrossFileStage
//     (новый stage для межфайловых вызовов через ts-morph)
//   - ✅ ОБНОВЛЕНО: PIPELINE_MODULE_VERSION = '2.1.0'
//   - ✅ ДОБАВЛЕНО: реэкспорт типов из cross-file-resolver
//     (CrossFileCall, CrossFileResolverOptions, ResolveStats, ResolvedCallee)
//   - ✅ ОБНОВЛЕНО: архитектурная схема (Stage 5 теперь ResolveCrossFile)
//
// ИЗМЕНЕНИЯ v2.0.0 (интеграция relation-resolver):
//   - ✅ ДОБАВЛЕН реэкспорт ResolveRelationsStage
//     (новый stage для кросс-файловых связей)
//   - ✅ УДАЛЕН реэкспорт EnrichReExportsStage
//     (re-exports теперь разворачиваются внутри ParseFileStage)
//   - ✅ УДАЛЕН реэкспорт файла './stages/enrich-re-exports.js'
//     (сам файл удалён)
//   - ✅ ОБНОВЛЕНО: комментарии и архитектурные схемы
//     под v2.0.0
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая структура: экспорт AnalysisPipeline,
//     createContext, ошибок, типов, stages, веток парсинга
//
// ============================================================
// НАЗНАЧЕНИЕ
// ============================================================
//
// Публичный API pipeline-модуля. Здесь собраны:
//   - Основной класс `AnalysisPipeline` — оркестратор
//   - Все stages по отдельности (для тестов и кастомных pipeline)
//   - Ветки парсинга: TS/JS и Vue (ответвление)
//   - Типы, контекст, ошибки
//
// ============================================================
// АРХИТЕКТУРА (v2.1.0)
// ============================================================
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
//                    │ Stage 3: Normalize │
//                    │  Entities          │
//                    └─────────┬──────────┘
//                              │
//                    ┌─────────▼──────────┐
//                    │ Stage 4: Resolve   │
//                    │  Relations         │
//                    │  (refCalls, props, │
//                    │   emits, stores...)│
//                    └─────────┬──────────┘
//                              │
//                    ┌─────────▼──────────┐
//                    │ Stage 5: Resolve   │  ⬅ НОВЫЙ v2.1.0 (P3)
//                    │  CrossFile         │
//                    │  (ts-morph, symbols│
//                    │   межфайловые)     │
//                    └─────────┬──────────┘
//                              │
//                    ┌─────────▼──────────┐
//                    │ Stage 6: Build     │
//                    │  Report            │
//                    └────────────────────┘
//
// ============================================================
// ИСПОЛЬЗОВАНИЕ
// ============================================================
//
//   import { AnalysisPipeline } from './pipeline/index.js';
//
//   const pipeline = new AnalysisPipeline();
//   const result = await pipeline.run({
//     projectRoot: './src',
//     mode: 'compact',
//     valuesMode: 'relations',
//     enableCrossFileResolution: true,  // ✅ v2.1.0 (P3)
//     verbose: true,
//   });
//
//   // result.compact          → CompactJSON
//   // result.full             → FullJSON
//   // result.metrics          → метрики pipeline
//   // result.metrics.crossFileCalls — ✅ v2.1.0 (P3)
//   // result.errors           → ошибки файлов
//
// ============================================================
// ЗАЧЕМ ЭТОТ МОДУЛЬ
// ============================================================
//
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
// Теперь (v2.1.0):
//   - единый `AnalysisPipeline.run()`
//   - явный `ParseFileStage.dispatch()` для ветвления
//   - каждый stage — отдельный класс (тестируемый)
//   - явный проброс template-полей в NormalizeEntitiesStage
//   - явный ResolveRelationsStage для кросс-файловых связей
//   - явный ResolveCrossFileStage для межфайловых вызовов (P3)
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
//   - Stage 3: ctx.enhancedMap
//   - Stage 4: ctx.enhancedMap (обогащённый relation-связями)
//   - Stage 5: ctx.crossFileCalls (✅ v2.1.0, P3)
//   - Stage 6: ctx.full, ctx.compact
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
   *
   * ✅ v2.1.0 (P3): добавлено enableCrossFileResolution
   */
  PipelineOptions,

  /**
   * Разрешённые опции (после нормализации).
   */
  ResolvedPipelineOptions,

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
   *
   * ✅ v2.1.0 (P3): добавлены crossFileCalls, crossFileSameFileCalls,
   *   crossFileUnresolved, crossFileDuration, crossFileInitDuration,
   *   crossFileCacheHits
   */
  PipelineMetrics,

  /**
   * ✅ v2.0.0: метрики разрешённых связей
   * (refCalls, eventHandlers, composables, ...).
   */
  RelationsResolvedMetrics,

  /**
   * Ошибка обработки одного файла.
   */
  FileError,

  // ============================================
  // Интерфейс stage
  // ============================================

  /**
   * Интерфейс stage. Реализуется каждым этапом pipeline.
   */
  PipelineStage,

  /**
   * ✅ v2.0.0: тип TemplateRecord для контекста.
   */
  TemplateRecord,
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
// ПОСЛЕДОВАТЕЛЬНОСТЬ ПО УМОЛЧАНИЮ (v2.1.0):
//
//   1. DiscoverFilesStage      — собрать файлы
//   2. ParseFileStage          — диспетчер: TS/JS или Vue
//   3. NormalizeEntitiesStage  — EntitiesResult → EnhancedEntityInfo
//   4. ResolveRelationsStage   — кросс-файловые связи (refCalls, props, emits...)
//   5. ResolveCrossFileStage   — межфайловые вызовы через ts-morph (P3)
//   6. BuildReportStage        — FullJSON → CompactJSON
//
// ⚠️ Изменения в v2.1.0:
//   - ДОБАВЛЕН ResolveCrossFileStage — межфайловые вызовы (P3)
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
//   - .vue                        → Vue-ветка
//   - .ts/.tsx/.js/.jsx/.mjs/.cjs → TS/JS-ветка
//
// ⚠️ ЭТО ЕДИНСТВЕННОЕ МЕСТО, где принимается решение
// о выборе ветки. Обе ветки возвращают EntitiesResult
// — единый формат для дальнейших stages.
//
// Внутри ParseFileStage также разворачиваются re-exports
// (`export * from`, `export { x } from`).
// ------------------------------------------------------------

export { ParseFileStage } from './stages/parse-file.js';

// ------------------------------------------------------------
// 5.3. Stage 3: NormalizeEntities
// ------------------------------------------------------------
// Конвертирует EntitiesResult → EnhancedEntityInfo.
//
// ⚠️ КРИТИЧНО ДЛЯ VUE: здесь ЯВНО пробрасываются
// template-поля (conditionals, lifecycle, effects, injections,
// reactivity, refs, cssVariables, deepSelectors, directives,
// usedComponents, slots, complexity).
//
// Без этого проброса секция `conditionals` теряется на этапе
// normalize, и в FullJSON попадает пустой массив.
// ------------------------------------------------------------

export { NormalizeEntitiesStage } from './stages/normalize-entities.js';

// ------------------------------------------------------------
// 5.4. Stage 4: ResolveRelations ✅ v2.0.0
// ------------------------------------------------------------
// Запускает relation-resolver для кросс-файловых связей.
//
// Обогащает templates полями:
//   - refCalls           — contextMenu.value?.openContextMenu()
//   - localBindings      — const { data } = useDataState()
//   - exposedMethods     — defineExpose
//   - props              — defineProps
//   - models             — defineModel
//   - slotDefinitions    — defineSlots
//   - options            — defineOptions
//   - emits.consumers    — emit → parent handler
//   - dynamicComponents.resolvedComponents
//   - directives.definition
//
// Это ЕДИНСТВЕННЫЙ stage, который знает о кросс-файловых
// связях (использует global-index).
// ------------------------------------------------------------

export { ResolveRelationsStage } from './stages/resolve-relations.js';

// ------------------------------------------------------------
// 5.5. Stage 5: ResolveCrossFile ✅ НОВЫЙ v2.1.0 (P3)
// ------------------------------------------------------------
// Запускает cross-file resolver через ts-morph.
//
// Для каждого CallExpression/NewExpression во всех файлах:
//   1. Резолвит callee через TypeScript-символы
//   2. Находит точное объявление (file, line)
//   3. Строит CrossFileCall[] с точными fromFunctionId/toFunctionId
//
// Результат сохраняется в ctx.crossFileCalls и обогащает
// calls[] в compact-reporter (см. compact-reporter.ts).
//
// ПОДДЕРЖИВАЕМЫЕ СЛУЧАИ:
//   - foo()                    — Identifier
//   - obj.foo()                — PropertyAccessExpression
//   - obj['foo']()             — ElementAccessExpression
//   - new Foo()                — NewExpression
//   - foo()()                  — CallExpression
//   - (await foo()).bar()      — AwaitExpression + PropertyAccess
//   - .vue через виртуальные SourceFile (<script setup>)
//
// ЧТО РЕШАЕТ:
//   - Точные межфайловые вызовы (раньше — эвристика по имени)
//   - Правильное разрешение алиасов из tsconfig
//   - Работа с .vue SFC
//
// ⚠️ Отключается через options.enableCrossFileResolution = false.
// ------------------------------------------------------------

export { ResolveCrossFileStage } from './stages/resolve-cross-file.js';

// ------------------------------------------------------------
// 5.6. Stage 6: BuildReport
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
// ------------------------------------------------------------

export { parseVueFile } from './stages/parse-vue.js';

// ============================================================
// 7. ✅ v2.1.0 (P3): CROSS-FILE RESOLVER — ТИПЫ И УТИЛИТЫ
// ============================================================
// Реэкспорт публичных типов и функций cross-file resolver.
//
// Используется для:
//   - интеграции с CLI (для сохранения отчётов)
//   - интеграции с reporters/compact-reporter (для обогащения calls)
//   - unit-тестов
// ============================================================

export type {
  /** Разрешённый межфайловый вызов */
  CrossFileCall,
  /** Опции cross-file resolver */
  CrossFileResolverOptions,
  /** Метрики cross-file resolver */
  ResolveStats,
  /** Результат разрешения callee */
  ResolvedCallee,
  /** Mapping .vue-файлов */
  VueLineMapping,
} from '../core/cross-file-resolver/types.js';

export {
  /** Главная функция: resolveCrossFileCalls */
  resolveCrossFileCalls,
} from '../core/cross-file-resolver/index.js';

// ============================================================
// 8. ЭКСПОРТ ПО УМОЛЧАНИЮ
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
import { NormalizeEntitiesStage } from './stages/normalize-entities.js';
import { ResolveRelationsStage } from './stages/resolve-relations.js';
import { ResolveCrossFileStage } from './stages/resolve-cross-file.js';
import { BuildReportStage } from './stages/build-report.js';
import { parseTypeScriptFile } from './stages/parse-typescript.js';
import { parseVueFile } from './stages/parse-vue.js';
import { resolveCrossFileCalls } from '../core/cross-file-resolver/index.js';

/**
 * Версия модуля pipeline.
 *
 * ⚠️ При изменении публичного API (добавлении/удалении
 * экспортов, изменении сигнатур) — поднимать версию.
 *
 * ✅ v2.1.0 (P3): 2.0.0 → 2.1.0 (добавлен ResolveCrossFileStage)
 */
export const PIPELINE_MODULE_VERSION = '2.1.0';

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
  // Stages (6 штук в v2.1.0)
  // ============================================
  DiscoverFilesStage,
  ParseFileStage,
  NormalizeEntitiesStage,
  ResolveRelationsStage,
  ResolveCrossFileStage, // ✅ v2.1.0 (P3)
  BuildReportStage,

  // ============================================
  // Ветки парсинга
  // ============================================
  parseTypeScriptFile,
  parseVueFile,

  // ============================================
  // ✅ v2.1.0 (P3): Cross-file resolver
  // ============================================
  resolveCrossFileCalls,

  // ============================================
  // Константы
  // ============================================
  PIPELINE_MODULE_VERSION,
  PIPELINE_MODULE_NAME,
};
