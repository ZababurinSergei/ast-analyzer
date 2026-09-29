// src/reporters/compact/dom-api/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ DOM API
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Реэкспорт публичного API DOM API-подсистемы.
// Используется в pipeline/pass-6-dom-api.ts.
//
// СОДЕРЖИМОЕ
// ----------
//   • detectDomApiCallsForFunction — главный детектор
//   • buildScopeForFunction       — построение scope для функции
//   • isLikelyDomReceiver         — эвристика DOM-receiver
//
// ВНУТРЕННИЕ МОДУЛИ (не реэкспортируются)
// ---------------------------------------
//   • types.ts        — ScopeInternal, ScopeLocal, DomMethodInfoLocal
//   • method-maps.ts  — DOM_METHOD_MAP_LOCAL, DOM_PROPERTY_MAP_LOCAL,
//                       DOM_OBSERVER_MAP_LOCAL
//   • resolvers.ts    — resolveTargetLocal, resolveArgLocal,
//                       extractContextLocal
// ============================================================

export { detectDomApiCallsForFunction } from './detector.js';
export { buildScopeForFunction } from './scope-builder.js';
export { isLikelyDomReceiver } from './heuristics.js';
