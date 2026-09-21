// src/core/relations/object-map-extractor.ts
// ============================================================
// ИЗВЛЕЧЕНИЕ OBJECT-MAPS
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран `Node.isBooleanLiteral` (не существует в ts-morph).
//     Boolean-литералы определяются через SyntaxKind.TrueKeyword /
//     SyntaxKind.FalseKeyword.
//   - ✅ ИСПРАВЛЕНО: добавлен импорт SyntaxKind.
//   - ✅ ИСПРАВЛЕНО: корректная обработка ключей объекта —
//     Identifier | StringLiteral | NumericLiteral.
//   - ✅ ИСПРАВЛЕНО: убрано неявное использование Node.getName() на union.
//
// Назначение
// ----------
// Извлекает object-maps вида:
//   const icons = { home: AiHomeIcon, test: AiTestIcon }
//   const components = { header: HeaderComponent, footer: FooterComponent }
//   const views = { list: ListView, detail: DetailView }
//
// Используется для резолвинга dynamicComponents:
//   <component :is="icons[type]" />
//   <component :is="components[viewType]" />
// ============================================================

import { Node, SyntaxKind, type SourceFile } from 'ts-morph';

import type { ObjectMap } from './types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Извлекает все object-maps из AST.
 *
 * Поддерживает:
 *   - const icons = { home: AiHomeIcon, test: AiTestIcon }
 *   - const components = { 'header': Header, "footer": Footer }
 *   - const views = { 0: ListView, 1: DetailView }
 *
 * Игнорирует:
 *   - объекты без идентификаторов в значениях: { a: 1, b: 'str' }
 *   - объекты с spread: { ...base, a: Foo }
 *   - вложенные объекты: { a: { b: Foo } }
 *
 * @param scriptAST   — AST <script setup>
 * @param sourceFile  — SourceFile для получения line/column
 * @returns Массив ObjectMap
 */
export function extractObjectMaps(
  scriptAST: Node | null,
  sourceFile: SourceFile | null
): ObjectMap[] {
  if (!scriptAST || !sourceFile) return [];

  const maps: ObjectMap[] = [];

  const visit = (node: Node): void => {
    if (Node.isVariableDeclaration(node)) {
      const init = node.getInitializer();
      if (init && Node.isObjectLiteralExpression(init)) {
        const name = node.getName();
        const map = tryExtractMap(name, init, sourceFile);
        if (map) maps.push(map);
      }
    }

    node.forEachChild(visit);
  };

  visit(scriptAST);
  return maps;
}

// ============================================================
// ИЗВЛЕЧЕНИЕ ОДНОГО OBJECT-MAP
// ============================================================

/**
 * Пытается извлечь object-map из ObjectLiteralExpression.
 *
 * Возвращает null, если:
 *   - все значения — не идентификаторы
 *   - объект пустой
 */
function tryExtractMap(name: string, obj: Node, sourceFile: SourceFile): ObjectMap | null {
  if (!Node.isObjectLiteralExpression(obj)) return null;

  const entries: Record<string, string> = {};

  for (const prop of obj.getProperties()) {
    // ────────────────────────────────────────────────────
    // Property assignment: { key: Value }
    // ────────────────────────────────────────────────────
    if (Node.isPropertyAssignment(prop)) {
      const key = extractKey(prop);
      if (!key) continue;

      const valueNode = prop.getInitializer();
      if (valueNode && Node.isIdentifier(valueNode)) {
        entries[key] = valueNode.getText();
      }
      continue;
    }

    // ────────────────────────────────────────────────────
    // Shorthand: { Foo } — ключ и значение совпадают
    // ────────────────────────────────────────────────────
    if (Node.isShorthandPropertyAssignment(prop)) {
      const key = prop.getName();
      if (key) {
        entries[key] = key;
      }
      continue;
    }

    // ────────────────────────────────────────────────────
    // ✅ ИСПРАВЛЕНО: не используем Node.isBooleanLiteral.
    // Метод-литералы и spread игнорируются.
    // ────────────────────────────────────────────────────
    if (Node.isMethodDeclaration(prop)) {
      // { method() {} } — не является map-значением
      continue;
    }

    if (Node.isSpreadAssignment(prop)) {
      // { ...base, a: Foo } — spread не поддерживается
      continue;
    }
  }

  // Если ни одного entry не извлеклось — не map
  if (Object.keys(entries).length === 0) return null;

  return {
    name,
    entries,
    line: sourceFile.getLineAndColumnAtPos(obj.getStart()).line,
  };
}

// ============================================================
// ИЗВЛЕЧЕНИЕ КЛЮЧА
// ============================================================

