// src/formal/__tests__/EquivalenceChecker.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EquivalenceChecker, isEquivalent, needsReview } from '../checkers/EquivalenceChecker.js';
import { Z3Verifier, range } from '../Z3Verifier.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('EquivalenceChecker', () => {
  let testDir: string;
  let z3Verifier: Z3Verifier;
  let checker: EquivalenceChecker;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'equiv-test-'));
    z3Verifier = new Z3Verifier();
    await z3Verifier.initialize();
    checker = new EquivalenceChecker({}, z3Verifier);
    await checker.initialize();
  });

  afterEach(async () => {
    await checker.dispose();
    await z3Verifier.dispose();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createTestFile = (content: string, filename: string): string => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  };

  describe('checkFileEquivalence', () => {
    it('should return equivalent for identical files', async () => {
      const content = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      // Для идентичных файлов используется structural метод
      expect(['structural', 'formal']).toContain(result.method);
    });

    it('should detect differences in files', async () => {
      const originalContent = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const modifiedContent = `export function add(a: number, b: number): number {
        return a - b;
      }`;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.differences).toBeDefined();
      // Проверяем, что найдены semantic различия (Z3 нашел контрпример)
      const hasSemanticDiff = result.differences?.some(d => d.type === 'semantic');
      expect(hasSemanticDiff).toBe(true);
    });

    it('should handle files with multiple functions', async () => {
      const originalContent = `export function add(a: number, b: number): number {
        return a + b;
      }
      
      export function multiply(a: number, b: number): number {
        return a * b;
      }`;

      const modifiedContent = `export function add(a: number, b: number): number {
        return a + b;
      }
      
      export function multiply(a: number, b: number): number {
        return b * a;
      }`;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      // Файлы эквивалентны, т.к. a * b == b * a (коммутативность)
      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect removed functions', async () => {
      const originalContent = `export function add(a: number, b: number): number {
        return a + b;
      }
      
      export function multiply(a: number, b: number): number {
        return a * b;
      }`;

      const modifiedContent = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      // Удаление функции делает файлы неэквивалентными
      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();

      // Проверяем, что есть разница в количестве функций
      const hasFuncDiff = result.differences?.some(
        d =>
          d.astNodeType === 'function_count' ||
          d.type === 'removed' ||
          d.original?.includes('function count')
      );
      expect(hasFuncDiff).toBe(true);
    });
  });

  describe('checkFunctionEquivalence', () => {
    it('should check function equivalence', async () => {
      const original = 'return a + b;';
      const modified = 'return b + a;';

      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', -1000, 1000), range('b', -1000, 1000)],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(original, modified, contract);

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      // Для функций Z3 проверка является основным методом
      expect(result.method).toBe('formal');
    });

    it('should detect non-equivalent functions', async () => {
      const original = 'return a + b;';
      const modified = 'return a - b;';

      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', -1000, 1000), range('b', -1000, 1000)],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(original, modified, contract);

      expect(result.isEquivalent).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.counterexample).toBeDefined();
    });
  });

  describe('checkExpressionEquivalence', () => {
    it('should check expression equivalence', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence('a + b', 'b + a', variables);

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect non-equivalent expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence('a + b', 'a - b', variables);

      expect(result.isEquivalent).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('should handle boolean expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const result = await checker.checkExpressionEquivalence('a && b', 'b && a', variables);

      expect(result.isEquivalent).toBe(true);
    });

    it('should detect non-equivalent boolean expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const result = await checker.checkExpressionEquivalence('a && b', 'a || b', variables);

      expect(result.isEquivalent).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('should handle complex expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
        ['c', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence(
        '(a + b) * c',
        'c * (b + a)',
        variables
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate report for equivalent result', async () => {
      const content = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);
      const report = checker.generateReport(result);

      expect(report).toContain('EQUIVALENCE CHECK REPORT');
      expect(report).toContain('Status: ✅ EQUIVALENT');
    });

    it('should generate report for non-equivalent result', async () => {
      const originalContent = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const modifiedContent = `export function add(a: number, b: number): number {
        return a - b;
      }`;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);
      const report = checker.generateReport(result);

      expect(report).toContain('EQUIVALENCE CHECK REPORT');
      expect(report).toContain('❌ NOT EQUIVALENT');
      // Проверяем наличие секции с различиями
      expect(report).toMatch(/(📋 ALL DIFFERENCES|📋 Differences)/);
      // Проверяем наличие информации о формальной верификации
      expect(report).toContain('FORMAL VERIFICATION (Z3)');
    });
  });

  describe('saveReport', () => {
    it('should save report to file', async () => {
      const content = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);
      const reportPath = path.join(testDir, 'report.md');

      await checker.saveReport(result, reportPath);
      expect(fs.existsSync(reportPath)).toBe(true);

      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      expect(reportContent).toContain('EQUIVALENCE CHECK REPORT');
    });

    it('should save JSON report', async () => {
      const content = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);
      const reportPath = path.join(testDir, 'report.json');

      await checker.saveReport(result, reportPath);
      expect(fs.existsSync(reportPath)).toBe(true);

      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      const json = JSON.parse(reportContent);

      expect(json.isEquivalent).toBe(true);
      // Для идентичных файлов может быть structural или formal
      expect(['structural', 'formal']).toContain(json.method);
      expect(json.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('utility functions', () => {
    it('isEquivalent should return correct value', async () => {
      const content = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(isEquivalent(result)).toBe(true);

      // Создаем неэквивалентный результат
      const nonEquivResult = await checker.checkFileEquivalence(
        createTestFile(
          'export function add(a: number, b: number): number { return a + b; }',
          'orig2.ts'
        ),
        createTestFile(
          'export function add(a: number, b: number): number { return a - b; }',
          'mod2.ts'
        )
      );

      expect(isEquivalent(nonEquivResult)).toBe(false);
    });

    it('needsReview should return correct value', async () => {
      const content = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(needsReview(result)).toBe(false);

      // Неэквивалентный результат требует обзора
      const nonEquivResult = await checker.checkFileEquivalence(
        createTestFile(
          'export function add(a: number, b: number): number { return a + b; }',
          'orig3.ts'
        ),
        createTestFile(
          'export function add(a: number, b: number): number { return a - b; }',
          'mod3.ts'
        )
      );

      expect(needsReview(nonEquivResult)).toBe(true);
    });
  });

  describe('with Z3 formal verification', () => {
    it('should use Z3 for formal verification', async () => {
      const originalContent = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const modifiedContent = `export function add(a: number, b: number): number {
        return b + a;
      }`;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(true);
      expect(result.formalResult).toBeDefined();
      expect(result.formalResult?.isValid).toBe(true);
    });

    it('should find counterexample with Z3', async () => {
      const originalContent = `export function add(a: number, b: number): number {
        return a + b;
      }`;

      const modifiedContent = `export function add(a: number, b: number): number {
        return a - b;
      }`;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(false);
      expect(result.formalResult).toBeDefined();
      expect(result.formalResult?.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle non-existent files', async () => {
      const result = await checker.checkFileEquivalence(
        path.join(testDir, 'non-existent1.ts'),
        path.join(testDir, 'non-existent2.ts')
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(result.differences?.length).toBeGreaterThan(0);
    });

    it('should handle empty files', async () => {
      const originalPath = createTestFile('', 'empty1.ts');
      const modifiedPath = createTestFile('', 'empty2.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      // Пустые файлы эквивалентны
      expect(result.isEquivalent).toBe(true);
    });

    it('should handle timeout', async () => {
      const largeContent = Array.from(
        { length: 100 },
        (_, i) => `export function func${i}(a: number, b: number): number { return a + b; }`
      ).join('\n');

      const originalPath = createTestFile(largeContent, 'large1.ts');
      const modifiedPath = createTestFile(largeContent, 'large2.ts');

      // Устанавливаем очень маленький таймаут
      const result = await checker.checkFileEquivalence(originalPath, modifiedPath, {
        timeout: 1,
      });

      // При таймауте результат должен быть false с низкой уверенностью
      // Или true если файлы идентичны и проверка прошла до таймаута
      // В любом случае, время должно быть меньше или равно таймауту + небольшая погрешность
      expect(result.time).toBeLessThanOrEqual(100);
    });
  });

  describe('universal quantifier support', () => {
    it('should verify equivalence with forall quantifier', async () => {
      const original = 'return a + b;';
      const modified = 'return b + a;';

      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', -1000, 1000), range('b', -1000, 1000)],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(original, modified, contract);

      expect(result.isEquivalent).toBe(true);
      expect(result.formalResult).toBeDefined();
      expect(result.formalResult?.isValid).toBe(true);
    });

    it('should detect non-equivalence with forall quantifier', async () => {
      const original = 'return a + b;';
      const modified = 'return a - b;';

      const contract = {
        name: 'add',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', -1000, 1000), range('b', -1000, 1000)],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(original, modified, contract);

      expect(result.isEquivalent).toBe(false);
      expect(result.formalResult).toBeDefined();
      expect(result.formalResult?.isValid).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('should verify complex equivalence with forall', async () => {
      const original = 'return (a + b) * 2;';
      const modified = 'return 2 * (b + a);';

      const contract = {
        name: 'complex',
        params: [
          { name: 'a', type: 'int' as const },
          { name: 'b', type: 'int' as const },
        ],
        returnType: 'int' as const,
        preconditions: [range('a', -1000, 1000), range('b', -1000, 1000)],
        postconditions: [],
        invariants: [],
      };

      const result = await checker.checkFunctionEquivalence(original, modified, contract);

      expect(result.isEquivalent).toBe(true);
    });
  });

  describe('performance', () => {
    it('should handle large number of functions', async () => {
      const functions = Array.from(
        { length: 50 },
        (_, i) => `export function func${i}(a: number, b: number): number { return a + b; }`
      ).join('\n');

      const originalPath = createTestFile(functions, 'large-original.ts');
      const modifiedPath = createTestFile(functions, 'large-modified.ts');

      const start = Date.now();
      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);
      const duration = Date.now() - start;

      expect(result.isEquivalent).toBe(true);
      expect(duration).toBeLessThan(5000);
    });
  });
});
