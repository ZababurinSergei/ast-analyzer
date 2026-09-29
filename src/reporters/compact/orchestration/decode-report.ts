// src/reporters/compact/orchestration/decode-report.ts
// ============================================
// ДЕКОДИРОВАНИЕ И ЧТЕНИЕ ОТЧЁТОВ
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// ИСТОРИЯ
// ════════════════════════════════════════════════════════════
//
// v16.2.0 (РЕФАКТОРИНГ: выделено из compact-reporter.ts):
//   - ✅ Три функции перенесены из монолитного compact-reporter.ts
//     (v16.1.0) без изменений:
//       • decodeCompactReport  — in-memory decode
//       • readAndDecode        — чтение с диска + decode
//       • readFullJson         — чтение full.json
//   - ✅ Публичный API НЕ ИЗМЕНИЛСЯ.
//   - ✅ Поведение 1:1 с v16.1.0.
//
// v13.0.0 (было в compact-reporter.ts):
//   - valuesMode читается из compact.json (для обратной совместимости).
//
// v9.0.0:
//   - decodeCompactReport, readAndDecode, readFullJson.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Три функции для чтения и декодирования отчётов:
//
//   1. decodeCompactReport(compact, options)
//        CompactJSON → FullJSON через Codec.decode.
//        In-memory операция, без работы с диском.
//
//   2. readAndDecode(compactPath, options)
//        Читает CompactJSON с диска → JSON.parse → Codec.decode.
//        Автоматически извлекает valuesMode из compact.json
//        (для совместимости со старыми отчётами).
//
//   3. readFullJson(fullPath)
//        Читает FullJSON с диска → JSON.parse.
//        Без декодирования (FullJSON уже в читаемом виде).
//
// ════════════════════════════════════════════════════════════
// АРХИТЕКТУРА
// ════════════════════════════════════════════════════════════
//
//   ┌─────────────────────────────────────────────────────┐
//   │ decodeCompactReport                                 │
//   │   CompactJSON ──► Codec.decode ──► FullJSON         │
//   │   (in-memory, без fs)                               │
//   └─────────────────────────────────────────────────────┘
//
//   ┌─────────────────────────────────────────────────────┐
//   │ readAndDecode                                       │
//   │   file path ──► fs.readFileSync ──► JSON.parse      │
//   │              ──► извлечение valuesMode              │
//   │              ──► Codec.decode ──► FullJSON          │
//   └─────────────────────────────────────────────────────┘
//
//   ┌─────────────────────────────────────────────────────┐
//   │ readFullJson                                        │
//   │   file path ──► fs.readFileSync ──► JSON.parse      │
//   │              ──► FullJSON                           │
//   │   (без Codec.decode — FullJSON уже читаемый)        │
//   └─────────────────────────────────────────────────────┘
//
// ════════════════════════════════════════════════════════════
// ЖИЗНЕННЫЙ ЦИКЛ readAndDecode
// ════════════════════════════════════════════════════════════
//
//   1. Проверка существования файла (fs.existsSync).
//   2. Чтение файла (fs.readFileSync) — синхронно.
//   3. JSON.parse с обработкой ошибок.
//   4. Извлечение valuesMode из compact.valuesMode:
//        - если поле есть → используем его
//        - если нет → undefined (Codec.decode подставит дефолт)
//   5. Codec.decode(compact, { ...options, valuesMode }).
//   6. Возврат FullJSON.
//
//   Исключения:
//     • Файл не найден → Error('Файл не найден: <path>')
//     • JSON.parse упал → Error('Не удалось распарсить JSON: <msg>')
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ ЧИТАТЬ valuesMode ИЗ compact.json
// ════════════════════════════════════════════════════════════
//
//   Начиная с v12.0.0, CompactJSON содержит поле `valuesMode`
//   ('full' | 'relations'). Это критично для Codec.decode:
//   при valuesMode === 'relations' секция values[] была
//   отфильтрована при encode, и decode должен это учесть
//   при переиндексации cn.nonEmptyV.
//
//   Если valuesMode не передан в decode — Codec использует
//   дефолт 'relations', что может не совпасть с реальным
//   режимом старых compact.json (до v12.0.0), где поле
//   отсутствует и реальный режим был 'full'.
//
//   readAndDecode решает эту проблему: читает valuesMode из
//   compact.json и передаёт его в decode.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕРЫ
// ════════════════════════════════════════════════════════════
//
//   // 1. Декодирование in-memory
//   import { readAndDecode } from './reporters/compact/orchestration/index.js';
//   const full = decodeCompactReport(compact);
//   console.log(full.functions.length);
//
//   // 2. Чтение с диска + декодирование
//   const full = readAndDecode('./ast-graph-viewer/index.json');
//   // valuesMode автоматически извлечён из compact.json
//
//   // 3. С опциями (включить edges)
//   const full = readAndDecode('./out/index.json', { includeEdges: true });
//
//   // 4. Чтение full.json
//   const full = readFullJson('./ast-graph-viewer/index.full.json');
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ МОДУЛИ
// ════════════════════════════════════════════════════════════
//
//   - ../../codec/codec.ts         — Codec.decode
//   - ../../codec/codec-types.ts   — FullJSON, CompactJSON, DecodeOptions
//   - ../../codec/values-filter.ts — ValuesMode
// ============================================

