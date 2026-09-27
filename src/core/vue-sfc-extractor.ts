// src/core/vue-sfc-extractor.ts
// ============================================================
// VUE SFC EXTRACTOR — v2.0.1
// ============================================================
// Версия: 2.0.1
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v2.0.1 (fix TS2339):
//   - ✅ ИСПРАВЛЕНО: `Property 'getMembers' does not exist on type 'Node'`.
//     Причина: базовый класс `Node` в ts-morph не имеет метода
//     `getMembers()`. Он есть только у `TypeLiteral`,
//     `InterfaceDeclaration`, `ClassDeclaration`.
//   - ✅ ДОБАВЛЕНО: утилита `getMembersSafe(node)` — использует
//     type guards (`Node.isTypeLiteral`, `Node.isInterfaceDeclaration`,
//     `Node.isClassDeclaration`) и возвращает `Node[]`.
//   - ✅ ЗАМЕНЕНО: `literal.getMembers()` → `getMembersSafe(literal)`
//     в блоках `defineProps` и `defineEmits`.
//
// v2.0.0 (ts-morph + резолвинг типов):
//   - ✅ ПЕРЕПИСАНО на ts-morph вместо @typescript-eslint/parser.
//     Причина: @typescript-eslint/parser не умеет резолвить
//     TSTypeReference (`defineProps<Props>()`) до самого
//     объявления интерфейса. В результате props/emits оставались
//     пустыми, если объявление шло через `interface Props { ... }`.
//   - ✅ ДОБАВЛЕНО: `resolveTypeLiteral` — резолвит TSTypeReference
//     до TSTypeLiteral / InterfaceDeclaration:
//       • локальный interface Props
//       • локальный type Props = { ... }
//       • импортированный interface Props
//       • импортированный type Props
//   - ✅ ДОБАВЛЕНО: поддержка ArrayLiteral в defineProps/defineEmits.
//   - ✅ ИСПРАВЛЕНО: defineProps<{...}>() теперь корректно извлекает
//     имена props, а не возвращает [].
//   - ✅ ИСПРАВЛЕНО: defineEmits<{ (e: 'x'): void }>() теперь
//     корректно извлекает имена emits из MethodSignature.
//   - ✅ ИСПРАВЛЕНО: defineExpose({ reset, submit }) — поддержка
//     ShorthandPropertyAssignment.
//
// v1.0.1:
//   - ✅ Убран неиспользуемый импорт SyntaxKind.
//
// v1.0.0:
//   - Первая версия (на @typescript-eslint/parser).
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Извлекает РЕАЛЬНЫЕ имена props/emits/exposed из `<script setup>`.
//
// Используется в compact-reporter.ts для замены плейсхолдеров
// #0, #1, ... (которые формируются в compact.vue.sfc.pn/en/xn)
// на реальные имена.
//
// ════════════════════════════════════════════════════════════
// ЧТО ПОДДЕРЖИВАЕТ
// ════════════════════════════════════════════════════════════
//
//   defineProps<{ a: string; b?: number }>()          — TSTypeLiteral
//   defineProps<Props>()                              — TSTypeReference
//   defineProps(['a', 'b'])                           — ArrayLiteral
//   defineEmits<{ (e: 'change'): void }>()            — MethodSignature
//   defineEmits<{ change: [v: string] }>()            — PropertySignature
//   defineEmits(['change', 'update'])                 — ArrayLiteral
//   defineExpose({ reset, submit })                   — ShorthandPropertyAssignment
//   defineExpose({ reset: () => {} })                 — PropertyAssignment
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   <script setup lang="ts">
//     interface Props {
//       userToolbarItems: string[];
//       isDataModified: boolean;
//     }
//     const props = defineProps<Props>();
//     defineEmits<{ (e: 'column-chooser-change', v: string): void }>();
//     defineExpose({ reset, submit });
//   </script>
//
//   → {
//       props:   ['userToolbarItems', 'isDataModified'],
//       emits:   ['column-chooser-change'],
//       exposed: ['reset', 'submit'],
//     }
//
// ════════════════════════════════════════════════════════════
// ЗАВИСИМОСТИ
// ════════════════════════════════════════════════════════════
//
//   - ts-morph — используется Project, Node, SourceFile.
//     ts-morph уже есть в зависимостях ast-analyzer.
//   - НЕ используется @typescript-eslint/parser (удалён).
// ============================================================

import { Project, Node, type SourceFile } from 'ts-morph';

