// packages/ast-analyzer/src/core/entity-extractor/helpers/extract-value.ts

/**
 * Извлекает значение из узла
 */
export function extractValue(node: any): any {
    if (!node) return undefined;

    if (node.type === 'Literal') {
        return node.value;
    }

    if (node.type === 'Identifier') {
        return node.name;
    }

    if (node.type === 'UnaryExpression') {
        return `${node.operator}${extractValue(node.argument)}`;
    }

    if (node.type === 'BinaryExpression') {
        return `${extractValue(node.left)} ${node.operator} ${extractValue(node.right)}`;
    }

    if (node.type === 'ArrayExpression') {
        if (Array.isArray(node.elements)) {
            return node.elements.map((e: any) => extractValue(e)).filter((v: any) => v !== undefined);
        }
        return [];
    }

    if (node.type === 'ObjectExpression') {
        const obj: Record<string, any> = {};
        if (Array.isArray(node.properties)) {
            for (const prop of node.properties) {
                if (prop.type === 'Property' && prop.key) {
                    const key = prop.key.name || prop.key.value;
                    if (key !== undefined) {
                        obj[key] = extractValue(prop.value);
                    }
                }
            }
        }
        return obj;
    }

    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
        return '[Function]';
    }

    if (node.type === 'TemplateLiteral') {
        if (Array.isArray(node.quasis)) {
            return node.quasis.map((q: any) => q.value?.raw || '').join('');
        }
        return '';
    }

    if (node.type === 'NewExpression') {
        return `new ${node.callee?.name || '...'}()`;
    }

    return undefined;
}
