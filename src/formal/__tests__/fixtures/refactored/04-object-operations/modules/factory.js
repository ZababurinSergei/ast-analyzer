// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/04-object-operations/modules/factory.js

// ============================================
// МОДУЛЬ ФАБРИК ОБЪЕКТОВ
// ============================================
// Этот модуль содержит фабричные функции для создания
// различных типов объектов с методами и свойствами.

/**
 * Создает фабрику пользователей
 * @param {string} name - Имя пользователя
 * @param {number} age - Возраст пользователя
 * @param {string} email - Email пользователя
 * @returns {Object} - Объект пользователя с методами
 */
function createUser(name, age, email) {
  // Валидация входных данных
  if (!name || typeof name !== 'string') {
    throw new Error('Name is required and must be a string');
  }
  if (typeof age !== 'number' || age < 0 || age > 150) {
    throw new Error('Age must be a number between 0 and 150');
  }
  if (email && typeof email !== 'string') {
    throw new Error('Email must be a string');
  }

  // Приватные поля (замыкание)
  let _name = name;
  let _age = age;
  let _email = email || '';
  let _createdAt = new Date();
  let _lastLogin = null;
  let _loginCount = 0;

  return {
    // Геттеры
    getName() {
      return _name;
    },
    getAge() {
      return _age;
    },
    getEmail() {
      return _email;
    },
    getCreatedAt() {
      return new Date(_createdAt);
    },
    getLastLogin() {
      return _lastLogin ? new Date(_lastLogin) : null;
    },
    getLoginCount() {
      return _loginCount;
    },

    // Сеттеры с валидацией
    setName(newName) {
      if (!newName || typeof newName !== 'string') {
        throw new Error('Name must be a non-empty string');
      }
      _name = newName;
      return this;
    },
    setAge(newAge) {
      if (typeof newAge !== 'number' || newAge < 0 || newAge > 150) {
        throw new Error('Age must be a number between 0 and 150');
      }
      _age = newAge;
      return this;
    },
    setEmail(newEmail) {
      if (newEmail && typeof newEmail !== 'string') {
        throw new Error('Email must be a string');
      }
      if (newEmail && !newEmail.includes('@')) {
        throw new Error('Invalid email format');
      }
      _email = newEmail;
      return this;
    },

    // Действия
    greet() {
      return `Hello, ${_name}!`;
    },
    isAdult() {
      return _age >= 18;
    },
    isSenior() {
      return _age >= 65;
    },
    canVote() {
      return this.isAdult() && !this.isSenior();
    },
    login() {
      _lastLogin = new Date();
      _loginCount++;
      return this;
    },
    logout() {
      return this;
    },
    getProfile() {
      return {
        name: _name,
        age: _age,
        email: _email,
        createdAt: _createdAt,
        lastLogin: _lastLogin,
        loginCount: _loginCount,
        isAdult: this.isAdult(),
        isSenior: this.isSenior(),
      };
    },
    updateProfile(data) {
      if (data.name) this.setName(data.name);
      if (data.age !== undefined) this.setAge(data.age);
      if (data.email) this.setEmail(data.email);
      return this;
    },
    toJSON() {
      return {
        name: _name,
        age: _age,
        email: _email,
        createdAt: _createdAt.toISOString(),
        lastLogin: _lastLogin ? _lastLogin.toISOString() : null,
        loginCount: _loginCount,
      };
    },
    toString() {
      return `User(${_name}, ${_age}, ${_email})`;
    },
  };
}

/**
 * Создает фабрику продуктов
 * @param {string} name - Название продукта
 * @param {number} price - Цена продукта
 * @param {string} category - Категория продукта
 * @returns {Object} - Объект продукта с методами
 */
