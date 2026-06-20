// packages/ast-analyzer/src/refactor/__tests__/auto-fix.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('--auto-fix: Автоматическое исправление проблем', () => {
  const testDir = path.join(process.cwd(), 'test-temp-auto-fix');

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
  // 1. ИСПРАВЛЕНИЕ ИМПОРТОВ
  // ============================================

  describe('Исправление импортов', () => {
    it('1.1 должен исправлять неправильные пути импортов', async () => {
      const content = `
        import { helper1 } from '../../modules/helper.js';
        import { helper2 } from '../../../utils/helper.js';
        function main() {
          return helper1() + helper2();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-paths.js');

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
      expect(contentAfter).not.toContain('../../modules/');
      expect(contentAfter).not.toContain('../../../utils/');
      // Должны быть правильные относительные пути
      expect(contentAfter).toMatch(
        /import\s*{\s*helper1\s*}\s*from\s*['"]\.\/modules\/helper\.js['"]/
      );
    });

    it('1.2 должен группировать импорты из одного модуля', async () => {
      const content = `
        import { func1 } from './module.js';
        import { func2 } from './module.js';
        import { func3 } from './module.js';
        function main() {
          return func1() + func2() + func3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'group-imports.js');

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
      // Должен быть один импорт вместо трех
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBe(1);
      expect(contentAfter).toContain('import { func1, func2, func3 } from');
    });

    it('1.3 должен удалять неиспользуемые импорты', async () => {
      const content = `
        import { used } from './used.js';
        import { unused1 } from './unused1.js';
        import { unused2 } from './unused2.js';
        function main() {
          return used();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'remove-unused.js');

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
      expect(contentAfter).toContain("import { used } from './used.js'");
      expect(contentAfter).not.toContain("import { unused1 } from './unused1.js'");
      expect(contentAfter).not.toContain("import { unused2 } from './unused2.js'");
    });

    it('1.4 должен исправлять импорты с разными кавычками', async () => {
      const content = `
        import { helper1 } from "./helper1.js";
        import { helper2 } from './helper2.js';
        import { helper3 } from \`./helper3.js\`;
        function main() {
          return helper1() + helper2() + helper3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-quotes.js');

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
      // Все кавычки должны быть единообразными
      expect(contentAfter).toMatch(/import\s*{\s*helper1\s*}\s*from\s*['"]\.\/helper1\.js['"]/);
      expect(contentAfter).toMatch(/import\s*{\s*helper2\s*}\s*from\s*['"]\.\/helper2\.js['"]/);
      expect(contentAfter).toMatch(/import\s*{\s*helper3\s*}\s*from\s*['"]\.\/helper3\.js['"]/);
    });

    it('1.5 должен исправлять дублирующиеся модули', async () => {
      const content = `
        import { parseFile } from '../../modules/file-system-json.mjs';
        import { writeFile } from '../../modules/file-system-json.mjs';
        import { readFile } from '../../modules/file-system-json.mjs';
        function main() {
          return parseFile() + writeFile() + readFile();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-duplicate-modules.js');

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
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBe(1);
      expect(contentAfter).toContain('import { parseFile, writeFile, readFile } from');
      expect(contentAfter).not.toContain('../../modules/');
    });

    it('1.6 должен исправлять импорты с алиасами', async () => {
      const content = `
        import { helper as h } from './helper.js';
        import { format as f } from './format.js';
        function main() {
          return h() + f();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-aliases.js');

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
      expect(contentAfter).toContain('import { helper as h } from');
      expect(contentAfter).toContain('import { format as f } from');
    });
  });

  // ============================================
  // 2. ИСПРАВЛЕНИЕ ПУТЕЙ
  // ============================================

  describe('Исправление путей', () => {
    it('2.1 должен исправлять пути с глубокой вложенностью', async () => {
      const content = `
        import { helper } from '../../../deep/helper.js';
        import { config } from '../../config.js';
        function main() {
          return helper() + config();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-deep-paths.js');

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
      expect(contentAfter).not.toContain('../../../deep/');
      expect(contentAfter).not.toContain('../../config.js');
    });

    it('2.2 должен исправлять пути с неправильным расширением', async () => {
      const content = `
        import { helper } from './helper';
        import { format } from './format.ts';
        function main() {
          return helper() + format();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-extensions.js');

      fs.writeFileSync(path.join(testDir, 'helper.js'), 'export const helper = () => 1;');
      fs.writeFileSync(path.join(testDir, 'format.ts'), 'export const format = () => 2;');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain("import { helper } from './helper.js'");
    });
  });

  // ============================================
  // 3. ИСПРАВЛЕНИЕ ДУБЛИРУЮЩИХСЯ МОДУЛЕЙ
  // ============================================

  describe('Исправление дублирующихся модулей', () => {
    it('3.1 должен удалять дублирующиеся модули', async () => {
      const content = `
        import { func1 } from './module.js';
        import { func2 } from './module.js';
        import { func3 } from './module.js';
        import { func4 } from './module.js';
        function main() {
          return func1() + func2() + func3() + func4();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-duplicates.js');

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
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBe(1);
      expect(contentAfter).toContain('import { func1, func2, func3, func4 } from');
    });

    it('3.2 должен исправлять дублирующиеся модули с разными алиасами', async () => {
      const content = `
        import { helper as h } from './module.js';
        import { helper as h2 } from './module.js';
        import { helper as h3 } from './module.js';
        function main() {
          return h() + h2() + h3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-duplicate-aliases.js');

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
      expect(contentAfter).toContain('import { helper as h, helper as h2, helper as h3 } from');
    });
  });

  // ============================================
  // 4. ИСПРАВЛЕНИЕ МОДУЛЕЙ С 0 ЭКСПОРТОВ
  // ============================================

  describe('Исправление модулей с 0 экспортов', () => {
    it('4.1 должен удалять импорты пустых модулей', async () => {
      const content = `
        import './empty-module.js';
        import { helper } from './helper.js';
        function main() {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-empty-imports.js');

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
      expect(contentAfter).not.toContain("import './empty-module.js'");
      expect(contentAfter).toContain("import { helper } from './helper.js'");
    });
  });

  // ============================================
  // 5. ИСПРАВЛЕНИЕ КОНФЛИКТУЮЩИХ ИМПОРТОВ
  // ============================================

  describe('Исправление конфликтующих импортов', () => {
    it('5.1 должен исправлять конфликты имен в импортах', async () => {
      const content = `
        import { process } from './module-a.js';
        import { process as processB } from './module-b.js';
        function main() {
          return process() + processB();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-import-conflicts.js');

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
      expect(contentAfter).toContain("import { process } from './module-a.js'");
      expect(contentAfter).toContain("import { process as processB } from './module-b.js'");
    });

    it('5.2 должен исправлять конфликты default импортов', async () => {
      const content = `
        import defaultExport from './module-a.js';
        import defaultExport as defaultB from './module-b.js';
        function main() {
          return defaultExport() + defaultB();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-default-conflicts.js');

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
      expect(contentAfter).toContain("import defaultExport from './module-a.js'");
      expect(contentAfter).toContain("import defaultExport as defaultB from './module-b.js'");
    });
  });

  // ============================================
  // 6. ИСПРАВЛЕНИЕ СИНТАКСИЧЕСКИХ ОШИБОК
  // ============================================

  describe('Исправление синтаксических ошибок', () => {
    it('6.1 должен исправлять отсутствующие точки с запятой', async () => {
      const content = `
        function main() {
          const x = 1
          const y = 2
          return x + y
        }
        export { main }
      `;
      const testFile = createTestFile(content, 'fix-semicolons.js');

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
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/return x \+ y;/);
      expect(contentAfter).toMatch(/export { main };/);
    });

    it('6.2 должен исправлять пропущенные скобки', async () => {
      const content = `
        function main() {
          if (x > 0 {
            return x;
          }
          return 0;
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-brackets.js');

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
      expect(contentAfter).toContain('if (x > 0) {');
    });
  });

  // ============================================
  // 7. СЦЕНАРИИ С ФЛАГОМ --auto-fix=false
  // ============================================

  describe('С флагом --auto-fix=false', () => {
    it('7.1 не должен исправлять проблемы', async () => {
      const content = `
        import { used } from './used.js';
        import { unused } from './unused.js';
        function main() {
          return used();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'no-auto-fix.js');

      const refactor = new AutoRefactor({
        autoFix: false,
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
      expect(contentAfter).toContain("import { unused } from './unused.js'");
    });

    it('7.2 должен только выявлять проблемы, но не исправлять их', async () => {
      const content = `
        import { helper1 } from './module.js';
        import { helper2 } from './module.js';
        import { helper3 } from './module.js';
        function main() {
          return helper1() + helper2();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'no-auto-fix-identify.js');

      const refactor = new AutoRefactor({
        autoFix: false,
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
      expect(contentAfter).toContain('helper3');
    });
  });

  // ============================================
  // 8. КОМПЛЕКСНЫЕ СЦЕНАРИИ
  // ============================================

  describe('Комплексные сценарии', () => {
    it('8.1 должен исправлять все проблемы одновременно', async () => {
      const content = `
        import { parseFile } from '../../modules/file-system-json.mjs';
        import { writeFile } from '../../modules/file-system-json.mjs';
        import { readFile } from '../../modules/file-system-json.mjs';
        import { unusedHelper } from './unused.js';
        import './empty-module.js';
        function main() {
          return parseFile() + writeFile() + readFile();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-all.js');

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
      expect(contentAfter).not.toContain('../../modules/');
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBe(1);
      expect(contentAfter).not.toContain('unusedHelper');
      expect(contentAfter).not.toContain("import './empty-module.js'");
    });

    it('8.2 должен исправлять проблемы в TypeScript файлах', async () => {
      const content = `
        import { helper1 } from '../../modules/helper.ts';
        import { helper2 } from '../../modules/helper.ts';
        import { helper3 } from '../../modules/helper.ts';
        import type { Type1 } from '../../modules/types.ts';
        import type { Type2 } from '../../modules/types.ts';
        function main(): Type1 {
          return helper1() + helper2() + helper3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-ts-all.ts');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).not.toContain('../../modules/');
      expect(contentAfter).toContain('import { helper1, helper2, helper3 } from');
      expect(contentAfter).toContain('import type { Type1, Type2 } from');
    });

    it('8.3 должен исправлять проблемы в JSX файлах', async () => {
      const content = `
        import React from 'react';
        import { Component1 } from './Component1.jsx';
        import { Component2 } from './Component2.jsx';
        import { Component3 } from './Component1.jsx';
        function App() {
          return (
            <div>
              <Component1 />
              <Component2 />
              <Component3 />
            </div>
          );
        }
        export { App };
      `;
      const testFile = createTestFile(content, 'fix-jsx-all.jsx');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        jsxAnalysis: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('import { Component1, Component3 } from');
    });

    it('8.4 должен исправлять проблемы в Vue файлах', async () => {
      const content = `
        <script setup>
        import { ref } from 'vue';
        import { helper } from '../../modules/helper.js';
        import { format } from '../../modules/format.js';
        import { validate } from '../../modules/validate.js';
        const count = ref(0);
        function main() {
          return helper() + format() + validate();
        }
        </script>
        <template>
          <div>{{ main() }}</div>
        </template>
      `;
      const testFile = createTestFile(content, 'fix-vue-all.vue');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        vueAnalysis: true,
        updateTemplate: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).not.toContain('../../modules/');
    });
  });

  // ============================================
  // 9. СЦЕНАРИИ С РАЗНЫМИ НАСТРОЙКАМИ
  // ============================================

  describe('Сценарии с разными настройками', () => {
    it('9.1 должен работать с разными уровнями логирования', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        function main() {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-log-levels.js');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        logLevel: 'debug',
        logFile: path.join(testDir, 'refactor.log'),
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const logFile = path.join(testDir, 'refactor.log');
      expect(fs.existsSync(logFile)).toBe(true);
    });

    it('9.2 должен работать с разным количеством попыток', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        function main() {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-max-attempts.js');

      let attempts = 0;
      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        maxAttempts: 3,
        guaranteeMode: true,
      });

      const originalAnalyze = (refactor as any).analyzeFile;
      vi.spyOn(refactor as any, 'analyzeFile').mockImplementation(async (filePath: string) => {
        attempts++;
        if (attempts < 2) {
          throw new Error(`Simulated failure attempt ${attempts}`);
        }
        return originalAnalyze.call(refactor, filePath);
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });

    it('9.3 должен работать в режиме dry-run', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        function main() {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-dry-run.js');
      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const refactor = new AutoRefactor({
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

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(originalContent);
    });

    it('9.4 должен работать в режиме без бэкапа', async () => {
      const content = `
        import { helper } from '../../modules/helper.js';
        function main() {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-no-backup.js');

      const refactor = new AutoRefactor({
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: false,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const files = fs.readdirSync(testDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles.length).toBe(0);
    });
  });
});
