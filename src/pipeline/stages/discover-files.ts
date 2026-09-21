// src/pipeline/stages/discover-files.ts
// ============================================================
// STAGE 1: DISCOVER FILES
// ============================================================
// Версия: 1.1.0
//
// ИЗМЕНЕНИЯ v1.1.0 (нормализация путей):
//   - ✅ ДОБАВЛЕНА нормализация путей: ctx.files теперь содержит
//     ОТНОСИТЕЛЬНЫЕ пути от projectRoot (с прямыми слэшами).
//   - ✅ Это гарантирует переносимость FullJSON между машинами
//     и корректный round-trip кодека.
//   - ✅ Абсолютные пути будут восстановлены в ParseFileStage
//     (там, где это нужно для fs и vscode://).
//   - ✅ Расширенное логирование: показываем относительные пути.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия, вынесена из CompactRecursiveCommand.
//   - Поддержка нескольких входных путей.
//   - Расширенные метрики: директории vs файлы на входе.
//   - Подробное логирование в verbose-режиме.
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Первый этап единого pipeline анализа. Собирает все файлы
// проекта, которые нужно проанализировать.
//
// Делегирует всю работу в ЕДИНЫЙ источник истины:
//   `collectFilesForAnalysis` из `ci-cd/collect-files.ts`.
//
// Это гарантирует, что:
//   • список расширений (.ts, .tsx, .js, .jsx, .mjs, .cjs, .vue)
//     совпадает во всех командах CLI;
//   • ignore-паттерны (node_modules, dist, build, ...)
//     совпадают во всех командах CLI;
//   • поведение при несуществующих путях одинаковое.
//
// ОСОБЕННОСТИ
// ------------------------------------------------------------
//   • Поддерживает несколько входных путей (paths[]).
//   • Может работать как с файлами, так и с директориями.
//   • Рекурсивный или не-рекурсивный обход.
//   • Дополнительные ignore-паттерны мержатся с базовыми.
//   • Автоматически убирает дубликаты.
//   • Не выбрасывает исключения — всегда возвращает массив.
//   • ✅ НОРМАЛИЗУЕТ пути в относительные от projectRoot.
//
// ЗАВИСИМОСТИ
// ------------------------------------------------------------
//   • `collectFilesForAnalysis` — единый сборщик файлов.
//   • `PipelineContext`         — общий контекст pipeline.
//   • `PipelineStage`           — интерфейс stage.
// ============================================================

import path from 'path';
import fs from 'fs';

import { collectFilesForAnalysis } from '../../ci-cd/collect-files.js';
import type { PipelineStage, PipelineContext } from '../types.js';
import { StageError } from '../errors.js';

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Stage 1: Сбор файлов проекта.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Читает список входных путей из `ctx.options.inputPaths`.
 *      Если не задан — использует `[ctx.options.projectRoot]`.
 *
 *   2. Для каждого пути делегирует сбор в
 *      `collectFilesForAnalysis` из `ci-cd/collect-files.ts`.
 *
 *   3. ✅ НОРМАЛИЗУЕТ пути: делает их относительными от
 *      `projectRoot` и всегда с прямыми слэшами. Это гарантирует:
 *        • переносимость FullJSON между машинами;
 *        • корректный round-trip (encode/decode);
 *        • одинаковые пути в FullJSON.files[].path.
 *
 *   4. Сохраняет результат в `ctx.files`.
 *
 *   5. Обновляет метрики:
 *        • `filesDiscovered`     — всего найдено
 *        • `inputPathsCount`     — сколько путей передано
 *        • `inputDirectories`    — сколько из них директорий
 *        • `inputFiles`          — сколько из них файлов
 *
 * ════════════════════════════════════════════════════════════
 * НОРМАЛИЗАЦИЯ ПУТЕЙ (v1.1.0)
 * ════════════════════════════════════════════════════════════
 *
 *   `collectFilesForAnalysis` возвращает АБСОЛЮТНЫЕ пути
 *   (glob с `absolute: true`). Это правильно для сбора, но
 *   неправильно для отчёта: пути в FullJSON должны быть
 *   относительными от `projectRoot` (или от `process.cwd()`).
 *
 *   Алгоритм нормализации:
 *     1. Если путь УЖЕ относительный — оставляем,
 *        только нормализуем слэши (`\\` → `/`).
 *     2. Если путь АБСОЛЮТНЫЙ:
 *        a. `path.relative(projectRoot, absolutePath)` —
 *           делаем относительным.
 *        b. Если результат начинается с `..` — файл вне
 *           projectRoot (edge case) — оставляем абсолютным.
 *        c. Иначе — нормализуем слэши.
 *
 *   Абсолютные пути будут восстановлены позже в
 *   `ParseFileStage` — там, где это нужно для `fs` и `vscode://`.
 *
 * ════════════════════════════════════════════════════════════
 * ВХОДНЫЕ ПУТИ
 * ════════════════════════════════════════════════════════════
 *
 *   Входные пути берутся из:
 *     1. `ctx.options.inputPaths` — если задан массив
 *     2. `ctx.options.projectRoot` — иначе (единственный путь)
 *     3. `process.cwd()` — если ничего не задано
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Одна директория проекта
 *   const ctx = createContext({ projectRoot: './src' });
 *   await new DiscoverFilesStage().run(ctx);
 *   // ctx.files = ['src/index.ts', 'src/utils.ts', ...]
 *   //              ↑ относительные пути
 *
 *   // Несколько входных путей
 *   const ctx = createContext({
 *     inputPaths: ['./src', './packages/foo', './scripts/cli.ts'],
 *   });
 *   await new DiscoverFilesStage().run(ctx);
 *   // ctx.files = [...все файлы из всех путей, без дублей,
 *   //              в относительной форме]
 */
