// packages/ast-analyzer/src/reporters/templates/modules/CardManager/NavModuleImportersRenderer.js

/**
 * NavModuleImportersRenderer - рендеринг секции "Модули-импортеры"
 * Отображает модули, которые импортируют текущий модуль
 *
 * Особенности:
 * - Отображение модулей, которые используют текущий модуль
 * - Клик по модулю → переход к модулю
 * - Компактный стиль с маленькими кнопками
 * - Ограничение на 10 элементов с индикатором "еще"
 */
export class NavModuleImportersRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Рендеринг секции модулей-импортеров
   * @param {Object} data - Данные для рендеринга
   * @param {Set<string>} data.moduleImporters - Множество путей модулей, которые импортируют текущий
   * @param {string} data.modulePath - Путь к текущему модулю
   * @param {Object} data.reportData - Данные отчета (опционально)
   * @returns {string} HTML строка
   */
  render(data) {
    const { moduleImporters, modulePath, reportData } = data;

    // Если нет импортеров - ничего не показываем
    if (!moduleImporters || moduleImporters.size === 0) {
      return '';
    }

    const sortedImporters = Array.from(moduleImporters).sort();
    const totalCount = moduleImporters.size;
    const maxDisplay = 10;
    const hasMore = totalCount > maxDisplay;
    const displayItems = sortedImporters.slice(0, maxDisplay);

    let html = `
            <div class="nav-section nav-module-importers" style="padding: 4px 8px; margin: 2px 0;">
                <span class="nav-label" style="font-size: 10px; color: #3b82f6;">
                    📥 Импортируют этот модуль (${totalCount}):
                </span>
                <div class="nav-buttons" style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px;">
        `;

    for (const importer of displayItems) {
      const importerDisplay = importer.split('/').pop() || '?';
      const onclickNav = `event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusModule('${this.manager.escapeJs(importer)}')`;

      // Определяем уровень модуля для подсветки
      const level = this.manager.getModuleLevel(importer);
      const levelColor = level === 0 ? '#fbbf24' : level === 1 ? '#60a5fa' : '#94a3b8';

      html += `
                <button class="nav-btn module-importer" 
                        onclick="${onclickNav}" 
                        style="font-size: 9px; 
                               padding: 1px 8px; 
                               border-radius: 8px; 
                               background: #0f172a; 
                               border: 1px solid #1a2a4a; 
                               color: ${levelColor}; 
                               cursor: pointer;
                               transition: all 0.2s;
                               white-space: nowrap;"
                        title="Перейти к модулю ${this.manager.escapeHtml(importer)} (уровень ${level})">
                    📁 ${this.manager.escapeHtml(importerDisplay)}
                    ${level > 0 ? `<span style="font-size: 7px; color: #64748b; margin-left: 2px;">L${level}</span>` : ''}
                </button>
            `;
    }

    if (hasMore) {
      const remaining = totalCount - maxDisplay;
      html += `
                <span class="nav-more" style="font-size: 9px; color: #64748b; padding: 1px 6px;">
                    +${remaining}
                </span>
            `;
    }

    // Добавляем кнопку "Показать все" если много элементов
    if (hasMore) {
      html += `
                <button class="nav-btn show-all" 
                        onclick="event.stopPropagation(); this.closest('.nav-module-importers').querySelector('.nav-buttons').classList.toggle('expanded'); this.textContent = this.textContent === 'Показать все' ? 'Свернуть' : 'Показать все';"
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
   * Рендеринг иконки для модуля
   * @param {string} modulePath - Путь к модулю
   * @returns {string} Иконка
   */
  getModuleIcon(modulePath) {
    if (!modulePath) return '📁';
    if (modulePath.endsWith('.vue')) return '🎯';
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) return '⚛️';
    if (modulePath.endsWith('.ts')) return '📘';
    if (modulePath.endsWith('.js')) return '📄';
    return '📁';
  }

  /**
   * Рендеринг компактной версии секции (для свернутого состояния)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCompact(data) {
    const { moduleImporters } = data;

    if (!moduleImporters || moduleImporters.size === 0) {
      return '';
    }

    const totalCount = moduleImporters.size;
    const firstThree = Array.from(moduleImporters)
      .slice(0, 3)
      .map(p => p.split('/').pop() || '?');

    return `
            <div class="nav-section nav-module-importers compact" style="padding: 2px 8px; margin: 1px 0;">
                <span class="nav-label" style="font-size: 9px; color: #3b82f6;">
                    📥 ${totalCount} импортеров:
                </span>
                <span style="font-size: 8px; color: #64748b;">
                    ${firstThree.join(', ')}${totalCount > 3 ? ` +${totalCount - 3}` : ''}
                </span>
            </div>
        `;
  }

  /**
   * Рендеринг только количества импортеров (для бейджей)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCount(data) {
    const { moduleImporters } = data;

    if (!moduleImporters || moduleImporters.size === 0) {
      return '';
    }

    return `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #1a2a4a; color: #3b82f6; border: 1px solid #1a2a4a;">📥 ${moduleImporters.size}</span>`;
  }

  /**
   * Проверяет, есть ли импортеры у модуля
   * @param {Object} data - Данные для проверки
   * @returns {boolean} true если есть импортеры
   */
  hasImporters(data) {
    return data.moduleImporters && data.moduleImporters.size > 0;
  }

  /**
   * Получает список импортеров в виде массива
   * @param {Object} data - Данные
   * @returns {Array<string>} Массив путей модулей-импортеров
   */
  getImportersList(data) {
    if (!data.moduleImporters) return [];
    return Array.from(data.moduleImporters).sort();
  }
}
