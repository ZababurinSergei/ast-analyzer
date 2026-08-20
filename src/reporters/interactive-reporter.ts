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
import { Graphviz } from '@hpcc-js/wasm-graphviz';

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
// ГЕНЕРАЦИЯ ЦВЕТОВ ДЛЯ ФАЙЛОВ
// ============================================================

function getFileColor(modulePath: string): string {
  // Используем предопределённые цвета для разных типов файлов
  const typeColors: Record<string, string> = {
    '.ts': '#60a5fa',
    '.tsx': '#a78bfa',
    '.js': '#fbbf24',
    '.jsx': '#f472b6',
    '.vue': '#4ade80',
    '.json': '#fcd34d',
    '.md': '#94a3b8',
  };

  // Проверяем расширение
  for (const [ext, color] of Object.entries(typeColors)) {
    if (modulePath.endsWith(ext)) {
      return color;
    }
  }

  // Генерируем цвет на основе хеша имени файла
  let hash = 0;
  for (let i = 0; i < modulePath.length; i++) {
    hash = modulePath.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

// ============================================================
// ГЕНЕРАЦИЯ DOT ГРАФА
// ============================================================

function generateFullDOT(
  report: PackageLockReport,
  focusModule?: string,
  focusFunction?: string,
  mode: 'all' | 'inward' | 'outward' | 'both' = 'all'
): string {
  const modulePaths = Object.keys(report.packages);

  let dot = 'digraph ProjectGraph {\n';
  dot += '  rankdir=LR;\n';
  dot += '  splines=true;\n';
  dot += '  node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee, penwidth=1];\n\n';

  // Цвета для модулей
  const moduleColors: Record<string, string> = {};
  for (const modulePath of modulePaths) {
    moduleColors[modulePath] = getFileColor(modulePath);
  }

  // --- МОДУЛИ ---
  dot += '  // === МОДУЛИ ===\n';
  for (const [modulePath, pkg] of Object.entries(report.packages)) {
    const isEntry = pkg.isEntry || false;
    const color = moduleColors[modulePath] || '#f3f4f6';
    const fontColor = isEntry ? '#ffffff' : '#1f2937';
    const penwidth = isEntry ? '3' : '1';
    const displayName = pkg.displayPath || path.basename(modulePath);
    const label = isEntry ? `⭐ ${displayName}` : displayName;
    const tooltip = modulePath;

    dot += `  "${modulePath}" [fillcolor="${color}", fontcolor="${fontColor}", penwidth=${penwidth}, label="${label}", tooltip="${tooltip}"];\n`;
  }

  // --- СВЯЗИ МЕЖДУ МОДУЛЯМИ (ModuleGraphEdge) ---
  dot += '\n  // === СВЯЗИ МЕЖДУ МОДУЛЯМИ (ModuleGraphEdge) ===\n';
  const { inwardDependencies, outwardDependencies } = report.dependencyGraph;

  // Для режима фокуса
  let focusModuleSet: Set<string> | null = null;
  if (focusModule) {
    focusModuleSet = new Set([focusModule]);
    if (mode === 'inward' || mode === 'both') {
      const inward = inwardDependencies[focusModule] || [];
      for (const dep of inward) focusModuleSet.add(dep);
    }
    if (mode === 'outward' || mode === 'both') {
      const outward = outwardDependencies[focusModule] || [];
      for (const dep of outward) focusModuleSet.add(dep);
    }
  }

  // Строим ребра модулей
  const addedEdges = new Set<string>();
  for (const [from, deps] of Object.entries(outwardDependencies)) {
    if (focusModuleSet && !focusModuleSet.has(from)) continue;

    for (const to of deps) {
      if (focusModuleSet && !focusModuleSet.has(to)) continue;

      const edgeKey = `${from}->${to}`;
      if (addedEdges.has(edgeKey)) continue;
      addedEdges.add(edgeKey);

      dot += `  "${from}" -> "${to}" [color="#3b82f6", label="import", penwidth=1];\n`;
    }
  }

  // --- СУЩНОСТИ (ФУНКЦИИ) ---
  dot += '\n  // === ФУНКЦИИ (EntityGraphNode) ===\n';

  const functionsToShow: { modulePath: string; func: PackageLockFunctionInfo }[] = [];

  for (const [modulePath, pkg] of Object.entries(report.packages)) {
    if (focusModuleSet && !focusModuleSet.has(modulePath)) continue;

    for (const func of pkg.entities.functions) {
      if (focusFunction && func.name !== focusFunction) {
        const isRelated =
          func.calls.includes(focusFunction) || func.calledBy.includes(focusFunction);
        if (!isRelated && func.name !== focusFunction) continue;
      }
      functionsToShow.push({ modulePath, func });
    }
  }

  const functionsByModule: Record<string, PackageLockFunctionInfo[]> = {};
  for (const { modulePath, func } of functionsToShow) {
    if (!functionsByModule[modulePath]) functionsByModule[modulePath] = [];
    functionsByModule[modulePath].push(func);
  }

  let clusterIndex = 0;
  for (const [modulePath, functions] of Object.entries(functionsByModule)) {
    if (functions.length === 0) continue;

    const moduleColor = moduleColors[modulePath] || '#334155';
    dot += `  subgraph cluster_${clusterIndex} {\n`;
    dot += `    label="${path.basename(modulePath)}";\n`;
    dot += `    style=filled;\n`;
    dot += `    fillcolor="#0f172a";\n`;
    dot += `    color="${moduleColor}";\n`;
    dot += `    penwidth=2;\n`;
    dot += `    fontcolor="#e2e8f0";\n`;
    dot += `    fontsize=11;\n`;

    for (const func of functions) {
      const isExported = func.isExported || false;
      const isAsync = func.isAsync || false;
      const isFocused = focusFunction === func.name;

      const color = isExported ? '#f87171' : isFocused ? '#22d3ee' : '#fbbf24';
      const shape = isFocused ? 'box' : 'ellipse';
      const penwidth = isFocused ? '3' : '1';

      let label = func.name;
      if (isExported) label = `📤 ${label}`;
      if (isAsync) label = `⚡ ${label}`;
      if (isFocused) label = `🎯 ${label}`;
      if (func.params.length > 0) {
        label += `(${func.params.join(', ')})`;
      }

      const id = `${modulePath}#${func.name}`;
      const tooltip = `${func.name}\nParams: ${func.params.join(', ')}\nReturns: ${func.returnType || 'any'}\nCalls: ${func.calls.length}\nCalled by: ${func.calledBy.length}`;

      dot += `    "${id}" [fillcolor="${color}", shape=${shape}, label="${label}", penwidth=${penwidth}, fontsize=10, tooltip="${tooltip}"];\n`;

      // --- СВЯЗИ ВЫЗОВОВ (EntityGraphEdge) ---
      for (const call of func.calls) {
        const targetModule = Object.entries(report.packages).find(([_, pkg]) =>
          pkg.entities.functions.some(f => f.name === call)
        );
        if (targetModule) {
          const targetId = `${targetModule[0]}#${call}`;
          dot += `    "${id}" -> "${targetId}" [color="#f59e0b", penwidth=1.5, label="call", fontsize=8];\n`;
        }
      }

      for (const caller of func.calledBy) {
        const callerModule = Object.entries(report.packages).find(([_, pkg]) =>
          pkg.entities.functions.some(f => f.name === caller)
        );
        if (callerModule) {
          const callerId = `${callerModule[0]}#${caller}`;
          dot += `    "${callerId}" -> "${id}" [color="#3b82f6", penwidth=1, style="dashed", label="called by", fontsize=8];\n`;
        }
      }
    }

    dot += `  }\n`;
    clusterIndex++;
  }

  dot += '}\n';
  return dot;
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

      if (!callMap[fromName]) callMap[fromName] = [];
      callMap[fromName].push(toName);

      if (!calledByMap[toName]) calledByMap[toName] = [];
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

  // Строим пакеты из модулей
  for (const node of moduleNodes) {
    if (!node) continue;
    const modulePath = node.id;
    if (!modulePath) continue;
    const entities = entityNodes.filter((e: EntityGraphNode) => e.module === modulePath);
    packages[modulePath] = convertModuleNodeToPackage(node, entities, entityEdges);
  }

  const inwardDependencies: Record<string, string[]> = {};
  const outwardDependencies: Record<string, string[]> = {};

  // Строим зависимости модулей
  for (const edge of moduleEdges) {
    if (!edge) continue;
    const from = edge.from;
    const to = edge.to;
    if (!from || !to) continue;

    // Инициализация массивов если их нет
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
      if (func.isExported) totalExportedFunctions++;
      if (func.isAsync) totalAsyncFunctions++;
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// ГЕНЕРАЦИЯ HTML
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
    // Создаем базовый отчет из analysis
    report = buildReportFromAnalysis(analysis);
  }

  // ============================================================
  // ОБОГАЩЕНИЕ ДАННЫХ СУЩНОСТЯМИ (ЕСЛИ ПЕРЕДАНЫ)
  // ============================================================
  if (entitiesWithCalls) {
    console.log('📊 Обогащение данными из entitiesWithCalls...');

    // Обогащаем функции в отчете данными о вызовах
    for (const [modulePath, pkg] of Object.entries(report.packages)) {
      if (!pkg) continue;

      for (const func of pkg.entities.functions) {
        // Ищем соответствующую функцию в entitiesWithCalls по имени и модулю
        const enrichedFunc = entitiesWithCalls.functions.find((f: any) => {
          // Проверяем совпадение по имени и модулю
          const funcModule = f._modulePath || f.modulePath || '';
          return (
            f.name === func.name &&
            (funcModule === modulePath ||
              funcModule.includes(modulePath) ||
              modulePath.includes(funcModule))
          );
        });

        if (enrichedFunc) {
          // Добавляем данные о вызовах
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

    // Пересчитываем статистику после обогащения
    let totalFunctions = 0;
    let totalCalls = 0;
    let totalExportedFunctions = 0;
    let totalAsyncFunctions = 0;

    for (const pkg of Object.values(report.packages)) {
      if (!pkg) continue;
      for (const func of pkg.entities.functions) {
        totalFunctions++;
        totalCalls += func.calls.length;
        if (func.isExported) totalExportedFunctions++;
        if (func.isAsync) totalAsyncFunctions++;
      }
    }

    report.entityStats.totalFunctions = totalFunctions;
    report.entityStats.totalCalls = totalCalls;
    report.entityStats.totalExportedFunctions = totalExportedFunctions;
    report.entityStats.totalAsyncFunctions = totalAsyncFunctions;

    console.log(`  ✅ Обогащено ${totalFunctions} функций данными о вызовах`);
  }

  const dot = generateFullDOT(report);

  let svgContent = '';
  try {
    const graphviz = await Graphviz.load();
    svgContent = await graphviz.dot(dot);
    console.log('  ✅ SVG сгенерирован через Graphviz');
  } catch (error) {
    console.warn('  ⚠️ Graphviz не доступен, используется fallback');
    svgContent = `<p style="color:#94a3b8;text-align:center;padding:40px;">
      ⚠️ Graphviz недоступен. Установите грамматики или проверьте WASM путь.
    </p>`;
  }

  // Собираем все функции для карточек
  const allFunctions: { modulePath: string; func: PackageLockFunctionInfo }[] = [];
  for (const [modulePath, pkg] of Object.entries(report.packages)) {
    if (!pkg) continue;
    for (const func of pkg.entities.functions) {
      allFunctions.push({ modulePath, func });
    }
  }

  // Собираем статистику по модулям
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

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Интерактивный граф модулей и функций</title>
    <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
            min-height: 100vh;
        }
        .container { max-width: 1600px; margin: 0 auto; }

        .header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 20px 30px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }
        .header h1 { font-size: 24px; color: #60a5fa; }
        .header .sub { color: #94a3b8; margin-top: 4px; font-size: 13px; }
        .header .stats-line {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 10px;
            font-size: 13px;
        }
        .header .stats-line .stat {
            color: #94a3b8;
        }
        .header .stats-line .stat strong {
            color: #e2e8f0;
        }

        .controls-bar {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
            padding: 12px 16px;
            background: #1e293b;
            border-radius: 10px;
            margin-bottom: 16px;
            border: 1px solid #334155;
        }
        .controls-bar .group {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        .controls-bar .group-label {
            font-size: 11px;
            color: #94a3b8;
            margin-right: 4px;
        }
        .controls-bar button {
            background: #334155;
            border: none;
            color: #e2e8f0;
            padding: 5px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s, transform 0.1s;
        }
        .controls-bar button:hover { background: #475569; }
        .controls-bar button.active {
            background: #60a5fa;
            color: #0f172a;
            font-weight: 600;
        }
        .controls-bar button:active { transform: scale(0.95); }
        .controls-bar .search-input {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 5px 12px;
            color: #e2e8f0;
            font-size: 12px;
            width: 200px;
            outline: none;
        }
        .controls-bar .search-input:focus {
            border-color: #60a5fa;
        }
        .controls-bar .search-input::placeholder {
            color: #64748b;
        }
        .controls-bar .hint {
            font-size: 11px;
            color: #64748b;
            margin-left: auto;
        }

        .graph-container {
            background: #1e293b;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
            border: 1px solid #334155;
            position: relative;
            min-height: 500px;
        }
        .graph-container svg {
            width: 100%;
            height: auto;
            min-height: 400px;
            background: #0f172a;
            border-radius: 8px;
        }

        .legend {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            padding: 8px 0;
            font-size: 12px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
            border: 1px solid #475569;
        }
        .legend-shape {
            width: 16px;
            height: 16px;
            border: 1px solid #475569;
        }
        .legend-shape.ellipse { border-radius: 50%; }
        .legend-shape.box { border-radius: 2px; }

        .focus-info {
            background: #1e293b;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            border: 1px solid #22d3ee;
            display: none;
        }
        .focus-info.active {
            display: block;
        }
        .focus-info .title {
            color: #22d3ee;
            font-weight: 600;
            font-size: 14px;
        }
        .focus-info .details {
            color: #94a3b8;
            font-size: 12px;
            margin-top: 4px;
        }
        .focus-info .close-btn {
            background: none;
            border: none;
            color: #f87171;
            cursor: pointer;
            font-size: 14px;
            float: right;
        }
        .focus-info .close-btn:hover { color: #fca5a5; }

        .modules-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
            gap: 16px;
            margin-top: 20px;
        }
        .module-card {
            background: #1e293b;
            border-radius: 10px;
            padding: 14px 16px;
            border: 1px solid #334155;
            transition: all 0.3s;
            cursor: pointer;
        }
        .module-card:hover {
            border-color: #60a5fa;
            transform: translateY(-2px);
        }
        .module-card.active {
            border-color: #22d3ee;
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);
        }
        .module-card .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
        }
        .module-card .name {
            font-size: 14px;
            font-weight: 600;
            color: #60a5fa;
            word-break: break-all;
        }
        .module-card .name .entry {
            color: #fbbf24;
            font-size: 12px;
        }
        .module-card .path {
            font-size: 10px;
            color: #64748b;
            font-family: monospace;
            word-break: break-all;
            margin-top: 2px;
        }
        .module-card .badges {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin: 6px 0;
        }
        .badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 9px;
            font-weight: 500;
            text-transform: uppercase;
        }
        .badge.fn { background: #fbbf24; color: #0f172a; }
        .badge.class { background: #4ade80; color: #0f172a; }
        .badge.const { background: #f472b6; color: #0f172a; }
        .badge.interface { background: #a78bfa; color: #fff; }
        .badge.type { background: #22d3ee; color: #0f172a; }
        .badge.var { background: #f87171; color: #fff; }
        .badge.export { background: #f87171; color: #fff; }
        .badge.async { background: #fbbf24; color: #0f172a; }
        .badge.lang { background: #334155; color: #94a3b8; }
        .badge.lines { background: #1e293b; color: #64748b; border: 1px solid #334155; }

        .module-card .functions-list {
            margin-top: 8px;
            max-height: 300px;
            overflow-y: auto;
        }
        .functions-list::-webkit-scrollbar { width: 4px; }
        .functions-list::-webkit-scrollbar-track { background: transparent; }
        .functions-list::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }

        .func-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            margin: 2px 0;
            background: #0f172a;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
            border-left: 2px solid transparent;
        }
        .func-item:hover {
            background: #1a1a3a;
            border-left-color: #60a5fa;
        }
        .func-item.active {
            background: #1a1a3a;
            border-left-color: #22d3ee;
            box-shadow: 0 0 12px rgba(34, 211, 238, 0.1);
        }
        .func-item .func-name { color: #e2e8f0; }
        .func-item .func-export { color: #f87171; font-size: 9px; }
        .func-item .func-async { color: #fbbf24; font-size: 9px; }
        .func-item .func-params { color: #94a3b8; font-size: 10px; }
        .func-item .func-calls { color: #f59e0b; font-size: 10px; }
        .func-item .func-called { color: #3b82f6; font-size: 10px; }
        .func-item .func-line { color: #64748b; font-size: 9px; margin-left: auto; }

        .detail-panel {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
            max-width: 420px;
            max-height: 80vh;
            overflow-y: auto;
            display: none;
            box-shadow: 0 20px 60px rgba(0,0,0,0.7);
            z-index: 100;
            min-width: 300px;
        }
        .detail-panel.active {
            display: block;
        }
        .detail-panel::-webkit-scrollbar { width: 4px; }
        .detail-panel::-webkit-scrollbar-track { background: transparent; }
        .detail-panel::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }

        .detail-panel .dp-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }
        .detail-panel .dp-title {
            font-size: 18px;
            font-weight: 600;
            color: #60a5fa;
        }
        .detail-panel .dp-close {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 20px;
            cursor: pointer;
        }
        .detail-panel .dp-close:hover { color: #f87171; }
        .detail-panel .dp-section {
            margin-top: 10px;
            padding: 8px 0;
            border-top: 1px solid #334155;
        }
        .detail-panel .dp-section:first-child { border-top: none; }
        .detail-panel .dp-section h4 {
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .detail-panel .dp-section .item {
            font-size: 12px;
            color: #e2e8f0;
            padding: 2px 0;
            font-family: monospace;
        }
        .detail-panel .dp-section .item .label {
            color: #94a3b8;
        }

        .footer {
            padding: 12px 20px;
            background: #1e293b;
            text-align: center;
            color: #64748b;
            font-size: 11px;
            border-top: 1px solid #334155;
            margin-top: 20px;
            border-radius: 0 0 12px 12px;
        }

        @media (max-width: 768px) {
            .modules-grid { grid-template-columns: 1fr; }
            .controls-bar { flex-direction: column; align-items: stretch; }
            .controls-bar .hint { display: none; }
            .controls-bar .search-input { width: 100%; }
            .detail-panel {
                right: 10px;
                left: 10px;
                max-width: none;
                min-width: auto;
                top: auto;
                bottom: 10px;
                transform: none;
                max-height: 60vh;
            }
            .header .stats-line { flex-direction: column; gap: 4px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔀 Интерактивный граф модулей и функций</h1>
            <div class="stats-line">
                <span class="stat">📁 <strong>${report.fileStats.totalFiles}</strong> модулей</span>
                <span class="stat">ƒ <strong>${report.entityStats.totalFunctions}</strong> функций</span>
                <span class="stat">📞 <strong>${report.entityStats.totalCalls}</strong> вызовов</span>
                <span class="stat">📤 <strong>${report.entityStats.totalExportedFunctions}</strong> экспортировано</span>
                <span class="stat">⚡ <strong>${report.entityStats.totalAsyncFunctions}</strong> async</span>
                <span class="stat">📝 <strong>${report.fileStats.totalLines}</strong> строк</span>
                <span class="stat">💾 <strong>${(report.fileStats.totalSize / 1024).toFixed(2)}</strong> KB</span>
                <span class="stat">📦 <strong>${report.entityStats.totalConstants || 0}</strong> констант</span>
                <span class="stat">🧩 <strong>${report.entityStats.totalInterfaces || 0}</strong> интерфейсов</span>
                <span class="stat">📐 <strong>${report.entityStats.totalTypes || 0}</strong> типов</span>
            </div>
            <div class="sub">Сгенерировано: ${new Date().toLocaleString()}</div>
        </div>

        <div class="controls-bar">
            <div class="group">
                <span class="group-label">Режим:</span>
                <button class="active" data-mode="all" onclick="setMode('all')">🌐 Все</button>
                <button data-mode="inward" onclick="setMode('inward')">📥 Входящие</button>
                <button data-mode="outward" onclick="setMode('outward')">📤 Исходящие</button>
                <button data-mode="both" onclick="setMode('both')">🔁 Оба</button>
            </div>
            <div class="group">
                <span class="group-label">Фокус:</span>
                <button onclick="clearFocus()">✕ Очистить</button>
            </div>
            <input class="search-input" id="searchInput" placeholder="🔍 Поиск функции или модуля..." oninput="handleSearch(this.value)">
            <span class="hint">💡 Клик на функцию → детали | Клик на модуль → фокус</span>
        </div>

        <div class="focus-info" id="focusInfo">
            <button class="close-btn" onclick="clearFocus()">✕</button>
            <div class="title" id="focusTitle">🎯 Фокус</div>
            <div class="details" id="focusDetails"></div>
        </div>

        <div class="graph-container">
            <div id="svg-wrapper">
                ${svgContent}
            </div>
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-color" style="background:#fbbf24;"></div>
                    <span>⭐ Точка входа</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#f87171;"></div>
                    <span>📤 Экспортированная функция</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#fbbf24;"></div>
                    <span>Внутренняя функция</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#22d3ee;"></div>
                    <span>🎯 Активная (фокус)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#f59e0b; width:30px; height:3px;"></div>
                    <span>Вызов функции</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#3b82f6; width:30px; height:3px; style=dashed;"></div>
                    <span>Кем вызвана</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#3b82f6; width:30px; height:3px;"></div>
                    <span>Импорт модуля</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#f59e0b; width:30px; height:3px;"></div>
                    <span>Обратная связь</span>
                </div>
            </div>
        </div>

        <div id="modulesContainer">
            <h2 style="margin: 20px 0 12px; color:#60a5fa; font-size:18px;">📁 Модули и функции</h2>
            <div class="modules-grid" id="modulesGrid">
                ${moduleStats
                  .map(mod => {
                    const escapedName = escapeHtml(mod.name);
                    const escapedPath = escapeHtml(mod.path);
                    return `
                <div class="module-card" data-module="${escapeHtml(mod.path)}" onclick="focusModule('${escapeHtml(mod.path)}')">
                    <div class="header-row">
                        <div>
                            <div class="name">${mod.isEntry ? '⭐ ' : ''}${escapedName}</div>
                            <div class="path">${escapedPath}</div>
                        </div>
                        <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
                            <span class="badge lang">${mod.language}</span>
                            ${mod.isEntry ? '<span class="badge export">⭐ entry</span>' : ''}
                            <span class="badge lines">${mod.lines} строк</span>
                        </div>
                    </div>
                    <div class="badges">
                        <span class="badge fn">${mod.functions} функций</span>
                        ${mod.classes > 0 ? `<span class="badge class">${mod.classes} классов</span>` : ''}
                        ${mod.constants > 0 ? `<span class="badge const">${mod.constants} констант</span>` : ''}
                        ${mod.interfaces > 0 ? `<span class="badge interface">${mod.interfaces} интерфейсов</span>` : ''}
                        ${mod.types > 0 ? `<span class="badge type">${mod.types} типов</span>` : ''}
                        ${mod.variables > 0 ? `<span class="badge var">${mod.variables} переменных</span>` : ''}
                    </div>
                    <div class="functions-list">
                        ${allFunctions
                          .filter(f => f.modulePath === mod.path)
                          .map(({ func }) => {
                            const escapedFuncName = escapeHtml(func.name);
                            const escapedModulePath = escapeHtml(mod.path);
                            const paramsStr = func.params.map(p => escapeHtml(p)).join(', ');
                            const callsStr = func.calls
                              .slice(0, 3)
                              .map(c => escapeHtml(c))
                              .join(', ');
                            return `
                        <div class="func-item" onclick="event.stopPropagation(); focusFunction('${escapedFuncName}', '${escapedModulePath}')" data-func="${escapedFuncName}" data-module="${escapedModulePath}">
                            <span class="func-name">${escapedFuncName}</span>
                            ${func.isExported ? '<span class="func-export">📤</span>' : ''}
                            ${func.isAsync ? '<span class="func-async">⚡</span>' : ''}
                            ${func.params.length > 0 ? `<span class="func-params">(${paramsStr})</span>` : ''}
                            ${func.calls.length > 0 ? `<span class="func-calls">→ ${callsStr}${func.calls.length > 3 ? '...' : ''}</span>` : ''}
                            ${func.calledBy.length > 0 ? `<span class="func-called">← ${func.calledBy.length}</span>` : ''}
                            <span class="func-line">стр.${func.line}</span>
                        </div>
                        `;
                          })
                          .join('')}
                    </div>
                </div>
                `;
                  })
                  .join('')}
            </div>
        </div>

        <div class="detail-panel" id="detailPanel">
            <div class="dp-header">
                <div class="dp-title" id="dpTitle">Функция</div>
                <button class="dp-close" onclick="closeDetail()">✕</button>
            </div>
            <div id="dpContent"></div>
        </div>

        <div class="footer">
            <p>Сгенерировано AST Analyzer v3.0.0 | Данные из package-lock-report.json</p>
        </div>
    </div>

    <script>
        // ============================================================
        // ДАННЫЕ
        // ============================================================
        const reportData = ${JSON.stringify(report)};
        const allFunctionsData = ${JSON.stringify(allFunctions)};

        let currentMode = 'all';
        let currentFocusModule = null;
        let currentFocusFunction = null;

        // ============================================================
        // SVG PAN ZOOM
        // ============================================================
        let svgPanZoomInstance = null;

        function initPanZoom() {
            const svg = document.querySelector('#svg-wrapper svg');
            if (svg) {
                if (svgPanZoomInstance) {
                    svgPanZoomInstance.destroy();
                }
                svgPanZoomInstance = svgPanZoom(svg, {
                    zoomEnabled: true,
                    controlIconsEnabled: false,
                    fit: true,
                    center: true,
                    minZoom: 0.1,
                    maxZoom: 4,
                });
            } else {
                setTimeout(initPanZoom, 300);
            }
        }

        // ============================================================
        // УПРАВЛЕНИЕ РЕЖИМАМИ
        // ============================================================
        function setMode(mode) {
            currentMode = mode;
            document.querySelectorAll('[data-mode]').forEach(b => {
                b.classList.toggle('active', b.dataset.mode === mode);
            });
            updateView();
        }

        function focusModule(modulePath) {
            if (currentFocusModule === modulePath) {
                clearFocus();
                return;
            }
            currentFocusModule = modulePath;
            currentFocusFunction = null;
            updateView();

            document.querySelectorAll('.module-card').forEach(c => {
                c.classList.toggle('active', c.dataset.module === modulePath);
            });

            const info = document.getElementById('focusInfo');
            info.classList.add('active');
            const pkg = reportData.packages[modulePath];
            const displayName = pkg?.displayPath || modulePath.split('/').pop() || modulePath;
            document.getElementById('focusTitle').textContent = '🎯 Фокус: ' + displayName;
            if (pkg) {
                document.getElementById('focusDetails').textContent =
                    'Функций: ' + pkg.entities.functions.length + ' | Экспортов: ' + Object.keys(pkg.exports).length + ' | Импортов: ' + Object.keys(pkg.imports).length;
            }

            const card = document.querySelector('.module-card[data-module="' + modulePath + '"]');
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function focusFunction(funcName, modulePath) {
            if (currentFocusFunction === funcName && currentFocusModule === modulePath) {
                clearFocus();
                return;
            }
            currentFocusFunction = funcName;
            currentFocusModule = modulePath;
            updateView();

            document.querySelectorAll('.module-card').forEach(c => {
                c.classList.toggle('active', c.dataset.module === modulePath);
            });
            document.querySelectorAll('.func-item').forEach(el => {
                el.classList.toggle('active',
                    el.dataset.func === funcName && el.dataset.module === modulePath
                );
            });

            const info = document.getElementById('focusInfo');
            info.classList.add('active');
            document.getElementById('focusTitle').textContent = '🎯 Функция: ' + funcName;

            const funcData = allFunctionsData.find(f => f.func.name === funcName && f.modulePath === modulePath);
            if (funcData) {
                const f = funcData.func;
                const displayName = modulePath.split('/').pop() || modulePath;
                document.getElementById('focusDetails').textContent =
                    'Модуль: ' + displayName + ' | Параметры: ' + (f.params.join(', ') || 'нет') + ' | Вызовов: ' + f.calls.length + ' | Кем вызвана: ' + f.calledBy.length;
            }

            showDetail(funcName, modulePath);

            const el = document.querySelector('.func-item[data-func="' + funcName + '"][data-module="' + modulePath + '"]');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function clearFocus() {
            currentFocusModule = null;
            currentFocusFunction = null;
            document.getElementById('focusInfo').classList.remove('active');
            document.querySelectorAll('.module-card').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.func-item').forEach(el => el.classList.remove('active'));
            closeDetail();
            updateView();
        }

        // ============================================================
        // ПОИСК
        // ============================================================
        let searchTimeout = null;
        function handleSearch(query) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const q = query.toLowerCase().trim();
                document.querySelectorAll('.module-card').forEach(card => {
                    const name = card.querySelector('.name')?.textContent?.toLowerCase() || '';
                    const path = card.dataset.module?.toLowerCase() || '';
                    const funcs = card.querySelectorAll('.func-item');
                    let hasMatch = false;

                    if (q === '') {
                        card.style.display = 'block';
                        funcs.forEach(el => el.style.display = 'flex');
                        return;
                    }

                    if (name.includes(q) || path.includes(q)) {
                        hasMatch = true;
                        funcs.forEach(el => el.style.display = 'flex');
                    } else {
                        funcs.forEach(el => {
                            const fname = el.querySelector('.func-name')?.textContent?.toLowerCase() || '';
                            if (fname.includes(q)) {
                                el.style.display = 'flex';
                                hasMatch = true;
                            } else {
                                el.style.display = 'none';
                            }
                        });
                    }
                    card.style.display = hasMatch ? 'block' : 'none';
                });
            }, 300);
        }

        // ============================================================
        // ДЕТАЛИ ФУНКЦИИ
        // ============================================================
        function showDetail(funcName, modulePath) {
            const panel = document.getElementById('detailPanel');
            const title = document.getElementById('dpTitle');
            const content = document.getElementById('dpContent');

            const funcData = allFunctionsData.find(f => f.func.name === funcName && f.modulePath === modulePath);
            if (!funcData) return;

            const f = funcData.func;
            title.textContent = f.name;

            let html = '';
            html += '<div class="dp-section"><h4>Информация</h4>';
            const displayName = modulePath.split('/').pop() || modulePath;
            html += '<div class="item"><span class="label">Модуль:</span> ' + displayName + '</div>';
            html += '<div class="item"><span class="label">Строка:</span> ' + f.line + '</div>';
            html += '<div class="item"><span class="label">Экспортирована:</span> ' + (f.isExported ? '✅' : '❌') + '</div>';
            html += '<div class="item"><span class="label">Асинхронная:</span> ' + (f.isAsync ? '✅' : '❌') + '</div>';
            html += '<div class="item"><span class="label">Возврат:</span> ' + (f.returnType || 'any') + '</div>';
            html += '</div>';

            if (f.params.length > 0) {
                html += '<div class="dp-section"><h4>Параметры</h4>';
                f.params.forEach((p, i) => {
                    const type = f.paramTypes[i] || 'any';
                    html += '<div class="item">' + p + ': ' + type + '</div>';
                });
                html += '</div>';
            }

            if (f.calls.length > 0) {
                html += '<div class="dp-section"><h4>📞 Вызовы (кто вызывается)</h4>';
                f.calls.forEach(call => {
                    const target = allFunctionsData.find(f2 => f2.func.name === call);
                    const targetPath = target?.modulePath || modulePath;
                    html += '<div class="item" style="cursor:pointer;color:#f59e0b;" onclick="focusFunction(\'' + call + '\', \'' + targetPath + '\')">→ ' + call + '</div>';
                });
                html += '</div>';
            }

            if (f.calledBy.length > 0) {
                html += '<div class="dp-section"><h4>📥 Кто вызывает</h4>';
                f.calledBy.forEach(caller => {
                    const source = allFunctionsData.find(f2 => f2.func.name === caller);
                    const sourcePath = source?.modulePath || modulePath;
                    html += '<div class="item" style="cursor:pointer;color:#3b82f6;" onclick="focusFunction(\'' + caller + '\', \'' + sourcePath + '\')">← ' + caller + '</div>';
                });
                html += '</div>';
            }

            if (f.body) {
                html += '<div class="dp-section"><h4>Тело (сокращённо)</h4>';
                const bodyPreview = f.body.length > 200 ? f.body.substring(0, 200) + '...' : f.body;
                html += '<div class="item" style="font-size:10px;color:#94a3b8;white-space:pre-wrap;background:#0f172a;padding:8px;border-radius:4px;">' + bodyPreview + '</div>';
                html += '</div>';
            }

            content.innerHTML = html;
            panel.classList.add('active');
        }

        function closeDetail() {
            document.getElementById('detailPanel').classList.remove('active');
        }

        // ============================================================
        // ОБНОВЛЕНИЕ ГРАФА
        // ============================================================
        function updateView() {
            const wrapper = document.getElementById('svg-wrapper');
            const moduleName = currentFocusModule ? (currentFocusModule.split('/').pop() || currentFocusModule) : '';
            wrapper.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">' +
                '🔄 Граф обновлён. Режим: <strong>' + currentMode + '</strong>' +
                (currentFocusModule ? ' | Фокус: ' + moduleName : '') +
                (currentFocusFunction ? ' | Функция: ' + currentFocusFunction : '') +
                '<br><br>' +
                '<span style="font-size:12px;">(Для полного обновления используйте кнопки режимов)</span>' +
            '</div>';

            setTimeout(initPanZoom, 300);
        }

        // ============================================================
        // ИНИЦИАЛИЗАЦИЯ
        // ============================================================
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initPanZoom, 300);

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    clearFocus();
                    closeDetail();
                }
                if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }
            });
        });

        document.addEventListener('click', function(e) {
            const panel = document.getElementById('detailPanel');
            if (panel.classList.contains('active') && !panel.contains(e.target) && !e.target.closest('.func-item')) {
                closeDetail();
            }
        });

        window.addEventListener('resize', function() {
            if (svgPanZoomInstance) {
                setTimeout(() => {
                    svgPanZoomInstance.resize();
                    svgPanZoomInstance.fit();
                    svgPanZoomInstance.center();
                }, 100);
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`  ✅ interactive-report.html (с полными данными из package-lock-report.json)`);
}

export default {
  generateInteractiveHTML,
};
