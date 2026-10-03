// src/modes/vue-analyzer/flows/event-flows.ts
// ============================================================
// BUILD VUE EVENT FLOWS
// ============================================================
// Версия: 1.0.0
//
// Для каждого `componentEvents[]` (или `htmlElements[].events[]`) строит:
//   event → handler → calls → mutatedStates → reRendered → chain
//
// Симметрично `buildEventFlows` из React (react-analyzer/flows/event-flows.ts).
//
// ════════════════════════════════════════════════════════════
// ИСТОЧНИКИ ДАННЫХ
// ════════════════════════════════════════════════════════════
//
//   1. vue.componentEvents[]        — @click, @change на компонентах (cu1:ce1)
//   2. vue.sfc[].htmlElements[].events[] — @click на HTML-элементах (he1:ce1)
//   3. functions[]                  — для поиска handler по имени
//   4. vue.reactivity[]             — для mutatedStates
//
// ════════════════════════════════════════════════════════════
// ОГРАНИЧЕНИЯ MVP
// ════════════════════════════════════════════════════════════
//
//   • `functions[].calls` содержит только имена (string[]) — без line.
//   • `functions[].body` пусто (0/862 в infoenergo-ui) — body не используем.
//   • `componentEvents[].handler` содержит сырую строку:
//       "onClick"                       → имя функции
//       "onChoiceClick"                 → имя функции
//       "showMessage(button.actionName)" → вызов с аргументами
//       "handleContextMenuSelect"       → имя функции
//       "() => store.autoSelectHardware($t)" → inline arrow
//       "showPassword = !showPassword"  → inline mutation
//   • `componentEvents[].handlerFunctionId` = null → ищем сами.
//
// ════════════════════════════════════════════════════════════
// АЛГОРИТМ
// ════════════════════════════════════════════════════════════
//
//   Для каждого события ev:
//
//     1. parseHandlerName(ev.handler) — извлечь имя функции
//        "onClick" → "onClick"
//        "showMessage(button.actionName)" → "showMessage"
//        "() => store.autoSelectHardware($t)" → "store.autoSelectHardware"
//        "showPassword = !showPassword" → "showPassword" (mutation, без функции)
//
//     2. Найти функцию fn в functions[] по fn.name === handlerName
//
//     3. calls = fn.calls (если есть) — как VueFlowStep 'call'
//
//     4. mutatedStates = reactivity, чьи имена встречаются в calls
//
//     5. reRendered = SFC, где fn используется (по fileId)
//
//     6. chain = [
//          { step: 'event',   refId: ev.id,   label: `${ev.eventName} on ${elementId}`, line: ev.line },
//          { step: 'handler', refId: fn?.id,  label: `${handlerName}()`,                 line: fn?.line ?? ev.line },
//          ...calls.map(c => ({ step: 'call', refId: c.functionId, label: c.calleeName, line: c.line })),
//          ...mutatedStates.map(s => ({ step: 'state', refId: s, label: `${s} (mutated)`, line: ... })),
//        ]
//
// ============================================================

import type { VueEventFlow, VueFlowStep } from '../types.js';
import type { FunctionLike } from './state-flows.js';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

/**
 * Минимальная форма componentEvent (из vue.componentEvents[]).
 */
export interface ComponentEventLike {
  id: string;
  usageId: string;
  eventName: string;
  handler: string;
  handlerFunctionId?: string | null;
  handlerSource?: string;
  modifiers?: string[];
  line: number;
}

/**
 * Минимальная форма события внутри htmlElement (из vue.sfc[].htmlElements[].events[]).
 */
export interface HtmlEventLike {
  id: string;
  usageId: string;
  eventName: string;
  handler: string;
  modifiers?: string[];
  line: number;
}

/**
 * Минимальная форма SFC (для reRendered).
 */
export interface SfcLike {
  fileId: string;
  moduleId: string;
  name: string;
}

/**
 * Минимальная форма reactivity (для mutatedStates).
 */
export interface ReactivityLike {
  id: string;
  fileId: string;
  name?: string;
}

/**
 * Минимальная форма Vue-секции (только нужные поля).
 */
export interface VueSectionLike {
  componentEvents?: ComponentEventLike[];
  reactivity?: ReactivityLike[];
  sfc?: SfcLike[];
}

/**
 * Минимальная форма SFC с htmlElements (для сбора событий из HTML).
 */
