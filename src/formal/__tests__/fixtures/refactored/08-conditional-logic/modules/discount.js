// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/08-conditional-logic/modules/discount.js

// ============================================
// МОДУЛЬ РАСЧЕТА СКИДОК
// ============================================
// Этот модуль содержит функции для расчета скидок
// в различных сценариях и для различных типов клиентов.

/**
 * Базовая функция расчета скидки
 * @param {number} amount - Сумма заказа
 * @param {boolean} isPremium - Флаг премиум-клиента
 * @returns {number} - Сумма скидки
 */
function getDiscount(amount, isPremium) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }

  if (isPremium) {
    if (amount > 10000) {
      return amount * 0.3; // 30% для премиум клиентов с большим заказом
    }
    if (amount > 5000) {
      return amount * 0.25; // 25% для премиум клиентов со средним заказом
    }
    return amount * 0.2; // 20% для премиум клиентов
  }

  if (amount > 10000) {
    return amount * 0.15; // 15% для обычных клиентов с большим заказом
  }
  if (amount > 5000) {
    return amount * 0.1; // 10% для обычных клиентов со средним заказом
  }
  if (amount > 1000) {
    return amount * 0.05; // 5% для обычных клиентов с маленьким заказом
  }
  return 0;
}

/**
 * Расчет скидки с учетом количества товаров
 * @param {number} amount - Сумма заказа
 * @param {number} quantity - Количество товаров
 * @param {boolean} isPremium - Флаг премиум-клиента
 * @returns {number} - Сумма скидки
 */
function getBulkDiscount(amount, quantity, isPremium) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }
  if (typeof quantity !== 'number' || isNaN(quantity) || quantity < 0) {
    return 0;
  }

  let discountRate = 0;

  // Оптовая скидка
  if (quantity >= 100) {
    discountRate += 0.15;
  } else if (quantity >= 50) {
    discountRate += 0.1;
  } else if (quantity >= 25) {
    discountRate += 0.05;
  } else if (quantity >= 10) {
    discountRate += 0.02;
  }

  // Скидка за сумму
  if (amount > 10000) {
    discountRate += 0.1;
  } else if (amount > 5000) {
    discountRate += 0.05;
  } else if (amount > 1000) {
    discountRate += 0.02;
  }

  // Премиум-скидка
  if (isPremium) {
    discountRate += 0.1;
  }

  // Кап на максимальную скидку
  discountRate = Math.min(discountRate, 0.5);

  return amount * discountRate;
}

/**
 * Расчет скидки с учетом категории товара
 * @param {number} amount - Сумма заказа
 * @param {string} category - Категория товара
 * @param {boolean} isPremium - Флаг премиум-клиента
 * @returns {number} - Сумма скидки
 */
function getCategoryDiscount(amount, category, isPremium) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }

  const categoryRates = {
    electronics: 0.05,
    clothing: 0.1,
    books: 0.15,
    food: 0.02,
    furniture: 0.08,
    toys: 0.12,
    sports: 0.07,
    beauty: 0.09,
    automotive: 0.03,
    home: 0.06,
  };

  let discountRate = categoryRates[category] || 0;

  // Дополнительная скидка для премиум клиентов
  if (isPremium) {
    discountRate += 0.05;
  }

  // Дополнительная скидка для дорогих товаров
  if (amount > 5000) {
    discountRate += 0.02;
  }

  return amount * discountRate;
}

/**
 * Расчет скидки по купону
 * @param {number} amount - Сумма заказа
 * @param {string} couponCode - Код купона
 * @param {Date} currentDate - Текущая дата
 * @returns {number} - Сумма скидки
 */
