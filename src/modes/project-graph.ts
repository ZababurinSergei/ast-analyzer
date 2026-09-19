// src/modes/project-graph.ts
// ИСПРАВЛЕННАЯ ВЕРСИЯ - все ошибки TypeScript устранены
// Удалены неиспользуемые функции: buildEntitiesMap, buildReport,
// findPathBetweenFunctions, buildRelationshipGraph
// Функции встроены в buildProjectGraph для улучшения читаемости
// ✅ v2: добавлена интеграция enrichWithReExports для разворачивания re-exports
// ✅ v3: enrichWithReExports вызывается ДО collectFullJSON и пробрасывает
//        обогащённый entitiesMap во все последующие шаги

import path from 'path';
import fs from 'fs';
import { Project } from 'ts-morph';
import {
<<<<<<< HEAD
  parseFile,
  resolveFilePath,
  isExternalModule,
  getTsConfigForFile,
} from '../core/ast-parser.js';
import type { EntitiesResult, ImportInfo } from '../types.js';
import { IGNORE_NODE_MODULES } from '../config.js';
import { normalizePathForDisplay } from '../utils/path-utils.js';
import {
  buildEnhancedPackageLockReport,
  type EnhancedEntityInfo,
  type EnhancedPackageLockReport,
} from '../reporters/json-reporter.js';
import { extractEntities } from '../core/entity-extractor.js';
import { findWasmPath } from '../utils/wasm-utils.js';
=======
  ProjectGraphBuilder,
  type GraphData,
  type GraphStats,
} from '../core/ProjectGraphBuilder.js';
import { ReportBuilder } from '../reporters/core/ReportBuilder.js';
import type { EntitiesResult } from '../types.js';
import { extractEntitiesFromFile } from '../reporters/json-reporter.js';
import { enrichWithReExports } from '../core/entity-extractor/enrich-with-re-exports.js';
>>>>>>> 202db84c78bcfab4b6bee65884d05d9f3d4c22c4

// ============================================
// ЭКСПОРТ ТИПОВ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
// ============================================

export type { GraphData };

/**
 * Результат построения графа проекта
 */
export interface ProjectGraphResult {
  rootKey: string;
  graph: Record<string, string[]>;
  entities?: Record<string, EntitiesResult>;
  packageLockReport?: any;
  callGraphResult?: CallGraphPathResult;
  relationshipGraph?: Record<string, RelationshipNode>;
  stats?: GraphStats;
  levels?: Record<string, number>;
  reExportStats?: {
    expandedChains: number;
    filesWithReExports: number;
    maxDepth: number;
  };
}

export interface CallGraphPathResult {
  found: boolean;
  path?: string[];
  reason?: string;
  nodes?: { function: string; module: string; line: number; isAsync: boolean }[];
  edges?: { from: string; to: string; line: number }[];
}

export interface RelationshipNode {
  id: string;
  name: string;
<<<<<<< HEAD
  version: string;
  lockfileVersion: number;
  packages: Record<string, PackageLockPackage>;
  dependencyGraph: {
    direction: 'bidirectional';
    inwardDependencies: Record<string, string[]>;
    outwardDependencies: Record<string, string[]>;
  };
  executionGraph: {
    entryPoint: string;
    direction: 'top-down';
    entryFunctions: string[];
    executionFlow: {
      type: 'sequential' | 'parallel' | 'conditional';
      steps: {
        func: string;
        module: string;
        direction: 'inward' | 'outward' | 'self';
        isAsync: boolean;
        branches?: Record<string, any>;
      }[];
    };
  };
  importExportFlow: {
    imports: Record<
      string,
      {
        importsFrom: {
          module: string;
          type: 'named' | 'default' | 'namespace';
          imports: string[];
        }[];
      }
    >;
    exports: Record<
      string,
      {
        exportsTo: {
          module: string;
          type: 'named' | 'default';
          exports: string[];
        }[];
      }
    >;
  };
  callGraph?: CallGraphResult;
}

// ==========================================
// ТИПЫ ДЛЯ ВСТРОЕННЫХ СВЯЗЕЙ (v3.0.1)
// ==========================================

export interface CallInfo {
  targetId: string;
  targetName: string;
  targetFile: string;
  targetLine: number;
  targetVscode: string;
  callLine: number;
  callType:
    | 'direct'
    | 'import'
    | 'computed'
    | 'watch'
    | 'event'
    | 'lifecycle'
    | 'method'
    | 'constructor';
}

export interface CalledByInfo {
  callerId: string;
  callerName: string;
  callerFile: string;
  callerLine: number;
  callerVscode: string;
  callLine: number;
  callType:
    | 'direct'
    | 'import'
    | 'computed'
    | 'watch'
    | 'event'
    | 'lifecycle'
    | 'method'
    | 'constructor';
=======
  file: string;
  line: number;
  kind: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable';
  isExported: boolean;
  isAsync: boolean;
  params: string[];
  calls: string[];
  calledBy: string[];
  importedBy: ImportedByInfo[];
>>>>>>> 202db84c78bcfab4b6bee65884d05d9f3d4c22c4
}

export interface ImportedByInfo {
  importerId: string;
  importerFile: string;
  importerVscode: string;
  importLine: number;
  specifier: string;
  importType?: 'named' | 'default' | 'namespace' | 'type';
}

<<<<<<< HEAD
export interface ExtendedFunctionInfo {
  id: string;
  name: string;
  file: string;
  line: number;
  kind: 'function';
  isExported: boolean;
  isAsync: boolean;
  params: string[];
  paramsCount: number;
  vscode: string;
  calls: CallInfo[];
  calledBy: CalledByInfo[];
  importedBy: ImportedByInfo[];
  body?: string;
  returnType?: string;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ГЕНЕРАЦИИ ID
// ==========================================

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(4, '0');
}

