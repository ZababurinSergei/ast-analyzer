// ============================================================================
// AST ANALYZER — GRAPH v9.1
// Визуализация графов на чистом SVG.
//
// Модуль предоставляет:
//   - renderCallGraph(fnId, opts)      — граф вызовов вокруг функции
//   - renderFileDepGraph(fileId, opts) — граф зависимостей файла
//   - renderModuleGraph(opts)          — граф модулей проекта
//   - renderHeatmap()                  — heatmap файлов по числу связей
//   - renderCallChain(fnId, opts)      — цепочка вызовов (линейная)
//   - renderMiniMap()                  — мини-карта всего проекта
//   - exportGraphSVG(container, name)  — экспорт SVG
//   - exportGraphPNG(container, name)  — экспорт PNG
//   - getGraphStats(fnId)              — статистика графа вокруг функции
//
// Обновления v9.1:
//   - Защита от undefined при работе с ID файлов/функций после декодирования
//   - Поддержка внешних функций с fallback-меткой
//   - Улучшенные тултипы для узлов
//   - Фильтрация "мусорных" рёбер (self-loops, дубликатов)
//   - Стабильный layout при пустых данных
// ============================================================================

import {
  state,
  escapeHtml,
  shortPath,
  getModuleName,
  getFilePath,
  getFnById,
} from './ast-analyzer-core.js';

const NS = 'http://www.w3.org/2000/svg';

// ============================================================================
// SVG-УТИЛИТЫ
// ============================================================================

/**
 * Создаёт SVG-элемент с атрибутами.
 */
function svg(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) e.setAttribute(k, v);
  }
  return e;
}

/**
 * Возвращает строку с defs для маркеров-стрелок.
 */
function arrowDefs(id, color) {
  return `
    <defs>
      <marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
      </marker>
    </defs>
  `;
}

/**
 * Обрезает строку до max символов с многоточием.
 */
function truncate(s, max) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Безопасное получение имени функции.
 */
function safeFnName(fnId) {
  const fn = getFnById(fnId);
  return fn?.name || (fnId || '?').replace('external:', '🌐 ');
}

/**
 * Безопасное получение пути файла.
 */
function safeFilePath(fileId) {
  if (!fileId) return '?';
  const path = getFilePath(fileId);
  return path || fileId;
}

/**
 * Проверка: является ли ID внешней функцией.
 */
function isExternalId(id) {
  return typeof id === 'string' && id.startsWith('external:');
}

// ============================================================================
// БАЗОВЫЙ РЕНДЕР УЗЛА
// ============================================================================

/**
 * Рисует узел графа (прямоугольник + иконка + метка + подпись).
 */
function drawNode(s, x, y, w, h, label, sub, cls, id, type, onNodeClick) {
  const g = svg('g', {
    class: 'graph-node ' + cls,
    'data-id': id || '',
    'data-type': type || '',
  });

  g.appendChild(svg('rect', {
    x, y, width: w, height: h, rx: 8, ry: 8,
    class: 'graph-node-rect',
  }));

  // Иконка типа (слева)
  const iconMap = {
    fn: 'ƒ',
    file: '📄',
    module: '📦',
    const: '📌',
    class: '🏛',
    external: '🌐',
  };
  const icon = iconMap[type] || '·';
  const iconText = svg('text', {
    x: x + 10, y: y + h / 2 + 4,
    class: 'graph-node-icon',
    'text-anchor': 'start',
  });
  iconText.textContent = icon;
  g.appendChild(iconText);

  // Основная метка
  const t1 = svg('text', {
    x: x + 26, y: y + 18,
    class: 'graph-node-label',
    'text-anchor': 'start',
  });
  t1.textContent = truncate(label, 26);
  g.appendChild(t1);

  // Подпись
  if (sub) {
    const t2 = svg('text', {
      x: x + 26, y: y + 34,
      class: 'graph-node-sub',
      'text-anchor': 'start',
    });
    t2.textContent = truncate(sub, 32);
    g.appendChild(t2);
  }

  // Интерактив
  if (onNodeClick && id && !isExternalId(id)) {
    g.style.cursor = 'pointer';
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      onNodeClick(id, type);
    });
  } else if (isExternalId(id)) {
    g.style.cursor = 'help';
  }

  // Тултип
  const title = svg('title');
  const titleParts = [label];
  if (sub) titleParts.push(sub);
  if (isExternalId(id)) titleParts.push('(внешняя функция)');
  title.textContent = titleParts.join('\n');
  g.appendChild(title);

  s.appendChild(g);
  return g;
}

