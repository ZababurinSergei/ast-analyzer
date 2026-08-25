// packages/ast-analyzer/src/reporters/templates/modules/AppInit.js

/**
 * Модуль инициализации приложения
 * Возвращает Promise, который резолвится когда приложение готово
 *
 * Использование:
 *   import { App } from './modules/AppInit.js';
 *   const { api, app } = await App.ready();
 *   api.focusModule('/src/index.ts');
 */

const SYM_APP = Symbol.for('__AST_APP__');
const SYM_APP_API = Symbol.for('__AST_APP_API__');
const SYM_READY = Symbol.for('__AST_APP_READY__');

/**
 * Создает API с методами, которые пытаются получить доступ к реальному API
 * НЕ создает заглушки, а пробрасывает вызовы к реальному API
 */
function createAPI(app) {
  // Получаем реальный API из глобального хранилища
  const getRealApi = () => window[SYM_APP_API];

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
  ];

  for (const method of methods) {
    api[method] = function (...args) {
      // Пытаемся получить реальный API
      const realApi = getRealApi();

      // Если есть реальный API - вызываем его
      if (realApi && typeof realApi[method] === 'function') {
        return realApi[method](...args);
      }

      // Если нет - пытаемся вызвать метод напрямую из app
      if (app && typeof app[method] === 'function') {
        return app[method](...args);
      }

      // Последний шанс - пытаемся получить API еще раз
      const fallbackApi = window[SYM_APP_API];
      if (fallbackApi && typeof fallbackApi[method] === 'function') {
        return fallbackApi[method](...args);
      }

      // Если ничего нет - логируем
      console.warn(`⚠️ Метод ${method} еще не доступен`, args);
      return undefined;
    };
  }

  // Добавляем ссылку на приложение для прямого доступа (осторожно!)
  Object.defineProperty(api, '__app', {
    get: () => app,
    enumerable: false,
    configurable: false,
  });

  // Не замораживаем API, чтобы можно было обновлять
  return api;
}

/**
 * Создает fallback API если приложение не загрузилось
 * Это просто обертка над реальным API
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
  ];

  for (const method of methods) {
    api[method] = function (...args) {
      // Пытаемся получить реальный API
      const realApi = window[SYM_APP_API];
      if (realApi && typeof realApi[method] === 'function') {
        return realApi[method](...args);
      }
      console.warn(`⚠️ [Fallback] ${method} вызван до инициализации приложения`, args);
      return undefined;
    };
  }

  console.warn('⚠️ Используется fallback API (приложение не загружено)');
  return Object.freeze(api);
}

/**
 * Ждет загрузки приложения
 * @param {number} timeout - Таймаут в миллисекундах (по умолчанию 5000)
 * @param {number} interval - Интервал проверки (по умолчанию 100)
 * @returns {Promise<{ app: any, api: any, ready: boolean }>}
 */
export function waitForApp(timeout = 5000, interval = 100) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = Math.ceil(timeout / interval);

    console.log(`⏳ Ожидание инициализации приложения (таймаут: ${timeout}ms)...`);

    const checkApp = setInterval(() => {
      attempts++;
      const app = window[SYM_APP];
      const isReady = window[SYM_READY] === true;

      // Проверяем, что API уже зарегистрирован
      const existingApi = window[SYM_APP_API];
      const apiExists = existingApi && typeof existingApi.focusModule === 'function';

      // Проверяем, что приложение существует и готово
      if (app && isReady && apiExists) {
        clearInterval(checkApp);
        console.log(`✅ Приложение готово после ${attempts} попыток`);
        resolve({
          app,
          api: existingApi,
          ready: true,
          attempts,
        });
        return;
      }

      // Если приложение готово, но API еще не зарегистрирован - ждем
      if (app && isReady && !apiExists) {
        console.log(`⏳ Приложение готово, но API еще не зарегистрирован (попытка ${attempts})`);
        // Продолжаем ждать
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkApp);
        console.warn(`⚠️ Таймаут инициализации приложения (${timeout}ms)`);

        // Создаем API которое пытается получить реальный API
        const fallbackApi = createAPI(app);
        window[SYM_APP_API] = fallbackApi;

        resolve({
          app: app || null,
          api: fallbackApi,
          ready: false,
          attempts,
          error: 'Timeout',
        });
      }
    }, interval);

    // Обработка ошибок
    if (typeof window !== 'undefined') {
      window.addEventListener('error', function handler(e) {
        if (e.message && e.message.includes('app')) {
          clearInterval(checkApp);
          window.removeEventListener('error', handler);
          reject(new Error(`Ошибка при инициализации: ${e.message}`));
        }
      });
    }
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
 * Создает глобальный объект с методами для доступа к приложению
 * Используйте как: import { App } from './modules/AppInit.js'
 */
export const App = {
  /**
   * Ожидает готовности приложения
   * @param {number} timeout - Таймаут в миллисекундах
   * @param {number} interval - Интервал проверки
   * @returns {Promise<{ app: any, api: any, ready: boolean }>}
   */
  ready: (timeout, interval) => waitForApp(timeout, interval),

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
};

// Дебаг-функция для отладки
if (typeof window !== 'undefined') {
  window.Debug = window.Debug || {};
  window.Debug.app = () => {
    console.log('🔍 Отладка приложения:');
    console.log('  SYM_APP:', window[SYM_APP]);
    console.log('  SYM_APP_API:', window[SYM_APP_API]);
    console.log('  SYM_READY:', window[SYM_READY]);
    console.log('  App.ready():', App.ready);
    console.log('  App.getAPI():', App.getAPI());
    console.log('  App.isReady():', App.isReady());
    console.log('  App.getReportData():', App.getReportData());
    console.log('  App.getAllFunctions():', App.getAllFunctions());
  };
}

console.log('📦 Модуль AppInit загружен');
console.log('📌 Используйте: App.ready() для ожидания загрузки');
console.log('📌 Или: App.getAPI() для синхронного доступа');
console.log('📌 Отладка: Debug.app()');

export default App;
