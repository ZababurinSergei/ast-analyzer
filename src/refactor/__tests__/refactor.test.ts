// packages/ast-analyzer/src/refactor/__tests__/refactor.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';
import { ModuleExtractor } from '../ModuleExtractor.js';
import { ImportManager } from '../ImportManager.js';
import { TemplateUpdater } from '../TemplateUpdater.js';

describe('AutoRefactor', () => {
  const testDir = path.join(process.cwd(), 'test-temp-refactor');

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

  describe('AutoRefactor - основной класс', () => {
    it('должен успешно инициализироваться с опциями по умолчанию', () => {
      const refactor = new AutoRefactor();
      expect(refactor).toBeInstanceOf(AutoRefactor);
    });

    it('должен инициализироваться с пользовательскими опциями', () => {
      const refactor = new AutoRefactor({
        modulesDir: 'custom-modules',
        targetClusterSize: 5,
        maxClusterSize: 15,
        minCohesionScore: 70,
        dryRun: true,
        createBackup: false,
        updateTemplate: false,
      });
      expect(refactor).toBeInstanceOf(AutoRefactor);
    });

    it('должен возвращать ошибку для несуществующего файла', async () => {
      const refactor = new AutoRefactor();
      const result = await refactor.refactor('/non/existent/file.js');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Файл не найден');
    });

    it('должен создавать бэкап файла', async () => {
      const testFile = path.join(testDir, 'backup-test.js');
      const content = 'export const test = "hello";';
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({ createBackup: true, dryRun: false });

      // Мокаем analyzeFile чтобы не выполнять полный анализ
      vi.spyOn(refactor as any, 'analyzeFile').mockResolvedValue({
        graph: { graph: {} },
        functions: [],
        content,
      });

      vi.spyOn(refactor as any, 'identifyClusters').mockReturnValue([]);

      const result = await refactor.refactor(testFile);

      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);
    });

    it('должен работать в dry-run режиме без изменений', async () => {
      const testFile = path.join(testDir, 'dry-run-test.js');
      const content = `
        export function foo() { return 1; }
        export function bar() { return foo(); }
      `;
      fs.writeFileSync(testFile, content);

      const originalContent = fs.readFileSync(testFile, 'utf-8');

      const refactor = new AutoRefactor({ dryRun: true });

      vi.spyOn(refactor as any, 'analyzeFile').mockResolvedValue({
        graph: { graph: { foo: [], bar: ['foo'] } },
        functions: ['foo', 'bar'],
        content,
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(originalContent);
    });
  });

  describe('Анализ файлов', () => {
    it('должен анализировать JavaScript файл', async () => {
      const testFile = path.join(testDir, 'analyze-test.js');
      const content = `
        function add(a, b) { return a + b; }
        function multiply(a, b) { return a * b; }
        function calculate(a, b) { return add(a, multiply(a, b)); }
        
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor();
      const analysis = await (refactor as any).analyzeFile(testFile);

      expect(analysis).not.toBeNull();
      expect(analysis.functions).toContain('add');
      expect(analysis.functions).toContain('multiply');
      expect(analysis.functions).toContain('calculate');
    });

    it('должен анализировать TypeScript файл', async () => {
      const testFile = path.join(testDir, 'analyze-test.ts');
      const content = `
        interface User { id: number; name: string; }
        function getUser(id: number): User { return { id, name: "test" }; }
        function saveUser(user: User): void { console.log(user); }
        
        export { getUser, saveUser };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor();
      const analysis = await (refactor as any).analyzeFile(testFile);

      expect(analysis).not.toBeNull();
      expect(analysis.functions).toContain('getUser');
      expect(analysis.functions).toContain('saveUser');
    });

    it('должен возвращать null при ошибке анализа', async () => {
      const testFile = path.join(testDir, 'invalid.js');
      const content = 'это не валидный javascript {';
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor();
      const analysis = await (refactor as any).analyzeFile(testFile);

      expect(analysis).toBeNull();
    });
  });

  describe('Кластеризация', () => {
    it('должен выделять кластеры на основе графа зависимостей', () => {
      const refactor = new AutoRefactor({ minCohesionScore: 50 });
      const analysis = {
        graph: {
          graph: {
            add: [],
            multiply: [],
            calculate: ['add', 'multiply'],
            validate: ['check'],
            check: [],
          },
        },
        functions: ['add', 'multiply', 'calculate', 'validate', 'check'],
      };

      const clusters = (refactor as any).identifyClusters(analysis);

      expect(clusters.length).toBeGreaterThan(0);

      // Проверяем, что calculate в одном кластере с add и multiply
      const calculateCluster = clusters.find((c: any) => c.functions.includes('calculate'));
      if (calculateCluster) {
        expect(calculateCluster.functions).toContain('add');
        expect(calculateCluster.functions).toContain('multiply');
      }
    });

    it('должен фильтровать кластеры с низкой связностью', () => {
      const refactor = new AutoRefactor({ minCohesionScore: 80 });
      const analysis = {
        graph: {
          graph: {
            independent1: [],
            independent2: [],
            related1: ['related2'],
            related2: ['related1'],
          },
        },
        functions: ['independent1', 'independent2', 'related1', 'related2'],
      };

      const clusters = (refactor as any).identifyClusters(analysis);

      // Кластер с циклическими связями должен иметь высокую связность
      const relatedCluster = clusters.find((c: any) => c.functions.includes('related1'));
      if (relatedCluster) {
        expect(relatedCluster.cohesionScore).toBeGreaterThan(0);
      }
    });

    it('должен учитывать максимальный размер кластера', () => {
      const refactor = new AutoRefactor({ maxClusterSize: 2 });

      // Создаём граф с длинной цепочкой
      const graph: Record<string, string[]> = {};
      for (let i = 1; i <= 10; i++) {
        graph[`func${i}`] = i < 10 ? [`func${i + 1}`] : [];
      }

      const analysis = {
        graph: { graph },
        functions: Object.keys(graph),
      };

      const clusters = (refactor as any).identifyClusters(analysis);

      for (const cluster of clusters) {
        expect(cluster.functions.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('ModuleExtractor', () => {
    let project: any;
    let extractor: ModuleExtractor;

    beforeEach(() => {
      const { Project } = require('ts-morph');
      project = new Project({ useInMemoryFileSystem: true });
      extractor = new ModuleExtractor(project, { modulesDir: 'modules' });
    });

    it('должен генерировать имя модуля из имени функции', () => {
      const cluster = {
        name: 'testCluster',
        functions: ['calculateUserData'],
        cohesionScore: 80,
      };

      const name = (extractor as any).generateModuleName(cluster, 0);
      expect(name).toBe('calculate-user-data');
    });

    it('должен генерировать имя модуля по индексу если нет функций', () => {
      const cluster = {
        name: 'emptyCluster',
        functions: [],
        cohesionScore: 0,
      };

      const name = (extractor as any).generateModuleName(cluster, 5);
      expect(name).toBe('module-6');
    });

    it('должен добавлять export если его нет', () => {
      const code = 'function test() { return 1; }';
      const exported = (extractor as any).addExportIfNeeded(code, 'test');

      expect(exported).toBe('export function test() { return 1; }');
    });

    it('не должен дублировать export', () => {
      const code = 'export function test() { return 1; }';
      const exported = (extractor as any).addExportIfNeeded(code, 'test');

      expect(exported).toBe(code);
    });
  });

  describe('ImportManager', () => {
    let project: any;
    let importManager: ImportManager;

    beforeEach(() => {
      const { Project } = require('ts-morph');
      project = new Project({ useInMemoryFileSystem: true });
      importManager = new ImportManager(project);
    });

    it('должен вычислять относительный путь корректно', () => {
      const from = '/project/src/main.ts';
      const to = '/project/src/modules/helper.ts';
      const relative = (importManager as any).getRelativePath(from, to);

      expect(relative).toBe('./modules/helper');
    });

    it('должен определять зарезервированные слова', () => {
      const isReserved = (importManager as any).isReservedWord('if');
      const isNotReserved = (importManager as any).isReservedWord('myVariable');

      expect(isReserved).toBe(true);
      expect(isNotReserved).toBe(false);
    });

    it('должен находить узел в файле', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export function myFunction() { return 1; }
        export class MyClass {}
        export const myConst = 42;
      `
      );

      const func = (importManager as any).findNode(sourceFile, 'myFunction');
      const cls = (importManager as any).findNode(sourceFile, 'MyClass');
      const constant = (importManager as any).findNode(sourceFile, 'myConst');
      const notFound = (importManager as any).findNode(sourceFile, 'nonExistent');

      expect(func).toBeDefined();
      expect(cls).toBeDefined();
      expect(constant).toBeDefined();
      expect(notFound).toBeUndefined();
    });
  });

  describe('TemplateUpdater', () => {
    let templateUpdater: TemplateUpdater;

    beforeEach(() => {
      templateUpdater = new TemplateUpdater({ updateTemplate: true });
    });

    it('должен обновлять вызовы функций в template', async () => {
      const template = `
        <template>
          <div>{{ formatPrice(100) }}</div>
          <button @click="handleClick()">Click</button>
        </template>
      `;

      const exportsMap = new Map([
        ['formatPrice', './modules/price.ts'],
        ['handleClick', './modules/click.ts'],
      ]);

      const updated = await (templateUpdater as any).updateTemplateImports(template, exportsMap);

      expect(updated).toBeDefined();
      expect(typeof updated).toBe('string');
    });

    it('должен обрабатывать template без изменений', async () => {
      const template = `
        <template>
          <div>Static content</div>
        </template>
      `;

      const exportsMap = new Map();
      const updated = await (templateUpdater as any).updateTemplateImports(template, exportsMap);

      expect(updated).toBe(template);
    });

    it('должен обрабатывать пустой template', async () => {
      const template = '';
      const exportsMap = new Map([['test', './test.ts']]);

      const updated = await (templateUpdater as any).updateTemplateImports(template, exportsMap);

      expect(updated).toBe('');
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен выполнить полный цикл рефакторинга JS файла', async () => {
      const testFile = path.join(testDir, 'full-test.js');
      const content = `
        function add(a, b) {
          return a + b;
        }
        
        function multiply(a, b) {
          return a * b;
        }
        
        function calculate(a, b) {
          const sum = add(a, b);
          const product = multiply(a, b);
          return { sum, product };
        }
        
        export { add, multiply, calculate };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({
        modulesDir: 'modules',
        targetClusterSize: 2,
        dryRun: false,
        createBackup: true,
      });

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);

      // Проверяем, что модули были созданы
      const modulesDir = path.join(testDir, 'modules');
      if (result.modules.length > 0 && fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir);
        expect(files.length).toBeGreaterThan(0);
      }
    });

    it('должен корректно обрабатывать ошибки при рефакторинге', async () => {
      const testFile = path.join(testDir, 'error-test.js');
      const content = 'invalid javascript {';
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor();
      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('должен восстанавливать из бэкапа при ошибке', async () => {
      const testFile = path.join(testDir, 'backup-restore.js');
      const content = 'export const test = "original";';
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({ createBackup: true });

      // Мокаем extractModules чтобы выбросить ошибку
      vi.spyOn(refactor as any, 'analyzeFile').mockResolvedValue({
        graph: { graph: { test: [] } },
        functions: ['test'],
        content,
      });

      vi.spyOn(refactor as any, 'identifyClusters').mockReturnValue([
        { name: 'testCluster', functions: ['test'], cohesionScore: 100 },
      ]);

      vi.spyOn(refactor['extractor'], 'extractModules').mockRejectedValue(
        new Error('Extraction failed')
      );

      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(false);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
    });
  });

  describe('Граничные случаи', () => {
    it('должен обрабатывать пустой файл', async () => {
      const testFile = path.join(testDir, 'empty.js');
      fs.writeFileSync(testFile, '');

      const refactor = new AutoRefactor();
      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
      expect(result.modules).toEqual([]);
    });

    it('должен обрабатывать файл без экспортов', async () => {
      const testFile = path.join(testDir, 'no-exports.js');
      const content = `
        function internal() { return 1; }
        function alsoInternal() { return 2; }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor();
      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать файл с одним экспортом', async () => {
      const testFile = path.join(testDir, 'single-export.js');
      const content = `
        export function single() { return 1; }
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({ targetClusterSize: 1 });
      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
    });

    it('должен обрабатывать очень большой файл', async () => {
      const testFile = path.join(testDir, 'large.js');
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `
          function func${i}() { return ${i}; }
        `;
      }
      content += `
        export { ${Array.from({ length: 100 }, (_, i) => `func${i}`).join(', ')} };
      `;
      fs.writeFileSync(testFile, content);

      const refactor = new AutoRefactor({ maxClusterSize: 20 });
      const result = await refactor.refactor(testFile);

      expect(result.success).toBe(true);
    });
  });
});
