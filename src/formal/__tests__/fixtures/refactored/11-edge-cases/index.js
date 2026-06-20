// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/11-edge-cases/index.js

// ============================================
// ГРАНИЧНЫЕ СЛУЧАИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все граничные случаи вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт функций с граничными случаями
import {
  // Функции без return
  returnUndefined,
  returnVoid,
  returnEmpty,

  // Функции с null/undefined
  returnNull,
  returnUndefinedExplicit,
  returnNullOrUndefined,
  returnMaybeNull,

  // Пустые функции
  emptyFunction,
  emptyAsyncFunction,
  emptyGeneratorFunction,

  // Функции с комментариями
  functionWithComments,
  functionWithJsDoc,
  functionWithTodoComments,
  functionWithDebugComments,

  // Функции с множественными return
  functionWithMultipleReturns,
  functionWithEarlyReturns,
  functionWithConditionalReturns,
  functionWithTernaryReturns,

  // Функции с try-catch-finally
  functionWithTryCatch,
  functionWithTryCatchFinally,
  functionWithNestedTryCatch,
  functionWithFinallyOnly,

  // Функции с ошибками
  functionWithThrow,
  functionWithCustomError,
  functionWithErrorHandling,

  // Функции с дефолтными параметрами
  functionWithDefaults,
  functionWithDestructuringDefaults,
  functionWithComplexDefaults,

  // Функции с rest параметрами
  functionWithRestParams,
  functionWithRestAndDefaults,

  // Функции с деструктуризацией
  functionWithDestructuring,
  functionWithNestedDestructuring,
  functionWithArrayDestructuring,

  // Функции с замыканиями
  functionWithClosure,
  functionWithCounterClosure,
  functionWithMemoization,

  // Функции с каррированием
  functionWithCurrying,
  functionWithPartialApplication,

  // Функции с оператором new
  functionWithNewOperator,
  functionWithConstructor,

  // Функции с instanceof
  functionWithInstanceOf,
  functionWithTypeChecking,

  // Функции с eval
  functionWithEval,
  functionWithFunctionConstructor,

  // Функции с with
  functionWithWith,

  // Функции с debugger
  functionWithDebugger,

  // Функции с BigInt
  functionWithBigInt,
  functionWithBigIntOperations,

  // Функции с Symbol
  functionWithSymbol,
  functionWithSymbolIterator,

  // Функции с Proxy
  functionWithProxy,
  functionWithProxyHandler,

  // Функции с Reflect
  functionWithReflect,

  // Функции с WeakMap/WeakSet
  functionWithWeakMap,
  functionWithWeakSet,

  // Функции с generator
  functionWithGenerator,
  functionWithAsyncGenerator,

  // Функции с yield
  functionWithYield,
  functionWithYieldStar,

  // Функции с import.meta
  functionWithImportMeta,

  // Функции с top-level await (имитация)
  functionWithTopLevelAwait,

  // Функции с приватными полями (имитация)
  functionWithPrivateFields,

  // Функции с декораторами (имитация)
  functionWithDecorators,
} from './modules/edge-functions.js';

// Импорт классов с граничными случаями
import {
  ClassWithEdgeCases,
  ClassWithPrivateFields,
  ClassWithStaticMethods,
  ClassWithGettersSetters,
  ClassWithProxy,
  ClassWithSymbols,
  ClassWithGenerators,
  ClassWithAsyncMethods,
  ClassWithErrorHandling,
} from './modules/edge-classes.js';

// Импорт утилит для работы с граничными случаями
import {
  // Валидация
  validateInput,
  validateNumber,
  validateString,
  validateArray,
  validateObject,
  validateEmail,
  validatePhone,
  validateURL,
  validateDate,
  validateBoolean,

  // Обработка ошибок
  tryCatch,
  tryCatchAsync,
  safeExecute,
  safeParse,
  safeJSONParse,

  // Обработка null/undefined
  isNull,
  isUndefined,
  isNullOrUndefined,
  isFalsy,
  isTruthy,
  defaultIfNull,
  defaultIfUndefined,
  defaultIfNullOrUndefined,
  coalesce,

  // Проверка типов
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  isFunction,
  isDate,
  isRegExp,
  isPromise,
  isSymbol,
  isBigInt,
  isPrimitive,

  // Преобразование типов
  toNumber,
  toString,
  toBoolean,
  toArray,
  toObject,
  toDate,
  toJSON,

  // Сравнение
  deepEqual,
  shallowEqual,
  compareNumbers,
  compareStrings,
  compareDates,

  // Клонирование
  shallowClone,
  deepClone,
  structuredClonePolyfill,
} from './modules/edge-utils.js';

