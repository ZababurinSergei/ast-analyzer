// packages/ast-analyzer/src/reporters/templates/modules/CardManager.js

/**
 * CardManager - управление карточками модулей и функций
 * Отвечает за рендеринг, навигацию и отображение деталей
 */
export class CardManager {
  constructor(app) {
    this.app = app;
    this.currentFocusModule = null;
    this.currentFocusFunction = null;
    this.navigationStack = [];

    // ✅ СРАЗУ ПОЛУЧАЕМ ГОТОВЫЙ ГЛОБАЛЬНЫЙ API
    this._api = window[Symbol.for('__AST_APP_API__')];
    console.log('📡 CardManager API получен:', this._api ? '✅' : '❌');

    // Если API еще не готов, ждем его
    if (!this._api) {
      console.log('⏳ Ожидание API в CardManager...');
      const checkApi = setInterval(() => {
        this._api = window[Symbol.for('__AST_APP_API__')];
        if (this._api) {
          clearInterval(checkApi);
          console.log('✅ API получен в CardManager');
          this._bindMethods();
          this.renderModules();
        }
      }, 100);

      setTimeout(() => {
        if (!this._api) {
          clearInterval(checkApi);
          console.warn('⚠️ API не получен в CardManager, использую fallback');
          this._api = {
            focusModule: () => console.warn('⚠️ focusModule fallback'),
            focusFunction: () => console.warn('⚠️ focusFunction fallback'),
            clearFocus: () => console.warn('⚠️ clearFocus fallback'),
            closeDetail: () => console.warn('⚠️ closeDetail fallback'),
            renderModules: () => console.warn('⚠️ renderModules fallback'),
          };
          this._bindMethods();
          this.renderModules();
        }
      }, 3000);
    } else {
      this._bindMethods();
      // Если API уже готов, инициализируем сразу
      if (this._api && typeof this._api.renderModules === 'function') {
        this.renderModules();
      }
    }
  }

  /**
   * ✅ СВЯЗЫВАНИЕ МЕТОДОВ С ГОТОВЫМ API
   */
  _bindMethods() {
    const api = this._api;

    this._focusModule = path => {
      if (api && typeof api.focusModule === 'function') {
        console.log('🎯 CardManager: focusModule called', path);
        return api.focusModule(path);
      }
      console.warn('⚠️ focusModule not available in CardManager');
    };

    this._focusFunction = (name, module) => {
      if (api && typeof api.focusFunction === 'function') {
        console.log('🎯 CardManager: focusFunction called', name, module);
        return api.focusFunction(name, module);
      }
      console.warn('⚠️ focusFunction not available in CardManager');
    };

    this._clearFocus = () => {
      if (api && typeof api.clearFocus === 'function') {
        console.log('🧹 CardManager: clearFocus called');
        return api.clearFocus();
      }
      console.warn('⚠️ clearFocus not available in CardManager');
    };

    this._closeDetail = () => {
      if (api && typeof api.closeDetail === 'function') {
        return api.closeDetail();
      }
      console.warn('⚠️ closeDetail not available in CardManager');
    };

    this._renderModules = () => {
      if (api && typeof api.renderModules === 'function') {
        return api.renderModules();
      }
      console.warn('⚠️ renderModules not available in CardManager');
    };
  }

  /**
   * Инициализация менеджера карточек
   */
  init() {
    // Методы уже привязаны в конструкторе
    // Перепривязываем на случай если API обновился
    this._api = window[Symbol.for('__AST_APP_API__')];
    this._bindMethods();
    this.renderModules();
  }

  /**
   * Получает уровень вложенности модуля
   */
  getModuleLevel(modulePath) {
    const reportData = this.app.reportData;
    if (!reportData) return 0;

    // Проверяем, есть ли уровень в architectureMetrics
    if (reportData.architectureMetrics?.modulesByLevel) {
      const levels = reportData.architectureMetrics.modulesByLevel;
      for (const [level, modules] of Object.entries(levels)) {
        if (modules.includes(modulePath)) {
          return parseInt(level, 10);
        }
      }
    }

    // Если уровень не найден, вычисляем по графу зависимостей
    const levels = reportData.levels || {};
    return levels[modulePath] !== undefined ? levels[modulePath] : 0;
  }

