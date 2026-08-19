// packages/ast-analyzer/src/core/entity-extractor.ts
import { walk } from 'estree-walker';
import path from 'path';

export interface FunctionInfo {
  name: string;
  line: number;
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  returnType?: string;
  calls: string[];
  calledBy: string[];
  body?: string;
  startLine: number;
  endLine: number;
  isMethod?: boolean;
  className?: string;
}

export interface ClassInfo {
  name: string;
  line: number;
  isExported: boolean;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
}

export interface ConstantInfo {
  name: string;
  line: number;
  value?: any;
  isExported: boolean;
  type?: string;
}

export interface InterfaceInfo {
  name: string;
  line: number;
  isExported: boolean;
  properties: string[];
  extends?: string[];
  startLine: number;
  endLine: number;
}

export interface TypeInfo {
  name: string;
  line: number;
  isExported: boolean;
  definition: string;
}

export interface VariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type?: string;
  value?: any;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'default';
  isDefault: boolean;
  line: number;
}

export interface EntitiesResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  variables: VariableInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

/**
 * Безопасная проверка, является ли объект массивом
 */
function isArraySafe(value: any): boolean {
  return value && Array.isArray(value);
}

/**
 * Безопасно получает тип узла для отладки
 */
function getNodeType(node: any): string {
  if (!node) return 'null';
  if (typeof node !== 'object') return typeof node;
  if (node.type) return node.type;
  if (node.constructor?.name) return node.constructor.name;
  return 'unknown';
}

/**
 * Безопасно получает местоположение узла для отладки
 */
function getNodeLocation(node: any): string {
  if (!node) return 'unknown';
  if (node.loc?.start) {
    return `line ${node.loc.start.line}, column ${node.loc.start.column}`;
  }
  if (node.start !== undefined) {
    return `position ${node.start}`;
  }
  return 'unknown location';
}

/**
 * Извлекает все сущности из AST
 */
