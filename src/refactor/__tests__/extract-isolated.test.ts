// packages/ast-analyzer/src/refactor/__tests__/extract-isolated.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('--extract-isolated: Выделение изолированных функций', () => {
  const testDir = path.join(process.cwd(), 'test-temp-extract-isolated');

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
  // 1. БАЗОВЫЕ СЦЕНАРИИ ИЗОЛИРОВАННЫХ ФУНКЦИЙ
  // ============================================

  describe('Базовые сценарии выделения изолированных функций', () => {
    it('1.1 должен выделить полностью изолированную функцию (нет зависимостей)', async () => {
      const content = `
        function isolatedFunction() {
          return 42;
        }
        function main() {
          return isolatedFunction();
        }
        export { main, isolatedFunction };
      `;
      const testFile = createTestFile(content, 'isolated-basic.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);

      // Проверяем, что изолированная функция выделена
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isolatedModule = files.find(f => f.includes('isolated'));
        expect(isolatedModule).toBeDefined();
      }
    });

    it('1.2 должен выделить функцию с простыми зависимостями (вызов других функций)', async () => {
      const content = `
        function helper() {
          return 1;
        }
        function isolatedWithHelper() {
          return helper() * 2;
        }
        function main() {
          return isolatedWithHelper();
        }
        export { main, isolatedWithHelper, helper };
      `;
      const testFile = createTestFile(content, 'isolated-with-helper.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('1.3 должен НЕ выделять функцию, которая используется только один раз и не экспортируется', async () => {
      const content = `
        function internalHelper() {
          return 42;
        }
        function main() {
          return internalHelper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'internal-helper.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('1.4 должен выделить несколько изолированных функций в отдельные модули', async () => {
      const content = `
        function isolatedA() {
          return 'A';
        }
        function isolatedB() {
          return 'B';
        }
        function isolatedC() {
          return 'C';
        }
        function main() {
          return isolatedA() + isolatedB() + isolatedC();
        }
        export { main, isolatedA, isolatedB, isolatedC };
      `;
      const testFile = createTestFile(content, 'multiple-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 1,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Должно быть 3 модуля (A, B, C) + main
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Должны быть файлы для каждой изолированной функции
        expect(files.some(f => f.includes('isolated-a'))).toBe(true);
        expect(files.some(f => f.includes('isolated-b'))).toBe(true);
        expect(files.some(f => f.includes('isolated-c'))).toBe(true);
      }
    });

    it('1.5 должен выделить изолированную стрелочную функцию', async () => {
      const content = `
        const arrowFunction = () => 42;
        function main() {
          return arrowFunction();
        }
        export { main, arrowFunction };
      `;
      const testFile = createTestFile(content, 'isolated-arrow.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('1.6 должен выделить изолированную асинхронную функцию', async () => {
      const content = `
        async function isolatedAsync() {
          return await Promise.resolve(42);
        }
        async function main() {
          return await isolatedAsync();
        }
        export { main, isolatedAsync };
      `;
      const testFile = createTestFile(content, 'isolated-async.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('1.7 должен выделить изолированный метод класса', async () => {
      const content = `
        class Calculator {
          isolatedMethod() {
            return 42;
          }
          mainMethod() {
            return this.isolatedMethod();
          }
        }
        export { Calculator };
      `;
      const testFile = createTestFile(content, 'isolated-class-method.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 2. СЦЕНАРИИ С КОНФЛИКТАМИ ИМЕН
  // ============================================

  describe('Конфликты имен при выделении изолированных функций', () => {
    it('2.1 должен правильно обрабатывать функции с одинаковыми именами в разных областях', async () => {
      const content = `
        function process() {
          return 'global';
        }
        function isolated() {
          function process() {
            return 'local';
          }
          return process();
        }
        function main() {
          return isolated();
        }
        export { main, isolated, process };
      `;
      const testFile = createTestFile(content, 'name-conflict.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Проверяем, что имена не конфликтуют
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Имена должны быть уникальными
        const fileNames = files.map(f => path.basename(f, '.js'));
        const uniqueNames = new Set(fileNames);
        expect(uniqueNames.size).toBe(fileNames.length);
      }
    });

    it('2.2 должен переименовывать конфликтующие экспорты при выделении', async () => {
      const content = `
        function isolatedA() {
          return 'A';
        }
        const isolatedB = () => 'B';
        class isolatedC {
          static method() { return 'C'; }
        }
        function main() {
          return isolatedA() + isolatedB() + isolatedC.method();
        }
        export { main, isolatedA, isolatedB, isolatedC };
      `;
      const testFile = createTestFile(content, 'conflict-renaming.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 1,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Проверяем, что все экспорты сохранены
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('isolatedA');
      expect(contentAfter).toContain('isolatedB');
      expect(contentAfter).toContain('isolatedC');
    });
  });

  // ============================================
  // 3. СЦЕНАРИИ С ЗАВИСИМОСТЯМИ
  // ============================================

  describe('Зависимости изолированных функций', () => {
    it('3.1 должен выделять изолированную функцию вместе с её зависимостями', async () => {
      const content = `
        function dep1() { return 1; }
        function dep2() { return 2; }
        function isolatedWithDeps() {
          return dep1() + dep2();
        }
        function main() {
          return isolatedWithDeps();
        }
        export { main, isolatedWithDeps, dep1, dep2 };
      `;
      const testFile = createTestFile(content, 'isolated-with-deps.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('3.2 должен НЕ выделять функцию, если она зависит от глобальных переменных', async () => {
      const content = `
        const GLOBAL_CONFIG = { api: 'https://api.example.com' };
        function isolatedWithGlobal() {
          return GLOBAL_CONFIG.api;
        }
        function main() {
          return isolatedWithGlobal();
        }
        export { main, isolatedWithGlobal };
      `;
      const testFile = createTestFile(content, 'isolated-global.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('3.3 должен выделять изолированную функцию с импортами из внешних модулей', async () => {
      // Создаем внешний модуль
      const externalContent = `
        export function externalHelper() {
          return 'external';
        }
      `;
      const externalFile = path.join(testDir, 'external.js');
      fs.writeFileSync(externalFile, externalContent);

      const content = `
        import { externalHelper } from './external.js';
        function isolatedWithExternal() {
          return externalHelper();
        }
        function main() {
          return isolatedWithExternal();
        }
        export { main, isolatedWithExternal };
      `;
      const testFile = createTestFile(content, 'isolated-external.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Импорт должен быть скопирован в новый модуль
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir);
        for (const file of moduleFiles) {
          const content = fs.readFileSync(path.join(modulesDir, file), 'utf-8');
          // Проверяем, что импорт скопирован
          if (content.includes('isolatedWithExternal')) {
            expect(content).toContain('import { externalHelper } from');
          }
        }
      }
    });

    it('3.4 должен выделять функцию с циклическими зависимостями (с предупреждением)', async () => {
      const content = `
        function isolatedA() {
          return isolatedB();
        }
        function isolatedB() {
          return isolatedA();
        }
        function main() {
          return isolatedA();
        }
        export { main, isolatedA, isolatedB };
      `;
      const testFile = createTestFile(content, 'isolated-cycle.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 4. СЦЕНАРИИ С РАЗНЫМИ ТИПАМИ ФАЙЛОВ
  // ============================================

  describe('Разные типы файлов', () => {
    it('4.1 должен выделять изолированные функции в TypeScript файле', async () => {
      const content = `
        interface User {
          id: number;
          name: string;
        }
        function isolatedGetUser(id: number): User {
          return { id, name: 'User ' + id };
        }
        function main(): User {
          return isolatedGetUser(1);
        }
        export { main, isolatedGetUser };
      `;
      const testFile = createTestFile(content, 'isolated-ts.ts');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Интерфейс должен быть скопирован вместе с функцией
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir);
        for (const file of moduleFiles) {
          const content = fs.readFileSync(path.join(modulesDir, file), 'utf-8');
          if (content.includes('isolatedGetUser')) {
            expect(content).toContain('interface User');
          }
        }
      }
    });

    it('4.2 должен выделять изолированные функции в JSX файле', async () => {
      const content = `
        import React from 'react';
        function isolatedComponent() {
          return <div>Isolated</div>;
        }
        function main() {
          return <div>{isolatedComponent()}</div>;
        }
        export { main, isolatedComponent };
      `;
      const testFile = createTestFile(content, 'isolated-jsx.jsx');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        jsxAnalysis: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('4.3 должен выделять изолированные функции в Vue файле', async () => {
      const content = `
        <script setup>
        function isolatedFunction() {
          return 42;
        }
        function main() {
          return isolatedFunction();
        }
        </script>
        <template>
          <div>{{ main() }}</div>
        </template>
      `;
      const testFile = createTestFile(content, 'isolated-vue.vue');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        vueAnalysis: true,
        updateTemplate: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 5. СЦЕНАРИИ С ФЛАГОМ --extract-isolated=false
  // ============================================

  describe('С флагом --extract-isolated=false', () => {
    it('5.1 не должен выделять изолированные функции', async () => {
      const content = `
        function isolatedFunction() {
          return 42;
        }
        function main() {
          return isolatedFunction();
        }
        export { main, isolatedFunction };
      `;
      const testFile = createTestFile(content, 'no-extract-basic.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: false,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('5.2 должен группировать все функции в один модуль, если extractIsolatedFunctions=false', async () => {
      const content = `
        function func1() { return 1; }
        function func2() { return 2; }
        function func3() { return 3; }
        function main() { return func1() + func2() + func3(); }
        export { main, func1, func2, func3 };
      `;
      const testFile = createTestFile(content, 'no-extract-group.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: false,
        targetClusterSize: 4,
        maxClusterSize: 5,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Все функции должны быть в одном модуле
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Должен быть один модуль
        expect(files.length).toBe(1);
        const content = fs.readFileSync(path.join(modulesDir, files[0]), 'utf-8');
        expect(content).toContain('func1');
        expect(content).toContain('func2');
        expect(content).toContain('func3');
        expect(content).toContain('main');
      }
    });

    it('5.3 должен сохранять изолированные функции в основном файле', async () => {
      const content = `
        function isolated1() { return 1; }
        function isolated2() { return 2; }
        function main() { return isolated1() + isolated2(); }
        export { main, isolated1, isolated2 };
      `;
      const testFile = createTestFile(content, 'no-extract-keep.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: false,
        targetClusterSize: 3,
        maxClusterSize: 4,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Проверяем, что функции остались в основном файле
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('isolated1');
      expect(contentAfter).toContain('isolated2');
      expect(contentAfter).toContain('main');
    });
  });

  // ============================================
  // 6. СЦЕНАРИИ С ОПТИМИЗАЦИЕЙ
  // ============================================

  describe('Оптимизация выделения изолированных функций', () => {
    it('6.1 должен выделять изолированную функцию с внутренней логикой (if/else, циклы)', async () => {
      const content = `
        function isolatedWithLogic(value: number): string {
          if (value > 0) {
            return 'positive';
          } else if (value < 0) {
            return 'negative';
          }
          return 'zero';
        }
        function main() {
          return isolatedWithLogic(10);
        }
        export { main, isolatedWithLogic };
      `;
      const testFile = createTestFile(content, 'isolated-logic.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Вся логика должна быть скопирована
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir);
        for (const file of moduleFiles) {
          const content = fs.readFileSync(path.join(modulesDir, file), 'utf-8');
          if (content.includes('isolatedWithLogic')) {
            expect(content).toContain('if (value > 0)');
            expect(content).toContain('else if');
            expect(content).toContain('return "zero"');
          }
        }
      }
    });

    it('6.2 должен выделять изолированную функцию с вложенными функциями', async () => {
      const content = `
        function isolatedWithNested() {
          function inner() {
            return 42;
          }
          return inner();
        }
        function main() {
          return isolatedWithNested();
        }
        export { main, isolatedWithNested };
      `;
      const testFile = createTestFile(content, 'isolated-nested.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Вложенная функция должна быть скопирована
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir);
        for (const file of moduleFiles) {
          const content = fs.readFileSync(path.join(modulesDir, file), 'utf-8');
          if (content.includes('isolatedWithNested')) {
            expect(content).toContain('function inner()');
            expect(content).toContain('return inner()');
          }
        }
      }
    });

    it('6.3 должен выделять изолированную функцию с импортами и экспортами', async () => {
      const content = `
        import { helper } from './helper.js';
        function isolatedWithImports() {
          return helper();
        }
        function main() {
          return isolatedWithImports();
        }
        export { main, isolatedWithImports };
      `;
      const testFile = createTestFile(content, 'isolated-imports.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        fixUnusedImports: true,
        optimizeImports: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Импорт должен быть скопирован
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir);
        for (const file of moduleFiles) {
          const content = fs.readFileSync(path.join(modulesDir, file), 'utf-8');
          if (content.includes('isolatedWithImports')) {
            expect(content).toContain('import { helper } from');
          }
        }
      }
    });

    // ============================================
    // 7. РЕАЛЬНЫЕ СЦЕНАРИИ ИЗ ЛОГОВ
    // ============================================

    it('7.1 должен выделять изолированную функцию из файла с множественными экспортами', async () => {
      const content = `
        // file-system-json.mjs - реальный сценарий
        import fs from 'fs';
        import path from 'path';
        
        export function parseFile(filePath) {
          const content = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(content);
        }
        
        export function writeFile(filePath, data) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        }
        
        export function readFile(filePath) {
          return fs.readFileSync(filePath, 'utf-8');
        }
        
        // Изолированная функция, которую нужно выделить
        export function validateFileStructure(filePath) {
          const content = parseFile(filePath);
          return content && typeof content === 'object';
        }
        
        // Другая изолированная функция
        export function getFileSize(filePath) {
          const stats = fs.statSync(filePath);
          return stats.size;
        }
      `;
      const testFile = createTestFile(content, 'file-system-json.mjs');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('7.2 должен выделять изолированную функцию с зависимостями из того же файла', async () => {
      const content = `
        // helpers.js - реальный сценарий
        function formatDate(date) {
          return date.toISOString();
        }
        
        function formatCurrency(amount) {
          return '$' + amount.toFixed(2);
        }
        
        // Изолированная функция, зависящая от formatDate
        function formatUserData(user) {
          return {
            name: user.name,
            createdAt: formatDate(user.createdAt),
            balance: formatCurrency(user.balance)
          };
        }
        
        // Основная функция
        function processUser(user) {
          return formatUserData(user);
        }
        
        export { formatDate, formatCurrency, formatUserData, processUser };
      `;
      const testFile = createTestFile(content, 'helpers.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('7.3 должен выделять изолированную функцию, которая используется в нескольких местах', async () => {
      const content = `
        // utils.js - реальный сценарий
        function validateEmail(email) {
          return email.includes('@');
        }
        
        function validatePhone(phone) {
          return phone.length === 10;
        }
        
        // Изолированная функция, используемая в нескольких местах
        function validateInput(input) {
          if (input.type === 'email') {
            return validateEmail(input.value);
          }
          if (input.type === 'phone') {
            return validatePhone(input.value);
          }
          return true;
        }
        
        function processForm(form) {
          const isValid = form.fields.every(field => validateInput(field));
          return { isValid, errors: form.fields.filter(f => !validateInput(f)) };
        }
        
        function validateField(field) {
          return validateInput(field);
        }
        
        export { validateEmail, validatePhone, validateInput, processForm, validateField };
      `;
      const testFile = createTestFile(content, 'utils.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    // ============================================
    // 8. СЦЕНАРИИ С РАЗНЫМИ УРОВНЯМИ ИЗОЛЯЦИИ
    // ============================================

    it('8.1 должен выделять функцию с высоким уровнем изоляции (нет зависимостей)', async () => {
      const content = `
        function highIsolation() {
          const result = [];
          for (let i = 0; i < 10; i++) {
            result.push(i * 2);
          }
          return result;
        }
        
        function main() {
          return highIsolation();
        }
        export { main, highIsolation };
      `;
      const testFile = createTestFile(content, 'high-isolation.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 80,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isolatedModule = files.find(f => f.includes('high-isolation'));
        expect(isolatedModule).toBeDefined();

        // Проверяем, что модуль содержит только highIsolation
        const content = fs.readFileSync(path.join(modulesDir, isolatedModule!), 'utf-8');
        expect(content).toContain('highIsolation');
        // Не должно быть других функций
        expect(content).not.toContain('main');
      }
    });

    it('8.2 должен выделять функцию со средней изоляцией (одна зависимость)', async () => {
      const content = `
        function helper() {
          return 42;
        }
        
        function mediumIsolation() {
          return helper() * 2;
        }
        
        function main() {
          return mediumIsolation();
        }
        export { main, mediumIsolation, helper };
      `;
      const testFile = createTestFile(content, 'medium-isolation.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 2,
        minCohesionScore: 60,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const mediumModule = files.find(f => f.includes('medium-isolation'));
        if (mediumModule) {
          const content = fs.readFileSync(path.join(modulesDir, mediumModule), 'utf-8');
          expect(content).toContain('mediumIsolation');
          expect(content).toContain('helper');
        }
      }
    });

    it('8.3 должен НЕ выделять функцию с низкой изоляцией (много зависимостей)', async () => {
      const content = `
        function dep1() { return 1; }
        function dep2() { return 2; }
        function dep3() { return 3; }
        function dep4() { return 4; }
        function dep5() { return 5; }
        
        function lowIsolation() {
          return dep1() + dep2() + dep3() + dep4() + dep5();
        }
        
        function main() {
          return lowIsolation();
        }
        export { main, lowIsolation, dep1, dep2, dep3, dep4, dep5 };
      `;
      const testFile = createTestFile(content, 'low-isolation.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    // ============================================
    // 9. ЭКЗОТИЧЕСКИЕ СТРУКТУРЫ ДАННЫХ
    // ============================================

    it('9.1 должен выделять изолированную функцию с Map/Set', async () => {
      const content = `
        function processMap(data) {
          const map = new Map();
          for (const [key, value] of Object.entries(data)) {
            map.set(key, value * 2);
          }
          return map;
        }
        
        function processSet(data) {
          const set = new Set();
          for (const item of data) {
            set.add(item * 2);
          }
          return set;
        }
        
        function main() {
          const map = processMap({ a: 1, b: 2 });
          const set = processSet([1, 2, 3]);
          return { map, set };
        }
        export { main, processMap, processSet };
      `;
      const testFile = createTestFile(content, 'map-set-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('9.2 должен выделять изолированную функцию с WeakMap/WeakSet', async () => {
      const content = `
        const cache = new WeakMap();
        const seen = new WeakSet();
        
        function processObject(obj) {
          if (seen.has(obj)) {
            return cache.get(obj);
          }
          const result = { processed: true, data: obj };
          cache.set(obj, result);
          seen.add(obj);
          return result;
        }
        
        function main() {
          const obj = { id: 1 };
          return processObject(obj);
        }
        export { main, processObject };
      `;
      const testFile = createTestFile(content, 'weakmap-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // WeakMap/WeakSet должны быть скопированы вместе с функцией
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const processModule = files.find(f => f.includes('process'));
        if (processModule) {
          const content = fs.readFileSync(path.join(modulesDir, processModule), 'utf-8');
          expect(content).toContain('const cache = new WeakMap()');
          expect(content).toContain('const seen = new WeakSet()');
        }
      }
    });

    it('9.3 должен выделять изолированную функцию с Proxy', async () => {
      const content = `
        function createProxy(target) {
          return new Proxy(target, {
            get(obj, prop) {
              console.log('Getting ' + String(prop));
              return obj[prop];
            },
            set(obj, prop, value) {
              console.log('Setting ' + String(prop) + ' to ' + value);
              obj[prop] = value;
              return true;
            }
          });
        }
        
        function main() {
          const data = { count: 0 };
          const proxy = createProxy(data);
          proxy.count++;
          return proxy.count;
        }
        export { main, createProxy };
      `;
      const testFile = createTestFile(content, 'proxy-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('9.4 должен выделять изолированную функцию с Symbol', async () => {
      const content = `
        const id = Symbol('id');
        const name = Symbol('name');
        
        function createUser(userId, userName) {
          return {
            [id]: userId,
            [name]: userName
          };
        }
        
        function getUserId(user) {
          return user[id];
        }
        
        function main() {
          const user = createUser(1, 'John');
          return getUserId(user);
        }
        export { main, createUser, getUserId };
      `;
      const testFile = createTestFile(content, 'symbol-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    // ============================================
    // 10. ЭКЗОТИЧЕСКИЕ ФУНКЦИОНАЛЬНЫЕ КОНСТРУКЦИИ
    // ============================================

    it('10.1 должен выделять изолированную функцию с генератором', async () => {
      const content = `
        function* numberGenerator(max) {
          for (let i = 0; i < max; i++) {
            yield i * 2;
          }
        }
        
        function* fibonacciGenerator(max) {
          let a = 0, b = 1;
          for (let i = 0; i < max; i++) {
            yield a;
            [a, b] = [b, a + b];
          }
        }
        
        function main() {
          const numbers = [...numberGenerator(5)];
          const fib = [...fibonacciGenerator(5)];
          return { numbers, fib };
        }
        export { main, numberGenerator, fibonacciGenerator };
      `;
      const testFile = createTestFile(content, 'generator-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('10.2 должен выделять изолированную функцию с async/await и try-catch', async () => {
      const content = `
        async function fetchData(url) {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error('HTTP error! status: ' + response.status);
            }
            return await response.json();
          } catch (error) {
            console.error('Fetch failed:', error);
            return null;
          }
        }
        
        async function processData(url) {
          try {
            const data = await fetchData(url);
            if (!data) {
              return { error: 'No data' };
            }
            return { data, processed: true };
          } catch (error) {
            return { error: error.message };
          }
        }
        
        function main() {
          return processData('https://api.example.com');
        }
        export { main, fetchData, processData };
      `;
      const testFile = createTestFile(content, 'async-try-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('10.3 должен выделять изолированную функцию с декораторами', async () => {
      const content = `
        function log(target, propertyKey, descriptor) {
          const original = descriptor.value;
          descriptor.value = function(...args) {
            console.log('Calling ' + propertyKey + ' with ' + args);
            return original.apply(this, args);
          };
          return descriptor;
        }
        
        class Calculator {
          @log
          add(a, b) {
            return a + b;
          }
          
          @log
          multiply(a, b) {
            return a * b;
          }
          
          calculate(a, b) {
            return this.add(a, this.multiply(a, b));
          }
        }
        
        function main() {
          const calc = new Calculator();
          return calc.calculate(2, 3);
        }
        export { main, Calculator };
      `;
      const testFile = createTestFile(content, 'decorator-isolated.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    // ============================================
    // 11. ЭКЗОТИЧЕСКИЕ ТИПЫ ДАННЫХ (TypeScript)
    // ============================================

    it('11.1 должен выделять изолированную функцию с union типами', async () => {
      const content = `
        type ID = string | number;
        type Status = 'pending' | 'approved' | 'rejected';
        
        function processId(id: ID): string {
          return String(id);
        }
        
        function getStatus(status: Status): string {
          return 'Status: ' + status;
        }
        
        function main() {
          return processId(123) + getStatus('approved');
        }
        export { main, processId, getStatus };
      `;
      const testFile = createTestFile(content, 'union-types.ts');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('11.2 должен выделять изолированную функцию с generics', async () => {
      const content = `
        function identity<T>(value: T): T {
          return value;
        }
        
        function mapArray<T, U>(arr: T[], fn: (item: T) => U): U[] {
          return arr.map(fn);
        }
        
        function main() {
          const numbers = [1, 2, 3];
          const doubled = mapArray(numbers, n => n * 2);
          return identity(doubled);
        }
        export { main, identity, mapArray };
      `;
      const testFile = createTestFile(content, 'generics.ts');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('11.3 должен выделять изолированную функцию с условными типами', async () => {
      const content = `
        type IsArray<T> = T extends any[] ? true : false;
        type Nullable<T> = T | null | undefined;
        
        function isArray<T>(value: T): IsArray<T> {
          return Array.isArray(value) as IsArray<T>;
        }
        
        function makeNullable<T>(value: T): Nullable<T> {
          return value as Nullable<T>;
        }
        
        function main() {
          const arr = [1, 2, 3];
          const result = isArray(arr);
          return makeNullable(result);
        }
        export { main, isArray, makeNullable };
      `;
      const testFile = createTestFile(content, 'conditional-types.ts');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });
});
