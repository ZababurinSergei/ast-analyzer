import context from './package-lock-report.json' with { type: 'json' };
import { DataConverter } from './data-converter.js';
import 'd3';
const d3 = window.d3;

// ============================================================
// СИМВОЛЫ ДЛЯ ДАННЫХ И ПРИЛОЖЕНИЯ
// ============================================================
const SYM_REPORT_DATA = Symbol.for('__AST_INTERACTIVE_REPORT_DATA__');
const SYM_FUNCTIONS_DATA = Symbol.for('__AST_INTERACTIVE_FUNCTIONS_DATA__');
const SYM_DATA_VERSION = Symbol.for('__AST_INTERACTIVE_DATA_VERSION__');
const SYM_APP_INSTANCE = Symbol.for('__AST_INTERACTIVE_APP_INSTANCE__');

// ============================================================
// ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПРИЛОЖЕНИЯ
// ============================================================
function getApp() {
  const app = globalThis[SYM_APP_INSTANCE];
  if (app && app._isApp === true) {
    return app;
  }
  return null;
}

globalThis.getApp = getApp;

// ============================================================
// ЗАГРУЗКА И ПРЕОБРАЗОВАНИЕ ДАННЫХ ЧЕРЕЗ DataConverter
// ============================================================

// Используем импортированный JSON
const rawReportData = context;
const rawFunctionsData = [];

// Собираем функции из JSON
for (const [modulePath, pkg] of Object.entries(context.packages || {})) {
  if (!pkg) {
    continue;
  }
  for (const func of pkg.entities?.functions || []) {
    rawFunctionsData.push({ modulePath, func });
  }
}

// Используем DataConverter для преобразования данных
let REPORT_DATA = null;
let ALL_FUNCTIONS_DATA = [];

if (DataConverter && rawReportData) {
  console.log('🔄 Используем DataConverter для обработки данных...');

  if (rawReportData.packages) {
    // Данные уже в формате PackageLockReport
    REPORT_DATA = rawReportData;

    // Обогащаем данными из функций (если есть)
    if (rawFunctionsData && rawFunctionsData.length > 0) {
      const entitiesWithCalls = {
        functions: rawFunctionsData.map(item => item.func || item),
      };
      REPORT_DATA = DataConverter.enrichReport(REPORT_DATA, entitiesWithCalls);
    }
  } else if (rawReportData.moduleGraph) {
    // Данные в формате FullAnalysis - преобразуем
    REPORT_DATA = DataConverter.buildReportFromAnalysis(rawReportData);
  } else {
    // Неизвестный формат - используем как есть
    REPORT_DATA = rawReportData;
  }

  // Формируем ALL_FUNCTIONS_DATA из преобразованных данных
  if (REPORT_DATA && REPORT_DATA.packages) {
    ALL_FUNCTIONS_DATA = [];
    for (const [modulePath, pkg] of Object.entries(REPORT_DATA.packages)) {
      if (!pkg) {
        continue;
      }
      for (const func of pkg.entities?.functions || []) {
        ALL_FUNCTIONS_DATA.push({ modulePath, func });
      }
    }
  }
} else {
  // Fallback: используем сырые данные
  REPORT_DATA = rawReportData;
  ALL_FUNCTIONS_DATA = rawFunctionsData || [];
}

console.log('✅ Данные загружены и преобразованы');
console.log('📊 Модулей:', Object.keys(REPORT_DATA?.packages || {}).length);
console.log('ƒ Функций:', ALL_FUNCTIONS_DATA?.length || 0);
console.log('🔧 DataConverter использован:', !!DataConverter);

// Устанавливаем данные в globalThis через Symbol
globalThis[SYM_REPORT_DATA] = REPORT_DATA;
globalThis[SYM_FUNCTIONS_DATA] = ALL_FUNCTIONS_DATA;
globalThis[SYM_DATA_VERSION] = 1;

