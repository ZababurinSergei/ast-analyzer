// src/modes/project-graph.ts
// ИСПРАВЛЕННАЯ ВЕРСИЯ - все ошибки TypeScript устранены
// Удалены неиспользуемые функции: buildEntitiesMap, buildReport,
// findPathBetweenFunctions, buildRelationshipGraph
// Функции встроены в buildProjectGraph для улучшения читаемости

import path from 'path';
import fs from 'fs';
import {
  ProjectGraphBuilder,
  type GraphData,
  type GraphStats,
} from '../core/ProjectGraphBuilder.js';
import { ReportBuilder } from '../reporters/core/ReportBuilder.js';
import type { EntitiesResult } from '../types.js';
import { extractEntitiesFromFile } from '../reporters/json-reporter.js';

// ============================================
// ЭКСПОРТ ТИПОВ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
// ============================================

export type { GraphData };

/**
 * Результат построения графа проекта
 */
export interface ProjectGraphResult {
  rootKey: string;
  graph: Record<string, string[]>;
  entities?: Record<string, EntitiesResult>;
  packageLockReport?: any;
  callGraphResult?: CallGraphPathResult;
  relationshipGraph?: Record<string, RelationshipNode>;
  stats?: GraphStats;
  levels?: Record<string, number>;
}

export interface CallGraphPathResult {
  found: boolean;
  path?: string[];
  reason?: string;
  nodes?: { function: string; module: string; line: number; isAsync: boolean }[];
  edges?: { from: string; to: string; line: number }[];
}

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

export interface ImportedByInfo {
  importerId: string;
  importerFile: string;
  importerVscode: string;
  importLine: number;
  specifier: string;
  importType?: 'named' | 'default' | 'namespace' | 'type';
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

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

