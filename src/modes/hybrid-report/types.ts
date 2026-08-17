// src/modes/hybrid-report/types.ts

export interface HybridFunction {
  name: string;
  line: number;
  isExported: boolean;
  isAsync: boolean;
  calls: string[];
  calledBy: string[];
  params: string[];
  returnType?: string;
  body?: string;
  startLine: number;
  endLine: number;
  exportSource: 'self' | 'external' | 're-export';
  exportModule?: string;
}

export interface HybridModule {
  path: string;
  name: string;
  type: 'vue' | 'ts' | 'js' | 'tsx' | 'jsx';
  exports: string[];
  imports: string[];
  functions: HybridFunction[];
  components: string[];
  composables: string[];
  dependencies: string[];
  dependents: string[];
  level: number;
}

export interface HybridNode {
  id: string;
  type: 'module' | 'function' | 'import' | 'export' | 'component' | 'composable';
  name: string;
  file: string;
  line?: number;
  exports?: string[];
  imports?: string[];
  functions?: HybridFunction[];
  children?: HybridNode[];
  calls?: string[];
  calledBy?: string[];
  metadata?: Record<string, any>;
  level?: number;
}

export interface HybridReport {
  root: string;
  modules: HybridModule[];
  graph: {
    nodes: HybridNode[];
    edges: { from: string; to: string; type: string; level?: number }[];
  };
  stats: {
    totalModules: number;
    totalFunctions: number;
    totalExports: number;
    totalImports: number;
    totalComponents: number;
    totalComposables: number;
    maxDepth: number;
    cycles: number;
    byLevel: Record<number, { modules: number; functions: number }>;
  };
  cycles: string[][];
  levels: Record<string, number>;
}
