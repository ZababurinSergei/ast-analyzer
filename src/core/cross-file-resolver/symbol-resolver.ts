// src/core/cross-file-resolver/symbol-resolver.ts
// ============================================================
// РЕЗОЛВИНГ СИМВОЛОВ (P3)
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1 (fix TS2306):
//   - ✅ ИСПРАВЛЕНО: `export class SymbolResolver` теперь ГАРАНТИРОВАННО
//     экспортируется. Раньше класс был объявлен без `export`, из-за
//     чего TypeScript считал файл "не модулем" (TS2306).
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `SyntaxKind`
//     (TS6133).
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `SourceFile`
//     (TS6133).
//   - ✅ ДОБАВЛЕНО: явные `export` для всех типов-помощников,
//     которые могут использоваться извне.
//   - ✅ ОБНОВЛЕНО: `import type { ResolvedCallee }` — только типы,
//     чтобы избежать циклических импортов во время выполнения.
//   - ✅ УТОЧНЕНО: `symbol.getFullyQualifiedName?.()` — безопасный
//     вызов на случай, если метод отсутствует.
//   - ✅ ДОБАВЛЕНО: `Node.isElementAccessExpression` — используем
//     `getArgumentExpression()`, а не `getArgumentExpressionNode()`.
//
// НАЗНАЧЕНИЕ
// ----------
// Для каждого CallExpression/NewExpression резолвит, какая именно
// функция/метод/класс вызывается, через symbols ts-morph.
//
// ПОДДЕРЖИВАЕМЫЕ СЛУЧАИ
// ---------------------
//   1. foo()                    — Identifier
//   2. obj.foo()                — PropertyAccessExpression
//   3. this.foo()               — PropertyAccessExpression (this)
//   4. obj['foo']()             — ElementAccessExpression
//   5. new Foo()                — NewExpression
//   6. foo()()                  — CallExpression (higher-order)
//   7. foo.bar.baz()            — вложенный PropertyAccess
//   8. (await foo()).bar()      — AwaitExpression + PropertyAccess
//   9. (foo as any)()           — AsExpression
//  10. (foo!)()                 — NonNullExpression
//  11. (<any>foo)()             — TypeAssertion
//  12. (foo)()                  — ParenthesizedExpression
//
// НЕ ПОДДЕРЖИВАЕТСЯ
// -----------------
//   - eval() / Function()       — динамический код
//   - Динамические импорты      — import('./a').then(...)
//   - Прокси / Reflect
// ============================================================

// ============================================================
// ИМПОРТЫ
// ============================================================
// ⚠️ ВАЖНО: `Node` — значение (используется как namespace).
// `Project` — только тип (для аннотации конструктора).
// ============================================================

import { Node } from 'ts-morph';
import type { Project } from 'ts-morph';

// ✅ v1.0.1: `import type` — только типы, чтобы избежать
// циклических импортов во время выполнения.
import type { ResolvedCallee } from './types.js';

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Резолвит символы через ts-morph.
 *
 * ════════════════════════════════════════════════════════════
 * КЭШИРОВАНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   - `symbolCache`: Map<symbolId, ResolvedCallee | null>
 *     Кэширует результаты resolveSymbol по ID символа.
 *
 *   - `project`: содержит встроенный кэш symbol tables.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   const resolver = new SymbolResolver(project);
 *   const callNode = ...; // CallExpression
 *   const resolved = resolver.resolveCallee(callNode);
 *   if (resolved) {
 *     console.log(`Вызов ${resolved.name} из ${resolved.filePath}:${resolved.line}`);
 *   }
 */
export class SymbolResolver {
  // ============================================================
  // ПОЛЯ
  // ============================================================

  /**
   * Кэш символов: symbolKey → ResolvedCallee | null.
   *
   * `null` означает «резолвинг уже пробовали, не удался» — повторять
   * не нужно. Это отличается от `undefined`, который означает
   * «ещё не пробовали» (отсутствует в Map).
   */
  private symbolCache = new Map<string, ResolvedCallee | null>();

