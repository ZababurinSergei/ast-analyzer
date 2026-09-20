// ============================================================================
// AST ANALYZER — NAV v1.5
// Плавающая мини-навигация по секциям + встроенная панель для Extensions.
//
// Публичный API:
//   Nav.mount(opts)                    — создать/примонтировать панель (floating)
//   Nav.refresh()                      — пересобрать оглавление по текущему DOM
//   Nav.unmount()                      — удалить панель
//   Nav.setPosition(pos)               — 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'
//   Nav.setCollapsed(bool)
//   Nav.getState()
//   Nav.buildNavStyles()               — CSS-строка
//   Nav.createPanel(opts)              — HTMLElement со списком секций (для Extensions)
//
// Особенности:
//   - position: fixed, с пересчётом на resize
//   - Учёт высоты .hdr (шапка) и .ast-loc (адресная строка)
//   - Делегирование кликов: [data-action="nav-jump"] → scrollIntoView
//   - Автоопределение секций по [data-nav-section]
//   - Подсветка активной секции при скролле .mn-sections
//   - Сворачивание в иконку
//
// v1.5 (ТЕКУЩАЯ):
//   - ✅ createPanel() поддерживает ИЕРАРХИЮ групп из Groups.buildTree()
//   - ✅ Группы рендерятся как раскрывающиеся узлы (toggle)
//   - ✅ Master-detail: вложенные группы отображаются с отступом
//   - ✅ Клик по группе → scrollIntoView на .mn-group[data-group-id=...]
//   - ✅ Клик по секции → scrollIntoView на секцию
//   - ✅ _attachScrollSync(): MutationObserver на #mn (childList), а не на body+subtree
//   - ✅ Кэш label'ов и поиск по индексам Groups.getIndex() — O(1)
//   - ✅ CSS иерархии в buildNavStyles() (.ast-nav-group*)
// ============================================================================

import * as Groups from './ast-analyzer-groups.js';

const STYLE_ID = 'ast-nav-styles';
const ROOT_ID = 'astNavRoot';

let _root = null;
let _observer = null;
let _scrollHandler = null;
let _resizeHandler = null;
let _resizeObserver = null;

const state = {
  position: 'bottom-right', // 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left'
  collapsed: false,
  sections: [], // { id, label, icon, count, el }
  activeId: null,
  maxWidth: 260,
  offset: 16, // px от края экрана
};

// ---------------------------------------------------------------------------
// СТИЛИ
// ---------------------------------------------------------------------------

