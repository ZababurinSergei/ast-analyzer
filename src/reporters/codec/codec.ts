// src/reporters/codec/codec.ts 
// ============================================
// ФАСАД КОДЕКА
// ============================================
// Версия: 16.1.0

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

// ✅ v12.0.0: тип режима values
import type { ValuesMode } from './values-filter.js';

// ============================================
// РЕЭКСПОРТ СЛОВАРЕЙ ИЗ codec-encode.ts
// ============================================
// Публичный API сохранён для обратной совместимости.
// Внутренне эти словари теперь используются в codec-legend.ts.
//
// ⚠️ v15.4.3-fix: `classifyValue` УБРАН из этого реэкспорта.
//   Теперь он экспортируется из './values-filter.js' (см. ниже),
//   чтобы был ЕДИНЫЙ источник истины (детерминированный через
//   stableStringifyForClassify).
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
// ✅ v11.0.0: добавлен decodeFlagsFromNumber (новая функция).
// ============================================

export {
  decodeFlagsToObject,
  decodeFlagsFromNumber, // ✅ v11.0.0
  flagsStringToNumber,
  createEmptyFlags,
} from './codec-decode.js';

export type { DecodedFlags } from './codec-decode.js';

// ============================================
// ✅ v12.0.0: РЕЭКСПОРТ ИЗ values-filter.ts
// ============================================
// Публичный API для работы с режимом values.
//
// ⚠️ v15.4.3-fix: `classifyValue` теперь реэкспортируется
//   ИМЕННО ЗДЕСЬ (из values-filter.ts), а не из codec-encode.ts.
//
//   Это устраняет дублирование: единственная `classifyValue`
//   живёт в values-filter.ts и использует
//   `stableStringifyForClassify` (детерминирована).
// ============================================

export {
  filterValues,
  remapIndex,
  remapNonEmptyV,
  classifyValue, // ✅ v15.4.3-fix: единый источник истины
  isValidValuesMode,
  normalizeValuesMode,
  getFilterStats,
  RELATION_KEYS,
} from './values-filter.js';

export type { ValuesMode } from './values-filter.js';

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
 *   - Codec.encode(full)               → compact
 *   - Codec.encode(full, 'relations')  → compact (values отфильтрованы)
 *   - Codec.decode(compact)            → full
 *   - Codec.decode(compact, { valuesMode }) → full
 *   - Codec.verifyRoundTrip(full)      → { ok, error }
 *   - Codec.getCompactSize / getFullSize / getCompressionRatio
 *   - Codec.stringify / parse
 *   - Codec.getLegend
 */
export class Codec {
  /**
   * Кодирует полный JSON в сжатый.
   *
   * ✅ v12.0.0: второй аргумент `valuesMode` управляет тем, какие
   * значения попадают в `values[]`:
   *   - 'full'      — все значения (обратная совместимость)
   *   - 'relations' — только значения, нужные для восстановления связей
   *                   (default, экономия 5–15x по размеру)
   *
   * @param payload    — Полный JSON
   * @param valuesMode — Режим сериализации values (default: 'relations')
   * @returns Сжатый JSON с легендой
   */
  static encode(payload: FullJSON, valuesMode: ValuesMode = 'relations'): CompactJSON {
    return encode(payload, valuesMode);
  }

  /**
   * Декодирует сжатый JSON обратно в полный.
   *
   * ✅ v15.0.6: `gr.i.tf` читается как ИНДЕКС В `fl.p` (файлы),
   * а не как индекс в `strs`. Это значит, что `imports[].toFileId`
   * восстанавливается корректно для всех локальных импортов,
   * включая реэкспорты (`export * from './foo'`).
   *
   * ✅ v12.0.0: `options.valuesMode` (если задан) сообщает декодеру,
   * какой режим использовался при кодировании. Это влияет только
   * на переиндексацию `cn.nonEmptyV`.
   *
   * Если `valuesMode` не задан — берётся из `compact.valuesMode`
   * (если поле есть), иначе — 'relations'.
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
   * ✅ v15.0.6: проверяет, что `gr.i.tf[i]` — валидный индекс в `fl.p`
   * (или -1 для внешних/неразрешённых импортов), и что
   * `imports[].toFileId` не выходит за пределы `files`.
   *
   * @param payload — Полный JSON
   * @param options — Опции декодирования (включая valuesMode)
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
