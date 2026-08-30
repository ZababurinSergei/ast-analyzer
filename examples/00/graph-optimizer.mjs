// graph-optimizer.mjs
import context from './report.json' with { type: 'json' };

/**
 * GraphOptimizer - оптимизирует граф вызовов для быстрого поиска путей
 * Поддерживает:
 * - Предварительное построение индексов
 * - Поиск параллельных путей
 * - Нахождение кратчайшего пути
 * - Нахождение самого длинного пути
 * - Поиск путей через определенную функцию
 * - Поиск хабов (узлов с высокой степенью)
 * - Поиск сильно связанных компонентов (SCC)
 */
export class GraphOptimizer {
  constructor(data) {
    this.data = data;
    this.functionMap = new Map();
    this.callGraph = new Map();
    this.reverseGraph = new Map();
    this.functionIndex = new Map();
    this.functionIdByName = new Map(); // Имя -> ID (с учетом возможных дубликатов)

    this._buildIndices();
    this._buildAllPathsCache();
  }

  /**
   * Построение всех необходимых индексов
   */
  _buildIndices() {
    // Строим карту функций по ID
    for (const [id, entity] of Object.entries(this.data.entities || {})) {
      if (entity.kind === 'function') {
        this.functionMap.set(id, entity);
        // Сохраняем ID по имени (берем первый попавшийся)
        if (!this.functionIdByName.has(entity.name)) {
          this.functionIdByName.set(entity.name, id);
        }
        this.functionIndex.set(id, entity.name);
      }
    }

    // Строим граф вызовов
    for (const edge of this.data.callGraph?.edges || []) {
      if (!this.callGraph.has(edge.from)) {
        this.callGraph.set(edge.from, new Set());
      }
      this.callGraph.get(edge.from).add(edge.to);

      if (!this.reverseGraph.has(edge.to)) {
        this.reverseGraph.set(edge.to, new Set());
      }
      this.reverseGraph.get(edge.to).add(edge.from);
    }

    // Добавляем функции, у которых нет вызовов
    for (const [id] of this.functionMap) {
      if (!this.callGraph.has(id)) {
        this.callGraph.set(id, new Set());
      }
      if (!this.reverseGraph.has(id)) {
        this.reverseGraph.set(id, new Set());
      }
    }
  }

  /**
   * Кэширование всех путей для быстрого доступа
   */
  _buildAllPathsCache() {
    this.pathsCache = new Map();
    this.shortestPathsCache = new Map();
    this.longestPathsCache = new Map();
    this.parallelPathsCache = new Map();
    this.allReachableCache = new Map();

    const functionIds = Array.from(this.functionMap.keys());

    // Предварительно вычисляем все пути между всеми парами функций
    for (let i = 0; i < functionIds.length; i++) {
      // Для каждой функции вычисляем все достижимые вершины
      const reachable = this._computeReachable(functionIds[i]);
      this.allReachableCache.set(functionIds[i], reachable);

      for (let j = 0; j < functionIds.length; j++) {
        if (i === j) {continue;}
        const from = functionIds[i];
        const to = functionIds[j];
        const cacheKey = `${from}->${to}`;

        // Находим все пути
        const allPaths = this._findAllPaths(from, to);
        this.pathsCache.set(cacheKey, allPaths);

        // Находим кратчайший путь
        this.shortestPathsCache.set(cacheKey, this._findShortestPath(allPaths));

        // Находим самый длинный путь
        this.longestPathsCache.set(cacheKey, this._findLongestPath(allPaths));

        // Находим параллельные пути
        this.parallelPathsCache.set(cacheKey, this._findParallelPaths(allPaths));
      }
    }
  }

  /**
   * Вычисление всех достижимых вершин из данной
   */
  _computeReachable(from) {
    const visited = new Set();
    const queue = [from];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) {continue;}
      visited.add(current);

