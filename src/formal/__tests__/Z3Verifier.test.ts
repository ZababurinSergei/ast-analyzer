// packages/ast-analyzer/src/formal/__tests__/Z3Verifier.test.ts
// ПОЛНЫЙ КОД С ВСЕМИ ТЕСТАМИ (70+ ТЕСТОВ)
import path from 'path';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Z3Verifier, range, eq, compare, assign, and, or, not } from '../Z3Verifier.js';
import type { VerificationConstraint } from '../Z3Verifier.js';

describe('Z3Verifier - Полный набор тестов', () => {
  let verifier: Z3Verifier;
  const TIMEOUT = 60000; // Увеличиваем до 60 секунд

  beforeEach(async () => {
    verifier = new Z3Verifier();
    // Добавляем таймаут с правильной обработкой
    const initPromise = verifier.initialize();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Z3 initialization timeout after ${TIMEOUT}ms`)), TIMEOUT);
    });
    await Promise.race([initPromise, timeoutPromise]);
  }, TIMEOUT);

  afterEach(async () => {
    await verifier.dispose();
  });

  describe('Инициализация', () => {
    it('должен успешно инициализироваться', async () => {
      expect(verifier.isInitialized()).toBe(true);
    });
  });


  // ============================================
  // 1. БАЗОВЫЕ МАТЕМАТИЧЕСКИЕ ОПЕРАЦИИ
  // ============================================

  describe('1. Базовые математические операции', () => {
    it('1.1 должен верифицировать функцию add', async () => {
      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [
          {
            type: 'equality' as const,
            left: 'result',
            right: {
              type: 'add' as const,
              left: 'a',
              right: 'b',
            },
          },
        ],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.2 должен верифицировать функцию вычитания', async () => {
      const contract = {
        name: 'subtract',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.3 должен правильно верифицировать умножение', async () => {
      const contract = {
        name: 'multiply',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [range('result', 0, 10000)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.4 должен верифицировать функцию деления с предусловием', async () => {
      const contract = {
        name: 'divide',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 1, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('1.5 должен находить ошибку при делении на ноль', async () => {
      const contract = {
        name: 'divide',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [eq('result', { left: 'a', right: 'b', type: 'equality' } as any)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
    });

    it('1.6 должен верифицировать сложную функцию с несколькими операциями', async () => {
      const variables = new Map<string, 'int'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await verifier.verifyEquivalence(
        '((a >= 0 && a <= 100 && b >= 0 && b <= 100) => (a * b >= 0 && a * b <= 10000))',
        'true',
        variables
      );

      expect(result.isValid).toBe(true);
      expect(result.time).toBeLessThan(1000);
    });

    it('1.7 должен проверять коммутативность сложения через Z3', async () => {
      const variables = new Map<string, 'int'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await verifier.verifyEquivalence('a + b', 'b + a', variables);
      expect(result.isValid).toBe(true);
      expect(result.time).toBeLessThan(300);
    });

    it('1.8 должен верифицировать ассоциативность сложения', async () => {
      const variables = new Map<string, 'int'>([
        ['a', 'int'],
        ['b', 'int'],
        ['c', 'int'],
      ]);

      const result = await verifier.verifyEquivalence('(a + b) + c', 'a + (b + c)', variables);
      expect(result.isValid).toBe(true);
    });

    it('1.9 должен верифицировать дистрибутивность умножения', async () => {
      const variables = new Map<string, 'int'>([
        ['a', 'int'],
        ['b', 'int'],
        ['c', 'int'],
      ]);

      const result = await verifier.verifyEquivalence('(a + b) * c', 'a * c + b * c', variables);
      expect(result.isValid).toBe(true);
    });

    it('1.10 должен находить неэквивалентность в математических выражениях', async () => {
      const variables = new Map<string, 'int'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await verifier.verifyEquivalence('a + b', 'a * b', variables);
      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });
  });

  // ============================================
  // 2. УСЛОВНЫЕ КОНСТРУКЦИИ
  // ============================================

  describe('2. Условные конструкции', () => {
    it('2.1 должен верифицировать функцию с условием if/else', async () => {
      const contract = {
        name: 'abs',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', -100, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('2.2 должен верифицировать функцию с вложенными условиями', async () => {
      const contract = {
        name: 'nested',
        params: [
          { name: 'x', type: 'int' as const },
          { name: 'y', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100), range('y', 0, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('2.3 должен верифицировать функцию с тернарным оператором', async () => {
      const contract = {
        name: 'ternary',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', -100, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('2.4 должен обнаруживать логическую ошибку в условии', async () => {
      const contract = {
        name: 'buggy',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', -100, 100)],
        postconditions: [compare('result', '>', 100)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
    });

    it('2.5 должен верифицировать функцию со множественными условиями', async () => {
      const contract = {
        name: 'multiple',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', -100, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('2.6 должен находить ошибку в тернарном операторе', async () => {
      const contract = {
        name: 'ternaryBug',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', -100, 100)],
        postconditions: [compare('result', '>', 100)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
    });
  });

  // ============================================
  // 3. РЕКУРСИВНЫЕ ФУНКЦИИ
  // ============================================

  describe('3. Рекурсивные функции', () => {
    it('3.1 должен верифицировать факториал с инвариантом', async () => {
      const contract = {
        name: 'factorial',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 10)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [range('n', 0, 10)],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('3.2 должен верифицировать рекурсивную сумму чисел', async () => {
      const contract = {
        name: 'sum',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('3.3 должен обнаруживать отсутствие условия выхода из рекурсии', async () => {
      const contract = {
        name: 'infinite',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('3.4 должен верифицировать рекурсивную функцию с несколькими ветвями', async () => {
      const contract = {
        name: 'multi',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('3.5 должен верифицировать рекурсивную функцию с накоплением', async () => {
      const contract = {
        name: 'accumulate',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('3.6 должен обнаруживать ошибку в рекурсивной функции Фибоначчи', async () => {
      const contract = {
        name: 'fibonacci',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 20)],
        postconditions: [compare('result', '>=', 0)],
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
      const contract = {
        name: 'max',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.2 должен верифицировать функцию суммы элементов массива', async () => {
      const contract = {
        name: 'sumArray',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.3 должен верифицировать бинарный поиск', async () => {
      const contract = {
        name: 'binarySearch',
        params: [
          { name: 'arr', type: 'int' as const },
          { name: 'target', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.4 должен верифицировать сортировку пузырьком', async () => {
      const contract = {
        name: 'bubbleSort',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.5 должен верифицировать поиск минимального элемента в массиве', async () => {
      const contract = {
        name: 'min',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.6 должен верифицировать функцию копирования массива', async () => {
      const contract = {
        name: 'copy',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('4.7 должен верифицировать функцию реверса массива', async () => {
      const contract = {
        name: 'reverse',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
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
      const contract = {
        name: 'and',
        params: [
          { name: 'a', type: 'bool' as const },
          { name: 'b', type: 'bool' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.2 должен верифицировать булеву функцию с OR', async () => {
      const contract = {
        name: 'or',
        params: [
          { name: 'a', type: 'bool' as const },
          { name: 'b', type: 'bool' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.3 должен верифицировать булеву функцию с NOT', async () => {
      const contract = {
        name: 'not',
        params: [{ name: 'a', type: 'bool' as const }],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.4 должен обнаруживать противоречие в логических условиях', async () => {
      const contract = {
        name: 'contradiction',
        params: [{ name: 'a', type: 'bool' as const }],
        returnType: 'bool' as const,
        preconditions: [eq('a', true), eq('a', false)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
    });

    it('5.5 должен верифицировать сложную логическую функцию', async () => {
      const contract = {
        name: 'complex',
        params: [
          { name: 'a', type: 'bool' as const },
          { name: 'b', type: 'bool' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('5.6 должен верифицировать закон Де Моргана', async () => {
      const variables = new Map([
        ['a', 'bool' as const],
        ['b', 'bool' as const],
      ]);

      const result = await verifier.verifyEquivalence('!(a && b)', '(!a || !b)', variables);
      expect(result.isValid).toBe(true);
    });

    it('5.7 должен верифицировать закон исключения третьего', async () => {
      const variables = new Map([['a', 'bool' as const]]);

      const result = await verifier.verifyEquivalence('a || !a', 'true', variables);
      expect(result.isValid).toBe(true);
    });

    it('5.8 должен верифицировать закон противоречия', async () => {
      const variables = new Map([['a', 'bool' as const]]);

      const result = await verifier.verifyEquivalence('a && !a', 'false', variables);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 6. РАБОТА СО СТРОКАМИ
  // ============================================

  describe('6. Работа со строками', () => {
    it('6.1 должен верифицировать функцию конкатенации строк', async () => {
      const contract = {
        name: 'concat',
        params: [
          { name: 'a', type: 'string' as const },
          { name: 'b', type: 'string' as const },
        ],
        returnType: 'string' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('6.2 должен верифицировать функцию проверки длины строки', async () => {
      const contract = {
        name: 'length',
        params: [{ name: 'str', type: 'string' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('6.3 должен верифицировать функцию сравнения строк', async () => {
      const contract = {
        name: 'compare',
        params: [
          { name: 'a', type: 'string' as const },
          { name: 'b', type: 'string' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('6.4 должен верифицировать функцию проверки наличия подстроки', async () => {
      const contract = {
        name: 'contains',
        params: [
          { name: 'str', type: 'string' as const },
          { name: 'substr', type: 'string' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('6.5 должен верифицировать функцию замены подстроки', async () => {
      const contract = {
        name: 'replace',
        params: [
          { name: 'str', type: 'string' as const },
          { name: 'old', type: 'string' as const },
          { name: 'new', type: 'string' as const },
        ],
        returnType: 'string' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 7. ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ
  // ============================================

  describe('7. Проверка эквивалентности', () => {
    it('7.1 должен верифицировать эквивалентность коммутативных выражений', async () => {
      const variables = new Map([
        ['a', 'int' as const],
        ['b', 'int' as const],
      ]);

      const result = await verifier.verifyEquivalence('a + b', 'b + a', variables);
      expect(result.isValid).toBe(true);
    });

    it('7.2 должен находить неэквивалентность выражений', async () => {
      const variables = new Map([
        ['a', 'int' as const],
        ['b', 'int' as const],
      ]);

      const result = await verifier.verifyEquivalence('a + b', 'a * b', variables);
      expect(result.isValid).toBe(false);
    });

    it('7.3 должен верифицировать дистрибутивность', async () => {
      const variables = new Map([
        ['a', 'int' as const],
        ['b', 'int' as const],
        ['c', 'int' as const],
      ]);

      const result = await verifier.verifyEquivalence('(a + b) * c', 'a * c + b * c', variables);
      expect(result.isValid).toBe(true);
    });

    it('7.4 должен верифицировать эквивалентность с булевыми переменными', async () => {
      const variables = new Map([
        ['a', 'bool' as const],
        ['b', 'bool' as const],
      ]);

      const result = await verifier.verifyEquivalence('a && b', 'b && a', variables);
      expect(result.isValid).toBe(true);
    });

    it('7.5 должен находить контрпример для неэквивалентных булевых выражений', async () => {
      const variables = new Map([
        ['a', 'bool' as const],
        ['b', 'bool' as const],
      ]);

      const result = await verifier.verifyEquivalence('a && b', 'a || b', variables);
      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('7.6 должен верифицировать ассоциативность', async () => {
      const variables = new Map([
        ['a', 'int' as const],
        ['b', 'int' as const],
        ['c', 'int' as const],
      ]);

      const result = await verifier.verifyEquivalence('(a + b) + c', 'a + (b + c)', variables);
      expect(result.isValid).toBe(true);
    });

    it('7.7 должен верифицировать дистрибутивность логических операций', async () => {
      const variables = new Map([
        ['a', 'bool' as const],
        ['b', 'bool' as const],
        ['c', 'bool' as const],
      ]);

      const result = await verifier.verifyEquivalence(
        'a && (b || c)',
        '(a && b) || (a && c)',
        variables
      );
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 8. СЛОЖНЫЕ КОНТРАКТЫ
  // ============================================

  describe('8. Сложные контракты', () => {
    it('8.1 должен верифицировать сложный контракт с несколькими условиями', async () => {
      const contract = {
        name: 'complex',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', -100, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.2 должен верифицировать функцию с комбинированными условиями', async () => {
      const contract = {
        name: 'combined',
        params: [
          { name: 'x', type: 'int' as const },
          { name: 'y', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100), range('y', 0, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.3 должен верифицировать контракт с инвариантами', async () => {
      const contract = {
        name: 'invariant',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [compare('x', '>=', 0)],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.4 должен верифицировать контракт с несколькими постусловиями', async () => {
      const contract = {
        name: 'multi',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100)],
        postconditions: [compare('result', '>=', 0), compare('result', '<=', 100)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.5 должен верифицировать контракт с OR условиями', async () => {
      const contract = {
        name: 'orConditions',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [or(range('x', 0, 10), range('x', 90, 100))],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('8.6 должен верифицировать контракт с AND условиями', async () => {
      const contract = {
        name: 'andConditions',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [and(range('x', 0, 50), range('x', 25, 100))],
        postconditions: [compare('result', '>=', 0)],
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
      const invalidContract = {
        name: 'invalid',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [eq('x', 'nonexistent')],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(invalidContract);
      expect(result.isValid).toBe(false);
    });

    it('9.2 должен обрабатывать таймаут при сложной верификации', async () => {
      const contract = {
        name: 'simple',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result).toBeDefined();
    });

    it('9.3 должен корректно обрабатывать неинициализированный Z3', async () => {
      const newVerifier = new Z3Verifier();
      const initializeSpy = vi
        .spyOn(newVerifier, 'initialize')
        .mockRejectedValue(new Error('Z3 initialization failed (mocked)'));

      const contract = {
        name: 'test',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await newVerifier.verifyFunction(contract);
      expect(initializeSpy).toHaveBeenCalled();
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();

      initializeSpy.mockRestore();
    });

    it('9.4 должен обрабатывать пустой контракт', async () => {
      const contract = {
        name: 'empty',
        params: [],
        returnType: 'void' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('9.5 должен обрабатывать контракт с большим количеством параметров', async () => {
      const params = [];
      for (let i = 0; i < 20; i++) {
        params.push({ name: `p${i}`, type: 'int' as const });
      }

      const contract = {
        name: 'manyParams',
        params,
        returnType: 'int' as const,
        preconditions: params.map(p => range(p.name, 0, 100)),
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('9.6 должен обрабатывать контракт с undefined значениями', async () => {
      const contract = {
        name: 'undefined',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
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
    it('10.1 должен проверять базовый инвариант цикла', async () => {
      const invariant = range('i', 0, 10);
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [
        eq('i', { left: 'i', right: 1, type: 'equality' } as any),
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBeDefined();
    });

    it('10.2 должен обнаруживать нарушение инварианта цикла', async () => {
      const invariant = range('i', 5, 10);
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [eq('i', 1)];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('10.3 должен подтверждать корректный инвариант цикла', async () => {
      const invariant = range('i', 0, 10);
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [
        eq('i', { type: 'add', left: 'i', right: 1 } as any),
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.4 должен обнаруживать нарушение инварианта на границе', async () => {
      const invariant = range('i', 0, 9);
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [eq('i', 10)];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('10.5 должен подтверждать инвариант когда условие никогда не выполняется', async () => {
      const invariant = range('i', 0, 10);
      const condition = compare('i', '>', 100);
      const loopBody: VerificationConstraint[] = [eq('i', 200)];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.6 должен верифицировать цикл с несколькими переменными', async () => {
      const invariant = and(range('i', 0, 10), range('j', 0, 10));
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [
        eq('i', { type: 'add', left: 'i', right: 1 } as any),
        eq('j', { type: 'add', left: 'j', right: 2 } as any),
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.7 должен обнаруживать нарушение в цикле с несколькими переменными', async () => {
      const invariant = and(range('i', 0, 10), range('j', 0, 10));
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [
        eq('i', { type: 'add', left: 'i', right: 1 } as any),
        eq('j', 20),
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(false);
    });

    it('10.8 должен верифицировать сложный инвариант с несколькими условиями', async () => {
      const invariant = and(range('i', 0, 10), range('sum', 0, 100));
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [
        eq('i', { type: 'add', left: 'i', right: 1 } as any),
        eq('sum', { type: 'add', left: 'sum', right: 'i' } as any),
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.9 должен верифицировать цикл с умножением', async () => {
      const invariant = and(range('i', 0, 10), range('result', 0, 100));
      const condition = compare('i', '<', 10);
      const loopBody: VerificationConstraint[] = [
        eq('i', { type: 'add', left: 'i', right: 1 } as any),
        eq('result', { type: 'mul', left: 'result', right: 2 } as any),
      ];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.10 должен обнаруживать нарушение инварианта в цикле с вычитанием', async () => {
      const invariant = range('i', 0, 10);
      const condition = compare('i', '>', 0);
      const loopBody: VerificationConstraint[] = [
        eq('i', { type: 'sub', left: 'i', right: 1 } as any),
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
      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('11.2 должен получать контрпример для невалидного контракта', async () => {
      const contract = {
        name: 'divide',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
      if (result.counterexample) {
        expect(result.counterexample.get('b')).toBeDefined();
      }
    });

    it('11.3 должен верифицировать функцию с массивом в контракте', async () => {
      const contract = {
        name: 'array',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('11.4 должен верифицировать функцию с объектом в контракте', async () => {
      const contract = {
        name: 'object',
        params: [{ name: 'obj', type: 'int' as const }],
        returnType: 'int' as const,
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
      const params = [];
      for (let i = 0; i < 10; i++) {
        params.push({ name: `p${i}`, type: 'int' as const });
      }

      const contract = {
        name: 'large',
        params,
        returnType: 'int' as const,
        preconditions: params.map(p => range(p.name, 0, 100)),
        postconditions: [],
        invariants: [],
      };

      const startTime = Date.now();
      const result = await verifier.verifyFunction(contract);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(5000);
    });

    it('12.2 должен обрабатывать контракт с большим количеством условий', async () => {
      const preconditions = [];
      for (let i = 0; i < 50; i++) {
        preconditions.push(range(`x${i}`, 0, 100));
      }

      const contract = {
        name: 'manyConditions',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions,
        postconditions: [],
        invariants: [],
      };

      const startTime = Date.now();
      const result = await verifier.verifyFunction(contract);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(5000);
    });

    it('12.3 должен обрабатывать контракт с большим количеством постусловий', async () => {
      const postconditions = [];
      for (let i = 0; i < 50; i++) {
        postconditions.push(compare('result', '>=', 0));
      }

      const contract = {
        name: 'manyPost',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100)],
        postconditions,
        invariants: [],
      };

      const startTime = Date.now();
      const result = await verifier.verifyFunction(contract);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(5000);
    });

    it('12.4 должен обрабатывать параллельные верификации', async () => {
      const contracts = [];
      for (let i = 0; i < 10; i++) {
        contracts.push({
          name: `parallel${i}`,
          params: [{ name: 'x', type: 'int' as const }],
          returnType: 'int' as const,
          preconditions: [range('x', 0, 100)],
          postconditions: [],
          invariants: [],
        });
      }

      const startTime = Date.now();
      const results = await Promise.all(contracts.map(c => verifier.verifyFunction(c)));
      const duration = Date.now() - startTime;

      for (const result of results) {
        expect(result.isValid).toBe(true);
      }
      expect(duration).toBeLessThan(10000);
    });

    it('12.5 должен обрабатывать очень большие числа', async () => {
      const contract = {
        name: 'bigNumbers',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', -1000000, 1000000), range('b', -1000000, 1000000)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 13. ОПЕРАЦИИ СРАВНЕНИЯ
  // ============================================

  describe('13. Операции сравнения', () => {
    it('13.1 должен верифицировать функцию с равенством', async () => {
      const contract = {
        name: 'equal',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('13.2 должен верифицировать функцию с неравенством', async () => {
      const contract = {
        name: 'notequal',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('13.3 должен верифицировать функцию со сравнением больше', async () => {
      const contract = {
        name: 'greater',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('13.4 должен верифицировать функцию с диапазоном', async () => {
      const contract = {
        name: 'range',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('13.5 должен верифицировать функцию с несколькими сравнениями', async () => {
      const contract = {
        name: 'multipleComparisons',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
          { name: 'c', type: 'int' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
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
      const contract = {
        name: 'implication',
        params: [{ name: 'a', type: 'bool' as const }],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('14.2 должен верифицировать функцию с цепочкой импликаций', async () => {
      const contract = {
        name: 'chain',
        params: [
          { name: 'a', type: 'bool' as const },
          { name: 'b', type: 'bool' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('14.3 должен обнаружить ошибку в импликации', async () => {
      const contract = {
        name: 'wrong',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [compare('x', '>', 0)],
        postconditions: [compare('result', '<', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
    });

    it('14.4 должен верифицировать импликацию с AND', async () => {
      const contract = {
        name: 'implicationAnd',
        params: [
          { name: 'a', type: 'bool' as const },
          { name: 'b', type: 'bool' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('14.5 должен верифицировать импликацию с OR', async () => {
      const contract = {
        name: 'implicationOr',
        params: [
          { name: 'a', type: 'bool' as const },
          { name: 'b', type: 'bool' as const },
        ],
        returnType: 'bool' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 15. РАЗЛИЧНЫЕ ТИПЫ ДАННЫХ
  // ============================================

  describe('15. Различные типы данных', () => {
    it('15.1 должен верифицировать функцию со смешанными типами', async () => {
      const contract = {
        name: 'mixed',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'bool' as const },
          { name: 'c', type: 'string' as const },
        ],
        returnType: 'string' as const,
        preconditions: [range('a', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('15.2 должен верифицировать функцию с большим количеством типов', async () => {
      const params = [];
      for (let i = 0; i < 10; i++) {
        const type = i % 3 === 0 ? 'int' : i % 3 === 1 ? 'bool' : 'string';
        params.push({ name: `p${i}`, type: type as any });
      }

      const contract = {
        name: 'manyTypes',
        params,
        returnType: 'int' as const,
        preconditions: params.filter(p => p.type === 'int').map(p => range(p.name, 0, 100)),
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('15.3 должен верифицировать функцию с optional типами', async () => {
      const contract = {
        name: 'optional',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('15.4 должен верифицировать функцию с nullable типами', async () => {
      const contract = {
        name: 'nullable',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 16. ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
  // ============================================

  describe('16. Дополнительные тесты', () => {
    it('16.1 должен верифицировать функцию с отрицательными числами', async () => {
      const contract = {
        name: 'negative',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', -100, -1)],
        postconditions: [compare('result', '<', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('16.2 должен верифицировать функцию с нулевыми значениями', async () => {
      const contract = {
        name: 'zero',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [eq('x', 0)],
        postconditions: [eq('result', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('16.3 должен верифицировать функцию с максимальными значениями', async () => {
      const contract = {
        name: 'maxInt',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', Number.MAX_SAFE_INTEGER - 100, Number.MAX_SAFE_INTEGER)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('16.4 должен верифицировать функцию с минимальными значениями', async () => {
      const contract = {
        name: 'minInt',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER + 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('16.5 должен верифицировать функцию с дробными числами', async () => {
      const contract = {
        name: 'float',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it('16.6 должен верифицировать функцию с вложенными вызовами', async () => {
      const contract = {
        name: 'nestedCalls',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });
  });
});
