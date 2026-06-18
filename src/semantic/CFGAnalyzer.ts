// src/semantic/CFGAnalyzer.ts

import type { SourceFile, Node } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export interface BasicBlock {
  id: string;
  instructions: Node[];
  successors: BasicBlock[];
  predecessors: BasicBlock[];
  isEntry: boolean;
  isExit: boolean;
  dominators?: Set<BasicBlock>;
  loopDepth?: number;
  isReachable: boolean;
}

export interface ControlFlowGraph {
  blocks: BasicBlock[];
  entry: BasicBlock;
  exit: BasicBlock;
  findUnreachableBlocks(): BasicBlock[];
  findLoops(): { header: BasicBlock; body: BasicBlock[] }[];
  getDominators(block: BasicBlock): Set<BasicBlock>;
}

export class CFGAnalyzer {
  private blocks: Map<string, BasicBlock> = new Map();
  private entryBlock: BasicBlock | null = null;
  private exitBlock: BasicBlock | null = null;

  /**
   * Создает пустой граф управления для файлов без функций
   */
  private createEmptyGraph(): ControlFlowGraph {
    const emptyBlock: BasicBlock = {
      id: 'empty',
      instructions: [],
      successors: [],
      predecessors: [],
      isEntry: true,
      isExit: true,
      isReachable: true,
      dominators: new Set(),
      loopDepth: 0,
    };

    this.blocks.set('empty', emptyBlock);
    this.entryBlock = emptyBlock;
    this.exitBlock = emptyBlock;

    return {
      blocks: Array.from(this.blocks.values()),
      entry: this.entryBlock,
      exit: this.exitBlock,
      findUnreachableBlocks: () => [],
      findLoops: () => [],
      getDominators: (block: BasicBlock) => block.dominators || new Set(),
    };
  }

  build(sourceFile: SourceFile): ControlFlowGraph {
    try {
      // Проверяем, есть ли в файле функции
      const functions = sourceFile.getFunctions();
      if (functions.length === 0) {
        console.log('ℹ️ No functions found, returning empty CFG');
        return this.createEmptyGraph();
      }

      // Проверяем, есть ли в файле узлы
      let hasNodes = false;
      const checkNodes = (node: Node) => {
        hasNodes = true;
        node.forEachChild(checkNodes);
      };
      try {
        sourceFile.forEachChild(checkNodes);
      } catch {
        // Если не удалось обойти узлы, возвращаем пустой граф
        return this.createEmptyGraph();
      }

      if (!hasNodes) {
        return this.createEmptyGraph();
      }

      // 1. Разбиваем на базовые блоки
      this.buildBasicBlocks(sourceFile);

      // Если блоки не были созданы, возвращаем пустой граф
      if (this.blocks.size === 0) {
        return this.createEmptyGraph();
      }

      // 2. Строим ребра
      this.buildEdges();

      // 3. Вычисляем доминаторы
      this.computeDominators();

      // 4. Находим циклы
      this.identifyLoops();

      // 5. Определяем достижимость
      this.computeReachability();

      // Проверяем, что entry и exit существуют
      if (!this.entryBlock || !this.exitBlock) {
        return this.createEmptyGraph();
      }

      return {
        blocks: Array.from(this.blocks.values()),
        entry: this.entryBlock,
        exit: this.exitBlock,
        findUnreachableBlocks: () => this.findUnreachable(),
        findLoops: () => this.getLoops(),
        getDominators: (block: BasicBlock) => block.dominators || new Set(),
      };
    } catch (error) {
      // При любой ошибке возвращаем пустой граф
      console.warn(
        '⚠️ Failed to build CFG, returning empty graph:',
        error instanceof Error ? error.message : String(error)
      );
      return this.createEmptyGraph();
    }
  }

