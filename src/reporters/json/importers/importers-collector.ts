// packages/ast-analyzer/src/reporters/json/importers/importers-collector.ts

import type {
  EntitiesResult,
  ImportedByInfo,
} from '../../../types.js';
import { resolveImportPath } from '../utils/path-resolver.js';
import { generateFileId } from '../utils/id-generator.js';
import idManager from '../../../core/IdManager.js';

// ============================================================
// ИМПОРТЁРЫ И ВЫЗЫВАЮЩИЕ
// ============================================================

/**
 * Получает локальное имя импортированной сущности, если она
 * импортирована под алиасом.
 *
 * Пример:
 *   // module.ts
 *   import { originalName as localName } from './other';
 *
 *   getImportedName('module.ts', 'originalName', entitiesMap)
 *     → 'localName'
 *
 *   // Если алиаса нет:
 *   import { originalName } from './other';
 *   getImportedName('module.ts', 'originalName', entitiesMap)
 *     → 'originalName'
 *
 *   // Если импорта нет:
 *   getImportedName('module.ts', 'unknown', entitiesMap)
 *     → null
 *
 * Используется в `findFunctionCallers` для сопоставления
 * вызовов в коде с оригинальными именами экспортов.
 *
 * @param modulePath    — путь к модулю, где ищем импорт
 * @param originalName  — оригинальное имя (то, что экспортируется)
 * @param entitiesMap   — карта всех сущностей проекта
 * @returns локальное имя (алиас) или null, если импорта нет
 */
export function getImportedName(
  modulePath: string,
  originalName: string,
  entitiesMap: Record<string, EntitiesResult>
): string | null {
  const entities = entitiesMap[modulePath];
  if (!entities) return null;

  for (const imp of entities.imports || []) {
    for (const spec of imp.specifiers) {
      const specObj =
        typeof spec === 'string'
          ? { imported: spec, local: spec }
          : spec;

      if (specObj.imported === originalName) {
        return specObj.local || specObj.imported;
      }
    }
  }

  return null;
}

/**
 * Собирает информацию об импортёрах для всех функций проекта.
 *
 * Для каждой функции строит массив `ImportedByInfo`, содержащий:
 *   - `importerId`       — ID файла-импортёра
 *   - `importerFile`     — путь к файлу-импортёру
 *   - `importerVscode`   — VSCode-ссылка на файл
 *   - `importLine`       — строка импорта
 *   - `specifier`        — локальное имя (алиас), под которым
 *                          функция используется в импортёре
 *   - `importType`       — 'named' | 'default' | 'namespace' | 'type'
 *
 * Результат имеет вид:
 *   {
 *     "<functionId>": [ ImportedByInfo, ... ],
 *     ...
 *   }
 *
 * Где `<functionId>` — уникальный ID функции из `IdManager`.
 *
 * ════════════════════════════════════════════════════════════
 * ОСОБЕННОСТИ
 * ════════════════════════════════════════════════════════════
 *
 * 1. Функция обрабатывает только реальные импорты
 *    (`ImportDeclaration`), не `require()` и не динамические
 *    импорты. Это соответствует тому, что `entities.imports`
 *    содержит только статические импорты.
 *
 * 2. Резолвинг пути импорта выполняется через `resolveImportPath`
 *    — тот же резолвер, что используется в других модулях.
 *
 * 3. Если путь импорта не резолвится (внешний модуль или
 *    несуществующий файл) — импорт пропускается.
 *
 * 4. Дедупликация: для одной функции из одного файла-импортёра
 *    записывается только одна запись (по `specifier`).
 *
 * ════════════════════════════════════════════════════════════
 * ИСПОЛЬЗОВАНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   const importedByMap = collectImporters(entitiesMap, graph);
 *   // importedByMap["func_abc123_myFunc"] → [ { importerFile: ... }, ... ]
 *
 * Далее эта карта используется в `buildOptimizedRelationships`
 * для встраивания связей `importedBy` в сущности.
 *
 * @param entitiesMap — карта всех сущностей проекта
 * @param graph       — граф зависимостей (модуль → зависимости)
 * @returns карта functionId → ImportedByInfo[]
 */