// ============================================================================
// РЕНДЕР РЕБРА (кривая Безье)
// ============================================================================

function drawEdge(s, x1, y1, x2, y2, cls, markerId, label) {
  const cx1 = x1 + (x2 - x1) * 0.5;
  const cx2 = x1 + (x2 - x1) * 0.5;
  const path = svg('path', {
    d: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`,
    class: 'graph-edge ' + cls,
    'marker-end': markerId ? `url(#${markerId})` : null,
  });
  s.appendChild(path);

  if (label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const t = svg('text', {
      x: mx, y: my - 3,
      class: 'graph-edge-label',
      'text-anchor': 'middle',
    });
    t.textContent = label;
    s.appendChild(t);
  }
  return path;
}

// ============================================================================
// ГРАФ ВЫЗОВОВ ВОКРУГ ФУНКЦИИ
// ============================================================================

/**
 * Рисует граф вызовов вокруг функции.
 *
 * @param {string} fnId
 * @param {object} [opts]
 * @param {number} [opts.maxNodes=8]
 * @param {Function} [opts.onNodeClick]
 * @param {boolean} [opts.showExternal=true]
 * @returns {HTMLElement}
 */
export function renderCallGraph(fnId, {
  maxNodes = 8,
  onNodeClick = null,
  showExternal = true,
} = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'graph-wrap';

  const fn = getFnById(fnId);
  if (!fn) {
    wrap.innerHTML = '<div class="empty-msg">Функция не найдена</div>';
    return wrap;
  }

  // Входы: кто вызывает
  const callers = (state.fnDetailedCallers[fnId] || []).slice(0, maxNodes);

  // Выходы: кого вызывает (внутренние + внешние)
  let calleesRaw = (state.fnDetailedCalls[fnId] || []);
  if (!showExternal) calleesRaw = calleesRaw.filter(c => !c.isExternal);

  // Убираем self-loops и дубликаты
  const seenCallees = new Set();
  const callees = [];
  for (const c of calleesRaw) {
    if (c.toFnId === fnId) continue;
    if (seenCallees.has(c.toFnId)) continue;
    seenCallees.add(c.toFnId);
    callees.push(c);
    if (callees.length >= maxNodes) break;
  }

  const nodeW = 220, nodeH = 48;
  const gapX = 100, gapY = 16;
  const padX = 20, padY = 20;

  const maxRows = Math.max(callers.length, callees.length, 1);
  const width = 3 * nodeW + 2 * gapX + 2 * padX;
  const height = Math.max(maxRows * (nodeH + gapY) + 2 * padY + 40, 260);

  const centerX = padX + nodeW + gapX + nodeW / 2;
  const centerY = height / 2;

  const s = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'graph-svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

  s.innerHTML = `
    ${arrowDefs('arr-in', '#a371f7')}
    ${arrowDefs('arr-out', '#58a6ff')}
    ${arrowDefs('arr-ext', '#f85149')}
  `;

  // Центральный узел
  const centerFile = shortPath(safeFilePath(fn.fileId), 30);
  const centerXPos = centerX - nodeW / 2;
  const centerYPos = centerY - nodeH / 2;
  drawNode(s, centerXPos, centerYPos, nodeW, nodeH, fn.name, centerFile, 'center', fnId, 'fn', onNodeClick);

  // Входы (слева)
  callers.forEach((c, i) => {
    const total = callers.length;
    const x = padX;
    const y = centerY - (total * (nodeH + gapY)) / 2 + i * (nodeH + gapY);
    drawNode(
      s, x, y, nodeW, nodeH,
      c.fromFnName || '?',
      shortPath(c.fromFilePath || '?', 30),
      'caller',
      c.fromFnId, 'fn', onNodeClick
    );
    drawEdge(
      s,
      x + nodeW, y + nodeH / 2,
      centerXPos, centerY,
      'edge-in', 'arr-in',
      c.callType || ''
    );
  });

  // Выходы (справа)
  callees.forEach((c, i) => {
    const total = callees.length;
    const x = width - nodeW - padX;
    const y = centerY - (total * (nodeH + gapY)) / 2 + i * (nodeH + gapY);
    const cls = c.isExternal ? 'callee external' : 'callee';
    const type = c.isExternal ? 'external' : 'fn';
    const sub = c.isExternal ? '🌐 external' : shortPath(c.toFilePath || '?', 30);
    drawNode(s, x, y, nodeW, nodeH, c.toFnName || '?', sub, cls, c.toFnId, type, onNodeClick);
    drawEdge(
      s,
      centerXPos + nodeW, centerY,
      x, y + nodeH / 2,
      c.isExternal ? 'edge-ext' : 'edge-out',
      c.isExternal ? 'arr-ext' : 'arr-out',
      c.callType || ''
    );
  });

  // Заглушка при отсутствии связей
  if (callers.length === 0 && callees.length === 0) {
    const empty = svg('text', {
      x: width / 2, y: height - 10,
      class: 'graph-empty-text',
      'text-anchor': 'middle',
    });
    empty.textContent = 'Нет связей';
    s.appendChild(empty);
  }

  wrap.appendChild(s);
  return wrap;
}

// ============================================================================
// ЦЕПОЧКА ВЫЗОВОВ (линейная)
// ============================================================================

/**
 * Линейная цепочка вызовов вокруг функции.
 *
 * @param {string} fnId
 * @param {object} [opts]
 * @param {'both'|'callers'|'callees'} [opts.direction='both']
 * @param {number} [opts.depth=3]
 * @param {Function} [opts.onNodeClick]
 * @returns {HTMLElement}
 */
export function renderCallChain(fnId, {
  direction = 'both',
  depth = 3,
  onNodeClick = null,
} = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'graph-chain';

  const fn = getFnById(fnId);
  if (!fn) {
    wrap.innerHTML = '<div class="empty-msg">Функция не найдена</div>';
    return wrap;
  }

  const chainEl = document.createElement('div');
  chainEl.className = 'chain';

  const callers = (direction === 'both' || direction === 'callers')
    ? (state.fnDetailedCallers[fnId] || []).slice(0, depth)
    : [];
  const callees = (direction === 'both' || direction === 'callees')
    ? (state.fnDetailedCalls[fnId] || [])
      .filter(c => !c.isExternal && c.toFnId !== fnId)
      .slice(0, depth)
    : [];

  const parts = [];

  // Вызывающие
  callers.forEach((c) => {
    parts.push(
      `<span class="chain-node" data-action="jump-fn" data-id="${escapeHtml(c.fromFnId)}">${escapeHtml(c.fromFnName || '?')}</span>`
    );
    parts.push('<span class="chain-arrow">→</span>');
  });

  // Центральный узел
  parts.push(`<span class="chain-node current">${escapeHtml(fn.name)}</span>`);

  // Вызываемые
  callees.forEach((c) => {
    parts.push('<span class="chain-arrow">→</span>');
    parts.push(
      `<span class="chain-node" data-action="jump-fn" data-id="${escapeHtml(c.toFnId)}">${escapeHtml(c.toFnName || '?')}</span>`
    );
  });

  chainEl.innerHTML = parts.join('');
  wrap.appendChild(chainEl);

  if (callers.length === 0 && callees.length === 0) {
    wrap.innerHTML = '<div class="empty-msg">Нет связей вызовов</div>';
  }

  return wrap;
}

// ============================================================================
// ГРАФ ЗАВИСИМОСТЕЙ ФАЙЛОВ
// ============================================================================

/**
 * Граф зависимостей файла: слева — куда импортирует, справа — кто импортирует.
 *
 * @param {string} fileId
 * @param {object} [opts]
 * @param {number} [opts.maxNodes=10]
 * @param {Function} [opts.onNodeClick]
 * @returns {HTMLElement}
 */
export function renderFileDepGraph(fileId, {
  maxNodes = 10,
  onNodeClick = null,
} = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'graph-wrap';

  const f = state.files[fileId];
  if (!f) {
    wrap.innerHTML = '<div class="empty-msg">Файл не найден</div>';
    return wrap;
  }

  const deps = [...new Set(state.fileDependencies[fileId] || [])]
    .filter(id => id && state.files[id])
    .slice(0, maxNodes);
  const dependents = [...new Set(state.fileDependents[fileId] || [])]
    .filter(id => id && state.files[id])
    .slice(0, maxNodes);

  const nodeW = 240, nodeH = 48;
  const gapX = 110, gapY = 14;
  const padX = 20, padY = 20;

  const maxRows = Math.max(deps.length, dependents.length, 1);
  const width = 3 * nodeW + 2 * gapX + 2 * padX;
  const height = Math.max(maxRows * (nodeH + gapY) + 2 * padY + 40, 260);

  const centerX = padX + nodeW + gapX + nodeW / 2;
  const centerY = height / 2;

  const s = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'graph-svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

  s.innerHTML = `
    ${arrowDefs('arr-in-f', '#3fb950')}
    ${arrowDefs('arr-out-f', '#d29922')}
  `;

  const centerXPos = centerX - nodeW / 2;
  const centerYPos = centerY - nodeH / 2;

  // Центр
  drawNode(
    s, centerXPos, centerYPos, nodeW, nodeH,
    (f.path || '?').split('/').pop(),
    getModuleName(f.moduleId),
    'center', fileId, 'file', onNodeClick
  );

  // Импортирует из (слева) — исходящие
  deps.forEach((id, i) => {
    const file = state.files[id];
    if (!file) return;
    const total = deps.length;
    const x = padX;
    const y = centerY - (total * (nodeH + gapY)) / 2 + i * (nodeH + gapY);
    drawNode(
      s, x, y, nodeW, nodeH,
      (file.path || '?').split('/').pop(),
      getModuleName(file.moduleId),
      'caller', id, 'file', onNodeClick
    );
    drawEdge(
      s,
      centerXPos, centerY,
      x + nodeW, y + nodeH / 2,
      'edge-out', 'arr-out-f'
    );
  });

  // Импортируют (справа) — входящие
  dependents.forEach((id, i) => {
    const file = state.files[id];
    if (!file) return;
    const total = dependents.length;
    const x = width - nodeW - padX;
    const y = centerY - (total * (nodeH + gapY)) / 2 + i * (nodeH + gapY);
    drawNode(
      s, x, y, nodeW, nodeH,
      (file.path || '?').split('/').pop(),
      getModuleName(file.moduleId),
      'callee', id, 'file', onNodeClick
    );
    drawEdge(
      s,
      centerXPos + nodeW, centerY,
      x, y + nodeH / 2,
      'edge-in', 'arr-in-f'
    );
  });

  if (deps.length === 0 && dependents.length === 0) {
    const empty = svg('text', {
      x: width / 2, y: height - 10,
      class: 'graph-empty-text',
      'text-anchor': 'middle',
    });
    empty.textContent = 'Нет зависимостей';
    s.appendChild(empty);
  }

  wrap.appendChild(s);
  return wrap;
}

// ============================================================================
// ГРАФ МОДУЛЕЙ
// ============================================================================

/**
 * Сетка модулей проекта.
 *
 * @param {object} [opts]
 * @param {Function} [opts.onNodeClick]
 * @returns {HTMLElement}
 */
export function renderModuleGraph({ onNodeClick = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'graph-wrap';

  const modules = Object.values(state.modules);
  if (!modules.length) {
    wrap.innerHTML = '<div class="empty-msg">Нет модулей</div>';
    return wrap;
  }

  const nodeW = 190, nodeH = 56;
  const gapX = 24, gapY = 24;
  const padX = 20, padY = 20;
  const cols = Math.min(6, Math.ceil(Math.sqrt(modules.length)));
  const rows = Math.ceil(modules.length / cols);
  const width = cols * nodeW + (cols - 1) * gapX + 2 * padX;
  const height = rows * nodeH + (rows - 1) * gapY + 2 * padY;

  const s = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'graph-svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

  modules.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padX + col * (nodeW + gapX);
    const y = padY + row * (nodeH + gapY);

    const fileCount = (state.moduleFiles[m.id] || []).length;

    const g = svg('g', {
      class: 'graph-node module-node',
      'data-id': m.id,
      'data-type': 'module',
    });

    g.appendChild(svg('rect', {
      x, y, width: nodeW, height: nodeH, rx: 8, ry: 8,
      class: 'graph-node-rect module-rect',
    }));

    const icon = svg('text', {
      x: x + 10, y: y + nodeH / 2 + 4,
      class: 'graph-node-icon',
    });
    icon.textContent = '📦';
    g.appendChild(icon);

    const t1 = svg('text', {
      x: x + 28, y: y + 22,
      class: 'graph-node-label',
    });
    t1.textContent = truncate(m.name, 20);
    g.appendChild(t1);

    const t2 = svg('text', {
      x: x + 28, y: y + 40,
      class: 'graph-node-sub',
    });
    t2.textContent = `${fileCount} файлов`;
    g.appendChild(t2);

    if (onNodeClick) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        onNodeClick(m.id, 'module');
      });
    }

    const title = svg('title');
    title.textContent = `${m.name}\n${m.path || ''}\n${fileCount} файлов`;
    g.appendChild(title);

    s.appendChild(g);
  });

  wrap.appendChild(s);
  return wrap;
}

