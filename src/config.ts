// packages/ast-analyzer/src/config.ts

/**
 * Конфигурация для компактного отчета сущностей
 *
 * Использование:
 *   import config from './config.js';
 *   const { entityFields, relationshipFields, ... } = config;
 */

// ============================================
// ТИПЫ ДЛЯ КОНФИГА
// ============================================

export type PresetName = 'minimal' | 'standard' | 'full' | 'relationshipsOnly';

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

export interface CompactReportConfig {
  version: string;
  entityFields: EntityFieldsConfig;
  relationshipFields: RelationshipFieldsConfig;
  filters: FiltersConfig;
  formatting: FormattingConfig;
  output: OutputConfig;
  presets: Record<PresetName, PresetConfig>;
  activePreset: PresetName;
  getConfig(): PresetConfig;
  getEnabledEntityFields(): (keyof EntityFieldsConfig)[];
  getEnabledRelationshipFields(relationship: keyof RelationshipFieldsConfig): string[];
  isEntityTypeEnabled(type: string): boolean;
  isModuleIncluded(modulePath: string): boolean;
}

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

export const COMPACT_REPORT_CONFIG: CompactReportConfig = {
  /**
   * Версия конфигурации
   */
  version: '1.0.0',

  /**
   * Настройки вывода сущностей
   */
  entityFields: {
    // === БАЗОВЫЕ ПОЛЯ (всегда включены) ===
    id: true, // Уникальный ID сущности
    name: true, // Имя сущности
    file: true, // Относительный путь к файлу
    line: true, // Номер строки определения
    kind: true, // Тип сущности (function, class, constant, etc.)
    vscode: true, // VSCode ссылка на сущность

    // === ИНФОРМАЦИЯ О ФУНКЦИИ ===
    isExported: true, // Экспортируется ли
    isAsync: true, // Асинхронная ли функция
    params: true, // Массив имен параметров
    paramsCount: true, // Количество параметров
    returnType: true, // Тип возвращаемого значения
    isMethod: true, // Является ли методом класса
    className: true, // Имя класса (для методов)

    // === ВЛОЖЕННОСТЬ ===
    isNested: true, // Вложенная ли функция
    parentFunction: true, // Родительская функция
    isArrow: true, // Стрелочная ли функция
    depth: true, // Глубина вложенности

    // === EVENTS ===
    isEventHandler: true, // Обработчик события
    eventType: true, // Тип события

    // === МЕТРИКИ ===
    complexity: true, // Цикломатическая сложность
    startLine: true, // Начальная строка
    endLine: true, // Конечная строка

    // === ОПЦИОНАЛЬНО (по умолчанию выключено) ===
    body: false, // Тело функции (ОТКЛЮЧЕНО ПО УМОЛЧАНИЮ)
    security: false, // Информация о безопасности
    signature: false, // Сигнатура функции
    metadata: false, // Дополнительные метаданные
  },

  /**
   * Настройки связей
   */
  relationshipFields: {
    // === ВЫЗОВЫ (calls) ===
    calls: {
      enabled: true, // Включить вызовы
      targetId: true, // ID вызываемой сущности
      targetName: true, // Имя вызываемой сущности
      targetFile: true, // Файл вызываемой сущности
      targetLine: true, // Строка вызываемой сущности
      targetVscode: true, // VSCode ссылка на вызываемую сущность
      callLine: true, // Строка, где происходит вызов
      callType: true, // Тип вызова (direct, import, computed, watch, event, lifecycle)
    },

    // === ОБРАТНЫЕ ВЫЗОВЫ (calledBy) ===
    calledBy: {
      enabled: true, // Включить обратные вызовы
      callerId: true, // ID вызывающей сущности
      callerName: true, // Имя вызывающей сущности
      callerFile: true, // Файл вызывающей сущности
      callerLine: true, // Строка вызывающей сущности
      callerVscode: true, // VSCode ссылка на вызывающую сущность
      callLine: true, // Строка, где происходит вызов
      callType: true, // Тип вызова
    },

    // === ИМПОРТЕРЫ (importedBy) ===
    importedBy: {
      enabled: true, // Включить импортеры
      importerId: true, // ID импортирующего файла
      importerFile: true, // Файл, который импортирует
      importerVscode: true, // VSCode ссылка на файл
      importLine: true, // Строка, где происходит импорт
      specifier: true, // Как импортируется (имя или алиас)
      importType: true, // Тип импорта (named, default, namespace, type)
    },
  },

  /**
   * Настройки фильтрации
   */
  filters: {
    // === ФИЛЬТРАЦИЯ ПО ТИПАМ СУЩНОСТЕЙ ===
    entityTypes: {
      function: true, // Включить функции
      class: true, // Включить классы
      constant: true, // Включить константы
      interface: true, // Включить интерфейсы
      type: true, // Включить типы
      variable: true, // Включить переменные
      macro: true, // Включить макросы (Vue)
    },

    // === ФИЛЬТРАЦИЯ ПО ЭКСПОРТУ ===
    onlyExported: false, // Только экспортируемые сущности
    onlyNonExported: false, // Только неэкспортируемые сущности

    // === ФИЛЬТРАЦИЯ ПО МОДУЛЯМ ===
    includeModules: [], // Список модулей для включения (пусто = все)
    excludeModules: [], // Список модулей для исключения

    // === МИНИМАЛЬНАЯ СЛОЖНОСТЬ ===
    minComplexity: 0, // Минимальная сложность для включения

    // === МАКСИМАЛЬНАЯ ГЛУБИНА ===
    maxDepth: Infinity, // Максимальная глубина вложенности
  },

  /**
   * Настройки форматирования
   */
  formatting: {
    indentSize: 2, // Размер отступа
    sortKeys: true, // Сортировать ключи
    sortEntities: true, // Сортировать сущности по имени
    includeTimestamp: true, // Включить временную метку
    includeStats: true, // Включить статистику
  },

  /**
   * Настройки вывода
   */
  output: {
    outputDir: './', // Директория для сохранения
    fileName: 'entities.json', // Имя файла
    prettyPrint: true, // Красивый вывод (с отступами)
    minify: false, // Минификация JSON (без пробелов)
    generateMarkdown: false, // Генерировать Markdown отчет
  },

  /**
   * Режимы конфигурации
   */
  presets: {
    // === МИНИМАЛЬНЫЙ (только основное) ===
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

    // === СТАНДАРТНЫЙ (баланс) ===
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

    // === ПОЛНЫЙ (все данные) ===
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

    // === ДЛЯ АНАЛИЗА СВЯЗЕЙ (только граф) ===
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
  },

  /**
   * Выбор активного пресета
   * Возможные значения: 'minimal' | 'standard' | 'full' | 'relationshipsOnly'
   */
  activePreset: 'standard',

  /**
   * Получить конфигурацию с учетом пресета
   */
  getConfig(): PresetConfig {
    const preset = this.presets[this.activePreset];
    if (!preset) {
      console.warn(`⚠️ Пресет "${this.activePreset}" не найден, использую "standard"`);
      return this.presets.standard;
    }
    return preset;
  },

  /**
   * Получить только включенные поля сущностей
   */
  getEnabledEntityFields(): (keyof EntityFieldsConfig)[] {
    const config = this.getConfig();
    return Object.entries(config.entityFields)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key as keyof EntityFieldsConfig);
  },

  /**
   * Получить только включенные поля связей
   */
  getEnabledRelationshipFields(relationship: keyof RelationshipFieldsConfig): string[] {
    const config = this.getConfig();
    const relConfig = config.relationshipFields[relationship];
    if (!relConfig || !relConfig.enabled) return [];
    return Object.entries(relConfig)
      .filter(([key, enabled]) => key !== 'enabled' && enabled)
      .map(([key]) => key);
  },

  /**
   * Проверить, включен ли тип сущности
   */
  isEntityTypeEnabled(type: string): boolean {
    const config = this.getConfig();
    const entityTypes = config.filters.entityTypes as Partial<EntityTypesFilter>;
    return (entityTypes as Record<string, boolean>)[type] !== false;
  },

  /**
   * Проверить, должен ли модуль быть включен
   */
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
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default COMPACT_REPORT_CONFIG;

// ============================================
// КОНСТАНТЫ ИЗ ПРЕДЫДУЩЕЙ ВЕРСИИ (сохранены для обратной совместимости)
// ============================================

export const IGNORE_NODE_MODULES = true;
export const SUPPORTED_EXTENSIONS = ['.ts', '.mjs', '.js', '.tsx', '.jsx', '.vue'];
export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.cache',
  '.next',
  'out',
  '.nuxt',
  '.output',
  '.vercel',
  'tmp',
  'temp',
];
export const VUE_SCRIPT_PATTERN = /<script[^>]*>([\s\S]*?)<\/script>/i;
