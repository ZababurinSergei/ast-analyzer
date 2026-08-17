// src/modes/hybrid-report/generators/dot.ts

import type { HybridReport, HybridFunction } from '../types.js';

/**
 * Генерирует DOT граф для визуализации в Graphviz
 * @param report - Гибридный отчет
 * @returns Строка в формате DOT
 */
export function generateHybridDOT(report: HybridReport): string {
  let dot = 'digraph HybridGraph {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style="filled,rounded"];\n';
  dot += '  splines=true;\n';
  dot += '  ranksep=1.5;\n';
  dot += '  nodesep=0.8;\n\n';

  // Группируем модули по уровням
  const nodesByLevel: Record<number, any[]> = {};
  for (const module of report.modules) {
    const level = module.level;
    if (!nodesByLevel[level]) nodesByLevel[level] = [];
    nodesByLevel[level].push(module);
  }

  // Создаем подграфы для каждого уровня
  for (const level of Object.keys(nodesByLevel).sort((a, b) => parseInt(a) - parseInt(b))) {
    const levelNum = parseInt(level);
    dot += `  subgraph cluster_level_${levelNum} {\n`;
    dot += `    label="Уровень ${levelNum}";\n`;
    dot += `    style=filled;\n`;
    dot += `    fillcolor="#1a1a2e";\n`;
    dot += `    color="#4a4a6a";\n`;

    for (const module of nodesByLevel[levelNum] || []) {
      // Цвет в зависимости от типа модуля
      const color =
        module.type === 'vue'
          ? '#4ade80'
          : module.type === 'ts'
            ? '#60a5fa'
            : module.type === 'tsx'
              ? '#a78bfa'
              : '#fcd34d';

      const isRoot = module.path === report.root;
      const label = isRoot ? `⭐ ${module.name}` : module.name;

      // Узел модуля
      dot += `    "${module.path}" [fillcolor="${color}", label="${label}", penwidth=${isRoot ? 3 : 1}];\n`;

      // Узлы функций внутри модуля
      for (const func of module.functions) {
        const funcColor = func.isExported ? '#f87171' : '#fbbf24';
        const funcId = `${module.path}#${func.name}`;
        const funcLabel = func.isExported ? `📤 ${func.name}` : func.name;

        dot += `    "${funcId}" [fillcolor="${funcColor}", shape=ellipse, label="${funcLabel}", fontsize=10];\n`;
        dot += `    "${module.path}" -> "${funcId}" [style=dashed, color="#94a3b8", penwidth=0.5];\n`;

        // Связи между функциями (вызовы)
        for (const call of func.calls) {
          const targetFunc = module.functions.find((f: HybridFunction) => f.name === call);
          if (targetFunc) {
            const targetId = `${module.path}#${targetFunc.name}`;
            dot += `    "${funcId}" -> "${targetId}" [color="#ef4444", penwidth=1.5, label="вызов"];\n`;
          }
        }
      }
    }
    dot += '  }\n\n';
  }

  // Связи между модулями (импорты)
  for (const edge of report.graph.edges) {
    const fromLevel = report.levels[edge.from] ?? 0;
    const toLevel = report.levels[edge.to] ?? 0;
    const color = toLevel > fromLevel ? '#3b82f6' : '#f59e0b';
    const label = toLevel > fromLevel ? `↓ ур.${toLevel}` : `↺ цикл?`;
    dot += `  "${edge.from}" -> "${edge.to}" [color="${color}", label="${label}", penwidth=${toLevel > fromLevel ? 1 : 2}];\n`;
  }

  dot += '}\n';
  return dot;
}
