// ============================================================================
// AST ANALYZER — TREE v1.0
// Модуль дерева проекта: строит иерархию каталогов из плоского списка файлов
// и рендерит интерактивное дерево с фильтрацией по функциям.
//
// Публичный API:
//   normalizePath(p)                → string
//   buildFsTree(files)              → корневой узел дерева
//   attachFunctions(root)           → root (лениво подтягивает функции)
//   filterFsTree(root, query)       → отфильтрованное дерево | null
//   renderProjectTree(container, opts)
//   renderFlatTree(container, opts) — старый плоский рендер (fallback)
//   TREE_STYLES                     — строка CSS для дерева
//
// Особенности:
//   - Работает с путями 'src\\components\\ui\\...' и 'src/components/ui/...'
//   - Автоматически сортирует: сначала каталоги, потом файлы (по алфавиту)
//   - Лениво подтягивает функции файла из state.fileFunctions
//   - Поддерживает поиск: оставляет только ветки, содержащие совпадения
//   - Подсвечивает активную функцию + авто-раскрывает путь до неё
//   - Не требует пересборки дерева при смене query — фильтрует на лету
//   - Делегирование событий через один onclick на контейнере
// ============================================================================

import { state, escapeHtml, shortPath } from './ast-analyzer-core.js';

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

const PATH_SEP_RE = /[\\/]+/;

/**
 * Нормализует путь: заменяет '\' на '/', убирает ведущие './' и '/'.
 * @param {string} p
 * @returns {string}
 */
