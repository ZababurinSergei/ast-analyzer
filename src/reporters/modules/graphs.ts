// src/reporters/modules/graphs.ts
// Графы зависимостей

export interface DependencyGraph {
  direction: 'bidirectional';
  inwardDependencies: Record<string, string[]>;
  outwardDependencies: Record<string, string[]>;
}

export function buildDependencyGraph(graph: Record<string, string[]>): DependencyGraph {
  const inwardDeps: Record<string, string[]> = {};
  const outwardDeps: Record<string, string[]> = {};

  // Инициализация структур для всех модулей
  for (const modulePath of Object.keys(graph)) {
    inwardDeps[modulePath] = [];
    outwardDeps[modulePath] = [];
  }

  // Заполнение зависимостей
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

  return {
    direction: 'bidirectional',
    inwardDependencies: inwardDeps,
    outwardDependencies: outwardDeps,
  };
}

/**
 * Проверяет наличие циклических зависимостей в графе
 */
export function findCycles(graphData: Record<string, string[]>): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (node: string): boolean => {
    if (recursionStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);

    const neighbors = graphData[node] || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recursionStack.delete(node);
    return false;
  };

  for (const node of Object.keys(graphData)) {
    if (dfs(node)) return true;
  }
  return false;
}

/**
 * Находит все циклические зависимости в графе
 */
export function findAllCycles(graphData: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string) => {
    if (recursionStack.has(node)) {
      // Найден цикл
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        // Добавляем замыкающее ребро
        const fullCycle = [...cycle, node];
        cycles.push(fullCycle);
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graphData[node] || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    recursionStack.delete(node);
    path.pop();
  };

  for (const node of Object.keys(graphData)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Находит циклические ребра в графе
 */
export function findCyclicEdges(graphData: Record<string, string[]>): Set<string> {
  const cyclicEdges = new Set<string>();
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string) => {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        for (let i = cycleStart; i < path.length; i++) {
          const from = path[i];
          const to = i + 1 < path.length ? path[i + 1] : node;
          if (from && to) {
            cyclicEdges.add(`${from}->${to}`);
          }
        }
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graphData[node] || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    recursionStack.delete(node);
    path.pop();
  };

  for (const node of Object.keys(graphData)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cyclicEdges;
}

/**
 * Вычисляет максимальную глубину графа
 */
export function getMaxDepth(graphData: Record<string, string[]>): number {
  let max = 0;
  const visited = new Set<string>();

  const dfs = (node: string, depth: number) => {
    if (visited.has(node)) return;
    visited.add(node);
    max = Math.max(max, depth);

    const neighbors = graphData[node] || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, depth + 1);
    }
  };

  // Находим корневые узлы (те, на которые никто не ссылается)
  const called = new Set<string>();
  for (const deps of Object.values(graphData)) {
    for (const dep of deps) {
      called.add(dep);
    }
  }

  const roots = Object.keys(graphData).filter((node: string) => !called.has(node));

  // Если корневых узлов нет, значит есть циклы, берем все узлы
  if (roots.length === 0) {
    for (const node of Object.keys(graphData)) {
      if (!visited.has(node)) {
        dfs(node, 0);
      }
    }
  } else {
    for (const root of roots) {
      dfs(root, 0);
    }
  }

  return max;
}

/**
 * Группирует модули по уровням (BFS от корней)
 */
export function getModulesByLevel(outwardDeps: Record<string, string[]>): Record<number, string[]> {
  const modulesByLevel: Record<number, string[]> = {};
  const queue: { node: string; level: number }[] = [];
  const visited = new Set<string>();

  // Находим корневые узлы (те, на которые никто не ссылается)
  const called = new Set<string>();
  for (const deps of Object.values(outwardDeps)) {
    for (const dep of deps) {
      called.add(dep);
    }
  }

  const roots = Object.keys(outwardDeps).filter((node: string) => !called.has(node));

  // Если корневых узлов нет, берем все узлы с уровнем 0
  if (roots.length === 0) {
    for (const node of Object.keys(outwardDeps)) {
      queue.push({ node, level: 0 });
    }
  } else {
    for (const root of roots) {
      queue.push({ node: root, level: 0 });
    }
  }

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);

    if (!modulesByLevel[level]) {
      modulesByLevel[level] = [];
    }
    modulesByLevel[level].push(node);

    const deps = outwardDeps[node] || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        queue.push({ node: dep, level: level + 1 });
      }
    }
  }

  return modulesByLevel;
}

/**
 * Находит путь между двумя узлами в графе (BFS)
 */
