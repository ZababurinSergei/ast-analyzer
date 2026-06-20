// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/03-recursive-functions/index.js

// ============================================
// РЕКУРСИВНЫЕ ФУНКЦИИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все рекурсивные функции вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт базовых рекурсивных функций
import {
  factorial,
  factorialIterative,
  factorialTail,
  fibonacci,
  fibonacciIterative,
  fibonacciMemoized,
  sumRecursive,
  sumIterative,
  sumFormula,
  power,
  powerIterative,
  powerFast,
} from './modules/basic-recursion.js';

// Импорт рекурсивных функций для работы с массивами
import {
  arraySum,
  arrayProduct,
  arrayMax,
  arrayMin,
  arrayReverse,
  arrayFlatten,
  arrayFlattenDepth,
  arrayFilter,
  arrayMap,
  arrayReduce,
  binarySearchRecursive,
  binarySearchIterative,
  quickSortRecursive,
  quickSortIterative,
  mergeSortRecursive,
  mergeSortIterative,
} from './modules/array-recursion.js';

// Импорт рекурсивных функций для работы со строками
import {
  stringReverse,
  stringPalindrome,
  stringLength,
  stringSubstring,
  stringReplace,
  stringFind,
  stringCount,
  stringPermutations,
  stringCombinations,
  stringAnagrams,
  stringLevenshtein,
  stringLCS,
} from './modules/string-recursion.js';

// Импорт рекурсивных функций для работы с деревьями
import {
  treeTraversalDFS,
  treeTraversalBFS,
  treeHeight,
  treeDepth,
  treeSize,
  treeLeaves,
  treeSearch,
  treeInsert,
  treeRemove,
  treeBalance,
  treeValidate,
  treeSerialize,
  treeDeserialize,
  treeMirror,
  treeEqual,
  treeIsSubtree,
  treeLowestCommonAncestor,
} from './modules/tree-recursion.js';

// Импорт рекурсивных функций для работы с графами
import {
  graphDFS,
  graphBFS,
  graphHasPath,
  graphFindPath,
  graphFindAllPaths,
  graphShortestPath,
  graphIsConnected,
  graphHasCycle,
  graphTopologicalSort,
  graphDijkstra,
  graphBellmanFord,
  graphFloydWarshall,
  graphMinimumSpanningTree,
  graphIsBipartite,
  graphColor,
} from './modules/graph-recursion.js';

// ============================================
// БАЗОВЫЕ РЕКУРСИВНЫЕ ФУНКЦИИ (ОБЕРТКИ)
// ============================================

/**
 * Вычисляет факториал числа (рекурсивно)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Факториал числа
 */
function factorialWrapper(n) {
  return factorial(n);
}

/**
 * Вычисляет факториал числа (итеративно)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Факториал числа
 */
function factorialIterativeWrapper(n) {
  return factorialIterative(n);
}

/**
 * Вычисляет факториал числа (хвостовая рекурсия)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Факториал числа
 */
function factorialTailWrapper(n) {
  return factorialTail(n);
}

/**
 * Вычисляет число Фибоначчи (рекурсивно)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciWrapper(n) {
  return fibonacci(n);
}

/**
 * Вычисляет число Фибоначчи (итеративно)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciIterativeWrapper(n) {
  return fibonacciIterative(n);
}

/**
 * Вычисляет число Фибоначчи (с мемоизацией)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - n-е число Фибоначчи
 */
function fibonacciMemoizedWrapper(n) {
  return fibonacciMemoized(n);
}

/**
 * Вычисляет сумму чисел от 0 до n (рекурсивно)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Сумма чисел
 */
function sumRecursiveWrapper(n) {
  return sumRecursive(n);
}

/**
 * Вычисляет сумму чисел от 0 до n (итеративно)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Сумма чисел
 */
function sumIterativeWrapper(n) {
  return sumIterative(n);
}

/**
 * Вычисляет сумму чисел от 0 до n (по формуле)
 * @param {number} n - Неотрицательное целое число
 * @returns {number} - Сумма чисел
 */
function sumFormulaWrapper(n) {
  return sumFormula(n);
}

/**
 * Возводит число в степень (рекурсивно)
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени
 * @returns {number} - Результат возведения в степень
 */
function powerWrapper(base, exponent) {
  return power(base, exponent);
}

/**
 * Возводит число в степень (итеративно)
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени
 * @returns {number} - Результат возведения в степень
 */
