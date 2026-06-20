// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/10-mixed-operations/modules/array.js

// ============================================
// МОДУЛЬ ОПЕРАЦИЙ С МАССИВАМИ
// ============================================
// Этот модуль содержит функции для работы с массивами,
// включая операции поиска, преобразования и агрегации.

/**
 * Вычисляет сумму элементов массива
 * @param {Array} arr - Массив чисел
 * @returns {number} - Сумма элементов
 * @throws {TypeError} - Если arr не является массивом
 */
function sumArray(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  return arr.reduce((acc, val) => acc + val, 0);
}

/**
 * Вычисляет сумму элементов массива с использованием цикла
 * @param {Array} arr - Массив чисел
 * @returns {number} - Сумма элементов
 */
function sumArrayLoop(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}

/**
 * Вычисляет среднее арифметическое элементов массива
 * @param {Array} arr - Массив чисел
 * @returns {number} - Среднее значение
 */
function averageArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0;
  }
  return sumArray(arr) / arr.length;
}

/**
 * Находит максимальный элемент в массиве
 * @param {Array} arr - Массив чисел
 * @returns {number} - Максимальный элемент
 */
function maxArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return undefined;
  }
  return Math.max(...arr);
}

/**
 * Находит минимальный элемент в массиве
 * @param {Array} arr - Массив чисел
 * @returns {number} - Минимальный элемент
 */
function minArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return undefined;
  }
  return Math.min(...arr);
}

/**
 * Вычисляет диапазон значений в массиве
 * @param {Array} arr - Массив чисел
 * @returns {number} - Разница между максимумом и минимумом
 */
function rangeArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0;
  }
  return maxArray(arr) - minArray(arr);
}

/**
 * Вычисляет медиану массива
 * @param {Array} arr - Массив чисел
 * @returns {number} - Медиана
 */
function medianArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0;
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Вычисляет дисперсию массива
 * @param {Array} arr - Массив чисел
 * @param {boolean} sample - Является ли выборкой
 * @returns {number} - Дисперсия
 */
function varianceArray(arr, sample = false) {
  if (!Array.isArray(arr) || arr.length < 2) {
    return 0;
  }
  const mean = averageArray(arr);
  const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
  const sumSquaredDiffs = sumArray(squaredDiffs);
  const divisor = sample ? arr.length - 1 : arr.length;
  return sumSquaredDiffs / divisor;
}

/**
 * Вычисляет стандартное отклонение массива
 * @param {Array} arr - Массив чисел
 * @param {boolean} sample - Является ли выборкой
 * @returns {number} - Стандартное отклонение
 */
function stdDevArray(arr, sample = false) {
  if (!Array.isArray(arr) || arr.length < 2) {
    return 0;
  }
  return Math.sqrt(varianceArray(arr, sample));
}

/**
 * Удаляет дубликаты из массива
 * @param {Array} arr - Массив
 * @param {string|Function} key - Ключ для сравнения (опционально)
 * @returns {Array} - Массив без дубликатов
 */
function uniqueArray(arr, key = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (key === null) {
    return [...new Set(arr)];
  }

  const getKey = typeof key === 'function' ? key : item => item[key];
  const seen = new Set();
  const result = [];

  for (const item of arr) {
    const keyValue = getKey(item);
    if (!seen.has(keyValue)) {
      seen.add(keyValue);
      result.push(item);
    }
  }

  return result;
}

/**
 * Разбивает массив на чанки указанного размера
 * @param {Array} arr - Массив
 * @param {number} size - Размер чанка
 * @returns {Array} - Массив чанков
 */
function chunkArray(arr, size) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (size <= 0) {
    throw new Error('Chunk size must be positive');
  }

  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Перемешивает массив (алгоритм Фишера-Йетса)
 * @param {Array} arr - Массив
 * @param {boolean} inPlace - Изменять ли оригинальный массив
 * @returns {Array} - Перемешанный массив
 */
function shuffleArray(arr, inPlace = false) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = inPlace ? arr : [...arr];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Группирует массив по ключу
 * @param {Array} arr - Массив
 * @param {string|Function} key - Ключ для группировки
 * @returns {Object} - Объект с группами
 */
function groupArray(arr, key) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof key === 'function' ? key : item => item[key];
  const groups = {};

  for (const item of arr) {
    const keyValue = getKey(item);
    if (!groups[keyValue]) {
      groups[keyValue] = [];
    }
    groups[keyValue].push(item);
  }

  return groups;
}

/**
 * Индексирует массив по ключу
 * @param {Array} arr - Массив
 * @param {string|Function} key - Ключ для индексации
 * @returns {Object} - Объект с индексами
 */
