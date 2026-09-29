// src/reporters/compact/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ COMPACT
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Это публичный фасад подсистемы `compact/`, которая является
// результатом декомпозиции монолитного `compact-reporter.ts`
// (v16.2.0, уменьшен с 121 KB до ~30 строк).
//
// Подсистема отвечает за:
//   1. Сбор FullJSON из entitiesMap (6 проходов).
//   2. Кодирование FullJSON → CompactJSON через Codec.
//   3. Декодирование CompactJSON → FullJSON.
//   4. Сохранение артефактов на диск (compact + full + edges).
//   5. Диагностику и логирование.
//
// ════════════════════════════════════════════════════════════
// АРХИТЕКТУРА ПОДСИСТЕМЫ
// ════════════════════════════════════════════════════════════
//
//   compact/
//     ├── orchestration/   ← generateCompactReport, decode, readAndDecode
//     │   ├── generate-report.ts
//     │   └── decode-report.ts
//     │
//     ├── pipeline/        ← collectFullJSON + 6 проходов
//     │   ├── context.ts
//     │   ├── collect-full-json.ts
//     │   ├── pass-1-modules.ts
//     │   ├── pass-2-exports.ts
//     │   ├── pass-3-calls.ts
//     │   ├── pass-4-extended.ts
//     │   ├── pass-5-vue.ts
//     │   └── pass-6-dom-api.ts
//     │
//     ├── entities/        ← resolveToFileId, import-type mapping
//     ├── calls/           ← detectCallType, calls-info, merge-cross-file
//     ├── vue/             ← convert-section, component-usage
//     ├── dom-api/         ← scope-builder, detector, heuristics, maps
//     ├── ids/             ← collect-ids, collect-source-chains, value-extractors
//     ├── persistence/     ← save-json, path-utils
//     └── diagnostics/     ← count-conditionals
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ПРОХОДОВ В collectFullJSON
// ════════════════════════════════════════════════════════════
//
//   pass1Modules    → модули, файлы, функции, классы, константы
//   pass4Extended   → templates, lifecycle, effects, injections,
//                     reactivity, types, typeRefs, lexicalLinks
//   pass2Exports    → экспорты, реэкспорты, импорты
//   pass3Calls      → вызовы + mergeCrossFileCalls
//   pass5Vue        → Vue-секция + component usage
//   pass6DomApi     → DOM API + fn.htmlUsage / isHtmlVisible
//
//   ⚠️ Порядок критичен:
//     - pass4 требует fileMap из pass1
//     - pass2 требует functionMap из pass1
//     - pass3 требует functionMap из pass1 + callsInfo
//     - pass5 требует fileMap + entitiesMap
//     - pass6 требует files + functions + entitiesMap
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   import {
//     generateCompactReport,
//     decodeCompactReport,
//     readAndDecode,
//     readFullJson,
//   } from './reporters/compact/index.js';
//
//   // 1. Генерация отчёта
//   const result = generateCompactReport(entitiesMap, './out/index.json', {
//     valuesMode: 'relations',
//     projectRoot: './src',
//     verbose: true,
//   });
//   // → { full, compact, compactPath, fullPath, edgesPath, stats }
//
//   // 2. Декодирование
//   const full = decodeCompactReport(result.compact);
//
//   // 3. Чтение с диска
//   const full2 = readAndDecode('./out/index.json');
//   const full3 = readFullJson('./out/index.full.json');
//
// ════════════════════════════════════════════════════════════
// ОБРАТНАЯ СОВМЕСТИМОСТЬ
// ════════════════════════════════════════════════════════════
//
// Все импорты старого `compact-reporter.ts` продолжают работать:
//
//   import { generateCompactReport } from './compact-reporter.js';
//
// `compact-reporter.ts` теперь тонкий фасад, который реэкспортирует
// из этого модуля (см. ./compact-reporter.ts v16.2.0).
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ МОДУЛИ
// ════════════════════════════════════════════════════════════
//
//   - ../codec/codec-types.ts    — FullJSON, CompactJSON, GenerateReportOptions
//   - ../codec/codec.ts          — Codec.encode / Codec.decode
//   - ../codec/values-filter.ts  — ValuesMode, isValueKept
//   - ../../core/vue-entity-classifier.ts — classifyVueEntities, VueEntities
//   - ../../pipeline/stages/build-report.ts — вызывающий код
// ============================================

// ============================================================
// 1. ОРКЕСТРАЦИЯ (генерация + декодирование)
// ============================================================
// Публичный API верхнего уровня. Все 4 функции являются
// точками входа для внешних потребителей.
//
// Экспорты:
//   - generateCompactReport  — сборка FullJSON + encode + save
//   - decodeCompactReport    — decode compact → full
//   - readAndDecode          — прочитать compact с диска + decode
//   - readFullJson           — прочитать full.json с диска
// ============================================================

export {
    /** Генерация компактного отчёта (full + compact + save) */
        generateCompactReport,
    /** Декодирование CompactJSON → FullJSON */
        decodeCompactReport,
    /** Прочитать CompactJSON с диска + декодировать в FullJSON */
        readAndDecode,
    /** Прочитать FullJSON с диска */
        readFullJson,
} from './orchestration/index.js';

// ============================================================
// 2. РЕЭКСПОРТ ТИПОВ
// ============================================================
// Публичные типы, необходимые внешним потребителям для
// типизации параметров и возвращаемых значений.
//
// ⚠️ Канонические определения — в модулях-источниках:
//   - GenerateReportOptions / GenerateReportResult → ../codec/codec-types.ts
//   - ValuesMode                                  → ../codec/values-filter.ts
//   - VueEntities                                 → ../../core/vue-entity-classifier.ts
//
// Здесь только реэкспорт для удобства:
//   import type { GenerateReportOptions } from './reporters/compact/index.js';
// ============================================================

export type {
    /** Опции генерации отчёта (projectRoot, valuesMode, verbose, ...) */
        GenerateReportOptions,
    /** Результат генерации (full, compact, пути, статистика) */
        GenerateReportResult,
} from '../codec/codec-types.js';

export type {
    /** Режим сериализации values: 'full' | 'relations' */
        ValuesMode,
} from '../codec/values-filter.js';

export type {
    /** Агрегированные Vue-сущности (SFC, composables, macros, ...) */
        VueEntities,
} from '../../core/vue-entity-classifier.js';
