// packages/ast-analyzer/src/core/entity-extractor/vue/convert-analysis.ts

import path from 'path';
import type { VueComponentAnalysis } from '../../../modes/vue-analyzer.js';
import type { FunctionInfo, EntitiesResult, ConstantInfo } from '../../../types.js';
// ✅ A4.2.11j: idManager убран — не используется после A4.2.11f
import { createEmptyEntitiesResult } from '../helpers/create-empty-result.js';
import { classifyVueKind } from '../helpers/classify-vue-kind.js';
import { convertVueImportsToImportInfo } from './convert-imports.js';

// ============================================================
// ✅ v18.2.0 (ENTERPRISE): helper — парсинг reads/writes
// ============================================================

/**
 * Извлекает reads[]/writes[] для reactivity из scriptContent.
 */
function extractReadsWrites(
  scriptContent: string,
  reactivityName: string,
  kind: string
): { reads: string[]; writes: string[] } {
  const reads = new Set<string>();
  const writes = new Set<string>();

  if (!scriptContent || !reactivityName) {
    return { reads: [], writes: [] };
  }

  const escaped = reactivityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (
    kind === 'ref' ||
    kind === 'computed' ||
    kind === 'shallowRef' ||
    kind === 'toRef' ||
    kind === 'toRefs'
  ) {
    const assignRe = new RegExp(`\\b${escaped}\\.value\\s*(=[^=]|\\+=|-=|\\*=|/=|\\+\\+|--)`, 'g');
    if (assignRe.test(scriptContent)) {
      writes.add(reactivityName);
    }

    const mutateRe = new RegExp(
      `\\b${escaped}\\.value\\.(push|pop|shift|unshift|splice|sort|reverse)\\s*\\(`,
      'g'
    );
    if (mutateRe.test(scriptContent)) {
      writes.add(reactivityName);
    }

    const readRe = new RegExp(`\\b${escaped}\\.value\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = readRe.exec(scriptContent)) !== null) {
      const afterIdx = m.index + m[0].length;
      const rest = scriptContent.slice(afterIdx, afterIdx + 20);

      if (/^\s*(=[^=]|\+=|-=|\*=|\/=|\+\+|--)/.test(rest)) continue;
      if (/^\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/.test(rest)) continue;

      reads.add(reactivityName);
      break;
    }
  } else if (kind === 'reactive' || kind === 'readonly') {
    const assignRe = new RegExp(
      `\\b${escaped}\\.[A-Za-z_$][\\w$]*\\s*(=[^=]|\\+=|-=|\\*=|/=|\\+\\+|--)`,
      'g'
    );
    if (assignRe.test(scriptContent)) {
      writes.add(reactivityName);
    }

    const readRe = new RegExp(`\\b${escaped}\\.[A-Za-z_$][\\w$]*\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = readRe.exec(scriptContent)) !== null) {
      const afterIdx = m.index + m[0].length;
      const rest = scriptContent.slice(afterIdx, afterIdx + 20);

      if (/^\s*(=[^=]|\+=|-=|\*=|\/=|\+\+|--)/.test(rest)) continue;
      if (/^\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/.test(rest)) {
        writes.add(reactivityName);
        continue;
      }

      reads.add(reactivityName);
      break;
    }
  }

  return {
    reads: Array.from(reads),
    writes: Array.from(writes),
  };
}

/**
 * ✅ v18.2.5: извлекает реальное тело функции из scriptContent.
 *
 * ⚠️ ПРИЧИНА: vueAnalysis.functions[].body содержит заглушку
 *    `{ N statements }` (для компактности). Реальное тело можно
 *    получить из scriptContent по fn.line + балансировке скобок.
 *
 * 🐛 ИСПРАВЛЕНО v18.2.4:
 *   Тело извлекалось неправильно: braceIdx указывал на первую `{`
 *   ПОСЛЕ начала заголовка. Теперь ищем `{` ПОСЛЕ `=>` для arrow.
 *
 * 🐛 ИСПРАВЛЕНО v18.2.5:
 *   Добавлены кандидаты для поиска заголовка функции:
 *   fnLine - 1 (0-based), fnLine (1-based), fnLine - 2, fnLine + 1.
 *   Это покрывает разные варианты нумерации строк.
 */