function getCouponDiscount(amount, couponCode, currentDate = new Date()) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }
  if (!couponCode || typeof couponCode !== 'string') {
    return 0;
  }

  const coupons = {
    SAVE10: { discount: 0.1, minAmount: 100, expires: new Date('2025-12-31') },
    SAVE20: { discount: 0.2, minAmount: 200, expires: new Date('2025-12-31') },
    SAVE30: { discount: 0.3, minAmount: 500, expires: new Date('2025-12-31') },
    SAVE50: { discount: 0.5, minAmount: 1000, expires: new Date('2025-12-31') },
    WELCOME: { discount: 0.15, minAmount: 50, expires: new Date('2025-06-30') },
    HOLIDAY: { discount: 0.25, minAmount: 150, expires: new Date('2025-12-25') },
    FLASH: { discount: 0.4, minAmount: 300, expires: new Date('2025-12-01') },
    LOYALTY: { discount: 0.12, minAmount: 75, expires: new Date('2026-01-01') },
  };

  const coupon = coupons[couponCode];
  if (!coupon) {
    return 0;
  }

  // Проверка минимальной суммы
  if (amount < coupon.minAmount) {
    return 0;
  }

  // Проверка срока действия
  if (currentDate > coupon.expires) {
    return 0;
  }

  return amount * coupon.discount;
}

/**
 * Расчет динамической скидки на основе сезона и времени
 * @param {number} amount - Сумма заказа
 * @param {Date} date - Текущая дата
 * @param {string} season - Сезон (summer, winter, spring, autumn)
 * @returns {number} - Сумма скидки
 */
function getSeasonalDiscount(amount, date = new Date(), season = null) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }

  // Определяем сезон если не указан
  if (!season) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'autumn';
    else season = 'winter';
  }

  // Базовые сезонные скидки
  const seasonalRates = {
    summer: 0.15,
    winter: 0.2,
    spring: 0.1,
    autumn: 0.12,
  };

  let discountRate = seasonalRates[season] || 0;

  // Дополнительная скидка в зависимости от суммы
  if (amount > 10000) {
    discountRate += 0.05;
  } else if (amount > 5000) {
    discountRate += 0.03;
  } else if (amount > 1000) {
    discountRate += 0.01;
  }

  // Сезонные праздники
  const day = date.getDate();
  const month = date.getMonth();

  // Новый год
  if (month === 0 && day <= 10) {
    discountRate += 0.05;
  }

  // Черная пятница (ноябрь, последняя пятница месяца)
  if (month === 10) {
    const lastFriday = getLastFridayOfMonth(date.getFullYear(), month);
    if (date.getDate() >= lastFriday - 2 && date.getDate() <= lastFriday + 2) {
      discountRate += 0.1;
    }
  }

  // Рождество
  if (month === 11 && day >= 20 && day <= 26) {
    discountRate += 0.08;
  }

  // День влюбленных
  if (month === 1 && day >= 10 && day <= 14) {
    discountRate += 0.07;
  }

  // Кап на максимальную скидку
  discountRate = Math.min(discountRate, 0.5);

  return amount * discountRate;
}

/**
 * Вспомогательная функция для получения даты последней пятницы месяца
 * @param {number} year - Год
 * @param {number} month - Месяц (0-11)
 * @returns {number} - День последней пятницы
 */
function getLastFridayOfMonth(year, month) {
  const lastDay = new Date(year, month + 1, 0);
  let day = lastDay.getDate();
  while (day > 0) {
    const date = new Date(year, month, day);
    if (date.getDay() === 5) {
      // 5 = Friday
      return day;
    }
    day--;
  }
  return 0;
}

/**
 * Расчет комбинированной скидки
 * @param {number} amount - Сумма заказа
 * @param {Object} options - Опции для расчета
 * @returns {Object} - Объект с информацией о скидке
 */
