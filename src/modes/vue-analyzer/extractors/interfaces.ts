// src/modes/vue-analyzer/extractors/interfaces.ts

import type { Program } from 'estree';
import type { VueComponentAnalysis } from '../types.js';

/**
 * Проверка, является ли узел TSInterfaceDeclaration
 */
function isTSInterfaceDeclaration(node: any): node is any {
  return node && node && node.type === 'TSInterfaceDeclaration';
}

/**
 * Проверка, является ли узел TSTypeAliasDeclaration
 */
function isTSTypeAliasDeclaration(node: any): node is any {
  return node && node && node.type === 'TSTypeAliasDeclaration';
}

/**
 * Проверка, является ли узел TSTypeLiteral
 */
function isTSTypeLiteral(node: any): node is any {
  return node && node && node.type === 'TSTypeLiteral';
}

/**
 * Проверка, является ли узел TSPropertySignature
 */
function isTSPropertySignature(node: any): node is any {
  return node && node && node.type === 'TSPropertySignature';
}

/**
 * Проверка, является ли узел TSIndexSignature
 */
function isTSIndexSignature(node: any): node is any {
  return node && node && node.type === 'TSIndexSignature';
}

/**
 * Проверка, является ли узел TSMethodSignature
 */
function isTSMethodSignature(node: any): node is any {
  return node && node && node.type === 'TSMethodSignature';
}

/**
 * Проверка, является ли узел ExportNamedDeclaration
 */
function isExportNamedDeclaration(node: any): node is any {
  return node && node && node.type === 'ExportNamedDeclaration';
}

/**
 * Проверка, является ли узел Identifier
 */
function isIdentifier(node: any): node is any {
  return node && node && node.type === 'Identifier';
}

/**
 * Проверка, является ли узел TSQualifiedName
 */
function isTSQualifiedName(node: any): node is any {
  return node && node && node.type === 'TSQualifiedName';
}

/**
 * Проверка, является ли узел ExportSpecifier
 */
function isExportSpecifier(node: any): node is any {
  return node && node && node.type === 'ExportSpecifier';
}

/**
 * Проверка, является ли узел Literal
 */
function isLiteral(node: any): node is any {
  return node && node && node.type === 'Literal';
}

/**
 * Проверка, является ли узел TSExpressionWithTypeArguments
 */
function isTSExpressionWithTypeArguments(node: any): node is any {
  return node && node && node.type === 'TSExpressionWithTypeArguments';
}

/**
 * Проверка, является ли узел ExportDefaultDeclaration
 */
function isExportDefaultDeclaration(node: any): node is any {
  return node && node && node.type === 'ExportDefaultDeclaration';
}

/**
 * Безопасное получение свойства key из узла
 */
function getNodeKey(node: any): any | undefined {
  if (!node) return undefined;
  // Проверяем разные возможные имена свойства для ключа
  if (node.key !== undefined) return node.key;
  if (node.name !== undefined) return node.name;
  if (node.id !== undefined) return node.id;
  return undefined;
}

/**
 * Безопасное получение имени из узла
 */
function getNodeName(node: any): string | undefined {
  if (!node) return undefined;
  if (node.name !== undefined && typeof node.name === 'string') return node.name;
  if (node.key !== undefined) {
    if (typeof node.key === 'string') return node.key;
    if (node.key.name !== undefined) return node.key.name;
  }
  if (node.id !== undefined) {
    if (typeof node.id === 'string') return node.id;
    if (node.id.name !== undefined) return node.id.name;
  }
  return undefined;
}

/**
 * Безопасное получение родителя узла
 */
function getNodeParent(node: any): any | undefined {
  if (!node) return undefined;
  return node.parent || undefined;
}

/**
 * Извлечение интерфейсов из AST
 */
