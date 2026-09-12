// src/utils/flag-utils.ts - ОБНОВЛЕННЫЙ ФАЙЛ
/**
 * Фасад для утилит работы с флагами
 * Все функции делегируют внутреннему FlagManager
 * API полностью сохранен для обратной совместимости
 */

import { flagManager, FunctionFlags } from './internal/FlagManager.js';

// Re-export FunctionFlags для обратной совместимости
export { FunctionFlags };

// ============================================
// ОСНОВНЫЕ ЭКСПОРТЫ (API сохранен)
// ============================================

export function encodeFlags(entity: any): number {
  return flagManager.encode(entity);
}

export function decodeFlags(flags: number): Record<string, boolean> {
  return flagManager.decode(flags);
}

export function getFlagsList(flags: number): string[] {
  return flagManager.getFlagsList(flags);
}

export function hasFlag(flags: number, flag: FunctionFlags): boolean {
  return flagManager.hasFlag(flags, flag);
}

export function hasAllFlags(flags: number, ...flagList: FunctionFlags[]): boolean {
  return flagManager.hasAllFlags(flags, ...flagList);
}

export function hasAnyFlag(flags: number, ...flagList: FunctionFlags[]): boolean {
  return flagManager.hasAnyFlag(flags, ...flagList);
}

export function setFlag(flags: number, flag: FunctionFlags): number {
  return flagManager.setFlag(flags, flag);
}

export function clearFlag(flags: number, flag: FunctionFlags): number {
  return flagManager.clearFlag(flags, flag);
}

export function toggleFlag(flags: number, flag: FunctionFlags): number {
  return flagManager.toggleFlag(flags, flag);
}

export function flagsToString(flags: number, separator: string = ' | '): string {
  return flagManager.flagsToString(flags, separator);
}

export function countFlags(flags: number): number {
  return flagManager.countFlags(flags);
}

export function clearCache(): void {
  flagManager.clearCache();
}

export function getCacheStats(): { cacheSize: number } {
  return flagManager.getCacheStats();
}

// ============================================
// РАСШИРЕННЫЕ ФУНКЦИИ (с кастомными полями)
// ============================================

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

export function decodeFlagsPrefixed(flags: number, prefix: string = ''): Record<string, boolean> {
  const decoded = decodeFlags(flags);
  if (!prefix) return decoded;

  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(decoded)) {
    const prefixedKey = `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    result[prefixedKey] = value;
  }
  return result;
}

// ============================================
// КОНСТАНТЫ (сохранены для обратной совместимости)
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
