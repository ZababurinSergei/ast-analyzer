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

    // Обновляем граф
    if (this.app.graphManager) {
      this.app.graphManager.updateView();
    }

    console.log(`🎯 Режим графа изменен: ${mode}`);
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
      inward: 'Показывает только модули, которые импортируют текущий',
      outward: 'Показывает только модули, которые импортирует текущий',
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
   * @returns {boolean} true если ребро должно быть показано
   */
  shouldShowEdge(edge, focusModule = null) {
    const mode = this.currentMode;

    // Если нет фокуса, показываем все ребра
    if (!focusModule) {
      return mode === 'all';
    }

    switch (mode) {
      case 'all':
        return true;
      case 'outward':
        return edge.source === focusModule;
      case 'inward':
        return edge.target === focusModule;
      case 'both':
        return edge.source === focusModule || edge.target === focusModule;
      default:
        return true;
    }
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
}
