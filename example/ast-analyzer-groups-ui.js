// ============================================================================
// AST ANALYZER — GROUPS UI v1.1
// Модальный редактор групп с нативным HTML5 Drag & Drop.
//
// Возможности:
//   - Список групп (левая панель)
//   - Превью Grid (центральная панель)
//   - Пул секций (правая панель)
//   - Нативный HTML5 DnD:
//       • секция из пула → ячейка
//       • секция между группами
//       • группа → группа (master-detail)
//   - Настройка colSpan / rowSpan для каждой ячейки
//   - Пресеты раскладок
//   - Экспорт / Импорт JSON
//   - Автосохранение в localStorage + URL-hash
//
// v1.1 (ИСПРАВЛЕНИЯ):
//   - ✅ DnD через module-scope _dragPayload (а не dataTransfer.getData)
//     → работает во время dragover, красная рамка исчезла
//   - ✅ RAF-батчинг _renderEditor → нет тормозов
//   - ✅ Кэш _collectSectionsFromDOM по ключу
//   - ✅ Debounce save (400ms) для colSpan/rowSpan/label
//   - ✅ Индексы из Groups.getIndex() вместо линейных поисков
//   - ✅ _setupDnD: draggable только при наличии payload
//   - ✅ MutationObserver наблюдает за #mn (не body+subtree)
//
// Публичный API:
//   GroupsUI.openEditor()
//   GroupsUI.closeEditor()
//   GroupsUI.buildStyles()
// ============================================================================

import * as Groups from './ast-analyzer-groups.js';

const MODAL_ID = 'astGroupsModal';
const STYLE_ID = 'ast-groups-styles';
const DND_MIME = 'application/x-ast-section';

let _modal = null;
let _currentGroupId = null;
let _labelsCache = null;
let _escHandlerRef = null;

// --- v1.1: кэш секций ---
let _sectionsCache = null;
let _sectionsCacheKey = '';

// --- v1.1: RAF-батчинг рендера ---
let _renderRAF = null;

// --- v1.1: debounce save ---
let _saveTimer = null;

// --- v1.1: текущий payload DnD (module-scope, т.к. dataTransfer.getData
// недоступен во время dragover) ---
let _dragPayload = null;

