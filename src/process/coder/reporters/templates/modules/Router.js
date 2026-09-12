// packages/ast-analyzer/src/reporters/templates/modules/Router.js

/**
 * Единая система маршрутизации для приложения
 *
 * Поддерживает:
 * - Навигацию по модулям и функциям
 * - Хранение истории
 * - Обработку URL (hash-based routing)
 * - Глубокие ссылки
 * - Поиск
 * - Синхронизацию с адресной строкой
 */
export class Router {
  constructor() {
    this._routes = [];
    this._currentRoute = null;
    this._history = [];
    this._historyIndex = -1;
    this._maxHistory = 50;
    this._listeners = [];
    this._isInitialized = false;
    this._app = null;
    this._isNavigating = false;

    // Символы для глобального доступа
    this.SYM_ROUTER = Symbol.for('__AST_ROUTER__');
    this.SYM_ROUTE_CHANGE = Symbol.for('__AST_ROUTE_CHANGE__');

    console.log('🧭 Router initialized');
  }

  /**
   * Инициализация маршрутизатора
   * @param {Object} app - Экземпляр приложения
   */
  init(app) {
    this._app = app;
    this._isInitialized = true;

    // Регистрируем маршруты
    this.registerRoutes();

    // Подписываемся на изменения в приложении
    this._setupAppListeners();

    // Обработчик изменения hash
    window.addEventListener('hashchange', () => {
      this._handleHashChange();
    });

    // Восстанавливаем маршрут из URL
    this._restoreFromURL();

    // Регистрируем в глобальном доступе
    window[this.SYM_ROUTER] = this;

    console.log('✅ Router initialized');
  }

  /**
   * Регистрация всех маршрутов
   */
  registerRoutes() {
    this._routes = [
      {
        path: '/',
        name: 'universe',
        title: '🌌 Universe',
        handler: () => this._navigateToUniverse(),
      },
      {
        path: '/module/:modulePath',
        name: 'module',
        title: '📁 Модуль',
        handler: params => this._navigateToModule(params.modulePath),
      },
      {
        path: '/function/:modulePath/:funcName',
        name: 'function',
        title: 'ƒ Функция',
        handler: params => this._navigateToFunction(params.modulePath, params.funcName),
      },
      {
        path: '/search/:query',
        name: 'search',
        title: '🔍 Поиск',
        handler: params => this._navigateToSearch(params.query),
      },
    ];

    console.log(`📋 Registered ${this._routes.length} routes`);
  }

  /**
   * Настройка слушателей приложения
   */
  _setupAppListeners() {
    if (!this._app) return;

    // Сохраняем оригинальные методы
    const originalFocusModule = this._app.focusModule;
    const originalFocusFunction = this._app.focusFunction;
    const originalClearFocus = this._app.clearFocus;
    const originalHandleSearch = this._app.handleSearch;

    // Обертываем методы для обновления маршрута
    this._app.focusModule = modulePath => {
      // Вызываем оригинальный метод
      if (typeof originalFocusModule === 'function') {
        originalFocusModule.call(this._app, modulePath);
      }
      // Обновляем маршрут
      this.navigateToModule(modulePath);
    };

    this._app.focusFunction = (funcName, modulePath) => {
      if (typeof originalFocusFunction === 'function') {
        originalFocusFunction.call(this._app, funcName, modulePath);
      }
      this.navigateToFunction(modulePath, funcName);
    };

    this._app.clearFocus = () => {
      if (typeof originalClearFocus === 'function') {
        originalClearFocus.call(this._app);
      }
      this.navigateToUniverse();
    };

    this._app.handleSearch = query => {
      if (typeof originalHandleSearch === 'function') {
        originalHandleSearch.call(this._app, query);
      }
      if (query && query.trim()) {
        this.navigateToSearch(query);
      } else {
        this.navigateToUniverse();
      }
    };

    console.log('🔗 App methods wrapped for routing');
  }

  /**
   * Навигация к модулю
   */
  navigateToModule(modulePath) {
    if (this._isNavigating) return;
    if (!modulePath) return this.navigateToUniverse();

    // Проверяем, не тот ли это уже маршрут
    if (
      this._currentRoute &&
      this._currentRoute.name === 'module' &&
      this._currentRoute.params.modulePath === modulePath
    ) {
      return;
    }

    this._isNavigating = true;

    const route = {
      path: `/module/${encodeURIComponent(modulePath)}`,
      name: 'module',
      params: { modulePath },
      title: this._getModuleTitle(modulePath),
      timestamp: Date.now(),
    };

    this._pushRoute(route);
    this._updateURL(route);
    this._notifyListeners(route);

    this._isNavigating = false;
  }

