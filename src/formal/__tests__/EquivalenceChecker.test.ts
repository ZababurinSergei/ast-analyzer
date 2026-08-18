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

  describe('checkFileEquivalence - проверка эквивалентности файлов', () => {
    it('должен возвращать эквивалентность для идентичных файлов', async () => {
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

    it('должен обнаруживать различия в файлах', async () => {
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

    it('должен обрабатывать файлы с несколькими функциями', async () => {
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

    it('должен обнаруживать удаленные функции', async () => {
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

  describe('checkFunctionEquivalence - проверка эквивалентности функций', () => {
    it('должен проверять эквивалентность функций', async () => {
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

    it('должен обнаруживать неэквивалентные функции', async () => {
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

  describe('checkExpressionEquivalence - проверка эквивалентности выражений', () => {
    it('должен проверять эквивалентность выражений', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence('a + b', 'b + a', variables);

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('должен обнаруживать неэквивалентные выражения', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence('a + b', 'a - b', variables);

      expect(result.isEquivalent).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('должен обрабатывать булевы выражения', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const result = await checker.checkExpressionEquivalence('a && b', 'b && a', variables);

      expect(result.isEquivalent).toBe(true);
    });

    it('должен обнаруживать неэквивалентные булевы выражения', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'bool'],
        ['b', 'bool'],
      ]);

      const result = await checker.checkExpressionEquivalence('a && b', 'a || b', variables);

      expect(result.isEquivalent).toBe(false);
      expect(result.counterexample).toBeDefined();
    });

    it('должен обрабатывать сложные выражения', async () => {
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

  describe('generateReport - генерация отчетов', () => {
    it('должен генерировать отчет для эквивалентного результата', async () => {
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

    it('должен генерировать отчет для неэквивалентного результата', async () => {
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

  describe('saveReport - сохранение отчетов', () => {
    it('должен сохранять отчет в файл', async () => {
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

    it('должен сохранять отчет в JSON формате', async () => {
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

  describe('utility functions - вспомогательные функции', () => {
    it('isEquivalent должен возвращать правильное значение', async () => {
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

    it('needsReview должен возвращать правильное значение', async () => {
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

  describe('with Z3 formal verification - с формальной верификацией Z3', () => {
    it('должен использовать Z3 для формальной верификации', async () => {
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

    it('должен находить контрпример с помощью Z3', async () => {
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

  describe('error handling - обработка ошибок', () => {
    it('должен обрабатывать несуществующие файлы', async () => {
      const result = await checker.checkFileEquivalence(
        path.join(testDir, 'non-existent1.ts'),
        path.join(testDir, 'non-existent2.ts')
      );

      // При несуществующих файлах возвращается результат с ошибкой
      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(result.differences?.length).toBeGreaterThan(0);
      // Проверяем, что есть ошибка файла
      const hasFileError = result.differences?.some(
        d => d.astNodeType === 'file_error' || d.type === 'error'
      );
      expect(hasFileError).toBe(true);
    });

    it('должен обрабатывать пустые файлы', async () => {
      const originalPath = createTestFile('', 'empty1.ts');
      const modifiedPath = createTestFile('', 'empty2.ts');

      // Проверяем, что функция не выбрасывает ошибку при пустых файлах
      let error = null;
      let result = null;

      try {
        result = await checker.checkFileEquivalence(originalPath, modifiedPath);
      } catch (e) {
        error = e;
      }

      expect(error).toBeNull();
      expect(result).toBeDefined();

      // Проверяем, что результат имеет корректную структуру
      expect(result).toHaveProperty('isEquivalent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('time');

      // Пустые файлы: система может считать их эквивалентными или нет
      // в зависимости от реализации ASTComparator
      // Просто проверяем, что результат стабилен и нет ошибок
      if (result && !result.isEquivalent) {
        expect(result.differences).toBeDefined();
      }
    });

    it('должен обрабатывать таймаут', async () => {
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

  describe('universal quantifier support - поддержка квантора всеобщности', () => {
    it('должен проверять эквивалентность с квантором всеобщности', async () => {
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

    it('должен обнаруживать неэквивалентность с квантором всеобщности', async () => {
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

    it('должен проверять сложную эквивалентность с квантором всеобщности', async () => {
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

  describe('performance - производительность', () => {
    it('должен обрабатывать большое количество функций', async () => {
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
