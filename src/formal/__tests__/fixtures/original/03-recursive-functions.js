// packages/ast-analyzer/src/formal/__tests__/fixtures/original/03-recursive-functions.js

/**
 * Рекурсивные функции - набор функций для тестирования формальной верификации
 *
 * Содержит различные рекурсивные алгоритмы для проверки:
 * - Базовые рекурсивные функции (факториал, фибоначчи)
 * - Рекурсивные функции с аккумуляторами
 * - Взаимно рекурсивные функции
 * - Рекурсивные функции с условиями
 * - Рекурсивные функции с несколькими ветвями
 * - Хвостовая рекурсия
 * - Рекурсивные функции высшего порядка
 */

// ============================================
// 1. БАЗОВЫЕ РЕКУРСИВНЫЕ ФУНКЦИИ
// ============================================

/**
 * Факториал - классическая рекурсивная функция
 * @param {number} n - неотрицательное целое число
 * @returns {number} n!
 *
 * Формальная спецификация:
 * - Предусловие: n >= 0
 * - Постусловие: result = n!
 * - Инвариант: n! = n * (n-1)!
 */
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Факториал с хвостовой рекурсией
 * @param {number} n - неотрицательное целое число
 * @param {number} acc - аккумулятор (по умолчанию 1)
 * @returns {number} n!
 */
function factorialTailRecursive(n, acc = 1) {
  if (n <= 1) return acc;
  return factorialTailRecursive(n - 1, n * acc);
}

/**
 * Числа Фибоначчи - классическая рекурсия
 * @param {number} n - неотрицательное целое число
 * @returns {number} F(n)
 *
 * Формальная спецификация:
 * - Предусловие: n >= 0
 * - Постусловие: F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2)
 */
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

/**
 * Числа Фибоначчи с мемоизацией (оптимизированная версия)
 * @param {number} n - неотрицательное целое число
 * @param {Map} memo - кэш для мемоизации
 * @returns {number} F(n)
 */
function fibonacciMemoized(n, memo = new Map()) {
  if (memo.has(n)) return memo.get(n);
  if (n <= 1) return n;

  const result = fibonacciMemoized(n - 1, memo) + fibonacciMemoized(n - 2, memo);
  memo.set(n, result);
  return result;
}

/**
 * Рекурсивная сумма чисел от 1 до n
 * @param {number} n - неотрицательное целое число
 * @returns {number} 1 + 2 + ... + n
 *
 * Формальная спецификация:
 * - Предусловие: n >= 0
 * - Постусловие: result = n * (n + 1) / 2
 */
function sumRecursive(n) {
  if (n <= 0) return 0;
  return n + sumRecursive(n - 1);
}

/**
 * Рекурсивная сумма с аккумулятором (хвостовая рекурсия)
 * @param {number} n - неотрицательное целое число
 * @param {number} acc - аккумулятор
 * @returns {number} 1 + 2 + ... + n
 */
function sumTailRecursive(n, acc = 0) {
  if (n <= 0) return acc;
  return sumTailRecursive(n - 1, acc + n);
}

// ============================================
// 2. РЕКУРСИВНЫЕ ФУНКЦИИ С УСЛОВИЯМИ
// ============================================

/**
 * Возведение в степень (рекурсивная версия)
 * @param {number} base - основание
 * @param {number} exp - показатель степени (целое неотрицательное)
 * @returns {number} base^exp
 *
 * Формальная спецификация:
 * - Предусловие: exp >= 0
 * - Постусловие: result = base^exp
 */
function power(base, exp) {
  if (exp === 0) return 1;
  if (exp < 0) return 1 / power(base, -exp);

  // Оптимизация: четный показатель
  if (exp % 2 === 0) {
    const half = power(base, exp / 2);
    return half * half;
  }

  return base * power(base, exp - 1);
}

/**
 * Быстрое возведение в степень (бинарное возведение)
 * @param {number} base - основание
 * @param {number} exp - показатель степени (целое неотрицательное)
 * @returns {number} base^exp
 */
