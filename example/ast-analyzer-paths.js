// ============================================================================
// AST ANALYZER — PATHS v1.1
// Поиск всех путей между узлами графа. Только для v13.0.2.
// ============================================================================
//
// НАЗНАЧЕНИЕ
// ----------
// Модуль предоставляет:
//   - BFS-поиск кратчайшего пути между двумя узлами
//   - Поиск ВСЕХ путей между двумя узлами (с ограничениями по глубине/количеству)
//   - Поиск всех путей ОТ узла (до всех достижимых)
//   - Поиск всех путей ДО узла (от всех корней)
//   - Рендер списка путей в HTML
//
// ТИПЫ УЗЛОВ
// ----------
//   - 'function' — функции (рёбра = calls)
//   - 'file'     — файлы (рёбра = imports/dependencies)
//   - 'module'   — модули (рёбра = imports между модулями)
//
// ХЛЕБНЫЕ КРОШКИ
// --------------
// Для активной функции/файла/модуля можно показать:
//   - ВСЕ пути ДО него (от всех корней)
//   - ВСЕ пути ОТ него (до всех листьев)
// Это реализуется через findAllPathsTo / findAllPathsFrom.
//
// ОГРАНИЧЕНИЯ
// -----------
//   - maxPaths (по умолчанию 20) — сколько путей показывать
//   - maxDepth (по умолчанию 6)  — максимальная длина пути
//   - Защита от циклов через Set (O(1) на проверку)
//   - Кратчайшие пути имеют приоритет (BFS + отсечение по длине)
//
// v1.1 (УСКОРЕНИЕ):
//   - ✅ Кэш adjacency на уровне модуля (_adjCache / _getAdjacency)
//   - ✅ path.includes(next) → Set (O(1) вместо O(N))
//   - ✅ Экспорт invalidateAdjacency() для сброса кэша при загрузке проекта
//
// ПУБЛИЧНЫЙ API
// -------------
//   findShortestPath(from, to, opts?)   → { found, path, edges, nodes }
//   findAllPaths(from, to, opts?)       → PathResult[]
//   findAllPathsFrom(fromId, opts?)     → PathResult[]
//   findAllPathsTo(toId, opts?)         → PathResult[]
//   renderPathsList(container, paths, opts?)
//   renderPathsCompact(container, paths, opts?)
//   invalidateAdjacency()               → сбросить кэш смежности
//
// PathResult = {
//   path: string[],                 // ID узлов
//   edges: { from, to }[],          // рёбра
//   nodes: { id, name, module, file, line, isAsync? }[]
//   from?: string,                  // для findAllPathsTo
//   to?: string,                    // для findAllPathsFrom
// }
// ============================================================================

import { state, escapeHtml, shortPath } from './ast-analyzer-core.js';

// ---------------------------------------------------------------------------
// КОНСТАНТЫ
// ---------------------------------------------------------------------------

const MAX_PATHS_DEFAULT = 20;
const MAX_DEPTH_DEFAULT = 6;
const MAX_NODES_IN_PATH = 50;
const MAX_TOTAL_VISITS = 100000;

// ---------------------------------------------------------------------------
// КЭШ ADJACENCY (один граф на тип, инвалидация по требованию)
// ---------------------------------------------------------------------------
let _adjCache = null;
let _adjCacheType = null;

/** Инвалидировать кэш смежности (вызывать при загрузке нового проекта). */
export function invalidateAdjacency() {
  _adjCache = null;
  _adjCacheType = null;
}

function _getAdjacency(type) {
  if (_adjCache && _adjCacheType === type) return _adjCache;
  _adjCache = buildAdjacency(type);
  _adjCacheType = type;
  return _adjCache;
}

// ---------------------------------------------------------------------------
// ПОСТРОЕНИЕ ADJACENCY
// ---------------------------------------------------------------------------

/**
 * Строит список смежности и метаданные узлов для указанного типа графа.
 *
 * @param {'function'|'file'|'module'} type
 * @returns {{ adj: Record<string, string[]>, nodeInfo: Record<string, object> }}
 */
