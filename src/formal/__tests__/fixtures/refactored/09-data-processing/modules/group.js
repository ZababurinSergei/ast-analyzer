// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/09-data-processing/modules/group.js

// ============================================
// МОДУЛЬ ГРУППИРОВКИ ДАННЫХ
// ============================================
// Этот модуль содержит функции для группировки данных
// по различным критериям и последующей агрегации групп.

/**
 * Группирует данные по категории
 * @param {Array} items - Массив элементов для группировки
 * @param {string} categoryKey - Ключ категории
 * @returns {Object} - Объект с группами по категориям
 */
function groupByCategory(items, categoryKey = 'category') {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array of items');
  }

  const groups = {};
  for (const item of items) {
    const category = item[categoryKey] || 'uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  }
  return groups;
}

/**
 * Группирует данные по ключу
 * @param {Array} items - Массив элементов для группировки
 * @param {string|Function} key - Ключ или функция для группировки
 * @returns {Object} - Объект с группами
 */
function groupByKey(items, key) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array of items');
  }

  const groups = {};
  const getKey = typeof key === 'function' ? key : item => item[key];

  for (const item of items) {
    const groupKey = getKey(item);
    const keyStr = groupKey !== undefined && groupKey !== null ? String(groupKey) : 'undefined';
    if (!groups[keyStr]) {
      groups[keyStr] = [];
    }
    groups[keyStr].push(item);
  }

  return groups;
}

/**
 * Группирует данные по дате (день, месяц, год)
 * @param {Array} items - Массив элементов для группировки
 * @param {string} dateKey - Ключ даты
 * @param {string} unit - Единица группировки ('day', 'month', 'year', 'hour')
 * @returns {Object} - Объект с группами по датам
 */
