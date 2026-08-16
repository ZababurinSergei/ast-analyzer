// packages/ast-analyzer/src/__tests__/cli-semantic.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Константа для рабочей директории тестов
const TEST_CWD = process.cwd();

describe('cli-semantic', () => {
  const testDir = path.join(__dirname, 'test-temp-semantic');
  const cliPath = path.join(__dirname, '../cli-semantic.ts');
  const distPath = path.join(__dirname, '../dist/cli-semantic.js');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Явно ждём завершения всех асинхронных операций
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Could not remove test directory:', error);
    }
    vi.restoreAllMocks();
  }, 10000); // Даём время на очистку

  // ============================================
  // ТЕСТЫ КОМАНД
  // ============================================

  describe('analyze command', () => {
    it('should run analyze with files', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test = 1;');

      console.log('📄 Test File:', testFile);

      // Проверяем существование собранного файла
      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'analyze', testFile, '--verbose'], {
        reject: false,
        timeout: 10000,
        cwd: TEST_CWD,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      // ✅ Проверяем что команда выполнилась
      expect(result.exitCode).toBe(0);
    }, 10000);

    it('should handle analyze with no files', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'analyze', '/empty-dir', '--recursive'], {
        reject: false,
        timeout: 5000,
        cwd: TEST_CWD,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      // Команда завершается успешно, даже если файлов нет
      expect(result.exitCode).toBe(0);
    }, 5000);

    it('should handle analyze with formal verification', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test = 1;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa(
        'node',
        [distPath, 'analyze', testFile, '--formal', '--output', testDir, '--format', 'json'],
        {
          cwd: TEST_CWD,
          reject: false,
          timeout: 15000,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 15000);

    it('should handle analyze with critical functions', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'analyze', testFile, '--critical', 'foo'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);
  });

  describe('callgraph command', () => {
    it('should generate callgraph', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'callgraph', testFile, '--max-depth', '3'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);

    // ============================================
    // ИСПРАВЛЕННЫЙ ТЕСТ: should generate callgraph with JSON output
    // ============================================
    it('should generate callgraph with JSON output', async () => {
      // Создаем тестовый файл с функциями для графа вызовов
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export function foo() {
  return 1;
}
export function bar() {
  return foo();
}
export function baz() {
  return bar();
}
`
      );

      console.log('📄 Test File:', testFile);

      // Проверяем существование собранного файла
      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'callgraph', testFile, '--json'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 10000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT length:', result.stdout.length);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);

      // Проверяем, что stdout не пустой и является валидным JSON
      expect(result.stdout.length).toBeGreaterThan(0);

      try {
        const jsonData = JSON.parse(result.stdout);
        expect(jsonData).toHaveProperty('nodes');
        expect(jsonData).toHaveProperty('edges');
        expect(jsonData).toHaveProperty('cycles');
        expect(jsonData).toHaveProperty('stats');
        expect(jsonData).toHaveProperty('timestamp');
        expect(jsonData).toHaveProperty('file');
        // Проверяем, что есть хотя бы один узел
        expect(jsonData.nodes.length).toBeGreaterThan(0);
        // Проверяем, что есть хотя бы одно ребро
        expect(jsonData.edges.length).toBeGreaterThan(0);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
        console.error('📄 Raw output:', result.stdout);
        throw new Error('Output is not valid JSON');
      }
    }, 10000);

    it('should generate callgraph with JSON output and save to file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export function foo() {
  return 1;
}
export function bar() {
  return foo();
}
`
      );

      const outputFile = path.join(testDir, 'output.json');

      console.log('📄 Test File:', testFile);
      console.log('📄 Output File:', outputFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa(
        'node',
        [distPath, 'callgraph', testFile, '--json', '--output', outputFile],
        {
          cwd: TEST_CWD,
          reject: false,
          timeout: 10000,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      console.log('📤 STDOUT:', result.stdout.substring(0, 200));
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(outputFile)).toBe(true);

      const fileContent = fs.readFileSync(outputFile, 'utf-8');
      expect(fileContent.length).toBeGreaterThan(0);

      try {
        const jsonData = JSON.parse(fileContent);
        expect(jsonData).toHaveProperty('nodes');
        expect(jsonData).toHaveProperty('edges');
        // Проверяем, что есть хотя бы один узел
        expect(jsonData.nodes.length).toBeGreaterThan(0);
        // Проверяем, что есть хотя бы одно ребро
        expect(jsonData.edges.length).toBeGreaterThan(0);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON from file:', parseError);
        throw new Error('File content is not valid JSON');
      }
    }, 10000);

    it('should generate callgraph with JSON output for file with no functions', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test = 123;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'callgraph', testFile, '--json'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 10000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT length:', result.stdout.length);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);

      try {
        const jsonData = JSON.parse(result.stdout);
        expect(jsonData).toHaveProperty('nodes');
        expect(jsonData.nodes).toBeInstanceOf(Array);
        // Для файла без функций nodes должен быть пустым массивом
        expect(jsonData.nodes.length).toBe(0);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
        console.error('📄 Raw output:', result.stdout);
        throw new Error('Output is not valid JSON');
      }
    }, 10000);

    it('should generate callgraph with DOT output', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'callgraph', testFile, '--dot'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout.substring(0, 200));
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('digraph CallGraph');
    }, 5000);

    it('should generate callgraph with output file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');
      const outputFile = path.join(testDir, 'output.json');

      console.log('📄 Test File:', testFile);
      console.log('📄 Output File:', outputFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa(
        'node',
        [distPath, 'callgraph', testFile, '--output', outputFile],
        {
          cwd: TEST_CWD,
          reject: false,
          timeout: 5000,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(outputFile)).toBe(true);
    }, 5000);

    it('should handle non-existent file', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'callgraph', '/non-existent.ts'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Файл не найден');
    }, 3000);
  });

  describe('cfg command', () => {
    it('should generate CFG', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'cfg', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);

    it('should generate CFG with JSON output', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'cfg', testFile, '--json'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('"blocks"');
    }, 5000);

    it('should generate CFG with DOT output', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'cfg', testFile, '--dot'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('digraph CFG');
    }, 5000);

    it('should handle non-existent file', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'cfg', '/non-existent.ts'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Файл не найден');
    }, 3000);

    it('should handle CFG with complex function', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
        export function complex(x: number): number {
          if (x > 0) {
            return x + 1;
          } else {
            return x - 1;
          }
        }
      `
      );

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'cfg', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);
  });

  describe('types command', () => {
    it('should analyze types', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test: string = "hello";');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'types', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);

    it('should analyze types with JSON output', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test: string = "hello";');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'types', testFile, '--json'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('"errors"');
    }, 5000);

    it('should analyze types with type errors', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test: string = 123;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'types', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);

    it('should handle non-existent file', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'types', '/non-existent.ts'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Файл не найден');
    }, 3000);
  });

  describe('dataflow command', () => {
    it('should analyze dataflow', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1; const y = x + 1;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dataflow', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);

    it('should analyze dataflow with JSON output', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1; const y = x + 1;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dataflow', testFile, '--json'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('"nodes"');
    }, 5000);

    it('should analyze dataflow with DOT output', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1; const y = x + 1;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dataflow', testFile, '--dot'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('digraph DataFlow');
    }, 5000);

    it('should handle non-existent file', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dataflow', '/non-existent.ts'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Файл не найден');
    }, 3000);

    it('should analyze dataflow with unused variables', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const unused = 1; const used = 2; console.log(used);');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dataflow', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);
  });

  describe('verify command', () => {
    it('should verify function', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        'export function add(a: number, b: number): number { return a + b; }'
      );

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'verify', testFile, '--function', 'add'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);

    it('should verify with contract file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        'export function add(a: number, b: number): number { return a + b; }'
      );
      const contractFile = path.join(testDir, 'contract.json');
      fs.writeFileSync(
        contractFile,
        JSON.stringify({
          name: 'add',
          params: [
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' },
          ],
          returnType: 'int',
          preconditions: [],
          postconditions: [],
          invariants: [],
        })
      );

      console.log('📄 Test File:', testFile);
      console.log('📄 Contract File:', contractFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa(
        'node',
        [distPath, 'verify', testFile, '--contract', contractFile],
        {
          cwd: TEST_CWD,
          reject: false,
          timeout: 5000,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 5000);

    it('should handle missing function', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa(
        'node',
        [distPath, 'verify', testFile, '--function', 'missingFunc'],
        {
          cwd: TEST_CWD,
          reject: false,
          timeout: 3000,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Функция');
    }, 3000);

    it('should handle no function or contract', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'verify', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Укажите --function');
    }, 3000);

    it('should handle non-existent file', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa(
        'node',
        [distPath, 'verify', '/non-existent.ts', '--function', 'foo'],
        {
          cwd: TEST_CWD,
          reject: false,
          timeout: 3000,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Файл не найден');
    }, 3000);

    it('should handle missing contract file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa(
        'node',
        [distPath, 'verify', testFile, '--contract', '/non-existent.json'],
        {
          cwd: TEST_CWD,
          reject: false,
          timeout: 3000,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Контракт не найден');
    }, 3000);
  });

  describe('dead command', () => {
    it('should find dead code', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'function unused() { return 1; } export const used = 2;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dead', testFile, '--recursive'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('unused');
    }, 5000);

    it('should find dead code with JSON output', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'function unused() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dead', testFile, '--json'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('unused');
    }, 5000);

    it('should handle no dead code', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const used = 2;');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dead', testFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Мёртвый код не найден');
    }, 5000);

    it('should handle no files', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dead', '/empty-dir', '--recursive'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      // Команда завершается успешно, даже если файлов нет
      expect(result.exitCode).toBe(0);
    }, 3000);

    it('should handle directory with no supported files', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dead', testDir, '--recursive'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      // Команда завершается успешно, даже если файлов нет
      expect(result.exitCode).toBe(0);
    }, 3000);

    it('should handle dead code with output file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'function unused() { return 1; } export const used = 2;');
      const outputFile = path.join(testDir, 'dead-report.md');

      console.log('📄 Test File:', testFile);
      console.log('📄 Output File:', outputFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'dead', testFile, '--output', outputFile], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(1);
      expect(fs.existsSync(outputFile)).toBe(true);
    }, 5000);
  });

  describe('help command', () => {
    it('should show help', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, '--help'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🔬 Семантический анализ кода');
    }, 3000);

    it('should show help with no args', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🔬 Семантический анализ кода');
    }, 3000);
  });

  describe('version command', () => {
    it('should show version', async () => {
      console.log('📄 Test Dir:', testDir);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, '--version'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 3000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    }, 3000);
  });

  describe('integration tests', () => {
    it('should handle complex TypeScript file', async () => {
      const testFile = path.join(testDir, 'complex.ts');
      fs.writeFileSync(
        testFile,
        `
        interface User {
          id: number;
          name: string;
        }

        function getUser(id: number): User {
          return { id, name: 'test' };
        }

        function processUser(user: User): string {
          return \`\${user.id}: \${user.name}\`;
        }

        export function main(id: number): string {
          const user = getUser(id);
          return processUser(user);
        }
      `
      );

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'analyze', testFile, '--recursive'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 10000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 10000);

    it('should handle JavaScript file', async () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export function foo() { return 1; }');

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'analyze', testFile, '--recursive'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 10000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 10000);

    it('should handle JSX file', async () => {
      const testFile = path.join(testDir, 'test.jsx');
      fs.writeFileSync(
        testFile,
        `
        import React from 'react';
        export function Component() {
          return <div>Hello</div>;
        }
      `
      );

      console.log('📄 Test File:', testFile);

      if (!fs.existsSync(distPath)) {
        console.log('⚠️ dist file not found, skipping test');
        return;
      }

      const result = await execa('node', [distPath, 'analyze', testFile, '--recursive'], {
        cwd: TEST_CWD,
        reject: false,
        timeout: 10000,
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('📤 STDOUT:', result.stdout);
      console.log('📤 STDERR:', result.stderr);
      console.log('📤 Exit Code:', result.exitCode);

      expect(result.exitCode).toBe(0);
    }, 10000);
  });
});
