// src/reporters/full-reporter.ts

import type { EntitiesResult } from '../types.js';
import path from 'path';
import fs from 'fs';

/**
 * ПОЛНЫЙ ОТЧЕТ — максимально детальная информация
 *
 * Содержит ВСЕ метаданные о функциях, но только непустые поля.
 * Использует короткие ID (fn1, fn2, ...) вместо длинных хешей.
 *
 * Размер: ~8-10 MB для 1500 функций
 *
 * Когда использовать:
 * - Детальный аудит кода
 * - Поиск проблем безопасности
 * - Анализ сложности и архитектуры
 * - Отладка и профилирование
 */
export interface FullReport {
  /** Версия формата */
  version: string;
  /** Время генерации */
  timestamp: string;
  /** Корневой модуль (индекс) */
  root: string;

  /** Список модулей с полной информацией */
  modules: {
    id: string; // m1, m2, ...
    name: string; // имя модуля
    path: string; // относительный путь
    files: string[]; // индексы файлов (f1, f2, ...)
    functions: string[]; // индексы функций (fn1, fn2, ...)
    exports: string[]; // индексы экспортируемых функций
  }[];

  /** Список файлов */
  files: {
    id: string; // f1, f2, ...
    path: string; // относительный путь
    module: string; // индекс модуля (m1, m2, ...)
  }[];

  /** Функции с ПОЛНЫМИ метаданными (только непустые поля) */
  functions: {
    /** Уникальный короткий ID (fn1, fn2, ...) */
    id: string;
    /** Имя функции */
    name: string;
    /** Индекс модуля */
    module: string;
    /** Индекс файла */
    file: string;
    /** Строка определения */
    line: number;

    // === МЕТАДАННЫЕ (только если не пустые) ===

    /** Начальная строка (только если отличается от line) */
    startLine?: number;
    /** Конечная строка (только если отличается от line) */
    endLine?: number;
    /** Асинхронная функция */
    isAsync?: boolean;
    /** Экспортируется */
    isExported?: boolean;
    /** Метод класса */
    isMethod?: boolean;
    /** Имя класса (для методов) */
    className?: string;
    /** Вложенная функция */
    isNested?: boolean;
    /** Родительская функция (для вложенных) */
    parentFunction?: string;
    /** Стрелочная функция */
    isArrow?: boolean;
    /** Обработчик события */
    isEventHandler?: boolean;
    /** Тип события */
    eventType?: string;
    /** Глубина вложенности */
    depth?: number;
    /** Параметры функции */
    params?: string[];
    /** Тип возвращаемого значения (если не 'any') */
    returnType?: string;
    /** Цикломатическая сложность (если > 1) */
    complexity?: number;

    /** Информация о безопасности (только если есть проблемы) */
    security?: {
      hasEval: boolean;
      hasProcessEnv: boolean;
      hasSensitiveData: boolean;
      hasExec: boolean;
      hasPassword: boolean;
    };

    /** Тело функции (опционально, по умолчанию выключено) */
    body?: string;

    /** VSCode ссылка (опционально, по умолчанию выключена) */
    vscode?: string;

    // === СВЯЗИ (ВСЕГДА ПРИСУТСТВУЮТ) ===

    /** Кого вызывает эта функция (индексы fn1, fn2, ...) */
    calls: string[];
    /** Кто вызывает эту функцию (индексы fn1, fn2, ...) */
    calledBy: string[];
    /** Кто импортирует эту функцию */
    importedBy: {
      importerId: string; // индекс импортера (fn1, fn2, ...)
      importerFile: string; // индекс файла (f1, f2, ...)
      importerVscode: string; // VSCode ссылка
      importLine: number; // строка импорта
      specifier: string; // как импортируется
      importType?: 'named' | 'default' | 'namespace' | 'type';
    }[];
  }[];

  /** Граф вызовов (компактный массив) */
  callGraph: {
    nodes: string[]; // имена функций
    edges: [number, number, number, number, number][]; // [from, to, line, typeIdx, flags]
    types: string[]; // типы ребер
    cycles: string[][]; // циклические зависимости
  };

  /** Статистика */
  stats: {
    totalModules: number;
    totalFiles: number;
    totalFunctions: number;
    totalCalls: number;
    totalImports: number;
    totalExports: number;
    totalCycles: number;
    hasCycles: boolean;
  };
}

/**
 * БИТОВЫЕ ФЛАГИ для компактного хранения булевых полей
 * Используются в графе вызовов
 */
enum EdgeFlags {
  DIRECT = 0,
  ASYNC = 1 << 0,
  IMPORTED = 1 << 1,
  METHOD = 1 << 2,
  OPTIONAL = 1 << 3,
}

/**
 * Генерирует ПОЛНЫЙ отчет
 */
