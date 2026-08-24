// src/modes/vue-analyzer/extractors/types.ts

import type { Program } from 'estree';
import type { VueComponentAnalysis } from '../types.js';

/**
 * Извлечение типов из AST
 */
export function extractTypesFromAST(ast: Program): VueComponentAnalysis['types'] {
  const types: VueComponentAnalysis['types'] = [];

  if (!ast || !ast.body) return types;

  try {
    for (const node of ast.body) {
      const nodeAny = node as any;

      // TSTypeAliasDeclaration: type Name = Definition
      // @ts-ignore - TSTypeAliasDeclaration не входит в стандартный estree
      if (nodeAny.type === 'TSTypeAliasDeclaration' && nodeAny.id) {
        const name = nodeAny.id.name;
        const isExported = isNodeExported(nodeAny);
        const definition = getTypeDefinition(nodeAny.typeAnnotation);

        types.push({
          name,
          definition,
          line: nodeAny.loc?.start?.line || 0,
          isExported,
        });
      }

      // ExportNamedDeclaration с TSTypeAliasDeclaration
      if (nodeAny.type === 'ExportNamedDeclaration' && nodeAny.declaration) {
        const declaration = nodeAny.declaration;
        // @ts-ignore - TSTypeAliasDeclaration не входит в стандартный estree
        if (declaration && declaration.type === 'TSTypeAliasDeclaration' && declaration.id) {
          const name = declaration.id.name;
          const definition = getTypeDefinition(declaration.typeAnnotation);

          types.push({
            name,
            definition,
            line: declaration.loc?.start?.line || 0,
            isExported: true,
          });
        }
      }

      // TSModuleDeclaration: declare module или namespace
      // @ts-ignore
      if (nodeAny.type === 'TSModuleDeclaration' && nodeAny.id) {
        const name = nodeAny.id.name;
        const isExported = isNodeExported(nodeAny);

        types.push({
          name: `module ${name}`,
          definition: 'namespace',
          line: nodeAny.loc?.start?.line || 0,
          isExported,
        });
      }

      // TSEnumDeclaration: enum Name { ... }
      // @ts-ignore
      if (nodeAny.type === 'TSEnumDeclaration' && nodeAny.id) {
        const name = nodeAny.id.name;
        const isExported = isNodeExported(nodeAny);

        types.push({
          name,
          definition: 'enum',
          line: nodeAny.loc?.start?.line || 0,
          isExported,
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении типов из AST:', error);
  }

  return types;
}

/**
 * Получение определения типа из узла typeAnnotation
 */
function getTypeDefinition(typeAnnotation: any): string {
  if (!typeAnnotation) return 'unknown';

  switch (typeAnnotation.type) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSVoidKeyword':
      return 'void';
    case 'TSUndefinedKeyword':
      return 'undefined';
    case 'TSNullKeyword':
      return 'null';
    case 'TSAnyKeyword':
      return 'any';
    case 'TSUnknownKeyword':
      return 'unknown';
    case 'TSNeverKeyword':
      return 'never';
    case 'TSObjectKeyword':
      return 'object';
    case 'TSBigIntKeyword':
      return 'bigint';
    case 'TSSymbolKeyword':
      return 'symbol';
    case 'TSThisType':
      return 'this';
    case 'TSArrayType': {
      const elementType = typeAnnotation.elementType;
      return `${getTypeDefinition(elementType)}[]`;
    }
    case 'TSTupleType': {
      const elements = typeAnnotation.elementTypes || [];
      return `[${elements.map((e: any) => getTypeDefinition(e)).join(', ')}]`;
    }
    case 'TSUnionType': {
      const types = typeAnnotation.types || [];
      return types.map((t: any) => getTypeDefinition(t)).join(' | ');
    }
    case 'TSIntersectionType': {
      const types = typeAnnotation.types || [];
      return types.map((t: any) => getTypeDefinition(t)).join(' & ');
    }
    case 'TSLiteralType': {
      const literal = typeAnnotation.literal;
      if (literal) {
        if (literal.type === 'Literal') {
          return String(literal.value);
        }
        if (literal.type === 'TemplateLiteral') {
          return '`${...}`';
        }
        if (literal.type === 'UnaryExpression') {
          return `${literal.operator}${literal.argument?.value || ''}`;
        }
      }
      return 'literal';
    }
    case 'TSFunctionType': {
      const params = typeAnnotation.parameters || [];
      const paramStr = params.map((p: any) => {
        const name = p.name || 'param';
        const type = p.typeAnnotation ? getTypeDefinition(p.typeAnnotation) : 'any';
        return `${name}: ${type}`;
      }).join(', ');
      const returnType = typeAnnotation.typeAnnotation ? getTypeDefinition(typeAnnotation.typeAnnotation) : 'void';
      return `(${paramStr}) => ${returnType}`;
    }
    case 'TSConstructorType': {
      const params = typeAnnotation.parameters || [];
      const paramStr = params.map((p: any) => {
        const name = p.name || 'param';
        const type = p.typeAnnotation ? getTypeDefinition(p.typeAnnotation) : 'any';
        return `${name}: ${type}`;
      }).join(', ');
      return `new (${paramStr}) => any`;
    }
    case 'TSTypeLiteral': {
      const members = typeAnnotation.members || [];
      const props = members.map((m: any) => {
        if (m.type === 'TSPropertySignature' && m.key) {
          const name = m.key.name || String(m.key.value);
          const type = m.typeAnnotation ? getTypeDefinition(m.typeAnnotation.typeAnnotation) : 'any';
          const optional = m.optional ? '?' : '';
          return `${name}${optional}: ${type}`;
        }
        if (m.type === 'TSMethodSignature' && m.key) {
          const name = m.key.name || String(m.key.value);
          const params = m.parameters || [];
          const paramStr = params.map((p: any) => {
            const pName = p.name || 'param';
            const pType = p.typeAnnotation ? getTypeDefinition(p.typeAnnotation) : 'any';
            return `${pName}: ${pType}`;
          }).join(', ');
          return `${name}(${paramStr}): any`;
        }
        return '';
      }).filter(Boolean);
      return `{ ${props.join('; ')} }`;
    }
    case 'TSTypeReference': {
      const typeName = typeAnnotation.typeName;
      if (typeName) {
        if (typeName.type === 'Identifier') {
          return typeName.name;
        }
        if (typeName.type === 'TSQualifiedName') {
          let current = typeName;
          let result = '';
          while (current.type === 'TSQualifiedName') {
            result = current.right.name + (result ? '.' + result : '');
            current = current.left;
          }
          if (current.type === 'Identifier') {
            result = current.name + (result ? '.' + result : '');
          }
          return result;
        }
      }
      return 'any';
    }
    case 'TSTypeOperator': {
      const operator = typeAnnotation.operator;
      const type = typeAnnotation.typeAnnotation ? getTypeDefinition(typeAnnotation.typeAnnotation) : 'any';
      return `${operator} ${type}`;
    }
    case 'TSIndexedAccessType': {
      const objectType = typeAnnotation.objectType ? getTypeDefinition(typeAnnotation.objectType) : 'any';
      const indexType = typeAnnotation.indexType ? getTypeDefinition(typeAnnotation.indexType) : 'string';
      return `${objectType}[${indexType}]`;
    }
    case 'TSMappedType': {
      const typeParam = typeAnnotation.typeParameter;
      const name = typeParam?.name || 'K';
      const constraint = typeParam?.constraint ? getTypeDefinition(typeParam.constraint) : 'string';
      return `{ [${name} in ${constraint}]: any }`;
    }
    case 'TSConditionalType': {
      const checkType = typeAnnotation.checkType ? getTypeDefinition(typeAnnotation.checkType) : 'any';
      const extendsType = typeAnnotation.extendsType ? getTypeDefinition(typeAnnotation.extendsType) : 'any';
      const trueType = typeAnnotation.trueType ? getTypeDefinition(typeAnnotation.trueType) : 'any';
      const falseType = typeAnnotation.falseType ? getTypeDefinition(typeAnnotation.falseType) : 'any';
      return `${checkType} extends ${extendsType} ? ${trueType} : ${falseType}`;
    }
    case 'TSInferType': {
      const typeParam = typeAnnotation.typeParameter;
      return `infer ${typeParam?.name || 'T'}`;
    }
    case 'TSImportType': {
      const argument = typeAnnotation.argument;
      const qualifier = typeAnnotation.qualifier;
      const path = argument?.value || 'module';
      const name = qualifier ? `.${qualifier.name}` : '';
      return `import(${path})${name}`;
    }
    default:
      return typeAnnotation.type || 'unknown';
  }
}

/**
 * Проверка, экспортируется ли узел
 */
function isNodeExported(node: any): boolean {
  if (!node) return false;

  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

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
 * Извлечение типов из скрипта с использованием AST
 * Основной метод - использует AST, fallback на regex
 */
export function extractTypesFromScript(
  content: string,
  ast?: Program | null
): VueComponentAnalysis['types'] {
  // Если AST доступен, используем его
  if (ast) {
    try {
      const result = extractTypesFromAST(ast);
      if (result.length > 0) {
        return result;
      }
    } catch (error) {
      console.warn('⚠️ Ошибка извлечения типов из AST, используем regex:', error);
    }
  }

  // Fallback: извлечение через регулярные выражения
  return extractTypesFromSource(content);
}

/**
 * Извлечение типов из исходного кода (regex fallback)
 */
function extractTypesFromSource(content: string): VueComponentAnalysis['types'] {
  const types: VueComponentAnalysis['types'] = [];

  if (!content || content.trim() === '') {
    return types;
  }

  // ==========================================
  // 1. TYPE ALIAS: type Name = Definition
  // ==========================================
  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*([^;]+);/g;
  let match;
  while ((match = typeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[2]?.trim() || '';

    if (name) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 2. TYPE с generic параметрами
  // ==========================================
  const genericTypeRegex = /(?:export\s+)?type\s+(\w+)\s*<[^>]*>\s*=\s*([^;]+);/g;
  while ((match = genericTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[2]?.trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 3. TYPE с extends
  // ==========================================
  const extendsTypeRegex = /(?:export\s+)?type\s+(\w+)\s*extends\s+[^=]+\s*=\s*([^;]+);/g;
  while ((match = extendsTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[2]?.trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 4. TYPE с union
  // ==========================================
  const unionTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*[^|]+\s*\|\s*[^;]+;/g;
  while ((match = unionTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 5. TYPE с intersection
  // ==========================================
  const intersectionTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*[^&]+\s*&\s*[^;]+;/g;
  while ((match = intersectionTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 6. TYPE с объектным литералом
  // ==========================================
  const objectTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*\{[^}]*\};/g;
  while ((match = objectTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 7. TYPE с массивом
  // ==========================================
  const arrayTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*[^\]]+\[\];/g;
  while ((match = arrayTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 8. TYPE с кортежем
  // ==========================================
  const tupleTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*\[[^\]]*\];/g;
  while ((match = tupleTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 9. TYPE с функцией
  // ==========================================
  const functionTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*[^;]+;/g;
  while ((match = functionTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 10. TYPE с строковым литералом
  // ==========================================
  const stringLiteralTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*['"][^'"]+['"];/g;
  while ((match = stringLiteralTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 11. TYPE с union строковых литералов
  // ==========================================
  const stringUnionTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*(?:['"][^'"]+['"]\s*\|\s*)+['"][^'"]+['"];/g;
  while ((match = stringUnionTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 12. TYPE с шаблонным литералом
  // ==========================================
  const templateLiteralTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*`[^`]*`;/g;
  while ((match = templateLiteralTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 13. TYPE с условным типом
  // ==========================================
  const conditionalTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*[^?]+\s*\?\s*[^:]+:\s*[^;]+;/g;
  while ((match = conditionalTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 14. TYPE с ключом keyof
  // ==========================================
  const keyofTypeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*keyof\s+[^;]+;/g;
  while ((match = keyofTypeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[0]?.replace(/type\s+\w+\s*=\s*/, '').trim() || '';

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export type ${name}`);
      types.push({
        name,
        definition,
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  // ==========================================
  // 15. INTERFACE: interface Name { ... }
  // ==========================================
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*(?:extends\s+[^{]+)?\s*\{([\s\S]*?)\}/g;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];

    if (name && !types.find(t => t.name === name)) {
      const isExported = content.includes(`export interface ${name}`);
      types.push({
        name,
        definition: 'interface',
        line: content.substring(0, match.index).split('\n').length,
        isExported,
      });
    }
  }

  return types;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  extractTypesFromAST,
  extractTypesFromScript,
  getTypeDefinition,
};