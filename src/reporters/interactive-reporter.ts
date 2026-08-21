// src/reporters/interactive-reporter.ts
import fs from 'fs';
import path from 'path';
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
  complexity?: number;
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
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
      name: e.name || 'unknown',
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
      complexity: e.metadata?.complexity || 1,
      security: e.metadata?.security || {
        hasEval: false,
        hasProcessEnv: false,
        hasSensitiveData: false,
        hasExec: false,
        hasPassword: false,
      },
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

/**
 * Безопасно преобразует данные в JSON строку для вставки в JavaScript
 */
function safeStringifyForJS(obj: any): string {
  try {
    const json = JSON.stringify(obj, (_key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'function') {
        return '[Function]';
      }
      if (value === undefined) {
        return null;
      }
      return value;
    });
    return json
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
      .replace(/\b/g, '\\b');
  } catch (error) {
    console.warn('⚠️ Failed to stringify data:', error);
    return '{}';
  }
}

// ============================================================
// ГЕНЕРАЦИЯ HTML С D3.JS
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

  // Если файл не загружен, используем данные из анализа
  if (!report) {
    report = buildReportFromAnalysis(analysis);
  }

  // Обогащение данными из entitiesWithCalls
  if (entitiesWithCalls) {
    console.log('📊 Обогащение данными из entitiesWithCalls...');

    const funcsByModule = new Map<string, any[]>();
    for (const func of entitiesWithCalls.functions || []) {
      const modulePath = func._modulePath || func.modulePath || '';
      if (!funcsByModule.has(modulePath)) {
        funcsByModule.set(modulePath, []);
      }
      funcsByModule.get(modulePath)!.push(func);
    }

    for (const [modulePath, enrichedFuncs] of funcsByModule) {
      let targetPkg = null;
      let targetPath = modulePath;

      if (report.packages[modulePath]) {
        targetPkg = report.packages[modulePath];
      } else {
        for (const [pkgPath, pkg] of Object.entries(report.packages)) {
          if (pkgPath.includes(modulePath) || modulePath.includes(pkgPath)) {
            targetPkg = pkg;
            targetPath = pkgPath;
            break;
          }
        }
      }

      if (targetPkg && enrichedFuncs.length > 0) {
        targetPkg.entities.functions = enrichedFuncs.map((f: any) => ({
          name: f.name || 'unknown',
          params: f.params || [],
          paramTypes: f.paramTypes || [],
          line: f.line || 0,
          startLine: f.startLine || f.line || 0,
          endLine: f.endLine || f.line || 0,
          isAsync: f.isAsync || false,
          isExported: f.isExported || false,
          isMethod: f.isMethod || false,
          className: f.className || '',
          calls: f.calls || [],
          calledBy: f.calledBy || [],
          returnType: f.returnType || 'any',
          body: f.body || '',
          isNested: f.isNested || false,
          parentFunction: f.parentFunction,
          isArrow: f.isArrow || false,
          isEventHandler: f.isEventHandler || false,
          eventType: f.eventType,
          depth: f.depth || 0,
          complexity: f.complexity || 1,
          security: f.security || {
            hasEval: false,
            hasProcessEnv: false,
            hasSensitiveData: false,
            hasExec: false,
            hasPassword: false,
          },
        }));
        console.log(`  ✅ Обогащено ${enrichedFuncs.length} функций для ${targetPath}`);
      }
    }

    // Пересчитываем статистику
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

  // ============================================================
  // СБОР ДАННЫХ ДЛЯ JAVASCRIPT
  // ============================================================

  const allFunctions: { modulePath: string; func: PackageLockFunctionInfo }[] = [];
  for (const [modulePath, pkg] of Object.entries(report.packages)) {
    if (!pkg) continue;
    for (const func of pkg.entities.functions) {
      allFunctions.push({ modulePath, func });
    }
  }

  const moduleStats = Object.entries(report.packages)
    .filter(([_modulePath, pkg]) => pkg)
    .map(([modulePath, pkg]) => ({
      path: modulePath,
      name: pkg.displayPath || path.basename(modulePath),
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

  const totalModulesByType = moduleStats.reduce((acc, m) => {
    const lang = m.language || 'javascript';
    acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const entryModules = moduleStats.filter(m => m.isEntry);
  const entryNames = entryModules.map(m => escapeHtml(m.name)).join(', ');

  // Безопасная сериализация данных для вставки в JavaScript
  const reportJson = safeStringifyForJS(report);
  const functionsJson = safeStringifyForJS(allFunctions);

  // Статистика
  const totalFunctions = report.entityStats?.totalFunctions || 0;
  const totalCalls = report.entityStats?.totalCalls || 0;
  const totalExported = report.entityStats?.totalExportedFunctions || 0;
  const totalAsync = report.entityStats?.totalAsyncFunctions || 0;
  const totalFiles = report.fileStats?.totalFiles || 0;
  const totalLines = report.fileStats?.totalLines || 0;
  const totalSize = report.fileStats?.totalSize || 0;

  // Используем path для формирования путей
  const outputDir = path.dirname(outputPath);
  const fileName = path.basename(outputPath);
  console.log(`📁 Выходная директория: ${outputDir}`);
  console.log(`📄 Имя файла: ${fileName}`);

  // ============================================================
  // ГЕНЕРАЦИЯ HTML
  // ============================================================

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
  htmlContent += '            font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n';
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
  htmlContent += '        .controls-bar .group-label { font-size: 11px; color: #94a3b8; margin-right: 4px; }\n';
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
  htmlContent += '        .controls-bar button.active { background: #60a5fa; color: #0f172a; font-weight: 600; }\n';
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
  htmlContent += '        .controls-bar .hint { font-size: 11px; color: #64748b; margin-left: auto; }\n';
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
  htmlContent += '        .graph-tooltip .tt-title { font-weight: 600; color: #60a5fa; font-size: 14px; }\n';
  htmlContent += '        .graph-tooltip .tt-info { font-size: 12px; color: #94a3b8; margin-top: 4px; }\n';
  htmlContent += '        .graph-tooltip .tt-detail { font-size: 11px; color: #e2e8f0; margin-top: 6px; font-family: monospace; white-space: pre-wrap; }\n';
  htmlContent += '        .legend {\n';
  htmlContent += '            display: flex;\n';
  htmlContent += '            gap: 16px;\n';
  htmlContent += '            flex-wrap: wrap;\n';
  htmlContent += '            padding: 8px 0;\n';
  htmlContent += '            font-size: 12px;\n';
  htmlContent += '        }\n';
  htmlContent += '        .legend-item { display: flex; align-items: center; gap: 6px; }\n';
  htmlContent += '        .legend-color { width: 16px; height: 16px; border-radius: 4px; border: 1px solid #475569; }\n';
  htmlContent += '        .focus-info {\n';
  htmlContent += '            background: #1e293b;\n';
  htmlContent += '            border-radius: 8px;\n';
  htmlContent += '            padding: 12px 16px;\n';
  htmlContent += '            margin-bottom: 16px;\n';
  htmlContent += '            border: 1px solid #22d3ee;\n';
  htmlContent += '            display: none;\n';
  htmlContent += '        }\n';
  htmlContent += '        .focus-info.active { display: block; }\n';
  htmlContent += '        .focus-info .title { color: #22d3ee; font-weight: 600; font-size: 14px; }\n';
  htmlContent += '        .focus-info .details { color: #94a3b8; font-size: 12px; margin-top: 4px; }\n';
  htmlContent += '        .focus-info .close-btn { background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; float: right; }\n';
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
  htmlContent += '        .module-card:hover { border-color: #60a5fa; transform: translateY(-2px); }\n';
  htmlContent += '        .module-card.active { border-color: #22d3ee; box-shadow: 0 0 20px rgba(34, 211, 238, 0.15); }\n';
  htmlContent += '        .module-card .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }\n';
  htmlContent += '        .module-card .name { font-size: 14px; font-weight: 600; color: #60a5fa; word-break: break-all; }\n';
  htmlContent += '        .module-card .name .entry { color: #fbbf24; font-size: 12px; }\n';
  htmlContent += '        .module-card .path { font-size: 10px; color: #64748b; font-family: monospace; word-break: break-all; margin-top: 2px; }\n';
  htmlContent += '        .module-card .badges { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }\n';
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
  htmlContent += '        .badge.lines { background: #1e293b; color: #64748b; border: 1px solid #334155; }\n';
  htmlContent += '        .module-card .functions-list { margin-top: 8px; max-height: 300px; overflow-y: auto; }\n';
  htmlContent += '        .functions-list::-webkit-scrollbar { width: 4px; }\n';
  htmlContent += '        .functions-list::-webkit-scrollbar-track { background: transparent; }\n';
  htmlContent += '        .functions-list::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }\n';
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
  htmlContent += '        .func-item.active { background: #1a1a3a; border-left-color: #22d3ee; box-shadow: 0 0 12px rgba(34, 211, 238, 0.1); }\n';
  htmlContent += '        .func-item .func-name { color: #e2e8f0; }\n';
  htmlContent += '        .func-item .func-export { color: #f87171; font-size: 9px; }\n';
  htmlContent += '        .func-item .func-async { color: #fbbf24; font-size: 9px; }\n';
  htmlContent += '        .func-item .func-params { color: #94a3b8; font-size: 10px; }\n';
  htmlContent += '        .func-item .func-calls { color: #f59e0b; font-size: 10px; }\n';
  htmlContent += '        .func-item .func-called { color: #3b82f6; font-size: 10px; }\n';
  htmlContent += '        .func-item .func-line { color: #64748b; font-size: 9px; margin-left: auto; }\n';
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
  htmlContent += '        .detail-panel::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }\n';
  htmlContent += '        .detail-panel .dp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }\n';
  htmlContent += '        .detail-panel .dp-title { font-size: 18px; font-weight: 600; color: #60a5fa; }\n';
  htmlContent += '        .detail-panel .dp-close { background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; }\n';
  htmlContent += '        .detail-panel .dp-close:hover { color: #f87171; }\n';
  htmlContent += '        .detail-panel .dp-section { margin-top: 10px; padding: 8px 0; border-top: 1px solid #334155; }\n';
  htmlContent += '        .detail-panel .dp-section:first-child { border-top: none; }\n';
  htmlContent += '        .detail-panel .dp-section h4 { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }\n';
  htmlContent += '        .detail-panel .dp-section .item { font-size: 12px; color: #e2e8f0; padding: 2px 0; font-family: monospace; }\n';
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
  htmlContent += '            .detail-panel { right: 10px; left: 10px; max-width: none; min-width: auto; top: auto; bottom: 10px; transform: none; max-height: 60vh; }\n';
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
  htmlContent += '                <span class="stat">📁 <strong id="statModules">' + totalFiles + '</strong> модулей</span>\n';
  htmlContent += '                <span class="stat">ƒ <strong id="statFunctions">' + totalFunctions + '</strong> функций</span>\n';
  htmlContent += '                <span class="stat">📞 <strong id="statCalls">' + totalCalls + '</strong> вызовов</span>\n';
  htmlContent += '                <span class="stat">📤 <strong id="statExported">' + totalExported + '</strong> экспортировано</span>\n';
  htmlContent += '                <span class="stat">⚡ <strong id="statAsync">' + totalAsync + '</strong> async</span>\n';
  htmlContent += '                <span class="stat">📝 <strong id="statLines">' + totalLines + '</strong> строк</span>\n';
  htmlContent += '                <span class="stat">💾 <strong id="statSize">' + (totalSize / 1024).toFixed(2) + '</strong> KB</span>\n';
  htmlContent += '            </div>\n';
  htmlContent += '            <div class="sub" style="margin-top: 8px;">📊 По типам: ';

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
  htmlContent += '            <div class="sub">Сгенерировано: ' + new Date().toLocaleString() + '</div>\n';
  htmlContent += '        </div>\n';
  htmlContent += '        <div class="controls-bar">\n';
  htmlContent += '            <div class="group">\n';
  htmlContent += '                <span class="group-label">Режим:</span>\n';
  htmlContent += '                <button class="active" data-mode="all" onclick="setMode(\'all\')">🌐 Все</button>\n';
  htmlContent += '                <button data-mode="inward" onclick="setMode(\'inward\')">📥 Входящие</button>\n';
  htmlContent += '                <button data-mode="outward" onclick="setMode(\'outward\')">📤 Исходящие</button>\n';
  htmlContent += '                <button data-mode="both" onclick="setMode(\'both\')">🔁 Оба</button>\n';
  htmlContent += '            </div>\n';
  htmlContent += '            <div class="group">\n';
  htmlContent += '                <span class="group-label">Фокус:</span>\n';
  htmlContent += '                <button onclick="clearFocus()">✕ Очистить</button>\n';
  htmlContent += '            </div>\n';
  htmlContent += '            <input class="search-input" id="searchInput" placeholder="🔍 Поиск..." oninput="handleSearch(this.value)">\n';
  htmlContent += '            <span class="hint">💡 Клик → детали | ⭐ Точка входа</span>\n';
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
  htmlContent += '                <div class="legend-item"><div class="legend-color" style="background:#fbbf24;"></div><span>⭐ Точка входа</span></div>\n';
  htmlContent += '                <div class="legend-item"><div class="legend-color" style="background:#f87171;"></div><span>📤 Экспортированная функция</span></div>\n';
  htmlContent += '                <div class="legend-item"><div class="legend-color" style="background:#fbbf24;"></div><span>Внутренняя функция</span></div>\n';
  htmlContent += '                <div class="legend-item"><div class="legend-color" style="background:#22d3ee;"></div><span>🎯 Активный (фокус)</span></div>\n';
  htmlContent += '                <div class="legend-item"><div class="legend-color" style="background:#f59e0b; width:30px; height:3px;"></div><span>Вызов →</span></div>\n';
  htmlContent += '                <div class="legend-item"><div class="legend-color" style="background:#3b82f6; width:30px; height:3px;"></div><span>Импорт →</span></div>\n';
  htmlContent += '                <div class="legend-item"><div class="legend-color" style="background:#f59e0b; width:30px; height:3px; style=dashed;"></div><span>← Обратная связь</span></div>\n';
  htmlContent += '            </div>\n';
  htmlContent += '        </div>\n';
  htmlContent += '        <div id="modulesContainer">\n';
  htmlContent += '            <h2 style="margin: 20px 0 12px; color:#60a5fa; font-size:18px;">📁 Модули</h2>\n';
  htmlContent += '            <div class="modules-grid" id="modulesGrid"></div>\n';
  htmlContent += '        </div>\n';
  htmlContent += '        <div class="detail-panel" id="detailPanel">\n';
  htmlContent += '            <div class="dp-header">\n';
  htmlContent += '                <div class="dp-title" id="dpTitle">Детали</div>\n';
  htmlContent += '                <button class="dp-close" onclick="closeDetail()">✕</button>\n';
  htmlContent += '            </div>\n';
  htmlContent += '            <div id="dpContent"></div>\n';
  htmlContent += '        </div>\n';
  htmlContent += '        <div class="footer">\n';
  htmlContent += '            <p>Сгенерировано AST Analyzer v3.0.0</p>\n';
  htmlContent += '        </div>\n';
  htmlContent += '    </div>\n';

  // ============================================================
  // JAVASCRIPT - ИСПОЛЬЗУЕМ reportJson И functionsJson
  // ============================================================
  htmlContent += '    <script>\n';
  htmlContent += '        // Данные экранированы для безопасной вставки\n';
  htmlContent += '        const reportData = ' + reportJson + ';\n';
  htmlContent += '        const allFunctionsData = ' + functionsJson + ';\n';
  htmlContent += '        let currentMode = "all";\n';
  htmlContent += '        let currentFocus = null;\n';
  htmlContent += '        let currentFocusType = null;\n';
  htmlContent += '        let simulation = null;\n';
  htmlContent += '        let svg = null;\n';
  htmlContent += '        let g = null;\n';
  htmlContent += '        let zoom = null;\n';
  htmlContent += '        let graphNodes = [];\n';
  htmlContent += '        let graphLinks = [];\n';
  htmlContent += '        let nodeMap = new Map();\n';
  htmlContent += '\n';
  htmlContent += '        function setMode(mode) {\n';
  htmlContent += '            currentMode = mode;\n';
  htmlContent += '            document.querySelectorAll("[data-mode]").forEach(function(b) {\n';
  htmlContent += '                b.classList.toggle("active", b.dataset.mode === mode);\n';
  htmlContent += '            });\n';
  htmlContent += '            console.log("Mode changed to:", mode);\n';
  htmlContent += '            updateView();\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function init() {\n';
  htmlContent += '            // Проверяем данные\n';
  htmlContent += '            let totalFuncs = 0;\n';
  htmlContent += '            for (const pkg of Object.values(reportData.packages || {})) {\n';
  htmlContent += '                if (pkg && pkg.entities && pkg.entities.functions) {\n';
  htmlContent += '                    totalFuncs += pkg.entities.functions.length;\n';
  htmlContent += '                }\n';
  htmlContent += '            }\n';
  htmlContent += '            console.log("📊 Loaded", Object.keys(reportData.packages || {}).length, "modules,", totalFuncs, "functions");\n';
  htmlContent += '            \n';
  htmlContent += '            // Если функций нет, используем allFunctionsData\n';
  htmlContent += '            if (totalFuncs === 0 && allFunctionsData.length > 0) {\n';
  htmlContent += '                console.log("🔄 Enriching with allFunctionsData...");\n';
  htmlContent += '                if (!reportData.packages || Object.keys(reportData.packages).length === 0) {\n';
  htmlContent += '                    reportData.packages = {};\n';
  htmlContent += '                }\n';
  htmlContent += '                for (const item of allFunctionsData) {\n';
  htmlContent += '                    if (!reportData.packages[item.modulePath]) {\n';
  htmlContent += '                        reportData.packages[item.modulePath] = {\n';
  htmlContent += '                            version: "1.0.0",\n';
  htmlContent += '                            resolved: "file:" + item.modulePath,\n';
  htmlContent += '                            displayPath: item.modulePath,\n';
  htmlContent += '                            type: "module",\n';
  htmlContent += '                            language: "typescript",\n';
  htmlContent += '                            isEntry: false,\n';
  htmlContent += '                            imports: {},\n';
  htmlContent += '                            exports: {},\n';
  htmlContent += '                            entities: { functions: [] },\n';
  htmlContent += '                            fileStats: { size: 0, lines: 0, functions: 0, classes: 0, constants: 0, interfaces: 0, types: 0, variables: 0 }\n';
  htmlContent += '                        };\n';
  htmlContent += '                    }\n';
  htmlContent += '                    if (item.func && item.func.name) {\n';
  htmlContent += '                        reportData.packages[item.modulePath].entities.functions.push(item.func);\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '                let newTotal = 0;\n';
  htmlContent += '                for (const pkg of Object.values(reportData.packages)) {\n';
  htmlContent += '                    if (pkg && pkg.entities && pkg.entities.functions) {\n';
  htmlContent += '                        newTotal += pkg.entities.functions.length;\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '                console.log("📊 After enrichment:", Object.keys(reportData.packages).length, "modules,", newTotal, "functions");\n';
  htmlContent += '            }\n';
  htmlContent += '            \n';
  htmlContent += '            renderModules();\n';
  htmlContent += '            initGraph();\n';
  htmlContent += '            updateView();\n';
  htmlContent += '            setupKeyboard();\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function renderModules() {\n';
  htmlContent += '            const grid = document.getElementById("modulesGrid");\n';
  htmlContent += '            if (!grid) return;\n';
  htmlContent += '            grid.innerHTML = "";\n';
  htmlContent += '            const entries = Object.entries(reportData.packages || {});\n';
  htmlContent += '            entries.sort((a, b) => (a[1]?.isEntry ? 0 : 1) - (b[1]?.isEntry ? 0 : 1));\n';
  htmlContent += '            for (const [modulePath, pkg] of entries) {\n';
  htmlContent += '                if (!pkg) continue;\n';
  htmlContent += '                const card = document.createElement("div");\n';
  htmlContent += '                card.className = "module-card";\n';
  htmlContent += '                card.dataset.module = modulePath;\n';
  htmlContent += '                card.onclick = () => focusModule(modulePath);\n';
  htmlContent += '                const funcs = pkg.entities?.functions || [];\n';
  htmlContent += '                const isEntry = pkg.isEntry || false;\n';
  htmlContent += '                const name = pkg.displayPath || modulePath.split("/").pop() || modulePath;\n';
  htmlContent += '                let html = "<div class=\\"header-row\\">" +\n';
  htmlContent += '                    "<div><div class=\\"name\\">" + (isEntry ? "⭐ " : "") + escapeHtml(name) + "</div>" +\n';
  htmlContent += '                    "<div class=\\"path\\">" + escapeHtml(modulePath) + "</div></div>" +\n';
  htmlContent += '                    "<span class=\\"badge fn\\">" + funcs.length + " функций</span>" +\n';
  htmlContent += '                    "</div>" +\n';
  htmlContent += '                    "<div class=\\"functions-list\\">";\n';
  htmlContent += '                const hasNamedFunctions = funcs.some(f => f.name && f.name !== "unknown" && f.name !== "");\n';
  htmlContent += '                if (funcs.length > 0 && hasNamedFunctions) {\n';
  htmlContent += '                    for (const func of funcs) {\n';
  htmlContent += '                        const funcName = func.name || "anonymous";\n';
  htmlContent += '                        if (!funcName || funcName === "" || funcName === "unknown") continue;\n';
  htmlContent += '                        html += "<div class=\\"func-item\\" onclick=\\"event.stopPropagation(); focusFunction(\\"" + escapeHtml(funcName) + "\\", \\"" + escapeHtml(modulePath) + "\\")\\" data-func=\\"" + escapeHtml(funcName) + "\\">" +\n';
  htmlContent += '                            "<span class=\\"func-name\\">" + escapeHtml(funcName) + "</span>" +\n';
  htmlContent += '                            (func.isExported ? "<span class=\\"func-export\\">📤</span>" : "") +\n';
  htmlContent += '                            (func.isAsync ? "<span class=\\"func-async\\">⚡</span>" : "") +\n';
  htmlContent += '                            (func.params && func.params.length > 0 ? "<span class=\\"func-params\\">(" + func.params.slice(0, 3).join(", ") + (func.params.length > 3 ? ", ..." : "") + ")</span>" : "") +\n';
  htmlContent += '                            (func.calls && func.calls.length > 0 ? "<span class=\\"func-calls\\">→ " + func.calls.length + "</span>" : "") +\n';
  htmlContent += '                            (func.calledBy && func.calledBy.length > 0 ? "<span class=\\"func-called\\">← " + func.calledBy.length + "</span>" : "") +\n';
  htmlContent += '                            (func.line && func.line > 0 ? "<span class=\\"func-line\\">стр." + func.line + "</span>" : "") +\n';
  htmlContent += '                            "</div>";\n';
  htmlContent += '                    }\n';
  htmlContent += '                } else {\n';
  htmlContent += '                    html += "<div style=\\"color:#64748b;font-size:11px;padding:4px 0;\\">Нет функций с именами</div>";\n';
  htmlContent += '                }\n';
  htmlContent += '                html += "</div>";\n';
  htmlContent += '                card.innerHTML = html;\n';
  htmlContent += '                grid.appendChild(card);\n';
  htmlContent += '            }\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function initGraph() {\n';
  htmlContent += '            const container = document.getElementById("d3GraphWrapper");\n';
  htmlContent += '            if (!container) return;\n';
  htmlContent += '            const width = container.clientWidth || 900;\n';
  htmlContent += '            const height = 700;\n';
  htmlContent += '            container.innerHTML = "";\n';
  htmlContent += '            svg = d3.select(container).append("svg")\n';
  htmlContent += '                .attr("width", width).attr("height", height)\n';
  htmlContent += '                .style("background", "#0f172a").style("border-radius", "8px");\n';
  htmlContent += '\n';
  htmlContent += '            const defs = svg.append("defs");\n';
  htmlContent += '            defs.append("marker")\n';
  htmlContent += '                .attr("id", "arrow-call")\n';
  htmlContent += '                .attr("viewBox", "0 0 10 10").attr("refX", 10).attr("refY", 5)\n';
  htmlContent += '                .attr("markerWidth", 8).attr("markerHeight", 8)\n';
  htmlContent += '                .attr("orient", "auto")\n';
  htmlContent += '                .append("path").attr("d", "M 0 0 L 10 5 L 0 10 Z")\n';
  htmlContent += '                .attr("fill", "#f59e0b");\n';
  htmlContent += '            defs.append("marker")\n';
  htmlContent += '                .attr("id", "arrow-import")\n';
  htmlContent += '                .attr("viewBox", "0 0 10 10").attr("refX", 10).attr("refY", 5)\n';
  htmlContent += '                .attr("markerWidth", 8).attr("markerHeight", 8)\n';
  htmlContent += '                .attr("orient", "auto")\n';
  htmlContent += '                .append("path").attr("d", "M 0 0 L 10 5 L 0 10 Z")\n';
  htmlContent += '                .attr("fill", "#3b82f6");\n';
  htmlContent += '            defs.append("marker")\n';
  htmlContent += '                .attr("id", "arrow-cycle")\n';
  htmlContent += '                .attr("viewBox", "0 0 10 10").attr("refX", 10).attr("refY", 5)\n';
  htmlContent += '                .attr("markerWidth", 8).attr("markerHeight", 8)\n';
  htmlContent += '                .attr("orient", "auto")\n';
  htmlContent += '                .append("path").attr("d", "M 0 0 L 10 5 L 0 10 Z")\n';
  htmlContent += '                .attr("fill", "#ef4444");\n';
  htmlContent += '\n';
  htmlContent += '            g = svg.append("g");\n';
  htmlContent += '            zoom = d3.zoom().extent([[0,0],[width,height]]).scaleExtent([0.1,4])\n';
  htmlContent += '                .on("zoom", function(event) { g.attr("transform", event.transform); });\n';
  htmlContent += '            svg.call(zoom);\n';
  htmlContent += '            buildGraphData();\n';
  htmlContent += '            renderGraph(width, height);\n';
  htmlContent += '            window.addEventListener("resize", function() { svg.attr("width", container.clientWidth || 900); });\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function buildGraphData() {\n';
  htmlContent += '            graphNodes = []; graphLinks = []; nodeMap = new Map();\n';
  htmlContent += '            const colors = ["#4ade80","#60a5fa","#a78bfa","#f472b6","#fbbf24","#f87171","#22d3ee"];\n';
  htmlContent += '            for (const [modulePath, pkg] of Object.entries(reportData.packages || {})) {\n';
  htmlContent += '                if (!pkg) continue;\n';
  htmlContent += '                const isRoot = pkg.isEntry || false;\n';
  htmlContent += '                const name = pkg.displayPath || modulePath.split("/").pop() || modulePath;\n';
  htmlContent += '                const id = modulePath;\n';
  htmlContent += '                nodeMap.set(id, {\n';
  htmlContent += '                    id, name, fullName: modulePath, type: "module",\n';
  htmlContent += '                    isRoot, color: isRoot ? "#fbbf24" : colors[Object.keys(reportData.packages).indexOf(modulePath) % colors.length],\n';
  htmlContent += '                    size: isRoot ? 40 : 28, functions: pkg.entities?.functions || []\n';
  htmlContent += '                });\n';
  htmlContent += '                graphNodes.push(nodeMap.get(id));\n';
  htmlContent += '                for (const func of (pkg.entities?.functions || [])) {\n';
  htmlContent += '                    if (!func.name || func.name === "unknown" || func.name === "") continue;\n';
  htmlContent += '                    const fid = modulePath + "#" + func.name;\n';
  htmlContent += '                    if (!nodeMap.has(fid)) {\n';
  htmlContent += '                        nodeMap.set(fid, {\n';
  htmlContent += '                            id: fid, name: func.name, fullName: func.name,\n';
  htmlContent += '                            type: "function", module: modulePath,\n';
  htmlContent += '                            isExported: func.isExported || false,\n';
  htmlContent += '                            isAsync: func.isAsync || false,\n';
  htmlContent += '                            color: func.isExported ? "#f87171" : "#fbbf24",\n';
  htmlContent += '                            size: 8, calls: func.calls || [], calledBy: func.calledBy || [],\n';
  htmlContent += '                            params: func.params || [], returnType: func.returnType || "any",\n';
  htmlContent += '                            line: func.line || 0\n';
  htmlContent += '                        });\n';
  htmlContent += '                        graphNodes.push(nodeMap.get(fid));\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '            }\n';
  htmlContent += '\n';
  htmlContent += '            const outward = reportData.dependencyGraph?.outwardDependencies || {};\n';
  htmlContent += '            const added = new Set();\n';
  htmlContent += '            for (const [from, deps] of Object.entries(outward)) {\n';
  htmlContent += '                for (const to of (deps || [])) {\n';
  htmlContent += '                    const key = from + "->" + to;\n';
  htmlContent += '                    if (!added.has(key) && nodeMap.has(from) && nodeMap.has(to)) {\n';
  htmlContent += '                        added.add(key);\n';
  htmlContent += '                        graphLinks.push({ source: from, target: to, type: "import", isCall: false });\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '            }\n';
  htmlContent += '\n';
  htmlContent += '            for (const node of graphNodes) {\n';
  htmlContent += '                if (node.type !== "function") continue;\n';
  htmlContent += '                for (const call of (node.calls || [])) {\n';
  htmlContent += '                    const target = node.module + "#" + call;\n';
  htmlContent += '                    if (nodeMap.has(target)) {\n';
  htmlContent += '                        const key = node.id + "->" + target;\n';
  htmlContent += '                        if (!added.has(key)) {\n';
  htmlContent += '                            added.add(key);\n';
  htmlContent += '                            graphLinks.push({ source: node.id, target: target, type: "call", isCall: true });\n';
  htmlContent += '                        }\n';
  htmlContent += '                    } else {\n';
  htmlContent += '                        for (const other of graphNodes) {\n';
  htmlContent += '                            if (other.type === "function" && other.name === call && other.module === node.module) {\n';
  htmlContent += '                                const key = node.id + "->" + other.id;\n';
  htmlContent += '                                if (!added.has(key)) {\n';
  htmlContent += '                                    added.add(key);\n';
  htmlContent += '                                    graphLinks.push({ source: node.id, target: other.id, type: "call", isCall: true });\n';
  htmlContent += '                                }\n';
  htmlContent += '                                break;\n';
  htmlContent += '                            }\n';
  htmlContent += '                        }\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '            }\n';
  htmlContent += '            graphLinks = graphLinks.filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function renderGraph(width, height) {\n';
  htmlContent += '            if (!g) return;\n';
  htmlContent += '            g.selectAll("*").remove();\n';
  htmlContent += '\n';
  htmlContent += '            let filtered = graphNodes;\n';
  htmlContent += '            let filteredLinks = graphLinks;\n';
  htmlContent += '\n';
  htmlContent += '            // Фильтр по режиму\n';
  htmlContent += '            if (currentMode === "inward") {\n';
  htmlContent += '                const hasInward = new Set();\n';
  htmlContent += '                for (const link of graphLinks) {\n';
  htmlContent += '                    if (link.target === currentFocus) {\n';
  htmlContent += '                        hasInward.add(link.source);\n';
  htmlContent += '                        hasInward.add(link.target);\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '                if (hasInward.size > 0) {\n';
  htmlContent += '                    filtered = graphNodes.filter(n => hasInward.has(n.id));\n';
  htmlContent += '                    filteredLinks = graphLinks.filter(l => hasInward.has(l.source) && hasInward.has(l.target));\n';
  htmlContent += '                }\n';
  htmlContent += '            } else if (currentMode === "outward") {\n';
  htmlContent += '                const hasOutward = new Set();\n';
  htmlContent += '                for (const link of graphLinks) {\n';
  htmlContent += '                    if (link.source === currentFocus) {\n';
  htmlContent += '                        hasOutward.add(link.source);\n';
  htmlContent += '                        hasOutward.add(link.target);\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '                if (hasOutward.size > 0) {\n';
  htmlContent += '                    filtered = graphNodes.filter(n => hasOutward.has(n.id));\n';
  htmlContent += '                    filteredLinks = graphLinks.filter(l => hasOutward.has(l.source) && hasOutward.has(l.target));\n';
  htmlContent += '                }\n';
  htmlContent += '            } else if (currentMode === "both") {\n';
  htmlContent += '                const hasBoth = new Set();\n';
  htmlContent += '                for (const link of graphLinks) {\n';
  htmlContent += '                    if (link.source === currentFocus || link.target === currentFocus) {\n';
  htmlContent += '                        hasBoth.add(link.source);\n';
  htmlContent += '                        hasBoth.add(link.target);\n';
  htmlContent += '                    }\n';
  htmlContent += '                }\n';
  htmlContent += '                if (hasBoth.size > 0) {\n';
  htmlContent += '                    filtered = graphNodes.filter(n => hasBoth.has(n.id));\n';
  htmlContent += '                    filteredLinks = graphLinks.filter(l => hasBoth.has(l.source) && hasBoth.has(l.target));\n';
  htmlContent += '                }\n';
  htmlContent += '            }\n';
  htmlContent += '\n';
  htmlContent += '            // Фокус на активном узле\n';
  htmlContent += '            if (currentFocus) {\n';
  htmlContent += '                const related = new Set([currentFocus]);\n';
  htmlContent += '                for (const link of graphLinks) {\n';
  htmlContent += '                    if (link.source === currentFocus) related.add(link.target);\n';
  htmlContent += '                    if (link.target === currentFocus) related.add(link.source);\n';
  htmlContent += '                }\n';
  htmlContent += '                if (currentMode === "all") {\n';
  htmlContent += '                    filtered = graphNodes.filter(n => related.has(n.id));\n';
  htmlContent += '                    filteredLinks = graphLinks.filter(l => related.has(l.source) && related.has(l.target));\n';
  htmlContent += '                }\n';
  htmlContent += '            }\n';
  htmlContent += '\n';
  htmlContent += '            // Поиск\n';
  htmlContent += '            const query = document.getElementById("searchInput").value.toLowerCase().trim();\n';
  htmlContent += '            if (query) {\n';
  htmlContent += '                const matched = new Set();\n';
  htmlContent += '                for (const n of filtered) {\n';
  htmlContent += '                    if (n.name.toLowerCase().includes(query)) matched.add(n.id);\n';
  htmlContent += '                }\n';
  htmlContent += '                const expanded = new Set(matched);\n';
  htmlContent += '                for (const l of filteredLinks) {\n';
  htmlContent += '                    if (matched.has(l.source)) expanded.add(l.target);\n';
  htmlContent += '                    if (matched.has(l.target)) expanded.add(l.source);\n';
  htmlContent += '                }\n';
  htmlContent += '                filtered = filtered.filter(n => expanded.has(n.id));\n';
  htmlContent += '                filteredLinks = filteredLinks.filter(l => expanded.has(l.source) && expanded.has(l.target));\n';
  htmlContent += '            }\n';
  htmlContent += '\n';
  htmlContent += '            const link = g.append("g").selectAll("line").data(filteredLinks).enter().append("line")\n';
  htmlContent += '                .attr("marker-end", d => {\n';
  htmlContent += '                    if (d.isCall) return "url(#arrow-call)";\n';
  htmlContent += '                    return "url(#arrow-import)";\n';
  htmlContent += '                })\n';
  htmlContent += '                .attr("stroke", d => d.isCall ? "#f59e0b" : "#3b82f6")\n';
  htmlContent += '                .attr("stroke-width", d => d.isCall ? 1.5 : 1)\n';
  htmlContent += '                .attr("stroke-opacity", d => {\n';
  htmlContent += '                    if (currentFocus) {\n';
  htmlContent += '                        return (d.source === currentFocus || d.target === currentFocus) ? 0.9 : 0.3;\n';
  htmlContent += '                    }\n';
  htmlContent += '                    return 0.5;\n';
  htmlContent += '                });\n';
  htmlContent += '\n';
  htmlContent += '            const nodeGroup = g.append("g").selectAll("g").data(filtered).enter().append("g")\n';
  htmlContent += '                .attr("cursor", "pointer")\n';
  htmlContent += '                .on("click", function(e, d) {\n';
  htmlContent += '                    if (d.type === "function") showDetail(d);\n';
  htmlContent += '                    else focusModule(d.id);\n';
  htmlContent += '                })\n';
  htmlContent += '                .on("mouseover", function(e, d) { showTooltip(e, d); })\n';
  htmlContent += '                .on("mouseout", hideTooltip)\n';
  htmlContent += '                .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));\n';
  htmlContent += '\n';
  htmlContent += '            const isFocused = (id) => id === currentFocus;\n';
  htmlContent += '            nodeGroup.append("circle")\n';
  htmlContent += '                .attr("r", d => d.size || 10)\n';
  htmlContent += '                .attr("fill", d => {\n';
  htmlContent += '                    if (isFocused(d.id)) return "#22d3ee";\n';
  htmlContent += '                    return d.color || "#94a3b8";\n';
  htmlContent += '                })\n';
  htmlContent += '                .attr("stroke", d => {\n';
  htmlContent += '                    if (isFocused(d.id)) return "#22d3ee";\n';
  htmlContent += '                    if (d.isRoot) return "#fbbf24";\n';
  htmlContent += '                    return "#1e293b";\n';
  htmlContent += '                })\n';
  htmlContent += '                .attr("stroke-width", d => (isFocused(d.id) || d.isRoot) ? 3 : 1.5)\n';
  htmlContent += '                .attr("opacity", d => {\n';
  htmlContent += '                    if (!currentFocus) return 1;\n';
  htmlContent += '                    return isFocused(d.id) ? 1 : 0.15;\n';
  htmlContent += '                });\n';
  htmlContent += '\n';
  htmlContent += '            nodeGroup.append("text")\n';
  htmlContent += '                .attr("dx", d => (d.size || 10) + 10)\n';
  htmlContent += '                .attr("dy", 4)\n';
  htmlContent += '                .attr("font-size", d => d.type === "function" ? "8px" : "11px")\n';
  htmlContent += '                .attr("fill", "#e2e8f0")\n';
  htmlContent += '                .attr("font-family", "monospace")\n';
  htmlContent += '                .text(d => {\n';
  htmlContent += '                    if (d.isRoot) return "⭐ " + d.name;\n';
  htmlContent += '                    if (d.type === "function" && d.isExported) return "📤 " + d.name;\n';
  htmlContent += '                    return d.name;\n';
  htmlContent += '                })\n';
  htmlContent += '                .style("pointer-events", "none")\n';
  htmlContent += '                .attr("opacity", d => {\n';
  htmlContent += '                    if (!currentFocus) return 1;\n';
  htmlContent += '                    return isFocused(d.id) ? 1 : 0.15;\n';
  htmlContent += '                });\n';
  htmlContent += '\n';
  htmlContent += '            nodeGroup.filter(d => d.type === "module" && d.functions && d.functions.length > 0)\n';
  htmlContent += '                .append("text")\n';
  htmlContent += '                .attr("dx", d => (d.size || 10) + 10)\n';
  htmlContent += '                .attr("dy", 16)\n';
  htmlContent += '                .attr("font-size", "7px")\n';
  htmlContent += '                .attr("fill", "#94a3b8")\n';
  htmlContent += '                .text(d => d.functions.filter(f => f.name && f.name !== "unknown").length + " fn")\n';
  htmlContent += '                .style("pointer-events", "none")\n';
  htmlContent += '                .attr("opacity", d => {\n';
  htmlContent += '                    if (!currentFocus) return 1;\n';
  htmlContent += '                    return isFocused(d.id) ? 1 : 0.15;\n';
  htmlContent += '                });\n';
  htmlContent += '\n';
  htmlContent += '            const sim = d3.forceSimulation(filtered)\n';
  htmlContent += '                .force("link", d3.forceLink(filteredLinks).id(d => d.id).distance(d => d.isCall ? 80 : 150))\n';
  htmlContent += '                .force("charge", d3.forceManyBody().strength(d => d.type === "module" ? -400 : -150))\n';
  htmlContent += '                .force("center", d3.forceCenter(width/2, height/2))\n';
  htmlContent += '                .force("collision", d3.forceCollide().radius(d => (d.size || 10) + 20));\n';
  htmlContent += '\n';
  htmlContent += '            sim.on("tick", function() {\n';
  htmlContent += '                link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)\n';
  htmlContent += '                    .attr("x2", d => d.target.x).attr("y2", d => d.target.y);\n';
  htmlContent += '                nodeGroup.attr("transform", d => "translate(" + (d.x||0) + "," + (d.y||0) + ")");\n';
  htmlContent += '            });\n';
  htmlContent += '            simulation = sim;\n';
  htmlContent += '\n';
  htmlContent += '            function dragstarted(e, d) { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }\n';
  htmlContent += '            function dragged(e, d) { d.fx = e.x; d.fy = e.y; }\n';
  htmlContent += '            function dragended(e, d) { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function showTooltip(e, d) {\n';
  htmlContent += '            const tip = document.getElementById("graphTooltip");\n';
  htmlContent += '            if (!tip) return;\n';
  htmlContent += '            const ttTitle = document.getElementById("ttTitle");\n';
  htmlContent += '            const ttInfo = document.getElementById("ttInfo");\n';
  htmlContent += '            const ttDetail = document.getElementById("ttDetail");\n';
  htmlContent += '            if (ttTitle) ttTitle.textContent = d.name;\n';
  htmlContent += '            if (ttInfo) ttInfo.textContent = d.type === "module" ? d.fullName : (d.module || "") + ":" + d.line;\n';
  htmlContent += '            let detail = "";\n';
  htmlContent += '            if (d.type === "function") {\n';
  htmlContent += '                detail += "Параметры: " + (d.params || []).join(", ") || "нет\\n";\n';
  htmlContent += '                detail += "Возврат: " + (d.returnType || "any") + "\\n";\n';
  htmlContent += '                detail += "Вызовов: " + (d.calls || []).length + " →\\n";\n';
  htmlContent += '                detail += "Кем вызвана: ← " + (d.calledBy || []).length;\n';
  htmlContent += '            }\n';
  htmlContent += '            if (ttDetail) ttDetail.textContent = detail;\n';
  htmlContent += '            const rect = document.getElementById("d3GraphWrapper").getBoundingClientRect();\n';
  htmlContent += '            const x = e.clientX - rect.left + 15;\n';
  htmlContent += '            const y = e.clientY - rect.top - 10;\n';
  htmlContent += '            tip.style.display = "block";\n';
  htmlContent += '            tip.style.left = Math.min(x, rect.width - 320) + "px";\n';
  htmlContent += '            tip.style.top = Math.min(y, rect.height - 150) + "px";\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function hideTooltip() {\n';
  htmlContent += '            const tip = document.getElementById("graphTooltip");\n';
  htmlContent += '            if (tip) tip.style.display = "none";\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function focusModule(id) {\n';
  htmlContent += '            if (currentFocus === id) { clearFocus(); return; }\n';
  htmlContent += '            currentFocus = id;\n';
  htmlContent += '            currentFocusType = "module";\n';
  htmlContent += '            updateView();\n';
  htmlContent += '            document.querySelectorAll(".module-card").forEach(c => c.classList.toggle("active", c.dataset.module === id));\n';
  htmlContent += '            const info = document.getElementById("focusInfo");\n';
  htmlContent += '            if (!info) return;\n';
  htmlContent += '            info.classList.add("active");\n';
  htmlContent += '            const node = nodeMap.get(id);\n';
  htmlContent += '            const title = document.getElementById("focusTitle");\n';
  htmlContent += '            const details = document.getElementById("focusDetails");\n';
  htmlContent += '            if (title) title.textContent = "🎯 " + (node?.name || id);\n';
  htmlContent += '            if (details) details.textContent = "Модуль | " + (node?.functions?.filter(f => f.name && f.name !== "unknown").length || 0) + " функций";\n';
  htmlContent += '            const card = document.querySelector(".module-card[data-module=\\"" + id + "\\"]");\n';
  htmlContent += '            if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function focusFunction(name, modulePath) {\n';
  htmlContent += '            const id = modulePath + "#" + name;\n';
  htmlContent += '            if (currentFocus === id) { clearFocus(); return; }\n';
  htmlContent += '            currentFocus = id;\n';
  htmlContent += '            currentFocusType = "function";\n';
  htmlContent += '            updateView();\n';
  htmlContent += '            document.querySelectorAll(".func-item").forEach(el => el.classList.toggle("active", el.dataset.func === name));\n';
  htmlContent += '            const info = document.getElementById("focusInfo");\n';
  htmlContent += '            if (!info) return;\n';
  htmlContent += '            info.classList.add("active");\n';
  htmlContent += '            const title = document.getElementById("focusTitle");\n';
  htmlContent += '            const details = document.getElementById("focusDetails");\n';
  htmlContent += '            if (title) title.textContent = "🎯 " + name;\n';
  htmlContent += '            const node = nodeMap.get(id);\n';
  htmlContent += '            if (details) details.textContent = "Функция | Вызовов: " + (node?.calls?.length || 0) + " → | Кем вызвана: ← " + (node?.calledBy?.length || 0);\n';
  htmlContent += '            showDetail(node || { name, module: modulePath });\n';
  htmlContent += '            const el = document.querySelector(".func-item[data-func=\\"" + name + "\\"]");\n';
  htmlContent += '            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function clearFocus() {\n';
  htmlContent += '            currentFocus = null;\n';
  htmlContent += '            currentFocusType = null;\n';
  htmlContent += '            const info = document.getElementById("focusInfo");\n';
  htmlContent += '            if (info) info.classList.remove("active");\n';
  htmlContent += '            document.querySelectorAll(".module-card").forEach(c => c.classList.remove("active"));\n';
  htmlContent += '            document.querySelectorAll(".func-item").forEach(el => el.classList.remove("active"));\n';
  htmlContent += '            closeDetail();\n';
  htmlContent += '            updateView();\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function updateView() {\n';
  htmlContent += '            const container = document.getElementById("d3GraphWrapper");\n';
  htmlContent += '            const width = container ? container.clientWidth : 900;\n';
  htmlContent += '            const height = 700;\n';
  htmlContent += '            buildGraphData();\n';
  htmlContent += '            renderGraph(width, height);\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function showDetail(data) {\n';
  htmlContent += '            const panel = document.getElementById("detailPanel");\n';
  htmlContent += '            if (!panel) return;\n';
  htmlContent += '            const title = document.getElementById("dpTitle");\n';
  htmlContent += '            const content = document.getElementById("dpContent");\n';
  htmlContent += '            if (title) title.textContent = data.name || "Функция";\n';
  htmlContent += '            let html = "";\n';
  htmlContent += '            html += "<div class=\\"dp-section\\"><h4>Информация</h4>";\n';
  htmlContent += '            html += "<div class=\\"item\\"><span class=\\"label\\">Модуль:</span> " + (data.module || "неизвестен") + "</div>";\n';
  htmlContent += '            html += "<div class=\\"item\\"><span class=\\"label\\">Строка:</span> " + (data.line || 0) + "</div>";\n';
  htmlContent += '            html += "<div class=\\"item\\"><span class=\\"label\\">Экспортирована:</span> " + (data.isExported ? "✅" : "❌") + "</div>";\n';
  htmlContent += '            html += "<div class=\\"item\\"><span class=\\"label\\">Асинхронная:</span> " + (data.isAsync ? "✅" : "❌") + "</div>";\n';
  htmlContent += '            html += "</div>";\n';
  htmlContent += '            const calls = data.calls || [];\n';
  htmlContent += '            if (calls.length > 0) {\n';
  htmlContent += '                html += "<div class=\\"dp-section\\"><h4>📞 Вызовы →</h4>";\n';
  htmlContent += '                for (const c of calls) html += "<div class=\\"item\\" style=\\"cursor:pointer;color:#f59e0b;\\" onclick=\\"focusFunction(\\"" + escapeHtml(c) + "\\", \\"" + escapeHtml(data.module || "") + "\\")\">→ " + escapeHtml(c) + "</div>";\n';
  htmlContent += '                html += "</div>";\n';
  htmlContent += '            }\n';
  htmlContent += '            const calledBy = data.calledBy || [];\n';
  htmlContent += '            if (calledBy.length > 0) {\n';
  htmlContent += '                html += "<div class=\\"dp-section\\"><h4>📥 Кто вызывает ←</h4>";\n';
  htmlContent += '                for (const c of calledBy) html += "<div class=\\"item\\" style=\\"cursor:pointer;color:#3b82f6;\\" onclick=\\"focusFunction(\\"" + escapeHtml(c) + "\\", \\"" + escapeHtml(data.module || "") + "\\")\">← " + escapeHtml(c) + "</div>";\n';
  htmlContent += '                html += "</div>";\n';
  htmlContent += '            }\n';
  htmlContent += '            if (content) content.innerHTML = html;\n';
  htmlContent += '            panel.classList.add("active");\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function closeDetail() {\n';
  htmlContent += '            const panel = document.getElementById("detailPanel");\n';
  htmlContent += '            if (panel) panel.classList.remove("active");\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function handleSearch(query) {\n';
  htmlContent += '            clearTimeout(window._searchTimeout);\n';
  htmlContent += '            window._searchTimeout = setTimeout(updateView, 300);\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function setupKeyboard() {\n';
  htmlContent += '            document.addEventListener("keydown", function(e) {\n';
  htmlContent += '                if (e.key === "Escape") { clearFocus(); closeDetail(); }\n';
  htmlContent += '                if (e.key === "f" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.getElementById("searchInput").focus(); }\n';
  htmlContent += '            });\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        function escapeHtml(str) {\n';
  htmlContent += '            if (!str) return "";\n';
  htmlContent += '            return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\'/g, "&#039;");\n';
  htmlContent += '        }\n';
  htmlContent += '\n';
  htmlContent += '        init();\n';
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
