// src/formal/ExpressionParser.ts

/**
 * Парсер выражений для Z3
 * Поддерживает:
 * - Переменные (int, bool, string)
 * - Литералы (числа, булевы значения, строки)
 * - Унарные операторы (!)
 * - Бинарные операторы (+, -, *, /, &&, ||, >, <, >=, <=, ==, !=, ===, !==, =>)
 * - Скобки для группировки
 */
export class ExpressionParser {
  private context: any;

  constructor(context: any) {
    this.context = context;
  }

  /**
   * Парсит строковое выражение в Z3 выражение
   * @param expr - Строка с выражением
   * @param vars - Map переменных (имя -> Z3 переменная)
   * @returns Z3 выражение или null в случае ошибки
   */
  parse(expr: string, vars: Map<string, any>): any {
    if (!this.context) return null;

    const trimmed = expr.trim();

    // 1. Проверяем, является ли выражение переменной
    if (vars.has(trimmed)) {
      return vars.get(trimmed);
    }

    // 2. Проверяем, является ли выражение числом
    if (!isNaN(Number(trimmed))) {
      try {
        return this.context.Int.val(Number(trimmed));
      } catch (error) {
        return null;
      }
    }

    // 3. Проверяем, является ли выражение булевым литералом
    if (trimmed === 'true') {
      try {
        return this.context.Bool.val(true);
      } catch (error) {
        return null;
      }
    }
    if (trimmed === 'false') {
      try {
        return this.context.Bool.val(false);
      } catch (error) {
        return null;
      }
    }

    // 4. Обработка унарного оператора НЕ (!)
    if (trimmed.startsWith('!') && trimmed.length > 1) {
      return this.parseUnaryNot(trimmed, vars);
    }

    // 5. Убираем внешние скобки для бинарных операций
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const inner = this.stripOuterParens(trimmed);
      if (inner !== null) {
        if (inner.trim().startsWith('!')) {
          return this.parse(trimmed, vars);
        }
        return this.parse(inner, vars);
      }
    }

