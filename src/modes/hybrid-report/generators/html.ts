// src/modes/hybrid-report/generators/html.ts

import { Graphviz } from '@hpcc-js/wasm-graphviz';
import type { HybridReport, HybridModule, HybridFunction } from '../types.js';
import { generateHybridDOT } from './dot.js';

/**
 * Генерирует HTML отчет с интерактивным графом и 3D координатной системой
 * @param report - Отчет HybridReport
 * @param maxDepth - Максимальная глубина для координатной системы
 * @returns HTML строка
 */
export async function generateHybridHTML(report: HybridReport, maxDepth: number): Promise<string> {
  // Проверка наличия данных
  if (!report || !report.modules || !report.stats) {
    console.warn('  ⚠️ Отчет не содержит данных, создаем пустой HTML');
    return '<html><body><h1>Ошибка: отчет пуст</h1></body></html>';
  }

  // Генерируем DOT для графа
  const dot = generateHybridDOT(report);

  // Используем Graphviz для генерации SVG
  let svgContent = '';
  try {
    console.log('  ⚙️ Генерация SVG через Graphviz...');
    const graphviz = await Graphviz.load();
    svgContent = await graphviz.dot(dot);
    console.log('  ✅ SVG сгенерирован');
  } catch (error) {
    console.warn('  ⚠️ Graphviz не доступен, используем D3 граф');
    svgContent = '';
  }

  const jsonData = JSON.stringify(report, null, 2);

  // Параметры координатной системы
  const minLevel = 0;
  const range = maxDepth - minLevel || 1;

  // Текущий уровень
  const currentPath = report.root || '';
  const currentLevel =
    report.levels && report.levels[currentPath] !== undefined ? report.levels[currentPath] : 0;
  const isLevelInRange = currentLevel >= minLevel && currentLevel <= maxDepth;

  // Фильтруем модули в диапазоне
  const filteredModules = report.modules.filter(
    (m: HybridModule) => m.level >= minLevel && m.level <= maxDepth
  );

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Гибридный отчет: Модули + Функции</title>
    <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
        }
        .container { max-width: 1600px; margin: 0 auto; }
        
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }
        .header h1 { font-size: 28px; color: #60a5fa; }
        .header .sub { color: #94a3b8; margin-top: 8px; font-size: 14px; }
        .header .root { color: #fbbf24; font-family: monospace; margin-top: 4px; }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: #1e293b;
            padding: 14px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #334155;
        }
        .stat-card .value { font-size: 24px; font-weight: bold; color: #60a5fa; }
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
        }
        .graph-controls {
            display: flex;
            gap: 10px;
            padding: 10px 0;
            flex-wrap: wrap;
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
            position: relative;
        }
        .module-card:hover { border-color: #60a5fa; transform: translateY(-2px); }
        .module-card .level-badge {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #60a5fa;
            color: #0f172a;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
        }
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
        .badge.component { background: #4ade80; color: #0f172a; }
        .badge.composable { background: #a78bfa; color: #fff; }
        .badge.level { background: #334155; color: #94a3b8; }
        .badge.self { background: #22d3ee; color: #0f172a; }
        .badge.external { background: #f472b6; color: #fff; }
        
        .module-card .functions-list {
            margin-top: 10px;
            max-height: 200px;
            overflow-y: auto;
        }
        .func-item {
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
        .func-item .func-name { color: #e2e8f0; }
        .func-item .func-export { color: #f87171; font-size: 9px; }
        .func-item .func-async { color: #fbbf24; font-size: 9px; }
        .func-item .func-calls { color: #94a3b8; font-size: 10px; }
        .func-item .func-source { 
            font-size: 9px; 
            padding: 1px 6px; 
            border-radius: 8px;
            background: #1e293b;
        }
        .func-item .func-source.self { color: #22d3ee; }
        .func-item .func-source.external { color: #f472b6; }
        
        .cycles-section {
            background: #1e293b;
            border-radius: 8px;
            padding: 16px;
            margin-top: 20px;
            border: 1px solid #f87171;
        }
        .cycles-section h2 { color: #f87171; margin-bottom: 10px; font-size: 18px; }
        .cycle-item { font-family: monospace; color: #fbbf24; margin: 4px 0; font-size: 13px; }
        
        .levels-section {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin: 15px 0;
            padding: 15px;
            background: #1e293b;
            border-radius: 8px;
            border: 1px solid #334155;
        }
        .level-stat {
            text-align: center;
            padding: 8px 16px;
            background: #0f172a;
            border-radius: 6px;
            border-left: 3px solid #60a5fa;
        }
        .level-stat .lvl { font-size: 12px; color: #94a3b8; }
        .level-stat .count { font-size: 18px; font-weight: bold; color: #e2e8f0; }
        .level-stat .sub { font-size: 10px; color: #64748b; }
        
        .view-toggle {
            display: flex;
            gap: 8px;
            margin: 10px 0;
        }
        .view-toggle button {
            background: #334155;
            border: none;
            color: #e2e8f0;
            padding: 6px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }
        .view-toggle button.active {
            background: #60a5fa;
            color: #0f172a;
        }
        
        .coordinate-system {
            background: #1e293b;
            border-radius: 12px;
            padding: 20px;
            margin: 15px 0;
            border: 1px solid #334155;
            position: relative;
            overflow: hidden;
        }
        .coordinate-system h3 {
            color: #60a5fa;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .coordinate-grid {
            display: grid;
            grid-template-columns: 80px 1fr 80px;
            gap: 10px;
            align-items: center;
        }
        .coordinate-axis {
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
        }
        .coordinate-axis .label {
            font-weight: bold;
            color: #60a5fa;
        }
        .coordinate-axis .arrow {
            font-size: 20px;
            color: #3b82f6;
        }
        .coordinate-axis .arrow.back { color: #f59e0b; }
        
        .coordinate-bar {
            position: relative;
            height: 40px;
            background: #0f172a;
            border-radius: 8px;
            border: 1px solid #334155;
            overflow: visible;
        }
        .coordinate-bar .level-marker {
            position: absolute;
            top: -8px;
            width: 2px;
            height: 56px;
            background: #60a5fa;
            transition: all 0.3s;
        }
        .coordinate-bar .level-marker .level-label {
            position: absolute;
            top: -22px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            color: #60a5fa;
            white-space: nowrap;
        }
        .coordinate-bar .level-marker .module-name {
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 8px;
            color: #94a3b8;
            white-space: nowrap;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .coordinate-bar .level-marker.root {
            background: #fbbf24;
            height: 64px;
            top: -12px;
        }
        .coordinate-bar .level-marker.root .level-label { color: #fbbf24; }
        .coordinate-bar .level-marker.current {
            background: #22d3ee;
            height: 64px;
            top: -12px;
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
        }
        .coordinate-bar .level-marker.current .level-label { color: #22d3ee; }
        
        .coordinate-legend {
            display: flex;
            gap: 20px;
            justify-content: center;
            margin-top: 15px;
            font-size: 11px;
        }
        .coordinate-legend .legend-dot {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 6px;
        }
        
        .range-warning {
            background: #fef3c7;
            color: #92400e;
            padding: 10px 15px;
            border-radius: 8px;
            margin: 10px 0;
            font-size: 13px;
            border-left: 4px solid #f59e0b;
        }
        
        @media (max-width: 768px) {
            .modules-grid { grid-template-columns: 1fr; }
            .stats { grid-template-columns: repeat(3, 1fr); }
            .coordinate-grid { grid-template-columns: 60px 1fr 60px; }
        }
        
        .functions-list::-webkit-scrollbar {
            width: 4px;
        }
        .functions-list::-webkit-scrollbar-track {
            background: transparent;
        }
        .functions-list::-webkit-scrollbar-thumb {
            background: #475569;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔀 Гибридный отчет: Модули + Функции</h1>
            <div class="root">⭐ Точка входа: ${report.root}</div>
            <div class="sub">Сгенерировано: ${new Date().toLocaleString()}</div>
            <div class="sub">Глубина анализа: ${report.stats.maxDepth}</div>
        </div>

        ${
          !isLevelInRange
            ? `
        <div class="range-warning">
            ⚠️ Внимание: Текущий уровень (${currentLevel}) выходит за пределы диапазона [${minLevel}, ${maxDepth}]
        </div>
        `
            : ''
        }

        <div class="stats">
            <div class="stat-card">
                <div class="value">${report.stats.totalModules}</div>
                <div class="label">📁 Модулей</div>
            </div>
            <div class="stat-card">
                <div class="value">${report.stats.totalFunctions}</div>
                <div class="label">🔧 Функций</div>
            </div>
            <div class="stat-card">
                <div class="value ${report.stats.cycles > 0 ? 'error' : 'success'}">${report.stats.cycles}</div>
                <div class="label">🔄 Циклов</div>
            </div>
            <div class="stat-card">
                <div class="value">${report.stats.totalComponents}</div>
                <div class="label">🧩 Компонентов</div>
            </div>
            <div class="stat-card">
                <div class="value">${report.stats.totalComposables}</div>
                <div class="label">🧬 Композаблов</div>
            </div>
            <div class="stat-card">
                <div class="value">${report.stats.totalExports}</div>
                <div class="label">📤 Экспортов</div>
            </div>
            <div class="stat-card">
                <div class="value">${report.stats.totalImports}</div>
                <div class="label">📥 Импортов</div>
            </div>
        </div>

        <div class="levels-section">
            ${Object.entries(report.stats.byLevel)
              .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
              .map(
                ([level, data]) => `
                <div class="level-stat">
                    <div class="lvl">Уровень ${level}</div>
                    <div class="count">${data.modules}</div>
                    <div class="sub">модулей, ${data.functions} функций</div>
                </div>
            `
              )
              .join('')}
        </div>

        <div class="coordinate-system">
            <h3>📊 3D Координатная система: Уровни и направления</h3>
            <p style="font-size:12px;color:#94a3b8;margin-bottom:15px;">
                Максимальная глубина: ${maxDepth} | Минимальный уровень: 0 | Текущий уровень: ${currentLevel} ${isLevelInRange ? '✅ в диапазоне' : '⚠️ вне диапазона'}
            </p>
            <div class="coordinate-grid">
                <div class="coordinate-axis">
                    <div class="arrow back">⬅️</div>
                    <div class="label">Назад</div>
                    <div style="font-size:10px;color:#64748b;">(уровень ↓)</div>
                </div>
                <div class="coordinate-bar" id="coordinateBar">
                    ${(() => {
                      const sortedModules = [...filteredModules].sort((a, b) => a.level - b.level);
                      const currentPath = report.root;
                      const rng = range;

                      let markers = '';
                      for (const module of sortedModules) {
                        const pos = ((module.level - minLevel) / rng) * 100;
                        const isRoot = module.path === report.root;
                        const isCurrent = module.path === currentPath;
                        let cls = '';
                        if (isRoot) cls = 'root';
                        else if (isCurrent) cls = 'current';
                        const label = isRoot ? '⭐ ' + module.name : module.name;

                        markers +=
                          '<div class="level-marker ' + cls + '" style="left: ' + pos + '%;">';
                        markers += '<div class="level-label">' + module.level + '</div>';
                        markers += '<div class="module-name">' + label + '</div>';
                        markers += '</div>';
                      }
                      return markers;
                    })()}
                </div>
                <div class="coordinate-axis">
                    <div class="arrow">➡️</div>
                    <div class="label">Вперед</div>
                    <div style="font-size:10px;color:#64748b;">(уровень ↑)</div>
                </div>
            </div>
            <div class="coordinate-legend">
                <span><span class="legend-dot" style="background:#fbbf24;"></span> Точка входа (уровень 0)</span>
                <span><span class="legend-dot" style="background:#60a5fa;"></span> Модуль</span>
                <span><span class="legend-dot" style="background:#22d3ee;"></span> Текущий модуль</span>
                <span style="color:#3b82f6;">➡️ Вперед (уровень ↑)</span>
                <span style="color:#f59e0b;">⬅️ Назад (уровень ↓)</span>
            </div>
            <div style="margin-top:10px;font-size:11px;color:#94a3b8;text-align:center;">
                🔄 Движение вперед = импорт модуля с большим уровнем (глубина ↑) | Назад = импорт с меньшим уровнем (возврат ↑)
            </div>
        </div>

        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background:#4ade80;"></div>
                <span>Vue компонент</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#60a5fa;"></div>
                <span>TypeScript модуль</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#fcd34d;"></div>
                <span>JavaScript модуль</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#f87171;"></div>
                <span>Экспортированная функция</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#fbbf24;"></div>
                <span>Внутренняя функция</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#3b82f6; width:30px; height:4px;"></div>
                <span>Импорт (вперед ↓)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#f59e0b; width:30px; height:4px;"></div>
                <span>Обратная связь (назад ↑)</span>
            </div>
        </div>

        <div class="view-toggle">
            <button class="active" onclick="switchView('d3')">📊 D3 Граф</button>
            <button onclick="switchView('svg')">📈 SVG (Graphviz)</button>
            <button onclick="switchView('list')">📋 Список</button>
        </div>

        <div class="graph-container">
            <div id="d3-graph" style="width:100%; height:700px; background:#0f172a; border-radius:8px; display:block;"></div>
            <div id="svg-graph" style="width:100%; min-height:500px; background:#0f172a; border-radius:8px; display:none;">
                ${svgContent || '<p style="color:#94a3b8; text-align:center; padding:40px;">SVG не доступен (Graphviz не установлен)</p>'}
            </div>
            <div id="list-view" style="display:none; padding:20px; max-height:700px; overflow-y:auto;">
                <h3 style="color:#60a5fa;">📋 Список связей</h3>
                ${filteredModules
                  .map(
                    (m: HybridModule) => `
                    <div style="margin:10px 0; padding:10px; background:#0f172a; border-radius:6px; border-left:3px solid ${m.level === 0 ? '#fbbf24' : '#60a5fa'};">
                        <div style="font-weight:bold; color:#e2e8f0;">
                            ${m.level === 0 ? '⭐ ' : ''}${m.name}
                            <span style="font-size:10px; color:#64748b;">(ур.${m.level})</span>
                        </div>
                        <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
                            ${m.functions.length} функций
                            ${m.exports.length > 0 ? `, ${m.exports.length} экспортов` : ''}
                            ${m.imports.length > 0 ? `, ${m.imports.length} импортов` : ''}
                        </div>
                        ${
                          m.functions.length > 0
                            ? `
                            <div style="font-size:10px; color:#94a3b8; margin-top:4px;">
                                ${m.functions.map((f: HybridFunction) => `${f.name}${f.isExported ? '📤' : ''}${f.calls.length > 0 ? '→' + f.calls.join(',') : ''}`).join(' | ')}
                            </div>
                        `
                            : ''
                        }
                    </div>
                `
                  )
                  .join('')}
            </div>
            <div class="graph-controls">
                <button onclick="zoomIn()">🔍+</button>
                <button onclick="zoomOut()">🔍−</button>
                <button onclick="resetZoom()">⟲ Сброс</button>
                <button onclick="toggleLabels()">🏷️ Метки</button>
                <button onclick="toggleCycles()">🔄 Циклы</button>
            </div>
        </div>

        ${
          report.cycles.length > 0
            ? `
        <div class="cycles-section">
            <h2>🔄 Циклические зависимости (${report.cycles.length})</h2>
            ${report.cycles.map((cycle: string[]) => `<div class="cycle-item">${cycle.join(' → ')}</div>`).join('')}
        </div>
        `
            : ''
        }

        <h2 style="margin: 25px 0 15px; color:#60a5fa;">📁 Модули по уровням</h2>
        <div class="modules-grid">
            ${filteredModules
              .map(
                (module: HybridModule) => `
            <div class="module-card">
                <span class="level-badge">Ур. ${module.level}</span>
                <div class="name">${module.path === report.root ? '⭐ ' : ''}${module.name}</div>
                <div class="path">${module.path}</div>
                <div class="badges">
                    <span class="badge function">${module.functions.length} функций</span>
                    ${module.exports.length > 0 ? `<span class="badge export">${module.exports.length} экспортов</span>` : ''}
                    ${module.imports.length > 0 ? `<span class="badge import">${module.imports.length} импортов</span>` : ''}
                    ${module.components.length > 0 ? `<span class="badge component">${module.components.length} компонентов</span>` : ''}
                    ${module.composables.length > 0 ? `<span class="badge composable">${module.composables.length} композаблов</span>` : ''}
                    <span class="badge level">Уровень ${module.level}</span>
                </div>
                ${
                  module.functions.length > 0
                    ? `
                <div class="functions-list">
                    ${module.functions
                      .map(
                        (f: HybridFunction) => `
                        <div class="func-item">
                            <span class="func-name">${f.name}</span>
                            ${f.isExported ? '<span class="func-export">📤</span>' : ''}
                            ${f.isAsync ? '<span class="func-async">⚡</span>' : ''}
                            ${f.calls.length > 0 ? `<span class="func-calls">→ ${f.calls.join(', ')}</span>` : ''}
                            <span class="func-source ${f.exportSource}">
                                ${f.exportSource === 'self' ? '🔹 self' : f.exportSource === 'external' ? `🔸 ${f.exportModule}` : '🔄 re-export'}
                            </span>
                            <span style="font-size:9px; color:#64748b;">строки ${f.startLine}-${f.endLine}</span>
                        </div>
                    `
                      )
                      .join('')}
                </div>
                `
                    : '<div style="color:#64748b; font-size:12px; margin-top:8px;">Нет функций</div>'
                }
            </div>
            `
              )
              .join('')}
        </div>
    </div>

    <script>
        const graphData = ${jsonData};
        let currentZoom = 1;
        let showLabels = true;
        let showCycles = true;
        let svg, g, zoom;
        let currentView = 'd3';

        window.switchView = function(view) {
            currentView = view;
            document.getElementById('d3-graph').style.display = view === 'd3' ? 'block' : 'none';
            document.getElementById('svg-graph').style.display = view === 'svg' ? 'block' : 'none';
            document.getElementById('list-view').style.display = view === 'list' ? 'block' : 'none';
            
            document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-toggle button').forEach(b => {
                if ((view === 'd3' && b.textContent.includes('D3')) ||
                    (view === 'svg' && b.textContent.includes('SVG')) ||
                    (view === 'list' && b.textContent.includes('Список'))) {
                    b.classList.add('active');
                }
            });
            
            if (view === 'd3' && !document.querySelector('#d3-graph svg')) {
                initGraph();
            }
        };

        function initGraph() {
            const width = document.getElementById('d3-graph').clientWidth || 900;
            const height = 700;
            
            const container = d3.select('#d3-graph');
            container.html('');
            
            svg = container.append('svg')
                .attr('width', width)
                .attr('height', height)
                .style('background', '#0f172a')
                .style('border-radius', '8px');
            
            const levelColors = ['#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#f87171', '#22d3ee'];
            
            const nodes: any[] = [];
            const edges: any[] = [];
            const nodeIds = new Set<string>();
            
            graphData.modules.forEach((module: HybridModule) => {
                const id = module.path;
                if (!nodeIds.has(id)) {
                    nodeIds.add(id);
                    const isRoot = module.path === graphData.root;
                    nodes.push({
                        id: id,
                        name: isRoot ? '⭐ ' + module.name : module.name,
                        type: module.type,
                        level: module.level,
                        isRoot: isRoot,
                        functions: module.functions.length,
                        exports: module.exports.length,
                        imports: module.imports.length,
                        color: levelColors[module.level % levelColors.length] || '#94a3b8',
                        size: isRoot ? 35 : 25,
                    });
                }
                
                module.functions.forEach((func: HybridFunction) => {
                    const funcId = id + '#func:' + func.name;
                    if (!nodeIds.has(funcId)) {
                        nodeIds.add(funcId);
                        nodes.push({
                            id: funcId,
                            name: func.isExported ? '📤 ' + func.name : func.name,
                            type: 'function',
                            level: module.level,
                            isRoot: false,
                            isExported: func.isExported,
                            isAsync: func.isAsync,
                            calls: func.calls,
                            parent: id,
                            color: func.isExported ? '#f87171' : '#fbbf24',
                            size: 8,
                        });
                    }
                });
            });
            
            graphData.graph.edges.forEach((edge: { from: string; to: string; type: string; level?: number }) => {
                const fromLevel = graphData.levels[edge.from] || 0;
                const toLevel = graphData.levels[edge.to] || 0;
                edges.push({
                    source: edge.from,
                    target: edge.to,
                    type: edge.type,
                    level: edge.level,
                    fromLevel: fromLevel,
                    toLevel: toLevel,
                    isCycle: fromLevel > toLevel,
                });
            });
            
            graphData.modules.forEach((module: HybridModule) => {
                module.functions.forEach((func: HybridFunction) => {
                    func.calls.forEach((call: string) => {
                        const targetFunc = module.functions.find((f: HybridFunction) => f.name === call);
                        if (targetFunc) {
                            edges.push({
                                source: module.path + '#func:' + func.name,
                                target: module.path + '#func:' + targetFunc.name,
                                type: 'call',
                                isCall: true,
                            });
                        }
                    });
                });
            });
            
            zoom = d3.zoom()
                .extent([[0, 0], [width, height]])
                .scaleExtent([0.1, 4])
                .on('zoom', (event: any) => {
                    g.attr('transform', event.transform);
                    currentZoom = event.transform.k;
                });
            
            svg.call(zoom);
            
            g = svg.append('g');
            
            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(150))
                .force('charge', d3.forceManyBody().strength(-300))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(30))
                .force('x', d3.forceX(width / 2).strength(0.05))
                .force('y', d3.forceY(height / 2).strength(0.05));
            
            const link = g.append('g')
                .selectAll('line')
                .data(edges)
                .enter()
                .append('line')
                .attr('stroke', (d: any) => d.isCall ? '#ef4444' : (d.isCycle ? '#f59e0b' : '#3b82f6'))
                .attr('stroke-width', (d: any) => d.isCall ? 1.5 : (d.isCycle ? 2 : 1))
                .attr('stroke-opacity', (d: any) => d.isCall ? 0.8 : 0.5)
                .attr('stroke-dasharray', (d: any) => d.isCall ? 'none' : (d.isCycle ? '8,4' : 'none'))
                .attr('class', (d: any) => d.isCycle ? 'cycle-edge' : '');
            
            const node = g.append('g')
                .selectAll('circle')
                .data(nodes)
                .enter()
                .append('circle')
                .attr('r', (d: any) => d.size || 10)
                .attr('fill', (d: any) => d.color)
                .attr('stroke', (d: any) => d.isRoot ? '#fbbf24' : '#1e293b')
                .attr('stroke-width', (d: any) => d.isRoot ? 3 : 1)
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));
            
            const label = g.append('g')
                .selectAll('text')
                .data(nodes)
                .enter()
                .append('text')
                .text((d: any) => d.name)
                .attr('font-size', (d: any) => d.type === 'function' ? '8px' : '11px')
                .attr('fill', '#e2e8f0')
                .attr('text-anchor', 'middle')
                .attr('dy', (d: any) => d.type === 'function' ? -14 : 35)
                .style('font-family', 'monospace')
                .style('pointer-events', 'none');
            
            const info = g.append('g')
                .selectAll('text.info')
                .data(nodes.filter((d: any) => d.type !== 'function'))
                .enter()
                .append('text')
                .text((d: any) => d.functions + ' функций')
                .attr('font-size', '7px')
                .attr('fill', '#94a3b8')
                .attr('text-anchor', 'middle')
                .attr('dy', 48)
                .style('pointer-events', 'none');
            
            function ticked() {
                link
                    .attr('x1', (d: any) => d.source.x)
                    .attr('y1', (d: any) => d.source.y)
                    .attr('x2', (d: any) => d.target.x)
                    .attr('y2', (d: any) => d.target.y);
                
                node
                    .attr('cx', (d: any) => d.x)
                    .attr('cy', (d: any) => d.y);
                
                label
                    .attr('x', (d: any) => d.x)
                    .attr('y', (d: any) => d.y);
                
                info
                    .attr('x', (d: any) => d.x)
                    .attr('y', (d: any) => d.y);
            }
            
            simulation.on('tick', ticked);
            
            function dragstarted(event: any, d: any) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }
            
            function dragged(event: any, d: any) {
                d.fx = event.x;
                d.fy = event.y;
            }
            
            function dragended(event: any, d: any) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }
            
            window.zoomIn = function() {
                zoom.scaleBy(svg.transition().duration(300), 1.3);
            };
            
            window.zoomOut = function() {
                zoom.scaleBy(svg.transition().duration(300), 0.7);
            };
            
            window.resetZoom = function() {
                svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
            };
            
            window.toggleLabels = function() {
                showLabels = !showLabels;
                label.style('display', showLabels ? 'block' : 'none');
                info.style('display', showLabels ? 'block' : 'none');
            };
            
            window.toggleCycles = function() {
                showCycles = !showCycles;
                document.querySelectorAll('.cycle-edge').forEach((el: Element) => {
                    (el as HTMLElement).style.display = showCycles ? 'block' : 'none';
                });
                const cyclesSection = document.querySelector('.cycles-section');
                if (cyclesSection) {
                    (cyclesSection as HTMLElement).style.display = showCycles ? 'block' : 'none';
                }
            };
        }
        
        window.addEventListener('load', function() {
            initGraph();
            const svgGraph = document.getElementById('svg-graph');
            if (svgGraph) {
                const svgEl = svgGraph.querySelector('svg');
                if (svgEl) {
                    svgPanZoom(svgEl, {
                        zoomEnabled: true,
                        controlIconsEnabled: true,
                        fit: true,
                        center: true,
                        minZoom: 0.1,
                        maxZoom: 4,
                    });
                }
            }
        });
        
        window.addEventListener('resize', function() {
            const container = document.getElementById('d3-graph');
            if (container && currentView === 'd3') {
                const width = container.clientWidth || 900;
                const svgEl = container.querySelector('svg');
                if (svgEl) {
                    svgEl.setAttribute('width', width);
                }
            }
        });
    </script>
</body>
</html>`;
}