function buildAdjacency(type) {
  const adj = {};
  const nodeInfo = {};

  if (type === 'function') {
    buildFunctionAdjacency(adj, nodeInfo);
  } else if (type === 'file') {
    buildFileAdjacency(adj, nodeInfo);
  } else if (type === 'module') {
    buildModuleAdjacency(adj, nodeInfo);
  } else if (type === 'class') {
    buildClassAdjacency(adj, nodeInfo);
  } else if (type === 'constant') {
    buildConstantAdjacency(adj, nodeInfo);
  }

  return { adj, nodeInfo };
}

/**
 * Граф функций: рёбра = вызовы (calls).
 */
function buildFunctionAdjacency(adj, nodeInfo) {
  for (const fn of Object.values(state.functions)) {
    adj[fn.id] = [];
    const file = state.files[fn.fileId];
    const mod = file ? state.modules[file.moduleId] : null;
    nodeInfo[fn.id] = {
      id: fn.id,
      name: fn.name,
      module: mod?.name || '?',
      moduleId: mod?.id || '',
      file: file?.path || '?',
      fileId: fn.fileId,
      line: fn.line || 0,
      isAsync: fn.isAsync || false,
      type: 'function',
    };
  }
  for (const c of state.calls) {
    if (!adj[c.fromFunctionId]) adj[c.fromFunctionId] = [];
    adj[c.fromFunctionId].push(c.toFunctionId);
  }
}

/**
 * Граф файлов: рёбра = зависимости (fileDependencies).
 */
function buildFileAdjacency(adj, nodeInfo) {
  for (const f of Object.values(state.files)) {
    adj[f.id] = [];
    const mod = state.modules[f.moduleId];
    nodeInfo[f.id] = {
      id: f.id,
      name: f.path,
      module: mod?.name || '?',
      moduleId: mod?.id || '',
      file: f.path,
      fileId: f.id,
      line: 0,
      type: 'file',
    };
  }
  for (const [fid, deps] of Object.entries(state.fileDependencies)) {
    if (!adj[fid]) adj[fid] = [];
    const uniq = [...new Set(deps)];
    for (const d of uniq) {
      if (d && state.files[d]) adj[fid].push(d);
    }
  }
}

/**
 * Граф модулей: рёбра = импорты между модулями.
 */
function buildModuleAdjacency(adj, nodeInfo) {
  for (const m of Object.values(state.modules)) {
    adj[m.id] = [];
    nodeInfo[m.id] = {
      id: m.id,
      name: m.name,
      module: m.name,
      moduleId: m.id,
      file: m.path || '?',
      fileId: '',
      line: 0,
      type: 'module',
    };
  }
  for (const imp of state.imports) {
    if (imp.isExternal) continue;
    const fromFile = state.files[imp.fromFileId];
    const toFile = state.files[imp.toFileId];
    if (!fromFile || !toFile) continue;
    const fromMod = fromFile.moduleId;
    const toMod = toFile.moduleId;
    if (fromMod && toMod && fromMod !== toMod) {
      if (!adj[fromMod]) adj[fromMod] = [];
      if (!adj[fromMod].includes(toMod)) adj[fromMod].push(toMod);
    }
  }
}

/**
 * Граф классов: рёбра = наследование (extends) + вызовы методов.
 */
function buildClassAdjacency(adj, nodeInfo) {
  for (const c of Object.values(state.classes)) {
    adj[c.id] = [];
    const file = state.files[c.fileId];
    const mod = file ? state.modules[file.moduleId] : null;
    nodeInfo[c.id] = {
      id: c.id,
      name: c.name,
      module: mod?.name || '?',
      moduleId: mod?.id || '',
      file: file?.path || '?',
      fileId: c.fileId,
      line: c.line || 0,
      type: 'class',
    };
  }
  // Связи между классами: если класс A содержит метод, который вызывает
  // метод класса B — это ребро. Пока упрощённо: по имени класса в extends.
  // (При необходимости расширить через entity-extractor)
}

