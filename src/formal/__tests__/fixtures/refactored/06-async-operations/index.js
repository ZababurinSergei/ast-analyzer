// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/06-async-operations/index.js

// ============================================
// АСИНХРОННЫЕ ОПЕРАЦИИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все асинхронные операции вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт базовых асинхронных операций
import {
  fetchData,
  fetchWithTimeout,
  fetchWithRetry,
  fetchWithAbort,
  fetchWithCache,
} from './modules/fetch.js';

// Импорт операций обработки данных
import {
  processData,
  processSequential,
  processBatch,
  transformWithWorker,
  composeAsyncOperations,
  processStream,
} from './modules/process.js';

// Импорт операций работы с пользователями
import {
  fetchUser,
  fetchMultiple,
  fetchUserWithDetails,
  fetchUserWithPosts,
  fetchUsersByRole,
  searchUsers,
} from './modules/user.js';

// Импорт операций с кэшированием
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheClear,
  cacheHas,
  cacheStats,
  withCache,
} from './modules/cache.js';

// Импорт утилит для работы с асинхронностью
import {
  sleep,
  retry,
  timeout,
  debounce,
  throttle,
  rateLimit,
  batch,
  parallel,
  sequential,
  race,
  allSettled,
  any,
  mapAsync,
  filterAsync,
  reduceAsync,
  forEachAsync,
} from './modules/async-utils.js';

// ============================================
// КОМБИНИРОВАННЫЕ ОПЕРАЦИИ
// ============================================

/**
 * Получение и обработка данных с кэшированием
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции запроса
 * @param {number} options.cacheTTL - Время жизни кэша в мс
 * @param {number} options.timeout - Таймаут запроса в мс
 * @param {number} options.retries - Количество повторных попыток
 * @param {Array} options.transformers - Функции трансформации
 * @returns {Promise<Object>} - Promise с обработанными данными
 */
async function fetchAndProcess(url, options = {}) {
  const { cacheTTL = 60000, timeout: timeoutMs = 5000, retries = 3, transformers = [] } = options;

  // Проверяем кэш
  const cacheKey = `fetch_${url}`;
  const cachedData = await cacheGet(cacheKey);
  if (cachedData) {
    console.log(`Cache hit for ${url}`);
    return cachedData;
  }

  // Выполняем запрос с повторными попытками и таймаутом
  const data = await fetchWithRetry(url, retries, 1000);

  // Применяем трансформеры
  let result = data;
  for (const transformer of transformers) {
    if (typeof transformer === 'function') {
      result = await transformer(result);
    }
  }

  // Сохраняем в кэш
  await cacheSet(cacheKey, result, cacheTTL);

  return result;
}

/**
 * Пакетная обработка пользователей с кэшированием
 * @param {Array<number>} userIds - Массив ID пользователей
 * @param {Object} options - Опции обработки
 * @param {number} options.batchSize - Размер пакета
 * @param {number} options.concurrency - Количество параллельных запросов
 * @param {boolean} options.includeDetails - Включать ли детали
 * @param {boolean} options.includePosts - Включать ли посты
 * @returns {Promise<Array>} - Promise с массивом пользователей
 */
async function processUsersBatch(userIds, options = {}) {
  const { batchSize = 10, concurrency = 5, includeDetails = false, includePosts = false } = options;

  if (!userIds || userIds.length === 0) {
    return [];
  }

  // Разбиваем на пакеты
  const batches = [];
  for (let i = 0; i < userIds.length; i += batchSize) {
    batches.push(userIds.slice(i, i + batchSize));
  }

  // Обрабатываем пакеты с ограничением параллелизма
  const results = await parallel(
    batches.map(batch => async () => {
      if (includeDetails && includePosts) {
        return await Promise.all(batch.map(id => fetchUserWithDetails(id, true)));
      } else if (includeDetails) {
        return await Promise.all(batch.map(id => fetchUserWithDetails(id)));
      } else if (includePosts) {
        return await Promise.all(batch.map(id => fetchUserWithPosts(id)));
      } else {
        return await Promise.all(batch.map(id => fetchUser(id)));
      }
    }),
    { concurrency }
  );

  // Объединяем результаты
  return results.flat();
}

/**
 * Сложный пайплайн обработки данных
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции пайплайна
 * @param {number} options.cacheTTL - Время жизни кэша
 * @param {number} options.timeout - Таймаут
 * @param {Array} options.stages - Этапы обработки
 * @returns {Promise<any>} - Promise с результатом
 */
