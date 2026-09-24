// src/reporters/codec/codec-legend.ts
// ============================================
// ЛЕГЕНДА КОДЕКА (v15.7.3)
// ============================================
// Версия: 15.7.3
//
// ИЗМЕНЕНИЯ v15.7.3 (уточнение семантики vue.sfc.c):
//   - ✅ ОБНОВЛЕНО: комментарий к схеме `vue.sfc` — явно указано,
//     что `c` содержит ИНДЕКСЫ В STRS (имена composables),
//     а НЕ индексы в `vue.composables`.
//   - ✅ ОБНОВЛЕНО: заголовок v15.7.2 → v15.7.3.
//   - ✅ ОБНОВЛЕНО: схема `vue.sfc` — 8 полей
//     (добавлено поле `cs` в v15.7.2, семантика `c` уточнена в v15.7.3).
//
// ИЗМЕНЕНИЯ v15.7.2 (fix round-trip vue.sfc.composables):
//   - ✅ ДОБАВЛЕНО: поле `cs` в схеме `vue.sfc` — slices
//     `[[offset, count], ...]` для каждого SFC.
//     Это нужно, чтобы `decode` мог восстановить РЕАЛЬНЫЕ
//     имена composables из `strs`.
//   - ✅ ОБНОВЛЕНО: схема `vue.sfc` — 7 → 8 полей:
//     `['f', 'n', 'b', 'c', 'cs', 'p', 'e', 'x']`.
//
// ИЗМЕНЕНИЯ v15.5.0 (Vue-сущности):
//   - ✅ ДОБАВЛЕНО: codes.vueKind (7 кодов)
//   - ✅ ДОБАВЛЕНО: codes.sfcBlock (4 кода)
//   - ✅ ДОБАВЛЕНО: codes.hookName (12 кодов)
//   - ✅ ДОБАВЛЕНО: codes.reactivityKind (8 кодов)
//   - ✅ ДОБАВЛЕНО: codes.iconCategory (4 кода)
//   - ✅ ДОБАВЛЕНО: codes.composableKind (4 кода)
//   - ✅ ДОБАВЛЕНО: schemas.fns += 'vk'
//   - ✅ ДОБАВЛЕНО: schemas['vue.sfc'] (7 полей)
//   - ✅ ДОБАВЛЕНО: schemas['vue.composables'] (5 полей)
//   - ✅ ДОБАВЛЕНО: schemas['vue.macros'] (3 поля)
//   - ✅ ДОБАВЛЕНО: schemas['vue.hooks'] (3 поля)
//   - ✅ ДОБАВЛЕНО: schemas['vue.reactivity'] (4 поля)
//   - ✅ ДОБАВЛЕНО: schemas['vue.icons'] (3 поля)
//   - ✅ ОБНОВЛЕНО: версия 15.4.0 → 15.5.0
//
// ИЗМЕНЕНИЯ v15.4.0 (P3 — cross-file):
//   - ✅ ОБНОВЛЕНО: версия 15.3.0 → 15.4.0
//
// ИЗМЕНЕНИЯ v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: schemas['gr.c'] += col/ck/cn/ai
//   - ✅ ДОБАВЛЕНО: codes.callKind
//
// ИЗМЕНЕНИЯ v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: schemas.lx
//   - ✅ ДОБАВЛЕНО: codes.lexicalRelation
//
// ИЗМЕНЕНИЯ v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: schemas.fns += 'parent'
//
// ИЗМЕНЕНИЯ v15.0.5 (gr.i.tf — индекс в fl.p):
//   - ✅ ОБНОВЛЕНО: схема `gr.i` — `tf` теперь ИНДЕКС В `fl.p`,
//     а не в `strs`. -1 = внешний/неразрешённый.
//   - ✅ ОБНОВЛЕНО: `legend.codes.import` — добавлены пояснения
//     про `tf` (индекс в fl.p) и `s` (индекс в strs).
//
// ИЗМЕНЕНИЯ v15.0.4 (isReExport / isStarReExport в gr.i.ty):
//   - ✅ ОБНОВЛЕНО: схема `gr.i` — комментарий про биты combinedTy
//     теперь включает биты 4 (isReExport) и 5 (isStarReExport).
//
// ИЗМЕНЕНИЯ v15.0.2:
//   - ✅ УБРАНО упоминание '@deprecated'.
//   - ✅ ЯВНО указано, что conditionals живут ТОЛЬКО в
//     `templates[].conditionals`.
//
// ИЗМЕНЕНИЯ v13.0.0:
//   - ✅ ДОБАВЛЕНЫ схемы mi и fl в SCHEMAS.
//
// ИЗМЕНЕНИЯ v12.0.0 (структурная оптимизация):
//   - ✅ УДАЛЕНЫ how_to_read и flags.examples.
//   - ✅ flags.bits — простой словарь { "1": "isAsync", ... }.
//   - ✅ schemas — обновлены под columnar-структуру.
//   - ✅ УДАЛЕНО поле dictionaries.
// ============================================

import type { CodecLegend, CodesDict } from './codec-types.js';

