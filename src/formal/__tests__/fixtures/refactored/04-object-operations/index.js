// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/04-object-operations/index.js

// ============================================
// ОПЕРАЦИИ С ОБЪЕКТАМИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все операции с объектами вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт базовых операций с объектами
import {
  deepClone,
  shallowClone,
  mergeObjects,
  pickProperties,
  omitProperties,
  hasProperty,
  getProperty,
  setProperty,
  deleteProperty,
  getNestedValue,
  setNestedValue,
  hasNestedProperty,
  getKeys,
  getValues,
  getEntries,
  countProperties,
  isEmpty,
  isEqual,
  isShallowEqual,
  isDeepEqual,
  findKey,
  findKeys,
  mapValues,
  filterProperties,
  transformKeys,
  invertKeys,
  flattenObject,
  unflattenObject,
  groupBy,
  sortBy,
  pluck,
  zipObjects,
  mergeDeep,
  mergeDeepWith,
  omitDeep,
  pickDeep,
  getWithDefault,
} from './modules/object-utils.js';

// Импорт фабрик объектов
import {
  createUser,
  createProduct,
  createOrder,
  createAddress,
  createCompany,
  createEmployee,
  createCustomer,
  createInvoice,
  createPayment,
  createSubscription,
  createProfile,
  createSettings,
  createConfig,
  createCache,
  createPool,
  createFactory,
  createBuilder,
  createSingleton,
  createPrototype,
  createMixin,
} from './modules/factories.js';

// Импорт валидаторов объектов
import {
  validateObject,
  validateRequired,
  validateType,
  validatePattern,
  validateEmail,
  validatePhone,
  validateUrl,
  validateDate,
  validateNumber,
  validateString,
  validateArray,
  validateObjectSchema,
  validateNested,
  validateAll,
  validateAny,
  validateCustom,
  createValidator,
  composeValidators,
  getValidationErrors,
} from './modules/validators.js';

// ============================================
// КОМПОЗИЦИЯ ОПЕРАЦИЙ С ОБЪЕКТАМИ
// ============================================

/**
 * Создает глубокую копию объекта и применяет трансформации
 * @param {Object} obj - Исходный объект
 * @param {Function} transformFn - Функция трансформации
 * @returns {Object} - Трансформированная копия
 */
function cloneAndTransform(obj, transformFn) {
  const cloned = deepClone(obj);
  return transformValues(cloned, transformFn);
}

/**
 * Рекурсивно применяет трансформацию ко всем значениям объекта
 * @param {Object} obj - Объект для трансформации
 * @param {Function} transformFn - Функция трансформации
 * @returns {Object} - Трансформированный объект
 */
function transformValues(obj, transformFn) {
  if (typeof obj !== 'object' || obj === null) {
    return transformFn(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformValues(item, transformFn));
  }

  const result = {};
  for (const [key, value] of getEntries(obj)) {
    result[key] = transformValues(value, transformFn);
  }
  return result;
}

/**
 * Объединяет несколько объектов с глубоким слиянием
 * @param {...Object} objects - Объекты для слияния
 * @returns {Object} - Результат слияния
 */
function mergeMultipleObjects(...objects) {
  if (objects.length === 0) {
    return {};
  }
  if (objects.length === 1) {
    return deepClone(objects[0]);
  }
  return objects.reduce((acc, obj) => mergeDeep(acc, obj), {});
}

/**
 * Создает объект из массива пар [ключ, значение]
 * @param {Array<Array>} pairs - Массив пар
 * @returns {Object} - Созданный объект
 */
function fromPairs(pairs) {
  if (!Array.isArray(pairs)) {
    throw new TypeError('Expected an array of pairs');
  }
  const result = {};
  for (const [key, value] of pairs) {
    result[key] = value;
  }
  return result;
}

/**
 * Разбивает объект на несколько объектов по группам ключей
 * @param {Object} obj - Исходный объект
 * @param {...Array<string>} keyGroups - Группы ключей
 * @returns {Array<Object>} - Массив объектов
 */
function partitionObject(obj, ...keyGroups) {
  if (typeof obj !== 'object' || obj === null) {
    throw new TypeError('Expected an object');
  }

  const result = [];
  const usedKeys = new Set();

  for (const keys of keyGroups) {
    const part = {};
    for (const key of keys) {
      if (hasProperty(obj, key)) {
        part[key] = obj[key];
        usedKeys.add(key);
      }
    }
    result.push(part);
  }

  // Остальные ключи
  const remaining = omitProperties(obj, Array.from(usedKeys));
  if (!isEmpty(remaining)) {
    result.push(remaining);
  }

  return result;
}

