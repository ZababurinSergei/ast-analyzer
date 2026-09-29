// src/reporters/compact/ids/collect-ids.ts
// ============================================================
// СБОР УНИКАЛЬНЫХ ID (v16.1.0)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Собирает все сгенерированные id из component*-секций
// и возвращает их в порядке первого появления (интернирование).
//
// Используется для заполнения full.ids[] и compact.ids[].
//
// ════════════════════════════════════════════════════════════
// КАКИЕ ID СОБИРАЮТСЯ
// ════════════════════════════════════════════════════════════
//
//   1. vue.sfc[].componentUsages[].id              → cu1, cu2, ...
//   2. vue.sfc[].htmlElements[].id                 → he1, he2, ...
//   3. allComponentProps[].id                      → cu1:cp1, he2:cp3, ...
//   4. allComponentEvents[].id                     → cu1:ce1, he2:ce4, ...
//   5. allComponentDirectives[].id                 → cu1:cd1, he2:cd2, ...
//   6. allComponentSlots[].id                      → cu1:csl1, ...
//   7. allHtmlInterpolations[].id                  → he2:hi1, ...
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК СОБОРА (КРИТИЧНО ДЛЯ ROUND-TRIP)
// ════════════════════════════════════════════════════════════
//
//   Порядок ДОЛЖЕН совпадать с порядком addId в:
//     codec-encode.ts::encodeVueSection
//     codec-encode.ts::encodeComponentPropsInline
//     codec-encode.ts::encodeComponentEventsInline
//     codec-encode.ts::encodeComponentDirectivesInline
//     codec-encode.ts::encodeComponentSlotsInline
//     codec-encode.ts::encodeHtmlInterpolationsInline
//
//   Точный порядок:
//     1. cu.id   (все SFC, потом все componentUsages внутри SFC)
//     2. he.id   (все SFC, потом все htmlElements внутри SFC)
//     3. componentProps[].id
//     4. componentEvents[].id
//     5. componentDirectives[].id
//     6. componentSlots[].id
//     7. htmlInterpolations[].id
//
//   Если порядок нарушится — compact.ids и full.ids разойдутся,
//   и round-trip L1/L2/RE/ENC/DEC упадёт с расхождениями
//   вида: $.ids[0]: "he1:cp1" → "cu1:cp1".
//
// ════════════════════════════════════════════════════════════
// ПРИЧИНА ДЕДУПЛИКАЦИИ (v16.0.9)
// ════════════════════════════════════════════════════════════
//
//   compact-reporter.ts v16.0.8 формировал compact.ids в порядке
//   ПЕРВОГО вызова addId внутри encodeVueSection. При этом
//   full.ids собирался в порядке batched (все cu → все he).
//
//   Результат: рассинхрон → L1/L2/RE/ENC/DEC FAIL.
//
//   Решение v16.0.9:
//     - full.ids собирается в этом файле в правильном порядке
//     - compact.ids = full.ids (приоритет full.ids)
//     - codec-encode.ts предзаполняет dict.idDict из full.ids
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   // Вход:
//   vue.sfc = [
//     {
//       componentUsages: [
//         { id: 'cu1', props: [{ id: 'cu1:cp1' }], ... },
//         { id: 'cu2', props: [{ id: 'cu2:cp1' }], ... },
//       ],
//       htmlElements: [
//         { id: 'he1', props: [{ id: 'he1:cp1' }], ... },
//       ],
//     },
//   ]
//
//   allComponentProps = [
//     { id: 'cu1:cp1' },
//     { id: 'cu2:cp1' },
//     { id: 'he1:cp1' },
//   ]
//
//   // Выход (порядок сохранён):
//   ['cu1', 'cu2', 'he1', 'cu1:cp1', 'cu2:cp1', 'he1:cp1']
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • codec/codec-encode.ts       — addId, dict.idDict
//   • codec/codec-decode.ts       — читает compact.ids
//   • pipeline/collect-full-json.ts — вызывает collectUniqueIds
// ============================================================

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * v16.1.0: сбор глобально уникальных ids из всех component*-секций.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Пройти по vue.sfc[] и для каждого SFC собрать:
 *      a. Все componentUsages[].id
 *      b. Все componentUsages[].parentFileId   ← ✅ NEW
 *      c. Все htmlElements[].id
 *      d. Все htmlElements[].parentFileId      ← ✅ NEW
 *   2. Пройти по allComponentProps → взять id
 *   3. Пройти по allComponentEvents → взять id
 *   4. Пройти по allComponentDirectives → взять id
 *   5. Пройти по allComponentSlots → взять id
 *   6. Пройти по allHtmlInterpolations → взять id
 *   7. Дедупликация через Set с сохранением порядка
 *
 * ════════════════════════════════════════════════════════════
 * ГАРАНТИИ
 * ════════════════════════════════════════════════════════════
 *
 *   • Порядок первого появления сохраняется (не сортировка)
 *   • Пустые / undefined id пропускаются
 *   • Дедупликация O(N) через Set
 *   • Возвращаемый массив содержит только уникальные значения
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ЕСЛИ vue ОТСУТСТВУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   Если vue === undefined (нет Vue-файлов), то:
 *     - шаг 1 пропускается
 *     - всеComponent* массивы скорее всего пусты
 *     - возвращается пустой массив (или ids из других источников)
 *
 *   Возвращаемое значение в этом случае — пустой массив,
 *   и collect-full-json.ts установит result.ids = undefined.
 *
 * @param vue                    — Vue-секция (может быть undefined)
 * @param allComponentProps      — аккумулятор props
 * @param allComponentEvents     — аккумулятор events
 * @param allComponentDirectives — аккумулятор directives
 * @param allComponentSlots      — аккумулятор slots
 * @param allHtmlInterpolations  — аккумулятор interpolations
 * @returns массив уникальных ids в порядке первого появления
 */