import fs from 'fs';

import type {
    FullJSON,
    CompactJSON,
    DecodeOptions,
} from '../../codec/codec-types.js';
import { Codec } from '../../codec/codec.js';
import type { ValuesMode } from '../../codec/values-filter.js';

// ============================================================
// 1. IN-MEMORY ДЕКОДИРОВАНИЕ
// ============================================================

/**
 * Декодирует CompactJSON обратно в FullJSON.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   Тонкая обёртка над Codec.decode. НЕ работает с диском —
 *   принимает CompactJSON как объект и возвращает FullJSON.
 *
 *   Все опции декодирования (includeEdges, valuesMode,
 *   includeEmptyArrays, includeStatistics) передаются в
 *   Codec.decode.
 *
 * ════════════════════════════════════════════════════════════
 * КОГДА ИСПОЛЬЗОВАТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   - Когда compact уже в памяти (например, получен от
 *     generateCompactReport().compact).
 *   - В тестах (verify-roundtrip.ts, verify-consistency.ts).
 *   - Для проверки round-trip без записи на диск.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const result = generateCompactReport(entitiesMap, './out/index.json');
 *   if (result.compact) {
 *     const full = decodeCompactReport(result.compact);
 *     console.log(`Функций: ${full.functions.length}`);
 *   }
 *
 * @param compact — CompactJSON
 * @param options — DecodeOptions (includeEdges, valuesMode, ...)
 * @returns FullJSON
 */
export function decodeCompactReport(
    compact: CompactJSON,
    options: DecodeOptions = {}
): FullJSON {
    return Codec.decode(compact, options);
}

// ============================================================
// 2. ЧТЕНИЕ С ДИСКА + ДЕКОДИРОВАНИЕ
// ============================================================

/**
 * Читает CompactJSON с диска и декодирует в FullJSON.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверяет существование файла.
 *   2. Читает файл (fs.readFileSync).
 *   3. Парсит JSON (JSON.parse).
 *   4. Извлекает valuesMode из compact.valuesMode.
 *   5. Вызывает Codec.decode с valuesMode.
 *
 * ════════════════════════════════════════════════════════════
 * ИСКЛЮЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - Файл не найден:
 *       Error('Файл не найден: <compactPath>')
 *
 *   - JSON.parse упал:
 *       Error('Не удалось распарсить JSON: <original message>')
 *
 *   Обе ошибки синхронные (throw).
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ valuesMode ЧИТАЕТСЯ ИЗ compact.json
 * ════════════════════════════════════════════════════════════
 *
 *   См. JSDoc в заголовке модуля. Кратко: Codec.decode
 *   использует valuesMode для переиндексации cn.nonEmptyV.
 *   Если не передать — будет использован дефолт 'relations',
 *   что может не совпасть с реальным режимом старого
 *   compact.json (до v12.0.0).
 *
 *   Порядок приоритета:
 *     1. compact.valuesMode (если есть в файле)
 *     2. undefined (Codec.decode подставит дефолт)
 *
 *   Опции, переданные в `options`, имеют приоритет ниже,
 *   чем valuesMode из compact.json — потому что файл
 *   содержит реальный режим, в котором он был закодирован.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Базовый вызов
 *   const full = readAndDecode('./ast-graph-viewer/index.json');
 *
 *   // С включением edges
 *   const full = readAndDecode('./out/index.json', { includeEdges: true });
 *
 *   // Обработка ошибок
 *   try {
 *     const full = readAndDecode('./missing.json');
 *   } catch (err) {
 *     console.error(err.message);  // "Файл не найден: ..."
 *   }
 *
 * @param compactPath — путь к compact JSON
 * @param options     — DecodeOptions
 * @returns FullJSON
 * @throws Error если файл не найден или JSON невалиден
 */
