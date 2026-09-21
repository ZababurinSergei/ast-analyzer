// src/pipeline/AnalysisPipeline.ts
// ============================================================
// ЕДИНЫЙ АНАЛИЗ PIPELINE — ОРКЕСТРАТОР
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Оркестратор единого pipeline анализа кода. Запускает stages
// последовательно, собирает метрики, обрабатывает ошибки.
//
// ЕДИНАЯ ТОЧКА ВХОДА для всех CLI-команд, тестов и внешних
// потребителей. Заменяет разбросанную логику из:
//   - cli.ts / CompactRecursiveCommand.ts
//   - core/entity-extractor/extract-entities.ts (Vue-ветка)
//   - reporters/compact-reporter.ts (enrich re-exports)
//
// АРХИТЕКТУРА
// ------------------------------------------------------------
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
//   │ Stage 1   │            │ Stage 2   │            │ ...       │
//   │ Discover  │───────────▶│ ParseFile │───────────▶│ Stage 5   │
//   │ Files     │            │(диспетчер)│            │ Build     │
//   └───────────┘            └─────┬─────┘            │ Report    │
//                                  │                  └───────────┘
//                                  │
//                     ┌────────────┴────────────┐
//                     │                         │
//                     ▼                         ▼
//              ┌────────────┐            ┌────────────┐
//              │ TS/JS-ветка│            │ Vue-ветка  │
//              │            │            │(ответвление)│
//              │ parseTS    │            │ parseVue   │
//              │   ↓        │            │   ↓        │
//              │ extract    │            │ analyze    │
//              │  FromAST   │            │   ↓        │
//              │            │            │ convert    │
//              └─────┬──────┘            └─────┬──────┘
//                    │                         │
//                    └────────────┬────────────┘
//                                 │
//                                 ▼
//                         (возврат в общий pipeline)
//
// ПРИНЦИПЫ
// ------------------------------------------------------------
//
//   1. ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ
//      Каждый stage делегирует в существующий модуль:
//        - DiscoverFilesStage → collectFilesForAnalysis
//        - ParseFileStage     → parseFile / analyzeVueComponent
//        - EnrichReExports    → enrichWithReExports
//        - NormalizeEntities  → convertEntitiesToEnhanced
//        - BuildReport        → generateCompactReport
//
//   2. ЯВНОЕ ВЕТВЛЕНИЕ
//      Только ParseFileStage знает о существовании Vue.
//      Остальные stages работают с EntitiesResult — единым
//      форматом для обеих веток.
//
//   3. МУТИРУЕМЫЙ КОНТЕКСТ
//      Stage.run(ctx) принимает контекст и возвращает его
//      (возможно, мутированный). Это позволяет легко
//      обмениваться данными между stages без глобальных
//      переменных.
//
//   4. ТЕСТИРУЕМОСТЬ
//      Каждый stage — отдельный класс. Можно собрать pipeline
//      только из нужных stages (передать в конструктор).
//
//   5. ОБРАБОТКА ОШИБОК
//      При `continueOnError: true` (по умолчанию) ошибки
//      отдельных файлов собираются в `ctx.errors`, pipeline
//      продолжает работу. При `false` — pipeline падает
//      на первой ошибке.
//
// ИСПОЛЬЗОВАНИЕ
// ------------------------------------------------------------
//
//   // 1. Базовое использование
//   const pipeline = new AnalysisPipeline();
//   const result = await pipeline.run({
//     projectRoot: './src',
//     mode: 'compact',
//     verbose: true,
//   });
//
//   // 2. Кастомный pipeline (только 3 stages)
//   const customPipeline = new AnalysisPipeline([
//     new DiscoverFilesStage(),
//     new ParseFileStage(),
//     new BuildReportStage(),
//   ]);
//   const result = await customPipeline.run({ projectRoot: './src' });
//
//   // 3. Только сбор файлов (для отладки)
//   const discover = new DiscoverFilesStage();
//   const ctx = createContext({ projectRoot: './src' });
//   const afterDiscover = await discover.run(ctx);
//   console.log(afterDiscover.files);
//
// ============================================================

