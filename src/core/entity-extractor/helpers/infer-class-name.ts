// src/core/entity-extractor/helpers/infer-class-name.ts
// ============================================================
// ВЫВОД ИМЕНИ КЛАССА (для устранения Anonymous/AnonymousClass)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Единая точка вывода имени класса для всех мест проекта:
//   - extract-entities-from-ast.ts  (handleMethodDefinition, handleClassDeclaration)
//   - ast-parser.ts                 (extractFunctionsFromAST)
//   - cross-file-resolver/symbol-resolver.ts (resolveNewExpression, resolveDeclaration)
//
// Гарантирует СОГЛАСОВАННОСТЬ: один и тот же класс во всех
// трёх файлах получает одинаковое имя.
//
// ПРИОРИТЕТ
// ---------
//   1. Явное имя класса:
//      - ts-morph: classNode.getName()
//      - ESTree:   classNode.id?.name
//
//   2. Имя из контекста:
//      - const Foo = class {}           → 'Foo'
//      - Foo = class {}                 → 'Foo'
//      - Foo.bar = class {}             → 'bar'
//      - export default class {}        → 'DefaultExport'
//
//   3. Имя модуля из filePath:
//      - /path/to/auto-fixer.ts         → 'auto-fixer'
//      - /path/to/auto-fixer/index.ts   → 'auto-fixer' (имя папки)
//      - /path/to/Foo.vue               → 'Foo'
//
//   4. Последний fallback:
//      - 'AnonymousClass'
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ МОДУЛЬ, А НЕ 'AnonymousClass'
// ════════════════════════════════════════════════════════════
//
// Когда класс реально анонимный (`export default class extends Base {}`),
// пользователю важно понять, ГДЕ живёт метод. Имя модуля даёт
// ровно эту информацию: `auto-fixer.methodName` читается как
// «метод methodName из модуля auto-fixer».
//
// 'AnonymousClass.methodName' не даёт ничего — непонятно ни где,
// ни что за класс.
// ============================================================

import path from 'path';

// ============================================================
// ПУБЛИЧНЫЙ API
// ============================================================

/**
 * Выводит имя класса по узлу и (опционально) пути к файлу.
 *
 * Работает как с ts-morph Node, так и с plain ESTree-узлами.
 * Проверки построены на duck-typing, чтобы не тянуть зависимости.
 *
 * @param classNode — узел класса (ClassDeclaration / ClassExpression)
 * @param filePath  — путь к файлу (для fallback на имя модуля)
 * @returns имя класса (никогда не пустое)
 *
 * @example
 *   // const Foo = class { bar() {} }
 *   inferClassName(classNode, '/src/Foo.ts')
 *   // → 'Foo'
 *
 *   // export default class extends Base { bar() {} }
 *   inferClassName(classNode, '/src/auto-fixer.ts')
 *   // → 'DefaultExport'
 *
 *   // class extends Base { bar() {} }  (no name, no context)
 *   inferClassName(classNode, '/src/auto-fixer.ts')
 *   // → 'auto-fixer'
 *
 *   // class extends Base { bar() {} }  (no name, no context, no file)
 *   inferClassName(classNode)
 *   // → 'AnonymousClass'
 */
export function inferClassName(classNode: any, filePath?: string): string {
  // Шаг 1: явное имя класса
  const explicit = explicitName(classNode);
  if (explicit) return explicit;

  // Шаг 2: имя из контекста
  const fromContext = nameFromContext(classNode);
  if (fromContext) return fromContext;

  // Шаг 3: имя модуля из пути
  const fromFile = nameFromFile(filePath);
  if (fromFile) return fromFile;

  // Шаг 4: последний fallback
  return 'AnonymousClass';
}

/**
 * Удобный вариант: выводит имя класса, если узел — класс,
 * иначе возвращает null. Не бросает, не падает на null/undefined.
 */
export function tryInferClassName(classNode: any, filePath?: string): string | null {
  if (!classNode || typeof classNode !== 'object') return null;
  const name = inferClassName(classNode, filePath);
  return name === 'AnonymousClass' ? null : name;
}

// ============================================================
// ВНУТРЕННИЕ ФУНКЦИИ
// ============================================================

/**
 * Шаг 1: явное имя класса.
 *
 * ts-morph ClassDeclaration → .getName()
 * ESTree ClassDeclaration   → .id.name
 */
function explicitName(classNode: any): string | null {
  if (!classNode) return null;

  // ts-morph: getName() — метод
  if (typeof classNode.getName === 'function') {
    try {
      const n = classNode.getName();
      if (n && typeof n === 'string') return n;
    } catch {
      // getName() может бросить на некоторых узлах — игнорируем
    }
  }

  // ESTree / plain AST: id.name
  if (classNode.id?.name && typeof classNode.id.name === 'string') {
    return classNode.id.name;
  }

  return null;
}

