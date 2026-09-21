// ============================================================================
// AST ANALYZER — LOCATION BAR v1.6
// Адресная строка как в браузере: путь, кнопки ◀ ▶ ⟳ ⌂, история переходов.
//
// Публичный API:
//   LocationBar.mount(opts)                       — примонтировать панель
//   LocationBar.unmount()
//   LocationBar.refresh()                         — перестроить текущий URL из state
//   LocationBar.navigate(path, opts?)             — перейти по пути
//   LocationBar.goBack() / goForward() / reload() / goHome()
//   LocationBar.setPathResolver(fn)               — своя логика парсинга
//   LocationBar.getHistory() / getCurrent()
//   LocationBar.buildStyles()
//   LocationBar.getExtensionsSlot()               — DOM-элемент слота расширений
//   LocationBar.clearLastPath() / getLastPath()   — управление сохранённым путём
//
// Модель пути:
//   universe / module / <остаток file.path относительно module> / fn
//
// Особенности:
//   - URL-подобная строка с inline-редактированием
//   - Кнопки: ◀ назад, ▶ вперёд, ⟳ обновить, ⌂ universe, 🔗 VS Code, ▾/▸ toggle-header
//   - История переходов в памяти (не ломает window.history)
//   - Синхронизация с basePath из ast-analyzer-vscode.js
//   - Подсветка частей пути: корень (basePath), модуль, файл, функция
//   - Autocomplete по мере ввода (модули/файлы/функции)
//   - Enter — переход, Esc — отмена
//   - F5 — reload (эмуляция обновления страницы)
//
// v1.1:
//   - renderSegmentsHtml(): разделитель "/" без пробелов вокруг
//   - buildStyles(): фон и рамка перенесены на .ast-loc-input-wrap,
//     .ast-loc-input стал прозрачным (без фона и без цвета текста),
//     .ast-loc-display виден сквозь прозрачный input (z-index 1 < 2)
//   - .ast-loc-seg.sep: margin: 0 2px (визуальный отступ без text-пробелов)
//   - .ast-loc-seg.*::before: иконки через CSS-контент
//
// v1.2:
//   - stripModulePrefix(filePath, moduleName) — убирает префикс module
//     из file.path, если он там есть (src/utils.ts + module=src → utils.ts)
//   - pathForFn / pathForFile — добавляют module, но file.path без префикса
//   - displayPathToText() — join('/') БЕЗ пробелов
//   - parsePath() — учитывает, что после module файл может быть без префикса:
//     пробует modName + '/' + rest как кандидата для поиска
//   - collectSuggestions() — text собирается как universe/module/stripped/fn
//   - renderShell() — убран <span class="ast-loc-prefix">🌌</span>
//     (🌌 теперь только через ::before у .ast-loc-seg.universe)
//   - buildStyles() — .ast-loc-prefix удалён; padding-left: 12px
//
// v1.3:
//   - Кнопка ⚙ setup ЗАМЕНЕНА на ▾/▸ toggle-header
//   - toggleHeader(btn) — показывает/скрывает .hdr (шапку приложения)
//   - restoreHeaderState() — восстанавливает состояние шапки из localStorage
//     при mount()
//   - Убрана функция openSetup() (настройки basePath остались только в .hdr
//     через кнопку btnVscodeSetup)
//   - buildStyles() — добавлен CSS .hdr.hdr-hidden { display: none !important; }
//   - Обновляется CSS-переменная --hdr-height при toggle (для Nav)
//   - Состояние сохраняется в localStorage 'ast-analyzer:header-hidden'
//
// v1.4:
//   - ✅ Добавлен слот расширений #astLocExtSlot между кнопками
//     vscode 🔗 и toggle-header ▾. Сюда монтируются кнопки из
//     ast-analyzer-extensions.js (например, 🧭 навигация по секциям).
//   - ✅ buildStyles(): добавлен .ast-loc-ext-slot { position: relative;
//     display: inline-flex; align-items: center; gap: 2px; }
//   - ✅ Новый экспорт getExtensionsSlot() — возвращает DOM-элемент
//     слота расширений (или null, если панель не смонтирована).
//     Используется в main.js для Extensions.renderInto(slot).
//   - ✅ renderShell() дополнен <span class="ast-loc-ext-slot"
//     id="astLocExtSlot"></span>
//
// v1.5:
//   - ✅ Персистентность пути: последний {kind, id} сохраняется в
//     localStorage (LS_LAST_PATH) и восстанавливается при mount(),
//     если он ещё валиден в текущем state.
//   - ✅ Относительный ввод: stripBasePathFromInput() срезает basePath
//     (с ведущим слэшем или без) и ведущие слэши — пользователь вводит
//     путь относительно корня проекта.
//   - ✅ modulePathFromFile(file) — модуль вычисляется как "путь от корня"
//     (src/formal, а не formal). Используется в pathForFn / pathForFile /
//     pathForModule.
//   - ✅ displayFnName(name) — в отображении убирает префикс "Anonymous.".
//   - ✅ parsePath(): fallback на "Anonymous.<name>" при поиске функции;
//     fallback на поиск модуля по "пути от корня" через findModuleByPath.
//   - ✅ clearLastPath() / getLastPath() — управление сохранённым путём.
//
// v1.6 (ТЕКУЩАЯ):
//   - ✅ applyEntry(): учёт opts.silent — при silent НЕ вызывается S.onChange.
//     Это устраняет двойной renderTree при клике по файлу в дереве:
//     selectFile() → syncFromSelection() → applyEntry() → onChange() →
//     renderTree() (второй раз, с expandActiveFile=true) → файл раскрывался.
//   - ✅ syncFromSelection(): всегда передаёт silent: true в applyEntry.
//     Внешний код (main.js) сам рендерит дерево/панель после вызова
//     syncFromSelection — onChange здесь не нужен и вреден.
//   - ✅ clearLastPath() / getLastPath() — без изменений.
// ============================================================================

