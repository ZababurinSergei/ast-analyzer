// packages/ast-analyzer/src/refactor/__tests__/analyzers-edge-cases.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';
import { ESLintASTFixer } from '../ESLintASTFixer.js';
import { TypeScriptValidator } from '../TypeScriptValidator.js';
import { CodeValidator } from '../CodeValidator.js';

describe('Крайние граничные кейсы анализаторов', () => {
  const testDir = path.join(process.cwd(), 'test-temp-analyzers-edge');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  const createTestFile = (content: string, filename: string = 'test.js') => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  // ============================================
  // 1. ESLint - ЭКЗОТИЧЕСКИЕ СЛУЧАИ
  // ============================================

  describe('ESLint - Экзотические синтаксические конструкции', () => {
    let eslintFixer: ESLintASTFixer;

    beforeEach(() => {
      eslintFixer = new ESLintASTFixer();
    });

    it('1.1 должен обрабатывать файл с BOM (Byte Order Mark)', async () => {
      const content = '\uFEFFfunction test() { const x = 1 return x } export { test }';
      const testFile = createTestFile(content, 'bom-file.js');
      fs.writeFileSync(testFile, content, { encoding: 'utf-8' });

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // BOM должен сохраниться или быть корректно обработан
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/export { test };/);
    });

    it('1.2 должен обрабатывать файл с Unicode символами в именах', async () => {
      const content = `
        function приветМир() {
          const x = 1
          return x
        }
        function こんにちは() {
          const y = 2
          return y
        }
        export { приветМир, こんにちは }
      `;
      const testFile = createTestFile(content, 'unicode-names.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('function приветМир()');
      expect(contentAfter).toContain('function こんにちは()');
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
    });

    it('1.3 должен обрабатывать файл с эмодзи в комментариях', async () => {
      const content = `
        // 🚀 Это тестовая функция
        function test() {
          // 👋 Привет мир
          const x = 1
          return x
        }
        // 📦 Экспортируем
        export { test }
      `;
      const testFile = createTestFile(content, 'emoji-comments.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('🚀');
      expect(contentAfter).toContain('👋');
      expect(contentAfter).toContain('📦');
      expect(contentAfter).toMatch(/const x = 1;/);
    });

    it('1.4 должен обрабатывать файл с очень длинными строками (>1000 символов)', async () => {
      const longString = 'a'.repeat(2000);
      const content = `
        const longString = '${longString}'
        function test() {
          return longString
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'long-lines.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('const longString = ');
      expect(contentAfter).toMatch(/export { test };/);
    });

    it('1.5 должен обрабатывать файл с вложенными шаблонными литералами', async () => {
      const content = `
        function test() {
          const name = 'World'
          const message = \`Hello, \${name}!\`
          const nested = \`Message: \${message}\`
          return nested
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'nested-templates.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain("const name = 'World';");
      expect(contentAfter).toContain('const message = `Hello, ${name}!`;');
      expect(contentAfter).toMatch(/export { test };/);
    });

    it('1.6 должен обрабатывать файл с декораторами', async () => {
      const content = `
        function log(target, propertyKey, descriptor) {
          const original = descriptor.value
          descriptor.value = function(...args) {
            console.log('Calling ' + propertyKey)
            return original.apply(this, args)
          }
          return descriptor
        }
        class Calculator {
          @log
          add(a, b) {
            return a + b
          }
          @log
          multiply(a, b) {
            return a * b
          }
        }
        export { Calculator }
      `;
      const testFile = createTestFile(content, 'decorators.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('@log');
      expect(contentAfter).toMatch(/return a \+ b;/);
      expect(contentAfter).toMatch(/export { Calculator };/);
    });

    it('1.7 должен обрабатывать файл с оператором spread и rest', async () => {
      const content = `
        function sum(...numbers) {
          return numbers.reduce((acc, n) => acc + n, 0)
        }
        function merge(obj1, obj2) {
          return { ...obj1, ...obj2 }
        }
        function firstAndRest(arr) {
          const [first, ...rest] = arr
          return { first, rest }
        }
        export { sum, merge, firstAndRest }
      `;
      const testFile = createTestFile(content, 'spread-rest.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('function sum(...numbers) {');
      expect(contentAfter).toContain('return { ...obj1, ...obj2 };');
      expect(contentAfter).toMatch(/export { sum, merge, firstAndRest };/);
    });

    it('1.8 должен обрабатывать файл с оператором yield и генераторами', async () => {
      const content = `
        function* numberGenerator() {
          yield 1
          yield 2
          yield 3
        }
        function* fibonacciGenerator() {
          let a = 0, b = 1
          while (true) {
            yield a
            [a, b] = [b, a + b]
          }
        }
        export { numberGenerator, fibonacciGenerator }
      `;
      const testFile = createTestFile(content, 'generators.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('function* numberGenerator() {');
      expect(contentAfter).toContain('yield 1;');
      expect(contentAfter).toMatch(/export { numberGenerator, fibonacciGenerator };/);
    });
  });

  // ============================================
  // 2. TypeScript - СЛОЖНЫЕ ТИПЫ
  // ============================================

  describe('TypeScript - Сложные типы и конструкции', () => {
    let tsValidator: TypeScriptValidator;

    beforeEach(() => {
      tsValidator = new TypeScriptValidator(undefined, false);
    });

    it('2.1 должен обрабатывать union и intersection типы', async () => {
      const content = `
        type ID = string | number;
        type User = { id: ID; name: string };
        type Admin = User & { permissions: string[] };
        function processUser(user: User): ID {
          return user.id;
        }
        function processAdmin(admin: Admin): string[] {
          return admin.permissions;
        }
        export { processUser, processAdmin };
      `;
      const testFile = createTestFile(content, 'union-intersection.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.2 должен обрабатывать generic типы', async () => {
      const content = `
        function identity<T>(value: T): T {
          return value;
        }
        function mapArray<T, U>(arr: T[], fn: (item: T) => U): U[] {
          return arr.map(fn);
        }
        class Container<T> {
          private value: T;
          constructor(value: T) {
            this.value = value;
          }
          getValue(): T {
            return this.value;
          }
        }
        export { identity, mapArray, Container };
      `;
      const testFile = createTestFile(content, 'generics.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.3 должен обрабатывать условные типы', async () => {
      const content = `
        type IsArray<T> = T extends any[] ? true : false;
        type Nullable<T> = T | null | undefined;
        type Readonly<T> = {
          readonly [P in keyof T]: T[P];
        };
        interface User {
          id: number;
          name: string;
        }
        type ReadonlyUser = Readonly<User>;
        function isArray<T>(value: T): IsArray<T> {
          return Array.isArray(value) as IsArray<T>;
        }
        export { isArray };
      `;
      const testFile = createTestFile(content, 'conditional-types.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.4 должен обрабатывать mapped types', async () => {
      const content = `
        type Partial<T> = {
          [P in keyof T]?: T[P];
        };
        type Required<T> = {
          [P in keyof T]-?: T[P];
        };
        type Pick<T, K extends keyof T> = {
          [P in K]: T[P];
        };
        type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
        interface User {
          id: number;
          name: string;
          email?: string;
        }
        type PartialUser = Partial<User>;
        type RequiredUser = Required<User>;
        export { PartialUser, RequiredUser };
      `;
      const testFile = createTestFile(content, 'mapped-types.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.5 должен обрабатывать перегрузки функций', async () => {
      const content = `
        function process(value: string): string;
        function process(value: number): number;
        function process(value: any): any {
          if (typeof value === 'string') {
            return value.toUpperCase();
          }
          if (typeof value === 'number') {
            return value * 2;
          }
          return value;
        }
        export { process };
      `;
      const testFile = createTestFile(content, 'overloads.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.6 должен обрабатывать namespace и модули', async () => {
      const content = `
        namespace MyMath {
          export function add(a: number, b: number): number {
            return a + b;
          }
          export function multiply(a: number, b: number): number {
            return a * b;
          }
          export namespace Advanced {
            export function power(a: number, b: number): number {
              return Math.pow(a, b);
            }
          }
        }
        export { MyMath };
      `;
      const testFile = createTestFile(content, 'namespace.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.7 должен обрабатывать enum', async () => {
      const content = `
        enum Status {
          Pending = 'pending',
          Approved = 'approved',
          Rejected = 'rejected'
        }
        enum NumericStatus {
          Pending = 0,
          Approved = 1,
          Rejected = 2
        }
        function getStatusMessage(status: Status): string {
          return \`Status: \${status}\`;
        }
        export { Status, NumericStatus, getStatusMessage };
      `;
      const testFile = createTestFile(content, 'enum.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.8 должен обрабатывать декораторы в TypeScript', async () => {
      const content = `
        function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const original = descriptor.value;
          descriptor.value = function(...args: any[]) {
            console.log(\`Calling \${propertyKey}\`);
            return original.apply(this, args);
          };
          return descriptor;
        }
        class Calculator {
          @log
          add(a: number, b: number): number {
            return a + b;
          }
          @log
          multiply(a: number, b: number): number {
            return a * b;
          }
        }
        export { Calculator };
      `;
      const testFile = createTestFile(content, 'ts-decorators.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });
  });

  // ============================================
  // 3. Code Validation - ЭКЗОТИЧЕСКИЕ ЗАВИСИМОСТИ
  // ============================================

  describe('Code Validation - Сложные зависимости', () => {
    let codeValidator: CodeValidator;

    beforeEach(() => {
      codeValidator = new CodeValidator();
    });

    it('3.1 должен обнаруживать циклические зависимости с глубокой вложенностью', async () => {
      const files = [];
      for (let i = 0; i < 10; i++) {
        const next = (i + 1) % 10;
        const content = `
          import { func${next} } from './cycle-${next}.js';
          export function func${i}() {
            return func${next}();
          }
        `;
        const file = createTestFile(content, `cycle-${i}.js`);
        files.push(file);
      }

      const result = await codeValidator.validateFiles(files);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('циклическую'))).toBe(true);
    });

    it('3.2 должен обнаруживать циклические зависимости с разными путями', async () => {
      const contentA = `
        import { funcB } from './subdir/cycle-b.js';
        export function funcA() {
          return funcB();
        }
      `;
      const contentB = `
        import { funcA } from '../cycle-a.js';
        export function funcB() {
          return funcA();
        }
      `;
      const fileA = createTestFile(contentA, 'cycle-a.js');
      fs.mkdirSync(path.join(testDir, 'subdir'), { recursive: true });
      const fileB = createTestFile(contentB, 'subdir/cycle-b.js');

      const result = await codeValidator.validateFiles([fileA, fileB]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('циклическую'))).toBe(true);
    });

    it('3.3 должен обнаруживать циклические зависимости через реэкспорты', async () => {
      const contentA = `
        export { funcB } from './cycle-b.js';
        export function funcA() {
          return funcB();
        }
      `;
      const contentB = `
        export { funcA } from './cycle-a.js';
        export function funcB() {
          return funcA();
        }
      `;
      const fileA = createTestFile(contentA, 'cycle-a.js');
      const fileB = createTestFile(contentB, 'cycle-b.js');

      const result = await codeValidator.validateFiles([fileA, fileB]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('циклическую'))).toBe(true);
    });

    it('3.4 должен обнаруживать дублирующиеся экспорты', async () => {
      const content = `
        function test() { return 1; }
        export { test };
        export { test as test2 };
        export const test3 = 100;
        export { test3 };
        export function test4() { return 4; }
        export { test4 };
        export { test4 as test5 };
      `;
      const testFile = createTestFile(content, 'duplicate-exports.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Дублирование экспорта'))).toBe(true);
    });

    it('3.5 должен обнаруживать конфликтующие имена в разных областях', async () => {
      const content = `
        function process() { return 1; }
        function process() { return 2; }
        const process = 3;
        export { process };
      `;
      const testFile = createTestFile(content, 'conflicting-names.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('конфликт'))).toBe(true);
    });

    it('3.6 должен обнаруживать проблемы с импортами из несуществующих модулей', async () => {
      const content = `
        import { helper } from './nonexistent.js';
        import { utils } from './missing.js';
        function test() {
          return helper() + utils();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'missing-imports.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Импорт не разрешён'))).toBe(true);
    });

    it('3.7 должен обнаруживать проблемы с экспортами несуществующих сущностей', async () => {
      const content = `
        export { nonexistent };
        export { missing as something };
        export { alsoMissing };
      `;
      const testFile = createTestFile(content, 'missing-exports.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('не найден'))).toBe(true);
    });
  });

  // ============================================
  // 4. ИНТЕГРАЦИЯ - СЛОЖНЫЕ СЦЕНАРИИ
  // ============================================

  describe('Интеграция - Сложные сценарии', () => {
    it('4.1 должен обрабатывать файл со всеми экзотическими конструкциями', async () => {
      const content = `
        // Декораторы
        function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const original = descriptor.value;
          descriptor.value = function(...args: any[]) {
            console.log(\`Calling \${propertyKey}\`);
            return original.apply(this, args);
          };
          return descriptor;
        }

        // Generics
        function identity<T>(value: T): T {
          return value;
        }

        // Union и Intersection типы
        type ID = string | number;
        type User = { id: ID; name: string };
        type Admin = User & { permissions: string[] };

        // Enum
        enum Status {
          Pending = 'pending',
          Approved = 'approved',
          Rejected = 'rejected'
        }

        // Mapped типы
        type Partial<T> = {
          [P in keyof T]?: T[P];
        };

        // Класс с декораторами
        class Calculator {
          @log
          add(a: number, b: number): number {
            return a + b
          }
          @log
          multiply(a: number, b: number): number {
            return a * b
          }
        }

        // Генератор
        function* numberGenerator() {
          yield 1
          yield 2
          yield 3
        }

        // Spread и Rest
        function sum(...numbers: number[]): number {
          return numbers.reduce((acc, n) => acc + n, 0)
        }

        // Шаблонные литералы
        function greet(name: string): string {
          return \`Hello, \${name}!\`
        }

        export { identity, Calculator, numberGenerator, sum, greet }
      `;
      const testFile = createTestFile(content, 'all-constructs.ts');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        semanticAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Проверяем, что все конструкции сохранены
      expect(contentAfter).toContain('@log');
      expect(contentAfter).toContain('function identity<T>');
      expect(contentAfter).toContain('type ID = string | number');
      expect(contentAfter).toContain('enum Status');
      expect(contentAfter).toContain('function* numberGenerator()');
      expect(contentAfter).toContain('function sum(...numbers: number[])');
      expect(contentAfter).toContain('return `Hello, ${name}!`;');

      // Проверяем исправление синтаксиса
      expect(contentAfter).toMatch(/return a \+ b;/);
      expect(contentAfter).toMatch(/export { identity, Calculator, numberGenerator, sum, greet };/);
    });

    it('4.2 должен обрабатывать файл с очень глубокой вложенностью и сложными зависимостями', async () => {
      let content = '';
      for (let i = 0; i < 20; i++) {
        const indent = '  '.repeat(i);
        content += `${indent}function level${i}() {\n`;
        content += `${indent}  const x = ${i}\n`;
        content += `${indent}  const y = ${i + 1}\n`;
        content += `${indent}  if (x > 0 {\n`;
        content += `${indent}    return level${i + 1}()\n`;
        content += `${indent}  }\n`;
        content += `${indent}  return 0\n`;
        content += `${indent}}\n\n`;
      }
      content += 'export { level0 }';
      const testFile = createTestFile(content, 'deep-nesting-all.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Проверяем, что синтаксис исправлен
      expect(contentAfter).not.toMatch(/if \(x > 0 {/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/g);
      expect(contentAfter).toMatch(/const x = \d+;/g);
      expect(contentAfter).toMatch(/const y = \d+;/g);
    });

    it('4.3 должен обрабатывать файл с множеством импортов из одного модуля', async () => {
      const content = `
        import { helper1 } from './helpers.js';
        import { helper2 } from './helpers.js';
        import { helper3 } from './helpers.js';
        import { helper4 } from './helpers.js';
        import { helper5 } from './helpers.js';
        import { helper6 } from './helpers.js';
        import { helper7 } from './helpers.js';
        import { helper8 } from './helpers.js';
        import { helper9 } from './helpers.js';
        import { helper10 } from './helpers.js';
        function test() {
          return helper1() + helper2() + helper3() + helper4() + helper5() +
                 helper6() + helper7() + helper8() + helper9() + helper10();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'many-imports-single.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Должен быть один импорт вместо десяти
      const importMatches = contentAfter.match(/import {/g);
      expect(importMatches?.length).toBe(1);
      expect(contentAfter).toContain(
        'import { helper1, helper2, helper3, helper4, helper5, helper6, helper7, helper8, helper9, helper10 } from'
      );
    });

    it('4.4 должен обрабатывать файл с циклическими зависимостями и изолированными функциями', async () => {
      const content = `
        // Циклические зависимости
        function funcA() { return funcB() + 1; }
        function funcB() { return funcA() + 1; }
        
        // Изолированные функции
        function isolatedA() { return 42; }
        function isolatedB() { return 24; }
        function isolatedC() { return 36; }
        
        // Функция с зависимостями
        function process() {
          return funcA() + isolatedA() + isolatedB() + isolatedC();
        }
        
        function main() {
          return process();
        }
        
        export { main, funcA, funcB, isolatedA, isolatedB, isolatedC, process };
      `;
      const testFile = createTestFile(content, 'cycle-with-isolated.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        semanticAnalysis: true,
        callGraphAnalysis: true,
        extractIsolatedFunctions: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 40,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Проверяем, что изолированные функции выделены
      expect(contentAfter).toContain('isolatedA');
      expect(contentAfter).toContain('isolatedB');
      expect(contentAfter).toContain('isolatedC');
    });

    it('4.5 должен обрабатывать файл с разными типами экспортов', async () => {
      const content = `
        export function namedFunction() { return 1; }
        export const namedConstant = 42;
        export class NamedClass {
          method() { return 2; }
        }
        function defaultFunction() { return 3; }
        export default defaultFunction;
        export { namedFunction, namedConstant, NamedClass };
        export { namedFunction as renamedFunction };
        export * from './helpers.js';
        export { helper } from './helpers.js';
      `;
      const testFile = createTestFile(content, 'mixed-exports.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Все экспорты должны сохраниться
      expect(contentAfter).toContain('export function namedFunction');
      expect(contentAfter).toContain('export const namedConstant');
      expect(contentAfter).toContain('export class NamedClass');
      expect(contentAfter).toContain('export default defaultFunction');
      expect(contentAfter).toContain('export { namedFunction, namedConstant, NamedClass }');
      expect(contentAfter).toContain('export { namedFunction as renamedFunction }');
    });
  });

  // ============================================
  // 5. СТРЕСС-ТЕСТЫ С ОШИБКАМИ
  // ============================================

  describe('Стресс-тесты с ошибками', () => {
    it('5.1 должен обрабатывать файл с множеством синтаксических ошибок', async () => {
      let content = '';
      for (let i = 0; i < 50; i++) {
        content += `
          function func${i}() {
            const x = ${i}
            const y = ${i + 1}
            if (x > 0 {
              return x + y
            }
            return 0
          }
        `;
      }
      content += 'export { ' + Array.from({ length: 50 }, (_, i) => `func${i}`).join(', ') + ' }';
      const testFile = createTestFile(content, 'many-errors.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Все ошибки должны быть исправлены
      expect(contentAfter).not.toMatch(/if \(x > 0 {/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/g);
      expect(contentAfter).toMatch(/const x = \d+;/g);
      expect(contentAfter).toMatch(/const y = \d+;/g);
    });

    it('5.2 должен обрабатывать файл с множеством проблем импортов', async () => {
      let content = '';
      for (let i = 0; i < 30; i++) {
        content += `import { helper${i} } from './helper${i}.js';\n`;
        content += `import { helper${i}_2 } from './helper${i}.js';\n`;
      }
      content += `
        function test() {
          return helper0() + helper0_2();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'many-import-issues.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Должны остаться только используемые импорты
      expect(contentAfter).toContain('import { helper0, helper0_2 } from');
      for (let i = 1; i < 30; i++) {
        expect(contentAfter).not.toContain(`helper${i}`);
      }
    });

    it('5.3 должен обрабатывать файл с очень большим количеством вложенных условий', async () => {
      let content = `
        function test(x: number): string {
      `;
      for (let i = 0; i < 50; i++) {
        const indent = '  '.repeat(i + 1);
        content += `${indent}if (x > ${i}) {\n`;
        content += `${indent}  return '${i}';\n`;
        content += `${indent}} else {\n`;
      }
      content += "    return 'default';\n";
      for (let i = 50; i >= 0; i--) {
        const indent = '  '.repeat(i + 1);
        content += `${indent}}\n`;
      }
      content += '}\nexport { test };';
      const testFile = createTestFile(content, 'nested-conditions.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('5.4 должен обрабатывать файл с множеством вложенных объектов и массивов', async () => {
      let content = `
        const data = {
      `;
      for (let i = 0; i < 100; i++) {
        content += `  key${i}: {\n`;
        content += `    nested${i}: [\n`;
        for (let j = 0; j < 10; j++) {
          content += `      { value: ${i * j} },\n`;
        }
        content += `    ],\n`;
        content += `  },\n`;
      }
      content += '};\nexport { data };';
      const testFile = createTestFile(content, 'nested-objects.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 6. ВОССТАНОВЛЕНИЕ ПОСЛЕ ОШИБОК
  // ============================================

  describe('Восстановление после ошибок', () => {
    it('6.1 должен восстанавливать файл после ошибки ESLint', async () => {
      const content = `
        function test() {
          const x = 1
          return x
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'eslint-recovery.js');
      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const eslintFixer = new ESLintASTFixer();

      // Создаем ошибку намеренно
      vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
        throw new Error('Simulated write error');
      });

      try {
        await eslintFixer.fixFile(testFile, true);
      } catch (error) {
        // Ожидаем ошибку
      }

      // Проверяем, что файл не поврежден
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(originalContent);
    });

    it('6.2 должен восстанавливать файл после ошибки TypeScript', async () => {
      const content = `
        function test() {
          const x = 1
          return x
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'ts-recovery.ts');
      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const tsValidator = new TypeScriptValidator(undefined, false);

      // Создаем ошибку намеренно
      vi.spyOn(tsValidator as any, 'loadFile').mockImplementationOnce(() => {
        throw new Error('Simulated load error');
      });

      try {
        await tsValidator.validateAndFix([testFile]);
      } catch (error) {
        // Ожидаем ошибку
      }

      // Проверяем, что файл не поврежден
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(originalContent);
    });

    it('6.3 должен восстанавливать файл после ошибки Code Validation', async () => {
      const content = `
        function test() {
          const x = 1
          return x
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'validation-recovery.js');
      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const codeValidator = new CodeValidator();

      // Создаем ошибку намеренно
      vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw new Error('Simulated read error');
      });

      try {
        await codeValidator.validateFiles([testFile]);
      } catch (error) {
        // Ожидаем ошибку
      }

      // Проверяем, что файл не поврежден
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(originalContent);
    });
  });
});