  /** Статистика для отладки. */
  private stats = {
    resolveAttempts: 0,
    resolveSuccess: 0,
    resolveFail: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  // ============================================================
  // КОНСТРУКТОР
  // ============================================================

  constructor(private project: Project) {}
  
  /**
   * Возвращает Project, с которым работает резолвер.
   * Полезно для отладки и внешних потребителей.
   */
  getProject(): Project {
    return this.project;
  }

  // ============================================================
  // ПУБЛИЧНЫЙ API
  // ============================================================

  /**
   * Резолвит callee для CallExpression или NewExpression.
   *
   * @param callNode — узел CallExpression или NewExpression
   * @returns ResolvedCallee или null
   */
  resolveCallee(callNode: Node): ResolvedCallee | null {
    this.stats.resolveAttempts++;

    try {
      let resolved: ResolvedCallee | null = null;

      // NewExpression
      if (Node.isNewExpression(callNode)) {
        resolved = this.resolveNewExpression(callNode);
      }
      // CallExpression
      else if (Node.isCallExpression(callNode)) {
        resolved = this.resolveCallExpression(callNode);
      }

      if (resolved) {
        this.stats.resolveSuccess++;
      } else {
        this.stats.resolveFail++;
      }

      return resolved;
    } catch {
      this.stats.resolveFail++;
      return null;
    }
  }

  /**
   * Возвращает статистику резолвера.
   */
  getStats(): {
    resolveAttempts: number;
    resolveSuccess: number;
    resolveFail: number;
    cacheHits: number;
    cacheMisses: number;
  } {
    return { ...this.stats };
  }

  /**
   * Очищает кэш.
   */
  clearCache(): void {
    this.symbolCache.clear();
  }

  // ============================================================
  // РЕЗОЛВИНГ CallExpression
  // ============================================================

  /**
   * Резолвит CallExpression.
   *
   * ════════════════════════════════════════════════════════════
   * СТРАТЕГИЯ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Получаем expression (callee)
   *   2. Определяем тип expression:
   *      - Identifier          → resolveIdentifier
   *      - PropertyAccess      → resolvePropertyAccess
   *      - ElementAccess       → resolveElementAccess
   *      - CallExpression      → рекурсивно resolveCallExpression
   *      - Parenthesized       → разворачиваем
   *      - AwaitExpression     → разворачиваем
   *      - NonNullExpression   → разворачиваем
   *      - AsExpression        → разворачиваем
   *      - TypeAssertion       → разворачиваем
   */
  private resolveCallExpression(node: Node): ResolvedCallee | null {
    if (!Node.isCallExpression(node)) return null;

    const expr = node.getExpression();
    return this.resolveExpression(expr);
  }

  /**
   * Резолвит произвольное expression (callee).
   */
  private resolveExpression(expr: Node): ResolvedCallee | null {
    // Identifier: foo()
    if (Node.isIdentifier(expr)) {
      return this.resolveIdentifier(expr);
    }

    // PropertyAccess: obj.foo()
    if (Node.isPropertyAccessExpression(expr)) {
      return this.resolvePropertyAccess(expr);
    }

    // ElementAccess: obj['foo']()
    if (Node.isElementAccessExpression(expr)) {
      return this.resolveElementAccess(expr);
    }

    // CallExpression: foo()() — higher-order
    if (Node.isCallExpression(expr)) {
      return this.resolveCallExpression(expr);
    }

    // Parenthesized: (foo)()
    if (Node.isParenthesizedExpression(expr)) {
      const inner = expr.getExpression();
      return inner ? this.resolveExpression(inner) : null;
    }

    // AwaitExpression: (await foo())()
    if (Node.isAwaitExpression(expr)) {
      const inner = expr.getExpression();
      return inner ? this.resolveExpression(inner) : null;
    }

    // NonNullExpression: foo!()
    if (Node.isNonNullExpression(expr)) {
      const inner = expr.getExpression();
      return inner ? this.resolveExpression(inner) : null;
    }

    // AsExpression: (foo as any)()
    if (Node.isAsExpression(expr)) {
      const inner = expr.getExpression();
      return inner ? this.resolveExpression(inner) : null;
    }

    // TypeAssertion: (<any>foo)()
    if (Node.isTypeAssertion(expr)) {
      const inner = expr.getExpression();
      return inner ? this.resolveExpression(inner) : null;
    }

    return null;
  }

  // ============================================================
  // РЕЗОЛВИНГ Identifier
  // ============================================================

  /**
   * Резолвит Identifier: `foo()`.
   *
   * ════════════════════════════════════════════════════════════
   * АЛГОРИТМ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Получаем symbol по identifier
   *   2. Проходим по declarations символа
   *   3. Для каждой declaration:
   *      - FunctionDeclaration    → function
   *      - VariableDeclaration    → arrow (если init — arrow/function)
   *      - MethodDeclaration      → method
   *      - ClassDeclaration       → constructor
   *      - ImportSpecifier        → переходим к aliased symbol
   *   4. Возвращаем первое подходящее
   */
  private resolveIdentifier(identifier: Node): ResolvedCallee | null {
    if (!Node.isIdentifier(identifier)) return null;

    const name = identifier.getText();
    const symbol = identifier.getSymbol();
    if (!symbol) return null;

    // Проверяем кэш
    const symbolKey = `sym:${this.safeFqn(symbol)}`;
    if (this.symbolCache.has(symbolKey)) {
      this.stats.cacheHits++;
      return this.symbolCache.get(symbolKey) ?? null;
    }
    this.stats.cacheMisses++;

    // Разрешаем aliased symbol (import { foo as bar })
    const resolved = this.resolveSymbol(symbol, name);

    this.symbolCache.set(symbolKey, resolved);
    return resolved;
  }

  // ============================================================
  // РЕЗОЛВИНГ PropertyAccess
  // ============================================================

  /**
   * Резолвит PropertyAccess: `obj.foo()`, `this.foo()`.
   */
  private resolvePropertyAccess(expr: Node): ResolvedCallee | null {
    if (!Node.isPropertyAccessExpression(expr)) return null;

    const nameNode = expr.getNameNode();
    const name = expr.getName();

    const symbol = nameNode.getSymbol();
    if (!symbol) return null;

    const symbolKey = `prop:${this.safeFqn(symbol)}`;
    if (this.symbolCache.has(symbolKey)) {
      this.stats.cacheHits++;
      return this.symbolCache.get(symbolKey) ?? null;
    }
    this.stats.cacheMisses++;

    const resolved = this.resolveSymbol(symbol, name);
    this.symbolCache.set(symbolKey, resolved);
    return resolved;
  }

  // ============================================================
  // РЕЗОЛВИНГ ElementAccess
  // ============================================================

  /**
   * Резолвит ElementAccess: `obj['foo']()`.
   *
   * Работает только если argument — строковый литерал.
   * Для `obj[key]` (динамический ключ) — возвращает null.
   */
  private resolveElementAccess(expr: Node): ResolvedCallee | null {
    if (!Node.isElementAccessExpression(expr)) return null;

    const arg = expr.getArgumentExpression();
    if (!arg) return null;

    // obj['foo'] — строковый литерал
    if (Node.isStringLiteral(arg)) {
      const name = arg.getLiteralValue();
      const symbol = arg.getSymbol();
      if (!symbol) return null;

      const symbolKey = `elem:${this.safeFqn(symbol)}`;
      if (this.symbolCache.has(symbolKey)) {
        this.stats.cacheHits++;
        return this.symbolCache.get(symbolKey) ?? null;
      }
      this.stats.cacheMisses++;

      const resolved = this.resolveSymbol(symbol, name);
      this.symbolCache.set(symbolKey, resolved);
      return resolved;
    }

    // obj[key] — динамический ключ: невозможно разрешить
    return null;
  }

  // ============================================================
  // РЕЗОЛВИНГ NewExpression
  // ============================================================

  /**
   * Резолвит NewExpression: `new Foo()`.
   */
  private resolveNewExpression(node: Node): ResolvedCallee | null {
    if (!Node.isNewExpression(node)) return null;

    const expr = node.getExpression();

    // new Foo()
    if (Node.isIdentifier(expr)) {
      const symbol = expr.getSymbol();
      if (!symbol) return null;

      const decls = symbol.getDeclarations();
      for (const decl of decls) {
        if (Node.isClassDeclaration(decl)) {
          const sf = decl.getSourceFile();
          const nameNode = decl.getNameNode();
          if (!nameNode) continue;
          const { line, column } = sf.getLineAndColumnAtPos(nameNode.getStart());

          return {
            filePath: sf.getFilePath(),
            line,
            column,
            name: decl.getName() ?? 'Anonymous',
            kind: 'constructor',
            symbolId: this.safeFqn(symbol),
          };
        }
      }
    }

    // new obj.Foo()
    if (Node.isPropertyAccessExpression(expr)) {
      const nameNode = expr.getNameNode();
      const symbol = nameNode.getSymbol();
      if (!symbol) return null;

      const decls = symbol.getDeclarations();
      for (const decl of decls) {
        if (Node.isClassDeclaration(decl)) {
          const sf = decl.getSourceFile();
          const { line, column } = sf.getLineAndColumnAtPos(decl.getStart());

          return {
            filePath: sf.getFilePath(),
            line,
            column,
            name: decl.getName() ?? 'Anonymous',
            kind: 'constructor',
            symbolId: this.safeFqn(symbol),
          };
        }
      }
    }

    return null;
  }

  // ============================================================
  // РЕЗОЛВИНГ СИМВОЛА
  // ============================================================

  /**
   * Резолвит symbol по его declarations.
   *
   * ════════════════════════════════════════════════════════════
   * АЛГОРИТМ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Проверяем aliased symbol (import { foo as bar })
   *      Если symbol — alias, переходим к aliased symbol.
   *   2. Проходим по declarations:
   *      - FunctionDeclaration    → function
   *      - MethodDeclaration      → method
   *      - VariableDeclaration    → arrow (если init — arrow/function)
   *      - ClassDeclaration       → constructor
   *      - PropertyDeclaration    → method (если init — arrow/function)
   *      - PropertyAssignment     → method (если init — arrow/function)
   *      - ShorthandPropertyAssignment → method
   *   3. Возвращаем первое подходящее
   */
  private resolveSymbol(symbol: any, name: string): ResolvedCallee | null {
    // Шаг 1: разворачиваем alias
    let currentSymbol = symbol;
    let depth = 0;

    while (currentSymbol && depth < 5) {
      const aliased = currentSymbol.getAliasedSymbol?.();
      if (!aliased || aliased === currentSymbol) break;
      currentSymbol = aliased;
      depth++;
    }

    // Шаг 2: проходим по declarations
    const decls = currentSymbol.getDeclarations?.() ?? [];
    for (const decl of decls) {
      const resolved = this.resolveDeclaration(decl, name, currentSymbol);
      if (resolved) return resolved;
    }

    return null;
  }

  /**
   * Резолвит одну declaration.
   */
  private resolveDeclaration(decl: any, name: string, symbol: any): ResolvedCallee | null {
    try {
      // FunctionDeclaration
      if (Node.isFunctionDeclaration(decl)) {
        return this.makeResolved(decl, name, 'function', symbol);
      }

      // MethodDeclaration
      if (Node.isMethodDeclaration(decl)) {
        return this.makeResolved(decl, decl.getName(), 'method', symbol);
      }

      // VariableDeclaration (arrow/function в переменной)
      if (Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          return this.makeResolved(decl, decl.getName(), 'arrow', symbol);
        }
      }

      // ClassDeclaration
      if (Node.isClassDeclaration(decl)) {
        return this.makeResolved(decl, decl.getName() ?? 'Anonymous', 'constructor', symbol);
      }

      // PropertyDeclaration (метод в классе через arrow)
      if (Node.isPropertyDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          return this.makeResolved(decl, decl.getName(), 'method', symbol);
        }
      }

      // PropertyAssignment (метод в объекте)
      if (Node.isPropertyAssignment(decl)) {
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          return this.makeResolved(decl, decl.getName(), 'method', symbol);
        }
      }