function calculateCombinedDiscount(amount, options = {}) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return { discount: 0, details: [] };
  }

  const {
    isPremium = false,
    quantity = 1,
    category = null,
    couponCode = null,
    season = null,
    date = new Date(),
    loyaltyLevel = 'standard',
  } = options;

  const discountDetails = [];
  let totalDiscount = 0;

  // Базовая скидка
  const baseDiscount = getDiscount(amount, isPremium);
  if (baseDiscount > 0) {
    discountDetails.push({
      type: 'base',
      amount: baseDiscount,
      rate: (baseDiscount / amount) * 100,
    });
    totalDiscount += baseDiscount;
  }

  // Оптовая скидка
  if (quantity > 1) {
    const bulkDiscount = getBulkDiscount(amount, quantity, isPremium) - baseDiscount;
    if (bulkDiscount > 0) {
      discountDetails.push({
        type: 'bulk',
        amount: bulkDiscount,
        rate: (bulkDiscount / amount) * 100,
      });
      totalDiscount += bulkDiscount;
    }
  }

  // Категорийная скидка
  if (category) {
    const categoryDiscount = getCategoryDiscount(amount, category, isPremium) - baseDiscount;
    if (categoryDiscount > 0) {
      discountDetails.push({
        type: 'category',
        amount: categoryDiscount,
        rate: (categoryDiscount / amount) * 100,
      });
      totalDiscount += categoryDiscount;
    }
  }

  // Купонная скидка
  if (couponCode) {
    const couponDiscount = getCouponDiscount(amount, couponCode, date) - baseDiscount;
    if (couponDiscount > 0) {
      discountDetails.push({
        type: 'coupon',
        amount: couponDiscount,
        rate: (couponDiscount / amount) * 100,
      });
      totalDiscount += couponDiscount;
    }
  }

  // Сезонная скидка
  if (season) {
    const seasonalDiscount = getSeasonalDiscount(amount, date, season) - baseDiscount;
    if (seasonalDiscount > 0) {
      discountDetails.push({
        type: 'seasonal',
        amount: seasonalDiscount,
        rate: (seasonalDiscount / amount) * 100,
      });
      totalDiscount += seasonalDiscount;
    }
  }

  // Скидка за лояльность
  const loyaltyDiscount = getLoyaltyDiscount(amount, loyaltyLevel);
  if (loyaltyDiscount > 0) {
    discountDetails.push({
      type: 'loyalty',
      amount: loyaltyDiscount,
      rate: (loyaltyDiscount / amount) * 100,
    });
    totalDiscount += loyaltyDiscount;
  }

  // Кап на общую скидку
  const maxDiscount = amount * 0.5; // Максимум 50%
  if (totalDiscount > maxDiscount) {
    // Пропорционально уменьшаем все скидки
    const factor = maxDiscount / totalDiscount;
    totalDiscount = maxDiscount;
    for (const detail of discountDetails) {
      detail.amount *= factor;
      detail.rate *= factor;
    }
  }

  // Округляем до 2 знаков
  totalDiscount = Math.round(totalDiscount * 100) / 100;

  return {
    discount: totalDiscount,
    finalAmount: amount - totalDiscount,
    details: discountDetails,
    totalRate: (totalDiscount / amount) * 100,
  };
}

/**
 * Расчет скидки за лояльность
 * @param {number} amount - Сумма заказа
 * @param {string} level - Уровень лояльности (standard, silver, gold, platinum)
 * @returns {number} - Сумма скидки
 */
function getLoyaltyDiscount(amount, level = 'standard') {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }

  const loyaltyRates = {
    standard: 0.0,
    silver: 0.05,
    gold: 0.1,
    platinum: 0.15,
  };

  const rate = loyaltyRates[level] || 0;
  return amount * rate;
}

/**
 * Расчет скидки для корпоративных клиентов
 * @param {number} amount - Сумма заказа
 * @param {string} companyType - Тип компании (small, medium, large, enterprise)
 * @param {number} employeeCount - Количество сотрудников
 * @param {number} years - Количество лет сотрудничества
 * @returns {number} - Сумма скидки
 */
