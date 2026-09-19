// packages/ast-analyzer/src/core/entity-extractor/vue/convert-imports.ts
// ============================================
// ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================
// Исправления:
//   1. Путь импорта приведён к правильному относительному пути
//      (на 3 уровня выше до src/)
// ============================================

import type { ImportInfo } from '../../../types.js';

/**
 * Конвертирует импорты из Vue анализа в формат ImportInfo[]
 */
export function convertVueImportsToImportInfo(
  vueImports: { source: string; specifiers: string[]; isTypeOnly: boolean }[]
): ImportInfo[] {
  if (!vueImports || vueImports.length === 0) {
    return [];
  }

  return vueImports.map(imp => ({
    source: imp.source,
    specifiers: imp.specifiers.map(s => ({
      local: s,
      imported: s,
      type: 'ImportSpecifier',
    })),
    loc: null,
    isTypeOnly: imp.isTypeOnly || false,
  }));
}