async function dataPipeline(url, options = {}) {
  const { cacheTTL = 30000, timeout: timeoutMs = 10000, stages = [] } = options;

  const cacheKey = `pipeline_${url}`;

  // Проверяем кэш
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  // Выполняем пайплайн
  const result = await composeAsyncOperations(url, [
    // Этап 1: Получение данных с таймаутом
    async data => {
      if (timeoutMs) {
        return await fetchWithTimeout(data, timeoutMs);
      }
      return await fetchData(data);
    },

    // Этап 2: Базовый процессинг
    async data => {
      return await processData(data);
    },

    // Этап 3: Применение пользовательских этапов
    ...stages,

    // Этап 4: Финальная трансформация
    async data => {
      return await transformWithWorker(data);
    },
  ]);

  // Сохраняем в кэш
  await cacheSet(cacheKey, result, cacheTTL);

  return result;
}

/**
 * Асинхронный поиск и фильтрация данных
 * @param {string} query - Поисковый запрос
 * @param {Object} options - Опции поиска
 * @param {string} options.type - Тип поиска (users, posts, comments)
 * @param {number} options.limit - Лимит результатов
 * @param {number} options.offset - Смещение
 * @param {string} options.sort - Поле для сортировки
 * @param {string} options.order - Порядок сортировки (asc, desc)
 * @returns {Promise<Object>} - Promise с результатами поиска
 */
async function searchAndFilter(query, options = {}) {
  const { type = 'users', limit = 20, offset = 0, sort = 'id', order = 'asc' } = options;

  // Выполняем поиск в зависимости от типа
  let results = [];

  switch (type) {
    case 'users':
      results = await searchUsers(query, { limit, offset });
      break;
    case 'posts':
      // Имитация поиска постов
      const posts = await fetchData(`/api/posts?q=${query}&limit=${limit}&offset=${offset}`);
      results = posts;
      break;
    case 'comments':
      // Имитация поиска комментариев
      const comments = await fetchData(`/api/comments?q=${query}&limit=${limit}&offset=${offset}`);
      results = comments;
      break;
    default:
      throw new Error(`Unknown search type: ${type}`);
  }

  // Сортировка результатов
  if (sort) {
    results.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];
      if (order === 'desc') {
        return bVal < aVal ? -1 : 1;
      }
      return aVal < bVal ? -1 : 1;
    });
  }

  return {
    results,
    total: results.length,
    limit,
    offset,
    query,
  };
}

/**
 * Асинхронная синхронизация данных
 * @param {Object} source - Источник данных
 * @param {Object} target - Целевой объект
 * @param {Object} options - Опции синхронизации
 * @param {Array<string>} options.fields - Поля для синхронизации
 * @param {boolean} options.merge - Объединять или заменять
 * @param {Function} options.transform - Функция трансформации
 * @returns {Promise<Object>} - Promise с синхронизированными данными
 */
async function syncData(source, target, options = {}) {
  const { fields = null, merge = true, transform = null } = options;

  // Получаем исходные данные
  const sourceData = typeof source === 'function' ? await source() : source;
  const targetData = typeof target === 'function' ? await target() : target;

  let result = { ...targetData };

  if (fields) {
    // Синхронизируем только указанные поля
    for (const field of fields) {
      if (sourceData[field] !== undefined) {
        let value = sourceData[field];
        if (transform) {
          value = await transform(value, field);
        }
        result[field] = value;
      }
    }
  } else if (merge) {
    // Объединяем все поля
    for (const [key, value] of Object.entries(sourceData)) {
      let transformedValue = value;
      if (transform) {
        transformedValue = await transform(value, key);
      }
      result[key] = transformedValue;
    }
  } else {
    // Заменяем все поля
    result = { ...sourceData };
    if (transform) {
      for (const [key, value] of Object.entries(result)) {
        result[key] = await transform(value, key);
      }
    }
  }

  return result;
}

/**
 * Асинхронный мониторинг с уведомлениями
 * @param {string} url - URL для мониторинга
 * @param {Object} options - Опции мониторинга
 * @param {number} options.interval - Интервал проверки в мс
 * @param {number} options.timeout - Таймаут в мс
 * @param {Function} options.onChange - Колбэк при изменении
 * @param {Function} options.onError - Колбэк при ошибке
 * @returns {Object} - Объект с методами управления мониторингом
 */
