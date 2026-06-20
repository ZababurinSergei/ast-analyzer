// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/08-conditional-logic/modules/day.js

// ============================================
// МОДУЛЬ РАБОТЫ С ДНЯМИ НЕДЕЛИ
// ============================================
// Этот модуль содержит функции для работы с днями недели,
// включая преобразования, валидацию и форматирование.

/**
 * Массив названий дней недели на английском
 */
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Массив названий дней недели на русском
 */
const DAYS_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

/**
 * Массив названий дней недели на немецком
 */
const DAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/**
 * Массив названий дней недели на французском
 */
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/**
 * Массив названий дней недели на испанском
 */
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Массив кратких названий дней недели на английском
 */
const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Массив кратких названий дней недели на русском
 */
const DAYS_SHORT_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/**
 * Массив кратких названий дней недели на немецком
 */
const DAYS_SHORT_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Массив кратких названий дней недели на французском
 */
const DAYS_SHORT_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * Массив кратких названий дней недели на испанском
 */
const DAYS_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Объект с локалями для дней недели
 */
const LOCALES = {
  en: { full: DAYS_EN, short: DAYS_SHORT_EN },
  ru: { full: DAYS_RU, short: DAYS_SHORT_RU },
  de: { full: DAYS_DE, short: DAYS_SHORT_DE },
  fr: { full: DAYS_FR, short: DAYS_SHORT_FR },
  es: { full: DAYS_ES, short: DAYS_SHORT_ES },
};

/**
 * Получает название дня недели по числовому индексу
 * @param {number} dayIndex - Индекс дня (0-6, где 0 - воскресенье)
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @param {boolean} short - Использовать краткое название
 * @returns {string} - Название дня недели
 * @throws {Error} - Если индекс дня невалидный
 */
function getDayName(dayIndex, locale = 'en', short = false) {
  if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex)) {
    throw new TypeError('dayIndex must be an integer');
  }
  if (dayIndex < 0 || dayIndex > 6) {
    throw new RangeError('dayIndex must be between 0 and 6');
  }

  const localeData = LOCALES[locale];
  if (!localeData) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  return short ? localeData.short[dayIndex] : localeData.full[dayIndex];
}

/**
 * Получает индекс дня недели по названию
 * @param {string} dayName - Название дня недели
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @returns {number} - Индекс дня (0-6) или -1 если не найдено
 */
function getDayIndex(dayName, locale = 'en') {
  if (typeof dayName !== 'string') {
    throw new TypeError('dayName must be a string');
  }

  const localeData = LOCALES[locale];
  if (!localeData) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const normalizedName = dayName.trim().toLowerCase();

  // Проверяем полные названия
  const fullIndex = localeData.full.findIndex(name => name.toLowerCase() === normalizedName);
  if (fullIndex !== -1) {
    return fullIndex;
  }

  // Проверяем краткие названия
  const shortIndex = localeData.short.findIndex(name => name.toLowerCase() === normalizedName);
  if (shortIndex !== -1) {
    return shortIndex;
  }

  return -1;
}

/**
 * Проверяет, является ли день выходным
 * @param {number} dayIndex - Индекс дня (0-6)
 * @param {number[]} weekendDays - Массив индексов выходных дней
 * @returns {boolean} - true если день выходной
 */
function isWeekend(dayIndex, weekendDays = [0, 6]) {
  if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex)) {
    throw new TypeError('dayIndex must be an integer');
  }
  if (dayIndex < 0 || dayIndex > 6) {
    throw new RangeError('dayIndex must be between 0 and 6');
  }

  return weekendDays.includes(dayIndex);
}

/**
 * Проверяет, является ли день рабочим
 * @param {number} dayIndex - Индекс дня (0-6)
 * @param {number[]} weekendDays - Массив индексов выходных дней
 * @returns {boolean} - true если день рабочий
 */
function isWorkday(dayIndex, weekendDays = [0, 6]) {
  return !isWeekend(dayIndex, weekendDays);
}

/**
 * Проверяет, является ли день будним днем (понедельник-пятница)
 * @param {number} dayIndex - Индекс дня (0-6)
 * @returns {boolean} - true если день будний
 */
