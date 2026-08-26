// src/reporters/json-reporter.ts

import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';

// Импорт всех модулей
import type {
  GraphData,
  EntitiesResult,
  EnhancedEntityInfo,
  EnhancedPackageInfo,
  EnhancedPackageLockReport,
  ModuleNode,
  ModuleEdge,
  ModuleGraph,
  EntityNode,
  EntityEdge,
  EntityGraph,
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  PackageLockImportInfo,
  FunctionEntity,
  EnhancedFunctionInfo,
} from './modules/types.js';

import {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
} from './modules/utils.js';

import {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from './modules/metadata.js';

import { calculateEntityStats, calculateFileStats } from './modules/statistics.js';

import {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from './modules/graphs.js';

import { buildExecutionGraph, buildImportExportFlow } from './modules/flows.js';

import { buildArchitectureMetrics } from './modules/architecture.js';

import { buildSummary } from './modules/summary.js';

import { buildPackages } from './modules/packages.js';

import { convertToEnhancedEntityInfo } from './modules/converters.js';

// ============================================================
// ИМПОРТ ДЛЯ VUE АНАЛИЗАТОРА
// ============================================================

import { analyzeVueComponent } from '../modes/vue-analyzer/index.js';
import { createDefaultSecurity } from './modules/types.js';

// ============================================================
// ЭКСПОРТ ВСЕХ ТИПОВ
// ============================================================

export type {
  GraphData,
  EntitiesResult,
  EnhancedEntityInfo,
  EnhancedPackageInfo,
  EnhancedPackageLockReport,
  PackageLockImportInfo,
  ModuleNode,
  ModuleEdge,
  ModuleGraph,
  EntityNode,
  EntityEdge,
  EntityGraph,
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  FunctionEntity,
};

// ============================================================
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ
// ============================================================

export {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
} from './modules/utils.js';

export {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from './modules/metadata.js';

export { calculateEntityStats, calculateFileStats } from './modules/statistics.js';

export {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from './modules/graphs.js';

export { buildExecutionGraph, buildImportExportFlow } from './modules/flows.js';

export { buildArchitectureMetrics } from './modules/architecture.js';

export { buildSummary } from './modules/summary.js';

export { buildPackages } from './modules/packages.js';

export { convertToEnhancedEntityInfo } from './modules/converters.js';

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ ЯЗЫКА
// ============================================================

function detectLanguage(modulePath: string): 'typescript' | 'javascript' | 'vue' | 'jsx' {
  if (modulePath.endsWith('.vue')) return 'vue';
  if (modulePath.endsWith('.tsx')) return 'jsx';
  if (modulePath.endsWith('.jsx')) return 'jsx';
  if (modulePath.endsWith('.ts')) return 'typescript';
  return 'javascript';
}

// ============================================================
// ФУНКЦИИ ДЛЯ ВЫЧИСЛЕНИЯ CONSUMERS
// ============================================================

/**
 * Получает локальное имя импортированной функции (если она импортирована под другим именем)
 */
function getImportedName(
  modulePath: string,
  originalName: string,
  entitiesMap: Record<string, EntitiesResult>
): string | null {
  const entities = entitiesMap[modulePath];
  if (!entities) return null;

  for (const imp of entities.imports || []) {
    for (const spec of imp.specifiers) {
      const specObj = typeof spec === 'string' ? { imported: spec, local: spec } : spec;

      if (specObj.imported === originalName) {
        return specObj.local || specObj.imported;
      }
    }
  }

  return null;
}

/**
 * Разрешает путь импорта до модуля в графе
 */
function resolveImportPath(
  fromModule: string,
  importPath: string,
  graph: Record<string, string[]>
): string | null {
  // Проверяем, есть ли такой путь в графе напрямую
  if (graph[importPath]) {
    return importPath;
  }

  // Пытаемся найти модуль по имени файла
  const fileName = importPath.split('/').pop() || '';
  const baseName = fileName.replace(/\.[^.]+$/, '');

  for (const modulePath of Object.keys(graph)) {
    const moduleFileName = modulePath.split('/').pop() || '';
    const moduleBaseName = moduleFileName.replace(/\.[^.]+$/, '');

    // Проверяем совпадение по имени файла
    if (moduleBaseName === baseName || moduleFileName === fileName) {
      return modulePath;
    }

    // Проверяем, не является ли импорт путем к директории (index файл)
    if (importPath.endsWith('/' + baseName) || importPath === baseName) {
      const indexPath = `${importPath}/index.ts`;
      if (graph[indexPath]) {
        return indexPath;
      }
    }
  }

  // Проверяем, не является ли импорт относительным путем
  if (importPath.startsWith('.')) {
    const fromDir = fromModule.split('/').slice(0, -1).join('/');
    const resolved = `${fromDir}/${importPath}`;

    // Пробуем разные расширения
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (graph[candidate]) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Находит все модули, которые вызывают указанную функцию
 */
function findFunctionCallers(
  functionName: string,
  entitiesMap: Record<string, EntitiesResult>,
  _graph: Record<string, string[]>
): { module: string; line: number }[] {
  const callers: { module: string; line: number }[] = [];

  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const calls = func.calls || [];
      for (const call of calls) {
        const importedName = getImportedName(modulePath, functionName, entitiesMap);
        if (call === functionName || call === importedName) {
          callers.push({
            module: modulePath,
            line: func.line || 0,
          });
          break;
        }
      }
    }
  }

  return callers;
}

/**
 * Вычисляет consumers для всех экспортов на основе графа зависимостей
 * С ДОБАВЛЕНИЕМ ИНФОРМАЦИИ О КОНКРЕТНЫХ ИМПОРТИРУЕМЫХ СУЩНОСТЯХ
 */
function computeExportConsumers(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  exportsMap: Record<string, Record<string, any>>
): void {
  // 1. Анализируем импорты
  for (const [modulePath] of Object.entries(graph)) {
    const entities = entitiesMap[modulePath];
    if (!entities) continue;

    const imports = entities.imports || [];

    for (const imp of imports) {
      const source = imp.source;
      if (!source) continue;

      const resolvedModule = resolveImportPath(modulePath, source, graph);
      if (!resolvedModule) continue;

      const targetExports = exportsMap[resolvedModule];
      if (!targetExports) continue;

      // Для каждого импортированного имени добавляем consumer
      for (const spec of imp.specifiers) {
        const specObj = typeof spec === 'string' ? { imported: spec, local: spec } : spec;
        const importedName = specObj.imported || specObj.local || '';

        if (!importedName) continue;

        // Проверяем, существует ли такой экспорт в целевом модуле
        const targetExport = targetExports[importedName];
        if (!targetExport) continue;

        if (!targetExport.consumers) {
          targetExport.consumers = [];
        }

        // Проверяем, не добавлен ли уже такой consumer
        const alreadyExists = targetExport.consumers.some(
          (c: any) => c.module === modulePath && c.type === 'import' && c.specifier === importedName
        );

        if (!alreadyExists) {
          targetExport.consumers.push({
            module: modulePath,
            direction: 'inward',
            type: 'import',
            specifier: importedName,
            localName: specObj.local || specObj.imported,
          });
        }
      }
    }
  }

  // 2. Анализируем вызовы функций
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    const targetExports = exportsMap[modulePath];
    if (!targetExports) continue;

    for (const func of entities.functions || []) {
      if (!func.isExported || !func.name) continue;

      const exportName = func.name;
      const targetExport = targetExports[exportName];
      if (!targetExport) continue;

      const callers = findFunctionCallers(func.name, entitiesMap, graph);

      for (const caller of callers) {
        if (!targetExport.consumers) {
          targetExport.consumers = [];
        }

        const alreadyExists = targetExport.consumers.some(
          (c: any) => c.module === caller.module && c.type === 'call'
        );

        if (!alreadyExists) {
          targetExport.consumers.push({
            module: caller.module,
            direction: 'inward',
            type: 'call',
            line: caller.line,
            specifier: func.name,
          });
        }
      }
    }
  }
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ ПОСТРОЕНИЯ ОТЧЕТА
// ============================================================

export function buildEnhancedPackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _filePaths?: string[],
  _options?: { includeBody?: boolean }
): EnhancedPackageLockReport {
  const projectRoot = findProjectRoot(process.cwd()) || process.cwd();

  const metadata = createMetadata();
  const packages = buildPackages(rootKey, graph, entitiesMap, projectRoot, _options);

  // ✅ ДОБАВЛЯЕМ ИМПОРТЫ В ПАКЕТЫ
  for (const [modulePath, pkg] of Object.entries(packages)) {
    const entities = entitiesMap[modulePath];
    if (!entities) continue;

    // Сохраняем импорты в пакет
    if (entities.imports && entities.imports.length > 0) {
      pkg.imports = {};
      for (const imp of entities.imports) {
        pkg.imports[imp.source] = {
          direction: 'inward',
          type: 'import',
          specifiers: imp.specifiers.map(s =>
            typeof s === 'string' ? s : s.imported || s.local
          ),
          functions: {}
        };
      }
    }
  }

  const dependencyGraph = buildDependencyGraph(graph);
  const executionGraph = buildExecutionGraph(rootKey, entitiesMap, { rootKey, graph }, packages);
  const importExportFlow = buildImportExportFlow(graph, entitiesMap, { rootKey, graph }, packages);

  const callGraph: Record<string, string[]> = {};
  for (const entities of Object.values(entitiesMap)) {
    if (!entities) continue;
    const functions = ensureArray(entities.functions) as FunctionEntity[];
    for (const func of functions) {
      const key = func.isMethod && func.className ? `${func.className}.${func.name}` : func.name;
      if (!callGraph[key]) {
        callGraph[key] = [];
      }
      const calls = func.calls || [];
      callGraph[key] = calls;
    }
  }

  const entityStats = calculateEntityStats(packages, callGraph);
  const fileStats = calculateFileStats(packages);
  const architectureMetrics = buildArchitectureMetrics(
    packages,
    callGraph,
    dependencyGraph.outwardDependencies
  );
  const summary = buildSummary(rootKey, architectureMetrics, packages);

  return {
    ...metadata,
    packages,
    dependencyGraph,
    executionGraph,
    importExportFlow,
    callGraph,
    entityStats,
    fileStats,
    architectureMetrics,
    summary,
  };
}

// ============================================================
// ОБНОВЛЕННАЯ ФУНКЦИЯ savePackageLockReport
// ============================================================

export function savePackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _filePaths: string[],
  outputPath: string,
  _options?: { includeBody?: boolean }
): void {
  // Нормализуем сущности
  const normalizedEntitiesMap: Record<string, EntitiesResult> = {};
  for (const [key, entities] of Object.entries(entitiesMap)) {
    if (!entities || typeof entities !== 'object') {
      normalizedEntitiesMap[key] = {
        functions: [],
        classes: [],
        constants: [],
        interfaces: [],
        types: [],
        variables: [],
        imports: [],
        exports: [],
        callGraph: {},
        moduleName: '',
        filePath: '',
      };
      continue;
    }

    normalizedEntitiesMap[key] = {
      functions: ensureArray(entities.functions).map((f: any) => ({
        ...f,
        calls: ensureArray(f.calls),
        calledBy: ensureArray(f.calledBy),
        body: f.body || '',
        complexity: f.complexity || 1,
        security: f.security || {
          hasEval: false,
          hasProcessEnv: false,
          hasSensitiveData: false,
          hasExec: false,
          hasPassword: false,
        },
      })),
      classes: ensureArray(entities.classes),
      constants: ensureArray(entities.constants),
      interfaces: ensureArray(entities.interfaces),
      types: ensureArray(entities.types),
      variables: ensureArray(entities.variables),
      imports: ensureArray(entities.imports),
      exports: ensureArray(entities.exports),
      callGraph: entities.callGraph || {},
      moduleName: entities.moduleName || '',
      filePath: entities.filePath || '',
    };
  }

  // 1. Строим пакеты с экспортами (без consumers пока)
  const packages: Record<string, any> = {};
  const exportsMap: Record<string, Record<string, any>> = {};

  for (const [modulePath, entities] of Object.entries(normalizedEntitiesMap)) {
    if (!entities) continue;

    const exports: Record<string, any> = {};

    // Функции
    for (const func of entities.functions || []) {
      if (func.isExported && func.name) {
        exports[func.name] = {
          direction: 'outward',
          type: 'function',
          isAsync: func.isAsync || false,
          params: func.params || [],
          returns: func.returnType || 'any',
          line: func.line || 0,
          consumers: [],
        };
      }
    }

    // Константы
    for (const constItem of entities.constants || []) {
      if (constItem.isExported && constItem.name) {
        exports[constItem.name] = {
          direction: 'outward',
          type: 'constant',
          value: constItem.value,
          line: constItem.line || 0,
          consumers: [],
        };
      }
    }

    // Переменные
    for (const varItem of entities.variables || []) {
      if (varItem.isExported && varItem.name) {
        exports[varItem.name] = {
          direction: 'outward',
          type: 'variable',
          value: varItem.value,
          line: varItem.line || 0,
          consumers: [],
        };
      }
    }

    // Классы
    for (const cls of entities.classes || []) {
      if (cls.isExported && cls.name) {
        exports[cls.name] = {
          direction: 'outward',
          type: 'class',
          methods: cls.methods || [],
          line: cls.line || 0,
          consumers: [],
        };
      }
    }

    // Интерфейсы
    for (const intf of entities.interfaces || []) {
      if (intf.isExported && intf.name) {
        exports[intf.name] = {
          direction: 'outward',
          type: 'interface',
          properties: intf.properties || [],
          line: intf.line || 0,
          consumers: [],
        };
      }
    }

    // Типы
    for (const type of entities.types || []) {
      if (type.isExported && type.name) {
        exports[type.name] = {
          direction: 'outward',
          type: 'type',
          definition: type.definition || '',
          line: type.line || 0,
          consumers: [],
        };
      }
    }

    exportsMap[modulePath] = exports;

    // Импорты
    const imports: Record<string, any> = {};
    for (const imp of entities.imports || []) {
      if (imp.source) {
        imports[imp.source] = {
          direction: 'inward',
          type: 'import',
          specifiers: (imp.specifiers || []).map((s: any) =>
            typeof s === 'string' ? s : s.imported || s.local || ''
          ),
          functions: {},
        };
      }
    }

    const language = detectLanguage(modulePath);
    const isEntry = modulePath === rootKey;

    packages[modulePath] = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      displayPath: modulePath,
      type: 'module',
      language,
      isEntry,
      imports,
      exports: exports,
      entities: {
        functions: entities.functions || [],
        constants: entities.constants || [],
        variables: entities.variables || [],
        interfaces: entities.interfaces || [],
        types: entities.types || [],
        classes: entities.classes || [],
      },
      fileStats: {
        size: 0,
        lines: 0,
        functions: (entities.functions || []).length,
        classes: (entities.classes || []).length,
        constants: (entities.constants || []).length,
        interfaces: (entities.interfaces || []).length,
        types: (entities.types || []).length,
        variables: (entities.variables || []).length,
      },
      vscode: `vscode://file/${modulePath}`,
    };
  }

  // 2. Вычисляем consumers для всех экспортов
  computeExportConsumers(graph, normalizedEntitiesMap, exportsMap);

  // 3. Обновляем пакеты с вычисленными consumers
  for (const [modulePath, pkg] of Object.entries(packages)) {
    if (exportsMap[modulePath]) {
      pkg.exports = exportsMap[modulePath];
    }
  }

  // 4. Строим остальную часть отчета
  const dependencyGraph = buildDependencyGraph(graph);
  const executionGraph = buildExecutionGraph(
    rootKey,
    normalizedEntitiesMap,
    { rootKey, graph },
    packages
  );
  const importExportFlow = buildImportExportFlow(
    graph,
    normalizedEntitiesMap,
    { rootKey, graph },
    packages
  );

  const callGraph: Record<string, string[]> = {};
  for (const entities of Object.values(normalizedEntitiesMap)) {
    if (!entities) continue;
    const functions = ensureArray(entities.functions) as FunctionEntity[];
    for (const func of functions) {
      const key = func.isMethod && func.className ? `${func.className}.${func.name}` : func.name;
      if (!callGraph[key]) {
        callGraph[key] = [];
      }
      const calls = func.calls || [];
      callGraph[key] = calls;
    }
  }

  const entityStats = calculateEntityStats(packages, callGraph);
  const fileStats = calculateFileStats(packages);
  const architectureMetrics = buildArchitectureMetrics(
    packages,
    callGraph,
    dependencyGraph.outwardDependencies
  );
  const summary = buildSummary(rootKey, architectureMetrics, packages);

  const report = {
    name: 'ast-analyzer',
    version: '3.0.0',
    lockfileVersion: 3,
    packages,
    dependencyGraph,
    executionGraph,
    importExportFlow,
    callGraph,
    entityStats,
    fileStats,
    architectureMetrics,
    summary,
    timestamp: new Date().toISOString(),
  };

  const json = JSON.stringify(
    report,
    (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      if (key === '_safeInfo' || key === '__proto__' || key === 'constructor') {
        return undefined;
      }
      return value;
    },
    2
  );

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json, 'utf-8');

  let totalWithBodies = 0;
  let totalWithVSCode = 0;
  for (const pkg of Object.values(report.packages || {})) {
    for (const func of pkg.entities?.functions || []) {
      if (func.body) totalWithBodies++;
      if (func.vscode) totalWithVSCode++;
    }
  }

  console.log(`✅ Enhanced package-lock report saved: ${outputPath}`);
  console.log(`📊 Functions: ${report.entityStats?.totalFunctions || 0}`);
  console.log(`📊 Constants: ${report.entityStats?.totalConstants || 0}`);
  console.log(`📊 Variables: ${report.entityStats?.totalVariables || 0}`);
  console.log(`📊 Interfaces: ${report.entityStats?.totalInterfaces || 0}`);
  console.log(`📊 Types: ${report.entityStats?.totalTypes || 0}`);
  console.log(`📊 Classes: ${report.entityStats?.totalClasses || 0}`);
  console.log(`📞 Calls: ${report.entityStats?.totalCalls || 0}`);
  console.log(`📁 Files: ${report.fileStats?.totalFiles || 0}`);
  console.log(`📝 Lines: ${report.fileStats?.totalLines || 0}`);
  console.log(`💾 Size: ${((report.fileStats?.totalSize || 0) / 1024).toFixed(2)} KB`);
  console.log(`📖 Functions with body: ${totalWithBodies}`);
  console.log(`🔗 Functions with VSCode link: ${totalWithVSCode}`);

  if (report.architectureMetrics) {
    console.log(`🏗️  Architecture: ${report.summary?.architectureHealth || 'unknown'}`);
    console.log(`   📦 Vue components: ${report.architectureMetrics.vueComponents}`);
    console.log(`   🔄 Cycles: ${report.architectureMetrics.hasCycles ? '⚠️ YES' : '✅ NO'}`);
    console.log(`   📏 Max depth: ${report.architectureMetrics.maxDepth}`);
  }
}

