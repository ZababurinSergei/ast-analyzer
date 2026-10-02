// src/reporters/compact/pipeline/pass-7-react.ts
// ============================================================
// ПРОХОД 7: REACT-СУЩНОСТИ
// ============================================================
// Версия: 1.3.0 (flow-секции)
//
// ✅ v1.3.0: FLOW-секции (v17.1.0)
//   - Добавлены билдеры flow:
//       • buildStateFlows  — state ↔ mutation ↔ read ↔ render
//       • buildEventFlows  — event → handler → call → state → render
//       • buildRenderTree  — иерархия JSX с зависимостями
//       • buildFnJsxUsage  — обратный индекс: функция → JSX
//   - Все 4 секции сохраняются в reactEntities.stateFlows /
//     eventFlows / renderTree / fnJsxUsage и попадают в ctx.react
//     через convertReactEntitiesToFull.
//
// ✅ v1.2.0: убрана диагностика
//   - Удалены все console.log('[pass7React] ...') временные
//     логи, добавленные для отладки интеграции React-секции.
//   - Round-trip 140/140 — интеграция полностью работает.
//
// ✅ v1.1.0: диагностика
//   - Добавлен console.log с информацией о entitiesMap
//     и результате classifyReactEntities.
//
// НАЗНАЧЕНИЕ
// ----------
// Собирает React-сущности из entitiesMap и кладёт в ctx.react.
// Симметричен pass-5-vue.ts, но проще (без component-usage).
//
// СИММЕТРИЯ С VUE
// ---------------
//   Vue:   reporters/compact/pipeline/pass-5-vue.ts
//            → pass5Vue(ctx)
//              • classifyVueEntities
//              • convertVueEntitiesToFull
//              • processComponentUsage
//              • fillComponentAccumulators
//              → ctx.vue
//
//   React: reporters/compact/pipeline/pass-7-react.ts ← этот файл
//            → pass7React(ctx)
//              • classifyReactEntities
//              • buildStateFlows / buildEventFlows / buildRenderTree / buildFnJsxUsage
//              • convertReactEntitiesToFull
//              → ctx.react
//
// ПОРЯДОК ВЫЗОВА В PIPELINE
// -------------------------
//   collectFullJSON вызывает проходы в порядке:
//     pass1Modules → pass4Extended → pass2Exports → pass3Calls
//       → pass5Vue → pass6DomApi → pass7React
//
//   pass7React идёт ПОСЛЕ pass6DomApi — не ломает существующий
//   pipeline (React пока не участвует в DOM API).
//
// ОПЦИОНАЛЬНОСТЬ
// --------------
//   Если в проекте нет .tsx/.jsx файлов, pass7React сразу
//   выходит, ctx.react остаётся undefined, FullJSON.react
//   остаётся undefined — обратная совместимость.
// ============================================================

import { classifyReactEntities } from '../../../core/react-entity-classifier.js';
import type { ReactEntities } from '../../../core/react-entity-classifier.js';
import { convertReactEntitiesToFull } from '../react/convert-section.js';
import {
  buildStateFlows,
  buildEventFlows,
  buildRenderTree,
  buildFnJsxUsage,
} from '../../../modes/react-analyzer/flows/index.js';
import type { CollectContext } from './context.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Проход 7: сбор React-сущностей.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. classifyReactEntities(ctx.entitiesMap)
 *      → ReactEntities (components, hooks, effects, contexts,
 *                       memoization, refs, jsxElements, jsxEvents,
 *                       conditionals, componentUsages)
 *
 *   2. buildStateFlows / buildEventFlows / buildRenderTree /
 *      buildFnJsxUsage
 *      → flow-секции (stateFlows, eventFlows, renderTree, fnJsxUsage)
 *
 *   3. Проверка hasAnyReact:
 *      если все массивы пусты → early return.
 *      ctx.react остаётся undefined.
 *
 *   4. convertReactEntitiesToFull(reactEntities, fileMap, projectRoot)
 *      → ctx.react (ReactSectionFull-совместимая структура)
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ЗАПОЛНЯЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ctx.react
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 *   Весь проход в try/catch. При ошибке:
 *     • если verbose → console.warn
 *     • ctx.react остаётся undefined
 *     • pipeline продолжается (React-секция опциональна)
 *
 * @param ctx — контекст сбора (мутируется)
 */
