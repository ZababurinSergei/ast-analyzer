// src/modes/vue-analyzer/flows/fn-html-usage.ts
// ============================================================
// BUILD VUE FN HTML USAGE
// ============================================================
// Версия: 1.0.0
//
// Обратный индекс: функция → HTML-элементы, где она используется.
//
// Симметрично `buildFnJsxUsage` из React (react-analyzer/flows/fn-jsx-usage.ts).
//
// ════════════════════════════════════════════════════════════
// ИСТОЧНИКИ ДАННЫХ
// ════════════════════════════════════════════════════════════
//
//   1. vue.componentEvents[]         — @click="onClick" → handler
//   2. vue.componentProps[]          — props с identifier = имя функции
//   3. vue.htmlInterpolations[]      — {{ fn() }} или {{ fn }}
//   4. vue.sfc[].htmlElements[].events[]  — @click на HTML-элементах
//   5. vue.sfc[].htmlElements[].interpolations[] — {{ ... }}
//   6. functions[]                    — для поиска функции по имени
//
// ════════════════════════════════════════════════════════════
// АЛГОРИТМ
// ════════════════════════════════════════════════════════════
//
//   1. Собрать все «ссылки на функции» в HTML:
//      • componentEvents[].handler        → usage='handler'
//      • componentProps[].identifier      → usage='value' (если identifier — функция)
//      • htmlInterpolations[].expression  → usage='value' (если содержит имя функции)
//      • htmlElements[].events[].handler  → usage='handler'
//      • htmlElements[].interpolations[].expression → usage='value'
//
//   2. Сгруппировать по functionId.
//
//   3. Вернуть VueFnHtmlUsage[].
//
// ============================================================

import type { VueFnHtmlUsage } from '../types.js';
import type { FunctionLike } from './state-flows.js';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

/**
 * Минимальная форма componentEvent.
 */
export interface ComponentEventLike {
  id: string;
  usageId: string;
  eventName: string;
  handler: string;
  line: number;
}

/**
 * Минимальная форма componentProp.
 */
export interface ComponentPropLike {
  id: string;
  usageId: string;
  name: string;
  value: string;
  identifier?: string | null;
  line: number;
}

/**
 * Минимальная форма htmlInterpolation.
 */
export interface HtmlInterpolationLike {
  id: string;
  usageId: string;
  expression: string;
  line: number;
}

/**
 * Минимальная форма SFC с htmlElements.
 */
export interface SfcWithHtmlLike {
  fileId: string;
  htmlElements?: Array<{
    id: string;
    events?: Array<{
      id: string;
      usageId: string;
      eventName: string;
      handler: string;
      line: number;
    }>;
    interpolations?: Array<{
      id: string;
      usageId: string;
      expression: string;
      line: number;
    }>;
  }>;
}

/**
 * Минимальная форма VueSectionFull (только нужные поля).
 */
