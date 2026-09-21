// src/pipeline/stages/build-report.ts
// ============================================================
// STAGE 5: BUILD REPORT
// ============================================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0 (удаление enrich re-exports + relations):
//   - ✅ УДАЛЕНО упоминание EnrichReExportsStage из шапки —
//     этот stage больше не входит в стандартный pipeline
//   - ✅ ОБНОВЛЕНО: номер stage — теперь Stage 5 (после
//     ResolveRelationsStage)
//   - ✅ ДОБАВЛЕНО: поддержка `includeBody` и `includeVSCode`
//     в вызове `generateCompactReport` (эти поля теперь есть
//     в GenerateReportOptions)
//   - ✅ ОБНОВЛЕНО: логирование — убраны упоминания
//     re-exports из стадий (re-exports разворачиваются
//     в ParseFileStage)
//   - ✅ ОБНОВЛЕНО: версия stage 1.0.0 → 2.0.0
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия
//   - Поддержка трёх режимов (full / compact / entities-only)
//   - Сохранение артефактов через generateCompactReport
//   - Метрики: размеры compact/full, compression ratio, valuesCount
//   - Подробное логирование в verbose-режиме
//   - Обработка ошибок через StageError
//
// ============================================================
// НАЗНАЧЕНИЕ
// ============================================================
//
// Финальный этап единого pipeline анализа. Собирает отчёт
// из нормализованных сущностей (`ctx.enhancedMap`) и
// сохраняет его в `ctx.full` и `ctx.compact`.
//
// ⚠️ ВАЖНО: вся тяжёлая работа делегируется в ЕДИНЫЙ
// источник — `generateCompactReport` из
// `reporters/compact-reporter.ts`.
//
// Здесь НЕТ:
//   • парсинга AST
//   • извлечения сущностей
//   • сборки FullJSON «руками»
//   • кодирования CompactJSON «руками»
//   • разворачивания re-exports (это делает ParseFileStage)
//   • разрешения кросс-файловых связей (это делает
//     ResolveRelationsStage)
//
// Всё это уже сделано в stages 1-4 и в `compact-reporter.ts`.
// Этот stage — ТОНКИЙ ОРКЕСТРАТОР для:
//   1. Вызова `generateCompactReport`
//   2. Сохранения артефактов на диск (если задан `outputPath`)
//   3. Обновления метрик pipeline
//
// ============================================================
// СХЕМА (v2.0.0)
// ============================================================
//
//   ctx.enhancedMap  ──►  generateCompactReport()  ──►  ctx.full
//                              │                          ctx.compact
//                              │
//                              ├──► FullJSON    (для отладки)
//                              ├──► CompactJSON (для AI/хранения)
//                              └──► Codec.encode(full, valuesMode)
//
// ============================================================
// РЕЖИМЫ РАБОТЫ
// ============================================================
//
// Stage поддерживает три режима, управляемых через
// `ctx.options.mode`:
//
//   • 'full'           — только FullJSON, без сжатия
//   • 'compact'        — FullJSON + CompactJSON (по умолчанию)
//   • 'entities-only'  — только entitiesMap, без отчёта
//                        (полезно для кастомных pipeline)
//
// ============================================================
// СОХРАНЕНИЕ ФАЙЛОВ
// ============================================================
//
// Если в `ctx.options` заданы пути:
//
//   • `outputPath`     — путь для CompactJSON
//   • `saveFullJson`   — сохранять ли .full.json рядом
//   • `fullJsonSuffix` — суффикс для .full.json
//
// То stage сохранит артефакты на диск. Это НЕ дублирует
// логику `compact-reporter.ts::saveJsonFile` — мы вызываем
// его через `generateCompactReport`, передавая `outputPath`.
//
// ============================================================
// ЗАВИСИМОСТИ
// ============================================================
//   • `generateCompactReport` — единая сборка отчёта.
//   • `PipelineContext`       — общий контекст pipeline.
//   • `PipelineStage`         — интерфейс stage.
//   • `StageError`            — единый тип ошибок pipeline.
//
// ============================================================

import fs from 'fs';
import path from 'path';

