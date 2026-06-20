// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/07-class-operations/modules/data-class.js

// ============================================
// МОДУЛЬ КЛАССОВ ДЛЯ РАБОТЫ С ДАННЫМИ
// ============================================
// Этот модуль содержит классы для хранения, обработки
// и манипуляции данными различных типов.

/**
 * Базовый класс для хранения данных
 * Предоставляет основные методы для работы с данными
 */
class DataStore {
  /**
   * Создает экземпляр DataStore
   * @param {Array} initialData - Начальные данные
   * @param {Object} options - Опции хранилища
   */
  constructor(initialData = [], options = {}) {
    this._data = [...initialData];
    this._options = {
      immutable: false,
      validateOnSet: null,
      transformOnSet: null,
      ...options,
    };
    this._version = 0;
    this._history = [];
    this._maxHistory = 100;
    this._listeners = new Map();
  }

  /**
   * Возвращает копию данных
   * @returns {Array} - Копия данных
   */
  get data() {
    return this._options.immutable ? [...this._data] : this._data;
  }

  /**
   * Возвращает количество элементов
   * @returns {number} - Количество элементов
   */
  get size() {
    return this._data.length;
  }

  /**
   * Возвращает true, если хранилище пустое
   * @returns {boolean} - true если пустое
   */
  get isEmpty() {
    return this._data.length === 0;
  }

  /**
   * Возвращает версию данных
   * @returns {number} - Версия данных
   */
  get version() {
    return this._version;
  }

  /**
   * Добавляет элемент в конец хранилища
   * @param {any} item - Добавляемый элемент
   * @returns {DataStore} - Ссылка на себя (для цепочки вызовов)
   * @throws {Error} - Если хранилище неизменяемое
   */
  push(item) {
    this._validateMutation();
    const validatedItem = this._validateAndTransform(item);
    this._saveState();
    this._data.push(validatedItem);
    this._version++;
    this._notify('push', { item: validatedItem });
    return this;
  }

  /**
   * Добавляет несколько элементов в конец хранилища
   * @param {Array} items - Массив элементов
   * @returns {DataStore} - Ссылка на себя
   */
  pushMany(items) {
    this._validateMutation();
    const validatedItems = items.map(item => this._validateAndTransform(item));
    this._saveState();
    this._data.push(...validatedItems);
    this._version++;
    this._notify('pushMany', { items: validatedItems });
    return this;
  }

  /**
   * Удаляет последний элемент
   * @returns {any} - Удаленный элемент
   * @throws {Error} - Если хранилище пустое или неизменяемое
   */
  pop() {
    this._validateMutation();
    if (this._data.length === 0) {
      throw new Error('Cannot pop from empty DataStore');
    }
    this._saveState();
    const item = this._data.pop();
    this._version++;
    this._notify('pop', { item });
    return item;
  }

  /**
   * Вставляет элемент по индексу
   * @param {number} index - Индекс для вставки
   * @param {any} item - Вставляемый элемент
   * @returns {DataStore} - Ссылка на себя
   */
  insertAt(index, item) {
    this._validateMutation();
    if (index < 0 || index > this._data.length) {
      throw new RangeError(`Index ${index} out of bounds`);
    }
    const validatedItem = this._validateAndTransform(item);
    this._saveState();
    this._data.splice(index, 0, validatedItem);
    this._version++;
    this._notify('insertAt', { index, item: validatedItem });
    return this;
  }

  /**
   * Удаляет элемент по индексу
   * @param {number} index - Индекс для удаления
   * @returns {any} - Удаленный элемент
   */
  removeAt(index) {
    this._validateMutation();
    if (index < 0 || index >= this._data.length) {
      throw new RangeError(`Index ${index} out of bounds`);
    }
    this._saveState();
    const item = this._data.splice(index, 1)[0];
    this._version++;
    this._notify('removeAt', { index, item });
    return item;
  }

  /**
   * Обновляет элемент по индексу
   * @param {number} index - Индекс элемента
   * @param {any} newItem - Новое значение
   * @returns {DataStore} - Ссылка на себя
   */
  updateAt(index, newItem) {
    this._validateMutation();
    if (index < 0 || index >= this._data.length) {
      throw new RangeError(`Index ${index} out of bounds`);
    }
    const oldItem = this._data[index];
    const validatedItem = this._validateAndTransform(newItem);
    this._saveState();
    this._data[index] = validatedItem;
    this._version++;
    this._notify('updateAt', { index, oldItem, newItem: validatedItem });
    return this;
  }

  /**
   * Очищает все данные
   * @returns {DataStore} - Ссылка на себя
   */
  clear() {
    this._validateMutation();
    this._saveState();
    const oldData = [...this._data];
    this._data = [];
    this._version++;
    this._notify('clear', { oldData });
    return this;
  }