function generateFunctionId(filePath: string, funcName: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  const fileHash = simpleHash(relativePath);
  return `func_${fileHash}_${funcName}`;
}

function generateFileId(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return `file_${simpleHash(relativePath)}`;
}

// ==========================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРЕОБРАЗОВАНИЯ ТИПОВ
// ==========================================

function convertToImportInfo(packageLockImports: any[]): ImportInfo[] {
  if (!Array.isArray(packageLockImports)) {
    return [];
  }

  return packageLockImports.map(imp => ({
    source: imp.source || '',
    specifiers: (imp.specifiers || []).map((s: any) => {
      if (typeof s === 'string') {
        return {
          local: s,
          imported: s,
          type: 'ImportSpecifier',
        };
      }
      return {
        local: s.local || s,
        imported: s.imported || s,
        type: s.type || 'ImportSpecifier',
      };
    }),
    loc: imp.loc || null,
    isTypeOnly: imp.isTypeOnly || false,
  }));
}

function convertEnhancedToEntities(enhanced: EnhancedEntityInfo): EntitiesResult {
  return {
    functions: enhanced.functions.map(f => {
      let calledBy: string[] = [];
      if (Array.isArray(f.calledBy)) {
        calledBy = f.calledBy.map((cb: any) => {
          if (typeof cb === 'string') {
            return cb;
          } else if (cb && typeof cb === 'object') {
            if ('function' in cb) {
              return cb.function || String(cb);
            }
            if ('name' in cb) {
              return cb.name || String(cb);
            }
            return String(cb);
          }
          return String(cb);
        });
      }

      const filePath = (f as any).filePath || (f as any).file || '';

      return {
        name: f.name,
        line: f.line,
        isAsync: f.isAsync,
        isExported: f.isExported,
        params: f.params,
        returnType: f.returnType,
        calls: f.calls || [],
        calledBy: calledBy,
        body: f.body || '',
        startLine: f.startLine || f.line,
        endLine: f.endLine || f.line,
        isMethod: f.isMethod || false,
        className: f.className,
        isNested: f.isNested || false,
        parentFunction: f.parentFunction,
        isArrow: f.isArrow || false,
        isEventHandler: f.isEventHandler || false,
        eventType: f.eventType,
        depth: f.depth || 0,
        complexity: f.complexity,
        security: f.security,
        id: (f as any).id || generateFunctionId(filePath, f.name),
        vscode: (f as any).vscode || `vscode://file/${filePath}:${f.line}`,
        callsInfo: [],
        calledByInfo: [],
        importedBy: [],
      };
    }),
    classes: enhanced.classes.map(c => ({
      name: c.name,
      line: c.line,
      isExported: c.isExported,
      methods: c.methods,
      properties: c.properties,
      extends: c.extends,
      implements: c.implements || [],
      startLine: c.startLine || c.line,
      endLine: c.endLine || c.line,
    })),
    constants: enhanced.constants.map(c => ({
      name: c.name,
      line: c.line,
      isExported: c.isExported,
      value: c.value,
      type: c.type,
    })),
    interfaces: enhanced.interfaces.map(i => ({
      name: i.name,
      line: i.line,
      isExported: i.isExported,
      properties: i.properties,
      extends: i.extends || [],
      startLine: i.startLine || i.line,
      endLine: i.endLine || i.line,
    })),
    types: enhanced.types.map(t => ({
      name: t.name,
      line: t.line,
      isExported: t.isExported,
      definition: t.definition,
    })),
    variables: enhanced.variables.map(v => ({
      name: v.name,
      line: v.line,
      isExported: v.isExported,
      type: v.type,
      value: v.value,
    })),
    imports: enhanced.imports ? convertToImportInfo(enhanced.imports) : [],
    exports: (enhanced as any).exports || [],
    callGraph: {},
    moduleName: '',
    filePath: '',
  };
}

// ==========================================
// ФУНКЦИЯ ДЛЯ ПОСТРОЕНИЯ СВЯЗЕЙ МЕЖДУ СУЩНОСТЯМИ
// ==========================================

