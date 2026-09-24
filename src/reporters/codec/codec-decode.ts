// src/reporters/codec/codec-decode.ts
// ============================================
// ДЕКОДИРОВАНИЕ: CompactJSON → FullJSON
// ============================================
// Версия: 15.7.3
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.7.3 (fix: vue.sfc.c — восстановление реальных имён composables):
//   - ✅ ИСПРАВЛЕНО: `decodeVueSection()` теперь восстанавливает
//     РЕАЛЬНЫЕ имена composables через `readStr(idx)` из `strs`.
//
//     ПРИЧИНА: в `encodeVueSection` (v15.7.3) `sfc.c` теперь
//     содержит индексы в `strs` (имена composables как строки),
//     а НЕ индексы в `vue.composables`.
//
//     Это позволяет восстанавливать ВНЕШНИЕ composables
//     (useRouter, useI18n), которых нет в `vue.composables`.
//
//   - ✅ ИСПРАВЛЕНО: `decodeVueSection()` читает `sfc.cs` (slices
//     `[[offset, count], ...]`) для разбиения `sfc.c` по SFC.
//
//     Ранее (v15.7.2) использовалось `sfc.c[i] = [fileIdx, count]`,
//     что не позволяло восстановить реальные имена.
//
//   - ✅ ДОБАВЛЕН: fallback для старых compact (v15.7.2 и ранее):
//     если `sfc.cs` отсутствует, но `sfc.c[i]` — массив,
//     восстанавливаются плейсхолдеры `['#0', '#1', ...]`.
//
//   - ✅ ОБНОВЛЕНО: CODEC_VERSION = '15.7.3'.
//
// v15.7.2 (fix: восстановление moduleId в vue.sfc):
//   - ✅ ИСПРАВЛЕНО: `decodeVueSection()` восстанавливает `moduleId`
//     из `files[].moduleId`. Ранее было жёстко `''`, что ломало
//     round-trip (`$.sfc[i].moduleId: "m1" → ""`).
//
// v15.7.1 (Vue-секция: ослабление проверки):
//   - ✅ ИСПРАВЛЕНО: `checkVueSection` — нормализация перед сравнением.
//
// v15.7.0 (Vue entities):
//   - ✅ ДОБАВЛЕНО: чтение `fns.vk` (RLE) → `FunctionData.vueKind`.
//   - ✅ ДОБАВЛЕНО: чтение `compact.vue` → `FullJSON.vue`.
//   - ✅ ДОБАВЛЕНО: `decodeVueSection()` — восстановление SFC /
//     composables / macros / hooks / reactivity / icons.
//   - ✅ ДОБАВЛЕНО: маппинги VUE_KIND_BY_CODE, HOOK_NAME_BY_CODE,
//     REACTIVITY_KIND_BY_CODE, ICON_CATEGORY_BY_CODE.
//   - ✅ ИСПРАВЛЕНО: восстановление длин sfc.composables/props/
//     emits/exposed через Array.from.
//
// v15.5.0 (Vue entities):
//   - ✅ ДОБАВЛЕНО: чтение `fns.vk` (RLE) → `FunctionData.vueKind`.
//   - ✅ ДОБАВЛЕНО: `decodeVueSection()` — восстановление SFC.
//
// v15.4.0 (P3 — cross-file resolution):
//   - ✅ CODEC_VERSION = '15.4.0'.
//
// v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: CALL_KIND_BY_CODE.
//   - ✅ ДОБАВЛЕНО: чтение gr.c.col/ck/cn/ai.
//
// v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: LEXICAL_RELATION_BY_CODE.
//   - ✅ ДОБАВЛЕНО: чтение compact.lx.
//   - ✅ ДОБАВЛЕНО: result.lexicalLinks.
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: чтение fns.parent.
//
// v15.0.6 (gr.i.tf — индекс в fl.p):
//   - ✅ ИЗМЕНЕНО: tf читается как индекс в fl.p.
//   - ✅ -1 → external:* / unresolved:*.
//
// v15.0.4 (проброс isReExport/isStarReExport):
//   - ✅ ДОБАВЛЕНО: чтение битов 4, 5 из gr.i.ty.
//
// v15.0.2 (устранение дублирования conditionals):
//   - ✅ УБРАНО: чтение compact.cd через decodeSection.
//
// v15.0.1 (fix imports[].type):
//   - ✅ ИСПРАВЛЕНО: imports[].type больше не использует эвристику.
//
// v15.0.0 (100% round-trip расширенных секций):
//   - ✅ ИСПРАВЛЕНО: decodeSection читает и объект, и строку.
//
// v14.0.0 (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: imports[].isTypeOnly читается из бита 8.
//
// v13.0.2-fix (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: modules[].fileIds строятся через fl.m.
//
// v13.0.0-fix (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: mi.f читается как пары [startFileIdx, fileCount].
//
// v12.0.0 (структурная оптимизация):
//   - ✅ Columnar-структура для всех секций.
// ============================================

import type {
  FullJSON,
  CompactJSON,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  ModuleData,
  FileData,
  EdgeData,
  DecodeOptions,
  TemplateData,
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TypeNodeData,
  TypeRefData,
  // ✅ v15.2.0 (P1)
  LexicalLink,
  LexicalRelation,
  // ✅ v15.5.0 (Vue entities)
  SFCComponent,
  ComposableEntity,
  MacroEntity,
  HookEntity,
  ReactivityEntity,
  IconEntity,
  VueKind,
  VueSectionFull,
  VueSectionCompact,
} from './codec-types.js';

// ✅ v15.5.0: единая версия CODEC
import { CODEC_VERSION } from './codec-types.js';

// ============================================
// ✅ v15.2.0 (P1): LEXICAL RELATION BY CODE
// ============================================
//
// Обратная карта: код → relation.
// Используется при чтении columnar-секции lx.
//
// ⚠️ Синхронизировано с LEXICAL_RELATION_CODES в codec-encode.ts.
// ⚠️ Синхронизировано с legend.codes.lexicalRelation.
// ============================================

const LEXICAL_RELATION_BY_CODE: Record<number, LexicalRelation> = {
  0: 'nested',
  1: 'arrow-var',
  2: 'callback',
  3: 'iife',
  4: 'class-method',
  5: 'object-prop',
  6: 'return',
  7: 'default-export',
};