function createMonitor(url, options = {}) {
  const { interval = 5000, timeout: timeoutMs = 30000, onChange = null, onError = null } = options;

  let isRunning = false;
  let timer = null;
  let lastData = null;

  async function check() {
    try {
      const data = await fetchWithTimeout(url, timeoutMs);
      if (JSON.stringify(data) !== JSON.stringify(lastData)) {
        lastData = data;
        if (onChange) {
          await onChange(data);
        }
      }
      return data;
    } catch (error) {
      if (onError) {
        await onError(error);
      }
      throw error;
    }
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    check(); // Первоначальная проверка
    timer = setInterval(check, interval);
    return {
      stop: stop,
      pause: pause,
      resume: resume,
      check: check,
    };
  }

  function stop() {
    isRunning = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function pause() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function resume() {
    if (isRunning && !timer) {
      timer = setInterval(check, interval);
    }
  }

  return {
    start,
    stop,
    pause,
    resume,
    check,
    isRunning: () => isRunning,
  };
}

// ============================================
// ЭКСПОРТЫ
// ============================================

// Экспорт базовых операций
export { fetchData, fetchWithTimeout, fetchWithRetry, fetchWithAbort, fetchWithCache };

// Экспорт операций обработки
export {
  processData,
  processSequential,
  processBatch,
  transformWithWorker,
  composeAsyncOperations,
  processStream,
};

// Экспорт операций с пользователями
export {
  fetchUser,
  fetchMultiple,
  fetchUserWithDetails,
  fetchUserWithPosts,
  fetchUsersByRole,
  searchUsers,
};

// Экспорт операций с кэшем
export { cacheGet, cacheSet, cacheDelete, cacheClear, cacheHas, cacheStats, withCache };

// Экспорт асинхронных утилит
export {
  sleep,
  retry,
  timeout,
  debounce,
  throttle,
  rateLimit,
  batch,
  parallel,
  sequential,
  race,
  allSettled,
  any,
  mapAsync,
  filterAsync,
  reduceAsync,
  forEachAsync,
};

// Экспорт комбинированных операций
export {
  fetchAndProcess,
  processUsersBatch,
  dataPipeline,
  searchAndFilter,
  syncData,
  createMonitor,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с асинхронными операциями
 */
export default {
  // Базовые операции
  fetchData,
  fetchWithTimeout,
  fetchWithRetry,
  fetchWithAbort,
  fetchWithCache,

  // Обработка
  processData,
  processSequential,
  processBatch,
  transformWithWorker,
  composeAsyncOperations,
  processStream,

  // Пользователи
  fetchUser,
  fetchMultiple,
  fetchUserWithDetails,
  fetchUserWithPosts,
  fetchUsersByRole,
  searchUsers,

  // Кэш
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheClear,
  cacheHas,
  cacheStats,
  withCache,

  // Утилиты
  sleep,
  retry,
  timeout,
  debounce,
  throttle,
  rateLimit,
  batch,
  parallel,
  sequential,
  race,
  allSettled,
  any,
  mapAsync,
  filterAsync,
  reduceAsync,
  forEachAsync,

  // Комбинированные
  fetchAndProcess,
  processUsersBatch,
  dataPipeline,
  searchAndFilter,
  syncData,
  createMonitor,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. fetch.js - Модуль базовых fetch-операций:
 *    - fetchData - базовый async/await
 *    - fetchWithTimeout - с таймаутом
 *    - fetchWithRetry - с повторными попытками
 *    - fetchWithAbort - с отменой
 *    - fetchWithCache - с кэшированием
 *
 * 2. process.js - Модуль обработки данных:
 *    - processData - маппинг данных
 *    - processSequential - последовательная обработка
 *    - processBatch - пакетная обработка
 *    - transformWithWorker - имитация Web Worker
 *    - composeAsyncOperations - композиция функций
 *    - processStream - обработка потока
 *
 * 3. user.js - Модуль работы с пользователями:
 *    - fetchUser - получение пользователя
 *    - fetchMultiple - получение нескольких
 *    - fetchUserWithDetails - с деталями
 *    - fetchUserWithPosts - с постами
 *    - fetchUsersByRole - по роли
 *    - searchUsers - поиск
 *
 * 4. cache.js - Модуль кэширования:
 *    - cacheGet - получение из кэша
 *    - cacheSet - сохранение в кэш
 *    - cacheDelete - удаление из кэша
 *    - cacheClear - очистка кэша
 *    - cacheHas - проверка наличия
 *    - cacheStats - статистика кэша
 *    - withCache - декоратор кэширования
 *
 * 5. async-utils.js - Асинхронные утилиты:
 *    - sleep - задержка
 *    - retry - повторные попытки
 *    - timeout - таймаут
 *    - debounce - дебаунс
 *    - throttle - троттлинг
 *    - rateLimit - ограничение скорости
 *    - batch - пакетирование
 *    - parallel - параллельное выполнение
 *    - sequential - последовательное выполнение
 *    - race - гонка промисов
 *    - allSettled - все промисы
 *    - any - любой промис
 *    - mapAsync - асинхронный map
 *    - filterAsync - асинхронный filter
 *    - reduceAsync - асинхронный reduce
 *    - forEachAsync - асинхронный forEach
 *
 * 6. Комбинированные операции в index.js:
 *    - fetchAndProcess - получение с обработкой
 *    - processUsersBatch - пакетная обработка пользователей
 *    - dataPipeline - сложный пайплайн
 *    - searchAndFilter - поиск с фильтрацией
 *    - syncData - синхронизация данных
 *    - createMonitor - мониторинг с уведомлениями
 *
 * Все модули импортируются и реэкспортируются для сохранения API.
 * Добавлены JSDoc комментарии для всех функций.
 * Сохранена обратная совместимость через реэкспорты.
 */
