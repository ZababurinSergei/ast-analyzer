// packages/ast-analyzer/src/refactor/__tests__/auto-fix-edge.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('--auto-fix: КРАЕВЫЕ СЛУЧАИ', () => {
  const testDir = path.join(process.cwd(), 'test-temp-auto-fix-edge');

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
  // 1. ЭКЗОТИЧЕСКИЕ ИМПОРТЫ
  // ============================================

  describe('Экзотические импорты', () => {
    it('1.1 должен исправлять импорты с вложенными путями и спецсимволами', async () => {
      const content = `
        import { helper } from '../../modules/helper/index.js';
        import { utils } from '../utils/index.js';
        import { config } from './config.json';
        import { data } from './data.yaml';
        function main() {
          return helper() + utils() + config.api + data.value;
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'special-paths.js');

      const refactor = new AutoRefactor({
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
      // Пути должны быть исправлены
      expect(contentAfter).not.toContain('../../modules/helper/index.js');
      expect(contentAfter).not.toContain('../utils/index.js');
    });

    it('1.2 должен исправлять импорты с пробелами и кавычками разных типов', async () => {
      const content = `
        import { helper1 } from  './helper1.js' ;
        import { helper2 } from "./helper2.js" ;
        import { helper3 } from \`./helper3.js\` ;
        function main() {
          return helper1() + helper2() + helper3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'whitespace-quotes.js');

      const refactor = new AutoRefactor({
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
      // Должна быть единообразная структура
      expect(contentAfter).toMatch(/import\s*{\s*helper1\s*}\s*from\s*['"]\.\/helper1\.js['"]/);
      expect(contentAfter).toMatch(/import\s*{\s*helper2\s*}\s*from\s*['"]\.\/helper2\.js['"]/);
      expect(contentAfter).toMatch(/import\s*{\s*helper3\s*}\s*from\s*['"]\.\/helper3\.js['"]/);
    });

    it('1.3 должен исправлять импорты с комментариями внутри', async () => {
      const content = `
        import { helper1 } // comment
          from './helper1.js';
        import { helper2 } /* comment */ from './helper2.js';
        import { helper3 } from /* comment */ './helper3.js';
        function main() {
          return helper1() + helper2() + helper3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'import-comments.js');

      const refactor = new AutoRefactor({
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

      // Комментарии должны сохраниться или быть удалены
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Импорты должны быть валидными
      expect(contentAfter).toContain("import { helper1 } from './helper1.js'");
      expect(contentAfter).toContain("import { helper2 } from './helper2.js'");
      expect(contentAfter).toContain("import { helper3 } from './helper3.js'");
    });

    it('1.4 должен исправлять импорты с несколькими комментариями', async () => {
      const content = `
        // Comment before import
        import { helper1 } // inline comment
          from './helper1.js'; // trailing comment
        /* Block comment */
        import { helper2 } /* inline block */ from './helper2.js'; /* trailing block */
        function main() {
          return helper1() + helper2();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'multiple-comments.js');

      const refactor = new AutoRefactor({
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
      // Импорты должны быть валидными
      expect(contentAfter).toContain("import { helper1 } from './helper1.js'");
      expect(contentAfter).toContain("import { helper2 } from './helper2.js'");
    });
  });

  // ============================================
  // 2. ЭКЗОТИЧЕСКИЕ ЭКСПОРТЫ
  // ============================================

  describe('Экзотические экспорты', () => {
    it('2.1 должен исправлять экспорты с комментариями', async () => {
      const content = `
        function main() { return 42; }
        // export comment
        export { main };
        /* export comment */
        export { main as main2 };
        export // comment
          { main as main3 };
        export { main as main4 } // comment
        ;
      `;
      const testFile = createTestFile(content, 'export-comments.js');

      const refactor = new AutoRefactor({
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

      // Экспорты должны быть валидными
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('export { main }');
      expect(contentAfter).toContain('export { main as main2 }');
      expect(contentAfter).toContain('export { main as main3 }');
      expect(contentAfter).toContain('export { main as main4 }');
    });

    it('2.2 должен исправлять экспорты с пробелами и переносами', async () => {
      const content = `
        function func1() { return 1; }
        function func2() { return 2; }
        function func3() { return 3; }
        export
          { func1,
            func2,
            func3
          };
      `;
      const testFile = createTestFile(content, 'export-whitespace.js');

      const refactor = new AutoRefactor({
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

      // Экспорт должен быть валидным
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('export { func1, func2, func3 }');
    });

    it('2.3 должен исправлять экспорты с множественными переносами', async () => {
      const content = `
        function func1() { return 1; }
        function func2() { return 2; }
        function func3() { return 3; }
        function func4() { return 4; }
        function func5() { return 5; }
        
        export {
          func1,
          func2,
          func3,
          func4,
          func5
        };
      `;
      const testFile = createTestFile(content, 'export-multiple-lines.js');

      const refactor = new AutoRefactor({
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
      expect(contentAfter).toContain('export { func1, func2, func3, func4, func5 }');
    });
  });

  // ============================================
  // 3. ЭКЗОТИЧЕСКИЕ СИНТАКСИЧЕСКИЕ ОШИБКИ
  // ============================================

  describe('Экзотические синтаксические ошибки', () => {
    it('3.1 должен исправлять отсутствующие запятые в объектах', async () => {
      const content = `
        const config = {
          api: 'https://api.example.com'
          timeout: 5000
          retries: 3
        };
        function main() {
          return config;
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'missing-commas.js');

      const refactor = new AutoRefactor({
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
      // Запятые должны быть добавлены
      expect(contentAfter).toContain("api: 'https://api.example.com',");
      expect(contentAfter).toContain('timeout: 5000,');
      expect(contentAfter).toContain('retries: 3');
    });

    it('3.2 должен исправлять отсутствующие запятые в массивах', async () => {
      const content = `
        const numbers = [
          1
          2
          3
        ];
        function main() {
          return numbers;
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'missing-array-commas.js');

      const refactor = new AutoRefactor({
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
      // Запятые должны быть добавлены
      expect(contentAfter).toContain('1,');
      expect(contentAfter).toContain('2,');
      expect(contentAfter).toContain('3');
    });

    it('3.3 должен исправлять неправильные операторы сравнения', async () => {
      const content = `
        function main(x) {
          if (x = 0) {
            return 'zero';
          }
          if (x == 1) {
            return 'one';
          }
          if (x != 2) {
            return 'not two';
          }
          return 'unknown';
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'wrong-operators.js');

      const refactor = new AutoRefactor({
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
      // Операторы должны быть исправлены
      expect(contentAfter).toContain('if (x === 0)');
      expect(contentAfter).toContain('if (x === 1)');
      expect(contentAfter).toContain('if (x !== 2)');
    });

    it('3.4 должен исправлять пропущенные фигурные скобки', async () => {
      const content = `
        function main(x) {
          if (x > 0)
            return 'positive';
          else
            return 'non-positive';
          return 'done';
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'missing-braces.js');

      const refactor = new AutoRefactor({
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
      // Фигурные скобки должны быть добавлены
      expect(contentAfter).toContain('if (x > 0) {');
      expect(contentAfter).toContain('} else {');
    });

    it('3.5 должен исправлять пропущенные точки с запятой в циклах', async () => {
      const content = `
        function main() {
          for (let i = 0; i < 10; i++) {
            console.log(i)
          }
          let j = 0
          while (j < 10) {
            console.log(j)
            j++
          }
          return 'done'
        }
        export { main }
      `;
      const testFile = createTestFile(content, 'missing-semicolons-loops.js');

      const refactor = new AutoRefactor({
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
      // Точки с запятой должны быть добавлены
      expect(contentAfter).toMatch(/console\.log\(i\);/);
      expect(contentAfter).toMatch(/let j = 0;/);
      expect(contentAfter).toMatch(/console\.log\(j\);/);
      expect(contentAfter).toMatch(/j\+\+;/);
      expect(contentAfter).toMatch(/return 'done';/);
      expect(contentAfter).toMatch(/export { main };/);
    });
  });

  // ============================================
  // 4. КРАЕВЫЕ СЛУЧАИ С РАЗМЕРОМ ФАЙЛОВ
  // ============================================

  describe('Краевые случаи с размером файлов', () => {
    it('4.1 должен обрабатывать очень большой файл с 10000 строк', async () => {
      let content = '';
      for (let i = 0; i < 10000; i++) {
        content += `// Line ${i}\n`;
      }
      content += 'function main() { return 42; }\n';
      content += 'export { main };\n';

      const testFile = createTestFile(content, 'huge-file.js');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 10000 строк должны обрабатываться за разумное время (< 20 сек)
      expect(duration).toBeLessThan(20000);
    });

    it('4.2 должен обрабатывать очень маленький файл (1 строка)', async () => {
      const content = 'export const main = () => 42;\n';
      const testFile = createTestFile(content, 'tiny-file.js');

      const refactor = new AutoRefactor({
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
    });

    it('4.3 должен обрабатывать файл с очень длинными строками (>1000 символов)', async () => {
      const longString = 'a'.repeat(2000);
      const content = `
        const longString = '${longString}';
        function main() {
          return longString;
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'long-lines.js');

      const refactor = new AutoRefactor({
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
    });

    it('4.4 должен обрабатывать файл с большим количеством пустых строк', async () => {
      let content = '';
      for (let i = 0; i < 1000; i++) {
        content += '\n';
      }
      content += 'function main() { return 42; }\n';
      content += 'export { main };\n';

      const testFile = createTestFile(content, 'empty-lines.js');

      const refactor = new AutoRefactor({
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
    });
  });

  // ============================================
  // 5. КРАЕВЫЕ СЛУЧАИ С КОДИРОВКОЙ
  // ============================================

  describe('Краевые случаи с кодировкой', () => {
    it('5.1 должен обрабатывать файлы с Unicode символами', async () => {
      const content = `
        // Привет мир! 🌍
        function こんにちは() {
          return 'Hello';
        }
        function main() {
          return こんにちは();
        }
        export { main, こんにちは };
      `;
      const testFile = createTestFile(content, 'unicode-functions.js');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        maxClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Unicode имена должны сохраниться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('function こんにちは');
      expect(contentAfter).toContain('export { main, こんにちは }');
    });

    it('5.2 должен обрабатывать файлы с эмодзи в комментариях и строках', async () => {
      const content = `
        // 🚀 Это функция с эмодзи
        function main() {
          // 👋 Привет мир
          return 'Hello 🌍 World!';
        }
        // 📦 Экспортируем функцию
        export { main };
      `;
      const testFile = createTestFile(content, 'emoji.js');

      const refactor = new AutoRefactor({
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

      // Эмодзи должны сохраниться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('🚀');
      expect(contentAfter).toContain('👋');
      expect(contentAfter).toContain('🌍');
    });

    it('5.3 должен обрабатывать файлы с BOM (Byte Order Mark)', async () => {
      const content = '\uFEFFexport const main = () => 42;\n';
      const testFile = createTestFile(content, 'bom-file.js');

      // Записываем с BOM
      fs.writeFileSync(testFile, content, { encoding: 'utf-8' });

      const refactor = new AutoRefactor({
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
    });

    it('5.4 должен обрабатывать файлы с разными кодировками (UTF-8, UTF-16)', async () => {
      const content = 'export const main = () => 42;\n';
      const testFile = createTestFile(content, 'utf16-file.js');

      // Записываем в UTF-16
      fs.writeFileSync(testFile, content, { encoding: 'utf16le' });

      const refactor = new AutoRefactor({
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
    });
  });

  // ============================================
  // 6. КРАЕВЫЕ СЛУЧАИ С ВРЕМЕННЫМИ ФАЙЛАМИ
  // ============================================

  describe('Краевые случаи с временными файлами', () => {
    it('6.1 должен обрабатывать файлы с временными суффиксами', async () => {
      const content = `
        function main() { return 42; }
        export { main };
      `;
      const testFile = createTestFile(content, 'file.tmp.js');

      const refactor = new AutoRefactor({
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
    });

    it('6.2 должен обрабатывать файлы с нестандартными расширениями', async () => {
      const content = `
        function main() { return 42; }
        export { main };
      `;
      const testFile = createTestFile(content, 'file.custom');

      const refactor = new AutoRefactor({
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
    });

    it('6.3 должен обрабатывать файлы с точками в имени', async () => {
      const content = `
        function main() { return 42; }
        export { main };
      `;
      const testFile = createTestFile(content, 'file.with.dots.js');

      const refactor = new AutoRefactor({
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
    });
  });

  // ============================================
  // 7. КРАЕВЫЕ СЛУЧАИ С СИМВОЛАМИ
  // ============================================

  describe('Краевые случаи с символами', () => {
    it('7.1 должен обрабатывать файлы с нулевыми символами', async () => {
      const content = 'export const main = () => 42;\0\n';
      const testFile = createTestFile(content, 'null-char.js');

      const refactor = new AutoRefactor({
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
    });

    it('7.2 должен обрабатывать файлы с управляющими символами', async () => {
      const content = 'export const main = () => 42;\x01\x02\x03\n';
      const testFile = createTestFile(content, 'control-chars.js');

      const refactor = new AutoRefactor({
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
    });
  });

  // ============================================
  // 8. КРАЕВЫЕ СЛУЧАИ С ПУТЯМИ
  // ============================================

  describe('Краевые случаи с путями', () => {
    it('8.1 должен обрабатывать файлы с очень глубокими путями', async () => {
      const deepPath = Array(20).fill('deep').join('/');
      const content = `
        import { helper } from './${deepPath}/helper.js';
        function main() {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'deep-path.js');

      const refactor = new AutoRefactor({
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
    });

    it('8.2 должен обрабатывать файлы с путями, содержащими пробелы', async () => {
      const content = `
        import { helper } from './my helper/helper.js';
        import { utils } from './my utils/utils.js';
        function main() {
          return helper() + utils();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'paths-with-spaces.js');

      const refactor = new AutoRefactor({
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
      // Пути с пробелами должны быть экранированы или исправлены
      expect(contentAfter).toContain("'./my helper/helper.js'");
      expect(contentAfter).toContain("'./my utils/utils.js'");
    });

    it('8.3 должен обрабатывать файлы с путями, содержащими специальные символы', async () => {
      const content = `
        import { helper } from './my@helper/helper.js';
        import { utils } from './my#utils/utils.js';
        import { config } from './my$config/config.js';
        function main() {
          return helper() + utils() + config();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'paths-special-chars.js');

      const refactor = new AutoRefactor({
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
      // Специальные символы должны сохраниться
      expect(contentAfter).toContain("'./my@helper/helper.js'");
      expect(contentAfter).toContain("'./my#utils/utils.js'");
      expect(contentAfter).toContain("'./my$config/config.js'");
    });
  });

  // ============================================
  // 9. КРАЕВЫЕ СЛУЧАИ С МНОЖЕСТВЕННЫМИ ПРОБЛЕМАМИ
  // ============================================

  describe('Краевые случаи с множественными проблемами', () => {
    it('9.1 должен исправлять файл со всеми типами проблем одновременно', async () => {
      const content = `
        // Проблема 1: Неправильные пути
        import { helper1 } from '../../modules/helper1.js';
        import { helper2 } from '../../modules/helper2.js';
        import { helper3 } from '../../modules/helper3.js';
        
        // Проблема 2: Неиспользуемые импорты
        import { unused1 } from './unused1.js';
        import { unused2 } from './unused2.js';
        
        // Проблема 3: Пустые импорты
        import './empty-module.js';
        
        // Проблема 4: Синтаксические ошибки
        function main() {
          const x = 1
          const y = 2
          if (x > 0 {
            return helper1() + helper2() + helper3()
          }
          return 0
        }
        
        // Проблема 5: Пропущенная точка с запятой в экспорте
        export { main }
      `;
      const testFile = createTestFile(content, 'all-problems.js');

      const refactor = new AutoRefactor({
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

      // Все проблемы должны быть исправлены
      // 1. Пути исправлены
      expect(contentAfter).not.toContain('../../modules/');

      // 2. Импорты сгруппированы
      expect(contentAfter).toContain('import { helper1, helper2, helper3 } from');

      // 3. Неиспользуемые импорты удалены
      expect(contentAfter).not.toContain('unused1');
      expect(contentAfter).not.toContain('unused2');

      // 4. Пустой импорт удален
      expect(contentAfter).not.toContain("import './empty-module.js'");

      // 5. Синтаксис исправлен
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);

      // 6. Точка с запятой в экспорте добавлена
      expect(contentAfter).toMatch(/export { main };/);
    });

    it('9.2 должен исправлять файл с вложенными проблемами', async () => {
      const content = `
        import { helper1 } from '../../modules/helper1.js';
        import { helper2 } from '../../modules/helper1.js';
        import { helper3 } from '../../modules/helper1.js';
        
        function processData(data) {
          const result = []
          for (let i = 0; i < data.length; i++) {
            if (data[i] > 0) {
              result.push(data[i] * 2)
            }
          }
          return result
        }
        
        function main() {
          const data = [1, 2, 3]
          const processed = processData(data)
          return helper1() + helper2() + helper3() + processed.length
        }
        
        export { main, processData }
      `;
      const testFile = createTestFile(content, 'nested-problems.js');

      const refactor = new AutoRefactor({
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

      // 1. Импорты сгруппированы
      expect(contentAfter).toContain('import { helper1, helper2, helper3 } from');

      // 2. Пути исправлены
      expect(contentAfter).not.toContain('../../modules/');

      // 3. Синтаксис исправлен (точки с запятой)
      expect(contentAfter).toMatch(/const result = \[\]/);
      expect(contentAfter).toMatch(/result\.push\(data\[i\] \* 2\);/);
      expect(contentAfter).toMatch(/return result;/);
      expect(contentAfter).toMatch(/export { main, processData };/);
    });
  });
});