// ============================================
// ✅ v15.3.0 (P2): CALL KIND BY CODE
// ============================================
//
// Обратная карта: код → callKind.
// Используется при чтении columnar-секции gr.c (поле ck).
//
// ⚠️ Синхронизировано с CALL_KIND_CODES в codec-encode.ts.
// ⚠️ Синхронизировано с legend.codes.callKind.
// ============================================

const CALL_KIND_BY_CODE: Record<number, CallData['callKind']> = {
  0: 'direct',
  1: 'method',
  2: 'callback',
  3: 'constructor',
  4: 'tagged-template',
  5: 'optional-chain',
  6: 'spread',
  7: 'new',
};

// ============================================
// ✅ v15.5.0: VUE KIND BY CODE
// ============================================
//
// Обратная карта: код → vueKind.
// Используется при чтении `fns.vk` (RLE).
//
// ⚠️ Синхронизировано с VUE_KIND_CODES в codec-encode.ts.
// ⚠️ Синхронизировано с legend.codes.vueKind.
// ============================================

const VUE_KIND_BY_CODE: Record<number, VueKind> = {
  0: 'function',
  1: 'composable',
  2: 'macro',
  3: 'hook',
  4: 'reactivity',
  5: 'callback',
  6: 'arrow',
};

// ============================================
// ✅ v15.5.0: HOOK NAME BY CODE
// ============================================
//
// Обратная карта: код → hookName (для vue.hooks.n).
//
// ⚠️ Синхронизировано с HOOK_NAME_CODES в codec-encode.ts.
// ⚠️ Синхронизировано с legend.codes.hookName.
// ============================================

const HOOK_NAME_BY_CODE: Record<number, string> = {
  0: 'onMounted',
  1: 'onUnmounted',
  2: 'onActivated',
  3: 'onDeactivated',
  4: 'onErrorCaptured',
  5: 'onScopeDispose',
  6: 'watch',
  7: 'watchEffect',
  8: 'onBeforeMount',
  9: 'onBeforeUnmount',
  10: 'onUpdated',
  11: 'onBeforeUpdate',
};

// ============================================
// ✅ v15.5.0: REACTIVITY KIND BY CODE
// ============================================
//
// Обратная карта: код → reactivity kind (для vue.reactivity.k).
//
// ⚠️ Синхронизировано с REACTIVITY_KIND_CODES в codec-encode.ts.
// ⚠️ Синхронизировано с legend.codes.reactivityKind.
// ============================================

const REACTIVITY_KIND_BY_CODE: Record<number, ReactivityEntity['kind']> = {
  0: 'computed',
  1: 'ref',
  2: 'reactive',
  3: 'watch',
  4: 'shallowRef',
  5: 'readonly',
  6: 'toRef',
  7: 'toRefs',
};

// ============================================
// ✅ v15.5.0: ICON CATEGORY BY CODE
// ============================================
//
// Обратная карта: код → icon category (для vue.icons.c).
//
// ⚠️ Синхронизировано с ICON_CATEGORY_CODES в codec-encode.ts.
// ⚠️ Синхронизировано с legend.codes.iconCategory.
// ============================================

const ICON_CATEGORY_BY_CODE: Record<number, IconEntity['category']> = {
  0: 'base',
  1: 'filter',
  2: 'toolbar',
  3: 'sort',
};

// ============================================
// ✅ v15.5.0: COMPOSABLE KIND BY CODE
// ============================================
//
// Обратная карта: код → composable kind (для vue.composables.k).
//
// ⚠️ Синхронизировано с COMPOSABLE_KIND_CODES в codec-encode.ts.
// ⚠️ Синхронизировано с legend.codes.composableKind.
// ============================================

const COMPOSABLE_KIND_BY_CODE: Record<number, ComposableEntity['kind']> = {
  0: 'composable',
  1: 'store',
  2: 'factory',
  3: 'utility',
};

// ============================================
// ✅ v15.5.0: COMPOSABLE RETURN SHAPE BY CODE
// ============================================
//
// Обратная карта: код → returnShape (для vue.composables.r).
// ============================================

const COMPOSABLE_SHAPE_BY_CODE: Record<number, ComposableEntity['returnShape']> = {
  0: 'void',
  1: 'object',
  2: 'ref',
  3: 'reactive',
  4: 'function',
};

// ============================================
// ✅ v15.5.0: MACRO KIND BY CODE
// ============================================
//
// Обратная карта: код → macro kind (для vue.macros.k).
//
// ⚠️ Синхронизировано с MACRO_KIND_CODES в codec-encode.ts.
// ============================================

const MACRO_KIND_BY_CODE: Record<number, MacroEntity['kind']> = {
  0: 'props',
  1: 'emits',
  2: 'expose',
  3: 'slots',
  4: 'model',
  5: 'options',
};

// ============================================
// ДЕКОДИРОВАНИЕ ФЛАГОВ
// ============================================

/**
 * Результат декодирования битовых флагов функции.
 *
 * Содержит все 18 возможных флагов (см. FLAG_MAP в codec-encode.ts).
 */
export interface DecodedFlags {
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  isArrow: boolean;
  isEventHandler: boolean;
  isNested: boolean;
  isSelf: boolean;
  isDynamic: boolean;
  isConfig: boolean;
  isExternal: boolean;
  isVueTemplate: boolean;
  isAsyncChain: boolean;
  isClosure: boolean;
  isTypeDep: boolean;
  isGenerator: boolean;
  isPrivate: boolean;
  isProtected: boolean;
  isStatic: boolean;
}

/**
 * Создаёт «пустой» объект флагов (все false).
 */
export function createEmptyFlags(): DecodedFlags {
  return {
    isAsync: false,
    isExported: false,
    isMethod: false,
    isArrow: false,
    isEventHandler: false,
    isNested: false,
    isSelf: false,
    isDynamic: false,
    isConfig: false,
    isExternal: false,
    isVueTemplate: false,
    isAsyncChain: false,
    isClosure: false,
    isTypeDep: false,
    isGenerator: false,
    isPrivate: false,
    isProtected: false,
    isStatic: false,
  };
}

