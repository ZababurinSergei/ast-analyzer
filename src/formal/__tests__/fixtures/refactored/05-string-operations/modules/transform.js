// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/05-string-operations/modules/transform.js

// ============================================
// МОДУЛЬ ТРАНСФОРМАЦИИ СТРОК
// ============================================
// Этот модуль содержит функции для трансформации,
// обработки и манипуляции строками.

/**
 * Реверсирует строку
 * @param {string} str - Входная строка
 * @returns {string} - Перевернутая строка
 */
function reverse(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.split('').reverse().join('');
}

/**
 * Реверсирует слова в строке (порядок слов)
 * @param {string} str - Входная строка
 * @returns {string} - Строка с обратным порядком слов
 */
function reverseWords(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.split(' ').reverse().join(' ');
}

/**
 * Обрезает строку до указанной длины с добавлением многоточия
 * @param {string} str - Входная строка
 * @param {number} maxLength - Максимальная длина
 * @param {string} suffix - Суффикс для обрезанной строки
 * @returns {string} - Обрезанная строка
 */
function truncate(str, maxLength, suffix = '...') {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Обрезает строку по словам (не разбивает слова)
 * @param {string} str - Входная строка
 * @param {number} maxLength - Максимальная длина
 * @param {string} suffix - Суффикс для обрезанной строки
 * @returns {string} - Обрезанная строка
 */
function truncateWords(str, maxLength, suffix = '...') {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }

  const truncated = str.slice(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace === -1) {
    return truncated + suffix;
  }
  return truncated.slice(0, lastSpace) + suffix;
}

/**
 * Удаляет все пробелы из строки
 * @param {string} str - Входная строка
 * @returns {string} - Строка без пробелов
 */
function removeWhitespace(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/\s/g, '');
}

/**
 * Удаляет лишние пробелы (нормализует)
 * @param {string} str - Входная строка
 * @returns {string} - Строка с нормализованными пробелами
 */
function normalizeWhitespace(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Удаляет повторяющиеся символы
 * @param {string} str - Входная строка
 * @param {number} maxRepeat - Максимальное количество повторений
 * @returns {string} - Строка без повторяющихся символов
 */
function removeRepeatedChars(str, maxRepeat = 1) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  let result = '';
  let count = 0;
  let lastChar = '';

  for (const char of str) {
    if (char === lastChar) {
      count++;
      if (count <= maxRepeat) {
        result += char;
      }
    } else {
      count = 1;
      lastChar = char;
      result += char;
    }
  }
  return result;
}

/**
 * Удаляет указанные символы из строки
 * @param {string} str - Входная строка
 * @param {string|string[]} chars - Символы для удаления
 * @returns {string} - Строка без указанных символов
 */
function removeChars(str, chars) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const charsToRemove = Array.isArray(chars) ? chars : [chars];
  const pattern = charsToRemove.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return str.replace(new RegExp(pattern, 'g'), '');
}

/**
 * Удаляет все цифры из строки
 * @param {string} str - Входная строка
 * @returns {string} - Строка без цифр
 */
function removeDigits(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/\d/g, '');
}

/**
 * Удаляет все буквы из строки (оставляет только цифры)
 * @param {string} str - Входная строка
 * @returns {string} - Строка с только цифрами
 */
function removeLetters(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/[a-zA-Z]/g, '');
}

/**
 * Удаляет все специальные символы (оставляет буквы и цифры)
 * @param {string} str - Входная строка
 * @returns {string} - Строка без специальных символов
 */
function removeSpecialChars(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/[^a-zA-Z0-9\s]/g, '');
}

/**
 * Удаляет все гласные буквы
 * @param {string} str - Входная строка
 * @param {boolean} includeY - Включать ли 'y' в гласные
 * @returns {string} - Строка без гласных
 */
function removeVowels(str, includeY = false) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  const vowels = includeY ? /[aeiouy]/gi : /[aeiou]/gi;
  return str.replace(vowels, '');
}

/**
 * Удаляет все согласные буквы
 * @param {string} str - Входная строка
 * @param {boolean} includeY - Включать ли 'y' в согласные
 * @returns {string} - Строка без согласных
 */
