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
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СОЗДАНИЯ МОКОВ
// ============================================

/**
 * Создает класс-мок, который возвращает переданную реализацию
 */
function mockClass(implementation: () => any) {
  return function () {
    return implementation();
  } as any;
}

/**
 * Создает мок для SemanticPipeline
 */
function createSemanticPipelineMock(options?: { shouldFail?: boolean; errorMessage?: string }) {
  const runMock = vi.fn();
  if (options?.shouldFail) {
    runMock.mockRejectedValue(new Error(options.errorMessage || 'Pipeline error'));
  } else {
    runMock.mockResolvedValue({
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
    });
  }
  return {
    run: runMock,
  };
}

/**
 * Создает мок для CallGraphAnalyzer
 */
function createCallGraphAnalyzerMock(options?: { shouldFail?: boolean }) {
  const analyzeSingle = vi.fn();
  if (options?.shouldFail) {
    analyzeSingle.mockRejectedValue(new Error('CallGraph error'));
  } else {
    analyzeSingle.mockResolvedValue({
      nodes: new Map(),
      edges: [],
      entryPoints: [],
      cycles: [],
      findUnusedFunctions: () => [],
      findCyclicDependencies: () => [],
    });
  }
  return {
    analyzeSingle,
    exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
  };
}

/**
 * Создает мок для CFGAnalyzer
 */
function createCFGAnalyzerMock(options?: { shouldFail?: boolean }) {
  const build = vi.fn();
  if (options?.shouldFail) {
    build.mockImplementation(() => {
      throw new Error('CFG error');
    });
  } else {
    build.mockReturnValue({
      blocks: [],
      findUnreachableBlocks: () => [],
      findLoops: () => [],
      getDominators: () => new Set(),
    });
  }
  return { build };
}

/**
 * Создает мок для TypeAnalyzer
 */
function createTypeAnalyzerMock(options?: { shouldFail?: boolean }) {
  const analyze = vi.fn();
  if (options?.shouldFail) {
    analyze.mockImplementation(() => {
      throw new Error('TypeAnalyzer error');
    });
  } else {
    analyze.mockReturnValue({
      findTypeErrors: () => [],
    });
  }
  return { analyze };
}

/**
 * Создает мок для DataFlowAnalyzer
 */
function createDataFlowAnalyzerMock(options?: { shouldFail?: boolean }) {
  const analyze = vi.fn();
  if (options?.shouldFail) {
    analyze.mockImplementation(() => {
      throw new Error('DataFlow error');
    });
  } else {
    analyze.mockReturnValue({
      findUnusedVariables: () => [],
      findReassignedConstants: () => [],
      getVariableStats: () => ({
        total: 0,
        used: 0,
        unused: 0,
        constants: 0,
        reassignedConstants: 0,
      }),
    });
  }
  return { analyze };
}

/**
 * Создает мок для Z3Verifier
 */