import { state, escapeHtml, shortPath, middleEllipsis } from './ast-analyzer-core.js';
import * as Vscode from './ast-analyzer-vscode.js';

const STYLE_ID = 'ast-location-styles';
const ROOT_ID = 'astLocationBar';
const LS_HEADER_HIDDEN = 'ast-analyzer:header-hidden';
const LS_LAST_PATH = 'ast-analyzer:location-bar:last-path';

// ---------------------------------------------------------------------------
// СОСТОЯНИЕ
// ---------------------------------------------------------------------------

const S = {
  root: null, // HTMLElement
  history: [], // [{ path, kind, id, ts }]
  index: -1, // текущая позиция в history
  editing: false, // режим редактирования input
  suggestions: [], // текущие подсказки
  suggestionIdx: -1,
  resolve: null, // (path) => { kind, id } | null
  onChange: null, // (entry) => void
};

// ---------------------------------------------------------------------------
// СТИЛИ
// ---------------------------------------------------------------------------

export function buildStyles() {
  return `
.ast-loc {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg2, #161b22);
  border-bottom: 1px solid var(--border, #30363d);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

.ast-loc-btn {
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
.ast-loc-btn:hover:not(:disabled) {
  background: var(--bg4, #30363d);
  color: var(--text, #e6edf3);
  border-color: var(--accent, #58a6ff);
}
.ast-loc-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ast-loc-btn.primary {
  background: var(--accent, #58a6ff);
  color: #fff;
  border-color: var(--accent, #58a6ff);
}
.ast-loc-btn.primary:hover:not(:disabled) {
  filter: brightness(1.1);
  color: #fff;
}

/* --- Обёртка поля: здесь фон и рамка --- */
.ast-loc-input-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
  height: 28px;
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 14px;
  transition: border-color 0.15s, background 0.15s;
}
.ast-loc-input-wrap:hover { border-color: var(--text2, #8b949e); }
.ast-loc-input-wrap:focus-within {
  border-color: var(--accent, #58a6ff);
  background: var(--bg2, #161b22);
}

/* --- Input прозрачный: фон даёт wrap, цвет текста — только в фокусе --- */
.ast-loc-input {
  width: 100%;
  height: 100%;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 14px;
  color: transparent;
  caret-color: var(--accent, #58a6ff);
  font-family: 'Consolas', monospace;
  font-size: 11px;
  outline: none;
  white-space: nowrap;
  text-overflow: ellipsis;
  position: absolute;
  inset: 0;
  z-index: 2;
}
.ast-loc-input::placeholder {
  color: var(--text2, #8b949e);
  opacity: 0.6;
}
.ast-loc-input:focus,
.ast-loc-input.editing {
  color: var(--text, #e6edf3);
}

/* --- Overlay с цветным путём: виден, когда input НЕ в фокусе --- */
.ast-loc-display {
  position: absolute;
  inset: 0;
  padding: 0 12px;
  pointer-events: none;
  font-family: 'Consolas', monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  color: var(--text, #e6edf3);
  z-index: 1;
}
.ast-loc-input:focus + .ast-loc-display,
.ast-loc-input.editing + .ast-loc-display {
  display: none;
}
.ast-loc-display:empty::before {
  content: 'basePath / module / file / function';
  color: var(--text2, #8b949e);
  opacity: 0.6;
}

/* --- Сегменты пути --- */
.ast-loc-seg {
  display: inline;
}
.ast-loc-seg.sep {
  color: var(--text2, #8b949e);
  margin: 0 2px;
  opacity: 0.6;
}
.ast-loc-seg.universe {
  color: var(--purple, #bc8cff);
  font-weight: 600;
}
.ast-loc-seg.module {
  color: var(--green, #3fb950);
}
.ast-loc-seg.file {
  color: var(--yellow, #d29922);
}
.ast-loc-seg.fn {
  color: var(--accent, #58a6ff);
  font-weight: 600;
}
.ast-loc-seg.universe::before { content: '🌌 '; }
.ast-loc-seg.module::before   { content: '📦 '; }
.ast-loc-seg.file::before     { content: '📄 '; }
.ast-loc-seg.fn::before       { content: 'ƒ '; }

/* --- Autocomplete --- */
.ast-loc-suggest {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg2, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  max-height: 280px;
  overflow-y: auto;
  z-index: 200;
  display: none;
}
.ast-loc-suggest.show { display: block; }
.ast-loc-suggest-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text2, #8b949e);
  border-left: 2px solid transparent;
}
.ast-loc-suggest-item:hover,
.ast-loc-suggest-item.active {
  background: var(--bg3, #21262d);
  color: var(--text, #e6edf3);
  border-left-color: var(--accent, #58a6ff);
}
.ast-loc-suggest-item .icon { flex-shrink: 0; }
.ast-loc-suggest-item .label {
  flex: 1;
  font-family: 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ast-loc-suggest-item .meta {
  font-size: 9px;
  color: var(--text2, #8b949e);
  opacity: 0.7;
  flex-shrink: 0;
}

/* --- Статус --- */
.ast-loc-status {
  font-size: 10px;
  color: var(--text2, #8b949e);
  padding: 0 6px;
  font-family: 'Consolas', monospace;
  min-width: 40px;
  text-align: right;
  white-space: nowrap;
  flex-shrink: 0;
}
.ast-loc-status.ok { color: var(--green, #3fb950); }
.ast-loc-status.warn { color: var(--yellow, #d29922); }
.ast-loc-status.err { color: var(--red, #f85149); }

/* --- ✅ v1.4: слот расширений --- */
.ast-loc-ext-slot {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  position: relative;
  flex-shrink: 0;
}

/* --- Скрытая шапка (toggle-header) --- */
.hdr.hdr-hidden {
  display: none !important;
}
`;
}

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildStyles();
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// ПУТИ И МОДУЛИ
// ---------------------------------------------------------------------------

