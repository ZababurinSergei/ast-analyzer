import { describe, it, expect } from 'vitest';
import { escapeHtml, formatFileSize, generateTempId, ensureDirectoryExists } from '../utils.js';
import fs from 'fs';
import path from 'path';

describe('Утилиты', () => {
  describe('escapeHtml - экранирование HTML символов', () => {
    it('должен экранировать специальные HTML символы', () => {
      expect(escapeHtml('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
      expect(escapeHtml('no special chars')).toBe('no special chars');
    });
  });

  describe('formatFileSize - форматирование размера файла', () => {
    it('должен правильно форматировать байты', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
    });
  });

  describe('generateTempId - генерация временного идентификатора', () => {
    it('должен генерировать уникальные ID', () => {
      const id1 = generateTempId();
      const id2 = generateTempId();
      expect(id1).toMatch(/^tmp_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^tmp_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('ensureDirectoryExists - создание директории', () => {
    const testDir = path.join(process.cwd(), 'test-temp-dir');

    it('должен создавать директорию если она не существует', () => {
      if (fs.existsSync(testDir)) {
        fs.rmdirSync(testDir);
      }
      expect(fs.existsSync(testDir)).toBe(false);
      ensureDirectoryExists(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
      fs.rmdirSync(testDir);
    });

    it('не должен падать если директория уже существует', () => {
      ensureDirectoryExists(testDir);
      expect(() => ensureDirectoryExists(testDir)).not.toThrow();
      fs.rmdirSync(testDir);
    });
  });
});
