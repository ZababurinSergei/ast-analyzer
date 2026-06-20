// packages/ast-analyzer/src/formal/__tests__/fixtures/original/08-conditional-logic.js

// ============================================
// УСЛОВНАЯ ЛОГИКА - ОРИГИНАЛЬНЫЙ ФАЙЛ
// ============================================
// Этот файл содержит функции с различными типами условной логики:
// if/else, switch/case, тернарные операторы, вложенные условия

/**
 * Расчет скидки на основе суммы и статуса клиента
 * Использует if/else if/else конструкцию
 * @param {number} amount - Сумма покупки
 * @param {boolean} isPremium - Статус премиум-клиента
 * @returns {number} - Сумма скидки
 */
function getDiscount(amount, isPremium) {
  if (isPremium) {
    return amount * 0.2;
  } else if (amount > 1000) {
    return amount * 0.1;
  } else if (amount > 500) {
    return amount * 0.05;
  } else if (amount > 100) {
    return amount * 0.02;
  } else {
    return 0;
  }
}

/**
 * Определение возрастной категории
 * Использует цепочку if/return
 * @param {number} age - Возраст
 * @returns {string} - Название категории
 */
function getCategory(age) {
  if (age < 0) {
    return 'invalid';
  }
  if (age < 13) {
    return 'child';
  }
  if (age < 18) {
    return 'teenager';
  }
  if (age < 65) {
    return 'adult';
  }
  return 'senior';
}

/**
 * Получение названия дня недели
 * Использует switch/case конструкцию
 * @param {number} day - Номер дня (0-6)
 * @returns {string} - Название дня
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
 * Получение оценки на основе баллов
 * Использует цепочку if/return с диапазонами
 * @param {number} score - Количество баллов (0-100)
 * @returns {string} - Буквенная оценка (A-F)
 */
function getGrade(score) {
  if (score > 100 || score < 0) {
    return 'Invalid';
  }
  if (score >= 90) {
    return 'A';
  }
  if (score >= 80) {
    return 'B';
  }
  if (score >= 70) {
    return 'C';
  }
  if (score >= 60) {
    return 'D';
  }
  return 'F';
}

/**
 * Определение типа числа
 * Использует вложенные условия
 * @param {number} num - Число для проверки
 * @returns {string} - Тип числа
 */
function getNumberType(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return 'Invalid';
  }

  if (num === 0) {
    return 'Zero';
  }

  if (num > 0) {
    if (Number.isInteger(num)) {
      if (num % 2 === 0) {
        return 'Positive Even Integer';
      } else {
        return 'Positive Odd Integer';
      }
    } else {
      if (num % 1 === 0.5) {
        return 'Positive Half';
      }
      return 'Positive Float';
    }
  } else {
    if (Number.isInteger(num)) {
      if (num % 2 === 0) {
        return 'Negative Even Integer';
      } else {
        return 'Negative Odd Integer';
      }
    } else {
      return 'Negative Float';
    }
  }
}

/**
 * Проверка возможности получения кредита
 * Использует множественные условия с AND/OR
 * @param {number} age - Возраст
 * @param {number} income - Годовой доход
 * @param {number} creditScore - Кредитный рейтинг (300-850)
 * @param {boolean} hasExistingLoan - Есть ли существующий кредит
 * @returns {string} - Результат проверки
 */
function checkLoanEligibility(age, income, creditScore, hasExistingLoan) {
  // Базовые проверки
  if (age < 18 || age > 85) {
    return 'Rejected: Age requirements not met';
  }

  if (income < 20000) {
    return 'Rejected: Income too low';
  }

  if (creditScore < 550) {
    return 'Rejected: Credit score too low';
  }

  // Проверка кредитного рейтинга
  if (creditScore >= 750) {
    if (income >= 50000 && !hasExistingLoan) {
      return 'Approved: Excellent terms (0.5% APR)';
    } else if (income >= 50000 && hasExistingLoan) {
      return 'Approved: Good terms (1.5% APR)';
    } else if (income >= 30000 && !hasExistingLoan) {
      return 'Approved: Standard terms (2.5% APR)';
    } else {
      return 'Approved: Basic terms (3.5% APR)';
    }
  } else if (creditScore >= 650) {
    if (income >= 75000 && !hasExistingLoan) {
      return 'Approved: Preferred terms (2.0% APR)';
    } else if (income >= 50000 && !hasExistingLoan) {
      return 'Approved: Standard terms (3.0% APR)';
    } else {
      return 'Approved: Higher rate (4.5% APR)';
    }
  } else if (creditScore >= 550) {
    if (income >= 75000) {
      return 'Approved: Subprime terms (6.0% APR)';
    } else {
      return 'Approved: Subprime terms with co-signer (7.5% APR)';
    }
  } else {
    return 'Rejected: Credit score too low';
  }
}

