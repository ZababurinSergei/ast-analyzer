// packages/ast-analyzer/src/reporters/templates/modules/CardManager/FunctionsListRenderer.js

export class FunctionsListRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  render(data) {
    const { funcs, isActive, modulePath, focusFunction, sourceInfo, callSources, totalFuncs } =
      data;

    const displayFuncs = isActive ? funcs : funcs.slice(0, 10);
    const hasMore = funcs.length > 10 && !isActive;

    let funcsHtml = '';

    // Группировка функций по тегам (если есть)
    const groupedFuncs = {};
    for (const func of displayFuncs) {
      const tags = func.tags || ['default'];
      for (const tag of tags) {
        if (!groupedFuncs[tag]) groupedFuncs[tag] = [];
        groupedFuncs[tag].push(func);
      }
    }

    const hasTags =
      Object.keys(groupedFuncs).length > 0 && Object.keys(groupedFuncs).some(k => k !== 'default');

    if (hasTags) {
      for (const [tag, tagFuncs] of Object.entries(groupedFuncs)) {
        funcsHtml += `
                    <div class="func-group" style="margin: 4px 0 2px 0;">
                        <div class="func-group-label" style="font-size: 9px; color: #60a5fa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">
                            #${this.manager.escapeHtml(tag)} (${tagFuncs.length})
                        </div>
                        ${tagFuncs.map(f => this.renderFunctionItem(f, modulePath, focusFunction, sourceInfo, callSources)).join('')}
                    </div>
                `;
      }
    } else {
      // Без группировки
      for (const func of displayFuncs) {
        funcsHtml += this.renderFunctionItem(
          func,
          modulePath,
          focusFunction,
          sourceInfo,
          callSources
        );
      }
    }

