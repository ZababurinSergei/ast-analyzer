// src/pipeline/stages/parse-typescript.ts
// ============================================================
// STAGE 2a: PARSE TYPESCRIPT / JAVASCRIPT FILE
// ============================================================
// Версия: 1.1.0
//
// ИЗМЕНЕНИЯ v1.1.0 (нормализация путей, Вариант B):
//   - ✅ ДОБАВЛЕНО: резолвинг относительного пути в абсолютный
//     перед вызовом parseFile и extractEntitiesFromAST.
//     Причина: `file` приходит из ctx.files и является
//     относительным от projectRoot (после DiscoverFilesStage v1.1.0).
//     Для fs-операций, vscode-ссылок и idManager нужен абсолютный путь.
//   - ✅ ДОБАВЛЕНО: нормализация entities.filePath обратно
//     в относительный после extractEntitiesFromAST.
//     Причина: в отчёте (FullJSON.files[].path) должны быть
//     относительные пути — для переносимости и round-trip.
//   - ✅ ОБНОВЛЕНО: лог-функция logSuccess теперь получает
//     относительный путь (для красивого вывода в verbose-режиме).
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация.
//   - Поддержка всех TS/JS-расширений.
//   - Проверка расширения — защита от случайного вызова
//     на Vue-файлах или неподдерживаемых расширениях.
//   - Расширенное логирование в verbose-режиме.
//   - Обработка ошибок через возврат `null` (не throw).
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Ветка pipeline для файлов TypeScript / JavaScript / JSX / TSX.
// Вызывается из `ParseFileStage.dispatch()` для расширений:
//   • .ts
//   • .tsx
//   • .js
//   • .jsx
//   • .mjs
//   • .cjs
//
// Это ОСНОВНАЯ ветка. Vue-ветка (`.vue`) — отдельная
// (см. `parse-vue.ts`). После обработки обе ветки возвращают
// `EntitiesResult` в общий pipeline.
//
// СХЕМА
// ------------------------------------------------------------
//   file.ts / file.tsx / file.js / file.jsx / file.mjs / file.cjs
//                              │
//                              ▼
//              ✅ absolutePath = path.resolve(projectRoot, file)
//                              │
//                              ▼
//                     parseFile(absolutePath)
//                              │
//                              ▼
//                    { ast, content, ... }
//                              │
//                              ▼
//         extractEntitiesFromAST(ast, absolutePath)
//                              │
//                              ▼
//                       EntitiesResult
//                              │
//                              ▼
//         ✅ entities.filePath = file (относительный)
//                              │
//                              ▼
//              возврат в ParseFileStage.dispatch()
//
// ЧТО ВОЗВРАЩАЕТСЯ
// ------------------------------------------------------------
// Стандартный `EntitiesResult`:
//   • functions              — функции (обычные, стрелочные, методы)
//   • classes                — классы
//   • constants              — константы
//   • interfaces             — интерфейсы
//   • types                  — type aliases
//   • variables              — переменные (let/var)
//   • imports                — импорты
//   • exports                — экспорты (включая re-exports)
//   • callGraph              — граф вызовов
//   • moduleName, filePath   — метаданные (filePath — относительный)
//
// ⚠️ ВАЖНО: templateXxx-поля (Vue-специфичные) НЕ заполняются.
//     Это ожидаемо — в TS/JS-файлах нет `<template>`.
//
// ОСОБЕННОСТИ
// ------------------------------------------------------------
//   • Делегирует всю работу в ЕДИНЫЕ источники:
//       - `parseFile`              — парсинг в ESTree AST
//       - `extractEntitiesFromAST` — извлечение сущностей
//   • Не выбрасывает исключения без необходимости —
//     возвращает `null` для файлов, которые не удалось распарсить.
//   • Возвращает `null` для CSS, JSON, иконок и других
//     неподдерживаемых расширений (защита от случайного вызова).
//   • Логирует результат в verbose-режиме.
//
// ЗАВИСИМОСТИ
// ------------------------------------------------------------
//   • `parseFile`               — парсер ESTree AST.
//   • `extractEntitiesFromAST`  — единый извлекатель сущностей.
//   • `PipelineContext`         — общий контекст pipeline.
//
// ============================================================

import path from 'path';

import { parseFile } from '../../core/ast-parser.js';
import { extractEntitiesFromAST } from '../../core/entity-extractor/ast/extract-entities-from-ast.js';
import type { EntitiesResult } from '../../types.js';
import type { PipelineContext } from '../types.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

/**
 * Расширения, обрабатываемые этой веткой.
 *
 * Синхронизировано с `TS_JS_EXTENSIONS` в `parse-file.ts`
 * и с `DEFAULT_EXTENSIONS` в `ci-cd/collect-files.ts`.
 *
 * ВАЖНО: `.vue` СОЗНАТЕЛЬНО отсутствует — для Vue
 * используется отдельная ветка `parse-vue.ts`.
 */
