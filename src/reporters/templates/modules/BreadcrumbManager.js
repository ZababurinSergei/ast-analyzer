// packages/ast-analyzer/src/reporters/templates/modules/BreadcrumbManager.js

/**
 * BreadcrumbManager - управление Breadcrumbs
 * Отвечает за построение и отображение путей навигации
 * Поддерживает несколько ветвей путей от точки входа до текущей позиции
 *
 * Интеграция с Router:
 * - Синхронизация с роутером при изменении навигации
 * - Обновление breadcrumbs через роутер
 * - Поддержка истории переходов
 */
export class BreadcrumbManager {
  constructor(app) {
    this.app = app;
    this.breadcrumbPaths = [];
    this.maxPaths = 5; // Максимальное количество отображаемых путей
    this.maxBreadcrumbs = 50; // Максимальная глубина одного пути
    this.currentModule = null;
    this.currentFunction = null;
    this.router = null;
    this._unsubscribeRouter = null;
  }

  /**
   * Инициализация менеджера
   */
  init() {
    console.log('🧭 BreadcrumbManager initialized');

    // Получаем роутер
    this.router = window[Symbol.for('__AST_ROUTER__')];

    // Подписываемся на изменения роутера
    if (this.router) {
      this._unsubscribeRouter = this.router.onRouteChange((route) => {
        this._handleRouteChange(route);
      });
    }

    this.setupKeyboardShortcuts();
  }

  /**
   * Настройка клавиатурных сокращений
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Alt+Left - вернуться назад по breadcrumbs
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigateBack();
      }
      // Alt+Right - перейти вперед по breadcrumbs
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateForward();
      }
      // Alt+Home - вернуться к Universe
      if (e.altKey && e.key === 'Home') {
        e.preventDefault();
        this.navigateToUniverse();
      }
    });
  }

  /**
   * Обработка изменения маршрута
   */
  _handleRouteChange(route) {
    if (!route) {
      this.updateBreadcrumbs(null, null);
      return;
    }

    switch (route.name) {
      case 'universe':
        this.updateBreadcrumbs(null, null);
        break;
      case 'module':
        this.updateBreadcrumbs(route.params.modulePath, null);
        break;
      case 'function':
        this.updateBreadcrumbs(route.params.modulePath, route.params.funcName);
        break;
      case 'search':
        // Для поиска показываем специальный breadcrumb
        this.updateBreadcrumbs(null, null, `🔍 ${route.params.query}`);
        break;
      default:
        this.updateBreadcrumbs(null, null);
    }
  }

