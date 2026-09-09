// src/reporters/compact-reporter.ts
// ВЕРСИЯ 7.0.0 - УНИФИЦИРОВАННЫЙ ГРАФ (ОПТИМИЗИРОВАННАЯ)

import type { EntitiesResult } from '../types.js';
import path from 'path';
import fs from 'fs';
import { encodeFlags } from '../utils/flag-utils.js';

// ============================================
// ТИПЫ ДЛЯ НОВОГО ФОРМАТА
// ============================================

export interface UnifiedGraphReport {
  /** Версия формата */
  v: "7.0.0";
  /** Временная метка */
  ts: string;
  /** Индекс корневого узла */
  r: number;

  /** Словари для компактного хранения */
  dict: {
    /** Типы узлов: file, module, function, constant, class, interface, type, variable */
    t: string[];
    /** Имена всех сущностей */
    n: string[];
    /** Типы связей: contains, calls, imports, exports, inherits, implements, type_ref */
    r: string[];
    /** Метаданные узлов (строка, флаги, параметры) */
    m: any[];
  };

  /** Узлы графа: [typeIdx, nameIdx, metadataIdx] */
  nodes: [number, number, number][];

  /** Ребра графа: [fromNodeIdx, toNodeIdx, relationIdx, line] */
  edges: [number, number, number, number][];

  /** Статистика */
  st: {
    tn: number;    // totalNodes
    te: number;    // totalEdges
    tf: number;    // totalFiles
    tm: number;    // totalModules
    tfn: number;   // totalFunctions
    tc: number;    // totalConstants
    tcl: number;   // totalClasses
    ti: number;    // totalInterfaces
    tt: number;    // totalTypes
    tv: number;    // totalVariables
    tca: number;   // totalCalls
    tim: number;   // totalImports
    tex: number;   // totalExports
    cy: boolean;   // hasCycles
    cc: number;    // cyclesCount
  };

  /** Циклические зависимости (опционально) */
  cycles?: number[][];
}

// ============================================
// КОНСТАНТЫ ДЛЯ ИНДЕКСОВ
// ============================================

const NODE_TYPES = ['file', 'module', 'function', 'constant', 'class', 'interface', 'type', 'variable'] as const;
const RELATION_TYPES = ['contains', 'calls', 'imports', 'exports', 'inherits', 'implements', 'type_ref'] as const;

type NodeType = typeof NODE_TYPES[number];
type RelationType = typeof RELATION_TYPES[number];

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ ОТЧЕТА
// ============================================

