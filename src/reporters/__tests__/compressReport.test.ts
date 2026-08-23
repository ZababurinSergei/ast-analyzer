// src/reporters/__tests__/compressReport.test.ts
import { describe, it, expect } from 'vitest';
import { compressReport } from '../compressReport';
import type { EnhancedPackageLockReport, EnhancedPackageInfo } from '../modules/types';

// ============================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ПАКЕТА
// ============================================
function createPackage(overrides: Partial<EnhancedPackageInfo> = {}): EnhancedPackageInfo {
  return {
    version: '1.0.0',
    resolved: 'file:src/index.ts',
    type: 'module',
    language: 'typescript',
    isEntry: false,
    imports: {},
    exports: {},
    entities: {
      functions: [],
      constants: [],
      variables: [],
      interfaces: [],
      types: [],
      classes: [],
    },
    fileStats: {
      size: 0,
      lines: 0,
      functions: 0,
      classes: 0,
      constants: 0,
      interfaces: 0,
      types: 0,
      variables: 0,
    },
    ...overrides,
  };
}

// ============================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ФУНКЦИИ
// ============================================
function createFunc(name: string, opts: Partial<any> = {}) {
  return {
    name,
    line: opts.line || 1,
    isExported: opts.isExported || false,
    isAsync: opts.isAsync || false,
    params: opts.params || [],
    paramTypes: opts.paramTypes || [],
    returnType: opts.returnType || 'void',
    calls: opts.calls || [],
    calledBy: opts.calledBy || [],
    startLine: opts.startLine || opts.line || 1,
    endLine: opts.endLine || opts.line || 1,
    isMethod: opts.isMethod || false,
    className: opts.className || undefined,
    isNested: opts.isNested || false,
    parentFunction: opts.parentFunction || undefined,
    isArrow: opts.isArrow || false,
    isEventHandler: opts.isEventHandler || false,
    eventType: opts.eventType || undefined,
    depth: opts.depth || 0,
    complexity: opts.complexity || 1,
    security: opts.security || {
      hasEval: false,
      hasProcessEnv: false,
      hasSensitiveData: false,
      hasExec: false,
      hasPassword: false,
    },
    body: opts.body || '',
    signature: opts.signature || '',
    vscode: opts.vscode || '',
    _safeInfo: null,
  };
}

// ============================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ПОЛНОГО ОТЧЕТА
// ============================================
function createFullReport(overrides: Partial<EnhancedPackageLockReport> = {}): EnhancedPackageLockReport {
  const base: EnhancedPackageLockReport = {
    name: 'ast-analyzer',
    version: '3.0.0',
    lockfileVersion: 3,
    packages: {},
    dependencyGraph: {
      direction: 'bidirectional',
      inwardDependencies: {},
      outwardDependencies: {},
    },
    executionGraph: {
      entryPoint: 'src/index.ts',
      direction: 'top-down',
      entryFunctions: [],
      executionFlow: {
        type: 'sequential',
        steps: [],
      },
    },
    importExportFlow: {
      imports: {},
      exports: {},
    },
    callGraph: {},
    entityStats: {
      totalFunctions: 0,
      totalConstants: 0,
      totalVariables: 0,
      totalInterfaces: 0,
      totalTypes: 0,
      totalClasses: 0,
      totalCalls: 0,
      totalExportedFunctions: 0,
      totalAsyncFunctions: 0,
    },
    fileStats: {
      totalFiles: 0,
      totalSize: 0,
      totalLines: 0,
    },
    architectureMetrics: {
      totalModules: 0,
      totalFunctions: 0,
      totalClasses: 0,
      totalConstants: 0,
      totalInterfaces: 0,
      totalTypes: 0,
      totalVariables: 0,
      totalCalls: 0,
      vueComponents: 0,
      totalComposables: 0,
      hasCycles: false,
      maxDepth: 0,
      modulesByLevel: {},
      isAcyclic: true,
    },
    summary: {
      projectType: 'single',
      entryPoint: 'src/index.ts',
      totalModules: 0,
      totalFunctions: 0,
      vueComponents: 0,
      hasCycles: false,
      maxDepth: 0,
      architectureHealth: '✅ Healthy',
    },
    timestamp: new Date().toISOString(),
  };

  return mergeDeep(base, overrides) as EnhancedPackageLockReport;
}

