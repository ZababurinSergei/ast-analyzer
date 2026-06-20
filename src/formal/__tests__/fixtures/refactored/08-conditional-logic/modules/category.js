// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/08-conditional-logic/modules/category.js

// ============================================
// МОДУЛЬ КАТЕГОРИЗАЦИИ
// ============================================
// Этот модуль содержит функции для категоризации
// данных по различным критериям и условиям.

/**
 * Определяет возрастную категорию человека
 * @param {number} age - Возраст в годах
 * @returns {string} - Категория возраста
 * @throws {Error} - Если возраст отрицательный
 */
function getCategory(age) {
  if (typeof age !== 'number' || isNaN(age)) {
    throw new TypeError('Age must be a number');
  }
  if (age < 0) {
    throw new Error('Age cannot be negative');
  }

  if (age < 13) return 'child';
  if (age < 18) return 'teenager';
  if (age < 30) return 'young-adult';
  if (age < 50) return 'adult';
  if (age < 65) return 'middle-aged';
  if (age < 80) return 'senior';
  return 'elderly';
}

/**
 * Определяет категорию по возрасту с дополнительной информацией
 * @param {number} age - Возраст в годах
 * @returns {Object} - Объект с категорией и описанием
 */
function getCategoryWithInfo(age) {
  const category = getCategory(age);
  const infoMap = {
    child: { label: 'Ребенок', emoji: '🧒', range: '0-12' },
    teenager: { label: 'Подросток', emoji: '🧑', range: '13-17' },
    'young-adult': { label: 'Молодой взрослый', emoji: '👨', range: '18-29' },
    adult: { label: 'Взрослый', emoji: '👨', range: '30-49' },
    'middle-aged': { label: 'Средний возраст', emoji: '👨', range: '50-64' },
    senior: { label: 'Пожилой', emoji: '👴', range: '65-79' },
    elderly: { label: 'Престарелый', emoji: '👴', range: '80+' },
  };

  return {
    category,
    ...infoMap[category],
    age,
    isAdult: age >= 18,
    isSenior: age >= 65,
    isChild: age < 13,
  };
}

/**
 * Определяет категорию по индексу массы тела (BMI)
 * @param {number} bmi - Индекс массы тела
 * @returns {string} - Категория BMI
 */
function getBMICategory(bmi) {
  if (typeof bmi !== 'number' || isNaN(bmi) || bmi <= 0) {
    throw new TypeError('BMI must be a positive number');
  }

  if (bmi < 16) return 'severe-underweight';
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal-weight';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obesity-class-i';
  if (bmi < 40) return 'obesity-class-ii';
  return 'obesity-class-iii';
}

/**
 * Определяет категорию по температуре тела
 * @param {number} tempC - Температура в градусах Цельсия
 * @returns {string} - Категория температуры
 */
function getTemperatureCategory(tempC) {
  if (typeof tempC !== 'number' || isNaN(tempC)) {
    throw new TypeError('Temperature must be a number');
  }

  if (tempC < 35) return 'hypothermia';
  if (tempC < 36) return 'low';
  if (tempC < 37.5) return 'normal';
  if (tempC < 38.5) return 'fever';
  if (tempC < 39.5) return 'high-fever';
  if (tempC < 41) return 'hyperpyrexia';
  return 'critical';
}

/**
 * Определяет категорию по уровню кровяного давления
 * @param {number} systolic - Систолическое давление
 * @param {number} diastolic - Диастолическое давление
 * @returns {Object} - Категория давления с описанием
 */
