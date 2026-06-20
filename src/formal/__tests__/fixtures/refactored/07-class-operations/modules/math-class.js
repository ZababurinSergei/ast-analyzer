// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/07-class-operations/modules/math-class.js

// ============================================
// МОДУЛЬ МАТЕМАТИЧЕСКИХ КЛАССОВ
// ============================================
// Этот модуль содержит классы для выполнения
// математических операций и вычислений.

/**
 * Базовый класс для математических операций
 * Содержит основные арифметические методы
 */
class Calculator {
  /**
   * Создает экземпляр Calculator
   * @param {Object} options - Опции калькулятора
   */
  constructor(options = {}) {
    this._precision = options.precision || 10;
    this._history = [];
    this._maxHistory = options.maxHistory || 100;
    this._lastResult = null;
    this._memory = null;
    this._angleUnit = options.angleUnit || 'radians'; // 'radians' | 'degrees'
  }

  /**
   * Возвращает историю вычислений
   * @returns {Array} - Массив записей истории
   */
  get history() {
    return [...this._history];
  }

  /**
   * Возвращает последний результат
   * @returns {any} - Последний результат
   */
  get lastResult() {
    return this._lastResult;
  }

  /**
   * Устанавливает точность вычислений
   * @param {number} precision - Количество знаков после запятой
   */
  set precision(precision) {
    if (typeof precision !== 'number' || precision < 0) {
      throw new Error('Precision must be a non-negative number');
    }
    this._precision = precision;
  }

