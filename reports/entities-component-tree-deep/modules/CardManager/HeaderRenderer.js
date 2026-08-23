// packages/ast-analyzer/src/reporters/templates/modules/CardManager/HeaderRenderer.js

import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущему файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * HeaderRenderer - рендеринг заголовка карточки модуля
 * Отвечает за отображение имени модуля, уровня, языка и статистики
 *
 * Особенности:
 * - Имя модуля как ссылка на VS Code (vscode://file/полный_путь)
 * - Отображение уровня модуля (L0, L1, L2...)
 * - Компактные бейджи с информацией
 * - Поддержка активного состояния
 * - Копирование полного пути в буфер обмена
 */
export class HeaderRenderer {
  constructor(manager) {
    this.manager = manager;

    // Определяем корень проекта (где находится package.json)
    // Идем вверх от текущего файла до корня проекта
    // packages/ast-analyzer/src/reporters/templates/modules/CardManager/HeaderRenderer.js
    // → packages/ast-analyzer/ (корень пакета)
    // → system/ (корень проекта)
    this.projectRoot = this.findProjectRoot(__dirname);

    console.log('📁 Project root:', this.projectRoot);
  }

  /**
   * Находит корень проекта (где находится package.json)
   * @param {string} startDir - Начальная директория для поиска
   * @returns {string} Путь к корню проекта
   */
  findProjectRoot(startDir) {
    let currentDir = startDir;
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const packagePath = path.join(currentDir, 'package.json');
      try {
        const fs = require('fs');
        if (fs.existsSync(packagePath)) {
          return currentDir;
        }
      } catch (e) {
        // Игнорируем ошибки
      }
      currentDir = path.dirname(currentDir);
    }
    return startDir;
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
      totalFuncs,
    } = data;

    // Строим полный путь на диске для VS Code
    const fullPath = this.buildFullPath(modulePath, pkg);
    const vscodeUrl = this.buildVscodeUrl(fullPath);

    // Отображаемое имя (без пути)
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    return `
            <div class="header-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; padding: 6px 0 4px 0;">
                <div>
                    <div class="name ${levelClass}" style="font-size: 13px; font-weight: 600; color: #60a5fa; display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                        ${isActive ? '<span style="font-size: 12px; color: #22d3ee;">▶</span>' : ''}
                        ${isEntry ? '<span style="font-size: 12px;">⭐</span>' : ''}
                        
                        <!-- Ссылка на VS Code -->
                        <a href="${vscodeUrl}" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           style="color: #60a5fa; 
                                  text-decoration: none; 
                                  transition: all 0.2s ease;
                                  cursor: pointer;
                                  border-bottom: 1px solid transparent;"
                           onmouseenter="this.style.color='#93c5fd'; this.style.borderBottomColor='#60a5fa';"
                           onmouseleave="this.style.color='#60a5fa'; this.style.borderBottomColor='transparent';"
                           title="Открыть в VS Code: ${this.manager.escapeHtml(fullPath)}">
                            ${this.manager.escapeHtml(shortName)}
                        </a>
                        
                        <span class="level-badge" style="font-size: 9px; background: #0f172a; padding: 1px 6px; border-radius: 8px; color: #60a5fa; border: 1px solid #1a2a4a; margin-left: 4px;">${levelDisplay}</span>
                    </div>
                    <div class="path" style="font-size: 8px; color: #64748b; font-family: monospace; word-break: break-all; margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                        <span>${this.manager.escapeHtml(modulePath)}</span>
                        <!-- Кнопка копирования полного пути -->
                        <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${this.manager.escapeJs(fullPath)}'); this.textContent = '✅'; setTimeout(() => this.textContent = '📋', 1000);" 
                                style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 10px; padding: 0 4px; transition: all 0.2s;"
                                onmouseenter="this.style.color='#60a5fa';"
                                onmouseleave="this.style.color='#64748b';"
                                title="Копировать полный путь">
                            📋
                        </button>
                    </div>
                </div>
                <div style="display:flex; gap:3px; flex-wrap:wrap; justify-content:flex-end;">
                    <span class="badge lang" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #334155; color: #94a3b8;">${this.manager.escapeHtml(language)}</span>
                    ${isEntry ? '<span class="badge export" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #fbbf24; color: #0f172a;">⭐ entry</span>' : ''}
                    <span class="badge lines" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #1e293b; color: #64748b; border: 1px solid #334155;">${lines} строк</span>
                    <span class="badge level ${levelClass}" style="font-size: 8px; padding: 1px 6px; border-radius: 8px;">${levelDisplay}</span>
                    ${isActive ? '<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#22d3ee;color:#0f172a;">🎯 активен</span>' : ''}
                    ${allExports.length > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#f87171;">📤 ${allExports.length}</span>` : ''}
                    ${totalFuncs > 0 ? `<span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background:#4ade80;">ƒ ${totalFuncs}</span>` : ''}
                </div>
            </div>
        `;
  }

  /**
   * Строит полный путь к файлу на диске
   *
   * Пути в отчете указаны относительно корня проекта:
   * - "src/cli.ts" → /project-root/src/cli.ts
   * - "src/core/ast-parser.ts" → /project-root/src/core/ast-parser.ts
   *
   * Структура проекта:
   * /home/sergei/Desktop/system/
   *   └── packages/
   *       └── ast-analyzer/
   *           └── src/
   *               └── reporters/
   *                   └── templates/
   *                       └── package-lock-report.json
   *
   * Путь в отчете "src/cli.ts" → полный путь:
   * /home/sergei/Desktop/system/packages/ast-analyzer/src/cli.ts
   *
   * @param {string} modulePath - Ключ модуля из отчета (например "src/cli.ts")
   * @param {Object} pkg - Объект пакета с displayPath и resolved
   * @returns {string} Полный путь к файлу на диске
   */
  buildFullPath(modulePath, pkg) {
    try {
      // 1. Определяем относительный путь к файлу
      let relativePath = modulePath;

      // Если есть displayPath, извлекаем путь от "src" или "packages"
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
        // Если resolved путь содержит "src/", используем его
        if (resolvedPath.includes('src/')) {
          const srcParts = resolvedPath.split('src/');
          if (srcParts.length > 1) {
            relativePath = 'src/' + srcParts[srcParts.length - 1];
          }
        }
      }

      // 2. Проверяем, не является ли путь уже абсолютным
      if (relativePath.startsWith('/')) {
        return relativePath;
      }
      if (relativePath.match(/^[A-Za-z]:/)) {
        return relativePath;
      }

      // 3. Строим полный путь от корня проекта
      const fullPath = path.resolve(this.projectRoot, relativePath);

      // 4. Проверяем существование файла
      try {
        const fs = require('fs');
        if (!fs.existsSync(fullPath)) {
          // Пробуем альтернативные варианты
          const altPaths = [
            path.resolve(this.projectRoot, 'packages/ast-analyzer', relativePath),
            path.resolve(
              this.projectRoot,
              relativePath.replace('src/', 'packages/ast-analyzer/src/')
            ),
            path.resolve(
              this.projectRoot,
              'packages/ast-analyzer/src/reporters/templates',
              relativePath
            ),
          ];

          for (const altPath of altPaths) {
            if (fs.existsSync(altPath)) {
              return altPath;
            }
          }
        }
      } catch (e) {
        // Игнорируем ошибки проверки файлов
      }

      return fullPath;
    } catch (error) {
      console.warn('⚠️ Ошибка построения полного пути:', error);
      return modulePath;
    }
  }

  /**
   * Строит URL для открытия файла в VS Code
   * @param {string} fullPath - Полный путь к файлу на диске
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
      console.warn('⚠️ Ошибка создания ссылки VS Code:', error);
      return '#';
    }
  }

  /**
   * Строит URL для VS Code с указанием строки
   * @param {string} fullPath - Полный путь к файлу на диске
   * @param {number} line - Номер строки
   * @returns {string} URL для VS Code с указанием строки
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
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCompact(data) {
    const { isActive, isEntry, displayName, levelDisplay, modulePath, pkg, language } = data;

    const fullPath = this.buildFullPath(modulePath, pkg);
    const vscodeUrl = this.buildVscodeUrl(fullPath);
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    return `
            <div class="header-row compact" style="display: flex; justify-content: space-between; align-items: center; gap: 4px; padding: 3px 0;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    ${isActive ? '<span style="font-size: 10px; color: #22d3ee;">▶</span>' : ''}
                    ${isEntry ? '<span style="font-size: 10px;">⭐</span>' : ''}
                    
                    <a href="${vscodeUrl}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style="color: #60a5fa; 
                              text-decoration: none; 
                              font-size: 11px;
                              font-weight: 500;
                              cursor: pointer;"
                       title="Открыть в VS Code: ${this.manager.escapeHtml(fullPath)}">
                        ${this.manager.escapeHtml(shortName)}
                    </a>
                    
                    <span style="font-size: 8px; color: #64748b;">${levelDisplay}</span>
                    <span style="font-size: 7px; color: #64748b; background: #334155; padding: 0 4px; border-radius: 4px;">${this.manager.escapeHtml(language)}</span>
                </div>
            </div>
        `;
  }

  /**
   * Рендеринг только имени с ссылкой
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderNameOnly(data) {
    const { displayName, modulePath, pkg } = data;
    const fullPath = this.buildFullPath(modulePath, pkg);
    const vscodeUrl = this.buildVscodeUrl(fullPath);
    const shortName = displayName || modulePath.split('/').pop() || modulePath;

    return `
            <a href="${vscodeUrl}" 
               target="_blank" 
               rel="noopener noreferrer"
               style="color: #60a5fa; 
                      text-decoration: none; 
                      font-size: 13px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;"
               onmouseenter="this.style.color='#93c5fd';"
               onmouseleave="this.style.color='#60a5fa';"
               title="Открыть в VS Code: ${this.manager.escapeHtml(fullPath)}">
                ${this.manager.escapeHtml(shortName)}
            </a>
        `;
  }

  /**
   * Получает корень проекта
   * @returns {string} Путь к корню проекта
   */
  getProjectRoot() {
    return this.projectRoot;
  }
}
