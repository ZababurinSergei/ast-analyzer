// packages/ast-analyzer/src/reporters/templates/modules/LocationBar.js

/**
 * LocationBar - компонент адресной строки
 *
 * Отображает текущий путь и позволяет:
 * - Вводить путь вручную
 * - Редактировать путь
 * - Копировать путь
 * - Навигация по истории (вперед/назад)
 * - Автодополнение
 * - Подсветка синтаксиса пути
 *
 * Интеграция с Router:
 * - Подписка на изменения маршрута через onRouteChange
 * - Обновление отображения при изменении маршрута
 * - Синхронизация с роутером при навигации
 */
export class LocationBar {
  constructor(app) {
    this.app = app;
    this.router = null;
    this._isEditing = false;
    this._inputElement = null;
    this._displayElement = null;
    this._container = null;
    this._historyNavigation = null;
    this._suggestions = [];
    this._allModules = [];
    this._allFunctions = [];
    this._unsubscribeRouter = null;

    console.log('📍 LocationBar created');
  }

  /**
   * Инициализация адресной строки
   */
  init() {
    // Получаем роутер
    this.router = window[Symbol.for('__AST_ROUTER__')];
    if (!this.router) {
      console.warn('⚠️ Router not available, LocationBar will not work');
      return;
    }

    // Получаем данные для автодополнения
    this._loadData();

    // Создаем DOM-элементы
    this._createElements();

    // Подписываемся на изменения маршрута
    if (this.router.onRouteChange) {
      this._unsubscribeRouter = this.router.onRouteChange(route => {
        console.log('📍 LocationBar: route changed', route);
        this._updateDisplay(route);
        this._updateInput(route);
        this._updateNavButtons();
      });
    }

    // Подписываемся на изменения в приложении
    this._setupAppListeners();

    // Обновляем начальное состояние
    const currentRoute = this.router.getCurrentRoute();
    if (currentRoute) {
      this._updateDisplay(currentRoute);
      this._updateInput(currentRoute);
      this._updateNavButtons();
    }

    // Регистрируем в глобальном доступе
    window[Symbol.for('__AST_LOCATION_BAR__')] = this;

    // Настраиваем клавиатурные сокращения
    this._setupKeyboardShortcuts();

    console.log('✅ LocationBar initialized');
  }

