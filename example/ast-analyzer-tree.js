// ============================================================================
// AST ANALYZER — TREE v1.5
// Двумерный кэш (глубина × ширина) + ленивый HTML + LRU.
// Корень всегда раскрыт. Путь до активной ноды раскрывается перед рендером.
// Открытые директории НЕ кэшируются.
// Клик по файлу с функциями: 1-й — раскрыть, 2-й — выбрать.
// Прокрутка к активной ноде через getBoundingClientRect.
// ============================================================================

import { state, escapeHtml } from './ast-analyzer-core.js';

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

const PATH_SEP_RE = /[\\/]+/;

export function normalizePath(p) {
  if (!p) return '';
  return String(p).replace(/\\/g, '/').replace(/^\.?\//, '');
}

function baseName(p) {
  if (!p) return '';
  const norm = normalizePath(p);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? norm : norm.slice(idx + 1);
}

function dirName(p) {
  if (!p) return '';
  const norm = normalizePath(p);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '' : norm.slice(0, idx);
}

// ---------------------------------------------------------------------------
// Построение дерева
// ---------------------------------------------------------------------------

export function buildFsTree(files) {
  const root = {
    name: '',
    path: '',
    type: 'dir',
    children: new Map(),
    fileCount: 0,
  };

  for (const f of files || []) {
    if (!f || !f.path) continue;
    const norm = normalizePath(f.path);
    const parts = norm.split(PATH_SEP_RE).filter(Boolean);
    if (parts.length === 0) continue;

    let cur = root;
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        cur.children.set(part, {
          name: part,
          path: acc,
          type: 'file',
          fileId: f.id,
          moduleId: f.moduleId,
          functions: null,
          children: new Map(),
        });
      } else {
        let dir = cur.children.get(part);
        if (!dir) {
          dir = {
            name: part,
            path: acc,
            type: 'dir',
            children: new Map(),
            fileCount: 0,
          };
          cur.children.set(part, dir);
        }
        cur = dir;
      }
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node) {
  if (node.type !== 'dir') return;
  const entries = [...node.children.entries()];
  entries.sort((a, b) => {
    const A = a[1];
    const B = b[1];
    if (A.type !== B.type) return A.type === 'dir' ? -1 : 1;
    return A.name.localeCompare(B.name, 'ru');
  });
  node.children = new Map(entries);

  let count = 0;
  for (const [, child] of node.children) {
    if (child.type === 'file') count++;
    else {
      sortTree(child);
      count += child.fileCount;
    }
  }
  node.fileCount = count;
}

export function attachFunctions(root) {
  const walk = (node) => {
    if (node.type === 'file') {
      node.functions = state.fileFunctions?.[node.fileId] || [];
      return;
    }
    for (const [, child] of node.children) walk(child);
  };
  walk(root);
  return root;
}

export function filterFsTree(root, query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return root;

  const walk = (node) => {
    if (node.type === 'file') {
      const nameMatch = node.name.toLowerCase().includes(q);
      const fnMatch = (node.functions || []).some((fn) =>
        fn.name.toLowerCase().includes(q)
      );
      return nameMatch || fnMatch ? node : null;
    }
    const keptChildren = new Map();
    for (const [k, child] of node.children) {
      const res = walk(child);
      if (res) keptChildren.set(k, res);
    }
    if (keptChildren.size === 0) return null;
    return { ...node, children: keptChildren };
  };

  return walk(root);
}

export function collectPaths(node, out = []) {
  out.push(node.path);
  if (node.type === 'dir') {
    for (const [, child] of node.children) collectPaths(child, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2D-КЭШ ДЕРЕВА
// ---------------------------------------------------------------------------

const _tc = {
  tree: null,
  filesKey: '',
  byDepth: new Map(),
  bySiblings: new Map(),
  htmlCache: new Map(),
  htmlOrder: [],
  HTML_MAX: 500,
  expanded: new Set(),
  lastQuery: null,
  lastFiltered: null,
};

function _filesKey() {
  const ids = Object.keys(state.files || {});
  if (!ids.length) return '0';
  return `${ids.length}:${ids[0]}:${ids[ids.length - 1]}`;
}

function _buildIndexes(root) {
  _tc.byDepth.clear();
  _tc.bySiblings.clear();

  const walk = (node, depth) => {
    let bucket = _tc.byDepth.get(depth);
    if (!bucket) {
      bucket = [];
      _tc.byDepth.set(depth, bucket);
    }
    bucket.push(node);

    if (node.type === 'dir') {
      const children = [...node.children.values()];
      _tc.bySiblings.set(node.path, children);
      for (const c of children) walk(c, depth + 1);
    }
  };
  walk(root, 0);
}

export function buildTreeOnce() {
  const key = _filesKey();
  if (_tc.tree && _tc.filesKey === key) return _tc.tree;

  const t0 = performance.now();
  const tree = buildFsTree(Object.values(state.files || {}));
  attachFunctions(tree);
  _tc.tree = tree;
  _tc.filesKey = key;
  _buildIndexes(tree);
  _tc.expanded.clear();
  _tc.htmlCache.clear();
  _tc.htmlOrder.length = 0;
  _tc.lastQuery = null;
  _tc.lastFiltered = null;

  console.log(`[Tree] buildOnce ${(performance.now() - t0).toFixed(1)}ms`);
  return tree;
}

export function invalidateTreeCache() {
  _tc.tree = null;
  _tc.filesKey = '';
  _tc.byDepth.clear();
  _tc.bySiblings.clear();
  _tc.htmlCache.clear();
  _tc.htmlOrder.length = 0;
  _tc.expanded.clear();
  _tc.lastQuery = null;
  _tc.lastFiltered = null;
}

function _htmlGet(key) {
  const v = _tc.htmlCache.get(key);
  if (v === undefined) return null;
  const idx = _tc.htmlOrder.indexOf(key);
  if (idx >= 0) {
    _tc.htmlOrder.splice(idx, 1);
    _tc.htmlOrder.push(key);
  }
  return v;
}

function _htmlSet(key, value) {
  if (_tc.htmlCache.has(key)) {
    _tc.htmlCache.set(key, value);
    return;
  }
  _tc.htmlCache.set(key, value);
  _tc.htmlOrder.push(key);
  if (_tc.htmlOrder.length > _tc.HTML_MAX) {
    const evict = _tc.htmlOrder.shift();
    _tc.htmlCache.delete(evict);
  }
}

function _findNodeByPath(path) {
  const tree = _tc.tree;
  if (!tree || !path) return null;
  const parts = path.split('/').filter(Boolean);
  let cur = tree;
  for (const p of parts) {
    if (!cur.children) return null;
    cur = cur.children.get(p);
    if (!cur) return null;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Раскрытие пути до активной ноды
// ---------------------------------------------------------------------------

function _expandPathTo(path) {
  if (!path) return;
  const parts = path.split('/').filter(Boolean);
  let acc = '';
  for (const p of parts) {
    acc = acc ? `${acc}/${p}` : p;
    _tc.expanded.add(acc);
  }
}

function _expandPathToFile(fileId) {
  if (!fileId) return;
  const f = state.files[fileId];
  if (!f || !f.path) return;
  _expandPathTo(normalizePath(f.path));
}

function _expandPathToFn(fnId) {
  if (!fnId) return;
  const fn = state.fnById[fnId];
  if (!fn) return;
  const file = state.files[fn.fileId];
  if (!file) return;
  _expandPathTo(normalizePath(file.path));
}

// ---------------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------------

let _uid = 0;
const PAGE_SIZE = 50;

function renderNode(node, depth, ctx) {
  const isRoot = node.path === '';
  const isOpen =
    isRoot ||
    ctx.expandAll ||
    _tc.expanded.has(node.path) ||
    ctx.forceExpand;

  const key = `${node.path}::${isOpen ? 'o' : 'c'}::${depth}`;

  // Кэшируем только файлы и закрытые директории.
  // Открытые директории зависят от _tc.expanded — их нельзя кэшировать.
  const cacheable = node.type === 'file' || !isOpen;

  if (cacheable) {
    const cached = _htmlGet(key);
    if (cached !== null) return cached;
  }

  const html =
    node.type === 'file'
      ? renderFileCached(node, depth, ctx, isOpen)
      : renderDirCached(node, depth, ctx, isOpen);

  if (cacheable) {
    _htmlSet(key, html);
  }
  return html;
}

/**
 * Рендерит HTML со списком функций для файла.
 * Используется и в renderFileCached, и в toggle-dir (ленивая догрузка).
 */
function renderFileFunctions(node, ctx) {
  const fns = node.functions || [];
  if (!fns.length) return '';

  const limit = ctx.pageSize || PAGE_SIZE;
  const shown = fns.slice(0, limit);

  let html = shown
    .map(
      (fn) => `
    <div class="fs-fn"
         data-fs-action="select-fn"
         data-fs-id="${escapeHtml(fn.id)}"
         title="${escapeHtml(fn.name)} — L${fn.line || 0}">
      <span class="fs-fn-icon">ƒ</span>
      <span class="fs-fn-name">${escapeHtml(fn.name)}</span>
      <span class="fs-fn-line">L${fn.line || 0}</span>
    </div>`
    )
    .join('');

  if (fns.length > limit) {
    html += `
      <div class="fs-more"
           data-fs-action="show-more-fns"
           data-fs-file-id="${escapeHtml(node.fileId || '')}"
           data-fs-path="${escapeHtml(node.path)}"
           data-fs-offset="${limit}">
        … ещё ${fns.length - limit}
      </div>`;
  }

  return html;
}

function renderDirCached(node, depth, ctx, isOpen) {
  const id = `fsd-${++_uid}`;
  const label = node.name || '/';

  let childrenHtml = '';
  let moreHtml = '';

  if (isOpen) {
    const allChildren = _tc.bySiblings.get(node.path) || [];
    const limit = ctx.pageSize || PAGE_SIZE;
    const shown = allChildren.slice(0, limit);
    childrenHtml = shown.map((c) => renderNode(c, depth + 1, ctx)).join('');
    if (allChildren.length > limit) {
      moreHtml = `
        <div class="fs-more"
             data-fs-action="show-more"
             data-fs-path="${escapeHtml(node.path)}"
             data-fs-offset="${limit}"
             data-fs-depth="${depth + 1}">
          … ещё ${allChildren.length - limit}
        </div>`;
    }
  }

  return `
    <div class="fs-dir ${isOpen ? 'open' : ''}" data-fs-path="${escapeHtml(
    node.path
  )}">
      <div class="fs-row fs-row-dir"
           data-fs-action="toggle-dir"
           data-fs-path="${escapeHtml(node.path)}"
           data-fs-depth="${depth}"
           title="${escapeHtml(node.path)}">
        <span class="fs-caret">${isOpen ? '▾' : '▸'}</span>
        <span class="fs-icon">📁</span>
        <span class="fs-name">${escapeHtml(label)}</span>
        <span class="fs-count">${node.fileCount}</span>
      </div>
      <div class="fs-children ${isOpen ? 'open' : ''}" id="${id}"
           data-fs-path="${escapeHtml(node.path)}"
           data-fs-depth="${depth}">
        ${childrenHtml}
        ${moreHtml}
      </div>
    </div>`;
}

function renderFileCached(node, depth, ctx, isOpen) {
  const fns = node.functions || [];
  const hasFns = fns.length > 0;

  const fnHtml = isOpen && hasFns ? renderFileFunctions(node, ctx) : '';

  return `
    <div class="fs-file ${isOpen ? 'open' : ''}"
         data-fs-file-id="${escapeHtml(node.fileId || '')}"
         data-fs-path="${escapeHtml(node.path)}">
      <div class="fs-row fs-row-file"
           data-fs-action="${hasFns ? 'toggle-dir' : 'select-file'}"
           data-fs-id="${escapeHtml(node.fileId || '')}"
           data-fs-path="${escapeHtml(node.path)}"
           data-fs-depth="${depth}"
           title="${escapeHtml(node.path)}">
        ${
    hasFns
      ? `<span class="fs-caret">${isOpen ? '▾' : '▸'}</span>`
      : '<span class="fs-caret fs-caret-empty"></span>'
  }
        <span class="fs-icon">📄</span>
        <span class="fs-name">${escapeHtml(node.name)}</span>
        ${hasFns ? `<span class="fs-count">${fns.length}</span>` : ''}
      </div>
      ${
    hasFns
      ? `<div class="fs-children ${isOpen ? 'open' : ''}"
                data-fs-file-id="${escapeHtml(node.fileId || '')}"
                data-fs-path="${escapeHtml(node.path)}"
                data-fs-depth="${depth}">
             ${fnHtml}
           </div>`
      : ''
  }
    </div>`;
}

// ---------------------------------------------------------------------------
// Публичный рендер
// ---------------------------------------------------------------------------

export function renderProjectTree(container, opts = {}) {
  if (!container) return;

  const {
    query = '',
    expandAll = false,
    activeFnId = null,
    activeFileId = null,
    onSelectFile = null,
    onSelectFn = null,
    pageSize = PAGE_SIZE,
  } = opts;

  const tree = buildTreeOnce();

  let filtered;
  if (_tc.lastQuery === query && _tc.lastFiltered) {
    filtered = _tc.lastFiltered;
  } else {
    filtered = filterFsTree(tree, query);
    _tc.lastQuery = query;
    _tc.lastFiltered = filtered;
  }

  if (!filtered || (filtered.type === 'dir' && filtered.children.size === 0)) {
    container.innerHTML = '<div class="empty-msg">Ничего не найдено</div>';
    return;
  }

  _tc.expanded.add('');

  const forceExpand = !!query;
  if (forceExpand) {
    _tc.expanded.clear();
    _tc.expanded.add('');
    const collect = (n) => {
      _tc.expanded.add(n.path);
      if (n.type === 'dir') for (const c of n.children.values()) collect(c);
    };
    collect(filtered);
  }

  if (activeFnId) {
    _expandPathToFn(activeFnId);
  } else if (activeFileId) {
    _expandPathToFile(activeFileId);
  }

  _uid = 0;
  const ctx = { expandAll, forceExpand, pageSize };

  const wrap = container.querySelector('.fs-tree');
  const prevScroll = wrap?.parentElement?.scrollTop ?? container.scrollTop;

  container.innerHTML = `<div class="fs-tree">${renderNode(
    filtered,
    0,
    ctx
  )}</div>`;

  if (prevScroll != null) container.scrollTop = prevScroll;

  if (activeFnId) highlightFn(container, activeFnId);
  else if (activeFileId) highlightFile(container, activeFileId);

  container.onclick = (e) => {
    const t = e.target.closest('[data-fs-action]');
    if (!t || !container.contains(t)) return;

    const action = t.dataset.fsAction;
    const path = t.dataset.fsPath || '';
    const id = t.dataset.fsId || '';

    if (action === 'toggle-dir') {
      const dir = t.closest('.fs-dir, .fs-file');
      if (!dir) return;

      const isFile = dir.classList.contains('fs-file');
      const fileId = dir.dataset.fsFileId;
      const caret =
        dir.querySelector(':scope > .fs-row > .fs-caret') ||
        dir.querySelector(':scope > .fs-row-file > .fs-caret') ||
        dir.querySelector(':scope > .fs-row-dir > .fs-caret');

      const wasOpen = dir.classList.contains('open');

      // ✅ Если это файл и он УЖЕ открыт — выбираем файл (переключаемся)
      if (isFile && wasOpen) {
        if (onSelectFile) onSelectFile(fileId);
        return;
      }

      if (wasOpen) {
        // Закрываем директорию
        dir.classList.remove('open');
        dir.querySelector(':scope > .fs-children')?.classList.remove('open');
        _tc.expanded.delete(path);
        if (caret) caret.textContent = '▸';
        _tc.htmlCache.delete(`${path}::o::${t.dataset.fsDepth || '0'}`);
        return;
      }

      // Открываем (директорию или файл)
      _tc.expanded.add(path);
      dir.classList.add('open');
      if (caret) caret.textContent = '▾';

      const kids = dir.querySelector(':scope > .fs-children');
      if (!kids) return;

      if (!kids.firstElementChild) {
        const node = _findNodeByPath(path);
        if (node) {
          const depth = parseInt(kids.dataset.fsDepth || '0', 10);
          const ctx2 = { expandAll: false, forceExpand: false, pageSize };

          if (node.type === 'file') {
            kids.innerHTML = renderFileFunctions(node, ctx2);
          } else {
            kids.innerHTML = [...node.children.values()]
              .map((c) => renderNode(c, depth + 1, ctx2))
              .join('');
          }
        }
      }

      kids.classList.add('open');
    } else if (action === 'show-more') {
      const offset = parseInt(t.dataset.fsOffset || '0', 10);
      const depth = parseInt(t.dataset.fsDepth || '0', 10);
      const all = _tc.bySiblings.get(path) || [];
      const next = all.slice(offset, offset + PAGE_SIZE);
      const ctx2 = { expandAll: false, forceExpand: false, pageSize };
      const html = next.map((c) => renderNode(c, depth, ctx2)).join('');
      const parent = t.parentElement;
      const frag = document.createElement('div');
      frag.innerHTML = html;
      for (const n of [...frag.children]) parent.insertBefore(n, t);
      const newOffset = offset + PAGE_SIZE;
      if (newOffset >= all.length) t.remove();
      else {
        t.dataset.fsOffset = newOffset;
        t.textContent = `… ещё ${all.length - newOffset}`;
      }
    } else if (action === 'show-more-fns') {
      const fid = t.dataset.fsFileId || '';
      const offset = parseInt(t.dataset.fsOffset || '0', 10);
      const fns = (fid && state.fileFunctions[fid]) || [];
      const next = fns.slice(offset, offset + PAGE_SIZE);
      const html = next
        .map(
          (fn) => `
        <div class="fs-fn"
             data-fs-action="select-fn"
             data-fs-id="${escapeHtml(fn.id)}"
             title="${escapeHtml(fn.name)} — L${fn.line || 0}">
          <span class="fs-fn-icon">ƒ</span>
          <span class="fs-fn-name">${escapeHtml(fn.name)}</span>
          <span class="fs-fn-line">L${fn.line || 0}</span>
        </div>`
        )
        .join('');
      const parent = t.parentElement;
      const frag = document.createElement('div');
      frag.innerHTML = html;
      for (const n of [...frag.children]) parent.insertBefore(n, t);
      const newOffset = offset + PAGE_SIZE;
      if (newOffset >= fns.length) t.remove();
      else {
        t.dataset.fsOffset = newOffset;
        t.textContent = `… ещё ${fns.length - newOffset}`;
      }
    } else if (action === 'select-file' && onSelectFile) {
      onSelectFile(id);
    } else if (action === 'select-fn' && onSelectFn) {
      onSelectFn(id);
    }
  };
}

// ---------------------------------------------------------------------------
// Подсветка + прокрутка
// ---------------------------------------------------------------------------

function _scrollToElement(scroller, el) {
  const elRect = el.getBoundingClientRect();
  const scRect = scroller.getBoundingClientRect();

  const elTop = elRect.top - scRect.top + scroller.scrollTop;
  const elBottom = elTop + el.offsetHeight;

  const viewTop = scroller.scrollTop;
  const viewBottom = viewTop + scroller.clientHeight;
  const padding = 40;

  if (elTop < viewTop + padding) {
    scroller.scrollTop = Math.max(0, elTop - padding);
  } else if (elBottom > viewBottom - padding) {
    scroller.scrollTop = elBottom - scroller.clientHeight + padding;
  }
}

/**
 * Раскрывает всех родителей элемента (только если в них есть дети в DOM).
 * Обновляет caret.
 */
function _openParents(el, container) {
  let p = el.parentElement;
  while (p && p !== container) {
    if (p.classList.contains('fs-children')) {
      if (p.firstElementChild) {
        p.classList.add('open');
        const wrap = p.closest('.fs-dir, .fs-file');
        if (wrap) {
          wrap.classList.add('open');
          const caret =
            wrap.querySelector(':scope > .fs-row > .fs-caret') ||
            wrap.querySelector(':scope > .fs-row-file > .fs-caret') ||
            wrap.querySelector(':scope > .fs-row-dir > .fs-caret');
          if (caret) caret.textContent = '▾';
        }
      }
    }
    p = p.parentElement;
  }
}

function highlightFn(container, fnId) {
  container
    .querySelectorAll('.fs-fn.active')
    .forEach((el) => el.classList.remove('active'));

  const el = container.querySelector(
    `.fs-fn[data-fs-id="${cssEscape(fnId)}"]`
  );
  if (!el) {
    console.warn('[Tree] highlightFn: не найден в DOM:', fnId);
    return;
  }

  el.classList.add('active');
  _openParents(el, container);
  _scrollToElement(container, el);
}

function highlightFile(container, fileId) {
  container
    .querySelectorAll('.fs-file.active')
    .forEach((el) => el.classList.remove('active'));

  const el = container.querySelector(
    `.fs-file[data-fs-file-id="${cssEscape(fileId)}"]`
  );
  if (!el) {
    console.warn('[Tree] highlightFile: не найден в DOM:', fileId);
    return;
  }

  el.classList.add('active');
  _openParents(el, container);
  _scrollToElement(container, el);
}

function cssEscape(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(String(s));
  }
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
}

// ---------------------------------------------------------------------------
// Expand / Collapse
// ---------------------------------------------------------------------------

export function expandAll(container) {
  if (!container) return;
  renderProjectTree(container, { expandAll: true });
}

export function collapseAll(container) {
  if (!container) return;
  _tc.expanded.clear();
  _tc.expanded.add('');
  renderProjectTree(container, { expandAll: false });
}

export function getTreeStats(root) {
  let dirs = 0;
  let files = 0;
  let maxDepth = 0;

  const walk = (node, depth) => {
    if (depth > maxDepth) maxDepth = depth;
    if (node.type === 'dir') {
      dirs++;
      for (const [, child] of node.children) walk(child, depth + 1);
    } else files++;
  };

  walk(root, 0);
  return { dirs, files, maxDepth };
}

// ---------------------------------------------------------------------------
// Стили
// ---------------------------------------------------------------------------

export const TREE_STYLES = `
.fs-tree {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  user-select: none;
  padding: 2px 0;
}
.fs-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  color: var(--text2, #8b949e);
  line-height: 1.6;
  white-space: nowrap;
  overflow: hidden;
}
.fs-row:hover {
  background: var(--bg3, #21262d);
  color: var(--text, #e6edf3);
}
.fs-row-dir { font-weight: 600; }
.fs-row-file { color: var(--text2, #8b949e); }

.fs-caret {
  width: 10px;
  display: inline-block;
  font-size: 8px;
  color: var(--text2, #8b949e);
  transition: transform 0.15s;
  flex-shrink: 0;
  text-align: center;
}
.fs-caret-empty { visibility: hidden; }

.fs-icon { font-size: 11px; flex-shrink: 0; }

.fs-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fs-count {
  font-size: 9px;
  color: var(--text2, #8b949e);
  opacity: 0.6;
  flex-shrink: 0;
  padding-left: 4px;
}

.fs-children {
  display: none;
  padding-left: 14px;
  border-left: 1px dashed var(--border, #30363d);
  margin-left: 5px;
}
.fs-children.open { display: block; }

.fs-fn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  color: var(--text2, #8b949e);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
}
.fs-fn:hover {
  background: var(--bg3, #21262d);
  color: var(--text, #e6edf3);
}
.fs-fn.active {
  background: rgba(63, 185, 80, 0.12);
  color: var(--green, #3fb950);
  font-weight: 700;
}
.fs-fn-icon { color: var(--purple, #bc8cff); flex-shrink: 0; }
.fs-fn-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-fn-line { font-size: 8px; color: var(--text2, #8b949e); opacity: 0.6; flex-shrink: 0; }

.fs-file.active > .fs-row-file {
  background: rgba(88, 166, 255, 0.1);
  color: var(--accent, #58a6ff);
}
.fs-file.active > .fs-row-file .fs-name { font-weight: 600; }

.fs-more {
  padding: 3px 8px;
  font-size: 10px;
  color: var(--text2, #8b949e);
  cursor: pointer;
  border-radius: 3px;
  font-style: italic;
  user-select: none;
}
.fs-more:hover {
  background: var(--bg3, #21262d);
  color: var(--accent, #58a6ff);
}
`;

// ---------------------------------------------------------------------------
// Fallback: плоский рендер
// ---------------------------------------------------------------------------

export function renderFlatTree(container, opts = {}) {
  if (!container) return;
  const { onSelectFn = null, onSelectFile = null } = opts;

  const h = [];
  for (const m of Object.values(state.modules)) {
    const fs = state.moduleFiles[m.id] || [];
    h.push(`<div class="tm">
      <div class="tm-h" data-action="toggle-tm">
        <span class="a">▶</span>📦${escapeHtml(m.name)}
        <span style="color:var(--text2);font-size:9px;margin-left:auto">${
      fs.length
    }</span>
      </div>
      <div class="tf-l">`);
    for (const fid of fs) {
      const f = state.files[fid];
      if (!f) continue;
      const fns = state.fileFunctions[fid] || [];
      if (fns.length > 0) {
        h.push(`<div class="tf" data-action="toggle-tf">
          <span class="a">▶</span>📄${escapeHtml(f.name || baseName(f.path))}
          <span style="font-size:9px;color:var(--text2)">(${fns.length})</span>
        </div>
        <div class="fn-l">`);
        for (const fn of fns.slice().sort((a, b) => (a.line || 0) - (b.line || 0))) {
          h.push(`<div class="fn" data-fn-id="${fn.id}">
            ƒ ${escapeHtml(fn.name)}
            <span style="font-size:8px;color:var(--text2)">L${
            fn.line || 0
          }</span>
          </div>`);
        }
        h.push(`</div>`);
      } else {
        h.push(
          `<div class="tf" data-file-id="${fid}">📄${escapeHtml(
            baseName(f.path)
          )}</div>`
        );
      }
    }
    h.push(`</div></div>`);
  }
  container.innerHTML = h.join('');

  container.onclick = (e) => {
    const t = e.target.closest('[data-action], .fn, .tf');
    if (!t) return;
    const action = t.dataset.action;
    if (action === 'toggle-tm' || action === 'toggle-tf') {
      const caret = t.querySelector('.a');
      const next = t.nextElementSibling;
      if (caret) caret.classList.toggle('o');
      if (next) next.classList.toggle('o');
      return;
    }
    if (t.classList.contains('fn') && onSelectFn) {
      onSelectFn(t.dataset.fnId);
    } else if (t.classList.contains('tf') && t.dataset.fileId && onSelectFile) {
      onSelectFile(t.dataset.fileId);
    }
  };
}
