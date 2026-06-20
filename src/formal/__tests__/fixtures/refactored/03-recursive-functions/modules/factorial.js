// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/03-recursive-functions/modules/factorial.js

// ============================================
// МОДУЛЬ ФАКТОРИАЛА
// ============================================
// Этот модуль содержит различные реализации
// вычисления факториала и связанные функции.

/**
 * Вычисляет факториал числа рекурсивно
 * Сложность: O(n) время, O(n) память (стек вызовов)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Факториал числа n (n!)
 * @throws {Error} - Если n отрицательное или не целое
 */
function factorialRecursive(n) {
  // Проверка входных данных
  if (!Number.isInteger(n)) {
    throw new TypeError('n must be an integer');
  }
  if (n < 0) {
    throw new RangeError('n must be non-negative');
  }

  // Базовый случай
  if (n <= 1) {
    return 1;
  }

  // Рекурсивный вызов
  return n * factorialRecursive(n - 1);
}

/**
 * Вычисляет факториал числа итеративно (цикл)
 * Сложность: O(n) время, O(1) память
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Факториал числа n (n!)
 * @throws {Error} - Если n отрицательное или не целое
 */
function factorialIterative(n) {
  // Проверка входных данных
  if (!Number.isInteger(n)) {
    throw new TypeError('n must be an integer');
  }
  if (n < 0) {
    throw new RangeError('n must be non-negative');
  }

  // Базовый случай
  if (n <= 1) {
    return 1;
  }

  // Итеративное вычисление
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Вычисляет факториал числа с использованием мемоизации
 * Сложность: O(n) время первый раз, O(1) при повторных вызовах
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Факториал числа n (n!)
 * @throws {Error} - Если n отрицательное или не целое
 */
const factorialMemoized = (() => {
  const cache = new Map();
  cache.set(0, 1);
  cache.set(1, 1);

  return function factorialWithCache(n) {
    // Проверка входных данных
    if (!Number.isInteger(n)) {
      throw new TypeError('n must be an integer');
    }
    if (n < 0) {
      throw new RangeError('n must be non-negative');
    }

    // Проверка кэша
    if (cache.has(n)) {
      return cache.get(n);
    }

    // Вычисление и сохранение в кэш
    const result = n * factorialWithCache(n - 1);
    cache.set(n, result);
    return result;
  };
})();

/**
 * Вычисляет факториал числа с использованием хвостовой рекурсии
 * Сложность: O(n) время, O(1) память (оптимизировано)
 * @param {number} n - Неотрицательное целое число
 * @param {number} accumulator - Аккумулятор (по умолчанию 1)
 * @returns {number} - Факториал числа n (n!)
 * @throws {Error} - Если n отрицательное или не целое
 */
function factorialTailRecursive(n, accumulator = 1) {
  // Проверка входных данных
  if (!Number.isInteger(n)) {
    throw new TypeError('n must be an integer');
  }
  if (n < 0) {
    throw new RangeError('n must be non-negative');
  }

  // Базовый случай
  if (n <= 1) {
    return accumulator;
  }

  // Хвостовой рекурсивный вызов
  return factorialTailRecursive(n - 1, n * accumulator);
}

/**
 * Вычисляет факториал числа с использованием BigInt для больших чисел
 * @param {number} n - Неотрицательное целое число
 * @returns {bigint} - Факториал числа n в виде BigInt
 * @throws {Error} - Если n отрицательное или не целое
 */
function factorialBigInt(n) {
  // Проверка входных данных
  if (!Number.isInteger(n)) {
    throw new TypeError('n must be an integer');
  }
  if (n < 0) {
    throw new RangeError('n must be non-negative');
  }

  // Базовый случай
  if (n <= 1) {
    return 1n;
  }

  // Итеративное вычисление с BigInt
  let result = 1n;
  for (let i = 2; i <= n; i++) {
    result *= BigInt(i);
  }
  return result;
}

/**
 * Вычисляет двойной факториал числа (n!!)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Двойной факториал числа n
 * @throws {Error} - Если n отрицательное или не целое
 */
function doubleFactorial(n) {
  // Проверка входных данных
  if (!Number.isInteger(n)) {
    throw new TypeError('n must be an integer');
  }
  if (n < 0) {
    throw new RangeError('n must be non-negative');
  }

  // Базовый случай
  if (n <= 1) {
    return 1;
  }

  // Рекурсивное вычисление с шагом 2
  return n * doubleFactorial(n - 2);
}

/**
 * Вычисляет факториал числа с использованием гамма-функции (для вещественных чисел)
 * @param {number} x - Вещественное число (x > 0)
 * @returns {number} - Приближенное значение факториала через гамма-функцию
 * @throws {Error} - Если x <= 0
 */
function factorialGamma(x) {
  if (x <= 0) {
    throw new RangeError('x must be positive');
  }

  // Используем аппроксимацию Стирлинга
  // Γ(x+1) ≈ sqrt(2πx) * (x/e)^x * (1 + 1/(12x) + 1/(288x^2) - 139/(51840x^3))
  const pi = Math.PI;
  const e = Math.E;

  const sqrtTerm = Math.sqrt(2 * pi * x);
  const powerTerm = Math.pow(x / e, x);
  const correctionTerm = 1 + 1 / (12 * x) + 1 / (288 * x * x) - 139 / (51840 * x * x * x);

  return sqrtTerm * powerTerm * correctionTerm;
}

/**
 * Проверяет, является ли число факториалом другого числа
 * @param {number} n - Проверяемое число
 * @returns {Object} - Результат проверки { isFactorial: boolean, base: number | null }
 */
function isFactorial(n) {
  if (!Number.isInteger(n) || n < 1) {
    return { isFactorial: false, base: null };
  }

  let i = 1;
  let factorial = 1;

  while (factorial < n) {
    i++;
    factorial *= i;
  }

  return {
    isFactorial: factorial === n,
    base: factorial === n ? i : null,
  };
}

/**
 * Находит все факториалы в диапазоне [start, end]
 * @param {number} start - Начало диапазона
 * @param {number} end - Конец диапазона
 * @returns {Array<{number: number, factorial: number}>} - Массив факториалов
 */
function findFactorialsInRange(start, end) {
  if (start > end) {
    throw new RangeError('start must be less than or equal to end');
  }

  const result = [];
  let i = 1;
  let factorial = 1;

  while (factorial <= end) {
    if (factorial >= start) {
      result.push({
        number: i,
        factorial: factorial,
      });
    }
    i++;
    factorial *= i;
  }

  return result;
}

/**
 * Вычисляет количество нулей в конце факториала (trailing zeros)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Количество нулей в конце n!
 * @throws {Error} - Если n отрицательное или не целое
 */
function trailingZeros(n) {
  if (!Number.isInteger(n)) {
    throw new TypeError('n must be an integer');
  }
  if (n < 0) {
    throw new RangeError('n must be non-negative');
  }

  let count = 0;
  let powerOfFive = 5;

  while (powerOfFive <= n) {
    count += Math.floor(n / powerOfFive);
    powerOfFive *= 5;
  }

  return count;
}

/**
 * Вычисляет количество цифр в факториале
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Количество цифр в n!
 * @throws {Error} - Если n отрицательное или не целое
 */
function factorialDigits(n) {
  if (!Number.isInteger(n)) {
    throw new TypeError('n must be an integer');
  }
  if (n < 0) {
    throw new RangeError('n must be non-negative');
  }

  // Используем формулу: digits = floor(log10(n!)) + 1
  // log10(n!) = sum_{i=1}^{n} log10(i)
  let logSum = 0;
  for (let i = 1; i <= n; i++) {
    logSum += Math.log10(i);
  }

  return Math.floor(logSum) + 1;
}

/**
 * Вычисляет факториал с использованием мемоизации в Map
 * @param {number} n - Неотрицательное целое число
 * @param {Map} cache - Кэш для хранения вычисленных значений
 * @returns {number} - Факториал числа n
 */
function factorialWithCustomCache(n, cache = new Map()) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('n must be a non-negative integer');
  }

  if (cache.has(n)) {
    return cache.get(n);
  }

  if (n <= 1) {
    cache.set(n, 1);
    return 1;
  }

  const result = n * factorialWithCustomCache(n - 1, cache);
  cache.set(n, result);
  return result;
}

