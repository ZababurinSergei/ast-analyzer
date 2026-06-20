// packages/ast-analyzer/src/formal/__tests__/fixtures/original/10-mixed-operations.js

// ============================================
// СМЕШАННЫЕ ОПЕРАЦИИ - ОРИГИНАЛЬНЫЙ ФАЙЛ
// ============================================
// Этот файл содержит комбинацию различных типов операций:
// - Математические функции
// - Работа с массивами
// - Работа со строками
// - Условная логика
// - Обработка данных
// - Асинхронные операции
// Все функции будут разбиты на модули

// ============================================
// 1. МАТЕМАТИЧЕСКИЕ ФУНКЦИИ
// ============================================

/**
 * Сложение двух чисел
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} Сумма
 */
function add(a, b) {
  return a + b;
}

/**
 * Вычитание двух чисел
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} Разность
 */
function subtract(a, b) {
  return a - b;
}

/**
 * Умножение двух чисел
 * @param {number} a - Первое число
 * @param {number} b - Второе число
 * @returns {number} Произведение
 */
function multiply(a, b) {
  return a * b;
}

/**
 * Деление двух чисел с проверкой на ноль
 * @param {number} a - Делимое
 * @param {number} b - Делитель
 * @returns {number} Частное
 * @throws {Error} Если делитель равен нулю
 */
function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

/**
 * Возведение в степень
 * @param {number} base - Основание
 * @param {number} exponent - Показатель степени
 * @returns {number} Результат возведения в степень
 */
function power(base, exponent) {
  return Math.pow(base, exponent);
}

/**
 * Факториал числа (рекурсивная версия)
 * @param {number} n - Число для вычисления факториала
 * @returns {number} Факториал числа
 */
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// ============================================
// 2. РАБОТА С МАССИВАМИ
// ============================================

/**
 * Сумма элементов массива
 * @param {Array<number>} arr - Массив чисел
 * @returns {number} Сумма элементов
 */
function sumArray(arr) {
  let sum = 0;
  for (const item of arr) {
    sum += item;
  }
  return sum;
}

/**
 * Поиск максимального элемента в массиве
 * @param {Array<number>} arr - Массив чисел
 * @returns {number|undefined} Максимальный элемент или undefined для пустого массива
 */