export function buildNavStyles() {
  return `
.ast-nav {
  position: fixed;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: rgba(22, 27, 34, 0.96);
  border: 1px solid var(--border, #30363d);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: var(--text, #e6edf3);
  overflow: hidden;
  transition: max-height 0.25s ease, width 0.2s ease, box-shadow 0.2s ease;
  max-height: var(--nav-max-height, 70vh);
  max-width: 280px;
}

/* Правый нижний угол */
.ast-nav.pos-bottom-right {
  right: var(--nav-offset, 16px);
  bottom: var(--nav-offset, 16px);
}

/* Правый верхний угол — ПОД ШАПКОЙ + LOCATION BAR */
.ast-nav.pos-top-right {
  right: var(--nav-offset, 16px);
  top: calc(var(--nav-header-height, 56px) + var(--nav-offset, 16px));
}

/* Левый нижний угол */
.ast-nav.pos-bottom-left {
  left: var(--nav-offset, 16px);
  bottom: var(--nav-offset, 16px);
}

/* Левый верхний угол — ПОД ШАПКОЙ + LOCATION BAR */
.ast-nav.pos-top-left {
  left: var(--nav-offset, 16px);
  top: calc(var(--nav-header-height, 56px) + var(--nav-offset, 16px));
}

.ast-nav-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg3, #21262d);
  border-bottom: 1px solid var(--border, #30363d);
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.ast-nav-header:hover { background: var(--bg4, #30363d); }

.ast-nav-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--text2, #8b949e);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ast-nav-count {
  font-size: 9px;
  padding: 1px 6px;
  background: var(--bg, #0d1117);
  border-radius: 8px;
  color: var(--text2, #8b949e);
}
.ast-nav-toggle {
  background: none;
  border: none;
  color: var(--text2, #8b949e);
  font-size: 12px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.ast-nav-toggle:hover { color: var(--text, #e6edf3); }

.ast-nav-body {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
  gap: 1px;
  scrollbar-width: thin;
}
.ast-nav-body::-webkit-scrollbar { width: 6px; }
.ast-nav-body::-webkit-scrollbar-thumb {
  background: var(--bg4, #30363d);
  border-radius: 3px;
}
.ast-nav-body::-webkit-scrollbar-track { background: transparent; }

.ast-nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--text2, #8b949e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 2px solid transparent;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.ast-nav-item:hover {
  background: var(--bg3, #21262d);
  color: var(--text, #e6edf3);
}
.ast-nav-item.active {
  background: rgba(88, 166, 255, 0.12);
  color: var(--accent, #58a6ff);
  border-left-color: var(--accent, #58a6ff);
  font-weight: 600;
}
.ast-nav-item-icon {
  flex-shrink: 0;
  font-size: 11px;
  width: 14px;
  text-align: center;
}
.ast-nav-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ast-nav-item-count {
  font-size: 9px;
  color: var(--text2, #8b949e);
  padding: 0 4px;
  flex-shrink: 0;
}

/* --- Свёрнутый вид --- */
.ast-nav.collapsed {
  width: auto;
  max-width: none;
}
.ast-nav.collapsed .ast-nav-body { display: none; }
.ast-nav.collapsed .ast-nav-count { display: none; }
.ast-nav.collapsed .ast-nav-title { display: none; }

/* --- Иерархия групп (v1.5) --- */
.ast-nav-group { margin-bottom: 3px; }

.ast-nav-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: var(--bg4, #30363d);
  border-radius: 5px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  color: var(--text, #e6edf3);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  border-left: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
}
.ast-nav-group-header:hover {
  background: var(--accent, #58a6ff);
  color: #fff;
}
.ast-nav-group-header.active {
  background: rgba(88, 166, 255, 0.15);
  color: var(--accent, #58a6ff);
  border-left-color: var(--accent, #58a6ff);
}
.ast-nav-group-header .toggle {
  font-size: 9px;
  width: 10px;
  text-align: center;
  transition: transform 0.15s;
  flex-shrink: 0;
}
.ast-nav-group.collapsed .toggle { transform: rotate(-90deg); }
.ast-nav-group.collapsed .ast-nav-group-body { display: none; }
.ast-nav-group-header .icon { font-size: 12px; flex-shrink: 0; }
.ast-nav-group-header .label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ast-nav-group-header .count {
  font-size: 9px;
  background: var(--bg, #0d1117);
  padding: 1px 6px;
  border-radius: 8px;
  color: var(--text2, #8b949e);
  flex-shrink: 0;
}

.ast-nav-group-body {
  padding-left: 10px;
  border-left: 2px solid var(--border, #30363d);
  margin-left: 8px;
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* --- Встроенная панель (для Extensions) --- */
.ast-nav-panel {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 2px 0;
  max-height: 70vh;
  overflow-y: auto;
}
.ast-nav-panel .ast-nav-item {
  /* переиспользует .ast-nav-item */
}
.ast-nav-panel .ast-nav-group {
  /* переиспользует .ast-nav-group */
}
`;
}

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildNavStyles();
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// СБОР СЕКЦИЙ
// ---------------------------------------------------------------------------

/**
 * Собирает секции навигации из текущего DOM.
 * Ищет элементы с [data-nav-section].
 * Если их нет — делает fallback на .es и .n-card внутри #mn.
 */
