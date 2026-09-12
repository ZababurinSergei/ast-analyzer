// decoders/legendDecoder.js
import { decodeCallType, decodeFlags, FLAG_MAP } from './types.js';

/**
 * Декодирует все типы в легенде
 * @param {Object} legend - исходная легенда с сокращенными кодами
 * @returns {Object} - расшифрованная легенда
 */
export function decodeLegend(legend) {
  if (!legend || typeof legend !== 'object') {return legend;}

  const result = {};

  // Расшифровываем типы вызовов (callTypes)
  if (legend.callTypes) {
    result.callTypes = {};
    for (const [code, name] of Object.entries(legend.callTypes)) {
      const decoded = decodeCallType(code);
      result.callTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getCallTypeDescription(decoded),
      };
    }
  }

  // Расшифровываем типы импортов (importTypes)
  if (legend.importTypes) {
    result.importTypes = {};
    for (const [code, name] of Object.entries(legend.importTypes)) {
      const decoded = decodeCallType(code);
      result.importTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getImportTypeDescription(decoded),
      };
    }
  }

  // Расшифровываем типы экспортов (exportTypes)
  if (legend.exportTypes) {
    result.exportTypes = {};
    for (const [code, name] of Object.entries(legend.exportTypes)) {
      const decoded = decodeCallType(code);
      result.exportTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getExportTypeDescription(decoded),
      };
    }
  }

  // Расшифровываем re-export типы (reExportTypes)
  if (legend.reExportTypes) {
    result.reExportTypes = {};
    for (const [code, name] of Object.entries(legend.reExportTypes)) {
      const decoded = decodeCallType(code);
      result.reExportTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getReExportTypeDescription(decoded),
      };
    }
  }

  // Расшифровываем типы наследования (inheritanceTypes)
  if (legend.inheritanceTypes) {
    result.inheritanceTypes = {};
    for (const [code, name] of Object.entries(legend.inheritanceTypes)) {
      const decoded = decodeCallType(code);
      result.inheritanceTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getInheritanceTypeDescription(decoded),
      };
    }
  }

  // Расшифровываем типы зависимостей (typeDependencyTypes)
  if (legend.typeDependencyTypes) {
    result.typeDependencyTypes = {};
    for (const [code, name] of Object.entries(legend.typeDependencyTypes)) {
      const decoded = decodeCallType(code);
      result.typeDependencyTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getTypeDependencyDescription(decoded),
      };
    }
  }

  // Расшифровываем типы констант (constantTypes)
  if (legend.constantTypes) {
    result.constantTypes = {};
    for (const [code, name] of Object.entries(legend.constantTypes)) {
      const decoded = decodeCallType(code);
      result.constantTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getConstantTypeDescription(decoded),
      };
    }
  }

  // Расшифровываем динамические импорты (dynamicImportTypes)
  if (legend.dynamicImportTypes) {
    result.dynamicImportTypes = {};
    for (const [code, name] of Object.entries(legend.dynamicImportTypes)) {
      const decoded = decodeCallType(code);
      result.dynamicImportTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getDynamicImportDescription(decoded),
      };
    }
  }

  // Расшифровываем типы конфигов (configTypes)
  if (legend.configTypes) {
    result.configTypes = {};
    for (const [code, name] of Object.entries(legend.configTypes)) {
      const decoded = decodeCallType(code);
      result.configTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getConfigTypeDescription(decoded),
      };
    }
  }

  // Расшифровываем типы Vue шаблонов (vueTemplateTypes)
  if (legend.vueTemplateTypes) {
    result.vueTemplateTypes = {};
    for (const [code, name] of Object.entries(legend.vueTemplateTypes)) {
      const decoded = decodeCallType(code);
      result.vueTemplateTypes[code] = {
        code,
        name: decoded,
        originalName: name,
        description: getVueTemplateDescription(decoded),
      };
    }
  }

  // Расшифровываем типы флагов (flagTypes) если есть
  if (legend.flagTypes) {
    result.flagTypes = {};
    for (const [code, name] of Object.entries(legend.flagTypes)) {
      result.flagTypes[code] = {
        code,
        name: decodeFlagType(code),
        originalName: name,
        description: getFlagDescription(decodeFlagType(code)),
      };
    }
  }

  // ============================================================
  // ОБНОВЛЕНИЕ: Расшифровываем секцию flags (символьные флаги)
  // ============================================================
  // Формат в index.json:
  //   legend.flags = { a: 'standard', e: 'exported', m: 'method', ... }
  // ИЛИ
  //   legend.flags = { a: 1, e: 2, m: 4, ... }
  // ИЛИ
  //   legend.flags = { standard: 'a', exported: 'e', ... } (обратный формат)
  if (legend.flags) {
    result.flags = {};

    for (const [key, value] of Object.entries(legend.flags)) {
      // Определяем, где символ, а где имя
      let char = null;
      let name = null;

      // Случай 1: key — символ, value — имя ('a' → 'standard')
      if (typeof key === 'string' && key.length === 1 && typeof value === 'string') {
        char = key;
        name = value;
      }
      // Случай 2: key — символ, value — число ('a' → 1)
      else if (typeof key === 'string' && key.length === 1 && typeof value === 'number') {
        char = key;
        // Пытаемся декодировать через FLAG_MAP
        name = FLAG_MAP[char] || String(value);
      }
      // Случай 3: key — имя, value — символ ('standard' → 'a')
      else if (typeof key === 'string' && key.length > 1 && typeof value === 'string' && value.length === 1) {
        char = value;
        name = key;
      }
      // Случай 4: key — имя, value — число ('standard' → 1)
      else if (typeof key === 'string' && key.length > 1 && typeof value === 'number') {
        name = key;
        // Ищем символ по имени в FLAG_MAP
        for (const [c, n] of Object.entries(FLAG_MAP)) {
          if (n === name) {
            char = c;
            break;
          }
        }
      }

      // Если удалось определить символ и имя
      if (char && name) {
        result.flags[char] = {
          char,
          name,
          description: getFlagDescription(name),
        };
      } else {
        // Не смогли распознать — сохраняем как есть
        result.flags[key] = {
          char: key,
          name: String(value),
          description: getFlagDescription(String(value)),
        };
      }
    }
  }

  // Если legend.flags отсутствует — строим полную карту из FLAG_MAP
  if (!result.flags) {
    result.flags = {};
    for (const [char, name] of Object.entries(FLAG_MAP)) {
      result.flags[char] = {
        char,
        name,
        description: getFlagDescription(name),
      };
    }
  }

  // ============================================================
  // ОБНОВЛЕНИЕ: Расшифровываем битовые флаги (если есть)
  // ============================================================
  if (legend.flagBits) {
    result.flagBits = {};
    for (const [bit, name] of Object.entries(legend.flagBits)) {
      result.flagBits[bit] = {
        bit: Number(bit),
        name,
        description: getFlagDescription(name),
      };
    }
  }

  // Расшифровываем типы ошибок (errorTypes) если есть
  if (legend.errorTypes) {
    result.errorTypes = {};
    for (const [code, name] of Object.entries(legend.errorTypes)) {
      result.errorTypes[code] = {
        code,
        name: decodeErrorType(code),
        originalName: name,
        description: getErrorDescription(decodeErrorType(code)),
      };
    }
  }

  // Расшифровываем типы метаданных (metadataTypes) если есть
  if (legend.metadataTypes) {
    result.metadataTypes = {};
    for (const [code, name] of Object.entries(legend.metadataTypes)) {
      result.metadataTypes[code] = {
        code,
        name: decodeMetadataType(code),
        originalName: name,
        description: getMetadataDescription(decodeMetadataType(code)),
      };
    }
  }

  return result;
}