/**
 * Возвращает basePath (universe) из конфига VS Code.
 */
function getUniversePath() {
  const cfg = Vscode.getVscodeConfig();
  return cfg.basePath || '';
}

/**
 * Убирает префикс module из пути файла, если он там есть.
 *
 * Примеры:
 *   stripModulePrefix('src/utils.ts', 'src')   → 'utils.ts'
 *   stripModulePrefix('src/a/b.ts',   'src')   → 'a/b.ts'
 *   stripModulePrefix('src/utils.ts', 'utils') → 'src/utils.ts'  (не совпадает)
 *   stripModulePrefix('utils.ts',     'src')   → 'utils.ts'
 */
function stripModulePrefix(filePath, moduleName) {
  if (!filePath || !moduleName) return filePath || '';
  const p = String(filePath).replace(/\\/g, '/');
  const m = String(moduleName).replace(/\\/g, '/');
  if (p === m) return '';
  if (p.startsWith(m + '/')) return p.slice(m.length + 1);
  return p;
}

/**
 * ✅ v1.5: Модуль — это "путь от корня проекта", т.е. директория файла.
 *   file.path = "src/formal/FunctionBodyModeler.ts"
 *   → "src/formal"
 */
function modulePathFromFile(file) {
  if (!file || !file.path) return '';
  const norm = String(file.path)
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '');
  const idx = norm.lastIndexOf('/');
  if (idx < 0) return ''; // файл в корне — модуль пустой
  return norm.slice(0, idx);
}

/**
 * ✅ v1.5: Чистит имя функции для отображения:
 *   "Anonymous.modelFunctionBody"  → "modelFunctionBody"
 *   "Anonymous.constructor"        → "constructor"
 *   "Anonymous"                    → "Anonymous"
 *   "myFn"                         → "myFn"
 */
function displayFnName(name) {
  if (!name) return '';
  const s = String(name);
  if (s.startsWith('Anonymous.')) return s.slice('Anonymous.'.length);
  return s;
}

/**
 * Собирает путь по конкретной сущности.
 * Модуль = "путь от корня" (modulePathFromFile).
 * Файл = остаток file.path после module.
 */

function pathForFn(fnId) {
  const fn = state.fnById[fnId];
  if (!fn) return null;
  const file = state.files[fn.fileId];
  const universe = getUniversePath();
  const parts = [];

  if (universe) parts.push({ kind: 'universe', value: universe });

  if (file) {
    const modPath = modulePathFromFile(file);
    if (modPath) {
      parts.push({ kind: 'module', value: modPath });
      const rest = file.path.startsWith(modPath + '/')
        ? file.path.slice(modPath.length + 1)
        : file.path;
      if (rest) parts.push({ kind: 'file', value: rest });
    } else {
      parts.push({ kind: 'file', value: file.path });
    }
  }

  parts.push({ kind: 'fn', value: displayFnName(fn.name) });
  return parts;
}

function pathForFile(fileId) {
  const file = state.files[fileId];
  if (!file) return null;
  const universe = getUniversePath();
  const parts = [];

  if (universe) parts.push({ kind: 'universe', value: universe });

  const modPath = modulePathFromFile(file);
  if (modPath) {
    parts.push({ kind: 'module', value: modPath });
    const rest = file.path.startsWith(modPath + '/')
      ? file.path.slice(modPath.length + 1)
      : file.path;
    if (rest) parts.push({ kind: 'file', value: rest });
  } else {
    parts.push({ kind: 'file', value: file.path });
  }

  return parts;
}

function pathForModule(moduleId) {
  const mod = state.modules[moduleId];
  if (!mod) return null;
  const universe = getUniversePath();
  const parts = [];
  if (universe) parts.push({ kind: 'universe', value: universe });

  // Пробуем вычислить полный путь модуля по первому файлу
  const fileIds = state.moduleFiles?.[moduleId] || [];
  const firstFile = fileIds.length ? state.files[fileIds[0]] : null;
  if (firstFile) {
    const modPath = modulePathFromFile(firstFile);
    if (modPath) {
      parts.push({ kind: 'module', value: modPath });
      return parts;
    }
  }

  // fallback — имя модуля как есть
  parts.push({ kind: 'module', value: mod.name });
  return parts;
}

