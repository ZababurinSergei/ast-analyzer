// src/modes/react-analyzer/flows/event-flows.ts
// ============================================================
// BUILD EVENT FLOWS
// ============================================================
// Версия: 1.0.0
//
// Для каждого jsxEvent строит цепочку:
//   event → handler → calls → mutatedStates → reRendered
//
// chain — плоский список шагов (event / handler / call / state / render).
// ============================================================

import type {
  ReactEventFlow,
  EventFlowStep,
  JsxEventEntity,
  ReactHookEntity,
  ReactComponentEntity,
} from '../../../core/react-entity-classifier.js';
import type { FunctionLike } from './state-flows.js';

export function buildEventFlows(
  jsxEvents: JsxEventEntity[],
  hooks: ReactHookEntity[],
  components: ReactComponentEntity[],
  allFunctions?: FunctionLike[]
): ReactEventFlow[] {
  const flows: ReactEventFlow[] = [];
  const functions = allFunctions ?? [];

  // Индекс функций по имени
  const fnByName = new Map<string, FunctionLike>();
  for (const fn of functions) {
    if (!fnByName.has(fn.name)) fnByName.set(fn.name, fn);
  }

  // Индекс hooks по setterName
  const hookBySetter = new Map<string, ReactHookEntity>();
  for (const h of hooks) {
    if (h.setterName) hookBySetter.set(h.setterName, h);
  }

  for (let i = 0; i < jsxEvents.length; i++) {
    const ev = jsxEvents[i]!;

    // ─── Найти handler ───
    const handler = ev.handlerFunctionId
      ? functions.find(f => f.id === ev.handlerFunctionId)
      : fnByName.get(ev.handler);

    // ─── calls ───
    const calls: ReactEventFlow['calls'] = [];
    const mutatedStates: string[] = [];

    if (handler) {
      for (const call of handler.calls ?? []) {
        calls.push({
          functionId: call.id ?? `${handler.id}:${call.line}`,
          calleeName: call.callee,
          line: call.line,
        });

        const hook = hookBySetter.get(call.callee);
        if (hook) mutatedStates.push(hook.id);
      }
    }

    // ─── reRendered ───
    const reRendered: string[] = [];
    for (const comp of components) {
      if (comp.hooks.some(h => mutatedStates.includes(h))) {
        reRendered.push(comp.id);
      }
    }

    // ─── chain ───
    const chain: EventFlowStep[] = [
      {
        step: 'event',
        refId: ev.id,
        label: `${ev.eventName} on ${ev.elementId}`,
        line: ev.line,
      },
    ];

    if (handler) {
      chain.push({
        step: 'handler',
        refId: handler.id,
        label: `${handler.name}()`,
        line: handler.line ?? ev.line,
      });

      for (const call of calls) {
        chain.push({
          step: 'call',
          refId: call.functionId,
          label: `${call.calleeName}()`,
          line: call.line,
        });
      }
    }

    for (const stateId of mutatedStates) {
      const h = hooks.find(x => x.id === stateId);
      if (h) {
        chain.push({
          step: 'state',
          refId: stateId,
          label: `${h.stateName} (mutated)`,
          line: h.line,
        });
      }
    }

    flows.push({
      id: `ref${i + 1}`,
      eventId: ev.id,
      eventName: ev.eventName,
      elementId: ev.elementId,
      handlerFunctionId: handler?.id ?? '',
      handlerName: ev.handler,
      calls,
      mutatedStates,
      reRendered,
      chain,
    });
  }

  return flows;
}
