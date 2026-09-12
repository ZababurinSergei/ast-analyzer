// src/reporters/data-converter.ts

import type {
  FullAnalysis,
  ModuleGraphNode,
  ModuleGraphEdge,
  EntityGraphNode,
  EntityGraphEdge,
} from '../types.js';

// ============================================================
// ТИПЫ ДЛЯ PACKAGE-LOCK REPORTS
// ============================================================

export interface PackageLockFunctionInfo {
  name: string;
  params: string[];
  paramTypes: string[];
  line: number;
  startLine: number;
  endLine: number;
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  className?: string;
  calls: string[];
  calledBy: string[];
  returnType: string;
  body: string;
  isNested: boolean;
  parentFunction?: string;
  isArrow: boolean;
  isEventHandler: boolean;
  eventType?: string;
  depth: number;
}

export interface PackageLockEntityInfo {
  functions: PackageLockFunctionInfo[];
  constants: any[];
  variables: any[];
  interfaces: any[];
  types: any[];
  classes: any[];
}

export interface PackageLockPackage {
  version: string;
  resolved: string;
  displayPath?: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, any>;
  exports: Record<string, any>;
  entities: PackageLockEntityInfo;
  fileStats: {
    size: number;
    lines: number;
    functions: number;
    classes: number;
    constants: number;
    interfaces: number;
    types: number;
    variables: number;
  };
}

export interface PackageLockReport {
  name: string;
  version: string;
  lockfileVersion: number;
  packages: Record<string, PackageLockPackage>;
  dependencyGraph: {
    direction: 'bidirectional';
    inwardDependencies: Record<string, string[]>;
    outwardDependencies: Record<string, string[]>;
  };
  entityStats: {
    totalFunctions: number;
    totalConstants: number;
    totalVariables: number;
    totalInterfaces: number;
    totalTypes: number;
    totalClasses: number;
    totalCalls: number;
    totalExportedFunctions: number;
    totalAsyncFunctions: number;
  };
  fileStats: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  timestamp: string;
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ГАРАНТИИ МАССИВОВ
// ============================================================

/**
 * Гарантирует, что значение является массивом
 * Если это строка вида "[object Object]", преобразует в пустой массив
 */
function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ============================================================
// КОНВЕРТАЦИЯ ИЗ FULLANALYSIS В PACKAGELOCKREPORT
// ============================================================

export class DataConverter {
  /**
   * Преобразует ModuleNode в PackageLockPackage
   * ✅ ИСПРАВЛЕНО: гарантирует, что все сущности - массивы объектов
   */
  static convertModuleNodeToPackage(
    node: ModuleGraphNode,
    entityNodes: EntityGraphNode[],
    entityEdges: EntityGraphEdge[]
  ): PackageLockPackage {
    const callMap: Record<string, string[]> = {};
    const calledByMap: Record<string, string[]> = {};

    for (const edge of entityEdges) {
      if (edge.type === 'function_call' || edge.type === 'method_call') {
        const fromName = edge.from.split('#').pop() || edge.from;
        const toName = edge.to.split('#').pop() || edge.to;

        if (!callMap[fromName]) {
          callMap[fromName] = [];
        }
        callMap[fromName].push(toName);

        if (!calledByMap[toName]) {
          calledByMap[toName] = [];
        }
        calledByMap[toName].push(fromName);
      }
    }

    // ✅ ГАРАНТИРУЕМ, ЧТО entityNodes - МАССИВ
    const safeEntityNodes = ensureArray<EntityGraphNode>(entityNodes);

    // ✅ СОЗДАЕМ МАССИВ ОБЪЕКТОВ, А НЕ СТРОК
    const functions: PackageLockFunctionInfo[] = safeEntityNodes
      .filter((e: EntityGraphNode) => e.type === 'function')
      .map((e: EntityGraphNode) => ({
        name: e.name || '',
        params: e.metadata?.params || [],
        paramTypes: [],
        line: e.line || 0,
        startLine: e.metadata?.startLine || e.line || 0,
        endLine: e.metadata?.endLine || e.line || 0,
        isAsync: e.metadata?.isAsync || false,
        isExported: e.metadata?.isExported || false,
        isMethod: e.metadata?.isMethod || false,
        className: e.metadata?.className || '',
        calls: callMap[e.name] || [],
        calledBy: calledByMap[e.name] || [],
        returnType: e.metadata?.returnType || 'any',
        body: '',
        isNested: false,
        parentFunction: undefined,
        isArrow: false,
        isEventHandler: false,
        eventType: undefined,
        depth: 0,
      }));

    return {
      version: '1.0.0',
      resolved: `file:${node.id}`,
      displayPath: node.id,
      type: 'module',
      language: (node.metadata?.language as any) || 'typescript',
      isEntry: node.metadata?.isEntry || false,
      imports: {},
      exports: {},
      entities: {
        functions, // ✅ МАССИВ ОБЪЕКТОВ
        constants: [], // ✅ МАССИВ
        variables: [], // ✅ МАССИВ
        interfaces: [], // ✅ МАССИВ
        types: [], // ✅ МАССИВ
        classes: [], // ✅ МАССИВ
      },
      fileStats: {
        size: node.metadata?.size || 0,
        lines: node.metadata?.lines || 0,
        functions: functions.length,
        classes: 0,
        constants: 0,
        interfaces: 0,
        types: 0,
        variables: 0,
      },
    };
  }

