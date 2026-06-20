// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/10-mixed-operations/modules/discount.js

// ============================================
// МОДУЛЬ РАСЧЕТА СКИДОК
// ============================================
// Этот модуль содержит функции для расчета скидок
// в различных сценариях и для разных типов клиентов.

/**
 * Базовая функция расчета скидки
 * @param {number} amount - Сумма заказа
 * @param {boolean} isPremium - Является ли клиент премиальным
 * @returns {number} - Сумма скидки
 */
function getDiscount(amount, isPremium) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

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
 * Расчет скидки с учетом типа клиента
 * @param {number} amount - Сумма заказа
 * @param {string} customerType - Тип клиента ('standard', 'premium', 'vip', 'employee')
 * @returns {number} - Сумма скидки
 */
function getDiscountByType(amount, customerType = 'standard') {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const discountRates = {
    standard: getStandardDiscount,
    premium: getPremiumDiscount,
    vip: getVipDiscount,
    employee: getEmployeeDiscount,
  };

  const discountFn = discountRates[customerType] || getStandardDiscount;
  return discountFn(amount);
}

/**
 * Скидка для стандартного клиента
 * @param {number} amount - Сумма заказа
 * @returns {number} - Сумма скидки
 */
function getStandardDiscount(amount) {
  if (amount > 1000) return amount * 0.1;
  if (amount > 500) return amount * 0.05;
  if (amount > 200) return amount * 0.03;
  return 0;
}

/**
 * Скидка для премиального клиента
 * @param {number} amount - Сумма заказа
 * @returns {number} - Сумма скидки
 */
function getPremiumDiscount(amount) {
  if (amount > 1000) return amount * 0.25;
  if (amount > 500) return amount * 0.2;
  if (amount > 200) return amount * 0.15;
  return amount * 0.1;
}

/**
 * Скидка для VIP клиента
 * @param {number} amount - Сумма заказа
 * @returns {number} - Сумма скидки
 */
function getVipDiscount(amount) {
  if (amount > 1000) return amount * 0.35;
  if (amount > 500) return amount * 0.3;
  if (amount > 200) return amount * 0.25;
  return amount * 0.2;
}

/**
 * Скидка для сотрудника
 * @param {number} amount - Сумма заказа
 * @returns {number} - Сумма скидки
 */
function getEmployeeDiscount(amount) {
  // Сотрудники получают фиксированную скидку 30%
  return amount * 0.3;
}

/**
 * Расчет скидки с учетом промокода
 * @param {number} amount - Сумма заказа
 * @param {string} promoCode - Промокод
 * @param {Object} promoRules - Правила для промокодов
 * @returns {Object} - Объект с суммой скидки и информацией
 */
function getDiscountWithPromo(amount, promoCode, promoRules = {}) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const defaultRules = {
    SAVE10: { type: 'percentage', value: 0.1 },
    SAVE20: { type: 'percentage', value: 0.2 },
    SAVE50: { type: 'percentage', value: 0.5 },
    FREESHIP: { type: 'fixed', value: 0 },
    WELCOME: { type: 'percentage', value: 0.15, minAmount: 100 },
  };

  const rules = { ...defaultRules, ...promoRules };
  const rule = rules[promoCode];

  if (!rule) {
    return { discount: 0, type: 'none', message: 'Invalid promo code' };
  }

  // Проверка минимальной суммы
  if (rule.minAmount && amount < rule.minAmount) {
    return {
      discount: 0,
      type: 'invalid',
      message: `Promo code requires minimum order of ${rule.minAmount}`,
    };
  }

  let discount = 0;
  let type = rule.type;

  if (rule.type === 'percentage') {
    discount = amount * rule.value;
    // Максимальная скидка по промокоду (если указана)
    if (rule.maxDiscount && discount > rule.maxDiscount) {
      discount = rule.maxDiscount;
    }
  } else if (rule.type === 'fixed') {
    discount = rule.value;
  } else if (rule.type === 'free_shipping') {
    // Бесплатная доставка - скидка на стоимость доставки
    discount = rule.value || 0;
  }

  return {
    discount,
    type,
    percentage: rule.type === 'percentage' ? rule.value * 100 : 0,
    message: `Promo code ${promoCode} applied: ${discount} discount`,
  };
}

