// src/reporters/compact/calls/merge-cross-file.ts
// ============================================================
// СЛИЯНИЕ CALLS ИЗ CROSS-FILE RESOLVER
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Обогащает существующий массив CallData[] вызовами из
// cross-file resolver (v15.4.0, P3). Используется в
// pass-3-calls.ts после сбора обычных calls.
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ ЭТО НУЖНО
// ════════════════════════════════════════════════════════════
//
//   Обычный сбор calls (pass-3) использует:
//     • func.calls[]           — имена вызываемых функций
//     • ctx.functionMap.get()  — резолвинг по имени
//
//   Это работает, если callee ЛОКАЛЬНЫЙ (в том же проекте).
//   Но если callee импортирован из другого файла и имеет
//   одинаковое имя с локальной функцией — возможна ошибка.
//
//   Cross-file resolver (v15.4.0) использует ts-morph и
//   TypeChecker для ТОЧНОГО определения:
//     • какой именно файл содержит callee
//     • на какой строке он объявлен
//     • какой у него ID (fn42)
//
//   Результат — CrossFileCall[] с полями:
//     • fromFunctionId  — global ID (fn42)
//     • toFunctionId    — global ID (fn43)
//     • isCrossFile     — true, если from.fileId !== to.fileId
//     • callKind        — 'direct' | 'method' | 'constructor' | ...
//     • calleeName      — имя callee (для отладки)
//     • line, column    — координаты вызова
//
//   mergeCrossFileCalls добавляет ТОЛЬКО ТЕ вызовы, которые:
//     • isCrossFile === true
//     • ещё не присутствуют в calls[] (по ключу
//       fromFunctionId|toFunctionId|line)
//
// ════════════════════════════════════════════════════════════
// ДЕДУПЛИКАЦИЯ
// ════════════════════════════════════════════════════════════
//
//   Ключ дедупликации: `${fromFunctionId}|${toFunctionId}|${line}`.
//
//   Если такой ключ уже есть в existingCalls Set — пропускаем.
//   Иначе — добавляем и записываем ключ в Set.
//
//   Это устраняет дубликаты, когда один и тот же вызов
//   обнаружен и обычным сбором (pass-3), и cross-file resolver.
//
// ════════════════════════════════════════════════════════════
// ПРОДОЛЖЕНИЕ НУМЕРАЦИИ ID
// ════════════════════════════════════════════════════════════
//
//   В pass-3-calls.ts counters.call инкрементируется на
//   каждый добавленный вызов. После обычного сбора мы
//   передаём его в mergeCrossFileCalls как `{ value }`.
//
//   Функция:
//     1. Увеличивает callCounter.value перед созданием нового
//        CallData (чтобы id был `c${новое_значение}`).
//     2. Возвращает количество добавленных вызовов.
//
//   После вызова mergeCrossFileCalls в pass-3-calls.ts:
//     counters.call = callCounter.value;
//
//   Это гарантирует сквозную нумерацию c1, c2, c3, ...
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   // Вход
//   calls = [
//     { id: 'c1', fromFunctionId: 'fn1', toFunctionId: 'fn2', line: 10, type: 'direct' },
//   ]
//   crossFileCalls = [
//     { fromFunctionId: 'fn1', toFunctionId: 'fn3', line: 15,
//       isCrossFile: true, callKind: 'method', calleeName: 'foo', column: 4 },
//     { fromFunctionId: 'fn1', toFunctionId: 'fn2', line: 10,
//       isCrossFile: true, callKind: 'direct' },  // ← уже есть в calls
//   ]
//   callCounter = { value: 1 }
//
//   // Выход
//   calls = [
//     { id: 'c1', fromFunctionId: 'fn1', toFunctionId: 'fn2', line: 10, type: 'direct' },
//     { id: 'c2', fromFunctionId: 'fn1', toFunctionId: 'fn3', line: 15,
//       type: 'method', column: 4, callKind: 'method', calleeName: 'foo' },
//   ]
//   callCounter.value === 2
//   return 1
// ============================================================

