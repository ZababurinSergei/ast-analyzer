// src/pipeline/stages/parse-file.ts
// ============================================================
// STAGE 2: ДИСПЕТЧЕР ПАРСЕРОВ
// ============================================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0:
//   - ✅ УДАЛЕНА неиспользуемая константа TS_JS_EXTENSIONS.
//   - ✅ ДОБАВЛЕНЫ метрики: totalEffects, totalInjections,
//     totalTemplateRefs, totalClasses, totalCalls, totalReExports,
//     totalTemplates.
//   - ✅ Обновлён updateMetrics() под расширенный PipelineMetrics.
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ Явный диспетчер: .vue → Vue-ветка, .ts/.js → TS/JS-ветка.
//   - ✅ options.paths вместо projectRoot.
//
// НАЗНАЧЕНИЕ:
//   Проходит по всем файлам, собранным DiscoverFilesStage,
//   и для каждого выбирает парсер по расширению:
//
//     ┌─ .ts/.tsx/.js/.jsx/.mjs/.cjs → parseTypeScriptFile()
//     │                                     ↓
//     │                                 extractEntitiesFromAST()
//     │                                     ↓
//     └─ .vue                         → parseVueFile()
//                                           ↓
//                                       analyzeVueComponent()
//                                           ↓
//                                       convertVueAnalysisToEntities()
//
//   Обе ветки возвращают EntitiesResult — единый формат.
//   Дальше pipeline продолжается ОБЩИМИ stages 3-5.
// ============================================================

import path from 'path';
import type { EntitiesResult } from '../../types.js';
import type { PipelineStage, PipelineContext } from '../types.js';
import { parseTypeScriptFile } from './parse-typescript.js';
import { parseVueFile } from './parse-vue.js';
import { StageError } from '../errors.js';

// ============================================================
// КЛАСС
// ============================================================

export class ParseFileStage implements PipelineStage {
  readonly name = 'parse-file';

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    const { options } = ctx;

    for (const file of ctx.files) {
      const ext = path.extname(file).toLowerCase();

      try {
        const entities = await this.dispatch(file, ext, ctx);
        if (!entities) continue;

        ctx.entitiesMap[file] = entities;
        ctx.metrics.filesParsed++;

        if (ext === '.vue') ctx.metrics.vueFiles++;
        else ctx.metrics.tsFiles++;

        this.updateMetrics(ctx, entities);
      } catch (error) {
        ctx.metrics.filesFailed++;
        ctx.errors.push({
          file,
          stage: this.name,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        if (options.verbose) {
          console.warn(
            `   ⚠️ ${path.basename(file)}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }

        if (!options.continueOnError) {
          throw new StageError(this.name, 'Парсинг прерван', file, error);
        }
      }
    }

    if (options.verbose) {
      console.log(`   ✅ Разобрано: ${ctx.metrics.filesParsed}/${ctx.metrics.filesDiscovered}`);
      console.log(`   🎯 Vue: ${ctx.metrics.vueFiles}, TS/JS: ${ctx.metrics.tsFiles}`);
      if (ctx.metrics.filesFailed > 0) {
        console.log(`   ⚠️  Ошибок: ${ctx.metrics.filesFailed}`);
      }
    }

    return ctx;
  }

  // ============================================================
  // ДИСПЕТЧЕР
  // ============================================================

  /**
   * 🎯 ЕДИНСТВЕННОЕ место, где принимается решение
   * о ветке pipeline.
   *
   * @param file — абсолютный путь к файлу
   * @param ext  — расширение в lowercase (например, '.vue')
   * @param ctx  — контекст pipeline
   * @returns EntitiesResult или null, если файл не поддерживается
   */
  private async dispatch(
    file: string,
    ext: string,
    ctx: PipelineContext
  ): Promise<EntitiesResult | null> {
    switch (ext) {
      case '.vue':
        // ═══════════════════════════════════════════
        // ВЕТКА VUE
        // ═══════════════════════════════════════════
        return parseVueFile(file, ctx);

      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
      case '.mjs':
      case '.cjs':
        // ═══════════════════════════════════════════
        // ВЕТКА TS/JS
        // ═══════════════════════════════════════════
        return parseTypeScriptFile(file, ctx);

      default:
        // Неподдерживаемое расширение — пропускаем
        return null;
    }
  }

  // ============================================================
  // МЕТРИКИ
  // ============================================================

  /**
   * Обновляет метрики pipeline по результатам парсинга одного файла.
   *
   * ⚠️ ВАЖНО: все поля PipelineMetrics должны быть инициализированы
   * в createEmptyMetrics() (context.ts). Если добавляется новое поле —
   * добавить и здесь, и в createEmptyMetrics().
   */
  private updateMetrics(ctx: PipelineContext, entities: EntitiesResult): void {
    const m = ctx.metrics;

    // ─── Сущности ───
    m.totalFunctions += entities.functions?.length ?? 0;
    m.totalClasses += entities.classes?.length ?? 0;
    m.totalConstants += entities.constants?.length ?? 0;
    m.totalImports += entities.imports?.length ?? 0;
    m.totalExports += entities.exports?.length ?? 0;

    // ─── Vue-секции ───
    m.totalConditionals += entities.templateConditionals?.length ?? 0;
    m.totalLifecycle += entities.templateLifecycle?.length ?? 0;
    m.totalEffects += entities.templateEffects?.length ?? 0;
    m.totalInjections += entities.templateInjections?.length ?? 0;
    m.totalReactivity += entities.templateReactivity?.length ?? 0;
    m.totalTemplateRefs += entities.templateRefs?.length ?? 0;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default ParseFileStage;
