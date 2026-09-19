// src/reporters/codec/codec-legend.ts
// ============================================
// ЛЕГЕНДА КОДЕКА — САМОДОСТАТОЧНАЯ ДЛЯ ИИ
// ============================================
// Версия: 10.4.1
//
// ИЗМЕНЕНИЯ v10.4.1 (безопасное сокращение):
//   - ✅ СОКРАЩЁН: buildHowToRead() — с ~4 КБ до ~1.2 КБ.
//     Убраны подробные пояснения, дублирующие schemas/codes/flags.
//     Оставлены: алгоритм развёртки, пример fns[0], ссылки на секции.
//   - ✅ УДАЛЕНЫ: 4 поля `description` (не несут данных):
//       • legend.flags.description
//       • legend.codes.description
//       • legend.dictionaries.description
//       • legend.schemas.description
//   - ✅ СОХРАНЕНО БЕЗ ИЗМЕНЕНИЙ:
//       • legend.schemas.*      — порядок полей кортежей
//       • legend.codes.*        — расшифровка кодов типов
//       • legend.flags.bits     — 18 битов
//       • legend.flags.examples — примеры разбора
//       • legend.dictionaries.* — словари значений
//     Это критично для round-trip и для самодостаточности ИИ.
//   - ✅ ОБРАТНАЯ СОВМЕСТИМОСТЬ: сохранена.
//     codec-decode.ts / codec-encode.ts / verify-roundtrip.ts
//     читают те же ключи, что и раньше.
//
// ИЗМЕНЕНИЯ v10.4.0:
//   - ✅ ПЕРЕСТРОЕНА структура legend:
//       how_to_read, flags, codes, dictionaries, schemas
//
// Назначение:
//   Собирает legend для compact.json так, чтобы ИИ (ChatGPT,
//   Claude, Gemini) мог САМ развернуть кортежи в читаемые
//   объекты, не имея дополнительных инструкций.
//
//   Легенда содержит 5 секций:
//     1. how_to_read  — пошаговая инструкция для ИИ (сокращена)
//     2. flags        — расшифровка битовых флагов
//     3. codes        — расшифровка строковых кодов типов
//     4. dictionaries — словари значений (stringDict и др.)
//     5. schemas      — позиционные схемы кортежей
//
//   Статические части (how_to_read, flags, codes, schemas)
//   генерируются из кода — они НЕ хранятся в JSON как данные,
//   а собираются на лету в encode().
//
//   Динамические части (dictionaries) заполняются во время
//   encode() из DictBuilder.
//
// ЗАВИСИМОСТИ:
//   - codec-types.ts  → CodecLegend, FlagBit, CodesDict
//   - codec-encode.ts → FLAG_MAP, FLAG_NAMES, EXPORT_TYPES,
//                       IMPORT_TYPES, CALL_TYPES, RE_EXPORT_TYPES,
//                       LIFECYCLE_TYPES, EFFECT_TYPES,
//                       INJECTION_TYPES, REACTIVITY_TYPES,
//                       CONDITIONAL_TYPES, TYPE_KINDS,
//                       TYPE_USAGE_KINDS
//
// ЭКСПОРТЫ:
//   - buildLegend(dict)      — полная легенда со словарями
//   - buildEmptyLegend()     — легенда с пустыми словарями
//   - SCHEMAS                — позиционные схемы кортежей
//   - LegendDictionaries     — тип словарей
// ============================================

import type { CodecLegend, FlagBit, CodesDict } from './codec-types.js';