  /**
   * Строит отчет из FullAnalysis
   * ✅ ИСПРАВЛЕНО: проверяет входные данные и гарантирует структуру
   */
  static buildReportFromAnalysis(analysis: FullAnalysis): PackageLockReport {
    // Проверка входных данных
    if (!analysis) {
      console.warn('⚠️ DataConverter.buildReportFromAnalysis: analysis is null or undefined');
      return this.createEmptyReport();
    }

    const packages: Record<string, PackageLockPackage> = {};

    const moduleNodes: ModuleGraphNode[] = analysis.moduleGraph?.nodes || [];
    const moduleEdges: ModuleGraphEdge[] = analysis.moduleGraph?.edges || [];
    const entityNodes: EntityGraphNode[] = analysis.entityGraph?.nodes || [];
    const entityEdges: EntityGraphEdge[] = analysis.entityGraph?.edges || [];

    // Если нет модулей, создаем пустой отчет
    if (moduleNodes.length === 0) {
      console.warn('⚠️ DataConverter.buildReportFromAnalysis: no module nodes found');
      return this.createEmptyReport();
    }

    // ✅ ГАРАНТИРУЕМ, ЧТО ВСЕ МАССИВЫ
    const safeModuleNodes = ensureArray<ModuleGraphNode>(moduleNodes);
    const safeEntityNodes = ensureArray<EntityGraphNode>(entityNodes);
    const safeEntityEdges = ensureArray<EntityGraphEdge>(entityEdges);

    for (const node of safeModuleNodes) {
      if (!node) continue;
      const modulePath = node.id;
      if (!modulePath) continue;

      const entities = safeEntityNodes.filter((e: EntityGraphNode) => e.module === modulePath);
      packages[modulePath] = this.convertModuleNodeToPackage(node, entities, safeEntityEdges);
    }

    const inwardDependencies: Record<string, string[]> = {};
    const outwardDependencies: Record<string, string[]> = {};

    for (const edge of moduleEdges) {
      if (!edge) continue;
      const from = edge.from;
      const to = edge.to;
      if (!from || !to) continue;

      if (!outwardDependencies[from]) {
        outwardDependencies[from] = [];
      }
      if (!inwardDependencies[to]) {
        inwardDependencies[to] = [];
      }
      outwardDependencies[from].push(to);
      inwardDependencies[to].push(from);
    }

    let totalFunctions = 0;
    let totalCalls = 0;
    let totalExportedFunctions = 0;
    let totalAsyncFunctions = 0;

    for (const pkg of Object.values(packages)) {
      if (!pkg) continue;
      // ✅ ГАРАНТИРУЕМ, ЧТО entities.functions - МАССИВ
      const funcs = ensureArray<any>(pkg.entities?.functions);
      for (const func of funcs) {
        totalFunctions++;
        totalCalls += ensureArray<string>(func.calls).length;
        if (func.isExported) {
          totalExportedFunctions++;
        }
        if (func.isAsync) {
          totalAsyncFunctions++;
        }
      }
    }

    return {
      name: 'ast-analyzer',
      version: '3.0.0',
      lockfileVersion: 3,
      packages,
      dependencyGraph: {
        direction: 'bidirectional',
        inwardDependencies,
        outwardDependencies,
      },
      entityStats: {
        totalFunctions,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls,
        totalExportedFunctions,
        totalAsyncFunctions,
      },
      fileStats: {
        totalFiles: Object.keys(packages).length,
        totalSize: 0,
        totalLines: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Создает пустой отчет
   */
  static createEmptyReport(): PackageLockReport {
    return {
      name: 'ast-analyzer',
      version: '3.0.0',
      lockfileVersion: 3,
      packages: {},
      dependencyGraph: {
        direction: 'bidirectional',
        inwardDependencies: {},
        outwardDependencies: {},
      },
      entityStats: {
        totalFunctions: 0,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls: 0,
        totalExportedFunctions: 0,
        totalAsyncFunctions: 0,
      },
      fileStats: {
        totalFiles: 0,
        totalSize: 0,
        totalLines: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Обогащает отчет данными из entitiesWithCalls
   * ✅ ИСПРАВЛЕНО: гарантирует, что все данные - массивы
   */
  static enrichReport(report: PackageLockReport, entitiesWithCalls: any): PackageLockReport {
    // Проверка входных данных
    if (!report) {
      console.warn('⚠️ DataConverter.enrichReport: report is null or undefined');
      return this.createEmptyReport();
    }

    if (!entitiesWithCalls) {
      console.log('ℹ️ DataConverter.enrichReport: no entities to enrich');
      return report;
    }

    // ✅ ГАРАНТИРУЕМ, ЧТО functions - МАССИВ
    const functions = ensureArray<any>(entitiesWithCalls.functions);

    if (functions.length === 0) {
      console.log('ℹ️ DataConverter.enrichReport: no functions to enrich');
      return report;
    }

    console.log(`📊 Обогащение данными из entitiesWithCalls (${functions.length} функций)...`);

    // Проверяем наличие packages
    if (!report.packages) {
      console.warn('⚠️ DataConverter.enrichReport: report.packages is undefined');
      report.packages = {};
    }

    let enrichedCount = 0;

    for (const [modulePath, pkg] of Object.entries(report.packages)) {
      if (!pkg) continue;

      // Проверяем наличие entities
      if (!pkg.entities) {
        pkg.entities = {
          functions: [],
          constants: [],
          variables: [],
          interfaces: [],
          types: [],
          classes: [],
        };
      }

      // ✅ ГАРАНТИРУЕМ, ЧТО pkg.entities.functions - МАССИВ
      if (!Array.isArray(pkg.entities.functions)) {
        pkg.entities.functions = [];
      }

      for (const func of pkg.entities.functions) {
        if (!func) continue;

        // Ищем обогащенные данные
        const enrichedFunc = functions.find((f: any) => {
          if (!f) return false;
          const funcModule = f._modulePath || f.modulePath || '';
          return (
            f.name === func.name &&
            (funcModule === modulePath ||
              funcModule.includes(modulePath) ||
              modulePath.includes(funcModule))
          );
        });

        if (enrichedFunc) {
          if (enrichedFunc.calls && Array.isArray(enrichedFunc.calls)) {
            func.calls = enrichedFunc.calls;
          }
          if (enrichedFunc.calledBy && Array.isArray(enrichedFunc.calledBy)) {
            func.calledBy = enrichedFunc.calledBy;
          }
          if (enrichedFunc.params && Array.isArray(enrichedFunc.params)) {
            func.params = enrichedFunc.params;
          }
          if (enrichedFunc.returnType) {
            func.returnType = enrichedFunc.returnType;
          }
          if (enrichedFunc.isAsync !== undefined) {
            func.isAsync = enrichedFunc.isAsync;
          }
          if (enrichedFunc.isExported !== undefined) {
            func.isExported = enrichedFunc.isExported;
          }
          if (enrichedFunc.body) {
            func.body = enrichedFunc.body;
          }
          if (enrichedFunc.line) {
            func.line = enrichedFunc.line;
          }
          if (enrichedFunc.startLine) {
            func.startLine = enrichedFunc.startLine;
          }
          if (enrichedFunc.endLine) {
            func.endLine = enrichedFunc.endLine;
          }
          enrichedCount++;
        }
      }
    }

    // Пересчитываем статистику
    let totalFunctions = 0;
    let totalCalls = 0;
    let totalExportedFunctions = 0;
    let totalAsyncFunctions = 0;

    for (const pkg of Object.values(report.packages)) {
      if (!pkg) continue;
      const funcs = ensureArray<any>(pkg.entities?.functions);
      for (const func of funcs) {
        totalFunctions++;
        totalCalls += ensureArray<string>(func.calls).length;
        if (func.isExported) {
          totalExportedFunctions++;
        }
        if (func.isAsync) {
          totalAsyncFunctions++;
        }
      }
    }

    if (report.entityStats) {
      report.entityStats.totalFunctions = totalFunctions;
      report.entityStats.totalCalls = totalCalls;
      report.entityStats.totalExportedFunctions = totalExportedFunctions;
      report.entityStats.totalAsyncFunctions = totalAsyncFunctions;
    }

    console.log(`  ✅ Обогащено ${enrichedCount} функций данными о вызовах`);

    return report;
  }
}

export default DataConverter;