  /**
   * Навигация к функции
   */
  navigateToFunction(modulePath, funcName) {
    if (this._isNavigating) return;
    if (!modulePath || !funcName) return this.navigateToUniverse();

    // Проверяем, не тот ли это уже маршрут
    if (
      this._currentRoute &&
      this._currentRoute.name === 'function' &&
      this._currentRoute.params.modulePath === modulePath &&
      this._currentRoute.params.funcName === funcName
    ) {
      return;
    }

    this._isNavigating = true;

    const route = {
      path: `/function/${encodeURIComponent(modulePath)}/${encodeURIComponent(funcName)}`,
      name: 'function',
      params: { modulePath, funcName },
      title: `ƒ ${funcName}`,
      timestamp: Date.now(),
    };

    this._pushRoute(route);
    this._updateURL(route);
    this._notifyListeners(route);

    this._isNavigating = false;
  }

  /**
   * Навигация к поиску
   */
  navigateToSearch(query) {
    if (this._isNavigating) return;
    if (!query || !query.trim()) return this.navigateToUniverse();

    // Проверяем, не тот ли это уже маршрут
    if (
      this._currentRoute &&
      this._currentRoute.name === 'search' &&
      this._currentRoute.params.query === query.trim()
    ) {
      return;
    }

    this._isNavigating = true;

    const route = {
      path: `/search/${encodeURIComponent(query)}`,
      name: 'search',
      params: { query: query.trim() },
      title: `🔍 ${query}`,
      timestamp: Date.now(),
    };

    this._pushRoute(route);
    this._updateURL(route);
    this._notifyListeners(route);

    this._isNavigating = false;
  }

  /**
   * Навигация к Universe (корневой обзор)
   */
  navigateToUniverse() {
    if (this._isNavigating) return;

    // Проверяем, не тот ли это уже маршрут
    if (this._currentRoute && this._currentRoute.name === 'universe') {
      return;
    }

    this._isNavigating = true;

    const route = {
      path: '/',
      name: 'universe',
      params: {},
      title: '🌌 Universe',
      timestamp: Date.now(),
    };

    this._pushRoute(route);
    this._updateURL(route);
    this._notifyListeners(route);

    this._isNavigating = false;
  }

  /**
   * Добавление маршрута в историю
   */
  _pushRoute(route) {
    // Если мы не в конце истории, обрезаем будущее
    if (this._historyIndex < this._history.length - 1) {
      this._history = this._history.slice(0, this._historyIndex + 1);
    }

    // Добавляем маршрут
    this._history.push(route);
    this._historyIndex = this._history.length - 1;

    // Ограничиваем историю
    if (this._history.length > this._maxHistory) {
      this._history.shift();
      this._historyIndex--;
    }

    this._currentRoute = route;
  }

