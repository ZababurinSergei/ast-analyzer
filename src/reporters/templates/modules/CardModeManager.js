/**
 * CardModeManager - управление режимами отображения карточек
 * Режимы: compact, detailed, list
 */
export class CardModeManager {
  constructor(app) {
    this.app = app;
    // ✅ ИЗМЕНЕНО: режим по умолчанию теперь 'list'
    this.currentMode = 'list';
    this.modes = {
      compact: {
        label: 'Компактный',
        icon: '📐',
        gridColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        funcListHeight: '80px',
        showNav: true,
      },
      detailed: {
        label: 'Детальный',
        icon: '📋',
        gridColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        funcListHeight: '300px',
        showNav: true,
      },
      list: {
        label: 'Список',
        icon: '📄',
        gridColumns: '1fr',
        funcListHeight: 'none',
        showNav: true,
      },
      minimal: {
        label: 'Минимальный',
        icon: '🔍',
        gridColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        funcListHeight: '0px',
        showNav: false,
      },
    };

    // Состояние фильтрации
    this.filters = {
      search: '',
      types: {
        functions: true,
        classes: true,
        constants: true,
        interfaces: true,
        types: true,
        variables: true,
      },
      exportedOnly: false,
      withCalls: false,
    };
  }

  init() {
    // Создаем панель управления режимами
    this.createControlPanel();
    // Настройка обработчиков кнопок
    this.setupEventListeners();
    // Применяем режим по умолчанию
    this.applyMode(this.currentMode);
  }

  createControlPanel() {
    const container = document.getElementById('modulesContainer');
    if (!container) {
      return;
    }

    // Проверяем, существует ли уже панель
    let controlPanel = document.getElementById('cardModeControlPanel');
    if (controlPanel) {
      controlPanel.remove();
    }

    controlPanel = document.createElement('div');
    controlPanel.id = 'cardModeControlPanel';
    controlPanel.className = 'card-mode-control-panel';

    let html = '<div class="card-mode-group">';
    html += '<span class="card-mode-label">📊 Режим карточек:</span>';

    for (const [key, mode] of Object.entries(this.modes)) {
      const isActive = key === this.currentMode;
      html += `<button class="card-mode-btn ${isActive ? 'active' : ''}" data-card-mode="${key}" title="${mode.label}">`;
      html += `${mode.icon} ${mode.label}`;
      html += '</button>';
    }

    html += '</div>';

    // Фильтры
    html += '<div class="card-mode-filters">';
    html += '<span class="card-mode-label">🔍 Фильтры:</span>';

    html += `<label class="filter-label">
      <input type="checkbox" class="filter-checkbox" data-filter="functions" checked>
      ƒ
    </label>`;

    html += `<label class="filter-label">
      <input type="checkbox" class="filter-checkbox" data-filter="classes" checked>
      📦
    </label>`;

    html += `<label class="filter-label">
      <input type="checkbox" class="filter-checkbox" data-filter="constants" checked>
      📌
    </label>`;

    html += `<label class="filter-label">
      <input type="checkbox" class="filter-checkbox" data-filter="interfaces" checked>
      📋
    </label>`;

    html += `<label class="filter-label">
      <input type="checkbox" class="filter-checkbox" data-filter="types" checked>
      📝
    </label>`;

    html += `<label class="filter-label">
      <input type="checkbox" class="filter-checkbox" data-filter="variables" checked>
      📄
    </label>`;

    html += `<label class="filter-label filter-exported">
      <input type="checkbox" class="filter-checkbox" data-filter="exportedOnly">
      📤 Только экспорты
    </label>`;

    html += `<label class="filter-label filter-calls">
      <input type="checkbox" class="filter-checkbox" data-filter="withCalls">
      📞 С вызовами
    </label>`;

    html += '</div>';

    // Кнопка сброса
    html += `<button class="card-mode-reset" onclick="getApp()?.cardModeManager?.resetFilters()">🔄 Сброс</button>`;

    controlPanel.innerHTML = html;
    container.parentNode.insertBefore(controlPanel, container);

    // Добавляем стили для панели
    this.injectStyles();
  }

  injectStyles() {
    const styleId = 'card-mode-manager-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const styles = `
      <style id="${styleId}">
        .card-mode-control-panel {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: #1e293b;
          border-radius: 8px;
          margin-bottom: 12px;
          border: 1px solid #334155;
        }

        .card-mode-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }

