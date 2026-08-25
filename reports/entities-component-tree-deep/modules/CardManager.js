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
 */
export class CardManager {
  constructor(app) {
    this.app = app;
    this.currentFocusModule = null;
    this.currentFocusFunction = null;
    this.navigationStack = [];
    this._expandedCallTrees = new Set();
    this._lastSource = null; // { module: string, function: string | null }
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

  // ============================================================
  // ПОИСК МОДУЛЯ ДЛЯ ЛЮБОЙ СУЩНОСТИ (функция, константа, переменная, интерфейс, тип, класс)
  // ============================================================
  findModuleForEntity(entityName) {
    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) return null;

    for (const [modulePath, pkg] of Object.entries(reportData.packages)) {
      if (!pkg) continue;

      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func.name === entityName) {
          return modulePath;
        }
      }

      const constants = pkg.entities?.constants || [];
      for (const constant of constants) {
        if (constant.name === entityName) {
          return modulePath;
        }
      }

      const variables = pkg.entities?.variables || [];
      for (const variable of variables) {
        if (variable.name === entityName) {
          return modulePath;
        }
      }

      const interfaces = pkg.entities?.interfaces || [];
      for (const interface_ of interfaces) {
        if (interface_.name === entityName) {
          return modulePath;
        }
      }

      const types = pkg.entities?.types || [];
      for (const type of types) {
        if (type.name === entityName) {
          return modulePath;
        }
      }

