// src/reporters/compact-reporter.ts
// ПОЛНАЯ ВЕРСИЯ - С ИСПРАВЛЕННЫМИ ЭКСПОРТАМИ

import type { EntitiesResult } from '../types.js';
import path from 'path';
import fs from 'fs';

// Импортируем анализаторы из отдельного модуля
import { analyzeContent } from '../analyzers/index.js';

// ============================================
// КОНСТАНТЫ
// ============================================

export const SHORT_KEYS = {
  functionIndex: 'fi',
  fileIndex: 'fl',
  moduleIndex: 'mi',
  functions: 'fns',
  constants: 'cn',
  files: 'fls',
  modules: 'mods',
  exports: 'exps',
  imports: 'imps',
  externalLibs: 'ext',
  stats: 'st',
  totalFunctions: 'tf',
  totalCalls: 'tc',
  totalModules: 'tm',
  totalFiles: 'tfils',
  totalImports: 'ti',
  totalExports: 'te',
  totalUnused: 'tun',
  totalReExports: 'tre',
  totalInheritance: 'tr',
  totalTypeDeps: 'ttd',
  totalConstants: 'tcn',
  totalConstExports: 'tce',
  totalConstUses: 'tuc',
  totalConstDeps: 'tcd',
  totalSelfFunctions: 'tsf',
  hasCycles: 'cy',
  timestamp: 'ts',
  version: 'v',
  root: 'r',
  asyncCount: 'async',
  avgCalls: 'avgCalls',
  maxCalls: 'maxCalls',
  isolated: 'isolated',
  funcsWithCalls: 'funcsWithCalls',
  calledFuncs: 'calledFuncs',
  modulesWithFunctions: 'modulesWithFunctions',
  filesWithFunctions: 'filesWithFunctions',
  exportedWithCalls: 'exportedWithCalls',
  defaultExports: 'defaultExports',
  typeExports: 'typeExports',
  typeImports: 'typeImports',
  dynamicImports: 'di',
  configRefs: 'cfg',
  externalLibsCount: 'ext',
  vueTemplates: 'vt',
  asyncChains: 'asyncChains',
  closures: 'closures',
  reflections: 'reflections',
  typeDeps: 'typeDeps',
};

export const FLAG_MAP = {
  '1': 'a', // async
  '2': 'e', // exported
  '4': 'm', // method
  '8': 'r', // arrow
  '16': 'v', // event
  '32': 'n', // nested
  '64': 's', // self (изолированная функция)
  '128': 'd', // dynamic import
  '256': 'c', // config
  '512': 'x', // external
  '1024': 't', // vue template
  '2048': 'a', // async chain
  '4096': 'l', // closure
  '8192': 'y', // type dependency
};

export const RELATION_TYPES = {
  direct: 'd',
  async: 'a',
  method: 'm',
  callback: 'c',
  named: 'n',
  default: 'df',
  namespace: 'ns',
  reExportImport: 'ri',
  typeOnly: 'to',
  sideEffect: 'se',
  namedExport: 'ne',
  defaultExport: 'de',
  reExportExport: 're',
  typeExport: 'te',
  extends: 'ex',
  implements: 'im',
  abstract: 'ab',
  parameter: 'p',
  return: 'r',
  annotation: 'an',
  generic: 'g',
  typeReference: 'tr',
  constValue: 'val',
  constEnum: 'enum',
  constConfig: 'config',
  dynamicImport: 'di',
  configReference: 'cfg',
  externalLib: 'ext',
  vueTemplate: 'vt',
  asyncChain: 'async',
  closure: 'closures',
  typeDependency: 'types',
  reflection: 'reflection',
};

// ============================================
// КЭШИРОВАНИЕ
// ============================================

interface CacheEntry {
  data: any;
  timestamp: number;
  hash: string;
}

class ReportCache {
  private cache = new Map<string, CacheEntry>();
  private TTL = 5 * 60 * 1000; // 5 минут

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: any): void {
    if (this.cache.size >= 100) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 20);
      for (const [k] of oldest) {
        this.cache.delete(k);
      }
    }
    const hash = this.generateHash(data);
    this.cache.set(key, { data, timestamp: Date.now(), hash });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { total: number; oldest: number; newest: number } {
    const entries = Array.from(this.cache.values());
    if (entries.length === 0) {
      return { total: 0, oldest: 0, newest: 0 };
    }
    const timestamps = entries.map(e => e.timestamp);
    return {
      total: entries.length,
      oldest: Math.min(...timestamps),
      newest: Math.max(...timestamps),
    };
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

export const reportCache = new ReportCache();

// ============================================
// СЖАТИЕ ДАННЫХ
// ============================================

function compressCalls(calls: any[]): any[] {
  if (!calls || calls.length === 0) return calls;
  return calls.map(call => {
    const compressed = [...call];
    if (typeof compressed[2] === 'number' && compressed[2] > 1000) {
      compressed[2] = compressed[2] - 1000;
    }
    return compressed;
  });
}

function compressPaths(data: any): any {
  if (!data) return data;
  if (data.fl && typeof data.fl === 'object') {
    const compressed: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.fl)) {
      const parts = (value as string).split('/');
      if (parts.length > 4) {
        const first = parts[0] || '';
        const lastTwo = parts.slice(-2);
        compressed[key] = first + '/.../' + lastTwo.join('/');
      } else {
        compressed[key] = value as string;
      }
    }
    data.fl = compressed;
  }
  return data;
}

// ============================================
// МИГРАЦИЯ ДАННЫХ
// ============================================

