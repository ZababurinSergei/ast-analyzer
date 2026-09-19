// ============================================================================
// AST ANALYZER — LEGEND v1.0
// Компонент вывода легенды кодека в HTML Help.
//
// Публичный API:
//   Legend.getLegendData()              → нормализованная легенда
//   Legend.renderLegendHTML(opts?)      → HTML-строка
//   Legend.renderLegendModal(opts?)     → HTMLElement (модалка)
//   Legend.showLegendModal(opts?)       → открыть модалку
//   Legend.hideLegendModal()            → закрыть модалку
//   Legend.renderLegendInline(el, opts?)→ встроить в контейнер
//   Legend.buildLegendStyles()          → CSS-строка
//   Legend.LEGEND_STYLES                → CSS-константа
//
// Источник данных:
//   state.raw.legend          — из index.json (после decodeCompactData)
//   state.rawCompact.legend   — "сырая" легенда из компакта
//   state.__codec.legend      — сохранённая легенда в core
//
// Формат легенды (v13.0.2):
//   {
//     codes:   { export, import, call, reExport, lifecycle, effect,
//                injection, reactivity, conditional, typeKind, typeUsage },
//     flags:   { bits: { "1": "isAsync", "2": "isExported", ... } },
//     schemas: { mi: [...], fl: [...], fns: [...], cls: [...], cn: [...],
//                'gr.e': [...], 'gr.i': [...], 'gr.c': [...], 'gr.re': [...] }
//   }
//
// ============================================================================

import { state, escapeHtml, formatNumber } from './ast-analyzer-core.js';

