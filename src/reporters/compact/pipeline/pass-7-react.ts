// src/reporters/compact/pipeline/pass-7-react.ts
// ============================================================
// ПРОХОД 7: REACT-СУЩНОСТИ
// ============================================================
// Версия: 1.2.0 (убрана диагностика)
//
// ✅ v1.2.0: убрана диагностика
//   - Удалены все console.log('[pass7React] ...') временные
//     логи, добавленные для отладки интеграции React-секции.
//   - Round-trip 140/140 — интеграция полностью работает.
//
// ✅ v1.1.0: диагностика
//   - Добавлен console.log с информацией о entitiesMap
//     и результате classifyReactEntities.
//   - Это временно, для отладки интеграции React-секции.
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
 *   2. Проверка hasAnyReact:
 *      если все массивы пусты → early return.
 *      ctx.react остаётся undefined.
 *
 *   3. convertReactEntitiesToFull(reactEntities, fileMap, projectRoot)
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
