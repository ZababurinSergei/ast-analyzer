// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/09-data-processing/modules/transform.js

// ============================================
// МОДУЛЬ ТРАНСФОРМАЦИИ ДАННЫХ
// ============================================
// Этот модуль содержит функции для трансформации
// и преобразования данных различных структур.

/**
 * Трансформирует каждый элемент массива с помощью функции
 * @param {Array} items - Массив элементов
 * @param {Function} transformFn - Функция трансформации
 * @returns {Array} - Трансформированный массив
 */
function transformItems(items, transformFn) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array');
  }
  if (typeof transformFn !== 'function') {
    throw new TypeError('Expected a function');
  }
  return items.map(transformFn);
}

/**
 * Трансформирует ключи объекта
 * @param {Object} obj - Исходный объект
 * @param {Function} keyTransform - Функция трансформации ключей
 * @param {boolean} deep - Рекурсивно ли трансформировать
 * @returns {Object} - Объект с трансформированными ключами
 */
function transformKeys(obj, keyTransform, deep = false) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item, keyTransform, deep));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = keyTransform(key);
    if (deep && typeof value === 'object' && value !== null) {
      result[newKey] = transformKeys(value, keyTransform, true);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Трансформирует значения объекта
 * @param {Object} obj - Исходный объект
 * @param {Function} valueTransform - Функция трансформации значений
 * @param {boolean} deep - Рекурсивно ли трансформировать
 * @returns {Object} - Объект с трансформированными значениями
 */
function transformValues(obj, valueTransform, deep = false) {
  if (typeof obj !== 'object' || obj === null) {
    return valueTransform(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformValues(item, valueTransform, deep));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (deep && typeof value === 'object' && value !== null) {
      result[key] = transformValues(value, valueTransform, true);
    } else {
      result[key] = valueTransform(value);
    }
  }
  return result;
}

/**
 * Трансформирует вложенные структуры данных
 * @param {Object|Array} data - Данные для трансформации
 * @param {Function} transformFn - Функция трансформации для узлов
 * @param {string} childrenKey - Ключ для доступа к детям
 * @returns {Object|Array} - Трансформированные данные
 */
function transformNested(data, transformFn, childrenKey = 'children') {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => transformNested(item, transformFn, childrenKey));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const result = transformFn(data);

  if (result[childrenKey] && Array.isArray(result[childrenKey])) {
    result[childrenKey] = result[childrenKey].map(child =>
      transformNested(child, transformFn, childrenKey)
    );
  }

  return result;
}

/**
 * Применяет функцию маппинга к объекту
 * @param {Object} obj - Исходный объект
 * @param {Function} mapFn - Функция маппинга (key, value) => newValue
 * @param {boolean} deep - Рекурсивно ли применять
 * @returns {Object} - Объект после маппинга
 */
function mapObject(obj, mapFn, deep = false) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => mapObject(item, mapFn, deep));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (deep && typeof value === 'object' && value !== null) {
      result[key] = mapObject(value, mapFn, true);
    } else {
      result[key] = mapFn(key, value);
    }
  }
  return result;
}

/**
 * Выбирает только указанные свойства из объекта
 * @param {Object} obj - Исходный объект
 * @param {Array<string>} keys - Массив ключей для выбора
 * @param {boolean} deep - Рекурсивно ли выбирать
 * @returns {Object} - Объект с выбранными свойствами
 */
