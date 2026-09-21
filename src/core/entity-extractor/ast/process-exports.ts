// packages/ast-analyzer/src/core/entity-extractor/ast/process-exports.ts
// ============================================
// ОБРАБОТКА ЭКСПОРТОВ ИЗ AST
// ============================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - ✅ ИСПРАВЛЕНО: пробрасываются поля `source`, `isReExport`,
//     `isStarReExport`, `isDefaultReExport`, `localName`, `isTypeOnly`
//   - ✅ ИСПРАВЛЕНО: явная нормализация `line` из `loc.start.line`
//   - ✅ ДОБАВЛЕНО: fallback для `type` — если пришёл `undefined`
//     или нераспознанное значение, ставим `'value'`
//   - ✅ ДОБАВЛЕНО: сохранение `specifiers` для групповых реэкспортов
//   - ✅ ДОБАВЛЕНО: комментарии к каждому полю результата
//
// Назначение:
//   Преобразует экспорты из AST (ASTExport[]) в публичный формат
//   ExportInfo[] с полным набором полей, необходимых для:
//     - round-trip кодека (encode → decode → encode)
//     - построения графа связей файлов
//     - отображения в UI (импортёры / реэкспортёры)
// ============================================

import type { ExportInfo } from '../../../types.js';
import type { ASTExport } from '../types.js';

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================

/**
 * Преобразует экспорты из AST в ExportInfo[].
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ПРОБРАСЫВАЕТСЯ
 * ════════════════════════════════════════════════════════════
 *
 *   Из ASTExport (см. collectExportsFromAST в ast-parser.ts):
 *     - name                — имя экспорта как оно видно снаружи
 *     - localName           — локальное имя (для `export { a as b }` → `a`)
 *     - type                — 'function' | 'class' | 'value' | 'default'
 *                             | 'type' | 'interface' | 'enum' | 'all'
 *                             | 're-export' | 'named'
 *     - isDefault           — `export default`
 *     - line                — строка объявления
 *     - loc                 — { start: { line, column }, end: { ... } }
 *     - isReExport          — `export { x } from './foo'` или `export * from './foo'`
 *     - source              — путь источника для реэкспорта
 *     - specifiers          — список имён для группового реэкспорта
 *     - isTypeOnly          — `export type { T }` / `export interface`
 *     - isStarReExport      — `export * from './foo'`
 *     - isDefaultReExport   — `export { default } from './foo'`
 *
 * ════════════════════════════════════════════════════════════
 * ВАЖНО ДЛЯ ROUND-TRIP КОДЕКА
 * ════════════════════════════════════════════════════════════
 *
 *   Все перечисленные поля должны сохраняться 1:1 — иначе
 *   `Codec.encode(full)` → `Codec.decode(compact)` даст
 *   расхождения в секции `full.exports`.
 *
 *   Особое внимание:
 *     • `source` — критично для графа связей и UI-цепочек
 *     • `isStarReExport` — критично для `export * from`
 *     • `isDefaultReExport` — критично для `export { default } from`
 *     • `localName` — критично для `export { a as b }`
 *     • `line` — должен быть `number` (не `undefined`)
 *
 * @param exportsFromAST — результат `collectExportsFromAST(ast)`
 * @returns Массив ExportInfo[]
 */
