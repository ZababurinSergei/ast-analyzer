// ============================================================================
// AST ANALYZER — UI COMPONENTS v9
// Переиспользуемые UI-компоненты: карточки, таблицы, дерево, тосты.
// ============================================================================

import {
  state, escapeHtml, shortPath, formatNumber, formatType,
  getModuleName, getFilePath, getFnFullInfo, getImportedNames,
} from './ast-analyzer-core.js';

// ---------------------------------------------------------------------------
// ТОСТ
// ---------------------------------------------------------------------------
let toastEl = null;
let toastTimer = null;

export function toast(msg, type = '') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2500);
}

// ---------------------------------------------------------------------------
// ОБЩИЕ ХЕЛПЕРЫ
// ---------------------------------------------------------------------------
export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      e.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null && v !== false) {
      e.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

export function chip(text, cls = '') {
  return `<span class="chip ${cls}">${escapeHtml(text)}</span>`;
}

export function typeTag(type, label = null) {
  return `<span class="type-tag tag-${type}">${escapeHtml(label || type)}</span>`;
}

// ---------------------------------------------------------------------------
// СТАТИСТИКА
// ---------------------------------------------------------------------------
export function renderStatsGrid(stats) {
  const cards = [
    { n: stats.totalModules, l: 'Модулей', c: '' },
    { n: stats.totalFiles, l: 'Файлов', c: 'blue' },
    { n: stats.totalFunctions, l: 'Функций', c: 'purple' },
    { n: stats.totalConstants, l: 'Констант', c: 'yellow' },
    { n: stats.totalCalls, l: 'Вызовов', c: 'orange' },
    { n: stats.totalImports, l: 'Импортов', c: 'green' },
    { n: stats.totalExports, l: 'Экспортов', c: 'yellow' },
    { n: stats.totalReExports, l: 'Реэкспортов', c: 'purple' },
    { n: stats.deadExports, l: 'Мёртвых экспортов', c: 'red' },
    { n: stats.deadFunctions, l: 'Мёртвых функций', c: 'red' },
    { n: stats.cyclicDeps, l: 'Циклов', c: 'red' },
    { n: stats.externalPackages?.length || 0, l: 'Внешних пакетов', c: 'blue' },
  ];
  return `<div class="stat-grid">${cards.map(c =>
    `<div class="stat-card ${c.c}">
       <div class="num">${formatNumber(c.n)}</div>
       <div class="lbl">${c.l}</div>
     </div>`
  ).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// КАРТОЧКА ФУНКЦИИ
// ---------------------------------------------------------------------------
export function renderFnCard(fn, { compact = false, active = false, showCaret = true } = {}) {
  const info = getFnFullInfo(fn.id);
  const exported = info.exports.length > 0;
  const importersCount = info.imports.length;
  const callersCount = info.callers.length;
  const callsCount = info.calls.length;

  const kw = [];
  if (fn.isAsync) kw.push('async');
  if (fn.isArrow) kw.push('arrow');
  if (fn.isMethod) kw.push('method');

  const params = (fn.params || []).join(', ');
  const file = state.files[fn.fileId];
  const mod = file ? state.modules[file.moduleId] : null;

  return `
    <div class="fn-card ${active ? 'active' : ''}" id="fn-card-${fn.id}" data-fn-id="${fn.id}">
      <div class="fn-card-header" data-action="set-active" data-type="fn" data-id="${fn.id}">
        ${showCaret ? `<span class="caret" data-action="toggle-card" data-id="${fn.id}">▶</span>` : ''}
        <span class="fn-name">
          ${kw.length ? `<span class="kw">${kw.join(' ')} </span>` : ''}
          <span class="fn-real">${escapeHtml(fn.name)}</span><span class="dim">(</span><span class="params">${escapeHtml(params)}</span><span class="dim">)</span>
        </span>
        <span class="fn-meta">
          ${exported ? chip('📤', 'yellow') : ''}
          ${importersCount > 0 ? chip('📥 ' + importersCount, 'blue') : ''}
          ${callersCount > 0 ? chip('📞 ' + callersCount, 'purple') : ''}
          ${callsCount > 0 ? chip('→ ' + callsCount, '') : ''}
          <span class="chip" style="font-size:10px;">L${fn.line}</span>
        </span>
      </div>
      <div class="fn-card-body collapsed" id="fn-body-${fn.id}">
        <div class="fn-signature">
          ${kw.length ? `<span class="kw">${kw.join(' ')}</span> ` : ''}<span class="fn">${escapeHtml(fn.name)}</span><span class="dim">(</span>${(fn.params || []).map(p => `<span class="params">${escapeHtml(p)}</span>`).join('<span class="dim">, </span>')}<span class="dim">)</span>${fn.returnType ? `<span class="dim">: </span><span class="t">${escapeHtml(formatType(fn.returnType))}</span>` : ''}
          <div class="dim" style="margin-top:6px; font-size:11px;">📍 ${escapeHtml(file?.path || '?')}:${fn.line} · 📦 ${escapeHtml(mod?.name || '?')}</div>
        </div>

        ${renderFnSection('📤 Экспортируется как', info.exports, e =>
    `<div class="row static">
             <span class="name yellow">${escapeHtml(e.exportName || '?')}</span>
             ${typeTag(e.type || 'named')}
             <span class="line-ref">L${e.line}</span>
           </div>`
  )}

        ${renderFnSection('📥 Импортируется в', info.imports, i =>
    `<div class="row" data-action="select-file" data-id="${i.toFileId}">
             <span class="name" style="font-size:11px;">${escapeHtml(shortPath(i.toFilePath, 32))}</span>
             <span class="line-ref">L${i.line}</span>
           </div>`, 5
  )}

        ${renderFnSection('📞 Кто вызывает', info.callers, c =>
    `<div class="row" data-action="jump-fn" data-id="${c.fromFnId}">
             <span class="name purple" style="font-size:11px;">${escapeHtml(c.fromFnName)}</span>
             <span class="line-ref">L${c.callLine}</span>
           </div>`, 5
  )}

        ${renderFnSection('→ Вызывает', info.calls, c =>
    `<div class="row" ${!c.isExternal ? `data-action="jump-fn" data-id="${c.toFnId}"` : ''}>
             <span class="name ${c.isExternal ? 'red' : 'blue'}" style="font-size:11px;">
               ${c.isExternal ? '🌐 ' : ''}${escapeHtml(c.toFnName)}
             </span>
             <span class="line-ref">L${c.callLine}</span>
           </div>`, 5
  )}
      </div>
    </div>
  `;
}

function renderFnSection(title, items, rowFn, limit = Infinity) {
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  return `
    <div class="fn-section">
      <h5>${title} <span class="count">${items.length}</span></h5>
      ${items.length === 0
    ? '<div class="empty-msg" style="padding:8px;">Нет</div>'
    : shown.map(rowFn).join('') + (rest > 0 ? `<div class="more">…+${rest}</div>` : '')
  }
    </div>
  `;
}

// ---------------------------------------------------------------------------
// КАРТОЧКА КОНСТАНТЫ
// ---------------------------------------------------------------------------
export function renderConstCard(c) {
  let valueStr = '';
  if (c.value !== undefined) {
    valueStr = typeof c.value === 'object' ? JSON.stringify(c.value, null, 2) : String(c.value);
  } else {
    valueStr = '(не извлечено)';
  }
  const truncated = valueStr.length > 600 ? valueStr.slice(0, 600) + '…' : valueStr;
  return `
    <div class="panel" style="margin-bottom:8px;" id="const-card-${c.id}">
      <div class="panel-header" style="text-transform:none;">
        <span class="mono green-bold">📌 ${escapeHtml(c.name)}</span>
        <span style="display:flex; gap:6px;">
          ${c.isExported ? typeTag('export') : ''}
          <span class="chip">L${c.line}</span>
          <span class="chip">${escapeHtml(getModuleName(c.moduleId))}</span>
        </span>
      </div>
      <div class="panel-body" style="padding:10px 14px;">
        <pre class="code-preview">${escapeHtml(truncated)}</pre>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// КАРТОЧКА МОДУЛЯ
// ---------------------------------------------------------------------------
export function renderModuleCard(m, stats) {
  return `
    <div class="panel" style="margin-bottom:10px;">
      <div class="panel-header" style="text-transform:none;">
        <span class="mono blue-bold">📦 ${escapeHtml(m.name)}</span>
        <span style="display:flex; gap:6px;">
          ${chip(stats.fileCount + ' файлов')}
          ${chip(stats.fnCount + ' ƒ', 'purple')}
          ${chip(stats.exportCount + ' эксп.', 'yellow')}
        </span>
      </div>
      <div class="panel-body">
        <div class="dim" style="font-size:11px; font-family:monospace;">${escapeHtml(m.path || '')}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// ТАБЛИЦА
// ---------------------------------------------------------------------------
export function renderTable(rows, columns, { sortable = true, emptyMsg = 'Нет данных' } = {}) {
  if (!rows.length) return `<div class="empty-msg">${escapeHtml(emptyMsg)}</div>`;
  const thead = columns.map(c => `<th data-key="${c.key}">${escapeHtml(c.label)}</th>`).join('');
  const tbody = rows.map((r, i) => `
    <tr data-idx="${i}">
      ${columns.map(c => `<td>${c.render ? c.render(r) : escapeHtml(r[c.key] ?? '')}</td>`).join('')}
    </tr>
  `).join('');
  return `
    <table class="data-table" data-sortable="${sortable}">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// ДЕРЕВО
// ---------------------------------------------------------------------------
export function renderTree(nodes, opts = {}) {
  const { expandable = true, selectable = true } = opts;
  function renderNode(node, depth = 0) {
    const hasChildren = node.children && node.children.length > 0;
    return `
      <div class="tree-node" data-id="${node.id}" data-type="${node.type || ''}" style="padding-left:${depth * 14}px;">
        ${hasChildren && expandable
      ? `<span class="caret" data-action="toggle-tree">▶</span>`
      : `<span class="caret-placeholder"></span>`}
        <span class="tree-icon">${node.icon || '·'}</span>
        <span class="tree-label ${selectable ? 'clickable' : ''}">${escapeHtml(node.label)}</span>
        ${node.meta ? `<span class="tree-meta">${escapeHtml(node.meta)}</span>` : ''}
      </div>
      ${hasChildren ? `<div class="tree-children collapsed">${node.children.map(c => renderNode(c, depth + 1)).join('')}</div>` : ''}
    `;
  }
  return `<div class="tree">${nodes.map(n => renderNode(n)).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// ХЛЕБНЫЕ КРОШКИ
// ---------------------------------------------------------------------------
export function renderBreadcrumbs(items) {
  return `<div class="breadcrumbs">${items.map((it, i) => {
    const sep = i < items.length - 1 ? '<span class="bc-sep">→</span>' : '';
    const cls = it.active ? 'bc-item active' : 'bc-item';
    const action = it.action ? `data-action="${it.action}" data-id="${it.id || ''}"` : '';
    return `<span class="${cls}" ${action}>${it.icon ? it.icon + ' ' : ''}${escapeHtml(it.label)}</span>${sep}`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ (аккордеон)
// ---------------------------------------------------------------------------
export function renderSection(title, count, bodyHtml, { open = true, icon = '' } = {}) {
  return `
    <div class="anp-section">
      <div class="anp-section-header" data-action="toggle-section">
        <span>${icon} ${escapeHtml(title)}</span>
        <span class="cnt">${count}</span>
      </div>
      <div class="anp-section-body ${open ? '' : 'collapsed'}">${bodyHtml}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// СТРОКИ
// ---------------------------------------------------------------------------
export function renderLinkRow({ icon, name, nameClass = '', meta, tag, tagClass = '', line, action, id, title }) {
  const attrs = [
    action ? `data-action="${action}"` : '',
    id ? `data-id="${id}"` : '',
    title ? `title="${escapeHtml(title)}"` : '',
  ].filter(Boolean).join(' ');
  return `
    <div class="anp-link" ${attrs}>
      ${icon ? `<span class="link-icon">${icon}</span>` : ''}
      <span class="link-name ${nameClass}">${escapeHtml(name)}</span>
      ${meta ? `<span class="link-meta">${escapeHtml(meta)}</span>` : ''}
      ${tag ? `<span class="link-tag ${tagClass}">${escapeHtml(tag)}</span>` : ''}
      ${line != null ? `<span class="link-line">L${line}</span>` : ''}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// ПУСТОЕ СОСТОЯНИЕ
// ---------------------------------------------------------------------------
export function renderEmpty(icon, text, hint = '') {
  return `
    <div class="anp-empty">
      <div class="icon">${icon}</div>
      <p>${text}</p>
      ${hint ? `<p class="dim" style="margin-top:8px; font-size:11px;">${hint}</p>` : ''}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// СПИСОК ФАЙЛОВ (для сайдбара)
// ---------------------------------------------------------------------------
export function renderFileList(filter = {}) {
  const { query = '', depsOnly = false, selectedId = null } = filter;
  const q = query.toLowerCase();
  const items = [];
  for (const [id, f] of Object.entries(state.files)) {
    if (q && !f.path.toLowerCase().includes(q)) continue;
    const deps = state.fileDependents[id]?.length || 0;
    const imps = state.fileImports[id]?.length || 0;
    if (depsOnly && !(deps > 0 || imps > 0)) continue;
    items.push({ id, f, deps, imps });
  }
  if (!items.length) return `<div class="empty-msg">Ничего не найдено</div>`;
  return items.map(({ id, f, deps, imps }) => {
    const modName = getModuleName(f.moduleId);
    const active = id === selectedId ? ' active' : '';
    return `<div class="file-item${active}" data-action="select-file" data-id="${id}" title="${escapeHtml(f.path)}">
      <span class="file-path">${escapeHtml(f.path)}</span>
      <span class="mod-badge">${escapeHtml(modName)}</span>
    </div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// ХЕЛПЕР: цвет по числу
// ---------------------------------------------------------------------------
export function heatColor(v, max) {
  if (!max) return 'transparent';
  const t = Math.min(1, v / max);
  const r = Math.round(63 + (248 - 63) * t);
  const g = Math.round(185 + (81 - 185) * t);
  const b = Math.round(80 + (73 - 80) * t);
  return `rgba(${r},${g},${b},${0.15 + t * 0.5})`;
}