function powerIterativeWrapper(base, exponent) {
  return powerIterative(base, exponent);
}

/**
 * Возводит число в степень (быстрый алгоритм)
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени
 * @returns {number} - Результат возведения в степень
 */
function powerFastWrapper(base, exponent) {
  return powerFast(base, exponent);
}

// ============================================
// РЕКУРСИВНЫЕ ФУНКЦИИ ДЛЯ МАССИВОВ (ОБЕРТКИ)
// ============================================

/**
 * Вычисляет сумму элементов массива (рекурсивно)
 * @param {Array} arr - Массив чисел
 * @returns {number} - Сумма элементов
 */
function arraySumWrapper(arr) {
  return arraySum(arr);
}

/**
 * Вычисляет произведение элементов массива (рекурсивно)
 * @param {Array} arr - Массив чисел
 * @returns {number} - Произведение элементов
 */
function arrayProductWrapper(arr) {
  return arrayProduct(arr);
}

/**
 * Находит максимальный элемент в массиве (рекурсивно)
 * @param {Array} arr - Массив чисел
 * @returns {number} - Максимальный элемент
 */
function arrayMaxWrapper(arr) {
  return arrayMax(arr);
}

/**
 * Находит минимальный элемент в массиве (рекурсивно)
 * @param {Array} arr - Массив чисел
 * @returns {number} - Минимальный элемент
 */
function arrayMinWrapper(arr) {
  return arrayMin(arr);
}

/**
 * Разворачивает массив (рекурсивно)
 * @param {Array} arr - Массив
 * @returns {Array} - Развернутый массив
 */
function arrayReverseWrapper(arr) {
  return arrayReverse(arr);
}

/**
 * Выполняет поиск в отсортированном массиве (рекурсивный бинарный поиск)
 * @param {Array} arr - Отсортированный массив
 * @param {*} target - Искомый элемент
 * @returns {number} - Индекс найденного элемента или -1
 */
function binarySearchRecursiveWrapper(arr, target) {
  return binarySearchRecursive(arr, target);
}

/**
 * Выполняет поиск в отсортированном массиве (итеративный бинарный поиск)
 * @param {Array} arr - Отсортированный массив
 * @param {*} target - Искомый элемент
 * @returns {number} - Индекс найденного элемента или -1
 */
function binarySearchIterativeWrapper(arr, target) {
  return binarySearchIterative(arr, target);
}

/**
 * Сортирует массив (рекурсивная быстрая сортировка)
 * @param {Array} arr - Массив для сортировки
 * @returns {Array} - Отсортированный массив
 */
function quickSortRecursiveWrapper(arr) {
  return quickSortRecursive(arr);
}

/**
 * Сортирует массив (рекурсивная сортировка слиянием)
 * @param {Array} arr - Массив для сортировки
 * @returns {Array} - Отсортированный массив
 */
function mergeSortRecursiveWrapper(arr) {
  return mergeSortRecursive(arr);
}

// ============================================
// РЕКУРСИВНЫЕ ФУНКЦИИ ДЛЯ СТРОК (ОБЕРТКИ)
// ============================================

/**
 * Разворачивает строку (рекурсивно)
 * @param {string} str - Строка
 * @returns {string} - Развернутая строка
 */
function stringReverseWrapper(str) {
  return stringReverse(str);
}

/**
 * Проверяет, является ли строка палиндромом (рекурсивно)
 * @param {string} str - Строка
 * @returns {boolean} - true если строка является палиндромом
 */
function stringPalindromeWrapper(str) {
  return stringPalindrome(str);
}

/**
 * Вычисляет длину строки (рекурсивно)
 * @param {string} str - Строка
 * @returns {number} - Длина строки
 */
function stringLengthWrapper(str) {
  return stringLength(str);
}

/**
 * Находит все перестановки строки
 * @param {string} str - Строка
 * @returns {string[]} - Массив всех перестановок
 */
function stringPermutationsWrapper(str) {
  return stringPermutations(str);
}

/**
 * Находит все комбинации строки
 * @param {string} str - Строка
 * @param {number} k - Размер комбинации
 * @returns {string[]} - Массив всех комбинаций
 */
function stringCombinationsWrapper(str, k) {
  return stringCombinations(str, k);
}

/**
 * Находит все анаграммы строки
 * @param {string} str - Строка
 * @returns {string[]} - Массив всех анаграмм
 */
function stringAnagramsWrapper(str) {
  return stringAnagrams(str);
}

