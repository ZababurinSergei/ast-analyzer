// src/pipeline/stages/parse-vue.ts
// ============================================================
// STAGE 2b: PARSE VUE SFC (ОТВЕТВЛЕНИЕ)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Ветка pipeline для файлов Vue Single File Component (.vue).
// Вызывается из `ParseFileStage.dispatch()` для расширения `.vue`.
//
// Это ОТВЕТВЛЕНИЕ основного pipeline. После обработки
// возвращает `EntitiesResult` обратно в общий pipeline,
// где он сливается с результатами TS/JS-ветки и продолжает
// в общие stages:
//     enrich-re-exports → normalize → report
//
// СХЕМА
// ------------------------------------------------------------
//                          App.vue
//                             │
//                             ▼
//                  analyzeVueComponent(file, opts)
//                             │
//                             ▼
//                    VueComponentAnalysis
//                    ┌────────┴────────┐
//                    │                 │
//              script, template,   props, emits,
//              style, ...          composables,
//                                  functions,
//                                  lifecycle,
//                                  effects,
//                                  injections,
//                                  reactivity,
//                                  conditionals,
//                                  templateRefs,
//                                  cssVariables,
//                                  deepSelectors,
//                                  usedComponents,
//                                  slots, ...
//                             │
//                             ▼
//              convertVueAnalysisToEntities(vueAnalysis, file)
//                             │
//                             ▼
//                      EntitiesResult
//              ┌──────────────┴──────────────┐
//              │                             │
//        стандартные поля:             templateXxx-поля:
//        • functions                   • templateConditionals
//        • classes                     • templateLifecycle
//        • constants                   • templateEffects
//        • interfaces                  • templateInjections
//        • types                       • templateReactivity
//        • variables                   • templateRefs
//        • imports                     • templateCssVariables
//        • exports                     • templateDeepSelectors
//        • callGraph                   • templateDirectives
//                                      • templateUsedComponents
//                                      • templateSlots
//                                      • templateComplexity
//                             │
//                             ▼
//              возврат в ParseFileStage.dispatch()
//
// ЧТО ВОЗВРАЩАЕТСЯ
// ------------------------------------------------------------
// Полный `EntitiesResult`:
//   • Стандартные секции (functions, classes, ...) — заполняются
//     из `<script>` и `<script setup>`.
//   • Vue-специфичные templateXxx-поля — заполняются из
//     `<template>` через analyzeVueComponent.
//
// ⚠️ КРИТИЧНО: именно здесь заполняются templateXxx-поля,
//     которые потом идут в FullJSON и в compact-отчёт.
//     Если их потерять — сломается round-trip кодек.
//
// ОСОБЕННОСТИ
// ------------------------------------------------------------
//   • Делегирует работу в ЕДИНЫЕ источники:
//       - `analyzeVueComponent`              — Vue-анализ
//       - `convertVueAnalysisToEntities`     — приведение к EntitiesResult
//       - `createEmptyEntitiesResult`        — пустой результат для Vue без <script>
//   • Возвращает ПУСТОЙ `EntitiesResult` (не null!) для
//     Vue-файлов без `<script>` — чтобы узел модуля попал в граф.
//   • Обрабатывает ошибки компиляции @vue/compiler-sfc:
//     fallback на AST-разбор (внутри analyzeVueComponent).
//   • Логирует результат в verbose-режиме, включая статистику
//     по templateXxx-секциям.
//   • Защита от случайного вызова на не-Vue файлах.
//
// ЗАВИСИМОСТИ
// ------------------------------------------------------------
//   • `analyzeVueComponent`              — Vue-анализатор.
//   • `convertVueAnalysisToEntities`     — конвертер.
//   • `createEmptyEntitiesResult`        — пустой результат.
//   • `PipelineContext`                  — контекст pipeline.
//
// ИЗМЕНЕНИЯ
// ------------------------------------------------------------
// v1.0.0:
//   • Первая версия.
//   • Явная проверка расширения `.vue`.
//   • Fallback на пустой EntitiesResult для Vue без <script>.
//   • Расширенное логирование templateXxx-секций в verbose.
//   • Экспорт утилит `isVueExtension()` и `getVueExtension()`.
// ============================================================

