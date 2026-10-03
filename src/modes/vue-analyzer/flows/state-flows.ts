// src/modes/vue-analyzer/flows/state-flows.ts
// ============================================================
// BUILD VUE STATE FLOWS
// ============================================================
// Версия: 2.1.0 (ENTERPRISE)
//
// ИЗМЕНЕНИЯ v2.1.0 (A4.7 — фикс сопоставления writes/reads):
//   - ✅ ИСПРАВЛЕНО: info.writes/reads содержат ИМЯ переменной
//     (isEditableMode), а НЕ имя функции. Ищем функции, чьи calls
//     содержат это имя.
//   - 🐛 ПРИЧИНА: v2.0.0 искал functionsByName.get(writeName) —
//     это работало бы, если writes содержал имена функций.
//     Но A4.6 пишет ИМЯ реактивной переменной.
//   - 🎯 ЭФФЕКТ: mutatedBy/readBy теперь обогащаются для реальных
//     мутаций (.value =, .value.push и т.д.).
//
// ИЗМЕНЕНИЯ v2.0.0 (ENTERPRISE):
//   - ✅ ДОБАВЛЕНО: использование `templateReactivityInfo` из entitiesMap.
//   - ✅ ДОБАВЛЕНО: использование `templateFunctions` из entitiesMap.
//   - ✅ ДОБАВЛЕНО: resolveFunctionIdByName.
//   - ✅ ИСПРАВЛЕНО: sourceChain?: any[] вместо string[] (A2.1).
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО TS6133: параметр `kind` в `isReadOf`.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия: mutatedBy / readBy / renderedIn для reactivity.
//
// ════════════════════════════════════════════════════════════
// ИСТОЧНИКИ ДАННЫХ (ENTERPRISE)
// ════════════════════════════════════════════════════════════
//
//   1. vue.reactivity[]                            — reactivity (id/name/kind/fileId)
//   2. entitiesMap[.vue].templateReactivityInfo[]  — reads[]/writes[]  ← ENTERPRISE
//   3. entitiesMap[.vue].templateFunctions[]       — функции с calls ← ENTERPRISE
//   4. vue.sfc[].htmlElements[]                    — renderedIn
//
// ════════════════════════════════════════════════════════════
// АЛГОРИТМ (v2.1.0)
// ════════════════════════════════════════════════════════════
//
//   Для каждой reactivity r (rx1, rx2, ...):
//
//     mutatedBy:
//       1. Найти templateReactivityInfo с name === r.name
//       2. info.writes[] содержит ИМЯ переменной (isEditableMode)
//       3. Ищем ВСЕ функции, чьи calls содержат это имя
//       4. Каждую такую функцию добавляем в mutatedBy
//
//     readBy:
//       Аналогично, но из info.reads[]
//
//     renderedIn:
//       Из vue.sfc[].htmlElements[] — props/directives/interpolations/events
//
// ============================================================

import type { VueStateFlow } from '../types.js';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

/**
 * Минимальная форма reactivity для анализа.
 * Соответствует `ReactivityEntity` из codec-types.ts.
 */
export interface ReactivityLike {
  id: string;
  fileId: string;
  kind: 'computed' | 'ref' | 'reactive' | 'watch' | 'shallowRef' | 'readonly' | 'toRef' | 'toRefs';
  line: number;
  name?: string;
  usedInTemplate?: boolean;
}

/**
 * Минимальная форма функции для анализа calls.
 */
export interface FunctionLike {
  id: string;
  name: string;
  fileId?: string;
  line?: number;
  calls?: string[];
}

/**
 * Минимальная форма HTML-элемента (из vue.sfc[].htmlElements[]).
 */
export interface HtmlElementLike {
  id: string;
  parentFileId: string;
  tag: string;
  line: number;
  column?: number;
  props?: Array<{
    id: string;
    usageId: string;
    name: string;
    value: string;
    kind: string;
    line: number;
    identifier?: string | null;
  }>;
  events?: Array<{
    id: string;
    usageId: string;
    eventName: string;
    handler: string;
    modifiers?: string[];
    line: number;
  }>;
  directives?: Array<{
    id: string;
    usageId: string;
    name: string;
    value: string;
    modifiers?: string[];
    line: number;
  }>;
  interpolations?: Array<{
    id: string;
    usageId: string;
    expression: string;
    sourceChain?: any[]; // ✅ A2.1: SourceChainItem[] вместо string[]
    line: number;
  }>;
}

/**
 * Минимальная форма SFC (из vue.sfc[]).
 */
export interface SfcLike {
  fileId: string;
  moduleId: string;
  name: string;
  blocks: number;
  htmlElements?: HtmlElementLike[];
  componentUsages?: unknown[];
}

/**
 * Минимальная форма VueSectionFull — только нужные поля.
 */
export interface VueSectionLike {
  reactivity?: ReactivityLike[];
  sfc?: SfcLike[];
}

/**
 * ✅ v18.0.0 (ENTERPRISE): минимальная форма ReactivityInfo
 * из templateReactivityInfo.
 */
