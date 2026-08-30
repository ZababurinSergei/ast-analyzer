// src/reporters/modules/graphs.ts
// Модуль для построения и анализа графов зависимостей

/**
 * Строит граф зависимостей (входящие и исходящие)
 * ✅ ИСПРАВЛЕНО: инициализирует ВСЕ узлы, даже без зависимостей
 */
export function buildDependencyGraph(graph: Record<string, string[]>): {
  inwardDependencies: Record<string, string[]>;
  outwardDependencies: Record<string, string[]>;
} {
  const inwardDependencies: Record<string, string[]> = {};
  const outwardDependencies: Record<string, string[]> = {};

  // ✅ ШАГ 1: Инициализируем ВСЕ узлы с пустыми массивами
  // Это гарантирует, что даже узлы без зависимостей будут иметь запись в графе
  for (const node of Object.keys(graph)) {
    outwardDependencies[node] = [];
    inwardDependencies[node] = [];
  }

  // ✅ ШАГ 2: Добавляем ребра между узлами
  for (const [from, deps] of Object.entries(graph)) {
    // Проверяем, что массив зависимостей существует
    if (!Array.isArray(deps)) {
      continue;
    }

    // Убеждаемся, что у узла есть запись в графе
    if (!outwardDependencies[from]) {
      outwardDependencies[from] = [];
    }

    for (const to of deps) {
      // Добавляем исходящую зависимость
      outwardDependencies[from].push(to);

      // Добавляем входящую зависимость (обратную связь)
      if (!inwardDependencies[to]) {
        inwardDependencies[to] = [];
      }
      inwardDependencies[to].push(from);
    }
  }

  return { inwardDependencies, outwardDependencies };
}

/**
 * Находит циклические зависимости в графе
 * ✅ ИСПРАВЛЕНО: использует безопасное получение соседей
 */
export function findCycles(adjacency: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    // Если узел уже в стеке рекурсии - найден цикл
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }

    // Если узел уже посещен - пропускаем
    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СОСЕДЕЙ
    const neighbors = getNeighborsSafe(adjacency, node);
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    recursionStack.delete(node);
    path.pop();
  }

  for (const node of Object.keys(adjacency)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Вычисляет максимальную глубину графа
 * ✅ ИСПРАВЛЕНО: обрабатывает узлы без соседей
 */
export function getMaxDepth(adjacency: Record<string, string[]>): number {
  let maxDepth = 0;
  const visited = new Set<string>();

  function dfs(node: string, depth: number) {
    if (visited.has(node)) return;
    visited.add(node);
    maxDepth = Math.max(maxDepth, depth);

    // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СОСЕДЕЙ
    const neighbors = getNeighborsSafe(adjacency, node);
    for (const neighbor of neighbors) {
      dfs(neighbor, depth + 1);
    }
  }

  // Обходим все узлы графа
  for (const node of Object.keys(adjacency)) {
    if (!visited.has(node)) {
      dfs(node, 0);
    }
  }

  return maxDepth;
}

/**
 * Группирует модули по уровням (BFS от корня)
 * ✅ ИСПРАВЛЕНО: использует безопасное получение соседей
 * ✅ ИСПРАВЛЕНО: защита от undefined в adjacency
 */
export function getModulesByLevel(
  rootKey: string,
  adjacency: Record<string, string[]>
): Record<number, string[]> {
  const levels: Record<number, string[]> = {};
  const visited = new Set<string>();
  const queue: { node: string; level: number }[] = [{ node: rootKey, level: 0 }];

  // ✅ Защита: если rootKey нет в adjacency, возвращаем пустой результат
  if (!adjacency || typeof adjacency !== 'object' || !adjacency[rootKey]) {
    return levels;
  }

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;

    if (visited.has(node)) continue;
    visited.add(node);

    if (!levels[level]) {
      levels[level] = [];
    }
    levels[level].push(node);

    // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СОСЕДЕЙ
    const neighbors = getNeighborsSafe(adjacency, node);
    if (Array.isArray(neighbors)) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ node: neighbor, level: level + 1 });
        }
      }
    }
  }

  return levels;
}

/**
 * Проверяет, есть ли циклы в графе
 */
export function hasCycles(adjacency: Record<string, string[]>): boolean {
  const cycles = findCycles(adjacency);
  return cycles.length > 0;
}

/**
 * Находит все пути между двумя узлами (ограниченная глубина)
 * ✅ ИСПРАВЛЕНО: использует безопасное получение соседей
 */