function removeConsonants(str, includeY = false) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  const consonants = includeY ? /[bcdfghjklmnpqrstvwxyz]/gi : /[bcdfghjklmnpqrstvwxyz]/gi;
  return str.replace(consonants, '');
}

/**
 * Заменяет последовательности пробелов на один пробел
 * @param {string} str - Входная строка
 * @returns {string} - Строка с единичными пробелами
 */
function collapseSpaces(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/ +/g, ' ');
}

/**
 * Заменяет пробелы на указанный разделитель
 * @param {string} str - Входная строка
 * @param {string} separator - Разделитель
 * @returns {string} - Строка с замененными пробелами
 */
function replaceSpaces(str, separator = '-') {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/\s+/g, separator);
}

/**
 * Добавляет префикс к строке
 * @param {string} str - Входная строка
 * @param {string} prefix - Префикс
 * @param {boolean} onlyIfMissing - Добавлять только если отсутствует
 * @returns {string} - Строка с префиксом
 */
function addPrefix(str, prefix, onlyIfMissing = false) {
  if (!str || typeof str !== 'string') {
    return prefix || '';
  }
  if (onlyIfMissing && str.startsWith(prefix)) {
    return str;
  }
  return prefix + str;
}

/**
 * Добавляет суффикс к строке
 * @param {string} str - Входная строка
 * @param {string} suffix - Суффикс
 * @param {boolean} onlyIfMissing - Добавлять только если отсутствует
 * @returns {string} - Строка с суффиксом
 */
function addSuffix(str, suffix, onlyIfMissing = false) {
  if (!str || typeof str !== 'string') {
    return suffix || '';
  }
  if (onlyIfMissing && str.endsWith(suffix)) {
    return str;
  }
  return str + suffix;
}

/**
 * Оборачивает строку в указанные символы
 * @param {string} str - Входная строка
 * @param {string} wrapper - Символы для обертки
 * @param {string} open - Открывающий символ (если отличается от wrapper)
 * @param {string} close - Закрывающий символ (если отличается от wrapper)
 * @returns {string} - Обернутая строка
 */
function wrap(str, wrapper, open, close) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  const openChar = open || wrapper;
  const closeChar = close || wrapper;
  return openChar + str + closeChar;
}

/**
 * Оборачивает каждое слово в строке
 * @param {string} str - Входная строка
 * @param {string} wrapper - Символы для обертки
 * @returns {string} - Строка с обернутыми словами
 */
function wrapWords(str, wrapper) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str
    .split(' ')
    .map(word => wrap(word, wrapper))
    .join(' ');
}

/**
 * Транслитерирует строку (латинизация)
 * @param {string} str - Входная строка
 * @param {string} locale - Локаль ('ru', 'uk', 'de', 'fr', 'es')
 * @returns {string} - Транслитерированная строка
 */
function transliterate(str, locale = 'ru') {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const maps = {
    ru: {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'yo',
      ж: 'zh',
      з: 'z',
      и: 'i',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'kh',
      ц: 'ts',
      ч: 'ch',
      ш: 'sh',
      щ: 'shch',
      ъ: '',
      ы: 'y',
      ь: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
    },
    uk: {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'h',
      ґ: 'g',
      д: 'd',
      е: 'e',
      є: 'ye',
      ж: 'zh',
      з: 'z',
      и: 'y',
      і: 'i',
      ї: 'yi',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'kh',
      ц: 'ts',
      ч: 'ch',
      ш: 'sh',
      щ: 'shch',
      ь: '',
      ю: 'yu',
      я: 'ya',
    },
  };

  const map = maps[locale] || maps.ru;
  const lowerStr = str.toLowerCase();

  let result = '';
  for (const char of lowerStr) {
    result += map[char] || char;
  }

  return result;
}

/**
 * Создает строку с повторением указанное количество раз
 * @param {string} str - Строка для повторения
 * @param {number} count - Количество повторений
 * @param {string} separator - Разделитель между повторениями
 * @returns {string} - Повторенная строка
 */
function repeatString(str, count, separator = '') {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (count <= 0) {
    return '';
  }
  return Array(count).fill(str).join(separator);
}

