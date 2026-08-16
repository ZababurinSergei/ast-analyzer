// src/formal/core/ASTComparator.ts
import { Project, Node } from 'ts-morph';

export interface ASTDifference {
  type: 'added' | 'removed' | 'modified' | 'moved' | 'semantic';
  location: { start: number; end: number; line?: number };
  original?: string;
  modified?: string;
  impact: 'high' | 'medium' | 'low';
  nodeKind?: string;
  nodeType?: string;
}

export interface ASTComparisonOptions {
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  maxDepth?: number;
  structuralOnly?: boolean;
}

export class ASTComparator {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        jsx: 2,
      },
      useInMemoryFileSystem: true,
    });
  }

  /**
   * Сравнивает два AST узла и возвращает различия
   */
  compareNodes(
    node1: Node | null,
    node2: Node | null,
    options: ASTComparisonOptions = {}
  ): { isEquivalent: boolean; differences: ASTDifference[]; confidence: number } {
    const differences: ASTDifference[] = [];

    if (!node1 && !node2) {
      return { isEquivalent: true, differences: [], confidence: 1 };
    }

    if (!node1) {
      differences.push({
        type: 'added',
        location: { start: 0, end: 0, line: 1 },
        original: 'null',
        modified: this.getNodeSummary(node2!),
        impact: 'high',
        nodeKind: node2?.getKindName(),
      });
      return { isEquivalent: false, differences, confidence: 0.5 };
    }

    if (!node2) {
      differences.push({
        type: 'removed',
        location: { start: 0, end: 0, line: 1 },
        original: this.getNodeSummary(node1),
        modified: 'null',
        impact: 'high',
        nodeKind: node1.getKindName(),
      });
      return { isEquivalent: false, differences, confidence: 0.5 };
    }

    // Проверка типа узла
    if (node1.getKind() !== node2.getKind()) {
      differences.push({
        type: 'modified',
        location: {
          start: node1.getStartLineNumber(),
          end: node1.getEndLineNumber(),
          line: node1.getStartLineNumber(),
        },
        original: node1.getKindName(),
        modified: node2.getKindName(),
        impact: 'high',
        nodeKind: node1.getKindName(),
      });
      return { isEquivalent: false, differences, confidence: 0.5 };
    }

    // Сравнение свойств
    const props1 = this.extractProperties(node1);
    const props2 = this.extractProperties(node2);

    for (const [key, value1] of props1) {
      const value2 = props2.get(key);
      if (value2 !== undefined && value1 !== value2) {
        if (this.shouldIgnore(key, value1, value2, options)) continue;

        differences.push({
          type: 'modified',
          location: {
            start: node1.getStartLineNumber(),
            end: node1.getEndLineNumber(),
            line: node1.getStartLineNumber(),
          },
          original: `${key}: ${value1}`,
          modified: `${key}: ${value2}`,
          impact: this.assessImpact(key, value1, value2),
          nodeType: key,
        });
        return { isEquivalent: false, differences, confidence: 0.8 };
      }
    }

    // Рекурсивное сравнение детей
    const children1 = node1.getChildren();
    const children2 = node2.getChildren();

    if (children1.length !== children2.length) {
      differences.push({
        type: 'modified',
        location: {
          start: node1.getStartLineNumber(),
          end: node1.getEndLineNumber(),
          line: node1.getStartLineNumber(),
        },
        original: `${children1.length} children`,
        modified: `${children2.length} children`,
        impact: 'medium',
        nodeType: 'children',
      });
      return { isEquivalent: false, differences, confidence: 0.7 };
    }

    for (let i = 0; i < children1.length; i++) {
      const child1 = children1[i];
      const child2 = children2[i];

      // Проверка на undefined
      if (!child1 && !child2) continue;
      if (!child1) {
        differences.push({
          type: 'added',
          location: { start: 0, end: 0, line: 1 },
          original: 'null',
          modified: this.getNodeSummary(child2!),
          impact: 'high',
          nodeKind: child2?.getKindName(),
        });
        return { isEquivalent: false, differences, confidence: 0.5 };
      }
      if (!child2) {
        differences.push({
          type: 'removed',
          location: { start: 0, end: 0, line: 1 },
          original: this.getNodeSummary(child1),
          modified: 'null',
          impact: 'high',
          nodeKind: child1.getKindName(),
        });
        return { isEquivalent: false, differences, confidence: 0.5 };
      }

      const childResult = this.compareNodes(child1, child2, options);
      if (!childResult.isEquivalent) {
        differences.push(...childResult.differences);
        return { isEquivalent: false, differences, confidence: childResult.confidence };
      }
    }

    return { isEquivalent: true, differences: [], confidence: 1 };
  }

  /**
   * Сравнивает два файла на уровне AST
   */
  compareFiles(
    file1Path: string,
    file2Path: string,
    options: ASTComparisonOptions = {}
  ): { isEquivalent: boolean; differences: ASTDifference[]; confidence: number } {
    const sourceFile1 = this.project.addSourceFileAtPath(file1Path);
    const sourceFile2 = this.project.addSourceFileAtPath(file2Path);

    if (!sourceFile1 && !sourceFile2) {
      return { isEquivalent: true, differences: [], confidence: 1 };
    }

    if (!sourceFile1) {
      return {
        isEquivalent: false,
        differences: [
          {
            type: 'added',
            location: { start: 0, end: 0, line: 1 },
            original: 'null',
            modified: 'file',
            impact: 'high',
            nodeType: 'file',
          },
        ],
        confidence: 0,
      };
    }

    if (!sourceFile2) {
      return {
        isEquivalent: false,
        differences: [
          {
            type: 'removed',
            location: { start: 0, end: 0, line: 1 },
            original: 'file',
            modified: 'null',
            impact: 'high',
            nodeType: 'file',
          },
        ],
        confidence: 0,
      };
    }

    const statements1 = sourceFile1.getStatements();
    const statements2 = sourceFile2.getStatements();

    if (statements1.length !== statements2.length) {
      return {
        isEquivalent: false,
        differences: [
          {
            type: 'modified',
            location: { start: 1, end: 1, line: 1 },
            original: `${statements1.length} statements`,
            modified: `${statements2.length} statements`,
            impact: 'high',
            nodeType: 'statements',
          },
        ],
        confidence: 0.5,
      };
    }

    const allDifferences: ASTDifference[] = [];
    let minConfidence = 1;

    for (let i = 0; i < statements1.length; i++) {
      const stmt1 = statements1[i];
      const stmt2 = statements2[i];

      // Проверка на undefined
      if (!stmt1 && !stmt2) continue;
      if (!stmt1) {
        allDifferences.push({
          type: 'added',
          location: { start: 0, end: 0, line: 1 },
          original: 'null',
          modified: this.getNodeSummary(stmt2!),
          impact: 'high',
          nodeKind: stmt2?.getKindName(),
        });
        minConfidence = Math.min(minConfidence, 0.5);
        continue;
      }
      if (!stmt2) {
        allDifferences.push({
          type: 'removed',
          location: { start: 0, end: 0, line: 1 },
          original: this.getNodeSummary(stmt1),
          modified: 'null',
          impact: 'high',
          nodeKind: stmt1.getKindName(),
        });
        minConfidence = Math.min(minConfidence, 0.5);
        continue;
      }

      const result = this.compareNodes(stmt1, stmt2, options);
      if (!result.isEquivalent) {
        allDifferences.push(...result.differences);
        minConfidence = Math.min(minConfidence, result.confidence);
      }
    }

    return {
      isEquivalent: allDifferences.length === 0,
      differences: allDifferences,
      confidence: minConfidence,
    };
  }

  /**
   * Извлекает ключевые свойства узла
   */
  private extractProperties(node: Node): Map<string, any> {
    const props = new Map<string, any>();

    try {
      // Базовые свойства
      props.set('kind', node.getKind());
      props.set('kindName', node.getKindName());
      props.set('text', node.getText());

      // Специфичные для разных типов узлов
      if (Node.isIdentifier(node)) {
        props.set('name', node.getText());
      }

      if (Node.isFunctionDeclaration(node)) {
        const name = node.getName();
        if (name) props.set('name', name);
        props.set('isAsync', node.isAsync());
        props.set('isExported', node.isExported());
        props.set('parameterCount', node.getParameters().length);
      }

      if (Node.isVariableDeclaration(node)) {
        props.set('name', node.getName());
        props.set('isExported', node.isExported());
        const initializer = node.getInitializer();
        if (initializer) props.set('hasInitializer', true);
      }

      if (Node.isClassDeclaration(node)) {
        const name = node.getName();
        if (name) props.set('name', name);
        props.set('isExported', node.isExported());
        props.set('methodCount', node.getMethods().length);
      }

      if (Node.isBinaryExpression(node)) {
        const operator = node.getOperatorToken();
        if (operator) props.set('operator', operator.getText());
      }
    } catch (error) {
      // Игнорируем ошибки
    }

    return props;
  }

  /**
   * Возвращает краткое описание узла
   */
  private getNodeSummary(node: Node): string {
    try {
      if (Node.isIdentifier(node)) return `Identifier: ${node.getText()}`;
      if (Node.isFunctionDeclaration(node)) {
        return `Function: ${node.getName() || 'anonymous'}`;
      }
      if (Node.isClassDeclaration(node)) {
        return `Class: ${node.getName() || 'anonymous'}`;
      }
      if (Node.isVariableDeclaration(node)) {
        return `Variable: ${node.getName()}`;
      }
      return node.getKindName();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Проверяет, нужно ли игнорировать различие
   */
  private shouldIgnore(
    key: string,
    value1: any,
    value2: any,
    options: ASTComparisonOptions
  ): boolean {
    if (options.ignoreWhitespace && typeof value1 === 'string' && typeof value2 === 'string') {
      return value1.replace(/\s/g, '') === value2.replace(/\s/g, '');
    }

    if (options.ignoreComments && typeof value1 === 'string' && typeof value2 === 'string') {
      const clean1 = value1.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const clean2 = value2.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      return clean1.trim() === clean2.trim();
    }

    // Игнорируем временные метки и позиции
    if (key === 'start' || key === 'end' || key === 'range') return true;

    return false;
  }

  /**
   * Оценивает важность изменения
   */
  private assessImpact(key: string, _value1: any, _value2: any): 'high' | 'medium' | 'low' {
    const highImpact = ['name', 'returnType', 'parameterCount', 'isAsync', 'isExported'];
    const mediumImpact = ['operator', 'parameterCount', 'methodCount'];

    if (highImpact.includes(key)) return 'high';
    if (mediumImpact.includes(key)) return 'medium';
    return 'low';
  }

  /**
   * Создает строковое представление для отчета
   */
  generateReport(differences: ASTDifference[]): string {
    if (differences.length === 0) {
      return '✅ ASTs are equivalent';
    }

    let report = '📋 AST Differences:\n';
    for (const diff of differences) {
      const icon = diff.impact === 'high' ? '🔴' : diff.impact === 'medium' ? '🟡' : '🟢';
      report += `  ${icon} [${diff.type}] at line ${diff.location.line || '?'}\n`;
      if (diff.original) report += `     Original: ${diff.original}\n`;
      if (diff.modified) report += `     Modified: ${diff.modified}\n`;
    }
    return report;
  }
}
