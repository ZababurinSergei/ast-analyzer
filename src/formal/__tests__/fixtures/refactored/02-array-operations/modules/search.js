// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/02-array-operations/modules/search.js

// ============================================
// МОДУЛЬ ПОИСКА В МАССИВАХ
// ============================================
// Этот модуль содержит все функции для поиска в массивах

/**
 * Линейный поиск элемента в массиве
 * @param {Array} arr - Массив для поиска
 * @param {*} target - Искомый элемент
 * @returns {number} - Индекс найденного элемента или -1
 */
function linearSearch(arr, target) {
  if (!arr || arr.length === 0) {
    return -1;
  }

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) {
      return i;
    }
  }
  return -1;
}

/**
 * Бинарный поиск элемента в отсортированном массиве
 * @param {Array} arr - Отсортированный массив
 * @param {*} target - Искомый элемент
 * @param {number} left - Левая граница поиска
 * @param {number} right - Правая граница поиска
 * @returns {number} - Индекс найденного элемента или -1
 */
function binarySearch(arr, target, left = 0, right = arr.length - 1) {
  if (!arr || arr.length === 0) {
    return -1;
  }

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midValue = arr[mid];

    if (midValue === target) {
      return mid;
    }

    if (midValue < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

/**
 * Рекурсивный бинарный поиск элемента в отсортированном массиве
 * @param {Array} arr - Отсортированный массив
 * @param {*} target - Искомый элемент
 * @param {number} left - Левая граница поиска
 * @param {number} right - Правая граница поиска
 * @returns {number} - Индекс найденного элемента или -1
 */
function binarySearchRecursive(arr, target, left = 0, right = arr.length - 1) {
  if (!arr || arr.length === 0 || left > right) {
    return -1;
  }

  const mid = Math.floor((left + right) / 2);
  const midValue = arr[mid];

  if (midValue === target) {
    return mid;
  }

  if (midValue < target) {
    return binarySearchRecursive(arr, target, mid + 1, right);
  }

  return binarySearchRecursive(arr, target, left, mid - 1);
}

/**
 * Поиск первого вхождения элемента с использованием кастомного компаратора
 * @param {Array} arr - Массив для поиска
 * @param {*} target - Искомый элемент
 * @param {Function} comparator - Функция сравнения
 * @returns {number} - Индекс найденного элемента или -1
 */
function binarySearchWithComparator(arr, target, comparator) {
  if (!arr || arr.length === 0) {
    return -1;
  }

  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const comparison = comparator(arr[mid], target);

    if (comparison === 0) {
      return mid;
    }

    if (comparison < 0) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

/**
 * Поиск первого элемента, удовлетворяющего условию
 * @param {Array} arr - Массив для поиска
 * @param {Function} predicate - Условие для проверки
 * @returns {*} - Найденный элемент или undefined
 */
function findFirst(arr, predicate) {
  if (!arr || arr.length === 0) {
    return undefined;
  }

  for (const item of arr) {
    if (predicate(item)) {
      return item;
    }
  }

  return undefined;
}

/**
 * Поиск индекса первого элемента, удовлетворяющего условию
 * @param {Array} arr - Массив для поиска
 * @param {Function} predicate - Условие для проверки
 * @returns {number} - Индекс найденного элемента или -1
 */
function findIndex(arr, predicate) {
  if (!arr || arr.length === 0) {
    return -1;
  }

  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) {
      return i;
    }
  }

  return -1;
}

/**
 * Поиск всех элементов, удовлетворяющих условию
 * @param {Array} arr - Массив для поиска
 * @param {Function} predicate - Условие для проверки
 * @returns {Array} - Массив найденных элементов
 */
function findAll(arr, predicate) {
  if (!arr || arr.length === 0) {
    return [];
  }

  const results = [];
  for (const item of arr) {
    if (predicate(item)) {
      results.push(item);
    }
  }

  return results;
}

/**
 * Поиск всех индексов элементов, удовлетворяющих условию
 * @param {Array} arr - Массив для поиска
 * @param {Function} predicate - Условие для проверки
 * @returns {number[]} - Массив индексов найденных элементов
 */
function findAllIndices(arr, predicate) {
  if (!arr || arr.length === 0) {
    return [];
  }

  const indices = [];
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) {
      indices.push(i);
    }
  }

  return indices;
}

/**
 * Поиск ближайшего элемента к целевому значению в отсортированном массиве
 * @param {number[]} arr - Отсортированный массив чисел
 * @param {number} target - Целевое число
 * @returns {number} - Ближайший элемент
 */
