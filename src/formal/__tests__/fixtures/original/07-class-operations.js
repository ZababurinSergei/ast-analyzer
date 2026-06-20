// packages/ast-analyzer/src/formal/__tests__/fixtures/original/07-class-operations.js

// ============================================
// КЛАССЫ И ОБЪЕКТНО-ОРИЕНТИРОВАННОЕ ПРОГРАММИРОВАНИЕ - ОРИГИНАЛЬНЫЙ ФАЙЛ
// ============================================
// Этот файл содержит различные классы и методы,
// которые будут рефакториться в модули

/**
 * Базовый класс Калькулятор
 * Содержит основные математические операции с историей
 */
class Calculator {
  /**
   * Конструктор калькулятора
   * Инициализирует пустую историю операций
   */
  constructor() {
    this.history = [];
    this.operationsCount = 0;
    this.lastResult = null;
  }

  /**
   * Сложение двух чисел
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Результат сложения
   */
  add(a, b) {
    const result = a + b;
    this._addToHistory('add', { a, b, result });
    this.lastResult = result;
    this.operationsCount++;
    return result;
  }

  /**
   * Вычитание двух чисел
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Результат вычитания
   */
  subtract(a, b) {
    const result = a - b;
    this._addToHistory('subtract', { a, b, result });
    this.lastResult = result;
    this.operationsCount++;
    return result;
  }

  /**
   * Умножение двух чисел
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Результат умножения
   */
  multiply(a, b) {
    const result = a * b;
    this._addToHistory('multiply', { a, b, result });
    this.lastResult = result;
    this.operationsCount++;
    return result;
  }

  /**
   * Деление двух чисел
   * @param {number} a - Первое число (делимое)
   * @param {number} b - Второе число (делитель)
   * @returns {number} - Результат деления
   * @throws {Error} - Если b === 0
   */
  divide(a, b) {
    if (b === 0) {
      this._addToHistory('divide_error', { a, b, error: 'Division by zero' });
      throw new Error('Division by zero');
    }
    const result = a / b;
    this._addToHistory('divide', { a, b, result });
    this.lastResult = result;
    this.operationsCount++;
    return result;
  }

  /**
   * Комплексная операция: a + (a * b)
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - Результат вычисления
   */
  calculate(a, b) {
    const product = this.multiply(a, b);
    const result = this.add(a, product);
    this._addToHistory('calculate', { a, b, product, result });
    return result;
  }

  /**
   * Возведение в степень
   * @param {number} base - Основание
   * @param {number} exponent - Показатель степени
   * @returns {number} - Результат возведения в степень
   */
  power(base, exponent) {
    if (exponent === 0) return 1;
    if (exponent < 0) return 1 / this.power(base, -exponent);

    let result = 1;
    for (let i = 0; i < exponent; i++) {
      result = this.multiply(result, base);
    }
    this._addToHistory('power', { base, exponent, result });
    this.lastResult = result;
    this.operationsCount++;
    return result;
  }

  /**
   * Факториал числа
   * @param {number} n - Число для вычисления факториала
   * @returns {number} - Факториал числа
   * @throws {Error} - Если n < 0 или n > 20
   */
  factorial(n) {
    if (n < 0) {
      this._addToHistory('factorial_error', { n, error: 'Negative number' });
      throw new Error('Factorial of negative number is undefined');
    }
    if (n > 20) {
      this._addToHistory('factorial_error', { n, error: 'Number too large' });
      throw new Error('Factorial of number > 20 is not supported');
    }

    let result = 1;
    for (let i = 2; i <= n; i++) {
      result = this.multiply(result, i);
    }
    this._addToHistory('factorial', { n, result });
    this.lastResult = result;
    this.operationsCount++;
    return result;
  }

  /**
   * Получение истории операций
   * @returns {Array} - Массив записей истории
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Получение последнего результата
   * @returns {number|null} - Последний результат или null
   */
  getLastResult() {
    return this.lastResult;
  }

  /**
   * Получение количества операций
   * @returns {number} - Количество выполненных операций
   */
  getOperationsCount() {
    return this.operationsCount;
  }

  /**
   * Очистка истории
   */
  clearHistory() {
    this.history = [];
    this.operationsCount = 0;
    this.lastResult = null;
  }

