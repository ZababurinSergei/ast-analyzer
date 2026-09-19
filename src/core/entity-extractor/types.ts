// packages/ast-analyzer/src/core/entity-extractor/types.ts
import type {
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  EntitiesResult,
  ImportInfo,
  ExportInfo,
} from '../../types.js';

export type {
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  EntitiesResult,
  ImportInfo,
  ExportInfo,
};

/** Внутренний тип для экспорта из AST */
export interface ASTExport {
  name: string;
  type: string;
  isDefault: boolean;
  line?: number;
  isReExport?: boolean;
  source?: string;
  specifiers?: string[];
  loc?: any;

  // ✅ НОВОЕ: для корректной работы codec (Стратегия B)
  /** Локальное имя (при `export { a as b }` → `a`) */
  localName?: string;
  /** Только для типов (`export type`, `export interface`) */
  isTypeOnly?: boolean;
  /** Является ли `export * from '...'` */
  isStarReExport?: boolean;
  /** Является ли `export { default } from '...'` */
  isDefaultReExport?: boolean;
}

/** Внутренний тип для импорта из AST */
export interface ASTImport {
  source: string;
  specifiers: { local: string; imported: string; type: string }[];
  loc: any;
  isTypeOnly: boolean;
}
