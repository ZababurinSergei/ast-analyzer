// ============================================================================
// AST ANALYZER — CODEC v9.3
// Кодирование/декодирование между полным и компактным форматами.
//
//   Full    (index.full.json) — развёрнутый, читаемый, с длинными ключами
//   Compact (index.json)      — короткие ключи, tuple-массивы, словари строк
//
// Публичный API:
//   decodeCompactData(compact)              → full
//   encodeToCompactData(full, options)      → compact
//   roundTripSemantic(compact)              → L1-проверка (семантическая)
//   roundTripByteExact(compact)             → L3-проверка (байт-в-байт)
//   roundTripEncode(full)                   → обратная проверка
//   detectFormat(json)                      → 'compact' | 'full' | 'unknown'
//   toFullData(json)                        → full (универсальный вход)
//
// Изменения v9.2:
//   - deepEqual теперь считает undefined ≈ [] ≈ {} (пустые контейнеры)
//   - roundTripSemantic вырезает legend и __codec перед сравнением
//   - roundTripByteExact вырезает пустые контейнеры перед сравнением
//   - Добавлена stripForByteCompare для устойчивого сравнения
//   - Добавлена stripServiceFields для L1-проверок
//
// Изменения v9.3 (текущая версия):
//   - ИСПРАВЛЕНО: в секции gr.* индексы moduleIdx/fileIdx/funcIdx —
//     это 1-based НОМЕРА сущностей (m2 → 2, f2 → 2, fn110 → 110),
//     а НЕ индексы в массивах (0-based).
//   - ИСПРАВЛЕНО: external functions в gr.c хранятся как индексы в
//     stringDict (str(idx)), а не в funcList.
//   - ИСПРАВЛЕНО: encodeFlags теперь использует порядок 'aerm'
//     (a → e → r → m), а не 'earm'.
//   - ИСПРАВЛЕНО: idToNum() извлекает числовой суффикс ID вместо
//     поиска позиции в массиве.
//   - ИСПРАВЛЕНО: в encodeToCompactData поля gr.e / gr.i / gr.c / gr.re
//     теперь устанавливаются через out.gr.* (раньше setArr('gr.e', ...)
//     создавал плоский ключ "gr.e" в корне out).
//   - ИСПРАВЛЕНО: для unresolved импортов (toFileId отсутствует в fl)
//     сохраняется исходный номер файла в поле __rawToFileNum, чтобы
//     симметрия L3 (байт-в-байт) сохранялась.
//
// Изменения v9.4 (текущая версия):
//   - ИСПРАВЛЕНО: __rawToFileNum теперь сохраняется для ВСЕХ импортов
//     с toNumRaw > 0, а не только для внутренних unresolved.
//     Ранее для external-импортов поле не сохранялось, из-за чего
//     при encodeToCompactData терялся оригинальный индекс в stringDict
//     (значения 353, 355, 357, ... заменялись на -1).
//   - ИСПРАВЛЕНО: в encodeToCompactData проверка __rawToFileNum
//     перенесена В НАЧАЛО цепочки if/else, чтобы она срабатывала
//     и для external-импортов. Ранее первый if (i.isExternal)
//     перехватывал управление и возвращал -1.
//   - РЕЗУЛЬТАТ: L3 (byte-exact) round-trip теперь проходит для
//     импортов с external-ссылками (20 расхождений устранено).
//
// Симметрия:
//   - decodeCompactData сохраняет исходные словари в out.__codec
//   - encodeToCompactData({ reuseDicts: true }) переиспользует их
//   - strict: true → падать, если значение не найдено в словаре
// ============================================================================

// ---------------------------------------------------------------------------
// СЛУЖЕБНЫЕ КЛАССЫ ДЛЯ СБОРКИ СЛОВАРЕЙ
// ---------------------------------------------------------------------------

/**
 * Словарь строк с возможностью добавления.
 * Используется при кодировании «с нуля».
 */
class DictBuilder {
  constructor() {
    this.map = new Map();
    this.list = [];
  }
  add(value) {
    if (value === null || value === undefined || value === '') return -1;
    const key = String(value);
    if (this.map.has(key)) return this.map.get(key);
    const idx = this.list.length;
    this.list.push(key);
    this.map.set(key, idx);
    return idx;
  }
}

/**
 * Словарь значений (может содержать объекты/массивы/примитивы).
 */
class ValueDictBuilder {
  constructor() {
    this.map = new Map();
    this.list = [];
  }
  add(value) {
    if (value === null || value === undefined) return -1;
    const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (this.map.has(key)) return this.map.get(key);
    const idx = this.list.length;
    this.list.push(value);
    this.map.set(key, idx);
    return idx;
  }
}

/**
 * «Замороженный» словарь строк — только для чтения.
 * Возвращает существующий индекс или -1/ошибку.
 * Используется при encodeToCompactData({ reuseDicts: true }).
 */
class FrozenDictBuilder {
  constructor(initialList, strict = false) {
    this.list = (initialList || []).slice();
    this.map = new Map();
    this.strict = strict;
    for (let i = 0; i < this.list.length; i++) {
      this.map.set(this.list[i], i);
    }
  }
  add(value) {
    if (value === null || value === undefined || value === '') return -1;
    const key = String(value);
    if (this.map.has(key)) return this.map.get(key);
    if (this.strict) {
      throw new Error(
        `FrozenDictBuilder: значение "${key}" отсутствует в исходном словаре. ` +
        `Full-формат был изменён после декодирования.`
      );
    }
    // Нестрогий режим: дописываем в конец (индексы-префиксы сохраняются)
    const idx = this.list.length;
    this.list.push(key);
    this.map.set(key, idx);
    return idx;
  }
}