        .card-mode-label {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-right: 4px;
        }

        .card-mode-btn {
          background: #0f172a;
          border: 1px solid #334155;
          color: #94a3b8;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          white-space: nowrap;
        }

        .card-mode-btn:hover {
          background: #1a2a4a;
          border-color: #60a5fa;
          color: #e2e8f0;
        }

        .card-mode-btn.active {
          background: #60a5fa;
          border-color: #60a5fa;
          color: #0f172a;
          font-weight: 600;
        }

        .card-mode-filters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: #0f172a;
          border-radius: 6px;
          border: 1px solid #1a1a3a;
        }

        .filter-label {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .filter-label:hover {
          background: #1a2a4a;
          color: #e2e8f0;
        }

        .filter-label .filter-checkbox {
          width: 12px;
          height: 12px;
          accent-color: #60a5fa;
          cursor: pointer;
        }

        .filter-label.filter-exported,
        .filter-label.filter-calls {
          border-left: 1px solid #334155;
          padding-left: 10px;
        }

        .card-mode-reset {
          background: #1a1a3a;
          border: 1px solid #334155;
          color: #94a3b8;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          margin-left: auto;
        }

        .card-mode-reset:hover {
          background: #2a2a4a;
          border-color: #f59e0b;
          color: #fbbf24;
        }

        @media (max-width: 768px) {
          .card-mode-control-panel {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .card-mode-group {
            justify-content: center;
          }

          .card-mode-filters {
            justify-content: center;
          }

          .card-mode-reset {
            margin-left: 0;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  setupEventListeners() {
    // Кнопки режимов
    document.querySelectorAll('[data-card-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setMode(btn.dataset.cardMode);
      });
    });

    // Чекбоксы фильтров
    document.querySelectorAll('.filter-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const filter = cb.dataset.filter;
        if (filter in this.filters.types) {
          this.filters.types[filter] = cb.checked;
        } else if (filter === 'exportedOnly') {
          this.filters.exportedOnly = cb.checked;
        } else if (filter === 'withCalls') {
          this.filters.withCalls = cb.checked;
        }
        this.applyFilters();
      });
    });
  }

  setMode(mode) {
    if (!this.modes[mode]) {
      console.warn(`Неизвестный режим карточек: ${mode}`);
      return;
    }
    this.currentMode = mode;
    document.querySelectorAll('[data-card-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.cardMode === mode);
    });
    this.applyMode(mode);
  }

  applyMode(mode) {
    const config = this.modes[mode];
    if (!config) {
      return;
    }

    const cards = document.querySelectorAll('.module-card');
    const grid = document.getElementById('modulesGrid');

    if (grid) {
      grid.style.gridTemplateColumns = config.gridColumns;
    }

    cards.forEach(card => {
      const funcList = card.querySelector('.functions-list');
      const navSection = card.querySelectorAll('.nav-section');
      const badges = card.querySelector('.badges');

      if (funcList) {
        funcList.style.maxHeight = config.funcListHeight;
        if (config.funcListHeight === '0px') {
          funcList.style.display = 'none';
        } else {
          funcList.style.display = 'block';
        }
      }

      navSection.forEach(nav => {
        nav.style.display = config.showNav ? 'flex' : 'none';
      });

      // В компактном режиме скрываем некоторые бейджи
      if (mode === 'compact' || mode === 'minimal') {
        if (badges) {
          const allBadges = badges.querySelectorAll('.badge');
          allBadges.forEach((badge, index) => {
            if (index > 2) {
              badge.style.display = 'none';
            } else {
              badge.style.display = 'inline-block';
            }
          });
        }
      } else if (badges) {
        const allBadges = badges.querySelectorAll('.badge');
        allBadges.forEach(badge => {
          badge.style.display = 'inline-block';
        });
      }

      // В минимальном режиме скрываем пути
      if (mode === 'minimal') {
        const path = card.querySelector('.path');
        if (path) {
          path.style.display = 'none';
        }
      } else {
        const path = card.querySelector('.path');
        if (path) {
          path.style.display = 'block';
        }
      }
    });
  }

  applyFilters() {
    const cards = document.querySelectorAll('.module-card');

    cards.forEach(card => {
      const modulePath = card.dataset.module;
      const pkg = this.app.reportData.packages[modulePath];
      if (!pkg) {
        return;
      }

      let visible = true;

      // Фильтр по типам сущностей
      if (this.filters.types) {
        const hasFunction = (pkg.entities?.functions?.length || 0) > 0;
        const hasClass = (pkg.entities?.classes?.length || 0) > 0;
        const hasConstant = (pkg.entities?.constants?.length || 0) > 0;
        const hasInterface = (pkg.entities?.interfaces?.length || 0) > 0;
        const hasType = (pkg.entities?.types?.length || 0) > 0;
        const hasVariable = (pkg.entities?.variables?.length || 0) > 0;

        const hasAnyType =
          (this.filters.types.functions && hasFunction) ||
          (this.filters.types.classes && hasClass) ||
          (this.filters.types.constants && hasConstant) ||
          (this.filters.types.interfaces && hasInterface) ||
          (this.filters.types.types && hasType) ||
          (this.filters.types.variables && hasVariable);

        if (!hasAnyType) {
          visible = false;
        }
      }

      // Фильтр "Только экспорты"
      if (visible && this.filters.exportedOnly) {
        const hasExports =
          (pkg.entities?.functions || []).some(f => f.isExported) ||
          (pkg.entities?.classes || []).some(c => c.isExported);
        if (!hasExports) {
          visible = false;
        }
      }

      // Фильтр "С вызовами"
      if (visible && this.filters.withCalls) {
        const hasCalls = (pkg.entities?.functions || []).some(f => (f.calls?.length || 0) > 0);
        if (!hasCalls) {
          visible = false;
        }
      }

      card.style.display = visible ? '' : 'none';
    });

    // Обновляем счетчик видимых карточек
    const visibleCount = document.querySelectorAll('.module-card[style*="display: none"]').length;
    const totalCount = document.querySelectorAll('.module-card').length;
    const visible = totalCount - visibleCount;

    let counter = document.getElementById('cardCounter');
    if (!counter) {
      counter = document.createElement('div');
      counter.id = 'cardCounter';
      counter.className = 'card-counter';
      const grid = document.getElementById('modulesGrid');
      if (grid) {
        grid.parentNode.insertBefore(counter, grid);
      }
    }
    counter.textContent = `📊 Показано: ${visible} из ${totalCount} модулей`;
  }

  resetFilters() {
    // Сброс чекбоксов
    document.querySelectorAll('.filter-checkbox').forEach(cb => {
      const filter = cb.dataset.filter;
      if (filter in this.filters.types) {
        cb.checked = true;
        this.filters.types[filter] = true;
      } else if (filter === 'exportedOnly') {
        cb.checked = false;
        this.filters.exportedOnly = false;
      } else if (filter === 'withCalls') {
        cb.checked = false;
        this.filters.withCalls = false;
      }
    });

    // Сброс поиска
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
    }

    // Сброс режима на детальный
    this.setMode('list');

    // Применяем фильтры
    this.applyFilters();

    // Обновляем граф
    this.app.updateView();
  }

  getMode() {
    return this.currentMode;
  }

  toggleMode() {
    const modeKeys = Object.keys(this.modes);
    const currentIndex = modeKeys.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modeKeys.length;
    this.setMode(modeKeys[nextIndex]);
  }

  getCurrentConfig() {
    return this.modes[this.currentMode] || this.modes.detailed;
  }

  // Метод для программного обновления фильтров
  updateFilters(filters) {
    if (filters.search !== undefined) {
      this.filters.search = filters.search;
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = filters.search;
      }
    }

    if (filters.types) {
      for (const [key, value] of Object.entries(filters.types)) {
        if (key in this.filters.types) {
          this.filters.types[key] = value;
          const cb = document.querySelector(`.filter-checkbox[data-filter="${key}"]`);
          if (cb) {
            cb.checked = value;
          }
        }
      }
    }

    if (filters.exportedOnly !== undefined) {
      this.filters.exportedOnly = filters.exportedOnly;
      const cb = document.querySelector('.filter-checkbox[data-filter="exportedOnly"]');
      if (cb) {
        cb.checked = filters.exportedOnly;
      }
    }

    if (filters.withCalls !== undefined) {
      this.filters.withCalls = filters.withCalls;
      const cb = document.querySelector('.filter-checkbox[data-filter="withCalls"]');
      if (cb) {
        cb.checked = filters.withCalls;
      }
    }

    this.applyFilters();
  }

  getFilters() {
    return { ...this.filters };
  }
}
