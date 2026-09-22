// src/pipeline/stages/normalize-entities.ts
// ============================================================
// STAGE 4: NORMALIZE ENTITIES
// ============================================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0 (P0/P1: проброс parentFunctionId + lexicalLinks):
//   - ✅ ДОБАВЛЕНО: явный проброс lexicalLinks в propagateTemplateFields.
//     Ранее поле терялось, и Codec.encode получал undefined для lx[],
//     что ломало round-trip (compact.lx = { p: [], c: [], r: [], l: [], ai: [], cn: [] }).
//   - ✅ ПРОВЕРЕНО: parentFunctionId пробрасывается через convertEntitiesToEnhanced
//     (см. entities-converter.ts v2.2.0). Здесь дополнительных действий не требуется.
//   - ✅ ДОБАВЛЕНО: диагностика в verbose-режиме — сколько функций имеют
//     parentFunctionId и сколько lexicalLinks собрано.
//   - 📌 Это критично для инвариантов I10 и I12 в verify-roundtrip.
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ ЯВНЫЙ ПРОБРОС templateXxx-полей.
//   - ✅ Расширенные метрики: totalVueFiles, filesWithConditionals,
//     filesWithLifecycle, filesWithReactivity.
//   - ✅ Логирование в verbose: сколько Vue-файлов с какими
//     секциями.
//   - ✅ Обработка ошибок через continueOnError.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия.
//
// ============================================================
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Четвёртый этап единого pipeline. Преобразует
// `EntitiesResult` (внутренний формат обеих веток —
// TS/JS и Vue) в `EnhancedEntityInfo` (публичный формат
// для репортёров и Codec).
//
// ⚠️ КРИТИЧНО: именно здесь исправляется баг с потерей
// `templateConditionals` (и других `templateXxx`-полей),
// из-за которого `decode(compact)` возвращает `undefined`
// для секции `conditionals` в Vue-проектах.
//
// Дополнительно здесь же пробрасываются:
//   - `parentFunctionId` (P0) — через convertEntitiesToEnhanced
//   - `lexicalLinks` (P1) — явно через propagateTemplateFields
// ============================================================
// СХЕМА
// ------------------------------------------------------------
//   EntitiesResult (от TS/JS-ветки или Vue-ветки)
//              │
//              ▼
//   convertEntitiesToEnhanced(entities)
//              │
//              ▼
//   EnhancedEntityInfo (базовые секции)
//              │
//              ▼
//   🎯 ЯВНЫЙ ПРОБРОС templateXxx + lexicalLinks (только для Vue)
//              │
//              ▼
//   EnhancedEntityInfo (полный)
//              │
//              ▼
//   ctx.enhancedMap[file] = enhanced
//
// ЧТО ДЕЛАЕТ
// ------------------------------------------------------------
//   1. Для каждого файла из `ctx.entitiesMap`:
//        a. Вызывает `convertEntitiesToEnhanced(entities)`
//           — базовые секции: functions, constants, imports...
//
//        b. 🎯 ЯВНО ПРОБРАСЫВАЕТ `templateXxx`-поля:
//             • templateConditionals
//             • templateLifecycle
//             • templateEffects
//             • templateInjections
//             • templateReactivity
//             • templateRefs
//             • templateCssVariables
//             • templateDeepSelectors
//             • templateDirectives
//             • templateUsedComponents
//             • templateSlots
//             • templateComplexity
//
//        c. 🎯 ЯВНО ПРОБРАСЫВАЕТ `lexicalLinks` (P1):
//             • parent → child связи между функциями
//
//        d. Кладёт результат в `ctx.enhancedMap[file]`.
//
//   2. Собирает ошибки в `ctx.errors` (при `continueOnError`).
//
//   3. Логирует статистику в verbose-режиме.
//
// ПОЧЕМУ ЭТО ВАЖНО
// ------------------------------------------------------------
// Ранее (до появления pipeline) логика была размазана:
//   • extractEntitiesFromFile → convertEntitiesToEnhanced
//   • Но Vue-поля терялись, потому что convertEntitiesToEnhanced
//     не знал о `templateConditionals`.
//
// В результате `compact-reporter.ts` при сборе `FullJSON`
// не находил `entities.templateConditionals` и не создавал
// `full.conditionals`. Соответственно, `compact.cd` не
// заполнялся или заполнялся пустыми ссылками.
//
// Аналогично `lexicalLinks` терялись, если не пробрасывать их
// явно — и compact.lx оставался пустым.
//
// Теперь проброс `templateXxx` и `lexicalLinks` — ЯВНЫЙ и в одном месте.
//
// ЗАВИСИМОСТИ
// ------------------------------------------------------------
//   • `convertEntitiesToEnhanced` — базовый конвертер.
//   • `PipelineContext`           — общий контекст.
//   • `PipelineStage`             — интерфейс stage.
//   • `StageError`                — единый тип ошибок.
// ============================================================

