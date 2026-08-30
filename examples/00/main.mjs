// main.mjs
import { optimizer } from './graph-optimizer.mjs';

console.log('=== Graph Optimizer Demo ===\n');

// Получаем список всех функций
const allFunctionNames = Array.from(optimizer.functionIdByName.keys());
console.log(`Всего функций: ${optimizer.functionMap.size}`);
console.log(`Уникальных имен: ${allFunctionNames.length}\n`);

// 1. Находим самый длинный путь в графе
console.log('--- 1. Самый длинный путь в графе ---');
const longestPathResult = optimizer.findLongestPathInGraph();
if (longestPathResult.path) {
  const fromName =
    optimizer.getFunctionInfo(longestPathResult.from)?.name || longestPathResult.from;
  const toName = optimizer.getFunctionInfo(longestPathResult.to)?.name || longestPathResult.to;
  console.log(`Самый длинный путь: ${fromName} -> ${toName}`);
  console.log(`Длина: ${longestPathResult.length} шагов`);
  console.log('Путь:');
  longestPathResult.path.forEach((id, i) => {
    const entity = optimizer.getFunctionInfo(id);
    console.log(`  ${i + 1}. ${entity?.name || id}`);
  });
} else {
  console.log('Путей не найдено');
}
console.log();

// 2. Находим хабы (узлы с наибольшей степенью)
console.log('--- 2. Хабы графа (топ-5) ---');
const hubs = optimizer.findHubs(5);
hubs.forEach((hub, i) => {
  console.log(`${i + 1}. ${hub.name}`);
  console.log(
    `   Исходящих: ${hub.outDegree}, Входящих: ${hub.inDegree}, Всего: ${hub.totalDegree}`
  );
});
console.log();

// 3. Находим сильно связанные компоненты
console.log('--- 3. Сильно связанные компоненты ---');
const sccs = optimizer.findSCCs();
console.log(`Найдено SCC: ${sccs.length}`);
sccs.slice(0, 5).forEach((scc, i) => {
  const names = scc.map(id => optimizer.getFunctionInfo(id)?.name || id);
  console.log(`  SCC ${i + 1}: [${names.join(', ')}] (${scc.length} узлов)`);
});
if (sccs.length > 5) {
  console.log(`  ... и еще ${sccs.length - 5} SCC`);
}
console.log();

// 4. Находим пути с минимальной длиной
console.log('--- 4. Пути длиной >= 5 ---');
const longPaths = optimizer.findPathsWithMinLength(5);
console.log(`Найдено ${longPaths.length} путей длиной >= 5`);
longPaths.slice(0, 3).forEach((item, i) => {
  const fromName = optimizer.getFunctionInfo(item.from)?.name || item.from;
  const toName = optimizer.getFunctionInfo(item.to)?.name || item.to;
  console.log(`  ${i + 1}. ${fromName} -> ${toName}: ${item.length} шагов`);
});
console.log();

// 5. Находим конкретный длинный путь и показываем детали
console.log('--- 5. Детальный анализ длинного пути ---');
if (longPaths.length > 0) {
  const selectedPath = longPaths[0];
  console.log(
    `Путь от ${optimizer.getFunctionInfo(selectedPath.from)?.name || selectedPath.from} к ${optimizer.getFunctionInfo(selectedPath.to)?.name || selectedPath.to}:`
  );
  console.log(`Длина: ${selectedPath.length} шагов`);

  // Показываем первые 10 шагов и последние 5
  const path = selectedPath.path;
  const showCount = 10;
  if (path.length > showCount + 5) {
    path.slice(0, showCount).forEach((id, i) => {
      const entity = optimizer.getFunctionInfo(id);
      console.log(`  ${i + 1}. ${entity?.name || id}`);
    });
    console.log(`  ... (${path.length - showCount - 5} шагов пропущено) ...`);
    path.slice(-5).forEach((id, i) => {
      const entity = optimizer.getFunctionInfo(id);
      console.log(`  ${path.length - 5 + i + 1}. ${entity?.name || id}`);
    });
  } else {
    path.forEach((id, i) => {
      const entity = optimizer.getFunctionInfo(id);
      console.log(`  ${i + 1}. ${entity?.name || id}`);
    });
  }
}
console.log();

// 6. Статистика графа
console.log('--- 6. Статистика ---');
let totalEdges = 0;
let maxOutDegree = 0;
let maxInDegree = 0;
let isolatedCount = 0;

for (const [id, edges] of optimizer.callGraph) {
  const outDegree = edges.size;
  const inDegree = (optimizer.reverseGraph.get(id) || new Set()).size;
  totalEdges += outDegree;
  if (outDegree > maxOutDegree) maxOutDegree = outDegree;
  if (inDegree > maxInDegree) maxInDegree = inDegree;
  if (outDegree === 0 && inDegree === 0) isolatedCount++;
}

console.log(`Всего функций: ${optimizer.functionMap.size}`);
console.log(`Всего ребер: ${totalEdges}`);
console.log(`Средняя степень: ${(totalEdges / optimizer.functionMap.size).toFixed(2)}`);
console.log(`Максимальная исходящая степень: ${maxOutDegree}`);
console.log(`Максимальная входящая степень: ${maxInDegree}`);
console.log(`Изолированных узлов: ${isolatedCount}`);
console.log(
  `Процент достижимости: ${totalEdges > 0 ? ((optimizer.allReachableCache.size / optimizer.functionMap.size) * 100).toFixed(2) : 0}%`
);

console.log('\n=== Демонстрация завершена ===');