function pathForUniverse() {
  const universe = getUniversePath();
  return universe ? [{ kind: 'universe', value: universe }] : [];
}

// ---------------------------------------------------------------------------
// ПАРСИНГ ПУТИ
// ---------------------------------------------------------------------------

/**
 * ✅ v1.5: Ищет модуль по "пути от корня" — сверяет modulePathFromFile
 * у первого файла модуля.
 */
function findModuleByPath(path) {
  const target = String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!target) return null;
  for (const mod of Object.values(state.modules)) {
    const fileIds = state.moduleFiles?.[mod.id] || [];
    if (!fileIds.length) continue;
    const firstFile = state.files[fileIds[0]];
    if (!firstFile) continue;
    if (modulePathFromFile(firstFile) === target) return mod;
  }
  return null;
}

/**
 * Разбирает строку пути на сегменты и определяет тип каждой сущности.
 *
 * Формат: [universe] / [module] / [file без префикса module] / [fn]
 * Разделитель — " / " или "/".
 *
 * @param {string} raw
 * @returns {{ segments: {kind, value}[], entry: {kind, id} | null }}
 */
export function parsePath(raw) {
  const str = String(raw || '').trim();
  if (!str) return { segments: [], entry: null };

  const tokens = str
    .split(/\s*\/\s*/)
    .map(t => t.trim())
    .filter(Boolean);

  if (!tokens.length) return { segments: [], entry: null };

  const universe = getUniversePath();
  const segments = [];
  let i = 0;

  // 1. Universe
  if (universe && tokens[i] === universe) {
    segments.push({ kind: 'universe', value: universe });
    i++;
  } else if (universe && str.startsWith(universe)) {
    const rest = str.slice(universe.length).replace(/^\s*\/\s*/, '');
    segments.push({ kind: 'universe', value: universe });
    if (rest) {
      const restTokens = rest.split(/\s*\/\s*/).filter(Boolean);
      tokens.splice(0, tokens.length, ...restTokens);
      i = 0;
    } else {
      return { segments, entry: { kind: 'universe', id: null } };
    }
  }

  // 2. Module
  let modId = null;
  let modName = null;
  if (i < tokens.length) {
    const name = tokens[i];

    // 2a. Прямой поиск по state.moduleByName (короткое имя)
    let mod = state.moduleByName[name];

    // 2b. ✅ v1.5: Fallback — "путь от корня", может быть многосегментным
    if (!mod) {
      for (let take = 2; take <= tokens.length - i; take++) {
        const candidate = tokens.slice(i, i + take).join('/');
        const found = findModuleByPath(candidate);
        if (found) {
          mod = found;
          i += take - 1; // поглощаем все токены кандидата
          break;
        }
      }
    }

    if (mod) {
      modId = mod.id;
      // Показываем "путь от корня", если вычислимо
      const fileIds = state.moduleFiles?.[mod.id] || [];
      const firstFile = fileIds.length ? state.files[fileIds[0]] : null;
      modName = (firstFile && modulePathFromFile(firstFile)) || mod.name;
      segments.push({ kind: 'module', value: modName });
      i++;
    }
  }

  // 3. File
  //    Если модуль известен, пробуем склеить: modName + '/' + rest,
  //    плюс fallback на rest как есть.
  let fileId = null;
  if (i < tokens.length) {
    const rest = tokens.slice(i).join('/');

    const candidates = [];
    if (rest) candidates.push(rest);
    if (modName) candidates.push(modName + '/' + rest);

    let file = null;
    for (const c of candidates) {
      file = state.fileByPath[c];
      if (file) break;
    }
    if (!file) {
      const files = modId
        ? (state.moduleFiles[modId] || []).map(id => state.files[id]).filter(Boolean)
        : Object.values(state.files);
      for (const c of candidates) {
        file =
          files.find(f => f.path === c) ||
          files.find(f => f.path.endsWith('/' + c)) ||
          files.find(f => f.path.endsWith(c));
        if (file) break;
      }
    }

    if (file) {
      fileId = file.id;
      // Показываем остаток от модуля (или сам path, если модуль не вычислился)
      const modPath = modName || '';
      const shown =
        modPath && file.path.startsWith(modPath + '/')
          ? file.path.slice(modPath.length + 1)
          : file.path;
      segments.push({ kind: 'file', value: shown || file.path });

      const strippedTokens = (shown || file.path).split('/').filter(Boolean);
      i += Math.max(1, strippedTokens.length);
    }
  }

  // 4. Function
  let fnId = null;
  if (i < tokens.length) {
    const name = tokens.slice(i).join('/');
    let candidates = [];

    // 4a. Точное имя
    if (fileId) {
      candidates = (state.fileFunctions[fileId] || []).filter(fn => fn.name === name);
    }
    if (!candidates.length) {
      candidates = (state.fnByName[name] || []).map(id => state.fnById[id]).filter(Boolean);
    }

    // 4b. ✅ v1.5: Fallback — реальное имя может быть "Anonymous.<name>"
    if (!candidates.length) {
      const withAnon = 'Anonymous.' + name;
      if (fileId) {
        candidates = (state.fileFunctions[fileId] || []).filter(fn => fn.name === withAnon);
      }
      if (!candidates.length) {
        candidates = (state.fnByName[withAnon] || []).map(id => state.fnById[id]).filter(Boolean);
      }
    }

    if (candidates.length) {
      const fn = candidates[0];
      fnId = fn.id;
      segments.push({ kind: 'fn', value: displayFnName(fn.name) });
    } else {
      segments.push({ kind: 'unknown', value: name });
    }
  }

  // Итоговая сущность для навигации
  let entry = null;
  if (fnId) entry = { kind: 'fn', id: fnId };
  else if (fileId) entry = { kind: 'file', id: fileId };
  else if (modId) entry = { kind: 'module', id: modId };
  else if (segments[0]?.kind === 'universe') entry = { kind: 'universe', id: null };

  return { segments, entry };
}

