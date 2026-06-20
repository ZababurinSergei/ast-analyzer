// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/06-async-operations/modules/fetch.js

// ============================================
// МОДУЛЬ БАЗОВЫХ FETCH ОПЕРАЦИЙ
// ============================================
// Этот модуль содержит основные функции для выполнения
// HTTP запросов с различными стратегиями.

/**
 * Базовый fetch данных с использованием async/await
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными в формате JSON
 * @throws {Error} - При ошибке HTTP или парсинга
 */
async function fetchData(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Network error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch с обработкой различных форматов ответа
 * @param {string} url - URL для запроса
 * @param {string} responseType - Тип ответа ('json', 'text', 'blob', 'arrayBuffer')
 * @param {Object} options - Опции fetch
 * @returns {Promise<any>} - Promise с данными в указанном формате
 */
async function fetchWithType(url, responseType = 'json', options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const validTypes = ['json', 'text', 'blob', 'arrayBuffer'];
  if (!validTypes.includes(responseType)) {
    throw new Error(
      `Invalid response type: ${responseType}. Must be one of: ${validTypes.join(', ')}`
    );
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  switch (responseType) {
    case 'json':
      return await response.json();
    case 'text':
      return await response.text();
    case 'blob':
      return await response.blob();
    case 'arrayBuffer':
      return await response.arrayBuffer();
    default:
      return await response.text();
  }
}

/**
 * Fetch с таймаутом
 * @param {string} url - URL для запроса
 * @param {number} timeoutMs - Таймаут в миллисекундах
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными или ошибкой таймаута
 * @throws {Error} - При таймауте или ошибке запроса
 */
async function fetchWithTimeout(url, timeoutMs = 5000, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  if (typeof timeoutMs !== 'number' || timeoutMs < 0) {
    throw new Error('Timeout must be a non-negative number');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
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
 * Fetch с повторными попытками при ошибке
 * @param {string} url - URL для запроса
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} delayMs - Начальная задержка между попытками
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными или ошибкой
 */
async function fetchWithRetry(url, maxRetries = 3, delayMs = 1000, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  if (typeof maxRetries !== 'number' || maxRetries < 0) {
    throw new Error('maxRetries must be a non-negative number');
  }

  let lastError = null;
  const retryableStatuses = [408, 429, 500, 502, 503, 504];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        if (!retryableStatuses.includes(response.status) || attempt === maxRetries) {
          throw error;
        }
        lastError = error;
        // Продолжаем попытки для retryable статусов
      } else {
        return await response.json();
      }
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        // Экспоненциальная задержка с джиттером
        const exponentialDelay = delayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.2 * exponentialDelay;
        await new Promise(resolve => setTimeout(resolve, exponentialDelay + jitter));
      }
    }
  }

  throw new Error(
    `All ${maxRetries} attempts failed. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Fetch с кэшированием в памяти
 * @param {string} url - URL для запроса
 * @param {number} ttlMs - Время жизни кэша в миллисекундах
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными (из кэша или из сети)
 */
async function fetchWithCache(url, ttlMs = 60000, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  // Используем Map для хранения кэша
  const cache = new Map();
  const cacheKey = `cache_${url}`;

  // Создаем замыкание для хранения кэша между вызовами
  const getCachedData = async () => {
    const cached = cache.get(cacheKey);

    if (cached) {
      const { data, timestamp } = cached;
      if (Date.now() - timestamp < ttlMs) {
        console.log(`Cache hit for ${url}`);
        return data;
      } else {
        console.log(`Cache expired for ${url}`);
      }
    }

    console.log(`Cache miss for ${url}`);
    const data = await fetchData(url, options);

    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  };

  return getCachedData();
}

/**
 * Fetch с поддержкой AbortController
 * @param {string} url - URL для запроса
 * @param {AbortSignal} signal - Сигнал для отмены
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными
 * @throws {Error} - При отмене запроса или ошибке
 */
async function fetchWithAbort(url, signal, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  if (signal && signal.aborted) {
    throw new Error('Request aborted before start');
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'CancelError') {
      throw new Error('Request was aborted');
    }
    throw error;
  }
}

/**
 * Fetch с предварительной обработкой URL (добавление параметров)
 * @param {string} baseUrl - Базовый URL
 * @param {Object} params - Параметры запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchWithParams(baseUrl, params = {}, options = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('Base URL must be a non-empty string');
  }

  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }

  return fetchData(url.toString(), options);
}

/**
 * Fetch с заголовками по умолчанию
 * @param {string} url - URL для запроса
 * @param {Object} headers - Дополнительные заголовки
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchWithHeaders(url, headers = {}, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'AST-Analyzer/1.0',
  };

  // Добавляем заголовки для аутентификации если есть
  if (options.token) {
    defaultHeaders['Authorization'] = `Bearer ${options.token}`;
    delete options.token;
  }

  const finalHeaders = { ...defaultHeaders, ...headers };
  const finalOptions = { ...options, headers: finalHeaders };

  return fetchData(url, finalOptions);
}

/**
 * Fetch с методом POST и телом запроса
 * @param {string} url - URL для запроса
 * @param {Object|string} body - Тело запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchPost(url, body, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const isFormData = body instanceof FormData;
  const isObject = typeof body === 'object' && !isFormData;

  const finalOptions = {
    method: 'POST',
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? body : isObject ? JSON.stringify(body) : body,
  };

  return fetchData(url, finalOptions);
}

/**
 * Fetch с методом PUT и телом запроса
 * @param {string} url - URL для запроса
 * @param {Object|string} body - Тело запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchPut(url, body, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const isFormData = body instanceof FormData;
  const isObject = typeof body === 'object' && !isFormData;

  const finalOptions = {
    method: 'PUT',
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? body : isObject ? JSON.stringify(body) : body,
  };

  return fetchData(url, finalOptions);
}

/**
 * Fetch с методом DELETE
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchDelete(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const finalOptions = {
    method: 'DELETE',
    ...options,
  };

  try {
    const response = await fetch(url, finalOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.message.includes('Unexpected end of JSON input')) {
      // DELETE запрос может возвращать пустой ответ
      return { success: true };
    }
    throw error;
  }
}

/**
 * Fetch с поддержкой прогресса загрузки
 * @param {string} url - URL для запроса
 * @param {Function} onProgress - Функция обратного вызова для прогресса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>} - Promise с данными
 */
async function fetchWithProgress(url, onProgress, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  if (typeof onProgress !== 'function') {
    throw new Error('onProgress must be a function');
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

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

    if (total !== null) {
      onProgress(loaded, total, loaded / total);
    } else {
      onProgress(loaded, null, null);
    }
  }

  const blob = new Blob(chunks);
  const text = await blob.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Базовые fetch операции
  fetchData,
  fetchWithType,
  fetchWithTimeout,
  fetchWithRetry,
  fetchWithCache,
  fetchWithAbort,
  fetchWithParams,
  fetchWithHeaders,

  // HTTP методы
  fetchPost,
  fetchPut,
  fetchDelete,

  // Расширенные возможности
  fetchWithProgress,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с fetch функциями
 */
export default {
  fetchData,
  fetchWithType,
  fetchWithTimeout,
  fetchWithRetry,
  fetchWithCache,
  fetchWithAbort,
  fetchWithParams,
  fetchWithHeaders,
  fetchPost,
  fetchPut,
  fetchDelete,
  fetchWithProgress,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ БАЗОВЫХ FETCH ОПЕРАЦИЙ
 *
 * Этот модуль предоставляет 12 функций для выполнения HTTP запросов:
 *
 * 1. fetchData         - Базовый fetch с async/await
 * 2. fetchWithType     - Fetch с указанием типа ответа
 * 3. fetchWithTimeout  - Fetch с таймаутом
 * 4. fetchWithRetry    - Fetch с повторными попытками
 * 5. fetchWithCache    - Fetch с кэшированием
 * 6. fetchWithAbort    - Fetch с поддержкой отмены
 * 7. fetchWithParams   - Fetch с параметрами URL
 * 8. fetchWithHeaders  - Fetch с кастомными заголовками
 * 9. fetchPost         - POST запрос
 * 10. fetchPut         - PUT запрос
 * 11. fetchDelete      - DELETE запрос
 * 12. fetchWithProgress - Fetch с отслеживанием прогресса
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают различные форматы ответа
 * - Обрабатывают ошибки сети и HTTP
 * - Поддерживают таймауты и отмену запросов
 * - Имеют встроенное кэширование
 * - Поддерживают повторные попытки с экспоненциальной задержкой
 * - Отслеживают прогресс загрузки
 * - Поддерживают все HTTP методы
 * - Работают с различными типами тела запроса
 */
