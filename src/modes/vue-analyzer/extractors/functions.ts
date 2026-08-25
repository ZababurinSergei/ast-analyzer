// src/modes/vue-analyzer/extractors/functions.ts

import type { VueComponentAnalysis } from '../types.js';
import { parse as parseTS } from '@typescript-eslint/parser';
import type { Program } from 'estree';

/**
 * Извлечение функций из скрипта с использованием AST парсера
 */
export function extractFunctionsFromScript(
  content: string,
  _filePath: string
): VueComponentAnalysis['functions'] {
  const functions: VueComponentAnalysis['functions'] = [];

  if (!content || content.trim() === '') {
    return functions;
  }

  // Парсим скрипт в AST
  let ast: Program | null = null;
  try {
    ast = parseTS(content, {
      ecmaVersion: 2022,
      sourceType: 'module',
      loc: true,
      range: true,
      ecmaFeatures: {
        jsx: true,
      },
    }) as Program;
  } catch {
    // Если парсинг не удался, используем fallback через regex
    return extractFunctionsFromScriptFallback(content);
  }

  if (!ast || !ast.body) {
    return functions;
  }

  // Обходим AST для поиска функций
  const visitNode = (node: any, parent?: any, _classContext?: string) => {
    if (!node) return;

    // 1. FunctionDeclaration
    if (node.type === 'FunctionDeclaration' && node.id) {
      const name = node.id.name;
      if (name) {
        const isExported = isNodeExported(node, parent);
        const isAsync = node.async || false;
        const params = node.params.map((p: any) => getParamName(p)).filter(Boolean);
        const body = node.body ? extractBodyText(node.body) : '';
        const line = node.loc?.start?.line || 1;

        functions.push({
          name,
          line,
          isAsync,
          isExported,
          params,
          returnType: getReturnType(node),
          body: body.length > 200 ? body.substring(0, 200) + '...' : body,
        });
      }
    }

    // 2. ClassDeclaration - собираем методы
    if (node.type === 'ClassDeclaration' && node.id) {
      const className = node.id.name;
      const isExported = isNodeExported(node, parent);

      if (node.body?.body) {
        for (const member of node.body.body) {
          // Методы класса
          if (member.type === 'MethodDefinition' && member.key) {
            const methodName = member.key.name || member.key.value;
            if (methodName && methodName !== 'constructor') {
              const isAsync = member.value?.async || false;
              const params = member.value?.params?.map((p: any) => getParamName(p)).filter(Boolean) || [];
              const body = member.value?.body ? extractBodyText(member.value.body) : '';
              const line = member.loc?.start?.line || 1;

              // Проверяем, что метод не дублируется
              if (!functions.find(f => f.name === `${className}.${methodName}`)) {
                functions.push({
                  name: `${className}.${methodName}`,
                  line,
                  isAsync,
                  isExported,
                  params,
                  returnType: getReturnType(member.value),
                  body: body.length > 200 ? body.substring(0, 200) + '...' : body,
                });
              }
            }
          }

          // Геттеры и сеттеры
          if (member.type === 'PropertyDefinition' && member.key) {
            const propName = member.key.name || member.key.value;
            if (propName && member.value?.type === 'FunctionExpression') {
              const isAsync = member.value.async || false;
              const params = member.value.params?.map((p: any) => getParamName(p)).filter(Boolean) || [];
              const body = member.value.body ? extractBodyText(member.value.body) : '';
              const line = member.loc?.start?.line || 1;

              if (!functions.find(f => f.name === `${className}.${propName}`)) {
                functions.push({
                  name: `${className}.${propName}`,
                  line,
                  isAsync,
                  isExported,
                  params,
                  returnType: getReturnType(member.value),
                  body: body.length > 200 ? body.substring(0, 200) + '...' : body,
                });
              }
            }
          }
        }
      }
    }

    // 3. VariableDeclaration с стрелочными функциями
    if (node.type === 'VariableDeclaration') {
      const isExported = isNodeExported(node, parent);
      const kind = node.kind;

      for (const decl of node.declarations || []) {
        if (decl?.id?.type === 'Identifier' && decl.init) {
          const name = decl.id.name;
          const isAsync = decl.init.async || false;
          const isArrow = decl.init.type === 'ArrowFunctionExpression';
          const isFunction = decl.init.type === 'FunctionExpression' || isArrow;

          // ✅ ОБРАБОТКА СТРЕЛОЧНЫХ ФУНКЦИЙ В КОНСТАНТАХ
          if (isFunction && name) {
            const params = decl.init.params?.map((p: any) => getParamName(p)).filter(Boolean) || [];
            const body = decl.init.body ? extractBodyText(decl.init.body) : '';
            const line = decl.loc?.start?.line || 1;

            // Пропускаем, если уже есть такая функция
            if (!functions.find(f => f.name === name)) {
              functions.push({
                name,
                line,
                isAsync,
                isExported: isExported || kind === 'const',
                params,
                returnType: getReturnType(decl.init),
                body: body.length > 200 ? body.substring(0, 200) + '...' : body,
              });
            }
          }

          // Vue макросы
          if (decl.init.type === 'CallExpression' && decl.init.callee?.type === 'Identifier') {
            const macroName = decl.init.callee.name;
            const vueMacros = ['defineProps', 'defineEmits', 'defineExpose', 'withDefaults'];
            if (vueMacros.includes(macroName) && !functions.find(f => f.name === macroName)) {
              const line = decl.loc?.start?.line || 1;
              functions.push({
                name: macroName,
                line,
                isAsync: false,
                isExported: true,
                params: [],
                returnType: 'any',
                body: `Vue macro: ${macroName}`,
              });
            }
          }

          // Composables
          if (decl.init.type === 'CallExpression' && decl.init.callee?.type === 'Identifier') {
            const callName = decl.init.callee.name;
            if (callName.startsWith('use') && !functions.find(f => f.name === name)) {
              const args = decl.init.arguments?.map((arg: any) => {
                if (arg.type === 'Literal') return String(arg.value);
                if (arg.type === 'Identifier') return arg.name;
                if (arg.type === 'ObjectExpression') return '{ ... }';
                if (arg.type === 'ArrayExpression') return '[ ... ]';
                return '...';
              }) || [];
              const line = decl.loc?.start?.line || 1;

              functions.push({
                name,
                line,
                isAsync: false,
                isExported: isExported || kind === 'const',
                params: args,
                returnType: 'any',
                body: `Composable: ${callName}(${args.join(', ')})`,
              });
            }
          }
        }

        // ✅ ДОПОЛНИТЕЛЬНАЯ ОБРАБОТКА: деструктуризация с функциями
        if (decl?.id?.type === 'ObjectPattern' && decl.init) {
          const source = decl.init.type === 'CallExpression'
            ? decl.init.callee?.name || 'unknown'
            : 'unknown';

          for (const prop of decl.id.properties || []) {
            if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
              const name = prop.key.name;
              const isFunction = prop.value?.type === 'ArrowFunctionExpression' ||
                prop.value?.type === 'FunctionExpression';

              if (isFunction && name && !functions.find(f => f.name === name)) {
                const line = prop.loc?.start?.line || decl.loc?.start?.line || 1;
                functions.push({
                  name,
                  line,
                  isAsync: false,
                  isExported: isExported || kind === 'const',
                  params: [],
                  returnType: 'any',
                  body: `from ${source}`,
                });
              }
            }
          }
        }
      }
    }

    // 4. ExportNamedDeclaration
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      visitNode(node.declaration, node);
    }

    // 5. ExportDefaultDeclaration
    if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
      visitNode(node.declaration, node);
    }

    // 6. Методы внутри ObjectExpression (для Vue Options API)
    if (node.type === 'ObjectExpression' && node.properties) {
      for (const prop of node.properties) {
        if (prop.type === 'Property' && prop.key && prop.value) {
          const propName = prop.key.name || prop.key.value;
          const isMethod = prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression';

          if (isMethod && propName && typeof propName === 'string') {
            // Проверяем, что это не стандартные Vue опции
            const vueOptions = ['props', 'data', 'computed', 'watch', 'methods', 'created', 'mounted', 'updated', 'destroyed'];
            if (!vueOptions.includes(propName) && !functions.find(f => f.name === propName)) {
              const isAsync = prop.value.async || false;
              const params = prop.value.params?.map((p: any) => getParamName(p)).filter(Boolean) || [];
              const body = prop.value.body ? extractBodyText(prop.value.body) : '';
              const line = prop.loc?.start?.line || 1;
              const isExported = isNodeExported(node, parent);

              functions.push({
                name: propName,
                line,
                isAsync,
                isExported,
                params,
                returnType: getReturnType(prop.value),
                body: body.length > 200 ? body.substring(0, 200) + '...' : body,
              });
            }
          }
        }
      }
    }

    // Рекурсивный обход детей
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object') {
              visitNode(item, node);
            }
          }
        } else {
          visitNode(child, node);
        }
      }
    }
  };

  // Запускаем обход AST
  for (const node of ast.body) {
    visitNode(node);
  }

  // Удаляем дубликаты (оставляем первое вхождение)
  const seen = new Set<string>();
  const uniqueFunctions = functions.filter(f => {
    const key = f.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueFunctions;
}

/**
 * Fallback: извлечение функций через регулярные выражения
 */
function extractFunctionsFromScriptFallback(content: string): VueComponentAnalysis['functions'] {
  const functions: VueComponentAnalysis['functions'] = [];

  if (!content || content.trim() === '') {
    return functions;
  }

  // 1. Обычные функции: function name() {}
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const name = match[1];
    const paramsStr = match[2] || '';
    const body = match[3]?.trim() || '';

    if (name) {
      const isExported = content.includes(`export function ${name}`);
      const isAsync = content.includes(`async function ${name}`) || content.includes(`export async function ${name}`);
      const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);

      functions.push({
        name,
        line: content.substring(0, match.index).split('\n').length,
        isAsync,
        isExported,
        params,
        returnType: 'any',
        body: body.length > 200 ? body.substring(0, 200) + '...' : body,
      });
    }
  }

  // 2. Стрелочные функции: const fn = () => {}
  const arrowRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const name = match[1];
    const paramsStr = match[2] || '';
    const body = match[3]?.trim() || '';

    if (name && !functions.find(f => f.name === name)) {
      const isExported = content.includes(`export const ${name}`);
      const isAsync = content.includes(`async (${paramsStr}) =>`) || content.includes(`async function`);

      const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);

      functions.push({
        name,
        line: content.substring(0, match.index).split('\n').length,
        isAsync,
        isExported,
        params,
        returnType: 'any',
        body: body.length > 200 ? body.substring(0, 200) + '...' : body,
      });
    }
  }

  // 3. Стрелочные функции с возвратом без фигурных скобок: const fn = () => value
  const arrowSimpleRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*([^;]+);/g;
  while ((match = arrowSimpleRegex.exec(content)) !== null) {
    const name = match[1];
    const paramsStr = match[2] || '';
    const body = match[3]?.trim() || '';

    if (name && !functions.find(f => f.name === name)) {
      const isExported = content.includes(`export const ${name}`);
      const isAsync = content.includes(`async (${paramsStr}) =>`);

      const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);

      functions.push({
        name,
        line: content.substring(0, match.index).split('\n').length,
        isAsync,
        isExported,
        params,
        returnType: 'any',
        body: body.length > 200 ? body.substring(0, 200) + '...' : body,
      });
    }
  }

  // 4. Vue макросы
  const vueMacros = ['defineProps', 'defineEmits', 'defineExpose', 'withDefaults'];
  for (const macro of vueMacros) {
    const macroRegex = new RegExp(`(?:const\\s+)?${macro}\\s*(?:<[^>]*>)?\\s*\\(`, 'g');
    while ((match = macroRegex.exec(content)) !== null) {
      const name = macro;
      if (!functions.find(f => f.name === name)) {
        const isExported = true;
        const line = content.substring(0, match.index).split('\n').length;

        functions.push({
          name,
          line,
          isAsync: false,
          isExported,
          params: [],
          returnType: 'any',
          body: `Vue macro: ${macro}`,
        });
      }
    }
  }

  // 5. Composables
  const composableRegex = /(?:const|let)\s+(\w+)\s*=\s*(use\w+)\s*\(([^)]*)\)/g;
  while ((match = composableRegex.exec(content)) !== null) {
    const name = match[1];
    const callName = match[2];
    const args = match[3] || '';

    if (name && !functions.find(f => f.name === name)) {
      const isExported = content.includes(`export const ${name}`);
      const params = args.split(',').map(a => a.trim()).filter(a => a);

      functions.push({
        name,
        line: content.substring(0, match.index).split('\n').length,
        isAsync: false,
        isExported,
        params,
        returnType: 'any',
        body: `Composable: ${callName}(${args})`,
      });
    }
  }

  // 6. Методы в ObjectExpression (Vue Options API)
  const objectMethodRegex = /(\w+)\s*:\s*(?:async\s+)?function\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  let methodMatch;
  while ((methodMatch = objectMethodRegex.exec(content)) !== null) {
    const name = methodMatch[1];
    const paramsStr = methodMatch[2] || '';
    const body = methodMatch[3]?.trim() || '';

    if (name && !functions.find(f => f.name === name)) {
      const vueOptions = ['props', 'data', 'computed', 'watch', 'methods', 'created', 'mounted', 'updated', 'destroyed'];
      if (!vueOptions.includes(name)) {
        const isExported = content.includes(`export default`);
        const isAsync = content.includes(`async function`);

        const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);

        functions.push({
          name,
          line: content.substring(0, methodMatch.index).split('\n').length,
          isAsync,
          isExported,
          params,
          returnType: 'any',
          body: body.length > 200 ? body.substring(0, 200) + '...' : body,
        });
      }
    }
  }

  // 7. Методы классов
  const classMethodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  const classBlockRegex = /class\s+\w+\s*\{([\s\S]*?)\}/g;
  let classMatch;
  while ((classMatch = classBlockRegex.exec(content)) !== null) {
    const classBody = classMatch[1] || '';
    let methodMatchInner;
    while ((methodMatchInner = classMethodRegex.exec(classBody)) !== null) {
      const name = methodMatchInner[1];
      const paramsStr = methodMatchInner[2] || '';
      const body = methodMatchInner[3]?.trim() || '';

      if (name && name !== 'constructor' && !functions.find(f => f.name === name)) {
        const isExported = content.includes(`export class`);
        const isAsync = content.includes(`async ${name}(`);

        const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);

        functions.push({
          name,
          line: content.substring(0, classMatch.index + classMatch[0].indexOf(name)).split('\n').length,
          isAsync,
          isExported,
          params,
          returnType: 'any',
          body: body.length > 200 ? body.substring(0, 200) + '...' : body,
        });
      }
    }
  }

  // 8. ✅ Стрелочные функции с деструктуризацией параметров
  const destructureArrowRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(\s*\{([^}]*)\}\s*\)\s*=>\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = destructureArrowRegex.exec(content)) !== null) {
    const name = match[1];
    const paramsStr = match[2] || '';
    const body = match[3]?.trim() || '';

    if (name && !functions.find(f => f.name === name)) {
      const isExported = content.includes(`export const ${name}`);
      const isAsync = content.includes(`async`);

      const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);

      functions.push({
        name,
        line: content.substring(0, match.index).split('\n').length,
        isAsync,
        isExported,
        params,
        returnType: 'any',
        body: body.length > 200 ? body.substring(0, 200) + '...' : body,
      });
    }
  }

  // 9. ✅ Стрелочные функции с типизированными параметрами
  const typedArrowRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*:\s*[^{]+\s*=>\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = typedArrowRegex.exec(content)) !== null) {
    const name = match[1];
    const paramsStr = match[2] || '';
    const body = match[3]?.trim() || '';

    if (name && !functions.find(f => f.name === name)) {
      const isExported = content.includes(`export const ${name}`);
      const isAsync = content.includes(`async`);

      const params = paramsStr.split(',').map(p => p.trim()).filter(p => p);

      functions.push({
        name,
        line: content.substring(0, match.index).split('\n').length,
        isAsync,
        isExported,
        params,
        returnType: 'any',
        body: body.length > 200 ? body.substring(0, 200) + '...' : body,
      });
    }
  }

  return functions;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Проверяет, экспортируется ли узел
 */