  /**
   * Находит элемент по предикату
   * @param {Function} predicate - Функция поиска
   * @returns {any} - Найденный элемент или undefined
   */
  find(predicate) {
    return this._data.find(predicate);
  }

  /**
   * Находит индекс элемента по предикату
   * @param {Function} predicate - Функция поиска
   * @returns {number} - Индекс элемента или -1
   */
  findIndex(predicate) {
    return this._data.findIndex(predicate);
  }

  /**
   * Фильтрует данные
   * @param {Function} predicate - Функция фильтрации
   * @returns {Array} - Отфильтрованный массив
   */
  filter(predicate) {
    return this._data.filter(predicate);
  }

  /**
   * Преобразует данные с помощью функции
   * @param {Function} mapper - Функция преобразования
   * @returns {Array} - Преобразованный массив
   */
  map(mapper) {
    return this._data.map(mapper);
  }

  /**
   * Сворачивает данные в одно значение
   * @param {Function} reducer - Функция свертки
   * @param {any} initialValue - Начальное значение
   * @returns {any} - Результат свертки
   */
  reduce(reducer, initialValue) {
    return this._data.reduce(reducer, initialValue);
  }

  /**
   * Сортирует данные
   * @param {Function} compareFn - Функция сравнения
   * @returns {DataStore} - Ссылка на себя
   */
  sort(compareFn) {
    this._validateMutation();
    this._saveState();
    this._data.sort(compareFn);
    this._version++;
    this._notify('sort', {});
    return this;
  }

  /**
   * Реверсирует данные
   * @returns {DataStore} - Ссылка на себя
   */
  reverse() {
    this._validateMutation();
    this._saveState();
    this._data.reverse();
    this._version++;
    this._notify('reverse', {});
    return this;
  }

  /**
   * Создает копию хранилища
   * @returns {DataStore} - Новый экземпляр с копией данных
   */
  clone() {
    return new DataStore([...this._data], { ...this._options });
  }

  /**
   * Сериализует данные в JSON
   * @returns {string} - JSON-строка
   */
  toJSON() {
    return JSON.stringify(this._data);
  }

