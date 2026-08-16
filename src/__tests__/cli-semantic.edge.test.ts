// packages/ast-analyzer/src/__tests__/cli-semantic.edge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { program, exitWithCode } from '../cli-semantic.js';
import { Z3Verifier } from '../formal/Z3Verifier.js';
import { glob } from 'glob';
import { Project } from 'ts-morph';
import { SemanticPipeline } from '../ci-cd/SemanticPipeline.js';
import { CallGraphAnalyzer } from '../semantic/CallGraphAnalyzer.js';
import { CFGAnalyzer } from '../semantic/CFGAnalyzer.js';
import { TypeAnalyzer } from '../semantic/TypeAnalyzer.js';
import { DataFlowAnalyzer } from '../semantic/DataFlowAnalyzer.js';

// ============================================
// ИСПРАВЛЕНИЕ 1: Правильное мокирование glob через vi.mock
// ============================================
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

// ============================================
// ИСПРАВЛЕНИЕ 2: Мок для SemanticPipeline
// ============================================
vi.mock('../ci-cd/SemanticPipeline.js', () => ({
  SemanticPipeline: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      success: true,
      metrics: {
        totalFiles: 1,
        totalFunctions: 0,
        unusedFunctions: 0,
        unusedVariables: 0,
        potentialBugs: 0,
        verifiedFunctions: 0,
        cyclomaticComplexity: 0,
        dataFlowIssues: 0,
        typeErrors: 0,
        cyclicDependencies: 0,
        unreachableBlocks: 0,
      },
      issues: [],
      verificationResults: [],
      timestamp: new Date().toISOString(),
      duration: 100,
    }),
  })),
}));

// ============================================
// ИСПРАВЛЕНИЕ 3: Мок для Z3Verifier
// ============================================
vi.mock('../formal/Z3Verifier.js', () => ({
  Z3Verifier: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    verifyFunction: vi.fn().mockResolvedValue({ isValid: true, time: 100 }),
    dispose: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ============================================
// ИСПРАВЛЕНИЕ 4: Моки для остальных классов
// ============================================
vi.mock('../semantic/CallGraphAnalyzer.js', () => ({
  CallGraphAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeSingle: vi.fn().mockResolvedValue({
      nodes: new Map(),
      edges: [],
      entryPoints: [],
      cycles: [],
      findUnusedFunctions: () => [],
      findCyclicDependencies: () => [],
    }),
    exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
  })),
}));

vi.mock('../semantic/CFGAnalyzer.js', () => ({
  CFGAnalyzer: vi.fn().mockImplementation(() => ({
    build: vi.fn().mockReturnValue({
      blocks: [],
      findUnreachableBlocks: () => [],
      findLoops: () => [],
      getDominators: () => new Set(),
    }),
  })),
}));

vi.mock('../semantic/TypeAnalyzer.js', () => ({
  TypeAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockReturnValue({
      findTypeErrors: () => [],
    }),
  })),
}));

vi.mock('../semantic/DataFlowAnalyzer.js', () => ({
  DataFlowAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockReturnValue({
      findUnusedVariables: () => [],
      findReassignedConstants: () => [],
    }),
  })),
}));

vi.mock('ts-morph', () => ({
  Project: vi.fn().mockImplementation(() => ({
    addSourceFileAtPath: vi.fn().mockReturnValue({
      getFunction: vi.fn().mockReturnValue(null),
      getFilePath: vi.fn().mockReturnValue('test.ts'),
      getText: vi.fn().mockReturnValue(''),
    }),
  })),
  SyntaxKind: {},
  Node: {
    isFunctionDeclaration: vi.fn().mockReturnValue(false),
  },
}));

// Устанавливаем NODE_ENV для тестов
process.env.NODE_ENV = 'test';