function getBloodPressureCategory(systolic, diastolic) {
  if (
    typeof systolic !== 'number' ||
    typeof diastolic !== 'number' ||
    isNaN(systolic) ||
    isNaN(diastolic)
  ) {
    throw new TypeError('Blood pressure values must be numbers');
  }
  if (systolic <= 0 || diastolic <= 0) {
    throw new Error('Blood pressure values must be positive');
  }

  const categoryMap = [
    { condition: systolic < 90 || diastolic < 60, category: 'low', label: 'Низкое', risk: 'low' },
    {
      condition: systolic < 120 && diastolic < 80,
      category: 'normal',
      label: 'Нормальное',
      risk: 'low',
    },
    {
      condition: systolic < 130 && diastolic < 80,
      category: 'elevated',
      label: 'Повышенное',
      risk: 'medium',
    },
    {
      condition: systolic < 140 && diastolic < 90,
      category: 'hypertension-stage-1',
      label: 'Гипертония 1 стадии',
      risk: 'high',
    },
    {
      condition: systolic < 180 && diastolic < 120,
      category: 'hypertension-stage-2',
      label: 'Гипертония 2 стадии',
      risk: 'very-high',
    },
    {
      condition: systolic >= 180 || diastolic >= 120,
      category: 'hypertension-crisis',
      label: 'Гипертонический криз',
      risk: 'critical',
    },
  ];

  const result = categoryMap.find(item => item.condition);
  return {
    ...result,
    systolic,
    diastolic,
    isNormal: systolic < 120 && diastolic < 80,
    isHigh: systolic >= 130 || diastolic >= 80,
  };
}

/**
 * Определяет категорию по уровню холестерина
 * @param {number} total - Общий холестерин (мг/дл)
 * @param {number} hdl - HDL холестерин (мг/дл)
 * @param {number} ldl - LDL холестерин (мг/дл)
 * @returns {Object} - Категория холестерина
 */
function getCholesterolCategory(total, hdl, ldl) {
  if (
    typeof total !== 'number' ||
    typeof hdl !== 'number' ||
    typeof ldl !== 'number' ||
    isNaN(total) ||
    isNaN(hdl) ||
    isNaN(ldl)
  ) {
    throw new TypeError('Cholesterol values must be numbers');
  }

  const totalCategory = total < 200 ? 'desirable' : total < 240 ? 'borderline-high' : 'high';

  const hdlCategory = hdl >= 60 ? 'good' : hdl >= 40 ? 'fair' : 'poor';

  const ldlCategory =
    ldl < 100
      ? 'optimal'
      : ldl < 130
        ? 'near-optimal'
        : ldl < 160
          ? 'borderline-high'
          : ldl < 190
            ? 'high'
            : 'very-high';

  const ratio = total / hdl;
  const ratioCategory =
    ratio < 3.5 ? 'excellent' : ratio < 5 ? 'good' : ratio < 6 ? 'fair' : 'poor';

  return {
    total: { value: total, category: totalCategory },
    hdl: { value: hdl, category: hdlCategory },
    ldl: { value: ldl, category: ldlCategory },
    ratio: { value: ratio, category: ratioCategory },
    isHealthy: totalCategory === 'desirable' && hdlCategory === 'good' && ldlCategory === 'optimal',
  };
}

/**
 * Определяет категорию по уровню сахара в крови
 * @param {number} glucose - Уровень глюкозы (мг/дл)
 * @param {boolean} isFasting - Натощак или нет
 * @returns {Object} - Категория уровня сахара
 */
function getGlucoseCategory(glucose, isFasting = true) {
  if (typeof glucose !== 'number' || isNaN(glucose)) {
    throw new TypeError('Glucose value must be a number');
  }
  if (glucose < 0) {
    throw new Error('Glucose value cannot be negative');
  }

  let category, label, risk;

  if (isFasting) {
    if (glucose < 70) {
      category = 'hypoglycemia';
      label = 'Гипогликемия';
      risk = 'high';
    } else if (glucose < 100) {
      category = 'normal-fasting';
      label = 'Норма (натощак)';
      risk = 'low';
    } else if (glucose < 126) {
      category = 'pre-diabetic';
      label = 'Преддиабет';
      risk = 'medium';
    } else if (glucose < 200) {
      category = 'diabetic';
      label = 'Диабет';
      risk = 'high';
    } else {
      category = 'severe-diabetic';
      label = 'Тяжелый диабет';
      risk = 'very-high';
    }
  } else {
    if (glucose < 70) {
      category = 'hypoglycemia';
      label = 'Гипогликемия';
      risk = 'high';
    } else if (glucose < 140) {
      category = 'normal-non-fasting';
      label = 'Норма (не натощак)';
      risk = 'low';
    } else if (glucose < 200) {
      category = 'pre-diabetic-non-fasting';
      label = 'Преддиабет (не натощак)';
      risk = 'medium';
    } else {
      category = 'diabetic-non-fasting';
      label = 'Диабет (не натощак)';
      risk = 'high';
    }
  }

  return {
    category,
    label,
    risk,
    glucose,
    isFasting,
    isNormal: category === 'normal-fasting' || category === 'normal-non-fasting',
    isDiabetic:
      category === 'diabetic' ||
      category === 'severe-diabetic' ||
      category === 'diabetic-non-fasting',
  };
}

