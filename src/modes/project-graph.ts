// src/modes/project-graph.ts
// ============================================================
// ПОСТРОЕНИЕ ГРАФА ЗАВИСИМОСТЕЙ ПРОЕКТА
// ============================================================
// Версия: 3.0.0
//
// ИЗМЕНЕНИЯ v3.0.0 (устранение дублирования):
//   - ✅ УДАЛЕНА вся логика построения entitiesMap — теперь
//     используется `extractEntitiesFromFile` из reporters/json.
//   - ✅ УДАЛЕНА вся логика построения packageLockReport — теперь
//     используется `buildEnhancedPackageLockReport` из reporters/json.
//   - ✅ УДАЛЕНА вся логика построения relationshipGraph — теперь
//     используется `buildOptimizedRelationships` из reporters/json.
//   - ✅ УДАЛЕНА функция `buildInwardDependencies` — она есть
//     в reporters/json/graphs/.
//   - ✅ УДАЛЕНА функция `findPathBetweenFunctions` — вынесена
//     в reporters/json/graphs/find-path.ts.
//   - ✅ УДАЛЕНА функция `buildReport` — заменена на
//     `buildEnhancedPackageLockReport`.
//   - ✅ ОСТАВЛЕНА только оркестрация: ProjectGraphBuilder +
//     вызовы reporters/json.
//   - ✅ Экспорт `exportToDOT`, `findCyclesInGraph`, `getGraphStats`,
//     `findPathInGraph` — ОСТАВЛЕНЫ (это утилиты для работы с
//     графом, они не дублируются).
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - Добавлена интеграция enrichWithReExports
//   - Вызов enrichWithReExports ДО collectFullJSON
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация: buildProjectGraph + утилиты графа
// ============================================================

import path from 'path';
import fs from 'fs';
import {
  ProjectGraphBuilder,
  type GraphData,
  type GraphStats,
} from '../core/ProjectGraphBuilder.js';

import type { EntitiesResult } from '../types.js';
import type { EnhancedEntityInfo } from '../reporters/modules/types.js';

// ★ ЕДИНСТВЕННЫЙ ИСТОЧНИК анализа и отчётов
import { extractEntitiesFromFile } from '../reporters/json/extractors/extract-entities-from-file.js';
import { buildEnhancedPackageLockReport } from '../reporters/json/builders/enhanced-report.js';
import { buildOptimizedRelationships } from '../reporters/json/relationships/optimized-relationships.js';
import { findFunctionPath } from '../reporters/json/graphs/find-path.js';

// ============================================================
// ЭКСПОРТ ТИПОВ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
// ============================================================

export type { GraphData };

/**
 * Результат построения графа проекта.
 *
 * Содержит:
 *   - rootKey  — точка входа
 *   - graph    — граф зависимостей { module → [deps] }
 *   - entities — карта { filePath → EnhancedEntityInfo }
 *   - packageLockReport — полный отчёт (если includeEntities)
 *   - callGraphResult   — путь между функциями (если from/to)
 *   - relationshipGraph — отношения (calls/calledBy/importedBy)
 *   - stats    — статистика графа
 *   - levels   — уровни модулей
 */
export interface ProjectGraphResult {
  /** Точка входа */
  rootKey: string;
  /** Граф зависимостей */
  graph: Record<string, string[]>;
  /** Карта сущностей по файлам (если includeEntities) */
  entities?: Record<string, EnhancedEntityInfo>;
  /** Полный package-lock-подобный отчёт (если includeEntities) */
  packageLockReport?: any;
  /** Результат анализа пути между функциями */
  callGraphResult?: CallGraphPathResult;
  /** Отношения между функциями */
  relationshipGraph?: Record<string, RelationshipNode>;
  /** Статистика графа */
  stats?: GraphStats;
  /** Уровни модулей */
  levels?: Record<string, number>;
  /** Статистика разворачивания re-exports */
  reExportStats?: {
    expandedChains: number;
    filesWithReExports: number;
    maxDepth: number;
  };
}

