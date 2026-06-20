// packages/ast-analyzer/src/refactor/__tests__/analyzers-comprehensive.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';
import { ESLintASTFixer } from '../ESLintASTFixer.js';
import { TypeScriptValidator } from '../TypeScriptValidator.js';
import { CodeValidator } from '../CodeValidator.js';

describe('Комплексное тестирование анализаторов', () => {
  const testDir = path.join(process.cwd(), 'test-temp-analyzers');

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
  // 1. ESLint АНАЛИЗАТОР
  // ============================================

  describe('ESLint анализатор', () => {
    let eslintFixer: ESLintASTFixer;

    beforeEach(() => {
      eslintFixer = new ESLintASTFixer();
    });

    it('1.1 должен исправлять синтаксические ошибки в JavaScript', async () => {
      const content = `
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            return x + y
          }
          return 0
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'syntax-errors.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);
      expect(contentAfter).toMatch(/export { test };/);
    });

    it('1.2 должен исправлять синтаксические ошибки в TypeScript', async () => {
      const content = `
        interface User {
          id: number
          name: string
        }
        function getUser(id: number): User {
          return { id, name: 'test' }
        }
        function processUser(user: User): string {
          return user.id + user.name
        }
        export { getUser, processUser }
      `;
      const testFile = createTestFile(content, 'syntax-errors.ts');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toMatch(/interface User {/);
      expect(contentAfter).toMatch(/id: number;/);
      expect(contentAfter).toMatch(/name: string;/);
      expect(contentAfter).toMatch(/export { getUser, processUser };/);
    });

    it('1.3 должен исправлять синтаксические ошибки в JSX', async () => {
      const content = `
        import React from 'react'
        function Button({ onClick, children }) {
          return <button onClick={onClick}>{children}</button>
        }
        function App() {
          return (
            <div>
              <Button onClick={() => console.log('clicked')}>
                Click me
              </Button>
            </div>
          )
        }
        export { App, Button }
      `;
      const testFile = createTestFile(content, 'syntax-errors.jsx');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toMatch(/import React from 'react';/);
      expect(contentAfter).toMatch(/export { App, Button };/);
    });

    it('1.4 должен исправлять синтаксические ошибки в Vue', async () => {
      const content = `
        <script setup>
        import { ref } from 'vue'
        const count = ref(0)
        function increment() {
          count.value++
        }
        function decrement() {
          count.value--
        }
        </script>
        <template>
          <div>
            <button @click="increment">+</button>
            <button @click="decrement">-</button>
          </div>
        </template>
        <style scoped>
          .container { padding: 20px }
        </style>
      `;
      const testFile = createTestFile(content, 'syntax-errors.vue');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain("import { ref } from 'vue';");
      expect(contentAfter).toContain('.container { padding: 20px; }');
    });

    it('1.5 должен исправлять синтаксические ошибки с несколькими проблемами', async () => {
      const content = `
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            console.log(x)
          }
          if (y < 0 {
            console.log(y)
          }
          return x + y
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'multiple-errors.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(1);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);
      expect(contentAfter).toMatch(/if \(y < 0\) {/);
      expect(contentAfter).toMatch(/export { test };/);
    });

    it('1.6 должен НЕ изменять корректный файл', async () => {
      const content = `
        function test() {
          const x = 1;
          const y = 2;
          if (x > 0) {
            return x + y;
          }
          return 0;
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'correct.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBe(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(content);
    });

    it('1.7 должен создавать бэкап при исправлении', async () => {
      const content = `
        function test() {
          const x = 1
          return x
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'backup-test.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const files = fs.readdirSync(testDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles.length).toBe(1);
    });

    it('1.8 должен работать в режиме dry-run', async () => {
      const content = `
        function test() {
          const x = 1
          return x
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'dry-run-test.js');
      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const result = await eslintFixer.fixFile(testFile, true, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(originalContent);
    });

    it('1.9 должен исправлять синтаксические ошибки в стрелочных функциях', async () => {
      const content = `
        const add = (a, b) => {
          return a + b
        }
        const multiply = (a, b) => {
          return a * b
        }
        const process = (a, b) => {
          const sum = add(a, b)
          const product = multiply(a, b)
          return { sum, product }
        }
        export { add, multiply, process }
      `;
      const testFile = createTestFile(content, 'arrow-functions.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toMatch(/const add = \(a, b\) => {/);
      expect(contentAfter).toMatch(/return a \+ b;/);
      expect(contentAfter).toMatch(/export { add, multiply, process };/);
    });

    it('1.10 должен исправлять синтаксические ошибки в классах', async () => {
      const content = `
        class Calculator {
          constructor() {
            this.result = 0
          }
          add(a, b) {
            this.result = a + b
            return this.result
          }
          multiply(a, b) {
            this.result = a * b
            return this.result
          }
          calculate(a, b) {
            const sum = this.add(a, b)
            const product = this.multiply(a, b)
            return { sum, product }
          }
        }
        export { Calculator }
      `;
      const testFile = createTestFile(content, 'class-syntax.js');

      const result = await eslintFixer.fixFile(testFile, true);

      expect(result.success).toBe(true);
      expect(result.fixes).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toMatch(/this.result = 0;/);
      expect(contentAfter).toMatch(/return this.result;/);
      expect(contentAfter).toMatch(/export { Calculator };/);
    });
  });

  // ============================================
  // 2. TypeScript АНАЛИЗАТОР
  // ============================================

  describe('TypeScript анализатор', () => {
    let tsValidator: TypeScriptValidator;

    beforeEach(() => {
      tsValidator = new TypeScriptValidator(undefined, false);
    });

    it('2.1 должен находить ошибки типов', async () => {
      const content = `
        function add(a: number, b: string): number {
          return a + b;
        }
        function multiply(a: number, b: number): string {
          return a * b;
        }
        export { add, multiply };
      `;
      const testFile = createTestFile(content, 'type-errors.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(false);
      expect(result.remainingErrors).toBeGreaterThan(0);
      expect(result.diagnostics.some(d => d.message.includes('number'))).toBe(true);
    });

    it('2.2 должен исправлять ошибки типов через AST', async () => {
      const content = `
        function add(a, b) {
          return a + b;
        }
        function multiply(a, b) {
          return a * b;
        }
        export { add, multiply };
      `;
      const testFile = createTestFile(content, 'fix-type-errors.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('function add(a: any, b: any)');
      expect(contentAfter).toContain('function multiply(a: any, b: any)');
    });

    it('2.3 должен находить неиспользуемые переменные', async () => {
      const content = `
        function test() {
          const unused = 42;
          const used = 100;
          return used;
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'unused-vars.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('unused'))).toBe(true);
    });

    it('2.4 должен исправлять неиспользуемые переменные', async () => {
      const content = `
        function test() {
          const unused = 42;
          const used = 100;
          return used;
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'fix-unused-vars.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('const _unused = 42;');
    });

    it('2.5 должен находить циклические зависимости', async () => {
      const contentA = `
        import { funcB } from './module-b.ts';
        export function funcA() {
          return funcB();
        }
      `;
      const contentB = `
        import { funcA } from './module-a.ts';
        export function funcB() {
          return funcA();
        }
      `;
      const fileA = createTestFile(contentA, 'module-a.ts');
      const fileB = createTestFile(contentB, 'module-b.ts');

      const result = await tsValidator.validateAndFix([fileA, fileB]);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('cycle'))).toBe(true);
    });

    it('2.6 должен находить проблемы с импортами', async () => {
      const content = `
        import { helper } from './helper.ts';
        import { unused } from './unused.ts';
        function test() {
          return helper();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'import-issues.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('import'))).toBe(true);
    });

    it('2.7 должен исправлять проблемы с импортами', async () => {
      const content = `
        import { helper } from './helper.ts';
        import { unused } from './unused.ts';
        function test() {
          return helper();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'fix-import-issues.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('import { helper } from');
      expect(contentAfter).not.toContain('unused');
    });

    it('2.8 должен работать с несколькими файлами', async () => {
      const content1 = `
        export function helper() {
          return 42;
        }
      `;
      const content2 = `
        import { helper } from './helper.ts';
        function test() {
          return helper();
        }
        export { test };
      `;
      const file1 = createTestFile(content1, 'helper.ts');
      const file2 = createTestFile(content2, 'main.ts');

      const result = await tsValidator.validateAndFix([file1, file2]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBe(0);
    });

    it('2.9 должен исправлять несколько ошибок типов', async () => {
      const content = `
        function processUser(user) {
          return user.name;
        }
        function processOrder(order) {
          return order.total;
        }
        function processProduct(product) {
          return product.price;
        }
        export { processUser, processOrder, processProduct };
      `;
      const testFile = createTestFile(content, 'multiple-type-errors.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('user: any');
      expect(contentAfter).toContain('order: any');
      expect(contentAfter).toContain('product: any');
    });

    it('2.10 должен обрабатывать сложные TypeScript конструкции', async () => {
      const content = `
        interface User {
          id: number;
          name: string;
        }
        function getUser(id: number): User {
          return { id, name: 'test' };
        }
        function processUser(user: User): string {
          return user.id + user.name;
        }
        export { getUser, processUser };
      `;
      const testFile = createTestFile(content, 'complex-ts.ts');

      const result = await tsValidator.validateAndFix([testFile]);

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 3. Code Validation АНАЛИЗАТОР
  // ============================================

  describe('Code Validation анализатор', () => {
    let codeValidator: CodeValidator;

    beforeEach(() => {
      codeValidator = new CodeValidator();
    });

    it('3.1 должен находить синтаксические ошибки', async () => {
      const content = `
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            return x + y
          }
          return 0
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'syntax-validation.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('скобки'))).toBe(true);
    });

    it('3.2 должен находить проблемы с импортами', async () => {
      const content = `
        import { helper } from './helper.js';
        import { unused } from './unused.js';
        import { process } from './process.js';
        function test() {
          return helper();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'import-validation.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Неиспользуемый импорт'))).toBe(true);
    });

    it('3.3 должен находить циклические зависимости', async () => {
      const contentA = `
        import { funcB } from './cycle-b.js';
        export function funcA() {
          return funcB();
        }
      `;
      const contentB = `
        import { funcA } from './cycle-a.js';
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

    it('3.4 должен находить неиспользуемые переменные', async () => {
      const content = `
        function test() {
          const unused = 42;
          const used = 100;
          return used;
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'unused-validation.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Неиспользуемая переменная'))).toBe(true);
    });

    it('3.5 должен находить проблемы с экспортами', async () => {
      const content = `
        function test() {
          return 42;
        }
        export { test };
        export { test as test2 };
        export const test3 = 100;
        export { test3 };
      `;
      const testFile = createTestFile(content, 'export-validation.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Дублирование экспорта'))).toBe(true);
    });

    it('3.6 должен находить проблемы безопасности', async () => {
      const content = `
        function processInput(input) {
          eval(input);
          return input;
        }
        function savePassword(password) {
          const secret = password;
          return secret;
        }
        export { processInput, savePassword };
      `;
      const testFile = createTestFile(content, 'security-validation.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('eval'))).toBe(true);
      expect(result.issues.some(i => i.message.includes('secret'))).toBe(true);
    });

    it('3.7 должен находить проблемы производительности', async () => {
      const content = `
        function processLargeArray(data) {
          const result = [];
          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data.length; j++) {
              result.push(data[i] * data[j]);
            }
          }
          return result;
        }
        export { processLargeArray };
      `;
      const testFile = createTestFile(content, 'performance-validation.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('вложенных циклов'))).toBe(true);
    });

    it('3.8 должен находить проблемы с именованием', async () => {
      const content = `
        function GET_USER_DATA_FROM_API() {
          return { id: 1, name: 'test' };
        }
        function processUserData(user) {
          return user.name;
        }
        export { GET_USER_DATA_FROM_API, processUserData };
      `;
      const testFile = createTestFile(content, 'naming-validation.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('выглядит как константа'))).toBe(true);
    });

    it('3.9 должен находить дублирующиеся импорты', async () => {
      const content = `
        import { helper } from './helper.js';
        import { helper as helper2 } from './helper.js';
        import { helper as helper3 } from './helper.js';
        function test() {
          return helper() + helper2() + helper3();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'duplicate-imports.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('дублирующийся импорт'))).toBe(true);
    });

    it('3.10 должен находить конфликтующие имена', async () => {
      const content = `
        function process() {
          return 1;
        }
        function process() {
          return 2;
        }
        export { process };
      `;
      const testFile = createTestFile(content, 'conflicting-names.js');

      const result = await codeValidator.validateFiles([testFile]);

      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('конфликт'))).toBe(true);
    });

    it('3.11 должен генерировать отчет со всеми проблемами', async () => {
      const content = `
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            return x + y
          }
          return 0
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'full-validation.js');

      const result = await codeValidator.validateFiles([testFile]);
      const reportPath = path.join(testDir, 'validation-report.md');
      await codeValidator.saveReport(result, reportPath);

      expect(fs.existsSync(reportPath)).toBe(true);
      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      expect(reportContent).toContain('Отчёт проверки кода');
      expect(reportContent).toContain('Ошибки');
      expect(reportContent).toContain('Предупреждения');
    });

    it('3.12 должен генерировать JSON отчет', async () => {
      const content = `
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            return x + y
          }
          return 0
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'json-validation.js');

      const result = await codeValidator.validateFiles([testFile]);
      const reportPath = path.join(testDir, 'validation-report.json');
      await codeValidator.saveJSONReport(result, reportPath);

      expect(fs.existsSync(reportPath)).toBe(true);
      const reportContent = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      expect(reportContent.issues).toBeDefined();
      expect(reportContent.summary).toBeDefined();
    });
  });

  // ============================================
  // 4. ИНТЕГРАЦИОННЫЕ ТЕСТЫ
  // ============================================

  describe('Интеграция всех анализаторов', () => {
    it('4.1 должен работать полный пайплайн с ESLint + TypeScript + Code Validation', async () => {
      const content = `
        import { helper } from './helper.ts';
        import { unused } from './unused.ts';
        import { process } from './process.ts';
        import { process as process2 } from './process.ts';
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            return helper() + process() + process2()
          }
          return 0
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'full-pipeline.ts');

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
      // Проверяем исправление синтаксиса
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);
      expect(contentAfter).toMatch(/export { test };/);

      // Проверяем исправление импортов
      expect(contentAfter).not.toContain('unused');
      expect(contentAfter).toContain('import { helper } from');
      expect(contentAfter).toContain('import { process } from');
    });

    it('4.2 должен работать с комбинацией всех флагов', async () => {
      const content = `
        import { helper } from './helper.ts';
        import { helper as helper2 } from './helper.ts';
        import { helper3 } from './helper3.ts';
        import { helper4 } from './helper4.ts';
        import { helper5 } from './helper5.ts';
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            return helper() + helper2() + helper3() + helper4() + helper5()
          }
          return 0
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'all-flags.ts');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        extractIsolatedFunctions: true,
        semanticAnalysis: true,
        callGraphAnalysis: true,
        dataFlowAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        maxClusterSize: 5,
        minCohesionScore: 50,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Проверяем исправление синтаксиса
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);
      expect(contentAfter).toMatch(/export { test };/);

      // Проверяем оптимизацию импортов
      expect(contentAfter).toContain('import { helper, helper as helper2 } from');
      // helper3, helper4, helper5 должны быть сгруппированы или исправлены
    });

    it('4.3 должен работать в режиме dry-run с анализаторами', async () => {
      const content = `
        function test() {
          const x = 1
          const y = 2
          if (x > 0 {
            return x + y
          }
          return 0
        }
        export { test }
      `;
      const testFile = createTestFile(content, 'dry-run-analyzers.js');

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
        dryRun: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      // Файл не должен измениться в dry-run режиме
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toMatch(/const x = 1\n/);
      expect(contentAfter).not.toMatch(/const x = 1;/);
    });

    it('4.4 должен обрабатывать сложный файл со всеми анализаторами', async () => {
      const content = `
        interface User {
          id: number;
          name: string;
        }
        import { helper } from './helper.ts';
        import { helper2 } from './helper.ts';
        import { helper3 } from './helper3.ts';
        import { unused } from './unused.ts';
        function getUser(id: number): User {
          return { id, name: 'test' }
        }
        function processUser(user: User): string {
          const x = 1
          const y = 2
          if (x > 0 {
            return helper() + helper2() + helper3()
          }
          return user.name
        }
        function processData(data: any): any {
          eval(data)
          return data
        }
        export { getUser, processUser, processData }
      `;
      const testFile = createTestFile(content, 'complex-all.ts');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        extractIsolatedFunctions: true,
        semanticAnalysis: true,
        callGraphAnalysis: true,
        dataFlowAnalysis: true,
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
      // Проверяем исправление синтаксиса
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);
      expect(contentAfter).toMatch(/export { getUser, processUser, processData };/);

      // Проверяем исправление импортов
      expect(contentAfter).not.toContain('unused');
      expect(contentAfter).toContain('import { helper, helper2 } from');
      expect(contentAfter).toContain('import { helper3 } from');

      // Проверяем, что интерфейс сохранен
      expect(contentAfter).toContain('interface User');
      expect(contentAfter).toContain('id: number;');
      expect(contentAfter).toContain('name: string;');

      // Проверяем, что проблемы безопасности исправлены
      expect(contentAfter).not.toContain('eval(');
    });
  });

  // ============================================
  // 5. СТРЕСС-ТЕСТЫ
  // ============================================

  describe('Стресс-тесты анализаторов', () => {
    it('5.1 должен обрабатывать большой файл со 100 функциями', async () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
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
      content += 'export { ' + Array.from({ length: 100 }, (_, i) => `func${i}`).join(', ') + ' };';
      const testFile = createTestFile(content, 'large-file.js');

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
      // Проверяем, что все синтаксические ошибки исправлены
      expect(contentAfter).not.toMatch(/if \(x > 0 {/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/g);
    });

    it('5.2 должен обрабатывать файл с глубокой вложенностью', async () => {
      let content = '';
      for (let i = 0; i < 20; i++) {
        const indent = '  '.repeat(i);
        content += `${indent}if (x > ${i}) {\n`;
        content += `${indent}  const y = ${i * 2}\n`;
        content += `${indent}  if (y > ${i}) {\n`;
      }
      for (let i = 20; i >= 0; i--) {
        const indent = '  '.repeat(i);
        content += `${indent}  }\n`;
      }
      content += 'export { test }';
      const testFile = createTestFile(content, 'deep-nesting.js');

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

    it('5.3 должен обрабатывать файл с множеством импортов', async () => {
      let content = '';
      for (let i = 0; i < 50; i++) {
        content += `import { helper${i} } from './helper${i}.js';\n`;
      }
      content += `
        function test() {
          return helper0() + helper1() + helper2();
        }
        export { test };
      `;
      const testFile = createTestFile(content, 'many-imports.js');

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
      // Проверяем, что неиспользуемые импорты удалены
      for (let i = 3; i < 50; i++) {
        expect(contentAfter).not.toContain(`helper${i}`);
      }
    });

    it('5.4 должен обрабатывать файл с множеством экспортов', async () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `
          function func${i}() {
            return ${i};
          }
        `;
      }
      content += 'export { ' + Array.from({ length: 100 }, (_, i) => `func${i}`).join(', ') + ' };';
      const testFile = createTestFile(content, 'many-exports.js');

      const refactor = new AutoRefactor({
        eslintCheck: true,
        eslintFix: true,
        typeCheck: true,
        codeValidation: true,
        autoFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 10,
        maxClusterSize: 20,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Проверяем, что экспорты сохранены
      for (let i = 0; i < 10; i++) {
        expect(contentAfter).toContain(`func${i}`);
      }
    });
  });
});
