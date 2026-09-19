// src/reporters/modules/flows.ts

import type { EntitiesResult, GraphData, EnhancedPackageInfo } from '../../types.js';

/**
 * Строит граф выполнения на основе графа зависимостей и сущностей
 */
export function buildExecutionGraph(
  entryPoint: string,
  entitiesMap: Record<string, EntitiesResult>,
  _data: GraphData,
  packages: Record<string, EnhancedPackageInfo>
): {
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
} {
  const entryFunctions: string[] = [];
  const steps: {
    func: string;
    module: string;
    direction: 'inward' | 'outward' | 'self';
    isAsync: boolean;
    branches?: Record<string, any>;
  }[] = [];

  // Находим все функции в корневом модуле
  const rootEntities = entitiesMap[entryPoint];
  if (rootEntities) {
    for (const func of rootEntities.functions || []) {
      if (func.isExported) {
        entryFunctions.push(func.name);
        steps.push({
          func: func.name,
          module: entryPoint,
          direction: 'outward',
          isAsync: func.isAsync || false,
        });
      }
    }
  }

  // Если нет экспортов, берем все функции
  if (entryFunctions.length === 0 && rootEntities) {
    for (const func of rootEntities.functions || []) {
      entryFunctions.push(func.name);
      steps.push({
        func: func.name,
        module: entryPoint,
        direction: 'self',
        isAsync: func.isAsync || false,
      });
    }
  }

  // Добавляем функции из зависимостей
  const deps = _data.graph[entryPoint] || [];
  for (const dep of deps) {
    const depEntities = entitiesMap[dep];
    if (!depEntities) continue;

    for (const func of depEntities.functions || []) {
      if (func.isExported) {
        steps.push({
          func: func.name,
          module: dep,
          direction: 'inward',
          isAsync: func.isAsync || false,
        });
      }
    }
  }

  // Проверяем наличие пакета для корневого модуля
  const rootPackage = packages[entryPoint];
  if (rootPackage && !rootPackage.isEntry) {
    // Если корневой пакет не отмечен как entry, но является точкой входа
    (packages[entryPoint] as any).isEntry = true;
  }

  return {
    entryPoint,
    direction: 'top-down',
    entryFunctions,
    executionFlow: {
      type: steps.length > 1 ? 'sequential' : 'sequential',
      steps,
    },
  };
}

/**
 * Строит поток импортов/экспортов между модулями
 */
