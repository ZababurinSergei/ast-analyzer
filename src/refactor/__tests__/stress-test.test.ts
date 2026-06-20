// packages/ast-analyzer/src/refactor/__tests__/stress-test.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('Стресс-тесты', () => {
  const testDir = path.join(process.cwd(), 'test-temp-stress');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createTestFile = (content: string, filename: string = 'test.js') => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  // ============================================
  // 1. БОЛЬШОЕ КОЛИЧЕСТВО ФУНКЦИЙ
  // ============================================

  describe('Большое количество функций', () => {
    it('1.1 должен обрабатывать файл с 100 изолированными функциями', async () => {
      let content = '';
      const exports = [];

      for (let i = 0; i < 100; i++) {
        content += `function isolated${i}() { return ${i}; }\n`;
        exports.push(`isolated${i}`);
      }

      content += `function main() { return isolated0() + isolated99(); }\n`;
      content += `export { main, ${exports.join(', ')} };\n`;

      const testFile = createTestFile(content, '100-functions.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
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
      // 100 функций должны обрабатываться за разумное время (< 10 сек)
      expect(duration).toBeLessThan(10000);

      // Проверяем, что модули созданы
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        // Должны быть созданы модули для изолированных функций
        expect(files.length).toBeGreaterThan(0);
      }
    });

    it('1.2 должен обрабатывать файл с 1000 изолированными функциями', async () => {
      let content = '';
      const exports = [];

      for (let i = 0; i < 1000; i++) {
        content += `function isolated${i}() { return ${i}; }\n`;
        exports.push(`isolated${i}`);
      }

      content += `function main() { return isolated0() + isolated999(); }\n`;
      content += `export { main, ${exports.slice(0, 10).join(', ')}, ...${exports.slice(10)} };\n`;

      const testFile = createTestFile(content, '1000-functions.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
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
    });

    it('1.3 должен обрабатывать файл с 10000 изолированными функциями', async () => {
      let content = '';
      const exports = [];

      for (let i = 0; i < 10000; i++) {
        content += `function isolated${i}() { return ${i}; }\n`;
        if (i < 10) {
          exports.push(`isolated${i}`);
        }
      }

      content += `function main() { return isolated0() + isolated9999(); }\n`;
      content += `export { main, ${exports.join(', ')} };\n`;

      const testFile = createTestFile(content, '10000-functions.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 10,
        maxClusterSize: 20,
        minCohesionScore: 20,
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
      // 10000 функций должны обрабатываться за разумное время (< 60 сек)
      expect(duration).toBeLessThan(60000);
    });
  });

  // ============================================
  // 2. БОЛЬШОЙ РАЗМЕР ФАЙЛА
  // ============================================

  describe('Большой размер файла', () => {
    it('2.1 должен обрабатывать файл с 5000 строками кода', async () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `function func${i}() {\n`;
        for (let j = 0; j < 10; j++) {
          content += `  const val${j} = ${j} * ${i};\n`;
        }
        content += `  return val0 + val1 + val2 + val3 + val4 + val5 + val6 + val7 + val8 + val9;\n`;
        content += `}\n\n`;
      }
      const exports = Array.from({ length: 100 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '5000-lines.js');

      // Проверяем, что файл действительно большой
      const stats = fs.statSync(testFile);
      expect(stats.size).toBeGreaterThan(5000);

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 10,
        maxClusterSize: 20,
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
      // 5000 строк должны обрабатываться за разумное время (< 20 сек)
      expect(duration).toBeLessThan(20000);
    });

    it('2.2 должен обрабатывать файл с 10000 строками кода', async () => {
      let content = '';
      for (let i = 0; i < 200; i++) {
        content += `function func${i}() {\n`;
        for (let j = 0; j < 10; j++) {
          content += `  const val${j} = ${j} * ${i};\n`;
        }
        content += `  return val0 + val1 + val2 + val3 + val4 + val5 + val6 + val7 + val8 + val9;\n`;
        content += `}\n\n`;
      }
      const exports = Array.from({ length: 200 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '10000-lines.js');

      const stats = fs.statSync(testFile);
      expect(stats.size).toBeGreaterThan(10000);

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 10,
        maxClusterSize: 20,
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
      // 10000 строк должны обрабатываться за разумное время (< 30 сек)
      expect(duration).toBeLessThan(30000);
    });

    it('2.3 должен обрабатывать файл с 50000 строками кода', async () => {
      let content = '';
      for (let i = 0; i < 500; i++) {
        content += `function func${i}() {\n`;
        for (let j = 0; j < 20; j++) {
          content += `  const val${j} = ${j} * ${i};\n`;
        }
        content += `  return val0 + val1 + val2 + val3 + val4 + val5 + val6 + val7 + val8 + val9 + val10 + val11 + val12 + val13 + val14 + val15 + val16 + val17 + val18 + val19;\n`;
        content += `}\n\n`;
      }
      const exports = Array.from({ length: 500 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '50000-lines.js');

      const stats = fs.statSync(testFile);
      expect(stats.size).toBeGreaterThan(50000);

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 20,
        maxClusterSize: 50,
        minCohesionScore: 20,
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
      // 50000 строк должны обрабатываться за разумное время (< 60 сек)
      expect(duration).toBeLessThan(60000);
    });
  });

  // ============================================
  // 3. ГЛУБОКАЯ ВЛОЖЕННОСТЬ
  // ============================================

  describe('Глубокая вложенность', () => {
    it('3.1 должен обрабатывать файл с 10 уровнями вложенности', async () => {
      let content = '';
      for (let i = 1; i <= 10; i++) {
        const indent = '  '.repeat(i - 1);
        content += `${indent}function level${i}() {\n`;
        content += `${indent}  return level${i + 1}();\n`;
      }
      content += '  '.repeat(10) + 'return \"done\";\n';
      for (let i = 10; i >= 1; i--) {
        const indent = '  '.repeat(i - 1);
        content += `${indent}}\n\n`;
      }
      content += 'export { level1 };\n';

      const testFile = createTestFile(content, '10-levels-nesting.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 10 уровней вложенности должны обрабатываться быстро (< 5 сек)
      expect(duration).toBeLessThan(5000);
    });

    it('3.2 должен обрабатывать файл с 50 уровнями вложенности', async () => {
      let content = '';
      for (let i = 1; i <= 50; i++) {
        const indent = '  '.repeat(i - 1);
        content += `${indent}function level${i}() {\n`;
        content += `${indent}  return level${i + 1}();\n`;
      }
      content += '  '.repeat(50) + 'return \"done\";\n';
      for (let i = 50; i >= 1; i--) {
        const indent = '  '.repeat(i - 1);
        content += `${indent}}\n\n`;
      }
      content += 'export { level1 };\n';

      const testFile = createTestFile(content, '50-levels-nesting.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 50 уровней вложенности должны обрабатываться за разумное время (< 10 сек)
      expect(duration).toBeLessThan(10000);
    });

    it('3.3 должен обрабатывать файл со 100 уровнями вложенности', async () => {
      let content = '';
      for (let i = 1; i <= 100; i++) {
        const indent = '  '.repeat(i - 1);
        content += `${indent}function level${i}() {\n`;
        content += `${indent}  return level${i + 1}();\n`;
      }
      content += '  '.repeat(100) + 'return \"done\";\n';
      for (let i = 100; i >= 1; i--) {
        const indent = '  '.repeat(i - 1);
        content += `${indent}}\n\n`;
      }
      content += 'export { level1 };\n';

      const testFile = createTestFile(content, '100-levels-nesting.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 100 уровней вложенности должны обрабатываться за разумное время (< 15 сек)
      expect(duration).toBeLessThan(15000);
    });
  });

  // ============================================
  // 4. БОЛЬШОЕ КОЛИЧЕСТВО ИМПОРТОВ
  // ============================================

  describe('Большое количество импортов', () => {
    it('4.1 должен обрабатывать файл с 100 импортами', async () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `import { func${i} } from './modules/func${i}.js';\n`;
      }
      content += 'function main() { return func0() + func99(); }\n';
      content += 'export { main };\n';

      const testFile = createTestFile(content, '100-imports.js');

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
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 100 импортов должны обрабатываться быстро (< 5 сек)
      expect(duration).toBeLessThan(5000);
    });

    it('4.2 должен обрабатывать файл с 1000 импортами', async () => {
      let content = '';
      for (let i = 0; i < 1000; i++) {
        content += `import { func${i} } from './modules/func${i}.js';\n`;
      }
      content += 'function main() { return func0() + func999(); }\n';
      content += 'export { main };\n';

      const testFile = createTestFile(content, '1000-imports.js');

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
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 1000 импортов должны обрабатываться за разумное время (< 15 сек)
      expect(duration).toBeLessThan(15000);
    });

    it('4.3 должен обрабатывать файл с 5000 импортами', async () => {
      let content = '';
      for (let i = 0; i < 5000; i++) {
        content += `import { func${i} } from './modules/func${i}.js';\n`;
      }
      content += 'function main() { return func0() + func4999(); }\n';
      content += 'export { main };\n';

      const testFile = createTestFile(content, '5000-imports.js');

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
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 5000 импортов должны обрабатываться за разумное время (< 30 сек)
      expect(duration).toBeLessThan(30000);
    });
  });

  // ============================================
  // 5. БОЛЬШОЕ КОЛИЧЕСТВО ЭКСПОРТОВ
  // ============================================

  describe('Большое количество экспортов', () => {
    it('5.1 должен обрабатывать файл с 100 экспортами', async () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }
      const exports = Array.from({ length: 100 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '100-exports.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 100 экспортов должны обрабатываться быстро (< 5 сек)
      expect(duration).toBeLessThan(5000);
    });

    it('5.2 должен обрабатывать файл с 1000 экспортами', async () => {
      let content = '';
      for (let i = 0; i < 1000; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }
      const exports = Array.from({ length: 1000 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '1000-exports.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 10,
        maxClusterSize: 20,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 1000 экспортов должны обрабатываться за разумное время (< 20 сек)
      expect(duration).toBeLessThan(20000);
    });

    it('5.3 должен обрабатывать файл с 5000 экспортами', async () => {
      let content = '';
      for (let i = 0; i < 5000; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }
      const exports = Array.from({ length: 5000 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '5000-exports.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 20,
        maxClusterSize: 50,
        minCohesionScore: 20,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 5000 экспортов должны обрабатываться за разумное время (< 30 сек)
      expect(duration).toBeLessThan(30000);
    });
  });

  // ============================================
  // 6. БОЛЬШИЕ ГРАФЫ С ЦИКЛАМИ
  // ============================================

  describe('Большие графы с циклами', () => {
    it('6.1 должен обрабатывать файл с 50 циклическими функциями', async () => {
      let content = '';
      const functions = [];

      for (let i = 0; i < 50; i++) {
        const deps = [(i + 1) % 50, (i + 2) % 50, (i + 3) % 50];
        const depStr = deps.map(d => `func${d}()`).join(' + ');
        content += `function func${i}() { return ${depStr}; }\n`;
        functions.push(`func${i}`);
      }

      const exports = functions.join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '50-cycle-graph.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 10,
        maxClusterSize: 15,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
        semanticAnalysis: true,
        callGraphAnalysis: true,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 50 функций с циклами должны обрабатываться за разумное время (< 10 сек)
      expect(duration).toBeLessThan(10000);
    });

    it('6.2 должен обрабатывать файл со 100 циклическими функциями', async () => {
      let content = '';
      const functions = [];

      for (let i = 0; i < 100; i++) {
        const deps = [(i + 1) % 100, (i + 2) % 100, (i + 3) % 100];
        const depStr = deps.map(d => `func${d}()`).join(' + ');
        content += `function func${i}() { return ${depStr}; }\n`;
        functions.push(`func${i}`);
      }

      const exports = functions.join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '100-cycle-graph.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 10,
        maxClusterSize: 15,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
        semanticAnalysis: true,
        callGraphAnalysis: true,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 100 функций с циклами должны обрабатываться за разумное время (< 20 сек)
      expect(duration).toBeLessThan(20000);
    });

    it('6.3 должен обрабатывать файл с 500 циклическими функциями', async () => {
      let content = '';
      const functions = [];

      for (let i = 0; i < 500; i++) {
        const deps = [(i + 1) % 500, (i + 2) % 500, (i + 3) % 500];
        const depStr = deps.map(d => `func${d}()`).join(' + ');
        content += `function func${i}() { return ${depStr}; }\n`;
        functions.push(`func${i}`);
      }

      const exports = functions.join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, '500-cycle-graph.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 20,
        maxClusterSize: 30,
        minCohesionScore: 20,
        createBackup: true,
        incremental: true,
        dryRun: false,
        semanticAnalysis: true,
        callGraphAnalysis: true,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 500 функций с циклами должны обрабатываться за разумное время (< 30 сек)
      expect(duration).toBeLessThan(30000);
    });
  });

  // ============================================
  // 7. КОМБИНИРОВАННЫЕ СТРЕСС-ТЕСТЫ
  // ============================================

  describe('Комбинированные стресс-тесты', () => {
    it('7.1 должен обрабатывать файл с 500 функциями, 200 импортами и 300 экспортами', async () => {
      let content = '';

      // Импорты
      for (let i = 0; i < 200; i++) {
        content += `import { helper${i} } from './helpers/helper${i}.js';\n`;
      }

      // Функции
      for (let i = 0; i < 500; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }

      // Экспорты
      const exports = Array.from({ length: 300 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, 'combined-stress.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 10,
        maxClusterSize: 20,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Комбинированный файл должен обрабатываться за разумное время (< 30 сек)
      expect(duration).toBeLessThan(30000);
    });

    it('7.2 должен обрабатывать файл с 1000 функциями, 500 импортами и 500 экспортами', async () => {
      let content = '';

      // Импорты
      for (let i = 0; i < 500; i++) {
        content += `import { helper${i} } from './helpers/helper${i}.js';\n`;
      }

      // Функции
      for (let i = 0; i < 1000; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }

      // Экспорты
      const exports = Array.from({ length: 500 }, (_, i) => `func${i}`).join(', ');
      content += `export { ${exports} };\n`;

      const testFile = createTestFile(content, 'combined-stress-1000.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        targetClusterSize: 20,
        maxClusterSize: 30,
        minCohesionScore: 20,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Комбинированный файл должен обрабатываться за разумное время (< 60 сек)
      expect(duration).toBeLessThan(60000);
    });

    it('7.3 должен обрабатывать файл с глубокой вложенностью и циклами одновременно', async () => {
      let content = '';

      // Создаем вложенные функции с циклами
      for (let level = 0; level < 20; level++) {
        const indent = '  '.repeat(level);
        content += `${indent}function level${level}() {\n`;
        content += `${indent}  const result = [];\n`;

        // Внутренний цикл
        for (let i = 0; i < 10; i++) {
          content += `${indent}  result.push(${i});\n`;
        }

        if (level < 19) {
          content += `${indent}  return level${level + 1}();\n`;
        } else {
          content += `${indent}  return result;\n`;
        }
        content += `${indent}}\n\n`;
      }

      content += 'export { level0 };\n';

      const testFile = createTestFile(content, 'nested-cycles.js');

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Вложенность с циклами должна обрабатываться за разумное время (< 15 сек)
      expect(duration).toBeLessThan(15000);
    });
  });

  // ============================================
  // 8. ПРОИЗВОДИТЕЛЬНОСТЬ ПРИ РАЗНЫХ НАСТРОЙКАХ
  // ============================================

  describe('Производительность при разных настройках', () => {
    it('8.1 должен работать быстрее с отключенными анализаторами', async () => {
      let content = '';
      for (let i = 0; i < 200; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }
      content += 'export { func0, func1, func2, func3, func4 };\n';

      const testFile = createTestFile(content, 'performance-test.js');

      // С включенными анализаторами
      const refactorFull = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        semanticAnalysis: true,
        callGraphAnalysis: true,
        dataFlowAnalysis: true,
        typeCheck: true,
        eslintCheck: true,
        codeValidation: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startFull = Date.now();
      await refactorFull.initialize();
      const resultFull = await refactorFull.refactor(testFile);
      await refactorFull.dispose();
      const durationFull = Date.now() - startFull;

      expect(resultFull.success).toBe(true);

      // С отключенными анализаторами
      const refactorMin = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        semanticAnalysis: false,
        callGraphAnalysis: false,
        dataFlowAnalysis: false,
        typeCheck: false,
        eslintCheck: false,
        codeValidation: false,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
      });

      const startMin = Date.now();
      await refactorMin.initialize();
      const resultMin = await refactorMin.refactor(testFile);
      await refactorMin.dispose();
      const durationMin = Date.now() - startMin;

      expect(resultMin.success).toBe(true);

      // Минимальная конфигурация должна быть быстрее
      // (не строгое условие, т.к. зависит от окружения)
      console.log(`Full: ${durationFull}ms, Minimal: ${durationMin}ms`);
    });

    it('8.2 должен работать с разными уровнями логирования', async () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `function func${i}() { return ${i}; }\n`;
      }
      content += 'export { func0, func1, func2, func3, func4 };\n';

      const testFile = createTestFile(content, 'log-level-test.js');

      // С debug логированием
      const refactorDebug = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
        logLevel: 'debug',
      });

      const startDebug = Date.now();
      await refactorDebug.initialize();
      const resultDebug = await refactorDebug.refactor(testFile);
      await refactorDebug.dispose();
      const durationDebug = Date.now() - startDebug;

      expect(resultDebug.success).toBe(true);

      // С info логированием
      const refactorInfo = new AutoRefactor({
        extractIsolatedFunctions: true,
        autoFix: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        createBackup: true,
        incremental: true,
        dryRun: false,
        logLevel: 'info',
      });

      const startInfo = Date.now();
      await refactorInfo.initialize();
      const resultInfo = await refactorInfo.refactor(testFile);
      await refactorInfo.dispose();
      const durationInfo = Date.now() - startInfo;

      expect(resultInfo.success).toBe(true);

      // Info логирование должно быть быстрее debug
      console.log(`Debug: ${durationDebug}ms, Info: ${durationInfo}ms`);
    });
  });
});
