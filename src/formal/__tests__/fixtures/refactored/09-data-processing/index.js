// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/09-data-processing/index.js

// ============================================
// ОБРАБОТКА ДАННЫХ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все функции обработки данных вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт функций фильтрации данных
import {
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
} from './modules/filter.js';

// Импорт функций группировки данных
import {
  groupByCategory,
  groupByKey,
  groupByDate,
  groupByRange,
  groupByMultipleKeys,
  groupByCustom,
  aggregateGroups,
  getGroupStats,
  GroupAggregator,
} from './modules/group.js';

// Импорт функций трансформации данных
import {
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
} from './modules/transform.js';

// Импорт агрегаторов
import {
  aggregateData,
  aggregateByKeys,
  aggregateByDate,
  aggregateByCategory,
  calculateAggregates,
  Aggregator,
  aggregateSum,
  aggregateAverage,
  aggregateMin,
  aggregateMax,
  aggregateCount,
  aggregateFirst,
  aggregateLast,
} from './modules/aggregate.js';

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ ОБРАБОТКИ ДАННЫХ
// ============================================

/**
 * Полная обработка данных: фильтрация -> трансформация -> агрегация
 * @param {Array} data - Исходные данные
 * @param {Object} options - Опции обработки
 * @param {Object} options.filter - Настройки фильтрации
 * @param {Object} options.transform - Настройки трансформации
 * @param {Object} options.aggregate - Настройки агрегации
 * @returns {Object} - Результат обработки
 */
function processDataPipeline(data, options = {}) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array of data');
  }

  let processedData = [...data];

  // Шаг 1: Фильтрация
  if (options.filter) {
    const { active, category, priceMin, priceMax, dateFrom, dateTo, custom } = options.filter;

    if (active !== undefined) {
      processedData = filterActiveItems(processedData, active);
    }
    if (category) {
      processedData = filterByCategory(processedData, category);
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      processedData = filterByPriceRange(processedData, priceMin || 0, priceMax || Infinity);
    }
    if (dateFrom || dateTo) {
      processedData = filterByDateRange(processedData, dateFrom, dateTo);
    }
    if (custom) {
      processedData = filterByCustomPredicate(processedData, custom);
    }
  }

  // Шаг 2: Трансформация
  if (options.transform) {
    const { pick, omit, rename, flatten, map, transformFn } = options.transform;

    if (pick) {
      processedData = processedData.map(item => pickProperties(item, pick));
    }
    if (omit) {
      processedData = processedData.map(item => omitProperties(item, omit));
    }
    if (rename) {
      processedData = processedData.map(item => renameProperties(item, rename));
    }
    if (flatten) {
      processedData = processedData.map(item => flattenObject(item));
    }
    if (map) {
      processedData = processedData.map(item => mapObject(item, map));
    }
    if (transformFn) {
      processedData = processedData.map(transformFn);
    }
  }

  // Шаг 3: Агрегация
  let result = {};
  if (options.aggregate) {
    const { keys, metrics, grouping } = options.aggregate;

    if (keys && keys.length > 0) {
      result = aggregateByKeys(processedData, keys, metrics || []);
    } else if (grouping) {
      result = aggregateByCategory(processedData, grouping, metrics || []);
    } else {
      result = calculateAggregates(processedData, metrics || ['count', 'sum', 'avg', 'min', 'max']);
    }
  } else {
    result = { items: processedData, count: processedData.length };
  }

  // Добавляем метаданные
  result._meta = {
    originalCount: data.length,
    filteredCount: processedData.length,
    timestamp: new Date().toISOString(),
  };

  return result;
}

/**
 * Быстрая группировка данных по ключу
 * @param {Array} data - Данные для группировки
 * @param {string|Function} groupKey - Ключ для группировки
 * @param {Object} options - Опции группировки
 * @returns {Object} - Сгруппированные данные
 */
function quickGroup(data, groupKey, options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return {};
  }

  const { aggregate = false, metrics = ['count'] } = options;

  let grouped;
  if (typeof groupKey === 'function') {
    grouped = groupByCustom(data, groupKey);
  } else {
    grouped = groupByKey(data, groupKey);
  }

  if (aggregate) {
    return aggregateGroups(grouped, metrics);
  }

  return grouped;
}

