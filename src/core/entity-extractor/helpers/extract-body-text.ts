// packages/ast-analyzer/src/core/entity-extractor/helpers/extract-body-text.ts

/**
 * Извлекает текст тела функции
 */
export function extractBodyText(body: any): string | undefined {
    if (!body) return undefined;

    if (body.type === 'BlockStatement') {
        const statements = body.body || [];
        if (statements.length === 0) return '{}';

        const firstStatement = statements[0];
        if (firstStatement && firstStatement.type === 'ReturnStatement') {
            if (firstStatement.argument) {
                const argType = firstStatement.argument.type;
                if (argType === 'Identifier') return `return ${firstStatement.argument.name}`;
                if (argType === 'Literal') return `return ${firstStatement.argument.value}`;
                return 'return ...';
            }
            return 'return';
        }

        return `{ ${statements.length} statements }`;
    }

    if (body.type === 'Identifier') {
        return body.name;
    }

    if (body.type === 'Literal') {
        return String(body.value);
    }

    if (body.type === 'BinaryExpression') {
        return `${extractBodyText(body.left)} ${body.operator} ${extractBodyText(body.right)}`;
    }

    return body.type || undefined;
}
