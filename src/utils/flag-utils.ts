// src/utils/flag-utils.ts
// МАКСИМАЛЬНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ - LRU Cache + Precomputed Hot Combinations

/**
 * Перечисление битовых флагов для функций
 */
export enum FunctionFlags {
  ASYNC = 1 << 0,        // 1
  NESTED = 1 << 1,       // 2
  ARROW = 1 << 2,        // 4
  METHOD = 1 << 3,       // 8
  EVENT_HANDLER = 1 << 4, // 16
  EXPORTED = 1 << 5,     // 32
  CONST = 1 << 6,        // 64
  MACRO = 1 << 7,        // 128
  COMPOSABLE = 1 << 8,   // 256
  GENERATOR = 1 << 9,    // 512
  PRIVATE = 1 << 10,     // 1024
  PROTECTED = 1 << 11,   // 2048
  STATIC = 1 << 12,      // 4096
  READONLY = 1 << 13,    // 8192
  OPTIONAL = 1 << 14,    // 16384
  NULLABLE = 1 << 15,    // 32768
  DEFAULT_EXPORT = 1 << 16, // 65536
  SELF = 1 << 17,        // 131072
  DYNAMIC = 1 << 18,     // 262144
  CONFIG = 1 << 19,      // 524288
  EXTERNAL = 1 << 20,    // 1048576
  VUE_TEMPLATE = 1 << 21, // 2097152
  ASYNC_CHAIN = 1 << 22, // 4194304
  CLOSURE = 1 << 23,     // 8388608
  TYPE_DEP = 1 << 24,    // 16777216
}

// ============================================
// LRU CACHE ДЛЯ МАКСИМАЛЬНОЙ ПРОИЗВОДИТЕЛЬНОСТИ
// ============================================

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 2000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
      // Обновляем позицию (перемещаем в конец)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Удаляем первый (самый старый) элемент
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// ============================================
// ПРЕДВАРИТЕЛЬНО ВЫЧИСЛЕННЫЕ ГОРЯЧИЕ КОМБИНАЦИИ
// ============================================

// Только самые частые комбинации (не все 33 миллиона!)
const HOT_COMBINATIONS = new Map<number, Record<string, boolean>>();

