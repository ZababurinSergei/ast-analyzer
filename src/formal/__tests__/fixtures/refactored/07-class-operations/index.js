// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/07-class-operations/index.js

// ============================================
// ОПЕРАЦИИ С КЛАССАМИ - РЕФАКТОРИНГ
// ============================================
// Этот файл является точкой входа после рефакторинга.
// Все классы вынесены в отдельные модули.

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// Импорт базовых математических классов
import {
  Calculator,
  MathOperations,
  ScientificCalculator,
  StatisticsCalculator,
  MatrixCalculator,
  VectorCalculator,
  GeometryCalculator,
  FinanceCalculator,
  UnitConverter,
  TemperatureConverter,
  LengthConverter,
  WeightConverter,
  VolumeConverter,
  AreaConverter,
  SpeedConverter,
  TimeConverter,
} from './modules/math-class.js';

// Импорт классов для работы с данными
import {
  DataProcessor,
  DataValidator,
  DataTransformer,
  DataAggregator,
  DataExporter,
  DataImporter,
  DataCache,
  DataIndex,
  DataQuery,
  DataStore,
  DataSync,
  DataBackup,
  DataEncryption,
  DataCompression,
  DataSerializer,
} from './modules/data-class.js';

// Импорт классов для работы с UI
import {
  Component,
  Container,
  Button,
  Input,
  Form,
  Table,
  List,
  Modal,
  Tooltip,
  Popover,
  Dropdown,
  Menu,
  Tabs,
  Accordion,
  Carousel,
} from './modules/ui-class.js';

// Импорт классов для работы с сетью
import {
  HttpClient,
  HttpServer,
  WebSocketClient,
  WebSocketServer,
  RestClient,
  GraphQLClient,
  ApiClient,
  AuthClient,
  SessionManager,
  CookieManager,
  CacheManager,
  RateLimiter,
  RetryManager,
  CircuitBreaker,
  LoadBalancer,
} from './modules/network-class.js';

// ============================================
// ОСНОВНОЙ КЛАСС ПРИЛОЖЕНИЯ
// ============================================

/**
 * Основной класс приложения
 * Объединяет все возможности в единый интерфейс
 */
class Application {
  constructor(config = {}) {
    this.config = config;
    this.initialized = false;
    this.components = new Map();
    this.services = new Map();
    this.middleware = [];
    this.events = new Map();
    this.hooks = new Map();

    // Инициализация подсистем
    this.math = {
      calculator: new Calculator(),
      mathOps: new MathOperations(),
      scientific: new ScientificCalculator(),
      statistics: new StatisticsCalculator(),
      matrix: new MatrixCalculator(),
      vector: new VectorCalculator(),
      geometry: new GeometryCalculator(),
      finance: new FinanceCalculator(),
      unitConverter: new UnitConverter(),
      temperature: new TemperatureConverter(),
      length: new LengthConverter(),
      weight: new WeightConverter(),
      volume: new VolumeConverter(),
      area: new AreaConverter(),
      speed: new SpeedConverter(),
      time: new TimeConverter(),
    };

    this.data = {
      processor: new DataProcessor(),
      validator: new DataValidator(),
      transformer: new DataTransformer(),
      aggregator: new DataAggregator(),
      exporter: new DataExporter(),
      importer: new DataImporter(),
      cache: new DataCache(),
      index: new DataIndex(),
      query: new DataQuery(),
      store: new DataStore(),
      sync: new DataSync(),
      backup: new DataBackup(),
      encryption: new DataEncryption(),
      compression: new DataCompression(),
      serializer: new DataSerializer(),
    };

    this.ui = {
      component: new Component(),
      container: new Container(),
      button: new Button(),
      input: new Input(),
      form: new Form(),
      table: new Table(),
      list: new List(),
      modal: new Modal(),
      tooltip: new Tooltip(),
      popover: new Popover(),
      dropdown: new Dropdown(),
      menu: new Menu(),
      tabs: new Tabs(),
      accordion: new Accordion(),
      carousel: new Carousel(),
    };

    this.network = {
      httpClient: new HttpClient(),
      httpServer: new HttpServer(),
      websocketClient: new WebSocketClient(),
      websocketServer: new WebSocketServer(),
      restClient: new RestClient(),
      graphqlClient: new GraphQLClient(),
      apiClient: new ApiClient(),
      authClient: new AuthClient(),
      sessionManager: new SessionManager(),
      cookieManager: new CookieManager(),
      cacheManager: new CacheManager(),
      rateLimiter: new RateLimiter(),
      retryManager: new RetryManager(),
      circuitBreaker: new CircuitBreaker(),
      loadBalancer: new LoadBalancer(),
    };
  }

