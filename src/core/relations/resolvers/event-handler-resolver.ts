// src/core/relations/resolvers/event-handler-resolver.ts
// ============================================================
// МОДУЛЬ 4: РЕЗОЛВИНГ EVENT-HANDLER → FUNCTION
// ============================================================
// Версия: 1.1.0
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ ИСПРАВЛЕНО: используется `ctx.importsByFileId` (Map<fileId, ImportRecord[]>)
//     вместо `ctx.imports.filter(...)` — O(1) доступ вместо O(n).
//   - ✅ ИСПРАВЛЕНО: используется `ctx.functionsByFileId`
//     (Map<fileId, FunctionRecord[]>) — O(1) доступ к функциям файла.
//   - ✅ ДОБАВЛЕНО: детальная диагностика в debug-режиме —
//     показывает каждый unresolved handler и причину.
//   - ✅ ДОБАВЛЕНО: обработка inline-функций с извлечением calls
//     (handler.inlineCalls заполняется через extractCallsFromInlineHandler).
//   - ✅ ДОБАВЛЕНО: связывание inline-вызовов с реальными functionId,
//     если функция найдена в текущем файле или в imports.
//   - ✅ ДОБАВЛЕНО: поддержка $event в inline-выражениях
//     (например, @click="(e) => handleClick(e, row)").
//   - ✅ ДОБАВЛЕНО: разрешение handler-ов, приходящих из composables,
//     через localBindings (sourceFunctionId).
//   - ✅ ДОБАВЛЕНО: попытка связать handlerFunctionId через
//     ctx.index.functionByName, если функция определена в другом файле.
// ============================================================

import type {
  ResolverContext,
  ImportRecord,
  FunctionRecord,
  LocalBinding,
  InlineCall,
} from '../types.js';
import { extractCallsFromInlineHandler, isInlineHandler } from '../inline-handler-extractor.js';
import { toPascalCase } from '../global-index.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Резолвит все eventHandlers проекта в functionId.
 *
 * Для каждого @event="handlerName":
 *   1. Проверяет, не inline ли handler — если да, извлекает calls.
 *   2. Ищет функцию с таким именем в текущем файле.
 *   3. Если не найдена — ищет в localBindings (composable).
 *   4. Если не найдена — ищет через глобальный индекс (functionByName).
 *   5. Связывает с компонентом по тегу (componentImportId, componentFileId).
 *
 * @returns { resolved, inline } — количество разрешённых handler-ов.
 */
export function resolveEventHandlers(ctx: ResolverContext): {
  resolved: number;
  inline: number;
} {
  let resolved = 0;
  let inline = 0;
  let unresolved = 0;

  for (const [fileId, template] of ctx.templates) {
    const handlers: any[] = template.eventHandlers ?? [];
    if (handlers.length === 0) continue;

    const file = ctx.files.get(fileId);
    if (!file) continue;

    const fileFunctions = ctx.functionsByFileId.get(fileId) ?? [];
    const imports = ctx.importsByFileId.get(fileId) ?? [];
    const localBindings = ctx.localBindings.get(fileId) ?? [];

    for (const handler of handlers) {
      const handlerName: string = handler.handlerName ?? '';

      // ──────────────────────────────────────────────────
      // Ветка 1: Inline handler
      // ──────────────────────────────────────────────────
      if (isInlineHandler(handlerName)) {
        handler.isInline = true;
        handler.inlineCalls = extractCallsFromInlineHandler(handlerName);

        // Обогащаем inline-вызовы functionId, если функция найдена
        resolveInlineCalls(ctx, fileId, fileFunctions, imports, handler.inlineCalls);

        inline++;

        if (ctx.debug) {
          console.log(
            `   🔹 inline handler @${handler.eventName} на <${handler.tag}> ` +
              `(${file.path}:${handler.line}) → calls: [${handler.inlineCalls.map((c: InlineCall) => c.name).join(', ')}]`
          );
        }
        continue;
      }

      // ──────────────────────────────────────────────────
      // Ветка 2: Обычный handler
      // ──────────────────────────────────────────────────
      let matched = false;

      // 2a. Локальная функция в текущем файле
      const localFn = fileFunctions.find((f: FunctionRecord) => f.name === handlerName);
      if (localFn) {
        handler.handlerFunctionId = localFn.id;
        handler.handlerSource = 'local';
        resolved++;
        matched = true;
      }

      // 2b. Функция из localBindings (composable)
      if (!matched) {
        const localBinding = localBindings.find((b: LocalBinding) => b.localName === handlerName);

        if (localBinding) {
          handler.handlerFunctionId = null;
          handler.handlerSource = 'composable';
          handler.handlerSourceFunctionId = localBinding.sourceFunctionId;
          handler.handlerSourceFileId = localBinding.sourceFileId;
          handler.handlerSourceKey = localBinding.propertyName;
          resolved++;
          matched = true;
        }
      }

      // 2c. Функция через глобальный индекс (определена в другом файле)
      if (!matched) {
        const globalIds = ctx.index.functionByName.get(handlerName);
        if (globalIds && globalIds.length > 0) {
          // Берём первый — обычно уникально
          const globalFnId = globalIds[0]!;
          const globalFn = ctx.functions.get(globalFnId);

          handler.handlerFunctionId = globalFnId;
          handler.handlerSource = 'global';
          handler.handlerSourceFileId = globalFn?.fileId ?? null;
          resolved++;
          matched = true;
        }
      }

      // 2d. Не найден
      if (!matched) {
        unresolved++;
        handler.handlerSource = 'unresolved';

        if (ctx.debug) {
          console.log(
            `   ⚠️  handler "${handlerName}" не разрешён ` +
              `(@${handler.eventName} на <${handler.tag}>, ${file.path}:${handler.line})`
          );
        }
      }

      // ──────────────────────────────────────────────────
      // Ветка 3: Связываем с компонентом по тегу
      // ──────────────────────────────────────────────────
      if (handler.tag) {
        const importRec = findImportByTag(imports, handler.tag);

        if (importRec) {
          handler.componentImportId = importRec.id;
          handler.componentFileId = importRec.toFileId;
          handler.componentIsExternal = importRec.isExternal === true;
          handler.componentPackage = importRec.packageName ?? null;
        } else {
          // Fallback через componentByName
          const componentInfo = ctx.index.componentByName.get(handler.tag);
          if (componentInfo) {
            handler.componentFileId = componentInfo.fileId;
          }
        }
      }
    }
  }

  if (ctx.debug) {
    console.log(
      `   📊 eventHandlers: resolved=${resolved}, inline=${inline}, unresolved=${unresolved}`
    );
  }

  return { resolved, inline };
}

