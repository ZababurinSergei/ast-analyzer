// src/reporters/compact/react/convert-section.ts
// ============================================================
// КОНВЕРТЕР REACT-СУЩНОСТЕЙ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Преобразует ReactEntities (результат classifyReactEntities)
// в структуру для FullJSON.react (позже станет ReactSectionFull).
//
// СИММЕТРИЯ С VUE
// ---------------
//   Vue:   reporters/compact/vue/convert-section.ts
//            → convertVueEntitiesToFull(vueEntities, fileMap, projectRoot)
//                  → VueSectionFull
//
//   React: reporters/compact/react/convert-section.ts ← этот файл
//            → convertReactEntitiesToFull(reactEntities, fileMap, projectRoot)
//                  → (позже) ReactSectionFull
//
// ОСОБЕННОСТЬ
// -----------
//   На Шаге 7 тип ReactSectionFull ещё не создан (Шаг 9),
//   поэтому возвращаем `any`. На Шаге 9 заменим на реальный тип.
//
// РЕЗОЛВИНГ FILEID
// ----------------
//   В ReactEntities.fileId — абсолютный путь к .tsx/.jsx файлу.
//   В FullJSON.react.components[].fileId — короткий ID (f1, f2, ...).
//
//   Резолвим так же, как Vue:
//     absolutePath = path.resolve(filePath)
//     relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/')
//     file = fileMap.get(relativePath)
//     fileId = file?.id ?? 'f1'
// ============================================================

import path from 'path';
import type { FileData } from '../../codec/codec-types.js';
import type { ReactEntities } from '../../../core/react-entity-classifier.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Конвертация ReactEntities → ReactSectionFull-совместимой структуры.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   reactEntities — результат classifyReactEntities(entitiesMap)
 *   fileMap       — Map<relativePath, FileData>
 *   projectRoot   — корень проекта (для резолва путей)
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Вспомогательные функции resolveFileId / resolveModuleId.
 *   2. Конвертация каждой секции ReactEntities:
 *      • components      — резолв fileId/moduleId
 *      • hooks           — резолв fileId
 *      • effects         — резолв fileId
 *      • contexts        — резолв fileId
 *      • memoization     — резолв fileId
 *      • refs            — резолв fileId
 *      • jsxElements     — резолв fileId
 *      • jsxEvents       — резолв fileId
 *      • conditionals    — резолв fileId
 *      • componentUsages — резолв fileId
 *   3. Возврат.
 */
