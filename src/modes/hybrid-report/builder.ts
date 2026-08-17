// src/modes/hybrid-report/builder.ts

import path from 'path';
import fs from 'fs';
import { buildProjectGraph } from '../project-graph.js';
import { findCyclicEdges } from '../../core/graph-utils.js';
import type { HybridReport, HybridModule, HybridNode } from './types.js';
import { analyzeModule } from './analyzer.js';

/**
 * Строит гибридный отчет, объединяющий модули и их функции
 * @param entryPoint - Точка входа (файл, с которого начинается анализ)
 * @param maxDepth - Максимальная глубина анализа зависимостей
 * @returns HybridReport - Полный отчет со статистикой и графами
 */
export function buildHybridReport(entryPoint: string, maxDepth: number = 5): HybridReport {
  console.log('\n🔀 ГИБРИДНЫЙ ОТЧЕТ: МОДУЛИ + ФУНКЦИИ');
  console.log('='.repeat(70));
  console.log(`📄 Точка входа: ${entryPoint}`);
  console.log(`📏 Глубина: ${maxDepth}`);

  const startTime = Date.now();

  // 1. Строим граф зависимостей проекта
  const projectGraph = buildProjectGraph(entryPoint, maxDepth);

  // 2. Инициализируем структуры данных
  const modules = new Map<string, HybridModule>();
  const allNodes: HybridNode[] = [];
  const allEdges: { from: string; to: string; type: string; level?: number }[] = [];
  const cycles: string[][] = [];

  // 3. Собираем все файлы из графа
  const allFiles = new Set<string>();
  allFiles.add(projectGraph.rootKey);

  for (const [file, deps] of Object.entries(projectGraph.graph)) {
    allFiles.add(file);
    for (const dep of deps) {
      allFiles.add(dep);
    }
  }

  console.log(`\n📁 Найдено модулей: ${allFiles.size}`);

  // 4. Вычисляем уровни (BFS от корня)
  const fileLevels = new Map<string, number>();
  const queue: { file: string; level: number }[] = [{ file: projectGraph.rootKey, level: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { file, level } = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    fileLevels.set(file, level);

    const deps = projectGraph.graph[file] || [];
    for (const dep of deps) {
      if (!visited.has(dep) && !fileLevels.has(dep)) {
        queue.push({ file: dep, level: level + 1 });
      }
    }
  }

  // 5. Анализируем каждый файл
  let processed = 0;
  for (const filePath of allFiles) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) continue;

    processed++;
    const progress = Math.round((processed / allFiles.size) * 100);
    process.stdout.write(`\r   🔍 Анализ: ${processed}/${allFiles.size} (${progress}%)`);

    const level = fileLevels.get(filePath) ?? 0;
    const moduleInfo = analyzeModule(absPath, level);

    if (moduleInfo) {
      modules.set(filePath, moduleInfo);

      // Добавляем узел модуля
      const moduleNode: HybridNode = {
        id: filePath,
        type: moduleInfo.type === 'vue' ? 'component' : 'module',
        name: moduleInfo.name,
        file: filePath,
        level: level,
        exports: moduleInfo.exports,
        imports: moduleInfo.imports,
        functions: moduleInfo.functions,
        children: moduleInfo.functions.map(f => ({
          id: `${filePath}#${f.name}`,
          type: 'function',
          name: f.name,
          file: filePath,
          line: f.line,
          level: level,
          calls: f.calls,
          calledBy: f.calledBy,
          metadata: {
            isExported: f.isExported,
            isAsync: f.isAsync,
            params: f.params,
            returnType: f.returnType,
            exportSource: f.exportSource,
            exportModule: f.exportModule,
            startLine: f.startLine,
            endLine: f.endLine,
          },
        })),
        metadata: {
          components: moduleInfo.components,
          composables: moduleInfo.composables,
          level: level,
        },
      };
      allNodes.push(moduleNode);

      // Добавляем ребра зависимостей
      const deps = projectGraph.graph[filePath] || [];
      for (const dep of deps) {
        const depLevel = fileLevels.get(dep) ?? 0;
        allEdges.push({
          from: filePath,
          to: dep,
          type: 'import',
          level: depLevel,
        });
      }
    }
  }

  console.log(' ✅');

  // 6. Находим циклические зависимости
  const cyclicEdges = findCyclicEdges(projectGraph.graph);
  for (const edge of cyclicEdges) {
    const [from, to] = edge.split('->');
    if (from && to) {
      cycles.push([from, to]);
    }
  }

  // 7. Собираем статистику по уровням
  const byLevel: Record<number, { modules: number; functions: number }> = {};
  let totalFunctions = 0;
  let totalExports = 0;
  let totalImports = 0;
  let totalComponents = 0;
  let totalComposables = 0;

  for (const module of modules.values()) {
    const level = module.level;
    if (!byLevel[level]) {
      byLevel[level] = { modules: 0, functions: 0 };
    }
    byLevel[level].modules++;
    byLevel[level].functions += module.functions.length;

    totalFunctions += module.functions.length;
    totalExports += module.exports.length;
    totalImports += module.imports.length;
    totalComponents += module.components.length;
    totalComposables += module.composables.length;
  }

  // 8. Формируем итоговый отчет
  const stats = {
    totalModules: modules.size,
    totalFunctions,
    totalExports,
    totalImports,
    totalComponents,
    totalComposables,
    maxDepth,
    cycles: cycles.length,
    byLevel,
  };

  const report: HybridReport = {
    root: projectGraph.rootKey,
    modules: Array.from(modules.values()),
    graph: {
      nodes: allNodes,
      edges: allEdges,
    },
    stats,
    cycles,
    levels: Object.fromEntries(fileLevels),
  };

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  Готово за ${duration} сек`);
  console.log(`📊 Модулей: ${stats.totalModules}, Функций: ${stats.totalFunctions}`);

  return report;
}
