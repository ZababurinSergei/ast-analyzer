// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/10-mixed-operations/modules/math.js

// ============================================
// МОДУЛЬ МАТЕМАТИЧЕСКИХ ОПЕРАЦИЙ
// ============================================
// Этот модуль содержит базовые математические операции
// для использования в смешанных операциях.

/**
 * Сложение двух чисел
 * Сложность: O(1) время, O(1) память
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Сумма a и b
 * @throws {TypeError} - Если аргументы не являются числами
 */
function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (isNaN(a) || isNaN(b)) {
    throw new TypeError('Arguments must be valid numbers');
  }
  return a + b;
}

/**
 * Вычитание двух чисел
 * Сложность: O(1) время, O(1) память
 * @param {number} a - Первое число (уменьшаемое)
 * @param {number} b - Второе число (вычитаемое)
 * @returns {number} - Разность a и b
 * @throws {TypeError} - Если аргументы не являются числами
 */
function subtract(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (isNaN(a) || isNaN(b)) {
    throw new TypeError('Arguments must be valid numbers');
  }
  return a - b;
}

/**
 * Умножение двух чисел
 * Сложность: O(1) время, O(1) память
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Произведение a и b
 * @throws {TypeError} - Если аргументы не являются числами
 */
function multiply(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (isNaN(a) || isNaN(b)) {
    throw new TypeError('Arguments must be valid numbers');
  }
  return a * b;
}

/**
 * Деление двух чисел
 * Сложность: O(1) время, O(1) память
 * @param {number} a - Первое число (делимое)
 * @param {number} b - Второе число (делитель)
 * @returns {number} - Частное a и b
 * @throws {TypeError} - Если аргументы не являются числами
 * @throws {Error} - Если b равно 0
 */
function divide(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (isNaN(a) || isNaN(b)) {
    throw new TypeError('Arguments must be valid numbers');
  }
  if (b === 0) {
    throw new Error('Division by zero is not allowed');
  }
  return a / b;
}

/**
 * Возведение в степень
 * Сложность: O(log n) время, O(1) память (быстрое возведение в степень)
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени
 * @returns {number} - base в степени exponent
 * @throws {TypeError} - Если аргументы не являются числами
 */
function power(base, exponent) {
  if (typeof base !== 'number' || typeof exponent !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (isNaN(base) || isNaN(exponent)) {
    throw new TypeError('Arguments must be valid numbers');
  }

  // Обработка специальных случаев
  if (exponent === 0) return 1;
  if (base === 0) {
    if (exponent < 0) throw new Error('Cannot raise 0 to negative power');
    return 0;
  }
  if (exponent === 1) return base;

  // Быстрое возведение в степень для целых положительных показателей
  if (Number.isInteger(exponent) && exponent > 0) {
    return fastPower(base, exponent);
  }

  // Для дробных и отрицательных показателей используем Math.pow
  return Math.pow(base, exponent);
}

/**
 * Быстрое возведение в степень (рекурсивное)
 * @private
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени (целое положительное)
 * @returns {number} - base в степени exponent
 */
function fastPower(base, exponent) {
  if (exponent === 0) return 1;
  if (exponent === 1) return base;

  const half = fastPower(base, Math.floor(exponent / 2));
  if (exponent % 2 === 0) {
    return multiply(half, half);
  } else {
    return multiply(multiply(half, half), base);
  }
}

/**
 * Квадратный корень числа
 * Сложность: O(1) время, O(1) память
 * @param {number} x - Число для извлечения корня
 * @returns {number} - Квадратный корень из x
 * @throws {TypeError} - Если аргумент не является числом
 * @throws {Error} - Если x отрицательное
 */
function squareRoot(x) {
  if (typeof x !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  if (isNaN(x)) {
    throw new TypeError('Argument must be a valid number');
  }
  if (x < 0) {
    throw new Error('Cannot calculate square root of negative number');
  }
  return Math.sqrt(x);
}

/**
 * Факториал числа
 * Сложность: O(n) время, O(1) память (итеративный)
 * @param {number} n - Число для вычисления факториала
 * @returns {number} - Факториал n
 * @throws {TypeError} - Если аргумент не является числом
 * @throws {Error} - Если n не является неотрицательным целым числом
 */
function factorial(n) {
  if (typeof n !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('n must be a non-negative integer');
  }
  if (n === 0 || n === 1) return 1;

  let result = 1;
  for (let i = 2; i <= n; i++) {
    result = multiply(result, i);
  }
  return result;
}

/**
 * Числа Фибоначчи (итеративная версия)
 * Сложность: O(n) время, O(1) память
 * @param {number} n - Позиция в последовательности
 * @returns {number} - n-е число Фибоначчи
 * @throws {TypeError} - Если аргумент не является числом
 * @throws {Error} - Если n не является неотрицательным целым числом
 */
function fibonacci(n) {
  if (typeof n !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('n must be a non-negative integer');
  }
  if (n <= 1) return n;

  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = add(a, b);
    a = b;
    b = temp;
  }
  return b;
}

/**
 * Наибольший общий делитель (алгоритм Евклида)
 * Сложность: O(log min(a, b)) время, O(1) память
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - НОД a и b
 * @throws {TypeError} - Если аргументы не являются числами
 */
function gcd(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new TypeError('Arguments must be integers');
  }

  a = Math.abs(a);
  b = Math.abs(b);

  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Наименьшее общее кратное
 * Сложность: O(log min(a, b)) время, O(1) память
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - НОК a и b
 * @throws {TypeError} - Если аргументы не являются числами
 */
function lcm(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new TypeError('Arguments must be integers');
  }
  if (a === 0 || b === 0) return 0;

  return Math.abs(multiply(a, b)) / gcd(a, b);
}