  if (includeEntities) {
    console.log('\n📦 Extracting entities...');

    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО buildEntitiesMap
    const entitiesMap: Record<string, EntitiesResult> = {};
    for (const filePath of Object.keys(graphData.graph)) {
      try {
        const absPath = path.resolve(filePath);
        if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
          const enhancedEntities = extractEntitiesFromFile(absPath);
          if (enhancedEntities && Object.keys(enhancedEntities).length > 0) {
            entitiesMap[filePath] = enhancedEntities as unknown as EntitiesResult;
          }
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }

    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО buildReport
    const reportBuilder = new ReportBuilder();
    const report = reportBuilder.build(graphData, entitiesMap);
    const packageLockReport = {
      ...report,
      name: 'ast-analyzer',
      version: '3.0.0',
      lockfileVersion: 3,
      timestamp: new Date().toISOString(),
      dependencyGraph: {
        direction: 'bidirectional' as const,
        inwardDependencies: buildInwardDependencies(graphData.graph),
        outwardDependencies: graphData.graph,
      },
    };

    result.entities = entitiesMap;
    result.packageLockReport = packageLockReport;

    let totalFunctions = 0;
    let totalCalls = 0;
    let totalImports = 0;
    for (const entities of Object.values(entitiesMap)) {
      totalFunctions += entities.functions?.length || 0;
      for (const func of entities.functions || []) {
        totalCalls += func.calls?.length || 0;
      }
      totalImports += entities.imports?.length || 0;
    }
    console.log(`   ✅ Functions: ${totalFunctions}`);
    console.log(`   📞 Calls: ${totalCalls}`);
    console.log(`   📥 Imports: ${totalImports}`);

    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО findPathBetweenFunctions
    if (fromFunction && toFunction) {
      console.log(`\n🔍 Finding path: ${fromFunction} → ${toFunction}`);

      const nodes: string[] = packageLockReport.callGraph?.nodes || [];
      const edges: [number, number, number, number, number][] =
        packageLockReport.callGraph?.edges || [];

      const nodeIndex = new Map<string, number>();
      for (let i = 0; i < nodes.length; i++) {
        const nodeName = nodes[i];
        if (nodeName !== undefined) {
          nodeIndex.set(nodeName, i);
        }
      }

      const fromIdx = nodeIndex.get(fromFunction);
      const toIdx = nodeIndex.get(toFunction);

      let callGraphResult: CallGraphPathResult;

      if (fromIdx === undefined) {
        callGraphResult = {
          found: false,
          reason: `Function '${fromFunction}' not found in call graph`,
        };
      } else if (toIdx === undefined) {
        callGraphResult = {
          found: false,
          reason: `Function '${toFunction}' not found in call graph`,
        };
      } else {
        const callGraph: Record<number, number[]> = {};
        for (const [f, t] of edges) {
          if (!callGraph[f]) callGraph[f] = [];
          callGraph[f].push(t);
        }

        const visited = new Set<number>();
        const queue: { node: number; path: number[] }[] = [{ node: fromIdx, path: [fromIdx] }];
        let found = false;
        let pathNames: string[] = [];
        let pathNodes: { function: string; module: string; line: number; isAsync: boolean }[] = [];
        let pathEdges: { from: string; to: string; line: number }[] = [];

        while (queue.length > 0 && !found) {
          const { node, path: currentPath } = queue.shift()!;

          if (visited.has(node)) continue;
          visited.add(node);

          if (node === toIdx) {
            // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ИМЕН (исправлено)
            pathNames = currentPath.map(i => {
              const name = nodes[i];
              return name !== undefined ? name : `unknown_${i}`;
            });

            pathNodes = currentPath.map(i => ({
              function: nodes[i] !== undefined ? nodes[i] : `unknown_${i}`,
              module: 'unknown',
              line: 0,
              isAsync: false,
            }));

            pathEdges = currentPath
              .slice(0, -1)
              .map((i, idx) => {
                const nextIdx = currentPath[idx + 1];
                if (nextIdx === undefined) return null;

                const fromName = nodes[i] !== undefined ? nodes[i] : `unknown_${i}`;
                const toName = nodes[nextIdx] !== undefined ? nodes[nextIdx] : `unknown_${nextIdx}`;

                return {
                  from: fromName,
                  to: toName,
                  line: 0,
                };
              })
              .filter((item): item is { from: string; to: string; line: number } => item !== null);

            found = true;
            break;
          }

          for (const neighbor of callGraph[node] || []) {
            if (!visited.has(neighbor)) {
              queue.push({ node: neighbor, path: [...currentPath, neighbor] });
            }
          }
        }

        if (found) {
          callGraphResult = {
            found: true,
            path: pathNames,
            nodes: pathNodes,
            edges: pathEdges,
          };
        } else {
          callGraphResult = {
            found: false,
            reason: `No path found from '${fromFunction}' to '${toFunction}'`,
          };
        }
      }

      result.callGraphResult = callGraphResult;

      if (callGraphResult.found) {
        console.log(`   ✅ Path found: ${callGraphResult.path?.join(' → ')}`);
      } else {
        console.log(`   ❌ Path not found: ${callGraphResult.reason}`);
      }
    }

    // ✅ ВСТРОЕННАЯ ЛОГИКА ВМЕСТО buildRelationshipGraph
    console.log('\n🔗 Building relationship graph...');

    const relationshipGraph: Record<string, RelationshipNode> = {};
    const nodeDetails = packageLockReport.nodeDetails || {};

    for (const [idx, detail] of Object.entries(nodeDetails)) {
      const detailObj = detail as any;
      const funcName = detailObj?.n || `func_${idx}`;
      const fileId = detailObj?.f || 'unknown';
      const files = packageLockReport.files || {};
      const fileInfo = files[fileId] || { path: 'unknown' };

      relationshipGraph[funcName] = {
        id: idx,
        name: funcName,
        file: fileInfo.path || 'unknown',
        line: detailObj?.ln || 0,
        kind: (detailObj?.tp as RelationshipNode['kind']) || 'function',
        isExported: !!(detailObj?.fg & 32),
        isAsync: !!(detailObj?.fg & 1),
        params: detailObj?.p || [],
        calls: detailObj?.cl || [],
        calledBy: [],
        importedBy: [],
      };
    }

    // Строим calledBy
    for (const [funcName, info] of Object.entries(relationshipGraph)) {
      for (const [otherName, otherInfo] of Object.entries(relationshipGraph)) {
        if (otherInfo.calls.includes(funcName)) {
          info.calledBy.push(otherName);
        }
      }
    }

    // Строим importedBy
    const reverseIndex = (packageLockReport as any).reverseIndex || {};
    const importedByMap = reverseIndex.importedBy || {};

    for (const [targetId, importers] of Object.entries(importedByMap)) {
      for (const [, info] of Object.entries(relationshipGraph)) {
        if (info.id === targetId) {
          for (const imp of importers as any[]) {
            info.importedBy.push({
              importerId: imp.from || '',
              importerFile: imp.file || '',
              importerVscode: imp.vscode || '',
              importLine: imp.line || 0,
              specifier: imp.specifier || '',
              importType: imp.importType || 'named',
            });
          }
          break;
        }
      }
    }

    result.relationshipGraph = relationshipGraph;
    let totalRelations = 0;
    for (const node of Object.values(relationshipGraph)) {
      totalRelations += node.calls.length + node.calledBy.length + node.importedBy.length;
    }
    console.log(
      `   ✅ ${Object.keys(relationshipGraph).length} nodes, ${totalRelations} relations`
    );
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  Done in ${duration}s`);

  return result;
}

// ============================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ============================================

function buildInwardDependencies(graph: Record<string, string[]>): Record<string, string[]> {
  const inward: Record<string, string[]> = {};
  for (const [from, deps] of Object.entries(graph)) {
    for (const to of deps) {
      if (!inward[to]) inward[to] = [];
      if (!inward[to].includes(from)) inward[to].push(from);
    }
  }
  return inward;
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
// ============================================

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
      if (!visited.has(dep)) queue.push({ node: dep, path: [...path, dep] });
    }
  }
  return null;
}

export default {
  buildProjectGraph,
  exportToDOT,
  findCyclesInGraph,
  getGraphStats,
  findPathInGraph,
  ProjectGraphBuilder,
};
