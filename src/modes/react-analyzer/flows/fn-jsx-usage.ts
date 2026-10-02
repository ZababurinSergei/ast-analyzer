// src/modes/react-analyzer/flows/fn-jsx-usage.ts
// ============================================================
// BUILD FN JSX USAGE
// ============================================================
// Версия: 1.0.0
//
// Обратный индекс: функция → JSX-элементы, где она используется.
//   handler  — если функция handler события
//   value    — если её имя в jsxElements.expressionRefs
// ============================================================

import type {
  ReactFnJsxUsage,
  JsxEventEntity,
  JsxElementEntity,
} from '../../../core/react-entity-classifier.js';
import type { FunctionLike } from './state-flows.js';

export function buildFnJsxUsage(
  jsxEvents: JsxEventEntity[],
  jsxElements: JsxElementEntity[],
  allFunctions?: FunctionLike[]
): ReactFnJsxUsage[] {
  const functions = allFunctions ?? [];
  const byFn = new Map<string, ReactFnJsxUsage['usedIn']>();

  // 1. Handlers событий
  for (const ev of jsxEvents) {
    if (!ev.handlerFunctionId) continue;
    if (!byFn.has(ev.handlerFunctionId)) byFn.set(ev.handlerFunctionId, []);
    byFn.get(ev.handlerFunctionId)!.push({
      jsxElementId: ev.elementId,
      usage: 'handler',
      line: ev.line,
    });
  }

  // 2. Значения в JSX (expressionRefs)
  for (const el of jsxElements) {
    for (const ref of el.expressionRefs ?? []) {
      const fn = functions.find(f => f.name === ref);
      if (!fn) continue;
      if (!byFn.has(fn.id)) byFn.set(fn.id, []);
      byFn.get(fn.id)!.push({
        jsxElementId: el.id,
        usage: 'value',
        line: el.line,
      });
    }
  }

  const result: ReactFnJsxUsage[] = [];
  for (const [functionId, usedIn] of byFn) {
    const fn = functions.find(f => f.id === functionId);
    result.push({
      functionId,
      functionName: fn?.name ?? '',
      usedIn,
    });
  }

  return result;
}
