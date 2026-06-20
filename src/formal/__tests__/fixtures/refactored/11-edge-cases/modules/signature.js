// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/11-edge-cases/modules/signature.js

// ============================================
// МОДУЛЬ ДЛЯ ТЕСТИРОВАНИЯ ИЗМЕНЕНИЙ СИГНАТУР
// ============================================
// Этот модуль содержит функции с измененными сигнатурами
// для тестирования обнаружения изменений сигнатур.

// ============================================
// ИЗМЕНЕНИЕ КОЛИЧЕСТВА ПАРАМЕТРОВ
// ============================================

/**
 * Функция с добавленным параметром
 * Оригинал: function calculate(a, b)
 * Изменено: function calculate(a, b, c)
 * @param {number} a - Первый параметр
 * @param {number} b - Второй параметр
 * @param {number} c - Третий параметр (ДОБАВЛЕН)
 * @returns {number} - Результат вычисления
 */
function calculate(a, b, c) {
  if (typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number') {
    throw new TypeError('All arguments must be numbers');
  }
  return a + b + c;
}

/**
 * Функция с удаленным параметром
 * Оригинал: function process(a, b, c)
 * Изменено: function process(a, b)
 * @param {number} a - Первый параметр
 * @param {number} b - Второй параметр
 * @returns {number} - Результат обработки
 */
function process(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return a * b;
}

/**
 * Функция с измененным порядком параметров
 * Оригинал: function format(first, last, title)
 * Изменено: function format(title, first, last)
 * @param {string} title - Заголовок (ПЕРЕМЕЩЕН)
 * @param {string} first - Имя (ПЕРЕМЕЩЕН)
 * @param {string} last - Фамилия (ПЕРЕМЕЩЕН)
 * @returns {string} - Отформатированная строка
 */
function format(title, first, last) {
  if (typeof title !== 'string' || typeof first !== 'string' || typeof last !== 'string') {
    throw new TypeError('All arguments must be strings');
  }
  return `${title} ${first} ${last}`;
}

// ============================================
// ИЗМЕНЕНИЕ ТИПОВ ПАРАМЕТРОВ
// ============================================

/**
 * Функция с измененным типом параметра (string -> number)
 * Оригинал: function setValue(value) { ... } // value: string
 * Изменено: function setValue(value) { ... } // value: number
 * @param {number} value - Значение (ИЗМЕНЕН ТИП С STRING НА NUMBER)
 * @returns {number} - Обработанное значение
 */
function setValue(value) {
  if (typeof value !== 'number') {
    throw new TypeError('Value must be a number');
  }
  return value * 2;
}

/**
 * Функция с измененным типом параметра (number -> string)
 * Оригинал: function getId(id) { ... } // id: number
 * Изменено: function getId(id) { ... } // id: string
 * @param {string} id - Идентификатор (ИЗМЕНЕН ТИП С NUMBER НА STRING)
 * @returns {string} - Обработанный идентификатор
 */
function getId(id) {
  if (typeof id !== 'string') {
    throw new TypeError('ID must be a string');
  }
  return id.toUpperCase();
}

/**
 * Функция с измененным типом параметра (boolean -> string)
 * Оригинал: function toggle(flag) { ... } // flag: boolean
 * Изменено: function toggle(flag) { ... } // flag: string
 * @param {string} flag - Флаг (ИЗМЕНЕН ТИП С BOOLEAN НА STRING)
 * @returns {string} - Результат переключения
 */
function toggle(flag) {
  if (typeof flag !== 'string') {
    throw new TypeError('Flag must be a string');
  }
  return flag === 'on' ? 'off' : 'on';
}

/**
 * Функция с измененным типом параметра (number -> boolean)
 * Оригинал: function isActive(status) { ... } // status: number
 * Изменено: function isActive(status) { ... } // status: boolean
 * @param {boolean} status - Статус (ИЗМЕНЕН ТИП С NUMBER НА BOOLEAN)
 * @returns {boolean} - Активен ли объект
 */
function isActive(status) {
  if (typeof status !== 'boolean') {
    throw new TypeError('Status must be a boolean');
  }
  return status;
}

