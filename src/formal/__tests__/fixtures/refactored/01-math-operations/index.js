// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/01-math-operations/index.js

// ============================================
// МАТЕМАТИЧЕСКИЕ ОПЕРАЦИИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все математические операции вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт базовых математических операций из модулей
import { add } from './modules/addition.js';
import { subtract } from './modules/subtraction.js';
import { multiply } from './modules/multiplication.js';
import { divide } from './modules/division.js';

// Импорт расширенных математических функций
import {
  power,
  squareRoot,
  factorial,
  fibonacci,
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd,
  clamp,
  lerp,
  mapRange,
} from './modules/advanced-math.js';

// Импорт статистических функций
import {
  mean,
  median,
  mode,
  variance,
  standardDeviation,
  min,
  max,
  sum,
  product,
  range as statsRange,
} from './modules/statistics.js';

// Импорт функций для работы с комплексными числами
import {
  Complex,
  addComplex,
  subtractComplex,
  multiplyComplex,
  divideComplex,
  magnitude,
  phase,
  conjugate,
} from './modules/complex.js';

// ============================================
// ОСНОВНЫЕ МАТЕМАТИЧЕСКИЕ ОПЕРАЦИИ
// ============================================

/**
 * Вычисляет выражение с использованием основных операций
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @param {string} operation - Операция (add, subtract, multiply, divide)
 * @returns {number} - Результат операции
 */
