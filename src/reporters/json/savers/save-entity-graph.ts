// packages/ast-analyzer/src/reporters/json/savers/save-entity-graph.ts

import fs from 'fs';
import path from 'path';
import type { GraphData, EntitiesResult } from '../../../types.js';
import { buildEntityGraph } from '../graphs/entity-graph.js';
import { safeTraverseAST } from '../../modules/utils.js';

// ============================================================
// СОХРАНЕНИЕ ГРАФА СУЩНОСТЕЙ
// ============================================================

/**
 * Строит граф сущностей и сохраняет его в JSON-файл.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ТАКОЕ ГРАФ СУЩНОСТЕЙ
 * ════════════════════════════════════════════════════════════
 *
 * Граф сущностей — это представление всех сущностей проекта
 * (функции, классы, константы, интерфейсы, типы, переменные)
 * в виде узлов и связей между ними.
 *
 * Узлы (nodes):
 *   - function   — функция (обычная, стрелочная, метод, вложенная)
 *   - class      — класс
 *   - constant   — константа
 *   - interface  — интерфейс
 *   - type       — type alias
 *   - variable   — переменная (let/var)
 *   - enum       — перечисление
 *   - module     — модуль (как контейнер)
 *
 * Связи (edges):
 *   - function_call        — вызов функции
 *   - method_call          — вызов метода
 *   - class_extends        — наследование класса
 *   - class_implements     — имплементация интерфейса
 *   - interface_extends    — расширение интерфейса
 *   - type_reference       — ссылка на тип
 *   - constant_reference   — ссылка на константу
 *   - variable_reference   — ссылка на переменную
 *   - property_access      — доступ к свойству
 *   - import_binding       — импорт сущности
 *   - export_binding       — экспорт сущности
 *   - parameter_type       — тип параметра
 *   - return_type          — возвращаемый тип
 *   - enum_member          — член перечисления
 *
 * ════════════════════════════════════════════════════════════
 * СХЕМА РАБОТЫ
 * ════════════════════════════════════════════════════════════
 *
 *   1. buildEntityGraph(data, entities)
 *         ↓
 *      { nodes: EntityNode[], edges: EntityEdge[] }
 *
 *   2. safeTraverseAST(entityGraph)
 *         ↓
 *      очищенный объект без циклических ссылок и опасных полей
 *
 *   3. JSON.stringify(safeData, null, 2)
 *         ↓
 *      строка JSON
 *
 *   4. fs.writeFileSync(outputPath, json, 'utf-8')
 *         ↓
 *      файл на диске
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕНЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 * Используется в cli.ts при вызове команд:
 *   - `file <file> --entities` (для одного файла)
 *   - `project <file> --entities` (для проекта)
 *
 * Результат — файл `entity-graph.json` со структурой:
 *   {
 *     "nodes": [
 *       { "id": "src/index.ts#main", "name": "main", "type": "function", ... },
 *       ...
 *     ],
 *     "edges": [
 *       { "from": "src/index.ts#main", "to": "src/utils.ts#log", "type": "function_call", "line": 42 },
 *       ...
 *     ]
 *   }
 *
 * ════════════════════════════════════════════════════════════
 * БЕЗОПАСНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 * Перед сериализацией граф проходит через `safeTraverseAST`,
 * которая:
 *   - удаляет циклические ссылки (заменяет на '[Circular]')
 *   - удаляет поля `_safeInfo`, `__proto__`, `constructor`
 *   - рекурсивно обрабатывает вложенные объекты
 *
 * Это критично, потому что AST-узлы (Node из ts-morph) содержат
 * двунаправленные ссылки parent ↔ child, которые невозможно
 * сериализовать в JSON напрямую.
 *
 * @param data       — граф зависимостей проекта (rootKey + graph)
 * @param entities   — извлечённые сущности (результат extractEntities)
 * @param outputPath — путь для сохранения JSON-файла
 */
export function saveEntityGraph(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string
): void {
  // ────────────────────────────────────────────────────────
  // Шаг 1: Построение графа сущностей
  // ────────────────────────────────────────────────────────
  const entityGraph = buildEntityGraph(data, entities);

  // ────────────────────────────────────────────────────────
  // Шаг 2: Санитайзинг — удаление циклических ссылок
  // ────────────────────────────────────────────────────────
  // Без этого JSON.stringify бросит ошибку
  // "Converting circular structure to JSON".
  const safeData = safeTraverseAST(entityGraph);

  // ────────────────────────────────────────────────────────
  // Шаг 3: Сериализация в JSON
  // ────────────────────────────────────────────────────────
  const json = JSON.stringify(safeData, null, 2);

  // ────────────────────────────────────────────────────────
  // Шаг 4: Запись на диск
  // ────────────────────────────────────────────────────────
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, json, 'utf-8');

  // ────────────────────────────────────────────────────────
  // Шаг 5: Логирование
  // ────────────────────────────────────────────────────────
  const nodeCount = entityGraph.nodes?.length || 0;
  const edgeCount = entityGraph.edges?.length || 0;
  const sizeKB = (json.length / 1024).toFixed(2);

  console.log(
    `   ✅ entity-graph.json (${nodeCount} узлов, ${edgeCount} рёбер, ${sizeKB} KB)`
  );
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default saveEntityGraph;