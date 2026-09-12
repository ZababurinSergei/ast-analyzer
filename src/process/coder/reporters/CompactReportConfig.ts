// src/reporters/CompactReportConfig.ts
// НОВЫЙ ФАЙЛ - Единый конфиг для управления полями отчёта
// Версия: 1.0.0

export interface CompactReportConfig {
  // === ОСНОВНЫЕ ПОЛЯ ===
  version: boolean; // Версия формата
  timestamp: boolean; // Время генерации
  root: boolean; // Корневой модуль
  legend: boolean; // Легенда

  // === ИНДЕКСЫ ===
  moduleIndex: boolean; // mi - индексы модулей
  fileIndex: boolean; // fl - индексы файлов
  functionIndex: boolean; // fi - индексы функций

  // === СУЩНОСТИ ===
  functions: boolean; // fns - функции
  constants: boolean; // cn - константы
  selfFunctions: boolean; // sf - self-функции

  // === ГРАФЫ (СВЯЗИ) ===
  relations: {
    calls: boolean; // gr.c - вызовы
    imports: boolean; // gr.i - импорты
    exports: boolean; // gr.e - экспорты
    inheritance: boolean; // gr.h - наследование
    typeDeps: boolean; // gr.td - типовые зависимости
    reExports: boolean; // gr.re - re-экспорты
    constUses: boolean; // gr.uc - использование констант
    constDeps: boolean; // gr.cd - зависимости констант
    constExports: boolean; // gr.ce - экспорты констант
  };

  // === РАСШИРЕННЫЙ АНАЛИЗ ===
  extended: {
    dynamicImports: boolean; // gr.di - динамические импорты
    configRefs: boolean; // gr.cfg - конфигурации
    externalLibs: boolean; // gr.ext - внешние библиотеки
    vueTemplates: boolean; // gr.vt - Vue шаблоны
    asyncChains: boolean; // gr.async - асинхронные цепочки
    closures: boolean; // gr.closures - замыкания
    reflections: boolean; // gr.reflection - рефлексия
  };

  // === СТАТИСТИКА ===
  stats: {
    basic: boolean; // st - базовая статистика
    extended: boolean; // st - расширенная статистика
    byModule: boolean; // st.byModule - по модулям
    byFile: boolean; // st.byFile - по файлам
    byType: boolean; // st.byType - по типам
  };

  // === МЕТАДАННЫЕ ===
  metadata: {
    flags: boolean; // flg - битовые флаги
    types: boolean; // types - типы
    errors: boolean; // errors - ошибки
  };

  // === ПРЕСЕТЫ ===
  preset?: 'minimal' | 'standard' | 'full' | 'relationships' | 'ultra' | 'custom';

  // === ДОПОЛНИТЕЛЬНО ===
  minifyKeys: boolean; // Минифицировать ключи
  useBitFlags: boolean; // Использовать битовые флаги
  useDictionaries: boolean; // Использовать словари
  useTemplates: boolean; // Использовать шаблоны
  readableKeys: boolean; // Читаемые ключи
  includeBody: boolean; // Включать тела функций
  includeSecurity: boolean; // Включать информацию о безопасности
  includeVSCode: boolean; // Включать VSCode ссылки
  maxDepth: number; // Максимальная глубина
}

// ============================================
// ПРЕСЕТЫ КОНФИГУРАЦИЙ
// ============================================

