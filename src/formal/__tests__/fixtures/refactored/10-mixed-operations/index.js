// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/10-mixed-operations/index.js

// ============================================
// СМЕШАННЫЕ ОПЕРАЦИИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все функции смешанных операций вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт математических функций
import {
  add,
  subtract,
  multiply,
  divide,
  power,
  squareRoot,
  factorial,
  fibonacci,
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd,
  clamp,
  lerp,
  mapRange,
  mean,
  median,
  mode,
  variance,
  standardDeviation,
  min,
  max,
  sum,
  product,
  range as statsRange,
  Complex,
  addComplex,
  subtractComplex,
  multiplyComplex,
  divideComplex,
  magnitude,
  phase,
  conjugate,
  calculate,
  calculateDifferenceProduct,
  calculateSumOfSquares,
  calculateSquareOfSum,
  calculateHypotenuse,
  angleBetweenVectors,
  calculateStatistics,
  normalizeArray,
  standardizeArray,
  createComplex,
  complexOperation,
  getComplexPolar,
  distance3D,
  dotProduct,
  vectorLength,
  normalizeVector,
  cosineSimilarity,
  matrixMultiply,
  matrixTranspose,
} from './modules/math.js';

// Импорт функций для работы с массивами
import {
  sumArray,
  findMax,
  findMin,
  sortArray,
  binarySearch,
  bubbleSort,
  selectionSort,
  insertionSort,
  quickSort,
  mergeSort,
  heapSort,
  shellSort,
  countingSort,
  radixSort,
  timSort,
  isSorted,
  compareByKey,
  compareByMultipleKeys,
} from './modules/array.js';

// Импорт функций для работы со строками
import {
  capitalize,
  capitalizePreserve,
  titleCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
  toTrainCase,
  formatLength,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,
  formatDate,
  formatDuration,
  formatPhone,
  formatJSON,
  formatHTMLEntities,
  formatURLSlug,
} from './modules/string.js';

// Импорт функций расчета скидок
import {
  getDiscount,
  getDiscountByType,
  getStandardDiscount,
  getPremiumDiscount,
  getVipDiscount,
  getEmployeeDiscount,
  getDiscountWithPromo,
  applyCoupon,
  getWholesaleDiscount,
  getSeasonalDiscount,
  getWeekdayDiscount,
  getCorporateDiscount,
  getLoyaltyDiscount,
  combineDiscounts,
} from './modules/discount.js';

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ СМЕШАННЫХ ОПЕРАЦИЙ
// ============================================

/**
 * Обработка заказа (основная функция)
 * @param {Array} items - Массив товаров в заказе
 * @param {Object} customer - Информация о клиенте
 * @param {Object} options - Дополнительные опции
 * @returns {Object} - Результат обработки заказа
 */
function processOrder(items, customer, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  // Шаг 1: Валидация заказа
  validateOrder(items);

  // Шаг 2: Расчет общей суммы
  const total = sumArray(items.map(item => item.price * item.quantity));

  // Шаг 3: Применение скидки
  let discount = 0;
  let discountInfo = {};

  if (options.promoCode) {
    const promoResult = getDiscountWithPromo(total, options.promoCode);
    discount = promoResult.discount;
    discountInfo = promoResult;
  } else if (options.coupon) {
    const couponResult = applyCoupon(total, options.coupon);
    discount = couponResult.discount;
    discountInfo = couponResult;
  } else if (customer.isPremium) {
    discount = getPremiumDiscount(total);
    discountInfo = { type: 'premium', discount };
  } else if (customer.corporate) {
    const corporateResult = getCorporateDiscount(total, customer.corporate);
    discount = corporateResult.discount;
    discountInfo = corporateResult;
  } else {
    discount = getDiscount(total, false);
    discountInfo = { type: 'standard', discount };
  }

  // Шаг 4: Применение сезонной скидки
  if (options.season) {
    const seasonalDiscount = getSeasonalDiscount(total, options.season);
    discount += seasonalDiscount;
    discountInfo.seasonal = seasonalDiscount;
  }

  // Шаг 5: Применение скидки по дню недели
  if (options.dayOfWeek !== undefined) {
    const weekdayDiscount = getWeekdayDiscount(total, options.dayOfWeek);
    discount += weekdayDiscount;
    discountInfo.weekday = weekdayDiscount;
  }

  // Шаг 6: Расчет итоговой суммы
  const finalAmount = total - discount;

  // Шаг 7: Форматирование результата
  const formattedTotal = formatCurrency(total);
  const formattedDiscount = formatCurrency(discount);
  const formattedFinal = formatCurrency(finalAmount);

  return {
    items,
    customer,
    total,
    discount,
    finalAmount,
    formattedTotal,
    formattedDiscount,
    formattedFinal,
    discountInfo,
    summary: `Order processed for ${capitalize(customer.name)}: ${formattedFinal}`,
    itemsCount: items.length,
    timestamp: formatDate(new Date(), 'ISO'),
  };
}

