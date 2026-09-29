// src/reporters/compact/pipeline/pass-3-calls.ts
// ============================================
// ПРОХОД 3: ВЫЗОВЫ + MERGE CROSS-FILE
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.1.0 (рефакторинг: выделение в отдельный модуль):
//   - ✅ ПЕРЕПИСАНО: логика третьего прохода вынесена из
//     collectFullJSON в отдельный модуль.
//   - ✅ ИСПОЛЬЗУЕТСЯ: CollectContext (../pipeline/context.ts)
//   - ✅ ИСПОЛЬЗУЕТСЯ: detectCallType, findCallsInfo, mergeCrossFileCalls
//     из ../calls/* (единые источники).
//   - ✅ 100% поведение сохранено.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Третий проход pipeline'а. Отвечает за:
//
//     1. Прямые вызовы       — func.calls → ctx.calls
//     2. Резолвинг toFunc    — через ctx.functionMap
//     3. External-вызовы     — если toFunc не найден
//                              → toFunctionId = `external:${name}`
//     4. Обогащение из cross-file resolver:
//        mergeCrossFileCalls() — добавляет межфайловые вызовы,
//        которые обычный анализатор пропустил.
//
// ════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ МОМЕНТЫ
// ════════════════════════════════════════════════════════════
//
//   1. Резолвинг toFunc через functionMap:
//
//      const toFuncArray = ctx.functionMap.get(callName);
//      const toFunc = toFuncArray?.[0];
//
//      Если не найден — вызов external.
//
//      ⚠️ Берём [0] — если несколько функций с одинаковым
//         именем, берём первую. Это совпадает с оригиналом.
//
//   2. Self-вызовы (fromFunc.id === toFunc.id) — ПРОПУСКАЮТСЯ.
//
//      Это защита от самовызовов, которые не несут информации
//      для графа (рекурсия).
//
//   3. Для external-вызовов toFunctionId = `external:${callName}`.
//
//      Это маркер, который decode() восстанавливает обратно.
//      В CompactJSON external-вызовы кодируются через
//      combinedTy |= 4 (бит 4).
//
//   4. Дополнительные поля (column, callKind, calleeName,
//      argumentIndex) пробрасываются ТОЛЬКО если найдены
//      через findCallsInfo (callsInfo из v15.3.0).
//
//   5. detectCallType() определяет type:
//        • 'async'    — если func.isAsync
//        • 'callback' — если callName.endsWith('_callback')
//                     или в теле есть cbPattern
//        • 'method'   — если callName.includes('.')
//        • 'direct'   — иначе
//
//   6. mergeCrossFileCalls() в конце прохода:
//        • Пропускает calls с cf.isCrossFile !== true
//        • Проверяет дедупликацию по
//          `${fromFunctionId}|${toFunctionId}|${line}`
//        • Добавляет только реально новые вызовы
//        • Возвращает количество добавленных
//
//   7. ⚠️ ВАЖНО: callCounter после merge продолжает нумерацию
//      с того же места:
//
//        const callCounter = { value: counters.call };
//        const added = mergeCrossFileCalls(ctx.calls, ..., callCounter);
//        counters.call = callCounter.value;
//
//      Это гарантирует, что ID (c1, c2, ...) не пересекаются
//      между обычными и cross-file вызовами.
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ОБХОДА
// ════════════════════════════════════════════════════════════
//
//   Идём по ctx.sortedFilePaths. Это гарантирует, что calls[]
//   идёт в одном порядке между прогонами.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   pass3Calls(ctx);
//
//   ctx.calls → [
//     { id: 'c1', fromFunctionId: 'fn1', toFunctionId: 'fn2', type: 'direct' },
//     { id: 'c2', fromFunctionId: 'fn1', toFunctionId: 'external:console.log', type: 'method' },
//     ...
//   ]
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./context.ts                    — CollectContext + getRelativePath
//   • ./collect-full-json.ts          — вызывает этот проход четвёртым
//   • ../calls/detect-type.ts         — detectCallType
//   • ../calls/calls-info.ts          — findCallsInfo
//   • ../calls/merge-cross-file.ts    — mergeCrossFileCalls
//   • ../codec/codec-types.ts         — CallData
// ============================================

