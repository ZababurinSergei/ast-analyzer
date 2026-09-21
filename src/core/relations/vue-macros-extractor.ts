// src/core/relations/vue-macros-extractor.ts
// ============================================================
// МОДУЛЬ 1: ИЗВЛЕЧЕНИЕ VUE-МАКРОСОВ
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: findCallsByName возвращает CallExpression[]
//     (было Node[], что давало TS2339 на getArguments())
//   - ✅ ИСПРАВЛЕНО: extractExpose/extractProps/extractEmits/
//     extractModel/extractSlots/extractOptions принимают CallExpression
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт SyntaxKind
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый тип ReturnedKind
//   - ✅ ИСПРАВЛЕНО: getPropertyName корректно обрабатывает undefined
// ============================================================

import { Node, type SourceFile, type CallExpression } from 'ts-morph';

import type {
  VueMacros,
  ExposedMethod,
  PropDefinition,
  EmitDefinition,
  ModelDefinition,
  SlotDefinition,
  ExposedKind,
} from './types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Извлекает все Vue-макросы из <script setup>.
 *
 * Поддерживает:
 *   - defineExpose({ ... })
 *   - defineProps<T>() / defineProps(['a', 'b'])
 *   - withDefaults(defineProps<T>(), { ... })
 *   - defineEmits<T>() / defineEmits(['event'])
 *   - defineModel('name') / defineModel<T>()
 *   - defineSlots<T>()
 *   - defineOptions({ name, inheritAttrs })
 */
export function extractVueMacros(scriptAST: Node | null, sourceFile: SourceFile | null): VueMacros {
  const result: VueMacros = {
    exposed: [],
    props: [],
    emits: [],
    model: [],
    slots: [],
    options: null,
  };

  if (!scriptAST || !sourceFile) return result;

  // 1. defineExpose
  for (const call of findCallsByName(scriptAST, 'defineExpose')) {
    extractExpose(call, sourceFile, result.exposed);
  }

  // 2. defineProps (через withDefaults или напрямую)
  for (const call of findCallsByName(scriptAST, 'withDefaults')) {
    const inner = call.getArguments()[0];
    if (inner && Node.isCallExpression(inner)) {
      extractProps(inner, sourceFile, result.props);
    }
  }
  for (const call of findCallsByName(scriptAST, 'defineProps')) {
    // Skip if already processed via withDefaults
    const parent = call.getParent();
    if (parent && Node.isCallExpression(parent)) continue;
    extractProps(call, sourceFile, result.props);
  }

  // 3. defineEmits
  for (const call of findCallsByName(scriptAST, 'defineEmits')) {
    extractEmits(call, sourceFile, result.emits);
  }

  // 4. defineModel
  for (const call of findCallsByName(scriptAST, 'defineModel')) {
    extractModel(call, sourceFile, result.model);
  }

  // 5. defineSlots
  for (const call of findCallsByName(scriptAST, 'defineSlots')) {
    extractSlots(call, sourceFile, result.slots);
  }

  // 6. defineOptions
  for (const call of findCallsByName(scriptAST, 'defineOptions')) {
    extractOptions(call, result);
  }

  return result;
}

// ============================================================
// ПОИСК CALL-ВЫРАЖЕНИЙ
// ============================================================

/**
 * Находит все CallExpression с заданным именем.
 *
 * ✅ ИСПРАВЛЕНО v1.0.1: возвращает CallExpression[] вместо Node[] —
 * это позволяет вызывать `.getArguments()` без дополнительной проверки.
 */
export function findCallsByName(root: Node, name: string): CallExpression[] {
  const result: CallExpression[] = [];

  const visit = (node: Node): void => {
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      if (Node.isIdentifier(expr) && expr.getText() === name) {
        result.push(node);
      }
    }
    node.forEachChild(visit);
  };

  visit(root);
  return result;
}

// ============================================================
// defineExpose
// ============================================================

function extractExpose(call: CallExpression, sourceFile: SourceFile, out: ExposedMethod[]): void {
  const arg = call.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return;

  for (const prop of arg.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const name = getPropertyName(prop);
      if (!name) continue;
      const init = prop.getInitializer();
      out.push({
        name,
        line: sourceFile.getLineAndColumnAtPos(prop.getStart()).line,
        kind: detectExposeKind(init),
        source: init?.getText() ?? '',
      });
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      out.push({
        name: prop.getName(),
        line: sourceFile.getLineAndColumnAtPos(prop.getStart()).line,
        kind: 'ref',
        source: prop.getName(),
      });
    }
  }
}

function detectExposeKind(node: Node | undefined): ExposedKind {
  if (!node) return 'unknown';

  if (Node.isCallExpression(node)) {
    const callee = node.getExpression().getText();
    if (callee === 'readonly') return 'readonly';
    if (callee === 'computed') return 'computed';
    if (callee === 'ref' || callee === 'shallowRef') return 'ref';
    return 'unknown';
  }

  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return 'function';
  }

  if (Node.isIdentifier(node)) return 'ref';

  return 'unknown';
}