import path from 'path';

import { convertEntitiesToEnhanced } from '../../reporters/json/utils/entities-converter.js';
import type { EntitiesResult, EnhancedEntityInfo } from '../../types.js';
import type { PipelineStage, PipelineContext } from '../types.js';
import { StageError } from '../errors.js';

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Stage 4: Нормализация сущностей.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Для каждого файла из `ctx.entitiesMap`:
 *        a. Конвертирует `EntitiesResult` → `EnhancedEntityInfo`.
 *
 *        b. 🎯 ЯВНО ПРОБРАСЫВАЕТ все `templateXxx`-поля
 *           (Vue-специфичные). Это исправляет баг с потерей
 *           `conditionals`, `lifecycle`, `reactivity` и т.д.
 *
 *        c. 🎯 ЯВНО ПРОБРАСЫВАЕТ `lexicalLinks` (P1).
 *
 *        d. Сохраняет в `ctx.enhancedMap[file]`.
 *
 *   2. Обновляет метрики:
 *        • `filesWithConditionals` — файлы с v-if/v-else
 *        • `filesWithLifecycle`    — файлы с onMounted/...
 *        • `filesWithReactivity`   — файлы с ref/computed/...
 *
 *   3. Логирует в verbose-режиме.
 *
 * ════════════════════════════════════════════════════════════
 * ПРОБРАСЫВАЕМЫЕ TEMPLATE-ПОЛЯ
 * ════════════════════════════════════════════════════════════
 *
 *   Поле                     │ Источник                 │ Назначение
 *   ─────────────────────────┼──────────────────────────┼────────────────────
 *   templateReactivityDeps   │ vue-analyzer/template    │ compact-reporter
 *   templateEventHandlers    │ vue-analyzer/template    │ compact-reporter
 *   templateDynamicComponents│ vue-analyzer/template    │ compact-reporter
 *   templateRefs             │ vue-analyzer/template    │ compact-reporter
 *   templateCssVariables     │ vue-analyzer/template    │ compact-reporter
 *   templateDeepSelectors    │ vue-analyzer/template    │ compact-reporter
 *   templateDirectives       │ vue-analyzer/template    │ compact-reporter
 *   templateUsedComponents   │ vue-analyzer/template    │ compact-reporter
 *   templateSlots            │ vue-analyzer/template    │ compact-reporter
 *   templateComplexity       │ vue-analyzer/template    │ compact-reporter
 *   templateConditionals     │ vue-analyzer/template    │ compact-reporter  ← БАГ был здесь
 *   templateLifecycle        │ vue-analyzer/analyzers   │ compact-reporter
 *   templateEffects          │ vue-analyzer/analyzers   │ compact-reporter
 *   templateInjections       │ vue-analyzer/analyzers   │ compact-reporter
 *   templateReactivity       │ vue-analyzer/analyzers   │ compact-reporter
 *   lexicalLinks             │ entity-extractor/ast     │ compact-reporter  ← P1
 *
 * ════════════════════════════════════════════════════════════
 * ПОВЕДЕНИЕ ПРИ ОШИБКАХ
 * ════════════════════════════════════════════════════════════
 *
 *   • `continueOnError: true`
 *       — ошибка файла идёт в `ctx.errors`, pipeline продолжается.
 *
 *   • `continueOnError: false`
 *       — pipeline падает со `StageError`.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   const ctx = createContext({ projectRoot: './src' });
 *   await new DiscoverFilesStage().run(ctx);
 *   await new ParseFileStage().run(ctx);
 *   await new NormalizeEntitiesStage().run(ctx);
 *
 *   // ctx.enhancedMap['./src/App.vue'].templateConditionals.length > 0
 *   // ctx.enhancedMap['./src/App.vue'].lexicalLinks.length > 0
 */
export class NormalizeEntitiesStage implements PipelineStage {
  readonly name = 'normalize-entities';

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    const { options, entitiesMap } = ctx;

    const fileCount = Object.keys(entitiesMap).length;