/**
 * Быстрая трансформация данных
 * @param {Array} data - Данные для трансформации
 * @param {Object} operations - Операции трансформации
 * @returns {Array} - Трансформированные данные
 */
function quickTransform(data, operations = {}) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array of data');
  }

  let result = [...data];

  if (operations.pick) {
    result = result.map(item => pickProperties(item, operations.pick));
  }

  if (operations.rename) {
    result = result.map(item => renameProperties(item, operations.rename));
  }

  if (operations.flatten) {
    result = result.map(item => flattenObject(item));
  }

  if (operations.map) {
    result = result.map(item => mapObject(item, operations.map));
  }

  return result;
}

/**
 * Быстрая фильтрация данных
 * @param {Array} data - Данные для фильтрации
 * @param {Object} criteria - Критерии фильтрации
 * @returns {Array} - Отфильтрованные данные
 */
function quickFilter(data, criteria = {}) {
  if (!Array.isArray(data)) {
    throw new TypeError('Expected an array of data');
  }

  let result = [...data];

  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'function') {
      result = filterByCustomPredicate(result, value);
    } else if (Array.isArray(value)) {
      result = filterByKeys(result, { [key]: value });
    } else {
      result = filterByKey(result, key, value);
    }
  }

  return result;
}

/**
 * Сравнение двух наборов данных
 * @param {Array} data1 - Первый набор данных
 * @param {Array} data2 - Второй набор данных
 * @param {string|Function} compareKey - Ключ для сравнения
 * @returns {Object} - Результат сравнения
 */
function compareDataSets(data1, data2, compareKey = 'id') {
  if (!Array.isArray(data1) || !Array.isArray(data2)) {
    throw new TypeError('Expected arrays');
  }

  const getKey = typeof compareKey === 'function' ? compareKey : item => item[compareKey];

  const keys1 = new Set(data1.map(getKey));
  const keys2 = new Set(data2.map(getKey));

  const onlyIn1 = data1.filter(item => !keys2.has(getKey(item)));
  const onlyIn2 = data2.filter(item => !keys1.has(getKey(item)));

  const common = data1.filter(item => keys2.has(getKey(item)));

  return {
    onlyInFirst: onlyIn1,
    onlyInSecond: onlyIn2,
    common,
    stats: {
      total1: data1.length,
      total2: data2.length,
      onlyIn1Count: onlyIn1.length,
      onlyIn2Count: onlyIn2.length,
      commonCount: common.length,
    },
  };
}

/**
 * Объединение нескольких наборов данных
 * @param {Array<Array>} dataSets - Массив наборов данных
 * @param {string|Function} joinKey - Ключ для объединения
 * @param {string} strategy - Стратегия объединения ('inner', 'left', 'outer')
 * @returns {Array} - Объединенный набор данных
 */
