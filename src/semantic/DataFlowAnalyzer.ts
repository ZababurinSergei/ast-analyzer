// src/semantic/DataFlowAnalyzer.ts

import type { SourceFile, Node } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export interface DataFlowNode {
  id: string;
  name: string;
  type: 'variable' | 'function' | 'parameter' | 'constant';
  line: number;
  column: number;
  definedAt: Node | null;
  usedAt: Node[];
  value?: any;
  isConst: boolean;
}

export interface DataFlowEdge {
  from: DataFlowNode;
  to: DataFlowNode;
  type: 'definition' | 'usage' | 'assignment' | 'call';
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  findUnusedVariables(): DataFlowNode[];
  findReassignedConstants(): DataFlowNode[];
  findDataDependencies(variable: string): DataFlowNode[];
  getDefinitionUsageChain(variable: string): DataFlowNode[];
  getVariableStats(): {
    total: number;
    used: number;
    unused: number;
    constants: number;
    reassignedConstants: number;
  };
  isVariableUsed(variableName: string): boolean;
}

export class DataFlowAnalyzer {
  private nodes: DataFlowNode[] = [];
  private edges: DataFlowEdge[] = [];
  private nodeMap: Map<string, DataFlowNode> = new Map();

  analyze(sourceFile: SourceFile): DataFlowGraph {
    // 1. Собираем все объявления переменных
    const variableDeclarations = this.collectVariableDeclarations(sourceFile);

    // 2. Собираем все использования переменных
    const variableUsages = this.collectVariableUsages(sourceFile);

    // Строим карту узлов
    const allNodes = [...variableDeclarations, ...variableUsages];
    this.nodes = allNodes;

    for (const node of this.nodes) {
      this.nodeMap.set(node.id, node);
    }

    // Строим ребра между definition и usage
    const edges: DataFlowEdge[] = [];

    // Группируем узлы по имени
    const nodesByName = new Map<string, DataFlowNode[]>();
    for (const node of allNodes) {
      if (!nodesByName.has(node.name)) {
        nodesByName.set(node.name, []);
      }
      nodesByName.get(node.name)!.push(node);
    }

    // Для каждой переменной создаем ребра между definition и usage
    for (const namedNodes of nodesByName.values()) {
      const definitions = namedNodes.filter(n => n.type === 'variable' && n.definedAt !== null);
      const usages = namedNodes.filter(n => n.type === 'variable' && n.definedAt === null);

      for (const def of definitions) {
        for (const usage of usages) {
          if (def.line < usage.line && this.isInScope(def, usage)) {
            edges.push({
              from: def,
              to: usage,
              type: 'definition',
            });
          }
        }
      }
    }

    this.edges = edges;

    return {
      nodes: this.nodes,
      edges: this.edges,
      findUnusedVariables: () => this.findUnused(),
      findReassignedConstants: () => this.findReassigned(),
      findDataDependencies: variable => this.findDependencies(variable),
      getDefinitionUsageChain: variable => this.getChain(variable),
      getVariableStats: () => this.getVariableStats(),
      isVariableUsed: (variableName: string) => this.isVariableUsed(variableName),
    };
  }

  private collectVariableDeclarations(sourceFile: SourceFile): DataFlowNode[] {
    const declarations: DataFlowNode[] = [];

    const visit = (node: Node) => {
      if (node.getKind() === SyntaxKind.VariableDeclaration) {
        const varDecl = node.asKind(SyntaxKind.VariableDeclaration);
        if (varDecl) {
          const name = varDecl.getName();
          const initializer = varDecl.getInitializer();

          declarations.push({
            id: `def_${name}_${varDecl.getStart()}`,
            name,
            type: 'variable',
            line: varDecl.getStartLineNumber(),
            column: varDecl.getStartLinePos(),
            definedAt: varDecl,
            usedAt: [],
            value: this.extractValue(initializer),
            isConst: this.isConstant(varDecl),
          });
        }
      }

      node.forEachChild(visit);
    };

    sourceFile.forEachChild(visit);
    return declarations;
  }

  private collectVariableUsages(sourceFile: SourceFile): DataFlowNode[] {
    const usages: DataFlowNode[] = [];

    const visit = (node: Node) => {
      if (node.getKind() === SyntaxKind.Identifier) {
        const identifier = node.asKind(SyntaxKind.Identifier);
        if (identifier && !this.isDeclaration(identifier)) {
          usages.push({
            id: `use_${identifier.getText()}_${identifier.getStart()}`,
            name: identifier.getText(),
            type: 'variable',
            line: identifier.getStartLineNumber(),
            column: identifier.getStartLinePos(),
            definedAt: null,
            usedAt: [identifier],
            isConst: false,
          });
        }
      }

      node.forEachChild(visit);
    };

    sourceFile.forEachChild(visit);
    return usages;
  }

  private findUnused(): DataFlowNode[] {
    const used = new Set<string>();

    for (const edge of this.edges) {
      used.add(edge.from.id);
    }

    return this.nodes.filter(n => n.type === 'variable' && !used.has(n.id) && n.definedAt !== null);
  }

  private findReassigned(): DataFlowNode[] {
    const reassigned: DataFlowNode[] = [];
    const assignments = new Map<string, number>();

    for (const node of this.nodes) {
      if (node.type === 'variable' && node.isConst) {
        assignments.set(node.name, (assignments.get(node.name) || 0) + 1);
      }
    }

    for (const [name, count] of assignments) {
      if (count > 1) {
        const node = this.nodes.find(n => n.name === name && n.isConst);
        if (node) reassigned.push(node);
      }
    }

    return reassigned;
  }

