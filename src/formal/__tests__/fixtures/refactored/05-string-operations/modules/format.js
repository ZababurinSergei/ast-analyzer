// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/05-string-operations/modules/format.js

// ============================================
// МОДУЛЬ ФОРМАТИРОВАНИЯ СТРОК
// ============================================
// Этот модуль содержит функции для форматирования
// и преобразования строк в различные форматы.

/**
 * Форматирует строку с заглавной буквы
 * @param {string} str - Входная строка
 * @returns {string} - Строка с заглавной первой буквой
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Форматирует строку с заглавной буквы (сохраняет регистр остальной части)
 * @param {string} str - Входная строка
 * @returns {string} - Строка с заглавной первой буквой
 */
function capitalizePreserve(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Форматирует каждое слово с заглавной буквы (Title Case)
 * @param {string} str - Входная строка
 * @returns {string} - Строка в формате Title Case
 */
function titleCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str
    .toLowerCase()
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Форматирует строку в camelCase
 * @param {string} str - Входная строка
 * @returns {string} - Строка в camelCase
 */
function toCamelCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return capitalize(word);
    })
    .join('');
}

/**
 * Форматирует строку в PascalCase
 * @param {string} str - Входная строка
 * @returns {string} - Строка в PascalCase
 */
function toPascalCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map(word => capitalize(word))
    .join('');
}

/**
 * Форматирует строку в snake_case
 * @param {string} str - Входная строка
 * @returns {string} - Строка в snake_case
 */
function toSnakeCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}

/**
 * Форматирует строку в kebab-case
 * @param {string} str - Входная строка
 * @returns {string} - Строка в kebab-case
 */
function toKebabCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

/**
 * Форматирует строку в SCREAMING_SNAKE_CASE (CONSTANT_CASE)
 * @param {string} str - Входная строка
 * @returns {string} - Строка в SCREAMING_SNAKE_CASE
 */
function toConstantCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return toSnakeCase(str).toUpperCase();
}

/**
 * Форматирует строку в train-case
 * @param {string} str - Входная строка
 * @returns {string} - Строка в train-case
 */
function toTrainCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return toKebabCase(str)
    .split('-')
    .map(word => capitalize(word))
    .join('-');
}

/**
 * Форматирует строку с указанной длиной (обрезает или дополняет)
 * @param {string} str - Входная строка
 * @param {number} length - Целевая длина
 * @param {string} padChar - Символ для дополнения
 * @param {string} position - Позиция дополнения ('left', 'right', 'both')
 * @returns {string} - Отформатированная строка
 */
function formatLength(str, length, padChar = ' ', position = 'right') {
  if (!str || typeof str !== 'string') {
    str = '';
  }
  if (str.length >= length) {
    return str.slice(0, length);
  }

  const padCount = length - str.length;
  const padString = padChar.repeat(padCount);

  switch (position) {
    case 'left':
      return padString + str;
    case 'both':
      const leftPad = Math.floor(padCount / 2);
      const rightPad = padCount - leftPad;
      return padChar.repeat(leftPad) + str + padChar.repeat(rightPad);
    case 'right':
    default:
      return str + padString;
  }
}

/**
 * Форматирует число с разделителями тысяч
 * @param {number} num - Число для форматирования
 * @param {string} separator - Разделитель тысяч
 * @param {string} decimalSeparator - Разделитель десятичной части
 * @param {number} decimals - Количество знаков после запятой
 * @returns {string} - Отформатированное число
 */
function formatNumber(num, separator = ',', decimalSeparator = '.', decimals = 0) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '';
  }

  const parts = num.toFixed(decimals).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';

  // Добавляем разделители тысяч
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  if (decimalPart) {
    return formattedInteger + decimalSeparator + decimalPart;
  }
  return formattedInteger;
}

/**
 * Форматирует валюту
 * @param {number} amount - Сумма
 * @param {string} currency - Код валюты (USD, EUR, RUB)
 * @param {string} locale - Локаль для форматирования
 * @returns {string} - Отформатированная валюта
 */
function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '';
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(amount);
  } catch (error) {
    // Fallback форматирование
    const symbol =
      currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'RUB' ? '₽' : currency;
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Форматирует дату
 * @param {Date|string} date - Дата для форматирования
 * @param {string} format - Формат даты (ISO, locale, custom)
 * @param {string} locale - Локаль для форматирования
 * @returns {string} - Отформатированная дата
 */
function formatDate(date, format = 'locale', locale = 'en-US') {
  if (!date) {
    return '';
  }

  let dateObj = date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  }

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  try {
    switch (format) {
      case 'ISO':
        return dateObj.toISOString();
      case 'locale':
        return dateObj.toLocaleDateString(locale);
      case 'localeWithTime':
        return dateObj.toLocaleString(locale);
      case 'time':
        return dateObj.toLocaleTimeString(locale);
      case 'short':
        return dateObj.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      case 'long':
        return dateObj.toLocaleDateString(locale, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      default:
        // Пользовательский формат (простая реализация)
        const formatMap = {
          YYYY: dateObj.getFullYear(),
          YY: String(dateObj.getFullYear()).slice(2),
          MM: String(dateObj.getMonth() + 1).padStart(2, '0'),
          M: dateObj.getMonth() + 1,
          DD: String(dateObj.getDate()).padStart(2, '0'),
          D: dateObj.getDate(),
          HH: String(dateObj.getHours()).padStart(2, '0'),
          H: dateObj.getHours(),
          mm: String(dateObj.getMinutes()).padStart(2, '0'),
          m: dateObj.getMinutes(),
          ss: String(dateObj.getSeconds()).padStart(2, '0'),
          s: dateObj.getSeconds(),
        };

        let result = format;
        for (const [key, value] of Object.entries(formatMap)) {
          result = result.replace(key, value);
        }
        return result;
    }
  } catch (error) {
    return dateObj.toString();
  }
}

/**
 * Форматирует время в секундах в формат HH:MM:SS
 * @param {number} seconds - Количество секунд
 * @returns {string} - Отформатированное время
 */
function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(secs).padStart(2, '0'),
  ];

  return parts.join(':');
}

