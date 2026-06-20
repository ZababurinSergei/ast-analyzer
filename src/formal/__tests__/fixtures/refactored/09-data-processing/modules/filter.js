// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/09-data-processing/modules/filter.js

// ============================================
// МОДУЛЬ ФИЛЬТРАЦИИ ДАННЫХ
// ============================================
// Этот модуль содержит функции для фильтрации
// данных по различным критериям.

/**
 * Фильтрует элементы по активности
 * @param {Array} data - Массив данных
 * @param {boolean} active - Активность (true/false)
 * @returns {Array} - Отфильтрованный массив
 */
function filterActiveItems(data, active = true) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }
  return data.filter(item => item.active === active);
}

/**
 * Фильтрует элементы по категории
 * @param {Array} data - Массив данных
 * @param {string|Array} categories - Категория или массив категорий
 * @returns {Array} - Отфильтрованный массив
 */
function filterByCategory(data, categories) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  const categoryArray = Array.isArray(categories) ? categories : [categories];
  return data.filter(item => {
    const itemCategory = item.category || item.categoria || item.type;
    return categoryArray.includes(itemCategory);
  });
}

/**
 * Фильтрует элементы по диапазону цен
 * @param {Array} data - Массив данных
 * @param {number} minPrice - Минимальная цена
 * @param {number} maxPrice - Максимальная цена
 * @param {string} priceKey - Ключ цены
 * @returns {Array} - Отфильтрованный массив
 */
function filterByPriceRange(data, minPrice = 0, maxPrice = Infinity, priceKey = 'price') {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  return data.filter(item => {
    const price = item[priceKey] || 0;
    return price >= minPrice && price <= maxPrice;
  });
}

/**
 * Фильтрует элементы по диапазону дат
 * @param {Array} data - Массив данных
 * @param {Date|string} fromDate - Начальная дата
 * @param {Date|string} toDate - Конечная дата
 * @param {string} dateKey - Ключ даты
 * @returns {Array} - Отфильтрованный массив
 */
function filterByDateRange(data, fromDate = null, toDate = null, dateKey = 'date') {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  return data.filter(item => {
    const itemDate = new Date(item[dateKey]);
    if (from && itemDate < from) return false;
    if (to && itemDate > to) return false;
    return true;
  });
}

/**
 * Фильтрует элементы с помощью пользовательского предиката
 * @param {Array} data - Массив данных
 * @param {Function} predicate - Функция-предикат
 * @returns {Array} - Отфильтрованный массив
 */
function filterByCustomPredicate(data, predicate) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }
  if (typeof predicate !== 'function') {
    throw new TypeError('Predicate must be a function');
  }
  return data.filter(predicate);
}

/**
 * Удаляет дубликаты из массива
 * @param {Array} data - Массив данных
 * @param {string|Function} key - Ключ для сравнения
 * @returns {Array} - Массив без дубликатов
 */
function filterUnique(data, key = null) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  if (key === null) {
    return [...new Set(data)];
  }

  const seen = new Set();
  const getKey = typeof key === 'function' ? key : item => item[key];

  return data.filter(item => {
    const value = getKey(item);
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * Фильтрует falsy значения из массива
 * @param {Array} data - Массив данных
 * @returns {Array} - Массив без falsy значений
 */
function filterFalsy(data) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }
  return data.filter(Boolean);
}

/**
 * Фильтрует truthy значения из массива
 * @param {Array} data - Массив данных
 * @returns {Array} - Массив с truthy значениями
 */
function filterTruthy(data) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }
  return data.filter(item => Boolean(item));
}

/**
 * Фильтрует по конкретному ключу
 * @param {Array} data - Массив данных
 * @param {string} key - Ключ для фильтрации
 * @param {any} value - Значение для сравнения
 * @param {string} operator - Оператор сравнения
 * @returns {Array} - Отфильтрованный массив
 */
function filterByKey(data, key, value, operator = '===') {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  return data.filter(item => {
    const itemValue = item[key];
    switch (operator) {
      case '===':
        return itemValue === value;
      case '!==':
        return itemValue !== value;
      case '>':
        return itemValue > value;
      case '>=':
        return itemValue >= value;
      case '<':
        return itemValue < value;
      case '<=':
        return itemValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(itemValue);
      case 'nin':
        return Array.isArray(value) && !value.includes(itemValue);
      case 'regex':
        return value instanceof RegExp && value.test(itemValue);
      case 'typeof':
        return typeof itemValue === value;
      case 'instanceof':
        return itemValue instanceof value;
      default:
        return itemValue === value;
    }
  });
}

/**
 * Фильтрует по нескольким ключам
 * @param {Array} data - Массив данных
 * @param {Object} criteria - Объект с критериями
 * @param {string} operator - Логический оператор ('AND', 'OR')
 * @returns {Array} - Отфильтрованный массив
 */