export function processExports(exportsFromAST: ASTExport[]): ExportInfo[] {
  const exports: ExportInfo[] = [];

  if (!Array.isArray(exportsFromAST) || exportsFromAST.length === 0) {
    return exports;
  }

  for (const exp of exportsFromAST) {
    if (!exp) continue;

    // ────────────────────────────────────────────────────────
    // 1. Нормализация имени и локального имени
    // ────────────────────────────────────────────────────────
    // Для обычных экспортов:   name = localName
    // Для `export { a as b }`: name = 'b', localName = 'a'
    // Для `export default`:    name = 'default'
    // Для `export * from`:     name = '*'
    // ────────────────────────────────────────────────────────
    const name = exp.name ?? '*';
    const localName = exp.localName ?? exp.name ?? name;

    // ────────────────────────────────────────────────────────
    // 2. Нормализация типа
    // ────────────────────────────────────────────────────────
    // Если тип не распознан — ставим 'value' как безопасный fallback.
    // Это сохраняет round-trip: encode оставит 'value', decode вернёт 'value'.
    // ────────────────────────────────────────────────────────
    const type: ExportInfo['type'] = normalizeExportType(exp.type);

    // ────────────────────────────────────────────────────────
    // 3. Нормализация строки (line)
    // ────────────────────────────────────────────────────────
    // Приоритет: loc.start.line → exp.line → 0
    // Гарантируем, что line — всегда number (не undefined).
    // ────────────────────────────────────────────────────────
    const line = exp.loc?.start?.line ?? exp.line ?? 0;

    // ────────────────────────────────────────────────────────
    // 4. Флаги реэкспорта
    // ────────────────────────────────────────────────────────
    // isReExport         — экспорт идёт из другого файла (`from './foo'`)
    // isStarReExport     — `export * from './foo'`
    // isDefaultReExport  — `export { default } from './foo'`
    // ────────────────────────────────────────────────────────
    const isReExport = exp.isReExport === true;
    const isStarReExport = exp.isStarReExport === true;
    const isDefaultReExport = exp.isDefaultReExport === true;

    // ────────────────────────────────────────────────────────
    // 5. Сборка ExportInfo
    // ────────────────────────────────────────────────────────
    const exportInfo: ExportInfo = {
      // ---------- Основные поля ----------
      name,
      type,
      isDefault: exp.isDefault === true || type === 'default',
      loc: exp.loc ?? null,

      // ---------- Поля для round-trip ----------
      /** Реальная строка (из loc.start.line, fallback на exp.line) */
      line,

      /** Локальное имя (при `export { a as b }` → `a`) */
      localName,

      /** Только для типов (`export type`, `export interface`) */
      isTypeOnly: exp.isTypeOnly === true,

      /** Является ли `export * from '...'` */
      isStarReExport,

      /** Является ли `export { default } from '...'` */
      isDefaultReExport,

      // ---------- Связи и реэкспорты ----------
      isReExport,
      source: exp.source,

      /** Спецификаторы для групповых реэкспортов: `export { a, b, c } from './foo'` */
      specifiers: exp.specifiers,
    };

    exports.push(exportInfo);
  }

  return exports;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Нормализует тип экспорта.
 *
 * Если тип из ASTExport не входит в допустимый набор
 * ExportInfo['type'], возвращает 'value'.
 *
 * Допустимые значения (см. ExportInfo в src/types.ts):
 *   - 'function'
 *   - 'class'
 *   - 'constant'
 *   - 'value'
 *   - 'default'
 *   - 'interface'
 *   - 'type'
 *   - 'enum'
 *   - 'object'
 *   - 'all'
 *   - 're-export'
 *   - 'named'
 *
 * @param raw — сырой тип из AST
 * @returns Нормализованный тип ExportInfo['type']
 */
function normalizeExportType(raw: unknown): ExportInfo['type'] {
  const ALLOWED: ExportInfo['type'][] = [
    'function',
    'class',
    'constant',
    'value',
    'default',
    'interface',
    'type',
    'enum',
    'object',
    'all',
    're-export',
    'named',
  ];

  if (typeof raw === 'string' && (ALLOWED as string[]).includes(raw)) {
    return raw as ExportInfo['type'];
  }

  // 're-export-group' из ast-parser.ts не входит в ExportInfo['type'] —
  // маппим его на 're-export'.
  if (raw === 're-export-group') {
    return 're-export';
  }

  // Всё остальное (undefined, null, нераспознанные строки) → 'value'
  return 'value';
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default processExports;
