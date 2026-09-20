// ============================================================================
// AST ANALYZER — MAIN v13.0.5
// Только новый формат. Обратная совместимость не поддерживается.
//
// Особенности:
//   - Хлебные крошки с последовательностями путей
//   - Панели «Пути ДО» / «Пути ОТ» для функций и файлов
//   - Кнопка «Легенда» + F1
//   - Round-Trip L0/L1/L2/L3/RE
//   - valuesMode в шапке и при экспорте
//   - VS Code ссылки (basePath, форма настройки, бейджи)
//   - Мини-навигация по секциям — через кнопку 🧭 в location bar
//   - Адресная строка как в браузере (◀ ▶ ⟳ ⌂ + autocomplete)
//
// v13.0.4:
//   - import * as Extensions — реестр кнопок-расширений в location bar
//   - import * as Nav — мини-навигация по секциям через Nav.createPanel()
//   - УДАЛЁН вызов Nav.mount({ position: 'top-right', offset: 16 })
//   - В init() регистрируется расширение 'nav' (🧭)
//
// v13.0.5 (ТЕКУЩАЯ):
//   - ✅ Full-page секции внутри #mn: каждая секция = высота #mn
//   - ✅ Скролл колесом/тачпадом переключает секции через scroll-snap
//   - ✅ scroll-snap-type: y mandatory + scroll-snap-stop: always
//   - ✅ Внутри секции — свой скролл (.es-b)
//   - ✅ Графы растягиваются на всю высоту секции
//   - ✅ Активная секция подсвечивается в навигации (🧭)
//   - ✅ window.__astActiveSectionId — глобальная переменная активной секции
//   - ✅ Подсветка синхронизируется через scroll-слушатель на .mn-sections
// ============================================================================

import * as Core from './ast-analyzer-core.js';
import * as UI from './ast-analyzer-ui.js';
import * as Graph from './ast-analyzer-graph.js';
import * as Tree from './ast-analyzer-tree.js';
import * as Legend from './ast-analyzer-legend.js';
import * as Paths from './ast-analyzer-paths.js';
import * as Vscode from './ast-analyzer-vscode.js';
import * as Extensions from './ast-analyzer-extensions.js';
import * as Nav from './ast-analyzer-nav.js';
import * as LocationBar from './ast-analyzer-location-bar.js';
import {
  roundTripSemantic,
  roundTripByteExact,
  roundTripEncode,
  deepEqual,
  diffObjects,
  stripServiceFields,
  stripForByteCompare,
} from './ast-analyzer-codec.js';

const $ = id => document.getElementById(id);
const state = Core.state;

let activeFnId = null;
let activeFileId = null;

// ---------------------------------------------------------------------------
// ГЛОБАЛЬНЫЙ ТОСТ (для формы basePath в ast-analyzer-vscode.js)
// ---------------------------------------------------------------------------
window.__astToast = (msg, type = 'info') => UI.toast(msg, type);

// ---------------------------------------------------------------------------
// АКТИВНАЯ СЕКЦИЯ (для навигации 🧭)
// ---------------------------------------------------------------------------
window.__astActiveSectionId = null;

/**
 * Навешивает scroll-слушатель на .mn-sections, чтобы отслеживать
 * активную секцию (по scrollTop) и подсвечивать её в панели навигации.
 *
 * Вызывается после каждого renderFn() / renderFile(), т.к. .mn-sections
 * пересоздаётся при innerHTML = ...
 */
function bindSectionsScrollTracking() {
  const mnSections = document.querySelector('.mn-sections');
  if (!mnSections) return;

  mnSections.addEventListener(
    'scroll',
    () => {
      const h = mnSections.clientHeight || 1;
      const idx = Math.round(mnSections.scrollTop / h);
      const secs = mnSections.querySelectorAll('[data-nav-section]');
      const active = secs[idx];
      if (!active) return;

      const id = active.dataset.navSection;
      window.__astActiveSectionId = id;

      // Подсветка в открытой панели навигации (если она открыта)
      document
        .querySelectorAll('.ast-nav-panel .ast-nav-item')
        .forEach(it => {
          it.classList.toggle('active', it.dataset.navTarget === id);
        });
    },
    { passive: true }
  );

  // Инициализируем активную секцию сразу
  const first = mnSections.querySelector('[data-nav-section]');
  if (first) {
    window.__astActiveSectionId = first.dataset.navSection;
  }
}

// ---------------------------------------------------------------------------
// СТИЛИ ДЛЯ ПУТЕЙ (инжектятся в init)
// ---------------------------------------------------------------------------
export const PATHS_STYLES = `
.paths-list { font-size: 11px; }
.paths-count {
  color: var(--text2, #8b949e);
  font-size: 10px;
  margin-bottom: 6px;
  padding: 0 4px;
}
.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 5px;
  margin-bottom: 3px;
  background: var(--bg3, #21262d);
  transition: background 0.15s;
}
.path-row:hover { background: var(--bg4, #30363d); }
.path-idx {
  color: var(--text2, #8b949e);
  font-size: 9px;
  min-width: 24px;
  flex-shrink: 0;
  font-family: monospace;
}
.path-chain {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
}
.path-node {
  padding: 2px 8px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 10px;
  color: var(--text, #e6edf3);
  cursor: pointer;
  transition: all 0.15s;
}
.path-node:hover {
  border-color: var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}
.path-arrow {
  color: var(--text2, #8b949e);
  font-size: 10px;
}
`;

// ---------------------------------------------------------------------------
// СТИЛИ FULL-PAGE СЕКЦИЙ (инжектятся в init)
// ---------------------------------------------------------------------------
export const MN_SECTIONS_STYLES = `
.mn {
  flex: 1;
  overflow: hidden;
  padding: 0;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mn-sections {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
}
.mn-sections::-webkit-scrollbar { display: none; }

.mn-sections > .es,
.mn-sections > .n-card-wrap {
  flex: 0 0 100%;
  height: 100%;
  min-height: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.mn-sections > .es > .es-h {
  flex-shrink: 0;
}

.mn-sections > .es > .es-b {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
  box-sizing: border-box;
  max-height: none;
}

.mn-sections > .es > .es-b > .graph-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  overflow: hidden;
}
.mn-sections > .es > .es-b > .graph-wrap > .graph-svg {
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

/* Grid-секции (Входы/Выходы и т.д.) — становятся обычным потоком */
.mn-sections > .eg {
  display: block;
  flex: 0 0 100%;
  height: 100%;
  min-height: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  overflow: hidden;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

/* Для .es внутри .eg-секций, которые мы выносим как отдельные секции */
.eg-fragment {
  display: contents;
}
`;

