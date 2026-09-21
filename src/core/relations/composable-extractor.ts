// src/core/relations/composable-extractor.ts
// ============================================================
// МОДУЛЬ 5: ИЗВЛЕЧЕНИЕ COMPOSABLES
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `SyntaxKind`
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `CallExpression`
//   - ✅ ИСПРАВЛЕНО: extractReturnedKeys — Node.isGetAccessor /
//     Node.isSetAccessor НЕ существуют в ts-morph.
//     Используются Node.isGetAccessorDeclaration /
//     Node.isSetAccessorDeclaration.
//   - ✅ ИСПРАВЛЕНО: Node.getName() не существует на union-типах —
//     используется Node.isPropertyAssignment guard.
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый параметр `line` из ReturnedKey
//     (оставлен — он нужен, но теперь всегда через sourceFile.getLineAndColumnAtPos)
//   - ✅ ИСПРАВЛЕНО: findFunctionByName возвращает Node | null —
//     корректная обработка в extractComposableReturns
// ============================================================

import { Node, type SourceFile } from 'ts-morph';

import type { ComposableInfo, ReturnedKey, ReturnedKind, LocalBinding } from './types.js';

// ============================================================
// ИЗВЛЕЧЕНИЕ RETURNED-KEYS ИЗ COMPOSABLE
// ============================================================

/**
 * Для функции `useXxx` извлекает ключи, которые она возвращает.
 *
 * Поддерживает:
 *   - return { a, b, c }                   — shorthand
 *   - return { a: ref(), b: computed() }   — property assignments
 *   - return { method() {} }               — method declarations
 *   - return { get foo() {} }              — accessors
 *
 * Не заходит во вложенные функции (depth > 5).
 *
 * @param fnName       — имя функции (useTableState)
 * @param functionId   — ID функции из pipeline
 * @param fileId       — ID файла
 * @param sourceFile   — SourceFile для line/column
 * @returns ComposableInfo или null
 */
export function extractComposableReturns(
  fnName: string,
  functionId: string,
  fileId: string,
  sourceFile: SourceFile | null
): ComposableInfo | null {
  if (!fnName.startsWith('use')) return null;
  if (!sourceFile) return null;

  const fnNode = findFunctionByName(sourceFile, fnName);
  if (!fnNode) return null;

  const returnedKeys: ReturnedKey[] = [];
  const parameters = extractParameterNames(fnNode);

  // Ищем все return statements на верхнем уровне функции
  const visit = (node: Node, depth: number): void => {
    if (depth > 5) return;

    if (Node.isReturnStatement(node)) {
      const expr = node.getExpression();
      if (expr && Node.isObjectLiteralExpression(expr)) {
        extractReturnedKeys(expr, sourceFile, returnedKeys);
      }
    }

    // Не заходим в вложенные функции
    if (
      depth > 0 &&
      (Node.isFunctionDeclaration(node) ||
        Node.isFunctionExpression(node) ||
        Node.isArrowFunction(node) ||
        Node.isMethodDeclaration(node))
    ) {
      return;
    }

    node.forEachChild(child => visit(child, depth + 1));
  };

  visit(fnNode, 0);

  return {
    functionId,
    name: fnName,
    fileId,
    returnedKeys,
    parameters,
  };
}

// ============================================================
// ИЗВЛЕЧЕНИЕ КЛЮЧЕЙ ИЗ OBJECT LITERAL
// ============================================================

/**
 * Извлекает ключи из объекта, возвращаемого composable.
 *
 * ✅ ИСПРАВЛЕНО v1.0.1:
 *   - Node.isGetAccessor / Node.isSetAccessor НЕ существуют.
 *     Используются Node.isGetAccessorDeclaration /
 *     Node.isSetAccessorDeclaration.
 *   - Node.getName() доступен только после guard на конкретный
 *     тип (Node.isMethodDeclaration / isGetAccessorDeclaration /
 *     isSetAccessorDeclaration).
 */
function extractReturnedKeys(obj: Node, sourceFile: SourceFile, out: ReturnedKey[]): void {
  if (!Node.isObjectLiteralExpression(obj)) return;

  for (const prop of obj.getProperties()) {
    // ────────────────────────────────────────────────────
    // Shorthand: { a, b, c }
    // ────────────────────────────────────────────────────
    if (Node.isShorthandPropertyAssignment(prop)) {
      const name = prop.getName();
      out.push({
        name,
        kind: detectReturnKind(prop.getNameNode()),
        line: sourceFile.getLineAndColumnAtPos(prop.getStart()).line,
      });
      continue;
    }

    // ────────────────────────────────────────────────────
    // Property: { a: ref(), b: computed() }
    // ────────────────────────────────────────────────────
    if (Node.isPropertyAssignment(prop)) {
      const keyNode = prop.getNameNode();
      let name: string | null = null;

      if (Node.isIdentifier(keyNode)) {
        name = keyNode.getText();
      } else if (Node.isStringLiteral(keyNode)) {
        name = keyNode.getLiteralValue();
      } else if (Node.isNumericLiteral(keyNode)) {
        name = keyNode.getText();
      }

      if (!name) continue;

      out.push({
        name,
        kind: detectReturnKind(prop.getInitializer() ?? prop),
        line: sourceFile.getLineAndColumnAtPos(prop.getStart()).line,
      });
      continue;
    }

    // ────────────────────────────────────────────────────
    // Method: { method() {} }
    // ────────────────────────────────────────────────────
    if (Node.isMethodDeclaration(prop)) {
      out.push({
        name: prop.getName(),
        kind: 'function',
        line: sourceFile.getLineAndColumnAtPos(prop.getStart()).line,
      });
      continue;
    }

    // ────────────────────────────────────────────────────
    // ✅ ИСПРАВЛЕНО: Accessors
    // ts-morph предоставляет isGetAccessorDeclaration /
    // isSetAccessorDeclaration, а НЕ isGetAccessor / isSetAccessor.
    // ────────────────────────────────────────────────────
    if (Node.isGetAccessorDeclaration(prop) || Node.isSetAccessorDeclaration(prop)) {
      out.push({
        name: prop.getName(),
        kind: 'computed',
        line: sourceFile.getLineAndColumnAtPos(prop.getStart()).line,
      });
      continue;
    }
  }
}

