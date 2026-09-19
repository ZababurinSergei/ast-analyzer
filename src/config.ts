// src/config.ts
// ОБНОВЛЕННЫЙ ФАЙЛ - УСТРАНЕН ДУБЛИРОВАНИЕ ЭКСПОРТОВ
// ============================================
// ВСЕ КОНСТАНТЫ ПЕРЕМЕЩЕНЫ В config/constants.ts
// Этот файл сохраняет обратную совместимость
// ============================================

// ============================================
// ЭКСПОРТ КОНСТАНТ ИЗ constants.ts (ЕДИНСТВЕННЫЙ ИСТОЧНИК)
// ============================================

export {
  // Константы
  SUPPORTED_EXTENSIONS,
  SUPPORTED_EXTENSIONS_SET,
  DEFAULT_EXCLUDE_PATTERNS,
  EXCLUDE_PATTERNS_SET,
  VUE_SCRIPT_PATTERN,
  VUE_SCRIPT_SETUP_PATTERN,
  IGNORE_NODE_MODULES,
  MAX_FILE_SIZE,
  MAX_DEPTH_DEFAULT,
  MAX_DEPTH_PROJECT,

  // Типы
  type SupportedExtension,
  type ExcludePattern,
} from './config/constants.js';

// ============================================
// КОНФИГУРАЦИЯ ДЛЯ КОМПАКТНОГО ОТЧЕТА
// (оригинальный код, не дублируется)
// ============================================

// ============================================
// ТИПЫ ДЛЯ КОНФИГА
// ============================================

export type PresetName = 'minimal' | 'standard' | 'full' | 'relationshipsOnly' | 'ultraCompact';

export interface EntityFieldsConfig {
  id: boolean;
  name: boolean;
  file: boolean;
  line: boolean;
  kind: boolean;
  vscode: boolean;
  isExported: boolean;
  isAsync: boolean;
  params: boolean;
  paramsCount: boolean;
  returnType: boolean;
  isMethod: boolean;
  className: boolean;
  isNested: boolean;
  parentFunction: boolean;
  isArrow: boolean;
  depth: boolean;
  isEventHandler: boolean;
  eventType: boolean;
  complexity: boolean;
  startLine: boolean;
  endLine: boolean;
  body: boolean;
  security: boolean;
  signature: boolean;
  metadata: boolean;
}

export interface RelationshipFieldConfig {
  enabled: boolean;
  targetId: boolean;
  targetName: boolean;
  targetFile: boolean;
  targetLine: boolean;
  targetVscode: boolean;
  callLine: boolean;
  callType: boolean;
}

export interface CalledByFieldConfig {
  enabled: boolean;
  callerId: boolean;
  callerName: boolean;
  callerFile: boolean;
  callerLine: boolean;
  callerVscode: boolean;
  callLine: boolean;
  callType: boolean;
}

export interface ImportedByFieldConfig {
  enabled: boolean;
  importerId: boolean;
  importerFile: boolean;
  importerVscode: boolean;
  importLine: boolean;
  specifier: boolean;
  importType: boolean;
}

export interface RelationshipFieldsConfig {
  calls: RelationshipFieldConfig;
  calledBy: CalledByFieldConfig;
  importedBy: ImportedByFieldConfig;
}

export interface EntityTypesFilter {
  function: boolean;
  class: boolean;
  constant: boolean;
  interface: boolean;
  type: boolean;
  variable: boolean;
  macro: boolean;
}

export interface FiltersConfig {
  entityTypes: EntityTypesFilter;
  onlyExported: boolean;
  onlyNonExported: boolean;
  includeModules: string[];
  excludeModules: string[];
  minComplexity: number;
  maxDepth: number;
}

export interface FormattingConfig {
  indentSize: number;
  sortKeys: boolean;
  sortEntities: boolean;
  includeTimestamp: boolean;
  includeStats: boolean;
}

