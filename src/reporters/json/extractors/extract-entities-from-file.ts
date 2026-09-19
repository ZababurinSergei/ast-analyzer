// packages/ast-analyzer/src/reporters/json/extractors/extract-entities-from-file.ts

import type { EnhancedEntityInfo } from '../../../types.js';
import { parseFile } from '../../../core/ast-parser.js';
import { extractEntities } from '../../../core/entity-extractor.js';
import { convertEntitiesToEnhanced } from '../utils/entities-converter.js';

// ============================================================
// ЕДИНАЯ ТОЧКА ИЗВЛЕЧЕНИЯ СУЩНОСТЕЙ ИЗ ФАЙЛА
// ============================================================

/**
 * Извлекает сущности из одного файла.
 *
 * ════════════════════════════════════════════════════════════
 * ИСПОЛЬЗУЕТ ЕДИНЫЙ ОБРАБОТЧИК AST
 * ════════════════════════════════════════════════════════════
 *
 * Эта функция — тонкая обёртка над `extractEntities` из
 * `core/entity-extractor.ts`. Вся логика анализа AST (включая
 * обработку `export * from`) живёт в одном месте — в
 * `entity-extractor.ts`.
 *
 * Ранее (до рефакторинга) эта функция содержала ~500 строк
 * собственной логики на базе `ts-morph`, которая:
 *   - дублировала логику парсинга AST
 *   - не обрабатывала `ExportAllDeclaration` (export * from)
 *   - расходилась с поведением остальных частей системы
 *
 * Теперь весь код унифицирован. Это гарантирует, что:
 *   - `export * from` корректно извлекается во всех местах
 *   - логика анализа AST консистентна во всём проекте
 *   - изменения в правилах анализа делаются в одном месте
 *   - unit-тесты для `extractEntities` покрывают все пути использования
 *
 * ════════════════════════════════════════════════════════════
 * СХЕМА РАБОТЫ
 * ════════════════════════════════════════════════════════════
 *
 *   1. parseFile(filePath)              → AST (или null)
 *   2. extractEntities(ast, filePath)   → EntitiesResult
 *   3. convertEntitiesToEnhanced(...)   → EnhancedEntityInfo
 *
 * Шаг 3 конвертирует внутренний формат `EntitiesResult` в публичный
 * формат `EnhancedEntityInfo`, который используется репортёрами.
 *
 * ════════════════════════════════════════════════════════════
 * ПОВЕДЕНИЕ ПРИ ОШИБКАХ
 * ════════════════════════════════════════════════════════════
 *
 * - Если файл не существует или не может быть прочитан —
 *   `parseFile` возвращает `null`, и функция возвращает пустой
 *   `EnhancedEntityInfo` без выброса исключения.
 *
 * - Если AST пуст или некорректен — `extractEntities` вернёт
 *   `EntitiesResult` с пустыми массивами, и функция вернёт
 *   соответствующий `EnhancedEntityInfo`.
 *
 * - Любые исключения внутри `parseFile` / `extractEntities`
 *   логируются внутри этих функций и не выбрасываются наружу.
 *
 * @param filePath — путь к файлу (абсолютный или относительный)
 * @returns EnhancedEntityInfo — объект с массивами сущностей
 *          (functions, classes, constants, interfaces, types,
 *           variables, imports, exports)
 */
export function extractEntitiesFromFile(filePath: string): EnhancedEntityInfo {
  // ────────────────────────────────────────────────────────
  // Шаг 1: Парсинг файла в AST
  // ────────────────────────────────────────────────────────
  const ast = parseFile(filePath);

  if (!ast) {
    // Файл не существует, пустой, неподдерживаемый,
    // или содержит синтаксические ошибки.
    // Возвращаем пустой результат — это безопасное поведение
    // для fallback-пути в cli.ts.
    return createEmptyEnhancedEntityInfo();
  }

  // ────────────────────────────────────────────────────────
  // Шаг 2: Единый анализ AST
  // ────────────────────────────────────────────────────────
  // Извлекает все сущности, включая:
  //   - functions (обычные, стрелочные, методы, вложенные)
  //   - classes
  //   - constants
  //   - interfaces
  //   - types
  //   - variables
  //   - imports
  //   - exports (в т.ч. ✅ export * from, export * as ns from)
  //   - callGraph
  const entities = extractEntities(ast, filePath);

  // ────────────────────────────────────────────────────────
  // Шаг 3: Конвертация в публичный формат
  // ────────────────────────────────────────────────────────
  // EntitiesResult → EnhancedEntityInfo
  return convertEntitiesToEnhanced(entities);
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Создаёт пустой EnhancedEntityInfo.
 *
 * Используется, когда файл не может быть прочитан или
 * распарсен. Гарантирует, что все поля — массивы, чтобы
 * вызывающий код не делал лишних проверок на null/undefined.
 */
function createEmptyEnhancedEntityInfo(): EnhancedEntityInfo {
  return {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
    imports: [],
    exports: [],
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default extractEntitiesFromFile;