export function findAllPaths(
  adjacency: Record<string, string[]>,
  from: string,
  to: string,
  maxDepth: number = 10
): string[][] {
  const paths: string[][] = [];
  const visited = new Set<string>();

  function dfs(current: string, path: string[], depth: number) {
    if (depth > maxDepth) return;
    if (visited.has(current)) return;
    if (path.includes(current)) return; // предотвращаем циклы

    const newPath = [...path, current];

    if (current === to) {
      paths.push(newPath);
      return;
    }

    visited.add(current);

    // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СОСЕДЕЙ
    const neighbors = getNeighborsSafe(adjacency, current);
    for (const neighbor of neighbors) {
      dfs(neighbor, newPath, depth + 1);
    }

    visited.delete(current);
  }

  dfs(from, [], 0);
  return paths;
}

/**
 * Находит кратчайший путь между двумя узлами (BFS)
 * ✅ ИСПРАВЛЕНО: использует безопасное получение соседей
 */
export function findShortestPath(
  adjacency: Record<string, string[]>,
  from: string,
  to: string
): string[] | null {
  if (from === to) return [from];

  const visited = new Set<string>();
  const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (visited.has(node)) continue;
    visited.add(node);

    // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СОСЕДЕЙ
    const neighbors = getNeighborsSafe(adjacency, node);
    for (const neighbor of neighbors) {
      if (neighbor === to) {
        return [...path, neighbor];
      }
      if (!visited.has(neighbor)) {
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return null;
}

/**
 * Находит все достижимые узлы из указанного
 * ✅ ИСПРАВЛЕНО: использует безопасное получение соседей
 */
export function findReachableNodes(adjacency: Record<string, string[]>, start: string): string[] {
  const reachable = new Set<string>();
  const queue: string[] = [start];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (reachable.has(node)) continue;
    reachable.add(node);

    // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ СОСЕДЕЙ
    const neighbors = getNeighborsSafe(adjacency, node);
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return Array.from(reachable);
}

/**
 * Находит strongly connected components (SCC) в графе
 * Алгоритм Тарьяна
 * ✅ ИСПРАВЛЕНО: добавлены проверки на undefined для lowlink
 */
export function findSCC(adjacency: Record<string, string[]>): string[][] {
  const sccs: string[][] = [];
  const index: Record<string, number> = {};
  const lowlink: Record<string, number> = {};
  const onStack = new Set<string>();
  const stack: string[] = [];
  let nextIndex = 0;

  function strongConnect(node: string) {
    index[node] = nextIndex;
    lowlink[node] = nextIndex;
    nextIndex++;
    stack.push(node);
    onStack.add(node);

    const neighbors = getNeighborsSafe(adjacency, node);
    for (const neighbor of neighbors) {
      if (index[neighbor] === undefined) {
        strongConnect(neighbor);
        // ✅ ИСПРАВЛЕНО: проверка на undefined перед Math.min
        const lowlinkNode = lowlink[node];
        const lowlinkNeighbor = lowlink[neighbor];
        if (lowlinkNode !== undefined && lowlinkNeighbor !== undefined) {
          lowlink[node] = Math.min(lowlinkNode, lowlinkNeighbor);
        } else if (lowlinkNeighbor !== undefined) {
          lowlink[node] = lowlinkNeighbor;
        }
      } else if (onStack.has(neighbor)) {
        // ✅ ИСПРАВЛЕНО: проверка на undefined перед Math.min
        const lowlinkNode = lowlink[node];
        const indexNeighbor = index[neighbor];
        if (lowlinkNode !== undefined && indexNeighbor !== undefined) {
          lowlink[node] = Math.min(lowlinkNode, indexNeighbor);
        } else if (indexNeighbor !== undefined) {
          lowlink[node] = indexNeighbor;
        }
      }
    }

    // ✅ ИСПРАВЛЕНО: проверка на undefined перед сравнением
    const lowlinkNode = lowlink[node];
    const indexNode = index[node];
    if (lowlinkNode !== undefined && indexNode !== undefined && lowlinkNode === indexNode) {
      const scc: string[] = [];
      let w: string | undefined;
      do {
        w = stack.pop();
        if (w) {
          onStack.delete(w);
          scc.push(w);
        }
      } while (w !== node);
      if (scc.length > 0) {
        sccs.push(scc);
      }
    }
  }

  for (const node of Object.keys(adjacency)) {
    if (index[node] === undefined) {
      strongConnect(node);
    }
  }

  return sccs;
}

/**
 * ✅ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: безопасное получение соседей
 * ✅ ИСПРАВЛЕНО: полная защита от undefined и не-массивов
 * Гарантирует, что всегда возвращается массив (даже если ключ отсутствует)
 */
function getNeighborsSafe(adjacency: Record<string, string[]>, node: string): string[] {
  // ✅ Проверяем, что adjacency существует и является объектом
  if (!adjacency || typeof adjacency !== 'object') {
    return [];
  }

  // ✅ Проверяем, что node существует
  if (!node) {
    return [];
  }

  // ✅ Получаем соседей
  const neighbors = adjacency[node];

  // ✅ Если neighbors не существует - возвращаем пустой массив
  if (!neighbors) {
    return [];
  }

  // ✅ Если neighbors уже массив - возвращаем его
  if (Array.isArray(neighbors)) {
    return neighbors;
  }

  // ✅ Если neighbors - объект, пытаемся преобразовать в массив строк
  if (typeof neighbors === 'object' && neighbors !== null) {
    try {
      const values = Object.values(neighbors);
      if (Array.isArray(values) && values.every(v => typeof v === 'string')) {
        return values as string[];
      }
    } catch {
      // Игнорируем ошибки преобразования
    }
  }

  // ✅ В любом другом случае возвращаем пустой массив
  return [];
}

/**
 * Проверяет, является ли граф ациклическим
 */
export function isAcyclic(adjacency: Record<string, string[]>): boolean {
  return !hasCycles(adjacency);
}

/**
 * Получает топологическую сортировку графа (если он ациклический)
 */
export function topologicalSort(adjacency: Record<string, string[]>): string[] | null {
  if (hasCycles(adjacency)) {
    return null;
  }

  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(node: string) {
    if (visited.has(node)) return;
    visited.add(node);

    const neighbors = getNeighborsSafe(adjacency, node);
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
    result.unshift(node);
  }

  for (const node of Object.keys(adjacency)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return result;
}

/**
 * Вычисляет степень узла (количество входящих и исходящих ребер)
 * ✅ ИСПРАВЛЕНО: удалена неиспользуемая переменная 'key'
 */
export function getNodeDegree(
  adjacency: Record<string, string[]>,
  node: string
): { in: number; out: number } {
  const out = getNeighborsSafe(adjacency, node).length;
  let inCount = 0;

  // ✅ ИСПРАВЛЕНО: используем '_' для неиспользуемой переменной
  for (const [, neighbors] of Object.entries(adjacency)) {
    if (Array.isArray(neighbors) && neighbors.includes(node)) {
      inCount++;
    }
  }

  return { in: inCount, out };
}

/**
 * Находит узлы с наибольшей степенью (хабы)
 */
export function findHubs(
  adjacency: Record<string, string[]>,
  limit: number = 10
): { node: string; degree: number }[] {
  const degrees: { node: string; degree: number }[] = [];

  for (const node of Object.keys(adjacency)) {
    const { in: inCount, out: outCount } = getNodeDegree(adjacency, node);
    degrees.push({ node, degree: inCount + outCount });
  }

  degrees.sort((a, b) => b.degree - a.degree);
  return degrees.slice(0, limit);
}

/**
 * Находит изолированные узлы (без входящих и исходящих ребер)
 */
export function findIsolatedNodes(adjacency: Record<string, string[]>): string[] {
  const isolated: string[] = [];

  for (const node of Object.keys(adjacency)) {
    const { in: inCount, out: outCount } = getNodeDegree(adjacency, node);
    if (inCount === 0 && outCount === 0) {
      isolated.push(node);
    }
  }

  return isolated;
}

/**
 * Вычисляет плотность графа (отношение ребер к максимально возможному количеству)
 */
export function getGraphDensity(adjacency: Record<string, string[]>): number {
  const nodes = Object.keys(adjacency).length;
  if (nodes <= 1) return 0;

  let edges = 0;
  for (const neighbors of Object.values(adjacency)) {
    if (Array.isArray(neighbors)) {
      edges += neighbors.length;
    }
  }

  const maxEdges = nodes * (nodes - 1);
  return maxEdges > 0 ? edges / maxEdges : 0;
}

/**
 * Проверяет, связан ли граф (все узлы достижимы из корня)
 */
export function isConnected(adjacency: Record<string, string[]>, rootKey: string): boolean {
  const reachable = findReachableNodes(adjacency, rootKey);
  return reachable.length === Object.keys(adjacency).length;
}

/**
 * Находит компоненты связности в графе
 */
export function findConnectedComponents(adjacency: Record<string, string[]>): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of Object.keys(adjacency)) {
    if (visited.has(node)) continue;

    const component: string[] = [];
    const queue: string[] = [node];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);

      const neighbors = getNeighborsSafe(adjacency, current);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    if (component.length > 0) {
      components.push(component);
    }
  }

  return components;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
  hasCycles,
  findAllPaths,
  findShortestPath,
  findReachableNodes,
  findSCC,
  isAcyclic,
  topologicalSort,
  getNodeDegree,
  findHubs,
  findIsolatedNodes,
  getGraphDensity,
  isConnected,
  findConnectedComponents,
};
