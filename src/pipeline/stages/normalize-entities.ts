// src/pipeline/stages/normalize-entities.ts
// ============================================================
// STAGE 4: NORMALIZE ENTITIES
// ============================================================
// Версия: 1.4.0
//
// ✅ v1.4.0: проброс React-полей
//   - Добавлен проброс react* полей в propagateTemplateFields:
//       • reactComponents
//       • reactHooks
//       • reactEffects
//       • reactContexts
//       • reactMemoization
//       • reactRefs
//       • reactJsxElements
//       • reactJsxEvents
//       • reactConditionals
//       • reactComponentUsages
//   - Без этого pass7React не видит React-данные, потому что
//     pipeline передаёт в collectFullJSON именно enhancedMap.

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
 *        d. 🎯 ЯВНО ПРОБРАСЫВАЕТ `templateComponentUsages` /
 *           `templateHtmlElements` (v16.0.8). Это устраняет
 *           двойной парсинг <template> в compact-reporter.ts.
 *
 *        e. ✅ v1.4.0: ЯВНО ПРОБРАСЫВАЕТ `react*` поля.
 *
 *        f. Сохраняет в `ctx.enhancedMap[file]`.
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
 *   templateComponentUsages  │ vue-analyzer/index       │ compact-reporter  ← v16.0.8
 *   templateHtmlElements     │ vue-analyzer/index       │ compact-reporter  ← v16.0.8
 *   reactComponents          │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactHooks               │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactEffects             │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactContexts            │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactMemoization         │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactRefs                │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactJsxElements         │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactJsxEvents           │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactConditionals        │ parse-typescript         │ pass7React        ← v1.4.0
 *   reactComponentUsages     │ parse-typescript         │ pass7React        ← v1.4.0
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
 *   // ctx.enhancedMap['./src/App.vue'].templateComponentUsages.length > 0
 *   // ctx.enhancedMap['./src/App.vue'].templateHtmlElements.length > 0
 *   // ctx.enhancedMap['./src/App.tsx'].reactComponents.length > 0
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

    // ✅ v1.3.0 (v16.0.8): диагностика Component Usage
    let totalComponentUsages = 0;
    let totalHtmlElements = 0;
    let filesWithComponentUsages = 0;

    // ✅ v1.4.0: диагностика React
    let totalReactComponents = 0;
    let totalReactHooks = 0;
    let totalReactJsxElements = 0;
    let filesWithReact = 0;

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
        //
        // ✅ v16.0.8: то же самое для templateComponentUsages /
        //    templateHtmlElements.
        //
        // ✅ v1.4.0: то же самое для react* полей.
        // ════════════════════════════════════════════════════
        const enhanced = convertEntitiesToEnhanced(entities);

        // ════════════════════════════════════════════════════
        // Шаг 2.2: 🎯 ЯВНЫЙ ПРОБРОС templateXxx + lexicalLinks + cu/he + react*
        // ════════════════════════════════════════════════════
        //
        // Это ГЛАВНОЕ ИСПРАВЛЕНИЕ. convertEntitiesToEnhanced
        // может не знать о Vue-специфичных или React-специфичных
        // полях (в зависимости от версии), поэтому мы прокидываем
        // их явно.
        //
        // Используем `as any`, потому что EnhancedEntityInfo
        // может не содержать эти поля в типе (в зависимости
        // от версии types.ts). Если вы обновите тип —
        // уберите `as any`.
        //
        // ВАЖНО: для Vue-полей сохраняем их как пустые массивы
        // (а не undefined) — так требует compact-reporter.
        // Для React-полей — сохраняем `undefined`, если поля
        // нет (это чище для не-React файлов).
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

        // ✅ v1.3.0 (v16.0.8): считаем Component Usage
        const cuCount = entities.templateComponentUsages?.length ?? 0;
        const heCount = entities.templateHtmlElements?.length ?? 0;
        totalComponentUsages += cuCount;
        totalHtmlElements += heCount;
        if (cuCount > 0 || heCount > 0) {
          filesWithComponentUsages++;
        }

        // ✅ v1.4.0: считаем React-сущности
        const e = entities as any;
        const rcCount = Array.isArray(e.reactComponents) ? e.reactComponents.length : 0;
        const rhCount = Array.isArray(e.reactHooks) ? e.reactHooks.length : 0;
        const rjCount = Array.isArray(e.reactJsxElements) ? e.reactJsxElements.length : 0;
        if (rcCount > 0 || rhCount > 0 || rjCount > 0) {
          filesWithReact++;
          totalReactComponents += rcCount;
          totalReactHooks += rhCount;
          totalReactJsxElements += rjCount;
        }

        // Логирование в verbose при небольшом количестве файлов
        if (options.verbose && fileCount <= 50) {
          this.logFile(filePath, conds, lc, rx, cuCount, heCount, rcCount, rhCount, rjCount);
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

      // ✅ v1.3.0 (v16.0.8): диагностика Component Usage
      if (totalComponentUsages > 0 || totalHtmlElements > 0) {
        console.log(`      • Component Usages:      ${totalComponentUsages}`);
        console.log(`      • HTML Elements:         ${totalHtmlElements}`);
        console.log(`      • Файлов с cu/he:        ${filesWithComponentUsages}`);
      } else if (fileCount > 0) {
        console.log(`      • Component Usages:      0 (нет Vue-файлов с <template>)`);
      }

      // ✅ v1.4.0: диагностика React
      if (filesWithReact > 0) {
        console.log(`      ⚛️  React Components:     ${totalReactComponents}`);
        console.log(`      ⚛️  React Hooks:          ${totalReactHooks}`);
        console.log(`      ⚛️  JSX Elements:         ${totalReactJsxElements}`);
        console.log(`      ⚛️  Файлов с React:       ${filesWithReact}`);
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
   * Явно копирует `templateXxx`-поля, `lexicalLinks`,
   * `templateComponentUsages`/`templateHtmlElements` и
   * React-поля (`react*`) из `EntitiesResult` в `EnhancedEntityInfo`.
   *
   * ════════════════════════════════════════════════════════════
   * ПОЧЕМУ ЭТО НУЖНО
   * ════════════════════════════════════════════════════════════
   *
   * `convertEntitiesToEnhanced` создан для базовых секций
   * (functions, constants, imports) и может НЕ ЗНАТЬ о
   * Vue-специфичных или React-специфичных полях. Если не
   * пробросить их явно — `compact-reporter` не найдёт их,
   * и pipeline потеряет данные.
   *
   * Аналогично с `lexicalLinks` — если поле потеряется,
   * compact.lx останется пустым, и decode(compact) вернёт
   * lexicalLinks = undefined.
   *
   * ✅ v1.4.0: то же самое для React-полей.
   * Без этого проброса pass7React получает enhancedMap,
   * в котором нет `reactComponents`, `reactHooks` и т.д.,
   * поэтому React-секция в full.json остаётся пустой.
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
   *   ✅ Группа E (v16.0.8): Component Usage (Vue template)
   *     • templateComponentUsages
   *     • templateHtmlElements
   *
   *   ✅ Группа F (v1.4.0): React-сущности
   *     • reactComponents
   *     • reactHooks
   *     • reactEffects
   *     • reactContexts
   *     • reactMemoization
   *     • reactRefs
   *     • reactJsxElements
   *     • reactJsxEvents
   *     • reactConditionals
   *     • reactComponentUsages
   *
   * ════════════════════════════════════════════════════════════
   * ПРАВИЛА
   * ════════════════════════════════════════════════════════════
   *
   *   1. Для Vue-полей: если поле не задано — устанавливаем
   *      ПУСТОЙ массив (а не `undefined`). Так требует compact-reporter.
   *   2. Для React-полей: если поле не задано — оставляем
   *      `undefined`. Это чище для не-React файлов, и React-поля
   *      всегда проверяются через `Array.isArray()`.
   *   3. Для `templateComplexity` — устанавливаем `0`, если не задано.
   *
   * @param source  — исходный EntitiesResult
   * @param target  — целевой EnhancedEntityInfo (мутируется)
   */
  private propagateTemplateFields(source: EntitiesResult, target: EnhancedEntityInfo): void {
    // Приводим к `any` — потому что EnhancedEntityInfo
    // может не содержать templateXxx/reactXxx в типе.
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

    // ════════════════════════════════════════════════════════
    // ✅ Группа E (v16.0.8): Component Usage (Vue template)
    // ════════════════════════════════════════════════════════
    //
    // ЯВНЫЙ проброс componentUsages/htmlElements. Это гарантирует,
    // что compact-reporter.ts получит их через enhancedMap.
    //
    // Без этого проброса compact-reporter.ts вынужден перезапускать
    // analyzeVueSFC — что приводило к двойному парсингу <template>
    // и рассинхрону projectRoot.
    //
    // ⚠️ Синхронизировано с:
    //   - src/types.ts: EntitiesResult.templateComponentUsages
    //   - src/types.ts: EntitiesResult.templateHtmlElements
    //   - src/types.ts: EnhancedEntityInfo.templateComponentUsages
    //   - src/types.ts: EnhancedEntityInfo.templateHtmlElements
    //   - src/core/entity-extractor/vue/convert-analysis.ts
    //   - src/reporters/modules/converters.ts
    //   - src/reporters/compact-reporter.ts (ЧИТАЕТ, НЕ ПАРСИТ)
    // ════════════════════════════════════════════════════════

    t.templateComponentUsages = source.templateComponentUsages ?? [];
    t.templateHtmlElements = source.templateHtmlElements ?? [];

    // ════════════════════════════════════════════════════════
    // ✅ Группа F (v1.4.0): React-сущности
    // ════════════════════════════════════════════════════════
    //
    // Без этого проброса pass7React не видит React-данные:
    // pipeline передаёт в collectFullJSON именно enhancedMap,
    // а не оригинальный entitiesMap.
    //
    // Для Vue/TS/JS файлов эти поля будут `undefined` —
    // это нормально. Для .tsx/.jsx — заполнены в
    // parse-typescript.ts::parseTypeScriptFile().
    //
    // ⚠️ Используем `undefined` (а не `?? []`), чтобы
    // не засорять JSON пустыми массивами у не-React файлов.
    //
    // ⚠️ Синхронизировано с:
    //   - src/types.ts: EntitiesResult.reactComponents
    //   - src/types.ts: EntitiesResult.reactHooks
    //   - src/types.ts: EntitiesResult.reactEffects
    //   - src/types.ts: EntitiesResult.reactContexts
    //   - src/types.ts: EntitiesResult.reactMemoization
    //   - src/types.ts: EntitiesResult.reactRefs
    //   - src/types.ts: EntitiesResult.reactJsxElements
    //   - src/types.ts: EntitiesResult.reactJsxEvents
    //   - src/types.ts: EntitiesResult.reactConditionals
    //   - src/types.ts: EntitiesResult.reactComponentUsages
    //   - src/types.ts: EnhancedEntityInfo.reactComponents (v17.0.0)
    //   - src/pipeline/stages/parse-typescript.ts (заполняет react*)
    //   - src/reporters/compact/pipeline/pass-7-react.ts (читает)
    // ════════════════════════════════════════════════════════

    t.reactComponents = (source as any).reactComponents;
    t.reactHooks = (source as any).reactHooks;
    t.reactEffects = (source as any).reactEffects;
    t.reactContexts = (source as any).reactContexts;
    t.reactMemoization = (source as any).reactMemoization;
    t.reactRefs = (source as any).reactRefs;
    t.reactJsxElements = (source as any).reactJsxElements;
    t.reactJsxEvents = (source as any).reactJsxEvents;
    t.reactConditionals = (source as any).reactConditionals;
    t.reactComponentUsages = (source as any).reactComponentUsages;
  }

  // ============================================================
  // ЛОГИРОВАНИЕ
  // ============================================================

  /**
   * Логирует нормализацию одного файла.
   *
   * Формат:
   *   📦 App.vue (cd=2, lc=3, rx=6, cu=3, he=12)
   *   📦 App.tsx (rc=3, rh=4, rj=15)
   *   📦 utils.ts (—)
   *
   * Показываются только непустые секции — чтобы не было
   * шума из нулей.
   *
   * @param filePath — путь к файлу
   * @param conds    — количество conditionals
   * @param lc       — количество lifecycle
   * @param rx       — количество reactivity
   * @param cu       — количество componentUsages (v16.0.8)
   * @param he       — количество htmlElements (v16.0.8)
   * @param rc       — количество reactComponents (v1.4.0)
   * @param rh       — количество reactHooks (v1.4.0)
   * @param rj       — количество reactJsxElements (v1.4.0)
   */
  private logFile(
    filePath: string,
    conds: number,
    lc: number,
    rx: number,
    cu: number = 0,
    he: number = 0,
    rc: number = 0,
    rh: number = 0,
    rj: number = 0
  ): void {
    const name = path.basename(filePath);
    const parts: string[] = [];

    if (conds > 0) parts.push(`cd=${conds}`);
    if (lc > 0) parts.push(`lc=${lc}`);
    if (rx > 0) parts.push(`rx=${rx}`);
    // ✅ v16.0.8: Component Usage
    if (cu > 0) parts.push(`cu=${cu}`);
    if (he > 0) parts.push(`he=${he}`);
    // ✅ v1.4.0: React
    if (rc > 0) parts.push(`rc=${rc}`);
    if (rh > 0) parts.push(`rh=${rh}`);
    if (rj > 0) parts.push(`rj=${rj}`);

    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : ' (—)';
    console.log(`   📦 ${name}${suffix}`);
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default NormalizeEntitiesStage;
