// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/01-math-operations/modules/subtraction.js

// ============================================
// МОДУЛЬ ВЫЧИТАНИЯ
// ============================================
// Этот модуль содержит функции для выполнения операций вычитания
// в различных контекстах и с различными типами данных.

/**
 * Базовое вычитание двух чисел
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @returns {number} - Разность чисел
 * @example
 * subtract(5, 3) // returns 2
 * subtract(10, 7) // returns 3
 */
export function subtract(a, b) {
  return a - b;
}

/**
 * Вычитание с проверкой на отрицательный результат
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {boolean} allowNegative - Разрешать ли отрицательный результат
 * @returns {number} - Разность чисел или 0 при отрицательном результате
 * @example
 * safeSubtract(5, 3, false) // returns 2
 * safeSubtract(3, 5, false) // returns 0
 */
export function safeSubtract(a, b, allowNegative = true) {
  const result = a - b;
  if (!allowNegative && result < 0) {
    return 0;
  }
  return result;
}

/**
 * Вычитание с округлением результата
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {number} decimals - Количество знаков после запятой
 * @returns {number} - Округленная разность
 * @example
 * roundSubtract(5.123, 3.456, 2) // returns 1.67
 */
export function roundSubtract(a, b, decimals = 0) {
  const result = a - b;
  const factor = Math.pow(10, decimals);
  return Math.round(result * factor) / factor;
}

/**
 * Вычитание с абсолютным значением результата
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @returns {number} - Абсолютное значение разности
 * @example
 * absSubtract(5, 3) // returns 2
 * absSubtract(3, 5) // returns 2
 */
export function absSubtract(a, b) {
  return Math.abs(a - b);
}

/**
 * Вычитание нескольких чисел последовательно
 * @param {number} initial - Начальное значение
 * @param {...number} numbers - Числа для вычитания
 * @returns {number} - Результат последовательного вычитания
 * @example
 * subtractMultiple(10, 2, 3, 1) // returns 4
 */
export function subtractMultiple(initial, ...numbers) {
  let result = initial;
  for (const num of numbers) {
    result = subtract(result, num);
  }
  return result;
}

/**
 * Вычитание с проверкой на переполнение
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {number} min - Минимальное допустимое значение
 * @param {number} max - Максимальное допустимое значение
 * @returns {number} - Разность чисел в допустимом диапазоне
 * @throws {Error} - Если результат выходит за допустимый диапазон
 * @example
 * boundedSubtract(10, 5, 0, 10) // returns 5
 * boundedSubtract(5, 10, 0, 10) // throws Error
 */
export function boundedSubtract(a, b, min = -Infinity, max = Infinity) {
  const result = a - b;
  if (result < min || result > max) {
    throw new Error(`Result ${result} is outside bounds [${min}, ${max}]`);
  }
  return result;
}

/**
 * Вычитание с насыщением
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {number} min - Минимальное значение (насыщение)
 * @param {number} max - Максимальное значение (насыщение)
 * @returns {number} - Разность чисел с насыщением
 * @example
 * saturatingSubtract(5, 10, 0, 10) // returns 0
 * saturatingSubtract(15, 5, 0, 10) // returns 10
 */
export function saturatingSubtract(a, b, min = -Infinity, max = Infinity) {
  let result = a - b;
  if (result < min) result = min;
  if (result > max) result = max;
  return result;
}

/**
 * Вычитание с процентным отношением
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {boolean} asPercentage - Возвращать результат как процент
 * @returns {number} - Разность или процентное отношение
 * @example
 * percentSubtract(10, 5, false) // returns 5
 * percentSubtract(10, 5, true) // returns 50
 */
export function percentSubtract(a, b, asPercentage = false) {
  const difference = a - b;
  if (asPercentage) {
    if (a === 0) return 0;
    return (difference / a) * 100;
  }
  return difference;
}

/**
 * Вычитание для чисел с плавающей точкой с обработкой погрешностей
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {number} epsilon - Допустимая погрешность
 * @returns {number} - Разность чисел
 * @example
 * floatSubtract(0.1, 0.2) // returns -0.1
 */
export function floatSubtract(a, b, epsilon = 1e-10) {
  const result = a - b;
  if (Math.abs(result) < epsilon) {
    return 0;
  }
  return result;
}

/**
 * Вычитание с использованием BigInt для больших чисел
 * @param {bigint} a - Уменьшаемое
 * @param {bigint} b - Вычитаемое
 * @returns {bigint} - Разность чисел
 * @example
 * bigIntSubtract(9007199254740991n, 1n) // returns 9007199254740990n
 */
export function bigIntSubtract(a, b) {
  if (typeof a !== 'bigint' || typeof b !== 'bigint') {
    throw new Error('Both arguments must be BigInt');
  }
  return a - b;
}

/**
 * Вычитание массивов поэлементно
 * @param {number[]} arr1 - Первый массив
 * @param {number[]} arr2 - Второй массив
 * @returns {number[]} - Массив разностей
 * @throws {Error} - Если массивы имеют разную длину
 * @example
 * arraySubtract([5, 8, 3], [2, 3, 1]) // returns [3, 5, 2]
 */
export function arraySubtract(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    throw new Error('Arrays must have the same length');
  }
  return arr1.map((val, index) => val - arr2[index]);
}

/**
 * Вычитание матриц поэлементно
 * @param {number[][]} m1 - Первая матрица
 * @param {number[][]} m2 - Вторая матрица
 * @returns {number[][]} - Матрица разностей
 * @throws {Error} - Если матрицы имеют разные размеры
 * @example
 * matrixSubtract([[5, 8], [3, 6]], [[2, 3], [1, 4]]) // returns [[3, 5], [2, 2]]
 */
