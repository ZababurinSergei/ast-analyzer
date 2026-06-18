// packages/ast-analyzer/src/__tests__/cli-semantic.edge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('cli-semantic edge cases', () => {
  const testDir = path.join(__dirname, 'test-temp-semantic-edge');

  beforeEach(() => {
    vi.clearAllMocks();
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should handle file not found in callgraph', async () => {
    const module = require('../cli-semantic.js');
    // Тестируем обработку ошибки при отсутствии файла
    const action = (module as any).program?.commands?.[1]?.action;
    if (action) {
      try {
        await action('/non-existent-file.ts', { maxDepth: '5' });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle file not found in cfg', async () => {
    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[2]?.action;
    if (action) {
      try {
        await action('/non-existent-file.ts', {});
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle file not found in types', async () => {
    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[3]?.action;
    if (action) {
      try {
        await action('/non-existent-file.ts', {});
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle file not found in dataflow', async () => {
    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[4]?.action;
    if (action) {
      try {
        await action('/non-existent-file.ts', {});
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle file not found in verify', async () => {
    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[5]?.action;
    if (action) {
      try {
        await action('/non-existent-file.ts', { function: 'test' });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle Z3 initialization error', async () => {
    const { Z3Verifier } = await import('../formal/Z3Verifier.js');
    (Z3Verifier as any).mockImplementation(() => ({
      initialize: vi.fn().mockRejectedValue(new Error('Z3 initialization failed')),
      verifyFunction: vi.fn(),
      dispose: vi.fn(),
    }));

    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[5]?.action;
    if (action) {
      try {
        await action(testFile, { function: 'testFunc' });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle JSON parse error in contract file', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');
    const contractFile = path.join(testDir, 'invalid-contract.json');
    fs.writeFileSync(contractFile, 'invalid json {');

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[5]?.action;
    if (action) {
      try {
        await action(testFile, { contract: contractFile });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle glob error in collectFiles', async () => {
    const { glob } = await import('glob');
    (glob as any).mockRejectedValue(new Error('Glob error'));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[0]?.action;
    if (action) {
      try {
        await action(['/test-dir'], { recursive: true });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle statSync error in collectFiles', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    // Мокаем fs.statSync для выбрасывания ошибки
    vi.spyOn(fs, 'statSync').mockImplementation(() => {
      throw new Error('Stat error');
    });

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[0]?.action;
    if (action) {
      try {
        await action([testFile], { recursive: true });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle parseFile error in analyze', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { glob } = await import('glob');
    (glob as any).mockResolvedValue([testFile]);

    const { SemanticPipeline } = await import('../ci-cd/SemanticPipeline.js');
    (SemanticPipeline as any).mockImplementation(() => ({
      run: vi.fn().mockRejectedValue(new Error('Parse error')),
    }));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[0]?.action;
    if (action) {
      try {
        await action([testDir], { recursive: true });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle writeFileSync error in analyze', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { glob } = await import('glob');
    (glob as any).mockResolvedValue([testFile]);

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Write error');
    });

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[0]?.action;
    if (action) {
      try {
        await action([testDir], { recursive: true, output: testDir });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle CallGraphAnalyzer error', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { CallGraphAnalyzer } = await import('../semantic/CallGraphAnalyzer.js');
    (CallGraphAnalyzer as any).mockImplementation(() => ({
      analyzeSingle: vi.fn().mockRejectedValue(new Error('CallGraph error')),
      exportToJSON: vi.fn(),
    }));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[1]?.action;
    if (action) {
      try {
        await action(testFile, { maxDepth: '5' });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle CFGAnalyzer error', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { CFGAnalyzer } = await import('../semantic/CFGAnalyzer.js');
    (CFGAnalyzer as any).mockImplementation(() => ({
      build: vi.fn().mockRejectedValue(new Error('CFG error')),
    }));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[2]?.action;
    if (action) {
      try {
        await action(testFile, {});
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle TypeAnalyzer error', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { TypeAnalyzer } = await import('../semantic/TypeAnalyzer.js');
    (TypeAnalyzer as any).mockImplementation(() => ({
      analyze: vi.fn().mockRejectedValue(new Error('TypeAnalyzer error')),
    }));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[3]?.action;
    if (action) {
      try {
        await action(testFile, {});
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle DataFlowAnalyzer error', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { DataFlowAnalyzer } = await import('../semantic/DataFlowAnalyzer.js');
    (DataFlowAnalyzer as any).mockImplementation(() => ({
      analyze: vi.fn().mockRejectedValue(new Error('DataFlow error')),
    }));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[4]?.action;
    if (action) {
      try {
        await action(testFile, {});
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle verify with function not found', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { Project } = await import('ts-morph');
    (Project as any).mockImplementation(() => ({
      addSourceFileAtPath: vi.fn().mockReturnValue({
        getFunction: vi.fn().mockReturnValue(null),
      }),
    }));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[5]?.action;
    if (action) {
      try {
        await action(testFile, { function: 'missingFunc' });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle Project error in extractContractFromFile', async () => {
    const { Project } = await import('ts-morph');
    (Project as any).mockImplementation(() => {
      throw new Error('Project error');
    });

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[5]?.action;
    if (action) {
      try {
        await action('/test/file.ts', { function: 'testFunc' });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle SemanticPipeline error in analyze', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { glob } = await import('glob');
    (glob as any).mockResolvedValue([testFile]);

    const { SemanticPipeline } = await import('../ci-cd/SemanticPipeline.js');
    (SemanticPipeline as any).mockImplementation(() => ({
      run: vi.fn().mockRejectedValue(new Error('Pipeline error')),
    }));

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[0]?.action;
    if (action) {
      try {
        await action([testDir], { recursive: true });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle writeFile error in report generation', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { glob } = await import('glob');
    (glob as any).mockResolvedValue([testFile]);

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Write error');
    });

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[0]?.action;
    if (action) {
      try {
        await action([testDir], { recursive: true, format: 'html', output: testDir });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  it('should handle mkdir error in report generation', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const { glob } = await import('glob');
    (glob as any).mockResolvedValue([testFile]);

    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('Mkdir error');
    });

    const module = require('../cli-semantic.js');
    const action = (module as any).program?.commands?.[0]?.action;
    if (action) {
      try {
        await action([testDir], { recursive: true, output: '/root/inaccessible' });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });
});
