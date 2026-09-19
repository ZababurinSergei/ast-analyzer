#!/usr/bin/env node
/**
 * process_data.mjs
 *
 * Обработчик данных для UI трёхколоночного интерфейса AST Analyzer.
 *
 * Загружает index.json, декодирует все секции отчёта и подготавливает
 * данные для отображения в браузере.
 *
 * Формат index.json (v5.1.0):
 * - mi: карта модулей (m1, m2, ...)
 * - fl: карта файлов (f1, f2, ...)
 * - fns: массив функций [id, name, moduleId, fileId, line, flagsStr]
 * - sf: self-функции [id, name, fileId, line]
 * - cn: константы [id, name, value, moduleId, fileId, line, flags]
 * - gr.c: вызовы [fromIdx, toIdx, line, typeCode]
 * - gr.i: импорты [fromFuncId, toFuncId, name, typeCode, fileId, line]
 * - gr.e: экспорты [moduleIdx, funcIdx, line, typeCode, exportName, localName]
 * - gr.re: реэкспорты [moduleIdx, funcIdx, source, name, line, type]
 * - gr.h: наследование [childId, parentId, typeCode, fileId, line]
 * - gr.td: типовые зависимости [fromId, toId, typeCode, fileId, line]
 * - gr.uc: использование констант [fromFuncId, constId, fileId, line]
 * - gr.cd: зависимости констант [fromConstId, toConstId, fileId, line]
 * - gr.ce: экспорты констант [moduleIdx, constIdx, constName, line, type]
 * - gr.di: динамические импорты [fileId, line, path, type]
 * - gr.cfg: конфигурации [fileId, line, key, type]
 * - gr.ext: внешние библиотеки [fileId, name, version, count, line]
 * - gr.vt: Vue шаблоны [fileId, line, name, type]
 * - gr.async: асинхронные цепочки [funcId, awaitCount, chainLen, line]
 * - gr.closures: замыкания [funcId, line, variables, count]
 * - gr.types: типовые зависимости (расширенные)
 * - st: статистика
 * - flg: FLAG_MAP (карта флагов)
 * - flFull: полные пути файлов (если compressPaths был применён)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// КОНСТАНТЫ ДЛЯ ДЕКОДИРОВАНИЯ ФЛАГОВ
// ============================================================

const FLAG_CHAR_TO_BIT = {
  a: 1, // async
  e: 2, // exported
  m: 4, // method
  r: 8, // arrow
  v: 16, // event handler
  n: 32, // nested
  s: 64, // self
  d: 128, // dynamic
  c: 256, // config
  x: 512, // external
  t: 1024, // vue template
  A: 2048, // async chain ← ИСПРАВЛЕНО (было 'a')
  l: 4096, // closure
  y: 8192, // type dep
};

const FLAG_NAMES = {
  1: 'async',
  2: 'exported',
  4: 'method',
  8: 'arrow',
  16: 'eventHandler',
  32: 'nested',
  64: 'self',
  128: 'dynamic',
  256: 'config',
  512: 'external',
  1024: 'vueTemplate',
  2048: 'asyncChain',
  4096: 'closure',
  8192: 'typeDep',
};

// ============================================================
// ТИПЫ СВЯЗЕЙ (typeCode → человекочитаемое имя)
// ============================================================

const CALL_TYPE_MAP = {
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
  di: 'dynamic-import',
};

const IMPORT_TYPE_MAP = {
  n: 'named',
  df: 'default',
  ns: 'namespace',
  ri: 're-export-import',
  to: 'type-only',
  se: 'side-effect',
};

const EXPORT_TYPE_MAP = {
  ne: 'named-export',
  de: 'default-export',
  re: 're-export',
  te: 'type-export',
  ce: 'const-export',
};

const INHERITANCE_TYPE_MAP = {
  ex: 'extends',
  im: 'implements',
  ab: 'abstract',
};

const TYPE_DEP_TYPE_MAP = {
  p: 'parameter',
  r: 'return',
  an: 'annotation',
  g: 'generic',
  tr: 'type-reference',
  ex: 'extends',
};

const DYNAMIC_IMPORT_TYPE_MAP = {
  literal: 'literal',
  template: 'template-literal',
  concat: 'concatenation',
  conditional: 'conditional',
  variable: 'variable',
};

const CONFIG_TYPE_MAP = {
  env: 'environment-variable',
  require: 'require',
  import: 'import',
  dynamic: 'dynamic',
  variable: 'config-variable',
};

const VUE_TEMPLATE_TYPE_MAP = {
  static: 'static-component',
  dynamic: 'dynamic-component',
  slot: 'slot',
  directive: 'directive',
};

// ============================================================
// УТИЛИТЫ ДЕКОДИРОВАНИЯ ФЛАГОВ
// ============================================================

/**
 * Декодирует строку флагов в массив имён
 * @param {string} flagsStr - строка типа "es", "a", "0"
 * @returns {string[]} массив имён флагов
 */
