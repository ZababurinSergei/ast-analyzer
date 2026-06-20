// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/08-conditional-logic/index.js

// ============================================
// УСЛОВНАЯ ЛОГИКА - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Вся условная логика вынесена в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт функций для работы со скидками
import {
  getDiscount,
  getBulkDiscount,
  getSeasonalDiscount,
  getLoyaltyDiscount,
  calculateTotalDiscount,
  getDiscountLevel,
  isValidDiscountCode,
  applyDiscountToPrice,
} from './modules/discount.js';

// Импорт функций для категоризации
import {
  getCategory,
  getAgeGroup,
  getIncomeLevel,
  getEducationLevel,
  getEmploymentStatus,
  getMaritalStatus,
  getRiskLevel,
  getPriorityLevel,
} from './modules/category.js';

// Импорт функций для работы с днями
import {
  getDayName,
  getDayType,
  getWeekNumber,
  getQuarter,
  getSeason,
  isWeekend,
  isHoliday,
  getNextWorkingDay,
  getPreviousWorkingDay,
  getDaysBetween,
  getBusinessDaysBetween,
} from './modules/day.js';

// Импорт функций для оценок
import {
  getGrade,
  getGradeDescription,
  getGradeColor,
  getGradePoints,
  getGradeRange,
  getGradeAverage,
  getGradeDistribution,
  calculateGPA,
  isPassingGrade,
  getAcademicStanding,
} from './modules/grade.js';

// Импорт функций для валидации
import {
  validateEmail,
  validatePhone,
  validateURL,
  validateIP,
  validateCreditCard,
  validatePostalCode,
  validateDate,
  validateTime,
  validateRange,
  validateRequired,
  validateLength,
  validatePattern,
  validateUnique,
  validateAll,
} from './modules/validation.js';

// Импорт функций для принятия решений
import {
  evaluateDecision,
  getDecisionTree,
  makeDecision,
  evaluateCriteria,
  rankOptions,
  getRecommendation,
  calculateRiskScore,
  getConfidenceLevel,
  analyzeOptions,
} from './modules/decision.js';

// ============================================
// КОМБИНИРОВАННЫЕ УСЛОВНЫЕ ОПЕРАЦИИ
// ============================================

/**
 * Рассчитывает финальную цену с учетом всех скидок
 * @param {number} price - Исходная цена
 * @param {number} quantity - Количество товаров
 * @param {string} customerType - Тип клиента
 * @param {string} season - Сезон
 * @param {string} discountCode - Код скидки
 * @returns {Object} - Результат расчета
 */
function calculateFinalPrice(price, quantity, customerType, season, discountCode) {
  // Проверка валидности входных данных
  if (!validateRequired(price) || !validateRequired(quantity)) {
    return { error: 'Invalid input: price and quantity are required' };
  }

  if (!validateRange(price, 0, Infinity)) {
    return { error: 'Invalid input: price must be positive' };
  }

  if (!validateRange(quantity, 1, 1000)) {
    return { error: 'Invalid input: quantity must be between 1 and 1000' };
  }

  // Получаем базовую скидку
  const baseDiscount = getDiscount(price, customerType);

  // Получаем оптовую скидку
  const bulkDiscount = getBulkDiscount(quantity);

  // Получаем сезонную скидку
  const seasonalDiscount = getSeasonalDiscount(season);

  // Получаем скидку по коду
  const codeDiscount = isValidDiscountCode(discountCode) ? getDiscount(discountCode) : 0;

  // Рассчитываем общую скидку
  const totalDiscountPercent = calculateTotalDiscount([
    baseDiscount,
    bulkDiscount,
    seasonalDiscount,
    codeDiscount,
  ]);

  // Рассчитываем итоговую цену
  const subtotal = price * quantity;
  const discountAmount = subtotal * totalDiscountPercent;
  const finalPrice = subtotal - discountAmount;

  // Получаем уровень скидки
  const discountLevel = getDiscountLevel(totalDiscountPercent);

  return {
    subtotal,
    discountAmount,
    finalPrice,
    totalDiscountPercent,
    discountLevel,
    breakdown: {
      baseDiscount,
      bulkDiscount,
      seasonalDiscount,
      codeDiscount,
    },
  };
}

/**
 * Оценивает профиль клиента на основе различных критериев
 * @param {Object} customer - Объект с данными клиента
 * @returns {Object} - Профиль клиента
 */
