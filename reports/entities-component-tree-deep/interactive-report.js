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
// ✅ ИСПРАВЛЕНО: импортируем AppInit как AppInitializer
import { App as AppInitializer } from './modules/AppInit.js';

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
// КЛАСС APP (основное приложение)
// ============================================================

class App {
  constructor() {
    this._isApp = true;
    this.reportData = REPORT_DATA;
    this.allFunctionsData = ALL_FUNCTIONS_DATA;
    this.isInitialized = false;
    this.isPaused = false;

    this.focusModule = null;
    this.focusFunction = null;
    this.currentGraphMode = 'all';
    this.currentCardMode = 'list';
    this.searchQuery = '';

    // Инициализация менеджеров
    this.cardManager = null;
    this.graphManager = null;
    this.breadcrumbManager = null;
    this.graphModeManager = null;
    this.cardModeManager = null;

    window[SYM_APP] = this;
    window[SYM_READY] = false;

    this.init();
  }

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

    // ✅ Регистрируем API после инициализации
    this.registerAPI();

    console.log('✅ App initialized');
    console.log('📊 Данные готовы, модулей:', Object.keys(this.reportData?.packages || {}).length);
  }

  /**
   * Регистрирует API для безопасного доступа через Symbol
   */
  registerAPI() {
    const SYM_APP_API = Symbol.for('__AST_APP_API__');

    // ✅ Проверяем наличие методов
    console.log('🔍 Проверка методов App:');
    console.log('  - focusModule:', typeof this.focusModule);
    console.log('  - focusFunction:', typeof this.focusFunction);
    console.log('  - clearFocus:', typeof this.clearFocus);
    console.log('  - handleSearch:', typeof this.handleSearch);
    console.log('  - setGraphMode:', typeof this.setGraphMode);
    console.log('  - setCardMode:', typeof this.setCardMode);
    console.log('  - closeDetail:', typeof this.closeDetail);
    console.log('  - renderModules:', typeof this.renderModules);

    // Создаем API с методами
    const api = {};

  console.log(this);
  debugger
    // Добавляем методы, которые точно существуют
    if (typeof this.focusModule === 'function') {
      api.focusModule = this.focusModule.bind(this);
    } else {
      // Если метод отсутствует, создаем заглушку
      api.focusModule = path => {
        console.warn('⚠️ focusModule not yet initialized');
      };
    }

    if (typeof this.focusFunction === 'function') {
      api.focusFunction = this.focusFunction.bind(this);
    } else {
      api.focusFunction = (name, module) => {
        console.warn('⚠️ focusFunction not yet initialized');
      };
    }

    if (typeof this.clearFocus === 'function') {
      api.clearFocus = this.clearFocus.bind(this);
    } else {
      api.clearFocus = () => {
        console.warn('⚠️ clearFocus not yet initialized');
      };
    }

    if (typeof this.handleSearch === 'function') {
      api.handleSearch = this.handleSearch.bind(this);
    } else {
      api.handleSearch = query => {
        console.warn('⚠️ handleSearch not yet initialized');
      };
    }

    if (typeof this.setGraphMode === 'function') {
      api.setGraphMode = this.setGraphMode.bind(this);
    } else {
      api.setGraphMode = mode => {
        console.warn('⚠️ setGraphMode not yet initialized');
      };
    }

    if (typeof this.setCardMode === 'function') {
      api.setCardMode = this.setCardMode.bind(this);
    } else {
      api.setCardMode = mode => {
        console.warn('⚠️ setCardMode not yet initialized');
      };
    }

    if (typeof this.closeDetail === 'function') {
      api.closeDetail = this.closeDetail.bind(this);
    } else {
      api.closeDetail = () => {
        console.warn('⚠️ closeDetail not yet initialized');
      };
    }

    if (typeof this.renderModules === 'function') {
      api.renderModules = this.renderModules.bind(this);
    } else {
      api.renderModules = () => {
        console.warn('⚠️ renderModules not yet initialized');
      };
    }

    // ✅ ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ МЕТОДЫ
    if (typeof this.updateBreadcrumbs === 'function') {
      api.updateBreadcrumbs = this.updateBreadcrumbs.bind(this);
    } else {
      api.updateBreadcrumbs = (module, func) => {
        console.warn('⚠️ updateBreadcrumbs not yet initialized');
      };
    }

    if (typeof this.showDetail === 'function') {
      api.showDetail = this.showDetail.bind(this);
    } else {
      api.showDetail = data => {
        console.warn('⚠️ showDetail not yet initialized');
      };
    }

    // Добавляем менеджеры
    if (this.cardModeManager) {
      api.cardModeManager = this.cardModeManager;
    }
    if (this.graphModeManager) {
      api.graphModeManager = this.graphModeManager;
    }

    // Замораживаем API
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
  }

  showPlaceholder() {
    const grid = document.getElementById('modulesGrid');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #94a3b8;">
          <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
          <h3 style="color: #60a5fa; margin-bottom: 10px;">Нет данных</h3>
        </div>
      `;
    }
  }

  updateStats() {
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
  }

  setupModeListeners() {
    if (this.graphModeManager && typeof this.graphModeManager.onModeChange === 'function') {
      this.graphModeManager.onModeChange(mode => {
        this.currentGraphMode = mode;
        this.notifyModeChange('graph', mode);
      });
    }

    if (this.cardModeManager && typeof this.cardModeManager.onModeChange === 'function') {
      this.cardModeManager.onModeChange(mode => {
        this.currentCardMode = mode;
        this.notifyModeChange('card', mode);
      });
    }
  }

  notifyModeChange(type, mode) {
    const callback = window[SYM_MODE_CHANGE];
    if (typeof callback === 'function') {
      callback(type, mode);
    }
  }

  // ============================================================
  // ПУБЛИЧНЫЕ МЕТОДЫ
  // ============================================================

  focusModule(modulePath) {
    console.log('🎯 focusModule called:', modulePath);
    if (this.focusModule === modulePath) {
      this.clearFocus();
      return;
    }
    this.focusModule = modulePath;
    this.focusFunction = null;
    if (this.breadcrumbManager) {
      this.breadcrumbManager.updateBreadcrumbs(modulePath, null);
    }
    this.renderModules();
    if (this.graphManager) {
      this.graphManager.updateView();
    }
    this.updateFocusInfo(modulePath);
    this.scrollToModule(modulePath);
  }

  focusFunction(funcName, modulePath) {
    console.log('🎯 focusFunction called:', funcName, modulePath);
    if (this.focusFunction === funcName && this.focusModule === modulePath) {
      this.clearFocus();
      return;
    }
    this.focusFunction = funcName;
    this.focusModule = modulePath;
    if (this.breadcrumbManager) {
      this.breadcrumbManager.updateBreadcrumbs(modulePath, funcName);
    }
    this.renderModules();
    if (this.graphManager) {
      this.graphManager.updateView();
    }
    this.updateFocusInfo(modulePath, funcName);
    this.showFunctionDetail(funcName, modulePath);
    this.scrollToFunction(funcName, modulePath);
  }

  clearFocus() {
    console.log('🧹 clearFocus called');
    this.focusModule = null;
    this.focusFunction = null;
    if (this.breadcrumbManager) {
      this.breadcrumbManager.updateBreadcrumbs(null, null);
    }
    this.renderModules();
    if (this.graphManager) {
      this.graphManager.updateView();
    }
    this.hideFocusInfo();
    this.closeDetail();
  }

  handleSearch(query) {
    console.log('🔍 handleSearch called:', query);
    this.searchQuery = query;
    this.renderModules();
    if (this.graphManager) {
      this.graphManager.handleSearch(query);
    }
  }

  setGraphMode(mode) {
    console.log('📊 setGraphMode called:', mode);
    if (this.graphModeManager && typeof this.graphModeManager.setMode === 'function') {
      this.graphModeManager.setMode(mode);
    }
  }

  setCardMode(mode) {
    console.log('📋 setCardMode called:', mode);
    if (this.cardModeManager && typeof this.cardModeManager.setMode === 'function') {
      this.cardModeManager.setMode(mode);
      this.renderModules();
    }
  }

  closeDetail() {
    console.log('❌ closeDetail called');
    const panel = document.getElementById('detailPanel');
    if (panel) {
      panel.classList.remove('active');
    }
  }

  renderModules() {
    console.log('🔄 renderModules called');
    if (this.cardManager && typeof this.cardManager.renderModules === 'function') {
      this.cardManager.renderModules();
    }
  }

  // ============================================================
  // УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ
  // ============================================================

  dispose() {
    console.log('🧹 Disposing...');
    if (this.graphManager?.getSimulation) {
      const sim = this.graphManager.getSimulation();
      if (sim && typeof sim.stop === 'function') {
        sim.stop();
      }
    }
    this.isInitialized = false;
    window[SYM_READY] = false;
  }

  pause() {
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
  }

  resume() {
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
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  updateFocusInfo(modulePath, funcName = null) {
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
  }

  hideFocusInfo() {
    const info = document.getElementById('focusInfo');
    if (info) {
      info.classList.remove('active');
    }
  }

  showFunctionDetail(funcName, modulePath) {
    const funcData = this.findFunctionData(funcName, modulePath);
    if (funcData && this.cardManager && typeof this.cardManager.showDetail === 'function') {
      this.cardManager.showDetail(funcData);
    }
  }

  findFunctionData(funcName, modulePath) {
    const pkg = this.reportData?.packages?.[modulePath];
    if (!pkg) {
      return null;
    }
    const funcs = pkg.entities?.functions || [];
    return funcs.find(f => f.name === funcName) || null;
  }

  scrollToModule(modulePath) {
    const card = document.querySelector(`.module-card[data-module="${modulePath}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  scrollToFunction(funcName, modulePath) {
    const el = document.querySelector(
      `.func-item[data-func="${funcName}"][data-module="${modulePath}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  setupKeyboard() {
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
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ HTML
  // ============================================================

  escapeHtml(str) {
    if (!str) {
      return '';
    }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeJs(str) {
    if (!str) {
      return '';
    }
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
  }
}

// ============================================================
// ЗАПУСК С ИСПОЛЬЗОВАНИЕМ APPINIT
// ============================================================

// Проверяем, что приложение еще не создано
if (!window[SYM_APP]) {
  console.log('🚀 Создание приложения...');

  try {
    const app = new App();
    console.log('🚀 App loaded');

    // ✅ ЯВНО УСТАНАВЛИВАЕМ ФЛАГ ГОТОВНОСТИ (уже установлен в конструкторе)
    // но убеждаемся, что он true
    if (!window[SYM_READY]) {
      window[SYM_READY] = true;
    }

    console.log('🔑 Доступ через: window[Symbol.for("__AST_APP_API__")]');
    console.log('🔑 Или через: AppInitializer.ready() из модуля AppInit.js');
  } catch (error) {
    console.error('❌ Failed to initialize App:', error);
    // Создаем аварийный API
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
    ].forEach(method => {
      fallbackApi[method] = function (...args) {
        console.warn(`⚠️ App not ready, ${method} called with:`, args);
      };
    });
    window[SYM_APP_API] = fallbackApi;

    // Показываем сообщение об ошибке
    const container = document.querySelector('.container');
    if (container) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        background: #fef2f2;
        color: #991b1b;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #fecaca;
        text-align: center;
      `;
      errorDiv.innerHTML = `
        <h3>⚠️ Ошибка инициализации приложения</h3>
        <p style="margin-top: 10px; font-size: 14px;">
          ${error.message || 'Неизвестная ошибка'}
        </p>
        <button onclick="location.reload()" style="
          margin-top: 10px;
          padding: 8px 20px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        ">Обновить</button>
      `;
      container.prepend(errorDiv);
    }
  }
} else {
  console.log('ℹ️ Приложение уже создано');
  // ✅ Убеждаемся, что флаг готовности установлен
  window[SYM_READY] = true;
}

// ============================================================
// ЭКСПОРТ ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ (опционально)
// ============================================================

// Экспортируем класс App для возможности создания экземпляров
export { App };

// Экспортируем символы для доступа
export {
  SYM_APP,
  SYM_READY,
  SYM_MODE_CHANGE,
  SYM_REPORT_DATA,
  SYM_FUNCTIONS_DATA,
  SYM_DATA_VERSION,
};

// Экспортируем данные
export { REPORT_DATA, ALL_FUNCTIONS_DATA };

console.log('📦 Модуль interactive-report.js загружен');
console.log('📌 Статус приложения:', window[SYM_READY] ? '✅ ГОТОВ' : '⏳ ЗАГРУЗКА...');