function filterByKeys(data, criteria, operator = 'AND') {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  const keys = Object.keys(criteria);

  return data.filter(item => {
    const results = keys.map(key => {
      const condition = criteria[key];
      if (typeof condition === 'function') {
        return condition(item[key], item);
      }
      if (Array.isArray(condition)) {
        return condition.includes(item[key]);
      }
      if (condition && typeof condition === 'object') {
        const { value, operator: op = '===' } = condition;
        return filterByKey([item], key, value, op).length > 0;
      }
      return item[key] === condition;
    });

    return operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
  });
}

/**
 * Фильтрует по тексту (поиск)
 * @param {Array} data - Массив данных
 * @param {string} searchText - Текст для поиска
 * @param {Array} keys - Ключи для поиска
 * @param {Object} options - Опции поиска
 * @returns {Array} - Отфильтрованный массив
 */
function filterByText(data, searchText, keys = null, options = {}) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  if (!searchText || searchText.trim() === '') {
    return data;
  }

  const { caseSensitive = false, exact = false, trim = true } = options;
  let search = searchText;
  if (trim) search = search.trim();
  if (!caseSensitive) search = search.toLowerCase();

  const searchKeys = keys || Object.keys(data[0] || {});

  return data.filter(item => {
    return searchKeys.some(key => {
      let value = item[key];
      if (value === null || value === undefined) return false;

      value = String(value);
      if (trim) value = value.trim();
      if (!caseSensitive) value = value.toLowerCase();

      if (exact) {
        return value === search;
      }
      return value.includes(search);
    });
  });
}

/**
 * Фильтрует по наличию свойств
 * @param {Array} data - Массив данных
 * @param {Array} requiredKeys - Обязательные ключи
 * @param {boolean} allRequired - Все ключи должны присутствовать
 * @returns {Array} - Отфильтрованный массив
 */
function filterByExistence(data, requiredKeys, allRequired = true) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  return data.filter(item => {
    const hasKeys = requiredKeys.map(
      key => item.hasOwnProperty(key) && item[key] !== null && item[key] !== undefined
    );

    return allRequired ? hasKeys.every(Boolean) : hasKeys.some(Boolean);
  });
}

/**
 * Фильтрует по диапазону чисел
 * @param {Array} data - Массив данных
 * @param {string} key - Ключ для фильтрации
 * @param {number} min - Минимальное значение
 * @param {number} max - Максимальное значение
 * @param {boolean} inclusive - Включать границы
 * @returns {Array} - Отфильтрованный массив
 */
function filterByNumberRange(data, key, min = null, max = null, inclusive = true) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  return data.filter(item => {
    const value = item[key];
    if (typeof value !== 'number' || isNaN(value)) {
      return false;
    }

    let result = true;
    if (min !== null) {
      result = result && (inclusive ? value >= min : value > min);
    }
    if (max !== null) {
      result = result && (inclusive ? value <= max : value < max);
    }
    return result;
  });
}

/**
 * Фильтрует по длине строки
 * @param {Array} data - Массив данных
 * @param {string} key - Ключ строки
 * @param {number} minLength - Минимальная длина
 * @param {number} maxLength - Максимальная длина
 * @returns {Array} - Отфильтрованный массив
 */
function filterByStringLength(data, key, minLength = 0, maxLength = Infinity) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  return data.filter(item => {
    const value = item[key];
    if (typeof value !== 'string') {
      return false;
    }
    return value.length >= minLength && value.length <= maxLength;
  });
}

/**
 * Фильтрует по регулярному выражению
 * @param {Array} data - Массив данных
 * @param {string} key - Ключ для фильтрации
 * @param {RegExp} pattern - Регулярное выражение
 * @param {boolean} negate - Инвертировать результат
 * @returns {Array} - Отфильтрованный массив
 */
function filterByRegex(data, key, pattern, negate = false) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }
  if (!(pattern instanceof RegExp)) {
    throw new TypeError('Pattern must be a RegExp');
  }

  return data.filter(item => {
    const value = String(item[key] || '');
    const matches = pattern.test(value);
    return negate ? !matches : matches;
  });
}

/**
 * Фильтрует с несколькими условиями (композиция)
 * @param {Array} data - Массив данных
 * @param {Array<Function>} filters - Массив функций-фильтров
 * @param {string} strategy - Стратегия ('ALL', 'ANY', 'NONE')
 * @returns {Array} - Отфильтрованный массив
 */
function composeFilters(data, filters, strategy = 'ALL') {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array');
  }

  if (!filters || filters.length === 0) {
    return data;
  }

  return data.filter(item => {
    const results = filters.map(filter => filter(item));

    switch (strategy) {
      case 'ALL':
        return results.every(Boolean);
      case 'ANY':
        return results.some(Boolean);
      case 'NONE':
        return results.every(result => !result);
      default:
        return results.every(Boolean);
    }
  });
}

