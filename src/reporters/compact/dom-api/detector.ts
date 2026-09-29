// src/reporters/compact/dom-api/detector.ts
// ============================================================
// DETECTOR DOM API-ВЫЗОВОВ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Главный детектор DOM API-вызовов для одной функции.
// Обходит AST функции и собирает DomApiCall[]:
//   • CallExpression          — obj.method(...)
//   • BinaryExpression (=)    — obj.innerHTML = ...
//   • NewExpression           — new MutationObserver(...)
//
// ════════════════════════════════════════════════════════════
// АЛГОРИТМ
// ════════════════════════════════════════════════════════════
//
//   1. Построить scope через buildScopeForFunction.
//   2. Если scope.sourceFile === null — вернуть [].
//   3. Найти узел функции (targetFn) в SourceFile:
//        • FunctionDeclaration с именем fn.name
//        • VariableDeclaration с именем fn.name (init — arrow/function)
//   4. Если targetFn не найден — вернуть [].
//   5. Обойти targetFn.forEachDescendant и для каждого узла:
//        a. CallExpression:
//           - expr = node.getExpression()
//           - если PropertyAccess и method ∈ DOM_METHOD_MAP_LOCAL
//             и isLikelyDomReceiver(receiver) → добавить вызов
//        b. BinaryExpression с operator '=':
//           - left = node.getLeft()
//           - если PropertyAccess и prop ∈ DOM_PROPERTY_MAP_LOCAL
//             и isLikelyDomReceiver(receiver) → добавить вызов
//        c. NewExpression:
//           - ctorName = node.getExpression().getText()
//           - если ctorName ∈ DOM_OBSERVER_MAP_LOCAL → добавить вызов
//
// ════════════════════════════════════════════════════════════
// ФОРМАТ РЕЗУЛЬТАТА (DomApiCall)
// ════════════════════════════════════════════════════════════
//
//   {
//     id: 'd1',                 // глобальный счётчик
//     functionId: 'fn42',
//     fileId: 'f18',
//     category: 'add-event-listener',
//     effect: 'mixed',
//     method: 'addEventListener',
//     target: 'ref:dataTableRef',
//     targetKind: 'ref',
//     args: ["'click'", 'handleClick'],
//     argResolutions: [...],
//     line: 15,
//     column: 4,
//     context: { eventName: 'click', handlerFunctionId: 'fn43', ... },
//   }
//
// ════════════════════════════════════════════════════════════
// ОБРАБОТКА ОШИБОК
// ════════════════════════════════════════════════════════════
//
//   Функция НЕ бросает исключений. При любой ошибке возвращает
//   то, что успела собрать (обычно []).
//
//   Диагностика в AST_DEBUG_VUE=true:
//     • scope.sourceFile is null
//     • targetFn не найден
// ============================================================

import { Node as TsNode } from 'ts-morph';
import type { EntitiesResult } from '../../../types.js';
import { buildScopeForFunction } from './scope-builder.js';
import { isLikelyDomReceiver } from './heuristics.js';
import { resolveTargetLocal, resolveArgLocal, extractContextLocal } from './resolvers.js';
import {
    DOM_METHOD_MAP_LOCAL,
    DOM_PROPERTY_MAP_LOCAL,
    DOM_OBSERVER_MAP_LOCAL,
} from './method-maps.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Детектор DOM API-вызовов для одной функции.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   fn                   — FunctionData (id, name, fileId, line, ...)
 *   scriptPath           — виртуальный путь (.vue.__dom__.ts или .ts)
 *   fileId               — ID файла (f1, f2, ...)
 *   entitiesMap          — карта { filePath → EntitiesResult }
 *   tsProject            — ts-morph Project
 *   idCounter            — { value: number } — глобальный счётчик d1/d2/...
 *   originalAbsolutePath — реальный путь к .vue или .ts
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   DomApiCall[] — массив найденных вызовов. Может быть пустым.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const calls = detectDomApiCallsForFunction(
 *     fn,
 *     '/abs/path/App.vue.__dom__.ts',
 *     'f18',
 *     entitiesMap,
 *     tsProject,
 *     { value: 0 },
 *     '/abs/path/App.vue'
 *   );
 *   // calls = [
 *   //   { id: 'd1', category: 'add-event-listener', ... },
 *   //   { id: 'd2', category: 'query-selector', ... },
 *   // ]
 */