export function convertReactEntitiesToFull(
  reactEntities: ReactEntities,
  fileMap: Map<string, FileData>,
  projectRoot: string
): any {
  // ────────────────────────────────────────────────────────
  // 1. Вспомогательные функции
  // ────────────────────────────────────────────────────────

  /**
   * Резолвит абсолютный путь в короткий fileId (f1, f2, ...).
   * Fallback — 'f1'.
   */
  const resolveFileId = (filePath: string): string => {
    if (!filePath) return 'f1';
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
    const file = fileMap.get(relativePath);
    return file?.id ?? 'f1';
  };

  /**
   * Резолвит абсолютный путь в moduleId (m1, m2, ...).
   * Fallback — 'm1'.
   */
  const resolveModuleId = (filePath: string): string => {
    if (!filePath) return 'm1';
    const fileId = resolveFileId(filePath);
    for (const [, f] of fileMap) {
      if (f.id === fileId) return f.moduleId;
    }
    return 'm1';
  };

  // ────────────────────────────────────────────────────────
  // 2. Конвертация секций
  // ────────────────────────────────────────────────────────

  return {
    // ======================================================
    // components
    // ======================================================
    components: (reactEntities.components ?? []).map(c => ({
      id: c.id,
      fileId: resolveFileId(c.fileId),
      moduleId: resolveModuleId(c.fileId),
      name: c.name,
      kind: c.kind,
      line: c.line,
      props: c.props ?? [],
      hooks: c.hooks ?? [],
      jsxElements: c.jsxElements ?? [],
      isMemoized: c.isMemoized ?? false,
      isForwardRef: c.isForwardRef ?? false,
      isDefaultExport: c.isDefaultExport ?? false,
      isExported: c.isExported ?? false,
    })),

    // ======================================================
    // hooks
    // ======================================================
    hooks: (reactEntities.hooks ?? []).map(h => ({
      id: h.id,
      fileId: resolveFileId(h.fileId),
      componentId: h.componentId ?? '',
      kind: h.kind,
      line: h.line,
      stateName: h.stateName,
      setterName: h.setterName,
      initialValue: h.initialValue,
      deps: h.deps ?? [],
      hasCleanup: h.hasCleanup ?? false,
      usedInRender: h.usedInRender ?? false,
    })),

    // ======================================================
    // effects
    // ======================================================
    effects: (reactEntities.effects ?? []).map(e => ({
      id: e.id,
      fileId: resolveFileId(e.fileId),
      componentId: e.componentId ?? '',
      hookId: e.hookId ?? '',
      kind: e.kind,
      line: e.line,
      deps: e.deps ?? [],
      hasCleanup: e.hasCleanup ?? false,
      reads: e.reads ?? [],
      mutates: e.mutates ?? [],
    })),

    // ======================================================
    // contexts
    // ======================================================
    contexts: (reactEntities.contexts ?? []).map(c => ({
      id: c.id,
      fileId: resolveFileId(c.fileId),
      componentId: c.componentId ?? '',
      kind: c.kind,
      line: c.line,
      name: c.name,
    })),

    // ======================================================
    // memoization
    // ======================================================
    memoization: (reactEntities.memoization ?? []).map(m => ({
      id: m.id,
      fileId: resolveFileId(m.fileId),
      componentId: m.componentId ?? '',
      kind: m.kind,
      line: m.line,
      deps: m.deps ?? [],
    })),

    // ======================================================
    // refs
    // ======================================================
    refs: (reactEntities.refs ?? []).map(r => ({
      id: r.id,
      fileId: resolveFileId(r.fileId),
      componentId: r.componentId ?? '',
      line: r.line,
      name: r.name,
      isForwardRef: r.isForwardRef ?? false,
    })),

    // ======================================================
    // jsxElements
    // ======================================================
    jsxElements: (reactEntities.jsxElements ?? []).map(el => ({
      id: el.id,
      fileId: resolveFileId(el.fileId),
      componentId: el.componentId ?? '',
      kind: el.kind,
      tagName: el.tagName,
      line: el.line,
      column: el.column,
      attrs: el.attrs ?? [],
      children: el.children ?? [],
      textContent: el.textContent,
      expression: el.expression,
      expressionRefs: el.expressionRefs ?? [],
      parentElementId: el.parentElementId,
      conditionalKind: el.conditionalKind,
      eventIds: el.eventIds ?? [],
      stateUsages: el.stateUsages ?? [],
      propUsages: el.propUsages ?? [],
      callExpressions: el.callExpressions ?? [],
    })),

    // ======================================================
    // jsxEvents
    // ======================================================
    jsxEvents: (reactEntities.jsxEvents ?? []).map(ev => ({
      id: ev.id,
      fileId: resolveFileId(ev.fileId),
      elementId: ev.elementId ?? '',
      eventName: ev.eventName,
      line: ev.line,
      handler: ev.handler,
      handlerFunctionId: ev.handlerFunctionId,
      source: ev.source,
      modifiers: ev.modifiers ?? [],
    })),

    // ======================================================
    // conditionals
    // ======================================================
    conditionals: (reactEntities.conditionals ?? []).map(cd => ({
      id: cd.id,
      fileId: resolveFileId(cd.fileId),
      componentId: cd.componentId ?? '',
      kind: cd.kind,
      condition: cd.condition,
      refs: cd.refs ?? [],
      line: cd.line,
      guards: cd.guards ?? [],
    })),

    // ======================================================
    // componentUsages
    // ======================================================
    componentUsages: (reactEntities.componentUsages ?? []).map(u => ({
      id: u.id,
      usageId: u.usageId ?? '',
      tagName: u.tagName,
      parentComponentId: u.parentComponentId ?? '',
      line: u.line,
      targetComponentId: u.targetComponentId,
      importedFrom: u.importedFrom,
      isExternal: u.isExternal ?? false,
      props: u.props ?? [],
      events: u.events ?? [],
      slots: u.slots ?? [],
    })),

    // ======================================================
    // Служебные поля (для codec, заполнятся позже)
    // ======================================================
    ids: [],
    sourceChains: [],
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  convertReactEntitiesToFull,
};
