// packages/ast-analyzer/src/reporters/templates/modules/CardManager/CallTreeRenderer.js

/**
 * CallTreeRenderer - рендеринг дерева вызовов функций
 * Отвечает за отображение иерархической структуры вызовов функций
 *
 * Особенности:
 * - Отображение исходящих (→) и входящих (←) вызовов
 * - Цветовая кодировка: исходящие - оранжевые, входящие - синие
 * - Индикация экспортированных и асинхронных функций
 * - Отображение сложности и размера функций
 * - Поддержка сворачивания/разворачивания узлов
 * - Подсветка текущей функции
 * - Клик по узлу → переход к функции
 * - Отображение источника вызова (top-level или из функции)
 * - Компактный стиль для экономии места
 */
export class CallTreeRenderer {
  constructor(manager) {
    this.manager = manager;
    this.maxDepth = 3; // Максимальная глубина дерева
    this.expandedNodes = new Set();
  }

  /**
   * Рендеринг дерева вызовов для активной функции
   * @param {Object} data - Данные для рендеринга
   * @param {boolean} data.isActive - Активен ли модуль
   * @param {string} data.focusFunction - Имя активной функции
   * @param {Array} data.funcs - Список функций модуля
   * @param {string} data.modulePath - Путь к модулю
   * @param {number} data.maxDepth - Максимальная глубина (опционально)
   * @returns {string} HTML строка
   */
  render(data) {
    const { isActive, focusFunction, funcs, modulePath, maxDepth = this.maxDepth } = data;

    // Проверяем, есть ли активная функция
    if (!isActive || !focusFunction) {
      return '';
    }

    // Находим активную функцию
    const activeFunc = funcs.find(f => f.name === focusFunction);
    if (!activeFunc) {
      return '';
    }

    // Строим дерево вызовов
    const tree = this.manager.buildCallTree(focusFunction, modulePath, funcs, 0, maxDepth);

    // Если дерево пустое или нет связей - ничего не показываем
    if (!tree || (tree.calls.length === 0 && tree.calledBy.length === 0)) {
      return '';
    }

    // Собираем статистику для заголовка
    const totalCalls = tree.calls.length;
    const totalCalledBy = tree.calledBy.length;
    const hasComplexity = tree.complexity > 0;
    const hasSize = tree.size > 0;
    const isTested = tree.isTested;
    const isExported = tree.isExported;
    const isAsync = tree.isAsync;

    return `
            <div class="call-tree-section" style="margin: 4px 0; border: 1px solid #1a2a4a; border-radius: 6px; overflow: hidden;">
                <!-- Заголовок дерева -->
                <div class="call-tree-header" 
                     onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('.toggle-icon').textContent = this.nextElementSibling.classList.contains('expanded') ? '▼' : '▶'" 
                     style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: #0f172a; cursor: pointer; transition: background 0.2s;"
                     onmouseenter="this.style.background='#1a2a4a'"
                     onmouseleave="this.style.background='#0f172a'">
                    
                    <span class="call-tree-title" style="font-size: 11px; font-weight: 600; color: #60a5fa; flex: 1;">
                        🌳 Дерево вызовов: ${this.manager.escapeHtml(focusFunction)}
                        ${isExported ? ' 📤' : ''}
                        ${isAsync ? ' ⚡' : ''}
                        ${isTested ? ' 🧪' : ''}
                    </span>
                    
                    <span class="toggle-icon" style="font-size: 10px; color: #64748b;">▼</span>
                    
                    <span class="call-tree-stats" style="font-size: 9px; color: #64748b; display: flex; gap: 8px; flex-wrap: wrap;">
                        <span style="color: #f59e0b;">→ ${totalCalls}</span>
                        <span style="color: #3b82f6;">← ${totalCalledBy}</span>
                        ${hasComplexity ? `<span style="color: ${tree.complexity > 10 ? '#f87171' : tree.complexity > 5 ? '#fbbf24' : '#4ade80'};">🔄 ${tree.complexity}</span>` : ''}
                        ${hasSize ? `<span>📏 ${tree.size}</span>` : ''}
                        ${isTested ? '<span>🧪 тесты</span>' : ''}
                    </span>
                </div>
                
                <!-- Тело дерева -->
                <div class="call-tree-body expanded" 
                     style="padding: 4px 8px; max-height: 300px; overflow-y: auto; background: #0a0a1a;">
                    
                    <!-- Легенда -->
                    <div class="call-tree-legend" style="display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0; font-size: 8px; color: #94a3b8; border-bottom: 1px solid #1a1a3a; margin-bottom: 4px;">
                        <span class="legend-item">
                            <span class="legend-color outgoing" style="display: inline-block; width: 10px; height: 2px; background: #f59e0b; border-radius: 1px;"></span>
                            Исходящие (→)
                        </span>
                        <span class="legend-item">
                            <span class="legend-color incoming" style="display: inline-block; width: 10px; height: 2px; background: #3b82f6; border-radius: 1px;"></span>
                            Входящие (←)
                        </span>
                        <span class="legend-item">
                            <span class="legend-color exported" style="display: inline-block; width: 10px; height: 2px; background: #f87171; border-radius: 1px;"></span>
                            Экспортирована
                        </span>
                        <span class="legend-item">
                            <span class="legend-color async" style="display: inline-block; width: 10px; height: 2px; background: #fbbf24; border-radius: 1px;"></span>
                            Асинхронная
                        </span>
                        <span class="legend-item">
                            <span class="legend-color current" style="display: inline-block; width: 10px; height: 2px; background: #22d3ee; border-radius: 1px;"></span>
                            Текущая
                        </span>
                        <span class="legend-item">
                            <span class="legend-color top-level" style="display: inline-block; width: 10px; height: 2px; background: #4ade80; border-radius: 1px;"></span>
                            Top-level
                        </span>
                        <span class="legend-item">
                            <span class="legend-color from-function" style="display: inline-block; width: 10px; height: 2px; background: #fbbf24; border-radius: 1px;"></span>
                            Из функции
                        </span>
                    </div>
                    
                    <!-- Контейнер дерева -->
                    <div class="call-tree-container" style="font-family: monospace; font-size: 10px;">
                        ${this.renderCallTree(tree, false, 0)}
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Рекурсивный рендеринг узла дерева вызовов
   * @param {Object} tree - Узел дерева
   * @param {boolean} isIncoming - Входящий или исходящий вызов
   * @param {number} level - Уровень вложенности
   * @returns {string} HTML строка
   */
  renderCallTree(tree, isIncoming = false, level = 0) {
    if (!tree) return '';

    const arrow = isIncoming ? '←' : '→';
    const color = isIncoming ? '#3b82f6' : '#f59e0b';
    const bgColor = isIncoming ? 'rgba(59, 130, 246, 0.05)' : 'rgba(245, 158, 11, 0.05)';
    const borderColor = isIncoming ? '#1a3a6a' : '#3a3a1a';

    // Флаги и метки
    const isExported = tree.isExported || false;
    const isAsync = tree.isAsync || false;
    const isDeprecated = tree.isDeprecated || false;
    const isTested = tree.isTested || false;
    const isCurrent = tree.name === this.manager.currentFocusFunction;
    const hasChildren = tree.calls.length > 0 || tree.calledBy.length > 0;
    const isExpanded = this.isNodeExpanded(tree.name, level);

    // Стилизация
    const complexityColor =
      tree.complexity > 10 ? '#f87171' : tree.complexity > 5 ? '#fbbf24' : '#4ade80';
    const sourceIcon = tree.callSource === 'top-level' ? '📋' : '🔽';
    const sourceLabel = tree.callSource === 'top-level' ? 'top-level' : `из ${tree.callSource}`;
    const sourceColor = tree.callSource === 'top-level' ? '#4ade80' : '#fbbf24';

    // Безопасность
    const securityLevel = tree.securityLevel || 'low';
    const securityColor =
      securityLevel === 'high' ? '#f87171' : securityLevel === 'medium' ? '#fbbf24' : '#64748b';
    const securityIcon = securityLevel === 'high' ? '🔴' : securityLevel === 'medium' ? '🟡' : '';

    // Количество связей
    const totalRelations = tree.calls.length + tree.calledBy.length;

    // Отступ для вложенности
    const paddingLeft = level * 20;

    let html = `
            <div class="call-tree-item ${isCurrent ? 'current' : ''} ${isDeprecated ? 'deprecated' : ''}" 
                 style="padding-left: ${paddingLeft}px; 
                        margin: 1px 0; 
                        background: ${isCurrent ? 'rgba(34, 211, 238, 0.05)' : 'transparent'};
                        border-left: ${isCurrent ? '2px solid #22d3ee' : '2px solid transparent'};
                        border-radius: 0 4px 4px 0;"
                 data-function="${tree.name}" 
                 data-module="${this.manager.currentFocusModule}">
                
                <!-- Основной узел -->
                <div class="call-tree-node ${isIncoming ? 'incoming' : 'outgoing'} ${isCurrent ? 'current' : ''}" 
                     style="display: flex; 
                            align-items: center; 
                            flex-wrap: wrap; 
                            gap: 4px; 
                            padding: 3px 8px; 
                            margin: 1px 0; 
                            background: ${bgColor}; 
                            border: 1px solid ${borderColor}; 
                            border-left: 3px solid ${color}; 
                            border-radius: 4px; 
                            cursor: pointer; 
                            transition: all 0.2s;"
                     onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(tree.name)}', '${this.manager.escapeJs(this.manager.currentFocusModule)}')"
                     onmouseenter="this.style.background='${isIncoming ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'}';"
                     onmouseleave="this.style.background='${bgColor}';">
                    
