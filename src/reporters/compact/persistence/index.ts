// src/reporters/compact/persistence/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ PERSISTENCE
// ============================================================
// Версия: 1.0.0
//
// Экспортирует:
//   - saveJsonFile            — сохранение JSON-файла с санитизацией
//   - SaveJsonResult          — тип результата сохранения
//   - insertSuffixBeforeExtension — вставка суффикса перед расширением
//   - insertUniqueSuffix      — генерация уникального имени с суффиксом
// ============================================================

export { saveJsonFile, type SaveJsonResult } from './save-json.js';
export { insertSuffixBeforeExtension, insertUniqueSuffix } from './path-utils.js';