function createProduct(name, price, category = 'general') {
  if (!name || typeof name !== 'string') {
    throw new Error('Product name is required');
  }
  if (typeof price !== 'number' || price < 0) {
    throw new Error('Price must be a non-negative number');
  }
  if (category && typeof category !== 'string') {
    throw new Error('Category must be a string');
  }

  let _name = name;
  let _price = price;
  let _category = category;
  let _inStock = true;
  let _quantity = 0;
  let _createdAt = new Date();
  let _discount = 0;

  return {
    getName() {
      return _name;
    },
    getPrice() {
      return _price;
    },
    getCategory() {
      return _category;
    },
    getQuantity() {
      return _quantity;
    },
    isInStock() {
      return _inStock && _quantity > 0;
    },
    getDiscount() {
      return _discount;
    },
    getDiscountedPrice() {
      return _price * (1 - _discount / 100);
    },

    setName(newName) {
      if (!newName || typeof newName !== 'string') {
        throw new Error('Name must be a non-empty string');
      }
      _name = newName;
      return this;
    },
    setPrice(newPrice) {
      if (typeof newPrice !== 'number' || newPrice < 0) {
        throw new Error('Price must be a non-negative number');
      }
      _price = newPrice;
      return this;
    },
    setCategory(newCategory) {
      if (!newCategory || typeof newCategory !== 'string') {
        throw new Error('Category must be a non-empty string');
      }
      _category = newCategory;
      return this;
    },
    setQuantity(newQuantity) {
      if (typeof newQuantity !== 'number' || newQuantity < 0 || !Number.isInteger(newQuantity)) {
        throw new Error('Quantity must be a non-negative integer');
      }
      _quantity = newQuantity;
      _inStock = _quantity > 0;
      return this;
    },
    setDiscount(newDiscount) {
      if (typeof newDiscount !== 'number' || newDiscount < 0 || newDiscount > 100) {
        throw new Error('Discount must be between 0 and 100');
      }
      _discount = newDiscount;
      return this;
    },

    addStock(amount) {
      if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
        throw new Error('Amount must be a positive integer');
      }
      _quantity += amount;
      _inStock = true;
      return this;
    },
    removeStock(amount) {
      if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
        throw new Error('Amount must be a positive integer');
      }
      if (amount > _quantity) {
        throw new Error('Not enough stock');
      }
      _quantity -= amount;
      _inStock = _quantity > 0;
      return this;
    },

    applyDiscount(percent) {
      this.setDiscount(percent);
      return this;
    },
    removeDiscount() {
      _discount = 0;
      return this;
    },

    getProductInfo() {
      return {
        name: _name,
        price: _price,
        discountedPrice: this.getDiscountedPrice(),
        category: _category,
        quantity: _quantity,
        inStock: this.isInStock(),
        discount: _discount,
        createdAt: _createdAt,
      };
    },
    toJSON() {
      return {
        name: _name,
        price: _price,
        discountedPrice: this.getDiscountedPrice(),
        category: _category,
        quantity: _quantity,
        inStock: this.isInStock(),
        discount: _discount,
        createdAt: _createdAt.toISOString(),
      };
    },
  };
}

/**
 * Создает фабрику заказов
 * @param {Object} user - Объект пользователя
 * @param {Array} items - Массив продуктов в заказе
 * @returns {Object} - Объект заказа с методами
 */
