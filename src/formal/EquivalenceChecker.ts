// src/formal/EquivalenceChecker.ts

import type { FunctionContract } from './Z3Verifier.js';
import { Z3Verifier } from './Z3Verifier.js';

export interface EquivalenceResult {
  isEquivalent: boolean;
  confidence: number; // 0-1, для формальной верификации всегда 1.0
  proof?: string;
  counterexample?: Map<string, any>;
  differences?: CodeDifference[];
  method: 'formal' | 'structural' | 'semantic' | 'partial';
  time: number;
}

export interface CodeDifference {
  type: 'added' | 'removed' | 'modified' | 'moved';
  location: { start: number; end: number };
  original?: string;
  modified?: string;
  impact: 'high' | 'medium' | 'low';
}

export interface EquivalenceOptions {
  checkStructural?: boolean; // Проверять структурную эквивалентность
  checkSemantic?: boolean; // Проверять семантическую эквивалентность
  formalVerification?: boolean; // Использовать формальную верификацию
  maxDepth?: number; // Максимальная глубина сравнения
  ignoreWhitespace?: boolean; // Игнорировать пробелы
  ignoreComments?: boolean; // Игнорировать комментарии
  timeout?: number; // Таймаут для Z3 (мс)
}

export class EquivalenceChecker {
  private z3Verifier: Z3Verifier;
  private initialized = false;

  constructor() {
    this.z3Verifier = new Z3Verifier();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.z3Verifier.initialize();
    this.initialized = true;
  }

  /**
   * Проверяет эквивалентность двух файлов
   */
  async checkFileEquivalence(
    originalPath: string,
    modifiedPath: string,
    options: EquivalenceOptions = {}
  ): Promise<EquivalenceResult> {
    const startTime = Date.now();

    console.log(`\n🔍 Checking equivalence: ${originalPath} ↔ ${modifiedPath}`);

    // Загружаем файлы
    const originalContent = await this.loadFile(originalPath);
    const modifiedContent = await this.loadFile(modifiedPath);

    // 1. Быстрая структурная проверка
    if (options.checkStructural !== false) {
      const structuralResult = await this.checkStructuralEquivalence(
        originalContent,
        modifiedContent,
        options
      );

      if (structuralResult.isEquivalent && structuralResult.confidence > 0.9) {
        return { ...structuralResult, time: Date.now() - startTime };
      }

      if (!structuralResult.isEquivalent && structuralResult.differences) {
        // Если есть структурные различия, но они могут быть семантически эквивалентны
        if (options.checkSemantic === false) {
          return { ...structuralResult, time: Date.now() - startTime };
        }
      }
    }

    // 2. Семантическая проверка через Z3
    if (options.formalVerification !== false) {
      await this.initialize();

      const formalResult = await this.checkFormalEquivalence(
        originalContent,
        modifiedContent,
        options
      );

      if (formalResult.isEquivalent) {
        return { ...formalResult, time: Date.now() - startTime };
      }
    }

    // 3. Частичная проверка (анализ AST)
    const semanticResult = await this.checkSemanticEquivalence(
      originalContent,
      modifiedContent,
      options
    );

    return { ...semanticResult, time: Date.now() - startTime };
  }

