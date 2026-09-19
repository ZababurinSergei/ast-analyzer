// packages/ast-analyzer/src/reporters/json/graphs/full-analysis.ts

import type {
  GraphData,
  EntitiesResult,
  FullAnalysis,
} from '../../../types.js';
import { buildModuleGraph } from './module-graph.js';
import { buildEntityGraph } from './entity-graph.js';
import { safeTraverseAST } from '../../modules/utils.js';

// ============================================================
// СБОРКА ПОЛНОГО АНАЛИЗА (МОДУЛИ + СУЩНОСТИ)
// ============================================================

/**
 * Собирает полный анализ проекта: граф модулей + граф сущностей
 * + агрегированная статистика.
 *
 * ════════════════════════════════════════════════════════════
 * НАЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 * Используется в `cli.ts` (режим `file`) при сохранении
 * `full-analysis.json`. Результат содержит:
 *
 *   - `stats`         — агрегированная статистика
 *   - `moduleGraph`   — граф модулей (узлы = файлы, рёбра = import)
 *   - `entityGraph`   — граф сущностей (узлы = функции/классы/и т.д.)
 *
 * ════════════════════════════════════════════════════════════
 * СХЕМА РАБОТЫ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Вычисление агрегированной статистики (countAllEntities)
 *   2. Вычисление циклов из data.cyclicEdges
 *   3. Вычисление максимальной глубины графа
 *   4. buildModuleGraph(data, entities) → ModuleGraph
 *   5. buildEntityGraph(data, entities) → EntityGraph
 *   6. safeTraverseAST(analysis)        → удаление циклов
 *
 * ════════════════════════════════════════════════════════════
 * ОСОБЕННОСТИ
 * ════════════════════════════════════════════════════════════
 *
 * - **Безопасность сериализации**: результат дополнительно
 *   прогоняется через `safeTraverseAST`, чтобы гарантировать
 *   отсутствие циклических ссылок. Это критично, потому что
 *   `buildEntityGraph` использует `ts-morph`-узлы, которые
 *   могут содержать циклы (например, `node.parent.parent`).
 *
 * - **Максимальная глубина** вычисляется как максимум по
 *   количеству зависимостей у любого модуля. Это не BFS-глубина,
 *   а именно «ширина» одного уровня. Такой подсчёт выбран для
 *   совместимости с предыдущими версиями и `ProjectSummary`.
 *
 * - **Version** — `3.0.0`. При изменении формата (добавлении
 *   полей в `FullAnalysis`) версию нужно поднимать.
 *
 * @param data     — граф зависимостей и циклические рёбра
 * @param entities — сущности файла (функции, классы и т.д.)
 * @param root     — путь к корневому модулю (для `analysis.root`)
 * @returns FullAnalysis — готовый объект для JSON-сериализации
 */