    // ────────────────────────────────────────────────────────
    // Шаг 1: Проверка, есть ли что нормализовать
    // ────────────────────────────────────────────────────────
    if (fileCount === 0) {
      if (options.verbose) {
        console.warn('   ⚠️  Нет entities для нормализации');
      }
      return ctx;
    }

    if (options.verbose) {
      console.log('');
      console.log(`   📦 Нормализация ${fileCount} файлов...`);
    }

    // ────────────────────────────────────────────────────────
    // Шаг 2: Итерируем по всем файлам
    // ────────────────────────────────────────────────────────
    let filesWithConditionals = 0;
    let filesWithLifecycle = 0;
    let filesWithReactivity = 0;

    // ✅ v1.2.0: диагностика P0/P1
    let totalFunctionsWithParent = 0;
    let totalLexicalLinks = 0;

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      try {
        // ════════════════════════════════════════════════════
        // Шаг 2.1: Базовая конвертация
        // ════════════════════════════════════════════════════
        // Конвертер v2.2.0 УЖЕ пробрасывает parentFunctionId
        // (через convertFunctions) и lexicalLinks (напрямую).
        //
        // Здесь мы ДОПОЛНИТЕЛЬНО подстраховываемся: если
        // по какой-то причине convertEntitiesToEnhanced не
        // пробросил lexicalLinks — propagateTemplateFields
        // восстановит их из source.
        // ════════════════════════════════════════════════════
        const enhanced = convertEntitiesToEnhanced(entities);

        // ════════════════════════════════════════════════════
        // Шаг 2.2: 🎯 ЯВНЫЙ ПРОБРОС templateXxx + lexicalLinks
        // ════════════════════════════════════════════════════
        //
        // Это ГЛАВНОЕ ИСПРАВЛЕНИЕ. convertEntitiesToEnhanced
        // может не знать о Vue-специфичных полях (в зависимости
        // от версии), поэтому мы прокидываем их явно.
        //
        // Используем `as any`, потому что EnhancedEntityInfo
        // может не содержать эти поля в типе (в зависимости
        // от версии types.ts). Если вы обновите тип —
        // уберите `as any`.
        //
        // ВАЖНО: даже если поля пустые — сохраняем их как
        // пустые массивы, а не `undefined`. Это гарантирует,
        // что `compact-reporter` всегда найдёт поле.
        // ════════════════════════════════════════════════════
        this.propagateTemplateFields(entities, enhanced);

        // ════════════════════════════════════════════════════
        // Шаг 2.3: Сохраняем в enhancedMap
        // ════════════════════════════════════════════════════
        ctx.enhancedMap[filePath] = enhanced;

        // ════════════════════════════════════════════════════
        // Шаг 2.4: Обновляем счётчики (для метрик и логирования)
        // ════════════════════════════════════════════════════
        const conds = entities.templateConditionals?.length ?? 0;
        const lc = entities.templateLifecycle?.length ?? 0;
        const rx = entities.templateReactivity?.length ?? 0;

        if (conds > 0) filesWithConditionals++;
        if (lc > 0) filesWithLifecycle++;
        if (rx > 0) filesWithReactivity++;

        // ✅ v1.2.0: считаем функции с parentFunctionId
        for (const fn of entities.functions || []) {
          if ((fn as any).parentFunctionId) {
            totalFunctionsWithParent++;
          }
        }

        // ✅ v1.2.0: считаем lexicalLinks
        totalLexicalLinks += entities.lexicalLinks?.length ?? 0;

        // Логирование в verbose при небольшом количестве файлов
        if (options.verbose && fileCount <= 50) {
          this.logFile(filePath, conds, lc, rx);
        }
      } catch (error) {
        // ════════════════════════════════════════════════════
        // ОШИБКА НОРМАЛИЗАЦИИ
        // ════════════════════════════════════════════════════
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;

        ctx.errors.push({
          file: filePath,
          stage: this.name,
          message,
          stack,
        });

        if (options.verbose) {
          console.warn(`   ⚠️  Ошибка нормализации ${path.basename(filePath)}: ${message}`);
        }

        // Строгий режим — падаем сразу
        if (!options.continueOnError) {
          throw new StageError(this.name, `Нормализация прервана: ${message}`, filePath, error);
        }
      }
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: Обновляем метрики
    // ────────────────────────────────────────────────────────
    ctx.metrics.filesNormalized = Object.keys(ctx.enhancedMap).length;
    ctx.metrics.filesWithConditionals = filesWithConditionals;
    ctx.metrics.filesWithLifecycle = filesWithLifecycle;
    ctx.metrics.filesWithReactivity = filesWithReactivity;

