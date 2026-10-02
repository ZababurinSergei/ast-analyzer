// src/modes/react-analyzer/flows/state-flows.ts
// ============================================================
// BUILD STATE FLOWS
// ============================================================
// Версия: 1.0.0
//
// Для каждого hook с stateName/setterName строит цепочку:
//   mutatedBy  — где вызывается setterName (по calls[])
//   readBy     — где читается stateName (эвристика по calls[])
//   renderedIn — где stateName/setterName в attrs[].refs или expressionRefs
//
// Симметрично VueStateFlow.
// ============================================================

import type {
  ReactStateFlow,
  ReactHookEntity,
  JsxElementEntity,
} from '../../../core/react-entity-classifier.js';

/**
 * Минимальная форма функции для анализа calls.
 */
export interface FunctionLike {
  id: string;
  name: string;
  line?: number;
  calls?: Array<{ id?: string; callee: string; line: number }>;
}

/**
 * Строит stateFlows из hooks + jsxElements.
 *
 * @param hooks        — hooks[] из ReactEntities
 * @param jsxElements  — jsxElements[] из ReactEntities
 * @param allFunctions — все функции (для поиска calls по setterName)
 * @returns stateFlows[]
 */
export function buildStateFlows(
  hooks: ReactHookEntity[],
  jsxElements: JsxElementEntity[],
  allFunctions?: FunctionLike[]
): ReactStateFlow[] {
  const flows: ReactStateFlow[] = [];
  const functions = allFunctions ?? [];

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i]!;
    if (!hook.stateName || !hook.setterName) continue;

    const stateName = hook.stateName;
    const setterName = hook.setterName;

    // ─── mutatedBy ───
    const mutatedBy: ReactStateFlow['mutatedBy'] = [];
    for (const fn of functions) {
      for (const call of fn.calls ?? []) {
        if (call.callee === setterName) {
          mutatedBy.push({
            functionId: fn.id,
            callId: call.id ?? `${fn.id}:${call.line}`,
            line: call.line,
          });
        }
      }
    }

    // ─── readBy ───
    const readBy: ReactStateFlow['readBy'] = [];
    const mutatedFnIds = new Set(mutatedBy.map(m => m.functionId));
    for (const fn of functions) {
      if (mutatedFnIds.has(fn.id)) continue;
      for (const call of fn.calls ?? []) {
        if (call.callee === stateName) {
          readBy.push({ functionId: fn.id, line: call.line });
          break;
        }
      }
    }

    // ─── renderedIn ───
    const renderedIn: ReactStateFlow['renderedIn'] = [];
    for (const el of jsxElements) {
      // Проверяем attrs
      for (const attr of el.attrs ?? []) {
        const refs = attr.refs ?? [];
        if (refs.includes(stateName) || refs.includes(setterName)) {
          renderedIn.push({
            jsxElementId: el.id,
            attrName: attr.name,
            kind: attr.name.startsWith('on') ? 'handler' : 'attr',
            line: el.line,
          });
        }
      }
      // Проверяем expressionRefs
      if (el.expressionRefs?.includes(stateName)) {
        renderedIn.push({
          jsxElementId: el.id,
          attrName: '<expression>',
          kind: 'text',
          line: el.line,
        });
      }
    }

    flows.push({
      id: `rsf${i + 1}`,
      hookId: hook.id,
      stateName,
      setterName,
      mutatedBy,
      readBy,
      renderedIn,
    });
  }

  return flows;
}
