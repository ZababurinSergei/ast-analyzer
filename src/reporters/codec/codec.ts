// src/reporters/codec/codec.ts
// ============================================
// ФАСАД КОДЕКА
// ============================================
// Версия: 9.0.0
//
// Модуль разбит на три части:
//   - codec-encode.ts  — кодирование (FullJSON → CompactJSON)
//   - codec-decode.ts  — декодирование (CompactJSON → FullJSON)
//   - codec-verify.ts  — проверки обратимости
//
// Этот файл сохраняет обратную совместимость: `Codec.encode`,
// `Codec.decode`, `Codec.verifyRoundTrip` работают как раньше.
//
// Все существующие импорты `import { Codec } from './codec.js'`
// продолжают работать без изменений.
// ============================================

import type { FullJSON, CompactJSON, DecodeOptions, CodecLegend } from './codec-types.js';
import { encode } from './codec-encode.js';
import { decode } from './codec-decode.js';
import {
  verifyRoundTrip,
  // ✅ ИСПРАВЛЕНО: deepEqual и normalizeForDiff удалены из импорта,
  // т.к. они не используются в этом файле (TS6133).
  // deepEqual,
  // normalizeForDiff,
  getCompactSize,
  getFullSize,
  getCompressionRatio,
  stringify,
  parse,
} from './codec-verify.js';

// ============================================
// РЕЭКСПОРТ СЛОВАРЕЙ ИЗ codec-encode.ts
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
   * ВНИМАНИЕ: словари пустые — используйте encode() для получения словарей.
   */
  static getLegend(): CodecLegend {
    return getLegend();
  }
}

// ============================================
// getLegend — использует словари из codec-encode.ts
// ============================================

import {
  FLAG_MAP,
  FLAG_CHAR_MAP,
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
} from './codec-encode.js';

/**
 * Возвращает легенду со всеми словарями и схемами,
 * но с пустыми stringDict/paramDict/methodDict/valueDict.
 *
 * Используется для обратной совместимости. Реальная легенда
 * с непустыми словарями создаётся в `encode()`.
 *
 * ✅ v10.3: словарь IMPORT_TYPES теперь содержит 'to' → 'type'
 *           (не 'type-only'). Это согласовано с compact-reporter.ts.
 */
function getLegend(): CodecLegend {
  return {
    // Карты флагов
    flagMap: Object.fromEntries(Object.entries(FLAG_MAP).map(([bit, char]) => [char, bit])),
    flagCharMap: { ...FLAG_CHAR_MAP },

    // Типы связей
    relationTypes: { ...RELATION_TYPES },
    exportTypes: { ...EXPORT_TYPES },
    importTypes: { ...IMPORT_TYPES },
    callTypes: { ...CALL_TYPES },
    reExportTypes: { ...RE_EXPORT_TYPES },

    // Типы v9.0.0
    lifecycleTypes: { ...LIFECYCLE_TYPES },
    effectTypes: { ...EFFECT_TYPES },
    injectionTypes: { ...INJECTION_TYPES },
    reactivityTypes: { ...REACTIVITY_TYPES },
    conditionalTypes: { ...CONDITIONAL_TYPES },
    typeKinds: { ...TYPE_KINDS },
    typeUsageKinds: { ...TYPE_USAGE_KINDS },

    // Позиционные схемы массивов
    arraySchemas: {
      fns: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'paramsIdx', 'returnTypeIdx'],
      cls: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'methodsIdx'],
      cn: ['id', 'name', 'moduleId', 'fileId', 'line', 'flags', 'valueIdx'],
      // ✅ reversibility: 12 полей
      'gr.e': [
        'moduleIdx',
        'fileIdx',
        'funcIdx',
        'line',
        'typeCode',
        'exportNameIdx',
        'localNameIdx',
        'isTypeOnly',
        'isReExport',
        'sourceIdx',
        'isStarReExport',
        'isDefaultReExport',
      ],
      'gr.i': [
        'fromFileIdx',
        'toFileIdIdx',
        'sourceIdx',
        'importedNameIdx',
        'localNameIdx',
        'line',
        'typeCode',
        'isExternal',
      ],
      // ✅ L2 fix: 4 поля, без 'e'
      'gr.c': ['fromIdx', 'toIdxOrExternalIdx', 'line', 'typeCode'],
      'gr.re': [
        'moduleIdx',
        'funcIdx',
        'sourceIdx',
        'exportNameIdx',
        'line',
        'typeCode',
        'isTypeOnly',
      ],
      vt: [
        'fileIdx',
        'moduleIdx',
        'complexity',
        'reactivityDepsIdx',
        'eventHandlers',
        'dynamicComponents',
        'directivesIdx',
        'usedComponentsIdx',
        'templateRefs',
        'cssVariables',
        'deepSelectors',
        'slotsIdx',
      ],
      'vt.eventHandlers': [
        'eventNameIdx',
        'handlerNameIdx',
        'tagIdx',
        'line',
        'modifiersIdx',
        'isExternal',
      ],
      'vt.dynamicComponents': ['isExpressionIdx', 'line', 'resolvedComponentsIdx'],
      'vt.templateRefs': ['refValueIdx', 'tagIdx', 'line', 'exposedMethodsIdx'],
      'vt.cssVariables': ['nameIdx', 'valueIdx', 'line', 'isMultiline'],
      'vt.deepSelectors': ['selectorIdx', 'line'],
      lc: ['hookCode', 'funcIdx', 'line', 'callbackFnIdx', 'flags'],
      ef: ['effectCode', 'funcIdx', 'line', 'targetIdx', 'metaIdx'],
      inj: ['kindCode', 'fileIdx', 'line', 'keyIdx', 'flags'],
      rx: ['kindCode', 'funcIdx', 'line', 'readsIdx', 'writesIdx', 'flags'],
      cd: ['directiveCode', 'fileIdx', 'line', 'condIdx', 'compIdx', 'flags'],
      ty: ['kindCode', 'nameIdx', 'moduleIdx', 'fileIdx', 'line', 'membersIdx', 'extendsIdx'],
      tr: ['typeNameIdx', 'moduleIdx', 'fileIdx', 'line', 'usageCode'],
    },

    // Пустые словари
    stringDict: [],
    paramDict: [],
    methodDict: [],
    valueDict: [],
  };
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default Codec;