function powerFast(base, exp) {
  if (exp === 0) return 1;
  if (exp === 1) return base;

  if (exp % 2 === 0) {
    const half = powerFast(base, exp / 2);
    return half * half;
  }

  return base * powerFast(base, exp - 1);
}

/**
 * Наибольший общий делитель (алгоритм Евклида)
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} НОД(a, b)
 *
 * Формальная спецификация:
 * - Предусловие: a >= 0, b >= 0, a + b > 0
 * - Постусловие: result = gcd(a, b)
 */
function gcd(a, b) {
  if (b === 0) return a;
  return gcd(b, a % b);
}

/**
 * Наименьшее общее кратное (через НОД)
 * @param {number} a - первое число
 * @param {number} b - второе число
 * @returns {number} НОК(a, b)
 */
function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

// ============================================
// 3. ВЗАИМНО РЕКУРСИВНЫЕ ФУНКЦИИ
// ============================================

/**
 * Проверка на четность (взаимная рекурсия с isOdd)
 * @param {number} n - целое число
 * @returns {boolean} true если n четное
 */
function isEven(n) {
  if (n === 0) return true;
  if (n < 0) return isEven(-n);
  return isOdd(n - 1);
}

/**
 * Проверка на нечетность (взаимная рекурсия с isEven)
 * @param {number} n - целое число
 * @returns {boolean} true если n нечетное
 */
function isOdd(n) {
  if (n === 0) return false;
  if (n < 0) return isOdd(-n);
  return isEven(n - 1);
}

/**
 * Функция Аккермана - классический пример взаимной рекурсии
 * @param {number} m - первый параметр
 * @param {number} n - второй параметр
 * @returns {number} A(m, n)
 *
 * Формальная спецификация:
 * - Предусловие: m >= 0, n >= 0
 * - A(0, n) = n + 1
 * - A(m+1, 0) = A(m, 1)
 * - A(m+1, n+1) = A(m, A(m+1, n))
 */
function ackermann(m, n) {
  if (m === 0) return n + 1;
  if (n === 0) return ackermann(m - 1, 1);
  return ackermann(m - 1, ackermann(m, n - 1));
}

// ============================================
// 4. РЕКУРСИВНЫЕ ФУНКЦИИ С МАССИВАМИ
// ============================================

/**
 * Рекурсивная сумма элементов массива
 * @param {number[]} arr - массив чисел
 * @param {number} index - текущий индекс (по умолчанию 0)
 * @returns {number} сумма элементов
 *
 * Формальная спецификация:
 * - Предусловие: 0 <= index <= arr.length
 * - Постусловие: result = sum(arr[index:])
 */
function arraySumRecursive(arr, index = 0) {
  if (index >= arr.length) return 0;
  return arr[index] + arraySumRecursive(arr, index + 1);
}

/**
 * Рекурсивный поиск максимума в массиве
 * @param {number[]} arr - массив чисел
 * @param {number} index - текущий индекс (по умолчанию 0)
 * @param {number} max - текущий максимум
 * @returns {number} максимальный элемент
 */
function arrayMaxRecursive(arr, index = 0, max = -Infinity) {
  if (index >= arr.length) return max;
  const currentMax = arr[index] > max ? arr[index] : max;
  return arrayMaxRecursive(arr, index + 1, currentMax);
}

/**
 * Рекурсивная реверсия массива
 * @param {any[]} arr - массив
 * @returns {any[]} реверсированный массив
 */
function arrayReverseRecursive(arr) {
  if (arr.length <= 1) return arr;
  return [arr[arr.length - 1], ...arrayReverseRecursive(arr.slice(0, -1))];
}

/**
 * Рекурсивная проверка палиндрома
 * @param {string} str - строка для проверки
 * @returns {boolean} true если строка палиндром
 */
function isPalindrome(str) {
  if (str.length <= 1) return true;
  if (str[0] !== str[str.length - 1]) return false;
  return isPalindrome(str.slice(1, -1));
}

