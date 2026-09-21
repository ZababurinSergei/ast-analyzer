// src/core/relations/resolvers/props-resolver.ts
// ============================================================
// МОДУЛЬ 7: РЕЗОЛВИНГ PROPS → ИСТОЧНИК
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `ImportRecord`
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `toPascalCase`
//   - ✅ ИСПРАВЛЕНО: `ctx.importsByFileId` вместо `ctx.imports.filter`
//   - ✅ Использует типизированный `ResolverContext`
// ============================================================

import type { ResolverContext } from '../types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

export function resolveProps(ctx: ResolverContext): number {
  let resolved = 0;

  for (const [fileId, template] of ctx.templates) {
    const propBindings = (template as any).propBindings;
    if (!Array.isArray(propBindings) || propBindings.length === 0) continue;

    const vueMacros = ctx.vueMacros.get(fileId);
    const localBindings = ctx.localBindings.get(fileId) ?? [];
    const fileInjections = (template as any).templateInjections ?? [];

    for (const binding of propBindings) {
      const expr: string = binding.expression ?? '';
      if (!expr) continue;

      // ──────────────────────────────────────────────────
      // 1. props.xxx → defineProps
      // ──────────────────────────────────────────────────
      if (expr.startsWith('props.')) {
        const propName = expr.slice(6);
        const def = vueMacros?.props.find(p => p.name === propName);
        if (def) {
          binding.source = {
            kind: 'prop',
            propName,
            type: def.type,
            required: def.required,
            default: def.default,
          };
          resolved++;
          continue;
        }
      }

      // ──────────────────────────────────────────────────
      // 2. useXxxStore().yyy → Pinia
      // ──────────────────────────────────────────────────
      const storeMatch = expr.match(/^use(\w+)Store\(\)\.(\w+)/);
      if (storeMatch) {
        const storeName = `use${storeMatch[1]}Store`;
        const propName = storeMatch[2];
        const store = ctx.index.stores.get(storeName);
        binding.source = {
          kind: 'store',
          storeName,
          property: propName,
          storeFileId: store?.fileId ?? null,
          exists: !!store,
        };
        resolved++;
        continue;
      }

      // ──────────────────────────────────────────────────
      // 3. injected value
      // ──────────────────────────────────────────────────
      const injection = fileInjections.find((i: any) => i.key === expr);
      if (injection) {
        binding.source = {
          kind: 'inject',
          injectionKey: injection.key,
        };
        resolved++;
        continue;
      }

      // ──────────────────────────────────────────────────
      // 4. Local composable binding: const { x } = useYyy()
      // ──────────────────────────────────────────────────
      const local = localBindings.find(b => b.localName === expr);
      if (local) {
        binding.source = {
          kind: 'composable',
          functionId: local.sourceFunctionId,
          key: local.propertyName,
          fileId: local.sourceFileId,
          composableName: local.composableName,
          keyKind: local.sourceKeyKind ?? local.kind,
        };
        resolved++;
        continue;
      }

      // ──────────────────────────────────────────────────
      // 5. Локальная ref/computed из defineExpose
      // ──────────────────────────────────────────────────
      const localVar = findLocalVariable(ctx, fileId, expr);
      if (localVar) {
        binding.source = {
          kind: 'local',
          name: expr,
          refKind: localVar.kind,
        };
        resolved++;
        continue;
      }

      // ──────────────────────────────────────────────────
      // 6. Literal / template literal — не связываем
      // ──────────────────────────────────────────────────
      // Оставляем binding.source === undefined
    }
  }

  return resolved;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

/**
 * Ищет локальную переменную в vueMacros.exposed.
 * Возвращает `{ kind }` или `null`.
 */
function findLocalVariable(
  ctx: ResolverContext,
  fileId: string,
  name: string
): { kind: string } | null {
  const macros = ctx.vueMacros.get(fileId);
  if (!macros) return null;

  const exposed = macros.exposed.find(e => e.name === name);
  if (exposed) return { kind: exposed.kind };

  // Также проверяем defineModel
  const model = macros.model.find(m => m.name === name);
  if (model) return { kind: 'ref' };

  return null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { resolveProps };