// ============================================
// КОМБИНИРОВАННЫЕ ФУНКЦИИ ДЛЯ ГРАНИЧНЫХ СЛУЧАЕВ
// ============================================

/**
 * Безопасное выполнение функции с обработкой всех ошибок
 * @param {Function} fn - Функция для выполнения
 * @param {*} defaultValue - Значение по умолчанию при ошибке
 * @param {Object} options - Опции выполнения
 * @returns {*} - Результат выполнения или значение по умолчанию
 */
function safeExecuteWithOptions(fn, defaultValue = null, options = {}) {
  const {
    logErrors = false,
    retryCount = 0,
    retryDelay = 100,
    timeout = 0,
    errorHandler = null,
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // Таймаут выполнения
      if (timeout > 0) {
        const result = executeWithTimeout(fn, timeout);
        return result !== undefined ? result : defaultValue;
      }

      const result = fn();
      return result !== undefined ? result : defaultValue;
    } catch (error) {
      lastError = error;
      if (logErrors) {
        console.warn(`Execution attempt ${attempt + 1} failed:`, error);
      }
      if (errorHandler) {
        errorHandler(error, attempt);
      }
      if (attempt < retryCount && retryDelay > 0) {
        // Задержка перед повторной попыткой
        const delay =
          typeof retryDelay === 'function'
            ? retryDelay(attempt)
            : retryDelay * Math.pow(2, attempt);
        // Используем синхронную задержку для простоты
        const start = Date.now();
        while (Date.now() - start < delay) {
          // busy wait
        }
      }
    }
  }

  return defaultValue;
}

/**
 * Функция с таймаутом выполнения
 * @param {Function} fn - Функция для выполнения
 * @param {number} timeout - Таймаут в мс
 * @returns {*} - Результат выполнения
 */
function executeWithTimeout(fn, timeout) {
  let result;
  let error = null;
  let completed = false;

  // Запускаем выполнение
  try {
    result = fn();
    completed = true;
  } catch (err) {
    error = err;
    completed = true;
  }

  // Проверяем, не превышен ли таймаут (имитация)
  if (!completed) {
    throw new Error(`Function execution timed out after ${timeout}ms`);
  }

  if (error) {
    throw error;
  }

  return result;
}

/**
 * Создает функцию с мемоизацией результатов
 * @param {Function} fn - Функция для мемоизации
 * @param {Function} keyGenerator - Функция генерации ключа
 * @param {Object} options - Опции мемоизации
 * @returns {Function} - Мемоизированная функция
 */
function memoize(fn, keyGenerator = null, options = {}) {
  const { maxSize = 1000, ttl = 0, weak = false } = options;
  let cache;

  if (weak) {
    cache = new WeakMap();
  } else {
    cache = new Map();
  }

  const timestamps = new Map();

  return function (...args) {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    // Проверка кэша для WeakMap
    if (weak && typeof key !== 'object') {
      throw new Error('WeakMap keys must be objects');
    }

    // Проверка срока действия
    if (timestamps.has(key)) {
      const timestamp = timestamps.get(key);
      if (ttl > 0 && Date.now() - timestamp > ttl) {
        cache.delete(key);
        timestamps.delete(key);
      }
    }

    // Проверка размера кэша
    if (!weak && cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
      timestamps.delete(firstKey);
    }

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    timestamps.set(key, Date.now());

    return result;
  };
}

/**
 * Создает функцию с ограничением скорости вызовов (throttle)
 * @param {Function} fn - Функция для ограничения
 * @param {number} limit - Лимит вызовов в секунду
 * @returns {Function} - Функция с ограничением
 */
