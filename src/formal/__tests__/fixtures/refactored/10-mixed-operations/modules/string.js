// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/10-mixed-operations/modules/string.js

// ============================================
// МОДУЛЬ РАБОТЫ СО СТРОКАМИ
// ============================================
// Этот модуль содержит функции для работы со строками:
// форматирование, преобразование, валидация и манипуляции.

/**
 * Преобразует строку в формат с заглавной буквы
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
 * Преобразует строку в формат с заглавной буквы (сохраняет регистр)
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
 * Преобразует строку в Title Case (каждое слово с заглавной)
 * @param {string} str - Входная строка
 * @returns {string} - Строка в Title Case
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
 * Преобразует строку в camelCase
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
 * Преобразует строку в PascalCase
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
 * Преобразует строку в snake_case
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
 * Преобразует строку в kebab-case
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
 * Обрезает строку до указанной длины и добавляет многоточие
 * @param {string} str - Входная строка
 * @param {number} maxLength - Максимальная длина
 * @param {string} suffix - Суффикс для обрезанной строки
 * @returns {string} - Обрезанная строка
 */
function truncate(str, maxLength = 100, suffix = '...') {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Разбивает строку на слова
 * @param {string} str - Входная строка
 * @param {RegExp|string} separator - Разделитель
 * @returns {Array<string>} - Массив слов
 */
function splitWords(str, separator = /\s+/) {
  if (!str || typeof str !== 'string') {
    return [];
  }
  return str.split(separator).filter(word => word.length > 0);
}

/**
 * Объединяет массив слов в строку
 * @param {Array<string>} words - Массив слов
 * @param {string} separator - Разделитель
 * @returns {string} - Объединенная строка
 */
function joinWords(words, separator = ' ') {
  if (!Array.isArray(words)) {
    return '';
  }
  return words.filter(word => word && typeof word === 'string').join(separator);
}

/**
 * Проверяет, является ли строка email-адресом
 * @param {string} str - Строка для проверки
 * @returns {boolean} - true если строка является email
 */
function isEmail(str) {
  if (!str || typeof str !== 'string') {
    return false;
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(str);
}

/**
 * Проверяет, является ли строка URL-адресом
 * @param {string} str - Строка для проверки
 * @returns {boolean} - true если строка является URL
 */
function isURL(str) {
  if (!str || typeof str !== 'string') {
    return false;
  }
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Проверяет, является ли строка телефонным номером
 * @param {string} str - Строка для проверки
 * @param {string} format - Формат номера ('US', 'RU', 'international')
 * @returns {boolean} - true если строка является телефонным номером
 */
function isPhone(str, format = 'international') {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const digits = str.replace(/\D/g, '');

  switch (format) {
    case 'US':
      return digits.length === 10 || digits.length === 11;
    case 'RU':
      return digits.length === 10 || digits.length === 11;
    case 'international':
      return digits.length >= 10 && digits.length <= 15;
    default:
      return digits.length >= 10 && digits.length <= 15;
  }
}

/**
 * Извлекает домен из URL
 * @param {string} url - URL-адрес
 * @returns {string} - Домен или пустая строка
 */
function extractDomain(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Извлекает путь из URL
 * @param {string} url - URL-адрес
 * @returns {string} - Путь или пустая строка
 */
function extractPath(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return '';
  }
}

/**
 * Извлекает параметры запроса из URL
 * @param {string} url - URL-адрес
 * @returns {Object} - Объект с параметрами
 */
function extractQueryParams(url) {
  if (!url || typeof url !== 'string') {
    return {};
  }
  try {
    const urlObj = new URL(url);
    const params = {};
    for (const [key, value] of urlObj.searchParams) {
      params[key] = value;
    }
    return params;
  } catch {
    return {};
  }
}

/**
 * Создает строку запроса из объекта параметров
 * @param {Object} params - Объект с параметрами
 * @param {string} prefix - Префикс для URL
 * @returns {string} - URL с параметрами
 */
function buildQueryString(params, prefix = '') {
  if (!params || typeof params !== 'object') {
    return prefix || '';
  }

  const queryParts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          queryParts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(item))}`);
        }
      } else {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
  }

  const queryString = queryParts.join('&');
  if (!queryString) {
    return prefix || '';
  }

  return prefix ? `${prefix}?${queryString}` : `?${queryString}`;
}

/**
 * Заменяет все вхождения подстроки в строке
 * @param {string} str - Входная строка
 * @param {string|RegExp} search - Искомое значение
 * @param {string} replacement - Значение замены
 * @returns {string} - Строка с заменой
 */
function replaceAll(str, search, replacement) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (search instanceof RegExp) {
    return str.replace(search, replacement);
  }
  return str.split(search).join(replacement);
}

/**
 * Удаляет все пробелы в начале и конце строки
 * @param {string} str - Входная строка
 * @returns {string} - Обрезанная строка
 */
function trimAll(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.trim();
}

/**
 * Удаляет все лишние пробелы (включая множественные)
 * @param {string} str - Входная строка
 * @returns {string} - Строка без лишних пробелов
 */
function collapseWhitespace(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Проверяет, является ли строка палиндромом
 * @param {string} str - Входная строка
 * @param {boolean} ignoreCase - Игнорировать регистр
 * @param {boolean} ignoreSpaces - Игнорировать пробелы
 * @returns {boolean} - true если строка является палиндромом
 */
function isPalindrome(str, ignoreCase = true, ignoreSpaces = true) {
  if (!str || typeof str !== 'string') {
    return false;
  }

  let processed = str;
  if (ignoreCase) {
    processed = processed.toLowerCase();
  }
  if (ignoreSpaces) {
    processed = processed.replace(/\s/g, '');
  }

  return processed === processed.split('').reverse().join('');
}

/**
 * Находит все вхождения подстроки с позициями
 * @param {string} str - Входная строка
 * @param {string} substr - Искомая подстрока
 * @param {boolean} overlap - Учитывать перекрытия
 * @returns {Array<{index: number, match: string}>} - Массив вхождений
 */
function findAllOccurrences(str, substr, overlap = false) {
  if (!str || typeof str !== 'string' || !substr) {
    return [];
  }

  const occurrences = [];
  let searchIndex = 0;

  while (true) {
    const index = str.indexOf(substr, searchIndex);
    if (index === -1) break;

    occurrences.push({ index, match: substr });
    searchIndex = overlap ? index + 1 : index + substr.length;
  }

  return occurrences;
}

/**
 * Подсчитывает количество слов в строке
 * @param {string} str - Входная строка
 * @param {RegExp|string} separator - Разделитель слов
 * @returns {number} - Количество слов
 */
function countWords(str, separator = /\s+/) {
  if (!str || typeof str !== 'string') {
    return 0;
  }
  const words = str.split(separator).filter(word => word.length > 0);
  return words.length;
}

/**
 * Подсчитывает количество символов (без учета пробелов)
 * @param {string} str - Входная строка
 * @param {boolean} countSpaces - Учитывать пробелы
 * @returns {number} - Количество символов
 */
function countCharacters(str, countSpaces = true) {
  if (!str || typeof str !== 'string') {
    return 0;
  }
  if (countSpaces) {
    return str.length;
  }
  return str.replace(/\s/g, '').length;
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Преобразование регистра
  capitalize,
  capitalizePreserve,
  titleCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,

  // Разбиение и объединение
  splitWords,
  joinWords,
  truncate,

  // Валидация
  isEmail,
  isURL,
  isPhone,
  isPalindrome,

  // Работа с URL
  extractDomain,
  extractPath,
  extractQueryParams,
  buildQueryString,

  // Манипуляции со строками
  replaceAll,
  trimAll,
  collapseWhitespace,

  // Подсчет и поиск
  findAllOccurrences,
  countWords,
  countCharacters,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями работы со строками
 */
export default {
  capitalize,
  capitalizePreserve,
  titleCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  splitWords,
  joinWords,
  truncate,
  isEmail,
  isURL,
  isPhone,
  isPalindrome,
  extractDomain,
  extractPath,
  extractQueryParams,
  buildQueryString,
  replaceAll,
  trimAll,
  collapseWhitespace,
  findAllOccurrences,
  countWords,
  countCharacters,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ РАБОТЫ СО СТРОКАМИ
 *
 * Этот модуль предоставляет 23 функции для работы со строками:
 *
 * 1. capitalize          - Преобразование в заглавную букву
 * 2. capitalizePreserve  - Преобразование в заглавную (сохраняет регистр)
 * 3. titleCase          - Каждое слово с заглавной
 * 4. toCamelCase        - Преобразование в camelCase
 * 5. toPascalCase       - Преобразование в PascalCase
 * 6. toSnakeCase        - Преобразование в snake_case
 * 7. toKebabCase        - Преобразование в kebab-case
 * 8. splitWords         - Разбиение на слова
 * 9. joinWords          - Объединение слов
 * 10. truncate          - Обрезка строки
 * 11. isEmail           - Проверка email
 * 12. isURL             - Проверка URL
 * 13. isPhone           - Проверка телефона
 * 14. isPalindrome      - Проверка палиндрома
 * 15. extractDomain     - Извлечение домена
 * 16. extractPath       - Извлечение пути
 * 17. extractQueryParams - Извлечение параметров запроса
 * 18. buildQueryString  - Создание строки запроса
 * 19. replaceAll        - Замена всех вхождений
 * 20. trimAll           - Удаление пробелов
 * 21. collapseWhitespace - Удаление лишних пробелов
 * 22. findAllOccurrences - Поиск всех вхождений
 * 23. countWords        - Подсчет слов
 * 24. countCharacters   - Подсчет символов
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные форматы и сценарии
 * - Обрабатывают граничные случаи
 * - Имеют JSDoc с описанием параметров и возвращаемых значений
 */