/**
 * Создает объект с сохранением только уникальных значений
 * @param {Object} obj - Исходный объект
 * @returns {Object} - Объект с уникальными значениями
 */
function uniqueValues(obj) {
  if (typeof obj !== 'object' || obj === null) {
    throw new TypeError('Expected an object');
  }

  const seen = new Set();
  const result = {};
  for (const [key, value] of getEntries(obj)) {
    if (!seen.has(value)) {
      seen.add(value);
      result[key] = value;
    }
  }
  return result;
}

/**
 * Инвертирует объект (ключи становятся значениями, а значения - ключами)
 * @param {Object} obj - Исходный объект
 * @returns {Object} - Инвертированный объект
 */
function invertObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    throw new TypeError('Expected an object');
  }

  const result = {};
  for (const [key, value] of getEntries(obj)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol') {
      result[value] = key;
    } else {
      throw new TypeError('Values must be strings, numbers, or symbols for inversion');
    }
  }
  return result;
}

/**
 * Создает объект с использованием цепочки вызовов (fluent interface)
 * @param {Object} initial - Начальный объект
 * @returns {Object} - Объект с цепочкой методов
 */
function createFluentObject(initial = {}) {
  const obj = deepClone(initial);

  return {
    set(key, value) {
      obj[key] = value;
      return this;
    },
    get(key) {
      return obj[key];
    },
    merge(other) {
      Object.assign(obj, deepClone(other));
      return this;
    },
    pick(keys) {
      const picked = pickProperties(obj, keys);
      Object.keys(obj).forEach(k => delete obj[k]);
      Object.assign(obj, picked);
      return this;
    },
    omit(keys) {
      for (const key of keys) {
        delete obj[key];
      }
      return this;
    },
    transform(fn) {
      const transformed = fn(obj);
      Object.keys(obj).forEach(k => delete obj[k]);
      Object.assign(obj, transformed);
      return this;
    },
    value() {
      return deepClone(obj);
    },
    toJSON() {
      return JSON.stringify(obj);
    },
    inspect() {
      return obj;
    },
  };
}

// ============================================
// РАБОТА С КОЛЛЕКЦИЯМИ ОБЪЕКТОВ
// ============================================

/**
 * Создает индекс для коллекции объектов
 * @param {Array<Object>} collection - Коллекция объектов
 * @param {string} key - Ключ для индексации
 * @returns {Object} - Индекс (ключ -> объект)
 */
function createIndex(collection, key) {
  if (!Array.isArray(collection)) {
    throw new TypeError('Expected an array');
  }

  const index = {};
  for (const item of collection) {
    const indexKey = getProperty(item, key);
    if (indexKey !== undefined) {
      index[indexKey] = item;
    }
  }
  return index;
}

/**
 * Создает многомерный индекс для коллекции объектов
 * @param {Array<Object>} collection - Коллекция объектов
 * @param {Array<string>} keys - Ключи для индексации
 * @returns {Object} - Многомерный индекс
 */
function createMultiIndex(collection, keys) {
  if (!Array.isArray(collection)) {
    throw new TypeError('Expected an array');
  }

  const index = {};
  for (const item of collection) {
    let current = index;
    for (const key of keys) {
      const value = getProperty(item, key);
      if (value === undefined) break;
      if (!current[value]) {
        current[value] = {};
      }
      current = current[value];
    }
    if (!current._items) {
      current._items = [];
    }
    current._items.push(item);
  }
  return index;
}

/**
 * Создает lookup таблицу для быстрого поиска
 * @param {Array<Object>} collection - Коллекция объектов
 * @param {string} key - Ключ для поиска
 * @param {string} valueKey - Ключ значения (опционально)
 * @returns {Object} - Lookup таблица
 */
function createLookup(collection, key, valueKey = null) {
  if (!Array.isArray(collection)) {
    throw new TypeError('Expected an array');
  }

  const lookup = {};
  for (const item of collection) {
    const lookupKey = getProperty(item, key);
    if (lookupKey !== undefined) {
      lookup[lookupKey] = valueKey !== null ? getProperty(item, valueKey) : item;
    }
  }
  return lookup;
}

// ============================================
// ОБЪЕДИНЕНИЕ ОПЕРАЦИЙ С ФАБРИКАМИ
// ============================================