function throttle(fn, limit = 1) {
  let lastCall = 0;
  let queued = null;
  let timeout = null;

  return function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    const minInterval = 1000 / limit;

    if (timeSinceLastCall >= minInterval) {
      lastCall = now;
      return fn.apply(this, args);
    }

    // Откладываем вызов
    if (queued === null) {
      queued = { args, context: this };
      timeout = setTimeout(() => {
        if (queued) {
          lastCall = Date.now();
          fn.apply(queued.context, queued.args);
          queued = null;
          timeout = null;
        }
      }, minInterval - timeSinceLastCall);
    } else {
      // Обновляем отложенный вызов
      queued.args = args;
      queued.context = this;
    }
  };
}

/**
 * Создает функцию с задержкой выполнения (debounce)
 * @param {Function} fn - Функция для задержки
 * @param {number} delay - Задержка в мс
 * @param {Object} options - Опции
 * @returns {Function} - Функция с задержкой
 */
function debounce(fn, delay = 300, options = {}) {
  let timeout = null;
  const { leading = false, trailing = true } = options;

  return function (...args) {
    const context = this;

    if (leading && !timeout) {
      fn.apply(context, args);
    }

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      if (trailing) {
        fn.apply(context, args);
      }
    }, delay);
  };
}

/**
 * Создает функцию с ограничением количества вызовов
 * @param {Function} fn - Функция для ограничения
 * @param {number} maxCalls - Максимальное количество вызовов
 * @param {Function} onLimit - Функция при достижении лимита
 * @returns {Function} - Функция с ограничением
 */
function limitCalls(fn, maxCalls = 1, onLimit = null) {
  let calls = 0;

  return function (...args) {
    if (calls >= maxCalls) {
      if (onLimit) {
        return onLimit(...args);
      }
      throw new Error(`Function can only be called ${maxCalls} times`);
    }
    calls++;
    return fn.apply(this, args);
  };
}

/**
 * Создает функцию с кэшированием ошибок
 * @param {Function} fn - Функция для кэширования
 * @param {number} ttl - Время жизни кэша ошибок
 * @returns {Function} - Функция с кэшированием ошибок
 */
function cacheErrors(fn, ttl = 60000) {
  const errorCache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (errorCache.has(key)) {
      const { error, timestamp } = errorCache.get(key);
      if (Date.now() - timestamp < ttl) {
        throw error;
      }
      errorCache.delete(key);
    }

    try {
      return fn.apply(this, args);
    } catch (error) {
      errorCache.set(key, {
        error,
        timestamp: Date.now(),
      });
      throw error;
    }
  };
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт функций с граничными случаями
export {
  returnUndefined,
  returnVoid,
  returnEmpty,
  returnNull,
  returnUndefinedExplicit,
  returnNullOrUndefined,
  returnMaybeNull,
  emptyFunction,
  emptyAsyncFunction,
  emptyGeneratorFunction,
  functionWithComments,
  functionWithJsDoc,
  functionWithTodoComments,
  functionWithDebugComments,
  functionWithMultipleReturns,
  functionWithEarlyReturns,
  functionWithConditionalReturns,
  functionWithTernaryReturns,
  functionWithTryCatch,
  functionWithTryCatchFinally,
  functionWithNestedTryCatch,
  functionWithFinallyOnly,
  functionWithThrow,
  functionWithCustomError,
  functionWithErrorHandling,
  functionWithDefaults,
  functionWithDestructuringDefaults,
  functionWithComplexDefaults,
  functionWithRestParams,
  functionWithRestAndDefaults,
  functionWithDestructuring,
  functionWithNestedDestructuring,
  functionWithArrayDestructuring,
  functionWithClosure,
  functionWithCounterClosure,
  functionWithMemoization,
  functionWithCurrying,
  functionWithPartialApplication,
  functionWithNewOperator,
  functionWithConstructor,
  functionWithInstanceOf,
  functionWithTypeChecking,
  functionWithEval,
  functionWithFunctionConstructor,
  functionWithWith,
  functionWithDebugger,
  functionWithBigInt,
  functionWithBigIntOperations,
  functionWithSymbol,
  functionWithSymbolIterator,
  functionWithProxy,
  functionWithProxyHandler,
  functionWithReflect,
  functionWithWeakMap,
  functionWithWeakSet,
  functionWithGenerator,
  functionWithAsyncGenerator,
  functionWithYield,
  functionWithYieldStar,
  functionWithImportMeta,
  functionWithTopLevelAwait,
  functionWithPrivateFields,
  functionWithDecorators,
};

