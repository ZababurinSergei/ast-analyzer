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
 * - ПОКАЗЫВАЕТ ВСЕ ВЫЗОВЫ БЕЗ ОГРАНИЧЕНИЙ
 */
export class NavExternalRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Рендеринг секции внешних вызовов (основной метод - для обратной совместимости)
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
    // Для обратной совместимости - используем оба метода
    const outgoingHtml = this.renderOutgoing(data);
    const incomingHtml = this.renderIncoming(data);
    return outgoingHtml + incomingHtml;
  }

  /**
   * Рендеринг исходящих вызовов - ВСЕ ВЫЗОВЫ БЕЗ ОГРАНИЧЕНИЙ
   * @param {Object} data - Данные для рендеринга
   * @param {Set<string>} data.externalOutgoing - Множество имен внешних функций, которые вызывает текущий модуль
   * @param {string} data.modulePath - Путь к текущему модулю
   * @param {Array} data.funcs - Список функций текущего модуля
   * @param {Map} data.callSources - Карта источников вызовов
   * @param {Object} data.reportData - Данные отчета (опционально)
   * @returns {string} HTML строка
   */
  renderOutgoing(data) {
    const { externalOutgoing, modulePath, funcs, callSources, reportData } = data;

    if (!externalOutgoing || externalOutgoing.size === 0) {
      return '';
    }

    // ✅ СОРТИРУЕМ ВСЕ ВЫЗОВЫ
    const sortedCalls = Array.from(externalOutgoing).sort();
    const totalCount = externalOutgoing.size;

    let html = `
            <div class="nav-section nav-external nav-outgoing" style="padding: 4px 8px; margin: 2px 0; border-top: 1px solid #1a2a3a;">
                <span class="nav-label" style="font-size: 10px; color: #f59e0b;">
                    📤 export (${totalCount}):
                </span>
                <div class="nav-buttons" style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px;">
        `;

    // ✅ ПРОХОДИМ ПО ВСЕМ ВЫЗОВАМ
    for (const call of sortedCalls) {
      // Ищем модуль для функции
      const targetModule = this.manager.findModuleForFunction(call);

      // Если модуль найден и это не текущий модуль - показываем
      if (targetModule && targetModule !== modulePath) {
        const targetDisplay = targetModule.split('/').pop() || '?';

        const source = this.manager.getCallSource(call, targetModule, funcs);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;

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
      } else if (!targetModule) {
        // ✅ ЕСЛИ МОДУЛЬ НЕ НАЙДЕН - ВСЕ РАВНО ПОКАЗЫВАЕМ ВЫЗОВ
        const source = this.manager.getCallSource(call, modulePath, funcs);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;

        html += `
                    <span class="nav-btn external outgoing" 
                          style="font-size: 9px; 
                                 padding: 1px 8px; 
                                 border-radius: 8px; 
                                 background: #0f172a; 
                                 border: 1px solid #2a2a3a; 
                                 color: #64748b; 
                                 cursor: default;
                                 white-space: nowrap;"
                          title="Функция ${this.manager.escapeHtml(call)} (модуль не найден)">
                        ➜ ${this.manager.escapeHtml(call)}
                        <span style="font-size: 7px; color: #64748b; margin-left: 2px;">
                            ${sourceIcon} ${sourceLabel}
                        </span>
                        <span style="font-size: 7px; color: #64748b; margin-left: 2px;">
                            ⚠️ не найден
                        </span>
                    </span>
                `;
      }
    }

    html += `
                </div>
            </div>
        `;

    return html;
  }

  /**
   * Рендеринг входящих вызовов - ВСЕ ВЫЗОВЫ БЕЗ ОГРАНИЧЕНИЙ
   * @param {Object} data - Данные для рендеринга
   * @param {Set<string>} data.externalIncoming - Множество имен внешних функций, которые вызывают текущий модуль
   * @param {string} data.modulePath - Путь к текущему модулю
   * @param {Array} data.funcs - Список функций текущего модуля
   * @param {Map} data.callSources - Карта источников вызовов
   * @param {Object} data.reportData - Данные отчета (опционально)
   * @returns {string} HTML строка
   */
  renderIncoming(data) {
    const { externalIncoming, modulePath, funcs, callSources, reportData } = data;

    if (!externalIncoming || externalIncoming.size === 0) {
      return '';
    }

    // ✅ СОРТИРУЕМ ВСЕ ВЫЗОВЫ
    const sortedCallers = Array.from(externalIncoming).sort();
    const totalCount = externalIncoming.size;

    let html = `
            <div class="nav-section nav-external nav-incoming" style="padding: 4px 8px; margin: 2px 0; border-top: 1px solid #1a2a3a;">
                <span class="nav-label" style="font-size: 10px; color: #3b82f6;">
                    📥 Входящие вызовы (${totalCount}):
                </span>
                <div class="nav-buttons" style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px;">
        `;

    // ✅ ПРОХОДИМ ПО ВСЕМ ВЫЗОВАМ
    for (const caller of sortedCallers) {
      const callerModule = this.manager.findModuleForFunction(caller);

      if (callerModule && callerModule !== modulePath) {
        const callerDisplay = callerModule.split('/').pop() || '?';

        const source = this.manager.getCallSource(caller, callerModule, funcs);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;

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
      } else if (!callerModule) {
        // ✅ ЕСЛИ МОДУЛЬ НЕ НАЙДЕН - ВСЕ РАВНО ПОКАЗЫВАЕМ ВЫЗОВ
        const source = this.manager.getCallSource(caller, modulePath, funcs);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;

        html += `
                    <span class="nav-btn external incoming" 
                          style="font-size: 9px; 
                                 padding: 1px 8px; 
                                 border-radius: 8px; 
                                 background: #0f172a; 
                                 border: 1px solid #1a2a3a; 
                                 color: #64748b; 
                                 cursor: default;
                                 white-space: nowrap;"
                          title="Функция ${this.manager.escapeHtml(caller)} (модуль не найден)">
                        ← ${this.manager.escapeHtml(caller)}
                        <span style="font-size: 7px; color: #64748b; margin-left: 2px;">
                            ${sourceIcon} ${sourceLabel}
                        </span>
                        <span style="font-size: 7px; color: #64748b; margin-left: 2px;">
                            ⚠️ не найден
                        </span>
                    </span>
                `;
      }
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
        } else {
          result.push({
            name: call,
            module: null,
            direction: 'outgoing',
            source: 'unknown',
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
        } else {
          result.push({
            name: caller,
            module: null,
            direction: 'incoming',
            source: 'unknown',
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
