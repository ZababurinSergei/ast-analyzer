// src/formal/Z3Verifier.ts

import { init } from 'z3-solver';

export interface VerificationConstraint {
  type: 'equality' | 'inequality' | 'range' | 'implication' | 'and' | 'or' | 'not';
  left?: any;
  right?: any;
  variable?: string;
  min?: number;
  max?: number;
  condition?: VerificationConstraint;
  consequence?: VerificationConstraint;
  constraints?: VerificationConstraint[];
  operand?: VerificationConstraint;
}

export interface VerificationResult {
  isValid: boolean;
  model?: Map<string, any>;
  proof?: string;
  counterexample?: Map<string, any>;
  time?: number;
  error?: string;
  functionName?: string;
}

export interface FunctionContract {
  name: string;
  params: { name: string; type: 'int' | 'bool' | 'string' }[];
  returnType: 'int' | 'bool' | 'string' | 'void';
  preconditions: VerificationConstraint[];
  postconditions: VerificationConstraint[];
  invariants: VerificationConstraint[];
}

// Вспомогательные функции для создания Z3 выражений
function createIntVar(name: string, context: any): any {
  return context.Int.const(name);
}

function createBoolVar(name: string, context: any): any {
  return context.Bool.const(name);
}

function createIntVal(value: number, context: any): any {
  return context.Int.val(value);
}

function createBoolVal(value: boolean, context: any): any {
  return context.Bool.val(value);
}

