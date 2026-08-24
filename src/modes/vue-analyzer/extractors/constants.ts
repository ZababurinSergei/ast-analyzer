// src/modes/vue-analyzer/extractors/constants.ts

import type { Program } from 'estree';
import type { VueComponentAnalysis } from '../types.js';
import { getNodeValue } from '../utils.js';

/**
 * Извлечение констант из AST
 */
export function extractConstantsFromAST(ast: Program): VueComponentAnalysis['constants'] {
  const constants: VueComponentAnalysis['constants'] = [];

  if (!ast || !ast.body) return constants;

  try {
    for (const node of ast.body) {
      // Обработка VariableDeclaration с const
      if (node.type === 'VariableDeclaration' && node.kind === 'const') {
        for (const decl of node.declarations) {
          if (decl.id?.type === 'Identifier') {
            const name = decl.id.name;
            const value = decl.init ? getNodeValue(decl.init) : undefined;
            const isExported = isNodeExported(node);

            constants.push({
              name,
              value: value !== undefined ? value : 'undefined',
              line: decl.loc?.start?.line || 0,
              isExported,
              type: 'const',
            });
          }

          // Деструктуризация объекта: const { a, b } = obj
          if (decl.id?.type === 'ObjectPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const prop of decl.id.properties) {
              if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
                const name = prop.key.name;
                const isExported = isNodeExported(node);

                constants.push({
                  name,
                  value: `from ${source}`,
                  line: prop.loc?.start?.line || 0,
                  isExported,
                  type: 'const',
                });
              }
            }
          }

          // Деструктуризация массива: const [a, b] = arr
          if (decl.id?.type === 'ArrayPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const elem of decl.id.elements) {
              if (elem?.type === 'Identifier') {
                const name = elem.name;
                const isExported = isNodeExported(node);

                constants.push({
                  name,
                  value: `from ${source}`,
                  line: elem.loc?.start?.line || 0,
                  isExported,
                  type: 'const',
                });
              }
            }
          }

          // Деструктуризация с присвоением: const { a: newA } = obj
          if (decl.id?.type === 'ObjectPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const prop of decl.id.properties) {
              if (prop.type === 'Property') {
                let name: string | undefined;
                if (prop.key?.type === 'Identifier') {
                  name = prop.key.name;
                } else if (prop.key?.type === 'Literal') {
                  name = String(prop.value);
                }

                if (name) {
                  const isExported = isNodeExported(node);
                  constants.push({
                    name,
                    value: `from ${source}`,
                    line: prop.loc?.start?.line || 0,
                    isExported,
                    type: 'const',
                  });
                }
              }
            }
          }

          // Rest оператор: const { a, ...rest } = obj
          if (decl.id?.type === 'ObjectPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const prop of decl.id.properties) {
              if (prop.type === 'RestElement' && prop.argument?.type === 'Identifier') {
                const name = prop.argument.name;
                const isExported = isNodeExported(node);

                constants.push({
                  name,
                  value: `...${source}`,
                  line: prop.loc?.start?.line || 0,
                  isExported,
                  type: 'const',
                });
              }
            }
          }
        }
      }

      // Обработка ExportNamedDeclaration с const
      if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
        const decl = node.declaration;
        if (decl.kind === 'const') {
          for (const d of decl.declarations) {
            if (d.id?.type === 'Identifier') {
              const name = d.id.name;
              const value = d.init ? getNodeValue(d.init) : undefined;

              constants.push({
                name,
                value: value !== undefined ? value : 'undefined',
                line: d.loc?.start?.line || 0,
                isExported: true,
                type: 'const',
              });
            }
          }
        }
      }

      // Обработка ExportDefaultDeclaration с const
      if (node.type === 'ExportDefaultDeclaration' && node.declaration?.type === 'Identifier') {
        const name = node.declaration.name;
        constants.push({
          name: `default as ${name}`,
          value: 'export default',
          line: node.loc?.start?.line || 0,
          isExported: true,
          type: 'const',
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении констант из AST:', error);
  }

  return constants;
}

/**
 * Проверка, экспортируется ли узел
 */
function isNodeExported(node: any): boolean {
  if (!node) return false;

  // Прямой export
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

  // Проверка родителя
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
      return true;
    }
    parent = parent.parent;
  }

  return false;
}

