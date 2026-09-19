// packages/ast-analyzer/src/reporters/templates/modules/CallGraphUtils.js

/**
 * CallGraphUtils - утилита для работы с callGraph в report.json
 *
 * Основные функции:
 * - Получение вызовов для функции (calls)
 * - Получение вызывающих для функции (calledBy)
 * - Получение вызовов для модуля
 * - Поиск модуля по имени функции
 * - Кэширование для быстрого доступа
 */
export class CallGraphUtils {
  constructor(reportData) {
    this.reportData = reportData;
    this.functionIndex = reportData?.functionIndex || {};
    this.callEdges = reportData?.callGraph?.edges || [];
    this.packages = reportData?.packages || {};

    // Кэши для быстрого доступа
    this._idToNameCache = new Map();
    this._nameToIdCache = new Map();
    this._callsCache = new Map();
    this._calledByCache = new Map();
    this._moduleCallsCache = new Map();
    this._functionModuleCache = new Map();

    // Инициализация кэша
    this._buildCache();

    console.log(
      `📊 CallGraphUtils initialized: ${this.callEdges.length} edges, ${Object.keys(this.functionIndex).length} functions`
    );
  }

  /**
   * Построение кэша для быстрого доступа
   */
  _buildCache() {
    // Строим кэш ID -> Name
    for (const [id, name] of Object.entries(this.functionIndex)) {
      this._idToNameCache.set(id, name);
      this._nameToIdCache.set(name, id);
    }

    // Строим кэш для вызовов функций
    for (const edge of this.callEdges) {
      const fromName = this.getFunctionNameById(edge.from);
      const toName = this.getFunctionNameById(edge.to);

      if (!fromName || !toName) continue;

      // Кэшируем исходящие вызовы
      if (!this._callsCache.has(fromName)) {
        this._callsCache.set(fromName, new Set());
      }
      this._callsCache.get(fromName).add(toName);

      // Кэшируем входящие вызовы (calledBy)
      if (!this._calledByCache.has(toName)) {
        this._calledByCache.set(toName, new Set());
      }
      this._calledByCache.get(toName).add(fromName);
    }

    // Строим кэш для модулей
    for (const [modulePath, pkg] of Object.entries(this.packages)) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      const moduleFuncs = new Set(funcs.map(f => f.name));

      // Кэшируем функции модуля
      for (const funcName of moduleFuncs) {
        if (!this._functionModuleCache.has(funcName)) {
          this._functionModuleCache.set(funcName, modulePath);
        }
      }

      // Строим кэш вызовов для модуля
      const outgoing = new Set();
      const incoming = new Set();

      for (const edge of this.callEdges) {
        const fromName = this.getFunctionNameById(edge.from);
        const toName = this.getFunctionNameById(edge.to);

        if (!fromName || !toName) continue;

        if (moduleFuncs.has(fromName) && !moduleFuncs.has(toName)) {
          outgoing.add(toName);
        }
        if (moduleFuncs.has(toName) && !moduleFuncs.has(fromName)) {
          incoming.add(fromName);
        }
      }

      this._moduleCallsCache.set(modulePath, {
        outgoing: [...outgoing],
        incoming: [...incoming],
      });
    }
  }

  /**
   * Получить имя функции по ID
   * @param {string} id - ID функции из functionIndex
   * @returns {string|null} Имя функции или null
   */
  getFunctionNameById(id) {
    if (this._idToNameCache.has(id)) {
      return this._idToNameCache.get(id);
    }
    const name = this.functionIndex[id];
    if (name) {
      this._idToNameCache.set(id, name);
      this._nameToIdCache.set(name, id);
    }
    return name || null;
  }

  /**
   * Получить ID функции по имени
   * @param {string} name - Имя функции
   * @returns {string|null} ID функции или null
   */
  getFunctionIdByName(name) {
    if (this._nameToIdCache.has(name)) {
      return this._nameToIdCache.get(name);
    }
    for (const [id, funcName] of Object.entries(this.functionIndex)) {
      if (funcName === name) {
        this._nameToIdCache.set(name, id);
        this._idToNameCache.set(id, name);
        return id;
      }
    }
    return null;
  }

  /**
   * Получить все вызовы для функции (кто кого вызывает)
   * @param {string} funcName - Имя функции
   * @param {string} modulePath - Путь к модулю (опционально)
   * @returns {string[]} Массив имен вызываемых функций
   */
  getCallsForFunction(funcName, modulePath = null) {
    const cacheKey = modulePath ? `${funcName}#${modulePath}` : funcName;

    if (this._callsCache.has(cacheKey)) {
      return [...this._callsCache.get(cacheKey)];
    }

    // Если есть в глобальном кэше
    if (this._callsCache.has(funcName)) {
      const calls = [...this._callsCache.get(funcName)];

      // Если указан модуль, фильтруем
      if (modulePath) {
        const filtered = calls.filter(call => {
          const callModule = this.findModuleForFunction(call);
          return callModule === modulePath;
        });
        this._callsCache.set(cacheKey, new Set(filtered));
        return filtered;
      }

      return calls;
    }

    // Fallback: ищем вручную
    const funcId = this.getFunctionIdByName(funcName);
    if (!funcId) return [];

    const calls = new Set();
    for (const edge of this.callEdges) {
      if (edge.from === funcId) {
        const toName = this.getFunctionNameById(edge.to);
        if (toName) {
          // Если указан модуль, проверяем, что вызываемая функция в том же модуле
          if (modulePath) {
            const toModule = this.findModuleForFunction(toName);
            if (toModule === modulePath) {
              calls.add(toName);
            }
          } else {
            calls.add(toName);
          }
        }
      }
    }

    const result = [...calls];
    this._callsCache.set(cacheKey, new Set(result));
    return result;
  }

  /**
   * Получить все вызывающие функции (кто вызывает данную функцию)
   * @param {string} funcName - Имя функции
   * @param {string} modulePath - Путь к модулю (опционально)
   * @returns {string[]} Массив имен вызывающих функций
   */
  getCalledByForFunction(funcName, modulePath = null) {
    const cacheKey = modulePath ? `${funcName}#${modulePath}` : funcName;

    if (this._calledByCache.has(cacheKey)) {
      return [...this._calledByCache.get(cacheKey)];
    }

    // Если есть в глобальном кэше
    if (this._calledByCache.has(funcName)) {
      const calledBy = [...this._calledByCache.get(funcName)];

      // Если указан модуль, фильтруем
      if (modulePath) {
        const filtered = calledBy.filter(caller => {
          const callerModule = this.findModuleForFunction(caller);
          return callerModule === modulePath;
        });
        this._calledByCache.set(cacheKey, new Set(filtered));
        return filtered;
      }

      return calledBy;
    }

    // Fallback: ищем вручную
    const funcId = this.getFunctionIdByName(funcName);
    if (!funcId) return [];

    const calledBy = new Set();
    for (const edge of this.callEdges) {
      if (edge.to === funcId) {
        const fromName = this.getFunctionNameById(edge.from);
        if (fromName) {
          // Если указан модуль, проверяем, что вызывающая функция в том же модуле
          if (modulePath) {
            const fromModule = this.findModuleForFunction(fromName);
            if (fromModule === modulePath) {
              calledBy.add(fromName);
            }
          } else {
            calledBy.add(fromName);
          }
        }
      }
    }

    const result = [...calledBy];
    this._calledByCache.set(cacheKey, new Set(result));
    return result;
  }

  /**
   * Получить все вызовы для модуля (входящие и исходящие)
   * @param {string} modulePath - Путь к модулю
   * @returns {Object} { outgoing: string[], incoming: string[] }
   */
  getCallsForModule(modulePath) {
    if (this._moduleCallsCache.has(modulePath)) {
      return this._moduleCallsCache.get(modulePath);
    }

    const pkg = this.packages[modulePath];
    if (!pkg) {
      return { outgoing: [], incoming: [] };
    }

    const funcs = pkg.entities?.functions || [];
    const funcNames = new Set(funcs.map(f => f.name));

    const outgoing = new Set();
    const incoming = new Set();

    for (const edge of this.callEdges) {
      const fromName = this.getFunctionNameById(edge.from);
      const toName = this.getFunctionNameById(edge.to);

      if (!fromName || !toName) continue;

      // Исходящие: функции модуля вызывают внешние
      if (funcNames.has(fromName) && !funcNames.has(toName)) {
        outgoing.add(toName);
      }
      // Входящие: внешние вызывают функции модуля
      if (funcNames.has(toName) && !funcNames.has(fromName)) {
        incoming.add(fromName);
      }
    }

    const result = {
      outgoing: [...outgoing],
      incoming: [...incoming],
    };

    this._moduleCallsCache.set(modulePath, result);
    return result;
  }

  /**
   * Найти модуль для функции
   * @param {string} funcName - Имя функции
   * @returns {string|null} Путь к модулю или null
   */
  findModuleForFunction(funcName) {
    // Проверяем кэш
    if (this._functionModuleCache.has(funcName)) {
      return this._functionModuleCache.get(funcName);
    }

    // Ищем в packages
    for (const [modulePath, pkg] of Object.entries(this.packages)) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func.name === funcName) {
          this._functionModuleCache.set(funcName, modulePath);
          return modulePath;
        }
      }
    }

    // Ищем через callGraph
    const funcId = this.getFunctionIdByName(funcName);
    if (funcId) {
      // Ищем функцию, которая вызывает данную
      for (const edge of this.callEdges) {
        if (edge.to === funcId) {
          const fromName = this.getFunctionNameById(edge.from);
          if (fromName) {
            const modulePath = this.findModuleForFunction(fromName);
            if (modulePath) {
              this._functionModuleCache.set(funcName, modulePath);
              return modulePath;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Получить все функции модуля
   * @param {string} modulePath - Путь к модулю
   * @returns {string[]} Массив имен функций
   */
  getFunctionsForModule(modulePath) {
    const pkg = this.packages[modulePath];
    if (!pkg) return [];

    const funcs = pkg.entities?.functions || [];
    return funcs.map(f => f.name);
  }

  /**
   * Получить количество вызовов для функции
   * @param {string} funcName - Имя функции
   * @param {string} modulePath - Путь к модулю (опционально)
   * @returns {number} Количество вызовов
   */
  getCallsCount(funcName, modulePath = null) {
    return this.getCallsForFunction(funcName, modulePath).length;
  }

  /**
   * Получить количество вызывающих для функции
   * @param {string} funcName - Имя функции
   * @param {string} modulePath - Путь к модулю (опционально)
   * @returns {number} Количество вызывающих
   */
  getCalledByCount(funcName, modulePath = null) {
    return this.getCalledByForFunction(funcName, modulePath).length;
  }

  /**
   * Проверить, есть ли у функции вызовы
   * @param {string} funcName - Имя функции
   * @param {string} modulePath - Путь к модулю (опционально)
   * @returns {boolean}
   */
  hasCalls(funcName, modulePath = null) {
    return this.getCallsCount(funcName, modulePath) > 0;
  }

  /**
   * Проверить, есть ли у функции вызывающие
   * @param {string} funcName - Имя функции
   * @param {string} modulePath - Путь к модулю (опционально)
   * @returns {boolean}
   */
  hasCalledBy(funcName, modulePath = null) {
    return this.getCalledByCount(funcName, modulePath) > 0;
  }

  /**
   * Получить все вызовы с деталями (строка, тип)
   * @param {string} funcName - Имя функции
   * @returns {Array} Массив объектов { from, to, line, type }
   */
  getCallDetails(funcName) {
    const funcId = this.getFunctionIdByName(funcName);
    if (!funcId) return [];

    const details = [];
    for (const edge of this.callEdges) {
      if (edge.from === funcId) {
        const toName = this.getFunctionNameById(edge.to);
        if (toName) {
          details.push({
            from: funcName,
            to: toName,
            line: edge.line || 0,
            type: edge.type || 'direct',
          });
        }
      }
    }
    return details;
  }

  /**
   * Получить все вызывающие с деталями
   * @param {string} funcName - Имя функции
   * @returns {Array} Массив объектов { from, to, line, type }
   */
  getCalledByDetails(funcName) {
    const funcId = this.getFunctionIdByName(funcName);
    if (!funcId) return [];

    const details = [];
    for (const edge of this.callEdges) {
      if (edge.to === funcId) {
        const fromName = this.getFunctionNameById(edge.from);
        if (fromName) {
          details.push({
            from: fromName,
            to: funcName,
            line: edge.line || 0,
            type: edge.type || 'direct',
          });
        }
      }
    }
    return details;
  }

  /**
   * Очистить кэш
   */
  clearCache() {
    this._idToNameCache.clear();
    this._nameToIdCache.clear();
    this._callsCache.clear();
    this._calledByCache.clear();
    this._moduleCallsCache.clear();
    this._functionModuleCache.clear();
    this._buildCache();
  }

  /**
   * Получить статистику по callGraph
   * @returns {Object} Статистика
   */
  getStats() {
    const uniqueFunctions = new Set();
    const uniqueCalls = new Set();

    for (const edge of this.callEdges) {
      const fromName = this.getFunctionNameById(edge.from);
      const toName = this.getFunctionNameById(edge.to);

      if (fromName) uniqueFunctions.add(fromName);
      if (toName) uniqueFunctions.add(toName);

      if (fromName && toName) {
        uniqueCalls.add(`${fromName}->${toName}`);
      }
    }

    // Находим самые вызываемые функции
    const callCounts = new Map();
    for (const edge of this.callEdges) {
      const toName = this.getFunctionNameById(edge.to);
      if (toName) {
        callCounts.set(toName, (callCounts.get(toName) || 0) + 1);
      }
    }

    const mostCalled = [...callCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return {
      totalEdges: this.callEdges.length,
      totalFunctions: uniqueFunctions.size,
      totalUniqueCalls: uniqueCalls.size,
      mostCalled,
      functionsWithCalls: [...this._callsCache.keys()].filter(k => this._callsCache.get(k).size > 0)
        .length,
      functionsWithCalledBy: [...this._calledByCache.keys()].filter(
        k => this._calledByCache.get(k).size > 0
      ).length,
    };
  }

  /**
   * Обновить данные (при перезагрузке отчета)
   * @param {Object} reportData - Новые данные отчета
   */
  updateData(reportData) {
    this.reportData = reportData;
    this.functionIndex = reportData?.functionIndex || {};
    this.callEdges = reportData?.callGraph?.edges || [];
    this.packages = reportData?.packages || {};
    this.clearCache();
    console.log(`📊 CallGraphUtils updated: ${this.callEdges.length} edges`);
  }
}

// Экспорт по умолчанию
export default CallGraphUtils;
