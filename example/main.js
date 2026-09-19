// ============================================================================
// AST ANALYZER — MAIN v13.0.2
// Только новый формат. Обратная совместимость не поддерживается.
//
// Особенности:
//   - Хлебные крошки с последовательностями путей
//   - Панели «Пути ДО» / «Пути ОТ» для функций и файлов
//   - Кнопка «Легенда» + F1
//   - Round-Trip L0/L1/L2/L3/RE
//   - valuesMode в шапке и при экспорте
//
// FIX v13.0.2:
//   - openRoundTripModal(): hasCompact/hasFull теперь берутся
//     из state.rawCompact / state.rawFull (а не из originalFormat),
//     корректно обрабатывается случай «загружен только full».
// ============================================================================

import * as Core from './ast-analyzer-core.js';
import * as UI from './ast-analyzer-ui.js';
import * as Graph from './ast-analyzer-graph.js';
import * as Tree from './ast-analyzer-tree.js';
import * as Legend from './ast-analyzer-legend.js';
import * as Paths from './ast-analyzer-paths.js';
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

  // Инжект стилей
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

  // Шапка
  const s = Core.getProjectStats();
  const fmt = state.originalFormat || '?';
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
  `;

  renderTree();

  const si = $('si');
  if (si) {
    si.addEventListener(
      'input',
      Core.debounce(() => renderTree(), 150)
    );
  }

  if (state.functions && Object.keys(state.functions).length) {
    const firstFn = Object.values(state.functions)[0];
    selectFn(firstFn.id);
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
}

function selectFile(fid) {
  activeFnId = null;
  activeFileId = fid;
  renderTree();
  renderFile(fid);
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
  const sibs = file ? (state.fileFunctions[file.id] || []).filter(f => f.id !== id) : [];

  const bds = [];
  if (fn.isExported) bds.push('<span class="b e">export</span>');
  if (fn.isAsync) bds.push('<span class="b a">async</span>');
  if (fn.isMethod) bds.push('<span class="b m">method</span>');
  if (fn.isArrow) bds.push('<span class="b r">arrow</span>');

  const h = [];
  h.push(`<div class="ctx">
    <span class="c">📦 ${Core.escapeHtml(mod?.name || '?')}</span>
    <span class="ar">→</span>
    <span class="c" data-action="select-file" data-id="${file?.id || ''}">📄 ${Core.escapeHtml(Core.shortPath(file?.path || '?', 60))}</span>
    ${exps.length ? `<span class="ar">→</span><span class="c" style="border-color:var(--green);color:var(--green)">📤 ${Core.escapeHtml(exps[0].exportName)}</span>` : ''}
  </div>`);

  h.push(`<div style="text-align:center"><div class="n-card">
    <div class="nm">ƒ ${Core.escapeHtml(fn.name)}</div>
    <div class="mt">
      <span>📍 L${fn.line || 0}</span>
      ${fn.params?.length ? `<span>(${Core.escapeHtml(fn.params.join(', '))})</span>` : ''}
      ${fn.returnType ? `<span>→ ${Core.escapeHtml(Core.formatType(fn.returnType))}</span>` : ''}
    </div>
    <div class="bd">${bds.join('')}</div>
  </div></div>`);

  // Панель путей ДО
  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">🛤️ Пути ДО этой функции <span class="ct" id="pathsToCount">…</span></div>
    <div class="es-b" id="pathsToFnBody"></div>
  </div>`);
  // Панель путей ОТ
  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">🛤️ Пути ОТ этой функции <span class="ct" id="pathsFromCount">…</span></div>
    <div class="es-b" id="pathsFromFnBody"></div>
  </div>`);
  // Цепочка вызовов
  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">🔗 Цепочка вызовов</div>
    <div class="es-b" id="callChainBody"></div>
  </div>`);
  // Граф вызовов
  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">📞 Граф вызовов</div>
    <div class="es-b" id="callGraphBody"></div>
  </div>`);
  // Граф зависимостей файла
  if (file) {
    h.push(`<div class="es" style="margin-bottom:12px;">
      <div class="es-h">🔗 Граф зависимостей файла</div>
      <div class="es-b" id="fileDepGraphBody"></div>
    </div>`);
  }

  h.push(`<div class="eg">`);

  // Входы
  h.push(
    `<div class="es"><div class="es-h">📥 Входы — кто вызывает <span class="ct">${callers.length}</span></div><div class="es-b">`
  );
  if (callers.length) {
    for (const c of callers) {
      h.push(`<div class="ei" data-action="select-fn" data-id="${c.fromFnId}">
        <span class="d" style="color:var(--green)">←</span>
        <span class="n">${Core.escapeHtml(c.fromFnName)}</span>
        <span class="inf">${Core.escapeHtml(c.callType)}·L${c.callLine}</span>
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет входящих вызовов</div>');
  h.push(`</div></div>`);

  // Выходы
  h.push(
    `<div class="es"><div class="es-h">📤 Выходы — что вызывает <span class="ct">${callees.length}</span></div><div class="es-b">`
  );
  if (callees.length) {
    for (const c of callees) {
      h.push(`<div class="ei" ${!c.isExternal ? `data-action="select-fn" data-id="${c.toFnId}"` : ''}>
        <span class="d" style="color:var(--red)">→</span>
        <span class="n">${c.isExternal ? '🌐 ' : ''}${Core.escapeHtml(c.toFnName)}</span>
        <span class="inf">${Core.escapeHtml(c.callType)}·L${c.callLine}${c.isExternal ? '·⚡' : ''}</span>
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет исходящих вызовов</div>');
  h.push(`</div></div>`);

  // Импорты файла
  h.push(
    `<div class="es"><div class="es-h">📦 Импорты файла <span class="ct">${fImps.length}</span></div><div class="es-b">${renderImportsBlock(fImps)}</div></div>`
  );

  // Импортируют файл
  h.push(
    `<div class="es"><div class="es-h">🔗 Импортируют файл <span class="ct">${fImporters.length}</span></div><div class="es-b">${renderImportersBlock(fImporters)}</div></div>`
  );

  // Соседи
  h.push(
    `<div class="es"><div class="es-h">👥 Соседи по файлу <span class="ct">${sibs.length}</span></div><div class="es-b">`
  );
  if (sibs.length) {
    for (const s of sibs.slice(0, 20)) {
      h.push(`<div class="ei" data-action="select-fn" data-id="${s.id}">
        <span class="d" style="color:var(--yellow)">ƒ</span>
        <span class="n">${Core.escapeHtml(s.name)}</span>
        <span class="inf">L${s.line || 0}${s.isExported ? '·exp' : ''}</span>
      </div>`);
    }
    if (sibs.length > 20) h.push(`<div class="imp-empty">…ещё ${sibs.length - 20}</div>`);
  } else h.push('<div class="imp-empty">Единственная функция в файле</div>');
  h.push(`</div></div>`);

  // Транзитивные
  const tCallers = Core.getTransitiveCallers(id, 3);
  const tCallees = Core.getTransitiveCallees(id, 3);
  if (tCallers.length > 1 || tCallees.length > 1) {
    h.push(`<div class="es" style="grid-column:1/-1;">
      <div class="es-h">🔮 Транзитивные связи (глубина 3)</div>
      <div class="es-b">
        <div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Вызывающие (${tCallers.length}):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
          ${tCallers
            .slice(0, 20)
            .map(
              f =>
                `<span class="ei" style="display:inline-flex;padding:2px 8px;background:var(--bg3);border-radius:10px;" data-action="select-fn" data-id="${f.id}">${Core.escapeHtml(f.name)}</span>`
            )
            .join('')}
        </div>
        <div style="font-size:10px;color:var(--text2);margin-bottom:6px;">Вызываемые (${tCallees.length}):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${tCallees
            .slice(0, 20)
            .map(
              f =>
                `<span class="ei" style="display:inline-flex;padding:2px 8px;background:var(--bg3);border-radius:10px;" data-action="select-fn" data-id="${f.id}">${Core.escapeHtml(f.name)}</span>`
            )
            .join('')}
        </div>
      </div>
    </div>`);
  }

  h.push(`</div>`);
  $('mn').innerHTML = h.join('');

  // Пути ДО
  const pathsTo = Paths.findAllPathsTo(id, { type: 'function', maxDepth: 6, maxPaths: 20 });
  const cntTo = $('pathsToCount');
  if (cntTo) cntTo.textContent = pathsTo.length;
  Paths.renderPathsList($('pathsToFnBody'), pathsTo, {
    onNodeClick: selectFn,
    label: 'путей до',
  });

  // Пути ОТ
  const pathsFrom = Paths.findAllPathsFrom(id, { type: 'function', maxDepth: 6, maxPaths: 20 });
  const cntFrom = $('pathsFromCount');
  if (cntFrom) cntFrom.textContent = pathsFrom.length;
  Paths.renderPathsList($('pathsFromFnBody'), pathsFrom, {
    onNodeClick: selectFn,
    label: 'путей от',
  });

  // Цепочка
  $('callChainBody').appendChild(Graph.renderCallChain(id, { direction: 'both', depth: 3 }));

  // Граф вызовов
  $('callGraphBody').appendChild(
    Graph.renderCallGraph(id, {
      onNodeClick: (nid, t) => {
        if (t === 'fn') selectFn(nid);
      },
    })
  );

  // Граф зависимостей
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

  const h = [];
  h.push(`<div class="ctx">
    <span class="c">📦 ${Core.escapeHtml(mod?.name || '?')}</span>
    <span class="ar">→</span>
    <span class="c" style="border-color:var(--yellow);color:var(--yellow)">📄 ${Core.escapeHtml(f.path)}</span>
  </div>`);

  h.push(`<div style="text-align:center"><div class="n-card">
    <div class="nm">📄 ${Core.escapeHtml(f.path)}</div>
    <div class="mt">
      <span>Модуль: ${Core.escapeHtml(mod?.name || '?')}</span>
      <span>Функций: ${fns.length}</span>
      <span>Экспортов: ${exps.length}</span>
      <span>Импортов: ${imps.length}</span>
    </div>
  </div></div>`);

  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">🛤️ Пути ДО этого файла <span class="ct" id="pathsToCount">…</span></div>
    <div class="es-b" id="pathsToFileBody"></div>
  </div>`);
  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">🛤️ Пути ОТ этого файла <span class="ct" id="pathsFromCount">…</span></div>
    <div class="es-b" id="pathsFromFileBody"></div>
  </div>`);

  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">🗺️ Граф модулей</div>
    <div class="es-b" id="moduleGraphBody"></div>
  </div>`);
  h.push(`<div class="es" style="margin-bottom:12px;">
    <div class="es-h">🔗 Граф зависимостей файла</div>
    <div class="es-b" id="fileDepGraphBody"></div>
  </div>`);

  h.push(`<div class="eg">`);

  // Прямые экспорты
  h.push(
    `<div class="es"><div class="es-h">📤 Прямые экспорты <span class="ct">${exps.length}</span></div><div class="es-b">`
  );
  if (exps.length) {
    for (const ex of exps) {
      const fn = ex.functionId ? state.fnById[ex.functionId] : null;
      h.push(`<div class="ei" ${fn ? `data-action="select-fn" data-id="${fn.id}"` : ''}>
        <span class="d" style="color:var(--green)">📤</span>
        <span class="n">${Core.escapeHtml(ex.exportName || '?')}</span>
        <span class="inf">${Core.escapeHtml(ex.type || 'named')}</span>
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет прямых экспортов</div>');
  h.push(`</div></div>`);

  // Импорты
  h.push(
    `<div class="es"><div class="es-h">📥 Импорты файла <span class="ct">${imps.length}</span></div><div class="es-b">${renderImportsBlock(imps)}</div></div>`
  );

  // Импортируют файл
  h.push(
    `<div class="es"><div class="es-h">🔗 Импортируют файл <span class="ct">${deps.length}</span></div><div class="es-b">${renderImportersBlock(deps.map(id => ({ fromFileId: id })))}</div></div>`
  );

  // Импортирует из
  h.push(
    `<div class="es"><div class="es-h">📤 Импортирует из <span class="ct">${depsOut.length}</span></div><div class="es-b">`
  );
  if (depsOut.length) {
    for (const id of depsOut) {
      h.push(`<div class="ei" data-action="select-file" data-id="${id}">
        <span class="d" style="color:var(--accent)">→</span>
        <span class="n">${Core.escapeHtml(Core.getFilePath(id))}</span>
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет исходящих зависимостей</div>');
  h.push(`</div></div>`);

  // Функции
  h.push(
    `<div class="es"><div class="es-h">⚙️ Функции <span class="ct">${fns.length}</span></div><div class="es-b">`
  );
  if (fns.length) {
    for (const fn of fns) {
      h.push(`<div class="ei" data-action="select-fn" data-id="${fn.id}">
        <span class="d" style="color:var(--purple)">ƒ</span>
        <span class="n">${Core.escapeHtml(fn.name)}</span>
        <span class="inf">L${fn.line}${fn.isExported ? '·exp' : ''}</span>
      </div>`);
    }
  } else h.push('<div class="imp-empty">Нет функций</div>');
  h.push(`</div></div>`);

  h.push(`</div>`);
  $('mn').innerHTML = h.join('');

  // Пути
  const pathsTo = Paths.findAllPathsTo(fid, { type: 'file', maxDepth: 5, maxPaths: 20 });
  const cntTo = $('pathsToCount');
  if (cntTo) cntTo.textContent = pathsTo.length;
  Paths.renderPathsList($('pathsToFileBody'), pathsTo, {
    onNodeClick: selectFile,
    label: 'путей до',
  });

  const pathsFrom = Paths.findAllPathsFrom(fid, { type: 'file', maxDepth: 5, maxPaths: 20 });
  const cntFrom = $('pathsFromCount');
  if (cntFrom) cntFrom.textContent = pathsFrom.length;
  Paths.renderPathsList($('pathsFromFileBody'), pathsFrom, {
    onNodeClick: selectFile,
    label: 'путей от',
  });

  // Графы
  $('moduleGraphBody').appendChild(
    Graph.renderModuleGraph({
      onNodeClick: (id, t) => {
        if (t === 'module') selectFile(id);
      },
    })
  );
  $('fileDepGraphBody').appendChild(Graph.renderFileDepGraph(fid, { onNodeClick: selectFile }));
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
  if (!fileImports.length) return '<div class="imp-empty">Нет импортов</div>';
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
        ${showLocal ? `<span class="arrow">→</span><span class="to">${Core.escapeHtml(im.localName)}</span>` : ''}
        <span class="typ ${tc}">${tl}</span>
      </div>`);
    }
    h.push(`</div></div>`);
  }

  for (const [src, imps] of Object.entries(int)) {
    h.push(`<div class="imp-group">
      <div class="imp-group-h">
        <span style="color:var(--green)">📄</span>
        <span class="pkg">${Core.escapeHtml(src)}</span>
        <span class="badge">${imps.length}</span>
      </div>
      <div class="imp-group-b">`);
    for (const im of imps) {
      const tc = getTypeClass(im.type);
      const tl = getTypeLabel(im.type);
      const showLocal = im.localName !== im.importedName;
      h.push(`<div class="imp-row">
        <span class="from">${Core.escapeHtml(im.importedName)}</span>
        ${showLocal ? `<span class="arrow">→</span><span class="to">${Core.escapeHtml(im.localName)}</span>` : ''}
        <span class="typ ${tc}">${tl}</span>
      </div>`);
    }
    h.push(`</div></div>`);
  }

  return h.join('');
}

function renderImportersBlock(importers) {
  if (!importers.length) return '<div class="imp-empty">Никто не импортирует</div>';
  const grouped = {};
  for (const imp of importers) {
    const fid = imp.fromFileId || imp;
    if (!grouped[fid]) grouped[fid] = [];
    if (imp.fromFileId) grouped[fid].push(imp);
  }
  const h = [];
  for (const [fid, imps] of Object.entries(grouped)) {
    const ff = state.files[fid];
    h.push(`<div class="imp-group">
      <div class="imp-group-h">
        <span style="color:var(--orange)">📄</span>
        <span class="pkg">${Core.escapeHtml(ff?.path || fid)}</span>
        <span class="badge">${imps.length || '—'}</span>
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
            ${showLocal ? `<span class="arrow">→</span><span class="to">${Core.escapeHtml(im.localName)}</span>` : ''}
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
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === 'select-fn' || action === 'select-path-node') {
    if (state.fnById[id]) selectFn(id);
    else if (state.files[id]) selectFile(id);
  } else if (action === 'select-file') {
    selectFile(id);
  } else if (action === 'jump-fn') {
    selectFn(id);
  }
});

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
    const compact = Core.downloadCompact('index.json', { valuesMode: state.valuesMode });
    UI.toast(
      `✓ Экспортировано (${Object.keys(compact).length} ключей, ${state.valuesMode})`,
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
$('rtClose').addEventListener('click', () => $('rtOverlay').classList.remove('show'));
$('rtOverlay').addEventListener('click', e => {
  if (e.target === $('rtOverlay')) $('rtOverlay').classList.remove('show');
});

// ---------------------------------------------------------------------------
// ROUND-TRIP MODAL
// ---------------------------------------------------------------------------
function openRoundTripModal() {
  // ✅ FIX v13.0.2: hasCompact / hasFull проверяем через state.rawCompact
  // и state.rawFull. Раньше hasFull вычислялся через originalFormat,
  // и при загрузке только index.full.json (без index.json) всё равно
  // попадал в ветку «compact», из-за чего модалка писала «L0 и L2
  // доступны только при загрузке обоих файлов», хотя full был загружен.
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

      // ---------- L0: encode(full) ↔ compact ----------
      // Требует оба файла.
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

      // ---------- L1: semantic round-trip ----------
      // Требует compact.
      if (hasCompact) {
        try {
          r1 = roundTripSemantic(compactSource);
        } catch (e) {
          r1 = { ok: false, error: e.message };
        }
      }

      // ---------- L2: decode(compact) ↔ full ----------
      // Требует оба файла.
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

      // ---------- L3: byte-exact ----------
      // Требует compact.
      if (hasCompact) {
        try {
          r3 = roundTripByteExact(compactSource);
        } catch (e) {
          r3 = { ok: false, error: e.message };
        }
      }

      // ---------- RE: идемпотентность ----------
      // Работает всегда (на основе exportAll).
      try {
        const full = Core.exportAll();
        if (state.__codec) full.__codec = state.__codec;
        rE = roundTripEncode(full);
      } catch (e) {
        rE = { ok: false, error: e.message };
      }

      // Карточка результата. Если result === null — карточка не выводится.
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

      // Информационная карточка о том, что загружено.
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
            ? { ok: r0.ok, diffCount: r0.diff?.length || 0, diff: r0.diff, error: r0.error }
            : null,
          L1_semantic: r1
            ? { ok: r1.ok, diffCount: r1.diff?.length || 0, diff: r1.diff, error: r1.error }
            : null,
          L2_decodeCompactVsFull: r2
            ? { ok: r2.ok, diffCount: r2.diff?.length || 0, diff: r2.diff, error: r2.error }
            : null,
          L3_byteExact: r3
            ? { ok: r3.ok, diffCount: r3.diff?.length || 0, diff: r3.diff, error: r3.error }
            : null,
          reverse: rE
            ? { ok: rE.ok, diffCount: rE.diff?.length || 0, diff: rE.diff, error: rE.error }
            : null,
        };
        Core.downloadJSON(report, 'round-trip-report.json');
        UI.toast('Отчёт скачан', 'success');
      });
    } catch (e) {
      body.innerHTML = `<div class="rt-card"><div class="rt-title">Ошибка</div><div style="color:var(--red);font-family:monospace">${Core.escapeHtml(e.message)}</div></div>`;
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
        <span class="val"> → было: ${Core.escapeHtml(JSON.stringify(d.a))}, стало: ${Core.escapeHtml(JSON.stringify(d.b))}</span>
      </div>`
      )
      .join('')}
    ${diffs.length > 20 ? `<div class="rt-diff-item"><span class="val">… ещё ${diffs.length - 20}</span></div>` : ''}
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
  }
  if (e.key === 'F1') {
    e.preventDefault();
    Legend.showLegendModal({ title: 'Легенда кодека v13.0.2' });
  }
  if (e.key === 'Escape') {
    if ($('rtOverlay').classList.contains('show')) {
      $('rtOverlay').classList.remove('show');
      return;
    }
    const s = $('si');
    if (s) {
      s.value = '';
      s.blur();
      renderTree();
    }
  }
});

// ---------------------------------------------------------------------------
// СТАРТ
// ---------------------------------------------------------------------------
console.log('%c🔍 AST Analyzer v13.0.2', 'font-size:16px;font-weight:bold;color:#58a6ff;');
console.log(
  'Модули: ast-analyzer-codec.js (v13.0.2), ast-analyzer-utils.js, ast-analyzer-core.js, ast-analyzer-ui.js, ast-analyzer-graph.js, ast-analyzer-tree.js, ast-analyzer-legend.js, ast-analyzer-paths.js'
);

await autoLoad();