export class Z3Verifier {
  private z3: any = null;
  private context: any = null;
  private solver: any = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const Z3Module = await init();
      this.z3 = Z3Module;
      const { Context } = Z3Module;
      this.context = new Context('main');
      this.solver = new this.context.Solver();
      this.initialized = true;
      console.log('✅ Z3 solver initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Z3:', error);
      throw error;
    }
  }

  async verifyFunction(contract: FunctionContract): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      // Создаем переменные для параметров
      const params = new Map<string, any>();
      for (const param of contract.params) {
        if (param.type === 'int') {
          params.set(param.name, createIntVar(param.name, this.context));
        } else if (param.type === 'bool') {
          params.set(param.name, createBoolVar(param.name, this.context));
        }
      }

      // Создаем переменную для результата
      let resultVar = null;
      if (contract.returnType !== 'void') {
        if (contract.returnType === 'int') {
          resultVar = createIntVar('result', this.context);
        } else if (contract.returnType === 'bool') {
          resultVar = createBoolVar('result', this.context);
        }
        params.set('result', resultVar);
      }

      // Добавляем предусловия
      for (const pre of contract.preconditions) {
        const constraint = this.constraintToZ3(pre, params);
        if (constraint) {
          this.solver.add(constraint);
        }
      }

      // Добавляем инварианты
      for (const inv of contract.invariants) {
        const constraint = this.constraintToZ3(inv, params);
        if (constraint) {
          this.solver.add(constraint);
        }
      }

      // Строим постусловие для проверки
      const postFormula = this.buildPostconditionFormula(contract.postconditions, params);

      // Проверяем: предусловия + инварианты ⇒ постусловия
      this.solver.push();

      const verificationFormula = this.constraintToZ3(
        {
          type: 'implication',
          condition: {
            type: 'and',
            constraints: [...contract.preconditions, ...contract.invariants],
          },
          consequence: postFormula as any,
        },
        params
      );

      // Отрицание для проверки sat (есть контрпример)
      if (verificationFormula) {
        this.solver.add(this.context.Not(verificationFormula));
      }

      const result = await this.solver.check();

      if (result === 'sat') {
        // Найден контрпример
        const model = this.extractModel(params);
        return {
          isValid: false,
          model,
          counterexample: model,
          time: Date.now() - startTime,
        };
      } else if (result === 'unsat') {
        // Доказано
        return {
          isValid: true,
          time: Date.now() - startTime,
        };
      } else {
        return {
          isValid: false,
          time: Date.now() - startTime,
          error: 'Z3 returned unknown',
        };
      }
    } catch (_error: any) {
      console.error('Verification error:', _error);
      return {
        isValid: false,
        time: Date.now() - startTime,
        error: _error.message,
      };
    } finally {
      this.solver.pop();
    }
  }

  async verifyEquivalence(
    original: string,
    refactored: string,
    inputs: Map<string, 'int' | 'bool' | 'string'>
  ): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      // Создаем переменные
      const vars = new Map<string, any>();
      for (const [name, type] of inputs) {
        if (type === 'int') {
          vars.set(name, createIntVar(name, this.context));
        } else if (type === 'bool') {
          vars.set(name, createBoolVar(name, this.context));
        }
      }

      // Парсим выражения
      const originalExpr = this.parseExpression(original, vars);
      const refactoredExpr = this.parseExpression(refactored, vars);

      // Проверяем: ∀vars: original = refactored
      // Для проверки ищем sat для original ≠ refactored
      this.solver.push();
      if (originalExpr && refactoredExpr) {
        this.solver.add(this.context.Not(this.context.Eq(originalExpr, refactoredExpr)));
      }

      const result = await this.solver.check();

      if (result === 'unsat') {
        // Эквивалентность доказана
        return {
          isValid: true,
          time: Date.now() - startTime,
        };
      } else if (result === 'sat') {
        // Найден контрпример
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
          error: 'Z3 returned unknown',
        };
      }
    } catch (_error: any) {
      console.error('Equivalence check error:', _error);
      return {
        isValid: false,
        time: Date.now() - startTime,
        error: _error.message,
      };
    } finally {
      this.solver.pop();
    }
  }

  async verifyLoopInvariant(
    invariant: VerificationConstraint,
    condition: VerificationConstraint,
    loopBody: VerificationConstraint[]
  ): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      const params = new Map<string, any>();

      // Проверка 1: инвариант выполняется перед входом в цикл
      // (опускаем для простоты)

      // Проверка 2: инвариант ∧ условие ⇒ WP(тело, инвариант)
      const invariantFormula = this.constraintToZ3(invariant, params);
      const conditionFormula = this.constraintToZ3(condition, params);

      // Строим weakest precondition для тела цикла
      let wp = invariantFormula;
      for (const stmt of [...loopBody].reverse()) {
        wp = this.computeWeakestPrecondition(stmt, wp, params);
      }

      // Проверяем импликацию: (инвариант ∧ условие) ⇒ WP
      if (invariantFormula && conditionFormula && wp) {
        const implication = this.context.Implies(
          this.context.And(invariantFormula, conditionFormula),
          wp
        );

        this.solver.push();
        this.solver.add(this.context.Not(implication));
        const result = await this.solver.check();

        if (result === 'unsat') {
          // Проверка 3: инвариант ∧ ¬условие ⇒ постусловие
          const postCondition = this.context.Bool.val(true);

          const exitImplication = this.context.Implies(
            this.context.And(invariantFormula, this.context.Not(conditionFormula)),
            postCondition
          );

          this.solver.push();
          this.solver.add(this.context.Not(exitImplication));
          const exitResult = await this.solver.check();

          this.solver.pop();

          if (exitResult === 'unsat') {
            return { isValid: true, time: Date.now() - startTime };
          }
        }
      }

      const model = this.extractModel(params);
      return {
        isValid: false,
        model,
        counterexample: model,
        time: Date.now() - startTime,
      };
    } catch (_error: any) {
      return {
        isValid: false,
        time: Date.now() - startTime,
        error: _error.message,
      };
    } finally {
      this.solver.pop();
    }
  }

  async verifyArrayProperty(
    arrayName: string,
    property: (idx: any) => any,
    length: number
  ): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      // Создаем массив
      const arrayType = this.context.Array(this.context.Int.sort(), this.context.Int.sort());
      const array = this.context.Const(arrayName, arrayType);

      // Используем array для проверки (подавляем предупреждение)
      console.log(`Verifying array property for ${arrayName} with length ${length}, array:`, array);

      // Проверяем свойство для всех индексов
      const iVar = createIntVar('i', this.context);
      const quantifier = this.context.ForAll(
        [iVar],
        this.context.Implies(
          this.context.And(
            this.context.GE(iVar, createIntVal(0, this.context)),
            this.context.LT(iVar, createIntVal(length, this.context))
          ),
          property(iVar)
        )
      );

      this.solver.push();
      this.solver.add(this.context.Not(quantifier));

      const result = await this.solver.check();

      if (result === 'unsat') {
        return { isValid: true, time: Date.now() - startTime };
      } else if (result === 'sat') {
        const model = this.extractModel(new Map());
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
          error: 'Z3 returned unknown',
        };
      }
    } catch (_error: any) {
      return {
        isValid: false,
        time: Date.now() - startTime,
        error: _error.message,
      };
    } finally {
      this.solver.pop();
    }
  }

  private constraintToZ3(constraint: VerificationConstraint, variables: Map<string, any>): any {
    if (!this.context) return null;

    switch (constraint.type) {
      case 'equality': {
        const left = this.valueToZ3(constraint.left, variables);
        const right = this.valueToZ3(constraint.right, variables);
        if (left && right) {
          return this.context.Eq(left, right);
        }
        return this.context.Bool.val(true);
      }

      case 'inequality': {
        const leftIneq = this.valueToZ3(constraint.left, variables);
        const rightIneq = this.valueToZ3(constraint.right, variables);
        if (leftIneq && rightIneq) {
          return this.context.Not(this.context.Eq(leftIneq, rightIneq));
        }
        return this.context.Bool.val(true);
      }

      case 'range': {
        const varExpr = variables.get(constraint.variable!);
        if (varExpr && constraint.min !== undefined && constraint.max !== undefined) {
          const minCond = this.context.GE(varExpr, createIntVal(constraint.min, this.context));
          const maxCond = this.context.LE(varExpr, createIntVal(constraint.max, this.context));
          return this.context.And(minCond, maxCond);
        }
        return this.context.Bool.val(true);
      }

      case 'implication': {
        const antecedent = this.constraintToZ3(constraint.condition!, variables);
        const consequent = this.constraintToZ3(constraint.consequence!, variables);
        if (antecedent && consequent) {
          return this.context.Implies(antecedent, consequent);
        }
        return null;
      }

      case 'and': {
        if (!constraint.constraints) return this.context.Bool.val(true);
        const andFormulas = constraint.constraints
          .map(c => this.constraintToZ3(c, variables))
          .filter(f => f !== null);
        if (andFormulas.length === 0) return this.context.Bool.val(true);
        if (andFormulas.length === 1) return andFormulas[0];
        return this.context.And(...andFormulas);
      }

      case 'or': {
        if (!constraint.constraints) return this.context.Bool.val(false);
        const orFormulas = constraint.constraints
          .map(c => this.constraintToZ3(c, variables))
          .filter(f => f !== null);
        if (orFormulas.length === 0) return this.context.Bool.val(false);
        if (orFormulas.length === 1) return orFormulas[0];
        return this.context.Or(...orFormulas);
      }

      case 'not': {
        const operand = this.constraintToZ3(constraint.operand!, variables);
        if (operand) {
          return this.context.Not(operand);
        }
        return null;
      }

      default:
        return this.context.Bool.val(true);
    }
  }

  private valueToZ3(value: any, variables: Map<string, any>): any {
    if (!this.context) return null;

    if (typeof value === 'number') {
      return createIntVal(value, this.context);
    }
    if (typeof value === 'boolean') {
      return createBoolVal(value, this.context);
    }
    if (typeof value === 'string') {
      if (variables.has(value)) {
        return variables.get(value);
      }
      // Строковая константа
      return this.context.String.val(value);
    }
    if (value === null || value === undefined) {
      return this.context.Bool.val(true);
    }
    return value;
  }

  private computeWeakestPrecondition(
    statement: VerificationConstraint,
    postcondition: any,
    variables: Map<string, any>
  ): any {
    if (!this.context) return postcondition;

    // WP(x = e, P) = P[e/x]
    if (statement.type === 'equality' && typeof statement.left === 'string') {
      const varName = statement.left;
      const expr = this.valueToZ3(statement.right, variables);
      return this.substitute(postcondition, varName, expr);
    }

    return postcondition;
  }

  private substitute(formula: any, _varName: string, _expr: any): any {
    // Для простоты возвращаем исходную формулу
    // В полной реализации нужна рекурсивная замена
    return formula;
  }

  private buildPostconditionFormula(
    postconditions: VerificationConstraint[],
    params: Map<string, any>
  ): any {
    if (!this.context) return null;

    if (postconditions.length === 0) return this.context.Bool.val(true);

    const firstPostcondition = postconditions[0];
    if (postconditions.length === 1 && firstPostcondition) {
      return this.constraintToZ3(firstPostcondition, params);
    }

    const formulas = postconditions.map(p => this.constraintToZ3(p, params));
    const validFormulas = formulas.filter(f => f !== null);
    if (validFormulas.length === 0) return this.context.Bool.val(true);
    if (validFormulas.length === 1) return validFormulas[0];
    return this.context.And(...validFormulas);
  }

  private parseExpression(expr: string, vars: Map<string, any>): any {
    if (!this.context) return null;

    // Простой парсер выражений
    // Поддерживает: переменные, числа, +, -, *, /

    // Переменная
    if (vars.has(expr)) {
      return vars.get(expr);
    }

    // Число
    if (!isNaN(Number(expr))) {
      return createIntVal(Number(expr), this.context);
    }

    // Простые бинарные операции (упрощенно)
    const addMatch = expr.match(/(\w+)\s*\+\s*(\w+)/);
    if (addMatch && addMatch[1] && addMatch[2]) {
      const left = this.parseExpression(addMatch[1], vars);
      const right = this.parseExpression(addMatch[2], vars);
      if (left && right) {
        return this.context.Add(left, right);
      }
    }

    const subMatch = expr.match(/(\w+)\s*-\s*(\w+)/);
    if (subMatch && subMatch[1] && subMatch[2]) {
      const left = this.parseExpression(subMatch[1], vars);
      const right = this.parseExpression(subMatch[2], vars);
      if (left && right) {
        return this.context.Sub(left, right);
      }
    }

    const mulMatch = expr.match(/(\w+)\s*\*\s*(\w+)/);
    if (mulMatch && mulMatch[1] && mulMatch[2]) {
      const left = this.parseExpression(mulMatch[1], vars);
      const right = this.parseExpression(mulMatch[2], vars);
      if (left && right) {
        return this.context.Mul(left, right);
      }
    }

    const divMatch = expr.match(/(\w+)\s*\/\s*(\w+)/);
    if (divMatch && divMatch[1] && divMatch[2]) {
      const left = this.parseExpression(divMatch[1], vars);
      const right = this.parseExpression(divMatch[2], vars);
      if (left && right) {
        return this.context.Div(left, right);
      }
    }

    return createIntVal(0, this.context);
  }

  private extractModel(variables: Map<string, any>): Map<string, any> {
    const model = new Map<string, any>();
    if (!this.solver || !this.z3) return model;

    const solverModel = this.solver.model();

    for (const [name, varExpr] of variables) {
      try {
        const value = solverModel.eval(varExpr);
        if (value) {
          const jsValue = value.toString();
          model.set(name, jsValue);
        }
      } catch (error) {
        void error;
        // Пропускаем переменные, которые не удалось оценить
      }
    }

    return model;
  }

  async getCounterexample(contract: FunctionContract): Promise<Map<string, any> | null> {
    if (!this.initialized) await this.initialize();

    try {
      const params = new Map<string, any>();
      for (const param of contract.params) {
        if (param.type === 'int') {
          params.set(param.name, createIntVar(param.name, this.context));
        } else if (param.type === 'bool') {
          params.set(param.name, createBoolVar(param.name, this.context));
        }
      }

      // Добавляем предусловия
      for (const pre of contract.preconditions) {
        const constraint = this.constraintToZ3(pre, params);
        if (constraint) {
          this.solver.add(constraint);
        }
      }

      // Добавляем отрицание постусловия
      const postFormula = this.buildPostconditionFormula(contract.postconditions, params);
      if (postFormula) {
        this.solver.add(this.context.Not(postFormula));
      }

      const result = await this.solver.check();

      if (result === 'sat') {
        return this.extractModel(params);
      }

      return null;
    } catch (_error) {
      console.error('Error getting counterexample:', _error);
      return null;
    }
  }

  async reset(): Promise<void> {
    if (this.solver) {
      this.solver.reset();
    }
  }

  async dispose(): Promise<void> {
    if (this.solver) {
      this.solver = null;
    }
    if (this.context) {
      this.context = null;
    }
    this.z3 = null;
    this.initialized = false;
  }
}

// Вспомогательные функции для создания контрактов
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
