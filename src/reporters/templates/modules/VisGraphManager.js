// packages/ast-analyzer/src/reporters/templates/modules/VisGraphManager.js

/**
 * VisGraphManager - управление графом на vis-network
 * Заменяет D3 граф на более производительный и интерактивный
 *
 * Особенности:
 * - Все сущности: модули, функции, константы, интерфейсы, типы, классы, переменные
 * - Связи: contains, calls, import, extends, implements
 * - Фильтрация по типу, группе, поиску
 * - Иерархический и динамический режимы
 * - Детальная информация по клику
 * - Интеграция с роутером и карточками
 */
export class VisGraphManager {
  constructor(app) {
    this.app = app;
    this._api = null;
    this.network = null;
    this.nodesDS = null;
    this.edgesDS = null;
    this.allEntities = [];
    this.allEdges = [];
    this.selectedId = null;
    this._isInitialized = false;
    this._container = null;
    this._filters = {
      search: '',
      group: '',
      entityType: '',
      showExternals: true,
    };
    this._pendingUpdate = null;

    // Цвета для типов сущностей
    this.ENTITY_COLORS = {
      module: '#3b82f6',
      function: '#fbbf24',
      constant: '#f472b6',
      interface: '#a78bfa',
      type: '#22d3ee',
      class: '#4ade80',
      variable: '#f87171',
      external: '#ef4444',
    };

    this.ENTITY_LABELS = {
      module: 'Модуль',
      function: 'Функция',
      constant: 'Константа',
      interface: 'Интерфейс',
      type: 'Тип',
      class: 'Класс',
      variable: 'Переменная',
      external: 'Внешний',
    };

    this.ENTITY_ICONS = {
      module: '📁',
      function: 'ƒ',
      constant: '📌',
      interface: '📋',
      type: '📝',
      class: '📦',
      variable: '📄',
      external: '📦',
    };

    this.GROUP_COLORS = {
      entry: '#f59e0b',
      core: '#3b82f6',
      modes: '#8b5cf6',
      refactor: '#ec4899',
      semantic: '#14b8a6',
      formal: '#f97316',
      reporters: '#22c55e',
      'ci-cd': '#06b6d4',
      utils: '#64748b',
      types: '#94a3b8',
      module: '#3b82f6',
      function: '#fbbf24',
      constant: '#f472b6',
      interface: '#a78bfa',
      type: '#22d3ee',
      class: '#4ade80',
      variable: '#f87171',
      external: '#ef4444',
    };

    this.GROUP_LABELS = {
      entry: '⭐ Точка входа',
      core: '📦 Core',
      modes: '🔧 Modes',
      refactor: '♻️ Refactor',
      semantic: '🧠 Semantic',
      formal: '📐 Formal',
      reporters: '📊 Reporters',
      'ci-cd': '🚀 CI/CD',
      utils: '🛠 Utils',
      types: '📝 Types',
      module: '📁 Модуль',
      function: 'ƒ Функция',
      constant: '📌 Константа',
      interface: '📋 Интерфейс',
      type: '📝 Тип',
      class: '📦 Класс',
      variable: '📄 Переменная',
      external: '📦 Внешний',
    };

    // Получаем vis из глобального объекта
    this.vis = window.vis || window.visNetwork;
    if (!this.vis) {
      console.warn('⚠️ vis-network not loaded, trying to load from CDN');
      this._loadVisNetwork();
    }

    console.log('📊 VisGraphManager created');
  }

