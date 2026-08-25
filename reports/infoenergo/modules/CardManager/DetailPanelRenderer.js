// packages/ast-analyzer/src/reporters/templates/modules/CardManager/DetailPanelRenderer.js

/**
 * DetailPanelRenderer - рендеринг панели деталей функции
 * Отвечает за отображение подробной информации о функции
 *
 * Особенности:
 * - Полная информация о функции (параметры, возврат, сложность)
 * - Внешние и внутренние вызовы
 * - Внешние и внутренние вызывающие
 * - Дерево вызовов
 * - Git история изменений
 * - Копирование сигнатуры
 * - Навигация обратно к источнику
 */
export class DetailPanelRenderer {
  constructor(manager) {
    this.manager = manager;
    this._expandedCallTrees = new Set();
  }

  /**
   * Рендеринг панели деталей
   * @param {Object} data - Данные функции
   * @param {Object} cardManager - Экземпляр CardManager
   */
  render(data, cardManager) {
    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    // Если нет данных - скрываем панель
    if (!data || !data.name) {
      panel.classList.remove('active');
      return;
    }

    document.getElementById('dpTitle').textContent = data.name || 'Функция';

    let html = '';

    // ============================================
    // 1. ИНФОРМАЦИЯ О ФУНКЦИИ
    // ============================================
    html += '<div class="dp-section"><h4>📋 Информация</h4>';
    html +=
      '<div class="item"><span class="label">Модуль:</span> ' +
      this.manager.escapeHtml(data.module || 'неизвестен') +
      '</div>';
    html += '<div class="item"><span class="label">Строка:</span> ' + (data.line || 0) + '</div>';
    html +=
      '<div class="item"><span class="label">Экспортирована:</span> ' +
      (data.isExported ? '✅' : '❌') +
      '</div>';
    html +=
      '<div class="item"><span class="label">Асинхронная:</span> ' +
      (data.isAsync ? '✅' : '❌') +
      '</div>';
    html +=
      '<div class="item"><span class="label">Возврат:</span> ' +
      this.manager.escapeHtml(data.returnType || 'any') +
      '</div>';

    // Источник вызова
    const callSource = data.callSource || 'top-level';
    const sourceIcon = callSource === 'top-level' ? '📋' : '🔽';
    const sourceLabel = callSource === 'top-level' ? 'Top-level' : 'из ' + callSource;
    html += `<div class="item"><span class="label">Источник:</span> ${sourceIcon} ${sourceLabel}</div>`;

    // Сложность
    if (data.complexity) {
      const complexityColor =
        data.complexity > 10 ? '#f87171' : data.complexity > 5 ? '#fbbf24' : '#4ade80';
      html += `<div class="item"><span class="label">Сложность:</span> <span style="color: ${complexityColor};">${data.complexity}</span></div>`;
    }

    // Размер
    if (data.endLine && data.startLine) {
      const size = data.endLine - data.startLine + 1;
      html += `<div class="item"><span class="label">Размер:</span> ${size} строк</div>`;
    }

    // Покрытие тестами
    if (data.isTested) {
      html += `<div class="item"><span class="label">Тесты:</span> ✅ покрыта</div>`;
    }

    // Устаревшая
    if (data.isDeprecated) {
      html += `<div class="item"><span class="label">Статус:</span> ⚠️ устаревшая</div>`;
    }

    // Уровень безопасности
    if (data.securityLevel && data.securityLevel !== 'low') {
      const securityColor = data.securityLevel === 'high' ? '#f87171' : '#fbbf24';
      html += `<div class="item"><span class="label">Безопасность:</span> <span style="color: ${securityColor};">🔒 ${data.securityLevel}</span></div>`;
    }

    // Уровень модуля
    if (data.module) {
      const level = this.manager.getModuleLevel(data.module);
      const levelDisplay = level === 0 ? '🌌' : `L${level}`;
      html += `<div class="item"><span class="label">Уровень:</span> ${levelDisplay}</div>`;
    }

    // Информация об источнике навигации (откуда пришли)
    if (cardManager._lastSource) {
      const [srcModule, srcFunc] = cardManager._lastSource.split('#');
      const srcDisplay = srcFunc || srcModule.split('/').pop() || srcModule;
      html += `
                <div class="item" style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #1a1a3a;">
                    <span class="label">📍 Откуда пришли:</span>
                    <span style="color:#22d3ee;cursor:pointer;font-family:monospace;" 
                          onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(srcFunc)}', '${this.manager.escapeJs(srcModule)}')">
                        ${this.manager.escapeHtml(srcDisplay)}
                    </span>
                    <span style="color:#64748b;font-size:10px;margin-left:4px;">⬅ вернуться</span>
                </div>
            `;
    }

    html += '</div>';

    // ============================================
    // 2. ПАРАМЕТРЫ С ТИПАМИ
    // ============================================
    const paramsWithTypes = data.paramsWithTypes || [];
    const params = data.params || [];
    if (params.length > 0) {
      html += '<div class="dp-section"><h4>📌 Параметры</h4>';
      for (let i = 0; i < params.length; i++) {
        const p = params[i];
        const pType = paramsWithTypes[i]?.type || '';
        html += `<div class="item" style="font-family: monospace; font-size: 12px;">
                    <span class="param-name" style="color: #e2e8f0;">${this.manager.escapeHtml(p)}</span>
                    ${pType ? `: <span class="param-type" style="color: #a78bfa;">${this.manager.escapeHtml(pType)}</span>` : ''}
                </div>`;
      }
      html += '</div>';
    }

    // ============================================
    // 3. ИСПОЛЬЗУЕМЫЕ ТИПЫ
    // ============================================
    const usedTypes = data.usedTypes || [];
    if (usedTypes.length > 0) {
      html += '<div class="dp-section"><h4>📝 Используемые типы</h4>';
      html += '<div style="display: flex; flex-wrap: wrap; gap: 4px;">';
      for (const type of usedTypes) {
        html += `<span class="type-tag" style="font-size: 11px; background: #0f172a; padding: 2px 10px; border-radius: 4px; color: #a78bfa; border: 1px solid #2a2a4a;">${this.manager.escapeHtml(type)}</span>`;
      }
      html += '</div></div>';
    }

    // ============================================
    // 4. ТЕГИ
    // ============================================
    const tags = data.tags || [];
    if (tags.length > 0) {
      html += '<div class="dp-section"><h4>🏷️ Теги</h4>';
      html += '<div style="display: flex; flex-wrap: wrap; gap: 4px;">';
      for (const tag of tags) {
        html += `<span class="tag" style="font-size: 11px; background: #1a2a4a; padding: 2px 10px; border-radius: 10px; color: #60a5fa;">#${this.manager.escapeHtml(tag)}</span>`;
      }
      html += '</div></div>';
    }

    // ============================================
    // 5. ОПИСАНИЕ
    // ============================================
    if (data.description) {
      html += '<div class="dp-section"><h4>📄 Описание</h4>';
      html += `<div class="item" style="font-size: 13px; color: #e2e8f0; padding: 8px; background: #0f172a; border-radius: 4px; border-left: 3px solid #60a5fa;">${this.manager.escapeHtml(data.description)}</div>`;
      html += '</div>';
    }

    // ============================================
    // 6. ВНЕШНИЕ ВЫЗОВЫ
    // ============================================
    const allCalls = data.calls || [];
    const modulePath = data.module;
    const externalCalls = [];
    const internalCalls = [];

    for (const call of allCalls) {
      const targetModule = this.manager.findModuleForFunction(call);
      if (targetModule && targetModule !== modulePath) {
        externalCalls.push(call);
      } else {
        internalCalls.push(call);
      }
    }

    if (externalCalls.length > 0) {
      html += '<div class="dp-section"><h4>🌐 Внешние вызовы</h4>';
      for (const call of externalCalls) {
        const targetModule = this.manager.findModuleForFunction(call);
        const moduleDisplay = targetModule ? ` 📁${targetModule.split('/').pop()}` : '';
        const source = this.manager.getCallSource(call, targetModule || modulePath, []);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;
        html += `
                    <div class="item" style="cursor:pointer;color:#f59e0b; font-size: 12px; font-family: monospace; padding: 2px 8px; background: #0a0a1a; border-radius: 3px; margin: 2px 0;" 
                         onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(call)}', '${this.manager.escapeJs(targetModule || data.module || '')}')">
                        → ${this.manager.escapeHtml(call)}${moduleDisplay}
                        <span style="color:#64748b;font-size:10px;margin-left:6px;">${sourceIcon} ${sourceLabel}</span>
                    </div>
                `;
      }
      html += '</div>';
    }

    // ============================================
    // 7. ВНУТРЕННИЕ ВЫЗОВЫ
    // ============================================
    if (internalCalls.length > 0) {
      html += '<div class="dp-section"><h4>🔄 Внутренние вызовы</h4>';
      for (const call of internalCalls) {
        const source = this.manager.getCallSource(call, modulePath, []);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;
        html += `
                    <div class="item" style="color:#94a3b8;font-size:11px;font-family:monospace;padding:2px 8px;background:#0a0a1a;border-radius:3px;margin:2px 0;">
                        → ${this.manager.escapeHtml(call)}
                        <span style="color:#64748b;font-size:9px;margin-left:6px;">${sourceIcon} ${sourceLabel}</span>
                    </div>
                `;
      }
      html += '</div>';
    }

    // ============================================
    // 8. ВНЕШНИЕ ВЫЗЫВАЮЩИЕ
    // ============================================
    const allCalledBy = data.calledBy || [];
    const externalCallers = [];
    const internalCallers = [];

    for (const caller of allCalledBy) {
      const callerModule = this.manager.findModuleForFunction(caller);
      if (callerModule && callerModule !== modulePath) {
        externalCallers.push(caller);
      } else {
        internalCallers.push(caller);
      }
    }

    if (externalCallers.length > 0) {
      html += '<div class="dp-section"><h4>📥 Внешние вызывающие</h4>';
      for (const caller of externalCallers) {
        const callerModule = this.manager.findModuleForFunction(caller);
        const moduleDisplay = callerModule ? ` 📁${callerModule.split('/').pop()}` : '';
        const source = this.manager.getCallSource(caller, callerModule || modulePath, []);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;
        html += `
                    <div class="item" style="cursor:pointer;color:#3b82f6; font-size: 12px; font-family: monospace; padding: 2px 8px; background: #0a0a1a; border-radius: 3px; margin: 2px 0;" 
                         onclick="window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(caller)}', '${this.manager.escapeJs(callerModule || data.module || '')}')">
                        ← ${this.manager.escapeHtml(caller)}${moduleDisplay}
                        <span style="color:#64748b;font-size:10px;margin-left:6px;">${sourceIcon} ${sourceLabel}</span>
                    </div>
                `;
      }
      html += '</div>';
    }

    // ============================================
    // 9. ВНУТРЕННИЕ ВЫЗЫВАЮЩИЕ
    // ============================================
    if (internalCallers.length > 0) {
      html += '<div class="dp-section"><h4>🔄 Внутренние вызывающие</h4>';
      for (const caller of internalCallers) {
        const source = this.manager.getCallSource(caller, modulePath, []);
        const sourceIcon = source === 'top-level' ? '📋' : '🔽';
        const sourceLabel = source === 'top-level' ? 'top-level' : `из ${source}`;
        html += `
                    <div class="item" style="color:#94a3b8;font-size:11px;font-family:monospace;padding:2px 8px;background:#0a0a1a;border-radius:3px;margin:2px 0;">
                        ← ${this.manager.escapeHtml(caller)}
                        <span style="color:#64748b;font-size:9px;margin-left:6px;">${sourceIcon} ${sourceLabel}</span>
                    </div>
                `;
      }
      html += '</div>';
    }

    // ============================================
    // 10. ДЕРЕВО ВЫЗОВОВ
    // ============================================
    if (data.module) {
      const pkg = this.manager.app.reportData?.packages?.[data.module];
      const funcs = pkg?.entities?.functions || [];
      const tree = this.manager.buildCallTree(data.name, data.module, funcs, 0, 3);

      if (tree && (tree.calls.length > 0 || tree.calledBy.length > 0)) {
        const treeKey = `${data.module}#${data.name}`;
        const isExpanded = this._expandedCallTrees.has(treeKey);

        html += `
                    <div class="dp-section">
                        <h4 style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" 
                            onclick="this.closest('.dp-section').querySelector('.call-tree-container').classList.toggle('expanded'); this.querySelector('.tree-toggle').textContent = this.closest('.dp-section').querySelector('.call-tree-container').classList.contains('expanded') ? '▼' : '▶'">
                            <span>🌳 Дерево вызовов</span>
                            <span class="tree-toggle" style="font-size: 12px; color: #64748b;">${isExpanded ? '▼' : '▶'}</span>
                        </h4>
                        <div class="call-tree-container ${isExpanded ? 'expanded' : ''}" 
                             style="max-height:300px;overflow-y:auto; ${isExpanded ? '' : 'display:none;'}">
                            ${this.renderCallTree(tree, false, 0)}
                        </div>
                    </div>
                `;
      }
    }

    // ============================================
    // 11. GIT ИСТОРИЯ ИЗМЕНЕНИЙ
    // ============================================
    if (data.lastModified) {
      html += '<div class="dp-section"><h4>👤 История изменений</h4>';
      html += `<div class="item"><span class="label">Автор:</span> ${this.manager.escapeHtml(data.lastModified.author || 'unknown')}</div>`;
      if (data.lastModified.date) {
        html += `<div class="item"><span class="label">Дата:</span> ${this.manager.escapeHtml(data.lastModified.date)}</div>`;
      }
      if (data.lastModified.message) {
        html += `<div class="item"><span class="label">Сообщение:</span> ${this.manager.escapeHtml(data.lastModified.message)}</div>`;
      }
      html += '</div>';
    }

    // ============================================
    // 12. КОПИРОВАНИЕ СИГНАТУРЫ
    // ============================================
    const signature = `${data.name}(${(data.params || []).join(', ')}): ${data.returnType || 'any'}`;
    html += `
            <div class="dp-section" style="border-top: 1px solid #1a2a4a; padding-top: 10px;">
                <button onclick="navigator.clipboard.writeText('${this.manager.escapeJs(signature)}'); this.textContent = '✅ Скопировано!'; setTimeout(() => this.textContent = '📋 Копировать сигнатуру', 1500);" 
                        style="background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 10px; transition: all 0.2s; width: 100%;">
                    📋 Копировать сигнатуру
                </button>
            </div>
        `;

    document.getElementById('dpContent').innerHTML = html;
    panel.classList.add('active');
  }