// ============================================================================
// HEATMAP ФАЙЛОВ
// ============================================================================

/**
 * Heatmap файлов по числу связей (входящие + исходящие).
 *
 * @param {object} [opts]
 * @param {number} [opts.max=60]
 * @returns {string} — HTML-строка
 */
export function renderHeatmap({ max = 60 } = {}) {
  const files = Object.values(state.files);
  if (!files.length) return '<div class="empty-msg">Нет файлов</div>';

  const linkCounts = files.map(f => {
    const out = new Set(state.fileDependencies[f.id] || []).size;
    const inc = new Set(state.fileDependents[f.id] || []).size;
    return { id: f.id, file: f, out, inc, total: out + inc };
  });

  const maxLinks = Math.max(...linkCounts.map(x => x.total), 1);
  const sorted = [...linkCounts].sort((a, b) => b.total - a.total).slice(0, max);

  const cells = sorted.map(({ id, file, out, inc, total }) => {
    const t = total / maxLinks;
    const r = Math.round(63 + (248 - 63) * t);
    const g = Math.round(185 + (81 - 185) * t);
    const b = Math.round(80 + (73 - 80) * t);
    const bg = `rgba(${r},${g},${b},${0.15 + t * 0.6})`;
    const fileName = (file.path || '?').split('/').pop();
    return `<div class="heat-cell" data-action="select-file" data-id="${escapeHtml(id)}"
              title="${escapeHtml(file.path)}\n→ ${out} · ← ${inc}"
              style="background: ${bg};">
      <span class="heat-cell-label">${escapeHtml(fileName)}</span>
      <span class="heat-cell-count">${total}</span>
    </div>`;
  }).join('');

  return `<div class="heatmap">${cells}</div>`;
}

