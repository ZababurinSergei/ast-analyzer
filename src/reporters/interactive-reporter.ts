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
import type { EntitiesResult } from '../core/entity-extractor.js';
import type { EnhancedEntityInfo } from './json-reporter.js';

/**
 * Генерирует DOT граф для визуализации модулей и сущностей с правильными связями:
 * - Модули (контейнеры) с их сущностями
 * - Вызовы между функциями разных модулей
 * - Импорты и экспорты сущностей
 * - Наследование и имплементация
 */
function generateFullDOT(analysis: FullAnalysis): string {
  let dot = 'digraph ProjectGraph {\n';
  dot += '  rankdir=LR;\n';
  dot += '  splines=true;\n';
  dot += '  node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee, penwidth=1];\n\n';

  // === 1. Модули (контейнеры) ===
  dot += '  // === МОДУЛИ ===\n';
  const moduleNodes: ModuleGraphNode[] = analysis.moduleGraph?.nodes || [];
  const moduleEdges: ModuleGraphEdge[] = analysis.moduleGraph?.edges || [];

  for (const node of moduleNodes) {
    const isEntry = node.metadata?.isEntry || false;
    const isVue = node.type === 'vue' || node.name.endsWith('.vue');
    const color = isEntry ? '#4f46e5' : isVue ? '#4ade80' : '#f3f4f6';
    const fontColor = isEntry ? '#ffffff' : '#1f2937';
    const penwidth = isEntry ? '3' : '1';
    const label = isEntry ? `⭐ ${node.name}` : node.name;
    const tooltip = node.id;

    dot += `  "${node.id}" [fillcolor="${color}", fontcolor="${fontColor}", penwidth=${penwidth}, label="${label}", tooltip="${tooltip}"];\n`;
  }

  // === 2. Ребра модулей (импорты между модулями) ===
  dot += '\n  // === СВЯЗИ МЕЖДУ МОДУЛЯМИ (ИМПОРТЫ) ===\n';
  for (const edge of moduleEdges) {
    const isExternal = edge.type === 'external';
    const color = isExternal ? '#f59e0b' : '#3b82f6';
    const style = isExternal ? 'dashed' : 'solid';
    const label = edge.specifiers?.length > 0 ? edge.specifiers.join(', ') : edge.type;

    dot += `  "${edge.from}" -> "${edge.to}" [color="${color}", style="${style}", label="${label}", fontsize=9];\n`;
  }

  // === 3. Сущности (функции, классы, константы) ===
  const entityNodes: EntityGraphNode[] = analysis.entityGraph?.nodes || [];
  const entityEdges: EntityGraphEdge[] = analysis.entityGraph?.edges || [];

  if (entityNodes.length > 0) {
    dot += '\n  // === СУЩНОСТИ (ФУНКЦИИ, КЛАССЫ, КОНСТАНТЫ) ===\n';

    // Группируем сущности по модулям для кластеризации
    const entitiesByModule: Record<string, EntityGraphNode[]> = {};
    for (const node of entityNodes) {
      const moduleId = node.module || 'unknown';
      if (!entitiesByModule[moduleId]) {
        entitiesByModule[moduleId] = [];
      }
      entitiesByModule[moduleId].push(node);
    }

    let clusterIndex = 0;
    for (const [moduleId, entities] of Object.entries(entitiesByModule)) {
      if (entities.length === 0) continue;

      // Проверяем, существует ли модуль в графе
      const moduleExists = moduleNodes.some(
        n => n.id === moduleId || n.id === moduleId.replace('#', '')
      );

      if (moduleExists) {
        dot += `  subgraph cluster_${clusterIndex} {\n`;
        dot += `    label="${path.basename(moduleId)}";\n`;
        dot += `    style=filled;\n`;
        dot += `    fillcolor="#0f172a";\n`;
        dot += `    color="#334155";\n`;
        dot += `    penwidth=1;\n`;
        dot += `    fontcolor="#94a3b8";\n`;
        dot += `    fontsize=10;\n`;
      }

      for (const entity of entities) {
        const color = getEntityColor(entity.type);
        const shape = getEntityShape(entity.type);
        const isExported = entity.metadata?.isExported || false;
        const isAsync = entity.metadata?.isAsync || false;

        // Формируем подпись с указанием модуля для импортированных сущностей
        let label = entity.name;
        if (entity.metadata?.importedFrom) {
          label += ` (← ${path.basename(entity.metadata.importedFrom)})`;
        }
        if (isExported) label = `📤 ${label}`;
        if (isAsync) label = `⚡ ${label}`;
        if (entity.metadata?.params && entity.metadata.params.length > 0) {
          label += `(${entity.metadata.params.join(', ')})`;
        }

        const id = entity.id || `${moduleId}#${entity.name}`;

        dot += `    "${id}" [fillcolor="${color}", shape=${shape}, label="${label}", fontsize=10, tooltip="${entity.name} (${entity.type})"];\n`;
      }

      if (moduleExists) {
        dot += `  }\n`;
        clusterIndex++;
      }
    }
  }

  // === 4. Связи между сущностями (вызовы, импорты, экспорты) ===
  if (entityEdges.length > 0) {
    dot += '\n  // === СВЯЗИ МЕЖДУ СУЩНОСТЯМИ ===\n';
    for (const edge of entityEdges) {
      const color = getEdgeColor(edge.type);
      const style =
        edge.type === 'function_call' || edge.type === 'method_call' ? 'solid' : 'dashed';
      const penwidth = edge.type === 'function_call' || edge.type === 'method_call' ? '1.5' : '1';
      const label = edge.type;

      dot += `  "${edge.from}" -> "${edge.to}" [color="${color}", style="${style}", penwidth=${penwidth}, label="${label}", fontsize=8];\n`;
    }
  }

  // === 5. Связи модуль → сущности (принадлежность) ===
  dot += '\n  // === ПРИНАДЛЕЖНОСТЬ СУЩНОСТЕЙ К МОДУЛЯМ ===\n';
  for (const moduleNode of moduleNodes) {
    const moduleId = moduleNode.id;
    const entities = entityNodes.filter(
      e => e.module === moduleId || e.module === moduleId.replace('#', '')
    );

    for (const entity of entities) {
      const entityId = entity.id || `${moduleId}#${entity.name}`;
      dot += `  "${moduleId}" -> "${entityId}" [color="#64748b", style="dotted", penwidth=0.5, arrowhead=none];\n`;
    }
  }

  dot += '}\n';
  return dot;
}

