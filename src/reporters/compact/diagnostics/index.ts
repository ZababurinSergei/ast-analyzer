// src/reporters/compact/diagnostics/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ DIAGNOSTICS
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Это фасад подсистемы `diagnostics/`, которая содержит
// вспомогательные функции для диагностики и логирования
// состояния FullJSON.
//
// Подсистема НЕ содержит логики анализа кода и НЕ влияет
// на результат сборки — только считает и логирует.
//
// ════════════════════════════════════════════════════════════
// СОСТАВ ПОДСИСТЕМЫ
// ════════════════════════════════════════════════════════════
//
//   diagnostics/
//     ├── index.ts              ← ЭТОТ ФАЙЛ (единая точка входа)
//     └── count-conditionals.ts ← countConditionals
//
// ════════════════════════════════════════════════════════════
// ЭКСПОРТЫ
// ════════════════════════════════════════════════════════════
//
//   1. countConditionals(full)
//      Считает общее количество conditionals во всех
//      templates[].conditionals[].
//
//      Используется в:
//        • generateCompactReport — для verbose-логирования
//          (`🎯 Conditionals: N`)
//        • logFullStats          — для verbose-логирования
//          в generate-report.ts
//
//      ⚠️ Важно: conditionals хранятся НЕ в отдельном
//      top-level поле FullJSON, а внутри templates[].
//      Поэтому подсчёт идёт через reduce по templates[].
//
//      ⚠️ В CompactJSON conditionals хранятся в отдельном
//      поле `cd: number[]` — это ссылки на общий valueDict.
//      Но в FullJSON они внутри templates[].conditionals[].
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ ТОЛЬКО ОДНА ФУНКЦИЯ
// ════════════════════════════════════════════════════════════
//
//   В процессе декомпозиции compact-reporter.ts (v16.2.0)
//   большая часть диагностики — это просто `console.log`
//   внутри verbose-блоков. Они остались в
//   generate-report.ts::logFullStats(), потому что тесно
//   связаны с конкретными полями FullJSON.
//
//   Вынесена в отдельный модуль только одна чистая функция
//   countConditionals, потому что:
//     1. Она используется в ДВУХ местах (generate-report.ts
//        и, потенциально, в будущих diagnostics-функциях).
//     2. Она не зависит от verbose-режима — это чистое
//        вычисление.
//     3. Она тестируема изолированно.
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   import { countConditionals } from './reporters/compact/diagnostics/index.js';
//
//   // В generate-report.ts::logFullStats():
//   console.log(`   🎯 Conditionals: ${countConditionals(full)}`);
//
//   // В тестах:
//   const n = countConditionals(full);
//   expect(n).toBe(5);
//
// ════════════════════════════════════════════════════════════
// ИЕРАРХИЯ ВЫЗОВОВ
// ════════════════════════════════════════════════════════════
//
//   compact/index.ts
//     │
//     └── compact/orchestration/index.ts
//         │
//         └── compact/orchestration/generate-report.ts
//             │
//             └── compact/diagnostics/index.ts  ← ЭТОТ ФАЙЛ
//                 │
//                 └── compact/diagnostics/count-conditionals.ts
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ МОДУЛИ
// ════════════════════════════════════════════════════════════
//
//   - ./count-conditionals.ts                       — реализация
//   - ../orchestration/generate-report.ts           — потребитель
//   - ../../codec/codec-types.ts                    — FullJSON, TemplateData
// ============================================

// ============================================================
// 1. ПОДСЧЁТ CONDITIONALS
// ============================================================
// Единственная экспортируемая функция подсистемы.
// Считает общее количество conditionals во всех
// templates[].conditionals[].
//
// ⚠️ conditionals в FullJSON хранятся не в отдельном
// top-level поле, а внутри templates[]. Поэтому подсчёт
// идёт через reduce по templates[].
//
// Возвращает 0, если:
//   • full.templates === undefined
//   • full.templates === []
//   • у всех templates[] нет поля conditionals
//   • conditionals === undefined
// ============================================================

export {
    /**
     * Считает общее количество conditionals во всех
     * templates[].conditionals[].
     *
     * @param full — FullJSON
     * @returns Общее количество conditionals
     */
        countConditionals,
} from './count-conditionals.js';
