// src/utils/flag-utils.ts
// Утилиты для работы с битовыми флагами
// Используется для компактного хранения булевых свойств в JSON отчетах

/**
 * Перечисление битовых флагов для функций
 * Каждый флаг занимает 1 бит в числе
 *
 * Пример: flags = 0b00000110 означает:
 *   - NESTED = 1 (бит 1)
 *   - ARROW = 1 (бит 2)
 *   - остальные = 0
 */
export enum FunctionFlags {
  /** Асинхронная функция (async) */
  ASYNC = 1 << 0, // 1
  /** Вложенная функция (объявлена внутри другой функции) */
  NESTED = 1 << 1, // 2
  /** Стрелочная функция (=>) */
  ARROW = 1 << 2, // 4
  /** Метод класса */
  METHOD = 1 << 3, // 8
  /** Обработчик события */
  EVENT_HANDLER = 1 << 4, // 16
  /** Экспортируется (export) */
  EXPORTED = 1 << 5, // 32
  /** Константа (const) */
  CONST = 1 << 6, // 64
  /** Vue макрос (defineProps, defineEmits, etc.) */
  MACRO = 1 << 7, // 128
  /** Vue composable (use*) */
  COMPOSABLE = 1 << 8, // 256
  /** Генератор (function*) */
  GENERATOR = 1 << 9, // 512
  /** Приватный метод/свойство */
  PRIVATE = 1 << 10, // 1024
  /** Защищенный метод/свойство */
  PROTECTED = 1 << 11, // 2048
  /** Статический метод/свойство */
  STATIC = 1 << 12, // 4096
  /** Readonly свойство */
  READONLY = 1 << 13, // 8192
  /** Опциональный параметр/свойство */
  OPTIONAL = 1 << 14, // 16384
  /** Nullable тип */
  NULLABLE = 1 << 15, // 32768
  /** Default export */
  DEFAULT_EXPORT = 1 << 16, // 65536

  // ============================================
  // ✅ НОВЫЕ ФЛАГИ (добавлены в v5.1.0)
  // ============================================

  /** Self функция (изолированная, без вызовов) */
  SELF = 1 << 17, // 131072
  /** Динамический импорт */
  DYNAMIC = 1 << 18, // 262144
  /** Конфигурация (process.env, config файлы) */
  CONFIG = 1 << 19, // 524288
  /** Внешняя библиотека */
  EXTERNAL = 1 << 20, // 1048576
  /** Vue шаблон */
  VUE_TEMPLATE = 1 << 21, // 2097152
  /** Асинхронная цепочка */
  ASYNC_CHAIN = 1 << 22, // 4194304
  /** Замыкание */
  CLOSURE = 1 << 23, // 8388608
  /** Типовая зависимость */
  TYPE_DEP = 1 << 24, // 16777216
}

// ============================================
// ПРЕДВЫЧИСЛЕНИЕ КОМБИНАЦИЙ ФЛАГОВ
// ============================================

const flagCombinations = new Map<number, string[]>();

function precomputeFlagCombinations(): void {
  const flagEntries = Object.entries(FunctionFlags).filter(
    ([key, value]) => typeof value === 'number' && !key.startsWith('_')
  );

  const maxMask = 1 << flagEntries.length;

  for (let i = 0; i < maxMask; i++) {
    const active: string[] = [];
    for (let j = 0; j < flagEntries.length; j++) {
      if (i & (1 << j)) {
        const key = flagEntries[j]?.[0] || '';
        if (key) {
          active.push(key);
        }
      }
    }
    flagCombinations.set(i, active);
  }
}

precomputeFlagCombinations();

/**
 * Кодирует булевы свойства функции в число (битовые флаги)
 * @param entity - Объект сущности (функции)
 * @returns Число с установленными битами
 *
 * @example
 * const entity = {
 *   isAsync: true,
 *   isNested: false,
 *   isArrow: true,
 *   isExported: true
 * };
 * const flags = encodeFlags(entity);
 * // flags = 0b00100101 (37)
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

  // ✅ НОВЫЕ ФЛАГИ
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
 * Декодирует битовые флаги обратно в объект с булевыми свойствами
 * @param flags - Число с битовыми флагами
 * @returns Объект с булевыми свойствами
 *
 * @example
 * const flags = 37; // 0b00100101
 * const decoded = decodeFlags(flags);
 * // { isAsync: true, isArrow: true, isExported: true }
 */