/**
 * Параллельное вычисление факториала (для больших чисел)
 * @param {number} n - Неотрицательное целое число
 * @param {number} chunkSize - Размер чанка для параллельной обработки
 * @returns {Promise<number>} - Promise с факториалом числа n
 */
async function factorialParallel(n, chunkSize = 1000) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('n must be a non-negative integer');
  }

  if (n <= 1) {
    return 1;
  }

  // Разбиваем на чанки
  const chunks = [];
  for (let i = 2; i <= n; i += chunkSize) {
    const end = Math.min(i + chunkSize - 1, n);
    chunks.push({ start: i, end });
  }

  // Обрабатываем чанки параллельно
  const chunkProducts = await Promise.all(
    chunks.map(async ({ start, end }) => {
      let product = 1;
      for (let j = start; j <= end; j++) {
        product *= j;
      }
      return product;
    })
  );

  // Объединяем результаты
  let result = 1;
  for (const product of chunkProducts) {
    result *= product;
  }

  return result;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные реализации
  factorialRecursive,
  factorialIterative,
  factorialMemoized,
  factorialTailRecursive,
  factorialBigInt,

  // Расширенные функции
  doubleFactorial,
  factorialGamma,
  isFactorial,
  findFactorialsInRange,
  trailingZeros,
  factorialDigits,
  factorialWithCustomCache,
  factorialParallel,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями факториала
 */