/**
 * Вычисляет расстояние Левенштейна между двумя строками
 * @param {string} str1 - Первая строка
 * @param {string} str2 - Вторая строка
 * @returns {number} - Расстояние Левенштейна
 */
function stringLevenshteinWrapper(str1, str2) {
  return stringLevenshtein(str1, str2);
}

/**
 * Находит наибольшую общую подпоследовательность двух строк
 * @param {string} str1 - Первая строка
 * @param {string} str2 - Вторая строка
 * @returns {string} - Наибольшая общая подпоследовательность
 */
function stringLCSWrapper(str1, str2) {
  return stringLCS(str1, str2);
}

// ============================================
// РЕКУРСИВНЫЕ ФУНКЦИИ ДЛЯ ДЕРЕВЬЕВ (ОБЕРТКИ)
// ============================================

/**
 * Выполняет обход дерева в глубину (DFS)
 * @param {Object} root - Корень дерева
 * @param {string} order - Порядок обхода ('pre', 'in', 'post')
 * @returns {Array} - Массив узлов в порядке обхода
 */
function treeTraversalDFSWrapper(root, order = 'pre') {
  return treeTraversalDFS(root, order);
}

/**
 * Выполняет обход дерева в ширину (BFS)
 * @param {Object} root - Корень дерева
 * @returns {Array} - Массив узлов в порядке обхода
 */
function treeTraversalBFSWrapper(root) {
  return treeTraversalBFS(root);
}

/**
 * Вычисляет высоту дерева
 * @param {Object} root - Корень дерева
 * @returns {number} - Высота дерева
 */
function treeHeightWrapper(root) {
  return treeHeight(root);
}

/**
 * Вычисляет размер дерева (количество узлов)
 * @param {Object} root - Корень дерева
 * @returns {number} - Размер дерева
 */
function treeSizeWrapper(root) {
  return treeSize(root);
}

/**
 * Находит все листья дерева
 * @param {Object} root - Корень дерева
 * @returns {Array} - Массив листьев
 */
function treeLeavesWrapper(root) {
  return treeLeaves(root);
}

/**
 * Выполняет поиск узла в дереве
 * @param {Object} root - Корень дерева
 * @param {*} value - Искомое значение
 * @returns {Object|null} - Найденный узел или null
 */
function treeSearchWrapper(root, value) {
  return treeSearch(root, value);
}

/**
 * Создает зеркальное отображение дерева
 * @param {Object} root - Корень дерева
 * @returns {Object} - Зеркальное отображение дерева
 */
function treeMirrorWrapper(root) {
  return treeMirror(root);
}

/**
 * Проверяет, являются ли два дерева равными
 * @param {Object} root1 - Корень первого дерева
 * @param {Object} root2 - Корень второго дерева
 * @returns {boolean} - true если деревья равны
 */
function treeEqualWrapper(root1, root2) {
  return treeEqual(root1, root2);
}

/**
 * Находит наименьшего общего предка двух узлов
 * @param {Object} root - Корень дерева
 * @param {Object} node1 - Первый узел
 * @param {Object} node2 - Второй узел
 * @returns {Object|null} - Наименьший общий предок или null
 */
function treeLowestCommonAncestorWrapper(root, node1, node2) {
  return treeLowestCommonAncestor(root, node1, node2);
}

// ============================================
// РЕКУРСИВНЫЕ ФУНКЦИИ ДЛЯ ГРАФОВ (ОБЕРТКИ)
// ============================================

/**
 * Выполняет обход графа в глубину (DFS)
 * @param {Object} graph - Граф
 * @param {*} start - Стартовая вершина
 * @returns {Array} - Массив вершин в порядке обхода
 */
function graphDFSWrapper(graph, start) {
  return graphDFS(graph, start);
}

/**
 * Выполняет обход графа в ширину (BFS)
 * @param {Object} graph - Граф
 * @param {*} start - Стартовая вершина
 * @returns {Array} - Массив вершин в порядке обхода
 */
function graphBFSWrapper(graph, start) {
  return graphBFS(graph, start);
}

/**
 * Проверяет наличие пути между вершинами
 * @param {Object} graph - Граф
 * @param {*} start - Начальная вершина
 * @param {*} end - Конечная вершина
 * @returns {boolean} - true если путь существует
 */
function graphHasPathWrapper(graph, start, end) {
  return graphHasPath(graph, start, end);
}