/**
 * «Замороженный» словарь значений — только для чтения.
 */
class FrozenValueDictBuilder {
  constructor(initialList, strict = false) {
    this.list = (initialList || []).slice();
    this.map = new Map();
    this.strict = strict;
    for (let i = 0; i < this.list.length; i++) {
      const v = this.list[i];
      const key = typeof v === 'object' ? JSON.stringify(v) : String(v);
      this.map.set(key, i);
    }
  }
  add(value) {
    if (value === null || value === undefined) return -1;
    const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (this.map.has(key)) return this.map.get(key);
    if (this.strict) {
      throw new Error(
        `FrozenValueDictBuilder: значение "${key}" отсутствует в исходном словаре.`
      );
    }
    const idx = this.list.length;
    this.list.push(value);
    this.map.set(key, idx);
    return idx;
  }
}

// ---------------------------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ---------------------------------------------------------------------------

/**
 * Извлекает числовой суффикс из ID.
 *   "m2"    → 2
 *   "f26"   → 26
 *   "fn110" → 110
 *   ""/null → -1
 */
function idToNum(id) {
  if (!id || typeof id !== 'string') return -1;
  const m = id.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}

// ---------------------------------------------------------------------------
// ДЕКОДИРОВАНИЕ: compact → full
// ---------------------------------------------------------------------------

/**
 * Декодирует компактный JSON (index.json) в полный формат (index.full.json).
 * Сохраняет исходные словари в out.__codec для последующего симметричного
 * кодирования.
 *
 * ВАЖНО (v9.3):
 *   - ID сущностей в массивах fns/cls/cn хранятся КАК ЕСТЬ (строками).
 *   - В секции gr.* индексы (moduleIdx, fileIdx, funcIdx) — это
 *     1-based НОМЕРА сущностей:
 *        moduleIdx = 2   → "m2"    (moduleList[1])
 *        fileIdx   = 2   → "f2"    (fileList[1])
 *        funcIdx   = 110 → "fn110" (funcList[109])
 *   - В gr.c для external (type === "e") значение toFunctionId — это
 *     индекс в stringDict (strByIdx), а не в funcList.
 *   - Для unresolved импортов (toFileId отсутствует в fl) сохраняется
 *     исходный номер файла в поле __rawToFileNum — для симметрии L3.
 *
 * ВАЖНО (v9.4):
 *   - __rawToFileNum теперь сохраняется для ВСЕХ импортов с toNumRaw > 0
 *     (включая external), чтобы L3 (byte-exact) round-trip был возможен.
 *
 * @param {object} compact — объект из index.json
 * @returns {object} — объект в полном формате + __codec
 */