function mergeDeep(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ============================================
// ТЕСТЫ
// ============================================
describe('compressReport - сжатие отчета', () => {
  // ============================================
  // БАЗОВЫЙ ОТЧЕТ ДЛЯ ТЕСТОВ
  // ============================================
  const baseReport = createFullReport({
    packages: {
      'src/index.ts': createPackage({
        language: 'typescript',
        isEntry: true,
        fileStats: {
          size: 1000,
          lines: 50,
          functions: 4,
          classes: 0,
          constants: 0,
          interfaces: 0,
          types: 0,
          variables: 0,
        },
        entities: {
          functions: [
            createFunc('main', {
              line: 10,
              isExported: true,
              params: ['args'],
              returnType: 'void',
              calls: ['helper', 'logger'],
            }),
            createFunc('helper', {
              line: 20,
              params: ['x', 'y'],
              returnType: 'number',
              calls: ['add'],
            }),
            createFunc('logger', {
              line: 30,
              isAsync: true,
              params: ['message'],
              returnType: 'void',
              calls: [],
            }),
            createFunc('add', {
              line: 40,
              params: ['a', 'b'],
              returnType: 'number',
              calls: [],
            }),
          ],
          classes: [],
          constants: [],
          variables: [],
          interfaces: [],
          types: [],
        },
      }),
      'src/utils/helper.ts': createPackage({
        language: 'typescript',
        isEntry: false,
        fileStats: {
          size: 500,
          lines: 25,
          functions: 2,
          classes: 0,
          constants: 0,
          interfaces: 0,
          types: 0,
          variables: 0,
        },
        entities: {
          functions: [
            createFunc('add', {
              line: 5,
              isExported: true,
              params: ['a', 'b'],
              returnType: 'number',
              calls: [],
            }),
            createFunc('multiply', {
              line: 10,
              isExported: true,
              params: ['a', 'b'],
              returnType: 'number',
              calls: [],
            }),
          ],
          classes: [],
          constants: [],
          variables: [],
          interfaces: [],
          types: [],
        },
      }),
      'src/utils/logger.ts': createPackage({
        language: 'typescript',
        isEntry: false,
        fileStats: {
          size: 300,
          lines: 15,
          functions: 2,
          classes: 0,
          constants: 0,
          interfaces: 0,
          types: 0,
          variables: 0,
        },
        entities: {
          functions: [
            createFunc('log', {
              line: 3,
              isExported: true,
              params: ['message'],
              returnType: 'void',
              calls: ['formatMessage'],
            }),
            createFunc('formatMessage', {
              line: 8,
              params: ['msg'],
              returnType: 'string',
              calls: [],
            }),
          ],
          classes: [],
          constants: [],
          variables: [],
          interfaces: [],
          types: [],
        },
      }),
    },
    dependencyGraph: {
      direction: 'bidirectional',
      inwardDependencies: {
        'src/utils/helper.ts': ['src/index.ts'],
        'src/utils/logger.ts': ['src/index.ts'],
      },
      outwardDependencies: {
        'src/index.ts': ['src/utils/helper.ts', 'src/utils/logger.ts'],
        'src/utils/helper.ts': [],
        'src/utils/logger.ts': [],
      },
    },
    architectureMetrics: {
      totalModules: 3,
      totalFunctions: 8,
      totalClasses: 0,
      totalConstants: 0,
      totalInterfaces: 0,
      totalTypes: 0,
      totalVariables: 0,
      totalCalls: 4,
      vueComponents: 0,
      totalComposables: 0,
      hasCycles: false,
      maxDepth: 1,
      modulesByLevel: {
        '0': ['src/index.ts'],
        '1': ['src/utils/helper.ts', 'src/utils/logger.ts'],
      },
      isAcyclic: true,
    },
    entityStats: {
      totalFunctions: 8,
      totalConstants: 0,
      totalVariables: 0,
      totalInterfaces: 0,
      totalTypes: 0,
      totalClasses: 0,
      totalCalls: 4,
      totalExportedFunctions: 3,
      totalAsyncFunctions: 1,
    },
    fileStats: {
      totalFiles: 3,
      totalSize: 1800,
      totalLines: 90,
    },
    summary: {
      projectType: 'single',
      entryPoint: 'src/index.ts',
      totalModules: 3,
      totalFunctions: 8,
      vueComponents: 0,
      hasCycles: false,
      maxDepth: 1,
      architectureHealth: '✅ Healthy',
    },
    timestamp: '2026-08-23T20:00:00.000Z',
  });

  // ============================================
  // ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОИСКА ИНДЕКСА ФУНКЦИИ
  // ============================================
  function findFuncIndex(compressed: any, name: string, modulePath?: string): number {
    return compressed.funcs.findIndex((f: any) => {
      if (modulePath) {
        const modPath = compressed.modules[f.m];
        return f.n === name && modPath === modulePath;
      }
      return f.n === name;
    });
  }

  // ============================================
  // ТЕСТ 1: Базовое сжатие
  // ============================================
  it('должен сжимать отчет в компактный формат', () => {
    const compressed = compressReport(baseReport);

    expect(compressed.v).toBe('3.0.1');
    expect(compressed.root).toBe(0);
    expect(compressed.time).toBe(baseReport.timestamp);

    expect(compressed.modules).toHaveLength(3);
    expect(compressed.modules).toContain('src/index.ts');
    expect(compressed.modules).toContain('src/utils/helper.ts');
    expect(compressed.modules).toContain('src/utils/logger.ts');

    const idxIndex = compressed.modules.indexOf('src/index.ts');
    const idxHelper = compressed.modules.indexOf('src/utils/helper.ts');
    const idxLogger = compressed.modules.indexOf('src/utils/logger.ts');

    expect(compressed.pkg[idxIndex]).toBeDefined();
    expect(compressed.pkg[idxIndex].l).toBe('typescript');
    expect(compressed.pkg[idxIndex].s).toBe(1000);
    expect(compressed.pkg[idxIndex].ln).toBe(50);
    expect(compressed.pkg[idxIndex].entry).toBe(true);
    expect(compressed.pkg[idxIndex].f).toHaveLength(4);

    expect(compressed.pkg[idxHelper]).toBeDefined();
    expect(compressed.pkg[idxHelper].l).toBe('typescript');
    expect(compressed.pkg[idxHelper].s).toBe(500);
    expect(compressed.pkg[idxHelper].ln).toBe(25);
    expect(compressed.pkg[idxHelper].entry).toBe(false);
    expect(compressed.pkg[idxHelper].f).toHaveLength(2);

    expect(compressed.pkg[idxLogger]).toBeDefined();
    expect(compressed.pkg[idxLogger].l).toBe('typescript');
    expect(compressed.pkg[idxLogger].s).toBe(300);
    expect(compressed.pkg[idxLogger].ln).toBe(15);
    expect(compressed.pkg[idxLogger].entry).toBe(false);
    expect(compressed.pkg[idxLogger].f).toHaveLength(2);

    const mainIdx = findFuncIndex(compressed, 'main', 'src/index.ts');
    const helperIdx = findFuncIndex(compressed, 'helper', 'src/index.ts');
    const loggerIdx = findFuncIndex(compressed, 'logger', 'src/index.ts');
    const addIdx1 = findFuncIndex(compressed, 'add', 'src/index.ts');
    const addIdx2 = findFuncIndex(compressed, 'add', 'src/utils/helper.ts');
    const multiplyIdx = findFuncIndex(compressed, 'multiply', 'src/utils/helper.ts');
    const logIdx = findFuncIndex(compressed, 'log', 'src/utils/logger.ts');
    const formatIdx = findFuncIndex(compressed, 'formatMessage', 'src/utils/logger.ts');

    expect(mainIdx).not.toBe(-1);
    expect(helperIdx).not.toBe(-1);
    expect(loggerIdx).not.toBe(-1);
    expect(addIdx1).not.toBe(-1);
    expect(addIdx2).not.toBe(-1);
    expect(multiplyIdx).not.toBe(-1);
    expect(logIdx).not.toBe(-1);
    expect(formatIdx).not.toBe(-1);

    const main = compressed.funcs[mainIdx];
    expect(main.n).toBe('main');
    expect(main.m).toBe(idxIndex);
    expect(main.l).toBe(10);
    expect(main.e).toBe(true);
    expect(main.a).toBe(false);
    expect(main.p).toEqual(['args']);
    expect(main.r).toBe('void');
    expect(main.c).toHaveLength(2);
    expect(main.c).toContain(helperIdx);
    expect(main.c).toContain(loggerIdx);

    const helper = compressed.funcs[helperIdx];
    expect(helper.n).toBe('helper');
    expect(helper.c).toHaveLength(1);
    expect(helper.c).toContain(addIdx1);

    const log = compressed.funcs[logIdx];
    expect(log.n).toBe('log');
    expect(log.c).toHaveLength(1);
    expect(log.c).toContain(formatIdx);

    expect(compressed.mgraph[idxIndex]).toBeDefined();
    expect(compressed.mgraph[idxIndex]).toContain(idxHelper);
    expect(compressed.mgraph[idxIndex]).toContain(idxLogger);
    expect(compressed.mgraph[idxHelper] || []).toEqual([]);
    expect(compressed.mgraph[idxLogger] || []).toEqual([]);

    expect(compressed.levels[0]).toContain(idxIndex);
    expect(compressed.levels[1]).toContain(idxHelper);
    expect(compressed.levels[1]).toContain(idxLogger);

    expect(compressed.stats).toEqual({
      funcs: 8,
      mods: 3,
      calls: 4,
      size: 1800,
      depth: 1,
      cycles: false,
    });
  });

  // ============================================
  // ТЕСТ 2: Пустой отчет
  // ============================================
  it('должен обрабатывать пустой отчет', () => {
    const emptyReport = createFullReport({
      packages: {},
      dependencyGraph: {
        direction: 'bidirectional',
        inwardDependencies: {},
        outwardDependencies: {},
      },
      architectureMetrics: {
        totalModules: 0,
        totalFunctions: 0,
        totalClasses: 0,
        totalConstants: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalVariables: 0,
        totalCalls: 0,
        vueComponents: 0,
        totalComposables: 0,
        hasCycles: false,
        maxDepth: 0,
        modulesByLevel: {},
        isAcyclic: true,
      },
      entityStats: {
        totalFunctions: 0,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls: 0,
        totalExportedFunctions: 0,
        totalAsyncFunctions: 0,
      },
      fileStats: {
        totalFiles: 0,
        totalSize: 0,
        totalLines: 0,
      },
      summary: {
        projectType: 'single',
        entryPoint: '',
        totalModules: 0,
        totalFunctions: 0,
        vueComponents: 0,
        hasCycles: false,
        maxDepth: 0,
        architectureHealth: '✅ Healthy',
      },
      timestamp: '2026-08-23T20:00:00.000Z',
    });

    const compressed = compressReport(emptyReport);

    expect(compressed.modules).toEqual([]);
    expect(compressed.pkg).toEqual({});
    expect(compressed.funcs).toEqual([]);
    expect(compressed.mgraph).toEqual({});
    expect(compressed.fgraph).toEqual({});
    expect(compressed.levels).toEqual({});
    expect(compressed.stats).toEqual({
      funcs: 0,
      mods: 0,
      calls: 0,
      size: 0,
      depth: 0,
      cycles: false,
    });
  });

  // ============================================
  // ТЕСТ 3: Отчет без функций
  // ============================================
  it('должен обрабатывать отчет без функций', () => {
    const reportNoFuncs = createFullReport({
      packages: {
        'src/empty.ts': createPackage({
          language: 'typescript',
          isEntry: false,
          fileStats: {
            size: 100,
            lines: 5,
            functions: 0,
            classes: 0,
            constants: 0,
            interfaces: 0,
            types: 0,
            variables: 0,
          },
          entities: {
            functions: [],
            classes: [],
            constants: [],
            variables: [],
            interfaces: [],
            types: [],
          },
        }),
      },
      dependencyGraph: {
        direction: 'bidirectional',
        inwardDependencies: {},
        outwardDependencies: {},
      },
      entityStats: {
        totalFunctions: 0,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls: 0,
        totalExportedFunctions: 0,
        totalAsyncFunctions: 0,
      },
      fileStats: {
        totalFiles: 1,
        totalSize: 100,
        totalLines: 5,
      },
      summary: {
        projectType: 'single',
        entryPoint: 'src/empty.ts',
        totalModules: 1,
        totalFunctions: 0,
        vueComponents: 0,
        hasCycles: false,
        maxDepth: 0,
        architectureHealth: '✅ Healthy',
      },
    });

    const compressed = compressReport(reportNoFuncs);

    expect(compressed.modules).toEqual(['src/empty.ts']);
    expect(compressed.pkg[0]).toEqual({
      l: 'typescript',
      s: 100,
      ln: 5,
      entry: false,
      f: [],
    });
    expect(compressed.funcs).toEqual([]);
    expect(compressed.stats.funcs).toBe(0);
    expect(compressed.stats.calls).toBe(0);
  });

  // ============================================
  // ТЕСТ 4: Сохранение вызовов функций
  // ============================================
  it('должен сохранять связи вызовов между функциями', () => {
    const compressed = compressReport(baseReport);

    const mainIdx = findFuncIndex(compressed, 'main', 'src/index.ts');
    const helperIdx = findFuncIndex(compressed, 'helper', 'src/index.ts');
    const loggerIdx = findFuncIndex(compressed, 'logger', 'src/index.ts');
    const addIdx1 = findFuncIndex(compressed, 'add', 'src/index.ts');
    const logIdx = findFuncIndex(compressed, 'log', 'src/utils/logger.ts');
    const formatIdx = findFuncIndex(compressed, 'formatMessage', 'src/utils/logger.ts');

    expect(mainIdx).not.toBe(-1);
    expect(helperIdx).not.toBe(-1);

    expect(compressed.funcs[mainIdx].c).toContain(helperIdx);
    expect(compressed.funcs[mainIdx].c).toContain(loggerIdx);
    expect(compressed.funcs[helperIdx].c).toContain(addIdx1);
    expect(compressed.funcs[logIdx].c).toContain(formatIdx);
  });

  // ============================================
  // ТЕСТ 5: Правильное отображение модулей → функции
  // ============================================
  it('должен правильно сопоставлять модули с функциями', () => {
    const compressed = compressReport(baseReport);

    const idxIndex = compressed.modules.indexOf('src/index.ts');
    const idxHelper = compressed.modules.indexOf('src/utils/helper.ts');
    const idxLogger = compressed.modules.indexOf('src/utils/logger.ts');

    expect(compressed.pkg[idxIndex].f).toHaveLength(4);
    expect(compressed.pkg[idxHelper].f).toHaveLength(2);
    expect(compressed.pkg[idxLogger].f).toHaveLength(2);

    for (const funcIdx of compressed.pkg[idxIndex].f) {
      expect(compressed.funcs[funcIdx].m).toBe(idxIndex);
    }
    for (const funcIdx of compressed.pkg[idxHelper].f) {
      expect(compressed.funcs[funcIdx].m).toBe(idxHelper);
    }
    for (const funcIdx of compressed.pkg[idxLogger].f) {
      expect(compressed.funcs[funcIdx].m).toBe(idxLogger);
    }
  });

  // ============================================
  // ТЕСТ 6: Правильная статистика
  // ============================================
  it('должен вычислять правильную статистику', () => {
    const compressed = compressReport(baseReport);

    expect(compressed.stats).toEqual({
      funcs: 8,
      mods: 3,
      calls: 4,
      size: 1800,
      depth: 1,
      cycles: false,
    });
  });

  // ============================================
  // ТЕСТ 7: Версия и временная метка
  // ============================================
  it('должен включать версию и временную метку', () => {
    const compressed = compressReport(baseReport);

    expect(compressed.v).toBe('3.0.1');
    expect(compressed.time).toBe(baseReport.timestamp);
  });

  // ============================================
  // ТЕСТ 8: Отсутствие architectureMetrics
  // ============================================
  it('должен корректно обрабатывать отсутствие architectureMetrics', () => {
    const reportWithoutArch = createFullReport({
      ...baseReport,
      architectureMetrics: undefined as any,
    });

    const compressed = compressReport(reportWithoutArch);

    expect(compressed.levels).toEqual({});
    expect(compressed.stats.depth).toBe(0);
    expect(compressed.stats.cycles).toBe(false);
  });

  // ============================================
  // ТЕСТ 9: Отсутствие entityStats
  // ============================================
  it('должен корректно обрабатывать отсутствие entityStats', () => {
    const reportWithoutStats = createFullReport({
      ...baseReport,
      entityStats: undefined as any,
    });

    const compressed = compressReport(reportWithoutStats);

    expect(compressed.stats.funcs).toBe(8);
    expect(compressed.stats.calls).toBe(4);
  });

  // ============================================
  // ТЕСТ 10: Отсутствие fileStats
  // ============================================
  it('должен корректно обрабатывать отсутствие fileStats', () => {
    const reportWithoutFileStats = createFullReport({
      ...baseReport,
      fileStats: undefined as any,
    });

    const compressed = compressReport(reportWithoutFileStats);

    expect(compressed.stats.size).toBe(0);
    expect(compressed.stats.mods).toBe(3);
  });

  // ============================================
  // ТЕСТ 11: Циклические зависимости
  // ============================================
  it('должен корректно обрабатывать циклические зависимости', () => {
    const reportWithCycles = createFullReport({
      packages: {
        'modA': createPackage({
          language: 'typescript',
          isEntry: true,
          fileStats: {
            size: 100,
            lines: 10,
            functions: 2,
            classes: 0,
            constants: 0,
            interfaces: 0,
            types: 0,
            variables: 0,
          },
          entities: {
            functions: [
              createFunc('func1', {
                line: 1,
                isExported: true,
                params: [],
                returnType: 'void',
                calls: ['func2'],
              }),
              createFunc('func2', {
                line: 2,
                params: [],
                returnType: 'void',
                calls: ['func1'],
              }),
            ],
            classes: [],
            constants: [],
            variables: [],
            interfaces: [],
            types: [],
          },
        }),
        'modB': createPackage({
          language: 'typescript',
          isEntry: false,
          fileStats: {
            size: 50,
            lines: 5,
            functions: 1,
            classes: 0,
            constants: 0,
            interfaces: 0,
            types: 0,
            variables: 0,
          },
          entities: {
            functions: [
              createFunc('func3', {
                line: 1,
                isExported: true,
                params: [],
                returnType: 'void',
                calls: ['func1'],
              }),
            ],
            classes: [],
            constants: [],
            variables: [],
            interfaces: [],
            types: [],
          },
        }),
      },
      dependencyGraph: {
        direction: 'bidirectional',
        inwardDependencies: {
          'modB': ['modA'],
          'modA': ['modB'],
        },
        outwardDependencies: {
          'modA': ['modB'],
          'modB': ['modA'],
        },
      },
      architectureMetrics: {
        totalModules: 2,
        totalFunctions: 3,
        totalClasses: 0,
        totalConstants: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalVariables: 0,
        totalCalls: 3,
        vueComponents: 0,
        totalComposables: 0,
        hasCycles: true,
        maxDepth: 1,
        modulesByLevel: {
          '0': ['modA'],
          '1': ['modB'],
        },
        isAcyclic: false,
      },
      entityStats: {
        totalFunctions: 3,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls: 3,
        totalExportedFunctions: 2,
        totalAsyncFunctions: 0,
      },
      fileStats: {
        totalFiles: 2,
        totalSize: 150,
        totalLines: 15,
      },
      summary: {
        projectType: 'single',
        entryPoint: 'modA',
        totalModules: 2,
        totalFunctions: 3,
        vueComponents: 0,
        hasCycles: true,
        maxDepth: 1,
        architectureHealth: '⚠️ Has cycles',
      },
      timestamp: '2026-08-23T20:00:00.000Z',
    });

    const compressed = compressReport(reportWithCycles);

    expect(compressed.stats.cycles).toBe(true);

    const idxModA = compressed.modules.indexOf('modA');
    const idxModB = compressed.modules.indexOf('modB');

    expect(compressed.mgraph[idxModA]).toContain(idxModB);
    expect(compressed.mgraph[idxModB]).toContain(idxModA);

    const func1Idx = findFuncIndex(compressed, 'func1', 'modA');
    const func2Idx = findFuncIndex(compressed, 'func2', 'modA');
    const func3Idx = findFuncIndex(compressed, 'func3', 'modB');

    expect(func1Idx).not.toBe(-1);
    expect(func2Idx).not.toBe(-1);
    expect(func3Idx).not.toBe(-1);

    expect(compressed.funcs[func1Idx].c).toContain(func2Idx);
    expect(compressed.funcs[func2Idx].c).toContain(func1Idx);
    expect(compressed.funcs[func3Idx].c).toContain(func1Idx);
  });

  // ============================================
  // ТЕСТ 12: Большой отчет с множеством функций
  // ============================================
  it('должен обрабатывать большой отчет с множеством функций', () => {
    const functions = Array.from({ length: 100 }, (_, i) =>
      createFunc(`func${i}`, {
        line: i * 5,
        isExported: i % 2 === 0,
        isAsync: i % 3 === 0,
        params: i % 2 === 0 ? ['a', 'b'] : ['x'],
        returnType: i % 2 === 0 ? 'number' : 'void',
        calls: i > 0 ? [`func${i - 1}`] : [],
      })
    );

    const largeReport = createFullReport({
      packages: {
        'src/index.ts': createPackage({
          language: 'typescript',
          isEntry: true,
          fileStats: {
            size: 10000,
            lines: 500,
            functions: 100,
            classes: 0,
            constants: 0,
            interfaces: 0,
            types: 0,
            variables: 0,
          },
          entities: {
            functions,
            classes: [],
            constants: [],
            variables: [],
            interfaces: [],
            types: [],
          },
        }),
      },
      dependencyGraph: {
        direction: 'bidirectional',
        inwardDependencies: {},
        outwardDependencies: {
          'src/index.ts': [],
        },
      },
      architectureMetrics: {
        totalModules: 1,
        totalFunctions: 100,
        totalClasses: 0,
        totalConstants: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalVariables: 0,
        totalCalls: 99,
        vueComponents: 0,
        totalComposables: 0,
        hasCycles: false,
        maxDepth: 0,
        modulesByLevel: {
          '0': ['src/index.ts'],
        },
        isAcyclic: true,
      },
      entityStats: {
        totalFunctions: 100,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls: 99,
        totalExportedFunctions: 50,
        totalAsyncFunctions: 33,
      },
      fileStats: {
        totalFiles: 1,
        totalSize: 10000,
        totalLines: 500,
      },
      summary: {
        projectType: 'single',
        entryPoint: 'src/index.ts',
        totalModules: 1,
        totalFunctions: 100,
        vueComponents: 0,
        hasCycles: false,
        maxDepth: 0,
        architectureHealth: '✅ Healthy',
      },
      timestamp: '2026-08-23T20:00:00.000Z',
    });

    const compressed = compressReport(largeReport);

    expect(compressed.funcs).toHaveLength(100);
    expect(compressed.stats.funcs).toBe(100);
    expect(compressed.stats.calls).toBe(99);

    const funcIdxs: number[] = [];
    for (let i = 0; i < 100; i++) {
      const idx = findFuncIndex(compressed, `func${i}`, 'src/index.ts');
      expect(idx).not.toBe(-1);
      funcIdxs.push(idx);
    }

    for (let i = 1; i < 100; i++) {
      expect(compressed.funcs[funcIdxs[i]].c).toEqual([funcIdxs[i - 1]]);
    }
    expect(compressed.funcs[funcIdxs[0]].c).toEqual([]);
  });

  // ============================================
  // ТЕСТ 13: Функции с одинаковыми именами в разных модулях
  // ============================================
  it('должен обрабатывать функции с одинаковыми именами в разных модулях', () => {
    const reportWithDuplicates = createFullReport({
      packages: {
        'src/index.ts': createPackage({
          language: 'typescript',
          isEntry: true,
          fileStats: {
            size: 100,
            lines: 10,
            functions: 1,
            classes: 0,
            constants: 0,
            interfaces: 0,
            types: 0,
            variables: 0,
          },
          entities: {
            functions: [
              createFunc('process', {
                line: 1,
                isExported: true,
                params: ['data'],
                returnType: 'void',
                calls: ['process'],
              }),
            ],
            classes: [],
            constants: [],
            variables: [],
            interfaces: [],
            types: [],
          },
        }),
        'src/utils/processor.ts': createPackage({
          language: 'typescript',
          isEntry: false,
          fileStats: {
            size: 80,
            lines: 8,
            functions: 1,
            classes: 0,
            constants: 0,
            interfaces: 0,
            types: 0,
            variables: 0,
          },
          entities: {
            functions: [
              createFunc('process', {
                line: 2,
                isExported: true,
                params: ['item'],
                returnType: 'number',
                calls: [],
              }),
            ],
            classes: [],
            constants: [],
            variables: [],
            interfaces: [],
            types: [],
          },
        }),
      },
      dependencyGraph: {
        direction: 'bidirectional',
        inwardDependencies: {
          'src/utils/processor.ts': ['src/index.ts'],
        },
        outwardDependencies: {
          'src/index.ts': ['src/utils/processor.ts'],
          'src/utils/processor.ts': [],
        },
      },
      architectureMetrics: {
        totalModules: 2,
        totalFunctions: 2,
        totalClasses: 0,
        totalConstants: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalVariables: 0,
        totalCalls: 1,
        vueComponents: 0,
        totalComposables: 0,
        hasCycles: false,
        maxDepth: 1,
        modulesByLevel: {
          '0': ['src/index.ts'],
          '1': ['src/utils/processor.ts'],
        },
        isAcyclic: true,
      },
      entityStats: {
        totalFunctions: 2,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls: 1,
        totalExportedFunctions: 2,
        totalAsyncFunctions: 0,
      },
      fileStats: {
        totalFiles: 2,
        totalSize: 180,
        totalLines: 18,
      },
      summary: {
        projectType: 'single',
        entryPoint: 'src/index.ts',
        totalModules: 2,
        totalFunctions: 2,
        vueComponents: 0,
        hasCycles: false,
        maxDepth: 1,
        architectureHealth: '✅ Healthy',
      },
      timestamp: '2026-08-23T20:00:00.000Z',
    });

    const compressed = compressReport(reportWithDuplicates);

    expect(compressed.funcs).toHaveLength(2);

    const idxProcess1 = findFuncIndex(compressed, 'process', 'src/index.ts');
    const idxProcess2 = findFuncIndex(compressed, 'process', 'src/utils/processor.ts');

    expect(idxProcess1).not.toBe(-1);
    expect(idxProcess2).not.toBe(-1);

    const idxIndex = compressed.modules.indexOf('src/index.ts');
    const idxProcessor = compressed.modules.indexOf('src/utils/processor.ts');

    expect(compressed.funcs[idxProcess1].n).toBe('process');
    expect(compressed.funcs[idxProcess1].m).toBe(idxIndex);
    expect(compressed.funcs[idxProcess1].c).toContain(idxProcess1);

    expect(compressed.funcs[idxProcess2].n).toBe('process');
    expect(compressed.funcs[idxProcess2].m).toBe(idxProcessor);
    expect(compressed.funcs[idxProcess2].c).toEqual([]);

    expect(compressed.pkg[idxIndex].f).toContain(idxProcess1);
    expect(compressed.pkg[idxProcessor].f).toContain(idxProcess2);
  });
});
