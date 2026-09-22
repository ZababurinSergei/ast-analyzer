// src/reporters/codec/codec-legend.ts
// ============================================
// ЛЕГЕНДА КОДЕКА
// ============================================
// Версия: 15.4.0
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

// ============================================
// SCHEMAS — ПОЗИЦИОННЫЕ СХЕМЫ КОРТЕЖЕЙ
// ============================================
//
// Схемы отражают columnar-структуру compact.json.
// Каждое имя в массиве — это имя поля-массива внутри
// соответствующего columnar-объекта.
//
// Пример:
//   schemas.fns = ['n', 'm', 'f', 'l', 'fl', 'p', 'rt', 'parent']
//   кортеж fns имеет 8 параллельных массивов:
//     fns.n[0]      — nameIdx
//     fns.m[0]      — moduleIdx (в RLE)
//     fns.f[0]      — fileIdx (в RLE)
//     fns.l[0]      — line
//     fns.fl[0]     — flags
//     fns.p[0]      — paramsIdx
//     fns.rt[0]     — returnTypeIdx
//     fns.parent[0] — parentFunctionIdx (RLE), -1 = null  ← v15.1.0 (P0)
//
// ⚠️ ВАЖНО (v15.0.2): схема `cd` сохранена, потому что секция `cd`
// по-прежнему кодируется в compact.json. НО в FullJSON верхнеуровневого
// `conditionals` больше нет — все conditionals живут ТОЛЬКО в
// `templates[].conditionals`, и `cd` собирается из них при encode.
// ============================================

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
  // fns — функции: 8 параллельных массивов
  // ==========================================
  // ✅ v15.1.0 (P0): добавлен 'parent'
  //   parent: [parentFunctionIdx, count][] — RLE, -1 = null
  // ==========================================
  fns: ['n', 'm', 'f', 'l', 'fl', 'p', 'rt', 'parent'],

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
};