import {
  // ✅ Существующие словари
  FLAG_MAP,
  EXPORT_TYPES,
  CALL_TYPES,
  RE_EXPORT_TYPES,
  LIFECYCLE_TYPES,
  EFFECT_TYPES,
  INJECTION_TYPES,
  REACTIVITY_TYPES,
  CONDITIONAL_TYPES,
  TYPE_KINDS,
  TYPE_USAGE_KINDS,

  // ✅ v15.2.0 (P1): единый источник истины для relation codes
  LEXICAL_RELATION_CODES,

  // ✅ v15.3.0 (P2): единый источник истины для callKind codes
  CALL_KIND_CODES,
} from './codec-encode.js';

// ============================================================
// ✅ v15.5.0: ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ ДЛЯ VUE-КОДОВ
// ============================================================
//
// Определяем константы здесь, чтобы не дублировать их
// в codec-encode.ts и codec-decode.ts.
//
// ⚠️ ВАЖНО: эти константы должны быть СИНХРОНИЗИРОВАНЫ с:
//   - types.ts:VueKind (для vueKind)
//   - core/entity-extractor/helpers/classify-vue-kind.ts
//   - codec-encode.ts (при encodeVueSection)
//   - codec-decode.ts (при decodeVueSection)
// ============================================================

/**
 * Коды для vueKind: 0..6.
 *
 * ⚠️ Синхронизировано с types.ts:VueKind.
 */
export const VUE_KIND_CODES: Record<string, number> = {
  function: 0,
  composable: 1,
  macro: 2,
  hook: 3,
  reactivity: 4,
  callback: 5,
  arrow: 6,
};

/**
 * Коды для SFC-блоков: 1=script, 2=script-setup, 4=template, 8=style.
 *
 * ⚠️ Это битовая маска, а не последовательность 0..3.
 */
export const SFC_BLOCK_CODES: Record<string, number> = {
  script: 1,
  'script-setup': 2,
  template: 4,
  style: 8,
};

/**
 * Коды для hookName: 0..11.
 */
export const HOOK_NAME_CODES: Record<string, number> = {
  onMounted: 0,
  onUnmounted: 1,
  onActivated: 2,
  onDeactivated: 3,
  onErrorCaptured: 4,
  onScopeDispose: 5,
  watch: 6,
  watchEffect: 7,
  onBeforeMount: 8,
  onBeforeUnmount: 9,
  onUpdated: 10,
  onBeforeUpdate: 11,
};

/**
 * Коды для reactivityKind: 0..7.
 */
export const REACTIVITY_KIND_CODES: Record<string, number> = {
  computed: 0,
  ref: 1,
  reactive: 2,
  watch: 3,
  shallowRef: 4,
  readonly: 5,
  toRef: 6,
  toRefs: 7,
};

/**
 * Коды для iconCategory: 0..3.
 */
export const ICON_CATEGORY_CODES: Record<string, number> = {
  base: 0,
  filter: 1,
  toolbar: 2,
  sort: 3,
};

/**
 * Коды для composableKind: 0..3.
 */
export const COMPOSABLE_KIND_CODES: Record<string, number> = {
  composable: 0,
  store: 1,
  factory: 2,
  utility: 3,
};

/**
 * Коды для composableReturnShape: 0..4.
 */
export const COMPOSABLE_RETURN_SHAPE_CODES: Record<string, number> = {
  void: 0,
  object: 1,
  ref: 2,
  reactive: 3,
  function: 4,
};

/**
 * Коды для macroKind: 0..5.
 */
export const MACRO_KIND_CODES: Record<string, number> = {
  props: 0,
  emits: 1,
  expose: 2,
  slots: 3,
  model: 4,
  options: 5,
};

// ============================================================
// SCHEMAS — ПОЗИЦИОННЫЕ СХЕМЫ КОРТЕЖЕЙ
// ============================================================
//
// Схемы отражают columnar-структуру compact.json.
// Каждое имя в массиве — это имя поля-массива внутри
// соответствующего columnar-объекта.
//
// Пример:
//   schemas.fns = ['n', 'm', 'f', 'l', 'fl', 'p', 'rt', 'parent', 'vk']
//   кортеж fns имеет 9 параллельных массивов:
//     fns.n[0]      — nameIdx
//     fns.m[0]      — moduleIdx (в RLE)
//     fns.f[0]      — fileIdx (в RLE)
//     fns.l[0]      — line
//     fns.fl[0]     — flags
//     fns.p[0]      — paramsIdx
//     fns.rt[0]     — returnTypeIdx
//     fns.parent[0] — parentFunctionIdx (RLE), -1 = null  ← v15.1.0 (P0)
//     fns.vk[0]     — vueKindCode (RLE), 0 = function     ← v15.5.0
//
// ⚠️ ВАЖНО (v15.0.2): схема `cd` сохранена, потому что секция `cd`
// по-прежнему кодируется в compact.json. НО в FullJSON верхнеуровневого
// `conditionals` больше нет — все conditionals живут ТОЛЬКО в
// `templates[].conditionals`, и `cd` собирается из них при encode.
// ============================================================

