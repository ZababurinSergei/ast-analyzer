// packages/ast-analyzer/src/formal/__tests__/RefactoringEquivalenceChecker.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RefactoringEquivalenceChecker } from '../RefactoringEquivalenceChecker.js';
import { Z3Verifier } from '../Z3Verifier.js';

describe('RefactoringEquivalenceChecker - Формальная проверка эквивалентности', () => {
  let checker: RefactoringEquivalenceChecker;
  let verifier: Z3Verifier;
  const testDir = path.join(process.cwd(), 'test-temp-equivalence-checker');
  const originalDir = path.join(testDir, 'original');
  const refactoredDir = path.join(testDir, 'refactored');

  beforeEach(async () => {
    checker = new RefactoringEquivalenceChecker();
    verifier = new Z3Verifier();
    await checker.initialize();
    await verifier.initialize();

    // Создаем директории
    [testDir, originalDir, refactoredDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterEach(async () => {
    await verifier.dispose();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ============================================
  // 1. МАТЕМАТИЧЕСКИЕ ОПЕРАЦИИ
  // ============================================

  describe('1. Математические операции', () => {
    it('1.1 должен подтвердить эквивалентность сложения', async () => {
      const originalContent = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;

      const refactoredContent = `
        import { add } from './modules/addition.js';
        import { multiply } from './modules/multiplication.js';
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { calculate };
        export { add, multiply } from './modules/addition.js';
        export { multiply } from './modules/multiplication.js';
      `;

      const originalFile = path.join(originalDir, 'math.js');
      const refactoredFile = path.join(refactoredDir, 'math.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'addition.js'),
        'export function add(a, b) { return a + b; }'
      );
      fs.writeFileSync(
        path.join(modulesDir, 'multiplication.js'),
        'export function multiply(a, b) { return a * b; }'
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
      expect(result.verifiedFunctions).toBe(3);
      expect(result.failedFunctions).toHaveLength(0);
    });

    it('1.2 должен обнаружить неэквивалентность при изменении логики умножения', async () => {
      const originalContent = `
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return multiply(a, b); }
        export { multiply, calculate };
      `;

      const refactoredContent = `
        import { multiply } from './modules/multiplication.js';
        function calculate(a, b) { return multiply(a, b); }
        export { calculate };
        export { multiply } from './modules/multiplication.js';
      `;

      const originalFile = path.join(originalDir, 'math-error.js');
      const refactoredFile = path.join(refactoredDir, 'math-error.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Некорректный рефакторинг: умножение изменено на сложение
      fs.writeFileSync(
        path.join(modulesDir, 'multiplication.js'),
        'export function multiply(a, b) { return a + b; }'
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
      expect(result.verificationDetails.some(d => !d.isEquivalent)).toBe(true);
    });

    it('1.3 должен подтвердить эквивалентность деления с проверкой на ноль', async () => {
      const originalContent = `
        function divide(a, b) {
          if (b === 0) throw new Error('Division by zero');
          return a / b;
        }
        export { divide };
      `;

      const refactoredContent = `
        import { divide } from './modules/division.js';
        export { divide } from './modules/division.js';
      `;

      const originalFile = path.join(originalDir, 'division.js');
      const refactoredFile = path.join(refactoredDir, 'division.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'division.js'),
        `
        export function divide(a, b) {
          if (b === 0) throw new Error('Division by zero');
          return a / b;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('1.4 должен подтвердить эквивалентность вычитания', async () => {
      const originalContent = `
        function subtract(a, b) { return a - b; }
        function calculateDifference(a, b) { return subtract(a, b); }
        export { subtract, calculateDifference };
      `;

      const refactoredContent = `
        import { subtract } from './modules/subtraction.js';
        function calculateDifference(a, b) { return subtract(a, b); }
        export { calculateDifference };
        export { subtract } from './modules/subtraction.js';
      `;

      const originalFile = path.join(originalDir, 'subtraction.js');
      const refactoredFile = path.join(refactoredDir, 'subtraction.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'subtraction.js'),
        'export function subtract(a, b) { return a - b; }'
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('1.5 должен подтвердить эквивалентность возведения в степень', async () => {
      const originalContent = `
        function power(base, exp) {
          if (exp === 0) return 1;
          if (exp < 0) return 1 / power(base, -exp);
          return base * power(base, exp - 1);
        }
        export { power };
      `;

      const refactoredContent = `
        import { power } from './modules/power.js';
        export { power } from './modules/power.js';
      `;

      const originalFile = path.join(originalDir, 'power.js');
      const refactoredFile = path.join(refactoredDir, 'power.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'power.js'),
        `
        export function power(base, exp) {
          return Math.pow(base, exp);
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  // ============================================
  // 2. МАССИВЫ
  // ============================================

  describe('2. Работа с массивами', () => {
    it('2.1 должен подтвердить эквивалентность суммы массива', async () => {
      const originalContent = `
        function sumArray(arr) {
          let sum = 0;
          for (let i = 0; i < arr.length; i++) {
            sum += arr[i];
          }
          return sum;
        }
        function averageArray(arr) {
          return sumArray(arr) / arr.length;
        }
        export { sumArray, averageArray };
      `;

      const refactoredContent = `
        import { sumArray } from './modules/sum.js';
        function averageArray(arr) {
          return sumArray(arr) / arr.length;
        }
        export { averageArray };
        export { sumArray } from './modules/sum.js';
      `;

      const originalFile = path.join(originalDir, 'array-sum.js');
      const refactoredFile = path.join(refactoredDir, 'array-sum.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'sum.js'),
        `
        export function sumArray(arr) {
          return arr.reduce((acc, val) => acc + val, 0);
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('2.2 должен подтвердить эквивалентность поиска максимума', async () => {
      const originalContent = `
        function findMax(arr) {
          if (arr.length === 0) return undefined;
          let max = arr[0];
          for (let i = 1; i < arr.length; i++) {
            if (arr[i] > max) max = arr[i];
          }
          return max;
        }
        function findMin(arr) {
          if (arr.length === 0) return undefined;
          let min = arr[0];
          for (let i = 1; i < arr.length; i++) {
            if (arr[i] < min) min = arr[i];
          }
          return min;
        }
        export { findMax, findMin };
      `;

      const refactoredContent = `
        import { findMax } from './modules/max.js';
        import { findMin } from './modules/min.js';
        export { findMax } from './modules/max.js';
        export { findMin } from './modules/min.js';
      `;

      const originalFile = path.join(originalDir, 'array-minmax.js');
      const refactoredFile = path.join(refactoredDir, 'array-minmax.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'max.js'),
        `
        export function findMax(arr) {
          return Math.max(...arr);
        }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'min.js'),
        `
        export function findMin(arr) {
          return Math.min(...arr);
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('2.3 должен подтвердить эквивалентность сортировки', async () => {
      const originalContent = `
        function sortArray(arr) {
          const copy = [...arr];
          for (let i = 0; i < copy.length; i++) {
            for (let j = i + 1; j < copy.length; j++) {
              if (copy[i] > copy[j]) {
                [copy[i], copy[j]] = [copy[j], copy[i]];
              }
            }
          }
          return copy;
        }
        export { sortArray };
      `;

      const refactoredContent = `
        import { sortArray } from './modules/sort.js';
        export { sortArray } from './modules/sort.js';
      `;

      const originalFile = path.join(originalDir, 'array-sort.js');
      const refactoredFile = path.join(refactoredDir, 'array-sort.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'sort.js'),
        `
        export function sortArray(arr) {
          if (arr.length <= 1) return arr;
          const pivot = arr[0];
          const left = arr.slice(1).filter(x => x < pivot);
          const right = arr.slice(1).filter(x => x >= pivot);
          return [...sortArray(left), pivot, ...sortArray(right)];
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('2.4 должен обнаружить ошибку в бинарном поиске', async () => {
      const originalContent = `
        function binarySearch(arr, target) {
          let left = 0, right = arr.length - 1;
          while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (arr[mid] === target) return mid;
            if (arr[mid] < target) left = mid + 1;
            else right = mid - 1;
          }
          return -1;
        }
        export { binarySearch };
      `;

      const refactoredContent = `
        import { binarySearch } from './modules/search.js';
        export { binarySearch } from './modules/search.js';
      `;

      const originalFile = path.join(originalDir, 'binary-search.js');
      const refactoredFile = path.join(refactoredDir, 'binary-search.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: неправильное обновление границ
      fs.writeFileSync(
        path.join(modulesDir, 'search.js'),
        `
        export function binarySearch(arr, target) {
          let left = 0, right = arr.length - 1;
          while (left < right) {
            const mid = Math.floor((left + right) / 2);
            if (arr[mid] === target) return mid;
            if (arr[mid] < target) left = mid;
            else right = mid;
          }
          return -1;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });

    it('2.5 должен подтвердить эквивалентность фильтрации массива', async () => {
      const originalContent = `
        function filterPositive(arr) {
          const result = [];
          for (const item of arr) {
            if (item > 0) result.push(item);
          }
          return result;
        }
        export { filterPositive };
      `;

      const refactoredContent = `
        import { filterPositive } from './modules/filter.js';
        export { filterPositive } from './modules/filter.js';
      `;

      const originalFile = path.join(originalDir, 'array-filter.js');
      const refactoredFile = path.join(refactoredDir, 'array-filter.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'filter.js'),
        `
        export function filterPositive(arr) {
          return arr.filter(item => item > 0);
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('2.6 должен подтвердить эквивалентность реверсирования массива', async () => {
      const originalContent = `
        function reverseArray(arr) {
          const copy = [...arr];
          for (let i = 0; i < Math.floor(copy.length / 2); i++) {
            const j = copy.length - 1 - i;
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        }
        export { reverseArray };
      `;

      const refactoredContent = `
        import { reverseArray } from './modules/reverse.js';
        export { reverseArray } from './modules/reverse.js';
      `;

      const originalFile = path.join(originalDir, 'array-reverse.js');
      const refactoredFile = path.join(refactoredDir, 'array-reverse.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'reverse.js'),
        `
        export function reverseArray(arr) {
          return [...arr].reverse();
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  // ============================================
  // 3. РЕКУРСИВНЫЕ ФУНКЦИИ
  // ============================================

  describe('3. Рекурсивные функции', () => {
    it('3.1 должен подтвердить эквивалентность факториала', async () => {
      const originalContent = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        export { factorial };
      `;

      const refactoredContent = `
        import { factorial } from './modules/factorial.js';
        export { factorial } from './modules/factorial.js';
      `;

      const originalFile = path.join(originalDir, 'factorial.js');
      const refactoredFile = path.join(refactoredDir, 'factorial.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'factorial.js'),
        `
        export function factorial(n) {
          let result = 1;
          for (let i = 2; i <= n; i++) {
            result *= i;
          }
          return result;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('3.2 должен подтвердить эквивалентность чисел Фибоначчи', async () => {
      const originalContent = `
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        export { fibonacci };
      `;

      const refactoredContent = `
        import { fibonacci } from './modules/fibonacci.js';
        export { fibonacci } from './modules/fibonacci.js';
      `;

      const originalFile = path.join(originalDir, 'fibonacci.js');
      const refactoredFile = path.join(refactoredDir, 'fibonacci.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'fibonacci.js'),
        `
        export function fibonacci(n) {
          if (n <= 1) return n;
          let a = 0, b = 1;
          for (let i = 2; i <= n; i++) {
            [a, b] = [b, a + b];
          }
          return b;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('3.3 должен обнаружить ошибку в рекурсивной сумме', async () => {
      const originalContent = `
        function sumRecursive(n) {
          if (n <= 0) return 0;
          return n + sumRecursive(n - 1);
        }
        export { sumRecursive };
      `;

      const refactoredContent = `
        import { sumRecursive } from './modules/sum.js';
        export { sumRecursive } from './modules/sum.js';
      `;

      const originalFile = path.join(originalDir, 'sum-recursive.js');
      const refactoredFile = path.join(refactoredDir, 'sum-recursive.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: n + sumRecursive(n) - бесконечная рекурсия
      fs.writeFileSync(
        path.join(modulesDir, 'sum.js'),
        `
        export function sumRecursive(n) {
          if (n <= 0) return 0;
          return n + sumRecursive(n);
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
    });

    it('3.4 должен подтвердить эквивалентность обхода дерева', async () => {
      const originalContent = `
        function traverseTree(node) {
          if (!node) return [];
          return [
            node.value,
            ...traverseTree(node.left),
            ...traverseTree(node.right)
          ];
        }
        export { traverseTree };
      `;

      const refactoredContent = `
        import { traverseTree } from './modules/tree.js';
        export { traverseTree } from './modules/tree.js';
      `;

      const originalFile = path.join(originalDir, 'tree.js');
      const refactoredFile = path.join(refactoredDir, 'tree.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'tree.js'),
        `
        export function traverseTree(node) {
          if (!node) return [];
          const result = [node.value];
          if (node.left) result.push(...traverseTree(node.left));
          if (node.right) result.push(...traverseTree(node.right));
          return result;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  // ============================================
  // 4. ОБЪЕКТЫ И КЛАССЫ
  // ============================================

  describe('4. Объекты и классы', () => {
    it('4.1 должен подтвердить эквивалентность методов класса', async () => {
      const originalContent = `
        class Calculator {
          add(a, b) { return a + b; }
          multiply(a, b) { return a * b; }
          calculate(a, b) {
            return this.add(a, this.multiply(a, b));
          }
        }
        export { Calculator };
      `;

      const refactoredContent = `
        import { Calculator } from './modules/calculator.js';
        export { Calculator } from './modules/calculator.js';
      `;

      const originalFile = path.join(originalDir, 'class.js');
      const refactoredFile = path.join(refactoredDir, 'class.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'calculator.js'),
        `
        class Calculator {
          add(a, b) { return a + b; }
          multiply(a, b) { return a * b; }
          calculate(a, b) {
            return this.add(a, this.multiply(a, b));
          }
        }
        export { Calculator };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('4.2 должен обнаружить ошибку в методе класса', async () => {
      const originalContent = `
        class MathOperations {
          add(a, b) { return a + b; }
          subtract(a, b) { return a - b; }
        }
        export { MathOperations };
      `;

      const refactoredContent = `
        import { MathOperations } from './modules/math.js';
        export { MathOperations } from './modules/math.js';
      `;

      const originalFile = path.join(originalDir, 'class-error.js');
      const refactoredFile = path.join(refactoredDir, 'class-error.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: вычитание заменено на сложение
      fs.writeFileSync(
        path.join(modulesDir, 'math.js'),
        `
        class MathOperations {
          add(a, b) { return a + b; }
          subtract(a, b) { return a + b; }
        }
        export { MathOperations };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });

    it('4.3 должен подтвердить эквивалентность объекта-фабрики', async () => {
      const originalContent = `
        function createUser(name, age) {
          return {
            name,
            age,
            greet() {
              return \`Hello, \${this.name}!\`;
            },
            isAdult() {
              return this.age >= 18;
            }
          };
        }
        export { createUser };
      `;

      const refactoredContent = `
        import { createUser } from './modules/user.js';
        export { createUser } from './modules/user.js';
      `;

      const originalFile = path.join(originalDir, 'factory.js');
      const refactoredFile = path.join(refactoredDir, 'factory.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'user.js'),
        `
        export function createUser(name, age) {
          return {
            name,
            age,
            greet() {
              return \`Hello, \${this.name}!\`;
            },
            isAdult() {
              return this.age >= 18;
            }
          };
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('4.4 должен подтвердить эквивалентность наследования классов', async () => {
      const originalContent = `
        class Animal {
          constructor(name) {
            this.name = name;
          }
          speak() {
            return \`\${this.name} makes a sound\`;
          }
        }

        class Dog extends Animal {
          speak() {
            return \`\${this.name} barks\`;
          }
        }

        class Cat extends Animal {
          speak() {
            return \`\${this.name} meows\`;
          }
        }

        export { Animal, Dog, Cat };
      `;

      const refactoredContent = `
        import { Animal, Dog, Cat } from './modules/animals.js';
        export { Animal, Dog, Cat } from './modules/animals.js';
      `;

      const originalFile = path.join(originalDir, 'inheritance.js');
      const refactoredFile = path.join(refactoredDir, 'inheritance.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'animals.js'),
        `
        class Animal {
          constructor(name) {
            this.name = name;
          }
          speak() {
            return \`\${this.name} makes a sound\`;
          }
        }

        class Dog extends Animal {
          speak() {
            return \`\${this.name} barks\`;
          }
        }

        class Cat extends Animal {
          speak() {
            return \`\${this.name} meows\`;
          }
        }

        export { Animal, Dog, Cat };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('4.5 должен обнаружить ошибку в наследовании', async () => {
      const originalContent = `
        class Animal {
          constructor(name) {
            this.name = name;
          }
          speak() {
            return \`\${this.name} makes a sound\`;
          }
        }

        class Dog extends Animal {
          speak() {
            return \`\${this.name} barks\`;
          }
        }

        export { Animal, Dog };
      `;

      const refactoredContent = `
        import { Animal, Dog } from './modules/animal-error.js';
        export { Animal, Dog } from './modules/animal-error.js';
      `;

      const originalFile = path.join(originalDir, 'inheritance-error.js');
      const refactoredFile = path.join(refactoredDir, 'inheritance-error.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: потеря метода speak в Dog
      fs.writeFileSync(
        path.join(modulesDir, 'animal-error.js'),
        `
        class Animal {
          constructor(name) {
            this.name = name;
          }
          speak() {
            return \`\${this.name} makes a sound\`;
          }
        }

        class Dog extends Animal {
          // Не переопределяет speak
        }

        export { Animal, Dog };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 5. СТРОКИ
  // ============================================

  describe('5. Работа со строками', () => {
    it('5.1 должен подтвердить эквивалентность форматирования строк', async () => {
      const originalContent = `
        function formatGreeting(name, title) {
          return \`Hello, \${title} \${name}!\`;
        }
        function formatFullName(first, last) {
          return \`\${last}, \${first}\`;
        }
        export { formatGreeting, formatFullName };
      `;

      const refactoredContent = `
        import { formatGreeting, formatFullName } from './modules/string.js';
        export { formatGreeting, formatFullName } from './modules/string.js';
      `;

      const originalFile = path.join(originalDir, 'string-format.js');
      const refactoredFile = path.join(refactoredDir, 'string-format.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'string.js'),
        `
        export function formatGreeting(name, title) {
          return \`Hello, \${title} \${name}!\`;
        }
        export function formatFullName(first, last) {
          return \`\${last}, \${first}\`;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('5.2 должен обнаружить ошибку в обработке строк', async () => {
      const originalContent = `
        function capitalize(str) {
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        }
        function reverse(str) {
          return str.split('').reverse().join('');
        }
        export { capitalize, reverse };
      `;

      const refactoredContent = `
        import { capitalize, reverse } from './modules/string-ops.js';
        export { capitalize, reverse } from './modules/string-ops.js';
      `;

      const originalFile = path.join(originalDir, 'string-ops.js');
      const refactoredFile = path.join(refactoredDir, 'string-ops.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: capitalize не переводит в нижний регистр
      fs.writeFileSync(
        path.join(modulesDir, 'string-ops.js'),
        `
        export function capitalize(str) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        }
        export function reverse(str) {
          return str.split('').reverse().join('');
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
    });

    it('5.3 должен подтвердить эквивалентность обрезки строки', async () => {
      const originalContent = `
        function truncate(str, maxLength) {
          if (str.length <= maxLength) return str;
          return str.slice(0, maxLength) + '...';
        }
        export { truncate };
      `;

      const refactoredContent = `
        import { truncate } from './modules/truncate.js';
        export { truncate } from './modules/truncate.js';
      `;

      const originalFile = path.join(originalDir, 'truncate.js');
      const refactoredFile = path.join(refactoredDir, 'truncate.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'truncate.js'),
        `
        export function truncate(str, maxLength) {
          return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('5.4 должен подтвердить эквивалентность проверки палиндрома', async () => {
      const originalContent = `
        function isPalindrome(str) {
          const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleaned === cleaned.split('').reverse().join('');
        }
        export { isPalindrome };
      `;

      const refactoredContent = `
        import { isPalindrome } from './modules/palindrome.js';
        export { isPalindrome } from './modules/palindrome.js';
      `;

      const originalFile = path.join(originalDir, 'palindrome.js');
      const refactoredFile = path.join(refactoredDir, 'palindrome.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'palindrome.js'),
        `
        export function isPalindrome(str) {
          const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
          let left = 0, right = cleaned.length - 1;
          while (left < right) {
            if (cleaned[left] !== cleaned[right]) return false;
            left++;
            right--;
          }
          return true;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  // ============================================
  // 6. АСИНХРОННЫЕ ОПЕРАЦИИ
  // ============================================

  describe('6. Асинхронные операции', () => {
    it('6.1 должен подтвердить эквивалентность async/await', async () => {
      const originalContent = `
        async function fetchData(url) {
          const response = await fetch(url);
          return response.json();
        }
        async function processData(url) {
          const data = await fetchData(url);
          return data.map(item => item.value);
        }
        export { fetchData, processData };
      `;

      const refactoredContent = `
        import { fetchData, processData } from './modules/async.js';
        export { fetchData, processData } from './modules/async.js';
      `;

      const originalFile = path.join(originalDir, 'async.js');
      const refactoredFile = path.join(refactoredDir, 'async.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'async.js'),
        `
        async function fetchData(url) {
          const response = await fetch(url);
          return response.json();
        }
        async function processData(url) {
          const data = await fetchData(url);
          return data.map(item => item.value);
        }
        export { fetchData, processData };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('6.2 должен подтвердить эквивалентность Promise.then', async () => {
      const originalContent = `
        function fetchUser(id) {
          return fetch(\`/api/users/\${id}\`)
            .then(res => res.json())
            .then(user => ({ ...user, processed: true }));
        }
        export { fetchUser };
      `;

      const refactoredContent = `
        import { fetchUser } from './modules/user-api.js';
        export { fetchUser } from './modules/user-api.js';
      `;

      const originalFile = path.join(originalDir, 'promise.js');
      const refactoredFile = path.join(refactoredDir, 'promise.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'user-api.js'),
        `
        async function fetchUser(id) {
          const res = await fetch(\`/api/users/\${id}\`);
          const user = await res.json();
          return { ...user, processed: true };
        }
        export { fetchUser };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('6.3 должен подтвердить эквивалентность параллельных запросов', async () => {
      const originalContent = `
        async function fetchMultiple(ids) {
          const promises = ids.map(id => fetch(\`/api/users/\${id}\`).then(r => r.json()));
          return Promise.all(promises);
        }
        export { fetchMultiple };
      `;

      const refactoredContent = `
        import { fetchMultiple } from './modules/parallel.js';
        export { fetchMultiple } from './modules/parallel.js';
      `;

      const originalFile = path.join(originalDir, 'parallel.js');
      const refactoredFile = path.join(refactoredDir, 'parallel.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'parallel.js'),
        `
        async function fetchMultiple(ids) {
          const promises = ids.map(async id => {
            const res = await fetch(\`/api/users/\${id}\`);
            return res.json();
          });
          return Promise.all(promises);
        }
        export { fetchMultiple };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('6.4 должен обнаружить ошибку в асинхронной обработке', async () => {
      const originalContent = `
        async function processItems(items) {
          const results = [];
          for (const item of items) {
            const processed = await processItem(item);
            results.push(processed);
          }
          return results;
        }
        export { processItems };
      `;

      const refactoredContent = `
        import { processItems } from './modules/async-process.js';
        export { processItems } from './modules/async-process.js';
      `;

      const originalFile = path.join(originalDir, 'async-process.js');
      const refactoredFile = path.join(refactoredDir, 'async-process.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: не ждем завершения
      fs.writeFileSync(
        path.join(modulesDir, 'async-process.js'),
        `
        async function processItems(items) {
          const results = [];
          for (const item of items) {
            processItem(item).then(processed => results.push(processed));
          }
          return results;
        }
        export { processItems };
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 7. УСЛОВНАЯ ЛОГИКА
  // ============================================

  describe('7. Условная логика', () => {
    it('7.1 должен подтвердить эквивалентность if/else', async () => {
      const originalContent = `
        function getDiscount(amount, isPremium) {
          if (isPremium) {
            return amount * 0.2;
          } else if (amount > 1000) {
            return amount * 0.1;
          } else {
            return 0;
          }
        }
        export { getDiscount };
      `;

      const refactoredContent = `
        import { getDiscount } from './modules/discount.js';
        export { getDiscount } from './modules/discount.js';
      `;

      const originalFile = path.join(originalDir, 'conditional.js');
      const refactoredFile = path.join(refactoredDir, 'conditional.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'discount.js'),
        `
        export function getDiscount(amount, isPremium) {
          return isPremium ? amount * 0.2 : amount > 1000 ? amount * 0.1 : 0;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('7.2 должен обнаружить ошибку в условной логике', async () => {
      const originalContent = `
        function getCategory(age) {
          if (age < 13) return 'child';
          if (age < 18) return 'teenager';
          if (age < 65) return 'adult';
          return 'senior';
        }
        export { getCategory };
      `;

      const refactoredContent = `
        import { getCategory } from './modules/category.js';
        export { getCategory } from './modules/category.js';
      `;

      const originalFile = path.join(originalDir, 'category.js');
      const refactoredFile = path.join(refactoredDir, 'category.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: неправильные границы
      fs.writeFileSync(
        path.join(modulesDir, 'category.js'),
        `
        export function getCategory(age) {
          if (age < 12) return 'child';
          if (age < 18) return 'teenager';
          if (age < 60) return 'adult';
          return 'senior';
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
    });

    it('7.3 должен подтвердить эквивалентность switch/case', async () => {
      const originalContent = `
        function getDayName(day) {
          switch (day) {
            case 0: return 'Sunday';
            case 1: return 'Monday';
            case 2: return 'Tuesday';
            case 3: return 'Wednesday';
            case 4: return 'Thursday';
            case 5: return 'Friday';
            case 6: return 'Saturday';
            default: return 'Unknown';
          }
        }
        export { getDayName };
      `;

      const refactoredContent = `
        import { getDayName } from './modules/day.js';
        export { getDayName } from './modules/day.js';
      `;

      const originalFile = path.join(originalDir, 'switch.js');
      const refactoredFile = path.join(refactoredDir, 'switch.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'day.js'),
        `
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        export function getDayName(day) {
          return days[day] || 'Unknown';
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('7.4 должен подтвердить эквивалентность вложенных условий', async () => {
      const originalContent = `
        function getGrade(score) {
          if (score >= 90) return 'A';
          if (score >= 80) return 'B';
          if (score >= 70) return 'C';
          if (score >= 60) return 'D';
          return 'F';
        }
        export { getGrade };
      `;

      const refactoredContent = `
        import { getGrade } from './modules/grade.js';
        export { getGrade } from './modules/grade.js';
      `;

      const originalFile = path.join(originalDir, 'grade.js');
      const refactoredFile = path.join(refactoredDir, 'grade.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'grade.js'),
        `
        const grades = [
          { min: 90, grade: 'A' },
          { min: 80, grade: 'B' },
          { min: 70, grade: 'C' },
          { min: 60, grade: 'D' },
          { min: 0, grade: 'F' }
        ];
        export function getGrade(score) {
          return grades.find(g => score >= g.min)?.grade || 'F';
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  // ============================================
  // 8. ОБРАБОТКА ДАННЫХ
  // ============================================

  describe('8. Обработка данных', () => {
    it('8.1 должен подтвердить эквивалентность фильтрации и маппинга', async () => {
      const originalContent = `
        function processItems(items) {
          return items
            .filter(item => item.active)
            .map(item => ({
              id: item.id,
              name: item.name.toUpperCase(),
              value: item.value * 1.1
            }));
        }
        export { processItems };
      `;

      const refactoredContent = `
        import { processItems } from './modules/process.js';
        export { processItems } from './modules/process.js';
      `;

      const originalFile = path.join(originalDir, 'data-process.js');
      const refactoredFile = path.join(refactoredDir, 'data-process.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'process.js'),
        `
        export function processItems(items) {
          const result = [];
          for (const item of items) {
            if (item.active) {
              result.push({
                id: item.id,
                name: item.name.toUpperCase(),
                value: item.value * 1.1
              });
            }
          }
          return result;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('8.2 должен подтвердить эквивалентность группировки данных', async () => {
      const originalContent = `
        function groupByCategory(items) {
          const groups = {};
          for (const item of items) {
            const category = item.category || 'uncategorized';
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
          }
          return groups;
        }
        export { groupByCategory };
      `;

      const refactoredContent = `
        import { groupByCategory } from './modules/group.js';
        export { groupByCategory } from './modules/group.js';
      `;

      const originalFile = path.join(originalDir, 'group.js');
      const refactoredFile = path.join(refactoredDir, 'group.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'group.js'),
        `
        export function groupByCategory(items) {
          return items.reduce((groups, item) => {
            const category = item.category || 'uncategorized';
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
            return groups;
          }, {});
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('8.3 должен подтвердить эквивалентность агрегации данных', async () => {
      const originalContent = `
        function aggregateData(data) {
          return data.reduce((acc, item) => ({
            count: acc.count + 1,
            sum: acc.sum + item.value,
            avg: (acc.sum + item.value) / (acc.count + 1),
            min: Math.min(acc.min, item.value),
            max: Math.max(acc.max, item.value)
          }), { count: 0, sum: 0, avg: 0, min: Infinity, max: -Infinity });
        }
        export { aggregateData };
      `;

      const refactoredContent = `
        import { aggregateData } from './modules/aggregate.js';
        export { aggregateData } from './modules/aggregate.js';
      `;

      const originalFile = path.join(originalDir, 'aggregate.js');
      const refactoredFile = path.join(refactoredDir, 'aggregate.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'aggregate.js'),
        `
        export function aggregateData(data) {
          let count = 0, sum = 0, min = Infinity, max = -Infinity;
          for (const item of data) {
            count++;
            sum += item.value;
            min = Math.min(min, item.value);
            max = Math.max(max, item.value);
          }
          return {
            count,
            sum,
            avg: count > 0 ? sum / count : 0,
            min: count > 0 ? min : 0,
            max: count > 0 ? max : 0
          };
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('8.4 должен обнаружить ошибку в агрегации', async () => {
      const originalContent = `
        function aggregateData(data) {
          return data.reduce((acc, item) => ({
            count: acc.count + 1,
            sum: acc.sum + item.value,
            avg: (acc.sum + item.value) / (acc.count + 1),
            min: Math.min(acc.min, item.value),
            max: Math.max(acc.max, item.value)
          }), { count: 0, sum: 0, avg: 0, min: Infinity, max: -Infinity });
        }
        export { aggregateData };
      `;

      const refactoredContent = `
        import { aggregateData } from './modules/aggregate-error.js';
        export { aggregateData } from './modules/aggregate-error.js';
      `;

      const originalFile = path.join(originalDir, 'aggregate-error.js');
      const refactoredFile = path.join(refactoredDir, 'aggregate-error.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: неправильный расчет avg
      fs.writeFileSync(
        path.join(modulesDir, 'aggregate-error.js'),
        `
        export function aggregateData(data) {
          let count = 0, sum = 0, min = Infinity, max = -Infinity;
          for (const item of data) {
            count++;
            sum += item.value;
            min = Math.min(min, item.value);
            max = Math.max(max, item.value);
          }
          return {
            count,
            sum,
            avg: sum / count,
            min: count > 0 ? min : 0,
            max: count > 0 ? max : 0
          };
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 9. СЛОЖНЫЕ СМЕШАННЫЕ СЦЕНАРИИ
  // ============================================

  describe('9. Сложные смешанные сценарии', () => {
    it('9.1 должен подтвердить эквивалентность смешанного рефакторинга', async () => {
      const originalContent = `
        // Математические функции
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        
        // Работа с массивами
        function sumArray(arr) {
          let sum = 0;
          for (const item of arr) sum += item;
          return sum;
        }
        
        // Работа со строками
        function capitalize(str) {
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        }
        
        // Условная логика
        function getDiscount(amount, isPremium) {
          return isPremium ? amount * 0.2 : amount > 1000 ? amount * 0.1 : 0;
        }
        
        // Главная функция
        function processOrder(items, customer) {
          const total = sumArray(items.map(item => item.price));
          const discount = getDiscount(total, customer.isPremium);
          const finalAmount = total - discount;
          return {
            total,
            discount,
            finalAmount,
            message: \`Order processed for \${capitalize(customer.name)}\`
          };
        }
        
        export { add, multiply, sumArray, capitalize, getDiscount, processOrder };
      `;

      const refactoredContent = `
        import { add, multiply } from './modules/math.js';
        import { sumArray } from './modules/array.js';
        import { capitalize } from './modules/string.js';
        import { getDiscount } from './modules/discount.js';
        import { processOrder } from './modules/order.js';
        
        export { add, multiply } from './modules/math.js';
        export { sumArray } from './modules/array.js';
        export { capitalize } from './modules/string.js';
        export { getDiscount } from './modules/discount.js';
        export { processOrder } from './modules/order.js';
      `;

      const originalFile = path.join(originalDir, 'mixed.js');
      const refactoredFile = path.join(refactoredDir, 'mixed.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'math.js'),
        `
        export function add(a, b) { return a + b; }
        export function multiply(a, b) { return a * b; }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'array.js'),
        `
        export function sumArray(arr) {
          return arr.reduce((acc, val) => acc + val, 0);
        }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'string.js'),
        `
        export function capitalize(str) {
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'discount.js'),
        `
        export function getDiscount(amount, isPremium) {
          return isPremium ? amount * 0.2 : amount > 1000 ? amount * 0.1 : 0;
        }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'order.js'),
        `
        import { sumArray } from './array.js';
        import { getDiscount } from './discount.js';
        import { capitalize } from './string.js';
        
        export function processOrder(items, customer) {
          const total = sumArray(items.map(item => item.price));
          const discount = getDiscount(total, customer.isPremium);
          const finalAmount = total - discount;
          return {
            total,
            discount,
            finalAmount,
            message: \`Order processed for \${capitalize(customer.name)}\`
          };
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
      expect(result.verifiedFunctions).toBe(6);
      expect(result.failedFunctions).toHaveLength(0);
    });

    it('9.2 должен обнаружить ошибку в сложном рефакторинге', async () => {
      const originalContent = `
        function processData(input) {
          // Шаг 1: валидация
          if (!input || typeof input !== 'object') {
            throw new Error('Invalid input');
          }
          
          // Шаг 2: трансформация
          const transformed = Object.entries(input).map(([key, value]) => ({
            key,
            value: value * 2
          }));
          
          // Шаг 3: фильтрация
          const filtered = transformed.filter(item => item.value > 10);
          
          // Шаг 4: сумма
          const sum = filtered.reduce((acc, item) => acc + item.value, 0);
          
          return { sum, items: filtered };
        }
        export { processData };
      `;

      const refactoredContent = `
        import { processData } from './modules/process.js';
        export { processData } from './modules/process.js';
      `;

      const originalFile = path.join(originalDir, 'complex.js');
      const refactoredFile = path.join(refactoredDir, 'complex.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: пропущена валидация
      fs.writeFileSync(
        path.join(modulesDir, 'process.js'),
        `
        export function processData(input) {
          const transformed = Object.entries(input).map(([key, value]) => ({
            key,
            value: value * 2
          }));
          const filtered = transformed.filter(item => item.value > 10);
          const sum = filtered.reduce((acc, item) => acc + item.value, 0);
          return { sum, items: filtered };
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });

    it('9.3 должен подтвердить эквивалентность ETL пайплайна', async () => {
      const originalContent = `
        function extractData(source) {
          return source.filter(item => item.valid);
        }

        function transformData(data) {
          return data.map(item => ({
            ...item,
            processed: true,
            value: item.value * 2
          }));
        }

        function loadData(data) {
          return data.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {});
        }

        function runETL(source) {
          const extracted = extractData(source);
          const transformed = transformData(extracted);
          return loadData(transformed);
        }

        export { extractData, transformData, loadData, runETL };
      `;

      const refactoredContent = `
        import { extractData } from './modules/extract.js';
        import { transformData } from './modules/transform.js';
        import { loadData } from './modules/load.js';
        import { runETL } from './modules/etl.js';
        
        export { extractData } from './modules/extract.js';
        export { transformData } from './modules/transform.js';
        export { loadData } from './modules/load.js';
        export { runETL } from './modules/etl.js';
      `;

      const originalFile = path.join(originalDir, 'etl.js');
      const refactoredFile = path.join(refactoredDir, 'etl.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'extract.js'),
        `
        export function extractData(source) {
          return source.filter(item => item.valid);
        }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'transform.js'),
        `
        export function transformData(data) {
          return data.map(item => ({
            ...item,
            processed: true,
            value: item.value * 2
          }));
        }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'load.js'),
        `
        export function loadData(data) {
          return data.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {});
        }
        `
      );

      fs.writeFileSync(
        path.join(modulesDir, 'etl.js'),
        `
        import { extractData } from './extract.js';
        import { transformData } from './transform.js';
        import { loadData } from './load.js';

        export function runETL(source) {
          const extracted = extractData(source);
          const transformed = transformData(extracted);
          return loadData(transformed);
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
      expect(result.verifiedFunctions).toBe(4);
    });
  });

  // ============================================
  // 10. ГРАНИЧНЫЕ СЛУЧАИ
  // ============================================

  describe('10. Граничные случаи', () => {
    it('10.1 должен корректно обрабатывать пустой файл', async () => {
      const originalFile = path.join(originalDir, 'empty.js');
      const refactoredFile = path.join(refactoredDir, 'empty.js');

      fs.writeFileSync(originalFile, '');
      fs.writeFileSync(refactoredFile, '');

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        undefined
      );

      expect(result.isEquivalent).toBe(true);
      expect(result.totalFunctions).toBe(0);
    });

    it('10.2 должен корректно обрабатывать файл без экспортов', async () => {
      const originalContent = `
        function internalA() { return 1; }
        function internalB() { return 2; }
      `;

      const refactoredContent = `
        function internalA() { return 1; }
        function internalB() { return 2; }
      `;

      const originalFile = path.join(originalDir, 'no-exports.js');
      const refactoredFile = path.join(refactoredDir, 'no-exports.js');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        undefined
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('10.3 должен обнаружить отсутствующую функцию', async () => {
      const originalContent = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        export { add, multiply };
      `;

      const refactoredContent = `
        function add(a, b) { return a + b; }
        export { add };
      `;

      const originalFile = path.join(originalDir, 'missing.js');
      const refactoredFile = path.join(refactoredDir, 'missing.js');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        undefined
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.missingFunctions).toContain('multiply');
    });

    it('10.4 должен обнаружить изменение сигнатуры', async () => {
      const originalContent = `
        function calculate(a, b) { return a + b; }
        export { calculate };
      `;

      const refactoredContent = `
        function calculate(a, b, c) { return a + b + c; }
        export { calculate };
      `;

      const originalFile = path.join(originalDir, 'signature.js');
      const refactoredFile = path.join(refactoredDir, 'signature.js');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        undefined
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.signatureChanges.length).toBeGreaterThan(0);
    });

    it('10.5 должен корректно обрабатывать функцию с комментариями', async () => {
      const originalContent = `
        // Это функция сложения
        function add(a, b) {
          // Складываем два числа
          return a + b;
        }
        export { add };
      `;

      const refactoredContent = `
        // Это функция сложения (рефакторинг)
        function add(a, b) {
          // Возвращаем сумму двух чисел
          return a + b;
        }
        export { add };
      `;

      const originalFile = path.join(originalDir, 'comments.js');
      const refactoredFile = path.join(refactoredDir, 'comments.js');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        undefined
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('10.6 должен обнаружить ошибку в функции с try-catch', async () => {
      const originalContent = `
        function divide(a, b) {
          try {
            if (b === 0) throw new Error('Division by zero');
            return a / b;
          } catch (e) {
            return NaN;
          }
        }
        export { divide };
      `;

      const refactoredContent = `
        import { divide } from './modules/divide.js';
        export { divide } from './modules/divide.js';
      `;

      const originalFile = path.join(originalDir, 'try-catch.js');
      const refactoredFile = path.join(refactoredDir, 'try-catch.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      // Ошибка: нет обработки исключения
      fs.writeFileSync(
        path.join(modulesDir, 'divide.js'),
        `
        export function divide(a, b) {
          if (b === 0) throw new Error('Division by zero');
          return a / b;
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });

    it('10.7 должен подтвердить эквивалентность функции с несколькими return', async () => {
      const originalContent = `
        function getStatus(code) {
          if (code === 200) return 'OK';
          if (code === 404) return 'Not Found';
          if (code === 500) return 'Server Error';
          return 'Unknown';
        }
        export { getStatus };
      `;

      const refactoredContent = `
        import { getStatus } from './modules/status.js';
        export { getStatus } from './modules/status.js';
      `;

      const originalFile = path.join(originalDir, 'status.js');
      const refactoredFile = path.join(refactoredDir, 'status.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      fs.writeFileSync(
        path.join(modulesDir, 'status.js'),
        `
        const statusMap = {
          200: 'OK',
          404: 'Not Found',
          500: 'Server Error'
        };
        export function getStatus(code) {
          return statusMap[code] || 'Unknown';
        }
        `
      );

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('10.8 должен корректно обрабатывать очень большой файл', async () => {
      const originalContent = `
        function add(a, b) { return a + b; }
        function subtract(a, b) { return a - b; }
        function multiply(a, b) { return a * b; }
        function divide(a, b) { return a / b; }
        function power(a, b) { return Math.pow(a, b); }
        function sqrt(a) { return Math.sqrt(a); }
        function abs(a) { return Math.abs(a); }
        function min(a, b) { return Math.min(a, b); }
        function max(a, b) { return Math.max(a, b); }
        function round(a) { return Math.round(a); }
        function floor(a) { return Math.floor(a); }
        function ceil(a) { return Math.ceil(a); }
        function truncate(a) { return Math.trunc(a); }
        function sign(a) { return Math.sign(a); }
        function exp(a) { return Math.exp(a); }
        function log(a) { return Math.log(a); }
        function log10(a) { return Math.log10(a); }
        function sin(a) { return Math.sin(a); }
        function cos(a) { return Math.cos(a); }
        function tan(a) { return Math.tan(a); }
        ${Array.from({ length: 100 }, (_, i) => `function func${i}(a) { return a + ${i}; }`).join('\n')}
        export { add, subtract, multiply, divide, power, sqrt, abs, min, max, round, floor, ceil, truncate, sign, exp, log, log10, sin, cos, tan };
      `;

      const refactoredContent = `
        import { add, subtract, multiply, divide, power, sqrt, abs, min, max, round, floor, ceil, truncate, sign, exp, log, log10, sin, cos, tan } from './modules/math-large.js';
        export { add, subtract, multiply, divide, power, sqrt, abs, min, max, round, floor, ceil, truncate, sign, exp, log, log10, sin, cos, tan } from './modules/math-large.js';
      `;

      const originalFile = path.join(originalDir, 'large.js');
      const refactoredFile = path.join(refactoredDir, 'large.js');
      const modulesDir = path.join(refactoredDir, 'modules');

      fs.writeFileSync(originalFile, originalContent);
      fs.writeFileSync(refactoredFile, refactoredContent);
      fs.mkdirSync(modulesDir, { recursive: true });

      const largeModuleContent = `
        export function add(a, b) { return a + b; }
        export function subtract(a, b) { return a - b; }
        export function multiply(a, b) { return a * b; }
        export function divide(a, b) { return a / b; }
        export function power(a, b) { return Math.pow(a, b); }
        export function sqrt(a) { return Math.sqrt(a); }
        export function abs(a) { return Math.abs(a); }
        export function min(a, b) { return Math.min(a, b); }
        export function max(a, b) { return Math.max(a, b); }
        export function round(a) { return Math.round(a); }
        export function floor(a) { return Math.floor(a); }
        export function ceil(a) { return Math.ceil(a); }
        export function truncate(a) { return Math.trunc(a); }
        export function sign(a) { return Math.sign(a); }
        export function exp(a) { return Math.exp(a); }
        export function log(a) { return Math.log(a); }
        export function log10(a) { return Math.log10(a); }
        export function sin(a) { return Math.sin(a); }
        export function cos(a) { return Math.cos(a); }
        export function tan(a) { return Math.tan(a); }
      `;

      fs.writeFileSync(path.join(modulesDir, 'math-large.js'), largeModuleContent);

      const result = await checker.checkRefactoringEquivalence(
        originalFile,
        refactoredFile,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
      expect(result.verifiedFunctions).toBe(20);
    });
  });
});