/**
 * Расчет скидки для оптового заказа
 * @param {number} amount - Сумма заказа
 * @param {number} quantity - Количество товаров
 * @param {number} wholesaleThreshold - Порог оптовой скидки
 * @returns {Object} - Объект с суммой скидки и информацией
 */
function getWholesaleDiscount(amount, quantity, wholesaleThreshold = 10) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }
  if (typeof quantity !== 'number' || quantity < 0) {
    throw new Error('Quantity must be a non-negative number');
  }

  if (quantity < wholesaleThreshold) {
    return { discount: 0, type: 'none', message: 'Minimum quantity not met' };
  }

  let discount = 0;
  let type = 'wholesale';

  if (quantity >= 100) {
    discount = amount * 0.3;
  } else if (quantity >= 50) {
    discount = amount * 0.2;
  } else if (quantity >= 20) {
    discount = amount * 0.15;
  } else if (quantity >= 10) {
    discount = amount * 0.1;
  }

  return {
    discount,
    type,
    percentage: amount > 0 ? (discount / amount) * 100 : 0,
    message: `Wholesale discount applied for ${quantity} items`,
  };
}

/**
 * Расчет скидки по сезону
 * @param {number} amount - Сумма заказа
 * @param {string} season - Сезон ('summer', 'winter', 'spring', 'autumn', 'holiday')
 * @returns {number} - Сумма скидки
 */
function getSeasonalDiscount(amount, season) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const seasonalRates = {
    summer: 0.15,
    winter: 0.2,
    spring: 0.1,
    autumn: 0.1,
    holiday: 0.25,
    black_friday: 0.4,
    cyber_monday: 0.3,
  };

  const rate = seasonalRates[season] || 0;
  return amount * rate;
}

/**
 * Расчет скидки по дням недели
 * @param {number} amount - Сумма заказа
 * @param {number} dayOfWeek - День недели (0-6, 0 = воскресенье)
 * @returns {number} - Сумма скидки
 */
function getWeekdayDiscount(amount, dayOfWeek) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error('Day of week must be between 0 and 6');
  }

  // Специальные скидки по дням
  const weekdayRates = {
    0: 0.1, // Воскресенье
    1: 0.05, // Понедельник
    2: 0.05, // Вторник
    3: 0.1, // Среда
    4: 0.05, // Четверг
    5: 0.15, // Пятница
    6: 0.2, // Суббота
  };

  return amount * (weekdayRates[dayOfWeek] || 0);
}

/**
 * Расчет скидки с учетом купона
 * @param {number} amount - Сумма заказа
 * @param {Object} coupon - Объект купона
 * @param {string} coupon.code - Код купона
 * @param {string} coupon.type - Тип скидки ('percentage', 'fixed', 'free_shipping')
 * @param {number} coupon.value - Значение скидки
 * @param {number} coupon.minAmount - Минимальная сумма для применения
 * @param {Date} coupon.expiry - Дата истечения
 * @param {string} coupon.category - Категория товаров
 * @param {Array} coupon.excludedItems - Исключенные товары
 * @returns {Object} - Результат применения купона
 */