function createZ3VerifierMock(options?: { shouldFail?: boolean; failInit?: boolean }) {
  const initialize = vi.fn();
  if (options?.failInit) {
    initialize.mockRejectedValue(new Error('Z3 initialization failed'));
  } else {
    initialize.mockResolvedValue(undefined);
  }

  const verifyFunction = vi.fn();
  if (options?.shouldFail) {
    verifyFunction.mockRejectedValue(new Error('Verification error'));
  } else {
    verifyFunction.mockResolvedValue({ isValid: true, time: 100 });
  }

  return {
    initialize,
    verifyFunction,
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Создает мок для Project (ts-morph)
 */
function createProjectMock(options?: { shouldFail?: boolean }) {
  const addSourceFileAtPath = vi.fn();
  if (options?.shouldFail) {
    addSourceFileAtPath.mockImplementation(() => {
      throw new Error('Project error');
    });
  } else {
    addSourceFileAtPath.mockReturnValue({
      getFunction: vi.fn().mockReturnValue(null),
      getFilePath: vi.fn().mockReturnValue('test.ts'),
      getText: vi.fn().mockReturnValue(''),
      getPreEmitDiagnostics: vi.fn().mockReturnValue([]),
    });
  }
  return {
    addSourceFileAtPath,
  };
}

// ============================================
// МОКИ ДЛЯ ВСЕХ ЗАВИСИМОСТЕЙ
// ============================================

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

vi.mock('../ci-cd/SemanticPipeline.js', () => ({
  SemanticPipeline: vi.fn(),
}));

vi.mock('../formal/Z3Verifier.js', () => ({
  Z3Verifier: vi.fn(),
}));

vi.mock('../semantic/CallGraphAnalyzer.js', () => ({
  CallGraphAnalyzer: vi.fn(),
}));

vi.mock('../semantic/CFGAnalyzer.js', () => ({
  CFGAnalyzer: vi.fn(),
}));

vi.mock('../semantic/TypeAnalyzer.js', () => ({
  TypeAnalyzer: vi.fn(),
}));

vi.mock('../semantic/DataFlowAnalyzer.js', () => ({
  DataFlowAnalyzer: vi.fn(),
}));

vi.mock('ts-morph', () => ({
  Project: vi.fn(),
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

  // Ссылки на моки
  const mockSemanticPipeline = vi.mocked(SemanticPipeline);
  const mockCallGraphAnalyzer = vi.mocked(CallGraphAnalyzer);
  const mockCFGAnalyzer = vi.mocked(CFGAnalyzer);
  const mockTypeAnalyzer = vi.mocked(TypeAnalyzer);
  const mockDataFlowAnalyzer = vi.mocked(DataFlowAnalyzer);
  const mockZ3Verifier = vi.mocked(Z3Verifier);
  const mockProject = vi.mocked(Project);
  const mockGlob = vi.mocked(glob);

  beforeEach(() => {
    vi.clearAllMocks();

    // Создаем тестовую директорию
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Сохраняем оригинальный process.exit
    originalExit = process.exit;
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as any;

    process.env.NODE_ENV = 'test';

    // ============================================
    // ПРАВИЛЬНЫЕ МОКИ - используем mockClass()
    // ============================================

    // SemanticPipeline
    mockSemanticPipeline.mockImplementation(mockClass(() => createSemanticPipelineMock()));

    // CallGraphAnalyzer
    mockCallGraphAnalyzer.mockImplementation(mockClass(() => createCallGraphAnalyzerMock()));

    // CFGAnalyzer
    mockCFGAnalyzer.mockImplementation(mockClass(() => createCFGAnalyzerMock()));

    // TypeAnalyzer
    mockTypeAnalyzer.mockImplementation(mockClass(() => createTypeAnalyzerMock()));

    // DataFlowAnalyzer
    mockDataFlowAnalyzer.mockImplementation(mockClass(() => createDataFlowAnalyzerMock()));

    // Z3Verifier
    mockZ3Verifier.mockImplementation(mockClass(() => createZ3VerifierMock()));

    // Project (ts-morph)
    mockProject.mockImplementation(mockClass(() => createProjectMock()));

    // Glob
    mockGlob.mockResolvedValue([]);
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
    process.env.NODE_ENV = 'test';
  });

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================

  const runCommand = async (args: string[]): Promise<void> => {
    const originalArgv = process.argv;
    process.argv = ['node', 'cli-semantic', ...args];

    try {
      await program.parseAsync(process.argv);
    } finally {
      process.argv = originalArgv;
    }
  };

  const expectCommandToThrow = async (args: string[], expectedCode = 1) => {
    let caught = false;
    let errorMessage = '';

    try {
      await runCommand(args);
    } catch (error: any) {
      caught = true;
      errorMessage = error.message || String(error);
      // Проверяем, что ошибка содержит process.exit called with code
      expect(errorMessage).toContain(`process.exit called with code ${expectedCode}`);
    }

    if (!caught) {
      expect(process.exit).toHaveBeenCalledWith(expectedCode);
    }
  };

  const expectCommandToSucceed = async (args: string[]) => {
    let errorCaught = false;
    let caughtError: Error | undefined;

    try {
      await runCommand(args);
    } catch (error: any) {
      errorCaught = true;
      caughtError = error;

      // Если ошибка - это process.exit с кодом 1, считаем это ошибкой
      if (error.message && error.message.includes('process.exit called with code 1')) {
        expect(error.message).not.toContain('code 1');
      }
      // Если ошибка - это process.exit с кодом 0, считаем это успехом
      if (error.message && error.message.includes('process.exit called with code 0')) {
        // Это успех, просто игнорируем
        errorCaught = false;
      }
    }

    // Если была ошибка и это не process.exit с кодом 0 - провал
    if (errorCaught) {
      throw caughtError || new Error('Command failed unexpectedly');
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
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    // Используем специальный мок для Z3 с ошибкой инициализации
    mockZ3Verifier.mockImplementationOnce(
      mockClass(() => createZ3VerifierMock({ failInit: true }))
    );

    await expectCommandToThrow(['verify', testFile, '--function', 'testFunc']);
  });

  it('должен обрабатывать ошибку парсинга JSON в файле контракта', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');
    const contractFile = path.join(testDir, 'invalid-contract.json');
    fs.writeFileSync(contractFile, 'invalid json {');

    // Проверка должна выбросить ошибку из-за некорректного JSON
    // Но мы ожидаем, что это будет обработано как exitWithCode(1)
    // В тесте мы просто проверяем, что команда выбрасывает ошибку
    await expectCommandToThrow(['verify', testFile, '--contract', contractFile]);
  });

  it('должен обрабатывать ошибку glob при сборе файлов', async () => {
    mockGlob.mockRejectedValue(new Error('Glob error'));

    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    // Ожидаем, что ошибка glob приведет к exitWithCode(1)
    await expectCommandToThrow(['analyze', testFile, '--recursive']);
  });

  it('должен обрабатывать ошибку statSync при сборе файлов', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    // Мокаем statSync чтобы он выбрасывал ошибку
    vi.spyOn(fs, 'statSync').mockImplementation(() => {
      throw new Error('Stat error');
    });

    await expectCommandToThrow(['analyze', testFile, '--recursive']);
  });

  it('должен обрабатывать ошибку parseFile при анализе', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockGlob.mockResolvedValue([testFile]);

    // Мокаем SemanticPipeline с ошибкой
    mockSemanticPipeline.mockImplementationOnce(
      mockClass(() => createSemanticPipelineMock({ shouldFail: true, errorMessage: 'Parse error' }))
    );

    // При ошибке пайплайна команда должна завершиться с кодом 1
    await expectCommandToThrow(['analyze', testDir, '--recursive']);
  });

  it('должен обрабатывать ошибку writeFileSync при анализе', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockGlob.mockResolvedValue([testFile]);

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Write error');
    });

    await expectCommandToThrow(['analyze', testDir, '--recursive', '--output', testDir]);
  });

  it('должен обрабатывать ошибку CallGraphAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockCallGraphAnalyzer.mockImplementationOnce(
      mockClass(() => createCallGraphAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['callgraph', testFile, '--max-depth', '5']);
  });

  it('должен обрабатывать ошибку CFGAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockCFGAnalyzer.mockImplementationOnce(
      mockClass(() => createCFGAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['cfg', testFile]);
  });

  it('должен обрабатывать ошибку TypeAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockTypeAnalyzer.mockImplementationOnce(
      mockClass(() => createTypeAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['types', testFile]);
  });

  it('должен обрабатывать ошибку DataFlowAnalyzer', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockDataFlowAnalyzer.mockImplementationOnce(
      mockClass(() => createDataFlowAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['dataflow', testFile]);
  });

  it('должен обрабатывать ситуацию, когда функция не найдена в команде verify', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    // Мокаем Project чтобы getFunction возвращал null
    mockProject.mockImplementationOnce(
      mockClass(() => {
        const project = createProjectMock();
        project.addSourceFileAtPath = vi.fn().mockReturnValue({
          getFunction: vi.fn().mockReturnValue(null),
          getFilePath: vi.fn().mockReturnValue(testFile),
          getText: vi.fn().mockReturnValue(''),
          getPreEmitDiagnostics: vi.fn().mockReturnValue([]),
        });
        return project;
      })
    );

    // Функция не найдена -> должна быть ошибка
    await expectCommandToThrow(['verify', testFile, '--function', 'missingFunc']);
  });

  it('должен обрабатывать ошибку Project в extractContractFromFile', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    mockProject.mockImplementationOnce(mockClass(() => createProjectMock({ shouldFail: true })));

    // Project выбрасывает ошибку -> команда должна завершиться с кодом 1
    await expectCommandToThrow(['verify', testFile, '--function', 'testFunc']);
  });

  it('должен обрабатывать ошибку SemanticPipeline при анализе', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockGlob.mockResolvedValue([testFile]);
    mockSemanticPipeline.mockImplementationOnce(
      mockClass(() =>
        createSemanticPipelineMock({ shouldFail: true, errorMessage: 'Pipeline error' })
      )
    );

    await expectCommandToThrow(['analyze', testDir, '--recursive']);
  });

  it('должен обрабатывать ошибку writeFile при генерации отчета', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

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

    mockGlob.mockResolvedValue([testFile]);

    // Используем стандартный мок SemanticPipeline (успешный)
    await expectCommandToSucceed(['analyze', testDir, '--recursive']);
  });

  it('должен обрабатывать ошибку "файл не найден" в команде dead', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.ts');
    await expectCommandToThrow(['dead', nonExistentFile, '--recursive']);
  });

  it('должен обрабатывать ситуацию, когда файлы не найдены в команде dead', async () => {
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

    mockGlob.mockResolvedValue([testFile]);

    // Команда analyze с критическими функциями должна выполниться успешно
    await expectCommandToSucceed(['analyze', testDir, '--recursive', '--critical', 'criticalFunc']);
  });

  it('должен корректно обрабатывать команду callgraph с опцией output', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');
    const outputFile = path.join(testDir, 'output.json');

    // Создаем специальный мок для этого теста
    const mockAnalyzeSingle = vi.fn().mockResolvedValue({
      nodes: new Map(),
      edges: [],
      entryPoints: [],
      cycles: [],
      findUnusedFunctions: () => [],
      findCyclicDependencies: () => [],
    });

    mockCallGraphAnalyzer.mockImplementationOnce(
      mockClass(() => ({
        analyzeSingle: mockAnalyzeSingle,
        exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
      }))
    );

    await expectCommandToSucceed([
      'callgraph',
      testFile,
      '--max-depth',
      '5',
      '--output',
      outputFile,
    ]);
    expect(mockAnalyzeSingle).toHaveBeenCalled();
  });

  it('должен обрабатывать ошибку в команде callgraph с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    mockCallGraphAnalyzer.mockImplementationOnce(
      mockClass(() => createCallGraphAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['callgraph', testFile, '--max-depth', '5']);
  });

  it('должен обрабатывать ошибку в команде cfg с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    mockCFGAnalyzer.mockImplementationOnce(
      mockClass(() => createCFGAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['cfg', testFile]);
  });

  it('должен обрабатывать ошибку в команде types с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    mockTypeAnalyzer.mockImplementationOnce(
      mockClass(() => createTypeAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['types', testFile]);
  });

  it('должен обрабатывать ошибку в команде dataflow с некорректным файлом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    mockDataFlowAnalyzer.mockImplementationOnce(
      mockClass(() => createDataFlowAnalyzerMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['dataflow', testFile]);
  });

  it('должен обрабатывать ошибку в команде verify с некорректным контрактом', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');
    const contractFile = path.join(testDir, 'invalid.json');
    fs.writeFileSync(contractFile, '{"invalid": true}');

    // Мокаем Z3 с ошибкой валидации контракта
    mockZ3Verifier.mockImplementationOnce(
      mockClass(() => createZ3VerifierMock({ shouldFail: true }))
    );

    await expectCommandToThrow(['verify', testFile, '--contract', contractFile]);
  });

  it('должен выбрасывать исключение при вызове exitWithCode в тестовой среде', () => {
    expect(() => exitWithCode(1)).toThrow('process.exit called with code 1');
    expect(() => exitWithCode(0)).toThrow('process.exit called with code 0');
  });

  it('должен обрабатывать ошибку DataFlowAnalyzer в команде dead', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const test = 1;');

    mockGlob.mockResolvedValue([testFile]);

    // Мокаем DataFlowAnalyzer с ошибкой в команде dead
    mockDataFlowAnalyzer.mockImplementationOnce(
      mockClass(() => {
        const mocks = createDataFlowAnalyzerMock({ shouldFail: true });
        // Добавляем дополнительные методы, которые использует команда dead
        return {
          ...mocks,
          getVariableStats: vi.fn().mockReturnValue({
            total: 0,
            used: 0,
            unused: 0,
            constants: 0,
            reassignedConstants: 0,
          }),
          findUnusedVariables: vi.fn().mockReturnValue([]),
          findReassignedConstants: vi.fn().mockReturnValue([]),
        };
      })
    );

    // Команда dead должна завершиться успешно (код 0), даже если есть ошибки в анализаторе
    await expectCommandToSucceed(['dead', testDir, '--recursive']);
  });

  it('должен обрабатывать команду analyze с формальной верификацией', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    mockGlob.mockResolvedValue([testFile]);

    // Команда analyze с формальной верификацией должна выполниться успешно
    await expectCommandToSucceed(['analyze', testDir, '--recursive', '--formal']);
  });

  it('должен корректно обрабатывать команду callgraph с опцией json', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockAnalyzeSingle = vi.fn().mockResolvedValue({
      nodes: new Map(),
      edges: [],
      entryPoints: [],
      cycles: [],
      findUnusedFunctions: () => [],
      findCyclicDependencies: () => [],
    });

    mockCallGraphAnalyzer.mockImplementationOnce(
      mockClass(() => ({
        analyzeSingle: mockAnalyzeSingle,
        exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
      }))
    );

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expectCommandToSucceed(['callgraph', testFile, '--max-depth', '5', '--json']);
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  it('должен корректно обрабатывать команду callgraph с опцией dot', async () => {
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function testFunc() { return 1; }');

    const mockAnalyzeSingle = vi.fn().mockResolvedValue({
      nodes: new Map(),
      edges: [],
      entryPoints: [],
      cycles: [],
      findUnusedFunctions: () => [],
      findCyclicDependencies: () => [],
    });

    mockCallGraphAnalyzer.mockImplementationOnce(
      mockClass(() => ({
        analyzeSingle: mockAnalyzeSingle,
        exportToJSON: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
      }))
    );

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expectCommandToSucceed(['callgraph', testFile, '--max-depth', '5', '--dot']);
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