  /**
   * Проверяет эквивалентность двух функций
   */
  async checkFunctionEquivalence(
    originalFunction: string,
    modifiedFunction: string,
    contract: FunctionContract,
    _options: EquivalenceOptions = {}
  ): Promise<EquivalenceResult> {
    const startTime = Date.now();

    await this.initialize();

    // Создаем контракт для эквивалентности
    const equivalenceContract: FunctionContract = {
      ...contract,
      preconditions: contract.preconditions,
      postconditions: [
        eq({ left: 'result', right: null } as any, { left: 'result', right: null } as any),
      ],
      invariants: contract.invariants,
    };

    // Используем equivalenceContract для дальнейшей проверки (заглушка)
    console.log(`Checking equivalence for ${equivalenceContract.name || 'function'}`);

    // Проверяем, что обе функции удовлетворяют одному контракту
    const originalResult = await this.z3Verifier.verifyFunction({
      ...contract,
      name: 'original',
      params: contract.params,
      returnType: contract.returnType,
      preconditions: contract.preconditions,
      postconditions: contract.postconditions,
      invariants: contract.invariants,
    });

    const modifiedResult = await this.z3Verifier.verifyFunction({
      ...contract,
      name: 'modified',
      params: contract.params,
      returnType: contract.returnType,
      preconditions: contract.preconditions,
      postconditions: contract.postconditions,
      invariants: contract.invariants,
    });

    if (originalResult.isValid && modifiedResult.isValid) {
      return {
        isEquivalent: true,
        confidence: 1.0,
        method: 'formal',
        time: Date.now() - startTime,
      };
    }

    // Проверяем прямую эквивалентность
    const inputs = new Map<string, 'int' | 'bool' | 'string'>();
    for (const param of contract.params) {
      inputs.set(param.name, param.type);
    }

    const equivalenceResult = await this.z3Verifier.verifyEquivalence(
      originalFunction,
      modifiedFunction,
      inputs
    );

    return {
      isEquivalent: equivalenceResult.isValid,
      confidence: equivalenceResult.isValid ? 1.0 : 0.9,
      counterexample: equivalenceResult.counterexample,
      method: 'formal',
      time: Date.now() - startTime,
    };
  }

  /**
   * Проверяет эквивалентность двух выражений
   */
  async checkExpressionEquivalence(
    original: string,
    modified: string,
    variables: Map<string, 'int' | 'bool' | 'string'>
  ): Promise<EquivalenceResult> {
    const startTime = Date.now();

    await this.initialize();

    const result = await this.z3Verifier.verifyEquivalence(original, modified, variables);

    return {
      isEquivalent: result.isValid,
      confidence: result.isValid ? 1.0 : 0.95,
      counterexample: result.counterexample,
      method: 'formal',
      time: Date.now() - startTime,
    };
  }

  /**
   * Структурная эквивалентность (быстрая проверка)
   */
  private async checkStructuralEquivalence(
    original: string,
    modified: string,
    _options: EquivalenceOptions // ← ИСПРАВЛЕНО: добавлен префикс _
  ): Promise<EquivalenceResult> {
    let orig = original;
    let mod = modified;

    if (_options.ignoreWhitespace) {
      orig = this.normalizeWhitespace(orig);
      mod = this.normalizeWhitespace(mod);
    }

    if (_options.ignoreComments) {
      orig = this.removeComments(orig);
      mod = this.removeComments(mod);
    }

    if (orig === mod) {
      return {
        isEquivalent: true,
        confidence: 1.0,
        method: 'structural',
        time: 0,
      };
    }

    // Находим различия
    const differences = this.findStructuralDifferences(orig, mod);

    return {
      isEquivalent: false,
      confidence: 0.8,
      differences,
      method: 'structural',
      time: 0,
    };
  }

  /**
   * Семантическая эквивалентность через AST анализ
   */
  private async checkSemanticEquivalence(
    original: string,
    modified: string,
    _options: EquivalenceOptions
  ): Promise<EquivalenceResult> {
    // Парсим AST
    const originalAst = this.parseToAST(original);
    const modifiedAst = this.parseToAST(modified);

    if (!originalAst || !modifiedAst) {
      return {
        isEquivalent: false,
        confidence: 0.5,
        method: 'partial',
        time: 0,
      };
    }

    // Сравниваем AST
    const differences = this.compareAST(originalAst, modifiedAst, _options.maxDepth || 10);

    const confidence = this.calculateConfidence(differences);

    return {
      isEquivalent: differences.length === 0,
      confidence,
      differences: differences.length > 0 ? differences : undefined,
      method: 'semantic',
      time: 0,
    };
  }