function applyCoupon(amount, coupon) {
  if (!coupon || typeof coupon !== 'object') {
    return { discount: 0, valid: false, message: 'Invalid coupon' };
  }

  // Проверка срока действия
  if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
    return { discount: 0, valid: false, message: 'Coupon has expired' };
  }

  // Проверка минимальной суммы
  if (coupon.minAmount && amount < coupon.minAmount) {
    return {
      discount: 0,
      valid: false,
      message: `Minimum amount ${coupon.minAmount} required for this coupon`,
    };
  }

  let discount = 0;
  const type = coupon.type || 'percentage';

  switch (type) {
    case 'percentage':
      discount = amount * (coupon.value / 100);
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      break;
    case 'fixed':
      discount = coupon.value;
      break;
    case 'free_shipping':
      discount = coupon.value || 0;
      break;
    default:
      return { discount: 0, valid: false, message: 'Unknown coupon type' };
  }

  // Ограничиваем скидку размером заказа
  if (discount > amount) {
    discount = amount;
  }

  return {
    discount,
    valid: true,
    type,
    message: `Coupon ${coupon.code || 'coupon'} applied successfully`,
    details: {
      originalAmount: amount,
      finalAmount: amount - discount,
      saved: discount,
    },
  };
}

/**
 * Расчет скидки для корпоративного клиента
 * @param {number} amount - Сумма заказа
 * @param {Object} corporateInfo - Информация о корпоративном клиенте
 * @param {string} corporateInfo.level - Уровень клиента ('bronze', 'silver', 'gold', 'platinum')
 * @param {number} corporateInfo.volume - Объем заказов за период
 * @param {number} corporateInfo.discountRate - Базовая ставка скидки
 * @returns {Object} - Результат расчета
 */
function getCorporateDiscount(amount, corporateInfo) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const { level = 'bronze', volume = 0, discountRate = 0 } = corporateInfo;

  // Базовые ставки по уровням
  const levelRates = {
    bronze: 0.05,
    silver: 0.1,
    gold: 0.15,
    platinum: 0.25,
  };

  let baseRate = levelRates[level] || 0;

  // Дополнительная скидка за объем
  let volumeBonus = 0;
  if (volume > 100000) volumeBonus = 0.05;
  else if (volume > 50000) volumeBonus = 0.03;
  else if (volume > 10000) volumeBonus = 0.01;

  // Лояльность (дополнительная скидка для постоянных клиентов)
  const loyaltyBonus =
    corporateInfo.loyaltyYears > 5 ? 0.02 : corporateInfo.loyaltyYears > 3 ? 0.01 : 0;

  // Итоговая ставка
  const totalRate = Math.min(baseRate + volumeBonus + loyaltyBonus + discountRate, 0.5);

  const discount = amount * totalRate;

  return {
    discount,
    rate: totalRate,
    breakdown: {
      baseRate,
      volumeBonus,
      loyaltyBonus,
      additionalRate: discountRate,
    },
    level,
    message: `Corporate discount applied (${level} level)`,
  };
}

/**
 * Расчет скидки по программе лояльности
 * @param {number} amount - Сумма заказа
 * @param {Object} loyaltyInfo - Информация о лояльности
 * @param {number} loyaltyInfo.points - Количество баллов
 * @param {number} loyaltyInfo.tier - Уровень лояльности (1-5)
 * @param {number} loyaltyInfo.ordersCount - Количество заказов
 * @returns {Object} - Результат расчета
 */
function getLoyaltyDiscount(amount, loyaltyInfo) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const { points = 0, tier = 1, ordersCount = 0 } = loyaltyInfo;

  // Базовый уровень лояльности
  const tierRates = {
    1: 0.02,
    2: 0.05,
    3: 0.1,
    4: 0.15,
    5: 0.2,
  };

  let rate = tierRates[tier] || 0;

  // Бонус за количество заказов
  const orderBonus = ordersCount > 50 ? 0.02 : ordersCount > 20 ? 0.01 : 0;

  // Бонус за баллы (конвертация баллов в скидку)
  const pointsDiscount = Math.min(points / 1000, 0.1); // 1000 баллов = 1%

  const totalRate = Math.min(rate + orderBonus + pointsDiscount, 0.3);
  const discount = amount * totalRate;

  // Списываем использованные баллы
  const pointsUsed = Math.round(pointsDiscount * 1000);

  return {
    discount,
    rate: totalRate,
    pointsUsed,
    remainingPoints: Math.max(0, points - pointsUsed),
    tier,
    message: `Loyalty discount applied (tier ${tier})`,
  };
}