/**
 * Определяет категорию по весу (для взрослых)
 * @param {number} weight - Вес в кг
 * @param {number} height - Рост в см
 * @param {string} gender - Пол ('male' или 'female')
 * @returns {Object} - Категория веса с BMI
 */
function getWeightCategory(weight, height, gender = 'male') {
  if (typeof weight !== 'number' || typeof height !== 'number' || isNaN(weight) || isNaN(height)) {
    throw new TypeError('Weight and height must be numbers');
  }
  if (weight <= 0 || height <= 0) {
    throw new Error('Weight and height must be positive');
  }
  if (!['male', 'female'].includes(gender)) {
    throw new Error('Gender must be "male" or "female"');
  }

  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);
  const bmiCategory = getBMICategory(bmi);

  // Идеальный вес по разным формулам
  const idealWeightDevine =
    gender === 'male'
      ? 50 + (2.3 * (height - 152.4)) / 2.54
      : 45.5 + (2.3 * (height - 152.4)) / 2.54;

  const idealWeightRobinson =
    gender === 'male' ? 52 + (1.9 * (height - 152.4)) / 2.54 : 49 + (1.7 * (height - 152.4)) / 2.54;

  return {
    bmi,
    bmiCategory,
    idealWeight: {
      devine: idealWeightDevine,
      robinson: idealWeightRobinson,
      average: (idealWeightDevine + idealWeightRobinson) / 2,
    },
    weightStatus: {
      underweight: weight < idealWeightRobinson * 0.9,
      normal: weight >= idealWeightRobinson * 0.9 && weight <= idealWeightRobinson * 1.1,
      overweight: weight > idealWeightRobinson * 1.1 && weight <= idealWeightRobinson * 1.2,
      obese: weight > idealWeightRobinson * 1.2,
    },
    gender,
  };
}

/**
 * Определяет категорию по физической активности
 * @param {number} hoursPerWeek - Часов активности в неделю
 * @param {string} intensity - Интенсивность ('low', 'moderate', 'high')
 * @returns {string} - Категория активности
 */
function getActivityCategory(hoursPerWeek, intensity = 'moderate') {
  if (typeof hoursPerWeek !== 'number' || isNaN(hoursPerWeek)) {
    throw new TypeError('Hours per week must be a number');
  }
  if (hoursPerWeek < 0) {
    throw new Error('Hours per week cannot be negative');
  }

  const intensityMap = {
    low: { multiplier: 1 },
    moderate: { multiplier: 1.5 },
    high: { multiplier: 2 },
  };

  const { multiplier } = intensityMap[intensity] || intensityMap['moderate'];
  const adjustedHours = hoursPerWeek * multiplier;

  if (adjustedHours < 1) return 'sedentary';
  if (adjustedHours < 3) return 'lightly-active';
  if (adjustedHours < 5) return 'moderately-active';
  if (adjustedHours < 8) return 'active';
  if (adjustedHours < 12) return 'highly-active';
  return 'extremely-active';
}

/**
 * Определяет категорию по здоровью сердечно-сосудистой системы
 * @param {Object} metrics - Метрики здоровья
 * @param {number} metrics.systolic - Систолическое давление
 * @param {number} metrics.diastolic - Диастолическое давление
 * @param {number} metrics.cholesterol - Общий холестерин
 * @param {number} metrics.glucose - Уровень сахара
 * @param {number} metrics.bmi - Индекс массы тела
 * @param {boolean} metrics.smokes - Курит ли
 * @param {boolean} metrics.hasDiabetes - Есть ли диабет
 * @returns {Object} - Категория риска
 */