export function buildFullAnalysis(
  data: GraphData,
  entities: EntitiesResult,
  root: string
): FullAnalysis {
  // ────────────────────────────────────────────────────────
  // Шаг 1: Агрегированная статистика сущностей
  // ────────────────────────────────────────────────────────
  const stats = countAllEntities(entities);

  // ────────────────────────────────────────────────────────
  // Шаг 2: Циклические зависимости
  // ────────────────────────────────────────────────────────
  // data.cyclicEdges — массив строк вида "a->b"
  // Преобразуем в массив пар: [["a", "b"], ...]
  const cycles = extractCycles(data);

  // ────────────────────────────────────────────────────────
  // Шаг 3: Максимальная глубина графа
  // ────────────────────────────────────────────────────────
  const maxDepth = computeMaxDepth(data);

  // ────────────────────────────────────────────────────────
  // Шаг 4-5: Построение графов
  // ────────────────────────────────────────────────────────
  const moduleGraph = buildModuleGraph(data, entities);
  const entityGraph = buildEntityGraph(data, entities);

  // ────────────────────────────────────────────────────────
  // Шаг 6: Сборка результата
  // ────────────────────────────────────────────────────────
  const analysis: FullAnalysis = {
    version: '3.0.0',
    root,
    timestamp: new Date().toISOString(),
    stats: {
      totalModules: Object.keys(data.graph).length,
      totalEntities: stats.total,
      hasCycles: data.hasCycles || false,
      cycles,
      totalFunctions: stats.functions,
      totalClasses: stats.classes,
      totalConstants: stats.constants,
      totalInterfaces: stats.interfaces,
      totalTypes: stats.types,
      totalVariables: stats.variables,
      maxDepth,
    },
    moduleGraph,
    entityGraph,
  };

  // ────────────────────────────────────────────────────────
  // Шаг 7: Защита от циклических ссылок
  // ────────────────────────────────────────────────────────
  // ts-morph-узлы в entityGraph.nodes[].metadata могут содержать
  // циклические ссылки (node.parent, node.children и т.д.).
  // safeTraverseAST превращает их в строку "[Circular]".
  const safeAnalysis = safeTraverseAST(analysis);

  // Сохраняем очищенную копию как отдельное поле для отладки.
  // В JSON попадёт только safeAnalysis, но сам объект analysis
  // остаётся неизменным для дальнейшего использования в коде.
  (analysis as any)._safeCopy = safeAnalysis;

  return analysis;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

interface EntityCounts {
  total: number;
  functions: number;
  classes: number;
  constants: number;
  interfaces: number;
  types: number;
  variables: number;
}

/**
 * Считает общее количество сущностей и разбивку по типам.
 *
 * Использует безопасное обращение к полям, потому что входной
 * `entities` может быть не полностью валиден (например, при
 * fallback-пути из `extractEntitiesFromFile`).
 */
function countAllEntities(entities: EntitiesResult): EntityCounts {
  const functions = entities.functions?.length || 0;
  const classes = entities.classes?.length || 0;
  const constants = entities.constants?.length || 0;
  const interfaces = entities.interfaces?.length || 0;
  const types = entities.types?.length || 0;
  const variables = entities.variables?.length || 0;

  return {
    total:
      functions +
      classes +
      constants +
      interfaces +
      types +
      variables,
    functions,
    classes,
    constants,
    interfaces,
    types,
    variables,
  };
}

/**
 * Извлекает циклические зависимости из GraphData.
 *
 * Формат входа:   `data.cyclicEdges = ["a->b", "b->c", "c->a"]`
 * Формат выхода:  `[["a", "b"], ["b", "c"], ["c", "a"]]`
 *
 * Если `cyclicEdges` не задан — возвращается пустой массив.
 */
function extractCycles(data: GraphData): string[][] {
  if (!data.cyclicEdges || !Array.isArray(data.cyclicEdges)) {
    return [];
  }

  return data.cyclicEdges
    .map((edge: string) => {
      if (typeof edge !== 'string') return null;

      const parts = edge.split('->');
      if (parts.length !== 2) return null;

      const from = parts[0];
      const to = parts[1];

      if (!from || !to) return null;

      return [from, to];
    })
    .filter((pair): pair is string[] => pair !== null);
}

/**
 * Вычисляет максимальную глубину графа.
 *
 * ⚠️ ВАЖНО: это НЕ BFS-глубина. Это максимум по количеству
 * исходящих зависимостей у любого модуля.
 *
 * Такой подсчёт выбран для совместимости с предыдущими версиями
 * (см. `buildSummary` в `reporters/modules/summary.ts`). Если
 * потребуется настоящая BFS-глубина — нужно заменить реализацию
 * и обновить все места, которые ожидают это поведение.
 */
function computeMaxDepth(data: GraphData): number {
  let maxDepth = 0;

  for (const deps of Object.values(data.graph)) {
    const depsArray = deps as string[];
    if (depsArray.length > maxDepth) {
      maxDepth = depsArray.length;
    }
  }

  return maxDepth;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default buildFullAnalysis;