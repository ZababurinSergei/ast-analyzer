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

    // ✅ ХРАНИМ ССЫЛКУ НА ГЛОБАЛЬНЫЙ API
    this._api = null;
    this._methodsBound = false;

    console.log('📊 CardManager created');
  }

  /**
   * Инициализация менеджера карточек
   */
  init() {
    console.log('🔄 CardManager.init() called');

    this._api = window[Symbol.for('__AST_APP_API__')];
    console.log('📡 CardManager API получен:', this._api ? '✅' : '❌');

    if (this._api && typeof this._api.focusFunction === 'function') {
      console.log('✅ API готов в CardManager');
      this._bindMethods();
      this.renderModules();
      return;
    }

    console.log('⏳ Ожидание API в CardManager...');
    let attempts = 0;
    const maxAttempts = 30;

    const checkApi = setInterval(() => {
      attempts++;
      this._api = window[Symbol.for('__AST_APP_API__')];

      if (this._api && typeof this._api.focusFunction === 'function') {
        clearInterval(checkApi);
        console.log(`✅ API получен в CardManager после ${attempts} попыток`);
        this._bindMethods();
        this.renderModules();
        return;
      }

      if (attempts >= maxAttempts) {
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
    }, 100);
  }

  /**
   * ✅ СВЯЗЫВАНИЕ МЕТОДОВ С ГОТОВЫМ API
   */
  _bindMethods() {
    console.log('🔄 CardManager._bindMethods() called');

    const api = this._api || window[Symbol.for('__AST_APP_API__')];

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

    this._methodsBound = true;
  }

  /**
   * Получает уровень вложенности модуля
   */
  getModuleLevel(modulePath) {
    const reportData = this.app.reportData;
    if (!reportData) return 0;

    if (reportData.architectureMetrics?.modulesByLevel) {
      const levels = reportData.architectureMetrics.modulesByLevel;
      for (const [level, modules] of Object.entries(levels)) {
        if (modules.includes(modulePath)) {
          return parseInt(level, 10);
        }
      }
    }

    const levels = reportData.levels || {};
    return levels[modulePath] !== undefined ? levels[modulePath] : 0;
  }

  /**
   * ✅ НАХОДИТ МОДУЛЬ ПО ИМЕНИ ФУНКЦИИ
   */
  findModuleForFunction(funcName) {
    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) return null;

    for (const [modulePath, pkg] of Object.entries(reportData.packages)) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func.name === funcName) {
          return modulePath;
        }
      }
    }
    return null;
  }

  /**
   * ✅ НАХОДИТ ФУНКЦИЮ ПО ИМЕНИ
   */
  findFunctionByName(funcName) {
    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) return null;

    for (const [modulePath, pkg] of Object.entries(reportData.packages)) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func.name === funcName) {
          return { ...func, module: modulePath };
        }
      }
    }
    return null;
  }

  /**
   * ✅ РЕНДЕРИТ КАРТОЧКИ МОДУЛЕЙ
   */
  renderModules() {
    const grid = document.getElementById('modulesGrid');
    if (!grid) {
      console.warn('⚠️ modulesGrid not found');
      return;
    }

    grid.innerHTML = '';

    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
          <div style="font-size: 32px; margin-bottom: 10px;">📭</div>
          <p>Нет данных для отображения</p>
        </div>
      `;
      return;
    }

    const focusModule = this.app._focusModule;
    const focusFunction = this.app._focusFunction;
    const searchQuery = this.app.searchQuery || '';

    console.log('🔄 Render modules:', {
      focusModule,
      focusFunction,
      searchQuery,
      totalModules: Object.keys(reportData.packages).length,
    });

    let moduleEntries = Object.entries(reportData.packages);

    // ✅ ЕСЛИ ЕСТЬ АКТИВНЫЙ МОДУЛЬ - ПОКАЗЫВАЕМ ТОЛЬКО ЕГО
    if (focusModule) {
      moduleEntries = moduleEntries.filter(([path]) => path === focusModule);

      if (moduleEntries.length === 0) {
        console.warn('⚠️ Focus module not found, showing all');
        moduleEntries = Object.entries(reportData.packages);
      } else {
        console.log('🎯 Showing single module:', focusModule);
      }
    }

    // ✅ ФИЛЬТР ПО ПОИСКУ
    if (!focusModule && searchQuery) {
      const query = searchQuery.toLowerCase();
      moduleEntries = moduleEntries.filter(([modulePath, pkg]) => {
        if (modulePath.toLowerCase().includes(query)) return true;
        const funcs = pkg.entities?.functions || [];
        return funcs.some(f => f.name.toLowerCase().includes(query));
      });
    }

    // Сортировка по уровню вложенности
    moduleEntries.sort((a, b) => {
      const levelA = this.getModuleLevel(a[0]);
      const levelB = this.getModuleLevel(b[0]);
      return levelA - levelB;
    });

    if (moduleEntries.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
          <div style="font-size: 32px; margin-bottom: 10px;">🔍</div>
          <p>Ничего не найдено${searchQuery ? ` по запросу "${searchQuery}"` : ''}</p>
        </div>
      `;
      return;
    }

    // ✅ РЕНДЕРИМ КАЖДЫЙ МОДУЛЬ
    for (const [modulePath, pkg] of moduleEntries) {
      if (!pkg) continue;

      const isActive = focusModule === modulePath;
      const moduleCard = this.createModuleCard(modulePath, pkg, isActive, focusFunction);
      grid.appendChild(moduleCard);
    }
  }

  /**
   * ✅ СОЗДАЕТ КАРТОЧКУ МОДУЛЯ С ПОЛНОЙ НАВИГАЦИЕЙ
   */
  createModuleCard(modulePath, pkg, isActive, focusFunction) {
    const moduleCard = document.createElement('div');
    moduleCard.className = `module-card ${isActive ? 'active' : ''}`;
    moduleCard.dataset.module = modulePath;

    if (!isActive) {
      moduleCard.onclick = () => this._focusModule(modulePath);
    }

    const funcs = pkg.entities?.functions || [];
    const isEntry = pkg.isEntry || false;
    const displayName = pkg.displayPath || modulePath.split('/').pop() || modulePath;
    const language = pkg.language || 'javascript';
    const lines = pkg.fileStats?.lines || 0;

    const level = this.getModuleLevel(modulePath);
    const levelDisplay = level === 0 ? '🌌' : `📁 L${level}`;
    const levelClass = `level-${Math.min(level, 5)}`;

    // Статистика модуля
    const totalFuncs = funcs.length;
    const totalClasses = pkg.entities?.classes?.length || 0;
    const totalConstants = pkg.entities?.constants?.length || 0;
    const totalInterfaces = pkg.entities?.interfaces?.length || 0;
    const totalTypes = pkg.entities?.types?.length || 0;
    const totalVariables = pkg.entities?.variables?.length || 0;

    // ✅ СБОР ВСЕХ ВЫЗОВОВ И ВХОДОВ
    const allCalls = new Map(); // функция -> кто ее вызывает
    const allCallers = new Map(); // функция -> кого она вызывает

    // Собираем информацию по всем функциям в модуле
    for (const func of funcs) {
      if (!func || !func.name) continue;

      // Кого вызывает эта функция (исходящие)
      for (const call of func.calls || []) {
        if (!allCalls.has(call)) {
          allCalls.set(call, []);
        }
        allCalls.get(call).push(func.name);
      }

      // Кто вызывает эту функцию (входящие)
      for (const caller of func.calledBy || []) {
        if (!allCallers.has(func.name)) {
          allCallers.set(func.name, []);
        }
        allCallers.get(func.name).push(caller);
      }
    }

    // ✅ ФУНКЦИИ HTML
    let funcsHtml = '';
    const displayFuncs = isActive ? funcs : funcs.slice(0, 10);
    const hasMore = funcs.length > 10 && !isActive;

    for (const func of displayFuncs) {
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
      const isActiveFunc = focusFunction === func.name && isActive;

      const onclickAttr = `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(func.name)}', '${this.app.escapeJs(modulePath)}')"`;

      funcsHtml += `
        <div class="func-item ${isActiveFunc ? 'active' : ''}" 
             ${onclickAttr} 
             data-func="${funcName}" 
             data-module="${modulePathEscaped}">
          <span class="func-name">${funcName}</span>
          ${isExported ? '<span class="func-export">📤</span>' : ''}
          ${isAsync ? '<span class="func-async">⚡</span>' : ''}
          ${func.params && func.params.length > 0 ? `<span class="func-params">(${paramsStr})</span>` : ''}
          ${func.calls && func.calls.length > 0 ? `<span class="func-calls">→ ${callsStr}${func.calls.length > 3 ? '...' : ''}</span>` : ''}
          ${func.calledBy && func.calledBy.length > 0 ? `<span class="func-called">← ${func.calledBy.length}</span>` : ''}
          <span class="func-line">стр.${lineNum}</span>
        </div>
      `;
    }

    // ✅ НАВИГАЦИОННЫЕ КНОПКИ - ВСЕ ВХОДЫ И ВЫХОДЫ
    let navHtml = '';

    // 1. Исходящие вызовы (кто вызывается из этого модуля)
    const outgoingCalls = new Set();
    for (const func of funcs) {
      for (const call of func.calls || []) {
        outgoingCalls.add(call);
      }
    }

    // 2. Входящие вызовы (кто вызывает этот модуль)
    const incomingCalls = new Set();
    for (const func of funcs) {
      for (const caller of func.calledBy || []) {
        incomingCalls.add(caller);
      }
    }

    // ✅ КНОПКИ ДЛЯ ИСХОДЯЩИХ ВЫЗОВОВ (кто вызывается)
    if (outgoingCalls.size > 0) {
      navHtml += `<div class="nav-section"><span class="nav-label">📤 Исходящие вызовы (${outgoingCalls.size}):</span>`;
      const sortedCalls = Array.from(outgoingCalls).sort();
      for (const call of sortedCalls.slice(0, 8)) {
        const targetModule = this.findModuleForFunction(call);
        const targetModuleDisplay = targetModule ? targetModule.split('/').pop() : '?';
        const onclickNav = `event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(call)}', '${this.app.escapeJs(targetModule || '')}')`;
        navHtml += `
          <button class="nav-btn" onclick="${onclickNav}" title="${this.app.escapeHtml(call)} в ${this.app.escapeHtml(targetModuleDisplay)}">
            ${this.app.escapeHtml(call)}
            ${targetModule ? `<span style="font-size:8px;color:#64748b;">📁${this.app.escapeHtml(targetModuleDisplay)}</span>` : ''}
          </button>
        `;
      }
      if (outgoingCalls.size > 8) {
        navHtml += `<span class="nav-more">+${outgoingCalls.size - 8}</span>`;
      }
      navHtml += `</div>`;
    }

    // ✅ КНОПКИ ДЛЯ ВХОДЯЩИХ ВЫЗОВОВ (кто вызывает)
    if (incomingCalls.size > 0) {
      navHtml += `<div class="nav-section"><span class="nav-label">📥 Входящие вызовы (${incomingCalls.size}):</span>`;
      const sortedCallers = Array.from(incomingCalls).sort();
      for (const caller of sortedCallers.slice(0, 8)) {
        const callerModule = this.findModuleForFunction(caller);
        const callerModuleDisplay = callerModule ? callerModule.split('/').pop() : '?';
        const onclickNav = `event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(caller)}', '${this.app.escapeJs(callerModule || '')}')`;
        navHtml += `
          <button class="nav-btn" onclick="${onclickNav}" title="${this.app.escapeHtml(caller)} из ${this.app.escapeHtml(callerModuleDisplay)}">
            ${this.app.escapeHtml(caller)}
            ${callerModule ? `<span style="font-size:8px;color:#64748b;">📁${this.app.escapeHtml(callerModuleDisplay)}</span>` : ''}
          </button>
        `;
      }
      if (incomingCalls.size > 8) {
        navHtml += `<span class="nav-more">+${incomingCalls.size - 8}</span>`;
      }
      navHtml += `</div>`;
    }

    // ✅ КНОПКИ ДЛЯ ЭКСПОРТОВ (если есть)
    const exportsList = pkg.exports ? Object.keys(pkg.exports) : [];
    if (exportsList.length > 0) {
      navHtml += `<div class="nav-section"><span class="nav-label">📤 Экспорты (${exportsList.length}):</span>`;
      for (const exp of exportsList.slice(0, 6)) {
        const expModule = this.findModuleForFunction(exp);
        const onclickNav = `event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(exp)}', '${this.app.escapeJs(expModule || modulePath)}')`;
        navHtml += `
          <button class="nav-btn" onclick="${onclickNav}" style="border-color:#f87171;">
            📤 ${this.app.escapeHtml(exp)}
          </button>
        `;
      }
      if (exportsList.length > 6) {
        navHtml += `<span class="nav-more">+${exportsList.length - 6}</span>`;
      }
      navHtml += `</div>`;
    }

    // ✅ КНОПКА "ПОКАЗАТЬ ВСЕ ФУНКЦИИ" (если есть скрытые)
    if (funcs.length > 10 && !isActive) {
      navHtml += `
        <div class="nav-section" style="border-top: 1px solid #1a2a4a; padding-top: 6px;">
          <button class="nav-btn" onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusModule('${this.app.escapeJs(modulePath)}')" 
                  style="background:#1a2a4a;border-color:#60a5fa;color:#60a5fa;width:100%;">
            📂 Показать все ${funcs.length} функций
          </button>
        </div>
      `;
    }

    // ✅ СБОРКА КАРТОЧКИ
    moduleCard.innerHTML = `
      <div class="header-row">
        <div>
          <div class="name ${levelClass}">
            ${isActive ? '▶ ' : ''}${isEntry ? '⭐ ' : ''}${this.app.escapeHtml(displayName)}
            <span class="level-badge">${levelDisplay}</span>
          </div>
          <div class="path">${this.app.escapeHtml(modulePath)}</div>
        </div>
        <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
          <span class="badge lang">${this.app.escapeHtml(language)}</span>
          ${isEntry ? '<span class="badge export">⭐ entry</span>' : ''}
          <span class="badge lines">${lines} строк</span>
          <span class="badge level ${levelClass}">${levelDisplay}</span>
          ${isActive ? '<span class="badge" style="background:#22d3ee;color:#0f172a;">🎯 активен</span>' : ''}
        </div>
      </div>
      
      <div class="badges">
        <span class="badge fn">${totalFuncs} функций</span>
        ${totalClasses > 0 ? `<span class="badge class">${totalClasses} классов</span>` : ''}
        ${totalConstants > 0 ? `<span class="badge const">${totalConstants} констант</span>` : ''}
        ${totalInterfaces > 0 ? `<span class="badge interface">${totalInterfaces} интерфейсов</span>` : ''}
        ${totalTypes > 0 ? `<span class="badge type">${totalTypes} типов</span>` : ''}
        ${totalVariables > 0 ? `<span class="badge var">${totalVariables} переменных</span>` : ''}
        ${outgoingCalls.size > 0 ? `<span class="badge" style="background:#f59e0b;">📤 ${outgoingCalls.size}</span>` : ''}
        ${incomingCalls.size > 0 ? `<span class="badge" style="background:#3b82f6;">📥 ${incomingCalls.size}</span>` : ''}
      </div>
      
      <div class="functions-list">
        ${funcsHtml}
        ${hasMore ? `<div style="text-align:center;padding:8px;color:#64748b;font-size:12px;">... и еще ${funcs.length - 10} функций</div>` : ''}
        ${funcs.length === 0 ? '<div style="color:#64748b;font-size:12px;padding:8px;text-align:center;">Нет функций</div>' : ''}
      </div>
      
      ${navHtml}
      
      ${
        isActive
          ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #1a2a4a;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="nav-btn" onclick="window[Symbol.for('__AST_APP_API__')]?.clearFocus()" 
                  style="background:#1a2a4a;border:1px solid #334155;color:#94a3b8;padding:4px 12px;border-radius:12px;cursor:pointer;font-size:10px;">
            ✕ Снять фокус
          </button>
          <span style="color:#64748b;font-size:10px;display:flex;align-items:center;">
            📊 Всего связей: ${outgoingCalls.size + incomingCalls.size}
          </span>
        </div>
      `
          : ''
      }
    `;

    return moduleCard;
  }

  /**
   * Устанавливает фокус на модуль
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

    this.renderModules();
  }

  /**
   * Устанавливает фокус на функцию
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
    this.renderModules();

    const el = document.querySelector(
      `.func-item[data-func="${funcName}"][data-module="${modulePath}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Обновляет стек навигации
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
   * Сбрасывает фокус
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
    this.app.breadcrumbManager?.updateBreadcrumbs(null, null);
    this.renderModules();
  }

  /**
   * Показывает детали функции в панели
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
        const targetModule = this.findModuleForFunction(call);
        const moduleDisplay = targetModule ? ` (${targetModule.split('/').pop()})` : '';
        html += `<div class="item" style="cursor:pointer;color:#f59e0b;" onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(call)}', '${this.app.escapeJs(targetModule || data.module || '')}')">→ ${this.app.escapeHtml(call)}${moduleDisplay}</div>`;
      }
      html += '</div>';
    }

    const calledBy = data.calledBy || [];
    if (calledBy.length > 0) {
      html += '<div class="dp-section"><h4>📥 Кто вызывает</h4>';
      for (const caller of calledBy) {
        const callerModule = this.findModuleForFunction(caller);
        const moduleDisplay = callerModule ? ` (${callerModule.split('/').pop()})` : '';
        html += `<div class="item" style="cursor:pointer;color:#3b82f6;" onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.app.escapeJs(caller)}', '${this.app.escapeJs(callerModule || data.module || '')}')">← ${this.app.escapeHtml(caller)}${moduleDisplay}</div>`;
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
   */
  getFocusModule() {
    return this.currentFocusModule;
  }

  /**
   * Возвращает текущую функцию в фокусе
   */
  getFocusFunction() {
    return this.currentFocusFunction;
  }

  /**
   * Возвращает стек навигации
   */
  getNavigationStack() {
    return this.navigationStack;
  }
}
