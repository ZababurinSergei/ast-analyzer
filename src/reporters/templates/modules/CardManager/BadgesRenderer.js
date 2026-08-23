// packages/ast-analyzer/src/reporters/templates/modules/CardManager/BadgesRenderer.js

export class BadgesRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  render(data) {
    const {
      totalFuncs,
      totalClasses,
      totalConstants,
      totalInterfaces,
      totalTypes,
      totalVariables,
      allExports,
      externalOutgoing,
      externalIncoming,
      totalInternal,
      moduleImporters,
      moduleImports,
    } = data;

    return `
            <div class="badges" style="display: flex; flex-wrap: wrap; gap: 3px; margin: 2px 0;">
                <span class="badge fn" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #fbbf24; color: #0f172a;">${totalFuncs} функций</span>
                ${totalClasses > 0 ? `<span class="badge class" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #4ade80; color: #0f172a;">${totalClasses} классов</span>` : ''}
                ${totalConstants > 0 ? `<span class="badge const" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #f472b6; color: #0f172a;">${totalConstants} констант</span>` : ''}
                ${totalInterfaces > 0 ? `<span class="badge interface" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #a78bfa; color: #fff;">${totalInterfaces} интерфейсов</span>` : ''}
                ${totalTypes > 0 ? `<span class="badge type" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #22d3ee; color: #0f172a;">${totalTypes} типов</span>` : ''}
                ${totalVariables > 0 ? `<span class="badge var" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #f87171; color: #fff;">${totalVariables} переменных</span>` : ''}
                ${allExports.length > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#f87171;">📤 ${allExports.length}</span>` : ''}
                ${externalOutgoing.size > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#f59e0b;">📤 ${externalOutgoing.size}</span>` : ''}
                ${externalIncoming.size > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#3b82f6;">📥 ${externalIncoming.size}</span>` : ''}
                ${totalInternal > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#64748b;">🔄 ${totalInternal}</span>` : ''}
                ${moduleImporters.size > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#22d3ee;">📥 ${moduleImporters.size}</span>` : ''}
                ${moduleImports.size > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#f59e0b;">📤 ${moduleImports.size}</span>` : ''}
            </div>
        `;
  }
}
