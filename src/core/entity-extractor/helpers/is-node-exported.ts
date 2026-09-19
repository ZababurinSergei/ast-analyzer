// packages/ast-analyzer/src/core/entity-extractor/helpers/is-node-exported.ts

/**
 * Проверяет, экспортируется ли узел
 */
export function isNodeExported(node: any, parent: any): boolean {
    if (!node) return false;

    if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
        return true;
    }

    if (parent) {
        if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
            return true;
        }
        if (parent.type === 'VariableDeclaration' && isNodeExported(parent, parent.parent)) {
            return true;
        }
    }

    if (node.leadingComments) {
        for (const comment of node.leadingComments) {
            if (comment.value && comment.value.includes('@export')) {
                return true;
            }
        }
    }

    if (node.decorators) {
        for (const decorator of node.decorators) {
            if (
                decorator.expression?.name === 'export' ||
                decorator.expression?.callee?.name === 'export'
            ) {
                return true;
            }
        }
    }

    return false;
}
