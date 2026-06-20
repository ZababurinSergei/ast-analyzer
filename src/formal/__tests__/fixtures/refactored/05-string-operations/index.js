// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/05-string-operations/index.js

// ============================================
// СТРОКОВЫЕ ОПЕРАЦИИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все строковые операции вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт базовых строковых операций
import {
  capitalize,
  reverse,
  truncate,
  padStart,
  padEnd,
  trimAll,
  removeWhitespace,
  countWords,
  countCharacters,
  countLines,
  isPalindrome,
  isAnagram,
  isUpperCase,
  isLowerCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
  toConstantCase,
  toTitleCase,
  toSentenceCase,
  toAlternatingCase,
  toInverseCase,
  toRandomCase,
} from './modules/transform.js';

// Импорт функций форматирования
import {
  formatGreeting,
  formatFullName,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatNumber,
  formatOrdinal,
  formatPhoneNumber,
  formatEmail,
  formatUrl,
  formatSlug,
  formatList,
  formatTable,
  formatJson,
  formatXml,
  formatYaml,
  formatMarkdown,
} from './modules/format.js';

// Импорт функций поиска и сравнения
import {
  findSubstring,
  findAllSubstrings,
  findFirstMatch,
  findAllMatches,
  countSubstring,
  countMatches,
  findUniqueChars,
  findDuplicateChars,
  findMostFrequentChar,
  findLeastFrequentChar,
  findLongestWord,
  findShortestWord,
  findLongestSubstring,
  findPalindromes,
  findAnagrams,
  findCommonChars,
  findDifferences,
  findSimilarity,
  findLevenshteinDistance,
  findHammingDistance,
  findJaccardSimilarity,
  findDiceCoefficient,
} from './modules/search.js';

// Импорт функций валидации
import {
  isValidEmail,
  isValidUrl,
  isValidPhone,
  isValidDate,
  isValidTime,
  isValidDateTime,
  isValidCreditCard,
  isValidIP,
  isValidMAC,
  isValidUUID,
  isValidHexColor,
  isValidHSLColor,
  isValidRGBColor,
  isValidCSSColor,
  isValidHTMLTag,
  isValidXMLTag,
  isValidJson,
  isValidXml,
  isValidYaml,
  isValidCsv,
  isValidBase64,
  isValidJWT,
} from './modules/validation.js';

// Импорт функций шифрования
import {
  encryptCaesar,
  decryptCaesar,
  encryptROT13,
  decryptROT13,
  encryptAtbash,
  decryptAtbash,
  encryptVigenere,
  decryptVigenere,
  encryptXOR,
  decryptXOR,
  encryptBase64,
  decryptBase64,
  encryptHex,
  decryptHex,
  encryptUrl,
  decryptUrl,
  encryptHtml,
  decryptHtml,
  encryptMd5,
  encryptSha1,
  encryptSha256,
  encryptSha512,
  generateHash,
  generateSalt,
  generateToken,
} from './modules/crypto.js';

// ============================================
// КОМБИНИРОВАННЫЕ СТРОКОВЫЕ ОПЕРАЦИИ
// ============================================

/**
 * Нормализует строку (удаляет пробелы, приводит к нижнему регистру)
 * @param {string} str - Исходная строка
 * @returns {string} - Нормализованная строка
 */
function normalizeString(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }
  return removeWhitespace(str).toLowerCase();
}

/**
 * Проверяет, является ли строка палиндромом (игнорируя регистр и пробелы)
 * @param {string} str - Строка для проверки
 * @returns {boolean} - true если строка является палиндромом
 */
function isPalindromeStrict(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }
  const normalized = normalizeString(str);
  return isPalindrome(normalized);
}

/**
 * Проверяет, являются ли две строки анаграммами
 * @param {string} str1 - Первая строка
 * @param {string} str2 - Вторая строка
 * @returns {boolean} - true если строки являются анаграммами
 */
function areAnagrams(str1, str2) {
  if (typeof str1 !== 'string' || typeof str2 !== 'string') {
    throw new TypeError('Expected strings');
  }
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  return isAnagram(normalized1, normalized2);
}

/**
 * Форматирует текст с переносами строк
 * @param {string} text - Исходный текст
 * @param {number} maxWidth - Максимальная ширина строки
 * @returns {string} - Текст с переносами
 */
