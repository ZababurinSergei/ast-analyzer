// src/reporters/codec/codec-decode.ts
// ============================================
// ДЕКОДИРОВАНИЕ: CompactJSON → FullJSON (v15.0.2)
// ============================================
// Версия: 15.0.2
//
// ИЗМЕНЕНИЯ v15.0.2 (устранение дублирования conditionals):
//   - ✅ УБРАНО: чтение `compact.cd` через decodeSection.
//     Причина: conditionals теперь живут ТОЛЬКО в
//     `templates[].conditionals` — они восстанавливаются
//     как часть TemplateData через `decodeSection<TemplateData>(compact.vt)`.
//   - ✅ УБРАНО: поле `conditionals` из финального `FullJSON`.
//     Верхнеуровневого conditionals больше нет.
//   - ✅ УБРАНЫ упоминания @deprecated из комментариев —
//     только новый код.
//
// ИЗМЕНЕНИЯ v15.0.1 (fix imports[].type):
//   - ✅ ИСПРАВЛЕНО: восстановление `imports[].type` больше НЕ
//     использует эвристику `isTypeOnly → type = 'type'`.
//     Поле `type` теперь ВСЕГДА принимает только
//     'named' | 'default' | 'namespace'.
//   - ✅ УТОЧНЕНО: `imports[].isTypeOnly` читается из бита 8.
//
// ИЗМЕНЕНИЯ v15.0.0 (100% round-trip расширенных секций):
//   - ✅ ИСПРАВЛЕНО: decodeSection читает и объект, и строку.
//   - ✅ СОХРАНЕНО: imports[].isTypeOnly из бита 8 combinedTy.
//   - ✅ СОХРАНЕНО: восстановление vt/lc/ef/inj/rx/ty/tr.
//
// ИЗМЕНЕНИЯ v14.0.0 (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: imports[].isTypeOnly читается из бита 8.
//   - ✅ ИСПРАВЛЕНО: восстановление секций vt/lc/ef/inj/rx/cd/ty/tr.
//   - ✅ ИСПРАВЛЕНО: `version` = CODEC_VERSION ('15.0.0').
//
// ИЗМЕНЕНИЯ v13.0.2-fix (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: `modules[].fileIds` строятся через `fl.m`.
//
// ИЗМЕНЕНИЯ v13.0.0-fix (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: `mi.f` читается как пары `[startFileIdx, fileCount]`.
//   - ✅ ИСПРАВЛЕНО: `version` берётся из CODEC_VERSION.
//
// ИЗМЕНЕНИЯ v12.0.0 (структурная оптимизация):
//   - ✅ Columnar-структура для всех секций.
//   - ✅ Распаковка RLE для moduleIdx/fileIdx.
//   - ✅ Распаковка битовых масок.
//   - ✅ Числовые коды → строковые.
//   - ✅ Восстановление ID (m1, f1, fn1) из позиций.
//   - ✅ Детокенизация строк (strs, params, methods).
//   - ✅ nonEmptyV для констант.
//
// ИЗМЕНЕНИЯ v11.0.0 (компактнее):
//   - fns/cls/cn: nameIdx → name, flagsNum → flags.
//
// ИЗМЕНЕНИЯ v10.4.0 (единая легенда):
//   - resolveDictionaries() поддерживает оба формата.
//
// ИЗМЕНЕНИЯ v10.3 (v10.3 sync — full round-trip):
//   - imports[].type для type-only импортов: 'type' (не 'type-only').
//
// ИЗМЕНЕНИЯ v9.0.7 (round-trip fix):
//   - readMethod: idx < 0 → null (а не '').
//   - templates[].conditionals: при отсутствии данных → [].
//
// ИЗМЕНЕНИЯ v9.0.4 (includeEdges default false):
//   - decode, options.includeEdges по умолчанию false.
//
// ИЗМЕНЕНИЯ v9.0.3 (gr.c fix):
//   - decode, секция calls: ветвление по isExternal.
//
// ИЗМЕНЕНИЯ v9.0.2 (reversibility):
//   - decodeFlagsToObject: возвращает все 18 флагов.
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
} from './codec-types.js';