function isWeekday(dayIndex) {
  if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex)) {
    throw new TypeError('dayIndex must be an integer');
  }
  if (dayIndex < 0 || dayIndex > 6) {
    throw new RangeError('dayIndex must be between 0 and 6');
  }
  // Будние дни: понедельник (1) - пятница (5)
  return dayIndex >= 1 && dayIndex <= 5;
}

/**
 * Получает следующий день недели
 * @param {number} dayIndex - Текущий индекс дня
 * @param {number} steps - Количество шагов вперед
 * @returns {number} - Индекс следующего дня (0-6)
 */
function getNextDay(dayIndex, steps = 1) {
  if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex)) {
    throw new TypeError('dayIndex must be an integer');
  }
  if (dayIndex < 0 || dayIndex > 6) {
    throw new RangeError('dayIndex must be between 0 and 6');
  }
  if (typeof steps !== 'number' || !Number.isInteger(steps)) {
    throw new TypeError('steps must be an integer');
  }

  return (((dayIndex + steps) % 7) + 7) % 7;
}

/**
 * Получает предыдущий день недели
 * @param {number} dayIndex - Текущий индекс дня
 * @param {number} steps - Количество шагов назад
 * @returns {number} - Индекс предыдущего дня (0-6)
 */
function getPreviousDay(dayIndex, steps = 1) {
  return getNextDay(dayIndex, -steps);
}

/**
 * Получает разницу в днях между двумя днями недели
 * @param {number} fromDay - Индекс начального дня
 * @param {number} toDay - Индекс конечного дня
 * @returns {number} - Разница в днях (0-6)
 */
function getDayDifference(fromDay, toDay) {
  if (typeof fromDay !== 'number' || !Number.isInteger(fromDay)) {
    throw new TypeError('fromDay must be an integer');
  }
  if (typeof toDay !== 'number' || !Number.isInteger(toDay)) {
    throw new TypeError('toDay must be an integer');
  }
  if (fromDay < 0 || fromDay > 6 || toDay < 0 || toDay > 6) {
    throw new RangeError('Day index must be between 0 and 6');
  }

  return (((toDay - fromDay) % 7) + 7) % 7;
}

/**
 * Получает день недели по дате
 * @param {Date} date - Объект даты
 * @param {string} locale - Локаль для форматирования
 * @param {boolean} short - Использовать краткое название
 * @returns {string} - Название дня недели
 */
function getDayFromDate(date, locale = 'en', short = false) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('Invalid date object');
  }

  const dayIndex = date.getDay();
  return getDayName(dayIndex, locale, short);
}

/**
 * Получает индекс дня недели по дате
 * @param {Date} date - Объект даты
 * @returns {number} - Индекс дня (0-6)
 */
function getDayIndexFromDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('Invalid date object');
  }

  return date.getDay();
}

/**
 * Проверяет, совпадают ли два дня недели
 * @param {number} day1 - Индекс первого дня
 * @param {number} day2 - Индекс второго дня
 * @returns {boolean} - true если дни совпадают
 */
function areSameDay(day1, day2) {
  if (typeof day1 !== 'number' || !Number.isInteger(day1)) {
    throw new TypeError('day1 must be an integer');
  }
  if (typeof day2 !== 'number' || !Number.isInteger(day2)) {
    throw new TypeError('day2 must be an integer');
  }
  if (day1 < 0 || day1 > 6 || day2 < 0 || day2 > 6) {
    throw new RangeError('Day index must be between 0 and 6');
  }

  return day1 === day2;
}

/**
 * Проверяет, является ли день понедельником
 * @param {number} dayIndex - Индекс дня
 * @returns {boolean} - true если день понедельник
 */
function isMonday(dayIndex) {
  return dayIndex === 1;
}

/**
 * Проверяет, является ли день вторником
 * @param {number} dayIndex - Индекс дня
 * @returns {boolean} - true если день вторник
 */
function isTuesday(dayIndex) {
  return dayIndex === 2;
}

/**
 * Проверяет, является ли день средой
 * @param {number} dayIndex - Индекс дня
 * @returns {boolean} - true если день среда
 */
function isWednesday(dayIndex) {
  return dayIndex === 3;
}

/**
 * Проверяет, является ли день четвергом
 * @param {number} dayIndex - Индекс дня
 * @returns {boolean} - true если день четверг
 */
function isThursday(dayIndex) {
  return dayIndex === 4;
}

/**
 * Проверяет, является ли день пятницей
 * @param {number} dayIndex - Индекс дня
 * @returns {boolean} - true если день пятница
 */
