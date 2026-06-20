// packages/ast-analyzer/src/formal/__tests__/fixtures/original/11-edge-cases.js

// ============================================
// ГРАНИЧНЫЕ СЛУЧАИ - ОРИГИНАЛЬНЫЙ ФАЙЛ
// ============================================
// Этот файл содержит различные граничные случаи и экзотические конструкции,
// которые должны корректно обрабатываться при рефакторинге

/**
 * Функция без явного return (возвращает undefined)
 */
function returnUndefined() {
  // функция без return
  let x = 1;
  let y = 2;
  let z = x + y;
  // ничего не возвращает
}

/**
 * Функция возвращающая null
 */
function returnNull() {
  return null;
}

/**
 * Пустая функция (no-op)
 */
function emptyFunction() {
  // пустая функция без операций
}

/**
 * Функция только с комментариями
 */
function functionWithComments() {
  // Это однострочный комментарий
  /* Это многострочный
     комментарий */
  /**
   * Это JSDoc комментарий внутри функции
   */
  return 42;
}

/**
 * Функция с несколькими точками возврата
 * @param {number} x - Входное значение
 * @returns {number} - -1, 0 или 1
 */
function functionWithMultipleReturns(x) {
  if (x < 0) return -1;
  if (x === 0) return 0;
  if (x > 0) return 1;
  // Этот return никогда не достижим, но синтаксически корректен
  return 0;
}

/**
 * Функция с try-catch-finally
 * @returns {number} - Всегда возвращает 3
 */
function functionWithTryCatch() {
  try {
    return 1;
  } catch (e) {
    return 2;
  } finally {
    // finally выполняется всегда, но return в finally переопределяет все
    return 3;
  }
}

/**
 * Функция с вложенными try-catch
 * @param {number} x - Входное значение
 * @returns {number} - Результат обработки
 */
function functionWithNestedTryCatch(x) {
  try {
    try {
      if (x < 0) throw new Error('Negative value');
      return x * 2;
    } catch (e) {
      return -1;
    }
  } catch (e) {
    return -2;
  }
}

/**
 * Функция с деструктуризацией параметров
 * @param {Object} params - Параметры функции
 * @param {string} params.name - Имя
 * @param {number} params.age - Возраст
 * @param {string} [params.city] - Город (опционально)
 * @returns {string} - Строка с информацией
 */
function functionWithDestructuring({ name, age, city = 'Unknown' }) {
  return `${name} (${age}) from ${city}`;
}

/**
 * Функция с параметрами по умолчанию
 * @param {number} a - Первое число
 * @param {number} b - Второе число (по умолчанию 10)
 * @param {number} c - Третье число (по умолчанию 20)
 * @returns {number} - Сумма чисел
 */
function functionWithDefaults(a, b = 10, c = 20) {
  return a + b + c;
}

/**
 * Функция с rest параметрами
 * @param {...number} numbers - Числа для суммирования
 * @returns {number} - Сумма всех чисел
 */
function functionWithRest(...numbers) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

/**
 * Функция с spread оператором
 * @param {number[]} arr - Массив чисел
 * @returns {number} - Сумма чисел
 */
function functionWithSpread(arr) {
  return Math.max(...arr);
}

/**
 * Функция с вычисляемыми именами свойств
 * @param {string} key - Ключ свойства
 * @param {any} value - Значение свойства
 * @returns {Object} - Объект с вычисляемым свойством
 */
function functionWithComputedProperty(key, value) {
  return {
    [key]: value,
    [`${key}_processed`]: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Функция с шаблонными литералами
 * @param {string} name - Имя
 * @param {number} age - Возраст
 * @returns {string} - Строка с шаблонными литералами
 */
function functionWithTemplateLiterals(name, age) {
  const greeting = `Hello, ${name}!`;
  const info = `You are ${age} years old.`;
  const nextYear = `Next year you will be ${age + 1}.`;
  return `${greeting} ${info} ${nextYear}`;
}

/**
 * Функция с тегированными шаблонными литералами
 * @param {string[]} strings - Массив строк
 * @param {...any} values - Значения для вставки
 * @returns {string} - Обработанная строка
 */
function tag(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const value = values[i] !== undefined ? values[i].toUpperCase() : '';
    return result + str + value;
  }, '');
}

function functionWithTaggedTemplate(name, age) {
  return tag`User: ${name}, Age: ${age}`;
}

/**
 * Функция с генератором
 * @param {number} max - Максимальное значение
 * @returns {Generator} - Генератор чисел
 */
function* functionWithGenerator(max) {
  for (let i = 0; i < max; i++) {
    yield i * 2;
  }
}

/**
 * Функция с async/await и try-catch
 * @param {string} url - URL для запроса
 * @returns {Promise<Object>} - Promise с данными
 */
async function functionWithAsyncAwait(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    return null;
  }
}