function evaluateCustomerProfile(customer) {
  if (!customer || typeof customer !== 'object') {
    return { error: 'Invalid customer data' };
  }

  const { age, income, education, employment, maritalStatus, email, phone, purchaseHistory } =
    customer;

  // Валидация данных
  const validationErrors = validateAll({
    email: validateEmail(email),
    phone: validatePhone(phone),
    age: validateRange(age, 0, 150),
    income: validateRange(income, 0, Infinity),
  });

  if (Object.keys(validationErrors).length > 0) {
    return { error: 'Validation failed', errors: validationErrors };
  }

  // Категоризация
  const ageGroup = getAgeGroup(age);
  const incomeLevel = getIncomeLevel(income);
  const educationLevel = getEducationLevel(education);
  const employmentStatus = getEmploymentStatus(employment);
  const marital = getMaritalStatus(maritalStatus);

  // Расчет риска и приоритета
  const riskLevel = getRiskLevel({
    age,
    income,
    employment: employmentStatus,
    marital: marital,
  });

  const priorityLevel = getPriorityLevel({
    income: incomeLevel,
    education: educationLevel,
    purchaseHistory,
  });

  // Рекомендация
  const recommendation = getRecommendation({
    riskLevel,
    priorityLevel,
    incomeLevel,
    ageGroup,
  });

  return {
    ageGroup,
    incomeLevel,
    educationLevel,
    employmentStatus,
    maritalStatus: marital,
    riskLevel,
    priorityLevel,
    recommendation,
    confidence: getConfidenceLevel({ age, income, education, employment }),
  };
}

/**
 * Анализирует дату и возвращает подробную информацию
 * @param {Date|string} date - Дата для анализа
 * @returns {Object} - Информация о дате
 */
