// src/reporters/codec/codec.ts
// ============================================
// ФАСАД КОДЕКА
// ============================================
// Версия: 10.4.0
//
// Модуль разбит на четыре части:
//   - codec-encode.ts  — кодирование (FullJSON → CompactJSON)
//   - codec-decode.ts  — декодирование (CompactJSON → FullJSON)
//   - codec-verify.ts  — проверки обратимости
//   - codec-legend.ts  — сборка legend (v10.4.0)
//
// Этот файл сохраняет обратную совместимость: `Codec.encode`,
// `Codec.decode`, `Codec.verifyRoundTrip` работают как раньше.
//
// Все существующие импорты `import { Codec } from './codec.js'`
// продолжают работать без изменений.
//
// ИЗМЕНЕНИЯ v10.4.0:
//   - ✅ getLegend() теперь делегирует в buildEmptyLegend()
//     из './codec-legend.js' (единая точка сборки легенды).
//   - ✅ УДАЛЕНЫ прямые импорты словарей (FLAG_MAP, FLAG_CHAR_MAP,
//     RELATION_TYPES, EXPORT_TYPES, IMPORT_TYPES, CALL_TYPES,
//     RE_EXPORT_TYPES, LIFECYCLE_TYPES, EFFECT_TYPES,
//     INJECTION_TYPES, REACTIVITY_TYPES, CONDITIONAL_TYPES,
//     TYPE_KINDS, TYPE_USAGE_KINDS) — они больше не нужны здесь,
//     потому что вся сборка легенды вынесена в codec-legend.ts.
//   - ✅ РЕЭКСПОРТ словарей из './codec-encode.js' СОХРАНЁН
//     для обратной совместимости публичного API.
// ============================================

import type { FullJSON, CompactJSON, DecodeOptions, CodecLegend } from './codec-types.js';
import { encode } from './codec-encode.js';
import { decode } from './codec-decode.js';
import {
  verifyRoundTrip,
  getCompactSize,
  getFullSize,
  getCompressionRatio,
  stringify,
  parse,
} from './codec-verify.js';

// ✅ v10.4.0: легенда собирается в codec-legend.ts
import { buildEmptyLegend } from './codec-legend.js';

// ============================================
// РЕЭКСПОРТ СЛОВАРЕЙ ИЗ codec-encode.ts
// ============================================
// Публичный API сохранён для обратной совместимости.
// Внутренне эти словари теперь используются в codec-legend.ts.
// ============================================

export {
  FLAG_MAP,
  FLAG_CHAR_MAP,
  FLAG_NAMES,
  RELATION_TYPES,
  EXPORT_TYPES,
  IMPORT_TYPES,
  CALL_TYPES,
  RE_EXPORT_TYPES,
  LIFECYCLE_TYPES,
  EFFECT_TYPES,
  INJECTION_TYPES,
  REACTIVITY_TYPES,
  CONDITIONAL_TYPES,
  TYPE_KINDS,
  TYPE_USAGE_KINDS,
  encodeFlags,
  flagsToString,
  reverseLookup,
} from './codec-encode.js';

// ============================================
// РЕЭКСПОРТ ФУНКЦИЙ ФЛАГОВ ИЗ codec-decode.ts
// ============================================

export { decodeFlagsToObject, flagsStringToNumber, createEmptyFlags } from './codec-decode.js';

export type { DecodedFlags } from './codec-decode.js';

// ============================================
// РЕЭКСПОРТ УТИЛИТ ПРОВЕРКИ ИЗ codec-verify.ts
// ============================================

export {
  verifyRoundTrip,
  deepEqual,
  normalizeForDiff,
  getCompactSize,
  getFullSize,
  getCompressionRatio,
  stringify,
  parse,
} from './codec-verify.js';

// ============================================
// ✅ v10.4.0: РЕЭКСПОРТ ЛЕГЕНДЫ
// ============================================

export { buildLegend, buildEmptyLegend, SCHEMAS } from './codec-legend.js';

export type { LegendDictionaries } from './codec-legend.js';

export type { FlagBit, CodesDict } from './codec-types.js';

// ============================================
// ФАСАДНЫЙ КЛАСС Codec
// ============================================

/**
 * Единая точка входа для работы с кодеком.
 *
 * Сохраняет обратную совместимость:
 *   - Codec.encode(full) → compact
 *   - Codec.decode(compact) → full
 *   - Codec.verifyRoundTrip(full) → { ok, error }
 *   - Codec.getCompactSize / getFullSize / getCompressionRatio
 *   - Codec.stringify / parse
 *   - Codec.getLegend
 */
export class Codec {
  /**
   * Кодирует полный JSON в сжатый.
   *
   * @param payload — Полный JSON
   * @returns Сжатый JSON с легендой
   */
  static encode(payload: FullJSON): CompactJSON {
    return encode(payload);
  }

  /**
   * Декодирует сжатый JSON обратно в полный.
   *
   * @param compact — Сжатый JSON с легендой
   * @param options — Опции декодирования (см. DecodeOptions)
   * @returns Полный JSON
   */
  static decode(compact: CompactJSON, options: DecodeOptions = {}): FullJSON {
    return decode(compact, options);
  }

  /**
   * Проверяет, что encode → decode возвращает идентичный результат.
   *
   * @param payload — Полный JSON
   * @param options — Опции декодирования
   * @returns Результат проверки с деталями
   */
  static verifyRoundTrip(
    payload: FullJSON,
    options: DecodeOptions = {}
  ): {
    ok: boolean;
    error?: string;
    details?: Record<string, { original: number; decoded: number }>;
  } {
    return verifyRoundTrip(payload, options);
  }

  /**
   * Размер compact-JSON в байтах (по JSON.stringify).
   */
  static getCompactSize(compact: CompactJSON): number {
    return getCompactSize(compact);
  }

  /**
   * Размер full-JSON в байтах (по JSON.stringify).
   */
  static getFullSize(payload: FullJSON): number {
    return getFullSize(payload);
  }

  /**
   * Коэффициент сжатия: compactSize / fullSize.
   */
  static getCompressionRatio(payload: FullJSON): number {
    return getCompressionRatio(payload);
  }

  /**
   * Сериализация compact-JSON.
   */
  static stringify(compact: CompactJSON, pretty: boolean = false): string {
    return stringify(compact, pretty);
  }

  /**
   * Парсинг compact-JSON.
   */
  static parse(json: string): CompactJSON {
    return parse(json);
  }

  /**
   * Возвращает легенду для декодирования.
   *
   * ✅ v10.4.0: делегирует в buildEmptyLegend() из codec-legend.ts.
   *
   * ВНИМАНИЕ: словари пустые — используйте encode() для получения
   * реальной легенды с непустыми dictionaries.
   */
  static getLegend(): CodecLegend {
    return buildEmptyLegend();
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default Codec;
