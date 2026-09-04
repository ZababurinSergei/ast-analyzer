// packages/ast-analyzer/src/reporters/compact-reporter.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - ИСПРАВЛЕНЫ ВСЕ ПРОБЛЕМЫ
// - Добавлены проверки на null/undefined для всех массивов
// - Исправлен анализ экспортов (gr.e)
// - Добавлена поддержка наследования (gr.h)
// - Добавлены re-экспорты (gr.re)
// - Добавлены зависимости констант (gr.cd)
// - Удалены дублирующиеся секции (fi, ui)

import type { EntitiesResult } from '../types.js';
import path from 'path';
import fs from 'fs';

// ============================================
// КОНСТАНТЫ ДЛЯ СЖАТИЯ
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
};

export const FLAG_MAP = {
  '1': 'a', // async
  '2': 'e', // exported
  '4': 'm', // method
  '8': 'r', // arrow
  '16': 'v', // event
  '32': 'n', // nested
};

// УНИКАЛЬНЫЕ КЛЮЧИ для каждого типа
export const RELATION_TYPES = {
  // Вызовы
  direct: 'd',
  async: 'a',
  method: 'm',
  callback: 'c',

  // Импорты
  named: 'n',
  default: 'df',
  namespace: 'ns',
  reExportImport: 'ri',
  typeOnly: 'to',
  sideEffect: 'se',

  // Экспорты (сохранены в текущем формате)
  namedExport: 'ne',
  defaultExport: 'de',
  reExportExport: 're',
  typeExport: 'te',

  // Наследование
  extends: 'ex',
  implements: 'im',
  abstract: 'ab',

  // Типы
  parameter: 'p',
  return: 'r',
  annotation: 'an',
  generic: 'g',
  typeReference: 'tr',

  // Константы
  constValue: 'val',
  constEnum: 'enum',
  constConfig: 'config',
};

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
  } = options;

  // ============================================
  // 1. СБОР ДАННЫХ
  // ============================================

  const moduleIndex: Record<string, string> = {};
  const fileIndex: Record<string, string> = {};
  const functions: any[] = []; // [id, name, module, file, line, flags]
  const constants: any[] = []; // [id, name, value, module, file, line, flags]

  // Все типы связей в одном месте
  const relations = {
    calls: [] as any[], // [fromIdx, toIdx, line, type]
    imports: [] as any[], // [fromFuncId, toFuncId, importedName, importType, fileId, line]
    exports: [] as any[], // [moduleId, funcIdx, line, exportType, name, alias] - ТЕКУЩИЙ ФОРМАТ
    inheritance: [] as any[], // [childId, parentId, inheritanceType, fileId, line]
    typeDeps: [] as any[], // [fromId, toId, depType, fileId, line]
    reExports: [] as any[], // [fromId, toId, originalName, fileId, line]
    constUses: [] as any[], // [funcId, constId, fileId, line]
    constDeps: [] as any[], // [fromConstId, toConstId, fileId, line]
    constExports: [] as any[], // [constId, exportName, exportType, fileId, line]
  };

  // Вспомогательные Map
  const moduleMap = new Map<string, string>();
  const fileMap = new Map<string, string>();
  const funcMap = new Map<string, string>(); // key → funcId
  const constMap = new Map<string, string>(); // key → constId
  const nameToFuncId = new Map<string, string>();
  const nameToConstId = new Map<string, string>();

  let moduleCounter = 0;
  let fileCounter = 0;
  let functionCounter = 0;
  let constantCounter = 0;

  // ============================================
  // 2. ПЕРВЫЙ ПРОХОД: ИНДЕКСЫ И ФУНКЦИИ
  // ============================================

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    // Проверка на null/undefined
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

    // Функции - НОВЫЙ КОМПАКТНЫЙ ФОРМАТ
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

        // [id, name, module, file, line, flags]
        functions.push([
          funcId,
          func.name,
          moduleId,
          fileId,
          func.line || 0,
          flags
        ]);
      }
    }

    // Константы - НОВАЯ СЕКЦИЯ
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

          // [id, name, value, module, file, line, flags]
          constants.push([
            constId,
            constItem.name,
            constItem.value ?? null,
            moduleId,
            fileId,
            constItem.line || 0,
            flags
          ]);
        }
      }
    }
  }

  // ============================================
  // 3. ВТОРОЙ ПРОХОД: ВСЕ ТИПЫ СВЯЗЕЙ
  // ============================================

  // Строим индекс для быстрого поиска ID по имени
  const funcNameToId = new Map<string, string>();
  for (const func of functions) {
    funcNameToId.set(func[1], func[0]); // name → id
  }

  const constNameToId = new Map<string, string>();
  for (const constItem of constants) {
    constNameToId.set(constItem[1], constItem[0]); // name → id
  }

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const moduleId = moduleMap.get(dirName)!;
    const fileId = fileMap.get(filePath)!;

    // 3.1 ВЫЗОВЫ (calls)
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
          let callType = 'd'; // direct
          if (func.isAsync) callType = 'a';
          if (func.isMethod) callType = 'm';
          if (func.isEventHandler) callType = 'c';

          relations.calls.push([
            fromIdx,
            toIdx,
            func.line || 0,
            callType
          ]);
        }
      }
    }

    // 3.2 ИМПОРТЫ (imports) - НОВЫЙ ФОРМАТ
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

        let importType = 'n'; // named
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
          imp.loc?.start?.line || 0
        ]);
      }
    }

    // 3.3 ЭКСПОРТЫ (exports) - ИСПРАВЛЕНО: извлекаем из entities.exports
    if (includeExports) {
      const exports = entities.exports || [];
      for (const exp of exports) {
        if (!exp) continue;

        const expName = exp.name || 'default';
        const isDefault = exp.isDefault || false;
        const isReExport = exp.isReExport || false;

        // Проверяем все возможные источники экспорта
        let funcId: string | undefined;
        let funcIdx = -1;

        // 1. Ищем функцию с таким именем
        const expFunc = funcs.find(f => f && f.name === expName);
        if (expFunc) {
          funcId = nameToFuncId.get(expName);
          if (funcId) {
            funcIdx = parseInt(funcId.replace('fn', ''), 10);
          }
        }

        // 2. Если не нашли функцию, ищем константу
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
                constItem.line || 0
              ]);
              continue;
            }
          }
        }

        // 3. Если нашли функцию, добавляем экспорт
        if (funcIdx !== -1) {
          let exportType = 'ne';
          if (isDefault) exportType = 'de';
          else if (isReExport) exportType = 're';

          // ТЕКУЩИЙ ФОРМАТ: [moduleId, funcIdx, line, exportType, name, alias]
          relations.exports.push([
            moduleId,
            funcIdx,
            exp.loc?.start?.line || 0,
            exportType,
            expName,
            expName
          ]);
        }
      }
    }

    // 3.4 НАСЛЕДОВАНИЕ (inheritance) - ИСПРАВЛЕНО: добавлена поддержка классов и интерфейсов
    if (includeInheritance) {
      // Классы
      const classes = entities.classes || [];
      for (const cls of classes) {
        if (!cls || !cls.name) continue;

        const childId = nameToFuncId.get(cls.name);
        if (!childId) continue;

        // extends
        if (cls.extends) {
          const parentId = nameToFuncId.get(cls.extends);
          if (parentId) {
            relations.inheritance.push([
              childId,
              parentId,
              'ex',
              fileId,
              cls.line || 0
            ]);
          }
        }

        // implements
        const implements_ = cls.implements || [];
        for (const impl of implements_) {
          if (!impl) continue;
          const parentId = nameToFuncId.get(impl);
          if (parentId) {
            relations.inheritance.push([
              childId,
              parentId,
              'im',
              fileId,
              cls.line || 0
            ]);
          }
        }
      }

      // Интерфейсы extends
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
            relations.inheritance.push([
              childId,
              parentId,
              'ex',
              fileId,
              intf.line || 0
            ]);
          }
        }
      }
    }

    // 3.5 ТИПОВЫЕ ЗАВИСИМОСТИ (typeDeps)
    if (includeTypes) {
      for (const func of funcs) {
        if (!func || !func.name) continue;

        const fromId = nameToFuncId.get(func.name);
        if (!fromId) continue;

        // Параметры
        const params = func.params || [];
        for (const param of params) {
          if (!param) continue;
          const toId = nameToFuncId.get(param);
          if (toId) {
            relations.typeDeps.push([
              fromId,
              toId,
              'p',
              fileId,
              func.line || 0
            ]);
          }
        }

        // Return type
        if (func.returnType) {
          const toId = nameToFuncId.get(func.returnType);
          if (toId) {
            relations.typeDeps.push([
              fromId,
              toId,
              'r',
              fileId,
              func.line || 0
            ]);
          }
        }
      }

      // Интерфейсы типовые зависимости
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
            relations.typeDeps.push([
              fromId,
              toId,
              'tr',
              fileId,
              intf.line || 0
            ]);
          }
        }
      }
    }

    // 3.6 RE-EXPORTS - ИСПРАВЛЕНО: улучшен анализ re-экспортов
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

      // 1. Ищем в импортах
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

      // 2. Если не нашли в импортах, ищем по имени в других файлах
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

      // 3. Если нашли, добавляем re-экспорт
      if (toId) {
        relations.reExports.push([
          fromId,
          toId,
          originalName,
          fileId,
          exp.loc?.start?.line || 0
        ]);
      }
    }

    // 3.7 ИСПОЛЬЗОВАНИЕ КОНСТАНТ (constUses)
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
            relations.constUses.push([
              fromId,
              constId,
              fileId,
              func.line || 0
            ]);
          }
        }
      }
    }

    // 3.8 ЗАВИСИМОСТИ КОНСТАНТ (constDeps) - ИСПРАВЛЕНО: добавлен анализ
    if (includeConstants) {
      const consts = entities.constants || [];
      for (const constItem of consts) {
        if (!constItem || !constItem.name) continue;

        const fromId = nameToConstId.get(constItem.name);
        if (!fromId) continue;

        const value = constItem.value;
        const strValue = typeof value === 'string' ? value :
          typeof value === 'number' ? String(value) :
            typeof value === 'boolean' ? String(value) :
              value !== null && value !== undefined ? JSON.stringify(value) : '';

        // Проверяем все другие константы на наличие ссылок
        for (const otherConst of consts) {
          if (!otherConst || otherConst.name === constItem.name || !otherConst.name) continue;

          // Проверяем, ссылается ли значение на другую константу
          if (strValue.includes(otherConst.name)) {
            const toId = nameToConstId.get(otherConst.name);
            if (toId) {
              // Проверяем, не добавлена ли уже такая зависимость
              const exists = relations.constDeps.some(
                dep => dep[0] === fromId && dep[1] === toId
              );
              if (!exists) {
                relations.constDeps.push([
                  fromId,
                  toId,
                  fileId,
                  constItem.line || 0
                ]);
              }
            }
          }
        }
      }
    }
  }

  // ============================================
  // 4. СТАТИСТИКА (упрощенная)
  // ============================================

  const totalFunctions = functions.length;
  const totalConstants = constants.length;
  const totalCalls = relations.calls.length;
  const totalModules = moduleCounter;
  const totalFiles = fileCounter;

  // Вычисляем дополнительные метрики
  const asyncFuncs = functions.filter(f => f[5] && f[5].includes('a')).length;

  // Функции без вызовов (изолированные)
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

  // Среднее и максимальное число вызовов
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

  const stats = includeStats ? {
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
    funcsWithCalls: funcsWithCalls.size,
    calledFuncs: calledFuncs.size,
    modulesWithFunctions: new Set(functions.map(f => f[2])).size,
    filesWithFunctions: new Set(functions.map(f => f[3])).size,
    exportedWithCalls: 0,
    defaultExports: 0,
    typeExports: 0,
    typeImports: 0
  } : undefined;

  // ============================================
  // 5. ФОРМИРОВАНИЕ ОТЧЕТА
  // ============================================

  const report: any = {
    v: '5.0.0-optimized',
    ts: new Date().toISOString(),
    r: 'm1',
  };

  // Индексы (только mi и fl, fi удален)
  report.mi = moduleIndex;
  report.fl = fileIndex;

  // Функции (новый компактный формат)
  report.fns = functions;

  // Константы (новая секция)
  if (includeConstants && constants.length > 0) {
    report.cn = constants;
  }

  // Все связи
  if (includeRelations) {
    report.gr = {
      c: relations.calls || [],
      i: relations.imports || [],
      e: relations.exports || [], // СОХРАНЕН ТЕКУЩИЙ ФОРМАТ
      h: relations.inheritance || [],
      td: relations.typeDeps || [],
      re: relations.reExports || [],
      uc: relations.constUses || [],
      cd: relations.constDeps || [],
      ce: relations.constExports || [],
    };
  } else {
    report.graph = relations.calls || [];
  }

  // Статистика (упрощенная)
  if (stats) {
    report.st = stats;
  }

  // Легенда флагов
  if (functions.some(f => f[5] && f[5] !== '0')) {
    report.flg = FLAG_MAP;
  }

  // Дополнительная информация о типах связей
  if (includeRelations) {
    report.legend = {
      callTypes: {
        d: 'direct',
        a: 'async',
        m: 'method',
        c: 'callback',
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
    };
  }

  // ============================================
  // 6. СОХРАНЕНИЕ
  // ============================================

  if (outputPath) {
    const json = JSON.stringify(report, null, 2);
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
    console.log(`   📌 Констант: ${totalConstants}`);
    console.log(`   📌 Вызовов: ${(relations.calls || []).length}`);
    console.log(`   📌 Импортов: ${(relations.imports || []).length}`);
    console.log(`   📌 Экспортов: ${(relations.exports || []).length + (relations.constExports || []).length}`);
    console.log(`   📌 Наследований: ${(relations.inheritance || []).length}`);
    console.log(`   📌 Типовых зависимостей: ${(relations.typeDeps || []).length}`);
    console.log(`   📌 Re-экспортов: ${(relations.reExports || []).length}`);
    console.log(`   📌 Использований констант: ${(relations.constUses || []).length}`);
    console.log(`   📌 Зависимостей констант: ${(relations.constDeps || []).length}`);
    console.log(`   📌 Экспортов констант: ${(relations.constExports || []).length}`);
    console.log(`   📌 Модулей: ${moduleCounter}`);
    console.log(`   📌 Файлов: ${fileCounter}`);
    console.log(`   ⏱️  Время: ${duration} сек`);

    console.log(`\n💡 СТРУКТУРА ОТЧЕТА (оптимизированная):`);
    console.log(`   📌 Индексы: mi, fl (fi удален - данные в fns)`);
    console.log(`   📌 Функции: fns (компактные массивы) ✅ НОВЫЙ ФОРМАТ`);
    console.log(`   📌 Константы: cn (новая секция) ✅ НОВОЕ`);
    console.log(`   📌 Связи: gr {`);
    console.log(`      • c  - вызовы (calls)`);
    console.log(`      • i  - импорты (imports) ✅ НОВЫЙ ФОРМАТ`);
    console.log(`      • e  - экспорты (exports) 🔒 ТЕКУЩИЙ ФОРМАТ`);
    console.log(`      • h  - наследование (inheritance) ✅ ИСПРАВЛЕНО`);
    console.log(`      • td - типовые зависимости (typeDeps) ✅ ИСПРАВЛЕНО`);
    console.log(`      • re - re-экспорты (reExports) ✅ ИСПРАВЛЕНО`);
    console.log(`      • uc - использование констант (constUses) ✅ НОВОЕ`);
    console.log(`      • cd - зависимости констант (constDeps) ✅ ИСПРАВЛЕНО`);
    console.log(`      • ce - экспорты констант (constExports) ✅ НОВОЕ`);
    console.log(`   }`);
    console.log(`   📌 Статистика: st (упрощенная) ✅ НОВОЕ`);
    console.log(`   📌 Легенда: legend (расширенная) ✅ НОВОЕ`);
    console.log(`   📌 ui - УДАЛЕН (дублирование)`);
  }

  return report;
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
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОИСКА
// ============================================

/**
 * Находит функцию по имени в отчете
 */
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
        flags: func[5] || '0'
      };
    }
  }
  return null;
}

