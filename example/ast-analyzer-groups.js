// ============================================================================
// AST ANALYZER — GROUPS v1.1
// Группировка секций в Grid-раскладки с full-page режимом.
//
// Возможности:
//   - Пресеты раскладок (1×1, 2×1, 2×2, 3×2, 4×2, master-detail, sidebar)
//   - Master-Detail: вложенные группы (группа как ячейка группы)
//   - Адаптив: на узких экранах — 1 колонка
//   - Сохранение в localStorage + экспорт в URL-hash (base64)
//   - Импорт/экспорт JSON
//   - Fallback: при переполнении URL — только localStorage
//   - ✅ v1.1: ИНДЕКСЫ для быстрого доступа (Map вместо Array.find)
//
// Публичный API:
//   Groups.load()                       → загрузить из localStorage/URL
//   Groups.save()                       → сохранить в localStorage + URL
//   Groups.getConfig()                  → текущий конфиг
//   Groups.setConfig(cfg)               → заменить конфиг
//   Groups.reset()                      → дефолт
//   Groups.listGroups()                 → список групп (плоский)
//   Groups.getGroup(id)                 → группа по id
//   Groups.addGroup({...})              → создать
//   Groups.updateGroup(id, patch)       → обновить
//   Groups.removeGroup(id)              → удалить
//   Groups.addSectionToGroup(gid, sid, cell)
//   Groups.removeSectionFromGroup(gid, sid)
//   Groups.getGroupForSection(sid)      → группа | null
//   Groups.getSectionCell(gid, sid)     → {col,row,colSpan,rowSpan} | null
//   Groups.buildTree()                  → иерархия для Nav
//   Groups.renderSections(sectionsMap)  → HTMLElement с группами
//   Groups.PRESETS                       → готовые шаблоны
//   Groups.onChange(cb)                 → подписка на изменения
//   Groups.getIndex()                   → индексы (кэш)
//   Groups.getGroupByIdFast(id)         → O(1) поиск группы
//   Groups.getGroupIdForSection(sid)    → O(1) поиск группы секции
//   Groups.isGrouped(sid)               → bool
// ============================================================================

const LS_KEY = 'ast-analyzer:v13:groups';
const HASH_PREFIX = '#groups=';

// Ограничение URL: если base64-hash длиннее этого — не пишем в URL,
// оставляем только localStorage.
const MAX_HASH_LENGTH = 8000;

// ---------------------------------------------------------------------------
// ПРЕСЕТЫ РАСКЛАДОК
// ---------------------------------------------------------------------------
export const PRESETS = {
  '1x1':      { label: '1 × 1',        cols: 1, rows: 1 },
  '2x1':      { label: '2 × 1',        cols: 2, rows: 1 },
  '1x2':      { label: '1 × 2',        cols: 1, rows: 2 },
  '2x2':      { label: '2 × 2',        cols: 2, rows: 2 },
  '3x1':      { label: '3 × 1',        cols: 3, rows: 1 },
  '3x2':      { label: '3 × 2',        cols: 3, rows: 2 },
  '2x3':      { label: '2 × 3',        cols: 2, rows: 3 },
  '3x3':      { label: '3 × 3',        cols: 3, rows: 3 },
  '4x2':      { label: '4 × 2',        cols: 4, rows: 2 },
  'master-detail': {
    label: 'Master / Detail (master слева)',
    cols: 2, rows: 2,
    special: 'master-detail',
    masterCol: 1, masterRow: 1,
    masterColSpan: 1, masterRowSpan: 2
  },
  'master-detail-right': {
    label: 'Master / Detail (master справа)',
    cols: 2, rows: 2,
    special: 'master-detail-right',
    masterCol: 2, masterRow: 1,
    masterColSpan: 1, masterRowSpan: 2
  },
  'sidebar': {
    label: 'Sidebar + Main',
    cols: 4, rows: 1,
    special: 'sidebar'
  }
};

