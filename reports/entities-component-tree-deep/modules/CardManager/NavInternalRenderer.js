// packages/ast-analyzer/src/reporters/templates/modules/CardManager/NavInternalRenderer.js

/**
 * NavInternalRenderer - рендеринг секции "Внутренние вызовы"
 * Отображает внутренние вызовы функций внутри модуля
 *
 * Особенности:
 * - Отображение исходящих и входящих внутренних вызовов
 * - Возможность свернуть/развернуть секцию
 * - Показывает источник вызова (top-level или из функции)
 * - Компактный стиль с маленькими тегами
 * - Интерактивное сворачивание по клику
 */
export class NavInternalRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Рендеринг секции внутренних вызовов
   * @param {Object} data - Данные для рендеринга
   * @param {Set<string>} data.internalOutgoing - Множество исходящих вызовов
   * @param {Set<string>} data.internalIncoming - Множество входящих вызовов
   * @param {boolean} data.isActive - Активен ли модуль (для автораскрытия)
   * @param {Map<string, string>} data.callSources - Карта источников вызовов
   * @param {string} data.modulePath - Путь к текущему модулю (опционально)
   * @returns {string} HTML строка
   */
  render(data) {
    const { internalOutgoing, internalIncoming, isActive, callSources, modulePath } = data;

    const totalInternal = (internalOutgoing?.size || 0) + (internalIncoming?.size || 0);
    if (totalInternal === 0) return '';

    const isExpanded = isActive || false;

    let html = `
            <div class="nav-section nav-internal ${isExpanded ? 'expanded' : 'collapsed'}" 
                 style="padding: 4px 8px; margin: 2px 0; border-top: 1px solid #1a1a3a;">
                <span class="nav-label" 
                      onclick="event.stopPropagation(); const section = this.closest('.nav-section'); section.classList.toggle('expanded'); section.classList.toggle('collapsed'); this.querySelector('.toggle-icon').textContent = section.classList.contains('expanded') ? '▼' : '▶';" 
                      style="font-size: 10px; cursor:pointer; color: #94a3b8; display: inline-flex; align-items: center; gap: 4px; transition: color 0.2s;"
                      onmouseenter="this.style.color='#e2e8f0';"
                      onmouseleave="this.style.color='#94a3b8';">
                    🔄 Внутренние вызовы (${totalInternal})
                    <span class="toggle-icon" style="font-size: 8px; color: #64748b;">${isExpanded ? '▼' : '▶'}</span>
                </span>
                <div class="nav-internal-content" style="${isExpanded ? '' : 'display:none;'} margin-top: 4px;">
        `;

    // Исходящие вызовы
    if (internalOutgoing && internalOutgoing.size > 0) {
      const sortedOutgoing = Array.from(internalOutgoing).sort();
      html += `
                <div class="internal-group" style="margin: 2px 0;">
                    <span class="internal-label" style="font-size: 8px; color: #64748b; display: inline-block; min-width: 60px;">
                        ⬆ Исходящие (${internalOutgoing.size}):
                    </span>
                    <div style="display: inline-flex; flex-wrap: wrap; gap: 2px;">
                        ${sortedOutgoing
                          .map(name => {
                            const source = callSources?.get(name) || 'top-level';
                            const sourceIcon = source === 'top-level' ? '📋' : '🔽';
                            const sourceLabel =
                              source === 'top-level' ? 'top-level' : `из ${source}`;

                            const targetModule = this.manager.findModuleForFunction(name);
                            const isExternal = targetModule && targetModule !== modulePath;
                            const isInSameModule = targetModule === modulePath;
                            const clickAttr = isInSameModule
                              ? `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(name)}', '${this.manager.escapeJs(modulePath)}')"`
                              : '';
                            const cursorStyle = isInSameModule ? 'cursor:pointer;' : '';

                            return `
                                <span class="internal-item" 
                                      ${clickAttr}
                                      style="font-size: 8px; 
                                             background: #0f172a; 
                                             padding: 1px 6px; 
                                             border-radius: 6px; 
                                             margin: 1px 2px; 
                                             border: 1px solid #1a1a3a; 
                                             display: inline-block;
                                             ${cursorStyle}
                                             color: ${isInSameModule ? '#e2e8f0' : '#64748b'};"
                                      title="${this.manager.escapeHtml(name)} (${sourceLabel})${isExternal ? ' ⚠️ внешний' : ''}">
                                    ${this.manager.escapeHtml(name)}
                                    <span style="font-size: 6px; color: #64748b; margin-left: 2px;">
                                        ${sourceIcon} ${source === 'top-level' ? 'top-level' : 'из ' + source}
                                    </span>
                                    ${isExternal ? '<span style="font-size: 6px; color: #f59e0b; margin-left: 2px;">🌐</span>' : ''}
                                </span>
                            `;
                          })
                          .join('')}
                    </div>
                </div>
            `;
    }

    // Входящие вызовы
    if (internalIncoming && internalIncoming.size > 0) {
      const sortedIncoming = Array.from(internalIncoming).sort();
      html += `
                <div class="internal-group" style="margin: 2px 0;">
                    <span class="internal-label" style="font-size: 8px; color: #64748b; display: inline-block; min-width: 60px;">
                        ⬇ Входящие (${internalIncoming.size}):
                    </span>
                    <div style="display: inline-flex; flex-wrap: wrap; gap: 2px;">
                        ${sortedIncoming
                          .map(name => {
                            const source = callSources?.get(name) || 'top-level';
                            const sourceIcon = source === 'top-level' ? '📋' : '🔽';
                            const sourceLabel =
                              source === 'top-level' ? 'top-level' : `из ${source}`;

                            const callerModule = this.manager.findModuleForFunction(name);
                            const isInSameModule = callerModule === modulePath;
                            const clickAttr = isInSameModule
                              ? `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(name)}', '${this.manager.escapeJs(modulePath)}')"`
                              : '';
                            const cursorStyle = isInSameModule ? 'cursor:pointer;' : '';
                            const colorStyle = isInSameModule ? 'color:#e2e8f0;' : 'color:#64748b;';

                            return `
                                <span class="internal-item" 
                                      ${clickAttr}
                                      style="font-size: 8px; 
                                             background: #0f172a; 
                                             padding: 1px 6px; 
                                             border-radius: 6px; 
                                             margin: 1px 2px; 
                                             border: 1px solid #1a1a3a; 
                                             display: inline-block;
                                             ${cursorStyle}
                                             ${colorStyle}"
                                      title="${this.manager.escapeHtml(name)} (${sourceLabel})">
                                    ${this.manager.escapeHtml(name)}
                                    <span style="font-size: 6px; color: #64748b; margin-left: 2px;">
                                        ${sourceIcon} ${source === 'top-level' ? 'top-level' : 'из ' + source}
                                    </span>
                                </span>
                            `;
                          })
                          .join('')}
                    </div>
                </div>
            `;
    }

    // Добавляем информацию о количестве внутренних вызовов в компактном виде
    if (!isExpanded) {
      const outgoingCount = internalOutgoing?.size || 0;
      const incomingCount = internalIncoming?.size || 0;
      html += `
                <div class="internal-summary" style="font-size: 7px; color: #64748b; padding: 2px 0 2px 8px;">
                    ${outgoingCount > 0 ? `⬆ ${outgoingCount}` : ''}
                    ${outgoingCount > 0 && incomingCount > 0 ? ' | ' : ''}
                    ${incomingCount > 0 ? `⬇ ${incomingCount}` : ''}
                </div>
            `;
    }

    html += `
                </div>
            </div>
        `;

    return html;
  }

  /**
   * Рендеринг компактной версии (для свернутого состояния)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCompact(data) {
    const { internalOutgoing, internalIncoming } = data;

    const totalInternal = (internalOutgoing?.size || 0) + (internalIncoming?.size || 0);
    if (totalInternal === 0) return '';

    const outgoingCount = internalOutgoing?.size || 0;
    const incomingCount = internalIncoming?.size || 0;

    return `
            <div class="nav-section nav-internal compact" style="padding: 2px 8px; margin: 1px 0;">
                <span class="nav-label" style="font-size: 9px; color: #64748b;">
                    🔄 ${totalInternal} внутренних:
                </span>
                <span style="font-size: 7px; color: #64748b;">
                    ${outgoingCount > 0 ? `⬆ ${outgoingCount}` : ''}
                    ${outgoingCount > 0 && incomingCount > 0 ? ' | ' : ''}
                    ${incomingCount > 0 ? `⬇ ${incomingCount}` : ''}
                </span>
            </div>
        `;
  }

  /**
   * Рендеринг только количества внутренних вызовов (для бейджей)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCount(data) {
    const { internalOutgoing, internalIncoming } = data;

    const totalInternal = (internalOutgoing?.size || 0) + (internalIncoming?.size || 0);
    if (totalInternal === 0) return '';

    return `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #1a1a3a; color: #94a3b8; border: 1px solid #2a2a4a;">🔄 ${totalInternal}</span>`;
  }

  /**
   * Получение списка внутренних вызовов в виде объекта
   * @param {Object} data - Данные
   * @returns {Object} { outgoing: string[], incoming: string[] }
   */
  getInternalCalls(data) {
    return {
      outgoing: data.internalOutgoing ? Array.from(data.internalOutgoing).sort() : [],
      incoming: data.internalIncoming ? Array.from(data.internalIncoming).sort() : [],
    };
  }

  /**
   * Проверка наличия внутренних вызовов
   * @param {Object} data - Данные
   * @returns {boolean} true если есть внутренние вызовы
   */
  hasInternalCalls(data) {
    const totalInternal = (data.internalOutgoing?.size || 0) + (data.internalIncoming?.size || 0);
    return totalInternal > 0;
  }

  /**
   * Получение общего количества внутренних вызовов
   * @param {Object} data - Данные
   * @returns {number} Количество внутренних вызовов
   */
  getTotalCount(data) {
    return (data.internalOutgoing?.size || 0) + (data.internalIncoming?.size || 0);
  }

  /**
   * Рендеринг отдельного элемента внутреннего вызова
   * @param {string} funcName - Имя функции
   * @param {string} direction - Направление ('outgoing' или 'incoming')
   * @param {string} source - Источник вызова
   * @param {string} modulePath - Путь к модулю
   * @param {boolean} isClickable - Кликабельно ли
   * @returns {string} HTML строка
   */
  renderItem(funcName, direction, source, modulePath, isClickable = false) {
    const sourceIcon = source === 'top-level' ? '📋' : '🔽';
    const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;
    const arrowIcon = direction === 'outgoing' ? '⬆' : '⬇';
    const color = direction === 'outgoing' ? '#f59e0b' : '#3b82f6';

    const clickAttr = isClickable
      ? `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(funcName)}', '${this.manager.escapeJs(modulePath)}')"`
      : '';
    const cursorStyle = isClickable ? 'cursor:pointer;' : '';

    return `
            <span class="internal-item" 
                  ${clickAttr}
                  style="font-size: 8px; 
                         background: #0f172a; 
                         padding: 1px 6px; 
                         border-radius: 6px; 
                         margin: 1px 2px; 
                         border: 1px solid #1a1a3a; 
                         display: inline-block;
                         ${cursorStyle}
                         color: ${isClickable ? '#e2e8f0' : '#64748b'};"
                  title="${this.manager.escapeHtml(funcName)} (${sourceLabel})">
                <span style="color: ${color};">${arrowIcon}</span>
                ${this.manager.escapeHtml(funcName)}
                <span style="font-size: 6px; color: #64748b; margin-left: 2px;">
                    ${sourceIcon} ${source === 'top-level' ? 'top-level' : 'из ' + source}
                </span>
            </span>
        `;
  }
}