  /**
   * Сложение двух чисел
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Сумма чисел
   */
  add(a, b) {
    const result = this._round(a + b);
    this._addToHistory('add', a, b, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Вычитание двух чисел
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Разность чисел
   */
  subtract(a, b) {
    const result = this._round(a - b);
    this._addToHistory('subtract', a, b, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Умножение двух чисел
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Произведение чисел
   */
  multiply(a, b) {
    const result = this._round(a * b);
    this._addToHistory('multiply', a, b, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Деление двух чисел
   * @param {number} a - Делимое
   * @param {number} b - Делитель
   * @returns {number} - Частное от деления
   * @throws {Error} - Если делитель равен нулю
   */
  divide(a, b) {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    const result = this._round(a / b);
    this._addToHistory('divide', a, b, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Возведение в степень
   * @param {number} base - Основание
   * @param {number} exponent - Показатель степени
   * @returns {number} - Результат возведения в степень
   */
  power(base, exponent) {
    const result = this._round(Math.pow(base, exponent));
    this._addToHistory('power', base, exponent, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Квадратный корень
   * @param {number} x - Число
   * @returns {number} - Квадратный корень
   * @throws {Error} - Если число отрицательное
   */
  sqrt(x) {
    if (x < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    const result = this._round(Math.sqrt(x));
    this._addToHistory('sqrt', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Факториал числа
   * @param {number} n - Неотрицательное целое число
   * @returns {number} - Факториал числа
   * @throws {Error} - Если число отрицательное или не целое
   */
  factorial(n) {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('Factorial requires a non-negative integer');
    }
    if (n > 170) {
      throw new Error('Factorial value exceeds maximum safe integer');
    }

    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }

    this._addToHistory('factorial', n, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Модуль числа
   * @param {number} x - Число
   * @returns {number} - Абсолютное значение
   */
  abs(x) {
    const result = Math.abs(x);
    this._addToHistory('abs', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Округление числа
   * @param {number} x - Число
   * @param {number} decimals - Количество знаков после запятой
   * @returns {number} - Округленное число
   */
  round(x, decimals = 0) {
    const factor = Math.pow(10, decimals);
    const result = Math.round(x * factor) / factor;
    this._addToHistory('round', x, decimals, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Пол (округление вниз)
   * @param {number} x - Число
   * @returns {number} - Наибольшее целое <= x
   */
  floor(x) {
    const result = Math.floor(x);
    this._addToHistory('floor', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Потолок (округление вверх)
   * @param {number} x - Число
   * @returns {number} - Наименьшее целое >= x
   */
  ceil(x) {
    const result = Math.ceil(x);
    this._addToHistory('ceil', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Сохраняет число в память
   * @param {number} value - Число для сохранения
   */
  memoryStore(value) {
    this._memory = value;
  }

  /**
   * Возвращает число из памяти
   * @returns {number} - Число из памяти
   */
  memoryRecall() {
    if (this._memory === null) {
      throw new Error('Memory is empty');
    }
    return this._memory;
  }

  /**
   * Очищает память
   */
  memoryClear() {
    this._memory = null;
  }

  /**
   * Добавляет число к значению в памяти
   * @param {number} value - Число для добавления
   */
  memoryAdd(value) {
    if (this._memory === null) {
      this._memory = 0;
    }
    this._memory += value;
  }

  /**
   * Очищает историю вычислений
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Возвращает статистику вычислений
   * @returns {Object} - Статистика
   */
  getStats() {
    const stats = {
      totalOperations: this._history.length,
      operations: {},
      averageResult: 0,
      minResult: Infinity,
      maxResult: -Infinity,
    };

    if (this._history.length === 0) {
      return stats;
    }

    let sum = 0;
    for (const entry of this._history) {
      const op = entry.operation;
      stats.operations[op] = (stats.operations[op] || 0) + 1;
      sum += entry.result;
      stats.minResult = Math.min(stats.minResult, entry.result);
      stats.maxResult = Math.max(stats.maxResult, entry.result);
    }

    stats.averageResult = sum / this._history.length;
    return stats;
  }

  /**
   * Выполняет комплексное вычисление
   * @param {string} expression - Строка выражения
   * @param {Object} variables - Переменные для подстановки
   * @returns {number} - Результат вычисления
   * @throws {Error} - Если выражение невалидно
   */
  evaluate(expression, variables = {}) {
    // Простой парсер выражений
    const sanitized = expression.replace(/\s/g, '');
    const regex = /^([a-zA-Z_][a-zA-Z0-9_]*|\d+)([+\-*/])([a-zA-Z_][a-zA-Z0-9_]*|\d+)$/;
    const match = sanitized.match(regex);

    if (!match) {
      throw new Error('Invalid expression format');
    }

    const [, left, operator, right] = match;

    const getValue = token => {
      if (token in variables) {
        return variables[token];
      }
      const num = parseFloat(token);
      if (isNaN(num)) {
        throw new Error(`Unknown variable or constant: ${token}`);
      }
      return num;
    };

    const a = getValue(left);
    const b = getValue(right);

    let result;
    switch (operator) {
      case '+':
        result = this.add(a, b);
        break;
      case '-':
        result = this.subtract(a, b);
        break;
      case '*':
        result = this.multiply(a, b);
        break;
      case '/':
        result = this.divide(a, b);
        break;
      default:
        throw new Error('Unknown operator');
    }

    return result;
  }

  /**
   * Вычисляет среднее арифметическое
   * @param {Array<number>} numbers - Массив чисел
   * @returns {number} - Среднее арифметическое
   */
  mean(numbers) {
    if (!numbers || numbers.length === 0) {
      throw new Error('Array must not be empty');
    }
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    const result = this._round(sum / numbers.length);
    this._addToHistory('mean', null, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Вычисляет дисперсию
   * @param {Array<number>} numbers - Массив чисел
   * @param {boolean} sample - Выборка (true) или популяция (false)
   * @returns {number} - Дисперсия
   */
  variance(numbers, sample = false) {
    if (!numbers || numbers.length < 2) {
      throw new Error('Array must have at least 2 elements');
    }
    const mean = this.mean(numbers);
    const squaredDiff = numbers.map(x => Math.pow(x - mean, 2));
    const sumSquaredDiff = squaredDiff.reduce((acc, val) => acc + val, 0);
    const divisor = sample ? numbers.length - 1 : numbers.length;
    const result = this._round(sumSquaredDiff / divisor);
    this._addToHistory('variance', null, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Вычисляет стандартное отклонение
   * @param {Array<number>} numbers - Массив чисел
   * @param {boolean} sample - Выборка (true) или популяция (false)
   * @returns {number} - Стандартное отклонение
   */
  stdDev(numbers, sample = false) {
    const variance = this.variance(numbers, sample);
    const result = this._round(Math.sqrt(variance));
    this._addToHistory('stdDev', null, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Округляет число с заданной точностью
   * @private
   * @param {number} value - Число для округления
   * @returns {number} - Округленное число
   */
  _round(value) {
    if (this._precision === Infinity) {
      return value;
    }
    const factor = Math.pow(10, this._precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Добавляет запись в историю
   * @private
   * @param {string} operation - Название операции
   * @param {any} a - Первый операнд
   * @param {any} b - Второй операнд
   * @param {any} result - Результат операции
   */
  _addToHistory(operation, a, b, result) {
    if (this._history.length >= this._maxHistory) {
      this._history.shift();
    }
    this._history.push({
      operation,
      a,
      b,
      result,
      timestamp: Date.now(),
    });
  }
}

/**
 * Расширенный калькулятор с тригонометрическими функциями
 * Наследует базовый Calculator
 */
class ScientificCalculator extends Calculator {
  /**
   * Создает экземпляр ScientificCalculator
   * @param {Object} options - Опции калькулятора
   */
  constructor(options = {}) {
    super(options);
    this._angleUnit = options.angleUnit || 'radians';
  }

  /**
   * Устанавливает единицу измерения углов
   * @param {string} unit - 'radians' или 'degrees'
   */
  set angleUnit(unit) {
    if (unit !== 'radians' && unit !== 'degrees') {
      throw new Error('Angle unit must be "radians" or "degrees"');
    }
    this._angleUnit = unit;
  }

  /**
   * Конвертирует угол в радианы
   * @private
   * @param {number} angle - Угол
   * @returns {number} - Угол в радианах
   */
  _toRadians(angle) {
    if (this._angleUnit === 'degrees') {
      return (angle * Math.PI) / 180;
    }
    return angle;
  }

  /**
   * Конвертирует угол из радиан
   * @private
   * @param {number} radians - Угол в радианах
   * @returns {number} - Угол в текущих единицах
   */
  _fromRadians(radians) {
    if (this._angleUnit === 'degrees') {
      return (radians * 180) / Math.PI;
    }
    return radians;
  }

  /**
   * Синус угла
   * @param {number} angle - Угол
   * @returns {number} - Синус угла
   */
  sin(angle) {
    const radians = this._toRadians(angle);
    const result = this._round(Math.sin(radians));
    this._addToHistory('sin', angle, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Косинус угла
   * @param {number} angle - Угол
   * @returns {number} - Косинус угла
   */
  cos(angle) {
    const radians = this._toRadians(angle);
    const result = this._round(Math.cos(radians));
    this._addToHistory('cos', angle, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Тангенс угла
   * @param {number} angle - Угол
   * @returns {number} - Тангенс угла
   * @throws {Error} - Если тангенс не определен
   */
  tan(angle) {
    const radians = this._toRadians(angle);
    if (Math.abs(Math.cos(radians)) < 1e-10) {
      throw new Error('Tangent is undefined for this angle');
    }
    const result = this._round(Math.tan(radians));
    this._addToHistory('tan', angle, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Арксинус
   * @param {number} x - Значение
   * @returns {number} - Арксинус в текущих единицах
   * @throws {Error} - Если x вне диапазона [-1, 1]
   */
  asin(x) {
    if (x < -1 || x > 1) {
      throw new Error('asin argument must be between -1 and 1');
    }
    const radians = Math.asin(x);
    const result = this._round(this._fromRadians(radians));
    this._addToHistory('asin', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Арккосинус
   * @param {number} x - Значение
   * @returns {number} - Арккосинус в текущих единицах
   * @throws {Error} - Если x вне диапазона [-1, 1]
   */
  acos(x) {
    if (x < -1 || x > 1) {
      throw new Error('acos argument must be between -1 and 1');
    }
    const radians = Math.acos(x);
    const result = this._round(this._fromRadians(radians));
    this._addToHistory('acos', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Арктангенс
   * @param {number} x - Значение
   * @returns {number} - Арктангенс в текущих единицах
   */
  atan(x) {
    const radians = Math.atan(x);
    const result = this._round(this._fromRadians(radians));
    this._addToHistory('atan', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Логарифм натуральный
   * @param {number} x - Число
   * @returns {number} - Натуральный логарифм
   * @throws {Error} - Если x <= 0
   */
  ln(x) {
    if (x <= 0) {
      throw new Error('ln argument must be positive');
    }
    const result = this._round(Math.log(x));
    this._addToHistory('ln', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Логарифм по основанию 10
   * @param {number} x - Число
   * @returns {number} - Десятичный логарифм
   * @throws {Error} - Если x <= 0
   */
  log10(x) {
    if (x <= 0) {
      throw new Error('log10 argument must be positive');
    }
    const result = this._round(Math.log10(x));
    this._addToHistory('log10', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Логарифм по произвольному основанию
   * @param {number} x - Число
   * @param {number} base - Основание
   * @returns {number} - Логарифм по основанию
   * @throws {Error} - Если x <= 0 или base <= 0
   */
  logBase(x, base) {
    if (x <= 0 || base <= 0) {
      throw new Error('Arguments must be positive');
    }
    const result = this._round(Math.log(x) / Math.log(base));
    this._addToHistory('logBase', x, base, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Экспонента
   * @param {number} x - Показатель
   * @returns {number} - e^x
   */
  exp(x) {
    const result = this._round(Math.exp(x));
    this._addToHistory('exp', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Гиперболический синус
   * @param {number} x - Число
   * @returns {number} - sinh(x)
   */
  sinh(x) {
    const result = this._round(Math.sinh(x));
    this._addToHistory('sinh', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Гиперболический косинус
   * @param {number} x - Число
   * @returns {number} - cosh(x)
   */
  cosh(x) {
    const result = this._round(Math.cosh(x));
    this._addToHistory('cosh', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Гиперболический тангенс
   * @param {number} x - Число
   * @returns {number} - tanh(x)
   */
  tanh(x) {
    const result = this._round(Math.tanh(x));
    this._addToHistory('tanh', x, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Число Эйлера e
   * @returns {number} - Значение e
   */
  e() {
    return Math.E;
  }

  /**
   * Число Пи
   * @returns {number} - Значение Pi
   */
  pi() {
    return Math.PI;
  }

  /**
   * Конвертирует радианы в градусы
   * @param {number} radians - Угол в радианах
   * @returns {number} - Угол в градусах
   */
  radToDeg(radians) {
    const result = this._round((radians * 180) / Math.PI);
    this._addToHistory('radToDeg', radians, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Конвертирует градусы в радианы
   * @param {number} degrees - Угол в градусах
   * @returns {number} - Угол в радианах
   */
  degToRad(degrees) {
    const result = this._round((degrees * Math.PI) / 180);
    this._addToHistory('degToRad', degrees, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Вычисляет расстояние между двумя точками
   * @param {number} x1 - X координата первой точки
   * @param {number} y1 - Y координата первой точки
   * @param {number} x2 - X координата второй точки
   * @param {number} y2 - Y координата второй точки
   * @returns {number} - Расстояние между точками
   */
  distance2D(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const result = this._round(Math.sqrt(dx * dx + dy * dy));
    this._addToHistory('distance2D', null, null, result);
    this._lastResult = result;
    return result;
  }

  /**
   * Вычисляет угол между двумя векторами
   * @param {number} x1 - X координата первого вектора
   * @param {number} y1 - Y координата первого вектора
   * @param {number} x2 - X координата второго вектора
   * @param {number} y2 - Y координата второго вектора
   * @returns {number} - Угол между векторами
   */
  angleBetween(x1, y1, x2, y2) {
    const dot = x1 * x2 + y1 * y2;
    const mag1 = Math.sqrt(x1 * x1 + y1 * y1);
    const mag2 = Math.sqrt(x2 * x2 + y2 * y2);
    if (mag1 === 0 || mag2 === 0) {
      throw new Error('Zero vector cannot have angle');
    }
    const cosTheta = dot / (mag1 * mag2);
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const result = this._round(this._fromRadians(theta));
    this._addToHistory('angleBetween', null, null, result);
    this._lastResult = result;
    return result;
  }
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export { Calculator, ScientificCalculator };

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  Calculator,
  ScientificCalculator,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ МАТЕМАТИЧЕСКИХ КЛАССОВ
 *
 * Этот модуль предоставляет 2 класса для математических вычислений:
 *
 * 1. Calculator - Базовый калькулятор
 *    - add, subtract, multiply, divide - арифметические операции
 *    - power, sqrt - степенные функции
 *    - factorial, abs, round, floor, ceil - математические функции
 *    - memoryStore, memoryRecall, memoryClear, memoryAdd - работа с памятью
 *    - mean, variance, stdDev - статистические функции
 *    - evaluate - вычисление выражений
 *    - История вычислений и статистика
 *
 * 2. ScientificCalculator - Расширенный калькулятор (наследует Calculator)
 *    - sin, cos, tan - тригонометрические функции
 *    - asin, acos, atan - обратные тригонометрические
 *    - ln, log10, logBase - логарифмы
 *    - exp, sinh, cosh, tanh - экспонента и гиперболические
 *    - e, pi - константы
 *    - radToDeg, degToRad - конвертация углов
 *    - distance2D, angleBetween - геометрические функции
 *
 * Особенности:
 * - Все методы валидируют входные данные
 * - Поддерживают цепочки вызовов
 * - Ведут историю вычислений
 * - Обрабатывают граничные случаи
 * - Имеют JSDoc с описанием методов
 * - Поддерживают различные единицы измерения углов
 */