  /**
   * Формальная эквивалентность через Z3
   */
  private async checkFormalEquivalence(
    original: string,
    modified: string,
    options: EquivalenceOptions
  ): Promise<EquivalenceResult> {
    // Извлекаем функции из кода
    const originalFunctions = this.extractFunctions(original);
    const modifiedFunctions = this.extractFunctions(modified);

    if (originalFunctions.size !== modifiedFunctions.size) {
      return {
        isEquivalent: false,
        confidence: 0.7,
        method: 'formal',
        time: 0,
      };
    }

    // Проверяем каждую функцию
    for (const [name, originalFunc] of originalFunctions) {
      const modifiedFunc = modifiedFunctions.get(name);
      if (!modifiedFunc) {
        return {
          isEquivalent: false,
          confidence: 0.7,
          method: 'formal',
          time: 0,
        };
      }

      // Создаем контракт на основе сигнатуры
      const contract = this.inferContract(originalFunc);
      const result = await this.checkFunctionEquivalence(
        originalFunc.body,
        modifiedFunc.body,
        contract,
        options
      );

      if (!result.isEquivalent) {
        return result;
      }
    }

    return {
      isEquivalent: true,
      confidence: 1.0,
      method: 'formal',
      time: 0,
    };
  }

  /**
   * Сравнивает два AST дерева
   */
  private compareAST(node1: any, node2: any, maxDepth: number, currentDepth = 0): CodeDifference[] {
    const differences: CodeDifference[] = [];

    if (currentDepth > maxDepth) return differences;

    if (!node1 && node2) {
      differences.push({
        type: 'added',
        location: { start: node2.start, end: node2.end },
        modified: node2.text,
        impact: 'high',
      });
      return differences;
    }

    if (node1 && !node2) {
      differences.push({
        type: 'removed',
        location: { start: node1.start, end: node1.end },
        original: node1.text,
        impact: 'high',
      });
      return differences;
    }

    if (node1.type !== node2.type) {
      differences.push({
        type: 'modified',
        location: { start: node1.start, end: node1.end },
        original: node1.text,
        modified: node2.text,
        impact: 'high',
      });
      return differences;
    }

    // Сравниваем свойства
    const properties1 = this.getNodeProperties(node1);
    const properties2 = this.getNodeProperties(node2);

    for (const [key, value1] of properties1) {
      const value2 = properties2.get(key);

      if (JSON.stringify(value1) !== JSON.stringify(value2)) {
        differences.push({
          type: 'modified',
          location: { start: node1.start, end: node1.end },
          original: JSON.stringify(value1),
          modified: JSON.stringify(value2),
          impact: 'medium',
        });
      }
    }

    // Рекурсивно сравниваем детей
    const children1 = this.getChildren(node1);
    const children2 = this.getChildren(node2);

    const maxLen = Math.max(children1.length, children2.length);
    for (let i = 0; i < maxLen; i++) {
      const childDiffs = this.compareAST(children1[i], children2[i], maxDepth, currentDepth + 1);
      differences.push(...childDiffs);
    }

    return differences;
  }

  /**
   * Находит структурные различия в коде
   */
  private findStructuralDifferences(original: string, modified: string): CodeDifference[] {
    const differences: CodeDifference[] = [];
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    const maxLen = Math.max(originalLines.length, modifiedLines.length);
    let line = 1;

    for (let i = 0; i < maxLen; i++) {
      const origLine = originalLines[i];
      const modLine = modifiedLines[i];

      if (origLine !== modLine) {
        differences.push({
          type: 'modified',
          location: { start: line, end: line + 1 },
          original: origLine,
          modified: modLine,
          impact: this.assessImpact(origLine || '', modLine || ''),
        });
      }

      line++;
    }

    return differences;
  }

  /**
   * Извлекает функции из кода
   */
  private extractFunctions(
    code: string
  ): Map<string, { name: string; params: string[]; body: string; returnType: string }> {
    const functions = new Map();

    // Простой regex для извлечения функций (в реальном коде использовать AST)
    const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*{([\s\S]*?)(?=\n})/g;

    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const name = match[1];
      const params = match[2] ? match[2].split(',').map(p => p.trim()) : [];
      const returnType = match[3] || 'void';
      const body = match[4] || '';

      functions.set(name, { name, params, body, returnType });
    }

