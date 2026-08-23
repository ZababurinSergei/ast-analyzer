// packages/ast-analyzer/src/reporters/templates/modules/CardManager/NavModuleImportersRenderer.js

/**
 * NavModuleImportersRenderer - рендеринг секции "Модули-импортеры"
 * Отображает модули, которые импортируют текущий модуль
 *
 * Особенности:
 * - Отображение модулей, которые используют текущий модуль
 * - Клик по модулю → переход к модулю
 * - Компактный стиль с маленькими кнопками
 * - Ссылка на VS Code для каждого модуля
 * - Отображение уровня модуля (L0, L1, L2...)
 * - Индикатор "еще" при большом количестве
 * - Разворачивание списка по клику
 */
export class NavModuleImportersRenderer {
  constructor(manager) {
    this.manager = manager;

    // Базовый путь к проекту
    this.basePath = '/home/sergei/Desktop/system/packages/ast-analyzer/';

    console.log('📁 NavModuleImportersRenderer basePath:', this.basePath);
  }

  /**
   * Рендеринг секции модулей-импортеров
   * @param {Object} data - Данные для рендеринга
   * @param {Set<string>} data.moduleImporters - Множество путей модулей, которые импортируют текущий
   * @param {string} data.modulePath - Путь к текущему модулю
   * @param {Object} data.pkg - Объект пакета (для построения путей)
   * @param {Object} data.reportData - Данные отчета (опционально)
   * @returns {string} HTML строка
   */
  render(data) {
    const { moduleImporters, modulePath, pkg, reportData } = data;

    // Если нет импортеров - показываем сообщение
    if (!moduleImporters || moduleImporters.size === 0) {
      return `
                <div class="nav-section nav-module-importers" style="padding: 4px 8px; margin: 2px 0; opacity: 0.5; border-top: 1px solid #1a1a3a;">
                    <span class="nav-label" style="font-size: 9px; color: #64748b;">
                        📥 Нет модулей, которые импортируют этот файл
                    </span>
                </div>
            `;
    }

    const sortedImporters = Array.from(moduleImporters).sort();
    const totalCount = moduleImporters.size;
    const maxDisplay = 10;
    const hasMore = totalCount > maxDisplay;
    const displayItems = sortedImporters.slice(0, maxDisplay);

    let html = `
            <div class="nav-section nav-module-importers" style="padding: 4px 8px; margin: 2px 0; border-top: 1px solid #1a2a4a; background: rgba(59, 130, 246, 0.02); border-radius: 4px;">
                <span class="nav-label" style="font-size: 10px; color: #3b82f6; display: flex; align-items: center; gap: 6px;">
                    <span>📥 Импортируют этот модуль (${totalCount}):</span>
                    <span style="font-size: 8px; color: #64748b; font-weight: normal;">
                        (клик → переход к модулю)
                    </span>
                </span>
                <div class="nav-buttons" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; max-height: 100px; overflow: hidden; transition: max-height 0.3s ease;">
        `;

    for (const importer of displayItems) {
      // Получаем имя файла для отображения
      const importerDisplay = importer.split('/').pop() || '?';

      // Строим полный путь для VS Code
      const fullPath = this.buildFullPath(importer, reportData);
      const vscodeUrl = this.buildVscodeUrl(fullPath);

      // Определяем уровень модуля для подсветки
      const level = this.manager.getModuleLevel(importer);
      const levelColor =
        level === 0 ? '#fbbf24' : level === 1 ? '#60a5fa' : level === 2 ? '#4ade80' : '#94a3b8';
      const levelBg =
        level === 0
          ? 'rgba(251, 191, 36, 0.1)'
          : level === 1
            ? 'rgba(96, 165, 250, 0.1)'
            : 'rgba(148, 163, 184, 0.05)';

      // Иконка в зависимости от типа файла
      const icon = this.getModuleIcon(importer);

      // Проверяем, является ли импортер точкой входа
      const isEntry = this.isEntryModule(importer, reportData);
      const entryBadge = isEntry ? '⭐' : '';

      html += `
                <div style="display: inline-flex; align-items: center; gap: 2px; background: ${levelBg}; border: 1px solid ${levelColor}33; border-radius: 8px; padding: 1px 4px; transition: all 0.2s;"
                     onmouseenter="this.style.borderColor='${levelColor}'; this.style.background='${levelColor}22'; this.style.transform='scale(1.02)';"
                     onmouseleave="this.style.borderColor='${levelColor}33'; this.style.background='${levelBg}'; this.style.transform='scale(1)';">
                    
                    <!-- Ссылка на VS Code (иконка) -->
                    <a href="${vscodeUrl}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style="color: ${levelColor}; 
                              text-decoration: none; 
                              font-size: 8px;
                              cursor: pointer;
                              padding: 1px 3px;
                              border-radius: 3px;
                              transition: all 0.2s;"
                       onmouseenter="this.style.background='${levelColor}33';"
                       onmouseleave="this.style.background='transparent';"
                       title="Открыть в VS Code: ${this.manager.escapeHtml(fullPath)}">
                        💻
                    </a>
                    
                    <!-- Кнопка перехода к модулю -->
                    <button class="nav-btn module-importer" 
                            onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusModule('${this.manager.escapeJs(importer)}')" 
                            style="font-size: 9px; 
                                   padding: 1px 4px; 
                                   border-radius: 4px; 
                                   background: transparent; 
                                   border: none; 
                                   color: ${levelColor}; 
                                   cursor: pointer;
                                   transition: all 0.2s;
                                   white-space: nowrap;
                                   font-family: inherit;
                                   display: inline-flex;
                                   align-items: center;
                                   gap: 2px;"
                            onmouseenter="this.style.color='#93c5fd'; this.style.textShadow='0 0 20px ${levelColor}44';"
                            onmouseleave="this.style.color='${levelColor}'; this.style.textShadow='none';"
                            title="Перейти к модулю ${this.manager.escapeHtml(importer)} (уровень ${level})">
                        ${icon} ${this.manager.escapeHtml(importerDisplay)}
                        ${entryBadge ? `<span style="font-size: 8px;">${entryBadge}</span>` : ''}
                        ${level > 0 ? `<span style="font-size: 7px; color: #64748b; margin-left: 1px; background: #0f172a; padding: 0 4px; border-radius: 4px;">L${level}</span>` : ''}
                    </button>
                </div>
            `;
    }

    if (hasMore) {
      const remaining = totalCount - maxDisplay;
      html += `
                <span class="nav-more" style="font-size: 9px; color: #64748b; padding: 1px 8px; background: #0f172a; border-radius: 8px; border: 1px solid #1a1a3a; display: inline-flex; align-items: center;">
                    +${remaining}
                </span>
            `;
    }

    // Добавляем кнопку "Показать все"
    if (hasMore) {
      html += `
                <button class="nav-btn show-all" 
                        onclick="event.stopPropagation(); 
                                 const container = this.closest('.nav-module-importers').querySelector('.nav-buttons');
                                 const isExpanded = container.classList.toggle('expanded');
                                 this.textContent = isExpanded ? '▲ Свернуть' : '▼ Показать все';
                                 if (isExpanded) {
                                     container.style.maxHeight = 'none';
                                     container.style.overflow = 'visible';
                                 } else {
                                     container.style.maxHeight = '100px';
                                     container.style.overflow = 'hidden';
                                 }"
                        style="font-size: 8px; 
                               padding: 1px 8px; 
                               border-radius: 8px; 
                               background: transparent; 
                               border: 1px solid #334155; 
                               color: #64748b; 
                               cursor: pointer;
                               transition: all 0.2s;
                               display: inline-flex;
                               align-items: center;"
                        onmouseenter="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6'; this.style.background='rgba(59,130,246,0.1)';"
                        onmouseleave="this.style.borderColor='#334155'; this.style.color='#64748b'; this.style.background='transparent';">
                    ▼ Показать все
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
   * Строит полный путь к файлу на диске
   * @param {string} modulePath - Путь к модулю из отчета
   * @param {Object} reportData - Данные отчета
   * @returns {string} Полный путь
   */
  buildFullPath(modulePath, reportData) {
    try {
      // Пытаемся найти пакет в отчете
      let pkg = null;
      if (reportData?.packages) {
        pkg = reportData.packages[modulePath];
      }

      let relativePath = modulePath;

      // Если есть displayPath, используем его
      if (pkg?.displayPath) {
        const parts = pkg.displayPath.split('/');
        const srcIndex = parts.indexOf('src');
        const packagesIndex = parts.indexOf('packages');

        if (srcIndex !== -1) {
          // Берем путь от "src" включительно
          relativePath = parts.slice(srcIndex).join('/');
        } else if (packagesIndex !== -1) {
          // Берем путь от "packages" включительно
          relativePath = parts.slice(packagesIndex).join('/');
        } else {
          // Используем displayPath как есть
          relativePath = pkg.displayPath;
        }
      }

      // Если есть resolved с file: префиксом
      if (pkg?.resolved && pkg.resolved.startsWith('file:')) {
        const resolvedPath = pkg.resolved.replace(/^file:/, '');
        if (resolvedPath.includes('src/')) {
          const srcParts = resolvedPath.split('src/');
          if (srcParts.length > 1) {
            relativePath = 'src/' + srcParts[srcParts.length - 1];
          }
        } else {
          relativePath = resolvedPath;
        }
      }

      // Проверяем, не является ли путь уже абсолютным
      if (relativePath.startsWith('/')) {
        return relativePath;
      }
      if (relativePath.match(/^[A-Za-z]:/)) {
        return relativePath;
      }

      // Строим полный путь
      const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      const fullPath = this.basePath + cleanPath;

      return fullPath;
    } catch (error) {
      console.warn('⚠️ Ошибка построения полного пути для импортера:', error);
      return modulePath;
    }
  }

  /**
   * Строит URL для VS Code
   * @param {string} fullPath - Полный путь к файлу
   * @returns {string} URL для VS Code
   */
  buildVscodeUrl(fullPath) {
    if (!fullPath || fullPath === '#') return '#';

    try {
      let encodedPath = fullPath.replace(/\\/g, '/');

      // Для Windows добавляем префикс / перед диском
      if (encodedPath.match(/^[A-Za-z]:/)) {
        encodedPath = '/' + encodedPath;
      }

      return `vscode://file${encodedPath}`;
    } catch (error) {
      console.warn('⚠️ Ошибка создания ссылки VS Code для импортера:', error);
      return '#';
    }
  }