  /**
   * Создает хранилище из JSON
   * @param {string} json - JSON-строка
   * @returns {DataStore} - Новый экземпляр
   */
  static fromJSON(json) {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) {
        throw new Error('JSON must be an array');
      }
      return new DataStore(data);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }

  /**
   * Добавляет слушатель событий
   * @param {string} event - Название события
   * @param {Function} listener - Функция-слушатель
   * @returns {Function} - Функция для удаления слушателя
   */
  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
    return () => this.off(event, listener);
  }

  /**
   * Удаляет слушатель событий
   * @param {string} event - Название события
   * @param {Function} listener - Функция-слушатель
   */
  off(event, listener) {
    if (this._listeners.has(event)) {
      const listeners = this._listeners.get(event);
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Устанавливает максимальное количество записей в истории
   * @param {number} max - Максимальное количество
   */
  setMaxHistory(max) {
    this._maxHistory = max;
    if (this._history.length > this._maxHistory) {
      this._history = this._history.slice(-this._maxHistory);
    }
  }

  /**
   * Откатывает состояние к предыдущему
   * @returns {boolean} - true если откат выполнен
   */
  undo() {
    if (this._history.length === 0) {
      return false;
    }
    const previousState = this._history.pop();
    this._data = previousState;
    this._version--;
    this._notify('undo', { state: previousState });
    return true;
  }

  /**
   * Проверяет, можно ли выполнить откат
   * @returns {boolean} - true если можно
   */
  canUndo() {
    return this._history.length > 0;
  }

  /**
   * Сохраняет текущее состояние в историю
   * @private
   */
  _saveState() {
    if (this._history.length >= this._maxHistory) {
      this._history.shift();
    }
    this._history.push([...this._data]);
  }

  /**
   * Проверяет, разрешена ли мутация
   * @private
   * @throws {Error} - Если мутация запрещена
   */
  _validateMutation() {
    if (this._options.immutable) {
      throw new Error('DataStore is immutable');
    }
  }

  /**
   * Валидирует и преобразует элемент
   * @private
   * @param {any} item - Элемент для валидации
   * @returns {any} - Валидированный и преобразованный элемент
   */
  _validateAndTransform(item) {
    let result = item;
    if (this._options.validateOnSet) {
      const validated = this._options.validateOnSet(result);
      if (validated === undefined || validated === null) {
        throw new Error('Item validation failed');
      }
      result = validated;
    }
    if (this._options.transformOnSet) {
      result = this._options.transformOnSet(result);
    }
    return result;
  }

  /**
   * Уведомляет слушателей о событии
   * @private
   * @param {string} event - Название события
   * @param {Object} data - Данные события
   */
  _notify(event, data) {
    if (this._listeners.has(event)) {
      for (const listener of this._listeners.get(event)) {
        try {
          listener({ event, data, version: this._version, timestamp: Date.now() });
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }
}

/**
 * Класс для работы с кэшем данных
 * Реализует стратегии кэширования и инвалидации
 */
class DataCache {
  /**
   * Создает экземпляр DataCache
   * @param {Object} options - Опции кэша
   */
  constructor(options = {}) {
    this._cache = new Map();
    this._options = {
      maxSize: 100,
      ttl: 60000, // 1 минута
      strategy: 'lru', // 'lru', 'lfu', 'fifo'
      ...options,
    };
    this._accessHistory = [];
    this._frequencyMap = new Map();
    this._statistics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
    };
  }

  /**
   * Получает значение из кэша
   * @param {string} key - Ключ
   * @returns {any} - Значение или undefined
   */
  get(key) {
    this._statistics.totalRequests++;
    if (!this._cache.has(key)) {
      this._statistics.misses++;
      return undefined;
    }

    const entry = this._cache.get(key);
    if (this._isExpired(entry)) {
      this._cache.delete(key);
      this._statistics.misses++;
      return undefined;
    }

    this._statistics.hits++;
    this._updateAccess(key);
    return entry.value;
  }

  /**
   * Устанавливает значение в кэш
   * @param {string} key - Ключ
   * @param {any} value - Значение
   * @param {number} ttl - Время жизни в мс (опционально)
   * @returns {DataCache} - Ссылка на себя
   */
  set(key, value, ttl = null) {
    if (this._cache.size >= this._options.maxSize) {
      this._evict();
    }

    const entry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this._options.ttl,
    };

    this._cache.set(key, entry);
    this._updateAccess(key);

    // Обновляем частоту использования
    const freq = this._frequencyMap.get(key) || 0;
    this._frequencyMap.set(key, freq + 1);

    return this;
  }

  /**
   * Проверяет наличие ключа в кэше
   * @param {string} key - Ключ
   * @returns {boolean} - true если ключ существует и не истек
   */
  has(key) {
    if (!this._cache.has(key)) {
      return false;
    }
    const entry = this._cache.get(key);
    if (this._isExpired(entry)) {
      this._cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Удаляет значение из кэша
   * @param {string} key - Ключ
   * @returns {boolean} - true если удалено
   */
  delete(key) {
    const result = this._cache.delete(key);
    this._frequencyMap.delete(key);
    this._accessHistory = this._accessHistory.filter(k => k !== key);
    return result;
  }

  /**
   * Очищает кэш
   */
  clear() {
    this._cache.clear();
    this._frequencyMap.clear();
    this._accessHistory = [];
    this._statistics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
    };
  }

  /**
   * Возвращает размер кэша
   * @returns {number} - Количество элементов в кэше
   */
  get size() {
    return this._cache.size;
  }

  /**
   * Возвращает статистику использования кэша
   * @returns {Object} - Объект со статистикой
   */
  getStats() {
    const hitRate =
      this._statistics.totalRequests > 0
        ? (this._statistics.hits / this._statistics.totalRequests) * 100
        : 0;

    return {
      ...this._statistics,
      hitRate: hitRate.toFixed(2) + '%',
      size: this._cache.size,
      maxSize: this._options.maxSize,
    };
  }

  /**
   * Проверяет, истек ли срок жизни записи
   * @private
   * @param {Object} entry - Запись кэша
   * @returns {boolean} - true если истек
   */
  _isExpired(entry) {
    if (!entry.ttl) {
      return false;
    }
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Обновляет историю доступа для LRU стратегии
   * @private
   * @param {string} key - Ключ
   */
  _updateAccess(key) {
    this._accessHistory = this._accessHistory.filter(k => k !== key);
    this._accessHistory.push(key);
  }

  /**
   * Вытесняет элемент из кэша по стратегии
   * @private
   */
  _evict() {
    let keyToEvict = null;

    switch (this._options.strategy) {
      case 'lru':
        keyToEvict = this._accessHistory.shift();
        break;
      case 'lfu':
        let minFreq = Infinity;
        for (const [key, freq] of this._frequencyMap) {
          if (freq < minFreq) {
            minFreq = freq;
            keyToEvict = key;
          }
        }
        break;
      case 'fifo':
        keyToEvict = this._accessHistory.shift();
        break;
      default:
        keyToEvict = this._accessHistory.shift();
    }

    if (keyToEvict && this._cache.has(keyToEvict)) {
      this._cache.delete(keyToEvict);
      this._frequencyMap.delete(keyToEvict);
      this._statistics.evictions++;
    }
  }
}

/**
 * Класс для работы с наблюдаемыми данными
 * Реализует паттерн Observer для реактивного программирования
 */
class ObservableData {
  /**
   * Создает экземпляр ObservableData
   * @param {any} initialValue - Начальное значение
   */
  constructor(initialValue) {
    this._value = initialValue;
    this._observers = new Set();
    this._dependencies = new Set();
    this._computed = false;
    this._computeFn = null;
  }

  /**
   * Возвращает текущее значение
   * @returns {any} - Текущее значение
   */
  get value() {
    // Регистрируем зависимость
    if (ObservableData._currentObserver) {
      this._dependencies.add(ObservableData._currentObserver);
    }
    return this._value;
  }

  /**
   * Устанавливает новое значение
   * @param {any} newValue - Новое значение
   */
  set value(newValue) {
    if (this._computed) {
      throw new Error('Cannot set value of computed ObservableData');
    }
    const oldValue = this._value;
    if (oldValue !== newValue) {
      this._value = newValue;
      this._notify(oldValue, newValue);
    }
  }

  /**
   * Создает вычисляемое значение
   * @param {Function} computeFn - Функция вычисления
   * @param {Array<ObservableData>} dependencies - Зависимости
   * @returns {ObservableData} - Новое вычисляемое значение
   */
  static computed(computeFn, dependencies = []) {
    const observable = new ObservableData(null);
    observable._computed = true;
    observable._computeFn = computeFn;

    const updateComputed = () => {
      const result = computeFn();
      if (result !== observable._value) {
        const oldValue = observable._value;
        observable._value = result;
        observable._notify(oldValue, result);
      }
    };

    // Добавляем зависимости
    for (const dep of dependencies) {
      if (dep instanceof ObservableData) {
        dep.observe(updateComputed);
      }
    }

    // Первоначальное вычисление
    updateComputed();

    return observable;
  }

  /**
   * Добавляет наблюдателя
   * @param {Function} observer - Функция-наблюдатель
   * @returns {Function} - Функция для удаления наблюдателя
   */
  observe(observer) {
    this._observers.add(observer);
    return () => this._observers.delete(observer);
  }

  /**
   * Уведомляет наблюдателей об изменении
   * @private
   * @param {any} oldValue - Старое значение
   * @param {any} newValue - Новое значение
   */
  _notify(oldValue, newValue) {
    for (const observer of this._observers) {
      try {
        observer(newValue, oldValue);
      } catch (error) {
        console.error('Error in observer:', error);
      }
    }
  }

  /**
   * Создает производное значение с преобразованием
   * @param {Function} transform - Функция преобразования
   * @returns {ObservableData} - Новое ObservableData
   */
  map(transform) {
    return ObservableData.computed(() => transform(this.value), [this]);
  }

  /**
   * Создает производное значение с фильтрацией
   * @param {Function} predicate - Функция фильтрации
   * @returns {ObservableData} - Новое ObservableData
   */
  filter(predicate) {
    return ObservableData.computed(() => (predicate(this.value) ? this.value : null), [this]);
  }

  /**
   * Объединяет несколько ObservableData
   * @param {Array<ObservableData>} observables - Массив ObservableData
   * @param {Function} combineFn - Функция объединения
   * @returns {ObservableData} - Новое ObservableData
   */
  static combine(observables, combineFn) {
    return ObservableData.computed(
      () => combineFn(...observables.map(obs => obs.value)),
      observables
    );
  }
}

// Статическое поле для отслеживания текущего наблюдателя
ObservableData._currentObserver = null;

// ============================================
// ЭКСПОРТЫ
// ============================================

export { DataStore, DataCache, ObservableData };

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  DataStore,
  DataCache,
  ObservableData,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ КЛАССОВ ДЛЯ РАБОТЫ С ДАННЫМИ
 *
 * Этот модуль предоставляет 3 класса для работы с данными:
 *
 * 1. DataStore - Хранилище данных с историей и событиями
 *    - push, pushMany, pop - добавление/удаление элементов
 *    - insertAt, removeAt, updateAt - операции по индексу
 *    - find, filter, map, reduce - операции поиска и преобразования
 *    - sort, reverse - сортировка и реверсирование
 *    - undo - откат изменений
 *    - on/off - система событий
 *    - toJSON/fromJSON - сериализация
 *
 * 2. DataCache - Кэш данных с различными стратегиями
 *    - get, set, has, delete - основные операции
 *    - Стратегии вытеснения: LRU, LFU, FIFO
 *    - TTL для автоматической инвалидации
 *    - Статистика использования
 *
 * 3. ObservableData - Наблюдаемые данные (реактивность)
 *    - value - геттер/сеттер
 *    - observe - подписка на изменения
 *    - computed - вычисляемые значения
 *    - map, filter - производные значения
 *    - combine - объединение нескольких источников
 *
 * Особенности:
 * - Все классы валидируют входные данные
 * - Поддерживают цепочки вызовов
 * - Имеют систему событий и уведомлений
 * - Обрабатывают граничные случаи
 * - Имеют JSDoc с описанием методов
 */
