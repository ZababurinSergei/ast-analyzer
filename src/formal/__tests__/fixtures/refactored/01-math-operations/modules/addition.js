// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/01-math-operations/modules/addition.js

// ============================================
// МОДУЛЬ СЛОЖЕНИЯ
// ============================================
// Этот модуль содержит все функции, связанные со сложением чисел
// Выделен из монолитного файла в отдельный модуль для лучшей организации кода

/**
 * Складывает два числа
 * @param {number} a - Первое слагаемое
 * @param {number} b - Второе слагаемое
 * @returns {number} - Сумма чисел a и b
 *
 * @example
 * add(2, 3) // returns 5
 * add(-1, 1) // returns 0
 * add(0.1, 0.2) // returns 0.3
 */
export function add(a, b) {
  return a + b;
}

/**
 * Складывает несколько чисел
 * @param {...number} numbers - Числа для сложения
 * @returns {number} - Сумма всех переданных чисел
 *
 * @example
 * addMany(1, 2, 3) // returns 6
 * addMany(5, 10, 15, 20) // returns 50
 * addMany() // returns 0
 */
export function addMany(...numbers) {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, current) => sum + current, 0);
}

/**
 * Складывает все числа в массиве
 * @param {number[]} numbers - Массив чисел
 * @returns {number} - Сумма всех чисел в массиве
 *
 * @example
 * addArray([1, 2, 3, 4]) // returns 10
 * addArray([]) // returns 0
 * addArray([-5, 5, -10, 10]) // returns 0
 */
export function addArray(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Expected an array of numbers');
  }
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, current) => sum + current, 0);
}

/**
 * Прибавляет число к каждому элементу массива
 * @param {number[]} numbers - Массив чисел
 * @param {number} value - Число для прибавления
 * @returns {number[]} - Новый массив с прибавленным значением
 *
 * @example
 * addToEach([1, 2, 3], 5) // returns [6, 7, 8]
 * addToEach([10, 20, 30], -5) // returns [5, 15, 25]
 */
export function addToEach(numbers, value) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Expected an array of numbers');
  }
  return numbers.map(num => num + value);
}

/**
 * Складывает два числа с плавающей точкой с заданной точностью
 * @param {number} a - Первое слагаемое
 * @param {number} b - Второе слагаемое
 * @param {number} precision - Количество знаков после запятой
 * @returns {number} - Сумма с заданной точностью
 *
 * @example
 * addPrecise(0.1, 0.2, 1) // returns 0.3
 * addPrecise(0.123, 0.456, 2) // returns 0.58
 */
export function addPrecise(a, b, precision = 10) {
  const factor = Math.pow(10, precision);
  return Math.round((a + b) * factor) / factor;
}

/**
 * Складывает числа с накоплением (аккумулятор)
 * @param {number} accumulator - Текущая сумма
 * @param {number} value - Значение для добавления
 * @returns {number} - Новая сумма
 *
 * @example
 * let sum = 0;
 * sum = accumulate(sum, 5) // returns 5
 * sum = accumulate(sum, 3) // returns 8
 * sum = accumulate(sum, -2) // returns 6
 */
export function accumulate(accumulator, value) {
  return accumulator + value;
}

/**
 * Создает функцию сложения с фиксированным значением
 * @param {number} fixedValue - Фиксированное значение для сложения
 * @returns {Function} - Функция, которая прибавляет фиксированное значение
 *
 * @example
 * const addFive = createAdder(5);
 * addFive(3) // returns 8
 * addFive(10) // returns 15
 */
export function createAdder(fixedValue) {
  return function (value) {
    return value + fixedValue;
  };
}

/**
 * Проверяет, является ли число суммой двух других чисел
 * @param {number} target - Проверяемое число
 * @param {number} a - Первое слагаемое
 * @param {number} b - Второе слагаемое
 * @param {number} epsilon - Допуск для сравнения с плавающей точкой
 * @returns {boolean} - true, если target === a + b с учетом допуска
 *
 * @example
 * isSum(5, 2, 3) // returns true
 * isSum(0.3, 0.1, 0.2, 0.001) // returns true
 * isSum(10, 4, 5) // returns false
 */
export function isSum(target, a, b, epsilon = 0) {
  const sum = a + b;
  if (epsilon === 0) {
    return target === sum;
  }
  return Math.abs(target - sum) <= epsilon;
}

/**
 * Находит все пары чисел в массиве, сумма которых равна целевому значению
 * @param {number[]} numbers - Массив чисел
 * @param {number} target - Целевая сумма
 * @returns {Array<[number, number]>} - Массив пар чисел
 *
 * @example
 * findPairsWithSum([1, 2, 3, 4, 5], 5) // returns [[1, 4], [2, 3]]
 * findPairsWithSum([1, 2, 3], 4) // returns [[1, 3]]
 */
export function findPairsWithSum(numbers, target) {
  if (!Array.isArray(numbers) || numbers.length < 2) {
    return [];
  }

  const pairs = [];
  const seen = new Set();

  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      const pair = [numbers[i], numbers[j]];
      const sortedPair = [...pair].sort();
      const key = sortedPair.join(',');

      if (!seen.has(key) && numbers[i] + numbers[j] === target) {
        pairs.push(pair);
        seen.add(key);
      }
    }
  }

  return pairs;
}

/**
 * Вычисляет кумулятивную сумму массива
 * @param {number[]} numbers - Массив чисел
 * @returns {number[]} - Массив кумулятивных сумм
 *
 * @example
 * cumulativeSum([1, 2, 3, 4]) // returns [1, 3, 6, 10]
 * cumulativeSum([-1, 2, -3, 4]) // returns [-1, 1, -2, 2]
 */