import path from 'path';
import type { CallData } from '../../codec/codec-types.js';
import type { CrossFileCall } from '../../../core/cross-file-resolver/types.js';
import { detectCallType } from '../calls/detect-type.js';
import { findCallsInfo } from '../calls/calls-info.js';
import { mergeCrossFileCalls } from '../calls/merge-cross-file.js';
import type { CollectContext } from './context.js';
import { getRelativePath } from './context.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ПРОХОДА
// ============================================================

/**
 * Проход 3: вызовы + merge cross-file.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   Для каждого filePath из ctx.sortedFilePaths:
 *
 *     1. Получить entities, module, file
 *     2. Для каждой функции в файле:
 *        2.1. Найти fromFunc в ctx.functionMap
 *        2.2. Для каждого callName из func.calls:
 *              a. Найти toFunc в ctx.functionMap
 *              b. detectCallType() — определить тип
 *              c. findCallsInfo() — метаданные (column, callKind, ...)
 *              d. Если toFunc не найден:
 *                   → создать external-вызов
 *                 Иначе если fromFunc === toFunc:
 *                   → пропустить (self-вызов)
 *                 Иначе:
 *                   → создать обычный вызов
 *        2.3. Добавить CallData в ctx.calls
 *
 *   3. mergeCrossFileCalls() в конце:
 *        • Обогатить ctx.calls межфайловыми вызовами
 *        • Обновить counters.call
 *
 * ════════════════════════════════════════════════════════════
 * МУТИРУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ctx.calls, ctx.counters.call
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param ctx — контекст сбора (мутируется)
 */