/**
 * Функция с Promise.all и деструктуризацией
 * @param {string[]} urls - Массив URL
 * @returns {Promise<Object[]>} - Promise с массивом данных
 */
async function functionWithPromiseAll(urls) {
  const results = await Promise.all(
    urls.map(async url => {
      const response = await fetch(url);
      return response.json();
    })
  );
  return results.map((data, index) => ({
    ...data,
    source: urls[index],
    processedAt: new Date().toISOString(),
  }));
}

/**
 * Функция с замыканием
 * @param {number} initial - Начальное значение
 * @returns {Function} - Функция-счетчик
 */
function functionWithClosure(initial) {
  let count = initial;
  return function () {
    return count++;
  };
}

/**
 * Функция с каррированием
 * @param {number} a - Первое число
 * @returns {Function} - Функция, принимающая второе число
 */
function functionWithCurrying(a) {
  return function (b) {
    return function (c) {
      return a + b + c;
    };
  };
}

/**
 * Функция с частичным применением
 * @param {Function} fn - Функция для частичного применения
 * @param {...any} args - Аргументы для фиксации
 * @returns {Function} - Частично примененная функция
 */
function functionWithPartialApplication(fn, ...args) {
  return function (...rest) {
    return fn(...args, ...rest);
  };
}

/**
 * Функция с мемоизацией
 * @param {Function} fn - Функция для мемоизации
 * @returns {Function} - Мемоизированная функция
 */
