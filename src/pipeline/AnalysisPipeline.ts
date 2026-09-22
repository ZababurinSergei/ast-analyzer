// src/pipeline/AnalysisPipeline.ts
// ============================================================
// ЕДИНЫЙ АНАЛИЗ PIPELINE — ОРКЕСТРАТОР
// ============================================================
// Версия: 2.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v2.1.0 (P3 — cross-file resolution):
//   - ✅ ДОБАВЛЕН ResolveCrossFileStage
//     Он запускается ПОСЛЕ ResolveRelationsStage и
//     ПЕРЕД BuildReportStage — резолвит межфайловые
//     вызовы через ts-morph (P3).
//   - ✅ ОБНОВЛЁН стандартный набор stages (6 штук):
//       DiscoverFiles → ParseFile → NormalizeEntities →
//       ResolveRelations → ResolveCrossFile → BuildReport
//   - ✅ ОБНОВЛЕНО: printHeader() — добавлена строка про
//     cross-file resolution.
//   - ✅ ОБНОВЛЕНО: printFooter() — добавлены метрики
//     cross-file (crossFileCalls, crossFileDuration и др.).
//   - ✅ Обновлён комментарий-заголовок: v2.0.0 → v2.1.0.
//
// v2.0.0 (интеграция relation-resolver):
//   - ✅ ДОБАВЛЕН ResolveRelationsStage (Vue-связи)
//   - ✅ УБРАН EnrichReExportsStage
//   - ✅ 5 стандартных stages
//
// v1.0.0:
//   - Базовая реализация оркестратора
//   - 5 стандартных stages: DiscoverFiles, ParseFile,
//     EnrichReExports, NormalizeEntities, BuildReport
//
// ============================================================
// НАЗНАЧЕНИЕ
// ============================================================
//
// Оркестратор единого pipeline анализа кода. Запускает stages
// последовательно, собирает метрики, обрабатывает ошибки.
//
// ЕДИНАЯ ТОЧКА ВХОДА для всех CLI-команд, тестов и внешних
// потребителей.
//
// ============================================================
// АРХИТЕКТУРА (v2.1.0)
// ============================================================
//
//                       ┌───────────────────────┐
//                       │  AnalysisPipeline     │
//                       │  .run(options)        │
//                       └───────────┬───────────┘
//                                   │
//         ┌─────────────────────────┼─────────────────────────┐
//         │                         │                         │
//         ▼                         ▼                         ▼
//   ┌───────────┐            ┌───────────┐            ┌───────────┐
//   │ Stage 1   │            │ Stage 2   │            │ Stage 3   │
//   │ Discover  │───────────▶│ ParseFile │───────────▶│ Normalize │
//   │ Files     │            │(диспетчер)│            │ Entities  │
//   └───────────┘            └─────┬─────┘            └─────┬─────┘
//                                  │                        │
//                                  │                        ▼
//                                  │                  ┌───────────┐
//                                  │                  │ Stage 4   │
//                                  │                  │ Resolve   │
//                                  │                  │ Relations │
//                                  │                  └─────┬─────┘
//                                  │                        │
//                                  │                        ▼
//                                  │                  ┌───────────┐
//                                  │                  │ Stage 5   │
//                                  │                  │ Resolve   │  ← v2.1.0 (P3)
//                                  │                  │ CrossFile │
//                                  │                  └─────┬─────┘
//                                  │                        │
//                                  │                        ▼
//                                  │                  ┌───────────┐
//                                  │                  │ Stage 6   │
//                                  │                  │ Build     │
//                                  │                  │ Report    │
//                                  │                  └───────────┘
//                                  │
//                     ┌────────────┴────────────┐
//                     │                         │
//                     ▼                         ▼
//              ┌────────────┐            ┌────────────┐
//              │ TS/JS-ветка│            │ Vue-ветка  │
//              │ parseTS    │            │ parseVue   │
//              └────────────┘            └────────────┘
//
// ============================================================
// ПРИНЦИПЫ
// ============================================================
//
//   1. ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ
//      Каждый stage делегирует в существующий модуль:
//        - DiscoverFilesStage     → collectFilesForAnalysis
//        - ParseFileStage         → parseFile / analyzeVueComponent
//        - NormalizeEntitiesStage → convertEntitiesToEnhanced
//        - ResolveRelationsStage  → runRelationResolver
//        - ResolveCrossFileStage  → resolveCrossFileCalls   ← v2.1.0 (P3)
//        - BuildReportStage       → generateCompactReport
//
//   2. ЯВНОЕ ВЕТВЛЕНИЕ
//      Только ParseFileStage знает о существовании Vue.
//
//   3. МУТИРУЕМЫЙ КОНТЕКСТ
//      Stage.run(ctx) принимает контекст и возвращает его.
//
//   4. ТЕСТИРУЕМОСТЬ
//      Каждый stage — отдельный класс.
//
//   5. ОБРАБОТКА ОШИБОК
//      При `continueOnError: true` (по умолчанию) ошибки
//      отдельных файлов собираются в `ctx.errors`.
//
//   6. ОПЦИОНАЛЬНЫЕ STAGES  ← v2.1.0 (P3)
//      Некоторые stages можно отключать через опции:
//        - ResolveRelationsStage  → всегда включён
//        - ResolveCrossFileStage  → отключается через
//                                    enableCrossFileResolution: false
//
// ============================================================
// ИСПОЛЬЗОВАНИЕ
// ============================================================
//
//   // 1. Базовое использование (все stages включены)
//   const pipeline = new AnalysisPipeline();
//   const result = await pipeline.run({
//     projectRoot: './src',
//     mode: 'compact',
//     verbose: true,
//   });
//
//   // 2. Отключить cross-file resolution
//   const pipeline = new AnalysisPipeline();
//   const result = await pipeline.run({
//     projectRoot: './src',
//     enableCrossFileResolution: false,
//   });
//
//   // 3. Кастомный pipeline (только 3 stages)
//   const customPipeline = new AnalysisPipeline([
//     new DiscoverFilesStage(),
//     new ParseFileStage(),
//     new BuildReportStage(),
//   ]);
//   const result = await customPipeline.run({ projectRoot: './src' });
//
//   // 4. Только сбор файлов (для отладки)
//   const discover = new DiscoverFilesStage();
//   const ctx = createContext({ projectRoot: './src' });
//   const afterDiscover = await discover.run(ctx);
//   console.log(afterDiscover.files);
//
// ============================================================

