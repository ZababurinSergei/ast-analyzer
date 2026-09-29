// src/reporters/compact/vue/component-usage.ts
// ============================================================
// COMPONENT USAGE + HTML ELEMENTS (v16.2.0)
// ============================================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0 (FIX: переустановка id вместе с usageId):
//   - ✅ ИСПРАВЛЕНО: в processComponentUsage для каждого вложенного
//     элемента (props/events/directives/slots/interpolations)
//     переустанавливается НЕ ТОЛЬКО usageId, но и id.
//
//     ПРИЧИНА:
//       В v16.1.0 для cu/he присваивался новый глобальный
//       id (`cu1`, `cu2`, ..., `he1`, `he2`, ...), и
//       usageId у вложенных элементов обновлялся на этот id.
//       Но САМ id вложенных элементов (`cu1:cp7`, `he2:cp1`)
//       оставался СТАРЫМ — от исходного `analyzeVueComponent`,
//       где счётчики сбрасывались в каждом SFC.
//
//     СИМПТОМ В verify-roundtrip.ts (DEC):
//       $.vue.componentProps[6].id
//         a: "he2:cp1"    (decoded)
//         b: "he1:cp7"    (encode(decode(compact)))
//
//     СИМПТОМ В verify-consistency.ts:
//       $.vue.componentProps[28].usageId: "he1" → "he6"
//
//     РЕШЕНИЕ:
//       Формула id = `${newId}:cp${i + 1}` для props,
//       `${newId}:ce${i + 1}` для events,
//       `${newId}:cd${i + 1}` для directives,
//       `${newId}:csl${i + 1}` для slots,
//       `${newId}:hi${i + 1}` для interpolations.
//
//     Это ГАРАНТИРУЕТ согласованность id ↔ usageId и
//     стабильность round-trip L1/L2/DL/DEC/RE/ENC.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия: глобально уникальные cu.id/he.id,
//     parentFileId, переустановка usageId без id.
// ============================================================

import path from 'path';
import type {
  FileData,
  ComponentUsage,
  HtmlElementUsage,
} from '../../codec/codec-types.js';
import {
  extractIdentifierFromValue,
  extractMemberChainFromValue,
  extractLiteralFromValue,
} from '../ids/value-extractors.js';

// ============================================================
// 1. PROCESS COMPONENT USAGE
// ============================================================

/**
 * Обрабатывает vue.sfc[] — присваивает глобальные id.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Сортировка vue.sfc[] по индексу в files[].
 *   2. Глобальные счётчики globalCuCounter / globalHeCounter.
 *   3. Для каждого SFC:
 *      a. Найти enhanced-запись в workingEntitiesMap.
 *      b. Прочитать templateComponentUsages / templateHtmlElements.
 *      c. Создать новые cu/he с глобально уникальными id:
 *           cu.id = 'cu' + globalCuCounter,
 *           he.id = 'he' + globalHeCounter,
 *           parentFileId = sfc.fileId.
 *      d. Переустановить id + usageId во всех вложенных элементах.
 *      e. Сохранить новые массивы в sfc.componentUsages/htmlElements.
 *      f. Если есть vueAnalysis — заменить props/emits/exposed
 *         на реальные имена.
 *   4. Вернуть { totalComponentUsages, totalHtmlElements }.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ СОРТИРОВКА ПО files[]
 * ════════════════════════════════════════════════════════════
 *
 *   vue.sfc[] изначально идёт в порядке Object.entries(entitiesMap).
 *   Этот порядок зависит от вставки в Map и МОЖЕТ отличаться
 *   между encode(full) и encode(decode(encode(full))).
 *
 *   Сортировка по fileIdToIndex (индекс в files[]) гарантирует
 *   стабильный порядок, потому что files[] строится в pass-1
 *   из отсортированных ключей entitiesMap.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ ПЕРЕУСТАНАВЛИВАЕТСЯ И id, И usageId (v2.0.0)
 * ════════════════════════════════════════════════════════════
 *
 *   При анализе Vue SFC (`analyzeVueComponent`) счётчики
 *   cu/he сбрасываются в каждом файле. Значит, в разных SFC
 *   могут быть одинаковые `he1:cp1`, `he1:cp2`, ... Это
 *   коллизия.
 *
 *   В processComponentUsage мы присваиваем глобальные
 *   `he1, he2, ..., heN` и обновляем `usageId`. Но если
 *   `id` оставить старым (`he1:cp1`), то:
 *     - `propsByUsage.get("he2")` вернёт правильные props
 *       (usageId обновлён);
 *     - но сам prop имеет `id = "he1:cp1"`, что
 *       рассогласовано с `usageId = "he2"`.
 *
 *   encode(full) → `addId(dict, "he1:cp1")` → decode →
 *   `ids[idx] = "he1:cp1"` → `usageId = "he1"`.
 *   Рассинхрон.
 *
 *   Поэтому ОБНОВЛЯЕМ ОБА поля: `id = ${newId}:cp${i + 1}` и
 *   `usageId = newId`. Порядок индексов (`cp${i + 1}`) сохраняет
 *   соответствие оригинальным id.
 *
 * @param vue                  — VueSectionFull (мутируется)
 * @param files                — массив FileData[] (для сортировки)
 * @param workingEntitiesMap   — Record<filePath, EntitiesResult>
 * @param verbose              — подробный вывод
 * @returns { totalComponentUsages, totalHtmlElements }
 */