// ---------------------------------------------------------------------------
// ДЕФОЛТНЫЙ КОНФИГ
// ---------------------------------------------------------------------------
export const DEFAULT_CONFIG = {
  version: 1,
  groups: [],
  ungrouped: [],
  adaptOnNarrow: true,
  narrowBreakpoint: 900
};

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
let _config = null;
let _listeners = [];
let _indexVersion = 0;

export function onChange(cb) {
  _listeners.push(cb);
  return () => { _listeners = _listeners.filter(l => l !== cb); };
}

function _emit() {
  _indexVersion++;
  for (const cb of _listeners) {
    try { cb(_config); } catch (e) { console.warn('[Groups] listener error:', e); }
  }
}

// ---------------------------------------------------------------------------
// ИНДЕКСЫ (кэш для O(1) доступа)
// ---------------------------------------------------------------------------
let _index = null;
let _indexBuiltAt = -1;

/**
 * Возвращает индексы по текущему конфигу.
 * Кэшируется; инвалидируется при _emit() (каждое изменение конфига).
 *
 * @returns {{
 *   groupById: Map<string, object>,
 *   sectionToGroup: Map<string, string>,
 *   sectionToCell: Map<string, {groupId,col,row,colSpan,rowSpan}>,
 *   childrenOf: Map<string, string[]>,
 *   roots: string[],
 *   ungroupedSet: Set<string>,
 *   allGrouped: Set<string>,
 *   version: number
 * }}
 */
export function getIndex() {
  if (_index && _indexBuiltAt === _indexVersion) return _index;

  const cfg = getConfig();
  const groupById = new Map();
  const sectionToGroup = new Map();
  const sectionToCell = new Map();
  const childrenOf = new Map();
  const roots = [];
  const ungroupedSet = new Set(cfg.ungrouped || []);
  const allGrouped = new Set();

  for (const g of cfg.groups) {
    groupById.set(g.id, g);
    if (!g.parentGroupId) roots.push(g.id);
    for (const c of g.cells) {
      sectionToGroup.set(c.section, g.id);
      sectionToCell.set(c.section, {
        groupId: g.id,
        col: c.col,
        row: c.row,
        colSpan: c.colSpan || 1,
        rowSpan: c.rowSpan || 1
      });
      allGrouped.add(c.section);
    }
  }

  for (const g of cfg.groups) {
    if (g.parentGroupId) {
      if (!childrenOf.has(g.parentGroupId)) childrenOf.set(g.parentGroupId, []);
      childrenOf.get(g.parentGroupId).push(g.id);
    }
  }

  _index = {
    groupById,
    sectionToGroup,
    sectionToCell,
    childrenOf,
    roots,
    ungroupedSet,
    allGrouped,
    version: _indexVersion
  };
  _indexBuiltAt = _indexVersion;
  return _index;
}

export function getGroupByIdFast(id) {
  return getIndex().groupById.get(id) || null;
}

export function getGroupIdForSection(sectionId) {
  return getIndex().sectionToGroup.get(sectionId) || null;
}

export function isGrouped(sectionId) {
  return getIndex().allGrouped.has(sectionId);
}

// ---------------------------------------------------------------------------
// ЗАГРУЗКА / СОХРАНЕНИЕ
// ---------------------------------------------------------------------------
function _clone(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

export function getConfig() {
  if (!_config) _config = _clone(DEFAULT_CONFIG);
  return _config;
}

export function setConfig(cfg) {
  _config = { ..._clone(DEFAULT_CONFIG), ..._clone(cfg) };
  _emit();
  return _config;
}

export function load() {
  // 1. Приоритет: URL hash
  const fromHash = _readHash();
  if (fromHash) {
    _config = { ..._clone(DEFAULT_CONFIG), ...fromHash };
    _emit();
    return _config;
  }

  // 2. localStorage
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _config = { ..._clone(DEFAULT_CONFIG), ...parsed };
      _emit();
      return _config;
    }
  } catch (e) {
    console.warn('[Groups] localStorage read error:', e.message);
  }

  // 3. Дефолт
  _config = _clone(DEFAULT_CONFIG);
  _emit();
  return _config;
}