    // 6. Бинарные операторы
    return this.parseBinary(trimmed, vars);
  }

  /**
   * Парсит унарный оператор НЕ (!) с поддержкой скобок
   */
  private parseUnaryNot(expr: string, vars: Map<string, any>): any {
    // Убираем начальный !
    const operand = expr.slice(1).trim();

    // Проверяем, есть ли скобки вокруг операнда
    if (operand.startsWith('(') && operand.endsWith(')')) {
      const inner = this.stripOuterParens(operand);
      if (inner !== null) {
        const innerExpr = this.parse(inner, vars);
        if (innerExpr) {
          try {
            return this.context.Not(innerExpr);
          } catch (error) {
            console.warn(`Failed to apply Not to inner expression: ${error}`);
            return null;
          }
        }
        return null;
      }
    }

    // Если операнд - переменная
    if (vars.has(operand)) {
      const varExpr = vars.get(operand);
      try {
        return this.context.Not(varExpr);
      } catch (error) {
        return null;
      }
    }

    // Если операнд - бинарное выражение без скобок
    const binaryResult = this.parseBinary(operand, vars);
    if (binaryResult) {
      return binaryResult;
    }

    return null;
  }

  /**
   * Парсит бинарные операторы с правильным приоритетом
   */
  private parseBinary(expr: string, vars: Map<string, any>): any {
    const trimmed = expr.trim();

    // Сначала проверяем логические операторы с унарными операторами
    if (trimmed.includes('!')) {
      const logicalResult = this.parseLogicalOperators(trimmed, vars);
      if (logicalResult) {
        return logicalResult;
      }
    }

    const operatorGroups = [
      { ops: ['=>'], priority: 0 },
      { ops: ['||'], priority: 1 },
      { ops: ['&&'], priority: 2 },
      { ops: ['===', '==', '!==', '!='], priority: 3 },
      { ops: ['>=', '<=', '>', '<'], priority: 4 },
      { ops: ['+', '-'], priority: 5 },
      { ops: ['*', '/'], priority: 6 },
    ];

    let foundOp: string | null = null;
    let foundPos = -1;
    let foundPriority = Infinity;

    for (const group of operatorGroups) {
      for (const op of group.ops) {
        let depth = 0;
        let pos = -1;

        for (let i = 0; i < expr.length; i++) {
          if (expr[i] === '(') depth++;
          if (expr[i] === ')') depth--;

          if (depth === 0 && expr.slice(i, i + op.length) === op) {
            const isPartOfLarger =
              (op === '=' && i + 1 < expr.length && expr[i + 1] === '=') ||
              (op === '!' && i + 1 < expr.length && expr[i + 1] === '=') ||
              (op === '>' && i + 1 < expr.length && expr[i + 1] === '=') ||
              (op === '<' && i + 1 < expr.length && expr[i + 1] === '=') ||
              (op === '&' && i + 1 < expr.length && expr[i + 1] === '&') ||
              (op === '|' && i + 1 < expr.length && expr[i + 1] === '|') ||
              (op === '*' && i + 1 < expr.length && expr[i + 1] === '*');

            if (!isPartOfLarger) {
              pos = i;
              break;
            }
          }
        }

        if (pos !== -1 && group.priority < foundPriority) {
          foundPriority = group.priority;
          foundOp = op;
          foundPos = pos;
        }
      }
    }

    if (foundOp !== null && foundPos !== -1) {
      const left = this.parse(expr.slice(0, foundPos).trim(), vars);
      const right = this.parse(expr.slice(foundPos + foundOp.length).trim(), vars);

      if (left && right) {
        return this.createBinaryOperation(foundOp, left, right);
      }
    }

    return null;
  }

  /**
   * Парсит логические операторы с учетом унарных операторов
   * Пример: !a || !b → (!a) || (!b)
   */
  private parseLogicalOperators(expr: string, vars: Map<string, any>): any | null {
    const trimmed = expr.trim();

    // Проверяем оператор ||
    if (trimmed.includes('||')) {
      const parts = this.splitByOperator(trimmed, '||');
      // ⭐ ИСПРАВЛЕНО: проверяем, что parts содержит ровно 2 элемента
      if (parts.length === 2) {
        const leftPart = parts[0];
        const rightPart = parts[1];
        if (leftPart && rightPart) {
          const left = this.parseUnaryOrBinary(leftPart.trim(), vars);
          const right = this.parseUnaryOrBinary(rightPart.trim(), vars);
          if (left && right) {
            try {
              return this.context.Or(left, right);
            } catch (error) {
              return null;
            }
          }
        }
      }
    }

    // Проверяем оператор &&
    if (trimmed.includes('&&')) {
      const parts = this.splitByOperator(trimmed, '&&');
      // ⭐ ИСПРАВЛЕНО: проверяем, что parts содержит ровно 2 элемента
      if (parts.length === 2) {
        const leftPart = parts[0];
        const rightPart = parts[1];
        if (leftPart && rightPart) {
          const left = this.parseUnaryOrBinary(leftPart.trim(), vars);
          const right = this.parseUnaryOrBinary(rightPart.trim(), vars);
          if (left && right) {
            try {
              return this.context.And(left, right);
            } catch (error) {
              return null;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Парсит выражение с возможным унарным оператором
   */
  private parseUnaryOrBinary(expr: string, vars: Map<string, any>): any {
    const trimmed = expr.trim();

    // Если выражение начинается с !, это унарный оператор
    if (trimmed.startsWith('!')) {
      return this.parseUnaryNot(trimmed, vars);
    }

    // Иначе парсим как обычное выражение
    return this.parse(trimmed, vars);
  }

  /**
   * Разбивает выражение по оператору с учетом скобок
   */
  private splitByOperator(expr: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];

      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (inString) {
        current += char;
        if (char === stringChar && expr[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '(') {
        depth++;
        current += char;
        continue;
      }

      if (char === ')') {
        depth--;
        current += char;
        continue;
      }

      // Проверяем оператор на нужной глубине
      if (depth === 0 && expr.slice(i, i + operator.length) === operator) {
        // Проверяем, что это не часть другого оператора
        if (i > 0 && expr[i - 1] === '!') {
          current += char;
          continue;
        }
        if (current.trim()) {
          parts.push(current);
        }
        current = '';
        i += operator.length - 1;
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Создает Z3 выражение для бинарной операции
   */
  private createBinaryOperation(op: string, left: any, right: any): any {
    try {
      switch (op) {
        case '=>': {
          if (typeof this.context.Implies === 'function') {
            return this.context.Implies(left, right);
          }
          const notLeft = typeof this.context.Not === 'function' ? this.context.Not(left) : null;
          if (notLeft && typeof this.context.Or === 'function') {
            return this.context.Or(notLeft, right);
          }
          return null;
        }
        case '+': {
          if (typeof this.context.Add === 'function') return this.context.Add(left, right);
          if (typeof left.add === 'function') return left.add(right);
          if (this.context.Int && typeof this.context.Int.add === 'function')
            return this.context.Int.add(left, right);
          return null;
        }
        case '-': {
          if (typeof this.context.Sub === 'function') return this.context.Sub(left, right);
          if (typeof left.sub === 'function') return left.sub(right);
          if (this.context.Int && typeof this.context.Int.sub === 'function')
            return this.context.Int.sub(left, right);
          return null;
        }
        case '*': {
          if (typeof this.context.Mul === 'function') return this.context.Mul(left, right);
          if (typeof left.mul === 'function') return left.mul(right);
          if (this.context.Int && typeof this.context.Int.mul === 'function')
            return this.context.Int.mul(left, right);
          return null;
        }
        case '/': {
          if (typeof this.context.Div === 'function') return this.context.Div(left, right);
          if (typeof left.div === 'function') return left.div(right);
          if (this.context.Int && typeof this.context.Int.div === 'function')
            return this.context.Int.div(left, right);
          return null;
        }
        case '===':
        case '==': {
          if (typeof this.context.Eq === 'function') return this.context.Eq(left, right);
          if (typeof left.eq === 'function') return left.eq(right);
          return null;
        }
        case '!==':
        case '!=': {
          const eq =
            typeof this.context.Eq === 'function'
              ? this.context.Eq(left, right)
              : typeof left.eq === 'function'
                ? left.eq(right)
                : null;
          if (eq && typeof this.context.Not === 'function') {
            return this.context.Not(eq);
          }
          return null;
        }
        case '>': {
          if (typeof this.context.GT === 'function') return this.context.GT(left, right);
          if (typeof left.gt === 'function') return left.gt(right);
          return null;
        }
        case '>=': {
          if (typeof this.context.GE === 'function') return this.context.GE(left, right);
          if (typeof left.ge === 'function') return left.ge(right);
          return null;
        }
        case '<': {
          if (typeof this.context.LT === 'function') return this.context.LT(left, right);
          if (typeof left.lt === 'function') return left.lt(right);
          return null;
        }
        case '<=': {
          if (typeof this.context.LE === 'function') return this.context.LE(left, right);
          if (typeof left.le === 'function') return left.le(right);
          return null;
        }
        case '&&': {
          if (typeof this.context.And === 'function') return this.context.And(left, right);
          if (typeof left.and === 'function') return left.and(right);
          return null;
        }
        case '||': {
          if (typeof this.context.Or === 'function') return this.context.Or(left, right);
          if (typeof left.or === 'function') return left.or(right);
          return null;
        }
        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Убирает внешние скобки, если они сбалансированы
   */
  private stripOuterParens(expr: string): string | null {
    if (!expr.startsWith('(') || !expr.endsWith(')')) return null;

    let depth = 0;
    let balanced = true;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      if (expr[i] === ')') depth--;
      if (depth === 0 && i < expr.length - 1) {
        balanced = false;
        break;
      }
    }

    if (balanced) {
      return expr.slice(1, -1);
    }
    return null;
  }

  /**
   * Проверяет, является ли выражение простым (без операторов)
   */
  isSimple(expr: string): boolean {
    const trimmed = expr.trim();
    const operators = [
      '+',
      '-',
      '*',
      '/',
      '&&',
      '||',
      '!',
      '>',
      '<',
      '>=',
      '<=',
      '==',
      '!=',
      '===',
      '!==',
    ];
    for (const op of operators) {
      if (trimmed.includes(op)) return false;
    }
    return true;
  }

  /**
   * Извлекает все переменные из выражения
   */
  extractVariables(expr: string): string[] {
    const variables: string[] = [];
    const trimmed = expr.trim();

    const matches = trimmed.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
    if (matches) {
      const reserved = ['true', 'false', 'null', 'undefined', 'typeof', 'instanceof'];
      for (const match of matches) {
        if (!reserved.includes(match)) {
          variables.push(match);
        }
      }
    }

    return [...new Set(variables)];
  }

  /**
   * Проверяет, содержит ли выражение оператор NOT
   */
  hasNotOperator(expr: string): boolean {
    return expr.trim().includes('!');
  }

  /**
   * Проверяет, содержит ли выражение булевы операторы
   */
  hasBooleanOperators(expr: string): boolean {
    const booleanOps = ['&&', '||', '!', '==', '!=', '===', '!=='];
    for (const op of booleanOps) {
      if (expr.includes(op)) return true;
    }
    return false;
  }

  /**
   * Проверяет, содержит ли выражение арифметические операторы
   */
  hasArithmeticOperators(expr: string): boolean {
    const arithOps = ['+', '-', '*', '/'];
    for (const op of arithOps) {
      if (expr.includes(op)) return true;
    }
    return false;
  }

  /**
   * Определяет тип выражения (числовое или булево)
   */
  inferExpressionType(expr: string, vars: Map<string, any>): 'int' | 'bool' | 'string' | 'unknown' {
    const trimmed = expr.trim();

    if (trimmed === 'true' || trimmed === 'false') return 'bool';
    if (!isNaN(Number(trimmed))) return 'int';
    if (trimmed.startsWith("'") || trimmed.startsWith('"')) return 'string';

    if (vars.has(trimmed)) {
      const varExpr = vars.get(trimmed);
      if (varExpr) {
        const kind = varExpr.getKind?.() || varExpr.kind;
        if (kind === 'INT' || kind === 'int' || kind === 'Int') return 'int';
        if (kind === 'BOOL' || kind === 'bool' || kind === 'Bool') return 'bool';
        if (kind === 'STRING' || kind === 'string' || kind === 'String') return 'string';
      }
      return 'int';
    }

    if (this.hasBooleanOperators(trimmed)) return 'bool';
    if (this.hasArithmeticOperators(trimmed)) return 'int';

    return 'unknown';
  }

  /**
   * Разбивает сложное выражение на части для пошаговой верификации
   */
  decompose(expr: string, vars: Map<string, any>): { parts: string[]; parsed: any[] } {
    const parts: string[] = [];
    const parsed: any[] = [];

    const trimmed = expr.trim();

    let depth = 0;
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (inString) {
        current += char;
        if (char === stringChar && trimmed[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '(') depth++;
      if (char === ')') depth--;

      if (depth === 0) {
        const remaining = trimmed.slice(i);
        const operators = ['&&', '||', '=>'];
        let found = false;

        for (const op of operators) {
          if (remaining.startsWith(op)) {
            if (current.trim()) {
              const parsedPart = this.parse(current.trim(), vars);
              if (parsedPart) {
                parts.push(current.trim());
                parsed.push(parsedPart);
              }
            }
            current = '';
            i += op.length - 1;
            found = true;
            break;
          }
        }

        if (!found) {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      const parsedPart = this.parse(current.trim(), vars);
      if (parsedPart) {
        parts.push(current.trim());
        parsed.push(parsedPart);
      }
    }

    return { parts, parsed };
  }
}

/**
 * Создает экземпляр парсера
 */
export function createExpressionParser(context: any): ExpressionParser {
  return new ExpressionParser(context);
}
