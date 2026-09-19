// packages/ast-analyzer/src/reporters/json/savers/save-module-graph.ts

import fs from 'fs';
import path from 'path';
import type { GraphData, EntitiesResult } from '../../../types.js';
import { buildModuleGraph } from '../graphs/module-graph.js';
import { safeTraverseAST } from '../../modules/utils.js';

// ============================================================
// СОХРАНЕНИЕ ГРАФА МОДУЛЕЙ
// ============================================================

/**
 * Строит граф модулей и сохраняет его на диск в формате JSON.
 *
 * Граф модулей содержит:
 *   - nodes: список модулей с метаданными (размер, строки, язык, isEntry)
 *   - edges: список связей между модулями (import / external / re-export / dynamic_import)
 *
 * Файл используется:
 *   - CLI-командой `file` с флагом `--entities`
 *   - для отладки и визуализации в ast-graph-viewer
 *
 * Перед сериализацией граф проходит через `safeTraverseAST`, который:
 *   - удаляет циклические ссылки
 *   - вычищает опасные поля (`_safeInfo`, `__proto__`, `constructor`)
 *   - гарантирует, что результат сериализуем через JSON.stringify
 *
 * @param data       — граф зависимостей проекта ({ rootKey, graph })
 * @param entities   — извлечённые сущности (для аннотации рёбер specifiers)
 * @param outputPath — путь для сохранения JSON
 */
export function saveModuleGraph(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string
): void {
  // Шаг 1: Построение графа модулей
  const moduleGraph = buildModuleGraph(data, entities);

  // Шаг 2: Санитайзинг (удаление циклических ссылок и опасных полей)
  const safeData = safeTraverseAST(moduleGraph);

  // Шаг 3: Сериализация в JSON с отступами
  const json = JSON.stringify(safeData, null, 2);

  // Шаг 4: Гарантируем существование директории
  ensureDirectoryExists(outputPath);

  // Шаг 5: Запись на диск
  fs.writeFileSync(outputPath, json, 'utf-8');

  // Шаг 6: Логирование
  console.log(
    `   ✅ module-graph.json (${moduleGraph.nodes.length} nodes, ${moduleGraph.edges.length} edges)`
  );
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Гарантирует, что директория для выходного файла существует.
 * Если директории нет — создаёт её рекурсивно.
 */
function ensureDirectoryExists(outputPath: string): void {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default saveModuleGraph;