/**
 * Расчет комбинированной скидки (несколько скидок)
 * @param {number} amount - Сумма заказа
 * @param {Array} discounts - Массив функций скидок или объектов скидок
 * @param {Object} options - Опции комбинирования
 * @param {string} options.strategy - Стратегия ('additive', 'multiplicative', 'best')
 * @param {number} options.maxDiscount - Максимальная скидка
 * @returns {Object} - Результат комбинирования
 */
function combineDiscounts(amount, discounts = [], options = {}) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const { strategy = 'additive', maxDiscount = amount * 0.8 } = options;

  let totalDiscount = 0;
  const appliedDiscounts = [];
  let remainingAmount = amount;

  for (const discount of discounts) {
    let discountAmount = 0;

    if (typeof discount === 'function') {
      discountAmount = discount(remainingAmount) || 0;
    } else if (typeof discount === 'object' && discount.discount !== undefined) {
      discountAmount = discount.discount;
    } else if (typeof discount === 'number') {
      discountAmount = discount;
    }

    if (discountAmount > 0) {
      appliedDiscounts.push({
        amount: discountAmount,
        remainingBefore: remainingAmount,
      });

      if (strategy === 'additive') {
        totalDiscount += discountAmount;
      } else if (strategy === 'multiplicative') {
        remainingAmount = remainingAmount - discountAmount;
        totalDiscount += discountAmount;
      } else if (strategy === 'best') {
        if (discountAmount > totalDiscount) {
          totalDiscount = discountAmount;
        }
      }
    }
  }

  // Применяем ограничение на максимальную скидку
  if (totalDiscount > maxDiscount) {
    totalDiscount = maxDiscount;
  }

  return {
    discount: totalDiscount,
    finalAmount: amount - totalDiscount,
    savedPercentage: amount > 0 ? (totalDiscount / amount) * 100 : 0,
    appliedDiscounts,
    strategy,
    message: `${appliedDiscounts.length} discounts applied`,
  };
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые функции
  getDiscount,
  getDiscountByType,
  getStandardDiscount,
  getPremiumDiscount,
  getVipDiscount,
  getEmployeeDiscount,

  // Промокоды и купоны
  getDiscountWithPromo,
  applyCoupon,

  // Специальные скидки
  getWholesaleDiscount,
  getSeasonalDiscount,
  getWeekdayDiscount,
  getCorporateDiscount,
  getLoyaltyDiscount,

  // Комбинирование
  combineDiscounts,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями расчета скидок
 */
export default {
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

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ РАСЧЕТА СКИДОК
 *
 * Этот модуль предоставляет 13 функций для расчета скидок:
 *
 * 1. getDiscount               - Базовая скидка (премиум/сумма)
 * 2. getDiscountByType         - Скидка по типу клиента
 * 3. getStandardDiscount       - Стандартная скидка
 * 4. getPremiumDiscount        - Премиальная скидка
 * 5. getVipDiscount            - VIP скидка
 * 6. getEmployeeDiscount       - Скидка для сотрудников
 * 7. getDiscountWithPromo      - Скидка с промокодом
 * 8. applyCoupon               - Применение купона
 * 9. getWholesaleDiscount      - Оптовая скидка
 * 10. getSeasonalDiscount      - Сезонная скидка
 * 11. getWeekdayDiscount       - Скидка по дню недели
 * 12. getCorporateDiscount     - Корпоративная скидка
 * 13. getLoyaltyDiscount       - Скидка по программе лояльности
 * 14. combineDiscounts         - Комбинирование скидок
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные типы клиентов и сценариев
 * - Возвращают объекты с детальной информацией
 * - Поддерживают комбинирование скидок
 * - Имеют JSDoc с описанием параметров и возвращаемых значений
 */
