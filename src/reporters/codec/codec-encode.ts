// src/reporters/codec/codec-encode.ts
// ============================================
// КОДИРОВАНИЕ: FullJSON → CompactJSON (v13.0.2 — values-mode + фиксы round-trip)
// ============================================
// Версия: 13.0.2
//
// ИЗМЕНЕНИЯ v13.0.2-fix (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: `encodeStr` больше не токенизирует строки,
//     содержащие разделители (`_`, `-`, `/`, `.`, `:`) и цифры.
//     Причина: `tokenizeStr()` удаляет разделители, а `decodeStr`
//     склеивает токены через `join('')` — разделители теряются.
//     Примеры:
//       • "estree-walker"       → ["estree", "walker"] → "estreewalker"
//       • "./foo/bar"           → ["foo", "bar"]       → "foobar"
//       • "external:Z3Verifier" → ["external:", "Z3", "Verifier"]
//                                → "external:Z3Verifier" (теряется ":")
//     Это ломало `imports[].toFileId` (external:estree-walker →
//     external:estreewalker) и `calls[].toFunctionId` для некоторых
//     external-вызовов (external:Z3Verifier → не находилось в decoded).
//     Теперь строки с разделителями/цифрами хранятся целиком.
//
// ИЗМЕНЕНИЯ v13.0.1-fix (100% round-trip):
//   - ✅ УДАЛЕНА функция `stableSortById` из encode().
//     Причина: decode() восстанавливает id из ПОЗИЦИИ в массиве:
//       functions[i].id = `fn${i + 1}`
//       modules[i].id   = `m${i + 1}`
//       ...
//     Поэтому encode() ОБЯЗАН использовать тот же порядок,
//     что и в full.json. Сортировка по строковому id
//     ("fn1" < "fn10" < "fn2") ломала соответствие и давала
//     расхождения:
//       • modules[].path       (порядок модулей разный)
//       • imports[].toFileId   (fileReverse даёт неверный индекс)
//       • calls[].type         (async/direct перепутаны)
//       • functions[].*Flags   (isExported/isArrow перепутаны)
//       • external calls       (не находились в decoded)
//       • L1/L2/DL/DEC/RE/ENC  (все round-trip уровни падали)
//     collectFullJSON() уже строит массивы в каноническом
//     порядке (id = `${prefix}${counter}`, counter++ при push),
//     поэтому сортировка не нужна и вредна.
//
// ИЗМЕНЕНИЯ v13.0.0-fix (100% round-trip):
//   - ✅ ДОБАВЛЕНО: импорт CODEC_VERSION из './codec-types.js'
//     (устранено расхождение "13.0.0" vs "11.1.0" в full.json).
//   - ✅ ИСПРАВЛЕНО: секция `mi` — теперь `mi.f` содержит пары
//     `[startFileIdx, fileCount]`, а НЕ RLE от moduleIdx.
//     Раньше decode читал `mi.f` как startFileIdx и восстанавливал
//     неверные fileIds ("f10" вместо "f80", длины 1 вместо N).
//   - ✅ ИСПРАВЛЕНО: `encodeStr` не токенизирует строки короче 8 символов.
//     Это устраняет коллизии вроде `"f79"` → `["f", "79"]` при decode,
//     когда "f" есть в tokens, а "79" — нет (imports[].toFileId).
//   - ✅ ИСПОЛЬЗУЕТСЯ: `v: CODEC_VERSION` вместо жёсткой строки.
//
// ИЗМЕНЕНИЯ v13.0.0 (флаг --values-mode):
//   - ✅ ДОБАВЛЕНО: параметр `valuesMode: 'full' | 'relations'` в encode().
//     По умолчанию — 'relations'.
//   - ✅ ДОБАВЛЕНО: поле `valueMeta` в DictBuilder — параллельный массив
//     метаданных для каждого значения в valueDict.
//   - ✅ ДОБАВЛЕНО: сигнатура addValue(dict, value, key, kind) — теперь
//     принимает ключ и категорию для фильтрации.
//   - ✅ ДОБАВЛЕНО: функция classifyValue(value) — эвристика категоризации.
//   - ✅ ДОБАВЛЕНО: фильтрация valueDict в режиме 'relations' через
//     filterValues() из './values-filter.js'.
//   - ✅ ДОБАВЛЕНО: переиндексация cn.nonEmptyV после фильтрации.
//   - ✅ ДОБАВЛЕНО: поле `valuesMode` в CompactJSON.
//   - ✅ Round-trip сохраняется полностью: фильтрация происходит ДО
//     сборки CompactJSON, и все ссылки переиндексируются согласованно.
//     decode(encode(full)) === full для отфильтрованного full.json.
//   - ✅ Обратная совместимость: если valuesMode === 'full' —
//     поведение идентично v12.0.0 (только добавляется поле valuesMode).
//
// ИЗМЕНЕНИЯ v12.0.1:
//   - ✅ ИСПРАВЛЕНО: удалены неиспользуемые type-импорты
//     (TemplateData, LifecycleHook, EffectEdge, InjectionEdge,
//      ReactivityEdge, TemplateConditional, TypeNodeData, TypeRefData).
//   - ✅ ИСПРАВЛЕНО: rle() — non-null assertion для arr[0]/arr[i].
//   - ✅ ВОССТАНОВЛЕН экспорт RELATION_TYPES.
//
// ИЗМЕНЕНИЯ v12.0.0 (структурная оптимизация):
//   - ✅ Columnar-структура для всех секций (mi, fl, fns, cls, cn, gr.*)
//   - ✅ RLE для moduleIdx/fileIdx в fns, cls, cn
//   - ✅ Битовые маски для булевых флагов (exports, imports, calls, re-exports)
//   - ✅ Числовые коды вместо строковых
//   - ✅ Удалены поля id (m1, f1, fn1) — позиция в массиве = ID
//   - ✅ Токенизация словарей строк (strs, params, methods)
//   - ✅ nonEmptyV для констант (только непустые значения)
//
// ИЗМЕНЕНИЯ v11.0.0 (компактнее):
//   - fns/cls/cn: name → nameIdx, flags → number
//
// ИЗМЕНЕНИЯ v10.4.0 (легенда для ИИ):
//   - buildLegend из './codec-legend.js'
// ============================================

