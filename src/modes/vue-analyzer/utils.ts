// src/modes/vue-analyzer/utils.ts

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
 * Безопасное получение значения из объекта с проверкой на undefined
 */
export function safeGet<T>(obj: any, path: string, defaultValue?: T): T | undefined {
  if (!obj) return defaultValue;

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Проверка, является ли значение строкой
 */
export function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * Проверка, является ли значение массивом
 */
export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

/**
 * Проверка, является ли значение объектом
 */
export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Безопасное преобразование в строку
 */
export function safeString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (isObject(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Безопасное преобразование в число
 */
export function safeNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return defaultValue;
}

/**
 * Безопасное преобразование в boolean
 */
export function safeBoolean(value: any, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return defaultValue;
  }
  if (typeof value === 'number') return value !== 0;
  return defaultValue;
}

/**
 * Извлечение имени из узла AST
 */
export function getNodeName(node: any): string | undefined {
  if (!node) return undefined;

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'Literal') {
    return String(node.value);
  }

  if (node.type === 'Property' && node.key) {
    return getNodeName(node.key);
  }

  if (node.type === 'MemberExpression' && node.property) {
    return getNodeName(node.property);
  }

  return undefined;
}

/**
 * Извлечение строки из узла AST
 */
export function getNodeStringValue(node: any): string | undefined {
  if (!node) return undefined;

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'TemplateLiteral' && node.quasis) {
    return node.quasis.map((q: any) => q.value?.raw || '').join('');
  }

  return undefined;
}

/**
 * Проверка, является ли узел экспортом
 */
export function isExportedNode(node: any): boolean {
  if (!node) return false;

  // Проверка прямых экспортов
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

  // Проверка родительских узлов
  let current = node.parent;
  while (current) {
    if (current.type === 'ExportNamedDeclaration' || current.type === 'ExportDefaultDeclaration') {
      return true;
    }
    current = current.parent;
  }

  // Проверка декораторов и комментариев
  if (node.decorators) {
    for (const decorator of node.decorators) {
      if (decorator.expression?.name === 'export') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Получение позиции узла в коде
 */
export function getNodeLocation(node: any): { line: number; column: number } | undefined {
  if (!node || !node.loc) return undefined;

  return {
    line: node.loc.start?.line || 0,
    column: node.loc.start?.column || 0,
  };
}

/**
 * Получение диапазона узла
 */
export function getNodeRange(node: any): [number, number] | undefined {
  if (!node || !node.range) return undefined;

  return [node.range[0] || 0, node.range[1] || 0];
}

/**
 * Проверка, является ли узел асинхронным
 */
export function isAsyncNode(node: any): boolean {
  if (!node) return false;

  if (node.async === true) return true;

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return node.async === true;
  }

  if (node.type === 'MethodDefinition' && node.value) {
    return node.value.async === true;
  }

  return false;
}

/**
 * Проверка, является ли узел генератором
 */
export function isGeneratorNode(node: any): boolean {
  if (!node) return false;

  if (node.generator === true) return true;

  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
    return node.generator === true;
  }

  return false;
}

/**
 * Извлечение параметров из узла функции
 */
export function getFunctionParams(node: any): string[] {
  if (!node) return [];

  const params: string[] = [];

  if (node.params && Array.isArray(node.params)) {
    for (const param of node.params) {
      if (param.type === 'Identifier') {
        params.push(param.name);
      } else if (param.type === 'AssignmentPattern' && param.left) {
        params.push(param.left.name);
      } else if (param.type === 'RestElement' && param.argument) {
        params.push(`...${param.argument.name}`);
      } else if (param.type === 'ObjectPattern') {
        if (param.properties) {
          for (const prop of param.properties) {
            if (prop.type === 'Property' && prop.key) {
              params.push(prop.key.name);
            }
          }
        }
      } else if (param.type === 'ArrayPattern') {
        if (param.elements) {
          for (const elem of param.elements) {
            if (elem && elem.type === 'Identifier') {
              params.push(elem.name);
            }
          }
        }
      }
    }
  }

  return params;
}

/**
 * Получение тела функции
 */
export function getFunctionBody(node: any): string | undefined {
  if (!node) return undefined;

  if (node.body) {
    if (node.body.type === 'BlockStatement') {
      return node.body.body?.map((stmt: any) => stmt.type).join('; ') || '';
    }
    return node.body.type;
  }

  return undefined;
}

/**
 * Проверка, является ли узел Vue макросом
 */
export function isVueMacro(node: any): boolean {
  if (!node) return false;

  const macroNames = ['defineProps', 'defineEmits', 'defineExpose', 'withDefaults'];

  if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
    return macroNames.includes(node.callee.name);
  }

  return false;
}