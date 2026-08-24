// src/modes/vue-analyzer/extractors/expose.ts

import type { Program } from 'estree';
import type { SFCScriptBlock } from '@vue/compiler-sfc';

/**
 * Извлечение expose из скомпилированного script
 */
export function extractExposeFromCompiledScript(compiledScript: SFCScriptBlock | null): string[] {
  if (!compiledScript) return [];
  const expose = (compiledScript as any).expose;
  if (!expose) return [];
  if (Array.isArray(expose)) {
    return expose.map((e: any) => (typeof e === 'string' ? e : String(e)));
  }
  return [];
}

/**
 * Извлечение expose из AST (fallback)
 */
export function extractExposeFromAST(ast: Program): string[] {
  const expose: string[] = [];

  if (!ast || !ast.body) return expose;

  try {
    const findDefineExpose = (node: any): any => {
      if (!node) return null;

      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'defineExpose'
      ) {
        return node;
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          const result = findDefineExpose(child);
          if (result) return result;
        }
      }

      return null;
    };

    for (const node of ast.body) {
      const defineExposeCall = findDefineExpose(node);
      if (defineExposeCall) {
        const args = defineExposeCall.arguments;
        if (args.length === 1 && args[0]?.type === 'ObjectExpression') {
          for (const prop of args[0].properties) {
            if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
              expose.push(prop.key.name);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении expose из AST:', error);
  }

  return expose;
}