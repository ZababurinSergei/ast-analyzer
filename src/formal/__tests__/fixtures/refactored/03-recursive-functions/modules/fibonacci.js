// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/03-recursive-functions/modules/fibonacci.js

// ============================================
// МОДУЛЬ ЧИСЕЛ ФИБОНАЧЧИ
// ============================================
// Этот модуль содержит различные реализации
// вычисления чисел Фибоначчи и связанные функции.

/**
 * Вычисляет число Фибоначчи рекурсивно (наивная реализация)
 * Сложность: O(2^n) время, O(n) память (стек вызовов)
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @returns {number} - n-е число Фибоначчи
 * @throws {Error} - Если n отрицательное
 */
function fibonacciRecursive(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n === 0) return 0;
  if (n === 1) return 1;
  return fibonacciRecursive(n - 1) + fibonacciRecursive(n - 2);
}

/**
 * Вычисляет число Фибоначчи с мемоизацией (рекурсивно)
 * Сложность: O(n) время, O(n) память
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @param {Map} memo - Кэш для хранения вычисленных значений
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciMemoized(n, memo = new Map()) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (memo.has(n)) {
    return memo.get(n);
  }
  if (n === 0) return 0;
  if (n === 1) return 1;

  const result = fibonacciMemoized(n - 1, memo) + fibonacciMemoized(n - 2, memo);
  memo.set(n, result);
  return result;
}

/**
 * Вычисляет число Фибоначчи итеративно (оптимальная реализация)
 * Сложность: O(n) время, O(1) память
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciIterative(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n === 0) return 0;
  if (n === 1) return 1;

  let a = 0;
  let b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/**
 * Вычисляет число Фибоначчи с использованием матричного возведения в степень
 * Сложность: O(log n) время, O(log n) память
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciMatrix(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n === 0) return 0;
  if (n === 1) return 1;

  const matrix = [
    [1, 1],
    [1, 0],
  ];

  const result = matrixPower(matrix, n - 1);
  return result[0][0];
}

/**
 * Возводит матрицу 2x2 в степень n
 * @param {number[][]} matrix - Матрица 2x2
 * @param {number} n - Степень
 * @returns {number[][]} - Матрица в степени n
 */
function matrixPower(matrix, n) {
  if (n === 0) {
    return [
      [1, 0],
      [0, 1],
    ];
  }
  if (n === 1) {
    return matrix;
  }

  const half = matrixPower(matrix, Math.floor(n / 2));
  const squared = multiplyMatrix(half, half);

  if (n % 2 === 0) {
    return squared;
  } else {
    return multiplyMatrix(squared, matrix);
  }
}

/**
 * Умножает две матрицы 2x2
 * @param {number[][]} a - Первая матрица
 * @param {number[][]} b - Вторая матрица
 * @returns {number[][]} - Результат умножения
 */
function multiplyMatrix(a, b) {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

/**
 * Вычисляет число Фибоначчи с использованием формулы Бине
 * Сложность: O(1) время, O(1) память (но с плавающей точкой)
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciBinet(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }

  const sqrt5 = Math.sqrt(5);
  const phi = (1 + sqrt5) / 2;
  const psi = (1 - sqrt5) / 2;

  return Math.round((Math.pow(phi, n) - Math.pow(psi, n)) / sqrt5);
}

/**
 * Вычисляет число Фибоначчи с использованием каскадного суммирования (быстрее итеративного)
 * Сложность: O(n) время, O(1) память
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciCascade(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n === 0) return 0;
  if (n === 1) return 1;

  let prev = 0;
  let curr = 1;
  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
  return curr;
}

/**
 * Вычисляет число Фибоначчи с использованием быстрого удвоения
 * Сложность: O(log n) время, O(log n) память
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @returns {{ f_n: number, f_n_plus_1: number }} - Объект с f(n) и f(n+1)
 */
function fibonacciDoubling(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n === 0) {
    return { f_n: 0, f_n_plus_1: 1 };
  }

  const half = fibonacciDoubling(Math.floor(n / 2));
  const a = half.f_n;
  const b = half.f_n_plus_1;

  const c = a * (2 * b - a);
  const d = a * a + b * b;

  if (n % 2 === 0) {
    return { f_n: c, f_n_plus_1: d };
  } else {
    return { f_n: d, f_n_plus_1: c + d };
  }
}