// ---------------------------------------------------------------------------
// СТИЛИ
// ---------------------------------------------------------------------------
export function buildStyles() {
  return `
.ast-groups-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.75);
  display: none; align-items: center; justify-content: center;
  z-index: 10002; backdrop-filter: blur(4px); padding: 20px;
}
.ast-groups-overlay.show { display: flex; }

.ast-groups-modal {
  background: var(--bg2, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 12px;
  width: 100%; max-width: 1200px;
  height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.7);
  overflow: hidden;
}

.ast-groups-header {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border, #30363d);
  display: flex; align-items: center; gap: 12px;
  background: var(--bg3, #21262d);
  flex-shrink: 0;
}
.ast-groups-header h3 {
  font-size: 15px; margin: 0; flex: 1;
  display: flex; align-items: center; gap: 8px;
}
.ast-groups-header .btn-close {
  background: none; border: none;
  color: var(--text2, #8b949e);
  font-size: 24px; cursor: pointer;
  padding: 0 8px; line-height: 1;
}
.ast-groups-header .btn-close:hover { color: var(--text, #e6edf3); }

.ast-groups-body {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: 240px 1fr 260px;
  overflow: hidden;
}

/* === Левая панель: список групп === */
.ast-groups-sidebar {
  background: var(--bg3, #21262d);
  border-right: 1px solid var(--border, #30363d);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.ast-groups-sidebar-h {
  padding: 8px 12px;
  font-size: 11px; font-weight: 600;
  color: var(--text2, #8b949e);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border, #30363d);
  display: flex; align-items: center; gap: 6px;
}
.ast-groups-sidebar-h button {
  margin-left: auto;
  padding: 2px 8px; font-size: 11px;
  background: var(--bg4, #30363d);
  border: 1px solid var(--border, #30363d);
  border-radius: 4px; color: var(--text, #e6edf3);
  cursor: pointer;
}
.ast-groups-sidebar-h button:hover {
  border-color: var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}
.ast-groups-list {
  flex: 1; overflow-y: auto;
  padding: 6px;
}
.ast-group-item {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px;
  color: var(--text2, #8b949e);
  border: 1px solid transparent;
  transition: all 0.12s;
  position: relative;
}
.ast-group-item:hover {
  background: var(--bg4, #30363d);
  color: var(--text, #e6edf3);
}
.ast-group-item.active {
  background: rgba(88,166,255,0.12);
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
}
.ast-group-item.dragging { opacity: 0.4; }
.ast-group-item.drop-target {
  border-color: var(--green, #3fb950);
  background: rgba(63,185,80,0.08);
}
.ast-group-item.drop-invalid {
  border-color: var(--red, #f85149);
  background: rgba(248,81,73,0.08);
}
.ast-group-item .group-icon { font-size: 14px; }
.ast-group-item .group-label {
  flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ast-group-item .group-count {
  font-size: 10px;
  background: var(--bg, #0d1117);
  padding: 1px 6px; border-radius: 8px;
}
.ast-group-item .btn-del {
  background: none; border: none;
  color: var(--text2, #8b949e);
  cursor: pointer; padding: 0 4px;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.12s;
}
.ast-group-item:hover .btn-del { opacity: 1; }
.ast-group-item .btn-del:hover { color: var(--red, #f85149); }

.ast-groups-sidebar-f {
  padding: 8px 12px;
  border-top: 1px solid var(--border, #30363d);
  display: flex; gap: 6px;
}
.ast-groups-sidebar-f button {
  padding: 4px 10px; font-size: 11px;
  background: var(--bg4, #30363d);
  border: 1px solid var(--border, #30363d);
  border-radius: 5px; color: var(--text, #e6edf3);
  cursor: pointer;
  flex: 1;
}
.ast-groups-sidebar-f button:hover {
  border-color: var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}

/* === Центр: превью Grid === */
.ast-groups-preview {
  display: flex; flex-direction: column;
  overflow: hidden;
  background: var(--bg, #0d1117);
}
.ast-groups-preview-h {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border, #30363d);
  display: flex; align-items: center; gap: 10px;
  background: var(--bg3, #21262d);
  flex-shrink: 0;
}
.ast-groups-preview-h .label-input {
  flex: 1;
  padding: 4px 10px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 5px;
  color: var(--text, #e6edf3);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.ast-groups-preview-h .label-input:focus {
  border-color: var(--accent, #58a6ff);
}
.ast-groups-preview-h .preset-select {
  padding: 4px 8px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 5px;
  color: var(--text, #e6edf3);
  font-size: 11px;
  cursor: pointer;
}
.ast-groups-preview-h .dim {
  font-size: 10px;
  color: var(--text2, #8b949e);
  font-family: 'Consolas', monospace;
}

.ast-groups-grid-wrap {
  flex: 1; min-height: 0;
  padding: 14px;
  overflow: auto;
}
.ast-groups-grid {
  display: grid;
  grid-template-columns: repeat(var(--preview-cols, 2), 1fr);
  grid-template-rows: repeat(var(--preview-rows, 2), minmax(80px, 1fr));
  gap: 8px;
  min-height: 100%;
}

.ast-grid-cell {
  background: var(--bg2, #161b22);
  border: 2px dashed var(--border, #30363d);
  border-radius: 8px;
  padding: 8px;
  display: flex; flex-direction: column;
  gap: 4px;
  position: relative;
  min-height: 80px;
  transition: all 0.15s;
}
.ast-grid-cell.has-section {
  border-style: solid;
  border-color: var(--accent, #58a6ff);
}
.ast-grid-cell.drop-target {
  border-color: var(--green, #3fb950);
  background: rgba(63,185,80,0.08);
  box-shadow: 0 0 0 3px rgba(63,185,80,0.15);
}
.ast-grid-cell.drop-invalid {
  border-color: var(--red, #f85149);
  background: rgba(248,81,73,0.08);
}

.ast-cell-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px;
  color: var(--text2, #8b949e);
  font-family: 'Consolas', monospace;
}
.ast-cell-header .cell-coords {
  background: var(--bg3, #21262d);
  padding: 1px 6px; border-radius: 4px;
}

.ast-cell-section {
  flex: 1;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px;
  background: var(--bg3, #21262d);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text, #e6edf3);
  cursor: grab;
  overflow: hidden;
}
.ast-cell-section:active { cursor: grabbing; }
.ast-cell-section.dragging { opacity: 0.4; }
.ast-cell-section .sec-icon { font-size: 13px; }
.ast-cell-section .sec-label {
  flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ast-cell-section .btn-remove {
  background: none; border: none;
  color: var(--text2, #8b949e);
  cursor: pointer; padding: 0 2px;
  font-size: 14px;
  opacity: 0;
}
.ast-cell-section:hover .btn-remove { opacity: 1; }
.ast-cell-section .btn-remove:hover { color: var(--red, #f85149); }

.ast-cell-empty {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  color: var(--text2, #8b949e);
  font-size: 11px;
  font-style: italic;
  pointer-events: none;
}

.ast-cell-controls {
  display: flex; gap: 8px;
  font-size: 10px;
  color: var(--text2, #8b949e);
}
.ast-cell-controls label {
  display: flex; align-items: center; gap: 3px;
}
.ast-cell-controls select {
  padding: 1px 4px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 3px;
  color: var(--text, #e6edf3);
  font-size: 10px;
  cursor: pointer;
}

/* === Правая панель: пул секций === */
.ast-groups-pool {
  background: var(--bg3, #21262d);
  border-left: 1px solid var(--border, #30363d);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.ast-groups-pool-h {
  padding: 8px 12px;
  font-size: 11px; font-weight: 600;
  color: var(--text2, #8b949e);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border, #30363d);
}
.ast-groups-pool-list {
  flex: 1; overflow-y: auto;
  padding: 6px;
}
.ast-pool-section {
  padding: 6px 10px;
  border-radius: 5px;
  margin-bottom: 4px;
  cursor: grab;
  display: flex; align-items: center; gap: 8px;
  font-size: 11px;
  background: var(--bg2, #161b22);
  border: 1px solid var(--border, #30363d);
  color: var(--text, #e6edf3);
  transition: all 0.12s;
}
.ast-pool-section:active { cursor: grabbing; }
.ast-pool-section:hover {
  border-color: var(--accent, #58a6ff);
}
.ast-pool-section.dragging { opacity: 0.4; }
.ast-pool-section .sec-icon { font-size: 13px; }
.ast-pool-section .sec-label {
  flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ast-pool-section .sec-source {
  font-size: 9px;
  color: var(--text2, #8b949e);
  padding: 1px 4px;
  background: var(--bg, #0d1117);
  border-radius: 3px;
}

.ast-pool-empty {
  padding: 20px 10px;
  text-align: center;
  color: var(--text2, #8b949e);
  font-style: italic;
  font-size: 11px;
}

/* === Футер === */
.ast-groups-footer {
  padding: 10px 18px;
  border-top: 1px solid var(--border, #30363d);
  display: flex; gap: 8px; align-items: center;
  background: var(--bg3, #21262d);
  flex-shrink: 0;
}
.ast-groups-footer .spacer { flex: 1; }
.ast-groups-footer button {
  padding: 6px 14px;
  background: var(--bg4, #30363d);
  border: 1px solid var(--border, #30363d);
  border-radius: 5px;
  color: var(--text, #e6edf3);
  font-size: 12px;
  cursor: pointer;
}
.ast-groups-footer button:hover {
  border-color: var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}
.ast-groups-footer button.primary {
  background: var(--accent, #58a6ff);
  color: #fff;
  border-color: var(--accent, #58a6ff);
}
.ast-groups-footer button.danger:hover {
  border-color: var(--red, #f85149);
  color: var(--red, #f85149);
}

/* === Меню пресетов === */
.ast-preset-menu {
  position: fixed;
  background: var(--bg2, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  padding: 6px;
  z-index: 10003;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
  min-width: 240px;
  max-height: 70vh;
  overflow-y: auto;
}
.ast-preset-item {
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text, #e6edf3);
}
.ast-preset-item:hover {
  background: var(--bg3, #21262d);
  color: var(--accent, #58a6ff);
}

/* === Адаптив === */
@media (max-width: 1000px) {
  .ast-groups-body {
    grid-template-columns: 200px 1fr 200px;
  }
}
@media (max-width: 800px) {
  .ast-groups-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  .ast-groups-sidebar,
  .ast-groups-pool {
    max-height: 180px;
  }
  .ast-groups-sidebar { border-right: none; border-bottom: 1px solid var(--border); }
  .ast-groups-pool { border-left: none; border-top: 1px solid var(--border); }
}
`;
}