  /**
   * Инициализация приложения
   * @param {Object} options - Опции инициализации
   * @returns {Promise<Application>} - Экземпляр приложения
   */
  async initialize(options = {}) {
    if (this.initialized) {
      throw new Error('Application already initialized');
    }

    console.log('Initializing application...');

    // Инициализация всех подсистем
    const initPromises = [];

    // Математические сервисы
    for (const [name, service] of Object.entries(this.math)) {
      if (typeof service.initialize === 'function') {
        initPromises.push(service.initialize(options));
        this.services.set(`math:${name}`, service);
      }
    }

    // Сервисы данных
    for (const [name, service] of Object.entries(this.data)) {
      if (typeof service.initialize === 'function') {
        initPromises.push(service.initialize(options));
        this.services.set(`data:${name}`, service);
      }
    }

    // UI компоненты
    for (const [name, component] of Object.entries(this.ui)) {
      if (typeof component.initialize === 'function') {
        initPromises.push(component.initialize(options));
        this.components.set(`ui:${name}`, component);
      }
    }

    // Сетевые сервисы
    for (const [name, service] of Object.entries(this.network)) {
      if (typeof service.initialize === 'function') {
        initPromises.push(service.initialize(options));
        this.services.set(`network:${name}`, service);
      }
    }

    // Ожидаем инициализации всех подсистем
    await Promise.all(initPromises);

    this.initialized = true;
    console.log('Application initialized successfully');

    return this;
  }

  /**
   * Регистрация middleware
   * @param {Function} middleware - Middleware функция
   * @param {string} name - Имя middleware
   * @returns {Application} - Экземпляр приложения
   */
  use(middleware, name = null) {
    if (typeof middleware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }

    if (name) {
      // Проверяем, что middleware с таким именем еще не зарегистрирован
      if (this.middleware.some(m => m.name === name)) {
        throw new Error(`Middleware '${name}' already registered`);
      }
      middleware.name = name;
    }

    this.middleware.push(middleware);
    return this;
  }

  /**
   * Регистрация обработчика события
   * @param {string} event - Имя события
   * @param {Function} handler - Обработчик
   * @param {Object} options - Опции
   * @returns {Application} - Экземпляр приложения
   */
  on(event, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    this.events.get(event).push({
      handler,
      options,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    });

    return this;
  }

  /**
   * Регистрация хука
   * @param {string} hook - Имя хука
   * @param {Function} handler - Обработчик
   * @param {number} priority - Приоритет (выше = раньше)
   * @returns {Application} - Экземпляр приложения
   */
  hook(hook, handler, priority = 10) {
    if (typeof handler !== 'function') {
      throw new TypeError('Hook handler must be a function');
    }

    if (!this.hooks.has(hook)) {
      this.hooks.set(hook, []);
    }

    this.hooks.get(hook).push({
      handler,
      priority,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    });

    // Сортируем по приоритету
    this.hooks.get(hook).sort((a, b) => b.priority - a.priority);

    return this;
  }

  /**
   * Выполнение хука
   * @param {string} hook - Имя хука
   * @param {Object} context - Контекст выполнения
   * @param {Array} args - Аргументы
   * @returns {Promise<any>} - Результат выполнения
   */
  async runHook(hook, context = {}, ...args) {
    if (!this.hooks.has(hook)) {
      return null;
    }

    let result = null;
    for (const hookHandler of this.hooks.get(hook)) {
      try {
        result = await hookHandler.handler(context, ...args);
        if (result !== undefined && result !== null) {
          // Обновляем контекст для следующего хука
          context = { ...context, ...result };
        }
      } catch (error) {
        console.error(`Error in hook '${hook}':`, error);
        // Продолжаем выполнение других хуков
      }
    }

    return context;
  }

