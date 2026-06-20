// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/04-object-operations/modules/calculator.js

// ============================================
// МОДУЛЬ КАЛЬКУЛЯТОРА
// ============================================
// Этот модуль содержит класс Calculator и связанные с ним
// функции для выполнения математических операций с сохранением истории.

/**
 * Класс Calculator - базовый калькулятор с историей операций
 */
class Calculator {
  /**
   * Создает экземпляр калькулятора
   * @param {Object} options - Опции калькулятора
   * @param {number} options.precision - Количество знаков после запятой (по умолчанию 2)
   * @param {boolean} options.keepHistory - Сохранять ли историю (по умолчанию true)
   */
  constructor(options = {}) {
    this.precision = options.precision || 2;
    this.keepHistory = options.keepHistory !== false;
    this.history = [];
    this.memory = null;
    this.lastResult = null;
  }

  /**
   * Сложение двух чисел
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Результат сложения
   */
  add(a, b) {
    this.validateNumbers(a, b);
    const result = this.round(a + b);
    this.recordOperation('add', { a, b }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Вычитание двух чисел
   * @param {number} a - Первое число (уменьшаемое)
   * @param {number} b - Второе число (вычитаемое)
   * @returns {number} - Результат вычитания
   */
  subtract(a, b) {
    this.validateNumbers(a, b);
    const result = this.round(a - b);
    this.recordOperation('subtract', { a, b }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Умножение двух чисел
   * @param {number} a - Первый множитель
   * @param {number} b - Второй множитель
   * @returns {number} - Результат умножения
   */
  multiply(a, b) {
    this.validateNumbers(a, b);
    const result = this.round(a * b);
    this.recordOperation('multiply', { a, b }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Деление двух чисел
   * @param {number} a - Делимое
   * @param {number} b - Делитель
   * @returns {number} - Результат деления
   * @throws {Error} - Если делитель равен нулю
   */
  divide(a, b) {
    this.validateNumbers(a, b);
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    const result = this.round(a / b);
    this.recordOperation('divide', { a, b }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Возведение в степень
   * @param {number} base - Основание
   * @param {number} exponent - Показатель степени
   * @returns {number} - Результат возведения в степень
   */
  power(base, exponent) {
    this.validateNumbers(base, exponent);
    const result = this.round(Math.pow(base, exponent));
    this.recordOperation('power', { base, exponent }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Квадратный корень
   * @param {number} value - Число
   * @returns {number} - Квадратный корень
   * @throws {Error} - Если число отрицательное
   */
  sqrt(value) {
    this.validateNumbers(value);
    if (value < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    const result = this.round(Math.sqrt(value));
    this.recordOperation('sqrt', { value }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Процент от числа
   * @param {number} value - Число
   * @param {number} percent - Процент
   * @returns {number} - Процент от числа
   */
  percent(value, percent) {
    this.validateNumbers(value, percent);
    const result = this.round((value * percent) / 100);
    this.recordOperation('percent', { value, percent }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Сложение с последним результатом
   * @param {number} value - Число для сложения
   * @returns {number} - Результат
   * @throws {Error} - Если нет последнего результата
   */
  addToLast(value) {
    this.validateNumbers(value);
    if (this.lastResult === null) {
      throw new Error('No previous result to add to');
    }
    return this.add(this.lastResult, value);
  }

  /**
   * Вычитание из последнего результата
   * @param {number} value - Число для вычитания
   * @returns {number} - Результат
   * @throws {Error} - Если нет последнего результата
   */
  subtractFromLast(value) {
    this.validateNumbers(value);
    if (this.lastResult === null) {
      throw new Error('No previous result to subtract from');
    }
    return this.subtract(this.lastResult, value);
  }

  /**
   * Умножение последнего результата
   * @param {number} value - Множитель
   * @returns {number} - Результат
   * @throws {Error} - Если нет последнего результата
   */
  multiplyLast(value) {
    this.validateNumbers(value);
    if (this.lastResult === null) {
      throw new Error('No previous result to multiply');
    }
    return this.multiply(this.lastResult, value);
  }

  /**
   * Деление последнего результата
   * @param {number} value - Делитель
   * @returns {number} - Результат
   * @throws {Error} - Если нет последнего результата или делитель равен нулю
   */
  divideLast(value) {
    this.validateNumbers(value);
    if (this.lastResult === null) {
      throw new Error('No previous result to divide');
    }
    if (value === 0) {
      throw new Error('Division by zero is not allowed');
    }
    return this.divide(this.lastResult, value);
  }

  /**
   * Вычисление сложного выражения: (a + b) * (c - d)
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @param {number} c - Третье число
   * @param {number} d - Четвертое число
   * @returns {number} - Результат вычисления
   */
  calculateComplex(a, b, c, d) {
    this.validateNumbers(a, b, c, d);
    const sum = a + b;
    const diff = c - d;
    const result = this.round(sum * diff);
    this.recordOperation('complex', { a, b, c, d, sum, diff }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Вычисление среднего арифметического
   * @param {...number} numbers - Числа для вычисления среднего
   * @returns {number} - Среднее арифметическое
   * @throws {Error} - Если не передано ни одного числа
   */
  average(...numbers) {
    if (numbers.length === 0) {
      throw new Error('At least one number is required');
    }
    for (const num of numbers) {
      this.validateNumbers(num);
    }
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    const result = this.round(sum / numbers.length);
    this.recordOperation('average', { numbers, count: numbers.length }, result);
    this.lastResult = result;
    return result;
  }

  /**
   * Округление числа до заданной точности
   * @param {number} value - Число для округления
   * @returns {number} - Округленное число
   */
  round(value) {
    const factor = Math.pow(10, this.precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Валидация чисел
   * @param {...*} numbers - Числа для проверки
   * @throws {Error} - Если хотя бы одно значение не является числом
   */
  validateNumbers(...numbers) {
    for (const num of numbers) {
      if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
        throw new Error(`Invalid number: ${num}`);
      }
    }
  }

  /**
   * Запись операции в историю
   * @param {string} operation - Название операции
   * @param {Object} inputs - Входные данные
   * @param {number} result - Результат
   */
  recordOperation(operation, inputs, result) {
    if (!this.keepHistory) return;
    this.history.push({
      operation,
      inputs: { ...inputs },
      result,
      timestamp: new Date().toISOString(),
    });
    // Ограничиваем историю 1000 записей
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }

  /**
   * Получение истории операций
   * @param {number} limit - Максимальное количество записей
   * @returns {Array} - Массив записей истории
   */
  getHistory(limit = null) {
    if (limit === null) {
      return [...this.history];
    }
    return this.history.slice(-limit);
  }

  /**
   * Очистка истории операций
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Получение последнего результата
   * @returns {number|null} - Последний результат или null
   */
  getLastResult() {
    return this.lastResult;
  }

  /**
   * Установка значения в память
   * @param {number} value - Значение для сохранения
   */
  setMemory(value) {
    this.validateNumbers(value);
    this.memory = value;
  }

  /**
   * Получение значения из памяти
   * @returns {number|null} - Значение из памяти или null
   */
  getMemory() {
    return this.memory;
  }

  /**
   * Очистка памяти
   */
  clearMemory() {
    this.memory = null;
  }

  /**
   * Сложение с значением из памяти
   * @param {number} value - Число для сложения
   * @returns {number} - Результат
   * @throws {Error} - Если память пуста
   */
  addMemory(value) {
    this.validateNumbers(value);
    if (this.memory === null) {
      throw new Error('Memory is empty');
    }
    return this.add(this.memory, value);
  }

  /**
   * Вычитание значения из памяти
   * @param {number} value - Число для вычитания
   * @returns {number} - Результат
   * @throws {Error} - Если память пуста
   */
  subtractMemory(value) {
    this.validateNumbers(value);
    if (this.memory === null) {
      throw new Error('Memory is empty');
    }
    return this.subtract(this.memory, value);
  }

  /**
   * Сброс калькулятора
   */
  reset() {
    this.lastResult = null;
    if (this.keepHistory) {
      this.clearHistory();
    }
  }

  /**
   * Клонирование калькулятора
   * @returns {Calculator} - Новый экземпляр калькулятора
   */
  clone() {
    const clone = new Calculator({
      precision: this.precision,
      keepHistory: this.keepHistory,
    });
    clone.memory = this.memory;
    clone.lastResult = this.lastResult;
    clone.history = [...this.history];
    return clone;
  }

  /**
   * Сериализация калькулятора в JSON
   * @returns {Object} - Объект для сериализации
   */
  toJSON() {
    return {
      precision: this.precision,
      keepHistory: this.keepHistory,
      memory: this.memory,
      lastResult: this.lastResult,
      history: this.history,
      historyCount: this.history.length,
    };
  }

  /**
   * Десериализация калькулятора из JSON
   * @param {Object} data - Данные для десериализации
   * @returns {Calculator} - Новый экземпляр калькулятора
   */
  static fromJSON(data) {
    const calc = new Calculator({
      precision: data.precision || 2,
      keepHistory: data.keepHistory !== false,
    });
    calc.memory = data.memory || null;
    calc.lastResult = data.lastResult || null;
    if (data.history) {
      calc.history = [...data.history];
    }
    return calc;
  }

  /**
   * Строковое представление калькулятора
   * @returns {string} - Строковое представление
   */
  toString() {
    const operations = this.history.length;
    const lastResult = this.lastResult !== null ? this.lastResult : 'none';
    const memory = this.memory !== null ? this.memory : 'none';
    return `Calculator(operations=${operations}, lastResult=${lastResult}, memory=${memory})`;
  }
}

/**
 * Создает экземпляр калькулятора с настройками по умолчанию
 * @param {Object} options - Опции калькулятора
 * @returns {Calculator} - Экземпляр калькулятора
 */
function createCalculator(options = {}) {
  return new Calculator(options);
}

/**
 * Выполняет цепочку операций на калькуляторе
 * @param {Calculator} calc - Экземпляр калькулятора
 * @param {Array} operations - Массив операций
 * @param {number} initialValue - Начальное значение
 * @returns {number} - Результат цепочки операций
 */
function chainOperations(calc, operations, initialValue = 0) {
  if (!(calc instanceof Calculator)) {
    throw new TypeError('Expected a Calculator instance');
  }

  let result = initialValue;
  for (const op of operations) {
    const { operation, ...params } = op;
    if (typeof calc[operation] !== 'function') {
      throw new Error(`Unknown operation: ${operation}`);
    }
    result = calc[operation](...Object.values(params));
  }
  return result;
}

/**
 * Выполняет пакетную обработку чисел на калькуляторе
 * @param {Calculator} calc - Экземпляр калькулятора
 * @param {string} operation - Название операции
 * @param {Array} numbers - Массив чисел
 * @returns {Array} - Массив результатов
 */
function batchProcess(calc, operation, numbers) {
  if (!(calc instanceof Calculator)) {
    throw new TypeError('Expected a Calculator instance');
  }
  if (typeof calc[operation] !== 'function') {
    throw new Error(`Unknown operation: ${operation}`);
  }

  const results = [];
  for (const num of numbers) {
    try {
      const result = calc[operation](num);
      results.push({ input: num, result, error: null });
    } catch (error) {
      results.push({ input: num, result: null, error: error.message });
    }
  }
  return results;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export { Calculator, createCalculator, chainOperations, batchProcess };

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default Calculator;

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ КАЛЬКУЛЯТОРА
 *
 * Этот модуль предоставляет класс Calculator со следующими возможностями:
 *
 * ОСНОВНЫЕ ОПЕРАЦИИ:
 * - add(a, b) - сложение
 * - subtract(a, b) - вычитание
 * - multiply(a, b) - умножение
 * - divide(a, b) - деление
 * - power(base, exponent) - возведение в степень
 * - sqrt(value) - квадратный корень
 * - percent(value, percent) - процент от числа
 *
 * РАБОТА С ПОСЛЕДНИМ РЕЗУЛЬТАТОМ:
 * - addToLast(value) - сложение с последним результатом
 * - subtractFromLast(value) - вычитание из последнего результата
 * - multiplyLast(value) - умножение последнего результата
 * - divideLast(value) - деление последнего результата
 *
 * РАБОТА С ПАМЯТЬЮ:
 * - setMemory(value) - сохранить в память
 * - getMemory() - получить из памяти
 * - clearMemory() - очистить память
 * - addMemory(value) - сложить с памятью
 * - subtractMemory(value) - вычесть из памяти
 *
 * ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ:
 * - calculateComplex(a, b, c, d) - сложное выражение
 * - average(...numbers) - среднее арифметическое
 * - getHistory(limit) - история операций
 * - clearHistory() - очистка истории
 * - reset() - сброс состояния
 * - clone() - клонирование
 * - toJSON() / fromJSON() - сериализация
 *
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ:
 * - createCalculator(options) - создание экземпляра
 * - chainOperations(calc, operations) - цепочка операций
 * - batchProcess(calc, operation, numbers) - пакетная обработка
 */