const SUPPORTED_EXTENSIONS = new Set<string>(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * TS/JS-ветка pipeline.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверка расширения
 *        • Если не TS/JS — возвращаем null (не наш файл).
 *          Это защита: если кто-то вызовет функцию напрямую
 *          для .vue — она не сломается, а просто вернёт null.
 *
 *   2. ✅ Резолвинг пути
 *        • `file` приходит из ctx.files и является ОТНОСИТЕЛЬНЫМ
 *          от projectRoot (после DiscoverFilesStage v1.1.0).
 *        • Для fs-операций, vscode-ссылок и idManager нужен
 *          АБСОЛЮТНЫЙ путь.
 *        • `absolutePath = path.isAbsolute(file) ? file
 *                        : path.resolve(projectRoot, file)`
 *
 *   3. Парсинг в ESTree AST
 *        • `parseFile(absolutePath)` из `core/ast-parser.ts`.
 *        • Возвращает `ParsedFileInfo | null`.
 *        • Внутри обрабатывает:
 *            - Vue SFC (извлекает `<script>`)
 *            - JSON / CSS (пропускает)
 *            - битые файлы (возвращает null)
 *        • Для TS/JS-файлов возвращает полноценный AST.
 *
 *   4. Извлечение сущностей
 *        • `extractEntitiesFromAST(ast, absolutePath)` из
 *          `core/entity-extractor/ast/extract-entities-from-ast.ts`.
 *        • Возвращает `EntitiesResult` со всеми секциями:
 *            functions, classes, constants, interfaces,
 *            types, variables, imports, exports, callGraph.
 *        • Внутри: единый рекурсивный обход AST.
 *        • Включает сбор callbacks (v14.0.0).
 *        • ⚠️ Использует `absolutePath` для корректных
 *          vscode-ссылок и стабильных ID через idManager.
 *
 *   5. ✅ Нормализация entities.filePath
 *        • `extractEntitiesFromAST` записал АБСОЛЮТНЫЙ путь
 *          в `entities.filePath` (для vscode:// и idManager).
 *        • В отчёте мы хотим ОТНОСИТЕЛЬНЫЙ путь.
 *        • Заменяем: `entities.filePath = file` (относительный).
 *        • `entities.moduleName = path.basename(file)`.
 *
 *   6. Возврат
 *        • `EntitiesResult` — при успехе (с относительным filePath).
 *        • `null` — если файл не распарсился.
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 * Функция НЕ выбрасывает исключения:
 *   • parseFile — сам ловит ошибки и возвращает null.
 *   • extractEntitiesFromAST — оборачиваем в try/catch,
 *     чтобы одна ошибка не уронила весь pipeline.
 *
 * Логика:
 *   • Ошибка парсинга  → возвращаем null (файл пропускается).
 *   • Ошибка извлечения → логируем, возвращаем null.
 *
 * Это соответствует политике `ParseFileStage`:
 * при `continueOnError: true` битый файл не валит pipeline.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Успешный TS-файл (относительный путь из ctx.files)
 *   const entities = await parseTypeScriptFile(
 *     'src/utils.ts',
 *     ctx
 *   );
 *   // entities.functions = [...]
 *   // entities.filePath = 'src/utils.ts' (относительный)
 *
 *   // Битый файл
 *   const entities = await parseTypeScriptFile('src/broken.ts', ctx);
 *   // entities = null
 *
 *   // Не наш файл (защита от случайного вызова)
 *   const entities = await parseTypeScriptFile('src/App.vue', ctx);
 *   // entities = null
 *
 * @param file — путь к файлу (ОТНОСИТЕЛЬНЫЙ от projectRoot)
 * @param ctx  — контекст pipeline (для verbose-логирования)
 * @returns EntitiesResult или null
 */
export async function parseTypeScriptFile(
  file: string,
  ctx: PipelineContext
): Promise<EntitiesResult | null> {
  const { options } = ctx;

  // ────────────────────────────────────────────────────────
  // Шаг 1: Проверка расширения
  // ────────────────────────────────────────────────────────
  const ext = path.extname(file).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    if (options.verbose) {
      console.warn(
        `   ⏭️  parseTypeScriptFile: неподдерживаемое расширение ` +
          `'${ext}' для ${path.basename(file)}`
      );
    }
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 2: ✅ РЕЗОЛВИНГ ПУТИ
  // ────────────────────────────────────────────────────────
  // `file` приходит из ctx.files и является ОТНОСИТЕЛЬНЫМ
  // от projectRoot (после DiscoverFilesStage v1.1.0).
  //
  // Для парсинга, fs-операций, vscode-ссылок и idManager
  // нужен АБСОЛЮТНЫЙ путь.
  //
  // После анализа нормализуем entities.filePath обратно
  // в относительный — это то, что попадёт в отчёт.
  // ────────────────────────────────────────────────────────
  const absolutePath = path.isAbsolute(file) ? file : path.resolve(options.projectRoot, file);

  // ────────────────────────────────────────────────────────
  // Шаг 3: Парсинг в ESTree AST
  // ────────────────────────────────────────────────────────
  let parsed: ReturnType<typeof parseFile>;
  try {
    parsed = parseFile(absolutePath);
  } catch (error) {
    // parseFile обычно не бросает, но подстрахуемся
    if (options.verbose) {
      console.warn(
        `   ⚠️  parseFile упал на ${path.basename(file)}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    return null;
  }

  if (!parsed) {
    // Файл не существует, пустой, неподдерживаемый,
    // или содержит синтаксические ошибки.
    if (options.verbose) {
      console.warn(`   ⏭️  Не удалось распарсить: ${path.basename(file)}`);
    }
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 4: Извлечение сущностей из AST
  // ────────────────────────────────────────────────────────
  let entities: EntitiesResult;
  try {
    // ✅ ЕДИНЫЙ ИСТОЧНИК: extractEntitiesFromAST
    //    Работает на ESTree AST, извлекает:
    //      • functions (обычные, стрелочные, методы, вложенные)
    //      • classes
    //      • constants
    //      • interfaces
    //      • types
    //      • variables
    //      • imports
    //      • exports (включая re-exports: export * from)
    //      • callGraph (включая callback-рёбра, v14.0.0)
    //
    // ✅ Передаём АБСОЛЮТНЫЙ путь — чтобы vscode-ссылки
    //    внутри extractEntitiesFromAST были валидными,
    //    а idManager работал со стабильными ключами.
    entities = extractEntitiesFromAST(parsed.ast, absolutePath);
  } catch (error) {
    if (options.verbose) {
      console.warn(
        `   ⚠️  extractEntitiesFromAST упал на ${path.basename(file)}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 5: ✅ НОРМАЛИЗАЦИЯ entities.filePath
  // ────────────────────────────────────────────────────────
  // extractEntitiesFromAST записал в entities.filePath
  // АБСОЛЮТНЫЙ путь (для корректных vscode-ссылок и idManager).
  // Но в отчёте мы хотим ОТНОСИТЕЛЬНЫЙ путь.
  //
  // Заменяем filePath на относительный из ctx.files.
  // moduleName — basename относительного пути.
  // ────────────────────────────────────────────────────────
  entities.filePath = file;
  entities.moduleName = path.basename(file);

  // ────────────────────────────────────────────────────────
  // Шаг 6: Логирование в verbose-режиме
  // ────────────────────────────────────────────────────────
  if (options.verbose) {
    logSuccess(file, ext, entities);
  }

  return entities;
}

// ============================================================
// ЛОГИРОВАНИЕ
// ============================================================

/**
 * Логирует успешный парсинг TS/JS-файла.
 *
 * Формат:
 *   📄 utils.ts (12ƒ, 5const, 3imp, 2exp)
 *
 * Где:
 *   ƒ    — количество функций
 *   const — количество констант
 *   imp  — количество импортов
 *   exp  — количество экспортов
 *
 * Показываются только непустые секции — чтобы не было
 * шума из нулей.
 *
 * @param file     — путь к файлу (ОТНОСИТЕЛЬНЫЙ)
 * @param ext      — расширение (для иконки)
 * @param entities — результат парсинга
 */
function logSuccess(file: string, ext: string, entities: EntitiesResult): void {
  const name = path.basename(file);
  const parts: string[] = [];

  // Функции
  if (entities.functions.length > 0) {
    parts.push(`${entities.functions.length}ƒ`);
  }

  // Классы
  if (entities.classes.length > 0) {
    parts.push(`${entities.classes.length}cls`);
  }

  // Константы
  if (entities.constants.length > 0) {
    parts.push(`${entities.constants.length}const`);
  }

  // Интерфейсы + типы (объединяем для краткости)
  const typesCount = (entities.interfaces?.length ?? 0) + (entities.types?.length ?? 0);
  if (typesCount > 0) {
    parts.push(`${typesCount}type`);
  }

  // Переменные
  if (entities.variables.length > 0) {
    parts.push(`${entities.variables.length}var`);
  }

  // Импорты
  if (entities.imports.length > 0) {
    parts.push(`${entities.imports.length}imp`);
  }

  // Экспорты
  if (entities.exports.length > 0) {
    parts.push(`${entities.exports.length}exp`);
  }

  // Иконка: TSX/JSX отличается от TS/JS
  const icon = ext === '.tsx' || ext === '.jsx' ? '⚛️' : '📄';

  const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  console.log(`   ${icon} ${name}${suffix}`);
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ (ДЛЯ ТЕСТОВ И API)
// ============================================================

/**
 * Проверяет, поддерживается ли расширение этой веткой.
 *
 * Экспортируется для использования в тестах и в
 * `parse-file.ts::dispatch()` (если понадобится).
 *
 * @param ext — расширение (с точкой, любой регистр)
 * @returns true, если расширение обрабатывается TS/JS-веткой
 */
export function isTypeScriptExtension(ext: string): boolean {
  return SUPPORTED_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Возвращает список поддерживаемых расширений.
 *
 * Экспортируется для документации и отладки.
 *
 * @returns массив расширений
 */
export function getSupportedExtensions(): string[] {
  return Array.from(SUPPORTED_EXTENSIONS);
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default parseTypeScriptFile;