export function save() {
  const cfg = getConfig();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('[Groups] localStorage write error:', e.message);
  }
  _writeHash(cfg);
  _emit();
  return cfg;
}

export function reset() {
  _config = _clone(DEFAULT_CONFIG);
  try { localStorage.removeItem(LS_KEY); } catch {}
  _clearHash();
  _emit();
  return _config;
}

// ---------------------------------------------------------------------------
// URL HASH (base64 с fallback)
// ---------------------------------------------------------------------------
function _readHash() {
  if (typeof window === 'undefined') return null;
  try {
    const h = window.location.hash || '';
    if (!h.startsWith(HASH_PREFIX)) return null;
    const encoded = h.slice(HASH_PREFIX.length);
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json);
  } catch (e) {
    console.warn('[Groups] hash decode error:', e.message);
    return null;
  }
}

function _writeHash(cfg) {
  if (typeof window === 'undefined') return;

  // Если групп нет — hash не нужен
  if (!cfg.groups || cfg.groups.length === 0) {
    _clearHash();
    return;
  }

  let newHash;
  try {
    const json = JSON.stringify(cfg);
    const encoded = btoa(encodeURIComponent(json));
    newHash = HASH_PREFIX + encoded;
  } catch (e) {
    console.warn('[Groups] hash encode error:', e.message);
    return;
  }

  // Fallback: если hash слишком длинный — не пишем в URL,
  // localStorage уже содержит конфиг.
  if (newHash.length > MAX_HASH_LENGTH) {
    console.warn(
      `[Groups] hash слишком длинный (${newHash.length} > ${MAX_HASH_LENGTH}), ` +
      'используется только localStorage'
    );
    _clearHash();
    return;
  }

  // Не трогаем history, если hash не изменился
  if (window.location.hash === newHash) return;

  try {
    const url = window.location.pathname + window.location.search + newHash;
    window.history.replaceState(null, '', url);
  } catch (e) {
    console.warn('[Groups] hash write error:', e.message);
  }
}

function _clearHash() {
  if (typeof window === 'undefined') return;
  if (!window.location.hash.startsWith(HASH_PREFIX)) return;
  try {
    const url = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  } catch {}
}

// ---------------------------------------------------------------------------
// CRUD ГРУПП
// ---------------------------------------------------------------------------
function _genId(prefix = 'g') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function listGroups() {
  return getConfig().groups;
}

export function getGroup(id) {
  // O(1) через индекс
  return getGroupByIdFast(id);
}

export function addGroup(opts = {}) {
  const cfg = getConfig();
  const preset = PRESETS[opts.preset] || PRESETS['2x2'];

  const g = {
    id: opts.id || _genId(),
    label: opts.label || '📊 Группа',
    cols: opts.cols || preset.cols,
    rows: opts.rows || preset.rows,
    preset: opts.preset || '2x2',
    cells: opts.cells || [],
    isMasterDetail: opts.isMasterDetail !== undefined
      ? opts.isMasterDetail
      : preset.special === 'master-detail' || preset.special === 'master-detail-right',
    parentGroupId: opts.parentGroupId || null,
    special: preset.special || null
  };

  cfg.groups.push(g);
  _emit();
  return g;
}

export function updateGroup(id, patch) {
  const g = getGroupByIdFast(id);
  if (!g) return null;
  Object.assign(g, patch);
  _emit();
  return g;
}

export function removeGroup(id) {
  const cfg = getConfig();
  const idx = cfg.groups.findIndex(g => g.id === id);
  if (idx < 0) return false;

  // Секции удаляемой группы → ungrouped
  for (const cell of cfg.groups[idx].cells) {
    if (!cfg.ungrouped.includes(cell.section)) {
      cfg.ungrouped.push(cell.section);
    }
  }

  // Дочерние группы → на верхний уровень
  for (const g of cfg.groups) {
    if (g.parentGroupId === id) g.parentGroupId = null;
  }

  cfg.groups.splice(idx, 1);
  _emit();
  return true;
}