export function pass7React(ctx: CollectContext): void {
  const { entitiesMap, verbose } = ctx;

  try {
    // ────────────────────────────────────────────────────────
    // Шаг 1: классификация React-сущностей
    // ────────────────────────────────────────────────────────
    const reactEntities: ReactEntities = classifyReactEntities(entitiesMap);

    // ────────────────────────────────────────────────────────
    // Шаг 1.5: построение flow-секций (v17.1.0)
    // ────────────────────────────────────────────────────────
    //
    // Четыре билдера, симметричные Vue:
    //   • buildStateFlows  — state ↔ mutation ↔ read ↔ render
    //   • buildEventFlows  — event → handler → call → state → render
    //   • buildRenderTree  — иерархия JSX с зависимостями
    //   • buildFnJsxUsage  — обратный индекс: функция → JSX
    //
    // Все — производные от уже собранных сущностей. Не требуют
    // дополнительных проходов по AST.
    //
    // Источник функций — плоский список из entitiesMap.
    // Собираем один раз, используем во всех билдерах.
    // ────────────────────────────────────────────────────────

    // Собираем плоский список функций из entitiesMap
    const allFunctions: Array<{
      id: string;
      name: string;
      line?: number;
      calls?: Array<{ id?: string; callee: string; line: number }>;
    }> = [];

    let fnCounter = 0;
    for (const filePath of Object.keys(entitiesMap).sort()) {
      const ent = entitiesMap[filePath] as any;
      if (!ent || !Array.isArray(ent.functions)) continue;
      for (const fn of ent.functions) {
        fnCounter++;
        allFunctions.push({
          id: fn.id ?? `fn${fnCounter}`,
          name: fn.name ?? '',
          line: fn.line,
          calls: fn.calls ?? [],
        });
      }
    }

    // ─── State flows ───
    reactEntities.stateFlows = buildStateFlows(
      reactEntities.hooks,
      reactEntities.jsxElements,
      allFunctions
    );

    // ─── Event flows ───
    reactEntities.eventFlows = buildEventFlows(
      reactEntities.jsxEvents,
      reactEntities.hooks,
      reactEntities.components,
      allFunctions
    );

    // ─── Render tree ───
    reactEntities.renderTree = buildRenderTree(reactEntities.jsxElements, reactEntities.hooks);

    // ─── Fn JSX usage ───
    reactEntities.fnJsxUsage = buildFnJsxUsage(
      reactEntities.jsxEvents,
      reactEntities.jsxElements,
      allFunctions
    );

    // ────────────────────────────────────────────────────────
    // Шаг 2: проверка наличия React-кода
    // ────────────────────────────────────────────────────────
    const hasAnyReact =
      reactEntities.components.length > 0 ||
      reactEntities.hooks.length > 0 ||
      reactEntities.effects.length > 0 ||
      reactEntities.contexts.length > 0 ||
      reactEntities.memoization.length > 0 ||
      reactEntities.refs.length > 0 ||
      reactEntities.jsxElements.length > 0 ||
      reactEntities.jsxEvents.length > 0 ||
      reactEntities.conditionals.length > 0 ||
      reactEntities.componentUsages.length > 0;

    if (!hasAnyReact) {
      if (verbose) {
        console.log('   ⏭️  React-сущностей не найдено, секция react пропущена');
      }
      return;
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: конвертация в ReactSectionFull-совместимую структуру
    // ────────────────────────────────────────────────────────
    ctx.react = convertReactEntitiesToFull(reactEntities, ctx.fileMap, ctx.projectRoot);

    // ────────────────────────────────────────────────────────
    // Шаг 4: verbose-диагностика
    // ────────────────────────────────────────────────────────
    if (verbose) {
      const r: any = ctx.react;
      console.log(`   ⚛️  React Components: ${r.components?.length ?? 0}`);
      console.log(`   🎣 React Hooks: ${r.hooks?.length ?? 0}`);
      console.log(`   ⚡ React Effects: ${r.effects?.length ?? 0}`);
      console.log(`   🌐 React Contexts: ${r.contexts?.length ?? 0}`);
      console.log(`   💾 React Memoization: ${r.memoization?.length ?? 0}`);
      console.log(`   📌 React Refs: ${r.refs?.length ?? 0}`);
      console.log(`   🧩 JSX Elements: ${r.jsxElements?.length ?? 0}`);
      console.log(`   🖱️  JSX Events: ${r.jsxEvents?.length ?? 0}`);
      console.log(`   ❓ Conditionals: ${r.conditionals?.length ?? 0}`);
      console.log(`   🔗 Component Usages: ${r.componentUsages?.length ?? 0}`);
      console.log(`   🔗 State Flows: ${r.stateFlows?.length ?? 0}`);
      console.log(`   🔗 Event Flows: ${r.eventFlows?.length ?? 0}`);
      console.log(`   🔗 Render Tree: ${r.renderTree?.length ?? 0}`);
      console.log(`   🔗 Fn JSX Usage: ${r.fnJsxUsage?.length ?? 0}`);
    }
  } catch (err) {
    // ────────────────────────────────────────────────────────
    // Обработка ошибок
    // ────────────────────────────────────────────────────────
    if (verbose) {
      console.warn(
        `   ⚠️  Ошибка pass7React (classifyReactEntities/convert): ` +
          `${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass7React;