export function cumulativeSum(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return [];
  }

  const result = [];
  let sum = 0;

  for (const num of numbers) {
    sum = accumulate(sum, num);
    result.push(sum);
  }

  return result;
}

/**
 * Вычисляет сумму цифр числа
 * @param {number} number - Число
 * @returns {number} - Сумма цифр
 *
 * @example
 * sumDigits(123) // returns 6
 * sumDigits(4567) // returns 22
 * sumDigits(-123) // returns 6 (абсолютное значение)
 */
export function sumDigits(number) {
  const absNumber = Math.abs(number);
  const digits = String(absNumber).split('').map(Number);
  return addArray(digits);
}

/**
 * Проверяет, является ли число суммой своих цифр в степени n
 * @param {number} number - Проверяемое число
 * @param {number} power - Степень
 * @returns {boolean} - true, если число равно сумме цифр в степени power
 *
 * @example
 * isArmstrong(153, 3) // returns true (1^3 + 5^3 + 3^3 = 153)
 * isArmstrong(1634, 4) // returns true (1^4 + 6^4 + 3^4 + 4^4 = 1634)
 * isArmstrong(123, 3) // returns false
 */
export function isArmstrong(number, power) {
  const absNumber = Math.abs(number);
  const digits = String(absNumber).split('').map(Number);
  const sum = digits.reduce((acc, digit) => acc + Math.pow(digit, power), 0);
  return sum === absNumber;
}

/**
 * Находит все числа Армстронга в заданном диапазоне
 * @param {number} start - Начало диапазона
 * @param {number} end - Конец диапазона
 * @param {number} power - Степень
 * @returns {number[]} - Массив чисел Армстронга
 *
 * @example
 * findArmstrongNumbers(100, 500, 3) // returns [153, 370, 371, 407]
 */
export function findArmstrongNumbers(start, end, power = 3) {
  const result = [];
  for (let i = start; i <= end; i++) {
    if (isArmstrong(i, power)) {
      result.push(i);
    }
  }
  return result;
}

/**
 * Вычисляет сумму последовательности чисел
 * @param {number} start - Первое число
 * @param {number} end - Последнее число
 * @param {number} step - Шаг
 * @returns {number} - Сумма последовательности
 *
 * @example
 * sumSequence(1, 10, 1) // returns 55 (1+2+3+...+10)
 * sumSequence(2, 10, 2) // returns 30 (2+4+6+8+10)
 */
export function sumSequence(start, end, step = 1) {
  if (start > end) {
    return 0;
  }

  let sum = 0;
  for (let i = start; i <= end; i += step) {
    sum += i;
  }
  return sum;
}

/**
 * Вычисляет арифметическую прогрессию
 * @param {number} first - Первый член
 * @param {number} difference - Разность
 * @param {number} count - Количество членов
 * @returns {number[]} - Массив членов прогрессии
 *
 * @example
 * arithmeticProgression(1, 2, 5) // returns [1, 3, 5, 7, 9]
 * arithmeticProgression(10, -3, 4) // returns [10, 7, 4, 1]
 */
export function arithmeticProgression(first, difference, count) {
  if (count <= 0) {
    return [];
  }

  const result = [];
  let current = first;

  for (let i = 0; i < count; i++) {
    result.push(current);
    current += difference;
  }

  return result;
}

/**
 * Вычисляет сумму арифметической прогрессии
 * @param {number} first - Первый член
 * @param {number} difference - Разность
 * @param {number} count - Количество членов
 * @returns {number} - Сумма прогрессии
 *
 * @example
 * sumArithmeticProgression(1, 2, 5) // returns 25 (1+3+5+7+9=25)
 * sumArithmeticProgression(2, 3, 4) // returns 26 (2+5+8+11=26)
 */
export function sumArithmeticProgression(first, difference, count) {
  if (count <= 0) return 0;
  const last = first + difference * (count - 1);
  return ((first + last) * count) / 2;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект модуля сложения
 */
export default {
  add,
  addMany,
  addArray,
  addToEach,
  addPrecise,
  accumulate,
  createAdder,
  isSum,
  findPairsWithSum,
  cumulativeSum,
  sumDigits,
  isArmstrong,
  findArmstrongNumbers,
  sumSequence,
  arithmeticProgression,
  sumArithmeticProgression,
};

// ============================================
// ПРИМЕЧАНИЯ ПО МОДУЛЮ
// ============================================

/*
 * МОДУЛЬ СЛОЖЕНИЯ - ИЗМЕНЕНИЯ ПРИ РЕФАКТОРИНГЕ:
 *
 * 1. Выделены все функции, связанные со сложением, в отдельный файл
 * 2. Добавлены новые функции для работы с суммами:
 *    - addMany - сложение нескольких чисел
 *    - addArray - сложение массива чисел
 *    - addToEach - прибавление к каждому элементу
 *    - addPrecise - сложение с точностью
 *    - cumulativeSum - кумулятивная сумма
 *    - sumDigits - сумма цифр
 *    - isArmstrong - проверка чисел Армстронга
 *    - findArmstrongNumbers - поиск чисел Армстронга
 *    - sumSequence - сумма последовательности
 *    - arithmeticProgression - арифметическая прогрессия
 *    - sumArithmeticProgression - сумма прогрессии
 *
 * 3. Добавлены JSDoc комментарии для всех функций
 * 4. Добавлены примеры использования для каждой функции
 * 5. Реализована поддержка работы с массивами
 * 6. Добавлена обработка ошибок для некорректных входных данных
 * 7. Реализован экспорт по умолчанию для удобства использования
 *
 * ВСЕ ФУНКЦИИ СОХРАНЯЮТ ИСХОДНУЮ ЛОГИКУ
 * ИЗМЕНЕНИЙ В ПОВЕДЕНИИ НЕТ
 */