export const PRESETS: Record<string, Partial<CompactReportConfig>> = {
  // === МИНИМАЛЬНЫЙ — только самое важное ===
  minimal: {
    version: true,
    timestamp: true,
    root: true,
    legend: false,
    moduleIndex: true,
    fileIndex: true,
    functionIndex: true,
    functions: true,
    constants: false,
    selfFunctions: false,
    relations: {
      calls: true,
      imports: true,
      exports: true,
      inheritance: false,
      typeDeps: false,
      reExports: false,
      constUses: false,
      constDeps: false,
      constExports: false,
    },
    extended: {
      dynamicImports: false,
      configRefs: false,
      externalLibs: false,
      vueTemplates: false,
      asyncChains: false,
      closures: false,
      reflections: false,
    },
    stats: {
      basic: true,
      extended: false,
      byModule: false,
      byFile: false,
      byType: false,
    },
    metadata: {
      flags: false,
      types: false,
      errors: false,
    },
    minifyKeys: true,
    useBitFlags: true,
    useDictionaries: true,
    useTemplates: true,
    readableKeys: false,
    includeBody: false,
    includeSecurity: false,
    includeVSCode: false,
    maxDepth: 10,
  },

  // === СТАНДАРТНЫЙ — баланс размера и информации ===
  standard: {
    version: true,
    timestamp: true,
    root: true,
    legend: true,
    moduleIndex: true,
    fileIndex: true,
    functionIndex: true,
    functions: true,
    constants: true,
    selfFunctions: true,
    relations: {
      calls: true,
      imports: true,
      exports: true,
      inheritance: true,
      typeDeps: true,
      reExports: true,
      constUses: true,
      constDeps: true,
      constExports: true,
    },
    extended: {
      dynamicImports: true,
      configRefs: true,
      externalLibs: true,
      vueTemplates: true,
      asyncChains: true,
      closures: true,
      reflections: true,
    },
    stats: {
      basic: true,
      extended: true,
      byModule: true,
      byFile: true,
      byType: true,
    },
    metadata: {
      flags: true,
      types: true,
      errors: false,
    },
    minifyKeys: false,
    useBitFlags: true,
    useDictionaries: true,
    useTemplates: true,
    readableKeys: true,
    includeBody: false,
    includeSecurity: false,
    includeVSCode: true,
    maxDepth: 50,
  },

  // === ПОЛНЫЙ — все данные ===
  full: {
    version: true,
    timestamp: true,
    root: true,
    legend: true,
    moduleIndex: true,
    fileIndex: true,
    functionIndex: true,
    functions: true,
    constants: true,
    selfFunctions: true,
    relations: {
      calls: true,
      imports: true,
      exports: true,
      inheritance: true,
      typeDeps: true,
      reExports: true,
      constUses: true,
      constDeps: true,
      constExports: true,
    },
    extended: {
      dynamicImports: true,
      configRefs: true,
      externalLibs: true,
      vueTemplates: true,
      asyncChains: true,
      closures: true,
      reflections: true,
    },
    stats: {
      basic: true,
      extended: true,
      byModule: true,
      byFile: true,
      byType: true,
    },
    metadata: {
      flags: true,
      types: true,
      errors: true,
    },
    minifyKeys: false,
    useBitFlags: true,
    useDictionaries: true,
    useTemplates: true,
    readableKeys: true,
    includeBody: true,
    includeSecurity: true,
    includeVSCode: true,
    maxDepth: 1000,
  },

  // === ТОЛЬКО СВЯЗИ — минимальный размер для графов ===
  relationships: {
    version: true,
    timestamp: true,
    root: true,
    legend: true,
    moduleIndex: true,
    fileIndex: true,
    functionIndex: true,
    functions: true,
    constants: false,
    selfFunctions: false,
    relations: {
      calls: true,
      imports: true,
      exports: true,
      inheritance: true,
      typeDeps: true,
      reExports: true,
      constUses: false,
      constDeps: false,
      constExports: false,
    },
    extended: {
      dynamicImports: true,
      configRefs: true,
      externalLibs: true,
      vueTemplates: false,
      asyncChains: false,
      closures: false,
      reflections: false,
    },
    stats: {
      basic: true,
      extended: false,
      byModule: false,
      byFile: false,
      byType: false,
    },
    metadata: {
      flags: false,
      types: false,
      errors: false,
    },
    minifyKeys: true,
    useBitFlags: true,
    useDictionaries: true,
    useTemplates: true,
    readableKeys: false,
    includeBody: false,
    includeSecurity: false,
    includeVSCode: false,
    maxDepth: 1000,
  },

  // === УЛЬТРА-КОМПАКТНЫЙ — максимальное сжатие ===
  ultra: {
    version: true,
    timestamp: true,
    root: false,
    legend: false,
    moduleIndex: true,
    fileIndex: true,
    functionIndex: true,
    functions: true,
    constants: false,
    selfFunctions: false,
    relations: {
      calls: true,
      imports: true,
      exports: true,
      inheritance: false,
      typeDeps: false,
      reExports: false,
      constUses: false,
      constDeps: false,
      constExports: false,
    },
    extended: {
      dynamicImports: false,
      configRefs: false,
      externalLibs: false,
      vueTemplates: false,
      asyncChains: false,
      closures: false,
      reflections: false,
    },
    stats: {
      basic: true,
      extended: false,
      byModule: false,
      byFile: false,
      byType: false,
    },
    metadata: {
      flags: false,
      types: false,
      errors: false,
    },
    minifyKeys: true,
    useBitFlags: true,
    useDictionaries: true,
    useTemplates: true,
    readableKeys: false,
    includeBody: false,
    includeSecurity: false,
    includeVSCode: false,
    maxDepth: 100,
  },
};

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
      moduleIndex: true,
      fileIndex: true,
      functionIndex: true,
      functions: true,
      constants: true,
      selfFunctions: true,
      relations: {
        calls: true,
        imports: true,
        exports: true,
        inheritance: true,
        typeDeps: true,
        reExports: true,
        constUses: true,
        constDeps: true,
        constExports: true,
      },
      extended: {
        dynamicImports: true,
        configRefs: true,
        externalLibs: true,
        vueTemplates: true,
        asyncChains: true,
        closures: true,
        reflections: true,
      },
      stats: {
        basic: true,
        extended: true,
        byModule: true,
        byFile: true,
        byType: true,
      },
      metadata: {
        flags: true,
        types: true,
        errors: true,
      },
      minifyKeys: false,
      useBitFlags: true,
      useDictionaries: true,
      useTemplates: true,
      readableKeys: true,
      includeBody: false,
      includeSecurity: false,
      includeVSCode: true,
      maxDepth: 100,
      ...base,
    } as CompactReportConfig;
  }

  // === МЕТОДЫ ДЛЯ ВКЛЮЧЕНИЯ/ОТКЛЮЧЕНИЯ ===

  setPreset(preset: keyof typeof PRESETS): this {
    const base = PRESETS[preset] || PRESETS.standard;
    this.config = { ...this.config, ...base } as CompactReportConfig;
    return this;
  }

  // Основные поля
  includeVersion(value: boolean = true): this {
    this.config.version = value;
    return this;
  }

  includeTimestamp(value: boolean = true): this {
    this.config.timestamp = value;
    return this;
  }

  includeRoot(value: boolean = true): this {
    this.config.root = value;
    return this;
  }

  includeLegend(value: boolean = true): this {
    this.config.legend = value;
    return this;
  }

  // Индексы
  includeModuleIndex(value: boolean = true): this {
    this.config.moduleIndex = value;
    return this;
  }

  includeFileIndex(value: boolean = true): this {
    this.config.fileIndex = value;
    return this;
  }

  includeFunctionIndex(value: boolean = true): this {
    this.config.functionIndex = value;
    return this;
  }

  // Сущности
  includeFunctions(value: boolean = true): this {
    this.config.functions = value;
    return this;
  }

  includeConstants(value: boolean = true): this {
    this.config.constants = value;
    return this;
  }

  includeSelfFunctions(value: boolean = true): this {
    this.config.selfFunctions = value;
    return this;
  }

  // Связи
  includeCalls(value: boolean = true): this {
    this.config.relations.calls = value;
    return this;
  }

  includeImports(value: boolean = true): this {
    this.config.relations.imports = value;
    return this;
  }

  includeExports(value: boolean = true): this {
    this.config.relations.exports = value;
    return this;
  }

  includeInheritance(value: boolean = true): this {
    this.config.relations.inheritance = value;
    return this;
  }

  includeTypeDeps(value: boolean = true): this {
    this.config.relations.typeDeps = value;
    return this;
  }

  includeReExports(value: boolean = true): this {
    this.config.relations.reExports = value;
    return this;
  }

  includeConstUses(value: boolean = true): this {
    this.config.relations.constUses = value;
    return this;
  }

  includeConstDeps(value: boolean = true): this {
    this.config.relations.constDeps = value;
    return this;
  }

  includeConstExports(value: boolean = true): this {
    this.config.relations.constExports = value;
    return this;
  }

  // Расширенный анализ
  includeDynamicImports(value: boolean = true): this {
    this.config.extended.dynamicImports = value;
    return this;
  }

  includeConfigRefs(value: boolean = true): this {
    this.config.extended.configRefs = value;
    return this;
  }

  includeExternalLibs(value: boolean = true): this {
    this.config.extended.externalLibs = value;
    return this;
  }

  includeVueTemplates(value: boolean = true): this {
    this.config.extended.vueTemplates = value;
    return this;
  }

  includeAsyncChains(value: boolean = true): this {
    this.config.extended.asyncChains = value;
    return this;
  }

  includeClosures(value: boolean = true): this {
    this.config.extended.closures = value;
    return this;
  }

  includeReflections(value: boolean = true): this {
    this.config.extended.reflections = value;
    return this;
  }

  // Статистика
  includeBasicStats(value: boolean = true): this {
    this.config.stats.basic = value;
    return this;
  }

  includeExtendedStats(value: boolean = true): this {
    this.config.stats.extended = value;
    return this;
  }

  includeStatsByModule(value: boolean = true): this {
    this.config.stats.byModule = value;
    return this;
  }

  includeStatsByFile(value: boolean = true): this {
    this.config.stats.byFile = value;
    return this;
  }

  includeStatsByType(value: boolean = true): this {
    this.config.stats.byType = value;
    return this;
  }

  // Метаданные
  includeFlags(value: boolean = true): this {
    this.config.metadata.flags = value;
    return this;
  }

  includeTypes(value: boolean = true): this {
    this.config.metadata.types = value;
    return this;
  }

  includeErrors(value: boolean = true): this {
    this.config.metadata.errors = value;
    return this;
  }

  // Опции форматирования
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

  // === ПОЛУЧЕНИЕ КОНФИГА ===

  build(): CompactReportConfig {
    return { ...this.config };
  }

  // === ПРЕОБРАЗОВАНИЕ В ОБЪЕКТ ДЛЯ ПЕРЕДАЧИ В ГЕНЕРАТОР ===

  toGeneratorOptions(): any {
    const config = this.config;
    return {
      // Базовые
      useBitFlags: config.useBitFlags,
      useDictionaries: config.useDictionaries,
      readableKeys: config.readableKeys,
      useTemplates: config.useTemplates,
      maxDepth: config.maxDepth,
      includeBody: config.includeBody,
      includeSecurity: config.includeSecurity,
      includeVSCode: config.includeVSCode,

      // Сущности
      includeRelations: true,
      includeStats: config.stats.basic || config.stats.extended,
      includeTypes: config.metadata.types,
      includeInheritance: config.relations.inheritance,
      includeExports: config.relations.exports,
      includeConstants: config.constants,
      includeSelfFunctions: config.selfFunctions,

      // Связи
      includeCalls: config.relations.calls,
      includeImports: config.relations.imports,
      includeTypeDeps: config.relations.typeDeps,
      includeReExports: config.relations.reExports,
      includeConstUses: config.relations.constUses,
      includeConstDeps: config.relations.constDeps,
      includeConstExports: config.relations.constExports,

      // Расширенный анализ
      includeDynamicImports: config.extended.dynamicImports,
      includeConfigRefs: config.extended.configRefs,
      includeExternalLibs: config.extended.externalLibs,
      includeVueTemplates: config.extended.vueTemplates,
      includeAsyncChains: config.extended.asyncChains,
      includeClosures: config.extended.closures,
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

export function getPresetDescription(preset: string): string {
  const descriptions: Record<string, string> = {
    minimal: 'Только основное: функции, вызовы, импорты, экспорты',
    standard: 'Баланс размера и информации: все основные поля',
    full: 'Все данные: полный анализ с метаданными',
    relationships: 'Только связи: минимальный размер для графов',
    ultra: 'Максимальное сжатие: минимум полей',
  };
  return descriptions[preset] || 'Стандартный пресет';
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
