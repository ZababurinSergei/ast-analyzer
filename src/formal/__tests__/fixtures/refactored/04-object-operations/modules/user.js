// packages/ast-analyzer/src/formal/__tests__/fixtures/refactored/04-object-operations/modules/user.js

// ============================================
// МОДУЛЬ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ
// ============================================
// Этот модуль содержит функции для создания, управления
// и валидации пользовательских объектов.

/**
 * Класс User - представляет пользователя системы
 */
class User {
  /**
   * Создает нового пользователя
   * @param {Object} data - Данные пользователя
   * @param {string} data.id - Уникальный идентификатор
   * @param {string} data.name - Полное имя
   * @param {number} data.age - Возраст
   * @param {string} data.email - Email адрес
   * @param {string} data.role - Роль (admin, user, guest)
   * @param {Object} data.settings - Настройки пользователя
   */
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.age = data.age || 0;
    this.email = data.email || '';
    this.role = data.role || 'user';
    this.settings = {
      theme: data.settings?.theme || 'light',
      language: data.settings?.language || 'en',
      notifications:
        data.settings?.notifications !== undefined ? data.settings.notifications : true,
      timezone: data.settings?.timezone || 'UTC',
    };
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.metadata = data.metadata || {};
  }

  /**
   * Генерирует уникальный ID
   * @returns {string} - Уникальный ID
   */
  generateId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Обновляет данные пользователя
   * @param {Object} updates - Обновляемые поля
   * @returns {User} - Обновленный пользователь
   */
  update(updates) {
    const allowedFields = ['name', 'age', 'email', 'role', 'settings', 'isActive'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'settings' && typeof updates[field] === 'object') {
          this.settings = { ...this.settings, ...updates[field] };
        } else {
          this[field] = updates[field];
        }
      }
    }
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Получает полное имя пользователя
   * @returns {string} - Полное имя
   */
  getFullName() {
    return this.name;
  }

  /**
   * Получает инициалы пользователя
   * @returns {string} - Инициалы
   */
  getInitials() {
    if (!this.name) return '?';
    const parts = this.name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Проверяет, является ли пользователь взрослым
   * @returns {boolean} - true если возраст >= 18
   */
  isAdult() {
    return this.age >= 18;
  }

  /**
   * Проверяет, является ли пользователь администратором
   * @returns {boolean} - true если роль admin
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Проверяет, является ли пользователь гостем
   * @returns {boolean} - true если роль guest
   */
  isGuest() {
    return this.role === 'guest';
  }

  /**
   * Активирует пользователя
   * @returns {User} - Обновленный пользователь
   */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Деактивирует пользователя
   * @returns {User} - Обновленный пользователь
   */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Проверяет, активен ли пользователь
   * @returns {boolean} - true если активен
   */
  isActiveUser() {
    return this.isActive;
  }

  /**
   * Преобразует пользователя в JSON объект
   * @returns {Object} - JSON представление
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      age: this.age,
      email: this.email,
      role: this.role,
      settings: { ...this.settings },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive,
      metadata: { ...this.metadata },
    };
  }

  /**
   * Клонирует пользователя
   * @returns {User} - Клон пользователя
   */
  clone() {
    return new User(this.toJSON());
  }
}

/**
 * Создает нового пользователя (фабричная функция)
 * @param {Object} data - Данные пользователя
 * @returns {User} - Новый пользователь
 */
function createUser(data) {
  return new User(data);
}

/**
 * Создает пользователя с настройками по умолчанию
 * @param {string} name - Имя пользователя
 * @param {number} age - Возраст
 * @param {string} email - Email
 * @returns {User} - Пользователь с настройками по умолчанию
 */
function createDefaultUser(name, age, email) {
  return new User({
    name,
    age,
    email,
    role: 'user',
    settings: {
      theme: 'light',
      language: 'en',
      notifications: true,
      timezone: 'UTC',
    },
  });
}

/**
 * Создает администратора
 * @param {string} name - Имя администратора
 * @param {string} email - Email администратора
 * @returns {User} - Администратор
 */
function createAdmin(name, email) {
  return new User({
    name,
    age: 25,
    email,
    role: 'admin',
    settings: {
      theme: 'dark',
      language: 'en',
      notifications: true,
      timezone: 'UTC',
    },
  });
}

/**
 * Создает гостевого пользователя
 * @param {string} name - Имя гостя (опционально)
 * @returns {User} - Гостевой пользователь
 */
function createGuest(name = 'Guest') {
  return new User({
    name,
    age: 0,
    email: '',
    role: 'guest',
    settings: {
      theme: 'light',
      language: 'en',
      notifications: false,
      timezone: 'UTC',
    },
  });
}

/**
 * Валидирует данные пользователя
 * @param {Object} data - Данные для валидации
 * @returns {Object} - Результат валидации { valid: boolean, errors: string[] }
 */