/**
 * Декодирует ЧИСЛО флагов в объект с булевыми полями.
 */
export function decodeFlagsFromNumber(num: number): DecodedFlags {
  const result = createEmptyFlags();
  if (!num) return result;

  result.isAsync = !!(num & 1);
  result.isExported = !!(num & 2);
  result.isMethod = !!(num & 4);
  result.isArrow = !!(num & 8);
  result.isEventHandler = !!(num & 16);
  result.isNested = !!(num & 32);
  result.isSelf = !!(num & 64);
  result.isDynamic = !!(num & 128);
  result.isConfig = !!(num & 256);
  result.isExternal = !!(num & 512);
  result.isVueTemplate = !!(num & 1024);
  result.isAsyncChain = !!(num & 2048);
  result.isClosure = !!(num & 4096);
  result.isTypeDep = !!(num & 8192);
  result.isGenerator = !!(num & 16384);
  result.isPrivate = !!(num & 32768);
  result.isProtected = !!(num & 65536);
  result.isStatic = !!(num & 131072);

  return result;
}

/**
 * Декодирует строку символов в объект с булевыми полями.
 *
 * ⚠️ v11.0.0: сохранено для обратной совместимости с внутренними
 * вызовами.
 */
export function decodeFlagsToObject(flagStr: string): DecodedFlags {
  const result = createEmptyFlags();
  if (!flagStr || flagStr === '0') return result;

  const FLAG_CHAR_MAP: Record<string, number> = {
    a: 1,
    e: 2,
    m: 4,
    r: 8,
    v: 16,
    n: 32,
    s: 64,
    d: 128,
    c: 256,
    x: 512,
    t: 1024,
    A: 2048,
    l: 4096,
    y: 8192,
    g: 16384,
    p: 32768,
    P: 65536,
    S: 131072,
  };

  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }

  return decodeFlagsFromNumber(flags);
}

/**
 * Декодирует строку символов в число флагов.
 *
 * ⚠️ v11.0.0: сохранено для обратной совместимости.
 */
export function flagsStringToNumber(flagStr: string): number {
  if (!flagStr || flagStr === '0') return 0;

  const FLAG_CHAR_MAP: Record<string, number> = {
    a: 1,
    e: 2,
    m: 4,
    r: 8,
    v: 16,
    n: 32,
    s: 64,
    d: 128,
    c: 256,
    x: 512,
    t: 1024,
    A: 2048,
    l: 4096,
    y: 8192,
    g: 16384,
    p: 32768,
    P: 65536,
    S: 131072,
  };

  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }
  return flags;
}

// ============================================
// УТИЛИТЫ
// ============================================

/**
 * Распаковка RLE: [[value, count], ...] → [value, value, ...]
 */
function unrle(rle: [number, number][]): number[] {
  const result: number[] = [];
  for (const [value, count] of rle) {
    for (let i = 0; i < count; i++) {
      result.push(value);
    }
  }
  return result;
}

/**
 * Детокенизация строки.
 *
 * Если entry — строка, возвращает как есть.
 * Если entry — массив индексов, склеивает соответствующие токены.
 */
function decodeStr(entry: string | number[], tokens: string[]): string {
  if (typeof entry === 'string') return entry;
  return entry.map(i => tokens[i]).join('');
}

/**
 * ✅ v14.0.0: безопасный JSON.parse для восстановления расширенных секций.
 */
function safeJsonParse<T>(value: unknown): T | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// ============================================
// ✅ v15.7.3: VUE SECTION DECODER
// ============================================

/**
 * Декодирует `compact.vue` → `FullJSON.vue`.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ВОССТАНАВЛИВАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   - sfc:         SFC-компоненты (fileId, moduleId, name, blocks,
 *                  composables[], props[], emits[], exposed[])
 *   - composables: composable-функции (id, name, fileId, kind,
 *                  returnShape, returnedKeys, callers)
 *   - macros:      defineProps / defineEmits / ...
 *   - hooks:       onMounted / onUnmounted / watch / ...
 *   - reactivity:  computed / ref / reactive / watch
 *   - icons:       иконки-компоненты по категориям
 *
 * ════════════════════════════════════════════════════════════
 * ✅ v15.7.3: sfc.c — ИНДЕКСЫ В `strs`, А НЕ В `vue.composables`
 * ════════════════════════════════════════════════════════════
 *
 *   ПРОБЛЕМА (до v15.7.3):
 *
 *     Ранее (v15.7.2) `sfc.c` содержал индексы в `vue.composables`.
 *     Но `vue.composables` содержит только ЛОКАЛЬНЫЕ composables.
 *     Внешние (`useRouter`, `useI18n`) отсутствуют в нём,
 *     и при decode их имена терялись.
 *
 *   РЕШЕНИЕ (v15.7.3):
 *
 *     `sfc.c` теперь содержит индексы в `strs` — имена
 *     composables как строки. Восстанавливаем через `readStr(idx)`.
 *
 *     Это универсально: работает и для локальных, и для внешних
 *     composables.
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ sfc.p / sfc.e / sfc.x — только счётчики
 * ════════════════════════════════════════════════════════════
 *
 *   Для props/emits/exposed в compact хранятся только СЧЁТЧИКИ.
 *   При decode восстанавливаются ПЛЕЙСХОЛДЕРЫ:
 *     `['#0', '#1', ..., '#N-1']`, где N = count.
 *
 *   Реальные имена не сохраняются в compact (by design).
 *
 * ════════════════════════════════════════════════════════════
 * ✅ v15.7.2: `moduleId` восстанавливается из `files[].moduleId`
 * ════════════════════════════════════════════════════════════
 *
 *   Ранее (до v15.7.2) `moduleId` был жёстко `''`, что ломало
 *   round-trip: `$.sfc[i].moduleId: "m1" → ""`.
 *
 *   Теперь — берём из `files[fileIdx].moduleId`.
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ `id` composables/macros/hooks/reactivity/icons не сохраняется
 * ════════════════════════════════════════════════════════════
 *
 *   В compact нет полей `id` для этих сущностей (см. схемы).
 *   При decode `id` генерируется:
 *     - composables: `cmp1`, `cmp2`, ...
 *     - macros:      `mac1`, `mac2`, ...
 *     - hooks:       `hk1`, `hk2`, ...
 *     - reactivity:  `rx1`, `rx2`, ...
 *     - icons:       `ic1`, `ic2`, ...
 *
 *   Это by design: сущности идентифицируются по другим полям
 *   (name + fileId, fileId + kind + line и т.д.).
 *
 *   В `verify-roundtrip.ts` применяется `normalizeVueForCompare()`,
 *   которая убирает `id` перед сравнением L1/L2/DL.
 *
 * @param vue         — compact.vue
 * @param stringDict  — словарь строк (compact.strs)
 * @param files       — массив FullJSON.files (для маппинга индексов)
 * @returns VueSectionFull или undefined
 */