// ============================================================
// defineProps
// ============================================================

function extractProps(call: CallExpression, sourceFile: SourceFile, out: PropDefinition[]): void {
  // Type-аргумент: defineProps<Props>()
  const typeArgs = call.getTypeArguments();
  if (typeArgs.length > 0) {
    const typeArg = typeArgs[0];
    if (typeArg) extractPropsFromType(typeArg, sourceFile, out);
  }

  // Array-аргумент: defineProps(['a', 'b'])
  const arg = call.getArguments()[0];
  if (arg && Node.isArrayLiteralExpression(arg)) {
    for (const el of arg.getElements()) {
      const text = el.getText().replace(/['"]/g, '');
      out.push({
        name: text,
        type: 'any',
        required: false,
        default: null,
        line: sourceFile.getLineAndColumnAtPos(el.getStart()).line,
      });
    }
  }
}

function extractPropsFromType(typeNode: Node, sourceFile: SourceFile, out: PropDefinition[]): void {
  const resolved = resolveTypeNode(typeNode);
  if (!resolved) return;

  const members = Node.isTypeLiteral(resolved)
    ? resolved.getMembers()
    : Node.isInterfaceDeclaration(resolved)
      ? resolved.getMembers()
      : [];

  for (const member of members) {
    if (Node.isPropertySignature(member)) {
      const name = member.getName();
      const optional = member.hasQuestionToken();
      const typeText = member.getTypeNode()?.getText() ?? 'any';

      out.push({
        name,
        type: typeText,
        required: !optional,
        default: null,
        line: sourceFile.getLineAndColumnAtPos(member.getStart()).line,
      });
    }
  }
}

// ============================================================
// defineEmits
// ============================================================

function extractEmits(call: CallExpression, sourceFile: SourceFile, out: EmitDefinition[]): void {
  const typeArgs = call.getTypeArguments();
  if (typeArgs.length > 0) {
    const typeArg = typeArgs[0];
    if (typeArg) extractEmitsFromType(typeArg, sourceFile, out);
  }

  const arg = call.getArguments()[0];
  if (arg && Node.isArrayLiteralExpression(arg)) {
    for (const el of arg.getElements()) {
      const name = el.getText().replace(/['"]/g, '');
      out.push({
        name,
        payloadType: 'any',
        line: sourceFile.getLineAndColumnAtPos(el.getStart()).line,
      });
    }
  }
}

function extractEmitsFromType(typeNode: Node, sourceFile: SourceFile, out: EmitDefinition[]): void {
  const resolved = resolveTypeNode(typeNode);
  if (!resolved) return;

  const members = Node.isTypeLiteral(resolved)
    ? resolved.getMembers()
    : Node.isInterfaceDeclaration(resolved)
      ? resolved.getMembers()
      : [];

  for (const member of members) {
    if (Node.isPropertySignature(member)) {
      const name = member.getName();
      const typeText = member.getTypeNode()?.getText() ?? 'any';
      out.push({
        name,
        payloadType: typeText,
        line: sourceFile.getLineAndColumnAtPos(member.getStart()).line,
      });
    } else if (Node.isMethodSignature(member)) {
      const name = member.getName();
      const paramsText =
        member
          .getParameters()
          .map(p => p.getTypeNode()?.getText() ?? 'any')
          .join(', ') || 'any';
      out.push({
        name,
        payloadType: `[${paramsText}]`,
        line: sourceFile.getLineAndColumnAtPos(member.getStart()).line,
      });
    }
  }
}

// ============================================================
// defineModel
// ============================================================

function extractModel(call: CallExpression, sourceFile: SourceFile, out: ModelDefinition[]): void {
  const args = call.getArguments();
  let name = 'modelValue';

  if (args.length > 0) {
    const first = args[0];
    if (first && Node.isStringLiteral(first)) {
      name = first.getLiteralValue();
    }
  }

  out.push({
    name,
    propName: name,
    eventName: `update:${name}`,
    line: sourceFile.getLineAndColumnAtPos(call.getStart()).line,
  });
}

// ============================================================
// defineSlots
// ============================================================

function extractSlots(call: CallExpression, sourceFile: SourceFile, out: SlotDefinition[]): void {
  const typeArgs = call.getTypeArguments();
  if (typeArgs.length > 0) {
    const typeArg = typeArgs[0];
    if (typeArg) extractSlotsFromType(typeArg, sourceFile, out);
  }

  const arg = call.getArguments()[0];
  if (arg && Node.isArrayLiteralExpression(arg)) {
    for (const el of arg.getElements()) {
      const name = el.getText().replace(/['"]/g, '');
      out.push({ name, bindings: [], line: 0 });
    }
  }
}

function extractSlotsFromType(typeNode: Node, sourceFile: SourceFile, out: SlotDefinition[]): void {
  const resolved = resolveTypeNode(typeNode);
  if (!resolved) return;

  const members = Node.isTypeLiteral(resolved)
    ? resolved.getMembers()
    : Node.isInterfaceDeclaration(resolved)
      ? resolved.getMembers()
      : [];

  for (const member of members) {
    if (Node.isPropertySignature(member)) {
      const name = member.getName();
      const bindings: string[] = [];
      const innerType = member.getTypeNode();

      if (innerType && Node.isTypeLiteral(innerType)) {
        for (const inner of innerType.getMembers()) {
          if (Node.isPropertySignature(inner)) {
            bindings.push(inner.getName());
          }
        }
      }

      out.push({
        name,
        bindings,
        line: sourceFile.getLineAndColumnAtPos(member.getStart()).line,
      });
    } else if (Node.isMethodSignature(member)) {
      const name = member.getName();
      const bindings: string[] = [];
      const params = member.getParameters();

      if (params.length > 0) {
        const first = params[0];
        const paramType = first?.getTypeNode();
        if (paramType && Node.isTypeLiteral(paramType)) {
          for (const inner of paramType.getMembers()) {
            if (Node.isPropertySignature(inner)) {
              bindings.push(inner.getName());
            }
          }
        }
      }

      out.push({
        name,
        bindings,
        line: sourceFile.getLineAndColumnAtPos(member.getStart()).line,
      });
    }
  }
}

// ============================================================
// defineOptions
// ============================================================

function extractOptions(call: CallExpression, out: VueMacros): void {
  const arg = call.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return;

  let name: string | null = null;
  let inheritAttrs = true;

  for (const prop of arg.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const key = getPropertyName(prop);
      const value = prop.getInitializer();

      if (key === 'name' && value && Node.isStringLiteral(value)) {
        name = value.getLiteralValue();
      }
      if (key === 'inheritAttrs' && value) {
        inheritAttrs = value.getText() !== 'false';
      }
    }
  }

  out.options = { name, inheritAttrs };
}

// ============================================================
// РЕЗОЛВИНГ TYPE-НОДОВ
// ============================================================

/**
 * Резолвит TypeNode до реального TypeLiteral или InterfaceDeclaration.
 *
 * Поддерживает:
 *   - TypeLiteral напрямую: `{ a: string }`
 *   - TypeReference к локальному interface/type-alias
 *   - TypeReference к импортированному interface/type-alias
 */
function resolveTypeNode(typeNode: Node): Node | null {
  if (Node.isTypeLiteral(typeNode)) return typeNode;

  if (Node.isTypeReference(typeNode)) {
    const typeNameNode = typeNode.getTypeName();
    if (!Node.isIdentifier(typeNameNode)) return null;

    const name = typeNameNode.getText();
    const sourceFile = typeNode.getSourceFile();

    // Локальный interface
    const iface = sourceFile.getInterface(name);
    if (iface) return iface;

    // Локальный type-alias
    const alias = sourceFile.getTypeAlias(name);
    if (alias) {
      const inner = alias.getTypeNode();
      if (inner && Node.isTypeLiteral(inner)) return inner;
    }

    // Импортированный interface/type-alias
    const importDecl = sourceFile.getImportDeclaration(imp => {
      return imp.getNamedImports().some(n => n.getName() === name);
    });

    if (importDecl) {
      const moduleSpecifier = importDecl.getModuleSpecifierSourceFile();
      if (moduleSpecifier) {
        const importedIface = moduleSpecifier.getInterface(name);
        if (importedIface) return importedIface;

        const importedAlias = moduleSpecifier.getTypeAlias(name);
        if (importedAlias) {
          const inner = importedAlias.getTypeNode();
          if (inner && Node.isTypeLiteral(inner)) return inner;
        }
      }
    }
  }

  return null;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

/**
 * Извлекает имя свойства из PropertyAssignment.
 *
 * Поддерживает:
 *   - Identifier: { foo: ... }
 *   - StringLiteral: { 'foo': ... }
 *   - NumericLiteral: { 123: ... } → '123'
 */
function getPropertyName(prop: any): string | null {
  try {
    const nameNode = prop.getNameNode?.();

    if (nameNode) {
      if (Node.isIdentifier(nameNode)) return nameNode.getText();
      if (Node.isStringLiteral(nameNode)) return nameNode.getLiteralValue();
      if (Node.isNumericLiteral(nameNode)) return nameNode.getText();
    }
  } catch {
    // ignore
  }

  // Fallback: getName() из ts-morph
  try {
    const name = prop.getName?.();
    if (typeof name === 'string') return name;
  } catch {
    // ignore
  }

  return null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { extractVueMacros, findCallsByName };