function validateUserData(data) {
  const errors = [];

  // Проверка имени
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Name is required and must be a string');
  } else if (data.name.length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (data.name.length > 100) {
    errors.push('Name must be less than 100 characters');
  }

  // Проверка возраста
  if (data.age === undefined || data.age === null) {
    errors.push('Age is required');
  } else if (typeof data.age !== 'number') {
    errors.push('Age must be a number');
  } else if (data.age < 0) {
    errors.push('Age must be non-negative');
  } else if (data.age > 150) {
    errors.push('Age must be less than 150');
  }

  // Проверка email
  if (data.email && typeof data.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  } else if (data.role !== 'guest') {
    errors.push('Email is required for non-guest users');
  }

  // Проверка роли
  if (data.role && !['admin', 'user', 'guest'].includes(data.role)) {
    errors.push('Invalid role. Must be admin, user, or guest');
  }

  // Проверка настроек
  if (data.settings && typeof data.settings === 'object') {
    if (data.settings.theme && !['light', 'dark', 'system'].includes(data.settings.theme)) {
      errors.push('Invalid theme. Must be light, dark, or system');
    }
    if (data.settings.language && typeof data.settings.language !== 'string') {
      errors.push('Language must be a string');
    }
    if (
      data.settings.notifications !== undefined &&
      typeof data.settings.notifications !== 'boolean'
    ) {
      errors.push('Notifications must be a boolean');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Обновляет статус пользователя
 * @param {User} user - Пользователь
 * @param {string} status - Новый статус (active, inactive, suspended)
 * @returns {User} - Обновленный пользователь
 */
function updateUserStatus(user, status) {
  if (!(user instanceof User)) {
    throw new TypeError('Expected User instance');
  }

  const validStatuses = ['active', 'inactive', 'suspended'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  user.isActive = status === 'active';
  user.metadata = user.metadata || {};
  user.metadata.status = status;
  user.metadata.statusUpdatedAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();

  return user;
}

/**
 * Обновляет роль пользователя
 * @param {User} user - Пользователь
 * @param {string} role - Новая роль
 * @returns {User} - Обновленный пользователь
 */
function updateUserRole(user, role) {
  if (!(user instanceof User)) {
    throw new TypeError('Expected User instance');
  }

  const validRoles = ['admin', 'user', 'guest'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  user.role = role;
  user.metadata = user.metadata || {};
  user.metadata.roleUpdatedAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();

  return user;
}

/**
 * Обновляет настройки пользователя
 * @param {User} user - Пользователь
 * @param {Object} settings - Новые настройки
 * @returns {User} - Обновленный пользователь
 */
function updateUserSettings(user, settings) {
  if (!(user instanceof User)) {
    throw new TypeError('Expected User instance');
  }

  if (typeof settings !== 'object' || settings === null) {
    throw new TypeError('Settings must be an object');
  }

  user.settings = { ...user.settings, ...settings };
  user.updatedAt = new Date().toISOString();

  return user;
}

/**
 * Проверяет, имеет ли пользователь доступ к ресурсу
 * @param {User} user - Пользователь
 * @param {string} resource - Ресурс
 * @param {string} action - Действие (read, write, delete)
 * @returns {boolean} - true если доступ разрешен
 */
function hasPermission(user, resource, action) {
  if (!(user instanceof User)) {
    throw new TypeError('Expected User instance');
  }

  // Простая система разрешений
  const permissions = {
    admin: {
      '*': ['read', 'write', 'delete'],
    },
    user: {
      profile: ['read', 'write'],
      settings: ['read', 'write'],
      public: ['read'],
    },
    guest: {
      public: ['read'],
    },
  };

  const userPermissions = permissions[user.role] || permissions.guest;

  // Проверка на wildcard
  if (userPermissions['*']) {
    return userPermissions['*'].includes(action);
  }

  const resourcePermissions = userPermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}

/**
 * Получает список всех пользователей с фильтрацией
 * @param {Array<User>} users - Массив пользователей
 * @param {Object} filters - Фильтры
 * @param {string} filters.role - Фильтр по роли
 * @param {boolean} filters.active - Фильтр по активности
 * @param {number} filters.minAge - Минимальный возраст
 * @param {number} filters.maxAge - Максимальный возраст
 * @returns {Array<User>} - Отфильтрованный массив пользователей
 */
function filterUsers(users, filters = {}) {
  if (!Array.isArray(users)) {
    throw new TypeError('Expected array of users');
  }

  return users.filter(user => {
    if (!(user instanceof User)) return false;

    if (filters.role && user.role !== filters.role) return false;
    if (filters.active !== undefined && user.isActive !== filters.active) return false;
    if (filters.minAge !== undefined && user.age < filters.minAge) return false;
    if (filters.maxAge !== undefined && user.age > filters.maxAge) return false;

    return true;
  });
}

/**
 * Сортирует пользователей по заданному полю
 * @param {Array<User>} users - Массив пользователей
 * @param {string} field - Поле для сортировки
 * @param {boolean} ascending - Направление сортировки
 * @returns {Array<User>} - Отсортированный массив
 */
function sortUsers(users, field = 'name', ascending = true) {
  if (!Array.isArray(users)) {
    throw new TypeError('Expected array of users');
  }

  return [...users].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return ascending ? -1 : 1;
    if (aVal > bVal) return ascending ? 1 : -1;
    return 0;
  });
}

/**
 * Группирует пользователей по роли
 * @param {Array<User>} users - Массив пользователей
 * @returns {Object} - Объект с группами пользователей
 */
function groupUsersByRole(users) {
  if (!Array.isArray(users)) {
    throw new TypeError('Expected array of users');
  }

  const groups = { admin: [], user: [], guest: [] };

  for (const user of users) {
    if (user instanceof User && groups[user.role]) {
      groups[user.role].push(user);
    }
  }

  return groups;
}

/**
 * Получает статистику по пользователям
 * @param {Array<User>} users - Массив пользователей
 * @returns {Object} - Статистика
 */
function getUserStatistics(users) {
  if (!Array.isArray(users)) {
    throw new TypeError('Expected array of users');
  }

  if (users.length === 0) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      admins: 0,
      users: 0,
      guests: 0,
      averageAge: 0,
      minAge: 0,
      maxAge: 0,
    };
  }

  const stats = {
    total: users.length,
    active: 0,
    inactive: 0,
    admins: 0,
    users: 0,
    guests: 0,
    totalAge: 0,
    minAge: Infinity,
    maxAge: -Infinity,
  };

  for (const user of users) {
    if (!(user instanceof User)) continue;

    if (user.isActive) stats.active++;
    else stats.inactive++;

    if (user.role === 'admin') stats.admins++;
    else if (user.role === 'user') stats.users++;
    else if (user.role === 'guest') stats.guests++;

    stats.totalAge += user.age;
    if (user.age < stats.minAge) stats.minAge = user.age;
    if (user.age > stats.maxAge) stats.maxAge = user.age;
  }

  return {
    total: stats.total,
    active: stats.active,
    inactive: stats.inactive,
    admins: stats.admins,
    users: stats.users,
    guests: stats.guests,
    averageAge: stats.totalAge / stats.total,
    minAge: stats.minAge === Infinity ? 0 : stats.minAge,
    maxAge: stats.maxAge === -Infinity ? 0 : stats.maxAge,
  };
}

// ============================================
// ЭКСПОРТЫ
// ============================================

export {
  // Класс пользователя
  User,

  // Фабричные функции
  createUser,
  createDefaultUser,
  createAdmin,
  createGuest,

  // Валидация
  validateUserData,

  // Управление пользователями
  updateUserStatus,
  updateUserRole,
  updateUserSettings,
  hasPermission,

  // Операции с коллекциями
  filterUsers,
  sortUsers,
  groupUsersByRole,
  getUserStatistics,
};

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

/**
 * Основной объект с функциями работы с пользователями
 */
export default {
  User,
  createUser,
  createDefaultUser,
  createAdmin,
  createGuest,
  validateUserData,
  updateUserStatus,
  updateUserRole,
  updateUserSettings,
  hasPermission,
  filterUsers,
  sortUsers,
  groupUsersByRole,
  getUserStatistics,
};

// ============================================
// ПРИМЕЧАНИЯ ПО ИСПОЛЬЗОВАНИЮ
// ============================================

/*
 * МОДУЛЬ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ
 *
 * Этот модуль предоставляет полный набор функций для работы с пользователями:
 *
 * 1. Класс User:
 *    - Управление данными пользователя
 *    - Методы для обновления и валидации
 *    - Проверка прав доступа
 *
 * 2. Фабричные функции:
 *    - createUser - создание пользователя
 *    - createDefaultUser - пользователь по умолчанию
 *    - createAdmin - администратор
 *    - createGuest - гость
 *
 * 3. Валидация:
 *    - validateUserData - проверка данных пользователя
 *
 * 4. Управление:
 *    - updateUserStatus - обновление статуса
 *    - updateUserRole - обновление роли
 *    - updateUserSettings - обновление настроек
 *    - hasPermission - проверка прав доступа
 *
 * 5. Коллекции:
 *    - filterUsers - фильтрация пользователей
 *    - sortUsers - сортировка
 *    - groupUsersByRole - группировка по ролям
 *    - getUserStatistics - статистика
 *
 * Особенности:
 * - Все функции валидируют входные данные
 * - Поддерживают глубокое клонирование
 * - Имеют систему разрешений на основе ролей
 * - Поддерживают различные типы пользователей
 */
