// src/reporters/json/graphs/find-path.ts
// ============================================================
// ПОИСК ПУТИ МЕЖДУ ФУНКЦИЯМИ В ГРАФЕ ВЫЗОВОВ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Модуль предоставляет функцию `findFunctionPath`, которая
// выполняет BFS-поиск пути между двумя функциями в графе вызовов
// проекта. Используется в команде `project --from X --to Y`
// (см. `modes/project-graph.ts`).
//
// РАНЬШЕ эта логика была встроена в `modes/project-graph.ts`
// (функция `findPathBetweenFunctions`). Теперь она вынесена
// в отдельный модуль `reporters/json/graphs/`, чтобы:
//   - устранить дублирование
//   - использовать единый источник истины для анализа
//   - упростить CLI-команды
//
// ИСТОЧНИКИ ДАННЫХ
// ------------------------------------------------------------
// Функция работает с `packageLockReport` (или `EnhancedPackageLockReport`),
// который содержит поле `callGraph`:
//
//   callGraph = {
//     nodes: string[],                        // имена функций
//     edges: [number, number, number, ...][], // [fromIdx, toIdx, line, ...]
//     ...
//   }
//
// Если у вас есть `FullJSON` (из codec) — используйте поле `calls`:
//
//   FullJSON.calls = [
//     { id, fromFunctionId, toFunctionId, line, type },
//     ...
//   ]
//
// Модуль поддерживает оба формата.
//
// ИЗМЕНЕНИЯ v1.0.0
//   - Базовая реализация BFS
//   - Поддержка `packageLockReport.callGraph`
//   - Поддержка `FullJSON.calls` (альтернативный формат)
//   - Поддержка внешних вызовов (`external:xxx`)
// ============================================================

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Результат поиска пути между двумя функциями.
 */
export interface CallGraphPathResult {
  /** Найден ли путь */
  found: boolean;
  /** Путь (массив имён функций) */
  path?: string[];
  /** Причина, если путь не найден */
  reason?: string;
  /** Узлы пути с метаданными */
  nodes?: CallGraphPathNode[];
  /** Рёбра пути */
  edges?: CallGraphPathEdge[];
}

/**
 * Узел пути между функциями.
 */
export interface CallGraphPathNode {
  /** Имя функции */
  function: string;
  /** Путь к модулю (файлу) */
  module: string;
  /** Номер строки объявления */
  line: number;
  /** Асинхронная ли функция */
  isAsync: boolean;
}

/**
 * Ребро пути между функциями.
 */
export interface CallGraphPathEdge {
  /** Откуда */
  from: string;
  /** Куда */
  to: string;
  /** Номер строки вызова */
  line: number;
}

/**
 * Внутренний формат графа вызовов для BFS.
 *
 * Ключ — ID функции (или имя функции), значение — массив ID/имён
 * вызываемых функций.
 */
type AdjacencyList = Record<string, string[]>;

/**
 * Внутренний формат узла графа вызовов.
 */
