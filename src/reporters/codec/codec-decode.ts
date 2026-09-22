// src/reporters/codec/codec-decode.ts
// ============================================
// ДЕКОДИРОВАНИЕ: CompactJSON → FullJSON
// ============================================
// Версия: 15.4.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.4.0 (P3 — cross-file resolution):
//   - ✅ CODEC_VERSION = '15.4.0'
//
// v15.3.0 (P2 — расширенный CallData):
//   - ✅ ДОБАВЛЕНО: CALL_KIND_BY_CODE
//   - ✅ ДОБАВЛЕНО: чтение gr.c.col/ck/cn/ai
//
// v15.2.0 (P1 — lexicalLinks):
//   - ✅ ДОБАВЛЕНО: LEXICAL_RELATION_BY_CODE
//   - ✅ ДОБАВЛЕНО: чтение compact.lx
//   - ✅ ДОБАВЛЕНО: result.lexicalLinks
//
// v15.1.0 (P0 — parentFunctionId):
//   - ✅ ДОБАВЛЕНО: чтение fns.parent
//
// v15.0.6 (gr.i.tf — индекс в fl.p):
//   - ✅ ИЗМЕНЕНО: tf читается как индекс в fl.p
//   - ✅ -1 → external:* / unresolved:*
//
// v15.0.4 (проброс isReExport/isStarReExport):
//   - ✅ ДОБАВЛЕНО: чтение битов 4, 5 из gr.i.ty
//
// v15.0.2 (устранение дублирования conditionals):
//   - ✅ УБРАНО: чтение compact.cd через decodeSection
//
// v15.0.1 (fix imports[].type):
//   - ✅ ИСПРАВЛЕНО: imports[].type больше не использует эвристику
//
// v15.0.0 (100% round-trip расширенных секций):
//   - ✅ ИСПРАВЛЕНО: decodeSection читает и объект, и строку
//
// v14.0.0 (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: imports[].isTypeOnly читается из бита 8
//
// v13.0.2-fix (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: modules[].fileIds строятся через fl.m
//
// v13.0.0-fix (100% round-trip):
//   - ✅ ИСПРАВЛЕНО: mi.f читается как пары [startFileIdx, fileCount]
//
// v12.0.0 (структурная оптимизация):
//   - ✅ Columnar-структура для всех секций
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
} from './codec-types.js';

// ✅ v15.4.0: единая версия CODEC
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
// ОСНОВНАЯ ФУНКЦИЯ DECODE
// ============================================

/**
 * Декодирует сжатый JSON обратно в полный.
 *
 * ✅ v15.4.0 (P3):
 *   - CODEC_VERSION = '15.4.0'
 *
 * ✅ v15.3.0 (P2 — расширенный CallData):
 *   - Читает `gr.c.col/ck/cn/ai`
 *   - Восстанавливает `CallData.column/callKind/calleeName/argumentIndex`
 *
 * ✅ v15.2.0 (P1 — lexicalLinks):
 *   - Читает `compact.lx` (columnar)
 *   - Восстанавливает `full.lexicalLinks`
 *
 * ✅ v15.1.0 (P0 — parentFunctionId):
 *   - Читает `fns.parent` (RLE)
 *   - Восстанавливает `FunctionData.parentFunctionId`
 *
 * ✅ v15.0.6 (gr.i.tf — индекс в fl.p):
 *   - `tf >= 0` → локальный разрешённый импорт
 *   - `tf = -1` ∧ isExternal → `external:${pkg}`
 *   - `tf = -1` ∧ !isExternal ∧ source → `unresolved:${source}`
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
  // ============================================
  const fns = compact.fns || { n: [], m: [], f: [], l: [], fl: [], p: [], rt: [] };
  const fnsM = unrle(fns.m || []);
  const fnsF = unrle(fns.f || []);

  // ✅ v15.1.0 (P0): parent — опционально (обратная совместимость)
  const fnsParent = fns.parent ? unrle(fns.parent as [number, number][]) : [];

  const functions: FunctionData[] = [];
  for (let i = 0; i < (fns.n || []).length; i++) {
    const name = readStringOrEmpty(fns.n[i] ?? -1);
    const flags = decodeFlagsFromNumber(fns.fl[i] ?? 0);

    // ✅ v15.1.0 (P0): parentFunctionId
    const parentIdx = fnsParent[i] ?? -1;
    const parentFunctionId = parentIdx >= 0 ? `fn${parentIdx + 1}` : null;

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
  // ✅ v15.4.0: version = CODEC_VERSION ('15.4.0')
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