/**
 * Возвращает цвет для типа сущности
 */
function getEntityColor(type: string): string {
  const colors: Record<string, string> = {
    function: '#60a5fa',
    class: '#4ade80',
    constant: '#fbbf24',
    interface: '#a78bfa',
    type: '#f472b6',
    variable: '#22d3ee',
    enum: '#f87171',
    module: '#94a3b8',
    component: '#4ade80',
    vue: '#4ade80',
  };
  return colors[type] || '#94a3b8';
}

/**
 * Возвращает форму для типа сущности
 */
function getEntityShape(type: string): string {
  const shapes: Record<string, string> = {
    function: 'ellipse',
    class: 'box',
    constant: 'diamond',
    interface: 'box3d',
    type: 'parallelogram',
    variable: 'ellipse',
    enum: 'diamond',
    module: 'box',
    component: 'box',
    vue: 'box',
  };
  return shapes[type] || 'box';
}

/**
 * Возвращает цвет для типа ребра
 */
function getEdgeColor(type: string): string {
  const colors: Record<string, string> = {
    function_call: '#f59e0b',
    constant_reference: '#059669',
    class_extends: '#7c3aed',
    class_implements: '#8b5cf6',
    interface_extends: '#0ea5e9',
    type_reference: '#f59e0b',
    method_call: '#f97316',
    property_access: '#ec4899',
    import_binding: '#3b82f6',
    export_binding: '#22c55e',
    parameter_type: '#8b5cf6',
    return_type: '#ef4444',
    variable_reference: '#f43f5e',
    enum_member: '#a855f7',
  };
  return colors[type] || '#6b7280';
}

/**
 * Преобразует EnhancedEntityInfo в EntitiesResult
 */