/**
 * Создает пользователя с валидацией
 * @param {Object} data - Данные пользователя
 * @param {Object} schema - Схема валидации
 * @returns {Object} - Созданный пользователь
 */
function createValidatedUser(data, schema = null) {
  const user = createUser(data);

  if (schema) {
    const errors = validateObjectSchema(user, schema);
    if (!isEmpty(errors)) {
      throw new Error(`Validation errors: ${JSON.stringify(errors)}`);
    }
  }

  return user;
}

/**
 * Создает продукт с автоматической генерацией ID
 * @param {Object} data - Данные продукта
 * @param {Function} idGenerator - Генератор ID
 * @returns {Object} - Созданный продукт
 */
function createProductWithId(data, idGenerator = () => Date.now()) {
  const product = createProduct(data);
  product.id = idGenerator();
  return product;
}

/**
 * Создает заказ с расчетом итоговой суммы
 * @param {Object} data - Данные заказа
 * @param {Array} products - Массив продуктов
 * @param {Function} calculator - Функция расчета
 * @returns {Object} - Созданный заказ
 */
function createOrderWithTotal(data, products, calculator = null) {
  const order = createOrder(data);
  order.products = products;
  order.total = calculator ? calculator(products) : products.reduce((sum, p) => sum + p.price, 0);
  return order;
}

// ============================================
// КОМПОЗИЦИЯ ВАЛИДАТОРОВ
// ============================================

/**
 * Создает составной валидатор из нескольких валидаторов
 * @param {Array<Function>} validators - Массив валидаторов
 * @returns {Function} - Составной валидатор
 */
function composeValidatorsFromArray(validators) {
  if (!Array.isArray(validators)) {
    throw new TypeError('Expected an array of validators');
  }
  return composeValidators(...validators);
}

/**
 * Создает валидатор объекта по схеме
 * @param {Object} schema - Схема валидации
 * @returns {Function} - Валидатор
 */
function createObjectValidator(schema) {
  return createValidator(schema);
}

/**
 * Валидирует объект с возвратом всех ошибок
 * @param {Object} obj - Объект для валидации
 * @param {Object} schema - Схема валидации
 * @returns {Object} - Объект с ошибками
 */