function _injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = buildStyles();
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------------
// ИКОНКИ СЕКЦИЙ
// ---------------------------------------------------------------------------
const SECTION_ICONS = {
  'fn-card': 'ƒ',
  'paths-to': '🛤️',
  'paths-from': '🛤️',
  'paths-to-file': '🛤️',
  'paths-from-file': '🛤️',
  'chain': '🔗',
  'call-graph': '📞',
  'file-dep-graph': '🗺️',
  'module-graph': '🗺️',
  'callers': '📥',
  'callees': '📤',
  'file-imports': '📦',
  'file-importers': '🔗',
  'file-deps-out': '📤',
  'siblings': '👥',
  'transitive': '🔮',
  'exports': '📤',
  'file-functions': '⚙️',
  'file-card': '📄'
};

function _iconFor(id) {
  return SECTION_ICONS[id] || '§';
}

// ---------------------------------------------------------------------------
// СБОР СЕКЦИЙ ИЗ DOM (с кэшем)
// ---------------------------------------------------------------------------
function _collectSectionsFromDOM() {
  const mn = document.getElementById('mn');
  if (!mn) return [];

  const nodes = mn.querySelectorAll('[data-nav-section]');

  // Кэш по ключу: количество + id первой + id последней секции
  const key = `${nodes.length}:${nodes[0]?.dataset.navSection || ''}:${nodes[nodes.length - 1]?.dataset.navSection || ''}`;
  if (_sectionsCache && _sectionsCacheKey === key) return _sectionsCache;

  const sections = [];
  const seen = new Set();
  for (const el of nodes) {
    const id = el.dataset.navSection;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const label = el.dataset.navLabel
      || el.querySelector('.es-h')?.textContent?.trim()
      || id;

    sections.push({
      id,
      label: _cleanLabel(label),
      icon: _iconFor(id)
    });
  }

  _sectionsCache = sections;
  _sectionsCacheKey = key;
  return sections;
}

