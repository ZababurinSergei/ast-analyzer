// src/core/relations/resolvers/dynamic-component-resolver.ts
// ============================================================
// МОДУЛЬ 10: РЕЗОЛВИНГ DYNAMIC COMPONENTS
// ============================================================
// Версия: 1.0.2
//
// ИЗМЕНЕНИЯ v1.0.2:
//   - ✅ ИСПРАВЛЕНО: убраны неиспользуемые импорты
//     (ImportRecord, toPascalCase, LocalBinding)
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый параметр fileId,
//     localBindings, macros в resolveDynamicForTemplate
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый ast в extractAvailableComponents
//   - ✅ ИСПРАВЛЕНО: проверка на undefined для kebab/name в startsWith
//   - ✅ ИСПРАВЛЕНО: использование ctx.importsByFileId и ctx.scriptASTs
//     (добавлены в ResolverContext в v1.0.1)
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: regex-экранирование
//   - ✅ ИСПРАВЛЕНО: ResolverContext.importsByFileId
// ============================================================

import { Node, type SourceFile } from 'ts-morph';

import type { ResolverContext, ObjectMap } from '../types.js';
import { toPascalCase, toKebabCase } from '../global-index.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Резолвит все dynamicComponents во всех templates.
 *
 * <component :is="icon" />
 * <component :is="item.component" />
 * <component :is="icons[type]" />
 *
 * @returns количество разрешённых
 */
export function resolveDynamicComponents(ctx: ResolverContext): number {
  let resolved = 0;

  for (const [fileId, template] of ctx.templates) {
    const dynamics = (template as any).dynamicComponents;
    if (!Array.isArray(dynamics) || dynamics.length === 0) continue;

    const imports = ctx.importsByFileId.get(fileId) ?? [];
    const maps = ctx.objectMaps.get(fileId) ?? [];
    const astBundle = ctx.scriptASTs?.get(fileId);

    // Доступные локальные переменные (для этого файла)
    const availableComponents = astBundle
      ? extractAvailableComponents(astBundle.sourceFile)
      : new Map<string, string>();

    for (const dyn of dynamics) {
      if (dyn.resolvedComponents && dyn.resolvedComponents.length > 0) continue;

      const count = resolveOneDynamic(dyn, imports, maps, availableComponents);

      if (count > 0) resolved++;
    }
  }

  return resolved;
}

// ============================================================
// РЕЗОЛВИНГ ОДНОГО DYNAMIC COMPONENT
// ============================================================

