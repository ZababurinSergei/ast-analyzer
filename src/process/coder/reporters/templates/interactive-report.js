// packages/ast-analyzer/src/reporters/templates/interactive-report.js

import context from './entities.json' with { type: 'json' };
import 'd3';
const d3 = window.d3;

// Импорт модулей
import { CardManager } from './modules/CardManager.js';
import { VisGraphManager } from './modules/VisGraphManager.js';
import { BreadcrumbManager } from './modules/BreadcrumbManager.js';
import { GraphModeManager } from './modules/GraphModeManager.js';
import { CardModeManager } from './modules/CardModeManager.js';
import { Router } from './modules/Router.js';
import { LocationBar } from './modules/LocationBar.js';
import { GraphSwitcher } from './modules/GraphSwitcher.js';
import { SphereGraphManager } from './modules/SphereGraphManager.js';

// ============================================================
// СИМВОЛЫ ДЛЯ ГЛОБАЛЬНОГО ДОСТУПА
// ============================================================
const SYM_APP = Symbol.for('__AST_APP__');
const SYM_READY = Symbol.for('__AST_APP_READY__');
const SYM_MODE_CHANGE = Symbol.for('__AST_MODE_CHANGE__');
const SYM_REPORT_DATA = Symbol.for('__AST_INTERACTIVE_REPORT_DATA__');
const SYM_FUNCTIONS_DATA = Symbol.for('__AST_INTERACTIVE_FUNCTIONS_DATA__');
const SYM_DATA_VERSION = Symbol.for('__AST_INTERACTIVE_DATA_VERSION__');
const SYM_ROUTER = Symbol.for('__AST_ROUTER__');
const SYM_LOCATION_BAR = Symbol.for('__AST_LOCATION_BAR__');
const SYM_ROUTE_CHANGE = Symbol.for('__AST_ROUTE_CHANGE__');

// ============================================================
// АДАПТЕР ДАННЫХ (ВСТРОЕННЫЙ)
// ============================================================

/**
 * Преобразует новый формат данных в старый (с packages)
 */