/**
 * Шаг 2: имя из контекста объявления.
 *
 * Поддерживает:
 *   const Foo = class {}        → 'Foo'
 *   Foo = class {}              → 'Foo'
 *   Foo.bar = class {}          → 'bar'
 *   export default class {}     → 'DefaultExport'
 */
function nameFromContext(classNode: any): string | null {
  if (!classNode) return null;

  // Получаем родителя: ts-morph getParent() или ESTree .parent
  let parent: any = null;
  if (typeof classNode.getParent === 'function') {
    try {
      parent = classNode.getParent();
    } catch {
      parent = null;
    }
  }
  if (!parent && classNode.parent) {
    parent = classNode.parent;
  }
  if (!parent) return null;

  // Определяем «вид» родителя — ts-morph даёт getKindName(),
  // ESTree — .type.
  const parentKind: string =
    (typeof parent.getKindName === 'function' ? parent.getKindName() : null) ?? parent.type ?? '';

  // const Foo = class {} / let Foo = class {}
  if (parentKind === 'VariableDeclaration' || parentKind === 'VariableDeclarator') {
    const name = nameFromVariableDeclarator(parent);
    if (name) return name;
  }

  // Foo = class {}
  if (parentKind === 'AssignmentExpression') {
    const name = nameFromAssignment(parent);
    if (name) return name;
  }

  // export default class {}
  if (parentKind === 'ExportAssignment' || parentKind === 'ExportDefaultDeclaration') {
    return 'DefaultExport';
  }

  // export class {} (named export без имени) — не даём имя здесь,
  // пусть решает nameFromFile. Это соответствует ОБЫЧНОЙ практике:
  // анонимный named export класса практически не встречается.
  return null;
}

/**
 * Извлекает имя из VariableDeclarator.
 *
 * ts-morph: parent.getNameNode() → Identifier
 * ESTree:   parent.id           → Identifier
 */
function nameFromVariableDeclarator(parent: any): string | null {
  // ts-morph
  if (typeof parent.getNameNode === 'function') {
    try {
      const nameNode = parent.getNameNode();
      if (nameNode) {
        const text = typeof nameNode.getText === 'function' ? nameNode.getText() : null;
        if (text) return text;
      }
    } catch {
      // ignore
    }
  }

  // ESTree
  if (parent.id?.name && typeof parent.id.name === 'string') {
    return parent.id.name;
  }

  return null;
}

/**
 * Извлекает имя из AssignmentExpression.
 *
 *   Foo = class {}
 *   Foo.bar = class {}
 *   this.Foo = class {}
 */
function nameFromAssignment(parent: any): string | null {
  let left: any = null;

  // ts-morph: getLeft()
  if (typeof parent.getLeft === 'function') {
    try {
      left = parent.getLeft();
    } catch {
      left = null;
    }
  }
  if (!left) {
    left = parent.left;
  }
  if (!left) return null;

  const leftKind: string =
    (typeof left.getKindName === 'function' ? left.getKindName() : null) ?? left.type ?? '';

  // Foo = class {}
  if (leftKind === 'Identifier') {
    // ts-morph: getText(); ESTree: .name
    const text = typeof left.getText === 'function' ? left.getText() : left.name;
    if (text && typeof text === 'string') return text;
  }

  // Foo.bar = class {}
  if (leftKind === 'PropertyAccessExpression' || leftKind === 'MemberExpression') {
    // ts-morph: getName()
    if (typeof left.getName === 'function') {
      try {
        const n = left.getName();
        if (n) return n;
      } catch {
        // ignore
      }
    }
    // ESTree: property.name / property.value
    if (left.property?.name) return left.property.name;
    if (left.property?.value !== undefined) {
      return String(left.property.value);
    }
  }

  return null;
}

/**
 * Шаг 3: имя модуля из пути к файлу.
 *
 *   /path/to/auto-fixer.ts        → 'auto-fixer'
 *   /path/to/auto-fixer/index.ts  → 'auto-fixer'  (имя папки)
 *   /path/to/Foo.vue              → 'Foo'
 *   /path/to/MyComponent.tsx      → 'MyComponent'
 *
 * Если извлечь имя не удалось — возвращает null.
 */
function nameFromFile(filePath?: string): string | null {
  if (!filePath || typeof filePath !== 'string') return null;

  // Отрезаем расширение
  const base = path.basename(filePath).replace(/\.(ts|tsx|js|jsx|mjs|cjs|vue|mts|cts)$/i, '');

  if (!base) return null;

  // index.ts / index.tsx / index.js / index.vue → имя папки
  if (base === 'index') {
    const dir = path.basename(path.dirname(filePath));
    if (dir && dir !== '.' && dir !== '/' && dir !== '\\') {
      return dir;
    }
    // Если папка не определяется — не даём имя, вернём null,
    // чтобы сработал финальный fallback 'AnonymousClass'.
    return null;
  }

  return base;
}
