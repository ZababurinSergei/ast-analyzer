// packages/ast-analyzer/src/core/entity-extractor/extract-call-graph.ts
import { walk } from 'estree-walker';

/**
 * Извлекает граф вызовов из AST
 */
export function extractCallGraph(ast: any): Record<string, string[]> {
    const callGraph: Record<string, string[]> = {};
    let currentFunction: string | null = null;

    try {
        walk(ast, {
            enter(node: any) {
                if (!node || typeof node !== 'object') return;

                if (node.type === 'FunctionDeclaration' && node.id) {
                    currentFunction = node.id.name;
                    if (currentFunction && !callGraph[currentFunction]) {
                        callGraph[currentFunction] = [];
                    }
                }

                if (node.type === 'CallExpression' && node.callee && currentFunction) {
                    let calleeName: string | null = null;
                    if (node.callee.type === 'Identifier') {
                        calleeName = node.callee.name;
                    } else if (node.callee.type === 'MemberExpression' && node.callee.property) {
                        calleeName = node.callee.property.name;
                    }

                    if (calleeName && currentFunction) {
                        const funcKey = currentFunction;
                        if (!callGraph[funcKey]) {
                            callGraph[funcKey] = [];
                        }
                        const funcCalls = callGraph[funcKey];
                        if (funcCalls && !funcCalls.includes(calleeName)) {
                            funcCalls.push(calleeName);
                        }
                    }
                }
            },
            leave(node: any) {
                if (node.type === 'FunctionDeclaration' && node.id) {
                    currentFunction = null;
                }
            },
        });
    } catch (error) {
        console.warn('⚠️ Ошибка при извлечении графа вызовов:', error);
    }

    return callGraph;
}
