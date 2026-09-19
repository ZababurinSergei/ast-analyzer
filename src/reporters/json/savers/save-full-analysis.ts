// packages/ast-analyzer/src/reporters/json/savers/save-full-analysis.ts

import fs from 'fs';
import path from 'path';
import type { GraphData, EntitiesResult } from '../../../types.js';
import { buildFullAnalysis } from '../graphs/full-analysis.js';
import { safeTraverseAST } from '../../modules/utils.js';

// ============================================================
// СОХРАНЕНИЕ ПОЛНОГО АНАЛИЗА (МОДУЛИ + СУЩНОСТИ)
// ============================================================

/**
 * Строит и сохраняет полный анализ проекта на диск.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 * 1. Вызывает `buildFullAnalysis(data, entities, root)` —
 *    собирает граф модулей и граф сущностей в единый объект
 *    `FullAnalysis` со статистикой.
 *
 * 2. Очищает результат через `safeTraverseAST` — удаляет
 *    циклические ссылки, опасные ключи (`__proto__`,
 *    `constructor`, `_safeInfo`), чтобы JSON.stringify
 *    не падал и не создавал гигантских файлов.
 *
 * 3. Сериализует в JSON с отступом 2 пробела.
 *
 * 4. Создаёт целевую директорию, если её нет.
 *
 * 5. Записывает файл на диск в кодировке UTF-8.
 *
 * ════════════════════════════════════════════════════════════
 * СТРУКТУРА FULLANALYSIS
 * ════════════════════════════════════════════════════════════
 *
 *   {
 *     version: "3.0.0",
 *     root: "<точка входа>",
 *     timestamp: "<ISO>",
 *     stats: {
 *       totalModules, totalEntities,
 *       hasCycles, cycles,
 *       totalFunctions, totalClasses, totalConstants,
 *       totalInterfaces, totalTypes, totalVariables,
 *       maxDepth
 *     },
 *     moduleGraph: { nodes: [...], edges: [...] },
 *     entityGraph: { nodes: [...], edges: [...] }
 *   }
 *
 * ════════════════════════════════════════════════════════════
 * ИСПОЛЬЗОВАНИЕ
 * ════════════════════════════════════════════════════════════
 *
 * Вызывается из cli.ts при режиме `file --entities`:
 *
 *   saveFullAnalysis(
 *     normalizedData,
 *     entities,
 *     'full-analysis.json',
 *     currentTargetPath
 *   );
 *
 * @param data      — граф зависимостей (GraphData)
 * @param entities  — сущности файла (EntitiesResult)
 * @param outputPath — путь для сохранения JSON
 * @param root      — точка входа (используется как `root` в отчёте)
 */
export function saveFullAnalysis(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string,
  root: string
): void {
  // ────────────────────────────────────────────────────────
  // Шаг 1: Сборка полного анализа
  // ────────────────────────────────────────────────────────
  const fullAnalysis = buildFullAnalysis(data, entities, root);

  // ────────────────────────────────────────────────────────
  // Шаг 2: Очистка от циклических ссылок и опасных ключей
  // ────────────────────────────────────────────────────────
  // safeTraverseAST рекурсивно обходит объект и:
  //   - заменяет циклические ссылки на '[Circular]'
  //   - удаляет ключи: _safeInfo, __proto__, constructor, prototype
  // Это защищает JSON.stringify от падения на AST-узлах,
  // которые могут содержать ссылки на родителей.
  const safeData = safeTraverseAST(fullAnalysis);

  // ────────────────────────────────────────────────────────
  // Шаг 3: Сериализация в JSON
  // ────────────────────────────────────────────────────────
  const json = JSON.stringify(safeData, null, 2);

  // ────────────────────────────────────────────────────────
  // Шаг 4: Создание директории (если её нет)
  // ────────────────────────────────────────────────────────
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ────────────────────────────────────────────────────────
  // Шаг 5: Запись файла на диск
  // ────────────────────────────────────────────────────────
  fs.writeFileSync(outputPath, json, 'utf-8');
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default saveFullAnalysis;