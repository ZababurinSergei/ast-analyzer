// src/reporters/modules/types.ts
// ============================================================
// ТИПЫ ДЛЯ МОДУЛЕЙ РЕПОРТЕРОВ
// ============================================================

// ============================================================
// ОСНОВНЫЕ ТИПЫ ДЛЯ СУЩНОСТЕЙ
// ============================================================

export interface SecurityInfo {
  hasEval: boolean;
  hasProcessEnv: boolean;
  hasSensitiveData: boolean;
  hasExec: boolean;
  hasPassword: boolean;
}

export function createDefaultSecurity(): SecurityInfo {
  return {
    hasEval: false,
    hasProcessEnv: false,
    hasSensitiveData: false,
    hasExec: false,
    hasPassword: false,
  };
}

// ============================================================
// FUNCTION ENTITY
// ============================================================

export interface FunctionEntity {
  name: string;
  params: string[];
  paramTypes: string[];
  line: number;
  startLine: number;
  endLine: number;
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  className: string;
  calls: string[];
  calledBy: string[];
  returnType: string;
  body: string;
  isNested: boolean;
  parentFunction: string;
  isArrow: boolean;
  isEventHandler: boolean;
  eventType: string;
  depth: number;
  complexity: number;
  security: SecurityInfo;
  vscode: string;
  signature: string;
  _safeInfo: any;
  // ✅ ДОБАВЛЕНЫ НЕДОСТАЮЩИЕ ПОЛЯ
  filePath?: string;
  moduleName?: string;
  _modulePath?: string;
  callsInfo?: any[];
  calledByInfo?: any[];
  importedBy?: any[];
  id?: string;
  isConst?: boolean;
  isMacro?: boolean;
  isComposable?: boolean;
  source?: string;
  moduleId?: string;
  fileId?: string;
}

// ============================================================
// ENHANCED ENTITY INFO
// ============================================================

export interface EnhancedEntityInfo {
  functions: FunctionEntity[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];
  imports?: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
  }[];
}

// ============================================================
// ENHANCED PACKAGE INFO
// ============================================================

export interface EnhancedPackageInfo {
  version: string;
  resolved: string;
  displayPath?: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, PackageLockImportInfo>;
  exports: Record<string, PackageLockExportInfo>;
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
  complexity?: {
    average: number;
    max: number;
    functions: Record<string, number>;
  };
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    issues: string[];
  };
  vscode?: string;
  sourceCode?: string;
}

// ============================================================
// ENHANCED PACKAGE LOCK REPORT
// ============================================================

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
  callGraph?: CallGraphResult;
  entityStats: EntityStats;
  fileStats: FileStats;
  architectureMetrics?: ArchitectureMetrics;
  summary?: ProjectSummary;
  timestamp: string;
}

// ============================================================
// CALL GRAPH RESULT
// ============================================================

export interface CallGraphResult {
  from: string;
  to: string;
  path: string[];
  found: boolean;
  reason?: string;
  nodes: {
    function: string;
    module: string;
    line: number;
    isAsync: boolean;
  }[];
  edges: {
    from: string;
    to: string;
    line?: number;
  }[];
}

// ============================================================
// PACKAGE LOCK TYPES
// ============================================================

export interface PackageLockImportInfo {
  direction: 'inward';
  type: 'import' | 'external-import' | 'internal-import';
  specifiers: string[];
  functions: Record<string, PackageLockFunctionInfo>;
}

export interface PackageLockExportInfo {
  direction: 'outward';
  type: 'export';
  isAsync: boolean;
  params: string[];
  returns: string;
  line: number;
  consumers: {
    module: string;
    direction: 'outward';
    type: 'import' | 'call';
  }[];
}

export interface PackageLockFunctionInfo {
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  line: number;
  direction?: 'inward' | 'outward' | 'self';
  calls?: {
    target: string;
    direction: 'inward' | 'outward' | 'self';
    isAsync: boolean;
    line?: number;
  }[];
  consumers?: {
    module: string;
    direction: 'outward';
    type: 'import' | 'call';
  }[];
}

// ============================================================
// ENHANCED ENTITY TYPES
// ============================================================

export interface EnhancedFunctionInfo extends FunctionEntity {
  paramTypes: string[];
  isMethod: boolean;
  className: string;
  isNested: boolean;
  parentFunction: string;
  isArrow: boolean;
  isEventHandler: boolean;
  eventType: string;
  depth: number;
  complexity: number;
  security: SecurityInfo;
  vscode: string;
  signature: string;
  _safeInfo: any;
}

export interface EnhancedConstantInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
}

export interface EnhancedVariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
}

export interface EnhancedInterfaceInfo {
  name: string;
  properties: string[];
  line: number;
  startLine: number;
  endLine: number;
  isExported: boolean;
  extends: string[];
  _safeInfo: any;
}

