// src/modes/vue-analyzer/extractors/props.ts

import type { Program } from 'estree';
import type { SFCScriptBlock } from '@vue/compiler-sfc';
import type { VueComponentAnalysis } from '../types.js';
import { getNodeValue } from '../utils.js';

/**
 * Извлечение props из исходного кода (regex)
 */
export function extractPropsFromSource(content: string): VueComponentAnalysis['props'] {
  const result: VueComponentAnalysis['props'] = {
    names: [],
    types: {},
    required: {},
    defaults: {},
  };

  // 1. withDefaults(defineProps<Props>(), { ... })
  const withDefaultsMatch = content.match(
    /withDefaults\s*\(\s*defineProps\s*<\s*(\w+)\s*>\s*\(\s*\)\s*,\s*\{([\s\S]*?)\}\s*\)/
  );
  if (withDefaultsMatch) {
    const interfaceName = withDefaultsMatch[1];
    const defaultsBlock = withDefaultsMatch[2];

    if (interfaceName) {
      const interfaceMatch = content.match(
        new RegExp(`interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\}`)
      );
      if (interfaceMatch) {
        const propsContent = interfaceMatch[1];
        if (propsContent) {
          const propLines = propsContent.split('\n').filter(line => line.trim());

          for (const line of propLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;

            // optional prop: name?: type
            const optionalMatch = trimmed.match(/^\s*(\w+)\s*\?\s*:\s*(.+?)\s*;?\s*$/);
            if (optionalMatch) {
              const name = optionalMatch[1];
              const type = String(optionalMatch[2]?.trim() || 'any');
              if (name) {
                result.names.push(name);
                result.types[name] = type;
                result.required[name] = false;
              }
              continue;
            }

            // required prop: name: type
            const requiredMatch = trimmed.match(/^\s*(\w+)\s*:\s*(.+?)\s*;?\s*$/);
            if (requiredMatch) {
              const name = requiredMatch[1];
              const type = String(requiredMatch[2]?.trim() || 'any');
              if (name) {
                result.names.push(name);
                result.types[name] = type;
                result.required[name] = true;
              }
            }
          }
        }

        // Извлекаем значения по умолчанию из defaultsBlock
        if (defaultsBlock) {
          const defaultLines = defaultsBlock.split('\n').filter(line => line.trim());
          for (const line of defaultLines) {
            const match = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*,?\s*$/);
            if (match) {
              const name = match[1];
              const rawValue = match[2]?.trim() || 'undefined';
              if (name) {
                if (rawValue === 'true') result.defaults[name] = true;
                else if (rawValue === 'false') result.defaults[name] = false;
                else if (!isNaN(Number(rawValue))) result.defaults[name] = Number(rawValue);
                else if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
                  result.defaults[name] = rawValue.slice(1, -1);
                } else {
                  result.defaults[name] = rawValue;
                }
              }
            }
          }
        }
        return result;
      }
    }
  }

  // 2. defineProps<{ ... }>()
  const tsPropsMatch = content.match(/defineProps\s*<\s*\{\s*([\s\S]*?)\s*\}\s*>/);
  if (tsPropsMatch) {
    const propsContent = tsPropsMatch[1];
    if (propsContent) {
      const propLines = propsContent.split('\n').filter(line => line.trim());

      for (const line of propLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;

        const optionalMatch = trimmed.match(/^\s*(\w+)\s*\?\s*:\s*(.+?)\s*;?\s*$/);
        if (optionalMatch) {
          const name = optionalMatch[1];
          const type = String(optionalMatch[2]?.trim() || 'any');
          if (name) {
            result.names.push(name);
            result.types[name] = type;
            result.required[name] = false;
          }
          continue;
        }

        const requiredMatch = trimmed.match(/^\s*(\w+)\s*:\s*(.+?)\s*;?\s*$/);
        if (requiredMatch) {
          const name = requiredMatch[1];
          const type = String(requiredMatch[2]?.trim() || 'any');
          if (name) {
            result.names.push(name);
            result.types[name] = type;
            result.required[name] = true;
          }
        }
      }
      return result;
    }
  }

  // 3. defineProps({ ... })
  const objPropsMatch = content.match(/defineProps\s*\(\s*\{\s*([\s\S]*?)\s*\}\s*\)/);
  if (objPropsMatch) {
    const propsContent = objPropsMatch[1];
    if (propsContent) {
      const lines = propsContent.split('\n');
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        if (!line) {
          i++;
          continue;
        }

        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) {
          i++;
          continue;
        }

        const propMatch = trimmed.match(/^(\w+)\s*:/);
        if (propMatch) {
          const name = propMatch[1];
          if (!name) {
            i++;
            continue;
          }

          const afterColon = trimmed.substring(propMatch[0].length).trim();

          // Сокращенная запись: propName: Type
          if (afterColon && !afterColon.startsWith('{')) {
            const typeMatch = afterColon.match(/^(\w+)/);
            const type = String(typeMatch ? typeMatch[1] : 'any');
            result.names.push(name);
            result.types[name] = type;
            result.required[name] = false;
            result.defaults[name] = undefined;
            i++;
            continue;
          }

          // Полная запись: propName: { ... }
          if (afterColon && afterColon.startsWith('{')) {
            let propBody = '';
            let braceDepth = 0;
            let j = i;

            while (j < lines.length) {
              const currentLineText = lines[j];
              if (!currentLineText) {
                j++;
                continue;
              }

              const openBraces = (currentLineText.match(/{/g) || []).length;
              const closeBraces = (currentLineText.match(/}/g) || []).length;
              braceDepth += openBraces - closeBraces;

              propBody += currentLineText + '\n';
              j++;

              if (braceDepth === 0) break;
            }

            if (propBody) {
              // required
              const requiredMatch = propBody.match(/required\s*:\s*(true|false)/);
              if (requiredMatch) {
                result.required[name] = requiredMatch[1] === 'true';
              } else {
                result.required[name] = false;
              }

              // default
              const defaultMatch = propBody.match(/default\s*:\s*(.+?)(?:,|\n|$)/);
              if (defaultMatch && defaultMatch[1]) {
                const defaultValue = defaultMatch[1].trim();
                if (!isNaN(Number(defaultValue))) {
                  result.defaults[name] = Number(defaultValue);
                } else if (defaultValue === 'true' || defaultValue === 'false') {
                  result.defaults[name] = defaultValue === 'true';
                } else if (defaultValue.startsWith("'") || defaultValue.startsWith('"')) {
                  result.defaults[name] = defaultValue.slice(1, -1);
                } else {
                  result.defaults[name] = defaultValue;
                }
              }

              // type
              const typeMatch = propBody.match(/type\s*:\s*(\w+)/);
              const type = String(typeMatch ? typeMatch[1] : 'any');

              result.names.push(name);
              result.types[name] = type;
              i = j;
              continue;
            }
          }
        }
        i++;
      }
      return result;
    }
  }

  return result;
}

