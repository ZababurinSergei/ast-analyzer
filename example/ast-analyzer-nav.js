// ============================================================================
// AST ANALYZER — NAV v1.4
// Плавающая мини-навигация по секциям текущего экрана.
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
//   - Учёт высоты .hdr (шапка) и .ast-loc (адресная строка) —
//     панель в top-* позициях не перекрывает location bar
//   - Не мешает контенту (max-width ограничен)
//   - Делегирование кликов: [data-action="nav-jump"] → scrollIntoView
//   - Автоопределение секций по [data-nav-section]
//   - Подсветка активной секции при скролле .mn-sections
//   - Сворачивание в иконку
//
// v1.1:
//   - attachResize(): учитывает .ast-loc в дополнение к .hdr
//     (top = hdr + loc + offset)
//   - setPosition(): тоже пересчитывает --nav-header-height
//     с учётом location bar
//
// v1.2:
//   - attachResize(): учитывает .hdr.hdr-hidden (высота 0,
//     когда шапка скрыта кнопкой в location bar)
//   - setPosition(): то же самое
//   - compute(): headerHeight = 0, если .hdr имеет класс hdr-hidden
//
// v1.3:
//   - ✅ NEW: createPanel(opts) — возвращает HTMLElement со списком
//     секций для встраивания в выпадающую панель Extensions
//     (см. ast-analyzer-extensions.js).
//   - ✅ NEW: в createPanel() используется собственный MutationObserver,
//     который останавливает IntersectionObserver после удаления панели
//     из DOM.
//   - ✅ NEW: onJump колбэк в createPanel() — позволяет вызывающему
//     коду самому решать, как скроллить (например, закрыть панель).
//   - ✅ Floating-режим (mount/unmount) сохранён, но в main.js
//     больше не используется. Оставлен для обратной совместимости
//     и для случаев, когда панель нужна отдельно от location bar.
//
// v1.4 (ТЕКУЩАЯ):
//   - ✅ createPanel() переписан под scroll-snap архитектуру:
//     секции живут в .mn-sections (scroll-snap-type: y mandatory),
//     каждая секция — ровно один экран.
//   - ✅ Убран IntersectionObserver (в scroll-snap он ненадёжен из-за
//     rootMargin и mandatory-снапа).
//   - ✅ Активная секция определяется через window.__astActiveSectionId
//     (устанавливается scroll-слушателем в main.js по формуле
//     Math.round(scrollTop / clientHeight)).
//   - ✅ Fallback: если window.__astActiveSectionId не установлен —
//     вычисляем индекс секции сами из scrollTop .mn-sections.
//   - ✅ Подсветка в панели синхронизируется со скроллом:
//     подписка на событие 'scroll' у .mn-sections, пока панель открыта.
//   - ✅ Очистка: при удалении панели из DOM снимаем scroll-слушатель
//     (MutationObserver).
//   - ✅ onJump в createPanel() НЕ скроллит сам — только вызывает
//     колбэк. Скролл делает main.js через el.scrollIntoView({behavior:'smooth'}),
//     а scroll-snap дощёлкивает до границы секции.
// ============================================================================

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

/* --- Встроенная панель (для Extensions) --- */
.ast-nav-panel {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 2px 0;
}
.ast-nav-panel .ast-nav-item {
  /* переиспользует .ast-nav-item, дополнительных правил не требует */
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
// АКТИВНАЯ СЕКЦИЯ (v1.4)
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

  // v1.4: используем scrollIntoView — он работает и со scroll-snap,
  // и с обычным overflow-y: auto. Никаких ручных расчётов scrollTop.
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Подсветка
  state.activeId = id;
  renderNav();
}

// ---------------------------------------------------------------------------
// ОТСЛЕЖИВАНИЕ АКТИВНОЙ СЕКЦИИ (floating)
// ---------------------------------------------------------------------------

