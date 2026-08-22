// packages/ast-analyzer/src/reporters/templates/modules/AppInit.js

/**
 * Модуль инициализации приложения
 * Возвращает Promise, который резолвится когда приложение готово
 *
 * Использование:
 *   import { App, waitForApp, getAppAPI, isAppReady } from './modules/AppInit.js';
 *
 *   // Асинхронное ожидание
 *   const { app, api, ready } = await App.ready(5000, 100);
 *   if (ready) {
 *     api.focusModule('/src/index.ts');
 *   }
 *
 *   // Синхронное получение
 *   const api = App.getAPI();
 *   if (api) {
 *     api.renderModules();
 *   }
 */

const SYM_APP = Symbol.for('__AST_APP__');
const SYM_APP_API = Symbol.for('__AST_APP_API__');
const SYM_READY = Symbol.for('__AST_APP_READY__');

/**
 * Создает безопасную обертку для метода
 * @param {Object} app - Экземпляр приложения
 * @param {string} methodName - Имя метода
 * @returns {Function} Безопасная обертка метода
 */
function safeMethod(app, methodName) {
  if (app && typeof app[methodName] === 'function') {
    return app[methodName].bind(app);
  }
  // Возвращаем заглушку с логированием
  return function (...args) {
    console.warn(`⚠️ Метод ${methodName} еще не доступен`, args);
    return undefined;
  };
}

/**
 * Создает API с безопасными методами
 * @param {Object} app - Экземпляр приложения
 * @returns {Object} Замороженный API объект
 */
function createAPI(app) {
  const api = {};

  // Список всех методов, которые должны быть доступны через API
  const methods = [
    'focusModule',
    'focusFunction',
    'clearFocus',
    'handleSearch',
    'setGraphMode',
    'setCardMode',
    'closeDetail',
    'renderModules',
    'updateBreadcrumbs',
    'showDetail',
    'getReportData',
    'getAllFunctions',
    'updateView',
    'dispose',
    'pause',
    'resume',
    'getModuleLevel',
    'findFunctionData',
    'scrollToModule',
    'scrollToFunction',
    'updateFocusInfo',
    'hideFocusInfo',
    'setupKeyboard',
    'escapeHtml',
    'escapeJs',
  ];

  for (const method of methods) {
    api[method] = safeMethod(app, method);
  }

  // Добавляем прямую ссылку на приложение (для отладки)
  Object.defineProperty(api, '__app', {
    get: () => app,
    enumerable: false,
    configurable: false,
  });

  // Добавляем геттеры для данных
  Object.defineProperty(api, 'reportData', {
    get: () => app?.reportData || null,
    enumerable: true,
    configurable: false,
  });

  Object.defineProperty(api, 'allFunctionsData', {
    get: () => app?.allFunctionsData || null,
    enumerable: true,
    configurable: false,
  });

  Object.defineProperty(api, 'isInitialized', {
    get: () => app?.isInitialized || false,
    enumerable: true,
    configurable: false,
  });

  // Замораживаем API для защиты от изменений
  return Object.freeze(api);
}

/**
 * Создает fallback API если приложение не загрузилось
 * @returns {Object} Замороженный fallback API
 */
function createFallbackAPI() {
  const api = {};
  const methods = [
    'focusModule',
    'focusFunction',
    'clearFocus',
    'handleSearch',
    'setGraphMode',
    'setCardMode',
    'closeDetail',
    'renderModules',
    'updateBreadcrumbs',
    'showDetail',
    'getReportData',
    'getAllFunctions',
    'updateView',
    'dispose',
    'pause',
    'resume',
    'getModuleLevel',
    'findFunctionData',
    'scrollToModule',
    'scrollToFunction',
    'updateFocusInfo',
    'hideFocusInfo',
    'setupKeyboard',
    'escapeHtml',
    'escapeJs',
  ];

  for (const method of methods) {
    api[method] = function (...args) {
      console.warn(`⚠️ [Fallback] ${method} вызван до инициализации приложения`, args);
      return undefined;
    };
  }

  // Добавляем геттеры для данных (возвращают null)
  Object.defineProperty(api, 'reportData', {
    get: () => null,
    enumerable: true,
    configurable: false,
  });

  Object.defineProperty(api, 'allFunctionsData', {
    get: () => null,
    enumerable: true,
    configurable: false,
  });

  Object.defineProperty(api, 'isInitialized', {
    get: () => false,
    enumerable: true,
    configurable: false,
  });

  console.warn('⚠️ Используется fallback API (приложение не загружено)');
  return Object.freeze(api);
}

/**
 * Ждет загрузки приложения
 * @param {number} timeout - Таймаут в миллисекундах (по умолчанию 5000)
 * @param {number} interval - Интервал проверки (по умолчанию 100)
 * @returns {Promise<{ app: any, api: any, ready: boolean, attempts: number, error?: string }>}
 */
