// src/core/call-collector.ts
/**
 * Рекурсивный сбор всех вызовов функций из AST узла
 *
 * @param node - AST узел для анализа
 * @param functionNames - Set имен объявленных функций (для фильтрации)
 * @param currentFunction - Имя текущей функции (для исключения self-вызовов)
 * @param options - Дополнительные опции
 * @returns Массив имен вызванных функций
 */
export function collectAllCalls(
  node: any,
  functionNames: Set<string>,
  currentFunction: string,
  options?: { includeAllIdentifiers?: boolean; includeLocalCalls?: boolean }
): string[] {
  const calls: string[] = [];
  const visited = new WeakSet<any>();
  const includeAll = options?.includeAllIdentifiers !== false;
  // ✅ ИСПОЛЬЗУЕМ includeLocal для фильтрации локальных вызовов
  const includeLocal = options?.includeLocalCalls !== false;

  function traverse(n: any) {
    if (!n || typeof n !== 'object') return;
    if (visited.has(n)) return;
    visited.add(n);

    // ============================================
    // 1. ПРЯМОЙ ВЫЗОВ ФУНКЦИИ: func()
    // ============================================
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier') {
      const name = n.callee.name;
      if (name && name !== currentFunction) {
        // ✅ Проверяем, является ли функция локальной
        const isLocal = functionNames.has(name);
        // ✅ Если includeLocal=true, добавляем ВСЕ вызовы
        // ✅ Если includeLocal=false, добавляем только НЕ локальные (внешние)
        if (includeLocal || !isLocal) {
          calls.push(name);
        }
      }
    }

    // ============================================
    // 2. ВЫЗОВ МЕТОДА: obj.method()
    // ============================================
    if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
      const property = n.callee.property;
      if (property?.type === 'Identifier') {
        const methodName = property.name;
        if (methodName) {
          const isLocal = functionNames.has(methodName);
          // ✅ Добавляем только если includeLocal=true или метод не локальный
          if (includeLocal || !isLocal) {
            calls.push(methodName);
          }
        }
        // ✅ ДОБАВЛЯЕМ даже если метод не объявлен (может быть извне)
        if (includeAll && methodName) {
          const isLocal = functionNames.has(methodName);
          if (includeLocal || !isLocal) {
            calls.push(methodName);
          }
        }
      }
    }

    // ============================================
    // 3. НОВОЕ ВЫРАЖЕНИЕ: new Class()
    // ============================================
    if (n.type === 'NewExpression') {
      if (n.callee?.type === 'Identifier') {
        const name = n.callee.name;
        if (name) {
          const isLocal = functionNames.has(name);
          if (includeLocal || !isLocal) {
            calls.push(name);
          }
        }
        if (includeAll && name) {
          const isLocal = functionNames.has(name);
          if (includeLocal || !isLocal) {
            calls.push(name);
          }
        }
      }
    }

    // ============================================
    // 4. АРГУМЕНТЫ ВЫЗОВА (вложенные вызовы)
    // ============================================
    if (n.type === 'CallExpression' && n.arguments) {
      for (const arg of n.arguments) {
        traverse(arg);
      }
    }

    // ============================================
    // 5. RETURN STATEMENT
    // ============================================
    if (n.type === 'ReturnStatement' && n.argument) {
      traverse(n.argument);
    }

    // ============================================
    // 6. VARIABLE DECLARATOR
    // ============================================
    if (n.type === 'VariableDeclarator' && n.init) {
      traverse(n.init);
    }

    // ============================================
    // 7. ASSIGNMENT EXPRESSION
    // ============================================
    if (n.type === 'AssignmentExpression' && n.right) {
      traverse(n.right);
    }

    // ============================================
    // 8. CONDITIONAL EXPRESSION (тернарный оператор)
    // ============================================
    if (n.type === 'ConditionalExpression') {
      traverse(n.consequent);
      if (n.alternate) traverse(n.alternate);
    }

    // ============================================
    // 9. IF STATEMENT
    // ============================================
    if (n.type === 'IfStatement') {
      traverse(n.consequent);
      if (n.alternate) traverse(n.alternate);
    }

    // ============================================
    // 10. LOOP STATEMENTS
    // ============================================
    if (['ForStatement', 'WhileStatement', 'DoWhileStatement'].includes(n.type)) {
      if (n.body) traverse(n.body);
    }

    // ============================================
    // 11. FOR-IN / FOR-OF
    // ============================================
    if (n.type === 'ForInStatement' || n.type === 'ForOfStatement') {
      if (n.body) traverse(n.body);
    }

    // ============================================
    // 12. SWITCH STATEMENT
    // ============================================
    if (n.type === 'SwitchStatement' && n.cases) {
      for (const caseItem of n.cases) {
        if (caseItem.consequent) {
          for (const consequent of caseItem.consequent) {
            traverse(consequent);
          }
        }
      }
    }

    // ============================================
    // 13. BLOCK STATEMENT
    // ============================================
    if (n.type === 'BlockStatement' && n.body) {
      for (const child of n.body) {
        traverse(child);
      }
    }

    // ============================================
    // 14. OBJECT EXPRESSION
    // ============================================
    if (n.type === 'ObjectExpression' && n.properties) {
      for (const prop of n.properties) {
        if (prop.value) traverse(prop.value);
      }
    }

    // ============================================
    // 15. ARRAY EXPRESSION
    // ============================================
    if (n.type === 'ArrayExpression' && n.elements) {
      for (const elem of n.elements) {
        traverse(elem);
      }
    }

    // ============================================
    // 16. ARROW FUNCTION (тело)
    // ============================================
    if (n.type === 'ArrowFunctionExpression' && n.body) {
      traverse(n.body);
    }

    // ============================================
    // 17. FUNCTION EXPRESSION (тело)
    // ============================================
    if (n.type === 'FunctionExpression' && n.body) {
      traverse(n.body);
    }

    // ============================================
    // 18. YIELD EXPRESSION (генераторы)
    // ============================================
    if (n.type === 'YieldExpression' && n.argument) {
      traverse(n.argument);
    }

    // ============================================
    // 19. AWAIT EXPRESSION
    // ============================================
    if (n.type === 'AwaitExpression' && n.argument) {
      traverse(n.argument);
    }

    // ============================================
    // 20. РЕКУРСИВНЫЙ ОБХОД ВСЕХ СВОЙСТВ
    // ============================================
    for (const key of Object.keys(n)) {
      const child = n[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object') {
              traverse(item);
            }
          }
        } else {
          traverse(child);
        }
      }
    }
  }

  traverse(node);

  // ✅ Удаляем дубликаты и self-вызовы
  const result = [...new Set(calls)].filter(name => name !== currentFunction);

  return result;
}

