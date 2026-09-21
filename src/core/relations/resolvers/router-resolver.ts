// src/core/relations/resolvers/router-resolver.ts
// ============================================================
// МОДУЛЬ 11.2: РЕЗОЛВИНГ ROUTER
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убраны неиспользуемые импорты (ImportRecord,
//     FunctionRecord, LocalBinding)
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый параметр ctx в findRoute
//   - ✅ ИСПРАВЛЕНО: regex экранирование (\\b → \b, \\s → \s)
// ============================================================

import type { ResolverContext, RouteDefinition } from '../types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

export function resolveRouter(ctx: ResolverContext): number {
  let resolved = 0;

  const routes = ctx.index.routes;
  if (routes.length === 0) return 0;

  for (const [, func] of ctx.functions) {
    const body = func.body ?? '';
    if (!body) continue;

    // ✅ ИСПРАВЛЕНО: корректное экранирование
    const routerRe = /\brouter\s*\.\s*(?:push|replace)\s*\(\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;

    while ((m = routerRe.exec(body)) !== null) {
      const routePath = m[1];
      if (!routePath) continue;

      const route = findRoute(routes, routePath);
      if (route) {
        func.routeRefs = func.routeRefs ?? [];
        func.routeRefs.push({
          path: routePath,
          routeName: route.name,
          componentFileId: route.componentFileId,
        });
        resolved++;
      }
    }
  }

  return resolved;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

function findRoute(routes: RouteDefinition[], path: string): RouteDefinition | null {
  // Точное совпадение
  const exact = routes.find(r => r.path === path);
  if (exact) return exact;

  // Параметризованные: /users/:id
  const paramMatch = routes.find(r => {
    const pattern = r.path.replace(/:[^/]+/g, '[^/]+');
    return new RegExp(`^${pattern}$`).test(path);
  });

  return paramMatch ?? null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { resolveRouter };
