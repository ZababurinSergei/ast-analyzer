// src/modes/vue-analyzer.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ VUE-АНАЛИЗАТОРА
// ============================================
// Версия: 4.0.0
//
// ИЗМЕНЕНИЯ v4.0.0 (удаление props/emits/expose):
//   - ✅ УДАЛЕНЫ реэкспорты extractPropsFromSource,
//     extractPropsFromCompiledScript, extractPropsFromAST,
//     extractEmitsFromSource, extractEmitsFromCompiledScript,
//     extractEmitsFromAST, extractExposeFromCompiledScript,
//     extractExposeFromAST
//     Их функциональность перенесена в
//     core/relations/vue-macros-extractor.ts
//   - ✅ УДАЛЕН реэкспорт compileScriptBlock — больше не нужен
//     после удаления compiled-script-экстракторов
//   - ✅ Обновлён список реэкспортов из './vue-analyzer/index.js'
//     и './vue-analyzer/extractors/index.js'
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - Базовая структура с реэкспортом всех API
// ============================================

// ============================================
// РЕЭКСПОРТ ТИПОВ
// ============================================

export type { VueComponentAnalysis, AnalysisOptions } from './vue-analyzer/types.js';

// ============================================
// РЕЭКСПОРТ ОСНОВНЫХ ФУНКЦИЙ
// ============================================

export {
  // Парсинг
  parseVueFile,

  // Анализ template
  analyzeTemplate,

  // Построение графа вызовов
  buildCallGraphFromScript,

  // Генерация отчётов
  generateVueComponentReport,

  // Вспомогательные функции
  getNodeValue,

  // Основная функция анализа
  analyzeVueComponent,

  // Интеграция с split-module
  enhanceWithVueAnalysis,

  // CLI анализ
  analyzeVueComponentCli,

  // Поиск корня проекта
  findProjectRoot,

  // Глобальная карта компонентов
  buildGlobalComponentMap,
} from './vue-analyzer/index.js';

// ============================================
// РЕЭКСПОРТ ЭКСТРАКТОРОВ (низкоуровневый доступ)
// ============================================

export {
  // Imports
  extractImportsFromAST,
  extractImportsFromSource,
  extractImportsWithDetails,
  groupImportsByType,
  isImportUsed,
  filterUnusedImports,

  // Composables
  extractComposablesFromAST,
  extractComposablesFromSource,

  // Functions
  extractFunctionsFromScript,

  // Constants
  extractConstantsFromScript,

  // Variables
  extractVariablesFromScript,

  // Types
  extractTypesFromScript,

  // Interfaces
  extractInterfacesFromScript,

  // Slots
  extractSlotsFromAST,
  extractSlotsFromSource,
} from './vue-analyzer/extractors/index.js';

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

import {
  analyzeVueComponent,
  parseVueFile,
  analyzeTemplate,
  buildCallGraphFromScript,
  generateVueComponentReport,
  getNodeValue,
  enhanceWithVueAnalysis,
  analyzeVueComponentCli,
  buildGlobalComponentMap,
  findProjectRoot,
} from './vue-analyzer/index.js';

export default {
  analyzeVueComponent,
  parseVueFile,
  analyzeTemplate,
  buildCallGraphFromScript,
  generateVueComponentReport,
  getNodeValue,
  enhanceWithVueAnalysis,
  analyzeVueComponentCli,
  buildGlobalComponentMap,
  findProjectRoot,
};