// ============================================================
// ОСТАВШИЕСЯ ФУНКЦИИ (buildModuleGraph, buildEntityGraph, buildFullAnalysis, save*)
// ============================================================

export function buildModuleGraph(data: GraphData, entities: EntitiesResult): ModuleGraph {
  const nodes: ModuleNode[] = [];
  const edges: ModuleEdge[] = [];

  const allModules = new Set<string>();
  allModules.add(data.rootKey);

  for (const [key, deps] of Object.entries(data.graph)) {
    allModules.add(key);
    const depsArray = deps as string[];
    for (const dep of depsArray) {
      allModules.add(dep);
    }
  }

  for (const modulePath of allModules) {
    const isEntry = modulePath === data.rootKey;

    let language: 'javascript' | 'typescript' | 'vue' | 'jsx' | 'unknown' = 'javascript';
    if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) language = 'typescript';
    else if (modulePath.endsWith('.vue')) language = 'vue';
    else if (modulePath.endsWith('.jsx')) language = 'jsx';
    else language = 'unknown';

    let size = 0;
    let lines = 0;
    try {
      const absPath = path.resolve(modulePath);
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        const content = fs.readFileSync(absPath, 'utf-8');
        size = content.length;
        lines = content.split('\n').length;
      }
    } catch (error: any) {
      // Игнорируем ошибки
    }

    nodes.push({
      id: modulePath,
      name: path.basename(modulePath),
      type: modulePath.endsWith('.vue') ? 'vue' : 'module',
      level: modulePath === data.rootKey ? 0 : 1,
      metadata: { size, lines, language, isEntry },
    });
  }

  for (const [from, deps] of Object.entries(data.graph)) {
    const depsArray = deps as string[];
    for (const to of depsArray) {
      const isExternal = to.startsWith('@') || to.includes('/');
      const specifiers: string[] = [];
      for (const entity of entities.functions) {
        if (entity.isExported && (to.includes(entity.name) || entity.name.includes(to))) {
          specifiers.push(entity.name);
        }
      }
      edges.push({
        from,
        to,
        type: isExternal ? 'external' : 'import',
        specifiers:
          specifiers.length > 0 ? specifiers : [path.basename(to).replace(/\.[^.]+$/, '')],
      });
    }
  }

  return { nodes, edges };
}

