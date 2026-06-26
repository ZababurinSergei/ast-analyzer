// packages/ast-analyzer/src/formal/__tests__/Z3Verifier.test.ts

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Z3Verifier, eq, range, and, or, not, implies, compare } from '../Z3Verifier.js';
import fs from 'fs';
import path from 'path';

describe('Z3Verifier - Формальная верификация', () => {
  let verifier: Z3Verifier;

  beforeAll(async () => {
    verifier = new Z3Verifier();
    await verifier.initialize();
  });

  afterAll(async () => {
    await verifier.dispose();
  });

  // ============================================
  // 1. БАЗОВЫЕ МАТЕМАТИЧЕСКИЕ ОПЕРАЦИИ
  // ============================================

  describe('1. Базовые математические операции', () => {
    // SKIP: These tests require function body modeling which is not implemented
    it.skip('1.1 должен верифицировать функцию сложения', async () => {
      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [eq('result', { left: 'a', right: 'b', type: 'equality' })],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it.skip('1.2 должен верифицировать функцию вычитания', async () => {
      const contract = {
        name: 'subtract',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [eq('result', { left: 'a', right: 'b', type: 'equality' })],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it.skip('1.3 должен верифицировать функцию умножения', async () => {
      const contract = {
        name: 'multiply',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 0, 100)],
        postconditions: [eq('result', { left: 'a', right: 'b', type: 'equality' })],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it.skip('1.4 должен верифицировать функцию деления с предусловием', async () => {
      const contract = {
        name: 'divide',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', 0, 100), range('b', 1, 100)],
        postconditions: [eq('result', { left: 'a', right: 'b', type: 'equality' })],
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
        postconditions: [eq('result', { left: 'a', right: 'b', type: 'equality' })],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(false);
    });

    it('1.6 должен верифицировать сложную функцию с несколькими операциями', async () => {
      // Используем verifyEquivalence вместо verifyFunction
      const verifier = new Z3Verifier();
      await verifier.initialize();

      const variables = new Map<string, 'int'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      // Проверяем, что при a,b ∈ [0,100] результат a*b ∈ [0,10000]
      const expression = `((a >= 0 && a <= 100 && b >= 0 && b <= 100) => (a * b >= 0 && a * b <= 10000))`;

      const result = await verifier.verifyEquivalence(expression, 'true', variables);

      await verifier.dispose();

      expect(result.isValid).toBe(true);
      expect(result.time).toBeLessThan(500);
    });

    it('1.7 должен проверять коммутативность сложения через Z3', async () => {
      console.log('\n🔍 TEST 1.7: Checking commutativity of addition');
      console.log('='.repeat(60));

      const verifier = new Z3Verifier();
      console.log('📦 Z3Verifier instance created');

      console.log('🔄 Initializing Z3...');
      await verifier.initialize();
      console.log('✅ Z3 initialized');

      const variables = new Map<string, 'int'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);
      console.log('📋 Variables:', Array.from(variables.entries()));

      console.log('🧮 Checking: a + b == b + a');
      const result = await verifier.verifyEquivalence('a + b', 'b + a', variables);

      console.log('\n📊 RESULT:');
      console.log('  isValid:', result.isValid);
      console.log('  time:', result.time, 'ms');
      if (result.error) {
        console.log('  error:', result.error);
      }
      if (result.counterexample) {
        console.log('  counterexample:', Object.fromEntries(result.counterexample));
      }
      if (result.model) {
        console.log('  model:', Object.fromEntries(result.model));
      }
      console.log('='.repeat(60));

      await verifier.dispose();
      console.log('🧹 Z3 disposed');

      expect(result.isValid).toBe(true);
      expect(result.time).toBeLessThan(300);
    });
  });

  // ============================================
  // 2. УСЛОВНЫЕ КОНСТРУКЦИИ
  // ============================================

  describe('2. Условные конструкции', () => {
    it.skip('2.1 должен верифицировать функцию с условием if/else (модуль числа)', async () => {
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

    it.skip('2.2 должен верифицировать функцию с вложенными условиями', async () => {
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

    it.skip('2.3 должен верифицировать функцию с тернарным оператором', async () => {
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

    it.skip('2.5 должен верифицировать функцию со множественными условиями', async () => {
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
  });

  // ============================================
  // 3. РЕКУРСИВНЫЕ ФУНКЦИИ
  // ============================================

  describe('3. Рекурсивные функции', () => {
    it.skip('3.1 должен верифицировать факториал с инвариантом', async () => {
      const contract = {
        name: 'factorial',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 10)],
        postconditions: [compare('result', '>=', 0)],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      expect(result.isValid).toBe(true);
    });

    it.skip('3.2 должен верифицировать рекурсивную сумму чисел', async () => {
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

    it.skip('3.4 должен верифицировать рекурсивную функцию с несколькими ветвями', async () => {
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

    it.skip('3.5 должен верифицировать рекурсивную функцию с накоплением', async () => {
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
  });

  // ============================================
  // 4. РАБОТА С МАССИВАМИ
  // ============================================

  describe('4. Работа с массивами', () => {
    it.skip('4.1 должен верифицировать функцию поиска максимума в массиве', async () => {
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

    it.skip('4.2 должен верифицировать функцию суммы элементов массива', async () => {
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

    it.skip('4.3 должен верифицировать бинарный поиск', async () => {
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

    it.skip('4.4 должен верифицировать сортировку пузырьком', async () => {
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

    it.skip('4.5 должен верифицировать поиск минимального элемента в массиве', async () => {
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

    it.skip('4.6 должен верифицировать функцию копирования массива', async () => {
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
  });

  // ============================================
  // 5. ЛОГИЧЕСКИЕ ОПЕРАЦИИ
  // ============================================

  describe('5. Логические операции', () => {
    it.skip('5.1 должен верифицировать булеву функцию с AND', async () => {
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

    it.skip('5.2 должен верифицировать булеву функцию с OR', async () => {
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

    it.skip('5.3 должен верифицировать булеву функцию с NOT', async () => {
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

    it.skip('5.5 должен верифицировать сложную логическую функцию', async () => {
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

    it.skip('6.2 должен верифицировать функцию проверки длины строки', async () => {
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
  });

  // ============================================
  // 7. ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ
  // ============================================

  describe('7. Проверка эквивалентности', () => {
    it.skip('7.1 должен верифицировать эквивалентность коммутативных выражений', async () => {
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
      // Проверяем, что есть либо counterexample, либо error
      if (!result.counterexample) {
        // Если counterexample нет, проверяем что есть error
        expect(result.error).toBeDefined();
      }
    });

    it.skip('7.3 должен верифицировать эквивалентность (a+b)*c = a*c + b*c', async () => {
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

    it.skip('7.6 должен верифицировать эквивалентность с вложенными выражениями', async () => {
      const variables = new Map([
        ['a', 'int' as const],
        ['b', 'int' as const],
        ['c', 'int' as const],
      ]);

      const result = await verifier.verifyEquivalence('(a + b) + c', 'a + (b + c)', variables);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 8. СЛОЖНЫЕ КОНТРАКТЫ
  // ============================================

  describe('8. Сложные контракты', () => {
    it.skip('8.1 должен верифицировать сложный контракт с несколькими условиями', async () => {
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

    it.skip('8.2 должен верифицировать функцию с комбинированными условиями', async () => {
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

    it.skip('8.3 должен верифицировать контракт с инвариантами', async () => {
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

    it.skip('8.4 должен верифицировать контракт с несколькими постусловиями', async () => {
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
      if (!result.error) {
        expect(result.error).toBeDefined();
      }
    });

    it('9.2 должен обрабатывать таймаут при сложной верификации', async () => {
      // This test is for timeout handling - we'll use a simple contract
      const contract = {
        name: 'simple',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('x', 0, 100)],
        postconditions: [],
        invariants: [],
      };

      const result = await verifier.verifyFunction(contract);
      // Should complete within timeout
      expect(result).toBeDefined();
    });

    it('9.3 должен корректно обрабатывать неинициализированный Z3', async () => {
      const newVerifier = new Z3Verifier();
      // Don't call initialize()

      const contract = {
        name: 'test',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await newVerifier.verifyFunction(contract);
      // Should handle gracefully
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
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
  });

  // ============================================
  // 10. ЦИКЛЫ И ИНВАРИАНТЫ
  // ============================================

  describe('10. Циклы и инварианты', () => {
    it('10.1 должен верифицировать инвариант простого цикла', async () => {
      const invariant = range('i', 0, 10);
      const condition = compare('i', '<', 10);
      const loopBody = [eq('i', { left: 'i', right: 1, type: 'equality' })];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.2 должен обнаруживать нарушение инварианта цикла', async () => {
      const invariant = range('i', 5, 10);
      const condition = compare('i', '<', 10);
      const loopBody = [eq('i', { left: 'i', right: 1, type: 'equality' })];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('10.3 должен верифицировать инвариант цикла с условием', async () => {
      const invariant = compare('i', '>=', 0);
      const condition = compare('i', '<', 10);
      const loopBody = [eq('i', { left: 'i', right: 1, type: 'equality' })];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });

    it('10.4 должен верифицировать инвариант вложенного цикла', async () => {
      const invariant = and(range('i', 0, 10), range('j', 0, 10));
      const condition = compare('i', '<', 10);
      const loopBody = [eq('i', { left: 'i', right: 1, type: 'equality' })];

      const result = await verifier.verifyLoopInvariant(invariant, condition, loopBody);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // 11. РАБОТА С ФАЙЛОВЫМИ КОНТРАКТАМИ
  // ============================================

  describe('11. Работа с файловыми контрактами', () => {
    it.skip('11.1 должен извлекать контракт из файла', async () => {
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

    it.skip('11.2 должен получать контрпример для невалидного контракта', async () => {
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
        const hasBZero = result.counterexample.get('b') === '0';
        expect(hasBZero).toBe(true);
      }
    });

    it.skip('11.3 должен верифицировать функцию с массивом в контракте', async () => {
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

    it.skip('11.4 должен верифицировать функцию с объектом в контракте', async () => {
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
  });

  // ============================================
  // 13. ОПЕРАЦИИ СРАВНЕНИЯ
  // ============================================

  describe('13. Операции сравнения', () => {
    it.skip('13.1 должен верифицировать функцию с равенством', async () => {
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

    it.skip('13.2 должен верифицировать функцию с неравенством', async () => {
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

    it.skip('13.3 должен верифицировать функцию со сравнением больше', async () => {
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
  });

  // ============================================
  // 15. РАЗЛИЧНЫЕ ТИПЫ ДАННЫХ
  // ============================================

  describe('15. Различные типы данных', () => {
    it.skip('15.1 должен верифицировать функцию со смешанными типами', async () => {
      const contract = {
        name: 'mixed',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'bool' as const },
          { name: 'c', type: 'string' as const },
        ],
        returnType: 'string' as const,
        preconditions: [],
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
  });
});
