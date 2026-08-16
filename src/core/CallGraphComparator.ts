// src/formal/core/CallGraphComparator.ts
import type { SourceFile } from 'ts-morph';
import { Node } from 'ts-morph';

export interface CallEdge {
  from: string;
  to: string;
  type: 'direct' | 'method' | 'property' | 'import';
  line?: number;
}

export interface CallGraph {
  nodes: Set<string>;
  edges: CallEdge[];
  entryPoints: string[];
}

export interface CallGraphChange {
  type: 'added_edge' | 'removed_edge' | 'changed';
  from: string;
  to: string;
  original?: string;
  modified?: string;
  line?: number;
}

export interface CallGraphComparisonResult {
  changes: CallGraphChange[];
  isEquivalent: boolean;
  addedEdges: CallGraphChange[];
  removedEdges: CallGraphChange[];
  nodeChanges: {
    added: string[];
    removed: string[];
  };
}

export class CallGraphComparator {
  /**
   * Строит граф вызовов для файла
   */
  buildCallGraph(sourceFile: SourceFile): CallGraph {
    const nodes = new Set<string>();
    const edges: CallEdge[] = [];

    // Собираем все функции
    for (const func of sourceFile.getFunctions()) {
      const name = func.getName();
      if (name) nodes.add(name);
    }

    // Собираем методы классов
    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName();
      if (className) {
        nodes.add(className);
        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          if (methodName) {
            nodes.add(methodName);
          }
        }
      }
    }

    // Собираем стрелочные функции в переменных
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        const name = varDecl.getName();
        nodes.add(name);
      }
    }

    // Анализируем вызовы
    for (const func of sourceFile.getFunctions()) {
      const name = func.getName();
      if (!name) continue;

      this.findCalls(func, name, nodes, edges);
    }

    // Анализируем методы классов
    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName();
      if (!className) continue;

      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        if (!methodName) continue;

        const fullName = `${className}.${methodName}`;
        this.findCalls(method, fullName, nodes, edges);
      }
    }

    // Анализируем стрелочные функции
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        const name = varDecl.getName();
        this.findCalls(initializer, name, nodes, edges);
      }
    }

    // Находим точки входа (функции, которые не вызываются)
    const calledFunctions = new Set(edges.map(e => e.to));
    const entryPoints = Array.from(nodes).filter(name => !calledFunctions.has(name));

    return { nodes, edges, entryPoints };
  }

  /**
   * Находит все вызовы внутри узла
   */
  private findCalls(node: Node, fromName: string, nodes: Set<string>, edges: CallEdge[]): void {
    const visited = new Set<Node>();

    const traverse = (child: Node) => {
      if (visited.has(child)) return;
      visited.add(child);

      // Прямые вызовы функций: func()
      if (Node.isCallExpression(child)) {
        const expr = child.getExpression();
        if (Node.isIdentifier(expr)) {
          const toName = expr.getText();
          if (nodes.has(toName) && toName !== fromName) {
            this.addEdge(edges, {
              from: fromName,
              to: toName,
              type: 'direct',
              line: child.getStartLineNumber(),
            });
          }
        }
      }

      // Вызовы методов: object.method()
      if (Node.isPropertyAccessExpression(child)) {
        const propertyName = child.getName();
        const parent = child.getParent();

        if (propertyName && Node.isCallExpression(parent)) {
          // Проверяем, является ли метод вызовом функции из nodes
          if (nodes.has(propertyName)) {
            this.addEdge(edges, {
              from: fromName,
              to: propertyName,
              type: 'method',
              line: child.getStartLineNumber(),
            });
          }

          // Проверяем вызовы вида Class.method()
          const expression = child.getExpression();
          if (Node.isIdentifier(expression)) {
            const className = expression.getText();
            const fullMethodName = `${className}.${propertyName}`;
            if (nodes.has(fullMethodName)) {
              this.addEdge(edges, {
                from: fromName,
                to: fullMethodName,
                type: 'method',
                line: child.getStartLineNumber(),
              });
            }
          }
        }
      }

      // Новые выражения: new Class()
      if (Node.isNewExpression(child)) {
        const expr = child.getExpression();
        if (Node.isIdentifier(expr)) {
          const className = expr.getText();
          if (nodes.has(className)) {
            this.addEdge(edges, {
              from: fromName,
              to: className,
              type: 'direct',
              line: child.getStartLineNumber(),
            });
          }
        }
      }

      // Импорты: import { func } from 'module'
      if (Node.isImportDeclaration(child)) {
        const namedImports = child.getNamedImports();

        for (const named of namedImports) {
          const name = named.getName();
          if (nodes.has(name)) {
            this.addEdge(edges, {
              from: fromName,
              to: name,
              type: 'import',
              line: child.getStartLineNumber(),
            });
          }
        }
      }

      // Рекурсивный обход детей
      child.forEachChild(traverse);
    };

    node.forEachChild(traverse);
  }

  /**
   * Добавляет ребро, избегая дубликатов
   */
  private addEdge(edges: CallEdge[], newEdge: CallEdge): void {
    const exists = edges.some(
      e => e.from === newEdge.from && e.to === newEdge.to && e.type === newEdge.type
    );
    if (!exists) {
      edges.push(newEdge);
    }
  }

  /**
   * Сравнивает два графа вызовов
   */
  compareGraphs(graph1: CallGraph, graph2: CallGraph): CallGraphComparisonResult {
    const changes: CallGraphChange[] = [];
    const addedEdges: CallGraphChange[] = [];
    const removedEdges: CallGraphChange[] = [];
    const nodeChanges = {
      added: [] as string[],
      removed: [] as string[],
    };

    // Сравниваем узлы
    for (const node of graph2.nodes) {
      if (!graph1.nodes.has(node)) {
        nodeChanges.added.push(node);
      }
    }

    for (const node of graph1.nodes) {
      if (!graph2.nodes.has(node)) {
        nodeChanges.removed.push(node);
        changes.push({
          type: 'removed_edge',
          from: node,
          to: '',
          original: node,
          modified: '',
        });
      }
    }

    // Сравниваем ребра
    const edges1 = new Set(graph1.edges.map(e => `${e.from}->${e.to}:${e.type}`));
    const edges2 = new Set(graph2.edges.map(e => `${e.from}->${e.to}:${e.type}`));

    // Удаленные ребра
    for (const edgeKey of edges1) {
      if (!edges2.has(edgeKey)) {
        const [from, rest] = edgeKey.split('->');
        const [to, _type] = rest ? rest.split(':') : ['', ''];
        const change: CallGraphChange = {
          type: 'removed_edge',
          from: from || 'unknown',
          to: to || 'unknown',
          original: edgeKey,
          modified: '',
        };
        changes.push(change);
        removedEdges.push(change);
      }
    }

    // Добавленные ребра
    for (const edgeKey of edges2) {
      if (!edges1.has(edgeKey)) {
        const [from, rest] = edgeKey.split('->');
        const [to, _type] = rest ? rest.split(':') : ['', ''];
        const change: CallGraphChange = {
          type: 'added_edge',
          from: from || 'unknown',
          to: to || 'unknown',
          original: '',
          modified: edgeKey,
        };
        changes.push(change);
        addedEdges.push(change);
      }
    }

    // Проверяем изменение типа ребра
    for (const edge1 of graph1.edges) {
      for (const edge2 of graph2.edges) {
        if (edge1.from === edge2.from && edge1.to === edge2.to && edge1.type !== edge2.type) {
          changes.push({
            type: 'changed',
            from: edge1.from,
            to: edge1.to,
            original: edge1.type,
            modified: edge2.type,
            line: edge1.line || edge2.line,
          });
        }
      }
    }

    return {
      changes,
      isEquivalent: changes.length === 0,
      addedEdges,
      removedEdges,
      nodeChanges,
    };
  }

  /**
   * Находит циклические зависимости в графе
   */
  findCycles(graph: CallGraph): CallEdge[][] {
    const cycles: CallEdge[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeName: string) => {
      if (recursionStack.has(nodeName)) {
        // Нашли цикл
        const cycleStart = path.indexOf(nodeName);
        const cycleNodes = path.slice(cycleStart);
        const cycleEdges: CallEdge[] = [];

        for (let i = 0; i < cycleNodes.length - 1; i++) {
          const edge = graph.edges.find(
            e => e.from === cycleNodes[i] && e.to === cycleNodes[i + 1]
          );
          if (edge) cycleEdges.push(edge);
        }

        // Добавляем последнее ребро, замыкающее цикл
        if (cycleNodes.length > 1) {
          const lastEdge = graph.edges.find(
            e => e.from === cycleNodes[cycleNodes.length - 1] && e.to === cycleNodes[0]
          );
          if (lastEdge) cycleEdges.push(lastEdge);
        }

        if (cycleEdges.length > 0) {
          cycles.push(cycleEdges);
        }
        return;
      }

      if (visited.has(nodeName)) return;

      visited.add(nodeName);
      recursionStack.add(nodeName);
      path.push(nodeName);

      const edges = graph.edges.filter(e => e.from === nodeName);
      for (const edge of edges) {
        dfs(edge.to);
      }

      recursionStack.delete(nodeName);
      path.pop();
    };

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Находит неиспользуемые функции (без вызовов)
   */
  findUnusedFunctions(graph: CallGraph): string[] {
    const calledFunctions = new Set(graph.edges.map(e => e.to));
    return Array.from(graph.nodes).filter(name => !calledFunctions.has(name));
  }

  /**
   * Находит функции, которые вызывают друг друга (взаимные вызовы)
   */
  findMutualCalls(graph: CallGraph): { func1: string; func2: string }[] {
    const mutual: { func1: string; func2: string }[] = [];
    const edgesMap = new Map<string, Set<string>>();

    // Строим карту вызовов
    for (const edge of graph.edges) {
      if (!edgesMap.has(edge.from)) {
        edgesMap.set(edge.from, new Set());
      }
      edgesMap.get(edge.from)!.add(edge.to);
    }

    // Ищем взаимные вызовы
    for (const [from, toSet] of edgesMap) {
      for (const to of toSet) {
        const toCalls = edgesMap.get(to);
        if (toCalls && toCalls.has(from)) {
          // Проверяем, что не добавили уже
          const exists = mutual.some(
            m => (m.func1 === from && m.func2 === to) || (m.func1 === to && m.func2 === from)
          );
          if (!exists) {
            mutual.push({ func1: from, func2: to });
          }
        }
      }
    }

    return mutual;
  }

  /**
   * Генерирует DOT формат для визуализации
   */
  toDot(graph: CallGraph, highlightCycles?: CallEdge[][]): string {
    let dot = 'digraph CallGraph {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
    dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

    // Циклические ребра для подсветки
    const cycleEdges = new Set<string>();
    if (highlightCycles) {
      for (const cycle of highlightCycles) {
        for (const edge of cycle) {
          cycleEdges.add(`${edge.from}->${edge.to}`);
        }
      }
    }

    // Узлы
    for (const node of graph.nodes) {
      const isEntry = graph.entryPoints.includes(node);
      const color = isEntry ? '#4f46e5' : '#f3f4f6';
      const fontColor = isEntry ? '#ffffff' : '#1f2937';
      const label = isEntry ? `⭐ ${node}` : node;
      dot += `  "${node}" [fillcolor="${color}", fontcolor="${fontColor}", label="${label}"];\n`;
    }

    // Ребра
    for (const edge of graph.edges) {
      const isCycle = cycleEdges.has(`${edge.from}->${edge.to}`);
      const color = isCycle ? '#ef4444' : '#9ca3af';
      const style = isCycle ? 'dashed' : 'solid';
      const penwidth = isCycle ? '2.5' : '1';
      const label = isCycle ? ' цикл' : '';
      dot += `  "${edge.from}" -> "${edge.to}" [color="${color}", style="${style}", penwidth=${penwidth}, label="${label}"];\n`;
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Генерирует отчет о графе вызовов
   */
  generateReport(graph: CallGraph, comparison?: CallGraphComparisonResult): string {
    let report = '# 🕸️ Call Graph Report\n\n';

    report += '## 📊 Statistics\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Total nodes | ${graph.nodes.size} |\n`;
    report += `| Total edges | ${graph.edges.length} |\n`;
    report += `| Entry points | ${graph.entryPoints.length} |\n\n`;

    if (graph.entryPoints.length > 0) {
      report += '## 🎯 Entry Points\n\n';
      for (const entry of graph.entryPoints) {
        report += `- ${entry}\n`;
      }
      report += '\n';
    }

    // Неиспользуемые функции
    const unused = this.findUnusedFunctions(graph);
    if (unused.length > 0) {
      report += '## ⚠️ Unused Functions\n\n';
      for (const func of unused) {
        report += `- ${func}\n`;
      }
      report += '\n';
    }

    // Взаимные вызовы
    const mutual = this.findMutualCalls(graph);
    if (mutual.length > 0) {
      report += '## 🔄 Mutual Calls\n\n';
      for (const m of mutual) {
        report += `- ${m.func1} ↔ ${m.func2}\n`;
      }
      report += '\n';
    }

    // Циклы
    const cycles = this.findCycles(graph);
    if (cycles.length > 0) {
      report += '## 🔴 Cycles\n\n';
      for (const cycle of cycles) {
        const edgeStr = cycle.map(e => `${e.from}→${e.to}`).join(' → ');
        report += `- ${edgeStr}\n`;
      }
      report += '\n';
    }

    // Сравнение с другим графом
    if (comparison) {
      report += '## 📋 Comparison Results\n\n';
      report += `- **Equivalent:** ${comparison.isEquivalent ? '✅' : '❌'}\n`;
      report += `- **Added edges:** ${comparison.addedEdges.length}\n`;
      report += `- **Removed edges:** ${comparison.removedEdges.length}\n`;
      report += `- **Nodes added:** ${comparison.nodeChanges.added.length}\n`;
      report += `- **Nodes removed:** ${comparison.nodeChanges.removed.length}\n\n`;

      if (comparison.addedEdges.length > 0) {
        report += '### ➕ Added Edges\n\n';
        for (const edge of comparison.addedEdges) {
          report += `- ${edge.from} → ${edge.to}\n`;
        }
        report += '\n';
      }

      if (comparison.removedEdges.length > 0) {
        report += '### ➖ Removed Edges\n\n';
        for (const edge of comparison.removedEdges) {
          report += `- ${edge.from} → ${edge.to}\n`;
        }
        report += '\n';
      }
    }

    return report;
  }

  /**
   * Экспортирует граф в JSON
   */
  toJSON(graph: CallGraph): any {
    return {
      nodes: Array.from(graph.nodes),
      edges: graph.edges.map(e => ({
        from: e.from,
        to: e.to,
        type: e.type,
        line: e.line,
      })),
      entryPoints: graph.entryPoints,
    };
  }

  /**
   * Импортирует граф из JSON
   */
  fromJSON(data: any): CallGraph {
    return {
      nodes: new Set(data.nodes),
      edges: data.edges.map((e: any) => ({
        from: e.from,
        to: e.to,
        type: e.type || 'direct',
        line: e.line,
      })),
      entryPoints: data.entryPoints || [],
    };
  }

  /**
   * Находит путь между двумя функциями (BFS)
   */
  findPath(graph: CallGraph, from: string, to: string): string[] | null {
    const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (visited.has(node)) continue;
      visited.add(node);

      if (node === to) {
        return path;
      }

      const edges = graph.edges.filter(e => e.from === node);
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          queue.push({ node: edge.to, path: [...path, edge.to] });
        }
      }
    }

    return null;
  }

  /**
   * Находит все функции, которые зависят от указанной
   */
  findDependents(graph: CallGraph, functionName: string): string[] {
    const dependents: string[] = [];
    const visited = new Set<string>();

    const find = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const callers = graph.edges.filter(e => e.to === name);
      for (const caller of callers) {
        if (!visited.has(caller.from)) {
          dependents.push(caller.from);
          find(caller.from);
        }
      }
    };

    find(functionName);
    return dependents;
  }

  /**
   * Находит все функции, от которых зависит указанная
   */
  findDependencies(graph: CallGraph, functionName: string): string[] {
    const dependencies: string[] = [];
    const visited = new Set<string>();

    const find = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const callees = graph.edges.filter(e => e.from === name);
      for (const callee of callees) {
        if (!visited.has(callee.to)) {
          dependencies.push(callee.to);
          find(callee.to);
        }
      }
    };

    find(functionName);
    return dependencies;
  }
}

// Экспорт утилит
export function createEmptyCallGraph(): CallGraph {
  return {
    nodes: new Set(),
    edges: [],
    entryPoints: [],
  };
}

export function mergeCallGraphs(graphs: CallGraph[]): CallGraph {
  const merged: CallGraph = {
    nodes: new Set(),
    edges: [],
    entryPoints: [],
  };

  for (const graph of graphs) {
    for (const node of graph.nodes) {
      merged.nodes.add(node);
    }
    for (const edge of graph.edges) {
      // Проверяем дубликаты
      const exists = merged.edges.some(
        e => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (!exists) {
        merged.edges.push(edge);
      }
    }
  }

  // Обновляем точки входа
  const calledFunctions = new Set(merged.edges.map(e => e.to));
  merged.entryPoints = Array.from(merged.nodes).filter(name => !calledFunctions.has(name));

  return merged;
}
