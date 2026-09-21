// src/core/relations/resolvers/v-model-resolver.ts
// ============================================================
// МОДУЛЬ 9: РЕЗОЛВИНГ V-MODEL
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убраны неиспользуемые импорты VueMacros, ModelDefinition
//   - ✅ ИСПРАВЛЕНО: используется ctx.importsByFileId вместо ctx.imports
//   - ✅ ИСПРАВЛЕНО: resolved.emitConsumers?.length ?? 0 (защита от undefined)
//   - ✅ ИСПРАВЛЕНО: stats.byModifier — индексация через VModelModifier
//   - ✅ ИСПРАВЛЕНО: ImportRecord импортируется из ../types.js
// ============================================================

import type { ResolverContext, ImportRecord, LocalBinding } from '../types.js';

// ============================================================
// ТИПЫ
// ============================================================

export type VModelModifier = 'default' | 'lazy' | 'number' | 'trim';

export interface VModelResolveStats {
  /** Всего v-model найдено */
  total: number;
  /** Успешно разрешено */
  resolved: number;
  /** Не разрешено */
  unresolved: number;
  /** По модификаторам */
  byModifier: Record<VModelModifier, number>;
  /** Разрешено через defineModel */
  viaDefineModel: number;
  /** Разрешено через fallback (emit) */
  viaFallback: number;
  /** Связано с localBinding (composable) */
  withLocalSource: number;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

export function resolveVModels(ctx: ResolverContext): number {
  const stats = createEmptyStats();

  for (const [fileId, template] of ctx.templates) {
    const vModels = (template as any).vModels;
    if (!Array.isArray(vModels) || vModels.length === 0) continue;

    const imports = ctx.importsByFileId.get(fileId) ?? [];
    const localBindings = ctx.localBindings.get(fileId) ?? [];

    for (const vm of vModels) {
      stats.total++;

      // Модификатор
      const modifier = normalizeModifier(vm.modifier);
      stats.byModifier[modifier] = (stats.byModifier[modifier] ?? 0) + 1;

      // 1. Связываем с дочерним компонентом
      const importRec = findComponentImport(imports, vm.tag);

      if (importRec && importRec.toFileId) {
        const targetMacros = ctx.vueMacros.get(importRec.toFileId);
        const targetTemplate = ctx.templates.get(importRec.toFileId);

        // 1.1. Ищем defineModel с propName = vm.name
        const model = targetMacros?.model.find(m => m.propName === vm.name || m.name === vm.name);

        if (model) {
          vm.resolvedTo = {
            modelName: model.name,
            propName: model.propName,
            eventName: model.eventName,
            childFileId: importRec.toFileId,
            importId: importRec.id,
            viaDefineModel: true,
          };
          stats.resolved++;
          stats.viaDefineModel++;
        } else if (targetTemplate) {
          // 1.2. Fallback: emit 'update:xxx'
          vm.resolvedTo = {
            modelName: vm.name,
            propName: vm.name,
            eventName: `update:${vm.name}`,
            childFileId: importRec.toFileId,
            importId: importRec.id,
            viaDefineModel: false,
          };
          stats.resolved++;
          stats.viaFallback++;
        } else {
          stats.unresolved++;
        }
      } else {
        stats.unresolved++;
      }

      // 2. Связываем localVar с localBindings
      if (vm.localVar) {
        const local = findLocalBinding(localBindings, vm.localVar);
        if (local) {
          vm.localVarSource = {
            kind: 'composable',
            functionId: local.sourceFunctionId,
            key: local.propertyName,
            fileId: local.sourceFileId,
            composableName: local.composableName,
            keyKind: local.sourceKeyKind,
          };
          stats.withLocalSource++;
        } else {
          // 2.1. Fallback: ищем local ref/computed
          const macros = ctx.vueMacros.get(fileId);
          const exposed = macros?.exposed.find(e => e.name === vm.localVar);
          if (exposed) {
            vm.localVarSource = {
              kind: 'local',
              name: vm.localVar,
              refKind: exposed.kind,
            };
          }
        }
      }

      // 3. Связываем emit 'update:vm.name' с template.eventHandlers
      // Это ребро: v-model → @update:xxx handler в родителе
      const updateEventName = `update:${vm.name}`;
      const handlers = (template as any).eventHandlers ?? [];
      const updateHandler = handlers.find(
        (h: any) => h.eventName === updateEventName && h.componentFileId === importRec?.toFileId
      );

      if (updateHandler) {
        vm.updateHandler = {
          handlerName: updateHandler.handlerName,
          handlerFunctionId: updateHandler.handlerFunctionId ?? null,
          line: updateHandler.line,
        };
      }
    }
  }

  // Применяем собранную статистику к ctx (для отладки)
  (ctx as any).__vModelStats = stats;

  return stats.resolved;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

function createEmptyStats(): VModelResolveStats {
  return {
    total: 0,
    resolved: 0,
    unresolved: 0,
    byModifier: {
      default: 0,
      lazy: 0,
      number: 0,
      trim: 0,
    },
    viaDefineModel: 0,
    viaFallback: 0,
    withLocalSource: 0,
  };
}

function normalizeModifier(modifier: unknown): VModelModifier {
  if (modifier === 'lazy' || modifier === 'number' || modifier === 'trim') {
    return modifier;
  }
  return 'default';
}

/**
 * Ищет импорт компонента по тегу.
 * Поддерживает:
 *   - n-data-table → n-data-table (kebab)
 *   - NDataTable → NDataTable
 *   - AiToolbar → AiToolbar
 */
function findComponentImport(
  imports: ImportRecord[],
  tag: string | undefined
): ImportRecord | null {
  if (!tag) return null;

  for (const imp of imports) {
    if (imp.localName === tag) return imp;
    if (imp.importedName === tag) return imp;
  }

  // Fallback: PascalCase ↔ kebab-case
  const pascal = toPascalCaseLocal(tag);
  const kebab = toKebabCaseLocal(tag);

  for (const imp of imports) {
    if (imp.localName === pascal || imp.importedName === pascal) return imp;
    if (imp.localName === kebab || imp.importedName === kebab) return imp;
  }

  return null;
}

function findLocalBinding(localBindings: LocalBinding[], localName: string): LocalBinding | null {
  for (const binding of localBindings) {
    if (binding.localName === localName) return binding;
  }
  return null;
}

function toPascalCaseLocal(str: string): string {
  return str
    .replace(/[-_]+(\w)/g, (_, c: string) => c.toUpperCase())
    .replace(/^\w/, c => c.toUpperCase());
}

function toKebabCaseLocal(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { resolveVModels };