export interface VueSectionLike {
  componentEvents?: ComponentEventLike[];
  componentProps?: ComponentPropLike[];
  htmlInterpolations?: HtmlInterpolationLike[];
  sfc?: SfcWithHtmlLike[];
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит VueFnHtmlUsage[] — обратный индекс функция → HTML.
 *
 * @param vue           — Vue-секция (componentEvents + componentProps + htmlInterpolations + sfc)
 * @param allFunctions  — все функции (для поиска по имени)
 *
 * @returns VueFnHtmlUsage[]
 */
export function buildVueFnHtmlUsage(
  vue: VueSectionLike,
  allFunctions: FunctionLike[]
): VueFnHtmlUsage[] {
  // ────────────────────────────────────────────────────────
  // 1. Индекс функций по имени
  // ────────────────────────────────────────────────────────

  const fnByName = new Map<string, FunctionLike>();
  for (const fn of allFunctions) {
    if (!fnByName.has(fn.name)) {
      fnByName.set(fn.name, fn);
    }
  }

  // ────────────────────────────────────────────────────────
  // 2. Аккумулятор: functionId → usedIn[]
  // ────────────────────────────────────────────────────────

  const byFn = new Map<string, VueFnHtmlUsage['usedIn']>();

  const addUsage = (
    functionId: string,
    htmlElementId: string,
    usage: 'handler' | 'value' | 'condition' | 'render',
    line: number
  ): void => {
    if (!byFn.has(functionId)) byFn.set(functionId, []);
    byFn.get(functionId)!.push({ htmlElementId, usage, line });
  };

  // ────────────────────────────────────────────────────────
  // 3. componentEvents → handler
  // ────────────────────────────────────────────────────────

  for (const ev of vue.componentEvents ?? []) {
    const fnName = extractFunctionName(ev.handler);
    if (!fnName) continue;

    const fn = fnByName.get(fnName);
    if (!fn) continue;

    addUsage(fn.id, ev.usageId, 'handler', ev.line);
  }

  // ────────────────────────────────────────────────────────
  // 4. componentProps → value (если identifier — функция)
  // ────────────────────────────────────────────────────────

  for (const p of vue.componentProps ?? []) {
    if (!p.identifier) continue;

    const fn = fnByName.get(p.identifier);
    if (!fn) continue;

    addUsage(fn.id, p.usageId, 'value', p.line);
  }

  // ────────────────────────────────────────────────────────
  // 5. htmlInterpolations → value
  // ────────────────────────────────────────────────────────

  for (const interp of vue.htmlInterpolations ?? []) {
    const fnNames = extractFunctionNamesFromExpression(interp.expression);
    for (const fnName of fnNames) {
      const fn = fnByName.get(fnName);
      if (!fn) continue;
      addUsage(fn.id, interp.usageId, 'value', interp.line);
    }
  }

  // ────────────────────────────────────────────────────────
  // 6. sfc[].htmlElements[].events[] → handler
  // ────────────────────────────────────────────────────────

  for (const sfc of vue.sfc ?? []) {
    for (const he of sfc.htmlElements ?? []) {
      // 6a. Events
      for (const ev of he.events ?? []) {
        const fnName = extractFunctionName(ev.handler);
        if (!fnName) continue;

        const fn = fnByName.get(fnName);
        if (!fn) continue;

        addUsage(fn.id, he.id, 'handler', ev.line);
      }

      // 6b. Interpolations
      for (const interp of he.interpolations ?? []) {
        const fnNames = extractFunctionNamesFromExpression(interp.expression);
        for (const fnName of fnNames) {
          const fn = fnByName.get(fnName);
          if (!fn) continue;
          addUsage(fn.id, he.id, 'value', interp.line);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // 7. Собираем результат
  // ────────────────────────────────────────────────────────

  const result: VueFnHtmlUsage[] = [];

  for (const [functionId, usedIn] of byFn) {
    const fn = allFunctions.find(f => f.id === functionId);
    result.push({
      functionId,
      functionName: fn?.name ?? '',
      usedIn,
    });
  }

  return result;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Извлекает имя функции из сырой строки handler.
 *
 * Примеры:
 *   "onClick"                             → "onClick"
 *   "onClick()"                           → "onClick"
 *   "showMessage(button.actionName)"      → "showMessage"
 *   "() => store.autoSelectHardware($t)"  → "store.autoSelectHardware"
 *   "showPassword = !showPassword"        → null (inline mutation — не функция)
 *   "bleStore.connect(t)"                 → "bleStore.connect"
 *   "close"                               → "close"
 *   "handleContextMenuSelect"             → "handleContextMenuSelect"
 *   "disconnect()"                        → "disconnect"
 *
 * Возвращает null, если это не вызов функции (inline mutation).
 */
function extractFunctionName(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Inline mutation: `X = ...` (но не `==`, `===`, `=>`)
  if (/^[A-Za-z_$][\w$.]*\s*=(?!=|>)\s*.+$/.test(trimmed)) {
    return null;
  }

  // 2. Arrow function: `() => ...`
  const arrowMatch = trimmed.match(/^(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>\s*(.+)$/);
  if (arrowMatch && arrowMatch[1]) {
    return extractFunctionName(arrowMatch[1]);
  }

  // 3. Просто вызов: `foo()`, `foo.bar(baz)`
  const callMatch = trimmed.match(/^([A-Za-z_$][\w$.]*)\s*\(/);
  if (callMatch && callMatch[1]) {
    return callMatch[1];
  }

  // 4. Просто имя: `onClick`, `handleClick`
  const nameMatch = trimmed.match(/^([A-Za-z_$][\w$.]*)$/);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1];
  }

  return null;
}

/**
 * Извлекает имена функций из выражения ({{ fn() }}, {{ fn }}, {{ a + fn(b) }}).
 *
 * Возвращает только те имена, которые похожи на вызовы функций.
 * Для простого идентификатора ({{ text }}) — вернёт ['text'].
 */
function extractFunctionNamesFromExpression(expr: string): string[] {
  if (!expr || typeof expr !== 'string') return [];

  const result = new Set<string>();

  // Простой regex по вызовам функций: name(
  const callRegex = /\b([A-Za-z_$][\w$.]*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = callRegex.exec(expr)) !== null) {
    const name = match[1];
    if (name) result.add(name);
  }

  // Если нет вызовов — берём простой идентификатор ({{ text }})
  if (result.size === 0) {
    const idMatch = expr.trim().match(/^([A-Za-z_$][\w$.]*)$/);
    if (idMatch && idMatch[1]) {
      result.add(idMatch[1]);
    }
  }

  return Array.from(result);
}
