// src/pipeline/stages/enrich-re-exports.ts
// ============================================================
// STAGE 3: РАЗВОРАЧИВАНИЕ RE-EXPORTS
// ============================================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0:
//   - ✅ ИСПРАВЛЕНО: stats.unresolved → stats.unresolvedReExports
//     (это правильное имя поля в EnrichStats из
//      core/entity-extractor/enrich-with-re-exports.ts).
//   - ✅ ДОБАВЛЕНА защита: (stats.unresolvedReExports ?? 0).
//   - ✅ ДОБАВЛЕНО заполнение расширенных метрик:
//       • reExportFiles
//       • reExportMaxDepth
//       • reExportSkipped
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ Использует options.paths (для чтения файлов).
//   - ✅ Явная диагностика в verbose-режиме.
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Разворачивает цепочки re-exports:
//   export * from './foo'
//   export { bar } from './baz'
//   export * as ns from './qux'
//
// Работает ПОСЛЕ ParseFileStage и ДО NormalizeEntitiesStage.
// ============================================================

import fs from 'fs';
import path from 'path';
import { Project } from 'ts-morph';

import { enrichWithReExports } from '../../core/entity-extractor/enrich-with-re-exports.js';
import type { EntitiesResult } from '../../types.js';
import type { PipelineStage, PipelineContext } from '../types.js';

// ============================================================
// ОСНОВНОЙ STAGE
// ============================================================

export class EnrichReExportsStage implements PipelineStage {
  readonly name = 'enrich-re-exports';

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    const { options, entitiesMap } = ctx;

    // ──────────────────────────────────────────────────
    // Проверка: есть ли что обогащать
    // ──────────────────────────────────────────────────
    if (Object.keys(entitiesMap).length === 0) {
      if (options.verbose) {
        console.log('   ⏭️ Нет entities для обогащения');
      }
      return ctx;
    }

    // ──────────────────────────────────────────────────
    // Создаём ts-morph Project
    // ──────────────────────────────────────────────────
    let project: Project;
    try {
      project = new Project({
        compilerOptions: {
          target: 99,
          module: 99,
          allowJs: true,
          checkJs: false,
          skipLibCheck: true,
          jsx: 2,
        },
        useInMemoryFileSystem: false,
      });
    } catch (error) {
      if (options.verbose) {
        console.warn(
          `   ⚠️ Не удалось создать Project: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      return ctx;
    }

    // ──────────────────────────────────────────────────
    // Добавляем файлы в Project
    // ──────────────────────────────────────────────────
    let addedFiles = 0;
    for (const filePath of Object.keys(entitiesMap)) {
      try {
        const absPath = path.resolve(filePath);
        if (fs.existsSync(absPath)) {
          project.addSourceFileAtPath(absPath);
          addedFiles++;
        }
      } catch {
        // Игнорируем ошибки отдельных файлов
      }
    }

    if (addedFiles === 0) {
      if (options.verbose) {
        console.log('   ⏭️ Ни один файл не добавлен в Project');
      }
      return ctx;
    }

    if (options.verbose) {
      console.log(`   📚 Файлов в Project: ${addedFiles}`);
    }

    // ──────────────────────────────────────────────────
    // Запуск enrichWithReExports
    // ──────────────────────────────────────────────────
    try {
      const enrichResult = enrichWithReExports(
        project,
        entitiesMap as Record<string, EntitiesResult>,
        {
          maxDepth: options.maxReExportDepth,
          projectRoot: options.projectRoot,
          debug: options.verbose,
        }
      );

      // ──────────────────────────────────────────────────
      // Обновляем entitiesMap
      // ──────────────────────────────────────────────────
      ctx.entitiesMap = enrichResult.enrichedEntities as Record<string, EntitiesResult>;

      // ──────────────────────────────────────────────────
      // ✅ v1.2.0: заполняем метрики
      // ──────────────────────────────────────────────────
      // ⚠️ ВАЖНО: правильное имя поля — `unresolvedReExports`,
      //    а не `unresolved`. Поле `unresolvedReExports` —
      //    из интерфейса EnrichStats в
      //    core/entity-extractor/enrich-with-re-exports.ts.
      // ──────────────────────────────────────────────────
      const stats = enrichResult.stats;

      ctx.metrics.reExportChains = stats.expandedChains ?? 0;
      ctx.metrics.reExportFiles = stats.filesWithReExports ?? 0;
      ctx.metrics.reExportMaxDepth = stats.maxDepth ?? 0;
      ctx.metrics.reExportSkipped = (stats.cyclesSkipped ?? 0) + (stats.unresolvedReExports ?? 0);

      // ──────────────────────────────────────────────────
      // Диагностика
      // ──────────────────────────────────────────────────
      if (options.verbose) {
        if (stats.expandedChains > 0) {
          console.log(`   🔄 Re-exports развёрнуто: ${stats.expandedChains}`);
        }
        if (stats.filesWithReExports > 0) {
          console.log(`   📁 Файлов с re-exports:  ${stats.filesWithReExports}`);
        }
        if (stats.maxDepth > 0) {
          console.log(`      • Макс. глубина:       ${stats.maxDepth}`);
        }
        if (stats.cyclesSkipped > 0) {
          console.log(`      • Циклов пропущено:    ${stats.cyclesSkipped}`);
        }
        if (stats.unresolvedReExports > 0) {
          console.log(`      • Неразрешённых:       ${stats.unresolvedReExports}`);
        }
      }
    } catch (error) {
      // ──────────────────────────────────────────────────
      // Ошибка обогащения — не фатальна, продолжаем
      // ──────────────────────────────────────────────────
      if (options.verbose) {
        console.warn(
          `   ⚠️ Re-exports не развёрнуты: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      ctx.errors.push({
        file: '<enrich-re-exports>',
        stage: this.name,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // НЕ бросаем дальше — pipeline должен продолжиться
    }

    return ctx;
  }
}