// ============================================================================
// МИНИ-КАРТА ПРОЕКТА
// ============================================================================

/**
 * Мини-карта всех модулей проекта с рёбрами по импортам.
 *
 * @param {object} [opts]
 * @param {Function} [opts.onNodeClick]
 * @returns {HTMLElement}
 */
export function renderMiniMap({ onNodeClick = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'graph-wrap';

  const modules = Object.values(state.modules);
  if (!modules.length) {
    wrap.innerHTML = '<div class="empty-msg">Нет модулей</div>';
    return wrap;
  }

  const nodeW = 120, nodeH = 40;
  const gapX = 20, gapY = 20;
  const padX = 20, padY = 20;
  const cols = Math.min(6, Math.ceil(Math.sqrt(modules.length)));
  const rows = Math.ceil(modules.length / cols);
  const width = cols * nodeW + (cols - 1) * gapX + 2 * padX;
  const height = rows * nodeH + (rows - 1) * gapY + 2 * padY;

  const s = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'graph-svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

  // Позиции
  const pos = {};
  modules.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padX + col * (nodeW + gapX);
    const y = padY + row * (nodeH + gapY);
    pos[m.id] = { x, y, cx: x + nodeW / 2, cy: y + nodeH / 2 };
  });

  // Связи между модулями по импортам файлов
  const moduleLinks = {};
  for (const imp of state.imports) {
    if (imp.isExternal) continue;
    const fromFile = state.files[imp.fromFileId];
    const toFile = state.files[imp.toFileId];
    if (!fromFile || !toFile) continue;
    const fromMod = fromFile.moduleId;
    const toMod = toFile.moduleId;
    if (!fromMod || !toMod || fromMod === toMod) continue;
    const key = fromMod + '→' + toMod;
    moduleLinks[key] = (moduleLinks[key] || 0) + 1;
  }

  // Рисуем связи
  for (const [key, count] of Object.entries(moduleLinks)) {
    const [from, to] = key.split('→');
    const p1 = pos[from];
    const p2 = pos[to];
    if (!p1 || !p2) continue;
    const path = svg('path', {
      d: `M ${p1.cx} ${p1.cy} L ${p2.cx} ${p2.cy}`,
      class: 'graph-edge minimap-edge',
      'stroke-width': Math.min(3, 1 + Math.log2(count + 1)),
      opacity: Math.min(0.8, 0.2 + count / 20),
    });
    s.appendChild(path);
  }

  // Рисуем узлы
  modules.forEach(m => {
    const p = pos[m.id];
    const g = svg('g', {
      class: 'graph-node minimap-node',
      'data-id': m.id,
      'data-type': 'module',
    });
    g.appendChild(svg('rect', {
      x: p.x, y: p.y, width: nodeW, height: nodeH, rx: 6, ry: 6,
      class: 'graph-node-rect module-rect',
    }));
    const t = svg('text', {
      x: p.x + nodeW / 2, y: p.y + nodeH / 2 + 4,
      class: 'graph-node-label',
      'text-anchor': 'middle',
    });
    t.textContent = truncate(m.name, 14);
    g.appendChild(t);

    if (onNodeClick) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        onNodeClick(m.id, 'module');
      });
    }

    const title = svg('title');
    title.textContent = m.name;
    g.appendChild(title);

    s.appendChild(g);
  });

  wrap.appendChild(s);
  return wrap;
}