  /**
   * Загрузка данных для автодополнения
   */
  _loadData() {
    const reportData = window[Symbol.for('__AST_INTERACTIVE_REPORT_DATA__')];
    if (!reportData) return;

    // Собираем все модули
    this._allModules = Object.keys(reportData.packages || {}).sort();

    // Собираем все функции
    this._allFunctions = [];
    for (const [modulePath, pkg] of Object.entries(reportData.packages || {})) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func && func.name) {
          this._allFunctions.push({
            name: func.name,
            module: modulePath,
            isExported: func.isExported || false,
          });
        }
      }
    }
    this._allFunctions.sort((a, b) => a.name.localeCompare(b.name));

    console.log(
      `📚 Loaded ${this._allModules.length} modules, ${this._allFunctions.length} functions`
    );
  }

  /**
   * Создание DOM-элементов
   */
  _createElements() {
    // Находим контейнер для breadcrumbs
    const container = document.getElementById('breadcrumbsContainer');
    if (!container) {
      console.warn('⚠️ Breadcrumbs container not found');
      return;
    }

    // Создаем контейнер для адресной строки
    const locationBar = document.createElement('div');
    locationBar.id = 'locationBar';
    locationBar.className = 'location-bar';
    locationBar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #0f172a;
      border-radius: 6px;
      border: 1px solid #1a2a4a;
      margin-bottom: 8px;
      min-height: 34px;
      transition: all 0.2s ease;
      position: relative;
    `;

    // Иконка локации
    const icon = document.createElement('span');
    icon.textContent = '📍';
    icon.style.cssText = `
      font-size: 14px;
      color: #60a5fa;
      flex-shrink: 0;
      opacity: 0.7;
    `;
    locationBar.appendChild(icon);

    // Кнопки навигации
    const navButtons = this._createNavigationButtons();
    locationBar.appendChild(navButtons);

    // Разделитель
    const separator = document.createElement('span');
    separator.textContent = '|';
    separator.style.cssText = `
      color: #1a2a4a;
      font-size: 12px;
      flex-shrink: 0;
    `;
    locationBar.appendChild(separator);

    // Отображение пути (readonly)
    this._displayElement = document.createElement('span');
    this._displayElement.className = 'location-display';
    this._displayElement.style.cssText = `
      flex: 1;
      font-family: 'Fira Code', Consolas, monospace;
      font-size: 13px;
      color: #60a5fa;
      padding: 4px 8px;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      border-radius: 4px;
      transition: all 0.2s ease;
      user-select: none;
    `;
    this._displayElement.textContent = '🌌 Universe';
    this._displayElement.title = '/\nКликните для редактирования (Ctrl+L)';

    this._displayElement.onclick = () => this._startEditing();

    // Добавляем hover эффект
    this._displayElement.onmouseenter = () => {
      this._displayElement.style.background = 'rgba(96, 165, 250, 0.05)';
    };
    this._displayElement.onmouseleave = () => {
      this._displayElement.style.background = 'transparent';
    };

    locationBar.appendChild(this._displayElement);

    // Поле ввода (скрыто по умолчанию)
    this._inputElement = document.createElement('input');
    this._inputElement.className = 'location-input';
    this._inputElement.type = 'text';
    this._inputElement.style.cssText = `
      flex: 1;
      font-family: 'Fira Code', Consolas, monospace;
      font-size: 13px;
      color: #e2e8f0;
      background: #0a0a1a;
      border: 1px solid #22d3ee;
      border-radius: 4px;
      padding: 4px 8px;
      outline: none;
      display: none;
      min-width: 0;
    `;
    this._inputElement.placeholder = 'Введите путь... (Tab - автодополнение)';
    this._inputElement.spellcheck = false;
    this._inputElement.autocomplete = 'off';

    // Обработчики ввода
    this._inputElement.addEventListener('keydown', e => this._handleInputKeydown(e));
    this._inputElement.addEventListener('blur', () => this._finishEditing(false));
    this._inputElement.addEventListener('input', () => this._handleInput());

    locationBar.appendChild(this._inputElement);

    // Кнопка копирования
    const copyBtn = document.createElement('button');
    copyBtn.className = 'location-copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = 'Копировать путь';
    copyBtn.style.cssText = `
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 6px;
      border-radius: 4px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    `;
    copyBtn.onmouseenter = () => {
      copyBtn.style.color = '#60a5fa';
      copyBtn.style.background = 'rgba(96, 165, 250, 0.1)';
    };
    copyBtn.onmouseleave = () => {
      copyBtn.style.color = '#64748b';
      copyBtn.style.background = 'transparent';
    };
    copyBtn.onclick = () => this._copyPath();

    locationBar.appendChild(copyBtn);

    // Кнопка сброса
    const resetBtn = document.createElement('button');
    resetBtn.className = 'location-reset-btn';
    resetBtn.textContent = '✕';
    resetBtn.title = 'Сбросить навигацию';
    resetBtn.style.cssText = `
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 6px;
      border-radius: 4px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    `;
    resetBtn.onmouseenter = () => {
      resetBtn.style.color = '#f87171';
      resetBtn.style.background = 'rgba(248, 113, 113, 0.1)';
    };
    resetBtn.onmouseleave = () => {
      resetBtn.style.color = '#64748b';
      resetBtn.style.background = 'transparent';
    };
    resetBtn.onclick = () => this._resetNavigation();

    locationBar.appendChild(resetBtn);

    // Вставляем перед breadcrumbs
    container.parentNode.insertBefore(locationBar, container);

    this._container = locationBar;

    // Добавляем стили
    this._injectStyles();
  }

  /**
   * Создание кнопок навигации
   */
  _createNavigationButtons() {
    const container = document.createElement('div');
    container.className = 'location-nav-buttons';
    container.style.cssText = `
      display: flex;
      gap: 2px;
      flex-shrink: 0;
    `;

    // Кнопка "Назад"
    const backBtn = document.createElement('button');
    backBtn.className = 'location-nav-btn back';
    backBtn.textContent = '◀';
    backBtn.title = 'Назад (Alt+←)';
    backBtn.style.cssText = `
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 13px;
      padding: 4px 6px;
      border-radius: 4px;
      transition: all 0.2s ease;
      line-height: 1;
    `;
    backBtn.onmouseenter = () => {
      if (!backBtn.disabled) {
        backBtn.style.color = '#60a5fa';
        backBtn.style.background = 'rgba(96, 165, 250, 0.1)';
      }
    };
    backBtn.onmouseleave = () => {
      backBtn.style.color = '#64748b';
      backBtn.style.background = 'transparent';
    };
    backBtn.onclick = () => {
      if (this.router && this.router.canGoBack()) {
        this.router.goBack();
      }
    };

    // Кнопка "Вперед"
    const forwardBtn = document.createElement('button');
    forwardBtn.className = 'location-nav-btn forward';
    forwardBtn.textContent = '▶';
    forwardBtn.title = 'Вперед (Alt+→)';
    forwardBtn.style.cssText = `
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 13px;
      padding: 4px 6px;
      border-radius: 4px;
      transition: all 0.2s ease;
      line-height: 1;
    `;
    forwardBtn.onmouseenter = () => {
      if (!forwardBtn.disabled) {
        forwardBtn.style.color = '#60a5fa';
        forwardBtn.style.background = 'rgba(96, 165, 250, 0.1)';
      }
    };
    forwardBtn.onmouseleave = () => {
      forwardBtn.style.color = '#64748b';
      forwardBtn.style.background = 'transparent';
    };
    forwardBtn.onclick = () => {
      if (this.router && this.router.canGoForward()) {
        this.router.goForward();
      }
    };

    // Кнопка "Домой"
    const homeBtn = document.createElement('button');
    homeBtn.className = 'location-nav-btn home';
    homeBtn.textContent = '🏠';
    homeBtn.title = 'Домой (Alt+Home)';
    homeBtn.style.cssText = `
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 13px;
      padding: 4px 6px;
      border-radius: 4px;
      transition: all 0.2s ease;
      line-height: 1;
    `;
    homeBtn.onmouseenter = () => {
      homeBtn.style.color = '#60a5fa';
      homeBtn.style.background = 'rgba(96, 165, 250, 0.1)';
    };
    homeBtn.onmouseleave = () => {
      homeBtn.style.color = '#64748b';
      homeBtn.style.background = 'transparent';
    };
    homeBtn.onclick = () => {
      if (this.router) {
        this.router.navigateToUniverse();
      }
      if (this.app && this.app.clearFocus) {
        this.app.clearFocus();
      }
    };

    this._historyNavigation = { backBtn, forwardBtn, homeBtn };

    container.appendChild(backBtn);
    container.appendChild(forwardBtn);
    container.appendChild(homeBtn);

    // Обновляем состояние кнопок
    this._updateNavButtons();

    return container;
  }

  /**
   * Обновление состояния кнопок навигации
   */
  _updateNavButtons() {
    if (!this._historyNavigation) return;
    if (!this.router) return;

    const { backBtn, forwardBtn } = this._historyNavigation;

    const canGoBack = this.router.canGoBack();
    const canGoForward = this.router.canGoForward();

    backBtn.style.opacity = canGoBack ? '1' : '0.3';
    backBtn.style.cursor = canGoBack ? 'pointer' : 'default';
    backBtn.disabled = !canGoBack;

    forwardBtn.style.opacity = canGoForward ? '1' : '0.3';
    forwardBtn.style.cursor = canGoForward ? 'pointer' : 'default';
    forwardBtn.disabled = !canGoForward;
  }

  /**
   * Настройка клавиатурных сокращений
   */
  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Ctrl+L - фокус на адресную строку
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        this._startEditing();
      }

      // Escape - выход из режима редактирования
      if (e.key === 'Escape' && this._isEditing) {
        e.preventDefault();
        this._finishEditing(false);
      }
    });
  }

  /**
   * Начало редактирования пути
   */
  _startEditing() {
    if (this._isEditing) return;

    const currentRoute = this.router ? this.router.getCurrentRoute() : null;
    const path = currentRoute ? this.router.getDisplayPath(currentRoute) : '/';

    this._inputElement.value = path;
    this._displayElement.style.display = 'none';
    this._inputElement.style.display = 'block';
    this._isEditing = true;

    // Фокусируемся и выделяем текст
    this._inputElement.focus();
    this._inputElement.select();

    // Добавляем класс для подсветки
    this._container.classList.add('editing');
    this._container.style.borderColor = '#22d3ee';
    this._container.style.boxShadow = '0 0 20px rgba(34, 211, 238, 0.1)';
  }

  /**
   * Завершение редактирования
   */
  _finishEditing(apply = false) {
    if (!this._isEditing) return;

    this._isEditing = false;
    this._inputElement.style.display = 'none';
    this._displayElement.style.display = 'block';
    this._container.classList.remove('editing');
    this._container.style.borderColor = '#1a2a4a';
    this._container.style.boxShadow = 'none';

    if (apply) {
      const value = this._inputElement.value.trim();
      if (value && value !== '/') {
        this._navigateToPath(value);
      } else {
        if (this.router) {
          this.router.navigateToUniverse();
        }
      }
    }

    // Обновляем отображение
    const currentRoute = this.router ? this.router.getCurrentRoute() : null;
    this._updateDisplay(currentRoute);
  }

  /**
   * Обработчик нажатий клавиш в поле ввода
   */
  _handleInputKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this._finishEditing(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._finishEditing(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this._autocomplete();
    }
  }

  /**
   * Обработчик ввода текста (автодополнение)
   */
  _handleInput() {
    const value = this._inputElement.value;
    if (!value || value === '/') {
      this._inputElement.style.borderColor = '#22d3ee';
      // Удаляем старые подсказки
      this._removeSuggestions();
      return;
    }

    // Показываем подсказки
    this._showSuggestions(value);
  }

  /**
   * Удаление подсказок
   */
  _removeSuggestions() {
    const oldSuggestions = document.querySelector('.location-suggestions');
    if (oldSuggestions) {
      oldSuggestions.remove();
    }
  }

  /**
   * Показ подсказок
   */
  _showSuggestions(query) {
    // Удаляем старые подсказки
    this._removeSuggestions();

    if (!query || query.length < 2) return;

    // Поиск совпадений
    const matches = this._findMatches(query);
    if (matches.length === 0) return;

    // Создаем контейнер для подсказок
    const container = document.createElement('div');
    container.className = 'location-suggestions';

    // Добавляем подсказки
    for (const match of matches.slice(0, 10)) {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 6px 12px;
        cursor: pointer;
        font-family: monospace;
        font-size: 12px;
        color: #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      `;
      item.onmouseenter = () => {
        item.style.background = 'rgba(96, 165, 250, 0.1)';
      };
      item.onmouseleave = () => {
        item.style.background = 'transparent';
      };

      if (match.type === 'module') {
        const icon = this._getModuleIcon(match.path);
        item.innerHTML = `
          <span style="color: #60a5fa;">${icon}</span>
          <span>${this._highlightMatch(match.path, query)}</span>
          <span style="color: #64748b; font-size: 10px; margin-left: auto;">📁</span>
        `;
        item.onclick = () => {
          this._inputElement.value = `/module/${match.path}`;
          this._finishEditing(true);
        };
      } else if (match.type === 'function') {
        const exportedIcon = match.isExported ? '📤' : 'ƒ';
        item.innerHTML = `
          <span style="color: #fbbf24;">${exportedIcon}</span>
          <span>${this._highlightMatch(match.name, query)}</span>
          <span style="color: #64748b; font-size: 10px; margin-left: auto;">
            📁${match.module.split('/').pop()}
          </span>
        `;
        item.onclick = () => {
          this._inputElement.value = `/function/${match.module}/${match.name}`;
          this._finishEditing(true);
        };
      }

      container.appendChild(item);
    }

    // Добавляем подсказку по использованию Tab
    const hint = document.createElement('div');
    hint.style.cssText = `
      padding: 4px 12px;
      font-size: 10px;
      color: #64748b;
      border-top: 1px solid #1a2a4a;
      display: flex;
      justify-content: space-between;
    `;
    hint.innerHTML = `
      <span>💡 Нажмите Tab для автодополнения</span>
      <span>${matches.length} совпадений</span>
    `;
    container.appendChild(hint);

    // Позиционируем
    const rect = this._inputElement.getBoundingClientRect();
    container.style.position = 'fixed';
    container.style.top = `${rect.bottom + 4}px`;
    container.style.left = `${rect.left}px`;
    container.style.width = `${rect.width}px`;
    container.style.maxHeight = '200px';
    container.style.overflowY = 'auto';
    container.style.background = '#1e293b';
    container.style.border = '1px solid #334155';
    container.style.borderRadius = '6px';
    container.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
    container.style.zIndex = '1000';

    document.body.appendChild(container);
  }

  /**
   * Поиск совпадений
   */
  _findMatches(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Проверяем, является ли query уже путем
    if (query.startsWith('/')) {
      // Проверяем модули
      for (const modulePath of this._allModules) {
        if (modulePath.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'module',
            path: modulePath,
            priority: modulePath.toLowerCase().startsWith(lowerQuery) ? 1 : 2,
          });
        }
      }

      // Проверяем функции
      for (const func of this._allFunctions) {
        if (func.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'function',
            name: func.name,
            module: func.module,
            isExported: func.isExported,
            priority: func.name.toLowerCase().startsWith(lowerQuery) ? 1 : 2,
          });
        }
      }
    } else {
      // Ищем по имени файла
      for (const modulePath of this._allModules) {
        const fileName = modulePath.split('/').pop() || modulePath;
        if (fileName.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'module',
            path: modulePath,
            displayName: fileName,
            priority: fileName.toLowerCase().startsWith(lowerQuery) ? 1 : 2,
          });
        }
      }

      // Ищем по имени функции
      for (const func of this._allFunctions) {
        if (func.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'function',
            name: func.name,
            module: func.module,
            isExported: func.isExported,
            priority: func.name.toLowerCase().startsWith(lowerQuery) ? 1 : 2,
          });
        }
      }
    }

    // Сортировка по приоритету
    results.sort((a, b) => (a.priority || 3) - (b.priority || 3));

    return results;
  }

  /**
   * Автодополнение
   */
  _autocomplete() {
    const value = this._inputElement.value;
    if (!value || value === '/') return;

    const matches = this._findMatches(value);
    if (matches.length === 0) return;

    // Берем первое совпадение
    const match = matches[0];
    let newValue = value;

    if (match.type === 'module') {
      newValue = `/module/${match.path}`;
    } else if (match.type === 'function') {
      newValue = `/function/${match.module}/${match.name}`;
    }

    if (newValue !== value) {
      this._inputElement.value = newValue;
      this._inputElement.style.borderColor = '#4ade80';
      setTimeout(() => {
        this._inputElement.style.borderColor = '#22d3ee';
      }, 500);
      // Удаляем подсказки после автодополнения
      this._removeSuggestions();
    }
  }

  /**
   * Подсветка совпадения
   */
  _highlightMatch(text, query) {
    if (!query || !text) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;

    return (
      text.substring(0, index) +
      `<span style="color: #22d3ee; font-weight: bold;">${text.substring(index, index + query.length)}</span>` +
      text.substring(index + query.length)
    );
  }

  /**
   * Получение иконки для модуля
   */
  _getModuleIcon(modulePath) {
    if (!modulePath) return '📄';
    if (modulePath.endsWith('.vue')) return '🎯';
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) return '⚛️';
    if (modulePath.endsWith('.ts')) return '📘';
    if (modulePath.endsWith('.js')) return '📄';
    if (modulePath.endsWith('.json')) return '📋';
    if (modulePath.endsWith('.css') || modulePath.endsWith('.scss')) return '🎨';
    return '📁';
  }

  /**
   * Навигация по введенному пути
   */
  _navigateToPath(path) {
    if (!path || !this.router) return;

    // Проверяем различные форматы
    if (path.startsWith('/module/')) {
      const modulePath = path.substring(8);
      this.router.navigateToModule(modulePath);
      return;
    }

    if (path.startsWith('/function/')) {
      const parts = path.substring(10).split('/');
      if (parts.length >= 2) {
        const modulePath = parts.slice(0, -1).join('/');
        const funcName = parts[parts.length - 1];
        this.router.navigateToFunction(modulePath, funcName);
        return;
      }
    }

    if (path.startsWith('/search/')) {
      const query = path.substring(8);
      this.router.navigateToSearch(query);
      return;
    }

    // Если просто имя файла или функции
    if (!path.startsWith('/')) {
      // Ищем модуль
      const moduleMatch = this._allModules.find(
        m => m.includes(path) || m.split('/').pop() === path
      );
      if (moduleMatch) {
        this.router.navigateToModule(moduleMatch);
        return;
      }

      // Ищем функцию
      const funcMatch = this._allFunctions.find(f => f.name === path);
      if (funcMatch) {
        this.router.navigateToFunction(funcMatch.module, funcMatch.name);
        return;
      }
    }

    // Если ничего не найдено - идем в Universe
    console.warn(`⚠️ Unknown path: ${path}`);
    this.router.navigateToUniverse();
  }

  /**
   * Копирование пути
   */
  _copyPath() {
    const currentRoute = this.router ? this.router.getCurrentRoute() : null;
    if (!currentRoute) return;

    const path = this.router.getDisplayPath(currentRoute);
    const fullUrl = window.location.origin + window.location.pathname + '#' + path;

    navigator.clipboard
      .writeText(fullUrl)
      .then(() => {
        // Показываем уведомление
        const btn = this._container.querySelector('.location-copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅';
        btn.style.color = '#4ade80';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.color = '#64748b';
        }, 1500);
      })
      .catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = fullUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      });
  }

  /**
   * Сброс навигации
   */
  _resetNavigation() {
    if (this.router) {
      this.router.navigateToUniverse();
    }
    if (this.app && this.app.clearFocus) {
      this.app.clearFocus();
    }
  }

  /**
   * Обновление отображения
   */
  _updateDisplay(route) {
    if (!this._displayElement) return;

    if (!route) {
      this._displayElement.textContent = '🌌 Universe';
      this._displayElement.title = '/\nКликните для редактирования (Ctrl+L)';
      this._displayElement.style.color = '#60a5fa';
      return;
    }

    const path = this.router ? this.router.getDisplayPath(route) : '/';
    const shortPath = this.router ? this.router.getShortPath(route) : '🌌 Universe';

    this._displayElement.textContent = shortPath;
    this._displayElement.title = path + '\nКликните для редактирования (Ctrl+L)';

    // Обновляем цвет в зависимости от типа маршрута
    if (route.name) {
      switch (route.name) {
        case 'universe':
          this._displayElement.style.color = '#60a5fa';
          break;
        case 'module':
          this._displayElement.style.color = '#60a5fa';
          break;
        case 'function':
          this._displayElement.style.color = '#fbbf24';
          break;
        case 'search':
          this._displayElement.style.color = '#22d3ee';
          break;
        default:
          this._displayElement.style.color = '#94a3b8';
      }
    }

    // Обновляем кнопки навигации
    this._updateNavButtons();
  }

  /**
   * Обновление поля ввода
   */
  _updateInput(route) {
    if (this._isEditing) return;
    const path = route && this.router ? this.router.getDisplayPath(route) : '/';
    this._inputElement.value = path;
  }

  /**
   * Настройка слушателей приложения
   */
  _setupAppListeners() {
    if (!this.app) return;

    // Сохраняем ссылку на себя
    const self = this;

    // Обертываем методы App для синхронизации с роутером
    const originalFocusModule = this.app.focusModule;
    const originalFocusFunction = this.app.focusFunction;
    const originalClearFocus = this.app.clearFocus;
    const originalHandleSearch = this.app.handleSearch;

    this.app.focusModule = function (modulePath) {
      originalFocusModule.call(this, modulePath);
      if (self.router) {
        self.router.navigateToModule(modulePath);
      }
    };

    this.app.focusFunction = function (funcName, modulePath) {
      originalFocusFunction.call(this, funcName, modulePath);
      if (self.router) {
        self.router.navigateToFunction(modulePath, funcName);
      }
    };

    this.app.clearFocus = function () {
      originalClearFocus.call(this);
      if (self.router) {
        self.router.navigateToUniverse();
      }
    };

    this.app.handleSearch = function (query) {
      originalHandleSearch.call(this, query);
      if (query && query.trim()) {
        if (self.router) {
          self.router.navigateToSearch(query);
        }
      } else {
        if (self.router) {
          self.router.navigateToUniverse();
        }
      }
    };

    // Обновляем данные при изменении фокуса
    const originalRenderModules = this.app.renderModules;
    this.app.renderModules = function () {
      originalRenderModules.call(this);
      self._updateData();
    };
  }

  /**
   * Обновление данных
   */
  _updateData() {
    const reportData = window[Symbol.for('__AST_INTERACTIVE_REPORT_DATA__')];
    if (!reportData) return;

    // Обновляем списки
    this._allModules = Object.keys(reportData.packages || {}).sort();

    this._allFunctions = [];
    for (const [modulePath, pkg] of Object.entries(reportData.packages || {})) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func && func.name) {
          this._allFunctions.push({
            name: func.name,
            module: modulePath,
            isExported: func.isExported || false,
          });
        }
      }
    }
    this._allFunctions.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Инъекция стилей
   */
  _injectStyles() {
    const styleId = 'location-bar-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      <style id="${styleId}">
        .location-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #0f172a;
          border-radius: 6px;
          border: 1px solid #1a2a4a;
          margin-bottom: 8px;
          min-height: 34px;
          transition: all 0.2s ease;
          position: relative;
        }

        .location-bar:hover {
          border-color: #2a3a5a;
        }

        .location-bar.editing {
          border-color: #22d3ee;
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.1);
        }

        .location-display {
          flex: 1;
          font-family: 'Fira Code', Consolas, monospace;
          font-size: 13px;
          color: #60a5fa;
          padding: 4px 8px;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          border-radius: 4px;
          transition: all 0.2s ease;
          user-select: none;
        }

        .location-display:hover {
          background: rgba(96, 165, 250, 0.05);
        }

        .location-input {
          flex: 1;
          font-family: 'Fira Code', Consolas, monospace;
          font-size: 13px;
          color: #e2e8f0;
          background: #0a0a1a;
          border: 1px solid #22d3ee;
          border-radius: 4px;
          padding: 4px 8px;
          outline: none;
          min-width: 0;
        }

        .location-input:focus {
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.1);
        }

        .location-nav-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 13px;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.2s ease;
          line-height: 1;
        }

        .location-nav-btn:hover:not(:disabled) {
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.1);
        }

        .location-nav-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        .location-copy-btn,
        .location-reset-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 14px;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .location-copy-btn:hover {
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.1);
        }

        .location-reset-btn:hover {
          color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        .location-suggestions {
          position: fixed;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          margin-top: 4px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          min-width: 200px;
        }

        .location-suggestions::-webkit-scrollbar {
          width: 4px;
        }

        .location-suggestions::-webkit-scrollbar-track {
          background: transparent;
        }

        .location-suggestions::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 4px;
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Получение текущего пути
   */
  getCurrentPath() {
    const route = this.router ? this.router.getCurrentRoute() : null;
    return route ? this.router.getDisplayPath(route) : '/';
  }

  /**
   * Получение текущего маршрута в читаемом виде
   */
  getCurrentDisplay() {
    const route = this.router ? this.router.getCurrentRoute() : null;
    return route ? this.router.getShortPath(route) : '🌌 Universe';
  }

  /**
   * Очистка
   */
  dispose() {
    if (this._unsubscribeRouter) {
      this._unsubscribeRouter();
      this._unsubscribeRouter = null;
    }
    if (this._container) {
      this._container.remove();
    }
    this._removeSuggestions();
  }
}

export default LocationBar;