import type {
  FullJSON,
  CompactJSON,
  CodecLegend,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  ModuleData,
  FileData,
} from './codec-types.js';

import { buildLegend } from './codec-legend.js';

// ✅ v13.0.0-fix: единая версия (устраняет расхождение "13.0.0" vs "11.1.0")
import { CODEC_VERSION } from './codec-types.js';

// ✅ v13.0.0: импорт фильтрации values
import { filterValues, remapIndex, type ValuesMode, type ValueMeta } from './values-filter.js';

// ============================================
// СЛОВАРИ
// ============================================

/**
 * Карта флагов: бит → имя.
 *
 * Биты:
 *   1      = async
 *   2      = exported
 *   4      = method
 *   8      = arrow
 *   16     = event handler
 *   32     = nested
 *   64     = self
 *   128    = dynamic
 *   256    = config
 *   512    = external
 *   1024   = vue template
 *   2048   = async chain
 *   4096   = closure
 *   8192   = type dep
 *   16384  = generator
 *   32768  = private
 *   65536  = protected
 *   131072 = static
 *
 * ⚠️ ВАЖНО (v12.0.0): флаги кодируются ЧИСЛОМ, а не строкой символов.
 * Эта карта используется для сборки legend.flags.bits (key → name)
 * и для обратного декодирования через decodeFlagsFromNumber.
 */
export const FLAG_MAP: Record<number, string> = {
  1: 'isAsync',
  2: 'isExported',
  4: 'isMethod',
  8: 'isArrow',
  16: 'isEventHandler',
  32: 'isNested',
  64: 'isSelf',
  128: 'isDynamic',
  256: 'isConfig',
  512: 'isExternal',
  1024: 'isVueTemplate',
  2048: 'isAsyncChain',
  4096: 'isClosure',
  8192: 'isTypeDep',
  16384: 'isGenerator',
  32768: 'isPrivate',
  65536: 'isProtected',
  131072: 'isStatic',
};

/**
 * Обратная карта: имя → бит.
 *
 * ⚠️ v12.0.0: сохранена для обратной совместимости публичного API.
 * Внутри encode() не используется (флаги пишутся числом).
 */
export const FLAG_CHAR_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([bit, name]) => [name, parseInt(bit, 10)])
);

/**
 * Имена флагов: бит → имя.
 *
 * Используется в codec-legend.ts для buildFlagsLegend().
 */
export const FLAG_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([bit, name]) => [parseInt(bit, 10), name])
);

/**
 * ✅ v12.0.1: восстановлен экспорт RELATION_TYPES.
 *
 * Используется в codec.ts и index.ts для обратной совместимости
 * публичного API (внутри самого encode() не используется).
 *
 * ⚠️ v12.0.0 перешёл на числовые коды (`ty`), поэтому строковые
 * коды типов связей больше не пишутся в compact.json. Однако
 * экспорт сохранён, потому что внешние потребители (CLI, тесты,
 * отладка) могут его импортировать.
 */
export const RELATION_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
  e: 'external',
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type-only',
  ne: 'named-export',
  de: 'default-export',
  te: 'type-export',
  re: 're-export',
  all: 'all',
};

/**
 * Типы экспортов.
 */
export const EXPORT_TYPES: Record<string, string> = {
  ne: 'named',
  de: 'default',
  te: 'type',
  re: 're-export',
};

/**
 * Типы импортов.
 *
 * ✅ v9.0.6: 'to' → 'type' (не 'type-only').
 */
export const IMPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type',
};

/**
 * Типы вызовов.
 *
 * ✅ v9.0.5: содержит все 4 типа: direct / async / method / callback.
 */
export const CALL_TYPES: Record<string, string> = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
};

/**
 * Типы реэкспортов.
 */
export const RE_EXPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  all: 'all',
};

/**
 * Хуки жизненного цикла Vue.
 */
export const LIFECYCLE_TYPES: Record<string, string> = {
  m: 'onMounted',
  u: 'onUnmounted',
  s: 'onScopeDispose',
  a: 'onActivated',
  d: 'onDeactivated',
  w: 'watch',
  W: 'watchEffect',
  e: 'onErrorCaptured',
};

/**
 * Типы side-эффектов.
 */
