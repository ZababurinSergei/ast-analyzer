// src/reporters/codec/codec-encode.ts
// ============================================
// КОДИРОВАНИЕ: FullJSON → CompactJSON
// ============================================
// Версия: 15.0.6
//
// ИЗМЕНЕНИЯ v15.0.6 (gr.i.tf — индекс в fl.p):
//   - ✅ ИЗМЕНЕНО: `gr.i.tf` теперь содержит ИНДЕКС В `fl.p` (файлы),
//     а не индекс в `strs` (source-строка).
//   - ✅ -1 = внешний/неразрешённый импорт.
//   - ✅ `gr.i.s` (source) — БЕЗ ИЗМЕНЕНИЙ.
//   - ✅ ДОБАВЛЕНА диагностика согласованности ff/tf в debug-режиме.
//
// ИЗМЕНЕНИЯ v15.0.5 (проброс isReExport/isStarReExport через gr.i.ty):
//   - ✅ ДОБАВЛЕНО: биты 4 и 5 в combinedTy для gr.i:
//       бит 4 (16) = isReExport
//       бит 5 (32) = isStarReExport
//     Это позволяет различать обычные импорты и реэкспорты
//     (`export { X } from './foo'`, `export * from './foo'`)
//     в сжатом JSON. Необходимо для построения полных цепочек
//     связей файлов на фронте.
//
// ИЗМЕНЕНИЯ v15.0.3 (fix round-trip Vue conditionals):
//   - ✅ ИСПРАВЛЕНО: `addAny()` теперь делает `structuredClone(value)`
//     перед push в `valueDict`.
//
// ИЗМЕНЕНИЯ v15.0.2 (устранение дублирования conditionals):
//   - ✅ УБРАН fallback на `canonical.conditionals`.
//
// ИЗМЕНЕНИЯ v15.0.1 (fix дедупликации extended-секций):
//   - ✅ ИСПРАВЛЕНО: `addAny()` больше НЕ дедуплицирует объекты.
//
// ИЗМЕНЕНИЯ v15.0.0 (полный round-trip расширенных секций):
//   - ✅ ДОБАВЛЕНО: кодирование секций vt/lc/ef/inj/rx/cd/ty/tr.
//
// ИЗМЕНЕНИЯ v14.0.0 (байтовое равенство):
//   - ✅ ДОБАВЛЕНО: canonicalizeFullJSON(payload) в начале encode.
//
// ИЗМЕНЕНИЯ v13.0.2-fix:
//   - ✅ encodeStr не токенизирует строки с разделителями и цифрами.
//
// ИЗМЕНЕНИЯ v13.0.1-fix:
//   - ✅ УДАЛЕНА функция stableSortById из encode().
//
// ИЗМЕНЕНИЯ v13.0.0 (values-mode):
//   - ✅ ДОБАВЛЕНО: valuesMode: 'full' | 'relations'.
//   - ✅ ДОБАВЛЕНО: filterValues/remapIndex из values-filter.js.
//
// ИЗМЕНЕНИЯ v12.0.0 (columnar):
//   - ✅ Columnar-структура, RLE, битовые маски, токенизация.
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
  TemplateData,
  TemplateConditional,
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TypeNodeData,
  TypeRefData,
} from './codec-types.js';

import { buildLegend } from './codec-legend.js';

// ✅ Единая версия
import { CODEC_VERSION } from './codec-types.js';

// ✅ v13.0.0: фильтрация values
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
 */
export const FLAG_CHAR_MAP: Record<string, number> = Object.fromEntries(
    Object.entries(FLAG_MAP).map(([bit, name]) => [name, parseInt(bit, 10)])
);

/**
 * Имена флагов: бит → имя.
 */
export const FLAG_NAMES: Record<number, string> = Object.fromEntries(
    Object.entries(FLAG_MAP).map(([bit, name]) => [parseInt(bit, 10), name])
);

/**
 * Типы связей.
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
 */
export const IMPORT_TYPES: Record<string, string> = {
  n: 'named',
  df: 'default',
  ns: 'namespace',
  to: 'type',
};