export function collectImporters(
  entitiesMap: Record<string, EntitiesResult>,
  graph: Record<string, string[]>
): Record<string, ImportedByInfo[]> {
  const importedByMap: Record<string, ImportedByInfo[]> = {};

  // ────────────────────────────────────────────────────────
  // Шаг 1: Инициализируем пустыми массивами все функции
  // ────────────────────────────────────────────────────────
  // Это гарантирует, что для каждой функции будет ключ в
  // результирующей карте, даже если её никто не импортирует.
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const id =
        func.id ||
        idManager.getFunctionId({
          filePath,
          funcName: func.name,
          line: func.line || 0,
          parentFunction: func.parentFunction,
          depth: func.depth || 0,
        });
      importedByMap[id] = [];
    }
  }

  // ────────────────────────────────────────────────────────
  // Шаг 2: Проходим по всем файлам и собираем импортёров
  // ────────────────────────────────────────────────────────
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const importerId = generateFileId(filePath);
    const importerVscode = `vscode://file/${filePath}`;

    for (const imp of entities.imports || []) {
      const source = imp.source;
      if (!source) continue;

      // Резолвим путь импорта в конкретный файл
      const resolvedPath = resolveImportPath(filePath, source, graph);
      if (!resolvedPath) continue;

      const targetEntities = entitiesMap[resolvedPath];
      if (!targetEntities) continue;

      // ────────────────────────────────────────────────────
      // Обрабатываем каждый specifier из импорта
      // ────────────────────────────────────────────────────
      for (const spec of imp.specifiers) {
        // Нормализуем specifier (может быть строкой или объектом)
        const specObj =
          typeof spec === 'string'
            ? { imported: spec, local: spec }
            : {
              imported: spec.imported || spec.local,
              local: spec.local || spec.imported,
            };

        const importedName = specObj.imported || specObj.local;
        if (!importedName) continue;

        // Ищем функцию в целевом модуле
        const targetFunc = targetEntities.functions.find(
          (f) => f.name === importedName
        );
        if (!targetFunc) continue;

        // Вычисляем ID целевой функции
        const targetId =
          targetFunc.id ||
          idManager.getFunctionId({
            filePath: resolvedPath,
            funcName: importedName,
            line: targetFunc.line || 0,
            parentFunction: targetFunc.parentFunction,
            depth: targetFunc.depth || 0,
          });

        // ────────────────────────────────────────────────
        // Защита от отсутствия ключа (на случай, если
        // targetId не был инициализирован в Шаге 1 —
        // например, из-за отсутствия func.id)
        // ────────────────────────────────────────────────
        if (!importedByMap[targetId]) {
          importedByMap[targetId] = [];
        }

        // ────────────────────────────────────────────────
        // Дедупликация: одна запись на (файл, specifier)
        // ────────────────────────────────────────────────
        const exists = importedByMap[targetId].some(
          (i) =>
            i.importerFile === filePath &&
            i.specifier === (specObj.local || importedName)
        );

        if (!exists) {
          importedByMap[targetId].push({
            importerId,
            importerFile: filePath,
            importerVscode,
            importLine: (imp as any).loc?.start?.line || 0,
            specifier: specObj.local || importedName,
            importType: (imp as any).isTypeOnly ? 'type' : 'named',
          });
        }
      }
    }
  }

  return importedByMap;
}

/**
 * Находит все модули, которые вызывают указанную функцию.
 *
 * В отличие от `collectImporters`, эта функция ищет не импорты,
 * а фактические **вызовы** функции в коде других модулей.
 *
 * Используется в `computeExportConsumers` (в `export-consumers.ts`)
 * для того, чтобы связать экспорт функции с её реальными
 * потребителями (не только с теми, кто её импортирует, но и
 * с теми, кто её вызывает).
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 * 1. Проходим по всем модулям проекта
 * 2. Для каждого модуля смотрим на все функции
 * 3. Для каждой функции смотрим на список её вызовов
 *    (`func.calls` — массив имён вызываемых функций)
 * 4. Если функция вызывает `functionName` (по оригинальному
 *    имени или по локальному алиасу) — добавляем модуль в
 *    список вызывающих.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАМЕЧАНИЯ
 * ════════════════════════════════════════════════════════════
 *
 * - Функция не проверяет, что вызов действительно разрешается
 *   в указанную функцию. Это эвристика: если имя совпадает —
 *   считаем, что это вызов.
 *
 * - Параметр `graph` зарезервирован для будущего использования
 *   (например, для резолвинга вызовов через цепочки реэкспортов).
 *   Сейчас не используется.
 *
 * @param functionName  — имя функции, для которой ищем вызывающих
 * @param entitiesMap   — карта всех сущностей проекта
 * @param _graph        — граф зависимостей (зарезервирован)
 * @returns массив модулей, в которых вызывается функция,
 *          с указанием строки вызова
 */
export function findFunctionCallers(
  functionName: string,
  entitiesMap: Record<string, EntitiesResult>,
  _graph: Record<string, string[]>
): { module: string; line: number }[] {
  const callers: { module: string; line: number }[] = [];

  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const calls = func.calls || [];

      for (const call of calls) {
        // Проверяем, вызывается ли функция по оригинальному
        // или по локальному имени
        const importedName = getImportedName(
          modulePath,
          functionName,
          entitiesMap
        );

        if (call === functionName || call === importedName) {
          callers.push({
            module: modulePath,
            line: func.line || 0,
          });
          break; // достаточно одного совпадения для этого модуля
        }
      }
    }
  }

  return callers;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  collectImporters,
  getImportedName,
  findFunctionCallers,
};