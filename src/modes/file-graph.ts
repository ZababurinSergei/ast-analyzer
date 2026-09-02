// modes/file-graph.ts
import path from 'path';
import { parseFile, walk } from '../core/ast-parser.js';
import { normalizePathForDisplay } from '../utils/path-utils.js';
import { collectDeclaredFunctions, buildCallGraphFromAST } from '../core/call-collector.js';

/**
 * Рекурсивно собирает объявления функций, классов и переменных из AST
 * @param node Текущий узел AST
 * @param declarations Объект для хранения объявлений
 * @param depth Текущая глубина рекурсии
 * @param maxDepth Максимальная глубина рекурсии
 */
function collectDeclarationsRecursive(
  node: any,
  declarations: Record<string, { type: string; node: any }>,
  depth: number = 0,
  maxDepth: number = 100
): void {
  if (!node || typeof node !== 'object') return;
  if (depth > maxDepth) return;

  // ✅ Обработка экспортов
  if (node.type === 'ExportNamedDeclaration') {
    if (node.declaration) {
      // Рекурсивно обрабатываем declaration
      collectDeclarationsRecursive(node.declaration, declarations, depth + 1, maxDepth);
    }
    return; // Не продолжаем дальше, чтобы не дублировать
  }

  // Проверяем текущий узел на наличие объявлений
  if (node.type === 'FunctionDeclaration' && node.id) {
    declarations[node.id.name] = { type: 'function', node: node };
  }

  // ✅ Исправлено: проверяем наличие body у класса
  if (node.type === 'ClassDeclaration' && node.id) {
    // Для TypeScript классов body может быть объектом с body.body
    if (node.body) {
      declarations[node.id.name] = { type: 'class', node: node };

      // ✅ ДОПОЛНИТЕЛЬНО: добавляем методы класса как отдельные объявления
      if (node.body.body && Array.isArray(node.body.body)) {
        for (const method of node.body.body) {
          // Обрабатываем MethodDefinition и PropertyDefinition (для стрелочных методов)
          if (
            (method.type === 'MethodDefinition' || method.type === 'PropertyDefinition') &&
            method.key?.name
          ) {
            declarations[method.key.name] = { type: 'function', node: method };
          }
        }
      }
    } else {
      console.warn(`⚠️ Класс ${node.id.name} не имеет body, пропускаем`);
    }
  }

  if (node.type === 'VariableDeclaration') {
    if (node.declarations && Array.isArray(node.declarations)) {
      node.declarations.forEach((decl: any) => {
        if (decl.id?.name) {
          declarations[decl.id.name] = { type: 'variable', node: decl };
        }
      });
    }
  }

  // ✅ НОВОЕ: собираем вложенные функции внутри блоков
  if (node.type === 'BlockStatement' && node.body) {
    for (const child of node.body) {
      if (child.type === 'FunctionDeclaration' && child.id) {
        // Добавляем вложенную функцию в declarations
        declarations[child.id.name] = { type: 'function', node: child };
      }
    }
  }

  // ✅ НОВОЕ: собираем функции внутри IIFE и других выражений
  if (node.type === 'CallExpression' && node.callee?.type === 'FunctionExpression') {
    const funcNode = node.callee;
    if (funcNode.id?.name) {
      declarations[funcNode.id.name] = { type: 'function', node: funcNode };
    }
    // Также проверяем тело функции
    if (funcNode.body) {
      collectDeclarationsRecursive(funcNode.body, declarations, depth + 1, maxDepth);
    }
  }

  // ✅ НОВОЕ: собираем стрелочные функции в переменных
  if (node.type === 'VariableDeclarator' && node.id?.name) {
    if (
      node.init &&
      (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
    ) {
      declarations[node.id.name] = { type: 'function', node: node.init };
    }
  }

  // ✅ УЛУЧШЕННЫЙ СБОР ДЕТЕЙ ДЛЯ РЕКУРСИВНОГО ОБХОДА
  const childrenToTraverse: any[] = [];

  // body - проверяем, что это массив или объект
  if (node.body) {
    if (Array.isArray(node.body)) {
      childrenToTraverse.push(...node.body);
    } else if (typeof node.body === 'object') {
      childrenToTraverse.push(node.body);
    }
  }

  // ⭐ ДЛЯ КЛАССОВ - отдельная обработка
  if (node.type === 'ClassDeclaration' && node.body && Array.isArray(node.body.body)) {
    childrenToTraverse.push(...node.body.body);
  }

  // consequent/alternate (if/else)
  if (node.consequent) childrenToTraverse.push(node.consequent);
  if (node.alternate) childrenToTraverse.push(node.alternate);

  // cases (switch)
  if (node.cases) {
    node.cases.forEach((caseNode: any) => {
      if (caseNode.consequent) {
        childrenToTraverse.push(...caseNode.consequent);
      }
    });
  }

  // init/update/test (for, while, do-while)
  if (node.init) childrenToTraverse.push(node.init);
  if (node.update) childrenToTraverse.push(node.update);
  if (node.test) childrenToTraverse.push(node.test);

  // handler/finalizer (try-catch-finally)
  if (node.handler) childrenToTraverse.push(node.handler);
  if (node.finalizer) childrenToTraverse.push(node.finalizer);

  // object (catch clause)
  if (node.param) childrenToTraverse.push(node.param);

  // arguments (function calls)
  if (node.arguments && Array.isArray(node.arguments)) {
    childrenToTraverse.push(...node.arguments);
  }

  // properties (object expressions)
  if (node.properties && Array.isArray(node.properties)) {
    childrenToTraverse.push(...node.properties);
  }

  // elements (array expressions)
  if (node.elements && Array.isArray(node.elements)) {
    childrenToTraverse.push(...node.elements);
  }

  // expression (return, throw, etc.)
  if (node.argument) childrenToTraverse.push(node.argument);
  if (node.expression) childrenToTraverse.push(node.expression);

  // ✅ БЕЗОПАСНАЯ ФИЛЬТРАЦИЯ ДЕТЕЙ
  const validChildren = childrenToTraverse.filter(child => child && typeof child === 'object');

  for (const child of validChildren) {
    collectDeclarationsRecursive(child, declarations, depth + 1, maxDepth);
  }
}

/**
 * Строит внутренний граф зависимостей внутри одного файла
 * @param filePath Путь к файлу
 * @param _options Опции (maxDepth - максимальная глубина анализа) - опционально, пока не используется
 * @returns Объект с графом зависимостей или null при ошибке
 */
export function buildFileInternalGraph(
  filePath: string,
  _options: { maxDepth?: number } = {}
): { rootKey: string; graph: Record<string, string[]> } | null {
  const parsed = parseFile(filePath);
  const ast = parsed?.ast;

  // ✅ УСИЛЕННАЯ ПРОВЕРКА AST
  if (!ast) {
    console.warn(`⚠️ Не удалось получить AST для файла: ${filePath}`);
    return null;
  }

  // ✅ ПРОВЕРКА НА НАЛИЧИЕ body
  if (!ast.body || !Array.isArray(ast.body)) {
    console.warn(`⚠️ AST не содержит body для файла: ${filePath}`);
    // Вместо null возвращаем пустой граф
    return {
      rootKey: normalizePathForDisplay(path.basename(filePath)),
      graph: {},
    };
  }

  const declarations: Record<string, { type: string; node: any }> = {};
  const relations: { from: string; to: string }[] = [];

  // Используем рекурсивный сбор объявлений вместо обхода только верхнего уровня
  try {
    collectDeclarationsRecursive(ast, declarations);

    // ✅ НОВОЕ: используем collectDeclaredFunctions для поиска пропущенных функций
    const declaredFunctions = collectDeclaredFunctions(ast);
    for (const funcName of declaredFunctions) {
      if (!declarations[funcName]) {
        // Находим узел функции в AST
        let found = false;
        function findFunction(node: any) {
          if (found) return;
          if (!node || typeof node !== 'object') return;

          if (node.type === 'FunctionDeclaration' && node.id?.name === funcName) {
            declarations[funcName] = { type: 'function', node: node };
            found = true;
            return;
          }

          if (node.type === 'VariableDeclarator' && node.id?.name === funcName) {
            if (
              node.init &&
              (node.init.type === 'ArrowFunctionExpression' ||
                node.init.type === 'FunctionExpression')
            ) {
              declarations[funcName] = { type: 'function', node: node.init };
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

        if (found) {
          console.log(`   🔍 Найдена пропущенная функция: ${funcName}`);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Ошибка при сборе объявлений: ${error}`);
    // Возвращаем пустой граф вместо null
    return {
      rootKey: normalizePathForDisplay(path.basename(filePath)),
      graph: {},
    };
  }

  // ✅ НОВОЕ: используем buildCallGraphFromAST для полного графа вызовов
  let callGraphFromAST: Map<string, Set<string>> | null = null;
  try {
    callGraphFromAST = buildCallGraphFromAST(ast);
  } catch (error) {
    console.warn(`⚠️ Ошибка при построении графа вызовов из AST: ${error}`);
  }

  // Поиск связей между объявлениями
  Object.keys(declarations).forEach((currentEntity: string) => {
    const declaration = declarations[currentEntity];
    if (!declaration) return;

    const entityNode = declaration.node;

    // ✅ Используем callGraphFromAST если доступен
    if (callGraphFromAST) {
      const calls = callGraphFromAST.get(currentEntity);
      if (calls) {
        for (const call of calls) {
          if (call !== currentEntity && declarations[call]) {
            relations.push({ from: currentEntity, to: call });
          }
        }
      }
    }

    // ✅ ДОПОЛНИТЕЛЬНО: обход AST для поиска вызовов (как резерв)
    walk(entityNode, {
      enter(node: any) {
        // Если встретили идентификатор (вызов переменной/функции)
        if (node.type === 'Identifier') {
          const name = node.name;
          // Проверяем, ссылается ли он на другое объявление в этом же файле
          if (name !== currentEntity && declarations[name]) {
            // Проверяем, что это не часть объявления
            const parent = node.parent;
            if (
              parent &&
              parent.type !== 'FunctionDeclaration' &&
              parent.type !== 'VariableDeclarator' &&
              parent.type !== 'ClassDeclaration'
            ) {
              relations.push({ from: currentEntity, to: name });
            }
          }
        }

        // ✅ НОВОЕ: прямой поиск CallExpression
        if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
          const name = node.callee.name;
          if (name !== currentEntity && declarations[name]) {
            relations.push({ from: currentEntity, to: name });
          }
        }
      },
    });
  });

  // Формирование графа с нормализованными путями
  const fileGraph: Record<string, string[]> = {};
  Object.keys(declarations).forEach((key: string) => {
    fileGraph[key] = [];
  });

  // ✅ Удаляем дубликаты связей
  const uniqueRelations = new Map<string, Set<string>>();
  for (const rel of relations) {
    if (!uniqueRelations.has(rel.from)) {
      uniqueRelations.set(rel.from, new Set());
    }
    uniqueRelations.get(rel.from)!.add(rel.to);
  }

  for (const [from, toSet] of uniqueRelations) {
    if (fileGraph[from]) {
      fileGraph[from] = Array.from(toSet);
    }
  }

  // ✅ НОРМАЛИЗУЕМ КОРНЕВОЙ КЛЮЧ
  const normalizedRootKey = normalizePathForDisplay(path.basename(filePath));

  // ✅ ЛОГИРУЕМ СТАТИСТИКУ
  const totalFunctions = Object.keys(declarations).filter(
    key => declarations[key]?.type === 'function' || declarations[key]?.type === 'function'
  ).length;
  const totalEdges = relations.length;

  console.log(`   📊 Внутренний граф ${path.basename(filePath)}:`);
  console.log(`      • Функций: ${totalFunctions}`);
  console.log(`      • Связей: ${totalEdges}`);
  console.log(`      • Узлов: ${Object.keys(fileGraph).length}`);

  if (totalEdges === 0 && totalFunctions > 0) {
    console.log(`      ℹ️ Нет связей между функциями (возможно, все функции изолированы)`);
  }

  return {
    rootKey: normalizedRootKey,
    graph: fileGraph,
  };
}