// ---------------------------------------------------------------------------
// ФОРМИРОВАНИЕ HTML ПУТИ
// ---------------------------------------------------------------------------

/**
 * Рендерит сегменты пути как HTML.
 * Разделитель "/" — БЕЗ пробелов (пробелы добавляются через CSS margin).
 */
function renderSegmentsHtml(segments) {
  if (!segments || !segments.length) {
    return '<span class="ast-loc-seg sep">(пусто)</span>';
  }
  return segments
    .map((s, i) => {
      const cls = 'ast-loc-seg ' + (s.kind || 'unknown');
      const label = escapeHtml(s.value);
      const sep = i > 0 ? '<span class="ast-loc-seg sep">/</span>' : '';
      return sep + `<span class="${cls}">${label}</span>`;
    })
    .join('');
}

function buildDisplayPath(entry) {
  let segments = [];
  if (!entry || entry.kind === 'universe') {
    segments = pathForUniverse();
  } else if (entry.kind === 'module') {
    segments = pathForModule(entry.id) || [];
  } else if (entry.kind === 'file') {
    segments = pathForFile(entry.id) || [];
  } else if (entry.kind === 'fn') {
    segments = pathForFn(entry.id) || [];
  }
  return segments;
}

function displayPathToText(segments) {
  if (!segments || !segments.length) return '';
  return segments.map(s => s.value).join('/');
}

// ---------------------------------------------------------------------------
// ПЕРСИСТЕНТНОСТЬ ПОСЛЕДНЕГО ПУТИ (v1.5)
// ---------------------------------------------------------------------------

/**
 * Сохраняет текущий путь в localStorage.
 * Храним только { kind, id } — при загрузке state восстановит всё остальное.
 */
function saveLastPath(entry) {
  if (!entry || !entry.kind) return;
  try {
    localStorage.setItem(LS_LAST_PATH, JSON.stringify({ kind: entry.kind, id: entry.id || null }));
  } catch {}
}

/**
 * Читает последний сохранённый путь.
 * @returns {{kind: string, id: string|null}|null}
 */
function readLastPath() {
  try {
    const raw = localStorage.getItem(LS_LAST_PATH);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !obj.kind) return null;
    return { kind: obj.kind, id: obj.id || null };
  } catch {
    return null;
  }
}

/**
 * Проверяет, что сохранённый путь ещё валиден в текущем state.
 */
function isValidEntry(entry) {
  if (!entry || !entry.kind) return false;
  if (entry.kind === 'universe') return true;
  if (entry.kind === 'module') return !!state.modules[entry.id];
  if (entry.kind === 'file') return !!state.files[entry.id];
  if (entry.kind === 'fn') return !!state.fnById[entry.id];
  return false;
}

/** Удаляет сохранённый путь. */
export function clearLastPath() {
  try {
    localStorage.removeItem(LS_LAST_PATH);
  } catch {}
}

/** Возвращает последний сохранённый путь (или null). */
export function getLastPath() {
  return readLastPath();
}

// ---------------------------------------------------------------------------
// ИСТОРИЯ
// ---------------------------------------------------------------------------

function pushHistory(entry, opts = {}) {
  if (!entry) return;
  const { replace = false } = opts;

  const key = `${entry.kind}:${entry.id}`;
  const current = S.history[S.index];
  if (current && `${current.kind}:${current.id}` === key) return;

  if (replace && S.index >= 0) {
    S.history[S.index] = { ...entry, ts: Date.now() };
  } else {
    if (S.index < S.history.length - 1) {
      S.history = S.history.slice(0, S.index + 1);
    }
    S.history.push({ ...entry, ts: Date.now() });
    S.index = S.history.length - 1;
  }
  updateButtons();
}

function goToIndex(idx, opts = {}) {
  if (idx < 0 || idx >= S.history.length) return;
  S.index = idx;
  const entry = S.history[idx];
  updateInput(entry);
  updateButtons();
  saveLastPath(entry);
  if (!opts.silent && S.onChange) S.onChange(entry);
}

// ---------------------------------------------------------------------------
// РЕНДЕР
// ---------------------------------------------------------------------------

function updateButtons() {
  if (!S.root) return;
  const back = S.root.querySelector('[data-loc="back"]');
  const fwd = S.root.querySelector('[data-loc="forward"]');
  if (back) back.disabled = S.index <= 0;
  if (fwd) fwd.disabled = S.index >= S.history.length - 1;
}

function updateInput(entry) {
  if (!S.root) return;
  const input = S.root.querySelector('.ast-loc-input');
  const display = S.root.querySelector('.ast-loc-display');
  if (!input || !display) return;

  const segments = buildDisplayPath(entry);
  const text = displayPathToText(segments);

  input.value = text;
  display.innerHTML = renderSegmentsHtml(segments);
}