function _cleanLabel(s) {
  return String(s || '')
    .replace(/[🛤️🔗📞📥📤📦👥🔮⚙️🗺️📄📍→←🧩]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _labelForSection(sid) {
  if (!_labelsCache) {
    _labelsCache = new Map();
    for (const sec of _collectSectionsFromDOM()) {
      _labelsCache.set(sec.id, sec.label);
    }
  }
  return _labelsCache.get(sid) || sid;
}

// ---------------------------------------------------------------------------
// ПУЛ СЕКЦИЙ (быстрый, через индексы Groups)
// ---------------------------------------------------------------------------
function _buildPool(currentGroupId) {
  const all = _collectSectionsFromDOM();
  const idx = Groups.getIndex();
  const pool = [];

  for (const sec of all) {
    const gid = idx.sectionToGroup.get(sec.id);
    if (gid && gid === currentGroupId) continue;

    const g = gid ? idx.groupById.get(gid) : null;
    pool.push({
      ...sec,
      source: g ? 'group' : 'ungrouped',
      groupId: gid || null,
      groupLabel: g ? g.label : 'Вне групп'
    });
  }

  pool.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'ungrouped' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return pool;
}

// ---------------------------------------------------------------------------
// DnD: модуль-скоуп payload (dataTransfer.getData недоступен в dragover)
// ---------------------------------------------------------------------------
function _setupDnD(el, payload, opts = {}) {
  // Включаем draggable ТОЛЬКО если передан payload
  if (payload) {
    el.draggable = true;

    el.addEventListener('dragstart', e => {
      e.stopPropagation();
      _dragPayload = payload;

      const data = JSON.stringify(payload);
      try {
        e.dataTransfer.setData(DND_MIME, data);
        e.dataTransfer.setData('text/plain', data);
      } catch {}
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });

    el.addEventListener('dragend', e => {
      e.stopPropagation();
      _dragPayload = null;
      el.classList.remove('dragging');
      document.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target'));
      document.querySelectorAll('.drop-invalid').forEach(x => x.classList.remove('drop-invalid'));
    });
  }

  if (opts.onDrop) {
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();

      // Проверяем только module-scope payload — БЕЗ чтения dataTransfer
      const src = _dragPayload;
      const valid = !!src && (opts.canDrop ? opts.canDrop(src) : true);

      if (valid) {
        el.classList.add('drop-target');
        el.classList.remove('drop-invalid');
        e.dataTransfer.dropEffect = 'move';
      } else {
        el.classList.remove('drop-target');
        el.classList.add('drop-invalid');
        e.dataTransfer.dropEffect = 'none';
      }
    });

    el.addEventListener('dragleave', e => {
      // Не снимаем рамку, если ушли во вложенный элемент
      if (el.contains(e.relatedTarget)) return;
      el.classList.remove('drop-target', 'drop-invalid');
    });

    el.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drop-target', 'drop-invalid');

      const src = _dragPayload;
      _dragPayload = null;
      if (!src) return;
      opts.onDrop(src, e);
    });
  }
}

