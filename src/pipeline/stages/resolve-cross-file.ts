// src/pipeline/stages/resolve-cross-file.ts
// ============================================================
// STAGE: RESOLVE CROSS FILE (P3)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Запускает cross-file resolver для всех файлов в ctx.entitiesMap.
// Обогащает ctx.crossFileCalls.
//
// ════════════════════════════════════════════════════════════
// МЕСТО В PIPELINE
// ════════════════════════════════════════════════════════════
//
//   DiscoverFilesStage
//         ↓
//   ParseFileStage
//         ↓
//   NormalizeEntitiesStage
//         ↓
//   ResolveRelationsStage       (Vue: refCalls, props, emits, ...)
//         ↓
//   ResolveCrossFileStage   ←── ЗДЕСЬ
//         ↓
//   BuildReportStage
//
// ════════════════════════════════════════════════════════════
// ЧТО ДЕЛАЕТ
// ════════════════════════════════════════════════════════════
//
//   1. Проверяет, включён ли cross-file (`enableCrossFileResolution`).
//   2. Проверяет, есть ли файлы в `ctx.entitiesMap`.
//   3. Запускает `resolveCrossFileCalls()` из cross-file-resolver.
//   4. Сохраняет результат в `ctx.crossFileCalls`.
//   5. Обновляет метрики в `ctx.metrics`.
//   6. Обрабатывает ошибки:
//      - continueOnError: true (по умолчанию) → записывает в ctx.errors.
//      - continueOnError: false → бросает StageError.
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ ОТДЕЛЬНЫЙ STAGE, А НЕ ЧАСТЬ ResolveRelationsStage
// ════════════════════════════════════════════════════════════
//
//   ResolveRelationsStage работает только с Vue templates
//   (refCalls, props, emits, v-model, dynamicComponents).
//
//   Cross-file resolution — общая задача для TS/JS и Vue:
//   она резолвит **все** вызовы во **всех** файлах проекта.
//
//   Смешивать их в одном stage плохо:
//     - разная логика обработки (Vue templates vs TS symbols)
//     - разная производительность (Vue — быстро, cross-file — медленно)
//     - разное поведение при ошибках
//
// ════════════════════════════════════════════════════════════
// ОПЦИИ
// ════════════════════════════════════════════════════════════
//
//   PipelineOptions.enableCrossFileResolution?: boolean
//     - true (по умолчанию) → cross-file resolution включён
//     - false              → пропускается
//
//   PipelineOptions.continueOnError?: boolean
//     - true (по умолчанию) → ошибка пишется в ctx.errors
//     - false              → бросается StageError
//
// ============================================================

import type { PipelineStage, PipelineContext } from '../types.js';
import { resolveCrossFileCalls } from '../../core/cross-file-resolver/index.js';
import { StageError } from '../errors.js';

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Stage для резолвинга межфайловых вызовов через ts-morph.
 *
 * ════════════════════════════════════════════════════════════
 * ЖИЗНЕННЫЙ ЦИКЛ
 * ════════════════════════════════════════════════════════════
 *
 *   const pipeline = new AnalysisPipeline();
 *   const result = await pipeline.run({
 *     projectRoot: './src',
 *     enableCrossFileResolution: true,
 *   });
 *
 *   // Результат:
 *   // result.enhancedMap — обогащённый
 *   // result.metrics.crossFileCalls — количество межфайловых
 *
 * ════════════════════════════════════════════════════════════
 * ПРОИЗВОДИТЕЛЬНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   Init Phase: ~10–30s для 5000 файлов.
 *   Resolve Phase: ~30–60s для 5000 файлов.
 *
 *   Это самая медленная стадия pipeline. Если нужна скорость —
 *   отключите через `enableCrossFileResolution: false`.
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 *   - Ошибка в cross-file resolver → записывается в ctx.errors.
 *   - Pipeline продолжается (по умолчанию).
 *   - При continueOnError: false → бросается StageError.
 *
 *   StageError оборачивает оригинальную ошибку через `cause`.
 */
export class ResolveCrossFileStage implements PipelineStage {
  /**
   * Имя stage. Используется в:
   *   - ctx.metrics.stageTimings[stage.name]
   *   - ctx.errors[].stage
   *   - логировании
   */
  readonly name = 'resolve-cross-file';

  // ==========================================================
  // ПУБЛИЧНЫЙ API
  // ==========================================================

