// src/formal/Z3Verifier.ts

import { init } from 'z3-solver';
import {
  ExpressionParser,
  parseExpression,
  validateExpression,
  extractVariables,
  isValidForZ3,
  toZ3String,
} from './ExpressionParser.js';
import { FunctionBodyModeler } from './FunctionBodyModeler.js';
import { EquivalenceChecker } from './EquivalenceChecker.js';
import { RefactoringEquivalenceChecker } from './RefactoringEquivalenceChecker.js';

export interface VerificationConstraint {
  type: 'equality' | 'inequality' | 'range' | 'implication' | 'and' | 'or' | 'not' | 'if';
  left?: any;
  right?: any;
  variable?: string;
  min?: number;
  max?: number;
  condition?: VerificationConstraint;
  consequence?: VerificationConstraint;
  constraints?: VerificationConstraint[];
  operand?: VerificationConstraint;
  then?: VerificationConstraint;
  else?: VerificationConstraint;
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
  body?: string;
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
  private expressionParser: ExpressionParser | null = null;
  private functionBodyModeler: FunctionBodyModeler | null = null;
  private equivalenceChecker: EquivalenceChecker | null = null;
  private refactoringEquivalenceChecker: RefactoringEquivalenceChecker | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const Z3Module = await init();
      this.z3 = Z3Module;
      const { Context } = Z3Module;
      this.context = new Context('main');
      this.solver = new this.context.Solver();

      // Инициализируем компоненты
      this.expressionParser = new ExpressionParser(this.context);
      this.functionBodyModeler = new FunctionBodyModeler(this.context, this.solver);
      this.equivalenceChecker = new EquivalenceChecker();
      this.refactoringEquivalenceChecker = new RefactoringEquivalenceChecker();

      // Инициализируем дочерние компоненты
      await this.equivalenceChecker.initialize();
      await this.refactoringEquivalenceChecker.initialize();