/**
 * Извлечение props из скомпилированного script
 */
export function extractPropsFromCompiledScript(
  compiledScript: SFCScriptBlock | null
): VueComponentAnalysis['props'] {
  const result: VueComponentAnalysis['props'] = {
    names: [],
    types: {},
    required: {},
    defaults: {},
  };

  if (!compiledScript) return result;

  const props = (compiledScript as any).props;
  if (!props) return result;

  if (Array.isArray(props)) {
    for (const name of props) {
      if (typeof name === 'string') {
        result.names.push(name);
        result.types[name] = 'any';
        result.required[name] = false;
      }
    }
    return result;
  }

  if (typeof props === 'object') {
    for (const [name, propData] of Object.entries(props)) {
      result.names.push(name);

      let type = 'any';
      if (propData && typeof propData === 'object') {
        const propDataObj = propData as any;
        if (propDataObj.type) {
          if (typeof propDataObj.type === 'string') {
            type = propDataObj.type;
          } else if (propDataObj.type.name) {
            type = propDataObj.type.name;
          } else if (Array.isArray(propDataObj.type)) {
            type = propDataObj.type.map((t: any) => t?.name || 'any').join(' | ');
          }
        }

        result.required[name] = propDataObj.required === true;

        if (propDataObj.default !== undefined && propDataObj.default !== null) {
          if (typeof propDataObj.default === 'function') {
            try {
              result.defaults[name] = propDataObj.default();
            } catch {
              result.defaults[name] = propDataObj.default;
            }
          } else {
            result.defaults[name] = propDataObj.default;
          }
        }
      }

      result.types[name] = type;
    }
  }

  return result;
}