export function extractEntities(ast: any, filePath?: string): EntitiesResult {
  // Проверка на null/undefined
  if (!ast || !ast.body) {
    return {
      functions: [],
      classes: [],
      constants: [],
      interfaces: [],
      types: [],
      variables: [],
      imports: [],
      exports: [],
      callGraph: {},
      moduleName: filePath ? path.basename(filePath) : 'unknown',
      filePath: filePath || 'unknown',
    };
  }

  // Убеждаемся, что body это массив
  if (!isArraySafe(ast.body)) {
    const nodeType = getNodeType(ast.body);
    console.warn(
      `⚠️ AST.body не является массивом для ${filePath || 'unknown'}, тип: ${nodeType}, пропускаем`
    );
    return {
      functions: [],
      classes: [],
      constants: [],
      interfaces: [],
      types: [],
      variables: [],
      imports: [],
      exports: [],
      callGraph: {},
      moduleName: filePath ? path.basename(filePath) : 'unknown',
      filePath: filePath || 'unknown',
    };
  }

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const constants: ConstantInfo[] = [];
  const interfaces: InterfaceInfo[] = [];
  const types: TypeInfo[] = [];
  const variables: VariableInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const callGraph: Record<string, string[]> = {};

  let currentFunction: string | null = null;
  let currentClass: string | null = null;

  // Первый проход: сбор объявлений
  try {
    walk(ast, {
      enter(node: any, parent: any) {
        // Проверка на наличие node
        if (!node || typeof node !== 'object') return;

        // === ИМПОРТЫ ===
        if (node.type === 'ImportDeclaration' && node.source) {
          const source = node.source.value;
          const isTypeOnly = node.importKind === 'type';
          const specifiers: string[] = [];
          let isDefault = false;
          let isNamespace = false;

          if (isArraySafe(node.specifiers)) {
            for (const spec of node.specifiers) {
              if (!spec) continue;
              if (spec.type === 'ImportSpecifier') {
                const importedName = spec.imported?.name || 'unknown';
                const localName = spec.local?.name || 'unknown';
                specifiers.push(
                  importedName === localName ? importedName : `${importedName} as ${localName}`
                );
              } else if (spec.type === 'ImportDefaultSpecifier') {
                const localName = spec.local?.name || 'unknown';
                specifiers.push(`default as ${localName}`);
                isDefault = true;
              } else if (spec.type === 'ImportNamespaceSpecifier') {
                const localName = spec.local?.name || 'unknown';
                specifiers.push(`* as ${localName}`);
                isNamespace = true;
              }
            }
          } else if (node.specifiers !== undefined) {
            const specType = getNodeType(node.specifiers);
            const loc = getNodeLocation(node);
            console.warn(
              `⚠️ ImportDeclaration.specifiers не массив: ${specType}, в файле ${filePath || 'unknown'}, ${loc}`
            );
          }

          imports.push({
            source: source || 'unknown',
            specifiers,
            isTypeOnly,
            isDefault,
            isNamespace,
            line: node.loc?.start?.line || 1,
          });
        }

        // === ЭКСПОРТЫ ===
        if (node.type === 'ExportNamedDeclaration') {
          let exportName = '';
          let exportType: ExportInfo['type'] = 'default';

          if (node.declaration) {
            const decl = node.declaration;
            if (decl.type === 'FunctionDeclaration' && decl.id) {
              exportName = decl.id.name;
              exportType = 'function';
            } else if (decl.type === 'ClassDeclaration' && decl.id) {
              exportName = decl.id.name;
              exportType = 'class';
            } else if (decl.type === 'VariableDeclaration') {
              if (isArraySafe(decl.declarations)) {
                for (const d of decl.declarations) {
                  if (d.id?.name) {
                    exportName = d.id.name;
                    exportType = 'constant';
                  }
                }
              } else if (decl.declarations !== undefined) {
                const declType = getNodeType(decl.declarations);
                const loc = getNodeLocation(node);
                console.warn(
                  `⚠️ VariableDeclaration.declarations не массив: ${declType}, в файле ${filePath || 'unknown'}, ${loc}`
                );
              }
            }
          } else if (isArraySafe(node.specifiers)) {
            for (const spec of node.specifiers) {
              if (spec.exported) {
                exportName = spec.exported.name;
                exportType = 'variable';
              }
            }
          } else if (node.specifiers !== undefined) {
            const specType = getNodeType(node.specifiers);
            const loc = getNodeLocation(node);
            console.warn(
              `⚠️ ExportNamedDeclaration.specifiers не массив: ${specType}, в файле ${filePath || 'unknown'}, ${loc}`
            );
          }

          if (exportName) {
            exports.push({
              name: exportName,
              type: exportType,
              isDefault: false,
              line: node.loc?.start?.line || 1,
            });
          }
        }

        if (node.type === 'ExportDefaultDeclaration') {
          let exportName = 'default';
          let exportType: ExportInfo['type'] = 'default';

          if (node.declaration) {
            const decl = node.declaration;
            if (decl.type === 'FunctionDeclaration' && decl.id) {
              exportName = decl.id.name || 'default';
              exportType = 'function';
            } else if (decl.type === 'ClassDeclaration' && decl.id) {
              exportName = decl.id.name || 'default';
              exportType = 'class';
            } else if (decl.type === 'Identifier') {
              exportName = decl.name || 'default';
              exportType = 'variable';
            }
          }

          exports.push({
            name: exportName,
            type: exportType,
            isDefault: true,
            line: node.loc?.start?.line || 1,
          });
        }

        // === ФУНКЦИИ ===
        if (
          (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') &&
          node.id
        ) {
          const name = node.id.name;
          const isExported = isNodeExported(node, parent);

          const params = isArraySafe(node.params)
            ? node.params.map((p: any) => {
              if (p.type === 'Identifier') return p.name || 'unknown';
              if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
              if (p.type === 'RestElement' && p.argument)
                return `...${p.argument.name || 'unknown'}`;
              return 'unknown';
            })
            : [];

          const funcInfo: FunctionInfo = {
            name: name || 'anonymous',
            line: node.loc?.start?.line || 1,
            isAsync: node.async || false,
            isExported,
            params,
            returnType: node.returnType?.typeName?.name || node.returnType?.name || undefined,
            calls: [],
            calledBy: [],
            startLine: node.loc?.start?.line || 1,
            endLine: node.loc?.end?.line || 1,
            body: node.body ? extractBodyText(node.body) : undefined,
          };

          functions.push(funcInfo);
          if (name) {
            callGraph[name] = [];
          }
          currentFunction = name;
        }

        // === МЕТОДЫ КЛАССОВ ===
        if (node.type === 'MethodDefinition' && node.key) {
          const methodName = node.key.name;
          const className = currentClass || parent?.id?.name || 'Anonymous';

          if (methodName) {
            const isExported = isNodeExported(node, parent);
            const params = isArraySafe(node.value?.params)
              ? node.value.params.map((p: any) => {
                if (p.type === 'Identifier') return p.name || 'unknown';
                if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
                return 'unknown';
              })
              : [];

            const funcInfo: FunctionInfo = {
              name: methodName,
              line: node.loc?.start?.line || 1,
              isAsync: node.value?.async || false,
              isExported,
              params,
              returnType: node.value?.returnType?.typeName?.name || undefined,
              calls: [],
              calledBy: [],
              startLine: node.loc?.start?.line || 1,
              endLine: node.loc?.end?.line || 1,
              isMethod: true,
              className,
            };

            functions.push(funcInfo);
            const key = `${className}.${methodName}`;
            callGraph[key] = [];
          }
        }

        // === КЛАССЫ ===
        if (node.type === 'ClassDeclaration' && node.id) {
          const name = node.id.name;
          const isExported = isNodeExported(node, parent);

          const methods: string[] = [];
          const properties: string[] = [];

          if (isArraySafe(node.body?.body)) {
            for (const member of node.body.body) {
              if (!member) continue;
              if (member.type === 'MethodDefinition' && member.key) {
                methods.push(member.key.name);
              }
              if (member.type === 'PropertyDefinition' && member.key) {
                properties.push(member.key.name);
              }
            }
          } else if (node.body?.body !== undefined) {
            const bodyType = getNodeType(node.body.body);
            const loc = getNodeLocation(node);
            console.warn(
              `⚠️ ClassDeclaration.body.body не массив: ${bodyType}, в файле ${filePath || 'unknown'}, ${loc}`
            );
          }

          const classInfo: ClassInfo = {
            name: name || 'anonymous',
            line: node.loc?.start?.line || 1,
            isExported,
            methods,
            properties,
            extends: node.superClass?.name || undefined,
            implements: node.implements?.map((i: any) => i.expression?.name || i.name) || [],
            startLine: node.loc?.start?.line || 1,
            endLine: node.loc?.end?.line || 1,
          };

          classes.push(classInfo);
          currentClass = name;
        }

        // === КОНСТАНТЫ ===
        if (node.type === 'VariableDeclaration') {
          const isExported = isNodeExported(node, parent);
          const kind = node.kind;

          if (isArraySafe(node.declarations)) {
            for (const decl of node.declarations) {
              if (!decl) continue;
              if (decl.id?.type === 'Identifier') {
                const name = decl.id.name;
                const isConst = kind === 'const';

                if (isConst) {
                  constants.push({
                    name: name || 'unknown',
                    line: decl.loc?.start?.line || node.loc?.start?.line || 1,
                    value: extractValue(decl.init),
                    isExported,
                    type: decl.init?.type || undefined,
                  });
                } else {
                  variables.push({
                    name: name || 'unknown',
                    line: decl.loc?.start?.line || node.loc?.start?.line || 1,
                    isExported,
                    type: decl.init?.type || undefined,
                    value: extractValue(decl.init),
                  });
                }
              }
            }
          } else if (node.declarations !== undefined) {
            const declType = getNodeType(node.declarations);
            const loc = getNodeLocation(node);
            console.warn(
              `⚠️ VariableDeclaration.declarations не массив: ${declType}, в файле ${filePath || 'unknown'}, ${loc}`
            );
          }
        }

        // === ИНТЕРФЕЙСЫ ===
        if (node.type === 'TSInterfaceDeclaration' && node.id) {
          const name = node.id.name;
          const isExported = isNodeExported(node, parent);

          const properties: string[] = [];
          if (isArraySafe(node.body?.body)) {
            for (const member of node.body.body) {
              if (!member) continue;
              if (member.key?.name) {
                properties.push(member.key.name);
              }
            }
          } else if (node.body?.body !== undefined) {
            const bodyType = getNodeType(node.body.body);
            const loc = getNodeLocation(node);
            console.warn(
              `⚠️ TSInterfaceDeclaration.body.body не массив: ${bodyType}, в файле ${filePath || 'unknown'}, ${loc}`
            );
          }

          interfaces.push({
            name: name || 'unknown',
            line: node.loc?.start?.line || 1,
            isExported,
            properties,
            extends: node.extends?.map((e: any) => e.expression?.name || e.name) || [],
            startLine: node.loc?.start?.line || 1,
            endLine: node.loc?.end?.line || 1,
          });
        }

        // === ТИПЫ ===
        if (node.type === 'TSTypeAliasDeclaration' && node.id) {
          const name = node.id.name;
          const isExported = isNodeExported(node, parent);

          types.push({
            name: name || 'unknown',
            line: node.loc?.start?.line || 1,
            isExported,
            definition: node.typeAnnotation?.type || 'unknown',
          });
        }

        // === СТРЕЛОЧНЫЕ ФУНКЦИИ ===
        if (node.type === 'VariableDeclaration') {
          if (isArraySafe(node.declarations)) {
            for (const decl of node.declarations) {
              if (!decl) continue;
              if (decl.id?.type === 'Identifier' && decl.init) {
                if (
                  decl.init.type === 'ArrowFunctionExpression' ||
                  decl.init.type === 'FunctionExpression'
                ) {
                  const name = decl.id.name;
                  const isExported = isNodeExported(node, parent);
                  const params = isArraySafe(decl.init.params)
                    ? decl.init.params.map((p: any) => {
                      if (p.type === 'Identifier') return p.name || 'unknown';
                      if (p.type === 'AssignmentPattern' && p.left)
                        return p.left.name || 'unknown';
                      return 'unknown';
                    })
                    : [];

                  functions.push({
                    name: name || 'unknown',
                    line: decl.loc?.start?.line || node.loc?.start?.line || 1,
                    isAsync: decl.init.async || false,
                    isExported,
                    params,
                    returnType: decl.init.returnType?.typeName?.name || undefined,
                    calls: [],
                    calledBy: [],
                    startLine: decl.loc?.start?.line || node.loc?.start?.line || 1,
                    endLine: decl.loc?.end?.line || node.loc?.start?.line || 1,
                    body: decl.init.body ? extractBodyText(decl.init.body) : undefined,
                  });
                  if (name) {
                    callGraph[name] = [];
                  }
                }
              }
            }
          } else if (node.declarations !== undefined) {
            const declType = getNodeType(node.declarations);
            const loc = getNodeLocation(node);
            console.warn(
              `⚠️ VariableDeclaration.declarations не массив (стрелочные): ${declType}, в файле ${filePath || 'unknown'}, ${loc}`
            );
          }
        }
      },
      leave(node: any) {
        if (node.type === 'FunctionDeclaration' && node.id) {
          currentFunction = null;
        }
        if (node.type === 'ClassDeclaration' && node.id) {
          currentClass = null;
        }
      },
    });
  } catch (error) {
    console.warn(`⚠️ Ошибка при обходе AST для ${filePath || 'unknown'}:`, error);
    return {
      functions,
      classes,
      constants,
      interfaces,
      types,
      variables,
      imports,
      exports,
      callGraph,
      moduleName: filePath ? path.basename(filePath) : 'unknown',
      filePath: filePath || 'unknown',
    };
  }

  // Второй проход: сбор вызовов
  try {
    walk(ast, {
      enter(node: any) {
        if (!node || typeof node !== 'object') return;

        if (node.type === 'CallExpression' && node.callee) {
          let callerName: string | null = null;

          // Определяем вызывающую функцию
          if (currentFunction) {
            callerName = currentFunction;
          } else {
            // Находим родительскую функцию
            let parent = node;
            while (parent) {
              if (parent.type === 'FunctionDeclaration' && parent.id) {
                callerName = parent.id.name;
                break;
              }
              if (parent.type === 'MethodDefinition' && parent.key) {
                const className = parent.parent?.id?.name || 'Anonymous';
                callerName = `${className}.${parent.key.name}`;
                break;
              }
              if (parent.type === 'VariableDeclaration') {
                if (isArraySafe(parent.declarations)) {
                  for (const decl of parent.declarations) {
                    if (decl.init && (decl.init === node || isChildNode(decl.init, node))) {
                      callerName = decl.id?.name || null;
                      break;
                    }
                  }
                }
                if (callerName) break;
              }
              parent = parent.parent;
            }
          }

          if (callerName) {
            let calleeName: string | null = null;

            if (node.callee.type === 'Identifier') {
              calleeName = node.callee.name;
            } else if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property?.type === 'Identifier'
            ) {
              calleeName = node.callee.property.name;
            } else if (node.callee.type === 'Super') {
              calleeName = 'super';
            }

            if (calleeName && callerName !== calleeName) {
              const callerKey = callerName;
              if (!callGraph[callerKey]) {
                callGraph[callerKey] = [];
              }
              const callerCalls = callGraph[callerKey];
              if (callerCalls && !callerCalls.includes(calleeName)) {
                callerCalls.push(calleeName);
              }
            }
          }
        }
      },
    });
  } catch (error) {
    console.warn(`⚠️ Ошибка при сборе вызовов для ${filePath || 'unknown'}:`, error);
  }

  // Заполняем calledBy для каждой функции
  for (const [caller, callees] of Object.entries(callGraph)) {
    for (const callee of callees) {
      const func = functions.find(
        f =>
          f.name === callee || (f.isMethod && f.className && `${f.className}.${f.name}` === callee)
      );
      if (func && !func.calledBy.includes(caller)) {
        func.calledBy.push(caller);
      }
    }
  }

  // ✅ ИСПРАВЛЕНО: Заполняем calls для каждой функции с гарантией, что это массив
  for (const func of functions) {
    let allCalls: string[] = [];

    const funcCalls = callGraph[func.name];

    // ✅ Проверяем, что funcCalls является массивом
    if (Array.isArray(funcCalls)) {
      allCalls = [...allCalls, ...funcCalls];
    } else if (funcCalls && typeof funcCalls === 'object') {
      // Если это не массив, а объект, пытаемся извлечь строковые значения
      console.warn(`⚠️ funcCalls для '${func.name}' не является массивом:`, typeof funcCalls);
      console.warn(`   Значение:`, funcCalls);

      try {
        const values = Object.values(funcCalls);
        const stringValues = values.filter(v => typeof v === 'string');
        if (stringValues.length > 0) {
          allCalls = [...allCalls, ...stringValues];
          console.log(`   🔧 Извлечено из объекта: ${stringValues.join(', ')}`);
        }
      } catch (error) {
        console.warn(`   ⚠️ Не удалось извлечь значения из объекта:`, error);
      }
    }

    if (func.isMethod && func.className) {
      const key = `${func.className}.${func.name}`;
      const methodCalls = callGraph[key];
      if (Array.isArray(methodCalls)) {
        allCalls = [...allCalls, ...methodCalls];
      } else if (methodCalls && typeof methodCalls === 'object') {
        // Для методов тоже применяем защиту
        try {
          const values = Object.values(methodCalls);
          const stringValues = values.filter(v => typeof v === 'string');
          if (stringValues.length > 0) {
            allCalls = [...allCalls, ...stringValues];
          }
        } catch (error) {
          // Игнорируем
        }
      }
    }

    func.calls = [...new Set(allCalls)];
  }

  return {
    functions,
    classes,
    constants,
    interfaces,
    types,
    variables,
    imports,
    exports,
    callGraph,
    moduleName: filePath ? path.basename(filePath) : 'unknown',
    filePath: filePath || 'unknown',
  };
}