export const SCHEMAS: CodecLegend['schemas'] = {
  // ==========================================
  // mi — модули: 2 параллельных массива
  // ==========================================
  // f: [startFileIdx, fileCount][] — пары.
  // ⚠️ НЕ RLE: раньше здесь был RLE от moduleIdx, что ломало
  // round-trip (decode интерпретировал moduleIdx как fileIdx
  // и строил неправильные modules[].fileIds).
  // ==========================================
  mi: ['n', 'f'],

  // ==========================================
  // fl — файлы: 2 параллельных массива
  // ==========================================
  // m: [moduleIdx, count][] — RLE от moduleIdx.
  // Здесь RLE корректен: fl.m восстанавливается побайтово,
  // и decode не строит из него modules[].fileIds (это делает mi).
  // ==========================================
  fl: ['p', 'm'],

  // ==========================================
  // fns — функции: 9 параллельных массивов
  // ==========================================
  // ✅ v15.1.0 (P0): добавлен 'parent'
  //   parent: [parentFunctionIdx, count][] — RLE, -1 = null
  //
  // ✅ v15.5.0: добавлен 'vk'
  //   vk: [vueKindCode, count][] — RLE, 0 = function
  //   0 = function, 1 = composable, 2 = macro, 3 = hook,
  //   4 = reactivity, 5 = callback, 6 = arrow
  // ==========================================
  fns: ['n', 'm', 'f', 'l', 'fl', 'p', 'rt', 'parent', 'vk'],

  // ==========================================
  // cls — классы: 6 параллельных массивов
  // ==========================================
  cls: ['n', 'm', 'f', 'l', 'fl', 'methods'],

  // ==========================================
  // cn — константы: 6 параллельных массивов
  // ==========================================
  cn: ['n', 'm', 'f', 'l', 'fl', 'nonEmptyV'],

  // ==========================================
  // gr.e — экспорты: 9 параллельных массивов
  // ==========================================
  'gr.e': ['m', 'f', 'fn', 'l', 'ty', 'en', 'ln', 's', 'flags'],

  // ==========================================
  // gr.i — импорты: 7 параллельных массивов
  // ==========================================
  //
  // ✅ v15.0.5: `tf` — ИНДЕКС В `fl.p` (файлы), а не в `strs`.
  //   -1 = внешний/неразрешённый импорт.
  //   Ранее (v15.0.4): `tf` — индекс в `strs` (source-строка).
  //
  // ✅ v15.0.5: `s` — ПО-ПРЕЖНЕМУ индекс в `strs` (source-строка).
  //   Не удалять — нужен для UI и диагностики.
  //
  // ✅ v15.0.4: массив `ty` содержит combinedTy с битами:
  //
  //   0-1 : typeCode (0=named, 1=default, 2=namespace)
  //   2   : isExternal
  //   3   : isTypeOnly
  //   4   : isReExport
  //   5   : isStarReExport
  //
  // Пример:
  //   ty = 0  → named, не внешний, не type-only
  //   ty = 1  → default
  //   ty = 2  → namespace
  //   ty = 4  → named + external
  //   ty = 8  → named + type-only
  //   ty = 16 → named + isReExport (export { X } from './foo')
  //   ty = 20 → named + external + isReExport
  //   ty = 48 → named + isReExport + isStarReExport (export * from)
  //   ty = 56 → named + external + isReExport + isStarReExport
  // ==========================================
  'gr.i': ['ff', 'tf', 's', 'im', 'ln', 'l', 'ty'],

  // ==========================================
  // gr.c — вызовы: 8 параллельных массивов
  // ==========================================
  // ✅ v15.3.0 (P2): добавлены col/ck/cn/ai
  //
  // ty = typeCode | (isExternal << 2)
  //   0-1 : typeCode (0=direct, 1=async, 2=method, 3=callback)
  //   2   : isExternal
  //
  // col: column, -1 = нет
  // ck:  callKindCode, -1 = нет
  // cn:  calleeNameIdx в strs, -1 = нет
  // ai:  argumentIndex, -1 = нет
  // ==========================================
  'gr.c': ['f', 't', 'l', 'ty', 'col', 'ck', 'cn', 'ai'],

  // ==========================================
  // gr.re — реэкспорты: 6 параллельных массивов
  // ==========================================
  // ty = typeCode | (isTypeOnly << 2)
  //   0-1 : typeCode (0=named, 1=default, 2=all)
  //   2   : isTypeOnly
  // ==========================================
  'gr.re': ['m', 'fn', 's', 'en', 'l', 'ty'],

  // ==========================================
  // vt — Vue шаблоны (12 полей, не columnar)
  // ==========================================
  // conditionals входят в vt[11] — это отдельное поле TemplateData,
  // но оно сериализуется внутри vt, потому что TemplateData содержит
  // поле `conditionals?: TemplateConditional[]`.
  //
  // ⚠️ v15.0.2: НЕ путать с `cd`. `cd` — это агрегированный
  // индекс conditionals для быстрого доступа; сами объекты
  // лежат в templates[].conditionals.
  // ==========================================
  vt: [
    'fileIdx',
    'moduleIdx',
    'complexity',
    'reactivityDepsIdx',
    'eventHandlers',
    'dynamicComponents',
    'directivesIdx',
    'usedComponentsIdx',
    'templateRefs',
    'cssVariables',
    'deepSelectors',
    'slotsIdx',
  ],

  // ==========================================
  // vt.eventHandlers — 6 полей
  // ==========================================
  'vt.eventHandlers': [
    'eventNameIdx',
    'handlerNameIdx',
    'tagIdx',
    'line',
    'modifiersIdx',
    'isExternal',
  ],

  // ==========================================
  // vt.dynamicComponents — 3 поля
  // ==========================================
  'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],

  // ==========================================
  // vt.templateRefs — 4 поля
  // ==========================================
  'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],

  // ==========================================
  // vt.cssVariables — 4 поля
  // ==========================================
  'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],

  // ==========================================
  // vt.deepSelectors — 2 поля
  // ==========================================
  'vt.deepSelectors': ['selectorIdx', 'line'],

  // ==========================================
  // lc — lifecycle: 5 полей
  // ==========================================
  lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],

  // ==========================================
  // ef — effects: 5 полей
  // ==========================================
  ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],

  // ==========================================
  // inj — injections: 5 полей
  // ==========================================
  inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],

  // ==========================================
  // rx — reactivity: 6 полей
  // ==========================================
  rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],

  // ==========================================
  // cd — conditionals: 6 полей
  // ==========================================
  //
  // ⚠️ v15.0.2: `cd` — это АГРЕГИРОВАННЫЙ индекс conditionals.
  // Собирается при encode из `templates[].conditionals` (НЕ из
  // верхнеуровневого `full.conditionals` — его больше нет).
  //
  // При decode conditionals восстанавливаются внутри
  // `templates[].conditionals`, и `cd` используется только
  // как ссылка на values[] для внутреннего доступа.
  // ==========================================
  cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],

  // ==========================================
  // ty — types: 7 полей
  // ==========================================
  ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line', 'membersIdx', 'extendsIdx'],

  // ==========================================
  // tr — typeRefs: 5 полей
  // ==========================================
  tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],

  // ==========================================
  // ✅ v15.2.0 (P1): lx — lexicalLinks: 6 полей
  // ==========================================
  //
  // Columnar-секция для лексических связей.
  //
  //   p:  RLE parentFunctionIdx, -1 = null
  //   c:  RLE childFunctionIdx
  //   r:  relationCode (см. codes.lexicalRelation)
  //   l:  line
  //   ai: argumentIndex, -1 = нет
  //   cn: calleeNameIdx в strs, -1 = нет
  //
  // Пример:
  //   lx.p = [[10, 3], [-1, 1]]   → parentIdx: 10,10,10,-1
  //   lx.c = [[45, 4]]             → childIdx:  45,45,45,45
  //   lx.r = [2, 2, 2, 0]          → callback, callback, callback, nested
  //   lx.l = [147, 150, 155, 200]  → строки
  //   lx.ai = [0, 0, 1, -1]        → argumentIndex
  //   lx.cn = [-1, -1, 5, -1]      → calleeNameIdx
  // ==========================================
  lx: ['p', 'c', 'r', 'l', 'ai', 'cn'],

  // ==========================================
  // ✅ v15.7.2: vue.sfc — SFC-компоненты: 8 полей
  // ✅ v15.7.3: уточнена семантика поля `c`
  // ==========================================
  //
  // Columnar-секция для SFC-компонентов.
  //
  //   f:  fileIdx (в fl.p)
  //   n:  nameIdx (в strs) — 'AiDataTable'
  //   b:  bitmask блоков: 1=script, 2=script-setup, 4=template, 8=style
  //   c:  плоский массив ИНДЕКСОВ В STRS (имена composables)  ← v15.7.3
  //   cs: [offset, count][] — slices для каждого SFC           ← v15.7.2
  //   p:  [fileIdx, propsCount] RLE
  //   e:  [fileIdx, emitsCount] RLE
  //   x:  [fileIdx, exposeCount] RLE
  //
  // ════════════════════════════════════════════════════════════
  // ⚠️ v15.7.3: `c` содержит ИМЕНА composables (как индексы в strs),
  //    а НЕ индексы в vue.composables.
  // ════════════════════════════════════════════════════════════
  //
  //   Почему не индексы в `vue.composables`:
  //     Если composable вызывается в SFC, но НЕ объявлен
  //     в проекте (например, `useRouter` из `vue-router`),
  //     он отсутствует в `vue.composables` → теряется при encode.
  //
  //   Хранение имён через `strs` универсально: работает для
  //   локальных и внешних composables одинаково.
  //
  // ════════════════════════════════════════════════════════════
  // ⚠️ v15.7.2: `cs` — slices для `c`.
  // ════════════════════════════════════════════════════════════
  //
  //   `c` — плоский массив ВСЕХ имён composables для ВСЕХ SFC.
  //   `cs[i] = [offset, count]` — где для i-го SFC начинается
  //   его кусок в `c` и сколько имён.
  //
  // ════════════════════════════════════════════════════════════
  // ⚠️ `p`/`e`/`x` — по-прежнему только счётчики.
  // ════════════════════════════════════════════════════════════
  //
  //   Имена props/emits/exposed не сохраняются (это отдельная
  //   задача). При decode восстанавливаются плейсхолдеры
  //   `['#0', '#1', ...]` нужной длины.
  //
  // Пример:
  //   vue.sfc.f = [60, 61, 62]
  //   vue.sfc.n = [42, 43, 44]
  //   vue.sfc.b = [3, 3, 11]
  //   vue.sfc.c = [10, 11, 12, 10, 11, 12, 13]   ← плоский
  //   vue.sfc.cs = [[0, 3], [3, 4], [7, 0]]      ← slices
  //   vue.sfc.p = [[60, 7], [61, 4], [62, 2]]
  //   vue.sfc.e = [[60, 4], [61, 3], [62, 1]]
  //   vue.sfc.x = [[60, 9], [61, 6], [62, 0]]
  // ==========================================
  'vue.sfc': ['f', 'n', 'b', 'c', 'cs', 'p', 'e', 'x'],

  // ==========================================
  // ✅ v15.5.0: vue.composables — Composables: 5 полей
  // ==========================================
  //
  // Columnar-секция для composables.
  //
  //   n: nameIdx (в strs) — 'useDataState'
  //   f: [fileIdx, count] RLE — где вызывается
  //   k: kindCode: 0=composable, 1=store, 2=factory, 3=utility
  //   r: returnShape: 0=void, 1=object, 2=ref, 3=reactive, 4=function
  //   v: [composableIdx, returnedKeysCount] RLE
  //
  // ⚠️ v15.7.3: `id` composable НЕ сохраняется в compact
  //    (он генерируется при decode как `cmp1`, `cmp2`, ...).
  //    Это by design: `id` не нужен для графа связей,
  //    composable идентифицируется по `name + fileId`.
  //
  // Пример:
  //   vue.composables.n = [10, 11, 12, 13, 14]
  //   vue.composables.f = [[60, 5]]         → все 5 в fileIdx=60
  //   vue.composables.k = [0, 0, 0, 0, 0]   → все composable
  //   vue.composables.r = [1, 1, 1, 1, 1]   → все возвращают object
  //   vue.composables.v = [[0, 4], [1, 5], [2, 9], [3, 2], [4, 6]]
  // ==========================================
  'vue.composables': ['n', 'f', 'k', 'r', 'v'],

  // ==========================================
  // ✅ v15.5.0: vue.macros — Макросы: 3 поля
  // ==========================================
  //
  // Columnar-секция для макросов.
  //
  //   f: fileIdx
  //   k: 0=props, 1=emits, 2=expose, 3=slots, 4=model, 5=options
  //   l: line
  //
  // ⚠️ v15.7.3: `id` макроса НЕ сохраняется в compact
  //    (генерируется при decode как `mac1`, `mac2`, ...).
  //
  // Пример:
  //   vue.macros.f = [60, 60, 60]
  //   vue.macros.k = [0, 1, 2]     → defineProps, defineEmits, defineExpose
  //   vue.macros.l = [19, 20, 180]
  // ==========================================
  'vue.macros': ['f', 'k', 'l'],

  // ==========================================
  // ✅ v15.5.0: vue.hooks — Lifecycle hooks: 3 поля
  // ==========================================
  //
  // Columnar-секция для hooks.
  //
  //   f: fileIdx
  //   n: hookNameCode (см. codes.hookName)
  //   l: line
  //
  // ⚠️ v15.7.3: `id` hook НЕ сохраняется в compact
  //    (генерируется при decode как `hk1`, `hk2`, ...).
  //
  // Пример:
  //   vue.hooks.f = [60, 60, 60]
  //   vue.hooks.n = [0, 1, 6]      → onMounted, onUnmounted, watch
  //   vue.hooks.l = [203, 215, 220]
  // ==========================================
  'vue.hooks': ['f', 'n', 'l'],

  // ==========================================
  // ✅ v15.5.0: vue.reactivity — Реактивные примитивы: 4 поля
  // ==========================================
  //
  // Columnar-секция для reactivity.
  //
  //   f: fileIdx
  //   k: 0=computed, 1=ref, 2=reactive, 3=watch
  //   l: line
  //   n: nameIdx, -1 если анонимный
  //
  // ⚠️ v15.7.3: `id` reactivity НЕ сохраняется в compact
  //    (генерируется при decode как `rx1`, `rx2`, ...).
  //
  // Пример:
  //   vue.reactivity.f = [60, 60, 60]
  //   vue.reactivity.k = [0, 0, 0]  → все computed
  //   vue.reactivity.l = [88, 89, 90]
  //   vue.reactivity.n = [-1, -1, -1] → анонимные
  // ==========================================
  'vue.reactivity': ['f', 'k', 'l', 'n'],

  // ==========================================
  // ✅ v15.5.0: vue.icons — Иконки: 3 поля
  // ==========================================
  //
  // Columnar-секция для иконок.
  //
  //   f: fileIdx
  //   n: nameIdx (в strs) — 'AiCrossIcon'
  //   c: 0=base, 1=filter, 2=toolbar, 3=sort
  //
  // ⚠️ v15.7.3: `id` иконки НЕ сохраняется в compact
  //    (генерируется при decode как `ic1`, `ic2`, ...).
  //
  // Пример:
  //   vue.icons.f = [50, 51, 52]
  //   vue.icons.n = [0, 1, 2]
  //   vue.icons.c = [0, 1, 2]      → base, filter, toolbar
  // ==========================================
  'vue.icons': ['f', 'n', 'c'],
};

