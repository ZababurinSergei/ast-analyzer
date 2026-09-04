// packages/ast-analyzer/src/utils/index.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - только существующие экспорты

export { askQuestion, askYesNo, askChoice } from './askQuestion.js';

export { Logger, LogLevel, parseLogLevel } from './Logger.js';

export { isMainModule } from './is-main.js';

// ============================================
// ПУТИ - нормализация для кросс-платформенности
// ============================================

export {
  normalizePathForDisplay,
  getFileNameForDisplay,
  normalizePathForOS,
  normalizeGraphPaths,
  resolveAbsolutePath,
  validateAndResolvePath,
} from './path-utils.js';

// ============================================
// WASM - утилиты для работы с Tree-sitter
// ============================================

export {
  findWasmPath,
  isWasmAvailable,
  getAvailableGrammars,
  createWasmSymlink,
  copyWasmFiles,
} from './wasm-utils.js';

// ============================================
// ФЛАГИ - утилиты для битовых флагов
// ============================================

export {
  encodeFlags,
  decodeFlags,
  getFlagsList,
  hasFlag,
  setFlag,
  clearFlag,
  toggleFlag,
  encodeFlagsAdvanced,
  decodeFlagsAdvanced,
  flagsToString,
  countFlags,
  hasAnyFlag,
  hasAllFlags,
  // Константы
  STANDARD_FUNCTION,
  NESTED_FUNCTION,
  ASYNC_NESTED_FUNCTION,
  EXPORTED_FUNCTION,
  METHOD_FUNCTION,
  ARROW_FUNCTION,
  COMPOSABLE_FUNCTION,
  VUE_MACRO,
} from './flag-utils.js';
