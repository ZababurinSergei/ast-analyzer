// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ФАСАД — только реэкспорт
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// ИСТОРИЯ
// ════════════════════════════════════════════════════════════
//
// v16.2.0 (РЕФАКТОРИНГ: разбиение монолита на подсистемы):
//   - ✅ Файл уменьшен с 121 KB до ~30 строк.
//   - ✅ Вся логика вынесена в ./compact/:
//       • ./compact/orchestration/  — generateCompactReport, decode, readAndDecode
//       • ./compact/pipeline/       — collectFullJSON + 6 проходов
//       • ./compact/entities/       — resolveToFileId, import type mapping
//       • ./compact/calls/          — detectCallType, calls-info, merge-cross-file
//       • ./compact/vue/            — convertVueEntitiesToFull, component-usage
//       • ./compact/dom-api/        — buildScope, detector, heuristics, maps
//       • ./compact/ids/            — collect-ids, collect-source-chains
//       • ./compact/persistence/    — saveJsonFile, path-utils
//       • ./compact/diagnostics/    — countConditionals
//   - ✅ Публичный API НЕ ИЗМЕНИЛСЯ. Все существующие импорты:
//       import { generateCompactReport } from './compact-reporter.js';
//     продолжают работать без изменений.
//   - ✅ Реэкспорты типов сохранены для обратной совместимости.
//
// v16.1.0:
//   - Vue.sfc[] — глобально уникальные cu.id/he.id.
//   - Явная установка parentFileId = sfc.fileId для каждого cu/he.
//   - Сортировка vue.sfc[] по индексу в files[].
//   - 34 поля в схеме vue.sfc.
//
// v16.0.8 (архитектурное исправление):
//   - УДАЛЕНА функция analyzeVueSFC из compact-reporter.
//   - УДАЛЕНА функция extractSFCNamesForVue.
//   - compact-reporter ЧИТАЕТ templateComponentUsages/templateHtmlElements
//     из enhancedMap вместо двойного парсинга <template>.
//   - Эффект: время сборки сокращено с ~13 сек до ~5 сек.
//
// v16.0.7 (fix projectRoot):
//   - projectRoot пробрасывается через GenerateReportOptions.
//
// v15.x, v14.x, v13.x — см. историю в подсистемах:
//   - ./compact/orchestration/generate-report.ts
//   - ./compact/pipeline/collect-full-json.ts
//   - ./compact/pipeline/pass-*.ts
// ============================================

// ============================================================
// 1. ОРКЕСТРАЦИЯ (генерация + декодирование)
// ============================================================
// Публичный API верхнего уровня:
//   - generateCompactReport  — сборка full + encode + save
//   - decodeCompactReport    — decode compact → full
//   - readAndDecode          — прочитать compact с диска + decode
//   - readFullJson           — прочитать full.json с диска
// ============================================================

export {
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,
} from './compact/orchestration/index.js';

// ============================================================
// 2. РЕЭКСПОРТ ТИПОВ (для обратной совместимости)
// ============================================================
// Эти типы были объявлены в старом compact-reporter.ts
// и реэкспортировались наружу. Сохраняем их реэкспорт,
// чтобы не сломать внешних потребителей.
//
// ⚠️ Канонические определения:
//   - GenerateReportOptions / GenerateReportResult → ./codec/codec-types.ts
//   - ValuesMode                                  → ./codec/values-filter.ts
//   - VueEntities                                 → ../core/vue-entity-classifier.ts
// ============================================================

export type {
  GenerateReportOptions,
  GenerateReportResult,
} from './codec/codec-types.js';

export type { ValuesMode } from './codec/values-filter.js';

export type { VueEntities } from '../core/vue-entity-classifier.js';

// ============================================================
// 3. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
// Сохраняем default-экспорт для совместимости:
//   import compactReporter from './compact-reporter.js';
//   compactReporter.generateCompactReport(...)
//
// Раньше default-экспорт был объектом:
//   { generateCompactReport, decodeCompactReport, readAndDecode, readFullJson }
// ============================================================

export { generateCompactReport as default } from './compact/orchestration/generate-report.js';
