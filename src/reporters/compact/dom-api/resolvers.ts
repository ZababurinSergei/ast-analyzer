// src/reporters/compact/dom-api/resolvers.ts
// ============================================================
// РЕЗОЛВЕРЫ TARGET / ARG / CONTEXT
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Три функции для извлечения деталей DOM API-вызова:
//   • resolveTargetLocal  — target вызова (document, ref, ...)
//   • resolveArgLocal     — разрешение одного аргумента
//   • extractContextLocal — контекст вызова (eventName, ...)
//
// Используется в detector.ts::detectDomApiCallsForFunction().
//
// ════════════════════════════════════════════════════════════
// ФОРМАТ РЕЗУЛЬТАТОВ
// ════════════════════════════════════════════════════════════
//
//   resolveTargetLocal:
//     { target: string, targetKind: string }
//     targetKind ∈ { document, window, query, ref, variable, unknown }
//
//   resolveArgLocal:
//     {
//       index: number,
//       raw: string,
//       kind: 'literal-string' | 'literal-number' | 'literal-bool'
//           | 'identifier' | 'member' | 'call' | 'arrow' | 'object',
//       resolvedFunctionId?: string,
//       resolvedSource?: 'local' | 'import' | 'unknown'
//     }
//
//   extractContextLocal:
//     {
//       eventName?, handlerFunctionId?, handlerSource?,
//       cssSelector?, htmlValue?, attributeName?
//     }
// ============================================================

import { Node as TsNode, SyntaxKind } from 'ts-morph';
import type { ScopeInternal } from './types.js';

// ============================================================
// 1. RESOLVE TARGET
// ============================================================

/**
 * Разрешает target DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * ПОДДЕРЖИВАЕМЫЕ СЛУЧАИ
 * ════════════════════════════════════════════════════════════
 *
 *   document                          → { target: 'document', targetKind: 'document' }
 *   window                            → { target: 'window', targetKind: 'window' }
 *   document.querySelector('#app')    → { target: 'query:#app', targetKind: 'query' }
 *   document.body                     → { target: 'document.body', targetKind: 'document' }
 *   this.$refs.dataTable              → { target: 'ref:dataTable', targetKind: 'ref' }
 *   dataTableRef.value                → { target: 'ref:dataTableRef', targetKind: 'ref' }
 *   someLocalVar                      → { target: 'variable:someLocalVar', targetKind: 'variable' }
 *   someImportedVar                   → { target: 'import:someImportedVar', targetKind: 'variable' }
 *   прочее                            → { target: <text>, targetKind: 'unknown' }
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const target = resolveTargetLocal(expr, scope);
 *   // для `dataTableRef.value.appendChild(...)`:
 *   //   → { target: 'ref:dataTableRef', targetKind: 'ref' }
 */
