// src/reporters/modules/types.ts

// ============================================================
// ТИПЫ ДЛЯ МОДУЛЕЙ REPORTERS
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
  totalFiles: number;
  totalSize: number;
  totalLines: number;
}

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
  security: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
  vscode?: string;
  signature?: string;
  _safeInfo?: any;
  id?: string;
  callsInfo?: CallInfo[];
  calledByInfo?: CalledByInfo[];
  importedBy?: ImportedByInfo[];
}

// ============================================================
// ТИПЫ ДЛЯ СВЯЗЕЙ (ВСТРОЕННЫЙ ФОРМАТ)
// ============================================================

export interface CallInfo {
  targetId: string;
  targetName: string;
  targetFile: string;
  targetLine: number;
  targetVscode: string;
  callLine: number;
  callType:
    'direct' | 'import' | 'computed' | 'watch' | 'event' | 'lifecycle' | 'method' | 'constructor';
}

export interface CalledByInfo {
  callerId: string;
  callerName: string;
  callerFile: string;
  callerLine: number;
  callerVscode: string;
  callLine: number;
  callType:
    'direct' | 'import' | 'computed' | 'watch' | 'event' | 'lifecycle' | 'method' | 'constructor';
}

export interface ImportedByInfo {
  importerId: string;
  importerFile: string;
  importerVscode: string;
  importLine: number;
  specifier: string;
  importType?: 'named' | 'default' | 'namespace' | 'type';
}

// ============================================================
// РАСШИРЕННЫЕ ТИПЫ ДЛЯ СУЩНОСТЕЙ
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

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];
  imports?: PackageLockImportInfo[];
}

export interface PackageLockImportInfo {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
}

// ============================================================
// ТИПЫ ДЛЯ ПАКЕТОВ
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
  entities: {
    functions: FunctionEntity[];
    constants: EnhancedConstantInfo[];
    variables: EnhancedVariableInfo[];
    interfaces: EnhancedInterfaceInfo[];
    types: EnhancedTypeInfo[];
    classes: EnhancedClassInfo[];
  };
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
// ТИПЫ ДЛЯ АРХИТЕКТУРНЫХ МЕТРИК
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
// ТИПЫ ДЛЯ РЕЗЮМЕ ПРОЕКТА
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
// ТИПЫ ДЛЯ VUE АНАЛИЗА
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
// ТИПЫ ДЛЯ РАСШИРЕННОГО ОТЧЕТА
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

// ============================================================
// ТИПЫ ДЛЯ ОТЧЕТА С ВСТРОЕННЫМИ СВЯЗЯМИ (RELATIONSHIP REPORT)
// ============================================================

export interface ExtendedFunctionEntity {
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
  calls: CallInfo[];
  calledBy: CalledByInfo[];
  importedBy: ImportedByInfo[];
  body?: string;
  returnType?: string;
  typeRef?: string;
  metadata?: Record<string, any>;
}

export interface RelationshipReport {
  version: string;
  timestamp: string;
  root: string;
  entities: Record<string, ExtendedFunctionEntity>;
  stats: {
    totalFunctions: number;
    totalCalls: number;
    totalCalledBy: number;
    totalImportedBy: number;
    totalFiles: number;
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

export interface SecurityInfo {
  hasEval: boolean;
  hasProcessEnv: boolean;
  hasSensitiveData: boolean;
  hasExec: boolean;
  hasPassword: boolean;
}

export interface ImportExportItem {
  module: string;
  type: 'named' | 'default' | 'namespace';
  imports: string[];
}

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
  imports: PackageLockImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'constant' | 'value' | 'default';
  isDefault: boolean;
  loc: Location | null;
  params?: string[];
  async?: boolean;
  startLine?: number;
  endLine?: number;
}

export interface Location {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

// ============================================================
// ФУНКЦИЯ ДЛЯ СОЗДАНИЯ DEFAULT SECURITY
// ============================================================

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
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  createDefaultSecurity,
};