function calculate(a, b, operation = 'add') {
  switch (operation) {
    case 'add':
      return add(a, b);
    case 'subtract':
      return subtract(a, b);
    case 'multiply':
      return multiply(a, b);
    case 'divide':
      return divide(a, b);
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Вычисляет сложное выражение: (a + b) * (a - b)
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Результат вычисления
 */
function calculateDifferenceProduct(a, b) {
  return multiply(add(a, b), subtract(a, b));
}

/**
 * Вычисляет выражение: a^2 + b^2
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Результат вычисления
 */
function calculateSumOfSquares(a, b) {
  return add(power(a, 2), power(b, 2));
}

/**
 * Вычисляет выражение: (a + b)^2
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Результат вычисления
 */
function calculateSquareOfSum(a, b) {
  return power(add(a, b), 2);
}

// ============================================
// ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ
// ============================================

/**
 * Вычисляет гипотенузу прямоугольного треугольника
 * @param {number} a - Первый катет
 * @param {number} b - Второй катет
 * @returns {number} - Длина гипотенузы
 */
function calculateHypotenuse(a, b) {
  return squareRoot(add(power(a, 2), power(b, 2)));
}

/**
 * Вычисляет угол между двумя векторами
 * @param {number} x1 - X координата первого вектора
 * @param {number} y1 - Y координата первого вектора
 * @param {number} x2 - X координата второго вектора
 * @param {number} y2 - Y координата второго вектора
 * @returns {number} - Угол в радианах
 */
function angleBetweenVectors(x1, y1, x2, y2) {
  const dot = add(multiply(x1, x2), multiply(y1, y2));
  const mag1 = calculateHypotenuse(x1, y1);
  const mag2 = calculateHypotenuse(x2, y2);
  const cosAngle = divide(dot, multiply(mag1, mag2));
  return Math.acos(clamp(cosAngle, -1, 1));
}

// ============================================
// СТАТИСТИЧЕСКИЕ ФУНКЦИИ
// ============================================

/**
 * Вычисляет базовую статистику для массива чисел
 * @param {number[]} numbers - Массив чисел
 * @returns {Object} - Объект со статистическими показателями
 */
function calculateStatistics(numbers) {
  if (!numbers || numbers.length === 0) {
    throw new Error('Array must not be empty');
  }

  return {
    count: numbers.length,
    sum: sum(numbers),
    mean: mean(numbers),
    median: median(numbers),
    mode: mode(numbers),
    variance: variance(numbers),
    standardDeviation: standardDeviation(numbers),
    min: min(numbers),
    max: max(numbers),
    range: statsRange(numbers),
  };
}

/**
 * Нормализует массив чисел к диапазону [0, 1]
 * @param {number[]} numbers - Массив чисел
 * @returns {number[]} - Нормализованный массив
 */
function normalizeArray(numbers) {
  if (!numbers || numbers.length === 0) {
    return [];
  }

  const minVal = min(numbers);
  const maxVal = max(numbers);
  const range = subtract(maxVal, minVal);

  if (range === 0) {
    return numbers.map(() => 0);
  }

  return numbers.map(value => divide(subtract(value, minVal), range));
}

/**
 * Стандартизирует массив чисел (z-score)
 * @param {number[]} numbers - Массив чисел
 * @returns {number[]} - Стандартизированный массив
 */
function standardizeArray(numbers) {
  if (!numbers || numbers.length === 0) {
    return [];
  }

  const meanVal = mean(numbers);
  const stdDev = standardDeviation(numbers);

  if (stdDev === 0) {
    return numbers.map(() => 0);
  }

  return numbers.map(value => divide(subtract(value, meanVal), stdDev));
}

// ============================================
// КОМПЛЕКСНЫЕ ЧИСЛА
// ============================================

/**
 * Создает комплексное число
 * @param {number} real - Действительная часть
 * @param {number} imag - Мнимая часть
 * @returns {Complex} - Комплексное число
 */
function createComplex(real, imag = 0) {
  return new Complex(real, imag);
}

/**
 * Выполняет операции с комплексными числами
 * @param {Complex} c1 - Первое комплексное число
 * @param {Complex} c2 - Второе комплексное число
 * @param {string} operation - Операция (add, subtract, multiply, divide)
 * @returns {Complex} - Результат операции
 */
function complexOperation(c1, c2, operation = 'add') {
  switch (operation) {
    case 'add':
      return addComplex(c1, c2);
    case 'subtract':
      return subtractComplex(c1, c2);
    case 'multiply':
      return multiplyComplex(c1, c2);
    case 'divide':
      return divideComplex(c1, c2);
    default:
      throw new Error(`Unknown complex operation: ${operation}`);
  }
}

/**
 * Вычисляет модуль и фазу комплексного числа
 * @param {Complex} c - Комплексное число
 * @returns {Object} - Объект с модулем и фазой
 */
function getComplexPolar(c) {
  return {
    magnitude: magnitude(c),
    phase: phase(c),
    conjugate: conjugate(c),
  };
}

// ============================================
// КОМБИНИРОВАННЫЕ ОПЕРАЦИИ
// ============================================

/**
 * Вычисляет расстояние между двумя точками в 3D пространстве
 * @param {number} x1 - X координата первой точки
 * @param {number} y1 - Y координата первой точки
 * @param {number} z1 - Z координата первой точки
 * @param {number} x2 - X координата второй точки
 * @param {number} y2 - Y координата второй точки
 * @param {number} z2 - Z координата второй точки
 * @returns {number} - Расстояние между точками
 */
function distance3D(x1, y1, z1, x2, y2, z2) {
  const dx = subtract(x2, x1);
  const dy = subtract(y2, y1);
  const dz = subtract(z2, z1);
  return squareRoot(add(add(power(dx, 2), power(dy, 2)), power(dz, 2)));
}

/**
 * Вычисляет скалярное произведение двух векторов
 * @param {number[]} v1 - Первый вектор
 * @param {number[]} v2 - Второй вектор
 * @returns {number} - Скалярное произведение
 */
function dotProduct(v1, v2) {
  if (v1.length !== v2.length) {
    throw new Error('Vectors must have same length');
  }

  let result = 0;
  for (let i = 0; i < v1.length; i++) {
    result = add(result, multiply(v1[i], v2[i]));
  }
  return result;
}

/**
 * Вычисляет длину вектора
 * @param {number[]} vector - Вектор
 * @returns {number} - Длина вектора
 */
function vectorLength(vector) {
  let sumOfSquares = 0;
  for (const value of vector) {
    sumOfSquares = add(sumOfSquares, power(value, 2));
  }
  return squareRoot(sumOfSquares);
}

/**
 * Нормализует вектор
 * @param {number[]} vector - Вектор
 * @returns {number[]} - Нормализованный вектор
 */
function normalizeVector(vector) {
  const length = vectorLength(vector);
  if (length === 0) {
    return vector.map(() => 0);
  }
  return vector.map(value => divide(value, length));
}

/**
 * Вычисляет косинусное сходство между двумя векторами
 * @param {number[]} v1 - Первый вектор
 * @param {number[]} v2 - Второй вектор
 * @returns {number} - Косинусное сходство
 */
function cosineSimilarity(v1, v2) {
  const dot = dotProduct(v1, v2);
  const mag1 = vectorLength(v1);
  const mag2 = vectorLength(v2);

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  return divide(dot, multiply(mag1, mag2));
}

// ============================================
// МАТРИЧНЫЕ ОПЕРАЦИИ
// ============================================

/**
 * Умножает две матрицы
 * @param {number[][]} m1 - Первая матрица
 * @param {number[][]} m2 - Вторая матрица
 * @returns {number[][]} - Результат умножения
 */
function matrixMultiply(m1, m2) {
  if (m1[0].length !== m2.length) {
    throw new Error('Invalid matrix dimensions');
  }

  const result = [];
  for (let i = 0; i < m1.length; i++) {
    result[i] = [];
    for (let j = 0; j < m2[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < m1[0].length; k++) {
        sum = add(sum, multiply(m1[i][k], m2[k][j]));
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Транспонирует матрицу
 * @param {number[][]} matrix - Матрица
 * @returns {number[][]} - Транспонированная матрица
 */
function matrixTranspose(matrix) {
  const result = [];
  for (let j = 0; j < matrix[0].length; j++) {
    result[j] = [];
    for (let i = 0; i < matrix.length; i++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт основных операций
export {
  // Базовые операции
  add,
  subtract,
  multiply,
  divide,

  // Расширенные функции
  power,
  squareRoot,
  factorial,
  fibonacci,
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd,
  clamp,
  lerp,
  mapRange,

  // Статистика
  mean,
  median,
  mode,
  variance,
  standardDeviation,
  min,
  max,
  sum,
  product,
  statsRange as range,

  // Комплексные числа
  Complex,
  addComplex,
  subtractComplex,
  multiplyComplex,
  divideComplex,
  magnitude,
  phase,
  conjugate,

  // Комбинированные операции
  calculate,
  calculateDifferenceProduct,
  calculateSumOfSquares,
  calculateSquareOfSum,
  calculateHypotenuse,
  angleBetweenVectors,
  calculateStatistics,
  normalizeArray,
  standardizeArray,
  createComplex,
  complexOperation,
  getComplexPolar,
  distance3D,
  dotProduct,
  vectorLength,
  normalizeVector,
  cosineSimilarity,
  matrixMultiply,
  matrixTranspose,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с математическими функциями
 */
export default {
  // Базовые операции
  add,
  subtract,
  multiply,
  divide,

  // Расширенные функции
  power,
  squareRoot,
  factorial,
  fibonacci,
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd,
  clamp,
  lerp,
  mapRange,

  // Статистика
  mean,
  median,
  mode,
  variance,
  standardDeviation,
  min,
  max,
  sum,
  product,
  range: statsRange,

  // Комплексные числа
  Complex,
  addComplex,
  subtractComplex,
  multiplyComplex,
  divideComplex,
  magnitude,
  phase,
  conjugate,

  // Комбинированные операции
  calculate,
  calculateDifferenceProduct,
  calculateSumOfSquares,
  calculateSquareOfSum,
  calculateHypotenuse,
  angleBetweenVectors,
  calculateStatistics,
  normalizeArray,
  standardizeArray,
  createComplex,
  complexOperation,
  getComplexPolar,
  distance3D,
  dotProduct,
  vectorLength,
  normalizeVector,
  cosineSimilarity,
  matrixMultiply,
  matrixTranspose,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Базовые операции вынесены в отдельные модули:
 *    - addition.js - сложение
 *    - subtraction.js - вычитание
 *    - multiplication.js - умножение
 *    - division.js - деление
 *
 * 2. Расширенные функции вынесены в advanced-math.js:
 *    - Степенные функции (power, squareRoot)
 *    - Комбинаторные функции (factorial, fibonacci)
 *    - Теория чисел (gcd, lcm, isPrime)
 *    - Утилиты (isEven, isOdd, clamp, lerp, mapRange)
 *
 * 3. Статистические функции вынесены в statistics.js:
 *    - mean, median, mode
 *    - variance, standardDeviation
 *    - min, max, sum, product, range
 *
 * 4. Комплексные числа вынесены в complex.js:
 *    - Класс Complex
 *    - Операции с комплексными числами
 *    - magnitude, phase, conjugate
 *
 * 5. Комбинированные операции остаются в index.js:
 *    - calculate
 *    - calculateDifferenceProduct
 *    - calculateSumOfSquares
 *    - calculateSquareOfSum
 *    - calculateHypotenuse
 *    - angleBetweenVectors
 *    - calculateStatistics
 *    - normalizeArray
 *    - standardizeArray
 *    - createComplex
 *    - complexOperation
 *    - getComplexPolar
 *    - distance3D
 *    - dotProduct
 *    - vectorLength
 *    - normalizeVector
 *    - cosineSimilarity
 *    - matrixMultiply
 *    - matrixTranspose
 *
 * 6. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 7. Добавлены JSDoc комментарии для всех функций
 *
 * 8. Сохранена обратная совместимость через реэкспорты
 */