// ============================================
// 5. РЕКУРСИВНЫЕ ФУНКЦИИ ВЫСШЕГО ПОРЯДКА
// ============================================

/**
 * Рекурсивный map для массива
 * @param {any[]} arr - массив
 * @param {Function} fn - функция преобразования
 * @param {number} index - текущий индекс
 * @returns {any[]} преобразованный массив
 */
function mapRecursive(arr, fn, index = 0) {
  if (index >= arr.length) return [];
  return [fn(arr[index]), ...mapRecursive(arr, fn, index + 1)];
}

/**
 * Рекурсивный filter для массива
 * @param {any[]} arr - массив
 * @param {Function} predicate - функция-предикат
 * @param {number} index - текущий индекс
 * @returns {any[]} отфильтрованный массив
 */
function filterRecursive(arr, predicate, index = 0) {
  if (index >= arr.length) return [];

  const rest = filterRecursive(arr, predicate, index + 1);
  if (predicate(arr[index])) {
    return [arr[index], ...rest];
  }
  return rest;
}

/**
 * Рекурсивный reduce для массива
 * @param {any[]} arr - массив
 * @param {Function} fn - функция редукции
 * @param {any} initial - начальное значение
 * @param {number} index - текущий индекс
 * @returns {any} результат редукции
 */
function reduceRecursive(arr, fn, initial, index = 0) {
  if (index >= arr.length) return initial;
  const next = fn(initial, arr[index]);
  return reduceRecursive(arr, fn, next, index + 1);
}

/**
 * Рекурсивный flat для массива
 * @param {any[]} arr - массив (может содержать вложенные массивы)
 * @returns {any[]} плоский массив
 */
function flatRecursive(arr) {
  const result = [];

  function flatten(item) {
    if (Array.isArray(item)) {
      for (const elem of item) {
        flatten(elem);
      }
    } else {
      result.push(item);
    }
  }

  flatten(arr);
  return result;
}

// ============================================
// 6. РЕКУРСИВНЫЕ АЛГОРИТМЫ
// ============================================

/**
 * Быстрая сортировка (QuickSort)
 * @param {number[]} arr - массив чисел
 * @returns {number[]} отсортированный массив
 *
 * Формальная спецификация:
 * - Постусловие: result отсортирован по возрастанию
 * - Инвариант: pivot на своем месте
 */
function quickSort(arr) {
  if (arr.length <= 1) return arr;

  const pivot = arr[0];
  const left = [];
  const right = [];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < pivot) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }

  return [...quickSort(left), pivot, ...quickSort(right)];
}

/**
 * Сортировка слиянием (MergeSort)
 * @param {number[]} arr - массив чисел
 * @returns {number[]} отсортированный массив
 */
function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

/**
 * Вспомогательная функция для слияния
 * @param {number[]} left - левая половина
 * @param {number[]} right - правая половина
 * @returns {number[]} слитый массив
 */
function merge(left, right) {
  const result = [];
  let i = 0,
    j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }

  return [...result, ...left.slice(i), ...right.slice(j)];
}

/**
 * Двоичный поиск (рекурсивная версия)
 * @param {number[]} arr - отсортированный массив
 * @param {number} target - искомое значение
 * @param {number} left - левая граница
 * @param {number} right - правая граница
 * @returns {number} индекс элемента или -1
 *
 * Формальная спецификация:
 * - Предусловие: arr отсортирован, 0 <= left <= right <= arr.length
 * - Постусловие: если arr[index] = target, возвращает index, иначе -1
 */
function binarySearchRecursive(arr, target, left = 0, right = arr.length - 1) {
  if (left > right) return -1;

  const mid = Math.floor((left + right) / 2);

  if (arr[mid] === target) return mid;
  if (arr[mid] < target) {
    return binarySearchRecursive(arr, target, mid + 1, right);
  }
  return binarySearchRecursive(arr, target, left, mid - 1);
}

/**
 * Генерация всех перестановок (рекурсивно)
 * @param {any[]} arr - массив
 * @returns {any[][]} все перестановки
 */