// ============================================
// СБОРКА КОДОВ
// ============================================
//
// Каждый codes.* — это словарь { код: человекочитаемое_описание }.
//
// Логика mergeDict:
//   1. Для каждого кода из base берём имя как fallback.
//   2. Если для кода есть override — используем его.
//   3. Если в overrides есть код, которого нет в base —
//      добавляем его (для расширяемости).
//
// ⚠️ Коды остаются строковыми в legend.codes, но в compact.json
// они уже записаны ЧИСЛАМИ. ИИ должен использовать
// legend.codes.<type>[String(num)], но т.к. в JSON ключи всегда
// строки — ИИ сам преобразует число в строку для lookup.
//
// ✅ v15.2.0 (P1): lexicalRelation собирается из
//   LEXICAL_RELATION_CODES (единый источник истины).
// ✅ v15.3.0 (P2): callKind собирается из
//   CALL_KIND_CODES (единый источник истины).
// ✅ v15.5.0: vueKind, sfcBlock, hookName, reactivityKind,
//   iconCategory, composableKind собираются из соответствующих
//   констант выше.
// ============================================

function mergeDict(base: Record<string, string>, overrides: CodesDict): CodesDict {
  const result: CodesDict = {};

  // 1. Заполняем базовыми значениями
  for (const [code, name] of Object.entries(base)) {
    result[code] = overrides[code] ?? name;
  }

  // 2. Добавляем коды, которых нет в base
  for (const [code, desc] of Object.entries(overrides)) {
    if (!(code in result)) {
      result[code] = desc;
    }
  }

  return result;
}