/**
 * Граф констант: рёбра = использование константы в других файлах.
 */
function buildConstantAdjacency(adj, nodeInfo) {
  for (const c of Object.values(state.constants)) {
    adj[c.id] = [];
    const file = state.files[c.fileId];
    const mod = file ? state.modules[file.moduleId] : null;
    nodeInfo[c.id] = {
      id: c.id,
      name: c.name,
      module: mod?.name || '?',
      moduleId: mod?.id || '',
      file: file?.path || '?',
      fileId: c.fileId,
      line: c.line || 0,
      type: 'constant',
    };
  }
}

// ---------------------------------------------------------------------------
// BFS: КРАТЧАЙШИЙ ПУТЬ
// ---------------------------------------------------------------------------

/**
 * Находит кратчайший путь между двумя узлами (BFS).
 *
 * @param {string} from — ID начального узла
 * @param {string} to   — ID конечного узла
 * @param {object} [opts]
 * @param {string} [opts.type='function'] — тип графа
 * @returns {{
 *   found: boolean,
 *   path?: string[],
 *   edges?: { from: string, to: string }[],
 *   nodes?: object[],
 *   reason?: string,
 * }}
 */
export function findShortestPath(from, to, opts = {}) {
  const { type = 'function' } = opts;

  if (!from || !to) {
    return { found: false, reason: 'from/to не заданы' };
  }
  if (from === to) {
    const { nodeInfo } = _getAdjacency(type);
    return {
      found: true,
      path: [from],
      edges: [],
      nodes: nodeInfo[from] ? [nodeInfo[from]] : [{ id: from }],
    };
  }

  const { adj, nodeInfo } = _getAdjacency(type);
  if (!adj[from]) return { found: false, reason: `Узел ${from} не найден` };
  if (!adj[to]) return { found: false, reason: `Узел ${to} не найден` };

  const visited = new Set([from]);
  const queue = [{ node: from, path: [from], edges: [] }];
  let visits = 0;

  while (queue.length > 0 && visits < MAX_TOTAL_VISITS) {
    const { node, path, edges } = queue.shift();
    visits++;

    if (node === to) {
      return {
        found: true,
        path,
        edges,
        nodes: path.map(id => nodeInfo[id] || { id }),
      };
    }

    const neighbors = adj[node] || [];
    for (const next of neighbors) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({
        node: next,
        path: [...path, next],
        edges: [...edges, { from: node, to: next }],
      });
    }
  }

  return { found: false, reason: `Путь ${from} → ${to} не найден` };
}

// ---------------------------------------------------------------------------
// BFS: ВСЕ ПУТИ МЕЖДУ ДВУМЯ УЗЛАМИ
// ---------------------------------------------------------------------------

/**
 * Находит ВСЕ кратчайшие (и близкие к кратчайшим) пути между двумя узлами.
 *
 * Алгоритм:
 *   1. BFS с очередью путей.
 *   2. Отсечение по maxDepth и maxPaths.
 *   3. Отсечение путей длиннее найденного кратчайшего (shortestLen).
 *   4. Защита от циклов через Set (O(1)).
 *
 * @param {string} from
 * @param {string} to
 * @param {object} [opts]
 * @param {string} [opts.type='function']
 * @param {number} [opts.maxPaths=20]
 * @param {number} [opts.maxDepth=6]
 * @returns {object[]} — массив путей
 */