/**
 * Извлечение props из AST (fallback)
 */
export function extractPropsFromAST(ast: Program): VueComponentAnalysis['props'] {
  const result: VueComponentAnalysis['props'] = {
    names: [],
    types: {},
    required: {},
    defaults: {},
  };

  if (!ast || !ast.body) return result;

  try {
    const interfaces = new Map<string, { members: any[] }>();
    const typeAliases = new Map<string, any>();

    const collectTypes = (node: any) => {
      if (!node) return;

      if (node.type === 'TSInterfaceDeclaration' && node.id) {
        const name = node.id.name;
        if (name) {
          interfaces.set(name, { members: node.body?.body || [] });
        }
      }

      if (node.type === 'TSTypeAliasDeclaration' && node.id) {
        const name = node.id.name;
        if (name) {
          typeAliases.set(name, node.typeAnnotation);
        }
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          collectTypes(child);
        }
      }
    };

    for (const node of ast.body) {
      collectTypes(node);
    }

    const extractPropsFromTypeNode = (
      typeNode: any
    ): { names: string[]; types: Record<string, string>; required: Record<string, boolean> } => {
      const extracted = {
        names: [] as string[],
        types: {} as Record<string, string>,
        required: {} as Record<string, boolean>,
      };

      if (!typeNode) return extracted;

      let members: any[] = [];

      if (typeNode.type === 'TSTypeLiteral' && typeNode.members) {
        members = typeNode.members;
      } else if (typeNode.type === 'TSTypeReference' && typeNode.typeName) {
        let typeName = '';
        if (typeNode.typeName.type === 'Identifier') {
          typeName = typeNode.typeName.name;
        } else if (typeNode.typeName.type === 'TSQualifiedName') {
          let current = typeNode.typeName;
          while (current.type === 'TSQualifiedName') {
            typeName = current.right.name + (typeName ? '.' + typeName : '');
            current = current.left;
          }
          if (current.type === 'Identifier') {
            typeName = current.name + (typeName ? '.' + typeName : '');
          }
        }

        if (interfaces.has(typeName)) {
          const intf = interfaces.get(typeName);
          if (intf) {
            members = intf.members;
          }
        } else if (typeAliases.has(typeName)) {
          const alias = typeAliases.get(typeName);
          if (alias && alias.type === 'TSTypeLiteral' && alias.members) {
            members = alias.members;
          }
        }
      }

      for (const member of members) {
        if (member.type === 'TSPropertySignature' && member.key?.type === 'Identifier') {
          const name = member.key.name;
          if (name) {
            extracted.names.push(name);
            if (member.typeAnnotation?.typeAnnotation) {
              const typeNode = member.typeAnnotation.typeAnnotation;
              if (typeNode.type === 'TSStringKeyword') {
                extracted.types[name] = 'string';
              } else if (typeNode.type === 'TSNumberKeyword') {
                extracted.types[name] = 'number';
              } else if (typeNode.type === 'TSBooleanKeyword') {
                extracted.types[name] = 'boolean';
              } else if (typeNode.type === 'TSArrayType') {
                extracted.types[name] = 'array';
              } else if (typeNode.type === 'TSTypeReference' && typeNode.typeName) {
                extracted.types[name] = typeNode.typeName.name || 'any';
              } else {
                extracted.types[name] = 'any';
              }
            } else {
              extracted.types[name] = 'any';
            }
            extracted.required[name] = !member.optional;
          }
        } else if (member.type === 'Property' && member.key?.type === 'Identifier') {
          const name = member.key.name;
          if (name) {
            extracted.names.push(name);
            extracted.types[name] = 'any';
            extracted.required[name] = !member.optional;
          }
        }
      }

      return extracted;
    };

    const findDefineProps = (node: any): any => {
      if (!node) return null;

      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'defineProps'
      ) {
        return node;
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          const result = findDefineProps(child);
          if (result) return result;
        }
      }

      return null;
    };

    const findWithDefaults = (node: any): any => {
      if (!node) return null;

      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'withDefaults'
      ) {
        return node;
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          const result = findWithDefaults(child);
          if (result) return result;
        }
      }

      return null;
    };

    // Ищем withDefaults
    for (const node of ast.body) {
      const withDefaultsCall = findWithDefaults(node);
      if (withDefaultsCall) {
        const args = withDefaultsCall.arguments;
        if (args && args.length >= 1 && args[0]?.type === 'CallExpression') {
          const definePropsCall = args[0];
          if (
            definePropsCall.callee?.type === 'Identifier' &&
            definePropsCall.callee.name === 'defineProps'
          ) {
            const typeParams = definePropsCall.typeParameters;
            let typeNode = null;

            if (typeParams && typeParams.params && typeParams.params.length > 0) {
              typeNode = typeParams.params[0];
            } else if (definePropsCall.arguments && definePropsCall.arguments.length > 0) {
              const firstArg = definePropsCall.arguments[0];
              if (firstArg.type === 'TSTypeReference' || firstArg.type === 'TSTypeLiteral') {
                typeNode = firstArg;
              }
            }

            if (typeNode) {
              const extractedProps = extractPropsFromTypeNode(typeNode);
              result.names = extractedProps.names;
              result.types = extractedProps.types;
              result.required = extractedProps.required;
            }

            // Извлекаем значения по умолчанию из второго аргумента withDefaults
            if (args.length >= 2 && args[1]?.type === 'ObjectExpression') {
              for (const prop of args[1].properties) {
                if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
                  const name = prop.key.name;
                  if (name && prop.value) {
                    result.defaults[name] = getNodeValue(prop.value);
                  }
                }
              }
            }

            return result;
          }
        }
      }

      // Fallback: ищем обычный defineProps
      const definePropsCall = findDefineProps(node);
      if (definePropsCall) {
        const args = definePropsCall.arguments;
        const typeParams = definePropsCall.typeParameters;

        if (typeParams && typeParams.params && typeParams.params.length > 0) {
          const typeNode = typeParams.params[0];
          const extracted = extractPropsFromTypeNode(typeNode);
          result.names = extracted.names;
          result.types = extracted.types;
          result.required = extracted.required;
          return result;
        }

        if (args && args.length === 1 && args[0]) {
          const firstArg = args[0];
          if (firstArg.type === 'TSTypeReference' || firstArg.type === 'TSTypeLiteral') {
            const extracted = extractPropsFromTypeNode(firstArg);
            result.names = extracted.names;
            result.types = extracted.types;
            result.required = extracted.required;
            return result;
          }
        }

        if (args && args.length === 1 && args[0]?.type === 'ObjectExpression') {
          for (const prop of args[0].properties) {
            if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
              const name = prop.key.name;
              if (name) {
                result.names.push(name);
                result.types[name] = 'any';
                result.required[name] = false;

                if (prop.value?.type === 'ObjectExpression') {
                  for (const valProp of prop.value.properties) {
                    if (valProp.type === 'Property' && valProp.key?.type === 'Identifier') {
                      if (valProp.key.name === 'required') {
                        result.required[name] = getNodeValue(valProp.value) === true;
                      }
                      if (valProp.key.name === 'default') {
                        result.defaults[name] = getNodeValue(valProp.value);
                      }
                      if (valProp.key.name === 'type' && valProp.value?.type === 'Identifier') {
                        result.types[name] = valProp.value.name || 'any';
                      }
                    }
                  }
                }
              }
            }
          }
          return result;
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении props из AST:', error);
  }

  return result;
}