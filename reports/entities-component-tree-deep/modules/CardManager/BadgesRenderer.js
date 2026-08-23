// packages/ast-analyzer/src/reporters/templates/modules/CardManager/BadgesRenderer.js

import path from 'path';

/**
 * BadgesRenderer - рендеринг бейджей со статистикой модуля
 * Отображает компактную информацию о модуле:
 * - Количество функций, классов, констант, интерфейсов, типов, переменных
 * - Экспорты
 * - Внешние вызовы (входящие/исходящие)
 * - Внутренние вызовы
 * - Модули-импортеры и модули-импорты
 *
 * Особенности:
 * - Компактный стиль с маленькими бейджами
 * - Цветовая кодировка для разных типов сущностей
 * - Интерактивность при наведении
 * - Ссылка на VS Code для открытия файла с полным путем
 */
export class BadgesRenderer {
  constructor(manager) {
    this.manager = manager;
    // Получаем корень проекта из менеджера
    this.projectRoot = this.manager.headerRenderer?.projectRoot || process.cwd();

    console.log('📁 BadgesRenderer projectRoot:', this.projectRoot);
  }

  /**
   * Рендеринг бейджей
   * @param {Object} data - Данные для рендеринга
   * @param {number} data.totalFuncs - Общее количество функций
   * @param {number} data.totalClasses - Общее количество классов
   * @param {number} data.totalConstants - Общее количество констант
   * @param {number} data.totalInterfaces - Общее количество интерфейсов
   * @param {number} data.totalTypes - Общее количество типов
   * @param {number} data.totalVariables - Общее количество переменных
   * @param {Array} data.allExports - Список всех экспортов
   * @param {Set} data.externalOutgoing - Внешние исходящие вызовы
   * @param {Set} data.externalIncoming - Внешние входящие вызовы
   * @param {number} data.totalInternal - Общее количество внутренних вызовов
   * @param {Set} data.moduleImporters - Модули, которые импортируют текущий
   * @param {Set} data.moduleImports - Модули, которые импортирует текущий
   * @param {string} data.modulePath - Путь к модулю (ключ из отчета)
   * @param {Object} data.pkg - Объект пакета с displayPath и resolved
   * @returns {string} HTML строка
   */
  render(data) {
    const {
      totalFuncs,
      totalClasses,
      totalConstants,
      totalInterfaces,
      totalTypes,
      totalVariables,
      allExports,
      externalOutgoing,
      externalIncoming,
      totalInternal,
      moduleImporters,
      moduleImports,
      modulePath,
      pkg,
    } = data;

    // Строим полный путь для ссылки VS Code
    const fullPath = this.buildFullPath(modulePath, pkg);
    const vscodeUrl = this.buildVscodeUrl(fullPath);

    return `
            <div class="badges" style="display: flex; flex-wrap: wrap; gap: 3px; margin: 2px 0;">
                <!-- Кнопка открытия в VS Code -->
                <a href="${vscodeUrl}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="badge vscode-link"
                   style="font-size: 8px; 
                          padding: 1px 6px; 
                          border-radius: 8px; 
                          background: #007acc; 
                          color: #fff;
                          text-decoration: none;
                          cursor: pointer;
                          display: inline-flex;
                          align-items: center;
                          gap: 3px;
                          transition: all 0.2s;"
                   onmouseenter="this.style.background='#005a9e'; this.style.transform='scale(1.05)';"
                   onmouseleave="this.style.background='#007acc'; this.style.transform='scale(1)';"
                   title="Открыть файл в VS Code: ${this.manager.escapeHtml(fullPath)}">
                    <span style="font-size: 10px;">⌨️</span> VS Code
                </a>

                <!-- Функции -->
                <span class="badge fn" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #fbbf24; color: #0f172a; cursor: default;">
                    ƒ ${totalFuncs}
                </span>
                
                <!-- Классы -->
                ${
                  totalClasses > 0
                    ? `
                    <span class="badge class" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #4ade80; color: #0f172a; cursor: default;">
                        📦 ${totalClasses}
                    </span>
                `
                    : ''
                }
                
                <!-- Константы -->
                ${
                  totalConstants > 0
                    ? `
                    <span class="badge const" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #f472b6; color: #0f172a; cursor: default;">
                        📌 ${totalConstants}
                    </span>
                `
                    : ''
                }
                
                <!-- Интерфейсы -->
                ${
                  totalInterfaces > 0
                    ? `
                    <span class="badge interface" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #a78bfa; color: #fff; cursor: default;">
                        📋 ${totalInterfaces}
                    </span>
                `
                    : ''
                }
                
                <!-- Типы -->
                ${
                  totalTypes > 0
                    ? `
                    <span class="badge type" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #22d3ee; color: #0f172a; cursor: default;">
                        📝 ${totalTypes}
                    </span>
                `
                    : ''
                }
                
                <!-- Переменные -->
                ${
                  totalVariables > 0
                    ? `
                    <span class="badge var" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #f87171; color: #fff; cursor: default;">
                        📄 ${totalVariables}
                    </span>
                `
                    : ''
                }
                
                <!-- Экспорты -->
                ${
                  allExports.length > 0
                    ? `
                    <span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #f87171; color: #fff; cursor: default;">
                        📤 ${allExports.length}
                    </span>
                `
                    : ''
                }
                
                <!-- Внешние исходящие -->
                ${
                  externalOutgoing.size > 0
                    ? `
                    <span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #f59e0b; color: #0f172a; cursor: default;">
                        📤 ${externalOutgoing.size}
                    </span>
                `
                    : ''
                }
                
                <!-- Внешние входящие -->
                ${
                  externalIncoming.size > 0
                    ? `
                    <span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #3b82f6; color: #fff; cursor: default;">
                        📥 ${externalIncoming.size}
                    </span>
                `
                    : ''
                }
                
                <!-- Внутренние вызовы -->
                ${
                  totalInternal > 0
                    ? `
                    <span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #64748b; color: #fff; cursor: default;">
                        🔄 ${totalInternal}
                    </span>
                `
                    : ''
                }
                
                <!-- Модули-импортеры -->
                ${
                  moduleImporters.size > 0
                    ? `
                    <span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #22d3ee; color: #0f172a; cursor: default;">
                        📥 ${moduleImporters.size}
                    </span>
                `
                    : ''
                }
                
                <!-- Модули-импорты -->
                ${
                  moduleImports.size > 0
                    ? `
                    <span class="badge" style="font-size: 8px; padding: 1px 6px; border-radius: 8px; background: #f59e0b; color: #0f172a; cursor: default;">
                        📤 ${moduleImports.size}
                    </span>
                `
                    : ''
                }
            </div>
        `;
  }