function decodeFlagString(flagsStr) {
  if (!flagsStr || flagsStr === '0') return [];
  const names = [];
  for (const char of flagsStr) {
    const bit = FLAG_CHAR_TO_BIT[char];
    if (bit === undefined) {
      names.push(`unknown:${char}`);
      continue;
    }
    names.push(FLAG_NAMES[bit] || `bit:${bit}`);
  }
  return names;
}

/**
 * Декодирует строку флагов в объект с boolean
 * @param {string} flagsStr - строка типа "es", "a", "0"
 * @returns {object} объект с boolean полями
 */
function decodeFlagObject(flagsStr) {
  const names = decodeFlagString(flagsStr);
  return {
    isAsync: names.includes('async'),
    isExported: names.includes('exported'),
    isMethod: names.includes('method'),
    isArrow: names.includes('arrow'),
    isEventHandler: names.includes('eventHandler'),
    isNested: names.includes('nested'),
    isSelf: names.includes('self'),
    isDynamic: names.includes('dynamic'),
    isConfig: names.includes('config'),
    isExternal: names.includes('external'),
    isVueTemplate: names.includes('vueTemplate'),
    isAsyncChain: names.includes('asyncChain'),
    isClosure: names.includes('closure'),
    isTypeDep: names.includes('typeDep'),
  };
}

/**
 * Декодирует тип вызова
 */
function decodeCallType(typeCode) {
  if (!typeCode) return 'unknown';
  return CALL_TYPE_MAP[typeCode] || typeCode;
}

/**
 * Декодирует тип импорта
 */
function decodeImportType(typeCode) {
  if (!typeCode) return 'unknown';
  return IMPORT_TYPE_MAP[typeCode] || typeCode;
}

/**
 * Декодирует тип экспорта
 */
function decodeExportType(typeCode) {
  if (!typeCode) return 'unknown';
  return EXPORT_TYPE_MAP[typeCode] || typeCode;
}

/**
 * Декодирует тип наследования
 */
function decodeInheritanceType(typeCode) {
  if (!typeCode) return 'unknown';
  return INHERITANCE_TYPE_MAP[typeCode] || typeCode;
}

/**
 * Декодирует тип типовой зависимости
 */
function decodeTypeDepType(typeCode) {
  if (!typeCode) return 'unknown';
  return TYPE_DEP_TYPE_MAP[typeCode] || typeCode;
}

/**
 * Декодирует тип динамического импорта
 */
function decodeDynamicImportType(typeCode) {
  if (!typeCode) return 'unknown';
  return DYNAMIC_IMPORT_TYPE_MAP[typeCode] || typeCode;
}

/**
 * Декодирует тип конфигурации
 */
function decodeConfigType(typeCode) {
  if (!typeCode) return 'unknown';
  return CONFIG_TYPE_MAP[typeCode] || typeCode;
}

/**
 * Декодирует тип Vue шаблона
 */
