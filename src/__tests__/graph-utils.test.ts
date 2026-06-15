import { describe, it, expect } from 'vitest';
import { findCyclicEdges, convertToDOT } from '../core/graph-utils.js';

describe('Графовые утилиты', () => {
  describe('findCyclicEdges - поиск циклических зависимостей', () => {
    it('должен находить простой цикл из 3 узлов', () => {
      const graph: Record<string, string[]> = {
        a: ['b'],
        b: ['c'],
        c: ['a'],
      };

      const cycles = findCyclicEdges(graph);

      expect(cycles.size).toBe(3);
      expect(cycles.has('a->b')).toBe(true);
      expect(cycles.has('b->c')).toBe(true);
      expect(cycles.has('c->a')).toBe(true);
    });

    it('должен находить простой цикл из 2 узлов', () => {
      const graph: Record<string, string[]> = {
        x: ['y'],
        y: ['x'],
      };

      const cycles = findCyclicEdges(graph);

      expect(cycles.size).toBe(2);
      expect(cycles.has('x->y')).toBe(true);
      expect(cycles.has('y->x')).toBe(true);
    });

    it('не должен находить циклы в ациклическом графе', () => {
      const graph: Record<string, string[]> = {
        a: ['b', 'c'],
        b: ['d'],
        c: ['d'],
        d: [],
      };

      const cycles = findCyclicEdges(graph);
      expect(cycles.size).toBe(0);
    });

    it('должен находить цикл с самоссылкой', () => {
      const graph: Record<string, string[]> = {
        self: ['self'],
      };

      const cycles = findCyclicEdges(graph);
      expect(cycles.size).toBe(1);
      expect(cycles.has('self->self')).toBe(true);
    });
  });

  describe('convertToDOT - конвертация в формат DOT', () => {
    it('должен генерировать валидный DOT формат для простого графа', () => {
      const graphData = {
        rootKey: 'index.ts',
        graph: {
          'index.ts': ['utils.ts'],
          'utils.ts': [],
        },
      };

      const cycles: Set<string> = new Set();
      const dot = convertToDOT(graphData, cycles);

      expect(dot).toContain('digraph "Dependency Graph"');
      expect(dot).toContain('rankdir=LR');
      expect(dot).toContain('"index.ts" -> "utils.ts"');
      expect(dot).toContain('⭐ index.ts');
    });

    it('должен подсвечивать циклические зависимости красным', () => {
      const graphData = {
        rootKey: 'a.ts',
        graph: {
          'a.ts': ['b.ts'],
          'b.ts': ['a.ts'],
        },
      };

      const cycles: Set<string> = new Set(['a.ts->b.ts', 'b.ts->a.ts']);
      const dot = convertToDOT(graphData, cycles);

      expect(dot).toContain('color="#ef4444"');
      expect(dot).toContain('style="dashed"');
      expect(dot).toContain('label="цикл"');
    });

    it('должен правильно обрабатывать пустой граф', () => {
      const graphData = {
        rootKey: 'empty.ts',
        graph: {},
      };

      const cycles: Set<string> = new Set();
      const dot = convertToDOT(graphData, cycles);

      expect(dot).toContain('digraph "Dependency Graph"');
      expect(dot).toContain('⭐ empty.ts');
      expect(dot).toContain('}');
    });

    it('должен экранировать специальные символы в именах узлов', () => {
      const graphData = {
        rootKey: 'my-file.ts',
        graph: {
          'my-file.ts': ['@scope/package'],
          '@scope/package': [],
        },
      };

      const cycles: Set<string> = new Set();
      const dot = convertToDOT(graphData, cycles);

      expect(dot).toContain('"my-file.ts"');
      expect(dot).toContain('"@scope/package"');
    });
  });
});