export function findPathBetweenNodes(
  graphData: Record<string, string[]>,
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

    const neighbors = graphData[node] || [];
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
 * Находит все пути между двумя узлами (с ограничением глубины)
 */
export function findAllPathsBetweenNodes(
  graphData: Record<string, string[]>,
  from: string,
  to: string,
  maxDepth: number = 10
): string[][] {
  const paths: string[][] = [];

  const dfs = (current: string, path: string[], depth: number) => {
    if (depth > maxDepth) return;
    if (path.includes(current)) return; // Предотвращаем циклы

    const newPath = [...path, current];

    if (current === to) {
      paths.push(newPath);
      return;
    }

    const neighbors = graphData[current] || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, newPath, depth + 1);
    }
  };

  dfs(from, [], 0);
  return paths;
}

/**
 * Находит все узлы, от которых зависит указанный узел (входящие зависимости)
 */
export function findDependents(graphData: Record<string, string[]>, node: string): string[] {
  const dependents: string[] = [];
  const visited = new Set<string>();

  const dfs = (current: string) => {
    if (visited.has(current)) return;
    visited.add(current);

    for (const [caller, deps] of Object.entries(graphData)) {
      if (deps.includes(current) && !visited.has(caller)) {
        dependents.push(caller);
        dfs(caller);
      }
    }
  };

  dfs(node);
  return dependents;
}

/**
 * Находит все узлы, от которых зависит указанный узел (исходящие зависимости)
 */
export function findDependencies(graphData: Record<string, string[]>, node: string): string[] {
  const dependencies: string[] = [];
  const visited = new Set<string>();

  const dfs = (current: string) => {
    if (visited.has(current)) return;
    visited.add(current);

    const deps = graphData[current] || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        dependencies.push(dep);
        dfs(dep);
      }
    }
  };

  dfs(node);
  return dependencies;
}

/**
 * Проверяет, является ли граф ациклическим
 */
export function isAcyclic(graphData: Record<string, string[]>): boolean {
  return !findCycles(graphData);
}

/**
 * Возвращает статистику по графу
 */
export function getGraphStats(graphData: Record<string, string[]>): {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  hasCycles: boolean;
  cyclesCount: number;
  avgDegree: number;
} {
  const totalNodes = Object.keys(graphData).length;
  let totalEdges = 0;
  for (const deps of Object.values(graphData)) {
    totalEdges += deps.length;
  }

  const hasCycles = findCycles(graphData);
  const cycles = findAllCycles(graphData);
  const maxDepth = getMaxDepth(graphData);
  const avgDegree = totalNodes > 0 ? totalEdges / totalNodes : 0;

  return {
    totalNodes,
    totalEdges,
    maxDepth,
    hasCycles,
    cyclesCount: cycles.length,
    avgDegree,
  };
}

/**
 * Экспортирует граф в формате DOT для визуализации
 */
export function exportToDOT(
  graphData: Record<string, string[]>,
  options?: {
    title?: string;
    highlightCycles?: boolean;
    highlightPath?: string[];
  }
): string {
  const title = options?.title || 'Dependency Graph';
  let dot = `digraph "${title}" {\n`;
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

  // Находим циклические ребра для подсветки
  const cyclicEdges = options?.highlightCycles ? findCyclicEdges(graphData) : new Set<string>();
  const pathSet = options?.highlightPath ? new Set(options.highlightPath) : new Set<string>();

  // Добавляем узлы
  for (const node of Object.keys(graphData)) {
    const isInPath = pathSet.has(node);
    const color = isInPath ? '#4f46e5' : '#f3f4f6';
    const fontColor = isInPath ? '#ffffff' : '#1f2937';
    const penwidth = isInPath ? '2.5' : '1';
    dot += `  "${node}" [fillcolor="${color}", fontcolor="${fontColor}", penwidth=${penwidth}];\n`;
  }

  // Добавляем ребра
  for (const [from, deps] of Object.entries(graphData)) {
    for (const to of deps) {
      const edgeKey = `${from}->${to}`;
      const isCycle = cyclicEdges.has(edgeKey);
      const isInPath = pathSet.has(from) && pathSet.has(to);

      const color = isCycle ? '#ef4444' : isInPath ? '#4f46e5' : '#9ca3af';
      const style = isCycle ? 'dashed' : 'solid';
      const penwidth = isCycle ? '2.5' : isInPath ? '2' : '1';
      const label = isCycle ? ' цикл' : '';

      dot += `  "${from}" -> "${to}" [color="${color}", style="${style}", penwidth=${penwidth}, label="${label}"];\n`;
    }
  }

  dot += '}\n';
  return dot;
}

// Экспорт по умолчанию
export default {
  buildDependencyGraph,
  findCycles,
  findAllCycles,
  findCyclicEdges,
  getMaxDepth,
  getModulesByLevel,
  findPathBetweenNodes,
  findAllPathsBetweenNodes,
  findDependents,
  findDependencies,
  isAcyclic,
  getGraphStats,
  exportToDOT,
};
