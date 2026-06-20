// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/01-math-operations/modules/multiplication.js

// ============================================
// МОДУЛЬ УМНОЖЕНИЯ
// ============================================
// Этот модуль содержит все функции, связанные с умножением
// Вынесен из основного файла при рефакторинге

/**
 * Умножает два числа
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Произведение a и b
 *
 * @example
 * multiply(2, 3) // returns 6
 * multiply(-4, 5) // returns -20
 * multiply(0, 100) // returns 0
 */
export function multiply(a, b) {
  return a * b;
}

/**
 * Умножает несколько чисел
 * @param {...number} numbers - Числа для умножения
 * @returns {number} - Произведение всех чисел
 *
 * @example
 * multiplyAll(2, 3, 4) // returns 24
 * multiplyAll(5, 10) // returns 50
 * multiplyAll(1) // returns 1
 */
export function multiplyAll(...numbers) {
  if (numbers.length === 0) {
    return 1;
  }
  return numbers.reduce((result, num) => result * num, 1);
}

/**
 * Вычисляет квадрат числа
 * @param {number} x - Число для возведения в квадрат
 * @returns {number} - Квадрат числа
 *
 * @example
 * square(5) // returns 25
 * square(-3) // returns 9
 * square(0) // returns 0
 */
export function square(x) {
  return multiply(x, x);
}

/**
 * Вычисляет куб числа
 * @param {number} x - Число для возведения в куб
 * @returns {number} - Куб числа
 *
 * @example
 * cube(3) // returns 27
 * cube(-2) // returns -8
 * cube(0) // returns 0
 */
export function cube(x) {
  return multiply(multiply(x, x), x);
}

/**
 * Возводит число в степень (целочисленная)
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени (целое число)
 * @returns {number} - Результат возведения в степень
 *
 * @example
 * power(2, 3) // returns 8
 * power(5, 2) // returns 25
 * power(10, 0) // returns 1
 */
export function power(base, exponent) {
  if (exponent === 0) return 1;
  if (exponent < 0) return 1 / power(base, -exponent);

  let result = 1;
  for (let i = 0; i < exponent; i++) {
    result = multiply(result, base);
  }
  return result;
}

/**
 * Вычисляет факториал числа (через умножение)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Факториал числа
 * @throws {Error} - Если n отрицательное
 *
 * @example
 * factorial(5) // returns 120
 * factorial(0) // returns 1
 * factorial(1) // returns 1
 */
export function factorial(n) {
  if (n < 0) {
    throw new Error('Factorial is not defined for negative numbers');
  }
  if (n <= 1) return 1;

  let result = 1;
  for (let i = 2; i <= n; i++) {
    result = multiply(result, i);
  }
  return result;
}

/**
 * Вычисляет произведение элементов массива
 * @param {number[]} array - Массив чисел
 * @returns {number} - Произведение всех элементов
 *
 * @example
 * product([2, 3, 4]) // returns 24
 * product([5, 10]) // returns 50
 * product([]) // returns 1
 */
export function product(array) {
  if (!array || array.length === 0) {
    return 1;
  }
  return array.reduce((result, num) => multiply(result, num), 1);
}

/**
 * Вычисляет скалярное произведение двух векторов
 * @param {number[]} v1 - Первый вектор
 * @param {number[]} v2 - Второй вектор
 * @returns {number} - Скалярное произведение
 * @throws {Error} - Если векторы разной длины
 *
 * @example
 * dotProduct([1, 2, 3], [4, 5, 6]) // returns 32
 * dotProduct([1, 0], [0, 1]) // returns 0
 */
export function dotProduct(v1, v2) {
  if (v1.length !== v2.length) {
    throw new Error('Vectors must have the same length');
  }

  let result = 0;
  for (let i = 0; i < v1.length; i++) {
    result = result + multiply(v1[i], v2[i]);
  }
  return result;
}

/**
 * Умножает матрицу на число (скалярное умножение)
 * @param {number[][]} matrix - Матрица
 * @param {number} scalar - Число для умножения
 * @returns {number[][]} - Результат умножения
 *
 * @example
 * scalarMultiply([[1, 2], [3, 4]], 2) // returns [[2, 4], [6, 8]]
 */
export function scalarMultiply(matrix, scalar) {
  return matrix.map(row => row.map(value => multiply(value, scalar)));
}

/**
 * Умножает две матрицы
 * @param {number[][]} m1 - Первая матрица
 * @param {number[][]} m2 - Вторая матрица
 * @returns {number[][]} - Результат умножения
 * @throws {Error} - Если размеры матриц несовместимы
 *
 * @example
 * matrixMultiply([[1, 2], [3, 4]], [[5, 6], [7, 8]])
 * // returns [[19, 22], [43, 50]]
 */
