// packages/ast-analyzer/src/reporters/json/builders/save-optimized.ts

import fs from 'fs';
import type {
  EntitiesResult,
  OptimizedReportOptions,
  ExtendedFunctionInfo,
} from '../../../types.js';
import { buildOptimizedRelationships } from '../relationships/optimized-relationships.js';
import idManager from '../../../core/IdManager.js';
// ✅ v9.0.5-fix: безопасная сериализация (BigInt, Map, Set, Circular)
import { safeJsonStringify } from '../../../utils/safe-json.js';

// ============================================================
// ТИПЫ
// ============================================================

interface OptimizedReport {
  version: string;
  timestamp: string;
  root: string;
  entities: Record<string, ExtendedFunctionInfo>;
  stats?: {
    totalFunctions: number;
    totalCalls: number;
    totalCalledBy: number;
    totalImportedBy: number;
    totalFiles: number;
  };
}

interface Relationships {
  calls: Record<string, any[]>;
  calledBy: Record<string, any[]>;
  importedBy: Record<string, any[]>;
}

interface BuildStats {
  totalFunctions: number;
  totalCalls: number;
  totalCalledBy: number;
  totalImportedBy: number;
}

// ============================================================
// ОСНОВНАЯ ПУБЛИЧНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Сохраняет оптимизированный отчёт с встроенными связями.
 *
 * Используется в cli.ts при вызове `project --entities --optimized`.
 *
 * Отличия от `savePackageLockReport`:
 *   - Все связи (calls, calledBy, importedBy) встроены в каждую сущность,
 *     а не вынесены в отдельные секции.
 *   - Меньше дублирования: сущность сразу содержит все свои связи.
 *   - Позволяет быстро навигировать от функции к функции без обхода графа.
 *
 * Этапы:
 *   1. Построение отношений между функциями (buildOptimizedRelationships)
 *   2. Сборка плоского словаря entities[id] → ExtendedFunctionInfo
 *   3. Формирование финального отчёта
 *   4. Сохранение JSON на диск
 *   5. Логирование статистики
 */
export function saveOptimizedPackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  outputPath: string,
  options: OptimizedReportOptions = {}
): void {
  // Очищаем кэш IdManager перед генерацией
  idManager.clear();

  // Дефолтные опции
  const {
    includeBody = false,
    includeVscodeLinks = true,
    includeStats = true,
    includeMetadata = false,
  } = options;

  console.log('\n📊 Генерация оптимизированного отчета с встроенными связями...');

  // Шаг 1: Построение отношений между функциями
  const relationships = buildOptimizedRelationships(entitiesMap, graph);

  // Шаг 2: Сборка плоского словаря сущностей
  const { entities, stats } = buildEntitiesDictionary(entitiesMap, relationships, {
    includeBody,
    includeVscodeLinks,
    includeMetadata,
  });

  // Шаг 3: Формирование финального отчёта
  const report = buildReport(rootKey, entities, stats, includeStats);

  // Шаг 4: Сохранение JSON
  saveReportToDisk(report, outputPath);

  // Шаг 5: Логирование статистики
  logOptimizedSummary(report, outputPath, options);
}

// ============================================================
// ШАГ 2: СБОРКА ПЛОСКОГО СЛОВАРЯ СУЩНОСТЕЙ
// ============================================================

interface BuildEntitiesOptions {
  includeBody: boolean;
  includeVscodeLinks: boolean;
  includeMetadata: boolean;
}

/**
 * Собирает плоский словарь entities[id] → ExtendedFunctionInfo.
 *
 * Каждая сущность содержит встроенные связи:
 *   - calls:     кто вызывает эту функцию (из этой функции)
 *   - calledBy:  кто вызывает эту функцию (в эту функцию)
 *   - importedBy: из каких файлов эта функция импортируется
 *
 * Возвращает также агрегированную статистику.
 */
function buildEntitiesDictionary(
  entitiesMap: Record<string, EntitiesResult>,
  relationships: Relationships,
  options: BuildEntitiesOptions
): {
  entities: Record<string, ExtendedFunctionInfo>;
  stats: BuildStats;
} {
  const { includeBody, includeVscodeLinks, includeMetadata } = options;

  const entities: Record<string, ExtendedFunctionInfo> = {};

  let totalFunctions = 0;
  let totalCalls = 0;
  let totalCalledBy = 0;
  let totalImportedBy = 0;

  for (const [filePath, fileEntities] of Object.entries(entitiesMap)) {
    for (const func of fileEntities.functions || []) {
      const id =
        func.id ||
        idManager.getFunctionId({
          filePath,
          funcName: func.name,
          line: func.line || 0,
          parentFunction: func.parentFunction,
          depth: func.depth || 0,
        });

      const vscode = includeVscodeLinks ? `vscode://file/${filePath}:${func.line}` : '';

      // Получаем связи из построенных отношений
      const funcCalls = relationships.calls[id] || [];
      const funcCalledBy = relationships.calledBy[id] || [];
      const funcImportedBy = relationships.importedBy[id] || [];

      totalCalls += funcCalls.length;
      totalCalledBy += funcCalledBy.length;
      totalImportedBy += funcImportedBy.length;

      // Формируем сущность
      const entity: ExtendedFunctionInfo = {
        id,
        name: func.name,
        file: filePath,
        line: func.line || 0,
        kind: 'function',
        isExported: func.isExported || false,
        isAsync: func.isAsync || false,
        params: func.params || [],
        paramsCount: (func.params || []).length,
        vscode,
        calls: funcCalls,
        calledBy: funcCalledBy,
        importedBy: funcImportedBy,
        returnType: func.returnType || 'any',
      };

      // Опционально: тело функции
      if (includeBody && func.body) {
        entity.body = func.body;
      }

      // Опционально: расширенные метаданные
      if (includeMetadata) {
        entity.metadata = buildEntityMetadata(func);
      }

      entities[id] = entity;
      totalFunctions++;
    }
  }

  return {
    entities,
    stats: {
      totalFunctions,
      totalCalls,
      totalCalledBy,
      totalImportedBy,
    },
  };
}