                    <!-- Стрелка направления -->
                    <span class="call-tree-arrow" style="color: ${color}; font-size: 12px; font-weight: bold; width: 16px;">${arrow}</span>
                    
                    <!-- Имя функции -->
                    <span class="call-tree-name" style="font-size: 10px; font-weight: ${isCurrent ? '600' : '400'}; color: ${isCurrent ? '#22d3ee' : '#e2e8f0'};">
                        ${this.manager.escapeHtml(tree.name)}
                    </span>
                    
                    <!-- Метки -->
                    ${isExported ? '<span class="call-tree-icon" style="font-size: 8px;" title="Экспортирована">📤</span>' : ''}
                    ${isAsync ? '<span class="call-tree-async" style="font-size: 8px; color: #fbbf24;" title="Асинхронная">⚡</span>' : ''}
                    ${isDeprecated ? '<span class="call-tree-deprecated" style="font-size: 8px; color: #f87171;" title="Устаревшая">⚠️</span>' : ''}
                    ${isTested ? '<span class="call-tree-tested" style="font-size: 8px; color: #4ade80;" title="Покрыта тестами">🧪</span>' : ''}
                    ${isCurrent ? '<span class="call-tree-current-badge" style="font-size: 8px; color: #22d3ee;">🎯</span>' : ''}
                    