function validateWithErrors(obj, schema) {
  const errors = validateObjectSchema(obj, schema);
  if (isEmpty(errors)) {
    return { valid: true, errors: null };
  }
  return { valid: false, errors };
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт утилит объектов
export {
  deepClone,
  shallowClone,
  mergeObjects,
  pickProperties,
  omitProperties,
  hasProperty,
  getProperty,
  setProperty,
  deleteProperty,
  getNestedValue,
  setNestedValue,
  hasNestedProperty,
  getKeys,
  getValues,
  getEntries,
  countProperties,
  isEmpty,
  isEqual,
  isShallowEqual,
  isDeepEqual,
  findKey,
  findKeys,
  mapValues,
  filterProperties,
  transformKeys,
  invertKeys,
  flattenObject,
  unflattenObject,
  groupBy,
  sortBy,
  pluck,
  zipObjects,
  mergeDeep,
  mergeDeepWith,
  omitDeep,
  pickDeep,
  getWithDefault,
};

// Реэкспорт фабрик
export {
  createUser,
  createProduct,
  createOrder,
  createAddress,
  createCompany,
  createEmployee,
  createCustomer,
  createInvoice,
  createPayment,
  createSubscription,
  createProfile,
  createSettings,
  createConfig,
  createCache,
  createPool,
  createFactory,
  createBuilder,
  createSingleton,
  createPrototype,
  createMixin,
};

// Реэкспорт валидаторов
export {
  validateObject,
  validateRequired,
  validateType,
  validatePattern,
  validateEmail,
  validatePhone,
  validateUrl,
  validateDate,
  validateNumber,
  validateString,
  validateArray,
  validateObjectSchema,
  validateNested,
  validateAll,
  validateAny,
  validateCustom,
  createValidator,
  composeValidators,
  getValidationErrors,
};

// Реэкспорт композиций
export {
  cloneAndTransform,
  transformValues,
  mergeMultipleObjects,
  fromPairs,
  partitionObject,
  uniqueValues,
  invertObject,
  createFluentObject,
  createIndex,
  createMultiIndex,
  createLookup,
  createValidatedUser,
  createProductWithId,
  createOrderWithTotal,
  composeValidatorsFromArray,
  createObjectValidator,
  validateWithErrors,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с операциями над объектами
 */
export default {
  // Утилиты объектов
  deepClone,
  shallowClone,
  mergeObjects,
  pickProperties,
  omitProperties,
  hasProperty,
  getProperty,
  setProperty,
  deleteProperty,
  getNestedValue,
  setNestedValue,
  hasNestedProperty,
  getKeys,
  getValues,
  getEntries,
  countProperties,
  isEmpty,
  isEqual,
  isShallowEqual,
  isDeepEqual,
  findKey,
  findKeys,
  mapValues,
  filterProperties,
  transformKeys,
  invertKeys,
  flattenObject,
  unflattenObject,
  groupBy,
  sortBy,
  pluck,
  zipObjects,
  mergeDeep,
  mergeDeepWith,
  omitDeep,
  pickDeep,
  getWithDefault,

  // Фабрики
  createUser,
  createProduct,
  createOrder,
  createAddress,
  createCompany,
  createEmployee,
  createCustomer,
  createInvoice,
  createPayment,
  createSubscription,
  createProfile,
  createSettings,
  createConfig,
  createCache,
  createPool,
  createFactory,
  createBuilder,
  createSingleton,
  createPrototype,
  createMixin,

  // Валидаторы
  validateObject,
  validateRequired,
  validateType,
  validatePattern,
  validateEmail,
  validatePhone,
  validateUrl,
  validateDate,
  validateNumber,
  validateString,
  validateArray,
  validateObjectSchema,
  validateNested,
  validateAll,
  validateAny,
  validateCustom,
  createValidator,
  composeValidators,
  getValidationErrors,

  // Композиции
  cloneAndTransform,
  transformValues,
  mergeMultipleObjects,
  fromPairs,
  partitionObject,
  uniqueValues,
  invertObject,
  createFluentObject,
  createIndex,
  createMultiIndex,
  createLookup,
  createValidatedUser,
  createProductWithId,
  createOrderWithTotal,
  composeValidatorsFromArray,
  createObjectValidator,
  validateWithErrors,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ОПЕРАЦИЙ С ОБЪЕКТАМИ
 *
 * 1. Утилиты объектов вынесены в object-utils.js:
 *    - Базовые операции (clone, merge, pick, omit)
 *    - Доступ к свойствам (get, set, has, delete)
 *    - Работа с вложенными свойствами (getNestedValue, setNestedValue)
 *    - Итерация (keys, values, entries)
 *    - Сравнение (isEqual, isShallowEqual, isDeepEqual)
 *    - Трансформация (mapValues, filterProperties, transformKeys)
 *    - Глубокие операции (flattenObject, unflattenObject)
 *    - Слияние (mergeDeep, mergeDeepWith)
 *
 * 2. Фабрики объектов вынесены в factories.js:
 *    - Создание различных типов объектов
 *    - Паттерны создания (Factory, Builder, Singleton, Prototype, Mixin)
 *    - Специализированные фабрики (User, Product, Order, etc.)
 *    - Кэширование и пулы объектов
 *
 * 3. Валидаторы объектов вынесены в validators.js:
 *    - Базовые валидаторы (required, type, pattern)
 *    - Специализированные валидаторы (email, phone, url, date)
 *    - Валидация по схеме (validateObjectSchema)
 *    - Композиция валидаторов (composeValidators)
 *    - Кастомные валидаторы (validateCustom, createValidator)
 *
 * 4. Композиции остаются в index.js:
 *    - cloneAndTransform - клонирование с трансформацией
 *    - transformValues - рекурсивная трансформация
 *    - mergeMultipleObjects - множественное слияние
 *    - fromPairs - создание из пар
 *    - partitionObject - разбиение объекта
 *    - uniqueValues - уникальные значения
 *    - invertObject - инверсия объекта
 *    - createFluentObject - цепочка вызовов
 *    - createIndex - индексация коллекций
 *    - createMultiIndex - многомерная индексация
 *    - createLookup - lookup таблица
 *    - createValidatedUser - пользователь с валидацией
 *    - createProductWithId - продукт с ID
 *    - createOrderWithTotal - заказ с расчетом
 *    - composeValidatorsFromArray - композиция валидаторов
 *    - createObjectValidator - валидатор по схеме
 *    - validateWithErrors - валидация с ошибками
 *
 * 5. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 6. Добавлены JSDoc комментарии для всех функций
 *
 * 7. Сохранена обратная совместимость через реэкспорты
 *
 * 8. Добавлены функции для работы с коллекциями объектов
 *
 * 9. Реализованы паттерны проектирования для создания объектов
 *
 * 10. Добавлена система валидации с композицией
 */
