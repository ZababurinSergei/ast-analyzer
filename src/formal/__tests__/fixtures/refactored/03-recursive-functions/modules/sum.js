// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/03-recursive-functions/modules/sum.js

// ============================================
// МОДУЛЬ РЕКУРСИВНЫХ СУММ
// ============================================
// Этот модуль содержит различные рекурсивные функции
// для вычисления сумм последовательностей и структур данных.

/**
 * Рекурсивная сумма чисел от 1 до n
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {number} n - Верхняя граница суммы
 * @returns {number} - Сумма чисел от 1 до n
 * @throws {Error} - Если n отрицательное
 */
function sumRecursive(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n <= 0) {
    return 0;
  }
  return n + sumRecursive(n - 1);
}

/**
 * Сумма чисел от 1 до n с хвостовой рекурсией
 * Сложность: O(n) время, O(1) память (оптимизация хвостовой рекурсии)
 * @param {number} n - Верхняя граница суммы
 * @param {number} acc - Аккумулятор (для внутреннего использования)
 * @returns {number} - Сумма чисел от 1 до n
 */
function sumTailRecursive(n, acc = 0) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n <= 0) {
    return acc;
  }
  return sumTailRecursive(n - 1, acc + n);
}

/**
 * Рекурсивная сумма элементов массива
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {Array} arr - Массив чисел
 * @returns {number} - Сумма элементов массива
 */
function sumArrayRecursive(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (arr.length === 0) {
    return 0;
  }
  const [first, ...rest] = arr;
  return first + sumArrayRecursive(rest);
}

/**
 * Рекурсивная сумма элементов массива с хвостовой рекурсией
 * Сложность: O(n) время, O(1) память
 * @param {Array} arr - Массив чисел
 * @param {number} index - Текущий индекс (для внутреннего использования)
 * @param {number} acc - Аккумулятор (для внутреннего использования)
 * @returns {number} - Сумма элементов массива
 */
function sumArrayTailRecursive(arr, index = 0, acc = 0) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (index >= arr.length) {
    return acc;
  }
  return sumArrayTailRecursive(arr, index + 1, acc + arr[index]);
}

/**
 * Рекурсивная сумма элементов вложенных массивов
 * Сложность: O(n) время, O(d) память (глубина вложенности)
 * @param {Array} nested - Вложенный массив чисел
 * @returns {number} - Сумма всех чисел во вложенных массивах
 */
function sumNestedArrayRecursive(nested) {
  if (!Array.isArray(nested)) {
    return nested || 0;
  }

  let sum = 0;
  for (const element of nested) {
    if (Array.isArray(element)) {
      sum += sumNestedArrayRecursive(element);
    } else {
      sum += element || 0;
    }
  }
  return sum;
}

/**
 * Рекурсивная сумма элементов объекта (глубокий обход)
 * Сложность: O(n) время, O(d) память (глубина вложенности)
 * @param {Object} obj - Объект с числами
 * @returns {number} - Сумма всех чисел в объекте
 */
function sumObjectRecursive(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'number' ? obj : 0;
  }

  let sum = 0;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      sum += sumObjectRecursive(value);
    } else if (typeof value === 'number') {
      sum += value;
    }
  }
  return sum;
}

/**
 * Рекурсивная сумма элементов дерева
 * Сложность: O(n) время, O(h) память (высота дерева)
 * @param {Object} node - Узел дерева
 * @param {string} childrenKey - Ключ для доступа к детям
 * @param {string} valueKey - Ключ для доступа к значению
 * @returns {number} - Сумма всех значений в дереве
 */
function sumTreeRecursive(node, childrenKey = 'children', valueKey = 'value') {
  if (!node || typeof node !== 'object') {
    return 0;
  }

  const value = node[valueKey] || 0;
  const children = node[childrenKey] || [];

  let sum = value;
  for (const child of children) {
    sum += sumTreeRecursive(child, childrenKey, valueKey);
  }
  return sum;
}

/**
 * Рекурсивная сумма диагонали матрицы (главной и побочной)
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {number[][]} matrix - Квадратная матрица
 * @param {number} i - Текущий индекс (для внутреннего использования)
 * @param {number} sumMain - Сумма главной диагонали (для внутреннего использования)
 * @param {number} sumSecondary - Сумма побочной диагонали (для внутреннего использования)
 * @returns {Object} - Объект с суммами диагоналей
 */