export interface OutputConfig {
  outputDir: string;
  fileName: string;
  prettyPrint: boolean;
  minify: boolean;
  generateMarkdown: boolean;
}

export interface PresetConfig {
  entityFields: Partial<EntityFieldsConfig>;
  relationshipFields: Partial<RelationshipFieldsConfig>;
  filters: Partial<FiltersConfig>;
  formatting: Partial<FormattingConfig>;
}

export interface UltraCompactConfig {
  enableDedup: boolean;
  useBitFlags: boolean;
  useDictionaries: boolean;
  readableKeys: boolean;
  version: string;
  removeCallsFromEntities: boolean;
  removeNameFromEntities: boolean;
  removeFileFromEntities: boolean;
  compressCalledBy: boolean;
}

export interface AnalyzersConfig {
  dynamicImports: boolean;
  configRefs: boolean;
  externalLibs: boolean;
  vueTemplates: boolean;
  asyncChains: boolean;
  closures: boolean;
  typeDeps: boolean;
  selfFunctions: boolean;
}

export interface CompressionConfig {
  enabled: boolean;
  deltaEncoding: boolean;
  rleCompression: boolean;
  pathCompression: boolean;
  minPathLength: number;
}

export interface CachingConfig {
  enabled: boolean;
  ttl: number;
  maxEntries: number;
  persistToDisk: boolean;
  cachePath: string;
}

export interface MigrationConfig {
  enabled: boolean;
  targetVersion: string;
  autoMigrate: boolean;
  backupOnMigrate: boolean;
}

export interface CompactReportConfig {
  version: string;
  entityFields: EntityFieldsConfig;
  relationshipFields: RelationshipFieldsConfig;
  filters: FiltersConfig;
  formatting: FormattingConfig;
  output: OutputConfig;
  presets: Record<PresetName, PresetConfig>;
  activePreset: PresetName;
  ultraCompact: UltraCompactConfig;
  analyzers: AnalyzersConfig;
  compression: CompressionConfig;
  caching: CachingConfig;
  migration: MigrationConfig;
  getConfig(): PresetConfig;
  getEnabledEntityFields(): (keyof EntityFieldsConfig)[];
  getEnabledRelationshipFields(relationship: keyof RelationshipFieldsConfig): string[];
  isEntityTypeEnabled(type: string): boolean;
  isModuleIncluded(modulePath: string): boolean;
  isAnalyzerEnabled(analyzer: keyof AnalyzersConfig): boolean;
  getCompressionConfig(): CompressionConfig;
  getCachingConfig(): CachingConfig;
  getMigrationConfig(): MigrationConfig;
}

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

