// ============================================================================
// AST ANALYZER — EXTENSIONS v1.0
// Реестр кнопок-расширений в панели location bar.
//
// Публичный API:
//   Extensions.register(descriptor)          — зарегистрировать расширение
//   Extensions.unregister(id)                — удалить
//   Extensions.get(id)                       — получить дескриптор
//   Extensions.list()                        — список всех
//   Extensions.renderInto(container)         — нарисовать кнопки в контейнер
//   Extensions.openPanel(id)                 — открыть панель расширения
//   Extensions.closePanel()                  — закрыть активную панель
//   Extensions.getActive()                   — id активной панели
//   Extensions.buildStyles()                 — CSS-строка
//
// descriptor = {
//   id: 'nav',                         // уникальный
//   icon: '🧭',                        // символ кнопки
//   title: 'Навигация по секциям',     // tooltip
//   order: 100,                        // сортировка (меньше — левее)
//   panel: (ctx) => HTMLElement,       // содержимое выпадающей панели
//   onOpen: (ctx) => void,             // хук открытия
//   onClose: (ctx) => void,            // хук закрытия
// }
// ============================================================================

const STYLE_ID = 'ast-ext-styles';
const ROOT_CLASS = 'ast-ext';

const registry = new Map();
let rootEl = null;
let activePanelId = null;
let activePanelEl = null;
let outsideHandler = null;
let escHandlerRef = null;

// ---------------------------------------------------------------------------
// Стили
// ---------------------------------------------------------------------------
export function buildStyles() {
  return `
.ast-ext {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ast-ext-btn-wrap {
  position: relative;
  display: inline-block;
}

.ast-ext-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  color: var(--text2, #8b949e);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}
.ast-ext-btn:hover {
  background: var(--bg4, #30363d);
  color: var(--text, #e6edf3);
  border-color: var(--accent, #58a6ff);
}
.ast-ext-btn.active {
  background: var(--accent, #58a6ff);
  color: #fff;
  border-color: var(--accent, #58a6ff);
}

/* --- Выпадающая панель --- */
.ast-ext-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 280px;
  max-width: 360px;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--bg2, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  z-index: 300;
  padding: 4px;
  display: none;
}
.ast-ext-panel.show { display: block; }

.ast-ext-panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #30363d);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text2, #8b949e);
  margin-bottom: 4px;
}

.ast-ext-panel-empty {
  padding: 16px;
  text-align: center;
  color: var(--text2, #8b949e);
  font-style: italic;
  font-size: 11px;
}
`;
}

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = buildStyles();
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------------
// Реестр
// ---------------------------------------------------------------------------
export function register(descriptor) {
  if (!descriptor || !descriptor.id) {
    throw new Error('Extensions.register: нужен id');
  }
  registry.set(descriptor.id, {
    order: 100,
    icon: '⚙',
    title: descriptor.id,
    panel: null,
    onOpen: null,
    onClose: null,
    ...descriptor,
  });
  if (rootEl && rootEl.parentElement) {
    renderInto(rootEl.parentElement);
  }
  return descriptor.id;
}

export function unregister(id) {
  if (activePanelId === id) closePanel();
  registry.delete(id);
  if (rootEl && rootEl.parentElement) {
    renderInto(rootEl.parentElement);
  }
}

export function get(id) {
  return registry.get(id) || null;
}