function findMax(arr) {
  if (arr.length === 0) return undefined;
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

/**
 * Поиск минимального элемента в массиве
 * @param {Array<number>} arr - Массив чисел
 * @returns {number|undefined} Минимальный элемент или undefined для пустого массива
 */
function findMin(arr) {
  if (arr.length === 0) return undefined;
  let min = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min;
}

/**
 * Сортировка массива (пузырьковая сортировка)
 * @param {Array} arr - Массив для сортировки
 * @returns {Array} Отсортированный массив (новая копия)
 */
function sortArray(arr) {
  const copy = [...arr];
  for (let i = 0; i < copy.length; i++) {
    for (let j = i + 1; j < copy.length; j++) {
      if (copy[i] > copy[j]) {
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
    }
  }
  return copy;
}

/**
 * Фильтрация активных элементов
 * @param {Array<Object>} items - Массив объектов с полем active
 * @returns {Array<Object>} Массив активных элементов
 */
function filterActive(items) {
  return items.filter(item => item.active === true);
}

/**
 * Трансформация элементов массива
 * @param {Array<Object>} items - Массив объектов
 * @param {Function} transformFn - Функция трансформации
 * @returns {Array} Трансформированный массив
 */
function transformItems(items, transformFn) {
  return items.map(item => transformFn(item));
}

// ============================================
// 3. РАБОТА СО СТРОКАМИ
// ============================================

/**
 * Капитализация строки (первая буква заглавная, остальные строчные)
 * @param {string} str - Входная строка
 * @returns {string} Строка с заглавной первой буквой
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Реверс строки
 * @param {string} str - Входная строка
 * @returns {string} Перевернутая строка
 */
function reverse(str) {
  return str.split('').reverse().join('');
}

/**
 * Форматирование приветствия
 * @param {string} name - Имя
 * @param {string} title - Обращение
 * @returns {string} Отформатированное приветствие
 */
function formatGreeting(name, title) {
  return `Hello, ${title} ${name}!`;
}

/**
 * Форматирование полного имени (фамилия, имя)
 * @param {string} first - Имя
 * @param {string} last - Фамилия
 * @returns {string} Отформатированное имя
 */
function formatFullName(first, last) {
  return `${last}, ${first}`;
}

/**
 * Обрезание строки до максимальной длины
 * @param {string} str - Входная строка
 * @param {number} maxLength - Максимальная длина
 * @returns {string} Обрезанная строка
 */
function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

// ============================================
// 4. УСЛОВНАЯ ЛОГИКА
// ============================================

/**
 * Расчет скидки на основе суммы и статуса клиента
 * @param {number} amount - Сумма заказа
 * @param {boolean} isPremium - Является ли клиент премиум
 * @returns {number} Размер скидки
 */
function getDiscount(amount, isPremium) {
  if (isPremium) {
    return amount * 0.2;
  } else if (amount > 1000) {
    return amount * 0.1;
  } else if (amount > 500) {
    return amount * 0.05;
  } else {
    return 0;
  }
}

/**
 * Определение категории по возрасту
 * @param {number} age - Возраст
 * @returns {string} Категория (child, teenager, adult, senior)
 */
function getCategory(age) {
  if (age < 13) return 'child';
  if (age < 18) return 'teenager';
  if (age < 65) return 'adult';
  return 'senior';
}

/**
 * Получение названия дня недели по номеру
 * @param {number} day - Номер дня (0-6)
 * @returns {string} Название дня
 */
function getDayName(day) {
  switch (day) {
    case 0:
      return 'Sunday';
    case 1:
      return 'Monday';
    case 2:
      return 'Tuesday';
    case 3:
      return 'Wednesday';
    case 4:
      return 'Thursday';
    case 5:
      return 'Friday';
    case 6:
      return 'Saturday';
    default:
      return 'Unknown';
  }
}

/**
 * Определение оценки по баллам
 * @param {number} score - Количество баллов (0-100)
 * @returns {string} Оценка (A, B, C, D, F)
 */
function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ============================================
// 5. ОБРАБОТКА ДАННЫХ
// ============================================

/**
 * Обработка элементов заказа
 * @param {Array<Object>} items - Массив элементов заказа
 * @returns {Array<Object>} Обработанные элементы
 */
function processItems(items) {
  return items
    .filter(item => item.active)
    .map(item => ({
      id: item.id,
      name: item.name.toUpperCase(),
      value: item.value * 1.1,
      processed: true,
      timestamp: new Date().toISOString(),
    }));
}

/**
 * Группировка элементов по категориям
 * @param {Array<Object>} items - Массив элементов с полем category
 * @returns {Object} Объект с группами
 */
function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    const category = item.category || 'uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  }
  return groups;
}

/**
 * Агрегация данных (сумма, среднее, минимум, максимум)
 * @param {Array<Object>} data - Массив объектов с полем value
 * @returns {Object} Агрегированные данные
 */
function aggregateData(data) {
  if (data.length === 0) {
    return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
  }

  return data.reduce(
    (acc, item) => ({
      count: acc.count + 1,
      sum: acc.sum + item.value,
      avg: (acc.sum + item.value) / (acc.count + 1),
      min: Math.min(acc.min, item.value),
      max: Math.max(acc.max, item.value),
    }),
    {
      count: 0,
      sum: 0,
      avg: 0,
      min: Infinity,
      max: -Infinity,
    }
  );
}

/**
 * Поиск дубликатов в массиве
 * @param {Array} arr - Массив для проверки
 * @returns {Array} Массив дублирующихся элементов
 */
function findDuplicates(arr) {
  const seen = new Set();
  const duplicates = new Set();

  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }

  return Array.from(duplicates);
}

// ============================================
// 6. АСИНХРОННЫЕ ОПЕРАЦИИ
// ============================================

/**
 * Получение данных с сервера
 * @param {string} url - URL для запроса
 * @returns {Promise<Object>} Promise с данными
 */
async function fetchData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Обработка данных с сервера
 * @param {string} url - URL для запроса
 * @returns {Promise<Array>} Promise с обработанными данными
 */
async function processAsyncData(url) {
  const data = await fetchData(url);
  return data.map(item => ({
    ...item,
    processed: true,
    processedAt: new Date().toISOString(),
  }));
}

/**
 * Пакетная обработка асинхронных запросов
 * @param {Array<string>} urls - Массив URL для запросов
 * @returns {Promise<Array>} Promise с массивом результатов
 */
async function batchFetch(urls) {
  const promises = urls.map(url => fetchData(url));
  const results = await Promise.allSettled(promises);

  return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}

// ============================================
// 7. ОСНОВНЫЕ БИЗНЕС-ФУНКЦИИ
// ============================================

/**
 * Обработка заказа
 * @param {Array<Object>} items - Массив элементов заказа
 * @param {Object} customer - Информация о клиенте
 * @returns {Object} Результат обработки заказа
 */