export function buildImportExportFlow(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _data: GraphData,
  _packages: Record<string, EnhancedPackageInfo>
): {
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
} {
  const imports: Record<
    string,
    {
      importsFrom: {
        module: string;
        type: 'named' | 'default' | 'namespace';
        imports: string[];
      }[];
    }
  > = {};

  const exports: Record<
    string,
    {
      exportsTo: {
        module: string;
        type: 'named' | 'default';
        exports: string[];
      }[];
    }
  > = {};

  // Инициализируем структуры для всех модулей
  for (const modulePath of Object.keys(graph)) {
    imports[modulePath] = { importsFrom: [] };
    exports[modulePath] = { exportsTo: [] };
  }

  // Анализируем импорты каждого модуля
  for (const [modulePath, deps] of Object.entries(graph)) {
    const entities = entitiesMap[modulePath];
    if (!entities) continue;

    // Собираем импорты из AST
    const importList = entities.imports || [];

    for (const imp of importList) {
      const source = imp.source;
      if (!source) continue;

      // Пытаемся найти целевой модуль
      let targetModule: string | undefined;

      // Проверяем, есть ли такой модуль в графе
      for (const dep of deps) {
        if (dep.includes(source) || source.includes(dep)) {
          targetModule = dep;
          break;
        }
      }

      // Если не нашли, пробуем по имени файла
      if (!targetModule) {
        const baseName =
          source
            .split('/')
            .pop()
            ?.replace(/\.[^.]+$/, '') || '';
        for (const dep of deps) {
          const depBaseName =
            dep
              .split('/')
              .pop()
              ?.replace(/\.[^.]+$/, '') || '';
          if (depBaseName === baseName) {
            targetModule = dep;
            break;
          }
        }
      }

      if (!targetModule) {
        // Пропускаем неразрешенные импорты (внешние модули)
        continue;
      }

      // Определяем тип импорта
      let importType: 'named' | 'default' | 'namespace' = 'named';
      const specifiers: string[] = [];

      for (const spec of imp.specifiers) {
        const specObj = typeof spec === 'string' ? { imported: spec, local: spec } : spec;
        const name = specObj.imported || specObj.local || '';
        if (name) {
          specifiers.push(name);
        }

        const specType = (specObj as any).type;
        if (specType === 'ImportDefaultSpecifier') {
          importType = 'default';
        } else if (specType === 'ImportNamespaceSpecifier') {
          importType = 'namespace';
        }
      }

      // Добавляем импорт
      if (specifiers.length > 0) {
        if (!imports[modulePath]) {
          imports[modulePath] = { importsFrom: [] };
        }

        const moduleImports = imports[modulePath];
        if (moduleImports) {
          const existing = moduleImports.importsFrom.find(item => item.module === targetModule);

          if (existing) {
            // Добавляем новые спецификаторы
            for (const spec of specifiers) {
              if (!existing.imports.includes(spec)) {
                existing.imports.push(spec);
              }
            }
          } else {
            moduleImports.importsFrom.push({
              module: targetModule,
              type: importType,
              imports: specifiers,
            });
          }
        }
      }
    }
  }

  // Строим обратные связи (экспорты)
  for (const [modulePath, moduleImports] of Object.entries(imports)) {
    if (!moduleImports) continue;

    for (const imp of moduleImports.importsFrom) {
      const targetModule = imp.module;

      if (!exports[targetModule]) {
        exports[targetModule] = { exportsTo: [] };
      }

      const targetExports = exports[targetModule];
      if (targetExports) {
        // Проверяем, не добавлен ли уже такой экспорт
        const existing = targetExports.exportsTo.find(item => item.module === modulePath);

        if (existing) {
          // Добавляем новые экспорты
          for (const exp of imp.imports) {
            if (!existing.exports.includes(exp)) {
              existing.exports.push(exp);
            }
          }
        } else {
          targetExports.exportsTo.push({
            module: modulePath,
            type: imp.type === 'namespace' ? 'named' : imp.type,
            exports: [...imp.imports],
          });
        }
      }
    }
  }

  // Удаляем пустые записи из imports
  const importKeys = Object.keys(imports);
  for (const modulePath of importKeys) {
    const moduleImports = imports[modulePath];
    if (moduleImports && moduleImports.importsFrom.length === 0) {
      delete imports[modulePath];
    }
  }

  // Удаляем пустые записи из exports
  const exportKeys = Object.keys(exports);
  for (const modulePath of exportKeys) {
    const moduleExports = exports[modulePath];
    if (moduleExports && moduleExports.exportsTo.length === 0) {
      delete exports[modulePath];
    }
  }

  return { imports, exports };
}

/**
 * Находит путь между двумя функциями в графе вызовов
 */
export function findCallPath(
  fromFunction: string,
  toFunction: string,
  callGraph: Record<string, string[]>
): {
  found: boolean;
  path: string[];
  reason?: string;
} {
  if (!callGraph[fromFunction]) {
    return {
      found: false,
      path: [],
      reason: `Function '${fromFunction}' not found in call graph`,
    };
  }

  if (!callGraph[toFunction]) {
    return {
      found: false,
      path: [],
      reason: `Function '${toFunction}' not found in call graph`,
    };
  }

  const visited = new Set<string>();
  const queue: { func: string; path: string[] }[] = [{ func: fromFunction, path: [fromFunction] }];

  while (queue.length > 0) {
    const { func, path } = queue.shift()!;

    if (visited.has(func)) continue;
    visited.add(func);

    if (func === toFunction) {
      return { found: true, path };
    }

    const calls = callGraph[func] || [];
    for (const call of calls) {
      if (!visited.has(call)) {
        queue.push({ func: call, path: [...path, call] });
      }
    }
  }

  return {
    found: false,
    path: [],
    reason: `No path found from '${fromFunction}' to '${toFunction}'`,
  };
}