  private buildBasicBlocks(sourceFile: SourceFile): void {
    try {
      // Находим лидеров (начала блоков)
      const leaders = this.findLeaders(sourceFile);

      let currentBlock: BasicBlock | null = null;
      let currentInstructions: Node[] = [];

      // Обходим все узлы в порядке исходного кода
      const orderedNodes = this.getOrderedNodes(sourceFile);

      for (const node of orderedNodes) {
        if (leaders.has(node)) {
          if (currentBlock) {
            this.finalizeBlock(currentBlock, currentInstructions);
          }
          currentBlock = this.createBlock(node);
          currentInstructions = [];
        }

        if (currentBlock) {
          currentInstructions.push(node);

          // Блок заканчивается на терминирующей инструкции
          if (this.isTerminator(node)) {
            this.finalizeBlock(currentBlock, currentInstructions);
            currentBlock = null;
            currentInstructions = [];
          }
        }
      }

      if (currentBlock && currentInstructions.length > 0) {
        this.finalizeBlock(currentBlock, currentInstructions);
      }

      // Если блоки не были созданы, создаем пустой блок
      if (this.blocks.size === 0) {
        this.createEmptyGraph();
      }
    } catch (error) {
      console.warn(
        '⚠️ Error building basic blocks:',
        error instanceof Error ? error.message : String(error)
      );
      // Создаем пустой граф при ошибке
      this.createEmptyGraph();
    }
  }

  private findLeaders(sourceFile: SourceFile): Set<Node> {
    const leaders = new Set<Node>();

    try {
      // Первая инструкция - лидер
      const firstNode = this.getFirstNode(sourceFile);
      if (firstNode) leaders.add(firstNode);

      // Функция для обхода AST и поиска лидеров
      const visitNode = (node: Node) => {
        // Инструкции, следующие за условным переходом - лидеры
        if (this.isBranch(node)) {
          const nextNode = this.getNextSibling(node);
          if (nextNode) leaders.add(nextNode);
        }

        // Target меток - лидеры
        if (node.getKind() === SyntaxKind.LabeledStatement) {
          leaders.add(node);
        }

        // Начало catch/finally - лидеры
        if (node.getKind() === SyntaxKind.CatchClause) {
          leaders.add(node);
        }

        // Try statement с finally блоком
        if (node.getKind() === SyntaxKind.TryStatement) {
          const tryNode = node.asKind(SyntaxKind.TryStatement);
          if (tryNode) {
            const finallyBlock = tryNode.getFinallyBlock();
            if (finallyBlock) {
              leaders.add(finallyBlock);
            }
          }
        }

        node.forEachChild(visitNode);
      };

      sourceFile.forEachChild(visitNode);
    } catch (error) {
      console.warn(
        '⚠️ Error finding leaders:',
        error instanceof Error ? error.message : String(error)
      );
    }

    return leaders;
  }

