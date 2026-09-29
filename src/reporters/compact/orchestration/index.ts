// src/reporters/compact/orchestration/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ ORCHESTRATION
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Это фасад подсистемы `orchestration/`, которая отвечает за
// верхнеуровневую оркестрацию генерации и декодирования
// компактного отчёта.
//
// Подсистема НЕ содержит логики анализа кода — только:
//   1. Вызов collectFullJSON (сборка FullJSON из entitiesMap).
//   2. Вызов Codec.encode / Codec.decode (сериализация).
//   3. Сохранение артефактов на диск (compact + full + edges).
//   4. Диагностику round-trip (в verbose-режиме).
//
// ════════════════════════════════════════════════════════════
// СОСТАВ ПОДСИСТЕМЫ
// ════════════════════════════════════════════════════════════
//
//   orchestration/
//     ├── index.ts           ← ЭТОТ ФАЙЛ (единая точка входа)
//     ├── generate-report.ts ← generateCompactReport
//     └── decode-report.ts   ← decodeCompactReport, readAndDecode, readFullJson
//
// ════════════════════════════════════════════════════════════
// ЭКСПОРТЫ
// ════════════════════════════════════════════════════════════
//
//   1. generateCompactReport  (из generate-report.ts)
//      Полный цикл: collectFullJSON → Codec.encode → save
//      Возвращает GenerateReportResult с full, compact,
//      путями и статистикой.
//
//   2. decodeCompactReport    (из decode-report.ts)
//      Тонкая обёртка над Codec.decode.
//      CompactJSON → FullJSON.
//
//   3. readAndDecode          (из decode-report.ts)
//      Читает CompactJSON с диска (через fs) и декодирует.
//      Автоматически определяет valuesMode из compact.json.
//
//   4. readFullJson           (из decode-report.ts)
//      Читает FullJSON с диска (через fs) без декодирования.
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
//   } from './reporters/compact/orchestration/index.js';
//
//   // Генерация
//   const result = generateCompactReport(entitiesMap, './out/index.json', {
//     valuesMode: 'relations',
//     projectRoot: './src',
//     verbose: true,
//   });
//
//   // Декодирование in-memory
//   const full = decodeCompactReport(result.compact!);
//
//   // Декодирование с диска
//   const full2 = readAndDecode('./out/index.json');
//
//   // Чтение full.json
//   const full3 = readFullJson('./out/index.full.json');
//
// ════════════════════════════════════════════════════════════
// ИЕРАРХИЯ ВЫЗОВОВ
// ════════════════════════════════════════════════════════════
//
//   compact-reporter.ts (фасад v16.2.0)
//     │
//     └── compact/index.ts (v16.2.0)
//         │
//         └── compact/orchestration/index.ts  ← ЭТОТ ФАЙЛ
//             │
//             ├── generate-report.ts
//             │   ├── ../pipeline/collect-full-json.ts
//             │   ├── ../persistence/save-json.ts
//             │   ├── ../persistence/path-utils.ts
//             │   └── ../../codec/codec.ts (Codec.encode)
//             │
//             └── decode-report.ts
//                 └── ../../codec/codec.ts (Codec.decode)
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ МОДУЛИ
// ════════════════════════════════════════════════════════════
//
//   - ../../codec/codec.ts               — Codec (encode/decode)
//   - ../../codec/codec-types.ts         — GenerateReportOptions/Result
//   - ../../codec/values-filter.ts       — ValuesMode
//   - ../pipeline/collect-full-json.ts   — collectFullJSON
//   - ../persistence/save-json.ts        — saveJsonFile
//   - ../persistence/path-utils.ts       — insertSuffixBeforeExtension
//   - ../diagnostics/count-conditionals.ts — countConditionals
// ============================================

// ============================================================
// 1. ГЕНЕРАЦИЯ ОТЧЁТА
// ============================================================
// Верхнеуровневый оркестратор полного цикла:
//   entitiesMap → collectFullJSON → Codec.encode → saveJsonFile
//
// Возвращает GenerateReportResult:
//   {
//     full,          // FullJSON
//     compact,       // CompactJSON (если compress !== false)
//     compactPath,   // путь к сжатому JSON
//     fullPath,      // путь к полному JSON (если saveFull)
//     edgesPath,     // путь к edges JSON (если saveEdges)
//     stats: {
//       duration, compactSize, fullSize, edgesSize,
//       compressionRatio, valuesMode, valuesCount,
//     },
//   }
// ============================================================

export {
    /**
     * Генерирует компактный отчёт из карты сущностей.
     *
     * @param entitiesMap — карта «путь файла → EntitiesResult»
     * @param outputPath  — путь для сохранения (опционально)
     * @param options     — GenerateReportOptions
     * @returns GenerateReportResult
     */
        generateCompactReport,
} from './generate-report.js';

// ============================================================
// 2. ДЕКОДИРОВАНИЕ
// ============================================================
// Три функции для чтения/декодирования отчётов:
//   - decodeCompactReport — in-memory decode через Codec
//   - readAndDecode       — чтение с диска + decode
//   - readFullJson        — чтение full.json с диска (без decode)
// ============================================================

export {
    /**
     * Декодирует CompactJSON обратно в FullJSON.
     *
     * @param compact — CompactJSON
     * @param options — DecodeOptions (includeEdges, valuesMode, ...)
     * @returns FullJSON
     */
        decodeCompactReport,

    /**
     * Читает CompactJSON с диска и декодирует в FullJSON.
     * Автоматически определяет valuesMode из compact.json.
     *
     * @param compactPath — путь к compact JSON
     * @param options     — DecodeOptions
     * @returns FullJSON
     * @throws Если файл не найден или JSON невалиден
     */
        readAndDecode,

    /**
     * Читает FullJSON с диска без декодирования.
     *
     * @param fullPath — путь к full JSON
     * @returns FullJSON
     * @throws Если файл не найден
     */
        readFullJson,
} from './decode-report.js';
