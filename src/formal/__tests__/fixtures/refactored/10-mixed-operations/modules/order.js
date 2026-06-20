// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/10-mixed-operations/modules/order.js

// ============================================
// МОДУЛЬ ОБРАБОТКИ ЗАКАЗОВ
// ============================================
// Этот модуль содержит функции для создания, валидации
// и обработки заказов в интернет-магазине.

// Импорт зависимостей
import { sumArray } from './array.js';
import { getDiscount } from './discount.js';
import { capitalize } from './string.js';

/**
 * Обрабатывает заказ клиента
 * @param {Array} items - Массив товаров в заказе
 * @param {Object} customer - Информация о клиенте
 * @param {boolean} customer.isPremium - Является ли клиент премиальным
 * @param {string} customer.name - Имя клиента
 * @param {string} [customer.email] - Email клиента
 * @param {string} [customer.phone] - Телефон клиента
 * @param {Object} [customer.address] - Адрес доставки
 * @param {Object} options - Дополнительные опции
 * @param {string} [options.promoCode] - Промокод
 * @param {string} [options.shippingMethod] - Способ доставки
 * @param {string} [options.paymentMethod] - Способ оплаты
 * @returns {Object} - Результат обработки заказа
 * @throws {Error} - Если заказ пустой или содержит некорректные данные
 */
function processOrder(items, customer, options = {}) {
  // Валидация входных данных
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  if (!customer || typeof customer !== 'object') {
    throw new Error('Customer information is required');
  }

  // Проверка наличия цены у товаров
  const invalidItems = items.filter(item => typeof item.price !== 'number' || item.price < 0);
  if (invalidItems.length > 0) {
    throw new Error(`Invalid items found: ${invalidItems.map(i => i.id || 'unknown').join(', ')}`);
  }

  // Расчет стоимости заказа
  const total = sumArray(items.map(item => item.price));
  const discount = getDiscount(total, customer.isPremium || false);
  const finalAmount = total - discount;

  // Форматирование сообщения
  const customerName = capitalize(customer.name || 'Customer');
  const message = `Order processed for ${customerName}`;

  // Сборка результата
  const result = {
    total,
    discount,
    finalAmount,
    message,
    items: items.map(item => ({
      ...item,
      processed: true,
    })),
    customer: {
      name: customerName,
      email: customer.email,
      phone: customer.phone,
      isPremium: customer.isPremium || false,
    },
    timestamp: new Date().toISOString(),
    orderId: generateOrderId(),
  };

  // Добавление опциональных полей
  if (options.promoCode) {
    result.promoCode = options.promoCode;
  }
  if (options.shippingMethod) {
    result.shippingMethod = options.shippingMethod;
    result.shippingCost = calculateShipping(items, options.shippingMethod);
    result.finalAmount += result.shippingCost;
  }
  if (options.paymentMethod) {
    result.paymentMethod = options.paymentMethod;
  }

  return result;
}

/**
 * Генерирует уникальный ID заказа
 * @param {string} [prefix] - Префикс для ID
 * @returns {string} - Уникальный ID заказа
 */
