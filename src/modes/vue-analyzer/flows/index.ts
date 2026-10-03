// src/modes/vue-analyzer/flows/index.ts
// ============================================================
// VUE FLOW BUILDERS — ЭКСПОРТ
// ============================================================
// Версия: 1.0.0
//
// Симметрично `react-analyzer/flows/index.ts`.
//
// Экспортирует 4 билдера:
//   • buildVueStateFlows    — reactivity ↔ mutation ↔ read ↔ render
//   • buildVueEventFlows    — @click → handler → call → state → render
//   • buildVueRenderTree    — иерархия template с зависимостями
//   • buildVueFnHtmlUsage   — обратный индекс: функция → HTML
//
// ════════════════════════════════════════════════════════════
// ЭКСПОРТ ТИПОВ
// ════════════════════════════════════════════════════════════
//
// Тип `FunctionLike` — ЕДИНЫЙ для всех билдеров.
// Определён в `state-flows.ts`, реэкспортируется здесь.
//
// Остальные типы (SfcLike, ReactivityLike, ComponentEventLike, ...)
// доступны через прямые импорты из конкретных файлов:
//   import type { SfcLike } from './flows/render-tree.js';
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   import {
//     buildVueStateFlows,
//     buildVueEventFlows,
//     buildVueRenderTree,
//     buildVueFnHtmlUsage,
//     type FunctionLike,
//   } from './flows/index.js';
//
// ============================================================

// ──────────────────────────────────────────────────────────
// Билдеры
// ──────────────────────────────────────────────────────────

export { buildVueStateFlows } from './state-flows.js';
export { buildVueEventFlows } from './event-flows.js';
export { buildVueRenderTree } from './render-tree.js';
export { buildVueFnHtmlUsage } from './fn-html-usage.js';

// ──────────────────────────────────────────────────────────
// Общие типы
// ──────────────────────────────────────────────────────────

/**
 * Минимальная форма функции для анализа calls.
 *
 * Экспортируется из `state-flows.ts` и используется всеми билдерами.
 */
export type { FunctionLike } from './state-flows.js';