  /**
   * Рендерит все карточки модулей
   */
  renderModules() {
    const grid = document.getElementById('modulesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) return;

    const moduleEntries = Object.entries(reportData.packages);
    const focusModule = this.app.focusModule;
    const focusFunction = this.app.focusFunction;
    const searchQuery = this.app.searchQuery || '';

    // ✅ Фильтруем модули
    let filteredEntries = moduleEntries;

    // 1. Фильтр по фокусу
    if (focusModule) {
      const deps = reportData.dependencyGraph?.outwardDependencies?.[focusModule] || [];
      const dependents = reportData.dependencyGraph?.inwardDependencies?.[focusModule] || [];
      const relatedModules = new Set([focusModule, ...deps, ...dependents]);
      filteredEntries = filteredEntries.filter(([path]) => relatedModules.has(path));
    }

    // 2. Фильтр по поиску
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredEntries = filteredEntries.filter(([modulePath, pkg]) => {
        // Проверяем имя модуля
        if (modulePath.toLowerCase().includes(query)) return true;
        // Проверяем функции в модуле
        const funcs = pkg.entities?.functions || [];
        return funcs.some(f => f.name.toLowerCase().includes(query));
      });
    }

    // Сортировка по уровню вложенности (сначала корневые)
    filteredEntries.sort((a, b) => {
      const levelA = this.getModuleLevel(a[0]);
      const levelB = this.getModuleLevel(b[0]);
      return levelA - levelB;
    });

    for (const [modulePath, pkg] of filteredEntries) {
      if (!pkg) continue;

      const moduleCard = document.createElement('div');
      moduleCard.className = 'module-card';
      moduleCard.dataset.module = modulePath;

      // Подсветка активного модуля
      if (focusModule === modulePath) {
        moduleCard.classList.add('active');
      }

      moduleCard.onclick = () => this._focusModule(modulePath);

      const funcs = pkg.entities?.functions || [];
      const isEntry = pkg.isEntry || false;
      const displayName = pkg.displayPath || modulePath.split('/').pop() || modulePath;
      const language = pkg.language || 'javascript';
      const lines = pkg.fileStats?.lines || 0;

      // Получаем уровень вложенности
      const level = this.getModuleLevel(modulePath);
      const levelDisplay = level === 0 ? '🌌' : `📁 L${level}`;
      const levelClass = `level-${Math.min(level, 5)}`;

      // Собираем все вызовы и вызывающих
      const allCalls = new Map();
      const allCallers = new Map();

      for (const func of funcs) {
        if (!func || !func.name) continue;
        for (const call of func.calls || []) {
          if (!allCalls.has(call)) {
            allCalls.set(call, []);
          }
          allCalls.get(call).push(func.name);
        }
        for (const caller of func.calledBy || []) {
          if (!allCallers.has(func.name)) {
            allCallers.set(func.name, []);
          }
          allCallers.get(func.name).push(caller);
        }
      }

      let funcsHtml = '';
      for (const func of funcs) {
        if (!func || !func.name) continue;
        const funcName = this.app.escapeHtml(func.name);
        const modulePathEscaped = this.app.escapeHtml(modulePath);
        const paramsStr = (func.params || []).map(p => this.app.escapeHtml(p)).join(', ');
        const callsStr = (func.calls || [])
          .slice(0, 3)
          .map(c => this.app.escapeHtml(c))
          .join(', ');
        const isExported = func.isExported || false;
        const isAsync = func.isAsync || false;
        const lineNum = func.line || 0;

        // ✅ ИСПОЛЬЗУЕМ БЕЗОПАСНЫЙ МЕТОД
        const onclickAttr = `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(func.name)}', '${this.app.escapeJs(modulePath)}')"`;

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

      // Навигационные кнопки
      let navHtml = '';
      const moduleCalls = Array.from(allCalls.keys()).filter(c => funcs.some(f => f.name === c));
      const moduleCallers = Array.from(allCallers.keys()).filter(c =>
        funcs.some(f => f.name === c)
      );

      if (moduleCalls.length > 0) {
        navHtml += `<div class="nav-section"><span class="nav-label">📤 Выходы (вызовы):</span>`;
        for (const call of moduleCalls.slice(0, 5)) {
          navHtml += `<button class="nav-btn" onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(call)}', '${this.app.escapeJs(modulePath)}')">${this.app.escapeHtml(call)}</button>`;
        }
        if (moduleCalls.length > 5) {
          navHtml += `<span class="nav-more">+${moduleCalls.length - 5}</span>`;
        }
        navHtml += `</div>`;
      }

      if (moduleCallers.length > 0) {
        navHtml += `<div class="nav-section"><span class="nav-label">📥 Входы (кто вызывает):</span>`;
        for (const caller of moduleCallers.slice(0, 5)) {
          navHtml += `<button class="nav-btn" onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(caller)}', '${this.app.escapeJs(modulePath)}')">${this.app.escapeHtml(caller)}</button>`;
        }
        if (moduleCallers.length > 5) {
          navHtml += `<span class="nav-more">+${moduleCallers.length - 5}</span>`;
        }
        navHtml += `</div>`;
      }

      // Добавляем отображение уровня в карточке
      moduleCard.innerHTML = `
        <div class="header-row">
          <div>
            <div class="name ${levelClass}">
              ${isEntry ? '⭐ ' : ''}${this.app.escapeHtml(displayName)}
              <span class="level-badge">
                ${levelDisplay}
              </span>
            </div>
            <div class="path">${this.app.escapeHtml(modulePath)}</div>
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
            <span class="badge lang">${this.app.escapeHtml(language)}</span>
            ${isEntry ? '<span class="badge export">⭐ entry</span>' : ''}
            <span class="badge lines">${lines} строк</span>
            <span class="badge level ${levelClass}">${levelDisplay}</span>
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
        ${navHtml}
      `;
      grid.appendChild(moduleCard);
    }
  }

  /**
   * Устанавливает фокус на модуль
   * @param {string} modulePath - Путь к модулю
   */
  focusModule(modulePath) {
    if (this.currentFocusModule === modulePath) {
      this.clearFocus();
      return;
    }
    this.currentFocusModule = modulePath;
    this.currentFocusFunction = null;
    this.updateNavigationStack(modulePath, null);
    this.app.updateBreadcrumbs(modulePath, null);
    this.app.updateView();

    document.querySelectorAll('.module-card').forEach(c => {
      c.classList.toggle('active', c.dataset.module === modulePath);
    });

    const info = document.getElementById('focusInfo');
    if (info) {
      info.classList.add('active');
      const pkg = this.app.reportData?.packages?.[modulePath];
      const displayName = pkg?.displayPath || modulePath.split('/').pop() || modulePath;
      const level = this.getModuleLevel(modulePath);
      const levelDisplay = level === 0 ? '🌌' : `L${level}`;
      document.getElementById('focusTitle').textContent =
        `🎯 Фокус: ${displayName} (${levelDisplay})`;
      if (pkg) {
        const funcs = pkg.entities?.functions || [];
        document.getElementById('focusDetails').textContent =
          'Функций: ' +
          funcs.length +
          ' | Экспортов: ' +
          (pkg.exports ? Object.keys(pkg.exports).length : 0) +
          ' | Уровень: ' +
          levelDisplay;
      }
    }

    const card = document.querySelector(`.module-card[data-module="${modulePath}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Устанавливает фокус на функцию
   * @param {string} funcName - Имя функции
   * @param {string} modulePath - Путь к модулю
   */
  focusFunction(funcName, modulePath) {
    if (this.currentFocusFunction === funcName && this.currentFocusModule === modulePath) {
      this.clearFocus();
      return;
    }
    this.currentFocusFunction = funcName;
    this.currentFocusModule = modulePath;
    this.updateNavigationStack(modulePath, funcName);
    this.app.updateBreadcrumbs(modulePath, funcName);
    this.app.updateView();

    document.querySelectorAll('.module-card').forEach(c => {
      c.classList.toggle('active', c.dataset.module === modulePath);
    });
    document.querySelectorAll('.func-item').forEach(el => {
      const isActive = el.dataset.func === funcName && el.dataset.module === modulePath;
      el.classList.toggle('active', isActive);
    });

    // ✅ ПОЛУЧАЕМ ДАННЫЕ ФУНКЦИИ ДО БЛОКА if
    let funcData = null;
    const graphNodes = this.app.graphManager?.getGraphNodes() || [];
    for (const node of graphNodes) {
      if (node.type === 'function' && node.name === funcName && node.module === modulePath) {
        funcData = node;
        break;
      }
    }

    const info = document.getElementById('focusInfo');
    if (info) {
      info.classList.add('active');
      const level = this.getModuleLevel(modulePath);
      const levelDisplay = level === 0 ? '🌌' : `L${level}`;
      document.getElementById('focusTitle').textContent =
        `🎯 Функция: ${funcName} (${levelDisplay})`;

      if (funcData) {
        const displayName = modulePath.split('/').pop() || modulePath;
        document.getElementById('focusDetails').textContent =
          'Модуль: ' +
          displayName +
          ' | Параметры: ' +
          ((funcData.params || []).join(', ') || 'нет') +
          ' | Вызовов: ' +
          (funcData.calls || []).length +
          ' | Кем вызвана: ' +
          (funcData.calledBy || []).length +
          ' | Уровень: ' +
          levelDisplay;
      } else {
        document.getElementById('focusDetails').textContent =
          'Модуль: ' + (modulePath.split('/').pop() || modulePath) + ' | Уровень: ' + levelDisplay;
      }
    }

    this.showDetail(funcData || { name: funcName, module: modulePath });

    const el = document.querySelector(
      `.func-item[data-func="${funcName}"][data-module="${modulePath}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Обновляет стек навигации
   * @param {string} modulePath - Путь к модулю
   * @param {string|null} funcName - Имя функции
   */
  updateNavigationStack(modulePath, funcName) {
    const key = funcName ? `${modulePath}#${funcName}` : modulePath;
    if (
      this.navigationStack.length === 0 ||
      this.navigationStack[this.navigationStack.length - 1] !== key
    ) {
      this.navigationStack.push(key);
    }
    if (this.navigationStack.length > 50) {
      this.navigationStack.shift();
    }
  }

  /**
   * Сбрасывает фокус (возврат к полному обзору)
   */
  clearFocus() {
    this.currentFocusModule = null;
    this.currentFocusFunction = null;
    this.navigationStack = [];

    const info = document.getElementById('focusInfo');
    if (info) {
      info.classList.remove('active');
    }
    document.querySelectorAll('.module-card').forEach(c => {
      c.classList.remove('active');
    });
    document.querySelectorAll('.func-item').forEach(el => {
      el.classList.remove('active');
    });

    this.closeDetail();
    this.app.graphManager?.updateView();

    // Обновляем breadcrumbs до состояния Universe
    this.app.breadcrumbManager?.updateBreadcrumbs(null, null);
  }

  /**
   * Показывает детали функции в панели
   * @param {Object} data - Данные функции
   */
  showDetail(data) {
    const panel = document.getElementById('detailPanel');
    if (!panel) return;

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

    // Добавляем уровень вложенности в детали
    if (data.module) {
      const level = this.getModuleLevel(data.module);
      const levelDisplay = level === 0 ? '🌌' : `L${level}`;
      html += `<div class="item"><span class="label">Уровень:</span> ${levelDisplay}</div>`;
    }

    html += '</div>';

    const params = data.params || [];
    if (params.length > 0) {
      html += '<div class="dp-section"><h4>Параметры</h4>';
      for (const p of params) {
        html += '<div class="item">' + this.app.escapeHtml(p) + '</div>';
      }
      html += '</div>';
    }

    const calls = data.calls || [];
    if (calls.length > 0) {
      html += '<div class="dp-section"><h4>📞 Вызовы (кто вызывается)</h4>';
      for (const call of calls) {
        html += `<div class="item" style="cursor:pointer;color:#f59e0b;" onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(call)}', '${this.app.escapeJs(data.module || '')}')">→ ${this.app.escapeHtml(call)}</div>`;
      }
      html += '</div>';
    }

    const calledBy = data.calledBy || [];
    if (calledBy.length > 0) {
      html += '<div class="dp-section"><h4>📥 Кто вызывает</h4>';
      for (const caller of calledBy) {
        html += `<div class="item" style="cursor:pointer;color:#3b82f6;" onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(caller)}', '${this.app.escapeJs(data.module || '')}')">← ${this.app.escapeHtml(caller)}</div>`;
      }
      html += '</div>';
    }

    if (data.body) {
      const bodyPreview = data.body.length > 200 ? data.body.substring(0, 200) + '...' : data.body;
      html += '<div class="dp-section"><h4>Тело (сокращённо)</h4>';
      html += `<div class="item" style="font-size:10px;color:#94a3b8;white-space:pre-wrap;background:#0f172a;padding:8px;border-radius:4px;">${this.app.escapeHtml(bodyPreview)}</div>`;
      html += '</div>';
    }

    document.getElementById('dpContent').innerHTML = html;
    panel.classList.add('active');
  }

  /**
   * Закрывает панель деталей
   */
  closeDetail() {
    const panel = document.getElementById('detailPanel');
    if (panel) {
      panel.classList.remove('active');
    }
  }

  /**
   * Возвращает текущий модуль в фокусе
   * @returns {string|null}
   */
  getFocusModule() {
    return this.currentFocusModule;
  }

  /**
   * Возвращает текущую функцию в фокусе
   * @returns {string|null}
   */
  getFocusFunction() {
    return this.currentFocusFunction;
  }

  /**
   * Возвращает стек навигации
   * @returns {Array}
   */
  getNavigationStack() {
    return this.navigationStack;
  }
}
