// packages/ast-analyzer/src/reporters/compact-reporter.ts
// ПОЛНАЯ ВЕРСИЯ - СО ВСЕМИ ИСПРАВЛЕНИЯМИ

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
  hasCycles: 'cy',
  timestamp: 'ts',
  version: 'v',
  root: 'r',
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

  // Экспорты
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
  } = {}
): any {
  console.log('\n🚀 Генерация КОМПАКТНОГО отчета (полная версия)...');
  const startTime = Date.now();

  const {
    includeRelations = true,
    includeStats = true,
    includeTypes = true,
    includeInheritance = true,
    includeExports = true,
  } = options;

  // ============================================
  // 1. СБОР ДАННЫХ
  // ============================================

  const moduleIndex: Record<string, string> = {};
  const fileIndex: Record<string, { path: string; module: string }> = {};
  const functionIndex: Record<string, { module: string; file: string }> = {};
  const functions: any[] = [];

  // Все типы связей в одном месте
  const relations = {
    calls: [] as any[], // [from, to, line, type]
    imports: [] as any[], // [fromModule, toModule, specifiers, type, file, line]
    exports: [] as any[], // [module, functionId, line, type, name, localName]
    inheritance: [] as any[], // [child, parent, type, file, line]
    typeDeps: [] as any[], // [from, to, type, file, line]
    reExports: [] as any[], // [fromModule, toModule, specifiers, file, line]
  };

  // Вспомогательные Map
  const moduleMap = new Map<string, string>();
  const fileMap = new Map<string, string>();
  const funcMap = new Map<string, string>();
  const nameToFuncId = new Map<string, string>();
  const exportedFunctions = new Set<string>();
  const defaultExports = new Set<string>();
  const exportedNames = new Set<string>();

  let moduleCounter = 0;
  let fileCounter = 0;
  let functionCounter = 0;
  let exportCounter = 0;
  let reExportCounter = 0;

  // ============================================
  // 2. ПЕРВЫЙ ПРОХОД: ИНДЕКСЫ И ФУНКЦИИ
  // ============================================

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
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
      fileIndex[fileId] = {
        path: filePath,
        module: moduleId,
      };
    }

    // Функции
    for (const func of entities.functions || []) {
      if (!func.name) continue;

      const funcKey = `${moduleId}:${fileId}:${func.name}`;
      let funcId = funcMap.get(funcKey);

      if (!funcId) {
        functionCounter++;
        funcId = `fn${functionCounter}`;
        funcMap.set(funcKey, funcId);
        nameToFuncId.set(func.name, funcId);

        const flags = encodeFlags(func);

        functions.push({
          n: func.name,
          m: moduleId,
          f: fileId,
          l: func.line || 0,
          fl: flags,
        });

        functionIndex[funcId] = {
          module: moduleId,
          file: fileId,
        };

        // Отмечаем экспортированные функции
        if (func.isExported) {
          exportedFunctions.add(funcId);
          exportedNames.add(func.name);
        }
      }
    }
  }

  // ============================================
  // 3. ВТОРОЙ ПРОХОД: ВСЕ ТИПЫ СВЯЗЕЙ
  // ============================================

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const moduleId = moduleMap.get(dirName)!;
    const fileId = fileMap.get(filePath)!;

    // 3.1 ВЫЗОВЫ
    for (const func of entities.functions || []) {
      if (!func.name) continue;

      const funcKey = `${moduleId}:${fileId}:${func.name}`;
      const fromId = funcMap.get(funcKey);
      if (!fromId) continue;

      const fromIdx = parseInt(fromId.replace('fn', ''));

      for (const call of func.calls || []) {
        const toId = nameToFuncId.get(call);
        if (toId) {
          const toIdx = parseInt(toId.replace('fn', ''));
          let callType = 'direct';
          if (func.isAsync) callType = 'async';
          if (func.isMethod) callType = 'method';

          relations.calls.push([
            fromIdx,
            toIdx,
            func.line || 0,
            RELATION_TYPES[callType as keyof typeof RELATION_TYPES] || 'd',
          ]);
        }
      }
    }

    // 3.2 ИМПОРТЫ (расширенные)
    for (const imp of entities.imports || []) {
      if (!imp.source) continue;

      let targetModuleId: string | undefined;
      for (const [otherPath] of Object.entries(entitiesMap)) {
        if (otherPath.includes(imp.source) || imp.source.includes(path.basename(otherPath))) {
          const otherDir = path.basename(path.dirname(otherPath)) || 'root';
          targetModuleId = moduleMap.get(otherDir);
          break;
        }
      }

      if (targetModuleId) {
        // Безопасное получение specifiers с явным приведением типа
        const specifiers: string[] = [];
        const rawSpecifiers = (imp.specifiers as any[]) || [];

        for (const s of rawSpecifiers) {
          if (typeof s === 'string') {
            specifiers.push(s);
          } else if (s && typeof s === 'object') {
            // ImportSpecifier
            const imported = (s as any).imported;
            const local = (s as any).local;
            specifiers.push(imported || local || 'unknown');
          }
        }

        // Определяем тип импорта
        let importType = 'named';
        const isTypeOnly = imp.isTypeOnly || false;

        if (isTypeOnly) {
          importType = 'typeOnly';
        } else if (
          rawSpecifiers.some(s => {
            if (typeof s === 'string') {
              return s === 'default';
            }
            return (s as any).imported === 'default';
          })
        ) {
          importType = 'default';
        } else if (
          rawSpecifiers.some(s => {
            if (typeof s === 'string') {
              return s.includes('*');
            }
            return (s as any).imported === '*';
          })
        ) {
          importType = 'namespace';
        }

        relations.imports.push([
          moduleId,
          targetModuleId,
          specifiers.slice(0, 5),
          RELATION_TYPES[importType as keyof typeof RELATION_TYPES] || 'n',
          fileId,
          imp.loc?.start?.line || 0,
        ]);
      }
    }

    // 3.3 ЭКСПОРТЫ (ИСПРАВЛЕНО - полная информация)
    if (includeExports) {
      for (const exp of entities.exports || []) {
        const expName = exp.name || 'default';
        const isDefault = exp.isDefault || false;
        const isReExport = exp.isReExport || false;
        // const sourceModule = exp.source || undefined;

        // Ищем функцию с таким именем
        const expFunc = entities.functions.find(f => f.name === expName);
        if (expFunc) {
          const funcKey = `${moduleId}:${fileId}:${expName}`;
          const funcId = funcMap.get(funcKey);
          if (funcId) {
            const funcIdx = parseInt(funcId.replace('fn', ''));

            // Определяем тип экспорта
            let exportType = 'ne'; // named export
            if (isDefault)
              exportType = 'de'; // default export
            else if (isReExport) exportType = 're'; // re-export

            relations.exports.push([
              moduleId,
              funcIdx,
              exp.loc?.start?.line || 0,
              exportType,
              expName,
              expName,
            ]);
            exportCounter++;
          }
        } else {
          // Экспорт константы или переменной
          const constItem = entities.constants.find(c => c.name === expName);
          if (constItem) {
            const constKey = `${moduleId}:${fileId}:const:${expName}`;
            let constId = funcMap.get(constKey);
            if (!constId) {
              functionCounter++;
              constId = `fn${functionCounter}`;
              funcMap.set(constKey, constId);
              nameToFuncId.set(expName, constId);

              functions.push({
                n: expName,
                m: moduleId,
                f: fileId,
                l: constItem.line || 0,
                fl: 'e',
              });

              functionIndex[constId] = {
                module: moduleId,
                file: fileId,
              };
            }

            const constIdx = parseInt(constId.replace('fn', ''));
            let exportType = 'ne';
            if (isDefault) exportType = 'de';
            else if (isReExport) exportType = 're';

            relations.exports.push([
              moduleId,
              constIdx,
              constItem.line || 0,
              exportType,
              expName,
              expName,
            ]);
            exportCounter++;
          }
        }
      }
    }

    // 3.4 НАСЛЕДОВАНИЕ (ИСПРАВЛЕНО - добавлен анализ классов)
    if (includeInheritance) {
      for (const cls of entities.classes || []) {
        if (!cls.name) continue;

        // Создаем ID для класса
        const clsKey = `${moduleId}:${fileId}:class:${cls.name}`;
        let clsId = funcMap.get(clsKey);
        if (!clsId) {
          functionCounter++;
          clsId = `fn${functionCounter}`;
          funcMap.set(clsKey, clsId);
          nameToFuncId.set(cls.name, clsId);

          // Добавляем класс как функцию в индекс
          functions.push({
            n: cls.name,
            m: moduleId,
            f: fileId,
            l: cls.line || 0,
            fl: cls.isExported ? 'e' : '0',
          });

          functionIndex[clsId] = {
            module: moduleId,
            file: fileId,
          };
        }

        const clsIdx = parseInt(clsId.replace('fn', ''));

        // extends
        if (cls.extends) {
          const parentId = nameToFuncId.get(cls.extends);
          if (parentId) {
            relations.inheritance.push([
              clsIdx,
              parseInt(parentId.replace('fn', '')),
              RELATION_TYPES.extends || 'ex',
              fileId,
              cls.line || 0,
            ]);
          }
        }

        // implements
        for (const impl of cls.implements || []) {
          const implId = nameToFuncId.get(impl);
          if (implId) {
            relations.inheritance.push([
              clsIdx,
              parseInt(implId.replace('fn', '')),
              RELATION_TYPES.implements || 'im',
              fileId,
              cls.line || 0,
            ]);
          }
        }
      }
    }

    // 3.5 ТИПОВЫЕ ЗАВИСИМОСТИ (расширенные)
    if (includeTypes) {
      for (const func of entities.functions || []) {
        if (!func.name) continue;

        const funcKey = `${moduleId}:${fileId}:${func.name}`;
        const fromId = funcMap.get(funcKey);
        if (!fromId) continue;

        const fromIdx = parseInt(fromId.replace('fn', ''));

        // Параметры как типы
        for (const param of func.params || []) {
          const paramId = nameToFuncId.get(param);
          if (paramId) {
            relations.typeDeps.push([
              fromIdx,
              parseInt(paramId.replace('fn', '')),
              RELATION_TYPES.parameter || 'p',
              fileId,
              func.line || 0,
            ]);
          }
        }

        // Возвращаемый тип
        if (func.returnType) {
          const returnId = nameToFuncId.get(func.returnType);
          if (returnId) {
            relations.typeDeps.push([
              fromIdx,
              parseInt(returnId.replace('fn', '')),
              RELATION_TYPES.return || 'r',
              fileId,
              func.line || 0,
            ]);
          }
        }
      }

      // Интерфейсы и типы
      for (const intf of entities.interfaces || []) {
        if (!intf.name) continue;

        const intfKey = `${moduleId}:${fileId}:interface:${intf.name}`;
        let intfId = funcMap.get(intfKey);
        if (!intfId) {
          functionCounter++;
          intfId = `fn${functionCounter}`;
          funcMap.set(intfKey, intfId);
          nameToFuncId.set(intf.name, intfId);

          // Добавляем интерфейс как функцию в индекс
          functions.push({
            n: intf.name,
            m: moduleId,
            f: fileId,
            l: intf.line || 0,
            fl: intf.isExported ? 'e' : '0',
          });

          functionIndex[intfId] = {
            module: moduleId,
            file: fileId,
          };
        }

        const intfIdx = parseInt(intfId.replace('fn', ''));

        // extends интерфейсов
        for (const ext of intf.extends || []) {
          const extId = nameToFuncId.get(ext);
          if (extId) {
            relations.typeDeps.push([
              intfIdx,
              parseInt(extId.replace('fn', '')),
              RELATION_TYPES.typeReference || 'tr',
              fileId,
              intf.line || 0,
            ]);
          }
        }
      }

      // Типы (type aliases)
      for (const type of entities.types || []) {
        if (!type.name) continue;

        const typeKey = `${moduleId}:${fileId}:type:${type.name}`;
        let typeId = funcMap.get(typeKey);
        if (!typeId) {
          functionCounter++;
          typeId = `fn${functionCounter}`;
          funcMap.set(typeKey, typeId);
          nameToFuncId.set(type.name, typeId);

          // Добавляем тип как функцию в индекс
          functions.push({
            n: type.name,
            m: moduleId,
            f: fileId,
            l: type.line || 0,
            fl: type.isExported ? 'e' : '0',
          });

          functionIndex[typeId] = {
            module: moduleId,
            file: fileId,
          };
        }
      }
    }

    // 3.6 RE-EXPORTS (ИСПРАВЛЕНО - добавлен анализ)
    for (const exp of entities.exports || []) {
      // Проверяем, является ли экспорт re-экспортом
      const isReExport = exp.isReExport === true || exp.source !== undefined;

      if (isReExport && exp.name) {
        // Находим исходный модуль
        let sourceModuleId: string | undefined;
        const sourcePath = exp.source || exp.name;

        for (const [otherPath] of Object.entries(entitiesMap)) {
          if (otherPath.includes(sourcePath) || sourcePath.includes(path.basename(otherPath))) {
            const otherDir = path.basename(path.dirname(otherPath)) || 'root';
            sourceModuleId = moduleMap.get(otherDir);
            break;
          }
        }

        if (sourceModuleId) {
          relations.reExports.push([
            moduleId,
            sourceModuleId,
            [exp.name],
            fileId,
            exp.loc?.start?.line || 0,
          ]);
          reExportCounter++;
        }
      }
    }
  }

  // ============================================
  // 3.7 FALLBACK: ЭКСПОРТЫ НА ОСНОВЕ ФЛАГОВ
  // ============================================
  // Если экспорты не были собраны, создаем их на основе флагов
  if (relations.exports.length === 0) {
    console.log('   🔧 Создание экспортов на основе флагов (fallback)...');
    for (const func of functions) {
      if (func.fl && func.fl.includes('e')) {
        const funcIdx = parseInt(func.n.replace('fn', ''));
        const exists = relations.exports.some(e => e[1] === funcIdx);
        if (!exists) {
          relations.exports.push([func.m, funcIdx, func.l, 'ne', func.n, func.n]);
          exportCounter++;
        }
      }
    }
    if (relations.exports.length > 0) {
      console.log(`   ✅ Создано ${relations.exports.length} экспортов из флагов`);
    }
  }

  // ============================================
  // 4. СТАТИСТИКА (расширенная)
  // ============================================

  // Подсчет дополнительной статистики
  const exportedFuncs = functions.filter(f => f.fl && f.fl.includes('e')).length;
  const asyncFuncs = functions.filter(f => f.fl && f.fl.includes('a')).length;
  const methodFuncs = functions.filter(f => f.fl && f.fl.includes('m')).length;
  const arrowFuncs = functions.filter(f => f.fl && f.fl.includes('r')).length;

  // Функции с вызовами
  const funcsWithCalls = new Set<number>();
  for (const call of relations.calls) {
    funcsWithCalls.add(call[0]);
  }
  const calledFuncs = new Set<number>();
  for (const call of relations.calls) {
    calledFuncs.add(call[1]);
  }

  // Функции без вызовов
  const allFuncIds = new Set<number>();
  for (let i = 1; i <= functionCounter; i++) {
    allFuncIds.add(i);
  }
  const funcsWithoutCalls = new Set<number>();
  for (const id of allFuncIds) {
    if (!funcsWithCalls.has(id) && !calledFuncs.has(id)) {
      funcsWithoutCalls.add(id);
    }
  }

  // Функции с экспортами
  const funcsWithExports = new Set<number>();
  for (const exp of relations.exports) {
    funcsWithExports.add(exp[1]);
  }

  // Экспортированные функции с вызовами
  const exportedWithCalls = new Set<number>();
  for (const id of funcsWithExports) {
    if (funcsWithCalls.has(id)) {
      exportedWithCalls.add(id);
    }
  }

  const stats = includeStats
    ? {
        // Базовые метрики
        tf: functionCounter,
        tc: relations.calls.length,
        tm: moduleCounter,
        tfils: fileCounter,
        cy: false,
        ti: relations.imports.length,
        te: relations.exports.length,
        tun: funcsWithoutCalls.size,

        // НОВЫЕ метрики
        tr: relations.inheritance.length,
        ttd: relations.typeDeps.length,
        tre: relations.reExports.length,
        tmod: Object.keys(entitiesMap).length,

        // Качественные метрики
        exported: exportedFuncs,
        async: asyncFuncs,
        methods: methodFuncs,
        arrows: arrowFuncs,
        isolated: funcsWithoutCalls.size,

        // Метрики вызовов
        funcsWithCalls: funcsWithCalls.size,
        calledFuncs: calledFuncs.size,
        avgCallsPerFunc:
          functionCounter > 0 ? Number((relations.calls.length / functionCounter).toFixed(2)) : 0,
        maxCalls:
          relations.calls.length > 0
            ? Math.max(
                ...relations.calls.map(c => {
                  let count = 0;
                  for (const call of relations.calls) {
                    if (call[0] === c[0]) count++;
                  }
                  return count;
                })
              )
            : 0,

        // Импорты и экспорты
        defaultExports: defaultExports.size,
        typeExports: relations.exports.filter(e => e[3] === 'te').length,
        typeImports: relations.imports.filter(i => i[3] === 'to').length,

        // Структура
        modulesWithFunctions: new Set(functions.map(f => f.m)).size,
        filesWithFunctions: new Set(functions.map(f => f.f)).size,

        // Экспортированные функции с вызовами
        exportedWithCalls: exportedWithCalls.size,
      }
    : undefined;

  // ============================================
  // 5. ФОРМИРОВАНИЕ ОТЧЕТА
  // ============================================

  const report: any = {
    v: '5.0.0-complete',
    ts: new Date().toISOString(),
    r: 'm1',
  };

  // Индексы
  report.mi = moduleIndex;
  report.fl = fileIndex;
  report.fi = functionIndex;

  // Функции
  report.fns = functions;

  // Все связи (полные)
  if (includeRelations) {
    report.gr = {
      c: relations.calls,
      i: relations.imports,
      e: relations.exports, // ИСПРАВЛЕНО - теперь содержит все экспорты
      h: relations.inheritance, // ИСПРАВЛЕНО - теперь содержит наследование
      td: relations.typeDeps, // ИСПРАВЛЕНО - расширенные типовые зависимости
      re: relations.reExports, // ИСПРАВЛЕНО - re-экспорты
    };
  } else {
    report.graph = relations.calls;
  }

  // Статистика
  if (stats) {
    report.st = stats;
  }

  // Легенда флагов
  if (functions.some(f => f.fl !== '0')) {
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

    console.log(`\n✅ Полный отчет сохранен: ${outputPath}`);
    console.log(`📊 Размер: ${sizeKB} KB`);
    console.log(`\n📊 СТАТИСТИКА:`);
    console.log(`   📌 Функций: ${stats?.tf || functionCounter}`);
    console.log(`   📌 Вызовов: ${relations.calls.length}`);
    console.log(`   📌 Импортов: ${relations.imports.length}`);
    console.log(`   📌 Экспортов: ${relations.exports.length} ✅ ИСПРАВЛЕНО`);
    console.log(`   📌 Наследований: ${relations.inheritance.length} ✅ ИСПРАВЛЕНО`);
    console.log(`   📌 Типовых зависимостей: ${relations.typeDeps.length} ✅ ИСПРАВЛЕНО`);
    console.log(`   📌 Re-экспортов: ${relations.reExports.length} ✅ ИСПРАВЛЕНО`);
    console.log(`   📌 Модулей: ${moduleCounter}`);
    console.log(`   📌 Файлов: ${fileCounter}`);
    console.log(`   ⏱️  Время: ${duration} сек`);

    console.log(`\n💡 СТРУКТУРА ОТЧЕТА (полная):`);
    console.log(`   📌 Индексы: mi, fl, fi`);
    console.log(`   📌 Функции: fns (без calls!)`);
    console.log(`   📌 Связи: gr {`);
    console.log(`      • c  - вызовы (calls)`);
    console.log(`      • i  - импорты (imports) ✅ РАСШИРЕНЫ`);
    console.log(`      • e  - экспорты (exports) ✅ ИСПРАВЛЕНО`);
    console.log(`      • h  - наследование (inheritance) ✅ ИСПРАВЛЕНО`);
    console.log(`      • td - типовые зависимости (typeDeps) ✅ ИСПРАВЛЕНО`);
    console.log(`      • re - re-экспорты (reExports) ✅ ИСПРАВЛЕНО`);
    console.log(`   }`);
    console.log(`   📌 Статистика: st (расширенная) ✅ НОВОЕ`);
    console.log(`   📌 Легенда: legend (описание типов) ✅ НОВОЕ`);
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
    if (flags & parseInt(bit)) {
      result += char;
    }
  }
  return result || '0';
}

// ============================================
// ЭКСПОРТ
// ============================================

export default {
  generateCompactReport,
  SHORT_KEYS,
  FLAG_MAP,
  RELATION_TYPES,
};
