// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/02-array-operations/modules/transform.js

// ============================================
// МОДУЛЬ ТРАНСФОРМАЦИИ МАССИВОВ
// ============================================
// Этот модуль содержит функции для трансформации,
// фильтрации и модификации массивов.

/**
 * Трансформирует массив с применением функции к каждому элементу
 * @param {Array} arr - Исходный массив
 * @param {Function} transformFn - Функция трансформации
 * @returns {Array} - Новый массив с трансформированными элементами
 */
function mapArray(arr, transformFn) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (typeof transformFn !== 'function') {
    throw new TypeError('Expected a function');
  }

  const result = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(transformFn(arr[i], i, arr));
  }
  return result;
}

/**
 * Фильтрует массив по условию
 * @param {Array} arr - Исходный массив
 * @param {Function} predicate - Функция-предикат
 * @returns {Array} - Новый массив с элементами, удовлетворяющими условию
 */
function filterArray(arr, predicate) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (typeof predicate !== 'function') {
    throw new TypeError('Expected a function');
  }

  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
}

/**
 * Редуцирует массив к одному значению
 * @param {Array} arr - Исходный массив
 * @param {Function} reducer - Функция редукции
 * @param {any} initialValue - Начальное значение
 * @returns {any} - Результат редукции
 */
function reduceArray(arr, reducer, initialValue) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (typeof reducer !== 'function') {
    throw new TypeError('Expected a function');
  }

  let accumulator = initialValue !== undefined ? initialValue : arr[0];
  let startIndex = initialValue !== undefined ? 0 : 1;

  for (let i = startIndex; i < arr.length; i++) {
    accumulator = reducer(accumulator, arr[i], i, arr);
  }
  return accumulator;
}

/**
 * Плоский массив (разворачивает вложенные массивы на один уровень)
 * @param {Array} arr - Исходный массив
 * @param {number} depth - Глубина разворачивания
 * @returns {Array} - Плоский массив
 */
function flattenArray(arr, depth = 1) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [];
  for (const item of arr) {
    if (Array.isArray(item) && depth > 0) {
      result.push(...flattenArray(item, depth - 1));
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Группирует элементы массива по ключу
 * @param {Array} arr - Исходный массив
 * @param {Function|string} keyExtractor - Функция извлечения ключа или имя ключа
 * @returns {Object} - Объект с группами
 */
function groupBy(arr, keyExtractor) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof keyExtractor === 'function' ? keyExtractor : item => item[keyExtractor];

  const result = {};
  for (const item of arr) {
    const key = getKey(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

/**
 * Сортирует массив с использованием стабильного алгоритма
 * @param {Array} arr - Исходный массив
 * @param {Function} compareFn - Функция сравнения
 * @returns {Array} - Отсортированный массив
 */
function stableSort(arr, compareFn) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  // Добавляем индекс для стабильности
  const indexed = arr.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    const result = compareFn(a.item, b.item);
    return result !== 0 ? result : a.index - b.index;
  });

  return indexed.map(({ item }) => item);
}

/**
 * Удаляет дубликаты из массива
 * @param {Array} arr - Исходный массив
 * @param {Function} keyExtractor - Функция извлечения ключа (опционально)
 * @returns {Array} - Массив без дубликатов
 */
function uniqueArray(arr, keyExtractor = null) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  if (keyExtractor) {
    const seen = new Map();
    const result = [];
    for (const item of arr) {
      const key = keyExtractor(item);
      if (!seen.has(key)) {
        seen.set(key, true);
        result.push(item);
      }
    }
    return result;
  }

  return [...new Set(arr)];
}

/**
 * Объединяет несколько массивов в один
 * @param {...Array} arrays - Массивы для объединения
 * @returns {Array} - Объединенный массив
 */
function concatArrays(...arrays) {
  const result = [];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) {
      throw new TypeError('All arguments must be arrays');
    }
    result.push(...arr);
  }
  return result;
}

/**
 * Разбивает массив на части указанного размера
 * @param {Array} arr - Исходный массив
 * @param {number} size - Размер части
 * @returns {Array<Array>} - Массив частей
 */
