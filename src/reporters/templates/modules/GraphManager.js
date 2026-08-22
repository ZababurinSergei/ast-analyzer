// packages/ast-analyzer/src/reporters/templates/modules/GraphManager.js

import 'd3';
const d3 = window.d3;

/**
 * GraphManager - управление графом зависимостей на D3
 * Отвечает за построение, обновление и интерактивность графа
 */
export class GraphManager {
  constructor(app) {
    this.app = app;
    this.svg = null;
    this.g = null;
    this.zoom = null;
    this.simulation = null;
    this.graphNodes = [];
    this.graphLinks = [];
    this.nodeMap = new Map();
    this.searchTimeout = null;
    this._modules = new Map();
    this._allModuleEdges = [];
    this._functionNodes = [];
    this._functionEdges = [];
    this._functionMap = new Map();
    this._inwardDeps = {};
    this._outwardDeps = {};

    // ✅ ХРАНИМ ССЫЛКУ НА ГЛОБАЛЬНЫЙ API
    this._api = null;
    this._methodsBound = false;

    console.log('📊 GraphManager created');
  }

  /**
   * Инициализация менеджера графа
   */
  init() {
    console.log('🔄 GraphManager.init() called');

    // ✅ ПОЛУЧАЕМ ГОТОВЫЙ ГЛОБАЛЬНЫЙ API
    this._api = window[Symbol.for('__AST_APP_API__')];
    console.log('📡 GraphManager API получен:', this._api ? '✅' : '❌');

    // Если API уже готов - сразу привязываем методы
    if (this._api && typeof this._api.focusFunction === 'function') {
      console.log('✅ API готов в GraphManager');
      this._bindMethods();
      this.buildGraphData();
      this.initGraph();
      return;
    }

    // Если API еще не готов, ждем его
    console.log('⏳ Ожидание API в GraphManager...');
    let attempts = 0;
    const maxAttempts = 30;

    const checkApi = setInterval(() => {
      attempts++;
      this._api = window[Symbol.for('__AST_APP_API__')];

      if (this._api && typeof this._api.focusFunction === 'function') {
        clearInterval(checkApi);
        console.log(`✅ API получен в GraphManager после ${attempts} попыток`);
        this._bindMethods();
        this.buildGraphData();
        this.initGraph();
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkApi);
        console.warn('⚠️ API не получен в GraphManager, использую fallback');
        this._api = {
          focusModule: () => console.warn('⚠️ focusModule fallback'),
          focusFunction: () => console.warn('⚠️ focusFunction fallback'),
          clearFocus: () => console.warn('⚠️ clearFocus fallback'),
          closeDetail: () => console.warn('⚠️ closeDetail fallback'),
          renderModules: () => console.warn('⚠️ renderModules fallback'),
        };
        this._bindMethods();
        this.buildGraphData();
        this.initGraph();
      }
    }, 100);
  }

  /**
   * ✅ СВЯЗЫВАНИЕ МЕТОДОВ С ГОТОВЫМ API
   */
  _bindMethods() {
    console.log('🔄 GraphManager._bindMethods() called');

    // Используем готовый глобальный API
    const api = this._api || window[Symbol.for('__AST_APP_API__')];

    this._focusFunction = (name, module) => {
      if (api && typeof api.focusFunction === 'function') {
        console.log('🎯 GraphManager: focusFunction called', name, module);
        return api.focusFunction(name, module);
      }
      console.warn('⚠️ focusFunction not available in GraphManager');
    };

    this._focusModule = path => {
      if (api && typeof api.focusModule === 'function') {
        console.log('🎯 GraphManager: focusModule called', path);
        return api.focusModule(path);
      }
      console.warn('⚠️ focusModule not available in GraphManager');
    };

    this._clearFocus = () => {
      if (api && typeof api.clearFocus === 'function') {
        console.log('🧹 GraphManager: clearFocus called');
        return api.clearFocus();
      }
      console.warn('⚠️ clearFocus not available in GraphManager');
    };

    this._closeDetail = () => {
      if (api && typeof api.closeDetail === 'function') {
        return api.closeDetail();
      }
      console.warn('⚠️ closeDetail not available in GraphManager');
    };

    this._renderModules = () => {
      if (api && typeof api.renderModules === 'function') {
        return api.renderModules();
      }
      console.warn('⚠️ renderModules not available in GraphManager');
    };

    this._methodsBound = true;
  }

  /**
   * Инициализация D3 графа
   */
  initGraph() {
    console.log('🔄 GraphManager.initGraph() called');

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

    this.renderGraph(width, height);

    window.addEventListener('resize', () => {
      const newWidth = container.clientWidth || 900;
      this.svg.attr('width', newWidth);
    });
  }

  /**
   * Строит данные для графа из отчета
   */
  buildGraphData() {
    console.log('🔄 GraphManager.buildGraphData() called');

    const modules = new Map();
    for (const [modulePath, pkg] of Object.entries(this.app.reportData.packages || {})) {
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

    const allModuleEdges = [];
    const outwardDeps = this.app.reportData.dependencyGraph?.outwardDependencies || {};
    const inwardDeps = this.app.reportData.dependencyGraph?.inwardDependencies || {};

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

    const functionNodes = [];
    const functionEdges = [];
    const functionMap = new Map();

    for (const [modulePath, pkg] of Object.entries(this.app.reportData.packages || {})) {
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

    for (const [fromId, node] of functionMap) {
      for (const call of node.calls) {
        const targetKey = `${node.module}#func:${call}`;
        if (functionMap.has(targetKey)) {
          functionEdges.push({ source: fromId, target: targetKey, type: 'call' });
        } else {
          for (const [otherId, otherNode] of functionMap) {
            if (otherNode.name === call && otherNode.module !== node.module) {
              functionEdges.push({ source: fromId, target: otherId, type: 'call' });
              break;
            }
          }
        }
      }
    }

    this._modules = modules;
    this._allModuleEdges = allModuleEdges;
    this._functionNodes = functionNodes;
    this._functionEdges = functionEdges;
    this._functionMap = functionMap;
    this._inwardDeps = inwardDeps;
    this._outwardDeps = outwardDeps;
  }

  /**
   * Рендерит граф с текущими данными
   * @param {number} width - Ширина контейнера
   * @param {number} height - Высота контейнера
   */
  renderGraph(width, height) {
    if (!this.g) {
      return;
    }
    this.g.selectAll('*').remove();

    const defs = this.g.append('defs');

    defs
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#3b82f6');

    defs
      .append('marker')
      .attr('id', 'arrow-call')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#ef4444');

    const mode = this.app.graphModeManager?.getMode() || 'all';
    const focusModule = this.app.cardManager?.getFocusModule();
    const focusFunction = this.app.cardManager?.getFocusFunction();

    let filteredNodes = [];
    let filteredLinks = [];

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

    const moduleEdges = [];
    if (mode === 'all' || mode === 'outward' || mode === 'both') {
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
      for (const [to, deps] of Object.entries(this._inwardDeps)) {
        if (!deps) {
          continue;
        }
        for (const from of deps) {
          if (this._modules.has(from) && this._modules.has(to)) {
            const exists = moduleEdges.some(e => e.source === from && e.target === to);
            if (!exists) {
              moduleEdges.push({ source: from, target: to, type: 'import', isInward: true });
            }
          }
        }
      }
    }

    const callEdges = this._functionEdges.map(e => ({ ...e, isCall: true }));
    filteredLinks = [...moduleEdges, ...callEdges];

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

    if (focusModule) {
      const related = new Set([focusModule]);
      for (const link of filteredLinks) {
        if (link.source === focusModule) {
          related.add(link.target);
        }
        if (link.target === focusModule) {
          related.add(link.source);
        }
      }
      filteredNodes = filteredNodes.filter(n => related.has(n.id));
      filteredLinks = filteredLinks.filter(l => related.has(l.source) && related.has(l.target));
    }

    if (focusFunction) {
      const related = new Set([focusFunction]);
      let focusMod = '';
      for (const node of filteredNodes) {
        if (node.id === focusFunction) {
          focusMod = node.module || '';
          break;
        }
      }
      if (focusMod) {
        related.add(focusMod);
      }
      for (const link of filteredLinks) {
        if (link.source === focusFunction) {
          related.add(link.target);
        }
        if (link.target === focusFunction) {
          related.add(link.source);
        }
      }
      filteredNodes = filteredNodes.filter(n => related.has(n.id));
      filteredLinks = filteredLinks.filter(l => related.has(l.source) && related.has(l.target));
    }

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

    const nodeGroup = this.g
      .append('g')
      .selectAll('g')
      .data(filteredNodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        // ✅ ИСПОЛЬЗУЕМ БЕЗОПАСНЫЕ МЕТОДЫ
        if (d.type === 'function') {
          this._focusFunction(d.name, d.module);
        } else if (d.type === 'module') {
          this._focusModule(d.id);
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
          })
      );

    nodeGroup
      .append('circle')
      .attr('r', d => d.size || 10)
      .attr('fill', d => {
        if (focusFunction && d.id === focusFunction) {
          return '#22d3ee';
        }
        if (focusModule && d.id === focusModule) {
          return '#22d3ee';
        }
        return d.color || '#94a3b8';
      })
      .attr('stroke', d => {
        if (d.isRoot) {
          return '#fbbf24';
        }
        if (focusFunction && d.id === focusFunction) {
          return '#22d3ee';
        }
        if (focusModule && d.id === focusModule) {
          return '#22d3ee';
        }
        return '#1e293b';
      })
      .attr('stroke-width', d => {
        if (d.isRoot || d.id === focusFunction || d.id === focusModule) {
          return 3;
        }
        return 1.5;
      })
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

    if (!focusFunction) {
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
      .force(
        'link',
        d3
          .forceLink(filteredLinks)
          .id(d => d.id)
          .distance(d => (d.isCall ? 80 : 120))
      )
      .force(
        'charge',
        d3.forceManyBody().strength(d => (d.type === 'module' ? -300 : -100))
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide().radius(d => (d.size || 10) + 10)
      );

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')');
    });

    this.simulation = sim;
    this.graphNodes = filteredNodes;
    this.graphLinks = filteredLinks;
  }

  /**
   * Показывает подсказку при наведении на узел
   * @param {Event} event - Событие мыши
   * @param {Object} d - Данные узла
   */
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

  /**
   * Скрывает подсказку
   */
  hideTooltip() {
    document.getElementById('graphTooltip').style.display = 'none';
  }

  /**
   * Обновляет представление графа
   */
  updateView() {
    const container = document.getElementById('d3GraphWrapper');
    const width = container.clientWidth || 900;
    const height = 700;
    this.buildGraphData();
    this.renderGraph(width, height);
  }

  /**
   * Обрабатывает поиск по графу
   * @param {string} query - Поисковый запрос
   */
  handleSearch(query) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.updateView();
    }, 300);
  }

  /**
   * Возвращает узлы графа
   * @returns {Array}
   */
  getGraphNodes() {
    return this.graphNodes;
  }

  /**
   * Возвращает ребра графа
   * @returns {Array}
   */
  getGraphLinks() {
    return this.graphLinks;
  }

  /**
   * Возвращает симуляцию D3
   * @returns {Object}
   */
  getSimulation() {
    return this.simulation;
  }
}