function isFriday(dayIndex) {
  return dayIndex === 5;
}

/**
 * Проверяет, является ли день субботой
 * @param {number} dayIndex - Индекс дня
 * @returns {boolean} - true если день суббота
 */
function isSaturday(dayIndex) {
  return dayIndex === 6;
}

/**
 * Проверяет, является ли день воскресеньем
 * @param {number} dayIndex - Индекс дня
 * @returns {boolean} - true если день воскресенье
 */
function isSunday(dayIndex) {
  return dayIndex === 0;
}

/**
 * Получает все дни недели в указанной локали
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @param {boolean} short - Использовать краткие названия
 * @returns {string[]} - Массив названий дней недели
 */
function getAllDays(locale = 'en', short = false) {
  const localeData = LOCALES[locale];
  if (!localeData) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  return short ? [...localeData.short] : [...localeData.full];
}

/**
 * Получает рабочие дни недели в указанной локали
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @param {boolean} short - Использовать краткие названия
 * @returns {string[]} - Массив названий рабочих дней
 */
function getWorkdays(locale = 'en', short = false) {
  const allDays = getAllDays(locale, short);
  return allDays.filter((_, index) => index >= 1 && index <= 5);
}

/**
 * Получает выходные дни недели в указанной локали
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @param {boolean} short - Использовать краткие названия
 * @returns {string[]} - Массив названий выходных дней
 */
function getWeekendDays(locale = 'en', short = false) {
  const allDays = getAllDays(locale, short);
  return allDays.filter((_, index) => index === 0 || index === 6);
}

/**
 * Получает первый день недели (воскресенье или понедельник)
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @returns {number} - Индекс первого дня недели
 */
function getFirstDayOfWeek(locale = 'en') {
  // В большинстве стран понедельник - первый день недели
  // В США воскресенье - первый день недели
  const firstDayMap = {
    en: 0, // Воскресенье
    ru: 1, // Понедельник
    de: 1, // Понедельник
    fr: 1, // Понедельник
    es: 1, // Понедельник
  };
  return firstDayMap[locale] || 0;
}

/**
 * Получает последний день недели
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @returns {number} - Индекс последнего дня недели
 */
function getLastDayOfWeek(locale = 'en') {
  const firstDay = getFirstDayOfWeek(locale);
  return (firstDay + 6) % 7;
}

/**
 * Сортирует массив дней по порядку недели
 * @param {number[]} dayIndices - Массив индексов дней
 * @param {string} locale - Локаль для определения первого дня
 * @returns {number[]} - Отсортированный массив индексов
 */
function sortDaysByWeek(dayIndices, locale = 'en') {
  if (!Array.isArray(dayIndices)) {
    throw new TypeError('dayIndices must be an array');
  }
  const firstDay = getFirstDayOfWeek(locale);
  return [...dayIndices].sort((a, b) => {
    const aAdjusted = (a - firstDay + 7) % 7;
    const bAdjusted = (b - firstDay + 7) % 7;
    return aAdjusted - bAdjusted;
  });
}

/**
 * Получает день недели с учетом смещения
 * @param {number} dayIndex - Исходный индекс дня
 * @param {number} offset - Смещение
 * @param {boolean} wrap - Зацикливать ли результат
 * @returns {number} - Индекс дня с учетом смещения
 */
function getDayWithOffset(dayIndex, offset, wrap = true) {
  if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex)) {
    throw new TypeError('dayIndex must be an integer');
  }
  if (dayIndex < 0 || dayIndex > 6) {
    throw new RangeError('dayIndex must be between 0 and 6');
  }
  if (typeof offset !== 'number' || !Number.isInteger(offset)) {
    throw new TypeError('offset must be an integer');
  }

  let result = dayIndex + offset;
  if (wrap) {
    result = ((result % 7) + 7) % 7;
  }
  return result;
}

/**
 * Проверяет, является ли строка названием дня недели
 * @param {string} str - Строка для проверки
 * @param {string} locale - Локаль ('en', 'ru', 'de', 'fr', 'es')
 * @param {boolean} checkShort - Проверять ли краткие названия
 * @returns {boolean} - true если строка является названием дня недели
 */
