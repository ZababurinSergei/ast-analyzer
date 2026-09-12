// packages/ast-analyzer/src/core/entity-extractor/helpers/calculate-complexity.ts

/**
 * Вычисляет цикломатическую сложность
 */
export function calculateComplexity(node: any): number {
    let complexity = 1;

    function traverse(n: any) {
        if (!n) return;

        if (
            n.type === 'IfStatement' ||
            n.type === 'ConditionalExpression' ||
            n.type === 'SwitchStatement'
        ) {
            complexity++;
        }

        if (
            n.type === 'ForStatement' ||
            n.type === 'ForInStatement' ||
            n.type === 'ForOfStatement' ||
            n.type === 'WhileStatement' ||
            n.type === 'DoWhileStatement'
        ) {
            complexity++;
        }

        if (n.type === 'LogicalExpression' && (n.operator === '&&' || n.operator === '||')) {
            complexity++;
        }

        if (n.type === 'CatchClause') {
            complexity++;
        }

        for (const key of Object.keys(n)) {
            const child = n[key];
            if (child && typeof child === 'object') {
                if (Array.isArray(child)) {
                    for (const item of child) {
                        traverse(item);
                    }
                } else {
                    traverse(child);
                }
            }
        }
    }

    traverse(node);
    return complexity;
}