function collectSections() {
  const mn = document.getElementById('mn');
  if (!mn) return [];

  const explicit = mn.querySelectorAll('[data-nav-section]');
  const nodes = explicit.length
    ? Array.from(explicit)
    : Array.from(mn.querySelectorAll('.es, .n-card'));

  const result = [];
  const seen = new Set();

  for (const el of nodes) {
    const id = el.id || el.dataset.navSection || '';
    const label =
      el.dataset.navLabel ||
      el.querySelector('.es-h')?.textContent?.trim() ||
      el.querySelector('.nm')?.textContent?.trim() ||
      el.textContent?.trim().slice(0, 40) ||
      'Секция';

    if (!id && !el.dataset.navSection) {
      // Генерируем id
      const gen = 'nav-sec-' + result.length;
      el.id = gen;
      if (!seen.has(gen)) {
        result.push({ id: gen, label: cleanLabel(label), icon: guessIcon(label), el });
        seen.add(gen);
      }
      continue;
    }

    const finalId = id || el.dataset.navSection;
    if (seen.has(finalId)) continue;
    seen.add(finalId);
    result.push({
      id: finalId,
      label: cleanLabel(label),
      icon: guessIcon(label),
      count: extractCount(el),
      el,
    });
  }

  return result;
}

function cleanLabel(s) {
  if (!s) return '';
  return String(s)
    .replace(/[🛤️🔗📞📥📤📦👥🔮⚙️🗺️📄📍→←]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessIcon(label) {
  const l = label.toLowerCase();
  if (l.includes('до')) return '⬅';
  if (l.includes('от')) return '➡';
  if (l.includes('цепочк')) return '🔗';
  if (l.includes('граф вызов')) return '📞';
  if (l.includes('граф завис')) return '🗺️';
  if (l.includes('вход')) return '📥';
  if (l.includes('выход')) return '📤';
  if (l.includes('импорт файла') || l.includes('импорты файла')) return '📦';
  if (l.includes('импортируют')) return '🔗';
  if (l.includes('сосед')) return '👥';
  if (l.includes('транзитив')) return '🔮';
  if (l.includes('функци')) return 'ƒ';
  if (l.includes('экспорт')) return '📤';
  return '§';
}

function extractCount(el) {
  const cnt = el.querySelector('.ct, .cnt, .count');
  if (!cnt) return null;
  const n = parseInt(cnt.textContent, 10);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// АКТИВНАЯ СЕКЦИЯ
// ---------------------------------------------------------------------------

/**
 * Возвращает id активной секции.
 *
 * Приоритет:
 *   1. window.__astActiveSectionId — устанавливается scroll-слушателем
 *      в main.js (Math.round(scrollTop / clientHeight)).
 *   2. Fallback: вычисляем из scrollTop .mn-sections.
 *   3. Fallback: первая секция.
 *
 * @param {Array} sections — массив секций из collectSections()
 * @returns {string|null}
 */
function detectActiveId(sections) {
  if (typeof window !== 'undefined' && window.__astActiveSectionId) {
    return window.__astActiveSectionId;
  }

  const mnSections = document.querySelector('.mn-sections');
  if (mnSections && sections.length) {
    const h = mnSections.clientHeight || 1;
    const idx = Math.round(mnSections.scrollTop / h);
    const secs = mnSections.querySelectorAll('[data-nav-section]');
    const active = secs[idx];
    if (active?.dataset.navSection) return active.dataset.navSection;
  }

  return sections[0]?.id || null;
}

// ---------------------------------------------------------------------------
// РЕНДЕР (floating)
// ---------------------------------------------------------------------------

function renderNav() {
  if (!_root) return;
  const sections = state.sections;

  const posClass = 'pos-' + state.position;
  _root.className = 'ast-nav ' + posClass + (state.collapsed ? ' collapsed' : '');
  _root.style.setProperty('--nav-offset', state.offset + 'px');

  const headerHtml = `
    <div class="ast-nav-header" data-action="nav-toggle">
      <span class="ast-nav-item-icon">🧭</span>
      <span class="ast-nav-title">Навигация</span>
      <span class="ast-nav-count">${sections.length}</span>
      <button class="ast-nav-toggle" title="${state.collapsed ? 'Развернуть' : 'Свернуть'}">
        ${state.collapsed ? '▸' : '▾'}
      </button>
    </div>
  `;

  const bodyHtml = sections.length
    ? `<div class="ast-nav-body">
        ${sections
      .map(
        s => `
          <div class="ast-nav-item${s.id === state.activeId ? ' active' : ''}"
               data-action="nav-jump"
               data-nav-target="${escapeAttr(s.id)}"
               title="${escapeAttr(s.label)}">
            <span class="ast-nav-item-icon">${s.icon}</span>
            <span class="ast-nav-item-label">${escapeHtml(s.label)}</span>
            ${s.count != null ? `<span class="ast-nav-item-count">${s.count}</span>` : ''}
          </div>
        `
      )
      .join('')}
      </div>`
    : `<div class="ast-nav-body">
        <div class="ast-nav-item" style="cursor:default;color:var(--text2);font-style:italic">
          Нет секций
        </div>
      </div>`;

  _root.innerHTML = headerHtml + bodyHtml;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, '&#96;');
}

// ---------------------------------------------------------------------------
// СКРОЛЛ К СЕКЦИИ (floating fallback)
// ---------------------------------------------------------------------------

function jumpToSection(id) {
  const sec = state.sections.find(s => s.id === id);
  if (!sec) return;
  const el = sec.el;

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  state.activeId = id;
  renderNav();
}

// ---------------------------------------------------------------------------
// ОТСЛЕЖИВАНИЕ АКТИВНОЙ СЕКЦИИ (floating)
// ---------------------------------------------------------------------------

function startTracking() {
  stopTracking();

  const mnSections = document.querySelector('.mn-sections');
  if (!mnSections) return;

  _scrollHandler = () => {
    const sections = state.sections;
    if (!sections.length) return;
    const h = mnSections.clientHeight || 1;
    const idx = Math.round(mnSections.scrollTop / h);
    const secs = mnSections.querySelectorAll('[data-nav-section]');
    const active = secs[idx];
    if (!active) return;
    const id = active.dataset.navSection;
    if (id && id !== state.activeId) {
      state.activeId = id;
      renderNav();
    }
  };
  mnSections.addEventListener('scroll', _scrollHandler, { passive: true });
  _scrollHandler();
}

function stopTracking() {
  if (_scrollHandler) {
    const mnSections = document.querySelector('.mn-sections');
    if (mnSections) mnSections.removeEventListener('scroll', _scrollHandler);
    _scrollHandler = null;
  }
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
}

// ---------------------------------------------------------------------------
// ОБРАБОТЧИКИ (floating)
// ---------------------------------------------------------------------------

function attachHandlers() {
  if (!_root) return;
  _root.addEventListener('click', e => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'nav-toggle') {
      state.collapsed = !state.collapsed;
      renderNav();
      return;
    }
    if (action === 'nav-jump') {
      const id = target.dataset.navTarget;
      if (id) jumpToSection(id);
    }
  });
}