  /**
   * Проверяет, является ли модуль точкой входа
   * @param {string} modulePath - Путь к модулю
   * @param {Object} reportData - Данные отчета
   * @returns {boolean} true если модуль является точкой входа
   */
  isEntryModule(modulePath, reportData) {
    if (!reportData?.packages) return false;
    const pkg = reportData.packages[modulePath];
    return pkg?.isEntry === true;
  }

  /**
   * Возвращает иконку для модуля
   * @param {string} modulePath - Путь к модулю
   * @returns {string} Иконка
   */
  getModuleIcon(modulePath) {
    if (!modulePath) return '📄';
    if (modulePath.endsWith('.vue')) return '🎯';
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) return '⚛️';
    if (modulePath.endsWith('.ts')) return '📘';
    if (modulePath.endsWith('.js')) return '📄';
    if (modulePath.endsWith('.json')) return '📋';
    if (modulePath.endsWith('.css')) return '🎨';
    if (modulePath.endsWith('.html')) return '🌐';
    return '📁';
  }

  /**
   * Рендеринг компактной версии (для свернутого состояния)
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
            <div class="nav-section nav-module-importers compact" style="padding: 2px 8px; margin: 1px 0; border-top: 1px solid #1a1a3a;">
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

  /**
   * Получает количество импортеров
   * @param {Object} data - Данные
   * @returns {number} Количество импортеров
   */
  getImportersCount(data) {
    if (!data.moduleImporters) return 0;
    return data.moduleImporters.size;
  }

  /**
   * Устанавливает базовый путь
   * @param {string} path - Новый базовый путь
   */
  setBasePath(path) {
    this.basePath = path;
    console.log('📁 NavModuleImportersRenderer basePath updated:', this.basePath);
  }
}