export function pass3Calls(ctx: CollectContext): void {
    const { entitiesMap, sortedFilePaths, counters } = ctx;

    // ────────────────────────────────────────────────────────────
    // Обход всех файлов в стабильном порядке
    // ────────────────────────────────────────────────────────────
    for (const filePath of sortedFilePaths) {
        const entities = entitiesMap[filePath];
        if (!entities) continue;

        const relativePath = getRelativePath(ctx, filePath);
        const dirName = path.basename(path.dirname(relativePath)) || 'root';

        const module = ctx.moduleMap.get(dirName);
        const file = ctx.fileMap.get(relativePath);

        // Если модуль или файл не найдены — пропускаем.
        if (!module || !file) continue;

        const funcs = entities.functions || [];

        // ────────────────────────────────────────────────────────
        // Обработка вызовов для каждой функции
        // ────────────────────────────────────────────────────────
        for (const func of funcs) {
            if (!func || !func.name) continue;

            // ── Резолвинг fromFunc через functionMap ──
            //
            // Если функции нет в карте — пропускаем (не может
            // быть источника вызова).
            const fromFuncArray = ctx.functionMap.get(func.name);
            const fromFunc = fromFuncArray && fromFuncArray.length > 0 ? fromFuncArray[0] : undefined;
            if (!fromFunc) continue;

            const callsList = func.calls || [];

            // ── Обработка каждого вызова ──
            for (const callName of callsList) {
                if (!callName) continue;

                // ── Резолвинг toFunc через functionMap ──
                const toFuncArray = ctx.functionMap.get(callName);
                const toFunc = toFuncArray && toFuncArray.length > 0 ? toFuncArray[0] : undefined;

                // ── Определение типа вызова ──
                //
                // detectCallType возвращает:
                //   • 'async'    — если func.isAsync
                //   • 'callback' — если callName.endsWith('_callback')
                //                 или в теле есть cbPattern
                //   • 'method'   — если callName.includes('.')
                //   • 'direct'   — иначе
                const callType = detectCallType(func, callName);

                // ── Метаданные вызова (v15.3.0) ──
                //
                // findCallsInfo ищет в func.callsInfo запись по callName.
                // Может вернуть:
                //   • { targetName, line, column, callKind, calleeName, argumentIndex }
                //   • undefined — если метаданных нет
                const info = findCallsInfo(func, callName);

                // ────────────────────────────────────────────────────
                // СЛУЧАЙ 1: toFunc НЕ найден → external-вызов
                // ────────────────────────────────────────────────────
                //
                // Функция не объявлена в проекте. Возможно это:
                //   • встроенная (console.log, Math.max)
                //   • из node_modules (imported, но не в entitiesMap)
                //   • динамическая (eval, Function)
                //
                // Помечаем как external:${callName}.
                // ────────────────────────────────────────────────────
                if (!toFunc) {
                    counters.call++;

                    const callData: CallData = {
                        id: `c${counters.call}`,
                        fromFunctionId: fromFunc.id,
                        toFunctionId: `external:${callName}`,
                        line: info?.line ?? func.line ?? 0,
                        type: callType,
                    };

                    // Пробрасываем метаданные только если они есть
                    if (info?.column !== undefined) callData.column = info.column;
                    if (info?.callKind !== undefined) callData.callKind = info.callKind;
                    if (info?.calleeName !== undefined) callData.calleeName = info.calleeName;
                    if (info?.argumentIndex !== undefined) callData.argumentIndex = info.argumentIndex;

                    ctx.calls.push(callData);
                    continue;
                }

                // ────────────────────────────────────────────────────
                // СЛУЧАЙ 2: self-вызов (fromFunc === toFunc) → пропускаем
                // ────────────────────────────────────────────────────
                //
                // Прямая рекурсия. Не несёт информации для графа
                // (не создаёт новых рёбер между разными функциями).
                // ────────────────────────────────────────────────────
                if (fromFunc.id === toFunc.id) continue;

                // ────────────────────────────────────────────────────
                // СЛУЧАЙ 3: обычный вызов
                // ────────────────────────────────────────────────────
                counters.call++;

                const callData: CallData = {
                    id: `c${counters.call}`,
                    fromFunctionId: fromFunc.id,
                    toFunctionId: toFunc.id,
                    line: info?.line ?? func.line ?? 0,
                    type: callType,
                };

                // Пробрасываем метаданные только если они есть
                if (info?.column !== undefined) callData.column = info.column;
                if (info?.callKind !== undefined) callData.callKind = info.callKind;
                if (info?.calleeName !== undefined) callData.calleeName = info.calleeName;
                if (info?.argumentIndex !== undefined) callData.argumentIndex = info.argumentIndex;

                ctx.calls.push(callData);
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // ОБОГАЩЕНИЕ ИЗ CROSS-FILE RESOLVER
    // ════════════════════════════════════════════════════════════
    //
    // mergeCrossFileCalls добавляет вызовы, которые обычный
    // анализатор (extract-entities-from-ast) пропустил:
    //   • вызовы через import из другого файла
    //   • вызовы методов с резолвингом через ts-morph
    //   • вызовы через алиасы
    //
    // ⚠️ Дедупликация по ключу:
    //    `${fromFunctionId}|${toFunctionId}|${line}`
    //
    // ⚠️ callCounter — объект { value }, потому что
    //    mergeCrossFileCalls его мутирует. После вызова
    //    мы сохраняем новое значение в counters.call.
    //
    // ⚠️ isCrossFile === false → пропускается.
    //    Это внутрифайловые вызовы, которые уже есть в
    //    обычном проходе.
    // ════════════════════════════════════════════════════════════

    const callCounter = { value: counters.call };

    const added = mergeCrossFileCalls(
        ctx.calls,
        ctx.crossFileCalls as CrossFileCall[] | undefined,
        callCounter
    );

    // Сохраняем обновлённый счётчик обратно
    counters.call = callCounter.value;

    // ────────────────────────────────────────────────────────────
    // Verbose-логирование
    // ────────────────────────────────────────────────────────────
    if (ctx.verbose && added > 0) {
        console.log(`   🔗 Добавлено межфайловых вызовов: ${added}`);
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass3Calls;