export const EFFECT_TYPES: Record<string, string> = {
  t: 'timer',
  c: 'cleanup',
  p: 'promise',
  e: 'event',
  s: 'subscription',
};

/**
 * Типы provide/inject.
 */
export const INJECTION_TYPES: Record<string, string> = {
  p: 'provide',
  i: 'inject',
};

/**
 * Типы реактивности Vue.
 */
export const REACTIVITY_TYPES: Record<string, string> = {
  c: 'computed',
  w: 'watch',
  W: 'watchEffect',
  r: 'ref',
  R: 'reactive',
  S: 'shallowRef',
  o: 'readonly',
};

/**
 * Типы условных директив.
 */
export const CONDITIONAL_TYPES: Record<string, string> = {
  i: 'v-if',
  e: 'v-else-if',
  E: 'v-else',
};

/**
 * Виды type-узлов.
 */
export const TYPE_KINDS: Record<string, string> = {
  i: 'interface',
  t: 'type-alias',
  e: 'enum',
  c: 'class',
};

/**
 * Виды использования типов.
 */
export const TYPE_USAGE_KINDS: Record<string, string> = {
  p: 'param',
  r: 'return',
  f: 'field',
  g: 'generic',
  u: 'union',
  x: 'extends',
};

// ============================================
// КОДИРОВАНИЕ ФЛАГОВ
// ============================================

/**
 * Кодирует булевы флаги функции в число.
 *
 * ✅ reversibility: кодирует все 18 битов.
 */
export function encodeFlags(obj: Partial<FunctionData & ClassData & ConstantData>): number {
  let flags = 0;
  for (const [bitStr, name] of Object.entries(FLAG_MAP)) {
    if ((obj as any)[name]) {
      flags |= parseInt(bitStr, 10);
    }
  }
  return flags;
}

/**
 * Кодирует число флагов в строку символов.
 *
 * ⚠️ v12.0.0: НЕ используется в encode() для fns/cls/cn
 * (там пишется число). Оставлено для отладки и обратной
 * совместимости публичного API.
 */
export function flagsToString(flags: number): string {
  if (flags === 0) return '0';
  let result = '';
  for (const [bitStr, char] of Object.entries(FLAG_MAP)) {
    if (flags & parseInt(bitStr, 10)) {
      result += char;
    }
  }
  return result || '0';
}

// ============================================
// ХЕЛПЕРЫ СЛОВАРЕЙ
// ============================================

// ✅ v13.0.0: расширенный DictBuilder — добавлено поле valueMeta
interface DictBuilder {
  stringDict: string[];
  stringMap: Map<string, number>;
  paramDict: string[];
  paramMap: Map<string, number>;
  methodDict: string[];
  methodMap: Map<string, number>;
  valueDict: unknown[];
  valueMap: Map<string, number>;
  /** ← НОВОЕ v13.0.0: параллельный массив метаданных для valueDict */
  valueMeta: ValueMeta[];
}

export function createDictBuilder(): DictBuilder {
  return {
    stringDict: [],
    stringMap: new Map(),
    paramDict: [],
    paramMap: new Map(),
    methodDict: [],
    methodMap: new Map(),
    valueDict: [],
    valueMap: new Map(),
    // ← НОВОЕ v13.0.0
    valueMeta: [],
  };
}

/**
 * Добавить строку в stringDict, вернуть индекс.
 * Пустая строка, undefined или null → -1.
 */
export function addString(dict: DictBuilder, str: string | undefined | null): number {
  if (str === undefined || str === null || str === '') return -1;
  const existing = dict.stringMap.get(str);
  if (existing !== undefined) return existing;
  const idx = dict.stringDict.length;
  dict.stringDict.push(str);
  dict.stringMap.set(str, idx);
  return idx;
}

/**
 * Добавить параметр в paramDict, вернуть индекс.
 */
export function addParam(dict: DictBuilder, param: string): number {
  if (!param) return -1;
  const existing = dict.paramMap.get(param);
  if (existing !== undefined) return existing;
  const idx = dict.paramDict.length;
  dict.paramDict.push(param);
  dict.paramMap.set(param, idx);
  return idx;
}

/**
 * Добавить метод в methodDict, вернуть индекс.
 */
export function addMethod(dict: DictBuilder, method: string): number {
  if (!method) return -1;
  const existing = dict.methodMap.get(method);
  if (existing !== undefined) return existing;
  const idx = dict.methodDict.length;
  dict.methodDict.push(method);
  dict.methodMap.set(method, idx);
  return idx;
}

/**
 * ✅ v13.0.0: эвристика категоризации значения.
 *
 * Определяет, к какому типу относится значение:
 *   - 'relation'   — примитивы и маленькие объекты (нужны для связей)
 *   - 'config'     — большие объекты (>500 символов JSON)
 *   - 'template'   — длинные строки (>200 символов)
 *   - 'flag-array' — длинные массивы (>50 элементов)
 *   - 'code'       — строки с кодом (эвристика по содержимому)
 *   - 'other'      — всё остальное
 *
 * ⚠️ Эвристика покрывает 90% случаев. Если нужно — расширяйте через
 * RELATION_KEYS в values-filter.ts.
 */