/**
 * Находит все пути между вершинами
 * @param {Object} graph - Граф
 * @param {*} start - Начальная вершина
 * @param {*} end - Конечная вершина
 * @returns {Array} - Массив всех путей
 */
function graphFindAllPathsWrapper(graph, start, end) {
  return graphFindAllPaths(graph, start, end);
}

/**
 * Находит кратчайший путь между вершинами (алгоритм Дейкстры)
 * @param {Object} graph - Граф
 * @param {*} start - Начальная вершина
 * @param {*} end - Конечная вершина
 * @returns {Array} - Кратчайший путь
 */
function graphShortestPathWrapper(graph, start, end) {
  return graphShortestPath(graph, start, end);
}

/**
 * Проверяет, является ли граф связным
 * @param {Object} graph - Граф
 * @returns {boolean} - true если граф связный
 */
function graphIsConnectedWrapper(graph) {
  return graphIsConnected(graph);
}

/**
 * Проверяет наличие циклов в графе
 * @param {Object} graph - Граф
 * @returns {boolean} - true если есть циклы
 */
function graphHasCycleWrapper(graph) {
  return graphHasCycle(graph);
}

/**
 * Выполняет топологическую сортировку графа
 * @param {Object} graph - Граф
 * @returns {Array} - Топологически отсортированные вершины
 */
function graphTopologicalSortWrapper(graph) {
  return graphTopologicalSort(graph);
}

// ============================================
// КОМБИНИРОВАННЫЕ РЕКУРСИВНЫЕ ФУНКЦИИ
// ============================================

/**
 * Вычисляет n-й член последовательности (обобщенная рекурсия)
 * @param {number} n - Номер члена последовательности
 * @param {Function} recurrence - Функция рекуррентного соотношения
 * @param {Array} baseCases - Базовые случаи
 * @returns {number} - n-й член последовательности
 */
function generalizedRecurrence(n, recurrence, baseCases) {
  if (n < baseCases.length) {
    return baseCases[n];
  }
  const previousValues = [];
  for (let i = 1; i <= baseCases.length; i++) {
    previousValues.push(generalizedRecurrence(n - i, recurrence, baseCases));
  }
  return recurrence(...previousValues);
}

/**
 * Вычисляет n-й член последовательности (с мемоизацией)
 * @param {number} n - Номер члена последовательности
 * @param {Function} recurrence - Функция рекуррентного соотношения
 * @param {Array} baseCases - Базовые случаи
 * @returns {number} - n-й член последовательности
 */
function generalizedRecurrenceMemoized(n, recurrence, baseCases) {
  const memo = new Map();

  function helper(k) {
    if (k < baseCases.length) {
      return baseCases[k];
    }
    if (memo.has(k)) {
      return memo.get(k);
    }
    const previousValues = [];
    for (let i = 1; i <= baseCases.length; i++) {
      previousValues.push(helper(k - i));
    }
    const result = recurrence(...previousValues);
    memo.set(k, result);
    return result;
  }

  return helper(n);
}

/**
 * Вычисляет числа Каталана
 * @param {number} n - Номер числа Каталана
 * @returns {number} - n-е число Каталана
 */
function catalanNumber(n) {
  if (n <= 1) return 1;

  let result = 0;
  for (let i = 0; i < n; i++) {
    result += catalanNumber(i) * catalanNumber(n - 1 - i);
  }
  return result;
}

/**
 * Вычисляет числа Стирлинга второго рода
 * @param {number} n - Количество элементов
 * @param {number} k - Количество подмножеств
 * @returns {number} - Число Стирлинга
 */
function stirlingNumber(n, k) {
  if (n === 0 && k === 0) return 1;
  if (n === 0 || k === 0) return 0;
  if (k === 1 || k === n) return 1;
  return stirlingNumber(n - 1, k - 1) + k * stirlingNumber(n - 1, k);
}

/**
 * Вычисляет числа Белла (количество разбиений множества)
 * @param {number} n - Количество элементов
 * @returns {number} - Число Белла
 */
function bellNumber(n) {
  if (n <= 1) return 1;

  const stirling = new Array(n + 1).fill(0);
  let result = 0;
  for (let k = 1; k <= n; k++) {
    stirling[k] = stirlingNumber(n, k);
    result += stirling[k];
  }
  return result;
}

/**
 * Вычисляет числа Эйлера (количество перестановок с заданным числом подъемов)
 * @param {number} n - Количество элементов
 * @param {number} k - Количество подъемов
 * @returns {number} - Число Эйлера
 */