import path from 'path';

import { analyzeVueComponent } from '../../modes/vue-analyzer/index.js';
import { convertVueAnalysisToEntities } from '../../core/entity-extractor/vue/convert-analysis.js';
import { createEmptyEntitiesResult } from '../../core/entity-extractor/helpers/create-empty-result.js';
import type { EntitiesResult } from '../../types.js';
import type { PipelineContext } from '../types.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

/**
 * Расширение Vue Single File Component.
 *
 * Вынесено в константу, чтобы не было «магической строки»
 * в нескольких местах.
 */
const VUE_EXTENSION = '.vue';

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Vue-ветка pipeline.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверка расширения
 *        • Если не `.vue` — возвращаем null.
 *          Это защита: если кто-то вызовет функцию напрямую
 *          для `.ts` — она не сломается, а просто вернёт null.
 *
 *   2. Vue-анализ
 *        • `analyzeVueComponent(file, opts)` из
 *          `modes/vue-analyzer/index.ts`.
 *        • Возвращает `VueComponentAnalysis | null`.
 *        • Внутри обрабатывает:
 *            - `<script>` / `<script setup>` (через @vue/compiler-sfc)
 *            - `<template>`  (AST + regex fallback)
 *            - `<style>`     (CSS-переменные, :deep())
 *            - props / emits / expose / slots
 *            - composables (use*)
 *            - functions, constants, variables, types, interfaces
 *            - lifecycle / effects / injections / reactivity
 *            - conditionals (v-if / v-else-if / v-else)
 *            - templateRefs, cssVariables, deepSelectors
 *            - usedComponents, directives
 *        • Для Vue без `<script>` возвращает `null`.
 *
 *   3. Обработка "Vue без <script>"
 *        • Если `analyzeVueComponent` вернул `null` —
 *          возвращаем ПУСТОЙ `EntitiesResult`, а НЕ `null`.
 *        • Это гарантирует, что узел модуля попадёт в граф
 *          зависимостей (даже если у него нет функций).
 *        • Пример: иконки, презентационные компоненты.
 *
 *   4. Конвертация в EntitiesResult
 *        • `convertVueAnalysisToEntities(vueAnalysis, file)`
 *          из `core/entity-extractor/vue/convert-analysis.ts`.
 *        • Возвращает единый `EntitiesResult` со всеми полями,
 *          включая templateXxx.
 *
 *   5. Возврат
 *        • `EntitiesResult` — при успехе.
 *        • `null` — только если файл не `.vue` (защита).
 *        • Пустой `EntitiesResult` — для Vue без `<script>`.
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 * Функция НЕ выбрасывает исключения:
 *   • analyzeVueComponent — сам ловит ошибки и возвращает null.
 *   • convertVueAnalysisToEntities — оборачиваем в try/catch,
 *     чтобы одна ошибка не уронила весь pipeline.
 *
 * Логика:
 *   • Vue без <script>       → пустой EntitiesResult.
 *   • Ошибка анализа          → пустой EntitiesResult + warn.
 *   • Ошибка конвертации      → возвращаем null (файл пропущен).
 *
 * Это соответствует политике `ParseFileStage`:
 * при `continueOnError: true` битый файл не валит pipeline.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Обычный Vue-компонент
 *   const entities = await parseVueFile('./src/App.vue', ctx);
 *   // entities.functions = [...]
 *   // entities.templateConditionals = [{...}, ...]
 *
 *   // Vue без <script> (иконка)
 *   const entities = await parseVueFile('./src/Icon.vue', ctx);
 *   // entities = { functions: [], ..., templateXxx: [] }
 *   // (пустой, но не null)
 *
 *   // Не наш файл (защита от случайного вызова)
 *   const entities = await parseVueFile('./src/utils.ts', ctx);
 *   // entities = null
 *
 * @param file — абсолютный путь к файлу
 * @param ctx  — контекст pipeline (для verbose-логирования)
 * @returns EntitiesResult или null
 */