function sumDiagonalsRecursive(matrix, i = 0, sumMain = 0, sumSecondary = 0) {
  if (!Array.isArray(matrix) || !Array.isArray(matrix[0])) {
    throw new TypeError('Expected a square matrix');
  }

  const n = matrix.length;
  if (i >= n) {
    return { main: sumMain, secondary: sumSecondary, total: sumMain + sumSecondary };
  }

  // Проверяем, что строка существует и имеет правильную длину
  if (!matrix[i] || matrix[i].length < n) {
    throw new Error(`Row ${i} has invalid length`);
  }

  const mainValue = matrix[i][i] || 0;
  const secondaryValue = matrix[i][n - 1 - i] || 0;

  return sumDiagonalsRecursive(matrix, i + 1, sumMain + mainValue, sumSecondary + secondaryValue);
}

/**
 * Рекурсивная сумма значений в связанном списке
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {Object} node - Узел связанного списка
 * @param {string} nextKey - Ключ для доступа к следующему узлу
 * @param {string} valueKey - Ключ для доступа к значению
 * @returns {number} - Сумма всех значений в списке
 */
function sumLinkedListRecursive(node, nextKey = 'next', valueKey = 'value') {
  if (!node || typeof node !== 'object') {
    return 0;
  }

  const value = node[valueKey] || 0;
  const next = node[nextKey] || null;

  return value + sumLinkedListRecursive(next, nextKey, valueKey);
}

/**
 * Рекурсивная сумма с пропуском отрицательных чисел
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {number[]} arr - Массив чисел
 * @param {number} index - Текущий индекс (для внутреннего использования)
 * @returns {number} - Сумма только положительных чисел
 */
function sumPositiveRecursive(arr, index = 0) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (index >= arr.length) {
    return 0;
  }

  const value = arr[index] > 0 ? arr[index] : 0;
  return value + sumPositiveRecursive(arr, index + 1);
}

/**
 * Рекурсивная сумма с пропуском отрицательных чисел (хвостовая рекурсия)
 * Сложность: O(n) время, O(1) память
 * @param {number[]} arr - Массив чисел
 * @param {number} index - Текущий индекс (для внутреннего использования)
 * @param {number} acc - Аккумулятор (для внутреннего использования)
 * @returns {number} - Сумма только положительных чисел
 */
function sumPositiveTailRecursive(arr, index = 0, acc = 0) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (index >= arr.length) {
    return acc;
  }

  const value = arr[index] > 0 ? arr[index] : 0;
  return sumPositiveTailRecursive(arr, index + 1, acc + value);
}

/**
 * Рекурсивная сумма с учетом весов
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {number[]} arr - Массив чисел
 * @param {number[]} weights - Массив весов
 * @param {number} index - Текущий индекс (для внутреннего использования)
 * @returns {number} - Взвешенная сумма
 */
function sumWeightedRecursive(arr, weights, index = 0) {
  if (!Array.isArray(arr) || !Array.isArray(weights)) {
    throw new TypeError('Expected arrays');
  }
  if (arr.length !== weights.length) {
    throw new Error('Arrays must have same length');
  }
  if (index >= arr.length) {
    return 0;
  }

  return arr[index] * weights[index] + sumWeightedRecursive(arr, weights, index + 1);
}

/**
 * Рекурсивная сумма с условием (сумма чисел, кратных заданному)
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {number[]} arr - Массив чисел
 * @param {number} divisor - Делитель для проверки кратности
 * @param {number} index - Текущий индекс (для внутреннего использования)
 * @returns {number} - Сумма чисел, кратных divisor
 */
function sumDivisibleRecursive(arr, divisor, index = 0) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (divisor === 0) {
    throw new Error('Divisor cannot be zero');
  }
  if (index >= arr.length) {
    return 0;
  }

  const value = arr[index] % divisor === 0 ? arr[index] : 0;
  return value + sumDivisibleRecursive(arr, divisor, index + 1);
}

/**
 * Рекурсивная сумма квадратов
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {number[]} arr - Массив чисел
 * @param {number} index - Текущий индекс (для внутреннего использования)
 * @returns {number} - Сумма квадратов элементов
 */
