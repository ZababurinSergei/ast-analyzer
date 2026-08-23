// packages/ast-analyzer/src/reporters/templates/modules/CardManager.js

import { HeaderRenderer } from './CardManager/HeaderRenderer.js';
import { BadgesRenderer } from './CardManager/BadgesRenderer.js';
import { FunctionsListRenderer } from './CardManager/FunctionsListRenderer.js';
import { NavExportsRenderer } from './CardManager/NavExportsRenderer.js';
import { NavModuleImportersRenderer } from './CardManager/NavModuleImportersRenderer.js';
import { NavExternalRenderer } from './CardManager/NavExternalRenderer.js';
import { NavInternalRenderer } from './CardManager/NavInternalRenderer.js';
import { CallTreeRenderer } from './CardManager/CallTreeRenderer.js';
import { DetailPanelRenderer } from './CardManager/DetailPanelRenderer.js';

/**
 * CardManager - управление карточками модулей и функций
 * Отвечает за рендеринг, навигацию и отображение деталей
 *
 * Навигация:
 * - Клик на функцию → переход к функции (если она в другом модуле или активна)
 * - Клик на модуль → переход к модулю
 * - Экспорты → ТОЛЬКО ИНФОРМАЦИЯ, НЕ ССЫЛКИ (отображаются как статические теги)
 * - Исходящие вызовы → переход к вызываемой функции с указанием источника
 * - Входящие вызовы → переход к вызывающей функции с указанием источника
 * - Модули-импортеры → переход к модулю, который импортирует текущий
 * - Модули-зависимости → переход к модулю, который импортирует текущий
 *
 * Улучшения:
 * - Статистика сложности (Cyclomatic Complexity)
 * - Размер функций (количество строк)
 * - Индикатор асинхронности
 * - Визуализация связей (входящие/исходящие)
 * - Превью документации (JSDoc)
 * - Группировка по тегам
 * - Индикатор покрытия тестами
 * - Индикатор безопасности
 * - Копирование сигнатуры
 * - Источник вызова (top-level или из функции)
 * - Компактные кнопки
 * - Ссылка на VS Code в заголовке
 */

export class CardManager {
  constructor(app) {
    this.app = app;
    this.currentFocusModule = null;
    this.currentFocusFunction = null;
    this.navigationStack = [];
    this._expandedCallTrees = new Set();
    this._lastSource = null;
    this._api = null;
    this._methodsBound = false;

    // Инициализация рендереров
    this.headerRenderer = new HeaderRenderer(this);
    this.badgesRenderer = new BadgesRenderer(this);
    this.functionsListRenderer = new FunctionsListRenderer(this);
    this.navExportsRenderer = new NavExportsRenderer(this);
    this.navModuleImportersRenderer = new NavModuleImportersRenderer(this);
    this.navExternalRenderer = new NavExternalRenderer(this);
    this.navInternalRenderer = new NavInternalRenderer(this);
    this.callTreeRenderer = new CallTreeRenderer(this);
    this.detailPanelRenderer = new DetailPanelRenderer(this);

    console.log('📊 CardManager created');
  }

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

  _bindMethods() {
    console.log('🔄 CardManager._bindMethods() called');
    const api = this._api || window[Symbol.for('__AST_APP_API__')];

    this._focusModule = path => {
      if (api && typeof api.focusModule === 'function') {
        console.log('🎯 CardManager: focusModule called', path);
        return api.focusModule(path);
      }
      console.warn('⚠️ focusModule not available in CardManager');
      this.currentFocusModule = path;
      this.currentFocusFunction = null;
      this.renderModules();
    };

    this._focusFunction = (name, module) => {
      if (api && typeof api.focusFunction === 'function') {
        console.log('🎯 CardManager: focusFunction called', name, module);
        return api.focusFunction(name, module);
      }
      console.warn('⚠️ focusFunction not available in CardManager');
      if (this.currentFocusFunction === name && this.currentFocusModule === module) {
        this.showDetail({ name, module });
        return;
      }
      this.currentFocusFunction = name;
      this.currentFocusModule = module;
      this.renderModules();
    };

    this._clearFocus = () => {
      if (api && typeof api.clearFocus === 'function') {
        console.log('🧹 CardManager: clearFocus called');
        return api.clearFocus();
      }
      console.warn('⚠️ clearFocus not available in CardManager');
      this.currentFocusModule = null;
      this.currentFocusFunction = null;
      this.renderModules();
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
      this.renderModules();
    };

    this._methodsBound = true;
  }

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