export function detectDomApiCallsForFunction(
    fn: any,
    scriptPath: string,
    fileId: string,
    entitiesMap: Record<string, EntitiesResult>,
    tsProject: any,
    idCounter: { value: number },
    originalAbsolutePath?: string
): any[] {
    // ────────────────────────────────────────────────────────
    // Шаг 1: построить scope
    // ────────────────────────────────────────────────────────
    const scope = buildScopeForFunction(
        fn,
        scriptPath,
        fileId,
        entitiesMap,
        tsProject,
        originalAbsolutePath
    );

    if (!scope) return [];

    const calls: any[] = [];
    const sf = scope.sourceFile;

    // ────────────────────────────────────────────────────────
    // Шаг 2: если нет SourceFile — вернуть []
    // ────────────────────────────────────────────────────────
    if (!sf) {
        if (process.env.AST_DEBUG_VUE === 'true') {
            console.warn(`   ⚠️ detectDomApiCallsForFunction: scope.sourceFile is null для ${fn.name}`);
        }
        return [];
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: найти узел функции (targetFn)
    // ────────────────────────────────────────────────────────
    let targetFn: any = null;

    sf.forEachDescendant((node: any) => {
        if (targetFn) return;

        // FunctionDeclaration с именем fn.name
        if (TsNode.isFunctionDeclaration(node) && node.getName() === fn.name) {
            targetFn = node;
        }

        // VariableDeclaration с именем fn.name (init — arrow/function)
        if (TsNode.isVariableDeclaration(node) && node.getName() === fn.name) {
            const init = node.getInitializer();
            if (init && (TsNode.isArrowFunction(init) || TsNode.isFunctionExpression(init))) {
                targetFn = init;
            }
        }
    });

    if (!targetFn) {
        if (process.env.AST_DEBUG_VUE === 'true') {
            console.warn(`   ⚠️ detectDomApiCallsForFunction: targetFn не найден для ${fn.name}`);
        }
        return [];
    }

    // ────────────────────────────────────────────────────────
    // Шаг 4-5: обход AST функции
    // ────────────────────────────────────────────────────────
    targetFn.forEachDescendant((node: any) => {
        // ======================================================
        // 4.1. CallExpression: obj.method(...)
        // ======================================================
        if (TsNode.isCallExpression(node)) {
            const expr = node.getExpression();

            if (TsNode.isPropertyAccessExpression(expr)) {
                const methodName = expr.getName();
                const info = DOM_METHOD_MAP_LOCAL[methodName];

                if (info && isLikelyDomReceiver(expr.getExpression(), scope)) {
                    const target = resolveTargetLocal(expr.getExpression(), scope);
                    const args = node.getArguments();

                    idCounter.value++;

                    calls.push({
                        id: `d${idCounter.value}`,
                        functionId: fn.id,
                        fileId,
                        category: info.category,
                        effect: info.effect,
                        method: methodName,
                        target: target.target,
                        targetKind: target.targetKind,
                        args: args.map((a: any) => a.getText()),
                        argResolutions: args.map((a: any, i: number) => resolveArgLocal(a, i, scope)),
                        line: node.getStartLineNumber(),
                        column: node.getStart() - sf.getFullStart(),
                        context: extractContextLocal(info.category, args, scope),
                    });
                }
            }
        }

        // ======================================================
        // 4.2. BinaryExpression: obj.innerHTML = ...
        // ======================================================
        if (TsNode.isBinaryExpression(node)) {
            const op = node.getOperatorToken().getText();

            if (op === '=') {
                const left = node.getLeft();

                if (TsNode.isPropertyAccessExpression(left)) {
                    const propName = left.getName();
                    const info = DOM_PROPERTY_MAP_LOCAL[propName];

                    if (info && isLikelyDomReceiver(left.getExpression(), scope)) {
                        const target = resolveTargetLocal(left.getExpression(), scope);

                        idCounter.value++;

                        calls.push({
                            id: `d${idCounter.value}`,
                            functionId: fn.id,
                            fileId,
                            category: info.category,
                            effect: info.effect,
                            method: `${propName} = ...`,
                            target: target.target,
                            targetKind: target.targetKind,
                            args: [node.getRight().getText()],
                            argResolutions: [resolveArgLocal(node.getRight(), 0, scope)],
                            line: node.getStartLineNumber(),
                            column: node.getStart() - sf.getFullStart(),
                            context: extractContextLocal(info.category, [node.getRight()], scope),
                        });
                    }
                }
            }
        }

        // ======================================================
        // 4.3. NewExpression: new MutationObserver(...)
        // ======================================================
        if (TsNode.isNewExpression(node)) {
            const ctorName = node.getExpression().getText();
            const category = DOM_OBSERVER_MAP_LOCAL[ctorName];

            if (category) {
                const args = node.getArguments() || [];

                idCounter.value++;

                calls.push({
                    id: `d${idCounter.value}`,
                    functionId: fn.id,
                    fileId,
                    category,
                    effect: 'write',
                    method: `new ${ctorName}`,
                    target: 'observer',
                    targetKind: 'unknown',
                    args: args.map((a: any) => a.getText()),
                    argResolutions: args.map((a: any, i: number) => resolveArgLocal(a, i, scope)),
                    line: node.getStartLineNumber(),
                    column: node.getStart() - sf.getFullStart(),
                    context: extractContextLocal(category, args, scope),
                });
            }
        }
    });

    return calls;
}
