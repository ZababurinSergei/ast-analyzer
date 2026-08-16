// ast-analyzer/src/modes/vue-analyzer.ts

import fs from 'fs';
import path from 'path';
import { parse, compileScript } from '@vue/compiler-sfc';
import { parse as parseTS } from '@typescript-eslint/parser';
import type { Program } from 'estree';
import type { SFCDescriptor, SFCScriptBlock } from '@vue/compiler-sfc';

export interface VueComponentAnalysis {
  componentName: string;
  filePath: string;

  script: {
    content: string;
    ast: Program | null;
    isSetup: boolean;
    isTS: boolean;
    size: number;
  };

  template: {
    content: string | null;
    ast: any | null;
    complexity: number;
    rootElements: string[];
    slots: string[];
    directives: string[];
    events: string[];
  };

  props: {
    names: string[];
    types: Record<string, string>;
    required: Record<string, boolean>;
    defaults: Record<string, any>;
  };

  emits: {
    names: string[];
    types: Record<string, string>;
  };

  expose: string[];
  slots: string[];

  imports: {
    source: string;
    specifiers: string[];
    isTypeOnly: boolean;
  }[];

  composables: {
    name: string;
    source: string;
    args: string[];
  }[];

  stats: {
    scriptLines: number;
    templateLines: number;
    styleCount: number;
    totalSize: number;
  };
}

export interface AnalysisOptions {
  includeTemplateAST?: boolean;
  includeScriptAST?: boolean;
  extractComposableCalls?: boolean;
  maxDepth?: number;
}

/**
 * Парсит Vue файл с использованием @vue/compiler-sfc
 */
export function parseVueFile(filePath: string): {
  descriptor: SFCDescriptor;
  errors: Error[];
} | null {
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    const { descriptor, errors } = parse(source, {
      filename: filePath,
      sourceMap: false,
    });

    if (errors.length > 0) {
      console.warn(`⚠️ Ошибки при парсинге ${filePath}:`, errors);
    }

    return { descriptor, errors };
  } catch (error) {
    console.error(`❌ Ошибка парсинга Vue файла ${filePath}:`, error);
    return null;
  }
}

/**
 * Компилирует script блок с поддержкой TypeScript
 */
function compileScriptBlock(descriptor: SFCDescriptor, filePath: string): SFCScriptBlock | null {
  try {
    if (!descriptor.script && !descriptor.scriptSetup) {
      return null;
    }

    const script = compileScript(descriptor, {
      id: filePath,
      isProd: false,
      fs: {
        fileExists: (file: string) => fs.existsSync(file),
        readFile: (file: string) => {
          try {
            return fs.readFileSync(file, 'utf-8');
          } catch {
            return undefined;
          }
        },
      },
      babelParserPlugins: ['typescript', 'jsx'],
    });

    return script;
  } catch (error) {
    console.warn(`⚠️ Ошибка компиляции script в ${filePath}:`, error);
    return null;
  }
}

/**
 * ✅ Извлекает props из исходного кода с помощью регулярных выражений
 * (С явным приведением типов для TypeScript)
 * ДОБАВЛЕНА ПОДДЕРЖКА withDefaults
 */