export function buildRelationships(
  entitiesMap: Record<string, EntitiesResult>
): Record<string, ExtendedFunctionInfo> {
  const result: Record<string, ExtendedFunctionInfo> = {};

  const funcIndex: Record<
    string,
    { id: string; file: string; line: number; vscode: string; isExported: boolean }
  > = {};
  const fileIndex: Record<string, { id: string; vscode: string }> = {};

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    fileIndex[filePath] = {
      id: generateFileId(filePath),
      vscode: `vscode://file/${filePath}`,
    };

    for (const func of entities.functions) {
      const funcId = func.id || generateFunctionId(filePath, func.name);
      func.id = funcId;
      func.vscode = func.vscode || `vscode://file/${filePath}:${func.line}`;
      func.callsInfo = func.callsInfo || [];
      func.calledByInfo = func.calledByInfo || [];
      func.importedBy = func.importedBy || [];

      funcIndex[func.name] = {
        id: funcId,
        file: filePath,
        line: func.line,
        vscode: func.vscode,
        isExported: func.isExported || false,
      };

      result[funcId] = {
        id: funcId,
        name: func.name,
        file: filePath,
        line: func.line,
        kind: 'function',
        isExported: func.isExported || false,
        isAsync: func.isAsync || false,
        params: func.params || [],
        paramsCount: (func.params || []).length,
        vscode: func.vscode,
        calls: [],
        calledBy: [],
        importedBy: [],
        body: func.body,
        returnType: func.returnType,
      };
    }
  }

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions) {
      const funcId = func.id || generateFunctionId(filePath, func.name);
      const extended = result[funcId];
      if (!extended) continue;

      const callNames = func.calls || [];
      extended.calls = callNames.map(callName => {
        const target = funcIndex[callName];
        if (target) {
          return {
            targetId: target.id,
            targetName: callName,
            targetFile: target.file,
            targetLine: target.line,
            targetVscode: target.vscode,
            callLine: func.line || 0,
            callType: 'direct' as const,
          };
        }

        for (const [otherFile, otherEntities] of Object.entries(entitiesMap)) {
          if (otherFile === filePath) continue;
          const found = otherEntities.functions.find(f => f.name === callName);
          if (found && found.isExported) {
            const targetInfo = funcIndex[callName];
            if (targetInfo) {
              return {
                targetId: targetInfo.id,
                targetName: callName,
                targetFile: targetInfo.file,
                targetLine: targetInfo.line,
                targetVscode: targetInfo.vscode,
                callLine: func.line || 0,
                callType: 'import' as const,
              };
            }
          }
        }

        return {
          targetId: 'unknown',
          targetName: callName,
          targetFile: 'unknown',
          targetLine: 0,
          targetVscode: '',
          callLine: func.line || 0,
          callType: 'direct' as const,
        };
      });
    }
  }

  for (const funcId of Object.keys(result)) {
    const funcInfo = result[funcId];
    if (funcInfo) {
      funcInfo.calledBy = [];
    }
  }

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions) {
      const callerId = func.id || generateFunctionId(filePath, func.name);
      const callerInfo = result[callerId];
      if (!callerInfo) continue;

      for (const call of callerInfo.calls) {
        if (call.targetId !== 'unknown') {
          const targetInfo = result[call.targetId];
          if (targetInfo) {
            targetInfo.calledBy.push({
              callerId: callerId,
              callerName: func.name,
              callerFile: filePath,
              callerLine: func.line,
              callerVscode: func.vscode || `vscode://file/${filePath}:${func.line}`,
              callLine: call.callLine,
              callType: call.callType,
            });
          }
        }
      }
    }
  }

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const fileInfo = fileIndex[filePath];
    const importerId = fileInfo?.id || generateFileId(filePath);
    const importerVscode = fileInfo?.vscode || `vscode://file/${filePath}`;

    for (const imp of entities.imports || []) {
      for (const spec of imp.specifiers) {
        const specObj = typeof spec === 'string' ? { imported: spec, local: spec } : spec;
        const importedName = specObj.imported || specObj.local || '';

        if (!importedName) continue;

        for (const [otherFile, otherEntities] of Object.entries(entitiesMap)) {
          if (otherFile === filePath) continue;
          const found = otherEntities.functions.find(f => f.name === importedName);
          if (found && found.isExported) {
            const targetId = found.id || generateFunctionId(otherFile, found.name);
            const targetInfo = result[targetId];
            if (targetInfo) {
              const exists = targetInfo.importedBy.some(
                i =>
                  i.importerFile === filePath &&
                  i.specifier === (specObj.local || importedName)
              );
              if (!exists) {
                targetInfo.importedBy.push({
                  importerId: importerId,
                  importerFile: filePath,
                  importerVscode: importerVscode,
                  importLine: imp.loc?.start?.line || 0,
                  specifier: specObj.local || importedName,
                });
              }
            }
            break;
          }
        }
      }
    }
  }

  return result;
}

// ==========================================
// ФУНКЦИЯ ДЛЯ ПОСТРОЕНИЯ ГРАФА ВЫЗОВОВ МЕЖДУ ФУНКЦИЯМИ
// ==========================================

export function buildCallGraphBetweenFunctions(
  allFunctions: Map<
    string,
    { module: string; line: number; isAsync: boolean; calls: string[] }
  >,
  fromFunction: string,
  toFunction: string
): CallGraphResult {
  if (!allFunctions.has(fromFunction)) {
    return {
      from: fromFunction,
      to: toFunction,
      path: [],
      found: false,
      reason: `Начальная функция '${fromFunction}' не найдена в проекте`,
      nodes: [],
      edges: [],
    };
  }

  if (!allFunctions.has(toFunction)) {
    return {
      from: fromFunction,
      to: toFunction,
      path: [],
      found: false,
      reason: `Конечная функция '${toFunction}' не найдена в проекте`,
      nodes: [],
      edges: [],
    };
  }

  const visited = new Set<string>();
  const queue: { func: string; path: string[] }[] = [
    { func: fromFunction, path: [fromFunction] },
  ];
  const nodes: CallGraphResult['nodes'] = [];
  const edges: CallGraphResult['edges'] = [];

  while (queue.length > 0) {
    const { func, path: currentPath } = queue.shift()!;

    if (visited.has(func)) continue;
    visited.add(func);

    const funcInfo = allFunctions.get(func);
    if (funcInfo) {
      nodes.push({
        function: func,
        module: funcInfo.module,
        line: funcInfo.line,
        isAsync: funcInfo.isAsync,
      });
    }

    if (func === toFunction) {
      return {
        from: fromFunction,
        to: toFunction,
        path: currentPath,
        found: true,
        nodes,
        edges,
      };
    }

    const info = allFunctions.get(func);
    if (info) {
      for (const call of info.calls) {
        if (!visited.has(call)) {
          queue.push({ func: call, path: [...currentPath, call] });
          edges.push({
            from: func,
            to: call,
            line: info.line,
          });
        }
      }
    }
  }

  return {
    from: fromFunction,
    to: toFunction,
    path: [],
    found: false,
    reason: `Путь от '${fromFunction}' к '${toFunction}' не найден.`,
    nodes,
    edges,
  };
}

// ==========================================
// ФУНКЦИЯ findProjectRoot
// ==========================================