/**
 * Типы вызовов.
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
 * ⚠️ Не используется в `encode()` для fns/cls/cn (там пишется число).
 * Оставлено для отладки и обратной совместимости публичного API.
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

interface DictBuilder {
  stringDict: string[];
  stringMap: Map<string, number>;
  paramDict: string[];
  paramMap: Map<string, number>;
  methodDict: string[];
  methodMap: Map<string, number>;
  valueDict: unknown[];
  valueMap: Map<string, number>;
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
    return 'relation';
  }

  // Объекты: большие → config, маленькие → relation
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      if (json.length > 500) return 'config';
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
 * ⚠️ Дедуплицирует по `JSON.stringify`. Используется для `cn.nonEmptyV`
 * (значения констант), где дедупликация безопасна и полезна.
 *
 * @see addAny() — для extended-секций, где дедупликация ЗАПРЕЩЕНА.
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

  dict.valueMeta.push({
    key: key || `value_${idx}`,
    kind: kind ?? classifyValue(value),
  });

  return idx;
}

// ============================================
// addAny — БЕЗ ДЕДУПЛИКАЦИИ + structuredClone (v15.0.3)
// ============================================
//
// Extended-секции (vt/lc/ef/inj/rx/cd/ty/tr) — это СТРУКТУРНЫЕ
// СУЩНОСТИ. Каждая запись — отдельная сущность. Их НЕЛЬЗЯ
// дедуплицировать, даже если они структурно совпадают.
//
// Поэтому `addAny` ВСЕГДА создаёт новый value.
//
// ✅ v15.0.3: `addAny` теперь делает `structuredClone(value)`.
// Это разрывает общую ссылку между `templates[].conditionals`
// и `values[]`, из-за которой `safeJsonStringify` заменял второй
// экземпляр на "[Circular]".
// ============================================

/**
 * Добавить произвольный объект/массив/примитив в valueDict.
 *
 * Отличия от addValue():
 *   - НЕ дедуплицирует. Каждый вызов = новый value с новым индексом.
 *   - НЕ применяет фильтрацию values (kind = 'relation').
 *   - ✅ v15.0.3: делает `structuredClone(value)` перед push,
 *     чтобы разорвать общую ссылку с объектами в `templates[]`
 *     (или в других extended-секциях).
 *   - Используется ТОЛЬКО для extended-секций (vt/lc/ef/inj/rx/cd/ty/tr).
 *
 * @param dict  — словарь
 * @param value — произвольное значение (объект/массив/примитив)
 * @param key   — строковый ключ для отладки (например, `vt[0]`, `cd[3]`)
 * @returns индекс в valueDict
 */
function addAny(dict: DictBuilder, value: unknown, key: string): number {
  if (value === undefined) return -1;

  const idx = dict.valueDict.length;

  // ✅ v15.0.3 (fix round-trip Vue conditionals):
  // Расширенные секции (vt/lc/ef/inj/rx/cd/ty/tr) кладутся в values[]
  // через addAny. Объекты этих секций МОГУТ совпадать по ссылке
  // с объектами в templates[].conditionals (cd). Если положить
  // ссылку как есть, safeJsonStringify при записи full.json
  // увидит первый экземпляр (в templates[]), запишет его,
  // а второй (в values[]) заменит на "[Circular]".
  //
  // Это ломает encode(full) === compact (L0/L3/RE):
  //   compact.values[418] = "[Circular]"
  //   encode(full).values[418] = {id: "cd1", directive: "v-else-if", ...}
  //
  // Фикс: structuredClone разрывает общую ссылку, сохраняя
  // ВСЕ данные, включая undefined-поля (важно для v-else,
  // у которых conditionExpression === undefined).
  //
  // ⚠️ НЕ использовать JSON.parse(JSON.stringify(...)) —
  // он удаляет undefined-поля, что даст расхождение
  // decoded vs full по ключу conditionExpression.
  //
  // ⚠️ addAny применяется ТОЛЬКО к extended-секциям.
  // Для TS/JS-файлов эти секции пусты, поэтому structuredClone
  // там не вызывается. Для Vue-файлов все объекты extended-секций
  // — это простые POJO (string, number, boolean, массивы строк,
  // вложенные POJO), которые structuredClone обрабатывает идеально.
  // Функций, Date, Map, Set, BigInt, Symbol в них нет.
  const stored: unknown =
      value !== null && typeof value === 'object' ? structuredClone(value) : value;

  dict.valueDict.push(stored);

  dict.valueMeta.push({
    key: key || `value_${idx}`,
    kind: 'relation',
  });

  return idx;
}

/**
 * Типобезопасный reverse lookup.
 */
