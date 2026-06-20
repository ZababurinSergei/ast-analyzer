// packages/ast-analyzer/src/formal/__tests__/fixtures/original/05-string-operations.js

// ============================================
// РАБОТА СО СТРОКАМИ - ИСХОДНЫЙ ФАЙЛ
// ============================================

/**
 * Преобразует строку в формат: первая буква заглавная, остальные строчные
 * @param {string} str - Входная строка
 * @returns {string} Строка с заглавной первой буквой
 */
function capitalize(str) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Разворачивает строку в обратном порядке
 * @param {string} str - Входная строка
 * @returns {string} Перевернутая строка
 */
function reverse(str) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  return str.split('').reverse().join('');
}

/**
 * Форматирует приветствие с именем и титулом
 * @param {string} name - Имя пользователя
 * @param {string} title - Титул (Mr, Mrs, Dr, и т.д.)
 * @returns {string} Отформатированное приветствие
 */
function formatGreeting(name, title) {
  if (!name) return 'Hello!';
  if (!title) return `Hello, ${capitalize(name)}!`;
  return `Hello, ${capitalize(title)} ${capitalize(name)}!`;
}

/**
 * Форматирует полное имя в формате "Фамилия, Имя"
 * @param {string} first - Имя
 * @param {string} last - Фамилия
 * @returns {string} Полное имя в формате "Фамилия, Имя"
 */
function formatFullName(first, last) {
  if (!first && !last) return '';
  if (!first) return capitalize(last);
  if (!last) return capitalize(first);
  return `${capitalize(last)}, ${capitalize(first)}`;
}

/**
 * Обрезает строку до указанной длины и добавляет многоточие
 * @param {string} str - Входная строка
 * @param {number} maxLength - Максимальная длина
 * @returns {string} Обрезанная строка с многоточием
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  if (maxLength <= 0) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Проверяет, является ли строка палиндромом
 * @param {string} str - Входная строка
 * @returns {boolean} true если строка палиндром
 */
function isPalindrome(str) {
  if (!str) return true;
  if (typeof str !== 'string') return false;
  const clean = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean === clean.split('').reverse().join('');
}

/**
 * Подсчитывает количество слов в строке
 * @param {string} str - Входная строка
 * @returns {number} Количество слов
 */
function countWords(str) {
  if (!str) return 0;
  if (typeof str !== 'string') return 0;
  const words = str.trim().split(/\s+/);
  return words.length;
}

/**
 * Извлекает инициалы из полного имени
 * @param {string} fullName - Полное имя
 * @returns {string} Инициалы (например, "J.D.")
 */
function getInitials(fullName) {
  if (!fullName) return '';
  if (typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.map(part => part.charAt(0).toUpperCase());
  return initials.join('.') + (initials.length > 0 ? '.' : '');
}

/**
 * Заменяет все вхождения подстроки в строке
 * @param {string} str - Исходная строка
 * @param {string} search - Что искать
 * @param {string} replacement - На что заменить
 * @returns {string} Строка с замененными значениями
 */
function replaceAll(str, search, replacement) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  if (!search) return str;
  if (replacement === undefined) return str;
  return str.split(search).join(replacement);
}

/**
 * Преобразует строку в camelCase
 * @param {string} str - Входная строка
 * @returns {string} Строка в camelCase
 */
function toCamelCase(str) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  const words = str.trim().split(/\s+/);
  const result = words.map((word, index) => {
    if (index === 0) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  return result.join('');
}

/**
 * Преобразует строку в snake_case
 * @param {string} str - Входная строка
 * @returns {string} Строка в snake_case
 */
function toSnakeCase(str) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Преобразует строку в kebab-case
 * @param {string} str - Входная строка
 * @returns {string} Строка в kebab-case
 */
function toKebabCase(str) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Экранирует специальные HTML символы
 * @param {string} str - Входная строка
 * @returns {string} Строка с экранированными HTML символами
 */
function escapeHtml(str) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

/**
 * Декодирует HTML сущности
 * @param {string} str - Входная строка с HTML сущностями
 * @returns {string} Декодированная строка
 */
function unescapeHtml(str) {
  if (!str) return '';
  if (typeof str !== 'string') return '';
  const map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
  };
  return str.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, function (m) {
    return map[m];
  });
}

/**
 * Проверяет, является ли строка валидным email
 * @param {string} str - Входная строка
 * @returns {boolean} true если это валидный email
 */
function isValidEmail(str) {
  if (!str) return false;
  if (typeof str !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

/**
 * Проверяет, является ли строка валидным URL
 * @param {string} str - Входная строка
 * @returns {boolean} true если это валидный URL
 */
function isValidUrl(str) {
  if (!str) return false;
  if (typeof str !== 'string') return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Извлекает домен из URL
 * @param {string} url - Полный URL
 * @returns {string} Доменное имя
 */
function extractDomain(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  capitalize,
  reverse,
  formatGreeting,
  formatFullName,
  truncate,
  isPalindrome,
  countWords,
  getInitials,
  replaceAll,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  escapeHtml,
  unescapeHtml,
  isValidEmail,
  isValidUrl,
  extractDomain,
};