      const callees = this.callGraph.get(current) || new Set();
      for (const callee of callees) {
        if (!visited.has(callee)) {
          queue.push(callee);
        }
      }
    }

    return visited;
  }

  /**
   * Поиск всех путей между двумя функциями (BFS)
   */
  _findAllPaths(from, to, maxDepth = 100) {
    const results = [];
    const queue = [[from]];
    const visitedPaths = new Set();

    while (queue.length > 0) {
      const path = queue.shift();
      const last = path[path.length - 1];

      if (path.length > maxDepth) {continue;}

      if (last === to) {
        const pathKey = path.join('->');
        if (!visitedPaths.has(pathKey)) {
          results.push(path);
          visitedPaths.add(pathKey);
        }
        continue;
      }

      const neighbors = this.callGraph.get(last) || new Set();
      for (const neighbor of neighbors) {
        if (!path.includes(neighbor)) {
          const newPath = [...path, neighbor];
          queue.push(newPath);
        }
      }
    }

    return results;
  }

  /**
   * Находит кратчайший путь
   */
  _findShortestPath(allPaths) {
    if (!allPaths || allPaths.length === 0) {return null;}
    return allPaths.reduce((a, b) => (a.length < b.length ? a : b));
  }

  /**
   * Находит самый длинный путь
   */
  _findLongestPath(allPaths) {
    if (!allPaths || allPaths.length === 0) {return null;}
    return allPaths.reduce((a, b) => (a.length > b.length ? a : b));
  }

  /**
   * Находит параллельные пути (пути, у которых общие только начало и конец)
   */
  _findParallelPaths(allPaths) {
    if (!allPaths || allPaths.length < 2) {return [];}

    const parallel = [];

    for (let i = 0; i < allPaths.length; i++) {
      for (let j = i + 1; j < allPaths.length; j++) {
        const path1 = allPaths[i];
        const path2 = allPaths[j];

        // Проверяем, что пути имеют только общее начало и конец
        const middle1 = path1.slice(1, -1);
        const middle2 = path2.slice(1, -1);

        const intersection = middle1.filter(id => middle2.includes(id));

        if (
          intersection.length === 0 &&
          path1[0] === path2[0] &&
          path1[path1.length - 1] === path2[path2.length - 1]
        ) {
          parallel.push([path1, path2]);
        }
      }
    }

    return parallel;
  }

  /**
   * Получение всех путей между функциями (из кэша)
   */
  getAllPaths(fromId, toId) {
    const cacheKey = `${fromId}->${toId}`;
    return this.pathsCache.get(cacheKey) || [];
  }

  /**
   * Получение кратчайшего пути
   */
  getShortestPath(fromId, toId) {
    const cacheKey = `${fromId}->${toId}`;
    return this.shortestPathsCache.get(cacheKey) || null;
  }

  /**
   * Получение самого длинного пути
   */
  getLongestPath(fromId, toId) {
    const cacheKey = `${fromId}->${toId}`;
    return this.longestPathsCache.get(cacheKey) || null;
  }

  /**
   * Получение параллельных путей
   */
  getParallelPaths(fromId, toId) {
    const cacheKey = `${fromId}->${toId}`;
    return this.parallelPathsCache.get(cacheKey) || [];
  }

  /**
   * Поиск путей через определенную функцию
   */
  findPathsThrough(originalFrom, originalTo, throughFunction) {
    const throughId = this.functionIdByName.get(throughFunction);
    if (!throughId) {return [];}

    const pathsToThrough = this.getAllPaths(originalFrom, throughId);
    const pathsFromThrough = this.getAllPaths(throughId, originalTo);

    const results = [];
    for (const path1 of pathsToThrough) {
      for (const path2 of pathsFromThrough) {
        // Объединяем пути, удаляя дубликат через-функции
        const combined = [...path1.slice(0, -1), ...path2];
        results.push(combined);
      }
    }

    return results;
  }

  /**
   * Выбор лучшего пути между параллельными
   */
  selectBestParallelPath(fromId, toId, preferredFunctions = []) {
    const parallelPaths = this.getParallelPaths(fromId, toId);

    if (parallelPaths.length === 0) {
      return this.getShortestPath(fromId, toId);
    }

    const scored = parallelPaths.map(([path1, path2]) => {
      const score1 = this._scorePath(path1, preferredFunctions);
      const score2 = this._scorePath(path2, preferredFunctions);

      return {
        paths: [path1, path2],
        bestPath: score1 >= score2 ? path1 : path2,
        bestScore: Math.max(score1, score2),
        scores: [score1, score2],
      };
    });

    scored.sort((a, b) => b.bestScore - a.bestScore);
    return scored[0]?.bestPath || null;
  }

  /**
   * Оценка пути на основе предпочтительных функций
   */
  _scorePath(path, preferredFunctions) {
    if (!path) {return 0;}

    let score = 0;
    for (const id of path) {
      const entity = this.functionMap.get(id);
      if (entity && preferredFunctions.includes(entity.name)) {
        score += 10;
      }
      score += Math.max(0, 100 - path.length * 2);
    }
    return score;
  }

  /**
   * Получение информации о функции по ID
   */
  getFunctionInfo(id) {
    return this.functionMap.get(id) || null;
  }

  /**
   * Получение функции по имени
   */
  getFunctionByName(name) {
    const id = this.functionIdByName.get(name);
    return id ? this.functionMap.get(id) : null;
  }

  /**
   * Поиск callers для функции
   */
  getCallers(id) {
    return this.reverseGraph.get(id) || new Set();
  }

  /**
   * Поиск callees для функции
   */
  getCallees(id) {
    return this.callGraph.get(id) || new Set();
  }

  /**
   * Получение всех функций, достижимых из данной
   */
  getReachableFrom(id) {
    return this.allReachableCache.get(id) || new Set();
  }

  /**
   * Находит самый длинный путь в графе между любыми двумя функциями
   */
  findLongestPathInGraph() {
    let longestPath = null;
    let maxLength = 0;
    let fromId = null;
    let toId = null;

    for (const [key, path] of this.longestPathsCache) {
      if (path && path.length > maxLength) {
        maxLength = path.length;
        longestPath = path;
        const [from, to] = key.split('->');
        fromId = from;
        toId = to;
      }
    }

    return {
      from: fromId,
      to: toId,
      path: longestPath,
      length: maxLength,
    };
  }

  /**
   * Находит все пути, которые проходят через заданное количество узлов
   */
  findPathsWithMinLength(minLength) {
    const results = [];
    for (const [key, path] of this.longestPathsCache) {
      if (path && path.length >= minLength) {
        const [from, to] = key.split('->');
        results.push({
          from,
          to,
          path,
          length: path.length,
        });
      }
    }
    return results.sort((a, b) => b.length - a.length);
  }

  /**
   * Находит узлы с наибольшей степенью в графе
   */
  findHubs(limit = 10) {
    const degrees = [];
    for (const [id] of this.functionMap) {
      const outDegree = (this.callGraph.get(id) || new Set()).size;
      const inDegree = (this.reverseGraph.get(id) || new Set()).size;
      degrees.push({
        id,
        name: this.functionIndex.get(id) || id,
        outDegree,
        inDegree,
        totalDegree: outDegree + inDegree,
      });
    }
    degrees.sort((a, b) => b.totalDegree - a.totalDegree);
    return degrees.slice(0, limit);
  }

  /**
   * Находит сильно связанные компоненты (SCC) с помощью алгоритма Тарьяна
   */
  findSCCs() {
    const visited = new Set();
    const stack = [];
    const sccs = [];

    const dfs = node => {
      visited.add(node);
      const neighbors = this.callGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      stack.push(node);
    };

    // Первый проход DFS
    for (const [id] of this.functionMap) {
      if (!visited.has(id)) {
        dfs(id);
      }
    }

    // Второй проход на транспонированном графе
    const transposed = new Map();
    for (const [from, toSet] of this.callGraph) {
      for (const to of toSet) {
        if (!transposed.has(to)) {
          transposed.set(to, new Set());
        }
        transposed.get(to).add(from);
      }
    }

    visited.clear();
    const scc = [];

    const dfs2 = node => {
      visited.add(node);
      scc.push(node);
      const neighbors = transposed.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs2(neighbor);
        }
      }
    };

    while (stack.length > 0) {
      const node = stack.pop();
      if (!visited.has(node)) {
        scc.length = 0;
        dfs2(node);
        if (scc.length > 1) {
          sccs.push([...scc]);
        }
      }
    }

    return sccs;
  }

  /**
   * Находит все циклы в графе
   */
  findCycles() {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    const dfs = node => {
      if (recursionStack.has(node)) {
        // Нашли цикл
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        }
        return;
      }

      if (visited.has(node)) {return;}

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = this.callGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const [id] of this.functionMap) {
      if (!visited.has(id)) {
        dfs(id);
      }
    }

    // Удаляем дубликаты циклов
    const uniqueCycles = [];
    const cycleSet = new Set();
    for (const cycle of cycles) {
      const key = cycle.sort().join('->');
      if (!cycleSet.has(key)) {
        cycleSet.add(key);
        uniqueCycles.push(cycle);
      }
    }

    return uniqueCycles;
  }

  /**
   * Находит топологический порядок вершин (если граф ациклический)
   */
  topologicalSort() {
    const inDegree = new Map();
    const queue = [];
    const result = [];

    // Инициализация степеней входа
    for (const [id] of this.functionMap) {
      inDegree.set(id, (this.reverseGraph.get(id) || new Set()).size);
    }

    // Находим вершины с нулевой степенью входа
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node);

      const neighbors = this.callGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Если остались вершины, значит граф циклический
    if (result.length < this.functionMap.size) {
      return null; // Граф не является DAG
    }

    return result;
  }

  /**
   * Находит все пути между функциями с ограничением по длине
   */
  findPathsWithMaxLength(fromId, toId, maxLength) {
    const allPaths = this.getAllPaths(fromId, toId);
    return allPaths.filter(path => path.length <= maxLength);
  }

  /**
   * Находит пути, которые проходят через определенный набор функций
   */
  findPathsThroughFunctions(fromId, toId, requiredFunctions) {
    const requiredIds = requiredFunctions
      .map(name => this.functionIdByName.get(name))
      .filter(id => id !== undefined);

    if (requiredIds.length === 0) {return [];}

    const allPaths = this.getAllPaths(fromId, toId);
    const results = [];

    for (const path of allPaths) {
      const pathSet = new Set(path);
      const containsAll = requiredIds.every(id => pathSet.has(id));
      if (containsAll) {
        results.push(path);
      }
    }

    return results;
  }

  /**
   * Экспорт графа в формате DOT для визуализации
   */
  exportToDOT(limit = 50) {
    let dot = 'digraph CallGraph {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=filled, fillcolor=lightblue];\n';

    const count = 0;
    const nodes = Array.from(this.functionMap.keys()).slice(0, limit);
    const nodeSet = new Set(nodes);

    for (const id of nodes) {
      const entity = this.getFunctionInfo(id);
      const name = entity?.name || id;
      dot += `  "${id}" [label="${name}"];\n`;
    }

    for (const id of nodes) {
      const neighbors = this.callGraph.get(id) || new Set();
      for (const neighbor of neighbors) {
        if (nodeSet.has(neighbor)) {
          dot += `  "${id}" -> "${neighbor}";\n`;
        }
      }
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Получение статистики графа
   */
  getGraphStats() {
    let totalEdges = 0;
    let maxOutDegree = 0;
    let maxInDegree = 0;
    let isolatedCount = 0;
    let totalReachable = 0;

    for (const [id, edges] of this.callGraph) {
      const outDegree = edges.size;
      const inDegree = (this.reverseGraph.get(id) || new Set()).size;
      totalEdges += outDegree;
      if (outDegree > maxOutDegree) {maxOutDegree = outDegree;}
      if (inDegree > maxInDegree) {maxInDegree = inDegree;}
      if (outDegree === 0 && inDegree === 0) {isolatedCount++;}

      const reachable = this.getReachableFrom(id);
      totalReachable += reachable.size;
    }

    return {
      totalFunctions: this.functionMap.size,
      totalEdges,
      averageDegree: totalEdges / this.functionMap.size,
      maxOutDegree,
      maxInDegree,
      isolatedCount,
      averageReachable: totalReachable / this.functionMap.size,
      density: totalEdges / (this.functionMap.size * (this.functionMap.size - 1)),
    };
  }
}

// Создаем экземпляр оптимизатора
const optimizer = new GraphOptimizer(context);

// Экспортируем оптимизатор
export { optimizer };