// ---------------------------------------------------------------------------
// DEBOUNCED SAVE
// ---------------------------------------------------------------------------
function _debouncedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    Groups.save();
  }, 400);
}

// ---------------------------------------------------------------------------
// МОДАЛКА
// ---------------------------------------------------------------------------
export function openEditor() {
  _injectStyles();

  // Сброс кэшей
  _labelsCache = null;
  _sectionsCache = null;
  _sectionsCacheKey = '';
  _dragPayload = null;

  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  _modal = document.createElement('div');
  _modal.className = 'ast-groups-overlay';
  _modal.id = MODAL_ID;

  _modal.innerHTML = `
    <div class="ast-groups-modal">
      <div class="ast-groups-header">
        <h3>🧩 Редактор групп секций</h3>
        <button class="btn-close" id="agClose" title="Закрыть (Esc)">×</button>
      </div>
      <div class="ast-groups-body">
        <div class="ast-groups-sidebar">
          <div class="ast-groups-sidebar-h">
            Группы
            <button id="agAddGroup" title="Добавить группу">+ Новая</button>
          </div>
          <div class="ast-groups-list" id="agList"></div>
          <div class="ast-groups-sidebar-f">
            <button id="agPreset" title="Применить пресет">⚡ Пресет</button>
          </div>
        </div>
        <div class="ast-groups-preview">
          <div class="ast-groups-preview-h" id="agPreviewH"></div>
          <div class="ast-groups-grid-wrap">
            <div class="ast-groups-grid" id="agGrid"></div>
          </div>
        </div>
        <div class="ast-groups-pool">
          <div class="ast-groups-pool-h">Секции</div>
          <div class="ast-groups-pool-list" id="agPool"></div>
        </div>
      </div>
      <div class="ast-groups-footer">
        <button id="agExport">⬇ Экспорт</button>
        <button id="agImport">⬆ Импорт</button>
        <button id="agReset" class="danger">↺ Сброс</button>
        <span class="spacer"></span>
        <button id="agApply" class="primary">✓ Применить</button>
      </div>
    </div>
  `;

  document.body.appendChild(_modal);
  requestAnimationFrame(() => _modal.classList.add('show'));

  _bindEditorEvents();

  const groups = Groups.listGroups();
  _currentGroupId = groups.length ? groups[0].id : null;

  _renderEditor();
}

export function closeEditor() {
  if (!_modal) return;
  _modal.classList.remove('show');
  const m = _modal;
  _modal = null;
  _dragPayload = null;
  clearTimeout(_saveTimer);

  setTimeout(() => { if (m) m.remove(); }, 200);

  if (_escHandlerRef) {
    document.removeEventListener('keydown', _escHandlerRef);
    _escHandlerRef = null;
  }
}

// ---------------------------------------------------------------------------
// СОБЫТИЯ МОДАЛКИ
// ---------------------------------------------------------------------------
function _bindEditorEvents() {
  if (!_modal) return;

  _modal.querySelector('#agClose').addEventListener('click', closeEditor);
  _modal.addEventListener('click', e => {
    if (e.target === _modal) closeEditor();
  });

  _escHandlerRef = e => {
    if (e.key === 'Escape' && _modal) closeEditor();
  };
  document.addEventListener('keydown', _escHandlerRef);

  _modal.querySelector('#agAddGroup').addEventListener('click', () => {
    const g = Groups.addGroup({ label: '📊 Новая группа', preset: '2x2' });
    _currentGroupId = g.id;
    _renderEditor();
  });

  _modal.querySelector('#agPreset').addEventListener('click', e => {
    _showPresetMenu(e.currentTarget);
  });

  _modal.querySelector('#agApply').addEventListener('click', () => {
    Groups.save();
    closeEditor();
    if (typeof window.__astRerender === 'function') {
      window.__astRerender();
    } else {
      window.dispatchEvent(new CustomEvent('ast:groups-changed'));
    }
  });

  _modal.querySelector('#agReset').addEventListener('click', () => {
    if (!confirm('Сбросить все группы к дефолту?')) return;
    Groups.reset();
    _currentGroupId = null;
    _renderEditor();
  });

  _modal.querySelector('#agExport').addEventListener('click', () => {
    const json = Groups.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ast-groups.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  _modal.querySelector('#agImport').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = e => {
        if (Groups.importJSON(e.target.result)) {
          _renderEditor();
          alert('Импортировано успешно');
        } else {
          alert('Ошибка импорта');
        }
      };
      r.readAsText(f);
    };
    inp.click();
  });
}