function chunkArray(arr, size) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (size <= 0) {
    throw new Error('Size must be greater than 0');
  }

  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Разбивает массив на две части по условию
 * @param {Array} arr - Исходный массив
 * @param {Function} predicate - Функция-предикат
 * @returns {[Array, Array]} - Массив с двумя частями
 */
function partitionArray(arr, predicate) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (typeof predicate !== 'function') {
    throw new TypeError('Expected a function');
  }

  const truthy = [];
  const falsy = [];

  for (const item of arr) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }

  return [truthy, falsy];
}

/**
 * Перемешивает массив случайным образом (алгоритм Фишера-Йетса)
 * @param {Array} arr - Исходный массив
 * @returns {Array} - Перемешанный массив
 */
function shuffleArray(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Реверсирует массив (без изменения оригинального)
 * @param {Array} arr - Исходный массив
 * @returns {Array} - Реверсированный массив
 */
function reverseArray(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const result = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    result.push(arr[i]);
  }
  return result;
}

/**
 * Заполняет массив значениями
 * @param {number} length - Длина массива
 * @param {any} value - Значение для заполнения
 * @returns {Array} - Заполненный массив
 */
function fillArray(length, value) {
  if (length < 0) {
    throw new Error('Length must be non-negative');
  }

  const result = new Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = typeof value === 'function' ? value(i) : value;
  }
  return result;
}

/**
 * Создает массив чисел в заданном диапазоне
 * @param {number} start - Начало диапазона
 * @param {number} end - Конец диапазона (не включается)
 * @param {number} step - Шаг (по умолчанию 1)
 * @returns {Array<number>} - Массив чисел
 */
function rangeArray(start, end, step = 1) {
  if (step === 0) {
    throw new Error('Step cannot be zero');
  }

  const result = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
  } else {
    for (let i = start; i > end; i += step) {
      result.push(i);
    }
  }
  return result;
}

/**
 * Выбирает случайный элемент из массива
 * @param {Array} arr - Исходный массив
 * @returns {any} - Случайный элемент
 */
function randomItem(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Array must not be empty');
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Выбирает несколько случайных элементов из массива
 * @param {Array} arr - Исходный массив
 * @param {number} count - Количество элементов
 * @returns {Array} - Массив случайных элементов
 */
function randomItems(arr, count) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Array must not be empty');
  }
  if (count > arr.length) {
    throw new Error('Count cannot exceed array length');
  }

  const shuffled = shuffleArray(arr);
  return shuffled.slice(0, count);
}

/**
 * Транспонирует массив (меняет строки и столбцы местами)
 * @param {Array<Array>} matrix - Двумерный массив
 * @returns {Array<Array>} - Транспонированный массив
 */
function transposeArray(matrix) {
  if (!Array.isArray(matrix) || !Array.isArray(matrix[0])) {
    throw new TypeError('Expected a 2D array');
  }

  const rows = matrix.length;
  const cols = matrix[0].length;

  const result = [];
  for (let j = 0; j < cols; j++) {
    result[j] = [];
    for (let i = 0; i < rows; i++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
}

/**
 * Преобразует массив в объект по ключу
 * @param {Array} arr - Исходный массив
 * @param {Function|string} keyExtractor - Функция извлечения ключа или имя ключа
 * @returns {Object} - Объект с элементами по ключам
 */
function arrayToObject(arr, keyExtractor) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof keyExtractor === 'function' ? keyExtractor : item => item[keyExtractor];

  const result = {};
  for (const item of arr) {
    const key = getKey(item);
    result[key] = item;
  }
  return result;
}

/**
 * Преобразует массив в Map по ключу
 * @param {Array} arr - Исходный массив
 * @param {Function|string} keyExtractor - Функция извлечения ключа или имя ключа
 * @returns {Map} - Map с элементами по ключам
 */
function arrayToMap(arr, keyExtractor) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }

  const getKey = typeof keyExtractor === 'function' ? keyExtractor : item => item[keyExtractor];

  const result = new Map();
  for (const item of arr) {
    const key = getKey(item);
    result.set(key, item);
  }
  return result;
}

/**
 * Применяет функцию к каждому элементу массива с задержкой
 * @param {Array} arr - Исходный массив
 * @param {Function} fn - Функция для применения
 * @param {number} delayMs - Задержка в миллисекундах
 * @returns {Promise<Array>} - Promise с результатами
 */