function findClosest(arr, target) {
  if (!arr || arr.length === 0) {
    return undefined;
  }

  if (arr.length === 1) {
    return arr[0];
  }

  let left = 0;
  let right = arr.length - 1;

  while (left < right - 1) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) {
      return arr[mid];
    }
    if (arr[mid] < target) {
      left = mid;
    } else {
      right = mid;
    }
  }

  // Выбираем ближайший из двух
  const leftDiff = Math.abs(arr[left] - target);
  const rightDiff = Math.abs(arr[right] - target);

  return leftDiff <= rightDiff ? arr[left] : arr[right];
}

/**
 * Поиск дубликатов в массиве
 * @param {Array} arr - Массив для поиска
 * @returns {Map} - Map с дубликатами и их индексами
 */
function findDuplicates(arr) {
  const duplicates = new Map();
  const seen = new Map();

  if (!arr || arr.length === 0) {
    return duplicates;
  }

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (seen.has(item)) {
      if (!duplicates.has(item)) {
        duplicates.set(item, [seen.get(item)]);
      }
      duplicates.get(item).push(i);
    } else {
      seen.set(item, i);
    }
  }

  return duplicates;
}

/**
 * Поиск уникальных элементов в массиве
 * @param {Array} arr - Массив для поиска
 * @returns {Array} - Массив уникальных элементов
 */
function findUnique(arr) {
  if (!arr || arr.length === 0) {
    return [];
  }

  const seen = new Set();
  const unique = [];

  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }

  return unique;
}

/**
 * Поиск пересечения двух массивов
 * @param {Array} arr1 - Первый массив
 * @param {Array} arr2 - Второй массив
 * @returns {Array} - Массив пересечения
 */
function findIntersection(arr1, arr2) {
  if (!arr1 || arr1.length === 0 || !arr2 || arr2.length === 0) {
    return [];
  }

  const set1 = new Set(arr1);
  const intersection = [];

  for (const item of arr2) {
    if (set1.has(item)) {
      intersection.push(item);
      set1.delete(item); // Удаляем, чтобы избежать дубликатов
    }
  }

  return intersection;
}

/**
 * Поиск разности двух массивов
 * @param {Array} arr1 - Первый массив
 * @param {Array} arr2 - Второй массив
 * @returns {Array} - Массив разности (элементы из arr1, отсутствующие в arr2)
 */
function findDifference(arr1, arr2) {
  if (!arr1 || arr1.length === 0) {
    return [];
  }

  if (!arr2 || arr2.length === 0) {
    return [...arr1];
  }

  const set2 = new Set(arr2);
  const difference = [];

  for (const item of arr1) {
    if (!set2.has(item)) {
      difference.push(item);
    }
  }

  return difference;
}

/**
 * Поиск симметрической разности двух массивов
 * @param {Array} arr1 - Первый массив
 * @param {Array} arr2 - Второй массив
 * @returns {Array} - Массив симметрической разности
 */
function findSymmetricDifference(arr1, arr2) {
  if (!arr1 || arr1.length === 0) {
    return arr2 ? [...arr2] : [];
  }

  if (!arr2 || arr2.length === 0) {
    return [...arr1];
  }

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const result = [];

  for (const item of arr1) {
    if (!set2.has(item)) {
      result.push(item);
    }
  }

  for (const item of arr2) {
    if (!set1.has(item)) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Поиск наиболее часто встречающегося элемента
 * @param {Array} arr - Массив для анализа
 * @returns {Object} - Объект с элементом и частотой
 */
function findMostFrequent(arr) {
  if (!arr || arr.length === 0) {
    return null;
  }

  const frequency = new Map();
  let maxCount = 0;
  let mostFrequent = arr[0];

  for (const item of arr) {
    const count = (frequency.get(item) || 0) + 1;
    frequency.set(item, count);

    if (count > maxCount) {
      maxCount = count;
      mostFrequent = item;
    }
  }

  return {
    element: mostFrequent,
    count: maxCount,
    frequency: frequency,
  };
}

/**
 * Поиск наименее часто встречающегося элемента
 * @param {Array} arr - Массив для анализа
 * @returns {Object} - Объект с элементом и частотой
 */
function findLeastFrequent(arr) {
  if (!arr || arr.length === 0) {
    return null;
  }

  const frequency = new Map();
  let minCount = Infinity;
  let leastFrequent = arr[0];

  for (const item of arr) {
    const count = (frequency.get(item) || 0) + 1;
    frequency.set(item, count);
  }

  for (const [item, count] of frequency) {
    if (count < minCount) {
      minCount = count;
      leastFrequent = item;
    }
  }

  return {
    element: leastFrequent,
    count: minCount,
    frequency: frequency,
  };
}

/**
 * Поиск последовательности в массиве
 * @param {Array} arr - Массив для поиска
 * @param {Array} sequence - Искомая последовательность
 * @returns {number} - Индекс начала последовательности или -1
 */
function findSequence(arr, sequence) {
  if (!arr || arr.length === 0 || !sequence || sequence.length === 0) {
    return -1;
  }

  if (sequence.length > arr.length) {
    return -1;
  }

  for (let i = 0; i <= arr.length - sequence.length; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      if (arr[i + j] !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return i;
    }
  }

  return -1;
}

/**
 * Поиск подмассива с максимальной суммой (Алгоритм Кадане)
 * @param {number[]} arr - Массив чисел
 * @returns {Object} - Объект с максимальной суммой и подмассивом
 */
function findMaxSubarray(arr) {
  if (!arr || arr.length === 0) {
    return null;
  }

  let maxSum = arr[0];
  let currentSum = arr[0];
  let start = 0;
  let end = 0;
  let currentStart = 0;

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > currentSum + arr[i]) {
      currentSum = arr[i];
      currentStart = i;
    } else {
      currentSum += arr[i];
    }

    if (currentSum > maxSum) {
      maxSum = currentSum;
      start = currentStart;
      end = i;
    }
  }

  return {
    sum: maxSum,
    subarray: arr.slice(start, end + 1),
    start: start,
    end: end,
  };
}