function generateOrderId(prefix = 'ORD') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}-${timestamp}-${random}-${sequence}`;
}

/**
 * Валидирует заказ перед обработкой
 * @param {Object} order - Объект заказа
 * @param {Array} order.items - Массив товаров
 * @param {number} order.total - Общая сумма заказа
 * @param {Object} order.customer - Информация о клиенте
 * @param {string} [order.promoCode] - Промокод
 * @returns {Object} - Результат валидации
 */
function validateOrder(order) {
  const errors = [];
  const warnings = [];

  if (!order || typeof order !== 'object') {
    errors.push('Order object is required');
    return { valid: false, errors, warnings };
  }

  // Проверка товаров
  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    errors.push('Order must have at least one item');
  } else {
    // Проверка каждого товара
    for (const item of order.items) {
      if (!item.id) {
        warnings.push('Item without ID found');
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        errors.push(`Item ${item.id || 'unknown'} has invalid price`);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`Item ${item.id || 'unknown'} has invalid quantity`);
      }
    }
  }

  // Проверка суммы
  if (typeof order.total !== 'number' || order.total < 0) {
    errors.push('Order total must be a positive number');
  }

  // Проверка клиента
  if (!order.customer || typeof order.customer !== 'object') {
    errors.push('Customer information is required');
  } else {
    if (!order.customer.name) {
      warnings.push('Customer name is missing');
    }
    if (order.customer.email && !isValidEmail(order.customer.email)) {
      warnings.push('Invalid email format');
    }
    if (order.customer.phone && !isValidPhone(order.customer.phone)) {
      warnings.push('Invalid phone format');
    }
  }

  // Проверка промокода (если есть)
  if (order.promoCode && typeof order.promoCode !== 'string') {
    warnings.push('Promo code must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    isValid: errors.length === 0 && warnings.length === 0,
  };
}

/**
 * Проверяет формат email
 * @param {string} email - Email для проверки
 * @returns {boolean} - true если email валидный
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Проверяет формат телефона
 * @param {string} phone - Телефон для проверки
 * @returns {boolean} - true если телефон валидный
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Удаляем все нецифровые символы для проверки
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Рассчитывает стоимость доставки
 * @param {Array} items - Массив товаров
 * @param {string} method - Способ доставки
 * @param {Object} [options] - Дополнительные опции
 * @returns {number} - Стоимость доставки
 */
function calculateShipping(items, method = 'standard', options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  // Расчет веса заказа (если есть)
  const totalWeight = items.reduce((sum, item) => {
    return sum + (item.weight || 0) * (item.quantity || 1);
  }, 0);

  // Базовая стоимость по способу доставки
  const baseRates = {
    standard: 5.99,
    express: 12.99,
    overnight: 24.99,
    international: 29.99,
    pickup: 0,
  };

  let cost = baseRates[method] || baseRates.standard;

  // Добавка за вес
  if (totalWeight > 0) {
    const weightCharge = Math.ceil(totalWeight / 5) * 2.99; // 2.99 за каждые 5 кг
    cost += weightCharge;
  }

  // Добавка за количество товаров
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  if (itemCount > 10) {
    cost += 3.99;
  }

  // Скидка за большой заказ
  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.price || 0) * (item.quantity || 1);
  }, 0);

  if (totalAmount > 200) {
    cost *= 0.8; // 20% скидка
  }

  // Дополнительные опции
  if (options.insurance) {
    cost += 5.99;
  }
  if (options.signature) {
    cost += 3.99;
  }
  if (options.giftWrap) {
    cost += 4.99;
  }

  // Округляем до 2 знаков
  return Math.round(cost * 100) / 100;
}

/**
 * Форматирует заказ в удобочитаемый вид
 * @param {Object} order - Объект заказа
 * @param {string} [format] - Формат вывода ('short', 'detailed', 'receipt')
 * @returns {string} - Отформатированная строка заказа
 */
function formatOrder(order, format = 'short') {
  if (!order || typeof order !== 'object') {
    return 'Invalid order';
  }

  const { total, discount, finalAmount, items = [], customer = {}, timestamp } = order;

  switch (format) {
    case 'short':
      return `Order #${order.orderId || 'N/A'}: ${items.length} items, Total: $${finalAmount.toFixed(2)}`;

    case 'detailed':
      let detailed = `Order #${order.orderId || 'N/A'}\n`;
      detailed += `Customer: ${customer.name || 'N/A'}\n`;
      detailed += `Items: ${items.length}\n`;
      detailed += `Subtotal: $${total.toFixed(2)}\n`;
      if (discount > 0) {
        detailed += `Discount: -$${discount.toFixed(2)}\n`;
      }
      detailed += `Total: $${finalAmount.toFixed(2)}\n`;
      detailed += `Date: ${timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}`;
      return detailed;

    case 'receipt':
      let receipt = '='.repeat(50) + '\n';
      receipt += '            ORDER RECEIPT\n';
      receipt += '='.repeat(50) + '\n';
      receipt += `Order #: ${order.orderId || 'N/A'}\n`;
      receipt += `Date: ${timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}\n`;
      receipt += '-'.repeat(50) + '\n';

      for (const item of items) {
        const price = (item.price || 0) * (item.quantity || 1);
        receipt += `${item.name || 'Item'} x${item.quantity || 1}`;
        receipt += ' '.repeat(Math.max(1, 30 - (item.name || 'Item').length - 3));
        receipt += `$${price.toFixed(2)}\n`;
      }

      receipt += '-'.repeat(50) + '\n';
      receipt += `Subtotal: $${(total || 0).toFixed(2)}\n`;
      if (discount > 0) {
        receipt += `Discount: -$${discount.toFixed(2)}\n`;
      }
      receipt += `Total: $${(finalAmount || 0).toFixed(2)}\n`;
      receipt += '='.repeat(50) + '\n';
      receipt += `Thank you, ${customer.name || 'Customer'}!\n`;
      receipt += '='.repeat(50);
      return receipt;

    default:
      return `Order: ${items.length} items, $${finalAmount.toFixed(2)}`;
  }
}

