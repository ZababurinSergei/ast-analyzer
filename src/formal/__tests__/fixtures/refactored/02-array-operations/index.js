// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/02-array-operations/index.js

// ============================================
// ОПЕРАЦИИ С МАССИВАМИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все операции с массивами вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт функций поиска
import {
  linearSearch,
  binarySearch,
  ternarySearch,
  jumpSearch,
  exponentialSearch,
  interpolationSearch,
  fibonacciSearch,
  findFirst,
  findLast,
  findAll,
  findIndex,
  findLastIndex,
  contains,
  countOccurrences,
  getUnique,
  getDuplicates,
  getFrequencyMap,
} from './modules/search.js';

// Импорт алгоритмов сортировки
import {
  bubbleSort,
  selectionSort,
  insertionSort,
  quickSort,
  mergeSort,
  heapSort,
  shellSort,
  countingSort,
  radixSort,
  timSort,
  isSorted,
  compareByKey,
  compareByMultipleKeys,
} from './modules/sort.js';

// Импорт функций трансформации
import {
  map,
  filter,
  reduce,
  flatMap,
  flatten,
  compact,
  without,
  union,
  intersection,
  difference,
  symmetricDifference,
  unique,
  chunk,
  partition,
  groupBy,
  keyBy,
  indexBy,
  pluck,
  invoke,
  sortBy,
  orderBy,
  shuffle,
  sample,
  sampleSize,
  reverse,
} from './modules/transform.js';

// ============================================
// КОМБИНИРОВАННЫЕ ОПЕРАЦИИ
// ============================================

/**
 * Находит элемент в массиве с использованием указанного алгоритма поиска
 * @param {Array} arr - Массив для поиска
 * @param {*} target - Искомый элемент
 * @param {string} algorithm - Алгоритм поиска ('linear', 'binary', 'ternary', 'jump', 'exponential', 'interpolation', 'fibonacci')
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {number} - Индекс найденного элемента или -1
 */
function searchInArray(arr, target, algorithm = 'binary', compareFn = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  // Для бинарного поиска нужна предварительная сортировка
  if (
    ['binary', 'ternary', 'jump', 'exponential', 'interpolation', 'fibonacci'].includes(algorithm)
  ) {
    const sorted = quickSort(arr);
    switch (algorithm) {
      case 'binary':
        return binarySearch(sorted, target, compareFn);
      case 'ternary':
        return ternarySearch(sorted, target, compareFn);
      case 'jump':
        return jumpSearch(sorted, target, compareFn);
      case 'exponential':
        return exponentialSearch(sorted, target, compareFn);
      case 'interpolation':
        return interpolationSearch(sorted, target);
      case 'fibonacci':
        return fibonacciSearch(sorted, target);
      default:
        return linearSearch(arr, target, compareFn);
    }
  }

  return linearSearch(arr, target, compareFn);
}

/**
 * Сортирует массив с использованием указанного алгоритма
 * @param {Array} arr - Массив для сортировки
 * @param {string} algorithm - Алгоритм сортировки ('bubble', 'selection', 'insertion', 'quick', 'merge', 'heap', 'shell', 'counting', 'radix', 'tim')
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив
 */
function sortArray(arr, algorithm = 'quick', compareFn = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (arr.length <= 1) {
    return [...arr];
  }

  switch (algorithm) {
    case 'bubble':
      return bubbleSort(arr, compareFn);
    case 'selection':
      return selectionSort(arr, compareFn);
    case 'insertion':
      return insertionSort(arr, compareFn);
    case 'quick':
      return quickSort(arr, compareFn);
    case 'merge':
      return mergeSort(arr, compareFn);
    case 'heap':
      return heapSort(arr, compareFn);
    case 'shell':
      return shellSort(arr, compareFn);
    case 'counting':
      return countingSort(arr);
    case 'radix':
      return radixSort(arr);
    case 'tim':
      return timSort(arr, compareFn);
    default:
      return quickSort(arr, compareFn);
  }
}

/**
 * Трансформирует массив с помощью цепочки операций
 * @param {Array} arr - Массив для трансформации
 * @param {Array<{operation: string, args: Array}>} operations - Массив операций
 * @returns {Array} - Трансформированный массив
 */
