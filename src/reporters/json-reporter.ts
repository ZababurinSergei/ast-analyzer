// packages/ast-analyzer/src/reporters/json-reporter.ts

// ============================================================
// JSON REPORTER - тонкий фасад для обратной совместимости.
//
// Вся логика вынесена в ./json/ (подмодули):
//   - utils/         — id-generator, language-detector, path-resolver, entities-converter
//   - importers/     — importers-collector
//   - consumers/     — export-consumers
//   - graphs/        — module-graph, entity-graph, full-analysis
//   - savers/        — save-module-graph, save-entity-graph, save-full-analysis, save-call-graph
//   - relationships/ — optimized-relationships
//   - extractors/    — extract-entities-from-file
//   - builders/      — enhanced-report, save-package-lock, save-optimized
//
// Этот файл существует только для обратной совместимости импортов:
//   import { savePackageLockReport } from './reporters/json-reporter.js';
// продолжает работать без изменений во всех потребителях.
// ============================================================

// Реэкспорт всех публичных API
export * from './json/index.js';

// Реэкспорт default-объекта (для совместимости, если кто-то делал import jsonReporter from '...')
export { default } from './json/index.js';