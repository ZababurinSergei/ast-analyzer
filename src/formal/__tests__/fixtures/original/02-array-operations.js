// packages/ast-analyzer/src/formal/__tests__/fixtures/original/02-array-operations.js

/**
 * Модуль операций с массивами
 * Содержит функции для работы с массивами: сумма, поиск, сортировка, бинарный поиск
 */

/**
 * Вычисляет сумму элементов массива
 * @param {number[]} arr - массив чисел
 * @returns {number} сумма элементов
 */
function sumArray(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}

/**
 * Находит максимальный элемент в массиве
 * @param {number[]} arr - массив чисел
 * @returns {number|undefined} максимальный элемент или undefined для пустого массива
 */
function findMax(arr) {
  if (arr.length === 0) return undefined;
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

/**
 * Находит минимальный элемент в массиве
 * @param {number[]} arr - массив чисел
 * @returns {number|undefined} минимальный элемент или undefined для пустого массива
 */
function findMin(arr) {
  if (arr.length === 0) return undefined;
  let min = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min;
}

/**
 * Сортирует массив по возрастанию (пузырьковая сортировка)
 * @param {number[]} arr - массив чисел
 * @returns {number[]} новый отсортированный массив
 */
function sortArray(arr) {
  const copy = [...arr];
  for (let i = 0; i < copy.length; i++) {
    for (let j = i + 1; j < copy.length; j++) {
      if (copy[i] > copy[j]) {
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
    }
  }
  return copy;
}

/**
 * Выполняет бинарный поиск элемента в отсортированном массиве
 * @param {number[]} arr - отсортированный массив чисел
 * @param {number} target - искомое значение
 * @returns {number} индекс элемента или -1 если не найден
 */
function binarySearch(arr, target) {
  let left = 0,
    right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

/**
 * Вычисляет среднее арифметическое элементов массива
 * @param {number[]} arr - массив чисел
 * @returns {number} среднее значение
 */
function averageArray(arr) {
  if (arr.length === 0) return 0;
  return sumArray(arr) / arr.length;
}

/**
 * Фильтрует массив, оставляя только положительные числа
 * @param {number[]} arr - массив чисел
 * @returns {number[]} массив положительных чисел
 */
function filterPositive(arr) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > 0) {
      result.push(arr[i]);
    }
  }
  return result;
}

/**
 * Умножает каждый элемент массива на заданное число
 * @param {number[]} arr - массив чисел
 * @param {number} multiplier - множитель
 * @returns {number[]} новый массив с умноженными элементами
 */
function multiplyArray(arr, multiplier) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(arr[i] * multiplier);
  }
  return result;
}

/**
 * Проверяет, содержит ли массив заданный элемент
 * @param {number[]} arr - массив чисел
 * @param {number} element - искомый элемент
 * @returns {boolean} true если элемент найден
 */
function containsElement(arr, element) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === element) return true;
  }
  return false;
}

/**
 * Объединяет два массива и удаляет дубликаты
 * @param {number[]} arr1 - первый массив
 * @param {number[]} arr2 - второй массив
 * @returns {number[]} объединенный массив без дубликатов
 */
function unionArrays(arr1, arr2) {
  const result = [...arr1];
  for (let i = 0; i < arr2.length; i++) {
    if (!containsElement(result, arr2[i])) {
      result.push(arr2[i]);
    }
  }
  return result;
}

/**
 * Находит пересечение двух массивов
 * @param {number[]} arr1 - первый массив
 * @param {number[]} arr2 - второй массив
 * @returns {number[]} массив с элементами, присутствующими в обоих массивах
 */
function intersectArrays(arr1, arr2) {
  const result = [];
  for (let i = 0; i < arr1.length; i++) {
    if (containsElement(arr2, arr1[i]) && !containsElement(result, arr1[i])) {
      result.push(arr1[i]);
    }
  }
  return result;
}

/**
 * Разворачивает массив (reverse)
 * @param {number[]} arr - массив чисел
 * @returns {number[]} новый массив с элементами в обратном порядке
 */
function reverseArray(arr) {
  const result = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    result.push(arr[i]);
  }
  return result;
}

/**
 * Вычисляет произведение элементов массива
 * @param {number[]} arr - массив чисел
 * @returns {number} произведение элементов
 */
function productArray(arr) {
  if (arr.length === 0) return 0;
  let product = 1;
  for (let i = 0; i < arr.length; i++) {
    product *= arr[i];
  }
  return product;
}

/**
 * Находит все индексы заданного элемента в массиве
 * @param {number[]} arr - массив чисел
 * @param {number} element - искомый элемент
 * @returns {number[]} массив индексов
 */
function findAllIndexes(arr, element) {
  const indexes = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === element) {
      indexes.push(i);
    }
  }
  return indexes;
}

/**
 * Проверяет, отсортирован ли массив по возрастанию
 * @param {number[]} arr - массив чисел
 * @returns {boolean} true если массив отсортирован
 */
function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) return false;
  }
  return true;
}

/**
 * Удаляет дубликаты из массива
 * @param {number[]} arr - массив чисел
 * @returns {number[]} массив без дубликатов
 */
function removeDuplicates(arr) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (!containsElement(result, arr[i])) {
      result.push(arr[i]);
    }
  }
  return result;
}

/**
 * Разбивает массив на части заданного размера
 * @param {number[]} arr - массив чисел
 * @param {number} chunkSize - размер части
 * @returns {number[][]} массив из частей
 */
function chunkArray(arr, chunkSize) {
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = [];
    for (let j = i; j < Math.min(i + chunkSize, arr.length); j++) {
      chunk.push(arr[j]);
    }
    result.push(chunk);
  }
  return result;
}

/**
 * Вычисляет частоту элементов в массиве
 * @param {number[]} arr - массив чисел
 * @returns {Object} объект с частотами элементов
 */
function frequencyArray(arr) {
  const freq = {};
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i];
    freq[key] = (freq[key] || 0) + 1;
  }
  return freq;
}

// Экспорт всех функций
export {
  sumArray,
  findMax,
  findMin,
  sortArray,
  binarySearch,
  averageArray,
  filterPositive,
  multiplyArray,
  containsElement,
  unionArrays,
  intersectArrays,
  reverseArray,
  productArray,
  findAllIndexes,
  isSorted,
  removeDuplicates,
  chunkArray,
  frequencyArray,
};
