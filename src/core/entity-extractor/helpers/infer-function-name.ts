// src/core/entity-extractor/helpers/infer-function-name.ts
// ============================================
// INFERRED NAME ДЛЯ ФУНКЦИЙ (ESTree)
// ============================================
// Версия: 1.0.0
//
// Выводит имя функции из контекста AST, повторяя поведение V8
// для `const foo = () => {}` (foo.name === 'foo').
//
// Порядок проверок:
//   1. Явное имя (node.id.name)
//   2. const foo = () => {}              → 'foo'
//   3. bar = () => {} / obj.m = () => {} → 'bar' / 'm'
//   4. { onClick: () => {}, bar() {} }   → 'onClick' / 'bar'
//   5. class A { foo = () => {} }        → 'foo'
//   6. export default () => {}            → 'default'
//   7. arr.map(x => ...)                  → 'map_callback'
//   8. return () => {}                    → '<outer>_return'
//   9. Fallback: anonymous_arrow / anonymous_function
//
// ⚠️ Работает ТОЛЬКО на ESTree AST.
// ============================================

/**
 * Выводит имя функции из контекста AST.
 *
 * Повторяет поведение JS-движка (V8) для inferred name:
 *   const foo = () => {}   →  foo.name === 'foo'
 *
 * @param node   — узел функции (ArrowFunctionExpression | FunctionExpression)
 * @param parent — родительский узел (если есть)
 * @returns выведенное имя функции
 */
export function inferFunctionName(node: any, parent: any): string {
    const kind: 'arrow' | 'function' | 'unknown' =
        node?.type === 'ArrowFunctionExpression'
            ? 'arrow'
            : node?.type === 'FunctionExpression'
                ? 'function'
                : 'unknown';

    // ─────────────────────────────────────────
    // 1. Явное имя (FunctionDeclaration / FunctionExpression с id)
    // ─────────────────────────────────────────
    if (node?.id?.name) return node.id.name;

    if (!parent) {
        return kind === 'arrow' ? 'anonymous_arrow' : 'anonymous_function';
    }

    // ─────────────────────────────────────────
    // 2. const foo = () => {}
    // ─────────────────────────────────────────
    if (parent.type === 'VariableDeclarator' && parent.id?.name) {
        return parent.id.name;
    }

    // ─────────────────────────────────────────
    // 3. bar = () => {}, obj.method = () => {}
    // ─────────────────────────────────────────
    if (parent.type === 'AssignmentExpression') {
        const lhs = parent.left;
        if (lhs?.type === 'Identifier' && lhs.name) {
            return lhs.name;
        }
        if (lhs?.type === 'MemberExpression' && lhs.property) {
            if (lhs.property.type === 'Identifier' && lhs.property.name) {
                return lhs.property.name;
            }
            if (lhs.property.type === 'Literal') {
                return String(lhs.property.value);
            }
        }
    }

    // ─────────────────────────────────────────
    // 4. { onClick: () => {}, bar() {} }
    // ─────────────────────────────────────────
    if (parent.type === 'Property') {
        const key = parent.key;
        if (key?.type === 'Identifier' && key.name) {
            return key.name;
        }
        if (key?.type === 'Literal') {
            return String(key.value);
        }
    }

    // ─────────────────────────────────────────
    // 5. class A { foo = () => {} }
    // ─────────────────────────────────────────
    if (parent.type === 'PropertyDefinition') {
        const key = parent.key;
        if (key?.type === 'Identifier' && key.name) {
            return key.name;
        }
        if (key?.type === 'Literal') {
            return String(key.value);
        }
    }

    // ─────────────────────────────────────────
    // 6. export default () => {}
    // ─────────────────────────────────────────
    if (parent.type === 'ExportDefaultDeclaration') {
        return 'default';
    }

    // ─────────────────────────────────────────
    // 7. arr.map(x => ...), arr.filter(...)
    // ─────────────────────────────────────────
    if (parent.type === 'CallExpression') {
        const callee = parent.callee;
        let callName: string | null = null;

        if (callee?.type === 'Identifier' && callee.name) {
            callName = callee.name;
        } else if (
            callee?.type === 'MemberExpression' &&
            callee.property?.type === 'Identifier'
        ) {
            callName = callee.property.name;
        }

        if (callName) {
            return `${callName}_callback`;
        }
    }

    // ─────────────────────────────────────────
    // 8. return () => {}
    // ─────────────────────────────────────────
    if (parent.type === 'ReturnStatement') {
        const outer = findEnclosingFunctionName(node);
        if (outer) {
            return `${outer}_return`;
        }
    }

    // ─────────────────────────────────────────
    // 9. Fallback
    // ─────────────────────────────────────────
    return kind === 'arrow' ? 'anonymous_arrow' : 'anonymous_function';
}

/**
 * Находит имя ближайшей внешней функции.
 *
 * Используется для вывода имени у `return () => {}`:
 *   const foo = () => { return () => {}; };
 *   → внутренняя стрелка получает имя 'foo_return'
 *
 * @param node — узел внутренней функции
 * @returns имя внешней функции или null
 */
function findEnclosingFunctionName(node: any): string | null {
    let cur = node?.parent;
    let depth = 0;

    while (cur && depth < 100) {
        // Обычные функции и именованные FunctionExpression
        if (
            (cur.type === 'FunctionDeclaration' || cur.type === 'FunctionExpression') &&
            cur.id?.name
        ) {
            return cur.id.name;
        }

        // Методы классов
        if (cur.type === 'MethodDefinition' && cur.key?.name) {
            return cur.key.name;
        }

        // Стрелка/функция в переменной: const foo = () => ...
        if (cur.type === 'VariableDeclarator' && cur.id?.name) {
            const init = cur.init;
            if (
                init?.type === 'ArrowFunctionExpression' ||
                init?.type === 'FunctionExpression'
            ) {
                return cur.id.name;
            }
        }

        cur = cur.parent;
        depth++;
    }

    return null;
}

export default { inferFunctionName };