  /**
   * Получение сервиса по имени
   * @param {string} name - Имя сервиса
   * @returns {Object} - Сервис
   */
  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service;
  }

  /**
   * Получение компонента по имени
   * @param {string} name - Имя компонента
   * @returns {Object} - Компонент
   */
  getComponent(name) {
    const component = this.components.get(name);
    if (!component) {
      throw new Error(`Component '${name}' not found`);
    }
    return component;
  }

  /**
   * Выполнение математической операции
   * @param {string} operation - Имя операции
   * @param {Array} args - Аргументы операции
   * @returns {any} - Результат операции
   */
  calculate(operation, ...args) {
    const [category, name] = operation.split(':');
    const service = this.getService(`math:${category}`);

    if (typeof service[name] !== 'function') {
      throw new Error(`Math operation '${operation}' not found`);
    }

    return service[name](...args);
  }

  /**
   * Обработка данных
   * @param {string} operation - Имя операции
   * @param {any} data - Данные для обработки
   * @param {Object} options - Опции обработки
   * @returns {any} - Обработанные данные
   */
  processData(operation, data, options = {}) {
    const [category, name] = operation.split(':');
    const service = this.getService(`data:${category}`);

    if (typeof service[name] !== 'function') {
      throw new Error(`Data operation '${operation}' not found`);
    }

    return service[name](data, options);
  }

  /**
   * Выполнение сетевого запроса
   * @param {string} operation - Имя операции
   * @param {Object} request - Запрос
   * @param {Object} options - Опции запроса
   * @returns {Promise<any>} - Результат запроса
   */
  async networkRequest(operation, request, options = {}) {
    const [category, name] = operation.split(':');
    const service = this.getService(`network:${category}`);

    if (typeof service[name] !== 'function') {
      throw new Error(`Network operation '${operation}' not found`);
    }

    return service[name](request, options);
  }

  /**
   * Создание UI компонента
   * @param {string} type - Тип компонента
   * @param {Object} props - Свойства компонента
   * @param {Array} children - Дочерние компоненты
   * @returns {Object} - UI компонент
   */
  createComponent(type, props = {}, children = []) {
    const component = this.getComponent(`ui:${type}`);

    if (typeof component.create !== 'function') {
      throw new Error(`Component '${type}' does not support creation`);
    }

    return component.create(props, children);
  }

  /**
   * Выполнение всех проверок
   * @param {Object} options - Опции проверки
   * @returns {Promise<Object>} - Результаты проверки
   */
  async validate(options = {}) {
    const results = {};

    // Валидация математических сервисов
    for (const [name, service] of this.services) {
      if (name.startsWith('math:') && typeof service.validate === 'function') {
        results[name] = await service.validate(options);
      }
    }

    // Валидация данных
    for (const [name, service] of this.services) {
      if (name.startsWith('data:') && typeof service.validate === 'function') {
        results[name] = await service.validate(options);
      }
    }

    // Валидация UI компонентов
    for (const [name, component] of this.components) {
      if (typeof component.validate === 'function') {
        results[name] = await component.validate(options);
      }
    }

    // Валидация сетевых сервисов
    for (const [name, service] of this.services) {
      if (name.startsWith('network:') && typeof service.validate === 'function') {
        results[name] = await service.validate(options);
      }
    }

    return results;
  }

  /**
   * Очистка ресурсов
   * @param {Object} options - Опции очистки
   * @returns {Promise<void>}
   */
  async cleanup(options = {}) {
    console.log('Cleaning up application resources...');

    const cleanupPromises = [];

    // Очистка сервисов
    for (const [name, service] of this.services) {
      if (typeof service.cleanup === 'function') {
        cleanupPromises.push(service.cleanup(options));
      }
    }

    // Очистка компонентов
    for (const [name, component] of this.components) {
      if (typeof component.cleanup === 'function') {
        cleanupPromises.push(component.cleanup(options));
      }
    }

    await Promise.all(cleanupPromises);

    this.initialized = false;
    console.log('Application cleanup completed');
  }

  /**
   * Получение статуса приложения
   * @param {Object} options - Опции
   * @returns {Object} - Статус приложения
   */
  getStatus(options = {}) {
    return {
      initialized: this.initialized,
      services: {
        total: this.services.size,
        names: Array.from(this.services.keys()),
      },
      components: {
        total: this.components.size,
        names: Array.from(this.components.keys()),
      },
      middleware: {
        total: this.middleware.length,
        names: this.middleware.map(m => m.name || 'anonymous'),
      },
      events: {
        total: this.events.size,
        names: Array.from(this.events.keys()),
      },
      hooks: {
        total: this.hooks.size,
        names: Array.from(this.hooks.keys()),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Создание бэкапа состояния
   * @param {Object} options - Опции бэкапа
   * @returns {Promise<Object>} - Бэкап
   */
  async backup(options = {}) {
    const backup = {
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        services: {},
        components: {},
        config: this.config,
        middleware: this.middleware.map(m => {
          const fn = m.toString();
          return {
            name: m.name || 'anonymous',
            length: m.length,
            source: fn.length > 1000 ? fn.slice(0, 1000) + '...' : fn,
          };
        }),
      },
    };

    // Бэкап сервисов
    for (const [name, service] of this.services) {
      if (typeof service.backup === 'function') {
        backup.data.services[name] = await service.backup(options);
      }
    }

    // Бэкап компонентов
    for (const [name, component] of this.components) {
      if (typeof component.backup === 'function') {
        backup.data.components[name] = await component.backup(options);
      }
    }

    return backup;
  }

  /**
   * Восстановление из бэкапа
   * @param {Object} backup - Бэкап
   * @param {Object} options - Опции восстановления
   * @returns {Promise<void>}
   */
  async restore(backup, options = {}) {
    if (!backup || !backup.data) {
      throw new Error('Invalid backup data');
    }

    // Восстановление сервисов
    for (const [name, serviceData] of Object.entries(backup.data.services || {})) {
      const service = this.services.get(name);
      if (service && typeof service.restore === 'function') {
        await service.restore(serviceData, options);
      }
    }

    // Восстановление компонентов
    for (const [name, componentData] of Object.entries(backup.data.components || {})) {
      const component = this.components.get(name);
      if (component && typeof component.restore === 'function') {
        await component.restore(componentData, options);
      }
    }

    // Восстановление конфигурации
    if (backup.data.config) {
      this.config = { ...this.config, ...backup.data.config };
    }

    console.log('Application restored from backup');
  }
}

// ============================================
// ФАБРИКА СОЗДАНИЯ ПРИЛОЖЕНИЯ
// ============================================

/**
 * Создает экземпляр приложения с предварительной конфигурацией
 * @param {Object} config - Конфигурация приложения
 * @param {boolean} autoInit - Автоматическая инициализация
 * @returns {Promise<Application>} - Экземпляр приложения
 */
async function createApplication(config = {}, autoInit = true) {
  const app = new Application(config);

  if (autoInit) {
    await app.initialize();
  }

  return app;
}

/**
 * Создает экземпляр приложения с минимальной конфигурацией
 * @param {Object} config - Конфигурация приложения
 * @returns {Promise<Application>} - Экземпляр приложения
 */
async function createMinimalApplication(config = {}) {
  const app = new Application({
    ...config,
    minimal: true,
  });

  await app.initialize({ minimal: true });
  return app;
}

// ============================================
// РЕЭКСПОРТЫ
// ============================================

// Реэкспорт математических классов
export {
  Calculator,
  MathOperations,
  ScientificCalculator,
  StatisticsCalculator,
  MatrixCalculator,
  VectorCalculator,
  GeometryCalculator,
  FinanceCalculator,
  UnitConverter,
  TemperatureConverter,
  LengthConverter,
  WeightConverter,
  VolumeConverter,
  AreaConverter,
  SpeedConverter,
  TimeConverter,
};

// Реэкспорт классов для работы с данными
export {
  DataProcessor,
  DataValidator,
  DataTransformer,
  DataAggregator,
  DataExporter,
  DataImporter,
  DataCache,
  DataIndex,
  DataQuery,
  DataStore,
  DataSync,
  DataBackup,
  DataEncryption,
  DataCompression,
  DataSerializer,
};

// Реэкспорт UI компонентов
export {
  Component,
  Container,
  Button,
  Input,
  Form,
  Table,
  List,
  Modal,
  Tooltip,
  Popover,
  Dropdown,
  Menu,
  Tabs,
  Accordion,
  Carousel,
};

// Реэкспорт сетевых классов
export {
  HttpClient,
  HttpServer,
  WebSocketClient,
  WebSocketServer,
  RestClient,
  GraphQLClient,
  ApiClient,
  AuthClient,
  SessionManager,
  CookieManager,
  CacheManager,
  RateLimiter,
  RetryManager,
  CircuitBreaker,
  LoadBalancer,
};

// Реэкспорт основного класса и фабрик
export { Application, createApplication, createMinimalApplication };

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с классами приложения
 */
export default {
  // Базовые классы
  Calculator,
  MathOperations,
  ScientificCalculator,
  StatisticsCalculator,
  MatrixCalculator,
  VectorCalculator,
  GeometryCalculator,
  FinanceCalculator,
  UnitConverter,
  TemperatureConverter,
  LengthConverter,
  WeightConverter,
  VolumeConverter,
  AreaConverter,
  SpeedConverter,
  TimeConverter,

  // Классы данных
  DataProcessor,
  DataValidator,
  DataTransformer,
  DataAggregator,
  DataExporter,
  DataImporter,
  DataCache,
  DataIndex,
  DataQuery,
  DataStore,
  DataSync,
  DataBackup,
  DataEncryption,
  DataCompression,
  DataSerializer,

  // UI компоненты
  Component,
  Container,
  Button,
  Input,
  Form,
  Table,
  List,
  Modal,
  Tooltip,
  Popover,
  Dropdown,
  Menu,
  Tabs,
  Accordion,
  Carousel,

  // Сетевые классы
  HttpClient,
  HttpServer,
  WebSocketClient,
  WebSocketServer,
  RestClient,
  GraphQLClient,
  ApiClient,
  AuthClient,
  SessionManager,
  CookieManager,
  CacheManager,
  RateLimiter,
  RetryManager,
  CircuitBreaker,
  LoadBalancer,

  // Основной класс
  Application,

  // Фабрики
  createApplication,
  createMinimalApplication,
};

// ============================================
// ПРИМЕЧАНИЯ ПО РЕФАКТОРИНГУ
// ============================================

/*
 * РЕФАКТОРИНГ ВЫПОЛНЕН:
 *
 * 1. Математические классы вынесены в math-class.js:
 *    - Calculator - базовый калькулятор
 *    - MathOperations - расширенные операции
 *    - ScientificCalculator - научный калькулятор
 *    - StatisticsCalculator - статистика
 *    - MatrixCalculator - матричные операции
 *    - VectorCalculator - векторные операции
 *    - GeometryCalculator - геометрические вычисления
 *    - FinanceCalculator - финансовые расчеты
 *    - UnitConverter - конвертация единиц
 *    - TemperatureConverter - конвертация температур
 *    - LengthConverter - конвертация длин
 *    - WeightConverter - конвертация веса
 *    - VolumeConverter - конвертация объема
 *    - AreaConverter - конвертация площади
 *    - SpeedConverter - конвертация скорости
 *    - TimeConverter - конвертация времени
 *
 * 2. Классы данных вынесены в data-class.js:
 *    - DataProcessor - обработка данных
 *    - DataValidator - валидация данных
 *    - DataTransformer - трансформация данных
 *    - DataAggregator - агрегация данных
 *    - DataExporter - экспорт данных
 *    - DataImporter - импорт данных
 *    - DataCache - кэширование данных
 *    - DataIndex - индексация данных
 *    - DataQuery - запросы к данным
 *    - DataStore - хранение данных
 *    - DataSync - синхронизация данных
 *    - DataBackup - резервное копирование
 *    - DataEncryption - шифрование данных
 *    - DataCompression - сжатие данных
 *    - DataSerializer - сериализация данных
 *
 * 3. UI компоненты вынесены в ui-class.js:
 *    - Component - базовый компонент
 *    - Container - контейнер
 *    - Button - кнопка
 *    - Input - поле ввода
 *    - Form - форма
 *    - Table - таблица
 *    - List - список
 *    - Modal - модальное окно
 *    - Tooltip - подсказка
 *    - Popover - всплывающее окно
 *    - Dropdown - выпадающий список
 *    - Menu - меню
 *    - Tabs - вкладки
 *    - Accordion - аккордеон
 *    - Carousel - карусель
 *
 * 4. Сетевые классы вынесены в network-class.js:
 *    - HttpClient - HTTP клиент
 *    - HttpServer - HTTP сервер
 *    - WebSocketClient - WebSocket клиент
 *    - WebSocketServer - WebSocket сервер
 *    - RestClient - REST клиент
 *    - GraphQLClient - GraphQL клиент
 *    - ApiClient - API клиент
 *    - AuthClient - клиент авторизации
 *    - SessionManager - управление сессиями
 *    - CookieManager - управление куками
 *    - CacheManager - управление кэшем
 *    - RateLimiter - ограничение запросов
 *    - RetryManager - повторные попытки
 *    - CircuitBreaker - защита от перегрузок
 *    - LoadBalancer - балансировка нагрузки
 *
 * 5. Основной класс Application объединяет все подсистемы
 *
 * 6. Добавлены фабрики для создания экземпляров
 *
 * 7. Все классы имеют:
 *    - JSDoc комментарии
 *    - Методы инициализации и очистки
 *    - Валидацию и бэкап
 *    - Обработку событий и хуков
 */
