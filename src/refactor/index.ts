// packages/ast-analyzer/src/refactor/index.ts
// ============================================
// ЭКСПОРТ ВСЕХ ПУБЛИЧНЫХ API МОДУЛЯ refactor
// ============================================

// ✅ ЭКСПОРТ ТИПОВ ИЗ types.ts
export type { RefactorOptions, ExtractedModule, ClusterInfo, RefactorResult } from './types.js';

// ✅ ЭКСПОРТ КЛАССА AutoRefactor
export { AutoRefactor } from './AutoRefactor.js';

// ✅ ЭКСПОРТ ОСТАЛЬНЫХ КЛАССОВ
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

// ✅ ЭКСПОРТ ИНТЕРФЕЙСА КОНТЕКСТА
export type { IRefactorContext } from './interfaces/IRefactorContext.js';