interface CallGraphNodeInfo {
  /** Имя функции */
  name: string;
  /** Путь к модулю */
  module: string;
  /** Номер строки */
  line: number;
  /** Async */
  isAsync: boolean;
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Находит путь между двумя функциями в графе вызовов.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Извлекаем граф вызовов из `packageLockReport`:
 *      - Поддерживается формат `callGraph` (nodes + edges)
 *      - Поддерживается формат `calls` (FullJSON)
 *   2. Строим список смежности (AdjacencyList).
 *   3. Запускаем BFS от `fromFunction` до `toFunction`.
 *   4. Восстанавливаем путь.
 *
 * ════════════════════════════════════════════════════════════
 * ОСОБЕННОСТИ
 * ════════════════════════════════════════════════════════════
 *
 *   - **BFS**, а не DFS: гарантирует кратчайший путь.
 *   - **Защита от циклов**: `visited` Set.
 *   - **Защита от отсутствия from/to**: возвращает `{ found: false }`
 *     с понятным `reason`.
 *   - **Поддержка external-вызовов**: если `toFunctionId` начинается
 *     с `external:`, узел создаётся как `external:xxx`.
 *   - **Поддержка обоих форматов**: `callGraph` (EnhancedPackageLockReport)
 *     и `calls` (FullJSON).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // 1. Простой путь
 *   const result = findFunctionPath(report, 'main', 'readFile');
 *   if (result.found) {
 *     console.log(result.path);  // ['main', 'loadConfig', 'readFile']
 *   }
 *
 *   // 2. Путь не найден
 *   const result = findFunctionPath(report, 'main', 'unusedHelper');
 *   console.log(result.reason);  // "No path found from 'main' to 'unusedHelper'"
 *
 *   // 3. Функция отсутствует в графе
 *   const result = findFunctionPath(report, 'unknownFunc', 'main');
 *   console.log(result.reason);  // "Function 'unknownFunc' not found in call graph"
 *
 * @param packageLockReport — отчёт с полем `callGraph` или `calls`
 * @param fromFunction      — имя начальной функции
 * @param toFunction        — имя конечной функции
 * @returns Результат поиска пути
 */
export function findFunctionPath(
  packageLockReport: any,
  fromFunction: string,
  toFunction: string
): CallGraphPathResult {
  // ============================================================
  // 1. Валидация входных данных
  // ============================================================
  if (!packageLockReport) {
    return {
      found: false,
      reason: 'packageLockReport is null or undefined',
    };
  }

  if (!fromFunction || typeof fromFunction !== 'string') {
    return {
      found: false,
      reason: 'Invalid fromFunction: must be a non-empty string',
    };
  }

  if (!toFunction || typeof toFunction !== 'string') {
    return {
      found: false,
      reason: 'Invalid toFunction: must be a non-empty string',
    };
  }

  if (fromFunction === toFunction) {
    return {
      found: true,
      path: [fromFunction],
      nodes: [{ function: fromFunction, module: 'unknown', line: 0, isAsync: false }],
      edges: [],
    };
  }

  // ============================================================
  // 2. Извлечение графа вызовов
  // ============================================================
  const { adjacency, nodeInfo, hasFrom, hasTo } = extractCallGraph(
    packageLockReport,
    fromFunction,
    toFunction
  );

  if (!hasFrom) {
    return {
      found: false,
      reason: `Function '${fromFunction}' not found in call graph`,
    };
  }

  if (!hasTo) {
    return {
      found: false,
      reason: `Function '${toFunction}' not found in call graph`,
    };
  }

  // ============================================================
  // 3. BFS
  // ============================================================
  const bfsResult = bfs(adjacency, fromFunction, toFunction);

  if (!bfsResult) {
    return {
      found: false,
      reason: `No path found from '${fromFunction}' to '${toFunction}'`,
    };
  }

  // ============================================================
  // 4. Формирование результата
  // ============================================================
  const { path, edges } = bfsResult;

  const nodes: CallGraphPathNode[] = path.map(name => {
    const info = nodeInfo[name];
    return {
      function: name,
      module: info?.module || 'unknown',
      line: info?.line || 0,
      isAsync: info?.isAsync || false,
    };
  });

  return {
    found: true,
    path,
    nodes,
    edges,
  };
}

// ============================================================
// ВНУТРЕННИЕ ФУНКЦИИ
// ============================================================

/**
 * Извлекает граф вызовов из `packageLockReport`.
 *
 * Поддерживает два формата:
 *
 * 1. **`callGraph`** (EnhancedPackageLockReport, старый):
 *    ```typescript
 *    callGraph = {
 *      nodes: string[],
 *      edges: [fromIdx, toIdx, line, ...][],
 *    }
 *    ```
 *
 * 2. **`calls`** (FullJSON, новый):
 *    ```typescript
 *    calls = [
 *      { id, fromFunctionId, toFunctionId, line, type },
 *    ]
 *    ```
 *
 * Возвращает:
 *   - `adjacency` — список смежности
 *   - `nodeInfo`  — метаданные узлов (module, line, isAsync)
 *   - `hasFrom`   — существует ли `fromFunction`
 *   - `hasTo`     — существует ли `toFunction`
 */
function extractCallGraph(
  report: any,
  fromFunction: string,
  toFunction: string
): {
  adjacency: AdjacencyList;
  nodeInfo: Record<string, CallGraphNodeInfo>;
  hasFrom: boolean;
  hasTo: boolean;
} {
  const adjacency: AdjacencyList = {};
  const nodeInfo: Record<string, CallGraphNodeInfo> = {};

  // ------------------------------------------------------------
  // Формат 1: callGraph (nodes + edges)
  // ------------------------------------------------------------
  if (report.callGraph && Array.isArray(report.callGraph.nodes)) {
    const nodes: string[] = report.callGraph.nodes;
    const edges: any[] = report.callGraph.edges || [];

    // Заполняем nodeInfo
    for (let i = 0; i < nodes.length; i++) {
      const name = nodes[i];
      if (name !== undefined) {
        nodeInfo[name] = {
          name,
          module: 'unknown',
          line: 0,
          isAsync: false,
        };
      }
    }

    // Заполняем adjacency
    for (const edge of edges) {
      if (!edge || !Array.isArray(edge) || edge.length < 2) continue;

      const fromIdx = edge[0];
      const toIdx = edge[1];
      const line = edge[2] || 0;

      const fromName = nodes[fromIdx];
      const toName = nodes[toIdx];

      if (!fromName || !toName) continue;

      if (!adjacency[fromName]) adjacency[fromName] = [];
      adjacency[fromName].push(toName);

      // Обновляем метаданные
      if (nodeInfo[fromName]) {
        nodeInfo[fromName].line = nodeInfo[fromName].line || line;
      }
      if (nodeInfo[toName]) {
        nodeInfo[toName].line = nodeInfo[toName].line || line;
      }
    }

    return {
      adjacency,
      nodeInfo,
      hasFrom: fromFunction in nodeInfo,
      hasTo: toFunction in nodeInfo,
    };
  }

  // ------------------------------------------------------------
  // Формат 2: calls (FullJSON)
  // ------------------------------------------------------------
  if (Array.isArray(report.calls)) {
    const calls: any[] = report.calls;

    // Строим map functionId → name
    const functionIdToName = new Map<string, string>();
    for (const func of report.functions || []) {
      if (func && func.id && func.name) {
        functionIdToName.set(func.id, func.name);
      }
    }

    // Заполняем adjacency и nodeInfo
    for (const call of calls) {
      if (!call) continue;

      const fromId = call.fromFunctionId;
      const toId = call.toFunctionId;
      const line = call.line || 0;

      const fromName = functionIdToName.get(fromId) || fromId;
      const toName = functionIdToName.get(toId) || toId;

      if (!fromName || !toName) continue;

      if (!adjacency[fromName]) adjacency[fromName] = [];
      adjacency[fromName].push(toName);

      // Заполняем nodeInfo для from
      if (!nodeInfo[fromName]) {
        nodeInfo[fromName] = {
          name: fromName,
          module: 'unknown',
          line,
          isAsync: false,
        };
      }

      // Заполняем nodeInfo для to
      if (!nodeInfo[toName]) {
        nodeInfo[toName] = {
          name: toName,
          module: 'unknown',
          line,
          isAsync: false,
        };
      }
    }

    // Дополняем nodeInfo из report.functions (если есть)
    for (const func of report.functions || []) {
      if (func && func.name && !nodeInfo[func.name]) {
        nodeInfo[func.name] = {
          name: func.name,
          module: func.fileId || 'unknown',
          line: func.line || 0,
          isAsync: func.isAsync || false,
        };
      }
    }

    return {
      adjacency,
      nodeInfo,
      hasFrom: fromFunction in nodeInfo,
      hasTo: toFunction in nodeInfo,
    };
  }

  // ------------------------------------------------------------
  // Формат 3: relationships (optimized report)
  // ------------------------------------------------------------
  if (report.entities && typeof report.entities === 'object') {
    const entities: Record<string, any> = report.entities;

    // --- НАЧАЛО ИЗМЕНЕНИЙ ---
    // 'id' не используется, поэтому заменён на пропуск через запятую
    for (const [, entity] of Object.entries(entities)) {
      // --- КОНЕЦ ИЗМЕНЕНИЙ ---
      if (!entity || !entity.name) continue;

      const name = entity.name;
      nodeInfo[name] = {
        name,
        module: entity.file || 'unknown',
        line: entity.line || 0,
        isAsync: entity.isAsync || false,
      };

      // Инициализируем adjacency
      if (!adjacency[name]) adjacency[name] = [];

      // Добавляем связи calls
      for (const call of entity.calls || []) {
        const targetName = call.targetName || call.to || call;
        if (targetName) {
          adjacency[name].push(targetName);
        }
      }
    }

    return {
      adjacency,
      nodeInfo,
      hasFrom: fromFunction in nodeInfo,
      hasTo: toFunction in nodeInfo,
    };
  }

  // ------------------------------------------------------------
  // Неизвестный формат
  // ------------------------------------------------------------
  return {
    adjacency,
    nodeInfo,
    hasFrom: false,
    hasTo: false,
  };
}

/**
 * BFS-поиск кратчайшего пути между двумя узлами.
 *
 * @param adjacency    — список смежности
 * @param fromFunction — начальный узел
 * @param toFunction   — конечный узел
 * @returns путь и рёбра, или null
 */
function bfs(
  adjacency: AdjacencyList,
  fromFunction: string,
  toFunction: string
): { path: string[]; edges: CallGraphPathEdge[] } | null {
  const visited = new Set<string>();
  const queue: { node: string; path: string[]; edges: CallGraphPathEdge[] }[] = [
    { node: fromFunction, path: [fromFunction], edges: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { node, path, edges } = current;

    if (visited.has(node)) continue;
    visited.add(node);

    // Нашли цель
    if (node === toFunction) {
      return { path, edges };
    }

    // Обходим соседей
    const neighbors = adjacency[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push({
          node: neighbor,
          path: [...path, neighbor],
          edges: [...edges, { from: node, to: neighbor, line: 0 }],
        });
      }
    }
  }

  return null;
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
// ============================================================

/**
 * Находит все кратчайшие пути между двумя функциями.
 *
 * В отличие от `findFunctionPath`, возвращает ВСЕ пути
 * одинаковой (кратчайшей) длины. Полезно для анализа
 * множественных зависимостей.
 *
 * ⚠️ Может быть дорогой на больших графах.
 *
 * @param packageLockReport — отчёт
 * @param fromFunction      — начальная функция
 * @param toFunction        — конечная функция
 * @param maxPaths          — максимальное количество путей (по умолчанию 10)
 * @returns массив путей
 */
export function findAllFunctionPaths(
  packageLockReport: any,
  fromFunction: string,
  toFunction: string,
  maxPaths: number = 10
): CallGraphPathResult[] {
  if (!packageLockReport || !fromFunction || !toFunction) {
    return [];
  }

  const { adjacency, nodeInfo, hasFrom, hasTo } = extractCallGraph(
    packageLockReport,
    fromFunction,
    toFunction
  );

  if (!hasFrom || !hasTo) {
    return [];
  }

  // BFS с сохранением всех путей
  const allPaths: { path: string[]; edges: CallGraphPathEdge[] }[] = [];
  const queue: { node: string; path: string[]; edges: CallGraphPathEdge[] }[] = [
    { node: fromFunction, path: [fromFunction], edges: [] },
  ];

  let shortestLength = Infinity;

  while (queue.length > 0 && allPaths.length < maxPaths) {
    const { node, path, edges } = queue.shift()!;

    // Отсекаем пути длиннее кратчайшего
    if (path.length > shortestLength) continue;

    if (node === toFunction) {
      allPaths.push({ path, edges });
      shortestLength = Math.min(shortestLength, path.length);
      continue;
    }

    // Защита от циклов
    if (path.length > 20) continue;

    const neighbors = adjacency[node] || [];
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        queue.push({
          node: neighbor,
          path: [...path, neighbor],
          edges: [...edges, { from: node, to: neighbor, line: 0 }],
        });
      }
    }
  }

  return allPaths.map(({ path, edges }) => ({
    found: true,
    path,
    nodes: path.map(name => ({
      function: name,
      module: nodeInfo[name]?.module || 'unknown',
      line: nodeInfo[name]?.line || 0,
      isAsync: nodeInfo[name]?.isAsync || false,
    })),
    edges,
  }));
}

/**
 * Проверяет, существует ли путь между двумя функциями.
 *
 * @param packageLockReport — отчёт
 * @param fromFunction      — начальная функция
 * @param toFunction        — конечная функция
 * @returns true, если путь существует
 */
export function hasPath(packageLockReport: any, fromFunction: string, toFunction: string): boolean {
  return findFunctionPath(packageLockReport, fromFunction, toFunction).found;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  findFunctionPath,
  findAllFunctionPaths,
  hasPath,
};