  getCallSource(funcName, modulePath, funcs) {
    for (const func of funcs) {
      if (func.calls && func.calls.includes(funcName)) {
        return func.name;
      }
    }
    return 'top-level';
  }

  buildCallTree(funcName, modulePath, funcs, depth = 0, maxDepth = 3, visited = new Set()) {
    if (depth > maxDepth) return null;
    if (visited.has(funcName)) return null;
    visited.add(funcName);

    const func = funcs.find(f => f.name === funcName);
    if (!func) return null;

    const tree = {
      name: funcName,
      isExported: func.isExported || false,
      isAsync: func.isAsync || false,
      line: func.line || 0,
      calls: [],
      calledBy: [],
      depth: depth,
      isExpanded: this._expandedCallTrees.has(`${modulePath}#${funcName}`),
      complexity: func.complexity || 0,
      size: func.endLine && func.startLine ? func.endLine - func.startLine + 1 : 0,
      isDeprecated: func.isDeprecated || false,
      isTested: func.isTested || false,
      securityLevel: func.securityLevel || 'low',
      description: func.description || '',
      tags: func.tags || [],
      coverage: func.coverage,
      paramsWithTypes: func.paramsWithTypes || [],
      usedTypes: func.usedTypes || [],
      lastModified: func.lastModified || null,
      callSource: this.getCallSource(funcName, modulePath, funcs),
    };

    for (const call of func.calls || []) {
      const child = this.buildCallTree(
        call,
        modulePath,
        funcs,
        depth + 1,
        maxDepth,
        new Set(visited)
      );
      if (child) {
        tree.calls.push(child);
      }
    }

    for (const caller of func.calledBy || []) {
      const child = this.buildCallTree(
        caller,
        modulePath,
        funcs,
        depth + 1,
        maxDepth,
        new Set(visited)
      );
      if (child && !tree.calledBy.find(c => c.name === child.name)) {
        tree.calledBy.push(child);
      }
    }

    return tree;
  }

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

    const focusModule = this.app._focusModule || this.currentFocusModule;
    const focusFunction = this.app._focusFunction || this.currentFocusFunction;
    const searchQuery = this.app.searchQuery || '';

    let moduleEntries = Object.entries(reportData.packages);

    if (focusModule) {
      moduleEntries = moduleEntries.filter(([path]) => path === focusModule);
      if (moduleEntries.length === 0) {
        moduleEntries = Object.entries(reportData.packages);
      }
    }

    if (!focusModule && searchQuery) {
      const query = searchQuery.toLowerCase();
      moduleEntries = moduleEntries.filter(([modulePath, pkg]) => {
        if (modulePath.toLowerCase().includes(query)) return true;
        const funcs = pkg.entities?.functions || [];
        return funcs.some(f => f.name.toLowerCase().includes(query));
      });
    }

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

