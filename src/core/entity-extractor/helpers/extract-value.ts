// packages/ast-analyzer/src/core/entity-extractor/helpers/extract-value.ts
// ============================================
// ИЗВЛЕЧЕНИЕ ЗНАЧЕНИЯ ИЗ AST-УЗЛА
// ============================================
// Версия: 1.0.2
//
// ИЗМЕНЕНИЯ v1.0.2:
//   - ✅ ИСПРАВЛЕНО: FunctionExpression / ArrowFunctionExpression
//     возвращают undefined (а не строку '[Function]').
//     Это уменьшает valueDict: функции не сериализуются.
//   - ✅ ИСПРАВЛЕНО: ObjectExpression не добавляет поля
//     со значением undefined (фильтрация).
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: BigInt → строка в ветке Literal.
//     Нативный JSON.stringify падает с ошибкой
//     "TypeError: Do not know how to serialize a BigInt",
//     если в данных есть BigInt-значение (например, из литерала `123n`).
//     Теперь `extractValue` возвращает строку для BigInt.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация извлечения значений из узлов AST.
// ============================================

/**
 * Извлекает значение из узла AST.
 *
 * Поддерживает:
 *   - Literal           → примитив (string/number/boolean/null)
 *   - Literal (BigInt)  → строка (иначе JSON.stringify упадёт)
 *   - Identifier        → имя идентификатора
 *   - UnaryExpression   → `-value`, `+value`, `!value`, `~value`
 *   - BinaryExpression  → `left op right`
 *   - ArrayExpression   → массив значений
 *   - ObjectExpression  → объект
 *   - ArrowFunction / FunctionExpression → undefined (не сериализуется)
 *   - TemplateLiteral   → конкатенация строк
 *   - NewExpression     → `new Callee()`
 *
 * @param node — AST-узел
 * @returns извлечённое значение (примитив, строка, массив, объект)
 *          или `undefined`, если значение не удалось извлечь
 *
 * @example
 * ```typescript
 * extractValue({ type: 'Literal', value: 42 })      // → 42
 * extractValue({ type: 'Literal', value: 42n })     // → '42'  (BigInt → строка)
 * extractValue({ type: 'Literal', value: 'hello' }) // → 'hello'
 * extractValue({ type: 'Identifier', name: 'foo' }) // → 'foo'
 * ```
 */
export function extractValue(node: any): any {
  if (!node) return undefined;

  // ─────────────────────────────────────────────
  // Literal: строка, число, boolean, null, BigInt
  // ─────────────────────────────────────────────
  if (node.type === 'Literal') {
    // ✅ ИСПРАВЛЕНО: BigInt → строка.
    // Нативный JSON.stringify падает с ошибкой:
    //   TypeError: Do not know how to serialize a BigInt
    if (typeof node.value === 'bigint') {
      return node.value.toString();
    }
    return node.value;
  }

  // ─────────────────────────────────────────────
  // Identifier: имя переменной/функции
  // ─────────────────────────────────────────────
  if (node.type === 'Identifier') {
    return node.name;
  }

  // ─────────────────────────────────────────────
  // UnaryExpression: -value, +value, !value, ~value
  // ─────────────────────────────────────────────
  if (node.type === 'UnaryExpression') {
    const argValue = extractValue(node.argument);
    // ✅ BigInt уже превращён в строку в extractValue, поэтому
    //    шаблонная строка сработает без ошибок.
    return `${node.operator}${argValue}`;
  }

  // ─────────────────────────────────────────────
  // BinaryExpression: left op right
  // ─────────────────────────────────────────────
  if (node.type === 'BinaryExpression') {
    return `${extractValue(node.left)} ${node.operator} ${extractValue(node.right)}`;
  }

  // ─────────────────────────────────────────────
  // ArrayExpression: [a, b, c]
  // ─────────────────────────────────────────────
  if (node.type === 'ArrayExpression') {
    if (Array.isArray(node.elements)) {
      return node.elements.map((e: any) => extractValue(e)).filter((v: any) => v !== undefined);
    }
    return [];
  }

  // ─────────────────────────────────────────────
  // ObjectExpression: { key: value }
  // ─────────────────────────────────────────────
  if (node.type === 'ObjectExpression') {
    const obj: Record<string, any> = {};
    if (Array.isArray(node.properties)) {
      for (const prop of node.properties) {
        if (prop.type === 'Property' && prop.key) {
          const key = prop.key.name || prop.key.value;
          if (key !== undefined) {
            const val = extractValue(prop.value);
            // ✅ v1.0.2: не добавляем поля со значением undefined
            if (val !== undefined) {
              obj[key] = val;
            }
          }
        }
      }
    }
    return obj;
  }

  // ─────────────────────────────────────────────
  // ✅ v1.0.2: ArrowFunctionExpression / FunctionExpression
  // ─────────────────────────────────────────────
  // Раньше возвращалось '[Function]' — это мусор в valueDict.
  // Теперь возвращаем undefined → поле не сериализуется.
  // ─────────────────────────────────────────────
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return undefined;
  }

  // ─────────────────────────────────────────────
  // TemplateLiteral: `text ${expr} text`
  // ─────────────────────────────────────────────
  if (node.type === 'TemplateLiteral') {
    if (Array.isArray(node.quasis)) {
      return node.quasis.map((q: any) => q.value?.raw || '').join('');
    }
    return '';
  }

  // ─────────────────────────────────────────────
  // NewExpression: new Callee()
  // ─────────────────────────────────────────────
  if (node.type === 'NewExpression') {
    return `new ${node.callee?.name || '...'}()`;
  }

  // ─────────────────────────────────────────────
  // Не удалось извлечь — возвращаем undefined
  // ─────────────────────────────────────────────
  return undefined;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default extractValue;