/**
 * Преобразует словарь { name: code } → { code: name }.
 *
 * Используется для lexicalRelation и callKind: в codec-encode.ts
 * константы объявлены как `{ name: code }` (для быстрого lookup
 * при encode), а в legend нужен обратный порядок `{ code: name }`
 * (для decode).
 */
function reverseCodeDict(dict: Record<string, number>): CodesDict {
  const result: CodesDict = {};
  for (const [name, code] of Object.entries(dict)) {
    result[String(code)] = name;
  }
  return result;
}

function buildCodesLegend(): CodecLegend['codes'] {
  return {
    // ==========================================
    // ЭКСПОРТЫ
    // ==========================================
    // Числовые коды в compact.gr.e.ty:
    //   0 = named
    //   1 = default
    //   2 = type
    //   3 = re-export
    // ==========================================
    export: mergeDict(EXPORT_TYPES, {
      ne: 'named (именованный экспорт)',
      de: 'default (экспорт по умолчанию)',
      te: 'type (экспорт типа)',
      re: 're-export (реэкспорт)',
    }),

    // ==========================================
    // ИМПОРТЫ
    // ==========================================
    // Поле ImportData.type больше НЕ содержит 'type'.
    // Семантика:
    //   type        — 'named' | 'default' | 'namespace'
    //   isTypeOnly  — отдельный boolean (import type ...)
    //   isReExport  — отдельный boolean (export ... from ...)
    //   isStarReExport — отдельный boolean (export * from ...)
    //
    // Числовые коды в compact.gr.i.ty (младшие 2 бита):
    //   0 = named
    //   1 = default
    //   2 = namespace
    //   3 = reserved
    //
    // Старшие биты combinedTy:
    //   бит 2 = isExternal
    //   бит 3 = isTypeOnly
    //   бит 4 = isReExport
    //   бит 5 = isStarReExport
    //
    // ✅ v15.0.5: `gr.i.tf` — ИНДЕКС В `fl.p` (файлы), -1 = внешний.
    //   `gr.i.s`  — ПО-ПРЕЖНЕМУ индекс в `strs` (source-строка).
    // ==========================================
    import: {
      n: 'named (именованный импорт)',
      df: 'default (импорт по умолчанию)',
      ns: 'namespace (import * as)',
    },

    // ==========================================
    // ВЫЗОВЫ
    // ==========================================
    // Числовые коды в compact.gr.c.ty (младшие 2 бита):
    //   0 = direct
    //   1 = async
    //   2 = method
    //   3 = callback
    // Старший бит (bit 2) = isExternal
    // ==========================================
    call: mergeDict(CALL_TYPES, {
      d: 'direct (прямой вызов func())',
      a: 'async (await func())',
      m: 'method (obj.method())',
      c: 'callback (функция как аргумент)',
    }),

    // ==========================================
    // РЕЭКСПОРТЫ
    // ==========================================
    // Числовые коды в compact.gr.re.ty (младшие 2 бита):
    //   0 = named
    //   1 = default
    //   2 = all (export * from)
    // Старший бит (bit 2) = isTypeOnly
    //
    // ⚠️ v15.0.4: gr.re — это "чистые" реэкспорты (дедуплицированные
    // и агрегированные). Для полного графа связей используйте gr.i
    // с битами isReExport / isStarReExport.
    // ==========================================
    reExport: mergeDict(RE_EXPORT_TYPES, {
      n: 'named (именованный)',
      df: 'default (по умолчанию)',
      all: 'export * from',
    }),

    // ==========================================
    // LIFECYCLE
    // ==========================================
    lifecycle: mergeDict(LIFECYCLE_TYPES, {
      m: 'onMounted',
      u: 'onUnmounted',
      s: 'onScopeDispose',
      a: 'onActivated',
      d: 'onDeactivated',
      w: 'watch',
      W: 'watchEffect',
      e: 'onErrorCaptured',
    }),

    // ==========================================
    // EFFECTS
    // ==========================================
    effect: mergeDict(EFFECT_TYPES, {
      t: 'timer (setTimeout / setInterval)',
      c: 'cleanup (clearTimeout / abort)',
      p: 'promise (.then / .catch)',
      e: 'event (addEventListener)',
      s: 'subscription (.subscribe)',
    }),

    // ==========================================
    // INJECTIONS
    // ==========================================
    injection: mergeDict(INJECTION_TYPES, {
      p: 'provide',
      i: 'inject',
    }),

    // ==========================================
    // REACTIVITY
    // ==========================================
    reactivity: mergeDict(REACTIVITY_TYPES, {
      c: 'computed',
      w: 'watch',
      W: 'watchEffect',
      r: 'ref',
      R: 'reactive',
      S: 'shallowRef',
      o: 'readonly',
    }),

    // ==========================================
    // CONDITIONALS
    // ==========================================
    // ⚠️ v15.0.2: conditionals живут ТОЛЬКО в
    // `templates[].conditionals`. Эти коды используются
    // для расшифровки `templates[].conditionals[].directive`
    // и агрегированной секции `cd` в compact.json.
    // ==========================================
    conditional: mergeDict(CONDITIONAL_TYPES, {
      i: 'v-if',
      e: 'v-else-if',
      E: 'v-else',
    }),

    // ==========================================
    // TYPE KINDS
    // ==========================================
    typeKind: mergeDict(TYPE_KINDS, {
      i: 'interface',
      t: 'type-alias',
      e: 'enum',
      c: 'class',
    }),

    // ==========================================
    // TYPE USAGE
    // ==========================================
    typeUsage: mergeDict(TYPE_USAGE_KINDS, {
      p: 'param (тип параметра)',
      r: 'return (тип возврата)',
      f: 'field (тип поля)',
      g: 'generic (generic-параметр)',
      u: 'union (union-тип)',
      x: 'extends (расширяемый тип)',
    }),

    // ==========================================
    // ✅ v15.2.0 (P1): LEXICAL RELATION
    // ==========================================
    // Коды для `lx.r[]`:
    //   0 = nested        (function inner() {})
    //   1 = arrow-var     (const fn = () => {})
    //   2 = callback      (arr.map(x => x))
    //   3 = iife          ((() => {})())
    //   4 = class-method  (class A { method() {} })
    //   5 = object-prop   ({ onClick: () => {} })
    //   6 = return        (return () => {})
    //   7 = default-export(export default () => {})
    //
    // Собирается из LEXICAL_RELATION_CODES (единый источник истины).
    // ==========================================
    lexicalRelation: reverseCodeDict(LEXICAL_RELATION_CODES),

    // ==========================================
    // ✅ v15.3.0 (P2): CALL KIND
    // ==========================================
    // Коды для `gr.c.ck[]`:
    //   0 = direct
    //   1 = method
    //   2 = callback
    //   3 = constructor
    //   4 = tagged-template
    //   5 = optional-chain
    //   6 = spread
    //   7 = new
    //
    // Собирается из CALL_KIND_CODES (единый источник истины).
    // ==========================================
    callKind: reverseCodeDict(CALL_KIND_CODES),

    // ==========================================
    // ✅ v15.5.0: VUE KIND
    // ==========================================
    // Коды для `fns.vk[]` (RLE):
    //   0 = function
    //   1 = composable
    //   2 = macro
    //   3 = hook
    //   4 = reactivity
    //   5 = callback
    //   6 = arrow
    //
    // Собирается из VUE_KIND_CODES (единый источник истины).
    // ==========================================
    vueKind: reverseCodeDict(VUE_KIND_CODES),

    // ==========================================
    // ✅ v15.5.0: SFC BLOCK
    // ==========================================
    // Коды для `vue.sfc.b[]` (bitmask):
    //   1 = script
    //   2 = script-setup
    //   4 = template
    //   8 = style
    //
    // ⚠️ Это битовая маска, а не последовательность.
    // Значение может быть суммой: 3 = script|script-setup.
    //
    // Собирается из SFC_BLOCK_CODES (единый источник истины).
    // ==========================================
    sfcBlock: reverseCodeDict(SFC_BLOCK_CODES),

    // ==========================================
    // ✅ v15.5.0: HOOK NAME
    // ==========================================
    // Коды для `vue.hooks.n[]`:
    //   0 = onMounted
    //   1 = onUnmounted
    //   2 = onActivated
    //   3 = onDeactivated
    //   4 = onErrorCaptured
    //   5 = onScopeDispose
    //   6 = watch
    //   7 = watchEffect
    //   8 = onBeforeMount
    //   9 = onBeforeUnmount
    //   10 = onUpdated
    //   11 = onBeforeUpdate
    //
    // Собирается из HOOK_NAME_CODES (единый источник истины).
    // ==========================================
    hookName: reverseCodeDict(HOOK_NAME_CODES),

    // ==========================================
    // ✅ v15.5.0: REACTIVITY KIND
    // ==========================================
    // Коды для `vue.reactivity.k[]`:
    //   0 = computed
    //   1 = ref
    //   2 = reactive
    //   3 = watch
    //   4 = shallowRef
    //   5 = readonly
    //   6 = toRef
    //   7 = toRefs
    //
    // Собирается из REACTIVITY_KIND_CODES (единый источник истины).
    // ==========================================
    reactivityKind: reverseCodeDict(REACTIVITY_KIND_CODES),

    // ==========================================
    // ✅ v15.5.0: ICON CATEGORY
    // ==========================================
    // Коды для `vue.icons.c[]`:
    //   0 = base
    //   1 = filter
    //   2 = toolbar
    //   3 = sort
    //
    // Собирается из ICON_CATEGORY_CODES (единый источник истины).
    // ==========================================
    iconCategory: reverseCodeDict(ICON_CATEGORY_CODES),

    // ==========================================
    // ✅ v15.5.0: COMPOSABLE KIND
    // ==========================================
    // Коды для `vue.composables.k[]`:
    //   0 = composable
    //   1 = store
    //   2 = factory
    //   3 = utility
    //
    // Собирается из COMPOSABLE_KIND_CODES (единый источник истины).
    // ==========================================
    composableKind: reverseCodeDict(COMPOSABLE_KIND_CODES),
  };
}

