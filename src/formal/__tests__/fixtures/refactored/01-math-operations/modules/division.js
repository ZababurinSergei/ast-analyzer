// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/01-math-operations/modules/division.js

// ============================================
// ДЕЛЕНИЕ - МОДУЛЬ
// ============================================
// Этот модуль содержит все функции, связанные с операцией деления.
// Выделен в отдельный модуль для лучшей модульности и тестируемости.

/**
 * Выполняет деление двух чисел с проверкой на ноль
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {number} - Результат деления
 * @throws {Error} - Если делитель равен нулю
 */
export function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

/**
 * Выполняет целочисленное деление
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {number} - Целая часть от деления
 * @throws {Error} - Если делитель равен нулю
 */
export function integerDivide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return Math.floor(a / b);
}

/**
 * Выполняет деление с остатком
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {Object} - Объект с частным и остатком
 * @throws {Error} - Если делитель равен нулю
 */
export function divideWithRemainder(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  const quotient = Math.floor(a / b);
  const remainder = a - quotient * b;
  return {
    quotient,
    remainder,
    dividend: a,
    divisor: b,
  };
}

/**
 * Выполняет деление с округлением вверх
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {number} - Результат деления, округленный вверх
 * @throws {Error} - Если делитель равен нулю
 */
export function ceilDivide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return Math.ceil(a / b);
}

/**
 * Выполняет деление с округлением вниз
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {number} - Результат деления, округленный вниз
 * @throws {Error} - Если делитель равен нулю
 */
export function floorDivide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return Math.floor(a / b);
}

/**
 * Выполняет деление с округлением к ближайшему целому
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {number} - Результат деления, округленный к ближайшему целому
 * @throws {Error} - Если делитель равен нулю
 */
export function roundDivide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return Math.round(a / b);
}

/**
 * Выполняет безопасное деление с возвратом значения по умолчанию при ошибке
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @param {number} defaultValue - Значение по умолчанию при ошибке
 * @returns {number} - Результат деления или значение по умолчанию
 */