  /**
   * Обновляет Breadcrumbs на основе текущего фокуса
   * @param {string} modulePath - Путь к модулю
   * @param {string|null} funcName - Имя функции (опционально)
   * @param {string|null} customLabel - Пользовательская метка (для поиска)
   */
  updateBreadcrumbs(modulePath, funcName, customLabel = null) {
    const container = document.getElementById('breadcrumbs');
    if (!container) {
      console.warn('⚠️ Breadcrumbs container not found');
      return;
    }

    // Сохраняем текущее состояние
    this.currentModule = modulePath;
    this.currentFunction = funcName;

    // Очищаем контейнер
    container.innerHTML = '';

    // ✅ ВСЕГДА ПОКАЗЫВАЕМ КОРНЕВОЙ ЭЛЕМЕНТ "UNIVERSE"
    const pathDiv = document.createElement('div');
    pathDiv.className = 'breadcrumb-path';

    // Добавляем Universe как первый элемент
    const universeSpan = this.createUniverseBreadcrumb();
    pathDiv.appendChild(universeSpan);

    // Если есть пользовательская метка (поиск)
    if (customLabel) {
      pathDiv.appendChild(this.createArrowSpan());
      const customSpan = this.createCustomBreadcrumb(customLabel);
      pathDiv.appendChild(customSpan);
      container.appendChild(pathDiv);
      return;
    }

    // Если есть выбранный модуль или функция, строим путь к ним
    if (modulePath) {
      // Добавляем стрелку после Universe
      pathDiv.appendChild(this.createArrowSpan());

      // 🔥 Строим полный путь через граф
      const path = this.buildFullPath(modulePath, funcName);

      if (path && path.length > 0) {
        // Добавляем все элементы пути
        for (let i = 0; i < path.length; i++) {
          const item = path[i];
          const isLast = i === path.length - 1;

          if (i > 0) {
            pathDiv.appendChild(this.createArrowSpan());
          }

          const span = this.createBreadcrumbSpan(item.id, isLast, item.type);
          pathDiv.appendChild(span);
        }
      } else {
        // Fallback: если путь не найден, показываем просто текущий модуль/функцию
        if (funcName) {
          const span = this.createBreadcrumbSpan(funcName, true, 'function');
          pathDiv.appendChild(span);
        } else if (modulePath) {
          const span = this.createBreadcrumbSpan(modulePath, true, 'module');
          pathDiv.appendChild(span);
        }
      }

      // ✅ Добавляем кнопку "Снять фокус" для активного модуля/функции
      const clearBtn = this.createClearFocusButton();
      pathDiv.appendChild(clearBtn);
    }

    container.appendChild(pathDiv);

    // ✅ Добавляем информацию о количестве путей (если их несколько)
    if (this.breadcrumbPaths.length > 1) {
      this.showPathCount(container);
    }

    // Обновляем граф при изменении breadcrumbs
    this.syncWithGraph();
  }

  /**
   * 🔥 СТРОИТ ПОЛНЫЙ ПУТЬ от Universe до цели через граф
   * @param {string} modulePath - Путь к модулю
   * @param {string|null} funcName - Имя функции
   * @returns {Array<{id: string, name: string, type: string, module?: string}>}
   */
  buildFullPath(modulePath, funcName) {
    // Находим точку входа (корневой модуль)
    const entryModule = this.findEntryModule();
    if (!entryModule) {
      console.warn('⚠️ Entry module not found');
      return this.buildSimplePath(modulePath, funcName);
    }

    // Определяем цель
    const target = funcName ? `${modulePath}#func:${funcName}` : modulePath;

    // Строим полный граф
    const graph = this.buildFullGraph();

    // Проверяем, существует ли целевой узел в графе
    if (!graph[target] && !this.isNodeExists(target)) {
      // Если цель не найдена, пытаемся найти похожий узел
      const similarNode = this.findSimilarNode(target);
      if (similarNode) {
        console.log(`🔄 Found similar node: ${similarNode} instead of ${target}`);
        return this.findPath(entryModule, similarNode, graph);
      }
      console.warn(`⚠️ Target node not found in graph: ${target}`);
      return this.buildSimplePath(modulePath, funcName);
    }

    // Находим путь
    const path = this.findPath(entryModule, target, graph);

    if (path && path.length > 0) {
      // Сохраняем путь для истории
      this.breadcrumbPaths = [path];
      return path;
    }

    // Если путь не найден, возвращаем простой путь
    return this.buildSimplePath(modulePath, funcName);
  }

  /**
   * Строит простой путь (без графа)
   * @param {string} modulePath - Путь к модулю
   * @param {string|null} funcName - Имя функции
   * @returns {Array<{id: string, name: string, type: string, module?: string}>}
   */
  buildSimplePath(modulePath, funcName) {
    const path = [];

    // Добавляем модуль
    if (modulePath) {
      const pkg = this.app.reportData?.packages?.[modulePath];
      path.push({
        id: modulePath,
        name: pkg?.displayPath || modulePath.split('/').pop() || modulePath,
        type: 'module'
      });
    }

    // Добавляем функцию
    if (funcName) {
      path.push({
        id: funcName,
        name: funcName,
        type: 'function',
        module: modulePath
      });
    }

    return path;
  }