/**
 * Создает фильтр для значений в диапазоне
 * @param {string} key - Ключ для фильтрации
 * @param {Array} range - Массив [min, max] или [start, end]
 * @param {string} rangeType - Тип диапазона ('number', 'date')
 * @returns {Function} - Функция-фильтр
 */
function createRangeFilter(key, range, rangeType = 'number') {
  if (!range || !Array.isArray(range) || range.length !== 2) {
    throw new Error('Range must be an array of [min, max]');
  }

  const [min, max] = range;

  return item => {
    const value = item[key];
    if (value === null || value === undefined) {
      return false;
    }

    if (rangeType === 'date') {
      const date = new Date(value);
      const from = new Date(min);
      const to = new Date(max);
      return date >= from && date <= to;
    }

    if (rangeType === 'number') {
      return value >= min && value <= max;
    }

    // string - сравнение по длине
    return String(value).length >= min && String(value).length <= max;
  };
}

/**
 * Создает фильтр для проверки наличия значения в массиве
 * @param {string} key - Ключ для фильтрации
 * @param {Array} values - Массив допустимых значений
 * @param {boolean} negate - Инвертировать результат
 * @returns {Function} - Функция-фильтр
 */
function createInFilter(key, values, negate = false) {
  if (!Array.isArray(values)) {
    throw new TypeError('Values must be an array');
  }

  return item => {
    const value = item[key];
    const inArray = values.includes(value);
    return negate ? !inArray : inArray;
  };
}

/**
 * Создает фильтр для поиска по тексту
 * @param {string|Array} keys - Ключи для поиска
 * @param {string} searchText - Текст для поиска
 * @param {Object} options - Опции поиска
 * @returns {Function} - Функция-фильтр
 */
function createTextFilter(keys, searchText, options = {}) {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  const { caseSensitive = false, exact = false, trim = true } = options;

  let search = searchText;
  if (trim) search = search.trim();
  if (!caseSensitive) search = search.toLowerCase();

  return item => {
    return keyArray.some(key => {
      let value = item[key];
      if (value === null || value === undefined) return false;

      value = String(value);
      if (trim) value = value.trim();
      if (!caseSensitive) value = value.toLowerCase();

      if (exact) {
        return value === search;
      }
      return value.includes(search);
    });
  };
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные фильтры
  filterActiveItems,
  filterByCategory,
  filterByPriceRange,
  filterByDateRange,
  filterByCustomPredicate,
  filterUnique,
  filterFalsy,
  filterTruthy,
  filterByKey,
  filterByKeys,

  // Расширенные фильтры
  filterByText,
  filterByExistence,
  filterByNumberRange,
  filterByStringLength,
  filterByRegex,
  composeFilters,

  // Создатели фильтров
  createRangeFilter,
  createInFilter,
  createTextFilter,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  filterActiveItems,
  filterByCategory,
  filterByPriceRange,
  filterByDateRange,
  filterByCustomPredicate,
  filterUnique,
  filterFalsy,
  filterTruthy,
  filterByKey,
  filterByKeys,
  filterByText,
  filterByExistence,
  filterByNumberRange,
  filterByStringLength,
  filterByRegex,
  composeFilters,
  createRangeFilter,
  createInFilter,
  createTextFilter,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ФИЛЬТРАЦИИ ДАННЫХ
 *
 * Этот модуль предоставляет 19 функций для фильтрации данных:
 *
 * 1. filterActiveItems      - Фильтрация по активности
 * 2. filterByCategory       - Фильтрация по категории
 * 3. filterByPriceRange     - Фильтрация по цене
 * 4. filterByDateRange      - Фильтрация по дате
 * 5. filterByCustomPredicate - Пользовательская фильтрация
 * 6. filterUnique           - Удаление дубликатов
 * 7. filterFalsy            - Удаление falsy значений
 * 8. filterTruthy           - Сохранение truthy значений
 * 9. filterByKey            - Фильтрация по ключу
 * 10. filterByKeys          - Фильтрация по нескольким ключам
 * 11. filterByText          - Поиск по тексту
 * 12. filterByExistence     - Проверка наличия свойств
 * 13. filterByNumberRange   - Фильтрация по числовому диапазону
 * 14. filterByStringLength  - Фильтрация по длине строки
 * 15. filterByRegex         - Фильтрация по регулярному выражению
 * 16. composeFilters        - Композиция фильтров
 * 17. createRangeFilter     - Создание фильтра диапазона
 * 18. createInFilter        - Создание фильтра IN
 * 19. createTextFilter      - Создание фильтра текста
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные операторы сравнения
 * - Работают с различными типами данных
 * - Поддерживают композицию фильтров
 * - Имеют JSDoc с описанием параметров
 */