function permutations(arr) {
  if (arr.length <= 1) return [arr];

  const result = [];

  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = permutations(rest);

    for (const perm of perms) {
      result.push([arr[i], ...perm]);
    }
  }

  return result;
}

/**
 * Генерация всех подмножеств (рекурсивно)
 * @param {any[]} arr - массив
 * @returns {any[][]} все подмножества
 */
function subsets(arr) {
  if (arr.length === 0) return [[]];

  const first = arr[0];
  const rest = subsets(arr.slice(1));

  const withFirst = rest.map(sub => [first, ...sub]);
  return [...rest, ...withFirst];
}

// ============================================
// 7. РЕКУРСИВНЫЕ ФУНКЦИИ С АККУМУЛЯТОРАМИ
// ============================================

/**
 * Рекурсивная функция с несколькими аккумуляторами
 * @param {number[]} arr - массив чисел
 * @param {number} sumAcc - аккумулятор суммы
 * @param {number} countAcc - аккумулятор количества
 * @param {number} index - текущий индекс
 * @returns {{ sum: number; count: number }} статистика
 */
function statisticsRecursive(arr, sumAcc = 0, countAcc = 0, index = 0) {
  if (index >= arr.length) {
    return { sum: sumAcc, count: countAcc };
  }

  return statisticsRecursive(arr, sumAcc + arr[index], countAcc + 1, index + 1);
}

/**
 * Рекурсивная функция с вычислением среднего
 * @param {number[]} arr - массив чисел
 * @param {number} index - текущий индекс
 * @param {{ sum: number; count: number }} state - состояние
 * @returns {number} среднее арифметическое
 */
function averageRecursive(arr, index = 0, state = { sum: 0, count: 0 }) {
  if (index >= arr.length) {
    return state.count === 0 ? 0 : state.sum / state.count;
  }

  return averageRecursive(arr, index + 1, {
    sum: state.sum + arr[index],
    count: state.count + 1,
  });
}

// ============================================
// 8. РЕКУРСИВНЫЕ ФУНКЦИИ ДЛЯ ДЕРЕВЬЕВ
// ============================================

/**
 * Структура узла дерева
 */
class TreeNode {
  constructor(value, left = null, right = null) {
    this.value = value;
    this.left = left;
    this.right = right;
  }
}

/**
 * Рекурсивный обход дерева in-order
 * @param {TreeNode} node - корень дерева
 * @param {number[]} result - массив для сбора результатов
 * @returns {number[]} значения узлов in-order
 */
function inOrderTraversal(node, result = []) {
  if (!node) return result;

  inOrderTraversal(node.left, result);
  result.push(node.value);
  inOrderTraversal(node.right, result);

  return result;
}

/**
 * Рекурсивный обход дерева pre-order
 * @param {TreeNode} node - корень дерева
 * @param {number[]} result - массив для сбора результатов
 * @returns {number[]} значения узлов pre-order
 */
function preOrderTraversal(node, result = []) {
  if (!node) return result;

  result.push(node.value);
  preOrderTraversal(node.left, result);
  preOrderTraversal(node.right, result);

  return result;
}

/**
 * Рекурсивный обход дерева post-order
 * @param {TreeNode} node - корень дерева
 * @param {number[]} result - массив для сбора результатов
 * @returns {number[]} значения узлов post-order
 */
function postOrderTraversal(node, result = []) {
  if (!node) return result;

  postOrderTraversal(node.left, result);
  postOrderTraversal(node.right, result);
  result.push(node.value);

  return result;
}

/**
 * Рекурсивный поиск в бинарном дереве поиска
 * @param {TreeNode} node - корень дерева
 * @param {number} target - искомое значение
 * @returns {TreeNode|null} узел с искомым значением или null
 */
function searchBST(node, target) {
  if (!node) return null;
  if (node.value === target) return node;

  if (target < node.value) {
    return searchBST(node.left, target);
  }
  return searchBST(node.right, target);
}

