// src/modes/vue-analyzer.ts
// Основной файл - реэкспорт всех API из модуля vue-analyzer

// Реэкспорт типов
export type {
  VueComponentAnalysis,
  AnalysisOptions,
} from './vue-analyzer/types.js';

// Реэкспорт основных функций
export {
  // Парсинг
  parseVueFile,
  compileScriptBlock,
  // Анализ template
  analyzeTemplate,
  // Построение графа вызовов
  buildCallGraphFromScript,
  // Генерация отчетов
  generateVueComponentReport,
  // Вспомогательные функции
  getNodeValue,
  // Основная функция анализа
  analyzeVueComponent,
  // Интеграция с split-module
  enhanceWithVueAnalysis,
  // CLI анализ
  analyzeVueComponentCli,
} from './vue-analyzer/index.js';

// Реэкспорт экстракторов (для низкоуровневого доступа)
export {
  // Props
  extractPropsFromSource,
  extractPropsFromCompiledScript,
  extractPropsFromAST,
  // Emits
  extractEmitsFromSource,
  extractEmitsFromCompiledScript,
  extractEmitsFromAST,
  // Expose
  extractExposeFromCompiledScript,
  extractExposeFromAST,
  // Imports
  extractImportsFromAST,
  extractImportsFromSource,
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
} from './vue-analyzer/extractors/index.js';

// Экспорт по умолчанию
import {
  analyzeVueComponent,
  parseVueFile,
  compileScriptBlock,
  generateVueComponentReport,
  enhanceWithVueAnalysis,
  analyzeVueComponentCli,
} from './vue-analyzer/index.js';

export default {
  analyzeVueComponent,
  parseVueFile,
  compileScriptBlock,
  generateVueComponentReport,
  enhanceWithVueAnalysis,
  analyzeVueComponentCli,
};