import {
  FLAG_MAP,
  FLAG_NAMES,
  EXPORT_TYPES,
  IMPORT_TYPES,
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
// ЧЕЛОВЕКОЧИТАЕМЫЕ ОПИСАНИЯ ФЛАГОВ
// ============================================
// Используется в buildFlagsLegend() для расшифровки
// каждого бита в legend.flags.bits[char].description.
// ============================================

const FLAG_DESCRIPTIONS: Record<string, string> = {
  isAsync: 'Асинхронная функция (async)',
  isExported: 'Экспортируется',
  isMethod: 'Метод класса',
  isArrow: 'Стрелочная функция',
  isEventHandler: 'Обработчик события',
  isNested: 'Вложенная функция',
  isSelf: 'Изолированная (никто не вызывает и не вызывается)',
  isDynamic: 'Динамический импорт',
  isConfig: 'Ссылка на конфиг',
  isExternal: 'Внешняя библиотека',
  isVueTemplate: 'Vue-шаблон',
  isAsyncChain: 'Асинхронная цепочка',
  isClosure: 'Замыкание',
  isTypeDep: 'Типовая зависимость',
  isGenerator: 'Генератор',
  isPrivate: 'Приватный',
  isProtected: 'Защищённый',
  isStatic: 'Статический',
};

// ============================================
// 1. HOW_TO_READ — ИНСТРУКЦИЯ ДЛЯ ИИ
// ============================================
// Пошаговая инструкция, как развернуть кортежи
// compact.json в читаемые объекты.
//
// ✅ v10.4.1: сокращено с ~4 КБ до ~1.2 КБ.
//    Убраны подробные пояснения, которые дублируют
//    legend.schemas + legend.codes + legend.flags.
//    Оставлен только пошаговый алгоритм, пример
//    развёртки и ссылки на нужные секции.
// ============================================

/**
 * Собирает массив строк-инструкций для ИИ.
 *
 * Каждая строка — либо пояснение, либо пример,
 * либо правило. Пустые строки используются для
 * визуального разделения блоков.
 */
function buildHowToRead(): string[] {
  return [
    'compact.json содержит кортежи (массивы) с короткими ключами.',
    '',
    '=== АЛГОРИТМ РАЗВЁРТКИ ===',
    '1. Возьми кортеж из нужной секции (например, fns[0]).',
    '2. Найди схему в legend.schemas.<section> — она задаёт порядок полей.',
    '3. Для каждого поля:',
    '   - *Idx       → индекс в legend.dictionaries.*',
    '   - typeCode   → код в legend.codes.<type>',
    '   - flags      → строка символов, каждый символ — бит из legend.flags.bits',
    '   - isExternal → 0=false, 1=true',
    '   - -1         → null/undefined',
    '',
    '=== СЛОВАРИ (dictionaries) ===',
    '  paramsIdx[]  → legend.dictionaries.paramDict',
    '  methodsIdx[] → legend.dictionaries.methodDict',
    '  valueIdx     → legend.dictionaries.valueDict',
    '  остальные *Idx → legend.dictionaries.stringDict',
    '',
    '=== КОДЫ ТИПОВ (codes) ===',
    '  gr.e[4]  typeCode      → legend.codes.export',
    '  gr.i[6]  typeCode      → legend.codes.import',
    '  gr.c[3]  typeCode      → legend.codes.call',
    '  gr.re[5] typeCode      → legend.codes.reExport',
    '  lc[0]    hookCode      → legend.codes.lifecycle',
    '  ef[0]    effectCode    → legend.codes.effect',
    '  inj[0]   kindCode      → legend.codes.injection',
    '  rx[0]    kindCode      → legend.codes.reactivity',
    '  cd[0]    directiveCode → legend.codes.conditional',
    '  ty[0]    kindCode      → legend.codes.typeKind',
    '  tr[4]    usageCode     → legend.codes.typeUsage',
    '',
    '=== ФЛАГИ (flags) ===',
    'В поле flags (например, fns[5] = "ae") каждый символ — это',
    'установленный бит. Порядок символов не важен. Расшифровка:',
    '  legend.flags.bits     — символ → { bit, name, description }',
    '  legend.flags.examples — примеры разбора',
    '',
    '=== ПРИМЕР РАЗВЁРТКИ ===',
    'Вход:  fns[0] = ["fn1", "escapeHtml", "m1", "f1", 10, "e", [0], -1]',
    'Шаги:',
    '  1. schemas.fns = [id, name, moduleId, fileId, line, flags, paramsIdx, returnTypeIdx]',
    '  2. id           = "fn1"',
    '  3. name         = "escapeHtml"',
    '  4. moduleId     = "m1"',
    '  5. fileId       = "f1"',
    '  6. line         = 10',
    '  7. flags        = "e" → bits["e"] = { isExported: true }',
    '  8. paramsIdx[0] = 0 → paramDict[0] = "str" → params: ["str"]',
    '  9. returnTypeIdx = -1 → returnType: undefined',
    'Результат:',
    '  {',
    '    id: "fn1",',
    '    name: "escapeHtml",',
    '    moduleId: "m1",',
    '    fileId: "f1",',
    '    line: 10,',
    '    isExported: true,',
    '    params: ["str"],',
    '    returnType: undefined',
    '  }',
    '',
    '=== СВЯЗИ МЕЖДУ СЕКЦИЯМИ ===',
    '  mi (modules)   → m1, m2, ...  используются в fns[2], cls[2], cn[2]',
    '  fl (files)     → f1, f2, ...  используются в fns[3], cls[3], cn[3]',
    '  fns (functions)→ fn1, fn2,... используются в gr.e[2], gr.c[0..1], gr.re[1]',
    '',
    '=== ОБРАТНАЯ СВЯЗЬ ===',
    'Чтобы получить «кто вызывает X», найди все gr.c, где toIdx = X.',
    'Чтобы получить «кто импортирует X», найди все gr.i, где importedNameIdx = X.',
    'Чтобы получить «кто экспортирует X», найди все gr.e, где exportNameIdx = X.',
  ];
}

// ============================================
// 2. FLAGS — РАСШИФРОВКА БИТОВЫХ ФЛАГОВ
// ============================================
// Строит секцию legend.flags:
//   - bits        — символ → { bit, name, description }
//   - examples    — примеры разбора
//
// ✅ v10.4.1: удалено поле `description` (не несёт данных).
//    `bits` и `examples` сохранены полностью.
//
// Использует FLAG_MAP и FLAG_NAMES из codec-encode.ts,
// чтобы не дублировать константы.
// ============================================

/**
 * Собирает секцию flags для легенды.
 */
function buildFlagsLegend(): CodecLegend['flags'] {
  const bits: Record<string, FlagBit> = {};

  for (const [bitStr, char] of Object.entries(FLAG_MAP)) {
    const bit = parseInt(bitStr, 10);
    const name = FLAG_NAMES[bit] || `unknown_${bit}`;
    bits[char] = {
      bit,
      name,
      description: FLAG_DESCRIPTIONS[name] || name,
    };
  }

  return {
    // ✅ v10.4.1: поле `description` удалено
    bits,
    examples: {
      '0': 'нет флагов',
      e: 'isExported=true',
      a: 'isAsync=true',
      ar: 'isAsync=true, isArrow=true',
      em: 'isExported=true, isMethod=true',
      aem: 'isAsync=true, isExported=true, isMethod=true',
      es: 'isExported=true, isSelf=true',
      aes: 'isAsync=true, isExported=true, isSelf=true',
    },
  };
}

// ============================================
// 3. CODES — РАСШИФРОВКА СТРОКОВЫХ КОДОВ
// ============================================
// Строит секцию legend.codes:
//   - export      — коды типов экспортов
//   - import      — коды типов импортов
//   - call        — коды типов вызовов
//   - reExport    — коды типов реэкспортов
//   - lifecycle   — коды хуков жизненного цикла
//   - effect      — коды side-эффектов
//   - injection   — коды provide/inject
//   - reactivity  — коды реактивных связей
//   - conditional — коды условного рендеринга
//   - typeKind    — коды видов типов
//   - typeUsage   — коды использования типов
//
// ✅ v10.4.1: удалено поле `description` (не несёт данных).
//    Все словари `codes.*` сохранены полностью.
//
// Для каждого словаря:
//   - base даёт код → имя (из codec-encode.ts)
//   - overrides даёт код → человекочитаемое описание
//   - если override есть, он побеждает
// ============================================

/**
 * Собирает секцию codes для легенды.
 */
function buildCodesLegend(): CodecLegend['codes'] {
  return {
    // ✅ v10.4.1: поле `description` удалено

    // ==========================================
    // ЭКСПОРТЫ
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
    import: mergeDict(IMPORT_TYPES, {
      n: 'named (именованный импорт)',
      df: 'default (импорт по умолчанию)',
      ns: 'namespace (import * as)',
      to: 'type (import type)',
    }),

    // ==========================================
    // ВЫЗОВЫ
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

/**
 * Строит словарь { код: человекочитаемое_описание }.
 *
 * Логика:
 *   1. Для каждого кода из base берём имя как fallback.
 *   2. Если для кода есть override — используем его.
 *   3. Если в overrides есть код, которого нет в base —
 *      добавляем его (на всякий случай, для расширяемости).
 *
 * @param base      — базовый словарь код → имя (из codec-encode.ts)
 * @param overrides — словарь код → человекочитаемое описание
 * @returns итоговый словарь { код: описание }
 */
function mergeDict(base: Record<string, string>, overrides: CodesDict): CodesDict {
  const result: CodesDict = {};

  // 1. Заполняем базовыми значениями
  for (const [code, name] of Object.entries(base)) {
    result[code] = overrides[code] ?? name;
  }

  // 2. Добавляем коды, которых нет в base (для расширяемости)
  for (const [code, desc] of Object.entries(overrides)) {
    if (!(code in result)) {
      result[code] = desc;
    }
  }

  return result;
}

// ============================================
// 4. SCHEMAS — ПОЗИЦИОННЫЕ СХЕМЫ КОРТЕЖЕЙ
// ============================================
// Экспортируется как константа SCHEMAS.
//
// ✅ v10.4.1: поле `description` удалено.
//    Все схемы кортежей сохранены полностью.
//
// Каждое имя в массиве — это имя поля кортежа.
// Позиция в массиве = позиция в кортеже.
//
// ⚠️ ВАЖНО: длина массива должна точно совпадать
// с длиной кортежа в CompactJSON. Если кортеж
// расширяется — обновите и схему, и кодек.
// ============================================

export const SCHEMAS: CodecLegend['schemas'] = {
  // ✅ v10.4.1: поле `description` удалено

  // ==========================================
  // ФУНКЦИИ: 8 полей
  // ==========================================
  fns: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'paramsIdx', 'returnTypeIdx'],

  // ==========================================
  // КЛАССЫ: 7 полей
  // ==========================================
  cls: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'methodsIdx'],

  // ==========================================
  // КОНСТАНТЫ: 7 полей
  // ==========================================
  cn: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'valueIdx'],

  // ==========================================
  // ЭКСПОРТЫ: 12 полей
  // ==========================================
  'gr.e': [
    'moduleIdx',
    'fileIdx',
    'funcIdx',
    'line',
    'typeCode',
    'exportNameIdx',
    'localNameIdx',
    'isTypeOnly',
    'isReExport',
    'sourceIdx',
    'isStarReExport',
    'isDefaultReExport',
  ],

  // ==========================================
  // ИМПОРТЫ: 8 полей
  // ==========================================
  'gr.i': [
    'fromFileIdx',
    'toFileIdIdx',
    'sourceIdx',
    'importedNameIdx',
    'localNameIdx',
    'line',
    'typeCode',
    'isExternal',
  ],

  // ==========================================
  // ВЫЗОВЫ: 5 полей
  // ==========================================
  'gr.c': ['fromIdx', 'toIdx', 'line', 'typeCode', 'isExternal'],

  // ==========================================
  // РЕЭКСПОРТЫ: 7 полей
  // ==========================================
  'gr.re': [
    'moduleIdx',
    'funcIdx',
    'sourceIdx',
    'exportNameIdx',
    'line',
    'typeCode',
    'isTypeOnly',
  ],

  // ==========================================
  // VUE TEMPLATES: 12 полей
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
  // VUE: вложенные схемы
  // ==========================================
  'vt.eventHandlers': [
    'eventNameIdx',
    'handlerNameIdx',
    'tagIdx',
    'line',
    'modifiersIdx',
    'isExternal',
  ],

  'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],

  'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],

  'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],

  'vt.deepSelectors': ['selectorIdx', 'line'],

  // ==========================================
  // LIFECYCLE: 5 полей
  // ==========================================
  lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],

  // ==========================================
  // EFFECTS: 5 полей
  // ==========================================
  ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],

  // ==========================================
  // INJECTIONS: 5 полей
  // ==========================================
  inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],

  // ==========================================
  // REACTIVITY: 6 полей
  // ==========================================
  rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],

  // ==========================================
  // CONDITIONALS: 6 полей
  // ==========================================
  cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],

  // ==========================================
  // TYPES: 7 полей
  // ==========================================
  ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line', 'membersIdx', 'extendsIdx'],

  // ==========================================
  // TYPE REFS: 5 полей
  // ==========================================
  tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
};

