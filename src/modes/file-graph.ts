// modes/file-graph.ts
import path from 'path';
import { parseFile, walk } from '../core/ast-parser.js';

/**
 * Рекурсивно собирает объявления функций, классов и переменных из AST
 * @param node Текущий узел AST
 * @param declarations Объект для хранения объявлений
 */
function collectDeclarationsRecursive(
  node: any,
  declarations: Record<string, { type: string; node: any }>
): void {
  if (!node || typeof node !== 'object') return;

  // ✅ Обработка экспортов
  if (node.type === 'ExportNamedDeclaration') {
    if (node.declaration) {
      // Рекурсивно обрабатываем declaration
      collectDeclarationsRecursive(node.declaration, declarations);
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
    collectDeclarationsRecursive(child, declarations);
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
  const ast = parseFile(filePath);

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
      rootKey: path.basename(filePath),
      graph: {},
    };
  }

  const declarations: Record<string, { type: string; node: any }> = {};
  const relations: { from: string; to: string }[] = [];

  // Используем рекурсивный сбор объявлений вместо обхода только верхнего уровня
  try {
    collectDeclarationsRecursive(ast, declarations);
  } catch (error) {
    console.warn(`⚠️ Ошибка при сборе объявлений: ${error}`);
    // Возвращаем пустой граф вместо null
    return {
      rootKey: path.basename(filePath),
      graph: {},
    };
  }

  // Поиск связей между объявлениями
  Object.keys(declarations).forEach((currentEntity: string) => {
    const declaration = declarations[currentEntity];
    if (!declaration) return;

    const entityNode = declaration.node;

    walk(entityNode, {
      enter(node: any) {
        // Если встретили идентификатор (вызов переменной/функции)
        if (node.type === 'Identifier') {
          const name = node.name;
          // Проверяем, ссылается ли он на другое объявление в этом же файле
          if (name !== currentEntity && declarations[name]) {
            relations.push({ from: currentEntity, to: name });
          }
        }
      },
    });
  });

  // Формирование графа
  const fileGraph: Record<string, string[]> = {};
  Object.keys(declarations).forEach((key: string) => {
    fileGraph[key] = [];
  });

  relations.forEach((rel: { from: string; to: string }) => {
    const fromGraph = fileGraph[rel.from];
    if (fromGraph && !fromGraph.includes(rel.to)) {
      fromGraph.push(rel.to);
    }
  });

  return {
    rootKey: path.basename(filePath),
    graph: fileGraph,
  };
}