function pickProperties(obj, keys, deep = false) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => pickProperties(item, keys, deep));
  }

  const result = {};
  const keySet = new Set(keys);

  for (const [key, value] of Object.entries(obj)) {
    if (keySet.has(key)) {
      if (deep && typeof value === 'object' && value !== null) {
        result[key] = pickProperties(value, keys, true);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Исключает указанные свойства из объекта
 * @param {Object} obj - Исходный объект
 * @param {Array<string>} keys - Массив ключей для исключения
 * @param {boolean} deep - Рекурсивно ли исключать
 * @returns {Object} - Объект без указанных свойств
 */
function omitProperties(obj, keys, deep = false) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => omitProperties(item, keys, deep));
  }

  const result = {};
  const keySet = new Set(keys);

  for (const [key, value] of Object.entries(obj)) {
    if (!keySet.has(key)) {
      if (deep && typeof value === 'object' && value !== null) {
        result[key] = omitProperties(value, keys, true);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Переименовывает свойства объекта
 * @param {Object} obj - Исходный объект
 * @param {Object} renameMap - Карта переименования { oldKey: newKey }
 * @param {boolean} deep - Рекурсивно ли переименовывать
 * @returns {Object} - Объект с переименованными свойствами
 */
function renameProperties(obj, renameMap, deep = false) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => renameProperties(item, renameMap, deep));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = renameMap[key] || key;
    if (deep && typeof value === 'object' && value !== null) {
      result[newKey] = renameProperties(value, renameMap, true);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Разворачивает вложенный объект в плоский
 * @param {Object} obj - Вложенный объект
 * @param {string} separator - Разделитель для ключей
 * @param {string} prefix - Префикс для ключей (для рекурсии)
 * @param {number} maxDepth - Максимальная глубина разворачивания
 * @returns {Object} - Плоский объект
 */
function flattenObject(obj, separator = '.', prefix = '', maxDepth = Infinity) {
  if (typeof obj !== 'object' || obj === null || maxDepth <= 0) {
    return { [prefix]: obj };
  }

  if (Array.isArray(obj)) {
    return { [prefix]: obj };
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = flattenObject(value, separator, newKey, maxDepth - 1);
      Object.assign(result, nested);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Сворачивает плоский объект во вложенный
 * @param {Object} obj - Плоский объект
 * @param {string} separator - Разделитель для ключей
 * @returns {Object} - Вложенный объект
 */
function unflattenObject(obj, separator = '.') {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split(separator);
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

/**
 * Глубокое копирование объекта
 * @param {any} obj - Объект для копирования
 * @param {WeakMap} cache - Кэш для предотвращения циклов
 * @returns {any} - Глубокая копия
 */
function deepClone(obj, cache = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (cache.has(obj)) {
    return cache.get(obj);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj);
  }

  if (obj instanceof Map) {
    const result = new Map();
    cache.set(obj, result);
    for (const [key, value] of obj) {
      result.set(deepClone(key, cache), deepClone(value, cache));
    }
    return result;
  }

  if (obj instanceof Set) {
    const result = new Set();
    cache.set(obj, result);
    for (const value of obj) {
      result.add(deepClone(value, cache));
    }
    return result;
  }

  if (Array.isArray(obj)) {
    const result = [];
    cache.set(obj, result);
    for (const item of obj) {
      result.push(deepClone(item, cache));
    }
    return result;
  }

  const result = {};
  cache.set(obj, result);
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepClone(value, cache);
  }
  return result;
}

/**
 * Глубокое слияние нескольких объектов
 * @param {Object} target - Целевой объект
 * @param {...Object} sources - Исходные объекты
 * @param {Object} options - Опции слияния
 * @param {boolean} options.arrayMerge - Стратегия слияния массивов ('replace', 'concat', 'merge')
 * @returns {Object} - Слитый объект
 */
function deepMerge(target, ...sources) {
  const options = {
    arrayMerge: 'merge',
    ...(typeof sources[sources.length - 1] === 'object' &&
    !Array.isArray(sources[sources.length - 1])
      ? sources.pop()
      : {}),
  };

  const result = { ...target };

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;

      if (Array.isArray(value) && Array.isArray(result[key])) {
        switch (options.arrayMerge) {
          case 'replace':
            result[key] = deepClone(value);
            break;
          case 'concat':
            result[key] = [...result[key], ...deepClone(value)];
            break;
          case 'merge':
            const mergedArray = [...result[key]];
            for (const item of value) {
              if (!mergedArray.some(existing => isDeepEqual(existing, item))) {
                mergedArray.push(deepClone(item));
              }
            }
            result[key] = mergedArray;
            break;
          default:
            result[key] = deepClone(value);
        }
        continue;
      }

      if (
        typeof value === 'object' &&
        value !== null &&
        typeof result[key] === 'object' &&
        result[key] !== null
      ) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = deepClone(value);
      }
    }
  }

  return result;
}

/**
 * Проверяет глубокое равенство двух значений
 * @param {any} a - Первое значение
 * @param {any} b - Второе значение
 * @returns {boolean} - true если значения глубоко равны
 */
function isDeepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Преобразует строку в число (с проверкой)
 * @param {string|number} value - Значение для преобразования
 * @param {number} defaultValue - Значение по умолчанию
 * @returns {number} - Преобразованное число
 */
function toNumber(value, defaultValue = 0) {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Преобразует значение в строку
 * @param {any} value - Значение для преобразования
 * @param {string} defaultValue - Значение по умолчанию
 * @returns {string} - Преобразованная строка
 */
function toString(value, defaultValue = '') {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

/**
 * Преобразует значение в булево
 * @param {any} value - Значение для преобразования
 * @param {boolean} defaultValue - Значение по умолчанию
 * @returns {boolean} - Преобразованное булево значение
 */
function toBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['true', 'yes', '1', 'on'].includes(lower)) return true;
    if (['false', 'no', '0', 'off'].includes(lower)) return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return defaultValue;
}

/**
 * Преобразует массив в объект с указанным ключом
 * @param {Array} array - Массив элементов
 * @param {string|Function} keySelector - Ключ или функция для выбора ключа
 * @param {Function} valueSelector - Функция для выбора значения (опционально)
 * @returns {Object} - Объект с ключами из массива
 */
function arrayToObject(array, keySelector, valueSelector = null) {
  if (!Array.isArray(array)) {
    throw new TypeError('Expected an array');
  }

  const result = {};
  const getKey = typeof keySelector === 'function' ? keySelector : item => item[keySelector];
  const getValue = valueSelector || (item => item);

  for (const item of array) {
    const key = getKey(item);
    if (key !== undefined && key !== null) {
      result[key] = getValue(item);
    }
  }
  return result;
}

/**
 * Преобразует объект в массив пар [key, value]
 * @param {Object} obj - Исходный объект
 * @param {Function} transformFn - Функция трансформации (опционально)
 * @returns {Array} - Массив пар [key, value]
 */
function objectToEntries(obj, transformFn = null) {
  if (typeof obj !== 'object' || obj === null) {
    return [];
  }

  const entries = Object.entries(obj);
  if (transformFn) {
    return entries.map(([key, value]) => transformFn(key, value));
  }
  return entries;
}

/**
 * Сортирует массив объектов по указанному ключу
 * @param {Array} array - Массив объектов
 * @param {string|Function} keySelector - Ключ или функция для сортировки
 * @param {boolean} ascending - Направление сортировки
 * @returns {Array} - Отсортированный массив
 */
function sortByKey(array, keySelector, ascending = true) {
  if (!Array.isArray(array)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof keySelector === 'function' ? keySelector : item => item[keySelector];

  return [...array].sort((a, b) => {
    const aVal = getKey(a);
    const bVal = getKey(b);
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    const result = aVal < bVal ? -1 : 1;
    return ascending ? result : -result;
  });
}

/**
 * Группирует массив по указанному ключу (упрощенная версия)
 * @param {Array} array - Массив элементов
 * @param {string|Function} keySelector - Ключ для группировки
 * @returns {Object} - Сгруппированный объект
 */
function groupBy(array, keySelector) {
  if (!Array.isArray(array)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof keySelector === 'function' ? keySelector : item => item[keySelector];

  const result = {};
  for (const item of array) {
    const key = getKey(item);
    if (key === undefined || key === null) continue;
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные трансформации
  transformItems,
  transformKeys,
  transformValues,
  transformNested,
  mapObject,

  // Выбор и исключение свойств
  pickProperties,
  omitProperties,
  renameProperties,

  // Разворачивание и сворачивание
  flattenObject,
  unflattenObject,

  // Клонирование и слияние
  deepClone,
  deepMerge,
  isDeepEqual,

  // Преобразование типов
  toNumber,
  toString,
  toBoolean,

  // Преобразование структур
  arrayToObject,
  objectToEntries,

  // Сортировка и группировка
  sortByKey,
  groupBy,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями трансформации
 */
export default {
  transformItems,
  transformKeys,
  transformValues,
  transformNested,
  mapObject,
  pickProperties,
  omitProperties,
  renameProperties,
  flattenObject,
  unflattenObject,
  deepClone,
  deepMerge,
  isDeepEqual,
  toNumber,
  toString,
  toBoolean,
  arrayToObject,
  objectToEntries,
  sortByKey,
  groupBy,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ТРАНСФОРМАЦИИ ДАННЫХ
 *
 * Этот модуль предоставляет 21 функцию для трансформации данных:
 *
 * 1. transformItems       - Трансформация элементов массива
 * 2. transformKeys        - Трансформация ключей объекта
 * 3. transformValues      - Трансформация значений объекта
 * 4. transformNested      - Трансформация вложенных структур
 * 5. mapObject           - Маппинг объекта
 * 6. pickProperties      - Выбор свойств
 * 7. omitProperties      - Исключение свойств
 * 8. renameProperties    - Переименование свойств
 * 9. flattenObject       - Разворачивание объекта
 * 10. unflattenObject    - Сворачивание объекта
 * 11. deepClone          - Глубокое копирование
 * 12. deepMerge          - Глубокое слияние
 * 13. isDeepEqual        - Глубокое сравнение
 * 14. toNumber           - Преобразование в число
 * 15. toString           - Преобразование в строку
 * 16. toBoolean          - Преобразование в булево
 * 17. arrayToObject      - Массив в объект
 * 18. objectToEntries    - Объект в массив пар
 * 19. sortByKey          - Сортировка по ключу
 * 20. groupBy            - Группировка по ключу
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают глубокую трансформацию (deep)
 * - Обрабатывают граничные случаи (null, undefined, пустые массивы)
 * - Имеют JSDoc с описанием параметров
 * - Поддерживают различные стратегии для массивов
 */