function isDayName(str, locale = 'en', checkShort = true) {
  if (typeof str !== 'string') {
    return false;
  }

  const localeData = LOCALES[locale];
  if (!localeData) {
    return false;
  }

  const normalizedStr = str.trim().toLowerCase();
  const allNames = [...localeData.full];
  if (checkShort) {
    allNames.push(...localeData.short);
  }

  return allNames.some(name => name.toLowerCase() === normalizedStr);
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Константы
  DAYS_EN,
  DAYS_RU,
  DAYS_DE,
  DAYS_FR,
  DAYS_ES,
  DAYS_SHORT_EN,
  DAYS_SHORT_RU,
  DAYS_SHORT_DE,
  DAYS_SHORT_FR,
  DAYS_SHORT_ES,
  LOCALES,

  // Основные функции
  getDayName,
  getDayIndex,
  getDayFromDate,
  getDayIndexFromDate,

  // Проверки
  isWeekend,
  isWorkday,
  isWeekday,
  areSameDay,

  // Проверки конкретных дней
  isMonday,
  isTuesday,
  isWednesday,
  isThursday,
  isFriday,
  isSaturday,
  isSunday,

  // Навигация
  getNextDay,
  getPreviousDay,
  getDayDifference,
  getDayWithOffset,

  // Получение списков
  getAllDays,
  getWorkdays,
  getWeekendDays,

  // Настройки недели
  getFirstDayOfWeek,
  getLastDayOfWeek,
  sortDaysByWeek,

  // Валидация
  isDayName,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями для работы с днями недели
 */
export default {
  // Константы
  DAYS_EN,
  DAYS_RU,
  DAYS_DE,
  DAYS_FR,
  DAYS_ES,
  DAYS_SHORT_EN,
  DAYS_SHORT_RU,
  DAYS_SHORT_DE,
  DAYS_SHORT_FR,
  DAYS_SHORT_ES,
  LOCALES,

  // Основные функции
  getDayName,
  getDayIndex,
  getDayFromDate,
  getDayIndexFromDate,

  // Проверки
  isWeekend,
  isWorkday,
  isWeekday,
  areSameDay,

  // Проверки конкретных дней
  isMonday,
  isTuesday,
  isWednesday,
  isThursday,
  isFriday,
  isSaturday,
  isSunday,

  // Навигация
  getNextDay,
  getPreviousDay,
  getDayDifference,
  getDayWithOffset,

  // Получение списков
  getAllDays,
  getWorkdays,
  getWeekendDays,

  // Настройки недели
  getFirstDayOfWeek,
  getLastDayOfWeek,
  sortDaysByWeek,

  // Валидация
  isDayName,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ РАБОТЫ С ДНЯМИ НЕДЕЛИ
 *
 * Этот модуль предоставляет 28 функций для работы с днями недели:
 *
 * 1. getDayName           - Получение названия дня по индексу
 * 2. getDayIndex          - Получение индекса по названию
 * 3. getDayFromDate       - Получение дня из даты
 * 4. getDayIndexFromDate  - Получение индекса из даты
 *
 * 5. isWeekend            - Проверка на выходной день
 * 6. isWorkday            - Проверка на рабочий день
 * 7. isWeekday            - Проверка на будний день
 * 8. areSameDay           - Проверка совпадения дней
 *
 * 9-15. isMonday..isSunday - Проверка конкретных дней
 *
 * 16. getNextDay          - Получение следующего дня
 * 17. getPreviousDay      - Получение предыдущего дня
 * 18. getDayDifference    - Разница между днями
 * 19. getDayWithOffset    - День со смещением
 *
 * 20. getAllDays          - Все дни недели
 * 21. getWorkdays         - Рабочие дни
 * 22. getWeekendDays      - Выходные дни
 *
 * 23. getFirstDayOfWeek   - Первый день недели
 * 24. getLastDayOfWeek    - Последний день недели
 * 25. sortDaysByWeek      - Сортировка дней
 *
 * 26. isDayName           - Проверка на название дня
 *
 * 27-28. DAYS_* и DAYS_SHORT_* - Константы с названиями
 *
 * Поддерживаемые локали:
 * - en (English)
 * - ru (Russian)
 * - de (German)
 * - fr (French)
 * - es (Spanish)
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают множество локалей
 * - Обрабатывают граничные случаи
 * - Имеют JSDoc с описанием параметров
 * - Работают с индексами 0-6 (0 = воскресенье)
 */