/**
 * Определение сезона по месяцу
 * Использует switch/case с множественными case
 * @param {number} month - Номер месяца (1-12)
 * @returns {string} - Название сезона
 */
function getSeason(month) {
  switch (month) {
    case 12:
    case 1:
    case 2:
      return 'Winter';
    case 3:
    case 4:
    case 5:
      return 'Spring';
    case 6:
    case 7:
    case 8:
      return 'Summer';
    case 9:
    case 10:
    case 11:
      return 'Autumn';
    default:
      return 'Invalid month';
  }
}

/**
 * Расчет налоговой ставки
 * Использует тернарные операторы
 * @param {number} income - Годовой доход
 * @param {boolean} isMarried - Семейное положение
 * @param {number} dependents - Количество иждивенцев
 * @returns {number} - Налоговая ставка
 */
function getTaxRate(income, isMarried, dependents) {
  const baseRate = income > 100000 ? 0.35 : income > 50000 ? 0.25 : income > 20000 ? 0.15 : 0.1;
  const maritalAdjustment = isMarried ? -0.02 : 0;
  const dependentAdjustment = dependents > 0 ? Math.min(dependents * 0.005, 0.05) : 0;
  const finalRate = baseRate + maritalAdjustment - dependentAdjustment;

  return Math.max(0, Math.min(0.5, finalRate));
}

/**
 * Проверка сложного пароля
 * Использует вложенные условия с AND/OR
 * @param {string} password - Пароль для проверки
 * @returns {Object} - Результат проверки
 */
function validatePassword(password) {
  const result = {
    valid: false,
    errors: [],
    score: 0,
  };

  if (!password || password.length === 0) {
    result.errors.push('Password is required');
    return result;
  }

  // Проверка длины
  if (password.length < 8) {
    result.errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 16) {
    result.score += 20;
  } else {
    result.score += 10;
  }

  // Проверка наличия различных типов символов
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigits = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasUpperCase) {
    result.score += 15;
  } else {
    result.errors.push('Password must contain at least one uppercase letter');
  }

  if (hasLowerCase) {
    result.score += 15;
  } else {
    result.errors.push('Password must contain at least one lowercase letter');
  }

  if (hasDigits) {
    result.score += 15;
  } else {
    result.errors.push('Password must contain at least one digit');
  }

  if (hasSpecialChars) {
    result.score += 20;
  } else {
    result.errors.push('Password must contain at least one special character');
  }

  // Проверка на частые пароли
  const commonPasswords = ['password', '12345678', 'qwerty', 'admin', 'letmein'];
  if (commonPasswords.includes(password.toLowerCase())) {
    result.errors.push('Password is too common');
    result.score = 0;
  }

  // Проверка на повторяющиеся символы
  if (/(.)\1{3,}/.test(password)) {
    result.errors.push('Password has too many repeated characters');
    result.score = Math.max(0, result.score - 30);
  }

  // Итоговое решение
  result.valid = result.errors.length === 0 && result.score >= 50;
  result.score = Math.max(0, Math.min(100, result.score));

  return result;
}

/**
 * Определение тарифа на основе использования
 * Использует switch/case с диапазонами
 * @param {number} usage - Использование в GB
 * @param {string} userType - Тип пользователя (personal, business, enterprise)
 * @returns {string} - Название тарифа
 */
function getPlan(usage, userType) {
  let plan = '';

  switch (userType) {
    case 'personal':
      if (usage <= 5) plan = 'Basic (5GB)';
      else if (usage <= 20) plan = 'Standard (20GB)';
      else if (usage <= 100) plan = 'Premium (100GB)';
      else plan = 'Unlimited';
      break;

    case 'business':
      if (usage <= 50) plan = 'Business Starter (50GB)';
      else if (usage <= 200) plan = 'Business Pro (200GB)';
      else if (usage <= 1000) plan = 'Business Premium (1TB)';
      else plan = 'Business Unlimited';
      break;

    case 'enterprise':
      if (usage <= 1000) plan = 'Enterprise Starter (1TB)';
      else if (usage <= 10000) plan = 'Enterprise Standard (10TB)';
      else if (usage <= 100000) plan = 'Enterprise Premium (100TB)';
      else plan = 'Enterprise Custom';
      break;

    default:
      plan = 'Unknown Plan';
  }

  return plan;
}

