// src/reporters/codec/index.ts
export { Codec } from './codec.js';

// Словари
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
} from './codec-encode.js';

// Флаги
export { encodeFlags, flagsToString } from './codec-encode.js';

// ✅ ИСПРАВЛЕНО: эти функции экспортируются из codec-decode.js
export { decodeFlagsToObject, flagsStringToNumber, createEmptyFlags } from './codec-decode.js';

export type { DecodedFlags } from './codec-decode.js';

// Проверки
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

// Типы
export type {
  FullJSON,
  CompactJSON,
  CodecLegend,
  DecodeOptions,
  GenerateReportOptions,
  GenerateReportResult,
  // ... остальные типы из codec-types
} from './codec-types.js';

export const CODEC_MODULE_VERSION = '9.0.0';
export const CODEC_MODULE_NAME = '@newkind/ast-analyzer/reporters/codec';
