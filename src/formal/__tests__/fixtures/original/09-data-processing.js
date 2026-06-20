// packages/ast-analyzer/src/formal/__tests__/fixtures/original/09-data-processing.js

// ============================================
// ОБРАБОТКА ДАННЫХ - ОРИГИНАЛЬНЫЙ ФАЙЛ
// ============================================
// Этот файл содержит функции для обработки и трансформации данных,
// которые будут рефакториться в модули

/**
 * Обработка элементов с фильтрацией и маппингом
 * @param {Array} items - Массив элементов для обработки
 * @returns {Array} - Массив обработанных элементов
 */
function processItems(items) {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items
    .filter(item => item && typeof item === 'object' && item.active === true)
    .map(item => ({
      id: item.id || 'unknown',
      name: item.name ? item.name.toUpperCase() : 'UNNAMED',
      value: (item.value || 0) * 1.1,
      category: item.category || 'general',
      processed: true,
      processedAt: new Date().toISOString(),
    }));
}

/**
 * Группировка элементов по категории
 * @param {Array} items - Массив элементов для группировки
 * @returns {Object} - Объект с группами по категориям
 */
function groupByCategory(items) {
  if (!items || !Array.isArray(items)) {
    return {};
  }

  const groups = {};
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const category = item.category || 'uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  }

  // Сортируем элементы внутри каждой группы
  for (const category in groups) {
    if (Object.prototype.hasOwnProperty.call(groups, category)) {
      groups[category].sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
    }
  }

  return groups;
}

/**
 * Агрегация данных с вычислением статистик
 * @param {Array} data - Массив данных для агрегации
 * @returns {Object} - Объект со статистиками
 */
function aggregateData(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
      variance: 0,
      stdDev: 0,
    };
  }

  const validItems = data.filter(
    item => item && typeof item === 'object' && typeof item.value === 'number'
  );

  if (validItems.length === 0) {
    return {
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
      variance: 0,
      stdDev: 0,
    };
  }

  const values = validItems.map(item => item.value);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const count = values.length;
  const avg = sum / count;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    sum,
    avg,
    min,
    max,
    variance,
    stdDev,
  };
}

/**
 * Пагинация данных
 * @param {Array} data - Массив данных для пагинации
 * @param {number} page - Номер страницы (начиная с 1)
 * @param {number} pageSize - Размер страницы
 * @returns {Object} - Объект с пагинированными данными и мета-информацией
 */
function paginateData(data, page = 1, pageSize = 10) {
  if (!data || !Array.isArray(data)) {
    return {
      items: [],
      total: 0,
      page: page,
      pageSize: pageSize,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    };
  }

  const total = data.length;
  const totalPages = Math.ceil(total / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const items = data.slice(start, end);

  return {
    items,
    total,
    page: safePage,
    pageSize: pageSize,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

/**
 * Сортировка данных по указанному полю
 * @param {Array} data - Массив данных для сортировки
 * @param {string} field - Поле для сортировки
 * @param {string} order - Порядок сортировки ('asc' или 'desc')
 * @returns {Array} - Отсортированный массив
 */
function sortData(data, field = 'id', order = 'asc') {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  const sorted = [...data];
  const orderMultiplier = order === 'desc' ? -1 : 1;

  sorted.sort((a, b) => {
    const valA = a && typeof a === 'object' ? a[field] : undefined;
    const valB = b && typeof b === 'object' ? b[field] : undefined;

    if (valA === valB) return 0;
    if (valA === undefined || valA === null) return orderMultiplier * 1;
    if (valB === undefined || valB === null) return orderMultiplier * -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return orderMultiplier * valA.localeCompare(valB);
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return orderMultiplier * (valA - valB);
    }

    const strA = String(valA);
    const strB = String(valB);
    return orderMultiplier * strA.localeCompare(strB);
  });

  return sorted;
}

/**
 * Фильтрация данных по нескольким критериям
 * @param {Array} data - Массив данных для фильтрации
 * @param {Object} filters - Объект с критериями фильтрации
 * @returns {Array} - Отфильтрованный массив
 */
function filterData(data, filters = {}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  if (!filters || typeof filters !== 'object' || Object.keys(filters).length === 0) {
    return data;
  }

  return data.filter(item => {
    if (!item || typeof item !== 'object') return false;

    for (const [field, value] of Object.entries(filters)) {
      const itemValue = item[field];

      // Проверка на undefined/null
      if (value === undefined || value === null) {
        if (itemValue !== undefined && itemValue !== null) return false;
        continue;
      }

      // Проверка на строку
      if (typeof value === 'string') {
        if (typeof itemValue !== 'string') return false;
        if (!itemValue.toLowerCase().includes(value.toLowerCase())) return false;
        continue;
      }

      // Проверка на число
      if (typeof value === 'number') {
        if (typeof itemValue !== 'number') return false;
        if (itemValue !== value) return false;
        continue;
      }

      // Проверка на boolean
      if (typeof value === 'boolean') {
        if (typeof itemValue !== 'boolean') return false;
        if (itemValue !== value) return false;
        continue;
      }

      // Проверка на массив (contains)
      if (Array.isArray(value)) {
        if (!Array.isArray(itemValue)) return false;
        const found = value.some(v => itemValue.includes(v));
        if (!found) return false;
        continue;
      }

      // Проверка на объект (диапазон)
      if (typeof value === 'object' && value !== null) {
        if (typeof itemValue !== 'number') return false;
        if (value.min !== undefined && itemValue < value.min) return false;
        if (value.max !== undefined && itemValue > value.max) return false;
        continue;
      }
    }

    return true;
  });
}

/**
 * Трансформация данных с применением нескольких функций
 * @param {Array} data - Массив данных для трансформации
 * @param {Array} transformers - Массив функций-трансформеров
 * @returns {Array} - Трансформированный массив
 */
function transformData(data, transformers = []) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  if (!transformers || !Array.isArray(transformers) || transformers.length === 0) {
    return data;
  }

  let result = data;
  for (const transformer of transformers) {
    if (typeof transformer === 'function') {
      result = transformer(result);
    }
  }

  return result;
}

/**
 * Поиск дубликатов в данных
 * @param {Array} data - Массив данных для поиска дубликатов
 * @param {string} field - Поле для сравнения
 * @returns {Object} - Объект с найденными дубликатами
 */
function findDuplicates(data, field = 'id') {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      duplicates: [],
      duplicateCount: 0,
      uniqueCount: 0,
    };
  }

  const seen = new Map();
  const duplicates = [];

  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const key = item[field];
    if (key === undefined || key === null) continue;

    if (seen.has(key)) {
      duplicates.push({
        key,
        first: seen.get(key),
        duplicate: item,
      });
    } else {
      seen.set(key, item);
    }
  }

  return {
    duplicates,
    duplicateCount: duplicates.length,
    uniqueCount: seen.size,
  };
}

