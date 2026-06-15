import { describe, it, expect } from 'vitest';
import { buildFileInternalGraph } from '../modes/file-graph.js';
import path from 'path';
import fs from 'fs';

describe('Режим file-graph', () => {
  describe('buildFileInternalGraph - построение внутреннего графа файла', () => {
    it('должен возвращать null для несуществующего файла', () => {
      const result = buildFileInternalGraph('/non-existent-file.js');
      expect(result).toBe(null);
    });

    it('должен находить зависимости между функциями в файле', () => {
      const testFile = path.join(process.cwd(), 'test-functions.js');
      const testContent = `
        function helper() {
          return 42;
        }
        
        function main() {
          return helper();
        }
        
        function unused() {
          return 0;
        }
      `;

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.graph['main']).toContain('helper');
    });

    it('должен обрабатывать пустой файл', () => {
      const testFile = path.join(process.cwd(), 'test-empty.js');
      const testContent = '';

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.graph).toEqual({});
    });

    it('должен находить зависимости между переменными и функциями', () => {
      const testFile = path.join(process.cwd(), 'test-vars.js');
      const testContent = `
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
      `;

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.graph['getConfig']).toContain('config');
      expect(result?.graph['fetchData']).toContain('getConfig');
    });

    it('должен обрабатывать классы и методы', () => {
      const testFile = path.join(process.cwd(), 'test-class.js');
      const testContent = `
        class Calculator {
          add(a, b) {
            return a + b;
          }
          
          multiply(a, b) {
            return a * b;
          }
          
          calculate(a, b) {
            const sum = this.add(a, b);
            const product = this.multiply(a, b);
            return { sum, product };
          }
        }
        
        const calc = new Calculator();
      `;

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.graph).toBeDefined();
    });

    it('не должен создавать ложные зависимости', () => {
      const testFile = path.join(process.cwd(), 'test-no-deps.js');
      const testContent = `
        function independent1() {
          return 1;
        }
        
        function independent2() {
          return 2;
        }
        
        const independent3 = 42;
      `;

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.graph['independent1'] || []).toHaveLength(0);
      expect(result?.graph['independent2'] || []).toHaveLength(0);
    });

    it('должен корректно возвращать rootKey', () => {
      const testFile = path.join(process.cwd(), 'test-root.js');
      const testContent = 'const x = 1;';
      const fileName = path.basename(testFile);

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.rootKey).toBe(fileName);
    });

    it('должен обрабатывать экспорты', () => {
      const testFile = path.join(process.cwd(), 'test-exports.js');
      const testContent = `
        export function exportedFunction() {
          return internalHelper();
        }
        
        function internalHelper() {
          return 'helper';
        }
        
        export const exportedConst = 100;
      `;

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.graph['exportedFunction']).toContain('internalHelper');
    });

    it('должен работать с глубокими вложенными вызовами', () => {
      const testFile = path.join(process.cwd(), 'test-deep.js');
      const testContent = `
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
      `;

      fs.writeFileSync(testFile, testContent);
      const result = buildFileInternalGraph(testFile);
      fs.unlinkSync(testFile);

      expect(result).not.toBe(null);
      expect(result?.graph['level1']).toContain('level2');
      expect(result?.graph['level2']).toContain('level3');
      expect(result?.graph['start']).toContain('level1');
    });
  });
});