    // ────────────────────────────────────────────────────────
    // Шаг 4: Финальное логирование
    // ────────────────────────────────────────────────────────
    if (options.verbose) {
      console.log('   ✅ Нормализация завершена');
      console.log(`      • Обработано:           ${ctx.metrics.filesNormalized}`);

      if (filesWithConditionals > 0) {
        console.log(`      • Файлов с conditionals: ${filesWithConditionals}`);
      }
      if (filesWithLifecycle > 0) {
        console.log(`      • Файлов с lifecycle:    ${filesWithLifecycle}`);
      }
      if (filesWithReactivity > 0) {
        console.log(`      • Файлов с reactivity:   ${filesWithReactivity}`);
      }

      // ✅ v1.2.0: диагностика P0/P1
      if (totalFunctionsWithParent > 0) {
        console.log(`      • Функций с parentFunctionId: ${totalFunctionsWithParent}`);
      }
      if (totalLexicalLinks > 0) {
        console.log(`      • Лексических связей:    ${totalLexicalLinks}`);
      }

      console.log('');
    }

    return ctx;
  }

  // ============================================================
  // ПРОБРОС TEMPLATE-ПОЛЕЙ
  // ============================================================

  /**
   * 🎯 ГЛАВНАЯ ФУНКЦИЯ ЭТОГО STAGE.
   *
   * Явно копирует `templateXxx`-поля и `lexicalLinks`
   * из `EntitiesResult` в `EnhancedEntityInfo`.
   *
   * ════════════════════════════════════════════════════════════
   * ПОЧЕМУ ЭТО НУЖНО
   * ════════════════════════════════════════════════════════════
   *
   * `convertEntitiesToEnhanced` создан для базовых секций
   * (functions, constants, imports) и может НЕ ЗНАТЬ о
   * Vue-специфичных полях. Если не пробросить их явно —
   * `compact-reporter` не найдёт `entities.templateConditionals`
   * и не создаст `full.conditionals`.
   *
   * Аналогично с `lexicalLinks` — если поле потеряется,
   * compact.lx останется пустым, и decode(compact) вернёт
   * lexicalLinks = undefined.
   *
   * ════════════════════════════════════════════════════════════
   * ЧТО КОПИРУЕТСЯ
   * ════════════════════════════════════════════════════════════
   *
   *   Группа A: template-секции из vue-analyzer/template.ts
   *     • templateReactivityDeps
   *     • templateEventHandlers
   *     • templateDynamicComponents
   *     • templateRefs
   *     • templateCssVariables
   *     • templateDeepSelectors
   *     • templateDirectives
   *     • templateUsedComponents
   *     • templateSlots
   *     • templateComplexity
   *     • 🎯 templateConditionals
   *
   *   Группа B: template-секции из vue-analyzer/analyzers/*
   *     • templateLifecycle
   *     • templateEffects
   *     • templateInjections
   *     • templateReactivity
   *
   *   Группа C: тип-граф (пока не заполняется)
   *     • typesGraph
   *     • typeRefsGraph
   *
   *   Группа D: ✅ v1.2.0 (P1) — лексические связи
   *     • lexicalLinks
   *
   * ════════════════════════════════════════════════════════════
   * ПРАВИЛА
   * ════════════════════════════════════════════════════════════
   *
   *   1. Если поле задано в entities — копируем как есть.
   *   2. Если поле не задано — устанавливаем ПУСТОЙ массив
   *      (а не `undefined`). Это важно: `compact-reporter`
   *      проверяет `entities.templateXxx?.length > 0`,
   *      но некоторые места могут обращаться напрямую.
   *   3. Для `templateComplexity` — устанавливаем `0`,
   *      если не задано.
   *
   * @param source  — исходный EntitiesResult
   * @param target  — целевой EnhancedEntityInfo (мутируется)
   */
  private propagateTemplateFields(source: EntitiesResult, target: EnhancedEntityInfo): void {
    // Приводим к `any` — потому что EnhancedEntityInfo
    // может не содержать templateXxx в типе.
    const t = target as any;

    // ════════════════════════════════════════════════════════
    // Группа A: template-секции из vue-analyzer/template.ts
    // ════════════════════════════════════════════════════════

    // ─── root-идентификаторы шаблона ───
    t.templateReactivityDeps = source.templateReactivityDeps ?? [];

    // ─── обработчики событий (@click → handlerName) ───
    t.templateEventHandlers = source.templateEventHandlers ?? [];

    // ─── <component :is="..."> и v-bind:is ───
    t.templateDynamicComponents = source.templateDynamicComponents ?? [];

    // ─── template refs (ref="dataTable") ───
    t.templateRefs = source.templateRefs ?? [];

    // ─── CSS-переменные из <style> ───
    t.templateCssVariables = source.templateCssVariables ?? [];

    // ─── :deep() селекторы ───
    t.templateDeepSelectors = source.templateDeepSelectors ?? [];

    // ─── директивы (v-html, v-text, v-pre, ...) ───
    t.templateDirectives = source.templateDirectives ?? [];

    // ─── использованные компоненты ───
    t.templateUsedComponents = source.templateUsedComponents ?? [];

    // ─── слоты ───
    t.templateSlots = source.templateSlots ?? [];

    // ─── сложность шаблона (число) ───
    t.templateComplexity = source.templateComplexity ?? 0;

    // ─── 🎯 ГЛАВНОЕ: условный рендеринг ───
    // Именно это поле терялось и ломало round-trip.
    t.templateConditionals = source.templateConditionals ?? [];

    // ════════════════════════════════════════════════════════
    // Группа B: template-секции из vue-analyzer/analyzers/*
    // ════════════════════════════════════════════════════════

    // ─── хуки жизненного цикла (onMounted, onUnmounted, ...) ───
    t.templateLifecycle = source.templateLifecycle ?? [];

    // ─── side-effects (setTimeout, clearTimeout, ...) ───
    t.templateEffects = source.templateEffects ?? [];

    // ─── provide / inject ───
    t.templateInjections = source.templateInjections ?? [];

    // ─── реактивные связи (computed, watch, ref, ...) ───
    t.templateReactivity = source.templateReactivity ?? [];

    // ════════════════════════════════════════════════════════
    // Группа C: тип-граф (пока не заполняется)
    // ════════════════════════════════════════════════════════

    t.typesGraph = source.typesGraph ?? [];
    t.typeRefsGraph = source.typeRefsGraph ?? [];

    // ════════════════════════════════════════════════════════
    // ✅ Группа D (v1.2.0, P1): лексические связи (parent → child)
    // ════════════════════════════════════════════════════════
    //
    // Без этой строки:
    //   - full.lexicalLinks = undefined
    //   - compact.lx = { p: [], c: [], r: [], l: [], ai: [], cn: [] }
    //   - decode(compact).lexicalLinks = undefined
    //   - invariant I12 (lexicalLinks целостность) упадёт
    //
    // convertEntitiesToEnhanced v2.2.0 УЖЕ пробрасывает это поле,
    // но мы дублируем его здесь для подстраховки — на случай,
    // если кто-то откатит converter до версии 2.1.0 или раньше.
    //
    // ⚠️ Синхронизировано с:
    //   - src/types.ts: EntitiesResult.lexicalLinks
    //   - src/types.ts: EnhancedEntityInfo.lexicalLinks
    //   - src/reporters/codec/codec-encode.ts: encodeExtendedSection
    //   - src/reporters/codec/codec-decode.ts: LEXICAL_RELATION_BY_CODE
    // ════════════════════════════════════════════════════════

    t.lexicalLinks = source.lexicalLinks ?? [];
  }

  // ============================================================
  // ЛОГИРОВАНИЕ
  // ============================================================

  /**
   * Логирует нормализацию одного файла.
   *
   * Формат:
   *   📦 App.vue (cd=2, lc=3, rx=6)
   *   📦 utils.ts (—)
   *
   * Показываются только непустые секции — чтобы не было
   * шума из нулей.
   *
   * @param filePath — путь к файлу
   * @param conds    — количество conditionals
   * @param lc       — количество lifecycle
   * @param rx       — количество reactivity
   */
  private logFile(filePath: string, conds: number, lc: number, rx: number): void {
    const name = path.basename(filePath);
    const parts: string[] = [];

    if (conds > 0) parts.push(`cd=${conds}`);
    if (lc > 0) parts.push(`lc=${lc}`);
    if (rx > 0) parts.push(`rx=${rx}`);

    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : ' (—)';
    console.log(`   📦 ${name}${suffix}`);
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default NormalizeEntitiesStage;
