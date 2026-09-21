// src/reporters/codec/codec-legend.ts
// ============================================
// ЛЕГЕНДА КОДЕКА
// ============================================
// Версия: 15.0.2
//
// ИЗМЕНЕНИЯ v15.0.2:
//   - ✅ УБРАНО упоминание '@deprecated' и обратной совместимости.
//   - ✅ ОБНОВЛЕНА версия: 15.0.1 → 15.0.2.
//   - ✅ ЯВНО указано, что conditionals живут ТОЛЬКО в
//     `templates[].conditionals`. Секция `cd` в compact.json
//     по-прежнему существует (схема `cd` сохранена) и кодируется
//     из `templates[].conditionals`.
//
// ИЗМЕНЕНИЯ v15.0.1:
//   - ✅ УБРАН код 'to' из legend.codes.import.
//     Причина: поле ImportData.type больше НЕ содержит 'type' —
//     isTypeOnly вынесен в отдельный флаг. Семантика:
//       type        — 'named' | 'default' | 'namespace'
//       isTypeOnly  — boolean
//
// ИЗМЕНЕНИЯ v13.0.0:
//   - ✅ ДОБАВЛЕНЫ схемы mi и fl в SCHEMAS.
//   - ✅ УТОЧНЕН комментарий к mi.f: пары [startFileIdx, fileCount].
//
// ИЗМЕНЕНИЯ v12.0.0 (структурная оптимизация):
//   - ✅ УДАЛЕНЫ how_to_read и flags.examples.
//   - ✅ flags.bits — простой словарь { "1": "isAsync", ... }.
//   - ✅ schemas — обновлены под columnar-структуру.
//   - ✅ УДАЛЕНО поле dictionaries (словари переехали в корень
//     compact.json).
//
// ИЗМЕНЕНИЯ v10.4.1:
//   - Удалены 5 полей description.
//
// ИЗМЕНЕНИЯ v10.4.0:
//   - Перестроена структура legend: how_to_read, flags, codes,
//     dictionaries, schemas.
// ============================================

import type { CodecLegend, CodesDict } from './codec-types.js';

import {
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
//   schemas.fns = ['n', 'm', 'f', 'l', 'fl', 'p', 'rt']
//   кортеж fns имеет 7 параллельных массивов:
//     fns.n[0]  — nameIdx
//     fns.m[0]  — moduleIdx (в RLE)
//     fns.f[0]  — fileIdx (в RLE)
//     fns.l[0]  — line
//     fns.fl[0] — flags
//     fns.p[0]  — paramsIdx
//     fns.rt[0] — returnTypeIdx
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
  // fns — функции: 7 параллельных массивов
  // ==========================================
  fns: ['n', 'm', 'f', 'l', 'fl', 'p', 'rt'],

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
  'gr.i': ['ff', 'tf', 's', 'im', 'ln', 'l', 'ty'],

  // ==========================================
  // gr.c — вызовы: 4 параллельных массива
  // ==========================================
  'gr.c': ['f', 't', 'l', 'ty'],

  // ==========================================
  // gr.re — реэкспорты: 6 параллельных массивов
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
    //
    // Числовые коды в compact.gr.i.ty (младшие 2 бита):
    //   0 = named
    //   1 = default
    //   2 = namespace
    //   3 = reserved
    //
    // Бит 2 = isExternal
    // Бит 3 = isTypeOnly
    //
    // ⚠️ Код 'to' (type) остаётся в IMPORT_TYPES для обратной
    // совместимости со старыми full.json, но в legend он
    // не нужен — isTypeOnly читается из отдельного бита.
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
