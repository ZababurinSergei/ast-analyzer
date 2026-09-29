// src/reporters/compact/calls/calls-info.ts
// ============================================================
// РАСШИРЕННАЯ ИНФОРМАЦИЯ О ВЫЗОВЕ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Извлекает расширенную информацию о вызове из func.callsInfo.
// Используется в pass-3-calls.ts для заполнения полей
// CallData: column, callKind, calleeName, argumentIndex.
//
// ════════════════════════════════════════════════════════════
// ЧТО ТАКОЕ func.callsInfo
// ════════════════════════════════════════════════════════════
//
//   func.callsInfo — массив, заполняемый в
//   `core/entity-extractor/ast/extract-entities-from-ast.ts`
//   (v17.0.0, P2) при обходе CallExpression/NewExpression.
//
//   Для каждого вызова сохраняется:
//     • targetName    — имя callee
//     • line          — строка вызова (1-based)
//     • column        — колонка вызова (1-based)
//     • callKind      — вид вызова ('direct' | 'method' | ...)
//     • calleeName    — имя callee (дубль targetName для отладки)
//     • argumentIndex — индекс аргумента (для колбэков)
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ В pass-3-calls.ts
// ════════════════════════════════════════════════════════════
//
//   const info = findCallsInfo(func, callName);
//   const callData: CallData = {
//     id: `c${counter}`,
//     fromFunctionId: fromFunc.id,
//     toFunctionId: toFunc?.id || `external:${callName}`,
//     line: info?.line ?? func.line ?? 0,
//     type: detectCallType(func, callName),
//   };
//   if (info?.column !== undefined) callData.column = info.column;
//   if (info?.callKind !== undefined) callData.callKind = info.callKind;
//   if (info?.calleeName !== undefined) callData.calleeName = info.calleeName;
//   if (info?.argumentIndex !== undefined) callData.argumentIndex = info.argumentIndex;
//
// ════════════════════════════════════════════════════════════
// ЗАЩИТА
// ════════════════════════════════════════════════════════════
//
//   • Если callsInfo === undefined/null — возвращает undefined.
//   • Если callsInfo не массив — возвращает undefined.
//   • Если callsInfo пустой — возвращает undefined.
//   • Если нет совпадений по targetName — возвращает undefined.
//   • Если несколько совпадений — возвращает ПЕРВОЕ.
//
//   Все проверки через `Array.isArray` и фильтрацию null.
// ============================================================

import type { FunctionInfo } from '../../../types.js';

// ============================================================
// ТИП
// ============================================================

/**
 * Расширенная информация о вызове.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЛЯ
 * ════════════════════════════════════════════════════════════
 *
 *   targetName     — имя вызываемой функции ('handleClick')
 *   line           — строка вызова (1-based)
 *   column         — колонка вызова (1-based, опционально)
 *
 *   callKind       — вид вызова:
 *                      • 'direct'          — foo()
 *                      • 'method'          — obj.foo()
 *                      • 'callback'        — arr.map(x => x)
 *                      • 'constructor'     — new Foo()
 *                      • 'tagged-template' — tag`...`
 *                      • 'optional-chain'  — obj?.foo()
 *                      • 'spread'          — foo(...args)
 *                      • 'new'             — new Foo()
 *
 *   calleeName     — имя callee (дубль targetName для отладки)
 *   argumentIndex  — индекс аргумента (для relation='callback')
 *
 * ════════════════════════════════════════════════════════════
 * ИСТОЧНИК
 * ════════════════════════════════════════════════════════════
 *
 *   Заполняется в extract-entities-from-ast.ts (v17.0.0, P2):
 *     if (node.type === 'CallExpression' || node.type === 'NewExpression') {
 *       const callInfo: ExtendedCallInfo = {
 *         targetName: calleeName,
 *         line,
 *         column: node.loc?.start?.column,
 *         callKind: detectCallKind(node),
 *         calleeName,
 *       };
 *       currentFn.callsInfo.push(callInfo);
 *     }
 */
export interface CallsInfoEntry {
    /** Имя вызываемой функции */
    targetName: string;

    /** Строка вызова (1-based) */
    line: number;

    /** Колонка вызова (1-based, опционально) */
    column?: number;

    /** Вид вызова */
    callKind?:
        | 'direct'
        | 'method'
        | 'callback'
        | 'constructor'
        | 'tagged-template'
        | 'optional-chain'
        | 'spread'
        | 'new';

    /** Имя callee (дубль targetName для отладки) */
    calleeName?: string;

    /** Индекс аргумента (для callback-вызовов) */
    argumentIndex?: number;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Ищет расширенную информацию о вызове в func.callsInfo.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Прочитать (func as any).callsInfo.
 *   2. Если не массив или пустой → вернуть undefined.
 *   3. Отфильтровать записи, у которых targetName === callName.
 *   4. Если нет совпадений → вернуть undefined.
 *   5. Вернуть первую запись.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // func.callsInfo = [
 *   //   { targetName: 'handleClick', line: 15, column: 4,
 *   //     callKind: 'method', calleeName: 'handleClick' },
 *   //   { targetName: 'console.log', line: 16, column: 2,
 *   //     callKind: 'method', calleeName: 'log' },
 *   // ]
 *
 *   findCallsInfo(func, 'handleClick')
 *   // → { targetName: 'handleClick', line: 15, column: 4, ... }
 *
 *   findCallsInfo(func, 'unknownFn')
 *   // → undefined
 *
 *   findCallsInfo({ name: 'foo' }, 'foo')   // без callsInfo
 *   // → undefined
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ НУЖНО ПЕРВОЕ СОВПАДЕНИЕ, А НЕ ПОСЛЕДНЕЕ
 * ════════════════════════════════════════════════════════════
 *
 *   Если функция вызывает одну и ту же функцию несколько раз
 *   на разных строках, callsInfo содержит несколько записей.
 *   Но в CallData мы записываем только ОДНУ строку — первую.
 *
 *   Это компромисс: точная строка вызова для повторных
 *   вызовов не критична, а размер отчёта уменьшается.
 *
 * @param func      — FunctionInfo с полем callsInfo
 * @param callName  — имя вызываемой функции
 * @returns CallsInfoEntry | undefined
 */
export function findCallsInfo(
    func: FunctionInfo,
    callName: string
): CallsInfoEntry | undefined {
    // 1. Читаем callsInfo (оно не объявлено в типе FunctionInfo явно)
    const callsInfo = (func as any).callsInfo as CallsInfoEntry[] | undefined;

    // 2. Проверяем, что это непустой массив
    if (!Array.isArray(callsInfo) || callsInfo.length === 0) return undefined;

    // 3. Фильтруем по targetName
    const matches = callsInfo.filter(ci => ci && ci.targetName === callName);

    // 4. Нет совпадений — undefined
    if (matches.length === 0) return undefined;

    // 5. Первое совпадение
    return matches[0];
}