function indexArray(arr, key) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof key === 'function' ? key : item => item[key];
  const index = {};

  for (const item of arr) {
    const keyValue = getKey(item);
    index[keyValue] = item;
  }

  return index;
}

/**
 * Находит пересечение двух массивов
 * @param {Array} arr1 - Первый массив
 * @param {Array} arr2 - Второй массив
 * @param {string|Function} key - Ключ для сравнения
 * @returns {Array} - Пересечение массивов
 */
function intersectArrays(arr1, arr2, key = null) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    throw new TypeError('Expected arrays');
  }

  if (key === null) {
    const set1 = new Set(arr1);
    return arr2.filter(item => set1.has(item));
  }

  const getKey = typeof key === 'function' ? key : item => item[key];
  const set1 = new Set(arr1.map(getKey));

  return arr2.filter(item => set1.has(getKey(item)));
}

/**
 * Находит разность двух массивов
 * @param {Array} arr1 - Первый массив
 * @param {Array} arr2 - Второй массив
 * @param {string|Function} key - Ключ для сравнения
 * @returns {Array} - Разность массивов
 */
function diffArrays(arr1, arr2, key = null) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    throw new TypeError('Expected arrays');
  }

  if (key === null) {
    const set2 = new Set(arr2);
    return arr1.filter(item => !set2.has(item));
  }

  const getKey = typeof key === 'function' ? key : item => item[key];
  const set2 = new Set(arr2.map(getKey));

  return arr1.filter(item => !set2.has(getKey(item)));
}

/**
 * Объединяет несколько массивов без дубликатов
 * @param {Array} arrs - Массив массивов
 * @param {string|Function} key - Ключ для сравнения
 * @returns {Array} - Объединенный массив
 */
function unionArrays(arrs, key = null) {
  if (!Array.isArray(arrs) || arrs.length === 0) {
    return [];
  }

  const allItems = arrs.flat();

  if (key === null) {
    return [...new Set(allItems)];
  }

  const getKey = typeof key === 'function' ? key : item => item[key];
  const seen = new Set();
  const result = [];

  for (const item of allItems) {
    const keyValue = getKey(item);
    if (!seen.has(keyValue)) {
      seen.add(keyValue);
      result.push(item);
    }
  }

  return result;
}

/**
 * Сортирует массив объектов по ключу
 * @param {Array} arr - Массив объектов
 * @param {string|Array} keys - Ключи для сортировки
 * @param {Array} orders - Порядок сортировки ('asc' или 'desc')
 * @returns {Array} - Отсортированный массив
 */
function sortByKeys(arr, keys, orders = []) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const keyArray = Array.isArray(keys) ? keys : [keys];
  const orderArray = Array.isArray(orders) ? orders : [orders[0] || 'asc'];

  return [...arr].sort((a, b) => {
    for (let i = 0; i < keyArray.length; i++) {
      const key = keyArray[i];
      const order = orderArray[i] || orderArray[0] || 'asc';
      const aVal = a[key];
      const bVal = b[key];

      if (aVal === bVal) continue;

      const comparison = aVal < bVal ? -1 : 1;
      return order === 'asc' ? comparison : -comparison;
    }
    return 0;
  });
}

/**
 * Фильтрует массив по нескольким условиям
 * @param {Array} arr - Массив
 * @param {Object} filters - Объект с условиями
 * @param {Object} options - Опции фильтрации
 * @returns {Array} - Отфильтрованный массив
 */
function filterByConditions(arr, filters = {}, options = {}) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const { mode = 'and', caseSensitive = true } = options;

  return arr.filter(item => {
    const results = Object.entries(filters).map(([key, condition]) => {
      const value = item[key];

      if (typeof condition === 'function') {
        return condition(value, item);
      }

      if (typeof condition === 'object' && condition !== null) {
        const { eq, ne, gt, gte, lt, lte, contains, startsWith, endsWith, in: inArray } = condition;

        if (eq !== undefined) return value === eq;
        if (ne !== undefined) return value !== ne;
        if (gt !== undefined) return value > gt;
        if (gte !== undefined) return value >= gte;
        if (lt !== undefined) return value < lt;
        if (lte !== undefined) return value <= lte;

        if (contains !== undefined) {
          const strValue = String(value);
          const strContains = String(contains);
          return caseSensitive
            ? strValue.includes(strContains)
            : strValue.toLowerCase().includes(strContains.toLowerCase());
        }

        if (startsWith !== undefined) {
          const strValue = String(value);
          const strStartsWith = String(startsWith);
          return caseSensitive
            ? strValue.startsWith(strStartsWith)
            : strValue.toLowerCase().startsWith(strStartsWith.toLowerCase());
        }

        if (endsWith !== undefined) {
          const strValue = String(value);
          const strEndsWith = String(endsWith);
          return caseSensitive
            ? strValue.endsWith(strEndsWith)
            : strValue.toLowerCase().endsWith(strEndsWith.toLowerCase());
        }

        if (inArray !== undefined) {
          return Array.isArray(inArray) && inArray.includes(value);
        }
      }

      return value === condition;
    });

    return mode === 'and' ? results.every(Boolean) : results.some(Boolean);
  });
}

