// src/refactor/__tests__/semantic-refactor-low-priority.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

/**
 * Низкоприоритетные тесты для семантического рефакторинга
 *
 * Эти тесты покрывают экзотические сценарии, крайние значения параметров
 * и редкие синтаксические конструкции
 */

describe('Низкоприоритетные тесты семантического рефакторинга', () => {
  const testDir = path.join(process.cwd(), 'test-temp-low-priority');

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

  // ============================================
  // 1. ЭКЗОТИЧЕСКИЕ СЦЕНАРИИ
  // ============================================

  describe('Экзотические сценарии', () => {
    it('должен обрабатывать файл с эмодзи в комментариях и строках', async () => {
      const testFile = path.join(testDir, 'emoji-test.js');
      const content = `
        // 🚀 Это функция с эмодзи
        function helloWorld() {
          // 👋 Привет мир
          return 'Hello 🌍 World!';
        }
        
        // 📦 Экспортируем функцию
        export { helloWorld };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с очень длинными именами функций (>100 символов)', async () => {
      const testFile = path.join(testDir, 'long-names-test.js');
      const longName = 'a'.repeat(150);
      const content = `
        function ${longName}() {
          return 42;
        }
        export { ${longName} };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с символами Unicode в именах', async () => {
      const testFile = path.join(testDir, 'unicode-test.js');
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
        
        export { приветМир, こんにちは, 🚀 };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с очень глубокой вложенностью (10+ уровней)', async () => {
      const testFile = path.join(testDir, 'deep-nesting-test.js');
      let content = 'function level1() {\n';
      for (let i = 2; i <= 10; i++) {
        content += `  function level${i}() {\n`;
      }
      content += '    return 42;\n';
      for (let i = 10; i >= 2; i--) {
        content += `  }\n`;
      }
      content += '}\n';
      content += 'export { level1 };\n';
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с очень большим количеством экспортов (100+)', async () => {
      const testFile = path.join(testDir, 'many-exports-test.js');
      let content = '';
      const exports = [];
      for (let i = 0; i < 150; i++) {
        content += `function func${i}() { return ${i}; }\n`;
        exports.push(`func${i}`);
      }
      content += `export { ${exports.join(', ')} };\n`;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'info',
        createBackup: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('должен обрабатывать файл с очень большим количеством импортов (100+)', async () => {
      const testFile = path.join(testDir, 'many-imports-test.js');
      let content = '';
      for (let i = 0; i < 150; i++) {
        content += `import { func${i} } from './module${i}.js';\n`;
      }
      content += 'export const test = 42;\n';
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'info',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с шаблонными литералами и тегами', async () => {
      const testFile = path.join(testDir, 'template-literals-test.js');
      const content = `
        function tag(strings, ...values) {
          return strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
        }
        
        function formatName(first, last) {
          return tag\`Hello, \${first} \${last}!\`;
        }
        
        function createMessage(name, age) {
          return \`\${name} is \${age} years old\`;
        }
        
        export { formatName, createMessage };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с оператором spread и rest', async () => {
      const testFile = path.join(testDir, 'spread-rest-test.js');
      const content = `
        function sum(...numbers) {
          return numbers.reduce((a, b) => a + b, 0);
        }
        
        function mergeObjects(obj1, obj2) {
          return { ...obj1, ...obj2 };
        }
        
        function getFirstAndRest(array) {
          const [first, ...rest] = array;
          return { first, rest };
        }
        
        export { sum, mergeObjects, getFirstAndRest };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с деструктуризацией', async () => {
      const testFile = path.join(testDir, 'destructuring-test.js');
      const content = `
        function getUser() {
          return { id: 1, name: 'John', age: 30 };
        }
        
        function getAddress() {
          return { city: 'NYC', street: 'Main St', zip: '10001' };
        }
        
        function processUser() {
          const { id, name } = getUser();
          const { city, street } = getAddress();
          return { id, name, city, street };
        }
        
        export { processUser };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 2. КРАЙНИЕ ЗНАЧЕНИЯ ПАРАМЕТРОВ
  // ============================================

  describe('Крайние значения параметров', () => {
    it('должен работать с targetClusterSize = 1', async () => {
      const testFile = path.join(testDir, 'target-size-1-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        maxClusterSize: 3,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('должен работать с targetClusterSize = 50', async () => {
      const testFile = path.join(testDir, 'target-size-50-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 50,
        maxClusterSize: 50,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с minCohesionScore = 0', async () => {
      const testFile = path.join(testDir, 'cohesion-0-test.js');
      const content = `
        function a() { return 1; }
        function b() { return 2; }
        function c() { return 3; }
        export { a, b, c };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        minCohesionScore: 0,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с minCohesionScore = 100', async () => {
      const testFile = path.join(testDir, 'cohesion-100-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        minCohesionScore: 100,
        targetClusterSize: 2,
        maxClusterSize: 3,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с maxClusterSize = 1', async () => {
      const testFile = path.join(testDir, 'max-size-1-test.js');
      const content = `
        function a() { return 1; }
        function b() { return a(); }
        function c() { return b(); }
        export { a, b, c };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        maxClusterSize: 1,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с maxClusterSize = 100', async () => {
      const testFile = path.join(testDir, 'max-size-100-test.js');
      let content = '';
      for (let i = 0; i < 50; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }
      const exports = Array.from({ length: 50 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'info',
        createBackup: true,
        maxClusterSize: 100,
        targetClusterSize: 10,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с maxAttempts = 1', async () => {
      const testFile = path.join(testDir, 'attempts-1-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        maxAttempts: 1,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с maxAttempts = 20', async () => {
      const testFile = path.join(testDir, 'attempts-20-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        maxAttempts: 20,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 3. РЕДКИЕ СИНТАКСИЧЕСКИЕ КОНСТРУКЦИИ
  // ============================================

  describe('Редкие синтаксические конструкции', () => {
    it('должен обрабатывать файл с декораторами', async () => {
      const testFile = path.join(testDir, 'decorators-test.ts');
      const content = `
        function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
          const original = descriptor.value;
          descriptor.value = function(...args: any[]) {
            console.log(\`Calling \${propertyKey} with \${args}\`);
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
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с namespace', async () => {
      const testFile = path.join(testDir, 'namespace-test.ts');
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
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с enum', async () => {
      const testFile = path.join(testDir, 'enum-test.ts');
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
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с generics', async () => {
      const testFile = path.join(testDir, 'generics-test.ts');
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
          
          setValue(value: T): void {
            this.value = value;
          }
        }

        export { identity, mapArray, Container };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с условными типами и mapped types', async () => {
      const testFile = path.join(testDir, 'conditional-types-test.ts');
      const content = `
        type IsArray<T> = T extends any[] ? true : false;
        
        type Nullable<T> = T | null | undefined;
        
        type Readonly<T> = {
          readonly [P in keyof T]: T[P];
        };
        
        type Partial<T> = {
          [P in keyof T]?: T[P];
        };

        interface User {
          id: number;
          name: string;
          email: string;
        }

        type ReadonlyUser = Readonly<User>;
        type PartialUser = Partial<User>;

        function processUser(user: User): void {
          console.log(user);
        }

        export { processUser };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с async iterators и for-await-of', async () => {
      const testFile = path.join(testDir, 'async-iterator-test.js');
      const content = `
        async function* asyncGenerator() {
          yield 1;
          yield 2;
          yield 3;
        }

        async function processData() {
          const results = [];
          for await (const value of asyncGenerator()) {
            results.push(value * 2);
          }
          return results;
        }

        export { asyncGenerator, processData };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с Symbols', async () => {
      const testFile = path.join(testDir, 'symbols-test.js');
      const content = `
        const id = Symbol('id');
        const name = Symbol('name');

        function createUser(userId: number, userName: string) {
          const user = {
            [id]: userId,
            [name]: userName
          };
          return user;
        }

        function getUserId(user: any) {
          return user[id];
        }

        export { createUser, getUserId };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с Proxy', async () => {
      const testFile = path.join(testDir, 'proxy-test.js');
      const content = `
        function createLoggingProxy(target: any) {
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

        const data = { count: 0 };
        const proxy = createLoggingProxy(data);

        function increment() {
          proxy.count++;
          return proxy.count;
        }

        export { increment };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с WeakMap, WeakSet', async () => {
      const testFile = path.join(testDir, 'weakmap-test.js');
      const content = `
        const cache = new WeakMap();
        const seen = new WeakSet();

        function processObject(obj: any) {
          if (seen.has(obj)) {
            return cache.get(obj);
          }
          
          const result = { processed: true, data: obj };
          cache.set(obj, result);
          seen.add(obj);
          return result;
        }

        export { processObject };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с BigInt', async () => {
      const testFile = path.join(testDir, 'bigint-test.js');
      const content = `
        function addBigInts(a: bigint, b: bigint): bigint {
          return a + b;
        }

        function multiplyBigInts(a: bigint, b: bigint): bigint {
          return a * b;
        }

        const bigNumber = 12345678901234567890n;

        function getBigNumber(): bigint {
          return bigNumber;
        }

        export { addBigInts, multiplyBigInts, getBigNumber };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с import.meta', async () => {
      const testFile = path.join(testDir, 'import-meta-test.js');
      const content = `
        function getModuleUrl(): string {
          return import.meta.url;
        }

        function getModuleDir(): string {
          return import.meta.dirname;
        }

        export { getModuleUrl, getModuleDir };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с top-level await', async () => {
      const testFile = path.join(testDir, 'top-level-await-test.js');
      const content = `
        const data = await Promise.resolve({ id: 1, name: 'Test' });

        function getData() {
          return data;
        }

        function processData() {
          return { ...data, processed: true };
        }

        export { getData, processData };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с приватными полями класса', async () => {
      const testFile = path.join(testDir, 'private-fields-test.js');
      const content = `
        class User {
          #id: number;
          #name: string;
          
          constructor(id: number, name: string) {
            this.#id = id;
            this.#name = name;
          }
          
          getId(): number {
            return this.#id;
          }
          
          getName(): string {
            return this.#name;
          }
          
          #privateMethod(): void {
            console.log('Private method');
          }
          
          publicMethod(): void {
            this.#privateMethod();
          }
        }

        export { User };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 4. СМЕШАННЫЕ И КОМБИНИРОВАННЫЕ СЦЕНАРИИ
  // ============================================

  describe('Смешанные и комбинированные сценарии', () => {
    it('должен обрабатывать файл, содержащий все редкие конструкции вместе', async () => {
      const testFile = path.join(testDir, 'all-rare-test.ts');
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

        // Namespace
        namespace MyUtils {
          export const PI = 3.14159;
          
          export function circleArea(radius: number): number {
            return PI * radius * radius;
          }
        }

        // Enum
        enum Color {
          Red = 'red',
          Green = 'green',
          Blue = 'blue'
        }

        // Generics
        function identity<T>(value: T): T {
          return value;
        }

        // Class с приватными полями
        class Calculator {
          #result: number = 0;
          
          @log
          add(a: number, b: number): number {
            this.#result = a + b;
            return this.#result;
          }
          
          getResult(): number {
            return this.#result;
          }
        }

        // Async generator
        async function* asyncGenerator() {
          yield 1;
          yield 2;
          yield 3;
        }

        export { MyUtils, Color, identity, Calculator, asyncGenerator };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с экзотическими комбинациями параметров', async () => {
      const testFile = path.join(testDir, 'exotic-params-test.js');
      const content = `
        function processWithDefaults(
          a = 1,
          b = 2,
          c = 3
        ): number {
          return a + b + c;
        }

        function processWithRestAndDefaults(
          first: string,
          second: string = 'default',
          ...rest: string[]
        ): string[] {
          return [first, second, ...rest];
        }

        function processWithDestructuring(
          { id, name }: { id: number; name: string },
          [first, second]: [number, number]
        ): { id: number; name: string; sum: number } {
          return { id, name, sum: first + second };
        }

        export { processWithDefaults, processWithRestAndDefaults, processWithDestructuring };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
        typeCheck: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с очень большим количеством вложенных условий', async () => {
      const testFile = path.join(testDir, 'nested-conditions-test.js');
      const content = `
        function processNestedConditions(a: number, b: number, c: number): string {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (a > b) {
                  if (b > c) {
                    return 'All positive, a > b > c';
                  } else {
                    return 'All positive, a > b <= c';
                  }
                } else {
                  return 'All positive, a <= b';
                }
              } else {
                return 'a > 0, b > 0, c <= 0';
              }
            } else {
              return 'a > 0, b <= 0';
            }
          } else {
            return 'a <= 0';
          }
        }

        export { processNestedConditions };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с большим количеством switch case', async () => {
      const testFile = path.join(testDir, 'many-switch-test.js');
      const content = `
        function processSwitch(value: number): string {
          switch (value) {
            case 1: return 'One';
            case 2: return 'Two';
            case 3: return 'Three';
            case 4: return 'Four';
            case 5: return 'Five';
            case 6: return 'Six';
            case 7: return 'Seven';
            case 8: return 'Eight';
            case 9: return 'Nine';
            case 10: return 'Ten';
            default: return 'Unknown';
          }
        }

        export { processSwitch };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с очень большим количеством try-catch-finally', async () => {
      const testFile = path.join(testDir, 'many-try-test.js');
      const content = `
        function processWithTryCatch(value: any): any {
          try {
            try {
              try {
                return JSON.parse(value);
              } catch (e) {
                return { error: 'Parse error' };
              }
            } catch (e) {
              return { error: 'Nested error' };
            }
          } catch (e) {
            return { error: 'Outer error' };
          } finally {
            console.log('Done');
          }
        }

        export { processWithTryCatch };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });
});