  /**
   * Рендеринг дерева вызовов
   * @param {Object} tree - Дерево вызовов
   * @param {boolean} isIncoming - Входящий или исходящий вызов
   * @param {number} level - Уровень вложенности
   * @returns {string} HTML строка
   */
  renderCallTree(tree, isIncoming = false, level = 0) {
    if (!tree) return '';

    const arrow = isIncoming ? '←' : '→';
    const color = isIncoming ? '#3b82f6' : '#f59e0b';
    const icon = tree.isExported ? '📤' : '';
    const asyncIcon = tree.isAsync ? '⚡' : '';
    const deprecatedIcon = tree.isDeprecated ? '⚠️' : '';
    const hasChildren = tree.calls.length > 0 || tree.calledBy.length > 0;
    const isCurrent = tree.name === this.manager.currentFocusFunction;

    const complexityColor =
      tree.complexity > 10 ? '#f87171' : tree.complexity > 5 ? '#fbbf24' : '#4ade80';
    const sourceIcon = tree.callSource === 'top-level' ? '📋' : '🔽';
    const sourceLabel = tree.callSource === 'top-level' ? 'top-level' : `из ${tree.callSource}`;

    const treeKey = `${this.manager.currentFocusModule}#${tree.name}`;
    const isExpanded = this._expandedCallTrees.has(treeKey);

    let html = `
            <div class="call-tree-item ${isCurrent ? 'current' : ''}" 
                 style="padding-left: ${level * 20}px; margin: 1px 0;" 
                 data-function="${tree.name}" 
                 data-module="${this.manager.currentFocusModule}">
                <div class="call-tree-node ${isIncoming ? 'incoming' : 'outgoing'} ${isCurrent ? 'current' : ''}" 
                     style="border-left-color: ${color}; ${isCurrent ? 'background: #1a2a4a; border-left-color: #22d3ee;' : 'background: #0a0a1a;'} border-radius: 3px; padding: 2px 6px; display: flex; align-items: center; flex-wrap: wrap; gap: 3px; cursor: pointer;"
                     onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(tree.name)}', '${this.manager.escapeJs(this.manager.currentFocusModule)}')">
                    
                    <span class="call-tree-arrow" style="color: ${color}; font-size: 11px;">${arrow}</span>
                    
                    <span class="call-tree-name" style="font-size: 11px; font-weight: 500; color: #e2e8f0;">${this.manager.escapeHtml(tree.name)}</span>
                    
                    ${icon ? `<span class="call-tree-icon" style="font-size: 9px;">${icon}</span>` : ''}
                    ${asyncIcon ? `<span class="call-tree-async" style="font-size: 9px; color: #fbbf24;">${asyncIcon}</span>` : ''}
                    ${deprecatedIcon ? `<span class="call-tree-deprecated" style="font-size: 9px;">${deprecatedIcon}</span>` : ''}
                    
                    <span class="call-tree-source" style="font-size: 8px; color: #64748b;" title="Источник вызова: ${sourceLabel}">
                        ${sourceIcon} ${sourceLabel}
                    </span>
                    
                    ${tree.complexity > 0 ? `<span class="call-tree-complexity" style="color: ${complexityColor}; font-size: 8px;" title="Сложность: ${tree.complexity}">🔄 ${tree.complexity}</span>` : ''}
                    
                    ${tree.size > 0 ? `<span class="call-tree-size" style="font-size: 8px; color: #64748b;" title="Размер: ${tree.size} строк">📏 ${tree.size}</span>` : ''}
                    
                    ${tree.isTested ? '<span class="call-tree-tested" style="font-size: 8px;">🧪</span>' : ''}
                    
                    <span class="call-tree-line" style="font-size: 8px; color: #64748b;">стр.${tree.line}</span>
                    
                    ${isCurrent ? '<span class="call-tree-current-badge" style="font-size: 9px;">🎯</span>' : ''}
                    
                    ${
                      hasChildren
                        ? `
                        <span class="call-tree-toggle" style="font-size: 9px; color: #64748b; cursor: pointer; padding: 0 3px;" 
                              onclick="event.stopPropagation(); 
                                      const container = this.closest('.call-tree-item').querySelector('.call-tree-children');
                                      container.classList.toggle('expanded');
                                      this.textContent = container.classList.contains('expanded') ? '▼' : '▶'">
                            ${isExpanded ? '▼' : '▶'}
                        </span>
                    `
                        : ''
                    }
                    
                    <span class="call-tree-count" style="font-size: 7px; color: #64748b; background: #1a1a3a; padding: 0 5px; border-radius: 8px;">
                        ${tree.calls.length + tree.calledBy.length}
                    </span>
                    
                    ${
                      tree.securityLevel && tree.securityLevel !== 'low'
                        ? `<span class="call-tree-security security-${tree.securityLevel}" style="font-size: 8px; color: ${tree.securityLevel === 'high' ? '#f87171' : '#fbbf24'};">🔒 ${tree.securityLevel}</span>`
                        : ''
                    }
                </div>
                
                ${
                  tree.description
                    ? `
                    <div class="call-tree-description" style="padding-left: ${level * 20 + 30}px; font-size: 9px; color: #94a3b8; margin: 1px 0 1px 0; border-left: 1px solid #1a2a4a; padding-left: 10px;">
                        ${this.manager.escapeHtml(tree.description)}
                    </div>
                `
                    : ''
                }
                
                ${
                  tree.tags && tree.tags.length > 0
                    ? `
                    <div class="call-tree-tags" style="padding-left: ${level * 20 + 30}px; font-size: 8px; margin: 1px 0;">
                        ${tree.tags
                          .map(
                            tag =>
                              `<span class="tag" style="background: #1a2a4a; padding: 0 5px; border-radius: 6px; margin-right: 2px; color: #60a5fa; font-size: 8px;">#${this.manager.escapeHtml(tag)}</span>`
                          )
                          .join('')}
                    </div>
                `
                    : ''
                }
                
                ${
                  hasChildren
                    ? `
                    <div class="call-tree-children ${isExpanded ? 'expanded' : ''}" 
                         style="${isExpanded ? '' : 'display:none;'} padding-left: ${level * 10}px; margin-top: 1px;">
                        ${tree.calls.map(c => this.renderCallTree(c, false, level + 1)).join('')}
                        ${tree.calledBy.map(c => this.renderCallTree(c, true, level + 1)).join('')}
                    </div>
                `
                    : ''
                }
            </div>
        `;

    return html;
  }

  /**
   * Переключение состояния дерева вызовов
   * @param {string} key - Ключ дерева (module#function)
   */
  toggleCallTree(key) {
    if (this._expandedCallTrees.has(key)) {
      this._expandedCallTrees.delete(key);
    } else {
      this._expandedCallTrees.add(key);
    }
  }

  /**
   * Проверка, развернуто ли дерево
   * @param {string} key - Ключ дерева
   * @returns {boolean}
   */
  isCallTreeExpanded(key) {
    return this._expandedCallTrees.has(key);
  }

  /**
   * Сброс всех развернутых деревьев
   */
  resetCallTrees() {
    this._expandedCallTrees.clear();
  }

  /**
   * Закрытие панели деталей
   */
  close() {
    const panel = document.getElementById('detailPanel');
    if (panel) {
      panel.classList.remove('active');
    }
    this.resetCallTrees();
  }
}