function functionWithMemoization(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Функция с декоратором (в стиле JS)
 * @param {Function} fn - Декорируемая функция
 * @returns {Function} - Декорированная функция
 */
function decorator(fn) {
  return function (...args) {
    console.log(`Calling ${fn.name} with`, args);
    const start = Date.now();
    const result = fn(...args);
    const end = Date.now();
    console.log(`Result: ${result} (${end - start}ms)`);
    return result;
  };
}

function functionWithDecorator() {
  const add = decorator(function add(a, b) {
    return a + b;
  });
  return add(5, 3);
}

/**
 * Функция с Proxy
 * @param {Object} target - Целевой объект
 * @returns {Proxy} - Прокси-объект с логированием
 */
function functionWithProxy(target) {
  return new Proxy(target, {
    get(obj, prop) {
      console.log(`Getting ${String(prop)}`);
      return obj[prop];
    },
    set(obj, prop, value) {
      console.log(`Setting ${String(prop)} to ${value}`);
      obj[prop] = value;
      return true;
    },
  });
}

/**
 * Функция с Symbol
 * @returns {Object} - Объект с Symbol ключами
 */
function functionWithSymbol() {
  const uniqueKey = Symbol('unique');
  const privateKey = Symbol('private');
  return {
    [uniqueKey]: 'Unique value',
    [privateKey]: 'Private value',
    publicKey: 'Public value',
  };
}

/**
 * Функция с BigInt
 * @param {bigint} a - Первое BigInt число
 * @param {bigint} b - Второе BigInt число
 * @returns {bigint} - Сумма BigInt чисел
 */
function functionWithBigInt(a, b) {
  const bigNumber = 9007199254740991n;
  return a + b + bigNumber;
}

/**
 * Функция с Map и Set
 * @param {Array} items - Массив элементов
 * @returns {Object} - Объект с Map и Set
 */
function functionWithMapSet(items) {
  const map = new Map();
  const set = new Set();

  for (const item of items) {
    map.set(item.id, item);
    set.add(item.category);
  }

  return { map, set };
}

/**
 * Функция с WeakMap и WeakSet
 * @param {Object[]} items - Массив объектов
 * @returns {Object} - Объект с WeakMap и WeakSet
 */
function functionWithWeakMapSet(items) {
  const weakMap = new WeakMap();
  const weakSet = new WeakSet();

  for (const item of items) {
    weakMap.set(item, { processed: true });
    weakSet.add(item);
  }

  return { weakMap, weakSet };
}

/**
 * Функция с использованием eval (опасно, но должно быть протестировано)
 * @param {string} expression - Выражение для вычисления
 * @returns {any} - Результат вычисления
 */
function functionWithEval(expression) {
  // Использование eval - потенциально опасно, но должно корректно обрабатываться
  // Рекомендуется избегать в реальном коде
  try {
    return eval(expression);
  } catch (error) {
    console.error('Eval failed:', error);
    return null;
  }
}

/**
 * Функция с использованием with (устаревшая конструкция)
 * @param {Object} obj - Объект для контекста
 * @param {string} prop - Свойство для доступа
 * @returns {any} - Значение свойства
 */
function functionWithWith(obj, prop) {
  // Использование with - устаревшая конструкция
  // Рекомендуется избегать в реальном коде
  try {
    with (obj) {
      return eval(prop);
    }
  } catch (error) {
    console.error('With failed:', error);
    return null;
  }
}

/**
 * Функция с использованием arguments (устаревшая конструкция)
 * @returns {number} - Сумма всех аргументов
 */
function functionWithArguments() {
  let sum = 0;
  for (let i = 0; i < arguments.length; i++) {
    sum += arguments[i];
  }
  return sum;
}

/**
 * Функция с использованием caller (устаревшая конструкция)
 * @returns {Function} - Функция-вызывающий
 */
function functionWithCaller() {
  // Использование caller - устаревшая конструкция
  // @ts-ignore
  return functionWithCaller.caller;
}

/**
 * Функция с использованием callee (устаревшая конструкция)
 * @param {number} n - Число для рекурсии
 * @returns {number} - Результат
 */
function functionWithCallee(n) {
  // Использование callee - устаревшая конструкция
  if (n <= 1) return 1;
  // @ts-ignore
  return n * arguments.callee(n - 1);
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые граничные случаи
  returnUndefined,
  returnNull,
  emptyFunction,
  functionWithComments,
  functionWithMultipleReturns,
  functionWithTryCatch,
  functionWithNestedTryCatch,

  // Параметры и деструктуризация
  functionWithDestructuring,
  functionWithDefaults,
  functionWithRest,
  functionWithSpread,

  // Продвинутые возможности JS
  functionWithComputedProperty,
  functionWithTemplateLiterals,
  functionWithTaggedTemplate,
  functionWithGenerator,

  // Асинхронность
  functionWithAsyncAwait,
  functionWithPromiseAll,

  // Функциональное программирование
  functionWithClosure,
  functionWithCurrying,
  functionWithPartialApplication,
  functionWithMemoization,

  // Декораторы и метапрограммирование
  decorator,
  functionWithDecorator,
  functionWithProxy,

  // Специальные типы
  functionWithSymbol,
  functionWithBigInt,
  functionWithMapSet,
  functionWithWeakMapSet,

  // Устаревшие и опасные конструкции
  functionWithEval,
  functionWithWith,
  functionWithArguments,
  functionWithCaller,
  functionWithCallee,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * Этот файл содержит 38 экзотических конструкций для тестирования:
 *
 * Базовые граничные случаи (6):
 * 1. returnUndefined - функция без return
 * 2. returnNull - функция возвращающая null
 * 3. emptyFunction - пустая функция
 * 4. functionWithComments - функция с комментариями
 * 5. functionWithMultipleReturns - несколько точек возврата
 * 6. functionWithTryCatch - try-catch-finally
 * 7. functionWithNestedTryCatch - вложенные try-catch
 *
 * Параметры и деструктуризация (4):
 * 8. functionWithDestructuring - деструктуризация параметров
 * 9. functionWithDefaults - параметры по умолчанию
 * 10. functionWithRest - rest параметры
 * 11. functionWithSpread - spread оператор
 *
 * Продвинутые возможности JS (5):
 * 12. functionWithComputedProperty - вычисляемые свойства
 * 13. functionWithTemplateLiterals - шаблонные литералы
 * 14. functionWithTaggedTemplate - тегированные шаблоны
 * 15. functionWithGenerator - генераторы
 *
 * Асинхронность (2):
 * 16. functionWithAsyncAwait - async/await
 * 17. functionWithPromiseAll - Promise.all
 *
 * Функциональное программирование (4):
 * 18. functionWithClosure - замыкания
 * 19. functionWithCurrying - каррирование
 * 20. functionWithPartialApplication - частичное применение
 * 21. functionWithMemoization - мемоизация
 *
 * Декораторы и метапрограммирование (4):
 * 22. decorator - декоратор
 * 23. functionWithDecorator - применение декоратора
 * 24. functionWithProxy - Proxy
 *
 * Специальные типы (4):
 * 25. functionWithSymbol - Symbol
 * 26. functionWithBigInt - BigInt
 * 27. functionWithMapSet - Map и Set
 * 28. functionWithWeakMapSet - WeakMap и WeakSet
 *
 * Устаревшие и опасные конструкции (4):
 * 29. functionWithEval - eval
 * 30. functionWithWith - with
 * 31. functionWithArguments - arguments
 * 32. functionWithCaller - caller
 * 33. functionWithCallee - callee
 *
 * Всего: 33 функции для тестирования
 */

/*
 * Рекомендации по тестированию:
 *
 * 1. Для каждого типа конструкций должен быть отдельный тест
 * 2. Устаревшие конструкции должны корректно обрабатываться, но выдавать предупреждения
 * 3. Опасные конструкции (eval, with) должны быть изолированы в тестах
 * 4. Асинхронные функции требуют специальной обработки в тестах
 * 5. Генераторы должны корректно итерироваться
 * 6. Символы и BigInt должны сохранять свои типы
 * 7. WeakMap и WeakSet должны корректно обрабатывать ссылки
 */
