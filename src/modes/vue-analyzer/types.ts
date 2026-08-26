// src/modes/vue-analyzer/types.ts

export interface VueComponentAnalysis {
  componentName: string;
  filePath: string;

  script: {
    content: string;
    ast: any | null;
    isSetup: boolean;
    isTS: boolean;
    size: number;
  };

  template: {
    content: string | null;
    ast: any | null;
    complexity: number;
    rootElements: string[];
    slots: string[];
    directives: string[];
    events: string[];
  };

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

  expose: string[];
  slots: string[];

  imports: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
  }[];

  composables: {
    name: string;
    source: string;
    args: string[];
  }[];

  functions: {
    name: string;
    line: number;
    isAsync: boolean;
    isExported: boolean;
    params: string[];
    returnType?: string;
    body?: string;
    calls?: string[];
    calledBy?: string[];
  }[];

  constants: {
    name: string;
    value: any;
    line: number;
    isExported: boolean;
    type?: string;
  }[];

  variables: {
    name: string;
    value: any;
    line: number;
    isExported: boolean;
    type?: string;
  }[];

  types: {
    name: string;
    definition: string;
    line: number;
    isExported: boolean;
  }[];

  interfaces: {
    name: string;
    properties: string[];
    line: number;
    isExported: boolean;
    extends?: string[];
  }[];

  callGraph: Record<string, string[]>;

  stats: {
    scriptLines: number;
    templateLines: number;
    styleCount: number;
    totalSize: number;
  };
}

export interface AnalysisOptions {
  includeTemplateAST?: boolean;
  includeScriptAST?: boolean;
  extractComposableCalls?: boolean;
  maxDepth?: number;
}
