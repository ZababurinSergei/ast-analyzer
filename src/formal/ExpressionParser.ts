// src/formal/ExpressionParser.ts

/**
 * Единый парсер выражений для Z3
 * Поддерживает:
 * - Переменные (int, bool, string)
 * - Литералы (числа, булевы значения, строки)
 * - Унарные операторы (!, -)
 * - Бинарные операторы (+, -, *, /, &&, ||, >, <, >=, <=, ==, !=, ===, !==, =>)
 * - Скобки для группировки
 * - Приоритет операторов
 * - Декораторы
 * - JSX
 * - Vue
 * - TypeScript типы
 * - Формальная верификация
 * - Инварианты циклов
 * - Свойства массивов
 * - Условные выражения (if-then-else)
 */
export class ExpressionParser {
  private context: any;
  private debug: boolean;

  constructor(context: any, debug = false) {
    this.context = context;
    this.debug = debug;
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

    if (this.debug) {
      console.log(`[ExpressionParser] Parsing: "${trimmed}"`);
    }

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

    // 5. Обработка унарного оператора минус (-)
    if (trimmed.startsWith('-') && trimmed.length > 1 && !isNaN(Number(trimmed.slice(1)))) {
      try {
        const value = -Number(trimmed.slice(1));
        return this.context.Int.val(value);
      } catch (error) {
        return null;
      }
    }

    // 6. Убираем внешние скобки для бинарных операций
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const inner = this.stripOuterParens(trimmed);
      if (inner !== null) {
        if (inner.trim().startsWith('!') || inner.trim().startsWith('-')) {
          return this.parse(trimmed, vars);
        }
        return this.parse(inner, vars);
      }
    }

