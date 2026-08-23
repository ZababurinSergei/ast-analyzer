// packages/ast-analyzer/src/reporters/templates/modules/CardManager/HeaderRenderer.js

/**
 * HeaderRenderer - рендеринг заголовка карточки модуля
 * Отвечает за отображение имени модуля, уровня, языка и статистики
 *
 * Особенности:
 * - Имя модуля как ссылка на VS Code (vscode://file/путь)
 * - Отображение уровня модуля (L0, L1, L2...)
 * - Компактные бейджи с информацией
 * - Поддержка активного состояния
 * - Копирование пути в буфер обмена
 * - Открытие в VS Code с поддержкой Windows/Linux/Mac
 */
export class HeaderRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Рендеринг заголовка
   * @param {Object} data - Данные для рендеринга
   * @param {boolean} data.isActive - Активен ли модуль
   * @param {boolean} data.isEntry - Является ли точкой входа
   * @param {string} data.displayName - Отображаемое имя
   * @param {string} data.levelClass - CSS класс уровня
   * @param {string} data.levelDisplay - Отображение уровня (🌌 L0, 📁 L1, 📁 L2)
   * @param {string} data.modulePath - Полный путь к модулю
   * @param {string} data.language - Язык модуля
   * @param {number} data.lines - Количество строк
   * @param {Array} data.allExports - Список экспортов
   * @param {number} data.totalFuncs - Общее количество функций
   * @param {number} data.totalClasses - Общее количество классов
   * @param {number} data.totalConstants - Общее количество констант
   * @param {number} data.totalInterfaces - Общее количество интерфейсов
   * @param {number} data.totalTypes - Общее количество типов
   * @param {number} data.totalVariables - Общее количество переменных
   * @param {number} data.externalOutgoing - Количество внешних исходящих вызовов
   * @param {number} data.externalIncoming - Количество внешних входящих вызовов
   * @param {number} data.totalInternal - Количество внутренних вызовов
   * @param {Set} data.moduleImporters - Множество импортеров модуля
   * @param {Set} data.moduleImports - Множество импортов модуля
   * @param {Object} data.sourceInfo - Информация об источнике навигации
   * @returns {string} HTML строка
   */
  render(data) {
    const {
      isActive,
      isEntry,
      displayName,
      levelClass,
      levelDisplay,
      modulePath,
      language,
      lines,
      allExports,
      totalFuncs,
      totalClasses,
      totalConstants,
      totalInterfaces,
      totalTypes,
      totalVariables,
      externalOutgoing,
      externalIncoming,
      totalInternal,
      moduleImporters,
      moduleImports,
      sourceInfo,
    } = data;

    // Формируем ссылку на VS Code
    const vscodeUrl = this.buildVscodeUrl(modulePath);

    // Отображаемое имя (без пути)
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    // Определяем иконку для языка
    const languageIcon = this.getLanguageIcon(language);

    // Определяем иконку для типа модуля
    const moduleIcon = this.getModuleIcon(modulePath);

    // Формируем информацию об источнике навигации
    let sourceInfoHtml = '';
    if (sourceInfo && sourceInfo.module) {
      const sourceDisplay = sourceInfo.function
        ? `${sourceInfo.function} (${sourceInfo.module.split('/').pop()})`
        : sourceInfo.module.split('/').pop();
      sourceInfoHtml = `
                <span style="font-size: 8px; color: #22d3ee; background: rgba(34, 211, 238, 0.1); padding: 0 6px; border-radius: 8px; border: 1px solid rgba(34, 211, 238, 0.2); margin-left: 6px;">
                    ← ${this.manager.escapeHtml(sourceDisplay)}
                </span>
            `;
    }

    return `
            <div class="header-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; padding: 6px 0 4px 0; border-bottom: 1px solid #1a1a3a; margin-bottom: 2px;">
                <div style="flex: 1; min-width: 0;">
                    <div class="name ${levelClass}" style="font-size: 13px; font-weight: 600; color: #60a5fa; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                        ${isActive ? '<span style="font-size: 10px; color: #22d3ee;">▶</span>' : ''}
                        ${isEntry ? '<span style="font-size: 12px;">⭐</span>' : ''}
                        
                        <!-- Иконка модуля -->
                        <span style="font-size: 11px;">${moduleIcon}</span>
                        
                        <!-- Ссылка на VS Code -->
                        <a href="${vscodeUrl}" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           style="color: #60a5fa; 
                                  text-decoration: none; 
                                  transition: all 0.2s ease;
                                  cursor: pointer;
                                  border-bottom: 1px solid transparent;
                                  font-weight: 600;
                                  word-break: break-word;"
                           onmouseenter="this.style.color='#93c5fd'; this.style.borderBottomColor='#60a5fa';"
                           onmouseleave="this.style.color='#60a5fa'; this.style.borderBottomColor='transparent';"
                           title="Открыть в VS Code: ${this.manager.escapeHtml(modulePath)}">
                            ${this.manager.escapeHtml(shortName)}
                        </a>
                        
                        <span class="level-badge" style="font-size: 9px; background: #0f172a; padding: 1px 6px; border-radius: 8px; color: #60a5fa; border: 1px solid #1a2a4a; margin-left: 2px; white-space: nowrap;">${levelDisplay}</span>
                        
                        ${sourceInfoHtml}
                    </div>
                    
                    <div class="path" style="font-size: 8px; color: #64748b; font-family: monospace; word-break: break-all; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="opacity: 0.7;">${this.manager.escapeHtml(modulePath)}</span>
                        
                        <!-- Кнопка копирования пути -->
                        <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${this.manager.escapeJs(modulePath)}'); this.textContent = '✅'; setTimeout(() => this.textContent = '📋', 1000);" 
                                style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 9px; padding: 0 4px; transition: all 0.2s; border-radius: 4px;"
                                onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(96,165,250,0.1)';"
                                onmouseleave="this.style.color='#64748b'; this.style.background='transparent';"
                                title="Копировать путь">
                            📋
                        </button>
                        
                        <!-- Кнопка открытия в VS Code (компактная) -->
                        <button onclick="event.stopPropagation(); window.open('${vscodeUrl}', '_blank');" 
                                style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 9px; padding: 0 4px; transition: all 0.2s; border-radius: 4px;"
                                onmouseenter="this.style.color='#22d3ee'; this.style.background='rgba(34,211,238,0.1)';"
                                onmouseleave="this.style.color='#64748b'; this.style.background='transparent';"
                                title="Открыть в VS Code">
                            💻
                        </button>
                    </div>
                </div>
                
                <!-- Бейджи -->
                <div style="display:flex; gap:3px; flex-wrap:wrap; justify-content:flex-end; flex-shrink: 0; max-width: 60%;">
                    <span class="badge lang" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #334155; color: #94a3b8; white-space: nowrap;">${languageIcon} ${this.manager.escapeHtml(language)}</span>
                    
                    ${isEntry ? '<span class="badge export" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #fbbf24; color: #0f172a; white-space: nowrap;">⭐ entry</span>' : ''}
                    
                    <span class="badge lines" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #1e293b; color: #64748b; border: 1px solid #334155; white-space: nowrap;">📝 ${lines}</span>
                    
                    <span class="badge level ${levelClass}" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; white-space: nowrap;">${levelDisplay}</span>
                    
                    ${isActive ? '<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#22d3ee;color:#0f172a; white-space: nowrap;">🎯 активен</span>' : ''}
                    
                    ${allExports.length > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#f87171; white-space: nowrap;">📤 ${allExports.length}</span>` : ''}
                    
                    ${totalFuncs > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#4ade80; white-space: nowrap;">ƒ ${totalFuncs}</span>` : ''}
                    
                    ${totalClasses > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#4ade80; white-space: nowrap;">📦 ${totalClasses}</span>` : ''}
                    
                    ${totalConstants > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#f472b6; white-space: nowrap;">📌 ${totalConstants}</span>` : ''}
                    
                    ${totalInterfaces > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#a78bfa; white-space: nowrap;">📋 ${totalInterfaces}</span>` : ''}
                    
                    ${totalTypes > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#22d3ee; white-space: nowrap;">📝 ${totalTypes}</span>` : ''}
                    
                    ${totalVariables > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#f87171; white-space: nowrap;">📄 ${totalVariables}</span>` : ''}
                    
                    ${externalOutgoing && externalOutgoing.size > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#f59e0b; white-space: nowrap;">📤 ${externalOutgoing.size}</span>` : ''}
                    
                    ${externalIncoming && externalIncoming.size > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#3b82f6; white-space: nowrap;">📥 ${externalIncoming.size}</span>` : ''}
                    
                    ${totalInternal > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#64748b; white-space: nowrap;">🔄 ${totalInternal}</span>` : ''}
                    
                    ${moduleImporters && moduleImporters.size > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#22d3ee; white-space: nowrap;">📥 ${moduleImporters.size}</span>` : ''}
                    
                    ${moduleImports && moduleImports.size > 0 ? `<span class="badge" style="font-size: 7px; padding: 1px 4px; border-radius: 6px; background:#f59e0b; white-space: nowrap;">📤 ${moduleImports.size}</span>` : ''}
                </div>
            </div>
        `;
  }

  /**
   * Строит URL для открытия файла в VS Code
   * @param {string} filePath - Путь к файлу
   * @returns {string} URL для VS Code
   */
  buildVscodeUrl(filePath) {
    if (!filePath) return '#';
    const basePath = '/home/sergei/Desktop/system/packages/ast-analyzer';
    if (filePath.endsWith('/')) {
      filePath = basePath + filePath;
    } else {
      filePath = basePath +'/'+ filePath;
    }

    // Получаем абсолютный путь
    let absolutePath = filePath;
    if (!filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:/)) {
      // Если путь относительный, добавляем текущую директорию
      try {
        absolutePath = process.cwd() + '/' + filePath;
      } catch (e) {
        absolutePath = filePath;
      }
    }

    // Формируем URL для VS Code
    let encodedPath = absolutePath;

    // Заменяем обратные слеши на прямые для Windows
    encodedPath = encodedPath.replace(/\\/g, '/');

    // Для Windows добавляем префикс file:///
    if (encodedPath.match(/^[A-Za-z]:/)) {
      return `vscode://file/${encodedPath}`;
    } else if (encodedPath.startsWith('/')) {
      return `vscode://file${encodedPath}`;
    } else {
      return `vscode://file/${encodedPath}`;
    }
  }

  /**
   * Строит URL для открытия файла в VS Code с указанием строки
   * @param {string} filePath - Путь к файлу
   * @param {number} line - Номер строки
   * @param {number} column - Номер колонки (опционально)
   * @returns {string} URL для VS Code
   */
  buildVscodeUrlWithLine(filePath, line, column = 0) {
    const baseUrl = this.buildVscodeUrl(filePath);
    if (line && line > 0) {
      if (column && column > 0) {
        return `${baseUrl}:${line}:${column}`;
      }
      return `${baseUrl}:${line}`;
    }
    return baseUrl;
  }

  /**
   * Возвращает иконку для языка
   * @param {string} language - Название языка
   * @returns {string} Иконка
   */
  getLanguageIcon(language) {
    if (!language) return '📄';
    const lang = language.toLowerCase();
    if (lang === 'typescript' || lang === 'ts') return '📘';
    if (lang === 'javascript' || lang === 'js') return '📄';
    if (lang === 'vue') return '🎯';
    if (lang === 'jsx' || lang === 'tsx') return '⚛️';
    if (lang === 'json') return '📋';
    if (lang === 'css' || lang === 'scss') return '🎨';
    if (lang === 'html') return '🌐';
    if (lang === 'python' || lang === 'py') return '🐍';
    if (lang === 'rust') return '🦀';
    if (lang === 'go') return '🐹';
    if (lang === 'ruby') return '💎';
    if (lang === 'php') return '🐘';
    if (lang === 'java') return '☕';
    if (lang === 'csharp' || lang === 'c#') return '🔷';
    if (lang === 'cpp' || lang === 'c++') return '🔶';
    return '📄';
  }

  /**
   * Возвращает иконку для типа модуля
   * @param {string} modulePath - Путь к модулю
   * @returns {string} Иконка
   */
  getModuleIcon(modulePath) {
    if (!modulePath) return '📁';
    if (modulePath.endsWith('.vue')) return '🎯';
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) return '⚛️';
    if (modulePath.endsWith('.ts')) return '📘';
    if (modulePath.endsWith('.js')) return '📄';
    if (modulePath.endsWith('.json')) return '📋';
    if (modulePath.endsWith('.css') || modulePath.endsWith('.scss')) return '🎨';
    if (modulePath.endsWith('.html') || modulePath.endsWith('.htm')) return '🌐';
    if (modulePath.endsWith('.md')) return '📝';
    return '📁';
  }

  /**
   * Рендеринг компактной версии заголовка
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCompact(data) {
    const { isActive, isEntry, displayName, levelDisplay, modulePath, language } = data;

    const vscodeUrl = this.buildVscodeUrl(modulePath);
    const shortName = displayName || modulePath.split('/').pop() || modulePath;
    const languageIcon = this.getLanguageIcon(language);

    return `
            <div class="header-row compact" style="display: flex; justify-content: space-between; align-items: center; gap: 4px; padding: 2px 0; border-bottom: none;">
                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                    ${isActive ? '<span style="font-size: 8px; color: #22d3ee;">▶</span>' : ''}
                    ${isEntry ? '<span style="font-size: 9px;">⭐</span>' : ''}
                    
                    <a href="${vscodeUrl}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style="color: #60a5fa; 
                              text-decoration: none; 
                              font-size: 10px;
                              font-weight: 500;
                              cursor: pointer;
                              transition: all 0.2s;"
                       onmouseenter="this.style.color='#93c5fd';"
                       onmouseleave="this.style.color='#60a5fa';"
                       title="Открыть в VS Code: ${this.manager.escapeHtml(modulePath)}">
                        ${this.manager.escapeHtml(shortName)}
                    </a>
                    
                    <span style="font-size: 7px; color: #64748b; background: #0f172a; padding: 0 4px; border-radius: 4px; border: 1px solid #1a1a3a;">${levelDisplay}</span>
                    
                    <span style="font-size: 7px; color: #64748b; background: #334155; padding: 0 4px; border-radius: 4px;">${languageIcon} ${this.manager.escapeHtml(language)}</span>
                </div>
                
                <!-- Кнопка копирования пути в компактном режиме -->
                <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${this.manager.escapeJs(modulePath)}'); this.textContent = '✅'; setTimeout(() => this.textContent = '📋', 1000);" 
                        style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 8px; padding: 0 3px; transition: all 0.2s; border-radius: 3px;"
                        onmouseenter="this.style.color='#60a5fa';"
                        onmouseleave="this.style.color='#64748b';"
                        title="Копировать путь">
                    📋
                </button>
            </div>
        `;
  }

  /**
   * Рендеринг только имени с ссылкой
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderNameOnly(data) {
    const { displayName, modulePath, isEntry } = data;
    const vscodeUrl = this.buildVscodeUrl(modulePath);
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    return `
            <div style="display: flex; align-items: center; gap: 4px;">
                ${isEntry ? '<span style="font-size: 10px;">⭐</span>' : ''}
                <a href="${vscodeUrl}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   style="color: #60a5fa; 
                          text-decoration: none; 
                          font-size: 12px;
                          font-weight: 600;
                          cursor: pointer;
                          transition: all 0.2s;
                          font-family: monospace;"
                   onmouseenter="this.style.color='#93c5fd'; this.style.textDecoration='underline';"
                   onmouseleave="this.style.color='#60a5fa'; this.style.textDecoration='none';"
                   title="Открыть в VS Code: ${this.manager.escapeHtml(modulePath)}">
                    ${this.manager.escapeHtml(shortName)}
                </a>
            </div>
        `;
  }

  /**
   * Рендеринг ссылки на VS Code для определенной строки
   * @param {Object} data - Данные для рендеринга
   * @param {string} data.modulePath - Путь к модулю
   * @param {number} data.line - Номер строки
   * @param {string} data.label - Текст ссылки
   * @returns {string} HTML строка
   */
  renderLineLink(data) {
    const { modulePath, line, label } = data;
    const vscodeUrl = this.buildVscodeUrlWithLine(modulePath, line);
    const displayLabel = label || `${modulePath.split('/').pop()}:${line}`;

    return `
            <a href="${vscodeUrl}" 
               target="_blank" 
               rel="noopener noreferrer"
               style="color: #60a5fa; 
                      text-decoration: none; 
                      font-size: 10px;
                      cursor: pointer;
                      transition: all 0.2s;
                      font-family: monospace;
                      border-bottom: 1px dashed #334155;"
               onmouseenter="this.style.color='#93c5fd'; this.style.borderBottomColor='#60a5fa';"
               onmouseleave="this.style.color='#60a5fa'; this.style.borderBottomColor='#334155';"
               title="Открыть в VS Code на строке ${line}">
                ${this.manager.escapeHtml(displayLabel)}
            </a>
        `;
  }

  /**
   * Создает кнопку для копирования пути
   * @param {string} path - Путь для копирования
   * @param {string} size - Размер кнопки ('small', 'normal')
   * @returns {string} HTML строка
   */
  renderCopyButton(path, size = 'normal') {
    const fontSize = size === 'small' ? '8px' : '10px';
    const padding = size === 'small' ? '0 3px' : '0 4px';

    return `
            <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${this.manager.escapeJs(path)}'); this.textContent = '✅'; setTimeout(() => this.textContent = '📋', 1000);" 
                    style="background: none; border: none; color: #64748b; cursor: pointer; font-size: ${fontSize}; padding: ${padding}; transition: all 0.2s; border-radius: 4px;"
                    onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(96,165,250,0.1)';"
                    onmouseleave="this.style.color='#64748b'; this.style.background='transparent';"
                    title="Копировать путь">
                📋
            </button>
        `;
  }
}