                    <!-- Источник вызова -->
                    <span class="call-tree-source" style="font-size: 8px; color: ${sourceColor}; background: rgba(0,0,0,0.3); padding: 0 6px; border-radius: 8px;" title="Источник вызова: ${sourceLabel}">
                        ${sourceIcon} ${sourceLabel}
                    </span>
                    
                    <!-- Сложность -->
                    ${
                      tree.complexity > 0
                        ? `
                        <span class="call-tree-complexity" style="color: ${complexityColor}; font-size: 8px; background: rgba(0,0,0,0.3); padding: 0 6px; border-radius: 8px;" title="Сложность: ${tree.complexity}">
                            🔄 ${tree.complexity}
                        </span>
                    `
                        : ''
                    }
                    
                    <!-- Размер -->
                    ${
                      tree.size > 0
                        ? `
                        <span class="call-tree-size" style="font-size: 8px; color: #64748b; background: rgba(0,0,0,0.3); padding: 0 6px; border-radius: 8px;" title="Размер: ${tree.size} строк">
                            📏 ${tree.size}
                        </span>
                    `
                        : ''
                    }
                    
                    <!-- Строка -->
                    <span class="call-tree-line" style="font-size: 8px; color: #64748b; background: rgba(0,0,0,0.3); padding: 0 6px; border-radius: 8px;">
                        стр.${tree.line}
                    </span>
                    
                    <!-- Количество связей -->
                    ${
                      totalRelations > 0
                        ? `
                        <span class="call-tree-count" style="font-size: 8px; color: #64748b; background: rgba(0,0,0,0.3); padding: 0 6px; border-radius: 8px;">
                            ${totalRelations} связей
                        </span>
                    `
                        : ''
                    }
                    
                    <!-- Безопасность -->
                    ${
                      securityLevel !== 'low'
                        ? `
                        <span class="call-tree-security security-${securityLevel}" style="font-size: 8px; color: ${securityColor}; background: rgba(0,0,0,0.3); padding: 0 6px; border-radius: 8px;" title="Уровень безопасности: ${securityLevel}">
                            🔒 ${securityLevel}
                        </span>
                    `
                        : ''
                    }
                    
                    <!-- Кнопка сворачивания -->
                    ${
                      hasChildren
                        ? `
                        <span class="call-tree-toggle" 
                              onclick="event.stopPropagation(); 
                                       const children = this.closest('.call-tree-item').querySelector('.call-tree-children'); 
                                       if (children) {
                                           children.classList.toggle('expanded'); 
                                           children.classList.toggle('collapsed');
                                           this.textContent = this.textContent === '▶' ? '▼' : '▶';
                                       }"
                              style="font-size: 8px; 
                                     color: #64748b; 
                                     cursor: pointer; 
                                     padding: 0 4px; 
                                     transition: transform 0.2s;
                                     background: rgba(0,0,0,0.3);
                                     border-radius: 4px;">
                            ${isExpanded ? '▼' : '▶'}
                        </span>
                    `
                        : ''
                    }
                </div>
                
