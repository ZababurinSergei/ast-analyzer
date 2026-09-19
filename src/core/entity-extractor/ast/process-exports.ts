// packages/ast-analyzer/src/core/entity-extractor/ast/process-exports.ts

import type { ExportInfo } from '../../../types.js';
import type { ASTExport } from '../types.js';

/**
 * Преобразует экспорты из AST в ExportInfo[]
 *
 * ✅ ИСПРАВЛЕНО (Стратегия B):
 *   - Прокидываются поля: localName, isTypeOnly, isStarReExport,
 *     isDefaultReExport, line
 *   - Эти поля необходимы для полного round-trip (compact → full)
 *   - Совместимо с новой структурой ExportInfo в src/types.ts
 *   - Совместимо с CompactJSON.gr.e и CompactJSON.gr.re
 */
export function processExports(exportsFromAST: ASTExport[]): ExportInfo[] {
  const exports: ExportInfo[] = [];

  for (const exp of exportsFromAST) {
    exports.push({
      // ---------- Основные поля ----------
      name: exp.name,
      type: exp.type === 're-export' ? 're-export' : (exp.type as ExportInfo['type']) || 'value',
      isDefault: exp.isDefault || false,
      loc: exp.loc || null,

      // ---------- Поля для корректного round-trip ----------
      /** Реальная строка (из loc.start.line, fallback на exp.line) */
      line: exp.loc?.start?.line ?? exp.line ?? 0,

      /** Локальное имя (при `export { a as b }` → `a`) */
      localName: exp.localName ?? exp.name,

      /** Только для типов (`export type`, `export interface`) */
      isTypeOnly: exp.isTypeOnly ?? false,

      /** Является ли `export * from '...'` */
      isStarReExport: exp.isStarReExport ?? false,

      /** Является ли `export { default } from '...'` */
      isDefaultReExport: exp.isDefaultReExport ?? false,

      // ---------- Существующие поля ----------
      isReExport: exp.isReExport || false,
      source: exp.source,
      specifiers: exp.specifiers,
    });
  }

  return exports;
}

export default processExports;