export function list() {
  return [...registry.values()].sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------------
export function renderInto(container) {
  if (!container) return null;
  injectStyles();

  // Если в контейнере уже есть .ast-ext — переиспользуем
  const existing = container.querySelector('.' + ROOT_CLASS);
  if (existing) {
    existing.innerHTML = '';
    rootEl = existing;
  } else {
    rootEl = document.createElement('div');
    rootEl.className = ROOT_CLASS;
    container.appendChild(rootEl);
  }

  // Контейнер должен быть position: relative, чтобы панели
  // позиционировались относительно него
  const cs = window.getComputedStyle(container);
  if (cs.position === 'static') {
    container.style.position = 'relative';
  }

  const items = list();
  for (const item of items) {
    const wrap = document.createElement('div');
    wrap.className = 'ast-ext-btn-wrap';

    const btn = document.createElement('button');
    btn.className = 'ast-ext-btn';
    btn.type = 'button';
    btn.dataset.extId = item.id;
    btn.title = item.title;
    btn.textContent = item.icon;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (activePanelId === item.id) closePanel();
      else openPanel(item.id);
    });

    wrap.appendChild(btn);
    rootEl.appendChild(wrap);
  }

  return rootEl;
}

// ---------------------------------------------------------------------------
// Панели
// ---------------------------------------------------------------------------
export function openPanel(id) {
  const item = registry.get(id);
  if (!item || !rootEl) return;

  // Если открыта другая — закрываем
  if (activePanelId && activePanelId !== id) closePanel();

  const btn = rootEl.querySelector(`[data-ext-id="${cssEscape(id)}"]`);
  if (!btn) return;

  const wrap = btn.closest('.ast-ext-btn-wrap');
  if (!wrap) return;

  // Строим содержимое панели
  let panelEl = null;
  if (typeof item.panel === 'function') {
    try {
      panelEl = item.panel({ id, close: closePanel });
    } catch (e) {
      console.warn('[Extensions] panel() error:', e.message);
    }
  } else if (item.panel instanceof HTMLElement) {
    panelEl = item.panel;
  }

  if (!panelEl) {
    panelEl = document.createElement('div');
    panelEl.className = 'ast-ext-panel-empty';
    panelEl.textContent = 'Нет содержимого';
  }

  panelEl.classList.add('ast-ext-panel');
  panelEl.classList.add('show');
  wrap.appendChild(panelEl);

  activePanelId = id;
  activePanelEl = panelEl;
  btn.classList.add('active');

  // Хук открытия
  if (typeof item.onOpen === 'function') {
    try {
      item.onOpen({ id, panel: panelEl, close: closePanel });
    } catch (e) {
      console.warn('[Extensions] onOpen error:', e.message);
    }
  }

  // Закрытие по клику вне панели / Esc.
  // setTimeout(0) — чтобы текущий клик не поймался этим же обработчиком.
  setTimeout(() => {
    outsideHandler = e => {
      if (panelEl && panelEl.contains(e.target)) return;
      if (btn.contains(e.target)) return;
      closePanel();
    };
    escHandlerRef = e => {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('mousedown', outsideHandler);
    document.addEventListener('keydown', escHandlerRef);
  }, 0);
}

export function closePanel() {
  if (!activePanelId) return;

  const item = registry.get(activePanelId);
  const panel = activePanelEl;
  const id = activePanelId;

  if (panel && panel.parentElement) {
    panel.parentElement.removeChild(panel);
  }
  if (rootEl) {
    const btn = rootEl.querySelector(`[data-ext-id="${cssEscape(id)}"]`);
    if (btn) btn.classList.remove('active');
  }

  activePanelId = null;
  activePanelEl = null;

  if (outsideHandler) {
    document.removeEventListener('mousedown', outsideHandler);
    outsideHandler = null;
  }
  if (escHandlerRef) {
    document.removeEventListener('keydown', escHandlerRef);
    escHandlerRef = null;
  }

  // Хук закрытия
  if (item && typeof item.onClose === 'function') {
    try {
      item.onClose({ id });
    } catch (e) {
      console.warn('[Extensions] onClose error:', e.message);
    }
  }
}

export function getActive() {
  return activePanelId;
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
function cssEscape(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(String(s));
  }
  return String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
}

// ---------------------------------------------------------------------------
// Экспорт по умолчанию
// ---------------------------------------------------------------------------
export default {
  register,
  unregister,
  get,
  list,
  renderInto,
  openPanel,
  closePanel,
  getActive,
  buildStyles,
};