// Реэкспорт классов с граничными случаями
export {
  ClassWithEdgeCases,
  ClassWithPrivateFields,
  ClassWithStaticMethods,
  ClassWithGettersSetters,
  ClassWithProxy,
  ClassWithSymbols,
  ClassWithGenerators,
  ClassWithAsyncMethods,
  ClassWithErrorHandling,
};

// Реэкспорт утилит
export {
  validateInput,
  validateNumber,
  validateString,
  validateArray,
  validateObject,
  validateEmail,
  validatePhone,
  validateURL,
  validateDate,
  validateBoolean,
  tryCatch,
  tryCatchAsync,
  safeExecute,
  safeParse,
  safeJSONParse,
  isNull,
  isUndefined,
  isNullOrUndefined,
  isFalsy,
  isTruthy,
  defaultIfNull,
  defaultIfUndefined,
  defaultIfNullOrUndefined,
  coalesce,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  isFunction,
  isDate,
  isRegExp,
  isPromise,
  isSymbol,
  isBigInt,
  isPrimitive,
  toNumber,
  toString,
  toBoolean,
  toArray,
  toObject,
  toDate,
  toJSON,
  deepEqual,
  shallowEqual,
  compareNumbers,
  compareStrings,
  compareDates,
  shallowClone,
  deepClone,
  structuredClonePolyfill,
};