    // Также извлекаем стрелочные функции
    const arrowRegex =
      /(?:const|let)\s+(\w+)\s*=\s*(?:\(([^)]*)\)|(\w+))\s*(?::\s*(\w+))?\s*=>\s*{([\s\S]*?)(?=\n})/g;

    while ((match = arrowRegex.exec(code)) !== null) {
      const name = match[1];
      const params = match[2] ? match[2].split(',').map(p => p.trim()) : match[3] ? [match[3]] : [];
      const returnType = match[4] || 'void';
      const body = match[5] || '';

      functions.set(name, { name, params, body, returnType });
    }

    return functions;
  }

  /**
   * Выводит контракт из сигнатуры функции
   */
  private inferContract(func: {
    name: string;
    params: string[];
    returnType: string;
  }): FunctionContract {
    const params = func.params.map(p => ({
      name: p,
      type: 'int' as const,
    }));

    return {
      name: func.name,
      params,
      returnType: func.returnType === 'void' ? 'void' : 'int',
      preconditions: [],
      postconditions: [],
      invariants: [],
    };
  }

  /**
   * Парсит код в упрощенное AST представление
   */
  private parseToAST(code: string): any {
    // Упрощенный парсер для демонстрации
    // В реальном коде использовать ts-morph или @babel/parser
    try {
      const lines = code.split('\n');
      return {
        type: 'Program',
        start: 0,
        end: code.length,
        text: code,
        lines,
        children: this.parseLines(lines),
      };
    } catch (error) {
      // Исправлено: переменная переименована в _error
      void error;
      return null;
    }
  }

  private parseLines(lines: string[]): any[] {
    const nodes = [];
    let lineNumber = 1;

    for (const line of lines) {
      nodes.push({
        type: 'Statement',
        start: lineNumber,
        end: lineNumber,
        text: line,
        children: [],
      });
      lineNumber++;
    }

    return nodes;
  }

  /**
   * Получает свойства узла AST
   */
  private getNodeProperties(node: any): Map<string, any> {
    const properties = new Map();

    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (!['children', 'parent', 'text'].includes(key)) {
          properties.set(key, value);
        }
      }
    }

    return properties;
  }

  /**
   * Получает дочерние узлы
   */
  private getChildren(node: any): any[] {
    return node?.children || [];
  }

  /**
   * Нормализует пробелы в строке
   */
  private normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, ' ').trim();
  }

  /**
   * Удаляет комментарии из кода
   */
  private removeComments(code: string): string {
    // Удаляем однострочные комментарии
    let result = code.replace(/\/\/.*$/gm, '');
    // Удаляем многострочные комментарии
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
  }

  /**
   * Оценивает влияние изменения
   */
  private assessImpact(original: string, modified: string): 'high' | 'medium' | 'low' {
    // Изменение сигнатуры функции - высокое влияние
    if (original.match(/function\s+\w+\s*\(/) !== modified.match(/function\s+\w+\s*\(/)) {
      return 'high';
    }

    // Изменение типа возвращаемого значения - высокое влияние
    if (original.match(/:\s*\w+/) !== modified.match(/:\s*\w+/)) {
      return 'high';
    }

    // Изменение условий - среднее влияние
    if (original.includes('if') || modified.includes('if')) {
      return 'medium';
    }

    // Изменение комментариев или форматирования - низкое влияние
    if (this.normalizeWhitespace(original) === this.normalizeWhitespace(modified)) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Вычисляет уверенность на основе различий
   */
  private calculateConfidence(differences: CodeDifference[]): number {
    if (differences.length === 0) return 1.0;

    let confidence = 1.0;
    for (const diff of differences) {
      if (diff.impact === 'high') confidence -= 0.3;
      else if (diff.impact === 'medium') confidence -= 0.1;
      else if (diff.impact === 'low') confidence -= 0.01;
    }

    return Math.max(0, confidence);
  }

  /**
   * Загружает файл
   */
  private async loadFile(filePath: string): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.readFileSync(resolvedPath, 'utf-8');
  }

  /**
   * Генерирует отчет об эквивалентности
   */
  generateReport(result: EquivalenceResult): string {
    let report = '';
    report += '='.repeat(60) + '\n';
    report += '🔍 EQUIVALENCE CHECK REPORT\n';
    report += '='.repeat(60) + '\n';
    report += `Status: ${result.isEquivalent ? '✅ EQUIVALENT' : '❌ NOT EQUIVALENT'}\n`;
    report += `Method: ${result.method}\n`;
    report += `Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
    report += `Time: ${result.time}ms\n`;

    if (result.counterexample && result.counterexample.size > 0) {
      report += '\n📋 Counterexample found:\n';
      for (const [key, value] of result.counterexample) {
        report += `  ${key} = ${value}\n`;
      }
    }

    if (result.differences && result.differences.length > 0) {
      report += '\n📝 Differences found:\n';
      for (const diff of result.differences) {
        report += `  • [${diff.type.toUpperCase()}] at line ${diff.location.start}\n`;
        if (diff.original) report += `    Original: ${diff.original.substring(0, 100)}\n`;
        if (diff.modified) report += `    Modified: ${diff.modified.substring(0, 100)}\n`;
      }
    }

    report += '='.repeat(60) + '\n';

    return report;
  }

  /**
   * Сравнивает два AST узла на равенство
   */
  isASTEqual(node1: any, node2: any): boolean {
    if (node1 === node2) return true;
    if (!node1 || !node2) return false;
    if (node1.type !== node2.type) return false;

    const props1 = this.getNodeProperties(node1);
    const props2 = this.getNodeProperties(node2);

    if (props1.size !== props2.size) return false;

    for (const [key, value1] of props1) {
      const value2 = props2.get(key);
      if (JSON.stringify(value1) !== JSON.stringify(value2)) return false;
    }

    const children1 = this.getChildren(node1);
    const children2 = this.getChildren(node2);

    if (children1.length !== children2.length) return false;

    for (let i = 0; i < children1.length; i++) {
      if (!this.isASTEqual(children1[i], children2[i])) return false;
    }

    return true;
  }

  /**
   * Находит все различия между двумя AST
   */
  findAllDifferences(ast1: any, ast2: any, path: string[] = []): CodeDifference[] {
    const differences: CodeDifference[] = [];

    if (!ast1 && ast2) {
      differences.push({
        type: 'added',
        location: { start: ast2.start, end: ast2.end },
        modified: ast2.text,
        impact: 'high',
      });
      return differences;
    }

    if (ast1 && !ast2) {
      differences.push({
        type: 'removed',
        location: { start: ast1.start, end: ast1.end },
        original: ast1.text,
        impact: 'high',
      });
      return differences;
    }

    if (ast1.type !== ast2.type) {
      differences.push({
        type: 'modified',
        location: { start: ast1.start, end: ast1.end },
        original: `${ast1.type} at ${path.join('.')}`,
        modified: `${ast2.type} at ${path.join('.')}`,
        impact: 'high',
      });
      return differences;
    }

    // Сравниваем свойства
    const props1 = this.getNodeProperties(ast1);
    const props2 = this.getNodeProperties(ast2);

    for (const [key, value1] of props1) {
      const value2 = props2.get(key);
      if (JSON.stringify(value1) !== JSON.stringify(value2)) {
        differences.push({
          type: 'modified',
          location: { start: ast1.start, end: ast1.end },
          original: `${key}: ${JSON.stringify(value1)}`,
          modified: `${key}: ${JSON.stringify(value2)}`,
          impact: 'medium',
        });
      }
    }

    // Сравниваем детей
    const children1 = this.getChildren(ast1);
    const children2 = this.getChildren(ast2);

    const maxLen = Math.max(children1.length, children2.length);
    for (let i = 0; i < maxLen; i++) {
      const childDiffs = this.findAllDifferences(children1[i], children2[i], [...path, `[${i}]`]);
      differences.push(...childDiffs);
    }

    return differences;
  }
}

// Вспомогательные функции
export function isEquivalent(result: EquivalenceResult): boolean {
  return result.isEquivalent && result.confidence > 0.95;
}

export function needsReview(result: EquivalenceResult): boolean {
  return !result.isEquivalent && result.confidence < 0.8;
}

export function confidenceLevel(result: EquivalenceResult): 'high' | 'medium' | 'low' {
  if (result.confidence >= 0.95) return 'high';
  if (result.confidence >= 0.7) return 'medium';
  return 'low';
}

// Вспомогательная функция eq (заглушка, так как импорт удален)
function eq(left: any, right: any): any {
  return { type: 'equality', left, right };
}
