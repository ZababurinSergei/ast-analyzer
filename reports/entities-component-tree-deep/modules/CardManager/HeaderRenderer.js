// packages/ast-analyzer/src/reporters/templates/modules/CardManager/HeaderRenderer.js

/**
 * HeaderRenderer - рендеринг заголовка карточки модуля
 * Отвечает за отображение имени модуля, уровня, языка и статистики
 *
 * Особенности:
 * - Имя модуля - кликабельно для активации карточки (как раньше)
 * - Отдельная кнопка VS Code для открытия файла
 * - Отображение уровня модуля (L0, L1, L2...)
 * - Компактные бейджи с информацией
 * - Поддержка активного состояния
 * - Копирование полного пути в буфер обмена
 */
export class HeaderRenderer {
  constructor(manager) {
    this.manager = manager;

    // Базовый путь к проекту (для браузера)
    this.basePath = '/home/sergei/Desktop/system/packages/ast-analyzer/infoenergo-ui/';

    console.log('📁 Base path:', this.basePath);
  }

  /**
   * Рендеринг заголовка
   * @param {Object} data - Данные для рендеринга
   * @param {boolean} data.isActive - Активен ли модуль
   * @param {boolean} data.isEntry - Является ли точкой входа
   * @param {string} data.displayName - Отображаемое имя
   * @param {string} data.levelClass - CSS класс уровня
   * @param {string} data.levelDisplay - Отображение уровня (🌌 L0, 📁 L1, 📁 L2)
   * @param {string} data.modulePath - Ключ модуля из отчета (например "src/cli.ts")
   * @param {Object} data.pkg - Объект пакета с displayPath и resolved
   * @param {string} data.language - Язык модуля
   * @param {number} data.lines - Количество строк
   * @param {Array} data.allExports - Список экспортов
   * @param {number} data.totalFuncs - Общее количество функций
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
      pkg,
      language,
      lines,
      allExports,
      totalFuncs
    } = data;

    // Строим полный путь на диске для VS Code
    const fullPath = this.buildFullPath(modulePath, pkg);
    const vscodeUrl = this.buildVscodeUrl(fullPath);

    // Отображаемое имя (без пути)
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    return `
            <div class="header-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; padding: 6px 0 4px 0; border-bottom: 1px solid #1a1a3a; margin-bottom: 2px;">
                <div style="flex: 1; min-width: 0;">
                    <div class="name ${levelClass}" style="font-size: 13px; font-weight: 600; color: #60a5fa; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                        ${isActive ? '<span style="font-size: 10px; color: #22d3ee;">▶</span>' : ''}
                        ${isEntry ? '<span style="font-size: 11px;">⭐</span>' : ''}
                        
                        <!-- Иконка модуля -->
                        <span style="font-size: 11px;">${this.getModuleIcon(modulePath)}</span>
                        
                        <!-- Имя файла - клик для активации карточки (как раньше) -->
                        <span onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusModule('${this.manager.escapeJs(modulePath)}')" 
                              style="color: #60a5fa; 
                                     text-decoration: none; 
                                     transition: all 0.2s ease;
                                     cursor: pointer;
                                     border-bottom: 1px solid transparent;
                                     font-weight: 600;
                                     word-break: break-word;"
                              onmouseenter="this.style.color='#93c5fd'; this.style.borderBottomColor='#60a5fa';"
                              onmouseleave="this.style.color='#60a5fa'; this.style.borderBottomColor='transparent';"
                              title="Кликните для перехода к модулю ${this.manager.escapeHtml(modulePath)}">
                            ${this.manager.escapeHtml(shortName)}
                        </span>
                        
                        <span class="level-badge" style="font-size: 9px; background: #0f172a; padding: 1px 6px; border-radius: 8px; color: #60a5fa; border: 1px solid #1a2a4a; margin-left: 2px; white-space: nowrap;">${levelDisplay}</span>
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
                        
                        <!-- Отдельная кнопка VS Code -->
                        <button onclick="event.stopPropagation(); window.open('${vscodeUrl}', '_blank');" 
                                style="background: #007acc; 
                                       border: none; 
                                       color: #fff; 
                                       cursor: pointer; 
                                       font-size: 9px; 
                                       padding: 1px 8px; 
                                       border-radius: 4px; 
                                       transition: all 0.2s;
                                       display: inline-flex;
                                       align-items: center;
                                       gap: 3px;
                                       font-family: inherit;"
                                onmouseenter="this.style.background='#005a9e'; this.style.transform='scale(1.05)';"
                                onmouseleave="this.style.background='#007acc'; this.style.transform='scale(1)';"
                                title="Открыть в VS Code: ${this.manager.escapeHtml(fullPath)}">
                            <span style="font-size: 10px;">⌨️</span> VS Code
                        </button>
                    </div>
                </div>
                
                <!-- Бейджи -->
                <div style="display:flex; gap:3px; flex-wrap:wrap; justify-content:flex-end; flex-shrink: 0; max-width: 60%;">
                    <span class="badge lang" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #334155; color: #94a3b8; white-space: nowrap;">${this.getLanguageIcon(language)} ${this.manager.escapeHtml(language)}</span>
                    ${isEntry ? '<span class="badge export" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #fbbf24; color: #0f172a; white-space: nowrap;">⭐ entry</span>' : ''}
                    <span class="badge lines" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #1e293b; color: #64748b; border: 1px solid #334155; white-space: nowrap;">📝 ${lines}</span>
                    <span class="badge level ${levelClass}" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; white-space: nowrap;">${levelDisplay}</span>
                    ${isActive ? '<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#22d3ee;color:#0f172a; white-space: nowrap;">🎯 активен</span>' : ''}
                    ${allExports.length > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#f87171; white-space: nowrap;">📤 ${allExports.length}</span>` : ''}
                    ${totalFuncs > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#4ade80; white-space: nowrap;">ƒ ${totalFuncs}</span>` : ''}
                </div>
            </div>
        `;
  }

  /**
   * Возвращает иконку для языка
   */
  getLanguageIcon(language) {
    const icons = {
      'typescript': '📘',
      'javascript': '📄',
      'vue': '🎯',
      'json': '📋',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
      'less': '🎨',
      'markdown': '📝',
      'yaml': '📋',
      'xml': '📋'
    };
    return icons[language?.toLowerCase()] || '📄';
  }