function convertEnhancedToEntities(enhanced: EnhancedEntityInfo): EntitiesResult {
  return {
    functions: enhanced.functions.map(f => ({
      name: f.name,
      line: f.line,
      isAsync: f.isAsync || false,
      isExported: f.isExported || false,
      params: f.params || [],
      returnType: f.returnType,
      calls: f.calls || [],
      calledBy: f.calledBy || [],
      body: f.body || '',
      startLine: f.startLine || f.line,
      endLine: f.endLine || f.line,
      isMethod: f.isMethod || false,
      className: f.className,
      isNested: f.isNested || false,
      parentFunction: f.parentFunction,
      isArrow: f.isArrow || false,
      isEventHandler: f.isEventHandler || false,
      eventType: f.eventType,
      depth: f.depth || 0,
    })),
    classes: enhanced.classes.map(c => ({
      name: c.name,
      line: c.line,
      isExported: c.isExported || false,
      methods: c.methods || [],
      properties: c.properties || [],
      extends: c.extends,
      implements: c.implements || [],
      startLine: c.startLine || c.line,
      endLine: c.endLine || c.line,
    })),
    constants: enhanced.constants.map(c => ({
      name: c.name,
      line: c.line,
      isExported: c.isExported || false,
      value: c.value,
      type: c.type,
    })),
    interfaces: enhanced.interfaces.map(i => ({
      name: i.name,
      line: i.line,
      isExported: i.isExported || false,
      properties: i.properties || [],
      extends: i.extends || [],
      startLine: i.startLine || i.line,
      endLine: i.endLine || i.line,
    })),
    types: enhanced.types.map(t => ({
      name: t.name,
      line: t.line,
      isExported: t.isExported || false,
      definition: t.definition,
    })),
    variables: enhanced.variables.map(v => ({
      name: v.name,
      line: v.line,
      isExported: v.isExported || false,
      type: v.type,
      value: v.value,
    })),
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: '',
    filePath: '',
  };
}

/**
 * Генерирует интерактивный HTML отчет с Graphviz графом
 */