/**
 * Проверка, является ли число простым
 * Сложность: O(√n) время, O(1) память
 * @param {number} n - Число для проверки
 * @returns {boolean} - true если число простое
 * @throws {TypeError} - Если аргумент не является числом
 */
function isPrime(n) {
  if (typeof n !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  if (!Number.isInteger(n) || n < 2) {
    return false;
  }
  if (n === 2) return true;
  if (n % 2 === 0) return false;

  const sqrt = Math.sqrt(n);
  for (let i = 3; i <= sqrt; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Проверка, является ли число четным
 * @param {number} n - Число для проверки
 * @returns {boolean} - true если число четное
 */
function isEven(n) {
  if (typeof n !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  return n % 2 === 0;
}

/**
 * Проверка, является ли число нечетным
 * @param {number} n - Число для проверки
 * @returns {boolean} - true если число нечетное
 */
function isOdd(n) {
  if (typeof n !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  return n % 2 !== 0;
}

/**
 * Ограничение числа в диапазоне
 * @param {number} value - Значение для ограничения
 * @param {number} min - Минимальное значение
 * @param {number} max - Максимальное значение
 * @returns {number} - Ограниченное значение
 */
function clamp(value, min, max) {
  if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  if (min > max) {
    throw new Error('min must be less than or equal to max');
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Линейная интерполяция
 * @param {number} a - Начальное значение
 * @param {number} b - Конечное значение
 * @param {number} t - Параметр интерполяции (0-1)
 * @returns {number} - Интерполированное значение
 */
function lerp(a, b, t) {
  if (typeof a !== 'number' || typeof b !== 'number' || typeof t !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  return add(a, multiply(subtract(b, a), clamp(t, 0, 1)));
}

/**
 * Преобразование значения из одного диапазона в другой
 * @param {number} value - Значение для преобразования
 * @param {number} fromMin - Минимум исходного диапазона
 * @param {number} fromMax - Максимум исходного диапазона
 * @param {number} toMin - Минимум целевого диапазона
 * @param {number} toMax - Максимум целевого диапазона
 * @returns {number} - Преобразованное значение
 */
function mapRange(value, fromMin, fromMax, toMin, toMax) {
  if (
    typeof value !== 'number' ||
    typeof fromMin !== 'number' ||
    typeof fromMax !== 'number' ||
    typeof toMin !== 'number' ||
    typeof toMax !== 'number'
  ) {
    throw new TypeError('All arguments must be numbers');
  }
  if (fromMin === fromMax) {
    throw new Error('fromMin and fromMax cannot be equal');
  }

  const t = divide(subtract(value, fromMin), subtract(fromMax, fromMin));
  return add(toMin, multiply(subtract(toMax, toMin), clamp(t, 0, 1)));
}

/**
 * Вычисление среднего арифметического
 * @param {Array<number>} numbers - Массив чисел
 * @returns {number} - Среднее арифметическое
 */
function mean(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new TypeError('Expected a non-empty array of numbers');
  }

  let sum = 0;
  for (const num of numbers) {
    if (typeof num !== 'number' || isNaN(num)) {
      throw new TypeError('All elements must be valid numbers');
    }
    sum = add(sum, num);
  }
  return divide(sum, numbers.length);
}

/**
 * Вычисление медианы
 * @param {Array<number>} numbers - Массив чисел
 * @returns {number} - Медиана
 */
function median(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new TypeError('Expected a non-empty array of numbers');
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return divide(add(sorted[mid - 1], sorted[mid]), 2);
  }
  return sorted[mid];
}

/**
 * Вычисление дисперсии
 * @param {Array<number>} numbers - Массив чисел
 * @param {boolean} sample - true для выборочной дисперсии, false для генеральной
 * @returns {number} - Дисперсия
 */
function variance(numbers, sample = false) {
  if (!Array.isArray(numbers) || numbers.length < 2) {
    throw new TypeError('Expected an array with at least 2 numbers');
  }

  const avg = mean(numbers);
  let sumSquares = 0;
  for (const num of numbers) {
    const diff = subtract(num, avg);
    sumSquares = add(sumSquares, multiply(diff, diff));
  }

  const divisor = sample ? subtract(numbers.length, 1) : numbers.length;
  return divide(sumSquares, divisor);
}

/**
 * Вычисление стандартного отклонения
 * @param {Array<number>} numbers - Массив чисел
 * @param {boolean} sample - true для выборочного отклонения
 * @returns {number} - Стандартное отклонение
 */
function standardDeviation(numbers, sample = false) {
  return squareRoot(variance(numbers, sample));
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые операции
  add,
  subtract,
  multiply,
  divide,

  // Степенные функции
  power,
  fastPower,
  squareRoot,

  // Комбинаторные функции
  factorial,
  fibonacci,

  // Теория чисел
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd,

  // Утилиты
  clamp,
  lerp,
  mapRange,

  // Статистика
  mean,
  median,
  variance,
  standardDeviation,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с математическими функциями
 */
export default {
  add,
  subtract,
  multiply,
  divide,
  power,
  fastPower,
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
  mean,
  median,
  variance,
  standardDeviation,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ МАТЕМАТИЧЕСКИХ ОПЕРАЦИЙ
 *
 * Этот модуль предоставляет 21 математическую функцию:
 *
 * 1. add              - Сложение
 * 2. subtract         - Вычитание
 * 3. multiply         - Умножение
 * 4. divide           - Деление
 * 5. power            - Возведение в степень
 * 6. fastPower        - Быстрое возведение в степень
 * 7. squareRoot       - Квадратный корень
 * 8. factorial        - Факториал
 * 9. fibonacci        - Числа Фибоначчи
 * 10. gcd             - Наибольший общий делитель
 * 11. lcm             - Наименьшее общее кратное
 * 12. isPrime         - Проверка на простоту
 * 13. isEven          - Проверка на четность
 * 14. isOdd           - Проверка на нечетность
 * 15. clamp           - Ограничение в диапазоне
 * 16. lerp            - Линейная интерполяция
 * 17. mapRange        - Преобразование диапазона
 * 18. mean            - Среднее арифметическое
 * 19. median          - Медиана
 * 20. variance        - Дисперсия
 * 21. standardDeviation - Стандартное отклонение
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Обрабатывают граничные случаи
 * - Имеют JSDoc с описанием сложности
 * - Используют другие функции модуля для композиции
 * - Поддерживают цепочки вызовов через композицию
 */
