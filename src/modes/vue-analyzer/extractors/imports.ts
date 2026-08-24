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
 */
export function extractImportsFromSource(content: string): VueComponentAnalysis['imports'] {
  const imports: VueComponentAnalysis['imports'] = [];

  const importRegex =
    /import\s+(?:type\s+)?(?:\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]|(\w+)\s+from\s+['"]([^'"]+)['"]|\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"])/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      // Named imports: import { a, b } from 'source'
      const specifiers = match[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
      const source = match[2];
      const isTypeOnly = content.includes(`import type { ${specifiers.join(', ')} }`);
      if (source && specifiers.length > 0) {
        imports.push({
          source,
          specifiers,
          isTypeOnly,
        });
      }
    } else if (match[3] && match[4]) {
      // Default import: import something from 'source'
      const source = match[4];
      if (source) {
        imports.push({
          source: source,
          specifiers: [`default as ${match[3]}`],
          isTypeOnly: false,
        });
      }
    } else if (match[5] && match[6]) {
      // Namespace import: import * as something from 'source'
      const source = match[6];
      if (source) {
        imports.push({
          source: source,
          specifiers: [`* as ${match[5]}`],
          isTypeOnly: false,
        });
      }
    }
  }

  return imports;
}