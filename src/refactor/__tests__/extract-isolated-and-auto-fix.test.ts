// packages/ast-analyzer/src/refactor/__tests__/extract-isolated-and-auto-fix.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('Интеграция --extract-isolated и --auto-fix', () => {
  const testDir = path.join(process.cwd(), 'test-temp-integration');

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
  // 1. БАЗОВАЯ ИНТЕГРАЦИЯ
  // ============================================

  describe('Базовая интеграция', () => {
    it('1.1 должен выделять изолированные функции и исправлять их импорты', async () => {
      const content = `
        import { helper1 } from '../../modules/helper1.js';
        import { helper2 } from '../../modules/helper2.js';
        import { helper3 } from './helper3.js';
        
        function isolatedWithDeps() {
          return helper1() + helper2();
        }
        
        function isolatedSimple() {
          return 42;
        }
        
        function main() {
          return isolatedWithDeps() + isolatedSimple() + helper3();
        }
        
        export { main, isolatedWithDeps, isolatedSimple };
      `;
      const testFile = createTestFile(content, 'integration-test.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Пути должны быть исправлены
      expect(contentAfter).not.toContain('../../modules/');
      // Импорты должны быть оптимизированы
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBeGreaterThan(0);

      // Проверяем созданные модули
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Должны быть модули для изолированных функций
        const isolatedModule = files.find(f => f.includes('isolated'));
        expect(isolatedModule).toBeDefined();

        // Проверяем, что импорты в модулях исправлены
        const moduleContent = fs.readFileSync(path.join(modulesDir, isolatedModule!), 'utf-8');
        expect(moduleContent).not.toContain('../../modules/');
      }
    });

    it('1.2 должен выделять изолированные функции и исправлять дублирующиеся импорты', async () => {
      const content = `
        import { helper1 } from '../../modules/helper.js';
        import { helper2 } from '../../modules/helper.js';
        import { helper3 } from '../../modules/helper.js';
        
        function isolatedA() {
          return helper1();
        }
        
        function isolatedB() {
          return helper2() + helper3();
        }
        
        function main() {
          return isolatedA() + isolatedB();
        }
        
        export { main, isolatedA, isolatedB };
      `;
      const testFile = createTestFile(content, 'integration-duplicates.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Должен быть один импорт вместо трех
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBe(1);
      // Путь исправлен
      expect(contentAfter).not.toContain('../../modules/');
    });

    it('1.3 должен выделять изолированные функции и удалять пустые импорты', async () => {
      const content = `
        import './empty-module.js';
        import { helper } from '../../modules/helper.js';
        
        function isolated() {
          return helper();
        }
        
        function main() {
          return isolated();
        }
        
        export { main, isolated };
      `;
      const testFile = createTestFile(content, 'integration-empty-imports.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Пустой импорт должен быть удален
      expect(contentAfter).not.toContain("import './empty-module.js'");
    });

    it('1.4 должен выделять изолированные функции с исправлением конфликтов имен', async () => {
      const content = `
        import { process } from '../../modules/process-a.js';
        import { process as processB } from '../../modules/process-b.js';
        
        function isolatedA() {
          return process();
        }
        
        function isolatedB() {
          return processB();
        }
        
        function main() {
          return isolatedA() + isolatedB();
        }
        
        export { main, isolatedA, isolatedB };
      `;
      const testFile = createTestFile(content, 'integration-conflicts.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Конфликты должны быть разрешены
      expect(contentAfter).toContain('import { process } from');
      expect(contentAfter).toContain('import { process as processB } from');
      // Пути исправлены
      expect(contentAfter).not.toContain('../../modules/');
    });
  });

  // ============================================
  // 2. СЛОЖНЫЕ СЦЕНАРИИ ИНТЕГРАЦИИ
  // ============================================

  describe('Сложные сценарии интеграции', () => {
    it('2.1 должен выделять изолированные функции с зависимостями И исправлять все импорты', async () => {
      const content = `
        import { helper1 } from '../../modules/helper1.js';
        import { helper2 } from '../../modules/helper2.js';
        import { helper3 } from '../../modules/helper3.js';
        import { helper4 } from './helper4.js';
        import { helper5 } from './helper5.js';
        
        function isolatedComplex() {
          const a = helper1();
          const b = helper2();
          const c = helper3();
          return a + b + c;
        }
        
        function isolatedSimple() {
          return helper4() + helper5();
        }
        
        function main() {
          return isolatedComplex() + isolatedSimple();
        }
        
        export { main, isolatedComplex, isolatedSimple };
      `;
      const testFile = createTestFile(content, 'integration-complex.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');

      // Импорты из одного модуля должны быть сгруппированы
      expect(contentAfter).toContain('import { helper1, helper2, helper3 } from');
      // Импорты из разных модулей должны остаться отдельно
      expect(contentAfter).toContain("import { helper4 } from './helper4.js'");
      expect(contentAfter).toContain("import { helper5 } from './helper5.js'");
      // Пути исправлены
      expect(contentAfter).not.toContain('../../modules/');
    });

    it('2.2 должен выделять изолированные функции с вложенными зависимостями И исправлять пути', async () => {
      const content = `
        import { helper } from '../../../deep/helper.js';
        import { utils } from '../../utils.js';
        import { config } from '../config.js';
        
        function isolatedWithNested() {
          return helper() + utils();
        }
        
        function isolatedWithConfig() {
          return config();
        }
        
        function main() {
          return isolatedWithNested() + isolatedWithConfig();
        }
        
        export { main, isolatedWithNested, isolatedWithConfig };
      `;
      const testFile = createTestFile(content, 'integration-nested-paths.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Все глубокие пути должны быть исправлены
      expect(contentAfter).not.toContain('../../../');
      expect(contentAfter).not.toContain('../../');
      expect(contentAfter).not.toContain('../');
    });

    it('2.3 должен выделять изолированные функции с циклическими зависимостями И исправлять импорты', async () => {
      const content = `
        import { helperA } from '../../modules/helperA.js';
        import { helperB } from '../../modules/helperB.js';
        
        function isolatedCycle() {
          return helperA() + helperB();
        }
        
        function isolatedDirect() {
          return 42;
        }
        
        function main() {
          return isolatedCycle() + isolatedDirect();
        }
        
        export { main, isolatedCycle, isolatedDirect };
      `;
      const testFile = createTestFile(content, 'integration-cycles.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 30,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Импорты должны быть исправлены
      expect(contentAfter).not.toContain('../../modules/');
      // Циклические зависимости должны быть обработаны
      expect(contentAfter).toContain('import { helperA, helperB } from');
    });
  });

  // ============================================
  // 3. СЦЕНАРИИ С РАЗНЫМИ ТИПАМИ ФАЙЛОВ
  // ============================================

  describe('Сценарии с разными типами файлов', () => {
    it('3.1 должен работать с TypeScript файлами', async () => {
      const content = `
        import { helper } from '../../modules/helper.ts';
        import type { User } from '../../types/user.ts';
        import { config } from '../../config.ts';
        
        function isolatedGetUser(id: number): User {
          return { id, name: 'User ' + id };
        }
        
        function isolatedProcess(user: User): string {
          return \`\${user.id}: \${user.name}\`;
        }
        
        function main(): string {
          const user = isolatedGetUser(1);
          return isolatedProcess(user);
        }
        
        export { main, isolatedGetUser, isolatedProcess };
      `;
      const testFile = createTestFile(content, 'integration-ts.ts');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Импорты исправлены
      expect(contentAfter).not.toContain('../../modules/');
      expect(contentAfter).not.toContain('../../types/');
      // Type импорты сохранены
      expect(contentAfter).toContain('import type { User } from');
    });

    it('3.2 должен работать с JSX файлами', async () => {
      const content = `
        import React from 'react';
        import { Button } from '../../components/Button.jsx';
        import { Input } from '../../components/Input.jsx';
        import { Form } from '../../components/Form.jsx';
        
        function isolatedButton() {
          return <Button>Click me</Button>;
        }
        
        function isolatedInput() {
          return <Input type="text" />;
        }
        
        function App() {
          return (
            <Form>
              {isolatedButton()}
              {isolatedInput()}
            </Form>
          );
        }
        
        export { App, isolatedButton, isolatedInput };
      `;
      const testFile = createTestFile(content, 'integration-jsx.jsx');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Импорты исправлены
      expect(contentAfter).not.toContain('../../components/');
      // Компоненты сгруппированы
      expect(contentAfter).toContain('import { Button, Input, Form } from');
    });

    it('3.3 должен работать с Vue файлами', async () => {
      const content = `
        <script setup>
        import { ref } from 'vue';
        import { helper } from '../../modules/helper.js';
        import { format } from '../../modules/format.js';
        import { validate } from '../../modules/validate.js';
        
        function isolatedCount() {
          return ref(0);
        }
        
        function isolatedProcess() {
          return helper() + format() + validate();
        }
        
        const count = isolatedCount();
        const result = isolatedProcess();
        </script>
        <template>
          <div>
            <p>Count: {{ count }}</p>
            <p>Result: {{ result }}</p>
          </div>
        </template>
      `;
      const testFile = createTestFile(content, 'integration-vue.vue');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Импорты исправлены
      expect(contentAfter).not.toContain('../../modules/');
      // Импорты сгруппированы
      expect(contentAfter).toContain('import { helper, format, validate } from');
    });
  });

  // ============================================
  // 4. СЦЕНАРИИ С РАЗНЫМИ НАСТРОЙКАМИ
  // ============================================

  describe('Сценарии с разными настройками', () => {
    it('4.1 должен работать с extractIsolatedFunctions=false и autoFix=true', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        import { helper2 } from '../../modules/helper2.js';
        import { helper3 } from '../../modules/helper3.js';
        import { unused } from './unused.js';
        
        function isolated() {
          return helper() + helper2() + helper3();
        }
        
        function main() {
          return isolated();
        }
        
        export { main, isolated };
      `;
      const testFile = createTestFile(content, 'integration-false-true.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: false,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');

      // Импорты должны быть исправлены (autoFix работает)
      expect(contentAfter).not.toContain('../../modules/');
      expect(contentAfter).toContain('import { helper, helper2, helper3 } from');
      expect(contentAfter).not.toContain('unused');

      // isolated может быть не выделена (extractIsolatedFunctions=false)
      // но это нормально
    });

    it('4.2 должен работать с extractIsolatedFunctions=true и autoFix=false', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        import { helper2 } from '../../modules/helper2.js';
        import { helper3 } from '../../modules/helper3.js';
        import { unused } from './unused.js';
        
        function isolated() {
          return helper() + helper2() + helper3();
        }
        
        function main() {
          return isolated();
        }
        
        export { main, isolated };
      `;
      const testFile = createTestFile(content, 'integration-true-false.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: false,
        fixUnusedImports: true,
        optimizeImports: true,
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');

      // Импорты могут быть не исправлены полностью (autoFix=false)
      // Но isolated должна быть выделена (extractIsolatedFunctions=true)
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        const isolatedModule = files.find(f => f.includes('isolated'));
        // isolated может быть выделена, но это зависит от кластеризации
      }
    });

    it('4.3 должен работать в режиме dry-run с обоими флагами', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        import { helper2 } from '../../modules/helper2.js';
        
        function isolated() {
          return helper() + helper2();
        }
        
        function main() {
          return isolated();
        }
        
        export { main, isolated };
      `;
      const testFile = createTestFile(content, 'integration-dry-run.js');
      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Файл не должен измениться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(originalContent);
    });

    it('4.4 должен работать с разными уровнями логирования', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        
        function isolated() {
          return helper();
        }
        
        function main() {
          return isolated();
        }
        
        export { main, isolated };
      `;
      const testFile = createTestFile(content, 'integration-logging.js');

      const logFile = path.join(testDir, 'integration.log');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        logLevel: 'debug',
        logFile: logFile,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Проверяем, что лог-файл создан
      expect(fs.existsSync(logFile)).toBe(true);

      // Проверяем содержимое лога
      const logContent = fs.readFileSync(logFile, 'utf-8');
      expect(logContent).toContain('[INFO]');
      expect(logContent).toContain('[DEBUG]');
    });
  });

  // ============================================
  // 5. КОМПЛЕКСНЫЕ РЕАЛЬНЫЕ СЦЕНАРИИ
  // ============================================

  describe('Комплексные реальные сценарии', () => {
    it('5.1 должен обрабатывать реальный проект с множеством проблем', async () => {
      // Создаем структуру проекта
      const srcDir = path.join(testDir, 'src');
      const modulesDir = path.join(srcDir, 'modules');
      const utilsDir = path.join(srcDir, 'utils');
      const componentsDir = path.join(srcDir, 'components');

      fs.mkdirSync(modulesDir, { recursive: true });
      fs.mkdirSync(utilsDir, { recursive: true });
      fs.mkdirSync(componentsDir, { recursive: true });

      // Создаем файлы модулей
      fs.writeFileSync(
        path.join(modulesDir, 'user.js'),
        `
        export function getUser(id) {
          return { id, name: 'User ' + id };
        }
        export function saveUser(user) {
          return { ...user, saved: true };
        }
        export function deleteUser(id) {
          return { id, deleted: true };
        }
      `
      );

      fs.writeFileSync(
        path.join(utilsDir, 'format.js'),
        `
        export function formatDate(date) {
          return date.toISOString();
        }
        export function formatCurrency(amount) {
          return '$' + amount.toFixed(2);
        }
        export function formatName(name) {
          return name.toUpperCase();
        }
      `
      );

      fs.writeFileSync(
        path.join(componentsDir, 'Button.jsx'),
        `
        import React from 'react';
        export function Button({ onClick, children }) {
          return <button onClick={onClick}>{children}</button>;
        }
      `
      );

      // Основной файл со всеми проблемами
      const content = `
        import { getUser } from './modules/user.js';
        import { saveUser } from './modules/user.js';
        import { deleteUser } from './modules/user.js';
        import { formatDate } from './utils/format.js';
        import { formatCurrency } from './utils/format.js';
        import { formatName } from './utils/format.js';
        import { Button } from './components/Button.jsx';
        import { unusedHelper } from './unused.js';
        import './empty-module.js';
        
        import React from 'react';
        
        // Изолированная функция с зависимостями
        function processUser(userId) {
          const user = getUser(userId);
          user.createdAt = formatDate(new Date());
          user.balance = formatCurrency(user.balance || 0);
          user.name = formatName(user.name);
          return user;
        }
        
        // Изолированная функция без зависимостей
        function calculateDiscount(amount) {
          if (amount > 1000) {
            return amount * 0.1;
          } else if (amount > 500) {
            return amount * 0.05;
          }
          return 0;
        }
        
        // Изолированная функция с React
        function renderUserButton(user) {
          return <Button onClick={() => saveUser(user)}>
            Save {user.name}
          </Button>;
        }
        
        // Основная функция
        function main() {
          const user = processUser(1);
          const discount = calculateDiscount(100);
          const button = renderUserButton(user);
          return { user, discount, button };
        }
        
        export { main, processUser, calculateDiscount, renderUserButton };
        export { getUser, saveUser, deleteUser } from './modules/user.js';
        export { formatDate, formatCurrency, formatName } from './utils/format.js';
        export { Button } from './components/Button.jsx';
      `;
      const testFile = createTestFile(content, 'real-project.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 2,
        maxClusterSize: 3,
        minCohesionScore: 50,
        createBackup: true,
        incremental: true,
        dryRun: false,
        semanticAnalysis: true,
        jsxAnalysis: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');

      // 1. Импорты из одного модуля сгруппированы
      expect(contentAfter).toContain(
        "import { getUser, saveUser, deleteUser } from './modules/user.js'"
      );
      expect(contentAfter).toContain(
        "import { formatDate, formatCurrency, formatName } from './utils/format.js'"
      );

      // 2. Неиспользуемые импорты удалены
      expect(contentAfter).not.toContain('unusedHelper');
      expect(contentAfter).not.toContain("import './empty-module.js'");

      // 3. React импорт сохранен
      expect(contentAfter).toContain("import React from 'react'");

      // 4. Изолированные функции выделены
      const modulesDirAfter = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDirAfter)) {
        const files = fs.readdirSync(modulesDirAfter);
        // Должны быть модули для изолированных функций
        const processModule = files.find(f => f.includes('process-user'));
        const discountModule = files.find(f => f.includes('calculate-discount'));
        const renderModule = files.find(f => f.includes('render-user'));

        // Хотя бы одна изолированная функция должна быть выделена
        expect(processModule || discountModule || renderModule).toBeDefined();
      }

      // 5. Реэкспорты сохранены
      expect(contentAfter).toContain(
        "export { getUser, saveUser, deleteUser } from './modules/user.js'"
      );
      expect(contentAfter).toContain(
        "export { formatDate, formatCurrency, formatName } from './utils/format.js'"
      );
      expect(contentAfter).toContain("export { Button } from './components/Button.jsx'");
    });

    it('5.2 должен обрабатывать файл с 50+ изолированными функциями и импортами', async () => {
      let content = '';
      const exports = [];
      const imports = [];

      // Генерируем изолированные функции
      for (let i = 0; i < 50; i++) {
        content = content + 'function isolated' + i + '() { return ' + i + '; }\n';
        exports.push('isolated' + i);
      }

      // Генерируем функции с зависимостями
      for (let i = 0; i < 30; i++) {
        content = content + 'function dep' + i + '() { return ' + i * 2 + '; }\n';
        content =
          content + 'function isolatedWithDep' + i + '() { return dep' + i + '() + ' + i + '; }\n';
        exports.push('isolatedWithDep' + i);
      }

      // Добавляем проблемы с импортами
      for (let i = 0; i < 20; i++) {
        content = content + 'import { helper' + i + " } from '../../modules/helper" + i + ".js';\n";
        imports.push('helper' + i);
        content =
          content + 'import { helper' + i + "_2 } from '../../modules/helper" + i + ".js';\n";
        imports.push('helper' + i + '_2');
      }

      // Добавляем неиспользуемые импорты
      content = content + `import { unused } from './unused.js';\n`;
      content = content + `import './empty-module.js';\n`;

      // Основная функция
      let mainFunction = 'function main() {\n';
      mainFunction = mainFunction + '  let sum = 0;\n';
      mainFunction = mainFunction + '  for (let i = 0; i < 50; i++) {\n';
      mainFunction = mainFunction + '    sum += isolated' + 'i' + '();\n'; // Здесь 'i' - это строка, а не переменная
      mainFunction = mainFunction + '  }\n';
      mainFunction = mainFunction + '  for (let i = 0; i < 30; i++) {\n';
      mainFunction = mainFunction + '    sum += isolatedWithDep' + 'i' + '();\n';
      mainFunction = mainFunction + '  }\n';
      mainFunction = mainFunction + '  for (let i = 0; i < 20; i++) {\n';
      mainFunction = mainFunction + '    sum += helper' + 'i' + '() + helper' + 'i' + '_2();\n';
      mainFunction = mainFunction + '  }\n';
      mainFunction = mainFunction + '  return sum;\n';
      mainFunction = mainFunction + '}\n';

      content = content + mainFunction;
      content =
        content +
        'export { main, ' +
        exports.slice(0, 10).join(', ') +
        ', ...' +
        exports.slice(10) +
        ' };\n';

      const testFile = createTestFile(content, 'large-project.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
        logLevel: 'info',
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Большой проект должен обрабатываться за разумное время (< 30 сек)
      expect(duration).toBeLessThan(30000);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');

      // Импорты сгруппированы
      for (let i = 0; i < 20; i++) {
        expect(contentAfter).toContain(`import { helper${i}, helper${i}_2 } from`);
      }

      // Неиспользуемые импорты удалены
      expect(contentAfter).not.toContain('unused');
      expect(contentAfter).not.toContain("import './empty-module.js'");
    });
  });
});