export function generateFullReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath?: string,
  options?: {
    /** Включить тела функций (увеличивает размер) */
    includeBody?: boolean;
    /** Включить информацию о безопасности */
    includeSecurity?: boolean;
    /** Включить VSCode ссылки */
    includeVSCode?: boolean;
    /** Минимальная сложность для включения (по умолчанию 1) */
    minComplexity?: number;
  }
): FullReport {
  console.log('\\n📊 Генерация ПОЛНОГО отчета...');
  const startTime = Date.now();

  const includeBody = options?.includeBody || false;
  const includeSecurity = options?.includeSecurity || false;
  const includeVSCode = options?.includeVSCode || false;
  const minComplexity = options?.minComplexity || 1;

  // 1. Строим индексы
  const moduleIndex = new Map<string, number>();
  const moduleList: string[] = [];
  const fileIndex = new Map<string, number>();
  const fileList: string[] = [];
  const functionIndex = new Map<string, number>();
  const functionList: any[] = [];

  // 2. Первый проход: собираем все сущности
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    // Добавляем файл
    if (!fileIndex.has(filePath)) {
      fileIndex.set(filePath, fileList.length);
      fileList.push(filePath);
    }

    // Добавляем модуль (директория)
    const dirName = path.basename(path.dirname(filePath)) || 'root';
    if (!moduleIndex.has(dirName)) {
      moduleIndex.set(dirName, moduleList.length);
      moduleList.push(dirName);
    }

    const moduleIdx = moduleIndex.get(dirName)!;
    const fileIdx = fileIndex.get(filePath)!;

    // Добавляем функции
    for (const func of entities.functions || []) {
      if (!func.name) continue;

      const funcId = `fn${functionList.length}`;
      functionIndex.set(funcId, functionList.length);

      // === ФОРМИРУЕМ ОБЪЕКТ ФУНКЦИИ ТОЛЬКО С НЕПУСТЫМИ ПОЛЯМИ ===
      const funcData: any = {
        id: funcId,
        name: func.name,
        module: `m${moduleIdx}`,
        file: `f${fileIdx}`,
        line: func.line || 0,
        // Связи (всегда есть)
        calls: (func.calls || []).map(call => {
          // Ищем индекс вызываемой функции
          for (let i = 0; i < functionList.length; i++) {
            if (functionList[i]?.name === call) {
              return `fn${i}`;
            }
          }
          return call; // внешний вызов
        }),
        calledBy: (func.calledBy || []).map(caller => {
          for (let i = 0; i < functionList.length; i++) {
            if (functionList[i]?.name === caller) {
              return `fn${i}`;
            }
          }
          return caller;
        }),
        importedBy: (func.importedBy || []).map(imp => ({
          importerId: imp.importerId || '',
          importerFile: imp.importerFile || '',
          importerVscode: imp.importerVscode || '',
          importLine: imp.importLine || 0,
          specifier: imp.specifier || '',
          importType: imp.importType || 'named',
        })),
      };

      // === ДОБАВЛЯЕМ ТОЛЬКО НЕПУСТЫЕ МЕТАДАННЫЕ ===

      if (func.startLine && func.startLine !== func.line) {
        funcData.startLine = func.startLine;
      }
      if (func.endLine && func.endLine !== func.line) {
        funcData.endLine = func.endLine;
      }
      if (func.isAsync) funcData.isAsync = true;
      if (func.isExported) funcData.isExported = true;
      if (func.isMethod) {
        funcData.isMethod = true;
        if (func.className) funcData.className = func.className;
      }
      if (func.isNested) {
        funcData.isNested = true;
        if (func.parentFunction) funcData.parentFunction = func.parentFunction;
      }
      if (func.isArrow) funcData.isArrow = true;
      if (func.isEventHandler) {
        funcData.isEventHandler = true;
        if (func.eventType) funcData.eventType = func.eventType;
      }
      if (func.depth && func.depth > 0) funcData.depth = func.depth;
      if (func.params && func.params.length > 0) funcData.params = func.params;
      if (func.returnType && func.returnType !== 'any') funcData.returnType = func.returnType;
      if (func.complexity && func.complexity > minComplexity) {
        funcData.complexity = func.complexity;
      }

      // Безопасность (только если есть проблемы)
      if (includeSecurity && func.security) {
        const sec = func.security;
        if (
          sec.hasEval ||
          sec.hasProcessEnv ||
          sec.hasSensitiveData ||
          sec.hasExec ||
          sec.hasPassword
        ) {
          funcData.security = {
            hasEval: sec.hasEval || false,
            hasProcessEnv: sec.hasProcessEnv || false,
            hasSensitiveData: sec.hasSensitiveData || false,
            hasExec: sec.hasExec || false,
            hasPassword: sec.hasPassword || false,
          };
        }
      }

      // Тело функции (опционально)
      if (includeBody && func.body) {
        funcData.body = func.body;
      }

      // VSCode ссылка (опционально)
      if (includeVSCode) {
        funcData.vscode = func.vscode || `vscode://file/${filePath}:${func.line}`;
      }

      functionList.push(funcData);
    }
  }

  console.log(
    `   📊 Найдено: ${functionList.length} функций, ${moduleList.length} модулей, ${fileList.length} файлов`
  );

  // 3. Строим граф вызовов
  const callNodes: string[] = [];
  const callEdges: [number, number, number, number, number][] = [];
  const callTypes = ['call', 'import', 'export', 'implements', 'extends'];

  // Добавляем узлы
  for (const func of functionList) {
    callNodes.push(func.name);
  }

  // Добавляем ребра
  for (let i = 0; i < functionList.length; i++) {
    const func = functionList[i];
    for (const call of func.calls || []) {
      // Пытаемся найти индекс вызываемой функции
      let toIdx = -1;
      for (let j = 0; j < functionList.length; j++) {
        if (functionList[j]?.name === call) {
          toIdx = j;
          break;
        }
      }
      if (toIdx !== -1) {
        // Определяем флаги
        let flags = EdgeFlags.DIRECT;
        if (functionList[toIdx]?.isAsync) flags |= EdgeFlags.ASYNC;
        if (functionList[toIdx]?.isExported) flags |= EdgeFlags.IMPORTED;
        if (functionList[toIdx]?.isMethod) flags |= EdgeFlags.METHOD;

        callEdges.push([i, toIdx, func.line || 0, 0, flags]);
      }
    }
  }

  // 4. Находим циклы
  const cycles = findCycles(callEdges, functionList.length);

  // 5. Статистика
  const stats = {
    totalModules: moduleList.length,
    totalFiles: fileList.length,
    totalFunctions: functionList.length,
    totalCalls: callEdges.length,
    totalImports: functionList.reduce((sum, f) => sum + (f.importedBy?.length || 0), 0),
    totalExports: functionList.filter(f => f.isExported).length,
    totalCycles: cycles.length,
    hasCycles: cycles.length > 0,
  };

  // 6. Формируем отчет
  const report: FullReport = {
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    root: `m0`,

    modules: moduleList.map((name, idx) => ({
      id: `m${idx}`,
      name,
      path: `../../${name}`,
      files: fileList
        .filter((_, fi) => functionList.some(f => f.module === `m${idx}` && f.file === `f${fi}`))
        .map((_, fi) => `f${fi}`),
      functions: functionList.filter(f => f.module === `m${idx}`).map(f => f.id),
      exports: functionList.filter(f => f.module === `m${idx}` && f.isExported).map(f => f.id),
    })),

    files: fileList.map((filePath, idx) => ({
      id: `f${idx}`,
      path: filePath,
      module: `m${functionList.find(f => f.file === `f${idx}`)?.module || 0}`,
    })),

    functions: functionList,

    callGraph: {
      nodes: callNodes,
      edges: callEdges,
      types: callTypes,
      cycles,
    },

    stats,
  };

  // 7. Сохраняем
  if (outputPath) {
    const json = JSON.stringify(report, null, 2);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, json);

    const sizeKB = (json.length / 1024).toFixed(2);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\\n✅ Полный отчет сохранен: ${outputPath}`);
    console.log(`📊 Размер: ${sizeKB} KB`);
    console.log(`📊 Функций: ${stats.totalFunctions}`);
    console.log(`📊 Вызовов: ${stats.totalCalls}`);
    console.log(`📊 Модулей: ${stats.totalModules}`);
    console.log(`📊 Файлов: ${stats.totalFiles}`);
    console.log(`📊 Циклы: ${stats.hasCycles ? 'ЕСТЬ' : 'НЕТ'}`);
    console.log(`⏱️  Время: ${duration} сек`);
  }

  return report;
}

/**
 * Находит циклические зависимости в графе
 */
function findCycles(
  edges: [number, number, number, number, number][],
  nodeCount: number
): string[][] {
  const graph: Map<number, Set<number>> = new Map();
  for (let i = 0; i < nodeCount; i++) {
    graph.set(i, new Set());
  }
  for (const [from, to] of edges) {
    graph.get(from)!.add(to);
  }

  const cycles: string[][] = [];
  const visited = new Set<number>();
  const recursionStack = new Set<number>();
  const path: number[] = [];

  const dfs = (node: number) => {
    if (recursionStack.has(node)) {
      const start = path.indexOf(node);
      if (start !== -1) {
        cycles.push(path.slice(start).map(i => `fn${i}`));
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
