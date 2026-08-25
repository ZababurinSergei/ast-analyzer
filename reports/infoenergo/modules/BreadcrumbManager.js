// packages/ast-analyzer/src/reporters/templates/modules/BreadcrumbManager.js

/**
 * BreadcrumbManager - управление Breadcrumbs
 * Отвечает за построение и отображение путей навигации
 * Поддерживает несколько ветвей путей от точки входа до текущей позиции
 */
export class BreadcrumbManager {
  constructor(app) {
    this.app = app;
    this.breadcrumbPaths = [];
    this.maxPaths = 5; // Максимальное количество отображаемых путей
    this.maxBreadcrumbs = 50; // Максимальная глубина одного пути
    this.currentModule = null;
    this.currentFunction = null;
  }

  /**
   * Инициализация менеджера
   */
  init() {
    console.log('🧭 BreadcrumbManager initialized');
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
   * Обновляет Breadcrumbs на основе текущего фокуса
   * @param {string} modulePath - Путь к модулю
   * @param {string|null} funcName - Имя функции (опционально)
   */
  updateBreadcrumbs(modulePath, funcName) {
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

    // Если есть выбранный модуль или функция, строим путь к ним
    if (modulePath) {
      const target = funcName ? `${modulePath}#func:${funcName}` : modulePath;
      const entryModule = this.findEntryModule();

      // Добавляем стрелку после Universe
      pathDiv.appendChild(this.createArrowSpan());

      // Если есть функция, ищем пути к функции
      let paths = [];
      if (funcName) {
        paths = this.findAllPathsTo(modulePath, funcName);
      } else {
        // Ищем пути к модулю
        paths = this.findAllPathsTo(modulePath, null);
      }

      // Если пути найдены, добавляем первый (или лучший) путь
      if (paths.length > 0) {
        const bestPath = paths[0]; // Берем первый найденный путь
        // Пропускаем первый элемент (это entryModule, который мы уже показали как Universe)
        for (let i = 1; i < bestPath.length; i++) {
          const item = bestPath[i];
          const isLast = i === bestPath.length - 1;

          if (i > 1) {
            pathDiv.appendChild(this.createArrowSpan());
          }

          const span = this.createBreadcrumbSpan(item.id, isLast, item.type);
          pathDiv.appendChild(span);
        }
      } else {
        // Если путь не найден, показываем просто текущий модуль/функцию
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
   * Создает элемент Breadcrumb для корневого состояния "Universe"
   */
  createUniverseBreadcrumb() {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item root';
    span.textContent = '🌌 Universe';
    span.title = 'Вернуться к полному обзору всех модулей';
    span.style.cursor = 'pointer';
    span.style.fontWeight = 'bold';
    span.style.color = '#60a5fa';
    span.style.transition = 'all 0.2s ease';

    // По клику очищаем фокус и возвращаемся к полному обзору
    span.onclick = e => {
      e.stopPropagation();
      this.navigateToUniverse();
    };

    // Добавляем hover эффект
    span.onmouseenter = () => {
      span.style.color = '#93c5fd';
      span.style.transform = 'scale(1.05)';
    };
    span.onmouseleave = () => {
      span.style.color = '#60a5fa';
      span.style.transform = 'scale(1)';
    };

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
    // Очищаем фокус через App
    this.app.clearFocus();
    // Обновляем breadcrumbs
    this.updateBreadcrumbs(null, null);
    // Синхронизируем с графом
    this.syncWithGraph();
  }

  /**
   * Навигация назад по истории breadcrumbs
   */
  navigateBack() {
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
      span.textContent = name;
      span.title = id;

      // Добавляем иконку типа модуля
      const icon = this.getModuleIcon(id);
      if (icon) {
        span.textContent = icon + ' ' + name;
      }

      if (!isActive) {
        span.style.cursor = 'pointer';
        span.style.transition = 'all 0.2s ease';
        span.onclick = e => {
          e.stopPropagation();
          this.app.focusModule(id);
        };
        span.onmouseenter = () => {
          span.style.color = '#60a5fa';
          span.style.background = 'rgba(96, 165, 250, 0.1)';
          span.style.borderRadius = '4px';
          span.style.padding = '2px 6px';
        };
        span.onmouseleave = () => {
          span.style.color = '#94a3b8';
          span.style.background = 'transparent';
          span.style.padding = '2px 6px';
        };
      } else {
        span.style.color = '#22d3ee';
        span.style.fontWeight = '600';
      }
    } else {
      const name = id.split('#func:').pop() || id;
      span.textContent = `ƒ ${name}`;
      span.title = id;

      if (!isActive) {
        span.style.cursor = 'pointer';
        span.style.transition = 'all 0.2s ease';
        const modulePath = this.findModuleForFunction(name);
        if (modulePath) {
          span.onclick = e => {
            e.stopPropagation();
            this.app.focusFunction(name, modulePath);
          };
          span.onmouseenter = () => {
            span.style.color = '#fbbf24';
            span.style.background = 'rgba(251, 191, 36, 0.1)';
            span.style.borderRadius = '4px';
            span.style.padding = '2px 6px';
          };
          span.onmouseleave = () => {
            span.style.color = '#94a3b8';
            span.style.background = 'transparent';
            span.style.padding = '2px 6px';
          };
        }
      } else {
        span.style.color = '#fbbf24';
        span.style.fontWeight = '600';
      }
    }

    return span;
  }

  /**
   * Возвращает иконку для типа модуля
   */
  getModuleIcon(modulePath) {
    if (!modulePath) return '';
    if (modulePath.endsWith('.vue')) return '🎯';
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) return '⚛️';
    if (modulePath.endsWith('.ts')) return '📘';
    if (modulePath.endsWith('.js')) return '📄';
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
   * Находит все возможные пути от точки входа до цели
   * @param {string} modulePath - Путь к модулю
   * @param {string|null} funcName - Имя функции (опционально)
   * @returns {Array<Array<{id: string, name: string, type: string, module?: string}>>}
   */
  findAllPathsTo(modulePath, funcName) {
    const entryModule = this.findEntryModule();
    if (!entryModule) {
      console.warn('⚠️ Entry module not found');
      return [];
    }

    const target = funcName ? `${modulePath}#func:${funcName}` : modulePath;
    const graph = this.buildGraphForBFS();

    // Проверяем, существует ли целевой узел в графе
    if (!graph[target] && !this.isNodeExists(target)) {
      // Если цель не найдена, пытаемся найти похожий узел
      const similarNode = this.findSimilarNode(target);
      if (similarNode) {
        console.log(`🔄 Found similar node: ${similarNode} instead of ${target}`);
        return this.findPathsToNode(entryModule, similarNode, graph);
      }
      console.warn(`⚠️ Target node not found in graph: ${target}`);
      return [];
    }

    const paths = this.findPathsToNode(entryModule, target, graph);

    // Сохраняем пути для истории
    if (paths.length > 0) {
      this.breadcrumbPaths = paths;
    }

    return paths;
  }

  /**
   * Проверяет, существует ли узел в графе
   * @param {string} nodeId - ID узла
   * @returns {boolean}
   */
  isNodeExists(nodeId) {
    const graph = this.buildGraphForBFS();
    return !!graph[nodeId];
  }

  /**
   * Находит похожий узел по имени
   * @param {string} target - Целевой узел
   * @returns {string|null}
   */
  findSimilarNode(target) {
    const graph = this.buildGraphForBFS();
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
   * Находит все пути от старта до цели с использованием BFS
   * @param {string} start - Стартовый узел
   * @param {string} target - Целевой узел
   * @param {Object} graph - Граф для BFS
   * @returns {Array<Array<Object>>}
   */
  findPathsToNode(start, target, graph) {
    const allPaths = [];
    const queue = [
      {
        node: start,
        path: [this.createBreadcrumbItem(start)],
      },
    ];
    const visited = new Set();
    let pathsFound = 0;
    const maxPathsToFind = 10;

    while (queue.length > 0 && pathsFound < maxPathsToFind) {
      const { node, path } = queue.shift();
      const key = node;

      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      if (key === target) {
        allPaths.push(path);
        pathsFound++;
        continue;
      }

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && path.length < this.maxBreadcrumbs) {
          const newPath = [...path];
          newPath.push(this.createBreadcrumbItem(neighbor));
          queue.push({ node: neighbor, path: newPath });
        }
      }
    }

    return allPaths;
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
      const [modulePath, funcName] = nodeId.replace('#func:', '').split('#');
      return {
        id: funcName || nodeId,
        name: funcName || nodeId,
        fullName: nodeId,
        type: 'function',
        module: modulePath || nodeId,
      };
    }
  }

  /**
   * Строит граф для BFS из данных отчета
   * @returns {Object} - Граф в виде { nodeId: [neighborId, ...] }
   */
  buildGraphForBFS() {
    const graph = {};
    const packages = this.app.reportData?.packages || {};

    // Добавляем модули
    for (const [modulePath] of Object.entries(packages)) {
      if (!graph[modulePath]) {
        graph[modulePath] = [];
      }
    }

    // Добавляем функции и их связи
    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (!pkg) {
        continue;
      }

      const funcs = pkg.entities?.functions || [];
      for (const func of funcs) {
        if (!func || !func.name) {
          continue;
        }
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

        // Связи по вызовам функций
        for (const call of func.calls || []) {
          const callId = `${modulePath}#func:${call}`;

          // Проверяем, существует ли вызываемая функция в этом же модуле
          if (graph[callId]) {
            if (!graph[funcId].includes(callId)) {
              graph[funcId].push(callId);
            }
          } else {
            // Ищем в других модулях
            for (const [otherMod, otherPkg] of Object.entries(packages)) {
              if (!otherPkg) {
                continue;
              }
              const otherFuncs = otherPkg.entities?.functions || [];
              for (const otherFunc of otherFuncs) {
                if (otherFunc.name === call) {
                  const otherId = `${otherMod}#func:${call}`;
                  if (!graph[funcId].includes(otherId)) {
                    graph[funcId].push(otherId);
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }

    return graph;
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
      if (!pkg) {
        continue;
      }
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
   * Синхронизирует Breadcrumbs с графом
   */
  syncWithGraph() {
    const focusModule = this.app.cardManager?.getFocusModule();
    const focusFunction = this.app.cardManager?.getFocusFunction();
    const mode = this.app.graphModeManager?.getMode() || 'all';

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
}