// ---------------------------------------------------------------------------
// СТАТУС
// ---------------------------------------------------------------------------
function setStatus(text, kind = 'ok') {
  const el = $('cacheStatus');
  const dot = $('cacheDot');
  el.classList.remove('hidden');
  dot.className = 'dot' + (kind === 'ok' ? '' : ' ' + kind);
  $('cacheText').textContent = text;
}

function hideStatus(delay = 1500) {
  setTimeout(() => $('cacheStatus').classList.add('hidden'), delay);
}

// ---------------------------------------------------------------------------
// АВТОЗАГРУЗКА
// ---------------------------------------------------------------------------
async function autoLoad() {
  setStatus('Загрузка index.json из корня…');
  try {
    await Core.loadFromRoot({
      basePath: '',
      candidates: ['index.json', 'index.full.json'],
      useCache: true,
      cacheTTL: 3600_000,
      fallbackToFilePicker: false,
      silent: false,
    });

    setStatus('✓ Загружено автоматически');
    hideStatus(1200);
    init();
  } catch (e) {
    console.warn('[AST] Автозагрузка не удалась:', e.message);
    setStatus('Автозагрузка не удалась, выберите файл', 'warn');
    UI.toast?.('Автозагрузка не удалась. Выберите файл вручную.', 'error');
  }
}

// ---------------------------------------------------------------------------
// РУЧНАЯ ЗАГРУЗКА
// ---------------------------------------------------------------------------
function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const json = JSON.parse(ev.target.result);
      Core.loadData(json);
      setStatus(`✓ Загружено: ${file.name}`);
      hideStatus(1500);
      init();
    } catch (err) {
      console.error(err);
      UI.toast('Ошибка: ' + err.message, 'error');
      setStatus('Ошибка загрузки', 'error');
    }
  };
  reader.readAsText(file);
}

// ---------------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ---------------------------------------------------------------------------
function init() {
  $('dropZone').style.display = 'none';
  $('app').style.display = 'flex';
  $('btnExportCompact').disabled = false;
  $('btnExportFull').disabled = false;
  $('btnRoundTrip').disabled = false;
  const btnLegend = $('btnLegend');
  if (btnLegend) btnLegend.disabled = false;

  // --- VS Code кнопка ---
  const btnVscode = $('btnVscodeSetup');
  if (btnVscode) {
    btnVscode.disabled = false;
    btnVscode.addEventListener('click', () => {
      Vscode.showBasePathModal({
        onChange: cfg => {
          UI.toast(
            cfg.basePath ? `basePath: ${cfg.basePath}` : 'basePath очищен',
            cfg.basePath ? 'success' : 'warn'
          );
          renderHeader();
          LocationBar.setUniverse(cfg.basePath);
          if (activeFnId) renderFn(activeFnId);
          else if (activeFileId) renderFile(activeFileId);
        },
      });
    });
  }

  // --- Инжект стилей ---
  if (!document.getElementById('fs-tree-styles')) {
    const style = document.createElement('style');
    style.id = 'fs-tree-styles';
    style.textContent = Tree.TREE_STYLES;
    document.head.appendChild(style);
  }
  if (!document.getElementById('ast-legend-styles')) {
    const style = document.createElement('style');
    style.id = 'ast-legend-styles';
    style.textContent = Legend.LEGEND_STYLES;
    document.head.appendChild(style);
  }
  if (!document.getElementById('ast-paths-styles')) {
    const style = document.createElement('style');
    style.id = 'ast-paths-styles';
    style.textContent = PATHS_STYLES;
    document.head.appendChild(style);
  }
  if (!document.getElementById('ast-mn-sections-styles')) {
    const style = document.createElement('style');
    style.id = 'ast-mn-sections-styles';
    style.textContent = MN_SECTIONS_STYLES;
    document.head.appendChild(style);
  }
  if (!document.getElementById('ast-vscode-styles')) {
    const style = document.createElement('style');
    style.id = 'ast-vscode-styles';
    style.textContent = Vscode.buildVscodeStyles();
    document.head.appendChild(style);
  }
  if (!document.getElementById('ast-vscode-form-styles')) {
    const style = document.createElement('style');
    style.id = 'ast-vscode-form-styles';
    style.textContent = Vscode.buildVscodeFormStyles();
    document.head.appendChild(style);
  }
  if (!document.getElementById('ast-ext-styles')) {
    const style = document.createElement('style');
    style.id = 'ast-ext-styles';
    style.textContent = Extensions.buildStyles();
    document.head.appendChild(style);
  }
  if (!document.getElementById('ast-location-styles')) {
    const style = document.createElement('style');
    style.id = 'ast-location-styles';
    style.textContent = LocationBar.buildStyles();
    document.head.appendChild(style);
  }

  // --- Автоопределение basePath (только при первом запуске) ---
  const cfg = Vscode.getVscodeConfig();
  if (!cfg.basePath) {
    const detected = Vscode.detectBasePath();
    if (detected) {
      Vscode.setVscodeConfigPersistent({ basePath: detected });
      console.log('[VSCode] basePath определён автоматически:', detected);
    }
  }

  // --- Шапка ---
  renderHeader();

  // --- Дерево ---
  renderTree();

  const si = $('si');
  if (si) {
    si.addEventListener(
      'input',
      Core.debounce(() => renderTree(), 150)
    );
  }

  // --- Адресная строка (как в браузере) ---
  LocationBar.mount({
    container:
      document.getElementById('locationBarContainer') || document.body,
    onChange: entry => {
      if (entry.kind === 'fn' && state.fnById[entry.id]) {
        activeFnId = entry.id;
        activeFileId = null;
        renderTree();
        renderFn(entry.id);
      } else if (entry.kind === 'file' && state.files[entry.id]) {
        activeFnId = null;
        activeFileId = entry.id;
        renderTree();
        renderFile(entry.id);
      } else if (entry.kind === 'module') {
        const firstFile = (state.moduleFiles[entry.id] || [])[0];
        if (firstFile) {
          activeFnId = null;
          activeFileId = firstFile;
          renderTree();
          renderFile(firstFile);
        }
      } else if (entry.kind === 'universe') {
        const firstFile = Object.keys(state.files)[0];
        if (firstFile) {
          activeFnId = null;
          activeFileId = firstFile;
          renderTree();
          renderFile(firstFile);
        }
      }
    },
  });

  // --- Панель расширений в location bar ---
  const extSlot = LocationBar.getExtensionsSlot
    ? LocationBar.getExtensionsSlot()
    : null;

  if (extSlot) {
    Extensions.register({
      id: 'nav',
      icon: '🧭',
      title: 'Навигация по секциям',
      order: 100,
      panel: ({ close }) => {
        return Nav.createPanel({
          onJump: sectionId => {
            const el =
              document.querySelector(
                `[data-nav-section="${sectionId}"]`
              ) || document.getElementById(sectionId);
            if (el) {
              el.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }
            close();
          },
        });
      },
      onClose: () => {
        try {
          Nav.unmount?.();
        } catch {}
      },
    });

    Extensions.renderInto(extSlot);
  } else {
    console.warn(
      '[AST] LocationBar.getExtensionsSlot() недоступен — ' +
      'мини-навигация не будет примонтирована в location bar.'
    );
  }

  // --- Первый экран ---
  if (state.functions && Object.keys(state.functions).length) {
    const firstFn = Object.values(state.functions)[0];
    selectFn(firstFn.id);
  }
}