      const classes = pkg.entities?.classes || [];
      for (const class_ of classes) {
        if (class_.name === entityName) {
          return modulePath;
        }
      }
    }

    return null;
  }

  // ============================================================
  // ПОСТРОЕНИЕ ПОЛНОЙ КАРТЫ ВСЕХ ЭКСПОРТОВ ПО МОДУЛЯМ
  // ============================================================
  buildFullExportsMap() {
    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) return new Map();

    const exportMap = new Map();
    const moduleExportsMap = new Map();

    for (const [modulePath, pkg] of Object.entries(reportData.packages)) {
      if (!pkg) continue;
      const exportsSet = new Set();

      const pkgExports = pkg.exports || {};
      for (const [exportName, exportInfo] of Object.entries(pkgExports)) {
        exportsSet.add(exportName);
        exportMap.set(exportName, {
          module: modulePath,
          type: exportInfo.type || 'function',
          isExported: true,
          isAsync: exportInfo.isAsync || false,
          params: exportInfo.params || [],
          returns: exportInfo.returns || 'any',
          line: exportInfo.line || 0,
          consumers: exportInfo.consumers || [],
        });
      }

      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func.isExported && func.name) {
          exportsSet.add(func.name);
          if (!exportMap.has(func.name)) {
            exportMap.set(func.name, {
              module: modulePath,
              type: 'function',
              isExported: true,
              isAsync: func.isAsync || false,
              params: func.params || [],
              returns: func.returnType || 'any',
              line: func.line || 0,
              consumers: func.calledBy || [],
            });
          }
        }
      }

      const constants = pkg.entities?.constants || [];
      for (const constant of constants) {
        if (constant.isExported && constant.name) {
          exportsSet.add(constant.name);
          if (!exportMap.has(constant.name)) {
            exportMap.set(constant.name, {
              module: modulePath,
              type: 'constant',
              isExported: true,
              isAsync: false,
              params: [],
              returns: constant.type || 'any',
              line: constant.line || 0,
              consumers: [],
            });
          }
        }
      }

      const variables = pkg.entities?.variables || [];
      for (const variable of variables) {
        if (variable.isExported && variable.name) {
          exportsSet.add(variable.name);
          if (!exportMap.has(variable.name)) {
            exportMap.set(variable.name, {
              module: modulePath,
              type: 'variable',
              isExported: true,
              isAsync: false,
              params: [],
              returns: variable.type || 'any',
              line: variable.line || 0,
              consumers: [],
            });
          }
        }
      }

      const interfaces = pkg.entities?.interfaces || [];
      for (const interface_ of interfaces) {
        if (interface_.isExported && interface_.name) {
          exportsSet.add(interface_.name);
          if (!exportMap.has(interface_.name)) {
            exportMap.set(interface_.name, {
              module: modulePath,
              type: 'interface',
              isExported: true,
              isAsync: false,
              params: [],
              returns: 'interface',
              line: interface_.line || 0,
              consumers: [],
            });
          }
        }
      }

      const types = pkg.entities?.types || [];
      for (const type of types) {
        if (type.isExported && type.name) {
          exportsSet.add(type.name);
          if (!exportMap.has(type.name)) {
            exportMap.set(type.name, {
              module: modulePath,
              type: 'type',
              isExported: true,
              isAsync: false,
              params: [],
              returns: 'type',
              line: type.line || 0,
              consumers: [],
            });
          }
        }
      }

      const classes = pkg.entities?.classes || [];
      for (const class_ of classes) {
        if (class_.isExported && class_.name) {
          exportsSet.add(class_.name);
          if (!exportMap.has(class_.name)) {
            exportMap.set(class_.name, {
              module: modulePath,
              type: 'class',
              isExported: true,
              isAsync: false,
              params: [],
              returns: 'class',
              line: class_.line || 0,
              consumers: [],
            });
          }
        }
      }

      moduleExportsMap.set(modulePath, exportsSet);
    }

    return { exportMap, moduleExportsMap };
  }

  // ============================================================
  // ПОИСК ВСЕХ ИСПОЛЬЗОВАНИЙ ЭКСПОРТОВ
  // ============================================================
  findAllExportUsages(modulePath, exportsSet) {
    const reportData = this.app.reportData;
    if (!reportData) return { externalOutgoing: new Set(), externalIncoming: new Set() };

    const externalOutgoing = new Set();
    const externalIncoming = new Set();
    const currentExports = exportsSet || new Set();

    for (const [otherModulePath, otherPkg] of Object.entries(reportData.packages)) {
      if (otherModulePath === modulePath) continue;
      if (!otherPkg) continue;

      const otherImports = otherPkg.imports || {};
      for (const [importSource, importInfo] of Object.entries(otherImports)) {
        if (importSource === modulePath || importSource.includes(modulePath)) {
          const specifiers = importInfo.specifiers || [];
          for (const specifier of specifiers) {
            if (currentExports.has(specifier)) {
              externalOutgoing.add(specifier);
            }
          }
          if (importInfo.isNamespace) {
            for (const exp of currentExports) {
              externalOutgoing.add(exp);
            }
          }
        }
      }
    }

    for (const [otherModulePath, otherPkg] of Object.entries(reportData.packages)) {
      if (otherModulePath === modulePath) continue;
      if (!otherPkg) continue;

      const otherFuncs = otherPkg.entities?.functions || [];
      for (const otherFunc of otherFuncs) {
        if (!otherFunc || !otherFunc.name) continue;

        for (const call of otherFunc.calls || []) {
          if (currentExports.has(call)) {
            externalOutgoing.add(call);
          }
        }

        const body = otherFunc.body || '';
        for (const exp of currentExports) {
          if (body.includes(exp) && !externalOutgoing.has(exp)) {
            const regex = new RegExp(`\\b${this.escapeRegex(exp)}\\b`);
            if (regex.test(body)) {
              externalOutgoing.add(exp);
            }
          }
        }
      }
    }

    for (const [otherModulePath, otherPkg] of Object.entries(reportData.packages)) {
      if (otherModulePath === modulePath) continue;
      if (!otherPkg) continue;

      const otherExports = otherPkg.exports || {};
      for (const [exportName, exportInfo] of Object.entries(otherExports)) {
        const exportValue = exportInfo.value || exportInfo.from || '';
        if (currentExports.has(exportValue) || currentExports.has(exportName)) {
          externalOutgoing.add(exportName);
        }
      }
    }

    const interfaces = reportData.packages[modulePath]?.entities?.interfaces || [];
    for (const interface_ of interfaces) {
      if (!interface_ || !interface_.extends) continue;
      for (const ext of interface_.extends) {
        if (typeof ext === 'string' && currentExports.has(ext)) {
          externalOutgoing.add(ext);
        } else if (typeof ext === 'object' && ext.name && currentExports.has(ext.name)) {
          externalOutgoing.add(ext.name);
        }
      }
    }

    const classes = reportData.packages[modulePath]?.entities?.classes || [];
    for (const class_ of classes) {
      if (!class_) continue;

      if (class_.extends) {
        if (typeof class_.extends === 'string' && currentExports.has(class_.extends)) {
          externalOutgoing.add(class_.extends);
        } else if (
          typeof class_.extends === 'object' &&
          class_.extends.name &&
          currentExports.has(class_.extends.name)
        ) {
          externalOutgoing.add(class_.extends.name);
        }
      }

      if (class_.implements) {
        for (const impl of class_.implements) {
          if (typeof impl === 'string' && currentExports.has(impl)) {
            externalOutgoing.add(impl);
          } else if (typeof impl === 'object' && impl.name && currentExports.has(impl.name)) {
            externalOutgoing.add(impl.name);
          }
        }
      }
    }

    for (const [otherModulePath, otherPkg] of Object.entries(reportData.packages)) {
      if (otherModulePath === modulePath) continue;
      if (!otherPkg) continue;

      const otherFuncs = otherPkg.entities?.functions || [];
      for (const otherFunc of otherFuncs) {
        if (!otherFunc || !otherFunc.name) continue;

        const body = otherFunc.body || '';
        for (const exp of currentExports) {
          const patterns = [
            `:\\s*${this.escapeRegex(exp)}`,
            `as\\s+${this.escapeRegex(exp)}`,
            `:\\s*\\[\\s*\\]?\\s*${this.escapeRegex(exp)}`,
            `:\\s*\\{\\s*.*\\s*\\}\\s*`,
            `<\\s*${this.escapeRegex(exp)}\\s*>`,
          ];
          for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'g');
            if (regex.test(body) && !externalOutgoing.has(exp)) {
              externalOutgoing.add(exp);
              break;
            }
          }
        }
      }
    }

    const currentImports = reportData.packages[modulePath]?.imports || {};
    for (const [importSource, importInfo] of Object.entries(currentImports)) {
      const sourceModule = this.findModuleForEntity(importSource);
      if (sourceModule && sourceModule !== modulePath) {
        const specifiers = importInfo.specifiers || [];
        for (const specifier of specifiers) {
          externalIncoming.add(specifier);
        }
        if (importInfo.isNamespace) {
          const sourceExports = this.getModuleExports(sourceModule);
          for (const exp of sourceExports) {
            externalIncoming.add(exp);
          }
        }
      }
    }

    const funcs = reportData.packages[modulePath]?.entities?.functions || [];
    for (const func of funcs) {
      if (!func || !func.name) continue;
      for (const call of func.calls || []) {
        const callModule = this.findModuleForEntity(call);
        if (callModule && callModule !== modulePath) {
          externalIncoming.add(call);
        }
      }

      const body = func.body || '';
      for (const [otherModulePath, otherPkg] of Object.entries(reportData.packages)) {
        if (otherModulePath === modulePath) continue;
        if (!otherPkg) continue;

        const otherExports = this.getModuleExports(otherModulePath);
        for (const exp of otherExports) {
          if (body.includes(exp) && !externalIncoming.has(exp)) {
            const regex = new RegExp(`\\b${this.escapeRegex(exp)}\\b`);
            if (regex.test(body)) {
              externalIncoming.add(exp);
            }
          }
        }
      }
    }

    const callGraph = reportData.callGraph || {};
    for (const [caller, callees] of Object.entries(callGraph)) {
      if (!Array.isArray(callees)) continue;

      let isCallerInCurrentModule = false;
      const currentModuleFuncs = new Set();
      const pkg = reportData.packages?.[modulePath];
      if (pkg) {
        const funcs2 = pkg.entities?.functions || [];
        for (const func of funcs2) {
          if (func.name) {
            currentModuleFuncs.add(func.name);
          }
        }
      }

      for (const funcName of currentModuleFuncs) {
        if (caller === funcName) {
          isCallerInCurrentModule = true;
          break;
        }
      }

      if (isCallerInCurrentModule) {
        for (const callee of callees) {
          const calleeModule = this.findModuleForEntity(callee);
          if (calleeModule && calleeModule !== modulePath) {
            externalOutgoing.add(callee);
          } else if (!calleeModule) {
            if (!currentExports.has(callee)) {
              externalOutgoing.add(callee);
            }
          }
        }
      } else {
        for (const callee of callees) {
          let isCalleeInCurrentModule = false;
          for (const funcName of currentModuleFuncs) {
            if (callee === funcName) {
              isCalleeInCurrentModule = true;
              break;
            }
          }

          if (isCalleeInCurrentModule) {
            const callerModule = this.findModuleForEntity(caller);
            if (callerModule && callerModule !== modulePath) {
              externalIncoming.add(caller);
            }
          }
        }
      }
    }

    return { externalOutgoing, externalIncoming };
  }

  // ============================================================
  // ПОЛУЧЕНИЕ ВСЕХ ЭКСПОРТОВ МОДУЛЯ
  // ============================================================
  getModuleExports(modulePath) {
    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) return new Set();

    const pkg = reportData.packages[modulePath];
    if (!pkg) return new Set();

    const exportsSet = new Set();

    const pkgExports = pkg.exports || {};
    for (const exportName of Object.keys(pkgExports)) {
      exportsSet.add(exportName);
    }

    const funcs = pkg.entities?.functions || [];
    for (const func of funcs) {
      if (func.isExported && func.name) {
        exportsSet.add(func.name);
      }
    }

    const constants = pkg.entities?.constants || [];
    for (const constant of constants) {
      if (constant.isExported && constant.name) {
        exportsSet.add(constant.name);
      }
    }

    const variables = pkg.entities?.variables || [];
    for (const variable of variables) {
      if (variable.isExported && variable.name) {
        exportsSet.add(variable.name);
      }
    }

    const interfaces = pkg.entities?.interfaces || [];
    for (const interface_ of interfaces) {
      if (interface_.isExported && interface_.name) {
        exportsSet.add(interface_.name);
      }
    }

    const types = pkg.entities?.types || [];
    for (const type of types) {
      if (type.isExported && type.name) {
        exportsSet.add(type.name);
      }
    }

    const classes = pkg.entities?.classes || [];
    for (const class_ of classes) {
      if (class_.isExported && class_.name) {
        exportsSet.add(class_.name);
      }
    }

    return exportsSet;
  }

  // ============================================================
  // ПОИСК ВСЕХ СВЯЗЕЙ ЧЕРЕЗ callGraph
  // ============================================================
  findAllCallGraphRelations(modulePath) {
    const reportData = this.app.reportData;
    if (!reportData) return { outgoing: new Set(), incoming: new Set() };

    const callGraph = reportData.callGraph || {};
    const outgoing = new Set();
    const incoming = new Set();

    const currentModuleFuncs = new Set();
    const pkg = reportData.packages?.[modulePath];
    if (pkg) {
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func.name) {
          currentModuleFuncs.add(func.name);
        }
      }
    }

    for (const [caller, callees] of Object.entries(callGraph)) {
      let isCallerInCurrentModule = false;
      for (const funcName of currentModuleFuncs) {
        if (caller === funcName) {
          isCallerInCurrentModule = true;
          break;
        }
      }

      if (isCallerInCurrentModule && Array.isArray(callees)) {
        for (const callee of callees) {
          const calleeModule = this.findModuleForEntity(callee);
          if (calleeModule && calleeModule !== modulePath) {
            outgoing.add(callee);
          }
        }
      }
    }

    for (const [caller, callees] of Object.entries(callGraph)) {
      if (!Array.isArray(callees)) continue;

      for (const callee of callees) {
        let isCalleeInCurrentModule = false;
        for (const funcName of currentModuleFuncs) {
          if (callee === funcName) {
            isCalleeInCurrentModule = true;
            break;
          }
        }

        if (isCalleeInCurrentModule) {
          const callerModule = this.findModuleForEntity(caller);
          if (callerModule && callerModule !== modulePath) {
            incoming.add(caller);
          }
        }
      }
    }

    return { outgoing, incoming };
  }

  // ============================================================
  // ПОСТРОЕНИЕ ПОЛНОЙ КАРТЫ ВСЕХ СУЩНОСТЕЙ ПО МОДУЛЯМ
  // ============================================================
  buildFullEntityMap() {
    const reportData = this.app.reportData;
    if (!reportData || !reportData.packages) return new Map();

    const entityMap = new Map();
    const moduleEntityMap = new Map();

    for (const [modulePath, pkg] of Object.entries(reportData.packages)) {
      if (!pkg) continue;
      const entitySet = new Set();

      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (!func || !func.name) continue;
        entitySet.add(func.name);
        if (!entityMap.has(func.name)) {
          entityMap.set(func.name, new Set());
        }
        entityMap.get(func.name).add(modulePath);
      }

      const constants = pkg.entities?.constants || [];
      for (const constant of constants) {
        if (!constant || !constant.name) continue;
        entitySet.add(constant.name);
        if (!entityMap.has(constant.name)) {
          entityMap.set(constant.name, new Set());
        }
        entityMap.get(constant.name).add(modulePath);
      }

      const variables = pkg.entities?.variables || [];
      for (const variable of variables) {
        if (!variable || !variable.name) continue;
        entitySet.add(variable.name);
        if (!entityMap.has(variable.name)) {
          entityMap.set(variable.name, new Set());
        }
        entityMap.get(variable.name).add(modulePath);
      }

      const interfaces = pkg.entities?.interfaces || [];
      for (const interface_ of interfaces) {
        if (!interface_ || !interface_.name) continue;
        entitySet.add(interface_.name);
        if (!entityMap.has(interface_.name)) {
          entityMap.set(interface_.name, new Set());
        }
        entityMap.get(interface_.name).add(modulePath);
      }

      const types = pkg.entities?.types || [];
      for (const type of types) {
        if (!type || !type.name) continue;
        entitySet.add(type.name);
        if (!entityMap.has(type.name)) {
          entityMap.set(type.name, new Set());
        }
        entityMap.get(type.name).add(modulePath);
      }

      const classes = pkg.entities?.classes || [];
      for (const class_ of classes) {
        if (!class_ || !class_.name) continue;
        entitySet.add(class_.name);
        if (!entityMap.has(class_.name)) {
          entityMap.set(class_.name, new Set());
        }
        entityMap.get(class_.name).add(modulePath);
      }

      moduleEntityMap.set(modulePath, entitySet);
    }

    return { entityMap, moduleEntityMap };
  }

  // ============================================================
  // ПОИСК ВСЕХ СВЯЗАННЫХ СУЩНОСТЕЙ В ГРАФЕ
  // ============================================================
  findAllRelatedEntities(modulePath, entities) {
    const reportData = this.app.reportData;
    if (!reportData) return { externalOutgoing: new Set(), externalIncoming: new Set() };

    const { entityMap, moduleEntityMap } = this.buildFullEntityMap();
    const externalOutgoing = new Set();
    const externalIncoming = new Set();

    const currentModuleEntities = moduleEntityMap.get(modulePath) || new Set();

    const funcs = entities.functions || [];
    for (const func of funcs) {
      if (!func || !func.name) continue;

      for (const call of func.calls || []) {
        if (!currentModuleEntities.has(call)) {
          const targetModules = entityMap.get(call) || new Set();
          let foundInOther = false;

          for (const targetModule of targetModules) {
            if (targetModule !== modulePath) {
              externalOutgoing.add(call);
              foundInOther = true;
              break;
            }
          }

          if (!foundInOther && targetModules.size === 0) {
            externalOutgoing.add(call);
          }
        }
      }
    }

    for (const [otherModulePath, otherPkg] of Object.entries(reportData.packages)) {
      if (otherModulePath === modulePath) continue;
      if (!otherPkg) continue;

      const otherFuncs = otherPkg.entities?.functions || [];
      for (const otherFunc of otherFuncs) {
        if (!otherFunc || !otherFunc.name) continue;

        for (const call of otherFunc.calls || []) {
          if (currentModuleEntities.has(call)) {
            externalIncoming.add(otherFunc.name);
            break;
          }
        }
      }
    }

    const callGraph = reportData.callGraph || {};
    for (const [caller, callees] of Object.entries(callGraph)) {
      if (!Array.isArray(callees)) continue;

      for (const callee of callees) {
        if (currentModuleEntities.has(callee)) {
          const callerModule = this.findModuleForEntity(caller);
          if (callerModule && callerModule !== modulePath) {
            externalIncoming.add(caller);
          }
        }
      }

      if (currentModuleEntities.has(caller)) {
        for (const callee of callees) {
          const calleeModule = this.findModuleForEntity(callee);
          if (calleeModule && calleeModule !== modulePath) {
            externalOutgoing.add(callee);
          }
        }
      }
    }

    for (const func of funcs) {
      if (!func || !func.name) continue;

      for (const caller of func.calledBy || []) {
        const callerModule = this.findModuleForEntity(caller);
        if (callerModule && callerModule !== modulePath) {
          externalIncoming.add(caller);
        }
      }
    }

    return { externalOutgoing, externalIncoming };
  }

  // ============================================================
  // ПОИСК МОДУЛЯ ДЛЯ ФУНКЦИИ (с полным обходом графа)
  // ============================================================
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

    const callGraph = reportData.callGraph || {};
    for (const [callerName, callees] of Object.entries(callGraph)) {
      if (Array.isArray(callees) && callees.includes(funcName)) {
        for (const [modulePath, pkg] of Object.entries(reportData.packages)) {
          if (!pkg) continue;
          const funcs = pkg.entities?.functions || [];
          for (const func of funcs) {
            if (func.name === callerName) {
              return modulePath;
            }
          }
        }
      }
    }

    for (const [modulePath, pkg] of Object.entries(reportData.packages)) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (!func) continue;
        if (func.calledBy && func.calledBy.includes(funcName)) {
          return modulePath;
        }
        if (func.calls && func.calls.includes(funcName)) {
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

  // ============================================================
  // createModuleCard - с подсветкой активной функции и источника
  // ============================================================
  createModuleCard(modulePath, pkg, isActive, focusFunction) {
    const moduleCard = document.createElement('div');
    moduleCard.className = `module-card ${isActive ? 'active' : ''}`;
    moduleCard.dataset.module = modulePath;

    // Если есть источник навигации, добавляем класс has-active-function
    if (this._lastSource) {
      const srcModule = this._lastSource.module;
      if (srcModule === modulePath) {
        moduleCard.classList.add('has-source');
      }
    }

    if (!isActive) {
      moduleCard.onclick = () => this._focusModule(modulePath);
    }

    const funcs = pkg.entities?.functions || [];
    const constants = pkg.entities?.constants || [];
    const variables = pkg.entities?.variables || [];
    const interfaces = pkg.entities?.interfaces || [];
    const types = pkg.entities?.types || [];
    const classes = pkg.entities?.classes || [];

    const isEntry = pkg.isEntry || false;
    const displayName = pkg.displayPath || modulePath.split('/').pop() || modulePath;
    const language = pkg.language || 'javascript';
    const lines = pkg.fileStats?.lines || 0;

    const level = this.getModuleLevel(modulePath);
    const levelDisplay = level === 0 ? '🌌' : `📁 L${level}`;
    const levelClass = `level-${Math.min(level, 5)}`;

    const totalFuncs = funcs.length;
    const totalClasses = classes.length;
    const totalConstants = constants.length;
    const totalInterfaces = interfaces.length;
    const totalTypes = types.length;
    const totalVariables = variables.length;

    const exportsList = pkg.exports ? Object.keys(pkg.exports) : [];
    const exportedFunctions = funcs.filter(f => f.isExported);
    const allExports = [...new Set([...exportsList, ...exportedFunctions.map(f => f.name)])];

    // Источник навигации для отображения в карточке
    let sourceInfo = null;
    if (this._lastSource) {
      sourceInfo = {
        module: this._lastSource.module,
        function: this._lastSource.function || null,
      };
    }

    const dependencyGraph = this.app.reportData?.dependencyGraph || {};
    const inwardDeps = dependencyGraph.inwardDependencies || {};
    const outwardDeps = dependencyGraph.outwardDependencies || {};

    const moduleImporters = new Set();
    if (inwardDeps[modulePath]) {
      for (const dep of inwardDeps[modulePath] || []) {
        if (this.app.reportData?.packages?.[dep]) {
          moduleImporters.add(dep);
        }
      }
    }

    const moduleImports = new Set();
    if (outwardDeps[modulePath]) {
      for (const dep of outwardDeps[modulePath] || []) {
        if (this.app.reportData?.packages?.[dep]) {
          moduleImports.add(dep);
        }
      }
    }

    const currentExports = this.getModuleExports(modulePath);
    const callGraphRelations = this.findAllCallGraphRelations(modulePath);
    const exportUsages = this.findAllExportUsages(modulePath, currentExports);
    const entities = { functions: funcs, constants, variables, interfaces, types, classes };
    const relatedEntities = this.findAllRelatedEntities(modulePath, entities);

    const externalOutgoing = new Set([
      ...callGraphRelations.outgoing,
      ...exportUsages.externalOutgoing,
      ...relatedEntities.externalOutgoing,
    ]);

    const externalIncoming = new Set([
      ...callGraphRelations.incoming,
      ...exportUsages.externalIncoming,
      ...relatedEntities.externalIncoming,
    ]);

    const internalOutgoing = new Set();
    const internalIncoming = new Set();
    const funcNames = new Set(funcs.map(f => f.name));

    const callSources = new Map();
    for (const func of funcs) {
      if (!func || !func.name) continue;
      const source = this.getCallSource(func.name, modulePath, funcs);
      callSources.set(func.name, source);
    }

    for (const func of funcs) {
      if (!func || !func.name) continue;
      for (const call of func.calls || []) {
        if (funcNames.has(call)) {
          internalOutgoing.add(call);
        }
      }
    }

    for (const func of funcs) {
      if (!func || !func.name) continue;
      for (const caller of func.calledBy || []) {
        if (funcNames.has(caller)) {
          internalIncoming.add(caller);
        }
      }
    }

    const totalInternal = internalOutgoing.size + internalIncoming.size;

    const headerHtml = this.headerRenderer.render({
      isActive,
      isEntry,
      displayName,
      levelClass,
      levelDisplay,
      modulePath,
      pkg,
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
      modulePath,
      pkg,
    });

    // Передаем sourceInfo в functionsList для подсветки
    const functionsListHtml = this.functionsListRenderer.render({
      funcs,
      isActive,
      modulePath,
      focusFunction,
      sourceInfo,
      callSources,
      totalFuncs,
      pkg,
    });

    const navExportsHtml = this.navExportsRenderer.render({
      allExports,
      modulePath,
      pkg,
    });

    const navModuleImportersHtml = this.navModuleImportersRenderer.render({
      moduleImporters,
      modulePath,
      pkg,
      reportData: this.app.reportData,
    });

    const navExternalHtml = this.navExternalRenderer.render({
      externalOutgoing,
      externalIncoming,
      modulePath,
      funcs,
      callSources,
      pkg,
      reportData: this.app.reportData,
    });

    const navInternalHtml = this.navInternalRenderer.render({
      internalOutgoing,
      internalIncoming,
      isActive,
      callSources,
      modulePath,
      pkg,
    });

    const callTreeHtml = this.callTreeRenderer.render({
      isActive,
      focusFunction,
      funcs,
      modulePath,
      pkg,
    });

    moduleCard.innerHTML = `
        ${headerHtml}
        ${badgesHtml}
        ${functionsListHtml}
        ${callTreeHtml}
        ${navModuleImportersHtml}
        ${navExternalHtml}
        ${navInternalHtml}
        ${navExportsHtml}
    `;

    return moduleCard;
  }

  // ============================================================
  // focusModule - с сохранением источника навигации
  // ============================================================
  focusModule(modulePath) {
    // Сохраняем источник навигации перед переходом
    if (this.currentFocusModule || this.currentFocusFunction) {
      this._lastSource = {
        module: this.currentFocusModule,
        function: this.currentFocusFunction || null,
      };
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

  // ============================================================
  // focusFunction - с сохранением источника навигации и подсветкой
  // ============================================================
  focusFunction(funcName, modulePath) {
    // Сохраняем источник навигации перед переходом
    if (this.currentFocusModule || this.currentFocusFunction) {
      this._lastSource = {
        module: this.currentFocusModule,
        function: this.currentFocusFunction || null,
      };
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

    // Подсветка: активная функция и источник
    document.querySelectorAll('.func-item').forEach(el => {
      const isActive = el.dataset.func === funcName && el.dataset.module === modulePath;

      // Проверяем, является ли эта функция источником навигации
      const isSource =
        this._lastSource &&
        el.dataset.func === this._lastSource.function &&
        el.dataset.module === this._lastSource.module;

      el.classList.toggle('active', isActive);
      el.classList.toggle('source', isSource);
    });

    // Подсветка карточки-источника
    if (this._lastSource) {
      document.querySelectorAll('.module-card').forEach(c => {
        const isSourceModule = c.dataset.module === this._lastSource.module;
        c.classList.toggle('has-source', isSourceModule);
      });
    }

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
      ? ` | откуда: ${this._lastSource.function || this._lastSource.module}`
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
      c.classList.remove('has-source');
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

  escapeRegex(str) {
    if (!str) return '';
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