function adaptData(rawData) {
  console.log('🔄 Адаптация данных из нового формата...');

  const result = {
    packages: {},
    dependencyGraph: {
      direction: 'bidirectional',
      inwardDependencies: {},
      outwardDependencies: {},
    },
    entityStats: {
      totalFunctions: 0,
      totalConstants: 0,
      totalVariables: 0,
      totalInterfaces: 0,
      totalTypes: 0,
      totalClasses: 0,
      totalCalls: 0,
      totalExportedFunctions: 0,
      totalAsyncFunctions: 0,
    },
    fileStats: {
      totalFiles: 0,
      totalSize: 0,
      totalLines: 0,
    },
    timestamp: new Date().toISOString(),
    version: rawData.version || '3.0.0',
    name: 'ast-analyzer',
    lockfileVersion: 3,
  };

  // Если уже есть packages - возвращаем как есть
  if (rawData.packages) {
    console.log('✅ Данные уже в формате packages');
    return rawData;
  }

  // 1. Строим карты
  const functionIndex = rawData.functionIndex || {};
  const fileIndex = rawData.fileIndex || {};
  const moduleIndex = rawData.moduleIndex || {};
  const entities = rawData.entities || {};
  const callEdges = rawData.callGraph?.edges || [];
  const importEdges = rawData.importGraph?.edges || [];

  console.log(`  📊 Функций: ${Object.keys(functionIndex).length}`);
  console.log(`  📁 Файлов: ${Object.keys(fileIndex).length}`);
  console.log(`  📦 Модулей: ${Object.keys(moduleIndex).length}`);
  console.log(`  🔗 Связей вызовов: ${callEdges.length}`);
  console.log(`  🔗 Связей импортов: ${importEdges.length}`);

  // 2. Создаем структуру packages по файлам
  const fileFunctions = new Map();

  for (const [funcId, funcName] of Object.entries(functionIndex)) {
    const entityData = entities[funcId] || {};
    const fileId = entityData.file;

    if (!fileId) continue;

    if (!fileFunctions.has(fileId)) {
      fileFunctions.set(fileId, []);
    }

    fileFunctions.get(fileId).push({
      id: funcId,
      name: funcName,
      file: fileId,
      line: entityData.line || 0,
      kind: entityData.kind || 'function',
      isAsync: entityData.isAsync || false,
      isArrow: entityData.isArrow || false,
      isNested: entityData.isNested || false,
      depth: entityData.depth || 0,
      params: entityData.params || [],
      calledBy: entityData.calledBy || [],
      $t: entityData.$t || 'function_nested_1',
    });
  }

  // 3. Строим карту вызовов
  const callMap = new Map();
  for (const edge of callEdges) {
    if (!callMap.has(edge.from)) {
      callMap.set(edge.from, []);
    }
    callMap.get(edge.from).push(edge.to);
  }

  // 4. Создаем packages
  for (const [fileId, functions] of fileFunctions) {
    const filePath = fileIndex[fileId] || fileId;

    // Сортируем функции по линии
    functions.sort((a, b) => (a.line || 0) - (b.line || 0));

    // Определяем язык
    let language = 'unknown';
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) language = 'typescript';
    else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) language = 'javascript';
    else if (filePath.endsWith('.vue')) language = 'vue';
    else if (filePath.endsWith('.json')) language = 'json';

    // Проверяем, является ли файл точкой входа
    const isEntry =
      filePath.includes('cli.ts') || filePath.includes('index.ts') || filePath.includes('main.ts');

    // Создаем функции в старом формате
    const funcs = functions.map(f => {
      // Получаем вызовы для этой функции
      const calleeIds = callMap.get(f.id) || [];
      const calleeNames = calleeIds.map(id => functionIndex[id]).filter(Boolean);

      // Проверяем, экспортирована ли функция
      const isExported =
        f.name &&
        (f.name.startsWith('export_') ||
          f.name.includes('default') ||
          (f.$t && f.$t.includes('export')));

      return {
        name: f.name || '',
        params: f.params || [],
        paramTypes: [],
        line: f.line || 0,
        startLine: f.line || 0,
        endLine: f.line || 0,
        isAsync: f.isAsync || false,
        isExported: isExported,
        isMethod: f.kind === 'function_method' || f.kind === 'function_method_async',
        className: '',
        calls: calleeNames,
        calledBy: f.calledBy || [],
        returnType: 'any',
        body: '',
        isNested: f.isNested || false,
        parentFunction: undefined,
        isArrow: f.isArrow || false,
        isEventHandler: false,
        eventType: undefined,
        depth: f.depth || 0,
        complexity: 0,
      };
    });

    // Собираем экспорты
    const exports = {};
    for (const f of functions) {
      const isExported =
        f.name &&
        (f.name.startsWith('export_') ||
          f.name.includes('default') ||
          (f.$t && f.$t.includes('export')));
      if (isExported) {
        exports[f.name] = {
          type: 'function',
          isAsync: f.isAsync || false,
          params: f.params || [],
          returns: 'any',
          line: f.line || 0,
        };
      }
    }

    // Создаем пакет
    result.packages[filePath] = {
      resolved: `file:${filePath}`,
      displayPath: filePath,
      type: 'module',
      language: language,
      isEntry: isEntry,
      imports: {},
      exports: exports,
      entities: {
        functions: funcs,
        constants: [],
        variables: [],
        interfaces: [],
        types: [],
        classes: [],
      },
      fileStats: {
        size: 0,
        lines: functions.reduce((max, f) => Math.max(max, f.line || 0), 0),
        functions: functions.length,
        classes: 0,
        constants: 0,
        interfaces: 0,
        types: 0,
        variables: 0,
      },
    };
  }

  // 5. Добавляем импорты
  for (const edge of importEdges) {
    const fromPath = fileIndex[edge.from];
    const toPath = fileIndex[edge.to];

    if (fromPath && toPath && result.packages[fromPath]) {
      const pkg = result.packages[fromPath];
      if (!pkg.imports[toPath]) {
        pkg.imports[toPath] = {
          specifiers: [],
          line: edge.line || 0,
          type: edge.type || 'named',
        };
      }
      if (edge.specifiers) {
        pkg.imports[toPath].specifiers.push(...edge.specifiers);
      }
    }
  }

  // 6. Строим граф зависимостей
  const inwardDeps = {};
  const outwardDeps = {};

  for (const edge of importEdges) {
    const fromPath = fileIndex[edge.from];
    const toPath = fileIndex[edge.to];

    if (fromPath && toPath && result.packages[fromPath] && result.packages[toPath]) {
      if (!inwardDeps[toPath]) inwardDeps[toPath] = [];
      if (!inwardDeps[toPath].includes(fromPath)) {
        inwardDeps[toPath].push(fromPath);
      }

      if (!outwardDeps[fromPath]) outwardDeps[fromPath] = [];
      if (!outwardDeps[fromPath].includes(toPath)) {
        outwardDeps[fromPath].push(toPath);
      }
    }
  }

  result.dependencyGraph.inwardDependencies = inwardDeps;
  result.dependencyGraph.outwardDependencies = outwardDeps;

  // 7. Статистика
  let totalFunctions = 0;
  let totalCalls = 0;
  let totalExportedFunctions = 0;
  let totalAsyncFunctions = 0;

  for (const pkg of Object.values(result.packages)) {
    if (!pkg) continue;
    for (const func of pkg.entities.functions || []) {
      totalFunctions++;
      totalCalls += (func.calls || []).length;
      if (func.isExported) totalExportedFunctions++;
      if (func.isAsync) totalAsyncFunctions++;
    }
  }

  result.entityStats.totalFunctions = totalFunctions;
  result.entityStats.totalCalls = totalCalls;
  result.entityStats.totalExportedFunctions = totalExportedFunctions;
  result.entityStats.totalAsyncFunctions = totalAsyncFunctions;
  result.fileStats.totalFiles = Object.keys(result.packages).length;
  result.fileStats.totalLines = Object.values(result.packages).reduce(
    (sum, pkg) => sum + (pkg.fileStats?.lines || 0),
    0
  );

  console.log(
    `✅ Адаптация завершена: ${Object.keys(result.packages).length} пакетов, ${totalFunctions} функций`
  );

  return result;
}

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