// ---------------------------------------------------------------------------
// Стили
// ---------------------------------------------------------------------------
export const LEGEND_STYLES = `
.legend-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75);
  display: none; align-items: center; justify-content: center;
  z-index: 10000; backdrop-filter: blur(4px); padding: 20px;
}
.legend-overlay.show { display: flex; }

.legend-modal {
  background: var(--bg2, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 12px;
  width: 100%; max-width: 1100px; max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.7);
  overflow: hidden;
}

.legend-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border, #30363d);
  display: flex; align-items: center; gap: 12px;
  background: var(--bg3, #21262d);
  flex-shrink: 0;
}
.legend-header h3 {
  font-size: 15px; margin: 0; flex: 1;
  display: flex; align-items: center; gap: 8px;
}
.legend-header .version-badge {
  background: var(--accent, #58a6ff); color: #fff;
  padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 700;
}
.legend-header .mode-badge {
  background: var(--bg4, #30363d); color: var(--text2, #8b949e);
  padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 700;
  font-family: monospace;
}
.legend-close {
  background: none; border: none;
  color: var(--text2, #8b949e);
  font-size: 24px; cursor: pointer;
  padding: 0 8px; line-height: 1;
  transition: color 0.15s;
}
.legend-close:hover { color: var(--text, #e6edf3); }

.legend-tabs {
  display: flex; gap: 2px; padding: 0 12px;
  background: var(--bg3, #21262d);
  border-bottom: 1px solid var(--border, #30363d);
  overflow-x: auto; flex-shrink: 0;
}
.legend-tab {
  padding: 8px 14px; cursor: pointer;
  border: none; background: none;
  color: var(--text2, #8b949e);
  font-size: 12px; font-family: inherit;
  border-bottom: 2px solid transparent;
  white-space: nowrap; transition: all 0.15s;
}
.legend-tab:hover { color: var(--text, #e6edf3); }
.legend-tab.active {
  color: var(--accent, #58a6ff);
  border-bottom-color: var(--accent, #58a6ff);
}
.legend-tab .badge {
  display: inline-block; margin-left: 6px;
  background: var(--bg4, #30363d);
  color: var(--text2, #8b949e);
  font-size: 9px; padding: 1px 6px;
  border-radius: 8px;
}

.legend-body {
  padding: 20px; overflow-y: auto; flex: 1;
  font-size: 12px;
}

.legend-section {
  margin-bottom: 24px;
}
.legend-section h4 {
  font-size: 13px; margin: 0 0 10px 0;
  color: var(--accent, #58a6ff);
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border, #30363d);
}
.legend-section h4 .count {
  background: var(--bg3, #21262d);
  color: var(--text2, #8b949e);
  font-size: 10px; padding: 1px 8px;
  border-radius: 10px;
  font-weight: normal;
}

.legend-desc {
  color: var(--text2, #8b949e);
  font-size: 11px; margin-bottom: 12px;
  line-height: 1.5;
}
.legend-desc code {
  background: var(--bg3, #21262d);
  padding: 1px 6px; border-radius: 4px;
  font-family: 'Consolas', monospace;
  color: var(--accent, #58a6ff);
}

/* --- Схемы кортежей --- */
.schema-card {
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.schema-card-header {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 10px;
}
.schema-card-header .schema-key {
  font-family: 'Consolas', monospace;
  font-weight: 700; color: var(--green, #3fb950);
  font-size: 12px;
}
.schema-card-header .schema-len {
  color: var(--text2, #8b949e);
  font-size: 10px;
}
.schema-positions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 4px;
}
.schema-pos {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; background: var(--bg, #0d1117);
  border-radius: 4px; font-family: 'Consolas', monospace;
  font-size: 10px;
}
.schema-pos .pos-idx {
  background: var(--accent, #58a6ff);
  color: #fff; width: 18px; height: 18px;
  border-radius: 50%; display: flex;
  align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
  flex-shrink: 0;
}
.schema-pos .pos-name {
  color: var(--text, #e6edf3);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
.schema-pos .pos-type {
  color: var(--text2, #8b949e);
  font-size: 9px; margin-left: auto;
  flex-shrink: 0;
}

/* --- Таблицы кодов --- */
.codes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
.codes-card {
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  overflow: hidden;
}
.codes-card-header {
  padding: 8px 12px;
  background: var(--bg4, #30363d);
  font-size: 11px; font-weight: 600;
  display: flex; align-items: center; gap: 8px;
  font-family: 'Consolas', monospace;
  color: var(--purple, #bc8cff);
}
.codes-card-body {
  padding: 6px;
  max-height: 300px;
  overflow-y: auto;
}
.code-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 8px; border-radius: 4px;
  font-size: 11px;
}
.code-row:hover { background: var(--bg, #0d1117); }
.code-row .code-key {
  font-family: 'Consolas', monospace;
  font-weight: 700; color: var(--yellow, #d29922);
  min-width: 32px;
  flex-shrink: 0;
}
.code-row .code-val {
  color: var(--text, #e6edf3);
  overflow: hidden; text-overflow: ellipsis;
}

/* --- Флаги (битовые) --- */
.flags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px;
}
.flag-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 6px;
  font-size: 11px;
  transition: border-color 0.15s;
}
.flag-row:hover { border-color: var(--accent, #58a6ff); }
.flag-row .flag-bit {
  font-family: 'Consolas', monospace;
  background: var(--bg, #0d1117);
  color: var(--orange, #f0883e);
  padding: 2px 6px; border-radius: 4px;
  font-size: 9px; font-weight: 700;
  min-width: 40px; text-align: center;
  flex-shrink: 0;
}
.flag-row .flag-name {
  font-family: 'Consolas', monospace;
  color: var(--text, #e6edf3);
  font-size: 11px;
  overflow: hidden; text-overflow: ellipsis;
}

/* --- Словари --- */
.dict-tabs {
  display: flex; gap: 4px; margin-bottom: 10px;
  flex-wrap: wrap;
}
.dict-tab {
  padding: 4px 10px; cursor: pointer;
  border: 1px solid var(--border, #30363d);
  background: var(--bg3, #21262d);
  color: var(--text2, #8b949e);
  border-radius: 6px; font-size: 10px;
  font-family: inherit;
  transition: all 0.15s;
}
.dict-tab:hover { color: var(--text, #e6edf3); }
.dict-tab.active {
  background: var(--accent, #58a6ff);
  color: #fff; border-color: var(--accent, #58a6ff);
}
.dict-tab .count {
  margin-left: 6px; opacity: 0.7;
}
.dict-body {
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  padding: 8px;
  max-height: 400px;
  overflow-y: auto;
}
.dict-row {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 4px 8px; border-radius: 4px;
  font-size: 11px;
  border-bottom: 1px solid var(--border, #30363d);
}
.dict-row:last-child { border-bottom: none; }
.dict-row:hover { background: var(--bg, #0d1117); }
.dict-row .dict-idx {
  font-family: 'Consolas', monospace;
  color: var(--text2, #8b949e);
  font-size: 9px;
  min-width: 36px;
  flex-shrink: 0;
  padding-top: 2px;
}
.dict-row .dict-val {
  font-family: 'Consolas', monospace;
  color: var(--text, #e6edf3);
  word-break: break-all;
  flex: 1;
}
.dict-empty {
  color: var(--text2, #8b949e);
  padding: 20px;
  text-align: center;
  font-style: italic;
}

/* --- Статистика --- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.stat-cell {
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}
.stat-cell .stat-num {
  font-size: 18px; font-weight: 700;
  color: var(--accent, #58a6ff);
  font-family: 'Consolas', monospace;
}
.stat-cell .stat-lbl {
  font-size: 10px; color: var(--text2, #8b949e);
  margin-top: 4px;
}

/* --- Общая инфо-карточка --- */
.legend-info {
  display: flex; gap: 12px; flex-wrap: wrap;
  padding: 12px 14px;
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  margin-bottom: 16px;
}
.legend-info-item {
  display: flex; flex-direction: column; gap: 2px;
}
.legend-info-item .lbl {
  font-size: 9px; color: var(--text2, #8b949e);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.legend-info-item .val {
  font-size: 12px; color: var(--text, #e6edf3);
  font-family: 'Consolas', monospace;
}
`;

