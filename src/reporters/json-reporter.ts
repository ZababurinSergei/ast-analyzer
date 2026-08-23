// src/reporters/json-reporter.ts
// Основной файл - только экспорты и сборка отчета

import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';

// Импорт всех модулей
import type {
  // Типы
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
  FunctionEntity, // ✅ ИСПОЛЬЗУЕМ ОБЩИЙ ТИП
  EnhancedFunctionInfo,
  EnhancedClassInfo,
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
  FunctionEntity, // ✅ ЭКСПОРТИРУЕМ ОБЩИЙ ТИП
};

// ============================================================
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ
// ============================================================

// Экспорт утилит
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

// Экспорт метаданных
export {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from './modules/metadata.js';

// Экспорт статистики
export { calculateEntityStats, calculateFileStats } from './modules/statistics.js';

// Экспорт графов
export {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from './modules/graphs.js';

// Экспорт потоков
export { buildExecutionGraph, buildImportExportFlow } from './modules/flows.js';

// Экспорт архитектуры
export { buildArchitectureMetrics } from './modules/architecture.js';

// Экспорт резюме
export { buildSummary } from './modules/summary.js';

// Экспорт пакетов
export { buildPackages } from './modules/packages.js';

// Экспорт конвертеров
export { convertToEnhancedEntityInfo } from './modules/converters.js';

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ ПОСТРОЕНИЯ ОТЧЕТА
// ============================================================

export function buildEnhancedPackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _filePaths?: string[]
): EnhancedPackageLockReport {
  // Находим корень проекта
  const projectRoot = findProjectRoot(process.cwd()) || process.cwd();

  // 1. Строим метаданные
  const metadata = createMetadata();

  // 2. Строим пакеты (ВКЛЮЧАЕТ Vue-анализ через modules/packages.ts)
  const packages = buildPackages(rootKey, graph, entitiesMap, projectRoot);

  // 3. Строим граф зависимостей
  const dependencyGraph = buildDependencyGraph(graph);

  // 4. Строим граф выполнения
  const executionGraph = buildExecutionGraph(rootKey, entitiesMap, { rootKey, graph }, packages);

  // 5. Строим потоки импортов/экспортов
  const importExportFlow = buildImportExportFlow(graph, entitiesMap, { rootKey, graph }, packages);

  // 6. Строим граф вызовов с правильной типизацией
  const callGraph: Record<string, string[]> = {};
  for (const entities of Object.values(entitiesMap)) {
    if (!entities) continue;

    // ✅ ИСПОЛЬЗУЕМ FunctionEntity из общих типов
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

  // 7. Собираем статистику
  const entityStats = calculateEntityStats(packages, callGraph);
  const fileStats = calculateFileStats(packages);

  // 8. Строим архитектурные метрики
  const architectureMetrics = buildArchitectureMetrics(
    packages,
    callGraph,
    dependencyGraph.outwardDependencies
  );

  // 9. Строим резюме
  const summary = buildSummary(rootKey, architectureMetrics, packages);

  // 10. Формируем итоговый отчет
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
// СУЩЕСТВУЮЩИЕ ФУНКЦИИ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
// ============================================================

/**
 * Сохраняет граф модулей в JSON
 */
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

/**
 * Сохраняет граф сущностей в JSON
 */
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

/**
 * Сохраняет полный анализ в JSON
 */
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

// ============================================================
// 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ savePackageLockReport
// ============================================================

/**
 * Сохраняет отчет в стиле package-lock.json
 * ✅ СОХРАНЯЕТ ВСЕ ДАННЫЕ: body, vscode, signature, calls, calledBy
 */
export function savePackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  filePaths: string[],
  outputPath: string
): void {
  // Нормализуем entities map - СОХРАНЯЕМ ВСЕ ДАННЫЕ
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

    // ✅ СОХРАНЯЕМ ВСЕ ДАННЫЕ БЕЗ ПОТЕРЬ
    normalizedEntitiesMap[key] = {
      functions: ensureArray(entities.functions).map((f: any) => ({
        ...f,
        // ✅ ГАРАНТИРУЕМ, ЧТО calls И calledBy - МАССИВЫ
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

  // Строим отчет
  const report = buildEnhancedPackageLockReport(rootKey, graph, normalizedEntitiesMap, filePaths);

  // ✅ НЕ ИСПОЛЬЗУЕМ safeTraverseAST, КОТОРЫЙ ТЕРЯЕТ ДАННЫЕ
  // Используем прямую сериализацию с обработкой Map и Set
  const json = JSON.stringify(
    report,
    (key, value) => {
      // Обрабатываем Map и Set
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      // Пропускаем внутренние поля
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

  // Подсчет статистики
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

/**
 * Сохраняет результат графа вызовов между функциями
 */
export function saveCallGraphResult(callGraphResult: any, outputPath: string): void {
  const safeData = safeTraverseAST(callGraphResult);
  const json = JSON.stringify(safeData, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Строит граф модулей
 */
export function buildModuleGraph(data: GraphData, entities: EntitiesResult): ModuleGraph {
  const nodes: ModuleNode[] = [];
  const edges: ModuleEdge[] = [];

  const allModules = new Set<string>();
  allModules.add(data.rootKey);

  for (const [key, deps] of Object.entries(data.graph)) {
    allModules.add(key);
    for (const dep of deps) {
      allModules.add(dep);
    }
  }

  for (const modulePath of allModules) {
    const isEntry = modulePath === data.rootKey;

    let language = 'javascript';
    if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) language = 'typescript';
    else if (modulePath.endsWith('.vue')) language = 'vue';
    else if (modulePath.endsWith('.jsx')) language = 'jsx';

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
    for (const to of deps) {
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

/**
 * Строит граф сущностей
 * ✅ СОХРАНЯЕТ ВСЕ ДАННЫЕ: calls, calledBy, body, vscode, signature
 */
export function buildEntityGraph(data: GraphData, entities: EntitiesResult): EntityGraph {
  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];

  // ✅ ИСПОЛЬЗУЕМ FunctionEntity из общих типов
  const functions = ensureArray(entities.functions) as FunctionEntity[];

  for (const func of functions) {
    const funcName = safeString(func.name);
    const modulePath = findModuleForEntity(funcName, data);
    const nodeId = modulePath ? `${modulePath}#${funcName}` : `#${funcName}`;
    const calls: string[] = ensureArray(func.calls).map((call: any) => safeString(call));
    // ✅ СОХРАНЯЕМ calledBy
    const calledBy: string[] = ensureArray(func.calledBy).map((cb: any) => safeString(cb));

    nodes.push({
      id: nodeId,
      name: funcName,
      type: 'function',
      module: modulePath || 'unknown',
      line: safeNumber(func.line),
      metadata: {
        isAsync: safeBoolean(func.isAsync),
        isExported: safeBoolean(func.isExported),
        params: ensureArray(func.params).map((p: any) => safeString(p)),
        returnType: safeString(func.returnType),
        isMethod: safeBoolean(func.isMethod),
        className: safeString(func.className),
        // ✅ СОХРАНЯЕМ calls
        calls: calls,
        // ✅ СОХРАНЯЕМ calledBy
        calledBy: calledBy,
        startLine: safeNumber(func.startLine || func.line),
        endLine: safeNumber(func.endLine || func.line),
        importedFrom: modulePath !== data.rootKey ? modulePath : undefined,
        complexity: safeNumber(func.complexity),
        security: func.security || {
          hasEval: false,
          hasProcessEnv: false,
          hasSensitiveData: false,
          hasExec: false,
          hasPassword: false,
        },
        // ✅ СОХРАНЯЕМ body
        body: func.body || '',
        // ✅ СОХРАНЯЕМ signature
        signature: func.signature || '',
        // ✅ СОХРАНЯЕМ vscode
        vscode: func.vscode || '',
      },
    });

    for (const call of calls) {
      let targetModule = findModuleForEntity(call, data);
      if (!targetModule) {
        for (const [modPath, deps] of Object.entries(data.graph)) {
          if (modPath.includes(call) || deps.some((d: string) => d.includes(call))) {
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

    nodes.push({
      id: nodeId,
      name: className,
      type: 'class',
      module: modulePath || 'unknown',
      line: safeNumber(cls.line),
      metadata: {
        isExported: safeBoolean(cls.isExported),
        methods: ensureArray(cls.methods).map((m: any) => safeString(m)),
        properties: ensureArray(cls.properties).map((p: any) => safeString(p)),
        extends: safeString(cls.extends),
        implements: ensureArray(cls.implements).map((i: any) => safeString(i)),
        startLine: safeNumber(cls.startLine || cls.line),
        endLine: safeNumber(cls.endLine || cls.line),
        // ✅ СОХРАНЯЕМ body
        body: cls.body || '',
        // ✅ СОХРАНЯЕМ vscode
        vscode: cls.vscode || '',
      },
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
        value: constant.value,
        isExported: safeBoolean(constant.isExported),
        type: safeString(constant.type),
      },
    });
  }

  // Интерфейсы
  for (const intf of entities.interfaces) {
    const intfName = safeString(intf.name);
    const modulePath = findModuleForEntity(intfName, data);
    const nodeId = modulePath ? `${modulePath}#${intfName}` : `#${intfName}`;

    nodes.push({
      id: nodeId,
      name: intfName,
      type: 'interface',
      module: modulePath || 'unknown',
      line: safeNumber(intf.line),
      metadata: {
        isExported: safeBoolean(intf.isExported),
        properties: ensureArray(intf.properties).map((p: any) => safeString(p)),
        extends: ensureArray(intf.extends).map((e: any) => safeString(e)),
        startLine: safeNumber(intf.startLine || intf.line),
        endLine: safeNumber(intf.endLine || intf.line),
      },
    });

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
        type: safeString(variable.type),
        value: variable.value,
      },
    });
  }

  return { nodes, edges };
}

/**
 * Строит полный анализ
 */
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

  const analysis: FullAnalysis = {
    version: '3.0.0',
    root,
    timestamp: new Date().toISOString(),
    stats: {
      totalModules: Object.keys(data.graph).length,
      totalEntities: allEntities,
      hasCycles: data.hasCycles || false,
      cycles,
    },
    moduleGraph: buildModuleGraph(data, entities),
    entityGraph: buildEntityGraph(data, entities),
  };

  const safeAnalysis = safeTraverseAST(analysis);
  (analysis as any)._safeCopy = safeAnalysis;

  return analysis;
}

/**
 * Извлекает все сущности из файла
 */
export function extractEntitiesFromFile(filePath: string): EnhancedEntityInfo {
  const entities: EnhancedEntityInfo = {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
  };

  const absolutePath = filePath;

  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️ Файл не найден: ${absolutePath}`);
    return entities;
  }

  try {
    const stats = fs.statSync(absolutePath);
    if (stats.size > 500 * 1024) {
      console.log(
        `  📦 Большой файл (${(stats.size / 1024).toFixed(0)}KB), используем упрощенный анализ`
      );

      const content = fs.readFileSync(absolutePath, 'utf-8');

      const funcMatches = content.match(/function\s+(\w+)\s*\(/g) || [];
      for (const match of funcMatches) {
        const nameMatch = match.match(/function\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          const existing = entities.functions.find(
            (f: EnhancedFunctionInfo) => f.name === nameMatch[1]
          );
          if (!existing) {
            entities.functions.push({
              name: nameMatch[1],
              params: [],
              paramTypes: [],
              line: 0,
              startLine: 0,
              endLine: 0,
              isAsync: content.includes(`async function ${nameMatch[1]}`),
              isExported: content.includes(`export function ${nameMatch[1]}`),
              isMethod: false,
              className: undefined,
              calls: [],
              calledBy: [],
              returnType: 'any',
              body: '',
              isNested: false,
              parentFunction: undefined,
              isArrow: false,
              isEventHandler: false,
              eventType: undefined,
              depth: 0,
              complexity: 1,
              security: {
                hasEval: false,
                hasProcessEnv: false,
                hasSensitiveData: false,
                hasExec: false,
                hasPassword: false,
              },
              _safeInfo: null,
            });
          }
        }
      }

      const classMatches = content.match(/class\s+(\w+)/g) || [];
      for (const match of classMatches) {
        const nameMatch = match.match(/class\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          const existing = entities.classes.find((c: EnhancedClassInfo) => c.name === nameMatch[1]);
          if (!existing) {
            entities.classes.push({
              name: nameMatch[1],
              methods: [],
              properties: [],
              line: 0,
              startLine: 0,
              endLine: 0,
              isExported: content.includes(`export class ${nameMatch[1]}`),
              extends: undefined,
              implements: [],
              _safeInfo: null,
            });
          }
        }
      }

      return entities;
    }
  } catch (error: any) {
    console.warn(`  ⚠️ Упрощенный анализ не удался:`, error?.message || String(error));
  }

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

    // Извлекаем функции
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
            if (calledName && calledName !== name) {
              calls.push(calledName);
            }
          }
        }
      });

      let complexity = 1;
      try {
        functionDecl.forEachDescendant((node: any) => {
          const kind = node.getKind();
          if (
            kind === 95 ||
            kind === 96 ||
            kind === 97 ||
            kind === 98 ||
            kind === 129 ||
            kind === 130 ||
            kind === 131 ||
            kind === 132
          ) {
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
        hasSensitiveData:
          /['\"][a-zA-Z0-9_\-]{32,}['\"]/.test(bodyText) ||
          /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
        hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
        hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
      };

      // ✅ ИСПОЛЬЗУЕМ EnhancedFunctionInfo из общих типов
      const funcInfo: EnhancedFunctionInfo = {
        name,
        params,
        paramTypes: params.map(() => 'any'),
        line: functionDecl.getStartLineNumber(),
        startLine: functionDecl.getStartLineNumber(),
        endLine: functionDecl.getEndLineNumber(),
        isAsync,
        isExported,
        isMethod: false,
        className: undefined,
        calls: [...new Set(calls)],
        calledBy: [], // Будет заполнено позже
        returnType,
        body: bodyText,
        isNested: false,
        parentFunction: undefined,
        isArrow: false,
        isEventHandler: false,
        eventType: undefined,
        depth: 0,
        complexity,
        security,
        _safeInfo: null,
      };
      entities.functions.push(funcInfo);
    }

    // Извлекаем классы
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      const methods: string[] = [];
      const methodDetails: EnhancedClassInfo['methodDetails'] = [];
      const properties: string[] = [];
      const propertyDetails: EnhancedClassInfo['propertyDetails'] = [];

      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        if (methodName) {
          methods.push(methodName);
          methodDetails?.push({
            name: methodName,
            params: method.getParameters().map((p: any) => p.getName()),
            returnType: method.getReturnType().getText(),
            isAsync: method.isAsync(),
            line: method.getStartLineNumber(),
          });
        }
      }

      for (const prop of cls.getProperties()) {
        const propName = prop.getName();
        if (propName) {
          properties.push(propName);
          propertyDetails?.push({
            name: propName,
            type: prop.getType().getText(),
            line: prop.getStartLineNumber(),
          });
        }
      }

      // ✅ ИСПОЛЬЗУЕМ EnhancedClassInfo из общих типов
      const classInfo: EnhancedClassInfo = {
        name,
        methods,
        methodDetails,
        properties,
        propertyDetails,
        line: cls.getStartLineNumber(),
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
        isExported: cls.isExported(),
        extends: cls.getExtends()?.getText(),
        implements: cls.getImplements().map((i: any) => i.getText()),
        _safeInfo: null,
      };
      entities.classes.push(classInfo);
    }

    // Извлекаем константы и переменные
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();
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

    // Извлекаем интерфейсы
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

    // Извлекаем типы
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

    // ✅ ИСПРАВЛЕНО: нормализация calledBy с использованием общих типов
    // Строим карту функций
    const functionMap = new Map<string, { module: string; line: number; name: string }>();
    for (const func of entities.functions) {
      functionMap.set(func.name, {
        module: filePath,
        line: func.line,
        name: func.name,
      });
    }

    // Заполняем calledBy для каждой функции
    for (const func of entities.functions) {
      for (const call of func.calls) {
        const calledFunc = functionMap.get(call);
        if (calledFunc && calledFunc.name !== func.name) {
          const targetFunc = entities.functions.find(f => f.name === call);
          if (targetFunc) {
            // ✅ Нормализуем calledBy с использованием общих типов
            let normalizedCalledBy: { function: string; module: string; line: number }[] = [];

            if (Array.isArray(targetFunc.calledBy)) {
              normalizedCalledBy = targetFunc.calledBy.map((cb: any) => {
                if (typeof cb === 'string') {
                  return {
                    function: cb,
                    module: filePath,
                    line: func.line,
                  };
                }
                return {
                  function: cb.function || cb,
                  module: cb.module || filePath,
                  line: cb.line || func.line,
                };
              });
            }

            // ✅ Проверяем, не добавлен ли уже этот caller
            const exists = normalizedCalledBy.some(
              (cb: any) => cb.function === func.name && cb.module === filePath
            );

            if (!exists) {
              normalizedCalledBy.push({
                function: func.name,
                module: filePath,
                line: func.line,
              });
            }

            targetFunc.calledBy = normalizedCalledBy;
          }
        }
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

    return entities;
  } catch (error: any) {
    console.error(
      `❌ Ошибка при извлечении сущностей из ${absolutePath}:`,
      error?.message || String(error)
    );
    return entities;
  }
}

/**
 * Вспомогательная функция для извлечения значения из узла
 */
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
  // Основная функция
  buildEnhancedPackageLockReport,

  // Существующие функции
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  extractEntitiesFromFile,

  // Экспорт модулей
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