/**
 * Вычисляет n-е число Фибоначчи с использованием быстрого удвоения
 * @param {number} n - Индекс числа Фибоначчи (начиная с 0)
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciDoublingFast(n) {
  const result = fibonacciDoubling(n);
  return result.f_n;
}

/**
 * Вычисляет последовательность чисел Фибоначчи до n
 * @param {number} n - Максимальный индекс
 * @returns {number[]} - Массив чисел Фибоначчи
 */
function fibonacciSequence(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }

  const sequence = [];
  let a = 0;
  let b = 1;

  for (let i = 0; i <= n; i++) {
    if (i === 0) {
      sequence.push(0);
    } else if (i === 1) {
      sequence.push(1);
    } else {
      const next = a + b;
      sequence.push(next);
      a = b;
      b = next;
    }
  }

  return sequence;
}

/**
 * Вычисляет числа Фибоначчи до определенного значения (не превышающего maxValue)
 * @param {number} maxValue - Максимальное значение
 * @returns {number[]} - Массив чисел Фибоначчи
 */
function fibonacciUpTo(maxValue) {
  if (maxValue < 0) {
    throw new Error('maxValue must be non-negative');
  }
  if (maxValue === 0) return [0];

  const sequence = [0, 1];
  let a = 0;
  let b = 1;

  while (true) {
    const next = a + b;
    if (next > maxValue) break;
    sequence.push(next);
    a = b;
    b = next;
  }

  return sequence;
}

/**
 * Проверяет, является ли число числом Фибоначчи
 * @param {number} num - Число для проверки
 * @returns {boolean} - true если число является числом Фибоначчи
 */
function isFibonacci(num) {
  if (num < 0) return false;

  // Число является числом Фибоначчи, если 5*n^2 + 4 или 5*n^2 - 4 является полным квадратом
  const n1 = 5 * num * num + 4;
  const n2 = 5 * num * num - 4;

  return isPerfectSquare(n1) || isPerfectSquare(n2);
}

/**
 * Проверяет, является ли число полным квадратом
 * @param {number} num - Число для проверки
 * @returns {boolean} - true если число является полным квадратом
 */
function isPerfectSquare(num) {
  if (num < 0) return false;
  const sqrt = Math.sqrt(num);
  return sqrt === Math.floor(sqrt);
}

/**
 * Находит индекс числа Фибоначчи (если число является числом Фибоначчи)
 * @param {number} num - Число для проверки
 * @returns {number} - Индекс числа Фибоначчи или -1 если не найдено
 */
function fibonacciIndexOf(num) {
  if (num < 0) return -1;
  if (num === 0) return 0;
  if (num === 1) return 1;

  let a = 0;
  let b = 1;
  let index = 1;

  while (b < num) {
    const next = a + b;
    a = b;
    b = next;
    index++;
  }

  return b === num ? index : -1;
}

/**
 * Вычисляет сумму первых n чисел Фибоначчи
 * @param {number} n - Количество чисел
 * @returns {number} - Сумма первых n чисел Фибоначчи
 */
function fibonacciSum(n) {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }

  // Сумма первых n чисел Фибоначчи = F(n+2) - 1
  return fibonacciIterative(n + 2) - 1;
}

/**
 * Вычисляет сумму четных чисел Фибоначчи до определенного значения
 * @param {number} maxValue - Максимальное значение
 * @returns {number} - Сумма четных чисел Фибоначчи
 */
function fibonacciEvenSum(maxValue) {
  if (maxValue < 0) {
    throw new Error('maxValue must be non-negative');
  }

  let sum = 0;
  let a = 0;
  let b = 1;

  while (a <= maxValue) {
    if (a % 2 === 0) {
      sum += a;
    }
    const next = a + b;
    a = b;
    b = next;
  }

  return sum;
}