/**
 * Валидация заказа
 * @param {Array} items - Массив товаров
 * @returns {boolean} - true если заказ валидный
 * @throws {Error} - Если заказ невалидный
 */
function validateOrder(items) {
  if (!items || items.length === 0) {
    throw new Error('Order must have items');
  }

  for (const item of items) {
    if (!item.id) {
      throw new Error('Each item must have an id');
    }
    if (typeof item.price !== 'number' || item.price <= 0) {
      throw new Error('Each item must have a positive price');
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw new Error('Each item must have a positive quantity');
    }
  }

  return true;
}

/**
 * Форматирование сводки заказа
 * @param {Object} order - Результат обработки заказа
 * @returns {Object} - Отформатированная сводка
 */
function formatOrderSummary(order) {
  const { total, discount, finalAmount, items } = order;

  const summary = {
    orderId: `ORD-${Date.now()}`,
    totalItems: items.length,
    totalQuantity: sumArray(items.map(item => item.quantity)),
    subtotal: total,
    discount,
    finalAmount,
    subtotalFormatted: formatCurrency(total),
    discountFormatted: formatCurrency(discount),
    finalFormatted: formatCurrency(finalAmount),
    itemsSummary: items.map(item => ({
      id: item.id,
      name: item.name || `Item ${item.id}`,
      price: item.price,
      quantity: item.quantity,
      total: item.price * item.quantity,
      formatted: formatCurrency(item.price * item.quantity),
    })),
    generatedAt: formatDate(new Date(), 'localeWithTime'),
  };

  return summary;
}

/**
 * Анализ данных заказов
 * @param {Array} orders - Массив заказов
 * @param {Object} options - Опции анализа
 * @returns {Object} - Результат анализа
 */
function analyzeOrders(orders, options = {}) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { message: 'No orders to analyze' };
  }

  const totals = orders.map(order => order.total || 0);
  const quantities = orders.map(order => order.itemsCount || 0);

  const stats = calculateStatistics(totals);

  // Группировка по категориям
  const categories = {};
  for (const order of orders) {
    const category = order.category || 'uncategorized';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(order.total || 0);
  }

  const categoryStats = {};
  for (const [category, values] of Object.entries(categories)) {
    categoryStats[category] = calculateStatistics(values);
  }

  return {
    totalOrders: orders.length,
    totalRevenue: sum(totals),
    averageOrderValue: mean(totals),
    medianOrderValue: median(totals),
    minOrderValue: min(totals),
    maxOrderValue: max(totals),
    totalItems: sum(quantities),
    categories: categoryStats,
    stats,
    formattedTotalRevenue: formatCurrency(sum(totals)),
    formattedAverage: formatCurrency(mean(totals)),
  };
}

/**
 * Сравнение двух заказов
 * @param {Object} order1 - Первый заказ
 * @param {Object} order2 - Второй заказ
 * @param {string} key - Ключ для сравнения
 * @returns {Object} - Результат сравнения
 */
function compareOrders(order1, order2, key = 'total') {
  const val1 = order1[key] || 0;
  const val2 = order2[key] || 0;

  const diff = subtract(val1, val2);
  const percentDiff = val2 !== 0 ? (diff / val2) * 100 : 0;

  return {
    order1: {
      id: order1.id,
      value: val1,
      formatted: formatCurrency(val1),
    },
    order2: {
      id: order2.id,
      value: val2,
      formatted: formatCurrency(val2),
    },
    difference: diff,
    percentDifference: percentDiff,
    formattedDifference: formatCurrency(diff),
    isGreater: val1 > val2,
    isLess: val1 < val2,
    isEqual: val1 === val2,
  };
}

/**
 * Создание отчета по заказам
 * @param {Array} orders - Массив заказов
 * @param {Object} options - Опции отчета
 * @returns {string} - Отчет в формате строки
 */