/**
 * Пересчитывает высоту всего, что находится ВЫШЕ панели:
 *   .hdr     — шапка приложения (может быть скрыта через .hdr-hidden)
 *   .ast-loc — адресная строка (location bar)
 *
 * Результат пишется в CSS-переменную --nav-header-height.
 */
function attachResize() {
  detachResize();

  const compute = () => {
    if (!_root) return;

    const hdr = document.querySelector('.hdr');
    const hdrHidden = hdr && hdr.classList.contains('hdr-hidden');
    const headerHeight = hdr && !hdrHidden ? Math.ceil(hdr.getBoundingClientRect().height) : 0;

    const loc = document.querySelector('.ast-loc');
    const locHeight = loc ? Math.ceil(loc.getBoundingClientRect().height) : 0;

    const topOffset = headerHeight + locHeight;
    const freeHeight = Math.max(220, window.innerHeight - topOffset - state.offset * 2);

    _root.style.setProperty('--nav-header-height', topOffset + 'px');
    _root.style.setProperty('--nav-offset', state.offset + 'px');
    _root.style.setProperty('--nav-max-height', freeHeight + 'px');
  };

  _resizeHandler = compute;
  window.addEventListener('resize', _resizeHandler, { passive: true });

  compute();
  setTimeout(compute, 50);
  setTimeout(compute, 300);

  if (typeof ResizeObserver !== 'undefined') {
    try {
      _resizeObserver = new ResizeObserver(() => compute());
      const hdr = document.querySelector('.hdr');
      const loc = document.querySelector('.ast-loc');
      if (hdr) _resizeObserver.observe(hdr);
      if (loc) _resizeObserver.observe(loc);
    } catch (e) {
      // игнорируем — есть setTimeout-страховка
    }
  }
}