export function extractInterfacesFromAST(ast: Program): VueComponentAnalysis['interfaces'] {
  const interfaces: VueComponentAnalysis['interfaces'] = [];

  if (!ast || !ast.body) return interfaces;

  try {
    for (const node of ast.body) {
      const currentNode = node as any;

      // TSInterfaceDeclaration
      if (isTSInterfaceDeclaration(currentNode)) {
        const typedNode = currentNode as any;
        if (!typedNode.id) continue;

        const name = typedNode.id.name;
        const isExported = isNodeExported(currentNode);

        const properties: string[] = [];
        const extendsList: string[] = [];

        // Извлекаем extends
        if (typedNode.extends && Array.isArray(typedNode.extends)) {
          for (const ext of typedNode.extends) {
            const extNode = ext as any;
            if (isTSExpressionWithTypeArguments(extNode) && extNode.expression) {
              if (isIdentifier(extNode.expression)) {
                extendsList.push(extNode.expression.name);
              } else if (isTSQualifiedName(extNode.expression)) {
                let parts: string[] = [];
                let current = extNode.expression;
                while (current && isTSQualifiedName(current)) {
                  if (current.right && isIdentifier(current.right)) {
                    parts.unshift(current.right.name);
                  }
                  current = current.left;
                }
                if (current && isIdentifier(current)) {
                  parts.unshift(current.name);
                }
                extendsList.push(parts.join('.'));
              }
            }
          }
        }

        // Извлекаем свойства
        if (typedNode.body && typedNode.body.body && Array.isArray(typedNode.body.body)) {
          for (const member of typedNode.body.body) {
            const memberNode = member as any;

            if (isTSPropertySignature(memberNode)) {
              const key = getNodeKey(memberNode);
              if (key && isIdentifier(key)) {
                const propName = key.name;
                if (propName) {
                  properties.push(propName);
                }
              } else if (key && isLiteral(key)) {
                const propName = key.value;
                if (propName !== undefined) {
                  properties.push(String(propName));
                }
              }
            } else if (isTSIndexSignature(memberNode)) {
              properties.push('[index: string]');
            } else if (isTSMethodSignature(memberNode)) {
              const key = getNodeKey(memberNode);
              if (key && isIdentifier(key)) {
                properties.push(`${key.name}()`);
              }
            }
          }
        }

        interfaces.push({
          name,
          properties,
          line: currentNode.loc?.start?.line || 0,
          isExported,
          extends: extendsList.length > 0 ? extendsList : undefined,
        });
      }

      // TSTypeAliasDeclaration (интерфейсоподобные типы)
      if (isTSTypeAliasDeclaration(currentNode)) {
        const typedNode = currentNode as any;
        if (!typedNode.id) continue;

        const name = typedNode.id.name;
        const isExported = isNodeExported(currentNode);

        // Проверяем, является ли type alias объектным типом
        if (typedNode.typeAnnotation && isTSTypeLiteral(typedNode.typeAnnotation)) {
          const typeLiteral = typedNode.typeAnnotation as any;
          if (typeLiteral.members && Array.isArray(typeLiteral.members)) {
            const properties: string[] = [];
            for (const member of typeLiteral.members) {
              const memberNode = member as any;
              if (isTSPropertySignature(memberNode)) {
                const key = getNodeKey(memberNode);
                if (key && isIdentifier(key)) {
                  const propName = key.name;
                  if (propName) {
                    properties.push(propName);
                  }
                }
              } else if (isTSIndexSignature(memberNode)) {
                properties.push('[index: string]');
              }
            }

            if (properties.length > 0) {
              interfaces.push({
                name,
                properties,
                line: currentNode.loc?.start?.line || 0,
                isExported,
                extends: undefined,
              });
            }
          }
        }
      }

      // Экспортированные интерфейсы через export { Interface }
      if (isExportNamedDeclaration(currentNode)) {
        const typedNode = currentNode as any;
        if (typedNode.specifiers && Array.isArray(typedNode.specifiers)) {
          for (const spec of typedNode.specifiers) {
            const specNode = spec as any;
            if (isExportSpecifier(specNode) && specNode.exported) {
              const exportedName = getNodeName(specNode.exported);
              if (exportedName && !interfaces.find(i => i.name === exportedName)) {
                interfaces.push({
                  name: exportedName,
                  properties: [],
                  line: spec.loc?.start?.line || 0,
                  isExported: true,
                  extends: undefined,
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении интерфейсов из AST:', error);
  }

  return interfaces;
}

/**
 * Проверка, экспортируется ли узел
 */
function isNodeExported(node: any): boolean {
  if (!node) return false;

  // Прямой export
  if (isExportNamedDeclaration(node) || isExportDefaultDeclaration(node)) {
    return true;
  }

  // Проверка родителя
  let parent = getNodeParent(node);
  while (parent) {
    if (isExportNamedDeclaration(parent) || isExportDefaultDeclaration(parent)) {
      return true;
    }
    parent = getNodeParent(parent);
  }

  return false;
}

/**
 * Извлечение интерфейсов из скрипта с использованием AST
 * Основной метод - использует AST, fallback на regex
 */
export function extractInterfacesFromScript(
  content: string,
  ast?: Program | null
): VueComponentAnalysis['interfaces'] {
  // Если AST доступен, используем его
  if (ast) {
    try {
      const result = extractInterfacesFromAST(ast);
      if (result.length > 0) {
        return result;
      }
    } catch (error) {
      console.warn('⚠️ Ошибка извлечения интерфейсов из AST, используем regex:', error);
    }
  }

  // Fallback: извлечение через регулярные выражения
  return extractInterfacesFromSource(content);
}

/**
 * Извлечение интерфейсов из исходного кода (regex fallback)
 */
function extractInterfacesFromSource(content: string): VueComponentAnalysis['interfaces'] {
  const interfaces: VueComponentAnalysis['interfaces'] = [];

  if (!content || content.trim() === '') {
    return interfaces;
  }

  // ==========================================
  // 1. ОБЫЧНЫЕ ИНТЕРФЕЙСЫ: interface Name { ... }
  // ==========================================
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*(?:extends\s+([^{]+))?\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2]?.trim() || '';
    const body = match[3]?.trim() || '';

    if (name) {
      const isExported = content.includes(`export interface ${name}`);

      // Фильтруем undefined значения
      const properties: string[] = body
        .split(';')
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(line => {
          const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
          if (propMatch) return propMatch[1];
          const methodMatch = line.match(/^\s*(\w+)\s*\(/);
          if (methodMatch) return methodMatch[1] + '()';
          const indexMatch = line.match(/^\s*\[\s*\w+\s*:\s*\w+\s*\]\s*:/);
          if (indexMatch) return '[index: string]';
          return line.split(':')[0]?.trim() || '';
        })
        .filter((prop): prop is string => prop !== undefined && prop !== '');

      const extendsList = extendsStr ? extendsStr.split(',').map(e => e.trim()) : [];

      interfaces.push({
        name,
        properties,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        extends: extendsList.length > 0 ? extendsList : undefined,
      });
    }
  }

  // ==========================================
  // 2. ИНТЕРФЕЙСЫ С GENERICS: interface Name<T> { ... }
  // ==========================================
  const genericInterfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*<[^>]+>\s*(?:extends\s+([^{]+))?\s*\{([\s\S]*?)\}/g;
  while ((match = genericInterfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2]?.trim() || '';
    const body = match[3]?.trim() || '';

    if (name && !interfaces.find(i => i.name === name)) {
      const isExported = content.includes(`export interface ${name}`);

      const properties: string[] = body
        .split(';')
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(line => {
          const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
          if (propMatch) return propMatch[1];
          const methodMatch = line.match(/^\s*(\w+)\s*\(/);
          if (methodMatch) return methodMatch[1] + '()';
          return line.split(':')[0]?.trim() || '';
        })
        .filter((prop): prop is string => prop !== undefined && prop !== '');

      const extendsList = extendsStr ? extendsStr.split(',').map(e => e.trim()) : [];

      interfaces.push({
        name,
        properties,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        extends: extendsList.length > 0 ? extendsList : undefined,
      });
    }
  }

  // ==========================================
  // 3. INTERFACE С НЕСКОЛЬКИМИ EXTENDS
  // ==========================================
  const multipleExtendsRegex = /(?:export\s+)?interface\s+(\w+)\s+extends\s+([^{]+)\s*\{([\s\S]*?)\}/g;
  while ((match = multipleExtendsRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2]?.trim() || '';
    const body = match[3]?.trim() || '';

    if (name && !interfaces.find(i => i.name === name)) {
      const isExported = content.includes(`export interface ${name}`);

      const properties: string[] = body
        .split(';')
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(line => {
          const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
          if (propMatch) return propMatch[1];
          const methodMatch = line.match(/^\s*(\w+)\s*\(/);
          if (methodMatch) return methodMatch[1] + '()';
          return line.split(':')[0]?.trim() || '';
        })
        .filter((prop): prop is string => prop !== undefined && prop !== '');

      const extendsList = extendsStr.split(',').map(e => e.trim());

      interfaces.push({
        name,
        properties,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        extends: extendsList.length > 0 ? extendsList : undefined,
      });
    }
  }

  // ==========================================
  // 4. ИНТЕРФЕЙСЫ С НАСЛЕДОВАНИЕМ ОТ НЕСКОЛЬКИХ
  // ==========================================
  const complexExtendsRegex = /(?:export\s+)?interface\s+(\w+)\s+extends\s+([^\{]+)\s*\{([\s\S]*?)\}/g;
  while ((match = complexExtendsRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2]?.trim() || '';
    const body = match[3]?.trim() || '';

    if (name && !interfaces.find(i => i.name === name)) {
      const isExported = content.includes(`export interface ${name}`);

      const properties: string[] = body
        .split(';')
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(line => {
          const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
          if (propMatch) return propMatch[1];
          const methodMatch = line.match(/^\s*(\w+)\s*\(/);
          if (methodMatch) return methodMatch[1] + '()';
          return line.split(':')[0]?.trim() || '';
        })
        .filter((prop): prop is string => prop !== undefined && prop !== '');

      const extendsList = extendsStr.split(/\s*,\s*/).map(e => e.trim());

      interfaces.push({
        name,
        properties,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        extends: extendsList.length > 0 ? extendsList : undefined,
      });
    }
  }

  // ==========================================
  // 5. ИНТЕРФЕЙСЫ С GENERICS И НАСЛЕДОВАНИЕМ
  // ==========================================
  const genericExtendsRegex = /(?:export\s+)?interface\s+(\w+)\s*<[^>]+>\s+extends\s+([^\{]+)\s*\{([\s\S]*?)\}/g;
  while ((match = genericExtendsRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2]?.trim() || '';
    const body = match[3]?.trim() || '';

    if (name && !interfaces.find(i => i.name === name)) {
      const isExported = content.includes(`export interface ${name}`);

      const properties: string[] = body
        .split(';')
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(line => {
          const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
          if (propMatch) return propMatch[1];
          const methodMatch = line.match(/^\s*(\w+)\s*\(/);
          if (methodMatch) return methodMatch[1] + '()';
          return line.split(':')[0]?.trim() || '';
        })
        .filter((prop): prop is string => prop !== undefined && prop !== '');

      const extendsList = extendsStr.split(',').map(e => e.trim());

      interfaces.push({
        name,
        properties,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        extends: extendsList.length > 0 ? extendsList : undefined,
      });
    }
  }

  // ==========================================
  // 6. ИНТЕРФЕЙСЫ С ДЕКОРАТОРАМИ (Vue/TS)
  // ==========================================
  const decoratedInterfaceRegex = /(?:@\w+\s+)*(?:export\s+)?interface\s+(\w+)\s*(?:extends\s+([^{]+))?\s*\{([\s\S]*?)\}/g;
  while ((match = decoratedInterfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2]?.trim() || '';
    const body = match[3]?.trim() || '';

    if (name && !interfaces.find(i => i.name === name)) {
      const isExported = content.includes(`export interface ${name}`);

      const properties: string[] = body
        .split(';')
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(line => {
          const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
          if (propMatch) return propMatch[1];
          const methodMatch = line.match(/^\s*(\w+)\s*\(/);
          if (methodMatch) return methodMatch[1] + '()';
          return line.split(':')[0]?.trim() || '';
        })
        .filter((prop): prop is string => prop !== undefined && prop !== '');

      const extendsList = extendsStr ? extendsStr.split(',').map(e => e.trim()) : [];

      interfaces.push({
        name,
        properties,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        extends: extendsList.length > 0 ? extendsList : undefined,
      });
    }
  }

  // ==========================================
  // 7. ИНТЕРФЕЙСЫ С READONLY СВОЙСТВАМИ
  // ==========================================
  const readonlyInterfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*(?:extends\s+([^{]+))?\s*\{([\s\S]*?)\}/g;
  while ((match = readonlyInterfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2]?.trim() || '';
    const body = match[3]?.trim() || '';

    if (name && !interfaces.find(i => i.name === name)) {
      const isExported = content.includes(`export interface ${name}`);

      const properties: string[] = body
        .split(';')
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(line => {
          // Обработка readonly свойств
          const readonlyMatch = line.match(/readonly\s+(\w+)\s*(?:\?)?\s*:/);
          if (readonlyMatch) return `readonly ${readonlyMatch[1]}`;
          const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
          if (propMatch) return propMatch[1];
          const methodMatch = line.match(/^\s*(\w+)\s*\(/);
          if (methodMatch) return methodMatch[1] + '()';
          return line.split(':')[0]?.trim() || '';
        })
        .filter((prop): prop is string => prop !== undefined && prop !== '');

      const extendsList = extendsStr ? extendsStr.split(',').map(e => e.trim()) : [];

      interfaces.push({
        name,
        properties,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
        extends: extendsList.length > 0 ? extendsList : undefined,
      });
    }
  }

  return interfaces;
}