import { createContext } from './context.js';
import { DiscoverFilesStage } from './stages/discover-files.js';
import { ParseFileStage } from './stages/parse-file.js';
import { NormalizeEntitiesStage } from './stages/normalize-entities.js';
import { ResolveRelationsStage } from './stages/resolve-relations.js';
// ✅ v2.1.0 (P3): cross-file resolution
import { ResolveCrossFileStage } from './stages/resolve-cross-file.js';
import { BuildReportStage } from './stages/build-report.js';
import type { PipelineContext, PipelineOptions, PipelineResult, PipelineStage } from './types.js';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

/**
 * Внутренний тип для результата одного stage.
 *
 * Используется в `runStageSafely`, чтобы можно было
 * обрабатывать ошибки и тайминги единообразно.
 */
interface StageExecutionResult {
  /** Обновлённый контекст */
  context: PipelineContext;
  /** Время выполнения в миллисекундах */
  durationMs: number;
  /** Ошибка, если stage упал (но continueOnError=true) */
  error?: Error;
}

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Единый pipeline анализа кода.
 *
 * ════════════════════════════════════════════════════════════
 * ЖИЗНЕННЫЙ ЦИКЛ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Создание:
 *      const pipeline = new AnalysisPipeline();
 *      // или
 *      const pipeline = new AnalysisPipeline([...customStages]);
 *
 *   2. Запуск:
 *      const result = await pipeline.run(options);
 *
 *   3. Многоразовое использование:
 *      const pipeline = new AnalysisPipeline();
 *      await pipeline.run({ projectRoot: './a' });
 *      await pipeline.run({ projectRoot: './b' }); // ✅ OK
 *
 * ════════════════════════════════════════════════════════════
 * STAGES ПО УМОЛЧАНИЮ (v2.1.0)
 * ════════════════════════════════════════════════════════════
 *
 *   1. DiscoverFilesStage
 *      → collectFilesForAnalysis (единый источник)
 *
 *   2. ParseFileStage
 *      → диспетчер: TS/JS или Vue
 *
 *   3. NormalizeEntitiesStage
 *      → convertEntitiesToEnhanced
 *      → ✅ ЯВНЫЙ проброс template-полей (фикс бага conditionals)
 *
 *   4. ResolveRelationsStage
 *      → runRelationResolver
 *      → Обогащает templates кросс-файловыми связями (Vue):
 *        • refCalls
 *        • localBindings
 *        • exposedMethods
 *        • props
 *        • models
 *        • slotDefinitions
 *        • options
 *        • emits.consumers
 *        • dynamicComponents.resolvedComponents
 *        • directives.definition
 *
 *   5. ResolveCrossFileStage  ← v2.1.0 (P3)
 *      → resolveCrossFileCalls
 *      → Резолвит межфайловые вызовы через ts-morph:
 *        • SymbolResolver.resolveCallee для каждого CallExpression
 *        • Заполняет ctx.crossFileCalls
 *        • Обновляет ctx.metrics.crossFileCalls, crossFileDuration
 *        • Отключается через enableCrossFileResolution: false
 *
 *   6. BuildReportStage
 *      → generateCompactReport
 *
 * ════════════════════════════════════════════════════════════
 * ПОТОКОБЕЗОПАСНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   Класс НЕ потокобезопасен.
 *   Каждый вызов `run()` создаёт НОВЫЙ контекст
 *   через `createContext()`.
 */