function getCardiovascularRiskCategory(metrics) {
  const {
    systolic = 120,
    diastolic = 80,
    cholesterol = 180,
    glucose = 90,
    bmi = 22,
    smokes = false,
    hasDiabetes = false,
  } = metrics;

  let riskScore = 0;

  // Оценка факторов риска
  if (systolic >= 140 || diastolic >= 90) riskScore += 2;
  else if (systolic >= 130 || diastolic >= 85) riskScore += 1;

  if (cholesterol >= 240) riskScore += 2;
  else if (cholesterol >= 200) riskScore += 1;

  if (glucose >= 126) riskScore += 2;
  else if (glucose >= 100) riskScore += 1;

  if (bmi >= 30) riskScore += 2;
  else if (bmi >= 25) riskScore += 1;

  if (smokes) riskScore += 2;
  if (hasDiabetes) riskScore += 2;

  // Определение категории
  let category, label, risk;
  if (riskScore <= 2) {
    category = 'low';
    label = 'Низкий риск';
    risk = 'low';
  } else if (riskScore <= 4) {
    category = 'moderate';
    label = 'Средний риск';
    risk = 'moderate';
  } else if (riskScore <= 6) {
    category = 'high';
    label = 'Высокий риск';
    risk = 'high';
  } else {
    category = 'very-high';
    label = 'Очень высокий риск';
    risk = 'very-high';
  }

  return {
    category,
    label,
    risk,
    riskScore,
    metrics: {
      systolic,
      diastolic,
      cholesterol,
      glucose,
      bmi,
      smokes,
      hasDiabetes,
    },
    recommendations: getRiskRecommendations(category),
  };
}

/**
 * Получает рекомендации на основе категории риска
 * @param {string} category - Категория риска
 * @returns {Array<string>} - Массив рекомендаций
 */
function getRiskRecommendations(category) {
  const recommendations = {
    low: ['Продолжайте вести здоровый образ жизни', 'Регулярно проходите медицинские осмотры'],
    moderate: [
      'Увеличьте физическую активность',
      'Следите за питанием',
      'Контролируйте артериальное давление',
      'Проверяйте уровень холестерина',
    ],
    high: [
      'Немедленно обратитесь к врачу',
      'Начните принимать лекарства по назначению',
      'Резко ограничьте потребление соли',
      'Откажитесь от курения',
      'Увеличьте физическую активность',
    ],
    'very-high': [
      'Срочно обратитесь к врачу-кардиологу',
      'Строго соблюдайте назначенное лечение',
      'Полностью исключите алкоголь',
      'Ежедневно измеряйте давление',
      'Ведите дневник питания',
    ],
  };

  return recommendations[category] || recommendations['low'];
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  getCategory,
  getCategoryWithInfo,
  getBMICategory,
  getTemperatureCategory,
  getBloodPressureCategory,
  getCholesterolCategory,
  getGlucoseCategory,
  getWeightCategory,
  getActivityCategory,
  getCardiovascularRiskCategory,
  getRiskRecommendations,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  getCategory,
  getCategoryWithInfo,
  getBMICategory,
  getTemperatureCategory,
  getBloodPressureCategory,
  getCholesterolCategory,
  getGlucoseCategory,
  getWeightCategory,
  getActivityCategory,
  getCardiovascularRiskCategory,
  getRiskRecommendations,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ КАТЕГОРИЗАЦИИ
 *
 * Этот модуль предоставляет 11 функций для категоризации различных параметров:
 *
 * 1. getCategory                 - Категория по возрасту
 * 2. getCategoryWithInfo         - Категория по возрасту с дополнительной информацией
 * 3. getBMICategory              - Категория по индексу массы тела
 * 4. getTemperatureCategory      - Категория по температуре тела
 * 5. getBloodPressureCategory    - Категория по артериальному давлению
 * 6. getCholesterolCategory      - Категория по уровню холестерина
 * 7. getGlucoseCategory          - Категория по уровню сахара в крови
 * 8. getWeightCategory           - Категория по весу и росту
 * 9. getActivityCategory         - Категория по физической активности
 * 10. getCardiovascularRiskCategory - Категория риска сердечно-сосудистых заболеваний
 * 11. getRiskRecommendations     - Рекомендации на основе категории риска
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Возвращают объекты с подробной информацией
 * - Включают категории риска и рекомендации
 * - Поддерживают различные медицинские стандарты
 * - Имеют JSDoc с описанием параметров
 * - Обрабатывают граничные случаи
 */
