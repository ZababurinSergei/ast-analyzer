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
// СИМВОЛЫ ДЛЯ ДАННЫХ И ПРИЛОЖЕНИЯ
// ============================================================
const SYM_REPORT_DATA = Symbol.for('__AST_INTERACTIVE_REPORT_DATA__');
const SYM_FUNCTIONS_DATA = Symbol.for('__AST_INTERACTIVE_FUNCTIONS_DATA__');
const SYM_DATA_VERSION = Symbol.for('__AST_INTERACTIVE_DATA_VERSION__');
const SYM_APP_INSTANCE = Symbol.for('__AST_INTERACTIVE_APP_INSTANCE__');

// ============================================================
// ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПРИЛОЖЕНИЯ
// ============================================================
function getApp() {
  const app = globalThis[SYM_APP_INSTANCE];
  if (app && app._isApp === true) {
    return app;
  }
  return null;
}

globalThis.getApp = getApp;

// ============================================================
// ЗАГРУЗКА И ПРЕОБРАЗОВАНИЕ ДАННЫХ
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
  console.log('🔄 Используем DataConverter для обработки данных...');

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

globalThis[SYM_REPORT_DATA] = REPORT_DATA;
globalThis[SYM_FUNCTIONS_DATA] = ALL_FUNCTIONS_DATA;
globalThis[SYM_DATA_VERSION] = 1;

// ============================================================
// ОСНОВНОЙ КЛАСС APP
// ============================================================

class App {
  constructor() {
    this._isApp = true;
    this.reportData = REPORT_DATA;
    this.allFunctionsData = ALL_FUNCTIONS_DATA;
    this.isInitialized = false;

    // Инициализация менеджеров
    this.cardManager = new CardManager(this);
    this.graphManager = new GraphManager(this);
    this.breadcrumbManager = new BreadcrumbManager(this);
    this.graphModeManager = new GraphModeManager(this);
    this.cardModeManager = new CardModeManager(this);

    globalThis[SYM_APP_INSTANCE] = this;

    if (!globalThis.getApp) {
      globalThis.getApp = getApp;
    }

    this.init();
  }

  init() {
    this.reportData = globalThis[SYM_REPORT_DATA];
    const allFunctionsData = globalThis[SYM_FUNCTIONS_DATA] || [];

    if (!this.reportData) {
      this.showPlaceholder();
      return;
    }

    this.updateStats();

    // Инициализация менеджеров
    this.cardManager.init();
    this.graphManager.init();
    this.breadcrumbManager.init();

    // Настройка режимов
    this.graphModeManager.init();
    this.cardModeManager.init();

    this.setupKeyboard();
    this.isInitialized = true;

    console.log('✅ AST Interactive Report initialized');
    console.log(
      '🔑 App instance available via: globalThis[Symbol.for("__AST_INTERACTIVE_APP_INSTANCE__")]',
    );
  }

  showPlaceholder() {
    const grid = document.getElementById('modulesGrid');
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
        <h3 style="color: #60a5fa; margin-bottom: 10px;">Нет данных для отображения</h3>
        <p style="font-size: 14px; max-width: 500px; margin: 0 auto;">
          Данные не загружены. Убедитесь, что файл package-lock-report.json существует.
        </p>
      </div>
    `;
    document.getElementById('d3GraphWrapper').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-size:16px;">
        📊 Нет данных для отображения графа
      </div>
    `;
  }

  updateStats() {
    if (!this.reportData) {
      return;
    }
    const stats = this.reportData.fileStats || {};
    const entityStats = this.reportData.entityStats || {};

    document.getElementById('statModules').textContent = stats.totalFiles || 0;
    document.getElementById('statFunctions').textContent = entityStats.totalFunctions || 0;
    document.getElementById('statCalls').textContent = entityStats.totalCalls || 0;
    document.getElementById('statExported').textContent = entityStats.totalExportedFunctions || 0;
    document.getElementById('statAsync').textContent = entityStats.totalAsyncFunctions || 0;
    document.getElementById('statLines').textContent = stats.totalLines || 0;
    document.getElementById('statSize').textContent = ((stats.totalSize || 0) / 1024).toFixed(2);
  }

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

  // ============================================================
  // МЕТОДЫ-МОСТЫ К МЕНЕДЖЕРАМ
  // ============================================================

  // Карточки
  renderModules() {
    this.cardManager.renderModules();
  }

  focusModule(modulePath) {
    this.cardManager.focusModule(modulePath);
  }

  focusFunction(funcName, modulePath) {
    this.cardManager.focusFunction(funcName, modulePath);
  }

  // ✅ ОБНОВЛЕНО: clearFocus теперь обновляет breadcrumbs
  clearFocus() {
    this.cardManager.clearFocus();
    this.breadcrumbManager.clear();
    this.breadcrumbManager.updateBreadcrumbs(null, null);
    this.graphManager.updateView();
  }

  showDetail(data) {
    this.cardManager.showDetail(data);
  }

  closeDetail() {
    this.cardManager.closeDetail();
  }

  // Граф
  initGraph() {
    this.graphManager.initGraph();
  }

  updateView() {
    this.graphManager.updateView();
  }

  setMode(mode) {
    this.graphModeManager.setMode(mode);
  }

  handleSearch(query) {
    this.graphManager.handleSearch(query);
  }

  // Breadcrumbs
  updateBreadcrumbs(modulePath, funcName) {
    this.breadcrumbManager.updateBreadcrumbs(modulePath, funcName);
  }

  // ============================================================
  // КЛАВИАТУРА
  // ============================================================

  setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.clearFocus();
        this.closeDetail();
      }
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }
    });
    document.addEventListener('click', e => {
      const panel = document.getElementById('detailPanel');
      if (
        panel.classList.contains('active') &&
        !panel.contains(e.target) &&
        !e.target.closest('.func-item')
      ) {
        this.closeDetail();
      }
    });
  }
}

// ============================================================
// ЗАПУСК
// ============================================================

if (!globalThis.getApp) {
  globalThis.getApp = getApp;
}

const app = new App();

console.log('🚀 AST Interactive Report loaded');
console.log(`🔑 App instance: ${globalThis[SYM_APP_INSTANCE] ? '✅' : '❌'}`);
console.log(`🔑 getApp() available: ${typeof globalThis.getApp === 'function' ? '✅' : '❌'}`);
