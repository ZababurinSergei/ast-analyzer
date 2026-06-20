// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/02-array-operations/modules/sort.js

// ============================================
// МОДУЛЬ СОРТИРОВКИ МАССИВОВ
// ============================================
// Этот модуль содержит различные алгоритмы сортировки
// и вспомогательные функции для работы с ними.

/**
 * Сортировка пузырьком (Bubble Sort)
 * Сложность: O(n²) время, O(1) память
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function bubbleSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [...arr];
  const len = result.length;

  for (let i = 0; i < len - 1; i++) {
    let swapped = false;
    for (let j = 0; j < len - 1 - i; j++) {
      if (compareFn(result[j], result[j + 1]) > 0) {
        [result[j], result[j + 1]] = [result[j + 1], result[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }

  return result;
}

/**
 * Сортировка выбором (Selection Sort)
 * Сложность: O(n²) время, O(1) память
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function selectionSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [...arr];
  const len = result.length;

  for (let i = 0; i < len - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < len; j++) {
      if (compareFn(result[j], result[minIdx]) < 0) {
        minIdx = j;
      }
    }
    if (minIdx !== i) {
      [result[i], result[minIdx]] = [result[minIdx], result[i]];
    }
  }

  return result;
}

/**
 * Сортировка вставками (Insertion Sort)
 * Сложность: O(n²) время, O(1) память
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function insertionSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [...arr];
  const len = result.length;

  for (let i = 1; i < len; i++) {
    const current = result[i];
    let j = i - 1;
    while (j >= 0 && compareFn(result[j], current) > 0) {
      result[j + 1] = result[j];
      j--;
    }
    result[j + 1] = current;
  }

  return result;
}

/**
 * Быстрая сортировка (Quick Sort)
 * Сложность: O(n log n) в среднем, O(n²) в худшем случае
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function quickSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (arr.length <= 1) {
    return [...arr];
  }

  const pivot = arr[Math.floor(arr.length / 2)];
  const left = [];
  const middle = [];
  const right = [];

  for (const element of arr) {
    const comparison = compareFn(element, pivot);
    if (comparison < 0) {
      left.push(element);
    } else if (comparison === 0) {
      middle.push(element);
    } else {
      right.push(element);
    }
  }

  return [...quickSort(left, compareFn), ...middle, ...quickSort(right, compareFn)];
}

/**
 * Сортировка слиянием (Merge Sort)
 * Сложность: O(n log n) время, O(n) память
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function mergeSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (arr.length <= 1) {
    return [...arr];
  }

  const middle = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, middle), compareFn);
  const right = mergeSort(arr.slice(middle), compareFn);

  return merge(left, right, compareFn);
}

/**
 * Вспомогательная функция для слияния двух отсортированных массивов
 * @param {Array} left - Левый отсортированный массив
 * @param {Array} right - Правый отсортированный массив
 * @param {Function} compareFn - Функция сравнения
 * @returns {Array} - Объединенный отсортированный массив
 */
function merge(left, right, compareFn) {
  const result = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (compareFn(left[i], right[j]) <= 0) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }

  return result.concat(left.slice(i)).concat(right.slice(j));
}

/**
 * Пирамидальная сортировка (Heap Sort)
 * Сложность: O(n log n) время, O(1) память
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function heapSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [...arr];
  const len = result.length;

  // Построение кучи
  for (let i = Math.floor(len / 2) - 1; i >= 0; i--) {
    heapify(result, len, i, compareFn);
  }

  // Извлечение элементов из кучи
  for (let i = len - 1; i > 0; i--) {
    [result[0], result[i]] = [result[i], result[0]];
    heapify(result, i, 0, compareFn);
  }

  return result;
}

/**
 * Вспомогательная функция для построения кучи
 * @param {Array} arr - Массив
 * @param {number} n - Размер кучи
 * @param {number} i - Индекс корня
 * @param {Function} compareFn - Функция сравнения
 */
