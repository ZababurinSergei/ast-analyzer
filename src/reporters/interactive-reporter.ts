// src/reporters/interactive-reporter.ts
import fs from 'fs';
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

interface PackageLockFunctionInfo {
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

interface PackageLockEntityInfo {
  functions: PackageLockFunctionInfo[];
  constants: any[];
  variables: any[];
  interfaces: any[];
  types: any[];
  classes: any[];
}

interface PackageLockPackage {
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

interface PackageLockReport {
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
// КОНВЕРТАЦИЯ ИЗ FULLANALYSIS В PACKAGELOCKREPORT
// ============================================================

function convertModuleNodeToPackage(
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

  const functions: PackageLockFunctionInfo[] = entityNodes
    .filter((e: EntityGraphNode) => e.type === 'function')
    .map((e: EntityGraphNode) => ({
      name: e.name,
      params: e.metadata?.params || [],
      paramTypes: [],
      line: e.line || 0,
      startLine: e.metadata?.startLine || e.line || 0,
      endLine: e.metadata?.endLine || e.line || 0,
      isAsync: e.metadata?.isAsync || false,
      isExported: e.metadata?.isExported || false,
      isMethod: e.metadata?.isMethod || false,
      className: e.metadata?.className,
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
      functions,
      constants: [],
      variables: [],
      interfaces: [],
      types: [],
      classes: [],
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

function buildReportFromAnalysis(analysis: FullAnalysis): PackageLockReport {
  const packages: Record<string, PackageLockPackage> = {};

  const moduleNodes: ModuleGraphNode[] = analysis.moduleGraph?.nodes || [];
  const moduleEdges: ModuleGraphEdge[] = analysis.moduleGraph?.edges || [];
  const entityNodes: EntityGraphNode[] = analysis.entityGraph?.nodes || [];
  const entityEdges: EntityGraphEdge[] = analysis.entityGraph?.edges || [];

  for (const node of moduleNodes) {
    if (!node) continue;
    const modulePath = node.id;
    if (!modulePath) continue;
    const entities = entityNodes.filter((e: EntityGraphNode) => e.module === modulePath);
    packages[modulePath] = convertModuleNodeToPackage(node, entities, entityEdges);
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
    for (const func of pkg.entities.functions) {
      totalFunctions++;
      totalCalls += func.calls.length;
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

// ============================================================
// ЭКРАНИРОВАНИЕ ДЛЯ HTML
// ============================================================

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// ГЕНЕРАЦИЯ HTML С D3.JS (БЕЗ GRAPHVIZ)
// ============================================================

export async function generateInteractiveHTML(
  analysis: FullAnalysis,
  outputPath: string,
  entitiesWithCalls?: any,
  packageLockPath?: string
): Promise<void> {
  // Загружаем package-lock-report.json если указан
  let report: PackageLockReport | null = null;
  if (packageLockPath && fs.existsSync(packageLockPath)) {
    try {
      const content = fs.readFileSync(packageLockPath, 'utf-8');
      report = JSON.parse(content);
      console.log('✅ Package-lock report loaded');
    } catch (error) {
      console.warn('⚠️ Failed to load package-lock report:', error);
    }
  }

  if (!report) {
    report = buildReportFromAnalysis(analysis);
  }

  // ============================================================
  // ОБОГАЩЕНИЕ ДАННЫХ СУЩНОСТЯМИ (ЕСЛИ ПЕРЕДАНЫ)
  // ============================================================
  if (entitiesWithCalls) {
    console.log('📊 Обогащение данными из entitiesWithCalls...');

    for (const [modulePath, pkg] of Object.entries(report.packages)) {
      if (!pkg) continue;

      for (const func of pkg.entities.functions) {
        const enrichedFunc = entitiesWithCalls.functions.find((f: any) => {
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
        }
      }
    }

    let totalFunctions = 0;
    let totalCalls = 0;
    let totalExportedFunctions = 0;
    let totalAsyncFunctions = 0;

    for (const pkg of Object.values(report.packages)) {
      if (!pkg) continue;
      for (const func of pkg.entities.functions) {
        totalFunctions++;
        totalCalls += func.calls.length;
        if (func.isExported) {
          totalExportedFunctions++;
        }
        if (func.isAsync) {
          totalAsyncFunctions++;
        }
      }
    }

    report.entityStats.totalFunctions = totalFunctions;
    report.entityStats.totalCalls = totalCalls;
    report.entityStats.totalExportedFunctions = totalExportedFunctions;
    report.entityStats.totalAsyncFunctions = totalAsyncFunctions;

    console.log(`  ✅ Обогащено ${totalFunctions} функций данными о вызовах`);
  }

  const allFunctions: { modulePath: string; func: PackageLockFunctionInfo }[] = [];
  for (const [modulePath, pkg] of Object.entries(report.packages)) {
    if (!pkg) continue;
    for (const func of pkg.entities.functions) {
      allFunctions.push({ modulePath, func });
    }
  }

  const moduleStats = Object.entries(report.packages)
    .filter(([_, pkg]) => pkg)
    .map(([modulePath, pkg]) => ({
      path: modulePath,
      name: pkg.displayPath || modulePath,
      isEntry: pkg.isEntry || false,
      functions: pkg.entities.functions.length,
      classes: pkg.entities.classes.length,
      constants: pkg.entities.constants.length,
      interfaces: pkg.entities.interfaces.length,
      types: pkg.entities.types.length,
      variables: pkg.entities.variables.length,
      lines: pkg.fileStats.lines || 0,
      size: pkg.fileStats.size || 0,
      language: pkg.language || 'javascript',
    }));

  // ============================================================
  // ГЕНЕРАЦИЯ HTML
  // ============================================================
  const reportJson = JSON.stringify(report);
  const functionsJson = JSON.stringify(allFunctions);

  // Вычисляем статистику по типам модулей
  const totalModulesByType = moduleStats.reduce(
    (acc, m) => {
      const lang = m.language || 'javascript';
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const entryModules = moduleStats.filter(m => m.isEntry);
  const entryNames = entryModules.map(m => escapeHtml(m.name)).join(', ');

  // Используем строковую конкатенацию вместо шаблонных литералов для HTML
  let htmlContent = '<!DOCTYPE html>\n';
  htmlContent += '<html lang="ru">\n';
  htmlContent += '<head>\n';
  htmlContent += '    <meta charset="UTF-8">\n';
  htmlContent += '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  htmlContent += '    <title>Интерактивный граф модулей и функций</title>\n';
  htmlContent += '    <script src="https://cdn.jsdelivr.net/npm/d3@7"><\/script>\n';
  htmlContent += '    <style>\n';
  htmlContent += '        * { margin: 0; padding: 0; box-sizing: border-box; }\n';
  htmlContent += '        body {\n';
  htmlContent +=
    "            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n";
  htmlContent += '            background: #0f172a;\n';
  htmlContent += '            color: #e2e8f0;\n';
  htmlContent += '            padding: 20px;\n';
  htmlContent += '            min-height: 100vh;\n';
  htmlContent += '        }\n';
  htmlContent += '        .container { max-width: 1600px; margin: 0 auto; }\n';
  htmlContent += '        .header {\n';
  htmlContent += '            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);\n';
  htmlContent += '            padding: 20px 30px;\n';
  htmlContent += '            border-radius: 12px;\n';
  htmlContent += '            margin-bottom: 20px;\n';
  htmlContent += '            border: 1px solid #334155;\n';
  htmlContent += '        }\n';
  htmlContent += '        .header h1 { font-size: 24px; color: #60a5fa; }\n';
  htmlContent += '        .header .sub { color: #94a3b8; margin-top: 4px; font-size: 13px; }\n';
  htmlContent += '        .header .stats-line {\n';
  htmlContent += '            display: flex;\n';
  htmlContent += '            gap: 20px;\n';
  htmlContent += '            flex-wrap: wrap;\n';
  htmlContent += '            margin-top: 10px;\n';
  htmlContent += '            font-size: 13px;\n';
  htmlContent += '        }\n';
  htmlContent += '        .header .stats-line .stat { color: #94a3b8; }\n';
  htmlContent += '        .header .stats-line .stat strong { color: #e2e8f0; }\n';
  htmlContent += '        .controls-bar {\n';
  htmlContent += '            display: flex;\n';
  htmlContent += '            gap: 12px;\n';
  htmlContent += '            flex-wrap: wrap;\n';
  htmlContent += '            align-items: center;\n';
  htmlContent += '            padding: 12px 16px;\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            border-radius: 10px;\n';
  htmlContent += '            margin-bottom: 16px;\n';
  htmlContent += '            border: 1px solid #334155;\n';
  htmlContent += '        }\n';
  htmlContent += '        .controls-bar .group { display: flex; gap: 6px; align-items: center; }\n';
  htmlContent +=
    '        .controls-bar .group-label { font-size: 11px; color: #94a3b8; margin-right: 4px; }\n';
  htmlContent += '        .controls-bar button {\n';
  htmlContent += '            background: #334155;\n';
  htmlContent += '            border: none;\n';
  htmlContent += '            color: #e2e8f0;\n';
  htmlContent += '            padding: 5px 14px;\n';
  htmlContent += '            border-radius: 6px;\n';
  htmlContent += '            cursor: pointer;\n';
  htmlContent += '            font-size: 12px;\n';
  htmlContent += '            transition: background 0.2s, transform 0.1s;\n';
  htmlContent += '        }\n';
  htmlContent += '        .controls-bar button:hover { background: #475569; }\n';
  htmlContent +=
    '        .controls-bar button.active { background: #60a5fa; color: #0f172a; font-weight: 600; }\n';
  htmlContent += '        .controls-bar button:active { transform: scale(0.95); }\n';
  htmlContent += '        .controls-bar .search-input {\n';
  htmlContent += '            background: #0f172a;\n';
  htmlContent += '            border: 1px solid #334155;\n';
  htmlContent += '            border-radius: 6px;\n';
  htmlContent += '            padding: 5px 12px;\n';
  htmlContent += '            color: #e2e8f0;\n';
  htmlContent += '            font-size: 12px;\n';
  htmlContent += '            width: 200px;\n';
  htmlContent += '            outline: none;\n';
  htmlContent += '        }\n';
  htmlContent += '        .controls-bar .search-input:focus { border-color: #60a5fa; }\n';
  htmlContent += '        .controls-bar .search-input::placeholder { color: #64748b; }\n';
  htmlContent +=
    '        .controls-bar .hint { font-size: 11px; color: #64748b; margin-left: auto; }\n';
  htmlContent += '        .graph-container {\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            border-radius: 12px;\n';
  htmlContent += '            padding: 16px;\n';
  htmlContent += '            margin-bottom: 16px;\n';
  htmlContent += '            border: 1px solid #334155;\n';
  htmlContent += '            position: relative;\n';
  htmlContent += '            min-height: 500px;\n';
  htmlContent += '        }\n';
  htmlContent += '        .d3-graph-wrapper {\n';
  htmlContent += '            width: 100%;\n';
  htmlContent += '            height: 700px;\n';
  htmlContent += '            background: #0f172a;\n';
  htmlContent += '            border-radius: 8px;\n';
  htmlContent += '            position: relative;\n';
  htmlContent += '        }\n';
  htmlContent += '        .d3-graph-wrapper svg { width: 100%; height: 100%; display: block; }\n';
  htmlContent += '        .graph-tooltip {\n';
  htmlContent += '            position: absolute;\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            border: 1px solid #334155;\n';
  htmlContent += '            border-radius: 8px;\n';
  htmlContent += '            padding: 12px 16px;\n';
  htmlContent += '            pointer-events: none;\n';
  htmlContent += '            max-width: 300px;\n';
  htmlContent += '            display: none;\n';
  htmlContent += '            box-shadow: 0 8px 32px rgba(0,0,0,0.5);\n';
  htmlContent += '            z-index: 50;\n';
  htmlContent += '        }\n';
  htmlContent +=
    '        .graph-tooltip .tt-title { font-weight: 600; color: #60a5fa; font-size: 14px; }\n';
  htmlContent +=
    '        .graph-tooltip .tt-info { font-size: 12px; color: #94a3b8; margin-top: 4px; }\n';
  htmlContent +=
    '        .graph-tooltip .tt-detail { font-size: 11px; color: #e2e8f0; margin-top: 6px; font-family: monospace; white-space: pre-wrap; }\n';
  htmlContent += '        .legend {\n';
  htmlContent += '            display: flex;\n';
  htmlContent += '            gap: 16px;\n';
  htmlContent += '            flex-wrap: wrap;\n';
  htmlContent += '            padding: 8px 0;\n';
  htmlContent += '            font-size: 12px;\n';
  htmlContent += '        }\n';
  htmlContent += '        .legend-item { display: flex; align-items: center; gap: 6px; }\n';
  htmlContent +=
    '        .legend-color { width: 16px; height: 16px; border-radius: 4px; border: 1px solid #475569; }\n';
  htmlContent += '        .focus-info {\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            border-radius: 8px;\n';
  htmlContent += '            padding: 12px 16px;\n';
  htmlContent += '            margin-bottom: 16px;\n';
  htmlContent += '            border: 1px solid #22d3ee;\n';
  htmlContent += '            display: none;\n';
  htmlContent += '        }\n';
  htmlContent += '        .focus-info.active { display: block; }\n';
  htmlContent +=
    '        .focus-info .title { color: #22d3ee; font-weight: 600; font-size: 14px; }\n';
  htmlContent +=
    '        .focus-info .details { color: #94a3b8; font-size: 12px; margin-top: 4px; }\n';
  htmlContent +=
    '        .focus-info .close-btn { background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; float: right; }\n';
  htmlContent += '        .focus-info .close-btn:hover { color: #fca5a5; }\n';
  htmlContent += '        .modules-grid {\n';
  htmlContent += '            display: grid;\n';
  htmlContent += '            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));\n';
  htmlContent += '            gap: 16px;\n';
  htmlContent += '            margin-top: 20px;\n';
  htmlContent += '        }\n';
  htmlContent += '        .module-card {\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            border-radius: 10px;\n';
  htmlContent += '            padding: 14px 16px;\n';
  htmlContent += '            border: 1px solid #334155;\n';
  htmlContent += '            transition: all 0.3s;\n';
  htmlContent += '            cursor: pointer;\n';
  htmlContent += '        }\n';
  htmlContent +=
    '        .module-card:hover { border-color: #60a5fa; transform: translateY(-2px); }\n';
  htmlContent +=
    '        .module-card.active { border-color: #22d3ee; box-shadow: 0 0 20px rgba(34, 211, 238, 0.15); }\n';
  htmlContent +=
    '        .module-card .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }\n';
  htmlContent +=
    '        .module-card .name { font-size: 14px; font-weight: 600; color: #60a5fa; word-break: break-all; }\n';
  htmlContent += '        .module-card .name .entry { color: #fbbf24; font-size: 12px; }\n';
  htmlContent +=
    '        .module-card .path { font-size: 10px; color: #64748b; font-family: monospace; word-break: break-all; margin-top: 2px; }\n';
  htmlContent +=
    '        .module-card .badges { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }\n';
  htmlContent += '        .badge {\n';
  htmlContent += '            padding: 2px 8px;\n';
  htmlContent += '            border-radius: 12px;\n';
  htmlContent += '            font-size: 9px;\n';
  htmlContent += '            font-weight: 500;\n';
  htmlContent += '            text-transform: uppercase;\n';
  htmlContent += '        }\n';
  htmlContent += '        .badge.fn { background: #fbbf24; color: #0f172a; }\n';
  htmlContent += '        .badge.class { background: #4ade80; color: #0f172a; }\n';
  htmlContent += '        .badge.const { background: #f472b6; color: #0f172a; }\n';
  htmlContent += '        .badge.interface { background: #a78bfa; color: #fff; }\n';
  htmlContent += '        .badge.type { background: #22d3ee; color: #0f172a; }\n';
  htmlContent += '        .badge.var { background: #f87171; color: #fff; }\n';
  htmlContent += '        .badge.export { background: #f87171; color: #fff; }\n';
  htmlContent += '        .badge.async { background: #fbbf24; color: #0f172a; }\n';
  htmlContent += '        .badge.lang { background: #334155; color: #94a3b8; }\n';
  htmlContent +=
    '        .badge.lines { background: #1e293b; color: #64748b; border: 1px solid #334155; }\n';
  htmlContent +=
    '        .module-card .functions-list { margin-top: 8px; max-height: 300px; overflow-y: auto; }\n';
  htmlContent += '        .functions-list::-webkit-scrollbar { width: 4px; }\n';
  htmlContent += '        .functions-list::-webkit-scrollbar-track { background: transparent; }\n';
  htmlContent +=
    '        .functions-list::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }\n';
  htmlContent += '        .func-item {\n';
  htmlContent += '            display: flex;\n';
  htmlContent += '            align-items: center;\n';
  htmlContent += '            gap: 6px;\n';
  htmlContent += '            padding: 4px 8px;\n';
  htmlContent += '            margin: 2px 0;\n';
  htmlContent += '            background: #0f172a;\n';
  htmlContent += '            border-radius: 4px;\n';
  htmlContent += '            font-size: 11px;\n';
  htmlContent += '            font-family: monospace;\n';
  htmlContent += '            cursor: pointer;\n';
  htmlContent += '            transition: background 0.2s, border-color 0.2s;\n';
  htmlContent += '            border-left: 2px solid transparent;\n';
  htmlContent += '        }\n';
  htmlContent += '        .func-item:hover { background: #1a1a3a; border-left-color: #60a5fa; }\n';
  htmlContent +=
    '        .func-item.active { background: #1a1a3a; border-left-color: #22d3ee; box-shadow: 0 0 12px rgba(34, 211, 238, 0.1); }\n';
  htmlContent += '        .func-item .func-name { color: #e2e8f0; }\n';
  htmlContent += '        .func-item .func-export { color: #f87171; font-size: 9px; }\n';
  htmlContent += '        .func-item .func-async { color: #fbbf24; font-size: 9px; }\n';
  htmlContent += '        .func-item .func-params { color: #94a3b8; font-size: 10px; }\n';
  htmlContent += '        .func-item .func-calls { color: #f59e0b; font-size: 10px; }\n';
  htmlContent += '        .func-item .func-called { color: #3b82f6; font-size: 10px; }\n';
  htmlContent +=
    '        .func-item .func-line { color: #64748b; font-size: 9px; margin-left: auto; }\n';
  htmlContent += '        .detail-panel {\n';
  htmlContent += '            position: fixed;\n';
  htmlContent += '            right: 20px;\n';
  htmlContent += '            top: 50%;\n';
  htmlContent += '            transform: translateY(-50%);\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            border: 1px solid #334155;\n';
  htmlContent += '            border-radius: 12px;\n';
  htmlContent += '            padding: 20px;\n';
  htmlContent += '            max-width: 420px;\n';
  htmlContent += '            max-height: 80vh;\n';
  htmlContent += '            overflow-y: auto;\n';
  htmlContent += '            display: none;\n';
  htmlContent += '            box-shadow: 0 20px 60px rgba(0,0,0,0.7);\n';
  htmlContent += '            z-index: 100;\n';
  htmlContent += '            min-width: 300px;\n';
  htmlContent += '        }\n';
  htmlContent += '        .detail-panel.active { display: block; }\n';
  htmlContent += '        .detail-panel::-webkit-scrollbar { width: 4px; }\n';
  htmlContent += '        .detail-panel::-webkit-scrollbar-track { background: transparent; }\n';
  htmlContent +=
    '        .detail-panel::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }\n';
  htmlContent +=
    '        .detail-panel .dp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }\n';
  htmlContent +=
    '        .detail-panel .dp-title { font-size: 18px; font-weight: 600; color: #60a5fa; }\n';
  htmlContent +=
    '        .detail-panel .dp-close { background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; }\n';
  htmlContent += '        .detail-panel .dp-close:hover { color: #f87171; }\n';
  htmlContent +=
    '        .detail-panel .dp-section { margin-top: 10px; padding: 8px 0; border-top: 1px solid #334155; }\n';
  htmlContent += '        .detail-panel .dp-section:first-child { border-top: none; }\n';
  htmlContent +=
    '        .detail-panel .dp-section h4 { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }\n';
  htmlContent +=
    '        .detail-panel .dp-section .item { font-size: 12px; color: #e2e8f0; padding: 2px 0; font-family: monospace; }\n';
  htmlContent += '        .detail-panel .dp-section .item .label { color: #94a3b8; }\n';
  htmlContent += '        .footer {\n';
  htmlContent += '            padding: 12px 20px;\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            text-align: center;\n';
  htmlContent += '            color: #64748b;\n';
  htmlContent += '            font-size: 11px;\n';
  htmlContent += '            border-top: 1px solid #334155;\n';
  htmlContent += '            margin-top: 20px;\n';
  htmlContent += '            border-radius: 0 0 12px 12px;\n';
  htmlContent += '        }\n';
  htmlContent += '        @media (max-width: 768px) {\n';
  htmlContent += '            .modules-grid { grid-template-columns: 1fr; }\n';
  htmlContent += '            .controls-bar { flex-direction: column; align-items: stretch; }\n';
  htmlContent += '            .controls-bar .hint { display: none; }\n';
  htmlContent += '            .controls-bar .search-input { width: 100%; }\n';
  htmlContent +=
    '            .detail-panel { right: 10px; left: 10px; max-width: none; min-width: auto; top: auto; bottom: 10px; transform: none; max-height: 60vh; }\n';
  htmlContent += '            .header .stats-line { flex-direction: column; gap: 4px; }\n';
  htmlContent += '            .d3-graph-wrapper { height: 450px; }\n';
  htmlContent += '        }\n';
  htmlContent += '    <\/style>\n';
  htmlContent += '<\/head>\n';
  htmlContent += '<body>\n';
  htmlContent += '    <div class="container">\n';
  htmlContent += '        <div class="header">\n';
  htmlContent += '            <h1>🔀 Интерактивный граф модулей и функций</h1>\n';
  htmlContent += '            <div class="stats-line" id="statsLine">\n';
  htmlContent +=
    '                <span class="stat">📁 <strong id="statModules">' +
    report.fileStats.totalFiles +
    '</strong> модулей</span>\n';
  htmlContent +=
    '                <span class="stat">ƒ <strong id="statFunctions">' +
    report.entityStats.totalFunctions +
    '</strong> функций</span>\n';
  htmlContent +=
    '                <span class="stat">📞 <strong id="statCalls">' +
    report.entityStats.totalCalls +
    '</strong> вызовов</span>\n';
  htmlContent +=
    '                <span class="stat">📤 <strong id="statExported">' +
    report.entityStats.totalExportedFunctions +
    '</strong> экспортировано</span>\n';
  htmlContent +=
    '                <span class="stat">⚡ <strong id="statAsync">' +
    report.entityStats.totalAsyncFunctions +
    '</strong> async</span>\n';
  htmlContent +=
    '                <span class="stat">📝 <strong id="statLines">' +
    report.fileStats.totalLines +
    '</strong> строк</span>\n';
  htmlContent +=
    '                <span class="stat">💾 <strong id="statSize">' +
    (report.fileStats.totalSize / 1024).toFixed(2) +
    '</strong> KB</span>\n';
  htmlContent += '            </div>\n';

  // ✅ Используем moduleStats и escapeHtml для отображения статистики по модулям
  htmlContent += '            <div class="sub" style="margin-top: 8px;">';
  htmlContent += '📊 По типам: ';

  // Исправленный цикл с проверкой на undefined
  const typeEntries = Object.entries(totalModulesByType);
  for (let i = 0; i < typeEntries.length; i++) {
    const entry = typeEntries[i];
    if (!entry) continue;
    const [lang, count] = entry;
    htmlContent += escapeHtml(lang) + ': ' + count;
    if (i < typeEntries.length - 1) {
      htmlContent += ' | ';
    }
  }
  htmlContent += ' | ';
  htmlContent += '⭐ Точка входа: ' + (entryNames || 'не указана');
  htmlContent += '</div>\n';

  htmlContent +=
    '            <div class="sub">Сгенерировано: ' + new Date().toLocaleString() + '</div>\n';
  htmlContent += '        </div>\n';

  htmlContent += '        <div class="controls-bar">\n';
  htmlContent += '            <div class="group">\n';
  htmlContent += '                <span class="group-label">Режим:</span>\n';
  htmlContent +=
    '                <button class="active" data-mode="all" onclick="setMode(\'all\')">🌐 Все</button>\n';
  htmlContent +=
    '                <button data-mode="inward" onclick="setMode(\'inward\')">📥 Входящие</button>\n';
  htmlContent +=
    '                <button data-mode="outward" onclick="setMode(\'outward\')">📤 Исходящие</button>\n';
  htmlContent +=
    '                <button data-mode="both" onclick="setMode(\'both\')">🔁 Оба</button>\n';
  htmlContent += '            </div>\n';
  htmlContent += '            <div class="group">\n';
  htmlContent += '                <span class="group-label">Фокус:</span>\n';
  htmlContent += '                <button onclick="clearFocus()">✕ Очистить</button>\n';
  htmlContent += '            </div>\n';
  htmlContent +=
    '            <input class="search-input" id="searchInput" placeholder="🔍 Поиск функции или модуля..." oninput="handleSearch(this.value)">\n';
  htmlContent +=
    '            <span class="hint">💡 Клик на функцию → детали | Клик на модуль → фокус</span>\n';
  htmlContent += '        </div>\n';

  htmlContent += '        <div class="focus-info" id="focusInfo">\n';
  htmlContent += '            <button class="close-btn" onclick="clearFocus()">✕</button>\n';
  htmlContent += '            <div class="title" id="focusTitle">🎯 Фокус</div>\n';
  htmlContent += '            <div class="details" id="focusDetails"></div>\n';
  htmlContent += '        </div>\n';

  htmlContent += '        <div class="graph-container">\n';
  htmlContent += '            <div class="d3-graph-wrapper" id="d3GraphWrapper">\n';
  htmlContent += '                <div class="graph-tooltip" id="graphTooltip">\n';
  htmlContent += '                    <div class="tt-title" id="ttTitle"></div>\n';
  htmlContent += '                    <div class="tt-info" id="ttInfo"></div>\n';
  htmlContent += '                    <div class="tt-detail" id="ttDetail"></div>\n';
  htmlContent += '                </div>\n';
  htmlContent += '            </div>\n';
  htmlContent += '            <div class="legend">\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#fbbf24;"></div><span>⭐ Точка входа</span></div>\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#f87171;"></div><span>📤 Экспортированная функция</span></div>\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#fbbf24;"></div><span>Внутренняя функция</span></div>\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#22d3ee;"></div><span>🎯 Активная (фокус)</span></div>\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#f59e0b; width:30px; height:3px;"></div><span>Вызов функции</span></div>\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#3b82f6; width:30px; height:3px; style=dashed;"></div><span>Кем вызвана</span></div>\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#3b82f6; width:30px; height:3px;"></div><span>Импорт модуля</span></div>\n';
  htmlContent +=
    '                <div class="legend-item"><div class="legend-color" style="background:#f59e0b; width:30px; height:3px;"></div><span>Обратная связь</span></div>\n';
  htmlContent += '            </div>\n';
  htmlContent += '        </div>\n';

  htmlContent += '        <div id="modulesContainer">\n';
  htmlContent +=
    '            <h2 style="margin: 20px 0 12px; color:#60a5fa; font-size:18px;">📁 Модули и функции</h2>\n';
  htmlContent += '            <div class="modules-grid" id="modulesGrid"></div>\n';
  htmlContent += '        </div>\n';

  htmlContent += '        <div class="detail-panel" id="detailPanel">\n';
  htmlContent += '            <div class="dp-header">\n';
  htmlContent += '                <div class="dp-title" id="dpTitle">Функция</div>\n';
  htmlContent += '                <button class="dp-close" onclick="closeDetail()">✕</button>\n';
  htmlContent += '            </div>\n';
  htmlContent += '            <div id="dpContent"></div>\n';
  htmlContent += '        </div>\n';

  htmlContent += '        <div class="footer">\n';
  htmlContent +=
    '            <p>Сгенерировано AST Analyzer v3.0.0 | Интерактивный граф на D3.js</p>\n';
  htmlContent += '        </div>\n';
  htmlContent += '    </div>\n';

  // JavaScript часть
  htmlContent += '    <script>\n';
  htmlContent += '        const reportData = ' + reportJson + ';\n';
  htmlContent += '        const allFunctionsData = ' + functionsJson + ';\n';

  htmlContent += `
        let currentMode = 'all';
        let currentFocusModule = null;
        let currentFocusFunction = null;
        let simulation = null;
        let svg = null;
        let g = null;
        let zoom = null;
        let graphNodes = [];
        let graphLinks = [];
        let nodeMap = new Map();

        function init() {
            renderModules();
            initGraph();
            updateView();
            setupKeyboard();
        }

        function renderModules() {
            const grid = document.getElementById('modulesGrid');
            grid.innerHTML = '';
            const moduleEntries = Object.entries(reportData.packages || {});
            moduleEntries.sort((a, b) => {
                const aEntry = a[1]?.isEntry ? 0 : 1;
                const bEntry = b[1]?.isEntry ? 0 : 1;
                return aEntry - bEntry;
            });
            for (const [modulePath, pkg] of moduleEntries) {
                if (!pkg) continue;
                const moduleCard = document.createElement('div');
                moduleCard.className = 'module-card';
                moduleCard.dataset.module = modulePath;
                moduleCard.onclick = () => focusModule(modulePath);
                const funcs = pkg.entities?.functions || [];
                const isEntry = pkg.isEntry || false;
                const displayName = pkg.displayPath || modulePath.split('/').pop() || modulePath;
                const language = pkg.language || 'javascript';
                const lines = pkg.fileStats?.lines || 0;
                let funcsHtml = '';
                for (const func of funcs) {
                    const paramsStr = (func.params || []).map(p => escapeHtml(p)).join(', ');
                    const callsStr = (func.calls || []).slice(0, 3).map(c => escapeHtml(c)).join(', ');
                    const isExported = func.isExported || false;
                    const isAsync = func.isAsync || false;
                    funcsHtml += '<div class="func-item" onclick="event.stopPropagation(); focusFunction(\'' + escapeHtml(func.name) + '\', \'' + escapeHtml(modulePath) + '\')" data-func="' + escapeHtml(func.name) + '" data-module="' + escapeHtml(modulePath) + '">' +
                        '<span class="func-name">' + escapeHtml(func.name) + '</span>' +
                        (isExported ? '<span class="func-export">📤</span>' : '') +
                        (isAsync ? '<span class="func-async">⚡</span>' : '') +
                        (func.params && func.params.length > 0 ? '<span class="func-params">(' + paramsStr + ')</span>' : '') +
                        (func.calls && func.calls.length > 0 ? '<span class="func-calls">→ ' + callsStr + (func.calls.length > 3 ? '...' : '') + '</span>' : '') +
                        (func.calledBy && func.calledBy.length > 0 ? '<span class="func-called">← ' + func.calledBy.length + '</span>' : '') +
                        '<span class="func-line">стр.' + (func.line || 0) + '</span>' +
                        '</div>';
                }
                moduleCard.innerHTML = '<div class="header-row">' +
                    '<div><div class="name">' + (isEntry ? '⭐ ' : '') + escapeHtml(displayName) + '</div>' +
                    '<div class="path">' + escapeHtml(modulePath) + '</div></div>' +
                    '<div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">' +
                    '<span class="badge lang">' + escapeHtml(language) + '</span>' +
                    (isEntry ? '<span class="badge export">⭐ entry</span>' : '') +
                    '<span class="badge lines">' + lines + ' строк</span>' +
                    '</div></div>' +
                    '<div class="badges">' +
                    '<span class="badge fn">' + funcs.length + ' функций</span>' +
                    (pkg.entities?.classes?.length > 0 ? '<span class="badge class">' + pkg.entities.classes.length + ' классов</span>' : '') +
                    (pkg.entities?.constants?.length > 0 ? '<span class="badge const">' + pkg.entities.constants.length + ' констант</span>' : '') +
                    (pkg.entities?.interfaces?.length > 0 ? '<span class="badge interface">' + pkg.entities.interfaces.length + ' интерфейсов</span>' : '') +
                    (pkg.entities?.types?.length > 0 ? '<span class="badge type">' + pkg.entities.types.length + ' типов</span>' : '') +
                    (pkg.entities?.variables?.length > 0 ? '<span class="badge var">' + pkg.entities.variables.length + ' переменных</span>' : '') +
                    '</div>' +
                    '<div class="functions-list">' + funcsHtml + '</div>';
                grid.appendChild(moduleCard);
            }
        }

        function initGraph() {
            const container = document.getElementById('d3GraphWrapper');
            const width = container.clientWidth || 900;
            const height = 700;
            container.innerHTML = '<div class="graph-tooltip" id="graphTooltip"><div class="tt-title" id="ttTitle"></div><div class="tt-info" id="ttInfo"></div><div class="tt-detail" id="ttDetail"></div></div>';
            svg = d3.select(container).append('svg').attr('width', width).attr('height', height).style('background', '#0f172a').style('border-radius', '8px').style('display', 'block');
            g = svg.append('g');
            zoom = d3.zoom().extent([[0, 0], [width, height]]).scaleExtent([0.1, 4]).on('zoom', function(event) { g.attr('transform', event.transform); });
            svg.call(zoom);
            buildGraphData();
            renderGraph(width, height);
            window.addEventListener('resize', function() { const newWidth = container.clientWidth || 900; svg.attr('width', newWidth); });
        }

        function buildGraphData() {
            graphNodes = [];
            graphLinks = [];
            nodeMap = new Map();
            const levelColors = ['#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#f87171', '#22d3ee'];
            for (const [modulePath, pkg] of Object.entries(reportData.packages || {})) {
                if (!pkg) continue;
                const isRoot = pkg.isEntry || false;
                const name = pkg.displayPath || modulePath.split('/').pop() || modulePath;
                const funcs = pkg.entities?.functions || [];
                const level = 0;
                const nodeId = modulePath;
                nodeMap.set(nodeId, {
                    id: nodeId,
                    name: name,
                    fullName: modulePath,
                    type: 'module',
                    isRoot: isRoot,
                    level: level,
                    color: isRoot ? '#fbbf24' : (levelColors[level % levelColors.length] || '#94a3b8'),
                    size: isRoot ? 35 : 25,
                    functions: funcs,
                    pkg: pkg
                });
                graphNodes.push(nodeMap.get(nodeId));
                for (const func of funcs) {
                    const funcId = modulePath + '#func:' + func.name;
                    if (!nodeMap.has(funcId)) {
                        nodeMap.set(funcId, {
                            id: funcId,
                            name: func.name,
                            fullName: func.name,
                            type: 'function',
                            isRoot: false,
                            isExported: func.isExported || false,
                            isAsync: func.isAsync || false,
                            module: modulePath,
                            line: func.line || 0,
                            color: func.isExported ? '#f87171' : '#fbbf24',
                            size: 8,
                            calls: func.calls || [],
                            calledBy: func.calledBy || [],
                            params: func.params || [],
                            returnType: func.returnType || 'any',
                            body: func.body || ''
                        });
                        graphNodes.push(nodeMap.get(funcId));
                    }
                }
            }
            const inwardDeps = reportData.dependencyGraph?.inwardDependencies || {};
            const outwardDeps = reportData.dependencyGraph?.outwardDependencies || {};
            const addedEdges = new Set();
            for (const [from, deps] of Object.entries(outwardDeps)) {
                if (!deps) continue;
                for (const to of deps) {
                    const edgeKey = from + '->' + to;
                    if (addedEdges.has(edgeKey)) continue;
                    addedEdges.add(edgeKey);
                    if (nodeMap.has(from) && nodeMap.has(to)) {
                        graphLinks.push({ source: from, target: to, type: 'import', isCycle: false, isCall: false });
                    }
                }
            }
            for (const node of graphNodes) {
                if (node.type !== 'function') continue;
                const calls = node.calls || [];
                for (const call of calls) {
                    const targetKey = node.module + '#func:' + call;
                    if (nodeMap.has(targetKey)) {
                        const edgeKey = node.id + '->' + targetKey;
                        if (!addedEdges.has(edgeKey)) {
                            addedEdges.add(edgeKey);
                            graphLinks.push({ source: node.id, target: targetKey, type: 'call', isCall: true, isCycle: false });
                        }
                    } else {
                        for (const otherNode of graphNodes) {
                            if (otherNode.type === 'function' && otherNode.name === call) {
                                const edgeKey = node.id + '->' + otherNode.id;
                                if (!addedEdges.has(edgeKey)) {
                                    addedEdges.add(edgeKey);
                                    graphLinks.push({ source: node.id, target: otherNode.id, type: 'call', isCall: true, isCycle: false });
                                }
                                break;
                            }
                        }
                    }
                }
            }
            graphLinks = graphLinks.filter(link => nodeMap.has(link.source) && nodeMap.has(link.target));
        }

        function renderGraph(width, height) {
            if (!g) return;
            g.selectAll('*').remove();
            let filteredNodes = graphNodes;
            let filteredLinks = graphLinks;
            if (currentFocusModule) {
                const related = new Set([currentFocusModule]);
                for (const link of graphLinks) {
                    if (link.source === currentFocusModule) related.add(link.target);
                    if (link.target === currentFocusModule) related.add(link.source);
                }
                filteredNodes = graphNodes.filter(n => related.has(n.id) || n.type === 'function');
                filteredLinks = graphLinks.filter(l => related.has(l.source) && related.has(l.target));
            }
            if (currentFocusFunction) {
                const related = new Set([currentFocusFunction]);
                let focusModule = '';
                for (const node of graphNodes) {
                    if (node.id === currentFocusFunction) { focusModule = node.module || ''; break; }
                }
                if (focusModule) related.add(focusModule);
                for (const link of graphLinks) {
                    if (link.source === currentFocusFunction) related.add(link.target);
                    if (link.target === currentFocusFunction) related.add(link.source);
                }
                filteredNodes = graphNodes.filter(n => related.has(n.id));
                filteredLinks = graphLinks.filter(l => related.has(l.source) && related.has(l.target));
            }
            const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
            if (searchQuery) {
                const matched = new Set();
                for (const node of filteredNodes) {
                    if (node.name.toLowerCase().includes(searchQuery) || node.fullName?.toLowerCase().includes(searchQuery)) {
                        matched.add(node.id);
                    }
                }
                const expanded = new Set(matched);
                for (const link of filteredLinks) {
                    if (matched.has(link.source)) expanded.add(link.target);
                    if (matched.has(link.target)) expanded.add(link.source);
                }
                filteredNodes = filteredNodes.filter(n => expanded.has(n.id));
                filteredLinks = filteredLinks.filter(l => expanded.has(l.source) && expanded.has(l.target));
            }
            const nodeMapFiltered = new Map();
            for (const node of filteredNodes) nodeMapFiltered.set(node.id, node);
            const link = g.append('g').selectAll('line').data(filteredLinks).enter().append('line')
                .attr('stroke', d => d.isCall ? '#ef4444' : (d.isCycle ? '#f59e0b' : '#3b82f6'))
                .attr('stroke-width', d => d.isCall ? 1.5 : (d.isCycle ? 2 : 1))
                .attr('stroke-opacity', d => d.isCall ? 0.8 : 0.5)
                .attr('stroke-dasharray', d => d.isCall ? 'none' : (d.isCycle ? '8,4' : 'none'));
            const nodeGroup = g.append('g').selectAll('g').data(filteredNodes).enter().append('g')
                .attr('cursor', 'pointer')
                .on('click', function(event, d) { if (d.type === 'function') { showDetail(d); } else if (d.type === 'module') { focusModule(d.id); } })
                .on('mouseover', function(event, d) { showTooltip(event, d); })
                .on('mouseout', function() { hideTooltip(); })
                .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));
            nodeGroup.append('circle')
                .attr('r', d => d.size || 10)
                .attr('fill', d => {
                    if (currentFocusFunction && d.id === currentFocusFunction) return '#22d3ee';
                    if (currentFocusModule && d.id === currentFocusModule) return '#22d3ee';
                    return d.color || '#94a3b8';
                })
                .attr('stroke', d => {
                    if (d.isRoot) return '#fbbf24';
                    if (currentFocusFunction && d.id === currentFocusFunction) return '#22d3ee';
                    if (currentFocusModule && d.id === currentFocusModule) return '#22d3ee';
                    return '#1e293b';
                })
                .attr('stroke-width', d => (d.isRoot || d.id === currentFocusFunction || d.id === currentFocusModule) ? 3 : 1.5)
                .attr('opacity', d => 1);
            nodeGroup.append('text')
                .attr('dx', d => (d.size || 10) + 8)
                .attr('dy', 4)
                .attr('font-size', d => d.type === 'function' ? '9px' : '12px')
                .attr('fill', '#e2e8f0')
                .attr('font-family', 'monospace')
                .text(d => {
                    if (d.isRoot) return '⭐ ' + d.name;
                    if (d.type === 'function' && d.isExported) return '📤 ' + d.name;
                    return d.name;
                })
                .style('pointer-events', 'none')
                .attr('opacity', d => 1);
            if (!currentFocusFunction) {
                nodeGroup.filter(d => d.type === 'module' && d.functions && d.functions.length > 0)
                    .append('text')
                    .attr('dx', d => (d.size || 10) + 8)
                    .attr('dy', 16)
                    .attr('font-size', '8px')
                    .attr('fill', '#94a3b8')
                    .attr('font-family', 'monospace')
                    .text(d => d.functions.length + ' функций')
                    .style('pointer-events', 'none');
            }
            const sim = d3.forceSimulation(filteredNodes)
                .force('link', d3.forceLink(filteredLinks).id(d => d.id).distance(d => d.isCall ? 100 : 150))
                .force('charge', d3.forceManyBody().strength(d => d.type === 'module' ? -500 : -200))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(d => (d.size || 10) + 15));
            sim.on('tick', function() {
                link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
                nodeGroup.attr('transform', d => 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')');
            });
            simulation = sim;
            function dragstarted(event, d) { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
            function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
            function dragended(event, d) { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }
        }

        function showTooltip(event, d) {
            const tooltip = document.getElementById('graphTooltip');
            document.getElementById('ttTitle').textContent = d.name;
            document.getElementById('ttInfo').textContent = d.type === 'module' ? 'Модуль: ' + d.fullName : 'Тип: функция' + (d.isExported ? ' 📤' : '');
            let detail = '';
            if (d.type === 'function') {
                detail += 'Параметры: ' + (d.params || []).join(', ') || 'нет\n';
                detail += 'Возврат: ' + (d.returnType || 'any') + '\n';
                detail += 'Строка: ' + (d.line || 0) + '\n';
                detail += 'Вызовов: ' + (d.calls || []).length + '\n';
                detail += 'Кем вызвана: ' + (d.calledBy || []).length;
            } else {
                detail += 'Функций: ' + (d.functions || []).length + '\n';
                if (d.pkg) detail += 'Экспортов: ' + (d.pkg.exports ? Object.keys(d.pkg.exports).length : 0);
            }
            document.getElementById('ttDetail').textContent = detail;
            const container = document.getElementById('d3GraphWrapper');
            const rect = container.getBoundingClientRect();
            const x = event.clientX - rect.left + 15;
            const y = event.clientY - rect.top - 10;
            tooltip.style.display = 'block';
            tooltip.style.left = Math.min(x, rect.width - 320) + 'px';
            tooltip.style.top = Math.min(y, rect.height - 150) + 'px';
        }

        function hideTooltip() { document.getElementById('graphTooltip').style.display = 'none'; }

        function setMode(mode) {
            currentMode = mode;
            document.querySelectorAll('[data-mode]').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === mode); });
            updateView();
        }

        function focusModule(modulePath) {
            if (currentFocusModule === modulePath) { clearFocus(); return; }
            currentFocusModule = modulePath;
            currentFocusFunction = null;
            updateView();
            document.querySelectorAll('.module-card').forEach(function(c) { c.classList.toggle('active', c.dataset.module === modulePath); });
            const info = document.getElementById('focusInfo');
            info.classList.add('active');
            const pkg = reportData.packages[modulePath];
            const displayName = pkg?.displayPath || modulePath.split('/').pop() || modulePath;
            document.getElementById('focusTitle').textContent = '🎯 Фокус: ' + displayName;
            if (pkg) {
                const funcs = pkg.entities?.functions || [];
                document.getElementById('focusDetails').textContent = 'Функций: ' + funcs.length + ' | Экспортов: ' + (pkg.exports ? Object.keys(pkg.exports).length : 0);
            }
            const card = document.querySelector('.module-card[data-module="' + modulePath + '"]');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function focusFunction(funcName, modulePath) {
            if (currentFocusFunction === funcName && currentFocusModule === modulePath) { clearFocus(); return; }
            currentFocusFunction = funcName;
            currentFocusModule = modulePath;
            updateView();
            document.querySelectorAll('.module-card').forEach(function(c) { c.classList.toggle('active', c.dataset.module === modulePath); });
            document.querySelectorAll('.func-item').forEach(function(el) {
                el.classList.toggle('active', el.dataset.func === funcName && el.dataset.module === modulePath);
            });
            const info = document.getElementById('focusInfo');
            info.classList.add('active');
            document.getElementById('focusTitle').textContent = '🎯 Функция: ' + funcName;
            let funcData = null;
            for (const node of graphNodes) {
                if (node.type === 'function' && node.name === funcName && node.module === modulePath) { funcData = node; break; }
            }
            if (funcData) {
                const displayName = modulePath.split('/').pop() || modulePath;
                document.getElementById('focusDetails').textContent = 'Модуль: ' + displayName + ' | Параметры: ' + (funcData.params || []).join(', ') || 'нет' +
                    ' | Вызовов: ' + (funcData.calls || []).length + ' | Кем вызвана: ' + (funcData.calledBy || []).length;
            }
            showDetail(funcData || { name: funcName, module: modulePath });
            const el = document.querySelector('.func-item[data-func="' + funcName + '"][data-module="' + modulePath + '"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function clearFocus() {
            currentFocusModule = null;
            currentFocusFunction = null;
            document.getElementById('focusInfo').classList.remove('active');
            document.querySelectorAll('.module-card').forEach(function(c) { c.classList.remove('active'); });
            document.querySelectorAll('.func-item').forEach(function(el) { el.classList.remove('active'); });
            closeDetail();
            updateView();
        }

        function updateView() {
            const container = document.getElementById('d3GraphWrapper');
            const width = container.clientWidth || 900;
            const height = 700;
            buildGraphData();
            renderGraph(width, height);
        }

        function showDetail(data) {
            const panel = document.getElementById('detailPanel');
            document.getElementById('dpTitle').textContent = data.name || 'Функция';
            let html = '';
            html += '<div class="dp-section"><h4>Информация</h4>';
            html += '<div class="item"><span class="label">Модуль:</span> ' + (data.module || 'неизвестен') + '</div>';
            html += '<div class="item"><span class="label">Строка:</span> ' + (data.line || 0) + '</div>';
            html += '<div class="item"><span class="label">Экспортирована:</span> ' + (data.isExported ? '✅' : '❌') + '</div>';
            html += '<div class="item"><span class="label">Асинхронная:</span> ' + (data.isAsync ? '✅' : '❌') + '</div>';
            html += '<div class="item"><span class="label">Возврат:</span> ' + (data.returnType || 'any') + '</div>';
            html += '</div>';
            const params = data.params || [];
            if (params.length > 0) {
                html += '<div class="dp-section"><h4>Параметры</h4>';
                for (const p of params) html += '<div class="item">' + escapeHtml(p) + '</div>';
                html += '</div>';
            }
            const calls = data.calls || [];
            if (calls.length > 0) {
                html += '<div class="dp-section"><h4>📞 Вызовы (кто вызывается)</h4>';
                for (const call of calls) {
                    html += '<div class="item" style="cursor:pointer;color:#f59e0b;" onclick="focusFunction(\'' + escapeHtml(call) + '\', \'' + escapeHtml(data.module || '') + '\')">→ ' + escapeHtml(call) + '</div>';
                }
                html += '</div>';
            }
            const calledBy = data.calledBy || [];
            if (calledBy.length > 0) {
                html += '<div class="dp-section"><h4>📥 Кто вызывает</h4>';
                for (const caller of calledBy) {
                    html += '<div class="item" style="cursor:pointer;color:#3b82f6;" onclick="focusFunction(\'' + escapeHtml(caller) + '\', \'' + escapeHtml(data.module || '') + '\')">← ' + escapeHtml(caller) + '</div>';
                }
                html += '</div>';
            }
            if (data.body) {
                const bodyPreview = data.body.length > 200 ? data.body.substring(0, 200) + '...' : data.body;
                html += '<div class="dp-section"><h4>Тело (сокращённо)</h4>';
                html += '<div class="item" style="font-size:10px;color:#94a3b8;white-space:pre-wrap;background:#0f172a;padding:8px;border-radius:4px;">' + escapeHtml(bodyPreview) + '</div>';
                html += '</div>';
            }
            document.getElementById('dpContent').innerHTML = html;
            panel.classList.add('active');
        }

        function closeDetail() { document.getElementById('detailPanel').classList.remove('active'); }

        let searchTimeout = null;
        function handleSearch(query) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() { updateView(); }, 300);
        }

        function setupKeyboard() {
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') { clearFocus(); closeDetail(); }
                if (e.key === 'f' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.getElementById('searchInput').focus(); }
            });
            document.addEventListener('click', function(e) {
                const panel = document.getElementById('detailPanel');
                if (panel.classList.contains('active') && !panel.contains(e.target) && !e.target.closest('.func-item')) { closeDetail(); }
            });
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        document.addEventListener('DOMContentLoaded', init);
    `;
  htmlContent += '    <\/script>\n';
  htmlContent += '<\/body>\n';
  htmlContent += '<\/html>';

  // Сохраняем HTML файл
  fs.writeFileSync(outputPath, htmlContent, 'utf-8');
  console.log(`  ✅ interactive-report.html (интерактивный граф на D3.js)`);
}

export default {
  generateInteractiveHTML,
};