// Реэкспорт комбинированных функций
export {
  safeExecuteWithOptions,
  executeWithTimeout,
  memoize,
  throttle,
  debounce,
  limitCalls,
  cacheErrors,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями для граничных случаев
 */
export default {
  // Функции с граничными случаями
  returnUndefined,
  returnVoid,
  returnEmpty,
  returnNull,
  returnUndefinedExplicit,
  returnNullOrUndefined,
  returnMaybeNull,
  emptyFunction,
  emptyAsyncFunction,
  emptyGeneratorFunction,
  functionWithComments,
  functionWithJsDoc,
  functionWithTodoComments,
  functionWithDebugComments,
  functionWithMultipleReturns,
  functionWithEarlyReturns,
  functionWithConditionalReturns,
  functionWithTernaryReturns,
  functionWithTryCatch,
  functionWithTryCatchFinally,
  functionWithNestedTryCatch,
  functionWithFinallyOnly,
  functionWithThrow,
  functionWithCustomError,
  functionWithErrorHandling,
  functionWithDefaults,
  functionWithDestructuringDefaults,
  functionWithComplexDefaults,
  functionWithRestParams,
  functionWithRestAndDefaults,
  functionWithDestructuring,
  functionWithNestedDestructuring,
  functionWithArrayDestructuring,
  functionWithClosure,
  functionWithCounterClosure,
  functionWithMemoization,
  functionWithCurrying,
  functionWithPartialApplication,
  functionWithNewOperator,
  functionWithConstructor,
  functionWithInstanceOf,
  functionWithTypeChecking,
  functionWithEval,
  functionWithFunctionConstructor,
  functionWithWith,
  functionWithDebugger,
  functionWithBigInt,
  functionWithBigIntOperations,
  functionWithSymbol,
  functionWithSymbolIterator,
  functionWithProxy,
  functionWithProxyHandler,
  functionWithReflect,
  functionWithWeakMap,
  functionWithWeakSet,
  functionWithGenerator,
  functionWithAsyncGenerator,
  functionWithYield,
  functionWithYieldStar,
  functionWithImportMeta,
  functionWithTopLevelAwait,
  functionWithPrivateFields,
  functionWithDecorators,

  // Классы
  ClassWithEdgeCases,
  ClassWithPrivateFields,
  ClassWithStaticMethods,
  ClassWithGettersSetters,
  ClassWithProxy,
  ClassWithSymbols,
  ClassWithGenerators,
  ClassWithAsyncMethods,
  ClassWithErrorHandling,

  // Утилиты
  validateInput,
  validateNumber,
  validateString,
  validateArray,
  validateObject,
  validateEmail,
  validatePhone,
  validateURL,
  validateDate,
  validateBoolean,
  tryCatch,
  tryCatchAsync,
  safeExecute,
  safeParse,
  safeJSONParse,
  isNull,
  isUndefined,
  isNullOrUndefined,
  isFalsy,
  isTruthy,
  defaultIfNull,
  defaultIfUndefined,
  defaultIfNullOrUndefined,
  coalesce,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  isFunction,
  isDate,
  isRegExp,
  isPromise,
  isSymbol,
  isBigInt,
  isPrimitive,
  toNumber,
  toString,
  toBoolean,
  toArray,
  toObject,
  toDate,
  toJSON,
  deepEqual,
  shallowEqual,
  compareNumbers,
  compareStrings,
  compareDates,
  shallowClone,
  deepClone,
  structuredClonePolyfill,

  // Комбинированные функции
  safeExecuteWithOptions,
  executeWithTimeout,
  memoize,
  throttle,
  debounce,
  limitCalls,
  cacheErrors,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Функции с граничными случаями вынесены в modules/edge-functions.js:
 *    - Функции без return
 *    - Функции с null/undefined
 *    - Пустые функции
 *    - Функции с комментариями
 *    - Функции с множественными return
 *    - Функции с try-catch-finally
 *    - Функции с ошибками
 *    - Функции с дефолтными параметрами
 *    - Функции с rest параметрами
 *    - Функции с деструктуризацией
 *    - Функции с замыканиями
 *    - Функции с каррированием
 *    - Функции с оператором new
 *    - Функции с instanceof
 *    - Функции с eval
 *    - Функции с with
 *    - Функции с debugger
 *    - Функции с BigInt
 *    - Функции с Symbol
 *    - Функции с Proxy
 *    - Функции с Reflect
 *    - Функции с WeakMap/WeakSet
 *    - Функции с generator
 *    - Функции с yield
 *    - Функции с import.meta
 *    - Функции с top-level await
 *    - Функции с приватными полями
 *    - Функции с декораторами
 *
 * 2. Классы с граничными случаями вынесены в modules/edge-classes.js:
 *    - ClassWithEdgeCases - класс с различными методами
 *    - ClassWithPrivateFields - класс с приватными полями
 *    - ClassWithStaticMethods - класс со статическими методами
 *    - ClassWithGettersSetters - класс с геттерами/сеттерами
 *    - ClassWithProxy - класс с Proxy
 *    - ClassWithSymbols - класс с Symbol
 *    - ClassWithGenerators - класс с генераторами
 *    - ClassWithAsyncMethods - класс с асинхронными методами
 *    - ClassWithErrorHandling - класс с обработкой ошибок
 *
 * 3. Утилиты вынесены в modules/edge-utils.js:
 *    - Валидация
 *    - Обработка ошибок
 *    - Обработка null/undefined
 *    - Проверка типов
 *    - Преобразование типов
 *    - Сравнение
 *    - Клонирование
 *
 * 4. Комбинированные функции остаются в index.js:
 *    - safeExecuteWithOptions - безопасное выполнение с опциями
 *    - executeWithTimeout - выполнение с таймаутом
 *    - memoize - мемоизация
 *    - throttle - ограничение скорости
 *    - debounce - задержка выполнения
 *    - limitCalls - ограничение количества вызовов
 *    - cacheErrors - кэширование ошибок
 *
 * 5. Все модули импортируются и реэкспортируются для сохранения API
 *
 * 6. Добавлены JSDoc комментарии для всех функций
 *
 * 7. Сохранена обратная совместимость через реэкспорты
 *
 * 8. Все граничные случаи покрыты тестами
 */
