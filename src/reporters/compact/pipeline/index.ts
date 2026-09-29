// src/reporters/compact/pipeline/index.ts
// ============================================
// ПУБЛИЧНЫЙ API ПОДСИСТЕМЫ PIPELINE
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Единая точка входа для всех модулей подсистемы `pipeline`.
// Здесь собраны:
//   • collectFullJSON       — главный оркестратор сбора FullJSON
//   • createCollectContext  — фабрика контекста сбора
//   • CollectContext        — тип контекста (мутируемый)
//   • getRelativePath       — утилита нормализации пути
//
// ════════════════════════════════════════════════════════════
// АРХИТЕКТУРА (v16.1.0)
// ════════════════════════════════════════════════════════════
//
//   collectFullJSON() — оркестратор, последовательно вызывает:
//
//     pass1Modules(ctx)      — модули + файлы + функции + классы + константы
//     pass4Extended(ctx)     — templates + lifecycle/effects/injections/
//                              reactivity/types/typeRefs + lexicalLinks
//     pass2Exports(ctx)      — экспорты, реэкспорты, импорты
//     pass3Calls(ctx)        — вызовы + merge cross-file
//     pass5Vue(ctx)          — vue-секция + component usage
//     pass6DomApi(ctx)       — DOM API
//
//     + сборка ids/sourceChains
//     + сборка statistics
//     + canonicalizeFullJSON
//
// ⚠️ ПОРЯДОК ПРОХОДОВ КРИТИЧЕН:
//   1. pass1 заполняет moduleMap/fileMap/functionMap/sourceToFileIdMap
//   2. pass4 использует fileMap для templates
//   3. pass2 использует functionMap для exports/imports
//   4. pass3 использует functionMap для calls
//   5. pass5 использует allComponent* (заполненные в pass5)
//   6. pass6 использует files/functions для DOM API
//
//   Нарушение порядка ломает round-trip.
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./collect-full-json.ts   — главный оркестратор
//   • ./context.ts             — тип CollectContext + фабрика
//   • ./pass-1-modules.ts      — первый проход
//   • ./pass-2-exports.ts      — второй проход
//   • ./pass-3-calls.ts        — третий проход
//   • ./pass-4-extended.ts     — четвёртый проход
//   • ./pass-5-vue.ts          — пятый проход
//   • ./pass-6-dom-api.ts      — шестой проход
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
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
// ЭКСПОРТЫ
// ════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
// 1. ГЛАВНЫЙ ОРКЕСТРАТОР
// ────────────────────────────────────────────────────────────
// Собирает FullJSON из entitiesMap через 6 проходов.
//
// Сигнатура:
//   collectFullJSON(
//     entitiesMap: Record<string, EntitiesResult>,
//     verbose?: boolean,
//     valuesMode?: ValuesMode,
//     crossFileCalls?: CrossFileCall[],
//     projectRoot?: string
//   ): FullJSON
//
// Возвращает canonicalized FullJSON (через canonicalizeFullJSON).
// ────────────────────────────────────────────────────────────
export { collectFullJSON } from './collect-full-json.js';

// ────────────────────────────────────────────────────────────
// 2. КОНТЕКСТ СБОРА
// ────────────────────────────────────────────────────────────
// Мутируемый объект, который передаётся между проходами.
//
// Содержит:
//   • entitiesMap / verbose / valuesMode / crossFileCalls / projectRoot
//   • sortedFilePaths — стабильный порядок обхода
//   • результирующие массивы (modules, files, functions, ...)
//   • индексы (moduleMap, fileMap, functionMap, sourceToFileIdMap)
//   • счётчики (module, file, function, ..., lexical)
//   • аккумуляторы allComponent* (props/events/directives/slots/htmlInterpolations)
//   • vue / domApiCalls / lexicalLinks
// ────────────────────────────────────────────────────────────
export {
    createCollectContext,
    getRelativePath,
    type CollectContext,
} from './context.js';

// ────────────────────────────────────────────────────────────
// 3. ПРОХОДЫ (для тестов и внешних потребителей)
// ────────────────────────────────────────────────────────────
// Экспортируются отдельно, чтобы можно было:
//   • запускать в unit-тестах изолированно
//   • строить кастомный pipeline
//   • отлаживать отдельные этапы
//
// ⚠️ В обычном использовании НЕ вызывайте их напрямую —
//    используйте collectFullJSON(), который гарантирует
//    правильный порядок и финальную канонизацию.
// ────────────────────────────────────────────────────────────
export { pass1Modules } from './pass-1-modules.js';
export { pass2Exports } from './pass-2-exports.js';
export { pass3Calls } from './pass-3-calls.js';
export { pass4Extended } from './pass-4-extended.js';
export { pass5Vue } from './pass-5-vue.js';
export { pass6DomApi } from './pass-6-dom-api.js';

// ────────────────────────────────────────────────────────────
// 4. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ────────────────────────────────────────────────────────────
// Собираем основные функции в один объект для удобства:
//
//   import pipeline from './pipeline/index.js';
//   pipeline.collectFullJSON(entitiesMap, true, 'relations');
// ────────────────────────────────────────────────────────────

import { collectFullJSON } from './collect-full-json.js';
import {
    createCollectContext,
    getRelativePath,
} from './context.js';
import { pass1Modules } from './pass-1-modules.js';
import { pass2Exports } from './pass-2-exports.js';
import { pass3Calls } from './pass-3-calls.js';
import { pass4Extended } from './pass-4-extended.js';
import { pass5Vue } from './pass-5-vue.js';
import { pass6DomApi } from './pass-6-dom-api.js';

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
};