/**
 * Результат анализа пути между функциями.
 */
export interface CallGraphPathResult {
  /** Найден ли путь */
  found: boolean;
  /** Путь (имена функций) */
  path?: string[];
  /** Причина, если путь не найден */
  reason?: string;
  /** Узлы пути */
  nodes?: { function: string; module: string; line: number; isAsync: boolean }[];
  /** Рёбра пути */
  edges?: { from: string; to: string; line: number }[];
}

/**
 * Узел отношений между функциями.
 */
export interface RelationshipNode {
  id: string;
  name: string;
  file: string;
  line: number;
  kind: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable';
  isExported: boolean;
  isAsync: boolean;
  params: string[];
  calls: string[];
  calledBy: string[];
  importedBy: ImportedByInfo[];
}

/**
 * Информация об импортёре.
 */
export interface ImportedByInfo {
  importerId: string;
  importerFile: string;
  importerVscode: string;
  importLine: number;
  specifier: string;
  importType?: 'named' | 'default' | 'namespace' | 'type';
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит граф зависимостей проекта.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Строит граф зависимостей через ProjectGraphBuilder
 *   2. Если includeEntities=true:
 *        a. Для каждого файла вызывает extractEntitiesFromFile
 *           (из reporters/json — единственный источник истины)
 *        b. Вызывает buildEnhancedPackageLockReport
 *           (из reporters/json — единственный источник истины)
 *   3. Если указаны fromFunction/toFunction:
 *        a. Вызывает findFunctionPath (из reporters/json)
 *
 * ════════════════════════════════════════════════════════════
 * ЧЕГО БОЛЬШЕ НЕ ДЕЛАЕТ (устранено дублирование)
 * ════════════════════════════════════════════════════════════
 *
 *   - ❌ НЕ собирает entitiesMap вручную
 *   - ❌ НЕ строит packageLockReport вручную
 *   - ❌ НЕ строит relationshipGraph вручную
 *   - ❌ НЕ реализует BFS для поиска пути между функциями
 *   - ❌ НЕ реализует buildInwardDependencies
 *
 * @param entryPoint     — точка входа (файл)
 * @param maxDepth       — максимальная глубина анализа
 * @param includeEntities — включать ли анализ сущностей
 * @param fromFunction   — начальная функция для поиска пути
 * @param toFunction     — конечная функция для поиска пути
 * @returns ProjectGraphResult
 */
export function buildProjectGraph(
  entryPoint: string,
  maxDepth: number = Infinity,
  includeEntities: boolean = false,
  fromFunction?: string,
  toFunction?: string
): ProjectGraphResult {
  console.log('📊 Building project graph...');
  console.log(`📄 Entry point: ${entryPoint}`);
  console.log(`📏 Max depth: ${maxDepth === Infinity ? '∞' : maxDepth}`);
  console.log(`🔍 Entities: ${includeEntities ? 'ON' : 'OFF'}`);

  if (fromFunction && toFunction) {
    console.log(`🎯 Path: ${fromFunction} → ${toFunction}`);
  }

  const startTime = Date.now();

  // ============================================================
  // ШАГ 1: Построение графа зависимостей
  // ============================================================
  const builder = new ProjectGraphBuilder({
    maxDepth,
    includeExternal: false,
  });

  const graphData = builder.build(entryPoint);
  const stats = builder.getStats();
  const levels = builder.getDepthMap();

  console.log(`   ✅ Graph built: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);
  console.log(`   🔄 Cycles: ${stats.cyclesCount}`);

  const result: ProjectGraphResult = {
    rootKey: graphData.rootKey,
    graph: graphData.graph,
    stats,
    levels: Object.fromEntries(levels),
  };

  // ============================================================
  // ШАГ 2: Анализ сущностей (если включён)
  // ============================================================
  if (includeEntities) {
    console.log('\n📦 Extracting entities...');

    // ------------------------------------------------------------
    // 2.1. Сбор сущностей через extractEntitiesFromFile
    //      (единственный источник истины — reporters/json)
    // ------------------------------------------------------------
    const entitiesMap: Record<string, EnhancedEntityInfo> = {};

    for (const filePath of Object.keys(graphData.graph)) {
      try {
        const absPath = path.resolve(filePath);
        if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
          continue;
        }

        const entities = extractEntitiesFromFile(absPath);
        if (entities && Object.keys(entities).length > 0) {
          entitiesMap[filePath] = entities;
        }
      } catch (error) {
        // Игнорируем ошибки отдельных файлов
        if (process.env.AST_DEBUG_PARSE === 'true') {
          console.debug(
            `   ⚠️ Failed to extract entities from ${filePath}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    console.log(`   ✅ Extracted entities from ${Object.keys(entitiesMap).length} files`);

    // ------------------------------------------------------------
    // 2.2. Построение EnhancedPackageLockReport
    //      (единственный источник истины — reporters/json)
    // ------------------------------------------------------------
    try {
      const packageLockReport = buildEnhancedPackageLockReport(
        graphData.rootKey,
        graphData.graph,
        entitiesMap as unknown as Record<string, EntitiesResult>,
        Object.keys(graphData.graph),
        { includeBody: false }
      );

      result.entities = entitiesMap;
      result.packageLockReport = packageLockReport;

      // Логирование статистики
      const totalFunctions = packageLockReport.entityStats?.totalFunctions || 0;
      const totalCalls = packageLockReport.entityStats?.totalCalls || 0;
      const totalImports = packageLockReport.entityStats?.totalImports || 0;

      console.log(`   ✅ Functions: ${totalFunctions}`);
      console.log(`   📞 Calls: ${totalCalls}`);
      console.log(`   📥 Imports: ${totalImports}`);
    } catch (error) {
      console.warn(
        `   ⚠️ Не удалось построить package-lock отчёт: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // ------------------------------------------------------------
    // 2.3. Построение relationshipGraph
    //      (единственный источник истины — reporters/json)
    // ------------------------------------------------------------
    try {
      const relationships = buildOptimizedRelationships(
        entitiesMap as unknown as Record<string, EntitiesResult>,
        graphData.graph
      );

      // Преобразуем в старый формат RelationshipNode
      const relationshipGraph: Record<string, RelationshipNode> = {};

      for (const [funcId, calls] of Object.entries(relationships.calls)) {
        // Находим саму функцию
        let funcData: any = null;
        let funcFile = '';
        for (const [filePath, entities] of Object.entries(entitiesMap)) {
          const found = entities.functions?.find((f: any) => f.id === funcId);
          if (found) {
            funcData = found;
            funcFile = filePath;
            break;
          }
        }

        if (!funcData) continue;

        relationshipGraph[funcData.name] = {
          id: funcId,
          name: funcData.name,
          file: funcFile,
          line: funcData.line || 0,
          kind: 'function',
          isExported: funcData.isExported || false,
          isAsync: funcData.isAsync || false,
          params: funcData.params || [],
          calls: (calls || []).map((c: any) => c.targetName),
          calledBy: (relationships.calledBy[funcId] || []).map((c: any) => c.callerName),
          importedBy: (relationships.importedBy[funcId] || []).map((imp: any) => ({
            importerId: imp.importerId,
            importerFile: imp.importerFile,
            importerVscode: imp.importerVscode,
            importLine: imp.importLine,
            specifier: imp.specifier,
            importType: imp.importType,
          })),
        };
      }

      result.relationshipGraph = relationshipGraph;

      let totalRelations = 0;
      for (const node of Object.values(relationshipGraph)) {
        totalRelations += node.calls.length + node.calledBy.length + node.importedBy.length;
      }
      console.log(
        `   ✅ ${Object.keys(relationshipGraph).length} nodes, ${totalRelations} relations`
      );
    } catch (error) {
      console.warn(
        `   ⚠️ Не удалось построить relationship graph: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // ============================================================
  // ШАГ 3: Поиск пути между функциями (если указан)
  // ============================================================
  if (fromFunction && toFunction && result.packageLockReport) {
    console.log(`\n🔍 Finding path: ${fromFunction} → ${toFunction}`);

    try {
      const callGraphResult = findFunctionPath(result.packageLockReport, fromFunction, toFunction);

      result.callGraphResult = callGraphResult;

      if (callGraphResult.found) {
        console.log(`   ✅ Path found: ${callGraphResult.path?.join(' → ')}`);
      } else {
        console.log(`   ❌ Path not found: ${callGraphResult.reason}`);
      }
    } catch (error) {
      console.warn(
        `   ⚠️ Ошибка поиска пути: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================
  // ШАГ 4: Итоги
  // ============================================================
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  Done in ${duration}s`);

  return result;
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ДЛЯ РАБОТЫ С ГРАФОМ
// ============================================================
// Эти утилиты НЕ дублируются — они специфичны для modes/project-graph.ts
// и используются в CLI-командах для визуализации/экспорта графа.
// ============================================================

/**
 * Экспортирует граф зависимостей в DOT-формат (Graphviz).
 *
 * ⚠️ Это упрощённая версия для графа модулей. Для полноценной
 * визуализации с циклами используйте `convertToDOT` из
 * `core/graph-utils.js`.
 *
 * @param graph — граф зависимостей { module → [deps] }
 * @returns строка в формате DOT
 */
export function exportToDOT(graph: Record<string, string[]>): string {
  let dot = 'digraph Dependencies {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

  for (const [from, deps] of Object.entries(graph)) {
    for (const to of deps) {
      dot += `  "${from}" -> "${to}";\n`;
    }
  }

  dot += '}\n';
  return dot;
}

/**
 * Находит циклические зависимости в графе.
 *
 * ⚠️ Это дубликат `findCyclesInGraph`, но используется
 * для обратной совместимости.
 *
 * @param graph — граф зависимостей
 * @returns массив циклов
 */
export function findCyclesInGraph(graph: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string) => {
    if (recursionStack.has(node)) {
      const start = path.indexOf(node);
      if (start !== -1) cycles.push(path.slice(start));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const dep of graph[node] || []) dfs(dep);

    recursionStack.delete(node);
    path.pop();
  };

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) dfs(node);
  }

  return cycles;
}

/**
 * Возвращает статистику графа.
 *
 * @param graph — граф зависимостей
 * @returns статистика
 */
export function getGraphStats(graph: Record<string, string[]>): GraphStats {
  let totalEdges = 0;
  for (const deps of Object.values(graph)) totalEdges += deps.length;

  const cycles = findCyclesInGraph(graph);

  return {
    totalNodes: Object.keys(graph).length,
    totalEdges,
    hasCycles: cycles.length > 0,
    cyclesCount: cycles.length,
  };
}

/**
 * Находит путь между двумя модулями (BFS).
 *
 * @param graph — граф зависимостей
 * @param from  — начальный модуль
 * @param to    — конечный модуль
 * @returns путь или null
 */
export function findPathInGraph(
  graph: Record<string, string[]>,
  from: string,
  to: string
): string[] | null {
  if (from === to) return [from];

  const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);

    for (const dep of graph[node] || []) {
      if (dep === to) return [...path, dep];
      if (!visited.has(dep)) {
        queue.push({ node: dep, path: [...path, dep] });
      }
    }
  }

  return null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  buildProjectGraph,
  exportToDOT,
  findCyclesInGraph,
  getGraphStats,
  findPathInGraph,
  ProjectGraphBuilder,
};