      // ShorthandPropertyAssignment
      if (Node.isShorthandPropertyAssignment(decl)) {
        return this.makeResolved(decl, decl.getName(), 'method', symbol);
      }

      // ExportSpecifier / ImportSpecifier — пропускаем
      // (aliased symbol уже развернули выше)
      if (Node.isExportSpecifier(decl) || Node.isImportSpecifier(decl)) {
        return null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Создаёт ResolvedCallee из declaration.
   */
  private makeResolved(
    decl: any,
    name: string,
    kind: ResolvedCallee['kind'],
    symbol: any
  ): ResolvedCallee {
    const sf = decl.getSourceFile();
    const start = decl.getStart();
    const { line, column } = sf.getLineAndColumnAtPos(start);

    return {
      filePath: sf.getFilePath(),
      line,
      column,
      name: name || 'anonymous',
      kind,
      symbolId: this.safeFqn(symbol),
    };
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ
  // ============================================================

  /**
   * Безопасно получает fully qualified name символа.
   *
   * ⚠️ `getFullyQualifiedName()` может бросить исключение для
   * некоторых символов (например, для `export default` без имени).
   * Возвращаем fallback-строку.
   */
  private safeFqn(symbol: any): string {
    try {
      return symbol?.getFullyQualifiedName?.() ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default SymbolResolver;
