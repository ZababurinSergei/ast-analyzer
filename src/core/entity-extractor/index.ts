// packages/ast-analyzer/src/core/entity-extractor/index.ts
// ==========================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ENTITY EXTRACTOR
// ==========================================
// Версия: 5.2.1
//
// Этот модуль реэкспортирует всё публичное API entity-extractor,
// сохраняя обратную совместимость с прежним API из entity-extractor.ts.
//
// Все импорты проекта, которые раньше использовали:
//   import { extractEntities } from '../core/entity-extractor.js';
// продолжают работать без изменений:
//   import { extractEntities } from '../core/entity-extractor/index.js';
//
// ИСПРАВЛЕНО: путь к типам изменён с '../types.js' на '../../types.js',
// так как файл находится в src/core/entity-extractor/index.ts,
// а типы — в src/types.ts (на 2 уровня выше).
// ==========================================

// ==========================================
// ГЛАВНЫЕ ФУНКЦИИ
// ==========================================

/** Главная функция извлечения всех сущностей из AST */
export { extractEntities } from './extract-entities.js';

/** Извлечение графа вызовов из AST */
export { extractCallGraph } from './extract-call-graph.js';

/** Стандартный анализ AST (без Vue) */
export { extractEntitiesFromAST } from './ast/extract-entities-from-ast.js';

// ==========================================
// ТИПЫ ОПЦИЙ
// ==========================================

/** Опции рекурсивного обхода AST */
export type { TraverseOptions } from './ast/extract-entities-from-ast.js';

// ==========================================
// VUE-КОНВЕРТЕРЫ
// ==========================================

/** Конвертер VueAnalysis → EntitiesResult */
export { convertVueAnalysisToEntities } from './vue/convert-analysis.js';

/** Конвертер импортов Vue → ImportInfo[] */
export { convertVueImportsToImportInfo } from './vue/convert-imports.js';

// ==========================================
// HELPERS (вспомогательные функции)
// ==========================================

export {
  /** Проверка, является ли узел обработчиком события */
  isEventHandler,
  /** Извлечение типа события из узла */
  extractEventType,
  /** Вычисление цикломатической сложности */
  calculateComplexity,
  /** Анализ безопасности тела функции */
  analyzeSecurity,
  /** Проверка, экспортируется ли узел */
  isNodeExported,
  /** Извлечение текста тела функции */
  extractBodyText,
  /** Извлечение значения из узла */
  extractValue,
  /** Создание пустого EntitiesResult */
  createEmptyEntitiesResult,
} from './helpers/index.js';

// ==========================================
// AST-УТИЛИТЫ
// ==========================================

/** Поиск узла функции в AST по имени */
export { findFunctionNode } from './ast/find-function-node.js';

/** Рекурсивный сбор всех вызовов из узла AST */
export { collectAllCallsRecursive } from './ast/collect-all-calls-recursive.js';

/** Преобразование экспортов из AST в ExportInfo[] */
export { processExports } from './ast/process-exports.js';

// ==========================================
// РЕЭКСПОРТ ИЗ call-collector (для обратной совместимости)
// ==========================================

export {
  /** Рекурсивный сбор всех вызовов функций из AST узла */
  collectAllCalls,
  /** Сбор всех вызовов без фильтрации по functionNames */
  collectAllCallsUnfiltered,
  /** Сбор всех объявленных функций в AST */
  collectDeclaredFunctions,
  /** Построение графа вызовов из AST */
  buildCallGraphFromAST,
  /** Поиск неиспользуемых функций */
  findUnusedFunctions,
  /** Поиск неразрешённых вызовов */
  findUnresolvedCalls,
} from '../call-collector.js';

// ==========================================
// РЕЭКСПОРТ ТИПА EntitiesResult
// ==========================================
// ✅ ИСПРАВЛЕНО: путь '../types.js' → '../../types.js'
// Файл src/core/entity-extractor/index.ts
// Типы: src/types.ts
// '../' = src/core/entity-extractor/
// '../../' = src/core/
// '../../../' = src/
// Значит правильный путь: '../../types.js'
// ==========================================

export type { EntitiesResult } from '../../types.js';

// ==========================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ==========================================

import { extractEntities } from './extract-entities.js';
import { extractCallGraph } from './extract-call-graph.js';
import { extractEntitiesFromAST } from './ast/extract-entities-from-ast.js';
import { convertVueAnalysisToEntities } from './vue/convert-analysis.js';
import { convertVueImportsToImportInfo } from './vue/convert-imports.js';
import { findFunctionNode } from './ast/find-function-node.js';
import { collectAllCallsRecursive } from './ast/collect-all-calls-recursive.js';
import { processExports } from './ast/process-exports.js';
import {
  isEventHandler,
  extractEventType,
  calculateComplexity,
  analyzeSecurity,
  isNodeExported,
  extractBodyText,
  extractValue,
  createEmptyEntitiesResult,
} from './helpers/index.js';
import {
  collectAllCalls,
  collectAllCallsUnfiltered,
  collectDeclaredFunctions,
  buildCallGraphFromAST,
  findUnusedFunctions,
  findUnresolvedCalls,
} from '../call-collector.js';

/**
 * Экспорт по умолчанию — объект со всем публичным API.
 * Удобно для использования как `import entityExtractor from '...'`
 */
export default {
  // Главные функции
  extractEntities,
  extractCallGraph,
  extractEntitiesFromAST,

  // Vue-конвертеры
  convertVueAnalysisToEntities,
  convertVueImportsToImportInfo,

  // AST-утилиты
  findFunctionNode,
  collectAllCallsRecursive,
  processExports,

  // Helpers
  isEventHandler,
  extractEventType,
  calculateComplexity,
  analyzeSecurity,
  isNodeExported,
  extractBodyText,
  extractValue,
  createEmptyEntitiesResult,

  // Реэкспорт из call-collector
  collectAllCalls,
  collectAllCallsUnfiltered,
  collectDeclaredFunctions,
  buildCallGraphFromAST,
  findUnusedFunctions,
  findUnresolvedCalls,
};
