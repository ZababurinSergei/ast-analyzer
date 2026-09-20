// src/core/entity-extractor/helpers/infer-function-name.ts
// ============================================
// INFERRED NAME ДЛЯ ФУНКЦИЙ (ESTree) — v2.1.0
// ============================================
//
// ИЗМЕНЕНИЯ v2.1.0:
//   - ✅ ДОБАВЛЕНА функция `extractReceiverName` — расширенное
//     извлечение receiver для callback-паттернов:
//       `this.items.map(...)`  → 'items'
//       `this.foo.bar.map(...)` → 'bar'
//       `getItems().filter(...)` → 'getItems'
//       `arr.filter(...).map(...)` → 'filter'
//       `[1,2,3].map(...)`     → 'array'
//       `{a:1}.forEach(...)`   → 'object'
//       `new Foo().map(...)`   → 'Foo'
//       `(await foo()).map(...)` → 'foo'
//   - ✅ УБРАНЫ `map_callback` без receiver — теперь все callback-имена
//     имеют префикс `<receiver>.` (если receiver удалось извлечь).
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - ✅ `map_callback` → `receiver.map_callback` для `arr.map(...)`.
//   - ✅ `anonymous_arrow` → `<enclosingFunc>_arrow` когда есть enclosing.
//   - ✅ Новые ветки: Property (объекты), PropertyDefinition (классы),
//     ExportDefaultDeclaration.
//   - ✅ Сохраняет сигнатуру `inferFunctionName(node, parent) → string`.
//
// Порядок проверок:
//   1. Явное имя (node.id.name)
//   2. const foo = () => {}              → 'foo'
//   3. bar = () => {} / obj.m = () => {} → 'bar' / 'm'
//   4. { onClick: () => {}, bar() {} }   → 'onClick' / 'bar'
//   5. class A { foo = () => {} }        → 'foo'
//   6. export default () => {}            → 'default'
//   7. arr.map(x => ...)                  → 'arr.map_callback'
//      this.items.map(x => ...)           → 'items.map_callback'
//      getItems().filter(x => ...)        → 'getItems.filter_callback'
//   8. return () => {}                    → '<outer>_return'
//   9. Fallback: <enclosing>_arrow / anonymous_arrow
//
// ⚠️ Работает ТОЛЬКО на ESTree AST.
// ============================================

/**
 * Выводит имя функции из контекста AST.
 *
 * Повторяет поведение JS-движка (V8) для inferred name:
 *   const foo = () => {}   →  foo.name === 'foo'
 *
 * @param node   — узел функции (ArrowFunctionExpression | FunctionExpression)
 * @param parent — родительский узел (если есть)
 * @returns выведенное имя функции
 */
