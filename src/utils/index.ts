// src/utils/index.ts
export {
  askQuestion,
  askQuestionWithTimeout,
  askYesNo,
  askChoice,
  askValidated,
  askNumber,
  askPassword,
  confirmDangerousOperation,
  pressEnterToContinue,
} from './askQuestion.js';

export { Logger, LogLevel, parseLogLevel } from './Logger.js';

export {
  isMainModule,
} from './is-main.js';

// ============================================
// ПУТИ - нормализация для кросс-платформенности
// ============================================
export {
  normalizePathForDisplay,
  getFileNameForDisplay,
  getFileNameWithoutExt,
  normalizeRootKey,
  normalizeGraphPaths,
  isAbsolutePath,
  shortenPath,
  getRelativePathForDisplay,
} from './path-utils.js';