/**
 * Перемешивает символы в строке
 * @param {string} str - Входная строка
 * @returns {string} - Перемешанная строка
 */
function shuffle(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  const chars = str.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Возвращает строку с чередующимся регистром
 * @param {string} str - Входная строка
 * @param {boolean} startUpper - Начинать с верхнего регистра
 * @returns {string} - Строка с чередующимся регистром
 */
function alternatingCase(str, startUpper = true) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  let result = '';
  let upper = startUpper;

  for (const char of str) {
    if (char.match(/[a-zA-Z]/)) {
      result += upper ? char.toUpperCase() : char.toLowerCase();
      upper = !upper;
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Преобразует строку в "лесенку" (каждая строка длиннее на указанное количество)
 * @param {string} str - Входная строка
 * @param {number} step - Шаг увеличения длины
 * @param {string} separator - Разделитель между строками
 * @returns {string} - Строка в виде "лесенки"
 */
function staircase(str, step = 1, separator = '\n') {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const words = str.split(' ');
  const result = [];
  let currentLength = 0;
  let currentLine = '';

  for (const word of words) {
    if (currentLine) {
      currentLine += ' ';
    }
    currentLine += word;
    currentLength += word.length + (currentLine.includes(' ') ? 1 : 0);

    if (currentLength >= step) {
      result.push(currentLine);
      currentLine = '';
      currentLength = 0;
    }
  }

  if (currentLine) {
    result.push(currentLine);
  }

  return result.join(separator);
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые трансформации
  reverse,
  reverseWords,

  // Обрезка строк
  truncate,
  truncateWords,

  // Удаление символов
  removeWhitespace,
  normalizeWhitespace,
  removeRepeatedChars,
  removeChars,
  removeDigits,
  removeLetters,
  removeSpecialChars,
  removeVowels,
  removeConsonants,
  collapseSpaces,
  replaceSpaces,

  // Добавление префиксов/суффиксов
  addPrefix,
  addSuffix,
  wrap,
  wrapWords,

  // Специальные трансформации
  transliterate,
  repeatString,
  shuffle,
  alternatingCase,
  staircase,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями трансформации
 */
export default {
  reverse,
  reverseWords,
  truncate,
  truncateWords,
  removeWhitespace,
  normalizeWhitespace,
  removeRepeatedChars,
  removeChars,
  removeDigits,
  removeLetters,
  removeSpecialChars,
  removeVowels,
  removeConsonants,
  collapseSpaces,
  replaceSpaces,
  addPrefix,
  addSuffix,
  wrap,
  wrapWords,
  transliterate,
  repeatString,
  shuffle,
  alternatingCase,
  staircase,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ТРАНСФОРМАЦИИ СТРОК
 *
 * Этот модуль предоставляет 24 функции для трансформации строк:
 *
 * 1. reverse            - Переворот строки
 * 2. reverseWords       - Переворот порядка слов
 * 3. truncate           - Обрезка с многоточием
 * 4. truncateWords      - Обрезка по словам
 * 5. removeWhitespace   - Удаление всех пробелов
 * 6. normalizeWhitespace - Нормализация пробелов
 * 7. removeRepeatedChars - Удаление повторяющихся символов
 * 8. removeChars        - Удаление указанных символов
 * 9. removeDigits       - Удаление цифр
 * 10. removeLetters     - Удаление букв
 * 11. removeSpecialChars - Удаление специальных символов
 * 12. removeVowels      - Удаление гласных
 * 13. removeConsonants  - Удаление согласных
 * 14. collapseSpaces    - Сворачивание пробелов
 * 15. replaceSpaces     - Замена пробелов
 * 16. addPrefix         - Добавление префикса
 * 17. addSuffix         - Добавление суффикса
 * 18. wrap              - Обертка строки
 * 19. wrapWords         - Обертка слов
 * 20. transliterate     - Транслитерация
 * 21. repeatString      - Повторение строки
 * 22. shuffle           - Перемешивание символов
 * 23. alternatingCase   - Чередующийся регистр
 * 24. staircase         - "Лесенка" из слов
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают множество режимов работы
 * - Обрабатывают граничные случаи
 * - Имеют JSDoc с описанием параметров
 */