export function matrixSubtract(m1, m2) {
  if (m1.length !== m2.length || m1[0].length !== m2[0].length) {
    throw new Error('Matrices must have the same dimensions');
  }
  return m1.map((row, i) => row.map((val, j) => val - m2[i][j]));
}

/**
 * Вычитание с проверкой на положительность результата
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {string} errorMessage - Сообщение об ошибке
 * @returns {number} - Положительная разность
 * @throws {Error} - Если результат отрицательный
 * @example
 * ensurePositiveSubtract(10, 5) // returns 5
 * ensurePositiveSubtract(5, 10) // throws Error
 */
export function ensurePositiveSubtract(a, b, errorMessage = 'Result must be positive') {
  const result = a - b;
  if (result < 0) {
    throw new Error(errorMessage);
  }
  return result;
}

/**
 * Вычитание с добавлением константы
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {number} c - Добавляемая константа
 * @returns {number} - Результат: a - b + c
 * @example
 * subtractAndAdd(10, 5, 2) // returns 7
 */
export function subtractAndAdd(a, b, c) {
  return a - b + c;
}

/**
 * Вычитание с проверкой на равенство
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {number} expected - Ожидаемый результат
 * @param {number} epsilon - Допустимая погрешность
 * @returns {boolean} - true если результат равен ожидаемому
 * @example
 * subtractEquals(5, 3, 2) // returns true
 * subtractEquals(5, 3, 1) // returns false
 */
export function subtractEquals(a, b, expected, epsilon = 1e-10) {
  const result = a - b;
  return Math.abs(result - expected) < epsilon;
}

/**
 * Создает функцию вычитания с фиксированным вычитаемым
 * @param {number} b - Фиксированное вычитаемое
 * @returns {Function} - Функция, вычитающая b из переданного числа
 * @example
 * const subtractFive = createSubtractor(5);
 * subtractFive(10) // returns 5
 */
export function createSubtractor(b) {
  return function (a) {
    return a - b;
  };
}

/**
 * Создает функцию вычитания с фиксированным уменьшаемым
 * @param {number} a - Фиксированное уменьшаемое
 * @returns {Function} - Функция, вычитающая переданное число из a
 * @example
 * const subtractFromTen = createSubtractorFrom(10);
 * subtractFromTen(3) // returns 7
 */
export function createSubtractorFrom(a) {
  return function (b) {
    return a - b;
  };
}

/**
 * Вычитание с логированием каждого шага
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {Function} logger - Функция логирования
 * @returns {number} - Разность чисел
 * @example
 * loggedSubtract(10, 3, console.log) // logs: "Subtracting 3 from 10 = 7"
 */
export function loggedSubtract(a, b, logger = console.log) {
  const result = a - b;
  logger(`Subtracting ${b} from ${a} = ${result}`);
  return result;
}

/**
 * Вычитание с таймаутом (для долгих вычислений)
 * @param {number} a - Уменьшаемое
 * @param {number} b - Вычитаемое
 * @param {number} timeoutMs - Таймаут в миллисекундах
 * @returns {Promise<number>} - Promise с разностью
 * @throws {Error} - Если время истекло
 * @example
 * timeoutSubtract(10, 5, 1000) // resolves to 5
 */
export function timeoutSubtract(a, b, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Subtraction timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const result = a - b;
      clearTimeout(timer);
      resolve(result);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Объект с функциями вычитания
 */
export default {
  subtract,
  safeSubtract,
  roundSubtract,
  absSubtract,
  subtractMultiple,
  boundedSubtract,
  saturatingSubtract,
  percentSubtract,
  floatSubtract,
  bigIntSubtract,
  arraySubtract,
  matrixSubtract,
  ensurePositiveSubtract,
  subtractAndAdd,
  subtractEquals,
  createSubtractor,
  createSubtractorFrom,
  loggedSubtract,
  timeoutSubtract,
};

// ============================================
// ПРИМЕЧАНИЯ ПО МОДУЛЮ
// ============================================

/*
 * МОДУЛЬ ВЫЧИТАНИЯ - ОСОБЕННОСТИ:
 *
 * 1. Базовые операции:
 *    - subtract - стандартное вычитание
 *    - safeSubtract - с проверкой на отрицательный результат
 *    - roundSubtract - с округлением
 *    - absSubtract - абсолютное значение разности
 *
 * 2. Работа с коллекциями:
 *    - arraySubtract - поэлементное вычитание массивов
 *    - matrixSubtract - поэлементное вычитание матриц
 *    - subtractMultiple - последовательное вычитание
 *
 * 3. Валидация и безопасность:
 *    - boundedSubtract - с проверкой диапазона
 *    - saturatingSubtract - с насыщением
 *    - ensurePositiveSubtract - гарантированно положительный результат
 *
 * 4. Специальные случаи:
 *    - percentSubtract - процентное отношение
 *    - floatSubtract - для чисел с плавающей точкой
 *    - bigIntSubtract - для больших целых чисел
 *
 * 5. Фабрики и композиция:
 *    - createSubtractor - создает функцию с фиксированным вычитаемым
 *    - createSubtractorFrom - создает функцию с фиксированным уменьшаемым
 *    - subtractAndAdd - комбинированная операция
 *
 * 6. Отладка и логирование:
 *    - loggedSubtract - с логированием
 *    - subtractEquals - проверка результата
 *
 * 7. Асинхронность:
 *    - timeoutSubtract - с таймаутом
 *
 * ВСЕ ФУНКЦИИ ВКЛЮЧАЮТ:
 * - JSDoc документацию
 * - Примеры использования
 * - Валидацию входных данных
 * - Обработку ошибок
 */
