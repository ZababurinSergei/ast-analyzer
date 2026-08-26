// src/modes/vue-analyzer/extractors/imports.ts

import type { Program } from 'estree';
import type { VueComponentAnalysis } from '../types.js';

/**
 * Извлечение imports из AST
 */
export function extractImportsFromAST(ast: Program): VueComponentAnalysis['imports'] {
  const imports: VueComponentAnalysis['imports'] = [];

  if (!ast || !ast.body) return imports;

  try {
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration' && node.source) {
        const specifiers: string[] = [];
        let isTypeOnly = false;

        const importNode = node as any;
        if (importNode.importKind === 'type') {
          isTypeOnly = true;
        }

        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const importedName =
              spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
            const localName = spec.local.name;
            if (importedName === localName) {
              specifiers.push(importedName);
            } else {
              specifiers.push(`${importedName} as ${localName}`);
            }
          } else if (spec.type === 'ImportDefaultSpecifier') {
            specifiers.push(`default as ${spec.local.name}`);
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            specifiers.push(`* as ${spec.local.name}`);
          }
        }

        const sourceValue = node.source.value;
        if (typeof sourceValue === 'string') {
          imports.push({
            source: sourceValue,
            specifiers,
            isTypeOnly,
          });
        }
      }
    }
  } catch (error) {
    // Игнорируем ошибки
  }

  return imports;
}

/**
 * Извлечение imports из исходного кода (fallback)
 * ✅ УЛУЧШЕНО: поддержка всех типов импортов, проверка дубликатов
 */
export function extractImportsFromSource(content: string): VueComponentAnalysis['imports'] {
  const imports: VueComponentAnalysis['imports'] = [];

  if (!content || content.trim() === '') {
    return imports;
  }

  // 1. NAMED IMPORTS: import { a, b } from 'source'
  const namedRegex = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = namedRegex.exec(content)) !== null) {
    const specifiers = match[1]
      ? match[1]
          .split(',')
          .map(s => s.trim())
          .filter(s => s)
      : [];
    const source = match[2] || '';
    if (source && specifiers.length > 0) {
      // Проверяем, не добавлен ли уже такой импорт
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers,
          isTypeOnly: content.includes(`import type { ${specifiers.join(', ')} }`),
        });
      }
    }
  }

  // 2. DEFAULT IMPORTS: import something from 'source'
  const defaultRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = defaultRegex.exec(content)) !== null) {
    const source = match[2] || '';
    const specifier = match[1] || '';
    if (source && specifier) {
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers: [`default as ${specifier}`],
          isTypeOnly: false,
        });
      }
    }
  }

  // 3. NAMESPACE IMPORTS: import * as something from 'source'
  const namespaceRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namespaceRegex.exec(content)) !== null) {
    const source = match[2] || '';
    const specifier = match[1] || '';
    if (source && specifier) {
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers: [`* as ${specifier}`],
          isTypeOnly: false,
        });
      }
    }
  }

  // 4. TYPE IMPORTS: import type { a, b } from 'source'
  const typeRegex = /import\s+type\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = typeRegex.exec(content)) !== null) {
    const specifiers = match[1]
      ? match[1]
          .split(',')
          .map(s => s.trim())
          .filter(s => s)
      : [];
    const source = match[2] || '';
    if (source && specifiers.length > 0) {
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers,
          isTypeOnly: true,
        });
      }
    }
  }

  // 5. DYNAMIC IMPORTS: import('source')
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    const source = match[1] || '';
    if (source) {
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers: ['dynamic'],
          isTypeOnly: false,
        });
      }
    }
  }

  // 6. SIDE-EFFECT IMPORTS: import 'source'
  const sideEffectRegex = /^import\s+['"]([^'"]+)['"]/gm;
  while ((match = sideEffectRegex.exec(content)) !== null) {
    const source = match[1] || '';
    if (source) {
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers: [],
          isTypeOnly: false,
        });
      }
    }
  }

  return imports;
}

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Извлечение импортов с полной информацией о типах
 */
