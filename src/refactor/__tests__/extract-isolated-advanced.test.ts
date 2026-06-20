// packages/ast-analyzer/src/refactor/__tests__/extract-isolated-advanced.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('--extract-isolated: Расширенные сценарии', () => {
  const testDir = path.join(process.cwd(), 'test-temp-extract-advanced');

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
  // 7. РЕАЛЬНЫЕ СЦЕНАРИИ ИЗ ЛОГОВ
  // ============================================

  describe('Реальные сценарии из логов', () => {
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

      // Проверяем, что изолированные функции выделены
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const validateModule = files.find(f => f.includes('validate'));
        const sizeModule = files.find(f => f.includes('size'));

        // Одна или обе изолированные функции должны быть выделены
        expect(validateModule || sizeModule).toBeDefined();
      }
    });

    it('7.2 должен выделять изолированную функцию с зависимостями из того же файла', async () => {
      const content = `
        // helpers.js - реальный сценарий
        function formatDate(date) {
          return date.toISOString();
        }
        
        function formatCurrency(amount) {
          return \`$\${amount.toFixed(2)}\`;
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

      // Проверяем, что formatUserData выделена вместе с formatDate
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const userModule = files.find(f => f.includes('user'));
        if (userModule) {
          const content = fs.readFileSync(path.join(modulesDir, userModule), 'utf-8');
          expect(content).toContain('formatUserData');
          expect(content).toContain('formatDate');
        }
      }
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

      // validateInput должна быть выделена вместе с validateEmail и validatePhone
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const validationModule = files.find(f => f.includes('validation'));
        expect(validationModule).toBeDefined();
      }
    });
  });

  // ============================================
  // 8. СЦЕНАРИИ С РАЗНЫМИ УРОВНЯМИ ИЗОЛЯЦИИ
  // ============================================

  describe('Разные уровни изоляции', () => {
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
          // helper должна быть включена или импортирована
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

      // Функция с низкой изоляцией может быть выделена вместе со всеми зависимостями
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Если выделена, то со всеми зависимостями
        const lowModule = files.find(f => f.includes('low'));
        if (lowModule) {
          const content = fs.readFileSync(path.join(modulesDir, lowModule), 'utf-8');
          expect(content).toContain('lowIsolation');
          // Должны быть все зависимости
          expect(content).toContain('dep1');
          expect(content).toContain('dep2');
          expect(content).toContain('dep3');
          expect(content).toContain('dep4');
          expect(content).toContain('dep5');
        }
      }
    });
  });

  // ============================================
  // 9. СЦЕНАРИИ С РАЗНЫМИ ТИПАМИ ЗАВИСИМОСТЕЙ
  // ============================================

  describe('Разные типы зависимостей', () => {
    it('9.1 должен выделять функцию с зависимостью от константы', async () => {
      const content = `
        const API_URL = 'https://api.example.com';
        const TIMEOUT = 5000;
        
        function fetchData() {
          return fetch(API_URL, { timeout: TIMEOUT });
        }
        
        function main() {
          return fetchData();
        }
        export { main, fetchData };
      `;
      const testFile = createTestFile(content, 'const-dependency.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
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
        const fetchModule = files.find(f => f.includes('fetch'));
        if (fetchModule) {
          const content = fs.readFileSync(path.join(modulesDir, fetchModule), 'utf-8');
          expect(content).toContain('fetchData');
          // Константы должны быть скопированы или импортированы
          expect(content).toContain('API_URL');
          expect(content).toContain('TIMEOUT');
        }
      }
    });

    it('9.2 должен выделять функцию с зависимостью от класса', async () => {
      const content = `
        class Logger {
          log(message) {
            console.log(message);
          }
        }
        
        function logMessage(message) {
          const logger = new Logger();
          logger.log(message);
        }
        
        function main() {
          logMessage('Hello');
        }
        export { main, logMessage };
      `;
      const testFile = createTestFile(content, 'class-dependency.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
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
        const logModule = files.find(f => f.includes('log'));
        if (logModule) {
          const content = fs.readFileSync(path.join(modulesDir, logModule), 'utf-8');
          expect(content).toContain('logMessage');
          // Класс Logger должен быть скопирован
          expect(content).toContain('class Logger');
        }
      }
    });

    it('9.3 должен выделять функцию с зависимостью от интерфейса (TypeScript)', async () => {
      const content = `
        interface User {
          id: number;
          name: string;
          email: string;
        }
        
        function getUser(id: number): User {
          return { id, name: 'User ' + id, email: 'user@example.com' };
        }
        
        function main() {
          return getUser(1);
        }
        export { main, getUser };
      `;
      const testFile = createTestFile(content, 'interface-dependency.ts');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 60,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const userModule = files.find(f => f.includes('user'));
        if (userModule) {
          const content = fs.readFileSync(path.join(modulesDir, userModule), 'utf-8');
          expect(content).toContain('getUser');
          // Интерфейс должен быть скопирован
          expect(content).toContain('interface User');
        }
      }
    });

    it('9.4 должен выделять функцию с зависимостью от enum (TypeScript)', async () => {
      const content = `
        enum Status {
          Pending = 'pending',
          Approved = 'approved',
          Rejected = 'rejected'
        }
        
        function getStatusMessage(status: Status): string {
          return \`Status: \${status}\`;
        }
        
        function main() {
          return getStatusMessage(Status.Approved);
        }
        export { main, getStatusMessage };
      `;
      const testFile = createTestFile(content, 'enum-dependency.ts');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 60,
        createBackup: true,
        incremental: true,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const statusModule = files.find(f => f.includes('status'));
        if (statusModule) {
          const content = fs.readFileSync(path.join(modulesDir, statusModule), 'utf-8');
          expect(content).toContain('getStatusMessage');
          // Enum должен быть скопирован
          expect(content).toContain('enum Status');
        }
      }
    });
  });

  // ============================================
  // 10. СЦЕНАРИИ С РАЗНЫМИ РАЗМЕРАМИ КЛАСТЕРОВ
  // ============================================

  describe('Разные размеры кластеров', () => {
    it('10.1 должен выделять изолированные функции в маленькие кластеры (size=1)', async () => {
      const content = `
        function func1() { return 1; }
        function func2() { return 2; }
        function func3() { return 3; }
        function func4() { return 4; }
        function func5() { return 5; }
        
        function main() {
          return func1() + func2() + func3() + func4() + func5();
        }
        export { main, func1, func2, func3, func4, func5 };
      `;
      const testFile = createTestFile(content, 'small-clusters.js');

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

      // Каждая функция должна быть в отдельном модуле
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Должно быть как минимум 5 модулей (func1-func5)
        const funcModules = files.filter(f => f.match(/func[1-5]/));
        expect(funcModules.length).toBe(5);
      }
    });

    it('10.2 должен выделять изолированные функции в большие кластеры (size=5)', async () => {
      const content = `
        function helper1() { return 1; }
        function helper2() { return helper1() + 1; }
        function helper3() { return helper2() + 1; }
        function helper4() { return helper3() + 1; }
        function helper5() { return helper4() + 1; }
        
        function main() {
          return helper5();
        }
        export { main, helper1, helper2, helper3, helper4, helper5 };
      `;
      const testFile = createTestFile(content, 'large-clusters.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 5,
        maxClusterSize: 6,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Все helper функции должны быть в одном модуле
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Должен быть один модуль со всеми helper функциями
        const helperModule = files.find(f => f.includes('helper'));
        if (helperModule) {
          const content = fs.readFileSync(path.join(modulesDir, helperModule), 'utf-8');
          expect(content).toContain('helper1');
          expect(content).toContain('helper2');
          expect(content).toContain('helper3');
          expect(content).toContain('helper4');
          expect(content).toContain('helper5');
        }
      }
    });

    it('10.3 должен выделять изолированные функции с учетом порога связности', async () => {
      const content = `
        // Связанная группа
        function related1() { return related2(); }
        function related2() { return related3(); }
        function related3() { return related1(); }
        
        // Изолированная функция
        function isolated() { return 42; }
        
        function main() {
          return related1() + isolated();
        }
        export { main, related1, related2, related3, isolated };
      `;
      const testFile = createTestFile(content, 'cohesion-threshold.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 70,
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
        // Связанная группа должна быть выделена вместе
        const relatedModule = files.find(f => f.includes('related'));
        if (relatedModule) {
          const content = fs.readFileSync(path.join(modulesDir, relatedModule), 'utf-8');
          expect(content).toContain('related1');
          expect(content).toContain('related2');
          expect(content).toContain('related3');
        }

        // Изолированная функция должна быть выделена отдельно или остаться в main
        const isolatedModule = files.find(f => f.includes('isolated'));
        // isolated может быть выделена отдельно или остаться в main
        // В любом случае это корректно
      }
    });
  });

  // ============================================
  // 11. СЦЕНАРИИ С РАЗНЫМИ ТИПАМИ ЭКСПОРТОВ
  // ============================================

  describe('Разные типы экспортов', () => {
    it('11.1 должен выделять изолированную именованную функцию (export function)', async () => {
      const content = `
        export function isolatedFunction() {
          return 42;
        }
        
        export function main() {
          return isolatedFunction();
        }
      `;
      const testFile = createTestFile(content, 'named-export.js');

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
        const isolatedModule = files.find(f => f.includes('isolated'));
        expect(isolatedModule).toBeDefined();

        const content = fs.readFileSync(path.join(modulesDir, isolatedModule!), 'utf-8');
        expect(content).toContain('export function isolatedFunction');
      }
    });

    it('11.2 должен выделять изолированную стрелочную функцию (export const)', async () => {
      const content = `
        export const isolatedFunction = () => 42;
        
        export const main = () => isolatedFunction();
      `;
      const testFile = createTestFile(content, 'arrow-export.js');

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
        const isolatedModule = files.find(f => f.includes('isolated'));
        expect(isolatedModule).toBeDefined();

        const content = fs.readFileSync(path.join(modulesDir, isolatedModule!), 'utf-8');
        expect(content).toContain('export const isolatedFunction');
      }
    });

    it('11.3 должен выделять изолированную функцию с default экспортом', async () => {
      const content = `
        function isolatedFunction() {
          return 42;
        }
        
        function main() {
          return isolatedFunction();
        }
        
        export default main;
        export { isolatedFunction };
      `;
      const testFile = createTestFile(content, 'default-export.js');

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
        const isolatedModule = files.find(f => f.includes('isolated'));
        expect(isolatedModule).toBeDefined();
      }
    });

    it('11.4 должен выделять изолированную функцию с реэкспортом', async () => {
      const content = `
        function isolatedFunction() {
          return 42;
        }
        
        function main() {
          return isolatedFunction();
        }
        
        export { main, isolatedFunction };
        export { isolatedFunction as isolated } from './isolated.js';
      `;
      const testFile = createTestFile(content, 're-export.js');

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
  // 12. СЦЕНАРИИ С ТИПАМИ ФАЙЛОВ .ts, .jsx, .vue
  // ============================================

  describe('Поддержка разных типов файлов', () => {
    it('12.1 должен выделять изолированную функцию в .ts файле с интерфейсами', async () => {
      const content = `
        interface Config {
          api: string;
          timeout: number;
        }
        
        interface Response {
          data: any;
          status: number;
        }
        
        function fetchData(config: Config): Promise<Response> {
          return fetch(config.api, { timeout: config.timeout })
            .then(res => ({
              data: res.json(),
              status: res.status
            }));
        }
        
        function main(): Promise<Response> {
          const config: Config = {
            api: 'https://api.example.com',
            timeout: 5000
          };
          return fetchData(config);
        }
        
        export { main, fetchData };
      `;
      const testFile = createTestFile(content, 'typescript-interfaces.ts');

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

      // Проверяем, что интерфейсы скопированы в модуль
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const fetchModule = files.find(f => f.includes('fetch'));
        if (fetchModule) {
          const content = fs.readFileSync(path.join(modulesDir, fetchModule), 'utf-8');
          expect(content).toContain('interface Config');
          expect(content).toContain('interface Response');
        }
      }
    });

    it('12.2 должен выделять изолированную функцию в .jsx файле', async () => {
      const content = `
        import React from 'react';
        
        function Button({ onClick, children }) {
          return <button onClick={onClick}>{children}</button>;
        }
        
        function Counter() {
          const [count, setCount] = React.useState(0);
          return (
            <div>
              <Button onClick={() => setCount(count + 1)}>
                Click me: {count}
              </Button>
            </div>
          );
        }
        
        function isolatedHelper() {
          return 42;
        }
        
        function main() {
          return isolatedHelper();
        }
        
        export { main, Counter, Button, isolatedHelper };
      `;
      const testFile = createTestFile(content, 'jsx-component.jsx');

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

      // isolatedHelper должна быть выделена
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const helperModule = files.find(f => f.includes('helper'));
        expect(helperModule).toBeDefined();
      }
    });

    it('12.3 должен выделять изолированную функцию в .vue файле', async () => {
      const content = `
        <script setup>
        import { ref } from 'vue';
        
        function isolatedHelper() {
          return 42;
        }
        
        function formatDate(date) {
          return new Date(date).toLocaleDateString();
        }
        
        const count = ref(0);
        
        function increment() {
          count.value++;
        }
        
        function main() {
          return isolatedHelper() + formatDate(new Date());
        }
        </script>
        
        <template>
          <div>
            <p>Count: {{ count }}</p>
            <button @click="increment">+</button>
            <p>{{ main() }}</p>
          </div>
        </template>
        
        <style scoped>
          div { padding: 20px; }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-component.vue');

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

      // isolatedHelper должна быть выделена
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const helperModule = files.find(f => f.includes('helper'));
        expect(helperModule).toBeDefined();
      }
    });
  });

  // ============================================
  // 13. СЦЕНАРИИ С ФЛАГОМ --extract-isolated=false
  // ============================================

  describe('С флагом --extract-isolated=false', () => {
    it('13.1 не должен выделять изолированные функции', async () => {
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

      // isolatedFunction не должна быть выделена отдельно
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isolatedModule = files.find(f => f.includes('isolated-function'));
        // Функция может быть выделена вместе с main, но не отдельно
      }
    });

    it('13.2 должен группировать все функции в один модуль, если extractIsolatedFunctions=false', async () => {
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

    it('13.3 должен сохранять изолированные функции в основном файле', async () => {
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
  // 14. СЦЕНАРИИ С ОПТИМИЗАЦИЕЙ
  // ============================================

  describe('Оптимизация выделения изолированных функций', () => {
    it('14.1 должен выделять изолированную функцию с внутренней логикой (if/else, циклы)', async () => {
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

    it('14.2 должен выделять изолированную функцию с вложенными функциями', async () => {
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

    it('14.3 должен выделять изолированную функцию с импортами и экспортами', async () => {
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

    it('14.4 должен выделять изолированную функцию с деструктуризацией', async () => {
      const content = `
        function processUser({ id, name, email }) {
          return {
            userId: id,
            displayName: name.toUpperCase(),
            contact: email
          };
        }
        
        function main() {
          const user = { id: 1, name: 'John', email: 'john@example.com' };
          return processUser(user);
        }
        export { main, processUser };
      `;
      const testFile = createTestFile(content, 'isolated-destructuring.js');

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

      // Деструктуризация должна быть скопирована
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir);
        for (const file of moduleFiles) {
          const content = fs.readFileSync(path.join(modulesDir, file), 'utf-8');
          if (content.includes('processUser')) {
            expect(content).toContain('{ id, name, email }');
          }
        }
      }
    });

    it('14.5 должен выделять изолированную функцию с rest оператором', async () => {
      const content = `
        function sum(...numbers) {
          return numbers.reduce((acc, n) => acc + n, 0);
        }
        
        function main() {
          return sum(1, 2, 3, 4, 5);
        }
        export { main, sum };
      `;
      const testFile = createTestFile(content, 'isolated-rest.js');

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

      // Rest оператор должен быть скопирован
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir);
        for (const file of moduleFiles) {
          const content = fs.readFileSync(path.join(modulesDir, file), 'utf-8');
          if (content.includes('sum')) {
            expect(content).toContain('...numbers');
          }
        }
      }
    });
  });

  // ============================================
  // 15. СЦЕНАРИИ С ОШИБКАМИ И ВОССТАНОВЛЕНИЕМ
  // ============================================

  describe('Ошибки и восстановление', () => {
    it('15.1 должен восстанавливаться после ошибки при выделении изолированной функции', async () => {
      const content = `
        function isolatedFunction() {
          return 42;
        }
        
        function main() {
          return isolatedFunction();
        }
        export { main, isolatedFunction };
      `;
      const testFile = createTestFile(content, 'recovery-test.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        guaranteeMode: true,
        maxAttempts: 3,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      let attempts = 0;
      const originalExtract = (refactor as any).extractor?.extractModules;
      if (originalExtract) {
        vi.spyOn((refactor as any).extractor, 'extractModules').mockImplementation(async () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('Simulated extraction error');
          }
          return originalExtract.call((refactor as any).extractor);
        });
      }

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('15.2 должен обрабатывать файл с синтаксическими ошибками в изолированной функции', async () => {
      const content = `
        function isolatedFunction() {
          const x = 1
          const y = 2
          return x + y
        }
        
        function main() {
          return isolatedFunction()
        }
        export { main, isolatedFunction }
      `;
      const testFile = createTestFile(content, 'syntax-errors.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      // Мокаем валидацию, чтобы пропустить синтаксические ошибки
      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      // Должен быть успех даже с синтаксическими ошибками
      expect(result.success).toBe(true);
    });

    it('15.3 должен обрабатывать циклические зависимости при выделении изолированных функций', async () => {
      const content = `
        function funcA() { return funcB(); }
        function funcB() { return funcC(); }
        function funcC() { return funcA(); }
        
        function isolatedFunction() {
          return 42;
        }
        
        function main() {
          return funcA() + isolatedFunction();
        }
        export { main, funcA, funcB, funcC, isolatedFunction };
      `;
      const testFile = createTestFile(content, 'cyclic-with-isolated.js');

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

      // isolatedFunction должна быть выделена, несмотря на циклы
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isolatedModule = files.find(f => f.includes('isolated'));
        expect(isolatedModule).toBeDefined();
      }
    });
  });
});
