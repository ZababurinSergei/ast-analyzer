// packages/ast-analyzer/src/reporters/templates/interactive-report.js

import context from './package-lock-report.json' with { type: 'json' };
import { DataConverter } from './data-converter.js';
import 'd3';
const d3 = window.d3;

// Импорт модулей
import { CardManager } from './modules/CardManager.js';
import { GraphManager } from './modules/GraphManager.js';
import { BreadcrumbManager } from './modules/BreadcrumbManager.js';
import { GraphModeManager } from './modules/GraphModeManager.js';
import { CardModeManager } from './modules/CardModeManager.js';

// ============================================================
// СИМВОЛЫ ДЛЯ ГЛОБАЛЬНОГО ДОСТУПА
// ============================================================
const SYM_APP = Symbol.for('__AST_APP__');
const SYM_READY = Symbol.for('__AST_APP_READY__');
const SYM_MODE_CHANGE = Symbol.for('__AST_MODE_CHANGE__');
const SYM_REPORT_DATA = Symbol.for('__AST_INTERACTIVE_REPORT_DATA__');
const SYM_FUNCTIONS_DATA = Symbol.for('__AST_INTERACTIVE_FUNCTIONS_DATA__');
const SYM_DATA_VERSION = Symbol.for('__AST_INTERACTIVE_DATA_VERSION__');

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

const rawReportData = context;
const rawFunctionsData = [];

for (const [modulePath, pkg] of Object.entries(context.packages || {})) {
  if (!pkg) {
    continue;
  }
  for (const func of pkg.entities?.functions || []) {
    rawFunctionsData.push({ modulePath, func });
  }
}

let REPORT_DATA = null;
let ALL_FUNCTIONS_DATA = [];

if (DataConverter && rawReportData) {
  console.log('🔄 Используем DataConverter...');

  if (rawReportData.packages) {
    REPORT_DATA = rawReportData;
    if (rawFunctionsData && rawFunctionsData.length > 0) {
      const entitiesWithCalls = {
        functions: rawFunctionsData.map(item => item.func || item),
      };
      REPORT_DATA = DataConverter.enrichReport(REPORT_DATA, entitiesWithCalls);
    }
  } else if (rawReportData.moduleGraph) {
    REPORT_DATA = DataConverter.buildReportFromAnalysis(rawReportData);
  } else {
    REPORT_DATA = rawReportData;
  }

  if (REPORT_DATA && REPORT_DATA.packages) {
    ALL_FUNCTIONS_DATA = [];
    for (const [modulePath, pkg] of Object.entries(REPORT_DATA.packages)) {
      if (!pkg) {
        continue;
      }
      for (const func of pkg.entities?.functions || []) {
        ALL_FUNCTIONS_DATA.push({ modulePath, func });
      }
    }
  }
} else {
  REPORT_DATA = rawReportData;
  ALL_FUNCTIONS_DATA = rawFunctionsData || [];
}

console.log('✅ Данные загружены и преобразованы');
console.log('📊 Модулей:', Object.keys(REPORT_DATA?.packages || {}).length);
console.log('ƒ Функций:', ALL_FUNCTIONS_DATA?.length || 0);

window[SYM_REPORT_DATA] = REPORT_DATA;
window[SYM_FUNCTIONS_DATA] = ALL_FUNCTIONS_DATA;
window[SYM_DATA_VERSION] = 1;

// ============================================================
// КЛАСС APP - ВСЕ МЕТОДЫ В КОНСТРУКТОРЕ
// ============================================================