export function waitForApp(timeout = 5000, interval = 100) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = Math.ceil(timeout / interval);
    let timeoutId = null;

    console.log(`⏳ Ожидание инициализации приложения (таймаут: ${timeout}ms)...`);

    // Функция проверки готовности
    const checkApp = () => {
      attempts++;
      const app = window[SYM_APP];
      const isReady = window[SYM_READY] === true;

      // Проверяем, что приложение существует и готово
      if (app && isReady) {
        clearInterval(checkInterval);
        if (timeoutId) clearTimeout(timeoutId);

        const api = createAPI(app);
        window[SYM_APP_API] = api;

        console.log(`✅ Приложение готово после ${attempts} попыток`);
        resolve({
          app,
          api,
          ready: true,
          attempts,
        });
        return true;
      }

      // Проверяем, есть ли уже API (может быть создан ранее)
      const existingApi = window[SYM_APP_API];
      if (existingApi && typeof existingApi.focusModule === 'function') {
        // API уже существует и рабочий
        clearInterval(checkInterval);
        if (timeoutId) clearTimeout(timeoutId);

        console.log(`✅ API уже существует после ${attempts} попыток`);
        resolve({
          app: window[SYM_APP],
          api: existingApi,
          ready: true,
          attempts,
        });
        return true;
      }

      // Если достигнут лимит попыток
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        if (timeoutId) clearTimeout(timeoutId);

        console.warn(`⚠️ Таймаут инициализации приложения (${timeout}ms)`);
        // Создаем fallback API
        const fallbackApi = createFallbackAPI();
        window[SYM_APP_API] = fallbackApi;

        resolve({
          app: null,
          api: fallbackApi,
          ready: false,
          attempts,
          error: 'Timeout',
        });
        return true;
      }

      return false;
    };

    // Запускаем периодическую проверку
    const checkInterval = setInterval(() => {
      const done = checkApp();
      if (done) {
        clearInterval(checkInterval);
        if (timeoutId) clearTimeout(timeoutId);
      }
    }, interval);

    // Устанавливаем таймаут
    timeoutId = setTimeout(() => {
      clearInterval(checkInterval);

      const app = window[SYM_APP];
      const isReady = window[SYM_READY] === true;

      if (app && isReady) {
        // Приложение готово, просто резолвим
        const api = createAPI(app);
        window[SYM_APP_API] = api;
        console.log(`✅ Приложение готово (таймаут)`);
        resolve({
          app,
          api,
          ready: true,
          attempts,
        });
      } else {
        // Таймаут
        console.warn(`⚠️ Таймаут инициализации приложения (${timeout}ms)`);
        const fallbackApi = createFallbackAPI();
        window[SYM_APP_API] = fallbackApi;
        resolve({
          app: null,
          api: fallbackApi,
          ready: false,
          attempts,
          error: 'Timeout',
        });
      }
    }, timeout);

    // Обработка ошибок
    const errorHandler = e => {
      if (e.message && (e.message.includes('app') || e.message.includes('App'))) {
        clearInterval(checkInterval);
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener('error', errorHandler);

        console.error('❌ Ошибка при инициализации:', e.message);
        const fallbackApi = createFallbackAPI();
        window[SYM_APP_API] = fallbackApi;

        reject(new Error(`Ошибка при инициализации: ${e.message}`));
      }
    };

    window.addEventListener('error', errorHandler);

    // Очистка при завершении
    return () => {
      clearInterval(checkInterval);
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('error', errorHandler);
    };
  });
}

/**
 * Получает API приложения (синхронно)
 * @returns {Object|null} API или null если не готово
 */
export function getAppAPI() {
  const api = window[SYM_APP_API];
  if (api && typeof api.focusModule === 'function') {
    return api;
  }

  // Проверяем, может приложение уже есть, но API не создан
  const app = window[SYM_APP];
  if (app && window[SYM_READY] === true) {
    const newApi = createAPI(app);
    window[SYM_APP_API] = newApi;
    return newApi;
  }

  return null;
}

/**
 * Проверяет, готово ли приложение
 * @returns {boolean}
 */
export function isAppReady() {
  return window[SYM_READY] === true && !!window[SYM_APP];
}

/**
 * Получает данные отчета (если доступны)
 * @returns {Object|null}
 */
export function getReportData() {
  const app = window[SYM_APP];
  if (app && app.reportData) {
    return app.reportData;
  }
  return null;
}

/**
 * Получает все функции (если доступны)
 * @returns {Array|null}
 */
export function getAllFunctions() {
  const app = window[SYM_APP];
  if (app && app.allFunctionsData) {
    return app.allFunctionsData;
  }
  return null;
}

/**
 * Ждет загрузки приложения с автоматической повторной попыткой
 * @param {number} maxRetries - Максимальное количество повторных попыток
 * @param {number} timeout - Таймаут на попытку
 * @param {number} interval - Интервал проверки
 * @returns {Promise<{ app: any, api: any, ready: boolean }>}
 */
