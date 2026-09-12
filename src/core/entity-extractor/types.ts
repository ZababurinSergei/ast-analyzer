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
}

/** Внутренний тип для импорта из AST */
export interface ASTImport {
    source: string;
    specifiers: { local: string; imported: string; type: string }[];
    loc: any;
    isTypeOnly: boolean;
}