export function readAndDecode(
    compactPath: string,
    options: DecodeOptions = {}
): FullJSON {
    // ────────────────────────────────────────────────────────
    // 1. Проверка существования файла
    // ────────────────────────────────────────────────────────
    if (!fs.existsSync(compactPath)) {
        throw new Error(`Файл не найден: ${compactPath}`);
    }

    // ────────────────────────────────────────────────────────
    // 2. Чтение файла
    // ────────────────────────────────────────────────────────
    const content = fs.readFileSync(compactPath, 'utf-8');
    let compact: CompactJSON;

    // ────────────────────────────────────────────────────────
    // 3. Парсинг JSON
    // ────────────────────────────────────────────────────────
    try {
        compact = JSON.parse(content) as CompactJSON;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Не удалось распарсить JSON: ${msg}`);
    }

    // ────────────────────────────────────────────────────────
    // 4. Извлечение valuesMode из compact.json
    // ────────────────────────────────────────────────────────
    //
    // ⚠️ Приоритет: compact.valuesMode > options.valuesMode.
    //
    // Причина: файл содержит РЕАЛЬНЫЙ режим, в котором он был
    // закодирован. Опции могут быть переданы пользователем по
    // ошибке (например, при чтении старого compact.json).
    //
    // ────────────────────────────────────────────────────────
    const valuesMode = (compact as any).valuesMode as ValuesMode | undefined;

    // ────────────────────────────────────────────────────────
    // 5. Декодирование
    // ────────────────────────────────────────────────────────
    return Codec.decode(compact, { ...options, valuesMode });
}

// ============================================================
// 3. ЧТЕНИЕ FULL.JSON С ДИСКА
// ============================================================

/**
 * Читает FullJSON с диска без декодирования.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверяет существование файла.
 *   2. Читает файл (fs.readFileSync).
 *   3. Парсит JSON (JSON.parse).
 *   4. Возвращает FullJSON.
 *
 *   НЕ вызывает Codec.decode, потому что FullJSON уже в
 *   читаемом формате (без коротких ключей, без словарей,
 *   без RLE).
 *
 * ════════════════════════════════════════════════════════════
 * ИСКЛЮЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - Файл не найден:
 *       Error('Файл не найден: <fullPath>')
 *
 *   - JSON.parse упал:
 *       Бросается оригинальная ошибка JSON.parse (без обёртки).
 *       ⚠️ Асимметрия с readAndDecode (там обёртка).
 *
 * ════════════════════════════════════════════════════════════
 * КОГДА ИСПОЛЬЗОВАТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   - Для чтения эталонных full.json в тестах.
 *   - Для отладки (сравнение с decode(compact)).
 *   - Когда Codec.decode не нужен (full.json уже читаемый).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Базовый вызов
 *   const full = readFullJson('./ast-graph-viewer/index.full.json');
 *   console.log(full.functions.length);
 *
 *   // Сравнение с decode(compact)
 *   const decoded = readAndDecode('./ast-graph-viewer/index.json');
 *   const full = readFullJson('./ast-graph-viewer/index.full.json');
 *   // decoded и full должны быть эквивалентны
 *
 * @param fullPath — путь к full JSON
 * @returns FullJSON
 * @throws Error если файл не найден
 */
export function readFullJson(fullPath: string): FullJSON {
    // ────────────────────────────────────────────────────────
    // 1. Проверка существования файла
    // ────────────────────────────────────────────────────────
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Файл не найден: ${fullPath}`);
    }

    // ────────────────────────────────────────────────────────
    // 2. Чтение файла
    // ────────────────────────────────────────────────────────
    const content = fs.readFileSync(fullPath, 'utf-8');

    // ────────────────────────────────────────────────────────
    // 3. Парсинг и возврат
    // ────────────────────────────────────────────────────────
    return JSON.parse(content) as FullJSON;
}
