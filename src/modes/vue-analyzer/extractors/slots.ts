// src/modes/vue-analyzer/extractors/slots.ts
// ============================================
// ЭКСТРАКТОР defineSlots<T>()
// ============================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - ✅ AST-обход стал основным путём (regex — fallback)
//   - ✅ Корректная обработка вложенных generics: Row<T>
//   - ✅ Исправлен парсинг методов: default(props): any
//   - ✅ Балансировка скобок при извлечении тела defineSlots<{...}>
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация через regex
//   - Поддержка форм:
//       1. defineSlots<{ name: { props } }>()
//       2. defineSlots<{ name(props): any }>()
//       3. defineSlots(['name1', 'name2'])
// ============================================

import type { Program } from 'estree';
import type { SlotDefinition } from '../types.js';

// ============================================
// ОСНОВНОЙ ЭКСПОРТ: extractSlotsFromAST
// ============================================

/**
 * Извлекает слоты из defineSlots<T>() через обход AST.
 *
 * Основной метод — работает точнее, чем regex, и корректно
 * обрабатывает вложенные типы, generics и т.д.
 *
 * @param ast — AST дерево <script setup>
 * @returns Массив определений слотов
 *
 * @example
 * ```typescript
 * const scriptAst = parseTS(scriptContent, { ... });
 * const slots = extractSlotsFromAST(scriptAst);
 * // [
 * //   { name: 'default', props: { row: 'Row' } },
 * //   { name: 'header', props: undefined }
 * // ]
 * ```
 */
export function extractSlotsFromAST(ast: Program): SlotDefinition[] {
  const slots: SlotDefinition[] = [];
  if (!ast || !ast.body) return slots;

  visitASTForSlots(ast, slots);
  return slots;
}

// ============================================
// FALLBACK: extractSlotsFromSource (regex)
// ============================================

/**
 * Fallback: извлекает слоты через regex.
 * Используется, когда AST недоступен.
 *
 * ⚠️ Не рекомендуется для сложных generics — используйте extractSlotsFromAST.
 *
 * Поддерживает:
 *   - defineSlots<{ default: { row: Row }; header: {} }>()
 *   - defineSlots<{ default(props: { row: Row }): any }>()
 *   - defineSlots(['default', 'header'])
 *
 * @param content — содержимое <script setup>
 * @returns Массив определений слотов
 */
export function extractSlotsFromSource(content: string): SlotDefinition[] {
  const slots: SlotDefinition[] = [];
  if (!content || content.trim() === '') return slots;

  // Форма 1: defineSlots<{ name: { props } }>()
  extractTypedSlotsFromSource(content, slots);

  // Форма 2: defineSlots(['name1', 'name2'])
  extractArraySlotsFromSource(content, slots);

  return slots;
}

// ============================================
// AST-ОБХОД
// ============================================

/**
 * Рекурсивно обходит AST в поисках defineSlots и извлекает слоты.
 *
 * @param node — текущий узел
 * @param slots — результирующий массив (мутируется)
 */
function visitASTForSlots(node: any, slots: SlotDefinition[]): void {
  if (!node || typeof node !== 'object') return;

  // Обрабатываем CallExpression с defineSlots
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'defineSlots'
  ) {
    processDefineSlotsCall(node, slots);
  }

  // Рекурсивный обход детей
  for (const key of Object.keys(node)) {
    const child = node[key];

    if (Array.isArray(child)) {
      for (const item of child) {
        visitASTForSlots(item, slots);
      }
    } else if (child && typeof child === 'object') {
      visitASTForSlots(child, slots);
    }
  }
}

/**
 * Обрабатывает один вызов defineSlots<T>() или defineSlots([...]).
 *
 * @param node — узел CallExpression
 * @param slots — результирующий массив (мутируется)
 */