function decodeVueTemplateType(typeCode) {
  if (!typeCode) return 'unknown';
  return VUE_TEMPLATE_TYPE_MAP[typeCode] || typeCode;
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ ОБРАБОТКИ
// ============================================================

/**
 * Обрабатывает index.json и возвращает подготовленные данные
 * @param {object} data - сырые данные из index.json
 * @returns {object} подготовленные данные для UI
 */
function processData(data) {
  if (!data) {
    console.error('❌ No data provided');
    return null;
  }

  const result = {
    version: data.v || '5.1.0',
    timestamp: data.ts || new Date().toISOString(),
    root: data.r || 'm1',
    stats: data.st || {},
    flagBits: data.flg || data.flagBits || null,

    modules: [],
    files: [],
    functions: [],
    constants: [],
    selfFunctions: [],
    graph: {
      calls: [],
      imports: [],
      exports: [],
      reExports: [],
      inheritance: [],
      typeDeps: [],
      constUses: [],
      constDeps: [],
      constExports: [],
      dynamicImports: [],
      configRefs: [],
      externalLibs: [],
      vueTemplates: [],
      asyncChains: [],
      closures: [],
      types: [],
    },
    unresolved: data.unresolved || [],
  };

  // ============================================================
  // 1. ДЕКОДИРОВАНИЕ МОДУЛЕЙ (mi)
  // ============================================================

  if (data.mi) {
    result.modules = Object.entries(data.mi).map(([id, name]) => ({
      id,
      name: typeof name === 'string' ? name : String(name),
      index: parseInt(id.replace('m', ''), 10) || 0,
    }));
  }

  // ============================================================
  // 2. ДЕКОДИРОВАНИЕ ФАЙЛОВ (fl)
  // ============================================================

  if (data.fl) {
    const fullPaths = data.flFull || {};
    result.files = Object.entries(data.fl).map(([id, filePath]) => {
      const pathStr = typeof filePath === 'string' ? filePath : String(filePath);
      const fullPath = fullPaths[id] || pathStr;
      return {
        id,
        path: pathStr,
        pathFull: fullPath,
        pathIsCompressed: pathStr.includes('/.../'),
        index: parseInt(id.replace('f', ''), 10) || 0,
      };
    });
  }

  // ============================================================
  // 3. ДЕКОДИРОВАНИЕ ФУНКЦИЙ (fns)
  // Формат: [id, name, moduleId, fileId, line, flagsStr]
  // ============================================================

  if (data.fns) {
    result.functions = data.fns.map((fn) => {
      if (!Array.isArray(fn) || fn.length < 6) return null;

      const id = fn[0];
      const name = fn[1];
      const moduleId = fn[2];
      const fileId = fn[3];
      const line = fn[4];
      const flagsStr = fn[5];

      const flagNames = decodeFlagString(flagsStr);
      const flagObject = decodeFlagObject(flagsStr);

      return {
        id,
        name,
        moduleId,
        fileId,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        flags: flagNames,
        flagObject,
        // Развёрнутые поля для удобства
        isAsync: flagObject.isAsync,
        isExported: flagObject.isExported,
        isMethod: flagObject.isMethod,
        isArrow: flagObject.isArrow,
        isEventHandler: flagObject.isEventHandler,
        isNested: flagObject.isNested,
        isSelf: flagObject.isSelf,
        isDynamic: flagObject.isDynamic,
        isConfig: flagObject.isConfig,
        isExternal: flagObject.isExternal,
        isVueTemplate: flagObject.isVueTemplate,
        isAsyncChain: flagObject.isAsyncChain,
        isClosure: flagObject.isClosure,
        isTypeDep: flagObject.isTypeDep,
        index: parseInt(id.replace('fn', ''), 10) || 0,
      };
    }).filter(Boolean);
  }

  // ============================================================
  // 4. ДЕКОДИРОВАНИЕ SELF-ФУНКЦИЙ (sf)
  // Формат: [id, name, fileId, line]
  // ============================================================

  if (data.sf) {
    result.selfFunctions = data.sf.map((sf) => {
      if (!Array.isArray(sf) || sf.length < 4) return null;

      return {
        id: sf[0],
        name: sf[1],
        fileId: sf[2],
        line: typeof sf[3] === 'number' ? sf[3] : parseInt(sf[3], 10) || 0,
      };
    }).filter(Boolean);
  }

  // ============================================================
  // 5. ДЕКОДИРОВАНИЕ КОНСТАНТ (cn)
  // Формат: [id, name, value, moduleId, fileId, line, flags]
  // ============================================================

  if (data.cn) {
    result.constants = data.cn.map((c) => {
      if (!Array.isArray(c) || c.length < 7) return null;

      const flagsStr = c[6] || '';

      return {
        id: c[0],
        name: c[1],
        value: c[2],
        moduleId: c[3],
        fileId: c[4],
        line: typeof c[5] === 'number' ? c[5] : parseInt(c[5], 10) || 0,
        flags: decodeFlagString(flagsStr),
        flagObject: decodeFlagObject(flagsStr),
        isExported: (flagsStr || '').includes('e'),
        index: parseInt(String(c[0]).replace('c', ''), 10) || 0,
      };
    }).filter(Boolean);
  }

  // ============================================================
  // ПОСТРОЕНИЕ ОБРАТНЫХ ИНДЕКСОВ
  // ============================================================

  const indexMaps = {
    moduleIndexMap: {},
    functionIndexMap: {},
    constantIndexMap: {},
    fileIndexMap: {},
  };

  // moduleIndexMap: 1 → m1
  for (const module of result.modules) {
    indexMaps.moduleIndexMap[module.index] = module.id;
  }

  // functionIndexMap: 1 → fn1
  for (const fn of result.functions) {
    indexMaps.functionIndexMap[fn.index] = fn.id;
  }

  // constantIndexMap: 1 → c1
  for (const c of result.constants) {
    indexMaps.constantIndexMap[c.index] = c.id;
  }

  // fileIndexMap: 1 → f1
  for (const f of result.files) {
    indexMaps.fileIndexMap[f.index] = f.id;
  }

  // Карты для resolveId
  const maps = {
    moduleMap: {},
    fileMap: {},
    functionMap: {},
    constantMap: {},
  };

  for (const module of result.modules) {
    maps.moduleMap[module.id] = module.name;
  }

  for (const f of result.files) {
    maps.fileMap[f.id] = f.pathFull || f.path;
  }

  for (const fn of result.functions) {
    maps.functionMap[fn.id] = fn;
  }

  for (const c of result.constants) {
    maps.constantMap[c.id] = c;
  }

  /**
   * Разрешает ID в человекочитаемое имя
   */
  function resolveId(id, maps) {
    if (!id) return '';

    if (typeof id === 'number') {
      return String(id);
    }

    // Функция
    if (id.startsWith('fn')) {
      const fn = maps.functionMap[id];
      if (fn) return fn.name || id;
    }

    // Константа
    if (id.startsWith('c')) {
      const cn = maps.constantMap[id];
      if (cn) return cn.name || id;
    }

    // Модуль
    if (id.startsWith('m')) {
      const m = maps.moduleMap[id];
      if (m) return m || id;
    }

    // Файл
    if (id.startsWith('f')) {
      const f = maps.fileMap[id];
      if (f) return f || id;
    }

    return id;
  }

  // ============================================================
  // 6. ДЕКОДИРОВАНИЕ ГРАФА
  // ============================================================

  const graphData = data.gr || {};

  // ------------------------------------------------------------
  // 6.1. ВЫЗОВЫ (gr.c)
  // Формат: [fromIdx, toIdx, line, typeCode]
  // ------------------------------------------------------------

  if (graphData.c) {
    result.graph.calls = graphData.c.map((call) => {
      if (!Array.isArray(call) || call.length < 4) return null;

      const fromIdx = call[0];
      const toIdx = call[1];
      const line = call[2] || 0;
      const typeCode = call[3] || 'd';

      const fromId = indexMaps.functionIndexMap[fromIdx] || `fn${fromIdx}`;
      const toId = indexMaps.functionIndexMap[toIdx] || `fn${toIdx}`;

      return {
        from: fromId,
        fromName: resolveId(fromId, maps),
        to: toId,
        toName: resolveId(toId, maps),
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: decodeCallType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.2. ИМПОРТЫ (gr.i)
  // Формат: [fromFuncId, toFuncId, name, typeCode, fileId, line]
  // ------------------------------------------------------------

  if (graphData.i) {
    result.graph.imports = graphData.i.map((imp) => {
      if (!Array.isArray(imp) || imp.length < 4) return null;

      const fromId = imp[0];
      const toId = imp[1];
      const name = imp[2] || '';
      const typeCode = imp[3] || 'n';
      const fileIdRaw = imp[4] || '';
      const line = imp[5] || 0;

      return {
        from: fromId,
        fromName: resolveId(fromId, maps),
        to: toId,
        toName: resolveId(toId, maps),
        name,
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: decodeImportType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.3. ЭКСПОРТЫ ФУНКЦИЙ (gr.e)
  // Формат: [moduleIdx, funcIdx, line, typeCode, exportName, localName]
  // ------------------------------------------------------------

  if (graphData.e) {
    result.graph.exports = graphData.e.map((exp) => {
      if (!Array.isArray(exp) || exp.length < 6) return null;

      const moduleIdx = exp[0];
      const funcIdx = exp[1];
      const line = exp[2] || 0;
      const typeCode = exp[3] || 'ne';
      const exportName = exp[4] || '';
      const localName = exp[5] || '';

      const moduleId = indexMaps.moduleIndexMap[moduleIdx] || `m${moduleIdx}`;
      const funcId = indexMaps.functionIndexMap[funcIdx] || `fn${funcIdx}`;

      return {
        module: maps.moduleMap[moduleId] || moduleId,
        moduleId,
        from: funcId,
        fromName: resolveId(funcId, maps),
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: decodeExportType(typeCode),
        typeCode,
        exportName,
        localName,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.4. РЕЭКСПОРТЫ (gr.re)
  // Формат: [moduleIdx, funcIdx, source, name, line, type]
  // ------------------------------------------------------------

  if (graphData.re) {
    result.graph.reExports = graphData.re.map((re) => {
      if (!Array.isArray(re) || re.length < 4) return null;

      const moduleIdx = re[0];
      const funcIdx = re[1];
      const source = re[2] || '';
      const exportName = re[3] || '';
      const line = re[4] || 0;
      const typeCode = re[5] || 're-export';

      const moduleId = indexMaps.moduleIndexMap[moduleIdx] || `m${moduleIdx}`;
      const funcId = indexMaps.functionIndexMap[funcIdx] || `fn${funcIdx}`;

      return {
        module: maps.moduleMap[moduleId] || moduleId,
        moduleId,
        from: funcId,
        fromName: resolveId(funcId, maps),
        to: source,
        toName: source,
        path: source,
        exportName,
        localName: exportName,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: typeCode,
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.5. НАСЛЕДОВАНИЕ (gr.h)
  // Формат: [childId, parentId, typeCode, fileId, line]
  // ------------------------------------------------------------

  if (graphData.h) {
    result.graph.inheritance = graphData.h.map((inh) => {
      if (!Array.isArray(inh) || inh.length < 5) return null;

      const childId = inh[0];
      const parentId = inh[1];
      const typeCode = inh[2] || 'ex';
      const fileIdRaw = inh[3] || '';
      const line = inh[4] || 0;

      return {
        from: childId,
        fromName: resolveId(childId, maps),
        to: parentId,
        toName: resolveId(parentId, maps),
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: decodeInheritanceType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.6. ТИПОВЫЕ ЗАВИСИМОСТИ (gr.td)
  // Формат: [fromId, toId, typeCode, fileId, line]
  // ------------------------------------------------------------

  if (graphData.td) {
    result.graph.typeDeps = graphData.td.map((td) => {
      if (!Array.isArray(td) || td.length < 5) return null;

      const fromId = td[0];
      const toId = td[1];
      const typeCode = td[2] || 'tr';
      const fileIdRaw = td[3] || '';
      const line = td[4] || 0;

      return {
        from: fromId,
        fromName: resolveId(fromId, maps),
        to: toId,
        toName: resolveId(toId, maps),
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: decodeTypeDepType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.7. ИСПОЛЬЗОВАНИЕ КОНСТАНТ (gr.uc)
  // Формат: [fromFuncId, constId, fileId, line]
  // ------------------------------------------------------------

  if (graphData.uc) {
    result.graph.constUses = graphData.uc.map((uc) => {
      if (!Array.isArray(uc) || uc.length < 4) return null;

      const fromId = uc[0];
      const constId = uc[1];
      const fileIdRaw = uc[2];
      const line = uc[3];

      return {
        from: fromId,
        fromName: resolveId(fromId, maps),
        to: constId,
        toName: resolveId(constId, maps),
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.8. ЗАВИСИМОСТИ КОНСТАНТ (gr.cd)
  // Формат: [fromConstId, toConstId, fileId, line]
  // ------------------------------------------------------------

  if (graphData.cd) {
    result.graph.constDeps = graphData.cd.map((cd) => {
      if (!Array.isArray(cd) || cd.length < 4) return null;

      const fromId = cd[0];
      const toId = cd[1];
      const fileIdRaw = cd[2];
      const line = cd[3];

      return {
        from: fromId,
        fromName: resolveId(fromId, maps),
        to: toId,
        toName: resolveId(toId, maps),
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.9. ЭКСПОРТЫ КОНСТАНТ (gr.ce)
  // Формат: [moduleIdx, constIdx, constName, line, type]
  // ------------------------------------------------------------

  if (graphData.ce) {
    result.graph.constExports = graphData.ce.map((ce) => {
      if (!Array.isArray(ce) || ce.length < 4) return null;

      const moduleIdx = ce[0];
      const constIdx = ce[1];
      const constName = ce[2] || '';
      const line = ce[3] || 0;
      const typeCode = ce[4] || 'const-export';

      const moduleId = indexMaps.moduleIndexMap[moduleIdx] || `m${moduleIdx}`;
      const constId = indexMaps.constantIndexMap[constIdx] || `c${constIdx}`;

      // Ищем константу для fileId
      let file = '';
      let fileId = '';
      const c = result.constants.find((cn) => cn.id === constId);
      if (c) {
        file = maps.fileMap[c.fileId] || c.fileId;
        fileId = c.fileId;
      }

      return {
        module: maps.moduleMap[moduleId] || moduleId,
        moduleId,
        from: constId,
        fromName: constName,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: typeCode,
        typeCode,
        file,
        fileId,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.10. ДИНАМИЧЕСКИЕ ИМПОРТЫ (gr.di)
  // Формат: [fileId, line, path, type]
  // ------------------------------------------------------------

  if (graphData.di) {
    result.graph.dynamicImports = graphData.di.map((di) => {
      if (!Array.isArray(di) || di.length < 4) return null;

      const fileIdRaw = di[0];
      const line = di[1];
      const importPath = di[2] || '';
      const typeCode = di[3] || 'literal';

      return {
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        path: importPath,
        type: decodeDynamicImportType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.11. КОНФИГУРАЦИИ (gr.cfg)
  // Формат: [fileId, line, key, type]
  // ------------------------------------------------------------

  if (graphData.cfg) {
    result.graph.configRefs = graphData.cfg.map((cfg) => {
      if (!Array.isArray(cfg) || cfg.length < 4) return null;

      const fileIdRaw = cfg[0];
      const line = cfg[1];
      const key = cfg[2] || '';
      const typeCode = cfg[3] || 'unknown';

      return {
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        key,
        name: key,
        type: decodeConfigType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.12. ВНЕШНИЕ БИБЛИОТЕКИ (gr.ext)
  // Формат: [fileId, name, version, count, line]
  // ------------------------------------------------------------

  if (graphData.ext) {
    result.graph.externalLibs = graphData.ext.map((ext) => {
      if (!Array.isArray(ext) || ext.length < 4) return null;

      const fileIdRaw = ext[0];
      const name = ext[1] || '';
      const version = ext[2] || 'unknown';
      const count = ext[3] || 0;
      const line = ext[4] || 0;

      return {
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        name,
        version,
        count: typeof count === 'number' ? count : parseInt(count, 10) || 0,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.13. VUE ШАБЛОНЫ (gr.vt)
  // Формат: [fileId, line, name, type]
  // ------------------------------------------------------------

  if (graphData.vt) {
    result.graph.vueTemplates = graphData.vt.map((vt) => {
      if (!Array.isArray(vt) || vt.length < 4) return null;

      const fileIdRaw = vt[0];
      const line = vt[1];
      const name = vt[2] || '';
      const typeCode = vt[3] || 'static';

      return {
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        name,
        type: decodeVueTemplateType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.14. АСИНХРОННЫЕ ЦЕПОЧКИ (gr.async)
  // Формат: [funcId, awaitCount, chainLen, line]
  // ------------------------------------------------------------

  if (graphData.async) {
    result.graph.asyncChains = graphData.async.map((chain) => {
      if (!Array.isArray(chain) || chain.length < 4) return null;

      const funcId = chain[0];
      const awaitCount = chain[1] || 0;
      const chainLen = chain[2] || 0;
      const line = chain[3] || 0;

      return {
        from: funcId,
        fromName: resolveId(funcId, maps),
        awaitCount: typeof awaitCount === 'number' ? awaitCount : parseInt(awaitCount, 10) || 0,
        chainLength: typeof chainLen === 'number' ? chainLen : parseInt(chainLen, 10) || 0,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.15. ЗАМЫКАНИЯ (gr.closures)
  // Формат: [funcId, line, variables, count]
  // ------------------------------------------------------------

  if (graphData.closures) {
    result.graph.closures = graphData.closures.map((closure) => {
      if (!Array.isArray(closure) || closure.length < 4) return null;

      const funcId = closure[0];
      const line = closure[1] || 0;
      const variables = Array.isArray(closure[2]) ? closure[2] : [];
      const count = closure[3] || 0;

      return {
        from: funcId,
        fromName: resolveId(funcId, maps),
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        variables,
        count: typeof count === 'number' ? count : parseInt(count, 10) || 0,
      };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // 6.16. ТИПОВЫЕ ЗАВИСИМОСТИ (gr.types) — расширенные
  // ------------------------------------------------------------

  if (graphData.types) {
    result.graph.types = graphData.types.map((t) => {
      if (!Array.isArray(t) || t.length < 5) return null;

      const fromId = t[0];
      const toId = t[1];
      const typeCode = t[2] || 'tr';
      const fileIdRaw = t[3] || '';
      const line = t[4] || 0;

      return {
        from: fromId,
        fromName: resolveId(fromId, maps),
        to: toId,
        toName: resolveId(toId, maps),
        file: maps.fileMap[fileIdRaw] || fileIdRaw,
        fileId: fileIdRaw,
        line: typeof line === 'number' ? line : parseInt(line, 10) || 0,
        type: decodeTypeDepType(typeCode),
        typeCode,
      };
    }).filter(Boolean);
  }

  // ============================================================
  // 7. ФИНАЛЬНАЯ СТАТИСТИКА
  // ============================================================

  result.summary = {
    modulesCount: result.modules.length,
    filesCount: result.files.length,
    functionsCount: result.functions.length,
    constantsCount: result.constants.length,
    selfFunctionsCount: result.selfFunctions.length,
    callsCount: result.graph.calls.length,
    importsCount: result.graph.imports.length,
    exportsCount: result.graph.exports.length,
    reExportsCount: result.graph.reExports.length,
    inheritanceCount: result.graph.inheritance.length,
    typeDepsCount: result.graph.typeDeps.length,
    constUsesCount: result.graph.constUses.length,
    constDepsCount: result.graph.constDeps.length,
    constExportsCount: result.graph.constExports.length,
    dynamicImportsCount: result.graph.dynamicImports.length,
    configRefsCount: result.graph.configRefs.length,
    externalLibsCount: result.graph.externalLibs.length,
    vueTemplatesCount: result.graph.vueTemplates.length,
    asyncChainsCount: result.graph.asyncChains.length,
    closuresCount: result.graph.closures.length,
    unresolvedCount: result.unresolved.length,
  };

  return result;
}

// ============================================================
// CLI ИНТЕРФЕЙС
// ============================================================

/**
 * Загружает index.json и обрабатывает его
 * @param {string} inputPath - путь к index.json
 * @param {string} outputPath - путь для сохранения результата
 */
async function main(inputPath, outputPath) {
  console.log('════════════════════════════════════════════════════════════');
  console.log('📊 ОБРАБОТКА index.json');
  console.log('════════════════════════════════════════════════════════════');

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Файл не найден: ${inputPath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  // Данные могут быть вложены в `data.data` или быть на верхнем уровне
  const indexData = rawData.data || rawData;

  console.log(`📄 Входной файл: ${inputPath}`);
  console.log(`📄 Выходной файл: ${outputPath}`);
  console.log('');

  const processed = processData(indexData);

  if (!processed) {
    console.error('❌ Ошибка обработки данных');
    process.exit(1);
  }

  // Сохраняем результат
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2), 'utf-8');

  console.log('✅ Обработка завершена!');
  console.log('');
  console.log('📊 СТАТИСТИКА:');
  console.log(`   • Модулей: ${processed.summary.modulesCount}`);
  console.log(`   • Файлов: ${processed.summary.filesCount}`);
  console.log(`   • Функций: ${processed.summary.functionsCount}`);
  console.log(`   • Констант: ${processed.summary.constantsCount}`);
  console.log(`   • Self функций: ${processed.summary.selfFunctionsCount}`);
  console.log('');
  console.log('🔗 ГРАФ:');
  console.log(`   • Вызовов: ${processed.summary.callsCount}`);
  console.log(`   • Импортов: ${processed.summary.importsCount}`);
  console.log(`   • Экспортов: ${processed.summary.exportsCount}`);
  console.log(`   • Реэкспортов: ${processed.summary.reExportsCount}`);
  console.log(`   • Наследований: ${processed.summary.inheritanceCount}`);
  console.log(`   • Типовых зависимостей: ${processed.summary.typeDepsCount}`);
  console.log(`   • Использований констант: ${processed.summary.constUsesCount}`);
  console.log(`   • Зависимостей констант: ${processed.summary.constDepsCount}`);
  console.log(`   • Экспортов констант: ${processed.summary.constExportsCount}`);
  console.log(`   • Динамических импортов: ${processed.summary.dynamicImportsCount}`);
  console.log(`   • Конфигураций: ${processed.summary.configRefsCount}`);
  console.log(`   • Внешних библиотек: ${processed.summary.externalLibsCount}`);
  console.log(`   • Vue шаблонов: ${processed.summary.vueTemplatesCount}`);
  console.log(`   • Асинхронных цепочек: ${processed.summary.asyncChainsCount}`);
  console.log(`   • Замыканий: ${processed.summary.closuresCount}`);
  console.log(`   • Неразрешённых: ${processed.summary.unresolvedCount}`);
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
}

// ============================================================
// ТОЧКА ВХОДА
// ============================================================

const args = process.argv.slice(2);
const inputPath = args[0] || path.resolve(__dirname, 'index.json');
const outputPath = args[1] || path.resolve(__dirname, 'processed-data.json');

main(inputPath, outputPath).catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

// ============================================================
// ЭКСПОРТЫ ДЛЯ ИСПОЛЬЗОВАНИЯ КАК БИБЛИОТЕКИ
// ============================================================

export {
  processData,
  decodeFlagString,
  decodeFlagObject,
  decodeCallType,
  decodeImportType,
  decodeExportType,
  decodeInheritanceType,
  decodeTypeDepType,
  decodeDynamicImportType,
  decodeConfigType,
  decodeVueTemplateType,
  FLAG_CHAR_TO_BIT,
  FLAG_NAMES,
  CALL_TYPE_MAP,
  IMPORT_TYPE_MAP,
  EXPORT_TYPE_MAP,
  INHERITANCE_TYPE_MAP,
  TYPE_DEP_TYPE_MAP,
};

export default processData;