/**
 * Собирает дополнительные метаданные функции.
 * Используется только при includeMetadata = true.
 */
function buildEntityMetadata(func: any): Record<string, any> {
  return {
    startLine: func.startLine || func.line,
    endLine: func.endLine || func.line,
    isMethod: func.isMethod || false,
    className: func.className || '',
    isNested: func.isNested || false,
    parentFunction: func.parentFunction || '',
    isArrow: func.isArrow || false,
    isEventHandler: func.isEventHandler || false,
    eventType: func.eventType || '',
    depth: func.depth || 0,
    complexity: func.complexity || 1,
    security: func.security,
  };
}

// ============================================================
// ШАГ 3: ФОРМИРОВАНИЕ ФИНАЛЬНОГО ОТЧЁТА
// ============================================================

/**
 * Собирает финальный отчёт.
 */
function buildReport(
  rootKey: string,
  entities: Record<string, ExtendedFunctionInfo>,
  stats: BuildStats,
  includeStats: boolean
): OptimizedReport {
  return {
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    root: rootKey,
    entities,
    stats: includeStats
      ? {
          totalFunctions: stats.totalFunctions,
          totalCalls: stats.totalCalls,
          totalCalledBy: stats.totalCalledBy,
          totalImportedBy: stats.totalImportedBy,
          totalFiles: countUniqueFiles(entities),
        }
      : undefined,
  };
}

/**
 * Считает количество уникальных файлов, в которых есть сущности.
 */
function countUniqueFiles(entities: Record<string, ExtendedFunctionInfo>): number {
  const files = new Set<string>();
  for (const entity of Object.values(entities)) {
    if (entity.file) {
      files.add(entity.file);
    }
  }
  return files.size;
}

// ============================================================
// ШАГ 4: СОХРАНЕНИЕ JSON НА ДИСК
// ============================================================

/**
 * Сохраняет отчёт на диск.
 *
 * ✅ v9.0.5-fix: используем `safeJsonStringify` вместо нативного
 * `JSON.stringify`. Это решает проблему с BigInt (падало с
 * "Do not know how to serialize a BigInt"), а также безопасно
 * обрабатывает Map, Set, циклические ссылки и опасные ключи
 * (`__proto__`, `constructor`, `_safeInfo`).
 *
 * Ранее здесь был inline-обработчик, который умел только
 * Map/Set/опасные ключи, но НЕ умел BigInt. Теперь логика
 * сериализации вынесена в единый модуль `utils/safe-json.ts`
 * и переиспользуется во всех местах.
 */
function saveReportToDisk(report: OptimizedReport, outputPath: string): void {
  // ✅ ИСПРАВЛЕНО: безопасная сериализация (BigInt, Map, Set, Circular)
  const json = safeJsonStringify(report);

  const outputDir = require('path').dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, json, 'utf-8');
}

// ============================================================
// ШАГ 5: ЛОГИРОВАНИЕ
// ============================================================

/**
 * Логирует итоговую статистику оптимизированного отчёта.
 */
function logOptimizedSummary(
  report: OptimizedReport,
  outputPath: string,
  options: OptimizedReportOptions
): void {
  const stats = report.stats || {
    totalFunctions: Object.keys(report.entities).length,
    totalCalls: 0,
    totalCalledBy: 0,
    totalImportedBy: 0,
    totalFiles: 0,
  };

  // Проверка дублирующихся ID
  const validation = idManager.validate();
  if (!validation.valid) {
    console.warn(`⚠️ Найдены дублирующиеся ID: ${validation.duplicates.join(', ')}`);
  }

  // Статистика ID
  const idStats = idManager.getStats();
  console.log(`\n🔑 СТАТИСТИКА ID (saveOptimizedPackageLockReport):`);
  console.log(`   📝 Всего сгенерировано ID: ${idStats.total}`);
  console.log(`   ✅ Уникальных ID: ${idStats.unique}`);

  // Итоги
  console.log(`✅ Оптимизированный отчет сохранен: ${outputPath}`);
  console.log(`📊 Функций: ${stats.totalFunctions}`);
  console.log(`📞 Вызовов (calls): ${stats.totalCalls}`);
  console.log(`📞 Обратных вызовов (calledBy): ${stats.totalCalledBy}`);
  console.log(`📥 Импортов (importedBy): ${stats.totalImportedBy}`);

  // Размер файла
  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(2);
  console.log(`💾 Размер: ${sizeKB} KB`);

  // Опции
  console.log(
    `   🔗 VSCode ссылки: ${options.includeVscodeLinks !== false ? 'включены' : 'выключены'}`
  );
  console.log(`   📝 Тела функций: ${options.includeBody === true ? 'включены' : 'выключены'}`);
  console.log(`   📋 Метаданные: ${options.includeMetadata === true ? 'включены' : 'выключены'}`);
  console.log(
    `   📊 Статистика в отчёте: ${options.includeStats !== false ? 'включена' : 'выключена'}`
  );
}