function updateStatus(text, kind = '') {
  if (!S.root) return;
  const status = S.root.querySelector('.ast-loc-status');
  if (status) {
    status.textContent = text;
    status.className = 'ast-loc-status ' + kind;
  }
}

function renderShell() {
  if (!S.root) return;
  S.root.className = 'ast-loc';
  S.root.innerHTML = `
    <button class="ast-loc-btn" data-loc="back"    title="Назад (Alt+←)">◀</button>
    <button class="ast-loc-btn" data-loc="forward" title="Вперёд (Alt+→)">▶</button>
    <button class="ast-loc-btn" data-loc="reload"  title="Обновить (F5)">⟳</button>
    <button class="ast-loc-btn" data-loc="home"    title="В начало (Alt+Home)">⌂</button>
    <div class="ast-loc-input-wrap">
      <input class="ast-loc-input" type="text" spellcheck="false" autocomplete="off"
             placeholder="basePath / module / file / function" />
      <div class="ast-loc-display"></div>
      <div class="ast-loc-suggest"></div>
    </div>
    <span class="ast-loc-status"></span>
    <button class="ast-loc-btn" data-loc="vscode" title="Открыть в VS Code">🔗</button>
    <span class="ast-loc-ext-slot" id="astLocExtSlot"></span>
    <button class="ast-loc-btn" data-loc="toggle-header" title="Показать / скрыть шапку">▾</button>
  `;
  updateButtons();
}

// ---------------------------------------------------------------------------
// ОБРАБОТЧИКИ
// ---------------------------------------------------------------------------

function attachHandlers() {
  if (!S.root) return;
  const input = S.root.querySelector('.ast-loc-input');

  S.root.addEventListener('click', e => {
    const btn = e.target.closest('[data-loc]');
    if (!btn) return;
    const action = btn.dataset.loc;
    if (action === 'back') goBack();
    else if (action === 'forward') goForward();
    else if (action === 'reload') reload();
    else if (action === 'home') goHome();
    else if (action === 'vscode') openInVscode();
    else if (action === 'toggle-header') toggleHeader(btn);
  });

  // --- input ---
  input.addEventListener('focus', () => {
    input.classList.add('editing');
    const cur = S.history[S.index];
    input.value = displayPathToText(buildDisplayPath(cur));
    input.select();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      input.classList.remove('editing');
      hideSuggest();
      const cur = S.history[S.index];
      updateInput(cur);
    }, 150);
  });

  input.addEventListener('input', () => {
    showSuggest(input.value);
    updateStatus('', '');
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(input.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'ArrowDown') {
      if (S.suggestions.length) {
        e.preventDefault();
        S.suggestionIdx = Math.min(S.suggestionIdx + 1, S.suggestions.length - 1);
        renderSuggest();
      }
    } else if (e.key === 'ArrowUp') {
      if (S.suggestions.length) {
        e.preventDefault();
        S.suggestionIdx = Math.max(S.suggestionIdx - 1, 0);
        renderSuggest();
      }
    } else if (e.key === 'Tab') {
      if (S.suggestions.length) {
        e.preventDefault();
        applySuggestion(S.suggestions[Math.max(0, S.suggestionIdx)]);
      }
    }
  });

  // Ctrl+L — фокус в адресную строку
  document.addEventListener('keydown', e => {
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д')
    ) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ---------------------------------------------------------------------------
// SUGGEST (autocomplete)
// ---------------------------------------------------------------------------

function collectSuggestions(query) {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  const out = [];

  const universe = getUniversePath();

  // Universe
  if (universe) {
    out.push({
      kind: 'universe',
      id: null,
      label: universe,
      icon: '🌌',
      meta: 'universe',
      text: universe,
    });
  }

  // Модули — показываем "путь от корня" (modulePathFromFile)
  for (const m of Object.values(state.modules)) {
    const fileIds = state.moduleFiles?.[m.id] || [];
    const firstFile = fileIds.length ? state.files[fileIds[0]] : null;
    const modPath = (firstFile && modulePathFromFile(firstFile)) || m.name;
    out.push({
      kind: 'module',
      id: m.id,
      label: modPath,
      icon: '📦',
      meta: 'module',
      text: (universe ? universe + '/' : '') + modPath,
    });
  }

  // Файлы — text = universe/module/<rest>
  for (const f of Object.values(state.files)) {
    const modPath = modulePathFromFile(f);
    const rest =
      modPath && f.path.startsWith(modPath + '/') ? f.path.slice(modPath.length + 1) : f.path;
    const parts = [];
    if (universe) parts.push(universe);
    if (modPath) parts.push(modPath);
    if (rest) parts.push(rest);
    out.push({
      kind: 'file',
      id: f.id,
      label: f.path,
      icon: '📄',
      meta: 'file',
      text: parts.join('/'),
    });
  }

  // Функции — text = universe/module/<rest>/fn (с чисткой Anonymous.)
  for (const fn of Object.values(state.functions)) {
    const file = state.files[fn.fileId];
    const modPath = file ? modulePathFromFile(file) : '';
    const rest =
      file && modPath && file.path.startsWith(modPath + '/')
        ? file.path.slice(modPath.length + 1)
        : file?.path || '';
    const fnDisplay = displayFnName(fn.name);
    const parts = [];
    if (universe) parts.push(universe);
    if (modPath) parts.push(modPath);
    if (rest) parts.push(rest);
    parts.push(fnDisplay);
    out.push({
      kind: 'fn',
      id: fn.id,
      label: fnDisplay,
      icon: 'ƒ',
      meta: file?.path || '',
      text: parts.join('/'),
    });
  }

  if (!q) return out.slice(0, 40);

  const filtered = out.filter(o => {
    const hay = (o.label + ' ' + o.text + ' ' + o.meta).toLowerCase();
    return hay.includes(q);
  });

  filtered.sort((a, b) => {
    const al = a.label.toLowerCase();
    const bl = b.label.toLowerCase();
    const aStarts = al.startsWith(q) ? 0 : 1;
    const bStarts = bl.startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return al.localeCompare(bl);
  });

  return filtered.slice(0, 40);
}

function showSuggest(query) {
  S.suggestions = collectSuggestions(query);
  S.suggestionIdx = 0;
  renderSuggest();
}

function renderSuggest() {
  if (!S.root) return;
  const box = S.root.querySelector('.ast-loc-suggest');
  if (!box) return;

  if (!S.suggestions.length) {
    box.classList.remove('show');
    box.innerHTML = '';
    return;
  }

  box.innerHTML = S.suggestions
    .map(
      (s, i) => `
    <div class="ast-loc-suggest-item${i === S.suggestionIdx ? ' active' : ''}"
         data-sug-idx="${i}">
      <span class="icon">${s.icon}</span>
      <span class="label">${escapeHtml(s.label)}</span>
      <span class="meta">${escapeHtml(s.meta || '')}</span>
    </div>
  `
    )
    .join('');

  box.classList.add('show');

  box.querySelectorAll('[data-sug-idx]').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const idx = parseInt(el.dataset.sugIdx, 10);
      applySuggestion(S.suggestions[idx]);
    });
  });
}