/**
 * Преобразует массив в объект с ключами
 * @param {Array} arr - Массив
 * @param {string} keyKey - Ключ для значения ключа
 * @param {string} valueKey - Ключ для значения
 * @returns {Object} - Объект
 */
function arrayToObject(arr, keyKey, valueKey = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = {};

  for (const item of arr) {
    const key = item[keyKey];
    if (key === undefined) continue;

    if (valueKey === null) {
      result[key] = item;
    } else {
      result[key] = item[valueKey];
    }
  }

  return result;
}

/**
 * Преобразует массив в Map с ключами
 * @param {Array} arr - Массив
 * @param {string|Function} key - Ключ для Map
 * @param {string|Function} value - Значение для Map (опционально)
 * @returns {Map} - Map с ключами
 */
function arrayToMap(arr, key, value = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof key === 'function' ? key : item => item[key];
  const getValue =
    value === null ? null : typeof value === 'function' ? value : item => item[value];

  const map = new Map();

  for (const item of arr) {
    const keyValue = getKey(item);
    const valueValue = getValue === null ? item : getValue(item);
    map.set(keyValue, valueValue);
  }

  return map;
}

/**
 * Разворачивает массив вложенных массивов на один уровень
 * @param {Array} arr - Массив
 * @param {number} depth - Глубина разворачивания
 * @returns {Array} - Развернутый массив
 */
function flattenArray(arr, depth = 1) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (depth === 0) {
    return arr;
  }

  const result = [];
  for (const item of arr) {
    if (Array.isArray(item) && depth > 0) {
      result.push(...flattenArray(item, depth - 1));
    } else {
      result.push(item);
    }
  }

  return result;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые операции
  sumArray,
  sumArrayLoop,
  averageArray,
  maxArray,
  minArray,
  rangeArray,
  medianArray,
  varianceArray,
  stdDevArray,

  // Обработка массива
  uniqueArray,
  chunkArray,
  shuffleArray,
  groupArray,
  indexArray,
  intersectArrays,
  diffArrays,
  unionArrays,
  sortByKeys,
  filterByConditions,

  // Преобразование
  arrayToObject,
  arrayToMap,
  flattenArray,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями для работы с массивами
 */
export default {
  sumArray,
  sumArrayLoop,
  averageArray,
  maxArray,
  minArray,
  rangeArray,
  medianArray,
  varianceArray,
  stdDevArray,
  uniqueArray,
  chunkArray,
  shuffleArray,
  groupArray,
  indexArray,
  intersectArrays,
  diffArrays,
  unionArrays,
  sortByKeys,
  filterByConditions,
  arrayToObject,
  arrayToMap,
  flattenArray,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ОПЕРАЦИЙ С МАССИВАМИ
 *
 * Этот модуль предоставляет 22 функции для работы с массивами:
 *
 * 1. sumArray         - Сумма элементов (reduce)
 * 2. sumArrayLoop     - Сумма элементов (цикл)
 * 3. averageArray     - Среднее арифметическое
 * 4. maxArray         - Максимальный элемент
 * 5. minArray         - Минимальный элемент
 * 6. rangeArray       - Диапазон значений
 * 7. medianArray      - Медиана
 * 8. varianceArray    - Дисперсия
 * 9. stdDevArray      - Стандартное отклонение
 * 10. uniqueArray     - Удаление дубликатов
 * 11. chunkArray      - Разбивка на чанки
 * 12. shuffleArray    - Перемешивание
 * 13. groupArray      - Группировка по ключу
 * 14. indexArray      - Индексация по ключу
 * 15. intersectArrays - Пересечение массивов
 * 16. diffArrays      - Разность массивов
 * 17. unionArrays     - Объединение массивов
 * 18. sortByKeys      - Сортировка по ключам
 * 19. filterByConditions - Фильтрация по условиям
 * 20. arrayToObject   - Преобразование в объект
 * 21. arrayToMap      - Преобразование в Map
 * 22. flattenArray    - Разворачивание вложенных массивов
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают пользовательские функции сравнения
 * - Обрабатывают граничные случаи (пустые массивы, null, undefined)
 * - Имеют JSDoc с описанием параметров и возвращаемых значений
 */