// ---------------------------------------------------------------------------
// ПРЕСЕТ-МЕНЮ
// ---------------------------------------------------------------------------
function _showPresetMenu(anchor) {
  const presets = Groups.PRESETS;

  const menu = document.createElement('div');
  menu.className = 'ast-preset-menu';

  for (const [key, p] of Object.entries(presets)) {
    const row = document.createElement('div');
    row.className = 'ast-preset-item';
    row.textContent = `${p.label}${p.special ? ' ⭐' : ''}`;
    row.addEventListener('click', () => {
      menu.remove();
      _applyPresetToCurrent(key);
    });
    menu.appendChild(row);
  }

  const rect = anchor.getBoundingClientRect();
  menu.style.left = rect.left + 'px';
  menu.style.top = (rect.bottom + 4) + 'px';
  document.body.appendChild(menu);

  const mr = menu.getBoundingClientRect();
  if (mr.bottom > window.innerHeight - 10) {
    menu.style.top = Math.max(10, rect.top - mr.height - 4) + 'px';
  }

  setTimeout(() => {
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    document.addEventListener('mousedown', close);
  }, 0);
}

function _applyPresetToCurrent(presetKey) {
  const preset = Groups.PRESETS[presetKey];
  if (!preset) return;

  const isMasterDetail = preset.special === 'master-detail'
    || preset.special === 'master-detail-right';

  if (!_currentGroupId) {
    const g = Groups.addGroup({
      label: `📊 ${preset.label}`,
      preset: presetKey,
      cols: preset.cols,
      rows: preset.rows,
      isMasterDetail
    });
    _currentGroupId = g.id;
  } else {
    Groups.updateGroup(_currentGroupId, {
      preset: presetKey,
      cols: preset.cols,
      rows: preset.rows,
      isMasterDetail,
      special: preset.special || null
    });
  }
  _renderEditor();
}

// ---------------------------------------------------------------------------
// РЕНДЕР (RAF-батчинг)
// ---------------------------------------------------------------------------
function _renderEditor() {
  if (!_modal) return;
  if (_renderRAF) return;
  _renderRAF = requestAnimationFrame(() => {
    _renderRAF = null;
    _renderGroupList();
    _renderPreview();
    _renderPool();
  });
}