export default {
  factorialRecursive,
  factorialIterative,
  factorialMemoized,
  factorialTailRecursive,
  factorialBigInt,
  doubleFactorial,
  factorialGamma,
  isFactorial,
  findFactorialsInRange,
  trailingZeros,
  factorialDigits,
  factorialWithCustomCache,
  factorialParallel,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * МОДУЛЬ ФАКТОРИАЛА - 13 ФУНКЦИЙ
 *
 * Основные реализации факториала:
 * 1. factorialRecursive    - Классическая рекурсия (O(n) время, O(n) память)
 * 2. factorialIterative    - Итеративный цикл (O(n) время, O(1) память)
 * 3. factorialMemoized     - С мемоизацией (быстрый повторный доступ)
 * 4. factorialTailRecursive - Хвостовая рекурсия (оптимизируется компилятором)
 * 5. factorialBigInt       - Для больших чисел (BigInt)
 *
 * Расширенные функции:
 * 6. doubleFactorial       - Двойной факториал (n!!)
 * 7. factorialGamma        - Гамма-функция для вещественных чисел
 * 8. isFactorial           - Проверка, является ли число факториалом
 * 9. findFactorialsInRange - Поиск факториалов в диапазоне
 * 10. trailingZeros        - Количество нулей в конце факториала
 * 11. factorialDigits      - Количество цифр в факториале
 * 12. factorialWithCustomCache - Факториал с пользовательским кэшем
 * 13. factorialParallel    - Параллельное вычисление для больших чисел
 *
 * Особенности модуля:
 * - Полная валидация входных данных
 * - Поддержка различных типов чисел (Number, BigInt)
 * - Оптимизация для повторных вызовов (мемоизация)
 * - Асинхронная версия для больших чисел
 * - Расширенные математические функции
 * - Полное покрытие JSDoc
 *
 * Связанные модули:
 * - combinatorics.js - комбинаторные функции
 * - statistics.js - статистические функции
 * - number-theory.js - теория чисел
 */
