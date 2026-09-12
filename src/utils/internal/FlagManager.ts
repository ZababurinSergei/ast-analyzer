// src/utils/internal/FlagManager.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
// Исправлены ESLint ошибки: Array<T> → T[]

/**
 * Внутренний менеджер флагов
 * Все операции с флагами проходят через единый механизм
 * API полностью сохранен для обратной совместимости
 */

export enum FunctionFlags {
  ASYNC = 1 << 0,
  NESTED = 1 << 1,
  ARROW = 1 << 2,
  METHOD = 1 << 3,
  EVENT_HANDLER = 1 << 4,
  EXPORTED = 1 << 5,
  CONST = 1 << 6,
  MACRO = 1 << 7,
  COMPOSABLE = 1 << 8,
  GENERATOR = 1 << 9,
  PRIVATE = 1 << 10,
  PROTECTED = 1 << 11,
  STATIC = 1 << 12,
  READONLY = 1 << 13,
  OPTIONAL = 1 << 14,
  NULLABLE = 1 << 15,
  DEFAULT_EXPORT = 1 << 16,
  SELF = 1 << 17,
  DYNAMIC = 1 << 18,
  CONFIG = 1 << 19,
  EXTERNAL = 1 << 20,
  VUE_TEMPLATE = 1 << 21,
  ASYNC_CHAIN = 1 << 22,
  CLOSURE = 1 << 23,
  TYPE_DEP = 1 << 24,
}

export class FlagManager {
  private static instance: FlagManager;
  private decodeCache = new Map<number, Record<string, boolean>>();
  private hotCombinations = new Map<number, Record<string, boolean>>();

  private constructor() {
    this.precomputeHotCombinations();
  }

  static getInstance(): FlagManager {
    if (!FlagManager.instance) {
      FlagManager.instance = new FlagManager();
    }
    return FlagManager.instance;
  }

  /**
   * Предварительно вычисляет частые комбинации флагов для быстрого доступа
   */
  private precomputeHotCombinations(): void {
    // 1. Базовая функция (без флагов)
    this.hotCombinations.set(0, {});

    // 2. Экспортированная функция
    this.hotCombinations.set(FunctionFlags.EXPORTED, { isExported: true });

    // 3. Асинхронная функция
    this.hotCombinations.set(FunctionFlags.ASYNC, { isAsync: true });

    // 4. Стрелочная функция
    this.hotCombinations.set(FunctionFlags.ARROW, { isArrow: true });

    // 5. Экспортированная + асинхронная
    this.hotCombinations.set(FunctionFlags.EXPORTED | FunctionFlags.ASYNC, {
      isExported: true,
      isAsync: true,
    });

    // 6. Экспортированная + стрелочная
    this.hotCombinations.set(FunctionFlags.EXPORTED | FunctionFlags.ARROW, {
      isExported: true,
      isArrow: true,
    });

    // 7. Метод класса
    this.hotCombinations.set(FunctionFlags.METHOD | FunctionFlags.NESTED, {
      isMethod: true,
      isNested: true,
    });

    // 8. Экспортированный метод
    this.hotCombinations.set(FunctionFlags.EXPORTED | FunctionFlags.METHOD | FunctionFlags.NESTED, {
      isExported: true,
      isMethod: true,
      isNested: true,
    });

    // 9. Vue composable
    this.hotCombinations.set(FunctionFlags.COMPOSABLE | FunctionFlags.EXPORTED, {
      isComposable: true,
      isExported: true,
    });

    // 10. Self функция (изолированная)
    this.hotCombinations.set(FunctionFlags.SELF, { isSelf: true });

    // 11. Async + Self
    this.hotCombinations.set(FunctionFlags.ASYNC | FunctionFlags.SELF, {
      isAsync: true,
      isSelf: true,
    });

    // 12. Экспортированная + Self
    this.hotCombinations.set(FunctionFlags.EXPORTED | FunctionFlags.SELF, {
      isExported: true,
      isSelf: true,
    });

    // 13. Vue макрос
    this.hotCombinations.set(FunctionFlags.MACRO | FunctionFlags.EXPORTED, {
      isMacro: true,
      isExported: true,
    });

    // 14. Асинхронная цепочка
    this.hotCombinations.set(FunctionFlags.ASYNC_CHAIN, { isAsyncChain: true });

    // 15. Замыкание
    this.hotCombinations.set(FunctionFlags.CLOSURE, { isClosure: true });

    // 16. Типовая зависимость
    this.hotCombinations.set(FunctionFlags.TYPE_DEP, { isTypeDep: true });

    // 17. Асинхронная + вложенная
    this.hotCombinations.set(FunctionFlags.ASYNC | FunctionFlags.NESTED, {
      isAsync: true,
      isNested: true,
    });

    // 18. Экспортированная + вложенная
    this.hotCombinations.set(FunctionFlags.EXPORTED | FunctionFlags.NESTED, {
      isExported: true,
      isNested: true,
    });

    // 19. Динамический импорт
    this.hotCombinations.set(FunctionFlags.DYNAMIC, { isDynamic: true });

    // 20. Внешняя библиотека
    this.hotCombinations.set(FunctionFlags.EXTERNAL, { isExternal: true });

    // 21. Константа
    this.hotCombinations.set(FunctionFlags.CONST, { isConst: true });

    // 22. Генератор
    this.hotCombinations.set(FunctionFlags.GENERATOR, { isGenerator: true });

    // 23. Приватный метод
    this.hotCombinations.set(FunctionFlags.PRIVATE, { isPrivate: true });

    // 24. Защищенный метод
    this.hotCombinations.set(FunctionFlags.PROTECTED, { isProtected: true });

    // 25. Статический метод
    this.hotCombinations.set(FunctionFlags.STATIC, { isStatic: true });
  }