describe('cli-semantic - проверка краевых случаев', () => {
  const testDir = path.join(__dirname, 'test-temp-semantic-edge');
  let originalExit: typeof process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Сохраняем оригинальный process.exit
    originalExit = process.exit;
    // Переопределяем process.exit для тестов
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as any;

    // Убеждаемся, что NODE_ENV установлен в 'test'
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Восстанавливаем оригинальный process.exit
    if (originalExit) {
      process.exit = originalExit;
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
    // Восстанавливаем NODE_ENV
    process.env.NODE_ENV = 'test';
  });

  // ============================================
  // ИСПРАВЛЕНИЕ 5: Улучшенная функция для выполнения команд через parseAsync
  // ============================================
  const runCommand = async (args: string[]): Promise<void> => {
    // Сохраняем оригинальный process.argv
    const originalArgv = process.argv;

    // Подменяем аргументы
    process.argv = ['node', 'cli-semantic', ...args];

    try {
      await program.parseAsync(process.argv);
    } finally {
      // Восстанавливаем process.argv
      process.argv = originalArgv;
    }
  };

  // ============================================
  // ИСПРАВЛЕНИЕ 6: Вспомогательная функция для проверки ошибок
  // ============================================
  const expectCommandToThrow = async (args: string[], expectedCode = 1) => {
    let caught = false;
    let errorMessage = '';

    try {
      await runCommand(args);
    } catch (error: any) {
      caught = true;
      errorMessage = error.message || String(error);
      // Проверяем, что ошибка содержит правильный код
      expect(errorMessage).toContain(`process.exit called with code ${expectedCode}`);
    }

    // Если ошибка не была поймана, проверяем что process.exit был вызван
    if (!caught) {
      expect(process.exit).toHaveBeenCalledWith(expectedCode);
    }
  };

  // ============================================
  // ТЕСТЫ
  // ============================================

  it('должен обрабатывать ошибку "файл не найден" в команде callgraph', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.ts');
    await expectCommandToThrow(['callgraph', nonExistentFile, '--max-depth', '5']);
  });

  it('должен обрабатывать ошибку "файл не найден" в команде cfg', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.ts');
    await expectCommandToThrow(['cfg', nonExistentFile]);
  });

  it('должен обрабатывать ошибку "файл не найден" в команде types', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.ts');
    await expectCommandToThrow(['types', nonExistentFile]);
  });

  it('должен обрабатывать ошибку "файл не найден" в команде dataflow', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.ts');
    await expectCommandToThrow(['dataflow', nonExistentFile]);
  });

  it('должен обрабатывать ошибку "файл не найден" в команде verify', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.ts');
    await expectCommandToThrow(['verify', nonExistentFile, '--function', 'test']);
  });

  it('должен обрабатывать ошибку инициализации Z3', async () => {
    // Создаем временный файл
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockZ3Verifier = vi.mocked(Z3Verifier);
    // Сохраняем оригинальную реализацию
    const OriginalZ3Verifier = Z3Verifier;

    try {
      // Заменяем конструктор для теста
      (Z3Verifier as any).mockImplementationOnce(() => ({
        initialize: vi.fn().mockRejectedValue(new Error('Z3 initialization failed')),
        verifyFunction: vi.fn(),
        dispose: vi.fn(),
      }));

      await expectCommandToThrow(['verify', testFile, '--function', 'testFunc']);
    } finally {
      // Восстанавливаем оригинальный конструктор
      (Z3Verifier as any).mockImplementation(OriginalZ3Verifier);
    }
  });

  it('должен обрабатывать ошибку парсинга JSON в файле контракта', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');
    const contractFile = path.join(testDir, 'invalid-contract.json');
    fs.writeFileSync(contractFile, 'invalid json {');

    await expectCommandToThrow(['verify', testFile, '--contract', contractFile]);
  });

  it('должен обрабатывать ошибку glob при сборе файлов', async () => {
    const mockGlob = vi.mocked(glob);
    mockGlob.mockRejectedValue(new Error('Glob error'));

    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    await expectCommandToThrow(['analyze', testFile, '--recursive']);
  });

  it('должен обрабатывать ошибку statSync при сборе файлов', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    // Мокаем statSync для выбрасывания ошибки
    vi.spyOn(fs, 'statSync').mockImplementation(() => {
      throw new Error('Stat error');
    });

    await expectCommandToThrow(['analyze', testFile, '--recursive']);
  });

  it('должен обрабатывать ошибку parseFile при анализе', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    // Мокаем glob для возврата файла
    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    // Мокаем SemanticPipeline для выбрасывания ошибки
    const mockSemanticPipeline = vi.mocked(SemanticPipeline);
    const originalSemanticPipeline = SemanticPipeline;

    try {
      (SemanticPipeline as any).mockImplementationOnce(() => ({
        run: vi.fn().mockRejectedValue(new Error('Parse error')),
      }));

      await expectCommandToThrow(['analyze', testDir, '--recursive']);
    } finally {
      (SemanticPipeline as any).mockImplementation(originalSemanticPipeline);
    }
  });

  it('должен обрабатывать ошибку writeFileSync при анализе', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Write error');
    });

    await expectCommandToThrow(['analyze', testDir, '--recursive', '--output', testDir]);
  });

  it('должен обрабатывать ошибку CallGraphAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockCallGraphAnalyzer = vi.mocked(CallGraphAnalyzer);
    const originalCallGraphAnalyzer = CallGraphAnalyzer;

    try {
      (CallGraphAnalyzer as any).mockImplementationOnce(() => ({
        analyzeSingle: vi.fn().mockRejectedValue(new Error('CallGraph error')),
        exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
      }));

      await expectCommandToThrow(['callgraph', testFile, '--max-depth', '5']);
    } finally {
      (CallGraphAnalyzer as any).mockImplementation(originalCallGraphAnalyzer);
    }
  });

  it('должен обрабатывать ошибку CFGAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockCFGAnalyzer = vi.mocked(CFGAnalyzer);
    const originalCFGAnalyzer = CFGAnalyzer;

    try {
      (CFGAnalyzer as any).mockImplementationOnce(() => ({
        build: vi.fn().mockImplementation(() => {
          throw new Error('CFG error');
        }),
      }));

      await expectCommandToThrow(['cfg', testFile]);
    } finally {
      (CFGAnalyzer as any).mockImplementation(originalCFGAnalyzer);
    }
  });

  it('должен обрабатывать ошибку TypeAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockTypeAnalyzer = vi.mocked(TypeAnalyzer);
    const originalTypeAnalyzer = TypeAnalyzer;

    try {
      (TypeAnalyzer as any).mockImplementationOnce(() => ({
        analyze: vi.fn().mockImplementation(() => {
          throw new Error('TypeAnalyzer error');
        }),
      }));

      await expectCommandToThrow(['types', testFile]);
    } finally {
      (TypeAnalyzer as any).mockImplementation(originalTypeAnalyzer);
    }
  });

  it('должен обрабатывать ошибку DataFlowAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockDataFlowAnalyzer = vi.mocked(DataFlowAnalyzer);
    const originalDataFlowAnalyzer = DataFlowAnalyzer;

    try {
      (DataFlowAnalyzer as any).mockImplementationOnce(() => ({
        analyze: vi.fn().mockImplementation(() => {
          throw new Error('DataFlow error');
        }),
      }));

      await expectCommandToThrow(['dataflow', testFile]);
    } finally {
      (DataFlowAnalyzer as any).mockImplementation(originalDataFlowAnalyzer);
    }
  });

  it('должен обрабатывать ситуацию, когда функция не найдена в команде verify', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockProject = vi.mocked(Project);
    const originalProject = Project;

    try {
      (Project as any).mockImplementationOnce(() => ({
        addSourceFileAtPath: vi.fn().mockReturnValue({
          getFunction: vi.fn().mockReturnValue(null),
          getFilePath: vi.fn().mockReturnValue(testFile),
          getText: vi.fn().mockReturnValue(''),
        }),
      }));

      await expectCommandToThrow(['verify', testFile, '--function', 'missingFunc']);
    } finally {
      (Project as any).mockImplementation(originalProject);
    }
  });

  it('должен обрабатывать ошибку Project в extractContractFromFile', async () => {
    const mockProject = vi.mocked(Project);
    const originalProject = Project;

    try {
      (Project as any).mockImplementationOnce(() => {
        throw new Error('Project error');
      });

      await expectCommandToThrow(['verify', '/test/file.ts', '--function', 'testFunc']);
    } finally {
      (Project as any).mockImplementation(originalProject);
    }
  });

  it('должен обрабатывать ошибку SemanticPipeline при анализе', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    const mockSemanticPipeline = vi.mocked(SemanticPipeline);
    const originalSemanticPipeline = SemanticPipeline;

    try {
      (SemanticPipeline as any).mockImplementationOnce(() => ({
        run: vi.fn().mockRejectedValue(new Error('Pipeline error')),
      }));

      await expectCommandToThrow(['analyze', testDir, '--recursive']);
    } finally {
      (SemanticPipeline as any).mockImplementation(originalSemanticPipeline);
    }
  });

  it('должен обрабатывать ошибку writeFile при генерации отчета', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Write error');
    });

    await expectCommandToThrow([
      'analyze',
      testDir,
      '--recursive',
      '--format',
      'html',
      '--output',
      testDir,
    ]);
  });

  it('должен обрабатывать ошибку mkdir при генерации отчета', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('Mkdir error');
    });

    await expectCommandToThrow([
      'analyze',
      testDir,
      '--recursive',
      '--output',
      '/root/inaccessible',
    ]);
  });

  it('должен завершаться успешно при анализе корректного файла', async () => {
    const testFile = path.join(testDir, 'valid-test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    const mockSemanticPipeline = vi.mocked(SemanticPipeline);
    const originalSemanticPipeline = SemanticPipeline;

    try {
      (SemanticPipeline as any).mockImplementationOnce(() => ({
        run: vi.fn().mockResolvedValue({
          success: true,
          metrics: {
            totalFiles: 1,
            totalFunctions: 0,
            unusedFunctions: 0,
            unusedVariables: 0,
            potentialBugs: 0,
            verifiedFunctions: 0,
            cyclomaticComplexity: 0,
            dataFlowIssues: 0,
            typeErrors: 0,
            cyclicDependencies: 0,
            unreachableBlocks: 0,
          },
          issues: [],
          verificationResults: [],
          timestamp: new Date().toISOString(),
          duration: 100,
        }),
      }));

      // Сохраняем оригинальный process.exit для этого теста
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await runCommand(['analyze', testDir, '--recursive']);

      expect(exitSpy).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    } finally {
      (SemanticPipeline as any).mockImplementation(originalSemanticPipeline);
    }
  });

  it('должен обрабатывать ошибку "файл не найден" в команде dead', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.ts');
    await expectCommandToThrow(['dead', nonExistentFile, '--recursive']);
  });

  it('должен обрабатывать ситуацию, когда файлы не найдены в команде dead', async () => {
    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([]);

    const emptyDir = path.join(testDir, 'empty-dir');
    if (!fs.existsSync(emptyDir)) {
      fs.mkdirSync(emptyDir, { recursive: true });
    }

    await expectCommandToThrow(['dead', emptyDir, '--recursive']);
  });

  it('должен обрабатывать ситуацию, когда не указаны --function или --contract в команде verify', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    await expectCommandToThrow(['verify', testFile]);
  });

  it('должен обрабатывать команду analyze с критическими функциями', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function criticalFunc() { return 1; }');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    const mockSemanticPipeline = vi.mocked(SemanticPipeline);
    const originalSemanticPipeline = SemanticPipeline;

    try {
      (SemanticPipeline as any).mockImplementationOnce(() => ({
        run: vi.fn().mockResolvedValue({
          success: true,
          metrics: {
            totalFiles: 1,
            totalFunctions: 1,
            unusedFunctions: 0,
            unusedVariables: 0,
            potentialBugs: 0,
            verifiedFunctions: 0,
            cyclomaticComplexity: 0,
            dataFlowIssues: 0,
            typeErrors: 0,
            cyclicDependencies: 0,
            unreachableBlocks: 0,
          },
          issues: [],
          verificationResults: [],
          timestamp: new Date().toISOString(),
          duration: 100,
        }),
      }));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await runCommand(['analyze', testDir, '--recursive', '--critical', 'criticalFunc']);

      expect(exitSpy).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    } finally {
      (SemanticPipeline as any).mockImplementation(originalSemanticPipeline);
    }
  });

  it('должен корректно обрабатывать команду callgraph с опцией output', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');
    const outputFile = path.join(testDir, 'output.json');

    const mockCallGraphAnalyzer = vi.mocked(CallGraphAnalyzer);
    const originalCallGraphAnalyzer = CallGraphAnalyzer;

    try {
      const mockAnalyzeSingle = vi.fn().mockResolvedValue({
        nodes: new Map(),
        edges: [],
        entryPoints: [],
        cycles: [],
        findUnusedFunctions: () => [],
        findCyclicDependencies: () => [],
      });

      (CallGraphAnalyzer as any).mockImplementationOnce(() => ({
        analyzeSingle: mockAnalyzeSingle,
        exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
      }));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await runCommand(['callgraph', testFile, '--max-depth', '5', '--output', outputFile]);

      expect(exitSpy).not.toHaveBeenCalled();
      expect(mockAnalyzeSingle).toHaveBeenCalled();
      exitSpy.mockRestore();
    } finally {
      (CallGraphAnalyzer as any).mockImplementation(originalCallGraphAnalyzer);
    }
  });

  it('должен обрабатывать ошибку в команде callgraph с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockCallGraphAnalyzer = vi.mocked(CallGraphAnalyzer);
    const originalCallGraphAnalyzer = CallGraphAnalyzer;

    try {
      (CallGraphAnalyzer as any).mockImplementationOnce(() => ({
        analyzeSingle: vi.fn().mockRejectedValue(new Error('Invalid file error')),
        exportToJSON: vi.fn(),
      }));

      await expectCommandToThrow(['callgraph', testFile, '--max-depth', '5']);
    } finally {
      (CallGraphAnalyzer as any).mockImplementation(originalCallGraphAnalyzer);
    }
  });

  it('должен обрабатывать ошибку в команде cfg с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockCFGAnalyzer = vi.mocked(CFGAnalyzer);
    const originalCFGAnalyzer = CFGAnalyzer;

    try {
      (CFGAnalyzer as any).mockImplementationOnce(() => ({
        build: vi.fn().mockImplementation(() => {
          throw new Error('Invalid CFG error');
        }),
      }));

      await expectCommandToThrow(['cfg', testFile]);
    } finally {
      (CFGAnalyzer as any).mockImplementation(originalCFGAnalyzer);
    }
  });

  it('должен обрабатывать ошибку в команде types с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockTypeAnalyzer = vi.mocked(TypeAnalyzer);
    const originalTypeAnalyzer = TypeAnalyzer;

    try {
      (TypeAnalyzer as any).mockImplementationOnce(() => ({
        analyze: vi.fn().mockImplementation(() => {
          throw new Error('Invalid Type error');
        }),
      }));

      await expectCommandToThrow(['types', testFile]);
    } finally {
      (TypeAnalyzer as any).mockImplementation(originalTypeAnalyzer);
    }
  });

  it('должен обрабатывать ошибку в команде dataflow с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockDataFlowAnalyzer = vi.mocked(DataFlowAnalyzer);
    const originalDataFlowAnalyzer = DataFlowAnalyzer;

    try {
      (DataFlowAnalyzer as any).mockImplementationOnce(() => ({
        analyze: vi.fn().mockImplementation(() => {
          throw new Error('Invalid DataFlow error');
        }),
      }));

      await expectCommandToThrow(['dataflow', testFile]);
    } finally {
      (DataFlowAnalyzer as any).mockImplementation(originalDataFlowAnalyzer);
    }
  });

  it('должен обрабатывать ошибку в команде verify с некорректным контрактом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');
    const contractFile = path.join(testDir, 'invalid.json');
    fs.writeFileSync(contractFile, '{"invalid": true}');

    const mockZ3Verifier = vi.mocked(Z3Verifier);
    const originalZ3Verifier = Z3Verifier;

    try {
      (Z3Verifier as any).mockImplementationOnce(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        verifyFunction: vi.fn().mockRejectedValue(new Error('Contract validation error')),
        dispose: vi.fn().mockResolvedValue(undefined),
      }));

      await expectCommandToThrow(['verify', testFile, '--contract', contractFile]);
    } finally {
      (Z3Verifier as any).mockImplementation(originalZ3Verifier);
    }
  });

  it('должен выбрасывать исключение при вызове exitWithCode в тестовой среде', () => {
    expect(() => exitWithCode(1)).toThrow('process.exit called with code 1');
    expect(() => exitWithCode(0)).toThrow('process.exit called with code 0');
  });

  it('должен обрабатывать ошибку DataFlowAnalyzer в команде dead', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    const mockDataFlowAnalyzer = vi.mocked(DataFlowAnalyzer);
    const originalDataFlowAnalyzer = DataFlowAnalyzer;

    try {
      (DataFlowAnalyzer as any).mockImplementationOnce(() => ({
        analyze: vi.fn().mockImplementation(() => {
          throw new Error('DataFlow error in dead command');
        }),
      }));

      // Команда dead должна обработать ошибку и не выбросить исключение
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await runCommand(['dead', testDir, '--recursive']);

      expect(exitSpy).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    } finally {
      (DataFlowAnalyzer as any).mockImplementation(originalDataFlowAnalyzer);
    }
  });

  it('должен обрабатывать команду analyze с формальной верификацией', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockGlob = vi.mocked(glob);
    mockGlob.mockResolvedValue([testFile]);

    const mockSemanticPipeline = vi.mocked(SemanticPipeline);
    const originalSemanticPipeline = SemanticPipeline;

    try {
      (SemanticPipeline as any).mockImplementationOnce(() => ({
        run: vi.fn().mockResolvedValue({
          success: true,
          metrics: {
            totalFiles: 1,
            totalFunctions: 1,
            unusedFunctions: 0,
            unusedVariables: 0,
            potentialBugs: 0,
            verifiedFunctions: 1,
            cyclomaticComplexity: 0,
            dataFlowIssues: 0,
            typeErrors: 0,
            cyclicDependencies: 0,
            unreachableBlocks: 0,
          },
          issues: [],
          verificationResults: [{ isValid: true, functionName: 'testFunc', time: 100 }],
          timestamp: new Date().toISOString(),
          duration: 100,
        }),
      }));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await runCommand(['analyze', testDir, '--recursive', '--formal']);

      expect(exitSpy).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    } finally {
      (SemanticPipeline as any).mockImplementation(originalSemanticPipeline);
    }
  });

  it('должен корректно обрабатывать команду callgraph с опцией json', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockCallGraphAnalyzer = vi.mocked(CallGraphAnalyzer);
    const originalCallGraphAnalyzer = CallGraphAnalyzer;

    try {
      const mockAnalyzeSingle = vi.fn().mockResolvedValue({
        nodes: new Map(),
        edges: [],
        entryPoints: [],
        cycles: [],
        findUnusedFunctions: () => [],
        findCyclicDependencies: () => [],
      });

      (CallGraphAnalyzer as any).mockImplementationOnce(() => ({
        analyzeSingle: mockAnalyzeSingle,
        exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
      }));

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await runCommand(['callgraph', testFile, '--max-depth', '5', '--json']);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      exitSpy.mockRestore();
    } finally {
      (CallGraphAnalyzer as any).mockImplementation(originalCallGraphAnalyzer);
    }
  });

  it('должен корректно обрабатывать команду callgraph с опцией dot', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockCallGraphAnalyzer = vi.mocked(CallGraphAnalyzer);
    const originalCallGraphAnalyzer = CallGraphAnalyzer;

    try {
      const mockAnalyzeSingle = vi.fn().mockResolvedValue({
        nodes: new Map(),
        edges: [],
        entryPoints: [],
        cycles: [],
        findUnusedFunctions: () => [],
        findCyclicDependencies: () => [],
      });

      (CallGraphAnalyzer as any).mockImplementationOnce(() => ({
        analyzeSingle: mockAnalyzeSingle,
        exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
      }));

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await runCommand(['callgraph', testFile, '--max-depth', '5', '--dot']);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      exitSpy.mockRestore();
    } finally {
      (CallGraphAnalyzer as any).mockImplementation(originalCallGraphAnalyzer);
    }
  });
});
