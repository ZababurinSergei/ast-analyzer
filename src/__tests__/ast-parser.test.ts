import { describe, it, expect, afterEach } from 'vitest';
import { parseFile, isExternalModule } from '../core/ast-parser.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AST Парсер', () => {
  describe('isExternalModule - определение внешнего модуля', () => {
    it('должен определять внешние npm-модули', () => {
      // npm-пакеты без алиасов
      expect(isExternalModule('fs')).toBe(true);
      expect(isExternalModule('express')).toBe(true);
      expect(isExternalModule('lodash')).toBe(true);
    });

    it('должен определять алиасы как внутренние модули', () => {
      // Алиасы не считаются внешними
      expect(isExternalModule('@/components/Button')).toBe(false);
      expect(isExternalModule('@/utils/helpers')).toBe(false);
      expect(isExternalModule('#/types')).toBe(false);
      expect(isExternalModule('~/assets')).toBe(false);
    });

    it('должен определять относительные пути как внутренние', () => {
      expect(isExternalModule('./local-file')).toBe(false);
      expect(isExternalModule('../local-file')).toBe(false);
      expect(isExternalModule('/absolute/path')).toBe(false);
    });
  });

  describe('parseFile - парсинг файла', () => {
    const testFile = path.join(__dirname, 'test-sample.js');

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('должен возвращать null для несуществующего файла', () => {
      const result = parseFile('/non-existent-file.js');
      expect(result).toBe(null);
    });

    it('должен парсить валидный JavaScript файл', () => {
      const testContent = 'export const test = "hello";\nfunction foo() { return "bar"; }';
      fs.writeFileSync(testFile, testContent);
      const result = parseFile(testFile);

      expect(result).not.toBe(null);
      expect(result?.type).toBe('Program');
    });
  });
});
