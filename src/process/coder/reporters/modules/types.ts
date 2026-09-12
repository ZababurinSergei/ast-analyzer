// src/reporters/modules/types.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - добавлено поле exports в EnhancedEntityInfo

// ============================================================
// ТИПЫ ДЛЯ ENHANCED PACKAGE LOCK REPORT
// ============================================================

export interface PackageLockImportInfo {
  from: string;
  type: 'named' | 'default' | 'namespace' | 'type';
  imports: string[];
}

export interface EnhancedFunctionInfo {
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
  security: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
  vscode: string;
  signature: string;
  _safeInfo: any;
  _modulePath?: string;
  filePath?: string;
  moduleName?: string;
  id?: string;
  isSelf?: boolean;
  _isSelf?: boolean;
  isConst?: boolean;
  isMacro?: boolean;
  isComposable?: boolean;
  source?: string;
  isDefaultExport?: boolean;
  isStatic?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  isReadonly?: boolean;
  isOptional?: boolean;
  isNullable?: boolean;
  isGenerator?: boolean;
  isDynamic?: boolean;
  isConfig?: boolean;
  isExternal?: boolean;
  isVueTemplate?: boolean;
  isAsyncChain?: boolean;
  isClosure?: boolean;
  isTypeDep?: boolean;
  moduleId?: string;
  fileId?: string;
  _uniqueKey?: string;
  _fullPath?: string;
}

export interface EnhancedConstantInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

export interface EnhancedVariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type: string;
  value: any;
  _safeInfo: any;
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
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
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

export interface EnhancedTypeInfo {
  name: string;
  definition: string;
  line: number;
  isExported: boolean;
  _safeInfo: any;
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
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
  moduleName?: string;
  filePath?: string;
  _modulePath?: string;
}

// ============================================================
// ✅ ОБНОВЛЕННЫЙ ТИП С ПОЛЕМ exports
// ============================================================

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];
  imports?: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
    loc?: any;
  }[];
  /** ✅ ДОБАВЛЕНО: экспорты из файла */
  exports?: {
    name: string;
    type: string;
    isDefault: boolean;
    line?: number;
    isReExport?: boolean;
    source?: string;
    loc?: any;
    specifier?: string;
  }[];
}

// ============================================================
// ТИПЫ ДЛЯ ENHANCED PACKAGE LOCK REPORT
// ============================================================

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
  vueAnalysis?: any;
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
  callGraph?: {
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
  };
  entityStats: {
    totalFunctions: number;
    totalConstants: number;
    totalVariables: number;
    totalInterfaces: number;
    totalTypes: number;
    totalClasses: number;
    totalCalls: number;
    totalExportedFunctions: number;
    totalAsyncFunctions: number;
    /** ✅ ДОБАВЛЕНО: общее количество экспортов */
    totalExports?: number;
    /** ✅ ДОБАВЛЕНО: общее количество реэкспортов */
    totalReExports?: number;
  };
  fileStats: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  architectureMetrics?: any;
  summary?: any;
  timestamp: string;
}

// ============================================================
// ТИПЫ ДЛЯ ГРАФОВ
// ============================================================

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
    security?: {
      hasEval: boolean;
      hasProcessEnv: boolean;
      hasSensitiveData: boolean;
      hasExec: boolean;
      hasPassword: boolean;
    };
    body?: string;
    vscode?: string;
    id?: string;
    signature?: string;
    importedFrom?: string;
    type?: string;
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
// ТИПЫ ДЛЯ СТАТИСТИКИ
// ============================================================

export interface EntityStats {
  total: number;
  exported: number;
  private: number;
  byModule: Record<string, number>;
  byType: {
    functions: number;
    classes: number;
    constants: number;
    interfaces: number;
    types: number;
    variables: number;
    enums: number;
  };
}

export interface FileStats {
  total: number;
  byExtension: Record<
    string,
    {
      count: number;
      lines: number;
      size: number;
    }
  >;
}

// ============================================================
// ТИП ДЛЯ CALL GRAPH RESULT
// ============================================================

export interface CallGraphResult {
  nodes: string[];
  edges: [number, number, number, number, number][];
  types: string[];
  edgeFlags: Record<string, Record<string, string>>;
  cycles: string[][];
}

// ============================================================
// ТИП ДЛЯ ФУНКЦИИ-СУЩНОСТИ
// ============================================================

export interface FunctionEntity {
  id: string;
  name: string;
  file: string;
  line: number;
  kind: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'macro';
  isExported: boolean;
  isAsync: boolean;
  params: string[];
  paramsCount: number;
  vscode: string;
  importedBy: {
    importerId: string;
    importerFile: string;
    importerVscode: string;
    importLine: number;
    specifier: string;
    importType?: 'named' | 'default' | 'namespace' | 'type';
  }[];
  body?: string;
  returnType?: string;
  metadata?: Record<string, any>;
  _uniqueKey?: string;
  _fullPath?: string;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  // Типы экспортируются автоматически
};