export function decodeCompactData(compact) {
  if (!compact || typeof compact !== 'object') {
    throw new Error('decodeCompactData: ожидается объект');
  }

  const legend = compact.legend || {};
  const S = legend.stringDict || [];
  const P = legend.paramDict || [];
  const V = legend.valueDict || [];
  const flagMap = legend.flagCharMap || {};
  const expTypes = legend.exportTypes || {};
  const impTypes = legend.importTypes || {};
  const callTypes = legend.callTypes || {};
  const reExpTypes = legend.reExportTypes || {};
  const lcTypes = legend.lifecycleTypes || {};
  const injTypes = legend.injectionTypes || {};
  const rxTypes = legend.reactivityTypes || {};
  const condTypes = legend.conditionalTypes || {};
  const typeKinds = legend.typeKinds || {};
  const typeUsage = legend.typeUsageKinds || {};

  // Хелперы-декодеры словарей
  const str = (i) => (i === -1 || i == null ? '' : (S[i] ?? ''));
  const par = (i) => (i === -1 || i == null ? '' : (P[i] ?? ''));
  const val = (i) => (i === -1 || i == null ? undefined : V[i]);
  const code = (map, c, fb) => map[c] || c || fb || '';

  // ---------------------------------------------------------------------
  // 1-BASED МАППИНГ: номер → ID
  //   moduleIdx = 1  → "m1"
  //   moduleIdx = 26 → "m26"
  //   moduleIdx = 0 / null / undefined → ""
  // ---------------------------------------------------------------------
  const moduleList = Object.keys(compact.mi || {});
  const fileList   = Object.keys(compact.fl || {});
  const funcList   = (compact.fns || []).map((a) => a[0]);

  const moduleByIdx = (i) => {
    if (i == null || i <= 0) return '';
    return moduleList[i - 1] ?? '';
  };
  const fileByIdx = (i) => {
    if (i == null || i <= 0) return '';
    return fileList[i - 1] ?? '';
  };
  const funcByIdx = (i) => {
    if (i == null || i <= 0) return '';
    return funcList[i - 1] ?? '';
  };

  // Для external: idx — это индекс в stringDict
  const strByIdx = (i) => (i == null || i < 0 ? '' : (S[i] ?? ''));

  // Декодирует строку флагов в объект булевых значений.
  const decodeFlags = (flagsStr) => {
    const s = flagsStr || '';
    const out = {};
    for (const ch of Object.keys(flagMap)) {
      out[ch] = s.includes(ch);
    }
    return out;
  };

  const out = {
    version: compact.v || compact.version || '?',
    timestamp: compact.ts || compact.timestamp || '',
    root: compact.r || compact.root || '',
    modules: [],
    files: [],
    functions: [],
    classes: [],
    constants: [],
    exports: [],
    imports: [],
    calls: [],
    reExports: [],
    templates: [],
    statistics: compact.st || compact.statistics || {},
    conditionals: [],
    lifecycle: [],
    injections: [],
    reactivity: [],
    types: [],
    typeRefs: [],
    legend: legend,
  };

  // ---- modules ----
  if (compact.mi) {
    out.modules = Object.entries(compact.mi).map(([id, m]) => ({
      id,
      name: m.n || '',
      path: m.p || m.n || '',
      fileIds: m.f || [],
    }));
  }

  // ---- files ----
  if (compact.fl) {
    out.files = Object.entries(compact.fl).map(([id, f]) => ({
      id,
      path: f.p || '',
      moduleId: f.m || '',
    }));
  }

  // ---- functions ----
  // Схема: [id, name, moduleId, fileId, line, flags, paramsIdx[], returnTypeIdx]
  // moduleId и fileId здесь — СТРОКИ ("m2", "f2"), НЕ индексы.
  if (compact.fns) {
    out.functions = compact.fns.map((a) => {
      const fl = decodeFlags(a[5]);
      return {
        id: a[0],
        name: a[1],
        moduleId: a[2],
        fileId: a[3],
        line: a[4],
        isExported: !!fl.e,
        isAsync: !!fl.a,
        isArrow: !!fl.r,
        isMethod: !!fl.m,
        params: (a[6] || []).map(par),
        returnType: str(a[7]),
      };
    });
  }

  // ---- classes ----
  // Схема: [id, name, moduleId, fileId, line, flags, methodsIdx[]]
  if (compact.cls) {
    out.classes = compact.cls.map((a) => {
      const fl = decodeFlags(a[5]);
      return {
        id: a[0],
        name: a[1],
        moduleId: a[2],
        fileId: a[3],
        line: a[4],
        isExported: !!fl.e,
        methods: (a[6] || []).map((x) => str(x)),
      };
    });
  }

  // ---- constants ----
  // Схема: [id, name, moduleId, fileId, line, flags, valueIdx]
  if (compact.cn) {
    out.constants = compact.cn.map((a) => {
      const fl = decodeFlags(a[5]);
      return {
        id: a[0],
        name: a[1],
        moduleId: a[2],
        fileId: a[3],
        line: a[4],
        isExported: !!fl.e,
        value: val(a[6]),
      };
    });
  }

  // ---- graph ----
  if (compact.gr) {
    // exports: [moduleNum, fileNum, funcNum, line, typeCode, exportNameIdx,
    //           localNameIdx, isTypeOnly, isReExport, sourceIdx]
    // ВАЖНО: moduleNum/fileNum/funcNum — 1-based номера сущностей.
    if (compact.gr.e) {
      out.exports = compact.gr.e.map((a, i) => ({
        id: `e${i + 1}`,
        moduleId: moduleByIdx(a[0]),
        fileId: fileByIdx(a[1]),
        functionId: (a[2] != null && a[2] > 0)
          ? funcByIdx(a[2])
          : undefined,
        line: a[3],
        type: code(expTypes, a[4], 'named'),
        exportName: str(a[5]),
        localName: str(a[6]),
        isTypeOnly: !!a[7],
        isReExport: !!a[8],
        source: str(a[9]),
      }));
    }

    // imports: [fromFileNum, toFileIdIdx, sourceIdx, importedNameIdx,
    //           localNameIdx, line, typeCode, isExternal]
    // ВАЖНО: fromFileNum — 1-based номер файла (индекс в fl).
    // ВАЖНО: toFileIdIdx — индекс в stringDict (или 1-based номер файла,
    // в зависимости от реализации генератора). Для сохранения симметрии
    // L3 сохраняем исходное значение в __rawToFileNum для ВСЕХ импортов
    // с toNumRaw > 0 (включая external).
    if (compact.gr.i) {
      out.imports = compact.gr.i.map((a, i) => {
        const isExternal = !!a[7];
        const toNumRaw = a[1];
        const resolvedToFileId = isExternal ? '' : fileByIdx(toNumRaw);
        return {
          id: `i${i + 1}`,
          fromFileId: fileByIdx(a[0]),
          toFileId: resolvedToFileId,
          // Служебное поле: сохраняем «сырой» индекс для симметрии L3.
          // Для внешних импортов это индекс в stringDict (пакет),
          // для внутренних — номер файла (может быть unresolved).
          // v9.4: сохраняем для ВСЕХ импортов с toNumRaw > 0.
          __rawToFileNum: (toNumRaw != null && toNumRaw > 0)
            ? toNumRaw
            : undefined,
          source: str(a[2]),
          importedName: str(a[3]),
          localName: str(a[4]),
          line: a[5],
          type: code(impTypes, a[6], 'named'),
          isExternal,
        };
      });
    }

    // calls: [fromNum, toNumOrExternalIdx, line, typeCode]
    // ВАЖНО:
    //   - fromNum — 1-based номер функции.
    //   - Если typeCode === "e" (external) — toNumOrExternalIdx это
    //     индекс в stringDict (strByIdx), а не в funcList.
    //   - Иначе — 1-based номер функции.
    if (compact.gr.c) {
      out.calls = compact.gr.c.map((a, i) => {
        const typeCode = a[3];
        const isExt = typeCode === 'e';
        return {
          id: `c${i + 1}`,
          fromFunctionId: funcByIdx(a[0]),
          toFunctionId: isExt ? strByIdx(a[1]) : funcByIdx(a[1]),
          line: a[2],
          type: code(callTypes, typeCode, 'direct'),
        };
      });
    }

    // reExports: [moduleNum, funcNum, sourceIdx, exportNameIdx,
    //             line, typeCode, isTypeOnly]
    if (compact.gr.re) {
      out.reExports = compact.gr.re.map((a, i) => ({
        id: `re${i + 1}`,
        moduleId: moduleByIdx(a[0]),
        functionId: (a[1] != null && a[1] > 0)
          ? funcByIdx(a[1])
          : undefined,
        source: str(a[2]),
        exportName: str(a[3]),
        line: a[4],
        type: code(reExpTypes, a[5], 'named'),
        isTypeOnly: !!a[6],
      }));
    }
  }

  // ---- templates ----
  if (compact.vt) {
    out.templates = compact.vt.map((a) => ({
      fileId: fileByIdx(a[0]),
      moduleId: moduleByIdx(a[1]),
      complexity: a[2] || 0,
      reactivityDeps: (a[3] || []).map(str),
      eventHandlers: (a[4] || []).map((ev) => ({
        eventName: str(ev[0]),
        handlerName: str(ev[1]),
        tag: str(ev[2]),
        line: ev[3],
        modifiers: (ev[4] || []).map(str),
        isExternal: !!ev[5],
      })),
      dynamicComponents: (a[5] || []).map((dc) => ({
        isExpression: str(dc[0]),
        line: dc[1],
        resolvedComponents: (dc[2] || []).map(str),
      })),
      directives: (a[6] || []).map(str),
      usedComponents: (a[7] || []).map(str),
      templateRefs: (a[8] || []).map((tr) => ({
        refValue: str(tr[0]),
        tag: str(tr[1]),
        line: tr[2],
        exposedMethods: (tr[3] || []).map(str),
      })),
      cssVariables: (a[9] || []).map((cv) => ({
        name: str(cv[0]),
        value: str(cv[1]),
        line: cv[2],
        isMultiline: !!cv[3],
      })),
      deepSelectors: (a[10] || []).map((ds) => ({
        selector: str(ds[0]),
        line: ds[1],
      })),
      slots: (a[11] || []).map(str),
    }));
  }

  // ---- lifecycle ----
  if (compact.lc) {
    out.lifecycle = compact.lc.map((a, i) => ({
      id: `lc${i + 1}`,
      hookName: code(lcTypes, a[0], a[0]),
      functionId: funcByIdx(a[1]) || undefined,
      line: a[2],
      callbackFunctionId: funcByIdx(a[3]) || undefined,
      flags: a[4] || 0,
    }));
  }

  // ---- injections ----
  if (compact.inj) {
    out.injections = compact.inj.map((a, i) => ({
      id: `in${i + 1}`,
      kind: code(injTypes, a[0], a[0]),
      fileId: fileByIdx(a[1]),
      line: a[2],
      key: str(a[3]),
      flags: a[4] || 0,
    }));
  }

  // ---- reactivity ----
  if (compact.rx) {
    out.reactivity = compact.rx.map((a, i) => ({
      id: `rx${i + 1}`,
      kind: code(rxTypes, a[0], a[0]),
      functionId: funcByIdx(a[1]) || undefined,
      line: a[2],
      reads: (a[3] || []).map(str),
      writes: (a[4] || []).map(str),
      flags: a[5] || 0,
    }));
  }

  // ---- conditionals ----
  if (compact.cd) {
    out.conditionals = compact.cd.map((a, i) => ({
      id: `cd${i + 1}`,
      directive: code(condTypes, a[0], a[0]),
      fileId: fileByIdx(a[1]),
      line: a[2],
      conditionExpression: str(a[3]),
      componentName: str(a[4]) || undefined,
      flags: a[5] || 0,
    }));
  }

  // ---- types ----
  if (compact.ty) {
    out.types = compact.ty.map((a, i) => ({
      id: `t${i + 1}`,
      kind: code(typeKinds, a[0], a[0]),
      name: str(a[1]),
      moduleId: moduleByIdx(a[2]),
      fileId: fileByIdx(a[3]),
      line: a[4],
      members: (a[5] || []).map(str),
      extendsTypes: (a[6] || []).map(str),
    }));
  }

  // ---- typeRefs ----
  if (compact.tr) {
    out.typeRefs = compact.tr.map((a, i) => ({
      id: `tr${i + 1}`,
      typeName: str(a[0]),
      moduleId: moduleByIdx(a[1]),
      fileId: fileByIdx(a[2]),
      line: a[3],
      usageKind: code(typeUsage, a[4], a[4]),
    }));
  }

  // -----------------------------------------------------------------------
  // СОХРАНЕНИЕ ИСХОДНЫХ СЛОВАРЕЙ ДЛЯ СИММЕТРИЧНОГО КОДИРОВАНИЯ
  // -----------------------------------------------------------------------
  out.__codec = {
    stringDict: S.slice(),
    paramDict: P.slice(),
    valueDict: V.slice(),
    flagMap: { ...flagMap },
    legend: JSON.parse(JSON.stringify(legend)),
  };

  return out;
}

