// src/reporters/compact/diagnostics/count-conditionals.ts
// ============================================
// ПОДСЧЁТ CONDITIONALS В FULLJSON
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// ИСТОРИЯ
// ════════════════════════════════════════════════════════════
//
// v16.2.0 (РЕФАКТОРИНГ: выделено из compact-reporter.ts):
//   - ✅ Функция countConditionals перенесена из монолитного
//     compact-reporter.ts (v16.1.0) БЕЗ изменений логики.
//   - ✅ Импорт типа FullJSON идёт из ../../codec/codec-types.js.
//   - ✅ Публичный API НЕ ИЗМЕНИЛСЯ.
//   - ✅ Поведение 1:1 с v16.1.0.
//
// v15.0.2 (было в compact-reporter.ts):
//   - Функция использовалась для диагностики дублирования
//     conditionals после рефакторинга хранения.
//
// v15.0.0:
//   - Conditionals перемещены из top-level FullJSON.conditionals
//     в templates[].conditionals[].
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Считает общее количество conditionals (v-if / v-else-if /
// v-else) во всех templates[].
//
// ════════════════════════════════════════════════════════════
// ГДЕ ХРАНЯТСЯ CONDITIONALS
// ════════════════════════════════════════════════════════════
//
//   FullJSON (читаемый формат):
//     templates: TemplateData[]
//       └─ [i].conditionals: TemplateConditional[]
//             └─ { id, directive, fileId, line, conditionExpression,
//                  renderedComponent }
//
//   CompactJSON (сжатый формат):
//     cd: number[]   ← массив индексов в valueDict
//
//   То есть в FullJSON conditionals — это часть TemplateData,
//   а в CompactJSON — отдельная секция cd, ссылающаяся на
//   общий словарь values[].
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ НЕ TOP-LEVEL ПОЛЕ
// ════════════════════════════════════════════════════════════
//
//   До v15.0.0 conditionals хранились в top-level поле
//   FullJSON.conditionals. Это приводило к ДУБЛИРОВАНИЮ:
//   одна и та же информация была и в templates[], и в
//   conditionals[].
//
//   В v15.0.0 было принято решение убрать top-level поле
//   и оставить conditionals ТОЛЬКО внутри templates[].
//
//   Это:
//     • устранило рассинхрон между templates[].conditionals
//       и FullJSON.conditionals;
//     • уменьшило размер FullJSON;
//     • упростило round-trip (encode/decode).

// ════════════════════════════════════════════════════════════
// АЛГОРИТМ
// ════════════════════════════════════════════════════════════
//
//   1. Инициализация счётчика: count = 0.
//   2. Если full.templates === undefined → вернуть 0.
//   3. Для каждого template:
//        a. Если template.conditionals === undefined → пропустить.
//        b. Иначе → count += template.conditionals.length.
//   4. Вернуть count.
//
//   O(T), где T = число templates (обычно < 1000).
//   Каждый template обрабатывается за O(1).
//
// ════════════════════════════════════════════════════════════
// ПРИМЕРЫ
// ════════════════════════════════════════════════════════════
//
//   const full: FullJSON = {
//     templates: [
//       { conditionals: [{...}, {...}] },   // 2
//       { conditionals: [{...}] },           // 1
//       {},                                  // 0
//     ],
//     // ... остальные поля
//   };
//
//   countConditionals(full);
//   // → 3
//
//   // Пустой случай
//   countConditionals({ templates: [] } as FullJSON);
//   // → 0
//
//   countConditionals({} as FullJSON);
//   // → 0
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   // В generate-report.ts::logFullStats():
//   console.log(`   🎯 Conditionals: ${countConditionals(full)}`);
//
//   // В тестах:
//   import { countConditionals } from './count-conditionals.js';
//   expect(countConditionals(full)).toBe(5);
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ МОДУЛИ
// ════════════════════════════════════════════════════════════
//
//   - ../../codec/codec-types.ts               — FullJSON, TemplateData,
//                                                 TemplateConditional
//   - ../orchestration/generate-report.ts      — единственный потребитель
//   - ../pipeline/pass-4-extended.ts           — заполняет templates[].conditionals
// ============================================

import type { FullJSON } from '../../codec/codec-types.js';

// ============================================================
// ПОДСЧЁТ CONDITIONALS
// ============================================================

/**
 * Считает общее количество conditionals во всех
 * templates[].conditionals[].
 *
 * ════════════════════════════════════════════════════════════
 * ГДЕ ХРАНЯТСЯ CONDITIONALS
 * ════════════════════════════════════════════════════════════
 *
 *   FullJSON.templates[] — массив TemplateData.
 *   У каждого TemplateData есть опциональное поле
 *   `conditionals: TemplateConditional[]`.
 *
 *   В CompactJSON conditionals хранятся в отдельном поле
 *   `cd: number[]`, но в FullJSON — внутри templates[].
 *   Это архитектурное решение v15.0.0 (устранение
 *   дублирования top-level FullJSON.conditionals).
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО СЧИТАЕТСЯ
 * ════════════════════════════════════════════════════════════
 *
 *   Каждый элемент в templates[i].conditionals[] — это
 *   один условный рендеринг (v-if / v-else-if / v-else),
 *   извлечённый из `<template>` Vue-компонента.
 *
 *   Пример:
 *     <AiToolbar v-if="!props.isPopover" />
 *     <NDataTable v-else-if="isDirty" />
 *     <NEmpty v-else />
 *
 *   → 3 conditionals в этом template.
 *
 * ════════════════════════════════════════════════════════════
 * КРАЕВЫЕ СЛУЧАИ
 * ════════════════════════════════════════════════════════════
 *
 *   • full.templates === undefined       → 0
 *   • full.templates === []              → 0
 *   • template.conditionals === undefined → 0 для этого template
 *   • template.conditionals === []       → 0 для этого template
 *
 *   Функция НИКОГДА не бросает исключений.
 *
 * ════════════════════════════════════════════════════════════
 * ПРОИЗВОДИТЕЛЬНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   O(T), где T = число templates.
 *   Каждый template обрабатывается за O(1) (проверка
 *   на undefined + .length).
 *
 *   Для типичного Vue-проекта из 100–500 SFC функция
 *   работает за < 0.1 мс.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // 1. Обычный случай
 *   const full = readFullJson('./index.full.json');
 *   const n = countConditionals(full);
 *   console.log(`Conditionals: ${n}`);
 *
 *   // 2. Пустой проект (нет Vue)
 *   countConditionals({ templates: undefined } as FullJSON);
 *   // → 0
 *
 *   // 3. В verbose-логировании
 *   if (options.verbose) {
 *     console.log(`   🎯 Conditionals: ${countConditionals(full)}`);
 *   }
 *
 * @param full — FullJSON
 * @returns Общее количество conditionals во всех templates[]
 */
export function countConditionals(full: FullJSON): number {
    // ────────────────────────────────────────────────────────
    // 1. Инициализация счётчика
    // ────────────────────────────────────────────────────────
    let count = 0;

    // ────────────────────────────────────────────────────────
    // 2. Обход templates
    // ────────────────────────────────────────────────────────
    //
    // ⚠️ full.templates может быть undefined, если:
    //   • проект не содержит .vue файлов;
    //   • все .vue без <template> (только <script setup>);
    //   • Vue-секция не была собрана (hasTemplate === false).
    //
    // Оператор `?? []` защищает от undefined.
    // ────────────────────────────────────────────────────────
    for (const template of full.templates ?? []) {
        // ────────────────────────────────────────────────────
        // 3. Считаем conditionals для текущего template
        // ────────────────────────────────────────────────────
        //
        // ⚠️ template.conditionals может быть undefined, если
        // у компонента нет v-if/v-else-if/v-else в шаблоне.
        //
        // Оператор `?? 0` защищает от undefined.
        // ────────────────────────────────────────────────────
        count += (template.conditionals ?? []).length;
    }

    // ────────────────────────────────────────────────────────
    // 4. Возврат результата
    // ────────────────────────────────────────────────────────
    return count;
}