// ============================================================================
// ЭКСПОРТ SVG
// ============================================================================

/**
 * Скачивает граф как SVG с внедрёнными стилями.
 *
 * @param {HTMLElement} container
 * @param {string} [filename='graph.svg']
 * @returns {boolean}
 */
export function exportGraphSVG(container, filename) {
  const svgEl = container.querySelector('svg');
  if (!svgEl) return false;

  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', NS);

  // Внедряем стили (для корректного отображения при скачивании)
  const styleEl = document.createElementNS(NS, 'style');
  styleEl.textContent = `
    .graph-node-rect { fill: #161b22; stroke: #30363d; stroke-width: 1.5; }
    .graph-node.center .graph-node-rect { fill: rgba(88,166,255,0.1); stroke: #58a6ff; stroke-width: 2; }
    .graph-node.caller .graph-node-rect { fill: rgba(163,113,247,0.1); stroke: #a371f7; }
    .graph-node.callee .graph-node-rect { fill: rgba(88,166,255,0.1); stroke: #58a6ff; }
    .graph-node.module-rect { fill: rgba(63,185,80,0.1); stroke: #3fb950; }
    .graph-node-label { font-family: monospace; font-size: 12px; font-weight: 700; fill: #e6edf3; }
    .graph-node-sub { font-family: monospace; font-size: 10px; fill: #8b949e; }
    .graph-node-icon { font-size: 14px; fill: #e6edf3; }
    .graph-edge { fill: none; stroke-width: 1.5; opacity: 0.7; }
    .graph-edge.edge-in { stroke: #a371f7; }
    .graph-edge.edge-out { stroke: #58a6ff; }
    .graph-edge.edge-ext { stroke: #f85149; }
    .graph-edge.minimap-edge { stroke: #58a6ff; }
    .graph-edge-label { font-family: monospace; font-size: 9px; fill: #8b949e; }
    .graph-empty-text { font-family: monospace; font-size: 11px; fill: #6e7681; }
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  const s = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([s], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'graph.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ============================================================================
// ЭКСПОРТ PNG
// ============================================================================

/**
 * Скачивает граф как PNG через canvas.
 *
 * @param {HTMLElement} container
 * @param {string} [filename='graph.png']
 * @param {number} [scale=2]
 * @returns {Promise<boolean>}
 */
export function exportGraphPNG(container, filename, scale = 2) {
  return new Promise((resolve) => {
    const svgEl = container.querySelector('svg');
    if (!svgEl) { resolve(false); return; }

    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', NS);

    const styleEl = document.createElementNS(NS, 'style');
    styleEl.textContent = `
      .graph-node-rect { fill: #161b22; stroke: #30363d; stroke-width: 1.5; }
      .graph-node.center .graph-node-rect { fill: rgba(88,166,255,0.1); stroke: #58a6ff; stroke-width: 2; }
      .graph-node.caller .graph-node-rect { fill: rgba(163,113,247,0.1); stroke: #a371f7; }
      .graph-node.callee .graph-node-rect { fill: rgba(88,166,255,0.1); stroke: #58a6ff; }
      .graph-node.module-rect { fill: rgba(63,185,80,0.1); stroke: #3fb950; }
      .graph-node-label { font-family: monospace; font-size: 12px; font-weight: 700; fill: #e6edf3; }
      .graph-node-sub { font-family: monospace; font-size: 10px; fill: #8b949e; }
      .graph-node-icon { font-size: 14px; fill: #e6edf3; }
      .graph-edge { fill: none; stroke-width: 1.5; opacity: 0.7; }
      .graph-edge.edge-in { stroke: #a371f7; }
      .graph-edge.edge-out { stroke: #58a6ff; }
      .graph-edge.edge-ext { stroke: #f85149; }
    `;
    clone.insertBefore(styleEl, clone.firstChild);

    const s = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const vb = (clone.getAttribute('viewBox') || '0 0 800 600').split(/\s+/);
      const w = parseInt(vb[2], 10) || 800;
      const h = parseInt(vb[3], 10) || 600;

      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (!blob) { resolve(false); return; }
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename || 'graph.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
        }, 1000);
        resolve(true);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

// ============================================================================
// СТАТИСТИКА ГРАФА
// ============================================================================

/**
 * Статистика графа вокруг функции.
 *
 * @param {string} fnId
 * @returns {object|null}
 */
export function getGraphStats(fnId) {
  const fn = getFnById(fnId);
  if (!fn) return null;

  const callers = state.fnDetailedCallers[fnId] || [];
  const callees = state.fnDetailedCalls[fnId] || [];
  const internalCallees = callees.filter(c => !c.isExternal);
  const externalCallees = callees.filter(c => c.isExternal);

  return {
    callersCount: callers.length,
    calleesCount: callees.length,
    internalCalleesCount: internalCallees.length,
    externalCalleesCount: externalCallees.length,
    transitiveCallersCount: state.fnTransitiveCallers?.[fnId]?.length || 0,
    transitiveCalleesCount: state.fnTransitiveCallees?.[fnId]?.length || 0,
  };
}