/**
 * Рекурсивная вставка в бинарное дерево поиска
 * @param {TreeNode} node - корень дерева
 * @param {number} value - вставляемое значение
 * @returns {TreeNode} корень дерева
 */
function insertBST(node, value) {
  if (!node) return new TreeNode(value);

  if (value < node.value) {
    node.left = insertBST(node.left, value);
  } else if (value > node.value) {
    node.right = insertBST(node.right, value);
  }

  return node;
}

/**
 * Рекурсивное удаление из бинарного дерева поиска
 * @param {TreeNode} node - корень дерева
 * @param {number} value - удаляемое значение
 * @returns {TreeNode} корень дерева
 */
function deleteBST(node, value) {
  if (!node) return null;

  if (value < node.value) {
    node.left = deleteBST(node.left, value);
    return node;
  }

  if (value > node.value) {
    node.right = deleteBST(node.right, value);
    return node;
  }

  // Нашли узел для удаления
  if (!node.left) return node.right;
  if (!node.right) return node.left;

  // Узел с двумя детьми - находим минимум в правом поддереве
  let minNode = node.right;
  while (minNode.left) {
    minNode = minNode.left;
  }

  node.value = minNode.value;
  node.right = deleteBST(node.right, minNode.value);

  return node;
}

// ============================================
// 9. ЭКСПОРТЫ
// ============================================

export {
  // Базовые рекурсивные функции
  factorial,
  factorialTailRecursive,
  fibonacci,
  fibonacciMemoized,
  sumRecursive,
  sumTailRecursive,

  // Рекурсивные функции с условиями
  power,
  powerFast,
  gcd,
  lcm,

  // Взаимно рекурсивные функции
  isEven,
  isOdd,
  ackermann,

  // Рекурсивные функции с массивами
  arraySumRecursive,
  arrayMaxRecursive,
  arrayReverseRecursive,
  isPalindrome,

  // Рекурсивные функции высшего порядка
  mapRecursive,
  filterRecursive,
  reduceRecursive,
  flatRecursive,

  // Рекурсивные алгоритмы
  quickSort,
  mergeSort,
  merge,
  binarySearchRecursive,
  permutations,
  subsets,

  // Рекурсивные функции с аккумуляторами
  statisticsRecursive,
  averageRecursive,

  // Рекурсивные функции для деревьев
  TreeNode,
  inOrderTraversal,
  preOrderTraversal,
  postOrderTraversal,
  searchBST,
  insertBST,
  deleteBST,
};

// ============================================
// 10. ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
// ============================================

/**
 * Пример использования всех функций
 * (закомментирован, так как это тестовый файл)
 */
/*
console.log('=== Рекурсивные функции ===');

// Базовые
console.log('factorial(5):', factorial(5));                 // 120
console.log('fibonacci(10):', fibonacci(10));               // 55
console.log('sumRecursive(10):', sumRecursive(10));         // 55

// С условиями
console.log('power(2, 10):', power(2, 10));                 // 1024
console.log('gcd(48, 18):', gcd(48, 18));                   // 6
console.log('lcm(12, 18):', lcm(12, 18));                   // 36

// Взаимная рекурсия
console.log('isEven(10):', isEven(10));                     // true
console.log('isOdd(10):', isOdd(10));                       // false
console.log('ackermann(2, 3):', ackermann(2, 3));           // 9

// Массивы
console.log('arraySumRecursive([1,2,3,4,5]):', arraySumRecursive([1,2,3,4,5])); // 15
console.log('isPalindrome("radar"):', isPalindrome("radar")); // true

// Алгоритмы
console.log('quickSort([5,3,8,1,9]):', quickSort([5,3,8,1,9])); // [1,3,5,8,9]
console.log('binarySearchRecursive([1,3,5,7,9], 5):', binarySearchRecursive([1,3,5,7,9], 5)); // 2

// Деревья
const root = new TreeNode(5);
insertBST(root, 3);
insertBST(root, 7);
insertBST(root, 1);
insertBST(root, 4);
console.log('inOrderTraversal(root):', inOrderTraversal(root)); // [1,3,4,5,7]
*/
