// packages/ast-analyzer/src/formal/__tests__/fixtures/original/06-async-operations.js

// ============================================
// АСИНХРОННЫЕ ОПЕРАЦИИ - ОРИГИНАЛЬНЫЙ ФАЙЛ
// ============================================
// Этот файл содержит различные асинхронные функции,
// которые будут рефакториться в модули

/**
 * Базовый fetch данных с использованием async/await
 * @param {string} url - URL для запроса
 * @returns {Promise<Object>} - Promise с данными в формате JSON
 */
async function fetchData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Обработка данных с маппингом значений
 * @param {string} url - URL для запроса
 * @returns {Promise<Array>} - Promise с массивом обработанных данных
 */
async function processData(url) {
  const data = await fetchData(url);
  return data.map(item => ({
    ...item,
    value: item.value * 2,
    processed: true,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Получение данных пользователя с использованием Promise.then
 * @param {number} id - ID пользователя
 * @returns {Promise<Object>} - Promise с данными пользователя
 */
function fetchUser(id) {
  return fetch(`/api/users/${id}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to fetch user ${id}`);
      }
      return res.json();
    })
    .then(user => ({
      ...user,
      processed: true,
      fetchedAt: new Date().toISOString(),
    }))
    .catch(error => {
      console.error(`Error fetching user ${id}:`, error);
      throw error;
    });
}

/**
 * Получение нескольких пользователей параллельно
 * @param {Array<number>} ids - Массив ID пользователей
 * @returns {Promise<Array>} - Promise с массивом данных пользователей
 */
async function fetchMultiple(ids) {
  if (!ids || ids.length === 0) {
    return [];
  }

  const promises = ids.map(id => fetchUser(id));
  const results = await Promise.allSettled(promises);

  return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}

/**
 * Получение данных с таймаутом
 * @param {string} url - URL для запроса
 * @param {number} timeoutMs - Таймаут в миллисекундах
 * @returns {Promise<Object>} - Promise с данными или ошибкой таймаута
 */
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Последовательная обработка данных с задержкой
 * @param {Array} items - Массив элементов для обработки
 * @param {number} delayMs - Задержка между операциями
 * @returns {Promise<Array>} - Promise с массивом обработанных данных
 */
async function processSequential(items, delayMs = 100) {
  const results = [];

  for (const item of items) {
    // Имитация асинхронной операции
    await new Promise(resolve => setTimeout(resolve, delayMs));

    const processed = {
      ...item,
      processed: true,
      processedAt: new Date().toISOString(),
    };
    results.push(processed);
  }

  return results;
}

/**
 * Пакетная обработка данных с параллельными запросами
 * @param {Array} items - Массив элементов для обработки
 * @param {number} batchSize - Размер пакета
 * @returns {Promise<Array>} - Promise с массивом обработанных данных
 */
async function processBatch(items, batchSize = 5) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async item => {
      // Имитация асинхронной операции
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        ...item,
        processed: true,
        batch: Math.floor(i / batchSize) + 1,
        processedAt: new Date().toISOString(),
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Обработка данных с повторными попытками при ошибке
 * @param {string} url - URL для запроса
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} delayMs - Задержка между попытками
 * @returns {Promise<Object>} - Promise с данными или ошибкой
 */
async function fetchWithRetry(url, maxRetries = 3, delayMs = 1000) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        // Экспоненциальная задержка
        const exponentialDelay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, exponentialDelay));
      }
    }
  }

  throw new Error(
    `All ${maxRetries} attempts failed. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Трансформация данных с использованием Web Workers (имитация)
 * @param {Array} data - Данные для трансформации
 * @returns {Promise<Array>} - Promise с трансформированными данными
 */
async function transformWithWorker(data) {
  // Имитация работы с Web Worker
  return new Promise(resolve => {
    setTimeout(() => {
      const transformed = data.map(item => ({
        ...item,
        transformed: true,
        transformTime: new Date().toISOString(),
      }));
      resolve(transformed);
    }, 200);
  });
}

/**
 * Композиция асинхронных операций
 * @param {string} url - URL для запроса
 * @param {Array} transformers - Массив функций-трансформеров
 * @returns {Promise<any>} - Promise с конечным результатом
 */
async function composeAsyncOperations(url, transformers = []) {
  let result = await fetchData(url);

  for (const transformer of transformers) {
    if (typeof transformer === 'function') {
      result = await transformer(result);
    }
  }

  return result;
}

/**
 * Обработка потока данных с использованием async iterator
 * @param {string} url - URL для запроса
 * @returns {Promise<Array>} - Promise с массивом данных
 */
async function processStream(url) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const results = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        results.push({
          ...data,
          streamed: true,
          receivedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Failed to parse stream line:', line);
      }
    }
  }

  return results;
}

/**
 * Кэширование асинхронных результатов
 * @param {string} url - URL для запроса
 * @param {number} ttlMs - Время жизни кэша в миллисекундах
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchWithCache(url, ttlMs = 60000) {
  const cacheKey = `cache_${url}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < ttlMs) {
        console.log(`Cache hit for ${url}`);
        return data;
      }
    } catch (e) {
      console.warn('Invalid cache data:', e);
    }
  }

  console.log(`Cache miss for ${url}`);
  const data = await fetchData(url);

  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn('Failed to cache data:', e);
  }

  return data;
}

/**
 * Асинхронная функция с использованием AbortController
 * @param {string} url - URL для запроса
 * @param {AbortSignal} signal - Сигнал для отмены
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchWithAbort(url, signal) {
  if (signal && signal.aborted) {
    throw new Error('Request aborted');
  }

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request was aborted');
    }
    throw error;
  }
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  fetchData,
  processData,
  fetchUser,
  fetchMultiple,
  fetchWithTimeout,
  processSequential,
  processBatch,
  fetchWithRetry,
  transformWithWorker,
  composeAsyncOperations,
  processStream,
  fetchWithCache,
  fetchWithAbort,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * Этот файл содержит 13 асинхронных функций для тестирования:
 * 1. fetchData - базовый async/await
 * 2. processData - маппинг данных
 * 3. fetchUser - Promise.then
 * 4. fetchMultiple - Promise.allSettled
 * 5. fetchWithTimeout - AbortController с таймаутом
 * 6. processSequential - последовательная обработка
 * 7. processBatch - пакетная обработка
 * 8. fetchWithRetry - повторные попытки
 * 9. transformWithWorker - имитация Web Worker
 * 10. composeAsyncOperations - композиция функций
 * 11. processStream - обработка потока
 * 12. fetchWithCache - кэширование
 * 13. fetchWithAbort - отмена запроса
 */
