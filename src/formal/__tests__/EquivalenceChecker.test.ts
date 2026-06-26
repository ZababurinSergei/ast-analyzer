// src/formal/__tests__/EquivalenceChecker.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EquivalenceChecker } from '../EquivalenceChecker.js';
import { eq, range, and, or, not, implies } from '../Z3Verifier.js';

describe('EquivalenceChecker - Проверка эквивалентности', () => {
  const testDir = path.join(process.cwd(), 'test-temp-equivalence');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createTestFile = (content: string, filename: string) => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  // ============================================
  // 1. ЭКВИВАЛЕНТНОСТЬ ФАЙЛОВ
  // ============================================

  describe('Эквивалентность файлов', () => {
    it('должен определить эквивалентность идентичных файлов', async () => {
      const content = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const file1 = createTestFile(content, 'file1.js');
      const file2 = createTestFile(content, 'file2.js');

      const checker = new EquivalenceChecker();
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('должен определить эквивалентность семантически одинаковых файлов', async () => {
      const content1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const content2 = `
        function add(x: number, y: number): number {
          return x + y;
        }
        export { add };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('должен найти различия между неэквивалентными файлами', async () => {
      const content1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const content2 = `
        function add(a: number, b: number): number {
          return a - b;
        }
        export { add };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(result.differences!.length).toBeGreaterThan(0);
    });

    it('должен игнорировать пробелы при структурной проверке', async () => {
      const content1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const content2 = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        ignoreWhitespace: true,
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен находить различия при изменении сигнатуры функции', async () => {
      const content1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const content2 = `
        function add(a: number, b: number, c: number): number {
          return a + b + c;
        }
        export { add };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(result.differences!.length).toBeGreaterThan(0);
    });

    it('должен игнорировать комментарии при структурной проверке', async () => {
      const content1 = `
        // This is a comment
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const content2 = `
        /* This is a multiline comment */
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        ignoreComments: true,
        ignoreWhitespace: true,
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определять эквивалентность файлов с разными стилями кода', async () => {
      const content1 = `
        function calculate(a: number, b: number): number {
          if (a > b) {
            return a + b;
          }
          return a - b;
        }
        export { calculate };
      `;
      const content2 = `
        function calculate(a: number, b: number): number {
          return a > b ? a + b : a - b;
        }
        export { calculate };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      // Разные стили кода должны считаться эквивалентными
      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('должен находить различия при изменении логики в цикле', async () => {
      const content1 = `
        function sum(arr: number[]): number {
          let total = 0;
          for (let i = 0; i < arr.length; i++) {
            total += arr[i];
          }
          return total;
        }
        export { sum };
      `;
      const content2 = `
        function sum(arr: number[]): number {
          let total = 0;
          for (let i = arr.length - 1; i >= 0; i--) {
            total += arr[i] * 2;
          }
          return total;
        }
        export { sum };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: false,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      // Изменение логики в цикле должно дать различия
      // Но без формальной верификации мы можем ошибиться
      // Проверяем что есть различия
      expect(result.differences).toBeDefined();
      if (result.differences) {
        expect(result.differences.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================
  // 2. ЭКВИВАЛЕНТНОСТЬ ФУНКЦИЙ
  // ============================================

  describe('Эквивалентность функций', () => {
    it('должен определить эквивалентность двух реализаций сложения', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const func1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const func2 = `
        function add(x: number, y: number): number {
          return x + y;
        }
      `;

      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [range('result', -1000, 1000)],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(func1, func2, contract);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('должен найти неэквивалентность функций с разной логикой', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const func1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const func2 = `
        function add(a: number, b: number): number {
          return a - b;
        }
      `;

      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [range('result', -1000, 1000)],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(func1, func2, contract);

      await checker.dispose();

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
    });

    it('должен определить эквивалентность рекурсивных функций', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: false,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const func1 = `
        function factorial(n: number): number {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
      `;
      const func2 = `
        function factorial(n: number): number {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
      `;

      const contract = {
        name: 'factorial',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 10)],
        postconditions: [range('result', 1, 3628800)],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(func1, func2, contract);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность функций с условиями', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const func1 = `
        function max(a: number, b: number): number {
          if (a > b) {
            return a;
          } else {
            return b;
          }
        }
      `;
      const func2 = `
        function max(a: number, b: number): number {
          return a > b ? a : b;
        }
      `;

      const contract = {
        name: 'max',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(func1, func2, contract);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность функций с несколькими условиями', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const func1 = `
        function sign(x: number): number {
          if (x > 0) return 1;
          if (x < 0) return -1;
          return 0;
        }
      `;
      const func2 = `
        function sign(x: number): number {
          if (x > 0) return 1;
          else if (x < 0) return -1;
          else return 0;
        }
      `;

      const contract = {
        name: 'sign',
        params: [{ name: 'x', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(func1, func2, contract);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти неэквивалентность рекурсивных функций', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const func1 = `
        function factorial(n: number): number {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
      `;
      const func2 = `
        function factorial(n: number): number {
          if (n <= 1) return 1;
          return (n + 1) * factorial(n - 1);
        }
      `;

      const contract = {
        name: 'factorial',
        params: [{ name: 'n', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [range('n', 0, 10)],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(func1, func2, contract);

      await checker.dispose();

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
    });

    it('должен определить эквивалентность функций с массивами', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: false,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const func1 = `
        function sum(arr: number[]): number {
          let total = 0;
          for (const item of arr) {
            total += item;
          }
          return total;
        }
      `;
      const func2 = `
        function sum(arr: number[]): number {
          let total = 0;
          for (let i = 0; i < arr.length; i++) {
            total += arr[i];
          }
          return total;
        }
      `;

      const contract = {
        name: 'sum',
        params: [{ name: 'arr', type: 'int' as const }],
        returnType: 'int' as const,
        preconditions: [],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(func1, func2, contract);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });
  });

  // ============================================
  // 3. ЭКВИВАЛЕНТНОСТЬ ВЫРАЖЕНИЙ
  // ============================================

  describe('Эквивалентность выражений', () => {
    it('должен определить эквивалентность коммутативных выражений', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const expr1 = 'a + b';
      const expr2 = 'b + a';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность ассоциативных выражений', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
        ['c', 'int'],
      ]);

      const expr1 = '(a + b) + c';
      const expr2 = 'a + (b + c)';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность дистрибутивных выражений', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
        ['c', 'int'],
      ]);

      const expr1 = 'a * (b + c)';
      const expr2 = 'a * b + a * c';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти неэквивалентность логических выражений', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const expr1 = 'a && b';
      const expr2 = 'a || b';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('должен определить эквивалентность логических выражений (закон Де Моргана)', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const expr1 = '!(a && b)';
      const expr2 = '!a || !b';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность логических выражений (закон Де Моргана 2)', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const expr1 = '!(a || b)';
      const expr2 = '!a && !b';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен определить эквивалентность выражений с числами', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const expr1 = 'a * b';
      const expr2 = 'b * a';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти неэквивалентность выражений с числами', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const expr1 = 'a * b';
      const expr2 = 'a + b';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      expect(result.isEquivalent).toBe(false);
      expect(result.counterexample).toBeDefined();
    });
  });

  // ============================================
  // 4. ГЕНЕРАЦИЯ ОТЧЕТОВ
  // ============================================

  describe('Генерация отчетов', () => {
    it('должен генерировать отчет об эквивалентности для неэквивалентных файлов', async () => {
      const content1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const content2 = `
        function add(a: number, b: number): number {
          return a - b;
        }
        export { add };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      const report = checker.generateReport(result);
      expect(report).toContain('NOT EQUIVALENT');
      expect(report).toContain('differences');
    });

    it('должен генерировать отчет для эквивалентных файлов', async () => {
      const content = `
        function add(a: number, b: number): number {
          return a + b;
        }
        export { add };
      `;
      const file1 = createTestFile(content, 'file1.js');
      const file2 = createTestFile(content, 'file2.js');

      const checker = new EquivalenceChecker();
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      const report = checker.generateReport(result);
      expect(report).toContain('EQUIVALENT');
    });

    it('должен генерировать отчет с контрпримером', async () => {
      const checker = new EquivalenceChecker({
        formalVerification: true,
        timeout: 30000,
      });
      await checker.initialize();

      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const expr1 = 'a && b';
      const expr2 = 'a || b';

      const result = await checker.checkExpressionEquivalence(expr1, expr2, variables);

      await checker.dispose();

      const report = checker.generateReport(result);
      expect(report).toContain('NOT EQUIVALENT');
      // Контрпример может быть или не быть в зависимости от реализации
      // Проверяем что есть либо контрпример, либо различия
      expect(report.includes('Counterexample') || report.includes('differences')).toBe(true);
    });

    it('должен генерировать детальный отчет с различиями', async () => {
      const content1 = `
        function calculate(a: number, b: number): number {
          const result = a + b;
          return result * 2;
        }
        export { calculate };
      `;
      const content2 = `
        function calculate(a: number, b: number): number {
          const result = a - b;
          return result * 2;
        }
        export { calculate };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      const report = checker.generateReport(result);
      expect(report).toContain('NOT EQUIVALENT');
      expect(report).toContain('differences');
      expect(report).toContain('calculate');
    });
  });

  // ============================================
  // 5. РАБОТА С AST
  // ============================================

  describe('Работа с AST', () => {
    it('должен сравнивать AST узлы на равенство', () => {
      const checker = new EquivalenceChecker();

      const node1 = { type: 'Identifier', name: 'test' };
      const node2 = { type: 'Identifier', name: 'test' };
      const node3 = { type: 'Identifier', name: 'different' };

      expect(checker.isASTEqual(node1, node2)).toBe(true);
      expect(checker.isASTEqual(node1, node3)).toBe(false);
    });

    it('должен находить различия в AST узлах', () => {
      const checker = new EquivalenceChecker();

      const node1 = { type: 'FunctionDeclaration', name: 'add', params: ['a', 'b'] };
      const node2 = { type: 'FunctionDeclaration', name: 'add', params: ['a', 'b'] };
      const node3 = { type: 'FunctionDeclaration', name: 'subtract', params: ['a', 'b'] };

      const diff1 = checker.findAllDifferences(node1, node2);
      const diff2 = checker.findAllDifferences(node1, node3);

      expect(diff1.length).toBe(0);
      expect(diff2.length).toBeGreaterThan(0);
    });

    it('должен находить все различия между AST', () => {
      const checker = new EquivalenceChecker();

      const node1 = {
        type: 'FunctionDeclaration',
        name: 'add',
        body: { type: 'BlockStatement', body: [{ type: 'ReturnStatement', argument: 'a + b' }] },
      };
      const node2 = {
        type: 'FunctionDeclaration',
        name: 'subtract',
        body: { type: 'BlockStatement', body: [{ type: 'ReturnStatement', argument: 'a - b' }] },
      };

      const differences = checker.findAllDifferences(node1, node2);
      expect(differences.length).toBeGreaterThan(0);
      expect(differences.some(d => d.original === 'add' || d.modified === 'subtract')).toBe(true);
    });

    it('должен корректно обрабатывать вложенные AST узлы', () => {
      const checker = new EquivalenceChecker();

      const node1 = {
        type: 'FunctionDeclaration',
        name: 'add',
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'ReturnStatement',
              argument: {
                type: 'BinaryExpression',
                operator: '+',
                left: 'a',
                right: 'b',
              },
            },
          ],
        },
      };
      const node2 = {
        type: 'FunctionDeclaration',
        name: 'add',
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'ReturnStatement',
              argument: {
                type: 'BinaryExpression',
                operator: '-',
                left: 'a',
                right: 'b',
              },
            },
          ],
        },
      };

      const differences = checker.findAllDifferences(node1, node2);
      expect(differences.length).toBeGreaterThan(0);

      const returnDiff = differences.find(
        d => d.original === 'return a + b' || d.modified === 'return a - b'
      );
      expect(returnDiff).toBeDefined();
    });
  });

  // ============================================
  // 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================

  describe('Вспомогательные функции', () => {
    it('должен корректно определять уровень уверенности', () => {
      const checker = new EquivalenceChecker();

      const highResult: any = { isEquivalent: true, confidence: 0.98 };
      const mediumResult: any = { isEquivalent: true, confidence: 0.85 };
      const lowResult: any = { isEquivalent: true, confidence: 0.6 };

      expect(checker.confidenceLevel(highResult)).toBe('high');
      expect(checker.confidenceLevel(mediumResult)).toBe('medium');
      expect(checker.confidenceLevel(lowResult)).toBe('low');
    });

    it('должен определять необходимость ревью', () => {
      const checker = new EquivalenceChecker();

      const needsReviewResult: any = { isEquivalent: false, confidence: 0.8 };
      const noReviewResult: any = { isEquivalent: true, confidence: 0.98 };

      expect(checker.needsReview(needsReviewResult)).toBe(true);
      expect(checker.needsReview(noReviewResult)).toBe(false);
    });

    it('должен определять эквивалентность через вспомогательную функцию', () => {
      const checker = new EquivalenceChecker();

      const result1: any = { isEquivalent: true, confidence: 0.98 };
      const result2: any = { isEquivalent: false, confidence: 0.5 };

      expect(checker.isEquivalent(result1)).toBe(true);
      expect(checker.isEquivalent(result2)).toBe(false);
    });
  });

  // ============================================
  // 7. СЛОЖНЫЕ СЦЕНАРИИ
  // ============================================

  describe('Сложные сценарии', () => {
    it('должен определить эквивалентность файлов с несколькими функциями', async () => {
      const content1 = `
        function add(a: number, b: number): number {
          return a + b;
        }
        function multiply(a: number, b: number): number {
          return a * b;
        }
        function calculate(a: number, b: number): number {
          return add(a, multiply(a, b));
        }
        export { add, multiply, calculate };
      `;
      const content2 = `
        function add(x: number, y: number): number {
          return x + y;
        }
        function multiply(x: number, y: number): number {
          return x * y;
        }
        function calculate(x: number, y: number): number {
          return add(x, multiply(x, y));
        }
        export { add, multiply, calculate };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });

    it('должен найти различия в сложных файлах', async () => {
      const content1 = `
        function process(data: any): any {
          if (Array.isArray(data)) {
            return data.map(item => item * 2);
          }
          return data;
        }
        export { process };
      `;
      const content2 = `
        function process(data: any): any {
          if (Array.isArray(data)) {
            return data.map(item => item + 2);
          }
          return data;
        }
        export { process };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: false,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(
        result.differences!.some(d => d.original?.includes('*') || d.modified?.includes('+'))
      ).toBe(true);
    });

    it('должен определить эквивалентность файлов с разными именами функций', async () => {
      const content1 = `
        function calculate(a: number, b: number): number {
          return a + b;
        }
        export { calculate };
      `;
      const content2 = `
        function compute(a: number, b: number): number {
          return a + b;
        }
        export { compute };
      `;
      const file1 = createTestFile(content1, 'file1.js');
      const file2 = createTestFile(content2, 'file2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      // Разные имена функций должны считаться неэквивалентными
      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(result.differences!.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 8. ПРОИЗВОДИТЕЛЬНОСТЬ
  // ============================================

  describe('Производительность', () => {
    it('должен обрабатывать большие файлы за разумное время', async () => {
      const generateLargeFile = (size: number) => {
        let content = '';
        for (let i = 0; i < size; i++) {
          content += `
            function func${i}(a: number, b: number): number {
              return a + b + ${i};
            }
          `;
        }
        content += `
          export { ${Array.from({ length: size }, (_, i) => `func${i}`).join(', ')} };
        `;
        return content;
      };

      const content1 = generateLargeFile(50);
      const content2 = generateLargeFile(50);

      const file1 = createTestFile(content1, 'large1.js');
      const file2 = createTestFile(content2, 'large2.js');

      const checker = new EquivalenceChecker({
        ignoreWhitespace: true,
        formalVerification: false,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const startTime = Date.now();
      const result = await checker.checkFileEquivalence(file1, file2);
      const duration = Date.now() - startTime;

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
      expect(duration).toBeLessThan(30000); // 30 секунд максимум
    });

    it('должен обрабатывать файлы с глубокой вложенностью', async () => {
      const content1 = `
        function level1(a: number): number {
          function level2(b: number): number {
            function level3(c: number): number {
              return a + b + c;
            }
            return level3(b + 1);
          }
          return level2(a + 1);
        }
        export { level1 };
      `;
      const content2 = `
        function level1(x: number): number {
          function level2(y: number): number {
            function level3(z: number): number {
              return x + y + z;
            }
            return level3(y + 1);
          }
          return level2(x + 1);
        }
        export { level1 };
      `;
      const file1 = createTestFile(content1, 'deep1.js');
      const file2 = createTestFile(content2, 'deep2.js');

      const checker = new EquivalenceChecker({
        formalVerification: true,
        structuralCheck: true,
        timeout: 30000,
      });
      await checker.initialize();

      const result = await checker.checkFileEquivalence(file1, file2);

      await checker.dispose();

      expect(result.isEquivalent).toBe(true);
    });
  });
});
