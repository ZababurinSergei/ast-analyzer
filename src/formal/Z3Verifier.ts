// packages/ast-analyzer/src/formal/Z3Verifier.ts

import { init } from 'z3-solver';
import { Mutex } from 'async-mutex';

// ============================================
// ТИПЫ ДЛЯ КОНТРАКТОВ
// ============================================

export interface FunctionContract {
  name: string;
  params: { name: string; type: 'int' | 'bool' | 'string' }[];
  returnType: 'int' | 'bool' | 'string' | 'void';
  preconditions: VerificationConstraint[];
  postconditions: VerificationConstraint[];
  invariants: VerificationConstraint[];
  body?: string;
}

export interface VerificationConstraint {
  type:
    | 'equality'
    | 'inequality'
    | 'range'
    | 'implication'
    | 'and'
    | 'or'
    | 'not'
    | 'comparison'
    | 'function_call'
    | 'return'
    | 'add'
    | 'sub'
    | 'mul'
    | 'div'
    | 'mod'
    | 'pow';
  left?: any;
  right?: any;
  variable?: string;
  min?: number;
  max?: number;
  condition?: VerificationConstraint;
  consequence?: VerificationConstraint;
  constraints?: VerificationConstraint[];
  operand?: VerificationConstraint;
  operator?: string;
  functionName?: string;
  args?: VerificationConstraint[];
  value?: any;
}

export interface VerificationResult {
  isValid: boolean;
  model?: Map<string, any>;
  proof?: string;
  counterexample?: Map<string, any>;
  time?: number;
  error?: string;
  functionName?: string;
  failedConstraint?: string;
}

// ============================================
// ОСНОВНОЙ КЛАСС
// ============================================

export class Z3Verifier {
  private context: any = null;
  private solver: any = null;
  private initialized = false;
  private mutex: Mutex;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.mutex = new Mutex();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.mutex.runExclusive(async () => {
      try {
        const Z3Module = await init();
        const { Context } = Z3Module;
        this.context = new Context('main');
        this.solver = new this.context.Solver();
        this.initialized = true;
        console.log('✅ Z3 solver initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Z3:', error);
        this.initialized = false;
        throw error;
      }
    });

