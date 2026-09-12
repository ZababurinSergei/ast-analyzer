// packages/ast-analyzer/src/core/entity-extractor/helpers/extract-event-type.ts

/**
 * Извлекает тип события из узла
 */
export function extractEventType(node: any): string | undefined {
    if (!node) return undefined;

    if (node.type === 'CallExpression' && node.callee) {
        if (node.arguments && node.arguments.length > 0) {
            const firstArg = node.arguments[0];
            if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
                return firstArg.value;
            }
            if (firstArg && firstArg.type === 'Identifier') {
                return firstArg.name;
            }
        }
    }

    if (node.type === 'JSXAttribute' && node.name) {
        const attrName = node.name.name || node.name.value;
        if (typeof attrName === 'string' && attrName.startsWith('on')) {
            return attrName.slice(2).toLowerCase();
        }
    }

    return undefined;
}
