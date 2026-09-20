// ============================================================================
// AST ANALYZER — GROUPS STYLES v1.1
// CSS для full-page групп секций с Grid-раскладкой.
//
// Возможности:
//   - Full-page группа как отдельная scroll-snap секция
//   - Grid-раскладка ячеек с colSpan/rowSpan
//   - Master-Detail: вложенные группы
//   - Адаптив: на узких экранах — 1 колонка
//   - Специальные пресеты: master-detail, master-detail-right, sidebar
//
// Публичный API:
//   GroupsStyles.getStyles()        → строка CSS
//   GroupsStyles.inject()           → вставить в <head>
//   GroupsStyles.STYLE_ID           → id <style> элемента
// ============================================================================

export const STYLE_ID = 'ast-groups-mn-styles';

export function getStyles() {
  return `
/* ==========================================================================
   Группы секций: full-page Grid
   ========================================================================== */

.mn-sections > .mn-group {
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

/* --- Header группы --- */
.mn-group-header {
  flex-shrink: 0;
  padding: 6px 14px;
  background: var(--bg3, #21262d);
  border-bottom: 1px solid var(--border, #30363d);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text, #e6edf3);
}
.mn-group-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mn-group-count {
  font-size: 10px;
  background: var(--bg, #0d1117);
  padding: 1px 7px;
  border-radius: 8px;
  color: var(--text2, #8b949e);
}

/* --- Grid ячеек --- */
.mn-group-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--group-cols, 2), minmax(0, 1fr));
  grid-template-rows: repeat(var(--group-rows, 2), minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
  overflow: hidden;
}

.mn-group-grid > .es {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  grid-column: var(--grid-col, auto) / span var(--grid-colspan, 1);
  grid-row: var(--grid-row, auto) / span var(--grid-rowspan, 1);
}

.mn-group-grid > .es > .es-h {
  flex-shrink: 0;
}

.mn-group-grid > .es > .es-b {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Граф внутри группы — на всю высоту ячейки */
.mn-group-grid > .es > .es-b > .graph-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  overflow: hidden;
}
.mn-group-grid > .es > .es-b > .graph-wrap > .graph-svg {
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

/* ==========================================================================
   Master-Detail: вложенные группы
   ========================================================================== */

.mn-group-grid > .mn-subgroup {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  background: var(--bg2, #161b22);
}

.mn-group-grid > .mn-subgroup > .mn-group-header {
  font-size: 11px;
  padding: 4px 10px;
  background: var(--bg4, #30363d);
}

.mn-group-grid > .mn-subgroup > .mn-group-grid {
  padding: 6px;
  gap: 4px;
}

/* ==========================================================================
   Спец-раскладки
   ========================================================================== */

/* Master-Detail (master слева) */
.mn-group[data-special="master-detail"] .mn-group-grid > .es[data-grid-col="1"][data-grid-row="1"] {
  border-left: 2px solid var(--yellow, #d29922);
}

/* Master-Detail (master справа) */
.mn-group[data-special="master-detail-right"] .mn-group-grid > .es[data-grid-col="2"][data-grid-row="1"] {
  border-right: 2px solid var(--yellow, #d29922);
}

/* Sidebar: первая колонка узкая, остальные — main */
.mn-group[data-special="sidebar"] .mn-group-grid {
  grid-template-columns: minmax(220px, 1fr) 3fr;
}

/* ==========================================================================
   Адаптив: 1 колонка
   ========================================================================== */

@media (max-width: 900px) {
  .mn-group-grid {
    grid-template-columns: 1fr !important;
    grid-template-rows: auto !important;
    gap: 6px;
    overflow-y: auto;
  }

  .mn-group-grid > .es,
  .mn-group-grid > .mn-subgroup {
    grid-column: 1 / -1 !important;
    grid-row: auto !important;
    min-height: 220px;
  }

  .mn-sections > .mn-group {
    height: auto;
    min-height: 100%;
    overflow-y: auto;
  }

  .mn-group-grid > .es > .es-b {
    max-height: 400px;
  }

  .mn-group-grid > .es > .es-b > .graph-wrap {
    height: auto;
    min-height: 300px;
  }

  /* Sidebar схлопывается в обычный grid */
  .mn-group[data-special="sidebar"] .mn-group-grid {
    grid-template-columns: 1fr;
  }
}

/* ==========================================================================
   Промежуточный адаптив: 2-колоночные группы на средних экранах
   ========================================================================== */

@media (max-width: 1200px) and (min-width: 901px) {
  .mn-group-grid {
    grid-template-columns: repeat(min(var(--group-cols, 2), 2), minmax(0, 1fr));
  }
}

/* ==========================================================================
   Тёмная тема / печать
   ========================================================================== */

@media print {
  .mn-sections > .mn-group {
    page-break-inside: avoid;
    height: auto;
    min-height: auto;
  }
  .mn-group-grid {
    grid-template-columns: repeat(var(--group-cols, 2), 1fr);
    grid-template-rows: auto;
    overflow: visible;
  }
  .mn-group-grid > .es {
    min-height: 200px;
  }
}
`;
}

export function inject() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = getStyles();
  document.head.appendChild(s);
}

export function remove() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(STYLE_ID);
  if (el) el.remove();
}

export default {
  STYLE_ID,
  getStyles,
  inject,
  remove
};