  /**
   * Кодирует булевы свойства в битовые флаги
   */
  encode(entity: any): number {
    let flags = 0;

    // Используем tuple вместо массива объектов для лучшей производительности
    const map: [string, FunctionFlags][] = [
      ['isAsync', FunctionFlags.ASYNC],
      ['isNested', FunctionFlags.NESTED],
      ['isArrow', FunctionFlags.ARROW],
      ['isMethod', FunctionFlags.METHOD],
      ['isEventHandler', FunctionFlags.EVENT_HANDLER],
      ['isExported', FunctionFlags.EXPORTED],
      ['isConst', FunctionFlags.CONST],
      ['isMacro', FunctionFlags.MACRO],
      ['isComposable', FunctionFlags.COMPOSABLE],
      ['isGenerator', FunctionFlags.GENERATOR],
      ['isPrivate', FunctionFlags.PRIVATE],
      ['isProtected', FunctionFlags.PROTECTED],
      ['isStatic', FunctionFlags.STATIC],
      ['isReadonly', FunctionFlags.READONLY],
      ['isOptional', FunctionFlags.OPTIONAL],
      ['isNullable', FunctionFlags.NULLABLE],
      ['isDefaultExport', FunctionFlags.DEFAULT_EXPORT],
      ['isSelf', FunctionFlags.SELF],
      ['isDynamic', FunctionFlags.DYNAMIC],
      ['isConfig', FunctionFlags.CONFIG],
      ['isExternal', FunctionFlags.EXTERNAL],
      ['isVueTemplate', FunctionFlags.VUE_TEMPLATE],
      ['isAsyncChain', FunctionFlags.ASYNC_CHAIN],
      ['isClosure', FunctionFlags.CLOSURE],
      ['isTypeDep', FunctionFlags.TYPE_DEP],
    ];

    for (const [key, flag] of map) {
      if (entity[key]) {
        flags |= flag;
      }
    }

    return flags;
  }

  /**
   * Декодирует флаги с использованием горячих комбинаций и кэша
   */
  decode(flags: number): Record<string, boolean> {
    // 1. Проверяем горячие комбинации (O(1))
    const hot = this.hotCombinations.get(flags);
    if (hot !== undefined) {
      return { ...hot };
    }

    // 2. Проверяем кэш (O(1))
    if (this.decodeCache.has(flags)) {
      return { ...this.decodeCache.get(flags)! };
    }

    // 3. Вычисляем на лету
    const result: Record<string, boolean> = {
      isAsync: !!(flags & FunctionFlags.ASYNC),
      isNested: !!(flags & FunctionFlags.NESTED),
      isArrow: !!(flags & FunctionFlags.ARROW),
      isMethod: !!(flags & FunctionFlags.METHOD),
      isEventHandler: !!(flags & FunctionFlags.EVENT_HANDLER),
      isExported: !!(flags & FunctionFlags.EXPORTED),
      isConst: !!(flags & FunctionFlags.CONST),
      isMacro: !!(flags & FunctionFlags.MACRO),
      isComposable: !!(flags & FunctionFlags.COMPOSABLE),
      isGenerator: !!(flags & FunctionFlags.GENERATOR),
      isPrivate: !!(flags & FunctionFlags.PRIVATE),
      isProtected: !!(flags & FunctionFlags.PROTECTED),
      isStatic: !!(flags & FunctionFlags.STATIC),
      isReadonly: !!(flags & FunctionFlags.READONLY),
      isOptional: !!(flags & FunctionFlags.OPTIONAL),
      isNullable: !!(flags & FunctionFlags.NULLABLE),
      isDefaultExport: !!(flags & FunctionFlags.DEFAULT_EXPORT),
      isSelf: !!(flags & FunctionFlags.SELF),
      isDynamic: !!(flags & FunctionFlags.DYNAMIC),
      isConfig: !!(flags & FunctionFlags.CONFIG),
      isExternal: !!(flags & FunctionFlags.EXTERNAL),
      isVueTemplate: !!(flags & FunctionFlags.VUE_TEMPLATE),
      isAsyncChain: !!(flags & FunctionFlags.ASYNC_CHAIN),
      isClosure: !!(flags & FunctionFlags.CLOSURE),
      isTypeDep: !!(flags & FunctionFlags.TYPE_DEP),
    };

    // Сохраняем в кэш
    this.decodeCache.set(flags, { ...result });
    return result;
  }