import type { CallData } from '../../codec/codec-types.js';
import { mapCrossFileCallKindToCallType } from './detect-type.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Добавляет cross-file вызовы в существующий массив calls[].
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   calls          — массив CallData[] (мутируется)
 *   crossFileCalls — массив CrossFileCall[] из resolver
 *                    (может быть undefined)
 *   callCounter    — { value: number } — общий счётчик id
 *                    (мутируется)
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Если crossFileCalls пуст — возвращает 0.
 *   2. Строит Set существующих ключей из calls[].
 *   3. Для каждого cf из crossFileCalls:
 *      a. Пропускает, если !cf.isCrossFile (внутрифайловые
 *         уже собраны обычным путём).
 *      b. Строит ключ `from|to|line`.
 *      c. Пропускает, если ключ уже в Set.
 *      d. Инкрементирует callCounter.value.
 *      e. Создаёт CallData с id = `c${callCounter.value}`.
 *      f. Опционально добавляет column, callKind, calleeName.
 *      g. Пушит в calls[].
 *   4. Возвращает количество добавленных вызовов.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ ПРОВЕРЯТЬ isCrossFile
 * ════════════════════════════════════════════════════════════
 *
 *   Обычный сбор calls (pass-3) уже добавляет внутрифайловые
 *   вызовы. Cross-file resolver также возвращает внутрифайловые
 *   (с isCrossFile === false), но они, скорее всего, уже есть.
 *
 *   Дедупликация по ключу from|to|line отсекает дубликаты, но
 *   для надёжности мы пропускаем isCrossFile === false — это
 *   экономит CPU.
 *
 *   isCrossFile === true — гарантированно НОВЫЕ вызовы, которых
 *   нет в обычном сборе (потому что там name-based, а здесь
 *   точный резолвинг через ts-morph).
 *
 * ════════════════════════════════════════════════════════════
 * ИСПОЛЬЗОВАНИЕ В pass-3-calls.ts
 * ════════════════════════════════════════════════════════════
 *
 *   // После обычного сбора calls
 *   const callCounter = { value: counters.call };
 *   const added = mergeCrossFileCalls(
 *     ctx.calls,
 *     ctx.crossFileCalls as CrossFileCall[] | undefined,
 *     callCounter
 *   );
 *   counters.call = callCounter.value;
 *
 *   if (ctx.verbose && added > 0) {
 *     console.log(`   🔗 Добавлено межфайловых вызовов: ${added}`);
 *   }
 *
 * @param calls          — массив CallData (мутируется)
 * @param crossFileCalls — массив CrossFileCall (может быть undefined)
 * @param callCounter    — { value: number } (мутируется)
 * @returns количество добавленных вызовов
 */
export function mergeCrossFileCalls(
    calls: CallData[],
    crossFileCalls: any[] | undefined,
    callCounter: { value: number }
): number {
    // 1. Ранний выход, если crossFileCalls пуст
    if (!crossFileCalls || crossFileCalls.length === 0) return 0;

    // 2. Set существующих ключей
    const existingCalls = new Set<string>(
        calls.map(c => `${c.fromFunctionId}|${c.toFunctionId}|${c.line}`)
    );

    let added = 0;

    // 3. Проходим по crossFileCalls
    for (const cf of crossFileCalls) {
        // 3a. Только межфайловые
        if (!cf.isCrossFile) continue;

        // 3b. Ключ дедупликации
        const key = `${cf.fromFunctionId}|${cf.toFunctionId}|${cf.line}`;

        // 3c. Пропускаем дубликаты
        if (existingCalls.has(key)) continue;
        existingCalls.add(key);

        // 3d. Инкрементируем счётчик
        callCounter.value++;

        // 3e. Создаём CallData
        const call: CallData = {
            id: `c${callCounter.value}`,
            fromFunctionId: cf.fromFunctionId,
            toFunctionId: cf.toFunctionId,
            line: cf.line,
            type: mapCrossFileCallKindToCallType(cf.callKind),
        };

        // 3f. Опциональные поля
        if (cf.column !== undefined) call.column = cf.column;
        if (cf.callKind !== undefined) call.callKind = cf.callKind;
        if (cf.calleeName !== undefined) call.calleeName = cf.calleeName;

        // 3g. Добавляем в массив
        calls.push(call);
        added++;
    }

    // 4. Возвращаем количество добавленных
    return added;
}