function migrateReport(data: any): any {
  const version = data.v || '4.0.0';
  if (version === '4.0.0' || version.startsWith('4.')) {
    if (!data.st) data.st = {};
    if (!data.st.tsf) data.st.tsf = 0;
    if (!data.st.di) data.st.di = 0;
    if (!data.st.cfg) data.st.cfg = 0;
    if (!data.st.ext) data.st.ext = 0;
    if (!data.st.vt) data.st.vt = 0;
    if (!data.st.asyncChains) data.st.asyncChains = 0;
    if (!data.st.closures) data.st.closures = 0;
    if (!data.st.typeDeps) data.st.typeDeps = 0;
    if (!data.gr) data.gr = {};
    if (!data.gr.di) data.gr.di = [];
    if (!data.gr.cfg) data.gr.cfg = [];
    if (!data.gr.ext) data.gr.ext = [];
    if (!data.gr.vt) data.gr.vt = [];
    if (!data.gr.async) data.gr.async = [];
    if (!data.gr.closures) data.gr.closures = [];
    if (!data.gr.types) data.gr.types = [];
    data.v = '5.1.0';
  }
  return data;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function encodeFlags(func: any): string {
  let flags = 0;
  if (func.isAsync) flags |= 1;
  if (func.isExported) flags |= 2;
  if (func.isMethod) flags |= 4;
  if (func.isArrow) flags |= 8;
  if (func.isEventHandler) flags |= 16;
  if (func.isNested) flags |= 32;
  if (func.isSelf) flags |= 64;
  if (func.isDynamic) flags |= 128;
  if (func.isConfig) flags |= 256;
  if (func.isExternal) flags |= 512;
  if (func.isVueTemplate) flags |= 1024;
  if (func.isAsyncChain) flags |= 2048;
  if (func.isClosure) flags |= 4096;
  if (func.isTypeDep) flags |= 8192;
  if (flags === 0) return '0';
  let result = '';
  for (const [bit, char] of Object.entries(FLAG_MAP)) {
    if (flags & parseInt(bit, 10)) {
      result += char;
    }
  }
  return result || '0';
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

export function generateCompactReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath?: string,
  options: {
    useBitFlags?: boolean;
    useDictionaries?: boolean;
    readableKeys?: boolean;
    useTemplates?: boolean;
    maxDepth?: number;
    includeRelations?: boolean;
    includeStats?: boolean;
    includeTypes?: boolean;
    includeInheritance?: boolean;
    includeExports?: boolean;
    includeConstants?: boolean;
    includeSelfFunctions?: boolean;
    includeDynamicImports?: boolean;
    includeConfigRefs?: boolean;
    includeExternalLibs?: boolean;
    includeVueTemplates?: boolean;
    includeAsyncChains?: boolean;
    includeClosures?: boolean;
    includeTypeDeps?: boolean;
    useCompression?: boolean;
    useCaching?: boolean;
  } = {}
): any {
  console.log('\n🚀 Генерация ОПТИМИЗИРОВАННОГО компактного отчета...');
  const startTime = Date.now();

  const {
    includeRelations = true,
    includeStats = true,
    includeTypes = true,
    includeInheritance = true,
    includeExports = true,
    includeConstants = true,
    includeSelfFunctions = true,
    includeDynamicImports = true,
    includeConfigRefs = true,
    includeExternalLibs = true,
    includeVueTemplates = true,
    includeAsyncChains = true,
    includeClosures = true,
    includeTypeDeps = true,
    useCompression = true,
    useCaching = true,
  } = options;

  // Проверяем кэш
  const cacheKey = outputPath ? `${outputPath}:${JSON.stringify(options)}` : null;
  if (useCaching && cacheKey) {
    const cached = reportCache.get(cacheKey);
    if (cached) {
      console.log('📦 Использован кэшированный отчет');
      return cached;
    }
  }

  // Проверка наличия Vue файлов
  let hasVueFiles = false;
  let vueFilesCount = 0;
  for (const filePath of Object.keys(entitiesMap)) {
    if (filePath.endsWith('.vue')) {
      hasVueFiles = true;
      vueFilesCount++;
    }
  }

  if (!hasVueFiles) {
    console.log('ℹ️ Vue файлы не найдены в проекте, пропускаем анализ Vue шаблонов');
  } else {
    console.log(`📦 Найдено Vue файлов: ${vueFilesCount}`);
  }

  // ============================================
  // 1. СБОР ДАННЫХ
  // ============================================

  const moduleIndex: Record<string, string> = {};
  const fileIndex: Record<string, string> = {};
  const functions: any[] = [];
  const constants: any[] = [];
  const selfFunctions: any[] = [];

  // Все типы связей в одном месте
  const relations = {
    calls: [] as any[],
    imports: [] as any[],
    exports: [] as any[],
    inheritance: [] as any[],
    typeDeps: [] as any[],
    reExports: [] as any[],
    constUses: [] as any[],
    constDeps: [] as any[],
    constExports: [] as any[],
    dynamicImports: [] as any[],
    configRefs: [] as any[],
    externalLibs: [] as any[],
    vueTemplates: [] as any[],
    asyncChains: [] as any[],
    closures: [] as any[],
    reflections: [] as any[],
  };

  // Вспомогательные Map
  const moduleMap = new Map<string, string>();
  const fileMap = new Map<string, string>();
  const funcMap = new Map<string, string>();
  const constMap = new Map<string, string>();
  const nameToFuncId = new Map<string, string>();
  const nameToConstId = new Map<string, string>();

  const funcDataMap = new Map<
    string,
    { name: string; fileId: string; line: number; calls: string[]; calledBy: string[] }
  >();

  let moduleCounter = 0;
  let fileCounter = 0;
  let functionCounter = 0;
  let constantCounter = 0;
  let selfFunctionCounter = 0;

  // ============================================
  // 2. ПЕРВЫЙ ПРОХОД: ИНДЕКСЫ И ФУНКЦИИ
  // ============================================

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    let moduleId = moduleMap.get(dirName);
    if (!moduleId) {
      moduleCounter++;
      moduleId = `m${moduleCounter}`;
      moduleMap.set(dirName, moduleId);
      moduleIndex[moduleId] = dirName;
    }

    let fileId = fileMap.get(filePath);
    if (!fileId) {
      fileCounter++;
      fileId = `f${fileCounter}`;
      fileMap.set(filePath, fileId);
      fileIndex[fileId] = filePath;
    }

    // Функции
    const funcs = entities.functions || [];
    for (const func of funcs) {
      if (!func || !func.name) continue;

      const funcKey = `${moduleId}:${fileId}:${func.name}`;
      let funcId = funcMap.get(funcKey);

      if (!funcId) {
        functionCounter++;
        funcId = `fn${functionCounter}`;
        funcMap.set(funcKey, funcId);
        nameToFuncId.set(func.name, funcId);

        const flags = encodeFlags(func);

        functions.push([funcId, func.name, moduleId, fileId, func.line || 0, flags]);

        funcDataMap.set(func.name, {
          name: func.name,
          fileId,
          line: func.line || 0,
          calls: func.calls || [],
          calledBy: func.calledBy || [],
        });
      }
    }

    // Константы
    if (includeConstants) {
      const consts = entities.constants || [];
      for (const constItem of consts) {
        if (!constItem || !constItem.name) continue;

        const constKey = `${moduleId}:${fileId}:const:${constItem.name}`;
        let constId = constMap.get(constKey);

        if (!constId) {
          constantCounter++;
          constId = `c${constantCounter}`;
          constMap.set(constKey, constId);
          nameToConstId.set(constItem.name, constId);

          const flags = constItem.isExported ? 'e' : '';

          constants.push([
            constId,
            constItem.name,
            constItem.value ?? null,
            moduleId,
            fileId,
            constItem.line || 0,
            flags,
          ]);
        }
      }
    }
  }

  // ============================================
  // 3. ОПРЕДЕЛЕНИЕ SELF FUNCTIONS
  // ============================================

  if (includeSelfFunctions) {
    for (const [name, data] of funcDataMap) {
      const hasCalls = data.calls && data.calls.length > 0;
      const hasCalledBy = data.calledBy && data.calledBy.length > 0;

      if (!hasCalls && !hasCalledBy) {
        selfFunctionCounter++;
        const selfId = `sf${selfFunctionCounter}`;
        selfFunctions.push([selfId, name, data.fileId, data.line]);
      }
    }
  }

  // ============================================
  // 4. ВТОРОЙ ПРОХОД: ВСЕ ТИПЫ СВЯЗЕЙ
  // ============================================

  const funcNameToId = new Map<string, string>();
  for (const func of functions) {
    funcNameToId.set(func[1], func[0]);
  }

  const constNameToId = new Map<string, string>();
  for (const constItem of constants) {
    constNameToId.set(constItem[1], constItem[0]);
  }

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const moduleId = moduleMap.get(dirName)!;
    const fileId = fileMap.get(filePath)!;

    // 4.1 ВЫЗОВЫ (calls)
    const funcs = entities.functions || [];
    for (const func of funcs) {
      if (!func || !func.name) continue;

      const fromId = nameToFuncId.get(func.name);
      if (!fromId) continue;

      const fromIdx = parseInt(fromId.replace('fn', ''), 10);

      const calls = func.calls || [];
      for (const call of calls) {
        if (!call) continue;
        const toId = nameToFuncId.get(call);
        if (toId) {
          const toIdx = parseInt(toId.replace('fn', ''), 10);
          let callType = 'd';
          if (func.isAsync) callType = 'a';
          if (func.isMethod) callType = 'm';
          if (func.isEventHandler) callType = 'c';

          relations.calls.push([fromIdx, toIdx, func.line || 0, callType]);
        }
      }
    }

    // 4.2 ИМПОРТЫ (imports)
    const imports = entities.imports || [];
    for (const imp of imports) {
      if (!imp || !imp.source) continue;

      const specifiers = imp.specifiers || [];
      for (const spec of specifiers) {
        if (!spec) continue;

        let importedName: string;
        if (typeof spec === 'string') {
          importedName = spec;
        } else if (spec && typeof spec === 'object' && 'imported' in spec) {
          importedName = spec.imported || spec.local || '';
        } else {
          continue;
        }

        if (!importedName) continue;

        const toFuncId = nameToFuncId.get(importedName);
        if (!toFuncId) continue;

        const firstFunc = funcs[0];
        if (!firstFunc || !firstFunc.name) continue;

        const fromFuncId = nameToFuncId.get(firstFunc.name);
        if (!fromFuncId) continue;

        let importType = 'n';
        if (typeof spec === 'string') {
          if (spec === 'default') importType = 'df';
          else if (spec === '*') importType = 'ns';
        } else if (spec && typeof spec === 'object' && 'imported' in spec) {
          if (spec.imported === 'default') importType = 'df';
          else if (spec.imported === '*') importType = 'ns';
        }
        if (imp.isTypeOnly) {
          importType = 'to';
        }

        relations.imports.push([
          fromFuncId,
          toFuncId,
          importedName,
          importType,
          fileId,
          imp.loc?.start?.line || 0,
        ]);
      }
    }

    // 4.3 ЭКСПОРТЫ (exports)
    if (includeExports) {
      const exports = entities.exports || [];
      for (const exp of exports) {
        if (!exp) continue;

        const expName = exp.name || 'default';
        const isDefault = exp.isDefault || false;
        const isReExport = exp.isReExport || false;

        let funcId: string | undefined;
        let funcIdx = -1;

        const expFunc = funcs.find(f => f && f.name === expName);
        if (expFunc) {
          funcId = nameToFuncId.get(expName);
          if (funcId) {
            funcIdx = parseInt(funcId.replace('fn', ''), 10);
          }
        }

        if (funcIdx === -1 && includeConstants) {
          const consts = entities.constants || [];
          const constItem = consts.find(c => c && c.name === expName);
          if (constItem) {
            const constId = nameToConstId.get(expName);
            if (constId) {
              let exportType = 'ne';
              if (isDefault) exportType = 'de';
              else if (isReExport) exportType = 're';

              relations.constExports.push([
                constId,
                expName,
                exportType,
                fileId,
                constItem.line || 0,
              ]);
              continue;
            }
          }
        }

        if (funcIdx !== -1) {
          let exportType = 'ne';
          if (isDefault) exportType = 'de';
          else if (isReExport) exportType = 're';

          relations.exports.push([
            moduleId,
            funcIdx,
            exp.loc?.start?.line || 0,
            exportType,
            expName,
            expName,
          ]);
        }
      }
    }

    // 4.4 НАСЛЕДОВАНИЕ (inheritance)
    if (includeInheritance) {
      const classes = entities.classes || [];
      for (const cls of classes) {
        if (!cls || !cls.name) continue;

        const childId = nameToFuncId.get(cls.name);
        if (!childId) continue;

        if (cls.extends) {
          const parentId = nameToFuncId.get(cls.extends);
          if (parentId) {
            relations.inheritance.push([childId, parentId, 'ex', fileId, cls.line || 0]);
          }
        }

        const implements_ = cls.implements || [];
        for (const impl of implements_) {
          if (!impl) continue;
          const parentId = nameToFuncId.get(impl);
          if (parentId) {
            relations.inheritance.push([childId, parentId, 'im', fileId, cls.line || 0]);
          }
        }
      }

      const interfaces = entities.interfaces || [];
      for (const intf of interfaces) {
        if (!intf || !intf.name) continue;

        const childId = nameToFuncId.get(intf.name);
        if (!childId) continue;

        const extends_ = intf.extends || [];
        for (const ext of extends_) {
          if (!ext) continue;
          const parentId = nameToFuncId.get(ext);
          if (parentId) {
            relations.inheritance.push([childId, parentId, 'ex', fileId, intf.line || 0]);
          }
        }
      }
    }

    // 4.5 ТИПОВЫЕ ЗАВИСИМОСТИ (typeDeps)
    if (includeTypes) {
      for (const func of funcs) {
        if (!func || !func.name) continue;

        const fromId = nameToFuncId.get(func.name);
        if (!fromId) continue;

        const params = func.params || [];
        for (const param of params) {
          if (!param) continue;
          const toId = nameToFuncId.get(param);
          if (toId) {
            relations.typeDeps.push([fromId, toId, 'p', fileId, func.line || 0]);
          }
        }

        if (func.returnType) {
          const toId = nameToFuncId.get(func.returnType);
          if (toId) {
            relations.typeDeps.push([fromId, toId, 'r', fileId, func.line || 0]);
          }
        }
      }

      const interfaces = entities.interfaces || [];
      for (const intf of interfaces) {
        if (!intf || !intf.name) continue;

        const fromId = nameToFuncId.get(intf.name);
        if (!fromId) continue;

        const extends_ = intf.extends || [];
        for (const ext of extends_) {
          if (!ext) continue;
          const toId = nameToFuncId.get(ext);
          if (toId) {
            relations.typeDeps.push([fromId, toId, 'tr', fileId, intf.line || 0]);
          }
        }
      }
    }

    // 4.6 RE-EXPORTS
    const exports = entities.exports || [];
    for (const exp of exports) {
      if (!exp || !exp.name) continue;

      const isReExport = exp.isReExport === true || exp.source !== undefined;
      if (!isReExport) continue;

      const fromId = nameToFuncId.get(exp.name);
      if (!fromId) continue;

      let originalName = exp.name;
      let toId: string | undefined;
      let found = false;

      const imports = entities.imports || [];
      for (const imp of imports) {
        if (!imp) continue;
        const specifiers = imp.specifiers || [];
        for (const spec of specifiers) {
          if (!spec) continue;
          let specName: string;
          if (typeof spec === 'string') {
            specName = spec;
          } else if (spec && typeof spec === 'object' && 'imported' in spec) {
            specName = spec.imported || spec.local || '';
          } else {
            continue;
          }
          if (!specName) continue;

          if (specName === exp.name) {
            toId = nameToFuncId.get(specName);
            if (toId) {
              originalName = specName;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }

      if (!found) {
        for (const [otherPath, otherEntities] of Object.entries(entitiesMap)) {
          if (otherPath === filePath || !otherEntities) continue;
          const otherFuncs = otherEntities.functions || [];
          for (const otherFunc of otherFuncs) {
            if (otherFunc && otherFunc.name === exp.name && otherFunc.isExported) {
              toId = nameToFuncId.get(exp.name);
              if (toId) {
                originalName = exp.name;
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
      }

      if (toId) {
        relations.reExports.push([fromId, toId, originalName, fileId, exp.loc?.start?.line || 0]);
      }
    }

    // 4.7 ИСПОЛЬЗОВАНИЕ КОНСТАНТ (constUses)
    if (includeConstants) {
      for (const func of funcs) {
        if (!func || !func.name) continue;

        const fromId = nameToFuncId.get(func.name);
        if (!fromId) continue;

        const body = func.body || '';
        const consts = entities.constants || [];
        for (const constItem of consts) {
          if (!constItem || !constItem.name) continue;

          const constId = nameToConstId.get(constItem.name);
          if (!constId) continue;

          if (body.includes(constItem.name)) {
            relations.constUses.push([fromId, constId, fileId, func.line || 0]);
          }
        }
      }
    }

    // 4.8 ЗАВИСИМОСТИ КОНСТАНТ (constDeps)
    if (includeConstants) {
      const consts = entities.constants || [];
      for (const constItem of consts) {
        if (!constItem || !constItem.name) continue;

        const fromId = nameToConstId.get(constItem.name);
        if (!fromId) continue;

        const value = constItem.value;
        const strValue =
          typeof value === 'string'
            ? value
            : typeof value === 'number'
              ? String(value)
              : typeof value === 'boolean'
                ? String(value)
                : value !== null && value !== undefined
                  ? JSON.stringify(value)
                  : '';

        for (const otherConst of consts) {
          if (!otherConst || otherConst.name === constItem.name || !otherConst.name) continue;

          if (strValue.includes(otherConst.name)) {
            const toId = nameToConstId.get(otherConst.name);
            if (toId) {
              const exists = relations.constDeps.some(dep => dep[0] === fromId && dep[1] === toId);
              if (!exists) {
                relations.constDeps.push([fromId, toId, fileId, constItem.line || 0]);
              }
            }
          }
        }
      }
    }

    // ============================================
    // 4.9 НОВЫЕ ТИПЫ СВЯЗЕЙ - ИНТЕГРАЦИЯ analyzeContent
    // ============================================

    // Получаем содержимое файла для анализа
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      // Игнорируем ошибки чтения
    }

    if (content) {
      // Используем analyzeContent для всех анализаторов
      const analysis = analyzeContent(content, filePath, {
        includeDynamicImports,
        includeConfigRefs,
        includeExternalLibs,
        includeVueTemplates,
        includeAsyncChains,
        includeClosures,
        includeTypeDeps,
      });

      // 4.9.1 ДИНАМИЧЕСКИЕ ИМПОРТЫ (dynamicImports)
      for (const di of analysis.dynamicImports) {
        relations.dynamicImports.push([fileId, di.line, di.path, di.type]);
      }

      // 4.9.2 КОНФИГУРАЦИИ (configRefs)
      for (const cfg of analysis.configRefs) {
        relations.configRefs.push([fileId, cfg.line, cfg.name, cfg.type]);
      }

      // 4.9.3 ВНЕШНИЕ БИБЛИОТЕКИ (externalLibs)
      for (const lib of analysis.externalLibs) {
        relations.externalLibs.push([fileId, lib.name, lib.version, lib.count, 0]);
      }

      // 4.9.4 VUE ШАБЛОНЫ (vueTemplates)
      if (includeVueTemplates && hasVueFiles && filePath.endsWith('.vue')) {
        for (const vt of analysis.vueTemplates) {
          relations.vueTemplates.push([fileId, vt.line, vt.name, vt.type]);
        }
      }

      // 4.9.5 АСИНХРОННЫЕ ЦЕПОЧКИ (asyncChains)
      for (const chain of analysis.asyncChains) {
        let funcId = null;

        // 1. Пытаемся найти по точному имени
        if (chain.name && chain.name !== 'anonymous' && chain.name !== 'iife') {
          funcId = nameToFuncId.get(chain.name);
        }

        // 2. Если не нашли, ищем по цепочке вызовов
        if (!funcId && chain.chain && chain.chain.length > 0) {
          for (const calledName of chain.chain) {
            const found = nameToFuncId.get(calledName);
            if (found) {
              funcId = found;
              break;
            }
          }
        }

        // 3. Если все еще не нашли, ищем по приблизительному совпадению
        if (!funcId && chain.line) {
          for (const [funcName, id] of nameToFuncId) {
            if (chain.body && chain.body.includes(funcName)) {
              funcId = id;
              break;
            }
          }
        }

        if (funcId) {
          relations.asyncChains.push([
            funcId,
            chain.awaitCount || 0,
            chain.chain?.length || 0,
            chain.line || 0,
          ]);
        }
      }

      // 4.9.6 ЗАМЫКАНИЯ (closures)
      for (const closure of analysis.closures) {
        let funcId = null;

        // 1. Ищем по имени
        if (closure.name && closure.name !== 'anonymous' && closure.name !== 'iife') {
          funcId = nameToFuncId.get(closure.name);
        }

        // 2. Если не нашли, ищем по строке
        if (!funcId && closure.line) {
          for (const [funcName, id] of nameToFuncId) {
            // Проверяем, содержит ли тело функции переменные из замыкания
            const funcData = funcDataMap.get(funcName);
            if (funcData) {
              // Проверяем, есть ли совпадение по строке
              if (Math.abs(funcData.line - closure.line) < 10) {
                funcId = id;
                break;
              }
            }
          }
        }

        if (funcId) {
          relations.closures.push([
            funcId,
            closure.line || 0,
            closure.variables?.slice(0, 5) || [],
            closure.count || 0,
          ]);
        }
      }

      // 4.9.7 ТИПОВЫЕ ЗАВИСИМОСТИ (typeDeps) - расширенный анализ
      for (const dep of analysis.typeDeps) {
        const fromId = nameToFuncId.get(dep.name);
        if (fromId && dep.extends) {
          for (const ext of dep.extends) {
            const toId = nameToFuncId.get(ext);
            if (toId) {
              relations.typeDeps.push([fromId, toId, 'ex', fileId, dep.line]);
            }
          }
        }
      }
    }
  }

  // ============================================
  // 5. СТАТИСТИКА
  // ============================================

  const totalFunctions = functions.length;
  const totalConstants = constants.length;
  const totalSelfFunctions = selfFunctions.length;
  const totalCalls = relations.calls.length;
  const totalModules = moduleCounter;
  const totalFiles = fileCounter;

  const asyncFuncs = functions.filter(f => f[5] && f[5].includes('a')).length;

  const funcsWithCalls = new Set<number>();
  const calledFuncs = new Set<number>();
  for (const call of relations.calls) {
    funcsWithCalls.add(call[0]);
    calledFuncs.add(call[1]);
  }

  const isolated = functions.filter((_, idx) => {
    const funcIdx = idx + 1;
    return !funcsWithCalls.has(funcIdx) && !calledFuncs.has(funcIdx);
  }).length;

  let avgCalls = 0;
  let maxCalls = 0;
  if (totalFunctions > 0) {
    const callCounts = new Map<number, number>();
    for (const call of relations.calls) {
      const fromIdx = call[0];
      callCounts.set(fromIdx, (callCounts.get(fromIdx) || 0) + 1);
    }
    const counts = Array.from(callCounts.values());
    if (counts.length > 0) {
      avgCalls = Number((counts.reduce((a, b) => a + b, 0) / totalFunctions).toFixed(2));
      maxCalls = Math.max(...counts);
    }
  }

  const stats = includeStats
    ? {
      tf: totalFunctions,
      tc: totalCalls,
      tm: totalModules,
      tfils: totalFiles,
      te: (relations.exports || []).length + (relations.constExports || []).length,
      tun: isolated,
      async: asyncFuncs,
      cy: false,
      avgCalls: avgCalls,
      maxCalls: maxCalls,
      tcn: totalConstants,
      tce: (relations.constExports || []).length,
      tuc: (relations.constUses || []).length,
      tcd: (relations.constDeps || []).length,
      tr: (relations.inheritance || []).length,
      ttd: (relations.typeDeps || []).length,
      tre: (relations.reExports || []).length,
      ti: (relations.imports || []).length,
      tsf: totalSelfFunctions,
      funcsWithCalls: funcsWithCalls.size,
      calledFuncs: calledFuncs.size,
      modulesWithFunctions: new Set(functions.map(f => f[2])).size,
      filesWithFunctions: new Set(functions.map(f => f[3])).size,
      exportedWithCalls: 0,
      defaultExports: 0,
      typeExports: 0,
      typeImports: 0,
      // НОВЫЕ СТАТИСТИКИ
      di: relations.dynamicImports.length,
      cfg: relations.configRefs.length,
      ext: relations.externalLibs.length,
      vt: relations.vueTemplates.length,
      asyncChains: relations.asyncChains.length,
      closures: relations.closures.length,
      reflections: relations.reflections.length,
      typeDeps: relations.typeDeps.length,
    }
    : undefined;

  // ============================================
  // 6. ФОРМИРОВАНИЕ ОТЧЕТА
  // ============================================

  const report: any = {
    v: '5.1.0-optimized',
    ts: new Date().toISOString(),
    r: 'm1',
  };

  report.mi = moduleIndex;
  report.fl = fileIndex;
  report.fns = functions;

  if (includeSelfFunctions && selfFunctions.length > 0) {
    report.sf = selfFunctions;
  }

  if (includeConstants && constants.length > 0) {
    report.cn = constants;
  }

  if (includeRelations) {
    report.gr = {
      c: useCompression ? compressCalls(relations.calls || []) : relations.calls || [],
      i: relations.imports || [],
      e: relations.exports || [],
      h: relations.inheritance || [],
      td: relations.typeDeps || [],
      re: relations.reExports || [],
      uc: relations.constUses || [],
      cd: relations.constDeps || [],
      ce: relations.constExports || [],
      // НОВЫЕ СВЯЗИ - с данными!
      di: relations.dynamicImports || [],
      cfg: relations.configRefs || [],
      ext: relations.externalLibs || [],
      vt: relations.vueTemplates || [],
      async: relations.asyncChains || [],
      closures: relations.closures || [],
      reflection: relations.reflections || [],
      types: relations.typeDeps || [],
    };
  } else {
    report.graph = useCompression ? compressCalls(relations.calls || []) : relations.calls || [];
  }

  if (stats) {
    report.st = stats;
  }

  if (functions.some(f => f[5] && f[5] !== '0')) {
    report.flg = FLAG_MAP;
  }

  if (includeRelations) {
    report.legend = {
      callTypes: {
        d: 'direct',
        a: 'async',
        m: 'method',
        c: 'callback',
        di: 'dynamic-import',
      },
      importTypes: {
        n: 'named',
        df: 'default',
        ns: 'namespace',
        ri: 're-export',
        to: 'type-only',
        se: 'side-effect',
      },
      exportTypes: {
        ne: 'named-export',
        de: 'default-export',
        re: 're-export',
        te: 'type-export',
      },
      inheritanceTypes: {
        ex: 'extends',
        im: 'implements',
        ab: 'abstract',
      },
      typeDependencyTypes: {
        p: 'parameter',
        r: 'return',
        an: 'annotation',
        g: 'generic',
        tr: 'type-reference',
      },
      constantTypes: {
        val: 'value',
        enum: 'enum',
        config: 'config',
      },
      dynamicImportTypes: {
        literal: 'literal',
        template: 'template-literal',
        concat: 'concatenation',
      },
      configTypes: {
        env: 'environment-variable',
        file: 'config-file',
        variable: 'config-variable',
      },
      vueTemplateTypes: {
        component: 'component',
        directive: 'directive',
      },
    };
  }

  if (useCompression) {
    compressPaths(report);
  }

  const migrated = migrateReport(report);

  if (useCaching && cacheKey) {
    reportCache.set(cacheKey, migrated);
  }

  // ============================================
  // 7. СОХРАНЕНИЕ И ВЫВОД
  // ============================================

  if (outputPath) {
    const json = JSON.stringify(migrated, null, 2);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, json);

    const sizeKB = (json.length / 1024).toFixed(2);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Оптимизированный отчет сохранен: ${outputPath}`);
    console.log(`📊 Размер: ${sizeKB} KB`);
    console.log(`\n📊 СТАТИСТИКА:`);
    console.log(`   📌 Функций: ${totalFunctions}`);
    console.log(`   📌 Self функций: ${totalSelfFunctions}`);
    console.log(`   📌 Констант: ${totalConstants}`);
    console.log(`   📌 Вызовов: ${relations.calls.length}`);
    console.log(`   📌 Импортов: ${relations.imports.length}`);
    console.log(`   📌 Экспортов: ${relations.exports.length + relations.constExports.length}`);
    console.log(`   📌 Наследований: ${relations.inheritance.length}`);
    console.log(`   📌 Типовых зависимостей: ${relations.typeDeps.length}`);
    console.log(`   📌 Re-экспортов: ${relations.reExports.length}`);
    console.log(`   📌 Использований констант: ${relations.constUses.length}`);
    console.log(`   📌 Зависимостей констант: ${relations.constDeps.length}`);
    console.log(`   📌 Экспортов констант: ${relations.constExports.length}`);
    console.log(`   📌 Модулей: ${moduleCounter}`);
    console.log(`   📌 Файлов: ${fileCounter}`);

    console.log(`\n📊 НОВЫЕ ТИПЫ СВЯЗЕЙ (интегрированы!):`);
    console.log(`   📌 Динамических импортов: ${relations.dynamicImports.length}`);
    console.log(`   📌 Конфигураций: ${relations.configRefs.length}`);
    console.log(`   📌 Внешних библиотек: ${relations.externalLibs.length}`);
    console.log(
      `   📌 Vue шаблонов: ${relations.vueTemplates.length} ${!hasVueFiles ? '(Vue файлы не найдены)' : ''}`
    );
    console.log(`   📌 Асинхронных цепочек: ${relations.asyncChains.length}`);
    console.log(`   📌 Замыканий: ${relations.closures.length}`);
    console.log(`   📌 Типовых зависимостей: ${relations.typeDeps.length}`);

    // Детали асинхронных цепочек
    if (relations.asyncChains.length > 0) {
      console.log(`\n⚡ Детали асинхронных цепочек:`);
      const asyncChainDetails = relations.asyncChains.slice(0, 5);
      for (const chain of asyncChainDetails) {
        const funcId = chain[0];
        const awaitCount = chain[1];
        const chainLength = chain[2];
        const line = chain[3];
        let funcName = 'unknown';
        for (const [name, id] of nameToFuncId) {
          if (id === funcId) {
            funcName = name;
            break;
          }
        }
        console.log(
          `   • ${funcName} (строка ${line}): ${awaitCount} await, ${chainLength} вызовов в цепочке`
        );
      }
      if (relations.asyncChains.length > 5) {
        console.log(`   ... и ещё ${relations.asyncChains.length - 5} цепочек`);
      }
    }

    // Детали замыканий
    if (relations.closures.length > 0) {
      console.log(`\n🔒 Детали замыканий:`);
      const closureDetails = relations.closures.slice(0, 5);
      for (const closure of closureDetails) {
        const funcId = closure[0];
        const line = closure[1];
        const variables = closure[2];
        const count = closure[3];
        let funcName = 'unknown';
        for (const [name, id] of nameToFuncId) {
          if (id === funcId) {
            funcName = name;
            break;
          }
        }
        console.log(
          `   • ${funcName} (строка ${line}): ${count} внешних переменных (${variables.join(', ')})`
        );
      }
      if (relations.closures.length > 5) {
        console.log(`   ... и ещё ${relations.closures.length - 5} замыканий`);
      }
    }

    console.log(`   ⏱️  Время: ${duration} сек`);

    console.log(`\n💡 СТРУКТУРА ОТЧЕТА (оптимизированная):`);
    console.log(`   📌 Индексы: mi, fl`);
    console.log(`   📌 Функции: fns (компактные массивы)`);
    console.log(`   📌 Self функции: sf (изолированные функции) ✅ НОВОЕ`);
    console.log(`   📌 Константы: cn`);
    console.log(`   📌 Связи: gr {`);
    console.log(`      • c  - вызовы (calls)`);
    console.log(`      • i  - импорты (imports)`);
    console.log(`      • e  - экспорты (exports)`);
    console.log(`      • h  - наследование (inheritance)`);
    console.log(`      • td - типовые зависимости (typeDeps)`);
    console.log(`      • re - re-экспорты (reExports)`);
    console.log(`      • uc - использование констант (constUses)`);
    console.log(`      • cd - зависимости констант (constDeps)`);
    console.log(`      • ce - экспорты констант (constExports)`);
    console.log(`      • di - динамические импорты (dynamicImports) ✅ ИНТЕГРИРОВАНО!`);
    console.log(`      • cfg - конфигурации (configRefs) ✅ ИНТЕГРИРОВАНО!`);
    console.log(`      • ext - внешние библиотеки (externalLibs) ✅ ИНТЕГРИРОВАНО!`);
    console.log(`      • vt - Vue шаблоны (vueTemplates) ✅ ИНТЕГРИРОВАНО!`);
    console.log(`      • async - асинхронные цепочки (asyncChains) ✅ ИНТЕГРИРОВАНО!`);
    console.log(`      • closures - замыкания (closures) ✅ ИНТЕГРИРОВАНО!`);
    console.log(`      • types - типовые зависимости (typeDeps) ✅ ИНТЕГРИРОВАНО!`);
    console.log(`   }`);
    console.log(`   📌 Статистика: st (расширенная) ✅ НОВОЕ`);
    console.log(`   📌 Легенда: legend (расширенная) ✅ НОВОЕ`);
  }

  return migrated;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОИСКА
// ============================================

export function findFunctionByName(report: any, name: string): any | null {
  if (!report.fns) return null;
  for (const func of report.fns) {
    if (func[1] === name) {
      return {
        id: func[0],
        name: func[1],
        module: func[2],
        file: func[3],
        line: func[4],
        flags: func[5] || '0',
      };
    }
  }
  return null;
}

export function findSelfFunctionByName(report: any, name: string): any | null {
  if (!report.sf) return null;
  for (const sf of report.sf) {
    if (sf[1] === name) {
      return {
        id: sf[0],
        name: sf[1],
        file: sf[2],
        line: sf[3],
      };
    }
  }
  return null;
}

export function findConstantByName(report: any, name: string): any | null {
  if (!report.cn) return null;
  for (const constItem of report.cn) {
    if (constItem[1] === name) {
      return {
        id: constItem[0],
        name: constItem[1],
        value: constItem[2],
        module: constItem[3],
        file: constItem[4],
        line: constItem[5],
        flags: constItem[6] || '',
      };
    }
  }
  return null;
}

export function getFunctionCalls(report: any, funcId: string): any[] {
  if (!report.gr || !report.gr.c) return [];
  const idx = parseInt(funcId.replace('fn', ''), 10);
  return report.gr.c.filter((call: any) => call[0] === idx);
}

export function getFunctionCallers(report: any, funcId: string): any[] {
  if (!report.gr || !report.gr.c) return [];
  const idx = parseInt(funcId.replace('fn', ''), 10);
  return report.gr.c.filter((call: any) => call[1] === idx);
}

export function getFileName(report: any, fileId: string): string | null {
  return report.fl?.[fileId] || null;
}

export function getModuleName(report: any, moduleId: string): string | null {
  return report.mi?.[moduleId] || null;
}

export function getFunctionInfo(report: any, funcId: string): any | null {
  if (!report.fns) return null;
  for (const func of report.fns) {
    if (func[0] === funcId) {
      return {
        id: func[0],
        name: func[1],
        module: func[2],
        file: func[3],
        line: func[4],
        flags: func[5] || '0',
        calls: getFunctionCalls(report, funcId),
        callers: getFunctionCallers(report, funcId),
      };
    }
  }
  return null;
}

export function getAllSelfFunctions(report: any): any[] {
  if (!report.sf) return [];
  return report.sf.map((sf: any) => ({
    id: sf[0],
    name: sf[1],
    file: sf[2],
    line: sf[3],
  }));
}

export function isSelfFunction(report: any, funcName: string): boolean {
  if (!report.sf) return false;
  return report.sf.some((sf: any) => sf[1] === funcName);
}

export function decodeFlags(flags: string): Record<string, boolean> {
  const result: Record<string, boolean> = {
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
  };

  if (!flags || flags === '0') return result;

  for (const char of flags) {
    for (const [bit, flagChar] of Object.entries(FLAG_MAP)) {
      if (flagChar === char) {
        const flag = parseInt(bit, 10);
        if (flag & 1) result.isAsync = true;
        if (flag & 2) result.isExported = true;
        if (flag & 4) result.isMethod = true;
        if (flag & 8) result.isArrow = true;
        if (flag & 16) result.isEventHandler = true;
        if (flag & 32) result.isNested = true;
        if (flag & 64) result.isSelf = true;
        if (flag & 128) result.isDynamic = true;
        if (flag & 256) result.isConfig = true;
        if (flag & 512) result.isExternal = true;
        if (flag & 1024) result.isVueTemplate = true;
        if (flag & 2048) result.isAsyncChain = true;
        if (flag & 4096) result.isClosure = true;
        if (flag & 8192) result.isTypeDep = true;
      }
    }
  }

  return result;
}

// ============================================
// ✅ ЭКСПОРТ ТИПОВ (ТОЛЬКО ТИПЫ)
// ============================================

export interface CompactReport {
  version: string;
  timestamp: string;
  root: string;
  legend: Record<string, string>;
  moduleIndex: Record<string, string>;
  fileIndex: Record<string, string>;
  functionIndex: Record<string, { name: string; module: string; file: string }>;
  modules: Record<string, CompactModule>;
  reverseIndex: {
    importedBy: Record<string, { from: string; line: number }[]>;
  };
  unresolved: {
    module: string;
    target: string;
    line: number;
  }[];
  stats: {
    totalModules: number;
    totalFiles: number;
    totalFunctions: number;
    totalCalls: number;
    totalImports: number;
    totalExports: number;
    totalUnresolved: number;
  };
}

export interface CompactModule {
  name: string;
  path: string;
  file: string;
  imports: {
    from: string;
    specifiers: string[];
    line: number;
    type?: 'named' | 'default' | 'namespace' | 'type';
  }[];
  exports: {
    function: string;
    name: string;
  }[];
  functions: Record<string, CompactFunction>;
  stats: {
    functions: number;
    imports: number;
    exports: number;
    dependencies: number;
  };
}

export interface CompactFunction {
  name: string;
  line: number;
  flags: number;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  calls: {
    to: string;
    line: number;
    type: 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event';
  }[];
}

// ============================================
// ✅ ЭКСПОРТ ENUM (ЗНАЧЕНИЕ)
// ============================================

export enum CompactFlags {
  NONE = 0,
  ASYNC = 1 << 0,
  EXPORTED = 1 << 1,
  METHOD = 1 << 2,
  ARROW = 1 << 3,
  EVENT_HANDLER = 1 << 4,
  NESTED = 1 << 5,
  SELF = 1 << 6,
  DYNAMIC = 1 << 7,
  CONFIG = 1 << 8,
  EXTERNAL = 1 << 9,
  VUE_TEMPLATE = 1 << 10,
  ASYNC_CHAIN = 1 << 11,
  CLOSURE = 1 << 12,
  TYPE_DEP = 1 << 13,
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ (ТОЛЬКО ЗНАЧЕНИЯ)
// ============================================

export default {
  generateCompactReport,
  SHORT_KEYS,
  FLAG_MAP,
  RELATION_TYPES,
  findFunctionByName,
  findSelfFunctionByName,
  findConstantByName,
  getFunctionCalls,
  getFunctionCallers,
  getFileName,
  getModuleName,
  getFunctionInfo,
  getAllSelfFunctions,
  isSelfFunction,
  decodeFlags,
  reportCache,
  compressPaths,
  compressCalls,
  migrateReport,
  // ✅ CompactFlags - ЭТО ENUM (ЗНАЧЕНИЕ), МОЖНО В default export
  CompactFlags,
  // ❌ CompactReport - ЭТО ИНТЕРФЕЙС (ТИП), НЕЛЬЗЯ В default export
};