    return `
            <div class="functions-list" style="margin-top: 4px; max-height: ${isActive ? '400px' : '200px'}; overflow-y: auto; text-align: left; padding-left: 0;">
                ${funcsHtml}
                ${hasMore ? `<div style="text-align:left;padding:4px;color:#64748b;font-size:10px;">... и еще ${funcs.length - 10} функций</div>` : ''}
                ${funcs.length === 0 ? '<div style="color:#64748b;font-size:10px;padding:4px;text-align:left;">Нет функций</div>' : ''}
            </div>
        `;
  }

  renderFunctionItem(func, modulePath, focusFunction, sourceInfo, callSources) {
    if (!func || !func.name) return '';

    const funcName = this.manager.escapeHtml(func.name);
    const modulePathEscaped = this.manager.escapeHtml(modulePath);
    const paramsStr = (func.params || []).map(p => this.manager.escapeHtml(p)).join(', ');
    const isExported = func.isExported || false;
    const isAsync = func.isAsync || false;
    const lineNum = func.line || 0;
    const isActiveFunc = focusFunction === func.name && true;
    const isSource =
      sourceInfo && sourceInfo.function === func.name && sourceInfo.module === modulePath;

    // Вычисляем сложность
    const complexity = func.complexity || 0;
    const complexityColor = complexity > 10 ? '#f87171' : complexity > 5 ? '#fbbf24' : '#4ade80';

    // Размер функции
    const funcSize = func.endLine && func.startLine ? func.endLine - func.startLine + 1 : 0;

    // Проверка на устаревшую функцию
    const isDeprecated = func.isDeprecated || false;

    // Проверка на покрытие тестами
    const isTested = func.isTested || false;

    // Уровень безопасности
    const securityLevel = func.securityLevel || 'low';

    // Описание функции
    const description = func.description || '';

    // Теги
    const tags = func.tags || [];

    // Покрытие в процентах
    const coverage = func.coverage;

    // Источник вызова
    const callSource = callSources ? callSources.get(func.name) || 'top-level' : 'top-level';
    const sourceIcon = callSource === 'top-level' ? '📋' : '🔽';
    const sourceLabel = callSource === 'top-level' ? 'top-level' : `из ${callSource}`;

    const hasExternalCalls = (func.calls || []).some(call => {
      const targetModule = this.manager.findModuleForFunction(call);
      return targetModule && targetModule !== modulePath;
    });

    // Функции всегда кликабельны (переход к функции)
    const onclickAttr = `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(func.name)}', '${this.manager.escapeJs(modulePath)}')"`;

    // Копирование сигнатуры
    const signature = `${func.name}(${(func.params || []).join(', ')}): ${func.returnType || 'any'}`;

    // Собираем вызовы с информацией о том, внешние они или внутренние
    let callsHtml = '';
    if (func.calls && func.calls.length > 0) {
      const callsList = func.calls
        .slice(0, 5)
        .map(call => {
          const callSourceInfo = callSources ? callSources.get(call) || 'top-level' : 'top-level';
          const callIcon = callSourceInfo === 'top-level' ? '📋' : '🔽';
          const targetModule = this.manager.findModuleForFunction(call);
          const isExternal = targetModule && targetModule !== modulePath;
          const moduleDisplay = isExternal
            ? ` 📁${this.manager.escapeHtml(targetModule.split('/').pop())}`
            : '';
          // Если вызов внешний - делаем кликабельным
          const clickAttr = isExternal
            ? `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(call)}', '${this.manager.escapeJs(targetModule)}')"`
            : '';
          const cursorStyle = isExternal ? 'cursor:pointer;' : '';
          const colorStyle = isExternal ? 'color:#f59e0b;' : 'color:#94a3b8;';
          return `<span class="func-call" style="${colorStyle} background: #0a0a1a; padding: 0 4px; border-radius: 3px; ${cursorStyle}" ${clickAttr} title="${call} (${callSourceInfo})${moduleDisplay}">${this.manager.escapeHtml(call)} <span style="font-size: 6px; color: #64748b;">${callIcon}${moduleDisplay}</span></span>`;
        })
        .join('');
      const moreCount =
        func.calls.length > 5
          ? `<span style="color: #64748b; font-size: 7px;">+${func.calls.length - 5}</span>`
          : '';
      callsHtml = `
                <div class="func-calls-container" style="display: flex; flex-wrap: wrap; gap: 2px; margin: 1px 0; font-size: 8px;">
                    <span class="func-calls-label" style="color: #64748b;">→</span>
                    ${callsList}
                    ${moreCount}
                </div>
            `;
    }

    // Собираем вызывающие функции
    let calledByHtml = '';
    if (func.calledBy && func.calledBy.length > 0) {
      const callersList = func.calledBy
        .slice(0, 5)
        .map(caller => {
          const callerSource = callSources ? callSources.get(caller) || 'top-level' : 'top-level';
          const callerIcon = callerSource === 'top-level' ? '📋' : '🔽';
          const callerModule = this.manager.findModuleForFunction(caller);
          const isExternal = callerModule && callerModule !== modulePath;
          const moduleDisplay = isExternal
            ? ` 📁${this.manager.escapeHtml(callerModule.split('/').pop())}`
            : '';
          // Если вызывающий внешний - делаем кликабельным
          const clickAttr = isExternal
            ? `onclick="event.stopPropagation(); window[Symbol.for('__AST_APP_API__')]?.focusFunction('${this.manager.escapeJs(caller)}', '${this.manager.escapeJs(callerModule)}')"`
            : '';
          const cursorStyle = isExternal ? 'cursor:pointer;' : '';
          const colorStyle = isExternal ? 'color:#3b82f6;' : 'color:#94a3b8;';
          return `<span class="func-caller" style="${colorStyle} background: #0a0a1a; padding: 0 4px; border-radius: 3px; ${cursorStyle}" ${clickAttr} title="${caller} (${callerSource})${moduleDisplay}">${this.manager.escapeHtml(caller)} <span style="font-size: 6px; color: #64748b;">${callerIcon}${moduleDisplay}</span></span>`;
        })
        .join('');
      const moreCount =
        func.calledBy.length > 5
          ? `<span style="color: #64748b; font-size: 7px;">+${func.calledBy.length - 5}</span>`
          : '';
      calledByHtml = `
                <div class="func-calledby-container" style="display: flex; flex-wrap: wrap; gap: 2px; margin: 1px 0; font-size: 8px;">
                    <span class="func-calledby-label" style="color: #64748b;">←</span>
                    ${callersList}
                    ${moreCount}
                </div>
            `;
    }

    return `
            <div class="func-item ${isActiveFunc ? 'active' : ''} ${isSource ? 'source' : ''} ${hasExternalCalls ? 'has-external' : ''} ${isDeprecated ? 'deprecated' : ''}" 
                 ${onclickAttr} 
                 data-func="${funcName}" 
                 data-module="${modulePathEscaped}"
                 style="display: flex; flex-direction: column; padding: 2px 6px; margin: 1px 0; background: #0f172a; border-radius: 4px; border-left: 2px solid transparent; cursor: pointer; transition: all 0.2s;">
                <div class="func-header" style="display: flex; align-items: center; flex-wrap: wrap; gap: 3px;">
                    <span class="func-name" style="font-size: 11px; font-weight: 500; color: #e2e8f0;">${funcName}</span>
                    <span style="font-size: 8px; color: #64748b; margin-left: 2px;" title="Источник вызова: ${sourceLabel}">${sourceIcon} ${sourceLabel}</span>
                    ${isExported ? '<span class="func-export" style="font-size: 8px;" title="Экспортирована">📤</span>' : ''}
                    ${isAsync ? '<span class="func-async" style="font-size: 8px;" title="Асинхронная">⚡</span>' : ''}
                    ${isDeprecated ? '<span class="deprecated-badge" style="font-size: 7px; background: #f87171; color: #fff; padding: 0 4px; border-radius: 6px;" title="Устаревшая функция">⚠️</span>' : ''}
                    ${isTested ? '<span class="tested-badge" style="font-size: 7px; background: #4ade80; color: #0f172a; padding: 0 4px; border-radius: 6px;" title="Покрыта тестами">🧪</span>' : ''}
                    ${isSource ? '<span class="func-source-badge" style="font-size: 7px; color: #22d3ee; padding: 0 4px;">⬅</span>' : ''}
                    ${isActiveFunc ? '<span class="func-current-badge" style="font-size: 8px;">🎯</span>' : ''}
                    <button class="copy-signature-btn" onclick="event.stopPropagation(); navigator.clipboard.writeText('${this.manager.escapeJs(signature)}'); this.textContent = '✅'; setTimeout(() => this.textContent = '📋', 1000);" title="Копировать сигнатуру" style="background: #1a2a4a; border: 1px solid #334155; color: #94a3b8; cursor: pointer; font-size: 8px; padding: 1px 6px; border-radius: 4px; transition: all 0.2s;">
                        📋
                    </button>
                </div>
                
                <div class="func-meta" style="display: flex; flex-wrap: wrap; gap: 4px; font-size: 8px; color: #94a3b8; margin: 1px 0;">
                    ${paramsStr ? `<span class="func-params" title="Параметры">(${paramsStr})</span>` : '<span class="func-params">()</span>'}
                    ${func.returnType ? `<span class="func-return" style="color: #60a5fa;">→ ${this.manager.escapeHtml(func.returnType)}</span>` : ''}
                    ${
                      complexity > 0
                        ? `
                        <span class="func-complexity" style="color: ${complexityColor};" title="Сложность: ${complexity}">
                            🔄 ${complexity}
                        </span>
                    `
                        : ''
                    }
                    ${
                      funcSize > 0
                        ? `
                        <span class="func-size" title="Размер: ${funcSize} строк">
                            📏 ${funcSize}
                        </span>
                    `
                        : ''
                    }
                    ${
                      coverage !== undefined
                        ? `
                        <span class="func-coverage" title="Покрытие тестами: ${coverage}%" style="color: ${coverage > 80 ? '#4ade80' : coverage > 50 ? '#fbbf24' : '#f87171'}">
                            📊 ${coverage}%
                        </span>
                    `
                        : ''
                    }
                    ${
                      securityLevel && securityLevel !== 'low'
                        ? `
                        <span class="security-badge security-${securityLevel}" title="Уровень безопасности: ${securityLevel}" style="color: ${securityLevel === 'high' ? '#f87171' : '#fbbf24'};">
                            🔒 ${securityLevel}
                        </span>
                    `
                        : ''
                    }
                    <span class="func-line" style="color: #64748b;">стр.${lineNum}</span>
                </div>
                
                ${
                  description
                    ? `
                    <div class="func-description" style="font-size: 9px; color: #94a3b8; margin: 1px 0; padding: 1px 6px; background: #0a0a1a; border-radius: 3px; border-left: 2px solid #60a5fa;">
                        ${this.manager.escapeHtml(description)}
                    </div>
                `
                    : ''
                }
                
                ${
                  tags.length > 0
                    ? `
                    <div class="func-tags" style="display: flex; flex-wrap: wrap; gap: 2px; margin: 1px 0;">
                        ${tags.map(tag => `<span class="tag" style="font-size: 7px; background: #1a2a4a; padding: 0 6px; border-radius: 6px; color: #60a5fa;">#${this.manager.escapeHtml(tag)}</span>`).join('')}
                    </div>
                `
                    : ''
                }
                
                ${callsHtml}
                ${calledByHtml}
                
                ${hasExternalCalls ? '<span class="func-external-badge" style="font-size: 7px; color: #f59e0b;">🌐</span>' : ''}
            </div>
        `;
  }
}