function getCorporateDiscount(amount, companyType = 'small', employeeCount = 0, years = 0) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }

  let discountRate = 0;

  // Базовая скидка по типу компании
  const companyRates = {
    small: 0.02,
    medium: 0.05,
    large: 0.08,
    enterprise: 0.12,
  };
  discountRate += companyRates[companyType] || 0;

  // Дополнительная скидка за количество сотрудников
  if (employeeCount > 1000) {
    discountRate += 0.05;
  } else if (employeeCount > 500) {
    discountRate += 0.03;
  } else if (employeeCount > 100) {
    discountRate += 0.01;
  }

  // Скидка за многолетнее сотрудничество
  if (years > 10) {
    discountRate += 0.05;
  } else if (years > 5) {
    discountRate += 0.03;
  } else if (years > 2) {
    discountRate += 0.01;
  }

  // Кап на максимальную скидку
  discountRate = Math.min(discountRate, 0.3);

  return amount * discountRate;
}

/**
 * Расчет скидки на основе процента от общей суммы
 * @param {number} amount - Сумма заказа
 * @param {number} percentage - Процент скидки
 * @param {number} maxAmount - Максимальная сумма скидки
 * @param {number} minAmount - Минимальная сумма для скидки
 * @returns {number} - Сумма скидки
 */
function getPercentageDiscount(amount, percentage, maxAmount = null, minAmount = 0) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }
  if (typeof percentage !== 'number' || isNaN(percentage) || percentage < 0 || percentage > 100) {
    return 0;
  }

  if (amount < minAmount) {
    return 0;
  }

  let discount = amount * (percentage / 100);

  if (maxAmount !== null && discount > maxAmount) {
    discount = maxAmount;
  }

  return Math.round(discount * 100) / 100;
}

/**
 * Расчет скидки на основе фиксированной суммы
 * @param {number} amount - Сумма заказа
 * @param {number} fixedAmount - Фиксированная сумма скидки
 * @param {number} minAmount - Минимальная сумма для скидки
 * @returns {number} - Сумма скидки
 */
function getFixedDiscount(amount, fixedAmount, minAmount = 0) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }
  if (typeof fixedAmount !== 'number' || isNaN(fixedAmount) || fixedAmount < 0) {
    return 0;
  }

  if (amount < minAmount) {
    return 0;
  }

  const discount = Math.min(fixedAmount, amount);
  return Math.round(discount * 100) / 100;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Основные функции расчета скидок
  getDiscount,
  getBulkDiscount,
  getCategoryDiscount,
  getCouponDiscount,
  getSeasonalDiscount,
  getLoyaltyDiscount,
  getCorporateDiscount,
  getPercentageDiscount,
  getFixedDiscount,

  // Комбинированная скидка
  calculateCombinedDiscount,

  // Вспомогательные функции
  getLastFridayOfMonth,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями расчета скидок
 */
export default {
  getDiscount,
  getBulkDiscount,
  getCategoryDiscount,
  getCouponDiscount,
  getSeasonalDiscount,
  getLoyaltyDiscount,
  getCorporateDiscount,
  getPercentageDiscount,
  getFixedDiscount,
  calculateCombinedDiscount,
  getLastFridayOfMonth,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ РАСЧЕТА СКИДОК
 *
 * Этот модуль предоставляет 9 функций для расчета скидок:
 *
 * 1. getDiscount              - Базовая скидка
 * 2. getBulkDiscount          - Оптовая скидка
 * 3. getCategoryDiscount      - Скидка по категории товара
 * 4. getCouponDiscount        - Скидка по купону
 * 5. getSeasonalDiscount      - Сезонная скидка
 * 6. getLoyaltyDiscount       - Скидка за лояльность
 * 7. getCorporateDiscount     - Корпоративная скидка
 * 8. getPercentageDiscount    - Процентная скидка
 * 9. getFixedDiscount         - Фиксированная скидка
 * 10. calculateCombinedDiscount - Комбинированная скидка
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают множественные параметры
 * - Имеют ограничение на максимальную скидку (кап)
 * - Возвращают детальную информацию о скидке
 * - Поддерживают различные типы клиентов и сценарии
 * - Имеют JSDoc с описанием параметров
 * - Обрабатывают граничные случаи (NaN, null, undefined)
 * - Округляют результат до 2 знаков после запятой
 */
