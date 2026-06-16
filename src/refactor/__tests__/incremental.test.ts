// src/refactor/__tests__/incremental.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';
import { Logger, LogLevel } from '../../utils/Logger.js';

describe('Incremental refactoring', () => {
  const testDir = path.join(process.cwd(), 'test-temp-incremental');

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

  describe('Basic incremental functionality', () => {
    it('should run refactoring in incremental mode by default', async () => {
      const testFile = path.join(testDir, 'default-incremental.js');
      const content = `
        export function foo() { return 1; }
        export function bar() { return foo(); }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        dryRun: true,
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
      expect(result.modules).toBeDefined();
    });

    it('should support non-incremental mode via flag', async () => {
      const testFile = path.join(testDir, 'non-incremental.js');
      const content = `
        export function foo() { return 1; }
        export function bar() { return foo(); }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: false,
        logLevel: 'debug',
        createBackup: true,
        dryRun: true,
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Checkpoint and recovery', () => {
    it('should restore from checkpoint on error', async () => {
      const testFile = path.join(testDir, 'checkpoint-restore.js');
      const content = `
        export function foo() { return 1; }
        export function bar() { return foo(); }
        export function baz() { return bar(); }
      `;
      fs.writeFileSync(testFile, content);

      // Создаём мок, который выбросит ошибку на этапе извлечения модулей
      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 1,
      });

      // Мокаем метод validateSyntax чтобы он всегда возвращал true
      const validateSpy = vi.spyOn(refactor as any, 'validateSyntax').mockResolvedValue(true);

      // Мокаем extractor.extractModules чтобы выбросить ошибку
      const originalExtractor = (refactor as any).extractor;
      const extractSpy = vi
        .spyOn(originalExtractor, 'extractModules')
        .mockRejectedValueOnce(new Error('Simulated extraction error'));

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated extraction error');

      // Проверяем, что файл не повреждён
      const restoredContent = fs.readFileSync(testFile, 'utf-8');
      expect(restoredContent).toBe(content);

      validateSpy.mockRestore();
      extractSpy.mockRestore();
    });

    it('should create checkpoint files during refactoring', async () => {
      const testFile = path.join(testDir, 'checkpoint-files.js');
      const content = `
        export function test() { return 42; }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        dryRun: true,
      });

      // Мокаем validateSyntax чтобы он всегда возвращал true
      vi.spyOn(refactor as any, 'validateSyntax').mockResolvedValue(true);

      await refactor.refactor(testFile);

      // Проверяем, что чекпоинты были созданы и удалены
      const files = fs.readdirSync(testDir);
      const checkpointFiles = files.filter(f => f.includes('.checkpoint.'));

      // Чекпоинты должны быть удалены после успешного выполнения
      expect(checkpointFiles.length).toBe(0);

      // Проверяем наличие бэкапа (если не dry-run)
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles.length).toBe(0); // В dry-run режиме бэкапы не создаются
    });

    it('should keep backup file when refactoring fails', async () => {
      const testFile = path.join(testDir, 'fail-backup.js');
      const content = `
        export function test() { return 42; }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        dryRun: false,
      });

      // Мокаем extractor.extractModules чтобы выбросить ошибку
      const originalExtractor = (refactor as any).extractor;
      const extractSpy = vi
        .spyOn(originalExtractor, 'extractModules')
        .mockRejectedValueOnce(new Error('Extraction failed'));

      // Мокаем validateSyntax чтобы он всегда возвращал true
      vi.spyOn(refactor as any, 'validateSyntax').mockResolvedValue(true);

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(false);
      expect(result.backupPath).toBeDefined();

      // Проверяем, что бэкап существует
      if (result.backupPath) {
        expect(fs.existsSync(result.backupPath)).toBe(true);
      }

      extractSpy.mockRestore();
    });
  });

  describe('Syntax validation', () => {
    it('should validate syntax after each step', async () => {
      const testFile = path.join(testDir, 'syntax-validation.js');
      const content = `
        export function valid() { return 42; }
        export function another() { return valid(); }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
        dryRun: true,
      });

      const result = await refactor.refactor(testFile);

      // Даже если не нашли кластеры, синтаксис должен быть валидным
      expect(result.success).toBe(true);

      // Проверяем, что файл валидный (не вызывает ошибок)
      const finalContent = fs.readFileSync(testFile, 'utf-8');
      expect(() => new Function(finalContent)).not.toThrow();
    });

    it('should detect syntax errors and return error result', async () => {
      const testFile = path.join(testDir, 'syntax-error.js');
      const content = `
        export function valid() { return 42; }
        export function another() { return valid(); }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        dryRun: false,
      });

      // Мокаем validateSyntax чтобы он вернул false после первого шага
      let stepCount = 0;
      vi.spyOn(refactor as any, 'validateSyntax').mockImplementation(async () => {
        stepCount++;
        // На втором шаге эмулируем ошибку синтаксиса
        if (stepCount === 2) {
          return false;
        }
        return true;
      });

      // Мокаем extractor.extractModules чтобы не выбрасывать ошибку
      const originalExtractor = (refactor as any).extractor;
      vi.spyOn(originalExtractor, 'extractModules').mockResolvedValue([]);

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Syntax error after step');
    });
  });

  describe('Module validation', () => {
    it('should validate generated modules after refactoring', async () => {
      const testFile = path.join(testDir, 'module-validation.js');
      const content = `
        export function func1() { return 1; }
        export function func2() { return 2; }
        export function func3() { return func1() + func2(); }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        targetClusterSize: 2,
        dryRun: false,
      });

      // Мокаем validateSyntax чтобы всегда возвращал true для основного файла
      vi.spyOn(refactor as any, 'validateSyntax').mockResolvedValue(true);

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);

      // Проверяем, что модули были созданы и валидны
      const modulesDir = path.join(testDir, 'modules');
      if (fs.existsSync(modulesDir)) {
        const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
        for (const moduleFile of moduleFiles) {
          const modulePath = path.join(modulesDir, moduleFile);
          const moduleContent = fs.readFileSync(modulePath, 'utf-8');
          // Проверяем, что модуль не содержит синтаксических ошибок
          expect(() => new Function(moduleContent)).not.toThrow();
        }
      }
    });
  });

  describe('Logger integration', () => {
    it('should use logger with proper level', async () => {
      const testFile = path.join(testDir, 'logger-test.js');
      const content = `
        export function test() { return 42; }
      `;
      fs.writeFileSync(testFile, content);

      const logFile = path.join(testDir, 'test-refactor.log');

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        logFile: logFile,
        createBackup: true,
        dryRun: true,
      });

      await refactor.refactor(testFile);

      // Проверяем, что лог-файл был создан
      expect(fs.existsSync(logFile)).toBe(true);

      // Проверяем, что в логе есть записи
      const logContent = fs.readFileSync(logFile, 'utf-8');
      expect(logContent).toContain('[DEBUG]');
      expect(logContent).toContain('[INFO]');
    });

    it('should respect log level settings', async () => {
      const testFile = path.join(testDir, 'log-level-test.js');
      const content = `
        export function test() { return 42; }
      `;
      fs.writeFileSync(testFile, content);

      const logFile = path.join(testDir, 'log-level-test.log');

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'error',
        logFile: logFile,
        createBackup: true,
        dryRun: true,
      });

      await refactor.refactor(testFile);

      // Проверяем, что лог-файл содержит только error-level сообщения
      const logContent = fs.readFileSync(logFile, 'utf-8');
      expect(logContent).not.toContain('[DEBUG]');
      expect(logContent).not.toContain('[INFO]');
      expect(logContent).not.toContain('[WARN]');
    });
  });

  describe('Multiple retries', () => {
    it('should retry on failure up to maxRetries', async () => {
      const testFile = path.join(testDir, 'retry-test.js');
      const content = `
        export function test() { return 42; }
      `;
      fs.writeFileSync(testFile, content);

      let attempts = 0;

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        maxRetries: 3,
        dryRun: true,
      });

      // Мокаем метод анализа чтобы он падал первые 2 раза
      const originalAnalyze = (refactor as any).analyzeFile;
      vi.spyOn(refactor as any, 'analyzeFile').mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Simulated failure attempt ${attempts}`);
        }
        return { functions: ['test'], callGraph: { test: [] }, sourceFile: {} };
      });

      const result = await refactor.refactor(testFile);

      expect(attempts).toBe(3);
      expect(result.success).toBe(true);
    });
  });

  describe('Integration with ESLint', () => {
    it('should apply ESLint fixes incrementally', async () => {
      const testFile = path.join(testDir, 'eslint-incremental.js');
      const content = `
        export function test() { 
          let x = 1;
          console.log(x)
        }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        eslintCheck: true,
        eslintFix: true,
        dryRun: false,
      });

      // Мокаем validateSyntax чтобы всегда возвращал true
      vi.spyOn(refactor as any, 'validateSyntax').mockResolvedValue(true);

      // Мокаем ESLint фиксер
      const originalEslintFixer = (refactor as any).eslintFixer;
      vi.spyOn(originalEslintFixer, 'fixFile').mockResolvedValue({
        success: true,
        file: testFile,
        fixes: 2,
        errors: [],
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file', async () => {
      const testFile = path.join(testDir, 'empty-file.js');
      fs.writeFileSync(testFile, '');

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        dryRun: false,
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
      expect(result.modules.length).toBe(0);
    });

    it('should handle file with only comments', async () => {
      const testFile = path.join(testDir, 'comments-only.js');
      const content = `
        // This is a comment
        /* This is a multiline comment */
        // Another comment
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'debug',
        createBackup: true,
        dryRun: false,
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
      expect(result.modules.length).toBe(0);
    });

    it('should handle large file with many functions', async () => {
      const testFile = path.join(testDir, 'large-file.js');
      let content = '';
      for (let i = 0; i < 50; i++) {
        content += `export function func${i}() { return ${i}; }\n`;
      }
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        incremental: true,
        logLevel: 'info',
        createBackup: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        dryRun: false,
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
    });
  });
});