/**
 * Собирает ВСЕ вызовы функций из AST, включая необъявленные
 * Используется для поиска всех функций, которые могут быть вызваны
 */
export function collectAllCallsUnfiltered(node: any, currentFunction?: string): string[] {
  const calls: string[] = [];
  const visited = new WeakSet<any>();

  function traverse(n: any) {
    if (!n || typeof n !== 'object') return;
    if (visited.has(n)) return;
    visited.add(n);

    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier') {
      const name = n.callee.name;
      if (name && name !== currentFunction) {
        calls.push(name);
      }
    }

    // Рекурсивный обход
    for (const key of Object.keys(n)) {
      const child = n[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object') {
              traverse(item);
            }
          }
        } else {
          traverse(child);
        }
      }
    }
  }

  traverse(node);
  return [...new Set(calls)];
}

/**
 * Находит все объявленные функции в AST
 */
export function collectDeclaredFunctions(ast: any): Set<string> {
  const functions = new Set<string>();

  if (!ast || !ast.body) return functions;

  function traverse(node: any) {
    if (!node || typeof node !== 'object') return;

    // FunctionDeclaration
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      functions.add(node.id.name);
    }

    // FunctionExpression with id
    if (node.type === 'FunctionExpression' && node.id?.name) {
      functions.add(node.id.name);
    }

    // VariableDeclarator with ArrowFunction/FunctionExpression
    if (node.type === 'VariableDeclarator' && node.id?.name) {
      if (
        node.init &&
        (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
      ) {
        functions.add(node.id.name);
      }
    }

    // ClassDeclaration
    if (node.type === 'ClassDeclaration' && node.id?.name) {
      functions.add(node.id.name);
    }

    // MethodDefinition
    if (node.type === 'MethodDefinition' && node.key?.name) {
      functions.add(node.key.name);
    }

    // Рекурсивный обход
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object') {
              traverse(item);
            }
          }
        } else {
          traverse(child);
        }
      }
    }
  }

  traverse(ast);
  return functions;
}

/**
 * Строит граф вызовов из AST
 * Возвращает Map: вызывающая функция → Set вызываемых функций
 */
export function buildCallGraphFromAST(ast: any): Map<string, Set<string>> {
  const callGraph = new Map<string, Set<string>>();
  const declaredFunctions = collectDeclaredFunctions(ast);

  if (!ast || !ast.body) return callGraph;

  function findCallsInNode(node: any, currentFunction: string) {
    if (!node) return;

    // Ищем вызовы
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
      const callee = node.callee.name;
      if (callee && callee !== currentFunction) {
        if (!callGraph.has(currentFunction)) {
          callGraph.set(currentFunction, new Set());
        }
        callGraph.get(currentFunction)!.add(callee);
      }
    }

    // Рекурсивный обход
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object') {
              findCallsInNode(item, currentFunction);
            }
          }
        } else {
          findCallsInNode(child, currentFunction);
        }
      }
    }
  }

  // Для каждой объявленной функции находим вызовы
  for (const funcName of declaredFunctions) {
    // Находим узел функции
    let funcNode: any = null;
    let found = false;

    function findFunction(node: any) {
      if (found) return;
      if (!node || typeof node !== 'object') return;

      if (node.type === 'FunctionDeclaration' && node.id?.name === funcName) {
        funcNode = node;
        found = true;
        return;
      }

      if (node.type === 'VariableDeclarator' && node.id?.name === funcName) {
        if (
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
        ) {
          funcNode = node.init;
          found = true;
          return;
        }
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === 'object') {
                findFunction(item);
              }
            }
          } else {
            findFunction(child);
          }
        }
      }
    }

    findFunction(ast);

    if (funcNode) {
      findCallsInNode(funcNode, funcName);
    }
  }

  return callGraph;
}