export function inferFunctionName(node: any, parent: any): string {
  const kind: 'arrow' | 'function' | 'unknown' =
    node?.type === 'ArrowFunctionExpression'
      ? 'arrow'
      : node?.type === 'FunctionExpression'
        ? 'function'
        : 'unknown';

  // ─────────────────────────────────────────
  // 1. Явное имя (FunctionDeclaration / FunctionExpression с id)
  // ─────────────────────────────────────────
  if (node?.id?.name) return node.id.name;

  if (!parent) {
    return kind === 'arrow' ? 'anonymous_arrow' : 'anonymous_function';
  }

  // ─────────────────────────────────────────
  // 2. const foo = () => {}
  // ─────────────────────────────────────────
  if (parent.type === 'VariableDeclarator' && parent.id?.name) {
    return parent.id.name;
  }

  // ─────────────────────────────────────────
  // 3. bar = () => {}, obj.method = () => {}
  // ─────────────────────────────────────────
  if (parent.type === 'AssignmentExpression') {
    const lhs = parent.left;
    if (lhs?.type === 'Identifier' && lhs.name) {
      return lhs.name;
    }
    if (lhs?.type === 'MemberExpression' && lhs.property) {
      if (lhs.property.type === 'Identifier' && lhs.property.name) {
        return lhs.property.name;
      }
      if (lhs.property.type === 'Literal') {
        return String(lhs.property.value);
      }
    }
  }

  // ─────────────────────────────────────────
  // 4. { onClick: () => {}, bar() {} }
  // ─────────────────────────────────────────
  if (parent.type === 'Property') {
    const key = parent.key;
    if (key?.type === 'Identifier' && key.name) {
      return key.name;
    }
    if (key?.type === 'Literal') {
      return String(key.value);
    }
  }

  // ─────────────────────────────────────────
  // 5. class A { foo = () => {} }
  // ─────────────────────────────────────────
  if (parent.type === 'PropertyDefinition') {
    const key = parent.key;
    if (key?.type === 'Identifier' && key.name) {
      return key.name;
    }
    if (key?.type === 'Literal') {
      return String(key.value);
    }
  }

  // ─────────────────────────────────────────
  // 6. export default () => {}
  // ─────────────────────────────────────────
  if (parent.type === 'ExportDefaultDeclaration') {
    return 'default';
  }

  // ─────────────────────────────────────────
  // 7. ✅ v2.1.0: arr.map(x => ...), arr.filter(...)
  // ─────────────────────────────────────────
  // Расширенное извлечение receiver через `extractReceiverName`:
  //   arr.map(x => x)              → 'arr.map_callback'
  //   this.items.map(x => x)       → 'items.map_callback'
  //   this.foo.bar.map(x => x)     → 'bar.map_callback'
  //   getItems().filter(x => x)    → 'getItems.filter_callback'
  //   arr.filter(...).map(x => x)  → 'filter.map_callback'
  //   [1,2,3].map(x => x)          → 'array.map_callback'
  //   {a:1}.forEach(x => x)        → 'object.forEach_callback'
  //   new Foo().map(x => x)        → 'Foo.map_callback'
  //   (await foo()).map(x => x)    → 'foo.map_callback'
  // ─────────────────────────────────────────
  if (parent.type === 'CallExpression') {
    const callee = parent.callee;
    let callName: string | null = null;
    let receiver: string | null = null;

    if (callee?.type === 'Identifier' && callee.name) {
      callName = callee.name;
    } else if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
      callName = callee.property.name;
      receiver = extractReceiverName(callee.object);
    }

    if (callName) {
      return receiver ? `${receiver}.${callName}_callback` : `${callName}_callback`;
    }
  }

  // ─────────────────────────────────────────
  // 8. return () => {}
  // ─────────────────────────────────────────
  if (parent.type === 'ReturnStatement') {
    const outer = findEnclosingFunctionName(node);
    if (outer) {
      return `${outer}_return`;
    }
  }

  // ─────────────────────────────────────────
  // 9. ✅ v2.0.0: Fallback — используем enclosing, если есть
  // ─────────────────────────────────────────
  const enclosing = findEnclosingFunctionName(node);
  if (enclosing) {
    return `${enclosing}_${kind}`;
  }

  return kind === 'arrow' ? 'anonymous_arrow' : 'anonymous_function';
}

// ============================================
// ✅ v2.1.0: ИЗВЛЕЧЕНИЕ RECEIVER
// ============================================

/**
 * Извлекает «читаемое» имя из receiver выражения вызова метода.
 *
 * Используется в `inferFunctionName` для генерации имени
 * callback-функции с префиксом receiver.
 *
 * ════════════════════════════════════════════════════════════
 * ПОДДЕРЖИВАЕМЫЕ СЛУЧАИ
 * ════════════════════════════════════════════════════════════
 *
 *   arr.map(...)                  → node = Identifier('arr')              → 'arr'
 *   this.items.map(...)           → node = MemberExpression(this.items)   → 'items'
 *   this.foo.bar.map(...)         → node = MemberExpression(this.foo.bar) → 'bar'
 *   getItems().filter(...)        → node = CallExpression(getItems)       → 'getItems'
 *   arr.filter(...).map(...)      → node = CallExpression(arr.filter)     → 'filter'
 *   [1,2,3].map(...)              → node = ArrayExpression                → 'array'
 *   {a:1}.forEach(...)            → node = ObjectExpression               → 'object'
 *   new Foo().map(...)            → node = NewExpression(Foo)             → 'Foo'
 *   (await foo()).map(...)        → node = AwaitExpression(foo)           → 'foo'
 *   `text`.split(...)             → node = TemplateLiteral                → 'template'
 *   cond ? a : b .map(...)        → node = ConditionalExpression          → 'conditional'
 *   this.map(...)                 → node = ThisExpression                 → 'this'
 *
 * ════════════════════════════════════════════════════════════
 * FALLBACK
 * ════════════════════════════════════════════════════════════
 *
 * Если receiver не распознан — возвращается `null`.
 * Тогда `inferFunctionName` вернёт `<callName>_callback` без префикса.
 *
 * @param node — узел receiver (callee.object из MemberExpression)
 * @returns читаемое имя receiver или null
 */