  /**
   * Строит полный путь к файлу на диске
   *
   * Пути в отчете: "src/cli.ts" (относительно корня проекта)
   * Полный путь: /home/sergei/Desktop/system/packages/ast-analyzer/src/cli.ts
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
        if (resolvedPath.includes('src/')) {
          const srcParts = resolvedPath.split('src/');
          if (srcParts.length > 1) {
            relativePath = 'src/' + srcParts[srcParts.length - 1];
          }
        } else if (resolvedPath.includes('packages/')) {
          const pkgParts = resolvedPath.split('packages/');
          if (pkgParts.length > 1) {
            relativePath = 'packages/' + pkgParts[pkgParts.length - 1];
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
          // Пробуем альтернативные пути
          const altPaths = [
            // Путь через packages/ast-analyzer
            path.resolve(this.projectRoot, 'packages/ast-analyzer', relativePath),
            // Если путь начинается с src/, заменяем на packages/ast-analyzer/src/
            path.resolve(
              this.projectRoot,
              relativePath.replace('src/', 'packages/ast-analyzer/src/')
            ),
            // Путь через packages/ast-analyzer/src/reporters/templates
            path.resolve(
              this.projectRoot,
              'packages/ast-analyzer/src/reporters/templates',
              relativePath
            ),
            // Путь через reports/entities-component-tree-deep
            path.resolve(this.projectRoot, 'reports/entities-component-tree-deep', relativePath),
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
      console.warn('⚠️ Ошибка построения полного пути в BadgesRenderer:', error);
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
      console.warn('⚠️ Ошибка создания ссылки VS Code в BadgesRenderer:', error);
      return '#';
    }
  }

  /**
   * Строит URL для VS Code с указанием строки
   * @param {string} fullPath - Полный путь к файлу
   * @param {number} line - Номер строки
   * @returns {string} URL для VS Code
   */
  buildVscodeUrlWithLine(fullPath, line) {
    const baseUrl = this.buildVscodeUrl(fullPath);
    if (line && baseUrl !== '#') {
      return `${baseUrl}:${line}`;
    }
    return baseUrl;
  }

