// src/reporters/modules/types.ts

export interface FunctionEntity {
  name: string;
  line: number;
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  returnType?: string;
  calls: string[];
  calledBy: string[];
  body?: string;
  startLine: number;
  endLine: number;
  isMethod?: boolean;
  className?: string;
  isNested?: boolean;
  parentFunction?: string;
  isArrow?: boolean;
  isEventHandler?: boolean;
  eventType?: string;
  depth: number;
  complexity?: number;
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
}

export interface EnhancedFunctionInfo extends FunctionEntity {
  paramTypes: string[];
  vscode: string;
  signature: string;
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

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: {
    name: string;
    line: number;
    isExported: boolean;
    type: string;
    value?: any;
    _safeInfo: any;
  }[];
  variables: {
    name: string;
    line: number;
    isExported: boolean;
    type: string;
    value?: any;
    _safeInfo: any;
  }[];
  interfaces: {
    name: string;
    properties: string[];
    line: number;
    startLine: number;
    endLine: number;
    isExported: boolean;
    extends: string[];
    _safeInfo: any;
  }[];
  types: {
    name: string;
    definition: string;
    line: number;
    isExported: boolean;
    _safeInfo: any;
  }[];
  classes: {
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
  }[];
  imports: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
  }[];
}

export interface EnhancedPackageInfo {
  version: string;
  resolved: string;
  displayPath?: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, any>;
  exports: Record<string, any>;
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
  vscode?: string;
  sourceCode?: string;
  vueAnalysis?: VueAnalysis;
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

export interface ModuleNode {
  id: string;
  name: string;
  type: 'module' | 'component' | 'vue' | 'external';
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
  type: 'import' | 'external' | 're-export' | 'dynamic_import';
  specifiers: string[];
}

export interface ModuleGraph {
  nodes: ModuleNode[];
  edges: ModuleEdge[];
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
    security?: any;
    body?: string;
    signature?: string;
    vscode?: string;
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

export interface PackageLockImportInfo {
  direction: 'inward';
  type: 'import' | 'external-import' | 'internal-import' | 'type-import';
  specifiers: string[];
  functions: Record<string, any>;
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ ДЛЯ СОВМЕСТИМОСТИ
// ============================================================

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

export interface EntitiesResult {
  functions: FunctionEntity[];
  classes: {
    name: string;
    line: number;
    isExported: boolean;
    methods: string[];
    properties: string[];
    extends?: string;
    implements?: string[];
    startLine: number;
    endLine: number;
  }[];
  constants: {
    name: string;
    line: number;
    value?: any;
    isExported: boolean;
    type?: string;
  }[];
  interfaces: {
    name: string;
    line: number;
    isExported: boolean;
    properties: string[];
    extends?: string[];
    startLine: number;
    endLine: number;
  }[];
  types: {
    name: string;
    line: number;
    isExported: boolean;
    definition: string;
  }[];
  variables: {
    name: string;
    line: number;
    isExported: boolean;
    type?: string;
    value?: any;
  }[];
  imports: {
    source: string;
    specifiers: {
      local: string;
      imported: string;
      type: string;
    }[];
    loc: any;
    isTypeOnly?: boolean;
  }[];
  exports: {
    name: string;
    type: 'function' | 'class' | 'constant' | 'value' | 'default';
    isDefault: boolean;
    loc: any;
    params?: string[];
    async?: boolean;
    startLine?: number;
    endLine?: number;
  }[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

export function createDefaultSecurity() {
  return {
    hasEval: false,
    hasProcessEnv: false,
    hasSensitiveData: false,
    hasExec: false,
    hasPassword: false,
  };
}
