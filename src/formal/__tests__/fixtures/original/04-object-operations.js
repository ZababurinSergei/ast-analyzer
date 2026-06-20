// packages/ast-analyzer/src/formal/__tests__/fixtures/original/04-object-operations.js

// ============================================
// 4. ОБЪЕКТЫ - РАБОТА С ОБЪЕКТАМИ
// ============================================

/**
 * Создает пользователя
 * @param {string} name - Имя пользователя
 * @param {number} age - Возраст пользователя
 * @returns {Object} Объект пользователя с методами
 */
function createUser(name, age) {
  return {
    name,
    age,
    greet() {
      return `Hello, ${this.name}!`;
    },
    isAdult() {
      return this.age >= 18;
    },
    getInfo() {
      return `${this.name}, ${this.age} years old`;
    },
  };
}

/**
 * Объединяет два объекта
 * @param {Object} obj1 - Первый объект
 * @param {Object} obj2 - Второй объект
 * @returns {Object} Объединенный объект
 */
function mergeObjects(obj1, obj2) {
  return { ...obj1, ...obj2 };
}

/**
 * Выбирает указанные свойства из объекта
 * @param {Object} obj - Исходный объект
 * @param {string[]} keys - Массив ключей для выборки
 * @returns {Object} Новый объект с выбранными свойствами
 */
function pickProperties(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (obj.hasOwnProperty(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Исключает указанные свойства из объекта
 * @param {Object} obj - Исходный объект
 * @param {string[]} keys - Массив ключей для исключения
 * @returns {Object} Новый объект без исключенных свойств
 */
function omitProperties(obj, keys) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Создает глубокую копию объекта
 * @param {Object} obj - Исходный объект
 * @returns {Object} Глубокая копия объекта
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Проверяет, содержит ли объект все указанные свойства
 * @param {Object} obj - Проверяемый объект
 * @param {string[]} keys - Массив ключей для проверки
 * @returns {boolean} true если объект содержит все свойства
 */
function hasAllProperties(obj, keys) {
  for (const key of keys) {
    if (!obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

/**
 * Создает объект из массива ключей и значений
 * @param {string[]} keys - Массив ключей
 * @param {any[]} values - Массив значений
 * @returns {Object} Созданный объект
 */
function zipToObject(keys, values) {
  const result = {};
  const minLength = Math.min(keys.length, values.length);
  for (let i = 0; i < minLength; i++) {
    result[keys[i]] = values[i];
  }
  return result;
}

/**
 * Инвертирует объект (меняет местами ключи и значения)
 * @param {Object} obj - Исходный объект
 * @returns {Object} Инвертированный объект
 */
function invertObject(obj) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      // Значения должны быть строками для использования в качестве ключей
      if (typeof value === 'string' || typeof value === 'number') {
        result[String(value)] = key;
      }
    }
  }
  return result;
}

/**
 * Группирует массив объектов по указанному ключу
 * @param {Object[]} items - Массив объектов для группировки
 * @param {string} key - Ключ для группировки
 * @returns {Object} Объект с группами
 */
function groupBy(items, key) {
  const groups = {};
  for (const item of items) {
    const groupKey = item[key] || 'undefined';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  }
  return groups;
}

/**
 * Создает объект с подсчетом количества вхождений значений
 * @param {any[]} items - Массив элементов
 * @returns {Object} Объект с подсчетом вхождений
 */
function countOccurrences(items) {
  const counts = {};
  for (const item of items) {
    const key = String(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Преобразует объект в массив пар [ключ, значение]
 * @param {Object} obj - Исходный объект
 * @returns {Array<[string, any]>} Массив пар
 */
function entries(obj) {
  const result = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result.push([key, obj[key]]);
    }
  }
  return result;
}

/**
 * Фильтрует объект по предикату
 * @param {Object} obj - Исходный объект
 * @param {Function} predicate - Функция-предикат (key, value) => boolean
 * @returns {Object} Отфильтрованный объект
 */
function filterObject(obj, predicate) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (predicate(key, value)) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Применяет функцию к каждому значению объекта
 * @param {Object} obj - Исходный объект
 * @param {Function} fn - Функция преобразования (value, key) => any
 * @returns {Object} Объект с преобразованными значениями
 */
function mapObject(obj, fn) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = fn(obj[key], key);
    }
  }
  return result;
}

/**
 * Проверяет, являются ли два объекта глубоко равными
 * @param {any} obj1 - Первый объект для сравнения
 * @param {any} obj2 - Второй объект для сравнения
 * @returns {boolean} true если объекты глубоко равны
 */
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;

  if (obj1 === null || obj2 === null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

// Экспорты
export {
  createUser,
  mergeObjects,
  pickProperties,
  omitProperties,
  deepClone,
  hasAllProperties,
  zipToObject,
  invertObject,
  groupBy,
  countOccurrences,
  entries,
  filterObject,
  mapObject,
  deepEqual,
};