/**
 * Находит все функции, которые не вызываются (мертвый код)
 */
export function findUnusedFunctions(ast: any, callGraph?: Map<string, Set<string>>): string[] {
  const declared = collectDeclaredFunctions(ast);
  const graph = callGraph || buildCallGraphFromAST(ast);

  // Собираем все вызываемые функции
  const called = new Set<string>();
  for (const [, callees] of graph) {
    for (const callee of callees) {
      called.add(callee);
    }
  }

  // Исключаем экспортируемые функции (они могут быть использованы извне)
  // Упрощенная версия: пропускаем функцию если она не вызывается
  const unused: string[] = [];
  for (const func of declared) {
    if (!called.has(func)) {
      unused.push(func);
    }
  }

  return unused;
}

/**
 * Находит все неразрешенные вызовы (функции, которые вызываются, но не объявлены)
 */
export function findUnresolvedCalls(ast: any): string[] {
  const declared = collectDeclaredFunctions(ast);
  const allCalls = collectAllCallsUnfiltered(ast);

  return allCalls.filter(name => !declared.has(name));
}

/**
 * Собирает все вызовы из блока кода с учетом вложенности
 */
export function collectCallsFromBlock(
  block: any,
  functionNames: Set<string>,
  currentFunction: string
): string[] {
  if (!block) return [];
  return collectAllCalls(block, functionNames, currentFunction, {
    includeAllIdentifiers: true,
    includeLocalCalls: true,
  });
}

/**
 * Собирает все вызовы из функции с учетом вложенных функций
 */
export function collectCallsFromFunction(
  funcNode: any,
  functionNames: Set<string>,
  funcName: string
): string[] {
  if (!funcNode) return [];

  // Собираем все вызовы из тела функции
  let body = funcNode.body;

  // Для стрелочных функций с выражением (не блоком)
  if (funcNode.type === 'ArrowFunctionExpression' && funcNode.body?.type !== 'BlockStatement') {
    // Создаем искусственный блок для обхода
    body = {
      type: 'BlockStatement',
      body: [
        {
          type: 'ReturnStatement',
          argument: funcNode.body,
        },
      ],
    };
  }

  return collectAllCalls(body, functionNames, funcName, {
    includeAllIdentifiers: true,
    includeLocalCalls: true,
  });
}

/**
 * Находит все функции, которые вызывают указанную функцию
 */
export function findCallers(ast: any, targetFunction: string): string[] {
  const callers: string[] = [];
  const declaredFunctions = collectDeclaredFunctions(ast);

  if (!ast || !ast.body) return callers;

  function findFunctionNode(funcName: string): any {
    let result: any = null;
    let found = false;

    function search(node: any) {
      if (found) return;
      if (!node || typeof node !== 'object') return;

      if (node.type === 'FunctionDeclaration' && node.id?.name === funcName) {
        result = node;
        found = true;
        return;
      }

      if (node.type === 'VariableDeclarator' && node.id?.name === funcName) {
        if (
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
        ) {
          result = node.init;
          found = true;
          return;
        }
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === 'object') {
                search(item);
              }
            }
          } else {
            search(child);
          }
        }
      }
    }

    search(ast);
    return result;
  }

  // Для каждой объявленной функции проверяем, вызывает ли она targetFunction
  for (const funcName of declaredFunctions) {
    if (funcName === targetFunction) continue;

    const funcNode = findFunctionNode(funcName);
    if (funcNode) {
      const calls = collectCallsFromFunction(funcNode, declaredFunctions, funcName);
      if (calls.includes(targetFunction)) {
        callers.push(funcName);
      }
    }
  }

  return callers;
}

/**
 * Проверяет, вызывается ли функция внутри указанного узла
 */
export function isFunctionCalled(
  node: any,
  functionName: string,
  currentFunction?: string
): boolean {
  let found = false;
  const visited = new WeakSet<any>();

  function traverse(n: any) {
    if (found) return;
    if (!n || typeof n !== 'object') return;
    if (visited.has(n)) return;
    visited.add(n);

    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier') {
      const name = n.callee.name;
      if (name === functionName && name !== currentFunction) {
        found = true;
        return;
      }
    }

    for (const key of Object.keys(n)) {
      const child = n[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object') {
              traverse(item);
            }
          }
        } else {
          traverse(child);
        }
      }
    }
  }

  traverse(node);
  return found;
}

export default {
  collectAllCalls,
  collectAllCallsUnfiltered,
  collectDeclaredFunctions,
  buildCallGraphFromAST,
  findUnusedFunctions,
  findUnresolvedCalls,
  collectCallsFromBlock,
  collectCallsFromFunction,
  findCallers,
  isFunctionCalled,
};
