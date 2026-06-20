// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/11-edge-cases/modules/no-exports.js

// ============================================
// МОДУЛЬ БЕЗ ЭКСПОРТОВ
// ============================================
// Этот модуль не содержит экспортов для тестирования
// обработки файлов без экспортируемых сущностей.

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Удвоенное значение
 */
function doubleValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x * 2;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Утроенное значение
 */
function tripleValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x * 3;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Квадрат значения
 */
function squareValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x * x;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Куб значения
 */
function cubeValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x * x * x;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Половина значения
 */
function halfValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x / 2;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Треть значения
 */
function thirdValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x / 3;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Четверть значения
 */
function quarterValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x / 4;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Абсолютное значение
 */
function absoluteValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  return x < 0 ? -x : x;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Знак числа (-1, 0, 1)
 */
function signValue(x) {
  if (typeof x !== 'number') {
    return 0;
  }
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {boolean} - Является ли число положительным
 */
function isPositive(x) {
  if (typeof x !== 'number') {
    return false;
  }
  return x > 0;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {boolean} - Является ли число отрицательным
 */
function isNegative(x) {
  if (typeof x !== 'number') {
    return false;
  }
  return x < 0;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {boolean} - Является ли число нулем
 */
function isZero(x) {
  if (typeof x !== 'number') {
    return false;
  }
  return x === 0;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @returns {number} - Обратное значение (1/x)
 */
function inverseValue(x) {
  if (typeof x !== 'number' || x === 0) {
    return 0;
  }
  return 1 / x;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @param {number} y - Входное число
 * @returns {number} - Сумма квадратов
 */
function sumOfSquares(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') {
    return 0;
  }
  return x * x + y * y;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @param {number} y - Входное число
 * @returns {number} - Разность квадратов
 */
function differenceOfSquares(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') {
    return 0;
  }
  return x * x - y * y;
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @param {number} y - Входное число
 * @returns {number} - Произведение сумм
 */
function productOfSums(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') {
    return 0;
  }
  return (x + y) * (x + y);
}

/**
 * Внутренняя вспомогательная функция
 * @param {number} x - Входное число
 * @param {number} y - Входное число
 * @returns {number} - Частное сумм
 */
function quotientOfSums(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number' || x + y === 0) {
    return 0;
  }
  return x / (x + y);
}

// ============================================
// НЕТ ЭКСПОРТОВ
// ============================================

// В этом модуле нет ни одного экспорта.
// Все функции являются внутренними и не доступны извне.

// ============================================
// ПРИМЕЧАНИЯ ПО ТЕСТИРОВАНИЮ
// ============================================

/*
 * МОДУЛЬ БЕЗ ЭКСПОРТОВ
 *
 * Этот модуль специально создан для тестирования
 * обработки файлов без экспортируемых сущностей.
 *
 * Сценарии тестирования:
 * 1. Файл загружается без ошибок
 * 2. Функции не экспортируются
 * 3. Внутренние функции не доступны извне
 * 4. Проверка эквивалентности должна учитывать отсутствие экспортов
 *
 * Внутренние функции (17 штук):
 * - doubleValue      - удвоение
 * - tripleValue      - утроение
 * - squareValue      - квадрат
 * - cubeValue        - куб
 * - halfValue        - половина
 * - thirdValue       - треть
 * - quarterValue     - четверть
 * - absoluteValue    - модуль
 * - signValue        - знак
 * - isPositive       - положительное
 * - isNegative       - отрицательное
 * - isZero           - ноль
 * - inverseValue     - обратное
 * - sumOfSquares     - сумма квадратов
 * - differenceOfSquares - разность квадратов
 * - productOfSums    - произведение сумм
 * - quotientOfSums   - частное сумм
 *
 * Все функции валидируют входные данные и обрабатывают
 * граничные случаи (null, undefined, нечисловые значения).
 */