import { createContext } from './context.js';
import { DiscoverFilesStage } from './stages/discover-files.js';
import { ParseFileStage } from './stages/parse-file.js';
import { EnrichReExportsStage } from './stages/enrich-re-exports.js';
import { NormalizeEntitiesStage } from './stages/normalize-entities.js';
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
 * STAGES ПО УМОЛЧАНИЮ
 * ════════════════════════════════════════════════════════════
 *
 *   1. DiscoverFilesStage
 *      → collectFilesForAnalysis (единый источник)
 *
 *   2. ParseFileStage
 *      → диспетчер: TS/JS или Vue
 *      → parseTypeScriptFile / parseVueFile
 *
 *   3. EnrichReExportsStage
 *      → enrichWithReExports
 *
 *   4. NormalizeEntitiesStage
 *      → convertEntitiesToEnhanced
 *      → ✅ ЯВНЫЙ проброс template-полей (фикс бага conditionals)
 *
 *   5. BuildReportStage
 *      → generateCompactReport
 *
 * ════════════════════════════════════════════════════════════
 * ПРЕИМУЩЕСТВА ПЕРЕД СТАРОЙ АРХИТЕКТУРОЙ
 * ════════════════════════════════════════════════════════════
 *
 *   ✅ Единая точка входа для всех CLI-команд
 *   ✅ Явное ветвление для Vue (в ParseFileStage)
 *   ✅ Тестируемость (stages — отдельные классы)
 *   ✅ Расширяемость (легко добавить новый stage)
 *   ✅ Единые метрики (PipelineMetrics)
 *   ✅ Единая обработка ошибок (FileError[])
 *   ✅ Явный проброс template-полей (фикс round-trip)
 *   ✅ Возможность кастомных pipeline
 *
 * ════════════════════════════════════════════════════════════
 * ПОТОКОБЕЗОПАСНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   Класс НЕ потокобезопасен.
 *   Каждый вызов `run()` создаёт НОВЫЙ контекст
 *   через `createContext()`, поэтому параллельные запуски
 *   на одном экземпляре теоретически возможны, НО:
 *     - stages могут использовать общие ресурсы (ts-morph Project)
 *     - нет синхронизации доступа к `this.stages`
 *   Для параллельных запусков создавайте отдельные экземпляры:
 *     const p1 = new AnalysisPipeline();
 *     const p2 = new AnalysisPipeline();
 *     await Promise.all([p1.run(...), p2.run(...)]);
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
   *
   * ⚠️ Список НЕ копируется при каждом `run()` — если
   * вы мутируете массив после создания pipeline, изменения
   * применятся к следующему запуску.
   */
  private readonly stages: PipelineStage[];

  // ==========================================================
  // КОНСТРУКТОР
  // ==========================================================

  /**
   * Создаёт pipeline.
   *
   * @param customStages — кастомный список stages. Если не задан,
   *                       используется стандартный набор из 5 stages
   *                       (DiscoverFiles → ParseFile → EnrichReExports
   *                       → NormalizeEntities → BuildReport).
   *
   * @example
   * ```typescript
   * // Стандартный pipeline
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
   * pipeline['stages'].push(new DiscoverFilesStage()); // не рекомендуется
   * ```
   */
  constructor(customStages?: PipelineStage[]) {
    this.stages = customStages ?? [
      new DiscoverFilesStage(),
      new ParseFileStage(),
      new EnrichReExportsStage(),
      new NormalizeEntitiesStage(),
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
   * ПРИМЕРЫ
   * ════════════════════════════════════════════════════════════
   *
   *   // 1. Компактный отчёт (по умолчанию)
   *   const result = await pipeline.run({
   *     projectRoot: './src',
   *     mode: 'compact',
   *     valuesMode: 'relations',
   *   });
   *   fs.writeFileSync('out.json', JSON.stringify(result.compact));
   *
   *   // 2. Только entities (без отчёта)
   *   const result = await pipeline.run({
   *     projectRoot: './src',
   *     mode: 'entities-only',
   *   });
   *   console.log(Object.keys(result.entitiesMap).length);
   *
   *   // 3. FullJSON + CompactJSON
   *   const result = await pipeline.run({
   *     projectRoot: './src',
   *     mode: 'full',
   *   });
   *   fs.writeFileSync('out.full.json', JSON.stringify(result.full));
   *   fs.writeFileSync('out.json', JSON.stringify(result.compact));
   *
   *   // 4. Без остановки на ошибках (по умолчанию)
   *   const result = await pipeline.run({
   *     projectRoot: './src',
   *     continueOnError: true,
   *   });
   *   console.log(`Ошибок: ${result.errors.length}`);
   *
   *   // 5. С остановкой на первой ошибке
   *   try {
   *     await pipeline.run({
   *       projectRoot: './src',
   *       continueOnError: false,
   *     });
   *   } catch (error) {
   *     // pipeline прерван на первой ошибке файла
   *   }
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
   *   - Stage может быть sync или async (интерфейс не навязывает)
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
   */
  private printHeader(ctx: PipelineContext): void {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ANALYSIS PIPELINE');
    console.log('='.repeat(70));
    console.log(`   Режим:        ${ctx.options.mode}`);
    console.log(`   Values mode:  ${ctx.options.valuesMode}`);
    console.log(`   Vue:          ответвление активно`);
    console.log(`   Project root: ${ctx.options.projectRoot}`);
    console.log(`   Recursive:    ${ctx.options.recursive}`);
    console.log(`   Include body: ${ctx.options.includeBody}`);
    console.log(`   VSCode links: ${ctx.options.includeVSCode}`);
    console.log(`   Extended:     ${ctx.options.includeExtended}`);
    console.log(`   Stages:       ${this.stages.length}`);
    console.log('');
  }

  /**
   * Печатает финальную сводку pipeline.
   *
   * Вызывается только при `verbose: true`.
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
    console.log(`   Re-export chains: ${m.reExportChains}`);

    // Тайминги stages
    const stageNames = Object.keys(m.stageTimings);
    if (stageNames.length > 0) {
      console.log('');
      console.log('   ⏱️  ТАЙМИНГИ STAGES:');

      // Находим самый длинный stage для красивой печати
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