function extractFunctionBodyFromScript(
  scriptContent: string,
  fnName: string,
  fnLine: number
): string {
  if (!scriptContent || fnLine <= 0 || !fnName) return '';

  const lines = scriptContent.split('\n');
  const escaped = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const nameRe = new RegExp(
    `\\b(?:const|let|var|function)\\s+${escaped}\\b|\\b${escaped}\\s*[:=]|\\b${escaped}\\s*\\(`
  );

  // ✅ A4.13-fix3: расширен диапазон.
  //   fn.line из AST может быть сдвинут на +2..+3 относительно
  //   реального header (из-за макросов/import в начале).
  const candidates = [fnLine - 1, fnLine, fnLine - 2, fnLine - 3, fnLine - 4, fnLine + 1];

  for (const idx of candidates) {
    if (idx < 0 || idx >= lines.length) continue;

    const headerLine = lines[idx];
    if (!headerLine) continue;
    if (!nameRe.test(headerLine)) continue;

    const startCharIdx = lines.slice(0, idx).join('\n').length + (idx > 0 ? 1 : 0);
    // ✅ A4.13-fix3: два tail.
    //   headerTail = ОДНА строка (для expression body / ref(...)),
    //   fullTail   = до конца файла (для brace body `{ ... }`).
    const headerLineEnd = startCharIdx + headerLine.length;
    const headerTail = scriptContent.slice(startCharIdx, headerLineEnd);
    const fullTail = scriptContent.slice(startCharIdx);

    const arrowIdx = headerTail.indexOf('=>');
    let bodyStart = -1;

    if (arrowIdx >= 0) {
      const afterArrow = headerTail.slice(arrowIdx + 2);
      const trimmedAfterArrow = afterArrow.replace(/^\s+/, '');
      const leadingWs = afterArrow.length - trimmedAfterArrow.length;

      if (trimmedAfterArrow.startsWith('{')) {
        // ✅ A4.13-fix3: brace body — используем fullTail
        bodyStart = arrowIdx + 2 + leadingWs;
        // Переключаемся на fullTail для brace-balance
        // (переменная `tail` ниже используется в braceBalance)
        // → сделаем это ниже через аргумент
      } else {
        // ✅ A4.13 FIX: expression body.
        //   depth начинается с 1 — мы уже внутри внешней скобки
        //   (например, computed(...) или ref(...)), которая закрывается
        //   первой ')' в afterArrow. Без этого depth уходил в -1 и
        //   балансировка захватывала весь хвост файла.
        let i = 0;
        let depth = 1;
        let inString: string | null = null;

        while (i < trimmedAfterArrow.length) {
          const c = trimmedAfterArrow[i];

          if (inString) {
            if (c === '\\') {
              i += 2;
              continue;
            }
            if (c === inString) inString = null;
            i++;
            continue;
          }
          if (c === '"' || c === "'" || c === '`') {
            inString = c;
            i++;
            continue;
          }
          if (c === '(' || c === '[' || c === '{') depth++;
          if ((c === ')' || c === ']' || c === '}') && depth > 0) depth--;
          if ((c === ';' || c === '\n') && depth === 0) break;

          i++;
        }

        // ✅ A4.13-fix2: убираем ЗАКРЫВАЮЩУЮ ) внешней функции
        //   (она уже отбалансирована в depth, но попала в slice)
        return trimmedAfterArrow.slice(0, i).trim().replace(/\)$/, '');
      }
    }

    if (bodyStart < 0) {
      // ✅ A4.13-fix5: используем fullTail (до конца файла),
      //   т.к. `{` может быть на следующей строке после header
      const closeParenIdx = fullTail.indexOf(')');
      const braceSearchStart = closeParenIdx >= 0 ? closeParenIdx : 0;
      const braceIdx = fullTail.indexOf('{', braceSearchStart);

      if (braceIdx < 0) continue;
      if (braceIdx > 300) continue;

      bodyStart = braceIdx;
    }

    let depth = 1;
    let i = bodyStart + 1;
    let inString: string | null = null;
    let inComment: '//' | '/*' | null = null;

    // ✅ A4.13-fix3: используем fullTail (до конца файла) для brace-balance
    const braceTail = fullTail;
    while (i < braceTail.length && depth > 0) {
      const c = braceTail[i];
      const c2 = braceTail[i + 1];

      if (inComment === '//') {
        if (c === '\n') inComment = null;
        i++;
        continue;
      }
      if (inComment === '/*') {
        if (c === '*' && c2 === '/') {
          inComment = null;
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (!inString) {
        if (c === '/' && c2 === '/') {
          inComment = '//';
          i += 2;
          continue;
        }
        if (c === '/' && c2 === '*') {
          inComment = '/*';
          i += 2;
          continue;
        }
      }
      if (inString) {
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === inString) {
          inString = null;
        }
        i++;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        inString = c;
        i++;
        continue;
      }

      if (c === '{') depth++;
      if (c === '}') depth--;
      if (depth === 0) break;

      i++;
    }

    return braceTail.slice(bodyStart + 1, i).trim();
  }

  return '';
}