function detachResize() {
  if (_resizeHandler) {
    window.removeEventListener('resize', _resizeHandler);
    _resizeHandler = null;
  }
  if (_resizeObserver) {
    try {
      _resizeObserver.disconnect();
    } catch {}
    _resizeObserver = null;
  }
}

// ---------------------------------------------------------------------------
// ПУБЛИЧНЫЙ API — FLOATING
// ---------------------------------------------------------------------------

export function mount(opts = {}) {
  injectStyles();
  if (opts.position) state.position = opts.position;
  if (opts.offset != null) state.offset = opts.offset;
  if (opts.collapsed != null) state.collapsed = !!opts.collapsed;

  const existing = document.getElementById(ROOT_ID);
  if (existing) existing.remove();

  _root = document.createElement('div');
  _root.id = ROOT_ID;
  _root.className = 'ast-nav pos-' + state.position + (state.collapsed ? ' collapsed' : '');
  _root.style.setProperty('--nav-offset', state.offset + 'px');
  document.body.appendChild(_root);

  attachHandlers();
  attachResize();
  refresh();
  return _root;
}

export function refresh() {
  if (!_root) return;
  state.sections = collectSections();
  if (state.activeId && !state.sections.find(s => s.id === state.activeId)) {
    state.activeId = state.sections[0]?.id || null;
  }
  if (!state.activeId && state.sections.length) {
    state.activeId = detectActiveId(state.sections);
  }
  renderNav();
  startTracking();
  if (_resizeHandler) _resizeHandler();
}

export function unmount() {
  stopTracking();
  detachResize();
  if (_root) {
    _root.remove();
    _root = null;
  }
}

export function setPosition(pos) {
  state.position = pos;
  if (_root) {
    _root.classList.remove('pos-bottom-right', 'pos-top-right', 'pos-bottom-left', 'pos-top-left');
    _root.classList.add('pos-' + pos);

    const hdr = document.querySelector('.hdr');
    const hdrHidden = hdr && hdr.classList.contains('hdr-hidden');
    const headerHeight = hdr && !hdrHidden ? Math.ceil(hdr.getBoundingClientRect().height) : 0;
    const loc = document.querySelector('.ast-loc');
    const locHeight = loc ? Math.ceil(loc.getBoundingClientRect().height) : 0;
    _root.style.setProperty('--nav-header-height', headerHeight + locHeight + 'px');
  }
}

export function setCollapsed(v) {
  state.collapsed = !!v;
  renderNav();
}

export function getState() {
  return {
    ...state,
    sections: state.sections.map(s => ({ id: s.id, label: s.label })),
  };
}

// ---------------------------------------------------------------------------
// ПУБЛИЧНЫЙ API — EMBEDDED PANEL (для Extensions) v1.5
// ---------------------------------------------------------------------------