export interface ReactivityInfoLike {
  kind: string;
  line: number;
  functionName?: string;
  reads: string[];
  writes: string[];
  isWriteable: boolean;
  name?: string;
}

/**
 * ✅ v18.0.0 (ENTERPRISE): минимальная форма EntitiesResult
 * для доступа к template* полям.
 */
export interface EntitiesMapLike {
  [filePath: string]: {
    templateFunctions?: Array<{
      name: string;
      line: number;
      isAsync?: boolean;
      isExported?: boolean;
      params?: string[];
      returnType?: string;
      body?: string;
      calls?: string[];
      calledBy?: string[];
      isExposed?: boolean;
    }>;
    templateReactivityInfo?: ReactivityInfoLike[];
  };
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит VueStateFlow[] из vue.reactivity + entitiesMap + functions.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 * @param vue           — Vue-секция FullJSON (reactivity + sfc)
 * @param allFunctions  — все функции (для поиска calls)
 * @param entitiesMap   — ✅ ENTERPRISE: для доступа к templateFunctions/templateReactivityInfo
 *
 * @returns VueStateFlow[]
 */
export function buildVueStateFlows(
  vue: VueSectionLike,
  allFunctions: FunctionLike[],
  entitiesMap?: EntitiesMapLike
): VueStateFlow[] {
  const flows: VueStateFlow[] = [];

  const reactivity = vue.reactivity ?? [];
  const sfc = vue.sfc ?? [];

  if (reactivity.length === 0) {
    return flows;
  }

  // ────────────────────────────────────────────────────────
  // 1. Индексы для быстрого поиска
  // ────────────────────────────────────────────────────────

  // Функции по fileId (для fallback-эвристики)
  const functionsByFileId = new Map<string, FunctionLike[]>();
  for (const fn of allFunctions) {
    const fid = fn.fileId ?? '';
    if (!functionsByFileId.has(fid)) functionsByFileId.set(fid, []);
    functionsByFileId.get(fid)!.push(fn);
  }

  // SFC по fileId
  const sfcByFileId = new Map<string, SfcLike>();
  for (const s of sfc) {
    sfcByFileId.set(s.fileId, s);
  }

  // ✅ ENTERPRISE: агрегируем templateReactivityInfo по name → info
  const reactivityInfoByName = new Map<string, ReactivityInfoLike>();
  if (entitiesMap) {
    for (const ent of Object.values(entitiesMap)) {
      for (const info of ent.templateReactivityInfo ?? []) {
        if (info.name && !reactivityInfoByName.has(info.name)) {
          reactivityInfoByName.set(info.name, info);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // 2. Основной цикл по reactivity
  // ────────────────────────────────────────────────────────

  for (let i = 0; i < reactivity.length; i++) {
    const r = reactivity[i]!;

    // Пропускаем reactivity без имени (анонимные)
    if (!r.name) continue;

    const stateName = r.name;
    const kind = normalizeReactivityKind(r.kind);

    // ──────────────────────────────────────────────────
    // 2a. mutatedBy / readBy — ENTERPRISE через templateReactivityInfo
    // ──────────────────────────────────────────────────

    const mutatedBy: VueStateFlow['mutatedBy'] = [];
    const readBy: VueStateFlow['readBy'] = [];

    const info = reactivityInfoByName.get(stateName);

    if (info) {
      // ✅ v2.1.0 (A4.7): info.writes содержит ИМЯ переменной
      //   (isEditableMode), а не имя функции.
      //
      //   Ищем ВСЕ функции, чьи calls содержат это имя.
      //
      //   Пример:
      //     info.writes = ['isEditableMode']
      //     allFunctions = [
      //       { id: 'f60:enableEditMode:47', name: 'enableEditMode',
      //         calls: ['isEditableMode'] }  ← совпадение
      //     ]
      //   → mutatedBy.push({ functionId: 'f60:enableEditMode:47', ... })
      //
      for (const writeName of info.writes) {
        for (const fn of allFunctions) {
          if (!fn.calls || fn.calls.length === 0) continue;
          if (fn.calls.includes(writeName)) {
            mutatedBy.push({
              functionId: fn.id,
              callId: `${fn.id}:${fn.line ?? 0}`,
              line: fn.line ?? 0,
            });
          }
        }
      }

      // readBy: аналогично, но из info.reads[]
      for (const readName of info.reads) {
        for (const fn of allFunctions) {
          if (!fn.calls || fn.calls.length === 0) continue;
          if (fn.calls.includes(readName) && !mutatedBy.some(m => m.functionId === fn.id)) {
            readBy.push({
              functionId: fn.id,
              line: fn.line ?? 0,
            });
          }
        }
      }
    } else {
      // Fallback: старая эвристика через calls и functionsByFileId
      const fileFunctions = functionsByFileId.get(r.fileId) ?? [];
      for (const fn of fileFunctions) {
        if (!fn.calls || fn.calls.length === 0) continue;

        let hasMutation = false;
        let hasRead = false;

        for (const callName of fn.calls) {
          if (isMutationOf(callName, stateName, kind)) hasMutation = true;
          if (isReadOf(callName, stateName, kind)) hasRead = true;
        }

        if (hasMutation) {
          mutatedBy.push({
            functionId: fn.id,
            callId: `${fn.id}:${fn.line ?? 0}`,
            line: fn.line ?? 0,
          });
        }

        if (hasRead && !hasMutation) {
          readBy.push({
            functionId: fn.id,
            line: fn.line ?? 0,
          });
        }
      }
    }

    // ──────────────────────────────────────────────────
    // 2b. renderedIn — из sfc[].htmlElements[]
    // ──────────────────────────────────────────────────

    const renderedIn: VueStateFlow['renderedIn'] = [];

    const fileSfc = sfcByFileId.get(r.fileId);
    if (fileSfc && Array.isArray(fileSfc.htmlElements)) {
      for (const he of fileSfc.htmlElements) {
        // Props (attr)
        if (Array.isArray(he.props)) {
          for (const p of he.props) {
            if (p.identifier === stateName || (p.value && p.value.includes(stateName))) {
              renderedIn.push({
                htmlElementId: he.id,
                attrName: p.name || '<attr>',
                kind: 'attr',
                line: p.line ?? he.line,
              });
            }
          }
        }

        // Directives (conditional)
        if (Array.isArray(he.directives)) {
          for (const d of he.directives) {
            if (d.value && d.value.includes(stateName)) {
              renderedIn.push({
                htmlElementId: he.id,
                attrName: d.name || '<directive>',
                kind: 'conditional',
                line: d.line ?? he.line,
              });
            }
          }
        }

        // Interpolations (text)
        if (Array.isArray(he.interpolations)) {
          for (const interp of he.interpolations) {
            if (interp.expression && interp.expression.includes(stateName)) {
              renderedIn.push({
                htmlElementId: he.id,
                attrName: '<expression>',
                kind: 'text',
                line: interp.line ?? he.line,
              });
            }
          }
        }

        // Events (handler)
        if (Array.isArray(he.events)) {
          for (const ev of he.events) {
            if (ev.handler && ev.handler.includes(stateName)) {
              renderedIn.push({
                htmlElementId: he.id,
                attrName: `@${ev.eventName}`,
                kind: 'handler',
                line: ev.line ?? he.line,
              });
            }
          }
        }
      }
    }

    // ──────────────────────────────────────────────────
    // 2c. Итоговый flow
    // ──────────────────────────────────────────────────

    flows.push({
      id: `vsf${flows.length + 1}`,
      reactivityId: r.id,
      stateName,
      kind,
      mutatedBy,
      readBy,
      renderedIn,
    });
  }

  return flows;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Нормализует `kind` reactivity к допустимым значениям VueStateFlow.kind.
 */
function normalizeReactivityKind(
  kind: string
): 'ref' | 'reactive' | 'computed' | 'readonly' | 'watch' {
  switch (kind) {
    case 'computed':
      return 'computed';
    case 'ref':
    case 'shallowRef':
    case 'toRef':
    case 'toRefs':
      return 'ref';
    case 'reactive':
      return 'reactive';
    case 'readonly':
      return 'readonly';
    case 'watch':
    case 'watchEffect':
      return 'watch';
    default:
      return 'ref';
  }
}

/**
 * Проверяет, является ли callName мутацией stateName.
 *
 * ⚠️ Fallback-эвристика (используется если нет templateReactivityInfo).
 */
function isMutationOf(
  callName: string,
  stateName: string,
  kind: 'ref' | 'reactive' | 'computed' | 'readonly' | 'watch'
): boolean {
  if (kind === 'ref' || kind === 'computed' || kind === 'readonly') {
    if (callName === `${stateName}.value.push`) return true;
    if (callName === `${stateName}.value.pop`) return true;
    if (callName === `${stateName}.value.shift`) return true;
    if (callName === `${stateName}.value.unshift`) return true;
    if (callName === `${stateName}.value.splice`) return true;
    if (callName === `${stateName}.value.sort`) return true;
    if (callName === `${stateName}.value.reverse`) return true;
  }

  if (kind === 'reactive') {
    if (callName === `${stateName}.push`) return true;
    if (callName === `${stateName}.pop`) return true;
    if (callName === `${stateName}.shift`) return true;
    if (callName === `${stateName}.unshift`) return true;
    if (callName === `${stateName}.splice`) return true;
    if (callName === `${stateName}.sort`) return true;
    if (callName === `${stateName}.reverse`) return true;
  }

  return false;
}

/**
 * Проверяет, является ли callName чтением stateName.
 */
function isReadOf(
  callName: string,
  stateName: string,
  kind: 'ref' | 'reactive' | 'computed' | 'readonly' | 'watch'
): boolean {
  if (kind === 'reactive') {
    if (callName === stateName) return true;
    if (callName.startsWith(`${stateName}.`)) return true;
    return false;
  }

  if (callName === stateName) return true;
  if (callName === `${stateName}.value`) return true;
  if (callName.startsWith(`${stateName}.value.`)) return true;

  return false;
}
