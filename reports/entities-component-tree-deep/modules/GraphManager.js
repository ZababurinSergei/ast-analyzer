// packages/ast-analyzer/src/reporters/templates/modules/GraphManager.js

import 'd3';
const d3 = window.d3;

/**
 * GraphManager - управление графом зависимостей на D3
 * Отвечает за построение, обновление и интерактивность графа
 *
 * Режимы отображения:
 * - all: показать все связи
 * - inward: показать только входящие связи
 * - outward: показать только исходящие связи
 * - both: показать и входящие, и исходящие связи
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

    // Храним ссылку на глобальный API
    this._api = null;
    this._methodsBound = false;
    this._isInitialized = false;
    this._pendingUpdate = null;

    console.log('📊 GraphManager created');
  }

  /**
   * Инициализация менеджера графа
   */
  init() {
    console.log('🔄 GraphManager.init() called');

    // Получаем готовый глобальный API
    this._api = window[Symbol.for('__AST_APP_API__')];
    console.log('📡 GraphManager API получен:', this._api ? '✅' : '❌');

    // Если API уже готов - сразу привязываем методы
    if (this._api && typeof this._api.focusFunction === 'function') {
      console.log('✅ API готов в GraphManager');
      this._bindMethods();
      this.buildGraphData();
      this.initGraph();
      this._isInitialized = true;
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
        this._isInitialized = true;

        // Выполняем отложенное обновление если было
        if (this._pendingUpdate) {
          this.updateGraphWithFocus(
            this._pendingUpdate.focusModule,
            this._pendingUpdate.focusFunction,
            this._pendingUpdate.mode
          );
          this._pendingUpdate = null;
        }
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
        this._isInitialized = true;
      }
    }, 100);
  }

  /**
   * Связывание методов с готовым API
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
      // Fallback: пытаемся найти функцию в данных
      this._fallbackFocusFunction(name, module);
    };

    this._focusModule = path => {
      if (api && typeof api.focusModule === 'function') {
        console.log('🎯 GraphManager: focusModule called', path);
        return api.focusModule(path);
      }
      console.warn('⚠️ focusModule not available in GraphManager');
      // Fallback: подсветка в графе
      this._fallbackFocusModule(path);
    };

    this._clearFocus = () => {
      if (api && typeof api.clearFocus === 'function') {
        console.log('🧹 GraphManager: clearFocus called');
        return api.clearFocus();
      }
      console.warn('⚠️ clearFocus not available in GraphManager');
      this._fallbackClearFocus();
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
   * Fallback для фокуса на функции (без API)
   */
  _fallbackFocusFunction(name, module) {
    console.log('🔍 Fallback: focus on function', name, module);
    // Обновляем граф с подсветкой этой функции
    this.updateGraphWithFocus(module, this._findFunctionId(name, module), 'both');
  }

  /**
   * Fallback для фокуса на модуле (без API)
   */
  _fallbackFocusModule(path) {
    console.log('🔍 Fallback: focus on module', path);
    this.updateGraphWithFocus(path, null, 'both');
  }

  /**
   * Fallback для снятия фокуса (без API)
   */
  _fallbackClearFocus() {
    console.log('🔍 Fallback: clear focus');
    this.updateGraphWithFocus(null, null, 'all');
  }

  /**
   * Находит ID функции по имени и модулю
   */
  _findFunctionId(name, module) {
    for (const [id, node] of this._functionMap) {
      if (node.name === name && node.module === module) {
        return id;
      }
    }
    // Если не найдено, ищем по имени без модуля
    for (const [id, node] of this._functionMap) {
      if (node.name === name) {
        return id;
      }
    }
    return null;
  }

  /**
   * Инициализация D3 графа
   */
  initGraph() {
    console.log('🔄 GraphManager.initGraph() called');

    const container = document.getElementById('d3GraphWrapper');
    if (!container) {
      console.warn('⚠️ d3GraphWrapper container not found');
      return;
    }

    const width = container.clientWidth || 900;
    const height = 700;

    // Очищаем контейнер и добавляем tooltip
    container.innerHTML = `
      <div class="graph-tooltip" id="graphTooltip">
        <div class="tt-title" id="ttTitle"></div>
        <div class="tt-info" id="ttInfo"></div>
        <div class="tt-detail" id="ttDetail"></div>
      </div>
    `;

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
        if (this.g) {
          this.g.attr('transform', event.transform);
        }
      });

    this.svg.call(this.zoom);

    this.renderGraph(width, height);

    window.addEventListener('resize', () => {
      if (container) {
        const newWidth = container.clientWidth || 900;
        if (this.svg) {
          this.svg.attr('width', newWidth);
        }
      }
    });
  }

  /**
   * Строит данные для графа из отчета
   */
  buildGraphData() {
    console.log('🔄 GraphManager.buildGraphData() called');

    const modules = new Map();
    const packages = this.app.reportData?.packages || {};

    for (const [modulePath, pkg] of Object.entries(packages)) {
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
    const outwardDeps = this.app.reportData?.dependencyGraph?.outwardDependencies || {};
    const inwardDeps = this.app.reportData?.dependencyGraph?.inwardDependencies || {};

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

    for (const [modulePath, pkg] of Object.entries(packages)) {
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

    console.log(`📊 Built graph: ${modules.size} modules, ${functionNodes.length} functions`);
  }

  /**
   * Рендерит граф с текущими данными
   */
  renderGraph(width, height) {
    if (!this.g) {
      console.warn('⚠️ Graph group not initialized');
      return;
    }

    try {
      this.g.selectAll('*').remove();
    } catch (e) {
      console.warn('⚠️ Failed to clear graph:', e);
      return;
    }

    // Если нет узлов, показываем сообщение
    if (this._modules.size === 0 && this._functionNodes.length === 0) {
      this.showEmptyState();
      return;
    }

    const defs = this.g.append('defs');

    // Стрелка для обычных связей
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

    // Стрелка для вызовов функций
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

    // Стрелка для подсвеченных связей
    defs
      .append('marker')
      .attr('id', 'arrow-highlight')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#f59e0b');

    // Стрелка для активной функции
    defs
      .append('marker')
      .attr('id', 'arrow-active')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 12)
      .attr('markerHeight', 12)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#22d3ee');

    // Подготавливаем данные для рендеринга
    const mode = this.app?.graphModeManager?.getMode?.() || 'all';
    const focusModule = this.app?.cardManager?.getFocusModule?.();
    const focusFunction = this.app?.cardManager?.getFocusFunction?.();

    let filteredNodes = [];
    let filteredLinks = [];

    // Добавляем модули
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

    // Добавляем функции
    for (const node of this._functionNodes) {
      filteredNodes.push({ ...node });
    }

    // Строим связи модулей
    const moduleEdges = [];
    if (mode === 'all' || mode === 'outward' || mode === 'both') {
      for (const [from, deps] of Object.entries(this._outwardDeps)) {
        if (!deps) continue;
        for (const to of deps) {
          if (this._modules.has(from) && this._modules.has(to)) {
            moduleEdges.push({ source: from, target: to, type: 'import', isOutward: true });
          }
        }
      }
    }
    if (mode === 'all' || mode === 'inward' || mode === 'both') {
      for (const [to, deps] of Object.entries(this._inwardDeps)) {
        if (!deps) continue;
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

    // Поиск
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput?.value?.toLowerCase()?.trim() || '';

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

    // Фильтрация по фокусу на модуле
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

    // Фильтрация по фокусу на функции
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

    // Если нет узлов после фильтрации, показываем сообщение
    if (filteredNodes.length === 0) {
      this.showEmptyState('Ничего не найдено');
      return;
    }

    // Определяем, какие узлы и связи подсвечивать
    const highlightNodes = new Set();
    const highlightLinks = new Set();

    if (focusFunction) {
      // Подсвечиваем активную функцию и её связи
      highlightNodes.add(focusFunction);
      for (const link of filteredLinks) {
        if (link.source === focusFunction || link.target === focusFunction) {
          highlightNodes.add(link.source);
          highlightNodes.add(link.target);
          highlightLinks.add(`${link.source}->${link.target}`);
        }
      }
    } else if (focusModule) {
      // Подсвечиваем активный модуль и его связи
      highlightNodes.add(focusModule);
      for (const link of filteredLinks) {
        if (link.source === focusModule || link.target === focusModule) {
          highlightNodes.add(link.source);
          highlightNodes.add(link.target);
          highlightLinks.add(`${link.source}->${link.target}`);
        }
      }
      // Добавляем все функции модуля
      for (const node of filteredNodes) {
        if (node.module === focusModule && node.type === 'function') {
          highlightNodes.add(node.id);
        }
      }
    }

    try {
      // Рендерим связи
      const link = this.g
        .append('g')
        .selectAll('line')
        .data(filteredLinks)
        .enter()
        .append('line')
        .attr('stroke', d => {
          const key = `${d.source}->${d.target}`;
          if (highlightLinks.has(key)) {
            return '#f59e0b'; // Подсвеченная связь
          }
          if (d.isCall) {
            return '#ef4444'; // Вызов функции
          }
          return '#3b82f6'; // Обычная связь
        })
        .attr('stroke-width', d => {
          const key = `${d.source}->${d.target}`;
          if (highlightLinks.has(key)) {
            return 2.5;
          }
          if (d.isCall) {
            return 1.5;
          }
          return 1;
        })
        .attr('stroke-opacity', d => {
          const key = `${d.source}->${d.target}`;
          if (highlightLinks.has(key)) {
            return 1;
          }
          if (highlightNodes.size > 0) {
            return 0.15; // Затемняем фоновые связи
          }
          return 0.5;
        })
        .attr('stroke-dasharray', d => {
          const key = `${d.source}->${d.target}`;
          if (highlightLinks.has(key) && d.isCall) {
            return 'none';
          }
          if (d.isCall) {
            return '4,4';
          }
          return 'none';
        })
        .attr('marker-end', d => {
          const key = `${d.source}->${d.target}`;
          if (highlightLinks.has(key)) {
            return 'url(#arrow-highlight)';
          }
          if (d.isCall) {
            return 'url(#arrow-call)';
          }
          return 'url(#arrow)';
        });

      // Рендерим узлы
      const nodeGroup = this.g
        .append('g')
        .selectAll('g')
        .data(filteredNodes)
        .enter()
        .append('g')
        .attr('cursor', 'pointer')
        .attr('class', d => {
          let cls = 'graph-node';
          if (highlightNodes.has(d.id)) cls += ' highlighted';
          if (d.id === focusFunction || d.id === focusModule) cls += ' active';
          return cls;
        })
        .on('click', (event, d) => {
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
              if (!event.active && this.simulation) {
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
              if (!event.active && this.simulation) {
                this.simulation.alphaTarget(0);
              }
              d.fx = null;
              d.fy = null;
            })
        );

      // Рисуем круги
      nodeGroup
        .append('circle')
        .attr('r', d => {
          if (highlightNodes.has(d.id)) {
            return (d.size || 15) * 1.2;
          }
          if (d.type === 'module') {
            return d.size || 15;
          }
          return d.size || 10;
        })
        .attr('fill', d => {
          if (d.id === focusFunction || d.id === focusModule) {
            return '#22d3ee'; // Активный элемент
          }
          if (highlightNodes.has(d.id)) {
            return d.color || '#60a5fa'; // Подсвеченный элемент
          }
          if (highlightNodes.size > 0) {
            return '#1e293b'; // Затемненный фоновый элемент
          }
          return d.color || '#94a3b8';
        })
        .attr('stroke', d => {
          if (d.id === focusFunction || d.id === focusModule) {
            return '#22d3ee';
          }
          if (d.isRoot) {
            return '#fbbf24';
          }
          if (highlightNodes.has(d.id)) {
            return '#f59e0b';
          }
          return '#334155';
        })
        .attr('stroke-width', d => {
          if (d.id === focusFunction || d.id === focusModule) {
            return 3;
          }
          if (d.isRoot) {
            return 2.5;
          }
          if (highlightNodes.has(d.id)) {
            return 2;
          }
          return 1.5;
        })
        .attr('opacity', d => {
          if (highlightNodes.has(d.id) || highlightNodes.size === 0) {
            return 1;
          }
          return 0.25; // Затемняем фоновые узлы
        });

      // Подписи
      nodeGroup
        .append('text')
        .attr('dx', d => {
          const r = highlightNodes.has(d.id) ? (d.size || 15) * 1.2 : d.size || 15;
          return r + 10;
        })
        .attr('dy', 4)
        .attr('font-size', d => {
          if (d.id === focusFunction || d.id === focusModule) {
            return '13px';
          }
          if (highlightNodes.has(d.id)) {
            return '12px';
          }
          if (highlightNodes.size > 0) {
            return '9px';
          }
          return d.type === 'function' ? '8px' : '11px';
        })
        .attr('fill', d => {
          if (d.id === focusFunction || d.id === focusModule) {
            return '#22d3ee';
          }
          if (highlightNodes.has(d.id)) {
            return '#e2e8f0';
          }
          if (highlightNodes.size > 0) {
            return '#64748b';
          }
          return '#e2e8f0';
        })
        .attr('font-family', 'monospace')
        .text(d => {
          let prefix = '';
          if (d.isRoot) prefix = '⭐ ';
          else if (d.id === focusFunction) prefix = '🎯 ';
          else if (d.id === focusModule) prefix = '📌 ';
          else if (d.type === 'function' && d.isExported) prefix = '📤 ';

          // Сокращаем длинные имена
          let name = d.name;
          if (name.length > 25 && d.type === 'module') {
            name = name.substring(0, 22) + '…';
          }
          return prefix + name;
        })
        .style('pointer-events', 'none')
        .attr('opacity', d => {
          if (highlightNodes.has(d.id) || highlightNodes.size === 0) {
            return 1;
          }
          return 0.3;
        });

      // Информация о функциях для модулей
      if (!focusFunction && highlightNodes.size === 0) {
        nodeGroup
          .filter(d => d.type === 'module' && d.functions && d.functions.length > 0)
          .append('text')
          .attr('dx', d => (d.size || 15) + 10)
          .attr('dy', 16)
          .attr('font-size', '7px')
          .attr('fill', '#94a3b8')
          .attr('font-family', 'monospace')
          .text(d => d.functions.length + ' функций')
          .style('pointer-events', 'none');
      }

      // Метки для активной функции - показываем количество входящих/исходящих
      if (focusFunction) {
        nodeGroup
          .filter(d => d.id === focusFunction)
          .append('text')
          .attr('dx', d => (d.size || 15) * 1.2 + 10)
          .attr('dy', 16)
          .attr('font-size', '8px')
          .attr('fill', '#94a3b8')
          .attr('font-family', 'monospace')
          .text(d => {
            const outgoing = filteredLinks.filter(l => l.source === d.id).length;
            const incoming = filteredLinks.filter(l => l.target === d.id).length;
            return `→ ${outgoing}  ← ${incoming}`;
          })
          .style('pointer-events', 'none');
      }

      // Симуляция
      if (this.simulation) {
        this.simulation.stop();
      }

      // Настраиваем расстояния в зависимости от подсветки
      const linkDistance = d => {
        const key = `${d.source}->${d.target}`;
        if (highlightLinks.has(key)) {
          return 80;
        }
        if (d.isCall) {
          return 100;
        }
        return 150;
      };

      this.simulation = d3
        .forceSimulation(filteredNodes)
        .force(
          'link',
          d3
            .forceLink(filteredLinks)
            .id(d => d.id)
            .distance(linkDistance)
        )
        .force(
          'charge',
          d3.forceManyBody().strength(d => {
            if (highlightNodes.has(d.id)) return -400;
            if (d.type === 'module') return -200;
            return -80;
          })
        )
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force(
          'collision',
          d3.forceCollide().radius(d => {
            if (highlightNodes.has(d.id)) return (d.size || 15) + 20;
            return (d.size || 15) + 10;
          })
        );

      this.simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        nodeGroup.attr('transform', d => 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')');
      });

      this.graphNodes = filteredNodes;
      this.graphLinks = filteredLinks;

      // Автоматическое масштабирование
      setTimeout(() => this.fitGraphToScreen(), 100);
    } catch (error) {
      console.warn('⚠️ Error rendering graph:', error);
      this.showEmptyState('Ошибка рендеринга графа');
    }
  }

  /**
   * Показывает пустое состояние
   */
  showEmptyState(message = 'Нет данных для отображения') {
    if (!this.g) return;
    try {
      this.g.selectAll('*').remove();
      this.g
        .append('text')
        .attr('x', '50%')
        .attr('y', '50%')
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', '16px')
        .style('font-family', 'monospace')
        .text(message);
    } catch (e) {
      console.warn('⚠️ Failed to show empty state:', e);
    }
  }

  /**
   * Автоматическое масштабирование графа для помещения на экран
   */
  fitGraphToScreen() {
    if (!this.svg || !this.zoom || !this.g) return;

    const container = document.getElementById('d3GraphWrapper');
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 700;

    // Получаем все узлы
    const nodes = this.graphNodes;
    if (!nodes || nodes.length === 0) return;

    // Находим bounding box
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;
    let hasPosition = false;

    for (const node of nodes) {
      if (node.x !== undefined && node.y !== undefined && isFinite(node.x) && isFinite(node.y)) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
        hasPosition = true;
      }
    }

    if (!hasPosition) return;

    // Добавляем отступы
    const padding = 80;
    const bboxWidth = maxX - minX + padding * 2;
    const bboxHeight = maxY - minY + padding * 2;

    if (bboxWidth <= 0 || bboxHeight <= 0) return;

    const scaleX = (width - 40) / bboxWidth;
    const scaleY = (height - 40) / bboxHeight;
    const scale = Math.min(scaleX, scaleY, 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const transform = d3.zoomIdentity
      .translate(width / 2 - centerX * scale, height / 2 - centerY * scale)
      .scale(scale);

    try {
      this.svg.transition().duration(500).call(this.zoom.transform, transform);
    } catch (e) {
      // Игнорируем ошибки трансформации
    }
  }

  /**
   * Обновляет представление графа
   */
  updateView() {
    const container = document.getElementById('d3GraphWrapper');
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = 700;

    if (!this.g) {
      this.initGraph();
      return;
    }

    this.buildGraphData();
    this.renderGraph(width, height);
  }

  /**
   * Обновляет граф с учетом активного модуля/функции
   */
  updateGraphWithFocus(focusModule, focusFunction, mode = 'all') {
    // Если граф еще не инициализирован, сохраняем запрос на обновление
    if (!this._isInitialized || !this.g) {
      console.log('⏳ Graph not initialized, saving update request');
      this._pendingUpdate = { focusModule, focusFunction, mode };
      return;
    }

    console.log('🎯 updateGraphWithFocus:', { focusModule, focusFunction, mode });

    // Обновляем режим если передан
    if (mode && this.app?.graphModeManager) {
      this.app.graphModeManager.currentMode = mode;
    }

    this.updateView();
  }

  /**
   * Показывает подсказку при наведении на узел
   */
  showTooltip(event, d) {
    const tooltip = document.getElementById('graphTooltip');
    if (!tooltip) return;

    document.getElementById('ttTitle').textContent = d.name;
    document.getElementById('ttInfo').textContent =
      d.type === 'module' ? 'Модуль: ' + d.fullName : 'Тип: функция' + (d.isExported ? ' 📤' : '');

    let detail = '';
    if (d.type === 'function') {
      const params = (d.params || []).join(', ') || 'нет';
      detail += 'Параметры: ' + params + '\n';
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
    if (!container) return;

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
    const tooltip = document.getElementById('graphTooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  /**
   * Обрабатывает поиск по графу
   */
  handleSearch(query) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.updateView();
    }, 300);
  }

  /**
   * Возвращает узлы графа
   */
  getGraphNodes() {
    return this.graphNodes;
  }

  /**
   * Возвращает ребра графа
   */
  getGraphLinks() {
    return this.graphLinks;
  }

  /**
   * Возвращает симуляцию D3
   */
  getSimulation() {
    return this.simulation;
  }

  /**
   * Очищает граф
   */
  clear() {
    if (this.simulation) {
      this.simulation.stop();
    }
    if (this.g) {
      try {
        this.g.selectAll('*').remove();
      } catch (e) {
        // Игнорируем ошибки
      }
    }
    this.graphNodes = [];
    this.graphLinks = [];
    this._isInitialized = false;
  }

  /**
   * Перезагружает граф с новыми данными
   */
  reload() {
    this.clear();
    this.buildGraphData();
    this.initGraph();
    this._isInitialized = true;
  }
}