function groupByDate(items, dateKey = 'date', unit = 'day') {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array of items');
  }

  const groups = {};
  const unitMap = {
    year: d => d.getFullYear(),
    month: d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    day: d =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    hour: d =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`,
  };

  const getUnit = unitMap[unit] || unitMap['day'];

  for (const item of items) {
    let dateValue = item[dateKey];
    if (typeof dateValue === 'string') {
      dateValue = new Date(dateValue);
    }
    if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) {
      continue;
    }
    const key = getUnit(dateValue);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  return groups;
}

/**
 * Группирует данные по диапазону значений
 * @param {Array} items - Массив элементов для группировки
 * @param {string} valueKey - Ключ значения
 * @param {Array} ranges - Массив диапазонов [{min, max, label}]
 * @returns {Object} - Объект с группами по диапазонам
 */
function groupByRange(items, valueKey = 'value', ranges = []) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array of items');
  }

  if (ranges.length === 0) {
    // Автоматическое создание диапазонов
    const values = items.map(item => item[valueKey]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) {
      return {};
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const rangeCount = 5;
    const step = (max - min) / rangeCount;

    for (let i = 0; i < rangeCount; i++) {
      ranges.push({
        min: min + i * step,
        max: min + (i + 1) * step,
        label: `${(min + i * step).toFixed(1)} - ${(min + (i + 1) * step).toFixed(1)}`,
      });
    }
  }

  const groups = {};
  for (const range of ranges) {
    const { min, max, label } = range;
    groups[label] = items.filter(item => {
      const value = item[valueKey];
      if (value === undefined || value === null) return false;
      return value >= min && value < max;
    });
  }

  // Добавляем группу для значений вне диапазонов
  const outside = items.filter(item => {
    const value = item[valueKey];
    if (value === undefined || value === null) return true;
    return !ranges.some(r => value >= r.min && value < r.max);
  });
  if (outside.length > 0) {
    groups['outside'] = outside;
  }

  return groups;
}

/**
 * Группирует данные по нескольким ключам
 * @param {Array} items - Массив элементов для группировки
 * @param {Array<string>} keys - Массив ключей для группировки
 * @returns {Object} - Вложенный объект с группами
 */
function groupByMultipleKeys(items, keys) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array of items');
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('At least one key is required');
  }

  if (keys.length === 1) {
    return groupByKey(items, keys[0]);
  }

  const [firstKey, ...remainingKeys] = keys;
  const grouped = groupByKey(items, firstKey);
  const result = {};

  for (const [key, groupItems] of Object.entries(grouped)) {
    result[key] = groupByMultipleKeys(groupItems, remainingKeys);
  }

  return result;
}

/**
 * Группирует данные с пользовательской функцией
 * @param {Array} items - Массив элементов для группировки
 * @param {Function} groupFn - Функция для определения группы
 * @returns {Object} - Объект с группами
 */
function groupByCustom(items, groupFn) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array of items');
  }
  if (typeof groupFn !== 'function') {
    throw new TypeError('groupFn must be a function');
  }

  const groups = {};
  for (const item of items) {
    const key = groupFn(item);
    const keyStr = key !== undefined && key !== null ? String(key) : 'undefined';
    if (!groups[keyStr]) {
      groups[keyStr] = [];
    }
    groups[keyStr].push(item);
  }
  return groups;
}

/**
 * Агрегирует группы с вычислением метрик
 * @param {Object} groups - Объект с группами
 * @param {Array<string|Object>} metrics - Метрики для вычисления
 * @returns {Object} - Объект с агрегированными группами
 */
function aggregateGroups(groups, metrics = ['count']) {
  if (typeof groups !== 'object' || groups === null) {
    throw new TypeError('Expected an object of groups');
  }

  const result = {};
  const metricFunctions = {
    count: items => items.length,
    sum: (items, key) => items.reduce((acc, item) => acc + (item[key] || 0), 0),
    avg: (items, key) => {
      const sum = items.reduce((acc, item) => acc + (item[key] || 0), 0);
      return items.length > 0 ? sum / items.length : 0;
    },
    min: (items, key) => {
      const values = items.map(item => item[key]).filter(v => v !== undefined && v !== null);
      return values.length > 0 ? Math.min(...values) : null;
    },
    max: (items, key) => {
      const values = items.map(item => item[key]).filter(v => v !== undefined && v !== null);
      return values.length > 0 ? Math.max(...values) : null;
    },
    first: items => items[0] || null,
    last: items => items[items.length - 1] || null,
  };

  for (const [groupKey, groupItems] of Object.entries(groups)) {
    result[groupKey] = { items: groupItems };

    for (const metric of metrics) {
      if (typeof metric === 'string') {
        const fn = metricFunctions[metric];
        if (fn) {
          result[groupKey][metric] = fn(groupItems);
        }
      } else if (typeof metric === 'object') {
        const { name, key, fn } = metric;
        if (fn) {
          result[groupKey][name] = fn(groupItems);
        } else if (key) {
          const defaultFn = metricFunctions[name];
          if (defaultFn) {
            result[groupKey][name] = defaultFn(groupItems, key);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Получает статистику по группам
 * @param {Object} groups - Объект с группами
 * @param {Array<string>} keys - Ключи для статистики
 * @returns {Object} - Статистика групп
 */
function getGroupStats(groups, keys = []) {
  if (typeof groups !== 'object' || groups === null) {
    throw new TypeError('Expected an object of groups');
  }

  const stats = {
    totalGroups: Object.keys(groups).length,
    totalItems: 0,
    groupSizes: {},
    minSize: Infinity,
    maxSize: 0,
    avgSize: 0,
    distribution: {},
    keyStats: {},
  };

  const sizes = [];
  for (const [groupKey, groupItems] of Object.entries(groups)) {
    const size = groupItems.length;
    sizes.push(size);
    stats.totalItems += size;
    stats.groupSizes[groupKey] = size;
    stats.distribution[size] = (stats.distribution[size] || 0) + 1;

    if (size < stats.minSize) stats.minSize = size;
    if (size > stats.maxSize) stats.maxSize = size;

    // Статистика по ключам
    for (const key of keys) {
      if (!stats.keyStats[key]) {
        stats.keyStats[key] = { values: {}, count: 0 };
      }
      for (const item of groupItems) {
        const value = item[key];
        if (value !== undefined && value !== null) {
          const valueStr = String(value);
          stats.keyStats[key].values[valueStr] = (stats.keyStats[key].values[valueStr] || 0) + 1;
          stats.keyStats[key].count++;
        }
      }
    }
  }

  stats.avgSize = sizes.length > 0 ? stats.totalItems / sizes.length : 0;

  // Вычисляем медианный размер
  const sortedSizes = [...sizes].sort((a, b) => a - b);
  const mid = Math.floor(sortedSizes.length / 2);
  stats.medianSize =
    sortedSizes.length > 0
      ? sortedSizes.length % 2 === 0
        ? (sortedSizes[mid - 1] + sortedSizes[mid]) / 2
        : sortedSizes[mid]
      : 0;

  return stats;
}

/**
 * Класс для агрегации групп с поддержкой различных операций
 */
class GroupAggregator {
  /**
   * Создает экземпляр GroupAggregator
   * @param {Object} options - Опции агрегатора
   */
  constructor(options = {}) {
    this._options = {
      groupKey: 'category',
      valueKey: 'value',
      operations: ['count', 'sum', 'avg', 'min', 'max'],
      ...options,
    };
    this._groups = {};
    this._results = null;
  }

  /**
   * Добавляет данные для агрегации
   * @param {Array} data - Данные для агрегации
   * @returns {GroupAggregator} - Ссылка на себя
   */
  addData(data) {
    if (!Array.isArray(data)) {
      throw new TypeError('Expected an array of data');
    }

    const { groupKey, valueKey } = this._options;

    for (const item of data) {
      const group = item[groupKey] || 'uncategorized';
      if (!this._groups[group]) {
        this._groups[group] = [];
      }
      this._groups[group].push(item[valueKey]);
    }

    this._results = null;
    return this;
  }

  /**
   * Выполняет агрегацию
   * @param {Array<string>} operations - Операции для выполнения
   * @returns {Object} - Результаты агрегации
   */
  aggregate(operations = null) {
    if (this._results !== null) {
      return this._results;
    }

    const ops = operations || this._options.operations;
    this._results = {};

    for (const [group, values] of Object.entries(this._groups)) {
      if (values.length === 0) continue;

      this._results[group] = {};

      for (const op of ops) {
        switch (op) {
          case 'count':
            this._results[group].count = values.length;
            break;
          case 'sum':
            this._results[group].sum = values.reduce((acc, v) => acc + v, 0);
            break;
          case 'avg':
            this._results[group].avg = values.reduce((acc, v) => acc + v, 0) / values.length;
            break;
          case 'min':
            this._results[group].min = Math.min(...values);
            break;
          case 'max':
            this._results[group].max = Math.max(...values);
            break;
          case 'median':
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            this._results[group].median =
              sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
            break;
          case 'std':
            const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
            const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
            this._results[group].std = Math.sqrt(variance);
            break;
          case 'first':
            this._results[group].first = values[0];
            break;
          case 'last':
            this._results[group].last = values[values.length - 1];
            break;
          default:
            if (typeof op === 'function') {
              this._results[group][op.name || 'custom'] = op(values);
            }
        }
      }
    }

    return this._results;
  }

  /**
   * Очищает данные и результаты
   * @returns {GroupAggregator} - Ссылка на себя
   */
  clear() {
    this._groups = {};
    this._results = null;
    return this;
  }

  /**
   * Получает статистику по группам
   * @returns {Object} - Статистика
   */
  getStats() {
    const stats = {
      totalGroups: Object.keys(this._groups).length,
      totalItems: 0,
      groupSizes: {},
    };

    for (const [group, values] of Object.entries(this._groups)) {
      stats.totalItems += values.length;
      stats.groupSizes[group] = values.length;
    }

    return stats;
  }

  /**
   * Получает результаты в виде массива
   * @param {string} format - Формат вывода ('array', 'object')
   * @returns {Array|Object} - Результаты
   */
  toArray(format = 'array') {
    this.aggregate();
    if (!this._results) return [];

    if (format === 'array') {
      return Object.entries(this._results).map(([group, metrics]) => ({
        group,
        ...metrics,
      }));
    }

    return this._results;
  }

  /**
   * Сериализует результаты в JSON
   * @returns {string} - JSON-строка
   */
  toJSON() {
    this.aggregate();
    return JSON.stringify(this._results);
  }

  /**
   * Создает агрегатор из JSON
   * @param {string} json - JSON-строка
   * @param {Object} options - Опции агрегатора
   * @returns {GroupAggregator} - Новый экземпляр
   */
  static fromJSON(json, options = {}) {
    try {
      const data = JSON.parse(json);
      const aggregator = new GroupAggregator(options);
      aggregator._groups = data;
      return aggregator;
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные функции группировки
  groupByCategory,
  groupByKey,
  groupByDate,
  groupByRange,
  groupByMultipleKeys,
  groupByCustom,

  // Агрегация групп
  aggregateGroups,
  getGroupStats,
  GroupAggregator,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
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

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ГРУППИРОВКИ ДАННЫХ
 *
 * Этот модуль предоставляет 9 функций и 1 класс для группировки данных:
 *
 * 1. groupByCategory      - Группировка по категории
 * 2. groupByKey           - Группировка по ключу
 * 3. groupByDate          - Группировка по дате (день, месяц, год, час)
 * 4. groupByRange         - Группировка по диапазону значений
 * 5. groupByMultipleKeys  - Группировка по нескольким ключам
 * 6. groupByCustom        - Пользовательская группировка
 * 7. aggregateGroups      - Агрегация групп с вычислением метрик
 * 8. getGroupStats        - Статистика по группам
 * 9. GroupAggregator      - Класс для агрегации групп
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные типы группировки
 * - Автоматическое создание диапазонов
 * - Поддержка пользовательских функций группировки
 * - Агрегация с множеством метрик (count, sum, avg, min, max, median, std, first, last)
 * - Цепочки вызовов в классе
 * - Сериализация и десериализация
 * - Статистика по группам
 */