// ---------------------------------------------------------------------------
// СЕКЦИИ В ГРУППАХ
// ---------------------------------------------------------------------------
export function addSectionToGroup(groupId, sectionId, cell = {}) {
  const cfg = getConfig();
  const g = getGroupByIdFast(groupId);
  if (!g) return false;

  // Удаляем из других групп
  for (const other of cfg.groups) {
    if (other.id === groupId) continue;
    other.cells = other.cells.filter(c => c.section !== sectionId);
  }

  // Убираем из ungrouped
  cfg.ungrouped = cfg.ungrouped.filter(s => s !== sectionId);

  // Добавляем в целевую группу
  if (!g.cells.find(c => c.section === sectionId)) {
    g.cells.push({
      section: sectionId,
      col: cell.col || 1,
      row: cell.row || 1,
      colSpan: cell.colSpan || 1,
      rowSpan: cell.rowSpan || 1
    });
  }
  _emit();
  return true;
}

export function removeSectionFromGroup(groupId, sectionId) {
  const cfg = getConfig();
  const g = getGroupByIdFast(groupId);
  if (!g) return false;

  g.cells = g.cells.filter(c => c.section !== sectionId);

  const stillGrouped = cfg.groups.some(gr =>
    gr.cells.some(c => c.section === sectionId)
  );
  if (!stillGrouped && !cfg.ungrouped.includes(sectionId)) {
    cfg.ungrouped.push(sectionId);
  }
  _emit();
  return true;
}

export function getGroupForSection(sectionId) {
  const gid = getGroupIdForSection(sectionId);
  return gid ? getGroupByIdFast(gid) : null;
}

export function getSectionCell(groupId, sectionId) {
  const g = getGroupByIdFast(groupId);
  if (!g) return null;
  return g.cells.find(c => c.section === sectionId) || null;
}

// ---------------------------------------------------------------------------
// ИЕРАРХИЯ (для Nav)
// ---------------------------------------------------------------------------
export function buildTree() {
  const idx = getIndex();
  const cfg = getConfig();

  function _treeNode(gid) {
    const g = idx.groupById.get(gid);
    if (!g) return null;
    const childIds = idx.childrenOf.get(gid) || [];
    const children = childIds.map(_treeNode).filter(Boolean);
    return {
      id: `group:${g.id}`,
      groupId: g.id,
      label: g.label,
      isGroup: true,
      cols: g.cols,
      rows: g.rows,
      cells: g.cells.map(c => c.section),
      children
    };
  }

  return idx.roots.map(_treeNode).filter(Boolean);
}

// ---------------------------------------------------------------------------
// РЕНДЕР СЕКЦИЙ С ГРУППАМИ
// ---------------------------------------------------------------------------
/**
 * Принимает карту { sectionId: HTMLElement } и возвращает
 * готовый `.mn-sections` с применёнными группами.
 *
 * @param {Object<string, HTMLElement>} sectionsMap
 * @returns {HTMLElement}
 */
export function renderSections(sectionsMap) {
  const cfg = getConfig();
  const idx = getIndex();
  const container = document.createElement('div');
  container.className = 'mn-sections';

  // 1. Группы верхнего уровня
  for (const gid of idx.roots) {
    const g = idx.groupById.get(gid);
    if (!g) continue;
    const el = _renderGroup(g, sectionsMap, cfg, idx);
    if (el) container.appendChild(el);
  }

  // 2. Ungrouped секции — по одной на всю высоту
  for (const [sid, el] of Object.entries(sectionsMap)) {
    if (idx.allGrouped.has(sid)) continue;
    if (!el.dataset.navSection) el.dataset.navSection = sid;
    container.appendChild(el);
  }

  return container;
}

