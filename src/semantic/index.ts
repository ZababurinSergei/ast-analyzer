// Directory/ast-analyzer/src/semantic/index.ts

/**
 * Семантический анализ для AST Analyzer
 *
 * Этот модуль предоставляет унифицированный интерфейс для всех семантических анализаторов:
 * - CFG (Control Flow Graph) - анализ потока управления
 * - Call Graph - анализ графа вызовов
 * - Type Analysis - анализ типов TypeScript
 * - Data Flow Analysis - анализ потока данных
 *
 * @module semantic
 */

// ============================================
// ЭКСПОРТ АНАЛИЗАТОРОВ
// ============================================

// 1. CFG Analyzer - анализ потока управления через ts-morph
export { CFGAnalyzer, type BasicBlock, type ControlFlowGraph } from './CFGAnalyzer.js';

// 2. Call Graph Analyzer - анализ графа вызовов через @codeflow-map/core
export { CallGraphAnalyzer, type CallGraphNode, type CallGraph } from './CallGraphAnalyzer.js';

// 3. Type Analyzer - анализ типов TypeScript через @jitl/ts-simple-type
export {
  TypeAnalyzer,
  type TypeInfo,
  type TypeAnalysisResult,
  type TypeError,
} from './TypeAnalyzer.js';

// 4. Data Flow Analyzer - анализ потока данных через @hpcc-js/dataflow
export {
  DataFlowAnalyzer,
  type DataFlowNode,
  type DataFlowEdge,
  type DataFlowGraph,
} from './DataFlowAnalyzer.js';

// ============================================
// ЕДИНЫЙ ФАСАД ДЛЯ СЕМАНТИЧЕСКОГО АНАЛИЗА
// ============================================

import type { SourceFile } from 'ts-morph';
import type { ControlFlowGraph } from './CFGAnalyzer.js';
import { CFGAnalyzer } from './CFGAnalyzer.js';
import type { CallGraph } from './CallGraphAnalyzer.js';
import { CallGraphAnalyzer } from './CallGraphAnalyzer.js';
import type { TypeAnalysisResult } from './TypeAnalyzer.js';
import { TypeAnalyzer } from './TypeAnalyzer.js';
import type { DataFlowGraph } from './DataFlowAnalyzer.js';
import { DataFlowAnalyzer } from './DataFlowAnalyzer.js';

export interface SemanticAnalysisOptions {
  /** Максимальная глубина анализа call graph */
  maxDepth?: number;
  /** Включить формальную верификацию (требует Z3) */
  formalVerification?: boolean;
  /** Критические функции для верификации */
  criticalFunctions?: string[];
  /** Анализировать типы */
  enableTypeAnalysis?: boolean;
  /** Анализировать поток данных */
  enableDataFlow?: boolean;
  /** Анализировать поток управления */
  enableCFG?: boolean;
  /** Анализировать граф вызовов */
  enableCallGraph?: boolean;
}

export interface SemanticAnalysisResult {
  /** CFG результат */
  cfg?: ControlFlowGraph;
  /** Call Graph результат */
  callGraph?: CallGraph;
  /** Type Analysis результат */
  typeAnalysis?: TypeAnalysisResult;
  /** Data Flow результат */
  dataFlow?: DataFlowGraph;
  /** Общая статистика */
  stats: {
    totalFunctions: number;
    totalVariables: number;
    cyclomaticComplexity: number;
    unusedFunctions: number;
    unusedVariables: number;
    typeErrors: number;
    dataFlowIssues: number;
  };
  /** Проблемы, найденные в ходе анализа */
  issues: SemanticIssue[];
  /** Время выполнения (мс) */
  duration: number;
}

export interface SemanticIssue {
  type:
    | 'unused_function'
    | 'unused_variable'
    | 'unreachable_code'
    | 'type_error'
    | 'data_flow_error'
    | 'cyclic_dependency';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
  fixable: boolean;
}

/**
 * Единый фасад для семантического анализа
 * Объединяет все анализаторы в один удобный интерфейс
 */
export class SemanticAnalyzer {
  private cfgAnalyzer: CFGAnalyzer;
  private callGraphAnalyzer: CallGraphAnalyzer;
  private dataFlowAnalyzer: DataFlowAnalyzer;

  constructor() {
    this.cfgAnalyzer = new CFGAnalyzer();
    this.callGraphAnalyzer = new CallGraphAnalyzer();
    this.dataFlowAnalyzer = new DataFlowAnalyzer();
  }

