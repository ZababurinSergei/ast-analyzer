// packages/ast-analyzer/src/core/entity-extractor/ast/collect-all-calls-recursive.ts

/**
 * Рекурсивно собирает все вызовы из узла AST
 */
export function collectAllCallsRecursive(node: any, visited: Set<any>): string[] {
    if (!node || visited.has(node)) return [];
    visited.add(node);

    const calls: string[] = [];

    if (node.type === 'CallExpression' && node.callee) {
        if (node.callee.type === 'Identifier') {
            calls.push(node.callee.name);
        } else if (node.callee.type === 'MemberExpression' && node.callee.property) {
            if (node.callee.property.type === 'Identifier') {
                calls.push(node.callee.property.name);
            }
        }
    }

    if (node.type === 'NewExpression' && node.callee) {
        if (node.callee.type === 'Identifier') {
            calls.push(node.callee.name);
        }
    }

    for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && typeof item === 'object') {
                        calls.push(...collectAllCallsRecursive(item, visited));
                    }
                }
            } else {
                calls.push(...collectAllCallsRecursive(child, visited));
            }
        }
    }

    return calls;
}
