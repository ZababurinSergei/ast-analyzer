// ============================================================================
// AST ANALYZER — PROGRESS v1.0
// Минимальный прогресс-бар для длительных операций в main thread.
// ============================================================================

let _el = null;
let _bar = null;
let _label = null;

export function showProgress(message = 'Загрузка…') {
  if (typeof document === 'undefined') return;
  if (!_el) {
    _el = document.createElement('div');
    _el.id = 'astProgress';
    _el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0;
      height: 3px; background: transparent;
      z-index: 99999; pointer-events: none;
    `;
    _bar = document.createElement('div');
    _bar.style.cssText = `
      height: 100%; width: 0%;
      background: var(--accent, #58a6ff);
      transition: width 0.15s ease;
    `;
    _el.appendChild(_bar);

    _label = document.createElement('div');
    _label.id = 'astProgressLabel';
    _label.style.cssText = `
      position: fixed; top: 10px; left: 50%;
      transform: translateX(-50%);
      background: var(--bg3, #21262d);
      color: var(--text, #e6edf3);
      padding: 4px 12px; border-radius: 6px;
      font-size: 11px; font-family: monospace;
      border: 1px solid var(--border, #30363d);
      z-index: 99999; pointer-events: none;
      opacity: 0; transition: opacity 0.2s;
    `;
    document.body.appendChild(_el);
    document.body.appendChild(_label);
  }
  _label.textContent = message;
  _label.style.opacity = '1';
}

export function setProgress(pct, message) {
  if (!_bar) return;
  _bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (message != null && _label) _label.textContent = message;
}

export function hideProgress() {
  if (!_el) return;
  _bar.style.width = '100%';
  _label.style.opacity = '0';
  const el = _el;
  const label = _label;
  _el = null;
  _bar = null;
  _label = null;
  setTimeout(() => {
    el.remove();
    label.remove();
  }, 250);
}
