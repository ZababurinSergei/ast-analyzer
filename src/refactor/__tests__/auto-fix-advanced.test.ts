// packages/ast-analyzer/src/refactor/__tests__/auto-fix-advanced.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('--auto-fix: Расширенные сценарии', () => {
  const testDir = path.join(process.cwd(), 'test-temp-auto-fix-advanced');

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
  // 9. ИСПРАВЛЕНИЕ СЛОЖНЫХ ПУТЕЙ
  // ============================================

  describe('Исправление сложных путей', () => {
    it('9.1 должен исправлять пути с node_modules', async () => {
      const content = `
        import { helper } from '../../node_modules/helper/index.js';
        import { utils } from '../../../node_modules/utils/index.js';
        function main() {
          return helper() + utils();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-node-modules.js');

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
      // Пути к node_modules должны быть исправлены
      expect(contentAfter).not.toContain('../../node_modules/');
      expect(contentAfter).not.toContain('../../../node_modules/');
    });

    it('9.2 должен исправлять пути с абсолютными путями', async () => {
      const content = `
        import { helper } from '/src/utils/helper.js';
        import { config } from '/config.js';
        function main() {
          return helper() + config();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-absolute-paths.js');

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
      // Абсолютные пути должны быть исправлены на относительные
      expect(contentAfter).not.toContain("'/src/utils/helper.js'");
      expect(contentAfter).not.toContain("'/config.js'");
    });

    it('9.3 должен исправлять пути с алиасами (@, #, ~)', async () => {
      const content = `
        import { helper } from '@/utils/helper.js';
        import { config } from '#/config.js';
        import { utils } from '~/utils.js';
        function main() {
          return helper() + config() + utils();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-alias-paths.js');

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
      // Алиасы должны быть разрешены или исправлены
      // В зависимости от конфигурации tsconfig
    });
  });

  // ============================================
  // 10. ИСПРАВЛЕНИЕ РАЗНЫХ ТИПОВ ИМПОРТОВ
  // ============================================

  describe('Исправление разных типов импортов', () => {
    it('10.1 должен исправлять динамические импорты', async () => {
      const content = `
        async function loadModule() {
          const module = await import('../../modules/dynamic.js');
          return module.default();
        }
        function main() {
          return loadModule();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-dynamic-imports.js');

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
      // Динамический импорт должен быть исправлен
      expect(contentAfter).not.toContain('../../modules/dynamic.js');
    });

    it('10.2 должен исправлять импорты с require', async () => {
      const content = `
        const helper = require('../../modules/helper.js');
        function main() {
          return helper();
        }
        module.exports = { main };
      `;
      const testFile = createTestFile(content, 'fix-require.js');

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
      // require путь должен быть исправлен
      expect(contentAfter).not.toContain('../../modules/helper.js');
    });

    it('10.3 должен исправлять импорты с type (TypeScript)', async () => {
      const content = `
        import type { User } from '../../types/user.ts';
        import type { Config } from '../../types/config.ts';
        import { helper } from '../../modules/helper.ts';
        function main(): User {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-type-imports.ts');

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
      // Type импорты должны быть сгруппированы
      expect(contentAfter).toContain('import type { User, Config } from');
      expect(contentAfter).not.toContain('../../types/');
    });
  });

  // ============================================
  // 11. ИСПРАВЛЕНИЕ КОНФЛИКТОВ ИМЕН
  // ============================================

  describe('Исправление конфликтов имен', () => {
    it('11.1 должен исправлять конфликты с глобальными переменными', async () => {
      const content = `
        import { console } from '../../modules/console.js';
        import { window } from '../../modules/window.js';
        function main() {
          console.log('Hello');
          return window.innerWidth;
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-global-conflicts.js');

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
      // Конфликты с глобальными переменными должны быть разрешены
      // console и window могут быть переименованы
      expect(contentAfter).not.toContain('import { console } from');
      expect(contentAfter).not.toContain('import { window } from');
    });

    it('11.2 должен исправлять конфликты с ключевыми словами', async () => {
      const content = `
        import { function as func } from '../../modules/function.js';
        import { class as cls } from '../../modules/class.js';
        import { import as imp } from '../../modules/import.js';
        function main() {
          return func() + cls() + imp();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-keyword-conflicts.js');

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
      // Конфликты с ключевыми словами должны быть разрешены
      expect(contentAfter).toContain('function as func');
      expect(contentAfter).toContain('class as cls');
      expect(contentAfter).toContain('import as imp');
    });
  });

  // ============================================
  // 12. ИСПРАВЛЕНИЕ СИНТАКСИЧЕСКИХ ОШИБОК В РАЗНЫХ КОНТЕКСТАХ
  // ============================================

  describe('Исправление синтаксических ошибок в разных контекстах', () => {
    it('12.1 должен исправлять синтаксические ошибки в функциях', async () => {
      const content = `
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
      const testFile = createTestFile(content, 'fix-function-syntax.js');

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
      // Синтаксические ошибки должны быть исправлены
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);
      expect(contentAfter).toMatch(/return x \+ y;/);
      expect(contentAfter).toMatch(/return 0;/);
      expect(contentAfter).toMatch(/export { main };/);
    });

    it('12.2 должен исправлять синтаксические ошибки в классах', async () => {
      const content = `
        class Calculator {
          constructor() {
            this.result = 0
          }
          add(a, b) {
            this.result = a + b
            return this.result
          }
          subtract(a, b) {
            this.result = a - b
            return this.result
          }
        }
        export { Calculator }
      `;
      const testFile = createTestFile(content, 'fix-class-syntax.js');

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
      // Синтаксические ошибки в классе должны быть исправлены
      expect(contentAfter).toMatch(/this\.result = 0;/);
      expect(contentAfter).toMatch(/this\.result = a \+ b;/);
      expect(contentAfter).toMatch(/return this\.result;/);
    });

    it('12.3 должен исправлять синтаксические ошибки в объектах', async () => {
      const content = `
        const config = {
          api: 'https://api.example.com',
          timeout: 5000,
          retries: 3
        }
        function main() {
          return config
        }
        export { main }
      `;
      const testFile = createTestFile(content, 'fix-object-syntax.js');

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
      // Синтаксические ошибки в объекте должны быть исправлены
      expect(contentAfter).toContain('const config = {');
      expect(contentAfter).toContain("api: 'https://api.example.com',");
      expect(contentAfter).toContain('timeout: 5000,');
      expect(contentAfter).toContain('retries: 3');
      expect(contentAfter).toContain('};');
    });
  });

  // ============================================
  // 13. ИСПРАВЛЕНИЕ В РАЗНЫХ ТИПАХ ФАЙЛОВ
  // ============================================

  describe('Исправление в разных типах файлов', () => {
    it('13.1 должен исправлять импорты в TypeScript файлах', async () => {
      const content = `
        import { helper } from '../../modules/helper.ts';
        import type { User } from '../../types/user.ts';
        import { config } from '../../config.ts';
        function main(): User {
          return helper(config);
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-ts-imports.ts');

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
      // Импорты должны быть исправлены
      expect(contentAfter).not.toContain('../../modules/');
      expect(contentAfter).not.toContain('../../types/');
      expect(contentAfter).not.toContain('../../config.ts');
    });

    it('13.2 должен исправлять импорты в JSX файлах', async () => {
      const content = `
        import React from 'react';
        import { Button } from '../../components/Button.jsx';
        import { Input } from '../../components/Input.jsx';
        import { Form } from '../../components/Form.jsx';
        function App() {
          return (
            <Form>
              <Button>Submit</Button>
              <Input type="text" />
            </Form>
          );
        }
        export { App };
      `;
      const testFile = createTestFile(content, 'fix-jsx-imports.jsx');

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
      // Импорты в JSX должны быть исправлены
      expect(contentAfter).not.toContain('../../components/');
      // Должны быть сгруппированы или исправлены
      expect(contentAfter).toContain('import { Button, Input, Form } from');
    });

    it('13.3 должен исправлять импорты в Vue файлах', async () => {
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
      const testFile = createTestFile(content, 'fix-vue-imports.vue');

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
      // Импорты в Vue должны быть исправлены
      expect(contentAfter).not.toContain('../../modules/');
    });
  });

  // ============================================
  // 14. СЦЕНАРИИ С РАЗНЫМИ НАСТРОЙКАМИ
  // ============================================

  describe('Сценарии с разными настройками', () => {
    it('14.1 должен работать с разными уровнями логирования', async () => {
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
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      // Проверяем, что лог-файл создан
      const logFile = path.join(testDir, 'refactor.log');
      expect(fs.existsSync(logFile)).toBe(true);
    });

    it('14.2 должен работать с разным количеством попыток (maxAttempts)', async () => {
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

      // Мокаем analyzeFile для проверки количества попыток
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
      // Должно быть 2 попытки (первая упала, вторая успешная)
      expect(attempts).toBe(2);
    });

    it('14.3 должен работать в режиме dry-run (без изменений)', async () => {
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

      // Файл не должен измениться
      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toBe(originalContent);
    });

    it('14.4 должен работать в режиме без бэкапа', async () => {
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

      // Бэкап не должен быть создан
      const files = fs.readdirSync(testDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles.length).toBe(0);
    });
  });

  // ============================================
  // 15. ИСПРАВЛЕНИЕ НЕСТАНДАРТНЫХ СИТУАЦИЙ
  // ============================================

  describe('Исправление нестандартных ситуаций', () => {
    it('15.1 должен исправлять импорты с пробелами в именах', async () => {
      const content = `
        import { helper1 } from './helper 1.js';
        import { helper2 } from './helper-2.js';
        import { helper3 } from './helper_3.js';
        function main() {
          return helper1() + helper2() + helper3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-spaces-in-names.js');

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
      // Имена с пробелами должны быть обработаны корректно
      expect(contentAfter).toContain("'./helper 1.js'");
      expect(contentAfter).toContain("'./helper-2.js'");
      expect(contentAfter).toContain("'./helper_3.js'");
    });

    it('15.2 должен исправлять импорты с очень длинными путями', async () => {
      const longPath = 'a'.repeat(200);
      const content = `
        import { helper } from './${longPath}/helper.js';
        function main() {
          return helper();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-long-paths.js');

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

    it('15.3 должен исправлять импорты со специальными символами', async () => {
      const content = `
        import { helper } from './helper@special.js';
        import { utils } from './utils#special.js';
        import { config } from './config$special.js';
        function main() {
          return helper() + utils() + config();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-special-chars.js');

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
      // Специальные символы должны сохраниться в путях
      expect(contentAfter).toContain("'./helper@special.js'");
      expect(contentAfter).toContain("'./utils#special.js'");
      expect(contentAfter).toContain("'./config$special.js'");
    });

    it('15.4 должен исправлять импорты с русскими именами', async () => {
      const content = `
        import { helper } from './помощник.js';
        import { utils } from './утилиты.js';
        function main() {
          return helper() + utils();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-russian-names.js');

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
      // Русские имена должны сохраниться
      expect(contentAfter).toContain("'./помощник.js'");
      expect(contentAfter).toContain("'./утилиты.js'");
    });

    it('15.5 должен исправлять импорты с пробелами в начале и конце', async () => {
      const content = `
        import { helper1 } from ' ./helper1.js ';
        import { helper2 } from " ./helper2.js ";
        import { helper3 } from \` ./helper3.js \`;
        function main() {
          return helper1() + helper2() + helper3();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-leading-trailing-spaces.js');

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
      // Пробелы в начале и конце должны быть удалены
      expect(contentAfter).toContain("import { helper1 } from './helper1.js'");
      expect(contentAfter).toContain("import { helper2 } from './helper2.js'");
      expect(contentAfter).toContain("import { helper3 } from './helper3.js'");
    });

    it('15.6 должен исправлять импорты с неправильными расширениями', async () => {
      const content = `
        import { helper } from './helper.xxx';
        import { utils } from './utils.yyy';
        import { config } from './config.zzz';
        function main() {
          return helper() + utils() + config();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-wrong-extensions.js');

      // Создаем файлы с правильными расширениями
      fs.writeFileSync(path.join(testDir, 'helper.js'), 'export const helper = () => 1;');
      fs.writeFileSync(path.join(testDir, 'utils.js'), 'export const utils = () => 2;');
      fs.writeFileSync(path.join(testDir, 'config.js'), 'export const config = () => 3;');

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
      // Расширения должны быть исправлены на .js
      expect(contentAfter).toContain("import { helper } from './helper.js'");
      expect(contentAfter).toContain("import { utils } from './utils.js'");
      expect(contentAfter).toContain("import { config } from './config.js'");
    });
  });

  // ============================================
  // 16. ИСПРАВЛЕНИЕ В КОМПЛЕКСНЫХ СЦЕНАРИЯХ
  // ============================================

  describe('Исправление в комплексных сценариях', () => {
    it('16.1 должен исправлять все проблемы в одном файле', async () => {
      const content = `
        import { helper1 } from '../../modules/helper1.js';
        import { helper2 } from '../../modules/helper2.js';
        import { helper3 } from '../../modules/helper3.js';
        import { unused } from './unused.js';
        import './empty-module.js';
        import { helper4 } from './helper4.js';
        import { helper5 } from './helper5.js';
        
        function main() {
          const x = 1
          const y = 2
          if (x > 0 {
            return helper1() + helper2() + helper3() + helper4() + helper5()
          }
          return 0
        }
        
        export { main }
      `;
      const testFile = createTestFile(content, 'fix-all-problems.js');

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

      // 1. Пути исправлены
      expect(contentAfter).not.toContain('../../modules/');

      // 2. Импорты сгруппированы
      expect(contentAfter).toContain('import { helper1, helper2, helper3 } from');

      // 3. Неиспользуемые импорты удалены
      expect(contentAfter).not.toContain('unused');
      expect(contentAfter).not.toContain("import './empty-module.js'");

      // 4. Синтаксис исправлен
      expect(contentAfter).toMatch(/const x = 1;/);
      expect(contentAfter).toMatch(/const y = 2;/);
      expect(contentAfter).toMatch(/if \(x > 0\) {/);
      expect(contentAfter).toMatch(/export { main };/);
    });

    it('16.2 должен исправлять импорты с вложенными структурами', async () => {
      const content = `
        import { helper1, helper2 } from './utils/helpers.js';
        import { helper3, helper4 } from './utils/helpers.js';
        import { helper5 } from './utils/helpers.js';
        import { config } from './config.js';
        
        function main() {
          return helper1() + helper2() + helper3() + helper4() + helper5() + config();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-nested-structures.js');

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
      // Все импорты из одного модуля должны быть сгруппированы
      expect(contentAfter).toContain('import { helper1, helper2, helper3, helper4, helper5 } from');
      // Импорт из другого модуля должен остаться отдельно
      expect(contentAfter).toContain("import { config } from './config.js'");
    });

    it('16.3 должен исправлять импорты с разными уровнями вложенности', async () => {
      const content = `
        import { helper1 } from '../../../deep/helper1.js';
        import { helper2 } from '../../helper2.js';
        import { helper3 } from './helper3.js';
        import { helper4 } from '../helper4.js';
        
        function main() {
          return helper1() + helper2() + helper3() + helper4();
        }
        export { main };
      `;
      const testFile = createTestFile(content, 'fix-different-levels.js');

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
      // Все пути должны быть исправлены на правильные относительные
      expect(contentAfter).not.toContain('../../../');
      expect(contentAfter).not.toContain('../../');
    });
  });
});