// ============================================================
// РЕЗОЛВИНГ INLINE-ВЫЗОВОВ
// ============================================================

/**
 * Обогащает inline-вызовы functionId, если функция найдена
 * в текущем файле или в imports.
 *
 * @param ctx — контекст resolver-а
 * @param fileId — fileId текущего файла
 * @param fileFunctions — функции текущего файла
 * @param imports — импорты текущего файла
 * @param inlineCalls — массив InlineCall для обогащения (мутируется)
 */
function resolveInlineCalls(
  ctx: ResolverContext,
  fileId: string,
  fileFunctions: FunctionRecord[],
  imports: ImportRecord[],
  inlineCalls: InlineCall[]
): void {
  for (const call of inlineCalls) {
    if (!call.name) continue;

    // 1. Локальная функция
    const localFn = fileFunctions.find(f => f.name === call.name);
    if (localFn) {
      call.functionId = localFn.id;
      call.source = 'local';
      continue;
    }

    // 2. Функция из localBindings (composable)
    const localBindings = ctx.localBindings.get(fileId) ?? [];
    const localBinding = localBindings.find(b => b.localName === call.name);
    if (localBinding) {
      call.functionId = localBinding.sourceFunctionId ?? undefined;
      call.source = 'composable';
      call.sourceFileId = localBinding.sourceFileId ?? undefined;
      continue;
    }

    // 3. Импортированная функция
    const imp = imports.find(i => i.localName === call.name || i.importedName === call.name);
    if (imp) {
      call.source = 'import';
      call.sourceFileId = imp.toFileId ?? undefined;
      call.importId = imp.id;
      continue;
    }

    // 4. Через глобальный индекс
    const globalIds = ctx.index.functionByName.get(call.name);
    if (globalIds && globalIds.length > 0) {
      call.functionId = globalIds[0]!;
      call.source = 'global';
      continue;
    }

    // 5. Не найден
    call.source = 'unresolved';
  }
}

// ============================================================
// ПОИСК IMPORT ПО ТЕГУ
// ============================================================

/**
 * Находит import, соответствующий тегу компонента.
 *
 * Приоритет:
 *   1. Точное localName === tag
 *   2. Точное importedName === tag
 *   3. localName === toPascalCase(tag)
 *   4. localName === toKebabCase(tag)
 */
function findImportByTag(imports: ImportRecord[], tag: string): ImportRecord | null {
  // 1. Точное localName
  for (const imp of imports) {
    if (imp.localName === tag) return imp;
  }

  // 2. Точное importedName
  for (const imp of imports) {
    if (imp.importedName === tag) return imp;
  }

  // 3. PascalCase
  const pascal = toPascalCase(tag);
  if (pascal !== tag) {
    for (const imp of imports) {
      if (imp.localName === pascal || imp.importedName === pascal) {
        return imp;
      }
    }
  }

  // 4. Kebab-case
  const kebab = toKebabCaseLocal(tag);
  if (kebab !== tag) {
    for (const imp of imports) {
      if (imp.localName === kebab || imp.importedName === kebab) {
        return imp;
      }
    }
  }

  return null;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

/**
 * Локальная реализация toKebabCase (без импорта).
 */
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

export default { resolveEventHandlers };