// ============================================
// ИЗМЕНЕНИЕ ТИПА ВОЗВРАЩАЕМОГО ЗНАЧЕНИЯ
// ============================================

/**
 * Функция с измененным типом возврата (number -> string)
 * Оригинал: function getValue() { return 42; }
 * Изменено: function getValue() { return '42'; }
 * @returns {string} - Значение (ИЗМЕНЕН ТИП С NUMBER НА STRING)
 */
function getValue() {
  return '42';
}

/**
 * Функция с измененным типом возврата (string -> boolean)
 * Оригинал: function getStatus() { return 'active'; }
 * Изменено: function getStatus() { return true; }
 * @returns {boolean} - Статус (ИЗМЕНЕН ТИП С STRING НА BOOLEAN)
 */
function getStatus() {
  return true;
}

/**
 * Функция с измененным типом возврата (boolean -> number)
 * Оригинал: function isValid() { return true; }
 * Изменено: function isValid() { return 1; }
 * @returns {number} - Статус валидности (ИЗМЕНЕН ТИП С BOOLEAN НА NUMBER)
 */
function isValid() {
  return 1;
}

/**
 * Функция с измененным типом возврата (number -> void)
 * Оригинал: function log(message) { console.log(message); return message.length; }
 * Изменено: function log(message) { console.log(message); }
 * @param {string} message - Сообщение
 * @returns {void} - Ничего не возвращает (ИЗМЕНЕН ТИП С NUMBER НА VOID)
 */
function log(message) {
  console.log(message);
}

/**
 * Функция с измененным типом возврата (void -> number)
 * Оригинал: function log(message) { console.log(message); }
 * Изменено: function log(message) { console.log(message); return message.length; }
 * @param {string} message - Сообщение
 * @returns {number} - Длина сообщения (ИЗМЕНЕН ТИП С VOID НА NUMBER)
 */
function logWithLength(message) {
  console.log(message);
  return message.length;
}

// ============================================
// ИЗМЕНЕНИЕ МОДИФИКАТОРОВ
// ============================================

/**
 * Функция изменена с синхронной на асинхронную
 * Оригинал: function fetchData(url) { return fetch(url); }
 * Изменено: async function fetchData(url) { return await fetch(url); }
 * @param {string} url - URL для запроса
 * @returns {Promise} - Promise с данными (ДОБАВЛЕН МОДИФИКАТОР ASYNC)
 */
async function fetchData(url) {
  if (typeof url !== 'string') {
    throw new TypeError('URL must be a string');
  }
  const response = await fetch(url);
  return response.json();
}

/**
 * Функция изменена с асинхронной на синхронную
 * Оригинал: async function processData(data) { return await process(data); }
 * Изменено: function processData(data) { return process(data); }
 * @param {*} data - Данные для обработки
 * @returns {*} - Обработанные данные (УДАЛЕН МОДИФИКАТОР ASYNC)
 */
function processData(data) {
  return data;
}

// ============================================
// ИЗМЕНЕНИЕ ЭКСПОРТОВ
// ============================================

/**
 * Функция стала экспортируемой
 * Оригинал: function internalHelper() { return 'internal'; }
 * Изменено: export function internalHelper() { return 'internal'; }
 * @returns {string} - Внутренняя помощь (ДОБАВЛЕН ЭКСПОРТ)
 */
export function internalHelper() {
  return 'internal';
}

/**
 * Функция перестала быть экспортируемой
 * Оригинал: export function publicHelper() { return 'public'; }
 * Изменено: function publicHelper() { return 'public'; }
 * @returns {string} - Публичная помощь (УДАЛЕН ЭКСПОРТ)
 */
function publicHelper() {
  return 'public';
}

// ============================================
// КОМБИНИРОВАННЫЕ ИЗМЕНЕНИЯ
// ============================================

/**
 * Множественные изменения сигнатуры
 * Оригинал: function complex(a: number, b: string): boolean
 * Изменено: function complex(a: string, b: number, c: boolean): string
 * @param {string} a - Первый параметр (ИЗМЕНЕН ТИП)
 * @param {number} b - Второй параметр (ИЗМЕНЕН ТИП)
 * @param {boolean} c - Третий параметр (ДОБАВЛЕН)
 * @returns {string} - Результат (ИЗМЕНЕН ТИП)
 */