function hideSuggest() {
  if (!S.root) return;
  const box = S.root.querySelector('.ast-loc-suggest');
  if (box) {
    box.classList.remove('show');
    box.innerHTML = '';
  }
  S.suggestions = [];
  S.suggestionIdx = -1;
}

function applySuggestion(sug) {
  if (!sug) return;
  const input = S.root.querySelector('.ast-loc-input');
  if (!input) return;
  input.value = sug.text;
  hideSuggest();
  input.focus();
}

// ---------------------------------------------------------------------------
// КОММИТ (Enter) — v1.5: срезаем basePath и ведущие слэши
// ---------------------------------------------------------------------------

/**
 * Убирает basePath из введённой строки, если он там есть.
 *   "/home/user/proj / module / file" → "module / file"
 *   "home/user/proj/module/file"      → "module / file"
 *   "/module/file"                    → "module/file"
 *   "module/file"                     → "module/file"
 */
function stripBasePathFromInput(raw) {
  let s = String(raw || '').trim();
  if (!s) return s;

  const base = getUniversePath();

  if (base) {
    const norm = base.replace(/\\/g, '/').replace(/\/+$/, '');
    if (s === norm) return '';
    if (s.startsWith(norm + '/')) {
      s = s.slice(norm.length + 1);
    }
    // Также поддержка без ведущего слэша: "home/user/proj/module/file"
    const noSlash = norm.startsWith('/') ? norm.slice(1) : norm;
    if (s === noSlash) return '';
    if (s.startsWith(noSlash + '/')) {
      s = s.slice(noSlash.length + 1);
    }
  }

  // Срезаем ведущие слэши — ввод всегда относительный
  s = s.replace(/^\/+/, '');
  return s;
}

function commit(raw) {
  const relative = stripBasePathFromInput(raw);
  const { segments, entry } = parsePath(relative);

  if (!entry) {
    updateStatus('не найдено', 'err');
    return;
  }

  applyEntry(entry, { replace: false });
  updateStatus('✓', 'ok');
  const input = S.root.querySelector('.ast-loc-input');
  if (input) input.blur();
}

/**
 * v1.6: applyEntry — общая точка для commit / applySuggestion / syncFromSelection.
 *
 * opts.silent — не вызывать S.onChange. Используется syncFromSelection,
 * чтобы клик по дереву/карточке не порождал второй renderTree
 * (иначе expandActiveFile=false из первого рендера перетирается
 * вторым рендером с expandActiveFile=true, и файл раскрывается).
 */
function applyEntry(entry, opts = {}) {
  if (!entry) return;
  pushHistory(entry, opts);
  updateInput(entry);
  saveLastPath(entry);
  if (!opts.silent && S.onChange) S.onChange(entry);
}

// ---------------------------------------------------------------------------
// НАВИГАЦИЯ
// ---------------------------------------------------------------------------

export function goBack() {
  if (S.index <= 0) return;
  goToIndex(S.index - 1);
}

export function goForward() {
  if (S.index >= S.history.length - 1) return;
  goToIndex(S.index + 1);
}

export function goHome() {
  const entry = { kind: 'universe', id: null };
  applyEntry(entry, { replace: false });
}

export function reload() {
  const cur = S.history[S.index];
  if (!cur) return;
  updateStatus('⟳', '');
  setTimeout(() => {
    updateInput(cur);
    if (S.onChange) S.onChange(cur);
    updateStatus('✓', 'ok');
  }, 100);
}