  /**
   * Внутренний метод для добавления записи в историю
   * @param {string} operation - Название операции
   * @param {Object} data - Данные операции
   * @private
   */
  _addToHistory(operation, data) {
    this.history.push({
      operation,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Статический метод для создания калькулятора с предустановленными значениями
   * @param {Array} initialData - Начальные данные для истории
   * @returns {Calculator} - Новый экземпляр калькулятора
   */
  static createWithHistory(initialData = []) {
    const calculator = new Calculator();
    for (const entry of initialData) {
      calculator._addToHistory(entry.operation, entry.data);
    }
    return calculator;
  }

  /**
   * Статический метод для проверки, является ли число простым
   * @param {number} num - Число для проверки
   * @returns {boolean} - true если число простое
   */
  static isPrime(num) {
    if (num <= 1) return false;
    if (num <= 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;

    for (let i = 5; i * i <= num; i += 6) {
      if (num % i === 0 || num % (i + 2) === 0) return false;
    }
    return true;
  }
}

/**
 * Расширенный класс MathOperations
 * Наследует Calculator и добавляет дополнительные операции
 */
class MathOperations extends Calculator {
  /**
   * Конструктор MathOperations
   * @param {string} mode - Режим работы ('basic', 'advanced')
   */
  constructor(mode = 'basic') {
    super();
    this.mode = mode;
    this.advancedHistory = [];
  }

  /**
   * Нахождение наибольшего общего делителя (НОД)
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - НОД чисел
   */
  gcd(a, b) {
    if (b === 0) return Math.abs(a);
    const result = this.gcd(b, a % b);
    this._addToAdvancedHistory('gcd', { a, b, result });
    return result;
  }

  /**
   * Нахождение наименьшего общего кратного (НОК)
   * @param {number} a - Первое число
   * @param {number} b - Второе число
   * @returns {number} - НОК чисел
   */
  lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    const result = Math.abs(a * b) / this.gcd(a, b);
    this._addToAdvancedHistory('lcm', { a, b, result });
    return result;
  }

  /**
   * Модуль числа
   * @param {number} x - Число
   * @returns {number} - Модуль числа
   */
  abs(x) {
    const result = x < 0 ? -x : x;
    this._addToAdvancedHistory('abs', { x, result });
    return result;
  }

  /**
   * Нахождение минимального значения
   * @param {Array<number>} numbers - Массив чисел
   * @returns {number} - Минимальное значение
   */
  min(...numbers) {
    if (numbers.length === 0) {
      throw new Error('At least one number is required');
    }
    const result = Math.min(...numbers);
    this._addToAdvancedHistory('min', { numbers, result });
    return result;
  }

  /**
   * Нахождение максимального значения
   * @param {Array<number>} numbers - Массив чисел
   * @returns {number} - Максимальное значение
   */
  max(...numbers) {
    if (numbers.length === 0) {
      throw new Error('At least one number is required');
    }
    const result = Math.max(...numbers);
    this._addToAdvancedHistory('max', { numbers, result });
    return result;
  }

  /**
   * Сумма всех чисел
   * @param {Array<number>} numbers - Массив чисел
   * @returns {number} - Сумма чисел
   */
  sum(...numbers) {
    const result = numbers.reduce((acc, val) => this.add(acc, val), 0);
    this._addToAdvancedHistory('sum', { numbers, result });
    return result;
  }

  /**
   * Среднее арифметическое чисел
   * @param {Array<number>} numbers - Массив чисел
   * @returns {number} - Среднее арифметическое
   */
  average(...numbers) {
    if (numbers.length === 0) {
      throw new Error('At least one number is required');
    }
    const sum = this.sum(...numbers);
    const result = this.divide(sum, numbers.length);
    this._addToAdvancedHistory('average', { numbers, result });
    return result;
  }

  /**
   * Проверка, является ли число четным
   * @param {number} x - Число для проверки
   * @returns {boolean} - true если число четное
   */
  isEven(x) {
    const result = x % 2 === 0;
    this._addToAdvancedHistory('isEven', { x, result });
    return result;
  }

  /**
   * Проверка, является ли число нечетным
   * @param {number} x - Число для проверки
   * @returns {boolean} - true если число нечетное
   */
  isOdd(x) {
    const result = x % 2 !== 0;
    this._addToAdvancedHistory('isOdd', { x, result });
    return result;
  }

  /**
   * Получение расширенной истории
   * @returns {Array} - Массив записей расширенной истории
   */
  getAdvancedHistory() {
    return [...this.advancedHistory];
  }

  /**
   * Внутренний метод для добавления записи в расширенную историю
   * @param {string} operation - Название операции
   * @param {Object} data - Данные операции
   * @private
   */
  _addToAdvancedHistory(operation, data) {
    this.advancedHistory.push({
      operation,
      data,
      timestamp: new Date().toISOString(),
      mode: this.mode,
    });
  }

  /**
   * Очистка расширенной истории
   */
  clearAdvancedHistory() {
    this.advancedHistory = [];
  }

  /**
   * Переопределение метода clearHistory для очистки всей истории
   */
  clearHistory() {
    super.clearHistory();
    this.clearAdvancedHistory();
  }

  /**
   * Получение всей истории (базовой и расширенной)
   * @returns {Object} - Объект с базовой и расширенной историей
   */
  getAllHistory() {
    return {
      basic: this.getHistory(),
      advanced: this.getAdvancedHistory(),
    };
  }
}

/**
 * Класс DataProcessor для обработки данных
 * Использует методы MathOperations для анализа данных
 */
class DataProcessor {
  /**
   * Конструктор DataProcessor
   * @param {Array} data - Начальные данные
   */
  constructor(data = []) {
    this.data = data;
    this.math = new MathOperations();
    this.processed = false;
  }

  /**
   * Добавление данных
   * @param {Array} newData - Новые данные для добавления
   */
  addData(newData) {
    this.data = [...this.data, ...newData];
    this.processed = false;
  }

  /**
   * Очистка данных
   */
  clearData() {
    this.data = [];
    this.processed = false;
  }

  /**
   * Получение статистики по данным
   * @returns {Object} - Объект со статистикой
   */
  getStats() {
    if (this.data.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0,
        median: 0,
      };
    }

    const numbers = this.data;
    return {
      count: numbers.length,
      sum: this.math.sum(...numbers),
      average: this.math.average(...numbers),
      min: this.math.min(...numbers),
      max: this.math.max(...numbers),
      median: this.getMedian(numbers),
    };
  }

  /**
   * Получение медианы данных
   * @param {Array<number>} data - Массив чисел
   * @returns {number} - Медиана
   */
  getMedian(data) {
    const sorted = [...data].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
  }

  /**
   * Фильтрация данных по условию
   * @param {Function} predicate - Функция-предикат
   * @returns {Array} - Отфильтрованные данные
   */
  filter(predicate) {
    return this.data.filter(predicate);
  }

  /**
   * Трансформация данных
   * @param {Function} transform - Функция трансформации
   * @returns {Array} - Трансформированные данные
   */
  map(transform) {
    return this.data.map(transform);
  }

  /**
   * Группировка данных по ключу
   * @param {string} key - Ключ для группировки
   * @returns {Object} - Объект с группами
   */
  groupBy(key) {
    return this.data.reduce((groups, item) => {
      const groupKey = item[key] || 'undefined';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {});
  }

  /**
   * Получение уникальных значений
   * @param {string} key - Ключ для получения уникальных значений
   * @returns {Array} - Массив уникальных значений
   */
  unique(key) {
    const values = this.data.map(item => item[key]);
    return [...new Set(values)];
  }

  /**
   * Сортировка данных
   * @param {string} key - Ключ для сортировки
   * @param {boolean} ascending - По возрастанию (true) или убыванию (false)
   * @returns {Array} - Отсортированные данные
   */
  sortBy(key, ascending = true) {
    return [...this.data].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  }

  /**
   * Получение сводки по данным
   * @returns {string} - Строка со сводкой
   */
  getSummary() {
    const stats = this.getStats();
    return `Data Summary:
  Count: ${stats.count}
  Sum: ${stats.sum}
  Average: ${stats.average.toFixed(2)}
  Min: ${stats.min}
  Max: ${stats.max}
  Median: ${stats.median}
  Unique values: ${this.unique('value')?.length || 0}`;
  }
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export { Calculator, MathOperations, DataProcessor };

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * Этот файл содержит 3 класса для тестирования:
 * 1. Calculator - базовый калькулятор с историей
 * 2. MathOperations - расширенный калькулятор с НОД, НОК, статистикой
 * 3. DataProcessor - процессор данных с методами фильтрации, группировки
 *
 * Особенности:
 * - Наследование классов (MathOperations extends Calculator)
 * - Приватные методы (_addToHistory)
 * - Статические методы (Calculator.isPrime)
 * - Переопределение методов (clearHistory)
 * - Композиция объектов (DataProcessor использует MathOperations)
 * - Работа с массивами и статистикой
 * - Геттеры и сеттеры (getHistory, getLastResult)
 */