export function resolveTargetLocal(
    expr: any,
    scope: ScopeInternal
): { target: string; targetKind: string } {
    const text = expr.getText();

    // 1. Глобальные объекты
    if (text === 'document') return { target: 'document', targetKind: 'document' };
    if (text === 'window') return { target: 'window', targetKind: 'window' };

    // 2. querySelector(...)
    if (text.startsWith('document.querySelector')) {
        const m = text.match(/querySelector\(['"`]([^'"`]+)['"`]\)/);
        return { target: `query:${m ? m[1] : '?'}`, targetKind: 'query' };
    }

    // 3. document.*
    if (text.startsWith('document.')) return { target: text, targetKind: 'document' };

    // 4. this.$refs.*
    if (text.startsWith('this.$refs.')) {
        return { target: `ref:${text.split('.')[2] || '?'}`, targetKind: 'ref' };
    }

    // 5. ref.value → ref:refName
    if (TsNode.isPropertyAccessExpression(expr) && expr.getName() === 'value') {
        const refName = expr.getExpression().getText();
        if (scope.refs.has(refName)) {
            return { target: `ref:${refName}`, targetKind: 'ref' };
        }
    }

    // 6. Identifier из scope.locals / scope.imports
    if (TsNode.isIdentifier(expr)) {
        const name = expr.getText();
        if (scope.locals.has(name)) {
            return { target: `variable:${name}`, targetKind: 'variable' };
        }
        if (scope.imports.has(name)) {
            return { target: `import:${name}`, targetKind: 'variable' };
        }
    }

    // 7. Fallback
    return { target: text, targetKind: 'unknown' };
}

// ============================================================
// 2. RESOLVE ARG
// ============================================================

/**
 * Разрешает один аргумент DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * ОПРЕДЕЛЯЕМЫЕ KIND
 * ════════════════════════════════════════════════════════════
 *
 *   'literal-string'  — 'foo'
 *   'literal-number'  — 42
 *   'literal-bool'    — true / false
 *   'identifier'      — someVar
 *   'member'          — obj.prop
 *   'call'            — someFunc()
 *   'arrow'           — () => {}
 *   'object'          — { ... }
 *
 * ════════════════════════════════════════════════════════════
 * РЕЗОЛВИНГ IDENTIFIER
 * ════════════════════════════════════════════════════════════
 *
 *   Если аргумент — Identifier, дополнительно резолвим:
 *     • scope.locals.get(name)?.functionId → resolvedFunctionId = fnId
 *                                          resolvedSource = 'local'
 *     • scope.imports.has(name)            → resolvedSource = 'import'
 *     • иначе                              → resolvedSource = 'unknown'
 *
 *   Для arrow/function — resolvedSource = 'local'.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // element.addEventListener('click', handleClick);
 *   resolveArgLocal(argExpr0, 0, scope)
 *   // → { index: 0, raw: "'click'", kind: 'literal-string' }
 *
 *   resolveArgLocal(argExpr1, 1, scope)
 *   // → { index: 1, raw: 'handleClick', kind: 'identifier',
 *   //     resolvedFunctionId: 'fn42', resolvedSource: 'local' }
 */
export function resolveArgLocal(node: any, index: number, scope: ScopeInternal): any {
    const raw = node.getText();
    let kind = 'identifier';

    // Определяем kind аргумента
    if (TsNode.isStringLiteral(node)) kind = 'literal-string';
    else if (TsNode.isNumericLiteral(node)) kind = 'literal-number';
    else if (node.getKind() === SyntaxKind.TrueKeyword || node.getKind() === SyntaxKind.FalseKeyword) kind = 'literal-bool';
    else if (TsNode.isArrowFunction(node) || TsNode.isFunctionExpression(node)) kind = 'arrow';
    else if (TsNode.isObjectLiteralExpression(node)) kind = 'object';
    else if (TsNode.isCallExpression(node)) kind = 'call';
    else if (TsNode.isPropertyAccessExpression(node)) kind = 'member';

    const result: any = { index, raw, kind };

    // Резолвим Identifier
    if (TsNode.isIdentifier(node)) {
        const name = node.getText();
        const local = scope.locals.get(name);
        if (local?.functionId) {
            result.resolvedFunctionId = local.functionId;
            result.resolvedSource = 'local';
        } else if (scope.imports.has(name)) {
            result.resolvedSource = 'import';
        } else {
            result.resolvedSource = 'unknown';
        }
    } else if (TsNode.isArrowFunction(node) || TsNode.isFunctionExpression(node)) {
        // Колбэк — это локальная функция
        result.resolvedSource = 'local';
    }

    return result;
}

// ============================================================
// 3. EXTRACT CONTEXT
// ============================================================

/**
 * Извлекает контекст DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАВИСИМОСТЬ ОТ КАТЕГОРИИ
 * ════════════════════════════════════════════════════════════
 *
 *   add-event-listener / remove-event-listener / dispatch-event:
 *     • eventName        = args[0] (StringLiteral)
 *     • handlerFunctionId = args[1].functionId (только add)
 *     • handlerSource    = 'local' | 'import' | 'inline' | 'unknown'
 *
 *   query-selector / query-selector-all / closest / matches:
 *     • cssSelector = args[0] (StringLiteral)
 *
 *   inner-html / outer-html / insert-adjacent-html:
 *     • htmlValue = args[idx] (StringLiteral)
 *       idx = 1 для insert-adjacent-html, 0 для остальных
 *
 *   set-attribute / remove-attribute / get-attribute /
 *   has-attribute / toggle-attribute:
 *     • attributeName = args[0] (StringLiteral)
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // element.addEventListener('click', handleClick);
 *   extractContextLocal('add-event-listener', args, scope)
 *   // → {
 *   //     eventName: 'click',
 *   //     handlerFunctionId: 'fn42',
 *   //     handlerSource: 'local',
 *   //   }
 *
 *   // element.querySelector('.n-data-table-td');
 *   extractContextLocal('query-selector', args, scope)
 *   // → { cssSelector: '.n-data-table-td' }
 */
export function extractContextLocal(
    category: string,
    args: any[],
    scope: ScopeInternal
): any {
    const ctx: any = {};

    // ────────────────────────────────────────────────────────
    // Event listeners
    // ────────────────────────────────────────────────────────
    if (['add-event-listener', 'remove-event-listener', 'dispatch-event'].includes(category)) {
        // eventName = args[0]
        if (args[0] && TsNode.isStringLiteral(args[0])) {
            ctx.eventName = args[0].getLiteralValue();
        }

        // handlerFunctionId = args[1] (только add)
        if (category === 'add-event-listener' && args[1]) {
            if (TsNode.isIdentifier(args[1])) {
                const name = args[1].getText();
                const local = scope.locals.get(name);
                if (local?.functionId) {
                    ctx.handlerFunctionId = local.functionId;
                    ctx.handlerSource = 'local';
                } else if (scope.imports.has(name)) {
                    ctx.handlerSource = 'import';
                } else {
                    ctx.handlerSource = 'unknown';
                }
            } else if (TsNode.isArrowFunction(args[1]) || TsNode.isFunctionExpression(args[1])) {
                ctx.handlerSource = 'inline';
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // Query selectors
    // ────────────────────────────────────────────────────────
    if (['query-selector', 'query-selector-all', 'closest', 'matches'].includes(category)) {
        if (args[0] && TsNode.isStringLiteral(args[0])) {
            ctx.cssSelector = args[0].getLiteralValue();
        }
    }

    // ────────────────────────────────────────────────────────
    // HTML value
    // ────────────────────────────────────────────────────────
    if (['inner-html', 'outer-html', 'insert-adjacent-html'].includes(category)) {
        // insert-adjacent-html: args[1] = html, args[0] = position
        const idx = category === 'insert-adjacent-html' ? 1 : 0;
        if (args[idx] && TsNode.isStringLiteral(args[idx])) {
            ctx.htmlValue = args[idx].getLiteralValue();
        }
    }

    // ────────────────────────────────────────────────────────
    // Attributes
    // ────────────────────────────────────────────────────────
    if (['set-attribute', 'remove-attribute', 'get-attribute', 'has-attribute', 'toggle-attribute'].includes(category)) {
        if (args[0] && TsNode.isStringLiteral(args[0])) {
            ctx.attributeName = args[0].getLiteralValue();
        }
    }

    return ctx;
}
