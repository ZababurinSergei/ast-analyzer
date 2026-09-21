// src/core/relations/resolvers/ref-call-resolver.ts
// ============================================================
// МОДУЛЬ 3: РЕЗОЛВИНГ REF-CALL → EXPOSED-METHOD
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый параметр `fileId` в resolveOne
//   - ✅ ИСПРАВЛЕНО: используется `ctx.importsByFileId` вместо фильтрации
//     по всему массиву imports
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт (ImportRecord оставлен,
//     т.к. используется в типизации)
//   - ✅ ПОДДЕРЖКА: резолвинг через ctx.vueMacros (exposedMethods)
// ============================================================

import type { ResolverContext, RefCall, RefCallResolution, ImportRecord } from '../types.js';
import { toPascalCase } from '../global-index.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

export function resolveRefCalls(ctx: ResolverContext): number {
  let resolved = 0;

  for (const [fileId, template] of ctx.templates) {
    const refCalls = ctx.refCalls.get(fileId);
    if (!refCalls || refCalls.length === 0) continue;

    const file = ctx.files.get(fileId);
    if (!file) continue;

    for (const refCall of refCalls) {
      const resolution = resolveOne(ctx, fileId, template, refCall);
      if (resolution) {
        refCall.resolvedTo = resolution;
        resolved++;
      } else {
        refCall.resolvedTo = null;
        refCall.warning = 'method_not_resolved';
      }
    }
  }

  return resolved;
}

// ============================================================
// РЕЗОЛВИНГ ОДНОГО REF-CALL
// ============================================================

function resolveOne(
  ctx: ResolverContext,
  fileId: string,
  template: any,
  refCall: RefCall
): RefCallResolution | null {
  // 1. Находим templateRef с таким refValue
  const templateRef = (template.templateRefs ?? []).find(
    (r: any) => r.refValue === refCall.refName
  );
  if (!templateRef) return null;

  const tag = templateRef.tag;
  if (!tag) return null;

  // 2. Находим import по localName / importedName / PascalCase(tag)
  const imports: ImportRecord[] = ctx.importsByFileId.get(fileId) ?? [];

  const importRec = imports.find((i: ImportRecord) => {
    return i.localName === tag || i.importedName === tag || i.localName === toPascalCase(tag);
  });

  if (!importRec) {
    // Проверяем, не является ли это внешним компонентом по префиксу тега
    if (isExternalComponentTag(tag)) {
      return {
        fileId: '',
        importId: '',
        exposedMethodName: refCall.methodName,
        exposedMethodLine: 0,
        isExternal: true,
        libraryName: detectExternalLibrary(tag),
      };
    }
    return null;
  }

  // 3. Внешний импорт (node_modules)
  if (importRec.isExternal) {
    return {
      fileId: '',
      importId: importRec.id,
      exposedMethodName: refCall.methodName,
      exposedMethodLine: 0,
      isExternal: true,
      libraryName: importRec.packageName ?? importRec.source,
    };
  }

  if (!importRec.toFileId) return null;

  // 4. Находим targetTemplate
  const targetTemplate = ctx.templates.get(importRec.toFileId);

  if (targetTemplate) {
    const found = tryResolveInTemplate(importRec, targetTemplate, importRec.toFileId, refCall);
    if (found) return found;
  }

  // 5. Fallback через vueMacros.exposed
  const targetMacros = ctx.vueMacros.get(importRec.toFileId);
  if (targetMacros) {
    const exposed = targetMacros.exposed.find(m => m.name === refCall.methodName);
    if (exposed) {
      return {
        fileId: importRec.toFileId,
        importId: importRec.id,
        exposedMethodName: exposed.name,
        exposedMethodLine: exposed.line,
      };
    }
  }

  // 6. Fallback через global-index (componentByName)
  const componentInfo = ctx.index.componentByName.get(tag);
  if (componentInfo && componentInfo.fileId !== importRec.toFileId) {
    const fallbackTemplate = ctx.templates.get(componentInfo.fileId);
    if (fallbackTemplate) {
      const found = tryResolveInTemplate(
        importRec,
        fallbackTemplate,
        componentInfo.fileId,
        refCall
      );
      if (found) return found;
    }

    const fallbackMacros = ctx.vueMacros.get(componentInfo.fileId);
    if (fallbackMacros) {
      const exposed = fallbackMacros.exposed.find(m => m.name === refCall.methodName);
      if (exposed) {
        return {
          fileId: componentInfo.fileId,
          importId: importRec.id,
          exposedMethodName: exposed.name,
          exposedMethodLine: exposed.line,
        };
      }
    }
  }

  return null;
}

// ============================================================
// ПОПЫТКА РЕЗОЛВА В TEMPLATE
// ============================================================

function tryResolveInTemplate(
  importRec: ImportRecord,
  targetTemplate: any,
  targetFileId: string,
  refCall: RefCall
): RefCallResolution | null {
  // Ищем exposedMethod среди templateRefs[].exposedMethods
  const templateRefs = targetTemplate.templateRefs ?? [];

  for (const tr of templateRefs) {
    const methods = tr.exposedMethods ?? [];
    const found = methods.find((m: any) => m.name === refCall.methodName);
    if (found) {
      return {
        fileId: targetFileId,
        importId: importRec.id,
        exposedMethodName: found.name,
        exposedMethodLine: found.line ?? 0,
      };
    }
  }

  // Ищем в templateRefs[].exposedMethods как плоский массив строк
  const flatExposed = (targetTemplate as any).exposedMethods;
  if (Array.isArray(flatExposed)) {
    for (const m of flatExposed) {
      const name = typeof m === 'string' ? m : m.name;
      if (name === refCall.methodName) {
        return {
          fileId: targetFileId,
          importId: importRec.id,
          exposedMethodName: name,
          exposedMethodLine: typeof m === 'object' ? (m.line ?? 0) : 0,
        };
      }
    }
  }

  return null;
}

// ============================================================
// УТИЛИТЫ
// ============================================================

/**
 * Проверяет, похож ли тег на внешний компонент.
 * Эвристика: префикс n- (naive-ui), el- (element-plus), v- (vuetify)
 * или single-letter + CamelCase (NDataTable).
 */
function isExternalComponentTag(tag: string): boolean {
  if (!tag) return false;
  return (
    tag.startsWith('n-') ||
    tag.startsWith('el-') ||
    tag.startsWith('v-') ||
    /^[A-Z][a-z]?[A-Z]/.test(tag)
  );
}

/**
 * Определяет библиотеку по префиксу тега.
 */
function detectExternalLibrary(tag: string): string {
  if (tag.startsWith('n-') || /^N[A-Z]/.test(tag)) return 'naive-ui';
  if (tag.startsWith('el-') || /^El[A-Z]/.test(tag)) return 'element-plus';
  if (tag.startsWith('v-') || /^V[A-Z]/.test(tag)) return 'vuetify';
  return 'unknown';
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { resolveRefCalls };
