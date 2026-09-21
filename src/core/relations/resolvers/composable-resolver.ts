// src/core/relations/resolvers/composable-resolver.ts
// ============================================================
// МОДУЛЬ 6: РЕЗОЛВИНГ COMPOSABLE
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый `funcId` в цикле
//     `for (const [funcId, func] of ctx.functions)` → заменён
//     на `for (const [, func] of ctx.functions)`, поскольку
//     `funcId` не использовался внутри тела цикла.
//   - ✅ ИСПРАВЛЕНО: поля `sourceKeyKind`, `sourceKeyLine`,
//     `composableName` теперь корректно присваиваются —
//     они объявлены в интерфейсе `LocalBinding` (см. types.ts v1.0.1).
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `ComposableInfo`
//     (в файле используется только через `any` для обхода циклов).
//   - ✅ ИСПРАВЛЕНО: явная типизация возвращаемого значения.
//
// Назначение
// ----------
// Модуль агрегирует статистику по composables и localBindings,
// а также обогащает каждую LocalBinding информацией о source-key:
//   - sourceKeyKind  — ref / computed / function / ...
//   - sourceKeyLine  — строка в файле composable
//   - composableName — имя composable (useTableState)
//
// Обогащение делается один раз — после того как все composables
// уже извлечены (этап composable-extractor).
// ============================================================

import type { ResolverContext, ComposableInfo, LocalBinding } from '../types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Резолвит composables и localBindings.
 *
 * Этапы:
 *   1. Обогащает каждую LocalBinding полями sourceKeyKind,
 *      sourceKeyLine, composableName.
 *   2. Возвращает агрегированную статистику.
 *
 * @param ctx — контекст resolver-а
 * @returns { composables, bindings }
 */
export function resolveComposables(ctx: ResolverContext): {
  composables: number;
  bindings: number;
} {
  const composablesCount = ctx.composables.size;

  let bindings = 0;

  for (const [, list] of ctx.localBindings) {
    for (const binding of list) {
      enrichBinding(ctx, binding);
      bindings++;
    }
  }

  return {
    composables: composablesCount,
    bindings,
  };
}

// ============================================================
// ОБОГАЩЕНИЕ LOCAL BINDING
// ============================================================

/**
 * Обогащает одну LocalBinding информацией о source-key из
 * соответствующего ComposableInfo.
 *
 * Если composable найден и key присутствует в returnedKeys —
 * заполняем sourceKeyKind и sourceKeyLine.
 *
 * Если composable найден, но key отсутствует — ставим 'unknown'
 * и всё равно пишем composableName (для отладки).
 *
 * Если composable не найден — ставим 'unknown' без composableName.
 */
function enrichBinding(ctx: ResolverContext, binding: LocalBinding): void {
  // Если sourceFunctionId отсутствует — обогащать нечего
  if (!binding.sourceFunctionId) {
    binding.sourceKeyKind = 'unknown';
    return;
  }

  const composable = findComposableByFunctionId(ctx, binding.sourceFunctionId);

  if (!composable) {
    binding.sourceKeyKind = 'unknown';
    return;
  }

  // Записываем имя composable — полезно даже если key не найден
  binding.composableName = composable.name;

  // Ищем returned-key по propertyName
  const returnedKey = composable.returnedKeys.find(k => k.name === binding.propertyName);

  if (returnedKey) {
    binding.sourceKeyKind = returnedKey.kind;
    binding.sourceKeyLine = returnedKey.line;
  } else {
    // Composable найден, но такого ключа в return нет —
    // это может быть computed/ref, объявленный вне return,
    // или опечатка в propertyName.
    binding.sourceKeyKind = 'unknown';
  }
}

// ============================================================
// ПОИСК COMPOSABLE
// ============================================================

/**
 * Находит ComposableInfo по functionId.
 *
 * Композиция: `ctx.composables` — это Map<name, ComposableInfo>,
 * но нам нужен поиск по functionId, а не по name.
 * Поэтому проходим по значениям.
 */
function findComposableByFunctionId(
  ctx: ResolverContext,
  functionId: string
): ComposableInfo | null {
  for (const [, composable] of ctx.composables) {
    if (composable.functionId === functionId) return composable;
  }
  return null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  resolveComposables,
};