/**
 * Поиск пары элементов с заданной суммой
 * @param {number[]} arr - Массив чисел
 * @param {number} target - Целевая сумма
 * @returns {Array} - Массив с парой индексов или null
 */
function findPairWithSum(arr, target) {
  if (!arr || arr.length < 2) {
    return null;
  }

  const seen = new Map();

  for (let i = 0; i < arr.length; i++) {
    const complement = target - arr[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(arr[i], i);
  }

  return null;
}

/**
 * Поиск всех пар элементов с заданной суммой
 * @param {number[]} arr - Массив чисел
 * @param {number} target - Целевая сумма
 * @returns {Array} - Массив пар
 */
function findAllPairsWithSum(arr, target) {
  if (!arr || arr.length < 2) {
    return [];
  }

  const pairs = [];
  const seen = new Map();

  for (let i = 0; i < arr.length; i++) {
    const complement = target - arr[i];
    if (seen.has(complement)) {
      for (const index of seen.get(complement)) {
        pairs.push([index, i]);
      }
    }

    if (!seen.has(arr[i])) {
      seen.set(arr[i], []);
    }
    seen.get(arr[i]).push(i);
  }

  return pairs;
}

/**
 * Поиск триплета элементов с заданной суммой
 * @param {number[]} arr - Массив чисел
 * @param {number} target - Целевая сумма
 * @returns {Array} - Массив с триплетом или null
 */
function findTripletWithSum(arr, target) {
  if (!arr || arr.length < 3) {
    return null;
  }

  const sorted = [...arr].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length - 2; i++) {
    let left = i + 1;
    let right = sorted.length - 1;

    while (left < right) {
      const sum = sorted[i] + sorted[left] + sorted[right];
      if (sum === target) {
        return [sorted[i], sorted[left], sorted[right]];
      }
      if (sum < target) {
        left++;
      } else {
        right--;
      }
    }
  }

  return null;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые алгоритмы поиска
  linearSearch,
  binarySearch,
  binarySearchRecursive,
  binarySearchWithComparator,

  // Поиск с условиями
  findFirst,
  findIndex,
  findAll,
  findAllIndices,

  // Поиск специальных элементов
  findClosest,
  findDuplicates,
  findUnique,
  findIntersection,
  findDifference,
  findSymmetricDifference,
  findMostFrequent,
  findLeastFrequent,

  // Поиск паттернов
  findSequence,
  findMaxSubarray,
  findPairWithSum,
  findAllPairsWithSum,
  findTripletWithSum,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  linearSearch,
  binarySearch,
  binarySearchRecursive,
  binarySearchWithComparator,
  findFirst,
  findIndex,
  findAll,
  findAllIndices,
  findClosest,
  findDuplicates,
  findUnique,
  findIntersection,
  findDifference,
  findSymmetricDifference,
  findMostFrequent,
  findLeastFrequent,
  findSequence,
  findMaxSubarray,
  findPairWithSum,
  findAllPairsWithSum,
  findTripletWithSum,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ МОДУЛЯ ПОИСКА:
 *
 * 1. Вынесены все алгоритмы поиска из основного файла
 *
 * 2. Добавлены новые алгоритмы:
 *    - binarySearchRecursive
 *    - binarySearchWithComparator
 *    - findAllIndices
 *    - findClosest
 *    - findDuplicates
 *    - findUnique
 *    - findIntersection
 *    - findDifference
 *    - findSymmetricDifference
 *    - findMostFrequent
 *    - findLeastFrequent
 *    - findSequence
 *    - findMaxSubarray
 *    - findPairWithSum
 *    - findAllPairsWithSum
 *    - findTripletWithSum
 *
 * 3. Сохранена обратная совместимость
 *
 * 4. Добавлены JSDoc комментарии
 *
 * 5. Оптимизирована производительность для больших массивов
 */
