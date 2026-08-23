// src/reporters/modules/types.ts
// Общие типы для всех модулей

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

export interface EntitiesResult {
  functions: any[];
  classes: any[];
  constants: any[];
  interfaces: any[];
  types: any[];
  variables: any[];
  imports: any[];
  exports: any[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

// ============================================================
// БАЗОВЫЙ ТИП ДЛЯ ФУНКЦИИ - ИСПОЛЬЗУЕТСЯ ВЕЗДЕ
// ============================================================

export interface FunctionEntity {
  name: string;
  params: string[];
  paramTypes?: string[];
  line: number;
  startLine?: number;
  endLine?: number;
  isAsync: boolean;
  isExported: boolean;
  isMethod?: boolean;
  className?: string;
  calls: string[];
  calledBy: { function: string; module: string; line: number }[] | string[];
  returnType?: string;
  body?: string;
  isNested?: boolean;
  parentFunction?: string;
  isArrow?: boolean;
  isEventHandler?: boolean;
  eventType?: string;
  depth?: number;
  complexity?: number;
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
  _safeInfo?: any;
}

// ============================================================
// ENHANCED TYPES - РАСШИРЯЮТ БАЗОВЫЕ
// ============================================================

export interface EnhancedFunctionInfo extends FunctionEntity {
  // Расширяет FunctionEntity, добавляя только то, чего нет
  // Все поля уже есть в FunctionEntity
}

export interface EnhancedConstantInfo {
  name: string;
  value?: any;
  line: number;
  isExported: boolean;
  type?: string;
  _safeInfo?: any;
}

export interface EnhancedVariableInfo {
  name: string;
  value?: any;
  line: number;
  isExported: boolean;
  type?: string;
  _safeInfo?: any;
}

export interface EnhancedInterfaceInfo {
  name: string;
  properties: string[];
  line: number;
  isExported: boolean;
  extends?: string[];
  startLine?: number;
  endLine?: number;
  _safeInfo?: any;
}

export interface EnhancedTypeInfo {
  name: string;
  definition: string;
  line: number;
  isExported: boolean;
  _safeInfo?: any;
}

export interface EnhancedClassInfo {
  name: string;
  methods: string[];
  methodDetails?: {
    name: string;
    params: string[];
    returnType?: string;
    isAsync: boolean;
    line: number;
  }[];
  properties: string[];
  propertyDetails?: {
    name: string;
    type?: string;
    line: number;
  }[];
  line: number;
  isExported: boolean;
  extends?: string;
  implements?: string[];
  startLine?: number;
  endLine?: number;
  _safeInfo?: any;
}

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];
}

export interface ModuleNode {
  id: string;
  name: string;
  type: 'module' | 'component' | 'vue';
  level: number;
  metadata: {
    size: number;
    lines: number;
    language: string;
    isEntry: boolean;
  };
}

export interface ModuleEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export';
  specifiers: string[];
}

export interface ModuleGraph {
  nodes: ModuleNode[];
  edges: ModuleEdge[];
}

export interface EntityNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable';
  module: string;
  line: number;
  metadata: Record<string, any>;
}

export interface EntityEdge {
  from: string;
  to: string;
  type:
    | 'function_call'
    | 'constant_reference'
    | 'class_extends'
    | 'class_implements'
    | 'interface_extends'
    | 'type_reference'
    | 'method_call'
    | 'property_access'
    | 'import_binding'
    | 'export_binding'
    | 'parameter_type'
    | 'return_type';
  line?: number;
}

export interface EntityGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
}

export interface FullAnalysis {
  version: string;
  root: string;
  timestamp: string;
  stats: {
    totalModules: number;
    totalEntities: number;
    hasCycles: boolean;
    cycles: string[][];
  };
  moduleGraph: ModuleGraph;
  entityGraph: EntityGraph;
}

// ✅ ИСПРАВЛЕНО: PackageLockImportInfo с правильными полями
export interface PackageLockImportInfo {
  direction: 'inward';
  type: 'import' | 'external-import' | 'internal-import';
  specifiers: string[];
  functions: Record<string, any>;
  isTypeOnly?: boolean;
  line?: number;
}

export interface EnhancedPackageInfo {
  version: string;
  resolved: string;
  displayPath?: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, PackageLockImportInfo>;
  exports: Record<
    string,
    {
      direction: 'outward';
      type: 'export';
      isAsync: boolean;
      params: string[];
      returns: string;
      line: number;
      consumers: {
        function: string;
        module: string;
        line: number;
      }[];
    }
  >;
  entities: EnhancedEntityInfo;
  fileStats: {
    size: number;
    lines: number;
    functions: number;
    classes: number;
    constants: number;
    interfaces: number;
    types: number;
    variables: number;
  };
  vueAnalysis?: VueAnalysis;
}

export interface VueAnalysis {
  props: {
    names: string[];
    types: Record<string, string>;
    required: Record<string, boolean>;
    defaults: Record<string, any>;
  };
  emits: {
    names: string[];
    types: Record<string, string>;
  };
  slots: string[];
  composables: string[];
  templateComplexity: number;
  scriptType: 'setup' | 'options';
  isTS: boolean;
  stats: {
    scriptLines: number;
    templateLines: number;
    styleCount: number;
  };
}

export interface ArchitectureMetrics {
  totalModules: number;
  totalFunctions: number;
  totalClasses: number;
  totalConstants: number;
  totalInterfaces: number;
  totalTypes: number;
  totalVariables: number;
  totalCalls: number;
  vueComponents: number;
  totalComposables: number;
  hasCycles: boolean;
  maxDepth: number;
  modulesByLevel: Record<number, string[]>;
  isAcyclic: boolean;
}

export interface ProjectSummary {
  projectType: 'monorepo' | 'single' | 'unknown';
  entryPoint: string;
  totalModules: number;
  totalFunctions: number;
  vueComponents: number;
  hasCycles: boolean;
  maxDepth: number;
  architectureHealth: string;
}

export interface EnhancedPackageLockReport {
  name: string;
  version: string;
  lockfileVersion: number;
  packages: Record<string, EnhancedPackageInfo>;
  dependencyGraph: {
    direction: 'bidirectional';
    inwardDependencies: Record<string, string[]>;
    outwardDependencies: Record<string, string[]>;
  };
  executionGraph: {
    entryPoint: string;
    direction: 'top-down';
    entryFunctions: string[];
    executionFlow: {
      type: 'sequential' | 'parallel' | 'conditional';
      steps: {
        func: string;
        module: string;
        direction: 'inward' | 'outward' | 'self';
        isAsync: boolean;
        branches?: Record<string, any>;
      }[];
    };
  };
  importExportFlow: {
    imports: Record<
      string,
      {
        importsFrom: {
          module: string;
          type: 'named' | 'default' | 'namespace';
          imports: string[];
        }[];
      }
    >;
    exports: Record<
      string,
      {
        exportsTo: {
          module: string;
          type: 'named' | 'default';
          exports: string[];
        }[];
      }
    >;
  };
  callGraph?: Record<string, string[]>;
  entityStats?: {
    totalFunctions: number;
    totalConstants: number;
    totalVariables: number;
    totalInterfaces: number;
    totalTypes: number;
    totalClasses: number;
    totalCalls: number;
    totalExportedFunctions: number;
    totalAsyncFunctions: number;
  };
  fileStats?: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  timestamp?: string;
  architectureMetrics?: ArchitectureMetrics;
  summary?: ProjectSummary;
}