// Предварительно вычисляем ТОЛЬКО часто используемые комбинации
function precomputeHotCombinations(): void {
  // 1. Базовая функция (без флагов)
  HOT_COMBINATIONS.set(0, {});

  // 2. Экспортированная функция
  HOT_COMBINATIONS.set(FunctionFlags.EXPORTED, { isExported: true });

  // 3. Асинхронная функция
  HOT_COMBINATIONS.set(FunctionFlags.ASYNC, { isAsync: true });

  // 4. Стрелочная функция
  HOT_COMBINATIONS.set(FunctionFlags.ARROW, { isArrow: true });

  // 5. Экспортированная + асинхронная
  HOT_COMBINATIONS.set(
    FunctionFlags.EXPORTED | FunctionFlags.ASYNC,
    { isExported: true, isAsync: true }
  );

  // 6. Экспортированная + стрелочная
  HOT_COMBINATIONS.set(
    FunctionFlags.EXPORTED | FunctionFlags.ARROW,
    { isExported: true, isArrow: true }
  );

  // 7. Метод класса
  HOT_COMBINATIONS.set(
    FunctionFlags.METHOD | FunctionFlags.NESTED,
    { isMethod: true, isNested: true }
  );

  // 8. Экспортированный метод
  HOT_COMBINATIONS.set(
    FunctionFlags.EXPORTED | FunctionFlags.METHOD | FunctionFlags.NESTED,
    { isExported: true, isMethod: true, isNested: true }
  );

  // 9. Vue composable
  HOT_COMBINATIONS.set(
    FunctionFlags.COMPOSABLE | FunctionFlags.EXPORTED,
    { isComposable: true, isExported: true }
  );

  // 10. Self функция (изолированная)
  HOT_COMBINATIONS.set(
    FunctionFlags.SELF,
    { isSelf: true }
  );

  // 11. Async + Self
  HOT_COMBINATIONS.set(
    FunctionFlags.ASYNC | FunctionFlags.SELF,
    { isAsync: true, isSelf: true }
  );

  // 12. Экспортированная + Self
  HOT_COMBINATIONS.set(
    FunctionFlags.EXPORTED | FunctionFlags.SELF,
    { isExported: true, isSelf: true }
  );

  // 13. Vue макрос
  HOT_COMBINATIONS.set(
    FunctionFlags.MACRO | FunctionFlags.EXPORTED,
    { isMacro: true, isExported: true }
  );

  // 14. Асинхронная цепочка
  HOT_COMBINATIONS.set(
    FunctionFlags.ASYNC_CHAIN,
    { isAsyncChain: true }
  );

  // 15. Замыкание
  HOT_COMBINATIONS.set(
    FunctionFlags.CLOSURE,
    { isClosure: true }
  );

  // 16. Типовая зависимость
  HOT_COMBINATIONS.set(
    FunctionFlags.TYPE_DEP,
    { isTypeDep: true }
  );

  // 17. Асинхронная + вложенная
  HOT_COMBINATIONS.set(
    FunctionFlags.ASYNC | FunctionFlags.NESTED,
    { isAsync: true, isNested: true }
  );

  // 18. Экспортированная + вложенная
  HOT_COMBINATIONS.set(
    FunctionFlags.EXPORTED | FunctionFlags.NESTED,
    { isExported: true, isNested: true }
  );

  // 19. Динамический импорт
  HOT_COMBINATIONS.set(
    FunctionFlags.DYNAMIC,
    { isDynamic: true }
  );

  // 20. Внешняя библиотека
  HOT_COMBINATIONS.set(
    FunctionFlags.EXTERNAL,
    { isExternal: true }
  );
}

// Выполняем предварительное вычисление горячих комбинаций
precomputeHotCombinations();

// ============================================
// ОСНОВНОЙ КЭШ ДЛЯ ДЕКОДИРОВАНИЯ
// ============================================

const decodeCache = new LRUCache<number, Record<string, boolean>>(2000);

// Список всех флагов для итерации
const FLAG_ENTRIES = Object.entries(FunctionFlags)
  .filter(([key, value]) => typeof value === 'number' && !key.startsWith('_'))
  .map(([key, value]) => ({ key, value: value as number }));

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================

/**
 * Кодирует булевы свойства в битовые флаги (оптимизировано)
 */
export function encodeFlags(entity: any): number {
  let flags = 0;

  if (entity.isAsync) flags |= FunctionFlags.ASYNC;
  if (entity.isNested) flags |= FunctionFlags.NESTED;
  if (entity.isArrow) flags |= FunctionFlags.ARROW;
  if (entity.isMethod) flags |= FunctionFlags.METHOD;
  if (entity.isEventHandler) flags |= FunctionFlags.EVENT_HANDLER;
  if (entity.isExported) flags |= FunctionFlags.EXPORTED;
  if (entity.isConst) flags |= FunctionFlags.CONST;
  if (entity.isMacro) flags |= FunctionFlags.MACRO;
  if (entity.isComposable) flags |= FunctionFlags.COMPOSABLE;
  if (entity.isGenerator) flags |= FunctionFlags.GENERATOR;
  if (entity.isPrivate) flags |= FunctionFlags.PRIVATE;
  if (entity.isProtected) flags |= FunctionFlags.PROTECTED;
  if (entity.isStatic) flags |= FunctionFlags.STATIC;
  if (entity.isReadonly) flags |= FunctionFlags.READONLY;
  if (entity.isOptional) flags |= FunctionFlags.OPTIONAL;
  if (entity.isNullable) flags |= FunctionFlags.NULLABLE;
  if (entity.isDefaultExport) flags |= FunctionFlags.DEFAULT_EXPORT;
  if (entity.isSelf) flags |= FunctionFlags.SELF;
  if (entity.isDynamic) flags |= FunctionFlags.DYNAMIC;
  if (entity.isConfig) flags |= FunctionFlags.CONFIG;
  if (entity.isExternal) flags |= FunctionFlags.EXTERNAL;
  if (entity.isVueTemplate) flags |= FunctionFlags.VUE_TEMPLATE;
  if (entity.isAsyncChain) flags |= FunctionFlags.ASYNC_CHAIN;
  if (entity.isClosure) flags |= FunctionFlags.CLOSURE;
  if (entity.isTypeDep) flags |= FunctionFlags.TYPE_DEP;

  return flags;
}