// ✅ v13.0.0-fix: единая версия CODEC
import { CODEC_VERSION } from './codec-types.js';

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
 * ✅ v11.0.0: декодирует ЧИСЛО флагов в объект с булевыми полями.
 *
 * Используется в decode() вместо `decodeFlagsToObject` (который
 * принимает строку). Формат флагов в compact.json v11.0.0+ —
 * число (битовая маска), а не строка.
 *
 * Примеры:
 *   0   → все флаги false
 *   2   → isExported=true
 *   7   → isAsync=true, isExported=true, isMethod=true
 *   67  → isAsync=true, isExported=true, isSelf=true
 *
 * @param num — число флагов (битовая маска)
 * @returns объект со всеми 18 флагами
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
 *   вызовами. В основном потоке v11.0.0+ используется
 *   `decodeFlagsFromNumber(num)` — флаги в compact.json хранятся
 *   как число.
 *
 * ✅ ИСПРАВЛЕНО (reversibility):
 *   Возвращает все 18 флагов.
 *
 * Символы соответствуют FLAG_CHAR_MAP из codec-encode.ts:
 *   a=1, e=2, m=4, r=8, v=16, n=32, s=64, d=128, c=256, x=512,
 *   t=1024, A=2048, l=4096, y=8192, g=16384, p=32768, P=65536, S=131072
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
 * ⚠️ v11.0.0: сохранено для обратной совместимости с внутренними
 *   вызовами (например, в тестах).
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
 *
 * Используется для восстановления vt/lc/ef/inj/rx/ty/tr, которые
 * были сериализованы в JSON-строку в `encode()`.
 *
 * Возвращает `null`, если значение не строка или JSON.parse упал.
 * Это безопасно, так как decode не гарантирует присутствие всех ключей.
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
// ОСНОВНАЯ ФУНКЦИЯ DECODE
// ============================================

