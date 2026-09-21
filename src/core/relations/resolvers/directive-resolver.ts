// src/core/relations/resolvers/directive-resolver.ts
// ============================================================
// МОДУЛЬ 11.3: РЕЗОЛВИНГ DIRECTIVES
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран несуществующий импорт ImportRecord, FunctionRecord
//     (типы не используются, доступ идёт через ctx.importsByFileId)
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт toPascalCase
//   - ✅ ИСПРАВЛЕНО: удалена неиспользуемая константа NUXT_MODIFIERS
//   - ✅ ИСПРАВЛЕНО: ctx.imports → ctx.importsByFileId
//   - ✅ ИСПРАВЛЕНО: ctx.functions → ctx.functionsByFileId
// ============================================================

import type { ResolverContext } from '../types.js';

// ============================================================
// ВСТРОЕННЫЕ ДИРЕКТИВЫ VUE
// ============================================================

const BUILTIN_DIRECTIVES = new Set<string>([
  'v-if',
  'v-else',
  'v-else-if',
  'v-for',
  'v-show',
  'v-model',
  'v-on',
  'v-bind',
  'v-slot',
  'v-html',
  'v-text',
  'v-pre',
  'v-once',
  'v-memo',
  'v-cloak',
]);

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Резолвит кастомные директивы:
 *   v-my-directive → myDirective (camelCase) → import или local binding
 *
 * Для каждой директивы в template.directives пытается найти:
 *   1. Импорт с localName === camelCase(dirName)
 *   2. Local binding с localName === camelCase(dirName)
 *
 * @param ctx — контекст резолвера
 * @returns количество разрешённых директив
 */
export function resolveDirectives(ctx: ResolverContext): number {
  let resolved = 0;

  for (const [fileId, template] of ctx.templates) {
    const directives = (template as any).directives;
    if (!Array.isArray(directives) || directives.length === 0) continue;

    const fileImports = ctx.importsByFileId.get(fileId) ?? [];
    const fileLocalBindings = ctx.localBindings.get(fileId) ?? [];

    for (const dir of directives) {
      const rawName = typeof dir === 'string' ? dir : dir?.name;
      if (!rawName) continue;

      // Пропускаем встроенные директивы
      if (BUILTIN_DIRECTIVES.has(rawName)) continue;

      // Преобразуем v-my-directive → myDirective
      const camelName = toCamelCase(rawName);
      if (!camelName) continue;

      // 1. Ищем импорт
      const imp = fileImports.find(
        (i: any) => i.localName === camelName || i.importedName === camelName
      );

      if (imp) {
        if (typeof dir === 'object') {
          (dir as any).definition = {
            kind: 'import',
            fileId: imp.toFileId,
            importId: imp.id,
            name: imp.importedName,
            localName: imp.localName,
            isExternal: imp.isExternal ?? false,
            packageName: imp.packageName,
          };
        }
        resolved++;
        continue;
      }

      // 2. Ищем local binding
      const local = fileLocalBindings.find((b: any) => b.localName === camelName);

      if (local) {
        if (typeof dir === 'object') {
          (dir as any).definition = {
            kind: 'local',
            functionId: local.sourceFunctionId,
            fileId: local.sourceFileId,
            name: camelName,
            sourceKind: local.kind,
          };
        }
        resolved++;
        continue;
      }

      // 3. Ищем в global function index (может быть определена в другом файле)
      const globalIds = ctx.index.functionByName.get(camelName);
      if (globalIds && globalIds.length > 0) {
        const globalFunc = ctx.functions.get(globalIds[0]!);
        if (globalFunc && typeof dir === 'object') {
          (dir as any).definition = {
            kind: 'global',
            functionId: globalFunc.id,
            fileId: globalFunc.fileId,
            name: camelName,
          };
          resolved++;
          continue;
        }
      }

      // 4. Не разрешено
      if (typeof dir === 'object') {
        (dir as any).definition = null;
        (dir as any).warning = 'directive_not_resolved';
      }
    }
  }

  return resolved;
}

// ============================================================
// УТИЛИТЫ
// ============================================================

/**
 * v-my-directive → myDirective
 * vFooBar → fooBar
 */
function toCamelCase(rawName: string): string | null {
  if (!rawName) return null;

  // v-my-directive → my-directive → myDirective
  const withoutV = rawName.replace(/^v-/, '');
  if (!withoutV) return null;

  // my-directive → myDirective
  const camel = withoutV.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  if (!camel) return null;

  return camel;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { resolveDirectives };