    // 7. Бинарные операторы с учетом приоритета
    return this.parseBinary(trimmed, vars);
  }

  /**
   * Парсит унарный оператор НЕ (!)
   */
  private parseUnaryNot(expr: string, vars: Map<string, any>): any {
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
            if (this.debug) {
              console.warn(`Failed to apply Not to inner expression: ${error}`);
            }
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

    // Операторы в порядке убывания приоритета
    const operatorGroups = [
      { ops: ['=>'], priority: 0, type: 'logical' },
      { ops: ['||'], priority: 1, type: 'logical' },
      { ops: ['&&'], priority: 2, type: 'logical' },
      { ops: ['===', '==', '!==', '!='], priority: 3, type: 'comparison' },
      { ops: ['>=', '<=', '>', '<'], priority: 4, type: 'comparison' },
      { ops: ['+', '-'], priority: 5, type: 'arithmetic' },
      { ops: ['*', '/'], priority: 6, type: 'arithmetic' },
      { ops: ['%'], priority: 7, type: 'arithmetic' },
    ];

    let foundOp: string | null = null;
    let foundPos = -1;
    let foundPriority = Infinity;
    let foundType = '';

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
              // Проверяем, что это не часть унарного оператора
              if (i > 0 && expr[i - 1] === '!') {
                continue;
              }
              pos = i;
              break;
            }
          }
        }

        if (pos !== -1 && group.priority < foundPriority) {
          foundPriority = group.priority;
          foundOp = op;
          foundPos = pos;
          foundType = group.type;
        }
      }
    }

    if (foundOp !== null && foundPos !== -1) {
      const left = this.parse(expr.slice(0, foundPos).trim(), vars);
      const right = this.parse(expr.slice(foundPos + foundOp.length).trim(), vars);

      if (left && right) {
        return this.createBinaryOperation(foundOp, left, right, foundType);
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

    // Проверяем оператор => (импликация)
    if (trimmed.includes('=>')) {
      const parts = this.splitByOperator(trimmed, '=>');
      if (parts.length === 2) {
        const leftPart = parts[0];
        const rightPart = parts[1];
        if (leftPart && rightPart) {
          const left = this.parseUnaryOrBinary(leftPart.trim(), vars);
          const right = this.parseUnaryOrBinary(rightPart.trim(), vars);
          if (left && right) {
            try {
              return this.context.Implies(left, right);
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

    // Если выражение начинается с -, это унарный минус
    if (trimmed.startsWith('-') && trimmed.length > 1 && !isNaN(Number(trimmed.slice(1)))) {
      try {
        const value = -Number(trimmed.slice(1));
        return this.context.Int.val(value);
      } catch (error) {
        return null;
      }
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
  private createBinaryOperation(op: string, left: any, right: any, type: string): any {
    try {
      // Логические операции
      if (type === 'logical') {
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
          case '||': {
            if (typeof this.context.Or === 'function') return this.context.Or(left, right);
            if (typeof left.or === 'function') return left.or(right);
            return null;
          }
          case '&&': {
            if (typeof this.context.And === 'function') return this.context.And(left, right);
            if (typeof left.and === 'function') return left.and(right);
            return null;
          }
        }
      }

      // Сравнения
      if (type === 'comparison') {
        switch (op) {
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
        }
      }

      // Арифметика
      if (type === 'arithmetic') {
        switch (op) {
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
          case '%': {
            if (typeof this.context.Mod === 'function') return this.context.Mod(left, right);
            if (typeof left.mod === 'function') return left.mod(right);
            if (this.context.Int && typeof this.context.Int.mod === 'function')
              return this.context.Int.mod(left, right);
            return null;
          }
        }
      }

      return null;
    } catch (error) {
      if (this.debug) {
        console.warn(`Failed to create operation ${op}:`, error);
      }
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
      '%',
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
    const booleanOps = ['&&', '||', '!', '==', '!=', '===', '!==', '=>'];
    for (const op of booleanOps) {
      if (expr.includes(op)) return true;
    }
    return false;
  }

  /**
   * Проверяет, содержит ли выражение арифметические операторы
   */
  hasArithmeticOperators(expr: string): boolean {
    const arithOps = ['+', '-', '*', '/', '%'];
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

  /**
   * Парсит выражение с учетом TypeScript типов
   */
  parseWithTypes(expr: string, vars: Map<string, any>, types: Map<string, string>): any {
    // Проверяем типы переменных перед парсингом
    for (const [name, type] of types) {
      if (vars.has(name)) continue;
      if (type === 'int') {
        vars.set(name, this.context.Int.const(name));
      } else if (type === 'bool') {
        vars.set(name, this.context.Bool.const(name));
      } else if (type === 'string') {
        vars.set(name, this.context.String.const(name));
      }
    }
    return this.parse(expr, vars);
  }

  /**
   * Парсит условное выражение (if-then-else)
   */
  parseConditional(
    condition: string,
    thenExpr: string,
    elseExpr: string,
    vars: Map<string, any>
  ): any {
    const cond = this.parse(condition, vars);
    const thenBr = this.parse(thenExpr, vars);
    const elseBr = this.parse(elseExpr, vars);

    if (cond && thenBr && elseBr) {
      try {
        return this.context.If(cond, thenBr, elseBr);
      } catch (error) {
        if (this.debug) {
          console.warn('Failed to parse conditional:', error);
        }
        return null;
      }
    }
    return null;
  }

  /**
   * Парсит инвариант цикла
   */
  parseLoopInvariant(
    invariant: string,
    condition: string,
    body: string[],
    vars: Map<string, any>
  ): any {
    const invExpr = this.parse(invariant, vars);
    const condExpr = this.parse(condition, vars);

    if (!invExpr || !condExpr) return null;

    // Вычисляем weakest precondition для тела цикла
    let wp = invExpr;
    for (const stmt of [...body].reverse()) {
      const stmtExpr = this.parse(stmt, vars);
      if (stmtExpr) {
        wp = this.context.Implies(stmtExpr, wp);
      }
    }

    // Проверяем: invariant && condition => wp
    try {
      return this.context.Implies(this.context.And(invExpr, condExpr), wp);
    } catch (error) {
      if (this.debug) {
        console.warn('Failed to parse loop invariant:', error);
      }
      return null;
    }
  }

  /**
   * Парсит свойство массива
   */
  parseArrayProperty(
    arrayName: string,
    property: string,
    index: string,
    vars: Map<string, any>
  ): any {
    const arrayVar = vars.get(arrayName);
    if (!arrayVar) return null;

    const idxVar = vars.get(index) || this.context.Int.const(index);
    const element = this.context.Select(arrayVar, idxVar);
    const propExpr = this.parse(property, new Map([...vars, [index, idxVar]]));

    if (propExpr) {
      try {
        return this.context.Eq(element, propExpr);
      } catch (error) {
        if (this.debug) {
          console.warn('Failed to parse array property:', error);
        }
        return null;
      }
    }
    return null;
  }

  /**
   * Валидирует выражение (проверяет, может ли оно быть распарсено)
   */
  validate(expr: string): boolean {
    try {
      const result = this.parse(expr, new Map());
      return result !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получить все подвыражения из выражения
   */
  getSubExpressions(expr: string): string[] {
    const subExprs: string[] = [];
    let depth = 0;
    let current = '';
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
        if (depth === 0 && current.trim()) {
          subExprs.push(current.trim());
          current = '';
        }
        depth++;
        current += char;
        continue;
      }

      if (char === ')') {
        depth--;
        current += char;
        if (depth === 0 && current.trim()) {
          subExprs.push(current.trim());
          current = '';
        }
        continue;
      }

      if (depth === 0) {
        const remaining = expr.slice(i);
        const operators = [
          '&&',
          '||',
          '=>',
          '==',
          '!=',
          '===',
          '!==',
          '>=',
          '<=',
          '>',
          '<',
          '+',
          '-',
          '*',
          '/',
          '%',
        ];
        let found = false;

        for (const op of operators) {
          if (remaining.startsWith(op)) {
            if (current.trim()) {
              subExprs.push(current.trim());
              current = '';
            }
            subExprs.push(op);
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
      subExprs.push(current.trim());
    }

    return subExprs;
  }

  /**
   * Проверяет, является ли выражение валидным для Z3
   */
  isValidForZ3(expr: string, vars: Map<string, any>): boolean {
    try {
      const result = this.parse(expr, vars);
      return result !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Преобразует выражение в строку Z3
   */
  toZ3String(expr: string, vars: Map<string, any>): string | null {
    try {
      const result = this.parse(expr, vars);
      if (result) {
        return result.toString();
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Создает экземпляр парсера
 */
export function createExpressionParser(context: any, debug = false): ExpressionParser {
  return new ExpressionParser(context, debug);
}

/**
 * Быстрый парсинг выражения
 */
export function parseExpression(expr: string, vars: Map<string, any>, context: any): any {
  const parser = new ExpressionParser(context);
  return parser.parse(expr, vars);
}

/**
 * Валидация выражения
 */
export function validateExpression(expr: string, context: any): boolean {
  const parser = new ExpressionParser(context);
  return parser.validate(expr);
}

/**
 * Извлечение переменных из выражения
 */
export function extractVariables(expr: string): string[] {
  const parser = new ExpressionParser(null as any);
  return parser.extractVariables(expr);
}

/**
 * Проверка выражения для Z3
 */
export function isValidForZ3(expr: string, vars: Map<string, any>, context: any): boolean {
  const parser = new ExpressionParser(context);
  return parser.isValidForZ3(expr, vars);
}

/**
 * Преобразование в строку Z3
 */
export function toZ3String(expr: string, vars: Map<string, any>, context: any): string | null {
  const parser = new ExpressionParser(context);
  return parser.toZ3String(expr, vars);
}


/**
 * Парсит тело функции в Z3 выражение
 * @param body - тело функции в виде строки
 * @param params - параметры функции
 * @param context - Z3 контекст
 * @returns Z3 выражение или null
 */
export function parseFunctionBody(
  body: string,
  params: { name: string; type: 'int' | 'bool' | 'string' }[],
  context: any
): any {
  try {
    const vars = new Map<string, any>();
    for (const param of params) {
      if (param.type === 'int') {
        vars.set(param.name, context.Int.const(param.name));
      } else if (param.type === 'bool') {
        vars.set(param.name, context.Bool.const(param.name));
      } else if (param.type === 'string') {
        vars.set(param.name, context.String.const(param.name));
      }
    }

    const parser = new ExpressionParser(context);
    return parser.parse(body, vars);
  } catch (error) {
    return null;
  }
}

/**
 * Создает Z3 переменные для параметров функции
 * @param params - параметры функции
 * @param context - Z3 контекст
 * @returns Map переменных
 */
export function createFunctionVariables(
  params: { name: string; type: 'int' | 'bool' | 'string' }[],
  context: any
): Map<string, any> {
  const vars = new Map<string, any>();
  for (const param of params) {
    if (param.type === 'int') {
      vars.set(param.name, context.Int.const(param.name));
    } else if (param.type === 'bool') {
      vars.set(param.name, context.Bool.const(param.name));
    } else if (param.type === 'string') {
      vars.set(param.name, context.String.const(param.name));
    }
  }
  return vars;
}

/**
 * Верифицирует функцию с телом через Z3
 * @param body - тело функции
 * @param params - параметры функции
 * @param returnType - тип возврата
 * @param contract - контракт функции
 * @param context - Z3 контекст
 * @param solver - Z3 solver
 * @returns Результат верификации
 */
export async function verifyFunctionWithBody(
  body: string,
  params: { name: string; type: 'int' | 'bool' | 'string' }[],
  returnType: 'int' | 'bool' | 'string' | 'void',
  contract: any,
  context: any,
  solver: any
): Promise<{ isValid: boolean; counterexample?: Map<string, any>; error?: string; time: number }> {
  const startTime = Date.now();

  try {
    const vars = new Map<string, any>();
    for (const param of params) {
      if (param.type === 'int') {
        vars.set(param.name, context.Int.const(param.name));
      } else if (param.type === 'bool') {
        vars.set(param.name, context.Bool.const(param.name));
      } else if (param.type === 'string') {
        vars.set(param.name, context.String.const(param.name));
      }
    }

    // Создаем переменную для результата
    let resultVar = null;
    if (returnType !== 'void') {
      if (returnType === 'int') {
        resultVar = context.Int.const('result');
      } else if (returnType === 'bool') {
        resultVar = context.Bool.const('result');
      } else if (returnType === 'string') {
        resultVar = context.String.const('result');
      }
    }

    const parser = new ExpressionParser(context);
    const bodyExpr = parser.parse(body, vars);

    if (bodyExpr && resultVar) {
      solver.add(context.Eq(resultVar, bodyExpr));
    }

    // Добавляем предусловия
    if (contract.preconditions) {
      for (const pre of contract.preconditions) {
        const constraint = parser.parse(pre, vars);
        if (constraint) {
          solver.add(constraint);
        }
      }
    }

    // Добавляем постусловия
    if (contract.postconditions) {
      for (const post of contract.postconditions) {
        const constraint = parser.parse(post, vars);
        if (constraint) {
          solver.add(constraint);
        }
      }
    }

    const result = await solver.check();

    if (result === 'unsat') {
      return { isValid: true, time: Date.now() - startTime };
    } else if (result === 'sat') {
      const model = solver.model();
      const counterexample = new Map<string, any>();
      for (const [name, varExpr] of vars) {
        try {
          const value = model.eval(varExpr);
          if (value) {
            counterexample.set(name, value.toString());
          }
        } catch (e) {
          // Игнорируем
        }
      }
      return {
        isValid: false,
        counterexample,
        time: Date.now() - startTime,
      };
    } else {
      return {
        isValid: false,
        error: 'Z3 returned unknown',
        time: Date.now() - startTime,
      };
    }
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || String(error),
      time: Date.now() - startTime,
    };
  }
}

/**
 * Создает контракт из выражения
 * @param name - имя функции
 * @param expression - выражение
 * @param params - параметры
 * @param returnType - тип возврата
 * @returns Контракт функции
 */
export function createContractFromExpression(
  name: string,
  expression: string,
  params: { name: string; type: 'int' | 'bool' | 'string' }[],
  returnType: 'int' | 'bool' | 'string' | 'void'
): any {
  return {
    name,
    params,
    returnType,
    preconditions: [],
    postconditions: [],
    invariants: [],
    body: expression,
  };
}

/**
 * Создает контракт с автоматическими предусловиями
 * @param name - имя функции
 * @param expression - выражение
 * @param params - параметры
 * @param returnType - тип возврата
 * @param autoPreconditions - автоматические предусловия (диапазоны)
 * @returns Контракт функции
 */
export function createContractWithAutoPreconditions(
  name: string,
  expression: string,
  params: { name: string; type: 'int' | 'bool' | 'string' }[],
  returnType: 'int' | 'bool' | 'string' | 'void',
  autoPreconditions: { variable: string; min: number; max: number }[] = []
): any {
  const preconditions = autoPreconditions.map(p => ({
    type: 'range',
    variable: p.variable,
    min: p.min,
    max: p.max,
  }));

  const postconditions: any[] = [];
  if (returnType === 'int') {
    postconditions.push({
      type: 'range',
      variable: 'result',
      min: -Number.MAX_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER,
    });
  } else if (returnType === 'bool') {
    postconditions.push({
      type: 'or',
      constraints: [
        { type: 'equality', left: 'result', right: true },
        { type: 'equality', left: 'result', right: false },
      ],
    });
  }

  return {
    name,
    params,
    returnType,
    preconditions,
    postconditions,
    invariants: [],
    body: expression,
  };
}

/**
 * Проверяет, может ли выражение быть распарсено
 * @param expr - выражение
 * @param context - Z3 контекст
 * @returns true если выражение валидно
 */
export function canParseExpression(expr: string, context: any): boolean {
  const parser = new ExpressionParser(context);
  return parser.validate(expr);
}

/**
 * Проверяет, является ли выражение простым (без операторов)
 * @param expr - выражение
 * @param context - Z3 контекст
 * @returns true если выражение простое
 */
export function isSimpleExpression(expr: string, context: any): boolean {
  const parser = new ExpressionParser(context);
  return parser.isSimple(expr);
}

/**
 * Извлекает все переменные из выражения
 * @param expr - выражение
 * @returns Массив имен переменных
 */
export function extractVariablesFromExpression(expr: string): string[] {
  const parser = new ExpressionParser(null as any);
  return parser.extractVariables(expr);
}

export default ExpressionParser;