  /**
   * Запускает резолвинг межфайловых вызовов.
   *
   * ════════════════════════════════════════════════════════════
   * АЛГОРИТМ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Проверить `enableCrossFileResolution`.
   *      - false → вывести сообщение, вернуть ctx без изменений.
   *
   *   2. Проверить `ctx.entitiesMap`.
   *      - пуст → вывести сообщение, вернуть ctx без изменений.
   *
   *   3. Вызвать `resolveCrossFileCalls(ctx.entitiesMap, {...})`.
   *      - ошибка → записать в ctx.errors, продолжить.
   *
   *   4. Сохранить результат:
   *      - `ctx.crossFileCalls = calls`
   *      - `ctx.metrics.crossFileCalls = stats.crossFileCalls`
   *      - и другие метрики.
   *
   *   5. Вернуть ctx.
   *
   * ════════════════════════════════════════════════════════════
   * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
   * ════════════════════════════════════════════════════════════
   *
   *   Тот же `ctx`, что и входной. Возможны мутации:
   *     - `ctx.crossFileCalls` (новое свойство, см. any)
   *     - `ctx.metrics.crossFileCalls`
   *     - `ctx.metrics.crossFileSameFileCalls`
   *     - `ctx.metrics.crossFileUnresolved`
   *     - `ctx.metrics.crossFileDuration`
   *     - `ctx.metrics.crossFileInitDuration`
   *     - `ctx.metrics.crossFileCacheHits`
   *     - `ctx.errors` (при ошибке)
   *
   * ════════════════════════════════════════════════════════════
   * ИДЕМПОТЕНТНОСТЬ
   * ════════════════════════════════════════════════════════════
   *
   *   Stage НЕ идемпотентен — каждый запуск заново резолвит
   *   все вызовы. Это связано с тем, что `ResolveCrossFileStage`
   *   создаёт новый `ProjectManager` внутри `resolveCrossFileCalls`.
   *
   *   В рамках одного `pipeline.run()` stage вызывается один раз.
   *
   * @param ctx — контекст pipeline
   * @returns ctx (мутированный)
   */
  async run(ctx: PipelineContext): Promise<PipelineContext> {
    const { options } = ctx;

    // ============================================================
    // Шаг 1: Проверка флага
    // ============================================================
    if ((options as any).enableCrossFileResolution === false) {
      if (options.verbose) {
        console.log('   ⏭️  Cross-file resolution отключён');
      }
      return ctx;
    }

    // ============================================================
    // Шаг 2: Проверка наличия файлов
    // ============================================================
    const fileCount = Object.keys(ctx.entitiesMap).length;
    if (fileCount === 0) {
      if (options.verbose) {
        console.log('   ⏭️  Нет файлов для cross-file resolution');
      }
      return ctx;
    }

    // ============================================================
    // Шаг 3: Логирование начала
    // ============================================================
    if (options.verbose) {
      console.log('');
      console.log(`   🔗 Cross-file resolution для ${fileCount} файлов...`);
    }

    // ============================================================
    // Шаг 4: Запуск резолвера
    // ============================================================
    try {
      const { calls, stats } = await resolveCrossFileCalls(ctx.entitiesMap, {
        projectRoot: options.projectRoot,
        includeVue: true,
        includeJs: true,
        cache: true,
        maxFiles: 5000,
        verbose: options.verbose === true,

        // Прогресс-бар каждые 500 файлов
        onProgress: options.verbose
          ? (processed: number, total: number): void => {
              if (processed % 500 === 0) {
                console.log(`      📊 ${processed}/${total} файлов...`);
              }
            }
          : undefined,
      });

      // ==========================================================
      // Шаг 5: Сохранение результата
      // ==========================================================
      // `crossFileCalls` не объявлено в `PipelineContext` явно,
      // поэтому используем `as any`. В будущем можно добавить
      // поле в интерфейс.
      (ctx as any).crossFileCalls = calls;

      // ==========================================================
      // Шаг 6: Обновление метрик
      // ==========================================================
      // Все поля метрик помечены `?` в `PipelineMetrics`,
      // поэтому присваиваем через `as any`.
      (ctx.metrics as any).crossFileCalls = stats.crossFileCalls;
      (ctx.metrics as any).crossFileSameFileCalls = stats.sameFileCalls;
      (ctx.metrics as any).crossFileUnresolved = stats.unresolvedCalls;
      (ctx.metrics as any).crossFileDuration = stats.durationMs;
      (ctx.metrics as any).crossFileInitDuration = stats.initDurationMs;
      (ctx.metrics as any).crossFileCacheHits = stats.cacheHits;

      // ==========================================================
      // Шаг 7: Логирование
      // ==========================================================
      if (options.verbose) {
        console.log(
          `   ✅ Cross-file: ${stats.crossFileCalls} межфайловых, ` +
            `${stats.sameFileCalls} внутрифайловых, ` +
            `${stats.unresolvedCalls} не разрешено`
        );
        console.log(
          `   ⏱️  Init: ${stats.initDurationMs}ms, ` +
            `Resolve: ${stats.resolveDurationMs}ms, ` +
            `Всего: ${stats.durationMs}ms`
        );

        if (stats.cacheHits > 0) {
          const totalCache = stats.cacheHits + stats.cacheMisses;
          const hitRate =
            totalCache > 0 ? ((stats.cacheHits / totalCache) * 100).toFixed(1) : '0.0';
          console.log(
            `   📦 Cache: ${stats.cacheHits} hits / ${stats.cacheMisses} misses ` + `(${hitRate}%)`
          );
        }
      }
    } catch (error) {
      // ==========================================================
      // Обработка ошибки
      // ==========================================================
      const msg = error instanceof Error ? error.message : String(error);

      ctx.errors.push({
        file: '<cross-file>',
        stage: this.name,
        message: msg,
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (options.verbose) {
        console.warn(`   ⚠️  Cross-file resolution failed: ${msg}`);
      }

      // Если continueOnError: false — прерываем pipeline
      if (!options.continueOnError) {
        throw new StageError(this.name, 'Cross-file resolution failed', undefined, error);
      }
      // Иначе — продолжаем со следующим stage
    }

    return ctx;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
// Класс уже экспортирован через `export class`.
// Default-экспорт оставлен для совместимости с инструментами,
// которые ожидают default.
// ============================================================

export default ResolveCrossFileStage;