export const COMPACT_REPORT_CONFIG: CompactReportConfig = {
  version: '1.0.0',

  entityFields: {
    id: true,
    name: true,
    file: true,
    line: true,
    kind: true,
    vscode: true,
    isExported: true,
    isAsync: true,
    params: true,
    paramsCount: true,
    returnType: true,
    isMethod: true,
    className: true,
    isNested: true,
    parentFunction: true,
    isArrow: true,
    depth: true,
    isEventHandler: true,
    eventType: true,
    complexity: true,
    startLine: true,
    endLine: true,
    body: false,
    security: false,
    signature: false,
    metadata: false,
  },

  relationshipFields: {
    calls: {
      enabled: true,
      targetId: true,
      targetName: true,
      targetFile: true,
      targetLine: true,
      targetVscode: true,
      callLine: true,
      callType: true,
    },
    calledBy: {
      enabled: true,
      callerId: true,
      callerName: true,
      callerFile: true,
      callerLine: true,
      callerVscode: true,
      callLine: true,
      callType: true,
    },
    importedBy: {
      enabled: true,
      importerId: true,
      importerFile: true,
      importerVscode: true,
      importLine: true,
      specifier: true,
      importType: true,
    },
  },

  filters: {
    entityTypes: {
      function: true,
      class: true,
      constant: true,
      interface: true,
      type: true,
      variable: true,
      macro: true,
    },
    onlyExported: false,
    onlyNonExported: false,
    includeModules: [],
    excludeModules: [],
    minComplexity: 0,
    maxDepth: Infinity,
  },

  formatting: {
    indentSize: 2,
    sortKeys: true,
    sortEntities: true,
    includeTimestamp: true,
    includeStats: true,
  },

  output: {
    outputDir: './',
    fileName: 'entities.json',
    prettyPrint: true,
    minify: false,
    generateMarkdown: false,
  },

  ultraCompact: {
    enableDedup: true,
    useBitFlags: true,
    useDictionaries: true,
    readableKeys: true,
    version: '4.0.0',
    removeCallsFromEntities: true,
    removeNameFromEntities: true,
    removeFileFromEntities: true,
    compressCalledBy: false,
  },

  analyzers: {
    dynamicImports: true,
    configRefs: true,
    externalLibs: true,
    vueTemplates: true,
    asyncChains: true,
    closures: true,
    typeDeps: true,
    selfFunctions: true,
  },

  compression: {
    enabled: true,
    deltaEncoding: true,
    rleCompression: true,
    pathCompression: true,
    minPathLength: 30,
  },

  caching: {
    enabled: true,
    ttl: 300000,
    maxEntries: 100,
    persistToDisk: false,
    cachePath: './.ast-cache',
  },

  migration: {
    enabled: true,
    targetVersion: '5.1.0',
    autoMigrate: true,
    backupOnMigrate: true,
  },

  presets: {
    minimal: {
      entityFields: {
        id: true,
        name: true,
        file: true,
        line: true,
        kind: true,
        vscode: true,
        isExported: true,
        isAsync: false,
        params: false,
        paramsCount: false,
        returnType: false,
        isMethod: false,
        className: false,
        isNested: false,
        parentFunction: false,
        isArrow: false,
        depth: false,
        isEventHandler: false,
        eventType: false,
        complexity: false,
        startLine: false,
        endLine: false,
        body: false,
        security: false,
        signature: false,
        metadata: false,
      },
      relationshipFields: {
        calls: {
          enabled: true,
          targetId: true,
          targetName: true,
          targetFile: false,
          targetLine: false,
          targetVscode: false,
          callLine: false,
          callType: false,
        },
        calledBy: {
          enabled: false,
          callerId: false,
          callerName: false,
          callerFile: false,
          callerLine: false,
          callerVscode: false,
          callLine: false,
          callType: false,
        },
        importedBy: {
          enabled: false,
          importerId: false,
          importerFile: false,
          importerVscode: false,
          importLine: false,
          specifier: false,
          importType: false,
        },
      },
      filters: {
        entityTypes: {
          function: true,
          class: false,
          constant: false,
          interface: false,
          type: false,
          variable: false,
          macro: false,
        },
        onlyExported: true,
        onlyNonExported: false,
        includeModules: [],
        excludeModules: [],
        minComplexity: 0,
        maxDepth: Infinity,
      },
      formatting: {
        indentSize: 2,
        sortKeys: true,
        sortEntities: true,
        includeTimestamp: true,
        includeStats: true,
      },
    },

    standard: {
      entityFields: {
        id: true,
        name: true,
        file: true,
        line: true,
        kind: true,
        vscode: true,
        isExported: true,
        isAsync: true,
        params: true,
        paramsCount: true,
        returnType: true,
        isMethod: true,
        className: true,
        isNested: true,
        parentFunction: true,
        isArrow: true,
        depth: true,
        isEventHandler: true,
        eventType: true,
        complexity: true,
        startLine: true,
        endLine: true,
        body: false,
        security: false,
        signature: false,
        metadata: false,
      },
      relationshipFields: {
        calls: {
          enabled: true,
          targetId: true,
          targetName: true,
          targetFile: true,
          targetLine: true,
          targetVscode: true,
          callLine: true,
          callType: true,
        },
        calledBy: {
          enabled: true,
          callerId: true,
          callerName: true,
          callerFile: true,
          callerLine: true,
          callerVscode: true,
          callLine: true,
          callType: true,
        },
        importedBy: {
          enabled: true,
          importerId: true,
          importerFile: true,
          importerVscode: true,
          importLine: true,
          specifier: true,
          importType: true,
        },
      },
      filters: {
        entityTypes: {
          function: true,
          class: true,
          constant: true,
          interface: true,
          type: true,
          variable: true,
          macro: true,
        },
        onlyExported: false,
        onlyNonExported: false,
        includeModules: [],
        excludeModules: [],
        minComplexity: 0,
        maxDepth: Infinity,
      },
      formatting: {
        indentSize: 2,
        sortKeys: true,
        sortEntities: true,
        includeTimestamp: true,
        includeStats: true,
      },
    },

    full: {
      entityFields: {
        id: true,
        name: true,
        file: true,
        line: true,
        kind: true,
        vscode: true,
        isExported: true,
        isAsync: true,
        params: true,
        paramsCount: true,
        returnType: true,
        isMethod: true,
        className: true,
        isNested: true,
        parentFunction: true,
        isArrow: true,
        depth: true,
        isEventHandler: true,
        eventType: true,
        complexity: true,
        startLine: true,
        endLine: true,
        body: true,
        security: true,
        signature: true,
        metadata: true,
      },
      relationshipFields: {
        calls: {
          enabled: true,
          targetId: true,
          targetName: true,
          targetFile: true,
          targetLine: true,
          targetVscode: true,
          callLine: true,
          callType: true,
        },
        calledBy: {
          enabled: true,
          callerId: true,
          callerName: true,
          callerFile: true,
          callerLine: true,
          callerVscode: true,
          callLine: true,
          callType: true,
        },
        importedBy: {
          enabled: true,
          importerId: true,
          importerFile: true,
          importerVscode: true,
          importLine: true,
          specifier: true,
          importType: true,
        },
      },
      filters: {
        entityTypes: {
          function: true,
          class: true,
          constant: true,
          interface: true,
          type: true,
          variable: true,
          macro: true,
        },
        onlyExported: false,
        onlyNonExported: false,
        includeModules: [],
        excludeModules: [],
        minComplexity: 0,
        maxDepth: Infinity,
      },
      formatting: {
        indentSize: 2,
        sortKeys: true,
        sortEntities: true,
        includeTimestamp: true,
        includeStats: true,
      },
    },

    relationshipsOnly: {
      entityFields: {
        id: true,
        name: true,
        file: true,
        line: true,
        kind: true,
        vscode: true,
        isExported: false,
        isAsync: false,
        params: false,
        paramsCount: false,
        returnType: false,
        isMethod: false,
        className: false,
        isNested: false,
        parentFunction: false,
        isArrow: false,
        depth: false,
        isEventHandler: false,
        eventType: false,
        complexity: false,
        startLine: false,
        endLine: false,
        body: false,
        security: false,
        signature: false,
        metadata: false,
      },
      relationshipFields: {
        calls: {
          enabled: true,
          targetId: true,
          targetName: true,
          targetFile: true,
          targetLine: true,
          targetVscode: true,
          callLine: true,
          callType: true,
        },
        calledBy: {
          enabled: true,
          callerId: true,
          callerName: true,
          callerFile: true,
          callerLine: true,
          callerVscode: true,
          callLine: true,
          callType: true,
        },
        importedBy: {
          enabled: true,
          importerId: true,
          importerFile: true,
          importerVscode: true,
          importLine: true,
          specifier: true,
          importType: true,
        },
      },
      filters: {
        entityTypes: {
          function: true,
          class: false,
          constant: false,
          interface: false,
          type: false,
          variable: false,
          macro: false,
        },
        onlyExported: false,
        onlyNonExported: false,
        includeModules: [],
        excludeModules: [],
        minComplexity: 0,
        maxDepth: Infinity,
      },
      formatting: {
        indentSize: 2,
        sortKeys: true,
        sortEntities: true,
        includeTimestamp: true,
        includeStats: true,
      },
    },

    ultraCompact: {
      entityFields: {
        id: true,
        name: true,
        file: true,
        line: true,
        kind: true,
        vscode: true,
        isExported: true,
        isAsync: true,
        params: true,
        paramsCount: false,
        returnType: true,
        isMethod: true,
        className: false,
        isNested: true,
        parentFunction: false,
        isArrow: true,
        depth: false,
        isEventHandler: true,
        eventType: false,
        complexity: false,
        startLine: false,
        endLine: false,
        body: false,
        security: false,
        signature: false,
        metadata: false,
      },
      relationshipFields: {
        calls: {
          enabled: true,
          targetId: true,
          targetName: false,
          targetFile: false,
          targetLine: false,
          targetVscode: false,
          callLine: true,
          callType: true,
        },
        calledBy: {
          enabled: true,
          callerId: true,
          callerName: false,
          callerFile: false,
          callerLine: false,
          callerVscode: false,
          callLine: true,
          callType: true,
        },
        importedBy: {
          enabled: true,
          importerId: true,
          importerFile: false,
          importerVscode: false,
          importLine: false,
          specifier: true,
          importType: false,
        },
      },
      filters: {
        entityTypes: {
          function: true,
          class: true,
          constant: true,
          interface: true,
          type: true,
          variable: true,
          macro: true,
        },
        onlyExported: false,
        onlyNonExported: false,
        includeModules: [],
        excludeModules: [],
        minComplexity: 0,
        maxDepth: Infinity,
      },
      formatting: {
        indentSize: 2,
        sortKeys: true,
        sortEntities: true,
        includeTimestamp: true,
        includeStats: true,
      },
    },
  },

  activePreset: 'standard',

  getConfig(): PresetConfig {
    const preset = this.presets[this.activePreset];
    if (!preset) {
      console.warn(`⚠️ Пресет "${this.activePreset}" не найден, использую "standard"`);
      return this.presets.standard;
    }
    return preset;
  },

  getEnabledEntityFields(): (keyof EntityFieldsConfig)[] {
    const config = this.getConfig();
    return Object.entries(config.entityFields)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key as keyof EntityFieldsConfig);
  },

  getEnabledRelationshipFields(relationship: keyof RelationshipFieldsConfig): string[] {
    const config = this.getConfig();
    const relConfig = config.relationshipFields[relationship];
    if (!relConfig || !relConfig.enabled) return [];
    return Object.entries(relConfig)
      .filter(([key, enabled]) => key !== 'enabled' && enabled)
      .map(([key]) => key);
  },

  isEntityTypeEnabled(type: string): boolean {
    const config = this.getConfig();
    const entityTypes = config.filters.entityTypes as Partial<EntityTypesFilter>;
    return (entityTypes as Record<string, boolean>)[type] !== false;
  },

  isModuleIncluded(modulePath: string): boolean {
    const config = this.getConfig();
    const { includeModules, excludeModules } = config.filters;

    if (includeModules && includeModules.length > 0) {
      return includeModules.some((m: string) => modulePath.includes(m));
    }
    if (excludeModules && excludeModules.length > 0) {
      return !excludeModules.some((m: string) => modulePath.includes(m));
    }
    return true;
  },

  isAnalyzerEnabled(analyzer: keyof AnalyzersConfig): boolean {
    return this.analyzers[analyzer] !== false;
  },

  getCompressionConfig(): CompressionConfig {
    return this.compression;
  },

  getCachingConfig(): CachingConfig {
    return this.caching;
  },

  getMigrationConfig(): MigrationConfig {
    return this.migration;
  },
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default COMPACT_REPORT_CONFIG;