// ============================================
// СБОРКА ФЛАГОВ
// ============================================
//
// flags.bits — простой словарь { "1": "isAsync", ... }.
//
// В compact.json флаги хранятся ЧИСЛОМ (битовая маска).
// Чтобы разобрать число, ИИ смотрит legend.flags.bits:
//   bit 1   = isAsync
//   bit 2   = isExported
//   bit 4   = isMethod
//   bit 8   = isArrow
//   ...
//   bit 131072 = isStatic
//
// Пример:
//   fns.fl[0] = 7
//   7 = 1 + 2 + 4  →  isAsync + isExported + isMethod
//
// Использует FLAG_MAP из codec-encode.ts, чтобы не дублировать
// константы. FLAG_MAP: { 1: 'isAsync', 2: 'isExported', ... }
// ============================================

function buildFlagsLegend(): CodecLegend['flags'] {
  const bits: Record<string, string> = {};

  for (const [bitStr, name] of Object.entries(FLAG_MAP)) {
    bits[bitStr] = name;
  }

  return { bits };
}

// ============================================
// СБОРКА ПОЛНОЙ ЛЕГЕНДЫ
// ============================================
//
// buildLegend сохранён для совместимости, но параметр _dict
// больше не используется — словари переехали в корень
// compact.json (tokens, strs, params, methods, values).
//
// Легенда теперь содержит только:
//   - codes    — расшифровки числовых кодов
//   - flags    — расшифровка битовых флагов
//   - schemas  — позиционные схемы кортежей
//
// Это устраняет дублирование: словари больше не хранятся
// в legend.dictionaries.*, а лежат в корне compact.json.
// ============================================

export interface LegendDictionaries {
  stringDict: string[];
  paramDict: string[];
  methodDict: string[];
  valueDict: unknown[];
}

export function buildLegend(_dict: LegendDictionaries): CodecLegend {
  return {
    codes: buildCodesLegend(),
    flags: buildFlagsLegend(),
    schemas: SCHEMAS,
  };
}

export function buildEmptyLegend(): CodecLegend {
  return buildLegend({
    stringDict: [],
    paramDict: [],
    methodDict: [],
    valueDict: [],
  });
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  buildLegend,
  buildEmptyLegend,
  SCHEMAS,
  // ✅ v15.5.0: экспорт констант для внешних потребителей
  VUE_KIND_CODES,
  SFC_BLOCK_CODES,
  HOOK_NAME_CODES,
  REACTIVITY_KIND_CODES,
  ICON_CATEGORY_CODES,
  COMPOSABLE_KIND_CODES,
  COMPOSABLE_RETURN_SHAPE_CODES,
  MACRO_KIND_CODES,
};