import { generateCompactReport } from '../../reporters/compact-reporter.js';
import type {
  FullJSON,
  CompactJSON,
  GenerateReportResult,
} from '../../reporters/codec/codec-types.js';
import type { PipelineStage, PipelineContext } from '../types.js';
import { StageError } from '../errors.js';

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Stage 5: Генерация отчёта.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверяет режим работы (`ctx.options.mode`).
 *        • 'entities-only' → ничего не делает, возвращает ctx.
 *        • 'full'          → только FullJSON, без compact.
 *        • 'compact'       → FullJSON + CompactJSON (default).
 *
 *   2. Вызывает `generateCompactReport` с:
 *        • `entitiesMap`  = ctx.enhancedMap
 *        • `outputPath`   = ctx.options.outputPath (если задан)
 *        • `valuesMode`   = ctx.options.valuesMode
 *        • `compress`     = (mode === 'compact')
 *        • `saveFullJson` = ctx.options.saveFullJson
 *        • `includeBody`  = ctx.options.includeBody
 *        • `includeVSCode`= ctx.options.includeVSCode
 *        • `saveEdges`    = ctx.options.saveEdges
 *        • `verbose`      = ctx.options.verbose
 *
 *   3. Сохраняет результаты в контекст:
 *        • ctx.full       = report.full
 *        • ctx.compact    = report.compact
 *
 *   4. Обновляет метрики:
 *        • totalFunctions, totalConstants, ...
 *        • compactSize, fullSize, compressionRatio
 *        • valuesCount (для compact)
 *
 *   5. Логирует результат в verbose-режиме.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ НЕ ДУБЛИРУЕМ ЛОГИКУ
 * ════════════════════════════════════════════════════════════
 *
 * Вся логика сборки FullJSON и его сжатия в CompactJSON
 * сосредоточена в ЕДИНОМ источнике:
 *
 *   `reporters/compact-reporter.ts::generateCompactReport`
 *
 * Если бы мы дублировали её здесь, то:
 *   • при изменении структуры FullJSON пришлось бы править
 *     в двух местах;
 *   • легко было бы получить расхождение между CLI и pipeline;
 *   • тесты round-trip не покрывали бы pipeline.
 *
 * Поэтому этот stage — «тонкий»: он только вызывает
 * `generateCompactReport` и обновляет метрики.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Compact-режим (default) — FullJSON + CompactJSON
 *   const ctx = createContext({
 *     projectRoot: './src',
 *     mode: 'compact',
 *     valuesMode: 'relations',
 *   });
 *   // ... stages 1-4 ...
 *   await new BuildReportStage().run(ctx);
 *   // ctx.full     = FullJSON
 *   // ctx.compact  = CompactJSON
 *
 *   // Full-режим — только FullJSON
 *   const ctx = createContext({
 *     projectRoot: './src',
 *     mode: 'full',
 *   });
 *   // ... stages 1-4 ...
 *   await new BuildReportStage().run(ctx);
 *   // ctx.full     = FullJSON
 *   // ctx.compact  = undefined
 *
 *   // Entities-only — только entitiesMap
 *   const ctx = createContext({
 *     projectRoot: './src',
 *     mode: 'entities-only',
 *   });
 *   // ... stages 1-4 ...
 *   await new BuildReportStage().run(ctx);
 *   // ctx.full     = undefined
 *   // ctx.compact  = undefined
 *   // ctx.enhancedMap = { ... }
 */
export class BuildReportStage implements PipelineStage {
  readonly name = 'build-report';

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    const { options } = ctx;

    // ────────────────────────────────────────────────────────
    // Шаг 1: Режим 'entities-only' — пропускаем
    // ────────────────────────────────────────────────────────
    // Полезно для кастомных pipeline, которым нужны только
    // сущности (например, для собственных отчётов).
    // ────────────────────────────────────────────────────────
    if (options.mode === 'entities-only') {
      if (options.verbose) {
        console.log('');
        console.log('   ⏭️  Режим entities-only — генерация отчёта пропущена');
        console.log(`      • Сущностей: ${Object.keys(ctx.enhancedMap).length}`);
      }
      return ctx;
    }

    // ────────────────────────────────────────────────────────
    // Шаг 2: Проверка входных данных
    // ────────────────────────────────────────────────────────
    const entitiesCount = Object.keys(ctx.enhancedMap).length;

    if (entitiesCount === 0) {
      if (options.verbose) {
        console.warn('');
        console.warn('   ⚠️  Нет сущностей для генерации отчёта');
        console.warn('   💡 Проверьте, что этапы 1-4 завершились успешно');
      }
      // Не бросаем ошибку — pipeline может быть запущен на
      // пустом проекте, это валидный сценарий.
      return ctx;
    }

