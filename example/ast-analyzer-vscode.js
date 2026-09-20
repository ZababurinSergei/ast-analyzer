// ============================================================================
// AST ANALYZER — VSCODE v1.1
// Формирование vscode:// ссылок на файлы, функции, классы, константы.
//
// Публичный API:
//   buildVscodeUrl({ path, line, column, basePath, scheme })
//   fileVscodeUrl(fileId, line, column?)
//   fileVscodeUrlByPath(path, line, column?)
//   fnVscodeUrl(fnId)
//   classVscodeUrl(clsId)
//   constVscodeUrl(cnId)
//   moduleVscodeUrl(moduleId, line?)
//   exportVscodeUrl(exportId)
//   importVscodeUrl(importId)
//   linkHtml(url, label, opts?)
//   renderVscodeIcon({ fileId, path, line, column, label, title })
//   renderVscodeBadge({ fileId, path, line, column, short })
//   getVscodeConfig() / setVscodeConfig(cfg) / setVscodeConfigPersistent(cfg)
//   createBasePathForm(opts) / showBasePathModal(opts)
//   detectBasePath()
//   buildVscodeStyles() / buildVscodeFormStyles()
//
// Особенности:
//   - Только vscode://file/ (стандарт VS Code)
//   - POSIX/Windows пути
//   - Опциональный basePath (если в JSON относительные пути)
//   - Нет line → нет :line суффикса
//   - HTML-ссылка с target=_blank и rel=noopener
//   - Иконки для UI: 🔗 VS Code
//   - Форма ввода basePath с визуальным откликом
//   - Персистентность через localStorage
// ============================================================================

import { state, escapeHtml, shortPath } from './ast-analyzer-core.js';

// ---------------------------------------------------------------------------
// КОНФИГ
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  scheme: 'vscode', // 'vscode' | 'vscode-insiders'
  basePath: '', // префикс для относительных путей
  openInNewTab: true,
  iconLabel: 'VS Code',
  iconChar: '🔗',
};

let _config = { ...DEFAULT_CONFIG };

export function getVscodeConfig() {
  return { ..._config };
}

export function setVscodeConfig(cfg = {}) {
  _config = { ..._config, ...cfg };
  return { ..._config };
}

// ---------------------------------------------------------------------------
// ПЕРСИСТЕНТНОСТЬ (localStorage)
// ---------------------------------------------------------------------------

const LS_VSCODE_KEY = 'ast-analyzer:v13:vscode-config';

function loadPersistedConfig() {
  try {
    const raw = localStorage.getItem(LS_VSCODE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      _config = { ..._config, ...saved };
    }
  } catch (e) {
    console.warn('[VSCode] Не удалось загрузить сохранённый конфиг:', e.message);
  }
}

function persistConfig() {
  try {
    localStorage.setItem(LS_VSCODE_KEY, JSON.stringify(_config));
  } catch (e) {
    console.warn('[VSCode] Не удалось сохранить конфиг:', e.message);
  }
}

// Автозагрузка при импорте модуля
loadPersistedConfig();

/**
 * Сохраняет конфиг + пишет в localStorage.
 */
export function setVscodeConfigPersistent(cfg = {}) {
  const result = setVscodeConfig(cfg);
  persistConfig();
  return result;
}

/**
 * Автоопределение basePath из URL страницы.
 */
export function detectBasePath() {
  try {
    const url = new URL(window.location.href);
    if (url.protocol === 'file:') {
      return decodeURIComponent(url.pathname.replace(/\/[^/]*$/, ''));
    }
    if (url.protocol.startsWith('http')) {
      return url.pathname.replace(/\/[^/]*$/, '');
    }
  } catch {}
  return '';
}

// ---------------------------------------------------------------------------
// НИЗКОУРОВНЕВАЯ СБОРКА URL
// ---------------------------------------------------------------------------

