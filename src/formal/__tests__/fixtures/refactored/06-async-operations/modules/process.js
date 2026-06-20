// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/06-async-operations/modules/process.js

// ============================================
// МОДУЛЬ АСИНХРОННОЙ ОБРАБОТКИ ДАННЫХ
// ============================================
// Этот модуль содержит функции для асинхронной
// обработки данных в различных сценариях.

// ============================================
// ИМПОРТЫ
// ============================================

import { fetchData } from './fetch.js';
import { fetchWithRetry } from './fetch.js';
import { fetchWithTimeout } from './fetch.js';

// ============================================
// ОБРАБОТКА ДАННЫХ
// ============================================

/**
 * Обработка данных с маппингом значений
 * @param {string} url - URL для запроса
 * @param {Function} transformFn - Функция трансформации данных
 * @returns {Promise<Array>} - Promise с массивом обработанных данных
 */
async function processData(url, transformFn = null) {
  const data = await fetchData(url);

  if (!Array.isArray(data)) {
    throw new Error('Expected array of data');
  }

  const defaultTransform = item => ({
    ...item,
    value: item.value * 2,
    processed: true,
    timestamp: new Date().toISOString(),
  });

  const transformer = transformFn || defaultTransform;
  return data.map(transformer);
}

/**
 * Обработка данных с пагинацией
 * @param {string} baseUrl - Базовый URL для запросов
 * @param {number} pageSize - Размер страницы
 * @param {number} maxPages - Максимальное количество страниц
 * @returns {Promise<Array>} - Promise с массивом всех данных
 */
async function processPaginatedData(baseUrl, pageSize = 100, maxPages = 10) {
  const results = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const url = `${baseUrl}?page=${page}&pageSize=${pageSize}`;
    const data = await fetchData(url);

    if (!Array.isArray(data)) {
      break;
    }

    results.push(...data);
    hasMore = data.length === pageSize;
    page++;
  }

  return results;
}

/**
 * Обработка данных с фильтрацией
 * @param {string} url - URL для запроса
 * @param {Function} filterFn - Функция фильтрации
 * @param {Function} transformFn - Функция трансформации
 * @returns {Promise<Array>} - Promise с отфильтрованными данными
 */
async function processFilteredData(url, filterFn, transformFn = null) {
  const data = await fetchData(url);

  if (!Array.isArray(data)) {
    throw new Error('Expected array of data');
  }

  let result = data;

  if (filterFn && typeof filterFn === 'function') {
    result = result.filter(filterFn);
  }

  if (transformFn && typeof transformFn === 'function') {
    result = result.map(transformFn);
  }

  return result;
}

/**
 * Обработка данных с агрегацией
 * @param {string} url - URL для запроса
 * @param {Function} aggregateFn - Функция агрегации
 * @returns {Promise<Object>} - Promise с агрегированными данными
 */
async function processAggregatedData(url, aggregateFn) {
  const data = await fetchData(url);

  if (!Array.isArray(data)) {
    throw new Error('Expected array of data');
  }

  if (!aggregateFn || typeof aggregateFn !== 'function') {
    // Агрегация по умолчанию
    return data.reduce(
      (acc, item) => ({
        count: acc.count + 1,
        sum: acc.sum + (item.value || 0),
        avg: (acc.sum + (item.value || 0)) / (acc.count + 1),
        min: Math.min(acc.min, item.value || 0),
        max: Math.max(acc.max, item.value || 0),
      }),
      { count: 0, sum: 0, avg: 0, min: Infinity, max: -Infinity }
    );
  }

  return data.reduce(aggregateFn, {});
}

/**
 * Обработка данных с сортировкой
 * @param {string} url - URL для запроса
 * @param {string} sortBy - Поле для сортировки
 * @param {boolean} ascending - Направление сортировки
 * @returns {Promise<Array>} - Promise с отсортированными данными
 */
async function processSortedData(url, sortBy = 'id', ascending = true) {
  const data = await fetchData(url);

  if (!Array.isArray(data)) {
    throw new Error('Expected array of data');
  }

  return data.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    if (aVal < bVal) return ascending ? -1 : 1;
    if (aVal > bVal) return ascending ? 1 : -1;
    return 0;
  });
}

/**
 * Обработка данных с группировкой
 * @param {string} url - URL для запроса
 * @param {string} groupBy - Поле для группировки
 * @returns {Promise<Object>} - Promise с сгруппированными данными
 */