  private findDependencies(variable: string): DataFlowNode[] {
    const dependencies: DataFlowNode[] = [];
    const visited = new Set<string>();

    const visit = (node: DataFlowNode) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      // Находим все определения, от которых зависит эта переменная
      for (const edge of this.edges) {
        if (edge.to.name === variable && edge.type === 'definition') {
          dependencies.push(edge.from);
          visit(edge.from);
        }
      }
    };

    const varNode = this.nodeMap.get(`def_${variable}`);
    if (varNode) visit(varNode);

    return dependencies;
  }

  private getChain(variable: string): DataFlowNode[] {
    const chain: DataFlowNode[] = [];

    // Находим первое определение
    const firstDef = this.nodes.find(n => n.name === variable && n.definedAt !== null);
    if (!firstDef) return chain;

    chain.push(firstDef);

    // Находим все использования
    const usages = this.edges.filter(e => e.from.name === variable).map(e => e.to);

    chain.push(...usages);

    return chain;
  }

  private extractValue(node: Node | undefined): any {
    if (!node) return undefined;

    const kind = node.getKind();

    if (kind === SyntaxKind.StringLiteral) {
      const text = node.getText();
      return text.slice(1, -1);
    }

    if (kind === SyntaxKind.NumericLiteral) {
      return parseFloat(node.getText());
    }

    if (kind === SyntaxKind.TrueKeyword) return true;
    if (kind === SyntaxKind.FalseKeyword) return false;
    if (kind === SyntaxKind.NullKeyword) return null;
    if (kind === SyntaxKind.UndefinedKeyword) return undefined;

    return undefined;
  }

  private isConstant(node: Node): boolean {
    // Проверяем, объявлена ли переменная с const
    let current = node.getParent();
    while (current) {
      if (current.getKind() === SyntaxKind.VariableStatement) {
        const varStmt = current.asKind(SyntaxKind.VariableStatement);
        if (varStmt && varStmt.getDeclarationKind() === 'const') {
          return true;
        }
      }
      current = current.getParent();
    }
    return false;
  }

  private isDeclaration(node: Node): boolean {
    // Проверяем, является ли идентификатор объявлением
    const parent = node.getParent();
    if (!parent) return false;

    const kind = parent.getKind();
    return (
      kind === SyntaxKind.VariableDeclaration ||
      kind === SyntaxKind.Parameter ||
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.ClassDeclaration
    );
  }

  private isInScope(def: DataFlowNode, usage: DataFlowNode): boolean {
    // Проверяем, что usage находится в области видимости definition
    // Упрощенная версия - в реальном коде нужен анализ scope
    return def.line < usage.line;
  }

  /**
   * Получить все определения переменной
   */
  getDefinitions(variableName: string): DataFlowNode[] {
    return this.nodes.filter(
      n => n.name === variableName && n.type === 'variable' && n.definedAt !== null
    );
  }

  /**
   * Получить все использования переменной
   */
  getUsages(variableName: string): DataFlowNode[] {
    return this.nodes.filter(
      n => n.name === variableName && n.type === 'variable' && n.definedAt === null
    );
  }

  /**
   * Проверить, используется ли переменная
   */
  isVariableUsed(variableName: string): boolean {
    const usages = this.getUsages(variableName);
    return usages.length > 0;
  }

  /**
   * Получить статистику по переменным
   */
  getVariableStats(): {
    total: number;
    used: number;
    unused: number;
    constants: number;
    reassignedConstants: number;
  } {
    const variables = this.nodes.filter(n => n.type === 'variable');
    const used = variables.filter(v => this.isVariableUsed(v.name));
    const unused = variables.filter(v => !this.isVariableUsed(v.name) && v.definedAt !== null);
    const constants = variables.filter(v => v.isConst);
    const reassignedConstants = this.findReassigned();

    return {
      total: variables.length,
      used: used.length,
      unused: unused.length,
      constants: constants.length,
      reassignedConstants: reassignedConstants.length,
    };
  }

  /**
   * Экспортировать граф в формате DOT для визуализации
   */
  exportToDOT(): string {
    let dot = 'digraph DataFlowGraph {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n\n';

    // Добавляем узлы
    for (const node of this.nodes) {
      const color = node.type === 'variable' ? '#a5f3fc' : '#fde68a';
      const shape = node.type === 'variable' ? 'box' : 'ellipse';
      dot += `  "${node.id}" [label="${node.name}:${node.line}", shape=${shape}, fillcolor="${color}"];\n`;
    }

    dot += '\n';

    // Добавляем рёбра
    for (const edge of this.edges) {
      const style = edge.type === 'definition' ? 'solid' : 'dashed';
      const color = edge.type === 'definition' ? '#22c55e' : '#f59e0b';
      dot += `  "${edge.from.id}" -> "${edge.to.id}" [style=${style}, color="${color}"];\n`;
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Найти путь данных от определения до использования
   */
  findDataPath(fromVariable: string, toVariable: string): DataFlowNode[] | null {
    const fromDefs = this.getDefinitions(fromVariable);
    const toUsages = this.getUsages(toVariable);

    if (fromDefs.length === 0 || toUsages.length === 0) return null;

    // BFS поиск пути
    for (const fromDef of fromDefs) {
      for (const toUsage of toUsages) {
        const visited = new Set<string>();
        const queue: { node: DataFlowNode; path: DataFlowNode[] }[] = [
          { node: fromDef, path: [fromDef] },
        ];

        while (queue.length > 0) {
          const { node, path } = queue.shift()!;

          if (visited.has(node.id)) continue;
          visited.add(node.id);

          if (node.id === toUsage.id) {
            return path;
          }

          // Находим следующие узлы
          for (const edge of this.edges) {
            if (edge.from.id === node.id && !visited.has(edge.to.id)) {
              queue.push({ node: edge.to, path: [...path, edge.to] });
            }
          }
        }
      }
    }

    return null;
  }
}