console.log('✅ Данные загружены из JSON через import');
console.log('📊 Модулей:', Object.keys(REPORT_DATA?.packages || {}).length);
console.log('ƒ Функций:', ALL_FUNCTIONS_DATA?.length || 0);

// ============================================================
// ПРИЛОЖЕНИЕ
// ============================================================

class App {
  constructor() {
    this._isApp = true;
    this.reportData = REPORT_DATA;
    this.allFunctionsData = ALL_FUNCTIONS_DATA;
    this.currentMode = 'all';
    this.currentFocusModule = null;
    this.currentFocusFunction = null;
    this.simulation = null;
    this.svg = null;
    this.g = null;
    this.zoom = null;
    this.graphNodes = [];
    this.graphLinks = [];
    this.nodeMap = new Map();
    this.searchTimeout = null;
    this.isInitialized = false;
    this.updateCount = 0;

    globalThis[SYM_APP_INSTANCE] = this;

    if (!globalThis.getApp) {
      globalThis.getApp = getApp;
    }

    this.init();
  }

  init() {
    this.reportData = globalThis[SYM_REPORT_DATA];
    const allFunctionsData = globalThis[SYM_FUNCTIONS_DATA] || [];

    if (!this.reportData) {
      this.showPlaceholder();
      return;
    }

    this.updateStats();
    this.renderModules();
    this.initGraph();
    this.updateView();
    this.setupKeyboard();
    this.isInitialized = true;

    console.log('✅ AST Interactive Report initialized');
    console.log('📊 Modules:', Object.keys(this.reportData.packages || {}).length);
    console.log('ƒ Functions:', this.reportData.entityStats?.totalFunctions || 0);
    console.log('🔑 App instance available via: globalThis[Symbol.for("__AST_INTERACTIVE_APP_INSTANCE__")]');
    console.log('🔑 getApp() available:', typeof globalThis.getApp === 'function');
  }
  showPlaceholder() {
    const grid = document.getElementById('modulesGrid');
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
        <h3 style="color: #60a5fa; margin-bottom: 10px;">Нет данных для отображения</h3>
        <p style="font-size: 14px; max-width: 500px; margin: 0 auto;">
          Данные не загружены. Убедитесь, что файл package-lock-report.json существует.
        </p>
        <p style="font-size: 12px; margin-top: 10px; color: #64748b;">
          Файл должен находиться в той же директории, что и этот HTML.
        </p>
      </div>
    `;
    document.getElementById('d3GraphWrapper').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-size:16px;">
        📊 Нет данных для отображения графа
      </div>
    `;
  }

  updateStats() {
    if (!this.reportData) {
      return;
    }
    const stats = this.reportData.fileStats || {};
    const entityStats = this.reportData.entityStats || {};

    document.getElementById('statModules').textContent = stats.totalFiles || 0;
    document.getElementById('statFunctions').textContent = entityStats.totalFunctions || 0;
    document.getElementById('statCalls').textContent = entityStats.totalCalls || 0;
    document.getElementById('statExported').textContent = entityStats.totalExportedFunctions || 0;
    document.getElementById('statAsync').textContent = entityStats.totalAsyncFunctions || 0;
    document.getElementById('statLines').textContent = stats.totalLines || 0;
    document.getElementById('statSize').textContent = ((stats.totalSize || 0) / 1024).toFixed(2);
  }