// ---------------------------------------------------------------------------
// ШАПКА
// ---------------------------------------------------------------------------
function renderHeader() {
  const s = Core.getProjectStats();
  const fmt = state.originalFormat || '?';
  const vscodeCfg = Vscode.getVscodeConfig();

  const basePathChip = vscodeCfg.basePath
    ? `<span
         class="chip blue basepath-chip"
         data-action="copy-basepath"
         data-id="${Core.escapeHtml(vscodeCfg.basePath)}"
         title="basePath: ${Core.escapeHtml(vscodeCfg.basePath)}
Клик — скопировать"
         style="cursor:pointer;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle;"
       >🔗 ${Core.escapeHtml(
      Core.middleEllipsis(vscodeCfg.basePath, 40)
    )}</span>`
    : `<span class="chip" title="basePath не задан — ссылки VS Code работать не будут">🔗 (не задан)</span>`;

  $('sm').innerHTML = `
    <span title="Формат входа">📥 <b>${fmt}</b></span>
    <span title="valuesMode">⚙️ <b>${s.valuesMode}</b></span>
    <span>📦 <b>${s.totalModules}</b></span>
    <span>📄 <b>${s.totalFiles}</b></span>
    <span>ƒ <b>${s.totalFunctions}</b></span>
    <span>📞 <b>${s.totalCalls}</b></span>
    <span>🔗 <b>${s.totalImports}</b></span>
    <span>📤 <b>${s.totalExports}</b></span>
    <span>💀 <b>${s.deadExports + s.deadFunctions}</b></span>
    <span>🔄 <b>${s.cyclicDeps}</b></span>
    ${basePathChip}
  `;

  const hdr = document.querySelector('.hdr');
  if (hdr) {
    const h = hdr.classList.contains('hdr-hidden')
      ? 0
      : Math.ceil(hdr.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--hdr-height', h + 'px');
  }
}

// ---------------------------------------------------------------------------
// ДЕРЕВО
// ---------------------------------------------------------------------------
function renderTree() {
  const container = $('st');
  if (!container) return;
  const q = ($('si')?.value || '').trim();
  Tree.renderProjectTree(container, {
    query: q,
    expandAll: false,
    activeFnId,
    activeFileId,
    onSelectFile: fid => selectFile(fid),
    onSelectFn: fid => selectFn(fid),
  });
}

// ---------------------------------------------------------------------------
// ВЫБОР
// ---------------------------------------------------------------------------
function selectFn(id) {
  activeFnId = id;
  activeFileId = null;
  renderTree();
  renderFn(id);
  LocationBar.syncFromSelection('fn', id, { replace: true });
}

function selectFile(fid) {
  activeFnId = null;
  activeFileId = fid;
  renderTree();
  renderFile(fid);
  LocationBar.syncFromSelection('file', fid, { replace: true });
}

// ---------------------------------------------------------------------------
// РЕНДЕР ФУНКЦИИ
// ---------------------------------------------------------------------------
function renderFn(id) {
  const fn = state.fnById[id];
  if (!fn) return;
  const info = Core.getFnFullInfo(id);
  const file = info.file;
  const mod = info.module;
  const callers = info.callers;
  const callees = info.calls;
  const fImps = file ? state.fileImports[file.id] || [] : [];
  const fImporters = file ? state.fileDependents[file.id] || [] : [];
  const exps = info.exports;
  const sibs = file
    ? (state.fileFunctions[file.id] || []).filter(f => f.id !== id)
    : [];

  const bds = [];
  if (fn.isExported) bds.push('<span class="b e">export</span>');
  if (fn.isAsync) bds.push('<span class="b a">async</span>');
  if (fn.isMethod) bds.push('<span class="b m">method</span>');
  if (fn.isArrow) bds.push('<span class="b r">arrow</span>');

  const vscodeBadge = Vscode.renderVscodeBadge({
    fileId: fn.fileId,
    line: fn.line,
  });

  const h = [];

  // --- Карточка функции (отдельная full-page секция) ---
  h.push(`<div class="es" data-nav-section="fn-card" data-nav-label="${Core.escapeHtml(
    fn.name
  )}" style="text-align:center;">
    <div class="es-b" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div class="ctx" style="display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
        <span class="c">📦 ${Core.escapeHtml(mod?.name || '?')}</span>
        <span class="ar">→</span>
        <span class="c" data-action="select-file" data-id="${file?.id || ''}">📄 ${Core.escapeHtml(
    Core.shortPath(file?.path || '?', 60)
  )}</span>
        ${
    exps.length
      ? `<span class="ar">→</span><span class="c" style="border-color:var(--green);color:var(--green)">📤 ${Core.escapeHtml(
        exps[0].exportName
      )}</span>`
      : ''
  }
      </div>
      <div class="n-card">
        <div class="nm">ƒ ${Core.escapeHtml(fn.name)}</div>
        <div class="mt">
          <span>📍 L${fn.line || 0}</span>
          ${vscodeBadge}
          ${
    fn.params?.length
      ? `<span>(${Core.escapeHtml(fn.params.join(', '))})</span>`
      : ''
  }
          ${
    fn.returnType
      ? `<span>→ ${Core.escapeHtml(Core.formatType(fn.returnType))}</span>`
      : ''
  }
        </div>
        <div class="bd">${bds.join('')}</div>
      </div>
    </div>
  </div>`);

  // --- Пути ДО ---
  h.push(`<div class="es" data-nav-section="paths-to" data-nav-label="Пути ДО">
    <div class="es-h">🛤️ Пути ДО этой функции <span class="ct" id="pathsToCount">…</span></div>
    <div class="es-b" id="pathsToFnBody"></div>
  </div>`);

  // --- Пути ОТ ---
  h.push(`<div class="es" data-nav-section="paths-from" data-nav-label="Пути ОТ">
    <div class="es-h">🛤️ Пути ОТ этой функции <span class="ct" id="pathsFromCount">…</span></div>
    <div class="es-b" id="pathsFromFnBody"></div>
  </div>`);

  // --- Цепочка вызовов ---
  h.push(`<div class="es" data-nav-section="chain" data-nav-label="Цепочка вызовов">
    <div class="es-h">🔗 Цепочка вызовов</div>
    <div class="es-b" id="callChainBody"></div>
  </div>`);

  // --- Граф вызовов ---
  h.push(`<div class="es" data-nav-section="call-graph" data-nav-label="Граф вызовов">
    <div class="es-h">📞 Граф вызовов</div>
    <div class="es-b" id="callGraphBody"></div>
  </div>`);

  // --- Граф зависимостей файла ---
  if (file) {
    h.push(`<div class="es" data-nav-section="file-dep-graph" data-nav-label="Граф зависимостей">
      <div class="es-h">🔗 Граф зависимостей файла</div>
      <div class="es-b" id="fileDepGraphBody"></div>
    </div>`);
  }

  // --- Входы ---
  h.push(
    `<div class="es" data-nav-section="callers" data-nav-label="Входы">
      <div class="es-h">📥 Входы — кто вызывает <span class="ct">${callers.length}</span></div>
      <div class="es-b">`
  );
  if (callers.length) {
    for (const c of callers) {
      const callerFn = state.fnById[c.fromFnId];
      const vscodeIcon = callerFn
        ? Vscode.renderVscodeIcon({
          fileId: callerFn.fileId,
          line: c.callLine,
          label: '↗',
        })
        : '';
      h.push(`<div class="ei" data-action="select-fn" data-id="${c.fromFnId}">
        <span class="d" style="color:var(--green)">←</span>
        <span class="n">${Core.escapeHtml(c.fromFnName)}</span>
        <span class="inf">${Core.escapeHtml(c.callType)}·L${c.callLine}</span>
        ${vscodeIcon}
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет входящих вызовов</div>');
  h.push(`</div></div>`);

  // --- Выходы ---
  h.push(
    `<div class="es" data-nav-section="callees" data-nav-label="Выходы">
      <div class="es-h">📤 Выходы — что вызывает <span class="ct">${callees.length}</span></div>
      <div class="es-b">`
  );
  if (callees.length) {
    for (const c of callees) {
      const calleeFn = state.fnById[c.toFnId];
      const vscodeIcon = calleeFn
        ? Vscode.renderVscodeIcon({
          fileId: calleeFn.fileId,
          line: c.callLine,
          label: '↗',
        })
        : '';
      h.push(`<div class="ei" ${
        !c.isExternal
          ? `data-action="select-fn" data-id="${c.toFnId}"`
          : ''
      }>
        <span class="d" style="color:var(--red)">→</span>
        <span class="n">${c.isExternal ? '🌐 ' : ''}${Core.escapeHtml(
        c.toFnName
      )}</span>
        <span class="inf">${Core.escapeHtml(c.callType)}·L${c.callLine}${
        c.isExternal ? '·⚡' : ''
      }</span>
        ${vscodeIcon}
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет исходящих вызовов</div>');
  h.push(`</div></div>`);

  // --- Импорты файла ---
  h.push(
    `<div class="es" data-nav-section="file-imports" data-nav-label="Импорты файла">
      <div class="es-h">📦 Импорты файла <span class="ct">${fImps.length}</span></div>
      <div class="es-b">${renderImportsBlock(fImps)}</div>
    </div>`
  );

  // --- Импортируют файл ---
  h.push(
    `<div class="es" data-nav-section="file-importers" data-nav-label="Импортируют файл">
      <div class="es-h">🔗 Импортируют файл <span class="ct">${fImporters.length}</span></div>
      <div class="es-b">${renderImportersBlock(
      fImporters.map(fid => ({ fromFileId: fid }))
    )}</div>
    </div>`
  );

  // --- Соседи ---
  h.push(
    `<div class="es" data-nav-section="siblings" data-nav-label="Соседи по файлу">
      <div class="es-h">👥 Соседи по файлу <span class="ct">${sibs.length}</span></div>
      <div class="es-b">`
  );
  if (sibs.length) {
    for (const s of sibs.slice(0, 20)) {
      const vscodeIcon = Vscode.renderVscodeIcon({
        fileId: s.fileId,
        line: s.line,
        label: '↗',
      });
      h.push(`<div class="ei" data-action="select-fn" data-id="${s.id}">
        <span class="d" style="color:var(--yellow)">ƒ</span>
        <span class="n">${Core.escapeHtml(s.name)}</span>
        <span class="inf">L${s.line || 0}${s.isExported ? '·exp' : ''}</span>
        ${vscodeIcon}
      </div>`);
    }
    if (sibs.length > 20)
      h.push(`<div class="imp-empty">…ещё ${sibs.length - 20}</div>`);
  } else h.push('<div class="imp-empty">Единственная функция в файле</div>');
  h.push(`</div></div>`);

  // --- Транзитивные ---
  const tCallers = Core.getTransitiveCallers(id, 3);
  const tCallees = Core.getTransitiveCallees(id, 3);
  if (tCallers.length > 1 || tCallees.length > 1) {
    h.push(`<div class="es" data-nav-section="transitive" data-nav-label="Транзитивные связи">
      <div class="es-h">🔮 Транзитивные связи (глубина 3)</div>
      <div class="es-b">
        <div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Вызывающие (${tCallers.length}):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
          ${tCallers
      .slice(0, 20)
      .map(
        f =>
          `<span class="ei" style="display:inline-flex;padding:2px 8px;background:var(--bg3);border-radius:10px;" data-action="select-fn" data-id="${f.id}">${Core.escapeHtml(
            f.name
          )}</span>`
      )
      .join('')}
        </div>
        <div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Вызываемые (${tCallees.length}):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${tCallees
      .slice(0, 20)
      .map(
        f =>
          `<span class="ei" style="display:inline-flex;padding:2px 8px;background:var(--bg3);border-radius:10px;" data-action="select-fn" data-id="${f.id}">${Core.escapeHtml(
            f.name
          )}</span>`
      )
      .join('')}
        </div>
      </div>
    </div>`);
  }

  // --- Обёртка .mn-sections ---
  $('mn').innerHTML = `<div class="mn-sections">${h.join('')}</div>`;

  // --- Навешиваем scroll-tracking для подсветки активной секции ---
  bindSectionsScrollTracking();

  // --- Прокрутка к первой секции без анимации ---
  requestAnimationFrame(() => {
    const first = document.querySelector('.mn-sections > [data-nav-section]');
    if (first) {
      first.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  });

  // --- Пути ДО ---
  const pathsTo = Paths.findAllPathsTo(id, {
    type: 'function',
    maxDepth: 6,
    maxPaths: 20,
  });
  const cntTo = $('pathsToCount');
  if (cntTo) cntTo.textContent = pathsTo.length;
  Paths.renderPathsList($('pathsToFnBody'), pathsTo, {
    onNodeClick: selectFn,
    label: 'путей до',
  });

  // --- Пути ОТ ---
  const pathsFrom = Paths.findAllPathsFrom(id, {
    type: 'function',
    maxDepth: 6,
    maxPaths: 20,
  });
  const cntFrom = $('pathsFromCount');
  if (cntFrom) cntFrom.textContent = pathsFrom.length;
  Paths.renderPathsList($('pathsFromFnBody'), pathsFrom, {
    onNodeClick: selectFn,
    label: 'путей от',
  });

  // --- Цепочка ---
  $('callChainBody').appendChild(
    Graph.renderCallChain(id, { direction: 'both', depth: 3 })
  );

  // --- Граф вызовов ---
  $('callGraphBody').appendChild(
    Graph.renderCallGraph(id, {
      onNodeClick: (nid, t) => {
        if (t === 'fn') selectFn(nid);
      },
    })
  );

  // --- Граф зависимостей ---
  if (file) {
    $('fileDepGraphBody').appendChild(
      Graph.renderFileDepGraph(file.id, { onNodeClick: selectFile })
    );
  }
}

// ---------------------------------------------------------------------------
// РЕНДЕР ФАЙЛА
// ---------------------------------------------------------------------------
function renderFile(fid) {
  const f = state.files[fid];
  if (!f) return;
  const mod = state.modules[f.moduleId];
  const fns = state.fileFunctions[fid] || [];
  const exps = state.fileExports[fid] || [];
  const imps = state.fileImports[fid] || [];
  const deps = [...new Set(state.fileDependents[fid] || [])];
  const depsOut = [...new Set(state.fileDependencies[fid] || [])];

  const vscodeBadge = Vscode.renderVscodeBadge({ fileId: fid });

  const h = [];

  // --- Карточка файла ---
  h.push(`<div class="es" data-nav-section="file-card" data-nav-label="${Core.escapeHtml(
    f.path
  )}" style="text-align:center;">
    <div class="es-b" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div class="ctx" style="display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
        <span class="c">📦 ${Core.escapeHtml(mod?.name || '?')}</span>
        <span class="ar">→</span>
        <span class="c" style="border-color:var(--yellow);color:var(--yellow)">📄 ${Core.escapeHtml(
    f.path
  )}</span>
      </div>
      <div class="n-card">
        <div class="nm">📄 ${Core.escapeHtml(f.path)}</div>
        <div class="mt">
          <span>${vscodeBadge}</span>
          <span>Модуль: ${Core.escapeHtml(mod?.name || '?')}</span>
          <span>Функций: ${fns.length}</span>
          <span>Экспортов: ${exps.length}</span>
          <span>Импортов: ${imps.length}</span>
        </div>
      </div>
    </div>
  </div>`);

  // --- Пути ДО ---
  h.push(`<div class="es" data-nav-section="paths-to-file" data-nav-label="Пути ДО файла">
    <div class="es-h">🛤️ Пути ДО этого файла <span class="ct" id="pathsToCount">…</span></div>
    <div class="es-b" id="pathsToFileBody"></div>
  </div>`);

  // --- Пути ОТ ---
  h.push(`<div class="es" data-nav-section="paths-from-file" data-nav-label="Пути ОТ файла">
    <div class="es-h">🛤️ Пути ОТ этого файла <span class="ct" id="pathsFromCount">…</span></div>
    <div class="es-b" id="pathsFromFileBody"></div>
  </div>`);

  // --- Граф модулей ---
  h.push(`<div class="es" data-nav-section="module-graph" data-nav-label="Граф модулей">
    <div class="es-h">🗺️ Граф модулей</div>
    <div class="es-b" id="moduleGraphBody"></div>
  </div>`);

  // --- Граф зависимостей ---
  h.push(`<div class="es" data-nav-section="file-dep-graph" data-nav-label="Граф зависимостей">
    <div class="es-h">🔗 Граф зависимостей файла</div>
    <div class="es-b" id="fileDepGraphBody"></div>
  </div>`);

  // --- Прямые экспорты ---
  h.push(
    `<div class="es" data-nav-section="exports" data-nav-label="Прямые экспорты">
      <div class="es-h">📤 Прямые экспорты <span class="ct">${exps.length}</span></div>
      <div class="es-b">`
  );
  if (exps.length) {
    for (const ex of exps) {
      const fn = ex.functionId ? state.fnById[ex.functionId] : null;
      const vscodeIcon = fn
        ? Vscode.renderVscodeIcon({
          fileId: fn.fileId,
          line: fn.line,
          label: '↗',
        })
        : Vscode.renderVscodeIcon({
          fileId: ex.fileId,
          line: ex.line,
          label: '↗',
        });
      h.push(`<div class="ei" ${
        fn ? `data-action="select-fn" data-id="${fn.id}"` : ''
      }>
        <span class="d" style="color:var(--green)">📤</span>
        <span class="n">${Core.escapeHtml(ex.exportName || '?')}</span>
        <span class="inf">${Core.escapeHtml(ex.type || 'named')}</span>
        ${vscodeIcon}
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет прямых экспортов</div>');
  h.push(`</div></div>`);

  // --- Импорты ---
  h.push(
    `<div class="es" data-nav-section="file-imports" data-nav-label="Импорты файла">
      <div class="es-h">📥 Импорты файла <span class="ct">${imps.length}</span></div>
      <div class="es-b">${renderImportsBlock(imps)}</div>
    </div>`
  );

  // --- Импортируют файл ---
  h.push(
    `<div class="es" data-nav-section="file-importers" data-nav-label="Импортируют файл">
      <div class="es-h">🔗 Импортируют файл <span class="ct">${deps.length}</span></div>
      <div class="es-b">${renderImportersBlock(
      deps.map(id => ({ fromFileId: id }))
    )}</div>
    </div>`
  );

  // --- Импортирует из ---
  h.push(
    `<div class="es" data-nav-section="file-deps-out" data-nav-label="Импортирует из">
      <div class="es-h">📤 Импортирует из <span class="ct">${depsOut.length}</span></div>
      <div class="es-b">`
  );
  if (depsOut.length) {
    for (const id of depsOut) {
      const vscodeIcon = Vscode.renderVscodeIcon({
        fileId: id,
        label: '↗',
      });
      h.push(`<div class="ei" data-action="select-file" data-id="${id}">
        <span class="d" style="color:var(--accent)">→</span>
        <span class="n">${Core.escapeHtml(Core.getFilePath(id))}</span>
        ${vscodeIcon}
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет исходящих зависимостей</div>');
  h.push(`</div></div>`);

  // --- Функции ---
  h.push(
    `<div class="es" data-nav-section="file-functions" data-nav-label="Функции файла">
      <div class="es-h">⚙️ Функции <span class="ct">${fns.length}</span></div>
      <div class="es-b">`
  );
  if (fns.length) {
    for (const fn of fns) {
      const vscodeIcon = Vscode.renderVscodeIcon({
        fileId: fn.fileId,
        line: fn.line,
        label: '↗',
      });
      h.push(`<div class="ei" data-action="select-fn" data-id="${fn.id}">
        <span class="d" style="color:var(--purple)">ƒ</span>
        <span class="n">${Core.escapeHtml(fn.name)}</span>
        <span class="inf">L${fn.line}${fn.isExported ? '·exp' : ''}</span>
        ${vscodeIcon}
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет функций</div>');
  h.push(`</div></div>`);

  // --- Обёртка .mn-sections ---
  $('mn').innerHTML = `<div class="mn-sections">${h.join('')}</div>`;

  // --- Навешиваем scroll-tracking ---
  bindSectionsScrollTracking();

  // --- Прокрутка к первой секции без анимации ---
  requestAnimationFrame(() => {
    const first = document.querySelector('.mn-sections > [data-nav-section]');
    if (first) {
      first.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  });

  // --- Пути ---
  const pathsTo = Paths.findAllPathsTo(fid, {
    type: 'file',
    maxDepth: 5,
    maxPaths: 20,
  });
  const cntTo = $('pathsToCount');
  if (cntTo) cntTo.textContent = pathsTo.length;
  Paths.renderPathsList($('pathsToFileBody'), pathsTo, {
    onNodeClick: selectFile,
    label: 'путей до',
  });

  const pathsFrom = Paths.findAllPathsFrom(fid, {
    type: 'file',
    maxDepth: 5,
    maxPaths: 20,
  });
  const cntFrom = $('pathsFromCount');
  if (cntFrom) cntFrom.textContent = pathsFrom.length;
  Paths.renderPathsList($('pathsFromFileBody'), pathsFrom, {
    onNodeClick: selectFile,
    label: 'путей от',
  });

  // --- Графы ---
  $('moduleGraphBody').appendChild(
    Graph.renderModuleGraph({
      onNodeClick: (id, t) => {
        if (t === 'module') selectFile(id);
      },
    })
  );
  $('fileDepGraphBody').appendChild(
    Graph.renderFileDepGraph(fid, { onNodeClick: selectFile })
  );
}

// ---------------------------------------------------------------------------
// БЛОКИ ИМПОРТОВ
// ---------------------------------------------------------------------------
function getTypeClass(type) {
  if (type === 'default') return 'def';
  if (type === 'namespace') return 'nsp';
  if (type === 'type' || type === 'type-only') return 'typ';
  return 'nmd';
}

function getTypeLabel(type) {
  if (type === 'default') return 'default';
  if (type === 'namespace') return 'namespace';
  if (type === 'type' || type === 'type-only') return 'type';
  return 'named';
}

function renderImportsBlock(fileImports) {
  if (!fileImports.length)
    return '<div class="imp-empty">Нет импортов</div>';
  const ext = {};
  const int = {};
  for (const imp of fileImports) {
    if (imp.isExternal) {
      const k = imp.packageName || imp.source;
      if (!ext[k]) ext[k] = [];
      ext[k].push(imp);
    } else {
      if (!int[imp.source]) int[imp.source] = [];
      int[imp.source].push(imp);
    }
  }
  const h = [];

  for (const [pkg, imps] of Object.entries(ext)) {
    h.push(`<div class="imp-group">
      <div class="imp-group-h">
        <span style="color:var(--purple)">📦</span>
        <span class="pkg">${Core.escapeHtml(pkg)}</span>
        <span class="badge">${imps.length}</span>
      </div>
      <div class="imp-group-b">`);
    for (const im of imps) {
      const tc = getTypeClass(im.type);
      const tl = getTypeLabel(im.type);
      const showLocal = im.localName !== im.importedName;
      h.push(`<div class="imp-row">
        <span class="from">${Core.escapeHtml(im.importedName)}</span>
        ${
        showLocal
          ? `<span class="arrow">→</span><span class="to">${Core.escapeHtml(
            im.localName
          )}</span>`
          : ''
      }
        <span class="typ ${tc}">${tl}</span>
      </div>`);
    }
    h.push(`</div></div>`);
  }

  for (const [src, imps] of Object.entries(int)) {
    const toFileId = imps[0]?.toFileId || null;
    const vscodeIcon = toFileId
      ? Vscode.renderVscodeIcon({
        fileId: toFileId,
        label: '↗',
      })
      : '';
    h.push(`<div class="imp-group">
      <div class="imp-group-h">
        <span style="color:var(--green)">📄</span>
        <span class="pkg">${Core.escapeHtml(src)}</span>
        <span class="badge">${imps.length}</span>
        ${vscodeIcon}
      </div>
      <div class="imp-group-b">`);
    for (const im of imps) {
      const tc = getTypeClass(im.type);
      const tl = getTypeLabel(im.type);
      const showLocal = im.localName !== im.importedName;
      h.push(`<div class="imp-row">
        <span class="from">${Core.escapeHtml(im.importedName)}</span>
        ${
        showLocal
          ? `<span class="arrow">→</span><span class="to">${Core.escapeHtml(
            im.localName
          )}</span>`
          : ''
      }
        <span class="typ ${tc}">${tl}</span>
      </div>`);
    }
    h.push(`</div></div>`);
  }

  return h.join('');
}

function renderImportersBlock(importers) {
  if (!importers.length)
    return '<div class="imp-empty">Никто не импортирует</div>';
  const grouped = {};
  for (const imp of importers) {
    const fid = imp.fromFileId || imp;
    if (!grouped[fid]) grouped[fid] = [];
    if (imp.fromFileId) grouped[fid].push(imp);
  }
  const h = [];
  for (const [fid, imps] of Object.entries(grouped)) {
    const ff = state.files[fid];
    const vscodeIcon = Vscode.renderVscodeIcon({
      fileId: fid,
      label: '↗',
    });
    h.push(`<div class="imp-group">
      <div class="imp-group-h">
        <span style="color:var(--orange)">📄</span>
        <span class="pkg">${Core.escapeHtml(ff?.path || fid)}</span>
        <span class="badge">${imps.length || '—'}</span>
        ${vscodeIcon}
      </div>
      ${
      imps.length
        ? `<div class="imp-group-b">
        ${imps
          .map(im => {
            const tc = getTypeClass(im.type);
            const tl = getTypeLabel(im.type);
            const showLocal = im.localName !== im.importedName;
            return `<div class="imp-row">
            <span class="from">${Core.escapeHtml(im.importedName)}</span>
            ${
              showLocal
                ? `<span class="arrow">→</span><span class="to">${Core.escapeHtml(
                  im.localName
                )}</span>`
                : ''
            }
            <span class="typ ${tc}">${tl}</span>
          </div>`;
          })
          .join('')}
      </div>`
        : ''
    }
    </div>`);
  }
  return h.join('');
}

// ---------------------------------------------------------------------------
// ДЕЛЕГИРОВАНИЕ СОБЫТИЙ
// ---------------------------------------------------------------------------
document.addEventListener('click', e => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  if (target.closest('.fs-tree')) return;
  if (target.closest('.ast-ext')) return;
  if (target.closest('.ast-loc')) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === 'select-fn' || action === 'select-path-node') {
    if (state.fnById[id]) selectFn(id);
    else if (state.files[id]) selectFile(id);
  } else if (action === 'select-file') {
    selectFile(id);
  } else if (action === 'jump-fn') {
    selectFn(id);
  } else if (action === 'open-vscode-setup') {
    Vscode.showBasePathModal({
      onChange: cfg => {
        UI.toast(
          cfg.basePath ? `basePath: ${cfg.basePath}` : 'basePath очищен',
          cfg.basePath ? 'success' : 'warn'
        );
        renderHeader();
        LocationBar.setUniverse(cfg.basePath);
        if (activeFnId) renderFn(activeFnId);
        else if (activeFileId) renderFile(activeFileId);
      },
    });
  } else if (action === 'copy-basepath') {
    const value = target.dataset.id || '';
    if (!value) return;
    copyTextToClipboard(value)
      .then(() => UI.toast(`Скопировано: ${value}`, 'success'))
      .catch(() => UI.toast('Не удалось скопировать', 'error'));
  }
});

/**
 * Универсальное копирование: navigator.clipboard + fallback на execCommand.
 */
function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error('execCommand copy failed'));
    } catch (e) {
      reject(e);
    }
  });
}

// ---------------------------------------------------------------------------
// КНОПКИ ШАПКИ
// ---------------------------------------------------------------------------
$('btnOpen').addEventListener('click', () => $('fi').click());
$('fi').addEventListener('change', e => handleFile(e.target.files[0]));

$('btnReload').addEventListener('click', async () => {
  Core.clearRootCache();
  UI.toast('Кэш очищен, перезагрузка…', 'info');
  await autoLoad();
});

$('btnExportCompact').addEventListener('click', () => {
  try {
    const compact = Core.downloadCompact('index.json', {
      valuesMode: state.valuesMode,
    });
    UI.toast(
      `✓ Экспортировано (${Object.keys(compact).length} ключей, ${
        state.valuesMode
      })`,
      'success'
    );
  } catch (e) {
    UI.toast('Ошибка: ' + e.message, 'error');
  }
});

$('btnExportFull').addEventListener('click', () => {
  try {
    Core.downloadFull('index.full.json');
    UI.toast('✓ Full JSON экспортирован', 'success');
  } catch (e) {
    UI.toast('Ошибка: ' + e.message, 'error');
  }
});

const btnLegend = $('btnLegend');
if (btnLegend) {
  btnLegend.addEventListener('click', () =>
    Legend.showLegendModal({ title: 'Легенда кодека v13.0.2' })
  );
}

$('btnRoundTrip').addEventListener('click', () => openRoundTripModal());
$('rtClose').addEventListener('click', () =>
  $('rtOverlay').classList.remove('show')
);
$('rtOverlay').addEventListener('click', e => {
  if (e.target === $('rtOverlay')) $('rtOverlay').classList.remove('show');
});

// ---------------------------------------------------------------------------
// ROUND-TRIP MODAL
// ---------------------------------------------------------------------------
function openRoundTripModal() {
  const compactSource = state.rawCompact || state.originalCompact;
  const fullSource = state.rawFull;

  const hasCompact = !!compactSource;
  const hasFull = !!fullSource;

  if (!hasCompact && !hasFull) {
    UI.toast('Сначала загрузите index.json или index.full.json', 'error');
    return;
  }

  const body = $('rtBody');
  body.innerHTML =
    '<div style="text-align:center;padding:40px;color:var(--text2)">⏳ Выполняется проверка…</div>';
  $('rtOverlay').classList.add('show');

  setTimeout(() => {
    try {
      const bothFormats = hasCompact && hasFull;

      let r0 = null;
      let r1 = null;
      let r2 = null;
      let r3 = null;
      let rE = null;

      if (bothFormats) {
        try {
          const enc = Core.encodeToCompactData(fullSource);
          const a = stripForByteCompare(compactSource);
          const b = stripForByteCompare(enc);
          const ok = deepEqual(a, b);
          r0 = { ok, diff: ok ? null : diffObjects(a, b) };
        } catch (e) {
          r0 = { ok: false, error: e.message };
        }
      }

      if (hasCompact) {
        try {
          r1 = roundTripSemantic(compactSource);
        } catch (e) {
          r1 = { ok: false, error: e.message };
        }
      }

      if (bothFormats) {
        try {
          const decoded = Core.decodeCompactData(compactSource);
          const a = stripServiceFields(decoded);
          const b = stripServiceFields(fullSource);
          const ok = deepEqual(a, b);
          r2 = { ok, diff: ok ? null : diffObjects(a, b) };
        } catch (e) {
          r2 = { ok: false, error: e.message };
        }
      }

      if (hasCompact) {
        try {
          r3 = roundTripByteExact(compactSource);
        } catch (e) {
          r3 = { ok: false, error: e.message };
        }
      }

      try {
        const full = Core.exportAll();
        if (state.__codec) full.__codec = state.__codec;
        rE = roundTripEncode(full);
      } catch (e) {
        rE = { ok: false, error: e.message };
      }

      const card = (title, subtitle, r) => {
        if (!r) return '';
        const ok = !!r.ok;
        const cls = r.reason ? 'rt-warn' : ok ? 'rt-ok' : 'rt-fail';
        const label = r.reason
          ? `⏭ ${r.reason}`
          : r.error
            ? `✗ ${r.error}`
            : ok
              ? '✓ OK'
              : '✗ FAIL';
        return `
          <div class="rt-card">
            <div class="rt-title">${title}</div>
            <div class="rt-row">
              <span>${subtitle}</span>
              <span class="${cls}">${label}</span>
            </div>
            ${ok ? '' : r.diff ? renderDiffs(r.diff) : ''}
          </div>`;
      };

      const loadedNote = bothFormats
        ? '<div class="rt-card"><div class="rt-title">📚 Комплексная проверка</div><div class="rt-row"><span>Загружены оба формата (compact + full)</span><span class="rt-ok">✓</span></div></div>'
        : hasCompact
          ? '<div class="rt-card"><div class="rt-title">📦 Только compact</div><div class="rt-row"><span>L0 и L2 доступны только при наличии index.full.json</span><span class="rt-warn">⏭</span></div></div>'
          : '<div class="rt-card"><div class="rt-title">📄 Только full</div><div class="rt-row"><span>L0, L1, L2, L3 доступны только при наличии index.json</span><span class="rt-warn">⏭</span></div></div>';

      body.innerHTML = `
        ${loadedNote}
        ${card('🎯 L0 — encode(full) ≈ compact', 'encode(index.full.json) → сравнение с index.json', r0)}
        ${card('🔬 L1 — Семантический round-trip', 'decode → encode → decode', r1)}
        ${card('🔗 L2 — decode(compact) ≈ full', 'decode(index.json) → сравнение с index.full.json', r2)}
        ${card('🎯 L3 — Байт-в-байт', 'decode → encode(reuse, strict) → сравнение', r3)}
        ${card('↩️ RE — Идемпотентность', 'full → compact → full → compact', rE)}
        <div class="rt-btn-row">
          <button class="rt-btn primary" id="rtDownloadReport">📥 Скачать отчёт (JSON)</button>
        </div>
      `;

      $('rtDownloadReport').addEventListener('click', () => {
        const report = {
          timestamp: new Date().toISOString(),
          originalFormat: state.originalFormat,
          valuesMode: state.valuesMode,
          bothFormats,
          hasCompact,
          hasFull,
          L0_encodeFullVsCompact: r0
            ? {
              ok: r0.ok,
              diffCount: r0.diff?.length || 0,
              diff: r0.diff,
              error: r0.error,
            }
            : null,
          L1_semantic: r1
            ? {
              ok: r1.ok,
              diffCount: r1.diff?.length || 0,
              diff: r1.diff,
              error: r1.error,
            }
            : null,
          L2_decodeCompactVsFull: r2
            ? {
              ok: r2.ok,
              diffCount: r2.diff?.length || 0,
              diff: r2.diff,
              error: r2.error,
            }
            : null,
          L3_byteExact: r3
            ? {
              ok: r3.ok,
              diffCount: r3.diff?.length || 0,
              diff: r3.diff,
              error: r3.error,
            }
            : null,
          reverse: rE
            ? {
              ok: rE.ok,
              diffCount: rE.diff?.length || 0,
              diff: rE.diff,
              error: rE.error,
            }
            : null,
        };
        Core.downloadJSON(report, 'round-trip-report.json');
        UI.toast('Отчёт скачан', 'success');
      });
    } catch (e) {
      body.innerHTML = `<div class="rt-card"><div class="rt-title">Ошибка</div><div style="color:var(--red);font-family:monospace">${Core.escapeHtml(
        e.message
      )}</div></div>`;
    }
  }, 50);
}

function renderDiffs(diffs) {
  if (!diffs || !diffs.length) return '';
  return `<div class="rt-diffs">
    ${diffs
    .slice(0, 20)
    .map(
      d => `
      <div class="rt-diff-item">
        <span class="path">${Core.escapeHtml(d.path)}</span>
        <span class="val"> → было: ${Core.escapeHtml(
        JSON.stringify(d.a)
      )}, стало: ${Core.escapeHtml(JSON.stringify(d.b))}</span>
      </div>`
    )
    .join('')}
    ${
    diffs.length > 20
      ? `<div class="rt-diff-item"><span class="val">… ещё ${
        diffs.length - 20
      }</span></div>`
      : ''
  }
  </div>`;
}

// ---------------------------------------------------------------------------
// КЭШ
// ---------------------------------------------------------------------------
$('btnCache').addEventListener('click', () => {
  const info = Core.getRootCacheInfo();
  if (!info) {
    UI.toast('Кэш пуст', 'info');
    return;
  }
  UI.toast(`Кэш: ${info.url} (${info.ageHuman})`, 'info');
});

// ---------------------------------------------------------------------------
// DRAG & DROP
// ---------------------------------------------------------------------------
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.json')) handleFile(f);
});

// ---------------------------------------------------------------------------
// ГОРЯЧИЕ КЛАВИШИ
// ---------------------------------------------------------------------------
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    $('si').focus();
    return;
  }
  if (e.key === 'F1') {
    e.preventDefault();
    Legend.showLegendModal({ title: 'Легенда кодека v13.0.2' });
    return;
  }
  if (e.key === 'Escape') {
    if ($('rtOverlay').classList.contains('show')) {
      $('rtOverlay').classList.remove('show');
      return;
    }
    Extensions.closePanel();
    const s = $('si');
    if (s) {
      s.value = '';
      s.blur();
      renderTree();
    }
    return;
  }
  if (
    e.altKey &&
    (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т')
  ) {
    e.preventDefault();
    if (Extensions.getActive() === 'nav') {
      Extensions.closePanel();
    } else {
      Extensions.openPanel('nav');
    }
    return;
  }
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    if (e.key === 'ArrowLeft') LocationBar.goBack();
    else LocationBar.goForward();
    return;
  }
  if (e.altKey && e.key === 'Home') {
    e.preventDefault();
    LocationBar.goHome();
    return;
  }
  if (e.key === 'F5') {
    e.preventDefault();
    LocationBar.reload();
    return;
  }
});

// ---------------------------------------------------------------------------
// СТАРТ
// ---------------------------------------------------------------------------
console.log(
  '%c🔍 AST Analyzer v13.0.5',
  'font-size:16px;font-weight:bold;color:#58a6ff;'
);
console.log(
  'Модули: ast-analyzer-codec.js (v13.0.2), ast-analyzer-utils.js, ast-analyzer-core.js (v13.0.3), ast-analyzer-ui.js, ast-analyzer-graph.js, ast-analyzer-tree.js, ast-analyzer-legend.js, ast-analyzer-paths.js, ast-analyzer-vscode.js, ast-analyzer-extensions.js (v1.0), ast-analyzer-nav.js (v1.3), ast-analyzer-location-bar.js (v1.4)'
);

await autoLoad();