function generateOrderReport(orders, options = {}) {
  const { format = 'markdown', includeItems = false } = options;

  if (!Array.isArray(orders) || orders.length === 0) {
    return 'No orders to report';
  }

  const analysis = analyzeOrders(orders);
  const report = [];

  // Заголовок
  report.push('='.repeat(60));
  report.push('📊 ORDER REPORT');
  report.push('='.repeat(60));
  report.push(`Generated: ${formatDate(new Date(), 'localeWithTime')}`);
  report.push(`Total Orders: ${analysis.totalOrders}`);
  report.push('');

  // Статистика
  report.push('📈 STATISTICS');
  report.push('-'.repeat(40));
  report.push(`Total Revenue: ${analysis.formattedTotalRevenue}`);
  report.push(`Average Order: ${analysis.formattedAverage}`);
  report.push(`Median Order: ${formatCurrency(analysis.medianOrderValue)}`);
  report.push(`Min Order: ${formatCurrency(analysis.minOrderValue)}`);
  report.push(`Max Order: ${formatCurrency(analysis.maxOrderValue)}`);
  report.push(`Total Items: ${analysis.totalItems}`);
  report.push('');

  // По категориям
  if (Object.keys(analysis.categories).length > 0) {
    report.push('📂 BY CATEGORY');
    report.push('-'.repeat(40));
    for (const [category, stats] of Object.entries(analysis.categories)) {
      report.push(`${category}:`);
      report.push(`  Count: ${stats.totalExports || 0}`);
      report.push(`  Average: ${formatCurrency(mean(stats.value || []))}`);
    }
    report.push('');
  }

  // Детали заказов
  if (includeItems) {
    report.push('📋 ORDER DETAILS');
    report.push('-'.repeat(40));
    for (let i = 0; i < Math.min(orders.length, 10); i++) {
      const order = orders[i];
      report.push(`Order ${i + 1}:`);
      report.push(`  ID: ${order.id}`);
      report.push(`  Total: ${formatCurrency(order.total || 0)}`);
      report.push(`  Items: ${order.itemsCount || 0}`);
      report.push('');
    }
    if (orders.length > 10) {
      report.push(`... and ${orders.length - 10} more orders`);
    }
  }

  report.push('='.repeat(60));

  return report.join('\n');
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт математических функций
export {
  add,
  subtract,
  multiply,
  divide,
  power,
  squareRoot,
  factorial,
  fibonacci,
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd,
  clamp,
  lerp,
  mapRange,
  mean,
  median,
  mode,
  variance,
  standardDeviation,
  min,
  max,
  sum,
  product,
  statsRange as range,
  Complex,
  addComplex,
  subtractComplex,
  multiplyComplex,
  divideComplex,
  magnitude,
  phase,
  conjugate,
  calculate,
  calculateDifferenceProduct,
  calculateSumOfSquares,
  calculateSquareOfSum,
  calculateHypotenuse,
  angleBetweenVectors,
  calculateStatistics,
  normalizeArray,
  standardizeArray,
  createComplex,
  complexOperation,
  getComplexPolar,
  distance3D,
  dotProduct,
  vectorLength,
  normalizeVector,
  cosineSimilarity,
  matrixMultiply,
  matrixTranspose,
};

// Реэкспорт функций для работы с массивами
export {
  sumArray,
  findMax,
  findMin,
  sortArray,
  binarySearch,
  bubbleSort,
  selectionSort,
  insertionSort,
  quickSort,
  mergeSort,
  heapSort,
  shellSort,
  countingSort,
  radixSort,
  timSort,
  isSorted,
  compareByKey,
  compareByMultipleKeys,
};

// Реэкспорт функций для работы со строками
export {
  capitalize,
  capitalizePreserve,
  titleCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
  toTrainCase,
  formatLength,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,
  formatDate,
  formatDuration,
  formatPhone,
  formatJSON,
  formatHTMLEntities,
  formatURLSlug,
};

// Реэкспорт функций расчета скидок
export {
  getDiscount,
  getDiscountByType,
  getStandardDiscount,
  getPremiumDiscount,
  getVipDiscount,
  getEmployeeDiscount,
  getDiscountWithPromo,
  applyCoupon,
  getWholesaleDiscount,
  getSeasonalDiscount,
  getWeekdayDiscount,
  getCorporateDiscount,
  getLoyaltyDiscount,
  combineDiscounts,
};

// Реэкспорт основных функций
export {
  processOrder,
  validateOrder,
  formatOrderSummary,
  analyzeOrders,
  compareOrders,
  generateOrderReport,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект со всеми функциями
 */
export default {
  // Математические функции
  add,
  subtract,
  multiply,
  divide,
  power,
  squareRoot,
  factorial,
  fibonacci,
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd,
  clamp,
  lerp,
  mapRange,
  mean,
  median,
  mode,
  variance,
  standardDeviation,
  min,
  max,
  sum,
  product,
  range: statsRange,
  Complex,
  addComplex,
  subtractComplex,
  multiplyComplex,
  divideComplex,
  magnitude,
  phase,
  conjugate,
  calculate,
  calculateDifferenceProduct,
  calculateSumOfSquares,
  calculateSquareOfSum,
  calculateHypotenuse,
  angleBetweenVectors,
  calculateStatistics,
  normalizeArray,
  standardizeArray,
  createComplex,
  complexOperation,
  getComplexPolar,
  distance3D,
  dotProduct,
  vectorLength,
  normalizeVector,
  cosineSimilarity,
  matrixMultiply,
  matrixTranspose,

  // Функции для работы с массивами
  sumArray,
  findMax,
  findMin,
  sortArray,
  binarySearch,
  bubbleSort,
  selectionSort,
  insertionSort,
  quickSort,
  mergeSort,
  heapSort,
  shellSort,
  countingSort,
  radixSort,
  timSort,
  isSorted,
  compareByKey,
  compareByMultipleKeys,

  // Функции для работы со строками
  capitalize,
  capitalizePreserve,
  titleCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
  toTrainCase,
  formatLength,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,
  formatDate,
  formatDuration,
  formatPhone,
  formatJSON,
  formatHTMLEntities,
  formatURLSlug,

  // Функции расчета скидок
  getDiscount,
  getDiscountByType,
  getStandardDiscount,
  getPremiumDiscount,
  getVipDiscount,
  getEmployeeDiscount,
  getDiscountWithPromo,
  applyCoupon,
  getWholesaleDiscount,
  getSeasonalDiscount,
  getWeekdayDiscount,
  getCorporateDiscount,
  getLoyaltyDiscount,
  combineDiscounts,

  // Основные функции
  processOrder,
  validateOrder,
  formatOrderSummary,
  analyzeOrders,
  compareOrders,
  generateOrderReport,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Математические функции вынесены в modules/math.js:
 *    - Базовые операции (add, subtract, multiply, divide)
 *    - Расширенные функции (power, squareRoot, factorial, fibonacci)
 *    - Теория чисел (gcd, lcm, isPrime, isEven, isOdd)
 *    - Утилиты (clamp, lerp, mapRange)
 *    - Статистика (mean, median, mode, variance, standardDeviation)
 *    - Комплексные числа (Complex, addComplex, subtractComplex, ...)
 *    - Комбинированные операции (calculate, calculateDifferenceProduct, ...)
 *    - Векторные операции (distance3D, dotProduct, vectorLength, ...)
 *    - Матричные операции (matrixMultiply, matrixTranspose)
 *
 * 2. Функции для работы с массивами вынесены в modules/array.js:
 *    - sumArray, findMax, findMin
 *    - Алгоритмы сортировки (bubbleSort, selectionSort, insertionSort, ...)
 *    - binarySearch
 *    - isSorted, compareByKey, compareByMultipleKeys
 *
 * 3. Функции для работы со строками вынесены в modules/string.js:
 *    - capitalize, titleCase
 *    - Преобразование регистра (toCamelCase, toPascalCase, toSnakeCase, ...)
 *    - Форматирование (formatLength, formatNumber, formatCurrency, ...)
 *    - Форматирование даты (formatDate, formatDuration)
 *    - formatPhone, formatJSON, formatHTMLEntities, formatURLSlug
 *
 * 4. Функции расчета скидок вынесены в modules/discount.js:
 *    - getDiscount, getDiscountByType
 *    - Скидки по типам клиентов (standard, premium, vip, employee)
 *    - Промокоды и купоны (getDiscountWithPromo, applyCoupon)
 *    - Специальные скидки (wholesale, seasonal, weekday)
 *    - Корпоративные скидки (getCorporateDiscount)
 *    - Скидки по программе лояльности (getLoyaltyDiscount)
 *    - Комбинирование скидок (combineDiscounts)
 *
 * 5. Основные функции остаются в index.js:
 *    - processOrder - обработка заказа
 *    - validateOrder - валидация заказа
 *    - formatOrderSummary - форматирование сводки
 *    - analyzeOrders - анализ заказов
 *    - compareOrders - сравнение заказов
 *    - generateOrderReport - создание отчета
 *
 * 6. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 7. Добавлены JSDoc комментарии для всех функций
 *
 * 8. Сохранена обратная совместимость через реэкспорты
 *
 * 9. Интеграция всех модулей в единый интерфейс
 *
 * 10. Поддержка форматирования вывода (currency, date, JSON)
 */
