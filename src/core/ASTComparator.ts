// src/core/ASTComparator.ts
import { Project, Node } from 'ts-morph';

console.log('🔧 ASTComparator module loaded!'); // ⭐ Вывод при загрузке модуля

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
    console.log('🔧 ASTComparator constructor called!'); // ⭐ Вывод при создании экземпляра
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
    // ⭐ САМЫЙ ПЕРВЫЙ ВЫВОД
    console.log('\n🔍🔍🔍 ASTComparator.compareNodes CALLED! 🔍🔍🔍');
    console.log(`   node1: ${node1 ? node1.getKindName() : 'null'}`);
    console.log(`   node2: ${node2 ? node2.getKindName() : 'null'}`);

    const differences: ASTDifference[] = [];

    if (!node1 && !node2) {
      console.log('   ✅ Both nodes are null');
      return { isEquivalent: true, differences: [], confidence: 1 };
    }

    if (!node1) {
      console.log('   ❌ node1 is null');
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
      console.log('   ❌ node2 is null');
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

    console.log(`   📌 Node1 kind: ${node1.getKindName()}`);
    console.log(`   📌 Node2 kind: ${node2.getKindName()}`);
    console.log(`   📌 Node1 text (first 100 chars): ${node1.getText().substring(0, 100)}`);
    console.log(`   📌 Node2 text (first 100 chars): ${node2.getText().substring(0, 100)}`);

    // Проверка типа узла
    if (node1.getKind() !== node2.getKind()) {
      console.log(`   ❌ Kind mismatch: ${node1.getKindName()} vs ${node2.getKindName()}`);
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

    console.log(`   📋 Properties1: ${Array.from(props1.keys()).join(', ')}`);
    console.log(`   📋 Properties2: ${Array.from(props2.keys()).join(', ')}`);

    for (const [key, value1] of props1) {
      const value2 = props2.get(key);
      if (value2 !== undefined && value1 !== value2) {
        if (this.shouldIgnore(key, value1, value2, options)) {
          console.log(`      ⏭️ Ignoring property "${key}": "${value1}" vs "${value2}"`);
          continue;
        }

        console.log(`   ❌ Property mismatch: "${key}": "${value1}" vs "${value2}"`);
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

    console.log(`   👶 Children: ${children1.length} vs ${children2.length}`);

    if (children1.length !== children2.length) {
      console.log(`   ❌ Children count mismatch`);
      differences.push({
        type: 'modified',
        location: {
          start: node1.getStartLineNumber(),
          end: node1.getEndLineNumber(),
          line: node1.getStartLineNumber(),
        },
        original: `${children1.length} children`,
        modified: `${children2.length} children`,
        impact: 'high',
        nodeType: 'children',
      });
      return { isEquivalent: false, differences, confidence: 0.7 };
    }

    // Сравниваем каждого ребенка
    for (let i = 0; i < children1.length; i++) {
      const child1 = children1[i];
      const child2 = children2[i];

      if (!child1 && !child2) continue;
      if (!child1) {
        console.log(`   ❌ Child ${i} missing in first node`);
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
        console.log(`   ❌ Child ${i} missing in second node`);
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

      console.log(`      Child ${i}: ${child1.getKindName()} vs ${child2.getKindName()}`);
      console.log(`        Text1: "${child1.getText().substring(0, 30)}"`);
      console.log(`        Text2: "${child2.getText().substring(0, 30)}"`);

      // Проверяем, являются ли дети токенами операторов
      if (this.isOperatorToken(child1) && this.isOperatorToken(child2)) {
        const op1 = child1.getText();
        const op2 = child2.getText();
        console.log(`        ⚡ BOTH ARE OPERATOR TOKENS!`);
        console.log(`        ⚡ Operator1: "${op1}"`);
        console.log(`        ⚡ Operator2: "${op2}"`);

        if (op1 !== op2) {
          console.log(`        ❌ OPERATOR MISMATCH: "${op1}" vs "${op2}"`);
          differences.push({
            type: 'modified',
            location: {
              start: node1.getStartLineNumber(),
              end: node1.getEndLineNumber(),
              line: node1.getStartLineNumber(),
            },
            original: `operator: ${op1}`,
            modified: `operator: ${op2}`,
            impact: 'high',
            nodeType: 'operator',
            nodeKind: child1.getKindName(),
          });
          return { isEquivalent: false, differences, confidence: 0.9 };
        }
        continue;
      }

      // Для остальных узлов рекурсивно сравниваем
      const childResult = this.compareNodes(child1, child2, options);
      if (!childResult.isEquivalent) {
        differences.push(...childResult.differences);
        return { isEquivalent: false, differences, confidence: childResult.confidence };
      }
    }

    console.log(`   ✅ Nodes are equivalent`);
    return { isEquivalent: true, differences: [], confidence: 1 };
  }

  /**
   * Проверяет, является ли узел токеном оператора
   */
  private isOperatorToken(node: Node): boolean {
    if (!node) return false;
    const kind = node.getKind();
    const operatorKinds = new Set([
      39, // PlusToken (+)
      40, // MinusToken (-)
      41, // AsteriskToken (*)
      42, // SlashToken (/)
      43, // PercentToken (%)
      44, // PlusPlusToken (++)
      45, // MinusMinusToken (--)
      49, // AmpersandToken (&)
      50, // BarToken (|)
      51, // CaretToken (^)
      52, // ExclamationToken (!)
      53, // TildeToken (~)
      54, // AmpersandAmpersandToken (&&)
      55, // BarBarToken (||)
      58, // EqualsToken (=)
      70, // EqualsEqualsToken (==)
      71, // ExclamationEqualsToken (!=)
      72, // EqualsEqualsEqualsToken (===)
      73, // ExclamationEqualsEqualsToken (!==)
      74, // GreaterThanToken (>)
      75, // LessThanToken (<)
      76, // GreaterThanEqualsToken (>=)
      77, // LessThanEqualsToken (<=)
    ]);
    return operatorKinds.has(kind);
  }

  /**
   * Сравнивает два файла на уровне AST
   */
  compareFiles(
    file1Path: string,
    file2Path: string,
    options: ASTComparisonOptions = {}
  ): { isEquivalent: boolean; differences: ASTDifference[]; confidence: number } {
    console.log(`\n📁 compareFiles: ${file1Path} vs ${file2Path}`);
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

    console.log(`📄 Statements: ${statements1.length} vs ${statements2.length}`);

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
      props.set('kind', node.getKind());
      props.set('kindName', node.getKindName());
      props.set('text', node.getText());

      if (Node.isIdentifier(node)) {
        props.set('name', node.getText());
      }

      if (Node.isFunctionDeclaration(node)) {
        const name = node.getName();
        if (name) props.set('name', name);
        props.set('isAsync', node.isAsync());
        props.set('isExported', node.isExported());
        props.set('parameterCount', node.getParameters().length);
        const returnType = node.getReturnType();
        if (returnType) {
          props.set('returnType', returnType.getText());
        }
      }

      if (Node.isVariableDeclaration(node)) {
        props.set('name', node.getName());
        props.set('isExported', node.isExported());
        const initializer = node.getInitializer();
        if (initializer) {
          props.set('hasInitializer', true);
          props.set('initializerKind', initializer.getKindName());
        }
      }

      if (Node.isClassDeclaration(node)) {
        const name = node.getName();
        if (name) props.set('name', name);
        props.set('isExported', node.isExported());
        props.set('methodCount', node.getMethods().length);
      }

      if (Node.isArrowFunction(node)) {
        props.set('isAsync', node.isAsync());
        props.set('parameterCount', node.getParameters().length);
        const returnType = node.getReturnType();
        if (returnType) {
          props.set('returnType', returnType.getText());
        }
        props.set('hasBody', !!node.getBody());
      }

      if (Node.isMethodDeclaration(node)) {
        props.set('name', node.getName());
        props.set('isAsync', node.isAsync());
        props.set('parameterCount', node.getParameters().length);
        props.set('hasBody', !!node.getBody());
      }

      if (Node.isReturnStatement(node)) {
        const expr = node.getExpression();
        if (expr) {
          props.set('hasExpression', true);
          props.set('expressionKind', expr.getKindName());
        }
      }

      if (Node.isBinaryExpression(node)) {
        const left = node.getLeft();
        const right = node.getRight();
        if (left) {
          props.set('leftKind', left.getKindName());
        }
        if (right) {
          props.set('rightKind', right.getKindName());
        }
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
      if (this.isOperatorToken(node)) {
        return `Operator: ${node.getText()}`;
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

    if (key === 'start' || key === 'end' || key === 'range') return true;

    return false;
  }

  /**
   * Оценивает важность изменения
   */
  private assessImpact(key: string, _value1: any, _value2: any): 'high' | 'medium' | 'low' {
    const highImpact = [
      'name',
      'returnType',
      'parameterCount',
      'isAsync',
      'isExported',
      'operator',
    ];
    const mediumImpact = ['leftKind', 'rightKind', 'methodCount'];

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