/**
 * Извлечение констант из скрипта с использованием AST
 * Основной метод - использует AST, fallback на regex
 */
export function extractConstantsFromScript(
  content: string,
  ast?: Program | null
): VueComponentAnalysis['constants'] {
  // Если AST доступен, используем его
  if (ast) {
    try {
      const result = extractConstantsFromAST(ast);
      if (result.length > 0) {
        return result;
      }
    } catch (error) {
      console.warn('⚠️ Ошибка извлечения констант из AST, используем regex:', error);
    }
  }

  // Fallback: извлечение через регулярные выражения
  return extractConstantsFromSource(content);
}

/**
 * Извлечение констант из исходного кода (regex fallback)
 */
function extractConstantsFromSource(content: string): VueComponentAnalysis['constants'] {
  const constants: VueComponentAnalysis['constants'] = [];

  if (!content || content.trim() === '') {
    return constants;
  }

  // 1. EXPORT CONST
  const exportConstRegex = /export\s+const\s+(\w+)\s*=\s*([^;]+);/g;
  let match;
  while ((match = exportConstRegex.exec(content)) !== null) {
    const name = match[1];
    const value = match[2]?.trim() || '';

    if (name) {
      constants.push({
        name,
        value: value,
        line: content.substring(0, match.index).split('\n').length,
        isExported: true,
        type: 'const',
      });
    }
  }

  // 2. CONST
  const constRegex = /(?:^|\n)\s*const\s+(\w+)\s*=\s*([^;]+);/g;
  while ((match = constRegex.exec(content)) !== null) {
    const name = match[1];
    const value = match[2]?.trim() || '';

    if (name && !constants.find(c => c.name === name)) {
      const isExported = content.includes(`export const ${name}`);
      constants.push({
        name,
        value: value,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        type: 'const',
      });
    }
  }

  // 3. CONST с деструктуризацией
  const destructureConstRegex = /(?:export\s+)?const\s*\{\s*([^}]+)\s*\}\s*=\s*([^;]+);/g;
  while ((match = destructureConstRegex.exec(content)) !== null) {
    const names = match[1]?.split(',').map(n => n.trim()).filter(n => n) || [];
    const value = match[2]?.trim() || '';

    for (const name of names) {
      if (name && !constants.find(c => c.name === name)) {
        const isExported = content.includes(`export const { ${name} }`);
        constants.push({
          name,
          value: value,
          line: content.substring(0, match.index).split('\n').length,
          isExported,
          type: 'const',
        });
      }
    }
  }

  // 4. CONST с деструктуризацией массива
  const destructureArrayRegex = /(?:export\s+)?const\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/g;
  while ((match = destructureArrayRegex.exec(content)) !== null) {
    const names = match[1]?.split(',').map(n => n.trim()).filter(n => n) || [];
    const value = match[2]?.trim() || '';

    for (const name of names) {
      if (name && !constants.find(c => c.name === name)) {
        const isExported = content.includes(`export const [${name}]`);
        constants.push({
          name,
          value: value,
          line: content.substring(0, match.index).split('\n').length,
          isExported,
          type: 'const',
        });
      }
    }
  }

  // 5. CONST с типом
  const typedConstRegex = /(?:export\s+)?const\s+(\w+)\s*:\s*[^=]+\s*=\s*([^;]+);/g;
  while ((match = typedConstRegex.exec(content)) !== null) {
    const name = match[1];
    const value = match[2]?.trim() || '';

    if (name && !constants.find(c => c.name === name)) {
      const isExported = content.includes(`export const ${name}`);
      constants.push({
        name,
        value: value,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        type: 'const',
      });
    }
  }

  // 6. Vue-макросы как константы
  const vueMacroRegex = /(?:const\s+)?(defineProps|defineEmits|defineExpose|withDefaults|defineModel|defineOptions|defineSlots|defineComponent)\s*(?:<[^>]*>)?\s*\(/g;
  while ((match = vueMacroRegex.exec(content)) !== null) {
    const name = match[1];
    if (name && !constants.find(c => c.name === name)) {
      constants.push({
        name,
        value: `Vue macro: ${name}`,
        line: content.substring(0, match.index).split('\n').length,
        isExported: true,
        type: 'macro',
      });
    }
  }

  return constants;
}