/**
 * Получить описание типа вызова
 */
function getCallTypeDescription(type) {
  const descriptions = {
    direct: 'Прямой синхронный вызов функции',
    async: 'Асинхронный вызов (Promise/async)',
    method: 'Вызов метода класса/объекта',
    callback: 'Вызов через callback',
    'dynamic-import': 'Динамический импорт модуля',
    named: 'Именованный импорт',
    default: 'Импорт по умолчанию',
    namespace: 'Импорт пространства имен',
    're-export': 'Реэкспорт',
    'type-only': 'Только типовой импорт',
    'side-effect': 'Импорт с побочным эффектом',
    'named-export': 'Именованный экспорт',
    'default-export': 'Экспорт по умолчанию',
    'type-export': 'Экспорт типа',
    'const-export': 'Экспорт константы',
    extends: 'Наследование (extends)',
    implements: 'Реализация (implements)',
    abstract: 'Абстрактный класс/метод',
    parameter: 'Параметр функции',
    return: 'Возвращаемое значение',
    annotation: 'Аннотация типа',
    generic: 'Дженерик тип',
    'type-reference': 'Ссылка на тип',
    value: 'Значение',
    enum: 'Перечисление',
    config: 'Конфигурация',
  };
  return descriptions[type] || 'Неизвестный тип вызова';
}