export function collectUniqueIds(
  vue: any,
  allComponentProps: any[],
  allComponentEvents: any[],
  allComponentDirectives: any[],
  allComponentSlots: any[],
  allHtmlInterpolations: any[]
): string[] {
  // Сырой список всех id (с возможными дублями)
  const allIds: string[] = [];

  // ────────────────────────────────────────────────────────
  // 1. vue.sfc[] → cu.id, cu.parentFileId, he.id, he.parentFileId
  // ────────────────────────────────────────────────────────
  //
  // ✅ v16.2.0-FIX: добавлен сбор parentFileId.
  //
  // ПРИЧИНА:
  //   codec-encode.ts в encodeVueSection вызывает:
  //     cuPf.push(cu.parentFileId ? addId(dict, cu.parentFileId) : -1);
  //     hePf.push(he.parentFileId ? addId(dict, he.parentFileId) : -1);
  //
  //   Если parentFileId НЕ попал в dict.idDict заранее (через
  //   предзаполнение из full.ids), то addId добавит его в конец
  //   dict.idDict. Но compact.ids = full.ids (приоритет full),
  //   а full.ids НЕ содержит parentFileId → индекс выходит за
  //   границы compact.ids → decode подставляет '' вместо 'f1'.
  //
  // Симптом до фикса:
  //   $.vue.sfc[0].htmlElements[0].parentFileId
  //       a: ""        ← decoded
  //       b: "f1"      ← full
  //
  // Решение: собираем parentFileId здесь, чтобы он попал в full.ids
  // в правильном порядке (сразу после соответствующего cu.id/he.id).
  // ────────────────────────────────────────────────────────
  if (vue) {
    for (const sfc of vue.sfc) {
      // 1a. componentUsages
      for (const cu of sfc.componentUsages ?? []) {
        if (cu.id) allIds.push(cu.id);
        if (cu.parentFileId) allIds.push(cu.parentFileId); // ✅ NEW
      }

      // 1b. htmlElements
      for (const he of sfc.htmlElements ?? []) {
        if (he.id) allIds.push(he.id);
        if (he.parentFileId) allIds.push(he.parentFileId); // ✅ NEW
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // 2. allComponentProps[].id
  // ────────────────────────────────────────────────────────
  for (const p of allComponentProps) {
    if (p && p.id) allIds.push(p.id);
  }

  // ────────────────────────────────────────────────────────
  // 3. allComponentEvents[].id
  // ────────────────────────────────────────────────────────
  for (const e of allComponentEvents) {
    if (e && e.id) allIds.push(e.id);
  }

  // ────────────────────────────────────────────────────────
  // 4. allComponentDirectives[].id
  // ────────────────────────────────────────────────────────
  for (const d of allComponentDirectives) {
    if (d && d.id) allIds.push(d.id);
  }

  // ────────────────────────────────────────────────────────
  // 5. allComponentSlots[].id
  // ────────────────────────────────────────────────────────
  for (const s of allComponentSlots) {
    if (s && s.id) allIds.push(s.id);
  }

  // ────────────────────────────────────────────────────────
  // 6. allHtmlInterpolations[].id
  // ────────────────────────────────────────────────────────
  for (const i of allHtmlInterpolations) {
    if (i && i.id) allIds.push(i.id);
  }

  // ────────────────────────────────────────────────────────
  // 7. Дедупликация с сохранением порядка
  // ────────────────────────────────────────────────────────
  const uniqueIds: string[] = [];
  const seenIds = new Set<string>();
  for (const id of allIds) {
    if (!seenIds.has(id)) {
      seenIds.add(id);
      uniqueIds.push(id);
    }
  }

  return uniqueIds;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default collectUniqueIds;