/**
 * ✅ v18.2.2: извлекает "calls" из body.
 */
function extractCallsFromBody(body: string): string[] {
  const calls = new Set<string>();
  if (!body) return [];

  let m: RegExpExecArray | null;

  const mutationRe = /\b([A-Za-z_$][\w$]*)\.value\s*(=[^=]|\+=|-=|\*=|\/=|\+\+|--)/g;
  while ((m = mutationRe.exec(body)) !== null) {
    if (m[1]) calls.add(m[1]);
  }

  const mutateMethodRe =
    /\b([A-Za-z_$][\w$]*)\.value\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/g;
  while ((m = mutateMethodRe.exec(body)) !== null) {
    if (m[1]) calls.add(m[1]);
  }

  const callRe = /\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g;
  while ((m = callRe.exec(body)) !== null) {
    const name = m[1];
    if (!name) continue;
    if (
      /^(if|for|while|switch|return|typeof|new|function|in|of|catch|throw|await|async|else|do|try|finally|delete|void|yield|case|default|break|continue|with|debugger|instanceof|const|let|var)$/.test(
        name
      )
    ) {
      continue;
    }
    calls.add(name);
  }

  const readValueRe = /\b([A-Za-z_$][\w$]*)\.value\b/g;
  while ((m = readValueRe.exec(body)) !== null) {
    const name = m[1];
    if (!name) continue;

    const afterIdx = m.index + m[0].length;
    const rest = body.slice(afterIdx, afterIdx + 20);

    if (/^\s*(=[^=]|\+=|-=|\*=|\/=|\+\+|--)/.test(rest)) continue;
    if (/^\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/.test(rest)) continue;

    calls.add(name);
  }

  return Array.from(calls);
}

/**
 * Конвертер: VueAnalysis → EntitiesResult
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v18.2.5 (ENTERPRISE: computed как виртуальные функции)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ДОБАВЛЕНО: computed/ref/reactive из reactivity добавляются
 *     в templateFunctions как виртуальные функции.
 *   - 🐛 ПРИЧИНА: vueAnalysis.functions[] НЕ содержит computed/ref.
 *     Только явные функции. Но computed тоже имеют тело в
 *     scriptContent (например, `const displayText = computed(...)`)
 *     и содержат чтения других reactivity.
 *
 *     Например:
 *       const displayText = computed(() => props.displayValue ?? props.value);
 *       const highlightedParts = computed(() => splitByHighlight(displayText.value, ...));
 *
 *     Здесь displayText читается в highlightedParts. Чтобы
 *     buildVueStateFlows.readBy нашёл эту связь, нужно, чтобы
 *     highlightedParts.calls содержал 'displayText'.
 *
 *   - 🎯 ЭФФЕКТ: buildVueStateFlows.readBy заполняется.
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v18.2.4 (ENTERPRISE: правильный парсинг body)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ИСПРАВЛЕНО: extractFunctionBodyFromScript ищет `{`
 *     ПОСЛЕ `=>` (для arrow-функций) или после `)` (для
 *     regular/async-функций).
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v18.2.3 (ENTERPRISE: extractFunctionBodyFromScript)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ДОБАВЛЕНО: extractFunctionBodyFromScript.
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v18.2.2 (ENTERPRISE: reads через .value)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ДОБАВЛЕНО: extractCallsFromBody ловит ЧТЕНИЯ X.value.
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v18.2.1 (ENTERPRISE: mutations через .value)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ИСПРАВЛЕНО: extractCallsFromBody ловит мутации .value.
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v18.2.0 (ENTERPRISE: reads/writes + calls)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ДОБАВЛЕНО: extractReadsWrites, extractCallsFromBody.
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v18.0.0 (ENTERPRISE: Vue-flow data)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ДОБАВЛЕНО: проброс templateFunctions/templateReactivityInfo.
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v16.2.0 (usedInTemplate для reactivity)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ДОБАВЛЕНО: usedInTemplate для reactivity.
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ v16.0.8 (Component Usage + HTML Elements)
 * ════════════════════════════════════════════════════════════
 *
 *   - ✅ ДОБАВЛЕНО: проброс templateComponentUsages/templateHtmlElements.
 * ============================================================
 */