function decodeVueSection(
  vue: VueSectionCompact | undefined,
  stringDict: string[],
  files: FileData[]
): VueSectionFull | undefined {
  if (!vue) return undefined;

  const readStr = (idx: number): string => (idx < 0 ? '' : (stringDict[idx] ?? ''));
  const fileId = (idx: number): string => files[idx]?.id ?? `f${idx + 1}`;
  // ✅ v15.7.2: восстановление moduleId из files[]
  const moduleIdForFile = (idx: number): string => files[idx]?.moduleId ?? '';

  // ────────────────────────────────────────────────────────
  // sfc
  // ────────────────────────────────────────────────────────
  //
  // ✅ v15.7.3: `sfc.c` содержит индексы в `strs` (имена composables).
  //             `sfc.cs` содержит slices `[[offset, count], ...]`.
  //
  // Восстанавливаем РЕАЛЬНЫЕ имена composables через `readStr(idx)`.
  //
  // ✅ v15.7.2: `moduleId` восстанавливается из `files[].moduleId`.
  //
  // ⚠️ Fallback для старых compact (v15.7.2 и ранее):
  //   Если `sfc.cs` отсутствует, но `sfc.c[i]` — массив
  //   (`[fileIdx, count]` — старый формат), восстанавливаем
  //   плейсхолдеры `['#0', '#1', ...]`.
  // ============================================================

  const sfcC = vue.sfc.c ?? [];
  const sfcCS = vue.sfc.cs ?? [];

  const sfc: SFCComponent[] = (vue.sfc?.f ?? []).map((fileIdx: number, i: number) => {
    const propsCount = vue.sfc.p?.[i]?.[1] ?? 0;
    const emitsCount = vue.sfc.e?.[i]?.[1] ?? 0;
    const exposeCount = vue.sfc.x?.[i]?.[1] ?? 0;

    // ✅ v15.7.3: восстанавливаем РЕАЛЬНЫЕ имена composables из strs
    let composables: string[] = [];

    const slice = sfcCS[i];
    if (Array.isArray(slice) && slice.length === 2) {
      // ✅ v15.7.3: новый формат — slices + плоский массив индексов в strs
      const [offset, count] = slice;
      const nameIndices = sfcC.slice(offset, offset + count);
      composables = nameIndices.map(idx => readStr(idx));
    } else if (Array.isArray((vue.sfc.c as any)?.[i])) {
      // ⚠️ Fallback для старых compact (v15.7.2 и ранее):
      // `sfc.c[i] = [fileIdx, count]` — восстанавливаем плейсхолдеры.
      const oldCount = (vue.sfc.c as any)?.[i]?.[1] ?? 0;
      composables = Array.from({ length: oldCount }, (_, k) => `#${k}`);
    }

    return {
      fileId: fileId(fileIdx),
      // ✅ v15.7.2: восстановление moduleId из files[]
      moduleId: moduleIdForFile(fileIdx),
      name: readStr(vue.sfc.n[i] ?? -1),
      blocks: vue.sfc.b[i] ?? 0,
      composables,
      // ⚠️ props/emits/exposed — только счётчики (плейсхолдеры)
      props: Array.from({ length: propsCount }, (_, k) => `#${k}`),
      emits: Array.from({ length: emitsCount }, (_, k) => `#${k}`),
      exposed: Array.from({ length: exposeCount }, (_, k) => `#${k}`),
    };
  });

  // ────────────────────────────────────────────────────────
  // composables
  // ────────────────────────────────────────────────────────
  //
  // ⚠️ `id` генерируется как `cmp1`, `cmp2`, ... — потому что
  //    в compact `id` не сохраняется (см. схему vue.composables:
  //    `['n', 'f', 'k', 'r', 'v']` — 5 полей).
  //
  // Это by design. См. JSDoc ComposableEntity в codec-types.ts.
  // ============================================================

  const composables: ComposableEntity[] = (vue.composables?.n ?? []).map(
    (nameIdx: number, i: number) => {
      // f — RLE [fileIdx, count]
      const fRle = vue.composables.f ?? [];
      const fUnrle = unrle(fRle);
      const fileIdx = fUnrle[i] ?? 0;

      // v — [composableIdx, returnedKeysCount]
      const vEntry = vue.composables.v?.[i];
      const returnedKeysCount = vEntry?.[1] ?? 0;

      return {
        // ✅ Генерируется при decode (не сохраняется в compact)
        id: `cmp${i + 1}`,
        name: readStr(nameIdx),
        fileId: fileId(fileIdx),
        kind: COMPOSABLE_KIND_BY_CODE[vue.composables.k[i] ?? 0] ?? 'composable',
        returnShape: COMPOSABLE_SHAPE_BY_CODE[vue.composables.r[i] ?? 0] ?? 'object',
        // ⚠️ returnedKeys — только счётчик (плейсхолдеры)
        returnedKeys: Array.from({ length: returnedKeysCount }, (_, k) => `#${k}`),
        // ⚠️ callers не сохраняются в compact
        callers: [],
      };
    }
  );

  // ────────────────────────────────────────────────────────
  // macros
  // ────────────────────────────────────────────────────────
  //
  // ⚠️ `id` генерируется как `mac1`, `mac2`, ... (by design).
  // ============================================================

  const macros: MacroEntity[] = (vue.macros?.f ?? []).map((fileIdx: number, i: number) => ({
    id: `mac${i + 1}`,
    fileId: fileId(fileIdx),
    kind: MACRO_KIND_BY_CODE[vue.macros.k[i] ?? 0] ?? 'props',
    line: vue.macros.l[i] ?? 0,
  }));

  // ────────────────────────────────────────────────────────
  // hooks
  // ────────────────────────────────────────────────────────
  //
  // ⚠️ `id` генерируется как `hk1`, `hk2`, ... (by design).
  // ============================================================

  const hooks: HookEntity[] = (vue.hooks?.f ?? []).map((fileIdx: number, i: number) => ({
    id: `hk${i + 1}`,
    fileId: fileId(fileIdx),
    hookName: HOOK_NAME_BY_CODE[vue.hooks.n[i] ?? 0] ?? 'onMounted',
    line: vue.hooks.l[i] ?? 0,
  }));

  // ────────────────────────────────────────────────────────
  // reactivity
  // ────────────────────────────────────────────────────────
  //
  // ⚠️ `id` генерируется как `rx1`, `rx2`, ... (by design).
  // ============================================================

  const reactivity: ReactivityEntity[] = (vue.reactivity?.f ?? []).map(
    (fileIdx: number, i: number) => {
      const nameIdx = vue.reactivity.n?.[i] ?? -1;
      return {
        id: `rx${i + 1}`,
        fileId: fileId(fileIdx),
        kind: REACTIVITY_KIND_BY_CODE[vue.reactivity.k[i] ?? 0] ?? 'computed',
        line: vue.reactivity.l[i] ?? 0,
        name: nameIdx >= 0 ? readStr(nameIdx) : undefined,
      };
    }
  );

  // ────────────────────────────────────────────────────────
  // icons
  // ────────────────────────────────────────────────────────
  //
  // ⚠️ `id` генерируется как `ic1`, `ic2`, ... (by design).
  // ============================================================

  const icons: IconEntity[] = (vue.icons?.f ?? []).map((fileIdx: number, i: number) => ({
    id: `ic${i + 1}`,
    fileId: fileId(fileIdx),
    name: readStr(vue.icons.n[i] ?? -1),
    category: ICON_CATEGORY_BY_CODE[vue.icons.c[i] ?? 0] ?? 'base',
  }));

  return {
    sfc,
    composables,
    macros,
    hooks,
    reactivity,
    icons,
  };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ DECODE
// ============================================

/**
 * Декодирует сжатый JSON обратно в полный.
 *
 * ✅ v15.7.3 (Vue-секция: реальные имена composables):
 *   - Читает `vue.sfc.cs` (slices) + `vue.sfc.c` (индексы в strs)
 *     → восстанавливает РЕАЛЬНЫЕ имена composables через `readStr`.
 *   - Fallback для старых compact (v15.7.2): плейсхолдеры.
 *
 * ✅ v15.7.2 (Vue-секция: moduleId):
 *   - `decodeVueSection` восстанавливает `moduleId` из `files[]`.
 *
 * ✅ v15.7.0 (Vue entities):
 *   - Читает `fns.vk` (RLE) → `FunctionData.vueKind`.
 *   - Читает `compact.vue` → `FullJSON.vue`.
 *
 * ✅ v15.6.0 (JSON-safe):
 *   - Все значения проходят через `JSON.parse`, безопасно.
 *
 * ✅ v15.4.0 (P3):
 *   - CODEC_VERSION = '15.7.3'.
 *
 * ✅ v15.3.0 (P2 — расширенный CallData):
 *   - Читает `gr.c.col/ck/cn/ai`.
 *
 * ✅ v15.2.0 (P1 — lexicalLinks):
 *   - Читает `compact.lx` (columnar).
 *
 * ✅ v15.1.0 (P0 — parentFunctionId):
 *   - Читает `fns.parent` (RLE).
 *
 * ✅ v15.0.6 (gr.i.tf — индекс в fl.p):
 *   - `tf >= 0` → локальный разрешённый импорт.
 *   - `tf = -1` ∧ isExternal → `external:${pkg}`.
 *   - `tf = -1` ∧ !isExternal ∧ source → `unresolved:${source}`.
 *
 * @param compact — сжатый JSON с легендой
 * @param options — опции декодирования
 * @returns полный JSON
 */
export function decode(compact: CompactJSON, options: DecodeOptions = {}): FullJSON {
  const { includeEdges = false, includeEmptyArrays = true, includeStatistics = true } = options;

  // ============================================
  // 0. Детокенизация словарей
  // ============================================
  const tokens = compact.tokens || [];
  const stringDict = (compact.strs || []).map(s => decodeStr(s, tokens));
  const paramDict = (compact.params || []).map(s => decodeStr(s, tokens));
  const methodDict = (compact.methods || []).map(s => decodeStr(s, tokens));
  const valueDict = compact.values || [];

  const readString = (idx: number): string | undefined => (idx < 0 ? undefined : stringDict[idx]);
  const readStringOrEmpty = (idx: number): string => (idx < 0 ? '' : (stringDict[idx] ?? ''));
  const readParam = (idx: number): string => (idx < 0 ? '' : (paramDict[idx] ?? ''));
  const readMethod = (idx: number): string | null => (idx < 0 ? null : (methodDict[idx] ?? null));
  const readValue = (idx: number): unknown => (idx < 0 ? undefined : valueDict[idx]);

  // ============================================
  // 1. Файлы (сначала — они нужны для modules)
  // ============================================
  const flP = compact.fl?.p || [];
  const flM = compact.fl?.m || [];
  const flMUnrle = unrle(flM);

  const files: FileData[] = [];
  for (let i = 0; i < flP.length; i++) {
    files.push({
      id: `f${i + 1}`,
      path: flP[i] || '',
      moduleId: `m${(flMUnrle[i] ?? 0) + 1}`,
    });
  }

  // ============================================
  // 2. Модули
  // ============================================
  const miN = compact.mi?.n || [];

  // Строим карту: moduleIdx → fileIds
  const moduleFileIds: string[][] = miN.map(() => []);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const modIdx = flMUnrle[i] ?? 0;
    if (modIdx >= 0 && modIdx < moduleFileIds.length) {
      const bucket = moduleFileIds[modIdx];
      if (bucket) {
        bucket.push(`f${i + 1}`);
      }
    }
  }

  const modules: ModuleData[] = [];
  for (let i = 0; i < miN.length; i++) {
    modules.push({
      id: `m${i + 1}`,
      name: miN[i] || '',
      path: miN[i] || '',
      fileIds: moduleFileIds[i] ?? [],
    });
  }

  // ============================================
  // 3. Функции
  // ============================================
  // ✅ v15.1.0 (P0): чтение fns.parent
  // ✅ v15.5.0: чтение fns.vk (vueKind)
  // ============================================
  const fns = compact.fns || { n: [], m: [], f: [], l: [], fl: [], p: [], rt: [] };
  const fnsM = unrle(fns.m || []);
  const fnsF = unrle(fns.f || []);

  // ✅ v15.1.0 (P0): parent — опционально (обратная совместимость)
  const fnsParent = fns.parent ? unrle(fns.parent as [number, number][]) : [];

  // ✅ v15.5.0: vk — опционально (обратная совместимость)
  const fnsVk = fns.vk ? unrle(fns.vk as [number, number][]) : [];

  const functions: FunctionData[] = [];
  for (let i = 0; i < (fns.n || []).length; i++) {
    const name = readStringOrEmpty(fns.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(fns.fl[i] ?? 0);

    // ✅ v15.1.0 (P0): parentFunctionId
    const parentIdx = fnsParent[i] ?? -1;
    const parentFunctionId = parentIdx >= 0 ? `fn${parentIdx + 1}` : null;

    // ✅ v15.5.0: vueKind
    const vkCode = fnsVk[i] ?? 0;
    const vueKind = VUE_KIND_BY_CODE[vkCode] ?? 'function';

    const func: FunctionData = {
      id: `fn${i + 1}`,
      name,
      moduleId: `m${(fnsM[i] ?? 0) + 1}`,
      fileId: `f${(fnsF[i] ?? 0) + 1}`,
      line: fns.l[i] ?? 0,
      isExported: flags.isExported,
      isAsync: flags.isAsync,
      isArrow: flags.isArrow,
      isMethod: flags.isMethod,
      params: (fns.p[i] || []).map(readParam),
      returnType: readString(fns.rt[i] ?? -1),
      parentFunctionId,
      // ✅ v15.5.0
      vueKind,
    };

    if (flags.isEventHandler) func.isEventHandler = true;
    if (flags.isNested) func.isNested = true;
    if (flags.isSelf) func.isSelf = true;
    if (flags.isDynamic) func.isDynamic = true;
    if (flags.isConfig) func.isConfig = true;
    if (flags.isExternal) func.isExternal = true;
    if (flags.isVueTemplate) func.isVueTemplate = true;
    if (flags.isAsyncChain) func.isAsyncChain = true;
    if (flags.isClosure) func.isClosure = true;
    if (flags.isTypeDep) func.isTypeDep = true;
    if (flags.isGenerator) func.isGenerator = true;
    if (flags.isPrivate) func.isPrivate = true;
    if (flags.isProtected) func.isProtected = true;
    if (flags.isStatic) func.isStatic = true;

    functions.push(func);
  }

  // ============================================
  // 4. Классы
  // ============================================
  const cls = compact.cls || { n: [], m: [], f: [], l: [], fl: [], methods: [] };
  const clsM = unrle(cls.m || []);
  const clsF = unrle(cls.f || []);

  const classes: ClassData[] = [];
  for (let i = 0; i < (cls.n || []).length; i++) {
    const name = readStringOrEmpty(cls.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(cls.fl[i] ?? 0);

    classes.push({
      id: `cls${i + 1}`,
      name,
      moduleId: `m${(clsM[i] ?? 0) + 1}`,
      fileId: `f${(clsF[i] ?? 0) + 1}`,
      line: cls.l[i] ?? 0,
      isExported: flags.isExported,
      methods: (cls.methods[i] || []).map(readMethod),
    });
  }

  // ============================================
  // 5. Константы
  // ============================================
  const cn = compact.cn || { n: [], m: [], f: [], l: [], fl: [], nonEmptyV: [] };
  const cnM = unrle(cn.m || []);
  const cnF = unrle(cn.f || []);

  const valueMap = new Map<number, number>();
  for (const [constIdx, valIdx] of cn.nonEmptyV || []) {
    valueMap.set(constIdx, valIdx);
  }

  const constants: ConstantData[] = [];
  for (let i = 0; i < (cn.n || []).length; i++) {
    const name = readStringOrEmpty(cn.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(cn.fl[i] ?? 0);
    const valueIdx = valueMap.get(i);

    constants.push({
      id: `cn${i + 1}`,
      name,
      moduleId: `m${(cnM[i] ?? 0) + 1}`,
      fileId: `f${(cnF[i] ?? 0) + 1}`,
      line: cn.l[i] ?? 0,
      isExported: flags.isExported,
      value: valueIdx !== undefined ? readValue(valueIdx) : undefined,
    });
  }

  // ============================================
  // 6. Экспорты
  // ============================================
  const ge = compact.gr?.e || {
    m: [],
    f: [],
    fn: [],
    l: [],
    ty: [],
    en: [],
    ln: [],
    s: [],
    flags: [],
  };
  const exports: ExportData[] = [];

  for (let i = 0; i < (ge.m || []).length; i++) {
    const typeCode = ge.ty[i] ?? 0;
    let type: 'named' | 'default' | 'type';
    if (typeCode === 1) type = 'default';
    else if (typeCode === 2) type = 'type';
    else type = 'named';

    const flags = ge.flags[i] ?? 0;

    exports.push({
      id: `e${i + 1}`,
      moduleId: `m${(ge.m[i] ?? 0) + 1}`,
      fileId: `f${(ge.f[i] ?? 0) + 1}`,
      functionId: `fn${(ge.fn[i] ?? 0) + 1}`,
      exportName: readStringOrEmpty(ge.en[i] ?? -1),
      localName: readStringOrEmpty(ge.ln[i] ?? -1),
      line: ge.l[i] ?? 0,
      type,
      isDefault: type === 'default',
      isTypeOnly: (flags & 1) !== 0,
      isReExport: (flags & 2) !== 0,
      isStarReExport: (flags & 4) !== 0,
      isDefaultReExport: (flags & 8) !== 0,
      source: readString(ge.s[i] ?? -1),
    });
  }

  // ============================================
  // 7. Импорты
  // ============================================
  // ✅ v15.0.6: tf — ИНДЕКС В fl.p, -1 = внешний/неразрешённый
  // ============================================
  const gi = compact.gr?.i || { ff: [], tf: [], s: [], im: [], ln: [], l: [], ty: [] };
  const imports: ImportData[] = [];

  for (let i = 0; i < (gi.ff || []).length; i++) {
    const combinedTy = gi.ty[i] ?? 0;
    const typeCode = combinedTy & 3;
    const isExternal = (combinedTy & 4) !== 0;
    const isTypeOnly = (combinedTy & 8) !== 0;
    const isReExport = (combinedTy & 16) !== 0;
    const isStarReExport = (combinedTy & 32) !== 0;

    // type — ТОЛЬКО из typeCode
    let type: 'named' | 'default' | 'namespace';
    if (typeCode === 1) type = 'default';
    else if (typeCode === 2) type = 'namespace';
    else type = 'named';

    const source = readStringOrEmpty(gi.s[i] ?? -1);

    // ✅ v15.0.6: tf — индекс в fl.p, -1 = внешний/неразрешённый
    const toFileIdx = gi.tf[i] ?? -1;
    let toFileId: string | null = null;

    if (toFileIdx >= 0) {
      // Локальный РАЗРЕШЁННЫЙ импорт — индекс в fl.p
      toFileId = `f${toFileIdx + 1}`;
    } else if (isExternal) {
      // ✅ v15.0.6-fix (Вариант A): внешний импорт — восстанавливаем
      // toFileId из source
      const pkg = source.startsWith('@')
        ? source.split('/').slice(0, 2).join('/')
        : source.split('/')[0];
      toFileId = pkg ? `external:${pkg}` : null;
    } else if (source) {
      // ✅ v15.0.6-fix (Вариант C): НЕразрешённый локальный импорт
      toFileId = `unresolved:${source}`;
    }
    // else: source пустой → toFileId = null

    const importData: ImportData = {
      id: `i${i + 1}`,
      fromFileId: `f${(gi.ff[i] ?? 0) + 1}`,
      toFileId,
      source,
      importedName: readStringOrEmpty(gi.im[i] ?? -1),
      localName: readStringOrEmpty(gi.ln[i] ?? -1),
      line: gi.l[i] ?? 0,
      type,
      isDefault: type === 'default',
      isNamespace: type === 'namespace',
      isTypeOnly,
      isExternal,
      packageName: isExternal
        ? source.startsWith('@')
          ? source.split('/').slice(0, 2).join('/')
          : source.split('/')[0]
        : undefined,
    };

    // Проброс флагов реэкспорта
    if (isReExport) {
      importData.isReExport = true;
      if (isStarReExport) {
        importData.isStarReExport = true;
      }
    }

    imports.push(importData);
  }

  // ============================================
  // 8. Вызовы (gr.c)
  // ============================================
  // ✅ v15.3.0 (P2): чтение col/ck/cn/ai
  // ============================================
  const gc = compact.gr?.c || { f: [], t: [], l: [], ty: [] };
  const calls: CallData[] = [];

  // ✅ v15.3.0 (P2): опциональные массивы
  const gcCol = gc.col ?? [];
  const gcCk = gc.ck ?? [];
  const gcCn = gc.cn ?? [];
  const gcAi = gc.ai ?? [];

  for (let i = 0; i < (gc.f || []).length; i++) {
    const combinedTy = gc.ty[i] ?? 0;
    const typeCode = combinedTy & 3;
    const isExternal = (combinedTy & 4) !== 0;

    let type: 'direct' | 'async' | 'method' | 'callback';
    if (typeCode === 1) type = 'async';
    else if (typeCode === 2) type = 'method';
    else if (typeCode === 3) type = 'callback';
    else type = 'direct';

    const toFunctionId = isExternal ? readStringOrEmpty(gc.t[i] ?? -1) : `fn${(gc.t[i] ?? 0) + 1}`;

    const call: CallData = {
      id: `c${i + 1}`,
      fromFunctionId: `fn${(gc.f[i] ?? 0) + 1}`,
      toFunctionId,
      line: gc.l[i] ?? 0,
      type,
    };

    // ✅ v15.3.0 (P2): column / callKind / calleeName / argumentIndex
    if (gcCol[i] !== undefined && gcCol[i]! >= 0) {
      call.column = gcCol[i]!;
    }
    if (gcCk[i] !== undefined && gcCk[i]! >= 0) {
      call.callKind = CALL_KIND_BY_CODE[gcCk[i]!];
    }
    if (gcCn[i] !== undefined && gcCn[i]! >= 0) {
      call.calleeName = stringDict[gcCn[i]!];
    }
    if (gcAi[i] !== undefined && gcAi[i]! >= 0) {
      call.argumentIndex = gcAi[i]!;
    }

    calls.push(call);
  }

  // ============================================
  // 9. Реэкспорты
  // ============================================
  const gre = compact.gr?.re || { m: [], fn: [], s: [], en: [], l: [], ty: [] };
  const reExports: ReExportData[] = [];

  for (let i = 0; i < (gre.m || []).length; i++) {
    const combinedTy = gre.ty[i] ?? 0;
    const typeCode = combinedTy & 3;
    const isTypeOnly = (combinedTy & 4) !== 0;

    let type: 'named' | 'default' | 'all';
    if (typeCode === 2) type = 'all';
    else if (typeCode === 1) type = 'default';
    else type = 'named';

    reExports.push({
      id: `re${i + 1}`,
      moduleId: `m${(gre.m[i] ?? 0) + 1}`,
      functionId: `fn${(gre.fn[i] ?? 0) + 1}`,
      source: readStringOrEmpty(gre.s[i] ?? -1),
      exportName: readStringOrEmpty(gre.en[i] ?? -1),
      line: gre.l[i] ?? 0,
      type,
      isDefault: type === 'default',
      isTypeOnly,
      isStarReExport: type === 'all',
    });
  }

  // ============================================
  // 9.5. lexicalLinks (lx)
  // ============================================
  // ✅ v15.2.0 (P1): чтение columnar-секции lx
  // ============================================
  const lexicalLinks: LexicalLink[] = [];

  if (compact.lx) {
    const { p, c, r, l, ai, cn } = compact.lx;
    const pUnrle = unrle(p as [number, number][]);
    const cUnrle = unrle(c as [number, number][]);

    for (let i = 0; i < r.length; i++) {
      const parentIdx = pUnrle[i] ?? -1;
      const childIdx = cUnrle[i] ?? -1;
      const relCode = r[i] ?? 0;
      const argIdx = ai?.[i] ?? -1;
      const calleeIdx = cn?.[i] ?? -1;

      lexicalLinks.push({
        id: `lx${i + 1}`,
        parentFunctionId: parentIdx >= 0 ? `fn${parentIdx + 1}` : null,
        childFunctionId: `fn${childIdx + 1}`,
        relation: LEXICAL_RELATION_BY_CODE[relCode] ?? 'nested',
        line: l[i] ?? 0,
        argumentIndex: argIdx >= 0 ? argIdx : undefined,
        calleeName: calleeIdx >= 0 ? stringDict[calleeIdx] : undefined,
      });
    }
  }

  // ============================================
  // 10. Statistics
  // ============================================
  const statistics = includeStatistics ? compact.st : ({} as any);

  // ============================================
  // 10.5. Восстановление расширенных секций
  //       vt / lc / ef / inj / rx / ty / tr
  // ============================================
  // ⚠️ v15.0.2: секция `cd` (conditionals) НЕ читается здесь.
  //    conditionals восстанавливаются как часть TemplateData
  //    через decodeSection<TemplateData>(compact.vt).
  // ============================================

  const decodeSection = <T>(section: unknown): T[] | undefined => {
    if (!Array.isArray(section)) return undefined;
    const result: T[] = [];
    for (const idx of section) {
      if (typeof idx !== 'number' || idx < 0) continue;
      const raw = readValue(idx);
      if (raw === undefined || raw === null) continue;

      if (typeof raw === 'string') {
        const parsed = safeJsonParse<T>(raw);
        if (parsed !== null) result.push(parsed);
      } else if (typeof raw === 'object') {
        result.push(raw as T);
      }
    }
    return result.length > 0 ? result : undefined;
  };

  const templates = decodeSection<TemplateData>(compact.vt);
  const lifecycle = decodeSection<LifecycleHook>(compact.lc);
  const effects = decodeSection<EffectEdge>(compact.ef);
  const injections = decodeSection<InjectionEdge>(compact.inj);
  const reactivity = decodeSection<ReactivityEdge>(compact.rx);
  const types = decodeSection<TypeNodeData>(compact.ty);
  const typeRefs = decodeSection<TypeRefData>(compact.tr);

  // ============================================
  // 10.6. ✅ v15.7.3: VUE-СЕКЦИЯ
  // ============================================
  // Читаем compact.vue → FullJSON.vue.
  //
  // ✅ v15.7.3: `decodeVueSection` восстанавливает РЕАЛЬНЫЕ имена
  //             composables через `readStr(idx)` из `strs`.
  //
  // ✅ v15.7.2: `moduleId` восстанавливается из `files[].moduleId`.
  // ============================================
  const vue = decodeVueSection(compact.vue, stringDict, files);

  // ============================================
  // 11. Edges (только если includeEdges)
  // ============================================
  const shouldIncludeEdges = includeEdges === true;
  const edges: EdgeData[] = [];

  if (shouldIncludeEdges) {
    for (const imp of imports) {
      edges.push({
        from: imp.fromFileId,
        to: imp.toFileId || 'unknown',
        type: 'import',
        symbol: imp.importedName,
        line: imp.line,
      });
    }

    for (const exp of exports) {
      edges.push({
        from: exp.fileId,
        to: exp.functionId,
        type: 'export',
        symbol: exp.exportName,
        line: exp.line,
      });
    }

    for (const call of calls) {
      edges.push({
        from: call.fromFunctionId,
        to: call.toFunctionId,
        type: 'call',
        line: call.line,
      });
    }

    for (const re of reExports) {
      edges.push({
        from: re.moduleId,
        to: re.functionId,
        type: 're-export',
        symbol: re.exportName,
        line: re.line,
      });
    }

    // ✅ v15.2.0 (P1): лексические рёбра
    for (const link of lexicalLinks) {
      if (!link.parentFunctionId) continue;
      edges.push({
        from: link.parentFunctionId,
        to: link.childFunctionId,
        type: 'lexical',
        symbol: link.relation,
        line: link.line,
      });
    }
  }

  // ============================================
  // 12. Сборка результата
  // ============================================
  // ✅ v15.7.3: version = CODEC_VERSION ('15.7.3')
  // ============================================
  const result: FullJSON = {
    version: CODEC_VERSION,
    timestamp: compact.ts,
    root: `m${(compact.r ?? 0) + 1}`,
    modules,
    files,
    functions,
    classes,
    constants,
    exports,
    imports,
    calls,
    reExports,
    templates,
    statistics,
    lifecycle,
    effects,
    injections,
    reactivity,
    types,
    typeRefs,
    valuesMode: compact.valuesMode,

    // ✅ v15.2.0 (P1): lexicalLinks
    lexicalLinks: lexicalLinks.length > 0 ? lexicalLinks : undefined,

    // ✅ v15.7.3: Vue-секция (sfc.c — реальные имена composables)
    vue,
  };

  if (!includeEmptyArrays) {
    if (modules.length === 0) delete (result as any).modules;
    if (files.length === 0) delete (result as any).files;
    if (functions.length === 0) delete (result as any).functions;
    if (classes.length === 0) delete (result as any).classes;
    if (constants.length === 0) delete (result as any).constants;
    if (exports.length === 0) delete (result as any).exports;
    if (imports.length === 0) delete (result as any).imports;
    if (calls.length === 0) delete (result as any).calls;
    if (reExports.length === 0) delete (result as any).reExports;
    if (lexicalLinks.length === 0) delete (result as any).lexicalLinks;
    if (vue === undefined) delete (result as any).vue;
  }

  if (shouldIncludeEdges && edges.length > 0) {
    result.edges = edges;
  }

  return result;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default decode;