export function buildEntityGraph(data: GraphData, entities: EntitiesResult): EntityGraph {
  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];

  const functions = ensureArray(entities.functions) as FunctionEntity[];

  for (const func of functions) {
    const funcName = safeString(func.name);
    const modulePath = findModuleForEntity(funcName, data);
    const nodeId = modulePath ? `${modulePath}#${funcName}` : `#${funcName}`;
    const calls: string[] = ensureArray(func.calls).map((call: any) => safeString(call));
    const calledBy: string[] = ensureArray(func.calledBy).map((cb: any) => safeString(cb));

    const funcAny = func as any;

    const metadata: EntityNode['metadata'] = {
      isExported: safeBoolean(func.isExported),
      params: ensureArray(func.params).map((p: any) => safeString(p)),
      returnType: safeString(func.returnType),
      isAsync: safeBoolean(func.isAsync),
      isMethod: safeBoolean(func.isMethod),
      className: safeString(func.className),
      calls: calls,
      calledBy: calledBy,
      startLine: safeNumber(func.startLine || func.line),
      endLine: safeNumber(func.endLine || func.line),
      complexity: safeNumber(func.complexity),
      security: func.security || {
        hasEval: false,
        hasProcessEnv: false,
        hasSensitiveData: false,
        hasExec: false,
        hasPassword: false,
      },
      body: func.body || '',
      signature: funcAny.signature || '',
      vscode: funcAny.vscode || '',
    };

    // Добавляем importedFrom только если модуль отличается от корневого
    if (modulePath && modulePath !== data.rootKey) {
      metadata.importedFrom = modulePath;
    }

    nodes.push({
      id: nodeId,
      name: funcName,
      type: 'function',
      module: modulePath || 'unknown',
      line: safeNumber(func.line),
      metadata,
    });

    for (const call of calls) {
      let targetModule = findModuleForEntity(call, data);
      if (!targetModule) {
        for (const [modPath, deps] of Object.entries(data.graph)) {
          const depsArray = deps as string[];
          if (modPath.includes(call) || depsArray.some((d: string) => d.includes(call))) {
            targetModule = modPath;
            break;
          }
        }
      }
      const targetId = targetModule ? `${targetModule}#${call}` : `#${call}`;
      edges.push({
        from: nodeId,
        to: targetId,
        type: 'function_call',
        line: safeNumber(func.line),
      });
    }
  }

  // Классы
  for (const cls of entities.classes) {
    const className = safeString(cls.name);
    const modulePath = findModuleForEntity(className, data);
    const nodeId = modulePath ? `${modulePath}#${className}` : `#${className}`;

    const metadata: EntityNode['metadata'] = {
      isExported: safeBoolean(cls.isExported),
      methods: ensureArray(cls.methods).map((m: any) => safeString(m)),
      properties: ensureArray(cls.properties).map((p: any) => safeString(p)),
      extends: safeString(cls.extends) || undefined,
      implements: ensureArray(cls.implements).map((i: any) => safeString(i)),
      startLine: safeNumber(cls.startLine || cls.line),
      endLine: safeNumber(cls.endLine || cls.line),
      body: '',
      vscode: '',
    };

    nodes.push({
      id: nodeId,
      name: className,
      type: 'class',
      module: modulePath || 'unknown',
      line: safeNumber(cls.line),
      metadata,
    });

    if (cls.extends) {
      const targetModule = findModuleForEntity(safeString(cls.extends), data);
      const targetId = targetModule
        ? `${targetModule}#${safeString(cls.extends)}`
        : `#${safeString(cls.extends)}`;
      edges.push({
        from: nodeId,
        to: targetId,
        type: 'class_extends',
      });
    }

    for (const impl of ensureArray(cls.implements)) {
      const implName = safeString(impl);
      const targetModule = findModuleForEntity(implName, data);
      const targetId = targetModule ? `${targetModule}#${implName}` : `#${implName}`;
      edges.push({
        from: nodeId,
        to: targetId,
        type: 'class_implements',
      });
    }
  }

  // Константы
  for (const constant of entities.constants) {
    const constName = safeString(constant.name);
    const modulePath = findModuleForEntity(constName, data);
    const nodeId = modulePath ? `${modulePath}#${constName}` : `#${constName}`;

    nodes.push({
      id: nodeId,
      name: constName,
      type: 'constant',
      module: modulePath || 'unknown',
      line: safeNumber(constant.line),
      metadata: {
        isExported: safeBoolean(constant.isExported),
        value: constant.value,
        dataType: safeString(constant.type),
      },
    });
  }

  // Интерфейсы
  for (const intf of entities.interfaces) {
    const intfName = safeString(intf.name);
    const modulePath = findModuleForEntity(intfName, data);
    const nodeId = modulePath ? `${modulePath}#${intfName}` : `#${intfName}`;

    // Преобразуем массив extends в строку для metadata
    const extendsStr = ensureArray(intf.extends)
      .map((e: any) => safeString(e))
      .filter((e): e is string => e !== undefined && e !== '')
      .join(', ');

    nodes.push({
      id: nodeId,
      name: intfName,
      type: 'interface',
      module: modulePath || 'unknown',
      line: safeNumber(intf.line),
      metadata: {
        isExported: safeBoolean(intf.isExported),
        properties: ensureArray(intf.properties).map((p: any) => safeString(p)),
        extends: extendsStr || undefined,
        startLine: safeNumber(intf.startLine || intf.line),
        endLine: safeNumber(intf.endLine || intf.line),
      },
    });

    // Ребра для каждого extends (сохраняем как отдельные связи)
    for (const ext of ensureArray(intf.extends)) {
      const extName = safeString(ext);
      const targetModule = findModuleForEntity(extName, data);
      const targetId = targetModule ? `${targetModule}#${extName}` : `#${extName}`;
      edges.push({
        from: nodeId,
        to: targetId,
        type: 'interface_extends',
      });
    }
  }

  // Типы
  for (const type of entities.types) {
    const typeName = safeString(type.name);
    const modulePath = findModuleForEntity(typeName, data);
    const nodeId = modulePath ? `${modulePath}#${typeName}` : `#${typeName}`;

    nodes.push({
      id: nodeId,
      name: typeName,
      type: 'type',
      module: modulePath || 'unknown',
      line: safeNumber(type.line),
      metadata: {
        isExported: safeBoolean(type.isExported),
        definition: safeString(type.definition),
      },
    });
  }

  // Переменные
  for (const variable of entities.variables) {
    const varName = safeString(variable.name);
    const modulePath = findModuleForEntity(varName, data);
    const nodeId = modulePath ? `${modulePath}#${varName}` : `#${varName}`;

    nodes.push({
      id: nodeId,
      name: varName,
      type: 'variable',
      module: modulePath || 'unknown',
      line: safeNumber(variable.line),
      metadata: {
        isExported: safeBoolean(variable.isExported),
        dataType: safeString(variable.type),
        value: variable.value,
      },
    });
  }

  return { nodes, edges };
}

