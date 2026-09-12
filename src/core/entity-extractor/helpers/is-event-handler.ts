// packages/ast-analyzer/src/core/entity-extractor/helpers/is-event-handler.ts

/**
 * Проверяет, является ли узел обработчиком события
 */
export function isEventHandler(node: any): boolean {
    if (!node) return false;

    if (node.type === 'CallExpression' && node.callee) {
        const callee = node.callee;
        if (callee.type === 'Identifier') {
            const name = callee.name;
            if (
                ['addEventListener', 'on', 'once', 'emit', 'dispatchEvent', 'addListener'].includes(name)
            ) {
                return true;
            }
        }
        if (callee.type === 'MemberExpression' && callee.property) {
            const propName = callee.property.name || callee.property.value;
            if (
                ['addEventListener', 'on', 'once', 'emit', 'dispatchEvent', 'addListener'].includes(
                    propName
                )
            ) {
                return true;
            }
        }
    }

    if (node.type === 'JSXAttribute' && node.name) {
        const attrName = node.name.name || node.name.value;
        if (typeof attrName === 'string' && attrName.startsWith('on')) {
            return true;
        }
    }

    return false;
}