    return this.initializationPromise;
  }

  // ============================================
  // ОСНОВНОЙ МЕТОД ВЕРИФИКАЦИИ
  // ============================================

  async verifyFunction(contract: FunctionContract): Promise<VerificationResult> {
    return this.mutex.runExclusive(async () => {
      const startTime = Date.now();

      try {
        if (!this.initialized) {
          try {
            await this.initialize();
          } catch (error) {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Z3 initialization failed: ${error}`,
            };
          }
        }

        // 1. СОЗДАЕМ ПЕРЕМЕННЫЕ В Z3
        const vars = new Map<string, any>();
        for (const param of contract.params) {
          const varName = param.name;
          try {
            if (param.type === 'int') {
              vars.set(varName, this.context.Int.const(varName));
            } else if (param.type === 'bool') {
              vars.set(varName, this.context.Bool.const(varName));
            } else if (param.type === 'string') {
              vars.set(varName, this.context.String.const(varName));
            }
          } catch (error) {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Failed to create variable ${varName}: ${error}`,
            };
          }
        }

        // Добавляем переменную для результата
        let resultVar = null;
        if (contract.returnType !== 'void') {
          const resultName = 'result';
          try {
            if (contract.returnType === 'int') {
              resultVar = this.context.Int.const(resultName);
            } else if (contract.returnType === 'bool') {
              resultVar = this.context.Bool.const(resultName);
            } else if (contract.returnType === 'string') {
              resultVar = this.context.String.const(resultName);
            }
            if (resultVar) {
              vars.set('result', resultVar);
            }
          } catch (error) {
            // Игнорируем ошибки создания result
          }
        }

        // ⭐ МОДЕЛИРОВАНИЕ ТЕЛА ФУНКЦИИ
        let bodyExpression: any = null;

        if (contract.body && resultVar) {
          try {
            // Извлекаем выражение из тела функции
            let bodyExpr = contract.body.trim();

            // Убираем 'return ' если есть
            if (bodyExpr.startsWith('return ')) {
              bodyExpr = bodyExpr.substring(7).trim();
            }
            // Убираем ';' если есть
            if (bodyExpr.endsWith(';')) {
              bodyExpr = bodyExpr.slice(0, -1).trim();
            }
            // Убираем фигурные скобки если есть
            if (bodyExpr.startsWith('{') && bodyExpr.endsWith('}')) {
              bodyExpr = bodyExpr.slice(1, -1).trim();
              if (bodyExpr.startsWith('return ')) {
                bodyExpr = bodyExpr.substring(7).trim();
              }
              if (bodyExpr.endsWith(';')) {
                bodyExpr = bodyExpr.slice(0, -1).trim();
              }
            }

            // Парсим выражение
            bodyExpression = this.parseExpression(bodyExpr, vars);

            if (bodyExpression) {
              // ⭐ Связываем result с телом функции
              try {
                const equality = this.context.Eq(resultVar, bodyExpression);
                this.solver.add(equality);
              } catch (error) {
                console.warn(`  ⚠️ Failed to add equality: ${error}`);
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to model function body: ${error}`);
          }
        }

        // 2. ДОБАВЛЯЕМ ПРЕДУСЛОВИЯ
        const preconditions: any[] = [];
        for (const pre of contract.preconditions) {
          try {
            const constraint = this.constraintToZ3(pre, vars);
            if (constraint !== null && constraint !== undefined) {
              preconditions.push(constraint);
            } else {
              return {
                isValid: false,
                time: Date.now() - startTime,
                error: `Failed to convert precondition: ${JSON.stringify(pre)}`,
              };
            }
          } catch (error) {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Failed to add precondition: ${error}`,
            };
          }
        }

        // 3. ДОБАВЛЯЕМ ИНВАРИАНТЫ
        const invariants: any[] = [];
        for (const inv of contract.invariants) {
          try {
            const constraint = this.constraintToZ3(inv, vars);
            if (constraint !== null && constraint !== undefined) {
              invariants.push(constraint);
            } else {
              return {
                isValid: false,
                time: Date.now() - startTime,
                error: `Failed to convert invariant: ${JSON.stringify(inv)}`,
              };
            }
          } catch (error) {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Failed to add invariant: ${error}`,
            };
          }
        }

        // 4. СТРОИМ ПОСТУСЛОВИЕ
        const postconditions = this.buildPostconditionFormula(contract.postconditions, vars);

        // 5. ПРОВЕРЯЕМ
        if (preconditions.length > 0 || invariants.length > 0) {
          this.solver.push();

          for (const pre of preconditions) {
            this.solver.add(pre);
          }
          for (const inv of invariants) {
            this.solver.add(inv);
          }

          if (postconditions) {
            const checkResult = await this.solver.check();

            if (checkResult === 'unsat') {
              this.solver.pop();
              return {
                isValid: false,
                time: Date.now() - startTime,
                error: 'Preconditions and invariants are contradictory',
              };
            }

            this.solver.push();
            try {
              this.solver.add(this.context.Not(postconditions));
            } catch (error) {
              this.solver.pop();
              this.solver.pop();
              return {
                isValid: false,
                time: Date.now() - startTime,
                error: 'Failed to add postcondition negation',
              };
            }

            const result = await this.solver.check();
            this.solver.pop();
            this.solver.pop();

            if (result === 'sat') {
              const model = this.extractModel(vars);
              return {
                isValid: false,
                model,
                counterexample: model,
                time: Date.now() - startTime,
                error: 'Postcondition does not follow from preconditions, invariants, and body',
              };
            } else if (result === 'unsat') {
              return {
                isValid: true,
                time: Date.now() - startTime,
              };
            } else {
              return {
                isValid: false,
                time: Date.now() - startTime,
                error: `Z3 returned: ${result}`,
              };
            }
          } else {
            const result = await this.solver.check();
            this.solver.pop();

            if (result === 'sat') {
              return {
                isValid: true,
                time: Date.now() - startTime,
              };
            } else {
              return {
                isValid: false,
                time: Date.now() - startTime,
                error: `Preconditions are contradictory: ${result}`,
              };
            }
          }
        } else {
          if (postconditions) {
            this.solver.push();
            this.solver.add(postconditions);
            const result = await this.solver.check();
            this.solver.pop();

            if (result === 'sat') {
              return {
                isValid: true,
                time: Date.now() - startTime,
              };
            } else {
              return {
                isValid: false,
                time: Date.now() - startTime,
                error: `Postconditions are contradictory: ${result}`,
              };
            }
          } else {
            return {
              isValid: true,
              time: Date.now() - startTime,
            };
          }
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        return {
          isValid: false,
          time: Date.now() - startTime,
          error: error.message || String(error),
        };
      }
    });
  }

  // ============================================
  // ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ
  // ============================================

  async verifyEquivalence(
    original: string,
    modified: string,
    variables: Map<string, 'int' | 'bool' | 'string'>
  ): Promise<VerificationResult> {
    return this.mutex.runExclusive(async () => {
      const startTime = Date.now();

      try {
        if (!this.initialized) {
          try {
            await this.initialize();
          } catch (error) {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Z3 initialization failed: ${error}`,
            };
          }
        }

        // Создаем переменные
        const vars = new Map<string, any>();
        for (const [name, type] of variables) {
          try {
            if (type === 'int') {
              vars.set(name, this.context.Int.const(name));
            } else if (type === 'bool') {
              vars.set(name, this.context.Bool.const(name));
            } else if (type === 'string') {
              vars.set(name, this.context.String.const(name));
            }
          } catch (error) {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Failed to create variable ${name}: ${error}`,
            };
          }
        }

        // Парсим выражения
        const originalExpr = this.parseExpression(original, vars);
        const modifiedExpr = this.parseExpression(modified, vars);

        if (modified === 'true' && originalExpr) {
          this.solver.push();
          try {
            this.solver.add(this.context.Not(originalExpr));
          } catch (error) {
            this.solver.pop();
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: 'Failed to add negation',
            };
          }

          const result = await this.solver.check();
          this.solver.pop();

          if (result === 'unsat') {
            return { isValid: true, time: Date.now() - startTime };
          } else if (result === 'sat') {
            const model = this.extractModel(vars);
            return {
              isValid: false,
              model,
              counterexample: model,
              time: Date.now() - startTime,
              error: 'Expression is not always true',
            };
          } else {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Z3 returned: ${result}`,
            };
          }
        }

        if (!originalExpr || !modifiedExpr) {
          return {
            isValid: false,
            time: Date.now() - startTime,
            error: 'Failed to parse expressions',
          };
        }

        this.solver.push();

        try {
          const equivalence = this.context.Eq(originalExpr, modifiedExpr);
          this.solver.add(this.context.Not(equivalence));
        } catch (error) {
          this.solver.pop();
          return {
            isValid: false,
            time: Date.now() - startTime,
            error: 'Failed to add equivalence negation',
          };
        }

        const result = await this.solver.check();

        let model: Map<string, any> | undefined;
        let counterexample: Map<string, any> | undefined;

        if (result === 'sat') {
          try {
            const solverModel = this.solver.model();
            model = new Map<string, any>();

            for (const [name] of variables) {
              try {
                const varExpr = vars.get(name);
                if (varExpr) {
                  const value = solverModel.eval(varExpr);
                  if (value !== null && value !== undefined) {
                    model.set(name, value.toString());
                  }
                }
              } catch (e) {
                // Игнорируем ошибки для отдельных переменных
              }
            }

            if (model.size > 0) {
              counterexample = model;
            } else {
              const extractedModel = this.extractModel(vars);
              if (extractedModel.size > 0) {
                model = extractedModel;
                counterexample = extractedModel;
              }
            }
          } catch (error) {
            // Игнорируем ошибки извлечения модели
          }
        }

        this.solver.pop();

        if (result === 'unsat') {
          return { isValid: true, time: Date.now() - startTime };
        } else if (result === 'sat') {
          return {
            isValid: false,
            model,
            counterexample: counterexample || model || undefined,
            time: Date.now() - startTime,
            error: 'Expressions are not equivalent',
          };
        } else {
          return {
            isValid: false,
            time: Date.now() - startTime,
            error: `Z3 returned: ${result}`,
          };
        }
      } catch (error: any) {
        return {
          isValid: false,
          time: Date.now() - startTime,
          error: error.message || String(error),
        };
      }
    });
  }

  // ============================================
  // ПРОВЕРКА ИНВАРИАНТОВ ЦИКЛОВ
  // ============================================

  async verifyLoopInvariant(
    invariant: VerificationConstraint,
    condition: VerificationConstraint,
    _loopBody: VerificationConstraint[]
  ): Promise<VerificationResult> {
    return this.mutex.runExclusive(async () => {
      const startTime = Date.now();

      try {
        if (!this.initialized) {
          try {
            await this.initialize();
          } catch (error) {
            return {
              isValid: false,
              time: Date.now() - startTime,
              error: `Z3 initialization failed: ${error}`,
            };
          }
        }

        const vars = new Map<string, any>();

        const varNames = this.extractVariableNames(invariant);
        for (const name of varNames) {
          try {
            vars.set(name, this.context.Int.const(name));
          } catch (error) {
            // Игнорируем ошибки
          }
        }

        const invariantFormula = this.constraintToZ3(invariant, vars);
        const conditionFormula = this.constraintToZ3(condition, vars);

        if (!invariantFormula || !conditionFormula) {
          return {
            isValid: false,
            time: Date.now() - startTime,
            error: 'Invalid invariant or condition',
          };
        }

        this.solver.push();

        try {
          const implication = this.context.Implies(
            this.context.And(invariantFormula, conditionFormula),
            invariantFormula
          );
          this.solver.add(this.context.Not(implication));
        } catch (error) {
          this.solver.pop();
          return {
            isValid: false,
            time: Date.now() - startTime,
            error: 'Failed to add implication',
          };
        }

        const result = await this.solver.check();
        this.solver.pop();

        if (result === 'unsat') {
          return { isValid: true, time: Date.now() - startTime };
        } else if (result === 'sat') {
          const model = this.extractModel(vars);
          return {
            isValid: false,
            model,
            counterexample: model,
            time: Date.now() - startTime,
          };
        } else {
          return {
            isValid: false,
            time: Date.now() - startTime,
            error: `Z3 returned: ${result}`,
          };
        }
      } catch (error: any) {
        return {
          isValid: false,
          time: Date.now() - startTime,
          error: error.message || String(error),
        };
      }
    });
  }

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================

  private constraintToZ3(
    constraint: VerificationConstraint | undefined,
    variables: Map<string, any>
  ): any {
    if (!constraint || !this.context) return null;

    try {
      switch (constraint.type) {
        case 'equality': {
          const left = this.valueToZ3(constraint.left, variables);
          const right = this.valueToZ3(constraint.right, variables);
          if (left === null || right === null) return null;
          return this.context.Eq(left, right);
        }

        case 'inequality': {
          const left = this.valueToZ3(constraint.left, variables);
          const right = this.valueToZ3(constraint.right, variables);
          if (left === null || right === null) return null;
          return this.context.Not(this.context.Eq(left, right));
        }

        case 'range': {
          const varExpr = variables.get(constraint.variable!);
          if (!varExpr || constraint.min === undefined || constraint.max === undefined) {
            return null;
          }
          try {
            const minVal = this.context.Int.val(constraint.min);
            const maxVal = this.context.Int.val(constraint.max);
            const minCond = this.context.GE(varExpr, minVal);
            const maxCond = this.context.LE(varExpr, maxVal);
            return this.context.And(minCond, maxCond);
          } catch (error) {
            return null;
          }
        }

        case 'comparison': {
          const left = this.valueToZ3(constraint.left, variables);
          const right = this.valueToZ3(constraint.right, variables);
          if (left === null || right === null) return null;

          const operator = constraint.operator || '==';
          try {
            switch (operator) {
              case '>':
                return this.context.GT(left, right);
              case '>=':
                return this.context.GE(left, right);
              case '<':
                return this.context.LT(left, right);
              case '<=':
                return this.context.LE(left, right);
              case '!=':
                return this.context.Not(this.context.Eq(left, right));
              case '==':
              default:
                return this.context.Eq(left, right);
            }
          } catch (error) {
            return null;
          }
        }

        case 'implication': {
          const antecedent = this.constraintToZ3(constraint.condition, variables);
          const consequent = this.constraintToZ3(constraint.consequence, variables);
          if (!antecedent || !consequent) return null;
          return this.context.Implies(antecedent, consequent);
        }

        case 'and': {
          if (!constraint.constraints || constraint.constraints.length === 0) return null;
          const formulas = constraint.constraints
            .map(c => this.constraintToZ3(c, variables))
            .filter(f => f !== null && f !== undefined);
          if (formulas.length === 0) return null;
          if (formulas.length === 1) return formulas[0];
          return this.context.And(...formulas);
        }

        case 'or': {
          if (!constraint.constraints || constraint.constraints.length === 0) return null;
          const formulas = constraint.constraints
            .map(c => this.constraintToZ3(c, variables))
            .filter(f => f !== null && f !== undefined);
          if (formulas.length === 0) return null;
          if (formulas.length === 1) return formulas[0];
          return this.context.Or(...formulas);
        }

        case 'not': {
          const operand = this.constraintToZ3(constraint.operand, variables);
          if (!operand) return null;
          return this.context.Not(operand);
        }

        default:
          return null;
      }
    } catch (error) {
      console.warn(`⚠️ Constraint conversion failed: ${error}`);
      return null;
    }
  }

  private valueToZ3(value: any, variables: Map<string, any>): any {
    if (!this.context) return null;

    if (typeof value === 'string' && variables.has(value)) {
      return variables.get(value);
    }

    if (typeof value === 'number') {
      try {
        return this.context.Int.val(value);
      } catch (error) {
        return null;
      }
    }

    if (typeof value === 'boolean') {
      try {
        return this.context.Bool.val(value);
      } catch (error) {
        return null;
      }
    }

    if (typeof value === 'string') {
      try {
        return this.context.String.val(value);
      } catch (error) {
        return null;
      }
    }

    if (typeof value === 'object' && value !== null) {
      if (value.type === 'add' && value.left !== undefined && value.right !== undefined) {
        const left = this.valueToZ3(value.left, variables);
        const right = this.valueToZ3(value.right, variables);
        if (left && right) {
          try {
            return this.context.Add(left, right);
          } catch (error) {
            return null;
          }
        }
      }

      if (value.type === 'sub' && value.left !== undefined && value.right !== undefined) {
        const left = this.valueToZ3(value.left, variables);
        const right = this.valueToZ3(value.right, variables);
        if (left !== null && right !== null) {
          try {
            return this.context.Sub(left, right);
          } catch (error) {
            return null;
          }
        }
      }

      if (value.type === 'mul' && value.left !== undefined && value.right !== undefined) {
        const left = this.valueToZ3(value.left, variables);
        const right = this.valueToZ3(value.right, variables);
        if (left && right) {
          try {
            return this.context.Mul(left, right);
          } catch (error) {
            return null;
          }
        }
      }

      if (value.type === 'div' && value.left !== undefined && value.right !== undefined) {
        const left = this.valueToZ3(value.left, variables);
        const right = this.valueToZ3(value.right, variables);
        if (left && right) {
          try {
            return this.context.Div(left, right);
          } catch (error) {
            return null;
          }
        }
      }

      if (value.left !== undefined && value.right !== undefined && value.type === 'equality') {
        const left = this.valueToZ3(value.left, variables);
        const right = this.valueToZ3(value.right, variables);
        if (left && right) {
          return this.context.Eq(left, right);
        }
      }

      if (value.left !== undefined && value.right !== undefined && value.type === 'comparison') {
        const left = this.valueToZ3(value.left, variables);
        const right = this.valueToZ3(value.right, variables);
        if (left && right) {
          const op = value.operator || '==';
          switch (op) {
            case '>':
              return this.context.GT(left, right);
            case '>=':
              return this.context.GE(left, right);
            case '<':
              return this.context.LT(left, right);
            case '<=':
              return this.context.LE(left, right);
            case '!=':
              return this.context.Not(this.context.Eq(left, right));
            default:
              return this.context.Eq(left, right);
          }
        }
      }

      if (value.type === 'and' && value.constraints) {
        const formulas = value.constraints
          .map((c: any) => this.valueToZ3(c, variables))
          .filter((f: any) => f !== null && f !== undefined);
        if (formulas.length === 0) return null;
        if (formulas.length === 1) return formulas[0];
        return this.context.And(...formulas);
      }

      if (value.type === 'or' && value.constraints) {
        const formulas = value.constraints
          .map((c: any) => this.valueToZ3(c, variables))
          .filter((f: any) => f !== null && f !== undefined);
        if (formulas.length === 0) return null;
        if (formulas.length === 1) return formulas[0];
        return this.context.Or(...formulas);
      }
    }

    return null;
  }

  private buildPostconditionFormula(
    postconditions: VerificationConstraint[],
    params: Map<string, any>
  ): any {
    if (!this.context || postconditions.length === 0) return null;

    const formulas = postconditions
      .map(p => this.constraintToZ3(p, params))
      .filter(f => f !== null && f !== undefined);

    if (formulas.length === 0) return null;
    if (formulas.length === 1) return formulas[0];

    return this.context.And(...formulas);
  }

  private parseExpression(expr: string, vars: Map<string, any>): any {
    if (!this.context) return null;

    const trimmed = expr.trim();

    if (vars.has(trimmed)) {
      return vars.get(trimmed);
    }

    if (!isNaN(Number(trimmed))) {
      try {
        return this.context.Int.val(Number(trimmed));
      } catch (error) {
        return null;
      }
    }

    if (trimmed === 'true') {
      return this.context.Bool.val(true);
    }
    if (trimmed === 'false') {
      return this.context.Bool.val(false);
    }

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      let depth = 0;
      let isBalanced = true;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '(') depth++;
        if (trimmed[i] === ')') depth--;
        if (depth === 0 && i < trimmed.length - 1) {
          isBalanced = false;
          break;
        }
      }
      if (isBalanced) {
        return this.parseExpression(trimmed.slice(1, -1), vars);
      }
    }

    const operatorGroups = [
      { ops: ['=>'], priority: 0 },
      { ops: ['===', '=='], priority: 1 },
      { ops: ['!==', '!='], priority: 1 },
      { ops: ['||'], priority: 2 },
      { ops: ['&&'], priority: 3 },
      { ops: ['>=', '<=', '>', '<'], priority: 4 },
      { ops: ['+', '-'], priority: 5 },
      { ops: ['*', '/'], priority: 6 },
    ];

    let foundOp = null;
    let foundPos = -1;
    let foundPriority = Infinity;

    for (const group of operatorGroups) {
      for (const op of group.ops) {
        let depth = 0;
        let pos = -1;

        for (let i = 0; i < trimmed.length; i++) {
          if (trimmed[i] === '(') depth++;
          if (trimmed[i] === ')') depth--;

          if (depth === 0 && trimmed.slice(i, i + op.length) === op) {
            const isPartOfLarger =
              (op === '=' && i + 1 < trimmed.length && trimmed[i + 1] === '=') ||
              (op === '!' && i + 1 < trimmed.length && trimmed[i + 1] === '=') ||
              (op === '>' && i + 1 < trimmed.length && trimmed[i + 1] === '=') ||
              (op === '<' && i + 1 < trimmed.length && trimmed[i + 1] === '=') ||
              (op === '&' && i + 1 < trimmed.length && trimmed[i + 1] === '&') ||
              (op === '|' && i + 1 < trimmed.length && trimmed[i + 1] === '|') ||
              (op === '*' && i + 1 < trimmed.length && trimmed[i + 1] === '*');

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
      const left = this.parseExpression(trimmed.slice(0, foundPos).trim(), vars);
      const right = this.parseExpression(trimmed.slice(foundPos + foundOp.length).trim(), vars);

      if (left && right) {
        try {
          switch (foundOp) {
            case '=>': {
              if (typeof this.context.Implies === 'function') {
                return this.context.Implies(left, right);
              } else {
                const notLeft =
                  typeof this.context.Not === 'function' ? this.context.Not(left) : null;
                if (notLeft && typeof this.context.Or === 'function') {
                  return this.context.Or(notLeft, right);
                }
                return null;
              }
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
      } else {
        return null;
      }
    }

    return null;
  }

  private extractVariableNames(constraint: VerificationConstraint): string[] {
    const names: string[] = [];

    const extract = (c: VerificationConstraint | undefined) => {
      if (!c) return;
      if (c.variable) names.push(c.variable);
      if (c.left && typeof c.left === 'string') names.push(c.left);
      if (c.right && typeof c.right === 'string') names.push(c.right);
      if (c.constraints) {
        for (const sub of c.constraints) {
          extract(sub);
        }
      }
      if (c.condition) extract(c.condition);
      if (c.consequence) extract(c.consequence);
      if (c.operand) extract(c.operand);
    };

    extract(constraint);
    return names;
  }

  private extractModel(variables: Map<string, any>): Map<string, any> {
    const model = new Map<string, any>();
    if (!this.solver) return model;

    try {
      const solverModel = this.solver.model();
      for (const [name, varExpr] of variables) {
        try {
          const value = solverModel.eval(varExpr);
          if (value) {
            model.set(name, value.toString());
          }
        } catch (error) {
          // Пропускаем переменные, которые не удалось вычислить
        }
      }
    } catch (error) {
      // Игнорируем ошибки извлечения модели
    }

    return model;
  }

  async reset(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      if (this.solver) {
        this.solver.reset();
      }
    });
  }

  async dispose(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      if (this.solver) {
        this.solver = null;
      }
      if (this.context) {
        this.context = null;
      }
      this.initialized = false;
      this.initializationPromise = null;
    });
  }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

export function add(left: any, right: any): VerificationConstraint {
  return { type: 'add', left, right };
}

export function sub(left: any, right: any): VerificationConstraint {
  return { type: 'sub', left, right };
}

export function mul(left: any, right: any): VerificationConstraint {
  return { type: 'mul', left, right };
}

export function div(left: any, right: any): VerificationConstraint {
  return { type: 'div', left, right };
}

export function createIntParam(name: string): { name: string; type: 'int' } {
  return { name, type: 'int' };
}

export function createBoolParam(name: string): { name: string; type: 'bool' } {
  return { name, type: 'bool' };
}

export function createStringParam(name: string): { name: string; type: 'string' } {
  return { name, type: 'string' };
}

export function eq(left: any, right: any): VerificationConstraint {
  return { type: 'equality', left, right };
}

export function neq(left: any, right: any): VerificationConstraint {
  return { type: 'inequality', left, right };
}

export function range(variable: string, min: number, max: number): VerificationConstraint {
  return { type: 'range', variable, min, max };
}

export function implies(
  condition: VerificationConstraint,
  consequence: VerificationConstraint
): VerificationConstraint {
  return { type: 'implication', condition, consequence };
}

export function and(...constraints: VerificationConstraint[]): VerificationConstraint {
  return { type: 'and', constraints };
}

export function or(...constraints: VerificationConstraint[]): VerificationConstraint {
  return { type: 'or', constraints };
}

export function not(operand: VerificationConstraint): VerificationConstraint {
  return { type: 'not', operand };
}

export function compare(
  left: string | number | any,
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=',
  right: string | number | any
): VerificationConstraint {
  return { type: 'comparison', left, operator, right };
}
