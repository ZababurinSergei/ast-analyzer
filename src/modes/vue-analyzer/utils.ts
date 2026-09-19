// packages/ast-analyzer/src/modes/vue-analyzer/utils.ts
// ОБНОВЛЕННЫЙ ФАЙЛ - Удалены неиспользуемые функции
// Оставлены только: getNodeValue, safeString

/**
 * Получение значения из узла AST
 */
export function getNodeValue(node: any): any {
  if (!node) return undefined;

  if (node.type === 'Literal') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'StringLiteral') {
    return node.value;
  }
  if (node.type === 'NumericLiteral') {
    return node.value;
  }
  if (node.type === 'BooleanLiteral') {
    return node.value;
  }
  if (node.type === 'NullLiteral') {
    return null;
  }
  if (node.type === 'RegExpLiteral') {
    return node.value;
  }
  if (node.type === 'BigIntLiteral') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral') {
    return node.quasis?.map((q: any) => q.value?.raw || '').join('');
  }

  if (node.type === 'UnaryExpression' && node.operator === '-') {
    const arg = getNodeValue(node.argument);
    if (typeof arg === 'number') return -arg;
    return undefined;
  }

  if (node.type === 'ObjectExpression') {
    const result: Record<string, any> = {};
    if (node.properties) {
      for (const prop of node.properties) {
        if (prop.type === 'Property' && prop.key) {
          const key = prop.key.name || prop.key.value;
          if (key !== undefined) {
            result[key] = getNodeValue(prop.value);
          }
        }
      }
    }
    return result;
  }

  if (node.type === 'ArrayExpression') {
    const result: any[] = [];
    if (node.elements) {
      for (const elem of node.elements) {
        result.push(getNodeValue(elem));
      }
    }
    return result;
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return 'function';
  }

  return undefined;
}

/**
 * Безопасное преобразование в строку
 */
export function safeString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  getNodeValue,
  safeString,
};