function wrapText(text, maxWidth = 80) {
  if (typeof text !== 'string') {
    throw new TypeError('Expected a string');
  }
  if (maxWidth < 1) {
    throw new Error('maxWidth must be positive');
  }

  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

/**
 * Вычисляет статистику по тексту
 * @param {string} text - Исходный текст
 * @returns {Object} - Статистика текста
 */
function analyzeText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Expected a string');
  }

  return {
    length: text.length,
    characters: countCharacters(text),
    words: countWords(text),
    lines: countLines(text),
    uppercase: isUpperCase(text),
    lowercase: isLowerCase(text),
    isPalindrome: isPalindrome(text),
    mostFrequentChar: findMostFrequentChar(text),
    uniqueChars: findUniqueChars(text).length,
  };
}

/**
 * Преобразует строку в несколько форматов одновременно
 * @param {string} str - Исходная строка
 * @returns {Object} - Объект со всеми преобразованиями
 */
function getAllCases(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  return {
    original: str,
    upper: str.toUpperCase(),
    lower: str.toLowerCase(),
    camel: toCamelCase(str),
    kebab: toKebabCase(str),
    snake: toSnakeCase(str),
    pascal: toPascalCase(str),
    constant: toConstantCase(str),
    title: toTitleCase(str),
    sentence: toSentenceCase(str),
    alternating: toAlternatingCase(str),
    inverse: toInverseCase(str),
  };
}

/**
 * Проверяет строку на соответствие всем форматам
 * @param {string} str - Строка для проверки
 * @returns {Object} - Результаты всех проверок
 */
function validateAllFormats(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  return {
    email: isValidEmail(str),
    url: isValidUrl(str),
    phone: isValidPhone(str),
    date: isValidDate(str),
    time: isValidTime(str),
    datetime: isValidDateTime(str),
    creditCard: isValidCreditCard(str),
    ip: isValidIP(str),
    mac: isValidMAC(str),
    uuid: isValidUUID(str),
    hexColor: isValidHexColor(str),
    json: isValidJson(str),
    xml: isValidXml(str),
    base64: isValidBase64(str),
    jwt: isValidJWT(str),
  };
}

/**
 * Шифрует строку несколькими методами
 * @param {string} str - Строка для шифрования
 * @param {string} method - Метод шифрования
 * @param {string|number} key - Ключ шифрования
 * @returns {string} - Зашифрованная строка
 */
function encryptString(str, method = 'base64', key = null) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  switch (method) {
    case 'caesar':
      return encryptCaesar(str, parseInt(key) || 3);
    case 'rot13':
      return encryptROT13(str);
    case 'atbash':
      return encryptAtbash(str);
    case 'vigenere':
      return encryptVigenere(str, key || 'key');
    case 'xor':
      return encryptXOR(str, key || 'key');
    case 'base64':
      return encryptBase64(str);
    case 'hex':
      return encryptHex(str);
    case 'url':
      return encryptUrl(str);
    case 'html':
      return encryptHtml(str);
    default:
      throw new Error(`Unknown encryption method: ${method}`);
  }
}

/**
 * Расшифровывает строку несколькими методами
 * @param {string} str - Строка для расшифровки
 * @param {string} method - Метод шифрования
 * @param {string|number} key - Ключ шифрования
 * @returns {string} - Расшифрованная строка
 */
function decryptString(str, method = 'base64', key = null) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  switch (method) {
    case 'caesar':
      return decryptCaesar(str, parseInt(key) || 3);
    case 'rot13':
      return decryptROT13(str);
    case 'atbash':
      return decryptAtbash(str);
    case 'vigenere':
      return decryptVigenere(str, key || 'key');
    case 'xor':
      return decryptXOR(str, key || 'key');
    case 'base64':
      return decryptBase64(str);
    case 'hex':
      return decryptHex(str);
    case 'url':
      return decryptUrl(str);
    case 'html':
      return decryptHtml(str);
    default:
      throw new Error(`Unknown decryption method: ${method}`);
  }
}

/**
 * Генерирует случайную строку
 * @param {number} length - Длина строки
 * @param {string} charset - Набор символов
 * @returns {string} - Случайная строка
 */
function generateRandomString(length = 16, charset = 'alphanumeric') {
  if (length < 1) {
    throw new Error('Length must be positive');
  }

  const charsets = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    numeric: '0123456789',
    alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    hex: '0123456789abcdef',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    ascii: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=',
    custom:
      charset === 'custom' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' : '',
  };

  const chars = charsets[charset] || charsets.alphanumeric;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Сравнивает две строки с учетом различных метрик
 * @param {string} str1 - Первая строка
 * @param {string} str2 - Вторая строка
 * @returns {Object} - Результаты сравнения
 */
