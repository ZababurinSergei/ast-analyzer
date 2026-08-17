// packages/ast-analyzer/src/formal/__tests__/RefactoringEquivalenceChecker.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RefactoringEquivalenceChecker } from '../checkers/RefactoringEquivalenceChecker.js';
import { Z3Verifier } from '../Z3Verifier.js';
import fs from 'fs';
import path from 'path';

describe('RefactoringEquivalenceChecker', () => {
  const testDir = path.join(process.cwd(), 'test-temp-equivalence');
  let checker: RefactoringEquivalenceChecker;
  let z3Verifier: Z3Verifier;

  beforeEach(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    z3Verifier = new Z3Verifier();
    await z3Verifier.initialize();

    checker = new RefactoringEquivalenceChecker({}, z3Verifier);
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

  describe('checkRefactoringEquivalence', () => {
    it('should return equivalent for identical files', async () => {
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const refactoredPath = createTestFile(content, 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      expect(result.isEquivalent).toBe(true);
      expect(result.totalFunctions).toBeGreaterThan(0);
      expect(result.failedFunctions.length).toBe(0);
    });

    it('should detect missing functions', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function sub(a: number, b: number): number {
          return a - b;
        }
      `;

      const refactoredContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const refactoredPath = createTestFile(refactoredContent, 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      expect(result.isEquivalent).toBe(false);
      expect(result.missingFunctions).toContain('sub');
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });

    it('should detect signature changes', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const refactoredContent = `
        export function add(a: number, b: number, c: number): number {
          return a + b + c;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const refactoredPath = createTestFile(refactoredContent, 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      expect(result.isEquivalent).toBe(false);
      expect(result.signatureChanges.length).toBeGreaterThan(0);
    });

    it('should handle modules directory', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function sub(a: number, b: number): number {
          return a - b;
        }
      `;

      const refactoredContent = `
        import { add as addFn } from './modules/math.js';
        export function add(a: number, b: number): number {
          return addFn(a, b);
        }
      `;

      const modulesContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const refactoredPath = createTestFile(refactoredContent, 'refactored.ts');

      // Создаем директорию с модулями
      const modulesDir = path.join(testDir, 'modules');
      if (!fs.existsSync(modulesDir)) {
        fs.mkdirSync(modulesDir, { recursive: true });
      }
      const modulePath = path.join(modulesDir, 'math.ts');
      fs.writeFileSync(modulePath, modulesContent, 'utf-8');

      const result = await checker.checkRefactoringEquivalence(
        originalPath,
        refactoredPath,
        modulesDir
      );

      expect(result.isEquivalent).toBe(true);
    });
  });

  describe('checkFunctionEquivalence', () => {
    it('should check function equivalence', async () => {
      const originalBody = 'return a + b;';
      const modifiedBody = 'return b + a;';

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

      const originalPath = createTestFile(
        `export function add(a: number, b: number): number { ${originalBody} }`,
        'original.ts'
      );
      const refactoredPath = createTestFile(
        `export function add(a: number, b: number): number { ${modifiedBody} }`,
        'refactored.ts'
      );

      const result = await checker.checkFunctionEquivalence(originalPath, refactoredPath, 'add');

      expect(result).toBeDefined();
    });
  });

  describe('exportToJSON', () => {
    it('should export result to JSON', async () => {
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const refactoredPath = createTestFile(content, 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      const json = checker.exportToJSON(result);
      expect(json).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.isEquivalent).toBe(true);
      expect(parsed.summary).toBeDefined();
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
      const refactoredPath = createTestFile(content, 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      const reportPath = path.join(testDir, 'report.md');
      await checker.saveReport(result, reportPath);

      expect(fs.existsSync(reportPath)).toBe(true);
      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      expect(reportContent).toContain('ЭКВИВАЛЕНТЕН');
    });
  });

  describe('utility functions', () => {
    it('isRefactoringEquivalent should return correct value', async () => {
      const content = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const originalPath = createTestFile(content, 'original.ts');
      const refactoredPath = createTestFile(content, 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      const { isRefactoringEquivalent } =
        await import('../checkers/RefactoringEquivalenceChecker.js');
      expect(isRefactoringEquivalent(result)).toBe(true);
    });

    it('needsRefactoringReview should return correct value', async () => {
      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const refactoredContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function sub(a: number, b: number): number {
          return a - b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const refactoredPath = createTestFile(refactoredContent, 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      const { needsRefactoringReview } =
        await import('../checkers/RefactoringEquivalenceChecker.js');
      expect(needsRefactoringReview(result)).toBe(true);
    });
  });

  describe('with Z3 formal verification', () => {
    it('should handle simple arithmetic equivalence with Z3', async () => {
      // Создаем checker с включенной формальной верификацией
      const checkerWithZ3 = new RefactoringEquivalenceChecker(
        { formalVerification: true },
        z3Verifier
      );
      await checkerWithZ3.initialize();

      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const refactoredContent = `
        export function add(a: number, b: number): number {
          return b + a;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const refactoredPath = createTestFile(refactoredContent, 'refactored.ts');

      const result = await checkerWithZ3.checkRefactoringEquivalence(originalPath, refactoredPath);

      expect(result.isEquivalent).toBe(true);

      await checkerWithZ3.dispose();
    });

    it('should detect non-equivalent arithmetic with Z3', async () => {
      // Создаем checker с включенной формальной верификацией
      const checkerWithZ3 = new RefactoringEquivalenceChecker(
        { formalVerification: true },
        z3Verifier
      );
      await checkerWithZ3.initialize();

      const originalContent = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const refactoredContent = `
        export function add(a: number, b: number): number {
          return a * b;
        }
      `;

      const originalPath = createTestFile(originalContent, 'original.ts');
      const refactoredPath = createTestFile(refactoredContent, 'refactored.ts');

      const result = await checkerWithZ3.checkRefactoringEquivalence(originalPath, refactoredPath);

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);

      await checkerWithZ3.dispose();
    });
  });

  describe('error handling', () => {
    it('should handle non-existent original file', async () => {
      const refactoredPath = createTestFile('export const x = 1;', 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(
        '/non/existent/file.ts',
        refactoredPath
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });

    it('should handle non-existent refactored file', async () => {
      const originalPath = createTestFile('export const x = 1;', 'original.ts');

      const result = await checker.checkRefactoringEquivalence(
        originalPath,
        '/non/existent/file.ts'
      );

      expect(result.isEquivalent).toBe(false);
      expect(result.failedFunctions.length).toBeGreaterThan(0);
    });

    it('should handle empty files', async () => {
      const originalPath = createTestFile('', 'original.ts');
      const refactoredPath = createTestFile('', 'refactored.ts');

      const result = await checker.checkRefactoringEquivalence(originalPath, refactoredPath);

      // Пустые файлы считаются эквивалентными
      expect(result.isEquivalent).toBe(true);
    });
  });
});
