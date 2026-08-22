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
  }

  /**
   * Инициализация менеджера
   */
  init() {
    // Инициализация не требуется, но метод оставлен для единообразия
    console.log('🧭 BreadcrumbManager initialized');
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

    // Очищаем контейнер
    container.innerHTML = '';

    // ✅ ВСЕГДА ПОКАЗЫВАЕМ КОРНЕВОЙ ЭЛЕМЕНТ "UNIVERSE"
    const universePath = this.createUniverseBreadcrumb();
    const pathDiv = document.createElement('div');
    pathDiv.className = 'breadcrumb-path';
    pathDiv.appendChild(universePath);

    // Если есть выбранный модуль или функция, строим путь к ним
    if (modulePath) {
      // Добавляем стрелку после Universe
      pathDiv.appendChild(this.createArrowSpan());

      const target = funcName ? `${modulePath}#func:${funcName}` : modulePath;
      const entryModule = this.findEntryModule();

      // Если точка входа не найдена или совпадает с текущим модулем, показываем упрощенный путь
      if (!entryModule || entryModule === modulePath) {
        // Показываем текущий модуль/функцию
        if (funcName) {
          const span = this.createBreadcrumbSpan(funcName, true, 'function');
          pathDiv.appendChild(span);
        } else {
          const span = this.createBreadcrumbSpan(modulePath, true, 'module');
          pathDiv.appendChild(span);
        }
      } else {
        // Строим полный путь через граф
        const graph = this.buildGraphForBFS();
        let paths = this.findPathsToNode(entryModule, target, graph);

        if (paths.length > 0) {
          // Берем первый (кратчайший) путь
          const bestPath = paths[0];

          // Пропускаем первый элемент (это entryModule, который мы уже показали как Universe)
          // Но если путь начинается не с entryModule, добавляем его
          let startIndex = 0;
          if (bestPath.length > 0 && bestPath[0]?.id === entryModule) {
            startIndex = 1;
          }

          // Добавляем оставшиеся элементы пути
          for (let i = startIndex; i < bestPath.length; i++) {
            const item = bestPath[i];
            if (!item) continue;

            const isLast = i === bestPath.length - 1;
            const span = this.createBreadcrumbSpan(item.id, isLast, item.type || 'module');
            pathDiv.appendChild(span);

            if (!isLast) {
              pathDiv.appendChild(this.createArrowSpan());
            }
          }
        } else {
          // Если путь не найден, показываем текущий модуль/функцию
          if (funcName) {
            const span = this.createBreadcrumbSpan(funcName, true, 'function');
            pathDiv.appendChild(span);
          } else if (modulePath) {
            const span = this.createBreadcrumbSpan(modulePath, true, 'module');
            pathDiv.appendChild(span);
          }
        }
      }
    }

    container.appendChild(pathDiv);

    // Сохраняем текущий путь для истории
    this.breadcrumbPaths = [
      [
        { id: 'universe', name: '🌌 Universe', type: 'root' },
        ...(modulePath
          ? [{ id: modulePath, name: modulePath.split('/').pop() || modulePath, type: 'module' }]
          : []),
        ...(funcName ? [{ id: funcName, name: funcName, type: 'function' }] : []),
      ],
    ];
  }

  /**
   * Создает элемент Breadcrumb для корневого состояния "Universe"
   * @returns {HTMLElement}
   */
  createUniverseBreadcrumb() {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item root';
    span.textContent = '🌌 Universe';
    span.title = 'Вернуться к полному обзору всех модулей';
    span.style.cursor = 'pointer';

    // По клику очищаем фокус и возвращаемся к полному обзору
    span.onclick = e => {
      e.stopPropagation();
      // Очищаем фокус через App
      if (this.app.clearFocus) {
        this.app.clearFocus();
      } else {
        // Fallback: очищаем через карточки
        this.app.cardManager?.clearFocus();
      }
      // Обновляем breadcrumbs
      this.updateBreadcrumbs(null, null);
    };

    return span;
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

    return this.findPathsToNode(entryModule, target, graph);
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
   * Рендерит простые Breadcrumbs на основе стека навигации
   * @param {HTMLElement} container - Контейнер для Breadcrumbs
   * @param {string} modulePath - Путь к модулю
   * @param {string|null} funcName - Имя функции
   */
  renderSimpleBreadcrumbs(container, modulePath, funcName) {
    const pathDiv = document.createElement('div');
    pathDiv.className = 'breadcrumb-path';

    // Всегда показываем Universe
    const universeSpan = this.createUniverseBreadcrumb();
    pathDiv.appendChild(universeSpan);

    if (modulePath) {
      pathDiv.appendChild(this.createArrowSpan());

      const entryModule = this.findEntryModule();
      const navStack = this.app.cardManager?.getNavigationStack?.() || [];

      // Если есть стек навигации, используем его
      if (navStack.length > 0) {
        for (let i = 0; i < navStack.length; i++) {
          const item = navStack[i];
          if (!item) {
            continue;
          }

          const isLast = i === navStack.length - 1;
          const spanItem = this.createBreadcrumbSpan(item, isLast);
          pathDiv.appendChild(spanItem);

          if (!isLast) {
            pathDiv.appendChild(this.createArrowSpan());
          }
        }
      } else {
        // Иначе показываем текущую позицию
        if (funcName) {
          const span = this.createBreadcrumbSpan(funcName, true, 'function');
          pathDiv.appendChild(span);
        } else if (modulePath) {
          const span = this.createBreadcrumbSpan(modulePath, true, 'module');
          pathDiv.appendChild(span);
        }
      }
    }

    container.appendChild(pathDiv);
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

    // Если это корневой элемент Universe
    if (id === 'universe' || type === 'root') {
      return this.createUniverseBreadcrumb();
    }

    const isFunction = type === 'function' || id.includes('#func:');
    const isModule = type === 'module' || !isFunction;

    if (isModule) {
      const pkg = this.app.reportData?.packages?.[id];
      const name = pkg?.displayPath || id.split('/').pop() || id;
      span.textContent = name;
      span.title = id;
      if (!isActive) {
        span.style.cursor = 'pointer';
        span.onclick = e => {
          e.stopPropagation();
          this.app.focusModule(id);
        };
      }
    } else {
      const name = id.split('#func:').pop() || id;
      span.textContent = `ƒ ${name}`;
      span.title = id;
      if (!isActive) {
        span.style.cursor = 'pointer';
        const modulePath = this.findModuleForFunction(name);
        if (modulePath) {
          span.onclick = e => {
            e.stopPropagation();
            this.app.focusFunction(name, modulePath);
          };
        }
      }
    }

    return span;
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
   * Создает span со стрелкой
   * @returns {HTMLElement}
   */
  createArrowSpan() {
    const arrow = document.createElement('span');
    arrow.className = 'breadcrumb-arrow';
    arrow.textContent = ' → ';
    return arrow;
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
      const focusModule = this.app.cardManager?.getFocusModule();
      const focusFunction = this.app.cardManager?.getFocusFunction();
      if (focusModule || focusFunction) {
        this.updateBreadcrumbs(focusModule, focusFunction);
      }
    }
  }
}