  /**
   * Загрузка vis-network если не загружена
   */
  _loadVisNetwork() {
    // Проверяем, есть ли уже скрипт
    if (document.querySelector('script[src*="vis-network"]')) {
      console.log('⏳ vis-network script already loading');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js';
    script.async = true;
    script.onload = () => {
      this.vis = window.vis || window.visNetwork;
      console.log('✅ vis-network loaded via CDN');
      if (this._container && this.allEntities.length) {
        this.render();
      }
    };
    script.onerror = () => {
      console.error('❌ Failed to load vis-network');
    };
    document.head.appendChild(script);
  }

  /**
   * Инициализация менеджера
   */
  init() {
    console.log('🔄 VisGraphManager.init() called');

    this._api = window[Symbol.for('__AST_APP_API__')];
    console.log('📡 VisGraphManager API получен:', this._api ? '✅' : '❌');

    const container = document.getElementById('d3GraphWrapper');
    if (!container) {
      console.warn('⚠️ d3GraphWrapper container not found');
      return;
    }

    // Очищаем контейнер
    container.innerHTML = '';

    // Создаем контейнер для vis-network
    const visContainer = document.createElement('div');
    visContainer.id = 'visGraphContainer';
    visContainer.style.cssText =
      'width:100%;height:100%;min-height:500px;background:#0b1020;border-radius:8px;';
    container.appendChild(visContainer);

    this._container = visContainer;

    // Загружаем данные
    this._loadData();

    // Настраиваем обработчики событий
    this._setupEventListeners();

    // Создаем легенду
    this._createLegend();

    this._isInitialized = true;
    console.log('✅ VisGraphManager initialized');
  }

  /**
   * Загрузка данных из отчета
   */
  _loadData() {
    const reportData = window[Symbol.for('__AST_INTERACTIVE_REPORT_DATA__')];
    if (!reportData) {
      console.warn('⚠️ Report data not found');
      this._showEmptyState('Нет данных для отображения');
      return;
    }

    this.allEntities = this._extractAllEntities(reportData);
    this.allEdges = this._buildEntityEdges(this.allEntities, reportData);

    console.log(`📊 Загружено сущностей: ${this.allEntities.length}`);
    console.log(`🔗 Загружено связей: ${this.allEdges.length}`);

    // Обновляем статистику
    this._updateStats();

    // Рендерим граф
    this.render();
  }

  /**
   * Извлечение всех сущностей из данных
   */
  _extractAllEntities(data) {
    const entities = [];
    const packages = data.packages || {};

    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (!pkg) continue;

      // Добавляем модуль
      entities.push({
        id: modulePath,
        name: modulePath.split('/').pop() || modulePath,
        fullName: modulePath,
        type: 'module',
        module: modulePath,
        isEntry: pkg.isEntry || false,
        language: pkg.language || 'unknown',
        fileStats: pkg.fileStats || {},
        displayPath: pkg.displayPath || modulePath,
        exports: pkg.exports || {},
        imports: pkg.imports || {},
        entities: pkg.entities || {},
      });

      // Функции
      const functions = pkg.entities?.functions || [];
      for (const func of functions) {
        if (!func || !func.name) continue;
        entities.push({
          id: `${modulePath}#func:${func.name}`,
          name: func.name,
          fullName: func.name,
          type: 'function',
          module: modulePath,
          isExported: func.isExported || false,
          isAsync: func.isAsync || false,
          params: func.params || [],
          returnType: func.returnType || 'any',
          line: func.line || 0,
          calls: func.calls || [],
          calledBy: func.calledBy || [],
          complexity: func.complexity || 0,
          body: func.body || '',
          isMethod: func.isMethod || false,
          className: func.className || '',
        });
      }

      // Константы
      const constants = pkg.entities?.constants || [];
      for (const const_ of constants) {
        if (!const_ || !const_.name) continue;
        entities.push({
          id: `${modulePath}#const:${const_.name}`,
          name: const_.name,
          fullName: const_.name,
          type: 'constant',
          module: modulePath,
          isExported: const_.isExported || false,
          value: const_.value || '',
          line: const_.line || 0,
        });
      }

      // Интерфейсы
      const interfaces = pkg.entities?.interfaces || [];
      for (const interface_ of interfaces) {
        if (!interface_ || !interface_.name) continue;
        entities.push({
          id: `${modulePath}#interface:${interface_.name}`,
          name: interface_.name,
          fullName: interface_.name,
          type: 'interface',
          module: modulePath,
          isExported: interface_.isExported || false,
          properties: interface_.properties || [],
          extends: interface_.extends || [],
          line: interface_.line || 0,
        });
      }

      // Типы
      const types = pkg.entities?.types || [];
      for (const type of types) {
        if (!type || !type.name) continue;
        entities.push({
          id: `${modulePath}#type:${type.name}`,
          name: type.name,
          fullName: type.name,
          type: 'type',
          module: modulePath,
          isExported: type.isExported || false,
          definition: type.definition || '',
          line: type.line || 0,
        });
      }

      // Классы
      const classes = pkg.entities?.classes || [];
      for (const class_ of classes) {
        if (!class_ || !class_.name) continue;
        entities.push({
          id: `${modulePath}#class:${class_.name}`,
          name: class_.name,
          fullName: class_.name,
          type: 'class',
          module: modulePath,
          isExported: class_.isExported || false,
          extends: class_.extends || '',
          implements: class_.implements || [],
          methods: class_.methods || [],
          properties: class_.properties || [],
          line: class_.line || 0,
        });
      }

      // Переменные
      const variables = pkg.entities?.variables || [];
      for (const variable of variables) {
        if (!variable || !variable.name) continue;
        entities.push({
          id: `${modulePath}#var:${variable.name}`,
          name: variable.name,
          fullName: variable.name,
          type: 'variable',
          module: modulePath,
          isExported: variable.isExported || false,
          value: variable.value || '',
          line: variable.line || 0,
        });
      }
    }

    return entities;
  }

