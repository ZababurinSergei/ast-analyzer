// src/modes/vue-analyzer/extractors/emits.ts

import type { Program } from 'estree';
import type { SFCScriptBlock } from '@vue/compiler-sfc';
import type { VueComponentAnalysis } from '../types.js';
import { getNodeValue } from '../utils.js';

/**
 * Извлечение emits из исходного кода (regex)
 */
export function extractEmitsFromSource(content: string): VueComponentAnalysis['emits'] {
  const result: VueComponentAnalysis['emits'] = {
    names: [],
    types: {},
  };

  // defineEmits(['update', 'delete'])
  const arrayMatch = content.match(/defineEmits\s*\(\s*\[\s*([\s\S]*?)\s*\]\s*\)/);
  if (arrayMatch) {
    const emitsContent = arrayMatch[1];
    if (emitsContent) {
      const emitNames = emitsContent.match(/['"]([^'"]+)['"]/g);
      if (emitNames) {
        for (const emit of emitNames) {
          const name = emit.slice(1, -1);
          result.names.push(name);
          result.types[name] = 'any';
        }
      }
    }
    return result;
  }

  // defineEmits<{ update: [value: number] }>()
  const tsMatch = content.match(/defineEmits\s*<\s*\{\s*([\s\S]*?)\s*\}\s*>/);
  if (tsMatch) {
    const emitsContent = tsMatch[1];
    if (emitsContent) {
      const emitNames = emitsContent.match(/^\s*(\w+)\s*:/gm);
      if (emitNames) {
        for (const emit of emitNames) {
          const name = emit.trim().replace(':', '');
          result.names.push(name);
          result.types[name] = 'any';
        }
      }
    }
    return result;
  }

  return result;
}

/**
 * Извлечение emits из скомпилированного script
 */
export function extractEmitsFromCompiledScript(
  compiledScript: SFCScriptBlock | null
): VueComponentAnalysis['emits'] {
  const result: VueComponentAnalysis['emits'] = {
    names: [],
    types: {},
  };

  if (!compiledScript) return result;

  const emits = (compiledScript as any).emits;
  if (!emits) return result;

  if (Array.isArray(emits)) {
    for (const name of emits) {
      if (typeof name === 'string') {
        result.names.push(name);
        result.types[name] = 'any';
      }
    }
    return result;
  }

  if (typeof emits === 'object') {
    for (const [name, emitData] of Object.entries(emits)) {
      result.names.push(name);
      let type = 'any';
      if (emitData && typeof emitData === 'object') {
        const emitDataObj = emitData as any;
        if (emitDataObj.type) {
          if (typeof emitDataObj.type === 'string') {
            type = emitDataObj.type;
          } else if (emitDataObj.type.name) {
            type = emitDataObj.type.name;
          }
        }
      }
      result.types[name] = type;
    }
  }

  return result;
}

/**
 * Извлечение emits из AST (fallback)
 */
export function extractEmitsFromAST(ast: Program): VueComponentAnalysis['emits'] {
  const result: VueComponentAnalysis['emits'] = {
    names: [],
    types: {},
  };

  if (!ast || !ast.body) return result;

  try {
    const findDefineEmits = (node: any): any => {
      if (!node) return null;

      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'defineEmits'
      ) {
        return node;
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          const result = findDefineEmits(child);
          if (result) return result;
        }
      }

      return null;
    };

    for (const node of ast.body) {
      const defineEmitsCall = findDefineEmits(node);
      if (defineEmitsCall) {
        const args = defineEmitsCall.arguments;
        const typeParams = defineEmitsCall.typeParameters;

        if (typeParams && typeParams.params && typeParams.params.length > 0) {
          const typeNode = typeParams.params[0];
          if (typeNode?.type === 'TSTypeLiteral' && typeNode.members) {
            for (const member of typeNode.members) {
              if (member.type === 'TSPropertySignature' && member.key?.type === 'Identifier') {
                const name = member.key.name;
                if (name) {
                  result.names.push(name);
                  result.types[name] = 'any';
                }
              }
            }
          }
        }

        if (args.length === 1 && args[0]?.type === 'ArrayExpression') {
          for (const elem of args[0].elements) {
            const value = getNodeValue(elem);
            if (value !== undefined) {
              result.names.push(String(value));
              result.types[String(value)] = 'any';
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении emits из AST:', error);
  }

  return result;
}