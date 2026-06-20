// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/11-edge-cases/modules/missing.js

// ============================================
// МОДУЛЬ ДЛЯ ТЕСТИРОВАНИЯ ОТСУТСТВУЮЩИХ ФУНКЦИЙ
// ============================================
// Этот модуль специально не содержит некоторые функции,
// которые есть в оригинальном файле, для тестирования
// обнаружения отсутствующих функций.

/**
 * Функция сложения - присутствует
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Сумма чисел
 */
function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return a + b;
}

/**
 * Функция вычитания - присутствует
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Разность чисел
 */
function subtract(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return a - b;
}

/**
 * Функция умножения - присутствует
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Произведение чисел
 */
function multiply(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return a * b;
}

/**
 * Функция возведения в степень - присутствует
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени
 * @returns {number} - Результат возведения в степень
 */
function power(base, exponent) {
  if (typeof base !== 'number' || typeof exponent !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return Math.pow(base, exponent);
}

/**
 * Функция вычисления процента - присутствует
 * @param {number} value - Значение
 * @param {number} percentage - Процент
 * @returns {number} - Процент от значения
 */
function getPercentage(value, percentage) {
  if (typeof value !== 'number' || typeof percentage !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return (value * percentage) / 100;
}

// ============================================
// ОТСУТСТВУЮЩИЕ ФУНКЦИИ (для тестирования)
// ============================================

// Следующие функции присутствуют в оригинальном файле,
// но намеренно отсутствуют в этом модуле:

// function divide(a, b) { ... }           // ОТСУТСТВУЕТ
// function calculate(a, b) { ... }        // ОТСУТСТВУЕТ
// function factorial(n) { ... }           // ОТСУТСТВУЕТ
// function fibonacci(n) { ... }           // ОТСУТСТВУЕТ
// function sumRecursive(n) { ... }        // ОТСУТСТВУЕТ
// function isPrime(n) { ... }             // ОТСУТСТВУЕТ
// function gcd(a, b) { ... }              // ОТСУТСТВУЕТ
// function lcm(a, b) { ... }              // ОТСУТСТВУЕТ
// function abs(x) { ... }                 // ОТСУТСТВУЕТ
// function round(x) { ... }               // ОТСУТСТВУЕТ
// function floor(x) { ... }               // ОТСУТСТВУЕТ
// function ceil(x) { ... }                // ОТСУТСТВУЕТ

// ============================================
// ФУНКЦИИ С ИЗМЕНЕННОЙ СИГНАТУРОЙ
// ============================================

/**
 * Функция с измененной сигнатурой (добавлен параметр)
 * В оригинале: function process(a, b)
 * Здесь: function process(a, b, c)
 * @param {number} a - Первый параметр
 * @param {number} b - Второй параметр
 * @param {number} c - Третий параметр (добавлен)
 * @returns {number} - Результат обработки
 */
function process(a, b, c) {
  if (typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number') {
    throw new TypeError('All arguments must be numbers');
  }
  return a + b + c;
}

/**
 * Функция с измененной сигнатурой (изменен тип возврата)
 * В оригинале: function getStatus() { return 'active'; }
 * Здесь: function getStatus() { return true; }
 * @returns {boolean} - Статус (изменен с string на boolean)
 */
function getStatus() {
  return true;
}

/**
 * Функция с измененной сигнатурой (изменен тип параметра)
 * В оригинале: function setValue(value) { ... } // value: number
 * Здесь: function setValue(value) { ... }       // value: string
 * @param {string} value - Значение (изменен тип с number на string)
 * @returns {string} - Обработанное значение
 */
function setValue(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Value must be a string');
  }
  return value.toUpperCase();
}

// ============================================
// НОВЫЕ ФУНКЦИИ (добавлены в рефакторинге)
// ============================================

/**
 * Новая функция, отсутствующая в оригинале
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Среднее арифметическое
 */
function average(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return (a + b) / 2;
}

/**
 * Новая функция, отсутствующая в оригинале
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Квадратный корень суммы квадратов
 */
function hypotenuse(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return Math.sqrt(a * a + b * b);
}

// ============================================
// ФУНКЦИИ С ИЗМЕНЕННОЙ ЛОГИКОЙ
// ============================================

/**
 * Функция с измененной логикой (не эквивалентна оригиналу)
 * В оригинале: function isEven(n) { return n % 2 === 0; }
 * Здесь: function isEven(n) { return n % 2 === 1; } // Инвертирована логика
 * @param {number} n - Число
 * @returns {boolean} - true если число нечетное (изменена логика)
 */
function isEven(n) {
  if (typeof n !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  return n % 2 === 1; // НЕПРАВИЛЬНАЯ ЛОГИКА!
}

/**
 * Функция с измененной логикой (не эквивалентна оригиналу)
 * В оригинале: function max(a, b) { return a > b ? a : b; }
 * Здесь: function max(a, b) { return a < b ? a : b; } // Минимум вместо максимума
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Минимальное значение (изменена логика)
 */
function max(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return a < b ? a : b; // НЕПРАВИЛЬНАЯ ЛОГИКА!
}

/**
 * Функция с измененной логикой (не эквивалентна оригиналу)
 * В оригинале: function clamp(value, min, max) { ... }
 * Здесь: функция всегда возвращает 0
 * @param {number} value - Значение
 * @param {number} min - Минимум
 * @param {number} max - Максимум
 * @returns {number} - Всегда 0 (изменена логика)
 */
function clamp(value, min, max) {
  // НЕПРАВИЛЬНАЯ ЛОГИКА - всегда возвращает 0
  return 0;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

// Экспортируем все функции
export {
  // Существующие функции
  add,
  subtract,
  multiply,
  power,
  getPercentage,

  // Функции с измененной сигнатурой
  process,
  getStatus,
  setValue,

  // Новые функции
  average,
  hypotenuse,

  // Функции с измененной логикой
  isEven,
  max,
  clamp,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями для тестирования
 */
export default {
  add,
  subtract,
  multiply,
  power,
  getPercentage,
  process,
  getStatus,
  setValue,
  average,
  hypotenuse,
  isEven,
  max,
  clamp,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ТЕСТИРОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ДЛЯ ТЕСТИРОВАНИЯ ОТСУТСТВУЮЩИХ ФУНКЦИЙ
 *
 * Этот модуль специально создан для тестирования
 * обнаружения различий между оригинальным и рефакторинг-файлом:
 *
 * 1. ОТСУТСТВУЮЩИЕ ФУНКЦИИ:
 *    - divide - функция деления
 *    - calculate - функция вычисления
 *    - factorial - факториал
 *    - fibonacci - числа Фибоначчи
 *    - sumRecursive - рекурсивная сумма
 *    - isPrime - проверка простоты
 *    - gcd - наибольший общий делитель
 *    - lcm - наименьшее общее кратное
 *    - abs - модуль числа
 *    - round - округление
 *    - floor - округление вниз
 *    - ceil - округление вверх
 *
 * 2. ИЗМЕНЕННЫЕ СИГНАТУРЫ:
 *    - process: добавлен параметр c
 *    - getStatus: изменен тип возврата с string на boolean
 *    - setValue: изменен тип параметра с number на string
 *
 * 3. НОВЫЕ ФУНКЦИИ:
 *    - average - среднее арифметическое
 *    - hypotenuse - гипотенуза
 *
 * 4. ИЗМЕНЕННАЯ ЛОГИКА:
 *    - isEven: инвертирована логика (проверка на нечетность)
 *    - max: возвращает минимум вместо максимума
 *    - clamp: всегда возвращает 0
 *
 * Тесты должны обнаружить:
 * - Отсутствующие функции
 * - Изменения сигнатур
 * - Новые функции (как предупреждение)
 * - Изменения логики (через формальную верификацию)
 */