/**
 * Форматирует размер файла в удобочитаемый вид
 * @param {number} bytes - Размер в байтах
 * @param {number} decimals - Количество знаков после запятой
 * @returns {string} - Отформатированный размер
 */
function formatFileSize(bytes, decimals = 2) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Форматирует процент
 * @param {number} value - Значение (0-1 или 0-100)
 * @param {number} decimals - Количество знаков после запятой
 * @param {boolean} multiplyBy100 - Умножать ли на 100
 * @returns {string} - Отформатированный процент
 */
function formatPercent(value, decimals = 1, multiplyBy100 = true) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  let percent = value;
  if (multiplyBy100) {
    percent = value * 100;
  }

  return `${percent.toFixed(decimals)}%`;
}

/**
 * Форматирует телефонный номер
 * @param {string} phone - Номер телефона
 * @param {string} format - Формат номера ('US', 'RU', 'international')
 * @returns {string} - Отформатированный номер
 */
function formatPhone(phone, format = 'US') {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Удаляем все нецифровые символы
  const digits = phone.replace(/\D/g, '');

  switch (format) {
    case 'US':
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      if (digits.length === 11) {
        return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
      }
      break;
    case 'RU':
      if (digits.length === 11) {
        return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
      }
      if (digits.length === 10) {
        return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
      }
      break;
    case 'international':
      if (digits.length >= 10) {
        const countryCode = digits.length === 11 ? digits[0] : '7';
        const rest = digits.slice(digits.length === 11 ? 1 : 0);
        return `+${countryCode} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8)}`;
      }
      break;
    default:
      return digits;
  }

  return digits;
}

/**
 * Форматирует JSON с отступами
 * @param {Object|Array} data - Данные для форматирования
 * @param {number} indent - Количество пробелов для отступа
 * @param {boolean} sortKeys - Сортировать ли ключи
 * @returns {string} - Отформатированный JSON
 */
function formatJSON(data, indent = 2, sortKeys = false) {
  try {
    if (sortKeys) {
      return JSON.stringify(
        data,
        (key, value) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const sorted = {};
            for (const k of Object.keys(value).sort()) {
              sorted[k] = value[k];
            }
            return sorted;
          }
          return value;
        },
        indent
      );
    }
    return JSON.stringify(data, null, indent);
  } catch (error) {
    return String(data);
  }
}

/**
 * Форматирует HTML entities
 * @param {string} str - Входная строка
 * @param {boolean} escape - Экранировать (true) или раскодировать (false)
 * @returns {string} - Отформатированная строка
 */
function formatHTMLEntities(str, escape = true) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  const reverseEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };

  if (escape) {
    return str.replace(/[&<>"']/g, char => entities[char] || char);
  } else {
    return str.replace(/&(amp|lt|gt|quot|#39);/g, entity => reverseEntities[entity] || entity);
  }
}

/**
 * Форматирует строку для использования в URL
 * @param {string} str - Входная строка
 * @param {string} separator - Разделитель слов
 * @returns {string} - Строка для URL
 */
function formatURLSlug(str, separator = '-') {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, separator)
    .replace(new RegExp(separator + '+', 'g'), separator)
    .replace(new RegExp('^' + separator + '|' + separator + '$', 'g'), '');
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовое форматирование
  capitalize,
  capitalizePreserve,
  titleCase,

  // Преобразование регистра
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
  toTrainCase,

  // Форматирование длины и чисел
  formatLength,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,

  // Форматирование даты и времени
  formatDate,
  formatDuration,
  formatPhone,

  // Форматирование данных
  formatJSON,
  formatHTMLEntities,
  formatURLSlug,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями форматирования
 */
export default {
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

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ФОРМАТИРОВАНИЯ СТРОК
 *
 * Этот модуль предоставляет 19 функций для форматирования строк:
 *
 * 1. capitalize           - Первая буква заглавная
 * 2. capitalizePreserve   - Первая буква заглавная (сохраняет регистр)
 * 3. titleCase           - Каждое слово с заглавной
 * 4. toCamelCase         - Преобразование в camelCase
 * 5. toPascalCase        - Преобразование в PascalCase
 * 6. toSnakeCase         - Преобразование в snake_case
 * 7. toKebabCase         - Преобразование в kebab-case
 * 8. toConstantCase      - Преобразование в SCREAMING_SNAKE_CASE
 * 9. toTrainCase         - Преобразование в Train-Case
 * 10. formatLength       - Обрезка/дополнение до нужной длины
 * 11. formatNumber       - Форматирование числа с разделителями
 * 12. formatCurrency     - Форматирование валюты
 * 13. formatPercent      - Форматирование процентов
 * 14. formatFileSize     - Форматирование размера файла
 * 15. formatDate         - Форматирование даты
 * 16. formatDuration     - Форматирование длительности
 * 17. formatPhone        - Форматирование телефонного номера
 * 18. formatJSON         - Форматирование JSON
 * 19. formatHTMLEntities - Экранирование/раскодирование HTML
 * 20. formatURLSlug      - Создание URL-совместимой строки
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают множество форматов и локалей
 * - Обрабатывают граничные случаи (null, undefined, пустые строки)
 * - Имеют JSDoc с описанием параметров и возвращаемых значений
 */