/**
 * Декодирует сжатый JSON обратно в полный.
 *
 * ✅ v15.0.2 (устранение дублирования conditionals):
 *   - `conditionals` больше НЕ восстанавливаются на верхнем уровне.
 *     Все conditionals живут ВНУТРИ `templates[].conditionals`
 *     (они декодируются как часть `TemplateData` из `compact.vt`).
 *   - Секция `compact.cd` в compact.json по-прежнему существует
 *     (генерируется из `templates[].conditionals` при encode),
 *     но decode её НЕ читает напрямую — только через templates[].
 *
 * ✅ v15.0.1 (fix imports[].type):
 *   - `imports[].type` восстанавливается ТОЛЬКО из typeCode
 *     (0=named, 1=default, 2=namespace). Значение `'type'` больше
 *     не возвращается — для type-only импортов используется
 *     отдельный флаг `isTypeOnly`.
 *
 * ✅ v15.0.0 (100% round-trip расширенных секций):
 *   - decodeSection читает и объект, и строку из values[].
 *
 * ✅ v14.0.0 (100% round-trip):
 *   - imports[].isTypeOnly читается из бита 8 в combinedTy.
 *   - Восстанавливаются секции vt/lc/ef/inj/rx/ty/tr.
 *
 * ✅ v13.0.2-fix:
 *   - modules[].fileIds строятся через `fl.m`.
 *
 * ✅ v13.0.0-fix:
 *   - mi.f читается как пары [startFileIdx, fileCount].
 *   - version берётся из CODEC_VERSION.
 *
 * ✅ v12.0.0:
 *   - Columnar + RLE + битовые маски + токенизация.
 *
 * ✅ v9.0.4:
 *   - поле edges — производное, по умолчанию не добавляются.
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
  // ✅ v13.0.2-fix: файлы строятся ДО модулей, потому что
  // modules[].fileIds собираются обратным проходом через fl.m.
  //
  // fl.m — RLE от moduleIdx: для каждого файла хранится индекс
  // его модуля. Это ПОЛНАЯ информация о принадлежности.
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
  // ✅ v13.0.2-fix: `modules[].fileIds` строятся через `fl.m`,
  // а НЕ через `mi.f`.
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
  const fns = compact.fns || { n: [], m: [], f: [], l: [], fl: [], p: [], rt: [] };
  const fnsM = unrle(fns.m || []);
  const fnsF = unrle(fns.f || []);

  const functions: FunctionData[] = [];
  for (let i = 0; i < (fns.n || []).length; i++) {
    const name = readStringOrEmpty(fns.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(fns.fl[i] ?? 0);

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
    };

    // reversibility: копируем остальные флаги, только если они true.
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
      // ✅ v9.0.7: readMethod возвращает null при idx < 0
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
  // ✅ v15.0.1: восстановление `type` БЕЗ эвристики isTypeOnly.
  // ============================================
  //
  // Семантика полей:
  //   - `type` ∈ {'named', 'default', 'namespace'}
  //   - `isTypeOnly` — отдельный флаг
  //
  // БИТЫ combinedTy в gr.i.ty:
  //   0-1 : typeCode (0=named, 1=default, 2=namespace)
  //   2   : isExternal
  //   3   : isTypeOnly
  // ============================================
  const gi = compact.gr?.i || { ff: [], tf: [], s: [], im: [], ln: [], l: [], ty: [] };
  const imports: ImportData[] = [];

  for (let i = 0; i < (gi.ff || []).length; i++) {
    const combinedTy = gi.ty[i] ?? 0;
    const typeCode = combinedTy & 3;
    const isExternal = (combinedTy & 4) !== 0;
    const isTypeOnly = (combinedTy & 8) !== 0;

    // ✅ v15.0.1: type — ТОЛЬКО из typeCode, БЕЗ эвристики isTypeOnly.
    let type: 'named' | 'default' | 'namespace';
    if (typeCode === 1) type = 'default';
    else if (typeCode === 2) type = 'namespace';
    else type = 'named';

    const source = readStringOrEmpty(gi.s[i] ?? -1);
    const toFileId = readString(gi.tf[i] ?? -1) ?? null;

    imports.push({
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
    });
  }

  // ============================================
  // 8. Вызовы (gr.c)
  // ============================================
  const gc = compact.gr?.c || { f: [], t: [], l: [], ty: [] };
  const calls: CallData[] = [];

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

    calls.push({
      id: `c${i + 1}`,
      fromFunctionId: `fn${(gc.f[i] ?? 0) + 1}`,
      toFunctionId,
      line: gc.l[i] ?? 0,
      type,
    });
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
  // 10. Statistics
  // ============================================
  const statistics = includeStatistics ? compact.st : ({} as any);

  // ============================================
  // 10.5. Восстановление расширенных секций
  // vt / lc / ef / inj / rx / ty / tr
  // ============================================
  // Секции хранятся в compact как массивы индексов в values[].
  // Каждое значение в values[] — это либо объект (после
  // не-дедуплицирующего addAny из v15.0.1), либо JSON-строка
  // (обратная совместимость с v15.0.0, где addAny → addValue →
  // JSON.stringify в некоторых случаях).
  //
  // ⚠️ v15.0.2: секция `cd` (conditionals) НЕ читается здесь.
  //    conditionals восстанавливаются как часть `TemplateData`
  //    через `decodeSection<TemplateData>(compact.vt)`.
  //
  // Структура compact (см. codec-encode.ts):
  //   vt:  number[]   — индексы из values[] для templates[]
  //   lc:  number[]   — индексы из values[] для lifecycle[]
  //   ef:  number[]   — индексы из values[] для effects[]
  //   inj: number[]   — индексы из values[] для injections[]
  //   rx:  number[]   — индексы из values[] для reactivity[]
  //   cd:  number[]   — индексы из values[] для conditionals[]
  //                     (НЕ читается здесь — только через templates[])
  //   ty:  number[]   — индексы из values[] для types[]
  //   tr:  number[]   — индексы из values[] для typeRefs[]
  // ============================================

  const decodeSection = <T>(section: unknown): T[] | undefined => {
    if (!Array.isArray(section)) return undefined;
    const result: T[] = [];
    for (const idx of section) {
      if (typeof idx !== 'number' || idx < 0) continue;
      const raw = readValue(idx);
      if (raw === undefined || raw === null) continue;

      // ✅ v15.0.1: values хранит объекты (после addAny),
      // но поддерживаем и строки для обратной совместимости.
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

  // ⚠️ v15.0.2: секция `cd` (conditionals) НЕ читается здесь.
  //    Все conditionals восстанавливаются внутри `templates[]`
  //    (см. `decodeSection<TemplateData>(compact.vt)` выше).
  //    Верхнеуровневого `conditionals` в FullJSON больше нет.

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
  }

  // ============================================
  // 12. Сборка результата
  // ============================================
  // ✅ v13.0.0-fix: version берётся из CODEC_VERSION.
  // ✅ v15.0.0: восстановление templates/lifecycle/effects/injections/
  //             reactivity/types/typeRefs.
  // ✅ v15.0.1: type импортов без 'type'.
  // ✅ v15.0.2: conditionals живут ТОЛЬКО в templates[].conditionals.
  //             Верхнеуровневого `conditionals` в FullJSON НЕТ.
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