export async function parseVueFile(
  file: string,
  ctx: PipelineContext
): Promise<EntitiesResult | null> {
  const { options } = ctx;

  // ────────────────────────────────────────────────────────
  // Шаг 1: Проверка расширения
  // ────────────────────────────────────────────────────────
  const ext = path.extname(file).toLowerCase();

  if (ext !== VUE_EXTENSION) {
    if (options.verbose) {
      console.warn(
        `   ⏭️  parseVueFile: неподдерживаемое расширение ` + `'${ext}' для ${path.basename(file)}`
      );
    }
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 2: Vue-анализ
  // ────────────────────────────────────────────────────────
  let vueAnalysis: ReturnType<typeof analyzeVueComponent>;
  try {
    // ✅ ЕДИНЫЙ ИСТОЧНИК: analyzeVueComponent
    //    Работает с @vue/compiler-sfc + ESTree AST.
    //    Внутри обрабатывает:
    //      • script / script setup
    //      - template (AST + regex fallback)
    //      • style (CSS-переменные, :deep())
    //      • props / emits / expose / slots
    //      • composables (use*)
    //      • functions, constants, variables, types, interfaces
    //      • lifecycle / effects / injections / reactivity
    //      • conditionals
    //      • templateRefs, cssVariables, deepSelectors
    //      • usedComponents, directives
    vueAnalysis = analyzeVueComponent(file, {
      includeTemplateAST: true,
      includeScriptAST: true,
      extractComposableCalls: true,
      verbose: options.verbose,
    });
  } catch (error) {
    // analyzeVueComponent обычно не бросает, но подстрахуемся.
    // Понижаем до warn — для иконок и презентационных компонентов
    // ошибки Vue-анализа ожидаемы и не должны валить pipeline.
    if (options.verbose) {
      console.warn(
        `   ⚠️  analyzeVueComponent упал на ${path.basename(file)}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }

    // ✅ Возвращаем пустой EntitiesResult, а НЕ null,
    //    чтобы узел модуля попал в граф зависимостей.
    return createEmptyEntitiesResult(file);
  }

  // ────────────────────────────────────────────────────────
  // Шаг 3: Обработка "Vue без <script>"
  // ────────────────────────────────────────────────────────
  // Vue-файл без <script> (иконки, презентационные компоненты) —
  // это НОРМА, а не ошибка. Возвращаем пустой результат,
  // но с валидными moduleName/filePath, чтобы узел модуля
  // всё равно попал в граф проекта.
  if (!vueAnalysis) {
    if (options.verbose) {
      console.warn(
        `   ⏭️  Vue без <script>: ${path.basename(file)} ` + `— возвращаем пустой результат`
      );
    }
    return createEmptyEntitiesResult(file);
  }

  // ────────────────────────────────────────────────────────
  // Шаг 4: Конвертация VueAnalysis → EntitiesResult
  // ────────────────────────────────────────────────────────
  let entities: EntitiesResult;
  try {
    // ✅ ЕДИНЫЙ ИСТОЧНИК: convertVueAnalysisToEntities
    //    Приводит VueAnalysis к единому формату EntitiesResult.
    //
    //    ВАЖНО: именно здесь templateXxx-поля из VueAnalysis
    //    пробрасываются в EntitiesResult.templateXxx.
    //    Если их потерять — сломается round-trip кодек:
    //      • templateConditionals — v-if / v-else-if / v-else
    //      • templateLifecycle    — onMounted, onUnmounted, ...
    //      • templateEffects      — setTimeout, clearTimeout, ...
    //      • templateInjections   — provide / inject
    //      • templateReactivity   — computed, watch, ref, ...
    //      • templateRefs         — ref="dataTable"
    //      • templateCssVariables — --blue-700
    //      • templateDeepSelectors— :deep(.n-data-table-td)
    //      • templateDirectives   — v-html, v-text, ...
    //      • templateUsedComponents — PascalCase + kebab-case
    //      • templateSlots        — <slot> + defineSlots<T>()
    //      • templateComplexity   — количество узлов шаблона
    entities = convertVueAnalysisToEntities(vueAnalysis, file);
  } catch (error) {
    if (options.verbose) {
      console.warn(
        `   ⚠️  convertVueAnalysisToEntities упал на ${path.basename(file)}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    // Здесь возвращаем null — конвертация сломалась,
    // это серьёзнее, чем "Vue без <script>".
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 5: Логирование в verbose-режиме
  // ────────────────────────────────────────────────────────
  if (options.verbose) {
    logSuccess(file, entities);
  }

  return entities;
}

// ============================================================
// ЛОГИРОВАНИЕ
// ============================================================

/**
 * Логирует успешный парсинг Vue-файла.
 *
 * Формат:
 *   🎯 AiButton.vue (1ƒ, 5const, 4imp, cd=1, rx=1)
 *
 * Где:
 *   ƒ    — количество функций
 *   const — количество констант
 *   imp  — количество импортов
 *   cd   — количество conditionals
 *   lc   — количество lifecycle-хуков
 *   ef   — количество effects
 *   inj  — количество injections
 *   rx   — количество reactivity-связей
 *   ref  — количество templateRefs
 *
 * Показываются только непустые секции — чтобы не было
 * шума из нулей.
 *
 * @param file     — путь к файлу
 * @param entities — результат парсинга
 */
function logSuccess(file: string, entities: EntitiesResult): void {
  const name = path.basename(file);
  const parts: string[] = [];

  // ────────────────────────────────────────────────────────
  // Стандартные секции
  // ────────────────────────────────────────────────────────
  if (entities.functions.length > 0) {
    parts.push(`${entities.functions.length}ƒ`);
  }
  if (entities.constants.length > 0) {
    parts.push(`${entities.constants.length}const`);
  }
  if (entities.imports.length > 0) {
    parts.push(`${entities.imports.length}imp`);
  }

  // ────────────────────────────────────────────────────────
  // Vue-специфичные секции
  // ────────────────────────────────────────────────────────
  const e = entities as any;

  const cd = e.templateConditionals?.length ?? 0;
  if (cd > 0) parts.push(`cd=${cd}`);

  const lc = e.templateLifecycle?.length ?? 0;
  if (lc > 0) parts.push(`lc=${lc}`);

  const ef = e.templateEffects?.length ?? 0;
  if (ef > 0) parts.push(`ef=${ef}`);

  const inj = e.templateInjections?.length ?? 0;
  if (inj > 0) parts.push(`inj=${inj}`);

  const rx = e.templateReactivity?.length ?? 0;
  if (rx > 0) parts.push(`rx=${rx}`);

  const refs = e.templateRefs?.length ?? 0;
  if (refs > 0) parts.push(`ref=${refs}`);

  const comps = e.templateUsedComponents?.length ?? 0;
  if (comps > 0) parts.push(`comp=${comps}`);

  const icon = '🎯';
  const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  console.log(`   ${icon} ${name}${suffix}`);
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ (ДЛЯ ТЕСТОВ И API)
// ============================================================

/**
 * Проверяет, является ли расширение Vue-расширением.
 *
 * Экспортируется для использования в тестах и в
 * `parse-file.ts::dispatch()` (если понадобится).
 *
 * @param ext — расширение (с точкой, любой регистр)
 * @returns true, если расширение — `.vue`
 */
export function isVueExtension(ext: string): boolean {
  return ext.toLowerCase() === VUE_EXTENSION;
}

/**
 * Возвращает Vue-расширение.
 *
 * Экспортируется для документации и отладки.
 *
 * @returns `.vue`
 */
export function getVueExtension(): string {
  return VUE_EXTENSION;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default parseVueFile;