// ---------------------------------------------------------------------------
// Нормализация данных легенды
// ---------------------------------------------------------------------------

/**
 * Извлекает "сырую" легенду из state.
 *
 * Приоритет:
 *   1. state.rawCompact.legend  — "сырая" легенда из компакта
 *   2. state.raw.legend         — легенда после decode
 *   3. state.__codec.legend     — сохранённая легенда
 *   4. null
 */
function pickRawLegend() {
  if (state.rawCompact?.legend) return state.rawCompact.legend;
  if (state.raw?.legend) return state.raw.legend;
  if (state.__codec?.legend) return state.__codec.legend;
  return null;
}

/**
 * Нормализует легенду в единый формат.
 *
 * @returns {object} нормализованная легенда
 */
export function getLegendData() {
  const raw = pickRawLegend();
  const statistics = state.raw?.statistics || state.statistics || {};

  // Словари из state (могут быть на верхнем уровне или в legend)
  const stringDict =
    state.__codec?.stringDict ||
    raw?.dictionaries?.stringDict ||
    state.raw?.legend?.dictionaries?.stringDict ||
    [];

  const paramDict =
    state.__codec?.paramDict ||
    raw?.dictionaries?.paramDict ||
    state.raw?.legend?.dictionaries?.paramDict ||
    [];

  const methodDict =
    state.__codec?.methodDict ||
    raw?.dictionaries?.methodDict ||
    state.raw?.legend?.dictionaries?.methodDict ||
    [];

  const valueDict =
    state.__codec?.valueDict ||
    raw?.dictionaries?.valueDict ||
    state.raw?.legend?.dictionaries?.valueDict ||
    [];

  // Codes
  const codes = raw?.codes || {};

  // Flags
  let flags = { bits: {} };
  if (raw?.flags?.bits) {
    flags.bits = raw.flags.bits;
  } else if (Array.isArray(raw?.flags?.bits)) {
    for (const f of raw.flags.bits) {
      if (f && f.bit != null && f.name) {
        flags.bits[String(f.bit)] = f.name;
      }
    }
  }

  // Schemas
  const schemas = raw?.schemas || {};

  // Version / timestamp
  const version = state.rawCompact?.v || state.raw?.version || state.version || '?';

  const timestamp = state.rawCompact?.ts || state.raw?.timestamp || state.timestamp || '';

  const valuesMode =
    state.rawCompact?.valuesMode || state.raw?.valuesMode || state.valuesMode || 'relations';

  return {
    version,
    timestamp,
    statistics,
    dictionaries: { stringDict, paramDict, methodDict, valueDict },
    codes,
    flags,
    schemas,
    valuesMode,
    hasData: !!(raw && (Object.keys(codes).length || Object.keys(flags.bits).length)),
  };
}