/**
 * Находит константу по имени в отчете
 */
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
        flags: constItem[6] || ''
      };
    }
  }
  return null;
}

/**
 * Получает вызовы функции по ее ID
 */
export function getFunctionCalls(report: any, funcId: string): any[] {
  if (!report.gr || !report.gr.c) return [];
  const idx = parseInt(funcId.replace('fn', ''), 10);
  return report.gr.c.filter((call: any) => call[0] === idx);
}

/**
 * Получает вызывающие функцию по ее ID
 */
export function getFunctionCallers(report: any, funcId: string): any[] {
  if (!report.gr || !report.gr.c) return [];
  const idx = parseInt(funcId.replace('fn', ''), 10);
  return report.gr.c.filter((call: any) => call[1] === idx);
}

/**
 * Получает имя файла по ID
 */
export function getFileName(report: any, fileId: string): string | null {
  return report.fl?.[fileId] || null;
}

/**
 * Получает имя модуля по ID
 */
export function getModuleName(report: any, moduleId: string): string | null {
  return report.mi?.[moduleId] || null;
}

/**
 * Получает полную информацию о функции по ID
 */
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
        callers: getFunctionCallers(report, funcId)
      };
    }
  }
  return null;
}

// ============================================
// ДЕКОДИРОВАНИЕ ФЛАГОВ
// ============================================

export function decodeFlags(flags: string): Record<string, boolean> {
  const result: Record<string, boolean> = {
    isAsync: false,
    isExported: false,
    isMethod: false,
    isArrow: false,
    isEventHandler: false,
    isNested: false,
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
      }
    }
  }

  return result;
}

// ============================================
// ЭКСПОРТ ТИПОВ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
// ============================================

export type CompactFlags = typeof FLAG_MAP;
export type CompactReport = ReturnType<typeof generateCompactReport>;

// ============================================
// ЭКСПОРТ
// ============================================

export default {
  generateCompactReport,
  SHORT_KEYS,
  FLAG_MAP,
  RELATION_TYPES,
  findFunctionByName,
  findConstantByName,
  getFunctionCalls,
  getFunctionCallers,
  getFileName,
  getModuleName,
  getFunctionInfo,
  decodeFlags,
};