function startTracking() {
  stopTracking();

  // v1.4: IntersectionObserver убран. Используем scroll-слушатель
  // на .mn-sections. Формула: idx = Math.round(scrollTop / clientHeight).
  // Это работает идеально для scroll-snap, где каждая секция = один экран.
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
 * Результат пишется в CSS-переменную --nav-header-height,
 * которую использует .ast-nav.pos-top-right / .pos-top-left.
 *
 * Также вычисляет --nav-max-height — сколько панели остаётся
 * по вертикали до низа окна.
 *
 * v1.2: если .hdr имеет класс hdr-hidden — его высота считается 0.
 */
function attachResize() {
  detachResize();

  const compute = () => {
    if (!_root) return;

    // 1. Высота шапки .hdr (учитываем скрытие)
    const hdr = document.querySelector('.hdr');
    const hdrHidden = hdr && hdr.classList.contains('hdr-hidden');
    const headerHeight = hdr && !hdrHidden ? Math.ceil(hdr.getBoundingClientRect().height) : 0;

    // 2. Высота адресной строки .ast-loc (если она есть)
    const loc = document.querySelector('.ast-loc');
    const locHeight = loc ? Math.ceil(loc.getBoundingClientRect().height) : 0;

    // 3. Суммарная высота всего, что выше панели
    const topOffset = headerHeight + locHeight;

    // 4. Свободное место до низа окна
    const freeHeight = Math.max(220, window.innerHeight - topOffset - state.offset * 2);

    _root.style.setProperty('--nav-header-height', topOffset + 'px');
    _root.style.setProperty('--nav-offset', state.offset + 'px');
    _root.style.setProperty('--nav-max-height', freeHeight + 'px');
  };

  _resizeHandler = compute;
  window.addEventListener('resize', _resizeHandler, { passive: true });

  // Вызываем сразу и с задержками — DOM и шрифты могут догружаться
  compute();
  setTimeout(compute, 50);
  setTimeout(compute, 300);

  // Отдельно слушаем изменение размера .hdr / .ast-loc
  // (например, если location bar появится позже,
  //  или если шапка будет скрыта/показана)
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
  // Если ранее активная секция исчезла — сбросить
  if (state.activeId && !state.sections.find(s => s.id === state.activeId)) {
    state.activeId = state.sections[0]?.id || null;
  }
  if (!state.activeId && state.sections.length) {
    state.activeId = detectActiveId(state.sections);
  }
  renderNav();
  startTracking();
  // Пересчёт высоты — контент мог измениться
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

    // Пересчёт отступа для top-* — учитываем .hdr + .ast-loc
    // v1.2: если .hdr скрыт (.hdr-hidden) — высота 0
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
// ПУБЛИЧНЫЙ API — EMBEDDED PANEL (для Extensions)
// ---------------------------------------------------------------------------

/**
 * Возвращает HTMLElement со списком секций — для встраивания
 * в выпадающую панель расширения (Extensions.register({panel})).
 *
 * v1.4: панель пересобирает секции каждый раз при вызове (актуальный DOM).
 *
 * Активная секция определяется через:
 *   1. window.__astActiveSectionId — устанавливается scroll-слушателем
 *      в main.js по формуле Math.round(scrollTop / clientHeight).
 *   2. Fallback: сами вычисляем из scrollTop .mn-sections.
 *   3. Fallback: первая секция.
 *
 * Подсветка синхронизируется со скроллом .mn-sections, пока панель
 * открыта. При удалении панели из DOM слушатель снимается
 * (MutationObserver).
 *
 * onJump в opts — колбэк, вызываемый при клике. Панель НЕ скроллит
 * сама — это делает main.js через el.scrollIntoView({behavior:'smooth'}),
 * а scroll-snap дощёлкивает до границы секции.
 *
 * @param {object} [opts]
 * @param {Function} [opts.onJump] — колбэк (id) => void при клике на секцию.
 *                                   Если не задан — используется
 *                                   встроенный jumpToSection(id).
 * @returns {HTMLElement}
 */
export function createPanel(opts = {}) {
  injectStyles();

  const wrap = document.createElement('div');
  wrap.className = 'ast-nav-panel';

  // Собираем секции из текущего DOM
  const sections = collectSections();

  if (!sections.length) {
    const empty = document.createElement('div');
    empty.className = 'ast-ext-panel-empty';
    empty.textContent = 'Нет секций на текущем экране';
    wrap.appendChild(empty);
    return wrap;
  }

  // v1.4: активная секция — из window.__astActiveSectionId или fallback
  const activeId = detectActiveId(sections);
  state.activeId = activeId;

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'ast-ext-panel-header';
  header.innerHTML = `
    <span>🧭</span>
    <span>Навигация</span>
    <span style="margin-left:auto;opacity:0.6">${sections.length}</span>
  `;
  wrap.appendChild(header);

  // --- Items ---
  const itemEls = [];
  for (const s of sections) {
    const row = document.createElement('div');
    row.className = 'ast-nav-item' + (s.id === activeId ? ' active' : '');
    row.dataset.navTarget = s.id;
    row.title = s.label;

    const icon = document.createElement('span');
    icon.className = 'ast-nav-item-icon';
    icon.textContent = s.icon;

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
      // Обновляем подсветку сразу — не ждём scroll-события
      for (const it of itemEls) {
        it.el.classList.toggle('active', it.id === s.id);
      }
      if (typeof opts.onJump === 'function') {
        opts.onJump(s.id);
      } else {
        jumpToSection(s.id);
      }
    });

    wrap.appendChild(row);
    itemEls.push({ id: s.id, el: row });
  }

  // --- Синхронизация подсветки со скроллом .mn-sections ---
  // Пока панель открыта — слушаем scroll и обновляем active.
  // При удалении панели из DOM — снимаем слушатель (MutationObserver).
  const mnSections = document.querySelector('.mn-sections');
  const onScroll = () => {
    const id = window.__astActiveSectionId;
    if (!id || id === state.activeId) return;
    state.activeId = id;
    for (const it of itemEls) {
      it.el.classList.toggle('active', it.id === id);
    }
  };
  if (mnSections) {
    mnSections.addEventListener('scroll', onScroll, { passive: true });
  }

  if (typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(() => {
      if (!wrap.isConnected) {
        if (mnSections) {
          mnSections.removeEventListener('scroll', onScroll);
        }
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  return wrap;
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
