// src/reporters/CompactReportConfig.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - body отключен во всех пресетах

export interface CompactReportConfig {
  // === ОСНОВНЫЕ ПОЛЯ ===
  version: boolean;
  timestamp: boolean;
  root: boolean;
  legend: boolean;

  // === СУЩНОСТИ ===
  includeFiles: boolean;
  includeModules: boolean;
  includeFunctions: boolean;
  includeConstants: boolean;
  includeClasses: boolean;
  includeInterfaces: boolean;
  includeTypes: boolean;
  includeVariables: boolean;

  // === СВЯЗИ ===
  includeCalls: boolean;
  includeImports: boolean;
  includeExports: boolean;
  includeInheritance: boolean;
  includeTypeDeps: boolean;

  // === СТАТИСТИКА ===
  includeStats: boolean;
  includeCycles: boolean;

  // === ФОРМАТИРОВАНИЕ ===
  minifyKeys: boolean;
  useBitFlags: boolean;
  useDictionaries: boolean;
  useTemplates: boolean;
  readableKeys: boolean;
  includeBody: boolean; // ПО УМОЛЧАНИЮ false
  includeSecurity: boolean;
  includeVSCode: boolean;
  maxDepth: number;
}

// ============================================
// ПРЕСЕТЫ — body ОТКЛЮЧЕН ВО ВСЕХ
// ============================================

export const PRESETS: Record<string, Partial<CompactReportConfig>> = {
  // === МИНИМАЛЬНЫЙ ===
  minimal: {
    includeFiles: true,
    includeModules: true,
    includeFunctions: true,
    includeConstants: false,
    includeClasses: false,
    includeInterfaces: false,
    includeTypes: false,
    includeVariables: false,
    includeCalls: true,
    includeImports: true,
    includeExports: true,
    includeInheritance: false,
    includeTypeDeps: false,
    includeStats: true,
    includeCycles: false,
    useBitFlags: true,
    useDictionaries: true,
    readableKeys: false,
    includeBody: false, // ❌ ОТКЛЮЧЕН
    includeSecurity: false,
    includeVSCode: false,
    maxDepth: 10,
  },

  // === СТАНДАРТНЫЙ ===
  standard: {
    includeFiles: true,
    includeModules: true,
    includeFunctions: true,
    includeConstants: true,
    includeClasses: true,
    includeInterfaces: true,
    includeTypes: true,
    includeVariables: true,
    includeCalls: true,
    includeImports: true,
    includeExports: true,
    includeInheritance: true,
    includeTypeDeps: true,
    includeStats: true,
    includeCycles: true,
    useBitFlags: true,
    useDictionaries: true,
    readableKeys: true,
    includeBody: false, // ❌ ОТКЛЮЧЕН
    includeSecurity: false,
    includeVSCode: true,
    maxDepth: 50,
  },

  // === ПОЛНЫЙ ===
  full: {
    includeFiles: true,
    includeModules: true,
    includeFunctions: true,
    includeConstants: true,
    includeClasses: true,
    includeInterfaces: true,
    includeTypes: true,
    includeVariables: true,
    includeCalls: true,
    includeImports: true,
    includeExports: true,
    includeInheritance: true,
    includeTypeDeps: true,
    includeStats: true,
    includeCycles: true,
    useBitFlags: true,
    useDictionaries: true,
    readableKeys: true,
    includeBody: false, // ❌ ОТКЛЮЧЕН (даже в full!)
    includeSecurity: true,
    includeVSCode: true,
    maxDepth: 1000,
  },

  // === ТОЛЬКО СВЯЗИ ===
  relationships: {
    includeFiles: true,
    includeModules: true,
    includeFunctions: true,
    includeConstants: false,
    includeClasses: false,
    includeInterfaces: false,
    includeTypes: false,
    includeVariables: false,
    includeCalls: true,
    includeImports: true,
    includeExports: true,
    includeInheritance: true,
    includeTypeDeps: true,
    includeStats: true,
    includeCycles: true,
    useBitFlags: true,
    useDictionaries: true,
    readableKeys: false,
    includeBody: false, // ❌ ОТКЛЮЧЕН
    includeSecurity: false,
    includeVSCode: false,
    maxDepth: 1000,
  },

  // === УЛЬТРА-КОМПАКТНЫЙ ===
  ultra: {
    includeFiles: true,
    includeModules: true,
    includeFunctions: true,
    includeConstants: false,
    includeClasses: false,
    includeInterfaces: false,
    includeTypes: false,
    includeVariables: false,
    includeCalls: true,
    includeImports: true,
    includeExports: true,
    includeInheritance: false,
    includeTypeDeps: false,
    includeStats: true,
    includeCycles: false,
    useBitFlags: true,
    useDictionaries: true,
    readableKeys: false,
    includeBody: false, // ❌ ОТКЛЮЧЕН
    includeSecurity: false,
    includeVSCode: false,
    maxDepth: 100,
  },
};

// ============================================
// ОПИСАНИЯ ПРЕСЕТОВ
// ============================================

export function getPresetDescription(preset: string): string {
  const descriptions: Record<string, string> = {
    minimal:
      'Минимальный граф: только файлы, модули, функции и основные связи. Тела функций отключены.',
    standard: 'Стандартный граф: все сущности и основные связи. Тела функций отключены.',
    full: 'Полный граф: все сущности, связи и метаданные (кроме тел функций). Тела функций отключены.',
    relationships: 'Только связи: граф зависимостей без деталей сущностей. Тела функций отключены.',
    ultra: 'Ультра-компактный: только основные сущности и связи. Тела функций отключены.',
  };
  return descriptions[preset] || 'Стандартный пресет. Тела функций отключены.';
}