function normalizePathForVscode(path, basePath = '') {
  if (!path) return '';

  let p = String(path).replace(/\\/g, '/');

  // Windows drive letter: 'C:/...' → '/c:/...'
  if (/^[a-zA-Z]:\//.test(p)) {
    p = '/' + p[0].toLowerCase() + p.slice(2);
  }

  p = p.replace(/^\.\//, '');
  p = p.replace(/\/{2,}/g, '/');

  const isAbsolute = p.startsWith('/');
  if (!isAbsolute && basePath) {
    const bp = String(basePath).replace(/\\/g, '/').replace(/\/+$/, '');
    p = bp + '/' + p;
  }

  p = p
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');

  return p;
}

export function buildVscodeUrl(opts = {}) {
  const { path, line, column, basePath = _config.basePath, scheme = _config.scheme } = opts;

  if (!path) return null;

  const norm = normalizePathForVscode(path, basePath);
  if (!norm) return null;

  let url = `${scheme}://file${norm}`;

  if (line != null && line !== '' && Number.isFinite(Number(line))) {
    url += `:${Number(line)}`;
    if (column != null && column !== '' && Number.isFinite(Number(column))) {
      url += `:${Number(column)}`;
    }
  }

  return url;
}

// ---------------------------------------------------------------------------
// ХЕЛПЕРЫ
// ---------------------------------------------------------------------------

function pathOfFile(fileId) {
  if (!fileId) return null;
  return state.files[fileId]?.path || null;
}

function pathOfFn(fnId) {
  const fn = state.fnById[fnId];
  if (!fn) return null;
  return { path: pathOfFile(fn.fileId), line: fn.line };
}

function pathOfClass(clsId) {
  const c = state.classById?.[clsId] || state.classes?.[clsId];
  if (!c) return null;
  return { path: pathOfFile(c.fileId), line: c.line };
}

function pathOfConst(cnId) {
  const c = state.constById?.[cnId] || state.constants?.[cnId];
  if (!c) return null;
  return { path: pathOfFile(c.fileId), line: c.line };
}

// ---------------------------------------------------------------------------
// ПУБЛИЧНЫЕ ОБЁРТКИ
// ---------------------------------------------------------------------------

export function fileVscodeUrl(fileId, line, column) {
  const p = pathOfFile(fileId);
  if (!p) return null;
  return buildVscodeUrl({ path: p, line, column });
}

export function fileVscodeUrlByPath(path, line, column) {
  return buildVscodeUrl({ path, line, column });
}

export function fnVscodeUrl(fnId) {
  const info = pathOfFn(fnId);
  if (!info || !info.path) return null;
  return buildVscodeUrl({ path: info.path, line: info.line });
}

export function classVscodeUrl(clsId) {
  const info = pathOfClass(clsId);
  if (!info || !info.path) return null;
  return buildVscodeUrl({ path: info.path, line: info.line });
}

export function constVscodeUrl(cnId) {
  const info = pathOfConst(cnId);
  if (!info || !info.path) return null;
  return buildVscodeUrl({ path: info.path, line: info.line });
}

export function moduleVscodeUrl(moduleId, line) {
  const fileIds = state.moduleFiles?.[moduleId] || [];
  if (!fileIds.length) return null;
  const firstId = fileIds[0];
  return fileVscodeUrl(firstId, line);
}

export function exportVscodeUrl(exportId) {
  const ex = (state.exports || []).find(e => e.id === exportId);
  if (!ex) return null;
  if (ex.functionId && state.fnById[ex.functionId]) {
    const fn = state.fnById[ex.functionId];
    return fileVscodeUrl(fn.fileId, fn.line);
  }
  return fileVscodeUrl(ex.fileId, ex.line);
}

export function importVscodeUrl(importId) {
  const im = (state.imports || []).find(i => i.id === importId);
  if (!im) return null;
  return fileVscodeUrl(im.fromFileId, im.line);
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

export function linkHtml(url, label, opts = {}) {
  if (!url) return '';
  const { className = 'vscode-link', title = 'Открыть в VS Code', icon = _config.iconChar } = opts;

  const text = label || url.replace(/^vscode(-insiders)?:\/\/file/, '');
  const target = _config.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';

  return `<a class="${escapeHtml(className)}" href="${escapeHtml(url)}" title="${escapeHtml(
    title
  )}"${target}>${icon ? `${icon} ` : ''}${escapeHtml(text)}</a>`;
}

export function renderVscodeIcon(opts = {}) {
  const { fileId, path, line, column, label, title, className } = opts;
  const url = path ? buildVscodeUrl({ path, line, column }) : fileVscodeUrl(fileId, line, column);
  if (!url) return '';
  return linkHtml(url, label || _config.iconLabel, {
    className: className || 'vscode-icon',
    title: title || `Открыть в VS Code${line ? ` (L${line})` : ''}`,
  });
}

export function renderVscodeBadge(opts = {}) {
  const { fileId, path, line, column, short = false } = opts;

  const url = path ? buildVscodeUrl({ path, line, column }) : fileVscodeUrl(fileId, line, column);

  if (!url) return '';

  injectStyles();

  const label = short ? '↗' : '🔗 VS Code';
  const title = `Открыть в VS Code${line ? ` (L${line})` : ''}`;

  return `<a class="vscode-badge" href="${escapeHtml(url)}" title="${escapeHtml(
    title
  )}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

// ---------------------------------------------------------------------------
// СТИЛИ
// ---------------------------------------------------------------------------

const VSCODE_STYLES = `
.vscode-link {
  color: var(--accent, #58a6ff);
  text-decoration: none;
  font-family: 'Consolas', monospace;
  font-size: 11px;
  transition: color 0.15s;
}
.vscode-link:hover { text-decoration: underline; }

.vscode-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 4px;
  color: var(--accent, #58a6ff);
  text-decoration: none;
  font-size: 10px;
  font-family: monospace;
  transition: all 0.15s;
}
.vscode-icon:hover {
  border-color: var(--accent, #58a6ff);
  background: var(--bg4, #30363d);
}

.vscode-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 10px;
  color: var(--accent, #58a6ff);
  text-decoration: none;
  font-size: 10px;
  font-family: monospace;
  white-space: nowrap;
  transition: all 0.15s;
}
.vscode-badge:hover {
  border-color: var(--accent, #58a6ff);
  background: var(--bg4, #30363d);
}
`;

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('ast-vscode-styles')) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'ast-vscode-styles';
  style.textContent = VSCODE_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}

export function buildVscodeStyles() {
  return VSCODE_STYLES;
}

// ---------------------------------------------------------------------------
// UI: ФОРМА ВВОДА basePath
// ---------------------------------------------------------------------------

export function createBasePathForm(opts = {}) {
  const { onChange = null, compact = false } = opts;

  injectStyles();
  injectFormStyles();

  const wrap = document.createElement('div');
  wrap.className = 'vscode-form' + (compact ? ' vscode-form-compact' : '');

  const cfg = getVscodeConfig();

  wrap.innerHTML = `
    <div class="vscode-form-row">
      <label class="vscode-form-label" for="vscode-basepath-input">
        📁 basePath (корень проекта)
      </label>
      <input
        id="vscode-basepath-input"
        class="vscode-form-input"
        type="text"
        placeholder="/home/user/project или c:/projects/app"
        value="${escapeHtml(cfg.basePath || '')}"
        spellcheck="false"
        autocomplete="off"
      />
      <button class="vscode-form-btn vscode-form-btn-detect" title="Определить автоматически из URL страницы">
        🎯 Авто
      </button>
      <button class="vscode-form-btn vscode-form-btn-save" title="Сохранить (Ctrl+S)">
        💾 Сохранить
      </button>
    </div>
    <div class="vscode-form-row">
      <label class="vscode-form-label" for="vscode-scheme-select">
        🧩 Схема
      </label>
      <select id="vscode-scheme-select" class="vscode-form-select">
        <option value="vscode"${cfg.scheme === 'vscode' ? ' selected' : ''}>vscode://</option>
        <option value="vscode-insiders"${cfg.scheme === 'vscode-insiders' ? ' selected' : ''}>vscode-insiders://</option>
      </select>
      <span class="vscode-form-preview" id="vscode-preview">
        ${renderPreview(cfg)}
      </span>
    </div>
    <div class="vscode-form-status" id="vscode-status"></div>
    <div class="vscode-form-hint">
      💡 Путь должен быть <b>абсолютным</b>. Если в JSON относительные пути — укажите корень проекта.
    </div>
  `;

  const input = wrap.querySelector('#vscode-basepath-input');
  const select = wrap.querySelector('#vscode-scheme-select');
  const preview = wrap.querySelector('#vscode-preview');
  const status = wrap.querySelector('#vscode-status');
  const btnDetect = wrap.querySelector('.vscode-form-btn-detect');
  const btnSave = wrap.querySelector('.vscode-form-btn-save');

  let statusTimer = null;
  const showStatus = (text, kind = 'ok', duration = 3000) => {
    status.className = 'vscode-form-status vscode-form-status-' + kind;
    status.innerHTML = text;
    status.style.opacity = '1';
    clearTimeout(statusTimer);
    if (duration > 0) {
      statusTimer = setTimeout(() => {
        status.style.opacity = '0.5';
      }, duration);
    }
  };

  const flashInput = (cls = 'ok') => {
    input.classList.add('vscode-input-' + cls);
    setTimeout(() => input.classList.remove('vscode-input-' + cls), 1000);
  };

  const flashButton = (text, cls = 'ok', duration = 1500) => {
    const original = btnSave.innerHTML;
    btnSave.innerHTML = text;
    btnSave.classList.add('vscode-form-btn-' + cls);
    btnSave.disabled = true;
    setTimeout(() => {
      btnSave.innerHTML = original;
      btnSave.classList.remove('vscode-form-btn-' + cls);
      btnSave.disabled = false;
    }, duration);
  };

  const updatePreview = () => {
    preview.innerHTML = renderPreview(getVscodeConfig());
  };

  const save = (source = 'manual') => {
    const newBasePath = input.value.trim();
    const newScheme = select.value;
    const oldCfg = getVscodeConfig();

    const changed = oldCfg.basePath !== newBasePath || oldCfg.scheme !== newScheme;

    setVscodeConfigPersistent({
      basePath: newBasePath,
      scheme: newScheme,
    });

    updatePreview();

    const now = new Date().toLocaleTimeString('ru-RU');
    if (!newBasePath) {
      showStatus(`⚠️ basePath <b>очищен</b> · схема: <code>${newScheme}</code> · ${now}`, 'warn');
      flashInput('warn');
      flashButton('⚠️ Пусто', 'warn');
      _notifyToast('basePath очищен', 'warn');
    } else if (!changed && source === 'manual') {
      showStatus(`ℹ️ Без изменений · <code>${escapeHtml(newBasePath)}</code> · ${now}`, 'info');
      flashInput('info');
      flashButton('ℹ️ Без изменений', 'info');
      _notifyToast('basePath не изменился', 'info');
    } else {
      showStatus(
        `✓ Сохранено: <code>${escapeHtml(newBasePath)}</code> · схема: <code>${newScheme}</code> · ${now}`,
        'ok'
      );
      flashInput('ok');
      flashButton('✓ Сохранено', 'ok');
      _notifyToast('basePath сохранён', 'success');
    }

    if (typeof onChange === 'function') {
      onChange(getVscodeConfig());
    }
  };

  btnSave.addEventListener('click', () => save('manual'));

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save('enter');
    }
  });

  input.addEventListener('input', () => {
    const tmp = { ...getVscodeConfig(), basePath: input.value.trim() };
    preview.innerHTML = renderPreview(tmp);
    showStatus('✎ Есть несохранённые изменения', 'info', 0);
  });

  select.addEventListener('change', () => save('select'));

  btnDetect.addEventListener('click', () => {
    const detected = detectBasePath();
    input.value = detected;
    save('detect');
  });

  wrap.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save('ctrl-s');
    }
  });

  if (cfg.basePath) {
    showStatus(
      `Текущий: <code>${escapeHtml(cfg.basePath)}</code> · схема: <code>${cfg.scheme}</code>`,
      'info',
      0
    );
  } else {
    showStatus('basePath не задан — ссылки VS Code работать не будут', 'warn', 0);
  }

  return wrap;
}

function renderPreview(cfg) {
  const samplePath = 'src/utils.ts';
  const url = buildVscodeUrl({
    path: samplePath,
    line: 42,
    basePath: cfg.basePath,
    scheme: cfg.scheme,
  });
  if (!url) {
    return `<span class="vscode-preview-empty">Путь не задан</span>`;
  }
  return `<code class="vscode-preview-code">${escapeHtml(url)}</code>`;
}

export function showBasePathModal(opts = {}) {
  injectStyles();
  injectFormStyles();

  const existing = document.getElementById('vscodeBasePathModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'vscode-modal-overlay';
  overlay.id = 'vscodeBasePathModal';

  overlay.innerHTML = `
    <div class="vscode-modal">
      <div class="vscode-modal-header">
        <h3>🔗 Настройка ссылок VS Code</h3>
        <button class="vscode-modal-close" id="vscodeModalClose" title="Закрыть (Esc)">×</button>
      </div>
      <div class="vscode-modal-body"></div>
    </div>
  `;

  const body = overlay.querySelector('.vscode-modal-body');

  const handleChange = cfg => {
    if (typeof opts.onChange === 'function') {
      try {
        opts.onChange(cfg);
      } catch (e) {
        console.warn('[VSCode] onChange error:', e.message);
      }
    }

    _showModalToast(
      overlay,
      cfg.basePath
        ? `✓ basePath сохранён: ${cfg.basePath}`
        : '⚠️ basePath очищен — ссылки работать не будут',
      cfg.basePath ? 'ok' : 'warn'
    );

    if (typeof window !== 'undefined' && typeof window.__astToast === 'function') {
      window.__astToast(
        cfg.basePath ? 'basePath сохранён' : 'basePath очищен',
        cfg.basePath ? 'success' : 'warn'
      );
    }
  };

  const form = createBasePathForm({ onChange: handleChange });
  body.appendChild(form);

  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('#vscodeModalClose').addEventListener('click', close);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });
  const escHandler = e => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  requestAnimationFrame(() => overlay.classList.add('show'));
}

function _showModalToast(overlay, text, kind = 'ok') {
  let el = overlay.querySelector('.vscode-modal-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'vscode-modal-toast';
    overlay.querySelector('.vscode-modal').appendChild(el);
  }
  el.textContent = text;
  el.className = 'vscode-modal-toast vscode-modal-toast-' + kind;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove('show');
  }, 2500);
}

function _notifyToast(msg, type = 'info') {
  try {
    if (typeof window !== 'undefined' && typeof window.__astToast === 'function') {
      window.__astToast(msg, type);
      return;
    }
    _ownToast(msg, type);
  } catch (e) {
    console.warn('[VSCode] toast error:', e.message);
  }
}

let _ownToastEl = null;
let _ownToastTimer = null;

function _ownToast(msg, type = '') {
  if (typeof document === 'undefined') return;
  if (!_ownToastEl) {
    _ownToastEl = document.createElement('div');
    _ownToastEl.className = 'toast';
    document.body.appendChild(_ownToastEl);
  }
  _ownToastEl.textContent = msg;
  _ownToastEl.className = 'toast show ' + type;
  clearTimeout(_ownToastTimer);
  _ownToastTimer = setTimeout(() => {
    _ownToastEl.className = 'toast';
  }, 2200);
}

// ---------------------------------------------------------------------------
// СТИЛИ ФОРМЫ
// ---------------------------------------------------------------------------

const VSCODE_FORM_STYLES = `
.vscode-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg3, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
}

.vscode-form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.vscode-form-label {
  flex-shrink: 0;
  color: var(--text2, #8b949e);
  font-size: 11px;
  min-width: 140px;
}

.vscode-form-input {
  flex: 1;
  min-width: 200px;
  padding: 6px 10px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 6px;
  color: var(--text, #e6edf3);
  font-family: 'Consolas', monospace;
  font-size: 11px;
  outline: none;
  transition: border-color 0.15s;
}
.vscode-form-input:focus {
  border-color: var(--accent, #58a6ff);
}
.vscode-form-input::placeholder {
  color: var(--text2, #8b949e);
  opacity: 0.6;
}

.vscode-form-select {
  padding: 6px 10px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 6px;
  color: var(--text, #e6edf3);
  font-family: 'Consolas', monospace;
  font-size: 11px;
  outline: none;
  cursor: pointer;
}
.vscode-form-select:focus {
  border-color: var(--accent, #58a6ff);
}

.vscode-form-btn {
  padding: 6px 12px;
  background: var(--bg4, #30363d);
  border: 1px solid var(--border, #30363d);
  border-radius: 6px;
  color: var(--text, #e6edf3);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.15s;
}
.vscode-form-btn:hover {
  border-color: var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}
.vscode-form-btn:disabled {
  cursor: default;
  opacity: 0.9;
}
.vscode-form-btn-save {
  background: var(--accent, #58a6ff);
  color: #fff;
  border-color: var(--accent, #58a6ff);
}
.vscode-form-btn-save:hover {
  filter: brightness(1.1);
  color: #fff;
}

.vscode-form-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vscode-preview-code {
  display: inline-block;
  padding: 3px 8px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 10px;
  color: var(--accent, #58a6ff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.vscode-preview-empty {
  color: var(--text2, #8b949e);
  font-style: italic;
  font-size: 11px;
}

.vscode-form-hint {
  color: var(--text2, #8b949e);
  font-size: 10px;
  line-height: 1.5;
}

.vscode-form-compact {
  padding: 8px 10px;
  gap: 6px;
}
.vscode-form-compact .vscode-form-label { min-width: auto; }

/* --- Статус под формой --- */
.vscode-form-status {
  min-height: 16px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: var(--text2, #8b949e);
  padding: 4px 6px;
  border-radius: 4px;
  transition: opacity 0.3s, background 0.15s;
  word-break: break-all;
}
.vscode-form-status code {
  background: var(--bg, #0d1117);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--accent, #58a6ff);
  font-family: inherit;
}
.vscode-form-status-ok {
  color: var(--green, #3fb950);
  background: rgba(63, 185, 80, 0.08);
  border: 1px solid rgba(63, 185, 80, 0.25);
}
.vscode-form-status-warn {
  color: var(--yellow, #d29922);
  background: rgba(210, 153, 34, 0.08);
  border: 1px solid rgba(210, 153, 34, 0.25);
}
.vscode-form-status-info {
  color: var(--text2, #8b949e);
  background: rgba(139, 148, 158, 0.06);
  border: 1px solid rgba(139, 148, 158, 0.2);
}

/* --- Подсветка поля --- */
.vscode-form-input.vscode-input-ok {
  border-color: var(--green, #3fb950);
  box-shadow: 0 0 0 2px rgba(63, 185, 80, 0.15);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.vscode-form-input.vscode-input-warn {
  border-color: var(--yellow, #d29922);
  box-shadow: 0 0 0 2px rgba(210, 153, 34, 0.15);
}
.vscode-form-input.vscode-input-info {
  border-color: var(--text2, #8b949e);
}

/* --- Кнопка Сохранить: временные состояния --- */
.vscode-form-btn-save.vscode-form-btn-ok {
  background: var(--green, #3fb950) !important;
  border-color: var(--green, #3fb950) !important;
  color: #fff !important;
}
.vscode-form-btn-save.vscode-form-btn-warn {
  background: var(--yellow, #d29922) !important;
  border-color: var(--yellow, #d29922) !important;
  color: #000 !important;
}
.vscode-form-btn-save.vscode-form-btn-info {
  background: var(--bg4, #30363d) !important;
  border-color: var(--text2, #8b949e) !important;
  color: var(--text2, #8b949e) !important;
}

/* --- Модалка --- */
.vscode-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
  padding: 20px;
}
.vscode-modal-overlay.show { display: flex; }

.vscode-modal {
  position: relative;
  background: var(--bg2, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 12px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}

.vscode-modal-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border, #30363d);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg3, #21262d);
}
.vscode-modal-header h3 {
  font-size: 15px;
  margin: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.vscode-modal-close {
  background: none;
  border: none;
  color: var(--text2, #8b949e);
  font-size: 24px;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}
.vscode-modal-close:hover { color: var(--text, #e6edf3); }

.vscode-modal-body {
  padding: 20px;
  overflow-y: auto;
}

/* --- Тост внутри модалки --- */
.vscode-modal-toast {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 12px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s, transform 0.25s;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 10;
  max-width: 90%;
  text-align: center;
}
.vscode-modal-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.vscode-modal-toast-ok {
  background: var(--green, #3fb950);
  color: #fff;
  border: 1px solid var(--green, #3fb950);
}
.vscode-modal-toast-warn {
  background: var(--yellow, #d29922);
  color: #000;
  border: 1px solid var(--yellow, #d29922);
}
`;

let _formStylesInjected = false;
function injectFormStyles() {
  if (_formStylesInjected) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('ast-vscode-form-styles')) {
    _formStylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'ast-vscode-form-styles';
  style.textContent = VSCODE_FORM_STYLES;
  document.head.appendChild(style);
  _formStylesInjected = true;
}

export function buildVscodeFormStyles() {
  return VSCODE_FORM_STYLES;
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ
// ---------------------------------------------------------------------------

export default {
  buildVscodeUrl,
  fileVscodeUrl,
  fileVscodeUrlByPath,
  fnVscodeUrl,
  classVscodeUrl,
  constVscodeUrl,
  moduleVscodeUrl,
  exportVscodeUrl,
  importVscodeUrl,
  linkHtml,
  renderVscodeIcon,
  renderVscodeBadge,
  getVscodeConfig,
  setVscodeConfig,
  setVscodeConfigPersistent,
  detectBasePath,
  createBasePathForm,
  showBasePathModal,
  buildVscodeStyles,
  buildVscodeFormStyles,
};