/**
 * Проверяет, является ли узел дочерним для другого узла
 */
function isChildNode(parent: any, child: any): boolean {
  if (!parent || !child) return false;
  if (parent === child) return true;

  for (const key of Object.keys(parent)) {
    const value = parent[key];
    if (value && typeof value === 'object') {
      if (isArraySafe(value)) {
        for (const item of value) {
          if (isChildNode(item, child)) return true;
        }
      } else {
        if (isChildNode(value, child)) return true;
      }
    }
  }
  return false;
}

/**
 * Проверяет, экспортируется ли узел
 */
function isNodeExported(node: any, parent: any): boolean {
  if (!node) return false;

  // Прямой export
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

  // Проверка родителя
  if (parent) {
    if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
      return true;
    }
    if (parent.type === 'VariableDeclaration' && isNodeExported(parent, parent.parent)) {
      return true;
    }
  }

  // Проверка наличия export в тексте
  if (node.leadingComments) {
    for (const comment of node.leadingComments) {
      if (comment.value && comment.value.includes('@export')) {
        return true;
      }
    }
  }

  // Проверка декораторов
  if (node.decorators) {
    for (const decorator of node.decorators) {
      if (
        decorator.expression?.name === 'export' ||
        decorator.expression?.callee?.name === 'export'
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Извлекает текст тела функции
 */
function extractBodyText(body: any): string | undefined {
  if (!body) return undefined;

  if (body.type === 'BlockStatement') {
    const statements = body.body || [];
    if (statements.length === 0) return '{}';

    const firstStatement = statements[0];
    if (firstStatement && firstStatement.type === 'ReturnStatement') {
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

  return body.type || undefined;
}

/**
 * Извлекает значение из узла
 */
function extractValue(node: any): any {
  if (!node) return undefined;

  if (node.type === 'Literal') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'UnaryExpression') {
    return `${node.operator}${extractValue(node.argument)}`;
  }

  if (node.type === 'BinaryExpression') {
    return `${extractValue(node.left)} ${node.operator} ${extractValue(node.right)}`;
  }

  if (node.type === 'ArrayExpression') {
    if (isArraySafe(node.elements)) {
      return node.elements.map((e: any) => extractValue(e)).filter((v: any) => v !== undefined);
    }
    return [];
  }

  if (node.type === 'ObjectExpression') {
    const obj: Record<string, any> = {};
    if (isArraySafe(node.properties)) {
      for (const prop of node.properties) {
        if (prop.type === 'Property' && prop.key) {
          const key = prop.key.name || prop.key.value;
          if (key !== undefined) {
            obj[key] = extractValue(prop.value);
          }
        }
      }
    }
    return obj;
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return '[Function]';
  }

  if (node.type === 'TemplateLiteral') {
    if (isArraySafe(node.quasis)) {
      return node.quasis.map((q: any) => q.value?.raw || '').join('');
    }
    return '';
  }

  if (node.type === 'NewExpression') {
    return `new ${node.callee?.name || '...'}()`;
  }

  return undefined;
}

/**
 * Получает все вызовы функций из AST
 */
export function extractCallGraph(ast: any): Record<string, string[]> {
  const callGraph: Record<string, string[]> = {};
  let currentFunction: string | null = null;

  try {
    walk(ast, {
      enter(node: any) {
        if (!node || typeof node !== 'object') return;

        if (node.type === 'FunctionDeclaration' && node.id) {
          currentFunction = node.id.name;
          if (currentFunction && !callGraph[currentFunction]) {
            callGraph[currentFunction] = [];
          }
        }

        if (node.type === 'CallExpression' && node.callee && currentFunction) {
          let calleeName: string | null = null;
          if (node.callee.type === 'Identifier') {
            calleeName = node.callee.name;
          } else if (node.callee.type === 'MemberExpression' && node.callee.property) {
            calleeName = node.callee.property.name;
          }

          if (calleeName && currentFunction) {
            const funcKey = currentFunction;
            if (!callGraph[funcKey]) {
              callGraph[funcKey] = [];
            }
            const funcCalls = callGraph[funcKey];
            if (funcCalls && !funcCalls.includes(calleeName)) {
              funcCalls.push(calleeName);
            }
          }
        }
      },
      leave(node: any) {
        if (node.type === 'FunctionDeclaration' && node.id) {
          currentFunction = null;
        }
      },
    });
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении графа вызовов:', error);
  }

  return callGraph;
}

/**
 * Экспорт утилит
 */
export default {
  extractEntities,
  extractCallGraph,
};
