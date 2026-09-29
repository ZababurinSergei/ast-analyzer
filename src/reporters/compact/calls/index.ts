// src/reporters/compact/calls/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ CALLS
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Реэкспорт публичного API подсистемы calls. Используется в
// pipeline/pass-3-calls.ts и pipeline/pass-4-extended.ts.
//
// СОДЕРЖИМОЕ
// ----------
//   • detectCallType              — определение типа вызова
//   • mapCrossFileCallKindToCallType — маппинг CallKind → CallType
//   • findCallsInfo               — поиск расширенной информации
//   • buildCompactIdToGlobalFnIdMap — карта compactId → fnId
//   • mergeCrossFileCalls         — слияние calls из cross-file
//
// ТИПЫ
// ----
//   • CallsInfoEntry — расширенная информация о вызове
//
// ════════════════════════════════════════════════════════════
// ЗАВИСИМОСТИ
// ════════════════════════════════════════════════════════════
//
//   Все модули подсистемы calls независимы друг от друга:
//     • detect-type.ts      — не импортирует другие calls/*
//     • calls-info.ts       — не импортирует другие calls/*
//     • compact-id-map.ts   — не импортирует другие calls/*
//     • merge-cross-file.ts — импортирует только detect-type.ts
//                             (для mapCrossFileCallKindToCallType)
//
//   Это устраняет циклические импорты и позволяет использовать
//   каждый модуль изолированно.
// ============================================================

// ============================================================
// 1. ОПРЕДЕЛЕНИЕ ТИПА ВЫЗОВА
// ============================================================
// detectCallType — определяет 'direct' | 'async' | 'method' | 'callback'
//                  по телу функции и имени callName.
// mapCrossFileCallKindToCallType — маппит CallKind (из cross-file
//                  resolver) → CallType (для CallData).
// ============================================================
export { detectCallType, mapCrossFileCallKindToCallType } from './detect-type.js';

// ============================================================
// 2. РАСШИРЕННАЯ ИНФОРМАЦИЯ О ВЫЗОВЕ
// ============================================================
// findCallsInfo — ищет в func.callsInfo запись по callName.
//                 Возвращает line, column, callKind, calleeName,
//                 argumentIndex.
// CallsInfoEntry — тип записи (импортируется из @typescript-eslint
//                  AST в extract-entities-from-ast.ts).
// ============================================================
export { findCallsInfo, type CallsInfoEntry } from './calls-info.js';

// ============================================================
// 3. КАРТА COMPACT ID → GLOBAL FN ID
// ============================================================
// buildCompactIdToGlobalFnIdMap — строит Map<func.id, 'fn42'>.
//   Используется в pass-4-extended.ts для проброса lexicalLinks:
//   parentFunctionId/childFunctionId из compact-формата (func.id)
//   → global-формат (fn42).
// ============================================================
export { buildCompactIdToGlobalFnIdMap } from './compact-id-map.js';

// ============================================================
// 4. СЛИЯНИЕ CALLS ИЗ CROSS-FILE RESOLVER
// ============================================================
// mergeCrossFileCalls — добавляет вызовы из cross-file resolver
//   в существующий массив calls[] с дедупликацией.
//   Возвращает количество добавленных вызовов.
//   Использует callCounter: { value: number } — продолжает
//   нумерацию с того же места.
// ============================================================
export { mergeCrossFileCalls } from './merge-cross-file.js';
