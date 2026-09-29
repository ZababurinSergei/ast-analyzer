// src/reporters/compact/calls/detect-type.ts
// ============================================================
// ОПРЕДЕЛЕНИЕ ТИПА ВЫЗОВА
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Две функции для определения типа вызова:
//
//   1. detectCallType(func, callName)
//      Определяет CallData.type из тела функции и имени callee.
//      Используется в pass-3-calls.ts.
//
//   2. mapCrossFileCallKindToCallType(kind)
//      Маппит CrossFileCall.callKind (из cross-file resolver)
//      → CallData.type.
//      Используется в merge-cross-file.ts.
//
// ════════════════════════════════════════════════════════════
// CallData.type
// ════════════════════════════════════════════════════════════
//
//   'direct'   — прямой вызов func()
//   'async'    — await func() / функция isAsync
//   'method'   — obj.method()
//   'callback' — функция как аргумент: arr.map(x => x)
//
// ════════════════════════════════════════════════════════════
// CrossFileCall.callKind
// ════════════════════════════════════════════════════════════
//
//   'direct'      — foo()
//   'method'      — obj.foo()
//   'constructor' — new Foo()
//   'callback'    — колбэк
//   'new'         — new Foo() (синоним constructor)
// ============================================================

import type { FunctionInfo } from '../../../types.js';
import type { CrossFileCall } from '../../../core/cross-file-resolver/types.js';

// ============================================================
// 1. DETECT CALL TYPE
// ============================================================

/**
 * Определяет тип вызова по телу функции и имени callee.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ (порядок проверок)
 * ════════════════════════════════════════════════════════════
 *
 *   1. func.isAsync                    → 'async'
 *   2. callName.endsWith('_callback')  → 'callback'
 *   3. callName.includes('.')          → 'method'
 *   4. Проверка тела функции:
 *      • Регулярка `<callName>\s*\([^)]*(?:=>|function)`
 *        → 'callback'
 *      • Если регулярка падает → 'direct'
 *   5. Fallback                        → 'direct'
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   detectCallType({ isAsync: true, ... }, 'foo')
 *   // → 'async'
 *
 *   detectCallType({ isAsync: false, ... }, 'map_callback')
 *   // → 'callback'
 *
 *   detectCallType({ isAsync: false, ... }, 'obj.method')
 *   // → 'method'
 *
 *   detectCallType(
 *     { isAsync: false, body: 'arr.map(x => x)', ... },
 *     'map'
 *   )
 *   // → 'callback' (regex нашёл '=>')
 *
 *   detectCallType({ isAsync: false, body: 'foo()', ... }, 'foo')
 *   // → 'direct'
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЩИТА ОТ РЕГУЛЯРНЫХ ВЫРАЖЕНИЙ
 * ════════════════════════════════════════════════════════════
 *
 *   callName экранируется через `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`,
 *   чтобы символы типа `.`, `*`, `(`, `)` не ломали regexp.
 *
 *   Если построение regexp падает (например, из-за некорректного
 *   callName) — возвращается 'direct'.
 *
 * @param func      — FunctionInfo с полями isAsync, body
 * @param callName  — имя вызываемой функции
 * @returns 'direct' | 'async' | 'method' | 'callback'
 */
export function detectCallType(
    func: FunctionInfo,
    callName: string
): 'direct' | 'async' | 'method' | 'callback' {
    // 1. Async функция
    if (func.isAsync) return 'async';

    // 2. Явный callback по имени
    if (callName.endsWith('_callback')) return 'callback';

    // 3. Method call
    if (callName.includes('.')) return 'method';

    // 4. Проверка тела функции на callback-паттерн
    const body = func.body || '';
    if (body) {
        // Экранируем callName для безопасного использования в RegExp
        const escapedCallName = callName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        try {
            const cbPattern = new RegExp(
                String.raw`${escapedCallName}\s*\([^)]*(?:=>|function)`,
                'i'
            );
            if (cbPattern.test(body)) return 'callback';
        } catch {
            return 'direct';
        }
    }

    // 5. Fallback
    return 'direct';
}

// ============================================================
// 2. MAP CROSS-FILE CALL KIND → CALL TYPE
// ============================================================

/**
 * Маппит CrossFileCall.callKind → CallData.type.
 *
 * ════════════════════════════════════════════════════════════
 * ТАБЛИЦА МАППИНГА
 * ════════════════════════════════════════════════════════════
 *
 *   CrossFileCall.callKind   →   CallData.type
 *   ─────────────────────────────────────────────
 *   'direct'                 →   'direct'
 *   'method'                 →   'method'
 *   'constructor'            →   'method'
 *   'new'                    →   'method'
 *   'callback'               →   'callback'
 *   (любое другое)           →   'direct'
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ constructor/new → method
 * ════════════════════════════════════════════════════════════
 *
 *   CallData.type имеет только 4 значения:
 *     'direct' | 'async' | 'method' | 'callback'
 *
 *   Для new Foo() нет отдельного 'constructor'. Так как
 *   `new Foo()` синтаксически близок к `obj.method()`,
 *   маппим в 'method'.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   mapCrossFileCallKindToCallType('direct')
 *   // → 'direct'
 *
 *   mapCrossFileCallKindToCallType('method')
 *   // → 'method'
 *
 *   mapCrossFileCallKindToCallType('constructor')
 *   // → 'method'
 *
 *   mapCrossFileCallKindToCallType('new')
 *   // → 'method'
 *
 *   mapCrossFileCallKindToCallType('callback')
 *   // → 'callback'
 *
 * @param kind — CrossFileCall.callKind
 * @returns 'direct' | 'async' | 'method' | 'callback'
 */
export function mapCrossFileCallKindToCallType(
    kind: CrossFileCall['callKind']
): 'direct' | 'async' | 'method' | 'callback' {
    switch (kind) {
        case 'method':
        case 'constructor':
        case 'new':
            return 'method';
        case 'callback':
            return 'callback';
        default:
            return 'direct';
    }
}