                <!-- Описание -->
                ${
                  tree.description
                    ? `
                    <div class="call-tree-description" style="padding-left: ${paddingLeft + 30}px; font-size: 8px; color: #94a3b8; margin: 1px 0; border-left: 2px solid #1a2a4a; padding: 1px 8px;">
                        ${this.manager.escapeHtml(tree.description)}
                    </div>
                `
                    : ''
                }
                
                <!-- Теги -->
                ${
                  tree.tags && tree.tags.length > 0
                    ? `
                    <div class="call-tree-tags" style="padding-left: ${paddingLeft + 30}px; font-size: 7px; margin: 1px 0; display: flex; flex-wrap: wrap; gap: 2px;">
                        ${tree.tags
                          .map(
                            tag => `
                            <span class="tag" style="background: #1a2a4a; padding: 0 6px; border-radius: 8px; color: #60a5fa; font-size: 7px;">
                                #${this.manager.escapeHtml(tag)}
                            </span>
                        `
                          )
                          .join('')}
                    </div>
                `
                    : ''
                }
                
                <!-- Дочерние узлы -->
                ${
                  hasChildren
                    ? `
                    <div class="call-tree-children ${isExpanded ? 'expanded' : 'collapsed'}" 
                         style="${isExpanded ? '' : 'display: none;'} 
                                margin-left: 10px; 
                                border-left: 1px dashed #1a2a4a;
                                padding-left: 4px;">
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
   * Проверяет, развернут ли узел
   * @param {string} nodeName - Имя узла
   * @param {number} level - Уровень вложенности
   * @returns {boolean} true если развернут
   */
  isNodeExpanded(nodeName, level) {
    // Все узлы на глубине 0-1 развернуты по умолчанию
    if (level <= 1) return true;

    // Узлы на глубине 2 свернуты по умолчанию
    if (level === 2) return false;

    // Узлы глубже 2 всегда свернуты
    return false;
  }

  /**
   * Переключает состояние узла
   * @param {string} nodeName - Имя узла
   */
  toggleNode(nodeName) {
    if (this.expandedNodes.has(nodeName)) {
      this.expandedNodes.delete(nodeName);
    } else {
      this.expandedNodes.add(nodeName);
    }
  }

  /**
   * Рендеринг компактной версии дерева (без легенды)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCompact(data) {
    const { isActive, focusFunction, funcs, modulePath } = data;

    if (!isActive || !focusFunction) return '';

    const activeFunc = funcs.find(f => f.name === focusFunction);
    if (!activeFunc) return '';

    const tree = this.manager.buildCallTree(focusFunction, modulePath, funcs, 0, 2);

    if (!tree || (tree.calls.length === 0 && tree.calledBy.length === 0)) return '';

    return `
            <div class="call-tree-section compact" style="margin: 2px 0; border: 1px solid #1a2a4a; border-radius: 4px; overflow: hidden;">
                <div class="call-tree-header" 
                     onclick="this.nextElementSibling.classList.toggle('expanded')" 
                     style="display: flex; align-items: center; gap: 6px; padding: 2px 8px; background: #0f172a; cursor: pointer;">
                    <span style="font-size: 9px; color: #60a5fa;">🌳 ${this.manager.escapeHtml(focusFunction)}</span>
                    <span style="font-size: 8px; color: #64748b;">→ ${tree.calls.length} ← ${tree.calledBy.length}</span>
                    <span style="font-size: 8px; color: #64748b; margin-left: auto;">▶</span>
                </div>
                <div class="call-tree-body collapsed" style="display: none; padding: 2px 8px; max-height: 150px; overflow-y: auto;">
                    ${this.renderCallTree(tree, false, 0)}
                </div>
            </div>
        `;
  }

  /**
   * Рендеринг мини-дерева (только счетчики)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderMini(data) {
    const { isActive, focusFunction, funcs, modulePath } = data;

    if (!isActive || !focusFunction) return '';

    const activeFunc = funcs.find(f => f.name === focusFunction);
    if (!activeFunc) return '';

    const tree = this.manager.buildCallTree(focusFunction, modulePath, funcs, 0, 1);

    if (!tree) return '';

    return `
            <span class="call-tree-mini" style="font-size: 8px; color: #64748b;">
                → ${tree.calls.length} ← ${tree.calledBy.length}
            </span>
        `;
  }
}