// ---------------------------------------------------------------------------
// Рендер: отдельные секции
// ---------------------------------------------------------------------------

/**
 * Рендерит карточку с общей информацией (версия, timestamp, valuesMode, статистика).
 */
function renderInfoCard(data) {
  const stat = data.statistics || {};
  const items = [
    ['Версия кодека', data.version],
    ['Timestamp', data.timestamp || '—'],
    ['Values mode', data.valuesMode],
    ['Модулей', formatNumber(stat.totalModules || 0)],
    ['Файлов', formatNumber(stat.totalFiles || 0)],
    ['Функций', formatNumber(stat.totalFunctions || 0)],
    ['Классов', formatNumber(stat.totalClasses || 0)],
    ['Констант', formatNumber(stat.totalConstants || 0)],
    ['Экспортов', formatNumber(stat.totalExports || 0)],
    ['Импортов', formatNumber(stat.totalImports || 0)],
    ['Вызовов', formatNumber(stat.totalCalls || 0)],
    ['Реэкспортов', formatNumber(stat.totalReExports || 0)],
  ];

  return `
    <div class="legend-info">
      ${items
        .map(
          ([lbl, val]) => `
        <div class="legend-info-item">
          <span class="lbl">${escapeHtml(lbl)}</span>
          <span class="val">${escapeHtml(String(val))}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Рендерит схему кортежа.
 */
function renderSchemaCard(key, positions) {
  if (!Array.isArray(positions)) return '';

  const knownTypes = {
    n: 'stringIdx',
    nameIdx: 'stringIdx',
    m: 'moduleIdx',
    f: 'fileIdx',
    l: 'line',
    fl: 'flags',
    p: 'paramsIdx',
    rt: 'returnTypeIdx',
    ty: 'typeCode',
    en: 'exportNameIdx',
    ln: 'localNameIdx',
    s: 'sourceIdx',
    ff: 'fromFileIdx',
    tf: 'toFileIdx',
    im: 'importedNameIdx',
    fn: 'funcIdx',
    flags: 'bitmask',
    methods: 'methodsIdx',
    nonEmptyV: '[constIdx, valueIdx]',
    complexity: 'number',
    fileIdx: 'fileIdx',
    moduleIdx: 'moduleIdx',
    funcIdx: 'funcIdx',
  };

  return `
    <div class="schema-card">
      <div class="schema-card-header">
        <span class="schema-key">${escapeHtml(key)}</span>
        <span class="schema-len">${positions.length} полей</span>
      </div>
      <div class="schema-positions">
        ${positions
          .map((pos, i) => {
            const type = knownTypes[pos] || '';
            return `
            <div class="schema-pos">
              <span class="pos-idx">${i}</span>
              <span class="pos-name">${escapeHtml(pos)}</span>
              ${type ? `<span class="pos-type">${escapeHtml(type)}</span>` : ''}
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}

/**
 * Рендерит секцию схем.
 */
function renderSchemasSection(data) {
  const schemas = data.schemas || {};
  const keys = Object.keys(schemas);

  if (keys.length === 0) {
    return `
      <div class="legend-section">
        <h4>📐 Схемы кортежей <span class="count">0</span></h4>
        <div class="dict-empty">Схемы не найдены в легенде</div>
      </div>
    `;
  }

  const coreKeys = ['mi', 'fl', 'fns', 'cls', 'cn'];
  const graphKeys = keys.filter(k => k.startsWith('gr.'));
  const otherKeys = keys.filter(k => !coreKeys.includes(k) && !k.startsWith('gr.'));

  const renderGroup = (title, groupKeys) => {
    if (groupKeys.length === 0) return '';
    return `
      <div style="margin-bottom: 16px;">
        <div class="legend-desc">${title}</div>
        ${groupKeys.map(k => renderSchemaCard(k, schemas[k])).join('')}
      </div>
    `;
  };

  return `
    <div class="legend-section">
      <h4>📐 Схемы кортежей <span class="count">${keys.length}</span></h4>
      <div class="legend-desc">
        Columnar-структура: каждый ключ — это объект с параллельными массивами.
        Позиция в массиве = индекс сущности. ID восстанавливаются из позиции:
        <code>m1</code>, <code>f1</code>, <code>fn1</code>, <code>cls1</code>, <code>cn1</code>.
      </div>
      ${renderGroup('Ядро (модули, файлы, сущности):', coreKeys)}
      ${renderGroup('Граф связей (gr.*):', graphKeys)}
      ${renderGroup('Остальные:', otherKeys)}
    </div>
  `;
}

/**
 * Рендерит секцию кодов.
 */
function renderCodesSection(data) {
  const codes = data.codes || {};
  const groups = [
    ['export', '📤 Экспорты', 'gr.e.ty'],
    ['import', '📥 Импорты', 'gr.i.ty'],
    ['call', '📞 Вызовы', 'gr.c.ty'],
    ['reExport', '🔄 Реэкспорты', 'gr.re.ty'],
    ['lifecycle', '🧬 Lifecycle', 'lc'],
    ['effect', '⚡ Effects', 'ef'],
    ['injection', '💉 Injections', 'inj'],
    ['reactivity', '🔄 Reactivity', 'rx'],
    ['conditional', '🎯 Conditionals', 'cd'],
    ['typeKind', '📐 Type Kinds', 'ty'],
    ['typeUsage', '🔗 Type Usage', 'tr'],
  ];

  const present = groups.filter(([key]) => codes[key] && Object.keys(codes[key]).length > 0);

  if (present.length === 0) {
    return `
      <div class="legend-section">
        <h4>🔢 Коды <span class="count">0</span></h4>
        <div class="dict-empty">Коды не найдены в легенде</div>
      </div>
    `;
  }

  return `
    <div class="legend-section">
      <h4>🔢 Коды <span class="count">${present.length}</span></h4>
      <div class="legend-desc">
        Числовые коды в компактных секциях.
        Например: <code>gr.e.ty = 0</code> → <code>named</code>, <code>1</code> → <code>default</code>,
        <code>2</code> → <code>type</code>.
      </div>
      <div class="codes-grid">
        ${present
          .map(([key, label, compactKey]) => {
            const dict = codes[key];
            const entries = Object.entries(dict);
            return `
            <div class="codes-card">
              <div class="codes-card-header">
                <span>${label}</span>
                <span class="count" style="margin-left:auto;color:var(--text2);font-weight:normal;font-size:9px;">
                  ${escapeHtml(compactKey)}
                </span>
              </div>
              <div class="codes-card-body">
                ${entries
                  .map(
                    ([code, desc]) => `
                  <div class="code-row">
                    <span class="code-key">${escapeHtml(code)}</span>
                    <span class="code-val">${escapeHtml(String(desc))}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}

/**
 * Рендерит секцию флагов.
 */
function renderFlagsSection(data) {
  const bits = data.flags?.bits || {};
  const entries = Object.entries(bits).sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));

  if (entries.length === 0) {
    return `
      <div class="legend-section">
        <h4>🚩 Битовые флаги <span class="count">0</span></h4>
        <div class="dict-empty">Флаги не найдены в легенде</div>
      </div>
    `;
  }

  return `
    <div class="legend-section">
      <h4>🚩 Битовые флаги <span class="count">${entries.length}</span></h4>
      <div class="legend-desc">
        Флаги функций кодируются ЧИСЛОМ (битовая маска).
        Чтобы разобрать число <code>fns.fl[i]</code>, проверяйте биты:
        <code>num & 1</code> → isAsync, <code>num & 2</code> → isExported, и т.д.
      </div>
      <div class="flags-grid">
        ${entries
          .map(
            ([bit, name]) => `
          <div class="flag-row">
            <span class="flag-bit">${escapeHtml(bit)}</span>
            <span class="flag-name">${escapeHtml(String(name))}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

/**
 * Рендерит секцию словарей.
 */
function renderDictionariesSection(data) {
  const dicts = data.dictionaries || {};
  const groups = [
    ['stringDict', '📝 stringDict', 'строки (имена, пути, типы)'],
    ['paramDict', '📋 paramDict', 'параметры функций'],
    ['methodDict', '🔧 methodDict', 'имена методов классов'],
    ['valueDict', '💎 valueDict', 'значения констант'],
  ];

  const present = groups.filter(([key]) => Array.isArray(dicts[key]) && dicts[key].length > 0);

  if (present.length === 0) {
    return `
      <div class="legend-section">
        <h4>📚 Словари <span class="count">0</span></h4>
        <div class="dict-empty">Словари не найдены в легенде</div>
      </div>
    `;
  }

  const tabsHtml = present
    .map(
      ([key, label], i) => `
    <button class="dict-tab ${i === 0 ? 'active' : ''}" data-dict-tab="${key}">
      ${label}
      <span class="count">${dicts[key].length}</span>
    </button>
  `
    )
    .join('');

  const bodiesHtml = present
    .map(
      ([key], i) => `
    <div class="dict-body" data-dict-body="${key}" style="${i === 0 ? '' : 'display:none'}">
      ${dicts[key]
        .map(
          (val, idx) => `
        <div class="dict-row">
          <span class="dict-idx">[${idx}]</span>
          <span class="dict-val">${escapeHtml(formatDictValue(val))}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `
    )
    .join('');

  return `
    <div class="legend-section">
      <h4>📚 Словари <span class="count">${present.length}</span></h4>
      <div class="legend-desc">
        Словари значений. В компактном формате к ним обращаются по индексу:
        <code>strs[i]</code> → строка, <code>params[i]</code> → параметр, и т.д.
        Значения могут быть токенизированы: массив индексов
        <code>[0, 1, 2]</code> означает склейку <code>tokens[0] + tokens[1] + tokens[2]</code>.
      </div>
      <div class="dict-tabs">${tabsHtml}</div>
      ${bodiesHtml}
    </div>
  `;
}

/**
 * Форматирует значение словаря для отображения.
 */
function formatDictValue(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    // Возможно, это токенизированная строка
    if (val.length > 0 && val.every(x => typeof x === 'number')) {
      return `🔤 tokens[${val.join(', ')}]`;
    }
    return JSON.stringify(val);
  }
  if (typeof val === 'object') {
    try {
      const s = JSON.stringify(val);
      return s.length > 200 ? s.slice(0, 200) + '…' : s;
    } catch {
      return '[object]';
    }
  }
  return String(val);
}

/**
 * Рендерит секцию статистики.
 */
function renderStatsSection(data) {
  const stat = data.statistics || {};
  const items = [
    ['📦 Модулей', stat.totalModules || 0],
    ['📄 Файлов', stat.totalFiles || 0],
    ['ƒ Функций', stat.totalFunctions || 0],
    ['🏛 Классов', stat.totalClasses || 0],
    ['📌 Констант', stat.totalConstants || 0],
    ['📤 Экспортов', stat.totalExports || 0],
    ['📥 Импортов', stat.totalImports || 0],
    ['📞 Вызовов', stat.totalCalls || 0],
    ['🔄 Реэкспортов', stat.totalReExports || 0],
    ['🎨 Шаблонов', stat.totalTemplates || 0],
  ];

  return `
    <div class="legend-section">
      <h4>📊 Статистика проекта <span class="count">${items.length}</span></h4>
      <div class="stats-grid">
        ${items
          .map(
            ([lbl, num]) => `
          <div class="stat-cell">
            <div class="stat-num">${formatNumber(num)}</div>
            <div class="stat-lbl">${escapeHtml(lbl)}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Публичный рендер
// ---------------------------------------------------------------------------

/**
 * Рендерит всю легенду как HTML-строку.
 *
 * @param {object} [opts]
 * @param {string} [opts.tab='all'] — 'all' | 'schemas' | 'codes' | 'flags' | 'dicts' | 'stats'
 * @returns {string}
 */
export function renderLegendHTML(opts = {}) {
  const data = getLegendData();

  if (!data.hasData && data.dictionaries.stringDict.length === 0) {
    return `
      <div class="legend-section">
        <div class="dict-empty">
          Легенда не найдена. Загрузите <code>index.json</code> с полем <code>legend</code>.
        </div>
      </div>
    `;
  }

  const sections = [
    renderInfoCard(data),
    renderSchemasSection(data),
    renderCodesSection(data),
    renderFlagsSection(data),
    renderDictionariesSection(data),
    renderStatsSection(data),
  ];

  return sections.join('');
}

/**
 * Рендерит модальное окно с легендой.
 *
 * @param {object} [opts]
 * @param {string} [opts.title='Легенда кодека']
 * @returns {HTMLElement}
 */
export function renderLegendModal(opts = {}) {
  const data = getLegendData();
  const title = opts.title || 'Легенда кодека';

  // Удаляем предыдущую модалку
  const existing = document.getElementById('astLegendModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'legend-overlay';
  overlay.id = 'astLegendModal';

  overlay.innerHTML = `
    <div class="legend-modal">
      <div class="legend-header">
        <h3>
          📖 ${escapeHtml(title)}
          <span class="version-badge">v${escapeHtml(data.version)}</span>
          <span class="mode-badge">${escapeHtml(data.valuesMode)}</span>
        </h3>
        <button class="legend-close" id="legendClose" title="Закрыть (Esc)">×</button>
      </div>
      <div class="legend-tabs" id="legendTabs">
        <button class="legend-tab active" data-tab="all">📋 Всё</button>
        <button class="legend-tab" data-tab="schemas">📐 Схемы</button>
        <button class="legend-tab" data-tab="codes">🔢 Коды</button>
        <button class="legend-tab" data-tab="flags">🚩 Флаги</button>
        <button class="legend-tab" data-tab="dicts">📚 Словари</button>
        <button class="legend-tab" data-tab="stats">📊 Статистика</button>
      </div>
      <div class="legend-body" id="legendBody"></div>
    </div>
  `;

  // Инжектим стили один раз
  if (!document.getElementById('astLegendStyles')) {
    const style = document.createElement('style');
    style.id = 'astLegendStyles';
    style.textContent = LEGEND_STYLES;
    document.head.appendChild(style);
  }

  return overlay;
}

/**
 * Открывает модалку с легендой.
 */
export function showLegendModal(opts = {}) {
  const modal = renderLegendModal(opts);
  document.body.appendChild(modal);

  const body = modal.querySelector('#legendBody');
  const data = getLegendData();

  const renderTab = tab => {
    if (tab === 'all') {
      body.innerHTML = renderLegendHTML();
    } else if (tab === 'schemas') {
      body.innerHTML = renderSchemasSection(data);
    } else if (tab === 'codes') {
      body.innerHTML = renderCodesSection(data);
    } else if (tab === 'flags') {
      body.innerHTML = renderFlagsSection(data);
    } else if (tab === 'dicts') {
      body.innerHTML = renderDictionariesSection(data);
      bindDictTabs(body);
    } else if (tab === 'stats') {
      body.innerHTML = renderStatsSection(data);
    }
  };

  renderTab('all');
  bindDictTabs(body);

  // Табы
  modal.querySelector('#legendTabs').addEventListener('click', e => {
    const tab = e.target.closest('.legend-tab');
    if (!tab) return;
    modal.querySelectorAll('.legend-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderTab(tab.dataset.tab);
  });

  // Закрытие
  const close = () => hideLegendModal();
  modal.querySelector('#legendClose').addEventListener('click', close);
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });
  const escHandler = e => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Показываем
  requestAnimationFrame(() => modal.classList.add('show'));
}

/**
 * Закрывает модалку.
 */
export function hideLegendModal() {
  const modal = document.getElementById('astLegendModal');
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => modal.remove(), 200);
}

/**
 * Привязывает переключение табов словарей.
 */
function bindDictTabs(root) {
  const tabs = root.querySelectorAll('[data-dict-tab]');
  const bodies = root.querySelectorAll('[data-dict-body]');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      bodies.forEach(b => {
        b.style.display = b.dataset.dictBody === tab.dataset.dictTab ? '' : 'none';
      });
    });
  });
}

/**
 * Встраивает легенду в указанный контейнер.
 */
export function renderLegendInline(container, opts = {}) {
  if (!container) return;
  container.innerHTML = renderLegendHTML(opts);
  bindDictTabs(container);
}

/**
 * Возвращает CSS-строку (для инжекта в <style>).
 */
export function buildLegendStyles() {
  return LEGEND_STYLES;
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------

export default {
  getLegendData,
  renderLegendHTML,
  renderLegendModal,
  showLegendModal,
  hideLegendModal,
  renderLegendInline,
  buildLegendStyles,
  LEGEND_STYLES,
};