export async function waitForAppWithRetry(maxRetries = 3, timeout = 5000, interval = 100) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 Попытка ${attempt}/${maxRetries}...`);

    try {
      const result = await waitForApp(timeout, interval);

      if (result.ready) {
        console.log(`✅ Приложение готово после ${attempt} попыток`);
        return result;
      }

      // Если не готово, но есть ошибка
      if (result.error) {
        lastError = result.error;
        console.warn(`⚠️ Попытка ${attempt} не удалась: ${result.error}`);
      }

      // Ждем перед следующей попыткой
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      lastError = error.message;
      console.warn(`⚠️ Попытка ${attempt} завершилась ошибкой:`, error.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Все попытки исчерпаны
  console.error(`❌ Не удалось загрузить приложение после ${maxRetries} попыток`);
  const fallbackApi = createFallbackAPI();
  window[SYM_APP_API] = fallbackApi;

  return {
    app: null,
    api: fallbackApi,
    ready: false,
    error: lastError || `Failed after ${maxRetries} attempts`,
  };
}

/**
 * Создает глобальный объект с методами для доступа к приложению
 * Используйте как: import { appReady, App } from './modules/AppInit.js'
 */
export const App = {
  /**
   * Ожидает готовности приложения
   * @param {number} timeout - Таймаут в мс
   * @param {number} interval - Интервал проверки
   * @returns {Promise<{ app: any, api: any, ready: boolean }>}
   */
  ready: waitForApp,

  /**
   * Ожидает готовности с повторными попытками
   * @param {number} maxRetries - Максимум попыток
   * @param {number} timeout - Таймаут на попытку
   * @param {number} interval - Интервал проверки
   * @returns {Promise<{ app: any, api: any, ready: boolean }>}
   */
  readyWithRetry: waitForAppWithRetry,

  /**
   * Получает API (синхронно, может вернуть null)
   * @returns {Object|null}
   */
  getAPI: getAppAPI,

  /**
   * Проверяет готовность
   * @returns {boolean}
   */
  isReady: isAppReady,

  /**
   * Получает данные отчета
   * @returns {Object|null}
   */
  getReportData: getReportData,

  /**
   * Получает список функций
   * @returns {Array|null}
   */
  getAllFunctions: getAllFunctions,

  /**
   * Глобальный доступ к приложению (для отладки)
   * @returns {Object|null}
   */
  getApp: () => window[SYM_APP],

  /**
   * Создает fallback API вручную
   * @returns {Object}
   */
  createFallback: createFallbackAPI,

  /**
   * Принудительно устанавливает API
   * @param {Object} api - API объект
   */
  setAPI: api => {
    if (api && typeof api === 'object') {
      window[SYM_APP_API] = Object.freeze(api);
      console.log('✅ API принудительно установлен');
    }
  },
};

// Экспорт по умолчанию
export default App;

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ДЛЯ РАБОТЫ С APP
// ============================================================

/**
 * Декоратор для методов, требующих готового приложения
 * @param {Function} fn - Асинхронная функция
 * @returns {Function} Обернутая функция
 */
export function withAppReady(fn) {
  return async function (...args) {
    const result = await App.ready();
    if (result.ready) {
      return fn(result.api, ...args);
    }
    throw new Error('Приложение не готово');
  };
}

/**
 * Хук для использования в React/Vue компонентах
 * @returns {Object} { api, isReady, reportData, functions }
 */
export function useApp() {
  const api = getAppAPI();
  const isReady = isAppReady();
  const reportData = getReportData();
  const functions = getAllFunctions();

  return {
    api,
    isReady,
    reportData,
    functions,
    // Методы для удобства
    focusModule: path => api?.focusModule?.(path),
    focusFunction: (name, module) => api?.focusFunction?.(name, module),
    clearFocus: () => api?.clearFocus?.(),
    renderModules: () => api?.renderModules?.(),
  };
}

// ============================================================
// ОТЛАДОЧНЫЕ УТИЛИТЫ
// ============================================================

/**
 * Выводит состояние приложения в консоль
 */
export function debugApp() {
  const app = window[SYM_APP];
  const api = window[SYM_APP_API];
  const ready = window[SYM_READY];

  console.group('🔍 Отладка приложения');
  console.log('📌 Приложение:', app ? '✅ существует' : '❌ отсутствует');
  console.log('📌 API:', api ? '✅ существует' : '❌ отсутствует');
  console.log('📌 Готовность:', ready ? '✅ готова' : '❌ не готова');

  if (app) {
    console.log('📊 Данные отчета:', app.reportData ? '✅ есть' : '❌ нет');
    console.log('📊 Функции:', app.allFunctionsData?.length || 0);
    console.log('📊 Инициализировано:', app.isInitialized ? '✅ да' : '❌ нет');
    console.log('📊 Методы приложения:', Object.getOwnPropertyNames(Object.getPrototypeOf(app)));
  }

  if (api) {
    console.log(
      '📊 Методы API:',
      Object.keys(api).filter(k => typeof api[k] === 'function')
    );
  }

  console.groupEnd();
}

// Экспорт отладочных утилит
export const Debug = {
  app: debugApp,
  getApp: () => window[SYM_APP],
  getAPI: () => window[SYM_APP_API],
  isReady: () => window[SYM_READY],
};

console.log('📦 Модуль AppInit загружен');
console.log('📌 Используйте: App.ready() для ожидания загрузки');
console.log('📌 Или: App.getAPI() для синхронного доступа');
console.log('📌 Отладка: Debug.app()');
