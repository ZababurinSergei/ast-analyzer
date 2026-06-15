// core/minifier.ts
import fs from 'fs';
import { parseFile } from './ast-parser.js';

/**
 * Рекурсивно собирает все узлы из AST, включая вложенные в блоки
 */
function collectAllNodes(ast: any): any[] {
  const allNodes: any[] = [];

  function traverse(node: any) {
    if (!node) return;
    allNodes.push(node);

    // Рекурсивно обходим все дочерние узлы
    if (node.body && Array.isArray(node.body)) {
      node.body.forEach(traverse);
    }
    if (node.consequent) traverse(node.consequent);
    if (node.alternate) traverse(node.alternate);
    if (node.blockStatement) traverse(node.blockStatement);
    if (node.declaration) traverse(node.declaration);
    if (node.init) traverse(node.init);
    if (node.test) traverse(node.test);
    if (node.update) traverse(node.update);

    // Обходим свойства объекта
    if (node.properties && Array.isArray(node.properties)) {
      node.properties.forEach((prop: any) => {
        if (prop.value) traverse(prop.value);
        if (prop.key) traverse(prop.key);
      });
    }

    // Обходим элементы массива
    if (node.elements && Array.isArray(node.elements)) {
      node.elements.forEach(traverse);
    }
  }

  traverse(ast);
  return allNodes;
}

/**
 * Сжимает код, заменяя тела функций и значения переменных на плейсхолдеры
 * @param code Исходный код
 * @param ast AST дерево (опционально, если не передан - будет пропущен)
 * @returns Сжатая версия кода (только сигнатуры)
 */
export function minifyCodeString(code: string, ast: any): string {
  if (!ast) {
    console.warn('⚠️ AST is null, returning original code');
    return code;
  }

  const cuts: { start: number; end: number; replaceWith: string }[] = [];

  // Собираем все узлы рекурсивно
  const allNodes = collectAllNodes(ast);
  console.log(`📊 Собрано узлов для обработки: ${allNodes.length}`);

  for (const node of allNodes) {
    // Замена тел функций и методов
    if (
      (node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'MethodDefinition' ||
        node.type === 'ClassMethod') &&
      node.body &&
      node.body.range
    ) {
      const bodyStart = node.body.range[0];
      const bodyEnd = node.body.range[1];

      if (bodyStart < bodyEnd && bodyEnd - bodyStart > 2) {
        cuts.push({
          start: bodyStart + 1,
          end: bodyEnd - 1,
          replaceWith: ' /* реализация скрыта */ ',
        });
        const nodeName = node.key?.name || node.id?.name || 'anonymous';
        console.log(`   ✂️ Найдена функция/метод: ${nodeName}`);
      }
    }

    // Замена тел стрелочных функций
    if (
      node.type === 'ArrowFunctionExpression' &&
      node.body &&
      node.body.type === 'BlockStatement' &&
      node.body.range
    ) {
      const bodyStart = node.body.range[0];
      const bodyEnd = node.body.range[1];

      if (bodyStart < bodyEnd && bodyEnd - bodyStart > 2) {
        cuts.push({
          start: bodyStart + 1,
          end: bodyEnd - 1,
          replaceWith: ' /* реализация скрыта */ ',
        });
      }
    }

    // Замена значений переменных
    if (
      node.type === 'VariableDeclarator' &&
      node.init &&
      !['ArrowFunctionExpression', 'FunctionExpression'].includes(node.init.type) &&
      node.init.range
    ) {
      if (!shouldPreserveValue(node)) {
        cuts.push({
          start: node.init.range[0],
          end: node.init.range[1],
          replaceWith: '/* значение скрыто */',
        });
        console.log(`   🔒 Переменная: ${node.id?.name} → значение скрыто`);
      } else {
        console.log(`   ✅ Сохранена переменная: ${node.id?.name}`);
      }
    }
  }

  // Применяем замены от конца к началу
  cuts.sort((a, b) => b.start - a.start);
  let minifiedCode = code;

  for (const cut of cuts) {
    minifiedCode = minifiedCode.slice(0, cut.start) + cut.replaceWith + minifiedCode.slice(cut.end);
  }

  console.log(`📊 Выполнено замен: ${cuts.length}`);

  // Очистка лишних пустых строк
  return minifiedCode.replace(/^\s*[\r\n]/gm, '\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Определяет, нужно ли сохранить значение переменной
 */
function shouldPreserveValue(node: any): boolean {
  if (!node.init || !node.id || !node.id.name) return false;

  const varName = node.id.name;
  const initNode = node.init;

  // Сохраняем конфигурационные переменные
  const preservePatterns = [
    /^[A-Z][A-Z_]+$/, // UPPER_CASE
    /PATTERNS$/,
    /SELECTORS$/,
    /CONFIG$/,
    /SETTINGS$/,
    /OPTIONS$/,
    /_CONFIG$/,
    /_SETTINGS$/,
    /_OPTIONS$/,
    /^pageContext$/,
    /^lastPageState$/,
    /^lastParentFrameState$/,
    /^syncScheduled$/,
  ];

  for (const pattern of preservePatterns) {
    if (pattern.test(varName)) {
      return true;
    }
  }

  // Сохраняем регулярные выражения
  if (initNode.type === 'RegExpLiteral') {
    return true;
  }

  // Сохраняем массивы с селекторами или паттернами
  if (initNode.type === 'ArrayExpression' && initNode.elements) {
    for (const element of initNode.elements) {
      if (!element) continue;
      if (element.type === 'RegExpLiteral') return true;
      if (element.type === 'Literal' && typeof element.value === 'string') {
        const strValue = element.value;
        if (
          strValue.startsWith('#') ||
          strValue.startsWith('.') ||
          strValue.startsWith('[') ||
          strValue.includes('selector') ||
          strValue.includes('pattern')
        ) {
          return true;
        }
      }
    }
  }

  // Сохраняем примитивные значения (строки, числа, булевы)
  if (initNode.type === 'Literal') {
    return true;
  }

  return false;
}

/**
 * Сжимает файл для отправки в ИИ
 */
export function minifyForAI(filePath: string): string {
  console.log(`📄 Минификация файла: ${filePath}`);

  const code = fs.readFileSync(filePath, 'utf-8');
  console.log(`📏 Исходный размер: ${code.length} символов`);

  const ast = parseFile(filePath);
  if (!ast) {
    console.error('❌ Не удалось получить AST, возвращаем оригинальный код');
    return code;
  }

  // Проверяем, что AST содержит все тело программы
  if (ast.body) {
    console.log(`📊 AST содержит ${ast.body.length} узлов верхнего уровня`);
  }

  const minified = minifyCodeString(code, ast);
  console.log(`✅ Размер после минификации: ${minified.length} символов`);
  console.log(`📉 Сжатие: ${((1 - minified.length / code.length) * 100).toFixed(1)}%`);

  return minified;
}
