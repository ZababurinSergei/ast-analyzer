// packages/ast-analyzer/src/refactor/__tests__/import-fixes-extra.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('Import Fixes - Дополнительные сценарии', () => {
  const testDir = path.join(process.cwd(), 'test-temp-import-fixes-extra');

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
  // 5. ДОПОЛНИТЕЛЬНЫЕ СЦЕНАРИИ ДЛЯ --fix-imports
  // ============================================

  describe('--fix-imports: Дополнительные сценарии', () => {
    const createTestFile = (content: string, filename: string = 'test.js') => {
      const filePath = path.join(testDir, filename);
      fs.writeFileSync(filePath, content);
      return filePath;
    };

    it('5.1 должен исправлять импорты с глубокой вложенностью (../../../)', async () => {
      const content = `
        import { helper } from '../../../deep/helper.js';
        import { config } from '../../config.js';
        export function test() { return helper() + config(); }
      `;
      const testFile = createTestFile(content, 'deep-imports.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Пути должны быть исправлены на правильные относительные
      expect(contentAfter).not.toContain('../../../');
      expect(contentAfter).not.toContain('../../');
    });

    it('5.2 должен исправлять импорты с символьными ссылками', async () => {
      // Создаем символьную ссылку
      const symlinkTarget = path.join(testDir, 'real-helper.js');
      fs.writeFileSync(symlinkTarget, 'export const helper = () => 42;');

      const symlinkPath = path.join(testDir, 'helper-link.js');
      try {
        fs.symlinkSync(symlinkTarget, symlinkPath);
      } catch (e) {
        // На Windows может не работать, пропускаем
        return;
      }

      const content = `
        import { helper } from './helper-link.js';
        export function test() { return helper(); }
      `;
      const testFile = createTestFile(content, 'symlink-import.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('import { helper } from');
    });

    it('5.3 должен исправлять импорты с пробелами и кавычками разных типов', async () => {
      const content = `
        import { helper1 } from  './helper1.js' ;
        import { helper2 } from "./helper2.js" ;
        import { helper3 } from \`./helper3.js\` ;
        export function test() { return helper1() + helper2() + helper3(); }
      `;
      const testFile = createTestFile(content, 'quotes-imports.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Должна быть единообразная структура импортов
      expect(contentAfter).toMatch(/import\s*{\s*helper1\s*}\s*from\s*['"]\.\/helper1\.js['"]/);
    });

    it('5.4 должен исправлять импорты с re-export', async () => {
      const content = `
        export { helper1 } from './helper1.js';
        export { helper2 } from './helper2.js';
        export { helper3 } from './helper3.js';
      `;
      const testFile = createTestFile(content, 're-export.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Re-export должен сохраниться
      expect(contentAfter).toContain("export { helper1 } from './helper1.js'");
    });

    it('5.5 должен исправлять импорты с экспортом по умолчанию', async () => {
      const content = `
        import defaultExport from './default.js';
        import { named } from './named.js';
        import defaultRenamed from './default.js';
        export function test() { return defaultExport() + named() + defaultRenamed(); }
      `;
      const testFile = createTestFile(content, 'default-imports.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Default импорты из одного модуля должны быть сгруппированы
      expect(contentAfter).toContain(
        "import defaultExport, { default as defaultRenamed } from './default.js'"
      );
    });

    it('5.6 должен исправлять импорты с условной загрузкой', async () => {
      const content = `
        if (process.env.NODE_ENV === 'production') {
          import { prod } from './prod.js';
        } else {
          import { dev } from './dev.js';
        }
        export function test() { return prod ? prod() : dev(); }
      `;
      const testFile = createTestFile(content, 'conditional-imports.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Условные импорты должны сохраниться
      expect(contentAfter).toContain("import { prod } from './prod.js'");
      expect(contentAfter).toContain("import { dev } from './dev.js'");
    });

    it('5.7 должен исправлять импорты с комментариями JSDoc', async () => {
      const content = `
        /**
         * @module helpers
         * @description Helper functions
         */
        import { helper } from './helper.js';
        /**
         * @function test
         * @returns {number}
         */
        export function test() { return helper(); }
      `;
      const testFile = createTestFile(content, 'jsdoc-imports.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // JSDoc комментарии должны сохраниться
      expect(contentAfter).toContain('/**');
      expect(contentAfter).toContain('@module helpers');
    });
  });

  // ============================================
  // 6. ДОПОЛНИТЕЛЬНЫЕ СЦЕНАРИИ ДЛЯ --optimize-imports
  // ============================================

  describe('--optimize-imports: Дополнительные сценарии', () => {
    const createTestFile = (content: string, filename: string = 'test.js') => {
      const filePath = path.join(testDir, filename);
      fs.writeFileSync(filePath, content);
      return filePath;
    };

    it('6.1 должен группировать импорты с вложенными путями', async () => {
      const content = `
        import { helper } from './utils/helper.js';
        import { format } from './utils/format.js';
        import { validate } from './utils/validate.js';
        export function test() { return helper() + format() + validate(); }
      `;
      const testFile = createTestFile(content, 'nested-paths.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain(
        "import { helper, format, validate } from './utils/helper.js'"
      );
    });

    it('6.2 должен обрабатывать импорты с одинаковыми именами из разных модулей', async () => {
      const content = `
        import { process } from './module-a.js';
        import { process as processB } from './module-b.js';
        export function test() { return process() + processB(); }
      `;
      const testFile = createTestFile(content, 'same-names.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Оба импорта должны сохраниться с корректными алиасами
      expect(contentAfter).toContain("import { process } from './module-a.js'");
      expect(contentAfter).toContain("import { process as processB } from './module-b.js'");
    });

    it('6.3 должен группировать импорты из одного модуля с сохранением алиасов', async () => {
      const content = `
        import { func1 as f1 } from './module.js';
        import { func2 as f2 } from './module.js';
        import { func3 as f3 } from './module.js';
        export function test() { return f1() + f2() + f3(); }
      `;
      const testFile = createTestFile(content, 'aliases-group.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain(
        "import { func1 as f1, func2 as f2, func3 as f3 } from './module.js'"
      );
    });

    it('6.4 должен сохранять порядок импортов при группировке', async () => {
      const content = `
        import { z } from 'zod';
        import { helper } from './helper.js';
        import { format } from './format.js';
        import { validate } from 'validate-package';
        export function test() { return helper() + format() + validate() + z(); }
      `;
      const testFile = createTestFile(content, 'order-preserve.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Внешние пакеты должны быть перед внутренними
      const zodIndex = contentAfter.indexOf("import { z } from 'zod'");
      const validateIndex = contentAfter.indexOf("import { validate } from 'validate-package'");
      const internalIndex = contentAfter.indexOf('import { helper, format } from');

      expect(zodIndex).toBeLessThan(validateIndex);
      expect(validateIndex).toBeLessThan(internalIndex);
    });

    it('6.5 должен обрабатывать импорты с type и value в одном модуле', async () => {
      const content = `
        import { type Type1, Type2, type Type3 } from './types.js';
        import { type Type4 } from './types.js';
        export function test(): Type1 | Type2 | Type3 | Type4 { return null; }
      `;
      const testFile = createTestFile(content, 'type-value-mix.ts');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        typeCheck: true,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Должен быть один импорт с type и value
      expect(contentAfter).toContain(
        "import { type Type1, Type2, type Type3, type Type4 } from './types.js'"
      );
    });
  });

  // ============================================
  // 7. СЦЕНАРИИ С РЕАЛЬНЫМИ ПРОБЛЕМАМИ ИЗ ЛОГОВ
  // ============================================

  describe('Реальные проблемы из логов', () => {
    const createTestFile = (content: string, filename: string = 'test.js') => {
      const filePath = path.join(testDir, filename);
      fs.writeFileSync(filePath, content);
      return filePath;
    };

    it('7.1 должен исправлять дублирующиеся модули (как в логах)', async () => {
      const content = `
        import { parseFile } from '../../modules/file-system-json.mjs';
        import { writeFile } from '../../modules/file-system-json.mjs';
        import { readFile } from '../../modules/file-system-json.mjs';
        export function test() { return parseFile() + writeFile() + readFile(); }
      `;
      const testFile = createTestFile(content, 'duplicate-modules.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Должен быть один импорт вместо трех
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBe(1);
      expect(contentAfter).toContain('import { parseFile, writeFile, readFile } from');
      // Путь должен быть исправлен
      expect(contentAfter).not.toContain('../../');
    });

    it('7.2 должен исправлять модули с 0 экспортов (как в логах)', async () => {
      const content = `
        import './empty-module.js';
        import { helper } from './helper.js';
        export function test() { return helper(); }
      `;
      const testFile = createTestFile(content, 'empty-export-module.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Пустой импорт должен быть удален
      expect(contentAfter).not.toContain("import './empty-module.js'");
      // Полезный импорт должен сохраниться
      expect(contentAfter).toContain("import { helper } from './helper.js'");
    });

    it('7.3 должен исправлять конфликтующие импорты (как в логах)', async () => {
      const content = `
        import { func1 } from './module.js';
        import { func2 } from './module.js';
        import { func3 } from './module.js';
        export function test() { return func1() + func2(); }
      `;
      const testFile = createTestFile(content, 'conflicting-imports.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Неиспользуемый func3 должен быть удален
      expect(contentAfter).not.toContain('func3');
      // func1 и func2 должны быть в одном импорте
      expect(contentAfter).toContain("import { func1, func2 } from './module.js'");
    });

    it('7.4 должен исправлять неправильные пути из логов (../../modules/ -> ./modules/)', async () => {
      const content = `
        import { helper1 } from '../../modules/helper1.js';
        import { helper2 } from '../../modules/helper2.js';
        import { helper3 } from '../../modules/helper3.js';
        export function test() { return helper1() + helper2() + helper3(); }
      `;
      const testFile = createTestFile(content, 'wrong-paths.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Пути должны быть исправлены
      expect(contentAfter).not.toContain('../../modules/');
      expect(contentAfter).toContain('import { helper1, helper2, helper3 } from');
      expect(contentAfter).toMatch(/from\s+['"]\.\/modules\/helper[^'"]+\.js['"]/);
    });

    it('7.5 должен исправлять множественные импорты одного модуля в разных местах', async () => {
      const content = `
        import { helper1 } from './utils.js';
        // Другой код
        import { helper2 } from './utils.js';
        // Еще код
        import { helper3 } from './utils.js';
        export function test() { return helper1() + helper2() + helper3(); }
      `;
      const testFile = createTestFile(content, 'scattered-imports.js');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Должен быть один импорт
      const importCount = (contentAfter.match(/import\s*{/g) || []).length;
      expect(importCount).toBe(1);
      expect(contentAfter).toContain("import { helper1, helper2, helper3 } from './utils.js'");
    });
  });

  // ============================================
  // 8. СЦЕНАРИИ С РАЗНЫМИ ТИПАМИ ФАЙЛОВ
  // ============================================

  describe('Разные типы файлов', () => {
    const createTestFile = (content: string, filename: string = 'test.js') => {
      const filePath = path.join(testDir, filename);
      fs.writeFileSync(filePath, content);
      return filePath;
    };

    it('8.1 должен корректно обрабатывать .ts файл с импортами', async () => {
      const content = `
        import { helper } from './helper.ts';
        import type { Type } from './types.ts';
        import { func } from './func.ts';
        export function test(): Type { return helper() + func(); }
      `;
      const testFile = createTestFile(content, 'typescript-imports.ts');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        typeCheck: true,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // Type импорты должны быть оптимизированы
      expect(contentAfter).toContain("import { helper, func } from './helper.ts'");
      expect(contentAfter).toContain("import type { Type } from './types.ts'");
    });

    it('8.2 должен корректно обрабатывать .vue файл с импортами', async () => {
      const content = `
        <script setup>
        import { ref } from 'vue';
        import { helper } from './helper.js';
        import { format } from './format.js';
        const count = ref(0);
        </script>
        <template>
          <div>{{ helper() }}</div>
        </template>
      `;
      const testFile = createTestFile(content, 'vue-imports.vue');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        vueAnalysis: true,
        updateTemplate: true,
      });

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

      expect(result.success).toBe(true);
    });

    it('8.3 должен корректно обрабатывать .jsx файл с импортами', async () => {
      const content = `
        import React from 'react';
        import { useState } from 'react';
        import { helper } from './helper.js';
        export function Component() {
          const [count, setCount] = useState(0);
          return <div>{helper()}</div>;
        }
      `;
      const testFile = createTestFile(content, 'jsx-imports.jsx');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        jsxAnalysis: true,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // React импорты должны быть объединены
      expect(contentAfter).toContain("import React, { useState } from 'react'");
    });

    it('8.4 должен корректно обрабатывать .mjs файл (ESM)', async () => {
      const content = `
        import { helper } from './helper.mjs';
        import { format } from './format.mjs';
        export function test() { return helper() + format(); }
      `;
      const testFile = createTestFile(content, 'esm-imports.mjs');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

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

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain("import { helper, format } from './helper.mjs'");
    });

    it('8.5 должен корректно обрабатывать .cjs файл (CommonJS)', async () => {
      const content = `
        const { helper } = require('./helper.cjs');
        const { format } = require('./format.cjs');
        function test() { return helper() + format(); }
        module.exports = { test };
      `;
      const testFile = createTestFile(content, 'commonjs-imports.cjs');

      const refactor = new AutoRefactor({
        fixUnusedImports: true,
        optimizeImports: true,
        dryRun: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'cjs',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      // require должен сохраниться
      expect(contentAfter).toContain("const { helper, format } = require('./helper.cjs')");
    });
  });
});