export function buildFullAnalysis(
  data: GraphData,
  entities: EntitiesResult,
  root: string
): FullAnalysis {
  const allEntities =
    entities.functions.length +
    entities.classes.length +
    entities.constants.length +
    entities.interfaces.length +
    entities.types.length +
    entities.variables.length;

  const cycles = data.cyclicEdges?.map((edge: string) => edge.split('->')) || [];

  const totalFunctions = entities.functions.length;
  const totalClasses = entities.classes.length;
  const totalConstants = entities.constants.length;
  const totalInterfaces = entities.interfaces.length;
  const totalTypes = entities.types.length;
  const totalVariables = entities.variables.length;

  let maxDepth = 0;
  for (const deps of Object.values(data.graph)) {
    const depsArray = deps as string[];
    if (depsArray.length > maxDepth) maxDepth = depsArray.length;
  }

  const analysis: FullAnalysis = {
    version: '3.0.0',
    root,
    timestamp: new Date().toISOString(),
    stats: {
      totalModules: Object.keys(data.graph).length,
      totalEntities: allEntities,
      hasCycles: data.hasCycles || false,
      cycles,
      totalFunctions,
      totalClasses,
      totalConstants,
      totalInterfaces,
      totalTypes,
      totalVariables,
      maxDepth,
    },
    moduleGraph: buildModuleGraph(data, entities),
    entityGraph: buildEntityGraph(data, entities),
  };

  const safeAnalysis = safeTraverseAST(analysis);
  (analysis as any)._safeCopy = safeAnalysis;

  return analysis;
}

