// packages/ast-analyzer/src/reporters/templates/modules/CardManager/NavExternalRenderer.js

/**
 * NavExternalRenderer - рендеринг секции "Внешние вызовы"
 * Отображает внешние вызовы (входящие и исходящие) между модулями
 *
 * Особенности:
 * - Отображение исходящих вызовов (из текущего модуля в другие)
 * - Отображение входящих вызовов (из других модулей в текущий)
 * - Клик по вызову → переход к функции в другом модуле
 * - Отображение источника вызова (top-level или из функции)
 * - Компактный стиль с маленькими кнопками
 * - Ограничение на 10 элементов с индикатором "еще"
 */
export class NavExternalRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Рендеринг секции внешних вызовов
   * @param {Object} data - Данные для рендеринга
   * @param {Set<string>} data.externalOutgoing - Множество имен внешних функций, которые вызывает текущий модуль
   * @param {Set<string>} data.externalIncoming - Множество имен внешних функций, которые вызывают текущий модуль
   * @param {string} data.modulePath - Путь к текущему модулю
   * @param {Array} data.funcs - Список функций текущего модуля
   * @param {Map} data.callSources - Карта источников вызовов
   * @param {Object} data.reportData - Данные отчета (опционально)
   * @returns {string} HTML строка
   */
  render(data) {
    const { externalOutgoing, externalIncoming, modulePath, funcs, callSources, reportData } = data;

    let html = '';

    // Исходящие вызовы (из текущего модуля в другие)
    if (externalOutgoing && externalOutgoing.size > 0) {
      html += this.renderOutgoing(externalOutgoing, modulePath, funcs, callSources);
    }

    // Входящие вызовы (из других модулей в текущий)
    if (externalIncoming && externalIncoming.size > 0) {
      html += this.renderIncoming(externalIncoming, modulePath, funcs, callSources);
    }

    return html;
  }

  /**
   * Рендеринг исходящих вызовов
   * @param {Set<string>} outgoing - Множество имен функций
   * @param {string} modulePath - Путь к текущему модулю
   * @param {Array} funcs - Список функций текущего модуля
   * @param {Map} callSources - Карта источников вызовов
   * @returns {string} HTML строка
   */
  renderOutgoing(outgoing, modulePath, funcs, callSources) {
    const sortedCalls = Array.from(outgoing).sort();
    const totalCount = outgoing.size;
    const maxDisplay = 10;
    const hasMore = totalCount > maxDisplay;
    const displayItems = sortedCalls.slice(0, maxDisplay);

    let html = `
            <div class="nav-section nav-external nav-outgoing" style="padding: 4px 8px; margin: 2px 0;">
                <span class="nav-label" style="font-size: 10px; color: #f59e0b;">
                    📤 Исходящие вызовы (${totalCount}):
                </span>
                <div class="nav-buttons" style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px;">
        `;

    for (const call of displayItems) {
      const targetModule = this.manager.findModuleForFunction(call);
      if (targetModule && targetModule !== modulePath) {
        const targetDisplay = targetModule.split('/').pop() || '?';

        // Определяем источник вызова
        const source = this.manager.getCallSource(call, targetModule, funcs);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;

        // Уровень целевого модуля
        const level = this.manager.getModuleLevel(targetModule);
        const levelColor = level === 0 ? '#fbbf24' : level === 1 ? '#60a5fa' : '#94a3b8';

        const onclickNav = `event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(call)}', '${this.manager.escapeJs(targetModule)}')`;

        html += `
                    <button class="nav-btn external outgoing" 
                            onclick="${onclickNav}" 
                            style="font-size: 9px; 
                                   padding: 1px 8px; 
                                   border-radius: 8px; 
                                   background: #0f172a; 
                                   border: 1px solid #2a2a3a; 
                                   color: #f59e0b; 
                                   cursor: pointer;
                                   transition: all 0.2s;
                                   white-space: nowrap;"
                            title="Перейти к ${this.manager.escapeHtml(call)} в ${this.manager.escapeHtml(targetModule)} (${sourceLabel})">
                        ➜ ${this.manager.escapeHtml(call)}
                        <span style="font-size: 7px; color: #64748b; margin-left: 2px;">
                            ${sourceIcon} ${sourceLabel}
                        </span>
                        <span class="nav-module" style="font-size: 7px; color: ${levelColor}; margin-left: 2px;">
                            📁${this.manager.escapeHtml(targetDisplay)}
                            ${level > 0 ? ` L${level}` : ''}
                        </span>
                    </button>
                `;
      }
    }

    if (hasMore) {
      const remaining = totalCount - maxDisplay;
      html += `
                <span class="nav-more" style="font-size: 9px; color: #64748b; padding: 1px 6px;">
                    +${remaining}
                </span>
            `;
    }

    // Кнопка "Показать все"
    if (hasMore) {
      html += `
                <button class="nav-btn show-all" 
                        onclick="event.stopPropagation(); this.closest('.nav-outgoing').querySelector('.nav-buttons').classList.toggle('expanded'); this.textContent = this.textContent === 'Показать все' ? 'Свернуть' : 'Показать все';"
                        style="font-size: 8px; 
                               padding: 1px 6px; 
                               border-radius: 8px; 
                               background: transparent; 
                               border: 1px solid #334155; 
                               color: #64748b; 
                               cursor: pointer;">
                    Показать все
                </button>
            `;
    }

    html += `
                </div>
            </div>
        `;

    return html;
  }

  /**
   * Рендеринг входящих вызовов
   * @param {Set<string>} incoming - Множество имен функций
   * @param {string} modulePath - Путь к текущему модулю
   * @param {Array} funcs - Список функций текущего модуля
   * @param {Map} callSources - Карта источников вызовов
   * @returns {string} HTML строка
   */
  renderIncoming(incoming, modulePath, funcs, callSources) {
    const sortedCallers = Array.from(incoming).sort();
    const totalCount = incoming.size;
    const maxDisplay = 10;
    const hasMore = totalCount > maxDisplay;
    const displayItems = sortedCallers.slice(0, maxDisplay);

    let html = `
            <div class="nav-section nav-external nav-incoming" style="padding: 4px 8px; margin: 2px 0;">
                <span class="nav-label" style="font-size: 10px; color: #3b82f6;">
                    📥 Входящие вызовы (${totalCount}):
                </span>
                <div class="nav-buttons" style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px;">
        `;

    for (const caller of displayItems) {
      const callerModule = this.manager.findModuleForFunction(caller);
      if (callerModule && callerModule !== modulePath) {
        const callerDisplay = callerModule.split('/').pop() || '?';

        // Определяем источник вызова
        const source = this.manager.getCallSource(caller, callerModule, funcs);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;

        // Уровень модуля вызывающей функции
        const level = this.manager.getModuleLevel(callerModule);
        const levelColor = level === 0 ? '#fbbf24' : level === 1 ? '#60a5fa' : '#94a3b8';

        const onclickNav = `event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(caller)}', '${this.manager.escapeJs(callerModule)}')`;

        html += `
                    <button class="nav-btn external incoming" 
                            onclick="${onclickNav}" 
                            style="font-size: 9px; 
                                   padding: 1px 8px; 
                                   border-radius: 8px; 
                                   background: #0f172a; 
                                   border: 1px solid #1a2a3a; 
                                   color: #3b82f6; 
                                   cursor: pointer;
                                   transition: all 0.2s;
                                   white-space: nowrap;"
                            title="Перейти к ${this.manager.escapeHtml(caller)} из ${this.manager.escapeHtml(callerDisplay)} (${sourceLabel})">
                        ← ${this.manager.escapeHtml(caller)}
                        <span style="font-size: 7px; color: #64748b; margin-left: 2px;">
                            ${sourceIcon} ${sourceLabel}
                        </span>
                        <span class="nav-module" style="font-size: 7px; color: ${levelColor}; margin-left: 2px;">
                            📁${this.manager.escapeHtml(callerDisplay)}
                            ${level > 0 ? ` L${level}` : ''}
                        </span>
                    </button>
                `;
      }
    }

    if (hasMore) {
      const remaining = totalCount - maxDisplay;
      html += `
                <span class="nav-more" style="font-size: 9px; color: #64748b; padding: 1px 6px;">
                    +${remaining}
                </span>
            `;
    }

    // Кнопка "Показать все"
    if (hasMore) {
      html += `
                <button class="nav-btn show-all" 
                        onclick="event.stopPropagation(); this.closest('.nav-incoming').querySelector('.nav-buttons').classList.toggle('expanded'); this.textContent = this.textContent === 'Показать все' ? 'Свернуть' : 'Показать все';"
                        style="font-size: 8px; 
                               padding: 1px 6px; 
                               border-radius: 8px; 
                               background: transparent; 
                               border: 1px solid #334155; 
                               color: #64748b; 
                               cursor: pointer;">
                    Показать все
                </button>
            `;
    }

    html += `
                </div>
            </div>
        `;

    return html;
  }

  /**
   * Рендеринг компактной версии секции (для свернутого состояния)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCompact(data) {
    const { externalOutgoing, externalIncoming } = data;
    let parts = [];

    if (externalOutgoing && externalOutgoing.size > 0) {
      const firstThree = Array.from(externalOutgoing).slice(0, 3);
      const display = firstThree
        .map(name => {
          const module = this.manager.findModuleForFunction(name);
          return module ? `${name}(${module.split('/').pop()})` : name;
        })
        .join(', ');
      parts.push(
        `📤 ${externalOutgoing.size}: ${display}${externalOutgoing.size > 3 ? ` +${externalOutgoing.size - 3}` : ''}`
      );
    }

    if (externalIncoming && externalIncoming.size > 0) {
      const firstThree = Array.from(externalIncoming).slice(0, 3);
      const display = firstThree
        .map(name => {
          const module = this.manager.findModuleForFunction(name);
          return module ? `${name}(${module.split('/').pop()})` : name;
        })
        .join(', ');
      parts.push(
        `📥 ${externalIncoming.size}: ${display}${externalIncoming.size > 3 ? ` +${externalIncoming.size - 3}` : ''}`
      );
    }

    if (parts.length === 0) return '';

    return `
            <div class="nav-section nav-external compact" style="padding: 2px 8px; margin: 1px 0;">
                <span class="nav-label" style="font-size: 9px; color: #f59e0b;">
                    🌐 Внешние вызовы:
                </span>
                <span style="font-size: 8px; color: #64748b;">
                    ${parts.join(' | ')}
                </span>
            </div>
        `;
  }

  /**
   * Рендеринг только количества вызовов (для бейджей)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCount(data) {
    const { externalOutgoing, externalIncoming } = data;
    let parts = [];

    if (externalOutgoing && externalOutgoing.size > 0) {
      parts.push(`📤 ${externalOutgoing.size}`);
    }

    if (externalIncoming && externalIncoming.size > 0) {
      parts.push(`📥 ${externalIncoming.size}`);
    }

    if (parts.length === 0) return '';

    return `
            <span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #1a2a1a; color: #f59e0b; border: 1px solid #2a3a2a;">
                🌐 ${parts.join(' ')}
            </span>
        `;
  }

  /**
   * Проверяет, есть ли внешние вызовы
   * @param {Object} data - Данные для проверки
   * @returns {boolean} true если есть вызовы
   */
  hasExternalCalls(data) {
    const { externalOutgoing, externalIncoming } = data;
    return (
      (externalOutgoing && externalOutgoing.size > 0) ||
      (externalIncoming && externalIncoming.size > 0)
    );
  }

  /**
   * Получает общее количество внешних вызовов
   * @param {Object} data - Данные
   * @returns {number} Общее количество
   */
  getTotalCalls(data) {
    const { externalOutgoing, externalIncoming } = data;
    return (
      (externalOutgoing ? externalOutgoing.size : 0) +
      (externalIncoming ? externalIncoming.size : 0)
    );
  }

  /**
   * Получает список всех внешних вызовов с их модулями
   * @param {Object} data - Данные
   * @returns {Array<{name: string, module: string, direction: string, source: string}>}
   */
  getAllCalls(data) {
    const { externalOutgoing, externalIncoming, funcs, callSources } = data;
    const result = [];

    if (externalOutgoing) {
      for (const call of externalOutgoing) {
        const targetModule = this.manager.findModuleForFunction(call);
        if (targetModule) {
          const source = this.manager.getCallSource(call, targetModule, funcs);
          result.push({
            name: call,
            module: targetModule,
            direction: 'outgoing',
            source: source,
          });
        }
      }
    }

    if (externalIncoming) {
      for (const caller of externalIncoming) {
        const callerModule = this.manager.findModuleForFunction(caller);
        if (callerModule) {
          const source = this.manager.getCallSource(caller, callerModule, funcs);
          result.push({
            name: caller,
            module: callerModule,
            direction: 'incoming',
            source: source,
          });
        }
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Получает иконку для направления вызова
   * @param {string} direction - Направление ('outgoing' или 'incoming')
   * @returns {string} Иконка
   */
  getDirectionIcon(direction) {
    return direction === 'outgoing' ? '📤' : '📥';
  }

  /**
   * Получает цвет для направления вызова
   * @param {string} direction - Направление ('outgoing' или 'incoming')
   * @returns {string} Цвет
   */
  getDirectionColor(direction) {
    return direction === 'outgoing' ? '#f59e0b' : '#3b82f6';
  }
}