function openInVscode() {
  const cur = S.history[S.index];
  if (!cur) return;
  let url = null;
  if (cur.kind === 'fn') url = Vscode.fnVscodeUrl(cur.id);
  else if (cur.kind === 'file') url = Vscode.fileVscodeUrl(cur.id);
  else if (cur.kind === 'module') url = Vscode.moduleVscodeUrl(cur.id);
  if (!url) {
    updateStatus('нет файла', 'warn');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Показывает/скрывает шапку .hdr.
 * Синхронизирует иконку кнопки, обновляет CSS-переменную --hdr-height
 * (её использует ast-analyzer-nav.js), шлёт событие resize,
 * сохраняет состояние в localStorage.
 */
function toggleHeader(btn) {
  const hdr = document.querySelector('.hdr');
  if (!hdr) return;

  const hidden = hdr.classList.toggle('hdr-hidden');
  if (btn) {
    btn.textContent = hidden ? '▸' : '▾';
    btn.title = hidden ? 'Показать шапку' : 'Скрыть шапку';
  }

  // Обновляем высоту для мини-навигации (Nav использует --nav-header-height)
  const headerHeight = hidden ? 0 : Math.ceil(hdr.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hdr-height', headerHeight + 'px');

  // Сообщаем Nav, что высота изменилась
  window.dispatchEvent(new Event('resize'));

  // Сохраняем состояние
  try {
    localStorage.setItem(LS_HEADER_HIDDEN, hidden ? '1' : '0');
  } catch {}
}

/**
 * Восстанавливает состояние шапки из localStorage.
 * Вызывается при mount().
 */
function restoreHeaderState() {
  let hidden = false;
  try {
    hidden = localStorage.getItem(LS_HEADER_HIDDEN) === '1';
  } catch {}
  if (!hidden) return;

  const hdr = document.querySelector('.hdr');
  if (!hdr) return;
  hdr.classList.add('hdr-hidden');

  const btn = S.root?.querySelector('[data-loc="toggle-header"]');
  if (btn) {
    btn.textContent = '▸';
    btn.title = 'Показать шапку';
  }
  document.documentElement.style.setProperty('--hdr-height', '0px');
}

// ---------------------------------------------------------------------------
// ПУБЛИЧНЫЙ API
// ---------------------------------------------------------------------------

export function mount(opts = {}) {
  injectStyles();

  if (opts.onChange) S.onChange = opts.onChange;
  if (opts.resolve) S.resolve = opts.resolve;

  const container = opts.container || document.body;
  const existing = document.getElementById(ROOT_ID);
  if (existing) existing.remove();

  S.root = document.createElement('div');
  S.root.id = ROOT_ID;
  renderShell();
  container.appendChild(S.root);

  attachHandlers();
  restoreHeaderState();

  // Восстанавливаем последний путь, если он валиден для текущего state.
  // Home всегда кладём первым элементом истории.
  const home = { kind: 'universe', id: null };
  S.history = [home];
  S.index = 0;

  const last = readLastPath();
  if (last && last.kind !== 'universe' && isValidEntry(last)) {
    S.history.push({ ...last, ts: Date.now() });
    S.index = 1;
    updateInput(last);
    // Сообщаем внешнему коду, чтобы main.js отрисовал нужный экран.
    // queueMicrotask даёт main.js возможность завершить mount().
    if (S.onChange) {
      queueMicrotask(() => S.onChange(last));
    }
  } else {
    updateInput(home);
  }
  updateStatus('', '');

  return S.root;
}

export function unmount() {
  if (S.root) {
    S.root.remove();
    S.root = null;
  }
  S.history = [];
  S.index = -1;
}

export function navigate(path, opts = {}) {
  const { entry } = parsePath(path);
  if (!entry) return false;
  applyEntry(entry, opts);
  return true;
}

/**
 * Обновить адресную строку в соответствии с текущим активным элементом.
 * Вызывается извне (main.js) при выборе функции/файла/модуля.
 *
 * v1.6: всегда silent — внешний код (main.js) сам рендерит дерево/панель
 * после вызова syncFromSelection. Если здесь вызвать onChange, произойдёт
 * второй renderTree с expandActiveFile=true, и файл раскроется, даже если
 * пользователь просто кликнул по нему в дереве.
 */
export function syncFromSelection(kind, id, opts = {}) {
  const entry = { kind, id };
  applyEntry(entry, { ...opts, silent: true });
}

export function setUniverse(basePath) {
  const cur = S.history[S.index];
  updateInput(cur);
}

export function getHistory() {
  return S.history.slice();
}

export function getCurrent() {
  return S.history[S.index] || null;
}

/**
 * ✅ v1.4: возвращает DOM-элемент слота для расширений
 * (#astLocExtSlot) или null, если панель не смонтирована.
 *
 * Используется в main.js:
 *   const slot = LocationBar.getExtensionsSlot();
 *   if (slot) Extensions.renderInto(slot);
 *
 * @returns {HTMLElement|null}
 */
export function getExtensionsSlot() {
  if (!S.root) return null;
  return S.root.querySelector('#astLocExtSlot');
}

export default {
  mount,
  unmount,
  navigate,
  goBack,
  goForward,
  goHome,
  reload,
  syncFromSelection,
  setUniverse,
  getHistory,
  getCurrent,
  parsePath,
  buildStyles,
  getExtensionsSlot,
  clearLastPath,
  getLastPath,
};
