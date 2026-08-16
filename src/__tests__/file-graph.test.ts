// src/__tests__/file-graph.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildFileInternalGraph } from '../modes/file-graph.js';
import path from 'path';
import fs from 'fs';

describe('Режим file-graph', () => {
  const testDir = path.join(process.cwd(), 'test-temp');

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

  const createTestFile = (content: string, filename: string): string => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  describe('buildFileInternalGraph - построение внутреннего графа файла', () => {
    it('должен возвращать null для несуществующего файла', () => {
      const result = buildFileInternalGraph('/non-existent-file.js');
      expect(result).toBeNull();
    });

    it('должен находить зависимости между функциями в файле', () => {
      const testFile = createTestFile(
        `
        function helper() {
          return 42;
        }
        
        function main() {
          return helper();
        }
        
        function unused() {
          return 0;
        }
        `,
        'test-functions.js'
      );

      const result = buildFileInternalGraph(testFile);
      expect(result).not.toBeNull();

      if (result) {
        expect(result.graph['main']).toContain('helper');
        expect(result.graph['unused']).not.toContain('helper');
      }
    });

    it('должен обрабатывать пустой файл', () => {
      const testFile = createTestFile('', 'test-empty.js');
      const result = buildFileInternalGraph(testFile);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.graph).toEqual({});
      }
    });

    it('должен находить зависимости между переменными и функциями', () => {
      const testFile = createTestFile(
        `
        const config = {
          apiUrl: 'https://api.example.com'
        };
        
        function getConfig() {
          return config;
        }
        
        function fetchData() {
          const url = getConfig().apiUrl;
          return url;
        }
        `,
        'test-vars.js'
      );

      const result = buildFileInternalGraph(testFile);

      expect(result).not.toBeNull();
      if (result) {
        // Проверяем зависимости через 1 уровень
        expect(result.graph['getConfig']).toContain('config');
        expect(result.graph['fetchData']).toContain('getConfig');
        // fetchData может использовать config через getConfig
        expect(result.graph['fetchData']).not.toContain('config');
      }
    });

    it('должен обрабатывать классы и методы', () => {
      const testFile = createTestFile(
        `
        class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
          
          multiply(a: number, b: number): number {
            return a * b;
          }
          
          calculate(a: number, b: number): { sum: number; product: number } {
            const sum = this.add(a, b);
            const product = this.multiply(a, b);
            return { sum, product };
          }
        }
        
        const calc = new Calculator();
        `,
        'test-class.ts'
      );

      const result = buildFileInternalGraph(testFile);

      expect(result).not.toBeNull();
      if (result) {
        // Проверяем, что методы класса обнаружены
        expect(Object.keys(result.graph).length).toBeGreaterThan(0);
        expect(result.graph['add']).toBeDefined();
        expect(result.graph['multiply']).toBeDefined();
        expect(result.graph['calculate']).toBeDefined();
      }
    });

    it('не должен создавать ложные зависимости', () => {
      const testFile = createTestFile(
        `
        function independent1() {
          return 1;
        }
        
        function independent2() {
          return 2;
        }
        
        const independent3 = 42;
        `,
        'test-no-deps.js'
      );

      const result = buildFileInternalGraph(testFile);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.graph['independent1'] || []).toHaveLength(0);
        expect(result.graph['independent2'] || []).toHaveLength(0);
      }
    });

    it('должен корректно возвращать rootKey', () => {
      const testFile = createTestFile('const x = 1;', 'test-root.js');
      const result = buildFileInternalGraph(testFile);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.rootKey).toBe('test-root.js');
      }
    });

    it('должен обрабатывать экспорты', () => {
      const testFile = createTestFile(
        `
        export function exportedFunction() {
          return internalHelper();
        }
        
        function internalHelper() {
          return 'helper';
        }
        
        export const exportedConst = 100;
        `,
        'test-exports.ts'
      );

      const result = buildFileInternalGraph(testFile);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.graph['exportedFunction']).toBeDefined();
        expect(result.graph['exportedConst']).toBeDefined();
        if (result.graph['exportedFunction']) {
          expect(result.graph['exportedFunction']).toContain('internalHelper');
        }
      }
    });

    it('должен работать с глубокими вложенными вызовами', () => {
      const testFile = createTestFile(
        `
        function level1() {
          return level2();
        }
        
        function level2() {
          return level3();
        }
        
        function level3() {
          return 'done';
        }
        
        function start() {
          return level1();
        }
        `,
        'test-deep.js'
      );

      const result = buildFileInternalGraph(testFile);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.graph['level1']).toContain('level2');
        expect(result.graph['level2']).toContain('level3');
        expect(result.graph['start']).toContain('level1');
      }
    });
  });
});