function complex(a, b, c) {
  if (typeof a !== 'string' || typeof b !== 'number' || typeof c !== 'boolean') {
    throw new TypeError('Invalid parameter types');
  }
  return `${a} ${b} ${c}`;
}

// ============================================
// ФУНКЦИИ С ДЕФОЛТНЫМИ ПАРАМЕТРАМИ
// ============================================

/**
 * Функция с добавленным дефолтным параметром
 * Оригинал: function greet(name) { return `Hello ${name}`; }
 * Изменено: function greet(name, greeting = 'Hello') { return `${greeting} ${name}`; }
 * @param {string} name - Имя
 * @param {string} greeting - Приветствие (ДОБАВЛЕН С ДЕФОЛТНЫМ ЗНАЧЕНИЕМ)
 * @returns {string} - Приветствие
 */
function greet(name, greeting = 'Hello') {
  if (typeof name !== 'string') {
    throw new TypeError('Name must be a string');
  }
  return `${greeting} ${name}`;
}

/**
 * Функция с удаленным дефолтным параметром
 * Оригинал: function createUser(name, age = 18) { return { name, age }; }
 * Изменено: function createUser(name, age) { return { name, age }; }
 * @param {string} name - Имя
 * @param {number} age - Возраст (УДАЛЕН ДЕФОЛТ)
 * @returns {Object} - Объект пользователя
 */
function createUser(name, age) {
  if (typeof name !== 'string' || typeof age !== 'number') {
    throw new TypeError('Invalid parameter types');
  }
  return { name, age };
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Изменение количества параметров
  calculate,
  process,
  format,

  // Изменение типов параметров
  setValue,
  getId,
  toggle,
  isActive,

  // Изменение типа возврата
  getValue,
  getStatus,
  isValid,
  log,
  logWithLength,

  // Изменение модификаторов
  fetchData,
  processData,

  // Изменение экспортов
  internalHelper,
  publicHelper,

  // Комбинированные изменения
  complex,

  // Функции с дефолтными параметрами
  greet,
  createUser,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  calculate,
  process,
  format,
  setValue,
  getId,
  toggle,
  isActive,
  getValue,
  getStatus,
  isValid,
  log,
  logWithLength,
  fetchData,
  processData,
  internalHelper,
  publicHelper,
  complex,
  greet,
  createUser,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ТЕСТИРОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ДЛЯ ТЕСТИРОВАНИЯ ИЗМЕНЕНИЙ СИГНАТУР
 *
 * Этот модуль содержит функции с различными изменениями сигнатур:
 *
 * 1. ИЗМЕНЕНИЕ КОЛИЧЕСТВА ПАРАМЕТРОВ:
 *    - calculate: добавлен параметр c
 *    - process: удален параметр c
 *    - format: изменен порядок параметров
 *
 * 2. ИЗМЕНЕНИЕ ТИПОВ ПАРАМЕТРОВ:
 *    - setValue: string -> number
 *    - getId: number -> string
 *    - toggle: boolean -> string
 *    - isActive: number -> boolean
 *
 * 3. ИЗМЕНЕНИЕ ТИПА ВОЗВРАТА:
 *    - getValue: number -> string
 *    - getStatus: string -> boolean
 * - isValid: boolean -> number
 *    - log: number -> void
 *    - logWithLength: void -> number
 *
 * 4. ИЗМЕНЕНИЕ МОДИФИКАТОРОВ:
 *    - fetchData: добавлен async
 *    - processData: удален async
 *
 * 5. ИЗМЕНЕНИЕ ЭКСПОРТОВ:
 *    - internalHelper: добавлен export
 *    - publicHelper: удален export
 *
 * 6. КОМБИНИРОВАННЫЕ ИЗМЕНЕНИЯ:
 *    - complex: множественные изменения
 *
 * 7. ДЕФОЛТНЫЕ ПАРАМЕТРЫ:
 *    - greet: добавлен дефолтный параметр
 *    - createUser: удален дефолтный параметр
 *
 * Тесты должны обнаружить все эти изменения сигнатур
 * и сообщить о различиях между оригиналом и рефакторингом.
 */