export function generateCompactReport(
    entitiesMap: Record<string, EntitiesResult>,
    outputPath?: string,
    options: {
      maxDepth?: number;
      includeFiles?: boolean;
      includeModules?: boolean;
      includeFunctions?: boolean;
      includeConstants?: boolean;
      includeClasses?: boolean;
      includeInterfaces?: boolean;
      includeTypes?: boolean;
      includeVariables?: boolean;
      includeCalls?: boolean;
      includeImports?: boolean;
      includeExports?: boolean;
      includeInheritance?: boolean;
      includeTypeDeps?: boolean;
      includeStats?: boolean;
      includeCycles?: boolean;
      ultraCompact?: boolean;
      useBitFlags?: boolean;
      useDictionaries?: boolean;
      readableKeys?: boolean;
      useTemplates?: boolean;
      includeBody?: boolean;
      includeSecurity?: boolean;
      includeVSCode?: boolean;
      includeSelfFunctions?: boolean;
      includeDynamicImports?: boolean;
      includeConfigRefs?: boolean;
      includeExternalLibs?: boolean;
      includeVueTemplates?: boolean;
      includeAsyncChains?: boolean;
      includeClosures?: boolean;
    } = {}
): UnifiedGraphReport {
  console.log('\n🚀 Генерация унифицированного графа (v7.0.0)...');
  const startTime = Date.now();

  // === ИНИЦИАЛИЗАЦИЯ ===
  const dict = {
    t: [...NODE_TYPES] as string[],
    n: [] as string[],
    r: [...RELATION_TYPES] as string[],
    m: [] as any[],
  };

  const nodes: [number, number, number][] = [];
  const edges: [number, number, number, number][] = [];
  const cycles: number[][] = [];

  // Индексы для быстрого поиска
  const fileNodeMap = new Map<string, number>();
  const moduleNodeMap = new Map<string, number>();
  const functionNodeMap = new Map<string, number>();
  const constantNodeMap = new Map<string, number>();
  const classNodeMap = new Map<string, number>();
  const interfaceNodeMap = new Map<string, number>();
  const typeNodeMap = new Map<string, number>();
  const variableNodeMap = new Map<string, number>();

  const moduleNameMap = new Map<string, string>(); // filePath -> moduleName

  // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

  function addToDict(value: string): number {
    const idx = dict.n.indexOf(value);
    if (idx !== -1) return idx;
    dict.n.push(value);
    return dict.n.length - 1;
  }

  function addMetadata(meta: any): number {
    dict.m.push(meta);
    return dict.m.length - 1;
  }

  function getNodeTypeIdx(type: NodeType): number {
    return dict.t.indexOf(type);
  }

  function getRelationIdx(type: RelationType): number {
    return dict.r.indexOf(type);
  }

  function findFunctionNode(name: string, filePath?: string): number | undefined {
    if (filePath) {
      const key = `${filePath}#${name}`;
      return functionNodeMap.get(key);
    }
    // Ищем по имени в любом файле
    for (const [key, idx] of functionNodeMap) {
      if (key.endsWith(`#${name}`)) {
        return idx;
      }
    }
    return undefined;
  }

  function getShortFilePath(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length <= 3) return filePath;
    // Оставляем последние 2 части (папка + файл)
    const lastTwo = parts.slice(-2);
    // Если есть src/, добавляем его как контекст
    const srcIndex = parts.indexOf('src');
    if (srcIndex !== -1 && srcIndex < parts.length - 2) {
      return `src/${lastTwo.join('/')}`;
    }
    return lastTwo.join('/');
  }

  // === ШАГ 1: ДОБАВЛЯЕМ ВСЕ ФАЙЛЫ КАК УЗЛЫ ===

  if (options.includeFiles !== false) {
    for (const filePath of Object.keys(entitiesMap)) {
      const shortPath = getShortFilePath(filePath);
      const nameIdx = addToDict(shortPath);
      const nodeIdx = nodes.length;
      nodes.push([getNodeTypeIdx('file'), nameIdx, -1]);
      fileNodeMap.set(filePath, nodeIdx);
    }
  }

  // === ШАГ 2: ДОБАВЛЯЕМ ВСЕ МОДУЛИ КАК УЗЛЫ ===

  if (options.includeModules !== false) {
    for (const filePath of Object.keys(entitiesMap)) {
      const moduleName = path.basename(path.dirname(filePath)) || 'root';
      moduleNameMap.set(filePath, moduleName);

      if (!moduleNodeMap.has(moduleName)) {
        const nameIdx = addToDict(moduleName);
        const nodeIdx = nodes.length;
        nodes.push([getNodeTypeIdx('module'), nameIdx, -1]);
        moduleNodeMap.set(moduleName, nodeIdx);
      }
    }
  }

  // === ШАГ 3: СВЯЗЫВАЕМ ФАЙЛЫ С МОДУЛЯМИ (contains) ===

  const containsIdx = getRelationIdx('contains');
  for (const [filePath, fileNodeIdx] of fileNodeMap) {
    const moduleName = moduleNameMap.get(filePath);
    if (moduleName && moduleNodeMap.has(moduleName)) {
      edges.push([fileNodeIdx, moduleNodeMap.get(moduleName)!, containsIdx, -1]);
    }
  }

  // === ШАГ 4: ДОБАВЛЯЕМ ФУНКЦИИ ===

  if (options.includeFunctions !== false) {
    const functionTypeIdx = getNodeTypeIdx('function');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleName = moduleNameMap.get(filePath)!;
      const moduleNodeIdx = moduleNodeMap.get(moduleName)!;

      for (const func of entities.functions || []) {
        if (!func.name) continue;

        const key = `${filePath}#${func.name}`;
        if (functionNodeMap.has(key)) continue;

        const nameIdx = addToDict(func.name);
        const flags = options.useBitFlags !== false ? encodeFlags(func) : 0;

        // Минимальные метаданные
        const meta: any = {
          l: func.line || 0,
          f: flags,
        };

        // Добавляем параметры только если есть
        if (func.params && func.params.length > 0) {
          meta.p = func.params;
        }

        // Добавляем returnType только если не 'any'
        if (func.returnType && func.returnType !== 'any') {
          meta.r = func.returnType;
        }

        // Добавляем тело только если запрошено
        if (options.includeBody && func.body) {
          meta.b = func.body;
        }

        // Добавляем информацию о безопасности только если запрошено
        if (options.includeSecurity && func.security) {
          const sec = func.security;
          if (sec.hasEval || sec.hasProcessEnv || sec.hasSensitiveData || sec.hasExec || sec.hasPassword) {
            meta.s = {
              e: sec.hasEval,
              p: sec.hasProcessEnv,
              d: sec.hasSensitiveData,
              x: sec.hasExec,
              w: sec.hasPassword,
            };
          }
        }

        const metaIdx = addMetadata(meta);

        const nodeIdx = nodes.length;
        nodes.push([functionTypeIdx, nameIdx, metaIdx]);
        functionNodeMap.set(key, nodeIdx);

        // Связываем модуль с функцией (contains)
        edges.push([moduleNodeIdx, nodeIdx, containsIdx, -1]);

        // Если функция экспортируется, добавляем ребро exports
        if (func.isExported && options.includeExports !== false) {
          const exportsIdx = getRelationIdx('exports');
          edges.push([moduleNodeIdx, nodeIdx, exportsIdx, func.line || 0]);
        }
      }
    }
  }

  // === ШАГ 5: ДОБАВЛЯЕМ ВЫЗОВЫ (calls) ===

  if (options.includeCalls !== false) {
    const callsIdx = getRelationIdx('calls');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      for (const func of entities.functions || []) {
        if (!func.name) continue;

        const fromKey = `${filePath}#${func.name}`;
        const fromNodeIdx = functionNodeMap.get(fromKey);
        if (fromNodeIdx === undefined) continue;

        for (const call of func.calls || []) {
          if (!call) continue;

          // Ищем вызываемую функцию
          let toNodeIdx = functionNodeMap.get(`${filePath}#${call}`);
          if (toNodeIdx === undefined) {
            // Ищем в других файлах
            toNodeIdx = findFunctionNode(call);
          }

          if (toNodeIdx !== undefined) {
            const line = func.line || 0;
            edges.push([fromNodeIdx, toNodeIdx, callsIdx, line]);
          }
        }
      }
    }
  }

  // === ШАГ 6: ДОБАВЛЯЕМ ИМПОРТЫ ===

  if (options.includeImports !== false) {
    const importsIdx = getRelationIdx('imports');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const fileNodeIdx = fileNodeMap.get(filePath);
      if (fileNodeIdx === undefined) continue;

      for (const imp of entities.imports || []) {
        if (!imp.source) continue;

        // Ищем файл, который экспортирует эту сущность
        const targetFile = findExportingFile(imp.source, entitiesMap);
        if (targetFile) {
          const targetNodeIdx = fileNodeMap.get(targetFile);
          if (targetNodeIdx !== undefined) {
            const line = imp.loc?.start?.line || 0;
            edges.push([fileNodeIdx, targetNodeIdx, importsIdx, line]);
          }
        }
      }
    }
  }

  // === ШАГ 7: ДОБАВЛЯЕМ КОНСТАНТЫ ===

  if (options.includeConstants !== false) {
    const constantTypeIdx = getNodeTypeIdx('constant');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleName = moduleNameMap.get(filePath)!;
      const moduleNodeIdx = moduleNodeMap.get(moduleName)!;

      for (const constItem of entities.constants || []) {
        if (!constItem.name) continue;

        const key = `${filePath}#const:${constItem.name}`;
        if (constantNodeMap.has(key)) continue;

        const nameIdx = addToDict(constItem.name);
        const metaIdx = addMetadata({
          l: constItem.line || 0,
          v: constItem.value,
          e: constItem.isExported || false,
        });

        const nodeIdx = nodes.length;
        nodes.push([constantTypeIdx, nameIdx, metaIdx]);
        constantNodeMap.set(key, nodeIdx);

        // Связываем модуль с константой (contains)
        edges.push([moduleNodeIdx, nodeIdx, containsIdx, constItem.line || 0]);

        // Если константа экспортируется
        if (constItem.isExported && options.includeExports !== false) {
          const exportsIdx = getRelationIdx('exports');
          edges.push([moduleNodeIdx, nodeIdx, exportsIdx, constItem.line || 0]);
        }
      }
    }
  }

  // === ШАГ 8: ДОБАВЛЯЕМ КЛАССЫ ===

  if (options.includeClasses !== false) {
    const classTypeIdx = getNodeTypeIdx('class');
    const inheritsIdx = getRelationIdx('inherits');
    const implementsIdx = getRelationIdx('implements');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleName = moduleNameMap.get(filePath)!;
      const moduleNodeIdx = moduleNodeMap.get(moduleName)!;

      for (const cls of entities.classes || []) {
        if (!cls.name) continue;

        const key = `${filePath}#class:${cls.name}`;
        if (classNodeMap.has(key)) continue;

        const nameIdx = addToDict(cls.name);

        // Минимальные метаданные для класса
        const meta: any = {
          l: cls.line || 0,
          e: cls.isExported || false,
        };

        if (cls.methods && cls.methods.length > 0) meta.m = cls.methods;
        if (cls.properties && cls.properties.length > 0) meta.p = cls.properties;
        if (cls.extends) meta.x = cls.extends;
        if (cls.implements && cls.implements.length > 0) meta.i = cls.implements;

        const metaIdx = addMetadata(meta);

        const nodeIdx = nodes.length;
        nodes.push([classTypeIdx, nameIdx, metaIdx]);
        classNodeMap.set(key, nodeIdx);

        // Связываем модуль с классом (contains)
        edges.push([moduleNodeIdx, nodeIdx, containsIdx, cls.line || 0]);

        // Если класс экспортируется
        if (cls.isExported && options.includeExports !== false) {
          const exportsIdx = getRelationIdx('exports');
          edges.push([moduleNodeIdx, nodeIdx, exportsIdx, cls.line || 0]);
        }

        // Наследование
        if (cls.extends && options.includeInheritance !== false) {
          const parentNode = findFunctionNode(cls.extends, filePath) || findFunctionNode(cls.extends);
          if (parentNode !== undefined) {
            edges.push([nodeIdx, parentNode, inheritsIdx, cls.line || 0]);
          }
        }

        // Имплементация
        for (const impl of cls.implements || []) {
          if (!impl) continue;
          const implNode = findFunctionNode(impl, filePath) || findFunctionNode(impl);
          if (implNode !== undefined) {
            edges.push([nodeIdx, implNode, implementsIdx, cls.line || 0]);
          }
        }
      }
    }
  }

  // === ШАГ 9: ДОБАВЛЯЕМ ИНТЕРФЕЙСЫ ===

  if (options.includeInterfaces !== false) {
    const interfaceTypeIdx = getNodeTypeIdx('interface');
    const inheritsIdx = getRelationIdx('inherits');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleName = moduleNameMap.get(filePath)!;
      const moduleNodeIdx = moduleNodeMap.get(moduleName)!;

      for (const intf of entities.interfaces || []) {
        if (!intf.name) continue;

        const key = `${filePath}#interface:${intf.name}`;
        if (interfaceNodeMap.has(key)) continue;

        const nameIdx = addToDict(intf.name);

        // Минимальные метаданные для интерфейса
        const meta: any = {
          l: intf.line || 0,
          e: intf.isExported || false,
        };

        if (intf.properties && intf.properties.length > 0) meta.p = intf.properties;
        if (intf.extends && intf.extends.length > 0) meta.x = intf.extends;

        const metaIdx = addMetadata(meta);

        const nodeIdx = nodes.length;
        nodes.push([interfaceTypeIdx, nameIdx, metaIdx]);
        interfaceNodeMap.set(key, nodeIdx);

        // Связываем модуль с интерфейсом (contains)
        edges.push([moduleNodeIdx, nodeIdx, containsIdx, intf.line || 0]);

        // Если интерфейс экспортируется
        if (intf.isExported && options.includeExports !== false) {
          const exportsIdx = getRelationIdx('exports');
          edges.push([moduleNodeIdx, nodeIdx, exportsIdx, intf.line || 0]);
        }

        // Наследование интерфейсов
        for (const ext of intf.extends || []) {
          if (!ext) continue;
          const extNode = findFunctionNode(ext, filePath) || findFunctionNode(ext);
          if (extNode !== undefined) {
            edges.push([nodeIdx, extNode, inheritsIdx, intf.line || 0]);
          }
        }
      }
    }
  }

  // === ШАГ 10: ДОБАВЛЯЕМ ТИПЫ ===

  if (options.includeTypes !== false) {
    const typeTypeIdx = getNodeTypeIdx('type');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleName = moduleNameMap.get(filePath)!;
      const moduleNodeIdx = moduleNodeMap.get(moduleName)!;

      for (const typeItem of entities.types || []) {
        if (!typeItem.name) continue;

        const key = `${filePath}#type:${typeItem.name}`;
        if (typeNodeMap.has(key)) continue;

        const nameIdx = addToDict(typeItem.name);
        const metaIdx = addMetadata({
          l: typeItem.line || 0,
          d: typeItem.definition || 'unknown',
          e: typeItem.isExported || false,
        });

        const nodeIdx = nodes.length;
        nodes.push([typeTypeIdx, nameIdx, metaIdx]);
        typeNodeMap.set(key, nodeIdx);

        // Связываем модуль с типом (contains)
        edges.push([moduleNodeIdx, nodeIdx, containsIdx, typeItem.line || 0]);

        // Если тип экспортируется
        if (typeItem.isExported && options.includeExports !== false) {
          const exportsIdx = getRelationIdx('exports');
          edges.push([moduleNodeIdx, nodeIdx, exportsIdx, typeItem.line || 0]);
        }
      }
    }
  }

  // === ШАГ 11: ДОБАВЛЯЕМ ПЕРЕМЕННЫЕ ===

  if (options.includeVariables !== false) {
    const variableTypeIdx = getNodeTypeIdx('variable');

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleName = moduleNameMap.get(filePath)!;
      const moduleNodeIdx = moduleNodeMap.get(moduleName)!;

      for (const varItem of entities.variables || []) {
        if (!varItem.name) continue;

        const key = `${filePath}#var:${varItem.name}`;
        if (variableNodeMap.has(key)) continue;

        const nameIdx = addToDict(varItem.name);
        const metaIdx = addMetadata({
          l: varItem.line || 0,
          v: varItem.value,
          e: varItem.isExported || false,
        });

        const nodeIdx = nodes.length;
        nodes.push([variableTypeIdx, nameIdx, metaIdx]);
        variableNodeMap.set(key, nodeIdx);

        // Связываем модуль с переменной (contains)
        edges.push([moduleNodeIdx, nodeIdx, containsIdx, varItem.line || 0]);

        // Если переменная экспортируется
        if (varItem.isExported && options.includeExports !== false) {
          const exportsIdx = getRelationIdx('exports');
          edges.push([moduleNodeIdx, nodeIdx, exportsIdx, varItem.line || 0]);
        }
      }
    }
  }

  // === ШАГ 12: НАХОДИМ ЦИКЛЫ ===

  if (options.includeCycles !== false) {
    const foundCycles = findCyclesInGraph(nodes.length, edges);
    cycles.push(...foundCycles);
  }

  // === ШАГ 13: СТАТИСТИКА ===

  const stats = {
    tn: nodes.length,
    te: edges.length,
    tf: fileNodeMap.size,
    tm: moduleNodeMap.size,
    tfn: functionNodeMap.size,
    tc: constantNodeMap.size,
    tcl: classNodeMap.size,
    ti: interfaceNodeMap.size,
    tt: typeNodeMap.size,
    tv: variableNodeMap.size,
    tca: edges.filter(e => e[2] === getRelationIdx('calls')).length,
    tim: edges.filter(e => e[2] === getRelationIdx('imports')).length,
    tex: edges.filter(e => e[2] === getRelationIdx('exports')).length,
    cy: cycles.length > 0,
    cc: cycles.length,
  };

  // === ШАГ 14: ФОРМИРУЕМ ОТЧЕТ ===

  const report: UnifiedGraphReport = {
    v: "7.0.0",
    ts: new Date().toISOString(),
    r: 0,
    dict,
    nodes,
    edges,
    st: stats,
  };

  if (cycles.length > 0) {
    report.cycles = cycles;
  }

  // === ШАГ 15: СОХРАНЯЕМ ===

  if (outputPath) {
    // Используем читаемое форматирование (как просили)
    const json = JSON.stringify(report, null, 2);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, json);

    const sizeKB = (json.length / 1024).toFixed(2);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Унифицированный граф сохранен: ${outputPath}`);
    console.log(`📊 Размер: ${sizeKB} KB`);
    console.log(`\n📊 СТАТИСТИКА:`);
    console.log(`   📌 Узлов: ${stats.tn}`);
    console.log(`   📌 Ребер: ${stats.te}`);
    console.log(`   📌 Файлов: ${stats.tf}`);
    console.log(`   📌 Модулей: ${stats.tm}`);
    console.log(`   📌 Функций: ${stats.tfn}`);
    console.log(`   📌 Констант: ${stats.tc}`);
    console.log(`   📌 Классов: ${stats.tcl}`);
    console.log(`   📌 Интерфейсов: ${stats.ti}`);
    console.log(`   📌 Типов: ${stats.tt}`);
    console.log(`   📌 Переменных: ${stats.tv}`);
    console.log(`   📌 Вызовов: ${stats.tca}`);
    console.log(`   📌 Импортов: ${stats.tim}`);
    console.log(`   📌 Экспортов: ${stats.tex}`);
    console.log(`   📌 Циклов: ${stats.cc}`);
    console.log(`   ⏱️  Время: ${duration} сек`);

    console.log(`\n💡 СТРУКТУРА ГРАФА (сокращенные ключи):`);
    console.log(`   • dict.t — типы узлов`);
    console.log(`   • dict.n — имена сущностей`);
    console.log(`   • dict.r — типы связей`);
    console.log(`   • dict.m — метаданные`);
    console.log(`   • st.tn — всего узлов`);
    console.log(`   • st.te — всего ребер`);
    console.log(`   • st.tfn — всего функций`);
    console.log(`   • st.tca — всего вызовов`);
  }

  return report;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function findExportingFile(moduleName: string, entitiesMap: Record<string, EntitiesResult>): string | null {
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const exp of entities.exports || []) {
      if (exp.source === moduleName) {
        return filePath;
      }
    }
  }
  return null;
}

function findCyclesInGraph(nodeCount: number, edges: [number, number, number, number][]): number[][] {
  const graph: Map<number, Set<number>> = new Map();
  for (let i = 0; i < nodeCount; i++) {
    graph.set(i, new Set());
  }
  for (const [from, to] of edges) {
    graph.get(from)!.add(to);
  }

  const cycles: number[][] = [];
  const visited = new Set<number>();
  const recursionStack = new Set<number>();
  const path: number[] = [];

  const dfs = (node: number) => {
    if (recursionStack.has(node)) {
      const start = path.indexOf(node);
      if (start !== -1) {
        cycles.push([...path.slice(start)]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) || []) {
      dfs(neighbor);
    }

    recursionStack.delete(node);
    path.pop();
  };

  for (let i = 0; i < nodeCount; i++) {
    if (!visited.has(i)) {
      dfs(i);
    }
  }

  return cycles;
}

// ============================================
// ЭКСПОРТ ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ API
// ============================================

export const findFunctionByName = (report: UnifiedGraphReport, name: string) => {
  const nameIdx = report.dict.n.indexOf(name);
  if (nameIdx === -1) return null;

  for (let i = 0; i < report.nodes.length; i++) {
    const node = report.nodes[i];
    if (!node) continue;
    if (node[1] === nameIdx) {
      const metaIdx = node[2];
      const meta = (metaIdx !== undefined && metaIdx !== -1 && metaIdx < report.dict.m.length)
          ? report.dict.m[metaIdx]
          : {};
      return {
        id: i,
        name,
        line: meta.l || 0,
        flags: meta.f || 0,
      };
    }
  }
  return null;
};

export const getFunctionCalls = (report: UnifiedGraphReport, nodeId: number) => {
  const callsIdx = report.dict.r.indexOf('calls');
  if (callsIdx === -1) return [];

  return report.edges
      .filter(e => {
        if (!e) return false;
        return e[0] === nodeId && e[2] === callsIdx;
      })
      .map(e => ({
        to: e[1],
        line: e[3] || 0,
      }));
};

export const getFunctionCallers = (report: UnifiedGraphReport, nodeId: number) => {
  const callsIdx = report.dict.r.indexOf('calls');
  if (callsIdx === -1) return [];

  return report.edges
      .filter(e => {
        if (!e) return false;
        return e[1] === nodeId && e[2] === callsIdx;
      })
      .map(e => ({
        from: e[0],
        line: e[3] || 0,
      }));
};

export const getFileName = (report: UnifiedGraphReport, nodeId: number): string | null => {
  const node = report.nodes[nodeId];
  if (!node) return null;
  const nameIdx = node[1];
  if (nameIdx === undefined || nameIdx === -1) return null;
  return report.dict.n[nameIdx] || null;
};

export const getModuleName = (report: UnifiedGraphReport, nodeId: number): string | null => {
  const node = report.nodes[nodeId];
  if (!node) return null;
  const nameIdx = node[1];
  if (nameIdx === undefined || nameIdx === -1) return null;
  return report.dict.n[nameIdx] || null;
};

export const getFunctionInfo = (report: UnifiedGraphReport, nodeId: number) => {
  const node = report.nodes[nodeId];
  if (!node) return null;

  const nameIdx = node[1];
  const metaIdx = node[2];

  const name = (nameIdx !== undefined && nameIdx !== -1 && nameIdx < report.dict.n.length)
      ? report.dict.n[nameIdx]
      : 'unknown';

  const meta = (metaIdx !== undefined && metaIdx !== -1 && metaIdx < report.dict.m.length)
      ? report.dict.m[metaIdx]
      : {};

  return {
    id: nodeId,
    name,
    line: meta.l || 0,
    flags: meta.f || 0,
    params: meta.p || [],
    returnType: meta.r || 'any',
    isAsync: !!(meta.f & 1),
    isExported: !!(meta.f & 2),
    calls: getFunctionCalls(report, nodeId),
    callers: getFunctionCallers(report, nodeId),
  };
};

export const decodeFlags = (flags: number): Record<string, boolean> => {
  return {
    isAsync: !!(flags & 1),
    isExported: !!(flags & 2),
    isMethod: !!(flags & 4),
    isArrow: !!(flags & 8),
    isEventHandler: !!(flags & 16),
    isNested: !!(flags & 32),
    isSelf: !!(flags & 64),
  };
};

export enum CompactFlags {
  NONE = 0,
  ASYNC = 1 << 0,
  EXPORTED = 1 << 1,
  METHOD = 1 << 2,
  ARROW = 1 << 3,
  EVENT_HANDLER = 1 << 4,
  NESTED = 1 << 5,
  SELF = 1 << 6,
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  generateCompactReport,
  findFunctionByName,
  getFunctionCalls,
  getFunctionCallers,
  getFileName,
  getModuleName,
  getFunctionInfo,
  decodeFlags,
  CompactFlags,
};
