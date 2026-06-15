// core/graph-utils.ts

/**
 * Находит циклические зависимости в графе
 * @param graph Объект графа, где ключи - узлы, значения - массивы зависимостей
 * @returns Set строк в формате "узел->зависимость", представляющих циклические ребра
 */
export function findCyclicEdges(graph: Record<string, string[]>): Set<string> {
  const visited: Record<string, number> = {};
  const cyclicEdges = new Set<string>();
  const recursionStack = new Set<string>();

  // Инициализация статусов: 0 - не посещен, 1 - в процессе, 2 - обработан
  Object.keys(graph).forEach(node => {
    visited[node] = 0;
  });

  function dfs(node: string, path: string[] = []): void {
    visited[node] = 1; // В процессе обхода
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph[node] || [];

    for (const neighbor of neighbors) {
      if (recursionStack.has(neighbor)) {
        // Найден цикл: отмечаем все ребра в цикле
        const cycleStartIndex = path.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          for (let i = cycleStartIndex; i < path.length; i++) {
            const from = path[i];
            const to = i + 1 < path.length ? path[i + 1] : neighbor;
            cyclicEdges.add(`${from}->${to}`);
          }
        }
        cyclicEdges.add(`${node}->${neighbor}`);
      } else if (visited[neighbor] === 0) {
        dfs(neighbor, [...path]);
      }
    }

    recursionStack.delete(node);
    visited[node] = 2; // Обработан
  }

  // Запускаем DFS для всех непосещенных узлов
  Object.keys(graph).forEach(node => {
    if (visited[node] === 0) dfs(node, []);
  });

  return cyclicEdges;
}

/**
 * Преобразует данные графа в формат DOT для Graphviz
 * @param graphData Объект с rootKey и graph
 * @param cyclicEdges Set циклических ребер для подсветки
 * @returns Строка в формате DOT
 */
export function convertToDOT(
  graphData: { rootKey: string; graph: Record<string, string[]> },
  cyclicEdges: Set<string>
): string {
  const { rootKey, graph } = graphData;

  let dot = 'digraph "Dependency Graph" {\n';
  dot += '  rankdir=LR;\n';
  dot += '  splines=true;\n';
  dot +=
    '  node [shape=box, style="filled,rounded", color="#4f46e5", fontname="Arial", fillcolor="#f3f4f6", fontcolor="#1f2937", penwidth=1];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee, penwidth=1];\n';

  // Корневой узел выделяем звездочкой
  dot += `  "${rootKey}" [fillcolor="#4f46e5", fontcolor="#ffffff", penwidth=2, label="⭐ ${rootKey}"];\n`;

  // Добавляем все ребра
  Object.keys(graph).forEach(node => {
    const nodeDeps = graph[node];
    if (nodeDeps) {
      nodeDeps.forEach(dep => {
        const edgeKey = `${node}->${dep}`;
        if (cyclicEdges.has(edgeKey)) {
          // Подсвечиваем циклические зависимости красным
          dot += `  "${node}" -> "${dep}" [color="#ef4444", penwidth=2.5, style="dashed", label="цикл"];\n`;
        } else {
          dot += `  "${node}" -> "${dep}";\n`;
        }
      });
    }
  });

  dot += '}\n';
  return dot;
}

/**
 * Рекурсивный обход графа в глубину (DFS)
 * @param node Текущий узел
 * @param graph Объект графа
 * @param visited Set посещенных узлов
 * @param callback Функция обратного вызова для каждого узла
 */
export function dfs(
  node: string,
  graph: Record<string, string[]>,
  visited: Set<string>,
  callback: (node: string) => void
): void {
  if (visited.has(node)) return;

  visited.add(node);
  callback(node);

  const neighbors = graph[node] || [];
  for (const neighbor of neighbors) {
    dfs(neighbor, graph, visited, callback);
  }
}