export function convertVueAnalysisToEntities(
  vueAnalysis: VueComponentAnalysis,
  filePath: string
): EntitiesResult {
  const result = createEmptyEntitiesResult(filePath);
  const componentName = vueAnalysis.componentName || path.basename(filePath, '.vue');

  // ==========================================
  // 0. ✅ ПРОБРОС ВСЕХ TEMPLATE-ПОЛЕЙ
  // ==========================================
  const template = vueAnalysis.template;

  const templateReactivityDeps: string[] = template?.reactivityDeps || [];
  (result as any).templateReactivityDeps = templateReactivityDeps;

  (result as any).templateEventHandlers = template?.eventHandlers || [];
  (result as any).templateDynamicComponents = template?.dynamicComponents || [];

  (result as any).templateRefs = template?.templateRefs || [];

  (result as any).templateCssVariables = template?.cssVariables || [];
  (result as any).templateDeepSelectors = template?.deepSelectors || [];
  (result as any).templateDirectives = template?.directives || [];
  (result as any).templateUsedComponents =
    template?.usedComponents?.map((c: { name: string }) => c.name) || [];
  (result as any).templateSlots = template?.slots || [];
  (result as any).templateComplexity = template?.complexity || 0;

  // ==========================================
  // 0.1 ✅ УСЛОВНЫЙ РЕНДЕРИНГ
  // ==========================================
  (result as any).templateConditionals = template?.conditionals || [];

  // ==========================================
  // 0.2 ✅ РАСШИРЕННЫЕ СЕКЦИИ
  // ==========================================
  (result as any).templateLifecycle = vueAnalysis.lifecycle || [];
  (result as any).templateEffects = vueAnalysis.effects || [];
  (result as any).templateInjections = vueAnalysis.injections || [];

  const depsSet = new Set(templateReactivityDeps);
  (result as any).templateReactivity = (vueAnalysis.reactivity || []).map(rx => ({
    ...rx,
    usedInTemplate: rx.name ? depsSet.has(rx.name) : false,
  }));

  // ==========================================
  // 0.3 ✅ Component Usage + HTML Elements
  // ==========================================
  (result as any).templateComponentUsages = vueAnalysis.componentUsages ?? [];
  (result as any).templateHtmlElements = vueAnalysis.htmlElements ?? [];

  // ==========================================
  // 0.4 ✅ v18.0.0 (ENTERPRISE): VUE-FLOW DATA
  // ==========================================

  const scriptContentForFlow = vueAnalysis.script.content || '';

  // 0.4.1 ✅ v18.2.5: Явные функции + computed/ref/reactive
  //          как виртуальные функции.
  //
  // ⚠️ ПРИЧИНА: vueAnalysis.functions[] содержит ТОЛЬКО явные
  //    функции (const X = () => ...). Computed/ref/reactive
  //    в него не попадают. Но они имеют тело в scriptContent
  //    и содержат чтения других reactivity.
  //
  //    Пример:
  //      const displayText = computed(() => props.displayValue ?? props.value);
  //      const highlightedParts = computed(() => splitByHighlight(displayText.value, ...));
  //
  //    Здесь displayText читается в highlightedParts. Чтобы
  //    buildVueStateFlows.readBy нашёл эту связь, нужно, чтобы
  //    highlightedParts.calls содержал 'displayText'.
  const explicitFunctions = (vueAnalysis.functions || []).map((fn: any) => {
    // FE-34-FIX: передаём isNested — симметрично extract-entities-from-ast.ts
    const vueKind = classifyVueKind(fn.name, fn.isArrow ?? false, fn.parentType, fn.isNested);
    let calls = fn.calls ?? [];
    let body = fn.body ?? '';

    const isPlaceholder = !body || /\{\s*\d+\s+statements\s*\}/.test(body);

    if (isPlaceholder && scriptContentForFlow) {
      const realBody = extractFunctionBodyFromScript(scriptContentForFlow, fn.name, fn.line);
      if (realBody) {
        body = realBody;
      }
    }

    if (calls.length === 0 && body && !/\{\s*\d+\s+statements\s*\}/.test(body)) {
      calls = extractCallsFromBody(body);
    }

    return {
      name: fn.name,
      vueKind,
      line: fn.line,
      isAsync: fn.isAsync ?? false,
      isExported: fn.isExported ?? false,
      params: fn.params ?? [],
      returnType: fn.returnType,
      body,
      calls,
      calledBy: fn.calledBy ?? [],
      isExposed: fn.isExposed,
    };
  });

  // ✅ v18.2.5: computed/ref/reactive из reactivity — как виртуальные функции.
  const explicitNames = new Set(explicitFunctions.map(f => f.name));

  const computedFunctions = (vueAnalysis.reactivity || [])
    .filter((rx: any) => rx.name && !explicitNames.has(rx.name))
    .map((rx: any) => {
      const realBody = scriptContentForFlow
        ? extractFunctionBodyFromScript(scriptContentForFlow, rx.name, rx.line)
        : '';
      const calls = realBody ? extractCallsFromBody(realBody) : [];

      return {
        name: rx.name,
        line: rx.line,
        isAsync: false,
        isExported: false,
        params: [],
        returnType: undefined,
        body: realBody,
        calls,
        calledBy: [],
        isExposed: false,
        isReactivity: true,
      };
    });

  (result as any).templateFunctions = [...explicitFunctions, ...computedFunctions];

  // 0.4.2 Reactivity с reads/writes
  (result as any).templateReactivityInfo = (vueAnalysis.reactivity || []).map((rx: any) => {
    let reads = rx.reads ?? [];
    let writes = rx.writes ?? [];

    if (reads.length === 0 && writes.length === 0 && rx.name && scriptContentForFlow) {
      const parsed = extractReadsWrites(scriptContentForFlow, rx.name, rx.kind);
      reads = parsed.reads;
      writes = parsed.writes;
    }

    return {
      kind: rx.kind,
      line: rx.line,
      functionName: rx.functionName,
      reads,
      writes,
      isWriteable: rx.isWriteable ?? false,
      name: rx.name,
    };
  });

  // ==========================================
  // 1. PROPS → ИНТЕРФЕЙСЫ + ТИПЫ
  // ==========================================
  if (vueAnalysis.props.names.length > 0) {
    result.interfaces.push({
      name: `${componentName}Props`,
      line: 0,
      isExported: true,
      properties: vueAnalysis.props.names,
      startLine: 0,
      endLine: 0,
    });

    for (const name of vueAnalysis.props.names) {
      const typeName = name.charAt(0).toUpperCase() + name.slice(1);
      result.types.push({
        name: `${componentName}${typeName}Prop`,
        line: 0,
        isExported: true,
        definition: vueAnalysis.props.types[name] || 'any',
      });
    }
  }

  // ==========================================
  // 2. EMITS → ТИПЫ
  // ==========================================
  if (vueAnalysis.emits.names.length > 0) {
    const emitDefs = vueAnalysis.emits.names
      .map((n: string) => `${n}: (...args: any[]) => void`)
      .join('; ');
    result.types.push({
      name: `${componentName}Emits`,
      line: 0,
      isExported: true,
      definition: `{ ${emitDefs} }`,
    });
  }

  // ==========================================
  // 3. COMPOSABLES → ФУНКЦИИ
  // ==========================================
  for (const comp of vueAnalysis.composables) {
    // ✅ A4.2.11f FIX: composables НЕ кладём в functions[]
    //    (раньше push в functions[] давал мусор: ref, computed, useXxx
    //     с line=0, body='', что ломало buildVueStateFlows).
    //    Composable-инфа уже в vueAnalysis.composables и пробрасывается
    //    отдельными секциями (vue.composables в codec).
    //    Здесь — намеренный no-op, чтобы сохранить структуру цикла.
    void comp;
}

  // ==========================================
  // 4. SLOTS → ЭКСПОРТЫ
  // ==========================================
  for (const slot of vueAnalysis.slots) {
    result.exports.push({
      name: slot,
      type: 'value',
      isDefault: false,
      loc: null,
    });
  }

  // ==========================================
  // 5. CONSTANTS ИЗ СКРИПТА
  // ==========================================
  const scriptContent = vueAnalysis.script.content || '';
  if (scriptContent) {
    const constRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*([^;]+);/g;
    let match;
    while ((match = constRegex.exec(scriptContent)) !== null) {
      const name = match[1];
      const value = match[2]?.trim() || '';
      if (name && !result.constants.find((c: ConstantInfo) => c.name === name)) {
        result.constants.push({
          name: name,
          line: 0,
          value: value,
          isExported: scriptContent.includes(`export const ${name}`),
          type: 'unknown',
        });
      }
    }

    const macroRegex =
      /(?:const\s+)?(defineProps|defineEmits|defineExpose|withDefaults)\s*<[^>]*>\s*\(/g;
    while ((match = macroRegex.exec(scriptContent)) !== null) {
      const name = match[1];
      if (name && !result.constants.find((c: ConstantInfo) => c.name === name)) {
        result.constants.push({
          name: name,
          line: 0,
          value: `Vue macro: ${name}`,
          isExported: true,
          type: 'macro',
        });
      }
    }
  }

  // ==========================================
  // 6. АНАЛИЗ ВЫЗОВОВ МЕЖДУ COMPOSABLES
  // ==========================================
  const allComposableNames = vueAnalysis.composables.map((c: { name: string }) => c.name);
  if (allComposableNames.length > 1 && scriptContent) {
    const pattern = new RegExp(`\\b(${allComposableNames.join('|')})\\s*\\(`, 'g');
    let callMatch;
    while ((callMatch = pattern.exec(scriptContent)) !== null) {
      const caller = callMatch[1];
      if (caller) {
        const calls: string[] = [];
        const innerPattern = new RegExp(`\\b(${allComposableNames.join('|')})\\s*\\(`, 'g');
        let innerMatch;
        while (
          (innerMatch = innerPattern.exec(scriptContent.substring(callMatch.index))) !== null
        ) {
          const called = innerMatch[1];
          if (called && called !== caller && !calls.includes(called)) {
            calls.push(called);
          }
        }
        if (calls.length > 0) {
          result.callGraph[caller] = calls;
          const func = result.functions.find((f: FunctionInfo) => f.name === caller);
          if (func) {
            func.calls = calls;
          }
        }
      }
    }
  }

  // ==========================================
  // 7. АНАЛИЗ ВЫЗОВОВ ВНУТРИ ФУНКЦИЙ
  // ==========================================
  for (const func of result.functions) {
    const funcName = func.name;
    if (!funcName) continue;

    const calls: string[] = [];
    const funcBody = func.body || '';

    const callPatterns = [
      /\b(\w+)\s*\(/g,
      /\b(\w+)\.(\w+)\s*\(/g,
      /emit\(['"]([^'"]+)['"]\)/g,
      /\b(use\w+)\s*\(/g,
    ];

    for (const pattern of callPatterns) {
      let match;
      while ((match = pattern.exec(funcBody)) !== null) {
        const callName = match[1] || match[2];
        if (callName && callName !== funcName && !calls.includes(callName)) {
          calls.push(callName);
        }
      }
    }

    func.calls = calls;
    result.callGraph[funcName] = calls;
  }

  // ==========================================
  // 8. ПОСТРОЕНИЕ calledBy
  // ==========================================
  for (const func of result.functions) {
    const funcName = func.name;
    if (!funcName) continue;

    func.calledBy = [];
    for (const otherFunc of result.functions) {
      if (otherFunc.calls && otherFunc.calls.includes(funcName)) {
        if (!func.calledBy.includes(otherFunc.name)) {
          func.calledBy.push(otherFunc.name);
        }
      }
    }
  }

  // ==========================================
  // 9. ИМПОРТЫ ИЗ VUE
  // ==========================================
  if (vueAnalysis.imports && vueAnalysis.imports.length > 0) {
    result.imports = convertVueImportsToImportInfo(vueAnalysis.imports);
  }

  // ==========================================
  // 10. ЛОГИРОВАНИЕ ИТОГОВОЙ СТАТИСТИКИ
  // ==========================================
  console.log(
    `   🎯 Vue-анализ: ${result.functions.length} функций, ${result.constants.length} констант, ${result.imports.length} импортов`
  );

  if (templateReactivityDeps.length > 0) {
    console.log(
      `   ⚡ Reactivity deps (${templateReactivityDeps.length}): ${templateReactivityDeps.slice(0, 5).join(', ')}${
        templateReactivityDeps.length > 5 ? '...' : ''
      }`
    );
  }

  const eventHandlersCount = template?.eventHandlers?.length || 0;
  const dynamicComponentsCount = template?.dynamicComponents?.length || 0;
  const cssVariablesCount = template?.cssVariables?.length || 0;
  const deepSelectorsCount = template?.deepSelectors?.length || 0;
  const usedComponentsCount = template?.usedComponents?.length || 0;
  const templateRefsCount = template?.templateRefs?.length || 0;

  if (
    eventHandlersCount +
      dynamicComponentsCount +
      cssVariablesCount +
      deepSelectorsCount +
      usedComponentsCount +
      templateRefsCount >
    0
  ) {
    console.log(`   🎨 Template-секции Vue:`);
    if (eventHandlersCount) console.log(`      • eventHandlers: ${eventHandlersCount}`);
    if (dynamicComponentsCount) console.log(`      • dynamicComponents: ${dynamicComponentsCount}`);
    if (cssVariablesCount) console.log(`      • cssVariables: ${cssVariablesCount}`);
    if (deepSelectorsCount) console.log(`      • deepSelectors: ${deepSelectorsCount}`);
    if (usedComponentsCount) console.log(`      • usedComponents: ${usedComponentsCount}`);
    if (templateRefsCount) console.log(`      • templateRefs: ${templateRefsCount}`);
  }

  const lifecycleCount = vueAnalysis.lifecycle?.length || 0;
  const effectsCount = vueAnalysis.effects?.length || 0;
  const injectionsCount = vueAnalysis.injections?.length || 0;
  const reactivityCount = vueAnalysis.reactivity?.length || 0;
  const conditionalsCount = template?.conditionals?.length || 0;

  if (lifecycleCount + effectsCount + injectionsCount + reactivityCount + conditionalsCount > 0) {
    console.log(`   🔬 Расширенные секции Vue (v9.0.0):`);
    if (lifecycleCount) console.log(`      • lifecycle: ${lifecycleCount}`);
    if (effectsCount) console.log(`      • effects: ${effectsCount}`);
    if (injectionsCount) console.log(`      • injections: ${injectionsCount}`);
    if (reactivityCount) {
      const usedInTemplateCount = ((result as any).templateReactivity || []).filter(
        (rx: any) => rx.usedInTemplate === true
      ).length;
      console.log(`      • reactivity: ${reactivityCount} (в template: ${usedInTemplateCount})`);
    }
    if (conditionalsCount) console.log(`      • conditionals: ${conditionalsCount}`);
  }

  const componentUsagesCount = vueAnalysis.componentUsages?.length ?? 0;
  const htmlElementsCount = vueAnalysis.htmlElements?.length ?? 0;

  if (componentUsagesCount + htmlElementsCount > 0) {
    console.log(`   🌐 Component Usage (v16.0.8):`);
    if (componentUsagesCount) console.log(`      • componentUsages: ${componentUsagesCount}`);
    if (htmlElementsCount) console.log(`      • htmlElements: ${htmlElementsCount}`);
  }

  const flowFunctionsCount = (result as any).templateFunctions?.length ?? 0;
  const flowReactivityInfoCount = (result as any).templateReactivityInfo?.length ?? 0;

  if (flowFunctionsCount + flowReactivityInfoCount > 0) {
    console.log(`   🔗 Vue-flow data (v18.0.0):`);
    if (flowFunctionsCount) console.log(`      • templateFunctions: ${flowFunctionsCount}`);
    if (flowReactivityInfoCount)
      console.log(`      • templateReactivityInfo: ${flowReactivityInfoCount}`);
  }

  return result;
}