/**
 * Декодирует флаги (с использованием LRU-кэша и горячих комбинаций)
 * МАКСИМАЛЬНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ
 */
export function decodeFlags(flags: number): Record<string, boolean> {
  // 1. Проверяем горячие комбинации (O(1))
  const hot = HOT_COMBINATIONS.get(flags);
  if (hot !== undefined) {
    return { ...hot };
  }

  // 2. Проверяем LRU-кэш (O(1))
  const cached = decodeCache.get(flags);
  if (cached !== undefined) {
    return cached;
  }

  // 3. Вычисляем на лету (редкий случай)
  const result: Record<string, boolean> = {};
  for (const { key, value } of FLAG_ENTRIES) {
    result[key.toLowerCase()] = !!(flags & value);
  }

  // Сохраняем в кэш
  decodeCache.set(flags, result);

  return result;
}

/**
 * Декодирует флаги с префиксом (для быстрого доступа)
 */
export function decodeFlagsPrefixed(flags: number, prefix: string = ''): Record<string, boolean> {
  const decoded = decodeFlags(flags);
  if (!prefix) return decoded;

  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(decoded)) {
    result[`${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
  }
  return result;
}

/**
 * Получает список установленных флагов (оптимизировано)
 */
export function getFlagsList(flags: number): string[] {
  const result: string[] = [];

  // Сначала проверяем горячие комбинации
  const hot = HOT_COMBINATIONS.get(flags);
  if (hot !== undefined) {
    return Object.keys(hot).map(k => k.toUpperCase());
  }

  // Иначе вычисляем
  for (const { key, value } of FLAG_ENTRIES) {
    if (flags & value) {
      result.push(key);
    }
  }

  return result;
}

/**
 * Проверяет, установлен ли флаг (быстрая проверка)
 */
export function hasFlag(flags: number, flag: FunctionFlags): boolean {
  return !!(flags & flag);
}

/**
 * Проверяет несколько флагов одновременно (оптимизировано)
 */
export function hasFlags(flags: number, ...flagList: FunctionFlags[]): boolean[] {
  return flagList.map(flag => !!(flags & flag));
}

/**
 * Проверяет, установлены ли ВСЕ указанные флаги
 */
export function hasAllFlags(flags: number, ...flagList: FunctionFlags[]): boolean {
  let mask = 0;
  for (const flag of flagList) {
    mask |= flag;
  }
  return (flags & mask) === mask;
}

/**
 * Проверяет, установлен ли ХОТЯ БЫ ОДИН из указанных флагов
 */
export function hasAnyFlag(flags: number, ...flagList: FunctionFlags[]): boolean {
  let mask = 0;
  for (const flag of flagList) {
    mask |= flag;
  }
  return !!(flags & mask);
}

/**
 * Устанавливает флаг
 */
export function setFlag(flags: number, flag: FunctionFlags): number {
  return flags | flag;
}

/**
 * Снимает флаг
 */
export function clearFlag(flags: number, flag: FunctionFlags): number {
  return flags & ~flag;
}

/**
 * Переключает флаг
 */
export function toggleFlag(flags: number, flag: FunctionFlags): number {
  return flags ^ flag;
}

/**
 * Кодирует флаги с кастомными полями
 */
export function encodeFlagsAdvanced(
  entity: any,
  customFieldMap?: Record<string, FunctionFlags>
): number {
  let flags = encodeFlags(entity);

  if (customFieldMap) {
    for (const [field, flag] of Object.entries(customFieldMap)) {
      if (entity[field]) {
        flags |= flag;
      }
    }
  }

  return flags;
}

/**
 * Декодирует флаги с кастомными полями
 */
export function decodeFlagsAdvanced(
  flags: number,
  customFieldMap?: Record<string, FunctionFlags>
): Record<string, boolean> {
  const result = decodeFlags(flags);

  if (customFieldMap) {
    for (const [field, flag] of Object.entries(customFieldMap)) {
      result[field] = !!(flags & flag);
    }
  }

  return result;
}

/**
 * Строковое представление флагов
 */
export function flagsToString(flags: number, separator: string = ' | '): string {
  return getFlagsList(flags).join(separator);
}

/**
 * Количество установленных флагов (быстрый подсчет)
 */
export function countFlags(flags: number): number {
  let count = 0;
  let temp = flags;
  while (temp) {
    count += temp & 1;
    temp >>= 1;
  }
  return count;
}

/**
 * Получить статистику кэша
 */
export function getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
  return decodeCache.getStats();
}

/**
 * Очистить кэш
 */
export function clearCache(): void {
  decodeCache.clear();
}

// ============================================
// КОНСТАНТЫ
// ============================================

export const STANDARD_FUNCTION = 0;
export const NESTED_FUNCTION = FunctionFlags.NESTED;
export const ASYNC_NESTED_FUNCTION = FunctionFlags.ASYNC | FunctionFlags.NESTED;
export const EXPORTED_FUNCTION = FunctionFlags.EXPORTED;
export const METHOD_FUNCTION = FunctionFlags.METHOD | FunctionFlags.NESTED;
export const ARROW_FUNCTION = FunctionFlags.ARROW;
export const COMPOSABLE_FUNCTION = FunctionFlags.COMPOSABLE | FunctionFlags.EXPORTED;
export const VUE_MACRO = FunctionFlags.MACRO | FunctionFlags.EXPORTED;
export const SELF_FUNCTION = FunctionFlags.SELF;
export const DYNAMIC_IMPORT = FunctionFlags.DYNAMIC;
export const CONFIG_FUNCTION = FunctionFlags.CONFIG;
export const EXTERNAL_LIB = FunctionFlags.EXTERNAL;
export const VUE_TEMPLATE_FUNCTION = FunctionFlags.VUE_TEMPLATE;
export const ASYNC_CHAIN_FUNCTION = FunctionFlags.ASYNC_CHAIN;
export const CLOSURE_FUNCTION = FunctionFlags.CLOSURE;
export const TYPE_DEP_FUNCTION = FunctionFlags.TYPE_DEP;

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  FunctionFlags,
  encodeFlags,
  decodeFlags,
  decodeFlagsPrefixed,
  getFlagsList,
  hasFlag,
  hasFlags,
  hasAllFlags,
  hasAnyFlag,
  setFlag,
  clearFlag,
  toggleFlag,
  encodeFlagsAdvanced,
  decodeFlagsAdvanced,
  flagsToString,
  countFlags,
  getCacheStats,
  clearCache,

  // Константы
  STANDARD_FUNCTION,
  NESTED_FUNCTION,
  ASYNC_NESTED_FUNCTION,
  EXPORTED_FUNCTION,
  METHOD_FUNCTION,
  ARROW_FUNCTION,
  COMPOSABLE_FUNCTION,
  VUE_MACRO,
  SELF_FUNCTION,
  DYNAMIC_IMPORT,
  CONFIG_FUNCTION,
  EXTERNAL_LIB,
  VUE_TEMPLATE_FUNCTION,
  ASYNC_CHAIN_FUNCTION,
  CLOSURE_FUNCTION,
  TYPE_DEP_FUNCTION,
};