  /**
   * Проверяет, установлен ли флаг
   */
  hasFlag(flags: number, flag: FunctionFlags): boolean {
    return !!(flags & flag);
  }

  /**
   * Проверяет, установлены ли все флаги
   */
  hasAllFlags(flags: number, ...flagList: FunctionFlags[]): boolean {
    let mask = 0;
    for (const flag of flagList) {
      mask |= flag;
    }
    return (flags & mask) === mask;
  }

  /**
   * Проверяет, установлен ли хотя бы один флаг
   */
  hasAnyFlag(flags: number, ...flagList: FunctionFlags[]): boolean {
    let mask = 0;
    for (const flag of flagList) {
      mask |= flag;
    }
    return !!(flags & mask);
  }

  /**
   * Проверяет несколько флагов одновременно
   */
  hasFlags(flags: number, ...flagList: FunctionFlags[]): boolean[] {
    return flagList.map(flag => !!(flags & flag));
  }

  /**
   * Устанавливает флаг
   */
  setFlag(flags: number, flag: FunctionFlags): number {
    return flags | flag;
  }

  /**
   * Снимает флаг
   */
  clearFlag(flags: number, flag: FunctionFlags): number {
    return flags & ~flag;
  }

  /**
   * Переключает флаг
   */
  toggleFlag(flags: number, flag: FunctionFlags): number {
    return flags ^ flag;
  }

  /**
   * Получает список установленных флагов
   */
  getFlagsList(flags: number): string[] {
    const result: string[] = [];
    const map: [string, FunctionFlags][] = [
      ['ASYNC', FunctionFlags.ASYNC],
      ['NESTED', FunctionFlags.NESTED],
      ['ARROW', FunctionFlags.ARROW],
      ['METHOD', FunctionFlags.METHOD],
      ['EVENT_HANDLER', FunctionFlags.EVENT_HANDLER],
      ['EXPORTED', FunctionFlags.EXPORTED],
      ['CONST', FunctionFlags.CONST],
      ['MACRO', FunctionFlags.MACRO],
      ['COMPOSABLE', FunctionFlags.COMPOSABLE],
      ['GENERATOR', FunctionFlags.GENERATOR],
      ['PRIVATE', FunctionFlags.PRIVATE],
      ['PROTECTED', FunctionFlags.PROTECTED],
      ['STATIC', FunctionFlags.STATIC],
      ['READONLY', FunctionFlags.READONLY],
      ['OPTIONAL', FunctionFlags.OPTIONAL],
      ['NULLABLE', FunctionFlags.NULLABLE],
      ['DEFAULT_EXPORT', FunctionFlags.DEFAULT_EXPORT],
      ['SELF', FunctionFlags.SELF],
      ['DYNAMIC', FunctionFlags.DYNAMIC],
      ['CONFIG', FunctionFlags.CONFIG],
      ['EXTERNAL', FunctionFlags.EXTERNAL],
      ['VUE_TEMPLATE', FunctionFlags.VUE_TEMPLATE],
      ['ASYNC_CHAIN', FunctionFlags.ASYNC_CHAIN],
      ['CLOSURE', FunctionFlags.CLOSURE],
      ['TYPE_DEP', FunctionFlags.TYPE_DEP],
    ];

    for (const [key, flag] of map) {
      if (flags & flag) {
        result.push(key);
      }
    }

    return result;
  }

  /**
   * Количество установленных флагов
   */
  countFlags(flags: number): number {
    let count = 0;
    let temp = flags;
    while (temp) {
      count += temp & 1;
      temp >>= 1;
    }
    return count;
  }

  /**
   * Строковое представление флагов
   */
  flagsToString(flags: number, separator: string = ' | '): string {
    return this.getFlagsList(flags).join(separator);
  }

  /**
   * Очищает кэш
   */
  clearCache(): void {
    this.decodeCache.clear();
    // Горячие комбинации не очищаем, они предварительно вычислены
  }

  /**
   * Получает статистику кэша
   */
  getCacheStats(): { cacheSize: number; hotSize: number } {
    return {
      cacheSize: this.decodeCache.size,
      hotSize: this.hotCombinations.size,
    };
  }

  /**
   * Декодирует флаги с префиксом
   */
  decodePrefixed(flags: number, prefix: string = ''): Record<string, boolean> {
    const decoded = this.decode(flags);
    if (!prefix) return decoded;

    const result: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(decoded)) {
      const prefixedKey = `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      result[prefixedKey] = value;
    }
    return result;
  }

  /**
   * Кодирует флаги с кастомными полями
   */
  encodeAdvanced(entity: any, customFieldMap?: Record<string, FunctionFlags>): number {
    let flags = this.encode(entity);
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
  decodeAdvanced(
    flags: number,
    customFieldMap?: Record<string, FunctionFlags>
  ): Record<string, boolean> {
    const result = this.decode(flags);
    if (customFieldMap) {
      for (const [field, flag] of Object.entries(customFieldMap)) {
        result[field] = !!(flags & flag);
      }
    }
    return result;
  }
}

export const flagManager = FlagManager.getInstance();

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  FunctionFlags,
  FlagManager,
  flagManager,
};
