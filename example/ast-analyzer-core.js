// ============================================================================
// AST ANALYZER — CORE v9
// Ядро: парсинг графа, индексация, аналитика, запросы.
// Формат входа: index.full.json.json (ast-analyzer v8.0.0)
// ============================================================================

export const state = {
  raw: null,
  modules: {}, files: {}, functions: {}, classes: {}, constants: {},
  exports: [], imports: [], calls: [], reExports: [],

  fileExports: {}, fileImports: {}, fileFunctions: {}, fileClasses: {},
  fileConstants: {}, moduleFiles: {},

  fnById: {}, fnCalls: {}, fnCallers: {}, fnExports: {},
  fnImportTargets: {}, fnDetailedCallers: {}, fnDetailedCalls: {},
  fnByName: {},

  constById: {}, constByName: {},
  classById: {}, classByName: {},

  fileDependents: {}, fileDependencies: {},
  fileByPath: {}, moduleByName: {},

  externalCallers: {},

  deadExports: [], deadFunctions: [], cyclicDeps: [],
  hotFiles: [], hotFunctions: [],

  statistics: {}, version: '?', timestamp: '',

  // UI-состояние (разделяемое)
  selectedFileId: null,
  activeNode: null,
  searchQuery: '',
  depsOnly: false,
  expandAllFns: false,
  currentTab: 'overview',
};

// ---------------------------------------------------------------------------
// УТИЛИТЫ
// ---------------------------------------------------------------------------
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function shortPath(p, max = 40) {
  if (!p) return '';
  if (p.length <= max) return p;
  return '…' + p.slice(-(max - 1));
}

export function formatNumber(n) {
  if (n == null) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function formatDate(ts) {
  if (!ts) return '?';
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return ts; }
}