// ---------------------------------------------------------------------------
// КОДИРОВАНИЕ: full → compact
// ---------------------------------------------------------------------------

/**
 * Кодирует полный формат (index.full.json) в компактный (index.json).
 *
 * @param {object} full — объект в полном формате
 * @param {object} [options]
 * @param {boolean} [options.reuseDicts=false] — переиспользовать словари из full.__codec
 * @param {boolean} [options.strict=false]    — падать при отсутствии значения в словаре
 * @param {boolean} [options.omitEmpty=true]  — не писать пустые массивы/объекты
 * @returns {object} — компактный объект
 */
export function encodeToCompactData(full, options = {}) {
  if (!full || typeof full !== 'object') {
    throw new Error('encodeToCompactData: ожидается объект');
  }

  const {
    reuseDicts = false,
    strict = false,
    omitEmpty = true,
  } = options;

  // ---- ВЫБОР СЛОВАРЕЙ ----
  let S, P, VD;

  if (reuseDicts && full.__codec) {
    S  = new FrozenDictBuilder(full.__codec.stringDict, strict);
    P  = new FrozenDictBuilder(full.__codec.paramDict, strict);
    VD = new FrozenValueDictBuilder(full.__codec.valueDict, strict);
  } else {
    S  = new DictBuilder();
    P  = new DictBuilder();
    VD = new ValueDictBuilder();
  }

  // ---- КАРТЫ ФЛАГОВ ----
  const flagMap = {
    'a': 1, 'e': 2, 'm': 4, 'r': 8, 'v': 16, 'n': 32, 's': 64,
    'd': 128, 'c': 256, 'x': 512, 't': 1024, 'A': 2048, 'l': 4096,
    'y': 8192, 'g': 16384, 'p': 32768, 'P': 65536, 'S': 131072,
  };
  const flagCharMap = { ...flagMap };

  // ---- КАРТЫ ТИПОВ ----
  const relationTypes = {
    d: 'direct', a: 'async', m: 'method', c: 'callback', e: 'external',
    n: 'named', df: 'default', ns: 'namespace', to: 'type-only',
    ne: 'named-export', de: 'default-export', te: 'type-export',
    re: 're-export', all: 'all',
  };
  const exportTypes = { ne: 'named', de: 'default', te: 'type', re: 're-export' };
  const importTypes = { n: 'named', df: 'default', ns: 'namespace', to: 'type-only' };
  const callTypes = { d: 'direct', a: 'async', m: 'method', c: 'callback', e: 'external' };
  const reExportTypes = { n: 'named', df: 'default', all: 'all' };
  const lifecycleTypes = {
    m: 'onMounted', u: 'onUnmounted', s: 'onScopeDispose',
    a: 'onActivated', d: 'onDeactivated', w: 'watch',
    W: 'watchEffect', e: 'onErrorCaptured',
  };
  const effectTypes = {
    t: 'timer', c: 'cleanup', p: 'promise', e: 'event', s: 'subscription',
  };
  const injectionTypes = { p: 'provide', i: 'inject' };
  const reactivityTypes = {
    c: 'computed', w: 'watch', W: 'watchEffect',
    r: 'ref', R: 'reactive', S: 'shallowRef', o: 'readonly',
  };
  const conditionalTypes = { i: 'v-if', e: 'v-else-if', E: 'v-else' };
  const typeKinds = { i: 'interface', t: 'type-alias', e: 'enum', c: 'class' };
  const typeUsageKinds = {
    p: 'param', r: 'return', f: 'field', g: 'generic', u: 'union', x: 'extends',
  };

  const rev = (map, name, fb) => {
    for (const [k, v] of Object.entries(map)) if (v === name) return k;
    return fb || name;
  };

  // ---------------------------------------------------------------------
  // ИСПРАВЛЕНО: 1-based номера для gr.*
  //   "m2"   → 2
  //   "f2"   → 2
  //   "fn110"→ 110
  // ---------------------------------------------------------------------
  const mi   = (id) => idToNum(id);
  const fi   = (id) => idToNum(id);
  const fni  = (id) => idToNum(id);

  // ---------------------------------------------------------------------
  // ИСПРАВЛЕНО: правильный порядок флагов — a → e → r → m
  // ---------------------------------------------------------------------
  const encodeFlags = (obj) => {
    let s = '';
    if (obj && obj.a) s += 'a';
    if (obj && obj.e) s += 'e';
    if (obj && obj.r) s += 'r';
    if (obj && obj.m) s += 'm';
    return s || '0';
  };

  // Хелперы-индексаторы
  const si = (v) => S.add(v);
  const pi = (v) => P.add(v);
  const vi = (v) => VD.add(v);

  // Хелпер: добавить ключ, только если контейнер непустой (при omitEmpty)
  const setArr = (key, arr) => {
    if (omitEmpty && (!arr || arr.length === 0)) return;
    out[key] = arr;
  };

  const out = {
    v: full.version || '?',
    ts: full.timestamp || '',
    r: full.root || '',
    mi: {},
    fl: {},
    gr: { e: [], i: [], c: [], re: [] },
    st: full.statistics || {},
  };

  // ---- modules ----
  for (const m of (full.modules || [])) {
    out.mi[m.id] = { n: m.name || '', f: m.fileIds || [] };
    if (m.path && m.path !== m.name) out.mi[m.id].p = m.path;
  }
  if (omitEmpty && Object.keys(out.mi).length === 0) delete out.mi;

  // ---- files ----
  for (const f of (full.files || [])) {
    out.fl[f.id] = { p: f.path || '', m: f.moduleId || '' };
  }
  if (omitEmpty && Object.keys(out.fl).length === 0) delete out.fl;

  // ---- functions ----
  // moduleId/fileId — СТРОКИ, не индексы.
  setArr('fns', (full.functions || []).map((fn) => {
    const flags = encodeFlags({
      a: fn.isAsync,
      e: fn.isExported,
      r: fn.isArrow,
      m: fn.isMethod,
    });
    return [
      fn.id,
      fn.name,
      fn.moduleId,
      fn.fileId,
      fn.line,
      flags,
      (fn.params || []).map(pi),
      si(fn.returnType),
    ];
  }));

  // ---- classes ----
  setArr('cls', (full.classes || []).map((c) => {
    const flags = encodeFlags({ e: c.isExported });
    return [c.id, c.name, c.moduleId, c.fileId, c.line, flags, (c.methods || []).map(si)];
  }));

  // ---- constants ----
  setArr('cn', (full.constants || []).map((c) => {
    const flags = encodeFlags({ e: c.isExported });
    return [c.id, c.name, c.moduleId, c.fileId, c.line, flags, vi(c.value)];
  }));

  // =====================================================================
  // ИСПРАВЛЕНО: gr.e / gr.i / gr.c / gr.re устанавливаются напрямую
  // через out.gr.* (раньше setArr('gr.e', ...) создавал плоский ключ
  // "gr.e" в корне out, а не out.gr.e).
  // =====================================================================

  // ---- exports (gr.e) ----
  // moduleNum, fileNum, funcNum — 1-based номера.
  out.gr.e = (full.exports || []).map((e) => [
    mi(e.moduleId),
    fi(e.fileId),
    e.functionId ? fni(e.functionId) : -1,
    e.line,
    rev(exportTypes, e.type, 'ne'),
    si(e.exportName),
    si(e.localName),
    e.isTypeOnly ? 1 : 0,
    e.isReExport ? 1 : 0,
    si(e.source),
  ]);

  // ---- imports (gr.i) ----
  // ВАЖНО (v9.4): проверка __rawToFileNum перенесена В НАЧАЛО цепочки,
  // чтобы она срабатывала и для external-импортов. Ранее первый
  // if (i.isExternal) перехватывал управление и возвращал -1,
  // из-за чего терялся оригинальный индекс в stringDict
  // (значения 353, 355, 357, ... заменялись на -1).
  //
  // Приоритет:
  //   1) __rawToFileNum — сохранённый исходный индекс (для байт-в-байт L3)
  //   2) isExternal     — внешний импорт, toNum = -1
  //   3) toFileId       — внутренний, пересчитываем fi(toFileId)
  //   4) иначе          — toNum = -1
  out.gr.i = (full.imports || []).map((i) => {
    const isExt = !!i.isExternal;
    let toNum;
    if (i.__rawToFileNum != null) {
      toNum = i.__rawToFileNum;
    } else if (isExt) {
      toNum = -1;
    } else if (i.toFileId) {
      toNum = fi(i.toFileId);
    } else {
      toNum = -1;
    }
    return [
      fi(i.fromFileId),
      toNum,
      si(i.source),
      si(i.importedName),
      si(i.localName),
      i.line,
      rev(importTypes, i.type, 'n'),
      isExt ? 1 : 0,
    ];
  });

  // ---- calls (gr.c) ----
  // Для external используем индекс в stringDict (si), а не fni.
  out.gr.c = (full.calls || []).map((c) => {
    const isExt = c.type === 'external' ||
      (typeof c.toFunctionId === 'string' && c.toFunctionId.startsWith('external:'));
    return [
      fni(c.fromFunctionId),
      isExt ? si(c.toFunctionId) : fni(c.toFunctionId),
      c.line,
      rev(callTypes, c.type, 'd'),
    ];
  });

  // ---- reExports (gr.re) ----
  out.gr.re = (full.reExports || []).map((r) => [
    mi(r.moduleId),
    r.functionId ? fni(r.functionId) : -1,
    si(r.source),
    si(r.exportName),
    r.line,
    rev(reExportTypes, r.type, 'n'),
    r.isTypeOnly ? 1 : 0,
  ]);

  // Убираем пустой gr, если omitEmpty
  if (omitEmpty &&
    out.gr.e.length === 0 && out.gr.i.length === 0 &&
    out.gr.c.length === 0 && out.gr.re.length === 0) {
    delete out.gr;
  }

  // ---- templates ----
  setArr('vt', (full.templates || []).map((t) => [
    fi(t.fileId),
    mi(t.moduleId),
    t.complexity || 0,
    (t.reactivityDeps || []).map(si),
    (t.eventHandlers || []).map((ev) => [
      si(ev.eventName),
      si(ev.handlerName),
      si(ev.tag),
      ev.line,
      (ev.modifiers || []).map(si),
      ev.isExternal ? 1 : 0,
    ]),
    (t.dynamicComponents || []).map((dc) => [
      si(dc.isExpression),
      dc.line,
      (dc.resolvedComponents || []).map(si),
    ]),
    (t.directives || []).map(si),
    (t.usedComponents || []).map(si),
    (t.templateRefs || []).map((tr) => [
      si(tr.refValue),
      si(tr.tag),
      tr.line,
      (tr.exposedMethods || []).map(si),
    ]),
    (t.cssVariables || []).map((cv) => [
      si(cv.name),
      si(cv.value),
      cv.line,
      cv.isMultiline ? 1 : 0,
    ]),
    (t.deepSelectors || []).map((ds) => [si(ds.selector), ds.line]),
    (t.slots || []).map(si),
  ]));

  // ---- lifecycle ----
  setArr('lc', (full.lifecycle || []).map((l) => [
    rev(lifecycleTypes, l.hookName, l.hookName),
    l.functionId ? fni(l.functionId) : -1,
    l.line,
    l.callbackFunctionId ? fni(l.callbackFunctionId) : -1,
    l.flags || 0,
  ]));

  // ---- injections ----
  setArr('inj', (full.injections || []).map((x) => [
    rev(injectionTypes, x.kind, x.kind),
    fi(x.fileId),
    x.line,
    si(x.key),
    x.flags || 0,
  ]));

  // ---- reactivity ----
  setArr('rx', (full.reactivity || []).map((x) => [
    rev(reactivityTypes, x.kind, x.kind),
    x.functionId ? fni(x.functionId) : -1,
    x.line,
    (x.reads || []).map(si),
    (x.writes || []).map(si),
    x.flags || 0,
  ]));

  // ---- conditionals ----
  setArr('cd', (full.conditionals || []).map((x) => [
    rev(conditionalTypes, x.directive, x.directive),
    fi(x.fileId),
    x.line,
    si(x.conditionExpression),
    si(x.componentName),
    x.flags || 0,
  ]));

  // ---- types ----
  setArr('ty', (full.types || []).map((x) => [
    rev(typeKinds, x.kind, x.kind),
    si(x.name),
    mi(x.moduleId),
    fi(x.fileId),
    x.line,
    (x.members || []).map(si),
    (x.extendsTypes || []).map(si),
  ]));

  // ---- typeRefs ----
  setArr('tr', (full.typeRefs || []).map((x) => [
    si(x.typeName),
    mi(x.moduleId),
    fi(x.fileId),
    x.line,
    rev(typeUsageKinds, x.usageKind, x.usageKind),
  ]));

  // ---- legend ----
  out.legend = {
    flagMap: Object.fromEntries(Object.entries(flagMap).map(([k, v]) => [k, String(v)])),
    flagCharMap,
    relationTypes,
    exportTypes,
    importTypes,
    callTypes,
    reExportTypes,
    lifecycleTypes,
    effectTypes,
    injectionTypes,
    reactivityTypes,
    conditionalTypes,
    typeKinds,
    typeUsageKinds,
    arraySchemas: {
      fns: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'paramsIdx', 'returnTypeIdx'],
      cls: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'methodsIdx'],
      cn: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'valueIdx'],
      'gr.e': ['moduleIdx', 'fileIdx', 'funcIdx', 'line', 'typeCode',
        'exportNameIdx', 'localNameIdx', 'isTypeOnly', 'isReExport', 'sourceIdx'],
      'gr.i': ['fromFileIdx', 'toFileIdIdx', 'sourceIdx', 'importedNameIdx',
        'localNameIdx', 'line', 'typeCode', 'isExternal'],
      'gr.c': ['fromIdx', 'toIdxOrExternalIdx', 'line', 'typeCode'],
      'gr.re': ['moduleIdx', 'funcIdx', 'sourceIdx', 'exportNameIdx',
        'line', 'typeCode', 'isTypeOnly'],
      vt: ['fileIdx', 'moduleIdx', 'complexity', 'reactivityDepsIdx',
        'eventHandlers', 'dynamicComponents', 'directivesIdx',
        'usedComponentsIdx', 'templateRefs', 'cssVariables',
        'deepSelectors', 'slotsIdx'],
      'vt.eventHandlers': ['eventNameIdx', 'handlerNameIdx', 'tagIdx', 'line',
        'modifiersIdx', 'isExternal'],
      'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],
      'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],
      'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
      'vt.deepSelectors': ['selectorIdx', 'line'],
      lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],
      ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],
      inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],
      rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],
      cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],
      ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line',
        'membersIdx', 'extendsIdx'],
      tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
    },
    stringDict: S.list,
    paramDict: P.list,
    valueDict: VD.list,
  };

  // -----------------------------------------------------------------------
  // ПРОВЕРКА СИММЕТРИИ ПРИ reuseDicts: true
  // -----------------------------------------------------------------------
  if (reuseDicts && full.__codec) {
    if (strict) {
      if (!arrayEq(S.list, full.__codec.stringDict)) {
        throw new Error(
          `Симметрия нарушена: stringDict изменился. ` +
          `Было ${full.__codec.stringDict.length}, стало ${S.list.length}.`
        );
      }
      if (!arrayEq(P.list, full.__codec.paramDict)) {
        throw new Error(
          `Симметрия нарушена: paramDict изменился. ` +
          `Было ${full.__codec.paramDict.length}, стало ${P.list.length}.`
        );
      }
      if (!arrayEq(VD.list, full.__codec.valueDict)) {
        throw new Error(
          `Симметрия нарушена: valueDict изменился. ` +
          `Было ${full.__codec.valueDict.length}, стало ${VD.list.length}.`
        );
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// ROUND-TRIP ПРОВЕРКИ
// ---------------------------------------------------------------------------

/**
 * L1-проверка: семантическая эквивалентность.
 * decode(x) → encode → decode → сравнение полных форматов.
 *
 * Перед сравнением вырезаются служебные поля (legend, __codec),
 * чтобы порядок словарей и внутренние данные не влияли на результат.
 */
export function roundTripSemantic(compact) {
  const full1 = decodeCompactData(compact);
  const compact2 = encodeToCompactData(full1, { reuseDicts: false });
  const full2 = decodeCompactData(compact2);
  const a = stripServiceFields(full1);
  const b = stripServiceFields(full2);
  const ok = deepEqual(a, b);
  return {
    full: full1,
    compact: compact2,
    reDecoded: full2,
    ok,
    diff: ok ? null : diffObjects(a, b),
  };
}

/**
 * L3-проверка: байтовая эквивалентность (с точностью до форматирования JSON).
 * decode(x) → encode(reuseDicts, strict) → сравнение с x.
 *
 * Перед сравнением вырезаются:
 *   - legend (порядок словарей может отличаться, но данные те же)
 *   - __codec (служебное)
 *   - пустые массивы/объекты (эквивалентны отсутствию ключа)
 */
export function roundTripByteExact(compact) {
  const full = decodeCompactData(compact);
  const compact2 = encodeToCompactData(full, { reuseDicts: true, strict: true });
  const a = stripForByteCompare(compact);
  const b = stripForByteCompare(compact2);
  const ok = deepEqual(a, b);
  return {
    full,
    compact: compact2,
    ok,
    diff: ok ? null : diffObjects(a, b),
  };
}

/**
 * Обратная проверка: encode(full) → decode → encode → сравнение компактов.
 * Идемпотентность: дважды закодированный full даёт тот же compact.
 */
export function roundTripEncode(full) {
  const compact1 = encodeToCompactData(full, { reuseDicts: false });
  const full2 = decodeCompactData(compact1);
  const compact2 = encodeToCompactData(full2, { reuseDicts: false });
  const ok = deepEqual(compact1, compact2);
  return {
    compact: compact1,
    full: full2,
    reEncoded: compact2,
    ok,
    diff: ok ? null : diffObjects(compact1, compact2),
  };
}

// ---------------------------------------------------------------------------
// АВТООПРЕДЕЛЕНИЕ ФОРМАТА
// ---------------------------------------------------------------------------

/**
 * Определяет формат JSON.
 * @returns {'compact' | 'full' | 'unknown'}
 */
export function detectFormat(json) {
  if (!json || typeof json !== 'object') return 'unknown';
  // Компактный: короткие ключи + legend
  if (json.v && json.mi && json.fl) return 'compact';
  // Полный: длинные ключи
  if (json.version && json.modules && json.files) return 'full';
  return 'unknown';
}

/**
 * Универсальный вход: принимает любой формат, возвращает full.
 */
export function toFullData(json) {
  const fmt = detectFormat(json);
  if (fmt === 'compact') return decodeCompactData(json);
  if (fmt === 'full') return json;
  throw new Error('toFullData: неизвестный формат JSON');
}

// ---------------------------------------------------------------------------
// ГЛУБОКОЕ СРАВНЕНИЕ И ДИАГНОСТИКА
// ---------------------------------------------------------------------------

/**
 * Рекурсивное сравнение двух значений.
 *
 * Особенности:
 *   - undefined, null, [], {} считаются эквивалентными (пустые контейнеры).
 *   - Порядок ключей в объектах не важен.
 *   - Порядок элементов в массивах важен.
 */
function deepEqual(a, b) {
  // Эквивалентность пустых контейнеров
  const isEmptyA = a === undefined || a === null ||
    (Array.isArray(a) && a.length === 0) ||
    (typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 0);
  const isEmptyB = b === undefined || b === null ||
    (Array.isArray(b) && b.length === 0) ||
    (typeof b === 'object' && !Array.isArray(b) && Object.keys(b).length === 0);
  if (isEmptyA && isEmptyB) return true;

  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Поиск расхождений между двумя объектами (до 20 штук).
 */
function diffObjects(a, b) {
  const diffs = [];
  const walk = (x, y, path) => {
    if (diffs.length >= 20) return;
    if (deepEqual(x, y)) return;
    if (Array.isArray(x) && Array.isArray(y)) {
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i++) walk(x[i], y[i], `${path}[${i}]`);
    } else if (x && y && typeof x === 'object' && typeof y === 'object') {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of keys) walk(x[k], y[k], `${path}.${k}`);
    } else {
      diffs.push({ path, a: x, b: y });
    }
  };
  walk(a, b, '$');
  return diffs;
}

/**
 * Сравнение массивов строк.
 */
function arrayEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Убирает служебные поля из полного формата:
 *   - __codec (словари для симметрии)
 *   - legend (порядок словарей может отличаться)
 *   - все поля, начинающиеся с __ (служебные)
 * Используется в L1-проверках.
 */
function stripServiceFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const { __codec, legend, ...rest } = obj;
  const clean = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) continue;
    clean[k] = v;
  }
  return clean;
}

/**
 * Убирает legend, __codec и пустые контейнеры.
 * Используется в L3-проверках (байт-в-байт).
 */
function stripForByteCompare(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const { legend, __codec, ...rest } = obj;
  const clean = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) continue;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    clean[k] = v;
  }
  return clean;
}

// ---------------------------------------------------------------------------
// ЭКСПОРТ ДЛЯ ОТЛАДКИ
// ---------------------------------------------------------------------------
export const __internals = {
  DictBuilder,
  ValueDictBuilder,
  FrozenDictBuilder,
  FrozenValueDictBuilder,
  deepEqual,
  diffObjects,
  arrayEq,
  stripServiceFields,
  stripForByteCompare,
  idToNum,
};