  /**
   * Возвращает иконку для модуля по расширению
   */
  getModuleIcon(modulePath) {
    if (!modulePath) return '📄';
    if (modulePath.endsWith('.vue')) return '🎯';
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) return '⚛️';
    if (modulePath.endsWith('.ts')) return '📘';
    if (modulePath.endsWith('.js')) return '📄';
    if (modulePath.endsWith('.json')) return '📋';
    if (modulePath.endsWith('.css') || modulePath.endsWith('.scss') || modulePath.endsWith('.less')) return '🎨';
    if (modulePath.endsWith('.html')) return '🌐';
    if (modulePath.endsWith('.md')) return '📝';
    if (modulePath.endsWith('.yaml') || modulePath.endsWith('.yml')) return '📋';
    if (modulePath.endsWith('.xml')) return '📋';
    return '📁';
  }

  /**
   * Строит полный путь к файлу на диске (для браузера)
   */
  buildFullPath(modulePath, pkg) {
    try {
      let relativePath = modulePath;

      if (pkg?.displayPath) {
        const parts = pkg.displayPath.split('/');
        const srcIndex = parts.indexOf('src');
        const packagesIndex = parts.indexOf('packages');

        if (srcIndex !== -1) {
          relativePath = parts.slice(srcIndex).join('/');
        } else if (packagesIndex !== -1) {
          relativePath = parts.slice(packagesIndex).join('/');
        } else {
          relativePath = pkg.displayPath;
        }
      }

      if (pkg?.resolved && pkg.resolved.startsWith('file:')) {
        const resolvedPath = pkg.resolved.replace(/^file:/, '');
        if (resolvedPath.includes('src/')) {
          const srcParts = resolvedPath.split('src/');
          if (srcParts.length > 1) {
            relativePath = 'src/' + srcParts[srcParts.length - 1];
          }
        }
      }

      if (relativePath.startsWith('/') || relativePath.match(/^[A-Za-z]:/)) {
        return relativePath;
      }

      const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      return this.basePath + cleanPath;
    } catch (error) {
      console.warn('⚠️ Ошибка построения полного пути:', error);
      return modulePath;
    }
  }

  /**
   * Строит URL для открытия файла в VS Code
   */
  buildVscodeUrl(fullPath) {
    if (!fullPath || fullPath === '#') return '#';

    try {
      let encodedPath = fullPath.replace(/\\/g, '/');

      if (encodedPath.match(/^[A-Za-z]:/)) {
        encodedPath = '/' + encodedPath;
      }

      return `vscode://file${encodedPath}`;
    } catch (error) {
      console.warn('⚠️ Ошибка создания ссылки VS Code:', error);
      return '#';
    }
  }

  /**
   * Строит URL для VS Code с указанием строки
   */
  buildVscodeUrlWithLine(fullPath, line) {
    const baseUrl = this.buildVscodeUrl(fullPath);
    if (line && baseUrl !== '#') {
      return `${baseUrl}:${line}`;
    }
    return baseUrl;
  }

  /**
   * Рендеринг компактной версии заголовка
   */
  renderCompact(data) {
    const {
      isActive,
      isEntry,
      displayName,
      levelDisplay,
      modulePath,
      pkg,
      language
    } = data;

    const fullPath = this.buildFullPath(modulePath, pkg);
    const vscodeUrl = this.buildVscodeUrl(fullPath);
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    return `
            <div class="header-row compact" style="display: flex; justify-content: space-between; align-items: center; gap: 4px; padding: 3px 0;">
                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                    ${isActive ? '<span style="font-size: 10px; color: #22d3ee;">▶</span>' : ''}
                    ${isEntry ? '<span style="font-size: 10px;">⭐</span>' : ''}
                    
                    <span onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusModule('${this.manager.escapeJs(modulePath)}')" 
                          style="color: #60a5fa; 
                                 text-decoration: none; 
                                 font-size: 11px;
                                 font-weight: 500;
                                 cursor: pointer;
                                 border-bottom: 1px solid transparent;"
                          onmouseenter="this.style.color='#93c5fd'; this.style.borderBottomColor='#60a5fa';"
                          onmouseleave="this.style.color='#60a5fa'; this.style.borderBottomColor='transparent';"
                          title="Кликните для перехода к модулю">
                        ${this.manager.escapeHtml(shortName)}
                    </span>
                    
                    <span style="font-size: 8px; color: #64748b;">${levelDisplay}</span>
                    <span style="font-size: 7px; color: #64748b; background: #334155; padding: 0 4px; border-radius: 4px;">${this.manager.escapeHtml(language)}</span>
                    
                    <!-- Компактная кнопка VS Code -->
                    <button onclick="event.stopPropagation(); window.open('${vscodeUrl}', '_blank');" 
                            style="background: #007acc; 
                                   border: none; 
                                   color: #fff; 
                                   cursor: pointer; 
                                   font-size: 7px; 
                                   padding: 0 6px; 
                                   border-radius: 4px; 
                                   transition: all 0.2s;"
                            onmouseenter="this.style.background='#005a9e';"
                            onmouseleave="this.style.background='#007acc';"
                            title="Открыть в VS Code">
                        ⌨️
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Рендеринг только имени (без кнопок)
   */
  renderNameOnly(data) {
    const { displayName, modulePath } = data;
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    return `
            <span onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusModule('${this.manager.escapeJs(modulePath)}')" 
                  style="color: #60a5fa; 
                         text-decoration: none; 
                         font-size: 13px;
                         font-weight: 600;
                         cursor: pointer;
                         transition: all 0.2s;
                         border-bottom: 1px solid transparent;"
                  onmouseenter="this.style.color='#93c5fd'; this.style.borderBottomColor='#60a5fa';"
                  onmouseleave="this.style.color='#60a5fa'; this.style.borderBottomColor='transparent';"
                  title="Кликните для перехода к модулю">
                ${this.manager.escapeHtml(shortName)}
            </span>
        `;
  }

  /**
   * Получает базовый путь
   */
  getBasePath() {
    return this.basePath;
  }

  /**
   * Устанавливает базовый путь
   */
  setBasePath(path) {
    this.basePath = path;
    console.log('📁 Base path updated:', this.basePath);
  }
}