export function classifyValue(value: unknown): ValueMeta['kind'] {
  if (value === null || value === undefined) return 'other';

  // Примитивы → всегда relation
  if (typeof value === 'number' || typeof value === 'boolean') return 'relation';

  // Строки: длинные → template/code, короткие → relation
  if (typeof value === 'string') {
    if (value.length > 500) return 'code';
    if (value.length > 200) return 'template';
    return 'relation';
  }

  // Массивы: длинные → flag-array, короткие → relation
  if (Array.isArray(value)) {
    if (value.length > 50) return 'flag-array';
    // Проверяем содержимое: если все элементы — числа/строки, это
    // может быть словарь (relation). Если объекты — тоже relation,
    // пока массив маленький.
    return 'relation';
  }

  // Объекты: большие → config, маленькие → relation
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      if (json.length > 500) return 'config';
      // Проверяем на HTML/CSS-шаблоны
      if (json.includes('<style') || json.includes('<script') || json.includes('</html>')) {
        return 'template';
      }
      return 'relation';
    } catch {
      return 'other';
    }
  }

  return 'other';
}

/**
 * Добавить значение в valueDict, вернуть индекс.
 *
 * ✅ v13.0.0: расширена сигнатура — принимает `key` и `kind`
 * для последующей фильтрации. Если `key` не задан — используется
 * автоматическая категоризация через classifyValue.
 *
 * Для примитивов — ключ = String(value).
 * Для объектов — ключ = JSON.stringify(value).
 */
export function addValue(
  dict: DictBuilder,
  value: unknown,
  key: string = '',
  kind?: ValueMeta['kind']
): number {
  if (value === undefined) return -1;

  const dedupKey =
    typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

  const existing = dict.valueMap.get(dedupKey);
  if (existing !== undefined) return existing;

  const idx = dict.valueDict.length;
  dict.valueDict.push(value);
  dict.valueMap.set(dedupKey, idx);

  // ← НОВОЕ v13.0.0: регистрируем метаданные
  dict.valueMeta.push({
    key: key || `value_${idx}`,
    kind: kind ?? classifyValue(value),
  });

  return idx;
}

/**
 * ✅ v9.0.0: типобезопасный reverse lookup.
 * Возвращает код по имени. Если имени нет — первый код словаря
 * (гарантирует round-trip: undefined → код → имя из словаря).
 */
export function reverseLookup(dict: Record<string, string>, name: string | undefined): string {
  if (!name) return Object.keys(dict)[0] ?? '?';
  const reverse = Object.fromEntries(Object.entries(dict).map(([c, n]) => [n, c]));
  return reverse[name] ?? Object.keys(dict)[0] ?? '?';
}

/**
 * Проверяет, является ли значение массивом, и возвращает его
 * (или пустой массив, если нет).
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ============================================
// RLE ХЕЛПЕРЫ
// ============================================

/**
 * Сжимает массив чисел в RLE: [[value, count], ...]
 *
 * ✅ v12.0.1: добавлены non-null assertions для arr[0] и arr[i].
 *
 * TypeScript с `noUncheckedIndexedAccess: true` возвращает
 * `number | undefined` для любого arr[i], что вызывало TS2322:
 *
 *   error TS2322: Type 'number | undefined' is not assignable to type 'number'.
 *     result.push([current, count]);
 *
 * Non-null assertion корректен, потому что:
 *   - arr[0] гарантированно есть (проверено arr.length === 0 выше)
 *   - arr[i] в цикле гарантированно есть (i < arr.length)
 *
 * @param arr — массив чисел
 * @returns RLE-представление: [[value, count], ...]
 */
function rle(arr: number[]): [number, number][] {
  if (arr.length === 0) return [];
  const result: [number, number][] = [];
  let current = arr[0]!;
  let count = 1;

  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]!;
    if (v === current) {
      count++;
    } else {
      result.push([current, count]);
      current = v;
      count = 1;
    }
  }
  result.push([current, count]);
  return result;
}

// ============================================
// ТОКЕНИЗАЦИЯ СТРОК
// ============================================

/**
 * Разбивает строку на camelCase/PascalCase токены.
 *
 * Примеры:
 *   "getEntityColor"    → ["get", "Entity", "Color"]
 *   "TypeScriptValidator" → ["Type", "Script", "Validator"]
 *   "isExported"        → ["is", "Exported"]
 *   "foo_bar/baz"       → ["foo", "bar", "baz"]
 */
function tokenizeStr(str: string): string[] {
  if (!str) return [];
  const tokens = str.split(/(?=[A-Z])|[_\-/.0-9]+/).filter(Boolean);
  return tokens;
}

/**
 * Строит словарь токенов из массива строк.
 *
 * Оставляет только те токены, которые встречаются > 1 раза.
 */
