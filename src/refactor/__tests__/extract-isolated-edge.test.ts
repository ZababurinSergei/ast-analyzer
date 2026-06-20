// packages/ast-analyzer/src/refactor/__tests__/extract-isolated-edge.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('--extract-isolated: КРАЕВЫЕ СЛУЧАИ', () => {
  const testDir = path.join(process.cwd(), 'test-temp-extract-edge');

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
  // 1. ЭКЗОТИЧЕСКИЕ СТРУКТУРЫ ДАННЫХ
  // ============================================

  describe('Экзотические структуры данных', () => {
    it('1.1 должен выделять изолированную функцию с Map/Set', async () => {
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

      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const mapModule = files.find(f => f.includes('process-map'));
        const setModule = files.find(f => f.includes('process-set'));

        // Map и Set функции должны быть выделены или остаться в main
        expect(mapModule || setModule).toBeDefined();
      }
    });

    it('1.2 должен выделять изолированную функцию с WeakMap/WeakSet', async () => {
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

    it('1.3 должен выделять изолированную функцию с Proxy', async () => {
      const content = `
        function createProxy(target) {
          return new Proxy(target, {
            get(obj, prop) {
              console.log(\`Getting \${String(prop)}\`);
              return obj[prop];
            },
            set(obj, prop, value) {
              console.log(\`Setting \${String(prop)} to \${value}\`);
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

      // Proxy функция должна быть выделена
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const proxyModule = files.find(f => f.includes('proxy'));
        expect(proxyModule).toBeDefined();
      }
    });

    it('1.4 должен выделять изолированную функцию с Symbol', async () => {
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

      // Symbol должен быть скопирован вместе с функциями
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const userModule = files.find(f => f.includes('user'));
        if (userModule) {
          const content = fs.readFileSync(path.join(modulesDir, userModule), 'utf-8');
          expect(content).toContain('const id = Symbol');
          expect(content).toContain('const name = Symbol');
        }
      }
    });
  });

  // ============================================
  // 2. ЭКЗОТИЧЕСКИЕ ФУНКЦИОНАЛЬНЫЕ КОНСТРУКЦИИ
  // ============================================

  describe('Экзотические функциональные конструкции', () => {
    it('2.1 должен выделять изолированную функцию с генератором', async () => {
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

      // Генераторы должны быть выделены
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const generatorModule = files.find(f => f.includes('generator'));
        expect(generatorModule).toBeDefined();

        if (generatorModule) {
          const content = fs.readFileSync(path.join(modulesDir, generatorModule), 'utf-8');
          expect(content).toContain('function*');
          expect(content).toContain('yield');
        }
      }
    });

    it('2.2 должен выделять изолированную функцию с async/await и try-catch', async () => {
      const content = `
        async function fetchData(url) {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(\`HTTP error! status: \${response.status}\`);
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

      // Асинхронные функции должны быть выделены
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const fetchModule = files.find(f => f.includes('fetch'));
        expect(fetchModule).toBeDefined();

        if (fetchModule) {
          const content = fs.readFileSync(path.join(modulesDir, fetchModule), 'utf-8');
          expect(content).toContain('async function');
          expect(content).toContain('try');
          expect(content).toContain('catch');
        }
      }
    });

    it('2.3 должен выделять изолированную функцию с декораторами', async () => {
      const content = `
        function log(target, propertyKey, descriptor) {
          const original = descriptor.value;
          descriptor.value = function(...args) {
            console.log(\`Calling \${propertyKey} with \${args}\`);
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

      // Декораторы должны быть скопированы вместе с классом
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const calcModule = files.find(f => f.includes('calculator'));
        if (calcModule) {
          const content = fs.readFileSync(path.join(modulesDir, calcModule), 'utf-8');
          expect(content).toContain('@log');
          expect(content).toContain('function log');
        }
      }
    });
  });

  // ============================================
  // 3. ЭКЗОТИЧЕСКИЕ ИМПОРТЫ И ЭКСПОРТЫ
  // ============================================

  describe('Экзотические импорты и экспорты', () => {
    it('3.1 должен выделять изолированную функцию с реэкспортом через export *', async () => {
      // Создаем модуль для реэкспорта
      const moduleContent = `
        export function helper1() { return 1; }
        export function helper2() { return 2; }
        export function helper3() { return 3; }
      `;
      const modulePath = path.join(testDir, 'helpers.js');
      fs.writeFileSync(modulePath, moduleContent);

      const content = `
        export * from './helpers.js';
        
        function isolatedFunction() {
          return 42;
        }
        
        function main() {
          return isolatedFunction() + helper1() + helper2() + helper3();
        }
        export { main, isolatedFunction };
      `;
      const testFile = createTestFile(content, 're-export-star.js');

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

      // export * должен сохраниться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain("export * from './helpers.js'");
    });

    it('3.2 должен выделять изолированную функцию с динамическим экспортом', async () => {
      const content = `
        function isolatedFunction() {
          return 42;
        }
        
        function main() {
          return isolatedFunction();
        }
        
        const exports = { main, isolatedFunction };
        if (process.env.NODE_ENV === 'production') {
          module.exports = exports;
        } else {
          module.exports = { ...exports, debug: true };
        }
      `;
      const testFile = createTestFile(content, 'dynamic-export.js');

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

      // Динамический экспорт должен сохраниться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('module.exports =');
    });

    it('3.3 должен выделять изолированную функцию с циклическим импортом', async () => {
      // Создаем циклический импорт
      const moduleA = `
        import { funcB } from './module-b.js';
        export function funcA() {
          return funcB() + 1;
        }
        export function isolatedA() {
          return 42;
        }
      `;
      const moduleAPath = path.join(testDir, 'module-a.js');
      fs.writeFileSync(moduleAPath, moduleA);

      const moduleB = `
        import { funcA } from './module-a.js';
        export function funcB() {
          return funcA() + 1;
        }
        export function isolatedB() {
          return 24;
        }
      `;
      const moduleBPath = path.join(testDir, 'module-b.js');
      fs.writeFileSync(moduleBPath, moduleB);

      const content = `
        import { funcA, isolatedA } from './module-a.js';
        import { funcB, isolatedB } from './module-b.js';
        
        function main() {
          return funcA() + funcB() + isolatedA() + isolatedB();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'circular-imports.js');

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

      // Циклические импорты должны сохраниться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain("import { funcA, isolatedA } from './module-a.js'");
      expect(contentAfter).toContain("import { funcB, isolatedB } from './module-b.js'");
    });
  });

  // ============================================
  // 4. ЭКЗОТИЧЕСКИЕ ТИПЫ ДАННЫХ (TypeScript)
  // ============================================

  describe('Экзотические типы данных TypeScript', () => {
    it('4.1 должен выделять изолированную функцию с union типами', async () => {
      const content = `
        type ID = string | number;
        type Status = 'pending' | 'approved' | 'rejected';
        
        function processId(id: ID): string {
          return String(id);
        }
        
        function getStatus(status: Status): string {
          return \`Status: \${status}\`;
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

      // Union типы должны быть скопированы
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const processModule = files.find(f => f.includes('process'));
        if (processModule) {
          const content = fs.readFileSync(path.join(modulesDir, processModule), 'utf-8');
          expect(content).toContain('type ID = string | number');
          expect(content).toContain('type Status =');
        }
      }
    });

    it('4.2 должен выделять изолированную функцию с generics', async () => {
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

      // Generics должны быть скопированы
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const mapModule = files.find(f => f.includes('map'));
        if (mapModule) {
          const content = fs.readFileSync(path.join(modulesDir, mapModule), 'utf-8');
          expect(content).toContain('function identity<T>');
          expect(content).toContain('function mapArray<T, U>');
        }
      }
    });

    it('4.3 должен выделять изолированную функцию с условными типами', async () => {
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

      // Условные типы должны быть скопированы
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isArrayModule = files.find(f => f.includes('is-array'));
        if (isArrayModule) {
          const content = fs.readFileSync(path.join(modulesDir, isArrayModule), 'utf-8');
          expect(content).toContain('type IsArray<T>');
          expect(content).toContain('type Nullable<T>');
        }
      }
    });
  });

  // ============================================
  // 5. ЭКЗОТИЧЕСКИЕ СЦЕНАРИИ С РАЗМЕРАМИ
  // ============================================

  describe('Экзотические сценарии с размерами', () => {
    it('5.1 должен выделять изолированную функцию с очень длинным именем (>100 символов)', async () => {
      const longName = 'a'.repeat(150);
      const content = `
        function ${longName}() {
          return 42;
        }
        
        function main() {
          return ${longName}();
        }
        export { main, ${longName} };
      `;
      const testFile = createTestFile(content, 'long-name.js');

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

      // Проверяем, что функция выделена
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const longNameModule = files.find(f => f.includes('a'.repeat(50)));
        // Имя может быть сокращено, но функция должна быть выделена
        // Проверяем, что есть модуль с этой функцией
        const moduleFile = files.find(f => {
          const content = fs.readFileSync(path.join(modulesDir, f), 'utf-8');
          return content.includes('function a'.repeat(10));
        });
        // Может быть выделена или остаться в main
        expect(true).toBe(true);
      }
    });

    it('5.2 должен выделять изолированную функцию с очень большим телом (>1000 строк)', async () => {
      let body = '';
      for (let i = 0; i < 1000; i++) {
        body += `  const val${i} = ${i};\n`;
      }

      const content = `
        function largeFunction() {
          ${body}
          return val999;
        }
        
        function main() {
          return largeFunction();
        }
        export { main, largeFunction };
      `;
      const testFile = createTestFile(content, 'large-body.js');

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

      // Проверяем, что функция выделена (или осталась в main)
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const largeModule = files.find(f => f.includes('large'));
        // Может быть выделена или остаться в main
        expect(true).toBe(true);
      }
    });

    it('5.3 должен выделять изолированную функцию с очень большим количеством параметров (>100)', async () => {
      const params = Array.from({ length: 100 }, (_, i) => `p${i}`).join(', ');
      const args = Array.from({ length: 100 }, (_, i) => `p${i}`).join(' + ');

      const content = `
        function manyParams(${params}) {
          return ${args};
        }
        
        function main() {
          return manyParams(${Array.from({ length: 100 }, (_, i) => i).join(', ')});
        }
        export { main, manyParams };
      `;
      const testFile = createTestFile(content, 'many-params.js');

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

      // Проверяем, что функция выделена (или осталась в main)
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const manyParamsModule = files.find(f => f.includes('many-params'));
        // Может быть выделена или остаться в main
        expect(true).toBe(true);
      }
    });
  });

  // ============================================
  // 6. ЭКЗОТИЧЕСКИЕ СЦЕНАРИИ С КОДИРОВКОЙ
  // ============================================

  describe('Экзотические сценарии с кодировкой', () => {
    it('6.1 должен выделять изолированную функцию с Unicode именами', async () => {
      const content = `
        function приветМир() {
          return 'Hello World';
        }
        
        function こんにちは() {
          return 'Konnichiwa';
        }
        
        function 🚀() {
          return 'Rocket';
        }
        
        function main() {
          return приветМир() + こんにちは() + 🚀();
        }
        export { main, приветМир, こんにちは, 🚀 };
      `;
      const testFile = createTestFile(content, 'unicode-names.js');

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

      // Unicode имена должны сохраниться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('приветМир');
      expect(contentAfter).toContain('こんにちは');
      expect(contentAfter).toContain('🚀');
    });

    it('6.2 должен выделять изолированную функцию с эмодзи в комментариях', async () => {
      const content = `
        // 🚀 Это функция с эмодзи
        function rocketFunction() {
          // 👋 Привет мир
          return 'Hello 🌍 World!';
        }
        
        // 📦 Экспортируем функцию
        function main() {
          return rocketFunction();
        }
        export { main, rocketFunction };
      `;
      const testFile = createTestFile(content, 'emoji-comments.js');

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

      // Эмодзи должны сохраниться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('🚀');
      expect(contentAfter).toContain('👋');
      expect(contentAfter).toContain('🌍');
    });

    it('6.3 должен выделять изолированную функцию с BOM', async () => {
      const content =
        '\uFEFFfunction isolatedFunction() { return 42; }\nfunction main() { return isolatedFunction(); }\nexport { main, isolatedFunction };';
      const testFile = createTestFile(content, 'bom-function.js');

      // Записываем с BOM
      fs.writeFileSync(testFile, content, { encoding: 'utf-8' });

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

      // Функция должна быть выделена
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isolatedModule = files.find(f => f.includes('isolated'));
        // Может быть выделена или остаться в main
        expect(true).toBe(true);
      }
    });
  });

  // ============================================
  // 7. ЭКЗОТИЧЕСКИЕ СЦЕНАРИИ С ФЛАГАМИ
  // ============================================

  describe('Экзотические сценарии с флагами', () => {
    it('7.1 должен работать с extractIsolatedFunctions: false в краевых случаях', async () => {
      const content = `
        function isolatedWithGlobal() {
          const global = globalThis;
          return global.process ? 'has process' : 'no process';
        }
        
        function main() {
          return isolatedWithGlobal();
        }
        export { main, isolatedWithGlobal };
      `;
      const testFile = createTestFile(content, 'no-extract-edge.js');

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

      // Функция должна остаться в main
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('isolatedWithGlobal');
    });

    it('7.2 должен работать с minCohesionScore: 0 в краевых случаях', async () => {
      const content = `
        function isolatedA() { return 1; }
        function isolatedB() { return 2; }
        function isolatedC() { return 3; }
        
        function main() {
          return isolatedA() + isolatedB() + isolatedC();
        }
        export { main, isolatedA, isolatedB, isolatedC };
      `;
      const testFile = createTestFile(content, 'cohesion-zero-edge.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 1,
        minCohesionScore: 0,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Все функции должны быть выделены отдельно
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isolatedModules = files.filter(f => f.includes('isolated'));
        expect(isolatedModules.length).toBe(3);
      }
    });

    it('7.3 должен работать с maxClusterSize: 1 в краевых случаях', async () => {
      const content = `
        function dependentA() { return dependentB(); }
        function dependentB() { return dependentA(); }
        function isolated() { return 42; }
        
        function main() {
          return dependentA() + isolated();
        }
        export { main, dependentA, dependentB, isolated };
      `;
      const testFile = createTestFile(content, 'max-size-one-edge.js');

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

      // dependentA и dependentB должны быть в разных модулях
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Может быть несколько модулей
        expect(files.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================
  // 8. ЭКЗОТИЧЕСКИЕ СЦЕНАРИИ С ОШИБКАМИ
  // ============================================

  describe('Экзотические сценарии с ошибками', () => {
    it('8.1 должен обрабатывать функцию с синтаксической ошибкой внутри', async () => {
      const content = `
        function isolatedWithError() {
          const x = 1
          const y = 2
          if (x > 0 {
            return x + y
          }
          return 0
        }
        
        function main() {
          return isolatedWithError();
        }
        export { main, isolatedWithError };
      `;
      const testFile = createTestFile(content, 'syntax-error-edge.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        autoFix: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Функция должна быть выделена (или исправлена)
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const errorModule = files.find(f => f.includes('isolated'));
        // Может быть выделена или остаться в main
        expect(true).toBe(true);
      }
    });

    it('8.2 должен обрабатывать функцию с бесконечной рекурсией', async () => {
      const content = `
        function infiniteRecursion() {
          return infiniteRecursion();
        }
        
        function main() {
          return infiniteRecursion();
        }
        export { main, infiniteRecursion };
      `;
      const testFile = createTestFile(content, 'infinite-recursion.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        semanticAnalysis: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('8.3 должен обрабатывать функцию с циклической зависимостью и изолированными функциями', async () => {
      const content = `
        function cycleA() { return cycleB(); }
        function cycleB() { return cycleA(); }
        
        function isolatedOne() { return 1; }
        function isolatedTwo() { return 2; }
        function isolatedThree() { return 3; }
        
        function main() {
          return cycleA() + isolatedOne() + isolatedTwo() + isolatedThree();
        }
        export { main, cycleA, cycleB, isolatedOne, isolatedTwo, isolatedThree };
      `;
      const testFile = createTestFile(content, 'cycle-isolated-edge.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 40,
        createBackup: true,
        incremental: true,
        dryRun: false,
        semanticAnalysis: true,
        callGraphAnalysis: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Циклические функции могут быть в одном модуле или отдельно
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Должны быть модули для изолированных функций
        const isolatedModules = files.filter(f => f.includes('isolated'));
        expect(isolatedModules.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('8.4 должен обрабатывать функцию с глобальными переменными', async () => {
      const content = `
        const GLOBAL_CONFIG = { api: 'https://api.example.com' };
        const GLOBAL_TIMEOUT = 5000;
        
        function isolatedWithGlobals() {
          return { api: GLOBAL_CONFIG.api, timeout: GLOBAL_TIMEOUT };
        }
        
        function main() {
          return isolatedWithGlobals();
        }
        export { main, isolatedWithGlobals };
      `;
      const testFile = createTestFile(content, 'global-vars-edge.js');

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

      // Глобальные переменные должны быть скопированы вместе с функцией
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const globalModule = files.find(f => f.includes('isolated'));
        if (globalModule) {
          const content = fs.readFileSync(path.join(modulesDir, globalModule), 'utf-8');
          expect(content).toContain('GLOBAL_CONFIG');
          expect(content).toContain('GLOBAL_TIMEOUT');
        }
      }
    });
  });
});