export interface EnhancedTypeInfo {
  name: string;
  definition: string;
  line: number;
  isExported: boolean;
  _safeInfo: any;
}

export interface EnhancedClassInfo {
  name: string;
  methods: string[];
  properties: string[];
  line: number;
  startLine: number;
  endLine: number;
  isExported: boolean;
  extends?: string;
  implements: string[];
  _safeInfo: any;
}

// ============================================================
// STATISTICS TYPES
// ============================================================

export interface EntityStats {
  totalFunctions: number;
  totalConstants: number;
  totalVariables: number;
  totalInterfaces: number;
  totalTypes: number;
  totalClasses: number;
  totalCalls: number;
  totalExportedFunctions: number;
  totalAsyncFunctions: number;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  totalLines: number;
}

// ============================================================
// ARCHITECTURE TYPES
// ============================================================

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
  averageComplexity?: number;
  maxComplexity?: number;
  totalSecurityIssues?: number;
  securityIssuesByType?: {
    hasEval: number;
    hasProcessEnv: number;
    hasSensitiveData: number;
    hasExec: number;
  };
}

// ============================================================
// PROJECT SUMMARY
// ============================================================

export interface ProjectSummary {
  projectType: 'monorepo' | 'single' | 'unknown';
  entryPoint: string;
  totalModules: number;
  totalFunctions: number;
  vueComponents: number;
  hasCycles: boolean;
  maxDepth: number;
  architectureHealth: string;
  quickSummary?: string;
  technologies?: string[];
}

// ============================================================
// VUE ANALYSIS
// ============================================================

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

// ============================================================
// GRAPH TYPES
// ============================================================

export interface ModuleNode {
  id: string;
  name: string;
  path: string;
  type: 'module' | 'component' | 'vue' | 'external';
  level: number;
  metadata: {
    size: number;
    lines: number;
    language: 'javascript' | 'typescript' | 'vue' | 'jsx' | 'unknown';
    isEntry: boolean;
    functionsCount?: number;
    classesCount?: number;
    exportsCount?: number;
  };
}

export interface ModuleEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  specifiers: string[];
  sourceCode?: string;
}

export interface ModuleGraph {
  nodes: ModuleNode[];
  edges: ModuleEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

export interface EntityNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'enum' | 'module';
  module: string;
  line: number;
  metadata: {
    isExported: boolean;
    dataType?: string;
    value?: any;
    params?: string[];
    returnType?: string;
    isAsync?: boolean;
    isMethod?: boolean;
    className?: string;
    properties?: string[];
    methods?: string[];
    extends?: string;
    implements?: string[];
    extendsInterfaces?: string[];
    definition?: string;
    calledBy?: string[];
    calls?: string[];
    startLine?: number;
    endLine?: number;
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    tags?: string[];
    complexity?: number;
    security?: SecurityInfo;
    body?: string;
    vscode?: string;
    id?: string;
    signature?: string;
    importedFrom?: string;
  };
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
    | 'return_type'
    | 'variable_reference'
    | 'enum_member';
  line?: number;
  count?: number;
}

export interface EntityGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    functionsCount: number;
    classesCount: number;
    constantsCount: number;
    interfacesCount: number;
    typesCount: number;
    variablesCount: number;
    hasCycles: boolean;
    cyclesCount: number;
  };
}

// ============================================================
// FULL ANALYSIS
// ============================================================

export interface FullAnalysis {
  version: string;
  root: string;
  timestamp: string;
  stats: {
    totalModules: number;
    totalEntities: number;
    hasCycles: boolean;
    cycles: string[][];
    totalFunctions: number;
    totalClasses: number;
    totalConstants: number;
    totalInterfaces: number;
    totalTypes: number;
    totalVariables: number;
    maxDepth: number;
  };
  moduleGraph: ModuleGraph;
  entityGraph: EntityGraph;
}

// ============================================================
// EXECUTION FLOW
// ============================================================

export interface ExecutionStep {
  func: string;
  module: string;
  direction: 'inward' | 'outward' | 'self';
  isAsync: boolean;
  branches?: Record<string, any>;
}

export interface ExecutionGraph {
  entryPoint: string;
  direction: 'top-down';
  entryFunctions: string[];
  executionFlow: {
    type: 'sequential' | 'parallel' | 'conditional';
    steps: ExecutionStep[];
  };
}

// ============================================================
// IMPORT/EXPORT FLOW
// ============================================================

export interface ImportExportFlow {
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
}

// ============================================================
// DATA SOURCE TYPES
// ============================================================

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

export interface EntitiesResult {
  functions: FunctionEntity[];
  classes: EnhancedClassInfo[];
  constants: EnhancedConstantInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  variables: EnhancedVariableInfo[];
  imports: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
  }[];
  exports: {
    name: string;
    type: string;
    isDefault: boolean;
  }[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  createDefaultSecurity,
};