// ============================================
// КОНСТРУКТОР КОНФИГА
// ============================================

export class CompactReportConfigBuilder {
  private config: CompactReportConfig;

  constructor(preset: keyof typeof PRESETS = 'standard') {
    const base = PRESETS[preset] || PRESETS.standard;
    this.config = {
      version: true,
      timestamp: true,
      root: true,
      legend: true,
      includeFiles: true,
      includeModules: true,
      includeFunctions: true,
      includeConstants: true,
      includeClasses: true,
      includeInterfaces: true,
      includeTypes: true,
      includeVariables: true,
      includeCalls: true,
      includeImports: true,
      includeExports: true,
      includeInheritance: true,
      includeTypeDeps: true,
      includeStats: true,
      includeCycles: true,
      minifyKeys: false,
      useBitFlags: true,
      useDictionaries: true,
      useTemplates: true,
      readableKeys: true,
      includeBody: false, // ❌ ПО УМОЛЧАНИЮ ОТКЛЮЧЕН
      includeSecurity: false,
      includeVSCode: true,
      maxDepth: 50,
      ...base,
    };
  }

  // === СЕТТЕРЫ ===

  setPreset(preset: keyof typeof PRESETS): this {
    const base = PRESETS[preset] || PRESETS.standard;
    this.config = { ...this.config, ...base };
    return this;
  }

  includeFiles(value: boolean = true): this {
    this.config.includeFiles = value;
    return this;
  }

  includeModules(value: boolean = true): this {
    this.config.includeModules = value;
    return this;
  }

  includeFunctions(value: boolean = true): this {
    this.config.includeFunctions = value;
    return this;
  }

  includeConstants(value: boolean = true): this {
    this.config.includeConstants = value;
    return this;
  }

  includeClasses(value: boolean = true): this {
    this.config.includeClasses = value;
    return this;
  }

  includeInterfaces(value: boolean = true): this {
    this.config.includeInterfaces = value;
    return this;
  }

  includeTypes(value: boolean = true): this {
    this.config.includeTypes = value;
    return this;
  }

  includeVariables(value: boolean = true): this {
    this.config.includeVariables = value;
    return this;
  }

  includeCalls(value: boolean = true): this {
    this.config.includeCalls = value;
    return this;
  }

  includeImports(value: boolean = true): this {
    this.config.includeImports = value;
    return this;
  }

  includeExports(value: boolean = true): this {
    this.config.includeExports = value;
    return this;
  }

  includeInheritance(value: boolean = true): this {
    this.config.includeInheritance = value;
    return this;
  }

  includeTypeDeps(value: boolean = true): this {
    this.config.includeTypeDeps = value;
    return this;
  }

  includeStats(value: boolean = true): this {
    this.config.includeStats = value;
    return this;
  }

  includeCycles(value: boolean = true): this {
    this.config.includeCycles = value;
    return this;
  }

  setMinifyKeys(value: boolean = true): this {
    this.config.minifyKeys = value;
    return this;
  }

  setUseBitFlags(value: boolean = true): this {
    this.config.useBitFlags = value;
    return this;
  }

  setUseDictionaries(value: boolean = true): this {
    this.config.useDictionaries = value;
    return this;
  }

  setUseTemplates(value: boolean = true): this {
    this.config.useTemplates = value;
    return this;
  }

  setReadableKeys(value: boolean = true): this {
    this.config.readableKeys = value;
    return this;
  }

  /**
   * Включить тела функций в отчет
   * @param value - true для включения, false для отключения
   * @returns this для цепочки вызовов
   *
   * @example
   * // Включить тела функций
   * configBuilder.setIncludeBody(true);
   *
   * // Отключить тела функций (по умолчанию)
   * configBuilder.setIncludeBody(false);
   */
  setIncludeBody(value: boolean = true): this {
    this.config.includeBody = value;
    return this;
  }

  setIncludeSecurity(value: boolean = true): this {
    this.config.includeSecurity = value;
    return this;
  }

  setIncludeVSCode(value: boolean = true): this {
    this.config.includeVSCode = value;
    return this;
  }

  setMaxDepth(value: number): this {
    this.config.maxDepth = value;
    return this;
  }

  build(): CompactReportConfig {
    return { ...this.config };
  }

  toGeneratorOptions(): any {
    const config = this.config;
    return {
      includeFiles: config.includeFiles,
      includeModules: config.includeModules,
      includeFunctions: config.includeFunctions,
      includeConstants: config.includeConstants,
      includeClasses: config.includeClasses,
      includeInterfaces: config.includeInterfaces,
      includeTypes: config.includeTypes,
      includeVariables: config.includeVariables,
      includeCalls: config.includeCalls,
      includeImports: config.includeImports,
      includeExports: config.includeExports,
      includeInheritance: config.includeInheritance,
      includeTypeDeps: config.includeTypeDeps,
      includeStats: config.includeStats,
      includeCycles: config.includeCycles,
      useBitFlags: config.useBitFlags,
      useDictionaries: config.useDictionaries,
      readableKeys: config.readableKeys,
      useTemplates: config.useTemplates,
      includeBody: config.includeBody,
      includeSecurity: config.includeSecurity,
      includeVSCode: config.includeVSCode,
      maxDepth: config.maxDepth,
    };
  }
}

// ============================================
// ФАБРИЧНЫЕ ФУНКЦИИ
// ============================================

export function createCompactConfig(
  preset: keyof typeof PRESETS = 'standard'
): CompactReportConfigBuilder {
  return new CompactReportConfigBuilder(preset);
}

export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  CompactReportConfigBuilder,
  createCompactConfig,
  PRESETS,
  getPresetNames,
  getPresetDescription,
};
