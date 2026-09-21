// src/pipeline/stages/parse-vue.ts
// ============================================================
// STAGE 2b: PARSE VUE SFC (ОТВЕТВЛЕНИЕ)
// ============================================================
// Версия: 1.1.0
//
// ИЗМЕНЕНИЯ v1.1.0 (нормализация путей):
//   - ✅ ДОБАВЛЕН Шаг 1.5: резолвинг относительного пути в абсолютный
//     через `path.resolve(options.projectRoot, file)`.
//   - ✅ ИЗМЕНЕНО: `analyzeVueComponent(absolutePath, ...)` вместо
//     `analyzeVueComponent(file, ...)` — для валидных vscode-ссылок
//     и стабильных ID.
//   - ✅ ИЗМЕНЕНО: `convertVueAnalysisToEntities(vueAnalysis, absolutePath)`
//     вместо `convertVueAnalysisToEntities(vueAnalysis, file)`.
//   - ✅ ДОБАВЛЕН Шаг 4.5: нормализация `entities.filePath` обратно
//     в относительный путь из `ctx.files`.
//   - ✅ ОБНОВЛЕНЫ все вызовы `createEmptyEntitiesResult(file)` —
//     теперь принимают относительный путь (это и нужно для отчёта).
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия.
//   - Явная проверка расширения `.vue`.
//   - Fallback на пустой EntitiesResult для Vue без <script>.
//   - Расширенное логирование templateXxx-секций в verbose.
//   - Экспорт утилит `isVueExtension()` и `getVueExtension()`.
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
 *   1.5. ✅ РЕЗОЛВИНГ ПУТИ (v1.1.0)
 *        • `file` приходит из `ctx.files` и является ОТНОСИТЕЛЬНЫМ
 *          от `projectRoot`.
 *        • Вычисляем `absolutePath = path.resolve(projectRoot, file)`
 *          для передачи в анализаторы.
 *
 *   2. Vue-анализ
 *        • `analyzeVueComponent(absolutePath, opts)` из
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
 *        • `convertVueAnalysisToEntities(vueAnalysis, absolutePath)`
 *          из `core/entity-extractor/vue/convert-analysis.ts`.
 *        • Возвращает единый `EntitiesResult` со всеми полями,
 *          включая templateXxx.
 *
 *   4.5. ✅ НОРМАЛИЗАЦИЯ entities.filePath (v1.1.0)
 *        • `convertVueAnalysisToEntities` записал АБСОЛЮТНЫЙ путь
 *          (для корректных vscode-ссылок и idManager).
 *        • Заменяем `entities.filePath` на относительный из `file`
 *          и `entities.moduleName` на `path.basename(file)`.
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
 *   const entities = await parseVueFile('src/App.vue', ctx);
 *   // entities.filePath = 'src/App.vue'         (относительный)
 *   // entities.functions[0].vscode = 'vscode://file//abs/path/src/App.vue:10'
 *
 *   // Vue без <script> (иконка)
 *   const entities = await parseVueFile('src/Icon.vue', ctx);
 *   // entities = { functions: [], ..., templateXxx: [] }
 *   // (пустой, но не null)
 *
 *   // Не наш файл (защита от случайного вызова)
 *   const entities = await parseVueFile('src/utils.ts', ctx);
 *   // entities = null
 *
 * @param file — относительный путь к файлу (от projectRoot)
 * @param ctx  — контекст pipeline (для verbose-логирования
 *               и для получения projectRoot)
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
  // Шаг 1.5: ✅ РЕЗОЛВИНГ ПУТИ (v1.1.0)
  // ────────────────────────────────────────────────────────
  // `file` приходит из ctx.files и является ОТНОСИТЕЛЬНЫМ
  // от projectRoot. Для парсинга, fs-операций и vscode-ссылок
  // нужен АБСОЛЮТНЫЙ путь.
  //
  // После анализа нормализуем entities.filePath обратно
  // в относительный — это то, что попадёт в отчёт.
  // ────────────────────────────────────────────────────────
  const absolutePath = path.isAbsolute(file) ? file : path.resolve(options.projectRoot, file);

  // ────────────────────────────────────────────────────────
  // Шаг 2: Vue-анализ
  // ────────────────────────────────────────────────────────
  let vueAnalysis: ReturnType<typeof analyzeVueComponent>;
  try {
    // ✅ ЕДИНЫЙ ИСТОЧНИК: analyzeVueComponent
    //    Работает с @vue/compiler-sfc + ESTree AST.
    //    Внутри обрабатывает:
    //      • script / script setup
    //      • template (AST + regex fallback)
    //      • style (CSS-переменные, :deep())
    //      • props / emits / expose / slots
    //      • composables (use*)
    //      • functions, constants, variables, types, interfaces
    //      • lifecycle / effects / injections / reactivity
    //      • conditionals
    //      • templateRefs, cssVariables, deepSelectors
    //      • usedComponents, directives
    //
    // ✅ v1.1.0: передаём АБСОЛЮТНЫЙ путь — чтобы vscode-ссылки
    //    внутри анализатора были валидными, а idManager
    //    работал со стабильными ключами.
    vueAnalysis = analyzeVueComponent(absolutePath, {
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
    //    filePath — ОТНОСИТЕЛЬНЫЙ (это то, что попадёт в отчёт).
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
    //
    // ✅ v1.1.0: передаём АБСОЛЮТНЫЙ путь — для валидных
    //    vscode-ссылок и стабильных ID в idManager.
    entities = convertVueAnalysisToEntities(vueAnalysis, absolutePath);
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
  // Шаг 4.5: ✅ НОРМАЛИЗАЦИЯ entities.filePath (v1.1.0)
  // ────────────────────────────────────────────────────────
  // convertVueAnalysisToEntities записал АБСОЛЮТНЫЙ путь
  // (для корректных vscode-ссылок и idManager).
  // В отчёте мы хотим ОТНОСИТЕЛЬНЫЙ путь — переносимый
  // между машинами и не зависящий от cwd.
  //
  // Заменяем:
  //   • entities.filePath  = file (относительный из ctx.files)
  //   • entities.moduleName = path.basename(file)
  //
  // Внутренние поля (functions[].vscode, id) остаются с
  // абсолютными путями — это ожидаемо и не попадает
  // в FullJSON.files[].path.
  // ────────────────────────────────────────────────────────
  entities.filePath = file;
  entities.moduleName = path.basename(file);

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
 *   comp — количество usedComponents
 *
 * Показываются только непустые секции — чтобы не было
 * шума из нулей.
 *
 * @param file     — относительный путь к файлу
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