function findProjectRoot(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

// ==========================================
// ФУНКЦИЯ resolveAbsoluteFilePath
// ==========================================

function resolveAbsoluteFilePath(filePath: string, projectRoot: string): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/');

  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return filePath;
  }

  const candidates = [
    path.resolve(projectRoot, filePath),
    path.resolve(projectRoot, 'src', filePath),
    path.resolve(projectRoot, 'packages/ast-analyzer/src', filePath),
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), 'src', filePath),
  ];

  const additionalCandidates = [
    path.resolve(projectRoot, normalizedPath),
    path.resolve(projectRoot, 'src', normalizedPath),
    path.resolve(projectRoot, 'packages/ast-analyzer/src', normalizedPath),
  ];
  candidates.push(...additionalCandidates);

  const vueCandidates = [
    path.resolve(projectRoot, filePath),
    path.resolve(projectRoot, 'src', filePath),
    path.resolve(projectRoot, 'packages/infoenergo-ui/src', filePath),
  ];

  if (!filePath.endsWith('.vue')) {
    const vuePath = filePath + '.vue';
    vueCandidates.push(
      path.resolve(projectRoot, vuePath),
      path.resolve(projectRoot, 'src', vuePath),
      path.resolve(projectRoot, 'packages/infoenergo-ui/src', vuePath)
    );
  }

  const allCandidates = [...candidates, ...vueCandidates];

  for (const candidate of allCandidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Игнорируем ошибки доступа
    }
  }

  return null;
}

// ==========================================
// КОНВЕРТАЦИЯ В PACKAGE-LOCK REPORT
// ==========================================

function convertToPackageLockReport(
  enhanced: EnhancedPackageLockReport,
  rootKey: string
): PackageLockReport {
  const packages: Record<string, PackageLockPackage> = {};

  for (const [key, pkg] of Object.entries(enhanced.packages || {})) {
    const imports: Record<string, PackageLockImportInfo> = {};
    for (const [impKey, impVal] of Object.entries(pkg.imports || {})) {
      imports[impKey] = {
        direction: 'inward',
        type: (impVal.type as 'import' | 'external-import' | 'internal-import') || 'import',
        specifiers: impVal.specifiers || [],
        functions: {},
      };
    }

    const exports: Record<string, PackageLockExportInfo> = {};
    for (const [expKey, expVal] of Object.entries(pkg.exports || {})) {
      const consumers = (expVal.consumers || []).map((c: any) => ({
        module: c.module || '',
        direction: 'outward' as const,
        type: (c.type || 'call') as 'import' | 'call',
      }));

      exports[expKey] = {
        direction: 'outward',
        type: 'export',
        isAsync: expVal.isAsync || false,
        params: expVal.params || [],
        returns: expVal.returns || 'any',
        line: expVal.line || 0,
        consumers: consumers,
      };
    }

    packages[key] = {
      version: pkg.version || '1.0.0',
      resolved: pkg.resolved || `file:${key}`,
      type: (pkg.type as 'module' | 'commonjs') || 'module',
      language: (pkg.language as 'typescript' | 'javascript' | 'vue' | 'jsx') || 'typescript',
      isEntry: pkg.isEntry || false,
      imports: imports,
      exports: exports,
    };
  }

  return {
    name: enhanced.name || 'ast-analyzer',
    version: enhanced.version || '3.0.0',
    lockfileVersion: enhanced.lockfileVersion || 3,
    packages,
    dependencyGraph: enhanced.dependencyGraph || {
      direction: 'bidirectional',
      inwardDependencies: {},
      outwardDependencies: {},
    },
    executionGraph: enhanced.executionGraph || {
      entryPoint: rootKey,
      direction: 'top-down',
      entryFunctions: [],
      executionFlow: {
        type: 'sequential',
        steps: [],
      },
    },
    importExportFlow: enhanced.importExportFlow || {
      imports: {},
      exports: {},
    },
    callGraph: enhanced.callGraph as CallGraphResult | undefined,
  };
}

// ==========================================
// КОНВЕРТАЦИЯ CALL GRAPH
// ==========================================

function convertCallGraphToRecord(
  callGraph: Map<string, Set<string>>
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, value] of callGraph) {
    result[key] = Array.from(value);
  }
  return result;
}

// ==========================================
// РЕКУРСИВНОЕ РАСШИРЕНИЕ ДИРЕКТОРИИ (re-exports)
// ==========================================

/**
 * Раскрывает директорию в набор файлов через её index-файл.
 *
 * Используется когда import указывает на директорию,
 * а не на конкретный файл.
 */
function expandFolderReExport(folderPath: string, _baseDir: string): string[] {
  const resolvedFiles: string[] = [];

  for (const ext of ['.ts', '.js', '.mjs', '.cjs']) {
    const indexPath = path.join(folderPath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      console.log(`   📂 Раскрываем папку: ${path.basename(folderPath)} → index${ext}`);
      const ast = parseFile(indexPath);
      if (ast) {
        // ✅ Используем extractEntities вместо удалённой collectReExports
        const entities = extractEntities(ast, indexPath);
        const reExports = (entities.exports || [])
          .filter((exp: any) => exp.isReExport && exp.source)
          .map((exp: any) => exp.source);

        for (const re of reExports) {
          const resolved = resolveFilePath(path.dirname(indexPath), re);
          if (resolved) {
            resolvedFiles.push(resolved);
            console.log(`      → ${re} → ${path.basename(resolved)}`);
          }
        }
      }
      break;
    }
  }

  return resolvedFiles;
}

// ==========================================
// ОСНОВНАЯ ФУНКЦИЯ buildProjectGraph
// ==========================================
=======
// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================
>>>>>>> 202db84c78bcfab4b6bee65884d05d9f3d4c22c4