function heapify(arr, n, i, compareFn) {
  let largest = i;
  const left = 2 * i + 1;
  const right = 2 * i + 2;

  if (left < n && compareFn(arr[left], arr[largest]) > 0) {
    largest = left;
  }

  if (right < n && compareFn(arr[right], arr[largest]) > 0) {
    largest = right;
  }

  if (largest !== i) {
    [arr[i], arr[largest]] = [arr[largest], arr[i]];
    heapify(arr, n, largest, compareFn);
  }
}

/**
 * Сортировка Шелла (Shell Sort)
 * Сложность: O(n log n) в среднем
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function shellSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [...arr];
  const len = result.length;

  // Вычисляем промежутки по алгоритму Ciura
  const gaps = [701, 301, 132, 57, 23, 10, 4, 1];

  for (const gap of gaps) {
    for (let i = gap; i < len; i++) {
      const temp = result[i];
      let j = i;
      while (j >= gap && compareFn(result[j - gap], temp) > 0) {
        result[j] = result[j - gap];
        j -= gap;
      }
      result[j] = temp;
    }
  }

  return result;
}

/**
 * Сортировка подсчетом (Counting Sort)
 * Сложность: O(n + k) время, O(k) память
 * @param {number[]} arr - Массив чисел для сортировки
 * @param {number} maxVal - Максимальное значение (опционально)
 * @returns {number[]} - Отсортированный массив
 */
function countingSort(arr, maxVal = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (arr.length === 0) {
    return [];
  }

  // Проверяем, что все элементы - числа
  if (!arr.every(item => typeof item === 'number' && Number.isInteger(item))) {
    throw new TypeError('Counting sort works only with integers');
  }

  const minVal = Math.min(...arr);
  const maxValActual = maxVal !== null ? maxVal : Math.max(...arr);
  const range = maxValActual - minVal + 1;

  // Создаем массив для подсчета
  const count = new Array(range).fill(0);

  // Подсчитываем вхождения
  for (const num of arr) {
    count[num - minVal]++;
  }

  // Строим отсортированный массив
  const result = [];
  for (let i = 0; i < count.length; i++) {
    for (let j = 0; j < count[i]; j++) {
      result.push(i + minVal);
    }
  }

  return result;
}

/**
 * Поразрядная сортировка (Radix Sort)
 * Сложность: O(n * k) время, O(n) память
 * @param {number[]} arr - Массив чисел для сортировки
 * @param {number} maxDigits - Максимальное количество разрядов
 * @returns {number[]} - Отсортированный массив
 */
function radixSort(arr, maxDigits = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (arr.length === 0) {
    return [];
  }

  // Проверяем, что все элементы - числа
  if (!arr.every(item => typeof item === 'number' && Number.isInteger(item) && item >= 0)) {
    throw new TypeError('Radix sort works only with non-negative integers');
  }

  const result = [...arr];
  const maxVal = Math.max(...result);
  const maxDigitsActual = maxDigits !== null ? maxDigits : String(maxVal).length;

  for (let digit = 0; digit < maxDigitsActual; digit++) {
    const buckets = Array.from({ length: 10 }, () => []);

    for (const num of result) {
      const digitValue = Math.floor(num / Math.pow(10, digit)) % 10;
      buckets[digitValue].push(num);
    }

    result.length = 0;
    for (const bucket of buckets) {
      result.push(...bucket);
    }
  }

  return result;
}

/**
 * Сортировка Timsort (гибридная сортировка)
 * Сложность: O(n log n) время, O(n) память
 * @param {Array} arr - Массив для сортировки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {Array} - Отсортированный массив (новая копия)
 */
function timSort(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (arr.length <= 1) {
    return [...arr];
  }

  const result = [...arr];
  const minRun = 32;
  const len = result.length;

  // Сортируем небольшие подмассивы вставками
  for (let i = 0; i < len; i += minRun) {
    const end = Math.min(i + minRun, len);
    insertionSort(result.slice(i, end), compareFn);
  }

  // Объединяем отсортированные подмассивы
  let size = minRun;
  while (size < len) {
    for (let left = 0; left < len; left += size * 2) {
      const mid = Math.min(left + size, len);
      const right = Math.min(left + size * 2, len);

      if (mid < right) {
        const merged = merge(result.slice(left, mid), result.slice(mid, right), compareFn);
        for (let i = 0; i < merged.length; i++) {
          result[left + i] = merged[i];
        }
      }
    }
    size *= 2;
  }

  return result;
}