// ---------------------------------------------------------------------------
// СПИСОК ГРУПП
// ---------------------------------------------------------------------------
function _renderGroupList() {
  const listEl = _modal.querySelector('#agList');
  if (!listEl) return;

  const groups = Groups.listGroups();
  listEl.innerHTML = '';

  if (!groups.length) {
    listEl.innerHTML = '<div class="ast-pool-empty">Нет групп.<br>Нажмите «+ Новая».</div>';
    return;
  }

  for (const g of groups) {
    const item = document.createElement('div');
    item.className = 'ast-group-item' + (g.id === _currentGroupId ? ' active' : '');
    item.innerHTML = `
      <span class="group-icon">📊</span>
      <span class="group-label" title="${_esc(g.label)}">${_esc(g.label)}</span>
      <span class="group-count">${g.cells.length}</span>
      <button class="btn-del" title="Удалить">×</button>
    `;

    item.addEventListener('click', e => {
      if (e.target.classList.contains('btn-del')) return;
      _currentGroupId = g.id;
      _renderEditor();
    });

    item.querySelector('.btn-del').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Удалить группу «${g.label}»?`)) return;
      Groups.removeGroup(g.id);
      if (_currentGroupId === g.id) _currentGroupId = null;
      _renderEditor();
    });

    // DnD: группу можно перетащить в другую (master-detail)
    _setupDnD(item, { kind: 'group', groupId: g.id }, {
      canDrop: src => src && src.kind === 'group' && src.groupId !== g.id,
      onDrop: src => {
        if (src.kind === 'group' && src.groupId !== g.id) {
          Groups.updateGroup(src.groupId, { parentGroupId: g.id });
          _renderEditor();
        }
      }
    });

    listEl.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// ПРЕВЬЮ GRID
// ---------------------------------------------------------------------------
function _renderPreview() {
  const hEl = _modal.querySelector('#agPreviewH');
  const gridEl = _modal.querySelector('#agGrid');
  if (!hEl || !gridEl) return;

  if (!_currentGroupId) {
    hEl.innerHTML = '<span style="color:var(--text2);font-style:italic">Выберите группу слева</span>';
    gridEl.innerHTML = '';
    gridEl.style.removeProperty('--preview-cols');
    gridEl.style.removeProperty('--preview-rows');
    return;
  }

  const g = Groups.getGroup(_currentGroupId);
  if (!g) {
    _currentGroupId = null;
    _renderPreview();
    return;
  }

  // Header с настройками
  hEl.innerHTML = `
    <input class="label-input" id="agLabelInput" value="${_esc(g.label)}" placeholder="Название группы">
    <select class="preset-select" id="agPresetSelect">
      ${Object.entries(Groups.PRESETS).map(([k, p]) =>
    `<option value="${k}" ${g.preset === k ? 'selected' : ''}>${p.label}</option>`
  ).join('')}
    </select>
    <span class="dim">${g.cols}×${g.rows}${g.special ? ' ⭐' : ''}</span>
  `;

  hEl.querySelector('#agLabelInput').addEventListener('input', e => {
    Groups.updateGroup(g.id, { label: e.target.value });
    _debouncedSave();
    _renderGroupList();  // только левая панель, без перерисовки grid
  });

  hEl.querySelector('#agPresetSelect').addEventListener('change', e => {
    _applyPresetToCurrent(e.target.value);
  });

  // Grid
  gridEl.style.setProperty('--preview-cols', g.cols);
  gridEl.style.setProperty('--preview-rows', g.rows);
  gridEl.innerHTML = '';

  const masterPreset = (g.special === 'master-detail' || g.special === 'master-detail-right')
    ? Groups.PRESETS[g.special]
    : null;

  // Быстрый поиск ячейки по координатам (Map, O(1))
  const cellByPos = new Map();
  for (const c of g.cells) {
    cellByPos.set(`${c.col},${c.row}`, c);
  }

  // Что уже отрисовано — чтобы не рисовать одну и ту же ячейку дважды
  const rendered = new Set();

  for (let row = 1; row <= g.rows; row++) {
    for (let col = 1; col <= g.cols; col++) {
      const posKey = `${col},${row}`;
      if (rendered.has(posKey)) continue;

      const cell = cellByPos.get(posKey);

      const cellEl = document.createElement('div');
      cellEl.className = 'ast-grid-cell' + (cell ? ' has-section' : '');
      cellEl.dataset.col = col;
      cellEl.dataset.row = row;

      // Master-ячейка?
      const isMasterCell = masterPreset
        && masterPreset.masterCol === col
        && masterPreset.masterRow === row
        && g.cells.length > 0;

      if (isMasterCell) {
        cellEl.style.gridColumn = `${masterPreset.masterCol} / span ${masterPreset.masterColSpan}`;
        cellEl.style.gridRow = `${masterPreset.masterRow} / span ${masterPreset.masterRowSpan}`;
        // помечаем занятые ячейки
        for (let dc = 0; dc < masterPreset.masterColSpan; dc++) {
          for (let dr = 0; dr < masterPreset.masterRowSpan; dr++) {
            rendered.add(`${masterPreset.masterCol + dc},${masterPreset.masterRow + dr}`);
          }
        }
      } else if (cell) {
        const cs = cell.colSpan || 1;
        const rs = cell.rowSpan || 1;
        cellEl.style.gridColumn = `${col} / span ${cs}`;
        cellEl.style.gridRow = `${row} / span ${rs}`;
        for (let dc = 0; dc < cs; dc++) {
          for (let dr = 0; dr < rs; dr++) {
            rendered.add(`${col + dc},${row + dr}`);
          }
        }
      } else {
        cellEl.style.gridColumn = String(col);
        cellEl.style.gridRow = String(row);
        rendered.add(posKey);
      }

      cellEl.innerHTML = `
        <div class="ast-cell-header">
          <span class="cell-coords">[${col},${row}]</span>
          ${isMasterCell ? '<span style="color:var(--yellow)">★ master</span>' : ''}
        </div>
      `;

      if (cell) {
        const secEl = document.createElement('div');
        secEl.className = 'ast-cell-section';
        secEl.innerHTML = `
          <span class="sec-icon">${_iconFor(cell.section)}</span>
          <span class="sec-label">${_esc(_labelForSection(cell.section))}</span>
          <button class="btn-remove" title="Убрать из группы">×</button>
        `;

        // Секцию можно вытащить обратно
        _setupDnD(secEl, {
          kind: 'section',
          sectionId: cell.section,
          fromGroupId: g.id
        });

        secEl.querySelector('.btn-remove').addEventListener('click', e => {
          e.stopPropagation();
          Groups.removeSectionFromGroup(g.id, cell.section);
          _renderEditor();
        });

        cellEl.appendChild(secEl);

        // Контролы colSpan / rowSpan (только для не-master)
        if (!isMasterCell) {
          const ctrl = document.createElement('div');
          ctrl.className = 'ast-cell-controls';
          ctrl.innerHTML = `
            <label>↔
              <select data-prop="colSpan">
                ${[1, 2, 3, 4].map(n =>
            `<option value="${n}" ${(cell.colSpan || 1) === n ? 'selected' : ''}>${n}</option>`
          ).join('')}
              </select>
            </label>
            <label>↕
              <select data-prop="rowSpan">
                ${[1, 2, 3].map(n =>
            `<option value="${n}" ${(cell.rowSpan || 1) === n ? 'selected' : ''}>${n}</option>`
          ).join('')}
              </select>
            </label>
          `;
          ctrl.querySelectorAll('select').forEach(sel => {
            sel.addEventListener('change', e => {
              const prop = e.target.dataset.prop;
              const val = parseInt(e.target.value, 10);
              cell[prop] = val;
              Groups.updateGroup(g.id, {});
              _debouncedSave();
              _renderEditor();
            });
          });
          cellEl.appendChild(ctrl);
        }
      } else {
        const empty = document.createElement('div');
        empty.className = 'ast-cell-empty';
        empty.textContent = 'перетащите секцию';
        cellEl.appendChild(empty);
      }

      // Drop на ячейку
      _setupDnD(cellEl, { kind: 'cell', groupId: g.id, col, row }, {
        canDrop: src => {
          if (!src) return false;
          if (src.kind === 'section') return true;
          if (src.kind === 'group') return src.groupId !== g.id;
          return false;
        },
        onDrop: src => {
          if (src.kind === 'section') {
            Groups.addSectionToGroup(g.id, src.sectionId, { col, row });
            _renderEditor();
          } else if (src.kind === 'group' && src.groupId !== g.id) {
            Groups.updateGroup(src.groupId, { parentGroupId: g.id });
            _renderEditor();
          }
        }
      });

      gridEl.appendChild(cellEl);
    }
  }
}

// ---------------------------------------------------------------------------
// ПУЛ СЕКЦИЙ
// ---------------------------------------------------------------------------
function _renderPool() {
  const poolEl = _modal.querySelector('#agPool');
  if (!poolEl) return;

  const pool = _buildPool(_currentGroupId);
  poolEl.innerHTML = '';

  if (!pool.length) {
    poolEl.innerHTML = '<div class="ast-pool-empty">Все секции распределены</div>';
    return;
  }

  for (const sec of pool) {
    const el = document.createElement('div');
    el.className = 'ast-pool-section';
    el.innerHTML = `
      <span class="sec-icon">${sec.icon}</span>
      <span class="sec-label" title="${_esc(sec.label)}">${_esc(sec.label)}</span>
      <span class="sec-source">${_esc(sec.groupLabel)}</span>
    `;

    _setupDnD(el, {
      kind: 'section',
      sectionId: sec.id,
      fromGroupId: sec.groupId
    });

    poolEl.appendChild(el);
  }
}

// ---------------------------------------------------------------------------
// УТИЛИТЫ
// ---------------------------------------------------------------------------
function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ---------------------------------------------------------------------------
export default {
  openEditor,
  closeEditor,
  buildStyles
};