/**
 * Возвращает HTMLElement со списком секций — для встраивания
 * в выпадающую панель расширения (Extensions.register({panel})).
 *
 * v1.5: поддержка иерархии групп через Groups.buildTree().
 *
 * @param {object} [opts]
 * @param {Function} [opts.onJump] — колбэк (id) => void при клике на секцию/группу.
 * @returns {HTMLElement}
 */
export function createPanel(opts = {}) {
  injectStyles();

  const wrap = document.createElement('div');
  wrap.className = 'ast-nav-panel';

  const allSections = collectSections();

  if (!allSections.length) {
    const empty = document.createElement('div');
    empty.className = 'ast-ext-panel-empty';
    empty.textContent = 'Нет секций на текущем экране';
    wrap.appendChild(empty);
    return wrap;
  }

  const sectionsById = new Map(allSections.map(s => [s.id, s]));
  const activeId = detectActiveId(allSections);
  state.activeId = activeId;

  // Header
  const header = document.createElement('div');
  header.className = 'ast-ext-panel-header';
  header.innerHTML = `
    <span>🧭</span>
    <span>Навигация</span>
    <span style="margin-left:auto;opacity:0.6">${allSections.length}</span>
  `;
  wrap.appendChild(header);

  // Множество секций, попадающих в группы
  const grouped = new Set();
  for (const g of Groups.listGroups()) {
    for (const c of g.cells) grouped.add(c.section);
  }

  const itemEls = []; // для синхронизации подсветки

  // 1. Иерархия групп
  const tree = Groups.buildTree();
  if (tree.length) {
    for (const node of tree) {
      const nodeEl = _renderGroupNode(node, opts, sectionsById, itemEls, activeId);
      if (nodeEl) wrap.appendChild(nodeEl);
    }
  }

  // 2. Ungrouped секции
  for (const s of allSections) {
    if (grouped.has(s.id)) continue;
    const row = _renderSectionNode(s, opts, activeId, itemEls);
    wrap.appendChild(row);
  }

  // 3. Синхронизация подсветки со скроллом .mn-sections
  _attachScrollSync(itemEls);

  return wrap;
}

// ---------------------------------------------------------------------------
// ИЕРАРХИЯ: узел группы
// ---------------------------------------------------------------------------

function _renderGroupNode(node, opts, sectionsById, itemEls, activeId) {
  const groupWrap = document.createElement('div');
  groupWrap.className = 'ast-nav-group';
  groupWrap.dataset.groupId = node.groupId;

  // Header группы
  const headerEl = document.createElement('div');
  headerEl.className = 'ast-nav-group-header' + (node.id === activeId ? ' active' : '');
  headerEl.dataset.navTarget = node.id;
  headerEl.title = node.label;
  headerEl.innerHTML = `
    <span class="toggle">▾</span>
    <span class="icon">📊</span>
    <span class="label">${escapeHtml(node.label)}</span>
    <span class="count">${node.cells.length + (node.children?.length || 0)}</span>
  `;

  // Клик: toggle по иконке-стрелке, jump — по остальному
  headerEl.addEventListener('click', e => {
    if (e.target.classList.contains('toggle')) {
      groupWrap.classList.toggle('collapsed');
      return;
    }
    state.activeId = node.id;
    for (const it of itemEls) {
      it.el.classList.toggle('active', it.id === node.id);
    }
    if (typeof opts.onJump === 'function') {
      opts.onJump(node.id);
    } else {
      _jumpToNode(node.id);
    }
  });

  itemEls.push({ id: node.id, el: headerEl });

  // Body
  const bodyEl = document.createElement('div');
  bodyEl.className = 'ast-nav-group-body';

  // Дочерние группы (master-detail)
  if (node.children && node.children.length) {
    for (const child of node.children) {
      const childEl = _renderGroupNode(child, opts, sectionsById, itemEls, activeId);
      if (childEl) bodyEl.appendChild(childEl);
    }
  }

  // Секции внутри группы
  for (const sid of node.cells || []) {
    const s = sectionsById.get(sid);
    if (!s) continue;
    const row = _renderSectionNode(s, opts, activeId, itemEls);
    bodyEl.appendChild(row);
  }

  groupWrap.appendChild(headerEl);
  groupWrap.appendChild(bodyEl);

  return groupWrap;
}

