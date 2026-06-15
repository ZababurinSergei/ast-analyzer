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

  build(sourceFile: SourceFile): ControlFlowGraph {
    // 1. Разбиваем на базовые блоки
    this.buildBasicBlocks(sourceFile);

    // 2. Строим ребра
    this.buildEdges();

    // 3. Вычисляем доминаторы
    this.computeDominators();

    // 4. Находим циклы
    this.identifyLoops();

    // 5. Определяем достижимость
    this.computeReachability();

    return {
      blocks: Array.from(this.blocks.values()),
      entry: this.entryBlock!,
      exit: this.exitBlock!,
      findUnreachableBlocks: () => this.findUnreachable(),
      findLoops: () => this.getLoops(),
      getDominators: block => block.dominators || new Set(),
    };
  }

  private buildBasicBlocks(sourceFile: SourceFile): void {
    // Находим лидеров (начала блоков)
    const leaders = this.findLeaders(sourceFile);

    let currentBlock: BasicBlock | null = null;
    let currentInstructions: Node[] = [];

    // Обходим все узлы в порядке исходного кода
    for (const node of this.getOrderedNodes(sourceFile)) {
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
  }

  private findLeaders(sourceFile: SourceFile): Set<Node> {
    const leaders = new Set<Node>();

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
      // FinallyBlock не существует в SyntaxKind, используем TryStatement для анализа finally
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
    return leaders;
  }

  private buildEdges(): void {
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
  }

  private handleIfStatement(block: BasicBlock, node: Node): void {
    // Находим then и else ветки
    const thenBlock = this.findBlockContainingNode(node.getChildAtIndex?.(2));
    const elseBlock = this.findBlockContainingNode(node.getChildAtIndex?.(3));

    if (thenBlock) this.addEdge(block, thenBlock);
    if (elseBlock) this.addEdge(block, elseBlock);
  }

  private handleLoop(block: BasicBlock, node: Node): void {
    // Тело цикла
    const bodyBlock = this.findBlockContainingNode(node.getChildAtIndex?.(2));
    if (bodyBlock) this.addEdge(block, bodyBlock);

    // Выход из цикла
    const nextBlock = this.getNextBlock(block);
    if (nextBlock) this.addEdge(block, nextBlock);
  }

  private handleSwitch(block: BasicBlock, node: Node): void {
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
  }

  private handleTry(block: BasicBlock, node: Node): void {
    // try блок
    const tryBlock = this.findBlockContainingNode(node.getChildAtIndex?.(1));
    if (tryBlock) this.addEdge(block, tryBlock);

    // catch блок
    const catchBlock = this.findBlockContainingNode(node.getChildAtIndex?.(2));
    if (catchBlock) this.addEdge(block, catchBlock);

    // finally блок
    const finallyBlock = this.findBlockContainingNode(node.getChildAtIndex?.(3));
    if (finallyBlock) this.addEdge(block, finallyBlock);
  }

  private handleReturn(block: BasicBlock): void {
    if (this.exitBlock) {
      this.addEdge(block, this.exitBlock);
    }
  }

  private computeDominators(): void {
    const allBlocks = Array.from(this.blocks.values());

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
  }

  private identifyLoops(): void {
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
      id: `block_${Date.now()}_${Math.random()}`,
      instructions: [],
      successors: [],
      predecessors: [],
      isEntry: !this.entryBlock,
      isExit: false,
      isReachable: false,
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
    const children = sourceFile.getChildren();
    return children.find(c => !this.isPrologue(c));
  }

  private getOrderedNodes(sourceFile: SourceFile): Node[] {
    const nodes: Node[] = [];

    const collect = (node: Node) => {
      nodes.push(node);
      node.forEachChild(collect);
    };

    sourceFile.forEachChild(collect);
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
