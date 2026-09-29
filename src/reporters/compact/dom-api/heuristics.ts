// src/reporters/compact/dom-api/heuristics.ts
// ============================================================
// ЭВРИСТИКА: ЯВЛЯЕТСЯ ЛИ RECEIVER DOM-ЭЛЕМЕНТОМ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Определяет, является ли expression (receiver вызова метода)
// DOM-элементом. Используется в detector.ts для фильтрации
// DOM API-вызовов: только если receiver похож на DOM-элемент,
// вызов регистрируется.
//
// ════════════════════════════════════════════════════════════
// СТРАТЕГИЯ (4 уровня эвристик)
// ════════════════════════════════════════════════════════════
//
//   1. IDENTIFIER
//      • Глобальные: document, window, globalThis, navigator, location
//      • Из scope.locals: isRef / isDomElement / typeHint
//      • По имени: *Ref, *El, *Element, *Node, el, root
//
//   2. ТЕКСТОВЫЕ ПРЕФИКСЫ
//      • document.*, window.*
//      • this.$refs.*, this.$el
//      • this.*Ref/*El/*Element/*Node
//
//   3. CALLEXPRESSION
//      • document.querySelector(...)
//      • document.getElementById(...)
//      • *.querySelector(...), *.getElementById(...)
//
//   4. PROPERTYACCESS *.value
//      • ref.value, dataTableRef.value, contextMenuRef.value
//      • Если имя из scope.refs или scope.locals.isRef
//      • Или имя оканчивается на *Ref/*El/*Element/*Node
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ НЕ ИСПОЛЬЗУЕТСЯ TYPE CHECKER
// ════════════════════════════════════════════════════════════
//
//   Полный type resolution через TypeChecker был бы точнее,
//   но:
//     • требует полного ts.Program (медленно);
//     • ломается на .vue без настройки virtual FS;
//     • избыточен для нашей задачи (нужно ~90% точности).
//
//   Эвристики покрывают типичные паттерны Vue/React/vanilla.
// ============================================================

import { Node as TsNode } from 'ts-morph';
import type { ScopeInternal } from './types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Эвристика: является ли receiver DOM-элементом.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   expr  — expression (receiver вызова метода)
 *   scope — ScopeInternal (locals, imports, globals, refs)
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   true  — receiver похож на DOM-элемент → регистрируем вызов
 *   false — receiver НЕ похож → пропускаем
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   document.createElement(...)          → true (Identifier 'document')
 *   dataTableRef.value?.scrollTo(...)    → true (PropertyAccess '.value')
 *   el.appendChild(...)                  → true (Identifier 'el')
 *   this.$refs.menu.open(...)            → true (Text 'this.$refs.')
 *   document.querySelector('#app')       → true (CallExpression)
 *   foo.bar()                            → false (не DOM)
 *   arr.map(...)                         → false (не DOM)
 */
export function isLikelyDomReceiver(expr: any, scope: ScopeInternal): boolean {
    if (!expr) return false;

    // ==========================================================
    // 1. IDENTIFIER
    // ==========================================================
    if (TsNode.isIdentifier(expr)) {
        const name = expr.getText();

        // 1.1. Глобальные объекты
        if (['document', 'window', 'globalThis', 'navigator', 'location'].includes(name)) {
            return true;
        }

        // 1.2. Из scope.locals
        const local = scope.locals.get(name);
        if (local?.isRef || local?.isDomElement) return true;
        if (local?.typeHint && /Element|Node|HTML|HTMLElement|SVGElement/.test(local.typeHint)) {
            return true;
        }

        // 1.3. Эвристика по имени
        if (
            name.endsWith('Ref') ||
            name.endsWith('El') ||
            name.endsWith('Element') ||
            name.endsWith('Node') ||
            name === 'el' ||
            name === 'root'
        ) {
            return true;
        }
    }

    // ==========================================================
    // 2. ТЕКСТОВЫЕ ПРЕФИКСЫ
    // ==========================================================
    let text: string;
    try {
        text = expr.getText();
    } catch {
        return false;
    }

    // 2.1. document.*, window.*
    if (text.startsWith('document.') || text.startsWith('window.')) return true;

    // 2.2. Vue Options API: this.$refs.*, this.$el
    if (text.startsWith('this.$refs.') || text.startsWith('this.$el')) return true;

    // 2.3. this.*Ref/*El/*Element/*Node
    if (text.startsWith('this.')) {
        if (/^this\.[\w$]+(?:Ref|El|Element|Node)\b/.test(text)) return true;
    }

    // ==========================================================
    // 3. CALLEXPRESSION
    // ==========================================================
    if (TsNode.isCallExpression(expr)) {
        let calleeText: string;
        try {
            calleeText = expr.getExpression().getText();
        } catch {
            return false;
        }

        // 3.1. document.*, window.*
        if (/^(document|window)\./.test(calleeText)) return true;

        // 3.2. document.querySelector / getElementById / getElementsBy*
        if (/^(document|window)\.(querySelector|querySelectorAll|getElementById|getElementsBy)/.test(calleeText)) {
            return true;
        }

        // 3.3. Вложенные *.querySelector / *.getElementById
        if (TsNode.isPropertyAccessExpression(expr.getExpression())) {
            const inner = expr.getExpression() as any;
            const innerText = inner.getText();
            if (/\bquerySelector\b|\bgetElementById\b/.test(innerText)) return true;
        }
    }

    // ==========================================================
    // 4. PROPERTYACCESS *.value
    // ==========================================================
    if (TsNode.isPropertyAccessExpression(expr) && expr.getName() === 'value') {
        const refExpr = expr.getExpression();
        let refName: string;
        try {
            refName = refExpr.getText();
        } catch {
            return false;
        }

        // 4.1. Из scope.refs
        if (scope.refs.has(refName)) return true;

        // 4.2. Из scope.locals.isRef
        if (scope.locals.get(refName)?.isRef) return true;

        // 4.3. Эвристика по имени
        if (
            refName.endsWith('Ref') ||
            refName.endsWith('El') ||
            refName.endsWith('Element') ||
            refName.endsWith('Node')
        ) {
            return true;
        }

        // 4.4. this.*Ref/*El/*Element/*Node
        if (/^this\.[\w$]+$/.test(refName)) {
            if (/Ref|El|Element|Node/.test(refName)) return true;
        }
    }

    return false;
}