/**
 * Обновляет статус заказа
 * @param {Object} order - Объект заказа
 * @param {string} status - Новый статус ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
 * @param {string} [note] - Примечание к статусу
 * @returns {Object} - Обновленный заказ
 */
function updateOrderStatus(order, status, note = '') {
  if (!order || typeof order !== 'object') {
    throw new Error('Order is required');
  }

  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const history = order.statusHistory || [];
  history.push({
    status,
    timestamp: new Date().toISOString(),
    note,
  });

  return {
    ...order,
    status,
    statusHistory: history,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Рассчитывает срок доставки заказа
 * @param {Object} order - Объект заказа
 * @param {string} [method] - Способ доставки
 * @param {Object} [options] - Дополнительные опции
 * @returns {Object} - Информация о сроках доставки
 */
function calculateDeliveryEstimate(order, method = 'standard', options = {}) {
  if (!order || typeof order !== 'object') {
    throw new Error('Order is required');
  }

  const now = new Date();

  // Базовая задержка в днях
  const baseDelays = {
    standard: 3,
    express: 1,
    overnight: 0.5,
    international: 7,
    pickup: 0,
  };

  let days = baseDelays[method] || baseDelays.standard;

  // Дополнительная задержка за выходные (если метод не экспресс)
  if (method !== 'express' && method !== 'overnight') {
    const weekendDays = calculateWeekendDays(now, days);
    days += weekendDays;
  }

  // Дополнительная задержка за праздники
  if (options.holidays) {
    const holidayDays = calculateHolidayDays(now, days, options.holidays);
    days += holidayDays;
  }

  const estimatedDate = new Date(now);
  estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(days));

  return {
    days: Math.ceil(days),
    estimatedDate: estimatedDate.toISOString(),
    method,
    isExpress: method === 'express' || method === 'overnight',
    includesWeekend: days > 2,
  };
}

/**
 * Рассчитывает количество выходных дней в периоде
 * @param {Date} start - Начальная дата
 * @param {number} days - Количество дней
 * @returns {number} - Количество выходных дней
 */
function calculateWeekendDays(start, days) {
  let weekendCount = 0;
  const end = new Date(start);
  end.setDate(end.getDate() + Math.ceil(days));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendCount++;
    }
  }

  return weekendCount;
}

/**
 * Рассчитывает количество праздничных дней в периоде
 * @param {Date} start - Начальная дата
 * @param {number} days - Количество дней
 * @param {Array<Date>} holidays - Массив праздничных дат
 * @returns {number} - Количество праздничных дней
 */
function calculateHolidayDays(start, days, holidays) {
  if (!Array.isArray(holidays) || holidays.length === 0) {
    return 0;
  }

  const end = new Date(start);
  end.setDate(end.getDate() + Math.ceil(days));

  let holidayCount = 0;
  for (const holiday of holidays) {
    const holidayDate = new Date(holiday);
    if (holidayDate >= start && holidayDate <= end) {
      holidayCount++;
    }
  }

  return holidayCount;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные функции
  processOrder,
  validateOrder,
  formatOrder,

  // Вспомогательные функции
  generateOrderId,
  isValidEmail,
  isValidPhone,
  calculateShipping,
  updateOrderStatus,
  calculateDeliveryEstimate,
  calculateWeekendDays,
  calculateHolidayDays,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями обработки заказов
 */
export default {
  processOrder,
  validateOrder,
  formatOrder,
  generateOrderId,
  isValidEmail,
  isValidPhone,
  calculateShipping,
  updateOrderStatus,
  calculateDeliveryEstimate,
  calculateWeekendDays,
  calculateHolidayDays,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ОБРАБОТКИ ЗАКАЗОВ
 *
 * Этот модуль предоставляет 10 функций для обработки заказов:
 *
 * 1. processOrder              - Основная функция обработки заказа
 * 2. validateOrder             - Валидация заказа перед обработкой
 * 3. formatOrder               - Форматирование заказа в удобочитаемый вид
 * 4. generateOrderId           - Генерация уникального ID заказа
 * 5. isValidEmail              - Проверка формата email
 * 6. isValidPhone              - Проверка формата телефона
 * 7. calculateShipping         - Расчет стоимости доставки
 * 8. updateOrderStatus         - Обновление статуса заказа
 * 9. calculateDeliveryEstimate - Расчет срока доставки
 * 10. calculateWeekendDays     - Расчет выходных дней
 * 11. calculateHolidayDays     - Расчет праздничных дней
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные способы доставки и оплаты
 * - Генерируют детальные отчеты и чеки
 * - Включают систему статусов заказа
 * - Рассчитывают сроки доставки с учетом выходных и праздников
 * - Имеют JSDoc с описанием параметров и возвращаемых значений
 */