function resolveOneDynamic(
  dyn: any,
  imports: any[],
  maps: ObjectMap[],
  availableComponents: Map<string, string>
): number {
  const expr: string = dyn.isExpression ?? '';
  if (!expr) return 0;

  // ──────────────────────────────────────────────────────
  // 1. Прямой идентификатор: :is="icon"
  // ──────────────────────────────────────────────────────
  if (isSimpleIdentifier(expr)) {
    // 1.1. Из imports
    const direct = imports.find((i: any) => i.localName === expr);
    if (direct) {
      dyn.resolvedComponents = [
        {
          name: direct.importedName,
          fileId: direct.toFileId,
          importId: direct.id,
          isExternal: direct.isExternal,
        },
      ];
      return 1;
    }

    // 1.2. Из локальных переменных (const icon = ...)
    const localTarget = availableComponents.get(expr);
    if (localTarget) {
      // Ищем import по имени target
      const imp = imports.find(
        (i: any) => i.localName === localTarget || i.importedName === localTarget
      );
      dyn.resolvedComponents = [
        {
          name: localTarget,
          fileId: imp?.toFileId ?? null,
          importId: imp?.id ?? null,
          isExternal: imp?.isExternal ?? false,
        },
      ];
      return 1;
    }

    return 0;
  }

  // ──────────────────────────────────────────────────────
  // 2. MemberExpression: :is="item.component" или :is="obj.prop"
  // ──────────────────────────────────────────────────────
  const memberMatch = expr.match(/^(\w+)\.(\w+)$/);
  if (memberMatch) {
    const mapName = memberMatch[1];
    const map = maps.find(m => m.name === mapName);
    if (map) {
      dyn.resolvedComponents = Object.entries(map.entries).map(([key, value]) => {
        const imp = imports.find((i: any) => i.localName === value);
        return {
          key,
          name: value,
          fileId: imp?.toFileId ?? null,
          importId: imp?.id ?? null,
        };
      });
      return dyn.resolvedComponents.length;
    }
    return 0;
  }

  // ──────────────────────────────────────────────────────
  // 3. Index access: :is="icons[type]" или :is="map[key]"
  // ──────────────────────────────────────────────────────
  const indexMatch = expr.match(/^(\w+)\[/);
  if (indexMatch) {
    const mapName = indexMatch[1];
    const map = maps.find(m => m.name === mapName);
    if (map) {
      dyn.resolvedComponents = Object.entries(map.entries).map(([key, value]) => {
        const imp = imports.find((i: any) => i.localName === value);
        return {
          key,
          name: value,
          fileId: imp?.toFileId ?? null,
          importId: imp?.id ?? null,
        };
      });
      return dyn.resolvedComponents.length;
    }
    return 0;
  }

  // ──────────────────────────────────────────────────────
  // 4. Тернарный оператор: :is="cond ? 'A' : 'B'"
  // ──────────────────────────────────────────────────────
  const ternaryComponents = extractTernaryComponents(expr, imports);
  if (ternaryComponents.length > 0) {
    dyn.resolvedComponents = ternaryComponents;
    return ternaryComponents.length;
  }

  // ──────────────────────────────────────────────────────
  // 5. Fallback: поиск по имени в imports (например, `Icon`)
  // ──────────────────────────────────────────────────────
  const fallbackImp = imports.find((i: any) => {
    const local = i.localName;
    const imported = i.importedName;
    if (!local) return false;
    return (
      local === expr ||
      imported === expr ||
      (typeof local === 'string' && local.startsWith(expr)) ||
      (typeof imported === 'string' && imported.startsWith(expr))
    );
  });

  if (fallbackImp) {
    dyn.resolvedComponents = [
      {
        name: fallbackImp.importedName,
        fileId: fallbackImp.toFileId,
        importId: fallbackImp.id,
        isExternal: fallbackImp.isExternal,
      },
    ];
    return 1;
  }

  return 0;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

/**
 * Проверяет, является ли выражение простым идентификатором.
 * Отсекает: a.b, a[0], a ? b : c, () => x, `template`, 'literal'.
 */
function isSimpleIdentifier(expr: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(expr);
}

/**
 * Извлекает компоненты из тернарного выражения.
 * :is="cond ? 'A' : 'B'"
 * :is="cond ? IconA : IconB"
 */
function extractTernaryComponents(
  expr: string,
  imports: any[]
): Array<{ name: string; fileId: string | null; importId: string | null; isExternal?: boolean }> {
  const result: Array<{
    name: string;
    fileId: string | null;
    importId: string | null;
    isExternal?: boolean;
  }> = [];

  // Разбиваем по `?` и `:` — но это грубо, для простых случаев
  const ternaryMatch = expr.match(/^(.+?)\?(.+?):(.+)$/);
  if (!ternaryMatch) return result;

  const branches = [ternaryMatch[2], ternaryMatch[3]];

  for (const branch of branches) {
    const trimmed = branch?.trim() ?? '';
    if (!trimmed) continue;

    // Строковый литерал: 'IconA'
    const strMatch = trimmed.match(/^['"]([^'"]+)['"]$/);
    if (strMatch?.[1]) {
      const name = strMatch[1];
      const imp = imports.find(
        (i: any) =>
          i.localName === name ||
          i.importedName === name ||
          i.localName === toPascalCase(name) ||
          i.localName === toKebabCase(name)
      );
      result.push({
        name,
        fileId: imp?.toFileId ?? null,
        importId: imp?.id ?? null,
        isExternal: imp?.isExternal ?? false,
      });
      continue;
    }

    // Идентификатор: IconA
    if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
      const imp = imports.find((i: any) => i.localName === trimmed || i.importedName === trimmed);
      result.push({
        name: trimmed,
        fileId: imp?.toFileId ?? null,
        importId: imp?.id ?? null,
        isExternal: imp?.isExternal ?? false,
      });
    }
  }

  return result;
}

/**
 * Собирает локальные переменные, которые могут быть компонентами:
 *   const Icon = SomeComponent
 *   const icon = MyIcon
 *   let component = null
 *
 * Возвращает Map<localName, targetName>, где targetName — это имя,
 * на которое указывает переменная.
 */
function extractAvailableComponents(sourceFile: SourceFile): Map<string, string> {
  const result = new Map<string, string>();

  if (!sourceFile) return result;

  try {
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const name = varDecl.getName();
      const init = varDecl.getInitializer();
      if (!init) continue;

      // const Icon = SomeComponent
      if (Node.isIdentifier(init)) {
        result.set(name, init.getText());
        continue;
      }

      // const Icon = SomeComponent.something
      if (Node.isPropertyAccessExpression(init)) {
        result.set(name, init.getName());
        continue;
      }

      // const Icon = condition ? A : B → пропускаем
      // const Icon = () => import(...) → пропускаем
    }
  } catch {
    // Игнорируем ошибки
  }

  return result;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { resolveDynamicComponents };
