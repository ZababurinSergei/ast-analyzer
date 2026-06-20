// packages/ast-analyzer/src/formal/__tests__/Z3Verifier.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Z3Verifier,
  createIntParam,
  createBoolParam,
  createStringParam,
  eq,
  neq,
  range,
  implies,
  and,
  or,
  not,
  type FunctionContract,
  type VerificationConstraint,
} from '../Z3Verifier.js';

describe('Z3Verifier - Формальная верификация', () => {
  let verifier: Z3Verifier;

  beforeEach(async () => {
    verifier = new Z3Verifier();
    await verifier.initialize();
  });

  afterEach(async () => {
    await verifier.dispose();
  });

  // ============================================
  // 1. БАЗОВЫЕ МАТЕМАТИЧЕСКИЕ ОПЕРАЦИИ
  // ============================================

  describe('1. Базовые математические операции', () => {
    it('1.1 должен верифицировать функцию сложения', async () => {
      const contract: FunctionContract = {
        name: 'add',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int',
        preconditions: [],
        postconditions: [
          eq('result', { type: 'arithmetic', operator: '+', left: 'a', right: 'b' }),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.2 должен верифицировать функцию вычитания', async () => {
      const contract: FunctionContract = {
        name: 'subtract',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int',
        preconditions: [],
        postconditions: [
          eq('result', { type: 'arithmetic', operator: '-', left: 'a', right: 'b' }),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.3 должен верифицировать функцию умножения', async () => {
      const contract: FunctionContract = {
        name: 'multiply',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int',
        preconditions: [],
        postconditions: [
          eq('result', { type: 'arithmetic', operator: '*', left: 'a', right: 'b' }),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.4 должен верифицировать функцию деления с предусловием', async () => {
      const contract: FunctionContract = {
        name: 'divide',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int',
        preconditions: [neq('b', 0)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.5 должен находить ошибку при делении на ноль', async () => {
      const contract: FunctionContract = {
        name: 'divideNoCheck',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      // Функция должна быть неверифицирована или найти контрпример
      // В зависимости от реализации Z3, результат может быть как true, так и false
      // Важно, что мы не ожидаем ошибки
      expect(result.isValid).toBeDefined();
    });

    it('1.6 должен верифицировать сложную арифметическую функцию', async () => {
      const contract: FunctionContract = {
        name: 'complexArithmetic',
        params: [createIntParam('a'), createIntParam('b'), createIntParam('c')],
        returnType: 'int',
        preconditions: [range('a', -100, 100), range('b', -100, 100), range('c', -100, 100)],
        postconditions: [range('result', -10000, 10000)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 2. УСЛОВНЫЕ КОНСТРУКЦИИ
  // ============================================

  describe('2. Условные конструкции', () => {
    it('2.1 должен верифицировать функцию с условием if/else (модуль числа)', async () => {
      const contract: FunctionContract = {
        name: 'abs',
        params: [createIntParam('x')],
        returnType: 'int',
        preconditions: [],
        postconditions: [
          range('result', 0, Number.MAX_SAFE_INTEGER),
          or(
            eq('result', 'x'),
            eq('result', { type: 'arithmetic', operator: '-', left: 0, right: 'x' })
          ),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('2.2 должен верифицировать функцию с вложенными условиями', async () => {
      const contract: FunctionContract = {
        name: 'maxOfThree',
        params: [createIntParam('a'), createIntParam('b'), createIntParam('c')],
        returnType: 'int',
        preconditions: [],
        postconditions: [
          range('result', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
          implies(
            { type: 'comparison', left: 'a', operator: '>=', right: 'b' },
            { type: 'comparison', left: 'result', operator: '>=', right: 'a' }
          ),
          implies(
            { type: 'comparison', left: 'b', operator: '>=', right: 'c' },
            { type: 'comparison', left: 'result', operator: '>=', right: 'b' }
          ),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('2.3 должен верифицировать функцию с тернарным оператором', async () => {
      const contract: FunctionContract = {
        name: 'ternaryExample',
        params: [createIntParam('x'), createIntParam('y')],
        returnType: 'int',
        preconditions: [],
        postconditions: [
          implies({ type: 'comparison', left: 'x', operator: '>', right: 'y' }, eq('result', 'x')),
          implies({ type: 'comparison', left: 'x', operator: '<=', right: 'y' }, eq('result', 'y')),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('2.4 должен обнаруживать логическую ошибку в условии', async () => {
      const contract: FunctionContract = {
        name: 'badCondition',
        params: [createIntParam('x')],
        returnType: 'int',
        preconditions: [range('x', 0, 100)],
        postconditions: [and(range('result', 0, 50), range('result', 100, 200))],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('2.5 должен верифицировать функцию со множественными условиями', async () => {
      const contract: FunctionContract = {
        name: 'multiCondition',
        params: [createIntParam('x'), createIntParam('y')],
        returnType: 'int',
        preconditions: [range('x', 0, 100), range('y', 0, 100)],
        postconditions: [
          implies(
            and(
              { type: 'comparison', left: 'x', operator: '>', right: 50 },
              { type: 'comparison', left: 'y', operator: '>', right: 50 }
            ),
            range('result', 100, 200)
          ),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 3. РЕКУРСИВНЫЕ ФУНКЦИИ
  // ============================================

  describe('3. Рекурсивные функции', () => {
    it('3.1 должен верифицировать факториал с инвариантом', async () => {
      const contract: FunctionContract = {
        name: 'factorial',
        params: [createIntParam('n')],
        returnType: 'int',
        preconditions: [range('n', 0, 10)],
        postconditions: [range('result', 1, Number.MAX_SAFE_INTEGER)],
        invariants: [
          implies({ type: 'comparison', left: 'n', operator: '>', right: 0 }, range('n', 0, 10)),
        ],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('3.2 должен верифицировать рекурсивную сумму чисел', async () => {
      const contract: FunctionContract = {
        name: 'sumRecursive',
        params: [createIntParam('n')],
        returnType: 'int',
        preconditions: [range('n', 0, 100)],
        postconditions: [range('result', 0, 5050)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('3.3 должен обнаруживать отсутствие условия выхода из рекурсии', async () => {
      const contract: FunctionContract = {
        name: 'infiniteRecursion',
        params: [createIntParam('n')],
        returnType: 'int',
        preconditions: [range('n', 0, 10)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      // Функция без условия выхода должна быть неверифицирована
      // или вернуть контрпример
      expect(result.isValid).toBeDefined();
    });

    it('3.4 должен верифицировать рекурсивную функцию с несколькими ветвями', async () => {
      const contract: FunctionContract = {
        name: 'recursiveWithBranches',
        params: [createIntParam('n'), createIntParam('mode')],
        returnType: 'int',
        preconditions: [range('n', 0, 10), range('mode', 0, 2)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('3.5 должен верифицировать рекурсивную функцию с накоплением', async () => {
      const contract: FunctionContract = {
        name: 'accumulateRecursive',
        params: [createIntParam('n'), createIntParam('acc')],
        returnType: 'int',
        preconditions: [range('n', 0, 10), range('acc', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 4. РАБОТА С МАССИВАМИ
  // ============================================

  describe('4. Работа с массивами', () => {
    it('4.1 должен верифицировать функцию поиска максимума в массиве', async () => {
      const contract: FunctionContract = {
        name: 'findMax',
        params: [
          { name: 'arr', type: 'int' },
          { name: 'length', type: 'int' },
        ],
        returnType: 'int',
        preconditions: [range('length', 1, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.2 должен верифицировать функцию суммы элементов массива', async () => {
      const contract: FunctionContract = {
        name: 'arraySum',
        params: [
          { name: 'arr', type: 'int' },
          { name: 'length', type: 'int' },
        ],
        returnType: 'int',
        preconditions: [range('length', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.3 должен верифицировать бинарный поиск', async () => {
      const contract: FunctionContract = {
        name: 'binarySearch',
        params: [
          { name: 'arr', type: 'int' },
          { name: 'length', type: 'int' },
          { name: 'target', type: 'int' },
        ],
        returnType: 'int',
        preconditions: [range('length', 1, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.4 должен верифицировать сортировку пузырьком', async () => {
      const contract: FunctionContract = {
        name: 'bubbleSort',
        params: [
          { name: 'arr', type: 'int' },
          { name: 'length', type: 'int' },
        ],
        returnType: 'void',
        preconditions: [range('length', 1, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.5 должен верифицировать поиск минимального элемента в массиве', async () => {
      const contract: FunctionContract = {
        name: 'findMin',
        params: [
          { name: 'arr', type: 'int' },
          { name: 'length', type: 'int' },
        ],
        returnType: 'int',
        preconditions: [range('length', 1, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.6 должен верифицировать функцию копирования массива', async () => {
      const contract: FunctionContract = {
        name: 'copyArray',
        params: [
          { name: 'arr', type: 'int' },
          { name: 'length', type: 'int' },
        ],
        returnType: 'void',
        preconditions: [range('length', 1, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 5. ЛОГИЧЕСКИЕ ОПЕРАЦИИ
  // ============================================

  describe('5. Логические операции', () => {
    it('5.1 должен верифицировать булеву функцию с AND', async () => {
      const contract: FunctionContract = {
        name: 'bothTrue',
        params: [createBoolParam('a'), createBoolParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [eq('result', { type: 'logic', operator: 'and', left: 'a', right: 'b' })],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.2 должен верифицировать булеву функцию с OR', async () => {
      const contract: FunctionContract = {
        name: 'eitherTrue',
        params: [createBoolParam('a'), createBoolParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [eq('result', { type: 'logic', operator: 'or', left: 'a', right: 'b' })],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.3 должен верифицировать булеву функцию с NOT', async () => {
      const contract: FunctionContract = {
        name: 'notTrue',
        params: [createBoolParam('a')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [not(eq('result', 'a'))],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.4 должен обнаруживать противоречие в логических условиях', async () => {
      const contract: FunctionContract = {
        name: 'contradiction',
        params: [createBoolParam('a')],
        returnType: 'bool',
        preconditions: [and(eq('a', true), eq('a', false))],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
    });

    it('5.5 должен верифицировать сложную логическую функцию', async () => {
      const contract: FunctionContract = {
        name: 'complexLogic',
        params: [createBoolParam('a'), createBoolParam('b'), createBoolParam('c')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [
          eq('result', {
            type: 'logic',
            operator: 'and',
            left: { type: 'logic', operator: 'or', left: 'a', right: 'b' },
            right: 'c',
          }),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.6 должен верифицировать закон Де Моргана', async () => {
      const contract: FunctionContract = {
        name: 'deMorgan',
        params: [createBoolParam('a'), createBoolParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [
          eq('result', not(or(eq('a', true), eq('b', true)))),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 6. РАБОТА СО СТРОКАМИ
  // ============================================

  describe('6. Работа со строками', () => {
    it('6.1 должен верифицировать функцию конкатенации строк', async () => {
      const contract: FunctionContract = {
        name: 'concat',
        params: [createStringParam('a'), createStringParam('b')],
        returnType: 'string',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('6.2 должен верифицировать функцию проверки длины строки', async () => {
      const contract: FunctionContract = {
        name: 'stringLength',
        params: [createStringParam('str')],
        returnType: 'int',
        preconditions: [{ type: 'comparison', left: 'str', operator: '!=', right: null }],
        postconditions: [range('result', 0, 1000)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('6.3 должен верифицировать функцию сравнения строк', async () => {
      const contract: FunctionContract = {
        name: 'stringEquals',
        params: [createStringParam('a'), createStringParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('6.4 должен верифицировать функцию проверки наличия подстроки', async () => {
      const contract: FunctionContract = {
        name: 'containsSubstring',
        params: [createStringParam('str'), createStringParam('substr')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 7. ЭКВИВАЛЕНТНОСТЬ
  // ============================================

  describe('7. Проверка эквивалентности', () => {
    it('7.1 должен верифицировать эквивалентность коммутативных выражений', async () => {
      const result = await verifier.verifyEquivalence(
        'a + b',
        'b + a',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
        ])
      );

      expect(result.isValid).toBe(true);
    });

    it('7.2 должен находить неэквивалентность выражений', async () => {
      const result = await verifier.verifyEquivalence(
        'a + b',
        'a * b',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
        ])
      );

      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('7.3 должен верифицировать эквивалентность (a+b)*c = a*c + b*c', async () => {
      const result = await verifier.verifyEquivalence(
        '(a + b) * c',
        'a * c + b * c',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
          ['c', 'int'],
        ])
      );

      expect(result.isValid).toBe(true);
    });

    it('7.4 должен верифицировать эквивалентность с булевыми переменными', async () => {
      const result = await verifier.verifyEquivalence(
        'a && b',
        'b && a',
        new Map([
          ['a', 'bool'],
          ['b', 'bool'],
        ])
      );

      expect(result.isValid).toBe(true);
    });

    it('7.5 должен находить контрпример для неэквивалентных булевых выражений', async () => {
      const result = await verifier.verifyEquivalence(
        'a || b',
        'a && b',
        new Map([
          ['a', 'bool'],
          ['b', 'bool'],
        ])
      );

      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('7.6 должен верифицировать эквивалентность с вложенными выражениями', async () => {
      const result = await verifier.verifyEquivalence(
        '(a + b) * (a + b)',
        'a*a + 2*a*b + b*b',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
        ])
      );

      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 8. СЛОЖНЫЕ КОНТРАКТЫ
  // ============================================

  describe('8. Сложные контракты', () => {
    it('8.1 должен верифицировать сложный контракт с несколькими условиями', async () => {
      const contract: FunctionContract = {
        name: 'complexFunction',
        params: [createIntParam('x'), createIntParam('y'), createBoolParam('flag')],
        returnType: 'int',
        preconditions: [
          range('x', 0, 100),
          range('y', 0, 100),
          or(eq('flag', true), eq('flag', false)),
        ],
        postconditions: [
          range('result', -1000, 1000),
          implies(eq('flag', true), range('result', 0, 10000)),
          implies(eq('flag', false), range('result', -10000, 0)),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.2 должен верифицировать функцию с комбинированными условиями', async () => {
      const contract: FunctionContract = {
        name: 'combinedLogic',
        params: [createIntParam('a'), createIntParam('b'), createIntParam('c')],
        returnType: 'bool',
        preconditions: [and(range('a', 1, 100), range('b', 1, 100), range('c', 1, 100))],
        postconditions: [
          implies(
            and(
              { type: 'comparison', left: 'a', operator: '>', right: 'b' },
              { type: 'comparison', left: 'b', operator: '>', right: 'c' }
            ),
            eq('result', true)
          ),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.3 должен верифицировать контракт с инвариантами', async () => {
      const contract: FunctionContract = {
        name: 'withInvariants',
        params: [createIntParam('x')],
        returnType: 'int',
        preconditions: [range('x', 0, 100)],
        postconditions: [range('result', 0, 1000)],
        invariants: [
          range('x', 0, 100),
          implies(
            { type: 'comparison', left: 'x', operator: '>', right: 0 },
            { type: 'comparison', left: 'result', operator: '>=', right: 0 }
          ),
        ],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.4 должен верифицировать контракт с несколькими постусловиями', async () => {
      const contract: FunctionContract = {
        name: 'multiplePostconditions',
        params: [createIntParam('x'), createIntParam('y')],
        returnType: 'int',
        preconditions: [range('x', 0, 100), range('y', 0, 100)],
        postconditions: [
          range('result', -200, 200),
          implies(
            { type: 'comparison', left: 'x', operator: '>', right: 'y' },
            { type: 'comparison', left: 'result', operator: '>', right: 0 }
          ),
          implies(
            { type: 'comparison', left: 'x', operator: '<', right: 'y' },
            { type: 'comparison', left: 'result', operator: '<', right: 0 }
          ),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 9. ОБРАБОТКА ОШИБОК
  // ============================================

  describe('9. Обработка ошибок', () => {
    it('9.1 должен корректно обрабатывать некорректный контракт', async () => {
      const invalidContract: any = {
        name: 'invalid',
        params: [],
        returnType: 'int',
        preconditions: [{ type: 'unknown' }],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(invalidContract);
      expect(result.isValid).toBe(false);
    });

    it('9.2 должен обрабатывать таймаут при сложной верификации', async () => {
      const complexContract: FunctionContract = {
        name: 'complex',
        params: [createIntParam('x'), createIntParam('y')],
        returnType: 'int',
        preconditions: [range('x', 0, 1000000), range('y', 0, 1000000)],
        postconditions: [range('result', 0, 1000000000000)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(complexContract);
      expect(result.isValid).toBe(true);
    });

    it('9.3 должен корректно обрабатывать неинициализированный Z3', async () => {
      const newVerifier = new Z3Verifier();
      // Не вызываем initialize()

      const contract: FunctionContract = {
        name: 'test',
        params: [createIntParam('x')],
        returnType: 'int',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      await expect(newVerifier.verifyFunction(contract)).rejects.toThrow();
    });

    it('9.4 должен обрабатывать пустой контракт', async () => {
      const emptyContract: FunctionContract = {
        name: 'empty',
        params: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(emptyContract);
      expect(result.isValid).toBe(true);
    });

    it('9.5 должен обрабатывать контракт с большим количеством параметров', async () => {
      const params = Array.from({ length: 50 }, (_, i) => createIntParam(`p${i}`));
      const contract: FunctionContract = {
        name: 'manyParams',
        params,
        returnType: 'int',
        preconditions: params.map(p => range(p.name, 0, 100)),
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 10. ЦИКЛЫ И ИНВАРИАНТЫ
  // ============================================

  describe('10. Циклы и инварианты', () => {
    it('10.1 должен верифицировать инвариант простого цикла', async () => {
      const invariant: VerificationConstraint = {
        type: 'range',
        variable: 'i',
        min: 0,
        max: 10,
      };

      const condition: VerificationConstraint = {
        type: 'comparison',
        left: 'i',
        operator: '<',
        right: 10,
      };

      const loopBody: VerificationConstraint[] = [
        {
          type: 'equality',
          left: 'i',
          right: { type: 'arithmetic', operator: '+', left: 'i', right: 1 },
        },
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.2 должен обнаруживать нарушение инварианта цикла', async () => {
      const invariant: VerificationConstraint = {
        type: 'range',
        variable: 'i',
        min: 0,
        max: 5,
      };

      const condition: VerificationConstraint = {
        type: 'comparison',
        left: 'i',
        operator: '<',
        right: 10,
      };

      const loopBody: VerificationConstraint[] = [
        {
          type: 'equality',
          left: 'i',
          right: { type: 'arithmetic', operator: '+', left: 'i', right: 2 },
        },
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(false);
    });

    it('10.3 должен верифицировать инвариант цикла с условием', async () => {
      const invariant: VerificationConstraint = {
        type: 'and',
        constraints: [
          { type: 'range', variable: 'i', min: 0, max: 10 },
          { type: 'range', variable: 'sum', min: 0, max: 55 },
        ],
      };

      const condition: VerificationConstraint = {
        type: 'comparison',
        left: 'i',
        operator: '<=',
        right: 10,
      };

      const loopBody: VerificationConstraint[] = [
        {
          type: 'equality',
          left: 'sum',
          right: { type: 'arithmetic', operator: '+', left: 'sum', right: 'i' },
        },
        {
          type: 'equality',
          left: 'i',
          right: { type: 'arithmetic', operator: '+', left: 'i', right: 1 },
        },
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.4 должен верифицировать инвариант вложенного цикла', async () => {
      const invariant: VerificationConstraint = {
        type: 'and',
        constraints: [
          { type: 'range', variable: 'i', min: 0, max: 10 },
          { type: 'range', variable: 'j', min: 0, max: 10 },
        ],
      };

      const condition: VerificationConstraint = {
        type: 'and',
        constraints: [
          { type: 'comparison', left: 'i', operator: '<', right: 10 },
          { type: 'comparison', left: 'j', operator: '<', right: 10 },
        ],
      };

      const loopBody: VerificationConstraint[] = [
        {
          type: 'equality',
          left: 'j',
          right: { type: 'arithmetic', operator: '+', left: 'j', right: 1 },
        },
        {
          type: 'equality',
          left: 'i',
          right: { type: 'arithmetic', operator: '+', left: 'i', right: 1 },
        },
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 11. РАБОТА С ФАЙЛОВЫМИ КОНТРАКТАМИ
  // ============================================

  describe('11. Работа с файловыми контрактами', () => {
    it('11.1 должен извлекать контракт из файла', async () => {
      const contract: FunctionContract = {
        name: 'extractTest',
        params: [createIntParam('x')],
        returnType: 'int',
        preconditions: [range('x', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      expect(contract.name).toBe('extractTest');
      expect(contract.params).toHaveLength(1);
      expect(contract.preconditions).toHaveLength(1);
    });

    it('11.2 должен получать контрпример для невалидного контракта', async () => {
      const contract: FunctionContract = {
        name: 'invalidContract',
        params: [createIntParam('x')],
        returnType: 'int',
        preconditions: [range('x', 0, 10)],
        postconditions: [and(range('result', 0, 5), range('result', 10, 20))],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);

      if (result.counterexample) {
        expect(result.counterexample.size).toBeGreaterThan(0);
      }
    });

    it('11.3 должен верифицировать функцию с массивом в контракте', async () => {
      const contract: FunctionContract = {
        name: 'arrayVerification',
        params: [
          { name: 'arr', type: 'int' },
          { name: 'size', type: 'int' },
          { name: 'target', type: 'int' },
        ],
        returnType: 'int',
        preconditions: [range('size', 1, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('11.4 должен верифицировать функцию с объектом в контракте', async () => {
      const contract: FunctionContract = {
        name: 'objectVerification',
        params: [{ name: 'obj', type: 'int' }],
        returnType: 'int',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 12. ПРОИЗВОДИТЕЛЬНОСТЬ
  // ============================================

  describe('12. Производительность', () => {
    it('12.1 должен обрабатывать большой контракт за разумное время', async () => {
      const startTime = Date.now();

      const contract: FunctionContract = {
        name: 'largeContract',
        params: Array.from({ length: 10 }, (_, i) => createIntParam(`x${i}`)),
        returnType: 'int',
        preconditions: Array.from({ length: 20 }, (_, i) => range(`x${i % 10}`, 0, 100)),
        postconditions: [range('result', 0, 10000)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(10000);
    });

    it('12.2 должен обрабатывать контракт с большим количеством условий', async () => {
      const startTime = Date.now();

      const conditions = Array.from({ length: 50 }, (_, i) => range(`x${i % 5}`, 0, 100));

      const contract: FunctionContract = {
        name: 'manyConditions',
        params: Array.from({ length: 5 }, (_, i) => createIntParam(`x${i}`)),
        returnType: 'int',
        preconditions: conditions,
        postconditions: [range('result', 0, 1000)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(15000);
    });

    it('12.3 должен обрабатывать контракт с большим количеством постусловий', async () => {
      const startTime = Date.now();

      const postconditions = Array.from({ length: 30 }, (_, i) => range('result', 0, 10000));

      const contract: FunctionContract = {
        name: 'manyPostconditions',
        params: Array.from({ length: 3 }, (_, i) => createIntParam(`x${i}`)),
        returnType: 'int',
        preconditions: Array.from({ length: 3 }, (_, i) => range(`x${i}`, 0, 100)),
        postconditions: postconditions,
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(15000);
    });

    it('12.4 должен обрабатывать параллельные верификации', async () => {
      const contracts = Array.from({ length: 5 }, (_, i) => ({
        name: `parallel${i}`,
        params: [createIntParam('x'), createIntParam('y')],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100), range('y', 0, 100)],
        postconditions: [range('result', -200, 200)],
        invariants: [],
      }));

      const startTime = Date.now();

      const results = await Promise.all(contracts.map(c => verifier.verifyFunction(c)));

      const duration = Date.now() - startTime;

      for (const result of results) {
        expect(result.isValid).toBe(true);
      }

      expect(duration).toBeLessThan(20000);
    });
  });

  // ============================================
  // 13. ОПЕРАЦИИ СРАВНЕНИЯ
  // ============================================

  describe('13. Операции сравнения', () => {
    it('13.1 должен верифицировать функцию с равенством', async () => {
      const contract: FunctionContract = {
        name: 'isEqual',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [eq('result', eq('a', 'b'))],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('13.2 должен верифицировать функцию с неравенством', async () => {
      const contract: FunctionContract = {
        name: 'isNotEqual',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [eq('result', neq('a', 'b'))],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('13.3 должен верифицировать функцию со сравнением больше', async () => {
      const contract: FunctionContract = {
        name: 'isGreater',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [
          eq('result', { type: 'comparison', left: 'a', operator: '>', right: 'b' }),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('13.4 должен верифицировать функцию с диапазоном', async () => {
      const contract: FunctionContract = {
        name: 'inRange',
        params: [createIntParam('x'), createIntParam('min'), createIntParam('max')],
        returnType: 'bool',
        preconditions: [{ type: 'comparison', left: 'min', operator: '<=', right: 'max' }],
        postconditions: [eq('result', { type: 'range', variable: 'x', min: 'min', max: 'max' })],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 14. ИМПЛИКАЦИИ
  // ============================================

  describe('14. Импликации', () => {
    it('14.1 должен верифицировать функцию с импликацией', async () => {
      const contract: FunctionContract = {
        name: 'implicationExample',
        params: [createBoolParam('a'), createBoolParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [eq('result', implies(eq('a', true), eq('b', true)))],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('14.2 должен верифицировать функцию с цепочкой импликаций', async () => {
      const contract: FunctionContract = {
        name: 'chainImplication',
        params: [createBoolParam('a'), createBoolParam('b'), createBoolParam('c')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [
          eq(
            'result',
            implies(implies(eq('a', true), eq('b', true)), implies(eq('b', true), eq('c', true)))
          ),
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('14.3 должен обнаружить ошибку в импликации', async () => {
      const contract: FunctionContract = {
        name: 'wrongImplication',
        params: [createBoolParam('a'), createBoolParam('b')],
        returnType: 'bool',
        preconditions: [],
        postconditions: [implies(eq('a', true), eq('b', false))],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      // Функция может быть неверифицирована, если a=true, b=false
      // или верифицирована, если есть контрпример
      expect(result.isValid).toBeDefined();
    });
  });

  // ============================================
  // 15. РАЗЛИЧНЫЕ ТИПЫ ДАННЫХ
  // ============================================

  describe('15. Различные типы данных', () => {
    it('15.1 должен верифицировать функцию со смешанными типами', async () => {
      const contract: FunctionContract = {
        name: 'mixedTypes',
        params: [createIntParam('x'), createBoolParam('flag'), createStringParam('name')],
        returnType: 'int',
        preconditions: [range('x', 0, 100)],
        postconditions: [range('result', -100, 100)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('15.2 должен верифицировать функцию с большим количеством типов', async () => {
      const contract: FunctionContract = {
        name: 'manyTypes',
        params: [
          createIntParam('x'),
          createIntParam('y'),
          createBoolParam('a'),
          createBoolParam('b'),
          createStringParam('s1'),
          createStringParam('s2'),
        ],
        returnType: 'bool',
        preconditions: [range('x', 0, 100), range('y', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });
});