// packages/ast-analyzer/src/formal/__tests__/fixtures/original/01-math-operations.js

/**
 * Базовые математические операции
 * Этот файл содержит набор математических функций, которые будут
 * протестированы на эквивалентность после рефакторинга
 */

/**
 * Сложение двух чисел
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} сумма
 */
function add(a, b) {
  return a + b;
}

/**
 * Вычитание двух чисел
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} разность
 */
function subtract(a, b) {
  return a - b;
}

/**
 * Умножение двух чисел
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} произведение
 */
function multiply(a, b) {
  return a * b;
}

/**
 * Деление двух чисел
 * @param {number} a - делимое
 * @param {number} b - делитель
 * @returns {number} частное
 * @throws {Error} если делитель равен нулю
 */
function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

/**
 * Возведение в степень
 * @param {number} base - основание
 * @param {number} exponent - показатель степени
 * @returns {number} результат возведения в степень
 */
function power(base, exponent) {
  if (exponent === 0) {
    return 1;
  }
  if (exponent < 0) {
    return 1 / power(base, -exponent);
  }
  let result = 1;
  for (let i = 0; i < exponent; i++) {
    result *= base;
  }
  return result;
}

/**
 * Вычисление факториала числа
 * @param {number} n - число для вычисления факториала
 * @returns {number} факториал числа
 */
function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

/**
 * Вычисление модуля числа
 * @param {number} x - число
 * @returns {number} абсолютное значение
 */
function abs(x) {
  if (x < 0) {
    return -x;
  }
  return x;
}

/**
 * Вычисление максимального из двух чисел
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} максимальное число
 */
function max(a, b) {
  return a > b ? a : b;
}

/**
 * Вычисление минимального из двух чисел
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} минимальное число
 */
function min(a, b) {
  return a < b ? a : b;
}

/**
 * Вычисление среднего арифметического двух чисел
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} среднее арифметическое
 */
function average(a, b) {
  return (a + b) / 2;
}

/**
 * Вычисление остатка от деления
 * @param {number} a - делимое
 * @param {number} b - делитель
 * @returns {number} остаток от деления
 * @throws {Error} если делитель равен нулю
 */
function modulo(a, b) {
  if (b === 0) {
    throw new Error('Modulo by zero');
  }
  return a % b;
}

/**
 * Сложная функция, использующая другие математические операции
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @param {number} c - третье число
 * @returns {number} результат вычислений
 */
function complexCalculation(a, b, c) {
  const sum = add(a, b);
  const diff = subtract(sum, c);
  const product = multiply(diff, c);
  const quotient = divide(product, 2);
  const remainder = modulo(quotient, 3);
  return abs(remainder);
}

/**
 * Проверка числа на четность
 * @param {number} n - число для проверки
 * @returns {boolean} true если число четное
 */
function isEven(n) {
  return n % 2 === 0;
}

/**
 * Проверка числа на нечетность
 * @param {number} n - число для проверки
 * @returns {boolean} true если число нечетное
 */
function isOdd(n) {
  return n % 2 !== 0;
}

/**
 * Проверка числа на положительность
 * @param {number} n - число для проверки
 * @returns {boolean} true если число положительное
 */
function isPositive(n) {
  return n > 0;
}

/**
 * Проверка числа на отрицательность
 * @param {number} n - число для проверки
 * @returns {boolean} true если число отрицательное
 */
function isNegative(n) {
  return n < 0;
}

/**
 * Проверка числа на ноль
 * @param {number} n - число для проверки
 * @returns {boolean} true если число равно нулю
 */
function isZero(n) {
  return n === 0;
}

/**
 * Округление числа вверх
 * @param {number} x - число для округления
 * @returns {number} округленное вверх число
 */
function ceil(x) {
  if (Number.isInteger(x)) {
    return x;
  }
  if (x > 0) {
    return Math.floor(x) + 1;
  }
  return Math.floor(x);
}

/**
 * Округление числа вниз
 * @param {number} x - число для округления
 * @returns {number} округленное вниз число
 */
function floor(x) {
  if (Number.isInteger(x)) {
    return x;
  }
  if (x > 0) {
    return Math.floor(x);
  }
  return Math.floor(x) - 1;
}

/**
 * Округление числа до ближайшего целого
 * @param {number} x - число для округления
 * @returns {number} округленное число
 */
function round(x) {
  if (Number.isInteger(x)) {
    return x;
  }
  const fractional = x - Math.floor(x);
  if (fractional < 0.5) {
    return floor(x);
  }
  return ceil(x);
}

// Экспорт всех функций
export {
  add,
  subtract,
  multiply,
  divide,
  power,
  factorial,
  abs,
  max,
  min,
  average,
  modulo,
  complexCalculation,
  isEven,
  isOdd,
  isPositive,
  isNegative,
  isZero,
  ceil,
  floor,
  round,
};