function isNodeExported(node: any, parent: any): boolean {
  if (!node) return false;

  if (parent?.type === 'ExportNamedDeclaration') return true;
  if (parent?.type === 'ExportDefaultDeclaration') return true;

  if (node.type === 'ExportNamedDeclaration') return true;
  if (node.type === 'ExportDefaultDeclaration') return true;

  // Проверяем декораторы
  if (node.decorators) {
    for (const decorator of node.decorators) {
      if (decorator.expression?.name === 'export') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Получает имя параметра из узла
 */
function getParamName(param: any): string {
  if (!param) return '';

  if (param.type === 'Identifier') {
    return param.name || '';
  }

  if (param.type === 'AssignmentPattern' && param.left) {
    return getParamName(param.left);
  }

  if (param.type === 'RestElement' && param.argument) {
    return `...${getParamName(param.argument)}`;
  }

  if (param.type === 'ObjectPattern') {
    const props = param.properties?.map((p: any) => p.key?.name).filter(Boolean) || [];
    return `{ ${props.join(', ')} }`;
  }

  if (param.type === 'ArrayPattern') {
    const elems = param.elements?.map((e: any) => getParamName(e)).filter(Boolean) || [];
    return `[ ${elems.join(', ')} ]`;
  }

  return '';
}

/**
 * Извлекает текст тела функции
 */
function extractBodyText(body: any): string {
  if (!body) return '';

  if (body.type === 'BlockStatement') {
    const statements = body.body || [];
    if (statements.length === 0) return '{}';

    const firstStatement = statements[0];
    if (firstStatement?.type === 'ReturnStatement') {
      if (firstStatement.argument) {
        const argType = firstStatement.argument.type;
        if (argType === 'Identifier') return `return ${firstStatement.argument.name}`;
        if (argType === 'Literal') return `return ${firstStatement.argument.value}`;
        return 'return ...';
      }
      return 'return';
    }

    return `{ ${statements.length} statements }`;
  }

  if (body.type === 'Identifier') {
    return body.name;
  }

  if (body.type === 'Literal') {
    return String(body.value);
  }

  if (body.type === 'BinaryExpression') {
    return `${extractBodyText(body.left)} ${body.operator} ${extractBodyText(body.right)}`;
  }

  if (body.type === 'ArrowFunctionExpression' || body.type === 'FunctionExpression') {
    return '[Function]';
  }

  return body.type || '';
}

/**
 * Получает тип возвращаемого значения
 */
function getReturnType(node: any): string {
  if (!node) return 'any';

  // TypeScript return type annotation
  if (node.returnType?.typeAnnotation) {
    const annotation = node.returnType.typeAnnotation;
    if (annotation.type === 'TSStringKeyword') return 'string';
    if (annotation.type === 'TSNumberKeyword') return 'number';
    if (annotation.type === 'TSBooleanKeyword') return 'boolean';
    if (annotation.type === 'TSVoidKeyword') return 'void';
    if (annotation.type === 'TSAnyKeyword') return 'any';
    if (annotation.type === 'TSUnknownKeyword') return 'unknown';
    if (annotation.type === 'TSNeverKeyword') return 'never';
    if (annotation.type === 'TSNullKeyword') return 'null';
    if (annotation.type === 'TSUndefinedKeyword') return 'undefined';
    if (annotation.type === 'TSTypeReference' && annotation.typeName) {
      return annotation.typeName.name || 'any';
    }
    if (annotation.type === 'TSArrayType') {
      const elementType = getReturnType({ returnType: { typeAnnotation: annotation.elementType } });
      return `${elementType}[]`;
    }
    if (annotation.type === 'TSTypeLiteral') {
      return 'object';
    }
    return 'any';
  }

  // Вывод типа из тела функции
  if (node.body) {
    const bodyText = extractBodyText(node.body);
    if (bodyText.includes('return ')) {
      const returnMatch = bodyText.match(/return\s+([^;]+)/);
      if (returnMatch && returnMatch[1]) {
        const expr = returnMatch[1].trim();
        if (expr === 'true' || expr === 'false') return 'boolean';
        if (!isNaN(Number(expr))) return 'number';
        if (expr.startsWith("'") || expr.startsWith('"')) return 'string';
        if (expr === 'null') return 'null';
        if (expr === 'undefined') return 'undefined';
        if (expr.includes('[')) return 'array';
        if (expr.includes('{')) return 'object';
        return 'any';
      }
    }
    if (bodyText === '{}' || bodyText === '') return 'void';
  }

  return 'any';
}