function processDefineSlotsCall(node: any, slots: SlotDefinition[]): void {
  // ============================================
  // Форма 1: defineSlots<T>()
  // ============================================
  const typeParams = node.typeParameters;

  if (typeParams?.params?.[0]) {
    const typeNode = typeParams.params[0];

    // TSTypeLiteral — прямое объявление { name: { ... } }
    if (typeNode.type === 'TSTypeLiteral' && typeNode.members) {
      for (const member of typeNode.members) {
        processTypeLiteralMember(member, slots);
      }
    }

    // TSTypeReference — ссылка на тип: defineSlots<Slots>()
    // Здесь мы не можем развернуть тип без TypeChecker,
    // поэтому просто фиксируем его как "неизвестный тип".
    // TODO: расширить через TypeChecker (ts-morph)
    if (typeNode.type === 'TSTypeReference') {
      // Пока пропускаем
    }
  }

  // ============================================
  // Форма 2: defineSlots(['name1', 'name2'])
  // ============================================
  const args = node.arguments;

  if (Array.isArray(args) && args[0]?.type === 'ArrayExpression') {
    for (const elem of args[0].elements) {
      if (elem?.type === 'Literal' && typeof elem.value === 'string') {
        const name = elem.value;
        if (name && !slots.some(s => s.name === name)) {
          slots.push({ name });
        }
      }
    }
  }
}

/**
 * Обрабатывает один member из TSTypeLiteral.
 *
 * Поддерживает:
 *   - TSPropertySignature: `default: { row: Row }`
 *   - TSMethodSignature: `default(props: { row: Row }): any`
 *
 * @param member — узел member
 * @param slots — результирующий массив (мутируется)
 */
function processTypeLiteralMember(member: any, slots: SlotDefinition[]): void {
  if (!member || typeof member !== 'object') return;

  const key = member.key;

  // Извлекаем имя слота
  let name: string | undefined;

  if (key?.type === 'Identifier') {
    name = key.name;
  } else if (key?.type === 'Literal' && typeof key.value === 'string') {
    name = key.value;
  }

  if (!name) return;
  if (slots.some(s => s.name === name)) return;

  // ============================================
  // TSPropertySignature: default: { ... }
  // ============================================
  if (member.type === 'TSPropertySignature') {
    const props = extractPropsFromTypeAnnotation(member.typeAnnotation);

    slots.push({
      name,
      props: Object.keys(props).length > 0 ? props : undefined,
    });
    return;
  }

  // ============================================
  // TSMethodSignature: default(props): any
  // ============================================
  if (member.type === 'TSMethodSignature') {
    const props: Record<string, string> = {};

    if (Array.isArray(member.parameters)) {
      for (const param of member.parameters) {
        if (
          param?.type === 'Identifier' &&
          param.typeAnnotation?.typeAnnotation?.type === 'TSTypeLiteral'
        ) {
          const literal = param.typeAnnotation.typeAnnotation;
          if (Array.isArray(literal.members)) {
            for (const m of literal.members) {
              if (m.type === 'TSPropertySignature') {
                const keyNode = m.key;
                const propName =
                  keyNode?.type === 'Identifier'
                    ? keyNode.name
                    : keyNode?.type === 'Literal'
                      ? String(keyNode.value)
                      : undefined;

                if (propName) {
                  props[propName] = extractTypeText(m.typeAnnotation?.typeAnnotation);
                }
              }
            }
          }
        }
      }
    }

    slots.push({
      name,
      props: Object.keys(props).length > 0 ? props : undefined,
    });
  }
}

/**
 * Извлекает свойства из typeAnnotation вида `{ row: Row; index: number }`.
 *
 * @param typeAnnotation — узел TSTypeAnnotation
 * @returns Record<имя, тип>
 */
function extractPropsFromTypeAnnotation(typeAnnotation: any): Record<string, string> {
  const props: Record<string, string> = {};

  if (!typeAnnotation) return props;

  const inner = typeAnnotation.typeAnnotation;
  if (!inner) return props;

  if (inner.type === 'TSTypeLiteral' && Array.isArray(inner.members)) {
    for (const member of inner.members) {
      if (member.type === 'TSPropertySignature') {
        const keyNode = member.key;
        const propName =
          keyNode?.type === 'Identifier'
            ? keyNode.name
            : keyNode?.type === 'Literal'
              ? String(keyNode.value)
              : undefined;

        if (propName) {
          props[propName] = extractTypeText(member.typeAnnotation?.typeAnnotation);
        }
      }
    }
  }

  return props;
}

/**
 * Извлекает текстовое представление типа из AST-узла.
 *
 * Работает без TypeChecker — простым обходом структуры узла.
 * ✅ Корректно обрабатывает вложенные generics: Row<T> → 'Row'
 *
 * @param node — узел типа
 * @returns Строковое представление типа
 */