class App {
  constructor() {
    this._isApp = true;
    this.reportData = REPORT_DATA;
    this.allFunctionsData = ALL_FUNCTIONS_DATA;
    this.isInitialized = false;
    this.isPaused = false;

    this._focusModule = null;
    this._focusFunction = null;
    this.currentGraphMode = 'all';
    this.currentCardMode = 'list';
    this.searchQuery = '';

    // ✅ СОХРАНЯЕМ ССЫЛКУ НА СЕБЯ
    this.self = this;

    // ============================================================
    // ВСЕ МЕТОДЫ КАК СТРЕЛОЧНЫЕ ФУНКЦИИ В КОНСТРУКТОРЕ
    // ============================================================

    // ---------- ПУБЛИЧНЫЕ МЕТОДЫ ----------

    this.focusModule = modulePath => {
      console.log('🎯 focusModule called:', modulePath);
      if (this._focusModule === modulePath) {
        this.clearFocus();
        return;
      }
      this._focusModule = modulePath;
      this._focusFunction = null;
      if (this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumbs(modulePath, null);
      }
      this.renderModules();
      if (this.graphManager) {
        this.graphManager.updateGraphWithFocus(modulePath, null, this.currentGraphMode);
      }
      this.updateFocusInfo(modulePath);
      this.scrollToModule(modulePath);
    };

    this.focusFunction = (funcName, modulePath) => {
      console.log('🎯 focusFunction called:', funcName, modulePath);
      if (this._focusFunction === funcName && this._focusModule === modulePath) {
        this.clearFocus();
        return;
      }
      this._focusFunction = funcName;
      this._focusModule = modulePath;
      if (this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumbs(modulePath, funcName);
      }
      this.renderModules();
      if (this.graphManager) {
        this.graphManager.updateGraphWithFocus(modulePath, funcName, this.currentGraphMode);
      }
      this.updateFocusInfo(modulePath, funcName);
      this.showFunctionDetail(funcName, modulePath);
      this.scrollToFunction(funcName, modulePath);
    };

    this.clearFocus = () => {
      console.log('🧹 clearFocus called');
      this._focusModule = null;
      this._focusFunction = null;
      if (this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumbs(null, null);
      }
      this.renderModules();
      if (this.graphManager) {
        this.graphManager.updateGraphWithFocus(null, null, 'all');
      }
      this.hideFocusInfo();
      this.closeDetail();
    };

    this.handleSearch = query => {
      console.log('🔍 handleSearch called:', query);
      this.searchQuery = query;
      this.renderModules();
      if (this.graphManager) {
        this.graphManager.handleSearch(query);
      }
    };

    this.setGraphMode = mode => {
      console.log('📊 setGraphMode called:', mode);
      this.currentGraphMode = mode;
      if (this.graphModeManager && typeof this.graphModeManager.setMode === 'function') {
        this.graphModeManager.setMode(mode);
      }
      // Обновляем граф с текущим фокусом и новым режимом
      if (this.graphManager) {
        this.graphManager.updateGraphWithFocus(this._focusModule, this._focusFunction, mode);
      }
      this.notifyModeChange('graph', mode);
    };

    this.setCardMode = mode => {
      console.log('📋 setCardMode called:', mode);
      this.currentCardMode = mode;
      if (this.cardModeManager && typeof this.cardModeManager.setMode === 'function') {
        this.cardModeManager.setMode(mode);
        this.renderModules();
      }
      this.notifyModeChange('card', mode);
    };

    this.closeDetail = () => {
      console.log('❌ closeDetail called');
      const panel = document.getElementById('detailPanel');
      if (panel) {
        panel.classList.remove('active');
      }
    };

    this.renderModules = () => {
      console.log('🔄 renderModules called');
      if (this.cardManager && typeof this.cardManager.renderModules === 'function') {
        this.cardManager.renderModules();
      }
    };

    // ---------- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ----------

    this.updateBreadcrumbs = (modulePath, funcName) => {
      if (this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumbs(modulePath, funcName);
      }
    };

    this.showDetail = data => {
      if (this.cardManager) {
        this.cardManager.showDetail(data);
      }
    };

    this.updateStats = () => {
      if (!this.reportData) {
        return;
      }
      const stats = this.reportData.fileStats || {};
      const entityStats = this.reportData.entityStats || {};

      const el = id => document.getElementById(id);
      if (el('statModules')) {
        el('statModules').textContent = stats.totalFiles || 0;
      }
      if (el('statFunctions')) {
        el('statFunctions').textContent = entityStats.totalFunctions || 0;
      }
      if (el('statCalls')) {
        el('statCalls').textContent = entityStats.totalCalls || 0;
      }
      if (el('statExported')) {
        el('statExported').textContent = entityStats.totalExportedFunctions || 0;
      }
      if (el('statAsync')) {
        el('statAsync').textContent = entityStats.totalAsyncFunctions || 0;
      }
      if (el('statLines')) {
        el('statLines').textContent = stats.totalLines || 0;
      }
      if (el('statSize')) {
        el('statSize').textContent = ((stats.totalSize || 0) / 1024).toFixed(2);
      }
    };

    this.updateFocusInfo = (modulePath, funcName = null) => {
      const info = document.getElementById('focusInfo');
      if (!info) {
        return;
      }

      info.classList.add('active');
      const pkg = this.reportData?.packages?.[modulePath];
      const displayName = pkg?.displayPath || modulePath.split('/').pop() || modulePath;
      const level = this.cardManager?.getModuleLevel?.(modulePath) || 0;
      const levelDisplay = level === 0 ? '🌌' : `L${level}`;

      const titleEl = document.getElementById('focusTitle');
      const detailsEl = document.getElementById('focusDetails');

      if (funcName) {
        if (titleEl) {
          titleEl.textContent = `🎯 Функция: ${funcName} (${levelDisplay})`;
        }
        const funcData = this.findFunctionData(funcName, modulePath);
        if (detailsEl) {
          detailsEl.textContent = funcData
            ? `Модуль: ${displayName} | Параметры: ${(funcData.params || []).join(', ') || 'нет'} | Вызовов: ${(funcData.calls || []).length} | Кем вызвана: ${(funcData.calledBy || []).length} | Уровень: ${levelDisplay}`
            : `Модуль: ${displayName} | Уровень: ${levelDisplay}`;
        }
      } else {
        if (titleEl) {
          titleEl.textContent = `🎯 Фокус: ${displayName} (${levelDisplay})`;
        }
        const funcs = pkg?.entities?.functions || [];
        if (detailsEl) {
          detailsEl.textContent = `Функций: ${funcs.length} | Экспортов: ${pkg?.exports ? Object.keys(pkg.exports).length : 0} | Уровень: ${levelDisplay}`;
        }
      }
    };

    this.hideFocusInfo = () => {
      const info = document.getElementById('focusInfo');
      if (info) {
        info.classList.remove('active');
      }
    };

    this.showFunctionDetail = (funcName, modulePath) => {
      const funcData = this.findFunctionData(funcName, modulePath);
      if (funcData && this.cardManager && typeof this.cardManager.showDetail === 'function') {
        this.cardManager.showDetail(funcData);
      }
    };

    this.findFunctionData = (funcName, modulePath) => {
      const pkg = this.reportData?.packages?.[modulePath];
      if (!pkg) {
        return null;
      }
      const funcs = pkg.entities?.functions || [];
      return funcs.find(f => f.name === funcName) || null;
    };

    this.scrollToModule = modulePath => {
      const card = document.querySelector(`.module-card[data-module="${modulePath}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    this.scrollToFunction = (funcName, modulePath) => {
      const el = document.querySelector(
        `.func-item[data-func="${funcName}"][data-module="${modulePath}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    this.setupKeyboard = () => {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          this.clearFocus();
          this.closeDetail();
        }
        if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          const input = document.getElementById('searchInput');
          if (input) {
            input.focus();
          }
        }
      });

