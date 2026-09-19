// packages/ast-analyzer/src/core/entity-extractor/ast/find-function-node.ts

/**
 * Находит узел функции в AST по имени
 */
export function findFunctionNode(ast: any, name: string): { node: any; found: boolean } {
    let funcNode: any = null;
    let found = false;

    function search(node: any) {
        if (found) return;
        if (!node || typeof node !== 'object') return;

        if (node.type === 'FunctionDeclaration' && node.id?.name === name) {
            funcNode = node;
            found = true;
            return;
        }

        if (node.type === 'FunctionExpression' && node.id?.name === name) {
            funcNode = node;
            found = true;
            return;
        }

        if (node.type === 'VariableDeclarator' && node.id?.name === name) {
            if (
                node.init &&
                (node.init.type === 'ArrowFunctionExpression' ||
                    node.init.type === 'FunctionExpression')
            ) {
                funcNode = node.init;
                found = true;
                return;
            }
        }

        if (node.type === 'MethodDefinition' && node.key?.name === name) {
            funcNode = node.value;
            found = true;
            return;
        }

        for (const key of Object.keys(node)) {
            const child = node[key];
            if (child && typeof child === 'object') {
                if (Array.isArray(child)) {
                    for (const item of child) {
                        if (item && typeof item === 'object') {
                            search(item);
                        }
                    }
                } else {
                    search(child);
                }
            }
        }
    }

    search(ast);
    return { node: funcNode, found };
}
