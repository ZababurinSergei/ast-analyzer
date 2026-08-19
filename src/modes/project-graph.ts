// modes/project-graph.ts
import path from 'path';
import fs from 'fs';
import {
  parseFile,
  resolveFilePath,
  isExternalModule,
  getTsConfigForFile,
} from '../core/ast-parser.js';
import { extractEntities, type EntitiesResult } from '../core/entity-extractor.js';
import { IGNORE_NODE_MODULES } from '../config.js';
import { walk } from 'estree-walker';
import { normalizePathForDisplay } from '../utils/path-utils.js';

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
// ТИП: Информация о пакете (модуле)
// ==========================================
export interface PackageLockPackage {
  version: string;
  resolved: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<
    string,
    {
      direction: 'inward';
      type: 'import' | 'external-import' | 'internal-import';
      specifiers: string[];
      functions: Record<string, PackageLockFunctionInfo>;
    }
  >;
  exports: Record<
    string,
    {
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
  >;
}

// ==========================================
// ТИП: Граф вызовов (отдельный тип для устранения ошибок)
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
// ФУНКЦИЯ ДЛЯ ПОСТРОЕНИЯ ГРАФА ВЫЗОВОВ МЕЖДУ ФУНКЦИЯМИ
// ==========================================
export function buildCallGraphBetweenFunctions(
  allFunctions: Map<string, { module: string; line: number; isAsync: boolean; calls: string[] }>,
  fromFunction: string,
  toFunction: string
): CallGraphResult {
  // Проверяем существование функций
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

  // BFS для поиска пути
  const visited = new Set<string>();
  const queue: { func: string; path: string[] }[] = [{ func: fromFunction, path: [fromFunction] }];
  const nodes: CallGraphResult['nodes'] = [];
  const edges: CallGraphResult['edges'] = [];

  while (queue.length > 0) {
    const { func, path } = queue.shift()!;

    if (visited.has(func)) continue;
    visited.add(func);

    // Добавляем узел
    const funcInfo = allFunctions.get(func);
    if (funcInfo) {
      nodes.push({
        function: func,
        module: funcInfo.module,
        line: funcInfo.line,
        isAsync: funcInfo.isAsync,
      });
    }

    // Если нашли целевую функцию
    if (func === toFunction) {
      return {
        from: fromFunction,
        to: toFunction,
        path,
        found: true,
        nodes,
        edges,
      };
    }

    // Добавляем вызовы
    const info = allFunctions.get(func);
    if (info) {
      for (const call of info.calls) {
        if (!visited.has(call)) {
          queue.push({ func: call, path: [...path, call] });
          edges.push({
            from: func,
            to: call,
            line: info.line,
          });
        }
      }
    }
  }

  // Путь не найден
  return {
    from: fromFunction,
    to: toFunction,
    path: [],
    found: false,
    reason: `Путь от '${fromFunction}' к '${toFunction}' не найден. Проверьте, что функции связаны цепочкой вызовов.`,
    nodes,
    edges,
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

  // Сбор всех функций для построения графа вызовов
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

    // Извлекаем сущности если включено
    if (includeEntities) {
      const entities = extractEntities(ast, currentPath);
      entitiesMap[relativeKey] = entities;

      // Собираем функции для графа вызовов
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

  // Нормализуем граф
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
    const normalizedEntities: Record<string, EntitiesResult> = {};
    for (const [key, entities] of Object.entries(entitiesMap)) {
      const normalizedKey = normalizePathForDisplay(key);
      normalizedEntities[normalizedKey] = entities;
    }
    result.entities = normalizedEntities;

    // Строим отчет в стиле package-lock
    const packageLockReport = buildPackageLockReport(
      result.rootKey,
      normalizedGraph,
      normalizedEntities
    );
    result.packageLockReport = packageLockReport;

    // Если указаны начальная и конечная функции, строим граф вызовов
    if (fromFunction && toFunction) {
      // Собираем все функции из entities
      const allFuncs = new Map<
        string,
        { module: string; line: number; isAsync: boolean; calls: string[] }
      >();
      for (const [modulePath, entities] of Object.entries(normalizedEntities)) {
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
// ФУНКЦИЯ ДЛЯ ПОСТРОЕНИЯ ОТЧЕТА В СТИЛЕ PACKAGE-LOCK
// ==========================================
function buildPackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>
): PackageLockReport {
  const packages: Record<string, PackageLockPackage> = {};
  const inwardDeps: Record<string, string[]> = {};
  const outwardDeps: Record<string, string[]> = {};
  const importsFlow: PackageLockReport['importExportFlow']['imports'] = {};
  const exportsFlow: PackageLockReport['importExportFlow']['exports'] = {};

  // Инициализируем inwardDeps и outwardDeps
  for (const modulePath of Object.keys(graph)) {
    inwardDeps[modulePath] = [];
    outwardDeps[modulePath] = [];
    importsFlow[modulePath] = { importsFrom: [] };
    exportsFlow[modulePath] = { exportsTo: [] };
  }

  // Строим граф зависимостей
  for (const [from, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (inwardDeps[from]) {
        inwardDeps[from].push(dep);
      }
      if (outwardDeps[dep]) {
        outwardDeps[dep].push(from);
      }
    }
  }

  // Строим пакеты
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    const isEntry = modulePath === rootKey;
    const ext = path.extname(modulePath);
    let language: PackageLockPackage['language'] = 'typescript';
    if (ext === '.js' || ext === '.jsx') language = 'javascript';
    else if (ext === '.vue') language = 'vue';
    else if (ext === '.tsx') language = 'jsx';

    // Строим imports
    const imports: PackageLockPackage['imports'] = {};
    for (const imp of entities.imports) {
      const importKey = imp.source;
      imports[importKey] = {
        direction: 'inward',
        type: imp.source.startsWith('.') ? 'internal-import' : 'external-import',
        specifiers: imp.specifiers,
        functions: {},
      };

      // Добавляем импортируемые функции
      for (const spec of imp.specifiers) {
        const funcName = spec.replace(/ as .*$/, '');
        const func = entities.functions.find(f => f.name === funcName);
        if (func) {
          imports[importKey].functions[funcName] = {
            isAsync: func.isAsync,
            isExported: func.isExported,
            params: func.params,
            line: func.line,
            direction: 'inward',
            calls: func.calls.map(call => ({
              target: call,
              direction: 'inward',
              isAsync: false,
            })),
          };
        }
      }
    }

    // Строим exports
    const exports: PackageLockPackage['exports'] = {};
    for (const func of entities.functions) {
      if (func.isExported) {
        // Создаем объект экспорта
        const exportEntry: PackageLockPackage['exports'][string] = {
          direction: 'outward',
          type: 'export',
          isAsync: func.isAsync,
          params: func.params,
          returns: func.returnType || 'any',
          line: func.line,
          consumers: [],
        };
        exports[func.name] = exportEntry;

        // Добавляем потребителей (модули, которые импортируют эту функцию)
        for (const [otherModule, otherEntities] of Object.entries(entitiesMap)) {
          if (otherModule === modulePath) continue;
          for (const otherFunc of otherEntities.functions) {
            if (otherFunc.calls && otherFunc.calls.includes(func.name)) {
              const entry = exports[func.name];
              if (entry && entry.consumers) {
                entry.consumers.push({
                  module: otherModule,
                  direction: 'outward',
                  type: 'call',
                });
              }
            }
          }
        }
      }
    }

    // Добавляем поток импортов
    for (const imp of entities.imports) {
      const impSource = imp.source;
      if (!importsFlow[modulePath]) {
        importsFlow[modulePath] = { importsFrom: [] };
      }
      const specifiers = imp.specifiers || [];
      const firstSpecifier = specifiers[0] || '';
      importsFlow[modulePath].importsFrom.push({
        module: impSource,
        type: specifiers.length === 1 && firstSpecifier.includes('default') ? 'default' : 'named',
        imports: specifiers,
      });
    }

    // Добавляем поток экспортов
    for (const func of entities.functions) {
      if (func.isExported) {
        const consumers: { module: string; type: 'named' | 'default'; exports: string[] }[] = [];
        for (const [otherModule, otherEntities] of Object.entries(entitiesMap)) {
          if (otherModule === modulePath) continue;
          for (const otherFunc of otherEntities.functions) {
            if (otherFunc.calls && otherFunc.calls.includes(func.name)) {
              consumers.push({
                module: otherModule,
                type: 'named',
                exports: [func.name],
              });
            }
          }
        }
        if (consumers.length > 0) {
          if (!exportsFlow[modulePath]) {
            exportsFlow[modulePath] = { exportsTo: [] };
          }
          for (const consumer of consumers) {
            exportsFlow[modulePath].exportsTo.push(consumer);
          }
        }
      }
    }

    packages[modulePath] = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      type: 'module',
      language,
      isEntry,
      imports,
      exports,
    };
  }

  // Находим entry функции
  const entryFunctions: string[] = [];
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (modulePath === rootKey) {
      for (const func of entities.functions) {
        if (func.isExported) {
          entryFunctions.push(func.name);
        }
      }
    }
  }

  // Строим executionFlow
  const executionSteps: PackageLockReport['executionGraph']['executionFlow']['steps'] = [];
  const rootEntities = entitiesMap[rootKey];
  if (rootEntities) {
    for (const func of rootEntities.functions) {
      if (func.isExported) {
        executionSteps.push({
          func: func.name,
          module: rootKey,
          direction: 'self',
          isAsync: func.isAsync,
        });
      }
    }
  }

  return {
    name: 'ast-analyzer',
    version: '3.0.0',
    lockfileVersion: 3,
    packages,
    dependencyGraph: {
      direction: 'bidirectional',
      inwardDependencies: inwardDeps,
      outwardDependencies: outwardDeps,
    },
    executionGraph: {
      entryPoint: rootKey,
      direction: 'top-down',
      entryFunctions,
      executionFlow: {
        type: 'sequential',
        steps: executionSteps,
      },
    },
    importExportFlow: {
      imports: importsFlow,
      exports: exportsFlow,
    },
  };
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