export interface SfcWithHtmlEvents {
  fileId: string;
  htmlElements?: Array<{
    id: string;
    events?: HtmlEventLike[];
  }>;
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит VueEventFlow[] из componentEvents + htmlElements[].events + functions.
 *
 * @param vue           — Vue-секция (componentEvents + reactivity + sfc)
 * @param sfcWithHtml   — SFC с htmlElements[].events (для HTML-событий)
 * @param allFunctions  — все функции (для поиска handler по имени)
 *
 * @returns VueEventFlow[]
 */
export function buildVueEventFlows(
  vue: VueSectionLike,
  sfcWithHtml: SfcWithHtmlEvents[],
  allFunctions: FunctionLike[]
): VueEventFlow[] {
  const flows: VueEventFlow[] = [];

  // ────────────────────────────────────────────────────────
  // 1. Собираем все события: componentEvents + htmlElements[].events
  // ────────────────────────────────────────────────────────

  const allEvents: Array<ComponentEventLike & { elementKind: 'component' | 'html' }> = [];

  // 1a. События на компонентах
  for (const ev of vue.componentEvents ?? []) {
    allEvents.push({ ...ev, elementKind: 'component' });
  }

  // 1b. События на HTML-элементах
  for (const sfc of sfcWithHtml) {
    for (const he of sfc.htmlElements ?? []) {
      for (const ev of he.events ?? []) {
        allEvents.push({
          id: ev.id,
          usageId: ev.usageId,
          eventName: ev.eventName,
          handler: ev.handler,
          handlerFunctionId: null,
          modifiers: ev.modifiers ?? [],
          line: ev.line,
          elementKind: 'html',
        });
      }
    }
  }

  if (allEvents.length === 0) {
    return flows;
  }

  // ────────────────────────────────────────────────────────
  // 2. Индексы для быстрого поиска
  // ────────────────────────────────────────────────────────

  // Функции по имени
  const fnByName = new Map<string, FunctionLike>();
  for (const fn of allFunctions) {
    if (!fnByName.has(fn.name)) {
      fnByName.set(fn.name, fn);
    }
  }

  // Reactivity по имени
  const reactivityByName = new Map<string, ReactivityLike>();
  for (const r of vue.reactivity ?? []) {
    if (r.name) {
      reactivityByName.set(r.name, r);
    }
  }

  // ────────────────────────────────────────────────────────
  // 3. Основной цикл по событиям
  // ────────────────────────────────────────────────────────

  for (let i = 0; i < allEvents.length; i++) {
    const ev = allEvents[i]!;

    // 3a. Извлекаем имя handler из сырой строки
    const parsed = parseHandlerName(ev.handler);

    // 3b. Ищем функцию в allFunctions
    const fn = parsed.functionName ? fnByName.get(parsed.functionName) : undefined;

    // 3c. Собираем calls
    const calls: VueEventFlow['calls'] = [];
    const mutatedStatesSet = new Set<string>();

    if (fn && Array.isArray(fn.calls)) {
      for (const callName of fn.calls) {
        calls.push({
          functionId: `${fn.id}:${fn.line ?? 0}`,
          calleeName: callName,
          line: fn.line ?? 0,
        });

        // Проверяем, ссылается ли call на reactivity
        const reactivity = reactivityByName.get(callName);
        if (reactivity) {
          mutatedStatesSet.add(reactivity.id);
        }

        // Также проверяем с `.value`
        const callBase = callName.split('.')[0];
        if (callBase) {
          const reactivity2 = reactivityByName.get(callBase);
          if (reactivity2) {
            mutatedStatesSet.add(reactivity2.id);
          }
        }
      }
    }

    // 3d. Inline mutation (showPassword = !showPassword)
    if (parsed.inlineMutation) {
      const reactivity = reactivityByName.get(parsed.inlineMutation);
      if (reactivity) {
        mutatedStatesSet.add(reactivity.id);
      }
    }

    const mutatedStates = Array.from(mutatedStatesSet);

    // 3e. reRendered — SFC, где используется fn
    const reRendered: string[] = [];
    if (fn && fn.fileId) {
      // SFC с тем же fileId
      for (const sfc of vue.sfc ?? []) {
        if (sfc.fileId === fn.fileId) {
          reRendered.push(sfc.fileId);
          break;
        }
      }
    }

    // 3f. Строим chain
    const chain: VueFlowStep[] = [];

    // Шаг 1: event
    chain.push({
      step: 'event',
      refId: ev.id,
      label: `${ev.eventName} on ${ev.usageId}`,
      line: ev.line,
    });

    // Шаг 2: handler
    if (fn) {
      chain.push({
        step: 'handler',
        refId: fn.id,
        label: `${fn.name}()`,
        line: fn.line ?? ev.line,
      });
    } else if (parsed.functionName) {
      chain.push({
        step: 'handler',
        refId: `synth:${parsed.functionName}`,
        label: `${parsed.functionName}() [not found]`,
        line: ev.line,
      });
    }

    // Шаг 3: calls
    for (const call of calls) {
      chain.push({
        step: 'call',
        refId: call.functionId,
        label: call.calleeName,
        line: call.line,
      });
    }

    // Шаг 4: mutated states
    for (const stateId of mutatedStates) {
      const reactivity = (vue.reactivity ?? []).find(r => r.id === stateId);
      if (reactivity) {
        chain.push({
          step: 'state',
          refId: stateId,
          label: `${reactivity.name ?? '?'} (mutated)`,
          line: reactivity.fileId ? 0 : 0, // TODO: line from reactivity
        });
      }
    }

    // 3g. Итоговый flow
    flows.push({
      id: `vef${flows.length + 1}`,
      eventId: ev.id,
      eventName: ev.eventName,
      elementId: ev.usageId,
      handlerFunctionId: fn?.id ?? '',
      handlerName: parsed.functionName ?? ev.handler,
      calls,
      mutatedStates,
      reRendered,
      chain,
    });
  }

  return flows;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Результат разбора строки handler из componentEvent.
 */
interface ParsedHandler {
  /** Имя функции (onClick, handleClick, showMessage, ...) */
  functionName?: string;
  /** Inline mutation (для `showPassword = !showPassword`) */
  inlineMutation?: string;
  /** Был ли это inline arrow (`() => foo()`) */
  isInlineArrow?: boolean;
}

/**
 * Разбирает сырую строку handler из componentEvent.
 *
 * Примеры:
 *   "onClick"                             → { functionName: 'onClick' }
 *   "onClick()"                           → { functionName: 'onClick' }
 *   "showMessage(button.actionName)"      → { functionName: 'showMessage' }
 *   "() => store.autoSelectHardware($t)"  → { functionName: 'store.autoSelectHardware', isInlineArrow: true }
 *   "showPassword = !showPassword"        → { inlineMutation: 'showPassword' }
 *   "handleContextMenuSelect"             → { functionName: 'handleContextMenuSelect' }
 *   "setColumnsVisibility"                → { functionName: 'setColumnsVisibility' }
 *   "close"                               → { functionName: 'close' }
 *   "disconnect()"                        → { functionName: 'disconnect' }
 *   "bleStore.connect(t)"                 → { functionName: 'bleStore.connect' }
 *   "bleStore.ssid = network.ssid"        → { inlineMutation: 'bleStore' }
 *
 * ⚠️ Логика повторяет parseHandlers из template.ts, но упрощена —
 *    работает на сырой строке handler (а не на полном value).
 */
function parseHandlerName(raw: string): ParsedHandler {
  if (!raw || typeof raw !== 'string') {
    return {};
  }

  const trimmed = raw.trim();
  if (!trimmed) return {};

  // 1. Inline mutation: `X = ...` (но не `==`, `===`, `=>`)
  const mutationMatch = trimmed.match(/^([A-Za-z_$][\w$.]*)\s*=(?!=|>)\s*.+$/);
  if (mutationMatch && mutationMatch[1]) {
    return { inlineMutation: mutationMatch[1] };
  }

  // 2. Arrow function: `() => ...`
  const arrowMatch = trimmed.match(/^(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>\s*(.+)$/);
  if (arrowMatch && arrowMatch[1]) {
    const inner = arrowMatch[1].trim();
    const innerParsed = parseHandlerName(inner);
    return { ...innerParsed, isInlineArrow: true };
  }

  // 3. Просто вызов: `foo()`, `foo.bar(baz)`, `foo(a, b)`
  const callMatch = trimmed.match(/^([A-Za-z_$][\w$.]*)\s*\(/);
  if (callMatch && callMatch[1]) {
    return { functionName: callMatch[1] };
  }

  // 4. Просто имя: `onClick`, `handleClick`
  const nameMatch = trimmed.match(/^([A-Za-z_$][\w$.]*)$/);
  if (nameMatch && nameMatch[1]) {
    return { functionName: nameMatch[1] };
  }

  // 5. Fallback — первое слово
  const firstWord = trimmed.match(/^([A-Za-z_$][\w$]*)/);
  if (firstWord && firstWord[1]) {
    return { functionName: firstWord[1] };
  }

  return {};
}