export function saveModuleGraph(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string
): void {
  const moduleGraph = buildModuleGraph(data, entities);
  const safeData = safeTraverseAST(moduleGraph);
  const json = JSON.stringify(safeData, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

export function saveEntityGraph(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string
): void {
  const entityGraph = buildEntityGraph(data, entities);
  const safeData = safeTraverseAST(entityGraph);
  const json = JSON.stringify(safeData, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

export function saveFullAnalysis(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string,
  root: string
): void {
  const fullAnalysis = buildFullAnalysis(data, entities, root);
  const safeData = safeTraverseAST(fullAnalysis);
  const json = JSON.stringify(safeData, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

export function saveCallGraphResult(callGraphResult: any, outputPath: string): void {
  const safeData = safeTraverseAST(callGraphResult);
  const json = JSON.stringify(safeData, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

// ============================================================
// ФУНКЦИЯ extractEntitiesFromFile (ОБНОВЛЕННАЯ)
// ============================================================

function createEnhancedFunctionFromVue(func: any): EnhancedFunctionInfo {
  return {
    name: func.name || 'anonymous',
    params: func.params || [],
    paramTypes: func.params?.map(() => 'any') || [],
    line: func.line || 0,
    startLine: func.startLine || func.line || 0,
    endLine: func.endLine || func.line || 0,
    isAsync: func.isAsync || false,
    isExported: func.isExported || false,
    isMethod: false,
    className: func.className || '',
    calls: func.calls || [],
    calledBy: func.calledBy || [],
    returnType: func.returnType || 'any',
    body: func.body || '',
    isNested: false,
    parentFunction: func.parentFunction || '',
    isArrow: func.isArrow || false,
    isEventHandler: func.isEventHandler || false,
    eventType: func.eventType || '',
    depth: func.depth || 0,
    complexity: func.complexity || 1,
    security: createDefaultSecurity(),
    vscode: '',
    signature: '',
    _safeInfo: null,
  };
}

function createEnhancedConstantFromVue(constItem: any): EnhancedEntityInfo['constants'][0] {
  return {
    name: constItem.name || 'unknown',
    line: constItem.line || 0,
    isExported: constItem.isExported || false,
    type: constItem.type || 'any',
    value: constItem.value,
    _safeInfo: null,
  };
}

function createEnhancedInterfaceFromVue(intf: any): EnhancedEntityInfo['interfaces'][0] {
  return {
    name: intf.name || 'unknown',
    properties: intf.properties || [],
    line: intf.line || 0,
    startLine: intf.startLine || intf.line || 0,
    endLine: intf.endLine || intf.line || 0,
    isExported: intf.isExported || false,
    extends: intf.extends || [],
    _safeInfo: null,
  };
}

function createEnhancedTypeFromVue(type: any): EnhancedEntityInfo['types'][0] {
  return {
    name: type.name || 'unknown',
    definition: type.definition || 'unknown',
    line: type.line || 0,
    isExported: type.isExported || false,
    _safeInfo: null,
  };
}

export function extractEntitiesFromFile(filePath: string): EnhancedEntityInfo {
  const entities: EnhancedEntityInfo = {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
    imports: [],
  };

  const absolutePath = filePath;

  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️ Файл не найден: ${absolutePath}`);
    return entities;
  }

  // ============================================
  // ✅ 1. VUE ФАЙЛЫ - используем analyzeVueComponent
  // ============================================
  if (filePath.endsWith('.vue')) {
    try {
      const vueAnalysis = analyzeVueComponent(filePath);
      if (vueAnalysis) {
        for (const func of vueAnalysis.functions || []) {
          entities.functions.push(createEnhancedFunctionFromVue(func));
        }

        for (const constItem of vueAnalysis.constants || []) {
          entities.constants.push(createEnhancedConstantFromVue(constItem));
        }

        for (const varItem of vueAnalysis.variables || []) {
          entities.variables.push({
            name: varItem.name || 'unknown',
            line: varItem.line || 0,
            isExported: varItem.isExported || false,
            type: varItem.type || 'any',
            value: varItem.value,
            _safeInfo: null,
          });
        }

        for (const intf of vueAnalysis.interfaces || []) {
          entities.interfaces.push(createEnhancedInterfaceFromVue(intf));
        }

        for (const type of vueAnalysis.types || []) {
          entities.types.push(createEnhancedTypeFromVue(type));
        }

        // ✅ ДОБАВЛЯЕМ ИМПОРТЫ ИЗ VUE
        for (const imp of vueAnalysis.imports || []) {
          entities.imports!.push({
            source: imp.source,
            specifiers: imp.specifiers,
            isTypeOnly: imp.isTypeOnly || false,
          });
        }

        console.log(`✅ Vue-анализ для ${path.basename(filePath)}:`);
        console.log(`   Функций: ${entities.functions.length}`);
        console.log(`   Констант: ${entities.constants.length}`);
        console.log(`   Переменных: ${entities.variables.length}`);
        console.log(`   Интерфейсов: ${entities.interfaces.length}`);
        console.log(`   Типов: ${entities.types.length}`);
        console.log(`   Импортов: ${entities.imports?.length || 0}`);

        return entities;
      }
    } catch (error) {
      console.warn(`⚠️ Vue-анализ не удался для ${path.basename(filePath)}:`, error);
    }
  }

  // ============================================
  // ✅ 2. TYPE SCRIPT ФАЙЛЫ - через ts-morph
  // ============================================
  try {
    const project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        jsx: 2,
      },
      useInMemoryFileSystem: false,
    });

    const sourceFile = project.addSourceFileAtPath(absolutePath);
    if (!sourceFile) {
      console.warn(`⚠️ Не удалось загрузить файл: ${absolutePath}`);
      return entities;
    }

    // ============================================
    // 2.0. ИЗВЛЕЧЕНИЕ ИМПОРТОВ (НОВОЕ!)
    // ============================================
    const importedNames = new Set<string>();
    try {
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const imp of importDeclarations) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        const specifiers: string[] = [];

        const namedImports = imp.getNamedImports();
        for (const named of namedImports) {
          const name = named.getName();
          specifiers.push(name);
          importedNames.add(name);
        }

        const defaultImport = imp.getDefaultImport();
        if (defaultImport) {
          const name = defaultImport.getText();
          specifiers.unshift(`default as ${name}`);
          importedNames.add(name);
        }

        const namespaceImport = imp.getNamespaceImport();
        if (namespaceImport) {
          const name = namespaceImport.getText();
          specifiers.push(`* as ${name}`);
        }

        if (moduleSpecifier && specifiers.length > 0) {
          entities.imports!.push({
            source: moduleSpecifier,
            specifiers: specifiers,
            isTypeOnly: false,
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Ошибка при извлечении импортов:', error);
    }

    // ============================================
    // 2.1. ИЗВЛЕЧЕНИЕ ФУНКЦИЙ (ОБЫЧНЫХ)
    // ============================================
    const functions = sourceFile.getFunctions();
    for (const functionDecl of functions) {
      const name = functionDecl.getName();
      if (!name) continue;

      const params = functionDecl.getParameters().map((p: any) => p.getName());
      const returnType = functionDecl.getReturnType().getText();
      const isAsync = functionDecl.isAsync();
      const isExported = functionDecl.isExported();

      const calls: string[] = [];
      functionDecl.forEachDescendant((node: any) => {
        if (Node.isCallExpression(node)) {
          const expr = node.getExpression();
          if (Node.isIdentifier(expr)) {
            const calledName = expr.getText();
            if (calledName && calledName !== name && !importedNames.has(calledName)) {
              calls.push(calledName);
            }
          }
        }
      });

      let complexity = 1;
      try {
        functionDecl.forEachDescendant((node: any) => {
          const kind = node.getKind();
          if ([95, 96, 97, 98, 129, 130, 131, 132].includes(kind)) {
            complexity++;
          }
        });
      } catch (error: any) {
        complexity = 1;
      }

      const bodyText = functionDecl.getBody()?.getText() || '';
      const security = {
        hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
        hasProcessEnv: bodyText.includes('process.env'),
        hasSensitiveData: /['"][a-zA-Z0-9_\-]{32,}['"]/.test(bodyText) ||
          /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
        hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
        hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
      };

      entities.functions.push({
        name,
        params,
        paramTypes: params.map(() => 'any'),
        line: functionDecl.getStartLineNumber(),
        startLine: functionDecl.getStartLineNumber(),
        endLine: functionDecl.getEndLineNumber(),
        isAsync,
        isExported,
        isMethod: false,
        className: '',
        calls: [...new Set(calls)],
        calledBy: [],
        returnType,
        body: bodyText,
        isNested: false,
        parentFunction: '',
        isArrow: false,
        isEventHandler: false,
        eventType: '',
        depth: 0,
        complexity,
        security,
        vscode: '',
        signature: '',
        _safeInfo: null,
      });
    }

    // ============================================
    // 2.2. ИЗВЛЕЧЕНИЕ СТРЕЛОЧНЫХ ФУНКЦИЙ ИЗ CONST (НОВОЕ!)
    // ============================================
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();

      // Проверяем, является ли это стрелочной функцией
      if (initializer && Node.isArrowFunction(initializer)) {
        const isExported = decl.isExported();
        const params = initializer.getParameters().map((p: any) => p.getName());
        const returnType = initializer.getReturnType().getText();
        const isAsync = initializer.isAsync();

        // Проверяем, не добавлена ли уже такая функция
        const existing = entities.functions.find(f => f.name === name);
        if (!existing) {
          const calls: string[] = [];
          initializer.forEachDescendant((node: any) => {
            if (Node.isCallExpression(node)) {
              const expr = node.getExpression();
              if (Node.isIdentifier(expr)) {
                const calledName = expr.getText();
                if (calledName && calledName !== name && !importedNames.has(calledName)) {
                  calls.push(calledName);
                }
              }
            }
          });

          const bodyText = initializer.getBody()?.getText() || '';
          const security = {
            hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
            hasProcessEnv: bodyText.includes('process.env'),
            hasSensitiveData: /['"][a-zA-Z0-9_\-]{32,}['"]/.test(bodyText) ||
              /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
            hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
            hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
          };

          let complexity = 1;
          try {
            initializer.forEachDescendant((node: any) => {
              const kind = node.getKind();
              if ([95, 96, 97, 98, 129, 130, 131, 132].includes(kind)) {
                complexity++;
              }
            });
          } catch (error: any) {
            complexity = 1;
          }

          entities.functions.push({
            name,
            params,
            paramTypes: params.map(() => 'any'),
            line: decl.getStartLineNumber(),
            startLine: decl.getStartLineNumber(),
            endLine: initializer.getEndLineNumber(),
            isAsync,
            isExported,
            isMethod: false,
            className: '',
            calls: [...new Set(calls)],
            calledBy: [],
            returnType,
            body: bodyText,
            isNested: false,
            parentFunction: '',
            isArrow: true,
            isEventHandler: false,
            eventType: '',
            depth: 0,
            complexity,
            security,
            vscode: '',
            signature: '',
            _safeInfo: null,
          });

          // Удаляем эту константу из constants, чтобы не дублировать
          const constIndex = entities.constants.findIndex(c => c.name === name);
          if (constIndex !== -1) {
            entities.constants.splice(constIndex, 1);
          }
        }
      }
    }

    // ============================================
    // 2.3. ИЗВЛЕЧЕНИЕ КОНСТАНТ И ПЕРЕМЕННЫХ
    // ============================================
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();

      // Пропускаем уже обработанные стрелочные функции
      const isArrowFunction = initializer && Node.isArrowFunction(initializer);
      if (isArrowFunction) continue;

      const isConst = decl.getVariableStatement()?.getDeclarationKind() === 'const';

      const info = {
        name,
        line: decl.getStartLineNumber(),
        isExported: decl.isExported(),
        type: initializer ? initializer.getType().getText() : 'any',
        value: initializer ? extractValueFromNode(initializer) : undefined,
        _safeInfo: null,
      };

      if (isConst) {
        entities.constants.push(info);
      } else {
        entities.variables.push(info);
      }
    }

    // ============================================
    // 2.4. ИЗВЛЕЧЕНИЕ КЛАССОВ
    // ============================================
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      const methods: string[] = [];
      const properties: string[] = [];

      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        if (methodName) {
          methods.push(methodName);
        }
      }

      for (const prop of cls.getProperties()) {
        const propName = prop.getName();
        if (propName) {
          properties.push(propName);
        }
      }

      entities.classes.push({
        name,
        methods,
        properties,
        line: cls.getStartLineNumber(),
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
        isExported: cls.isExported(),
        extends: cls.getExtends()?.getText(),
        implements: cls.getImplements().map((i: any) => i.getText()),
        _safeInfo: null,
      });
    }

    // ============================================
    // 2.5. ИЗВЛЕЧЕНИЕ ИНТЕРФЕЙСОВ
    // ============================================
    const interfaces = sourceFile.getInterfaces();
    for (const intf of interfaces) {
      const name = intf.getName();
      if (!name) continue;

      const properties: string[] = [];
      for (const prop of intf.getProperties()) {
        properties.push(prop.getName());
      }

      entities.interfaces.push({
        name,
        properties,
        line: intf.getStartLineNumber(),
        startLine: intf.getStartLineNumber(),
        endLine: intf.getEndLineNumber(),
        isExported: intf.isExported(),
        extends: intf.getExtends().map((e: any) => e.getText()),
        _safeInfo: null,
      });
    }

    // ============================================
    // 2.6. ИЗВЛЕЧЕНИЕ ТИПОВ
    // ============================================
    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();
      if (!name) continue;

      entities.types.push({
        name,
        definition: typeAlias.getType().getText(),
        line: typeAlias.getStartLineNumber(),
        isExported: typeAlias.isExported(),
        _safeInfo: null,
      });
    }

    // ============================================
    // 2.7. СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ defaults.ts ФАЙЛОВ
    // ============================================
    if (filePath.endsWith('defaults.ts') || filePath.includes('/defaults.ts')) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');

        const constRegex = /export\s+const\s+(\w+)\s*(?::\s*([^=]+))?\s*=\s*([^;]+);/g;
        let match;
        while ((match = constRegex.exec(content)) !== null) {
          const name = match[1];
          const type = match[2]?.trim() || 'any';
          const value = match[3]?.trim() || '';

          if (name) {
            const line = content.substring(0, match.index).split('\n').length;

            if (!entities.constants.find(c => c.name === name)) {
              entities.constants.push({
                name,
                line,
                isExported: true,
                type,
                value,
                _safeInfo: null,
              });
            }
          }
        }

        const interfaceRegex = /export\s+interface\s+(\w+)\s*\{([\s\S]*?)\}/g;
        while ((match = interfaceRegex.exec(content)) !== null) {
          const name = match[1];
          const properties = match[2]?.trim() || '';

          if (name) {
            const line = content.substring(0, match.index).split('\n').length;
            const propList = properties
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('//'))
              .map(line => line.split(':')[0]?.trim())
              .filter((prop): prop is string => prop !== undefined && prop !== '');

            if (!entities.interfaces.find(i => i.name === name)) {
              entities.interfaces.push({
                name,
                properties: propList,
                line,
                startLine: line,
                endLine: line + match[0].split('\n').length,
                isExported: true,
                extends: [],
                _safeInfo: null,
              });
            }
          }
        }

        const typeRegex = /export\s+type\s+(\w+)\s*=\s*([^;]+);/g;
        while ((match = typeRegex.exec(content)) !== null) {
          const name = match[1];
          const definition = match[2]?.trim() || '';

          if (name) {
            const line = content.substring(0, match.index).split('\n').length;

            if (!entities.types.find(t => t.name === name)) {
              entities.types.push({
                name,
                definition,
                line,
                isExported: true,
                _safeInfo: null,
              });
            }
          }
        }

        console.log(`✅ Извлечено из defaults.ts ${path.basename(filePath)}:`);
        console.log(`   Констант: ${entities.constants.length}`);
        console.log(`   Интерфейсов: ${entities.interfaces.length}`);
        console.log(`   Типов: ${entities.types.length}`);
      } catch (error) {
        console.warn(`⚠️ Ошибка при извлечении из defaults.ts:`, error);
      }
    }

    const relativePath = path.relative(process.cwd(), absolutePath);
    console.log(`✅ Извлечено сущностей из ${relativePath}:`);
    console.log(`   Функций: ${entities.functions.length}`);
    console.log(`   Классов: ${entities.classes.length}`);
    console.log(`   Констант: ${entities.constants.length}`);
    console.log(`   Интерфейсов: ${entities.interfaces.length}`);
    console.log(`   Типов: ${entities.types.length}`);
    console.log(`   Переменных: ${entities.variables.length}`);
    console.log(`   Импортов: ${entities.imports?.length || 0}`);

    return entities;
  } catch (error: any) {
    console.error(
      `❌ Ошибка при извлечении сущностей из ${absolutePath}:`,
      error?.message || String(error)
    );
    return entities;
  }
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ ЗНАЧЕНИЯ ИЗ УЗЛА
// ============================================================

function extractValueFromNode(node: any): any {
  try {
    const text = node.getText();

    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      return text.slice(1, -1);
    }

    if (!isNaN(Number(text)) && text !== '') {
      return Number(text);
    }

    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;
    if (text === 'undefined') return undefined;

    if (Node.isArrayLiteralExpression(node)) {
      return node.getElements().map((e: any) => extractValueFromNode(e));
    }

    if (Node.isObjectLiteralExpression(node)) {
      const result: Record<string, any> = {};
      for (const prop of node.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          const initializer = prop.getInitializer();
          if (initializer) {
            result[name] = extractValueFromNode(initializer);
          }
        }
      }
      return result;
    }

    if (Node.isIdentifier(node)) {
      return node.getText();
    }

    return undefined;
  } catch (error: any) {
    return undefined;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  buildEnhancedPackageLockReport,
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  extractEntitiesFromFile,
  metadata: {
    createMetadata,
    getReportName,
    getReportVersion,
    getLockfileVersion,
  },
  statistics: {
    calculateEntityStats,
    calculateFileStats,
  },
  graphs: {
    buildDependencyGraph,
    findCycles,
    getMaxDepth,
    getModulesByLevel,
  },
  flows: {
    buildExecutionGraph,
    buildImportExportFlow,
  },
  architecture: {
    buildArchitectureMetrics,
  },
  summary: {
    buildSummary,
  },
  packages: {
    buildPackages,
  },
  converters: {
    convertToEnhancedEntityInfo,
  },
  utils: {
    ensureArray,
    safeString,
    safeNumber,
    safeBoolean,
    isRealObject,
    filterRealObjects,
    sanitizeEntities,
    safeTraverseAST,
    findProjectRoot,
    findFileInProject,
    findModuleForEntity,
  },
};