    for (const [modulePath, pkg] of moduleEntries) {
      if (!pkg) continue;
      const isActive = focusModule === modulePath;
      const moduleCard = this.createModuleCard(modulePath, pkg, isActive, focusFunction);
      grid.appendChild(moduleCard);
    }
  }

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

    const totalFuncs = funcs.length;
    const totalClasses = pkg.entities?.classes?.length || 0;
    const totalConstants = pkg.entities?.constants?.length || 0;
    const totalInterfaces = pkg.entities?.interfaces?.length || 0;
    const totalTypes = pkg.entities?.types?.length || 0;
    const totalVariables = pkg.entities?.variables?.length || 0;

    // Экспорты
    const exportsList = pkg.exports ? Object.keys(pkg.exports) : [];
    const exportedFunctions = funcs.filter(f => f.isExported);
    const allExports = [...new Set([...exportsList, ...exportedFunctions.map(f => f.name)])];

    // Источник навигации
    let sourceInfo = null;
    if (this.navigationStack.length > 1) {
      const lastSource = this.navigationStack[this.navigationStack.length - 2];
      if (lastSource) {
        const [srcModule, srcFunc] = lastSource.split('#');
        sourceInfo = { module: srcModule, function: srcFunc || null };
      }
    }

    // Сбор вызовов
    const externalOutgoing = new Set();
    const externalIncoming = new Set();
    const internalOutgoing = new Set();
    const internalIncoming = new Set();
    const funcNames = new Set(funcs.map(f => f.name));

    const moduleImports = new Set();
    const moduleImporters = new Set();

    const dependencyGraph = this.app.reportData?.dependencyGraph || {};
    const outwardDeps = dependencyGraph.outwardDependencies || {};
    const inwardDeps = dependencyGraph.inwardDependencies || {};

    if (outwardDeps[modulePath]) {
      for (const dep of outwardDeps[modulePath]) {
        if (this.app.reportData?.packages?.[dep]) {
          moduleImports.add(dep);
        }
      }
    }

    if (inwardDeps[modulePath]) {
      for (const dep of inwardDeps[modulePath]) {
        if (this.app.reportData?.packages?.[dep]) {
          moduleImporters.add(dep);
        }
      }
    }

    const callSources = new Map();
    for (const func of funcs) {
      if (!func || !func.name) continue;
      const source = this.getCallSource(func.name, modulePath, funcs);
      callSources.set(func.name, source);
    }

    for (const func of funcs) {
      if (!func || !func.name) continue;
      for (const call of func.calls || []) {
        const source = callSources.get(call) || 'top-level';
        if (funcNames.has(call)) {
          internalOutgoing.add(call);
        } else {
          const targetModule = this.findModuleForFunction(call);
          if (targetModule && targetModule !== modulePath) {
            externalOutgoing.add(call);
          } else {
            externalOutgoing.add(call);
          }
        }
      }
    }

    for (const func of funcs) {
      if (!func || !func.name) continue;
      for (const caller of func.calledBy || []) {
        if (funcNames.has(caller)) {
          internalIncoming.add(caller);
        } else {
          const callerModule = this.findModuleForFunction(caller);
          if (callerModule && callerModule !== modulePath) {
            externalIncoming.add(caller);
          } else {
            externalIncoming.add(caller);
          }
        }
      }
    }

    const totalInternal = internalOutgoing.size + internalIncoming.size;

    // Рендеринг компонентов
    const headerHtml = this.headerRenderer.render({
      isActive,
      isEntry,
      displayName,
      levelClass,
      levelDisplay,
      modulePath,
      language,
      lines,
      allExports,
      totalFuncs,
    });

    const badgesHtml = this.badgesRenderer.render({
      totalFuncs,
      totalClasses,
      totalConstants,
      totalInterfaces,
      totalTypes,
      totalVariables,
      allExports,
      externalOutgoing,
      externalIncoming,
      totalInternal,
      moduleImporters,
      moduleImports,
    });

    const functionsListHtml = this.functionsListRenderer.render({
      funcs,
      isActive,
      modulePath,
      focusFunction,
      sourceInfo,
      callSources,
      totalFuncs,
    });

    const navExportsHtml = this.navExportsRenderer.render({ allExports, modulePath });

    const navModuleImportersHtml = this.navModuleImportersRenderer.render({
      moduleImporters,
      modulePath,
      reportData: this.app.reportData,
    });

    const navExternalHtml = this.navExternalRenderer.render({
      externalOutgoing,
      externalIncoming,
      modulePath,
      funcs,
      callSources,
    });

    const navInternalHtml = this.navInternalRenderer.render({
      internalOutgoing,
      internalIncoming,
      isActive,
      callSources,
    });

    const callTreeHtml = this.callTreeRenderer.render({
      isActive,
      focusFunction,
      funcs,
      modulePath,
    });

    // Сборка карточки
    moduleCard.innerHTML = `
            ${headerHtml}
            ${badgesHtml}
            ${functionsListHtml}
            ${callTreeHtml}
            ${navExportsHtml}
            ${navModuleImportersHtml}
            ${navExternalHtml}
            ${navInternalHtml}
        `;

    return moduleCard;
  }

  focusModule(modulePath) {
    if (this.currentFocusModule || this.currentFocusFunction) {
      this._lastSource = this.currentFocusFunction
        ? `${this.currentFocusModule}#${this.currentFocusFunction}`
        : this.currentFocusModule;
    }

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

    this.updateFocusInfo(modulePath);
    this.renderModules();

    const card = document.querySelector(`.module-card[data-module="${modulePath}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  focusFunction(funcName, modulePath) {
    if (this.currentFocusModule || this.currentFocusFunction) {
      this._lastSource = this.currentFocusFunction
        ? `${this.currentFocusModule}#${this.currentFocusFunction}`
        : this.currentFocusModule;
    }

    if (this.currentFocusFunction === funcName && this.currentFocusModule === modulePath) {
      const funcData = this.findFunctionByName(funcName);
      if (funcData) {
        this.showDetail(funcData);
      }
      document.querySelectorAll('.func-item').forEach(el => {
        el.classList.toggle(
          'active',
          el.dataset.func === funcName && el.dataset.module === modulePath
        );
      });
      return;
    }

    this.currentFocusFunction = funcName;
    this.currentFocusModule = modulePath;
    this._expandedCallTrees.add(`${modulePath}#${funcName}`);
    this.updateNavigationStack(modulePath, funcName);
    this.app.updateBreadcrumbs(modulePath, funcName);
    this.app.updateView();

    document.querySelectorAll('.module-card').forEach(c => {
      c.classList.toggle('active', c.dataset.module === modulePath);
    });
    document.querySelectorAll('.func-item').forEach(el => {
      const isActive = el.dataset.func === funcName && el.dataset.module === modulePath;
      const isSource =
        el.dataset.func === this._lastSource?.split('#').pop() &&
        el.dataset.module === this._lastSource?.split('#')[0];
      el.classList.toggle('active', isActive);
      el.classList.toggle('source', isSource);
    });

    this.updateFocusInfo(modulePath, funcName);
    this.showDetail({ name: funcName, module: modulePath });
    this.renderModules();

    const el = document.querySelector(
      `.func-item[data-func="${funcName}"][data-module="${modulePath}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  updateFocusInfo(modulePath, funcName = null) {
    const info = document.getElementById('focusInfo');
    if (!info) return;

    info.classList.add('active');
    const pkg = this.app.reportData?.packages?.[modulePath];
    const displayName = pkg?.displayPath || modulePath.split('/').pop() || modulePath;
    const level = this.getModuleLevel(modulePath);
    const levelDisplay = level === 0 ? '🌌' : `L${level}`;

    const sourceInfo = this._lastSource
      ? ` | откуда: ${this._lastSource.split('#').pop() || this._lastSource}`
      : '';

    if (funcName) {
      document.getElementById('focusTitle').textContent =
        `🎯 Функция: ${funcName} (${levelDisplay})${sourceInfo}`;
      const funcData = this.findFunctionByName(funcName);
      if (funcData) {
        const displayNameShort = modulePath.split('/').pop() || modulePath;
        document.getElementById('focusDetails').textContent =
          `Модуль: ${displayNameShort} | Параметры: ${(funcData.params || []).join(', ') || 'нет'} | Вызовов: ${(funcData.calls || []).length} | Кем вызвана: ${(funcData.calledBy || []).length}`;
      }
    } else {
      document.getElementById('focusTitle').textContent =
        `🎯 Фокус: ${displayName} (${levelDisplay})${sourceInfo}`;
      const funcs = pkg?.entities?.functions || [];
      document.getElementById('focusDetails').textContent =
        `Функций: ${funcs.length} | Экспортов: ${pkg?.exports ? Object.keys(pkg.exports).length : 0} | Уровень: ${levelDisplay}`;
    }
  }

  clearFocus() {
    this.currentFocusModule = null;
    this.currentFocusFunction = null;
    this.navigationStack = [];
    this._expandedCallTrees.clear();
    this._lastSource = null;

    const info = document.getElementById('focusInfo');
    if (info) {
      info.classList.remove('active');
    }
    document.querySelectorAll('.module-card').forEach(c => {
      c.classList.remove('active');
    });
    document.querySelectorAll('.func-item').forEach(el => {
      el.classList.remove('active');
      el.classList.remove('source');
    });

    this.closeDetail();
    this.app.graphManager?.updateView();
    this.app.breadcrumbManager?.updateBreadcrumbs(null, null);
    this.renderModules();
  }

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

  showDetail(data) {
    this.detailPanelRenderer.render(data, this);
  }

  closeDetail() {
    const panel = document.getElementById('detailPanel');
    if (panel) {
      panel.classList.remove('active');
    }
  }

  getFocusModule() {
    return this.currentFocusModule;
  }

  getFocusFunction() {
    return this.currentFocusFunction;
  }

  getNavigationStack() {
    return this.navigationStack;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeJs(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
  }
}
