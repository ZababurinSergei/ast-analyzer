// src/core/relations/resolvers/emits-resolver.ts
// ============================================================
// МОДУЛЬ 8: РЕЗОЛВИНГ EMITS → PARENT HANDLER
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убраны неиспользуемые импорты EmitDefinition,
//     ModelDefinition
//   - ✅ ИСПРАВЛЕНО: неиспользуемый параметр `ctx` в resolveOneEmit
//     переименован в `_ctx`
//
// МОДУЛЬ 8: Связывает emit('toolbar-action') в дочернем компоненте
// с @toolbar-action="..." в родительском.
//
// Использует index.componentUsers (fileId → [родители]),
// который строится в buildGlobalIndex().
// ============================================================

import type { ResolverContext } from '../types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Для каждого emit в дочернем компоненте ищет @event в родителе.
 *
 * @param ctx — контекст resolver-а
 * @returns Количество разрешённых emits
 */
export function resolveEmits(ctx: ResolverContext): number {
  let resolved = 0;

  for (const [fileId, template] of ctx.templates) {
    const emits = template.emits ?? [];
    if (emits.length === 0) continue;

    // Находим всех, кто использует этот компонент
    const users = ctx.index.componentUsers.get(fileId) ?? [];
    if (users.length === 0) continue;

    for (const emit of emits) {
      const emitName = typeof emit === 'string' ? emit : emit.name;
      if (!emitName) continue;

      for (const user of users) {
        // Ищем @emitName в template родителя
        const parentHandlers = user.parentTemplate.eventHandlers ?? [];
        const handler = parentHandlers.find(
          (h: any) => h.eventName === emitName && h.componentFileId === fileId
        );

        if (handler) {
          if (typeof emit === 'object') {
            emit.consumers = emit.consumers ?? [];
            emit.consumers.push({
              parentFileId: user.parentFileId,
              handlerName: handler.handlerName,
              handlerFunctionId: handler.handlerFunctionId ?? null,
              line: handler.line,
            });
          }
          resolved++;
        }
      }
    }
  }

  return resolved;
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ (для отладки)
// ============================================================

/**
 * Возвращает всех потребителей конкретного emit-а.
 *
 * @param ctx — контекст resolver-а
 * @param fileId — файл, в котором объявлен emit
 * @param emitName — имя emit-а
 * @returns Массив потребителей
 */
export function findEmitConsumers(
  ctx: ResolverContext,
  fileId: string,
  emitName: string
): Array<{ parentFileId: string; handlerName: string }> {
  const result: Array<{ parentFileId: string; handlerName: string }> = [];

  const users = ctx.index.componentUsers.get(fileId) ?? [];

  for (const user of users) {
    const parentHandlers = user.parentTemplate.eventHandlers ?? [];
    const handler = parentHandlers.find(
      (h: any) => h.eventName === emitName && h.componentFileId === fileId
    );

    if (handler) {
      result.push({
        parentFileId: user.parentFileId,
        handlerName: handler.handlerName,
      });
    }
  }

  return result;
}

/**
 * Возвращает статистику по emits для отладки.
 */
export function getEmitsStats(ctx: ResolverContext): {
  totalEmits: number;
  withConsumers: number;
  totalConsumers: number;
} {
  let totalEmits = 0;
  let withConsumers = 0;
  let totalConsumers = 0;

  for (const [, template] of ctx.templates) {
    const emits = template.emits ?? [];
    for (const emit of emits) {
      totalEmits++;
      if (typeof emit === 'object' && Array.isArray(emit.consumers) && emit.consumers.length > 0) {
        withConsumers++;
        totalConsumers += emit.consumers.length;
      }
    }
  }

  return { totalEmits, withConsumers, totalConsumers };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  resolveEmits,
  findEmitConsumers,
  getEmitsStats,
};