function transformArray(arr, operations) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (!Array.isArray(operations)) {
    throw new TypeError('Expected operations array');
  }

  let result = [...arr];

  for (const op of operations) {
    switch (op.operation) {
      case 'map':
        result = map(result, op.args[0]);
        break;
      case 'filter':
        result = filter(result, op.args[0]);
        break;
      case 'reduce':
        result = reduce(result, op.args[0], op.args[1]);
        break;
      case 'flatMap':
        result = flatMap(result, op.args[0]);
        break;
      case 'flatten':
        result = flatten(result, op.args[0] || 1);
        break;
      case 'compact':
        result = compact(result);
        break;
      case 'without':
        result = without(result, ...op.args);
        break;
      case 'unique':
        result = unique(result);
        break;
      case 'chunk':
        result = chunk(result, op.args[0]);
        break;
      case 'partition':
        result = partition(result, op.args[0]);
        break;
      case 'groupBy':
        result = groupBy(result, op.args[0]);
        break;
      case 'sortBy':
        result = sortBy(result, op.args[0]);
        break;
      case 'shuffle':
        result = shuffle(result);
        break;
      case 'reverse':
        result = reverse(result);
        break;
      default:
        throw new Error(`Unknown operation: ${op.operation}`);
    }
  }

  return result;
}

/**
 * Выполняет множественные операции над массивами
 * @param {Array} arr1 - Первый массив
 * @param {Array} arr2 - Второй массив
 * @param {string} operation - Операция ('union', 'intersection', 'difference', 'symmetricDifference')
 * @returns {Array} - Результат операции
 */
function combineArrays(arr1, arr2, operation = 'union') {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    throw new TypeError('Expected arrays');
  }

  switch (operation) {
    case 'union':
      return union(arr1, arr2);
    case 'intersection':
      return intersection(arr1, arr2);
    case 'difference':
      return difference(arr1, arr2);
    case 'symmetricDifference':
      return symmetricDifference(arr1, arr2);
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Анализирует массив и возвращает статистику
 * @param {Array} arr - Массив для анализа
 * @returns {Object} - Статистика массива
 */
function analyzeArray(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const freqMap = getFrequencyMap(arr);
  const uniqueValues = getUnique(arr);
  const duplicates = getDuplicates(arr);
  const uniqueCount = uniqueValues.length;
  const totalCount = arr.length;
  const duplicateCount = duplicates.length;

  return {
    totalCount,
    uniqueCount,
    duplicateCount,
    isEmpty: totalCount === 0,
    isHomogeneous: uniqueCount === 1,
    isUnique: duplicateCount === 0,
    frequencyMap: freqMap,
    uniqueValues,
    duplicates,
    first: arr[0],
    last: arr[arr.length - 1],
    sample: sample(arr),
    sampleSize: sampleSize(arr, 5),
  };
}

/**
 * Сравнивает два массива на равенство
 * @param {Array} arr1 - Первый массив
 * @param {Array} arr2 - Второй массив
 * @param {boolean} strict - Строгое сравнение (по типам)
 * @returns {boolean} - true если массивы равны
 */
function arraysEqual(arr1, arr2, strict = true) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    return false;
  }

  if (arr1.length !== arr2.length) {
    return false;
  }

  for (let i = 0; i < arr1.length; i++) {
    const a = arr1[i];
    const b = arr2[i];

    if (Array.isArray(a) && Array.isArray(b)) {
      if (!arraysEqual(a, b, strict)) {
        return false;
      }
    } else if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      if (!objectsEqual(a, b, strict)) {
        return false;
      }
    } else if (strict) {
      if (a !== b) {
        return false;
      }
    } else {
      // eslint-disable-next-line eqeqeq
      if (a != b) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Сравнивает два объекта на равенство
 * @param {Object} obj1 - Первый объект
 * @param {Object} obj2 - Второй объект
 * @param {boolean} strict - Строгое сравнение
 * @returns {boolean} - true если объекты равны
 */
function objectsEqual(obj1, obj2, strict = true) {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }
    const val1 = obj1[key];
    const val2 = obj2[key];

    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (!arraysEqual(val1, val2, strict)) {
        return false;
      }
    } else if (
      typeof val1 === 'object' &&
      val1 !== null &&
      typeof val2 === 'object' &&
      val2 !== null
    ) {
      if (!objectsEqual(val1, val2, strict)) {
        return false;
      }
    } else if (strict) {
      if (val1 !== val2) {
        return false;
      }
    } else {
      // eslint-disable-next-line eqeqeq
      if (val1 != val2) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Создает массив чисел в заданном диапазоне
 * @param {number} start - Начало диапазона
 * @param {number} end - Конец диапазона
 * @param {number} step - Шаг (по умолчанию 1)
 * @returns {Array<number>} - Массив чисел
 */
function range(start, end, step = 1) {
  if (typeof start !== 'number' || typeof end !== 'number' || typeof step !== 'number') {
    throw new TypeError('Expected numbers');
  }

  if (step === 0) {
    throw new Error('Step cannot be zero');
  }

  const result = [];
  if (start < end) {
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
  } else {
    for (let i = start; i > end; i -= Math.abs(step)) {
      result.push(i);
    }
  }
  return result;
}

/**
 * Создает массив с повторяющимися значениями
 * @param {*} value - Значение для повторения
 * @param {number} count - Количество повторений
 * @returns {Array} - Массив с повторяющимися значениями
 */
function repeat(value, count) {
  if (typeof count !== 'number' || count < 0) {
    throw new TypeError('Expected non-negative number');
  }
  return new Array(count).fill(value);
}

/**
 * Заполняет массив значениями по заданной функции
 * @param {number} length - Длина массива
 * @param {Function} fillFn - Функция для генерации значений
 * @returns {Array} - Заполненный массив
 */
function fillArray(length, fillFn) {
  if (typeof length !== 'number' || length < 0) {
    throw new TypeError('Expected non-negative number');
  }
  if (typeof fillFn !== 'function') {
    throw new TypeError('Expected function');
  }

  return Array.from({ length }, (_, index) => fillFn(index));
}

/**
 * Создает матрицу (двумерный массив)
 * @param {number} rows - Количество строк
 * @param {number} cols - Количество столбцов
 * @param {*} defaultValue - Значение по умолчанию
 * @returns {Array<Array>} - Матрица
 */
function createMatrix(rows, cols, defaultValue = null) {
  if (typeof rows !== 'number' || rows < 0 || typeof cols !== 'number' || cols < 0) {
    throw new TypeError('Expected non-negative numbers');
  }

  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () =>
      typeof defaultValue === 'function' ? defaultValue() : defaultValue
    )
  );
}