const rawReportData = context;

// 🔥 АДАПТИРУЕМ ДАННЫЕ
console.log('🔄 Преобразование данных из нового формата...');
const REPORT_DATA = adaptData(rawReportData);

console.log('✅ Данные загружены и преобразованы');
console.log('📊 Модулей:', Object.keys(REPORT_DATA.packages || {}).length);

// Строим список всех функций
const ALL_FUNCTIONS_DATA = [];
for (const [modulePath, pkg] of Object.entries(REPORT_DATA.packages || {})) {
  if (!pkg) continue;
  for (const func of pkg.entities?.functions || []) {
    ALL_FUNCTIONS_DATA.push({ modulePath, func });
  }
}

console.log(`ƒ Функций: ${ALL_FUNCTIONS_DATA.length}`);

window[SYM_REPORT_DATA] = REPORT_DATA;
window[SYM_FUNCTIONS_DATA] = ALL_FUNCTIONS_DATA;
window[SYM_DATA_VERSION] = 1;

// ============================================================
// КЛАСС APP
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

    // Граф-менеджер будет установлен через GraphSwitcher
    this.graphManager = null;
    this.graphSwitcher = null;

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

      // Обновляем роутер
      if (this.router) {
        this.router.navigateToModule(modulePath);
      }

      if (this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumbs(modulePath, null);
      }
      this.renderModules();

      // Обновляем граф через переключатель
      if (this.graphManager && typeof this.graphManager.updateGraphWithFocus === 'function') {
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

      // Обновляем роутер
      if (this.router) {
        this.router.navigateToFunction(modulePath, funcName);
      }

      if (this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumbs(modulePath, funcName);
      }
      this.renderModules();

      // Обновляем граф через переключатель
      if (this.graphManager && typeof this.graphManager.updateGraphWithFocus === 'function') {
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

      // Обновляем роутер
      if (this.router) {
        this.router.navigateToUniverse();
      }

      if (this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumbs(null, null);
      }
      this.renderModules();

      // Обновляем граф через переключатель
      if (this.graphManager && typeof this.graphManager.updateGraphWithFocus === 'function') {
        this.graphManager.updateGraphWithFocus(null, null, 'all');
      }

      this.hideFocusInfo();
      this.closeDetail();
    };

    this.handleSearch = query => {
      console.log('🔍 handleSearch called:', query);
      this.searchQuery = query;

      // Обновляем роутер
      if (this.router) {
        if (query && query.trim()) {
          this.router.navigateToSearch(query);
        } else {
          this.router.navigateToUniverse();
        }
      }

      this.renderModules();

      // Обновляем граф через переключатель
      if (this.graphManager && typeof this.graphManager.handleSearch === 'function') {
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
      if (this.graphManager && typeof this.graphManager.updateGraphWithFocus === 'function') {
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
      const card = document.querySelector(`.module-card[data-module=\"${modulePath}\"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    this.scrollToFunction = (funcName, modulePath) => {
      const el = document.querySelector(
        `.func-item[data-func=\"${funcName}\"][data-module=\"${modulePath}\"]`
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
        // Alt+Left - назад
        if (e.altKey && e.key === 'ArrowLeft') {
          e.preventDefault();
          if (this.router && this.router.canGoBack()) {
            this.router.goBack();
          }
        }
        // Alt+Right - вперед
        if (e.altKey && e.key === 'ArrowRight') {
          e.preventDefault();
          if (this.router && this.router.canGoForward()) {
            this.router.goForward();
          }
        }
        // Alt+Home - домой
        if (e.altKey && e.key === 'Home') {
          e.preventDefault();
          if (this.router) {
            this.router.navigateToUniverse();
          }
          this.clearFocus();
        }
        // Ctrl+L - фокус на адресную строку
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
          e.preventDefault();
          if (this.locationBar && typeof this.locationBar._startEditing === 'function') {
            this.locationBar._startEditing();
          }
        }

        // 🆕 Горячие клавиши для переключения графов
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
          if (e.key === '1') {
            e.preventDefault();
            if (this.graphSwitcher) {
              this.graphSwitcher.switchTo('d3');
            }
          } else if (e.key === '2') {
            e.preventDefault();
            if (this.graphSwitcher) {
              this.graphSwitcher.switchTo('vis');
            }
          } else if (e.key === '3') {
            e.preventDefault();
            if (this.graphSwitcher) {
              this.graphSwitcher.switchTo('sphere');
            }
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
          if (this.graphManager && typeof this.graphManager.updateGraphWithFocus === 'function') {
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
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    this.escapeJs = str => {
      if (!str) {
        return '';
      }
      return String(str).replace(/\\/g, '\\\\').replace(/\"/g, '\\"').replace(/'/g, "\\'");
    };

    this.showPlaceholder = () => {
      const grid = document.getElementById('modulesGrid');
      if (grid) {
        grid.innerHTML = `
          <div style=\"grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #94a3b8;\">
            <div style=\"font-size: 48px; margin-bottom: 20px;\">📊</div>
            <h3 style=\"color: #60a5fa; margin-bottom: 10px;\">Нет данных</h3>
          </div>
        `;
      }
    };

    this.getFocusModule = () => this._focusModule;
    this.getFocusFunction = () => this._focusFunction;

    /**
     * Обновление графа при изменении фокуса или режима
     */
    this.updateView = () => {
      if (this.graphManager && typeof this.graphManager.updateView === 'function') {
        this.graphManager.updateView();
      }
      if (this.cardManager && typeof this.cardManager.renderModules === 'function') {
        this.cardManager.renderModules();
      }
    };

    /**
     * Переключение типа графа
     */
    this.switchGraph = (type) => {
      if (this.graphSwitcher && typeof this.graphSwitcher.switchTo === 'function') {
        this.graphSwitcher.switchTo(type);
        // Обновляем ссылку на менеджер
        this.graphManager = this.graphSwitcher.getCurrentManager();
      }
    };

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРОВ
    // ============================================================

    this.cardManager = null;
    this.graphManager = null;
    this.breadcrumbManager = null;
    this.graphModeManager = null;
    this.cardModeManager = null;
    this.router = null;
    this.locationBar = null;
    this.graphSwitcher = null;

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

    // 🆕 Инициализация роутера
    this.router = new Router();
    this.router.init(this);
    window[SYM_ROUTER] = this.router;

    // Инициализация менеджеров
    this.cardManager = new CardManager(this);
    this.breadcrumbManager = new BreadcrumbManager(this);
    this.graphModeManager = new GraphModeManager(this);
    this.cardModeManager = new CardModeManager(this);

    // 🆕 Инициализация переключателя графов
    this.graphSwitcher = new GraphSwitcher(this);
    this.graphSwitcher.init();

    // Получаем текущий менеджер графа
    this.graphManager = this.graphSwitcher.getCurrentManager();

    // 🆕 Инициализация адресной строки (после роутера)
    this.locationBar = new LocationBar(this);
    this.locationBar.init();
    window[SYM_LOCATION_BAR] = this.locationBar;

    this.updateStats();
    this.cardManager.init();
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

    // 🆕 Обновляем начальное состояние адресной строки
    if (this.router && this.locationBar) {
      const currentRoute = this.router.getCurrentRoute();
      if (currentRoute) {
        this.locationBar._updateDisplay(currentRoute);
        this.locationBar._updateInput(currentRoute);
        this.locationBar._updateNavButtons();
      }
    }

    console.log('✅ App initialized with GraphSwitcher');
    console.log('📊 Данные готовы, модулей:', Object.keys(this.reportData?.packages || {}).length);
    console.log('🧭 Текущий тип графа:', this.graphSwitcher?.getCurrentType());
    console.log('🔄 Переключение графов: Ctrl+1 (D3), Ctrl+2 (Vis), Ctrl+3 (Сфера)');
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
    console.log('  - switchGraph:', typeof this.switchGraph);
    console.log('  - updateView:', typeof this.updateView);

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

      // 🆕 Методы для работы с роутером
      getRouter: () => app.router,
      getLocationBar: () => app.locationBar,
      navigateTo: path => {
        if (app.router && typeof app.router.navigateToPath === 'function') {
          return app.router.navigateToPath(path);
        }
        console.warn('⚠️ navigateTo not yet initialized');
      },

      // 🆕 Методы для работы с переключателем графов
      getGraphSwitcher: () => app.graphSwitcher,
      switchGraph: type => {
        if (typeof app.switchGraph === 'function') {
          return app.switchGraph(type);
        }
        console.warn('⚠️ switchGraph not yet initialized');
      },
      getCurrentGraphType: () => {
        if (app.graphSwitcher) {
          return app.graphSwitcher.getCurrentType();
        }
        return null;
      },

      // 🆕 Обновление представления
      updateView: () => {
        if (typeof app.updateView === 'function') {
          return app.updateView();
        }
        console.warn('⚠️ updateView not yet initialized');
      },
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
    console.log('  - api.getRouter:', typeof api.getRouter);
    console.log('  - api.getLocationBar:', typeof api.getLocationBar);
    console.log('  - api.switchGraph:', typeof api.switchGraph);
    console.log('  - api.getCurrentGraphType:', typeof api.getCurrentGraphType);
    console.log('  - api.updateView:', typeof api.updateView);
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
    console.log(`📊 Загружено ${Object.keys(app.reportData.packages || {}).length} пакетов`);

    // Добавляем глобальный доступ к переключателю
    window.graphSwitcher = app.graphSwitcher;
    window.SphereGraph = app.graphManager;

    if (!window[SYM_READY]) {
      window[SYM_READY] = true;
    }

    console.log('🔑 Доступ через: window[Symbol.for("__AST_APP_API__")]');
    console.log('🔄 Переключатель графов: window.graphSwitcher');
    console.log('🌍 Доступ к сфере: window.SphereGraph');
    console.log('📌 Используйте: window.graphSwitcher.switchTo("sphere")');
    console.log('📌 Доступные типы: d3, vis, sphere');
    console.log('📌 Горячие клавиши: Ctrl+1 (D3), Ctrl+2 (Vis), Ctrl+3 (Сфера)');
    console.log('📊 Используется SphereGraphManager для 3D графа в сфере');

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
      'getRouter',
      'getLocationBar',
      'navigateTo',
      'switchGraph',
      'getCurrentGraphType',
      'updateView',
    ].forEach(method => {
      fallbackApi[method] = function (...args) {
        console.warn(`⚠️ App not ready, ${method} called with:`, args);
      };
    });
    window[SYM_APP_API] = fallbackApi;
  }
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
  SYM_ROUTER,
  SYM_LOCATION_BAR,
  SYM_ROUTE_CHANGE,
};
export { REPORT_DATA, ALL_FUNCTIONS_DATA };

console.log('📦 Модуль interactive-report.js загружен');
console.log('📌 Статус приложения:', window[SYM_READY] ? '✅ ГОТОВ' : '⏳ ЗАГРУЗКА...');
console.log('🔄 Доступные графы: D3 (2D), Vis (3D), Сфера (3D с векторами)');
console.log('🌍 SphereGraphManager использует Three.js и WebGL');