export function decodeFlags(flags: number): Record<string, boolean> {
  return {
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

    // ✅ НОВЫЕ ФЛАГИ
    isSelf: !!(flags & FunctionFlags.SELF),
    isDynamic: !!(flags & FunctionFlags.DYNAMIC),
    isConfig: !!(flags & FunctionFlags.CONFIG),
    isExternal: !!(flags & FunctionFlags.EXTERNAL),
    isVueTemplate: !!(flags & FunctionFlags.VUE_TEMPLATE),
    isAsyncChain: !!(flags & FunctionFlags.ASYNC_CHAIN),
    isClosure: !!(flags & FunctionFlags.CLOSURE),
    isTypeDep: !!(flags & FunctionFlags.TYPE_DEP),
  };
}

/**
 * Оптимизированная версия decodeFlags с предвычислением
 * @param flags - Число с битовыми флагами
 * @returns Объект с булевыми свойствами
 */
export function decodeFlagsOptimized(flags: number): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const active = flagCombinations.get(flags) || [];

  for (const flag of active) {
    result[flag.toLowerCase()] = true;
  }

  return result;
}

/**
 * Получает список установленных флагов в виде строк
 * @param flags - Число с битовыми флагами
 * @returns Массив названий установленных флагов
 *
 * @example
 * const flags = 37;
 * const list = getFlagsList(flags);
 * // ['ASYNC', 'ARROW', 'EXPORTED']
 */
export function getFlagsList(flags: number): string[] {
  const result: string[] = [];
  const flagMap = Object.entries(FunctionFlags)
    .filter(([key, value]) => typeof value === 'number' && !key.startsWith('_'))
    .map(([key, value]) => ({ key, value: value as number }));

  for (const { key, value } of flagMap) {
    if (flags & value) {
      result.push(key);
    }
  }

  return result;
}

/**
 * Проверяет, установлен ли конкретный флаг
 * @param flags - Число с битовыми флагами
 * @param flag - Проверяемый флаг
 * @returns true если флаг установлен
 *
 * @example
 * const flags = 37;
 * const hasAsync = hasFlag(flags, FunctionFlags.ASYNC); // false
 * const hasArrow = hasFlag(flags, FunctionFlags.ARROW); // true
 */
export function hasFlag(flags: number, flag: FunctionFlags): boolean {
  return !!(flags & flag);
}

/**
 * Устанавливает флаг
 * @param flags - Исходное число с битовыми флагами
 * @param flag - Флаг для установки
 * @returns Новое число с установленным флагом
 */
export function setFlag(flags: number, flag: FunctionFlags): number {
  return flags | flag;
}

/**
 * Снимает флаг
 * @param flags - Исходное число с битовыми флагами
 * @param flag - Флаг для снятия
 * @returns Новое число без указанного флага
 */
export function clearFlag(flags: number, flag: FunctionFlags): number {
  return flags & ~flag;
}

/**
 * Переключает флаг (устанавливает если был снят, и наоборот)
 * @param flags - Исходное число с битовыми флагами
 * @param flag - Флаг для переключения
 * @returns Новое число с переключенным флагом
 */
export function toggleFlag(flags: number, flag: FunctionFlags): number {
  return flags ^ flag;
}

/**
 * Кодирует флаги из объекта в число с поддержкой кастомных полей
 * @param entity - Объект сущности
 * @param customFieldMap - Карта кастомных полей для кодирования
 * @returns Число с битовыми флагами
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
 * Декодирует флаги в объект с поддержкой кастомных полей
 * @param flags - Число с битовыми флагами
 * @param customFieldMap - Карта кастомных полей для декодирования
 * @returns Объект с булевыми свойствами
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
 * Возвращает человеко-читаемое представление флагов
 * @param flags - Число с битовыми флагами
 * @param separator - Разделитель между флагами
 * @returns Строка с названиями флагов
 *
 * @example
 * const flags = 37;
 * const str = flagsToString(flags);
 * // 'ASYNC | ARROW | EXPORTED'
 */