function sumSquaresRecursive(arr, index = 0) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (index >= arr.length) {
    return 0;
  }

  return arr[index] * arr[index] + sumSquaresRecursive(arr, index + 1);
}

/**
 * Рекурсивная сумма кубов
 * Сложность: O(n) время, O(n) память (стек рекурсии)
 * @param {number[]} arr - Массив чисел
 * @param {number} index - Текущий индекс (для внутреннего использования)
 * @returns {number} - Сумма кубов элементов
 */
function sumCubesRecursive(arr, index = 0) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (index >= arr.length) {
    return 0;
  }

  return arr[index] * arr[index] * arr[index] + sumCubesRecursive(arr, index + 1);
}

/**
 * Рекурсивная сумма с накоплением (для очень больших массивов)
 * Использует бинарное дерево для уменьшения глубины рекурсии
 * Сложность: O(n) время, O(log n) память
 * @param {number[]} arr - Массив чисел
 * @param {number} left - Левая граница
 * @param {number} right - Правая граница
 * @returns {number} - Сумма элементов
 */
function sumDivideAndConquer(arr, left = 0, right = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (arr.length === 0) {
    return 0;
  }

  if (right === null) {
    right = arr.length - 1;
  }

  if (left === right) {
    return arr[left] || 0;
  }

  const mid = Math.floor((left + right) / 2);
  const leftSum = sumDivideAndConquer(arr, left, mid);
  const rightSum = sumDivideAndConquer(arr, mid + 1, right);
  return leftSum + rightSum;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые рекурсивные суммы
  sumRecursive,
  sumTailRecursive,
  sumArrayRecursive,
  sumArrayTailRecursive,
  sumNestedArrayRecursive,
  sumObjectRecursive,
  sumTreeRecursive,
  sumLinkedListRecursive,

  // Суммы диагоналей матрицы
  sumDiagonalsRecursive,

  // Суммы с условиями
  sumPositiveRecursive,
  sumPositiveTailRecursive,
  sumWeightedRecursive,
  sumDivisibleRecursive,

  // Суммы степеней
  sumSquaresRecursive,
  sumCubesRecursive,

  // Сумма с бинарным разделением
  sumDivideAndConquer,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с рекурсивными суммами
 */
export default {
  sumRecursive,
  sumTailRecursive,
  sumArrayRecursive,
  sumArrayTailRecursive,
  sumNestedArrayRecursive,
  sumObjectRecursive,
  sumTreeRecursive,
  sumLinkedListRecursive,
  sumDiagonalsRecursive,
  sumPositiveRecursive,
  sumPositiveTailRecursive,
  sumWeightedRecursive,
  sumDivisibleRecursive,
  sumSquaresRecursive,
  sumCubesRecursive,
  sumDivideAndConquer,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ РЕКУРСИВНЫХ СУММ
 *
 * Этот модуль предоставляет 16 различных рекурсивных функций
 * для вычисления сумм в различных структурах данных:
 *
 * 1. sumRecursive           - Простая рекурсивная сумма
 * 2. sumTailRecursive       - Сумма с хвостовой рекурсией
 * 3. sumArrayRecursive      - Сумма элементов массива
 * 4. sumArrayTailRecursive  - Сумма массива с хвостовой рекурсией
 * 5. sumNestedArrayRecursive - Сумма вложенных массивов
 * 6. sumObjectRecursive     - Сумма чисел в объекте
 * 7. sumTreeRecursive       - Сумма в дереве
 * 8. sumLinkedListRecursive - Сумма в связанном списке
 * 9. sumDiagonalsRecursive  - Сумма диагоналей матрицы
 * 10. sumPositiveRecursive  - Сумма только положительных чисел
 * 11. sumPositiveTailRecursive - Сумма положительных (хвостовая)
 * 12. sumWeightedRecursive  - Взвешенная сумма
 * 13. sumDivisibleRecursive - Сумма чисел, кратных делителю
 * 14. sumSquaresRecursive   - Сумма квадратов
 * 15. sumCubesRecursive     - Сумма кубов
 * 16. sumDivideAndConquer   - Сумма с бинарным разделением
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные структуры данных
 * - Оптимизированы с использованием хвостовой рекурсии где возможно
 * - Имеют JSDoc с описанием сложности
 * - Обрабатывают граничные случаи (пустые массивы, null, undefined)
 */
