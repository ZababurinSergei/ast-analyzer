// packages/ast-analyzer/src/modes/project-graph.ts
import path from 'path';
import fs from 'fs';
import {
  parseFile,
  resolveFilePath,
  isExternalModule,
  getTsConfigForFile,
} from '../core/ast-parser.js';
import type { EntitiesResult } from '../core/entity-extractor.js';
import { IGNORE_NODE_MODULES } from '../config.js';
import { walk } from 'estree-walker';
import { normalizePathForDisplay } from '../utils/path-utils.js';
import {
  buildEnhancedPackageLockReport,
  type EnhancedEntityInfo,
  type EnhancedPackageLockReport,
} from '../reporters/json-reporter.js';
import { extractEntitiesFromFile } from '../reporters/json-reporter.js';
import { collectDeclaredFunctions, buildCallGraphFromAST } from '../core/call-collector.js';

// ==========================================
// ТИП: Информация о функции в формате package-lock
// ==========================================
export interface PackageLockFunctionInfo {
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  line: number;
  direction?: 'inward' | 'outward' | 'self';
  calls?: {
    target: string;
    direction: 'inward' | 'outward' | 'self';
    isAsync: boolean;
    line?: number;
  }[];
  consumers?: {
    module: string;
    direction: 'outward';
    type: 'import' | 'call';
  }[];
}

// ==========================================
// ТИП: Информация об импорте в package-lock
// ==========================================
export interface PackageLockImportInfo {
  direction: 'inward';
  type: 'import' | 'external-import' | 'internal-import';
  specifiers: string[];
  functions: Record<string, PackageLockFunctionInfo>;
}

// ==========================================
// ТИП: Информация об экспорте в package-lock
// ==========================================
export interface PackageLockExportInfo {
  direction: 'outward';
  type: 'export';
  isAsync: boolean;
  params: string[];
  returns: string;
  line: number;
  consumers: {
    module: string;
    direction: 'outward';
    type: 'import' | 'call';
  }[];
}

// ==========================================
// ТИП: Информация о пакете (модуле)
// ==========================================
export interface PackageLockPackage {
  version: string;
  resolved: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, PackageLockImportInfo>;
  exports: Record<string, PackageLockExportInfo>;
}

// ==========================================
// ТИП: Граф вызовов
// ==========================================
export interface CallGraphResult {
  from: string;
  to: string;
  path: string[];
  found: boolean;
  reason?: string;
  nodes: {
    function: string;
    module: string;
    line: number;
    isAsync: boolean;
  }[];
  edges: {
    from: string;
    to: string;
    line?: number;
  }[];
}