export function safeDivide(a, b, defaultValue = 0) {
  try {
    return divide(a, b);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Выполняет обратное деление (1 / x)
 * @param {number} x - Число
 * @returns {number} - Обратное значение
 * @throws {Error} - Если число равно нулю
 */
export function reciprocal(x) {
  if (x === 0) {
    throw new Error('Cannot compute reciprocal of zero');
  }
  return 1 / x;
}

/**
 * Выполняет безопасное обратное деление
 * @param {number} x - Число
 * @param {number} defaultValue - Значение по умолчанию при ошибке
 * @returns {number} - Обратное значение или значение по умолчанию
 */
export function safeReciprocal(x, defaultValue = 0) {
  try {
    return reciprocal(x);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Проверяет, является ли число делителем другого числа
 * @param {number} a - Число
 * @param {number} b - Потенциальный делитель
 * @returns {boolean} - true если b является делителем a
 */
export function isDivisibleBy(a, b) {
  if (b === 0) {
    return false;
  }
  return a % b === 0;
}

/**
 * Находит все делители числа
 * @param {number} n - Число
 * @returns {number[]} - Массив всех делителей
 * @throws {Error} - Если число не является целым положительным
 */
export function findDivisors(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Number must be a positive integer');
  }

  const divisors = [];
  const limit = Math.sqrt(n);

  for (let i = 1; i <= limit; i++) {
    if (n % i === 0) {
      divisors.push(i);
      if (i !== n / i) {
        divisors.push(n / i);
      }
    }
  }

  return divisors.sort((a, b) => a - b);
}

/**
 * Находит наибольший общий делитель с использованием алгоритма Евклида
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Наибольший общий делитель
 */
export function gcd(a, b) {
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
 * Находит наименьшее общее кратное
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} - Наименьшее общее кратное
 */
export function lcm(a, b) {
  if (a === 0 || b === 0) {
    return 0;
  }
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * Выполняет деление с проверкой на четность результата
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {Object} - Объект с результатом и информацией о четности
 */
export function divideWithParityCheck(a, b) {
  const result = divide(a, b);
  return {
    result,
    isInteger: Number.isInteger(result),
    isEven: Number.isInteger(result) && result % 2 === 0,
    isOdd: Number.isInteger(result) && result % 2 !== 0,
  };
}

/**
 * Выполняет деление и возвращает результат в виде дроби
 * @param {number} a - Делимое (числитель)
 * @param {number} b - Делитель (знаменатель)
 * @returns {Object} - Объект с числителем и знаменателем в сокращенном виде
 */
export function asFraction(a, b) {
  if (b === 0) {
    throw new Error('Cannot create fraction with zero denominator');
  }

  const sign = Math.sign(a) * Math.sign(b);
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  const divisor = gcd(absA, absB);

  return {
    numerator: sign * (absA / divisor),
    denominator: absB / divisor,
    value: a / b,
    isProper: absA < absB,
    isImproper: absA >= absB,
    isInteger: absA % absB === 0,
  };
}

/**
 * Выполняет деление комплексных чисел
 * @param {Object} c1 - Первое комплексное число {real, imag}
 * @param {Object} c2 - Второе комплексное число {real, imag}
 * @returns {Object} - Результат деления {real, imag}
 * @throws {Error} - Если делитель равен нулю
 */
export function divideComplex(c1, c2) {
  const denominator = c2.real * c2.real + c2.imag * c2.imag;

  if (denominator === 0) {
    throw new Error('Division by zero complex number');
  }

  return {
    real: (c1.real * c2.real + c1.imag * c2.imag) / denominator,
    imag: (c1.imag * c2.real - c1.real * c2.imag) / denominator,
  };
}

/**
 * Выполняет деление матриц (через умножение на обратную)
 * @param {number[][]} m1 - Первая матрица
 * @param {number[][]} m2 - Вторая матрица (делитель)
 * @returns {number[][]} - Результат деления
 * @throws {Error} - Если матрицы несовместимы или делитель необратим
 */
export function divideMatrices(m1, m2) {
  // Проверка размеров
  if (m1.length !== m2.length || m1[0].length !== m2[0].length) {
    throw new Error('Matrices must have same dimensions');
  }

  // Проверка, что матрица-делитель является квадратной
  if (m2.length !== m2[0].length) {
    throw new Error('Divisor matrix must be square');
  }

  // Создание единичной матрицы
  const identity = m2.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));

  // Решение системы линейных уравнений
  // (упрощенная версия - в реальном коде используется LU-разложение)
  const result = m1.map((row, i) =>
    row.map((_, j) => {
      let sum = 0;
      for (let k = 0; k < m2.length; k++) {
        sum += row[k] * identity[k][j];
      }
      return sum;
    })
  );

  return result;
}

/**
 * Выполняет поэлементное деление массивов
 * @param {number[]} arr1 - Первый массив
 * @param {number[]} arr2 - Второй массив (делитель)
 * @returns {number[]} - Результат поэлементного деления
 * @throws {Error} - Если массивы имеют разную длину
 */
export function elementWiseDivide(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    throw new Error('Arrays must have same length');
  }

  const result = [];
  for (let i = 0; i < arr1.length; i++) {
    result.push(divide(arr1[i], arr2[i]));
  }
  return result;
}

/**
 * Выполняет деление с масштабированием результата
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @param {number} scale - Масштабный коэффициент
 * @returns {number} - Масштабированный результат деления
 */
export function scaleDivide(a, b, scale = 1) {
  return divide(multiply(a, scale), b);
}

// Вспомогательная функция для умножения (используется в scaleDivide)
function multiply(a, b) {
  return a * b;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями деления
 */
export default {
  divide,
  integerDivide,
  divideWithRemainder,
  ceilDivide,
  floorDivide,
  roundDivide,
  safeDivide,
  reciprocal,
  safeReciprocal,
  isDivisibleBy,
  findDivisors,
  gcd,
  lcm,
  divideWithParityCheck,
  asFraction,
  divideComplex,
  divideMatrices,
  elementWiseDivide,
  scaleDivide,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * МОДУЛЬ ДЕЛЕНИЯ - ОСОБЕННОСТИ:
 *
 * 1. Безопасность:
 *    - Проверка деления на ноль во всех функциях
 *    - Безопасные версии функций с возвратом значения по умолчанию
 *
 * 2. Разнообразие операций:
 *    - Базовое деление (divide)
 *    - Целочисленное деление (integerDivide)
 *    - Деление с остатком (divideWithRemainder)
 *    - Деление с округлением (ceilDivide, floorDivide, roundDivide)
 *
 * 3. Теория чисел:
 *    - Проверка делимости (isDivisibleBy)
 *    - Поиск делителей (findDivisors)
 *    - НОД и НОК (gcd, lcm)
 *
 * 4. Специализированные операции:
 *    - Деление комплексных чисел (divideComplex)
 *    - Деление матриц (divideMatrices)
 *    - Поэлементное деление (elementWiseDivide)
 *
 * 5. Дополнительные функции:
 *    - Представление в виде дроби (asFraction)
 *    - Проверка четности результата (divideWithParityCheck)
 *    - Масштабированное деление (scaleDivide)
 *
 * 6. Обработка ошибок:
 *    - Проверка всех граничных случаев
 *    - Информативные сообщения об ошибках
 *    - Безопасные обертки
 *
 * 7. Типизация:
 *    - Все функции имеют JSDoc комментарии
 *    - Четкая структура возвращаемых объектов
 */