function joinDataSets(dataSets, joinKey = 'id', strategy = 'inner') {
  if (!Array.isArray(dataSets) || dataSets.length < 2) {
    throw new Error('At least 2 data sets are required');
  }

  const getKey = typeof joinKey === 'function' ? joinKey : item => item[joinKey];

  // Индексируем все наборы данных
  const indexedSets = dataSets.map(data => {
    const map = new Map();
    for (const item of data) {
      const key = getKey(item);
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return map;
  });

  const firstSet = indexedSets[0];
  const result = [];

  if (strategy === 'inner') {
    // INNER JOIN - только ключи, присутствующие во всех наборах
    for (const [key, item] of firstSet) {
      if (indexedSets.every(set => set.has(key))) {
        const joined = { ...item };
        for (let i = 1; i < indexedSets.length; i++) {
          const otherItem = indexedSets[i].get(key);
          if (otherItem) {
            Object.assign(joined, otherItem);
          }
        }
        result.push(joined);
      }
    }
  } else if (strategy === 'left') {
    // LEFT JOIN - все ключи из первого набора
    for (const [key, item] of firstSet) {
      const joined = { ...item };
      for (let i = 1; i < indexedSets.length; i++) {
        const otherItem = indexedSets[i].get(key);
        if (otherItem) {
          Object.assign(joined, otherItem);
        }
      }
      result.push(joined);
    }
  } else if (strategy === 'outer') {
    // OUTER JOIN - все ключи из всех наборов
    const allKeys = new Set();
    for (const set of indexedSets) {
      for (const key of set.keys()) {
        allKeys.add(key);
      }
    }

    for (const key of allKeys) {
      const joined = {};
      for (let i = 0; i < indexedSets.length; i++) {
        const item = indexedSets[i].get(key);
        if (item) {
          Object.assign(joined, item);
        }
      }
      result.push(joined);
    }
  }

  return result;
}

/**
 * Создает сводную таблицу из данных
 * @param {Array} data - Данные для сводки
 * @param {Object} config - Конфигурация сводки
 * @param {string|Array} config.rows - Ключи для строк
 * @param {string|Array} config.columns - Ключи для колонок
 * @param {string|Object} config.values - Ключи для значений
 * @param {string} config.aggregate - Функция агрегации ('sum', 'avg', 'count', 'min', 'max')
 * @returns {Object} - Сводная таблица
 */
function createPivotTable(data, config) {
  if (!Array.isArray(data) || data.length === 0) {
    return { rows: [], columns: [], data: [], totals: {} };
  }

  const { rows = [], columns = [], values = [], aggregate = 'sum' } = config;

  const rowKeys = Array.isArray(rows) ? rows : [rows];
  const colKeys = Array.isArray(columns) ? columns : [columns];
  const valueKeys = Array.isArray(values) ? values : [values];

  // Получаем уникальные значения для строк и колонок
  const rowValues = new Set();
  const colValues = new Set();

  for (const item of data) {
    const rowKey = rowKeys.map(key => item[key]).join('|');
    rowValues.add(rowKey);

    for (const key of colKeys) {
      const colKey = item[key];
      if (colKey !== undefined && colKey !== null) {
        colValues.add(String(colKey));
      }
    }
  }

  // Строим сводную таблицу
  const pivotData = {};
  const sortedRowValues = Array.from(rowValues).sort();
  const sortedColValues = Array.from(colValues).sort();

  for (const row of sortedRowValues) {
    pivotData[row] = {};
    for (const col of sortedColValues) {
      pivotData[row][col] = {};
      for (const valueKey of valueKeys) {
        const filtered = data.filter(item => {
          const rowMatch = rowKeys.map(key => item[key]).join('|') === row;
          const colMatch = colKeys.some(key => String(item[key]) === col);
          return rowMatch && colMatch;
        });

        const values = filtered
          .map(item => item[valueKey])
          .filter(v => v !== undefined && v !== null);
        pivotData[row][col][valueKey] = calculateAggregate(values, aggregate);
      }
    }
  }

  // Вычисляем итоги
  const totals = {};
  for (const col of sortedColValues) {
    totals[col] = {};
    for (const valueKey of valueKeys) {
      const allValues = data
        .filter(item => colKeys.some(key => String(item[key]) === col))
        .map(item => item[valueKey])
        .filter(v => v !== undefined && v !== null);
      totals[col][valueKey] = calculateAggregate(allValues, aggregate);
    }
  }

  return {
    rows: sortedRowValues,
    columns: sortedColValues,
    data: pivotData,
    totals,
    valueKeys,
  };
}

/**
 * Вспомогательная функция для вычисления агрегации
 * @private
 * @param {Array} values - Массив значений
 * @param {string} aggregate - Тип агрегации
 * @returns {number|null} - Результат агрегации
 */
function calculateAggregate(values, aggregate) {
  if (values.length === 0) return null;

  switch (aggregate) {
    case 'sum':
      return values.reduce((acc, v) => acc + v, 0);
    case 'avg':
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    default:
      return values.reduce((acc, v) => acc + v, 0);
  }
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт функций фильтрации
export {
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
};

// Реэкспорт функций группировки
export {
  groupByCategory,
  groupByKey,
  groupByDate,
  groupByRange,
  groupByMultipleKeys,
  groupByCustom,
  aggregateGroups,
  getGroupStats,
  GroupAggregator,
};

// Реэкспорт функций трансформации
export {
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
};

// Реэкспорт агрегаторов
export {
  aggregateData,
  aggregateByKeys,
  aggregateByDate,
  aggregateByCategory,
  calculateAggregates,
  Aggregator,
  aggregateSum,
  aggregateAverage,
  aggregateMin,
  aggregateMax,
  aggregateCount,
  aggregateFirst,
  aggregateLast,
};

// Реэкспорт основных функций
export {
  processDataPipeline,
  quickGroup,
  quickTransform,
  quickFilter,
  compareDataSets,
  joinDataSets,
  createPivotTable,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями обработки данных
 */
export default {
  // Фильтрация
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

  // Группировка
  groupByCategory,
  groupByKey,
  groupByDate,
  groupByRange,
  groupByMultipleKeys,
  groupByCustom,
  aggregateGroups,
  getGroupStats,
  GroupAggregator,

  // Трансформация
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

  // Агрегация
  aggregateData,
  aggregateByKeys,
  aggregateByDate,
  aggregateByCategory,
  calculateAggregates,
  Aggregator,
  aggregateSum,
  aggregateAverage,
  aggregateMin,
  aggregateMax,
  aggregateCount,
  aggregateFirst,
  aggregateLast,

  // Основные функции
  processDataPipeline,
  quickGroup,
  quickTransform,
  quickFilter,
  compareDataSets,
  joinDataSets,
  createPivotTable,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Функции фильтрации вынесены в modules/filter.js:
 *    - filterActiveItems - фильтрация по активности
 *    - filterByCategory - фильтрация по категории
 *    - filterByPriceRange - фильтрация по цене
 *    - filterByDateRange - фильтрация по дате
 *    - filterByCustomPredicate - пользовательская фильтрация
 *    - filterUnique - удаление дубликатов
 *    - filterFalsy - удаление falsy значений
 *    - filterTruthy - сохранение truthy значений
 *    - filterByKey - фильтрация по ключу
 *    - filterByKeys - фильтрация по нескольким ключам
 *
 * 2. Функции группировки вынесены в modules/group.js:
 *    - groupByCategory - группировка по категории
 *    - groupByKey - группировка по ключу
 *    - groupByDate - группировка по дате
 *    - groupByRange - группировка по диапазону
 *    - groupByMultipleKeys - группировка по нескольким ключам
 *    - groupByCustom - пользовательская группировка
 *    - aggregateGroups - агрегация групп
 *    - getGroupStats - статистика групп
 *    - GroupAggregator - класс для агрегации групп
 *
 * 3. Функции трансформации вынесены в modules/transform.js:
 *    - transformItems - трансформация элементов
 *    - transformKeys - трансформация ключей
 *    - transformValues - трансформация значений
 *    - transformNested - трансформация вложенных данных
 *    - mapObject - маппинг объекта
 *    - pickProperties - выбор свойств
 *    - omitProperties - исключение свойств
 *    - renameProperties - переименование свойств
 *    - flattenObject - разворачивание объекта
 *    - unflattenObject - сворачивание объекта
 *    - deepClone - глубокое копирование
 *    - deepMerge - глубокое слияние
 *
 * 4. Агрегаторы вынесены в modules/aggregate.js:
 *    - aggregateData - агрегация данных
 *    - aggregateByKeys - агрегация по ключам
 *    - aggregateByDate - агрегация по дате
 *    - aggregateByCategory - агрегация по категории
 *    - calculateAggregates - вычисление агрегатов
 *    - Aggregator - класс агрегатора
 *    - aggregateSum, aggregateAverage и др. - функции агрегации
 *
 * 5. Основные функции остаются в index.js:
 *    - processDataPipeline - полный пайплайн обработки
 *    - quickGroup - быстрая группировка
 *    - quickTransform - быстрая трансформация
 *    - quickFilter - быстрая фильтрация
 *    - compareDataSets - сравнение наборов данных
 *    - joinDataSets - объединение наборов данных
 *    - createPivotTable - создание сводной таблицы
 *
 * 6. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 7. Добавлены JSDoc комментарии для всех функций
 *
 * 8. Сохранена обратная совместимость через реэкспорты
 */