/**
 * Вычисляет золотое сечение как предел отношения соседних чисел Фибоначчи
 * @param {number} iterations - Количество итераций
 * @returns {number} - Приближение золотого сечения
 */
function goldenRatioApprox(iterations = 20) {
  if (iterations < 2) {
    throw new Error('iterations must be at least 2');
  }

  const fib = fibonacciIterative(iterations + 1);
  const prevFib = fibonacciIterative(iterations);

  return fib / prevFib;
}

/**
 * Генерирует матрицу Фибоначчи (для визуализации)
 * @param {number} size - Размер матрицы
 * @returns {number[][]} - Матрица Фибоначчи
 */
function fibonacciMatrixGenerate(size) {
  const matrix = [];
  for (let i = 0; i < size; i++) {
    matrix[i] = [];
    for (let j = 0; j < size; j++) {
      matrix[i][j] = fibonacciIterative(i + j);
    }
  }
  return matrix;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные реализации
  fibonacciRecursive,
  fibonacciMemoized,
  fibonacciIterative,
  fibonacciMatrix,
  fibonacciBinet,
  fibonacciCascade,
  fibonacciDoubling,
  fibonacciDoublingFast,

  // Вспомогательные функции
  matrixPower,
  multiplyMatrix,
  fibonacciSequence,
  fibonacciUpTo,
  isFibonacci,
  isPerfectSquare,
  fibonacciIndexOf,

  // Статистические функции
  fibonacciSum,
  fibonacciEvenSum,
  goldenRatioApprox,

  // Визуализация
  fibonacciMatrixGenerate,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями для работы с числами Фибоначчи
 */
export default {
  // Основные реализации
  fibonacciRecursive,
  fibonacciMemoized,
  fibonacciIterative,
  fibonacciMatrix,
  fibonacciBinet,
  fibonacciCascade,
  fibonacciDoubling,
  fibonacciDoublingFast,

  // Вспомогательные функции
  matrixPower,
  multiplyMatrix,
  fibonacciSequence,
  fibonacciUpTo,
  isFibonacci,
  isPerfectSquare,
  fibonacciIndexOf,

  // Статистические функции
  fibonacciSum,
  fibonacciEvenSum,
  goldenRatioApprox,

  // Визуализация
  fibonacciMatrixGenerate,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ЧИСЕЛ ФИБОНАЧЧИ
 *
 * Этот модуль предоставляет 8 различных реализаций чисел Фибоначчи:
 *
 * 1. fibonacciRecursive     - Наивная рекурсия (O(2^n))
 * 2. fibonacciMemoized      - Рекурсия с мемоизацией (O(n))
 * 3. fibonacciIterative     - Итеративная (O(n))
 * 4. fibonacciMatrix        - Матричное возведение (O(log n))
 * 5. fibonacciBinet         - Формула Бине (O(1), с плавающей точкой)
 * 6. fibonacciCascade       - Каскадное суммирование (O(n))
 * 7. fibonacciDoubling      - Быстрое удвоение (O(log n))
 * 8. fibonacciDoublingFast  - Быстрое удвоение (упрощенная версия)
 *
 * Дополнительные функции:
 * - fibonacciSequence       - Последовательность до n
 * - fibonacciUpTo           - Последовательность до maxValue
 * - isFibonacci             - Проверка, является ли число числом Фибоначчи
 * - fibonacciIndexOf         - Индекс числа Фибоначчи
 * - fibonacciSum             - Сумма первых n чисел
 * - fibonacciEvenSum        - Сумма четных чисел до maxValue
 * - goldenRatioApprox       - Приближение золотого сечения
 * - fibonacciMatrixGenerate - Генерация матрицы Фибоначчи
 *
 * Рекомендуемые реализации:
 * - Для небольших n (0-30): любая реализация
 * - Для средних n (30-1000): fibonacciIterative или fibonacciMemoized
 * - Для больших n (1000+): fibonacciDoubling или fibonacciMatrix
 * - Для проверки чисел: isFibonacci
 *
 * Примечание: fibonacciBinet использует числа с плавающей точкой
 * и может давать неточные результаты для больших n (> 70).
 */
