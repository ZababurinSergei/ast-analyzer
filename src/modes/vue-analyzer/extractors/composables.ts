// src/modes/vue-analyzer/extractors/composables.ts

import type { Program } from 'estree';
import type { VueComponentAnalysis } from '../types.js';

/**
 * Извлечение composables из AST
 */
export function extractComposablesFromAST(ast: Program): VueComponentAnalysis['composables'] {
  const composables: VueComponentAnalysis['composables'] = [];

  const vueComposables = ['ref', 'reactive', 'computed', 'watch', 'watchEffect'];

  if (!ast || !ast.body) return composables;

  function visitNode(node: any) {
    if (!node) return;

    try {
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.init && decl.init.type === 'CallExpression') {
            const callee = decl.init.callee;
            let name: string | null = null;

            if (callee.type === 'Identifier') {
              name = callee.name;
            } else if (
              callee.type === 'MemberExpression' &&
              callee.property.type === 'Identifier'
            ) {
              name = callee.property.name;
            }

            if (name && (name.startsWith('use') || vueComposables.includes(name))) {
              const source = decl.id?.type === 'Identifier' ? decl.id.name : 'unknown';
              const args = decl.init.arguments.map((arg: any) => {
                if (arg.type === 'Literal') return String(arg.value);
                if (arg.type === 'Identifier') return arg.name;
                if (arg.type === 'ObjectExpression') return '{ ... }';
                if (arg.type === 'ArrayExpression') return '[ ... ]';
                return '...';
              });

              const exists = composables.some(c => c.name === name && c.source === source);
              if (!exists) {
                composables.push({ name, source, args });
              }
            }
          }
        }
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          visitNode(child);
        }
      }
    } catch (error) {
      // Игнорируем ошибки
    }
  }

  try {
    visitNode(ast);
  } catch (error) {
    // Игнорируем ошибки
  }

  return composables;
}

/**
 * Извлечение composables из исходного кода (fallback)
 */
export function extractComposablesFromSource(content: string): VueComponentAnalysis['composables'] {
  const composables: VueComponentAnalysis['composables'] = [];

  const vueComposables = [
    'ref', 'reactive', 'computed', 'watch', 'watchEffect',
    'provide', 'inject', 'useSlots', 'useAttrs', 'useModel',
    'useRouter', 'useRoute', 'useStore', 'useI18n', 'useHead',
    'useAsyncData', 'useFetch', 'useLazyFetch', 'useCookie',
    'useRuntimeConfig', 'useAppConfig', 'useRequestHeaders',
    'useRequestEvent', 'useRequestURL', 'useSanitizedCookie',
    'useState', 'useHydration', 'useNuxtApp',
  ];

  const patterns = [
    /const\s+(\w+)\s*=\s*(use\w+|computed|ref|reactive|watch|watchEffect|provide|inject)\(([^)]*)\)/g,
    /const\s*\{\s*([^}]+)\s*\}\s*=\s*(use\w+)\(([^)]*)\)/g,
    /const\s*\[\s*([^\]]+)\s*\]\s*=\s*(use\w+)\(([^)]*)\)/g,
    /(use\w+)\(/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let source: string;
      let name: string;
      let args: string[] = [];

      const isDestructure = pattern.source.includes(
        'const\\s*\\{\\s*([^}]+)\\s*\\}\\s*=\\s*(use\\w+)'
      );
      const isArray = pattern.source.includes('const\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*=\\s*(use\\w+)');
      const isDirectCall = pattern.source.includes('(use\\w+)\\(') && !pattern.source.includes('const');

      if (isDestructure) {
        source = match[1]?.trim() || 'unknown';
        name = match[2] || 'unknown';
        args = match[3]
          ? match[3]
            .split(',')
            .map(a => a.trim())
            .filter(a => a)
          : [];
      } else if (isArray) {
        source = match[1]?.trim() || 'unknown';
        name = match[2] || 'unknown';
        args = match[3]
          ? match[3]
            .split(',')
            .map(a => a.trim())
            .filter(a => a)
          : [];
      } else if (isDirectCall) {
        name = match[1] || 'unknown';
        source = 'direct_call';
        args = [];
      } else {
        source = match[1]?.trim() || 'unknown';
        name = match[2] || 'unknown';
        args = match[3]
          ? match[3]
            .split(',')
            .map(a => a.trim())
            .filter(a => a)
          : [];
      }

      if (!name || name === 'unknown') continue;

      if (name.startsWith('use') || vueComposables.includes(name)) {
        const exists = composables.some(c => c.name === name && c.source === source);
        if (!exists) {
          composables.push({ name, source, args });
        }
      }
    }
  }

  const destructurePattern = /const\s*\{\s*([^}]+)\s*\}\s*=\s*(use\w+)\(/g;
  destructurePattern.lastIndex = 0;
  let destMatch;
  while ((destMatch = destructurePattern.exec(content)) !== null) {
    const source = destMatch[1]?.trim() || 'unknown';
    const name = destMatch[2] || 'unknown';
    if (name && name.startsWith('use') && name !== 'unknown') {
      const exists = composables.some(c => c.name === name && c.source === source);
      if (!exists) {
        composables.push({ name, source, args: [] });
      }
    }
  }

  return composables;
}