export function buildProjectGraph(
  entryPoint: string,
  maxDepth: number = Infinity,
  includeEntities: boolean = false,
  fromFunction?: string,
  toFunction?: string
): ProjectGraphResult {
  console.log('📊 Building project graph...');
  console.log(`📄 Entry point: ${entryPoint}`);
  console.log(`📏 Max depth: ${maxDepth === Infinity ? '∞' : maxDepth}`);
  console.log(`🔍 Entities: ${includeEntities ? 'ON' : 'OFF'}`);

  if (fromFunction && toFunction) {
    console.log(`🎯 Path: ${fromFunction} → ${toFunction}`);
  }

  const startTime = Date.now();

  const builder = new ProjectGraphBuilder({
    maxDepth,
    includeExternal: false,
  });

  const graphData = builder.build(entryPoint);
  const stats = builder.getStats();
  const levels = builder.getDepthMap();

  console.log(`   ✅ Graph built: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);
  console.log(`   🔄 Cycles: ${stats.cyclesCount}`);

<<<<<<< HEAD
    if (
      currentPath.endsWith('.css') ||
      currentPath.endsWith('.scss') ||
      currentPath.endsWith('.less')
    ) {
      console.log(`⏭️ Пропуск стилевого файла: ${path.basename(currentPath)}`);
      continue;
    }

    const ast = parseFile(currentPath);
    if (!ast) {
      console.log(`   ⚠️ Не удалось получить AST для: ${path.basename(currentPath)}`);
      continue;
    }

    // ============================================
    // ✅ ЕДИНЫЙ ОБРАБОТЧИК AST
    // ============================================
    // Вся логика извлечения сущностей теперь в extractEntities.
    // Он обрабатывает: функции, классы, константы, интерфейсы, типы,
    // переменные, импорты, экспорты (включая export * from) и call graph.
    // ============================================
    const entities: EntitiesResult = extractEntities(ast, currentPath);

    // Обогащаем функции ID и VSCode-ссылками
    for (const func of entities.functions) {
      func.id = func.id || generateFunctionId(currentPath, func.name);
      func.vscode = func.vscode || `vscode://file/${currentPath}:${func.line}`;
      func.callsInfo = func.callsInfo || [];
      func.calledByInfo = func.calledByInfo || [];
      func.importedBy = func.importedBy || [];
    }

    if (includeEntities) {
      entitiesMap[relativeKey] = entities;

      for (const func of entities.functions) {
        allFunctions.set(func.name, {
          module: relativeKey,
          line: func.line,
          isAsync: func.isAsync,
          calls: func.calls || [],
        });
      }

      console.log(`   📊 ${path.basename(currentPath)}:`);
      console.log(`      Функций: ${entities.functions.length}`);
      console.log(`      Классов: ${entities.classes.length}`);
      console.log(`      Констант: ${entities.constants.length}`);
      console.log(`      Интерфейсов: ${entities.interfaces.length}`);
      console.log(`      Типов: ${entities.types.length}`);
      console.log(`      Переменных: ${entities.variables.length}`);
      console.log(`      Импортов: ${entities.imports?.length || 0}`);
      console.log(`      Экспортов: ${entities.exports?.length || 0}`);
    }

    // ============================================
    // ✅ ЗАВИСИМОСТИ (импорты + реэкспорты)
    // ============================================
    const currentDir = path.dirname(currentPath);

    const imports = (entities.imports || []).map(imp => imp.source);
    const reExports = (entities.exports || [])
      .filter((exp: any) => exp.isReExport && exp.source)
      .map((exp: any) => exp.source);

    let allDeps = [...imports, ...reExports];
    allDeps = [...new Set(allDeps)];

    if (isRoot && reExports.length > 0) {
      console.log(`   📤 Корневой файл: найдено реэкспортов: ${reExports.length}`);
    }

    if (allDeps.length > 0) {
      console.log(`   📦 ${path.basename(currentPath)}: ${allDeps.length} зависимостей`);
    }

    for (const target of allDeps) {
      const isAlias =
        target.startsWith('@') || target.startsWith('#') || target.startsWith('~');

      if (!isAlias && IGNORE_NODE_MODULES && isExternalModule(target)) {
        console.log(`      ⏭️ Пропуск внешнего: ${target}`);
        continue;
      }

      let resolvedPath = resolveFilePath(currentDir, target);

      if (!resolvedPath) {
        const asDirectory = path.resolve(currentDir, target);
        if (fs.existsSync(asDirectory) && fs.statSync(asDirectory).isDirectory()) {
          console.log(
            `   📁 Директория (не разрешена): ${target} → ${path.basename(asDirectory)}`
          );
          resolvedPath = asDirectory;
        }
      }

      if (resolvedPath) {
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
          console.log(`   📁 Раскрываем директорию: ${target}`);
          const expanded = expandFolderReExport(resolvedPath, currentDir);
          for (const exp of expanded) {
            const depKey = path.relative(process.cwd(), exp);
            console.log(`      ✅ Добавлен: ${path.basename(exp)}`);
            if (!graph[relativeKey].includes(depKey)) {
              graph[relativeKey].push(depKey);
            }
            queue.push({ path: exp, depth: depth + 1, isRoot: false });
          }
        } else {
          const depKey = path.relative(process.cwd(), resolvedPath);
          console.log(`      ✅ Разрешён: ${target} → ${path.basename(resolvedPath)}`);

          if (!graph[relativeKey].includes(depKey)) {
            graph[relativeKey].push(depKey);
          }

          queue.push({ path: resolvedPath, depth: depth + 1, isRoot: false });
        }
      } else {
        console.log(`      ❌ Не удалось разрешить: ${target}`);
        if (!graph[relativeKey].includes(target)) {
          graph[relativeKey].push(target);
        }
      }
    }
  }

  const normalizedGraph: Record<string, string[]> = {};
  for (const [key, deps] of Object.entries(graph)) {
    const normalizedKey = normalizePathForDisplay(key);
    normalizedGraph[normalizedKey] = deps.map(d => normalizePathForDisplay(d));
  }

  const result: {
    rootKey: string;
    graph: Record<string, string[]>;
    entities?: Record<string, EntitiesResult>;
    packageLockReport?: PackageLockReport;
    callGraphResult?: CallGraphResult;
    relationshipGraph?: Record<string, ExtendedFunctionInfo>;
  } = {
    rootKey: normalizePathForDisplay(
      path.relative(process.cwd(), rootAbsPath) || rootAbsPath
    ),
    graph: normalizedGraph,
=======
  const result: ProjectGraphResult = {
    rootKey: graphData.rootKey,
    graph: graphData.graph,
    stats,
    levels: Object.fromEntries(levels),
>>>>>>> 202db84c78bcfab4b6bee65884d05d9f3d4c22c4
  };

  if (includeEntities) {
    console.log('\n📦 Extracting entities...');

<<<<<<< HEAD
    if (Object.keys(entitiesMap).length === 0) {
      console.warn('⚠️ entitiesMap пуст, возможно сущности не были извлечены');
      console.warn('   💡 Попытка принудительного извлечения сущностей из всех файлов...');

      for (const modulePath of Object.keys(normalizedGraph)) {
        try {
          const absPath = path.resolve(modulePath);
          if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
            const ast = parseFile(absPath);
            if (ast) {
              const entities = extractEntities(ast, absPath);

              for (const func of entities.functions) {
                func.id = func.id || generateFunctionId(absPath, func.name);
                func.vscode = func.vscode || `vscode://file/${absPath}:${func.line}`;
                func.callsInfo = func.callsInfo || [];
                func.calledByInfo = func.calledByInfo || [];
                func.importedBy = func.importedBy || [];
              }

              const normalizedKey = normalizePathForDisplay(modulePath);
              entitiesMap[normalizedKey] = entities;

              for (const func of entities.functions) {
                allFunctions.set(func.name, {
                  module: normalizedKey,
                  line: func.line,
                  isAsync: func.isAsync,
                  calls: func.calls || [],
                });
              }
            }
=======
    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО buildEntitiesMap
    let entitiesMap: Record<string, EntitiesResult> = {};
    for (const filePath of Object.keys(graphData.graph)) {
      try {
        const absPath = path.resolve(filePath);
        if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
          const enhancedEntities = extractEntitiesFromFile(absPath);
          if (enhancedEntities && Object.keys(enhancedEntities).length > 0) {
            entitiesMap[filePath] = enhancedEntities as unknown as EntitiesResult;
>>>>>>> 202db84c78bcfab4b6bee65884d05d9f3d4c22c4
          }
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }

    // ============================================
    // 🆕 ОБОГАЩЕНИЕ RE-EXPORTS (Подход A)
    // ============================================
    // ВАЖНО: должно выполняться ДО формирования packageLockReport,
    // чтобы все связи (gr.re, gr.e) содержали развёрнутые данные.
    // ============================================
    if (Object.keys(entitiesMap).length > 0) {
      console.log('\n🔄 Разворачивание re-exports...');

      try {
        const tsProject = new Project({
          compilerOptions: {
            target: 99, // ESNext
            module: 99, // ESNext
            allowJs: true,
            checkJs: false,
            skipLibCheck: true,
            jsx: 2, // React JSX
          },
          useInMemoryFileSystem: false,
        });

        // Добавляем все файлы в проект ts-morph
        let addedFiles = 0;
        for (const filePath of Object.keys(entitiesMap)) {
          try {
            const absPath = path.resolve(filePath);
            if (fs.existsSync(absPath)) {
              tsProject.addSourceFileAtPath(absPath);
              addedFiles++;
            }
          } catch {
            // Игнорируем ошибки отдельных файлов
          }
        }

        console.log(`   📁 Файлов добавлено в ts-morph: ${addedFiles}`);

        // Разворачиваем re-exports
        const enrichResult = enrichWithReExports(tsProject, entitiesMap, {
          maxDepth: 10,
          projectRoot: process.cwd(),
          debug: false,
        });

        // ✅ Заменяем entitiesMap на обогащённый
        entitiesMap = enrichResult.enrichedEntities as Record<string, EntitiesResult>;

        console.log(`   ✅ Развёрнуто связей: ${enrichResult.stats.expandedChains}`);
        console.log(`   📁 Файлов с re-exports: ${enrichResult.stats.filesWithReExports}`);
        console.log(`   📏 Макс. глубина цепочки: ${enrichResult.stats.maxDepth}`);

        // Сохраняем статистику в результат
        result.reExportStats = {
          expandedChains: enrichResult.stats.expandedChains,
          filesWithReExports: enrichResult.stats.filesWithReExports,
          maxDepth: enrichResult.stats.maxDepth,
        };
      } catch (error) {
        console.warn(
          `   ⚠️ Не удалось развернуть re-exports: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО buildReport
    // ВАЖНО: используем ОБОГАЩЁННЫЙ entitiesMap
    const reportBuilder = new ReportBuilder();
    const report = reportBuilder.build(graphData, entitiesMap);
    const packageLockReport = {
      ...report,
      name: 'ast-analyzer',
      version: '3.1.2',
      lockfileVersion: 3,
      timestamp: new Date().toISOString(),
      dependencyGraph: {
        direction: 'bidirectional' as const,
        inwardDependencies: buildInwardDependencies(graphData.graph),
        outwardDependencies: graphData.graph,
      },
    };

    result.entities = entitiesMap;
    result.packageLockReport = packageLockReport;

    let totalFunctions = 0;
    let totalCalls = 0;
    let totalImports = 0;
    for (const entities of Object.values(entitiesMap)) {
      totalFunctions += entities.functions?.length || 0;
      for (const func of entities.functions || []) {
        totalCalls += func.calls?.length || 0;
      }
      totalImports += entities.imports?.length || 0;
    }
    console.log(`   ✅ Functions: ${totalFunctions}`);
    console.log(`   📞 Calls: ${totalCalls}`);
    console.log(`   📥 Imports: ${totalImports}`);

    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО findPathBetweenFunctions
    if (fromFunction && toFunction) {
      console.log(`\n🔍 Finding path: ${fromFunction} → ${toFunction}`);

      const nodes: string[] = packageLockReport.callGraph?.nodes || [];
      const edges: [number, number, number, number, number][] =
        packageLockReport.callGraph?.edges || [];

      const nodeIndex = new Map<string, number>();
      for (let i = 0; i < nodes.length; i++) {
        const nodeName = nodes[i];
        if (nodeName !== undefined) {
          nodeIndex.set(nodeName, i);
        }
      }

      const fromIdx = nodeIndex.get(fromFunction);
      const toIdx = nodeIndex.get(toFunction);

      let callGraphResult: CallGraphPathResult;

      if (fromIdx === undefined) {
        callGraphResult = {
          found: false,
          reason: `Function '${fromFunction}' not found in call graph`,
        };
      } else if (toIdx === undefined) {
        callGraphResult = {
          found: false,
          reason: `Function '${toFunction}' not found in call graph`,
        };
      } else {
        const callGraph: Record<number, number[]> = {};
        for (const [f, t] of edges) {
          if (!callGraph[f]) callGraph[f] = [];
          callGraph[f].push(t);
        }

        const visited = new Set<number>();
        const queue: { node: number; path: number[] }[] = [{ node: fromIdx, path: [fromIdx] }];
        let found = false;
        let pathNames: string[] = [];
        let pathNodes: { function: string; module: string; line: number; isAsync: boolean }[] = [];
        let pathEdges: { from: string; to: string; line: number }[] = [];

        while (queue.length > 0 && !found) {
          const { node, path: currentPath } = queue.shift()!;

          if (visited.has(node)) continue;
          visited.add(node);

          if (node === toIdx) {
            // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ИМЕН (исправлено)
            pathNames = currentPath.map(i => {
              const name = nodes[i];
              return name !== undefined ? name : `unknown_${i}`;
            });

            pathNodes = currentPath.map(i => ({
              function: nodes[i] !== undefined ? nodes[i] : `unknown_${i}`,
              module: 'unknown',
              line: 0,
              isAsync: false,
            }));

            pathEdges = currentPath
              .slice(0, -1)
              .map((i, idx) => {
                const nextIdx = currentPath[idx + 1];
                if (nextIdx === undefined) return null;

                const fromName = nodes[i] !== undefined ? nodes[i] : `unknown_${i}`;
                const toName = nodes[nextIdx] !== undefined ? nodes[nextIdx] : `unknown_${nextIdx}`;

                return {
                  from: fromName,
                  to: toName,
                  line: 0,
                };
              })
              .filter((item): item is { from: string; to: string; line: number } => item !== null);

            found = true;
            break;
          }

          for (const neighbor of callGraph[node] || []) {
            if (!visited.has(neighbor)) {
              queue.push({ node: neighbor, path: [...currentPath, neighbor] });
            }
          }
        }

        if (found) {
          callGraphResult = {
            found: true,
            path: pathNames,
            nodes: pathNodes,
            edges: pathEdges,
          };
        } else {
          callGraphResult = {
            found: false,
            reason: `No path found from '${fromFunction}' to '${toFunction}'`,
          };
        }
      }

      result.callGraphResult = callGraphResult;

      if (callGraphResult.found) {
        console.log(`   ✅ Path found: ${callGraphResult.path?.join(' → ')}`);
      } else {
        console.log(`   ❌ Path not found: ${callGraphResult.reason}`);
      }
    }

    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО buildRelationshipGraph
    console.log('\n🔗 Building relationship graph...');

    const relationshipGraph: Record<string, RelationshipNode> = {};
    const nodeDetails = packageLockReport.nodeDetails || {};

    for (const [idx, detail] of Object.entries(nodeDetails)) {
      const detailObj = detail as any;
      const funcName = detailObj?.n || `func_${idx}`;
      const fileId = detailObj?.f || 'unknown';
      const files = packageLockReport.files || {};
      const fileInfo = files[fileId] || { path: 'unknown' };

      relationshipGraph[funcName] = {
        id: idx,
        name: funcName,
        file: fileInfo.path || 'unknown',
        line: detailObj?.ln || 0,
        kind: (detailObj?.tp as RelationshipNode['kind']) || 'function',
        isExported: !!(detailObj?.fg & 32),
        isAsync: !!(detailObj?.fg & 1),
        params: detailObj?.p || [],
        calls: detailObj?.cl || [],
        calledBy: [],
        importedBy: [],
      };
    }

<<<<<<< HEAD
    console.log(
      `✅ Подготовлено ${Object.keys(finalEntitiesMap).length} модулей с сущностями:`
    );

    let totalFuncs = 0;
    let totalCalls = 0;
    let totalImports = 0;
    let totalReExports = 0;

    for (const [key, ents] of Object.entries(finalEntitiesMap)) {
      const funcCount = ents.functions?.length || 0;
      if (funcCount > 0) {
        totalFuncs += funcCount;
        let moduleCalls = 0;
        for (const f of ents.functions) {
          moduleCalls += (f.calls || []).length;
        }
        totalCalls += moduleCalls;
        console.log(`   • ${key}: ${funcCount} функций, ${moduleCalls} вызовов`);
      }
      const importCount = ents.imports?.length || 0;
      totalImports += importCount;

      const reExportsCount = (ents.exports || []).filter(
        (exp: any) => exp.isReExport
      ).length;
      totalReExports += reExportsCount;

      if (importCount > 0 || reExportsCount > 0) {
        console.log(
          `   • ${key}: ${importCount} импортов, ${reExportsCount} реэкспортов`
        );
      }
    }
    console.log(`   📊 Всего функций: ${totalFuncs}`);
    console.log(`   📊 Всего вызовов: ${totalCalls}`);
    console.log(`   📥 Всего импортов: ${totalImports}`);
    console.log(`   📤 Всего реэкспортов: ${totalReExports}`);

    result.entities = finalEntitiesMap;

    const allFiles = Object.keys(normalizedGraph);
    const projectRoot = findProjectRoot(process.cwd()) || process.cwd();

    const absoluteFilePaths = allFiles.map(p => {
      const resolved = resolveAbsoluteFilePath(p, projectRoot);
      return resolved || path.resolve(projectRoot, p);
    });

    const enhancedReport = buildEnhancedPackageLockReport(
      result.rootKey,
      normalizedGraph,
      finalEntitiesMap,
      absoluteFilePaths
    );

    const packageLockReport = convertToPackageLockReport(enhancedReport, result.rootKey);
    result.packageLockReport = packageLockReport;

    console.log(`✅ Отчет создан. Статистика:`);
    console.log(`   • Пакетов: ${Object.keys(packageLockReport.packages || {}).length}`);

    if (enhancedReport.entityStats) {
      console.log(`   • Функций: ${enhancedReport.entityStats.totalFunctions || 0}`);
      console.log(`   • Классов: ${enhancedReport.entityStats.totalClasses || 0}`);
      console.log(`   • Вызовов: ${enhancedReport.entityStats.totalCalls || 0}`);
    }

    if (fromFunction && toFunction) {
      const allFuncs = new Map<
        string,
        { module: string; line: number; isAsync: boolean; calls: string[] }
      >();
      for (const [modulePath, entities] of Object.entries(finalEntitiesMap)) {
        for (const func of entities.functions) {
          allFuncs.set(func.name, {
            module: modulePath,
            line: func.line,
            isAsync: func.isAsync,
            calls: func.calls || [],
          });
        }
      }
      result.callGraphResult = buildCallGraphBetweenFunctions(
        allFuncs,
        fromFunction,
        toFunction
      );
=======
    // Строим calledBy
    for (const [funcName, info] of Object.entries(relationshipGraph)) {
      for (const [otherName, otherInfo] of Object.entries(relationshipGraph)) {
        if (otherInfo.calls.includes(funcName)) {
          info.calledBy.push(otherName);
        }
      }
    }

    // Строим importedBy
    const reverseIndex = (packageLockReport as any).reverseIndex || {};
    const importedByMap = reverseIndex.importedBy || {};

    for (const [targetId, importers] of Object.entries(importedByMap)) {
      for (const [, info] of Object.entries(relationshipGraph)) {
        if (info.id === targetId) {
          for (const imp of importers as any[]) {
            info.importedBy.push({
              importerId: imp.from || '',
              importerFile: imp.file || '',
              importerVscode: imp.vscode || '',
              importLine: imp.line || 0,
              specifier: imp.specifier || '',
              importType: imp.importType || 'named',
            });
          }
          break;
        }
      }
>>>>>>> 202db84c78bcfab4b6bee65884d05d9f3d4c22c4
    }

    result.relationshipGraph = relationshipGraph;
    let totalRelations = 0;
    for (const node of Object.values(relationshipGraph)) {
      totalRelations += node.calls.length + node.calledBy.length + node.importedBy.length;
    }
    console.log(
      `   ✅ ${Object.keys(relationshipGraph).length} nodes, ${totalRelations} relations`
    );
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  Done in ${duration}s`);

  return result;
}

<<<<<<< HEAD
export default buildProjectGraph;
=======
// ============================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ============================================

function buildInwardDependencies(graph: Record<string, string[]>): Record<string, string[]> {
  const inward: Record<string, string[]> = {};
  for (const [from, deps] of Object.entries(graph)) {
    for (const to of deps) {
      if (!inward[to]) inward[to] = [];
      if (!inward[to].includes(from)) inward[to].push(from);
    }
  }
  return inward;
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
// ============================================

export function exportToDOT(graph: Record<string, string[]>): string {
  let dot = 'digraph Dependencies {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';
  for (const [from, deps] of Object.entries(graph)) {
    for (const to of deps) {
      dot += `  "${from}" -> "${to}";\n`;
    }
  }
  dot += '}\n';
  return dot;
}

export function findCyclesInGraph(graph: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string) => {
    if (recursionStack.has(node)) {
      const start = path.indexOf(node);
      if (start !== -1) cycles.push(path.slice(start));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    for (const dep of graph[node] || []) dfs(dep);
    recursionStack.delete(node);
    path.pop();
  };

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) dfs(node);
  }
  return cycles;
}

export function getGraphStats(graph: Record<string, string[]>): GraphStats {
  let totalEdges = 0;
  for (const deps of Object.values(graph)) totalEdges += deps.length;
  const cycles = findCyclesInGraph(graph);
  return {
    totalNodes: Object.keys(graph).length,
    totalEdges,
    hasCycles: cycles.length > 0,
    cyclesCount: cycles.length,
  };
}

export function findPathInGraph(
  graph: Record<string, string[]>,
  from: string,
  to: string
): string[] | null {
  if (from === to) return [from];
  const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const dep of graph[node] || []) {
      if (dep === to) return [...path, dep];
      if (!visited.has(dep)) queue.push({ node: dep, path: [...path, dep] });
    }
  }
  return null;
}

export default {
  buildProjectGraph,
  exportToDOT,
  findCyclesInGraph,
  getGraphStats,
  findPathInGraph,
  ProjectGraphBuilder,
};
>>>>>>> 202db84c78bcfab4b6bee65884d05d9f3d4c22c4
