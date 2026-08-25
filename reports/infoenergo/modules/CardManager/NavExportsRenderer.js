// packages/ast-analyzer/src/reporters/templates/modules/CardManager/NavExportsRenderer.js

export class NavExportsRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  render(data) {
    const { allExports, modulePath } = data;

    if (allExports.length === 0) return '';

    const sortedExports = [...allExports].sort();
    let html = `
            <div class="nav-section nav-exports" style="padding: 4px 8px; margin: 2px 0; border-top-color: #f87171; background: rgba(248, 113, 113, 0.03); border-radius: 4px;">
                <span class="nav-label" style="font-size: 10px; color: #f87171;">📤 Экспорты (${allExports.length}):</span>
                <div class="nav-buttons" style="display: flex; flex-wrap: wrap; gap: 3px;">
        `;

    for (const exp of sortedExports) {
      const expModule = this.manager.findModuleForFunction(exp);
      const isInModule = expModule === modulePath;

      let style = '';
      let icon = '📤';

      if (isInModule) {
        style =
          'border-color: #f87171; color: #f87171; background: rgba(248, 113, 113, 0.05); cursor: default; font-size: 9px; padding: 1px 6px; border-radius: 8px;';
        icon = '📤';
      } else {
        style =
          'border-color: #60a5fa; color: #60a5fa; background: rgba(96, 165, 250, 0.05); cursor: default; font-size: 9px; padding: 1px 6px; border-radius: 8px;';
        icon = '📤';
      }

      const moduleDisplay =
        expModule && expModule !== modulePath ? `📁${expModule.split('/').pop()}` : '';

      html += `
                <span class="nav-btn export-btn" style="${style}" title="Экспортируемая функция${!isInModule ? ` из ${expModule}` : ''}">
                    ${icon} ${this.manager.escapeHtml(exp)}
                    ${moduleDisplay ? `<span class="nav-module" style="font-size: 8px; color: #64748b;">${moduleDisplay}</span>` : ''}
                </span>
            `;
    }

    html += `</div></div>`;
    return html;
  }
}
