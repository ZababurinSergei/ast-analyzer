// src/__tests__/minifier.test.ts
import { describe, it, expect } from 'vitest';
import { minifyCodeString } from '../core/minifier.js';
import parser from '@typescript-eslint/parser';

describe('Минификатор', () => {
  describe('minifyCodeString - сжатие строки кода', () => {
    it('должен удалять тела функций', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        
        const multiply = function(x, y) {
          return x * y;
        };
      `;

      const ast = parser.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const minified = minifyCodeString(code, ast);

      expect(minified).toContain('function add(a, b) { /* реализация скрыта */ }');
      expect(minified).toContain('const multiply = function(x, y) { /* реализация скрыта */ };');
      expect(minified).not.toContain('return a + b;');
    });

    it('должен обрабатывать пустое AST дерево', () => {
      const code = 'const x = 42;';
      const minified = minifyCodeString(code, null);
      expect(minified).toBe(code);
    });

    it('должен удалять тела стрелочных функций с блоком', () => {
      const code = `
        const greet = (name) => {
          return \`Hello, \${name}!\`;
        };
      `;

      const ast = parser.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const minified = minifyCodeString(code, ast);

      expect(minified).toContain('const greet = (name) => { /* реализация скрыта */ };');
      expect(minified).not.toContain('Hello');
    });

    it('должен скрывать значения простых переменных', () => {
      const code = `
        const API_URL = 'https://api.example.com';
        const MAX_RETRIES = 3;
        const config = { timeout: 5000 };
      `;

      const ast = parser.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const minified = minifyCodeString(code, ast);

      expect(minified).toContain('const API_URL = /* значение скрыто */');
      expect(minified).toContain('const MAX_RETRIES = /* значение скрыто */');
      expect(minified).toContain('const config = /* значение скрыто */');
      expect(minified).not.toContain('https://api.example.com');
    });

    it('должен сохранять сигнатуры функций (без TypeScript типов)', () => {
      // Используем чистый JavaScript без TypeScript аннотаций
      const code = `
        async function fetchData(url, options) {
          const response = await fetch(url, options);
          return response;
        }
      `;

      const ast = parser.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const minified = minifyCodeString(code, ast);

      // Сигнатура должна сохраниться
      expect(minified).toContain('async function fetchData(url, options)');

      // Тело должно быть скрыто (должен быть комментарий)
      expect(minified).toContain('/* реализация скрыта */');

      // Убеждаемся, что оригинальное тело удалено
      expect(minified).not.toContain('const response = await fetch');
      expect(minified).not.toContain('return response;');
    });

    it('должен удалять лишние пустые строки', () => {
      const code = `
        function foo() {
          return 1;
        }
        
        
        function bar() {
          return 2;
        }
      `;

      const ast = parser.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const minified = minifyCodeString(code, ast);

      // Не должно быть более двух пустых строк подряд
      expect(minified).not.toMatch(/\n{3,}/);
    });

    it('должен корректно обрабатывать методы классов', () => {
      const code = `
        class Calculator {
          add(a, b) {
            return a + b;
          }
          
          multiply(a, b) {
            return a * b;
          }
        }
      `;

      const ast = parser.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const minified = minifyCodeString(code, ast);

      expect(minified).toContain('class Calculator {');
      expect(minified).toContain('add(a, b) { /* реализация скрыта */ }');
      expect(minified).toContain('multiply(a, b) { /* реализация скрыта */ }');
      expect(minified).not.toContain('return a + b;');
      expect(minified).not.toContain('return a * b;');
    });

    it('должен сохранять интерфейсы и типы TypeScript', () => {
      const code = `
        interface User {
          id: number;
          name: string;
        }
        
        type ID = string | number;
      `;

      const ast = parser.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const minified = minifyCodeString(code, ast);

      // Интерфейсы и типы должны сохраниться полностью
      expect(minified).toContain('interface User');
      expect(minified).toContain('id: number');
      expect(minified).toContain('name: string');
      expect(minified).toContain('type ID = string | number');
    });
  });
});