export function matrixMultiply(m1, m2) {
  if (!m1 || !m2 || m1.length === 0 || m2.length === 0) {
    throw new Error('Matrices cannot be empty');
  }

  if (m1[0].length !== m2.length) {
    throw new Error('Invalid matrix dimensions for multiplication');
  }

  const result = [];
  for (let i = 0; i < m1.length; i++) {
    result[i] = [];
    for (let j = 0; j < m2[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < m1[0].length; k++) {
        sum = sum + multiply(m1[i][k], m2[k][j]);
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Вычисляет произведение элементов в каждой строке матрицы
 * @param {number[][]} matrix - Матрица
 * @returns {number[]} - Массив произведений по строкам
 *
 * @example
 * rowProducts([[1, 2, 3], [4, 5, 6]]) // returns [6, 120]
 */
export function rowProducts(matrix) {
  return matrix.map(row => product(row));
}

/**
 * Вычисляет произведение элементов в каждом столбце матрицы
 * @param {number[][]} matrix - Матрица
 * @returns {number[]} - Массив произведений по столбцам
 *
 * @example
 * columnProducts([[1, 2], [3, 4]]) // returns [3, 8]
 */
export function columnProducts(matrix) {
  if (!matrix || matrix.length === 0) return [];

  const result = new Array(matrix[0].length).fill(1);
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      result[j] = multiply(result[j], matrix[i][j]);
    }
  }
  return result;
}

/**
 * Вычисляет произведение всех элементов матрицы
 * @param {number[][]} matrix - Матрица
 * @returns {number} - Произведение всех элементов
 *
 * @example
 * matrixProduct([[1, 2], [3, 4]]) // returns 24
 */
export function matrixProduct(matrix) {
  let result = 1;
  for (const row of matrix) {
    for (const value of row) {
      result = multiply(result, value);
    }
  }
  return result;
}

/**
 * Возводит матрицу в степень
 * @param {number[][]} matrix - Квадратная матрица
 * @param {number} exponent - Степень (неотрицательное целое число)
 * @returns {number[][]} - Результат возведения в степень
 * @throws {Error} - Если матрица не квадратная или степень отрицательная
 *
 * @example
 * matrixPower([[1, 2], [3, 4]], 2)
 * // returns [[7, 10], [15, 22]]
 */
export function matrixPower(matrix, exponent) {
  if (exponent < 0) {
    throw new Error('Exponent must be non-negative');
  }

  if (matrix.length !== matrix[0].length) {
    throw new Error('Matrix must be square');
  }

  if (exponent === 0) {
    // Возвращаем единичную матрицу
    return matrix.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
  }

  let result = matrix;
  for (let i = 1; i < exponent; i++) {
    result = matrixMultiply(result, matrix);
  }
  return result;
}

/**
 * Вычисляет произведение двух чисел с проверкой на переполнение
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Произведение или Infinity при переполнении
 *
 * @example
 * safeMultiply(1e200, 1e200) // returns Infinity
 * safeMultiply(1e100, 2) // returns 2e100
 */
export function safeMultiply(a, b) {
  const result = a * b;
  if (!isFinite(result)) {
    return a > 0 && b > 0 ? Infinity : -Infinity;
  }
  return result;
}

/**
 * Вычисляет произведение чисел с плавающей точкой с заданной точностью
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @param {number} precision - Количество знаков после запятой
 * @returns {number} - Произведение с заданной точностью
 *
 * @example
 * preciseMultiply(0.1, 0.2, 10) // returns 0.02
 */
export function preciseMultiply(a, b, precision = 10) {
  const result = a * b;
  const factor = Math.pow(10, precision);
  return Math.round(result * factor) / factor;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект модуля умножения
 */
export default {
  multiply,
  multiplyAll,
  square,
  cube,
  power,
  factorial,
  product,
  dotProduct,
  scalarMultiply,
  matrixMultiply,
  rowProducts,
  columnProducts,
  matrixProduct,
  matrixPower,
  safeMultiply,
  preciseMultiply,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * В ЭТОТ МОДУЛЬ ВЫНЕСЕНЫ СЛЕДУЮЩИЕ ФУНКЦИИ:
 *
 * 1. multiply - базовое умножение двух чисел
 * 2. multiplyAll - умножение нескольких чисел
 * 3. square - возведение в квадрат
 * 4. cube - возведение в куб
 * 5. power - возведение в степень
 * 6. factorial - вычисление факториала
 * 7. product - произведение элементов массива
 * 8. dotProduct - скалярное произведение векторов
 * 9. scalarMultiply - умножение матрицы на число
 * 10. matrixMultiply - умножение матриц
 * 11. rowProducts - произведение по строкам матрицы
 * 12. columnProducts - произведение по столбцам матрицы
 * 13. matrixProduct - произведение всех элементов матрицы
 * 14. matrixPower - возведение матрицы в степень
 * 15. safeMultiply - умножение с проверкой переполнения
 * 16. preciseMultiply - умножение с заданной точностью
 *
 * ВСЕ ФУНКЦИИ СОХРАНЯЮТ ОРИГИНАЛЬНУЮ ЛОГИКУ
 * И ДОБАВЛЕНЫ JSDoc КОММЕНТАРИИ
 */
