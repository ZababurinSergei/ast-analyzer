// packages/ast-analyzer/src/formal/__tests__/EquivalenceChecker.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EquivalenceChecker } from '../checkers/EquivalenceChecker.js';
import { Z3Verifier } from '../Z3Verifier.js';
import fs from 'fs';
import path from 'path';

describe('EquivalenceChecker', () => {
  const testDir = path.join(process.cwd(), 'test-temp-equivalence-checker');
  let checker: EquivalenceChecker;
  let z3Verifier: Z3Verifier;

  beforeEach(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

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
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect differences in files', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a * b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(result.differences?.length).toBeGreaterThan(0);
    });

    it('should handle files with multiple functions', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function sub(a: number, b: number): number {
          return a - b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function sub(a: number, b: number): number {
          return b - a;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(false);
    });

    it('should detect added functions', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function sub(a: number, b: number): number {
          return a - b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result).toBeDefined();
    });

    it('should detect removed functions', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function sub(a: number, b: number): number {
          return a - b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(false);
    });
  });

  describe('checkFunctionEquivalence', () => {
    it('should check function equivalence', async () => {
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

      const originalFunction = 'return a + b;';
      const modifiedFunction = 'return b + a;';

      const result = await checker.checkFunctionEquivalence(
        originalFunction,
        modifiedFunction,
        contract
      );

      expect(result).toBeDefined();
    });

    it('should detect non-equivalent functions', async () => {
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

      const originalFunction = 'return a + b;';
      const modifiedFunction = 'return a * b;';

      console.log('arguments', originalFunction, modifiedFunction, contract);
      const result = await checker.checkFunctionEquivalence(
        originalFunction,
        modifiedFunction,
        contract
      );

      console.log('result', result);
      expect(result.isEquivalent).toBe(false);
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
    });

    it('should detect non-equivalent expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence('a + b', 'a * b', variables);

      expect(result.isEquivalent).toBe(false);
    });

    it('should handle boolean expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence('a > b', 'b < a', variables);

      expect(result.isEquivalent).toBe(true);
    });

    it('should detect non-equivalent boolean expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence('a > b', 'a >= b', variables);

      expect(result.isEquivalent).toBe(false);
    });

    it('should handle complex expressions', async () => {
      const variables = new Map<string, 'int' | 'bool' | 'string'>([
        ['a', 'int'],
        ['b', 'int'],
        ['c', 'int'],
      ]);

      const result = await checker.checkExpressionEquivalence(
        '(a + b) * c',
        'c * (a + b)',
        variables
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate report for equivalent result', async () => {
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      const report = checker.generateReport(result);
      expect(report).toContain('EQUIVALENT');
      expect(report).toContain('✅');
    });

    it('should generate report for non-equivalent result', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a * b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      const report = checker.generateReport(result);
      expect(report).toContain('NOT EQUIVALENT');
      expect(report).toContain('❌');
    });
  });

  describe('saveReport', () => {
    it('should save report to file', async () => {
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      const reportPath = path.join(testDir, 'equivalence-report.md');
      await checker.saveReport(result, reportPath);

      expect(fs.existsSync(reportPath)).toBe(true);
      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      expect(reportContent).toContain('EQUIVALENT');
    });

    it('should save JSON report', async () => {
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      const reportPath = path.join(testDir, 'equivalence-report.json');
      await checker.saveReport(result, reportPath);

      expect(fs.existsSync(reportPath)).toBe(true);
      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      const parsed = JSON.parse(reportContent);
      expect(parsed.isEquivalent).toBe(true);
    });
  });

  describe('utility functions', () => {
    it('isEquivalent should return correct value', async () => {
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const modifiedPath = createTestFile(content, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      const { isEquivalent } = await import('../checkers/EquivalenceChecker.js');
      expect(isEquivalent(result)).toBe(true);
    });

    it('needsReview should return correct value', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a * b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      const { needsReview } = await import('../checkers/EquivalenceChecker.js');
      expect(needsReview(result)).toBe(true);
    });
  });

  describe('with Z3 formal verification', () => {
    it('should use Z3 for formal verification', async () => {
      const checkerWithZ3 = new EquivalenceChecker({ formalVerification: true }, z3Verifier);
      await checkerWithZ3.initialize();

      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return b + a;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checkerWithZ3.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(true);
      expect(result.method).toBe('formal+structural');

      await checkerWithZ3.dispose();
    });

    it('should find counterexample with Z3', async () => {
      const checkerWithZ3 = new EquivalenceChecker({ formalVerification: true }, z3Verifier);
      await checkerWithZ3.initialize();

      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a * b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checkerWithZ3.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(false);
      expect(result.formalResult).toBeDefined();

      await checkerWithZ3.dispose();
    });
  });

  describe('error handling', () => {
    it('should handle non-existent files', async () => {
      const result = await checker.checkFileEquivalence(
        '/non/existent/file1.ts',
        '/non/existent/file2.ts'
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.differences).toBeDefined();
    });

    it('should handle empty files', async () => {
      const originalPath = createTestFile('', 'original.ts');
      const modifiedPath = createTestFile('', 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath);

      expect(result.isEquivalent).toBe(true);
    });

    it('should handle timeout', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const modifiedContent = `
        export function add(a: number, b: number): number {
          return a * b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const modifiedPath = createTestFile(modifiedContent, 'modified.ts');

      const result = await checker.checkFileEquivalence(originalPath, modifiedPath, {
        timeout: 100,
      });

      expect(result).toBeDefined();
    });
  });
});