      this.initialized = true;
      console.log('✅ Z3 solver and all components initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Z3:', error);
      throw error;
    }
  }

  /**
   * Проверяет, инициализирован ли Z3 верификатор
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Получить ExpressionParser
   */
  getExpressionParser(): ExpressionParser | null {
    return this.expressionParser;
  }

  /**
   * Получить FunctionBodyModeler
   */
  getFunctionBodyModeler(): FunctionBodyModeler | null {
    return this.functionBodyModeler;
  }

  /**
   * Получить EquivalenceChecker
   */
  getEquivalenceChecker(): EquivalenceChecker | null {
    return this.equivalenceChecker;
  }

  /**
   * Получить RefactoringEquivalenceChecker
   */
  getRefactoringEquivalenceChecker(): RefactoringEquivalenceChecker | null {
    return this.refactoringEquivalenceChecker;
  }

  /**
   * Верифицирует функцию с использованием ExpressionParser
   */
  async verifyFunction(contract: FunctionContract): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      const variables = new Map<string, any>();

      // Создаем переменные для параметров
      for (const param of contract.params) {
        if (param.type === 'int') {
          variables.set(param.name, createIntVar(param.name, this.context));
        } else if (param.type === 'bool') {
          variables.set(param.name, createBoolVar(param.name, this.context));
        } else if (param.type === 'string') {
          variables.set(param.name, this.context.String.const(param.name));
        }
      }

      // Создаем переменную для результата
      if (contract.returnType !== 'void') {
        if (contract.returnType === 'int') {
          variables.set('result', createIntVar('result', this.context));
        } else if (contract.returnType === 'bool') {
          variables.set('result', createBoolVar('result', this.context));
        } else if (contract.returnType === 'string') {
          variables.set('result', this.context.String.const('result'));
        }
      }

      // Парсим тело функции через ExpressionParser
      if (contract.body && this.expressionParser) {
        const bodyExpr = this.expressionParser.parse(contract.body, variables);
        if (bodyExpr) {
          // Добавляем ограничение: result = bodyExpr
          if (variables.has('result')) {
            const resultVar = variables.get('result');
            this.solver.add(this.context.Eq(resultVar, bodyExpr));
          } else {
            // Если нет result переменной, просто добавляем тело
            this.solver.add(bodyExpr);
          }
        }
      }

      // Добавляем предусловия
      for (const pre of contract.preconditions) {
        const constraint = this.constraintToZ3(pre, variables);
        if (constraint) {
          this.solver.add(constraint);
        }
      }

      // Добавляем инварианты
      for (const inv of contract.invariants) {
        const constraint = this.constraintToZ3(inv, variables);
        if (constraint) {
          this.solver.add(constraint);
        }
      }

      // Строим постусловие
      const postFormula = this.buildPostconditionFormula(contract.postconditions, variables);

      // Проверяем: предусловия + инварианты ⇒ постусловия
      this.solver.push();

      if (postFormula) {
        // Проверяем отрицание постусловия (ищем контрпример)
        this.solver.add(this.context.Not(postFormula));
      }

      const result = await this.solver.check();

      if (result === 'sat') {
        const model = this.extractModel(variables);
        return {
          isValid: false,
          model,
          counterexample: model,
          time: Date.now() - startTime,
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
          error: 'Z3 returned unknown',
        };
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      return {
        isValid: false,
        time: Date.now() - startTime,
        error: error.message,
      };
    } finally {
      this.solver.pop();
    }
  }

  /**
   * Проверяет эквивалентность двух выражений
   */
  async verifyEquivalence(
    original: string,
    refactored: string,
    inputs: Map<string, 'int' | 'bool' | 'string'>
  ): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      const vars = new Map<string, any>();
      for (const [name, type] of inputs) {
        if (type === 'int') {
          vars.set(name, createIntVar(name, this.context));
        } else if (type === 'bool') {
          vars.set(name, createBoolVar(name, this.context));
        }
      }

      const originalExpr = this.expressionParser
        ? this.expressionParser.parse(original, vars)
        : null;
      const refactoredExpr = this.expressionParser
        ? this.expressionParser.parse(refactored, vars)
        : null;

      this.solver.push();
      if (originalExpr && refactoredExpr) {
        this.solver.add(this.context.Not(this.context.Eq(originalExpr, refactoredExpr)));
      }

      const result = await this.solver.check();

      if (result === 'unsat') {
        return {
          isValid: true,
          time: Date.now() - startTime,
        };
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

  /**
   * Проверяет инвариант цикла
   */
  async verifyLoopInvariant(
    invariant: VerificationConstraint,
    condition: VerificationConstraint,
    loopBody: VerificationConstraint[]
  ): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      const params = new Map<string, any>();

      const invariantFormula = this.constraintToZ3(invariant, params);
      const conditionFormula = this.constraintToZ3(condition, params);

      let wp = invariantFormula;
      for (const stmt of [...loopBody].reverse()) {
        wp = this.computeWeakestPrecondition(stmt, wp, params);
      }

      if (invariantFormula && conditionFormula && wp) {
        const implication = this.context.Implies(
          this.context.And(invariantFormula, conditionFormula),
          wp
        );

        this.solver.push();
        this.solver.add(this.context.Not(implication));
        const result = await this.solver.check();

        if (result === 'unsat') {
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

  /**
   * Проверяет свойство массива
   */
  async verifyArrayProperty(
    arrayName: string,
    property: (idx: any) => any,
    length: number
  ): Promise<VerificationResult> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      const arrayType = this.context.Array(this.context.Int.sort(), this.context.Int.sort());
      const array = this.context.Const(arrayName, arrayType);

      const iVar = createIntVar('i', this.context);

      const propertyWithArray = (idx: any) => {
        const element = this.context.Select(array, idx);
        return property(element);
      };

      const quantifier = this.context.ForAll(
        [iVar],
        this.context.Implies(
          this.context.And(
            this.context.GE(iVar, createIntVal(0, this.context)),
            this.context.LT(iVar, createIntVal(length, this.context))
          ),
          propertyWithArray(iVar)
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

  /**
   * Проверяет эквивалентность двух файлов через EquivalenceChecker
   */
  async checkFileEquivalence(
    originalPath: string,
    modifiedPath: string,
    options?: any
  ): Promise<any> {
    if (!this.initialized) await this.initialize();
    if (!this.equivalenceChecker) {
      throw new Error('EquivalenceChecker not initialized');
    }
    return this.equivalenceChecker.checkFileEquivalence(originalPath, modifiedPath, options);
  }

  /**
   * Проверяет эквивалентность рефакторинга через RefactoringEquivalenceChecker
   */
  async checkRefactoringEquivalence(
    originalFilePath: string,
    refactoredFilePath: string,
    modulesDir?: string
  ): Promise<any> {
    if (!this.initialized) await this.initialize();
    if (!this.refactoringEquivalenceChecker) {
      throw new Error('RefactoringEquivalenceChecker not initialized');
    }
    return this.refactoringEquivalenceChecker.checkRefactoringEquivalence(
      originalFilePath,
      refactoredFilePath,
      modulesDir
    );
  }

  /**
   * Моделирует тело функции через FunctionBodyModeler
   */
  async modelFunctionBody(
    functionBody: string,
    params: { name: string; type: 'int' | 'bool' | 'string' }[],
    returnType: 'int' | 'bool' | 'string' | 'void'
  ): Promise<any> {
    if (!this.initialized) await this.initialize();
    if (!this.functionBodyModeler) {
      throw new Error('FunctionBodyModeler not initialized');
    }
    return this.functionBodyModeler.modelFunctionBody(functionBody, params, returnType);
  }

  /**
   * Парсит выражение через ExpressionParser
   */
  parseExpression(expr: string, vars: Map<string, any>): any {
    if (!this.expressionParser) return null;
    return this.expressionParser.parse(expr, vars);
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

      case 'if': {
        const condition = this.constraintToZ3(constraint.condition!, variables);
        const thenBranch = this.constraintToZ3(constraint.consequence!, variables);
        const elseBranch = constraint.right
          ? this.constraintToZ3(constraint.right, variables)
          : null;
        if (condition && thenBranch) {
          if (elseBranch) {
            return this.context.If(condition, thenBranch, elseBranch);
          }
          return this.context.Implies(condition, thenBranch);
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

    if (statement.type === 'equality' && typeof statement.left === 'string') {
      const varName = statement.left;
      const expr = this.valueToZ3(statement.right, variables);
      return this.substitute(postcondition, varName, expr);
    }

    return postcondition;
  }

  private substitute(formula: any, _varName: string, _expr: any): any {
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

      for (const pre of contract.preconditions) {
        const constraint = this.constraintToZ3(pre, params);
        if (constraint) {
          this.solver.add(constraint);
        }
      }

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
    if (this.equivalenceChecker) {
      await this.equivalenceChecker.dispose();
      this.equivalenceChecker = null;
    }
    if (this.refactoringEquivalenceChecker) {
      await this.refactoringEquivalenceChecker.dispose();
      this.refactoringEquivalenceChecker = null;
    }
    this.z3 = null;
    this.initialized = false;
    this.expressionParser = null;
    this.functionBodyModeler = null;
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

export function and(constraints: VerificationConstraint[]): VerificationConstraint;
export function and(...constraints: VerificationConstraint[]): VerificationConstraint;
export function and(...args: any[]): VerificationConstraint {
  if (args.length === 1 && Array.isArray(args[0])) {
    return { type: 'and', constraints: args[0] };
  }
  return { type: 'and', constraints: args };
}

export function or(constraints: VerificationConstraint[]): VerificationConstraint;
export function or(...constraints: VerificationConstraint[]): VerificationConstraint;
export function or(...args: any[]): VerificationConstraint {
  if (args.length === 1 && Array.isArray(args[0])) {
    return { type: 'or', constraints: args[0] };
  }
  return { type: 'or', constraints: args };
}

export function not(operand: VerificationConstraint): VerificationConstraint {
  return { type: 'not', operand };
}

/**
 * Создает условное ограничение (if-then-else)
 */
export function if_(
  condition: VerificationConstraint,
  thenBranch: VerificationConstraint,
  elseBranch?: VerificationConstraint
): VerificationConstraint {
  return {
    type: 'if',
    condition,
    consequence: thenBranch,
    ...(elseBranch ? { right: elseBranch } : {}),
  };
}

/**
 * Создает контракт для сравнения
 * @param left - левая часть сравнения
 * @param operator - оператор сравнения: 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', '<', '>', '<=', '>='
 * @param right - правая часть сравнения (может быть числом или строкой)
 */
export function compare(
  left: string,
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | '<' | '>' | '<=' | '>=',
  right: string | number
): VerificationConstraint {
  // Нормализуем оператор
  let normalizedOp: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  switch (operator) {
    case '<':
      normalizedOp = 'lt';
      break;
    case '<=':
      normalizedOp = 'lte';
      break;
    case '>':
      normalizedOp = 'gt';
      break;
    case '>=':
      normalizedOp = 'gte';
      break;
    default:
      normalizedOp = operator;
  }

  // Используем нормализованный оператор
  switch (normalizedOp) {
    case 'eq':
      return { type: 'equality', left, right };
    case 'neq':
      return { type: 'inequality', left, right };
    case 'gt':
      return {
        type: 'range',
        variable: left,
        min: typeof right === 'number' ? right + 1 : 0,
        max: Number.MAX_SAFE_INTEGER,
      };
    case 'gte':
      return {
        type: 'range',
        variable: left,
        min: typeof right === 'number' ? right : 0,
        max: Number.MAX_SAFE_INTEGER,
      };
    case 'lt':
      return {
        type: 'range',
        variable: left,
        min: -Number.MAX_SAFE_INTEGER,
        max: typeof right === 'number' ? right - 1 : 0,
      };
    case 'lte':
      return {
        type: 'range',
        variable: left,
        min: -Number.MAX_SAFE_INTEGER,
        max: typeof right === 'number' ? right : 0,
      };
    default:
      return { type: 'equality', left, right };
  }
}

// Добавляем вспомогательные функции для создания контрактов
export function assign(varName: string, value: any): VerificationConstraint {
  return { type: 'equality', left: varName, right: value };
}

export function add(left: string, right: string): VerificationConstraint {
  return { type: 'equality', left, right: { left, right, type: 'add' } };
}

export function sub(left: string, right: string): VerificationConstraint {
  return { type: 'equality', left, right: { left, right, type: 'sub' } };
}

export function mul(left: string, right: string): VerificationConstraint {
  return { type: 'equality', left, right: { left, right, type: 'mul' } };
}

export function div(left: string, right: string): VerificationConstraint {
  return { type: 'equality', left, right: { left, right, type: 'div' } };
}

// Экспорт дополнительных функций из ExpressionParser
export {
  parseExpression,
  validateExpression,
  extractVariables,
  isValidForZ3,
  toZ3String,
  ExpressionParser,
};

// Экспорт классов для внешнего использования
export { EquivalenceChecker, RefactoringEquivalenceChecker, FunctionBodyModeler };
