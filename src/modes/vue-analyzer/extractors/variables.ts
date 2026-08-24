// src/modes/vue-analyzer/extractors/variables.ts

import type { Program, Identifier, CatchClause } from 'estree';
import type { VueComponentAnalysis } from '../types.js';
import { getNodeValue } from '../utils.js';

/**
 * Проверка, является ли узел CatchClause
 * Используем type guard для безопасной проверки
 */
function isCatchClause(node: any): node is CatchClause {
  return node && node.type === 'CatchClause';
}

/**
 * Извлечение переменных из AST (let, var)
 */
export function extractVariablesFromAST(ast: Program): VueComponentAnalysis['variables'] {
  const variables: VueComponentAnalysis['variables'] = [];

  if (!ast || !ast.body) return variables;

  try {
    for (const node of ast.body) {
      // Обработка VariableDeclaration с let/var
      if (node.type === 'VariableDeclaration' && (node.kind === 'let' || node.kind === 'var')) {
        for (const decl of node.declarations) {
          if (decl.id?.type === 'Identifier') {
            const name = (decl.id as Identifier).name;
            const value = decl.init ? getNodeValue(decl.init) : undefined;
            const isExported = isNodeExported(node);

            variables.push({
              name,
              value: value !== undefined ? value : 'undefined',
              line: decl.loc?.start?.line || 0,
              isExported,
              type: 'variable',
            });
          }

          // Деструктуризация объекта: let { a, b } = obj
          if (decl.id?.type === 'ObjectPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const prop of decl.id.properties) {
              if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
                const name = (prop.key as Identifier).name;
                const isExported = isNodeExported(node);

                variables.push({
                  name,
                  value: `from ${source}`,
                  line: prop.loc?.start?.line || 0,
                  isExported,
                  type: 'variable',
                });
              }
            }
          }

          // Деструктуризация массива: let [a, b] = arr
          if (decl.id?.type === 'ArrayPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const elem of decl.id.elements) {
              if (elem?.type === 'Identifier') {
                const name = (elem as Identifier).name;
                const isExported = isNodeExported(node);

                variables.push({
                  name,
                  value: `from ${source}`,
                  line: elem.loc?.start?.line || 0,
                  isExported,
                  type: 'variable',
                });
              }
            }
          }

          // Деструктуризация с присвоением: let { a: newA } = obj
          if (decl.id?.type === 'ObjectPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const prop of decl.id.properties) {
              if (prop.type === 'Property') {
                let name: string | undefined;
                if (prop.key?.type === 'Identifier') {
                  name = (prop.key as Identifier).name;
                } else if (prop.key?.type === 'Literal') {
                  name = String(prop.value);
                }

                if (name) {
                  const isExported = isNodeExported(node);
                  variables.push({
                    name,
                    value: `from ${source}`,
                    line: prop.loc?.start?.line || 0,
                    isExported,
                    type: 'variable',
                  });
                }
              }
            }
          }

          // Rest оператор: let { a, ...rest } = obj
          if (decl.id?.type === 'ObjectPattern') {
            const source = decl.init ? getNodeValue(decl.init) : 'unknown';
            for (const prop of decl.id.properties) {
              if (prop.type === 'RestElement' && prop.argument?.type === 'Identifier') {
                const name = (prop.argument as Identifier).name;
                const isExported = isNodeExported(node);

                variables.push({
                  name,
                  value: `...${source}`,
                  line: prop.loc?.start?.line || 0,
                  isExported,
                  type: 'variable',
                });
              }
            }
          }
        }
      }

      // Обработка ExportNamedDeclaration с let/var
      if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
        const decl = node.declaration;
        if (decl.kind === 'let' || decl.kind === 'var') {
          for (const d of decl.declarations) {
            if (d.id?.type === 'Identifier') {
              const name = (d.id as Identifier).name;
              const value = d.init ? getNodeValue(d.init) : undefined;

              variables.push({
                name,
                value: value !== undefined ? value : 'undefined',
                line: d.loc?.start?.line || 0,
                isExported: true,
                type: 'variable',
              });
            }

            // Деструктуризация в экспорте: export let { a, b } = obj
            if (d.id?.type === 'ObjectPattern') {
              const source = d.init ? getNodeValue(d.init) : 'unknown';
              for (const prop of d.id.properties) {
                if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
                  const name = (prop.key as Identifier).name;
                  variables.push({
                    name,
                    value: `from ${source}`,
                    line: prop.loc?.start?.line || 0,
                    isExported: true,
                    type: 'variable',
                  });
                }
              }
            }
          }
        }
      }

      // Обработка ForStatement с let/var
      if (node.type === 'ForStatement' && node.init?.type === 'VariableDeclaration') {
        const decl = node.init;
        if (decl.kind === 'let' || decl.kind === 'var') {
          for (const d of decl.declarations) {
            if (d.id?.type === 'Identifier') {
              const name = (d.id as Identifier).name;
              const value = d.init ? getNodeValue(d.init) : undefined;

              variables.push({
                name,
                value: value !== undefined ? value : 'undefined',
                line: d.loc?.start?.line || 0,
                isExported: false,
                type: 'variable',
              });
            }
          }
        }
      }

      // Обработка ForInStatement с let/var
      if (node.type === 'ForInStatement' && node.left?.type === 'VariableDeclaration') {
        const decl = node.left;
        if (decl.kind === 'let' || decl.kind === 'var') {
          for (const d of decl.declarations) {
            if (d.id?.type === 'Identifier') {
              const name = (d.id as Identifier).name;
              variables.push({
                name,
                value: 'for...in loop variable',
                line: d.loc?.start?.line || 0,
                isExported: false,
                type: 'variable',
              });
            }
          }
        }
      }

      // Обработка ForOfStatement с let/var
      if (node.type === 'ForOfStatement' && node.left?.type === 'VariableDeclaration') {
        const decl = node.left;
        if (decl.kind === 'let' || decl.kind === 'var') {
          for (const d of decl.declarations) {
            if (d.id?.type === 'Identifier') {
              const name = (d.id as Identifier).name;
              variables.push({
                name,
                value: 'for...of loop variable',
                line: d.loc?.start?.line || 0,
                isExported: false,
                type: 'variable',
              });
            }
          }
        }
      }

      // ✅ ИСПРАВЛЕНО: Обработка CatchClause с переменной
      // Используем type guard для безопасной проверки
      if (isCatchClause(node)) {
        const catchNode = node as CatchClause;
        if (catchNode.param && catchNode.param.type === 'Identifier') {
          const paramNode = catchNode.param as Identifier;
          const name = paramNode.name;
          variables.push({
            name,
            value: 'catch error variable',
            line: catchNode.loc?.start?.line || 0,
            isExported: false,
            type: 'variable',
          });
        }
      }

      // Обработка SwitchStatement с объявлением переменных внутри case
      if (node.type === 'SwitchStatement') {
        for (const caseNode of node.cases) {
          for (const consequent of caseNode.consequent) {
            if (consequent.type === 'VariableDeclaration' &&
              (consequent.kind === 'let' || consequent.kind === 'var')) {
              for (const decl of consequent.declarations) {
                if (decl.id?.type === 'Identifier') {
                  const name = (decl.id as Identifier).name;
                  const value = decl.init ? getNodeValue(decl.init) : undefined;
                  variables.push({
                    name,
                    value: value !== undefined ? value : 'undefined',
                    line: decl.loc?.start?.line || 0,
                    isExported: false,
                    type: 'variable',
                  });
                }
              }
            }
          }
        }
      }

      // Обработка BlockStatement с объявлением переменных внутри
      if (node.type === 'BlockStatement') {
        for (const stmt of node.body) {
          if (stmt.type === 'VariableDeclaration' &&
            (stmt.kind === 'let' || stmt.kind === 'var')) {
            for (const decl of stmt.declarations) {
              if (decl.id?.type === 'Identifier') {
                const name = (decl.id as Identifier).name;
                const value = decl.init ? getNodeValue(decl.init) : undefined;
                variables.push({
                  name,
                  value: value !== undefined ? value : 'undefined',
                  line: decl.loc?.start?.line || 0,
                  isExported: false,
                  type: 'variable',
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении переменных из AST:', error);
  }

  return variables;
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
 * Извлечение переменных из скрипта с использованием AST
 * Основной метод - использует AST, fallback на regex
 */
export function extractVariablesFromScript(
  content: string,
  ast?: Program | null
): VueComponentAnalysis['variables'] {
  // Если AST доступен, используем его
  if (ast) {
    try {
      const result = extractVariablesFromAST(ast);
      if (result.length > 0) {
        return result;
      }
    } catch (error) {
      console.warn('⚠️ Ошибка извлечения переменных из AST, используем regex:', error);
    }
  }

  // Fallback: извлечение через регулярные выражения
  return extractVariablesFromSource(content);
}

/**
 * Извлечение переменных из исходного кода (regex fallback)
 */
function extractVariablesFromSource(content: string): VueComponentAnalysis['variables'] {
  const variables: VueComponentAnalysis['variables'] = [];

  if (!content || content.trim() === '') {
    return variables;
  }

  // 1. EXPORT LET / EXPORT VAR
  const exportVarRegex = /export\s+(let|var)\s+(\w+)\s*=\s*([^;]+);/g;
  let match;
  while ((match = exportVarRegex.exec(content)) !== null) {
    const name = match[2];
    const value = match[3]?.trim() || '';

    if (name) {
      variables.push({
        name,
        value: value,
        line: content.substring(0, match.index).split('\n').length,
        isExported: true,
        type: 'variable',
      });
    }
  }

  // 2. LET / VAR
  const varRegex = /(?:^|\n)\s*(let|var)\s+(\w+)\s*=\s*([^;]+);/g;
  while ((match = varRegex.exec(content)) !== null) {
    const name = match[2];
    const value = match[3]?.trim() || '';

    if (name && !variables.find(v => v.name === name)) {
      const isExported = content.includes(`export ${match[1]} ${name}`);
      variables.push({
        name,
        value: value,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        type: 'variable',
      });
    }
  }

  // 3. LET / VAR без инициализации
  const varNoInitRegex = /(?:^|\n)\s*(let|var)\s+(\w+)\s*;/g;
  while ((match = varNoInitRegex.exec(content)) !== null) {
    const name = match[2];

    if (name && !variables.find(v => v.name === name)) {
      const isExported = content.includes(`export ${match[1]} ${name}`);
      variables.push({
        name,
        value: 'undefined',
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        type: 'variable',
      });
    }
  }

  // 4. Несколько переменных через запятую: let a, b, c
  const multiVarRegex = /(?:^|\n)\s*(let|var)\s+(\w+)\s*,\s*(\w+)\s*(?:,\s*(\w+))?\s*;/g;
  while ((match = multiVarRegex.exec(content)) !== null) {
    const names = [match[2], match[3], match[4]].filter(Boolean);
    for (const name of names) {
      if (name && !variables.find(v => v.name === name)) {
        const isExported = content.includes(`export ${match[1]} ${name}`);
        variables.push({
          name,
          value: 'undefined',
          line: content.substring(0, match.index).split('\n').length,
          isExported,
          type: 'variable',
        });
      }
    }
  }

  // 5. LET / VAR с деструктуризацией
  const destructureVarRegex = /(?:export\s+)?(let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*([^;]+);/g;
  while ((match = destructureVarRegex.exec(content)) !== null) {
    const names = match[2]?.split(',').map(n => n.trim()).filter(n => n) || [];
    const value = match[3]?.trim() || '';

    for (const name of names) {
      if (name && !variables.find(v => v.name === name)) {
        const isExported = content.includes(`export ${match[1]} { ${name} }`);
        variables.push({
          name,
          value: `from ${value}`,
          line: content.substring(0, match.index).split('\n').length,
          isExported,
          type: 'variable',
        });
      }
    }
  }

  // 6. LET / VAR с деструктуризацией массива
  const destructureArrayVarRegex = /(?:export\s+)?(let|var)\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/g;
  while ((match = destructureArrayVarRegex.exec(content)) !== null) {
    const names = match[2]?.split(',').map(n => n.trim()).filter(n => n) || [];
    const value = match[3]?.trim() || '';

    for (const name of names) {
      if (name && !variables.find(v => v.name === name)) {
        const isExported = content.includes(`export ${match[1]} [${name}]`);
        variables.push({
          name,
          value: `from ${value}`,
          line: content.substring(0, match.index).split('\n').length,
          isExported,
          type: 'variable',
        });
      }
    }
  }

  // 7. LET / VAR с типом
  const typedVarRegex = /(?:export\s+)?(let|var)\s+(\w+)\s*:\s*[^=]+\s*=\s*([^;]+);/g;
  while ((match = typedVarRegex.exec(content)) !== null) {
    const name = match[2];
    const value = match[3]?.trim() || '';

    if (name && !variables.find(v => v.name === name)) {
      const isExported = content.includes(`export ${match[1]} ${name}`);
      variables.push({
        name,
        value: value,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        type: 'variable',
      });
    }
  }

  // 8. Vue-специфичные переменные (ref, reactive, computed)
  const vueVarRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(ref|reactive|computed|watch|watchEffect|provide|inject)\s*\(/g;
  while ((match = vueVarRegex.exec(content)) !== null) {
    const name = match[1];
    const type = match[2];

    if (name && !variables.find(v => v.name === name)) {
      const isExported = content.includes(`export ${name}`);
      variables.push({
        name,
        value: `${type}(...)`,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        type: 'variable',
      });
    }
  }

  return variables;
}