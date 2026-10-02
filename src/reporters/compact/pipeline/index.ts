// src/reporters/compact/pipeline/index.ts
// ============================================
// ПУБЛИЧНЫЙ API ПОДСИСТЕМЫ PIPELINE
// ============================================
// Версия: 17.0.0 (v17.0.0: React-секция)
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Единая точка входа для подсистемы `pipeline`.
//   Экспортирует:
//     • collectFullJSON       — главный оркестратор сбора FullJSON
//     • createCollectContext  — фабрика контекста
//     • CollectContext        — тип контекста (интерфейс)
//     • getRelativePath       — утилита относительного пути
//     • pass1Modules...pass7React — отдельные проходы
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ПРОХОДОВ (v17.0.0)
// ════════════════════════════════════════════════════════════
//
//   collectFullJSON() вызывает проходы в порядке:
//
//     pass1Modules(ctx)      → модули + файлы + функции + классы + константы
//     pass4Extended(ctx)     → templates + lifecycle/effects/injections/
//                              reactivity/types/typeRefs + lexicalLinks
//     pass2Exports(ctx)      → экспорты, импорты, реэкспорты
//     pass3Calls(ctx)        → вызовы + merge cross-file
//     pass5Vue(ctx)          → vue-секция + component usage
//     pass6DomApi(ctx)       → DOM API
//     pass7React(ctx)        → react-секция (v17.0.0)
//
// ════════════════════════════════════════════════════════════
// ИМПОРТЫ
// ════════════════════════════════════════════════════════════
//
//   import { collectFullJSON } from './pipeline/index.js';
//
//   const full = collectFullJSON(
//     entitiesMap,
//     verbose,
//     'relations',
//     crossFileCalls,
//     projectRoot
//   );
//
// ════════════════════════════════════════════════════════════
// ⚠️ ВАЖНО
// ════════════════════════════════════════════════════════════
//
//   pass7React вызывается ПОСЛЕ pass6DomApi — не ломает
//   существующий pipeline. React-секция опциональна.
//
//   Если в проекте нет .tsx/.jsx файлов, pass7React сразу
//   выходит, ctx.react остаётся undefined, FullJSON.react
//   остаётся undefined — обратная совместимость.
// ============================================

// ────────────────────────────────────────────────────────────
// 1. ГЛАВНЫЙ ОРКЕСТРАТОР
// ────────────────────────────────────────────────────────────
// Экспорт функции collectFullJSON из ./collect-full-json.js.
//
// Она собирает FullJSON из entitiesMap, вызывая 7 проходов
// в фиксированном порядке (см. выше).
// ────────────────────────────────────────────────────────────
export { collectFullJSON } from './collect-full-json.js';

// ────────────────────────────────────────────────────────────
// 2. КОНТЕКСТ СБОРА
// ────────────────────────────────────────────────────────────
// Экспорт фабрики контекста и утилиты пути.
//
// CollectContext — мутируемый объект, в котором проходы
// накапливают результаты.
// ────────────────────────────────────────────────────────────
export { createCollectContext, getRelativePath, type CollectContext } from './context.js';

// ────────────────────────────────────────────────────────────
// 3. ПРОХОДЫ
// ────────────────────────────────────────────────────────────
// Экспорт отдельных проходов для юнит-тестов и переиспользования.
// ────────────────────────────────────────────────────────────
export { pass1Modules } from './pass-1-modules.js';
export { pass2Exports } from './pass-2-exports.js';
export { pass3Calls } from './pass-3-calls.js';
export { pass4Extended } from './pass-4-extended.js';
export { pass5Vue } from './pass-5-vue.js';
export { pass6DomApi } from './pass-6-dom-api.js';
export { pass7React } from './pass-7-react.js'; // ✅ v17.0.0

// ────────────────────────────────────────────────────────────
// 4. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ────────────────────────────────────────────────────────────
// Собираем основные функции в один объект для удобства:
//
//   import pipeline from './pipeline/index.js';
//   pipeline.collectFullJSON(entitiesMap, true, 'relations');
// ────────────────────────────────────────────────────────────

import { collectFullJSON } from './collect-full-json.js';
import { createCollectContext, getRelativePath } from './context.js';
import { pass1Modules } from './pass-1-modules.js';
import { pass2Exports } from './pass-2-exports.js';
import { pass3Calls } from './pass-3-calls.js';
import { pass4Extended } from './pass-4-extended.js';
import { pass5Vue } from './pass-5-vue.js';
import { pass6DomApi } from './pass-6-dom-api.js';
import { pass7React } from './pass-7-react.js'; // ✅ v17.0.0

export default {
  // Оркестратор
  collectFullJSON,

  // Контекст
  createCollectContext,
  getRelativePath,

  // Проходы
  pass1Modules,
  pass2Exports,
  pass3Calls,
  pass4Extended,
  pass5Vue,
  pass6DomApi,
  pass7React, // ✅ v17.0.0
};