  /**
   * Рендеринг только основных бейджей (компактный режим)
   * @param {Object} data - Данные для рендеринга
   * @returns {string} HTML строка
   */
  renderCompact(data) {
    const { totalFuncs, totalClasses, totalConstants, allExports, modulePath, pkg } = data;

    const fullPath = this.buildFullPath(modulePath, pkg);
    const vscodeUrl = this.buildVscodeUrl(fullPath);

    return `
            <div class="badges compact" style="display: flex; flex-wrap: wrap; gap: 2px; margin: 1px 0;">
                <a href="${vscodeUrl}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   style="font-size: 7px; 
                          padding: 0 4px; 
                          border-radius: 6px; 
                          background: #007acc; 
                          color: #fff;
                          text-decoration: none;
                          cursor: pointer;"
                   title="Открыть в VS Code">
                    ⌨️
                </a>
                <span class="badge fn" style="font-size: 7px; padding: 0 4px; border-radius: 6px; background: #fbbf24; color: #0f172a;">ƒ${totalFuncs}</span>
                ${totalClasses > 0 ? `<span class="badge class" style="font-size: 7px; padding: 0 4px; border-radius: 6px; background: #4ade80; color: #0f172a;">📦${totalClasses}</span>` : ''}
                ${totalConstants > 0 ? `<span class="badge const" style="font-size: 7px; padding: 0 4px; border-radius: 6px; background: #f472b6; color: #0f172a;">📌${totalConstants}</span>` : ''}
                ${allExports.length > 0 ? `<span class="badge" style="font-size: 7px; padding: 0 4px; border-radius: 6px; background: #f87171; color: #fff;">📤${allExports.length}</span>` : ''}
            </div>
        `;
  }

  /**
   * Рендеринг бейджа для отдельной сущности
   * @param {string} label - Текст бейджа
   * @param {number} count - Количество
   * @param {string} color - Цвет текста
   * @param {string} bgColor - Цвет фона
   * @param {string} tooltip - Подсказка при наведении
   * @returns {string} HTML строка
   */
  renderBadge(label, count, color, bgColor, tooltip = '') {
    if (!count || count === 0) return '';

    return `
            <span class="badge" 
                  style="font-size: 8px; 
                         padding: 1px 6px; 
                         border-radius: 8px; 
                         background: ${bgColor}; 
                         color: ${color};
                         cursor: default;"
                  title="${this.manager.escapeHtml(tooltip || label)}">
                ${label} ${count}
            </span>
        `;
  }

  /**
   * Рендеринг бейджа с ссылкой на VS Code для конкретной сущности
   * @param {string} label - Текст бейджа
   * @param {number} count - Количество
   * @param {string} filePath - Путь к файлу (ключ из отчета)
   * @param {Object} pkg - Объект пакета
   * @param {number} line - Номер строки
   * @param {string} color - Цвет текста
   * @param {string} bgColor - Цвет фона
   * @returns {string} HTML строка
   */
  renderClickableBadge(label, count, filePath, pkg, line, color, bgColor) {
    if (!count || count === 0) return '';

    const fullPath = this.buildFullPath(filePath, pkg);
    const vscodeUrl = this.buildVscodeUrlWithLine(fullPath, line);

    return `
            <a href="${vscodeUrl}" 
               target="_blank" 
               rel="noopener noreferrer"
               class="badge clickable"
               style="font-size: 8px; 
                      padding: 1px 6px; 
                      border-radius: 8px; 
                      background: ${bgColor}; 
                      color: ${color};
                      text-decoration: none;
                      cursor: pointer;
                      transition: all 0.2s;"
               onmouseenter="this.style.transform='scale(1.05)';"
               onmouseleave="this.style.transform='scale(1)';"
               title="Открыть в VS Code: ${this.manager.escapeHtml(fullPath)}">
                ${label} ${count}
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

  /**
   * Проверяет, существует ли файл по указанному пути
   * @param {string} filePath - Путь к файлу
   * @returns {boolean} true если файл существует
   */
  fileExists(filePath) {
    try {
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch (e) {
      return false;
    }
  }

  /**
   * Получает размер файла в байтах
   * @param {string} filePath - Путь к файлу
   * @returns {number} Размер файла или 0
   */
  getFileSize(filePath) {
    try {
      const fs = require('fs');
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (e) {
      return 0;
    }
  }
}