export class DiscoverFilesStage implements PipelineStage {
  readonly name = 'discover-files';

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    const { options } = ctx;

    // ────────────────────────────────────────────────────────
    // Шаг 1: Определяем входные пути
    // ────────────────────────────────────────────────────────
    const inputPaths = this.resolveInputPaths(ctx);

    if (inputPaths.length === 0) {
      throw new StageError(
          this.name,
          'Не задано ни одного входного пути (inputPaths/projectRoot)'
      );
    }

    if (options.verbose) {
      console.log('');
      console.log('   📥 Входные пути:');
      for (const p of inputPaths) {
        console.log(`      • ${p}`);
      }
    }

    // ────────────────────────────────────────────────────────
    // Шаг 2: Считаем статистику по входным путям
    //         (директории vs файлы)
    // ────────────────────────────────────────────────────────
    const inputStats = this.analyzeInputPaths(inputPaths);

    ctx.metrics.inputPathsCount = inputPaths.length;
    ctx.metrics.inputDirectories = inputStats.directories;
    ctx.metrics.inputFiles = inputStats.files;
    ctx.metrics.inputMissing = inputStats.missing;

    if (options.verbose && inputStats.missing > 0) {
      console.warn(
          `   ⚠️  Несуществующих путей: ${inputStats.missing} (будут пропущены)`
      );
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: ЕДИНЫЙ СБОР ФАЙЛОВ
    //         Делегируем в `collectFilesForAnalysis`
    // ────────────────────────────────────────────────────────
    let files: string[];
    try {
      files = await collectFilesForAnalysis(
          inputPaths,
          options.recursive,
          options.additionalIgnore
      );
    } catch (error) {
      // collectFilesForAnalysis НЕ должен бросать исключения,
      // но на всякий случай оборачиваем.
      throw new StageError(
          this.name,
          `Ошибка сбора файлов: ${
              error instanceof Error ? error.message : String(error)
          }`,
          undefined,
          error
      );
    }

    // ────────────────────────────────────────────────────────
    // Шаг 4: ✅ НОРМАЛИЗАЦИЯ ПУТЕЙ
    // ────────────────────────────────────────────────────────
    // Приводим все пути к ОТНОСИТЕЛЬНЫМ от projectRoot,
    // всегда с прямыми слэшами (для кроссплатформенности).
    //
    // Это гарантирует:
    //   • переносимость FullJSON между машинами
    //   • корректный round-trip (encode/decode)
    //   • одинаковые пути в FullJSON.files[].path
    //
    // Абсолютные пути будут восстановлены в ParseFileStage
    // (там, где это нужно для fs и vscode://).
    // ────────────────────────────────────────────────────────
    const projectRoot = options.projectRoot;
    const relativeFiles = files.map(f => {
      // Уже относительный — оставляем (только нормализуем слэши)
      if (!path.isAbsolute(f)) {
        return f.replace(/\\/g, '/');
      }
      // Абсолютный — делаем относительным от projectRoot
      const rel = path.relative(projectRoot, f);
      // Если файл вне projectRoot (edge case) — оставляем абсолютным,
      // но с прямыми слэшами
      return rel.startsWith('..') ? f.replace(/\\/g, '/') : rel.replace(/\\/g, '/');
    });

    // ────────────────────────────────────────────────────────
    // Шаг 5: Сохраняем результат в контекст
    // ────────────────────────────────────────────────────────
    ctx.files = relativeFiles;
    ctx.metrics.filesDiscovered = relativeFiles.length;

    // ────────────────────────────────────────────────────────
    // Шаг 6: Логирование
    // ────────────────────────────────────────────────────────
    if (options.verbose) {
      console.log('');
      console.log(`   📁 Найдено файлов: ${relativeFiles.length}`);

      // ────────────────────────────────────────────────────
      // Разбивка по расширениям
      // ────────────────────────────────────────────────────
      const byExtension = this.groupByExtension(relativeFiles);

      if (byExtension.size > 0) {
        console.log('   📊 По расширениям:');
        const sorted = [...byExtension.entries()].sort((a, b) => b[1] - a[1]);

        for (const [ext, count] of sorted) {
          console.log(`      ${ext.padEnd(8)} ${count}`);
        }
      }

      // ────────────────────────────────────────────────────
      // Игнорируемые паттерны
      // ────────────────────────────────────────────────────
      if (options.additionalIgnore.length > 0) {
        console.log('   🚫 Дополнительные исключения:');
        for (const pattern of options.additionalIgnore) {
          console.log(`      • ${pattern}`);
        }
      }

      // ────────────────────────────────────────────────────
      // Предупреждение, если ничего не найдено
      // ────────────────────────────────────────────────────
      if (relativeFiles.length === 0) {
        console.warn('');
        console.warn('   ⚠️  Не найдено ни одного файла для анализа');
        console.warn('   💡 Проверьте входные пути и расширения');
      }
    }

    return ctx;
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  /**
   * Определяет список входных путей для сбора файлов.
   *
   * Приоритет:
   *   1. `options.inputPaths` — если задан и непустой
   *   2. `options.projectRoot` — если задан
   *   3. `process.cwd()` — fallback
   *
   * @returns Массив абсолютных путей
   */
  private resolveInputPaths(ctx: PipelineContext): string[] {
    const { options } = ctx;

    // 1. Явный список inputPaths
    if (options.inputPaths && options.inputPaths.length > 0) {
      return options.inputPaths.map(p => path.resolve(p));
    }

    // 2. projectRoot как единственный путь
    if (options.projectRoot) {
      return [path.resolve(options.projectRoot)];
    }

    // 3. Fallback: текущая директория
    return [process.cwd()];
  }

  /**
   * Анализирует входные пути: считает директории, файлы,
   * несуществующие пути.
   *
   * Используется ТОЛЬКО для метрик и логирования.
   * Не влияет на сам сбор файлов.
   *
   * @param inputPaths — массив абсолютных путей
   * @returns Статистика
   */
  private analyzeInputPaths(inputPaths: string[]): {
    directories: number;
    files: number;
    missing: number;
  } {
    let directories = 0;
    let files = 0;
    let missing = 0;

    for (const p of inputPaths) {
      try {
        if (!fs.existsSync(p)) {
          missing++;
          continue;
        }

        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          directories++;
        } else if (stat.isFile()) {
          files++;
        }
      } catch {
        missing++;
      }
    }

    return { directories, files, missing };
  }

  /**
   * Группирует файлы по расширению.
   *
   * Пример:
   *   ['.ts', '.ts', '.vue', '.js']
   *   → Map { '.ts' => 2, '.vue' => 1, '.js' => 1 }
   *
   * @param files — массив путей
   * @returns Map "расширение → количество"
   */
  private groupByExtension(files: string[]): Map<string, number> {
    const result = new Map<string, number>();

    for (const file of files) {
      const ext = path.extname(file).toLowerCase() || '(без расширения)';
      result.set(ext, (result.get(ext) ?? 0) + 1);
    }

    return result;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default DiscoverFilesStage;
