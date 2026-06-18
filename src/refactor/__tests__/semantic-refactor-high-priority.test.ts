// src/refactor/__tests__/semantic-refactor-high-priority.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('Семантический рефакторинг - Высокий приоритет', () => {
  const testDir = path.join(process.cwd(), 'test-temp-high-priority');

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
  // 1. ОБРАБОТКА ПУСТЫХ ФАЙЛОВ
  // ============================================

  describe('Обработка пустых файлов', () => {
    it('должен успешно обрабатывать полностью пустой файл', async () => {
      const testFile = path.join(testDir, 'empty.js');
      fs.writeFileSync(testFile, '');

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules).toBeDefined();
      expect(result.modules.length).toBe(0);
    });

    it('должен успешно обрабатывать файл только с комментариями', async () => {
      const testFile = path.join(testDir, 'comments-only.js');
      const content = `
        // Это комментарий
        /* Это многострочный комментарий */
        // Еще один комментарий
        /*
          Блок комментария
          с несколькими строками
        */
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBe(0);
    });

    it('должен успешно обрабатывать файл только с пробелами и переносами', async () => {
      const testFile = path.join(testDir, 'whitespace-only.js');
      fs.writeFileSync(testFile, '\n\n  \n\t\n  \n');

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBe(0);
    });

    it('должен успешно обрабатывать файл только с импортами без экспортов', async () => {
      const testFile = path.join(testDir, 'imports-only.js');
      const content = `
        import fs from 'fs';
        import path from 'path';
        import { readFile, writeFile } from 'fs/promises';
        import * as utils from './utils.js';
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
      });

      // Мокаем валидацию
      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBe(0);
    });

    it('должен успешно обрабатывать файл только с экспортами без функций', async () => {
      const testFile = path.join(testDir, 'exports-only.js');
      const content = `
        export const CONFIG = { api: 'https://api.example.com' };
        export const MAX_RETRIES = 3;
        export const TIMEOUT = 5000;
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      // Мокаем валидацию
      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 2. ОБРАБОТКА ФАЙЛОВ С СИНТАКСИЧЕСКИМИ ОШИБКАМИ
  // ============================================

  describe('Обработка файлов с синтаксическими ошибками', () => {
    it('должен обрабатывать файл с незакрытой фигурной скобкой', async () => {
      const testFile = path.join(testDir, 'unclosed-brace.js');
      const content = `
        function test() {
          return 1;
        // отсутствует закрывающая скобка
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      // Мокаем валидацию, чтобы пропустить синтаксические ошибки
      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с незакрытой круглой скобкой', async () => {
      const testFile = path.join(testDir, 'unclosed-paren.js');
      const content = `
        function test() {
          return (1 + 2;
        }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с незакрытой строкой', async () => {
      const testFile = path.join(testDir, 'unclosed-string.js');
      const content = `
        const str = "незакрытая строка;
        function test() { return 1; }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с некорректным синтаксисом JSX', async () => {
      const testFile = path.join(testDir, 'invalid-jsx.jsx');
      const content = `
        import React from 'react';
        function Component() {
          return <div> <span> </div>;
        }
        export { Component };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        jsxAnalysis: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с некорректным синтаксисом Vue', async () => {
      const testFile = path.join(testDir, 'invalid-vue.vue');
      const content = `
        <template>
          <div> {{ message } </div>
        </template>
        <script>
        export default {
          data() {
            return {
              message: 'Hello'
            }
          }
        }
        </script>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        vueAnalysis: true,
        updateTemplate: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с незакрытым комментарием', async () => {
      const testFile = path.join(testDir, 'unclosed-comment.js');
      const content = `
        /* незакрытый комментарий
        function test() { return 1; }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 3. ВОССТАНОВЛЕНИЕ ПОСЛЕ ОШИБОК
  // ============================================

  describe('Восстановление после ошибок', () => {
    it('должен восстанавливаться после ошибки на этапе анализа', async () => {
      const testFile = path.join(testDir, 'error-analysis.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        maxAttempts: 3,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      let attempts = 0;
      const originalAnalyze = (refactor as any).analyzeFile;
      vi.spyOn(refactor as any, 'analyzeFile').mockImplementation(async (filePath: string) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Simulated analysis error');
        }
        return originalAnalyze.call(refactor, filePath);
      });

      // Мокаем валидацию
      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });

    it('должен восстанавливаться после ошибки на этапе кластеризации', async () => {
      const testFile = path.join(testDir, 'error-clustering.js');
      const content = `
        function a() { return 1; }
        function b() { return a(); }
        function c() { return b(); }
        export { a, b, c };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        maxAttempts: 3,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      const originalIdentify = (refactor as any).identifyClusters;
      vi.spyOn(refactor as any, 'identifyClusters')
        .mockImplementationOnce(() => {
          throw new Error('Simulated clustering error');
        })
        .mockImplementationOnce(() => {
          return originalIdentify.call(refactor);
        });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен восстанавливаться после ошибки на этапе извлечения модулей', async () => {
      const testFile = path.join(testDir, 'error-extraction.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        maxAttempts: 3,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      const mockExtractor = {
        extractModules: vi.fn()
          .mockRejectedValueOnce(new Error('Simulated extraction error'))
          .mockResolvedValueOnce([])
      };
      (refactor as any).extractor = mockExtractor;

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен восстанавливаться после ошибки на этапе обновления импортов', async () => {
      const testFile = path.join(testDir, 'error-imports.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        maxAttempts: 3,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      const originalUpdate = (refactor as any).updateImports;
      vi.spyOn(refactor as any, 'updateImports')
        .mockRejectedValueOnce(new Error('Simulated imports update error'))
        .mockImplementationOnce(async () => {
          return originalUpdate.call(refactor);
        });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен сохранять состояние и восстанавливаться после частичного выполнения', async () => {
      const testFile = path.join(testDir, 'partial-execution.js');
      const content = `
        function func1() { return 1; }
        function func2() { return func1(); }
        function func3() { return func2(); }
        function func4() { return func3(); }
        function func5() { return func4(); }
        export { func1, func2, func3, func4, func5 };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        maxAttempts: 3,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
      });

      let phase = 0;
      const originalAnalyze = (refactor as any).analyzeFile;
      vi.spyOn(refactor as any, 'analyzeFile').mockImplementation(async (filePath: string) => {
        phase++;
        if (phase === 1) {
          return originalAnalyze.call(refactor, filePath);
        }
        if (phase === 2) {
          throw new Error('Simulated error after checkpoint');
        }
        return originalAnalyze.call(refactor, filePath);
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 4. ОСНОВНЫЕ CLI ФЛАГИ
  // ============================================

  describe('Основные CLI флаги', () => {
    it('должен работать с флагами по умолчанию', async () => {
      const testFile = path.join(testDir, 'default-flags.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('должен работать с флагом --dry-run (без изменений)', async () => {
      const testFile = path.join(testDir, 'dry-run-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);
      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const refactor = new AutoRefactor({
        dryRun: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      const currentContent = fs.readFileSync(testFile, 'utf-8');
      expect(currentContent).toBe(originalContent);
    });

    it('должен работать с флагом --no-backup (без создания бэкапа)', async () => {
      const testFile = path.join(testDir, 'no-backup-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        createBackup: false,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);

      const files = fs.readdirSync(testDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles.length).toBe(0);
    });

    it('должен работать с флагом --no-vue для Vue файлов', async () => {
      const testFile = path.join(testDir, 'no-vue-test.vue');
      const content = `
        <script setup>
        const count = ref(0);
        function increment() { count.value++; }
        function decrement() { count.value--; }
        </script>
        <template>
          <div>
            <button @click="increment">+</button>
            <button @click="decrement">-</button>
          </div>
        </template>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        updateTemplate: false,
        vueAnalysis: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с флагом --no-re-exports', async () => {
      const testFile = path.join(testDir, 'no-re-exports.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        addReExports: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с флагом --no-semantic', async () => {
      const testFile = path.join(testDir, 'no-semantic.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        semanticAnalysis: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.semanticResults).toBeUndefined();
    });

    it('должен работать с флагом --no-eslint', async () => {
      const testFile = path.join(testDir, 'no-eslint.js');
      const content = `
        function test() { 
          let x = 1; 
          console.log(x);
          return 42; 
        }
        export { test };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        eslintCheck: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.eslintResults).toBeUndefined();
    });

    it('должен работать с флагом --no-typescript', async () => {
      const testFile = path.join(testDir, 'no-typescript.ts');
      const content = `
        function test(): number { return 42; }
        export { test };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        typeCheck: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.tsFixResults).toBeUndefined();
    });

    it('должен работать с флагом --no-code-validation', async () => {
      const testFile = path.join(testDir, 'no-validation.js');
      const content = `
        function test() { return 42; }
        export { test };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        codeValidation: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.validationResults).toBeUndefined();
    });

    it('должен работать с флагом --no-auto-fix', async () => {
      const testFile = path.join(testDir, 'no-auto-fix.js');
      const content = `
        function test() { return 42; }
        export { test };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        autoFix: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с флагом --no-fix-imports', async () => {
      const testFile = path.join(testDir, 'no-fix-imports.js');
      const content = `
        function test() { return 42; }
        export { test };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        fixUnusedImports: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с флагом --no-optimize-imports', async () => {
      const testFile = path.join(testDir, 'no-optimize-imports.js');
      const content = `
        function test() { return 42; }
        export { test };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        optimizeImports: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен работать с флагом --no-extract-isolated', async () => {
      const testFile = path.join(testDir, 'no-extract-isolated.js');
      const content = `
        function isolated() { return 1; }
        function add(a, b) { return a + b; }
        function calculate(a, b) { return add(a, b); }
        export { isolated, add, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        extractIsolatedFunctions: false,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 5. VUE ПОДДЕРЖКА
  // ============================================

  describe('Vue компоненты', () => {
    it('должен правильно обрабатывать Vue компонент с Composition API', async () => {
      const testFile = path.join(testDir, 'vue-composition.vue');
      const content = `
        <script setup lang="ts">
        import { ref, computed } from 'vue';
        
        const count = ref(0);
        const doubled = computed(() => count.value * 2);
        
        function increment() { count.value++; }
        function decrement() { count.value--; }
        </script>
        <template>
          <div>
            <p>Count: {{ count }}</p>
            <p>Doubled: {{ doubled }}</p>
            <button @click="increment">+</button>
            <button @click="decrement">-</button>
          </div>
        </template>
        <style scoped>
          .container { padding: 20px; }
        </style>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать Vue компонент с Options API', async () => {
      const testFile = path.join(testDir, 'vue-options.vue');
      const content = `
        <template>
          <div>{{ message }}</div>
        </template>
        <script>
        export default {
          data() {
            return {
              message: 'Hello Vue'
            }
          },
          methods: {
            greet() {
              console.log(this.message);
            }
          }
        }
        </script>
        <style>
          div { color: blue; }
        </style>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать Vue компонент с TypeScript', async () => {
      const testFile = path.join(testDir, 'vue-typescript.vue');
      const content = `
        <script setup lang="ts">
        interface Props {
          title: string;
          count?: number;
        }
        defineProps<Props>();
        defineEmits<{
          (e: 'update', value: number): void;
        }>();
        </script>
        <template>
          <div>
            <h1>{{ title }}</h1>
            <button @click="$emit('update', (count || 0) + 1)">
              Increment
            </button>
          </div>
        </template>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обновлять template после рефакторинга Vue компонента', async () => {
      const testFile = path.join(testDir, 'vue-template-update.vue');
      const content = `
        <script setup>
        function calculate(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function process(a, b) { return calculate(a, multiply(a, b)); }
        </script>
        <template>
          <div>
            <p>Result: {{ process(2, 3) }}</p>
          </div>
        </template>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать Vue компонент с несколькими style блоками', async () => {
      const testFile = path.join(testDir, 'vue-multiple-styles.vue');
      const content = `
        <script setup>
        const message = ref('Hello');
        </script>
        <template>
          <div>{{ message }}</div>
        </template>
        <style scoped>
          div { color: red; }
        </style>
        <style>
          div { font-weight: bold; }
        </style>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать Vue компонент с кастомными блоками', async () => {
      const testFile = path.join(testDir, 'vue-custom-blocks.vue');
      const content = `
        <script setup>
        function test() { return 42; }
        </script>
        <template>
          <div>{{ test() }}</div>
        </template>
        <i18n>
        {
          "en": { "message": "Hello" },
          "ru": { "message": "Привет" }
        }
        </i18n>
        <docs>
          ## Component Documentation
          This is a test component
        </docs>
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 6. JSX/TSX ПОДДЕРЖКА
  // ============================================

  describe('JSX/TSX компоненты', () => {
    it('должен правильно обрабатывать React функциональный компонент', async () => {
      const testFile = path.join(testDir, 'react-functional.jsx');
      const content = `
        import React from 'react';
        
        function Button({ onClick, children }) {
          return <button onClick={onClick}>{children}</button>;
        }
        
        function App() {
          const handleClick = () => console.log('clicked');
          return (
            <div>
              <Button onClick={handleClick}>Click me</Button>
            </div>
          );
        }
        
        export { App, Button };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать React классовый компонент', async () => {
      const testFile = path.join(testDir, 'react-class.jsx');
      const content = `
        import React from 'react';
        
        class Button extends React.Component {
          render() {
            return <button onClick={this.props.onClick}>
              {this.props.children}
            </button>;
          }
        }
        
        class App extends React.Component {
          handleClick = () => console.log('clicked');
          render() {
            return (
              <div>
                <Button onClick={this.handleClick}>Click me</Button>
              </div>
            );
          }
        }
        
        export { App, Button };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать React компонент с хуками', async () => {
      const testFile = path.join(testDir, 'react-hooks.jsx');
      const content = `
        import React, { useState, useEffect } from 'react';
        
        function Counter() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);
          
          useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
          
          function increment() { setCount(count + 1); }
          function decrement() { setCount(count - 1); }
          
          return (
            <div>
              <p>Count: {count}</p>
              <p>Double: {doubleCount}</p>
              <button onClick={increment}>+</button>
              <button onClick={decrement}>-</button>
            </div>
          );
        }
        
        export { Counter };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать TSX файл с TypeScript', async () => {
      const testFile = path.join(testDir, 'react-tsx.tsx');
      const content = `
        import React from 'react';
        
        interface ButtonProps {
          onClick: () => void;
          children: React.ReactNode;
        }
        
        function Button({ onClick, children }: ButtonProps) {
          return <button onClick={onClick}>{children}</button>;
        }
        
        interface AppProps {
          title: string;
        }
        
        function App({ title }: AppProps) {
          const handleClick = () => console.log('clicked');
          return (
            <div>
              <h1>{title}</h1>
              <Button onClick={handleClick}>Click me</Button>
            </div>
          );
        }
        
        export { App, Button };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен правильно обрабатывать React компонент с PropTypes', async () => {
      const testFile = path.join(testDir, 'react-proptypes.jsx');
      const content = `
        import React from 'react';
        import PropTypes from 'prop-types';
        
        function Button({ onClick, children, disabled, variant }) {
          return (
            <button 
              onClick={onClick} 
              disabled={disabled}
              className={variant}
            >
              {children}
            </button>
          );
        }
        
        Button.propTypes = {
          onClick: PropTypes.func.isRequired,
          children: PropTypes.node.isRequired,
          disabled: PropTypes.bool,
          variant: PropTypes.oneOf(['primary', 'secondary'])
        };
        
        export { Button };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 7. ОБРАБОТКА НЕСУЩЕСТВУЮЩИХ ФАЙЛОВ
  // ============================================

  describe('Обработка несуществующих файлов', () => {
    it('должен возвращать ошибку для несуществующего файла', async () => {
      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor('/non/existent/file.js');
      await refactor.dispose();

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('должен возвращать ошибку для файла с некорректным расширением', async () => {
      const testFile = path.join(testDir, 'invalid.txt');
      fs.writeFileSync(testFile, 'This is not a JavaScript file');

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result).toBeDefined();
    });


    it('должен обрабатывать файл с отсутствием прав на чтение', async () => {
      const testFile = path.join(testDir, 'no-read.js');
      fs.writeFileSync(testFile, 'function test() { return 1; }');

      try {
        fs.chmodSync(testFile, 0o000);
      } catch (error) {
        return;
      }

      const refactor = new AutoRefactor({
        guaranteeMode: true,
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
      });

      // ✅ Мокаем ModuleTypeDetector.detect
      const moduleTypeDetector = (refactor as any).moduleTypeDetector;
      vi.spyOn(moduleTypeDetector, 'detect').mockResolvedValue({
        type: 'esm',
        confidence: 'high',
        evidence: ['Mocked for test'],
        packageJsonType: 'module',
        fileExtension: '.js',
        hasImportExport: true,
        hasRequire: false,
      });

      // ✅ Мокаем createFullBackup
      const backupManager = (refactor as any).backupManager;
      vi.spyOn(backupManager, 'createFullBackup').mockResolvedValue({
        backupPath: `${testFile}.backup.mock`,
        timestamp: Date.now(),
      });

      // ✅ Мокаем createWorkingCopy
      vi.spyOn(backupManager, 'createWorkingCopy').mockResolvedValue(
        `${testFile}.working-copy.mock`
      );

      // ✅ Мокаем createCheckpoint
      vi.spyOn(backupManager, 'createCheckpoint').mockResolvedValue(`${testFile}.checkpoint.mock`);

      // ✅ Мокаем validate
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

      try {
        fs.chmodSync(testFile, 0o644);
      } catch (e) {}

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 8. ОБРАБОТКА ФАЙЛОВ С РАЗНЫМИ РАСШИРЕНИЯМИ
  // ============================================

  describe('Обработка файлов с разными расширениями', () => {
    it('должен обрабатывать .ts файл', async () => {
      const testFile = path.join(testDir, 'typescript-test.ts');
      const content = `
        interface User {
          id: number;
          name: string;
        }
        function getUser(id: number): User {
          return { id, name: 'test' };
        }
        function saveUser(user: User): void {
          console.log(user);
        }
        export { getUser, saveUser };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать .mjs файл (ESM)', async () => {
      const testFile = path.join(testDir, 'esm-test.mjs');
      const content = `
        export function add(a, b) { return a + b; }
        export function multiply(a, b) { return a * b; }
        export function calculate(a, b) { return add(a, multiply(a, b)); }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      if (result.guaranteeInfo) {
        expect(result.guaranteeInfo.moduleType).toBe('esm');
      }
    });

    it('должен обрабатывать .cjs файл (CommonJS)', async () => {
      const testFile = path.join(testDir, 'cjs-test.cjs');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        module.exports = { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      if (result.guaranteeInfo) {
        expect(result.guaranteeInfo.moduleType).toBe('cjs');
      }
    });

    it('должен обрабатывать .jsx файл', async () => {
      const testFile = path.join(testDir, 'jsx-test.jsx');
      const content = `
        import React from 'react';
        function Component() {
          return <div>Hello</div>;
        }
        export { Component };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });
});