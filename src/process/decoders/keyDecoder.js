// decoders/keyDecoder.js
import { LONG_KEYS } from './types.js';

/**
 * Рекурсивно расшифровывает сокращенные ключи в объекте
 * @param {any} obj - Объект для расшифровки
 * @returns {any} - Объект с расшифрованными ключами
 */
export function expandObject(obj) {
  if (obj === null || obj === undefined) {return obj;}
  if (typeof obj !== 'object') {return obj;}

  if (Array.isArray(obj)) {
    return obj.map(item => expandObject(item));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const longKey = LONG_KEYS[key] || key;
    result[longKey] = expandObject(value);
  }
  return result;
}

/**
 * Расшифровывает только ключи верхнего уровня
 * @param {Object} obj - Объект для расшифровки
 * @returns {Object} - Объект с расшифрованными ключами верхнего уровня
 */
export function expandTopLevelKeys(obj) {
  if (!obj || typeof obj !== 'object') {return obj;}

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const longKey = LONG_KEYS[key] || key;
    result[longKey] = value;
  }
  return result;
}

/**
 * Расшифровывает ключи в массиве объектов
 * @param {Array} arr - Массив объектов
 * @param {Array<string>} keys - Ключи для расшифровки
 * @returns {Array} - Массив с расшифрованными ключами
 */
export function expandKeysInArray(arr, keys = []) {
  if (!Array.isArray(arr)) {return arr;}

  return arr.map(item => {
    if (typeof item !== 'object' || item === null) {return item;}

    const result = { ...item };
    for (const key of keys) {
      if (item[key] !== undefined) {
        const longKey = LONG_KEYS[key] || key;
        result[longKey] = item[key];
        if (longKey !== key) {
          delete result[key];
        }
      }
    }
    return result;
  });
}

/**
 * Проверяет, является ли ключ сокращенным
 * @param {string} key - Ключ для проверки
 * @returns {boolean}
 */
export function isShortKey(key) {
  return key in LONG_KEYS;
}

/**
 * Возвращает полный ключ для сокращенного
 * @param {string} shortKey - Сокращенный ключ
 * @returns {string} - Полный ключ
 */
export function getLongKey(shortKey) {
  return LONG_KEYS[shortKey] || shortKey;
}

/**
 * Рекурсивно преобразует сокращенные ключи в объекте с возможностью исключения
 * @param {any} obj - Объект для преобразования
 * @param {Set<string>} excludeKeys - Ключи для исключения из преобразования
 * @param {Set<string>} excludePaths - Пути для исключения из преобразования
 * @param {string} currentPath - Текущий путь для отслеживания исключений
 * @returns {any}
 */
export function expandObjectWithExclusions(
  obj,
  excludeKeys = new Set(),
  excludePaths = new Set(),
  currentPath = '',
) {
  if (obj === null || obj === undefined) {return obj;}
  if (typeof obj !== 'object') {return obj;}

  // Проверяем, нужно ли исключить этот путь
  if (excludePaths.has(currentPath)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      expandObjectWithExclusions(item, excludeKeys, excludePaths, `${currentPath}[${index}]`),
    );
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;

    // Проверяем, нужно ли исключить этот ключ
    if (excludeKeys.has(key)) {
      result[key] = value;
      continue;
    }

    const longKey = LONG_KEYS[key] || key;
    result[longKey] = expandObjectWithExclusions(value, excludeKeys, excludePaths, newPath);
  }
  return result;
}

/**
 * Рекурсивно преобразует только строковые ключи в объекте
 * @param {any} obj - Объект для преобразования
 * @param {Function} transformFn - Функция преобразования ключа
 * @returns {any}
 */
export function transformKeys(obj, transformFn) {
  if (obj === null || obj === undefined) {return obj;}
  if (typeof obj !== 'object') {return obj;}

  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item, transformFn));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = typeof transformFn === 'function' ? transformFn(key) : key;
    result[newKey] = transformKeys(value, transformFn);
  }
  return result;
}

/**
 * Расшифровывает ключи, но сохраняет оригинальные как _original
 * @param {any} obj - Объект для преобразования
 * @returns {any}
 */
export function expandObjectWithOriginal(obj) {
  if (obj === null || obj === undefined) {return obj;}
  if (typeof obj !== 'object') {return obj;}

  if (Array.isArray(obj)) {
    return obj.map(item => expandObjectWithOriginal(item));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const longKey = LONG_KEYS[key] || key;
    if (longKey !== key) {
      result[`_${longKey}`] = key; // Сохраняем оригинальный ключ
    }
    result[longKey] = expandObjectWithOriginal(value);
  }
  return result;
}

/**
 * Расшифровывает ключи и возвращает только указанные поля
 * @param {any} obj - Объект для преобразования
 * @param {Array<string>} fields - Поля для сохранения
 * @returns {any}
 */
export function expandObjectWithFields(obj, fields = []) {
  if (!obj || typeof obj !== 'object') {return obj;}

  if (Array.isArray(obj)) {
    return obj.map(item => expandObjectWithFields(item, fields));
  }

  const result = {};
  const fieldSet = new Set(fields);

  for (const [key, value] of Object.entries(obj)) {
    const longKey = LONG_KEYS[key] || key;
    if (fieldSet.size === 0 || fieldSet.has(longKey) || fieldSet.has(key)) {
      result[longKey] = expandObjectWithFields(value, fields);
    }
  }
  return result;
}

/**
 * Создает карту соответствия сокращенных и полных ключей
 * @param {Object} obj - Объект для анализа
 * @returns {Map<string, string>}
 */
export function buildKeyMap(obj) {
  const map = new Map();

  if (!obj || typeof obj !== 'object') {return map;}

  for (const key of Object.keys(obj)) {
    if (LONG_KEYS[key]) {
      map.set(key, LONG_KEYS[key]);
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const childMap = buildKeyMap(obj[key]);
      for (const [k, v] of childMap) {
        map.set(k, v);
      }
    }
  }
  return map;
}

/**
 * Применяет расшифровку ключей с опциями
 * @param {any} obj - Объект для преобразования
 * @param {Object} options - Опции преобразования
 * @param {boolean} options.recursive - Рекурсивное преобразование (по умолчанию true)
 * @param {Array<string>} options.excludeKeys - Ключи для исключения
 * @param {Array<string>} options.onlyFields - Только указанные поля
 * @param {boolean} options.keepOriginal - Сохранять оригинальные ключи
 * @returns {any}
 */
export function expandObjectWithOptions(obj, options = {}) {
  const { recursive = true, excludeKeys = [], onlyFields = [], keepOriginal = false } = options;

  if (!recursive) {
    return expandTopLevelKeys(obj);
  }

  if (keepOriginal) {
    return expandObjectWithOriginal(obj);
  }

  if (onlyFields.length > 0) {
    return expandObjectWithFields(obj, onlyFields);
  }

  if (excludeKeys.length > 0) {
    return expandObjectWithExclusions(obj, new Set(excludeKeys));
  }

  return expandObject(obj);
}

// Экспорт по умолчанию
export default {
  expandObject,
  expandTopLevelKeys,
  expandKeysInArray,
  isShortKey,
  getLongKey,
  expandObjectWithExclusions,
  transformKeys,
  expandObjectWithOriginal,
  expandObjectWithFields,
  buildKeyMap,
  expandObjectWithOptions,
};