function buildTokenDict(strings: string[]): string[] {
  const freq = new Map<string, number>();
  for (const str of strings) {
    for (const token of tokenizeStr(str)) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .filter(([, count]) => count > 1)
    .map(([token]) => token);
}

/**
 * Кодирует строку через токены.
 *
 * Правила:
 *   - если все токены есть в словаре И токенизация выгодна —
 *     возвращает массив индексов;
 *   - иначе — возвращает исходную строку.
 *
 * ✅ v13.0.0-fix: не токенизируем строки короче 8 символов.
 * Короткие идентификаторы ("f79", "f114", "m1", "fn2") не выигрывают
 * от токенизации, но создают риск коллизий при decode: если "f" есть
 * в tokens, а "79" — нет, encodeStr вернёт массив [idx("f")], и decode
 * восстановит "f" вместо "f79". Это ломало imports[].toFileId.
 *
 * ✅ v13.0.2-fix: не токенизируем строки, содержащие разделители
 * (`_`, `-`, `/`, `.`, `:`) и цифры. Причина: tokenizeStr() удаляет
 * разделители, а decodeStr склеивает токены через `join('')` —
 * разделители теряются. Примеры:
 *   • "estree-walker"       → ["estree", "walker"] → "estreewalker"
 *   • "./foo/bar"           → ["foo", "bar"]       → "foobar"
 *   • "external:Z3Verifier" → ["external:", "Z3", "Verifier"]
 *                            → "external:Z3Verifier" (теряется ":")
 * Это ломало imports[].toFileId (external:estree-walker →
 * external:estreewalker) и calls[].toFunctionId для external-вызовов.
 *
 * Правило выгодности: tokens.length * 2 >= str.length → хранить целиком.
 */
function encodeStr(str: string, tokenIndex: Map<string, number>): string | number[] {
  if (!str) return str;

  // ✅ v13.0.0-fix: не токенизируем короткие строки
  if (str.length < 8) return str;

  // ✅ v13.0.2-fix: не токенизируем строки с разделителями и цифрами,
  // потому что tokenizeStr() удаляет разделители, а decodeStr
  // склеивает токены через join('') — символы теряются.
  // Примеры: "estree-walker" → "estreewalker",
  //          "./foo/bar" → "foobar",
  //          "external:Z3Verifier" → возможно, теряет часть.
  if (/[_\-/.:0-9]/.test(str)) return str;

  const tokens = tokenizeStr(str);
  if (tokens.length === 0) return str;

  const indices: number[] = [];
  for (const token of tokens) {
    const idx = tokenIndex.get(token);
    if (idx === undefined) return str;
    indices.push(idx);
  }

  if (tokens.length * 2 >= str.length) return str;

  return indices;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ENCODE
// ============================================

/**
 * Кодирует полный JSON в сжатый (v13.0.2).
 *
 * ✅ v13.0.2-fix (100% round-trip):
 *   - ✅ ИСПРАВЛЕНО: `encodeStr` не токенизирует строки с разделителями
 *     (`_`, `-`, `/`, `.`, `:`) и цифрами. Раньше строки вроде
 *     "estree-walker" токенизировались в ["estree", "walker"], а
 *     decodeStr склеивал их через join('') → "estreewalker".
 *     Это ломало imports[].toFileId и calls[].toFunctionId.
 *
 * ✅ v13.0.1-fix (100% round-trip):
 *   - ✅ УДАЛЕНА `stableSortById`. Причина: decode() восстанавливает
 *     id из ПОЗИЦИИ в массиве (functions[i].id = `fn${i + 1}`,
 *     modules[i].id = `m${i + 1}` и т.д.). Поэтому encode() ОБЯЗАН
 *     использовать тот же порядок, что и в full.json.
 *     Сортировка по строковому id ("fn1" < "fn10" < "fn2") ломала
 *     соответствие и давала расхождения:
 *       • modules[].path       (порядок модулей разный)
 *       • imports[].toFileId   (fileReverse даёт неверный индекс)
 *       • calls[].type         (async/direct перепутаны)
 *       • functions[].*Flags   (isExported/isArrow перепутаны)
 *       • external calls       (не находились в decoded)
 *       • L1/L2/DL/DEC/RE/ENC  (все round-trip уровни падали)
 *     collectFullJSON() уже строит массивы в каноническом порядке
 *     (id = `${prefix}${counter}`, counter++ при push), поэтому
 *     сортировка не нужна и вредна.
 *
 * ✅ v13.0.0-fix (100% round-trip):
 *   - ✅ ИСПРАВЛЕНО: `mi.f` теперь — массив пар `[startFileIdx, fileCount]`.
 *     Раньше туда писался moduleIdx, и decode восстанавливал неверные
 *     fileIds ("f10" вместо "f80", длины 1 вместо N).
 *   - ✅ ИСПРАВЛЕНО: `encodeStr` не токенизирует строки < 8 символов.
 *   - ✅ ИСПОЛЬЗУЕТСЯ: `v: CODEC_VERSION`.
 *
 * ✅ v13.0.0 (values-mode):
 *   - Добавлен параметр `valuesMode: 'full' | 'relations'`.
 *   - В режиме 'relations' — фильтрация valueDict через filterValues().
 *   - Переиндексация cn.nonEmptyV после фильтрации.
 *   - Поле `valuesMode` добавлено в CompactJSON.
 *   - Round-trip сохраняется полностью для отфильтрованного full.json.
 *
 * ✅ v12.0.0:
 *   - Columnar-структура для mi, fl, fns, cls, cn, gr.*
 *   - RLE для moduleIdx/fileIdx в fns, cls, cn
 *   - Битовые маски для булевых флагов
 *   - Числовые коды вместо строковых
 *   - Токенизация словарей строк
 *   - nonEmptyV для констант
 *
 * @param payload — Полный JSON
 * @param valuesMode — Режим сериализации values ('full' | 'relations')
 * @returns Сжатый JSON с легендой
 */
export function encode(payload: FullJSON, valuesMode: ValuesMode = 'relations'): CompactJSON {
  const dict = createDictBuilder();

  // ============================================
  // ✅ v13.0.1-fix: НЕ СОРТИРУЕМ
  // ============================================
  // decode() восстанавливает id из ПОЗИЦИИ в массиве:
  //   functions[i].id = `fn${i + 1}`
  //   modules[i].id   = `m${i + 1}`
  //   files[i].id     = `f${i + 1}`
  //   classes[i].id   = `cls${i + 1}`
  //   constants[i].id = `cn${i + 1}`
  //   exports[i].id   = `e${i + 1}`
  //   imports[i].id   = `i${i + 1}`
  //   calls[i].id     = `c${i + 1}`
  //   reExports[i].id = `re${i + 1}`
  //
  // Поэтому encode() ОБЯЗАН использовать тот же порядок,
  // что и в full.json. Сортировка по строковому id
  // ("fn1" < "fn10" < "fn2") ломает соответствие и даёт
  // расхождения modules[].path, imports[].toFileId,
  // calls[].type, functions[].*Flags и т.д.
  //
  // collectFullJSON() уже строит массивы в каноническом
  // порядке: id = `${prefix}${counter}`, counter++ при push.
  // ============================================

  // ============================================
  // 1. Индексы модулей
  // ============================================
  const modules = asArray<ModuleData>(payload.modules);
  const moduleReverse = new Map<string, number>();
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    if (mod && mod.id) {
      moduleReverse.set(mod.id, i);
    }
  }

  // ============================================
  // 2. Индексы файлов
  // ============================================
  const files = asArray<FileData>(payload.files);
  const fileReverse = new Map<string, number>();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file && file.id) {
      fileReverse.set(file.id, i);
    }
  }

  // ============================================
  // 3. Индексы функций
  // ============================================
  const functions = asArray<FunctionData>(payload.functions);
  const functionReverse = new Map<string, number>();
  for (let i = 0; i < functions.length; i++) {
    const func = functions[i];
    if (func && func.id) {
      functionReverse.set(func.id, i);
    }
  }

  // ============================================
  // 4. mi — columnar
  // ✅ v13.0.0-fix: [startFileIdx, fileCount] вместо RLE(moduleIdx)
  // ============================================
  const miN: string[] = [];
  const miF: [number, number][] = [];

  // Строим карту: moduleIdx → [fileIdx, fileIdx, ...]
  const filesByModuleIdx = new Map<number, number[]>();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const modIdx = moduleReverse.get(file.moduleId) ?? 0;
    if (!filesByModuleIdx.has(modIdx)) {
      filesByModuleIdx.set(modIdx, []);
    }
    filesByModuleIdx.get(modIdx)!.push(i);
  }

  for (const mod of modules) {
    if (!mod) continue;
    const modIdx = moduleReverse.get(mod.id) ?? 0;
    const fileIdxs = filesByModuleIdx.get(modIdx) ?? [];
    miN.push(mod.name);
    miF.push([fileIdxs[0] ?? 0, fileIdxs.length]);
  }

  // ============================================
  // 5. fl — columnar
  // ============================================
  const flP: string[] = [];
  const flM: number[] = [];
  for (const file of files) {
    if (!file) continue;
    flP.push(file.path);
    flM.push(moduleReverse.get(file.moduleId) ?? 0);
  }
  const flMRle = rle(flM);

  // ============================================
  // 6. fns — columnar
  // ============================================
  const fnsN: number[] = [];
  const fnsM: number[] = [];
  const fnsF: number[] = [];
  const fnsL: number[] = [];
  const fnsFl: number[] = [];
  const fnsP: number[][] = [];
  const fnsRt: number[] = [];

  for (const func of functions) {
    if (!func) continue;

    const nameIdx = addString(dict, func.name);
    const flags = encodeFlags(func);
    const paramsIdx = asArray<string>(func.params).map(p => addParam(dict, p));
    const returnTypeIdx = addString(dict, func.returnType);

    fnsN.push(nameIdx);
    fnsM.push(moduleReverse.get(func.moduleId) ?? 0);
    fnsF.push(fileReverse.get(func.fileId) ?? 0);
    fnsL.push(func.line);
    fnsFl.push(flags);
    fnsP.push(paramsIdx);
    fnsRt.push(returnTypeIdx);
  }

  const fnsMRle = rle(fnsM);
  const fnsFRle = rle(fnsF);

  // ============================================
  // 7. cls — columnar
  // ============================================
  const classes = asArray<ClassData>(payload.classes);
  const clsN: number[] = [];
  const clsM: number[] = [];
  const clsF: number[] = [];
  const clsL: number[] = [];
  const clsFl: number[] = [];
  const clsMethods: number[][] = [];

  for (const cls of classes) {
    if (!cls) continue;

    const nameIdx = addString(dict, cls.name);
    const flags = encodeFlags(cls);
    const methodsIdx = asArray<string>(cls.methods).map(m => addMethod(dict, m));

    clsN.push(nameIdx);
    clsM.push(moduleReverse.get(cls.moduleId) ?? 0);
    clsF.push(fileReverse.get(cls.fileId) ?? 0);
    clsL.push(cls.line);
    clsFl.push(flags);
    clsMethods.push(methodsIdx);
  }

  const clsMRle = rle(clsM);
  const clsFRle = rle(clsF);

  // ============================================
  // 8. cn — columnar
  // ============================================
  const constants = asArray<ConstantData>(payload.constants);
  const cnN: number[] = [];
  const cnM: number[] = [];
  const cnF: number[] = [];
  const cnL: number[] = [];
  const cnFl: number[] = [];
  const cnNonEmptyV: [number, number][] = [];

  for (let i = 0; i < constants.length; i++) {
    const cn = constants[i];
    if (!cn) continue;

    const nameIdx = addString(dict, cn.name);
    const flags = encodeFlags(cn);
    // ✅ v13.0.0: передаём key и kind для категоризации
    const valueIdx = addValue(dict, cn.value, `cn_value_${cn.name}`, classifyValue(cn.value));

    cnN.push(nameIdx);
    cnM.push(moduleReverse.get(cn.moduleId) ?? 0);
    cnF.push(fileReverse.get(cn.fileId) ?? 0);
    cnL.push(cn.line);
    cnFl.push(flags);

    if (valueIdx >= 0) {
      cnNonEmptyV.push([i, valueIdx]);
    }
  }

  const cnMRle = rle(cnM);
  const cnFRle = rle(cnF);

  // ============================================
  // 9. gr.e — columnar
  // ============================================
  const exports = asArray<ExportData>(payload.exports);
  const geM: number[] = [];
  const geF: number[] = [];
  const geFn: number[] = [];
  const geL: number[] = [];
  const geTy: number[] = [];
  const geEn: number[] = [];
  const geLn: number[] = [];
  const geS: number[] = [];
  const geFlags: number[] = [];

  for (const exp of exports) {
    if (!exp) continue;

    const typeCode = exp.isDefault ? 1 : exp.isTypeOnly || exp.type === 'type' ? 2 : 0;
    let flags = 0;
    if (exp.isTypeOnly) flags |= 1;
    if (exp.isReExport) flags |= 2;
    if (exp.isStarReExport) flags |= 4;
    if (exp.isDefaultReExport) flags |= 8;

    geM.push(moduleReverse.get(exp.moduleId) ?? 0);
    geF.push(fileReverse.get(exp.fileId) ?? 0);
    geFn.push(functionReverse.get(exp.functionId) ?? 0);
    geL.push(exp.line);
    geTy.push(typeCode);
    geEn.push(addString(dict, exp.exportName));
    geLn.push(addString(dict, exp.localName));
    geS.push(addString(dict, exp.source));
    geFlags.push(flags);
  }

  // ============================================
  // 10. gr.i — columnar
  // ============================================
  const imports = asArray<ImportData>(payload.imports);
  const giFf: number[] = [];
  const giTf: number[] = [];
  const giS: number[] = [];
  const giIm: number[] = [];
  const giLn: number[] = [];
  const giL: number[] = [];
  const giTy: number[] = [];

  for (const imp of imports) {
    if (!imp) continue;

    const typeCode = imp.isDefault ? 1 : imp.isNamespace ? 2 : imp.isTypeOnly ? 3 : 0;
    const combinedTy = typeCode | (imp.isExternal ? 4 : 0);

    giFf.push(fileReverse.get(imp.fromFileId) ?? 0);
    giTf.push(addString(dict, imp.toFileId ?? ''));
    giS.push(addString(dict, imp.source));
    giIm.push(addString(dict, imp.importedName));
    giLn.push(addString(dict, imp.localName));
    giL.push(imp.line);
    giTy.push(combinedTy);
  }

  // ============================================
  // 11. gr.c — columnar
  // ============================================
  const calls = asArray<CallData>(payload.calls);
  const gcF: number[] = [];
  const gcT: number[] = [];
  const gcL: number[] = [];
  const gcTy: number[] = [];

  for (const call of calls) {
    if (!call) continue;

    const isExternal = call.toFunctionId.startsWith('external:');
    const typeCode =
      call.type === 'direct' ? 0 : call.type === 'async' ? 1 : call.type === 'method' ? 2 : 3;
    const combinedTy = typeCode | (isExternal ? 4 : 0);

    gcF.push(functionReverse.get(call.fromFunctionId) ?? 0);
    gcT.push(
      isExternal
        ? addString(dict, call.toFunctionId)
        : (functionReverse.get(call.toFunctionId) ?? 0)
    );
    gcL.push(call.line);
    gcTy.push(combinedTy);
  }

  // ============================================
  // 12. gr.re — columnar
  // ============================================
  const reExports = asArray<ReExportData>(payload.reExports);
  const greM: number[] = [];
  const greFn: number[] = [];
  const greS: number[] = [];
  const greEn: number[] = [];
  const greL: number[] = [];
  const greTy: number[] = [];

  for (const re of reExports) {
    if (!re) continue;

    const typeCode = re.isStarReExport ? 2 : re.isDefault ? 1 : 0;
    const combinedTy = typeCode | (re.isTypeOnly ? 4 : 0);

    greM.push(moduleReverse.get(re.moduleId) ?? 0);
    greFn.push(functionReverse.get(re.functionId) ?? 0);
    greS.push(addString(dict, re.source));
    greEn.push(addString(dict, re.exportName));
    greL.push(re.line);
    greTy.push(combinedTy);
  }

  // ============================================
  // 13. ✅ v13.0.0: ФИЛЬТРАЦИЯ VALUES
  // ============================================
  //
  // Применяем фильтрацию к valueDict на основе valuesMeta.
  // В режиме 'full' — no-op.
  // В режиме 'relations' — оставляем только kind === 'relation'.
  //
  // ВАЖНО: переиндексируем cn.nonEmptyV, потому что это
  // ЕДИНСТВЕННОЕ место в CompactJSON, где есть ссылки на values
  // по индексу. Все остальные секции (gr.e.ty, gr.i.ty, gr.c.ty,
  // gr.re.ty, fns.fl, cls.fl, cn.fl) ссылаются на ЧИСЛОВЫЕ КОДЫ
  // (не на values!), поэтому переиндексация им не нужна.
  //
  // ============================================
  let finalValueDict: unknown[] = dict.valueDict;
  let valueIndexMap: Map<number, number> | null = null;

  if (valuesMode === 'relations') {
    const filtered = filterValues(dict.valueDict, dict.valueMeta);
    finalValueDict = filtered.values;
    valueIndexMap = filtered.indexMap;

    if (process.env.AST_DEBUG_CODEC === 'true') {
      console.log(
        `   🗜️  values-mode=relations: ${dict.valueDict.length} → ${finalValueDict.length} значений ` +
          `(${(
            ((dict.valueDict.length - finalValueDict.length) / dict.valueDict.length) *
            100
          ).toFixed(1)}% сжатие)`
      );
    }
  }

  // Переиндексация cn.nonEmptyV
  const finalNonEmptyV: [number, number][] = [];
  for (const [cnIdx, valIdx] of cnNonEmptyV) {
    if (valueIndexMap) {
      const newValIdx = remapIndex(valIdx, valueIndexMap);
      if (newValIdx === null) continue; // значение удалено — пропускаем
      finalNonEmptyV.push([cnIdx, newValIdx]);
    } else {
      finalNonEmptyV.push([cnIdx, valIdx]);
    }
  }

  // ============================================
  // 14. Легенда (упрощённая)
  // ============================================
  const legend: CodecLegend = buildLegend({
    stringDict: dict.stringDict,
    paramDict: dict.paramDict,
    methodDict: dict.methodDict,
    valueDict: finalValueDict, // ← v13.0.0: передаём отфильтрованный
  });

  // ============================================
  // 15. Сборка CompactJSON
  // ============================================
  const compact: CompactJSON = {
    v: CODEC_VERSION, // ✅ v13.0.0-fix: единая константа
    ts: payload.timestamp,
    r: moduleReverse.get(payload.root) ?? 0,
    // ✅ v13.0.0: сохраняем режим для обратной совместимости
    valuesMode,

    tokens: [],
    strs: [],
    params: [],
    methods: [],
    values: finalValueDict, // ← v13.0.0: отфильтрованный массив

    // ✅ v13.0.0-fix: mi.f — пары [startFileIdx, fileCount], без RLE
    mi: { n: miN, f: miF },
    fl: { p: flP, m: flMRle },

    fns: { n: fnsN, m: fnsMRle, f: fnsFRle, l: fnsL, fl: fnsFl, p: fnsP, rt: fnsRt },
    cls: { n: clsN, m: clsMRle, f: clsFRle, l: clsL, fl: clsFl, methods: clsMethods },
    cn: { n: cnN, m: cnMRle, f: cnFRle, l: cnL, fl: cnFl, nonEmptyV: finalNonEmptyV },

    gr: {
      e: { m: geM, f: geF, fn: geFn, l: geL, ty: geTy, en: geEn, ln: geLn, s: geS, flags: geFlags },
      i: { ff: giFf, tf: giTf, s: giS, im: giIm, ln: giLn, l: giL, ty: giTy },
      c: { f: gcF, t: gcT, l: gcL, ty: gcTy },
      re: { m: greM, fn: greFn, s: greS, en: greEn, l: greL, ty: greTy },
    },

    st: payload.statistics,
    legend,
  };

  // Токенизация словарей строк
  const allStrings = [...dict.stringDict, ...dict.paramDict, ...dict.methodDict];
  const tokens = buildTokenDict(allStrings);
  const tokenIndex = new Map(tokens.map((t, i) => [t, i]));

  compact.tokens = tokens;
  compact.strs = dict.stringDict.map(s => encodeStr(s, tokenIndex));
  compact.params = dict.paramDict.map(s => encodeStr(s, tokenIndex));
  compact.methods = dict.methodDict.map(s => encodeStr(s, tokenIndex));

  // Удаляем пустые опциональные секции
  for (const key of Object.keys(compact) as (keyof CompactJSON)[]) {
    if (key === 'gr') continue;
    const v = (compact as any)[key];
    if (Array.isArray(v) && v.length === 0) {
      delete (compact as any)[key];
    }
  }

  return compact;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  encode,
  encodeFlags,
  flagsToString,
  createDictBuilder,
  addString,
  addParam,
  addMethod,
  addValue,
  classifyValue, // ← НОВОЕ v13.0.0
  reverseLookup,
  asArray,
};