function extractPropsFromSource(content: string): VueComponentAnalysis['props'] {
  const result: VueComponentAnalysis['props'] = {
    names: [],
    types: {},
    required: {},
    defaults: {},
  };

  // ============================================
  // 1. ПОДДЕРЖКА withDefaults(defineProps<Props>(), { ... })
  // ============================================
  const withDefaultsMatch = content.match(
    /withDefaults\s*\(\s*defineProps\s*<\s*(\w+)\s*>\s*\(\s*\)\s*,\s*\{([\s\S]*?)\}\s*\)/
  );
  if (withDefaultsMatch) {
    const interfaceName = withDefaultsMatch[1];
    const defaultsBlock = withDefaultsMatch[2];

    // Ищем интерфейс
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

  // ============================================
  // 2. defineProps<{ ... }>()
  // ============================================
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

  // ============================================
  // 3. defineProps({ ... })
  // ============================================
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
 * ✅ Извлекает emits из исходного кода
 * ИСПРАВЛЕНО: корректное экранирование скобок в регулярных выражениях
 */
function extractEmitsFromSource(content: string): VueComponentAnalysis['emits'] {
  const result: VueComponentAnalysis['emits'] = {
    names: [],
    types: {},
  };

  // Ищем defineEmits с массивом: defineEmits(['update', 'delete'])
  const arrayMatch = content.match(/defineEmits\s*\(\s*\[([\s\S]*?)\]\s*\)/);
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

  // Ищем defineEmits с TypeScript типом: defineEmits<{ update: [value: number] }>()
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
 * Извлекает props из скомпилированного script блока
 */
function extractPropsFromCompiledScript(
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
 * Извлекает emits из скомпилированного script блока
 */
function extractEmitsFromCompiledScript(
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
 * Извлекает expose из скомпилированного script блока
 */
function extractExposeFromCompiledScript(compiledScript: SFCScriptBlock | null): string[] {
  if (!compiledScript) return [];
  const expose = (compiledScript as any).expose;
  if (!expose) return [];
  if (Array.isArray(expose)) {
    return expose.map((e: any) => (typeof e === 'string' ? e : String(e)));
  }
  return [];
}

/**
 * Безопасно извлекает значение из узла AST
 */
function getNodeValue(node: any): any {
  if (!node) return undefined;

  if (node.type === 'Literal') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'StringLiteral') {
    return node.value;
  }
  if (node.type === 'NumericLiteral') {
    return node.value;
  }
  if (node.type === 'BooleanLiteral') {
    return node.value;
  }
  if (node.type === 'NullLiteral') {
    return null;
  }
  if (node.type === 'RegExpLiteral') {
    return node.value;
  }
  if (node.type === 'BigIntLiteral') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral') {
    return node.quasis?.map((q: any) => q.value?.raw || '').join('');
  }

  if (node.type === 'UnaryExpression' && node.operator === '-') {
    const arg = getNodeValue(node.argument);
    if (typeof arg === 'number') return -arg;
    return undefined;
  }

  if (node.type === 'ObjectExpression') {
    const result: Record<string, any> = {};
    if (node.properties) {
      for (const prop of node.properties) {
        if (prop.type === 'Property' && prop.key) {
          const key = prop.key.name || prop.key.value;
          if (key !== undefined) {
            result[key] = getNodeValue(prop.value);
          }
        }
      }
    }
    return result;
  }

  if (node.type === 'ArrayExpression') {
    const result: any[] = [];
    if (node.elements) {
      for (const elem of node.elements) {
        result.push(getNodeValue(elem));
      }
    }
    return result;
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return 'function';
  }

  return undefined;
}

/**
 * Извлекает props из AST напрямую (fallback)
 * ДОБАВЛЕНА ПОДДЕРЖКА withDefaults
 */
function extractPropsFromAST(ast: Program): VueComponentAnalysis['props'] {
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

    // Собираем интерфейсы и type aliases
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

    // Извлекает props из type node
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

    // Находит defineProps или withDefaults
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

/**
 * Извлекает emits из AST (fallback)
 */
function extractEmitsFromAST(ast: Program): VueComponentAnalysis['emits'] {
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

/**
 * Извлекает expose из AST (fallback)
 */
function extractExposeFromAST(ast: Program): string[] {
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

/**
 * Анализирует template
 * ✅ ИСПРАВЛЕНО: корректное извлечение директив и событий из AST @vue/compiler-sfc
 * ✅ ДОБАВЛЕНО: обработка сокращенных событий (@mouseover)
 */
function analyzeTemplate(
    descriptor: SFCDescriptor,
    options: AnalysisOptions
): VueComponentAnalysis['template'] {
  const result: VueComponentAnalysis['template'] = {
    content: null,
    ast: null,
    complexity: 0,
    rootElements: [],
    slots: [],
    directives: [],
    events: [],
  };

  if (!descriptor.template) return result;

  result.content = descriptor.template.content;

  if (options.includeTemplateAST && descriptor.template.ast) {
    result.ast = descriptor.template.ast;

    /**
     * Рекурсивно обходит AST Vue и извлекает информацию
     * @param node - узел AST из @vue/compiler-sfc
     * @param parent - родительский узел
     */
    function traverseVueAST(node: any, parent?: any) {
      if (!node) return;

      // Увеличиваем счетчик сложности для каждого узла
      result.complexity++;

      // Определяем тип узла
      // В @vue/compiler-sfc: NodeTypes.ELEMENT = 1, NodeTypes.ROOT = 0, NodeTypes.IF = 3, NodeTypes.FOR = 11
      const isElement = node.type === 1;
      const isRoot = node.type === 0;
      const isIf = node.type === 3;
      const isFor = node.type === 11;
      const isText = node.type === 2;

      // Для корневого узла - обходим детей
      if (isRoot && node.children) {
        node.children.forEach((child: any) => traverseVueAST(child, node));
        return;
      }

      // Для текстовых узлов - пропускаем
      if (isText) {
        return;
      }

      // Для элементов (тегов)
      if (isElement && node.tag) {
        // Добавляем корневые элементы
        if (!parent || (parent && parent.type === 0)) {
          result.rootElements.push(node.tag);
        }

        // Обработка слотов
        if (node.tag === 'slot') {
          let slotName = 'default';
          // Ищем атрибут name у слота
          if (node.props) {
            for (const prop of node.props) {
              if (prop.type === 6) { // AttributeNode
                if (prop.name === 'name' && prop.value) {
                  slotName = prop.value.content;
                }
              }
            }
          }
          result.slots.push(slotName);
        }

        // ✅ ИЗВЛЕЧЕНИЕ ДИРЕКТИВ И СОБЫТИЙ ИЗ PROP NODES
        if (node.props) {
          for (const prop of node.props) {
            // prop.type === 6 - обычный атрибут (AttributeNode)
            // prop.type === 7 - директива (DirectiveNode)
            // prop.type === 5 - выражение (ExpressionNode)

            if (prop.type === 7) {
              // Это директива (v-*)
              const rawName = prop.rawName || prop.name;
              const fullName = prop.rawName || '';

              // Извлекаем имя директивы (v-if, v-for, v-on, v-model)
              if (fullName) {
                // Для v-on:click -> v-on
                const directiveName = fullName.split(':')[0];
                if (directiveName && !result.directives.includes(directiveName)) {
                  result.directives.push(directiveName);
                }

                // Если директива v-on, добавляем событие
                if (directiveName === 'v-on' && prop.arg) {
                  const eventName = typeof prop.arg === 'string'
                      ? prop.arg
                      : prop.arg?.content || '';
                  if (eventName && !result.events.includes(eventName)) {
                    result.events.push(eventName);
                  }
                }

                // ✅ ОБРАБОТКА СОКРАЩЕННЫХ СОБЫТИЙ (@click, @mouseover)
                // Для директив, начинающихся с @
                if (fullName.startsWith('@')) {
                  const eventName = fullName.slice(1);
                  if (eventName && !result.events.includes(eventName)) {
                    result.events.push(eventName);
                  }
                }
              }
            } else if (prop.type === 6) {
              // Обычный атрибут
              const attrName = prop.name;

              // ✅ Проверяем сокращенную запись событий (@click, @mouseover)
              if (attrName && attrName.startsWith('@')) {
                const eventName = attrName.slice(1);
                if (eventName && !result.events.includes(eventName)) {
                  result.events.push(eventName);
                }
              }

              // Проверяем обработчики событий (onClick, onMouseover)
              if (attrName && attrName.startsWith('on') && attrName !== 'on') {
                const eventName = attrName.slice(2);
                if (eventName && !result.events.includes(eventName)) {
                  result.events.push(eventName);
                }
              }

              // Проверяем атрибуты, начинающиеся с : (v-bind сокращение)
              if (attrName && attrName.startsWith(':')) {
                // Это динамическая привязка - пропускаем для директив
              }
            }
          }
        }
      }

      // Обработка директив v-if (условные блоки)
      if (isIf) {
        // Добавляем директиву v-if
        if (!result.directives.includes('v-if')) {
          result.directives.push('v-if');
        }
        // Обрабатываем детей
        if (node.children) {
          node.children.forEach((child: any) => traverseVueAST(child, node));
        }
      }

      // Обработка директив v-for (циклы)
      if (isFor) {
        // Добавляем директиву v-for
        if (!result.directives.includes('v-for')) {
          result.directives.push('v-for');
        }
        // Обрабатываем детей
        if (node.children) {
          node.children.forEach((child: any) => traverseVueAST(child, node));
        }
      }

      // Рекурсивный обход детей для всех узлов
      if (node.children) {
        node.children.forEach((child: any) => traverseVueAST(child, node));
      }
    }

    traverseVueAST(descriptor.template.ast);

    // Удаляем дубликаты
    result.rootElements = [...new Set(result.rootElements)];
    result.slots = [...new Set(result.slots)];
    result.directives = [...new Set(result.directives)];
    result.events = [...new Set(result.events)];
  }

  return result;
}

/**
 * Анализирует импорты через AST
 */
function extractImportsFromAST(ast: Program): VueComponentAnalysis['imports'] {
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
 * Анализирует вызовы composables через AST
 */
function extractComposablesFromAST(ast: Program): VueComponentAnalysis['composables'] {
  const composables: VueComponentAnalysis['composables'] = [];

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

            if (name && name.startsWith('use') && decl.id && decl.id.type === 'Identifier') {
              const source = decl.id.name;
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

      if (node.type === 'VariableDeclarator') {
        const init = node.init;
        if (init && init.type === 'CallExpression') {
          const callee = init.callee;
          let name: string | null = null;

          if (callee.type === 'Identifier') {
            name = callee.name;
          } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
            name = callee.property.name;
          }

          if (
            name &&
            (name.startsWith('use') || ['ref', 'computed', 'watch', 'reactive'].includes(name))
          ) {
            const source = node.id?.type === 'Identifier' ? node.id.name : 'unknown';
            const args = init.arguments.map((arg: any) => {
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

      if (node.type === 'ObjectPattern') {
        for (const prop of node.properties) {
          if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
            const name = prop.key.name;
            if (
              name &&
              (name.startsWith('use') || ['ref', 'computed', 'watch', 'reactive'].includes(name))
            ) {
              const source = prop.value?.type === 'Identifier' ? prop.value.name : 'unknown';
              const exists = composables.some(c => c.name === name && c.source === source);
              if (!exists) {
                composables.push({ name, source, args: [] });
              }
            }
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === 'object') {
        visitNode(child);
      }
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
 * Главная функция анализа Vue компонента
 */
export function analyzeVueComponent(
  filePath: string,
  options: AnalysisOptions = {}
): VueComponentAnalysis | null {
  if (!filePath.endsWith('.vue')) {
    console.error('❌ Файл не является Vue компонентом');
    return null;
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Файл не найден: ${filePath}`);
    return null;
  }

  let fileExists = false;
  let fileContent = '';
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
    fileExists = true;
  } catch (error) {
    console.error(`❌ Ошибка чтения файла ${filePath}:`, error);
    return null;
  }

  const parsed = parseVueFile(filePath);
  if (!parsed) {
    return null;
  }

  const { descriptor } = parsed;

  const compiledScript = compileScriptBlock(descriptor, filePath);
  const templateAnalysis = analyzeTemplate(descriptor, options);

  const originalScriptContent = descriptor.scriptSetup?.content || descriptor.script?.content || '';
  const isSetup = !!descriptor.scriptSetup;
  const isTS = !!(descriptor.scriptSetup?.lang === 'ts' || descriptor.script?.lang === 'ts');

  // ✅ ПЫТАЕМСЯ ИЗВЛЕЧЬ PROPS ИЗ СКОМПИЛИРОВАННОГО СКРИПТА
  let props = extractPropsFromCompiledScript(compiledScript);
  let emits = extractEmitsFromCompiledScript(compiledScript);
  let expose = extractExposeFromCompiledScript(compiledScript);

  // ✅ ЕСЛИ НЕ ПОЛУЧИЛОСЬ - ИСПОЛЬЗУЕМ AST (ЕСЛИ ДОСТУПЕН)
  let scriptAst: Program | null = null;
  if (originalScriptContent) {
    try {
      scriptAst = parseTS(originalScriptContent, {
        ecmaVersion: 2022,
        sourceType: 'module',
        loc: true,
        range: true,
        ecmaFeatures: {
          jsx: true,
        },
      }) as Program;
    } catch (error) {
      // Игнорируем ошибки парсинга
    }
  }

  if (props.names.length === 0 && scriptAst) {
    const astProps = extractPropsFromAST(scriptAst);
    if (astProps.names.length > 0) {
      props = astProps;
    }
  }

  // ✅ ЕСЛИ ВСЕ ЕЩЕ НЕТ - ИСПОЛЬЗУЕМ РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ (FALLBACK)
  if (props.names.length === 0) {
    props = extractPropsFromSource(originalScriptContent);
  }

  // ✅ ТО ЖЕ САМОЕ ДЛЯ EMITS
  if (emits.names.length === 0 && scriptAst) {
    const astEmits = extractEmitsFromAST(scriptAst);
    if (astEmits.names.length > 0) {
      emits = astEmits;
    }
  }

  if (emits.names.length === 0) {
    emits = extractEmitsFromSource(originalScriptContent);
  }

  // ✅ ТО ЖЕ САМОЕ ДЛЯ EXPOSE
  if (expose.length === 0 && scriptAst) {
    const astExpose = extractExposeFromAST(scriptAst);
    if (astExpose.length > 0) {
      expose = astExpose;
    }
  }

  const imports = scriptAst ? extractImportsFromAST(scriptAst) : [];
  const composables = scriptAst ? extractComposablesFromAST(scriptAst) : [];

  const allSlots = [
    ...new Set([...templateAnalysis.slots, ...((compiledScript as any)?.slots || [])]),
  ];

  let totalSize = 0;
  if (fileExists) {
    try {
      totalSize = fs.statSync(filePath).size;
    } catch {
      totalSize = fileContent.length;
    }
  } else {
    const source = descriptor.scriptSetup?.content || descriptor.script?.content || '';
    totalSize = source.length + (descriptor.template?.content?.length || 0);
  }

  const analysis: VueComponentAnalysis = {
    componentName: path.basename(filePath, '.vue'),
    filePath,

    script: {
      content: originalScriptContent,
      ast: scriptAst,
      isSetup,
      isTS,
      size: originalScriptContent.length,
    },

    template: templateAnalysis,

    props,
    emits,
    expose,
    slots: allSlots,

    imports,
    composables,

    stats: {
      scriptLines: originalScriptContent.split('\n').length,
      templateLines: descriptor.template?.content.split('\n').length || 0,
      styleCount: descriptor.styles.length,
      totalSize,
    },
  };

  return analysis;
}

/**
 * Генерирует Markdown отчет для Vue компонента
 */
export function generateVueComponentReport(analysis: VueComponentAnalysis): string {
  let report = `# 🎯 Анализ Vue компонента: ${analysis.componentName}\n\n`;

  report += '## 📊 Статистика\n';
  report += `- **Размер файла:** ${(analysis.stats.totalSize / 1024).toFixed(2)} KB\n`;
  report += `- **Скрипт:** ${analysis.stats.scriptLines} строк (${analysis.script.isSetup ? 'setup' : 'options API'})\n`;
  report += `- **Шаблон:** ${analysis.stats.templateLines} строк\n`;
  report += `- **Стили:** ${analysis.stats.styleCount} блоков\n`;
  report += `- **TypeScript:** ${analysis.script.isTS ? '✅' : '❌'}\n\n`;

  if (analysis.props.names.length > 0) {
    report += `## 📥 Props (${analysis.props.names.length})\n\n`;
    report += '| Имя | Тип | Обязательный | По умолчанию |\n';
    report += '|-----|-----|--------------|--------------|\n';
    for (const name of analysis.props.names) {
      const type = analysis.props.types[name] || 'any';
      const required = analysis.props.required[name] ? '✅' : '❌';
      const defaultValue =
        analysis.props.defaults[name] !== undefined ? String(analysis.props.defaults[name]) : '-';
      report += `| \`${name}\` | \`${type}\` | ${required} | ${defaultValue} |\n`;
    }
    report += '\n';
  }

  if (analysis.emits.names.length > 0) {
    report += `## 📤 Events (${analysis.emits.names.length})\n\n`;
    for (const name of analysis.emits.names) {
      const typeInfo = analysis.emits.types[name] ? `: \`${analysis.emits.types[name]}\`` : '';
      report += `- **${name}**${typeInfo}\n`;
    }
    report += '\n';
  }

  if (analysis.expose.length > 0) {
    report += '## 🔓 Exposed API\n\n';
    for (const name of analysis.expose) {
      report += `- \`${name}\`\n`;
    }
    report += '\n';
  }

  if (analysis.slots.length > 0) {
    report += `## 🎭 Slots (${analysis.slots.length})\n\n`;
    for (const slot of analysis.slots) {
      report += `- \`${slot}\`\n`;
    }
    report += '\n';
  }

  if (analysis.composables.length > 0) {
    report += `## 🧩 Composables (${analysis.composables.length})\n\n`;
    for (const comp of analysis.composables) {
      report += `- \`${comp.name}\` → переменная \`${comp.source}\`\n`;
      if (comp.args.length > 0) {
        report += `  - Аргументы: ${comp.args.join(', ')}\n`;
      }
    }
    report += '\n';
  }

  if (analysis.imports.length > 0) {
    report += `## 📦 Импорты (${analysis.imports.length})\n\n`;
    const externalImports = analysis.imports.filter(i => !i.source.startsWith('.'));
    const internalImports = analysis.imports.filter(i => i.source.startsWith('.'));

    if (externalImports.length > 0) {
      report += '### Внешние зависимости\n';
      for (const imp of externalImports) {
        report += `- \`${imp.source}\` → ${imp.specifiers.join(', ')}\n`;
      }
      report += '\n';
    }

    if (internalImports.length > 0) {
      report += '### Локальные модули\n';
      for (const imp of internalImports) {
        report += `- \`${imp.source}\` → ${imp.specifiers.join(', ')}\n`;
      }
      report += '\n';
    }
  }

  if (analysis.template.complexity > 0) {
    report += '## 🏗️ Шаблон\n\n';
    report += `- **Сложность:** ${analysis.template.complexity} элементов\n`;
    if (analysis.template.rootElements.length > 0) {
      report += `- **Корневые элементы:** ${analysis.template.rootElements.join(', ')}\n`;
    }
    if (analysis.template.directives.length > 0) {
      report += `- **Директивы:** ${analysis.template.directives.join(', ')}\n`;
    }
    if (analysis.template.events.length > 0) {
      report += `- **События:** ${analysis.template.events.join(', ')}\n`;
    }
    report += '\n';
  }

  report += '---\n';
  report += '## 💡 Рекомендации по разбиению\n\n';

  if (analysis.template.complexity > 50) {
    report += `⚠️ **Шаблон слишком большой** (${analysis.template.complexity} элементов). Рекомендуется вынести части в отдельные компоненты.\n\n`;
  }

  if (analysis.props.names.length > 10) {
    report += `⚠️ **Много props** (${analysis.props.names.length}). Возможно, компонент пытается делать слишком много.\n\n`;
  }

  if (analysis.composables.length > 5) {
    report += `⚠️ **Много composables** (${analysis.composables.length}). Рассмотрите группировку связанной логики.\n\n`;
  }

  if (analysis.stats.scriptLines > 300) {
    report += `⚠️ **Скрипт слишком большой** (${analysis.stats.scriptLines} строк). Разбейте на несколько composables.\n\n`;
  }

  return report;
}

/**
 * Интеграция с существующим split-module режимом
 */
export function enhanceWithVueAnalysis(targetFile: string, existingAnalysis: any) {
  if (!targetFile.endsWith('.vue')) {
    return existingAnalysis;
  }

  const vueAnalysis = analyzeVueComponent(targetFile);
  if (!vueAnalysis) {
    return existingAnalysis;
  }

  return {
    ...existingAnalysis,
    vue: vueAnalysis,
    enhancedInfo: {
      isVueComponent: true,
      hasProps: vueAnalysis.props.names.length > 0,
      hasEvents: vueAnalysis.emits.names.length > 0,
      hasSlots: vueAnalysis.slots.length > 0,
      usesComposables: vueAnalysis.composables.length > 0,
      templateComplexity: vueAnalysis.template.complexity,
      scriptSize: vueAnalysis.stats.scriptLines,
    },
  };
}

/**
 * Быстрый анализ Vue компонента для CLI
 */
export async function analyzeVueComponentCli(
  filePath: string,
  options: AnalysisOptions = {}
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎯 АНАЛИЗ VUE КОМПОНЕНТА');
  console.log(`${'='.repeat(60)}\n`);

  const analysis = analyzeVueComponent(filePath, options);

  if (!analysis) {
    console.error('❌ Не удалось проанализировать Vue компонент');
    return;
  }

  const report = generateVueComponentReport(analysis);
  console.log(report);

  const outputFile = `${analysis.componentName}-analysis.md`;
  fs.writeFileSync(outputFile, report);
  console.log(`\n✅ Отчет сохранен: ${outputFile}`);

  const jsonOutput = {
    analysis,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
  const jsonFile = `${analysis.componentName}-analysis.json`;
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
  console.log(`✅ JSON сохранен: ${jsonFile}`);
}