/**
 * Нормализация данных (приведение к единому формату)
 * @param {Array} data - Массив данных для нормализации
 * @param {Object} schema - Схема нормализации
 * @returns {Array} - Нормализованный массив
 */
function normalizeData(data, schema = {}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
    return data;
  }

  return data.map(item => {
    if (!item || typeof item !== 'object') return item;

    const normalized = {};
    for (const [targetField, sourceField] of Object.entries(schema)) {
      if (typeof sourceField === 'string') {
        normalized[targetField] = item[sourceField];
      } else if (typeof sourceField === 'function') {
        normalized[targetField] = sourceField(item);
      } else {
        normalized[targetField] = item[targetField];
      }
    }

    return normalized;
  });
}

/**
 * Валидация данных по схеме
 * @param {Object} data - Данные для валидации
 * @param {Object} schema - Схема валидации
 * @returns {Object} - Результат валидации
 */
function validateData(data, schema = {}) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Data must be an object'],
    };
  }

  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Проверка обязательности
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Field '${field}' is required`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    // Проверка типа
    if (rules.type) {
      const expectedType = rules.type;
      const actualType = typeof value;

      if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push(`Field '${field}' must be an array`);
      } else if (expectedType !== 'array' && actualType !== expectedType) {
        errors.push(`Field '${field}' must be of type '${expectedType}', got '${actualType}'`);
      }
    }

    // Проверка минимального значения
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors.push(`Field '${field}' must be at least ${rules.min}`);
    }

    // Проверка максимального значения
    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      errors.push(`Field '${field}' must be at most ${rules.max}`);
    }

    // Проверка минимальной длины
    if (
      rules.minLength !== undefined &&
      typeof value === 'string' &&
      value.length < rules.minLength
    ) {
      errors.push(`Field '${field}' must have at least ${rules.minLength} characters`);
    }

    // Проверка максимальной длины
    if (
      rules.maxLength !== undefined &&
      typeof value === 'string' &&
      value.length > rules.maxLength
    ) {
      errors.push(`Field '${field}' must have at most ${rules.maxLength} characters`);
    }

    // Проверка паттерна
    if (rules.pattern && typeof value === 'string') {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        errors.push(`Field '${field}' does not match pattern '${rules.pattern}'`);
      }
    }

    // Проверка допустимых значений
    if (rules.enum && Array.isArray(rules.enum)) {
      if (!rules.enum.includes(value)) {
        errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Слияние нескольких массивов данных
 * @param {Array} arrays - Массив массивов для слияния
 * @param {string} key - Ключ для объединения
 * @returns {Array} - Объединенный массив
 */
function mergeData(arrays, key = 'id') {
  if (!arrays || !Array.isArray(arrays) || arrays.length === 0) {
    return [];
  }

  const mergedMap = new Map();

  for (const arr of arrays) {
    if (!arr || !Array.isArray(arr)) continue;

    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const keyValue = item[key];
      if (keyValue === undefined || keyValue === null) continue;

      if (mergedMap.has(keyValue)) {
        // Объединение объектов
        const existing = mergedMap.get(keyValue);
        mergedMap.set(keyValue, {
          ...existing,
          ...item,
        });
      } else {
        mergedMap.set(keyValue, { ...item });
      }
    }
  }

  return Array.from(mergedMap.values());
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  processItems,
  groupByCategory,
  aggregateData,
  paginateData,
  sortData,
  filterData,
  transformData,
  findDuplicates,
  normalizeData,
  validateData,
  mergeData,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * Этот файл содержит 11 функций для обработки данных:
 * 1. processItems - фильтрация и маппинг
 * 2. groupByCategory - группировка по категории
 * 3. aggregateData - агрегация со статистиками
 * 4. paginateData - пагинация данных
 * 5. sortData - сортировка по полю
 * 6. filterData - фильтрация по критериям
 * 7. transformData - трансформация через функции
 * 8. findDuplicates - поиск дубликатов
 * 9. normalizeData - нормализация по схеме
 * 10. validateData - валидация по схеме
 * 11. mergeData - слияние массивов
 */