function _renderGroup(group, sectionsMap, cfg, idx) {
  const childIds = idx.childrenOf.get(group.id) || [];
  const cells = [];

  for (const c of group.cells) {
    const el = sectionsMap[c.section];
    if (!el) continue;
    cells.push({ kind: 'section', cell: c, el, sectionId: c.section });
  }
  for (const cgid of childIds) {
    const cg = idx.groupById.get(cgid);
    if (cg) cells.push({ kind: 'group', cell: {}, group: cg });
  }

  if (!cells.length && !group.label) return null;

  const wrap = document.createElement('div');
  wrap.className = 'mn-group' + (group.isMasterDetail ? ' mn-group-master' : '');
  if (group.special) wrap.dataset.special = group.special;
  wrap.dataset.navSection = `group:${group.id}`;
  wrap.dataset.navLabel = group.label;
  wrap.dataset.groupId = group.id;
  wrap.style.setProperty('--group-cols', group.cols);
  wrap.style.setProperty('--group-rows', group.rows);
  wrap.style.setProperty('--group-narrow-min', cfg.narrowBreakpoint + 'px');

  // Header
  const header = document.createElement('div');
  header.className = 'mn-group-header';
  header.innerHTML = `
    <span class="mn-group-label">${_esc(group.label)}</span>
    <span class="mn-group-count">${cells.length}</span>
  `;
  wrap.appendChild(header);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'mn-group-grid';
  grid.dataset.groupId = group.id;

  // Master-detail: определяем master-ячейку
  const masterPreset = group.special === 'master-detail' || group.special === 'master-detail-right'
    ? PRESETS[group.special]
    : null;

  cells.forEach((item, idx2) => {
    if (item.kind === 'section') {
      const el = item.el;
      let col = item.cell.col;
      let row = item.cell.row;
      let colSpan = item.cell.colSpan || 1;
      let rowSpan = item.cell.rowSpan || 1;

      // Для master-detail: первая ячейка становится master
      if (masterPreset && idx2 === 0) {
        col = masterPreset.masterCol;
        row = masterPreset.masterRow;
        colSpan = masterPreset.masterColSpan;
        rowSpan = masterPreset.masterRowSpan;
      }

      el.style.setProperty('--grid-col', col);
      el.style.setProperty('--grid-row', row);
      el.style.setProperty('--grid-colspan', colSpan);
      el.style.setProperty('--grid-rowspan', rowSpan);
      el.dataset.sectionId = item.sectionId;
      el.dataset.gridCol = col;
      el.dataset.gridRow = row;
      grid.appendChild(el);
    } else {
      const sub = _renderGroup(item.group, sectionsMap, cfg, idx);
      if (sub) {
        sub.classList.add('mn-subgroup');
        grid.appendChild(sub);
      }
    }
  });

  wrap.appendChild(grid);
  return wrap;
}

function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ / ИМПОРТ
// ---------------------------------------------------------------------------
export function exportJSON() {
  return JSON.stringify(getConfig(), null, 2);
}

export function importJSON(json) {
  try {
    const cfg = typeof json === 'string' ? JSON.parse(json) : json;
    if (!cfg || typeof cfg !== 'object') throw new Error('Не объект');
    if (!Array.isArray(cfg.groups)) throw new Error('Нет поля groups');
    setConfig(cfg);
    save();
    return true;
  } catch (e) {
    console.warn('[Groups] import error:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ---------------------------------------------------------------------------
export default {
  PRESETS,
  DEFAULT_CONFIG,
  load, save, reset,
  getConfig, setConfig,
  listGroups, getGroup, addGroup, updateGroup, removeGroup,
  addSectionToGroup, removeSectionFromGroup,
  getGroupForSection, getSectionCell,
  buildTree, renderSections,
  exportJSON, importJSON,
  onChange,
  // индексы
  getIndex, getGroupByIdFast, getGroupIdForSection, isGrouped
};