// ============================================================
// ПУБЛИЧНЫЙ ИНТЕРФЕЙС
// ============================================================

/**
 * Результат извлечения имён из `<script setup>`.
 */
export interface SFCNames {
  /** Имена props (из defineProps) */
  props: string[];
  /** Имена emits (из defineEmits) */
  emits: string[];
  /** Имена exposed-полей (из defineExpose) */
  exposed: string[];
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Извлекает реальные имена props/emits/exposed из `<script setup>`.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Создаём ts-morph Project в in-memory FS.
 *   2. Парсим scriptContent в SourceFile.
 *   3. Ищем вызовы:
 *      - defineProps  → извлекаем имена props
 *      - defineEmits  → извлекаем имена emits
 *      - defineExpose → извлекаем имена exposed
 *   4. Дедуплицируем имена.
 *   5. Возвращаем результат.
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 *   - Если scriptContent пуст → возвращает пустой результат.
 *   - Если ts-morph не смог распарсить — ts-morph не бросает,
 *     а создаёт SourceFile с ошибками парсинга. Имена, которые
 *     удалось извлечь, извлекаются.
 *   - Если `defineProps<Props>()` и `interface Props` не найден —
 *     props остаются пустыми, но функция НЕ падает.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // 1. Простой случай
 *   extractSFCNames(`
 *     defineProps<{ a: string; b: number }>()
 *   `, '/virtual/App.vue.__script__.ts');
 *   // → { props: ['a', 'b'], emits: [], exposed: [] }
 *
 *   // 2. Через interface
 *   extractSFCNames(`
 *     interface Props { a: string; b: number }
 *     defineProps<Props>()
 *   `, '/virtual/App.vue.__script__.ts');
 *   // → { props: ['a', 'b'], emits: [], exposed: [] }
 *
 *   // 3. defineEmits с сигнатурой
 *   extractSFCNames(`
 *     defineEmits<{ (e: 'change', v: string): void }>()
 *   `, '/virtual/App.vue.__script__.ts');
 *   // → { props: [], emits: ['change'], exposed: [] }
 *
 *   // 4. defineExpose с сокращённой записью
 *   extractSFCNames(`
 *     defineExpose({ reset, submit })
 *   `, '/virtual/App.vue.__script__.ts');
 *   // → { props: [], emits: [], exposed: ['reset', 'submit'] }
 *
 * @param scriptContent — содержимое `<script setup>` (или `<script>`)
 * @param virtualPath   — виртуальный путь для ts-morph (для line mapping)
 * @returns SFCNames
 */
export function extractSFCNames(scriptContent: string, virtualPath: string): SFCNames {
  const result: SFCNames = { props: [], emits: [], exposed: [] };

  // ────────────────────────────────────────────────────────
  // Защита от пустого входа
  // ────────────────────────────────────────────────────────
  if (!scriptContent || !scriptContent.trim()) return result;

  // ────────────────────────────────────────────────────────
  // Создаём ts-morph Project в in-memory FS
  // ────────────────────────────────────────────────────────
  const project = new Project({
    compilerOptions: {
      target: 99, // ESNext
      module: 99, // ESNext
      allowJs: true,
      skipLibCheck: true,
      jsx: 2, // React JSX
    },
    useInMemoryFileSystem: true,
  });

  const sf = project.createSourceFile(virtualPath, scriptContent, { overwrite: true });

  // ────────────────────────────────────────────────────────
  // defineProps
  // ────────────────────────────────────────────────────────
  for (const call of findCalls(sf, 'defineProps')) {
    // 1. Type-аргумент: defineProps<{ ... }>() / defineProps<Props>()
    const typeArgs = call.getTypeArguments();
    if (typeArgs.length > 0) {
      const firstType = typeArgs[0];
      if (firstType) {
        const literal = resolveTypeLiteral(firstType, sf);
        if (literal) {
          // ✅ FIX v2.0.1: getMembersSafe вместо literal.getMembers()
          const members = getMembersSafe(literal);
          for (const member of members) {
            if (Node.isPropertySignature(member)) {
              const name = member.getName();
              if (name) result.props.push(name);
            }
          }
        }
      }
    }

    // 2. Array-аргумент: defineProps(['a', 'b'])
    const arg = call.getArguments()[0];
    if (arg && Node.isArrayLiteralExpression(arg)) {
      for (const el of arg.getElements()) {
        const name = el.getText().replace(/['"]/g, '');
        if (name) result.props.push(name);
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // defineEmits
  // ────────────────────────────────────────────────────────
  for (const call of findCalls(sf, 'defineEmits')) {
    // 1. Type-аргумент:
    //    defineEmits<{ (e: 'change'): void }>()        — MethodSignature
    //    defineEmits<{ change: [v: string] }>()        — PropertySignature
    const typeArgs = call.getTypeArguments();
    if (typeArgs.length > 0) {
      const firstType = typeArgs[0];
      if (firstType) {
        const literal = resolveTypeLiteral(firstType, sf);
        if (literal) {
          // ✅ FIX v2.0.1: getMembersSafe вместо literal.getMembers()
          const members = getMembersSafe(literal);
          for (const member of members) {
            if (Node.isPropertySignature(member) || Node.isMethodSignature(member)) {
              const name = member.getName();
              if (name) result.emits.push(name);
            }
          }
        }
      }
    }

    // 2. Array-аргумент: defineEmits(['change', 'update'])
    const arg = call.getArguments()[0];
    if (arg && Node.isArrayLiteralExpression(arg)) {
      for (const el of arg.getElements()) {
        const name = el.getText().replace(/['"]/g, '');
        if (name) result.emits.push(name);
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // defineExpose
  // ────────────────────────────────────────────────────────
  //   defineExpose({ reset, submit })               — shorthand
  //   defineExpose({ reset: () => {} })             — property assignment
  //   defineExpose({ reset: resetFn })              — property assignment
  // ────────────────────────────────────────────────────────
  for (const call of findCalls(sf, 'defineExpose')) {
    const arg = call.getArguments()[0];
    if (arg && Node.isObjectLiteralExpression(arg)) {
      for (const prop of arg.getProperties()) {
        if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)) {
          const name = prop.getName?.();
          if (name) result.exposed.push(name);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // Дедупликация
  // ────────────────────────────────────────────────────────
  result.props = [...new Set(result.props)];
  result.emits = [...new Set(result.emits)];
  result.exposed = [...new Set(result.exposed)];

  return result;
}

// ============================================================
// ✅ v2.0.1: БЕЗОПАСНОЕ ИЗВЛЕЧЕНИЕ ЧЛЕНОВ
// ============================================================

/**
 * Возвращает члены типа (properties / methods) для узла.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ НУЖНА ЭТА ФУНКЦИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   Базовый класс `Node` в ts-morph НЕ имеет метода `getMembers()`.
 *   Он есть только у конкретных подтипов:
 *     - `TypeLiteral.getMembers()`
 *     - `InterfaceDeclaration.getMembers()`
 *     - `ClassDeclaration.getMembers()`
 *
 *   Если написать `literal.getMembers()` — TS выдаст TS2339:
 *     Property 'getMembers' does not exist on type 'Node<Node>'.
 *
 *   Решение: использовать type guards и явное приведение типа.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // TypeLiteral
 *   getMembersSafe(typeLiteralNode)
 *   // → [PropertySignature, PropertySignature]
 *
 *   // InterfaceDeclaration
 *   getMembersSafe(interfaceDeclNode)
 *   // → [PropertySignature, MethodSignature]
 *
 *   // Неподдерживаемый узел
 *   getMembersSafe(identifierNode)
 *   // → []
 *
 * @param node — узел типа (TypeLiteral / InterfaceDeclaration / ClassDeclaration)
 * @returns массив членов (properties / methods)
 */
function getMembersSafe(node: Node): Node[] {
  // ────────────────────────────────────────────────────────
  // 1. TypeLiteral: { a: string; b: number }
  // ────────────────────────────────────────────────────────
  if (Node.isTypeLiteral(node)) {
    return node.getMembers();
  }

  // ────────────────────────────────────────────────────────
  // 2. InterfaceDeclaration: interface Props { ... }
  // ────────────────────────────────────────────────────────
  if (Node.isInterfaceDeclaration(node)) {
    return node.getMembers();
  }

  // ────────────────────────────────────────────────────────
  // 3. ClassDeclaration: class Props { ... }
  // ────────────────────────────────────────────────────────
  if (Node.isClassDeclaration(node)) {
    return node.getMembers();
  }

  // ────────────────────────────────────────────────────────
  // 4. Неподдерживаемый узел
  // ────────────────────────────────────────────────────────
  return [];
}

// ============================================================
// РЕЗОЛВИНГ ТИПА
// ============================================================

/**
 * Резолвит TSTypeReference → TSTypeLiteral / InterfaceDeclaration.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. TSTypeLiteral (`{ a: string }`) → возвращает как есть.
 *
 *   2. TSTypeReference (`Props`) → ищет объявление:
 *      a. Локальный `interface Props` в текущем файле.
 *      b. Локальный `type Props = { ... }`.
 *      c. Импортированный `interface Props` (через
 *         `import { Props } from '...'`).
 *      d. Импортированный `type Props`.
 *
 *   3. Если ничего не найдено → null.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // Локальный interface
 *   interface Props { a: string; }
 *   defineProps<Props>();
 *   → resolveTypeLiteral(TSTypeReference('Props'), sf)
 *   → InterfaceDeclaration 'Props'
 *   → getMembers() → [PropertySignature 'a']
 *
 *   // TSTypeLiteral
 *   defineProps<{ a: string }>();
 *   → resolveTypeLiteral(TSTypeLiteral, sf)
 *   → TSTypeLiteral
 *   → getMembers() → [PropertySignature 'a']
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМЫЙ ТИП
 * ════════════════════════════════════════════════════════════
 *
 *   Возвращает Node (TSTypeLiteral / InterfaceDeclaration /
 *   ClassDeclaration). У всех этих типов есть метод `getMembers()`,
 *   но базовый класс `Node` его не имеет. Поэтому для извлечения
 *   членов используйте `getMembersSafe(literal)`.
 *
 * @param typeNode — узел типа из `defineProps<T>()` / `defineEmits<T>()`
 * @param sf       — SourceFile для поиска локальных объявлений
 * @returns Node с getMembers() или null
 */
function resolveTypeLiteral(typeNode: Node, sf: SourceFile): Node | null {
  if (!typeNode) return null;

  // ────────────────────────────────────────────────────────
  // 1. TSTypeLiteral — возвращаем как есть
  // ────────────────────────────────────────────────────────
  if (Node.isTypeLiteral(typeNode)) {
    return typeNode;
  }

  // ────────────────────────────────────────────────────────
  // 2. TSTypeReference — резолвим
  // ────────────────────────────────────────────────────────
  if (Node.isTypeReference(typeNode)) {
    const typeName = typeNode.getTypeName();
    if (!Node.isIdentifier(typeName)) return null;
    const name = typeName.getText();

    // 2a. Локальный interface
    const iface = sf.getInterface(name);
    if (iface) return iface;

    // 2b. Локальный type alias
    const alias = sf.getTypeAlias(name);
    if (alias) {
      const inner = alias.getTypeNode();
      if (inner && Node.isTypeLiteral(inner)) return inner;
    }

    // 2c/2d. Импортированный interface / type alias
    const imp = sf.getImportDeclaration(d => d.getNamedImports().some(n => n.getName() === name));
    if (imp) {
      const mod = imp.getModuleSpecifierSourceFile();
      if (mod) {
        const importedIface = mod.getInterface(name);
        if (importedIface) return importedIface;

        const importedAlias = mod.getTypeAlias(name);
        if (importedAlias) {
          const inner = importedAlias.getTypeNode();
          if (inner && Node.isTypeLiteral(inner)) return inner;
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // 3. Не удалось резолвить
  // ────────────────────────────────────────────────────────
  return null;
}

// ============================================================
// ПОИСК ВЫЗОВОВ
// ============================================================

/**
 * Находит все CallExpression с заданным именем.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Обходим все потомки SourceFile через `forEachDescendant`.
 *   2. Для каждого CallExpression проверяем, что его expression —
 *      это Identifier с нужным именем.
 *   3. Собираем все совпадения.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   findCalls(sf, 'defineProps')
 *   // → [CallExpression, CallExpression] — все вызовы defineProps
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ НЕ getFunctionCalls
 * ════════════════════════════════════════════════════════════
 *
 *   `defineProps` — это не обычная функция, а макрос Vue.
 *   В ts-morph он не привязан к конкретному FunctionDeclaration,
 *   поэтому `sourceFile.getFunction('defineProps')` вернёт null.
 *   Обход через `forEachDescendant` — единственный надёжный способ.
 *
 * @param sf   — SourceFile для поиска
 * @param name — имя вызываемой функции (например, 'defineProps')
 * @returns массив CallExpression
 */
function findCalls(sf: SourceFile, name: string): any[] {
  const result: any[] = [];

  sf.forEachDescendant((node: Node) => {
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      if (Node.isIdentifier(expr) && expr.getText() === name) {
        result.push(node);
      }
    }
  });

  return result;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { extractSFCNames };
