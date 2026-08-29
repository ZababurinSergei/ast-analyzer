// src/reporters/modules/flows.ts
import type { EnhancedPackageLockReport, EnhancedPackageInfo } from '../json-reporter.js';
import type { EntitiesResult } from '../../types.js';

// ============================================================
// ФУНКЦИИ ДЛЯ ПОСТРОЕНИЯ ГРАФА ВЫПОЛНЕНИЯ (EXECUTION GRAPH)
// ============================================================

/**
 * Строит граф выполнения (execution graph) на основе графа зависимостей
 * и информации о сущностях
 */
export function buildExecutionGraph(
  rootKey: string,
  entitiesMap: Record<string, EntitiesResult>,
  _graphData: { rootKey: string; graph: Record<string, string[]> },
  _packages: Record<string, EnhancedPackageInfo>
): EnhancedPackageLockReport['executionGraph'] {
  const entryFunctions: string[] = [];
  const steps: {
    func: string;
    module: string;
    direction: 'inward' | 'outward' | 'self';
    isAsync: boolean;
    branches?: Record<string, any>;
  }[] = [];

  // Находим точки входа: экспортируемые функции из корневого модуля
  const rootEntities = entitiesMap[rootKey];
  if (rootEntities) {
    for (const func of rootEntities.functions || []) {
      if (func.isExported && func.name) {
        entryFunctions.push(func.name);
      }
    }
  }

  // Если нет экспортов, используем все функции корневого модуля
  if (entryFunctions.length === 0 && rootEntities) {
    for (const func of rootEntities.functions || []) {
      if (func.name) {
        entryFunctions.push(func.name);
      }
    }
  }

  // Строим шаги выполнения (BFS от точек входа)
  const visited = new Set<string>();
  const queue: { func: string; module: string; direction: 'inward' | 'outward' | 'self' }[] = [];

  for (const funcName of entryFunctions) {
    queue.push({
      func: funcName,
      module: rootKey,
      direction: 'outward',
    });
  }

  while (queue.length > 0) {
    const item = queue.shift()!;
    const key = `${item.module}#${item.func}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // Определяем isAsync
    let isAsync = false;
    const entities = entitiesMap[item.module];
    if (entities) {
      const func = entities.functions?.find((f: any) => f.name === item.func);
      if (func) {
        isAsync = func.isAsync || false;
      }
    }

    steps.push({
      func: item.func,
      module: item.module,
      direction: item.direction,
      isAsync,
    });

    // Находим вызовы из текущей функции
    const callGraph = entitiesMap[item.module]?.callGraph || {};
    const calls = callGraph[item.func] || [];

    for (const call of calls) {
      // Ищем вызываемую функцию в том же модуле
      const sameModuleFunc = entitiesMap[item.module]?.functions?.find((f: any) => f.name === call);
      if (sameModuleFunc) {
        queue.push({
          func: call,
          module: item.module,
          direction: 'self',
        });
        continue;
      }

      // Ищем в других модулях
      let found = false;
      for (const [modulePath, modEntities] of Object.entries(entitiesMap)) {
        if (modulePath === item.module) continue;
        const func = modEntities.functions?.find((f: any) => f.name === call);
        if (func && func.isExported) {
          queue.push({
            func: call,
            module: modulePath,
            direction: 'inward',
          });
          found = true;
          break;
        }
      }

      // Если не нашли, добавляем как outward (внешний вызов)
      if (!found) {
        // Проверяем, не является ли вызов внешним импортом
        const imports = entitiesMap[item.module]?.imports || [];
        let isExternal = false;
        for (const imp of imports) {
          if (
            imp.source &&
            (imp.source.includes(call) ||
              imp.specifiers.some((s: any) => {
                const spec = typeof s === 'string' ? s : s.imported || s.local;
                return spec === call;
              }))
          ) {
            isExternal = true;
            break;
          }
        }

        if (isExternal) {
          steps.push({
            func: call,
            module: item.module,
            direction: 'outward',
            isAsync: false,
          });
        }
      }
    }
  }

  // Определяем тип выполнения
  let executionType: 'sequential' | 'parallel' | 'conditional' = 'sequential';

  // Проверяем наличие ветвлений (условий)
  const hasConditional = steps.some(s => {
    const entities = entitiesMap[s.module];
    if (!entities) return false;
    const func = entities.functions?.find((f: any) => f.name === s.func);
    if (!func || !func.body) return false;
    return func.body.includes('if') || func.body.includes('?') || func.body.includes('switch');
  });

  if (hasConditional) {
    executionType = 'conditional';
  } else if (steps.length > 1) {
    // Проверяем наличие параллельных вызовов (Promise.all, await Promise.all)
    const hasParallel = steps.some(s => {
      const entities = entitiesMap[s.module];
      if (!entities) return false;
      const func = entities.functions?.find((f: any) => f.name === s.func);
      if (!func || !func.body) return false;
      return func.body.includes('Promise.all') || func.body.includes('await Promise');
    });
    if (hasParallel) {
      executionType = 'parallel';
    }
  }

  return {
    entryPoint: rootKey,
    direction: 'top-down',
    entryFunctions,
    executionFlow: {
      type: executionType,
      steps,
    },
  };
}

// ============================================================
// ФУНКЦИИ ДЛЯ ПОСТРОЕНИЯ IMPORT/EXPORT FLOW
// ============================================================

/**
 * Строит поток импортов и экспортов между модулями
 */
export function buildImportExportFlow(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _graphData: { rootKey: string; graph: Record<string, string[]> },
  _packages: Record<string, EnhancedPackageInfo>
): EnhancedPackageLockReport['importExportFlow'] {
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

  // Анализируем импорты из entitiesMap
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    for (const imp of entities.imports || []) {
      const source = imp.source;
      if (!source) continue;

      // Определяем тип импорта
      let importType: 'named' | 'default' | 'namespace' = 'named';

      const specifiers = imp.specifiers || [];
      const hasDefault = specifiers.some((s: any) => {
        const spec = typeof s === 'string' ? s : s.imported || s.local;
        return spec === 'default' || spec === 'default as';
      });
      const hasNamespace = specifiers.some((s: any) => {
        const spec = typeof s === 'string' ? s : s.imported || s.local;
        return spec.includes('* as');
      });

      if (hasNamespace) importType = 'namespace';
      else if (hasDefault) importType = 'default';

      const importNames: string[] = [];
      for (const spec of specifiers) {
        const specObj = typeof spec === 'string' ? { imported: spec, local: spec } : spec;
        const name = specObj.imported || specObj.local || '';
        if (name && name !== 'default' && !name.includes('* as')) {
          importNames.push(name);
        }
      }

      // Находим модуль-источник
      let targetModule = source;
      // Проверяем, есть ли такой модуль в графе
      if (!graph[source]) {
        // Пробуем найти по имени файла
        const baseName = source.split('/').pop() || '';
        for (const modPath of Object.keys(graph)) {
          if (modPath.endsWith(baseName) || modPath.includes(source)) {
            targetModule = modPath;
            break;
          }
        }
      }

      if (targetModule && imports[modulePath]) {
        // Проверяем, не добавлен ли уже такой импорт
        const existing = imports[modulePath].importsFrom.find(
          (item: any) => item.module === targetModule
        );
        if (existing) {
          // Добавляем новые имена
          for (const name of importNames) {
            if (!existing.imports.includes(name)) {
              existing.imports.push(name);
            }
          }
        } else {
          imports[modulePath].importsFrom.push({
            module: targetModule,
            type: importType,
            imports: importNames,
          });
        }

        // Добавляем экспорт в целевой модуль
        const targetExports = exports[targetModule];
        if (targetExports) {
          const exportNames = importNames.filter(name => {
            // Проверяем, что сущность действительно экспортируется
            const targetEntities = entitiesMap[targetModule];
            if (!targetEntities) return false;
            const func = targetEntities.functions?.find((f: any) => f.name === name);
            const constItem = targetEntities.constants?.find((c: any) => c.name === name);
            const varItem = targetEntities.variables?.find((v: any) => v.name === name);
            const cls = targetEntities.classes?.find((c: any) => c.name === name);
            const intf = targetEntities.interfaces?.find((i: any) => i.name === name);
            const type = targetEntities.types?.find((t: any) => t.name === name);
            return (
              func?.isExported ||
              constItem?.isExported ||
              varItem?.isExported ||
              cls?.isExported ||
              intf?.isExported ||
              type?.isExported
            );
          });

          if (exportNames.length > 0) {
            const existingExport = targetExports.exportsTo.find(
              (item: any) => item.module === modulePath
            );
            if (existingExport) {
              for (const name of exportNames) {
                if (!existingExport.exports.includes(name)) {
                  existingExport.exports.push(name);
                }
              }
            } else {
              targetExports.exportsTo.push({
                module: modulePath,
                type: importType === 'namespace' ? 'named' : importType,
                exports: exportNames,
              });
            }
          }
        }
      }
    }
  }

  // Добавляем реэкспорты
  // Реэкспорты определяются через ExportNamedDeclaration с source в AST
  // В модели EntitiesResult они представлены как exports с дополнительным полем source
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    for (const exp of entities.exports || []) {
      // Проверяем наличие source через приведение к any
      // Реэкспорты имеют поле source, обычные экспорты - нет
      const expAny = exp as any;
      const source = expAny.source;

      // Если есть source и это не default экспорт - это реэкспорт
      if (source && typeof source === 'string' && !exp.isDefault) {
        const targetExports = exports[modulePath];
        if (targetExports) {
          const existing = targetExports.exportsTo.find((item: any) => item.module === source);
          if (existing) {
            if (!existing.exports.includes(exp.name)) {
              existing.exports.push(exp.name);
            }
          } else {
            targetExports.exportsTo.push({
              module: source,
              type: 'named',
              exports: [exp.name],
            });
          }
        }
      }
    }
  }

  return {
    imports,
    exports,
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Находит все модули, которые зависят от указанного
 */
export function findDependents(modulePath: string, graph: Record<string, string[]>): string[] {
  const dependents: string[] = [];

  for (const [from, deps] of Object.entries(graph)) {
    if (deps.includes(modulePath)) {
      dependents.push(from);
    }
  }

  return dependents;
}

/**
 * Находит все модули, от которых зависит указанный
 */
export function findDependencies(modulePath: string, graph: Record<string, string[]>): string[] {
  return graph[modulePath] || [];
}

/**
 * Проверяет, есть ли циклические зависимости между модулями
 */
export function hasCyclicDependencies(
  modulePath: string,
  graph: Record<string, string[]>,
  visited: Set<string> = new Set(),
  stack: Set<string> = new Set()
): boolean {
  if (stack.has(modulePath)) return true;
  if (visited.has(modulePath)) return false;

  visited.add(modulePath);
  stack.add(modulePath);

  const deps = graph[modulePath] || [];
  for (const dep of deps) {
    if (hasCyclicDependencies(dep, graph, visited, stack)) {
      return true;
    }
  }

  stack.delete(modulePath);
  return false;
}

/**
 * Находит все циклические зависимости в графе
 */
export function findAllCycles(graph: Record<string, string[]>): string[][] {
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

    const deps = graph[node] || [];
    for (const dep of deps) {
      dfs(dep);
    }

    recursionStack.delete(node);
    path.pop();
  };

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Получает уровень модуля (глубину) в графе
 */
export function getModuleLevel(
  modulePath: string,
  graph: Record<string, string[]>,
  levels: Map<string, number> = new Map()
): number {
  if (levels.has(modulePath)) {
    return levels.get(modulePath)!;
  }

  const deps = graph[modulePath] || [];
  if (deps.length === 0) {
    levels.set(modulePath, 0);
    return 0;
  }

  let maxDepth = 0;
  for (const dep of deps) {
    const depth = getModuleLevel(dep, graph, levels);
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  const level = maxDepth + 1;
  levels.set(modulePath, level);
  return level;
}

/**
 * Находит модули с наибольшим количеством зависимостей
 */
export function findModulesWithMostDependencies(
  graph: Record<string, string[]>,
  limit: number = 10
): { module: string; count: number; dependencies: string[] }[] {
  const results = Object.entries(graph)
    .map(([module, deps]) => ({
      module,
      count: deps.length,
      dependencies: deps,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return results;
}

/**
 * Находит модули, от которых больше всего зависят
 */
export function findMostDependentModules(
  graph: Record<string, string[]>,
  limit: number = 10
): { module: string; count: number; dependents: string[] }[] {
  const dependentsMap: Record<string, string[]> = {};

  for (const [from, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (!dependentsMap[dep]) {
        dependentsMap[dep] = [];
      }
      dependentsMap[dep].push(from);
    }
  }

  return Object.entries(dependentsMap)
    .map(([module, dependents]) => ({
      module,
      count: dependents.length,
      dependents,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Проверяет, является ли модуль корневым (не имеет зависимостей)
 */
export function isRootModule(modulePath: string, graph: Record<string, string[]>): boolean {
  const deps = graph[modulePath] || [];
  return deps.length === 0;
}

/**
 * Проверяет, является ли модуль листовым (от него никто не зависит)
 */
export function isLeafModule(modulePath: string, graph: Record<string, string[]>): boolean {
  for (const deps of Object.values(graph)) {
    if (deps.includes(modulePath)) {
      return false;
    }
  }
  return true;
}

/**
 * Получает все модули на указанном уровне
 */
export function getModulesByLevel(level: number, graph: Record<string, string[]>): string[] {
  const result: string[] = [];
  const levels = new Map<string, number>();

  for (const modulePath of Object.keys(graph)) {
    const moduleLevel = getModuleLevel(modulePath, graph, levels);
    if (moduleLevel === level) {
      result.push(modulePath);
    }
  }

  return result;
}

/**
 * Строит путь от одного модуля к другому (BFS)
 */
export function findPath(
  from: string,
  to: string,
  graph: Record<string, string[]>
): string[] | null {
  if (from === to) return [from];

  const visited = new Set<string>();
  const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (visited.has(node)) continue;
    visited.add(node);

    const deps = graph[node] || [];
    for (const dep of deps) {
      if (dep === to) {
        return [...path, dep];
      }
      if (!visited.has(dep)) {
        queue.push({ node: dep, path: [...path, dep] });
      }
    }
  }

  return null;
}

/**
 * Получает статистику по графу
 */
export function getGraphStats(graph: Record<string, string[]>): {
  totalModules: number;
  totalEdges: number;
  avgDependencies: number;
  maxDependencies: number;
  minDependencies: number;
  modulesWithNoDeps: number;
  hasCycles: boolean;
  cyclesCount: number;
  maxDepth: number;
} {
  let totalEdges = 0;
  let maxDeps = 0;
  let minDeps = Infinity;
  let modulesWithNoDeps = 0;

  for (const deps of Object.values(graph)) {
    const count = deps.length;
    totalEdges += count;
    if (count > maxDeps) maxDeps = count;
    if (count < minDeps) minDeps = count;
    if (count === 0) modulesWithNoDeps++;
  }

  const totalModules = Object.keys(graph).length;
  const avgDependencies = totalModules > 0 ? totalEdges / totalModules : 0;
  const cycles = findAllCycles(graph);

  // Вычисляем максимальную глубину
  let maxDepth = 0;
  const levels = new Map<string, number>();
  for (const modulePath of Object.keys(graph)) {
    const depth = getModuleLevel(modulePath, graph, levels);
    if (depth > maxDepth) maxDepth = depth;
  }

  return {
    totalModules,
    totalEdges,
    avgDependencies,
    maxDependencies: maxDeps,
    minDependencies: minDeps === Infinity ? 0 : minDeps,
    modulesWithNoDeps,
    hasCycles: cycles.length > 0,
    cyclesCount: cycles.length,
    maxDepth,
  };
}