export function flagsToString(flags: number, separator: string = ' | '): string {
  return getFlagsList(flags).join(separator);
}

/**
 * Получает количество установленных флагов
 * @param flags - Число с битовыми флагами
 * @returns Количество установленных битов
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
 * Проверяет, есть ли хотя бы один установленный флаг из списка
 * @param flags - Число с битовыми флагами
 * @param flagList - Список флагов для проверки
 * @returns true если хотя бы один флаг из списка установлен
 */
export function hasAnyFlag(flags: number, flagList: FunctionFlags[]): boolean {
  return flagList.some(flag => !!(flags & flag));
}

/**
 * Проверяет, установлены ли все флаги из списка
 * @param flags - Число с битовыми флагами
 * @param flagList - Список флагов для проверки
 * @returns true если все флаги из списка установлены
 */
export function hasAllFlags(flags: number, flagList: FunctionFlags[]): boolean {
  return flagList.every(flag => !!(flags & flag));
}

// ============================================
// КОНСТАНТЫ ДЛЯ ЧАСТО ИСПОЛЬЗУЕМЫХ КОМБИНАЦИЙ
// ============================================

/** Стандартная функция (без особых флагов) */
export const STANDARD_FUNCTION = 0;

/** Вложенная неэкспортируемая функция */
export const NESTED_FUNCTION = FunctionFlags.NESTED;

/** Асинхронная вложенная функция */
export const ASYNC_NESTED_FUNCTION = FunctionFlags.ASYNC | FunctionFlags.NESTED;

/** Экспортируемая функция */
export const EXPORTED_FUNCTION = FunctionFlags.EXPORTED;

/** Метод класса */
export const METHOD_FUNCTION = FunctionFlags.METHOD | FunctionFlags.NESTED;

/** Стрелочная функция */
export const ARROW_FUNCTION = FunctionFlags.ARROW;

/** Vue composable */
export const COMPOSABLE_FUNCTION = FunctionFlags.COMPOSABLE | FunctionFlags.EXPORTED;

/** Vue макрос */
export const VUE_MACRO = FunctionFlags.MACRO | FunctionFlags.EXPORTED;

// ============================================
// ✅ НОВЫЕ КОНСТАНТЫ (v5.1.0)
// ============================================

/** Self функция (изолированная) */
export const SELF_FUNCTION = FunctionFlags.SELF;

/** Динамический импорт */
export const DYNAMIC_IMPORT = FunctionFlags.DYNAMIC;

/** Конфигурационная функция */
export const CONFIG_FUNCTION = FunctionFlags.CONFIG;

/** Внешняя библиотека */
export const EXTERNAL_LIB = FunctionFlags.EXTERNAL;

/** Vue шаблон */
export const VUE_TEMPLATE_FUNCTION = FunctionFlags.VUE_TEMPLATE;

/** Асинхронная цепочка */
export const ASYNC_CHAIN_FUNCTION = FunctionFlags.ASYNC_CHAIN;

/** Замыкание */
export const CLOSURE_FUNCTION = FunctionFlags.CLOSURE;

/** Типовая зависимость */
export const TYPE_DEP_FUNCTION = FunctionFlags.TYPE_DEP;

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  FunctionFlags,
  encodeFlags,
  decodeFlags,
  decodeFlagsOptimized,
  getFlagsList,
  hasFlag,
  setFlag,
  clearFlag,
  toggleFlag,
  encodeFlagsAdvanced,
  decodeFlagsAdvanced,
  flagsToString,
  countFlags,
  hasAnyFlag,
  hasAllFlags,

  // Константы
  STANDARD_FUNCTION,
  NESTED_FUNCTION,
  ASYNC_NESTED_FUNCTION,
  EXPORTED_FUNCTION,
  METHOD_FUNCTION,
  ARROW_FUNCTION,
  COMPOSABLE_FUNCTION,
  VUE_MACRO,

  // ✅ Новые константы
  SELF_FUNCTION,
  DYNAMIC_IMPORT,
  CONFIG_FUNCTION,
  EXTERNAL_LIB,
  VUE_TEMPLATE_FUNCTION,
  ASYNC_CHAIN_FUNCTION,
  CLOSURE_FUNCTION,
  TYPE_DEP_FUNCTION,
};