/**
 * Транспонирует матрицу
 * @param {Array<Array>} matrix - Матрица
 * @returns {Array<Array>} - Транспонированная матрица
 */
function transposeMatrix(matrix) {
  if (!Array.isArray(matrix) || !matrix.every(row => Array.isArray(row))) {
    throw new TypeError('Expected a matrix');
  }

  const rows = matrix.length;
  if (rows === 0) return [];

  const cols = matrix[0].length;
  if (!matrix.every(row => row.length === cols)) {
    throw new Error('Matrix rows have different lengths');
  }

  return Array.from({ length: cols }, (_, j) =>
    Array.from({ length: rows }, (_, i) => matrix[i][j])
  );
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт из модуля поиска
export {
  linearSearch,
  binarySearch,
  ternarySearch,
  jumpSearch,
  exponentialSearch,
  interpolationSearch,
  fibonacciSearch,
  findFirst,
  findLast,
  findAll,
  findIndex,
  findLastIndex,
  contains,
  countOccurrences,
  getUnique,
  getDuplicates,
  getFrequencyMap,
};

// Реэкспорт из модуля сортировки
export {
  bubbleSort,
  selectionSort,
  insertionSort,
  quickSort,
  mergeSort,
  heapSort,
  shellSort,
  countingSort,
  radixSort,
  timSort,
  isSorted,
  compareByKey,
  compareByMultipleKeys,
};

// Реэкспорт из модуля трансформации
export {
  map,
  filter,
  reduce,
  flatMap,
  flatten,
  compact,
  without,
  union,
  intersection,
  difference,
  symmetricDifference,
  unique,
  chunk,
  partition,
  groupBy,
  keyBy,
  indexBy,
  pluck,
  invoke,
  sortBy,
  orderBy,
  shuffle,
  sample,
  sampleSize,
  reverse,
};

// Реэкспорт комбинированных операций
export {
  searchInArray,
  sortArray,
  transformArray,
  combineArrays,
  analyzeArray,
  arraysEqual,
  objectsEqual,
  range,
  repeat,
  fillArray,
  createMatrix,
  transposeMatrix,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями для работы с массивами
 */
export default {
  // Поиск
  linearSearch,
  binarySearch,
  ternarySearch,
  jumpSearch,
  exponentialSearch,
  interpolationSearch,
  fibonacciSearch,
  findFirst,
  findLast,
  findAll,
  findIndex,
  findLastIndex,
  contains,
  countOccurrences,
  getUnique,
  getDuplicates,
  getFrequencyMap,

  // Сортировка
  bubbleSort,
  selectionSort,
  insertionSort,
  quickSort,
  mergeSort,
  heapSort,
  shellSort,
  countingSort,
  radixSort,
  timSort,
  isSorted,
  compareByKey,
  compareByMultipleKeys,

  // Трансформация
  map,
  filter,
  reduce,
  flatMap,
  flatten,
  compact,
  without,
  union,
  intersection,
  difference,
  symmetricDifference,
  unique,
  chunk,
  partition,
  groupBy,
  keyBy,
  indexBy,
  pluck,
  invoke,
  sortBy,
  orderBy,
  shuffle,
  sample,
  sampleSize,
  reverse,

  // Комбинированные
  searchInArray,
  sortArray,
  transformArray,
  combineArrays,
  analyzeArray,
  arraysEqual,
  objectsEqual,
  range,
  repeat,
  fillArray,
  createMatrix,
  transposeMatrix,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Модуль search.js - все алгоритмы поиска:
 *    - Линейный поиск
 *    - Бинарный поиск
 *    - Тернарный поиск
 *    - Поиск прыжками
 *    - Экспоненциальный поиск
 *    - Интерполяционный поиск
 *    - Поиск Фибоначчи
 *    - Поиск первого/последнего/всех элементов
 *    - Поиск индекса
 *    - Проверка наличия
 *    - Подсчет вхождений
 *    - Уникальные/дублирующиеся элементы
 *    - Карта частот
 *
 * 2. Модуль sort.js - все алгоритмы сортировки:
 *    - Пузырьковая сортировка
 *    - Сортировка выбором
 *    - Сортировка вставками
 *    - Быстрая сортировка
 *    - Сортировка слиянием
 *    - Пирамидальная сортировка
 *    - Сортировка Шелла
 *    - Сортировка подсчетом
 *    - Поразрядная сортировка
 *    - Timsort
 *    - Проверка сортировки
 *    - Сравнение по ключу/ключам
 *
 * 3. Модуль transform.js - все функции трансформации:
 *    - map, filter, reduce
 *    - flatMap, flatten
 *    - compact, without
 *    - union, intersection, difference
 *    - symmetricDifference
 *    - unique, chunk, partition
 *    - groupBy, keyBy, indexBy
 *    - pluck, invoke
 *    - sortBy, orderBy
 *    - shuffle, sample, sampleSize
 *    - reverse
 *
 * 4. Комбинированные операции в index.js:
 *    - searchInArray - поиск с выбором алгоритма
 *    - sortArray - сортировка с выбором алгоритма
 *    - transformArray - цепочка трансформаций
 *    - combineArrays - операции над множествами
 *    - analyzeArray - анализ массива
 *    - arraysEqual - сравнение массивов
 *    - objectsEqual - сравнение объектов
 *    - range - создание диапазона
 *    - repeat - повторение значений
 *    - fillArray - заполнение массива
 *    - createMatrix - создание матрицы
 *    - transposeMatrix - транспонирование матрицы
 *
 * 5. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 6. Добавлены JSDoc комментарии для всех функций
 *
 * 7. Сохранена обратная совместимость через реэкспорты
 *
 * 8. Добавлены функции для работы с матрицами
 *
 * 9. Добавлены функции для создания массивов
 *
 * 10. Добавлены функции сравнения массивов и объектов
 */