  /**
   * Обновление URL (hash)
   */
  _updateURL(route) {
    const url = route.path;
    const currentHash = window.location.hash;
    const newHash = `#${url}`;

    if (currentHash !== newHash) {
      // Используем replaceState чтобы не создавать лишнюю историю в браузере
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', newHash);
      } else {
        window.location.hash = url;
      }
    }
  }

  /**
   * Восстановление маршрута из URL
   */
  _restoreFromURL() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/')) {
      const path = hash.substring(1);
      const route = this._parsePath(path);
      if (route) {
        this._currentRoute = route;
        this._history = [route];
        this._historyIndex = 0;
        this._notifyListeners(route);
        this._executeRoute(route);
        return;
      }
    }

    // Если URL невалидный - идем в Universe
    this.navigateToUniverse();
  }

  /**
   * Парсинг пути
   */
  _parsePath(path) {
    // Проверяем все маршруты
    for (const routeDef of this._routes) {
      const pattern = routeDef.path;
      const params = this._matchRoute(pattern, path);
      if (params !== null) {
        return {
          path,
          name: routeDef.name,
          params,
          title: routeDef.title,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  /**
   * Сопоставление пути с шаблоном
   */
  _matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return null;

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        // Параметр
        const paramName = patternPart.substring(1);
        params[paramName] = decodeURIComponent(pathPart);
      } else if (patternPart !== pathPart) {
        return null;
      }
    }

    return params;
  }

  /**
   * Выполнение маршрута
   */
  _executeRoute(route) {
    if (!route || !this._app) return;

    switch (route.name) {
      case 'universe':
        if (typeof this._app.clearFocus === 'function') {
          this._app.clearFocus();
        }
        break;
      case 'module':
        if (typeof this._app.focusModule === 'function') {
          this._app.focusModule(route.params.modulePath);
        }
        break;
      case 'function':
        if (typeof this._app.focusFunction === 'function') {
          this._app.focusFunction(route.params.funcName, route.params.modulePath);
        }
        break;
      case 'search':
        if (typeof this._app.handleSearch === 'function') {
          this._app.handleSearch(route.params.query);
        }
        break;
      default:
        console.warn(`Unknown route: ${route.name}`);
    }
  }

  /**
   * Обработчик изменения hash
   */
  _handleHashChange() {
    if (this._isNavigating) return;

    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#/')) {
      this.navigateToUniverse();
      return;
    }

    const path = hash.substring(1);
    const route = this._parsePath(path);
    if (route) {
      // Проверяем, не тот ли это уже маршрут
      if (this._currentRoute && this._currentRoute.path === route.path) {
        return;
      }
      this._currentRoute = route;
      this._pushRoute(route);
      this._notifyListeners(route);
      this._executeRoute(route);
    } else {
      this.navigateToUniverse();
    }
  }

  /**
   * Навигация назад по истории
   */
  goBack() {
    if (this._historyIndex > 0) {
      this._historyIndex--;
      const route = this._history[this._historyIndex];
      this._currentRoute = route;
      this._updateURL(route);
      this._notifyListeners(route);
      this._executeRoute(route);
      return true;
    }
    return false;
  }

  /**
   * Навигация вперед по истории
   */
  goForward() {
    if (this._historyIndex < this._history.length - 1) {
      this._historyIndex++;
      const route = this._history[this._historyIndex];
      this._currentRoute = route;
      this._updateURL(route);
      this._notifyListeners(route);
      this._executeRoute(route);
      return true;
    }
    return false;
  }

  /**
   * Получение текущего маршрута
   */
  getCurrentRoute() {
    return this._currentRoute;
  }

  /**
   * Получение истории
   */
  getHistory() {
    return this._history;
  }

  /**
   * Получение индекса в истории
   */
  getHistoryIndex() {
    return this._historyIndex;
  }

  /**
   * Проверка возможности навигации назад
   */
  canGoBack() {
    return this._historyIndex > 0;
  }

  /**
   * Проверка возможности навигации вперед
   */
  canGoForward() {
    return this._historyIndex < this._history.length - 1;
  }

  /**
   * Подписка на изменения маршрута
   */
  onRouteChange(listener) {
    this._listeners.push(listener);
    // Возвращаем функцию для отписки
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * Уведомление подписчиков
   */
  _notifyListeners(route) {
    // Уведомляем всех подписчиков
    for (const listener of this._listeners) {
      try {
        listener(route);
      } catch (error) {
        console.warn('Error in route listener:', error);
      }
    }

    // Глобальное уведомление через символ
    const callback = window[this.SYM_ROUTE_CHANGE];
    if (typeof callback === 'function') {
      try {
        callback(route);
      } catch (error) {
        console.warn('Error in global route callback:', error);
      }
    }

    // Дополнительное уведомление через событие
    const event = new CustomEvent('routechange', { detail: { route } });
    window.dispatchEvent(event);
  }

  /**
   * Получение заголовка для модуля
   */
  _getModuleTitle(modulePath) {
    if (!modulePath) return '📁 Модуль';
    const parts = modulePath.split('/');
    const name = parts[parts.length - 1] || modulePath;
    return `📁 ${name}`;
  }

  /**
   * Получение полного пути для отображения
   */
  getDisplayPath(route) {
    if (!route) return '/';

    switch (route.name) {
      case 'universe':
        return '/';
      case 'module':
        return `/module/${route.params.modulePath}`;
      case 'function':
        return `/function/${route.params.modulePath}/${route.params.funcName}`;
      case 'search':
        return `/search/${route.params.query}`;
      default:
        return route.path;
    }
  }

  /**
   * Получение сокращенного пути для отображения
   */
  getShortPath(route) {
    if (!route) return '🌌 Universe';

    switch (route.name) {
      case 'universe':
        return '🌌 Universe';
      case 'module':
        const modName = route.params.modulePath.split('/').pop() || route.params.modulePath;
        return `📁 ${modName}`;
      case 'function':
        return `ƒ ${route.params.funcName}`;
      case 'search':
        return `🔍 ${route.params.query}`;
      default:
        return route.title || route.path;
    }
  }

  /**
   * Получение иконки для типа маршрута
   */
  getRouteIcon(route) {
    if (!route) return '🌌';
    switch (route.name) {
      case 'universe':
        return '🌌';
      case 'module':
        return '📁';
      case 'function':
        return 'ƒ';
      case 'search':
        return '🔍';
      default:
        return '📍';
    }
  }

  /**
   * Получение цвета для типа маршрута
   */
  getRouteColor(route) {
    if (!route) return '#60a5fa';
    switch (route.name) {
      case 'universe':
        return '#60a5fa';
      case 'module':
        return '#60a5fa';
      case 'function':
        return '#fbbf24';
      case 'search':
        return '#22d3ee';
      default:
        return '#94a3b8';
    }
  }

  /**
   * Навигация к последнему маршруту
   */
  goToLast() {
    if (this._history.length > 0) {
      const lastRoute = this._history[this._history.length - 1];
      this._currentRoute = lastRoute;
      this._historyIndex = this._history.length - 1;
      this._updateURL(lastRoute);
      this._notifyListeners(lastRoute);
      this._executeRoute(lastRoute);
      return true;
    }
    return false;
  }

  /**
   * Очистка истории
   */
  clearHistory() {
    this._history = [];
    this._historyIndex = -1;
    this.navigateToUniverse();
  }

  /**
   * Сброс маршрутизатора
   */
  reset() {
    this._history = [];
    this._historyIndex = -1;
    this._currentRoute = null;
    this.navigateToUniverse();
  }

  /**
   * Проверка, является ли маршрут активным
   */
  isActive(route) {
    if (!this._currentRoute) return false;
    if (!route) return false;
    return this._currentRoute.path === route.path;
  }

  /**
   * Получение родительского маршрута
   */
  getParentRoute(route) {
    if (!route) return null;
    if (route.name === 'universe') return null;
    if (route.name === 'function') {
      return {
        path: `/module/${encodeURIComponent(route.params.modulePath)}`,
        name: 'module',
        params: { modulePath: route.params.modulePath },
        title: this._getModuleTitle(route.params.modulePath),
      };
    }
    if (route.name === 'search') return null;
    return null;
  }

  /**
   * Получение хлебных крошек для маршрута
   */
  getBreadcrumbs(route) {
    if (!route) return [{ label: '🌌 Universe', path: '/' }];

    const breadcrumbs = [{ label: '🌌 Universe', path: '/' }];

    if (route.name === 'module') {
      breadcrumbs.push({
        label: this._getModuleTitle(route.params.modulePath),
        path: `/module/${encodeURIComponent(route.params.modulePath)}`,
      });
    } else if (route.name === 'function') {
      breadcrumbs.push({
        label: this._getModuleTitle(route.params.modulePath),
        path: `/module/${encodeURIComponent(route.params.modulePath)}`,
      });
      breadcrumbs.push({
        label: `ƒ ${route.params.funcName}`,
        path: `/function/${encodeURIComponent(route.params.modulePath)}/${encodeURIComponent(route.params.funcName)}`,
      });
    } else if (route.name === 'search') {
      breadcrumbs.push({
        label: `🔍 ${route.params.query}`,
        path: `/search/${encodeURIComponent(route.params.query)}`,
      });
    }

    return breadcrumbs;
  }

  /**
   * Очистка
   */
  dispose() {
    this._listeners = [];
    window.removeEventListener('hashchange', this._handleHashChange);
    window[this.SYM_ROUTER] = null;

    // Восстанавливаем оригинальные методы App
    if (this._app) {
      // Можно добавить восстановление методов, если нужно
    }
  }
}

// Экспорт по умолчанию
export default Router;