async function asyncMapArray(arr, fn, delayMs = 0) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Expected a function');
  }

  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    result.push(await fn(arr[i], i, arr));
  }
  return result;
}

/**
 * Параллельно применяет функцию к элементам массива
 * @param {Array} arr - Исходный массив
 * @param {Function} fn - Функция для применения
 * @param {number} concurrency - Количество параллельных операций
 * @returns {Promise<Array>} - Promise с результатами
 */
async function parallelMapArray(arr, fn, concurrency = 5) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Expected a function');
  }

  const results = new Array(arr.length);
  const chunks = chunkArray(
    arr.map((item, index) => ({ item, index })),
    concurrency
  );

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async ({ item, index }) => {
        results[index] = await fn(item, index, arr);
      })
    );
  }

  return results;
}

/**
 * Фильтрует массив асинхронно
 * @param {Array} arr - Исходный массив
 * @param {Function} predicate - Асинхронная функция-предикат
 * @param {number} concurrency - Количество параллельных операций
 * @returns {Promise<Array>} - Promise с отфильтрованным массивом
 */
async function asyncFilterArray(arr, predicate, concurrency = 5) {
  if (!Array.isArray(arr)) {
    throw new TypeError('Expected an array');
  }
  if (typeof predicate !== 'function') {
    throw new TypeError('Expected a function');
  }

  const results = await parallelMapArray(arr, predicate, concurrency);
  return arr.filter((_, index) => results[index]);
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые трансформации
  mapArray,
  filterArray,
  reduceArray,
  flattenArray,
  groupBy,
  stableSort,
  uniqueArray,
  concatArrays,
  chunkArray,
  partitionArray,
  shuffleArray,
  reverseArray,
  fillArray,
  rangeArray,
  randomItem,
  randomItems,
  transposeArray,
  arrayToObject,
  arrayToMap,

  // Асинхронные трансформации
  asyncMapArray,
  parallelMapArray,
  asyncFilterArray,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями трансформации
 */
export default {
  mapArray,
  filterArray,
  reduceArray,
  flattenArray,
  groupBy,
  stableSort,
  uniqueArray,
  concatArrays,
  chunkArray,
  partitionArray,
  shuffleArray,
  reverseArray,
  fillArray,
  rangeArray,
  randomItem,
  randomItems,
  transposeArray,
  arrayToObject,
  arrayToMap,
  asyncMapArray,
  parallelMapArray,
  asyncFilterArray,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ТРАНСФОРМАЦИИ МАССИВОВ
 *
 * Этот модуль предоставляет функции для трансформации массивов:
 *
 * Базовые трансформации:
 * 1. mapArray        - Применение функции к каждому элементу
 * 2. filterArray     - Фильтрация по условию
 * 3. reduceArray     - Редукция к одному значению
 * 4. flattenArray    - Разворачивание вложенных массивов
 * 5. groupBy         - Группировка по ключу
 * 6. stableSort      - Стабильная сортировка
 * 7. uniqueArray     - Удаление дубликатов
 * 8. concatArrays    - Объединение массивов
 * 9. chunkArray      - Разбиение на части
 * 10. partitionArray - Разбиение по условию
 * 11. shuffleArray   - Перемешивание
 * 12. reverseArray   - Реверсирование
 * 13. fillArray      - Заполнение значениями
 * 14. rangeArray     - Создание диапазона чисел
 * 15. randomItem     - Случайный элемент
 * 16. randomItems    - Несколько случайных элементов
 * 17. transposeArray - Транспонирование матрицы
 * 18. arrayToObject  - Преобразование в объект
 * 19. arrayToMap     - Преобразование в Map
 *
 * Асинхронные трансформации:
 * 20. asyncMapArray      - Асинхронный map с задержкой
 * 21. parallelMapArray   - Параллельный map
 * 22. asyncFilterArray   - Асинхронная фильтрация
 *
 * Все функции:
 * - Работают с копией массива (не изменяют оригинал)
 * - Имеют валидацию входных данных
 * - Поддерживают работу с большими массивами
 * - Имеют JSDoc с описанием
 */