export class AnalysisPipeline {
  // ==========================================================
  // СВОЙСТВА
  // ==========================================================

  /**
   * Упорядоченный список stages.
   *
   * Задаётся в конструкторе. Может быть переопределён
   * для кастомных pipeline.
   */
  private readonly stages: PipelineStage[];

  // ==========================================================
  // КОНСТРУКТОР
  // ==========================================================

  /**
   * Создаёт pipeline.
   *
   * @param customStages — кастомный список stages. Если не задан,
   *                       используется стандартный набор из 6 stages
   *                       (DiscoverFiles → ParseFile → NormalizeEntities
   *                        → ResolveRelations → ResolveCrossFile
   *                        → BuildReport).
   *
   * @example
   * ```typescript
   * // Стандартный pipeline (все 6 stages)
   * const pipeline = new AnalysisPipeline();
   *
   * // Кастомный pipeline (только discover + parse + report)
   * const pipeline = new AnalysisPipeline([
   *   new DiscoverFilesStage(),
   *   new ParseFileStage(),
   *   new BuildReportStage(),
   * ]);
   *
   * // Пустой pipeline (для ручного добавления stages)
   * const pipeline = new AnalysisPipeline([]);
   * ```
   */
  constructor(customStages?: PipelineStage[]) {
    this.stages = customStages ?? [
      new DiscoverFilesStage(),
      new ParseFileStage(),
      new NormalizeEntitiesStage(),
      new ResolveRelationsStage(),
      // ✅ v2.1.0 (P3): cross-file resolution
      new ResolveCrossFileStage(),
      new BuildReportStage(),
    ];
  }

  // ==========================================================
  // ПУБЛИЧНЫЙ API
  // ==========================================================