function createOrder(user, items = []) {
  if (!user || typeof user !== 'object') {
    throw new Error('User is required');
  }
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array');
  }

  let _user = user;
  let _items = [...items];
  let _status = 'pending';
  let _createdAt = new Date();
  let _updatedAt = new Date();
  let _total = calculateTotal(_items);
  let _discount = 0;
  let _shippingAddress = null;
  let _paymentMethod = null;
  let _notes = '';

  function calculateTotal(items) {
    return items.reduce((sum, item) => {
      const price =
        typeof item.getDiscountedPrice === 'function' ? item.getDiscountedPrice() : item.price || 0;
      const quantity = item.quantity || 1;
      return sum + price * quantity;
    }, 0);
  }

  function recalculateTotal() {
    _total = calculateTotal(_items);
    return _total;
  }

  return {
    getUser() {
      return _user;
    },
    getItems() {
      return [..._items];
    },
    getStatus() {
      return _status;
    },
    getTotal() {
      return _total;
    },
    getDiscount() {
      return _discount;
    },
    getCreatedAt() {
      return new Date(_createdAt);
    },
    getUpdatedAt() {
      return new Date(_updatedAt);
    },
    getShippingAddress() {
      return _shippingAddress;
    },
    getPaymentMethod() {
      return _paymentMethod;
    },
    getNotes() {
      return _notes;
    },

    setUser(newUser) {
      if (!newUser || typeof newUser !== 'object') {
        throw new Error('User must be an object');
      }
      _user = newUser;
      _updatedAt = new Date();
      return this;
    },
    setItems(newItems) {
      if (!Array.isArray(newItems)) {
        throw new Error('Items must be an array');
      }
      _items = [...newItems];
      recalculateTotal();
      _updatedAt = new Date();
      return this;
    },
    setDiscount(newDiscount) {
      if (typeof newDiscount !== 'number' || newDiscount < 0 || newDiscount > 100) {
        throw new Error('Discount must be between 0 and 100');
      }
      _discount = newDiscount;
      recalculateTotal();
      _updatedAt = new Date();
      return this;
    },
    setShippingAddress(address) {
      if (!address || typeof address !== 'object') {
        throw new Error('Shipping address must be an object');
      }
      _shippingAddress = { ...address };
      _updatedAt = new Date();
      return this;
    },
    setPaymentMethod(method) {
      if (!method || typeof method !== 'string') {
        throw new Error('Payment method must be a string');
      }
      _paymentMethod = method;
      _updatedAt = new Date();
      return this;
    },
    setNotes(notes) {
      if (typeof notes !== 'string') {
        throw new Error('Notes must be a string');
      }
      _notes = notes;
      _updatedAt = new Date();
      return this;
    },

    addItem(item, quantity = 1) {
      if (!item || typeof item !== 'object') {
        throw new Error('Item must be an object');
      }
      const existingItem = _items.find(i => i.id === item.id);
      if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 0) + quantity;
      } else {
        _items.push({ ...item, quantity });
      }
      recalculateTotal();
      _updatedAt = new Date();
      return this;
    },
    removeItem(itemId) {
      _items = _items.filter(item => item.id !== itemId);
      recalculateTotal();
      _updatedAt = new Date();
      return this;
    },
    updateItemQuantity(itemId, quantity) {
      const item = _items.find(i => i.id === itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }
      if (typeof quantity !== 'number' || quantity < 0) {
        throw new Error('Quantity must be a non-negative number');
      }
      item.quantity = quantity;
      recalculateTotal();
      _updatedAt = new Date();
      return this;
    },

    submit() {
      if (_items.length === 0) {
        throw new Error('Order must have at least one item');
      }
      if (!_shippingAddress) {
        throw new Error('Shipping address is required');
      }
      _status = 'submitted';
      _updatedAt = new Date();
      return this;
    },
    confirm() {
      if (_status !== 'submitted') {
        throw new Error('Order must be submitted first');
      }
      _status = 'confirmed';
      _updatedAt = new Date();
      return this;
    },
    ship() {
      if (_status !== 'confirmed') {
        throw new Error('Order must be confirmed first');
      }
      _status = 'shipped';
      _updatedAt = new Date();
      return this;
    },
    deliver() {
      if (_status !== 'shipped') {
        throw new Error('Order must be shipped first');
      }
      _status = 'delivered';
      _updatedAt = new Date();
      return this;
    },
    cancel() {
      if (['shipped', 'delivered'].includes(_status)) {
        throw new Error('Cannot cancel shipped or delivered order');
      }
      _status = 'cancelled';
      _updatedAt = new Date();
      return this;
    },

    getOrderSummary() {
      return {
        user: _user,
        items: _items,
        status: _status,
        total: _total,
        discount: _discount,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        shippingAddress: _shippingAddress,
        paymentMethod: _paymentMethod,
        notes: _notes,
      };
    },
    toJSON() {
      return {
        user: _user.toJSON ? _user.toJSON() : _user,
        items: _items.map(item => (item.toJSON ? item.toJSON() : item)),
        status: _status,
        total: _total,
        discount: _discount,
        createdAt: _createdAt.toISOString(),
        updatedAt: _updatedAt.toISOString(),
        shippingAddress: _shippingAddress,
        paymentMethod: _paymentMethod,
        notes: _notes,
      };
    },
  };
}

/**
 * Создает фабрику настроек (конфигурации)
 * @param {Object} defaults - Настройки по умолчанию
 * @returns {Object} - Объект настроек с методами
 */