function eulerianNumber(n, k) {
  if (k === 0) return 1;
  if (k === n - 1) return 1;
  if (k >= n) return 0;

  return (n - k) * eulerianNumber(n - 1, k - 1) + (k + 1) * eulerianNumber(n - 1, k);
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт базовых рекурсивных функций
export {
  factorial,
  factorialIterative,
  factorialTail,
  fibonacci,
  fibonacciIterative,
  fibonacciMemoized,
  sumRecursive,
  sumIterative,
  sumFormula,
  power,
  powerIterative,
  powerFast,
};

// Реэкспорт рекурсивных функций для массивов
export {
  arraySum,
  arrayProduct,
  arrayMax,
  arrayMin,
  arrayReverse,
  arrayFlatten,
  arrayFlattenDepth,
  arrayFilter,
  arrayMap,
  arrayReduce,
  binarySearchRecursive,
  binarySearchIterative,
  quickSortRecursive,
  quickSortIterative,
  mergeSortRecursive,
  mergeSortIterative,
};

// Реэкспорт рекурсивных функций для строк
export {
  stringReverse,
  stringPalindrome,
  stringLength,
  stringSubstring,
  stringReplace,
  stringFind,
  stringCount,
  stringPermutations,
  stringCombinations,
  stringAnagrams,
  stringLevenshtein,
  stringLCS,
};

// Реэкспорт рекурсивных функций для деревьев
export {
  treeTraversalDFS,
  treeTraversalBFS,
  treeHeight,
  treeDepth,
  treeSize,
  treeLeaves,
  treeSearch,
  treeInsert,
  treeRemove,
  treeBalance,
  treeValidate,
  treeSerialize,
  treeDeserialize,
  treeMirror,
  treeEqual,
  treeIsSubtree,
  treeLowestCommonAncestor,
};

// Реэкспорт рекурсивных функций для графов
export {
  graphDFS,
  graphBFS,
  graphHasPath,
  graphFindPath,
  graphFindAllPaths,
  graphShortestPath,
  graphIsConnected,
  graphHasCycle,
  graphTopologicalSort,
  graphDijkstra,
  graphBellmanFord,
  graphFloydWarshall,
  graphMinimumSpanningTree,
  graphIsBipartite,
  graphColor,
};

// Реэкспорт комбинированных функций
export {
  generalizedRecurrence,
  generalizedRecurrenceMemoized,
  catalanNumber,
  stirlingNumber,
  bellNumber,
  eulerianNumber,
};

// Реэкспорт оберток
export {
  factorialWrapper,
  factorialIterativeWrapper,
  factorialTailWrapper,
  fibonacciWrapper,
  fibonacciIterativeWrapper,
  fibonacciMemoizedWrapper,
  sumRecursiveWrapper,
  sumIterativeWrapper,
  sumFormulaWrapper,
  powerWrapper,
  powerIterativeWrapper,
  powerFastWrapper,
  arraySumWrapper,
  arrayProductWrapper,
  arrayMaxWrapper,
  arrayMinWrapper,
  arrayReverseWrapper,
  binarySearchRecursiveWrapper,
  binarySearchIterativeWrapper,
  quickSortRecursiveWrapper,
  mergeSortRecursiveWrapper,
  stringReverseWrapper,
  stringPalindromeWrapper,
  stringLengthWrapper,
  stringPermutationsWrapper,
  stringCombinationsWrapper,
  stringAnagramsWrapper,
  stringLevenshteinWrapper,
  stringLCSWrapper,
  treeTraversalDFSWrapper,
  treeTraversalBFSWrapper,
  treeHeightWrapper,
  treeSizeWrapper,
  treeLeavesWrapper,
  treeSearchWrapper,
  treeMirrorWrapper,
  treeEqualWrapper,
  treeLowestCommonAncestorWrapper,
  graphDFSWrapper,
  graphBFSWrapper,
  graphHasPathWrapper,
  graphFindAllPathsWrapper,
  graphShortestPathWrapper,
  graphIsConnectedWrapper,
  graphHasCycleWrapper,
  graphTopologicalSortWrapper,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с рекурсивными функциями
 */
export default {
  // Базовые рекурсивные функции
  factorial,
  factorialIterative,
  factorialTail,
  fibonacci,
  fibonacciIterative,
  fibonacciMemoized,
  sumRecursive,
  sumIterative,
  sumFormula,
  power,
  powerIterative,
  powerFast,

  // Рекурсивные функции для массивов
  arraySum,
  arrayProduct,
  arrayMax,
  arrayMin,
  arrayReverse,
  arrayFlatten,
  arrayFlattenDepth,
  arrayFilter,
  arrayMap,
  arrayReduce,
  binarySearchRecursive,
  binarySearchIterative,
  quickSortRecursive,
  quickSortIterative,
  mergeSortRecursive,
  mergeSortIterative,

  // Рекурсивные функции для строк
  stringReverse,
  stringPalindrome,
  stringLength,
  stringSubstring,
  stringReplace,
  stringFind,
  stringCount,
  stringPermutations,
  stringCombinations,
  stringAnagrams,
  stringLevenshtein,
  stringLCS,

  // Рекурсивные функции для деревьев
  treeTraversalDFS,
  treeTraversalBFS,
  treeHeight,
  treeDepth,
  treeSize,
  treeLeaves,
  treeSearch,
  treeInsert,
  treeRemove,
  treeBalance,
  treeValidate,
  treeSerialize,
  treeDeserialize,
  treeMirror,
  treeEqual,
  treeIsSubtree,
  treeLowestCommonAncestor,

  // Рекурсивные функции для графов
  graphDFS,
  graphBFS,
  graphHasPath,
  graphFindPath,
  graphFindAllPaths,
  graphShortestPath,
  graphIsConnected,
  graphHasCycle,
  graphTopologicalSort,
  graphDijkstra,
  graphBellmanFord,
  graphFloydWarshall,
  graphMinimumSpanningTree,
  graphIsBipartite,
  graphColor,

  // Комбинированные функции
  generalizedRecurrence,
  generalizedRecurrenceMemoized,
  catalanNumber,
  stirlingNumber,
  bellNumber,
  eulerianNumber,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Базовые рекурсивные функции вынесены в modules/basic-recursion.js:
 *    - factorial, factorialIterative, factorialTail
 *    - fibonacci, fibonacciIterative, fibonacciMemoized
 *    - sumRecursive, sumIterative, sumFormula
 *    - power, powerIterative, powerFast
 *
 * 2. Рекурсивные функции для массивов вынесены в modules/array-recursion.js:
 *    - arraySum, arrayProduct, arrayMax, arrayMin, arrayReverse
 *    - arrayFlatten, arrayFlattenDepth
 *    - arrayFilter, arrayMap, arrayReduce
 *    - binarySearchRecursive, binarySearchIterative
 *    - quickSortRecursive, quickSortIterative
 *    - mergeSortRecursive, mergeSortIterative
 *
 * 3. Рекурсивные функции для строк вынесены в modules/string-recursion.js:
 *    - stringReverse, stringPalindrome, stringLength
 *    - stringSubstring, stringReplace, stringFind, stringCount
 *    - stringPermutations, stringCombinations, stringAnagrams
 *    - stringLevenshtein, stringLCS
 *
 * 4. Рекурсивные функции для деревьев вынесены в modules/tree-recursion.js:
 *    - treeTraversalDFS, treeTraversalBFS
 *    - treeHeight, treeDepth, treeSize, treeLeaves
 *    - treeSearch, treeInsert, treeRemove, treeBalance
 *    - treeValidate, treeSerialize, treeDeserialize
 *    - treeMirror, treeEqual, treeIsSubtree
 *    - treeLowestCommonAncestor
 *
 * 5. Рекурсивные функции для графов вынесены в modules/graph-recursion.js:
 *    - graphDFS, graphBFS
 *    - graphHasPath, graphFindPath, graphFindAllPaths
 *    - graphShortestPath, graphIsConnected, graphHasCycle
 *    - graphTopologicalSort, graphDijkstra, graphBellmanFord
 *    - graphFloydWarshall, graphMinimumSpanningTree
 *    - graphIsBipartite, graphColor
 *
 * 6. Комбинированные функции остаются в index.js:
 *    - generalizedRecurrence, generalizedRecurrenceMemoized
 *    - catalanNumber, stirlingNumber, bellNumber, eulerianNumber
 *
 * 7. Добавлены JSDoc комментарии для всех функций
 *
 * 8. Сохранена обратная совместимость через реэкспорты
 *
 * 9. Добавлены обертки для удобства использования
 *
 * 10. Все функции имеют обработку граничных случаев
 */