  /**
   * 🔥 СТРОИТ ПОЛНЫЙ ГРАФ с модулями и функциями
   * @returns {Object} - Граф в виде { nodeId: [neighborId, ...] }
   */
  buildFullGraph() {
    const graph = {};
    const packages = this.app.reportData?.packages || {};

    // Добавляем все модули
    for (const [modulePath] of Object.entries(packages)) {
      if (!graph[modulePath]) {
        graph[modulePath] = [];
      }
    }

    // Добавляем функции и связи
    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (!pkg) continue;

      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (!func || !func.name) continue;

        const funcId = `${modulePath}#func:${func.name}`;

        if (!graph[funcId]) {
          graph[funcId] = [];
        }

        // Связь: модуль -> функция
        if (!graph[modulePath].includes(funcId)) {
          graph[modulePath].push(funcId);
        }

        // Связь: функция -> модуль (обратная)
        if (!graph[funcId].includes(modulePath)) {
          graph[funcId].push(modulePath);
        }

        // Связи по вызовам функций (исходящие)
        for (const call of func.calls || []) {
          const callId = this.findFunctionId(call);
          if (callId && callId !== funcId) {
            if (!graph[funcId].includes(callId)) {
              graph[funcId].push(callId);
            }
          }
        }

        // Связи по вызовам (входящие)
        for (const caller of func.calledBy || []) {
          const callerId = this.findFunctionId(caller);
          if (callerId && callerId !== funcId) {
            if (!graph[callerId]) {
              graph[callerId] = [];
            }
            if (!graph[callerId].includes(funcId)) {
              graph[callerId].push(funcId);
            }
          }
        }
      }
    }

    return graph;
  }

  /**
   * Находит ID функции по имени
   * @param {string} funcName - Имя функции
   * @returns {string|null}
   */
  findFunctionId(funcName) {
    const packages = this.app.reportData?.packages || {};
    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (!pkg) continue;
      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (func.name === funcName) {
          return `${modulePath}#func:${funcName}`;
        }
      }
    }
    return null;
  }

  /**
   * Находит путь от старта до цели с использованием BFS
   * @param {string} start - Стартовый узел
   * @param {string} target - Целевой узел
   * @param {Object} graph - Граф для BFS
   * @returns {Array<Object>|null}
   */
  findPath(start, target, graph) {
    if (start === target) {
      return [this.createBreadcrumbItem(start)];
    }

    const queue = [{ node: start, path: [start] }];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const { node, path } = queue.shift();
      const neighbors = graph[node] || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        if (path.length >= this.maxBreadcrumbs) continue;

        const newPath = [...path, neighbor];

        if (neighbor === target) {
          // Преобразуем ID в объекты breadcrumb
          return newPath.map(id => this.createBreadcrumbItem(id));
        }

        visited.add(neighbor);
        queue.push({ node: neighbor, path: newPath });
      }
    }

    // Если путь не найден, возвращаем null
    return null;
  }

  /**
   * Проверяет, существует ли узел в графе
   * @param {string} nodeId - ID узла
   * @returns {boolean}
   */
  isNodeExists(nodeId) {
    const graph = this.buildFullGraph();
    return !!graph[nodeId];
  }

  /**
   * Находит похожий узел по имени
   * @param {string} target - Целевой узел
   * @returns {string|null}
   */
  findSimilarNode(target) {
    const graph = this.buildFullGraph();
    const targetName = target.split('#func:').pop() || target.split('/').pop() || target;

    for (const nodeId of Object.keys(graph)) {
      const nodeName = nodeId.split('#func:').pop() || nodeId.split('/').pop() || nodeId;
      if (nodeName === targetName && nodeId !== target) {
        return nodeId;
      }
    }
    return null;
  }

  /**
   * Создает элемент Breadcrumb для узла
   * @param {string} nodeId - ID узла
   * @returns {Object}
   */
  createBreadcrumbItem(nodeId) {
    const isFunction = nodeId.includes('#func:');
    const isModule = !isFunction;

    if (isModule) {
      const pkg = this.app.reportData?.packages?.[nodeId];
      return {
        id: nodeId,
        name: pkg?.displayPath || nodeId.split('/').pop() || nodeId,
        fullName: nodeId,
        type: 'module',
      };
    } else {
      const funcName = nodeId.split('#func:').pop() || nodeId;
      const modulePath = this.findModuleForFunction(funcName);
      return {
        id: funcName,
        name: funcName,
        fullName: nodeId,
        type: 'function',
        module: modulePath || nodeId,
      };
    }
  }

  /**
   * Находит точку входа в проект
   * @returns {string|null}
   */
  findEntryModule() {
    const packages = this.app.reportData?.packages || {};
    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (pkg?.isEntry) {
        return modulePath;
      }
    }
    // Если точка входа не найдена, берем первый модуль
    const keys = Object.keys(packages);
    return keys.length > 0 ? keys[0] : null;
  }

  /**
   * Находит модуль для функции по имени
   * @param {string} funcName - Имя функции
   * @returns {string|null}
   */
  findModuleForFunction(funcName) {
    const packages = this.app.reportData?.packages || {};
    for (const [modulePath, pkg] of Object.entries(packages)) {
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
   * Создает элемент Breadcrumb для корневого состояния "Universe"
   */
  createUniverseBreadcrumb() {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item root';
    span.textContent = '🌌 Universe';
    span.title = 'Вернуться к полному обзору всех модулей';
    span.style.cssText = `
      cursor: pointer;
      font-weight: bold;
      color: #60a5fa;
      transition: all 0.2s ease;
      padding: 2px 4px;
      border-radius: 4px;
    `;

    span.onclick = e => {
      e.stopPropagation();
      this.navigateToUniverse();
    };

    span.onmouseenter = () => {
      span.style.color = '#93c5fd';
      span.style.background = 'rgba(96, 165, 250, 0.1)';
      span.style.transform = 'scale(1.02)';
    };
    span.onmouseleave = () => {
      span.style.color = '#60a5fa';
      span.style.background = 'transparent';
      span.style.transform = 'scale(1)';
    };

    return span;
  }

  /**
   * Создает пользовательский breadcrumb (для поиска и т.д.)
   */
  createCustomBreadcrumb(label) {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item active';
    span.textContent = label;
    span.style.cssText = `
      color: #22d3ee;
      font-weight: 600;
      padding: 2px 8px;
      background: rgba(34, 211, 238, 0.1);
      border-radius: 12px;
      border: 1px solid rgba(34, 211, 238, 0.2);
    `;
    return span;
  }

  /**
   * Создает кнопку для снятия фокуса
   */
  createClearFocusButton() {
    const btn = document.createElement('button');
    btn.className = 'breadcrumb-clear-btn';
    btn.textContent = '✕';
    btn.title = 'Снять фокус';
    btn.style.cssText = `
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
      transition: all 0.2s ease;
      margin-left: 8px;
    `;

    btn.onmouseenter = () => {
      btn.style.color = '#f87171';
      btn.style.background = 'rgba(248, 113, 113, 0.1)';
    };
    btn.onmouseleave = () => {
      btn.style.color = '#94a3b8';
      btn.style.background = 'none';
    };

    btn.onclick = e => {
      e.stopPropagation();
      this.navigateToUniverse();
    };

    return btn;
  }

  /**
   * Навигация к Universe (сброс фокуса)
   */
  navigateToUniverse() {
    // Используем роутер если доступен
    if (this.router) {
      this.router.navigateToUniverse();
      return;
    }

    // Fallback: очищаем фокус через App
    this.app.clearFocus();
    this.updateBreadcrumbs(null, null);
    this.syncWithGraph();
  }

  /**
   * Навигация назад по истории breadcrumbs
   */
  navigateBack() {
    // Используем роутер если доступен
    if (this.router && this.router.canGoBack()) {
      this.router.goBack();
      return;
    }

    // Fallback: своя логика
    if (this.breadcrumbPaths.length === 0) return;

    // Берем последний путь
    const lastPath = this.breadcrumbPaths[this.breadcrumbPaths.length - 1];
    if (!lastPath || lastPath.length === 0) return;

    // Берем предпоследний элемент в пути
    const prevItem = lastPath[lastPath.length - 2];
    if (prevItem) {
      if (prevItem.type === 'function') {
        const modulePath = this.findModuleForFunction(prevItem.name);
        if (modulePath) {
          this.app.focusFunction(prevItem.name, modulePath);
        }
      } else if (prevItem.type === 'module') {
        this.app.focusModule(prevItem.id);
      }
    }
  }

  /**
   * Навигация вперед по истории breadcrumbs
   */
  navigateForward() {
    // Используем роутер если доступен
    if (this.router && this.router.canGoForward()) {
      this.router.goForward();
      return;
    }

    // TODO: Реализовать навигацию вперед (сложнее, нужен стек истории)
    console.log('⏩ Forward navigation not implemented yet');
  }

  /**
   * Показывает количество найденных путей
   */
  showPathCount(container) {
    const countDiv = document.createElement('div');
    countDiv.className = 'breadcrumb-count';
    countDiv.style.cssText = `
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      background: #0f172a;
    `;
    countDiv.textContent = `📊 ${this.breadcrumbPaths.length} путей найдено`;

    // Добавляем toggle для показа всех путей
    countDiv.style.cursor = 'pointer';
    countDiv.onclick = () => this.toggleAllPaths(container);

    container.appendChild(countDiv);
  }

  /**
   * Переключает отображение всех путей
   */
  toggleAllPaths(container) {
    const isExpanded = container.dataset.expanded === 'true';

    if (isExpanded) {
      // Сворачиваем - показываем только первый путь
      this.updateBreadcrumbs(this.currentModule, this.currentFunction);
      container.dataset.expanded = 'false';
    } else {
      // Разворачиваем - показываем все пути
      this.showAllPaths(container);
      container.dataset.expanded = 'true';
    }
  }

  /**
   * Показывает все найденные пути
   */
  showAllPaths(container) {
    // Очищаем контейнер
    container.innerHTML = '';

    // Добавляем заголовок
    const header = document.createElement('div');
    header.className = 'breadcrumb-header';
    header.style.cssText = `
      font-size: 11px;
      color: #94a3b8;
      padding: 4px 0;
      font-weight: 500;
    `;
    header.textContent = `🌐 Все пути (${this.breadcrumbPaths.length})`;
    container.appendChild(header);

    // Показываем все пути
    for (let i = 0; i < this.breadcrumbPaths.length; i++) {
      const path = this.breadcrumbPaths[i];
      if (!path) continue;

      const pathDiv = document.createElement('div');
      pathDiv.className = 'breadcrumb-path';
      pathDiv.style.cssText = `
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        font-size: 11px;
        font-family: monospace;
        padding: 4px 8px;
        border-radius: 4px;
        background: ${i === 0 ? '#0f172a' : 'transparent'};
        border-left: 2px solid ${i === 0 ? '#60a5fa' : '#334155'};
        margin: 2px 0;
      `;

      // Добавляем номер пути
      const numSpan = document.createElement('span');
      numSpan.textContent = `${i + 1}. `;
      numSpan.style.cssText = `
        color: #64748b;
        font-size: 9px;
        margin-right: 4px;
      `;
      pathDiv.appendChild(numSpan);

      // Добавляем элементы пути
      for (let j = 0; j < path.length; j++) {
        const item = path[j];
        const isLast = j === path.length - 1;

        if (j > 0) {
          pathDiv.appendChild(this.createArrowSpan());
        }

        const span = this.createBreadcrumbSpan(item.id, isLast, item.type);
        pathDiv.appendChild(span);
      }

      container.appendChild(pathDiv);
    }

    // Добавляем кнопку "Свернуть"
    const collapseBtn = document.createElement('button');
    collapseBtn.textContent = '▲ Свернуть';
    collapseBtn.style.cssText = `
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 10px;
      padding: 4px 8px;
      margin-top: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
    `;
    collapseBtn.onmouseenter = () => {
      collapseBtn.style.color = '#60a5fa';
      collapseBtn.style.background = 'rgba(96, 165, 250, 0.1)';
    };
    collapseBtn.onmouseleave = () => {
      collapseBtn.style.color = '#94a3b8';
      collapseBtn.style.background = 'none';
    };
    collapseBtn.onclick = () => {
      this.updateBreadcrumbs(this.currentModule, this.currentFunction);
      container.dataset.expanded = 'false';
    };
    container.appendChild(collapseBtn);
  }

  /**
   * Создает span для Breadcrumb
   * @param {string} id - ID узла
   * @param {boolean} isActive - Активный ли узел
   * @param {string} type - Тип узла ('module', 'function', 'root')
   * @returns {HTMLElement}
   */
  createBreadcrumbSpan(id, isActive = false, type = 'module') {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item';
    if (isActive) {
      span.classList.add('active');
    }

    // Если это корневой элемент Universe, он уже создан отдельно
    if (id === 'universe') {
      return this.createUniverseBreadcrumb();
    }

    const isFunction = type === 'function' || id.includes('#func:');
    const isModule = type === 'module' || !isFunction;

    if (isModule) {
      const pkg = this.app.reportData?.packages?.[id];
      const name = pkg?.displayPath || id.split('/').pop() || id;
      const icon = this.getModuleIcon(id);

      span.textContent = icon ? `${icon} ${name}` : name;
      span.title = id;

      if (!isActive) {
        span.style.cursor = 'pointer';
        span.style.transition = 'all 0.2s ease';
        span.style.padding = '2px 6px';
        span.style.borderRadius = '4px';

        span.onclick = e => {
          e.stopPropagation();
          // Используем роутер если доступен
          if (this.router) {
            this.router.navigateToModule(id);
          } else {
            this.app.focusModule(id);
          }
        };
        span.onmouseenter = () => {
          span.style.color = '#60a5fa';
          span.style.background = 'rgba(96, 165, 250, 0.1)';
        };
        span.onmouseleave = () => {
          span.style.color = '#94a3b8';
          span.style.background = 'transparent';
        };
      } else {
        span.style.color = '#22d3ee';
        span.style.fontWeight = '600';
        span.style.background = 'rgba(34, 211, 238, 0.05)';
        span.style.padding = '2px 8px';
        span.style.borderRadius = '4px';
        span.style.border = '1px solid rgba(34, 211, 238, 0.2)';
      }
    } else {
      const name = id.includes('#func:') ? id.split('#func:').pop() : id;
      const modulePath = this.findModuleForFunction(name);

      span.textContent = `ƒ ${name}`;
      span.title = `${name} (${modulePath || 'модуль не найден'})`;

      if (!isActive) {
        span.style.cursor = 'pointer';
        span.style.transition = 'all 0.2s ease';
        span.style.padding = '2px 6px';
        span.style.borderRadius = '4px';

        if (modulePath) {
          span.onclick = e => {
            e.stopPropagation();
            if (this.router) {
              this.router.navigateToFunction(modulePath, name);
            } else {
              this.app.focusFunction(name, modulePath);
            }
          };
          span.onmouseenter = () => {
            span.style.color = '#fbbf24';
            span.style.background = 'rgba(251, 191, 36, 0.1)';
          };
          span.onmouseleave = () => {
            span.style.color = '#94a3b8';
            span.style.background = 'transparent';
          };
        }
      } else {
        span.style.color = '#fbbf24';
        span.style.fontWeight = '600';
        span.style.background = 'rgba(251, 191, 36, 0.1)';
        span.style.padding = '2px 8px';
        span.style.borderRadius = '4px';
        span.style.border = '1px solid rgba(251, 191, 36, 0.2)';
      }
    }

    return span;
  }

  /**
   * Возвращает иконку для типа модуля
   */
  getModuleIcon(modulePath) {
    if (!modulePath) return '📄';
    if (modulePath.endsWith('.vue')) return '🎯';
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) return '⚛️';
    if (modulePath.endsWith('.ts')) return '📘';
    if (modulePath.endsWith('.js')) return '📄';
    if (modulePath.endsWith('.json')) return '📋';
    if (modulePath.endsWith('.css') || modulePath.endsWith('.scss')) return '🎨';
    return '📁';
  }

  /**
   * Создает span со стрелкой
   * @returns {HTMLElement}
   */
  createArrowSpan() {
    const arrow = document.createElement('span');
    arrow.className = 'breadcrumb-arrow';
    arrow.textContent = ' → ';
    arrow.style.cssText = `
      color: #475569;
      margin: 0 4px;
      font-size: 11px;
    `;
    return arrow;
  }

  /**
   * Синхронизирует Breadcrumbs с графом
   */
  syncWithGraph() {
    const focusModule = this.app.cardManager?.getFocusModule?.() || this.currentModule;
    const focusFunction = this.app.cardManager?.getFocusFunction?.() || this.currentFunction;
    const mode = this.app.graphModeManager?.getMode?.() || 'all';

    if (this.app.graphManager) {
      this.app.graphManager.updateGraphWithFocus(focusModule, focusFunction, mode);
    }
  }

  /**
   * Очищает Breadcrumbs
   */
  clear() {
    const container = document.getElementById('breadcrumbs');
    if (container) {
      container.innerHTML = '';
    }
    this.breadcrumbPaths = [];
    this.currentModule = null;
    this.currentFunction = null;
  }

  /**
   * Получает текущие пути Breadcrumbs
   * @returns {Array}
   */
  getPaths() {
    return this.breadcrumbPaths;
  }

  /**
   * Получает текущий активный путь
   * @returns {Array|null}
   */
  getActivePath() {
    if (this.breadcrumbPaths.length === 0) {
      return null;
    }
    return this.breadcrumbPaths[0] || null;
  }

  /**
   * Проверяет, есть ли несколько путей
   * @returns {boolean}
   */
  hasMultiplePaths() {
    return this.breadcrumbPaths.length > 1;
  }

  /**
   * Возвращает количество найденных путей
   * @returns {number}
   */
  getPathCount() {
    return this.breadcrumbPaths.length;
  }

  /**
   * Обновляет максимальное количество отображаемых путей
   * @param {number} count - Максимальное количество
   */
  setMaxPaths(count) {
    if (count > 0) {
      this.maxPaths = count;
      // Перерисовываем Breadcrumbs
      this.updateBreadcrumbs(this.currentModule, this.currentFunction);
    }
  }

  /**
   * Возвращает текущий модуль в фокусе
   * @returns {string|null}
   */
  getCurrentModule() {
    return this.currentModule;
  }

  /**
   * Возвращает текущую функцию в фокусе
   * @returns {string|null}
   */
  getCurrentFunction() {
    return this.currentFunction;
  }

  /**
   * Проверяет, есть ли активный фокус
   * @returns {boolean}
   */
  hasFocus() {
    return !!(this.currentModule || this.currentFunction);
  }

  /**
   * Очистка подписок
   */
  dispose() {
    if (this._unsubscribeRouter) {
      this._unsubscribeRouter();
      this._unsubscribeRouter = null;
    }
    this.clear();
  }
}