      document.addEventListener('click', e => {
        const panel = document.getElementById('detailPanel');
        if (
          panel?.classList.contains('active') &&
          !panel.contains(e.target) &&
          !e.target.closest('.func-item')
        ) {
          this.closeDetail();
        }
      });
    };

    this.setupModeListeners = () => {
      if (this.graphModeManager && typeof this.graphModeManager.onModeChange === 'function') {
        this.graphModeManager.onModeChange(mode => {
          this.currentGraphMode = mode;
          this.notifyModeChange('graph', mode);
          // Обновляем граф при смене режима
          if (this.graphManager) {
            this.graphManager.updateGraphWithFocus(this._focusModule, this._focusFunction, mode);
          }
        });
      }

      if (this.cardModeManager && typeof this.cardModeManager.onModeChange === 'function') {
        this.cardModeManager.onModeChange(mode => {
          this.currentCardMode = mode;
          this.notifyModeChange('card', mode);
        });
      }
    };

    this.notifyModeChange = (type, mode) => {
      const callback = window[SYM_MODE_CHANGE];
      if (typeof callback === 'function') {
        callback(type, mode);
      }
    };

    this.dispose = () => {
      console.log('🧹 Disposing...');
      if (this.graphManager?.getSimulation) {
        const sim = this.graphManager.getSimulation();
        if (sim && typeof sim.stop === 'function') {
          sim.stop();
        }
      }
      this.isInitialized = false;
      window[SYM_READY] = false;
    };

    this.pause = () => {
      if (this.isPaused) {
        return;
      }
      this.isPaused = true;
      if (this.graphManager?.getSimulation) {
        const sim = this.graphManager.getSimulation();
        if (sim && typeof sim.stop === 'function') {
          sim.stop();
        }
      }
    };

    this.resume = () => {
      if (!this.isPaused) {
        return;
      }
      this.isPaused = false;
      if (this.graphManager?.getSimulation) {
        const sim = this.graphManager.getSimulation();
        if (sim && typeof sim.restart === 'function') {
          sim.restart();
        }
      }
    };

    this.escapeHtml = str => {
      if (!str) {
        return '';
      }
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    this.escapeJs = str => {
      if (!str) {
        return '';
      }
      return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
    };

    this.showPlaceholder = () => {
      const grid = document.getElementById('modulesGrid');
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #94a3b8;">
            <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
            <h3 style="color: #60a5fa; margin-bottom: 10px;">Нет данных</h3>
          </div>
        `;
      }
    };

    this.getFocusModule = () => this._focusModule;
    this.getFocusFunction = () => this._focusFunction;

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРОВ
    // ============================================================

    this.cardManager = null;
    this.graphManager = null;
    this.breadcrumbManager = null;
    this.graphModeManager = null;
    this.cardModeManager = null;

    window[SYM_APP] = this;
    window[SYM_READY] = false;

    // ✅ ЗАПУСКАЕМ ИНИЦИАЛИЗАЦИЮ
    this.init();
  }

  // ============================================================
  // МЕТОД INIT
  // ============================================================

  init() {
    this.reportData = window[SYM_REPORT_DATA];
    const allFunctionsData = window[SYM_FUNCTIONS_DATA] || [];

    if (!this.reportData) {
      this.showPlaceholder();
      return;
    }

    // Инициализация менеджеров
    this.cardManager = new CardManager(this);
    this.graphManager = new GraphManager(this);
    this.breadcrumbManager = new BreadcrumbManager(this);
    this.graphModeManager = new GraphModeManager(this);
    this.cardModeManager = new CardModeManager(this);

    this.updateStats();
    this.cardManager.init();
    this.graphManager.init();
    this.breadcrumbManager.init();
    this.breadcrumbManager.updateBreadcrumbs(null, null);
    this.graphModeManager.init();
    this.cardModeManager.init();

    this.setupModeListeners();
    this.setupKeyboard();
    this.isInitialized = true;

    // ✅ УСТАНАВЛИВАЕМ ФЛАГ ГОТОВНОСТИ
    window[SYM_READY] = true;

    // ✅ РЕГИСТРИРУЕМ API
    this.registerAPI();

    console.log('✅ App initialized');
    console.log('📊 Данные готовы, модулей:', Object.keys(this.reportData?.packages || {}).length);
  }

  // ============================================================
  // РЕГИСТРАЦИЯ API
  // ============================================================

  registerAPI() {
    const SYM_APP_API = Symbol.for('__AST_APP_API__');

    // ✅ ИСПОЛЬЗУЕМ this.self ДЛЯ ДОСТУПА К МЕТОДАМ
    const app = this.self;

    console.log('🔍 Проверка методов App:');
    console.log('  - focusModule:', typeof this.focusModule);
    console.log('  - focusFunction:', typeof this.focusFunction);
    console.log('  - clearFocus:', typeof this.clearFocus);
    console.log('  - handleSearch:', typeof this.handleSearch);
    console.log('  - setGraphMode:', typeof this.setGraphMode);
    console.log('  - setCardMode:', typeof this.setCardMode);
    console.log('  - closeDetail:', typeof this.closeDetail);
    console.log('  - renderModules:', typeof this.renderModules);

    // ✅ СОЗДАЕМ API С МЕТОДАМИ, КОТОРЫЕ ВЫЗЫВАЮТ APP
    const api = {
      focusModule: path => {
        if (typeof app.focusModule === 'function') {
          return app.focusModule(path);
        }
        console.warn('⚠️ focusModule not yet initialized');
      },

      focusFunction: (name, module) => {
        if (typeof app.focusFunction === 'function') {
          return app.focusFunction(name, module);
        }
        console.warn('⚠️ focusFunction not yet initialized');
      },

      clearFocus: () => {
        if (typeof app.clearFocus === 'function') {
          return app.clearFocus();
        }
        console.warn('⚠️ clearFocus not yet initialized');
      },

      handleSearch: query => {
        if (typeof app.handleSearch === 'function') {
          return app.handleSearch(query);
        }
        console.warn('⚠️ handleSearch not yet initialized');
      },

      setGraphMode: mode => {
        if (typeof app.setGraphMode === 'function') {
          return app.setGraphMode(mode);
        }
        console.warn('⚠️ setGraphMode not yet initialized');
      },

      setCardMode: mode => {
        if (typeof app.setCardMode === 'function') {
          return app.setCardMode(mode);
        }
        console.warn('⚠️ setCardMode not yet initialized');
      },

      closeDetail: () => {
        if (typeof app.closeDetail === 'function') {
          return app.closeDetail();
        }
        console.warn('⚠️ closeDetail not yet initialized');
      },

      renderModules: () => {
        if (typeof app.renderModules === 'function') {
          return app.renderModules();
        }
        console.warn('⚠️ renderModules not yet initialized');
      },

      updateBreadcrumbs: (module, func) => {
        if (typeof app.updateBreadcrumbs === 'function') {
          return app.updateBreadcrumbs(module, func);
        }
        console.warn('⚠️ updateBreadcrumbs not yet initialized');
      },

      showDetail: data => {
        if (typeof app.showDetail === 'function') {
          return app.showDetail(data);
        }
        console.warn('⚠️ showDetail not yet initialized');
      },

      // Дополнительные методы для управления графом
      updateGraph: (module, func, mode) => {
        if (app.graphManager && typeof app.graphManager.updateGraphWithFocus === 'function') {
          return app.graphManager.updateGraphWithFocus(module, func, mode || app.currentGraphMode);
        }
        console.warn('⚠️ updateGraph not yet initialized');
      },

      fitGraph: () => {
        if (app.graphManager && typeof app.graphManager.fitGraphToScreen === 'function') {
          return app.graphManager.fitGraphToScreen();
        }
        console.warn('⚠️ fitGraph not yet initialized');
      },

      getCurrentFocus: () => ({
        module: app._focusModule,
        function: app._focusFunction,
        graphMode: app.currentGraphMode,
        cardMode: app.currentCardMode,
      }),
    };

    // ✅ ДОБАВЛЯЕМ МЕНЕДЖЕРЫ
    if (this.cardModeManager) {
      api.cardModeManager = this.cardModeManager;
    }
    if (this.graphModeManager) {
      api.graphModeManager = this.graphModeManager;
    }

    // ✅ ЗАМОРАЖИВАЕМ API
    Object.freeze(api);
    window[SYM_APP_API] = api;

    console.log('✅ Secure API registered');
    console.log('📌 Доступ через: window[Symbol.for("__AST_APP_API__")]');
    console.log(
      '📌 Доступные методы:',
      Object.keys(api)
        .filter(k => typeof api[k] === 'function')
        .join(', ')
    );

    // ✅ ПРОВЕРЯЕМ, ЧТО API РАБОТАЕТ
    console.log('🔍 Проверка API:');
    console.log('  - api.focusModule:', typeof api.focusModule);
    console.log('  - api.focusFunction:', typeof api.focusFunction);
    console.log('  - api.clearFocus:', typeof api.clearFocus);
    console.log('  - api.updateGraph:', typeof api.updateGraph);
    console.log('  - api.fitGraph:', typeof api.fitGraph);
  }
}

// ============================================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================

if (!window[SYM_APP]) {
  console.log('🚀 Создание приложения...');

  try {
    const app = new App();
    console.log('🚀 App loaded');

    if (!window[SYM_READY]) {
      window[SYM_READY] = true;
    }

    console.log('🔑 Доступ через: window[Symbol.for("__AST_APP_API__")]');
  } catch (error) {
    console.error('❌ Failed to initialize App:', error);
    window[SYM_READY] = false;
    const fallbackApi = {};
    [
      'focusModule',
      'focusFunction',
      'clearFocus',
      'handleSearch',
      'setGraphMode',
      'setCardMode',
      'closeDetail',
      'renderModules',
      'updateBreadcrumbs',
      'showDetail',
      'updateGraph',
      'fitGraph',
      'getCurrentFocus',
    ].forEach(method => {
      fallbackApi[method] = function (...args) {
        console.warn(`⚠️ App not ready, ${method} called with:`, args);
      };
    });
    window[SYM_APP_API] = fallbackApi;
  }
} else {
  console.log('ℹ️ Приложение уже создано');
  window[SYM_READY] = true;
}

// ============================================================
// ЭКСПОРТЫ
// ============================================================

export { App };
export {
  SYM_APP,
  SYM_READY,
  SYM_MODE_CHANGE,
  SYM_REPORT_DATA,
  SYM_FUNCTIONS_DATA,
  SYM_DATA_VERSION,
};
export { REPORT_DATA, ALL_FUNCTIONS_DATA };

console.log('📦 Модуль interactive-report.js загружен');
console.log('📌 Статус приложения:', window[SYM_READY] ? '✅ ГОТОВ' : '⏳ ЗАГРУЗКА...');
