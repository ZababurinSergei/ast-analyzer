// packages/ast-analyzer/src/formal/__tests__/EquivalenceChecker.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EquivalenceChecker } from '../EquivalenceChecker.js';
import { Z3Verifier, createIntParam } from '../Z3Verifier.js';

describe('EquivalenceChecker - Проверка эквивалентности', () => {
  let checker: EquivalenceChecker;
  let verifier: Z3Verifier;
  const testDir = path.join(process.cwd(), 'test-temp-equivalence');

  beforeEach(async () => {
    checker = new EquivalenceChecker();
    verifier = new Z3Verifier();
    await checker.initialize();
    await verifier.initialize();

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ============================================
  // 1. ЭКВИВАЛЕНТНОСТЬ ФАЙЛОВ
  // ============================================

  describe('Эквивалентность файлов', () => {
    it('должен определить эквивалентность идентичных файлов', async () => {
      const content = 'function add(a, b) { return a + b; }';
      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, content);
      fs.writeFileSync(file2, content);

      const result = await checker.checkFileEquivalence(file1, file2);
      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('должен определить эквивалентность семантически одинаковых файлов', async () => {
      const file1Content = 'function add(a, b) { return a + b; }';
      const file2Content = 'function add(a, b) { const result = a + b; return result; }';

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти различия между неэквивалентными файлами', async () => {
      const file1Content = 'function add(a, b) { return a + b; }';
      const file2Content = 'function add(a, b) { return a * b; }';

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
    });

    it('должен игнорировать пробелы при структурной проверке', async () => {
      const file1Content = 'function add(a, b) { return a + b; }';
      const file2Content = 'function add( a , b ) { return a + b ; }';

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        ignoreWhitespace: true,
        ignoreComments: true,
      });

      expect(result.isEquivalent).toBe(true);
    });

    it('должен находить различия при изменении сигнатуры функции', async () => {
      const file1Content = 'function add(a, b) { return a + b; }';
      const file2Content = 'function add(a, b, c) { return a + b + c; }';

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2);
      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
    });

    it('должен игнорировать комментарии при структурной проверке', async () => {
      const file1Content = 'function add(a, b) { return a + b; }';
      const file2Content = '// This is a comment\nfunction add(a, b) { return a + b; }';

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        ignoreComments: true,
      });

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определять эквивалентность файлов с разными стилями кода', async () => {
      const file1Content = `
        function calculate(x, y) {
          let result = 0;
          for (let i = 0; i < x; i++) {
            result += y;
          }
          return result;
        }
      `;

      const file2Content = `
        function calculate(x, y) {
          let result = 0;
          for (let i = 0; i < x; i++) {
            result += y;
          }
          return result;
        }
      `;

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        ignoreWhitespace: true,
        ignoreComments: true,
      });

      expect(result.isEquivalent).toBe(true);
    });

    it('должен находить различия при изменении логики в цикле', async () => {
      const file1Content = `
        function calculate(x, y) {
          let result = 0;
          for (let i = 0; i < x; i++) {
            result += y;
          }
          return result;
        }
      `;

      const file2Content = `
        function calculate(x, y) {
          let result = 0;
          for (let i = 0; i < x; i++) {
            result += y * 2;
          }
          return result;
        }
      `;

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      expect(result.isEquivalent).toBe(false);
    });
  });

  // ============================================
  // 2. ЭКВИВАЛЕНТНОСТЬ ФУНКЦИЙ
  // ============================================

  describe('Эквивалентность функций', () => {
    it('должен определить эквивалентность двух реализаций сложения', async () => {
      const contract = {
        name: 'add',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function add(a, b) { return a + b; }',
        'function add(a, b) { const sum = a + b; return sum; }',
        contract
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти неэквивалентность функций с разной логикой', async () => {
      const contract = {
        name: 'add',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function add(a, b) { return a + b; }',
        'function add(a, b) { return a - b; }',
        contract
      );

      expect(result.isEquivalent).toBe(false);
    });

    it('должен определить эквивалентность рекурсивных функций', async () => {
      const contract = {
        name: 'factorial',
        params: [createIntParam('n')],
        returnType: 'int' as const,
        preconditions: [
          {
            type: 'range' as const,
            variable: 'n',
            min: 0,
            max: 10,
          },
        ],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }',
        'function factorial(n) { let result = 1; for (let i = 2; i <= n; i++) { result *= i; } return result; }',
        contract
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность функций с условиями', async () => {
      const contract = {
        name: 'abs',
        params: [createIntParam('x')],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function abs(x) { if (x < 0) return -x; return x; }',
        'function abs(x) { return x < 0 ? -x : x; }',
        contract
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность функций с несколькими условиями', async () => {
      const contract = {
        name: 'sign',
        params: [createIntParam('x')],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function sign(x) { if (x > 0) return 1; if (x < 0) return -1; return 0; }',
        'function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }',
        contract
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти неэквивалентность рекурсивных функций', async () => {
      const contract = {
        name: 'sum',
        params: [createIntParam('n')],
        returnType: 'int' as const,
        preconditions: [
          {
            type: 'range' as const,
            variable: 'n',
            min: 0,
            max: 10,
          },
        ],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function sum(n) { if (n <= 0) return 0; return n + sum(n - 1); }',
        'function sum(n) { if (n <= 0) return 0; return n + sum(n); }',
        contract
      );

      expect(result.isEquivalent).toBe(false);
    });

    it('должен определить эквивалентность функций с массивами', async () => {
      const contract = {
        name: 'sumArray',
        params: [
          { name: 'arr', type: 'int' as const },
          { name: 'length', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [
          {
            type: 'range' as const,
            variable: 'length',
            min: 0,
            max: 100,
          },
        ],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function sumArray(arr, length) { let sum = 0; for (let i = 0; i < length; i++) { sum += arr[i]; } return sum; }',
        'function sumArray(arr, length) { return arr.reduce((acc, val) => acc + val, 0); }',
        contract
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  // ============================================
  // 3. ЭКВИВАЛЕНТНОСТЬ ВЫРАЖЕНИЙ
  // ============================================

  describe('Эквивалентность выражений', () => {
    it('должен определить эквивалентность коммутативных выражений', async () => {
      const result = await checker.checkExpressionEquivalence(
        'a + b',
        'b + a',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
        ])
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность ассоциативных выражений', async () => {
      const result = await checker.checkExpressionEquivalence(
        '(a + b) + c',
        'a + (b + c)',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
          ['c', 'int'],
        ])
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность дистрибутивных выражений', async () => {
      const result = await checker.checkExpressionEquivalence(
        'a * (b + c)',
        'a * b + a * c',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
          ['c', 'int'],
        ])
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти неэквивалентность логических выражений', async () => {
      const result = await checker.checkExpressionEquivalence(
        'a && b',
        'a || b',
        new Map([
          ['a', 'bool'],
          ['b', 'bool'],
        ])
      );

      expect(result.isEquivalent).toBe(false);
    });

    it('должен определить эквивалентность логических выражений (закон Де Моргана)', async () => {
      const result = await checker.checkExpressionEquivalence(
        '!(a && b)',
        '!a || !b',
        new Map([
          ['a', 'bool'],
          ['b', 'bool'],
        ])
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность логических выражений (закон Де Моргана 2)', async () => {
      const result = await checker.checkExpressionEquivalence(
        '!(a || b)',
        '!a && !b',
        new Map([
          ['a', 'bool'],
          ['b', 'bool'],
        ])
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность выражений с числами', async () => {
      const result = await checker.checkExpressionEquivalence(
        'a * 2 + b * 2',
        '(a + b) * 2',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
        ])
      );

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти неэквивалентность выражений с числами', async () => {
      const result = await checker.checkExpressionEquivalence(
        'a * 2 + b * 2',
        '(a + b) * 3',
        new Map([
          ['a', 'int'],
          ['b', 'int'],
        ])
      );

      expect(result.isEquivalent).toBe(false);
    });
  });

  // ============================================
  // 4. ГЕНЕРАЦИЯ ОТЧЕТОВ
  // ============================================

  describe('Генерация отчетов', () => {
    it('должен генерировать отчет об эквивалентности для неэквивалентных файлов', async () => {
      const file1Content = 'function add(a, b) { return a + b; }';
      const file2Content = 'function add(a, b) { return a * b; }';

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      const report = checker.generateReport(result);
      expect(report).toContain('NOT EQUIVALENT');
      expect(report).toContain('Differences found');
    });

    it('должен генерировать отчет для эквивалентных файлов', async () => {
      const file1Content = 'function add(a, b) { return a + b; }';
      const file2Content = 'function add(a, b) { return a + b; }';

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2);
      const report = checker.generateReport(result);

      expect(report).toContain('EQUIVALENT');
    });

    it('должен генерировать отчет с контрпримером', async () => {
      const contract = {
        name: 'add',
        params: [createIntParam('a'), createIntParam('b')],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(
        'function add(a, b) { return a + b; }',
        'function add(a, b) { return a - b; }',
        contract
      );

      const report = checker.generateReport(result);
      expect(report).toContain('NOT EQUIVALENT');
      expect(report).toContain('Counterexample');
    });

    it('должен генерировать детальный отчет с различиями', async () => {
      const file1Content = `
        function process(x) {
          if (x > 0) {
            return x * 2;
          }
          return x / 2;
        }
      `;

      const file2Content = `
        function process(x) {
          if (x > 0) {
            return x * 3;
          }
          return x / 3;
        }
      `;

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      const report = checker.generateReport(result);
      expect(report).toContain('Differences found');
      expect(report).toContain('x * 2');
      expect(report).toContain('x * 3');
    });
  });

  // ============================================
  // 5. РАБОТА С АСТ
  // ============================================

  describe('Работа с AST', () => {
    it('должен сравнивать AST узлы на равенство', async () => {
      const ast1 = { type: 'Identifier', name: 'test' };
      const ast2 = { type: 'Identifier', name: 'test' };

      // @ts-ignore - обращение к приватному методу для теста
      const result = checker.isASTEqual(ast1, ast2);
      expect(result).toBe(true);
    });

    it('должен находить различия в AST узлах', async () => {
      const ast1 = { type: 'Identifier', name: 'test' };
      const ast2 = { type: 'Identifier', name: 'different' };

      // @ts-ignore - обращение к приватному методу для теста
      const result = checker.isASTEqual(ast1, ast2);
      expect(result).toBe(false);
    });

    it('должен находить все различия между AST', async () => {
      const ast1 = {
        type: 'Program',
        body: [{ type: 'FunctionDeclaration', name: 'add' }],
      };

      const ast2 = {
        type: 'Program',
        body: [{ type: 'FunctionDeclaration', name: 'subtract' }],
      };

      // @ts-ignore - обращение к приватному методу для теста
      const differences = checker.findAllDifferences(ast1, ast2);
      expect(differences.length).toBeGreaterThan(0);
    });

    it('должен корректно обрабатывать вложенные AST узлы', async () => {
      const ast1 = {
        type: 'Program',
        body: [
          {
            type: 'FunctionDeclaration',
            name: 'add',
            body: {
              type: 'BlockStatement',
              body: [
                { type: 'ReturnStatement', argument: { type: 'BinaryExpression', operator: '+' } },
              ],
            },
          },
        ],
      };

      const ast2 = {
        type: 'Program',
        body: [
          {
            type: 'FunctionDeclaration',
            name: 'add',
            body: {
              type: 'BlockStatement',
              body: [
                { type: 'ReturnStatement', argument: { type: 'BinaryExpression', operator: '+' } },
              ],
            },
          },
        ],
      };

      // @ts-ignore - обращение к приватному методу для теста
      const differences = checker.findAllDifferences(ast1, ast2);
      expect(differences.length).toBe(0);
    });
  });

  // ============================================
  // 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================

  describe('Вспомогательные функции', () => {
    it('должен корректно определять уровень уверенности', async () => {
      // Создаем результат для теста
      const result: any = {
        isEquivalent: true,
        confidence: 0.97,
        method: 'structural',
        time: 100,
      };

      // @ts-ignore - обращение к импортированным функциям
      const { confidenceLevel } = await import('../EquivalenceChecker.js');
      const level = confidenceLevel(result);
      expect(level).toBe('high');
    });

    it('должен определять необходимость ревью', async () => {
      const result: any = {
        isEquivalent: false,
        confidence: 0.6,
        method: 'partial',
        time: 100,
      };

      // @ts-ignore - обращение к импортированным функциям
      const { needsReview } = await import('../EquivalenceChecker.js');
      const review = needsReview(result);
      expect(review).toBe(true);
    });

    it('должен определять эквивалентность через вспомогательную функцию', async () => {
      const result: any = {
        isEquivalent: true,
        confidence: 1.0,
        method: 'formal',
        time: 100,
      };

      // @ts-ignore - обращение к импортированным функциям
      const { isEquivalent } = await import('../EquivalenceChecker.js');
      const eq = isEquivalent(result);
      expect(eq).toBe(true);
    });
  });

  // ============================================
  // 7. СЛОЖНЫЕ СЦЕНАРИИ
  // ============================================

  describe('Сложные сценарии', () => {
    it('должен определить эквивалентность файлов с несколькими функциями', async () => {
      const file1Content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
      `;

      const file2Content = `
        function multiply(a, b) { return a * b; }
        function add(a, b) { return a + b; }
        function calculate(a, b) { return multiply(a, add(a, b)); }
      `;

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти различия в сложных файлах', async () => {
      const file1Content = `
        function process(data) {
          const result = [];
          for (const item of data) {
            if (item.active) {
              result.push(item.value * 2);
            }
          }
          return result;
        }
      `;

      const file2Content = `
        function process(data) {
          const result = [];
          for (const item of data) {
            if (item.active) {
              result.push(item.value * 3);
            }
          }
          return result;
        }
      `;

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
    });

    it('должен определить эквивалентность файлов с разными именами функций', async () => {
      const file1Content = `
        function addNumbers(a, b) { return a + b; }
        export { addNumbers };
      `;

      const file2Content = `
        function sum(a, b) { return a + b; }
        export { sum as addNumbers };
      `;

      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      // Разные имена функций - не эквивалентны по сигнатуре
      expect(result.isEquivalent).toBe(false);
    });
  });

  // ============================================
  // 8. ПРОИЗВОДИТЕЛЬНОСТЬ
  // ============================================

  describe('Производительность', () => {
    it('должен обрабатывать большие файлы за разумное время', async () => {
      const largeContent = `
        function f1() { return 1; }
        function f2() { return 2; }
        function f3() { return 3; }
        function f4() { return 4; }
        function f5() { return 5; }
        function f6() { return 6; }
        function f7() { return 7; }
        function f8() { return 8; }
        function f9() { return 9; }
        function f10() { return 10; }
        function sum() { return f1() + f2() + f3() + f4() + f5() + f6() + f7() + f8() + f9() + f10(); }
        export { sum };
      `;

      const file1 = path.join(testDir, 'large1.js');
      const file2 = path.join(testDir, 'large2.js');

      fs.writeFileSync(file1, largeContent);
      fs.writeFileSync(file2, largeContent);

      const startTime = Date.now();

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      const duration = Date.now() - startTime;

      expect(result.isEquivalent).toBe(true);
      expect(duration).toBeLessThan(10000);
    });

    it('должен обрабатывать файлы с глубокой вложенностью', async () => {
      const deepContent = `
        function level1() { return level2(); }
        function level2() { return level3(); }
        function level3() { return level4(); }
        function level4() { return level5(); }
        function level5() { return level6(); }
        function level6() { return level7(); }
        function level7() { return level8(); }
        function level8() { return level9(); }
        function level9() { return level10(); }
        function level10() { return 42; }
        export { level1 };
      `;

      const file1 = path.join(testDir, 'deep1.js');
      const file2 = path.join(testDir, 'deep2.js');

      fs.writeFileSync(file1, deepContent);
      fs.writeFileSync(file2, deepContent);

      const result = await checker.checkFileEquivalence(file1, file2, {
        checkSemantic: true,
        formalVerification: true,
      });

      expect(result.isEquivalent).toBe(true);
    });
  });
});
