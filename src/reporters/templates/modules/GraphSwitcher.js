// packages/ast-analyzer/src/reporters/templates/modules/GraphSwitcher.js

/**
 * GraphSwitcher - переключатель между типами графов
 * Поддерживает: 2D D3, 3D Vis, 3D Sphere
 */
export class GraphSwitcher {
  constructor(app) {
    this.app = app;
    this._currentType = 'sphere';
    this._graphManager = null;
    this._container = null;
    this._isInitialized = false;
    this._isLoading = false;
    this._graphTypes = {
      d3: {
        label: '2D D3',
        icon: '📊',
        description: 'Классический 2D граф на D3.js',
        color: '#3b82f6',
        module: './GraphManager.js',
      },
      vis: {
        label: '3D Vis',
        icon: '🌐',
        description: '3D граф на vis-network',
        color: '#8b5cf6',
        module: './VisGraphManager.js',
      },
      sphere: {
        label: 'Сфера',
        icon: '🌍',
        description: '3D граф в сфере с векторами',
        color: '#22d3ee',
        module: './SphereGraphManager.js',
      },
    };

    // Сохраняем экземпляры менеджеров
    this._managers = {
      d3: null,
      vis: null,
      sphere: null,
    };

    console.log('🔄 GraphSwitcher created');
  }

  /**
   * Инициализация
   */
  init() {
    console.log('🔄 GraphSwitcher.init() called');

    this._container = document.getElementById('d3GraphWrapper');
    if (!this._container) {
      console.warn('⚠️ d3GraphWrapper container not found');
      return;
    }

    // Создаем панель переключения
    this._createSwitchPanel();

    // Загружаем сохраненный тип
    const savedType = localStorage.getItem('graph-type') || 'sphere';

    // Загружаем менеджеры
    this._initManagers();

    // Переключаемся на сохраненный тип
    this.switchTo(savedType);

    this._isInitialized = true;
    console.log('✅ GraphSwitcher initialized');
  }