export function findAllPaths(from, to, opts = {}) {
  const { type = 'function', maxPaths = MAX_PATHS_DEFAULT, maxDepth = MAX_DEPTH_DEFAULT } = opts;

  if (!from || !to) return [];
  if (from === to) {
    const { nodeInfo } = _getAdjacency(type);
    return [
      {
        path: [from],
        edges: [],
        nodes: nodeInfo[from] ? [nodeInfo[from]] : [{ id: from }],
      },
    ];
  }

  const { adj, nodeInfo } = _getAdjacency(type);
  if (!adj[from] || !adj[to]) return [];

  const results = [];
  const queue = [{ node: from, path: [from], edges: [] }];
  let shortestLen = Infinity;
  let visits = 0;

  while (queue.length > 0 && results.length < maxPaths && visits < MAX_TOTAL_VISITS) {
    const { node, path, edges } = queue.shift();
    visits++;

    // Отсечение по глубине
    if (path.length > maxDepth) continue;
    if (path.length > MAX_NODES_IN_PATH) continue;

    // Отсечение путей длиннее найденного кратчайшего
    if (path.length > shortestLen) continue;

    // Нашли цель
    if (node === to) {
      results.push({
        path,
        edges,
        nodes: path.map(id => nodeInfo[id] || { id }),
      });
      if (path.length < shortestLen) shortestLen = path.length;
      continue;
    }

    // Обходим соседей (Set — O(1) на проверку цикла)
    const neighbors = adj[node] || [];
    const pathSet = new Set(path);
    for (const next of neighbors) {
      if (pathSet.has(next)) continue;
      queue.push({
        node: next,
        path: [...path, next],
        edges: [...edges, { from: node, to: next }],
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// BFS: ВСЕ ПУТИ ОТ УЗЛА
// ---------------------------------------------------------------------------

/**
 * Находит ВСЕ пути ОТ указанного узла (до всех достижимых).
 *
 * Используется для панели «Пути ОТ этой функции» в хлебных крошках.
 *
 * @param {string} fromId
 * @param {object} [opts]
 * @param {string} [opts.type='function']
 * @param {number} [opts.maxPaths=20]
 * @param {number} [opts.maxDepth=6]
 * @returns {object[]}
 */
export function findAllPathsFrom(fromId, opts = {}) {
  const { type = 'function', maxPaths = MAX_PATHS_DEFAULT, maxDepth = MAX_DEPTH_DEFAULT } = opts;

  if (!fromId) return [];
  const { adj, nodeInfo } = _getAdjacency(type);
  if (!adj[fromId]) return [];

  const results = [];
  const queue = [{ node: fromId, path: [fromId], edges: [] }];
  let visits = 0;

  while (queue.length > 0 && results.length < maxPaths && visits < MAX_TOTAL_VISITS) {
    const { node, path, edges } = queue.shift();
    visits++;

    // Отсечение по глубине
    if (path.length > maxDepth) continue;
    if (path.length > MAX_NODES_IN_PATH) continue;

    // Если пришли не в стартовый узел — это путь
    if (path.length > 1) {
      results.push({
        path,
        edges,
        to: node,
        nodes: path.map(id => nodeInfo[id] || { id }),
      });
    }

    // Обходим соседей (Set — O(1) на проверку цикла)
    const neighbors = adj[node] || [];
    const pathSet = new Set(path);
    for (const next of neighbors) {
      if (pathSet.has(next)) continue;
      queue.push({
        node: next,
        path: [...path, next],
        edges: [...edges, { from: node, to: next }],
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// BFS: ВСЕ ПУТИ ДО УЗЛА
// ---------------------------------------------------------------------------

/**
 * Находит ВСЕ пути ДО указанного узла (от всех корневых узлов).
 *
 * Корневой узел — узел без входящих рёбер.
 *
 * Используется для панели «Пути ДО этой функции» в хлебных крошках.
 *
 * @param {string} toId
 * @param {object} [opts]
 * @param {string} [opts.type='function']
 * @param {number} [opts.maxPaths=20]
 * @param {number} [opts.maxDepth=6]
 * @returns {object[]}
 */
export function findAllPathsTo(toId, opts = {}) {
  const { type = 'function', maxPaths = MAX_PATHS_DEFAULT, maxDepth = MAX_DEPTH_DEFAULT } = opts;

  if (!toId) return [];
  const { adj, nodeInfo } = _getAdjacency(type);
  if (!adj[toId]) return [];

  // Находим все корни (узлы без входящих рёбер)
  const incoming = {};
  for (const [from, tos] of Object.entries(adj)) {
    for (const to of tos) {
      if (!incoming[to]) incoming[to] = [];
      incoming[to].push(from);
    }
  }
  const roots = Object.keys(adj).filter(id => !incoming[id] || incoming[id].length === 0);

  // Для каждого корня ищем все пути до toId
  const results = [];
  for (const root of roots) {
    if (results.length >= maxPaths) break;
    if (root === toId) continue;

    const paths = findAllPaths(root, toId, {
      type,
      maxDepth,
      maxPaths: maxPaths - results.length,
    });

    for (const p of paths) {
      results.push({ ...p, from: root });
      if (results.length >= maxPaths) break;
    }
  }

  // Сортируем по длине пути (кратчайшие сверху)
  results.sort((a, b) => a.path.length - b.path.length);

  return results;
}

// ---------------------------------------------------------------------------
// ПОИСК ПУТЕЙ МЕЖДУ РАЗНЫМИ ТИПАМИ УЗЛОВ
// ---------------------------------------------------------------------------

/**
 * Обобщённый поиск путей между двумя узлами разных типов.
 *
 * Если типы from и to различаются — строим смешанный граф,
 * где рёбра:
 *   - function → function  (calls)
 *   - function → file      (fromFunctionId → fileId)
 *   - file     → file      (imports)
 *   - file     → function  (functionId)
 *   - module   → module    (imports)
 *   - module   → file      (fileIds)
 *
 * Пока поддерживаются только однотипные узлы. Для смешанных —
 * возвращаем пустой результат с reason.
 *
 * @param {string} from
 * @param {string} to
 * @param {object} [opts]
 * @returns {object[]}
 */
export function findCrossPaths(from, to, opts = {}) {
  const fromType = detectNodeType(from);
  const toType = detectNodeType(to);

  if (fromType !== toType) {
    // Пока не поддерживается: разные типы узлов
    // Можно расширить: строить смешанный граф
    return [];
  }

  return findAllPaths(from, to, { ...opts, type: fromType });
}

/**
 * Определяет тип узла по его ID.
 *
 * ID-префиксы:
 *   - 'fn'   → function
 *   - 'f'    → file
 *   - 'm'    → module
 *   - 'cls'  → class
 *   - 'cn'   → constant
 *   - 'e'    → export
 *   - 'i'    → import
 *   - 'c'    → call
 *   - 're'   → reExport
 */
export function detectNodeType(id) {
  if (!id || typeof id !== 'string') return null;

  if (id.startsWith('fn')) return 'function';
  if (id.startsWith('cls')) return 'class';
  if (id.startsWith('cn')) return 'constant';
  if (id.startsWith('re')) return 'reExport';
  if (id.startsWith('f')) return 'file';
  if (id.startsWith('m')) return 'module';
  if (id.startsWith('e')) return 'export';
  if (id.startsWith('i')) return 'import';
  if (id.startsWith('c')) return 'call';

  return null;
}

// ---------------------------------------------------------------------------
// СТАТИСТИКА ПУТЕЙ
// ---------------------------------------------------------------------------

/**
 * Возвращает агрегированную статистику по массиву путей.
 *
 * @param {object[]} paths
 * @returns {{
 *   count: number,
 *   minLength: number,
 *   maxLength: number,
 *   avgLength: number,
 *   uniqueNodes: number,
 * }}
 */
export function getPathsStats(paths) {
  if (!paths || paths.length === 0) {
    return { count: 0, minLength: 0, maxLength: 0, avgLength: 0, uniqueNodes: 0 };
  }

  const lengths = paths.map(p => p.path.length);
  const allNodes = new Set();
  for (const p of paths) {
    for (const n of p.path) allNodes.add(n);
  }

  const sum = lengths.reduce((a, b) => a + b, 0);
  return {
    count: paths.length,
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
    avgLength: sum / lengths.length,
    uniqueNodes: allNodes.size,
  };
}

// ---------------------------------------------------------------------------
// РЕНДЕР СПИСКА ПУТЕЙ
// ---------------------------------------------------------------------------

/**
 * Рендерит список путей в указанный контейнер.
 *
 * @param {HTMLElement} container
 * @param {object[]} paths
 * @param {object} [opts]
 * @param {Function} [opts.onNodeClick] — (nodeId, nodeInfo) => void
 * @param {string} [opts.label='путей'] — для заголовка
 * @param {number} [opts.maxShow=30]    — максимум отображаемых путей
 */
export function renderPathsList(container, paths, opts = {}) {
  if (!container) return;

  const { onNodeClick = null, label = 'путей', maxShow = 30 } = opts;

  if (!paths || paths.length === 0) {
    container.innerHTML = '<div class="imp-empty">Пути не найдены</div>';
    return;
  }

  const stats = getPathsStats(paths);
  const shown = paths.slice(0, maxShow);

  const rowsHtml = shown.map((p, i) => renderPathRow(p, i, onNodeClick)).join('');
  const moreHtml =
    paths.length > maxShow
      ? `<div class="path-more">… ещё ${paths.length - maxShow} путей</div>`
      : '';

  container.innerHTML = `
    <div class="paths-list">
      <div class="paths-count">
        Найдено <b>${paths.length}</b> ${escapeHtml(label)}
        · длины: ${stats.minLength}–${stats.maxLength}
        · узлов: ${stats.uniqueNodes}
      </div>
      ${rowsHtml}
      ${moreHtml}
    </div>
  `;
}

/**
 * Рендерит одну строку пути.
 */
function renderPathRow(p, i, onNodeClick) {
  const nodes = p.nodes || [];
  const chainHtml = nodes
    .map((n, j) => {
      const isLast = j === nodes.length - 1;
      const name = n.name || n.id || '?';
      const title = buildNodeTitle(n);
      const clickable = onNodeClick && n.id;
      return `
      <span class="path-node${clickable ? ' clickable' : ''}"
            ${clickable ? `data-action="select-path-node" data-id="${escapeHtml(n.id)}"` : ''}
            title="${escapeHtml(title)}">
        ${escapeHtml(shortPath(name, 32))}
      </span>
      ${!isLast ? '<span class="path-arrow">→</span>' : ''}
    `;
    })
    .join('');

  return `
    <div class="path-row">
      <span class="path-idx">#${i + 1}</span>
      <span class="path-len">${p.path.length}</span>
      <div class="path-chain">${chainHtml}</div>
    </div>
  `;
}

/**
 * Строит title для узла пути.
 */
function buildNodeTitle(n) {
  const parts = [n.name || n.id || '?'];
  if (n.type) parts.push(`тип: ${n.type}`);
  if (n.module) parts.push(`модуль: ${n.module}`);
  if (n.file && n.file !== n.name) parts.push(`файл: ${n.file}`);
  if (n.line) parts.push(`строка: ${n.line}`);
  if (n.isAsync) parts.push('async');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// РЕНДЕР КОМПАКТНОГО СПИСКА (только пути, без счётчика)
// ---------------------------------------------------------------------------

/**
 * Рендерит только пути, без заголовка. Полезно для встраивания
 * в уже существующие панели.
 */
export function renderPathsCompact(container, paths, opts = {}) {
  if (!container) return;
  const { onNodeClick = null, maxShow = 30 } = opts;

  if (!paths || paths.length === 0) {
    container.innerHTML = '<div class="imp-empty">Пути не найдены</div>';
    return;
  }

  container.innerHTML = paths
    .slice(0, maxShow)
    .map((p, i) => renderPathRow(p, i, onNodeClick))
    .join('');
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ
// ---------------------------------------------------------------------------

export default {
  findShortestPath,
  findAllPaths,
  findAllPathsFrom,
  findAllPathsTo,
  findCrossPaths,
  detectNodeType,
  getPathsStats,
  renderPathsList,
  renderPathsCompact,
  invalidateAdjacency,
};