// ============================================
// 5. СБОРКА ПОЛНОЙ ЛЕГЕНДЫ
// ============================================

/**
 * Словари, накопленные во время encode().
 *
 * Передаются в buildLegend() из codec-encode.ts,
 * где DictBuilder уже собрал все строки/параметры/
 * методы/значения.
 */
export interface LegendDictionaries {
  /** Все уникальные строки (имена, пути, типы и т.д.) */
  stringDict: string[];
  /** Все имена параметров функций */
  paramDict: string[];
  /** Все имена методов классов */
  methodDict: string[];
  /** Все значения констант (примитивы, массивы, объекты) */
  valueDict: unknown[];
}

/**
 * Собирает полную legend для compact.json.
 *
 * ✅ v10.4.1: удалено поле `description` из dictionaries.
 *    Все словари сохранены полностью.
 *
 * @param dict — словари, накопленные во время encode()
 * @returns полная legend со всеми 5 секциями
 *
 * @example
 * ```typescript
 * const legend = buildLegend({
 *   stringDict: dict.stringDict,
 *   paramDict: dict.paramDict,
 *   methodDict: dict.methodDict,
 *   valueDict: dict.valueDict,
 * });
 * ```
 */
export function buildLegend(dict: LegendDictionaries): CodecLegend {
  return {
    // 1. Инструкция для ИИ (сокращена в v10.4.1)
    how_to_read: buildHowToRead(),

    // 2. Расшифровка флагов (без description в v10.4.1)
    flags: buildFlagsLegend(),

    // 3. Расшифровка кодов типов (без description в v10.4.1)
    codes: buildCodesLegend(),

    // 4. Словари значений (без description в v10.4.1)
    dictionaries: {
      stringDict: dict.stringDict,
      paramDict: dict.paramDict,
      methodDict: dict.methodDict,
      valueDict: dict.valueDict,
    },

    // 5. Позиционные схемы кортежей (без description в v10.4.1)
    schemas: SCHEMAS,
  };
}

/**
 * Возвращает легенду с ПУСТЫМИ словарями.
 *
 * Используется в Codec.getLegend() для обратной
 * совместимости — когда нужна структура легенды,
 * но без реальных данных.
 *
 * @returns legend с пустыми dictionaries
 */
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