export function formatType(t, max = 80) {
  if (!t) return '';
  let s = String(t);
  s = s.replace(/import\("[^"]+"\)\./g, '');
  s = s.replace(/import\('[^']+'\)\./g, '');
  s = s.replace(/\s+/g, ' ');
  if (s.length > max) s = s.slice(0, max - 1) + '…';
  return s;
}

export function copyToClipboard(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
  return Promise.resolve();
}

export function downloadBlob(content, filename, mime = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(data, filename) {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function downloadCSV(rows, columns, filename) {
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = columns.map(c => esc(c.label || c.key)).join(',');
  const body = rows.map(r => columns
    .map(c => esc(typeof c.value === 'function' ? c.value(r) : r[c.key]))
    .join(',')
  ).join('\n');
  downloadBlob('\uFEFF' + header + '\n' + body, filename, 'text/csv;charset=utf-8');
}

export function downloadSVG(svgEl, filename) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const s = new XMLSerializer().serializeToString(clone);
  downloadBlob(s, filename, 'image/svg+xml');
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------------------
// PREPROCESS
// ---------------------------------------------------------------------------
export function preprocess(rawData) {
  const d = {
    modules: {}, files: {}, functions: {}, classes: {}, constants: {},
    exports: [], imports: [], calls: [], reExports: [],
    fileExports: {}, fileImports: {}, fileFunctions: {}, fileClasses: {},
    fileConstants: {}, moduleFiles: {},
    fnById: {}, fnCalls: {}, fnCallers: {}, fnExports: {},
    fnImportTargets: {}, fnDetailedCallers: {}, fnDetailedCalls: {},
    fnByName: {},
    constById: {}, constByName: {},
    classById: {}, classByName: {},
    fileDependents: {}, fileDependencies: {},
    fileByPath: {}, moduleByName: {},
    externalCallers: {},
    deadExports: [], deadFunctions: [], cyclicDeps: [],
    hotFiles: [], hotFunctions: [],
    statistics: rawData.statistics || {},
    version: rawData.version || '?',
    timestamp: rawData.timestamp || '',
  };

  for (const m of (rawData.modules || [])) {
    d.modules[m.id] = m;
    d.moduleFiles[m.id] = m.fileIds || [];
    d.moduleByName[m.name] = m;
  }

  for (const f of (rawData.files || [])) {
    d.files[f.id] = f;
    d.fileExports[f.id] = [];
    d.fileImports[f.id] = [];
    d.fileFunctions[f.id] = [];
    d.fileClasses[f.id] = [];
    d.fileConstants[f.id] = [];
    d.fileDependents[f.id] = [];
    d.fileDependencies[f.id] = [];
    d.fileByPath[f.path] = f;
  }

  for (const fn of (rawData.functions || [])) {
    d.functions[fn.id] = fn;
    d.fnById[fn.id] = fn;
    d.fnCalls[fn.id] = [];
    d.fnCallers[fn.id] = [];
    d.fnExports[fn.id] = [];
    d.fnImportTargets[fn.id] = [];
    d.fnDetailedCallers[fn.id] = [];
    d.fnDetailedCalls[fn.id] = [];
    if (d.fileFunctions[fn.fileId]) d.fileFunctions[fn.fileId].push(fn);
    if (!d.fnByName[fn.name]) d.fnByName[fn.name] = [];
    d.fnByName[fn.name].push(fn.id);
  }

  for (const c of (rawData.classes || [])) {
    d.classes[c.id] = c;
    d.classById[c.id] = c;
    d.classByName[c.name] = c;
    if (d.fileClasses[c.fileId]) d.fileClasses[c.fileId].push(c);
  }

  for (const cn of (rawData.constants || [])) {
    d.constants[cn.id] = cn;
    d.constById[cn.id] = cn;
    if (!d.constByName[cn.name]) d.constByName[cn.name] = [];
    d.constByName[cn.name].push(cn.id);
    if (d.fileConstants[cn.fileId]) d.fileConstants[cn.fileId].push(cn);
  }

  for (const e of (rawData.exports || [])) {
    d.exports.push(e);
    if (d.fileExports[e.fileId]) d.fileExports[e.fileId].push(e);
    if (e.functionId && d.fnExports[e.functionId]) d.fnExports[e.functionId].push(e);
  }

  for (const i of (rawData.imports || [])) {
    d.imports.push(i);
    if (d.fileImports[i.fromFileId]) d.fileImports[i.fromFileId].push(i);

    if (i.toFileId && !i.isExternal) {
      if (d.fileDependencies[i.fromFileId]) d.fileDependencies[i.fromFileId].push(i.toFileId);
      if (d.fileDependents[i.toFileId]) d.fileDependents[i.toFileId].push(i.fromFileId);

      const targetExports = d.fileExports[i.toFileId] || [];
      const importName = i.importedName;
      const matchedExport = targetExports.find(e =>
        e.exportName === importName ||
        e.localName === importName ||
        (importName === 'default' && e.isDefault) ||
        (i.isNamespace && e.isExported)
      );

      if (matchedExport && matchedExport.functionId) {
        d.fnImportTargets[matchedExport.functionId].push({
          toFileId: i.fromFileId,
          toFilePath: d.files[i.fromFileId]?.path || '?',
          toModuleName: d.modules[d.files[i.fromFileId]?.moduleId]?.name || '?',
          importName: i.localName || importName,
          originalName: importName,
          source: i.source,
          line: i.line,
          isDefault: i.isDefault,
          isNamespace: i.isNamespace,
          isTypeOnly: i.isTypeOnly,
          importId: i.id,
        });
      }
    }
  }

  for (const c of (rawData.calls || [])) {
    d.calls.push(c);
    if (d.fnCalls[c.fromFunctionId]) d.fnCalls[c.fromFunctionId].push(c);
    if (d.fnCallers[c.toFunctionId]) d.fnCallers[c.toFunctionId].push(c);

    const fromFn = d.fnById[c.fromFunctionId];
    const toFn = d.fnById[c.toFunctionId];
    const fromFilePath = fromFn ? (d.files[fromFn.fileId]?.path || '?') : '?';
    const fromFnName = fromFn ? fromFn.name : c.fromFunctionId;
    const toFnName = toFn ? toFn.name : c.toFunctionId;

    if (fromFn) {
      d.fnDetailedCalls[c.fromFunctionId].push({
        toFnId: c.toFunctionId,
        toFnName: toFnName,
        toFilePath: toFn ? (d.files[toFn.fileId]?.path || '?') : (c.toFunctionId.startsWith('external:') ? '🌐 external' : '?'),
        toModuleName: toFn ? (d.modules[d.files[toFn.fileId]?.moduleId]?.name || '?') : 'external',
        callLine: c.line,
        callType: c.type || 'direct',
        isExternal: c.toFunctionId.startsWith('external:'),
      });
    }

    if (toFn) {
      d.fnDetailedCallers[c.toFunctionId].push({
        fromFnId: c.fromFunctionId,
        fromFnName: fromFnName,
        fromFilePath: fromFilePath,
        fromModuleName: fromFn ? (d.modules[d.files[fromFn.fileId]?.moduleId]?.name || '?') : '?',
        callLine: c.line,
        callType: c.type || 'direct',
      });
    } else if (c.toFunctionId.startsWith('external:')) {
      const extName = c.toFunctionId.replace('external:', '');
      if (!d.externalCallers[extName]) d.externalCallers[extName] = [];
      d.externalCallers[extName].push({
        fromFnId: c.fromFunctionId,
        fromFnName: fromFnName,
        fromFilePath: fromFilePath,
        fromModuleName: fromFn ? (d.modules[d.files[fromFn.fileId]?.moduleId]?.name || '?') : '?',
        callLine: c.line,
        callType: c.type || 'direct',
      });
    }
  }

  for (const r of (rawData.reExports || [])) {
    d.reExports.push(r);
  }

  return d;
}

// ---------------------------------------------------------------------------
// ЗАГРУЗКА
// ---------------------------------------------------------------------------
export function loadData(json) {
  if (!json.files || !json.modules) {
    throw new Error('Неверный формат JSON: ожидаются поля files и modules');
  }
  state.raw = json;
  Object.assign(state, preprocess(json));
  computeAnalytics();
  return state;
}

// ---------------------------------------------------------------------------
// АНАЛИТИКА
// ---------------------------------------------------------------------------
export function computeAnalytics() {
  computeDeadExports();
  computeDeadFunctions();
  computeCyclicDeps();
  computeHotFiles();
  computeHotFunctions();
}

function computeDeadExports() {
  const used = new Set();
  for (const imp of state.imports) {
    if (imp.isExternal) continue;
    if (imp.importedName) used.add(imp.toFileId + '::' + imp.importedName);
  }
  state.deadExports = state.exports.filter(e => {
    if (e.isDefault) return false;
    return !used.has(e.fileId + '::' + (e.exportName || e.localName));
  });
}

function computeDeadFunctions() {
  state.deadFunctions = Object.values(state.functions).filter(fn => {
    const hasCallers = (state.fnDetailedCallers[fn.id] || []).length > 0;
    const isExported = (state.fnExports[fn.id] || []).length > 0;
    const isImported = (state.fnImportTargets[fn.id] || []).length > 0;
    return !hasCallers && !isExported && !isImported;
  });
}

function computeCyclicDeps() {
  const cycles = [];
  const visited = new Set();
  const stack = [];
  const inStack = new Set();

  function dfs(fileId) {
    if (inStack.has(fileId)) {
      const idx = stack.indexOf(fileId);
      if (idx >= 0) cycles.push(stack.slice(idx).concat(fileId));
      return;
    }
    if (visited.has(fileId)) return;
    visited.add(fileId);
    inStack.add(fileId);
    stack.push(fileId);
    for (const dep of new Set(state.fileDependencies[fileId] || [])) dfs(dep);
    stack.pop();
    inStack.delete(fileId);
  }

  for (const fileId of Object.keys(state.files)) dfs(fileId);

  const seen = new Set();
  state.cyclicDeps = cycles.filter(c => {
    const key = [...new Set(c)].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeHotFiles() {
  const arr = Object.keys(state.files).map(id => {
    const out = new Set(state.fileDependencies[id] || []).size;
    const inc = new Set(state.fileDependents[id] || []).size;
    return { id, out, inc, total: out + inc };
  });
  arr.sort((a, b) => b.total - a.total);
  state.hotFiles = arr.slice(0, 30);
}

function computeHotFunctions() {
  const arr = Object.values(state.functions).map(fn => {
    const callers = (state.fnDetailedCallers[fn.id] || []).length;
    const calls = (state.fnDetailedCalls[fn.id] || []).length;
    return { id: fn.id, callers, calls, total: callers + calls };
  });
  arr.sort((a, b) => b.total - a.total);
  state.hotFunctions = arr.slice(0, 30);
}

// ---------------------------------------------------------------------------
// ТРАНЗИТИВНЫЕ ВЫЗОВЫ
// ---------------------------------------------------------------------------
export function getTransitiveCallers(fnId, maxDepth = 5) {
  const result = new Set();
  const queue = [{ id: fnId, depth: 0 }];
  const seen = new Set([fnId]);
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth >= maxDepth) continue;
    for (const c of (state.fnDetailedCallers[id] || [])) {
      if (!result.has(c.fromFnId)) {
        result.add(c.fromFnId);
        if (!seen.has(c.fromFnId)) {
          seen.add(c.fromFnId);
          queue.push({ id: c.fromFnId, depth: depth + 1 });
        }
      }
    }
  }
  return Array.from(result).map(id => state.fnById[id]).filter(Boolean);
}

export function getTransitiveCallees(fnId, maxDepth = 5) {
  const result = new Set();
  const queue = [{ id: fnId, depth: 0 }];
  const seen = new Set([fnId]);
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth >= maxDepth) continue;
    for (const c of (state.fnDetailedCalls[id] || [])) {
      if (c.isExternal) continue;
      if (!result.has(c.toFnId)) {
        result.add(c.toFnId);
        if (!seen.has(c.toFnId)) {
          seen.add(c.toFnId);
          queue.push({ id: c.toFnId, depth: depth + 1 });
        }
      }
    }
  }
  return Array.from(result).map(id => state.fnById[id]).filter(Boolean);
}

export function findCallPaths(fromFnId, toFnId, maxDepth = 5) {
  const paths = [];
  const stack = [fromFnId];
  const visited = new Set();

  function dfs(current) {
    if (stack.length > maxDepth) return;
    if (current === toFnId) { paths.push([...stack]); return; }
    visited.add(current);
    for (const c of (state.fnDetailedCalls[current] || [])) {
      if (c.isExternal) continue;
      if (visited.has(c.toFnId)) continue;
      stack.push(c.toFnId);
      dfs(c.toFnId);
      stack.pop();
    }
    visited.delete(current);
  }

  dfs(fromFnId);
  return paths;
}

// ---------------------------------------------------------------------------
// ПОИСК
// ---------------------------------------------------------------------------
export function findFunctions(query, { caseSensitive = false, exact = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  const m = exact
    ? (s) => (caseSensitive ? s : s.toLowerCase()) === q
    : (s) => (caseSensitive ? s : s.toLowerCase()).includes(q);
  return Object.values(state.functions).filter(fn => m(fn.name));
}

export function findConstants(query, { caseSensitive = false, exact = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  const m = exact
    ? (s) => (caseSensitive ? s : s.toLowerCase()) === q
    : (s) => (caseSensitive ? s : s.toLowerCase()).includes(q);
  return Object.values(state.constants).filter(c => m(c.name));
}

export function findFiles(query, { caseSensitive = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  return Object.values(state.files).filter(f =>
    (caseSensitive ? f.path : f.path.toLowerCase()).includes(q)
  );
}

export function findModules(query, { caseSensitive = false } = {}) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  return Object.values(state.modules).filter(m =>
    (caseSensitive ? m.name : m.name.toLowerCase()).includes(q)
  );
}

// ---------------------------------------------------------------------------
// СТАТИСТИКА
// ---------------------------------------------------------------------------
export function getProjectStats() {
  const totalFiles = Object.keys(state.files).length;
  const totalFunctions = Object.keys(state.functions).length;
  const totalModules = Object.keys(state.modules).length;
  const totalConstants = Object.keys(state.constants).length;
  const totalCalls = state.calls.length;
  const totalImports = state.imports.length;
  const totalExports = state.exports.length;
  const totalReExports = state.reExports.length;

  const internalImports = state.imports.filter(i => !i.isExternal).length;
  const externalImports = state.imports.filter(i => i.isExternal).length;

  const externalPkgs = new Set();
  for (const i of state.imports) {
    if (i.isExternal && i.packageName) externalPkgs.add(i.packageName);
  }

  return {
    totalFiles, totalFunctions, totalModules, totalConstants,
    totalCalls, totalImports, totalExports, totalReExports,
    internalImports, externalImports,
    externalPackages: Array.from(externalPkgs).sort(),
    deadExports: state.deadExports.length,
    deadFunctions: state.deadFunctions.length,
    cyclicDeps: state.cyclicDeps.length,
    version: state.version,
    timestamp: state.timestamp,
  };
}

export function getModuleStats(moduleId) {
  const m = state.modules[moduleId];
  if (!m) return null;
  const fileIds = state.moduleFiles[moduleId] || [];
  let fnCount = 0, constCount = 0, exportCount = 0, importCount = 0;
  for (const fid of fileIds) {
    fnCount += (state.fileFunctions[fid] || []).length;
    constCount += (state.fileConstants[fid] || []).length;
    exportCount += (state.fileExports[fid] || []).length;
    importCount += (state.fileImports[fid] || []).length;
  }
  return { ...m, fileCount: fileIds.length, fnCount, constCount, exportCount, importCount };
}

// ---------------------------------------------------------------------------
// ДОСТУП
// ---------------------------------------------------------------------------
export function getModuleName(id) { return state.modules[id]?.name || id; }
export function getFilePath(id) { return state.files[id]?.path || id; }
export function getFnById(id) { return state.fnById[id] || null; }
export function getFileById(id) { return state.files[id] || null; }
export function getModuleById(id) { return state.modules[id] || null; }

export function getFnFullInfo(fnId) {
  const fn = state.fnById[fnId];
  if (!fn) return null;
  const file = state.files[fn.fileId];
  const module = file ? state.modules[file.moduleId] : null;
  return {
    fn, file, module,
    exports: state.fnExports[fnId] || [],
    imports: state.fnImportTargets[fnId] || [],
    calls: state.fnDetailedCalls[fnId] || [],
    callers: state.fnDetailedCallers[fnId] || [],
  };
}

export function getImportedNames(importerId, targetId) {
  const list = (state.fileImports[importerId] || []).filter(i => i.toFileId === targetId);
  const names = [];
  for (const i of list) {
    if (i.isNamespace) names.push('*');
    else if (i.isDefault) names.push('default');
    else if (i.importedName) names.push(i.importedName);
  }
  return [...new Set(names)];
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ ВСЕГО
// ---------------------------------------------------------------------------
export function exportAll() {
  return {
    version: state.version,
    timestamp: state.timestamp,
    statistics: state.statistics,
    projectStats: getProjectStats(),
    modules: Object.values(state.modules),
    files: Object.values(state.files),
    functions: Object.values(state.functions),
    constants: Object.values(state.constants),
    exports: state.exports,
    imports: state.imports,
    calls: state.calls,
    reExports: state.reExports,
    deadExports: state.deadExports,
    deadFunctions: state.deadFunctions,
    cyclicDeps: state.cyclicDeps,
  };
}