function compareStrings(str1, str2) {
  if (typeof str1 !== 'string' || typeof str2 !== 'string') {
    throw new TypeError('Expected strings');
  }

  return {
    equal: str1 === str2,
    lengthDiff: Math.abs(str1.length - str2.length),
    levenshtein: findLevenshteinDistance(str1, str2),
    hamming: findHammingDistance(str1, str2),
    jaccard: findJaccardSimilarity(str1, str2),
    dice: findDiceCoefficient(str1, str2),
    similarity: findSimilarity(str1, str2),
    commonChars: findCommonChars(str1, str2),
    differences: findDifferences(str1, str2),
  };
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт всех функций из модулей
export {
  // Трансформации
  capitalize,
  reverse,
  truncate,
  padStart,
  padEnd,
  trimAll,
  removeWhitespace,
  countWords,
  countCharacters,
  countLines,
  isPalindrome,
  isAnagram,
  isUpperCase,
  isLowerCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
  toConstantCase,
  toTitleCase,
  toSentenceCase,
  toAlternatingCase,
  toInverseCase,
  toRandomCase,

  // Форматирование
  formatGreeting,
  formatFullName,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatNumber,
  formatOrdinal,
  formatPhoneNumber,
  formatEmail,
  formatUrl,
  formatSlug,
  formatList,
  formatTable,
  formatJson,
  formatXml,
  formatYaml,
  formatMarkdown,

  // Поиск и сравнение
  findSubstring,
  findAllSubstrings,
  findFirstMatch,
  findAllMatches,
  countSubstring,
  countMatches,
  findUniqueChars,
  findDuplicateChars,
  findMostFrequentChar,
  findLeastFrequentChar,
  findLongestWord,
  findShortestWord,
  findLongestSubstring,
  findPalindromes,
  findAnagrams,
  findCommonChars,
  findDifferences,
  findSimilarity,
  findLevenshteinDistance,
  findHammingDistance,
  findJaccardSimilarity,
  findDiceCoefficient,

  // Валидация
  isValidEmail,
  isValidUrl,
  isValidPhone,
  isValidDate,
  isValidTime,
  isValidDateTime,
  isValidCreditCard,
  isValidIP,
  isValidMAC,
  isValidUUID,
  isValidHexColor,
  isValidHSLColor,
  isValidRGBColor,
  isValidCSSColor,
  isValidHTMLTag,
  isValidXMLTag,
  isValidJson,
  isValidXml,
  isValidYaml,
  isValidCsv,
  isValidBase64,
  isValidJWT,

  // Криптография
  encryptCaesar,
  decryptCaesar,
  encryptROT13,
  decryptROT13,
  encryptAtbash,
  decryptAtbash,
  encryptVigenere,
  decryptVigenere,
  encryptXOR,
  decryptXOR,
  encryptBase64,
  decryptBase64,
  encryptHex,
  decryptHex,
  encryptUrl,
  decryptUrl,
  encryptHtml,
  decryptHtml,
  encryptMd5,
  encryptSha1,
  encryptSha256,
  encryptSha512,
  generateHash,
  generateSalt,
  generateToken,

  // Комбинированные операции
  normalizeString,
  isPalindromeStrict,
  areAnagrams,
  wrapText,
  analyzeText,
  getAllCases,
  validateAllFormats,
  encryptString,
  decryptString,
  generateRandomString,
  compareStrings,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект со строковыми операциями
 */
export default {
  // Трансформации
  capitalize,
  reverse,
  truncate,
  padStart,
  padEnd,
  trimAll,
  removeWhitespace,
  countWords,
  countCharacters,
  countLines,
  isPalindrome,
  isAnagram,
  isUpperCase,
  isLowerCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
  toConstantCase,
  toTitleCase,
  toSentenceCase,
  toAlternatingCase,
  toInverseCase,
  toRandomCase,

  // Форматирование
  formatGreeting,
  formatFullName,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatNumber,
  formatOrdinal,
  formatPhoneNumber,
  formatEmail,
  formatUrl,
  formatSlug,
  formatList,
  formatTable,
  formatJson,
  formatXml,
  formatYaml,
  formatMarkdown,

  // Поиск и сравнение
  findSubstring,
  findAllSubstrings,
  findFirstMatch,
  findAllMatches,
  countSubstring,
  countMatches,
  findUniqueChars,
  findDuplicateChars,
  findMostFrequentChar,
  findLeastFrequentChar,
  findLongestWord,
  findShortestWord,
  findLongestSubstring,
  findPalindromes,
  findAnagrams,
  findCommonChars,
  findDifferences,
  findSimilarity,
  findLevenshteinDistance,
  findHammingDistance,
  findJaccardSimilarity,
  findDiceCoefficient,

  // Валидация
  isValidEmail,
  isValidUrl,
  isValidPhone,
  isValidDate,
  isValidTime,
  isValidDateTime,
  isValidCreditCard,
  isValidIP,
  isValidMAC,
  isValidUUID,
  isValidHexColor,
  isValidHSLColor,
  isValidRGBColor,
  isValidCSSColor,
  isValidHTMLTag,
  isValidXMLTag,
  isValidJson,
  isValidXml,
  isValidYaml,
  isValidCsv,
  isValidBase64,
  isValidJWT,

  // Криптография
  encryptCaesar,
  decryptCaesar,
  encryptROT13,
  decryptROT13,
  encryptAtbash,
  decryptAtbash,
  encryptVigenere,
  decryptVigenere,
  encryptXOR,
  decryptXOR,
  encryptBase64,
  decryptBase64,
  encryptHex,
  decryptHex,
  encryptUrl,
  decryptUrl,
  encryptHtml,
  decryptHtml,
  encryptMd5,
  encryptSha1,
  encryptSha256,
  encryptSha512,
  generateHash,
  generateSalt,
  generateToken,

  // Комбинированные операции
  normalizeString,
  isPalindromeStrict,
  areAnagrams,
  wrapText,
  analyzeText,
  getAllCases,
  validateAllFormats,
  encryptString,
  decryptString,
  generateRandomString,
  compareStrings,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Трансформации вынесены в transform.js:
 *    - capitalize, reverse, truncate
 *    - padStart, padEnd, trimAll
 *    - removeWhitespace, countWords, countCharacters, countLines
 *    - isPalindrome, isAnagram, isUpperCase, isLowerCase
 *    - Все преобразования регистра (camel, kebab, snake, pascal, constant, title, sentence, alternating, inverse, random)
 *
 * 2. Форматирование вынесено в format.js:
 *    - formatGreeting, formatFullName
 *    - formatCurrency, formatDate, formatTime, formatDateTime
 *    - formatDuration, formatFileSize, formatNumber, formatOrdinal
 *    - formatPhoneNumber, formatEmail, formatUrl, formatSlug
 *    - formatList, formatTable, formatJson, formatXml, formatYaml, formatMarkdown
 *
 * 3. Поиск и сравнение вынесено в search.js:
 *    - findSubstring, findAllSubstrings
 *    - findFirstMatch, findAllMatches
 *    - countSubstring, countMatches
 *    - findUniqueChars, findDuplicateChars
 *    - findMostFrequentChar, findLeastFrequentChar
 *    - findLongestWord, findShortestWord, findLongestSubstring
 *    - findPalindromes, findAnagrams
 *    - findCommonChars, findDifferences, findSimilarity
 *    - findLevenshteinDistance, findHammingDistance
 *    - findJaccardSimilarity, findDiceCoefficient
 *
 * 4. Валидация вынесена в validation.js:
 *    - isValidEmail, isValidUrl, isValidPhone
 *    - isValidDate, isValidTime, isValidDateTime
 *    - isValidCreditCard, isValidIP, isValidMAC, isValidUUID
 *    - isValidHexColor, isValidHSLColor, isValidRGBColor, isValidCSSColor
 *    - isValidHTMLTag, isValidXMLTag
 *    - isValidJson, isValidXml, isValidYaml, isValidCsv
 *    - isValidBase64, isValidJWT
 *
 * 5. Криптография вынесена в crypto.js:
 *    - encryptCaesar, decryptCaesar
 *    - encryptROT13, decryptROT13
 *    - encryptAtbash, decryptAtbash
 *    - encryptVigenere, decryptVigenere
 *    - encryptXOR, decryptXOR
 *    - encryptBase64, decryptBase64
 *    - encryptHex, decryptHex
 *    - encryptUrl, decryptUrl
 *    - encryptHtml, decryptHtml
 *    - encryptMd5, encryptSha1, encryptSha256, encryptSha512
 *    - generateHash, generateSalt, generateToken
 *
 * 6. Комбинированные операции остаются в index.js:
 *    - normalizeString
 *    - isPalindromeStrict
 *    - areAnagrams
 *    - wrapText
 *    - analyzeText
 *    - getAllCases
 *    - validateAllFormats
 *    - encryptString
 *    - decryptString
 *    - generateRandomString
 *    - compareStrings
 *
 * 7. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 8. Добавлены JSDoc комментарии для всех функций
 *
 * 9. Сохранена обратная совместимость через реэкспорты
 *
 * 10. Добавлены новые комбинированные функции для удобства
 */