/**
 * Определение размера порции на основе параметров
 * Использует тернарные операторы и вложенные условия
 * @param {string} itemType - Тип блюда (appetizer, main, dessert, drink)
 * @param {number} people - Количество человек
 * @param {boolean} isParty - Является ли вечеринкой
 * @param {string} occasion - Повод (casual, formal, holiday)
 * @returns {string} - Размер порции
 */
function getPortionSize(itemType, people, isParty, occasion) {
  let size = '';

  if (people <= 1) {
    size = isParty ? 'Small (Party)' : 'Individual';
  } else if (people <= 4) {
    size = isParty ? 'Medium (Party)' : 'Small Group';
  } else if (people <= 8) {
    size = isParty ? 'Large (Party)' : 'Medium Group';
  } else {
    size = 'Extra Large';
  }

  // Корректировка на основе типа блюда
  if (itemType === 'appetizer') {
    size = size + ' (Appetizer)';
  } else if (itemType === 'main') {
    size = size + ' (Main Course)';
  } else if (itemType === 'dessert') {
    size = size + ' (Dessert)';
  } else if (itemType === 'drink') {
    size = size + ' (Beverage)';
  }

  // Корректировка для особых случаев
  if (occasion === 'holiday' && isParty) {
    size = 'Holiday ' + size;
  } else if (occasion === 'formal') {
    size = 'Elegant ' + size;
  }

  return size;
}

/**
 * Комплексная проверка статуса заказа
 * Использует множественные условия с различными операторами
 * @param {Object} order - Объект заказа
 * @returns {string} - Статус заказа
 */
function determineOrderStatus(order) {
  // Проверка обязательных полей
  if (!order || typeof order !== 'object') {
    return 'ERROR: Invalid order';
  }

  if (!order.items || order.items.length === 0) {
    return 'ERROR: Empty order';
  }

  // Проверка статуса оплаты
  const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'completed';
  const isVerified = order.verificationStatus === 'verified';
  const isShipping = order.shippingStatus === 'shipped' || order.shippingStatus === 'delivered';
  const isCancelled = order.cancellationStatus === 'cancelled';

  // Основная логика
  if (isCancelled) {
    return 'CANCELLED';
  }

  if (!isPaid) {
    if (order.paymentStatus === 'pending') {
      return 'AWAITING_PAYMENT';
    } else if (order.paymentStatus === 'failed') {
      return 'PAYMENT_FAILED';
    } else {
      return 'PENDING';
    }
  }

  if (!isVerified) {
    if (order.verificationStatus === 'pending') {
      return 'AWAITING_VERIFICATION';
    } else if (order.verificationStatus === 'failed') {
      return 'VERIFICATION_FAILED';
    } else {
      return 'PROCESSING';
    }
  }

  if (!isShipping) {
    if (order.shippingStatus === 'processing') {
      return 'PREPARING_SHIPMENT';
    } else if (order.shippingStatus === 'ready') {
      return 'READY_FOR_SHIPMENT';
    } else if (order.shippingStatus === 'shipped') {
      return 'SHIPPED';
    } else {
      return 'PROCESSING';
    }
  }

  // Дополнительные проверки
  if (order.priority === 'express') {
    return 'EXPRESS_DELIVERY';
  }

  if (order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'DELAYED';
  }

  if (order.trackingNumber) {
    return 'IN_TRANSIT';
  }

  return 'COMPLETED';
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  getDiscount,
  getCategory,
  getDayName,
  getGrade,
  getNumberType,
  checkLoanEligibility,
  getSeason,
  getTaxRate,
  validatePassword,
  getPlan,
  getPortionSize,
  determineOrderStatus,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * Этот файл содержит 12 функций с различными типами условной логики:
 * 1. getDiscount - if/else if/else
 * 2. getCategory - цепочка if/return
 * 3. getDayName - switch/case
 * 4. getGrade - цепочка if/return с диапазонами
 * 5. getNumberType - вложенные условия
 * 6. checkLoanEligibility - множественные условия с AND/OR
 * 7. getSeason - switch/case с множественными case
 * 8. getTaxRate - тернарные операторы
 * 9. validatePassword - сложная проверка с AND/OR
 * 10. getPlan - switch/case с диапазонами
 * 11. getPortionSize - тернарные операторы и вложенные условия
 * 12. determineOrderStatus - комплексная условная логика
 */