/**
 * Находит все функции, которые зависят от указанной
 */
export function findDependents(
  functionName: string,
  callGraph: Record<string, string[]>
): string[] {
  const dependents: string[] = [];
  const visited = new Set<string>();

  const find = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);

    for (const [caller, callees] of Object.entries(callGraph)) {
      if (callees.includes(name) && !visited.has(caller)) {
        dependents.push(caller);
        find(caller);
      }
    }
  };

  find(functionName);
  return dependents;
}

/**
 * Находит все функции, от которых зависит указанная
 */
export function findDependencies(
  functionName: string,
  callGraph: Record<string, string[]>
): string[] {
  const dependencies: string[] = [];
  const visited = new Set<string>();

  const find = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);

    const callees = callGraph[name] || [];
    for (const callee of callees) {
      if (!visited.has(callee)) {
        dependencies.push(callee);
        find(callee);
      }
    }
  };

  find(functionName);
  return dependencies;
}

/**
 * Находит циклические зависимости в графе вызовов
 */
export function findCallCycles(callGraph: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string) => {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const callees = callGraph[node] || [];
    for (const callee of callees) {
      dfs(callee);
    }

    recursionStack.delete(node);
    path.pop();
  };

  for (const node of Object.keys(callGraph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Возвращает статистику по графу вызовов
 */
export function getCallGraphStats(callGraph: Record<string, string[]>): {
  totalNodes: number;
  totalEdges: number;
  entryPoints: string[];
  exitPoints: string[];
  avgOutDegree: number;
  maxOutDegree: number;
  cycles: number;
} {
  const nodes = Object.keys(callGraph);
  const edges = Object.values(callGraph).reduce((sum, callees) => sum + callees.length, 0);

  // Точки входа (функции, которые не вызываются)
  const called = new Set<string>();
  for (const callees of Object.values(callGraph)) {
    for (const callee of callees) {
      called.add(callee);
    }
  }
  const entryPoints = nodes.filter(n => !called.has(n));

  // Точки выхода (функции, которые никого не вызывают)
  const exitPoints = nodes.filter(n => (callGraph[n] || []).length === 0);

  // Степени
  const outDegrees = nodes.map(n => (callGraph[n] || []).length);
  const avgOutDegree =
    outDegrees.length > 0 ? outDegrees.reduce((a, b) => a + b, 0) / outDegrees.length : 0;
  const maxOutDegree = outDegrees.length > 0 ? Math.max(...outDegrees) : 0;

  // Циклы
  const cycles = findCallCycles(callGraph);

  return {
    totalNodes: nodes.length,
    totalEdges: edges,
    entryPoints,
    exitPoints,
    avgOutDegree,
    maxOutDegree,
    cycles: cycles.length,
  };
}

/**
 * Строит граф вызовов из сущностей
 */
export function buildCallGraphFromEntities(
  entitiesMap: Record<string, EntitiesResult>
): Record<string, string[]> {
  const callGraph: Record<string, string[]> = {};

  for (const entities of Object.values(entitiesMap)) {
    if (!entities) continue;

    for (const func of entities.functions || []) {
      const key = func.isMethod && func.className ? `${func.className}.${func.name}` : func.name;
      if (!callGraph[key]) {
        callGraph[key] = [];
      }
      const calls = func.calls || [];
      callGraph[key] = calls;
    }

    // Добавляем методы классов
    for (const cls of entities.classes || []) {
      if (!cls.name) continue;
      for (const method of cls.methods || []) {
        const key = `${cls.name}.${method}`;
        if (!callGraph[key]) {
          callGraph[key] = [];
        }
      }
    }
  }

  return callGraph;
}

// Экспорт по умолчанию
export default {
  buildExecutionGraph,
  buildImportExportFlow,
  findCallPath,
  findDependents,
  findDependencies,
  findCallCycles,
  getCallGraphStats,
  buildCallGraphFromEntities,
};