  private buildEdges(): void {
    try {
      for (const block of this.blocks.values()) {
        const lastInst = block.instructions[block.instructions.length - 1];

        if (!lastInst) {
          // Пустой блок - соединяем со следующим
          const nextBlock = this.getNextBlock(block);
          if (nextBlock) this.addEdge(block, nextBlock);
          continue;
        }

        const kind = lastInst.getKind();

        switch (kind) {
          case SyntaxKind.IfStatement:
            this.handleIfStatement(block, lastInst);
            break;
          case SyntaxKind.WhileStatement:
          case SyntaxKind.DoStatement:
          case SyntaxKind.ForStatement:
          case SyntaxKind.ForInStatement:
          case SyntaxKind.ForOfStatement:
            this.handleLoop(block, lastInst);
            break;
          case SyntaxKind.SwitchStatement:
            this.handleSwitch(block, lastInst);
            break;
          case SyntaxKind.TryStatement:
            this.handleTry(block, lastInst);
            break;
          case SyntaxKind.ReturnStatement:
            this.handleReturn(block);
            break;
          default:
            // Безусловный переход к следующему блоку
            const nextBlock = this.getNextBlock(block);
            if (nextBlock) this.addEdge(block, nextBlock);
        }
      }
    } catch (error) {
      console.warn(
        '⚠️ Error building edges:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private handleIfStatement(block: BasicBlock, node: Node): void {
    try {
      // Находим then и else ветки
      const thenBlock = this.findBlockContainingNode(node.getChildAtIndex?.(2));
      const elseBlock = this.findBlockContainingNode(node.getChildAtIndex?.(3));

      if (thenBlock) this.addEdge(block, thenBlock);
      if (elseBlock) this.addEdge(block, elseBlock);
    } catch (error) {
      console.warn(
        '⚠️ Error handling if statement:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private handleLoop(block: BasicBlock, node: Node): void {
    try {
      // Тело цикла
      const bodyBlock = this.findBlockContainingNode(node.getChildAtIndex?.(2));
      if (bodyBlock) this.addEdge(block, bodyBlock);

      // Выход из цикла
      const nextBlock = this.getNextBlock(block);
      if (nextBlock) this.addEdge(block, nextBlock);
    } catch (error) {
      console.warn(
        '⚠️ Error handling loop:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private handleSwitch(block: BasicBlock, node: Node): void {
    try {
      // Все case блоки
      const cases = node
        .getChildren()
        .filter(
          c => c.getKind() === SyntaxKind.CaseClause || c.getKind() === SyntaxKind.DefaultClause
        );

      for (const caseNode of cases) {
        const caseBlock = this.findBlockContainingNode(caseNode);
        if (caseBlock) this.addEdge(block, caseBlock);
      }
    } catch (error) {
      console.warn(
        '⚠️ Error handling switch:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private handleTry(block: BasicBlock, node: Node): void {
    try {
      // try блок
      const tryBlock = this.findBlockContainingNode(node.getChildAtIndex?.(1));
      if (tryBlock) this.addEdge(block, tryBlock);

      // catch блок
      const catchBlock = this.findBlockContainingNode(node.getChildAtIndex?.(2));
      if (catchBlock) this.addEdge(block, catchBlock);

      // finally блок
      const finallyBlock = this.findBlockContainingNode(node.getChildAtIndex?.(3));
      if (finallyBlock) this.addEdge(block, finallyBlock);
    } catch (error) {
      console.warn(
        '⚠️ Error handling try:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private handleReturn(block: BasicBlock): void {
    if (this.exitBlock) {
      this.addEdge(block, this.exitBlock);
    }
  }

  private computeDominators(): void {
    try {
      const allBlocks = Array.from(this.blocks.values());

      if (allBlocks.length === 0) return;

      // Инициализация
      for (const block of allBlocks) {
        if (block === this.entryBlock) {
          block.dominators = new Set([block]);
        } else {
          block.dominators = new Set(allBlocks);
        }
      }

      // Итеративное вычисление
      let changed = true;
      while (changed) {
        changed = false;

        for (const block of allBlocks) {
          if (block === this.entryBlock) continue;

          let newDom = new Set<BasicBlock>();
          let first = true;

          for (const pred of block.predecessors) {
            if (first) {
              if (pred.dominators) {
                newDom = new Set(pred.dominators);
              }
              first = false;
            } else {
              if (pred.dominators) {
                newDom = this.intersect(newDom, pred.dominators);
              }
            }
          }

          newDom.add(block);

          if (block.dominators && !this.setsEqual(newDom, block.dominators)) {
            block.dominators = newDom;
            changed = true;
          }
        }
      }
    } catch (error) {
      console.warn(
        '⚠️ Error computing dominators:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private identifyLoops(): void {
    try {
      // Находим обратные ребра
      const backEdges: [BasicBlock, BasicBlock][] = [];

      for (const block of this.blocks.values()) {
        for (const succ of block.successors) {
          if (succ.dominators?.has(block)) {
            backEdges.push([block, succ]);
          }
        }
      }

      // Для каждого обратного ребра находим тело цикла
      for (const [_, header] of backEdges) {
        const loopBody = this.findLoopBody(header);

        for (const block of loopBody) {
          block.loopDepth = (block.loopDepth || 0) + 1;
        }
      }
    } catch (error) {
      console.warn(
        '⚠️ Error identifying loops:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private findLoopBody(header: BasicBlock): Set<BasicBlock> {
    const body = new Set<BasicBlock>();
    const stack = [...header.successors];

    while (stack.length > 0) {
      const block = stack.pop()!;
      if (block === header) continue;

      if (!body.has(block)) {
        body.add(block);
        stack.push(...block.predecessors);
        stack.push(...block.successors);
      }
    }

    body.add(header);
    return body;
  }

  private computeReachability(): void {
    try {
      if (!this.entryBlock) return;

      const reachable = new Set<BasicBlock>();
      const queue = [this.entryBlock];

      while (queue.length > 0) {
        const block = queue.shift()!;
        if (reachable.has(block)) continue;

        reachable.add(block);
        queue.push(...block.successors);
      }

      for (const block of this.blocks.values()) {
        block.isReachable = reachable.has(block);
      }
    } catch (error) {
      console.warn(
        '⚠️ Error computing reachability:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private findUnreachable(): BasicBlock[] {
    return Array.from(this.blocks.values()).filter(b => !b.isReachable && b !== this.exitBlock);
  }

  private getLoops(): { header: BasicBlock; body: BasicBlock[] }[] {
    const loops: { header: BasicBlock; body: BasicBlock[] }[] = [];

    for (const block of this.blocks.values()) {
      if (block.loopDepth && block.loopDepth > 0) {
        loops.push({
          header: block,
          body: Array.from(this.findLoopBody(block)),
        });
      }
    }

    return loops;
  }

  private createBlock(_node: Node): BasicBlock {
    const block: BasicBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      instructions: [],
      successors: [],
      predecessors: [],
      isEntry: !this.entryBlock,
      isExit: false,
      isReachable: false,
      dominators: new Set(),
      loopDepth: 0,
    };

    this.blocks.set(block.id, block);
    if (!this.entryBlock) this.entryBlock = block;

    return block;
  }

  private finalizeBlock(block: BasicBlock, instructions: Node[]): void {
    block.instructions = instructions;
  }

  private addEdge(from: BasicBlock, to: BasicBlock): void {
    if (!from.successors.includes(to)) from.successors.push(to);
    if (!to.predecessors.includes(from)) to.predecessors.push(from);
  }

  private findBlockContainingNode(node: Node | undefined): BasicBlock | undefined {
    if (!node) return undefined;

    for (const block of this.blocks.values()) {
      if (block.instructions.includes(node)) return block;
    }
    return undefined;
  }

  private getNextBlock(block: BasicBlock): BasicBlock | undefined {
    const blocks = Array.from(this.blocks.values());
    const index = blocks.indexOf(block);
    return index >= 0 && index < blocks.length - 1 ? blocks[index + 1] : undefined;
  }

  private getNextSibling(node: Node): Node | undefined {
    const parent = node.getParent();
    if (!parent) return undefined;

    const siblings = parent.getChildren();
    const index = siblings.indexOf(node);
    return index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;
  }

  private getFirstNode(sourceFile: SourceFile): Node | undefined {
    try {
      const children = sourceFile.getChildren();
      return children.find(c => !this.isPrologue(c));
    } catch (error) {
      return undefined;
    }
  }

  private getOrderedNodes(sourceFile: SourceFile): Node[] {
    const nodes: Node[] = [];

    try {
      const collect = (node: Node) => {
        nodes.push(node);
        node.forEachChild(collect);
      };

      sourceFile.forEachChild(collect);
    } catch (error) {
      console.warn(
        '⚠️ Error getting ordered nodes:',
        error instanceof Error ? error.message : String(error)
      );
    }

    return nodes;
  }

  private isTerminator(node: Node): boolean {
    const kind = node.getKind();
    return [
      SyntaxKind.ReturnStatement,
      SyntaxKind.ThrowStatement,
      SyntaxKind.BreakStatement,
      SyntaxKind.ContinueStatement,
    ].includes(kind);
  }

  private isBranch(node: Node): boolean {
    const kind = node.getKind();
    return [
      SyntaxKind.IfStatement,
      SyntaxKind.ConditionalExpression,
      SyntaxKind.SwitchStatement,
    ].includes(kind);
  }

  private isPrologue(node: Node): boolean {
    // Пропускаем комментарии и директивы
    const kind = node.getKind();
    return (
      kind === SyntaxKind.ShebangTrivia ||
      kind === SyntaxKind.SingleLineCommentTrivia ||
      kind === SyntaxKind.MultiLineCommentTrivia ||
      kind === SyntaxKind.Decorator
    );
  }

  private intersect<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of set1) {
      if (set2.has(item)) result.add(item);
    }
    return result;
  }

  private setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }
}