// ============================================================
// ОПРЕДЕЛЕНИЕ KIND
// ============================================================

/**
 * Определяет вид возвращаемого значения по AST-узлу.
 */
function detectReturnKind(node: Node | undefined): ReturnedKind {
  if (!node) return 'unknown';

  if (Node.isCallExpression(node)) {
    const callee = node.getExpression().getText();
    if (callee === 'ref' || callee === 'shallowRef') return 'ref';
    if (callee === 'computed') return 'computed';
    if (callee === 'reactive') return 'reactive';
    if (callee === 'readonly') return 'readonly';
    return 'unknown';
  }

  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return 'function';
  }

  if (Node.isIdentifier(node)) return 'ref';

  return 'unknown';
}

// ============================================================
// ИЗВЛЕЧЕНИЕ ПАРАМЕТРОВ
// ============================================================

/**
 * Извлекает имена параметров функции.
 */
function extractParameterNames(fnNode: Node): string[] {
  const params: string[] = [];

  if (
    Node.isFunctionDeclaration(fnNode) ||
    Node.isFunctionExpression(fnNode) ||
    Node.isArrowFunction(fnNode) ||
    Node.isMethodDeclaration(fnNode)
  ) {
    for (const p of fnNode.getParameters()) {
      params.push(p.getName());
    }
  }

  return params;
}

// ============================================================
// ПОИСК ФУНКЦИИ ПО ИМЕНИ
// ============================================================

/**
 * Находит узел функции по имени.
 *
 * Поддерживает:
 *   - FunctionDeclaration: function useXxx() {}
 *   - Arrow function в переменной: const useXxx = () => {}
 *   - Function expression в переменной: const useXxx = function() {}
 */
function findFunctionByName(sourceFile: SourceFile, name: string): Node | null {
  // FunctionDeclaration
  const fn = sourceFile.getFunction(name);
  if (fn) return fn;

  // const useXxx = () => {} или const useXxx = function() {}
  for (const varDecl of sourceFile.getVariableDeclarations()) {
    if (varDecl.getName() !== name) continue;
    const init = varDecl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      return init;
    }
  }

  return null;
}

// ============================================================
// ИЗВЛЕЧЕНИЕ LOCAL-BINDINGS (деструктуризация composable)
// ============================================================

/**
 * Извлекает деструктуризации composables:
 *   const { checkedRowKeys, resetState } = useTableState()
 *
 * @param scriptAST    — AST <script setup>
 * @param sourceFile   — SourceFile для line/column
 * @param composables  — Map<composableName, ComposableInfo>
 * @returns Массив LocalBinding
 */
export function extractLocalBindings(
  scriptAST: Node | null,
  sourceFile: SourceFile | null,
  composables: Map<string, ComposableInfo>
): LocalBinding[] {
  if (!scriptAST || !sourceFile || composables.size === 0) return [];

  const bindings: LocalBinding[] = [];

  const visit = (node: Node): void => {
    if (Node.isVariableDeclaration(node)) {
      const nameNode = node.getNameNode();
      if (!Node.isObjectBindingPattern(nameNode)) {
        node.forEachChild(visit);
        return;
      }

      const init = node.getInitializer();
      if (!init || !Node.isCallExpression(init)) {
        node.forEachChild(visit);
        return;
      }

      const callee = init.getExpression();
      const calleeName = callee.getText();
      const composable = composables.get(calleeName);
      if (!composable) {
        node.forEachChild(visit);
        return;
      }

      for (const element of nameNode.getElements()) {
        if (!Node.isBindingElement(element)) continue;

        const localName = element.getName();
        const propertyNameNode = element.getPropertyNameNode();
        const propertyName = propertyNameNode
          ? propertyNameNode.getText().replace(/['"]/g, '')
          : localName;

        const returnedKey = composable.returnedKeys.find(k => k.name === propertyName);

        bindings.push({
          localName,
          propertyName,
          sourceFunctionId: composable.functionId,
          sourceFileId: composable.fileId,
          kind: returnedKey?.kind ?? 'unknown',
          line: sourceFile.getLineAndColumnAtPos(element.getStart()).line,
        });
      }
    }

    node.forEachChild(visit);
  };

  visit(scriptAST);
  return bindings;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  extractComposableReturns,
  extractLocalBindings,
};