  /**
   * Создание панели переключения
   */
  _createSwitchPanel() {
    const container = this._container.parentNode;

    let panel = document.getElementById('graphSwitchPanel');
    if (panel) {
      panel.remove();
    }

    panel = document.createElement('div');
    panel.id = 'graphSwitchPanel';
    panel.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #334155;
      margin-bottom: 12px;
      flex-wrap: wrap;
    `;

    const label = document.createElement('span');
    label.textContent = '🎯 Тип графа:';
    label.style.cssText = `
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
      margin-right: 4px;
    `;
    panel.appendChild(label);

    for (const [type, config] of Object.entries(this._graphTypes)) {
      const btn = document.createElement('button');
      btn.dataset.graphType = type;
      btn.className = 'graph-switch-btn';
      btn.style.cssText = `
        padding: 4px 14px;
        border-radius: 12px;
        border: 2px solid ${type === this._currentType ? config.color : '#334155'};
        background: ${type === this._currentType ? 'rgba(34, 211, 238, 0.1)' : 'transparent'};
        color: ${type === this._currentType ? config.color : '#94a3b8'};
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 4px;
      `;

      btn.innerHTML = `${config.icon} ${config.label}`;
      btn.title = config.description;

      btn.onmouseenter = () => {
        if (type !== this._currentType) {
          btn.style.borderColor = config.color;
          btn.style.color = config.color;
          btn.style.background = 'rgba(255,255,255,0.05)';
        }
      };
      btn.onmouseleave = () => {
        if (type !== this._currentType) {
          btn.style.borderColor = '#334155';
          btn.style.color = '#94a3b8';
          btn.style.background = 'transparent';
        }
      };

      btn.onclick = () => {
        this.switchTo(type);
      };

      panel.appendChild(btn);
    }

    // Индикатор текущего режима
    const indicator = document.createElement('span');
    indicator.id = 'graphModeIndicator';
    indicator.style.cssText = `
      font-size: 10px;
      color: #64748b;
      margin-left: auto;
      padding: 2px 10px;
      background: #0f172a;
      border-radius: 12px;
      border: 1px solid #1a2a4a;
    `;
    const config = this._graphTypes[this._currentType];
    indicator.textContent = `${config.icon} ${config.label}`;
    panel.appendChild(indicator);

    // Подсказка по горячим клавишам
    const hint = document.createElement('span');
    hint.style.cssText = `
      font-size: 9px;
      color: #64748b;
      margin-left: 4px;
      opacity: 0.7;
    `;
    hint.textContent = 'Ctrl+1, Ctrl+2, Ctrl+3';
    panel.appendChild(hint);

    container.insertBefore(panel, this._container);

    this._injectStyles();
  }

  /**
   * Инъекция стилей
   */
  _injectStyles() {
    const styleId = 'graph-switcher-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      <style id="${styleId}">
        .graph-switch-btn {
          position: relative;
          overflow: hidden;
        }
        .graph-switch-btn::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          transform: translate(-50%, -50%);
          transition: width 0.4s, height 0.4s;
        }
        .graph-switch-btn:hover::after {
          width: 200px;
          height: 200px;
        }
        .graph-switch-btn.active {
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);
        }
        .graph-switch-btn.loading {
          opacity: 0.6;
          cursor: wait;
        }
        .graph-switch-btn.error {
          border-color: #f87171 !important;
          color: #f87171 !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner-small {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #334155;
          border-top-color: #22d3ee;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @media (max-width: 768px) {
          #graphSwitchPanel {
            justify-content: center;
          }
          #graphModeIndicator {
            display: none;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Инициализация менеджеров графов
   */
  _initManagers() {
    // Загружаем все менеджеры в фоне
    for (const [type, config] of Object.entries(this._graphTypes)) {
      if (!this._managers[type]) {
        import(config.module)
          .then(module => {
            const ManagerClass =
              module.default || module[Object.keys(module).find(k => k.includes('Manager'))];
            if (ManagerClass) {
              this._managers[type] = new ManagerClass(this.app);
              console.log(`✅ ${config.label} загружен`);
            }
          })
          .catch(err => {
            console.warn(`⚠️ Не удалось загрузить ${config.label}:`, err);
          });
      }
    }
  }

  /**
   * Переключение на указанный тип графа
   */
  async switchTo(type) {
    if (this._isLoading) {
      console.log('⏳ Уже идет загрузка, пропускаем...');
      return;
    }

    if (!this._graphTypes[type]) {
      console.warn(`⚠️ Unknown graph type: ${type}`);
      return;
    }

    if (this._currentType === type && this._isInitialized) {
      this._updateGraph();
      return;
    }

    console.log(`🔄 Switching to ${type} graph...`);
    this._isLoading = true;

    // Показываем индикатор загрузки
    this._setLoadingState(type, true);

    try {
      // Очищаем текущий граф
      this._clearCurrentGraph();

      // Загружаем и инициализируем новый граф
      await this._loadGraph(type);

      // Обновляем кнопки
      this._updateButtons(type);

      this._currentType = type;
      localStorage.setItem('graph-type', type);

      // Обновляем индикатор
      const indicator = document.getElementById('graphModeIndicator');
      if (indicator) {
        const config = this._graphTypes[type];
        indicator.textContent = `${config.icon} ${config.label}`;
        indicator.style.borderColor = config.color;
        indicator.style.color = config.color;
      }

      console.log(`✅ Switched to ${type} graph`);
    } catch (error) {
      console.error(`❌ Ошибка переключения на ${type}:`, error);
      this._showError(type, error);
    } finally {
      this._isLoading = false;
      this._setLoadingState(type, false);
    }
  }

  /**
   * Установка состояния загрузки для кнопок
   */
  _setLoadingState(type, loading) {
    const buttons = document.querySelectorAll('.graph-switch-btn');
    buttons.forEach(btn => {
      if (btn.dataset.graphType === type) {
        btn.classList.toggle('loading', loading);
        if (loading) {
          btn.innerHTML = `<span class="spinner-small"></span> Загрузка...`;
        } else {
          const config = this._graphTypes[type];
          btn.innerHTML = `${config.icon} ${config.label}`;
        }
      }
    });
  }

  /**
   * Показ ошибки
   */
  _showError(type, error) {
    const buttons = document.querySelectorAll('.graph-switch-btn');
    buttons.forEach(btn => {
      if (btn.dataset.graphType === type) {
        btn.classList.add('error');
        btn.title = `Ошибка: ${error.message || 'Неизвестная ошибка'}`;
        setTimeout(() => {
          btn.classList.remove('error');
        }, 5000);
      }
    });

    // Показываем сообщение в контейнере
    if (this._container) {
      this._container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f87171;flex-direction:column;gap:16px;padding:20px;">
          <div style="font-size:48px;">⚠️</div>
          <div style="font-size:16px;text-align:center;max-width:400px;">
            Ошибка загрузки ${this._graphTypes[type].label}:<br>
            ${error.message || 'Неизвестная ошибка'}
          </div>
          <button onclick="window.graphSwitcher?.switchTo('sphere')" 
                  style="background:#1a2a4a;border:1px solid #22d3ee;color:#e2e8f0;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:14px;">
            🔄 Попробовать Сферу
          </button>
          <button onclick="window.graphSwitcher?.switchTo('vis')" 
                  style="background:#1a2a4a;border:1px solid #8b5cf6;color:#e2e8f0;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:14px;">
            🌐 Попробовать Vis
          </button>
        </div>
      `;
    }
  }

  /**
   * Загрузка графа
   */
  async _loadGraph(type) {
    const container = this._container;
    container.innerHTML = '';

    const graphContainer = document.createElement('div');
    graphContainer.id = 'graphContainer';
    graphContainer.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 500px;
      position: relative;
    `;
    container.appendChild(graphContainer);

    // Получаем менеджер
    let manager = this._managers[type];

    if (!manager) {
      const config = this._graphTypes[type];
      try {
        const module = await import(config.module);
        const ManagerClass =
          module.default || module[Object.keys(module).find(k => k.includes('Manager'))];
        if (ManagerClass) {
          manager = new ManagerClass(this.app);
          this._managers[type] = manager;
        } else {
          throw new Error('Не найден класс менеджера');
        }
      } catch (error) {
        throw new Error(`Не удалось загрузить ${config.label}: ${error.message}`);
      }
    }

    this._graphManager = manager;

    // Если менеджер не инициализирован
    if (!manager._isInitialized) {
      if (typeof manager.init === 'function') {
        await manager.init();
      } else {
        throw new Error(`Менеджер ${type} не имеет метода init`);
      }
    }

    // Обновляем вид
    if (typeof manager.updateView === 'function') {
      setTimeout(() => {
        try {
          manager.updateView();

          const focusModule = this.app?.cardManager?.getFocusModule?.();
          const focusFunction = this.app?.cardManager?.getFocusFunction?.();
          const mode = this.app?.graphModeManager?.getMode?.() || 'all';

          if (typeof manager.updateGraphWithFocus === 'function') {
            manager.updateGraphWithFocus(focusModule, focusFunction, mode);
          }
        } catch (error) {
          console.warn('⚠️ Ошибка обновления графа:', error);
        }
      }, 100);
    }

    // Если есть API приложения, обновляем ссылку на менеджер
    if (this.app) {
      this.app.graphManager = manager;
    }

    // Добавляем глобальную ссылку
    if (type === 'sphere') {
      window.SphereGraph = manager;
    }

    console.log(`✅ ${this._graphTypes[type].label} инициализирован`);
  }

  /**
   * Очистка текущего графа
   */
  _clearCurrentGraph() {
    const container = this._container;
    if (container) {
      container.innerHTML = '';
    }

    if (this._graphManager && typeof this._graphManager.clear === 'function') {
      try {
        this._graphManager.clear();
      } catch (e) {
        // Игнорируем ошибки очистки
      }
    }
    this._graphManager = null;
  }

  /**
   * Обновление кнопок
   */
  _updateButtons(type) {
    const buttons = document.querySelectorAll('.graph-switch-btn');
    const config = this._graphTypes[type];

    buttons.forEach(btn => {
      const btnType = btn.dataset.graphType;
      const isActive = btnType === type;
      const btnConfig = this._graphTypes[btnType];

      btn.style.borderColor = isActive ? config.color : '#334155';
      btn.style.background = isActive ? 'rgba(34, 211, 238, 0.1)' : 'transparent';
      btn.style.color = isActive ? config.color : '#94a3b8';
      btn.classList.toggle('active', isActive);
      btn.classList.remove('error');

      // Восстанавливаем содержимое
      if (!btn.classList.contains('loading')) {
        btn.innerHTML = `${btnConfig.icon} ${btnConfig.label}`;
      }
    });
  }

  /**
   * Обновление текущего графа
   */
  _updateGraph() {
    if (this._graphManager && typeof this._graphManager.updateView === 'function') {
      try {
        this._graphManager.updateView();
      } catch (error) {
        console.warn('⚠️ Ошибка обновления графа:', error);
      }
    }
  }

  /**
   * Получение текущего типа графа
   */
  getCurrentType() {
    return this._currentType;
  }

  /**
   * Получение текущего менеджера
   */
  getCurrentManager() {
    return this._graphManager;
  }

  /**
   * Получение всех типов графов
   */
  getGraphTypes() {
    return this._graphTypes;
  }

  /**
   * Проверка, загружен ли тип графа
   */
  isTypeLoaded(type) {
    return !!this._managers[type] && this._managers[type]._isInitialized;
  }

  /**
   * Получение менеджера по типу
   */
  getManager(type) {
    return this._managers[type] || null;
  }

  /**
   * Очистка
   */
  dispose() {
    this._clearCurrentGraph();
    this._isInitialized = false;
  }
}

export default GraphSwitcher;