// ==========================================
// ТИП: Полный отчет в стиле package-lock
// ==========================================
export interface PackageLockReport {
  name: string;
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
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРЕОБРАЗОВАНИЯ ТИПОВ
// ==========================================

/**
 * Преобразует EnhancedEntityInfo в EntitiesResult для совместимости
 * ✅ ИСПРАВЛЕНО: правильная обработка calledBy (string[] или объекты)
 */
function convertEnhancedToEntities(enhanced: EnhancedEntityInfo): EntitiesResult {
  return {
    functions: enhanced.functions.map(f => {
      // ✅ Обрабатываем calledBy - может быть string[] или объектами
      let calledBy: string[] = [];
      if (Array.isArray(f.calledBy)) {
        calledBy = f.calledBy.map((cb: any) => {
          if (typeof cb === 'string') {
            return cb;
          } else if (cb && typeof cb === 'object') {
            // Если это объект с полем function
            if ('function' in cb) {
              return cb.function || String(cb);
            }
            // Если это объект с полем name
            if ('name' in cb) {
              return cb.name || String(cb);
            }
            return String(cb);
          }
          return String(cb);
        });
      }

      return {
        name: f.name,
        line: f.line,
        isAsync: f.isAsync,
        isExported: f.isExported,
        params: f.params,
        returnType: f.returnType,
        calls: f.calls || [],
        calledBy: calledBy, // ✅ теперь всегда string[]
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
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: '',
    filePath: '',
  };
}

// ==========================================
// ФУНКЦИЯ ДЛЯ ПОСТРОЕНИЯ ГРАФА ВЫЗОВОВ МЕЖДУ ФУНКЦИЯМИ
// ==========================================
export function buildCallGraphBetweenFunctions(
  allFunctions: Map<string, { module: string; line: number; isAsync: boolean; calls: string[] }>,
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
  const queue: { func: string; path: string[] }[] = [{ func: fromFunction, path: [fromFunction] }];
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

/**
 * Находит корень проекта (где находится package.json)
 */
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

/**
 * Разрешает путь к файлу в абсолютный с поиском в нескольких местах
 */
function resolveAbsoluteFilePath(filePath: string, projectRoot: string): string | null {
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

  const normalizedFilePath = filePath.replace(/\\/g, '/');
  const additionalCandidates = [
    path.resolve(projectRoot, normalizedFilePath),
    path.resolve(projectRoot, 'src', normalizedFilePath),
    path.resolve(projectRoot, 'packages/ast-analyzer/src', normalizedFilePath),
  ];
  candidates.push(...additionalCandidates);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

/**
 * Преобразует EnhancedPackageLockReport в PackageLockReport
 */
function convertToPackageLockReport(
  enhanced: EnhancedPackageLockReport,
  rootKey: string
): PackageLockReport {
  const packages: Record<string, PackageLockPackage> = {};

  for (const [key, pkg] of Object.entries(enhanced.packages || {})) {
    // Преобразуем imports
    const imports: Record<string, PackageLockImportInfo> = {};
    for (const [impKey, impVal] of Object.entries(pkg.imports || {})) {
      imports[impKey] = {
        direction: 'inward',
        type: (impVal.type as 'import' | 'external-import' | 'internal-import') || 'import',
        specifiers: impVal.specifiers || [],
        functions: {},
      };
    }

    // Преобразуем exports
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
// ОБНОВЛЕННАЯ ФУНКЦИЯ buildProjectGraph
// ==========================================
export function buildProjectGraph(
  entryPoint: string,
  maxDepth = Infinity,
  includeEntities = false,
  fromFunction?: string,
  toFunction?: string
): {
  rootKey: string;
  graph: Record<string, string[]>;
  entities?: Record<string, EntitiesResult>;
  packageLockReport?: PackageLockReport;
  callGraphResult?: CallGraphResult;
} {
  const graph: Record<string, string[]> = {};
  const visited = new Set<string>();
  const entitiesMap: Record<string, EntitiesResult> = {};
  const rootAbsPath = path.resolve(entryPoint);
  const queue: { path: string; depth: number; isRoot: boolean }[] = [];

  const allFunctions = new Map<
    string,
    { module: string; line: number; isAsync: boolean; calls: string[] }
  >();

  const tsConfig = getTsConfigForFile(rootAbsPath);
  if (tsConfig?.compilerOptions?.paths) {
    console.log('🔗 Найдены алиасы в tsconfig:');
    Object.entries(tsConfig.compilerOptions.paths).forEach(([alias, targets]) => {
      console.log(`   ${alias} → ${targets[0]}`);
    });
  }

  queue.push({ path: rootAbsPath, depth: 1, isRoot: true });

  while (queue.length > 0) {
    const { path: currentPath, depth, isRoot } = queue.shift()!;

    if (depth > maxDepth) continue;
    if (visited.has(currentPath)) continue;
    visited.add(currentPath);

    const relativeKey = path.relative(process.cwd(), currentPath) || currentPath;
    if (!graph[relativeKey]) {
      graph[relativeKey] = [];
    }

    const ast = parseFile(currentPath);
    if (!ast) {
      console.log(`   ⚠️ Не удалось получить AST для: ${path.basename(currentPath)}`);
      continue;
    }

    if (includeEntities) {
      const enhancedEntities = extractEntitiesFromFile(currentPath);
      const entities = convertEnhancedToEntities(enhancedEntities);
      entitiesMap[relativeKey] = entities;

      for (const func of entities.functions) {
        allFunctions.set(func.name, {
          module: relativeKey,
          line: func.line,
          isAsync: func.isAsync,
          calls: func.calls || [],
        });
      }

      // ✅ Добавляем локальные функции
      try {
        const declaredFunctions = collectDeclaredFunctions(ast);
        const callGraphFromAST = buildCallGraphFromAST(ast);

        for (const funcName of declaredFunctions) {
          if (!allFunctions.has(funcName)) {
            let funcNode: any = null;
            let found = false;

            function findFunction(node: any) {
              if (found) return;
              if (!node || typeof node !== 'object') return;

              if (node.type === 'FunctionDeclaration' && node.id?.name === funcName) {
                funcNode = node;
                found = true;
                return;
              }

              if (node.type === 'VariableDeclarator' && node.id?.name === funcName) {
                if (
                  node.init &&
                  (node.init.type === 'ArrowFunctionExpression' ||
                    node.init.type === 'FunctionExpression')
                ) {
                  funcNode = node.init;
                  found = true;
                  return;
                }
              }

              for (const key of Object.keys(node)) {
                const child = node[key];
                if (child && typeof child === 'object') {
                  if (Array.isArray(child)) {
                    for (const item of child) {
                      if (item && typeof item === 'object') {
                        findFunction(item);
                      }
                    }
                  } else {
                    findFunction(child);
                  }
                }
              }
            }

            findFunction(ast);

            const calls = callGraphFromAST.get(funcName) || new Set();

            allFunctions.set(funcName, {
              module: relativeKey,
              line: funcNode?.loc?.start?.line || 0,
              isAsync: false,
              calls: Array.from(calls),
            });

            console.log(`   📌 Добавлена локальная функция: ${funcName} (вызовов: ${calls.size})`);
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ Ошибка при сборе локальных функций: ${error}`);
      }

      console.log(`   📊 ${path.basename(currentPath)}:`);
      console.log(`      Функций: ${entities.functions.length}`);
      console.log(`      Классов: ${entities.classes.length}`);
      console.log(`      Констант: ${entities.constants.length}`);
      console.log(`      Интерфейсов: ${entities.interfaces.length}`);
      console.log(`      Типов: ${entities.types.length}`);
      console.log(`      Переменных: ${entities.variables.length}`);
    }

    const currentDir = path.dirname(currentPath);
    const imports = collectImports(ast);
    let reExports: string[] = [];
    if (isRoot) {
      reExports = collectReExports(ast);
      if (reExports.length > 0) {
        console.log(`   📤 Корневой файл: найдено реэкспортов: ${reExports.length}`);
      }
    }

    let allDeps = [...imports, ...reExports];
    allDeps = [...new Set(allDeps)];

    if (allDeps.length > 0) {
      console.log(`   📦 ${path.basename(currentPath)}: ${allDeps.length} зависимостей`);
    }

    for (const target of allDeps) {
      const isAlias = target.startsWith('@') || target.startsWith('#') || target.startsWith('~');

      if (!isAlias && IGNORE_NODE_MODULES && isExternalModule(target)) {
        console.log(`      ⏭️ Пропуск внешнего: ${target}`);
        continue;
      }

      let resolvedPath = resolveFilePath(currentDir, target);

      if (!resolvedPath) {
        const asDirectory = path.resolve(currentDir, target);
        if (fs.existsSync(asDirectory) && fs.statSync(asDirectory).isDirectory()) {
          console.log(`   📁 Директория (не разрешена): ${target} → ${path.basename(asDirectory)}`);
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
  } = {
    rootKey: normalizePathForDisplay(path.relative(process.cwd(), rootAbsPath) || rootAbsPath),
    graph: normalizedGraph,
  };

  if (includeEntities) {
    // ✅ Создаем КОНЕЧНУЮ карту сущностей для всего проекта
    const finalEntitiesMap: Record<string, EntitiesResult> = {};

    // Проверяем, есть ли сущности в entitiesMap
    if (Object.keys(entitiesMap).length === 0) {
      console.warn('⚠️ entitiesMap пуст, возможно сущности не были извлечены');
      console.warn('   💡 Попытка принудительного извлечения сущностей из всех файлов...');

      for (const modulePath of Object.keys(normalizedGraph)) {
        try {
          const absPath = path.resolve(modulePath);
          if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
            const enhancedEntities = extractEntitiesFromFile(absPath);
            const entities = convertEnhancedToEntities(enhancedEntities);
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
        } catch (error) {
          console.warn(`   ⚠️ Не удалось извлечь сущности из ${modulePath}:`, error);
        }
      }

      console.log(
        `✅ Принудительно извлечено сущностей из ${Object.keys(entitiesMap).length} модулей`
      );
    }

    // ✅ Копируем сущности из entitiesMap с нормализацией и проверкой
    for (const [modulePath, entities] of Object.entries(entitiesMap)) {
      if (!entities) {
        console.warn(`⚠️ Нет сущностей для ${modulePath}`);
        continue;
      }

      const normalizedKey = normalizePathForDisplay(modulePath);

      // ✅ Убеждаемся, что все поля - массивы
      finalEntitiesMap[normalizedKey] = {
        functions: Array.isArray(entities.functions) ? entities.functions : [],
        classes: Array.isArray(entities.classes) ? entities.classes : [],
        constants: Array.isArray(entities.constants) ? entities.constants : [],
        interfaces: Array.isArray(entities.interfaces) ? entities.interfaces : [],
        types: Array.isArray(entities.types) ? entities.types : [],
        variables: Array.isArray(entities.variables) ? entities.variables : [],
        imports: Array.isArray(entities.imports) ? entities.imports : [],
        exports: Array.isArray(entities.exports) ? entities.exports : [],
        callGraph: entities.callGraph || {},
        moduleName: entities.moduleName || modulePath,
        filePath: entities.filePath || modulePath,
      };
    }

    // ✅ ЛОГИРУЕМ ПЕРЕД СОЗДАНИЕМ ОТЧЕТА
    console.log(`✅ Подготовлено ${Object.keys(finalEntitiesMap).length} модулей с сущностями:`);

    let totalFuncs = 0;
    let totalCalls = 0;
    for (const [key, ents] of Object.entries(finalEntitiesMap)) {
      const funcCount = ents.functions?.length || 0;
      if (funcCount > 0) {
        totalFuncs += funcCount;
        // ✅ Используем ents.functions для подсчета вызовов
        let moduleCalls = 0;
        for (const f of ents.functions) {
          moduleCalls += (f.calls || []).length;
        }
        totalCalls += moduleCalls;
        console.log(`   • ${key}: ${funcCount} функций, ${moduleCalls} вызовов`);
      }
    }
    console.log(`   📊 Всего функций: ${totalFuncs}`);
    console.log(`   📊 Всего вызовов: ${totalCalls}`);

    // ✅ Сохраняем finalEntitiesMap в результат
    result.entities = finalEntitiesMap;

    // ✅ Используем ПОЛНЫЙ ОТЧЕТ с finalEntitiesMap
    const allFiles = Object.keys(normalizedGraph);
    const projectRoot = findProjectRoot(process.cwd()) || process.cwd();

    const absoluteFilePaths = allFiles.map(p => {
      const resolved = resolveAbsoluteFilePath(p, projectRoot);
      return resolved || path.resolve(projectRoot, p);
    });

    // ✅ ВЫЗЫВАЕМ buildEnhancedPackageLockReport с правильными параметрами
    const enhancedReport = buildEnhancedPackageLockReport(
      result.rootKey,
      normalizedGraph,
      finalEntitiesMap,
      absoluteFilePaths
    );

    // ✅ ПРЕОБРАЗУЕМ В PackageLockReport
    const packageLockReport = convertToPackageLockReport(enhancedReport, result.rootKey);
    result.packageLockReport = packageLockReport;

    // Выводим статистику из отчета
    console.log(`✅ Отчет создан. Статистика:`);
    console.log(`   • Пакетов: ${Object.keys(packageLockReport.packages || {}).length}`);

    if (enhancedReport.entityStats) {
      console.log(`   • Функций: ${enhancedReport.entityStats.totalFunctions || 0}`);
      console.log(`   • Классов: ${enhancedReport.entityStats.totalClasses || 0}`);
      console.log(`   • Вызовов: ${enhancedReport.entityStats.totalCalls || 0}`);
    }

    // ✅ Строим граф вызовов между функциями если указаны fromFunction и toFunction
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
      result.callGraphResult = buildCallGraphBetweenFunctions(allFuncs, fromFunction, toFunction);
    }
  }

  return result;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function collectImports(ast: any): string[] {
  const imports: string[] = [];
  if (!ast) return imports;

  walk(ast, {
    enter(node: any) {
      if (
        (node.type === 'ImportDeclaration' ||
          node.type === 'ExportNamedDeclaration' ||
          node.type === 'ExportAllDeclaration') &&
        node.source
      ) {
        imports.push(node.source.value);
      }
      if (node.type === 'ImportExpression' && node.source && node.source.type === 'Literal') {
        imports.push(node.source.value);
      }
      if (
        node.type === 'CallExpression' &&
        node.callee &&
        node.callee.name === 'require' &&
        node.arguments[0] &&
        node.arguments[0].type === 'Literal'
      ) {
        imports.push(node.arguments[0].value);
      }
    },
  });

  return imports;
}

function collectReExports(ast: any): string[] {
  const reExports: string[] = [];
  if (!ast) return reExports;

  walk(ast, {
    enter(node: any) {
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.source &&
        node.specifiers &&
        node.specifiers.length > 0
      ) {
        reExports.push(node.source.value);
      }
      if (node.type === 'ExportAllDeclaration' && node.source) {
        reExports.push(node.source.value);
      }
      if (node.type === 'ExportDefaultDeclaration' && node.source) {
        reExports.push(node.source.value);
      }
    },
  });

  return reExports;
}

function expandFolderReExport(folderPath: string, _baseDir: string): string[] {
  const resolvedFiles: string[] = [];

  for (const ext of ['.ts', '.js', '.mjs', '.cjs']) {
    const indexPath = path.join(folderPath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      console.log(`   📂 Раскрываем папку: ${path.basename(folderPath)} → index${ext}`);
      const ast = parseFile(indexPath);
      if (ast) {
        const reExports = collectReExports(ast);
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

export default buildProjectGraph;
