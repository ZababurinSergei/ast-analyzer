// src/reporters/compact/ids/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ IDS
// ============================================================
// Версия: 1.0.0
//
// Экспортирует:
//   - collectUniqueIds          — v16.1.0: глобально уникальные ids
//   - collectUniqueSourceChains — v16.1.0: интернирование sourceChains
//   - extractIdentifierFromValue
//   - extractMemberChainFromValue
//   - extractLiteralFromValue
// ============================================================

export { collectUniqueIds } from './collect-ids.js';
export { collectUniqueSourceChains } from './collect-source-chains.js';
export {
    extractIdentifierFromValue,
    extractMemberChainFromValue,
    extractLiteralFromValue,
} from './value-extractors.js';