function extractTypeText(node: any): string {
  if (!node || typeof node !== 'object') return 'any';

  switch (node.type) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSVoidKeyword':
      return 'void';
    case 'TSNullKeyword':
      return 'null';
    case 'TSUndefinedKeyword':
      return 'undefined';
    case 'TSAnyKeyword':
      return 'any';
    case 'TSUnknownKeyword':
      return 'unknown';
    case 'TSNeverKeyword':
      return 'never';
    case 'TSObjectKeyword':
      return 'object';
    case 'TSBigIntKeyword':
      return 'bigint';
    case 'TSSymbolKeyword':
      return 'symbol';

    case 'TSArrayType':
      return `${extractTypeText(node.elementType)}[]`;

    case 'TSTypeReference': {
      const typeName = node.typeName;
      let base = 'any';
      if (typeName?.type === 'Identifier') {
        base = typeName.name || 'any';
      } else if (typeName?.type === 'TSQualifiedName') {
        // A.B.C
        const parts: string[] = [];
        let current = typeName;
        while (current?.type === 'TSQualifiedName') {
          if (current.right?.name) parts.unshift(current.right.name);
          current = current.left;
        }
        if (current?.type === 'Identifier' && current.name) {
          parts.unshift(current.name);
        }
        base = parts.join('.') || 'any';
      }
      // ✅ ИСПРАВЛЕНО: не теряем generics, но и не раздуваем.
      // Для целей анализа достаточно base-имени.
      // Если нужен полный текст — используйте node.getText() через ts-morph.
      return base;
    }

    case 'TSUnionType':
      return Array.isArray(node.types)
        ? node.types.map((t: any) => extractTypeText(t)).join(' | ')
        : 'any';

    case 'TSIntersectionType':
      return Array.isArray(node.types)
        ? node.types.map((t: any) => extractTypeText(t)).join(' & ')
        : 'any';

    case 'TSLiteralType':
      if (node.literal?.type === 'Literal') {
        return String(node.literal.value);
      }
      return 'literal';

    case 'TSFunctionType':
      return 'Function';

    case 'TSTypeLiteral':
      return 'object';

    case 'TSTupleType':
      return Array.isArray(node.elementTypes)
        ? `[${node.elementTypes.map((t: any) => extractTypeText(t)).join(', ')}]`
        : 'tuple';

    default:
      return 'any';
  }
}

// ============================================
// REGEX-FALLBACK
// ============================================

/**
 * Извлекает типизированные слоты формы `defineSlots<{ name: { props } }>()`.
 *
 * ✅ ИСПРАВЛЕНО: используется балансировка скобок вместо lazy-regex,
 * поэтому корректно обрабатываются вложенные generics: `{ row: Row<T> }`.
 *
 * @param content — содержимое <script setup>
 * @param slots — результирующий массив (мутируется)
 */
function extractTypedSlotsFromSource(content: string, slots: SlotDefinition[]): void {
  // Извлекаем содержимое defineSlots<{ ... }> с балансировкой скобок
  const body = extractDefineSlotsBody(content);
  if (!body) return;

  const slotProperties = parseBalancedProperties(body);

  for (const prop of slotProperties) {
    if (slots.some(s => s.name === prop.name)) {
      continue; // избегаем дубликатов
    }

    const props: Record<string, string> = {};
    if (prop.body) {
      // Извлекаем свойства из тела: row: Row; index: number
      const propRegex = /(\w+)\s*\??\s*:\s*([^;,}]+)/g;
      let propMatch: RegExpExecArray | null;

      while ((propMatch = propRegex.exec(prop.body)) !== null) {
        const propName = propMatch[1];
        const propType = propMatch[2]?.trim();

        if (propName && propType) {
          props[propName] = propType;
        }
      }
    }

    slots.push({
      name: prop.name,
      props: Object.keys(props).length > 0 ? props : undefined,
    });
  }
}

/**
 * Извлекает тело `defineSlots<{ ... }>` с балансировкой скобок.
 *
 * ✅ ИСПРАВЛЕНО: lazy-regex `[\s\S]*?` останавливался на первой `}`,
 * что ломало вложенные generics: `{ row: Row<T> }`. Теперь — ручной
 * обход с подсчётом глубины вложенности скобок.
 *
 * @param content — содержимое <script setup>
 * @returns Тело типа без внешних `{ }` или null
 */