  /**
   * Выполнить полный семантический анализ файла
   */
  async analyze(
    sourceFile: SourceFile,
    options: SemanticAnalysisOptions = {}
  ): Promise<SemanticAnalysisResult> {
    const startTime = Date.now();
    const issues: SemanticIssue[] = [];

    const {
      enableCFG = true,
      enableCallGraph = true,
      enableTypeAnalysis = true,
      enableDataFlow = true,
      maxDepth = 5,
    } = options;

    // Параллельный анализ (если возможно)
    const results = await Promise.all([
      enableCFG ? this.analyzeCFG(sourceFile, issues) : Promise.resolve(null),
      enableCallGraph ? this.analyzeCallGraph(sourceFile, issues, maxDepth) : Promise.resolve(null),
      enableTypeAnalysis ? this.analyzeTypes(sourceFile, issues) : Promise.resolve(null),
      enableDataFlow ? this.analyzeDataFlow(sourceFile, issues) : Promise.resolve(null),
    ]);

    const [cfg, callGraph, typeAnalysis, dataFlow] = results;

    // Собираем статистику
    const stats = this.collectStats(cfg, callGraph, dataFlow, issues);

    return {
      cfg: cfg || undefined,
      callGraph: callGraph || undefined,
      typeAnalysis: typeAnalysis || undefined,
      dataFlow: dataFlow || undefined,
      stats,
      issues,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Анализ потока управления (CFG)
   */
  private async analyzeCFG(
    sourceFile: SourceFile,
    issues: SemanticIssue[]
  ): Promise<ControlFlowGraph> {
    const cfg = this.cfgAnalyzer.build(sourceFile);

    // Находим недостижимые блоки
    const unreachableBlocks = cfg.findUnreachableBlocks();
    for (const block of unreachableBlocks) {
      const firstInst = block.instructions[0];
      if (firstInst) {
        issues.push({
          type: 'unreachable_code',
          severity: 'warning',
          file: sourceFile.getFilePath(),
          line: firstInst.getStartLineNumber(),
          message: 'Unreachable code detected',
          suggestion: 'Remove or refactor this code block',
          fixable: true,
        });
      }
    }

    // Находим циклы
    const loops = cfg.findLoops();
    for (const loop of loops) {
      if (loop.body.length > 20) {
        issues.push({
          type: 'unreachable_code',
          severity: 'info',
          file: sourceFile.getFilePath(),
          line: loop.header.instructions[0]?.getStartLineNumber() || 1,
          message: `Large loop detected with ${loop.body.length} blocks`,
          suggestion: 'Consider refactoring to reduce complexity',
          fixable: false,
        });
      }
    }

    return cfg;
  }

  /**
   * Анализ графа вызовов
   */
  private async analyzeCallGraph(
    sourceFile: SourceFile,
    issues: SemanticIssue[],
    maxDepth: number
  ): Promise<CallGraph> {
    const callGraph = await this.callGraphAnalyzer.analyze(sourceFile.getFilePath(), maxDepth);

    // Находим неиспользуемые функции
    const unusedFunctions = callGraph.findUnusedFunctions();
    for (const func of unusedFunctions) {
      issues.push({
        type: 'unused_function',
        severity: 'warning',
        file: func.file,
        line: func.line,
        message: `Function '${func.name}' is never used`,
        suggestion: func.isExported ? 'Remove export or use the function' : 'Remove the function',
        fixable: true,
      });
    }

    // Находим циклические зависимости
    const cycles = callGraph.findCyclicDependencies();
    for (const cycle of cycles) {
      const cycleStr = cycle.map(e => `${e.from} → ${e.to}`).join(' → ');
      issues.push({
        type: 'cyclic_dependency',
        severity: 'error',
        file: sourceFile.getFilePath(),
        line: 1,
        message: `Cyclic dependency detected: ${cycleStr}`,
        suggestion: 'Refactor to break the cycle using dependency inversion',
        fixable: false,
      });
    }

    return callGraph;
  }

  /**
   * Анализ типов TypeScript
   */
  private async analyzeTypes(
    sourceFile: SourceFile,
    issues: SemanticIssue[]
  ): Promise<TypeAnalysisResult> {
    const typeAnalyzer = new TypeAnalyzer(sourceFile.getFilePath());
    const typeAnalysis = typeAnalyzer.analyze();
    const typeErrors = typeAnalysis.findTypeErrors();

    for (const error of typeErrors) {
      issues.push({
        type: 'type_error',
        severity: 'error',
        file: sourceFile.getFilePath(),
        line: error.location.line,
        column: error.location.column,
        message: `Type mismatch: expected ${error.expected}, got ${error.actual}`,
        suggestion: `Change type to ${error.expected} or use type assertion`,
        fixable: true,
      });
    }

    return typeAnalysis;
  }

  /**
   * Анализ потока данных
   */
  private async analyzeDataFlow(
    sourceFile: SourceFile,
    issues: SemanticIssue[]
  ): Promise<DataFlowGraph> {
    const dataFlow = this.dataFlowAnalyzer.analyze(sourceFile);

    // Находим неиспользуемые переменные
    const unusedVars = dataFlow.findUnusedVariables();
    for (const varNode of unusedVars) {
      issues.push({
        type: 'unused_variable',
        severity: 'info',
        file: sourceFile.getFilePath(),
        line: varNode.line,
        column: varNode.column,
        message: `Variable '${varNode.name}' is declared but never used`,
        suggestion: 'Remove the variable or use it',
        fixable: true,
      });
    }

    // Находим переопределенные константы
    const reassignedConsts = dataFlow.findReassignedConstants();
    for (const constNode of reassignedConsts) {
      issues.push({
        type: 'data_flow_error',
        severity: 'error',
        file: sourceFile.getFilePath(),
        line: constNode.line,
        column: constNode.column,
        message: `Constant '${constNode.name}' is reassigned`,
        suggestion: 'Use let instead of const or remove reassignment',
        fixable: true,
      });
    }

    return dataFlow;
  }

  /**
   * Сбор общей статистики
   */
  private collectStats(
    cfg: ControlFlowGraph | null,
    callGraph: CallGraph | null,
    dataFlow: DataFlowGraph | null,
    issues: SemanticIssue[]
  ): SemanticAnalysisResult['stats'] {
    // Вычисляем цикломатическую сложность
    let cyclomaticComplexity = 0;
    if (cfg) {
      const nodes = cfg.blocks.length;
      let edges = 0;
      for (const block of cfg.blocks) {
        edges += block.successors.length;
      }
      cyclomaticComplexity = edges - nodes + 2;
    }

    return {
      totalFunctions: callGraph?.nodes.size || 0,
      totalVariables: dataFlow?.nodes.filter(n => n.type === 'variable').length || 0,
      cyclomaticComplexity,
      unusedFunctions: issues.filter(i => i.type === 'unused_function').length,
      unusedVariables: issues.filter(i => i.type === 'unused_variable').length,
      typeErrors: issues.filter(i => i.type === 'type_error').length,
      dataFlowIssues: issues.filter(i => i.type === 'data_flow_error').length,
    };
  }
}

// ============================================
// УТИЛИТЫ ДЛЯ СЕМАНТИЧЕСКОГО АНАЛИЗА
// ============================================

/**
 * Быстрый семантический анализ файла (без детальных отчетов)
 */
export async function quickSemanticAnalysis(
  sourceFile: SourceFile
): Promise<Pick<SemanticAnalysisResult, 'stats' | 'issues'>> {
  const analyzer = new SemanticAnalyzer();
  const result = await analyzer.analyze(sourceFile, {
    enableCFG: true,
    enableCallGraph: true,
    enableTypeAnalysis: true,
    enableDataFlow: true,
  });

  return {
    stats: result.stats,
    issues: result.issues,
  };
}

/**
 * Проверка только типов (быстрый режим)
 */
export async function typeCheckOnly(
  sourceFile: SourceFile
): Promise<Pick<SemanticAnalysisResult, 'typeAnalysis' | 'issues'>> {
  const analyzer = new SemanticAnalyzer();
  const result = await analyzer.analyze(sourceFile, {
    enableCFG: false,
    enableCallGraph: false,
    enableTypeAnalysis: true,
    enableDataFlow: false,
  });

  return {
    typeAnalysis: result.typeAnalysis,
    issues: result.issues.filter(i => i.type === 'type_error'),
  };
}

/**
 * Проверка только на неиспользуемый код
 */
export async function deadCodeCheck(
  sourceFile: SourceFile
): Promise<Pick<SemanticAnalysisResult, 'stats' | 'issues'>> {
  const analyzer = new SemanticAnalyzer();
  const result = await analyzer.analyze(sourceFile, {
    enableCFG: true,
    enableCallGraph: true,
    enableTypeAnalysis: false,
    enableDataFlow: true,
  });

  return {
    stats: {
      ...result.stats,
      totalFunctions: result.stats.totalFunctions,
      totalVariables: result.stats.totalVariables,
    },
    issues: result.issues.filter(
      i =>
        i.type === 'unused_function' ||
        i.type === 'unused_variable' ||
        i.type === 'unreachable_code'
    ),
  };
}

// ============================================
// ВЕРСИЯ МОДУЛЯ
// ============================================

export const SEMANTIC_MODULE_VERSION = '1.0.0';
export const SEMANTIC_MODULE_NAME = '@newkind/ast-analyzer/semantic';