export function processComponentUsage(
  vue: any,
  files: FileData[],
  workingEntitiesMap: Record<string, any>,
  verbose: boolean
): {
  totalComponentUsages: number;
  totalHtmlElements: number;
} {
  // ────────────────────────────────────────────────────────
  // Ранний выход, если vue.sfc отсутствует
  // ────────────────────────────────────────────────────────
  if (!vue || !Array.isArray(vue.sfc)) {
    return { totalComponentUsages: 0, totalHtmlElements: 0 };
  }

  // ══════════════════════════════════════════════════════
  // Шаг 1: сортировка vue.sfc[] по индексу в files[]
  // ══════════════════════════════════════════════════════
  const fileIdToIndex = new Map<string, number>();
  files.forEach((f, i) => fileIdToIndex.set(f.id, i));

  vue.sfc.sort((a: any, b: any) => {
    const ai = fileIdToIndex.get(a.fileId) ?? Number.MAX_SAFE_INTEGER;
    const bi = fileIdToIndex.get(b.fileId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  if (verbose) {
    console.log(`   🔢 vue.sfc отсортирован по files[] (${vue.sfc.length} элементов)`);
  }

  // ══════════════════════════════════════════════════════
  // Шаг 2: глобальные счётчики + аккумуляторы
  // ══════════════════════════════════════════════════════
  const allComponentUsages: ComponentUsage[] = [];
  const allHtmlElements: HtmlElementUsage[] = [];

  let globalCuCounter = 0;
  let globalHeCounter = 0;
  let notFoundCount = 0;

  // ══════════════════════════════════════════════════════
  // Шаг 3: обработка каждого SFC
  // ══════════════════════════════════════════════════════
  for (const sfc of vue.sfc) {
    // 3.0. Гарантируем наличие массивов
    if (!Array.isArray(sfc.componentUsages)) sfc.componentUsages = [];
    if (!Array.isArray(sfc.htmlElements)) sfc.htmlElements = [];

    // 3.1. Найти sfcFile по fileId
    const sfcFile = files.find(f => f.id === sfc.fileId);
    if (!sfcFile) {
      notFoundCount++;
      continue;
    }

    const sfcPath = sfcFile.path;
    const normalizedSfcPath = sfcPath.replace(/\\/g, '/');
    const targetBasename = path.basename(normalizedSfcPath);

    // 3.2. Найти enhanced-запись (4 уровня fallback)
    let enhanced: any = workingEntitiesMap[sfcPath];
    if (!enhanced) enhanced = workingEntitiesMap[normalizedSfcPath];

    if (!enhanced) {
      for (const [key, value] of Object.entries(workingEntitiesMap)) {
        if (path.basename(key) === targetBasename) {
          enhanced = value;
          break;
        }
      }
    }

    if (!enhanced) {
      for (const [key, value] of Object.entries(workingEntitiesMap)) {
        const normalizedKey = key.replace(/\\/g, '/');
        if (
          normalizedKey.endsWith('/' + normalizedSfcPath) ||
          normalizedSfcPath.endsWith('/' + normalizedKey)
        ) {
          enhanced = value;
          break;
        }
      }
    }

    // 3.3. Если не нашли — пропускаем
    if (!enhanced) {
      notFoundCount++;
      if (verbose) {
        console.warn(
          `   ⚠️ v16.1.0: enhancedMap не содержит данных для SFC ${sfc.fileId} (${sfcPath})`
        );
      }
      continue;
    }

    // 3.4. Читаем данные из pipeline
    const rawCu: ComponentUsage[] = (enhanced as any).templateComponentUsages || [];
    const rawHe: HtmlElementUsage[] = (enhanced as any).templateHtmlElements || [];

    // 3.5. Присваиваем новые глобально уникальные id
    //      (v2.0.0: обновляем И id, И usageId)
    const newCu: ComponentUsage[] = rawCu.map(c => {
      globalCuCounter++;
      const newId = `cu${globalCuCounter}`;
      return {
        ...c,
        id: newId,
        parentFileId: sfc.fileId,
        props: (c.props ?? []).map((p, i) => ({
          ...p,
          id: `${newId}:cp${i + 1}`,
          usageId: newId,
        })),
        events: (c.events ?? []).map((e, i) => ({
          ...e,
          id: `${newId}:ce${i + 1}`,
          usageId: newId,
        })),
        directives: (c.directives ?? []).map((d, i) => ({
          ...d,
          id: `${newId}:cd${i + 1}`,
          usageId: newId,
        })),
        slots: (c.slots ?? []).map((s, i) => ({
          ...s,
          id: `${newId}:csl${i + 1}`,
          usageId: newId,
        })),
      };
    });

    const newHe: HtmlElementUsage[] = rawHe.map(h => {
      globalHeCounter++;
      const newId = `he${globalHeCounter}`;
      return {
        ...h,
        id: newId,
        parentFileId: sfc.fileId,
        props: (h.props ?? []).map((p, i) => ({
          ...p,
          id: `${newId}:cp${i + 1}`,
          usageId: newId,
        })),
        events: (h.events ?? []).map((e, i) => ({
          ...e,
          id: `${newId}:ce${i + 1}`,
          usageId: newId,
        })),
        directives: (h.directives ?? []).map((d, i) => ({
          ...d,
          id: `${newId}:cd${i + 1}`,
          usageId: newId,
        })),
        interpolations: (h.interpolations ?? []).map((it, i) => ({
          ...it,
          id: `${newId}:hi${i + 1}`,
          usageId: newId,
        })),
      };
    });

    // 3.6. Сохраняем в sfc
    sfc.componentUsages = newCu;
    sfc.htmlElements = newHe;

    // 3.7. Накапливаем в allComponentUsages / allHtmlElements
    allComponentUsages.push(...newCu);
    allHtmlElements.push(...newHe);

    // 3.8. Реальные props/emits/exposed из vueAnalysis
    const vueAnalysis = (enhanced as any).vueAnalysis;
    if (vueAnalysis) {
      if (Array.isArray(vueAnalysis.props?.names) && vueAnalysis.props.names.length > 0) {
        sfc.props = vueAnalysis.props.names;
      }
      if (Array.isArray(vueAnalysis.emits?.names) && vueAnalysis.emits.names.length > 0) {
        sfc.emits = vueAnalysis.emits.names;
      }
      if (Array.isArray(vueAnalysis.expose) && vueAnalysis.expose.length > 0) {
        sfc.exposed = vueAnalysis.expose;
      }
    }
  }

  // ══════════════════════════════════════════════════════
  // Шаг 4: диагностика + возврат
  // ══════════════════════════════════════════════════════
  if (verbose) {
    console.log('');
    console.log('   📊 Component Usage (v16.2.0, глобальные id + usageId):');
    console.log(`      SFC:              ${vue.sfc.length}`);
    console.log(`      componentUsages:  ${allComponentUsages.length}`);
    console.log(`      htmlElements:     ${allHtmlElements.length}`);
    if (notFoundCount > 0) {
      console.warn(`      ⚠️ SFC без данных: ${notFoundCount}`);
    }
  }

  return {
    totalComponentUsages: allComponentUsages.length,
    totalHtmlElements: allHtmlElements.length,
  };
}

// ============================================================
// 2. FILL COMPONENT ACCUMULATORS
// ============================================================

/**
 * Заполняет top-level аккумуляторы component*.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   Для каждого SFC в vue.sfc[]:
 *     a. Для каждого cu в sfc.componentUsages[]:
 *        • props[]         → allComponentProps
 *        • events[]        → allComponentEvents
 *        • directives[]    → allComponentDirectives
 *        • slots[]         → allComponentSlots
 *
 *     b. Для каждого he в sfc.htmlElements[]:
 *        • props[]          → allComponentProps
 *        • events[]         → allComponentEvents
 *        • directives[]     → allComponentDirectives
 *        • interpolations[] → allHtmlInterpolations
 *
 * ════════════════════════════════════════════════════════════
 * ОБОГАЩЕНИЕ PROPS
 * ════════════════════════════════════════════════════════════
 *
 *   Для каждого prop дополнительно извлекаем:
 *     • identifier    — первый идентификатор в value
 *                       ('props.toolbarItems' → 'props')
 *     • memberChain   — цепочка member-доступов
 *                       (['props', 'toolbarItems'])
 *     • literalValue  — литеральное значение
 *                       ('true' → true, '42' → 42, "'click'" → 'click')
 *
 *   Через функции из ../ids/value-extractors.js.
 *
 * ════════════════════════════════════════════════════════════
 * СИММЕТРИЯ С codec-decode.ts
 * ════════════════════════════════════════════════════════════
 *
 *   codec-decode.ts v16.0.4 ВСЕГДА восстанавливает 5 top-level
 *   полей (componentProps, componentEvents, componentDirectives,
 *   componentSlots, htmlInterpolations), даже если они [].
 *
 *   Эта функция гарантирует, что full.json содержит те же поля
 *   с теми же значениями (для round-trip L1/L2/DL/DEC).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   Вход:
 *     vue.sfc[0].componentUsages = [
 *       {
 *         id: 'cu1',
 *         parentFileId: 'f18',
 *         tag: 'AiToolbar',
 *         props: [
 *           { id: 'cu1:cp1', usageId: 'cu1', name: 'user-toolbar-items',
 *             value: 'props.toolbarItems', kind: 'dynamic', line: 5 },
 *         ],
 *         events: [
 *           { id: 'cu1:ce1', usageId: 'cu1',
 *             eventName: 'column-chooser-change',
 *             handler: 'setColumnsVisibility', ... },
 *         ],
 *         directives: [...],
 *         slots: [...],
 *       },
 *     ]
 *     allComponentProps = []
 *
 *   Выход:
 *     allComponentProps = [
 *       {
 *         id: 'cu1:cp1',
 *         usageId: 'cu1',
 *         name: 'user-toolbar-items',
 *         value: 'props.toolbarItems',
 *         kind: 'dynamic',
 *         line: 5,
 *         identifier: 'props',
 *         memberChain: ['props', 'toolbarItems'],
 *         literalValue: undefined,
 *         sourceChain: [],
 *       },
 *     ]
 *
 * @param vue                     — VueSectionFull
 * @param allComponentProps       — аккумулятор props (мутируется)
 * @param allComponentEvents      — аккумулятор events (мутируется)
 * @param allComponentDirectives  — аккумулятор directives (мутируется)
 * @param allComponentSlots       — аккумулятор slots (мутируется)
 * @param allHtmlInterpolations   — аккумулятор interpolations (мутируется)
 */
export function fillComponentAccumulators(
  vue: any,
  allComponentProps: any[],
  allComponentEvents: any[],
  allComponentDirectives: any[],
  allComponentSlots: any[],
  allHtmlInterpolations: any[]
): void {
  if (!vue || !Array.isArray(vue.sfc)) return;

  for (const sfc of vue.sfc) {
    // ══════════════════════════════════════════════════════
    // 1. Component Usages
    // ══════════════════════════════════════════════════════
    for (const cu of sfc.componentUsages ?? []) {
      // 1.1. Props
      for (const p of cu.props ?? []) {
        allComponentProps.push({
          id: p.id,
          usageId: cu.id,
          name: p.name,
          value: p.value,
          kind: p.kind,
          line: p.line,
          identifier: extractIdentifierFromValue(p.value),
          memberChain: extractMemberChainFromValue(p.value),
          literalValue: extractLiteralFromValue(p.value),
          sourceChain: p.sourceChain ?? [],
        });
      }

      // 1.2. Events
      for (const e of cu.events ?? []) {
        allComponentEvents.push({
          id: e.id,
          usageId: cu.id,
          eventName: e.eventName,
          handler: e.handler,
          handlerFunctionId: e.handlerFunctionId ?? null,
          handlerSource: e.handlerSource ?? 'unknown',
          modifiers: e.modifiers ?? [],
          line: e.line,
          handlerChain: e.handlerChain ?? [],
        });
      }

      // 1.3. Directives
      for (const d of cu.directives ?? []) {
        allComponentDirectives.push({
          id: d.id,
          usageId: cu.id,
          name: d.name,
          argument: d.argument,
          modifiers: d.modifiers ?? [],
          value: d.value,
          line: d.line,
        });
      }

      // 1.4. Slots
      for (const s of cu.slots ?? []) {
        allComponentSlots.push({
          id: s.id,
          usageId: cu.id,
          slotName: s.slotName,
          isScoped: s.isScoped,
          scopeNames: s.scopeNames ?? [],
          line: s.line,
        });
      }
    }

    // ══════════════════════════════════════════════════════
    // 2. HTML Elements
    // ══════════════════════════════════════════════════════
    for (const he of sfc.htmlElements ?? []) {
      // 2.1. Props
      for (const p of he.props ?? []) {
        allComponentProps.push({
          id: p.id,
          usageId: he.id,
          name: p.name,
          value: p.value,
          kind: p.kind,
          line: p.line,
          identifier: extractIdentifierFromValue(p.value),
          memberChain: extractMemberChainFromValue(p.value),
          literalValue: extractLiteralFromValue(p.value),
          sourceChain: p.sourceChain ?? [],
        });
      }

      // 2.2. Events
      for (const e of he.events ?? []) {
        allComponentEvents.push({
          id: e.id,
          usageId: he.id,
          eventName: e.eventName,
          handler: e.handler,
          handlerFunctionId: e.handlerFunctionId ?? null,
          handlerSource: e.handlerSource ?? 'unknown',
          modifiers: e.modifiers ?? [],
          line: e.line,
          handlerChain: e.handlerChain ?? [],
        });
      }

      // 2.3. Directives
      for (const d of he.directives ?? []) {
        allComponentDirectives.push({
          id: d.id,
          usageId: he.id,
          name: d.name,
          argument: d.argument,
          modifiers: d.modifiers ?? [],
          value: d.value,
          line: d.line,
        });
      }

      // 2.4. Interpolations
      for (const i of he.interpolations ?? []) {
        allHtmlInterpolations.push({
          id: i.id,
          usageId: he.id,
          expression: i.expression,
          sourceChain: i.sourceChain ?? [],
          line: i.line,
        });
      }
    }
  }
}