// ---------------------------------------------------------------------------
// ИЕРАРХИЯ: узел секции
// ---------------------------------------------------------------------------

function _renderSectionNode(s, opts, activeId, itemEls) {
  const row = document.createElement('div');
  row.className = 'ast-nav-item' + (s.id === activeId ? ' active' : '');
  row.dataset.navTarget = s.id;
  row.title = s.label;

  const icon = document.createElement('span');
  icon.className = 'ast-nav-item-icon';
  icon.textContent = s.icon || '§';

  const label = document.createElement('span');
  label.className = 'ast-nav-item-label';
  label.textContent = s.label;

  row.appendChild(icon);
  row.appendChild(label);

  if (s.count != null) {
    const cnt = document.createElement('span');
    cnt.className = 'ast-nav-item-count';
    cnt.textContent = s.count;
    row.appendChild(cnt);
  }

  row.addEventListener('click', () => {
    state.activeId = s.id;
    for (const it of itemEls) {
      it.el.classList.toggle('active', it.id === s.id);
    }
    if (typeof opts.onJump === 'function') {
      opts.onJump(s.id);
    } else {
      _jumpToNode(s.id);
    }
  });

  itemEls.push({ id: s.id, el: row });

  return row;
}

// ---------------------------------------------------------------------------
// JUMP: группа или секция
// ---------------------------------------------------------------------------

function _jumpToNode(id) {
  // Группа?
  if (id.startsWith('group:')) {
    const gid = id.slice(6);
    const el = document.querySelector(`.mn-group[data-group-id="${_cssEscape(gid)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  // Обычная секция
  const el =
    document.querySelector(`[data-nav-section="${_cssEscape(id)}"]`) ||
    document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function _cssEscape(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(String(s));
  }
  return String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
}

// ---------------------------------------------------------------------------
// СИНХРОНИЗАЦИЯ ПОДСВЕТКИ СО СКРОЛЛОМ
// ---------------------------------------------------------------------------

function _attachScrollSync(itemEls) {
  if (!itemEls.length) return;

  const mnSections = document.querySelector('.mn-sections');
  if (!mnSections) return;

  const onScroll = () => {
    const id = window.__astActiveSectionId;
    if (!id) return;
    let matched = false;
    for (const it of itemEls) {
      if (it.id === id) {
        for (const other of itemEls) {
          other.el.classList.toggle('active', other.id === id);
        }
        matched = true;
        break;
      }
    }
    // Если активна группа, но id группы не совпадает с section id —
    // попробуем найти по data-group-id
    if (!matched) {
      for (const it of itemEls) {
        if (it.id === `group:${id}`) {
          for (const other of itemEls) {
            other.el.classList.toggle('active', other.id === it.id);
          }
          break;
        }
      }
    }
  };

  mnSections.addEventListener('scroll', onScroll, { passive: true });

  // MutationObserver на #mn (только childList), не на body+subtree
  const mn = document.getElementById('mn');
  if (!mn || typeof MutationObserver === 'undefined') return;
  const firstEl = itemEls[0]?.el;
  if (!firstEl) return;

  const mo = new MutationObserver(() => {
    if (!document.body.contains(firstEl)) {
      mnSections.removeEventListener('scroll', onScroll);
      mo.disconnect();
    }
  });
  mo.observe(mn, { childList: true });
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ---------------------------------------------------------------------------

export default {
  mount,
  refresh,
  unmount,
  setPosition,
  setCollapsed,
  getState,
  buildNavStyles,
  createPanel,
};