export function reverseLookup(dict: Record<string, string>, name: string | undefined): string {
  if (!name) return Object.keys(dict)[0] ?? '?';
  const reverse = Object.fromEntries(Object.entries(dict).map(([c, n]) => [n, c]));
  return reverse[name] ?? Object.keys(dict)[0] ?? '?';
}

/**
 * Проверяет, является ли значение массивом, и возвращает его.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ============================================
// RLE ХЕЛПЕРЫ
// ============================================

/**
 * Сжимает массив чисел в RLE: [[value, count], ...]
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
 */
function tokenizeStr(str: string): string[] {
  if (!str) return [];
  const tokens = str.split(/(?=[A-Z])|[_\-/.0-9]+/).filter(Boolean);
  return tokens;
}

/**
 * Строит словарь токенов из массива строк.
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
 */
function encodeStr(str: string, tokenIndex: Map<string, number>): string | number[] {
  if (!str) return str;

  // ✅ v13.0.0-fix: не токенизируем короткие строки
  if (str.length < 8) return str;

  // ✅ v13.0.2-fix: не токенизируем строки с разделителями и цифрами
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
// КАНОНИЗАЦИЯ FULLJSON (v14.0.0)
// ============================================

/**
 * Извлекает числовой суффикс из `id` (`fn123` → 123).
 * Не-числовой суффикс → `Infinity` (уходит в конец).
 */
function extractNumericId(id: string | undefined): number {
  if (!id) return Infinity;
  const match = id.match(/(\d+)$/);
  if (!match) return Infinity;
  const numStr = match[1];
  if (!numStr) return Infinity;
  return parseInt(numStr, 10);
}

/**
 * Сортирует массив по числовому `id`. Не мутирует исходный массив.
 */
function sortByIdNumeric<T extends { id?: string }>(arr: T[] | undefined): T[] {
  if (!arr) return [];
  return [...arr].sort((a, b) => {
    const na = extractNumericId(a.id);
    const nb = extractNumericId(b.id);
    if (na !== nb) return na - nb;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

/**
 * Канонизирует `FullJSON`:
 *   - сортирует modules/files/functions/classes/constants/
 *     exports/imports/calls/reExports по числовому `id`
 *   - не трогает `id` внутри элементов
 *   - не трогает вложенные массивы
 */
function canonicalizeFullJSON(payload: FullJSON): FullJSON {
  return {
    ...payload,
    modules: sortByIdNumeric(payload.modules),
    files: sortByIdNumeric(payload.files),
    functions: sortByIdNumeric(payload.functions),
    classes: sortByIdNumeric(payload.classes),
    constants: sortByIdNumeric(payload.constants),
    exports: sortByIdNumeric(payload.exports),
    imports: sortByIdNumeric(payload.imports),
    calls: sortByIdNumeric(payload.calls),
    reExports: sortByIdNumeric(payload.reExports),
  };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ENCODE
// ============================================

/**
 * Кодирует полный JSON в сжатый (v15.0.6).
 *
 * ✅ v15.0.6 (gr.i.tf — индекс в fl.p):
 *   - `gr.i.tf[i]` теперь содержит ИНДЕКС В `fl.p` (файлы),
 *     а не индекс в `strs` (source-строка).
 *   - `-1` = внешний/неразрешённый импорт.
 *   - `gr.i.s` (source) — БЕЗ ИЗМЕНЕНИЙ.
 *
 * ✅ v15.0.5 (проброс isReExport/isStarReExport):
 *   - В `gr.i.ty` (combinedTy) биты 4 и 5:
 *       бит 4 (16) = isReExport
 *       бит 5 (32) = isStarReExport
 *
 * ✅ v15.0.3 (fix round-trip Vue conditionals):
 *   - `addAny()` делает `structuredClone(value)` перед push.
 *
 * ✅ v15.0.2 (устранение дублирования conditionals):
 *   - `cd` собирается ТОЛЬКО из `templates[].conditionals`.
 *
 * ✅ v15.0.1 (fix дедупликации extended-секций):
 *   - `addAny` больше НЕ дедуплицирует объекты extended-секций.
 *
 * ✅ v15.0.0 (расширенные секции):
 *   - Добавлено кодирование vt/lc/ef/inj/rx/cd/ty/tr.
 *   - isTypeOnly вынесен в отдельный бит 8.
 *
 * ✅ v14.0.0 (байтовое равенство):
 *   - Канонизация входа через `canonicalizeFullJSON`.
 *
 * @param payload    — Полный JSON
 * @param valuesMode — Режим сериализации values ('full' | 'relations')
 * @returns Сжатый JSON с легендой
 */
export function encode(payload: FullJSON, valuesMode: ValuesMode = 'relations'): CompactJSON {
  const dict = createDictBuilder();

  // ============================================
  // v14.0.0: КАНОНИЗАЦИЯ ВХОДА
  // ============================================
  const canonical = canonicalizeFullJSON(payload);

  // ============================================
  // 1. Индексы модулей
  // ============================================
  const modules = asArray<ModuleData>(canonical.modules);
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
  const files = asArray<FileData>(canonical.files);
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
  const functions = asArray<FunctionData>(canonical.functions);
  const functionReverse = new Map<string, number>();
  for (let i = 0; i < functions.length; i++) {
    const func = functions[i];
    if (func && func.id) {
      functionReverse.set(func.id, i);
    }
  }

  // ============================================
  // 4. mi — columnar
  // ============================================
  const miN: string[] = [];
  const miF: [number, number][] = [];

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
  const classes = asArray<ClassData>(canonical.classes);
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
  const constants = asArray<ConstantData>(canonical.constants);
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
  const exports = asArray<ExportData>(canonical.exports);
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
  // ✅ v15.0.5: биты combinedTy:
  //   0-1 : typeCode (0=named, 1=default, 2=namespace)
  //   2   : isExternal        (4)
  //   3   : isTypeOnly        (8)
  //   4   : isReExport        (16)
  //   5   : isStarReExport    (32)
  //
  // ✅ v15.0.6: `tf` — ИНДЕКС В `fl.p` (файлы), а не в `strs`.
  //   -1 = внешний/неразрешённый импорт.
  //   `s` — ПО-ПРЕЖНЕМУ индекс в `strs` (source-строка).
  // ============================================
  const imports = asArray<ImportData>(canonical.imports);
  const giFf: number[] = [];
  const giTf: number[] = [];
  const giS: number[] = [];
  const giIm: number[] = [];
  const giLn: number[] = [];
  const giL: number[] = [];
  const giTy: number[] = [];

  for (const imp of imports) {
    if (!imp) continue;

    const typeCode = imp.isDefault ? 1 : imp.isNamespace ? 2 : 0;

    // ✅ v15.0.5: собираем combinedTy со всеми битами
    const combinedTy =
        typeCode |
        (imp.isExternal ? 4 : 0) |
        (imp.isTypeOnly ? 8 : 0) |
        (imp.isReExport ? 16 : 0) |
        (imp.isStarReExport ? 32 : 0);

    // ✅ v15.0.6: tf — индекс в fl.p (файлы), -1 = внешний/неразрешённый
    const toFileIdx = imp.toFileId ? (fileReverse.get(imp.toFileId) ?? -1) : -1;

    giFf.push(fileReverse.get(imp.fromFileId) ?? 0);
    giTf.push(toFileIdx);
    giS.push(addString(dict, imp.source));
    giIm.push(addString(dict, imp.importedName));
    giLn.push(addString(dict, imp.localName));
    giL.push(imp.line);
    giTy.push(combinedTy);
  }

  // ✅ v15.0.6: диагностика согласованности ff/tf в debug-режиме
  if (process.env.AST_DEBUG_CODEC === 'true') {
    for (let i = 0; i < giFf.length; i++) {
      const ff = giFf[i]!;
      const tf = giTf[i]!;
      if (tf !== -1 && ff === tf) {
        console.warn(
            `⚠️ gr.i[${i}]: ff === tf (${ff}) — файл импортирует сам себя`
        );
      }
    }
  }

  // ============================================
  // 11. gr.c — columnar
  // ============================================
  const calls = asArray<CallData>(canonical.calls);
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
  const reExports = asArray<ReExportData>(canonical.reExports);
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
  // 12.5. Кодирование расширенных секций
  //       vt/lc/ef/inj/rx/cd/ty/tr
  // ============================================
  // Каждая секция сериализуется как объект
  // и складывается в valueDict через `addAny` (БЕЗ дедупликации).
  // В CompactJSON хранится только массив индексов в values.
  //
  // ✅ v15.0.3: addAny делает structuredClone(value), разрывая
  //   общую ссылку между templates[].conditionals и values[].
  // ============================================
  function encodeExtendedSection<T>(items: T[] | undefined, prefix: string): number[] {
    if (!items || items.length === 0) return [];
    const result: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === undefined || item === null) continue;
      const idx = addAny(dict, item, `${prefix}[${i}]`);
      if (idx >= 0) result.push(idx);
    }
    return result;
  }

  // vt — Vue templates
  const vt = encodeExtendedSection<TemplateData>(canonical.templates, 'vt');

  // lc — lifecycle
  const lc = encodeExtendedSection<LifecycleHook>(canonical.lifecycle, 'lc');

  // ef — effects
  const ef = encodeExtendedSection<EffectEdge>(canonical.effects, 'ef');

  // inj — injections
  const inj = encodeExtendedSection<InjectionEdge>(canonical.injections, 'inj');

  // rx — reactivity
  const rx = encodeExtendedSection<ReactivityEdge>(canonical.reactivity, 'rx');

  // ============================================
  // ✅ v15.0.2: cd — conditionals
  // ============================================
  // conditionals живут ТОЛЬКО в `templates[].conditionals`.
  // На верхнем уровне FullJSON их больше нет.
  //
  // ✅ v15.0.3: addAny делает structuredClone каждого элемента,
  //   поэтому values[] получает СВОЮ копию, а не ссылку на
  //   объект из templates[]. Это устраняет "[Circular]" в
  //   index.json на диске.
  // ============================================
  const allConditionals: TemplateConditional[] = [];
  for (const template of canonical.templates ?? []) {
    for (const cd of template.conditionals ?? []) {
      allConditionals.push(cd);
    }
  }
  const cd = encodeExtendedSection<TemplateConditional>(allConditionals, 'cd');

  // ty — types
  const ty = encodeExtendedSection<TypeNodeData>(canonical.types, 'ty');

  // tr — typeRefs
  const tr = encodeExtendedSection<TypeRefData>(canonical.typeRefs, 'tr');

  // ============================================
  // 13. ФИЛЬТРАЦИЯ VALUES
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

  // ============================================
  // Переиндексация ссылок в расширенных секциях
  // ============================================
  function remapIndices(indices: number[]): number[] {
    if (!valueIndexMap) return indices;
    const result: number[] = [];
    for (const oldIdx of indices) {
      const newIdx = remapIndex(oldIdx, valueIndexMap);
      if (newIdx !== null) result.push(newIdx);
    }
    return result;
  }

  const finalVt = remapIndices(vt);
  const finalLc = remapIndices(lc);
  const finalEf = remapIndices(ef);
  const finalInj = remapIndices(inj);
  const finalRx = remapIndices(rx);
  const finalCd = remapIndices(cd);
  const finalTy = remapIndices(ty);
  const finalTr = remapIndices(tr);

  // Переиндексация cn.nonEmptyV
  const finalNonEmptyV: [number, number][] = [];
  for (const [cnIdx, valIdx] of cnNonEmptyV) {
    if (valueIndexMap) {
      const newValIdx = remapIndex(valIdx, valueIndexMap);
      if (newValIdx === null) continue;
      finalNonEmptyV.push([cnIdx, newValIdx]);
    } else {
      finalNonEmptyV.push([cnIdx, valIdx]);
    }
  }

  // ============================================
  // 14. Легенда
  // ============================================
  const legend: CodecLegend = buildLegend({
    stringDict: dict.stringDict,
    paramDict: dict.paramDict,
    methodDict: dict.methodDict,
    valueDict: finalValueDict,
  });

  // ============================================
  // 15. Сборка CompactJSON
  // ============================================
  const compact: CompactJSON = {
    v: CODEC_VERSION,
    ts: canonical.timestamp,
    r: moduleReverse.get(canonical.root) ?? 0,
    valuesMode,

    tokens: [],
    strs: [],
    params: [],
    methods: [],
    values: finalValueDict,

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

    // Расширенные секции
    vt: finalVt,
    lc: finalLc,
    ef: finalEf,
    inj: finalInj,
    rx: finalRx,
    cd: finalCd,
    ty: finalTy,
    tr: finalTr,

    st: canonical.statistics,
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

  // ============================================
  // Удаляем пустые опциональные секции
  // ============================================
  const OPTIONAL_SECTIONS: (keyof CompactJSON)[] = [
    'vt',
    'lc',
    'ef',
    'inj',
    'rx',
    'cd',
    'ty',
    'tr',
  ];

  for (const key of OPTIONAL_SECTIONS) {
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
  classifyValue,
  reverseLookup,
  asArray,
};