  /**
   * Запускает pipeline.
   *
   * ════════════════════════════════════════════════════════════
   * АЛГОРИТМ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Создать контекст через `createContext(options)`.
   *   2. Вывести заголовок (если `verbose: true`).
   *   3. Для каждого stage:
   *      a. Замерить время начала.
   *      b. Выполнить `stage.run(ctx)` в try/catch.
   *      c. При ошибке:
   *         - записать в `ctx.errors`
   *         - если `continueOnError: false` — прервать pipeline
   *      d. Замерить время выполнения.
   *      e. Записать тайминг в `ctx.metrics.stageTimings[stage.name]`.
   *   4. Подсчитать общее время.
   *   5. Вернуть `PipelineResult`.
   *
   * ════════════════════════════════════════════════════════════
   * ВОЗВРАЩАЕМЫЙ РЕЗУЛЬТАТ
   * ════════════════════════════════════════════════════════════
   *
   *   {
   *     full?:          FullJSON,               // если mode !== 'entities-only'
   *     compact?:       CompactJSON,            // если mode === 'compact'
   *     entitiesMap:    Record<string, EntitiesResult>,
   *     enhancedMap:    Record<string, EnhancedEntityInfo>,
   *     metrics:        PipelineMetrics,
   *     errors:         FileError[],
   *   }
   *
   * ════════════════════════════════════════════════════════════
   * ОПЦИИ
   * ════════════════════════════════════════════════════════════
   *
   *   - `enableCrossFileResolution` (v2.1.0, P3) — включить/отключить
   *     cross-file resolution (по умолчанию true).
   *
   *   - `continueOnError` — поведение при ошибке отдельного файла.
   *
   * @param options — опции pipeline (все опциональны)
   * @returns PipelineResult
   */
  async run(options: PipelineOptions = {}): Promise<PipelineResult> {
    // ========================================================
    // Шаг 1: Создание контекста
    // ========================================================
    const startTime = Date.now();
    let ctx: PipelineContext = createContext(options);

    // ========================================================
    // Шаг 2: Вывод заголовка (verbose)
    // ========================================================
    if (ctx.options.verbose) {
      this.printHeader(ctx);
    }

    // ========================================================
    // Шаг 3: Последовательный запуск stages
    // ========================================================
    for (const stage of this.stages) {
      // ----------------------------------------------------
      // 3.1. Вывод имени stage (verbose)
      // ----------------------------------------------------
      if (ctx.options.verbose) {
        console.log(`\n▶ Stage: ${stage.name}`);
      }

      // ----------------------------------------------------
      // 3.2. Выполнение stage
      // ----------------------------------------------------
      const execution = await this.runStageSafely(stage, ctx);

      // ----------------------------------------------------
      // 3.3. Обновление контекста
      // ----------------------------------------------------
      ctx = execution.context;

      // ----------------------------------------------------
      // 3.4. Запись тайминга
      // ----------------------------------------------------
      ctx.metrics.stageTimings[stage.name] = execution.durationMs;

      // ----------------------------------------------------
      // 3.5. Обработка ошибки stage
      // ----------------------------------------------------
      if (execution.error) {
        const fileError = {
          file: '<pipeline>',
          stage: stage.name,
          message: execution.error.message,
          stack: execution.error.stack,
        };

        ctx.errors.push(fileError);

        if (ctx.options.verbose) {
          console.error(`   ❌ Ошибка stage: ${execution.error.message}`);
        }

        // Прерываем pipeline, если continueOnError = false
        if (!ctx.options.continueOnError) {
          throw execution.error;
        }

        // Иначе — продолжаем со следующим stage
      }
    }

    // ========================================================
    // Шаг 4: Общее время
    // ========================================================
    ctx.metrics.durationMs = Date.now() - startTime;

    // ========================================================
    // Шаг 5: Финальный вывод (verbose)
    // ========================================================
    if (ctx.options.verbose) {
      this.printFooter(ctx);
    }

    // ========================================================
    // Шаг 6: Формирование результата
    // ========================================================
    return this.buildResult(ctx);
  }

  /**
   * Возвращает список stages (для отладки и тестов).
   *
   * ⚠️ Возвращает внутренний массив — не мутируйте его
   * без необходимости.
   */
  getStages(): readonly PipelineStage[] {
    return this.stages;
  }

  // ==========================================================
  // ПРИВАТНЫЕ МЕТОДЫ
  // ==========================================================