/**
 * Проверяет, отсортирован ли массив
 * @param {Array} arr - Массив для проверки
 * @param {Function} compareFn - Функция сравнения (опционально)
 * @returns {boolean} - true если массив отсортирован
 */
function isSorted(arr, compareFn = defaultCompare) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  for (let i = 1; i < arr.length; i++) {
    if (compareFn(arr[i - 1], arr[i]) > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Функция сравнения по умолчанию
 * @param {any} a - Первый элемент
 * @param {any} b - Второй элемент
 * @returns {number} - Отрицательное, если a < b; положительное, если a > b; 0 если равны
 */
function defaultCompare(a, b) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Создает функцию сравнения для объектов по ключу
 * @param {string} key - Ключ для сравнения
 * @param {boolean} ascending - Направление сортировки
 * @returns {Function} - Функция сравнения
 */
function compareByKey(key, ascending = true) {
  return (a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    const result = defaultCompare(aVal, bVal);
    return ascending ? result : -result;
  };
}

/**
 * Создает функцию сравнения для объектов по нескольким ключам
 * @param {Array<{key: string, ascending?: boolean}>} keys - Массив ключей для сортировки
 * @returns {Function} - Функция сравнения
 */
function compareByMultipleKeys(keys) {
  return (a, b) => {
    for (const { key, ascending = true } of keys) {
      const aVal = a[key];
      const bVal = b[key];
      const result = defaultCompare(aVal, bVal);
      if (result !== 0) {
        return ascending ? result : -result;
      }
    }
    return 0;
  };
}

/**
 * Обмен местами двух элементов в массиве (по ссылке)
 * @param {Array} arr - Массив
 * @param {number} i - Индекс первого элемента
 * @param {number} j - Индекс второго элемента
 */
function swapInPlace(arr, i, j) {
  if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) {
    throw new RangeError('Index out of bounds');
  }
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные алгоритмы сортировки
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

  // Вспомогательные функции
  merge,
  heapify,
  isSorted,
  defaultCompare,
  compareByKey,
  compareByMultipleKeys,
  swapInPlace,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями сортировки
 */
export default {
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
  merge,
  heapify,
  isSorted,
  defaultCompare,
  compareByKey,
  compareByMultipleKeys,
  swapInPlace,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ СОРТИРОВКИ МАССИВОВ
 *
 * Этот модуль предоставляет 10 различных алгоритмов сортировки:
 *
 * 1. bubbleSort    - Сортировка пузырьком (O(n²))
 * 2. selectionSort - Сортировка выбором (O(n²))
 * 3. insertionSort - Сортировка вставками (O(n²))
 * 4. quickSort     - Быстрая сортировка (O(n log n))
 * 5. mergeSort     - Сортировка слиянием (O(n log n))
 * 6. heapSort      - Пирамидальная сортировка (O(n log n))
 * 7. shellSort     - Сортировка Шелла (O(n log n))
 * 8. countingSort  - Сортировка подсчетом (O(n + k))
 * 9. radixSort     - Поразрядная сортировка (O(n * k))
 * 10. timSort      - Timsort (O(n log n))
 *
 * Каждый алгоритм:
 * - Работает с копией массива (не изменяет оригинал)
 * - Поддерживает пользовательскую функцию сравнения
 * - Обрабатывает пустые массивы и массивы с одним элементом
 * - Имеет JSDoc с описанием сложности
 *
 * Дополнительные утилиты:
 * - isSorted - проверка сортировки
 * - compareByKey - сравнение по ключу объекта
 * - compareByMultipleKeys - сравнение по нескольким ключам
 * - swapInPlace - обмен элементов в массиве
 */