/**
 * Получить описание типа импорта
 */
function getImportTypeDescription(type) {
  const descriptions = {
    named: 'Именованный импорт (import { name })',
    default: 'Импорт по умолчанию (import name)',
    namespace: 'Импорт пространства имен (import * as name)',
    're-export': 'Реэкспорт (export ... from)',
    'type-only': 'Только типовой импорт (import type)',
    'side-effect': 'Импорт с побочным эффектом (import \"...\")',
    'dynamic-import': 'Динамический импорт (import())',
  };
  return descriptions[type] || 'Неизвестный тип импорта';
}

/**
 * Получить описание типа экспорта
 */
function getExportTypeDescription(type) {
  const descriptions = {
    'named-export': 'Именованный экспорт (export const)',
    'default-export': 'Экспорт по умолчанию (export default)',
    're-export': 'Реэкспорт (export ... from)',
    'type-export': 'Экспорт типа (export type)',
    'const-export': 'Экспорт константы',
  };
  return descriptions[type] || 'Неизвестный тип экспорта';
}

/**
 * Получить описание типа re-экспорта
 */
function getReExportTypeDescription(type) {
  const descriptions = {
    named: 'Именованный реэкспорт',
    all: 'Реэкспорт всего модуля (export * from)',
    group: 'Групповой реэкспорт',
    default: 'Реэкспорт по умолчанию',
  };
  return descriptions[type] || 'Неизвестный тип реэкспорта';
}

/**
 * Получить описание типа наследования
 */
function getInheritanceTypeDescription(type) {
  const descriptions = {
    extends: 'Расширение класса (extends)',
    implements: 'Реализация интерфейса (implements)',
    abstract: 'Абстрактное наследование',
  };
  return descriptions[type] || 'Неизвестный тип наследования';
}

/**
 * Получить описание типа зависимости
 */
function getTypeDependencyDescription(type) {
  const descriptions = {
    parameter: 'Тип параметра',
    return: 'Тип возвращаемого значения',
    annotation: 'Аннотация типа',
    generic: 'Дженерик параметр',
    'type-reference': 'Ссылка на тип',
  };
  return descriptions[type] || 'Неизвестный тип зависимости';
}

/**
 * Получить описание типа константы
 */
function getConstantTypeDescription(type) {
  const descriptions = {
    value: 'Обычное значение',
    enum: 'Перечисление',
    config: 'Конфигурационное значение',
  };
  return descriptions[type] || 'Неизвестный тип константы';
}

/**
 * Получить описание динамического импорта
 */