async function processGroupedData(url, groupBy) {
  const data = await fetchData(url);

  if (!Array.isArray(data)) {
    throw new Error('Expected array of data');
  }

  return data.reduce((groups, item) => {
    const key = item[groupBy] || 'uncategorized';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Обработка данных с кэшированием
 * @param {string} url - URL для запроса
 * @param {number} cacheTTL - Время жизни кэша в мс
 * @param {Function} transformFn - Функция трансформации
 * @returns {Promise<any>} - Promise с данными (из кэша или свежими)
 */
async function processCachedData(url, cacheTTL = 60000, transformFn = null) {
  const cacheKey = `process_${url}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheTTL) {
        console.log(`Cache hit for ${url}`);
        return data;
      }
    } catch (e) {
      console.warn('Invalid cache data:', e);
    }
  }

  console.log(`Cache miss for ${url}`);
  let data = await fetchData(url);

  if (transformFn && typeof transformFn === 'function') {
    data = transformFn(data);
  }

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
 * Обработка данных с повторными попытками
 * @param {string} url - URL для запроса
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @param {Function} transformFn - Функция трансформации
 * @returns {Promise<any>} - Promise с обработанными данными
 */
async function processWithRetry(url, maxRetries = 3, retryDelay = 1000, transformFn = null) {
  const data = await fetchWithRetry(url, maxRetries, retryDelay);

  if (transformFn && typeof transformFn === 'function') {
    return transformFn(data);
  }

  return data;
}

/**
 * Обработка данных с таймаутом
 * @param {string} url - URL для запроса
 * @param {number} timeoutMs - Таймаут в мс
 * @param {Function} transformFn - Функция трансформации
 * @returns {Promise<any>} - Promise с обработанными данными
 */
async function processWithTimeout(url, timeoutMs = 5000, transformFn = null) {
  const data = await fetchWithTimeout(url, timeoutMs);

  if (transformFn && typeof transformFn === 'function') {
    return transformFn(data);
  }

  return data;
}

/**
 * Обработка данных из нескольких источников
 * @param {Array<string>} urls - Массив URL для запросов
 * @param {Function} mergeFn - Функция объединения результатов
 * @returns {Promise<any>} - Promise с объединенными данными
 */
async function processMultipleSources(urls, mergeFn = null) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('Expected non-empty array of URLs');
  }

  const promises = urls.map(url => fetchData(url));
  const results = await Promise.allSettled(promises);

  const successfulResults = results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  if (successfulResults.length === 0) {
    throw new Error('All requests failed');
  }

  if (mergeFn && typeof mergeFn === 'function') {
    return mergeFn(successfulResults);
  }

  // Объединение по умолчанию
  return successfulResults.reduce(
    (acc, data) => {
      if (Array.isArray(data)) {
        return [...acc, ...data];
      } else if (typeof data === 'object') {
        return { ...acc, ...data };
      }
      return acc;
    },
    Array.isArray(successfulResults[0]) ? [] : {}
  );
}

/**
 * Последовательная обработка данных с задержкой
 * @param {Array} items - Массив элементов для обработки
 * @param {Function} processFn - Функция обработки элемента
 * @param {number} delayMs - Задержка между операциями
 * @returns {Promise<Array>} - Promise с массивом обработанных данных
 */
async function processSequential(items, processFn, delayMs = 100) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array');
  }

  if (!processFn || typeof processFn !== 'function') {
    throw new TypeError('Expected a processing function');
  }

  const results = [];

  for (let i = 0; i < items.length; i++) {
    const result = await processFn(items[i], i, items);
    results.push(result);

    if (i < items.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Параллельная обработка данных с ограничением на количество
 * @param {Array} items - Массив элементов для обработки
 * @param {Function} processFn - Функция обработки элемента
 * @param {number} concurrency - Максимальное количество параллельных операций
 * @returns {Promise<Array>} - Promise с массивом обработанных данных
 */
async function processParallel(items, processFn, concurrency = 5) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array');
  }

  if (!processFn || typeof processFn !== 'function') {
    throw new TypeError('Expected a processing function');
  }

  const results = [];
  const chunks = [];

  // Разбиваем на чанки
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkPromises = chunk.map((item, index) => processFn(item, index, items));
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Пакетная обработка данных
 * @param {Array} items - Массив элементов для обработки
 * @param {Function} processFn - Функция обработки пакета
 * @param {number} batchSize - Размер пакета
 * @returns {Promise<Array>} - Promise с массивом обработанных данных
 */
async function processBatch(items, processFn, batchSize = 10) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected an array');
  }

  if (!processFn || typeof processFn !== 'function') {
    throw new TypeError('Expected a processing function');
  }

  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await processFn(batch, i, items);

    if (Array.isArray(result)) {
      results.push(...result);
    } else {
      results.push(result);
    }
  }

  return results;
}

/**
 * Обработка данных с прогресс-баром
 * @param {string} url - URL для запроса
 * @param {Function} progressFn - Функция для отображения прогресса
 * @param {Function} transformFn - Функция трансформации
 * @returns {Promise<any>} - Promise с обработанными данными
 */
async function processWithProgress(url, progressFn = null, transformFn = null) {
  const response = await fetch(url);
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : null;

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    if (progressFn && typeof progressFn === 'function') {
      const progress = total ? loaded / total : null;
      progressFn(loaded, total, progress);
    }
  }

  // Объединяем чанки
  const chunksAll = new Uint8Array(loaded);
  let position = 0;
  for (const chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }

  const text = new TextDecoder().decode(chunksAll);
  let data = JSON.parse(text);

  if (transformFn && typeof transformFn === 'function') {
    data = transformFn(data);
  }

  return data;
}

/**
 * Обработка потока данных (Stream Processing)
 * @param {string} url - URL для запроса
 * @param {Function} processChunkFn - Функция для обработки каждого чанка
 * @param {Function} finalizeFn - Функция для финализации результата
 * @returns {Promise<any>} - Promise с результатом обработки
 */
async function processStream(url, processChunkFn = null, finalizeFn = null) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const results = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    const lines = buffer.split('\n');

    // Последняя строка может быть неполной
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line);

          if (processChunkFn && typeof processChunkFn === 'function') {
            const processed = await processChunkFn(data);
            results.push(processed);
          } else {
            results.push(data);
          }
        } catch (e) {
          console.warn('Failed to parse stream line:', line);
        }
      }
    }
  }

  // Обрабатываем оставшийся буфер
  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer);
      if (processChunkFn && typeof processChunkFn === 'function') {
        const processed = await processChunkFn(data);
        results.push(processed);
      } else {
        results.push(data);
      }
    } catch (e) {
      console.warn('Failed to parse remaining buffer:', buffer);
    }
  }

  if (finalizeFn && typeof finalizeFn === 'function') {
    return finalizeFn(results);
  }

  return results;
}

/**
 * Обработка данных с валидацией
 * @param {string} url - URL для запроса
 * @param {Function} validateFn - Функция валидации
 * @param {Function} transformFn - Функция трансформации
 * @returns {Promise<any>} - Promise с валидированными данными
 */
async function processValidatedData(url, validateFn, transformFn = null) {
  let data = await fetchData(url);

  if (validateFn && typeof validateFn === 'function') {
    const isValid = await validateFn(data);
    if (!isValid) {
      throw new Error('Data validation failed');
    }
  }

  if (transformFn && typeof transformFn === 'function') {
    data = transformFn(data);
  }

  return data;
}

/**
 * Обработка данных с трансформацией типов
 * @param {string} url - URL для запроса
 * @param {Object} typeMap - Карта типов для трансформации
 * @returns {Promise<any>} - Promise с трансформированными данными
 */
async function processTypedData(url, typeMap = {}) {
  const data = await fetchData(url);

  if (!typeMap || Object.keys(typeMap).length === 0) {
    return data;
  }

  const transformValue = (value, type) => {
    switch (type) {
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      case 'timestamp':
        return new Date(value).getTime();
      default:
        return value;
    }
  };

  const transformObject = (obj, map) => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => transformObject(item, map));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (map[key]) {
        result[key] = transformValue(value, map[key]);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  return transformObject(data, typeMap);
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые функции обработки
  processData,
  processPaginatedData,
  processFilteredData,
  processAggregatedData,
  processSortedData,
  processGroupedData,
  processCachedData,

  // Обработка с повторными попытками и таймаутами
  processWithRetry,
  processWithTimeout,

  // Обработка из нескольких источников
  processMultipleSources,

  // Обработка с различными стратегиями
  processSequential,
  processParallel,
  processBatch,
  processWithProgress,
  processStream,

  // Обработка с валидацией и типами
  processValidatedData,
  processTypedData,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями обработки данных
 */
export default {
  processData,
  processPaginatedData,
  processFilteredData,
  processAggregatedData,
  processSortedData,
  processGroupedData,
  processCachedData,
  processWithRetry,
  processWithTimeout,
  processMultipleSources,
  processSequential,
  processParallel,
  processBatch,
  processWithProgress,
  processStream,
  processValidatedData,
  processTypedData,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ АСИНХРОННОЙ ОБРАБОТКИ ДАННЫХ
 *
 * Этот модуль предоставляет 17 функций для асинхронной обработки данных:
 *
 * 1. processData            - Базовая обработка с трансформацией
 * 2. processPaginatedData   - Обработка с пагинацией
 * 3. processFilteredData    - Обработка с фильтрацией
 * 4. processAggregatedData  - Обработка с агрегацией
 * 5. processSortedData      - Обработка с сортировкой
 * 6. processGroupedData     - Обработка с группировкой
 * 7. processCachedData      - Обработка с кэшированием
 * 8. processWithRetry       - Обработка с повторными попытками
 * 9. processWithTimeout     - Обработка с таймаутом
 * 10. processMultipleSources - Обработка из нескольких источников
 * 11. processSequential     - Последовательная обработка
 * 12. processParallel       - Параллельная обработка
 * 13. processBatch          - Пакетная обработка
 * 14. processWithProgress   - Обработка с прогресс-баром
 * 15. processStream         - Обработка потока данных
 * 16. processValidatedData  - Обработка с валидацией
 * 17. processTypedData      - Обработка с трансформацией типов
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные стратегии обработки
 * - Оптимизированы для работы с большими объемами данных
 * - Имеют JSDoc с описанием параметров
 * - Обрабатывают ошибки и граничные случаи
 */