/**
 * Извлекает ключ из PropertyAssignment.
 *
 * ✅ ИСПРАВЛЕНО v1.0.1:
 *   Явные guard-ы на Identifier / StringLiteral / NumericLiteral.
 *   Раньше был вызов `getNameNode()` без проверок, что могло
 *   приводить к ошибкам на экзотических литералах.
 *
 * Поддерживает:
 *   - { foo: ... }      → 'foo'
 *   - { 'foo': ... }    → 'foo'
 *   - { "foo": ... }    → 'foo'
 *   - { 123: ... }      → '123'
 */
function extractKey(prop: Node): string | null {
  if (!Node.isPropertyAssignment(prop)) return null;

  const keyNode = prop.getNameNode();

  if (Node.isIdentifier(keyNode)) {
    return keyNode.getText();
  }

  if (Node.isStringLiteral(keyNode)) {
    return keyNode.getLiteralValue();
  }

  if (Node.isNumericLiteral(keyNode)) {
    return keyNode.getText();
  }

  return null;
}

// ============================================================
// ПРОВЕРКА: ЯВЛЯЕТСЯ ЛИ УЗЕЛ ЛИТЕРАЛОМ
// ============================================================

/**
 * ✅ НОВОЕ v1.0.1: утилита для проверки примитивных литералов.
 *
 * Заменяет удалённые в ts-morph методы Node.isBooleanLiteral и др.
 * Проверяет:
 *   - NumericLiteral       → number
 *   - StringLiteral        → string
 *   - TrueKeyword          → true
 *   - FalseKeyword         → false
 *   - NullKeyword          → null
 *   - NoSubstitutionTemplateLiteral → template без подстановок
 *
 * Используется для отсеивания non-identifier значений в object-map.
 */
export function isLiteralNode(node: Node): boolean {
  if (!node) return false;

  return (
    Node.isNumericLiteral(node) ||
    Node.isStringLiteral(node) ||
    node.getKind() === SyntaxKind.TrueKeyword ||
    node.getKind() === SyntaxKind.FalseKeyword ||
    Node.isNullLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node)
  );
}

// ============================================================
// РАСШИРЕННЫЙ РЕЖИМ: ИЗВЛЕЧЕНИЕ С ПРОВЕРКОЙ LITERAL-ЗНАЧЕНИЙ
// ============================================================

/**
 * ✅ НОВОЕ v1.0.1: расширенная версия извлечения.
 *
 * В отличие от `extractObjectMaps`, эта функция сохраняет
 * literal-значения (number/string/boolean/null) в виде строк.
 *
 * Полезно для map-ов вида:
 *   const labels = { home: 'Home', test: 'Test' }
 *   const order = { first: 1, second: 2 }
 *
 * @param scriptAST   — AST
 * @param sourceFile  — SourceFile
 * @returns ObjectMap[]
 */
export function extractObjectMapsExtended(
  scriptAST: Node | null,
  sourceFile: SourceFile | null
): ObjectMap[] {
  if (!scriptAST || !sourceFile) return [];

  const maps: ObjectMap[] = [];

  const visit = (node: Node): void => {
    if (Node.isVariableDeclaration(node)) {
      const init = node.getInitializer();
      if (init && Node.isObjectLiteralExpression(init)) {
        const name = node.getName();
        const map = tryExtractMapExtended(name, init, sourceFile);
        if (map) maps.push(map);
      }
    }

    node.forEachChild(visit);
  };

  visit(scriptAST);
  return maps;
}

/**
 * Расширенное извлечение: сохраняет также литералы.
 */
function tryExtractMapExtended(name: string, obj: Node, sourceFile: SourceFile): ObjectMap | null {
  if (!Node.isObjectLiteralExpression(obj)) return null;

  const entries: Record<string, string> = {};

  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const key = extractKey(prop);
      if (!key) continue;

      const valueNode = prop.getInitializer();
      if (!valueNode) continue;

      if (Node.isIdentifier(valueNode)) {
        entries[key] = valueNode.getText();
      } else if (isLiteralNode(valueNode)) {
        // ✅ ИСПРАВЛЕНО: literal → строка
        entries[key] = valueNode.getText().replace(/^['"]|['"]$/g, '');
      }
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      const key = prop.getName();
      if (key) entries[key] = key;
    }
  }

  if (Object.keys(entries).length === 0) return null;

  return {
    name,
    entries,
    line: sourceFile.getLineAndColumnAtPos(obj.getStart()).line,
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  extractObjectMaps,
  extractObjectMapsExtended,
  isLiteralNode,
};