export async function generateInteractiveHTML(
  analysis: FullAnalysis,
  outputPath: string,
  entitiesWithCalls?: EntitiesResult | EnhancedEntityInfo
): Promise<void> {
  // Нормализуем данные
  let entitiesData: EntitiesResult | null = null;

  if (entitiesWithCalls) {
    // Проверяем тип по наличию специфических полей
    if ('imports' in entitiesWithCalls && 'exports' in entitiesWithCalls) {
      // Это EntitiesResult
      entitiesData = entitiesWithCalls as EntitiesResult;
    } else {
      // Это EnhancedEntityInfo - конвертируем
      entitiesData = convertEnhancedToEntities(entitiesWithCalls as EnhancedEntityInfo);
    }
  }

  const dot = generateFullDOT(analysis);

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

  // Статистика для HTML - ВСЕ ПЕРЕМЕННЫЕ ИСПОЛЬЗУЮТСЯ
  const functions =
    analysis.entityGraph?.nodes?.filter((n: EntityGraphNode) => n.type === 'function') || [];
  const classes =
    analysis.entityGraph?.nodes?.filter((n: EntityGraphNode) => n.type === 'class') || [];
  const constants =
    analysis.entityGraph?.nodes?.filter((n: EntityGraphNode) => n.type === 'constant') || [];
  const interfaces =
    analysis.entityGraph?.nodes?.filter((n: EntityGraphNode) => n.type === 'interface') || [];
  const types =
    analysis.entityGraph?.nodes?.filter((n: EntityGraphNode) => n.type === 'type') || [];
  const variables =
    analysis.entityGraph?.nodes?.filter((n: EntityGraphNode) => n.type === 'variable') || [];

  // Собираем статистику по связям
  const callEdges =
    analysis.entityGraph?.edges?.filter(
      (e: EntityGraphEdge) => e.type === 'function_call' || e.type === 'method_call'
    ) || [];
  const importEdges =
    analysis.entityGraph?.edges?.filter((e: EntityGraphEdge) => e.type === 'import_binding') || [];
  const exportEdges =
    analysis.entityGraph?.edges?.filter((e: EntityGraphEdge) => e.type === 'export_binding') || [];
  const extendsEdges =
    analysis.entityGraph?.edges?.filter(
      (e: EntityGraphEdge) => e.type === 'class_extends' || e.type === 'interface_extends'
    ) || [];

  // Если есть entitiesData, используем их для построения дополнительных связей
  if (entitiesData) {
    // Добавляем связи между функциями из entitiesData
    for (const func of entitiesData.functions) {
      for (const call of func.calls || []) {
        // Проверяем, существует ли уже такое ребро
        const exists = analysis.entityGraph.edges.some(
          e => e.from === func.name && e.to === call && e.type === 'function_call'
        );
        if (!exists) {
          // Добавляем ребро, если его нет
          analysis.entityGraph.edges.push({
            from: func.name,
            to: call,
            type: 'function_call',
            line: func.line,
          });
        }
      }
    }
  }

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Интерактивный граф модулей и сущностей</title>
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
            padding: 24px 30px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }
        .header h1 { font-size: 24px; color: #60a5fa; }
        .header .sub { color: #94a3b8; margin-top: 6px; font-size: 13px; }
        .header .root { color: #fbbf24; font-family: monospace; margin-top: 4px; }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: #1e293b;
            padding: 12px 16px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #334155;
        }
        .stat-card .value { font-size: 22px; font-weight: bold; color: #60a5fa; }
        .stat-card .value.error { color: #f87171; }
        .stat-card .value.warning { color: #fbbf24; }
        .stat-card .value.success { color: #4ade80; }
        .stat-card .label { font-size: 11px; color: #94a3b8; margin-top: 4px; }

        .graph-container {
            background: #1e293b;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid #334155;
            position: relative;
            min-height: 600px;
        }
        .graph-container svg {
            width: 100%;
            height: auto;
            min-height: 500px;
            background: #0f172a;
            border-radius: 8px;
        }
        .graph-controls {
            display: flex;
            gap: 10px;
            padding: 10px 0;
            flex-wrap: wrap;
            align-items: center;
        }
        .graph-controls button {
            background: #334155;
            border: none;
            color: #e2e8f0;
            padding: 6px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }
        .graph-controls button:hover { background: #475569; }
        .graph-controls button.active { background: #60a5fa; color: #0f172a; }
        .graph-controls .hint {
            font-size: 12px;
            color: #64748b;
            margin-left: auto;
        }

        .legend {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            padding: 10px 0;
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
        .legend-shape.diamond { transform: rotate(45deg); width: 12px; height: 12px; }

        .modules-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 16px;
            margin-top: 20px;
        }
        .module-card {
            background: #1e293b;
            border-radius: 10px;
            padding: 16px;
            border: 1px solid #334155;
            transition: all 0.3s;
        }
        .module-card:hover { border-color: #60a5fa; }
        .module-card .name {
            font-size: 15px;
            font-weight: 600;
            color: #60a5fa;
            margin-bottom: 4px;
        }
        .module-card .path {
            font-size: 10px;
            color: #64748b;
            font-family: monospace;
            word-break: break-all;
        }
        .module-card .badges {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin: 8px 0;
        }
        .badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 9px;
            font-weight: 500;
            text-transform: uppercase;
        }
        .badge.export { background: #f87171; color: #fff; }
        .badge.import { background: #60a5fa; color: #fff; }
        .badge.function { background: #fbbf24; color: #0f172a; }
        .badge.class { background: #4ade80; color: #0f172a; }
        .badge.constant { background: #f472b6; color: #0f172a; }
        .badge.interface { background: #a78bfa; color: #fff; }
        .badge.type { background: #22d3ee; color: #0f172a; }
        .badge.variable { background: #f87171; color: #fff; }
        .badge.level { background: #334155; color: #94a3b8; }
        .badge.calls { background: #f59e0b; color: #0f172a; }

        .module-card .entities-list {
            margin-top: 10px;
            max-height: 250px;
            overflow-y: auto;
        }
        .entities-list::-webkit-scrollbar { width: 4px; }
        .entities-list::-webkit-scrollbar-track { background: transparent; }
        .entities-list::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }

        .entity-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            margin: 2px 0;
            background: #0f172a;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
        }
        .entity-item .type-icon { font-size: 12px; width: 18px; text-align: center; }
        .entity-item .entity-name { color: #e2e8f0; }
        .entity-item .entity-export { color: #f87171; font-size: 9px; }
        .entity-item .entity-async { color: #fbbf24; font-size: 9px; }
        .entity-item .entity-params { color: #94a3b8; font-size: 10px; }
        .entity-item .entity-calls { color: #f59e0b; font-size: 10px; }
        .entity-item .entity-module { color: #64748b; font-size: 9px; margin-left: auto; }

        .cycles-section {
            background: #1e293b;
            border-radius: 8px;
            padding: 16px;
            margin-top: 20px;
            border: 1px solid #f87171;
        }
        .cycles-section h2 { color: #f87171; margin-bottom: 10px; font-size: 18px; }
        .cycle-item { font-family: monospace; color: #fbbf24; margin: 4px 0; font-size: 13px; }

        .footer {
            padding: 16px 20px;
            background: #1e293b;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            border-top: 1px solid #334155;
            margin-top: 20px;
            border-radius: 0 0 12px 12px;
        }

        @media (max-width: 768px) {
            .modules-grid { grid-template-columns: 1fr; }
            .stats { grid-template-columns: repeat(3, 1fr); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔀 Интерактивный граф модулей и сущностей</h1>
            <div class="root">⭐ Точка входа: ${analysis.root}</div>
            <div class="sub">Сгенерировано: ${new Date().toLocaleString()}</div>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="value">${analysis.stats.totalModules}</div>
                <div class="label">📁 Модулей</div>
            </div>
            <div class="stat-card">
                <div class="value">${analysis.stats.totalEntities}</div>
                <div class="label">🔧 Сущностей</div>
            </div>
            <div class="stat-card">
                <div class="value ${analysis.stats.hasCycles ? 'error' : 'success'}">
                    ${analysis.stats.cycles?.length || 0}
                </div>
                <div class="label">🔄 Циклов</div>
            </div>
            <div class="stat-card">
                <div class="value">${functions.length}</div>
                <div class="label">ƒ Функций</div>
            </div>
            <div class="stat-card">
                <div class="value">${classes.length}</div>
                <div class="label">🏛️ Классов</div>
            </div>
            <div class="stat-card">
                <div class="value">${constants.length}</div>
                <div class="label">📌 Констант</div>
            </div>
            <div class="stat-card">
                <div class="value">${interfaces.length}</div>
                <div class="label">📐 Интерфейсов</div>
            </div>
            <div class="stat-card">
                <div class="value">${types.length}</div>
                <div class="label">📋 Типов</div>
            </div>
            <div class="stat-card">
                <div class="value">${variables.length}</div>
                <div class="label">📦 Переменных</div>
            </div>
            <div class="stat-card">
                <div class="value">${callEdges.length}</div>
                <div class="label">📞 Вызовов</div>
            </div>
            <div class="stat-card">
                <div class="value">${importEdges.length}</div>
                <div class="label">📥 Импортов</div>
            </div>
            <div class="stat-card">
                <div class="value">${exportEdges.length}</div>
                <div class="label">📤 Экспортов</div>
            </div>
            <div class="stat-card">
                <div class="value">${extendsEdges.length}</div>
                <div class="label">🔗 Наследований</div>
            </div>
        </div>

        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background:#4f46e5;"></div>
                <span>⭐ Точка входа</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#60a5fa;"></div>
                <span>Функция</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#4ade80;"></div>
                <span>Класс / Vue</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#fbbf24;"></div>
                <span>Константа</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#a78bfa;"></div>
                <span>Интерфейс</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#f472b6;"></div>
                <span>Тип</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#22d3ee;"></div>
                <span>Переменная</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#3b82f6; width:30px; height:3px;"></div>
                <span>Импорт модуля</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#f59e0b; width:30px; height:3px;"></div>
                <span>Вызов функции</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#7c3aed; width:30px; height:3px;"></div>
                <span>Наследование</span>
            </div>
        </div>

        <div class="graph-container">
            <div id="svg-wrapper">
                ${svgContent}
            </div>
            <div class="graph-controls">
                <button onclick="zoomIn()">🔍+</button>
                <button onclick="zoomOut()">🔍−</button>
                <button onclick="resetZoom()">⟲ Сброс</button>
                <button onclick="toggleLabels()">🏷️ Метки</button>
                <button onclick="toggleEntities()">🔧 Сущности</button>
                <span class="hint">💡 Колесо мыши — масштаб, перетаскивание — перемещение</span>
            </div>
        </div>

        ${
          analysis.stats.cycles?.length > 0
            ? `
        <div class="cycles-section">
            <h2>🔄 Циклические зависимости (${analysis.stats.cycles.length})</h2>
            ${analysis.stats.cycles.map((cycle: string[]) => `<div class="cycle-item">${cycle.join(' → ')}</div>`).join('')}
        </div>
        `
            : ''
        }

        <h2 style="margin: 25px 0 15px; color:#60a5fa;">📁 Модули и сущности</h2>
        <div class="modules-grid">
            ${analysis.moduleGraph?.nodes
              ?.map((module: ModuleGraphNode) => {
                const entities =
                  analysis.entityGraph?.nodes?.filter(
                    (e: EntityGraphNode) => e.module === module.id
                  ) || [];
                const isEntry = module.metadata?.isEntry || false;
                return `
                <div class="module-card">
                    <div class="name">${isEntry ? '⭐ ' : ''}${module.name}</div>
                    <div class="path">${module.id}</div>
                    <div class="badges">
                        <span class="badge function">${entities.filter((e: EntityGraphNode) => e.type === 'function').length} функций</span>
                        <span class="badge class">${entities.filter((e: EntityGraphNode) => e.type === 'class').length} классов</span>
                        <span class="badge constant">${entities.filter((e: EntityGraphNode) => e.type === 'constant').length} констант</span>
                        <span class="badge level">Уровень ${module.level || 0}</span>
                    </div>
                    <div class="entities-list">
                        ${entities
                          .slice(0, 20)
                          .map((entity: EntityGraphNode) => {
                            const iconMap: Record<string, string> = {
                              function: 'ƒ',
                              class: '🏛️',
                              constant: '📌',
                              interface: '📐',
                              type: '📋',
                              variable: '📦',
                              enum: '🔢',
                            };
                            const icon = iconMap[entity.type] || '•';
                            const isExported = entity.metadata?.isExported || false;
                            const isAsync = entity.metadata?.isAsync || false;
                            const params = entity.metadata?.params || [];
                            const paramStr = params.length > 0 ? `(${params.join(', ')})` : '()';
                            const calls = entity.metadata?.calls || [];
                            const callStr =
                              calls.length > 0
                                ? `→ ${calls.slice(0, 3).join(', ')}${calls.length > 3 ? '...' : ''}`
                                : '';
                            const importedFrom = entity.metadata?.importedFrom || '';
                            return `
                            <div class="entity-item">
                                <span class="type-icon">${icon}</span>
                                <span class="entity-name">${entity.name}</span>
                                ${isExported ? '<span class="entity-export">📤</span>' : ''}
                                ${isAsync ? '<span class="entity-async">⚡</span>' : ''}
                                <span class="entity-params">${paramStr}</span>
                                ${callStr ? `<span class="entity-calls">${callStr}</span>` : ''}
                                ${importedFrom ? `<span class="entity-module">← ${path.basename(importedFrom)}</span>` : ''}
                            </div>
                          `;
                          })
                          .join('')}
                        ${entities.length > 20 ? `<div style="color:#64748b;font-size:10px;padding:4px 6px;">... и ещё ${entities.length - 20} сущностей</div>` : ''}
                        ${entities.length === 0 ? '<div style="color:#64748b;font-size:11px;padding:4px 6px;">Нет сущностей</div>' : ''}
                    </div>
                </div>
              `;
              })
              .join('')}
        </div>

        <div class="footer">
            <p>Сгенерировано AST Analyzer v3.0.0 | Graphviz + DOT</p>
            <p style="font-size:10px;color:#475569;margin-top:4px;">
                Модулей: ${analysis.stats.totalModules} | Сущностей: ${analysis.stats.totalEntities} | Вызовов: ${callEdges.length} | Импортов: ${importEdges.length} | Экспортов: ${exportEdges.length} | Наследований: ${extendsEdges.length} | Циклов: ${analysis.stats.cycles?.length || 0}
            </p>
        </div>
    </div>

    <script>
        let svgPanZoomInstance = null;
        let showLabels = true;
        let showEntities = true;

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
                console.log('✅ SVG Pan Zoom initialized');
            } else {
                console.log('⚠️ SVG not found, waiting...');
                setTimeout(initPanZoom, 500);
            }
        }

        function zoomIn() {
            if (svgPanZoomInstance) {
                svgPanZoomInstance.zoomIn();
            }
        }

        function zoomOut() {
            if (svgPanZoomInstance) {
                svgPanZoomInstance.zoomOut();
            }
        }

        function resetZoom() {
            if (svgPanZoomInstance) {
                svgPanZoomInstance.resetZoom();
                svgPanZoomInstance.center();
            }
        }

        function toggleLabels() {
            showLabels = !showLabels;
            const texts = document.querySelectorAll('#svg-wrapper svg text');
            texts.forEach(t => {
                t.style.display = showLabels ? 'block' : 'none';
            });
        }

        function toggleEntities() {
            showEntities = !showEntities;
            const entityNodes = document.querySelectorAll('#svg-wrapper svg .node ellipse, #svg-wrapper svg .node diamond');
            entityNodes.forEach(n => {
                n.style.display = showEntities ? 'block' : 'none';
            });
            const entityTexts = document.querySelectorAll('#svg-wrapper svg .node text');
            entityTexts.forEach(t => {
                const parent = t.parentElement;
                if (parent && parent.querySelector('ellipse, diamond')) {
                    t.style.display = showEntities ? 'block' : 'none';
                }
            });
        }

        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initPanZoom, 300);
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
  console.log(`  ✅ interactive-report.html`);
}

export default {
  generateInteractiveHTML,
};