    if (options.verbose) {
      console.log('');
      console.log(`   📦 Генерация отчёта из ${entitiesCount} файлов...`);
      console.log(`      • Режим:    ${options.mode}`);
      console.log(`      • Values:   ${options.valuesMode}`);
      console.log(`      • Compress: ${options.mode === 'compact' ? 'ВКЛ' : 'ВЫКЛ'}`);
      console.log(`      • Body:     ${options.includeBody ? 'ВКЛ' : 'ВЫКЛ'}`);
      console.log(`      • VSCode:   ${options.includeVSCode ? 'ВКЛ' : 'ВЫКЛ'}`);
      console.log(`      • Edges:    ${options.saveEdges ? 'ВКЛ' : 'ВЫКЛ'}`);
      if (options.outputPath) {
        console.log(`      • Output:   ${options.outputPath}`);
      }
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: Вызов generateCompactReport
    // ────────────────────────────────────────────────────────
    let report: GenerateReportResult;
    try {
      report = generateCompactReport(ctx.enhancedMap as any, options.outputPath, {
        // ────────────────────────────────────────────────
        // Режим сжатия: только для mode === 'compact'
        // ────────────────────────────────────────────────
        compress: options.mode === 'compact',

        // ────────────────────────────────────────────────
        // Сохранение FullJSON рядом с CompactJSON
        // ────────────────────────────────────────────────
        saveFullJson: options.saveFullJson,

        // ────────────────────────────────────────────────
        // Суффикс для FullJSON
        // ────────────────────────────────────────────────
        fullJsonSuffix: options.fullJsonSuffix,

        // ────────────────────────────────────────────────
        // Режим сериализации values
        // ────────────────────────────────────────────────
        valuesMode: options.valuesMode,

        // ────────────────────────────────────────────────
        // ✅ v2.0.0: включать тела функций
        // ────────────────────────────────────────────────
        includeBody: options.includeBody,

        // ────────────────────────────────────────────────
        // ✅ v2.0.0: включать VSCode-ссылки
        // ────────────────────────────────────────────────
        includeVSCode: options.includeVSCode,

        // ────────────────────────────────────────────────
        // Edges (по умолчанию выключено)
        // ────────────────────────────────────────────────
        saveEdges: options.saveEdges,
        edgesJsonSuffix: options.edgesJsonSuffix,

        // ────────────────────────────────────────────────
        // Подробный вывод
        // ────────────────────────────────────────────────
        verbose: options.verbose,
      });
    } catch (error) {
      throw new StageError(
        this.name,
        `Ошибка генерации отчёта: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error
      );
    }

    // ────────────────────────────────────────────────────────
    // Шаг 4: Сохраняем результат в контекст
    // ────────────────────────────────────────────────────────
    ctx.full = report.full;
    ctx.compact = report.compact;

    // ────────────────────────────────────────────────────────
    // Шаг 5: Обновляем метрики
    // ────────────────────────────────────────────────────────
    this.updateMetrics(ctx, report);

    // ────────────────────────────────────────────────────────
    // Шаг 6: Логирование
    // ────────────────────────────────────────────────────────
    if (options.verbose) {
      this.logReport(ctx, report);
    }

    return ctx;
  }

  // ============================================================
  // МЕТРИКИ
  // ============================================================

  /**
   * Обновляет метрики pipeline из результата `generateCompactReport`.
   *
   * ВАЖНО: НЕ перезаписываем метрики, собранные на предыдущих
   * stages (totalFunctions, totalConstants, ...). Они уже
   * посчитаны в `ParseFileStage.updateMetrics`. Здесь только
   * добавляем:
   *   • compactSize, fullSize, edgesSize
   *   • compressionRatio
   *   • valuesCount
   *
   * @param ctx    — контекст pipeline
   * @param report — результат generateCompactReport
   */
  private updateMetrics(ctx: PipelineContext, report: GenerateReportResult): void {
    // Размеры файлов (если сохранены)
    if (report.stats.compactSize !== undefined) {
      ctx.metrics.compactSize = report.stats.compactSize;
    }
    if (report.stats.fullSize !== undefined) {
      ctx.metrics.fullSize = report.stats.fullSize;
    }
    if (report.stats.edgesSize !== undefined) {
      ctx.metrics.edgesSize = report.stats.edgesSize;
    }
    if (report.stats.compressionRatio !== undefined) {
      ctx.metrics.compressionRatio = report.stats.compressionRatio;
    }
    if (report.stats.valuesCount !== undefined) {
      ctx.metrics.valuesCount = report.stats.valuesCount;
    }

    // Пути к сохранённым файлам
    if (report.compactPath) {
      ctx.metrics.compactPath = report.compactPath;
    }
    if (report.fullPath) {
      ctx.metrics.fullPath = report.fullPath;
    }
    if (report.edgesPath) {
      ctx.metrics.edgesPath = report.edgesPath;
    }

    // Дополнительно: обновляем статистику из full.statistics,
    // если оно есть (это ЕДИНЫЙ ИСТОЧНИК истины для статистики).
    if (report.full?.statistics) {
      const s = report.full.statistics;
      ctx.metrics.totalModules = s.totalModules;
      ctx.metrics.totalFiles = s.totalFiles;
      ctx.metrics.totalFunctions = s.totalFunctions;
      ctx.metrics.totalClasses = s.totalClasses;
      ctx.metrics.totalConstants = s.totalConstants;
      ctx.metrics.totalExports = s.totalExports;
      ctx.metrics.totalImports = s.totalImports;
      ctx.metrics.totalCalls = s.totalCalls;
      ctx.metrics.totalReExports = s.totalReExports;
      if (s.totalTemplates !== undefined) {
        ctx.metrics.totalTemplates = s.totalTemplates;
      }
    }
  }

  // ============================================================
  // ЛОГИРОВАНИЕ
  // ============================================================

  /**
   * Логирует результат генерации отчёта в verbose-режиме.
   *
   * @param ctx    — контекст pipeline
   * @param report — результат generateCompactReport
   */
  private logReport(_ctx: PipelineContext, report: GenerateReportResult): void {
    console.log('');
    console.log('   ✅ Отчёт собран');

    // ────────────────────────────────────────────────────────
    // Статистика из FullJSON
    // ────────────────────────────────────────────────────────
    const stats = report.full?.statistics;
    if (stats) {
      console.log('   📊 Статистика:');
      console.log(`      • Модулей:    ${stats.totalModules}`);
      console.log(`      • Файлов:     ${stats.totalFiles}`);
      console.log(`      • Функций:    ${stats.totalFunctions}`);
      console.log(`      • Классов:    ${stats.totalClasses}`);
      console.log(`      • Констант:   ${stats.totalConstants}`);
      console.log(`      • Импортов:   ${stats.totalImports}`);
      console.log(`      • Экспортов:  ${stats.totalExports}`);
      console.log(`      • Вызовов:    ${stats.totalCalls}`);
      console.log(`      • Реэкспорт:  ${stats.totalReExports}`);

      if (stats.totalTemplates !== undefined && stats.totalTemplates > 0) {
        console.log(`      • Шаблонов:   ${stats.totalTemplates}`);
      }

      if (stats.totalConditionals !== undefined && stats.totalConditionals > 0) {
        console.log(`      • Conditionals: ${stats.totalConditionals}`);
      }
    }

    // ────────────────────────────────────────────────────────
    // Размеры и сжатие
    // ────────────────────────────────────────────────────────
    const s = report.stats;

    if (s.compactSize !== undefined || s.fullSize !== undefined) {
      console.log('');
      console.log('   📦 Размеры:');

      if (s.compactSize !== undefined) {
        console.log(`      • Compact:    ${this.formatSize(s.compactSize)}`);
      }

      if (s.fullSize !== undefined) {
        console.log(`      • Full:       ${this.formatSize(s.fullSize)}`);
      }

      if (s.edgesSize !== undefined) {
        console.log(`      • Edges:      ${this.formatSize(s.edgesSize)}`);
      }

      if (s.compressionRatio !== undefined) {
        console.log(`      • Сжатие:     ${s.compressionRatio.toFixed(1)}% от полного`);
      }

      if (s.valuesCount !== undefined) {
        console.log(`      • Values:     ${s.valuesCount} элементов`);
      }
    }

    // ────────────────────────────────────────────────────────
    // Сохранённые файлы
    // ────────────────────────────────────────────────────────
    if (report.compactPath || report.fullPath || report.edgesPath) {
      console.log('');
      console.log('   💾 Сохранено:');

      if (report.compactPath) {
        console.log(`      • Compact:    ${report.compactPath}`);
      }
      if (report.fullPath) {
        console.log(`      • Full:       ${report.fullPath}`);
      }
      if (report.edgesPath) {
        console.log(`      • Edges:      ${report.edgesPath}`);
      }
    }
  }

  /**
   * Форматирует размер в человекочитаемый вид.
   *
   * @param bytes — размер в байтах
   * @returns строка вида "169.93 KB" или "1.02 MB"
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ (ДЛЯ ТЕСТОВ И API)
// ============================================================

/**
 * Сохраняет FullJSON в файл.
 *
 * Экспортируется для случаев, когда pipeline работает в
 * режиме 'entities-only', но пользователю нужно сохранить
 * FullJSON вручную.
 *
 * ⚠️ НЕ используется в самом `BuildReportStage` — там
 * сохранение делегируется в `generateCompactReport`.
 *
 * @param full       — FullJSON
 * @param outputPath — путь для сохранения
 */
export function saveFullJSON(full: FullJSON, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(full, null, 2), 'utf-8');
}

/**
 * Сохраняет CompactJSON в файл.
 *
 * Экспортируется для случаев, когда pipeline работает в
 * режиме 'entities-only', но пользователю нужно сохранить
 * CompactJSON вручную.
 *
 * ⚠️ НЕ используется в самом `BuildReportStage` — там
 * сохранение делегируется в `generateCompactReport`.
 *
 * @param compact    — CompactJSON
 * @param outputPath — путь для сохранения
 */
export function saveCompactJSON(compact: CompactJSON, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(compact), 'utf-8');
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default BuildReportStage;