export function extractImportsWithDetails(content: string): VueComponentAnalysis['imports'] {
  const imports: VueComponentAnalysis['imports'] = [];

  if (!content || content.trim() === '') {
    return imports;
  }

  // 1. NAMED IMPORTS с алиасами: import { a as b, c } from 'source'
  const namedWithAliasRegex = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = namedWithAliasRegex.exec(content)) !== null) {
    const source = match[2] || '';
    if (!source) continue;

    const specifiers = match[1]
      ? match[1]
          .split(',')
          .map(s => s.trim())
          .filter(s => s)
          .map(s => {
            // Проверяем алиас: "original as alias"
            const aliasMatch = s.match(/^(\w+)\s+as\s+(\w+)$/);
            if (aliasMatch) {
              return `${aliasMatch[1] || ''} as ${aliasMatch[2] || ''}`;
            }
            return s;
          })
          .filter(s => s)
      : [];

    if (specifiers.length > 0) {
      const exists = imports.some(
        i =>
          i.source === source &&
          i.specifiers.length === specifiers.length &&
          i.specifiers.every((s: string) => specifiers.includes(s))
      );
      if (!exists) {
        imports.push({
          source,
          specifiers,
          isTypeOnly: content.includes(`import type { ${specifiers.join(', ')} }`),
        });
      }
    }
  }

  // 2. DEFAULT IMPORTS с алиасами: import something from 'source'
  const defaultWithAliasRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = defaultWithAliasRegex.exec(content)) !== null) {
    const source = match[2] || '';
    const specifier = match[1] || '';
    if (source && specifier) {
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers: [`default as ${specifier}`],
          isTypeOnly: false,
        });
      }
    }
  }

  // 3. NAMESPACE IMPORTS: import * as something from 'source'
  const namespaceWithAliasRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namespaceWithAliasRegex.exec(content)) !== null) {
    const source = match[2] || '';
    const specifier = match[1] || '';
    if (source && specifier) {
      const exists = imports.some(i => i.source === source);
      if (!exists) {
        imports.push({
          source,
          specifiers: [`* as ${specifier}`],
          isTypeOnly: false,
        });
      }
    }
  }

  return imports;
}

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Группировка импортов по типу
 */
export function groupImportsByType(imports: VueComponentAnalysis['imports']): {
  external: VueComponentAnalysis['imports'];
  internal: VueComponentAnalysis['imports'];
  aliased: VueComponentAnalysis['imports'];
  typeOnly: VueComponentAnalysis['imports'];
} {
  const result = {
    external: [] as VueComponentAnalysis['imports'],
    internal: [] as VueComponentAnalysis['imports'],
    aliased: [] as VueComponentAnalysis['imports'],
    typeOnly: [] as VueComponentAnalysis['imports'],
  };

  if (!imports) return result;

  for (const imp of imports) {
    if (!imp) continue;

    // Type-only imports
    if (imp.isTypeOnly) {
      result.typeOnly.push(imp);
      continue;
    }

    // External imports (from node_modules)
    if (
      !imp.source.startsWith('.') &&
      !imp.source.startsWith('@/') &&
      !imp.source.startsWith('~')
    ) {
      result.external.push(imp);
      continue;
    }

    // Aliased imports (@/, #/, ~/)
    if (imp.source.startsWith('@/') || imp.source.startsWith('#') || imp.source.startsWith('~')) {
      result.aliased.push(imp);
      continue;
    }

    // Internal imports (relative paths)
    result.internal.push(imp);
  }

  return result;
}

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Проверка, используется ли импорт
 */
export function isImportUsed(imp: VueComponentAnalysis['imports'][0], content: string): boolean {
  if (!imp || !imp.specifiers || !content) return false;

  for (const spec of imp.specifiers) {
    if (!spec) continue;

    // Извлекаем локальное имя из specifier
    let localName = spec;
    const aliasMatch = spec.match(/^(\w+)\s+as\s+(\w+)$/);
    if (aliasMatch) {
      localName = aliasMatch[2] || aliasMatch[1] || ''; // берем alias как локальное имя
    } else if (spec.startsWith('default as ')) {
      localName = spec.replace('default as ', '');
    } else if (spec.startsWith('* as ')) {
      localName = spec.replace('* as ', '');
    }

    if (!localName) continue;

    // Проверяем, используется ли имя в коде
    const usagePattern = new RegExp(`\\b${localName}\\b`, 'g');
    const matches = content.match(usagePattern);
    if (matches && matches.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Фильтрация неиспользуемых импортов
 */
export function filterUnusedImports(
  imports: VueComponentAnalysis['imports'],
  content: string
): VueComponentAnalysis['imports'] {
  if (!imports || !content) return [];
  return imports.filter(imp => isImportUsed(imp, content));
}

// Экспорт по умолчанию
export default {
  extractImportsFromAST,
  extractImportsFromSource,
  extractImportsWithDetails,
  groupImportsByType,
  isImportUsed,
  filterUnusedImports,
};