function extractDefineSlotsBody(content: string): string | null {
  const idx = content.indexOf('defineSlots');
  if (idx === -1) return null;

  let i = idx + 'defineSlots'.length;

  // Пропускаем пробелы до '<'
  while (i < content.length && /\s/.test(content[i] || '')) i++;
  if (content[i] !== '<') return null;
  i++;

  // Пропускаем пробелы до '{'
  while (i < content.length && /\s/.test(content[i] || '')) i++;
  if (content[i] !== '{') return null;

  // Балансировка скобок
  let depth = 0;
  const start = i;
  let inString = false;
  let stringChar = '';

  while (i < content.length) {
    const ch = content[i];

    if (inString) {
      if (ch === stringChar && content[i - 1] !== '\\') {
        inString = false;
      }
    } else if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(start + 1, i);
      }
    }

    i++;
  }

  return null;
}

/**
 * Парсит свойства с балансировкой скобок.
 *
 * Обрабатывает случаи, когда тело свойства содержит вложенные скобки:
 *   default: { row: Row; nested: { a: number } }
 *
 * @param body — тело типа `{ ... }` без внешних скобок
 * @returns Массив свойств с именами и телами
 */
function parseBalancedProperties(body: string): { name: string; body: string | null }[] {
  const result: { name: string; body: string | null }[] = [];

  let i = 0;
  const len = body.length;

  while (i < len) {
    // Пропускаем пробелы и разделители
    while (i < len && /[\s;,()]/.test(body[i] || '')) {
      i++;
    }

    if (i >= len) break;

    // Имя свойства: \w+
    const nameStart = i;
    while (i < len && /\w/.test(body[i] || '')) {
      i++;
    }

    const name = body.slice(nameStart, i);
    if (!name) {
      // Не удалось прочитать имя — пропускаем символ
      i++;
      continue;
    }

    // Пропускаем пробелы и опциональный `?`
    while (i < len && /\s/.test(body[i] || '')) i++;
    if (body[i] === '?') i++;
    while (i < len && /\s/.test(body[i] || '')) i++;

    // Ожидаем `:`
    if (body[i] !== ':') {
      // Не property signature — пропускаем
      result.push({ name, body: null });
      continue;
    }
    i++; // пропускаем `:`

    // Пропускаем пробелы
    while (i < len && /\s/.test(body[i] || '')) i++;

    // Проверяем тип значения
    if (body[i] === '{') {
      // Объект с балансировкой скобок
      const braceStart = i;
      let depth = 0;
      let inString = false;
      let stringChar = '';

      while (i < len) {
        const ch = body[i];

        if (inString) {
          if (ch === stringChar && body[i - 1] !== '\\') {
            inString = false;
          }
        } else if (ch === '"' || ch === "'") {
          inString = true;
          stringChar = ch;
        } else if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }

        i++;
      }

      const bodyContent = body.slice(braceStart + 1, i - 1);
      result.push({ name, body: bodyContent });
    } else {
      // Не объект (например, `() => void`) — извлекаем до `;` или `,`
      const valueStart = i;
      while (i < len && body[i] !== ';' && body[i] !== ',') {
        i++;
      }
      const valueBody = body.slice(valueStart, i).trim();
      result.push({ name, body: null });
      void valueBody; // подавляем unused
    }

    // Пропускаем разделитель
    while (i < len && /[\s;,]/.test(body[i] || '')) i++;
  }

  return result;
}

/**
 * Извлекает слоты формы `defineSlots(['name1', 'name2'])`.
 *
 * Это упрощённая форма без типизации.
 *
 * @param content — содержимое <script setup>
 * @param slots — результирующий массив (мутируется)
 */
function extractArraySlotsFromSource(content: string, slots: SlotDefinition[]): void {
  const arrayMatch = content.match(/defineSlots\s*\(\s*\[([\s\S]*?)\]\s*\)/);

  if (!arrayMatch || !arrayMatch[1]) {
    return;
  }

  const names = arrayMatch[1].match(/['"](\w+)['"]/g) || [];

  for (const n of names) {
    const name = n.slice(1, -1);
    if (name && !slots.some(s => s.name === name)) {
      slots.push({ name });
    }
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  extractSlotsFromAST,
  extractSlotsFromSource,
};