export function normalizePath(p) {
  if (!p) return '';
  return String(p).replace(/\\/g, '/').replace(/^\.?\//, '');
}

/**
 * Возвращает имя файла без пути.
 */
function baseName(p) {
  if (!p) return '';
  const norm = normalizePath(p);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? norm : norm.slice(idx + 1);
}

/**
 * Возвращает директорию (без имени файла).
 */
function dirName(p) {
  if (!p) return '';
  const norm = normalizePath(p);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '' : norm.slice(0, idx);
}

// ---------------------------------------------------------------------------
// Построение дерева
// ---------------------------------------------------------------------------

/**
 * Узел дерева:
 *   {
 *     name: string,          // имя каталога/файла
 *     path: string,          // полный путь от корня
 *     type: 'dir' | 'file',
 *     children: Map,         // Map<name, Node>
 *     fileCount: number,     // для dir: суммарное кол-во файлов внутри
 *     fileId?: string,       // для file
 *     moduleId?: string,     // для file
 *     functions?: Array,     // для file, заполняется attachFunctions
 *   }
 */

/**
 * Строит иерархию каталогов из массива файлов.
 *
 * @param {Array<{id:string, path:string, moduleId?:string}>} files
 * @returns {object} корневой узел (type='dir', name='', path='')
 */
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

/**
 * Рекурсивно сортирует дерево: каталоги → файлы, внутри — по алфавиту.
 * Пересчитывает fileCount.
 */
function sortTree(node) {
  if (node.type !== 'dir') return;

  const entries = [...node.children.entries()];
  entries.sort((a, b) => {
    const A = a[1], B = b[1];
    if (A.type !== B.type) return A.type === 'dir' ? -1 : 1;
    return A.name.localeCompare(B.name, 'ru');
  });
  node.children = new Map(entries);

  let count = 0;
  for (const [, child] of node.children) {
    if (child.type === 'file') {
      count++;
    } else {
      sortTree(child);
      count += child.fileCount;
    }
  }
  node.fileCount = count;
}

// ---------------------------------------------------------------------------
// Обогащение функциями
// ---------------------------------------------------------------------------

/**
 * Лениво подтягивает функции файла из state (нужно для поиска по функциям).
 * Мутирует узлы: node.functions = [...fn].
 *
 * @param {object} root
 * @returns {object} root
 */
export function attachFunctions(root) {
  const walk = node => {
    if (node.type === 'file') {
      node.functions = state.fileFunctions?.[node.fileId] || [];
      return;
    }
    for (const [, child] of node.children) walk(child);
  };
  walk(root);
  return root;
}

// ---------------------------------------------------------------------------
// Фильтрация
// ---------------------------------------------------------------------------

/**
 * Возвращает копию дерева, оставляя только ветки, содержащие совпадения
 * по имени файла/каталога или по имени функции внутри файла.
 *
 * @param {object} root
 * @param {string} query
 * @returns {object|null} null, если ничего не найдено
 */
export function filterFsTree(root, query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return root;

  const walk = node => {
    if (node.type === 'file') {
      const nameMatch = node.name.toLowerCase().includes(q);
      const fnMatch = (node.functions || []).some(fn =>
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

/**
 * Возвращает массив путей (path) всех каталогов/файлов, содержащихся в дереве.
 * Полезно для "expandAll" и подсветки.
 */
export function collectPaths(node, out = []) {
  out.push(node.path);
  if (node.type === 'dir') {
    for (const [, child] of node.children) collectPaths(child, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------------

let _uid = 0;

/**
 * Рендерит дерево проекта в контейнер.
 *
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {string}   [opts.query]           — строка поиска
 * @param {boolean}  [opts.expandAll]       — раскрыть все узлы
 * @param {string}   [opts.activeFnId]      — id активной функции (подсветка)
 * @param {string}   [opts.activeFileId]    — id активного файла (подсветка)
 * @param {Function} [opts.onSelectFile]    — (fileId) => void
 * @param {Function} [opts.onSelectFn]      — (fnId)   => void
 */
export function renderProjectTree(container, opts = {}) {
  if (!container) return;

  const {
    query = '',
    expandAll = false,
    activeFnId = null,
    activeFileId = null,
    onSelectFile = null,
    onSelectFn = null,
  } = opts;

  // 1. Построить дерево
  const tree = buildFsTree(Object.values(state.files || {}));
  attachFunctions(tree);

  // 2. Отфильтровать
  const filtered = filterFsTree(tree, query);
  if (!filtered || (filtered.type === 'dir' && filtered.children.size === 0)) {
    container.innerHTML = '<div class="empty-msg">Ничего не найдено</div>';
    return;
  }

  // 3. Отрендерить
  _uid = 0;
  const ctx = {
    expandAll: !!expandAll,
    forceExpand: !!query, // при поиске раскрываем всё, что нашли
  };
  const html = renderNode(filtered, 0, ctx);
  container.innerHTML = `<div class="fs-tree">${html}</div>`;

  // 4. Подсветка активного
  if (activeFnId) {
    highlightFn(container, activeFnId);
  } else if (activeFileId) {
    highlightFile(container, activeFileId);
  }

  // 5. Делегирование событий
  container.onclick = e => {
    const t = e.target.closest('[data-fs-action]');
    if (!t || !container.contains(t)) return;

    const action = t.dataset.fsAction;
    const id = t.dataset.fsId || '';

    if (action === 'toggle-dir') {
      const dir = t.closest('.fs-dir, .fs-file');
      if (!dir) return;
      dir.classList.toggle('open');
      const kids = dir.querySelector(':scope > .fs-children');
      if (kids) kids.classList.toggle('open');
    } else if (action === 'select-file' && onSelectFile) {
      onSelectFile(id);
    } else if (action === 'select-fn' && onSelectFn) {
      onSelectFn(id);
    }
  };
}

/**
 * Рекурсивный рендер узла.
 */
function renderNode(node, depth, ctx) {
  return node.type === 'file'
    ? renderFile(node, depth, ctx)
    : renderDir(node, depth, ctx);
}

function renderDir(node, depth, ctx) {
  const id = `fsd-${++_uid}`;
  const open = ctx.expandAll || ctx.forceExpand;
  const label = node.name || '/';

  const childrenHtml = [...node.children.values()]
    .map(c => renderNode(c, depth + 1, ctx))
    .join('');

  return `
    <div class="fs-dir ${open ? 'open' : ''}" data-fs-path="${escapeHtml(node.path)}">
      <div class="fs-row fs-row-dir"
           data-fs-action="toggle-dir"
           data-fs-path="${escapeHtml(node.path)}"
           title="${escapeHtml(node.path)}">
        <span class="fs-caret">${open ? '▾' : '▸'}</span>
        <span class="fs-icon">📁</span>
        <span class="fs-name">${escapeHtml(label)}</span>
        <span class="fs-count">${node.fileCount}</span>
      </div>
      <div class="fs-children ${open ? 'open' : ''}" id="${id}">
        ${childrenHtml}
      </div>
    </div>
  `;
}

function renderFile(node, depth, ctx) {
  const fns = node.functions || [];
  const hasFns = fns.length > 0;
  const open = ctx.expandAll || (ctx.forceExpand && hasFns);

  const fnHtml = hasFns
    ? fns
      .slice()
      .sort((a, b) => (a.line || 0) - (b.line || 0))
      .map(fn => `
        <div class="fs-fn"
             data-fs-action="select-fn"
             data-fs-id="${escapeHtml(fn.id)}"
             title="${escapeHtml(fn.name)} — L${fn.line || 0}">
          <span class="fs-fn-icon">ƒ</span>
          <span class="fs-fn-name">${escapeHtml(fn.name)}</span>
          <span class="fs-fn-line">L${fn.line || 0}</span>
        </div>
      `).join('')
    : '';

  return `
    <div class="fs-file ${open ? 'open' : ''}"
         data-fs-file-id="${escapeHtml(node.fileId || '')}">
      <div class="fs-row fs-row-file"
           data-fs-action="${hasFns ? 'toggle-dir' : 'select-file'}"
           data-fs-id="${escapeHtml(node.fileId || '')}"
           data-fs-path="${escapeHtml(node.path)}"
           title="${escapeHtml(node.path)}">
        ${hasFns
    ? `<span class="fs-caret">${open ? '▾' : '▸'}</span>`
    : '<span class="fs-caret fs-caret-empty"></span>'}
        <span class="fs-icon">📄</span>
        <span class="fs-name">${escapeHtml(node.name)}</span>
        ${hasFns ? `<span class="fs-count">${fns.length}</span>` : ''}
      </div>
      ${hasFns
    ? `<div class="fs-children ${open ? 'open' : ''}">${fnHtml}</div>`
    : ''}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Подсветка
// ---------------------------------------------------------------------------

/**
 * Подсвечивает функцию и раскрывает путь до неё.
 */
function highlightFn(container, fnId) {
  container.querySelectorAll('.fs-fn.active').forEach(el => el.classList.remove('active'));
  const el = container.querySelector(`.fs-fn[data-fs-id="${cssEscape(fnId)}"]`);
  if (!el) return;

  el.classList.add('active');

  // Раскрыть всех родителей
  let p = el.parentElement;
  while (p && p !== container) {
    if (p.classList.contains('fs-children')) {
      p.classList.add('open');
      const wrap = p.closest('.fs-dir, .fs-file');
      if (wrap) wrap.classList.add('open');
    }
    p = p.parentElement;
  }

  el.scrollIntoView({ block: 'nearest' });
}

/**
 * Подсвечивает файл.
 */
function highlightFile(container, fileId) {
  container.querySelectorAll('.fs-file.active').forEach(el => el.classList.remove('active'));
  const el = container.querySelector(
    `.fs-file[data-fs-file-id="${cssEscape(fileId)}"]`
  );
  if (!el) return;

  el.classList.add('active');

  // Раскрыть всех родителей
  let p = el.parentElement;
  while (p && p !== container) {
    if (p.classList.contains('fs-children')) {
      p.classList.add('open');
      const wrap = p.closest('.fs-dir, .fs-file');
      if (wrap) wrap.classList.add('open');
    }
    p = p.parentElement;
  }

  el.scrollIntoView({ block: 'nearest' });
}

/**
 * Простое экранирование для использования в селекторах CSS.escape.
 * Используем встроенный, если доступен.
 */
function cssEscape(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(String(s));
  }
  // Fallback: экранируем спецсимволы
  return String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
}

// ---------------------------------------------------------------------------
// Разворачивание/сворачивание всех
// ---------------------------------------------------------------------------

/**
 * Раскрывает все узлы дерева в контейнере.
 */
export function expandAll(container) {
  if (!container) return;
  container.querySelectorAll('.fs-children').forEach(el => el.classList.add('open'));
  container.querySelectorAll('.fs-dir, .fs-file').forEach(el => el.classList.add('open'));
  container.querySelectorAll('.fs-caret').forEach(el => {
    if (!el.classList.contains('fs-caret-empty')) el.textContent = '▾';
  });
}

/**
 * Сворачивает все узлы дерева в контейнере.
 */
export function collapseAll(container) {
  if (!container) return;
  container.querySelectorAll('.fs-children').forEach(el => el.classList.remove('open'));
  container.querySelectorAll('.fs-dir, .fs-file').forEach(el => el.classList.remove('open'));
  container.querySelectorAll('.fs-caret').forEach(el => {
    if (!el.classList.contains('fs-caret-empty')) el.textContent = '▸';
  });
}

// ---------------------------------------------------------------------------
// Статистика дерева
// ---------------------------------------------------------------------------

/**
 * Возвращает статистику по дереву: число каталогов, файлов, макс. глубина.
 */
export function getTreeStats(root) {
  let dirs = 0, files = 0, maxDepth = 0;

  const walk = (node, depth) => {
    if (depth > maxDepth) maxDepth = depth;
    if (node.type === 'dir') {
      dirs++;
      for (const [, child] of node.children) walk(child, depth + 1);
    } else {
      files++;
    }
  };

  walk(root, 0);
  return { dirs, files, maxDepth };
}

// ---------------------------------------------------------------------------
// Стили (TREE_STYLES)
// ---------------------------------------------------------------------------

export const TREE_STYLES = `
.fs-tree {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  user-select: none;
  padding: 2px 0;
}

/* --- Строки --- */
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
.fs-row-dir {
  font-weight: 600;
}
.fs-row-file {
  color: var(--text2, #8b949e);
}

/* --- Картка --- */
.fs-caret {
  width: 10px;
  display: inline-block;
  font-size: 8px;
  color: var(--text2, #8b949e);
  transition: transform 0.15s;
  flex-shrink: 0;
  text-align: center;
}
.fs-caret-empty {
  visibility: hidden;
}

/* --- Иконки --- */
.fs-icon {
  font-size: 11px;
  flex-shrink: 0;
}

/* --- Имена --- */
.fs-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Счётчики --- */
.fs-count {
  font-size: 9px;
  color: var(--text2, #8b949e);
  opacity: 0.6;
  flex-shrink: 0;
  padding-left: 4px;
}

/* --- Дочерние контейнеры --- */
.fs-children {
  display: none;
  padding-left: 14px;
  border-left: 1px dashed var(--border, #30363d);
  margin-left: 5px;
}
.fs-children.open {
  display: block;
}

/* --- Функции --- */
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
.fs-fn-icon {
  color: var(--purple, #bc8cff);
  flex-shrink: 0;
}
.fs-fn-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fs-fn-line {
  font-size: 8px;
  color: var(--text2, #8b949e);
  opacity: 0.6;
  flex-shrink: 0;
}

/* --- Активный файл --- */
.fs-file.active > .fs-row-file {
  background: rgba(88, 166, 255, 0.1);
  color: var(--accent, #58a6ff);
}
.fs-file.active > .fs-row-file .fs-name {
  font-weight: 600;
}
`;

// ---------------------------------------------------------------------------
// Fallback: плоский рендер (сохранён для совместимости)
// ---------------------------------------------------------------------------

/**
 * Старый "плоский" рендер (модули → файлы → функции).
 * Оставлен для отладки и обратной совместимости.
 *
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {Function} opts.onSelectFn
 * @param {Function} opts.onSelectFile
 */
export function renderFlatTree(container, opts = {}) {
  if (!container) return;
  const { onSelectFn = null, onSelectFile = null } = opts;

  const h = [];
  for (const m of Object.values(state.modules)) {
    const fs = state.moduleFiles[m.id] || [];
    h.push(`<div class="tm">
      <div class="tm-h" data-action="toggle-tm">
        <span class="a">▶</span>📦${escapeHtml(m.name)}
        <span style="color:var(--text2);font-size:9px;margin-left:auto">${fs.length}</span>
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
            <span style="font-size:8px;color:var(--text2)">L${fn.line || 0}</span>
          </div>`);
        }
        h.push(`</div>`);
      } else {
        h.push(`<div class="tf" data-file-id="${fid}">📄${escapeHtml(baseName(f.path))}</div>`);
      }
    }
    h.push(`</div></div>`);
  }
  container.innerHTML = h.join('');

  container.onclick = e => {
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