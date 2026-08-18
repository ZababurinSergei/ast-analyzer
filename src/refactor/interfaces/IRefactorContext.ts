// packages/ast-analyzer/src/refactor/interfaces/IRefactorContext.ts
import type { Project, SourceFile } from 'ts-morph';
import type { RefactorOptions, ExtractedModule } from '../types.js';
import type { Logger } from '../../utils/Logger.js';

export interface IRefactorContext {
  // Основные свойства
  project: Project;
  options: RefactorOptions;
  logger: Logger;

  // Методы для получения состояния
  getModuleType(): string;
  isDryRun(): boolean;
  getModulesDir(): string;
  shouldCreateBackup(): boolean;
  shouldUpdateTemplate(): boolean;

  // Методы для получения параметров
  getTargetClusterSize(): number;
  getMaxClusterSize(): number;
  getMinCohesionScore(): number;
  getMaxIterations(): number;
  getMaxRetries(): number;
  getLogLevel(): string;
  getLogFile(): string;

  // Флаги для включения/отключения функций
  isSemanticAnalysisEnabled(): boolean;
  isFormalVerificationEnabled(): boolean;
  isDataFlowAnalysisEnabled(): boolean;
  isCallGraphAnalysisEnabled(): boolean;
  isJsxAnalysisEnabled(): boolean;
  isVueAnalysisEnabled(): boolean;
  isEslintCheckEnabled(): boolean;
  isEslintFixEnabled(): boolean;
  isTypeCheckEnabled(): boolean;
  isCodeValidationEnabled(): boolean;
  isAutoFixEnabled(): boolean;
  isFixUnusedImportsEnabled(): boolean;
  isFixUnusedVariablesEnabled(): boolean;
  isAddMissingTypesEnabled(): boolean;
  isOptimizeImportsEnabled(): boolean;
  isExtractIsolatedFunctionsEnabled(): boolean;
  isGroupByCallGraphEnabled(): boolean;
  isAddReExportsEnabled(): boolean;
  isIncrementalModeEnabled(): boolean;
  isGuaranteeModeEnabled(): boolean;
  isVerifyEquivalenceEnabled(): boolean;

  // Получение списков
  getCriticalFunctions(): string[];
  getExcludePatterns(): string[];

  // Методы для работы с модулями
  getModules(): ExtractedModule[];
  setModules(modules: ExtractedModule[]): void;
  addModule(module: ExtractedModule): void;
  clearModules(): void;

  // Методы для работы с файлами
  getSourceFile(filePath: string): SourceFile | undefined;
  addSourceFile(filePath: string): SourceFile;

  // Вспомогательные методы
  getWasmPath(): string;
  getMaxCallDepth(): number;
  getMinClusterSize(): number;
  getEquivalenceCheckLevel(): 'full' | 'quick' | 'none';
}
