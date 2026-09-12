// packages/ast-analyzer/src/core/entity-extractor/ast/process-exports.ts
import type { ExportInfo } from '../../../types.js';
import type { ASTExport } from '../types.js';

/**
 * Преобразует экспорты из AST в ExportInfo[]
 *
 * ✅ ИСПРАВЛЕНО: путь импорта изменён с '../../types.js' на '../../../types.js'
 *    (файл находится в src/core/entity-extractor/ast/, а types.ts в src/)
 * ✅ ИСПРАВЛЕНО: убрано поле isTypeOnly, т.к. в типе из collectExportsFromAST его нет
 */
export function processExports(exportsFromAST: ASTExport[]): ExportInfo[] {
  const exports: ExportInfo[] = [];

  for (const exp of exportsFromAST) {
    exports.push({
      name: exp.name,
      type: exp.type === 're-export' ? 're-export' : (exp.type as any) || 'value',
      isDefault: exp.isDefault || false,
      loc: exp.loc || null,
      isReExport: exp.isReExport || false,
      source: exp.source,
    });
  }

  return exports;
}