function createConfig(defaults = {}) {
  let _config = { ...defaults };
  let _history = [];
  let _listeners = [];

  function notifyListeners(key, oldValue, newValue) {
    for (const listener of _listeners) {
      try {
        listener(key, oldValue, newValue);
      } catch (error) {
        console.error('Config listener error:', error);
      }
    }
  }

  return {
    get(key) {
      if (key === undefined) {
        return { ..._config };
      }
      return _config[key];
    },
    set(key, value) {
      if (typeof key !== 'string') {
        throw new Error('Key must be a string');
      }
      const oldValue = _config[key];
      if (oldValue !== value) {
        _history.push({
          key,
          oldValue,
          newValue: value,
          timestamp: new Date(),
        });
        _config[key] = value;
        notifyListeners(key, oldValue, value);
      }
      return this;
    },
    setMultiple(config) {
      if (typeof config !== 'object' || config === null) {
        throw new Error('Config must be an object');
      }
      for (const [key, value] of Object.entries(config)) {
        this.set(key, value);
      }
      return this;
    },
    has(key) {
      return key in _config;
    },
    delete(key) {
      if (key in _config) {
        const oldValue = _config[key];
        delete _config[key];
        _history.push({
          key,
          oldValue,
          newValue: undefined,
          timestamp: new Date(),
        });
        notifyListeners(key, oldValue, undefined);
        return true;
      }
      return false;
    },
    clear() {
      _config = {};
      _history.push({
        key: '*',
        oldValue: 'all',
        newValue: 'cleared',
        timestamp: new Date(),
      });
      return this;
    },
    reset() {
      _config = { ...defaults };
      _history.push({
        key: '*',
        oldValue: 'custom',
        newValue: 'defaults',
        timestamp: new Date(),
      });
      return this;
    },
    getHistory() {
      return [..._history];
    },
    getHistoryFor(key) {
      return _history.filter(entry => entry.key === key);
    },
    on(listener) {
      if (typeof listener !== 'function') {
        throw new Error('Listener must be a function');
      }
      _listeners.push(listener);
      return () => {
        _listeners = _listeners.filter(l => l !== listener);
      };
    },
    toJSON() {
      return { ..._config };
    },
  };
}

/**
 * Создает фабрику пула объектов (Object Pool)
 * @param {Function} factory - Функция создания объекта
 * @param {number} maxSize - Максимальный размер пула
 * @returns {Object} - Объект пула с методами
 */
function createObjectPool(factory, maxSize = 10) {
  if (typeof factory !== 'function') {
    throw new Error('Factory must be a function');
  }
  if (typeof maxSize !== 'number' || maxSize < 1) {
    throw new Error('Max size must be a positive number');
  }

  let _pool = [];
  let _active = new Set();
  let _created = 0;
  let _hits = 0;
  let _misses = 0;

  return {
    acquire() {
      // Ищем свободный объект
      for (let i = 0; i < _pool.length; i++) {
        const obj = _pool[i];
        if (!_active.has(obj)) {
          _active.add(obj);
          _hits++;
          return obj;
        }
      }

      // Создаем новый объект
      if (_created >= maxSize) {
        throw new Error('Object pool exhausted');
      }

      const obj = factory();
      _pool.push(obj);
      _active.add(obj);
      _created++;
      _misses++;
      return obj;
    },
    release(obj) {
      if (!_active.has(obj)) {
        throw new Error('Object not active in pool');
      }
      _active.delete(obj);
      return this;
    },
    getStats() {
      return {
        poolSize: _pool.length,
        activeSize: _active.size,
        available: _pool.length - _active.size,
        created: _created,
        hits: _hits,
        misses: _misses,
        hitRate: _created > 0 ? (_hits / (_hits + _misses)) * 100 : 0,
        maxSize,
      };
    },
    clear() {
      _pool = [];
      _active.clear();
      return this;
    },
  };
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export { createUser, createProduct, createOrder, createConfig, createObjectPool };

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с фабричными функциями
 */
export default {
  createUser,
  createProduct,
  createOrder,
  createConfig,
  createObjectPool,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ ФАБРИК ОБЪЕКТОВ
 *
 * Этот модуль предоставляет 5 фабричных функций для создания
 * различных типов объектов:
 *
 * 1. createUser - Создает пользователя с методами
 *    - Геттеры и сеттеры с валидацией
 *    - Методы: greet, isAdult, isSenior, canVote, login, logout
 *    - Профиль и сериализация
 *
 * 2. createProduct - Создает продукт с методами
 *    - Управление ценой, количеством, скидкой
 *    - Методы: addStock, removeStock, applyDiscount
 *    - Информация о продукте
 *
 * 3. createOrder - Создает заказ с методами
 *    - Управление товарами, статусом, доставкой
 *    - Методы: addItem, removeItem, submit, confirm, ship
 *    - Сводка заказа и сериализация
 *
 * 4. createConfig - Создает конфигурацию с методами
 *    - Управление настройками
 *    - История изменений
 *    - Слушатели событий
 *
 * 5. createObjectPool - Создает пул объектов
 *    - Управление пулом объектов
 *    - Статистика использования
 *    - Очистка пула
 *
 * Особенности:
 * - Все фабрики используют замыкания для приватных полей
 * - Валидация входных данных
 * - Методы возвращают this для цепочки вызовов
 * - Поддержка сериализации (toJSON, toString)
 */