  escapeHtml(str) {
    if (!str) {
      return '';
    }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeJs(str) {
    if (!str) {
      return '';
    }
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  renderModules() {
    const grid = document.getElementById('modulesGrid');
    grid.innerHTML = '';
    const moduleEntries = Object.entries(this.reportData.packages || {});
    moduleEntries.sort((a, b) => {
      const aEntry = a[1]?.isEntry ? 0 : 1;
      const bEntry = b[1]?.isEntry ? 0 : 1;
      return aEntry - bEntry;
    });

    for (const [modulePath, pkg] of moduleEntries) {
      if (!pkg) {
        continue;
      }
      const moduleCard = document.createElement('div');
      moduleCard.className = 'module-card';
      moduleCard.dataset.module = modulePath;
      moduleCard.onclick = () => this.focusModule(modulePath);

      const funcs = pkg.entities?.functions || [];
      const isEntry = pkg.isEntry || false;
      const displayName = pkg.displayPath || modulePath.split('/').pop() || modulePath;
      const language = pkg.language || 'javascript';
      const lines = pkg.fileStats?.lines || 0;

      let funcsHtml = '';
      for (const func of funcs) {
        if (!func || !func.name) {
          continue;
        }
        const funcName = this.escapeHtml(func.name);
        const modulePathEscaped = this.escapeHtml(modulePath);
        const paramsStr = (func.params || []).map(p => this.escapeHtml(p)).join(', ');
        const callsStr = (func.calls || [])
          .slice(0, 3)
          .map(c => this.escapeHtml(c))
          .join(', ');
        const isExported = func.isExported || false;
        const isAsync = func.isAsync || false;
        const lineNum = func.line || 0;

        const onclickAttr = `onclick="event.stopPropagation(); getApp()?.focusFunction(\`${this.escapeJs(func.name)}\`, \`${this.escapeJs(modulePath)}\`)"`;
        funcsHtml += `<div class="func-item" ${onclickAttr} data-func="${funcName}" data-module="${modulePathEscaped}">`;
        funcsHtml += `<span class="func-name">${funcName}</span>`;
        if (isExported) {
          funcsHtml += `<span class="func-export">📤</span>`;
        }
        if (isAsync) {
          funcsHtml += `<span class="func-async">⚡</span>`;
        }
        if (func.params && func.params.length > 0) {
          funcsHtml += `<span class="func-params">(${paramsStr})</span>`;
        }
        if (func.calls && func.calls.length > 0) {
          funcsHtml += `<span class="func-calls">→ ${callsStr}${func.calls.length > 3 ? '...' : ''}</span>`;
        }
        if (func.calledBy && func.calledBy.length > 0) {
          funcsHtml += `<span class="func-called">← ${func.calledBy.length}</span>`;
        }
        funcsHtml += `<span class="func-line">стр.${lineNum}</span>`;
        funcsHtml += `</div>`;
      }

      moduleCard.innerHTML = `
        <div class="header-row">
          <div>
            <div class="name">${isEntry ? '⭐ ' : ''}${this.escapeHtml(displayName)}</div>
            <div class="path">${this.escapeHtml(modulePath)}</div>
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
            <span class="badge lang">${this.escapeHtml(language)}</span>
            ${isEntry ? '<span class="badge export">⭐ entry</span>' : ''}
            <span class="badge lines">${lines} строк</span>
          </div>
        </div>
        <div class="badges">
          <span class="badge fn">${funcs.length} функций</span>
          ${pkg.entities?.classes?.length > 0 ? `<span class="badge class">${pkg.entities.classes.length} классов</span>` : ''}
          ${pkg.entities?.constants?.length > 0 ? `<span class="badge const">${pkg.entities.constants.length} констант</span>` : ''}
          ${pkg.entities?.interfaces?.length > 0 ? `<span class="badge interface">${pkg.entities.interfaces.length} интерфейсов</span>` : ''}
          ${pkg.entities?.types?.length > 0 ? `<span class="badge type">${pkg.entities.types.length} типов</span>` : ''}
          ${pkg.entities?.variables?.length > 0 ? `<span class="badge var">${pkg.entities.variables.length} переменных</span>` : ''}
        </div>
        <div class="functions-list">${funcsHtml}</div>
      `;
      grid.appendChild(moduleCard);
    }
  }

  initGraph() {
    const container = document.getElementById('d3GraphWrapper');
    const width = container.clientWidth || 900;
    const height = 700;
    container.innerHTML = `<div class="graph-tooltip" id="graphTooltip"><div class="tt-title" id="ttTitle"></div><div class="tt-info" id="ttInfo"></div><div class="tt-detail" id="ttDetail"></div></div>`;

    this.svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#0f172a')
      .style('border-radius', '8px')
      .style('display', 'block');

    this.g = this.svg.append('g');
    this.zoom = d3
      .zoom()
      .extent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([0.1, 4])
      .on('zoom', event => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);
    this.buildGraphData();
    this.renderGraph(width, height);

    window.addEventListener('resize', () => {
      const newWidth = container.clientWidth || 900;
      this.svg.attr('width', newWidth);
    });
  }

  buildGraphData() {
    // Собираем все модули
    const modules = new Map();
    for (const [modulePath, pkg] of Object.entries(this.reportData.packages || {})) {
      if (!pkg) {
        continue;
      }
      const isRoot = pkg.isEntry || false;
      const name = pkg.displayPath || modulePath.split('/').pop() || modulePath;
      const funcs = pkg.entities?.functions || [];
      modules.set(modulePath, {
        id: modulePath,
        name,
        fullName: modulePath,
        type: 'module',
        isRoot,
        level: 0,
        color: isRoot ? '#fbbf24' : '#60a5fa',
        size: isRoot ? 35 : 25,
        functions: funcs,
        pkg,
      });
    }

    // Строим граф для модулей (все связи)
    const allModuleEdges = [];
    const outwardDeps = this.reportData.dependencyGraph?.outwardDependencies || {};
    const inwardDeps = this.reportData.dependencyGraph?.inwardDependencies || {};

    // Собираем все ребра из outwardDependencies
    for (const [from, deps] of Object.entries(outwardDeps)) {
      if (!deps) {
        continue;
      }
      for (const to of deps) {
        if (modules.has(from) && modules.has(to)) {
          allModuleEdges.push({ source: from, target: to, type: 'import' });
        }
      }
    }

    // Строим граф для функций (вызовы)
    const functionNodes = [];
    const functionEdges = [];
    const functionMap = new Map();

    for (const [modulePath, pkg] of Object.entries(this.reportData.packages || {})) {
      if (!pkg) {
        continue;
      }
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (!func || !func.name) {
          continue;
        }
        const id = `${modulePath}#func:${func.name}`;
        const node = {
          id,
          name: func.name,
          fullName: func.name,
          type: 'function',
          module: modulePath,
          isExported: func.isExported || false,
          isAsync: func.isAsync || false,
          line: func.line || 0,
          color: func.isExported ? '#f87171' : '#fbbf24',
          size: 8,
          calls: func.calls || [],
          calledBy: func.calledBy || [],
          params: func.params || [],
          returnType: func.returnType || 'any',
        };
        functionMap.set(id, node);
        functionNodes.push(node);
      }
    }

    // Добавляем ребра вызовов между функциями
    for (const [fromId, node] of functionMap) {
      for (const call of node.calls) {
        const targetKey = `${node.module}#func:${call}`;
        if (functionMap.has(targetKey)) {
          functionEdges.push({ source: fromId, target: targetKey, type: 'call' });
        } else {
          // Ищем функцию с таким именем в других модулях
          for (const [otherId, otherNode] of functionMap) {
            if (otherNode.name === call && otherNode.module !== node.module) {
              functionEdges.push({ source: fromId, target: otherId, type: 'call' });
              break;
            }
          }
        }
      }
    }

    // Сохраняем все данные для фильтрации
    this._modules = modules;
    this._allModuleEdges = allModuleEdges;
    this._functionNodes = functionNodes;
    this._functionEdges = functionEdges;
    this._functionMap = functionMap;
    this._inwardDeps = inwardDeps;
    this._outwardDeps = outwardDeps;
  }

  renderGraph(width, height) {
    if (!this.g) {
      return;
    }
    this.g.selectAll('*').remove();

    const defs = this.g.append('defs');
    // Маленькая стрелка для рёбер
    defs
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 8 8')
      .attr('refX', 6)
      .attr('refY', 4)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 8 4 L 0 8 z')
      .attr('fill', '#3b82f6');

    defs
      .append('marker')
      .attr('id', 'arrow-call')
      .attr('viewBox', '0 0 8 8')
      .attr('refX', 6)
      .attr('refY', 4)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 8 4 L 0 8 z')
      .attr('fill', '#ef4444');

    // Определяем текущий режим
    const mode = this.currentMode;

    // Фильтруем узлы и рёбра в зависимости от режима
    let filteredNodes = [];
    let filteredLinks = [];

    // Узлы: всегда показываем модули и функции
    for (const [, mod] of this._modules) {
      filteredNodes.push({
        id: mod.id,
        name: mod.name,
        fullName: mod.fullName,
        type: 'module',
        isRoot: mod.isRoot,
        color: mod.color,
        size: mod.size,
        functions: mod.functions,
        pkg: mod.pkg,
        module: mod.id,
      });
    }
    for (const node of this._functionNodes) {
      filteredNodes.push({ ...node });
    }

    // Фильтруем рёбра модулей
    const moduleEdges = [];
    if (mode === 'all' || mode === 'outward' || mode === 'both') {
      // Исходящие
      for (const [from, deps] of Object.entries(this._outwardDeps)) {
        if (!deps) {
          continue;
        }
        for (const to of deps) {
          if (this._modules.has(from) && this._modules.has(to)) {
            moduleEdges.push({ source: from, target: to, type: 'import', isOutward: true });
          }
        }
      }
    }
    if (mode === 'all' || mode === 'inward' || mode === 'both') {
      // Входящие
      for (const [to, deps] of Object.entries(this._inwardDeps)) {
        if (!deps) {
          continue;
        }
        for (const from of deps) {
          if (this._modules.has(from) && this._modules.has(to)) {
            // Проверяем, не добавлено ли уже это ребро
            const exists = moduleEdges.some(e => e.source === from && e.target === to);
            if (!exists) {
              moduleEdges.push({ source: from, target: to, type: 'import', isInward: true });
            }
          }
        }
      }
    }

    // Функциональные ребра (вызовы) - показываем всегда
    const callEdges = this._functionEdges.map(e => ({ ...e, isCall: true }));

    // Объединяем рёбра
    filteredLinks = [...moduleEdges, ...callEdges];

    // Поиск
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    if (searchQuery) {
      const matched = new Set();
      for (const node of filteredNodes) {
        if (
          node.name.toLowerCase().includes(searchQuery) ||
          node.fullName?.toLowerCase().includes(searchQuery)
        ) {
          matched.add(node.id);
        }
      }
      const expanded = new Set(matched);
      for (const link of filteredLinks) {
        if (matched.has(link.source)) {
          expanded.add(link.target);
        }
        if (matched.has(link.target)) {
          expanded.add(link.source);
        }
      }
      filteredNodes = filteredNodes.filter(n => expanded.has(n.id));
      filteredLinks = filteredLinks.filter(l => expanded.has(l.source) && expanded.has(l.target));
    }

    // Фокус
    if (this.currentFocusModule) {
      const related = new Set([this.currentFocusModule]);
      for (const link of filteredLinks) {
        if (link.source === this.currentFocusModule) {
          related.add(link.target);
        }
        if (link.target === this.currentFocusModule) {
          related.add(link.source);
        }
      }
      filteredNodes = filteredNodes.filter(n => related.has(n.id));
      filteredLinks = filteredLinks.filter(l => related.has(l.source) && related.has(l.target));
    }

    if (this.currentFocusFunction) {
      const related = new Set([this.currentFocusFunction]);
      let focusModule = '';
      for (const node of filteredNodes) {
        if (node.id === this.currentFocusFunction) {
          focusModule = node.module || '';
          break;
        }
      }
      if (focusModule) {
        related.add(focusModule);
      }
      for (const link of filteredLinks) {
        if (link.source === this.currentFocusFunction) {
          related.add(link.target);
        }
        if (link.target === this.currentFocusFunction) {
          related.add(link.source);
        }
      }
      filteredNodes = filteredNodes.filter(n => related.has(n.id));
      filteredLinks = filteredLinks.filter(l => related.has(l.source) && related.has(l.target));
    }

    // Рисуем рёбра
    const link = this.g
      .append('g')
      .selectAll('line')
      .data(filteredLinks)
      .enter()
      .append('line')
      .attr('stroke', d => (d.isCall ? '#ef4444' : '#3b82f6'))
      .attr('stroke-width', d => (d.isCall ? 1.2 : 1))
      .attr('stroke-opacity', d => (d.isCall ? 0.7 : 0.4))
      .attr('stroke-dasharray', d => (d.isCall ? 'none' : 'none'))
      .attr('marker-end', d => (d.isCall ? 'url(#arrow-call)' : 'url(#arrow)'));

    // Рисуем узлы
    const nodeGroup = this.g
      .append('g')
      .selectAll('g')
      .data(filteredNodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.type === 'function') {
          this.showDetail(d);
        } else if (d.type === 'module') {
          this.focusModule(d.id);
        }
      })
      .on('mouseover', (event, d) => {
        this.showTooltip(event, d);
      })
      .on('mouseout', () => {
        this.hideTooltip();
      })
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) {
              this.simulation.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) {
              this.simulation.alphaTarget(0);
            }
            d.fx = null;
            d.fy = null;
          }));

    nodeGroup
      .append('circle')
      .attr('r', d => d.size || 10)
      .attr('fill', d => {
        if (this.currentFocusFunction && d.id === this.currentFocusFunction) {
          return '#22d3ee';
        }
        if (this.currentFocusModule && d.id === this.currentFocusModule) {
          return '#22d3ee';
        }
        return d.color || '#94a3b8';
      })
      .attr('stroke', d => {
        if (d.isRoot) {
          return '#fbbf24';
        }
        if (this.currentFocusFunction && d.id === this.currentFocusFunction) {
          return '#22d3ee';
        }
        if (this.currentFocusModule && d.id === this.currentFocusModule) {
          return '#22d3ee';
        }
        return '#1e293b';
      })
      .attr('stroke-width', d => d.isRoot || d.id === this.currentFocusFunction || d.id === this.currentFocusModule ? 3 : 1.5)
      .attr('opacity', 1);

    nodeGroup
      .append('text')
      .attr('dx', d => (d.size || 10) + 8)
      .attr('dy', 4)
      .attr('font-size', d => (d.type === 'function' ? '8px' : '11px'))
      .attr('fill', '#e2e8f0')
      .attr('font-family', 'monospace')
      .text(d => {
        if (d.isRoot) {
          return '⭐ ' + d.name;
        }
        if (d.type === 'function' && d.isExported) {
          return '📤 ' + d.name;
        }
        return d.name;
      })
      .style('pointer-events', 'none')
      .attr('opacity', 1);

    if (!this.currentFocusFunction) {
      nodeGroup
        .filter(d => d.type === 'module' && d.functions && d.functions.length > 0)
        .append('text')
        .attr('dx', d => (d.size || 10) + 8)
        .attr('dy', 16)
        .attr('font-size', '7px')
        .attr('fill', '#94a3b8')
        .attr('font-family', 'monospace')
        .text(d => d.functions.length + ' функций')
        .style('pointer-events', 'none');
    }

    const sim = d3
      .forceSimulation(filteredNodes)
      .force('link', d3.forceLink(filteredLinks).id(d => d.id).distance(d => (d.isCall ? 80 : 120)))
      .force('charge', d3.forceManyBody().strength(d => (d.type === 'module' ? -300 : -100)))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => (d.size || 10) + 10));

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')');
    });

    this.simulation = sim;
  }

  showTooltip(event, d) {
    const tooltip = document.getElementById('graphTooltip');
    document.getElementById('ttTitle').textContent = d.name;
    document.getElementById('ttInfo').textContent =
      d.type === 'module' ? 'Модуль: ' + d.fullName : 'Тип: функция' + (d.isExported ? ' 📤' : '');
    let detail = '';
    if (d.type === 'function') {
      detail += 'Параметры: ' + (d.params || []).join(', ') || 'нет\n';
      detail += 'Возврат: ' + (d.returnType || 'any') + '\n';
      detail += 'Строка: ' + (d.line || 0) + '\n';
      detail += 'Вызовов: ' + (d.calls || []).length + '\n';
      detail += 'Кем вызвана: ' + (d.calledBy || []).length;
    } else {
      detail += 'Функций: ' + (d.functions || []).length + '\n';
      if (d.pkg) {
        detail += 'Экспортов: ' + (d.pkg.exports ? Object.keys(d.pkg.exports).length : 0);
      }
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

  hideTooltip() {
    document.getElementById('graphTooltip').style.display = 'none';
  }

  setMode(mode) {
    this.currentMode = mode;
    document
      .querySelectorAll('[data-mode]')
      .forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    this.updateView();
  }

  focusModule(modulePath) {
    if (this.currentFocusModule === modulePath) {
      this.clearFocus();
      return;
    }
    this.currentFocusModule = modulePath;
    this.currentFocusFunction = null;
    this.updateView();

    document
      .querySelectorAll('.module-card')
      .forEach(c => c.classList.toggle('active', c.dataset.module === modulePath));

    const info = document.getElementById('focusInfo');
    info.classList.add('active');
    const pkg = this.reportData.packages[modulePath];
    const displayName = pkg?.displayPath || modulePath.split('/').pop() || modulePath;
    document.getElementById('focusTitle').textContent = '🎯 Фокус: ' + displayName;
    if (pkg) {
      const funcs = pkg.entities?.functions || [];
      document.getElementById('focusDetails').textContent =
        'Функций: ' +
        funcs.length +
        ' | Экспортов: ' +
        (pkg.exports ? Object.keys(pkg.exports).length : 0);
    }

    const card = document.querySelector(`.module-card[data-module="${modulePath}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  focusFunction(funcName, modulePath) {
    if (this.currentFocusFunction === funcName && this.currentFocusModule === modulePath) {
      this.clearFocus();
      return;
    }
    this.currentFocusFunction = funcName;
    this.currentFocusModule = modulePath;
    this.updateView();

    document
      .querySelectorAll('.module-card')
      .forEach(c => c.classList.toggle('active', c.dataset.module === modulePath));
    document.querySelectorAll('.func-item').forEach(el => {
      el.classList.toggle('active',el.dataset.func === funcName && el.dataset.module === modulePath);
    });

    const info = document.getElementById('focusInfo');
    info.classList.add('active');
    document.getElementById('focusTitle').textContent = '🎯 Функция: ' + funcName;

    let funcData = null;
    for (const node of this.graphNodes) {
      if (node.type === 'function' && node.name === funcName && node.module === modulePath) {
        funcData = node;
        break;
      }
    }
    if (funcData) {
      const displayName = modulePath.split('/').pop() || modulePath;
      document.getElementById('focusDetails').textContent =
        'Модуль: ' + displayName + ' | Параметры: ' + (funcData.params || []).join(', ') ||
        'нет' +
          ' | Вызовов: ' +
          (funcData.calls || []).length +
          ' | Кем вызвана: ' +
          (funcData.calledBy || []).length;
    }
    this.showDetail(funcData || { name: funcName, module: modulePath });

    const el = document.querySelector(`.func-item[data-func="${funcName}"][data-module="${modulePath}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  clearFocus() {
    this.currentFocusModule = null;
    this.currentFocusFunction = null;
    document.getElementById('focusInfo').classList.remove('active');
    document.querySelectorAll('.module-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.func-item').forEach(el => el.classList.remove('active'));
    this.closeDetail();
    this.updateView();
  }

  updateView() {
    const container = document.getElementById('d3GraphWrapper');
    const width = container.clientWidth || 900;
    const height = 700;
    // Перестраиваем данные перед рендерингом
    this.buildGraphData();
    this.renderGraph(width, height);
  }

  showDetail(data) {
    const panel = document.getElementById('detailPanel');
    document.getElementById('dpTitle').textContent = data.name || 'Функция';
    let html = '';
    html += '<div class="dp-section"><h4>Информация</h4>';
    html +=
      '<div class="item"><span class="label">Модуль:</span> ' +
      (data.module || 'неизвестен') +
      '</div>';
    html += '<div class="item"><span class="label">Строка:</span> ' + (data.line || 0) + '</div>';
    html +=
      '<div class="item"><span class="label">Экспортирована:</span> ' +
      (data.isExported ? '✅' : '❌') +
      '</div>';
    html +=
      '<div class="item"><span class="label">Асинхронная:</span> ' +
      (data.isAsync ? '✅' : '❌') +
      '</div>';
    html +=
      '<div class="item"><span class="label">Возврат:</span> ' +
      (data.returnType || 'any') +
      '</div>';
    html += '</div>';

    const params = data.params || [];
    if (params.length > 0) {
      html += '<div class="dp-section"><h4>Параметры</h4>';
      for (const p of params) {
        html += '<div class="item">' + this.escapeHtml(p) + '</div>';
      }
      html += '</div>';
    }

    const calls = data.calls || [];
    if (calls.length > 0) {
      html += '<div class="dp-section"><h4>📞 Вызовы (кто вызывается)</h4>';
      for (const call of calls) {
        html += `<div class="item" style="cursor:pointer;color:#f59e0b;" onclick="getApp()?.focusFunction('${this.escapeJs(call)}', '${this.escapeJs(data.module || '')}')">→ ${this.escapeHtml(call)}</div>`;
      }
      html += '</div>';
    }

    const calledBy = data.calledBy || [];
    if (calledBy.length > 0) {
      html += '<div class="dp-section"><h4>📥 Кто вызывает</h4>';
      for (const caller of calledBy) {
        html += `<div class="item" style="cursor:pointer;color:#3b82f6;" onclick="getApp()?.focusFunction('${this.escapeJs(caller)}', '${this.escapeJs(data.module || '')}')">← ${this.escapeHtml(caller)}</div>`;
      }
      html += '</div>';
    }

    if (data.body) {
      const bodyPreview = data.body.length > 200 ? data.body.substring(0, 200) + '...' : data.body;
      html += '<div class="dp-section"><h4>Тело (сокращённо)</h4>';
      html += `<div class="item" style="font-size:10px;color:#94a3b8;white-space:pre-wrap;background:#0f172a;padding:8px;border-radius:4px;">${this.escapeHtml(bodyPreview)}</div>`;
      html += '</div>';
    }

    document.getElementById('dpContent').innerHTML = html;
    panel.classList.add('active');
  }

  closeDetail() {
    document.getElementById('detailPanel').classList.remove('active');
  }

  handleSearch(query) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.updateView();
    }, 300);
  }

  setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.clearFocus();
        this.closeDetail();
      }
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }
    });
    document.addEventListener('click', e => {
      const panel = document.getElementById('detailPanel');
      if (
        panel.classList.contains('active') &&
        !panel.contains(e.target) &&
        !e.target.closest('.func-item')
      ) {
        this.closeDetail();
      }
    });
  }
}

// ============================================================
// ЗАПУСК
// ============================================================

if (!globalThis.getApp) {
  globalThis.getApp = getApp;
}

const app = new App();

console.log('🚀 AST Interactive Report loaded');
console.log(`📊 Data available: ${!!globalThis[SYM_REPORT_DATA]}`);
console.log(`ƒ Functions data available: ${globalThis[SYM_FUNCTIONS_DATA]?.length || 0}`);
console.log(`🔑 App instance: ${globalThis[SYM_APP_INSTANCE] ? '✅' : '❌'}`);
console.log(`🔑 getApp() available: ${typeof globalThis.getApp === 'function' ? '✅' : '❌'}`);
