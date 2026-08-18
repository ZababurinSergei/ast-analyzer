// packages/ast-analyzer/src/refactor/index.ts
// Экспорт всех публичных API модуля refactor

// ============================================
// ЭКСПОРТ КЛАССОВ
// ============================================

export { AutoRefactor } from './AutoRefactor.js';
export type {
  RefactorOptions,
  RefactorResult,
  ExtractedModule,
  ClusterInfo,
} from './AutoRefactor.js';

export { ModuleExtractor } from './ModuleExtractor.js';
export { ImportManager } from './ImportManager.js';
export { TypeScriptValidator } from './TypeScriptValidator.js';
export { ESLintASTFixer } from './ESLintASTFixer.js';
export { CodeValidator, type ValidationResult } from './CodeValidator.js';
export { CodeFixer, type FixResult } from './CodeFixer.js';
export { TemplateUpdater } from './TemplateUpdater.js';
export { SyntaxValidator } from './SyntaxValidator.js';
export { ModuleTypeDetector } from './ModuleTypeDetector.js';
export { BackupManager } from './BackupManager.js';

// ============================================
// ЭКСПОРТ ИНТЕРФЕЙСОВ
// ============================================

export type { IRefactorContext } from './interfaces/IRefactorContext.js';
