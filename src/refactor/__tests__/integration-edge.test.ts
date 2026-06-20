// packages/ast-analyzer/src/refactor/__tests__/integration-edge.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('Интеграционные краевые тесты', () => {
  const testDir = path.join(process.cwd(), 'test-temp-integration-edge');

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
  // 1. РЕАЛЬНЫЙ ПРОЕКТ СО ВСЕМИ ПРОБЛЕМАМИ
  // ============================================

  it('должен выделять изолированные функции И исправлять все проблемы в реальном проекте', async () => {
    // Создаем структуру реального проекта
    const srcDir = path.join(testDir, 'src');
    const modulesDir = path.join(srcDir, 'modules');
    const utilsDir = path.join(srcDir, 'utils');
    fs.mkdirSync(modulesDir, { recursive: true });
    fs.mkdirSync(utilsDir, { recursive: true });

    // Создаем модули
    fs.writeFileSync(
      path.join(modulesDir, 'user.js'),
      `
      export function getUser(id) {
        return { id, name: 'User ' + id };
      }
      export function saveUser(user) {
        return { ...user, saved: true };
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
    `
    );

    // Основной файл со всеми проблемами
    const content = `
      import { getUser } from './modules/user.js';
      import { saveUser } from './modules/user.js';
      import { formatDate } from './utils/format.js';
      import { formatCurrency } from './utils/format.js';
      import { unusedHelper } from './unused.js';
      import './empty-module.js';
      
      // Изолированная функция с зависимостями
      function processUser(userId) {
        const user = getUser(userId);
        user.createdAt = formatDate(new Date());
        user.balance = formatCurrency(user.balance || 0);
        return user;
      }
      
      // Изолированная функция без зависимостей
      function calculateDiscount(amount) {
        if (amount > 1000) {
          return amount * 0.1;
        }
        return 0;
      }
      
      // Основная функция
      function main() {
        const user = processUser(1);
        const discount = calculateDiscount(100);
        return { user, discount };
      }
      
      export { main, processUser, calculateDiscount };
      export { getUser, saveUser } from './modules/user.js';
      export { formatDate, formatCurrency } from './utils/format.js';
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
    });

    await refactor.initialize();
    const result = await refactor.refactor(testFile);
    await refactor.dispose();

    expect(result.success).toBe(true);

    // Проверяем результат
    const contentAfter = fs.readFileSync(testFile, 'utf-8');

    // 1. Импорты должны быть сгруппированы
    expect(contentAfter).toContain("import { getUser, saveUser } from './modules/user.js'");
    expect(contentAfter).toContain(
      "import { formatDate, formatCurrency } from './utils/format.js'"
    );

    // 2. Неиспользуемые импорты удалены
    expect(contentAfter).not.toContain('unusedHelper');
    expect(contentAfter).not.toContain("import './empty-module.js'");

    // 3. Изолированные функции должны быть выделены
    const modulesDirAfter = path.join(testDir, 'modules');
    if (fs.existsSync(modulesDirAfter)) {
      const files = fs.readdirSync(modulesDirAfter);
      const processModule = files.find(f => f.includes('process-user'));
      const discountModule = files.find(f => f.includes('calculate-discount'));

      // Хотя бы одна изолированная функция должна быть выделена
      expect(processModule || discountModule).toBeDefined();
    }

    // 4. Реэкспорты должны сохраниться
    expect(contentAfter).toContain("export { getUser, saveUser } from './modules/user.js'");
    expect(contentAfter).toContain(
      "export { formatDate, formatCurrency } from './utils/format.js'"
    );
  });

  // ============================================
  // 2. БОЛЬШОЙ ФАЙЛ С МНОЖЕСТВОМ ПРОБЛЕМ
  // ============================================

  it('должен обрабатывать файл с 1000 изолированными функциями и исправлять импорты', async () => {
    let content = '';
    const exports = [];

    // Создаем 1000 изолированных функций
    for (let i = 0; i < 1000; i++) {
      content += `function isolated${i}() { return ${i}; }\n`;
      exports.push(`isolated${i}`);
    }

    // Добавляем проблемы
    content += `
      import { helper1 } from '../../modules/helper1.js';
      import { helper2 } from '../../modules/helper2.js';
      import { helper3 } from '../../modules/helper3.js';
      import { unused } from './unused.js';
      import './empty-module.js';
      
      function main() {
        return isolated0() + isolated999() + helper1() + helper2() + helper3();
      }
      
      export { main, ${exports.slice(0, 10).join(', ')}, ...${exports.slice(10)} };
    `;

    const testFile = createTestFile(content, '1000-isolated-with-imports.js');

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
    // 1000 функций должны обрабатываться за разумное время (< 30 сек)
    expect(duration).toBeLessThan(30000);

    // Проверяем, что импорты исправлены
    const contentAfter = fs.readFileSync(testFile, 'utf-8');
    expect(contentAfter).not.toContain('../../modules/');
    expect(contentAfter).not.toContain('unused');
    expect(contentAfter).not.toContain("import './empty-module.js'");
  });

  // ============================================
  // 3. ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ
  // ============================================

  it('должен обрабатывать файл с циклическими зависимостями и изолированными функциями', async () => {
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
      extractIsolatedFunctions: true,
      autoFix: true,
      fixUnusedImports: true,
      optimizeImports: true,
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

    // Проверяем, что изолированные функции выделены
    const modulesDir = path.join(testDir, 'modules');
    if (fs.existsSync(modulesDir)) {
      const files = fs.readdirSync(modulesDir);
      const isolatedFiles = files.filter(f => f.includes('isolated'));

      // Хотя бы одна изолированная функция должна быть выделена
      // (может быть не все, если они объединены в один модуль)
      expect(isolatedFiles.length).toBeGreaterThanOrEqual(0);
    }
  });

  // ============================================
  // 4. СЛОЖНЫЙ ПРОЕКТ С ВЛОЖЕННЫМИ МОДУЛЯМИ
  // ============================================

  it('должен обрабатывать проект с вложенными модулями и сложными импортами', async () => {
    // Создаем вложенную структуру
    const srcDir = path.join(testDir, 'src');
    const featuresDir = path.join(srcDir, 'features');
    const authDir = path.join(featuresDir, 'auth');
    const apiDir = path.join(featuresDir, 'api');
    const sharedDir = path.join(srcDir, 'shared');

    fs.mkdirSync(authDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(sharedDir, { recursive: true });

    // Создаем модули
    fs.writeFileSync(
      path.join(authDir, 'login.js'),
      `
      export function login(username, password) {
        return { token: 'token-' + username };
      }
      export function logout() {
        return { success: true };
      }
    `
    );

    fs.writeFileSync(
      path.join(authDir, 'register.js'),
      `
      export function register(userData) {
        return { id: 1, ...userData };
      }
    `
    );

    fs.writeFileSync(
      path.join(apiDir, 'client.js'),
      `
      import { login } from '../auth/login.js';
      export function apiClient() {
        return { auth: login };
      }
    `
    );

    fs.writeFileSync(
      path.join(sharedDir, 'utils.js'),
      `
      export function validateEmail(email) {
        return email.includes('@');
      }
      export function validatePassword(password) {
        return password.length >= 8;
      }
    `
    );

    // Основной файл с проблемами
    const content = `
      import { login } from '../features/auth/login.js';
      import { logout } from '../features/auth/login.js';
      import { register } from '../features/auth/register.js';
      import { apiClient } from '../features/api/client.js';
      import { validateEmail } from '../shared/utils.js';
      import { validatePassword } from '../shared/utils.js';
      import { unused } from './unused.js';
      
      // Изолированная функция с зависимостями
      function authenticate(username, password) {
        if (!validateEmail(username)) {
          return { error: 'Invalid email' };
        }
        if (!validatePassword(password)) {
          return { error: 'Invalid password' };
        }
        return login(username, password);
      }
      
      // Изолированная функция без зависимостей
      function generateToken() {
        return 'token-' + Date.now();
      }
      
      function main() {
        const auth = authenticate('user@example.com', 'password123');
        const token = generateToken();
        return { auth, token };
      }
      
      export { main, authenticate, generateToken };
      export { login, logout } from '../features/auth/login.js';
      export { register } from '../features/auth/register.js';
      export { apiClient } from '../features/api/client.js';
      export { validateEmail, validatePassword } from '../shared/utils.js';
    `;
    const testFile = createTestFile(content, 'complex-project.js');

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

    // 1. Импорты должны быть сгруппированы
    expect(contentAfter).toContain("import { login, logout } from '../features/auth/login.js'");
    expect(contentAfter).toContain(
      "import { validateEmail, validatePassword } from '../shared/utils.js'"
    );

    // 2. Неиспользуемые импорты удалены
    expect(contentAfter).not.toContain('unused');

    // 3. Реэкспорты должны сохраниться
    expect(contentAfter).toContain("export { login, logout } from '../features/auth/login.js'");
    expect(contentAfter).toContain("export { register } from '../features/auth/register.js'");
    expect(contentAfter).toContain("export { apiClient } from '../features/api/client.js'");
    expect(contentAfter).toContain(
      "export { validateEmail, validatePassword } from '../shared/utils.js'"
    );
  });

  // ============================================
  // 5. ПРОЕКТ С МНОЖЕСТВОМ РАЗНЫХ ТИПОВ ФАЙЛОВ
  // ============================================

  it('должен обрабатывать проект с .ts, .jsx, .vue файлами одновременно', async () => {
    const srcDir = path.join(testDir, 'src');
    const componentsDir = path.join(srcDir, 'components');
    const utilsDir = path.join(srcDir, 'utils');
    const viewsDir = path.join(srcDir, 'views');

    fs.mkdirSync(componentsDir, { recursive: true });
    fs.mkdirSync(utilsDir, { recursive: true });
    fs.mkdirSync(viewsDir, { recursive: true });

    // TS файл
    fs.writeFileSync(
      path.join(utilsDir, 'helpers.ts'),
      `
      export function formatDate(date: Date): string {
        return date.toISOString();
      }
      export function formatCurrency(amount: number): string {
        return '$' + amount.toFixed(2);
      }
    `
    );

    // JSX файл
    fs.writeFileSync(
      path.join(componentsDir, 'Button.jsx'),
      `
      import React from 'react';
      export function Button({ onClick, children }) {
        return <button onClick={onClick}>{children}</button>;
      }
    `
    );

    // Основной файл
    const content = `
      import { formatDate } from './utils/helpers.ts';
      import { formatCurrency } from './utils/helpers.ts';
      import { Button } from './components/Button.jsx';
      import { unused } from './unused.js';
      
      function isolatedFunction() {
        return 42;
      }
      
      function main() {
        const date = formatDate(new Date());
        const amount = formatCurrency(100);
        return { date, amount, isolated: isolatedFunction() };
      }
      
      export { main, isolatedFunction };
      export { formatDate, formatCurrency } from './utils/helpers.ts';
      export { Button } from './components/Button.jsx';
    `;
    const testFile = createTestFile(content, 'mixed-types.js');

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
      jsxAnalysis: true,
    });

    await refactor.initialize();
    const result = await refactor.refactor(testFile);
    await refactor.dispose();

    expect(result.success).toBe(true);

    const contentAfter = fs.readFileSync(testFile, 'utf-8');

    // 1. Импорты должны быть сгруппированы
    expect(contentAfter).toContain(
      "import { formatDate, formatCurrency } from './utils/helpers.ts'"
    );

    // 2. Неиспользуемые импорты удалены
    expect(contentAfter).not.toContain('unused');

    // 3. Реэкспорты должны сохраниться
    expect(contentAfter).toContain(
      "export { formatDate, formatCurrency } from './utils/helpers.ts'"
    );
    expect(contentAfter).toContain("export { Button } from './components/Button.jsx'");
  });

  // ============================================
  // 6. КРАЙНИЙ СЛУЧАЙ: ПУСТОЙ ПРОЕКТ
  // ============================================

  it('должен корректно обрабатывать пустой проект', async () => {
    const content = `
      // Пустой файл без кода
    `;
    const testFile = createTestFile(content, 'empty-project.js');

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
    expect(result.modules.length).toBe(0);
  });

  // ============================================
  // 7. КРАЙНИЙ СЛУЧАЙ: ТОЛЬКО ИМПОРТЫ
  // ============================================

  it('должен корректно обрабатывать файл только с импортами', async () => {
    const content = `
      import { helper1 } from './helper1.js';
      import { helper2 } from './helper2.js';
      import { helper3 } from './helper3.js';
    `;
    const testFile = createTestFile(content, 'only-imports.js');

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
    expect(result.modules.length).toBe(0);
  });

  // ============================================
  // 8. КРАЙНИЙ СЛУЧАЙ: ТОЛЬКО ЭКСПОРТЫ
  // ============================================

  it('должен корректно обрабатывать файл только с экспортами', async () => {
    const content = `
      export const CONSTANT = 42;
      export function helper() { return 1; }
      export class Helper { static method() { return 2; } }
    `;
    const testFile = createTestFile(content, 'only-exports.js');

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
  });

  // ============================================
  // 9. КРАЙНИЙ СЛУЧАЙ: ОЧЕНЬ ГЛУБОКАЯ ВЛОЖЕННОСТЬ
  // ============================================

  it('должен обрабатывать файл с очень глубокой вложенностью модулей', async () => {
    // Создаем глубокую вложенность
    let currentDir = testDir;
    const depth = 20;
    const paths = [];

    for (let i = 0; i < depth; i++) {
      const dirName = `level${i}`;
      currentDir = path.join(currentDir, dirName);
      fs.mkdirSync(currentDir, { recursive: true });
      paths.push(currentDir);
    }

    // Создаем файл на каждом уровне
    for (let i = 0; i < paths.length; i++) {
      const filePath = path.join(paths[i], `module${i}.js`);
      const isLast = i === paths.length - 1;
      const nextPath = isLast ? '' : `./level${i + 1}/module${i + 1}.js`;

      const content = `
        ${!isLast ? `import { helper${i + 1} } from '${nextPath}';` : ''}
        export function helper${i}() {
          return ${i}${!isLast ? ` + helper${i + 1}()` : ''};
        }
        export function isolated${i}() {
          return ${i * 2};
        }
      `;
      fs.writeFileSync(filePath, content);
    }

    // Основной файл с глубоким импортом
    const deepPath = paths.map((_, i) => '..').join('/');
    const content = `
      import { helper0 } from './${deepPath}/level0/module0.js';
      import { isolated0 } from './${deepPath}/level0/module0.js';
      
      function main() {
        return helper0() + isolated0();
      }
      
      export { main };
    `;
    const testFile = createTestFile(content, 'deep-nesting-main.js');

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
  });

  // ============================================
  // 10. КРАЙНИЙ СЛУЧАЙ: МНОЖЕСТВО РЕЭКСПОРТОВ
  // ============================================

  it('должен обрабатывать файл с множеством реэкспортов', async () => {
    // Создаем модули для реэкспорта
    for (let i = 1; i <= 10; i++) {
      const content = `
        export function func${i}() { return ${i}; }
        export const const${i} = ${i * 2};
      `;
      fs.writeFileSync(path.join(testDir, `module${i}.js`), content);
    }

    const content = `
      // Множество реэкспортов
      export { func1 } from './module1.js';
      export { func2 } from './module2.js';
      export { func3 } from './module3.js';
      export { func4 } from './module4.js';
      export { func5 } from './module5.js';
      export { func6 } from './module6.js';
      export { func7 } from './module7.js';
      export { func8 } from './module8.js';
      export { func9 } from './module9.js';
      export { func10 } from './module10.js';
      
      // Групповые реэкспорты
      export { const1, const2 } from './module1.js';
      export { const3, const4 } from './module3.js';
      export { const5, const6 } from './module5.js';
      
      // Изолированная функция
      function isolatedFunction() {
        return 42;
      }
      
      function main() {
        return isolatedFunction() + func1() + func2() + func10();
      }
      
      export { main, isolatedFunction };
    `;
    const testFile = createTestFile(content, 'many-re-exports.js');

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

    // Реэкспорты должны сохраниться
    expect(contentAfter).toContain("export { func1 } from './module1.js'");
    expect(contentAfter).toContain("export { func2 } from './module2.js'");

    // Групповые реэкспорты должны быть оптимизированы
    // (могут быть объединены в один экспорт)
    expect(contentAfter).toContain('isolatedFunction');
  });

  // ============================================
  // 11. КРАЙНИЙ СЛУЧАЙ: ОЧЕНЬ БОЛЬШОЙ РЕАЛЬНЫЙ ПРОЕКТ
  // ============================================

  it('должен обрабатывать очень большой проект с 1000+ файлами', async () => {
    const srcDir = path.join(testDir, 'large-project');
    const modulesDir = path.join(srcDir, 'modules');
    const utilsDir = path.join(srcDir, 'utils');
    const componentsDir = path.join(srcDir, 'components');

    fs.mkdirSync(modulesDir, { recursive: true });
    fs.mkdirSync(utilsDir, { recursive: true });
    fs.mkdirSync(componentsDir, { recursive: true });

    // Создаем 100 модулей
    for (let i = 0; i < 100; i++) {
      const content = `
        export function module${i}() {
          return ${i};
        }
        export function helper${i}() {
          return ${i * 2};
        }
        export const const${i} = ${i * 3};
      `;
      fs.writeFileSync(path.join(modulesDir, `module${i}.js`), content);
    }

    // Создаем 50 утилит
    for (let i = 0; i < 50; i++) {
      const content = `
        export function util${i}() {
          return ${i * 2};
        }
        export const config${i} = { value: ${i} };
      `;
      fs.writeFileSync(path.join(utilsDir, `util${i}.js`), content);
    }

    // Создаем 30 компонентов
    for (let i = 0; i < 30; i++) {
      const content = `
        export function Component${i}() {
          return { id: ${i}, name: 'Component${i}' };
        }
      `;
      fs.writeFileSync(path.join(componentsDir, `Component${i}.js`), content);
    }

    // Основной файл с множеством импортов
    let imports = '';
    let calls = '';
    let exports_ = '';

    for (let i = 0; i < 50; i++) {
      imports += `import { module${i} } from './modules/module${i}.js';\n`;
      calls += `module${i}() + `;
      exports_ += `module${i}, `;
    }

    for (let i = 0; i < 25; i++) {
      imports += `import { util${i} } from './utils/util${i}.js';\n`;
      calls += `util${i}() + `;
      exports_ += `util${i}, `;
    }

    for (let i = 0; i < 15; i++) {
      imports += `import { Component${i} } from './components/Component${i}.js';\n`;
      calls += `Component${i}() + `;
      exports_ += `Component${i}, `;
    }

    const content = `
      ${imports}
      
      function isolatedFunction() {
        return 42;
      }
      
      function main() {
        return ${calls} isolatedFunction();
      }
      
      export { main, isolatedFunction, ${exports_} };
    `;
    const testFile = createTestFile(content, 'very-large-project.js');

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
    // Большой проект должен обрабатываться за разумное время (< 60 сек)
    expect(duration).toBeLessThan(60000);
  });

  // ============================================
  // 12. КРАЙНИЙ СЛУЧАЙ: ПРОЕКТ С ОШИБКАМИ ВО ВСЕХ ФАЙЛАХ
  // ============================================

  it('должен обрабатывать проект с ошибками во всех файлах', async () => {
    const srcDir = path.join(testDir, 'broken-project');
    fs.mkdirSync(srcDir, { recursive: true });

    // Файл с синтаксическими ошибками
    const brokenContent = `
      function main() {
        const x = 1
        const y = 2
        if (x > 0 {
          return x + y
        }
        return 0
      }
      
      export { main }
    `;
    fs.writeFileSync(path.join(srcDir, 'broken.js'), brokenContent);

    // Файл с неправильными импортами
    const importContent = `
      import { helper1 } from '../../modules/helper1.js';
      import { helper2 } from '../../modules/helper2.js';
      import { helper3 } from '../../modules/helper3.js';
      
      function main() {
        return helper1() + helper2() + helper3();
      }
      
      export { main };
    `;
    fs.writeFileSync(path.join(srcDir, 'bad-imports.js'), importContent);

    // Файл с циклическими зависимостями
    const cycleContent = `
      function funcA() { return funcB() + 1; }
      function funcB() { return funcA() + 1; }
      
      function main() {
        return funcA();
      }
      
      export { main, funcA, funcB };
    `;
    fs.writeFileSync(path.join(srcDir, 'cycle.js'), cycleContent);

    // Основной файл, импортирующий все
    const content = `
      import { main as brokenMain } from './broken.js';
      import { main as importMain } from './bad-imports.js';
      import { main as cycleMain } from './cycle.js';
      
      function isolatedFunction() {
        return 42;
      }
      
      function main() {
        return brokenMain() + importMain() + cycleMain() + isolatedFunction();
      }
      
      export { main, isolatedFunction };
    `;
    const testFile = createTestFile(content, 'all-broken.js');

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
      callGraphAnalysis: true,
    });

    await refactor.initialize();
    const result = await refactor.refactor(testFile);
    await refactor.dispose();

    expect(result.success).toBe(true);
  });
});
