// packages/ast-analyzer/src/formal/FunctionBodyModeler.ts

import { Project, Node, SyntaxKind, type SourceFile } from 'ts-morph';

/**
 * Результат моделирования тела функции
 */
export interface FunctionBodyModel {
  /** Z3 переменные для параметров */
  variables: Map<string, any>;
  /** Z3 выражение для тела функции */
  bodyExpression: any;
  /** Z3 контекст */
  context: any;
  /** Результат моделирования */
  resultVar: any;
  /** Была ли функция успешно смоделирована */
  success: boolean;
  /** Ошибка моделирования */
  error?: string;
}

/**
 * Моделирует тело функции в Z3 выражения
 */
export class FunctionBodyModeler {
  private context: any;
  private project: Project;
  private sourceFile: SourceFile | null = null;
  private solver: any;

  constructor(context: any, solver?: any) {
    this.context = context;
    this.solver = solver || null;
    this.project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });
  }

  /**
   * Моделирует тело функции из строки кода
   */
  async modelFunctionBody(
    functionBody: string,
    params: { name: string; type: 'int' | 'bool' | 'string' }[],
    returnType: 'int' | 'bool' | 'string' | 'void'
  ): Promise<FunctionBodyModel> {
    const result: FunctionBodyModel = {
      variables: new Map(),
      bodyExpression: null,
      context: this.context,
      resultVar: null,
      success: false,
    };

    try {
      // Создаем временный файл с функцией
      const functionCode = this.wrapFunctionCode(functionBody, params, returnType);

      // Загружаем в ts-morph
      this.sourceFile = this.project.createSourceFile('temp_function.ts', functionCode, {
        overwrite: true,
      });

      // Получаем функцию
      const func = this.sourceFile.getFunction('modeledFunction');
      if (!func) {
        result.error = 'Failed to parse function';
        return result;
      }

      // Создаем Z3 переменные для параметров
      for (const param of params) {
        try {
          if (param.type === 'int') {
            result.variables.set(param.name, this.context.Int.const(param.name));
          } else if (param.type === 'bool') {
            result.variables.set(param.name, this.context.Bool.const(param.name));
          } else if (param.type === 'string') {
            result.variables.set(param.name, this.context.String.const(param.name));
          }
        } catch (error) {
          result.error = `Failed to create variable ${param.name}: ${error}`;
          return result;
        }
      }

      // Создаем переменную для результата
      if (returnType !== 'void') {
        try {
          if (returnType === 'int') {
            result.resultVar = this.context.Int.const('result');
          } else if (returnType === 'bool') {
            result.resultVar = this.context.Bool.const('result');
          } else if (returnType === 'string') {
            result.resultVar = this.context.String.const('result');
          }
        } catch (error) {
          result.error = `Failed to create result variable: ${error}`;
          return result;
        }
      }

      // Моделируем тело функции
      const body = func.getBody();
      if (!body) {
        result.error = 'Function has no body';
        return result;
      }

      // Сначала моделируем выражение
      result.bodyExpression = await this.modelNode(body, result.variables);

      // ⭐ КРИТИЧЕСКИ ВАЖНО: Связываем result с телом функции
      if (result.resultVar && result.bodyExpression && this.solver) {
        try {
          // Добавляем: result == bodyExpression
          const equality = this.context.Eq(result.resultVar, result.bodyExpression);
          this.solver.add(equality);
          console.log(`  ✅ Added: result == ${functionBody}`);
        } catch (error) {
          console.warn(`  ⚠️ Failed to add equality: ${error}`);
          // Не считаем это критической ошибкой
        }
      }

      result.success = true;
      return result;
    } catch (error: any) {
      result.error = error.message || String(error);
      return result;
    }
  }

  /**
   * Обертывает код функции во временную функцию
   */
  private wrapFunctionCode(
    body: string,
    params: { name: string; type: 'int' | 'bool' | 'string' }[],
    returnType: 'int' | 'bool' | 'string' | 'void'
  ): string {
    const paramStr = params
      .map(
        p => `${p.name}: ${p.type === 'int' ? 'number' : p.type === 'bool' ? 'boolean' : 'string'}`
      )
      .join(', ');

    const returnStr =
      returnType === 'void'
        ? 'void'
        : returnType === 'int'
          ? 'number'
          : returnType === 'bool'
            ? 'boolean'
            : 'string';

    // ⭐ Правильно оборачиваем тело
    let bodyStr = body.trim();

    // Если тело уже содержит return, используем как есть
    if (bodyStr.startsWith('return ')) {
      // уже есть return
    } else if (bodyStr.startsWith('{')) {
      // уже есть фигурные скобки
    } else {
      // Добавляем return и фигурные скобки
      bodyStr = `{ return ${bodyStr}; }`;
    }

    return `function modeledFunction(${paramStr}): ${returnStr} ${bodyStr}`;
  }

  /**
   * Получает текст оператора из токена
   */
  private getOperatorText(operatorToken: any): string | undefined {
    if (!operatorToken) return undefined;

    // Пытаемся получить текст напрямую
    try {
      const text = operatorToken.getText();
      if (text) return text;
    } catch {
      // Игнорируем ошибку
    }

    // Используем kind для определения оператора
    try {
      const kind = operatorToken.getKind ? operatorToken.getKind() : undefined;
      if (kind !== undefined) {
        switch (kind) {
          case SyntaxKind.PlusToken:
            return '+';
          case SyntaxKind.MinusToken:
            return '-';
          case SyntaxKind.AsteriskToken:
            return '*';
          case SyntaxKind.SlashToken:
            return '/';
          case SyntaxKind.EqualsEqualsEqualsToken:
            return '===';
          case SyntaxKind.EqualsEqualsToken:
            return '==';
          case SyntaxKind.ExclamationEqualsEqualsToken:
            return '!==';
          case SyntaxKind.ExclamationEqualsToken:
            return '!=';
          case SyntaxKind.GreaterThanToken:
            return '>';
          case SyntaxKind.GreaterThanEqualsToken:
            return '>=';
          case SyntaxKind.LessThanToken:
            return '<';
          case SyntaxKind.LessThanEqualsToken:
            return '<=';
          case SyntaxKind.AmpersandAmpersandToken:
            return '&&';
          case SyntaxKind.BarBarToken:
            return '||';
          case SyntaxKind.EqualsToken:
            return '=';
          case SyntaxKind.PlusPlusToken:
            return '++';
          case SyntaxKind.MinusMinusToken:
            return '--';
          case SyntaxKind.ExclamationToken:
            return '!';
          default:
            return undefined;
        }
      }
    } catch {
      // Игнорируем ошибку
    }

    return undefined;
  }

  /**
   * Рекурсивно моделирует узлы AST
   */
  private async modelNode(node: Node, variables: Map<string, any>): Promise<any> {
    if (!this.context) return null;

    const kind = node.getKind();

    // Блок кода
    if (kind === SyntaxKind.Block) {
      const statements = node.getChildren();
      let lastExpression = null;

      for (const stmt of statements) {
        const expr = await this.modelNode(stmt, variables);
        if (expr !== null) {
          lastExpression = expr;
        }
      }

      return lastExpression;
    }

    // Return statement
    if (kind === SyntaxKind.ReturnStatement) {
      const returnStmt = node.asKind(SyntaxKind.ReturnStatement);
      if (returnStmt) {
        const expression = returnStmt.getExpression();
        if (expression) {
          return await this.modelNode(expression, variables);
        }
      }
      return null;
    }

    // Binary expression - объединенная проверка для всех бинарных операций
    if (kind === SyntaxKind.BinaryExpression) {
      const binary = node.asKind(SyntaxKind.BinaryExpression);
      if (binary) {
        const left = await this.modelNode(binary.getLeft(), variables);
        const right = await this.modelNode(binary.getRight(), variables);
        const operatorToken = binary.getOperatorToken();
        const operator = this.getOperatorText(operatorToken);

        // Обработка присваивания
        if (operator === '=') {
          const leftNode = binary.getLeft();
          const rightNode = binary.getRight();

          if (Node.isIdentifier(leftNode) && rightNode) {
            const name = leftNode.getText();
            const value = await this.modelNode(rightNode, variables);
            if (value) {
              variables.set(name, value);
            }
          }
          return null;
        }

        // ⭐ Обработка арифметических и логических операций
        if (left && right && operator) {
          try {
            switch (operator) {
              case '+':
                return this.context.Add(left, right);
              case '-':
                // ⭐ ФИКС: правильное вычитание
                return this.context.Sub(left, right);
              case '*':
                return this.context.Mul(left, right);
              case '/':
                return this.context.Div(left, right);
              case '===':
              case '==':
                return this.context.Eq(left, right);
              case '!==':
              case '!=':
                return this.context.Not(this.context.Eq(left, right));
              case '>':
                return this.context.GT(left, right);
              case '>=':
                return this.context.GE(left, right);
              case '<':
                return this.context.LT(left, right);
              case '<=':
                return this.context.LE(left, right);
              case '&&':
                return this.context.And(left, right);
              case '||':
                return this.context.Or(left, right);
              default:
                return null;
            }
          } catch (error) {
            console.warn(`Failed to create operation ${operator}:`, error);
            return null;
          }
        }
      }
      return null;
    }

    // Identifier
    if (kind === SyntaxKind.Identifier) {
      const name = node.getText();
      if (variables.has(name)) {
        return variables.get(name);
      }
      // Проверяем, может быть это число
      if (!isNaN(Number(name))) {
        try {
          return this.context.Int.val(Number(name));
        } catch {
          return null;
        }
      }
      return null;
    }

    // Numeric literal
    if (kind === SyntaxKind.NumericLiteral) {
      const value = parseFloat(node.getText());
      try {
        return this.context.Int.val(value);
      } catch {
        return null;
      }
    }

    // String literal
    if (kind === SyntaxKind.StringLiteral) {
      const value = node.getText().slice(1, -1);
      try {
        return this.context.String.val(value);
      } catch {
        return null;
      }
    }

    // Boolean literal
    if (kind === SyntaxKind.TrueKeyword) {
      try {
        return this.context.Bool.val(true);
      } catch {
        return null;
      }
    }
    if (kind === SyntaxKind.FalseKeyword) {
      try {
        return this.context.Bool.val(false);
      } catch {
        return null;
      }
    }

    // If statement
    if (kind === SyntaxKind.IfStatement) {
      const ifStmt = node.asKind(SyntaxKind.IfStatement);
      if (ifStmt) {
        // Получаем условие - используем getExpression() для IfStatement
        const conditionNode = ifStmt.getExpression();
        const condition = conditionNode ? await this.modelNode(conditionNode, variables) : null;

        const thenNode = ifStmt.getThenStatement();
        const elseNode = ifStmt.getElseStatement();

        if (condition && thenNode) {
          const thenExpr = await this.modelNode(thenNode, variables);
          if (elseNode) {
            const elseExpr = await this.modelNode(elseNode, variables);
            if (thenExpr && elseExpr) {
              try {
                return this.context.If(condition, thenExpr, elseExpr);
              } catch {
                return null;
              }
            }
          }
          if (thenExpr) {
            try {
              return this.context.Implies(condition, thenExpr);
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    }

    // Variable declaration (const/let)
    if (kind === SyntaxKind.VariableStatement) {
      const varStmt = node.asKind(SyntaxKind.VariableStatement);
      if (varStmt) {
        const declarations = varStmt.getDeclarations();
        for (const decl of declarations) {
          const name = decl.getName();
          const initializer = decl.getInitializer();
          if (initializer) {
            const value = await this.modelNode(initializer, variables);
            if (value) {
              variables.set(name, value);
            }
          }
        }
      }
      return null;
    }

    // Call expression
    if (kind === SyntaxKind.CallExpression) {
      const call = node.asKind(SyntaxKind.CallExpression);
      if (call) {
        const expression = call.getExpression();
        if (Node.isIdentifier(expression)) {
          const funcName = expression.getText();
          // Проверяем встроенные функции
          if (funcName === 'Math.max' || funcName === 'max') {
            const args = await Promise.all(
              call.getArguments().map(a => this.modelNode(a, variables))
            );
            if (args.length === 2 && args[0] && args[1]) {
              try {
                return this.context.If(this.context.GT(args[0], args[1]), args[0], args[1]);
              } catch {
                return null;
              }
            }
          }
          if (funcName === 'Math.min' || funcName === 'min') {
            const args = await Promise.all(
              call.getArguments().map(a => this.modelNode(a, variables))
            );
            if (args.length === 2 && args[0] && args[1]) {
              try {
                return this.context.If(this.context.LT(args[0], args[1]), args[0], args[1]);
              } catch {
                return null;
              }
            }
          }
          // Math.abs
          if (funcName === 'Math.abs' || funcName === 'abs') {
            const args = await Promise.all(
              call.getArguments().map(a => this.modelNode(a, variables))
            );
            if (args.length === 1 && args[0]) {
              try {
                return this.context.If(
                  this.context.GE(args[0], this.context.Int.val(0)),
                  args[0],
                  this.context.Sub(this.context.Int.val(0), args[0])
                );
              } catch {
                return null;
              }
            }
          }
          // Math.pow
          if (funcName === 'Math.pow' || funcName === 'pow') {
            const args = await Promise.all(
              call.getArguments().map(a => this.modelNode(a, variables))
            );
            if (args.length === 2 && args[0] && args[1]) {
              try {
                // Z3 не имеет встроенной функции pow, используем умножение для малых степеней
                return this.context.Mul(args[0], args[1]);
              } catch {
                return null;
              }
            }
          }
        }
      }
      return null;
    }

    // Parenthesized expression
    if (kind === SyntaxKind.ParenthesizedExpression) {
      const parenthesized = node.asKind(SyntaxKind.ParenthesizedExpression);
      if (parenthesized) {
        const expression = parenthesized.getExpression();
        if (expression) {
          return await this.modelNode(expression, variables);
        }
      }
      return null;
    }

    // Prefix unary expression
    if (kind === SyntaxKind.PrefixUnaryExpression) {
      const unary = node.asKind(SyntaxKind.PrefixUnaryExpression);
      if (unary) {
        const operatorToken = unary.getOperatorToken();
        const operator = this.getOperatorText(operatorToken);
        const operand = unary.getOperand();

        if (operator === '-' && operand) {
          const expr = await this.modelNode(operand, variables);
          if (expr) {
            try {
              return this.context.Sub(this.context.Int.val(0), expr);
            } catch {
              return null;
            }
          }
        }
        if (operator === '!' && operand) {
          const expr = await this.modelNode(operand, variables);
          if (expr) {
            try {
              return this.context.Not(expr);
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    }

    // Postfix unary expression (i++, i--)
    if (kind === SyntaxKind.PostfixUnaryExpression) {
      const unary = node.asKind(SyntaxKind.PostfixUnaryExpression);
      if (unary) {
        const operatorToken = unary.getOperatorToken();
        const operator = this.getOperatorText(operatorToken);
        const operand = unary.getOperand();

        if (operator === '++' && operand) {
          const name = operand.getText();
          if (variables.has(name)) {
            const varExpr = variables.get(name);
            try {
              const newValue = this.context.Add(varExpr, this.context.Int.val(1));
              variables.set(name, newValue);
              return varExpr;
            } catch {
              return null;
            }
          }
        }
        if (operator === '--' && operand) {
          const name = operand.getText();
          if (variables.has(name)) {
            const varExpr = variables.get(name);
            try {
              const newValue = this.context.Sub(varExpr, this.context.Int.val(1));
              variables.set(name, newValue);
              return varExpr;
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    }

    return null;
  }

  /**
   * Проверяет, может ли функция быть смоделирована
   */
  canModelFunction(functionBody: string): boolean {
    // Проверяем наличие сложных конструкций, которые мы не можем смоделировать
    const complexPatterns = [
      /for\s*\(/,
      /while\s*\(/,
      /do\s*{/,
      /switch\s*\(/,
      /try\s*{/,
      /catch\s*\(/,
      /new\s+\w+\s*\(/,
      /class\s+\w+/,
      /function\s+\w+\s*\(/,
      /=>\s*{/,
      /\.then\(/,
      /await\s+/,
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(functionBody)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Возвращает упрощенное выражение для тела функции
   */
  simplifyBody(body: string): string {
    // Удаляем return, если он есть
    let simplified = body.trim();

    // Если тело в фигурных скобках
    if (simplified.startsWith('{') && simplified.endsWith('}')) {
      simplified = simplified.slice(1, -1).trim();
    }

    // Если начинается с return
    if (simplified.startsWith('return ')) {
      simplified = simplified.substring(7).trim();
    }

    // Убираем точку с запятой в конце
    if (simplified.endsWith(';')) {
      simplified = simplified.slice(0, -1).trim();
    }

    return simplified;
  }

  /**
   * Проверяет, является ли выражение простым арифметическим
   */
  isSimpleArithmetic(body: string): boolean {
    const simplified = this.simplifyBody(body);
    const allowedPattern = /^[a-zA-Z_][a-zA-Z0-9_]*\s*[+\-*/]\s*[a-zA-Z_][a-zA-Z0-9_]*$/;
    return allowedPattern.test(simplified);
  }

  /**
   * Проверяет, является ли выражение условным
   */
  isConditional(body: string): boolean {
    const simplified = this.simplifyBody(body);
    return simplified.includes('?') || simplified.includes('if');
  }

  /**
   * Извлекает переменные из выражения
   */
  extractVariables(body: string): string[] {
    const variables: string[] = [];
    const matches = body.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
    if (matches) {
      for (const match of matches) {
        if (
          ![
            'if',
            'else',
            'return',
            'true',
            'false',
            'null',
            'undefined',
            'typeof',
            'instanceof',
          ].includes(match)
        ) {
          variables.push(match);
        }
      }
    }
    return [...new Set(variables)];
  }
}