function processOrder(items, customer) {
  // Валидация
  if (!items || items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  if (!customer || !customer.name) {
    throw new Error('Customer information is required');
  }

  // Расчет суммы
  const total = sumArray(items.map(item => item.price));

  // Расчет скидки
  const discount = getDiscount(total, customer.isPremium);

  // Итоговая сумма
  const finalAmount = total - discount;

  // Форматирование
  const message = `Order processed for ${capitalize(customer.name)}`;

  return {
    items,
    customer,
    total,
    discount,
    finalAmount,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Валидация заказа
 * @param {Object} order - Объект заказа
 * @returns {boolean} Результат валидации
 * @throws {Error} Если заказ невалиден
 */
function validateOrder(order) {
  if (!order) {
    throw new Error('Order is required');
  }

  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have items');
  }

  if (order.total <= 0) {
    throw new Error('Order total must be positive');
  }

  if (!order.customer || !order.customer.id) {
    throw new Error('Customer ID is required');
  }

  return true;
}

/**
 * Форматирование отчета по заказу
 * @param {Object} order - Объект заказа
 * @returns {Object} Отформатированный отчет
 */
function formatOrderSummary(order) {
  const { total, discount, finalAmount, items, customer } = order;

  const itemCount = items ? items.length : 0;
  const totalItems = items ? items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;

  return {
    ...order,
    summary: {
      itemCount,
      totalItems,
      subtotal: total,
      discount,
      finalAmount,
      savings: discount > 0 ? `${((discount / total) * 100).toFixed(1)}%` : '0%',
      formattedTotal: `$${total.toFixed(2)}`,
      formattedDiscount: `$${discount.toFixed(2)}`,
      formattedFinal: `$${finalAmount.toFixed(2)}`,
      customerName: customer ? capitalize(customer.name) : 'Unknown',
      processedAt: new Date().toISOString(),
    },
  };
}

/**
 * Получение статистики по заказам
 * @param {Array<Object>} orders - Массив заказов
 * @returns {Object} Статистика
 */
function getOrderStatistics(orders) {
  if (!orders || orders.length === 0) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      maxOrderValue: 0,
      minOrderValue: 0,
    };
  }

  const values = orders.map(order => order.finalAmount || order.total || 0);
  const totalRevenue = sumArray(values);

  return {
    totalOrders: orders.length,
    totalRevenue,
    averageOrderValue: totalRevenue / orders.length,
    maxOrderValue: findMax(values) || 0,
    minOrderValue: findMin(values) || 0,
  };
}

/**
 * Асинхронная обработка заказа с внешним API
 * @param {Object} order - Объект заказа
 * @param {string} apiUrl - URL внешнего API
 * @returns {Promise<Object>} Promise с результатом обработки
 */
async function processOrderAsync(order, apiUrl) {
  // Валидация заказа
  validateOrder(order);

  // Обработка заказа
  const processedOrder = processOrder(order.items, order.customer);

  try {
    // Отправка во внешний API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(processedOrder),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const apiResult = await response.json();

    return {
      ...processedOrder,
      apiResult,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to sync order with API:', error);
    return {
      ...processedOrder,
      syncError: error.message,
      syncedAt: null,
    };
  }
}

// ============================================
// 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Генерация уникального ID
 * @returns {string} Уникальный ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Проверка на пустой объект
 * @param {Object} obj - Объект для проверки
 * @returns {boolean} true если объект пустой
 */
function isEmptyObject(obj) {
  return obj && typeof obj === 'object' && Object.keys(obj).length === 0;
}

/**
 * Глубокое клонирование объекта
 * @param {Object} obj - Объект для клонирования
 * @returns {Object} Клон объекта
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  const cloned = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Математические функции
  add,
  subtract,
  multiply,
  divide,
  power,
  factorial,

  // Работа с массивами
  sumArray,
  findMax,
  findMin,
  sortArray,
  filterActive,
  transformItems,

  // Работа со строками
  capitalize,
  reverse,
  formatGreeting,
  formatFullName,
  truncate,

  // Условная логика
  getDiscount,
  getCategory,
  getDayName,
  getGrade,

  // Обработка данных
  processItems,
  groupByCategory,
  aggregateData,
  findDuplicates,

  // Асинхронные операции
  fetchData,
  processAsyncData,
  batchFetch,

  // Основные бизнес-функции
  processOrder,
  validateOrder,
  formatOrderSummary,
  getOrderStatistics,
  processOrderAsync,

  // Вспомогательные функции
  generateId,
  isEmptyObject,
  deepClone,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * Этот файл содержит 41 функцию для тестирования:
 *
 * 1. Математические функции (6):
 *    - add, subtract, multiply, divide, power, factorial
 *
 * 2. Работа с массивами (6):
 *    - sumArray, findMax, findMin, sortArray, filterActive, transformItems
 *
 * 3. Работа со строками (5):
 *    - capitalize, reverse, formatGreeting, formatFullName, truncate
 *
 * 4. Условная логика (4):
 *    - getDiscount, getCategory, getDayName, getGrade
 *
 * 5. Обработка данных (4):
 *    - processItems, groupByCategory, aggregateData, findDuplicates
 *
 * 6. Асинхронные операции (3):
 *    - fetchData, processAsyncData, batchFetch
 *
 * 7. Основные бизнес-функции (5):
 *    - processOrder, validateOrder, formatOrderSummary, getOrderStatistics, processOrderAsync
 *
 * 8. Вспомогательные функции (3):
 *    - generateId, isEmptyObject, deepClone
 *
 * Всего: 36 экспортируемых функций
 *
 * Этот файл используется для тестирования:
 * - Разбиения на модули
 * - Формальной проверки эквивалентности
 * - Сохранения всех сигнатур функций
 * - Правильной группировки по кластерам
 * - Обработки различных типов данных
 */