function extractReceiverName(node: any): string | null {
  if (!node) return null;

  switch (node.type) {
    // ─────────────────────────────────────────
    // Identifier: `arr` → 'arr'
    // ─────────────────────────────────────────
    case 'Identifier':
      return node.name || null;

    // ─────────────────────────────────────────
    // ThisExpression: `this` → 'this'
    // ─────────────────────────────────────────
    case 'ThisExpression':
      return 'this';

    // ─────────────────────────────────────────
    // MemberExpression:
    //   `this.items`      → 'items'
    //   `this.foo.bar`    → 'bar'
    //   `obj[0]`          → '0' (Literal в property)
    // ─────────────────────────────────────────
    case 'MemberExpression': {
      if (node.property?.type === 'Identifier' && node.property.name) {
        return node.property.name;
      }
      if (node.property?.type === 'Literal') {
        return String(node.property.value);
      }
      return null;
    }

    // ─────────────────────────────────────────
    // CallExpression:
    //   `getItems()`           → 'getItems'
    //   `arr.filter(...)`      → 'filter'
    //   `obj.getItems()`       → 'getItems'
    // ─────────────────────────────────────────
    case 'CallExpression': {
      const callee = node.callee;
      if (callee?.type === 'Identifier' && callee.name) {
        return callee.name;
      }
      if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
        return callee.property.name;
      }
      return null;
    }

    // ─────────────────────────────────────────
    // AwaitExpression: `await foo()` → 'foo'
    // ─────────────────────────────────────────
    case 'AwaitExpression':
      return extractReceiverName(node.argument);

    // ─────────────────────────────────────────
    // ArrayExpression: `[1,2,3]` → 'array'
    // ─────────────────────────────────────────
    case 'ArrayExpression':
      return 'array';

    // ─────────────────────────────────────────
    // ObjectExpression: `{a:1}` → 'object'
    // ─────────────────────────────────────────
    case 'ObjectExpression':
      return 'object';

    // ─────────────────────────────────────────
    // NewExpression: `new Foo()` → 'Foo'
    // ─────────────────────────────────────────
    case 'NewExpression': {
      const callee = node.callee;
      if (callee?.type === 'Identifier' && callee.name) {
        return callee.name;
      }
      return null;
    }

    // ─────────────────────────────────────────
    // TemplateLiteral: `` `text` `` → 'template'
    // ─────────────────────────────────────────
    case 'TemplateLiteral':
      return 'template';

    // ─────────────────────────────────────────
    // ConditionalExpression: `a ? b : c` → 'conditional'
    // ─────────────────────────────────────────
    case 'ConditionalExpression':
      return 'conditional';

    // ─────────────────────────────────────────
    // Не распознано — возвращаем null
    // ─────────────────────────────────────────
    default:
      return null;
  }
}

// ============================================
// ПОИСК ENCLOSING-ФУНКЦИИ
// ============================================

/**
 * Находит имя ближайшей внешней функции.
 *
 * Используется для вывода имени у `return () => {}`:
 *   const foo = () => { return () => {}; };
 *   → внутренняя стрелка получает имя 'foo_return'
 *
 * @param node — узел внутренней функции
 * @returns имя внешней функции или null
 */
function findEnclosingFunctionName(node: any): string | null {
  let cur = node?.parent;
  let depth = 0;

  while (cur && depth < 100) {
    // Обычные функции и именованные FunctionExpression
    if ((cur.type === 'FunctionDeclaration' || cur.type === 'FunctionExpression') && cur.id?.name) {
      return cur.id.name;
    }

    // Методы классов
    if (cur.type === 'MethodDefinition' && cur.key?.name) {
      return cur.key.name;
    }

    // Стрелка/функция в переменной: const foo = () => ...
    if (cur.type === 'VariableDeclarator' && cur.id?.name) {
      const init = cur.init;
      if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
        return cur.id.name;
      }
    }

    cur = cur.parent;
    depth++;
  }

  return null;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default { inferFunctionName };