  /**
   * Построение связей между сущностями
   */
  _buildEntityEdges(entities, data) {
    const edges = [];
    const entityMap = new Map();
    for (const e of entities) {
      entityMap.set(e.id, e);
    }

    // Связи: модуль -> сущности внутри него
    for (const e of entities) {
      if (e.type !== 'module') {
        edges.push({
          from: e.module,
          to: e.id,
          type: 'contains',
          label: 'содержит',
        });
      }
    }

    // Связи: вызовы функций
    for (const e of entities) {
      if (e.type === 'function' && e.calls) {
        for (const call of e.calls) {
          const targetId = `${e.module}#func:${call}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'calls',
              label: '→',
            });
          } else {
            for (const [id, entity] of entityMap) {
              if (
                entity.type === 'function' &&
                entity.name === call &&
                entity.module !== e.module
              ) {
                edges.push({
                  from: e.id,
                  to: id,
                  type: 'calls',
                  label: '→',
                });
                break;
              }
            }
          }
        }
      }
    }

    // Связи: импорты между модулями
    const packages = data.packages || {};
    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (!pkg) continue;
      const imports = pkg.imports || {};
      for (const [importSource] of Object.entries(imports)) {
        if (entityMap.has(modulePath) && entityMap.has(importSource)) {
          const exists = edges.some(
            e => e.from === modulePath && e.to === importSource && e.type === 'import'
          );
          if (!exists) {
            edges.push({
              from: modulePath,
              to: importSource,
              type: 'import',
              label: '←',
            });
          }
        }
      }
    }

    // Связи: наследование классов
    for (const e of entities) {
      if (e.type === 'class' && e.extends) {
        for (const ext of Array.isArray(e.extends) ? e.extends : [e.extends]) {
          const targetId = `${e.module}#class:${ext}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'extends',
              label: 'extends',
            });
          }
        }
      }
    }

    // Связи: реализация интерфейсов
    for (const e of entities) {
      if (e.type === 'class' && e.implements) {
        for (const impl of e.implements) {
          const targetId = `${e.module}#interface:${impl}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'implements',
              label: 'implements',
            });
          }
        }
      }
    }

    // Связи: расширение интерфейсов
    for (const e of entities) {
      if (e.type === 'interface' && e.extends) {
        for (const ext of e.extends) {
          const targetId = `${e.module}#interface:${ext}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'extends',
              label: 'extends',
            });
          }
        }
      }
    }

    // Удаляем дубликаты
    const uniqueEdges = [];
    const edgeSet = new Set();
    for (const e of edges) {
      const key = `${e.from}->${e.to}:${e.type}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        uniqueEdges.push(e);
      }
    }

    return uniqueEdges;
  }

  /**
   * Определение группы сущности
   */
  _detectGroup(entity) {
    if (entity.type === 'module') {
      const path = entity.fullName || entity.id;
      if (path.includes('/core/')) return 'core';
      if (path.includes('/modes/')) return 'modes';
      if (path.includes('/refactor/')) return 'refactor';
      if (path.includes('/semantic/')) return 'semantic';
      if (path.includes('/formal/')) return 'formal';
      if (path.includes('/reporters/')) return 'reporters';
      if (path.includes('/ci-cd/')) return 'ci-cd';
      if (path.includes('/utils/')) return 'utils';
      if (path.includes('/types')) return 'types';
      if (entity.isEntry) return 'entry';
      return 'module';
    }
    return entity.type;
  }

  /**
   * Форматирование размера файла
   */
  _formatFileSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  /**
   * Получение иконки для сущности
   */
  _getEntityIcon(entity) {
    if (entity.type === 'module') return '📁';
    if (entity.isExported) return '📤';
    const icons = {
      function: 'ƒ',
      constant: '📌',
      interface: '📋',
      type: '📝',
      class: '📦',
      variable: '📄',
    };
    return icons[entity.type] || '•';
  }

  /**
   * Экранирование HTML
   */
  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Создание легенды
   */
  _createLegend() {
    const legendContainer = document.querySelector('.legend');
    if (!legendContainer) return;

    const typeGroups = ['module', 'function', 'constant', 'interface', 'type', 'class', 'variable'];
    legendContainer.innerHTML = '';

    for (const type of typeGroups) {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-color" style="background:${this.ENTITY_COLORS[type]};"></span>
        <span>${this.ENTITY_LABELS[type]}</span>
      `;
      legendContainer.appendChild(item);
    }
  }

  /**
   * Обновление статистики
   */
  _updateStats() {
    const total = this.allEntities.length;
    const modules = this.allEntities.filter(e => e.type === 'module').length;
    const functions = this.allEntities.filter(e => e.type === 'function').length;
    const classes = this.allEntities.filter(e => e.type === 'class').length;
    const interfaces = this.allEntities.filter(e => e.type === 'interface').length;
    const types = this.allEntities.filter(e => e.type === 'type').length;
    const constants = this.allEntities.filter(e => e.type === 'constant').length;
    const variables = this.allEntities.filter(e => e.type === 'variable').length;

    const statElements = {
      statModules: modules,
      statFunctions: functions,
      statCalls: this.allEdges.filter(e => e.type === 'calls').length,
      statExported: this.allEntities.filter(e => e.isExported).length,
      statAsync: this.allEntities.filter(e => e.isAsync).length,
      statLines: '—',
      statSize: '—',
    };

    for (const [id, value] of Object.entries(statElements)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }
  }

  /**
   * Построение графа
   */
  _buildGraphData(filters) {
    const { search, group, entityType, showExternals } = filters;

    let filteredEntities = [...this.allEntities];

    // Фильтр по типу
    if (entityType) {
      filteredEntities = filteredEntities.filter(e => e.type === entityType);
    }

    // Фильтр по группе
    if (group) {
      filteredEntities = filteredEntities.filter(e => this._detectGroup(e) === group);
    }

    // Фильтр по поиску
    if (search) {
      const q = search.toLowerCase();
      filteredEntities = filteredEntities.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          e.fullName.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
      );
    }

    // Фильтр внешних модулей
    if (!showExternals) {
      filteredEntities = filteredEntities.filter(
        e => e.type !== 'module' || !e.id.includes('node_modules')
      );
    }

    const nodeIds = new Set(filteredEntities.map(e => e.id));

    // Фильтруем ребра
    let filteredEdges = this.allEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

    // Для поиска расширяем граф
    if (search) {
      const searchIds = new Set(filteredEntities.map(e => e.id));
      for (const edge of this.allEdges) {
        if (searchIds.has(edge.from) && !searchIds.has(edge.to)) {
          const target = this.allEntities.find(e => e.id === edge.to);
          if (target) {
            filteredEntities.push(target);
            searchIds.add(edge.to);
          }
        }
        if (searchIds.has(edge.to) && !searchIds.has(edge.from)) {
          const source = this.allEntities.find(e => e.id === edge.from);
          if (source) {
            filteredEntities.push(source);
            searchIds.add(edge.from);
          }
        }
      }
      filteredEdges = this.allEdges.filter(e => searchIds.has(e.from) && searchIds.has(e.to));
    }

    // Строим узлы для vis-network
    const nodes = filteredEntities.map(e => {
      const group = this._detectGroup(e);
      const color = this.GROUP_COLORS[group] || '#94a3b8';
      const label = e.type === 'module' ? e.name : (e.isExported ? '📤 ' : '') + e.name;

      let size = 12;
      if (e.type === 'module') size = 18 + (e.isEntry ? 8 : 0);
      else if (e.type === 'function')
        size = 10 + (e.isExported ? 4 : 0) + (e.calls?.length || 0) * 0.5;
      else if (e.type === 'class') size = 12;
      else if (e.type === 'interface') size = 10;
      else size = 8;

      // Формируем title
      let title = `<b>${this._escapeHtml(e.name)}</b>\n`;
      title += `Тип: ${this.ENTITY_LABELS[e.type] || e.type}\n`;
      if (e.type === 'module') {
        title += `Путь: ${this._escapeHtml(e.fullName)}\n`;
        title += `Язык: ${e.language || 'unknown'}\n`;
        if (e.isEntry) title += '⭐ Точка входа\n';
        if (e.fileStats) {
          title += `Строк: ${e.fileStats.lines || 0}\n`;
          title += `Размер: ${this._formatFileSize(e.fileStats.size || 0)}\n`;
        }
      } else {
        title += `Модуль: ${this._escapeHtml(e.module)}\n`;
        if (e.line) title += `Строка: ${e.line}\n`;
        if (e.isExported) title += '📤 Экспортирована\n';
        if (e.type === 'function') {
          if (e.isAsync) title += '⚡ Асинхронная\n';
          if (e.params?.length) title += `Параметры: ${e.params.join(', ')}\n`;
          if (e.returnType) title += `Возврат: ${e.returnType}\n`;
          if (e.calls?.length) title += `Вызовов: ${e.calls.length}\n`;
          if (e.calledBy?.length) title += `Кем вызвана: ${e.calledBy.length}\n`;
          if (e.complexity) title += `Сложность: ${e.complexity}\n`;
        }
        if (e.type === 'class') {
          if (e.extends) title += `Наследует: ${e.extends}\n`;
          if (e.implements?.length) title += `Реализует: ${e.implements.join(', ')}\n`;
          if (e.methods?.length) title += `Методов: ${e.methods.length}\n`;
        }
        if (e.type === 'interface' || e.type === 'type') {
          if (e.properties?.length) title += `Свойств: ${e.properties.length}\n`;
          if (e.extends?.length) title += `Расширяет: ${e.extends.join(', ')}\n`;
        }
      }
      title += `\n🖱 Клик для деталей`;

      return {
        id: e.id,
        label: label,
        title: title,
        group: group,
        value: Math.max(6, size),
        shape:
          e.type === 'module'
            ? e.isEntry
              ? 'star'
              : 'dot'
            : e.type === 'function'
              ? 'dot'
              : e.type === 'class'
                ? 'box'
                : e.type === 'interface'
                  ? 'diamond'
                  : e.type === 'type'
                    ? 'triangle'
                    : e.type === 'constant'
                      ? 'square'
                      : 'dot',
        color: {
          background: color,
          border: e.isEntry ? '#fbbf24' : '#0b1020',
          highlight: { background: '#fff', border: color },
        },
        font: { color: '#e8eefc', size: e.type === 'module' ? 12 : 10 },
        shapeProperties: {
          borderDashes: e.type === 'external' ? [3, 3] : false,
        },
      };
    });

    // Строим ребра
    const edgeColors = {
      contains: '#3b82f6',
      calls: '#f59e0b',
      import: '#3b82f6',
      extends: '#4ade80',
      implements: '#a78bfa',
    };

    const visEdges = filteredEdges.map((e, i) => {
      const color = edgeColors[e.type] || '#3a4a73';
      return {
        id: 'e' + i,
        from: e.from,
        to: e.to,
        label: e.label || '',
        arrows: 'to',
        color: { color: color, highlight: '#7aa2ff' },
        smooth: { type: 'dynamic' },
        font: { size: 8, color: '#64748b' },
        width: e.type === 'calls' ? 1.5 : 1,
        dashes: e.type === 'import' ? [4, 4] : false,
      };
    });

    return { nodes, edges: visEdges, entityData: filteredEntities };
  }

  /**
   * Рендеринг графа
   */
  render(filters = null) {
    if (!this._container) return;

    if (!this.vis) {
      console.warn('⚠️ vis-network not loaded, waiting...');
      this._loadVisNetwork();
      return;
    }

    if (filters) {
      this._filters = { ...this._filters, ...filters };
    }

    if (!this.allEntities.length || !this.allEdges.length) {
      this._showEmptyState('Нет данных для отображения');
      return;
    }

    const { nodes, edges, entityData } = this._buildGraphData(this._filters);

    if (nodes.length === 0) {
      this._showEmptyState('Ничего не найдено');
      return;
    }

    // Определяем режим
    const layoutSelect = document.getElementById('layout');
    const isHierarchical = layoutSelect?.value === 'hierarchical';

    const options = {
      nodes: {
        borderWidth: 2,
        scaling: {
          min: 8,
          max: 40,
          label: { min: 8, max: 14 },
        },
        font: {
          size: 11,
          color: '#e8eefc',
          face: 'Inter, system-ui, sans-serif',
        },
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.3)',
          size: 4,
        },
      },
      edges: {
        width: 1.2,
        selectionWidth: 2.5,
        smooth: {
          type: 'dynamic',
          roundness: 0.3,
        },
        font: {
          size: 8,
          color: '#64748b',
          align: 'middle',
        },
      },
      physics: isHierarchical
        ? false
        : {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
              gravitationalConstant: -50,
              springLength: 120,
              springConstant: 0.05,
              damping: 0.9,
            },
            stabilization: {
              iterations: 150,
              updateInterval: 25,
            },
            maxVelocity: 50,
            minVelocity: 0.1,
          },
      layout: isHierarchical
        ? {
            hierarchical: {
              enabled: true,
              direction: 'UD',
              sortMethod: 'directed',
              nodeSpacing: 150,
              levelSeparation: 120,
              treeSpacing: 200,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
            },
          }
        : { hierarchical: false },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        multiselect: false,
        navigationButtons: true,
        keyboard: true,
        dragNodes: true,
        dragView: true,
        zoomView: true,
      },
    };

    // Сохраняем текущий зум
    let currentScale = 1;
    let currentPosition = { x: 0, y: 0 };
    if (this.network) {
      const scale = this.network.getScale();
      const pos = this.network.getViewPosition();
      if (scale) currentScale = scale;
      if (pos) currentPosition = pos;
    }

    // Создаем новый network
    this._container.innerHTML = '';
    this.nodesDS = new this.vis.DataSet(nodes);
    this.edgesDS = new this.vis.DataSet(edges);

    this.network = new this.vis.Network(
      this._container,
      {
        nodes: this.nodesDS,
        edges: this.edgesDS,
      },
      options
    );

    // Настраиваем события
    this.network.on('click', params => {
      if (params.nodes.length > 0) {
        this._showDetails(params.nodes[0]);
      }
    });

    this.network.on('doubleClick', params => {
      if (params.nodes.length > 0) {
        this._focusNeighborhood(params.nodes[0]);
      }
    });

    // Восстанавливаем позицию
    if (currentScale > 0 && currentPosition) {
      try {
        this.network.moveTo({
          position: currentPosition,
          scale: Math.min(currentScale, 1.5),
          animation: false,
        });
      } catch (e) {
        // Игнорируем ошибки
      }
    }

    // Обновляем статистику
    this._updateEntityStats(entityData);

    // Если был отложенный запрос на фокус
    if (this._pendingUpdate) {
      const { focusModule, focusFunction, mode } = this._pendingUpdate;
      this.updateGraphWithFocus(focusModule, focusFunction, mode);
      this._pendingUpdate = null;
    }
  }

  /**
   * Показ пустого состояния
   */
  _showEmptyState(message = 'Нет данных') {
    if (!this._container) return;
    this._container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;flex-direction:column;gap:12px;">
        <div style="font-size:48px;">📊</div>
        <div>${message}</div>
      </div>
    `;
  }

  /**
   * Обновление статистики для отфильтрованных данных
   */
  _updateEntityStats(entityData) {
    const total = entityData.length;
    const modules = entityData.filter(e => e.type === 'module').length;
    const functions = entityData.filter(e => e.type === 'function').length;
    const classes = entityData.filter(e => e.type === 'class').length;
    const interfaces = entityData.filter(e => e.type === 'interface').length;
    const types = entityData.filter(e => e.type === 'type').length;
    const constants = entityData.filter(e => e.type === 'constant').length;
    const variables = entityData.filter(e => e.type === 'variable').length;
    const exported = entityData.filter(e => e.isExported).length;

    // Обновляем заголовок статистики
    const statsLine = document.getElementById('statsLine');
    if (statsLine) {
      statsLine.innerHTML = `
        <span class="stat" role="listitem">📊 <strong>${total}</strong> всего</span>
        <span class="stat" role="listitem">📁 <strong>${modules}</strong> модулей</span>
        <span class="stat" role="listitem">ƒ <strong>${functions}</strong> функций</span>
        <span class="stat" role="listitem">📦 <strong>${classes}</strong> классов</span>
        <span class="stat" role="listitem">📋 <strong>${interfaces}</strong> интерфейсов</span>
        <span class="stat" role="listitem">📝 <strong>${types}</strong> типов</span>
        <span class="stat" role="listitem">📌 <strong>${constants}</strong> констант</span>
        <span class="stat" role="listitem">📄 <strong>${variables}</strong> переменных</span>
        <span class="stat" role="listitem">📤 <strong>${exported}</strong> экспортов</span>
      `;
    }
  }

  /**
   * Показ деталей сущности
   */
  _showDetails(id) {
    this.selectedId = id;
    const entity = this.allEntities.find(e => e.id === id);
    if (!entity) {
      const detailsDiv = document.getElementById('details');
      if (detailsDiv) detailsDiv.innerHTML = '<p class="empty">Сущность не найдена</p>';
      return;
    }

    const detailsDiv = document.getElementById('details');
    if (!detailsDiv) return;

    let html = `<h2>${this._getEntityIcon(entity)} ${this._escapeHtml(entity.name)}</h2>`;
    html += `<div class="meta">`;
    html += `<span class="entity-badge badge-${entity.type}">${this.ENTITY_LABELS[entity.type] || entity.type}</span>`;
    if (entity.isExported) html += ' 📤 Экспортирована';
    if (entity.isAsync) html += ' ⚡ Асинхронная';
    if (entity.isEntry) html += ' ⭐ Точка входа';
    html += `</div>`;

    // Общая информация
    html += `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">`;
    if (entity.module) {
      const moduleLink = `<a data-id="${entity.module}" style="color:var(--accent);cursor:pointer;text-decoration:none;">${entity.module.split('/').pop() || entity.module}</a>`;
      html += `Модуль: ${moduleLink}`;
    }
    if (entity.line) html += ` | Строка: ${entity.line}`;
    if (entity.language) html += ` | Язык: ${entity.language}`;
    if (entity.fileStats) {
      if (entity.fileStats.lines) html += ` | Строк: ${entity.fileStats.lines}`;
      if (entity.fileStats.size)
        html += ` | Размер: ${this._formatFileSize(entity.fileStats.size)}`;
    }
    html += `</div>`;

    // Информация по типу
    if (entity.type === 'function') {
      html += `<div style="font-size:12px;margin-bottom:6px;">`;
      html += `<b>Сигнатура:</b> ${entity.name}(${(entity.params || []).join(', ')})`;
      if (entity.returnType) html += `: ${entity.returnType}`;
      html += `</div>`;
      if (entity.complexity) {
        const color =
          entity.complexity > 10 ? '#f87171' : entity.complexity > 5 ? '#fbbf24' : '#4ade80';
        html += `<div style="font-size:12px;color:${color};">🔄 Сложность: ${entity.complexity}</div>`;
      }
      if (entity.body) {
        html += `<details style="margin:4px 0;"><summary style="cursor:pointer;color:var(--accent);font-size:12px;">📄 Тело функции</summary>`;
        html += `<pre style="background:#0a0a1a;padding:8px;border-radius:4px;font-size:11px;overflow:auto;max-height:150px;color:#e2e8f0;border:1px solid var(--border);">${this._escapeHtml(entity.body)}</pre>`;
        html += `</details>`;
      }
    }

    if (entity.type === 'class') {
      if (entity.extends)
        html += `<div style="font-size:12px;">📤 Наследует: ${entity.extends}</div>`;
      if (entity.implements?.length) {
        html += `<div style="font-size:12px;">📋 Реализует: ${entity.implements.join(', ')}</div>`;
      }
      if (entity.properties?.length) {
        html += `<div style="font-size:12px;">📌 Свойства: ${entity.properties.length}</div>`;
      }
      if (entity.methods?.length) {
        html += `<div style="font-size:12px;">ƒ Методы: ${entity.methods.length}</div>`;
      }
    }

    if (entity.type === 'interface' || entity.type === 'type') {
      if (entity.extends?.length) {
        html += `<div style="font-size:12px;">📤 Расширяет: ${entity.extends.join(', ')}</div>`;
      }
      if (entity.properties?.length) {
        html += `<div style="font-size:12px;">📌 Свойства: ${entity.properties.length}</div>`;
      }
      if (entity.definition) {
        html += `<details style="margin:4px 0;"><summary style="cursor:pointer;color:var(--accent);font-size:12px;">📄 Определение</summary>`;
        html += `<pre style="background:#0a0a1a;padding:8px;border-radius:4px;font-size:11px;overflow:auto;max-height:150px;color:#e2e8f0;border:1px solid var(--border);">${this._escapeHtml(entity.definition)}</pre>`;
        html += `</details>`;
      }
    }

    if (entity.type === 'constant' || entity.type === 'variable') {
      if (entity.value) {
        html += `<div style="font-size:12px;">📌 Значение: <code style="background:#0a0a1a;padding:2px 6px;border-radius:4px;font-size:11px;">${this._escapeHtml(String(entity.value))}</code></div>`;
      }
    }

    // Связи
    const incoming = this.allEdges.filter(e => e.to === entity.id);
    const outgoing = this.allEdges.filter(e => e.from === entity.id);

    if (incoming.length || outgoing.length) {
      html += `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">`;

      if (outgoing.length) {
        html += `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">📤 Исходящие связи (${outgoing.length}):</div>`;
        html += `<ul class="list">`;
        for (const edge of outgoing) {
          const target = this.allEntities.find(e => e.id === edge.to);
          if (target) {
            html += `<li><a data-id="${edge.to}" style="color:var(--accent);cursor:pointer;text-decoration:none;">${this._getEntityIcon(target)} ${this._escapeHtml(target.name)}</a> <span style="color:#64748b;font-size:10px;">(${edge.type})</span></li>`;
          }
        }
        html += `</ul>`;
      }

      if (incoming.length) {
        html += `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">📥 Входящие связи (${incoming.length}):</div>`;
        html += `<ul class="list">`;
        for (const edge of incoming) {
          const source = this.allEntities.find(e => e.id === edge.from);
          if (source) {
            html += `<li><a data-id="${edge.from}" style="color:var(--accent);cursor:pointer;text-decoration:none;">${this._getEntityIcon(source)} ${this._escapeHtml(source.name)}</a> <span style="color:#64748b;font-size:10px;">(${edge.type})</span></li>`;
          }
        }
        html += `</ul>`;
      }

      html += `</div>`;
    }

    // Экспорты для модуля
    if (entity.type === 'module' && entity.exports) {
      const exportNames = Object.keys(entity.exports);
      if (exportNames.length) {
        html += `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">`;
        html += `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">📤 Экспорты (${exportNames.length}):</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
        for (const name of exportNames) {
          html += `<span style="font-size:10px;background:#0f172a;padding:1px 8px;border-radius:4px;border:1px solid var(--border);">${this._escapeHtml(name)}</span>`;
        }
        html += `</div></div>`;
      }
    }

    // Вызовы для функции
    if (entity.type === 'function') {
      if (entity.calls?.length) {
        html += `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">`;
        html += `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">📞 Вызывает (${entity.calls.length}):</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
        for (const call of entity.calls) {
          const target = this.allEntities.find(e => e.type === 'function' && e.name === call);
          if (target) {
            html += `<a data-id="${target.id}" style="font-size:10px;background:#0f172a;padding:1px 8px;border-radius:4px;border:1px solid var(--border);color:var(--accent);cursor:pointer;text-decoration:none;">${this._escapeHtml(call)}</a>`;
          } else {
            html += `<span style="font-size:10px;background:#0f172a;padding:1px 8px;border-radius:4px;border:1px solid var(--border);color:#64748b;">${this._escapeHtml(call)}</span>`;
          }
        }
        html += `</div></div>`;
      }

      if (entity.calledBy?.length) {
        html += `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">`;
        html += `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">📥 Кем вызвана (${entity.calledBy.length}):</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
        for (const caller of entity.calledBy) {
          const source = this.allEntities.find(e => e.type === 'function' && e.name === caller);
          if (source) {
            html += `<a data-id="${source.id}" style="font-size:10px;background:#0f172a;padding:1px 8px;border-radius:4px;border:1px solid var(--border);color:var(--accent);cursor:pointer;text-decoration:none;">${this._escapeHtml(caller)}</a>`;
          } else {
            html += `<span style="font-size:10px;background:#0f172a;padding:1px 8px;border-radius:4px;border:1px solid var(--border);color:#64748b;">${this._escapeHtml(caller)}</span>`;
          }
        }
        html += `</div></div>`;
      }
    }

    detailsDiv.innerHTML = html;

    // Обработчики для ссылок
    detailsDiv.querySelectorAll('a[data-id]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const targetId = a.getAttribute('data-id');
        const target = this.allEntities.find(e => e.id === targetId);
        if (target && this.network) {
          this.network.selectNodes([targetId]);
          this.network.focus(targetId, { scale: 1.15, animation: { duration: 300 } });
          this._showDetails(targetId);
        }
      });
    });
  }

  /**
   * Фокус на связанные узлы
   */
  _focusNeighborhood(id) {
    const entity = this.allEntities.find(e => e.id === id);
    if (!entity || !this.network) return;

    const keep = new Set([id]);
    for (const edge of this.allEdges) {
      if (edge.from === id) keep.add(edge.to);
      if (edge.to === id) keep.add(edge.from);
    }

    const allNodeIds = new Set(this.allEntities.map(e => e.id));
    for (const nodeId of allNodeIds) {
      const hidden = !keep.has(nodeId);
      this.nodesDS.update({ id: nodeId, hidden: hidden });
    }

    this.network.focus(id, { scale: 1.2, animation: { duration: 400 } });
    this._showDetails(id);
  }

  /**
   * Настройка обработчиков событий
   */
  _setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.render({ search: searchInput.value });
        }, 300);
      });
    }

    // Фильтр по типу
    const typeFilter = document.getElementById('entityTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => {
        this.render({ entityType: typeFilter.value });
      });
    }

    // Фильтр по группе
    const groupFilter = document.getElementById('groupFilter');
    if (groupFilter) {
      groupFilter.addEventListener('change', () => {
        this.render({ group: groupFilter.value });
      });
    }

    // Показ внешних
    const externalsCheckbox = document.getElementById('showExternals');
    if (externalsCheckbox) {
      externalsCheckbox.addEventListener('change', () => {
        this.render({ showExternals: externalsCheckbox.checked });
      });
    }

    // Режим отображения
    const layoutSelect = document.getElementById('layout');
    if (layoutSelect) {
      layoutSelect.addEventListener('change', () => {
        this.render();
      });
    }

    // Центрирование
    const fitBtn = document.getElementById('fit');
    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        if (this.network) this.network.fit({ animation: { duration: 500 } });
      });
    }

    // Сброс
    const resetBtn = document.getElementById('reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = '';
        if (groupFilter) groupFilter.value = '';
        if (externalsCheckbox) externalsCheckbox.checked = true;
        if (layoutSelect) layoutSelect.value = 'physics';
        this.render({
          search: '',
          group: '',
          entityType: '',
          showExternals: true,
        });
        if (this.network) this.network.fit({ animation: { duration: 500 } });
      });
    }

    // Клавиатурные сокращения
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (searchInput) {
          searchInput.value = '';
          this.render({
            search: '',
            group: document.getElementById('groupFilter')?.value || '',
            entityType: document.getElementById('entityTypeFilter')?.value || '',
            showExternals: document.getElementById('showExternals')?.checked !== false,
          });
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    });
  }

  /**
   * Обновление графа с фокусом
   */
  updateGraphWithFocus(focusModule, focusFunction, mode = 'all') {
    console.log('🎯 VisGraphManager.updateGraphWithFocus:', { focusModule, focusFunction, mode });

    if (!this._isInitialized || !this.network) {
      console.log('⏳ Graph not initialized, saving update request');
      this._pendingUpdate = { focusModule, focusFunction, mode };
      return;
    }

    // Если есть фокус на модуле или функции, подсвечиваем его
    if (focusModule || focusFunction) {
      const targetId = focusFunction ? `${focusModule}#func:${focusFunction}` : focusModule;
      if (this.network && targetId) {
        this.network.selectNodes([targetId]);
        this.network.focus(targetId, { scale: 1.2, animation: { duration: 300 } });
        this._showDetails(targetId);
      }
    } else {
      // Сброс подсветки
      if (this.network) {
        this.network.selectNodes([]);
        this.network.fit({ animation: { duration: 300 } });
      }
      const detailsDiv = document.getElementById('details');
      if (detailsDiv) {
        detailsDiv.innerHTML = `<p class="hint">💡 Клик по узлу — подробности. Двойной клик — фокус на связанные узлы.</p>`;
      }
    }
  }

  /**
   * Получение узлов графа
   */
  getGraphNodes() {
    return this.nodesDS ? this.nodesDS.get() : [];
  }

  /**
   * Получение ребер графа
   */
  getGraphLinks() {
    return this.edgesDS ? this.edgesDS.get() : [];
  }

  /**
   * Получение симуляции
   */
  getSimulation() {
    return this.network ? this.network.physics : null;
  }

  /**
   * Очистка графа
   */
  clear() {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.nodesDS = null;
    this.edgesDS = null;
    if (this._container) {
      this._container.innerHTML = '';
    }
    this._isInitialized = false;
  }

  /**
   * Перезагрузка графа
   */
  reload() {
    this.clear();
    this._loadData();
    this.render();
    this._isInitialized = true;
  }

  /**
   * Обновление представления
   */
  updateView() {
    if (this._isInitialized) {
      this.render();
    }
  }

  /**
   * Обработка поиска
   */
  handleSearch(query) {
    this.render({ search: query });
  }

  /**
   * Освобождение ресурсов
   */
  dispose() {
    this.clear();
  }
}

export default VisGraphManager;
