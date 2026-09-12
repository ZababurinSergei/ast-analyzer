/**
 * GraphModeManager - управление режимами отображения графа
 * Режимы: all, inward, outward, both
 *
 * all - показать все связи
 * inward - показать только входящие связи (кто импортирует данный модуль)
 * outward - показать только исходящие связи (что импортирует данный модуль)
 * both - показать и входящие, и исходящие связи
 */
export class GraphModeManager {
  constructor(app) {
    this.app = app;
    this.currentMode = 'all';
    this._listeners = [];
  }

  /**
   * Инициализация менеджера режимов
   * Настраивает обработчики кнопок и загружает сохраненный режим
   */
  init() {
    // Загружаем сохраненный режим из localStorage
    const savedMode = localStorage.getItem('graph-mode');
    if (savedMode && ['all', 'inward', 'outward', 'both'].includes(savedMode)) {
      this.currentMode = savedMode;
    }

    // Настройка обработчиков кнопок
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.currentMode);

      // Удаляем старые слушатели, чтобы избежать дублирования
      btn.removeEventListener('click', this._handleModeClick);
      btn.addEventListener('click', this._handleModeClick.bind(this, btn));
    });

    // Добавляем слушатель для клавиатурных сокращений
    document.addEventListener('keydown', this._handleKeyboard.bind(this));

    console.log(`🎯 Режим графа: ${this.currentMode}`);
  }

  /**
   * Обработчик клика по кнопке режима
   */
  _handleModeClick(btn) {
    const mode = btn.dataset.mode;
    if (mode && mode !== this.currentMode) {
      this.setMode(mode);
    }
  }

  /**
   * Установка режима отображения
   * @param {string} mode - 'all' | 'inward' | 'outward' | 'both'
   */
  setMode(mode) {
    if (!['all', 'inward', 'outward', 'both'].includes(mode)) {
      console.warn(`⚠️ Неизвестный режим: ${mode}`);
      return;
    }

    this.currentMode = mode;

    // Сохраняем в localStorage
    localStorage.setItem('graph-mode', mode);

    // Обновляем состояние кнопок
    document.querySelectorAll('[data-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    // Уведомляем подписчиков
    this._notifyListeners(mode);

    // Обновляем граф с учетом текущего фокуса и режима
    this.updateGraph();

    console.log(`🎯 Режим графа изменен: ${mode}`);
  }

  /**
   * Обновляет граф с учетом текущего режима и фокуса
   */
  updateGraph() {
    if (!this.app || !this.app.graphManager) {
      console.warn('⚠️ GraphManager не инициализирован');
      return;
    }

    const focusModule = this.app.cardManager?.getFocusModule();
    const focusFunction = this.app.cardManager?.getFocusFunction();

    // Используем обновленный метод updateGraphWithFocus
    if (typeof this.app.graphManager.updateGraphWithFocus === 'function') {
      this.app.graphManager.updateGraphWithFocus(focusModule, focusFunction, this.currentMode);
    } else {
      // Fallback для обратной совместимости
      this.app.graphManager.updateView();
    }
  }

  /**
   * Получить текущий режим
   * @returns {string} Текущий режим
   */
  getMode() {
    return this.currentMode;
  }

  /**
   * Получить название режима на русском
   * @param {string} mode - Код режима
   * @returns {string} Название на русском
   */
  getModeLabel(mode) {
    const labels = {
      all: '🌐 Все связи',
      inward: '📥 Входящие',
      outward: '📤 Исходящие',
      both: '🔁 Оба направления',
    };
    return labels[mode] || mode;
  }

  /**
   * Получить описание режима
   * @param {string} mode - Код режима
   * @returns {string} Описание режима
   */
  getModeDescription(mode) {
    const descriptions = {
      all: 'Показывает все связи между модулями',
      inward: 'Показывает только модули/функции, которые используют текущий',
      outward: 'Показывает только модули/функции, которые использует текущий',
      both: 'Показывает и входящие, и исходящие связи',
    };
    return descriptions[mode] || '';
  }

  /**
   * Фильтрация ребер в зависимости от режима
   * @param {Array} edges - Все ребра графа
   * @param {Object} inwardDeps - Входящие зависимости
   * @param {Object} outwardDeps - Исходящие зависимости
   * @param {Map} modules - Карта модулей
   * @returns {Array} Отфильтрованные ребра
   */
  filterEdges(edges, inwardDeps, outwardDeps, modules) {
    const filtered = [];
    const mode = this.currentMode;

    // Если режим 'all' - возвращаем все ребра
    if (mode === 'all') {
      return edges;
    }

    // Если режим 'outward' или 'both' - добавляем исходящие
    if (mode === 'outward' || mode === 'both') {
      for (const [from, deps] of Object.entries(outwardDeps)) {
        if (!deps) {
          continue;
        }
        for (const to of deps) {
          if (modules.has(from) && modules.has(to)) {
            // Проверяем, не добавлено ли уже это ребро
            const exists = filtered.some(e => e.source === from && e.target === to);
            if (!exists) {
              filtered.push({
                source: from,
                target: to,
                type: 'import',
                isOutward: true,
              });
            }
          }
        }
      }
    }

    // Если режим 'inward' или 'both' - добавляем входящие
    if (mode === 'inward' || mode === 'both') {
      for (const [to, deps] of Object.entries(inwardDeps)) {
        if (!deps) {
          continue;
        }
        for (const from of deps) {
          if (modules.has(from) && modules.has(to)) {
            const exists = filtered.some(e => e.source === from && e.target === to);
            if (!exists) {
              filtered.push({
                source: from,
                target: to,
                type: 'import',
                isInward: true,
              });
            }
          }
        }
      }
    }

    return filtered;
  }

  /**
   * Определяет, должно ли ребро быть показано в текущем режиме
   * @param {Object} edge - Ребро графа
   * @param {string} focusModule - Фокусируемый модуль (опционально)
   * @param {string} focusFunction - Фокусируемая функция (опционально)
   * @returns {boolean} true если ребро должно быть показано
   */
  shouldShowEdge(edge, focusModule = null, focusFunction = null) {
    const mode = this.currentMode;

    // Если нет фокуса, показываем все ребра
    if (!focusModule && !focusFunction) {
      return mode === 'all';
    }

    // Если фокус на функции
    if (focusFunction) {
      const fromId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const toId = typeof edge.target === 'object' ? edge.target.id : edge.target;

      switch (mode) {
        case 'all':
          return true;
        case 'outward':
          return fromId === focusFunction;
        case 'inward':
          return toId === focusFunction;
        case 'both':
          return fromId === focusFunction || toId === focusFunction;
        default:
          return true;
      }
    }

    // Если фокус на модуле
    if (focusModule) {
      const fromModule = typeof edge.source === 'object' ? edge.source.module : edge.source;
      const toModule = typeof edge.target === 'object' ? edge.target.module : edge.target;

      switch (mode) {
        case 'all':
          return true;
        case 'outward':
          return fromModule === focusModule;
        case 'inward':
          return toModule === focusModule;
        case 'both':
          return fromModule === focusModule || toModule === focusModule;
        default:
          return true;
      }
    }

    return true;
  }

  /**
   * Получает информацию о текущем режиме для отображения
   * @returns {Object} Информация о режиме
   */
  getModeInfo() {
    return {
      mode: this.currentMode,
      label: this.getModeLabel(this.currentMode),
      description: this.getModeDescription(this.currentMode),
      icon: this.getModeIcon(this.currentMode),
    };
  }

  /**
   * Получает иконку для режима
   * @param {string} mode - Код режима
   * @returns {string} Иконка
   */
  getModeIcon(mode) {
    const icons = {
      all: '🌐',
      inward: '📥',
      outward: '📤',
      both: '🔁',
    };
    return icons[mode] || '❓';
  }

  /**
   * Циклическое переключение режимов
   */
  cycleMode() {
    const modes = ['all', 'outward', 'inward', 'both'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }

  /**
   * Обработчик клавиатурных сокращений
   */
  _handleKeyboard(event) {
    // Ctrl+Shift+M - переключение режимов
    if (event.ctrlKey && event.shiftKey && event.key === 'M') {
      event.preventDefault();
      this.cycleMode();
    }

    // Ctrl+1 - режим "Все"
    if (event.ctrlKey && event.key === '1') {
      event.preventDefault();
      this.setMode('all');
    }

    // Ctrl+2 - режим "Исходящие"
    if (event.ctrlKey && event.key === '2') {
      event.preventDefault();
      this.setMode('outward');
    }

    // Ctrl+3 - режим "Входящие"
    if (event.ctrlKey && event.key === '3') {
      event.preventDefault();
      this.setMode('inward');
    }

    // Ctrl+4 - режим "Оба"
    if (event.ctrlKey && event.key === '4') {
      event.preventDefault();
      this.setMode('both');
    }
  }

  /**
   * Подписка на изменения режима
   * @param {Function} listener - Функция, вызываемая при изменении режима
   * @returns {Function} Функция для отписки
   */
  onModeChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * Уведомление подписчиков об изменении режима
   */
  _notifyListeners(mode) {
    for (const listener of this._listeners) {
      try {
        listener(mode);
      } catch (error) {
        console.warn('Ошибка в обработчике изменения режима:', error);
      }
    }

    // Дополнительно уведомляем через глобальный символ для кросс-модульного взаимодействия
    const SYM_MODE_CHANGE = Symbol.for('__AST_MODE_CHANGE__');
    const callback = window[SYM_MODE_CHANGE];
    if (typeof callback === 'function') {
      callback('graph', mode);
    }
  }

  /**
   * Сброс режима на значение по умолчанию
   */
  reset() {
    this.setMode('all');
    localStorage.removeItem('graph-mode');
  }

  /**
   * Получение статистики по режимам
   * @param {Object} graphData - Данные графа
   * @returns {Object} Статистика для текущего режима
   */
  getModeStats(graphData) {
    const mode = this.currentMode;
    const stats = {
      mode,
      label: this.getModeLabel(mode),
      totalEdges: 0,
      totalNodes: 0,
      edgeTypes: {
        module: 0,
        function: 0,
      },
    };

    if (!graphData) {
      return stats;
    }

    // Подсчет ребер по типам
    for (const edge of graphData.edges || []) {
      stats.totalEdges++;
      if (edge.isCall) {
        stats.edgeTypes.function++;
      } else {
        stats.edgeTypes.module++;
      }
    }

    stats.totalNodes = (graphData.nodes || []).length;

    return stats;
  }

  /**
   * Получает видимые узлы и ребра для текущего режима
   * @param {Array} allNodes - Все узлы графа
   * @param {Array} allEdges - Все ребра графа
   * @param {string} focusModule - Фокусный модуль (опционально)
   * @param {string} focusFunction - Фокусная функция (опционально)
   * @returns {Object} { nodes, edges, highlightNodes, highlightEdges }
   */
  getVisibleElements(allNodes, allEdges, focusModule = null, focusFunction = null) {
    const mode = this.currentMode;

    let visibleNodes = [];
    let visibleEdges = [];
    let highlightNodes = new Set();
    let highlightEdges = new Set();

    // Если нет фокуса и режим 'all' - показываем всё
    if (!focusModule && !focusFunction && mode === 'all') {
      return {
        nodes: allNodes,
        edges: allEdges,
        highlightNodes: new Set(allNodes.map(n => n.id)),
        highlightEdges: new Set(
          allEdges.map(e => `${e.source.id || e.source}->${e.target.id || e.target}`)
        ),
      };
    }

    // Если есть фокус на функции
    if (focusFunction) {
      return this._filterByFunction(allNodes, allEdges, focusFunction, focusModule, mode);
    }

    // Если есть фокус на модуле
    if (focusModule) {
      return this._filterByModule(allNodes, allEdges, focusModule, mode);
    }

    // Без фокуса, но с режимом не 'all'
    return this._filterNoFocus(allNodes, allEdges, mode);
  }

  /**
   * Фильтрация по функции
   */
  _filterByFunction(allNodes, allEdges, functionId, moduleId, mode) {
    const result = {
      nodes: [],
      edges: [],
      highlightNodes: new Set(),
      highlightEdges: new Set(),
    };

    // Находим целевую функцию
    const targetNode = allNodes.find(n => n.id === functionId || n.name === functionId);
    if (!targetNode) {
      console.warn(`⚠️ Функция не найдена: ${functionId}`);
      return this._filterNoFocus(allNodes, allEdges, mode);
    }

    // Добавляем целевую функцию
    result.nodes.push(targetNode);
    result.highlightNodes.add(targetNode.id);

    // Находим связи
    const incoming = allEdges.filter(e => {
      const target = typeof e.target === 'object' ? e.target.id : e.target;
      return target === targetNode.id || target === targetNode.name;
    });

    const outgoing = allEdges.filter(e => {
      const source = typeof e.source === 'object' ? e.source.id : e.source;
      return source === targetNode.id || source === targetNode.name;
    });

    let relatedEdges = [];
    let relatedNodeIds = new Set();

    switch (mode) {
      case 'inward':
        relatedEdges = incoming;
        for (const edge of incoming) {
          const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          relatedNodeIds.add(sourceId);
          result.highlightNodes.add(sourceId);
          result.highlightEdges.add(`${sourceId}->${targetNode.id}`);
        }
        break;
      case 'outward':
        relatedEdges = outgoing;
        for (const edge of outgoing) {
          const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
          relatedNodeIds.add(targetId);
          result.highlightNodes.add(targetId);
          result.highlightEdges.add(`${targetNode.id}->${targetId}`);
        }
        break;
      case 'both':
        relatedEdges = [...incoming, ...outgoing];
        for (const edge of relatedEdges) {
          const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
          relatedNodeIds.add(sourceId);
          relatedNodeIds.add(targetId);
          result.highlightNodes.add(sourceId);
          result.highlightNodes.add(targetId);
          result.highlightEdges.add(`${sourceId}->${targetId}`);
        }
        break;
      default:
        // 'all' - все связи
        relatedEdges = [...incoming, ...outgoing];
        for (const edge of relatedEdges) {
          const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
          relatedNodeIds.add(sourceId);
          relatedNodeIds.add(targetId);
          result.highlightNodes.add(sourceId);
          result.highlightNodes.add(targetId);
          result.highlightEdges.add(`${sourceId}->${targetId}`);
        }
    }

    // Добавляем связанные узлы
    for (const nodeId of relatedNodeIds) {
      const node = allNodes.find(n => n.id === nodeId || n.name === nodeId);
      if (node && !result.nodes.find(n => n.id === node.id)) {
        result.nodes.push(node);
      }
    }

    // Добавляем ребра
    result.edges = relatedEdges;

    // Если модуль указан, добавляем все функции модуля
    if (moduleId) {
      const moduleNodes = allNodes.filter(n => n.module === moduleId);
      for (const node of moduleNodes) {
        if (!result.nodes.find(n => n.id === node.id)) {
          result.nodes.push(node);
          result.highlightNodes.add(node.id);
        }
      }
    }

    return result;
  }

  /**
   * Фильтрация по модулю
   */
  _filterByModule(allNodes, allEdges, moduleId, mode) {
    const result = {
      nodes: [],
      edges: [],
      highlightNodes: new Set(),
      highlightEdges: new Set(),
    };

    // Находим все узлы модуля
    const moduleNodes = allNodes.filter(n => n.module === moduleId || n.id === moduleId);
    const moduleNodeIds = new Set(moduleNodes.map(n => n.id));

    // Добавляем все узлы модуля
    result.nodes = [...moduleNodes];
    for (const node of moduleNodes) {
      result.highlightNodes.add(node.id);
    }

    let relatedEdges = [];

    switch (mode) {
      case 'inward':
        // Только входящие
        relatedEdges = allEdges.filter(e => {
          const targetId = typeof e.target === 'object' ? e.target.id : e.target;
          const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
          return moduleNodeIds.has(targetId) && !moduleNodeIds.has(sourceId);
        });
        break;
      case 'outward':
        // Только исходящие
        relatedEdges = allEdges.filter(e => {
          const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
          const targetId = typeof e.target === 'object' ? e.target.id : e.target;
          return moduleNodeIds.has(sourceId) && !moduleNodeIds.has(targetId);
        });
        break;
      case 'both':
        // И входящие, и исходящие
        relatedEdges = allEdges.filter(e => {
          const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
          const targetId = typeof e.target === 'object' ? e.target.id : e.target;
          return moduleNodeIds.has(sourceId) || moduleNodeIds.has(targetId);
        });
        break;
      default:
        // 'all' - все связи
        relatedEdges = allEdges.filter(e => {
          const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
          const targetId = typeof e.target === 'object' ? e.target.id : e.target;
          return moduleNodeIds.has(sourceId) || moduleNodeIds.has(targetId);
        });
    }

    // Добавляем связанные узлы
    const relatedNodeIds = new Set();
    for (const edge of relatedEdges) {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
      relatedNodeIds.add(sourceId);
      relatedNodeIds.add(targetId);
    }

    for (const nodeId of relatedNodeIds) {
      if (!moduleNodeIds.has(nodeId)) {
        const node = allNodes.find(n => n.id === nodeId);
        if (node && !result.nodes.find(n => n.id === node.id)) {
          result.nodes.push(node);
          result.highlightNodes.add(node.id);
        }
      }
    }

    // Добавляем ребра с подсветкой
    result.edges = relatedEdges;
    for (const edge of relatedEdges) {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
      result.highlightEdges.add(`${sourceId}->${targetId}`);
    }

    // Убираем дубликаты узлов
    const uniqueNodes = new Map();
    for (const node of result.nodes) {
      uniqueNodes.set(node.id, node);
    }
    result.nodes = Array.from(uniqueNodes.values());

    return result;
  }

  /**
   * Фильтрация без фокуса
   */
  _filterNoFocus(allNodes, allEdges, mode) {
    const result = {
      nodes: allNodes,
      edges: [],
      highlightNodes: new Set(allNodes.map(n => n.id)),
      highlightEdges: new Set(),
    };

    // В режиме 'all' показываем все ребра
    if (mode === 'all') {
      result.edges = allEdges;
      result.highlightEdges = new Set(
        allEdges.map(
          e =>
            `${typeof e.source === 'object' ? e.source.id : e.source}->${typeof e.target === 'object' ? e.target.id : e.target}`
        )
      );
      return result;
    }

    // Для других режимов без фокуса показываем все ребра, но без подсветки
    result.edges = allEdges;
    return result;
  }
}

// Экспорт по умолчанию
export default GraphModeManager;