function getDynamicImportDescription(type) {
  const descriptions = {
    literal: 'Строковый литерал',
    'template-literal': 'Шаблонный литерал',
    concatenation: 'Конкатенация строк',
  };
  return descriptions[type] || 'Неизвестный тип динамического импорта';
}

/**
 * Получить описание типа конфига
 */
function getConfigTypeDescription(type) {
  const descriptions = {
    'environment-variable': 'Переменная окружения',
    'config-file': 'Файл конфигурации',
    'config-variable': 'Переменная конфигурации',
  };
  return descriptions[type] || 'Неизвестный тип конфига';
}

/**
 * Получить описание типа Vue шаблона
 */
function getVueTemplateDescription(type) {
  const descriptions = {
    component: 'Vue компонент',
    directive: 'Vue директива',
  };
  return descriptions[type] || 'Неизвестный тип Vue шаблона';
}

/**
 * Декодировать тип флага
 */
function decodeFlagType(code) {
  const map = {
    1: 'standard',
    2: 'exported',
    4: 'method',
    8: 'arrow',
    16: 'vue',
    32: 'nested',
    64: 'self',
    128: 'dead',
    256: 'cyclic',
    512: 'external',
    1024: 'type',
    2048: 'lazy',
    4096: 'async',
    8192: 'y',
  };
  return map[code] || code;
}

/**
 * Получить описание флага
 */
function getFlagDescription(type) {
  const descriptions = {
    standard: 'Стандартная функция',
    exported: 'Экспортируемая функция',
    method: 'Метод класса',
    arrow: 'Стрелочная функция',
    vue: 'Vue компонент/хук',
    nested: 'Вложенная функция',
    self: 'Self-функция',
    dead: 'Мертвый код (не используется)',
    cyclic: 'Циклическая зависимость',
    external: 'Внешняя библиотека',
    type: 'Тип/интерфейс',
    lazy: 'Ленивая загрузка',
    async: 'Асинхронная функция',
  };
  return descriptions[type] || 'Неизвестный флаг';
}

/**
 * Декодировать тип ошибки
 */
function decodeErrorType(code) {
  const map = {
    1: 'syntax-error',
    2: 'type-error',
    3: 'reference-error',
    4: 'import-error',
    5: 'export-error',
  };
  return map[code] || code;
}

/**
 * Получить описание ошибки
 */
function getErrorDescription(type) {
  const descriptions = {
    'syntax-error': 'Синтаксическая ошибка',
    'type-error': 'Ошибка типа',
    'reference-error': 'Ошибка ссылки',
    'import-error': 'Ошибка импорта',
    'export-error': 'Ошибка экспорта',
  };
  return descriptions[type] || 'Неизвестная ошибка';
}

/**
 * Декодировать тип метаданных
 */
function decodeMetadataType(code) {
  const map = {
    1: 'file',
    2: 'module',
    3: 'function',
    4: 'class',
    5: 'interface',
    6: 'type',
    7: 'constant',
  };
  return map[code] || code;
}

/**
 * Получить описание метаданных
 */
function getMetadataDescription(type) {
  const descriptions = {
    file: 'Файл',
    module: 'Модуль',
    function: 'Функция',
    class: 'Класс',
    interface: 'Интерфейс',
    type: 'Тип',
    constant: 'Константа',
  };
  return descriptions[type] || 'Неизвестный тип метаданных';
}

export default {
  decodeLegend,
  getCallTypeDescription,
  getImportTypeDescription,
  getExportTypeDescription,
  getReExportTypeDescription,
  getInheritanceTypeDescription,
  getTypeDependencyDescription,
  getConstantTypeDescription,
  getDynamicImportDescription,
  getConfigTypeDescription,
  getVueTemplateDescription,
  decodeFlagType,
  getFlagDescription,
  decodeErrorType,
  getErrorDescription,
  decodeMetadataType,
  getMetadataDescription,
};