function analyzeDate(date) {
  // Проверка валидности
  if (!validateDate(date)) {
    return { error: 'Invalid date' };
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return {
    dayName: getDayName(dateObj),
    dayType: getDayType(dateObj),
    weekNumber: getWeekNumber(dateObj),
    quarter: getQuarter(dateObj),
    season: getSeason(dateObj),
    isWeekend: isWeekend(dateObj),
    isHoliday: isHoliday(dateObj),
    nextWorkingDay: getNextWorkingDay(dateObj),
    previousWorkingDay: getPreviousWorkingDay(dateObj),
  };
}

/**
 * Вычисляет академический статус студента
 * @param {Array} grades - Массив оценок
 * @param {number} credits - Количество кредитов
 * @returns {Object} - Академический статус
 */
function calculateAcademicStatus(grades, credits) {
  if (!grades || !Array.isArray(grades) || grades.length === 0) {
    return { error: 'Invalid grades data' };
  }

  // Получаем распределение оценок
  const distribution = getGradeDistribution(grades);

  // Вычисляем GPA
  const gpa = calculateGPA(grades, credits);

  // Получаем академический статус
  const standing = getAcademicStanding(gpa);

  // Получаем среднюю оценку
  const average = getGradeAverage(grades);

  // Получаем информацию о проходных оценках
  const passingGrades = grades.filter(grade => isPassingGrade(grade));
  const passingRate = grades.length > 0 ? (passingGrades.length / grades.length) * 100 : 0;

  // Рекомендации
  let recommendations = [];
  if (gpa < 2.0) {
    recommendations.push('Academic probation - seek academic advising');
  } else if (gpa < 3.0) {
    recommendations.push('Consider improving study habits');
  } else if (gpa >= 3.5) {
    recommendations.push('Excellent performance - consider honors program');
  }

  return {
    gpa,
    standing,
    average,
    passingRate: passingRate.toFixed(1) + '%',
    distribution,
    recommendations,
    summary: getGradeDescription(standing),
  };
}

/**
 * Принимает решение на основе множества критериев
 * @param {Object} options - Опции для принятия решения
 * @param {Array} criteria - Критерии для оценки
 * @returns {Object} - Решение и обоснование
 */
function makeComplexDecision(options, criteria) {
  if (!options || !criteria || !Array.isArray(criteria)) {
    return { error: 'Invalid input: options and criteria are required' };
  }

  // Оцениваем критерии
  const evaluations = evaluateCriteria(options, criteria);

  // Ранжируем опции
  const ranked = rankOptions(evaluations);

  // Принимаем решение
  const decision = makeDecision(ranked);

  // Анализируем опции
  const analysis = analyzeOptions(evaluations);

  // Получаем дерево решений
  const decisionTree = getDecisionTree(decision);

  return {
    decision,
    confidence: getConfidenceLevel(ranked),
    riskScore: calculateRiskScore(decision),
    evaluation: evaluations,
    ranked,
    analysis,
    decisionTree,
  };
}

/**
 * Проверяет комплексную валидацию данных
 * @param {Object} data - Данные для валидации
 * @param {Object} rules - Правила валидации
 * @returns {Object} - Результат валидации
 */
function validateComplexData(data, rules) {
  if (!data || typeof data !== 'object') {
    return { error: 'Invalid data object' };
  }

  if (!rules || typeof rules !== 'object') {
    return { error: 'Invalid validation rules' };
  }

  const errors = {};
  const warnings = {};
  const info = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    const fieldRules = Array.isArray(rule) ? rule : [rule];

    for (const fieldRule of fieldRules) {
      let result;

      switch (fieldRule.type) {
        case 'required':
          result = validateRequired(value, fieldRule.options);
          if (!result) {
            errors[field] = `${field} is required`;
          }
          break;
        case 'email':
          result = validateEmail(value);
          if (!result) {
            errors[field] = `${field} must be a valid email`;
          }
          break;
        case 'phone':
          result = validatePhone(value);
          if (!result) {
            warnings[field] = `${field} may be invalid phone number`;
          }
          break;
        case 'url':
          result = validateURL(value);
          if (!result) {
            warnings[field] = `${field} may be invalid URL`;
          }
          break;
        case 'range':
          result = validateRange(value, fieldRule.min, fieldRule.max);
          if (!result) {
            errors[field] = `${field} must be between ${fieldRule.min} and ${fieldRule.max}`;
          }
          break;
        case 'length':
          result = validateLength(value, fieldRule.min, fieldRule.max);
          if (!result) {
            errors[field] = `${field} length must be between ${fieldRule.min} and ${fieldRule.max}`;
          }
          break;
        case 'pattern':
          result = validatePattern(value, fieldRule.pattern);
          if (!result) {
            errors[field] = `${field} does not match required pattern`;
          }
          break;
        case 'unique':
          result = validateUnique(value, data, field);
          if (!result) {
            errors[field] = `${field} must be unique`;
          }
          break;
        default:
          info[field] = `No validation for ${field}`;
      }
    }
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    warnings,
    info,
    summary: {
      totalErrors: Object.keys(errors).length,
      totalWarnings: Object.keys(warnings).length,
      totalInfo: Object.keys(info).length,
    },
  };
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт всех модулей
export {
  // Скидки
  getDiscount,
  getBulkDiscount,
  getSeasonalDiscount,
  getLoyaltyDiscount,
  calculateTotalDiscount,
  getDiscountLevel,
  isValidDiscountCode,
  applyDiscountToPrice,

  // Категории
  getCategory,
  getAgeGroup,
  getIncomeLevel,
  getEducationLevel,
  getEmploymentStatus,
  getMaritalStatus,
  getRiskLevel,
  getPriorityLevel,

  // Дни
  getDayName,
  getDayType,
  getWeekNumber,
  getQuarter,
  getSeason,
  isWeekend,
  isHoliday,
  getNextWorkingDay,
  getPreviousWorkingDay,
  getDaysBetween,
  getBusinessDaysBetween,

  // Оценки
  getGrade,
  getGradeDescription,
  getGradeColor,
  getGradePoints,
  getGradeRange,
  getGradeAverage,
  getGradeDistribution,
  calculateGPA,
  isPassingGrade,
  getAcademicStanding,

  // Валидация
  validateEmail,
  validatePhone,
  validateURL,
  validateIP,
  validateCreditCard,
  validatePostalCode,
  validateDate,
  validateTime,
  validateRange,
  validateRequired,
  validateLength,
  validatePattern,
  validateUnique,
  validateAll,

  // Решения
  evaluateDecision,
  getDecisionTree,
  makeDecision,
  evaluateCriteria,
  rankOptions,
  getRecommendation,
  calculateRiskScore,
  getConfidenceLevel,
  analyzeOptions,

  // Комбинированные функции
  calculateFinalPrice,
  evaluateCustomerProfile,
  analyzeDate,
  calculateAcademicStatus,
  makeComplexDecision,
  validateComplexData,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  // Скидки
  getDiscount,
  getBulkDiscount,
  getSeasonalDiscount,
  getLoyaltyDiscount,
  calculateTotalDiscount,
  getDiscountLevel,
  isValidDiscountCode,
  applyDiscountToPrice,

  // Категории
  getCategory,
  getAgeGroup,
  getIncomeLevel,
  getEducationLevel,
  getEmploymentStatus,
  getMaritalStatus,
  getRiskLevel,
  getPriorityLevel,

  // Дни
  getDayName,
  getDayType,
  getWeekNumber,
  getQuarter,
  getSeason,
  isWeekend,
  isHoliday,
  getNextWorkingDay,
  getPreviousWorkingDay,
  getDaysBetween,
  getBusinessDaysBetween,

  // Оценки
  getGrade,
  getGradeDescription,
  getGradeColor,
  getGradePoints,
  getGradeRange,
  getGradeAverage,
  getGradeDistribution,
  calculateGPA,
  isPassingGrade,
  getAcademicStanding,

  // Валидация
  validateEmail,
  validatePhone,
  validateURL,
  validateIP,
  validateCreditCard,
  validatePostalCode,
  validateDate,
  validateTime,
  validateRange,
  validateRequired,
  validateLength,
  validatePattern,
  validateUnique,
  validateAll,

  // Решения
  evaluateDecision,
  getDecisionTree,
  makeDecision,
  evaluateCriteria,
  rankOptions,
  getRecommendation,
  calculateRiskScore,
  getConfidenceLevel,
  analyzeOptions,

  // Комбинированные функции
  calculateFinalPrice,
  evaluateCustomerProfile,
  analyzeDate,
  calculateAcademicStatus,
  makeComplexDecision,
  validateComplexData,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Функции для работы со скидками вынесены в modules/discount.js:
 *    - getDiscount, getBulkDiscount, getSeasonalDiscount
 *    - getLoyaltyDiscount, calculateTotalDiscount
 *    - getDiscountLevel, isValidDiscountCode
 *    - applyDiscountToPrice
 *
 * 2. Функции для категоризации вынесены в modules/category.js:
 *    - getCategory, getAgeGroup, getIncomeLevel
 *    - getEducationLevel, getEmploymentStatus
 *    - getMaritalStatus, getRiskLevel, getPriorityLevel
 *
 * 3. Функции для работы с днями вынесены в modules/day.js:
 *    - getDayName, getDayType, getWeekNumber
 *    - getQuarter, getSeason, isWeekend, isHoliday
 *    - getNextWorkingDay, getPreviousWorkingDay
 *    - getDaysBetween, getBusinessDaysBetween
 *
 * 4. Функции для оценок вынесены в modules/grade.js:
 *    - getGrade, getGradeDescription, getGradeColor
 *    - getGradePoints, getGradeRange, getGradeAverage
 *    - getGradeDistribution, calculateGPA
 *    - isPassingGrade, getAcademicStanding
 *
 * 5. Функции для валидации вынесены в modules/validation.js:
 *    - validateEmail, validatePhone, validateURL
 *    - validateIP, validateCreditCard, validatePostalCode
 *    - validateDate, validateTime, validateRange
 *    - validateRequired, validateLength, validatePattern
 *    - validateUnique, validateAll
 *
 * 6. Функции для принятия решений вынесены в modules/decision.js:
 *    - evaluateDecision, getDecisionTree, makeDecision
 *    - evaluateCriteria, rankOptions, getRecommendation
 *    - calculateRiskScore, getConfidenceLevel, analyzeOptions
 *
 * 7. Комбинированные функции остаются в index.js:
 *    - calculateFinalPrice - комплексный расчет цены
 *    - evaluateCustomerProfile - оценка профиля клиента
 *    - analyzeDate - анализ даты
 *    - calculateAcademicStatus - академический статус
 *    - makeComplexDecision - сложное принятие решений
 *    - validateComplexData - комплексная валидация
 *
 * 8. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 9. Добавлены JSDoc комментарии для всех функций
 *
 * 10. Сохранена обратная совместимость через реэкспорты
 */