  /**
   * Безопасно выполняет stage.
   *
   * ════════════════════════════════════════════════════════════
   * ЧТО ДЕЛАЕТ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Замеряет время начала.
   *   2. Вызывает `stage.run(ctx)`.
   *   3. Обрабатывает результат:
   *      - если Promise — await
   *      - если sync — использует как есть
   *   4. Замеряет время окончания.
   *   5. Возвращает { context, durationMs, error? }.
   *
   * ════════════════════════════════════════════════════════════
   * ЗАЧЕМ
   * ════════════════════════════════════════════════════════════
   *
   *   - Единообразная обработка ошибок
   *   - Единообразный замер времени
   *   - Stage может быть sync или async
   *
   * @param stage — stage для выполнения
   * @param ctx   — текущий контекст
   * @returns результат выполнения (без throw)
   */
  private async runStageSafely(
    stage: PipelineStage,
    ctx: PipelineContext
  ): Promise<StageExecutionResult> {
    const stageStart = Date.now();

    try {
      // ✅ Stage.run может вернуть sync или Promise
      const result = stage.run(ctx);

      // Проверяем, Promise ли это
      const isPromise =
        result !== null &&
        typeof result === 'object' &&
        typeof (result as Promise<PipelineContext>).then === 'function';

      const updatedCtx = isPromise
        ? await (result as Promise<PipelineContext>)
        : (result as PipelineContext);

      return {
        context: updatedCtx ?? ctx, // fallback, если stage вернул undefined
        durationMs: Date.now() - stageStart,
      };
    } catch (error) {
      // ✅ Не пробрасываем — обрабатываем в run()
      return {
        context: ctx,
        durationMs: Date.now() - stageStart,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Формирует `PipelineResult` из контекста.
   *
   * Отдельный метод — чтобы легче было менять форму
   * результата без правки основного `run()`.
   */
  private buildResult(ctx: PipelineContext): PipelineResult {
    return {
      full: ctx.full,
      compact: ctx.compact,
      entitiesMap: ctx.entitiesMap,
      enhancedMap: ctx.enhancedMap,
      metrics: ctx.metrics,
      errors: ctx.errors,
    };
  }

  /**
   * Печатает заголовок pipeline.
   *
   * Вызывается только при `verbose: true`.
   *
   * ✅ v2.1.0 (P3): добавлена строка про cross-file resolution.
   */
  private printHeader(ctx: PipelineContext): void {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ANALYSIS PIPELINE v2.1.0');
    console.log('='.repeat(70));
    console.log(`   Режим:        ${ctx.options.mode}`);
    console.log(`   Values mode:  ${ctx.options.valuesMode}`);
    console.log(`   Vue:          ответвление активно`);
    console.log(`   Relations:    resolve-relations stage активен`);
    // ✅ v2.1.0 (P3)
    console.log(
      `   Cross-file:   ${
        (ctx.options as any).enableCrossFileResolution === false
          ? 'ОТКЛЮЧЁН'
          : 'resolve-cross-file stage активен'
      }`
    );
    console.log(`   Project root: ${ctx.options.projectRoot}`);
    console.log(`   Recursive:    ${ctx.options.recursive}`);
    console.log(`   Include body: ${ctx.options.includeBody}`);
    console.log(`   VSCode links: ${ctx.options.includeVSCode}`);
    console.log(`   Extended:     ${ctx.options.includeExtended}`);
    console.log(`   Stages:       ${this.stages.length}`);
    console.log('');

    // Показываем список stages
    console.log('   📋 Stages:');
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      if (stage) {
        console.log(`      ${i + 1}. ${stage.name}`);
      }
    }
    console.log('');
  }

  /**
   * Печатает финальную сводку pipeline.
   *
   * Вызывается только при `verbose: true`.
   *
   * ✅ v2.1.0 (P3): добавлены метрики cross-file.
   */
  private printFooter(ctx: PipelineContext): void {
    const m = ctx.metrics;

    console.log('\n' + '='.repeat(70));
    console.log('✅ PIPELINE ЗАВЕРШЁН');
    console.log('='.repeat(70));
    console.log(`   Время:            ${(m.durationMs / 1000).toFixed(2)}s`);
    console.log(`   Файлов найдено:   ${m.filesDiscovered}`);
    console.log(`   Файлов разобрано: ${m.filesParsed}`);
    console.log(`   Файлов с ошибкой: ${m.filesFailed}`);
    console.log(`   Vue-файлов:       ${m.vueFiles}`);
    console.log(`   TS/JS-файлов:     ${m.tsFiles}`);
    console.log('');
    console.log('   📊 МЕТРИКИ КОНТЕНТА:');
    console.log(`   Функций:          ${m.totalFunctions}`);
    console.log(`   Констант:         ${m.totalConstants}`);
    console.log(`   Импортов:         ${m.totalImports}`);
    console.log(`   Экспортов:        ${m.totalExports}`);
    console.log(`   Conditionals:     ${m.totalConditionals}`);
    console.log(`   Lifecycle:        ${m.totalLifecycle}`);
    console.log(`   Reactivity:       ${m.totalReactivity}`);

    // ✅ v2.0.0: Relation-метрики
    const rel = (m as any).relationsResolved;
    if (rel) {
      console.log('');
      console.log('   🔗 РАЗРЕШЁННЫЕ СВЯЗИ:');
      console.log(`   refCalls:         ${rel.refCalls}`);
      console.log(`   eventHandlers:    ${rel.eventHandlers}`);
      console.log(`   composables:      ${rel.composables}`);
      console.log(`   localBindings:    ${rel.localBindings}`);
      console.log(`   props:            ${rel.props}`);
      console.log(`   emits:            ${rel.emits}`);
      console.log(`   vModels:          ${rel.vModels}`);
      console.log(`   dynamicComponents:${rel.dynamicComponents}`);
      console.log(`   stores:           ${rel.stores}`);
      console.log(`   routes:           ${rel.routes}`);
      console.log(`   directives:       ${rel.directives}`);
    }

    // ✅ v2.1.0 (P3): Cross-file-метрики
    const crossFileCalls = (m as any).crossFileCalls;
    const crossFileDuration = (m as any).crossFileDuration;
    const crossFileInitDuration = (m as any).crossFileInitDuration;
    const crossFileSameFileCalls = (m as any).crossFileSameFileCalls;
    const crossFileUnresolved = (m as any).crossFileUnresolved;
    const crossFileCacheHits = (m as any).crossFileCacheHits;

    if (
      crossFileCalls !== undefined ||
      crossFileDuration !== undefined ||
      crossFileInitDuration !== undefined
    ) {
      console.log('');
      console.log('   🔗 CROSS-FILE RESOLUTION:');
      if (crossFileCalls !== undefined) {
        console.log(`   Межфайловых:      ${crossFileCalls}`);
      }
      if (crossFileSameFileCalls !== undefined) {
        console.log(`   Внутрифайловых:   ${crossFileSameFileCalls}`);
      }
      if (crossFileUnresolved !== undefined) {
        console.log(`   Не разрешено:     ${crossFileUnresolved}`);
      }
      if (crossFileInitDuration !== undefined) {
        console.log(`   Init duration:    ${crossFileInitDuration}ms`);
      }
      if (crossFileDuration !== undefined) {
        console.log(`   Общее время:      ${crossFileDuration}ms`);
      }
      if (crossFileCacheHits !== undefined && crossFileCacheHits > 0) {
        console.log(`   Cache hits:       ${crossFileCacheHits}`);
      }
    }

    // Тайминги stages
    const stageNames = Object.keys(m.stageTimings);
    if (stageNames.length > 0) {
      console.log('');
      console.log('   ⏱️  ТАЙМИНГИ STAGES:');

      const maxNameLen = Math.max(...stageNames.map(n => n.length));

      for (const [stageName, ms] of Object.entries(m.stageTimings)) {
        const padded = stageName.padEnd(maxNameLen);
        console.log(`   ${padded}  ${ms.toString().padStart(6)}ms`);
      }
    }

    // Ошибки
    if (ctx.errors.length > 0) {
      console.log('');
      console.log(`   ⚠️  ОШИБКИ (${ctx.errors.length}):`);
      for (const err of ctx.errors.slice(0, 10)) {
        console.log(`   • [${err.stage}] ${err.file.split('/').pop()}: ${err.message}`);
      }
      if (ctx.errors.length > 10) {
        console.log(`   ... и ещё ${ctx.errors.length - 10} ошибок`);
      }
    }

    console.log('');
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default AnalysisPipeline;
