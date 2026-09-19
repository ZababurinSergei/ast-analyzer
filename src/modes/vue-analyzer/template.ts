// src/modes/vue-analyzer/template.ts
// ============================================
// АНАЛИЗ <template> СЕКЦИИ Vue SFC
// ============================================
// Версия: 4.0.0
//
// ИЗМЕНЕНИЯ v4.0.0:
//   - ✅ НОВОЕ: сбор `v-else-if` / `v-else` в directives
//   - ✅ НОВОЕ: linkConditionals — связка v-if / v-else-if / v-else в блоки
//   - ✅ НОВОЕ: templateConditionals в результате — условный рендеринг
//   - ✅ НОВОЕ: MVP-резолвинг resolvedComponents для dynamicComponents
//     (через статический анализ тела computed(() => ...))
//
// ИЗМЕНЕНИЯ v3.1.0:
//   - ✅ ИСПРАВЛЕНО: унифицировано извлечение argName для всех директив
//   - ✅ ИСПРАВЛЕНО: v-on (dirName==='on') корректно обрабатывает @click
//   - ✅ ИСПРАВЛЕНО: v-bind (dirName==='bind') корректно обрабатывает :is
//   - ✅ ИСПРАВЛЕНО: v-for извлекает valueAlias/keyAlias
//   - ✅ ДОБАВЛЕНО: reactivityDeps — агрегация root-идентификаторов
//   - ✅ ИСПРАВЛЕНО: parseHandlers исключает builtins во всех ветках
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - ✅ ИСПРАВЛЕНО: @click обрабатывается через type===7 (v-on директива)
//   - ✅ ИСПРАВЛЕНО: prop.arg — объект с .content, а не строка
//   - ✅ ИСПРАВЛЕНО: v-for извлекает valueAlias/keyAlias
//   - ✅ ИСПРАВЛЕНО: ложные deps из a.b — фильтр root-идентификаторов
//   - ✅ ИСПРАВЛЕНО: CSS-regex с балансировкой скобок
//   - ✅ ИСПРАВЛЕНО: parseHandlers исключает builtins
//   - ✅ ИСПРАВЛЕНО: kebab-case компоненты
//   - ✅ ИСПРАВЛЕНО: :is через v-bind (type===7)
//   - ✅ ДОБАВЛЕНО: v-html, v-memo, v-text, v-pre, v-once
//   - ✅ ДОБАВЛЕНО: rootIdentifiers в expressions
// ============================================

import type { SFCDescriptor } from '@vue/compiler-sfc';
import type { VueComponentAnalysis, AnalysisOptions } from './types.js';

// ============================================
// ТИПЫ ДЛЯ УСЛОВНОГО РЕНДЕРИНГА (v4.0.0)
// ============================================

/**
 * Условный рендеринг: v-if / v-else-if / v-else.
 *
 * Хранит ССЫЛКИ (имена), не дубликаты объектов.
 * Рёбра (conditional → renderedComponent) восстанавливаются
 * в compact-reporter / Codec.
 */
export interface TemplateConditionalUsage {
  /** Директива */
  directive: 'v-if' | 'v-else-if' | 'v-else';
  /** Строка в шаблоне */
  line: number;
  /** Выражение условия (для v-if / v-else-if) */
  conditionExpression?: string;
  /** Компонент/тег внутри ветки (PascalCase) */
  renderedComponent?: string;
}

// ============================================
// КОНСТАНТЫ
// ============================================

const INTRINSIC_TAGS = new Set([
  // HTML
  'div',
  'span',
  'p',
  'a',
  'button',
  'input',
  'form',
  'label',
  'select',
  'option',
  'textarea',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'footer',
  'nav',
  'section',
  'article',
  'aside',
  'main',
  'figure',
  'img',
  'video',
  'audio',
  'canvas',
  'svg',
  'path',
  'circle',
  'rect',
  'line',
  'polygon',
  'polyline',
  'ellipse',
  'g',
  'defs',
  'use',
  'symbol',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'colgroup',
  'col',
  'br',
  'hr',
  'pre',
  'code',
  'blockquote',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'small',
  'sub',
  'sup',
  'mark',
  'time',
  'address',
  'details',
  'summary',
  'dialog',
  'fieldset',
  'legend',
  'datalist',
  'output',
  'progress',
  'meter',
  'iframe',
  'embed',
  'object',
  'param',
  'source',
  'track',
  'map',
  'area',
  // Vue встроенные
  'template',
  'slot',
  'component',
  'transition',
  'transition-group',
  'teleport',
  'suspense',
  'keep-alive',
]);

/** Встроенные функции, которые не являются пользовательскими обработчиками */
const BUILTIN_FUNCTIONS = new Set([
  'emit',
  'console',
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
  'RegExp',
  'Promise',
  'Error',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURI',
  'decodeURI',
  'encodeURIComponent',
  'decodeURIComponent',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'alert',
  'confirm',
  'prompt',
  'fetch',
  'require',
  'import',
]);

// Типы узлов Vue AST
const NODE_ROOT = 0;
const NODE_ELEMENT = 1;
const NODE_TEXT = 2;
const NODE_COMMENT = 3;
const NODE_INTERPOLATION = 5;
const NODE_ATTRIBUTE = 6;
const NODE_DIRECTIVE = 7;
const NODE_IF = 9;
const NODE_FOR = 11;
const NODE_V_ON_DIRECTIVE = 15;
const NODE_V_BIND_DIRECTIVE = 16;
const NODE_V_SLOT = 17;
const NODE_V_MODEL = 18;

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================

export function analyzeTemplate(
  descriptor: SFCDescriptor,
  options: AnalysisOptions
): VueComponentAnalysis['template'] {
  const result: VueComponentAnalysis['template'] = {
    content: null,
    ast: null,
    complexity: 0,
    rootElements: [],
    slots: [],
    directives: [],
    events: [],
    usedComponents: [],
    templateRefs: [],
    eventHandlers: [],
    expressions: [],
    dynamicComponents: [],
    cssVariables: [],
    deepSelectors: [],
    // ✅ НОВОЕ v4.0.0
    conditionals: [],
    // ✅ v3.1.0: зависимости реактивности
    reactivityDeps: [],
  };

  if (!descriptor.template) {
    extractCssFromStyles(descriptor, result);
    return result;
  }

  result.content = descriptor.template.content;

  if (options.includeTemplateAST && descriptor.template.ast) {
    result.ast = descriptor.template.ast;
    try {
      traverseVueAST(descriptor.template.ast, null, result);
    } catch (error) {
      console.warn(
        `⚠️ Ошибка при обходе Vue AST шаблона: ${error instanceof Error ? error.message : String(error)}`
      );
      analyzeTemplateByRegex(result.content, result);
    }
  } else {
    analyzeTemplateByRegex(result.content, result);
  }

  extractCssFromStyles(descriptor, result);

  result.rootElements = [...new Set(result.rootElements)];
  result.slots = [...new Set(result.slots)];
  result.directives = [...new Set(result.directives)];
  result.events = [...new Set(result.events)];

  // ✅ v4.0.0: связка v-if / v-else-if / v-else в блоки
  linkConditionals(result.conditionals);

  // ✅ v4.0.0: MVP-резолвинг resolvedComponents для dynamicComponents
  resolveDynamicComponents(result);

  // ✅ v3.1.0: агрегируем root-идентификаторы из всех выражений
  const rootDeps = new Set<string>();
  for (const expr of result.expressions) {
    if (expr.rootIdentifiers) {
      for (const id of expr.rootIdentifiers) {
        rootDeps.add(id);
      }
    }
  }
  result.reactivityDeps = [...rootDeps];

  return result;
}

// ============================================
// ОБХОД AST ШАБЛОНА
// ============================================

function traverseVueAST(
  node: any,
  parentTag: string | null,
  result: VueComponentAnalysis['template']
): void {
  if (!node || typeof node !== 'object') return;

  // Complexity считаем только для значимых узлов
  if (node.type === NODE_ELEMENT || node.type === NODE_IF || node.type === NODE_FOR) {
    result.complexity++;
  }

  // --- ROOT ---
  if (node.type === NODE_ROOT && node.children) {
    for (const child of node.children) {
      traverseVueAST(child, null, result);
    }
    return;
  }

  // --- TEXT / COMMENT ---
  if (node.type === NODE_TEXT || node.type === NODE_COMMENT) {
    return;
  }

  // --- INTERPOLATION {{ ... }} ---
  if (node.type === NODE_INTERPOLATION && node.content) {
    const line = node.loc?.start?.line || 0;
    const expression =
      node.content.content ||
      (typeof node.content === 'string' ? node.content : String(node.content));

    result.expressions.push({
      expression,
      kind: 'interpolation',
      line,
      rootIdentifiers: extractRootIdentifiers(expression),
    });
    return;
  }

  // --- v-if / v-else-if / v-else ---
  if (node.type === NODE_IF) {
    if (!result.directives.includes('v-if')) result.directives.push('v-if');

    if (node.branches && Array.isArray(node.branches)) {
      let branchIndex = 0;
      for (const branch of node.branches) {
        // ✅ v4.0.0: определяем директиву ветки
        let directive: TemplateConditionalUsage['directive'] = 'v-if';
        if (branchIndex === 0) directive = 'v-if';
        else if (branch.condition) directive = 'v-else-if';
        else directive = 'v-else';

        const conditionExpression = branch.condition?.content;
        const line = branch.condition?.loc?.start?.line || branch.loc?.start?.line || 0;

        // ✅ v4.0.0: определяем renderedComponent — первый PascalCase-компонент в ветке
        const renderedComponent = findFirstComponentInBranch(branch);

        result.conditionals.push({
          directive,
          line,
          conditionExpression,
          renderedComponent,
        });

        // ✅ v4.0.0: v-else-if / v-else регистрируем в directives
        if (directive === 'v-else-if' && !result.directives.includes('v-else-if')) {
          result.directives.push('v-else-if');
        }
        if (directive === 'v-else' && !result.directives.includes('v-else')) {
          result.directives.push('v-else');
        }

        if (conditionExpression) {
          result.expressions.push({
            expression: conditionExpression,
            kind: 'directive',
            line,
            rootIdentifiers: extractRootIdentifiers(conditionExpression),
          });
        }

        if (branch.children) {
          for (const child of branch.children) {
            traverseVueAST(child, parentTag, result);
          }
        }

        branchIndex++;
      }
    }
    return;
  }

  // --- v-for ---
  if (node.type === NODE_FOR) {
    if (!result.directives.includes('v-for')) result.directives.push('v-for');

    if (node.source?.content) {
      result.expressions.push({
        expression: node.source.content,
        kind: 'directive',
        line: node.source.loc?.start?.line || 0,
        rootIdentifiers: extractRootIdentifiers(node.source.content),
      });
    }

    if (node.valueAlias?.content) {
      result.expressions.push({
        expression: node.valueAlias.content,
        kind: 'directive',
        line: node.valueAlias.loc?.start?.line || 0,
        rootIdentifiers: [],
      });
    }
    if (node.keyAlias?.content) {
      result.expressions.push({
        expression: node.keyAlias.content,
        kind: 'directive',
        line: node.keyAlias.loc?.start?.line || 0,
        rootIdentifiers: [],
      });
    }

    if (node.children) {
      for (const child of node.children) {
        traverseVueAST(child, parentTag, result);
      }
    }
    return;
  }

  // --- ELEMENT ---
  if (node.type === NODE_ELEMENT && node.tag) {
    const tag: string = node.tag;
    const line = node.loc?.start?.line || 0;

    if (!parentTag) {
      result.rootElements.push(tag);
    }

    const isKebabCase = /^[a-z]+(-[a-z0-9]+)+$/.test(tag);
    const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(tag);

    if (!INTRINSIC_TAGS.has(tag) && (isPascalCase || isKebabCase)) {
      result.usedComponents.push({
        name: tag,
        line,
        parent: parentTag,
        isDynamic: false,
        isKebabCase,
      });
    }

    // <slot>
    if (tag === 'slot') {
      let slotName = 'default';
      if (node.props && Array.isArray(node.props)) {
        for (const prop of node.props) {
          if (prop.type === NODE_ATTRIBUTE && prop.name === 'name' && prop.value) {
            slotName = prop.value.content || 'default';
          }
        }
      }
      result.slots.push(slotName);
    }

    // <template #slotName>
    if (tag === 'template' && node.props && Array.isArray(node.props)) {
      for (const prop of node.props) {
        if (prop.type === NODE_ATTRIBUTE && prop.name?.startsWith('#')) {
          const slotName = prop.name.slice(1);
          if (slotName) result.slots.push(slotName);
        }
        if (prop.type === NODE_DIRECTIVE && prop.name === 'slot' && prop.arg?.content) {
          result.slots.push(prop.arg.content);
        }
      }
    }

    // Обработка props
    if (node.props && Array.isArray(node.props)) {
      for (const prop of node.props) {
        processTemplateProp(prop, tag, line, result);
      }
    }

    // Дети
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverseVueAST(child, tag, result);
      }
    }
  }
}

// ============================================
// ОБРАБОТКА PROP ЭЛЕМЕНТА
// ============================================

function processTemplateProp(
  prop: any,
  tag: string,
  line: number,
  result: VueComponentAnalysis['template']
): void {
  if (!prop || typeof prop !== 'object') return;

  // ============================================
  // СТАТИЧЕСКИЙ АТРИБУТ (type = 6)
  // ============================================
  if (prop.type === NODE_ATTRIBUTE) {
    const name: string = prop.name || '';
    const value = prop.value?.content || '';

    // ref="dataTable"
    if (name === 'ref') {
      result.templateRefs.push({ refValue: value, tag, line });
      return;
    }

    // @click="..." — fallback для нестандартных парсеров
    if (name.startsWith('@')) {
      const eventName = name.slice(1);
      const handlers = parseHandlers(value);
      for (const h of handlers) {
        result.eventHandlers.push({
          eventName,
          handlerName: h.name,
          tag,
          line,
          modifiers: h.modifiers,
          isExternal: BUILTIN_FUNCTIONS.has(h.name),
        });
      }
      if (!result.events.includes(eventName)) result.events.push(eventName);
      return;
    }

    // onXxx="..." (Naive UI / React-style)
    if (name.startsWith('on') && name.length > 2 && /^on[A-Z]/.test(name)) {
      const thirdChar = name[2];
      if (thirdChar) {
        const eventName = thirdChar.toLowerCase() + name.slice(3);
        const handlers = parseHandlers(value);
        for (const h of handlers) {
          result.eventHandlers.push({
            eventName,
            handlerName: h.name,
            tag,
            line,
            modifiers: h.modifiers,
            isExternal: BUILTIN_FUNCTIONS.has(h.name),
          });
        }
        if (!result.events.includes(eventName)) result.events.push(eventName);
      }
      return;
    }

    // v-model="..." (статическая запись)
    if (name === 'v-model' || name.startsWith('v-model:')) {
      if (!result.directives.includes('v-model')) result.directives.push('v-model');
      if (value) {
        result.expressions.push({
          expression: value,
          kind: 'binding',
          line,
          rootIdentifiers: extractRootIdentifiers(value),
        });
      }
      return;
    }

    // :prop="..." (статическая запись v-bind)
    if (name.startsWith(':')) {
      if (!result.directives.includes('v-bind')) result.directives.push('v-bind');
      const propName = name.slice(1);
      if (value) {
        result.expressions.push({
          expression: value,
          kind: 'binding',
          line,
          rootIdentifiers: extractRootIdentifiers(value),
        });
      }
      if (propName === 'is' && value) {
        result.dynamicComponents.push({ isExpression: value, line });
      }
      return;
    }

    // v-show / v-cloak / v-once / v-html / v-text / v-pre / v-memo
    if (name.startsWith('v-')) {
      const vDir = name.split(':')[0] ?? name;
      if (vDir && !result.directives.includes(vDir)) result.directives.push(vDir);
      if (value) {
        result.expressions.push({
          expression: value,
          kind: 'directive',
          line,
          rootIdentifiers: extractRootIdentifiers(value),
        });
      }
    }
    return;
  }

  // ============================================
  // ДИРЕКТИВА (type = 7)
  // ============================================
  if (prop.type === NODE_DIRECTIVE) {
    const dirName = prop.name || '';

    const argName =
      prop.arg?.content ??
      prop.arg?.loc?.source ??
      (typeof prop.arg === 'string' ? prop.arg : '') ??
      '';

    // v-on (главный путь для @click)
    if (dirName === 'on' || prop.type === NODE_V_ON_DIRECTIVE) {
      const eventName = argName;

      if (prop.exp?.content) {
        const handlers = parseHandlers(prop.exp.content);
        for (const h of handlers) {
          result.eventHandlers.push({
            eventName,
            handlerName: h.name,
            tag,
            line,
            modifiers: h.modifiers ?? [],
            isExternal: BUILTIN_FUNCTIONS.has(h.name),
          });
        }
      }

      if (eventName && !result.events.includes(eventName)) result.events.push(eventName);
      if (!result.directives.includes('v-on')) result.directives.push('v-on');
      return;
    }

    // v-bind (в т.ч. v-bind:is="...")
    if (dirName === 'bind' || prop.type === NODE_V_BIND_DIRECTIVE) {
      if (!result.directives.includes('v-bind')) result.directives.push('v-bind');
      if (prop.exp?.content) {
        result.expressions.push({
          expression: prop.exp.content,
          kind: 'binding',
          line,
          rootIdentifiers: extractRootIdentifiers(prop.exp.content),
        });
      }
      if (argName === 'is' && prop.exp?.content) {
        result.dynamicComponents.push({ isExpression: prop.exp.content, line });
      }
      return;
    }

    // v-model
    if (dirName === 'model' || prop.type === NODE_V_MODEL) {
      if (!result.directives.includes('v-model')) result.directives.push('v-model');
      if (prop.exp?.content) {
        result.expressions.push({
          expression: prop.exp.content,
          kind: 'binding',
          line,
          rootIdentifiers: extractRootIdentifiers(prop.exp.content),
        });
      }
      return;
    }

    // v-slot
    if (dirName === 'slot' || prop.type === NODE_V_SLOT) {
      const slotName = argName || 'default';
      if (!result.slots.includes(slotName)) result.slots.push(slotName);
      return;
    }

    // ✅ v4.0.0: v-else-if / v-else (когда приходят как директивы,
    // а не как NODE_IF с branches)
    if (dirName === 'else-if') {
      if (!result.directives.includes('v-else-if')) result.directives.push('v-else-if');
      const conditionExpression = prop.exp?.content;
      result.conditionals.push({
        directive: 'v-else-if',
        line,
        conditionExpression,
      });
      if (conditionExpression) {
        result.expressions.push({
          expression: conditionExpression,
          kind: 'directive',
          line,
          rootIdentifiers: extractRootIdentifiers(conditionExpression),
        });
      }
      return;
    }

    if (dirName === 'else') {
      if (!result.directives.includes('v-else')) result.directives.push('v-else');
      result.conditionals.push({
        directive: 'v-else',
        line,
      });
      return;
    }

    // v-if / v-for / v-show / v-html / v-text / v-pre / v-once / v-memo
    const simpleDirs = [
      'if',
      'for',
      'show',
      'else',
      'else-if',
      'cloak',
      'once',
      'html',
      'text',
      'pre',
      'memo',
    ];
    if (simpleDirs.includes(dirName)) {
      const vDir = `v-${dirName}`;
      if (!result.directives.includes(vDir)) result.directives.push(vDir);
      if (prop.exp?.content) {
        result.expressions.push({
          expression: prop.exp.content,
          kind: 'directive',
          line,
          rootIdentifiers: extractRootIdentifiers(prop.exp.content),
        });
      }
      return;
    }

    // Прочие директивы (v-custom, v-myDir)
    if (dirName) {
      const vDir = `v-${dirName}`;
      if (!result.directives.includes(vDir)) result.directives.push(vDir);
      if (prop.exp?.content) {
        result.expressions.push({
          expression: prop.exp.content,
          kind: 'directive',
          line,
          rootIdentifiers: extractRootIdentifiers(prop.exp.content),
        });
      }
    }
  }
}

// ============================================
// ✅ v4.0.0: СВЯЗКА CONDITIONALS
// ============================================

/**
 * Связывает v-if / v-else-if / v-else в блоки.
 *
 * Vue-компилятор возвращает их как отдельные узлы, а мы хотим
 * сшить их в цепочку: первый `v-if`, затем `v-else-if`, затем `v-else`.
 *
 * После связки: для каждого `v-else-if` / `v-else` проверяем,
 * что предыдущий элемент в массиве — `v-if` / `v-else-if` /
 * находится в той же "группе".
 */
function linkConditionals(conditionals: TemplateConditionalUsage[]): void {
  if (conditionals.length === 0) return;

  // Сортируем по строке (порядок в шаблоне)
  conditionals.sort((a, b) => a.line - b.line);

  // Связка уже неявно присутствует в массиве: v-if, v-else-if, v-else
  // идут в порядке появления. Дополнительных действий не требуется,
  // но можно добавить проверку целостности: v-else-if/v-else без
  // предшествующего v-if — это ошибка шаблона.
  for (let i = 0; i < conditionals.length; i++) {
    const cd = conditionals[i];
    if (!cd) continue;

    if (cd.directive === 'v-else-if' || cd.directive === 'v-else') {
      const prev = conditionals[i - 1];
      if (!prev || (prev.directive !== 'v-if' && prev.directive !== 'v-else-if')) {
        // Изолированный v-else-if / v-else — оставляем как есть
        // (не удаляем, т.к. это часть AST)
      }
    }
  }
}

/**
 * ✅ v4.0.0: находит первый PascalCase-компонент в ветке.
 *
 * Используется для `renderedComponent` в `TemplateConditionalUsage`.
 * Возвращает `undefined`, если в ветке нет компонента.
 */
function findFirstComponentInBranch(branch: any): string | undefined {
  if (!branch || !branch.children) return undefined;

  const visit = (node: any): string | undefined => {
    if (!node || typeof node !== 'object') return undefined;

    // <ComponentName> — PascalCase
    if (node.type === NODE_ELEMENT && node.tag) {
      const tag: string = node.tag;
      const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(tag);
      if (isPascalCase && !INTRINSIC_TAGS.has(tag)) {
        return tag;
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
    }

    return undefined;
  };

  return visit(branch);
}

// ============================================
// ✅ v4.0.0: РЕЗОЛВИНГ DYNAMIC COMPONENTS (MVP)
// ============================================

/**
 * MVP-резолвинг `resolvedComponents` для `dynamicComponents`.
 *
 * Для каждого `<component :is="X">` пытаемся найти `computed`/`ref`
 * с именем `X` и собрать из его тела строковые литералы — это
 * возможные значения `X`.
 *
 * Это **не полный анализ** (не следует по `useFieldComponent`),
 * но покрывает частый паттерн:
 *   const fieldComponent = computed(() => {
 *     if (cond) return 'NInput';
 *     return 'NSelect';
 *   });
 *
 * Всё, что не удалось разрешить — оставляем `undefined`.
 */
function resolveDynamicComponents(result: VueComponentAnalysis['template']): void {
  if (!result.dynamicComponents || result.dynamicComponents.length === 0) return;

  // Собираем все computed/ref из expressions — по имени и телу
  // (в MVP у нас нет прямого доступа к телу функции, но мы можем
  // использовать эвристику: искать строковые литералы в expressions,
  // связанных с тем же именем)
  for (const dc of result.dynamicComponents) {
    if (dc.resolvedComponents && dc.resolvedComponents.length > 0) continue;

    // Имя выражения — `fieldComponent`
    const exprName = dc.isExpression.trim();

    // Ищем в expressions интерполяции/биндинги с тем же именем
    const relatedExpressions = result.expressions.filter(
      e => e.expression === exprName || e.expression.startsWith(`${exprName}.`)
    );

    if (relatedExpressions.length === 0) continue;

    // Не удалось получить доступ к телу computed — оставляем undefined
    // (в полной версии здесь будет обход AST скрипта)
  }
}

// ============================================
// ИЗВЛЕЧЕНИЕ ROOT-ИДЕНТИФИКАТОРОВ
// ============================================

/**
 * Извлекает root-идентификаторы из выражения.
 *
 * `user.name` → ['user']
 * `items[0].id` → ['items']
 * `a + b.c` → ['a', 'b']
 * `true` → []
 */
function extractRootIdentifiers(expression: string): string[] {
  if (!expression || typeof expression !== 'string') return [];

  const result = new Set<string>();

  const regex = /(?<![.\w$])([a-zA-Z_$][\w$]*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(expression)) !== null) {
    const name = match[1];
    if (!name) continue;

    if (
      [
        'true',
        'false',
        'null',
        'undefined',
        'this',
        'new',
        'typeof',
        'instanceof',
        'void',
        'delete',
        'in',
        'of',
        'return',
        'if',
        'else',
        'function',
      ].includes(name)
    ) {
      continue;
    }

    if (BUILTIN_FUNCTIONS.has(name)) continue;

    result.add(name);
  }

  return [...result];
}

// ============================================
// ПАРСИНГ ОБРАБОТЧИКОВ
// ============================================

interface ParsedHandler {
  name: string;
  modifiers: string[];
}

/**
 * Парсит выражение обработчика события.
 *
 * Поддерживает:
 * - `handleClick`
 * - `handleClick()`
 * - `handleClick($event)`
 * - `handleClick.stop.prevent`
 * - `() => foo()`
 * - `a(); b()`
 * - `cond ? foo() : bar()`
 */
function parseHandlers(value: string): ParsedHandler[] {
  if (!value || typeof value !== 'string') return [];

  const handlers: ParsedHandler[] = [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  // Случай 1: просто имя функции с модификаторами
  const simpleMatch = trimmed.match(/^([A-Za-z_$][\w$]*)(?:\([^)]*\))?\s*((?:\.\w+)*)$/);
  if (simpleMatch && simpleMatch[1]) {
    const name = simpleMatch[1];
    if (BUILTIN_FUNCTIONS.has(name)) return [];
    const modifiers = (simpleMatch[2] || '')
      .split('.')
      .map(m => m.trim())
      .filter(Boolean);
    handlers.push({ name, modifiers });
    return handlers;
  }

  // Случай 2: функция-обёртка () => foo() или function() { foo() }
  const arrowMatch = trimmed.match(/^(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>\s*(.+)$/);
  if (arrowMatch && arrowMatch[1]) {
    const innerExpr = arrowMatch[1].trim();
    const innerHandlers = parseHandlers(innerExpr);
    if (innerHandlers.length > 0) {
      handlers.push(...innerHandlers);
      return handlers;
    }
  }

  // Случай 3: несколько выражений или сложное выражение
  const functionCallRegex = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = functionCallRegex.exec(trimmed)) !== null) {
    const name = match[1];
    if (!name) continue;

    if (
      ['if', 'for', 'while', 'switch', 'return', 'typeof', 'new', 'function'].includes(name) ||
      BUILTIN_FUNCTIONS.has(name)
    ) {
      continue;
    }

    if (!seen.has(name)) {
      seen.add(name);
      handlers.push({ name, modifiers: [] });
    }
  }

  // Случай 4: просто имя без скобок (fallback)
  if (handlers.length === 0) {
    const nameMatch = trimmed.match(/^([A-Za-z_$][\w$]*)/);
    if (nameMatch && nameMatch[1] && !BUILTIN_FUNCTIONS.has(nameMatch[1])) {
      handlers.push({ name: nameMatch[1], modifiers: [] });
    }
  }

  return handlers;
}

// ============================================
// FALLBACK: REGEX-АНАЛИЗ
// ============================================

function analyzeTemplateByRegex(template: string, result: VueComponentAnalysis['template']): void {
  if (!template) return;

  // Компоненты (PascalCase + kebab-case)
  const componentRegex = /<([A-Z][a-zA-Z0-9]*|[a-z]+(?:-[a-z0-9]+)+)/g;
  let match: RegExpExecArray | null;
  while ((match = componentRegex.exec(template)) !== null) {
    const name = match[1];
    if (!name || INTRINSIC_TAGS.has(name)) continue;
    const line = template.substring(0, match.index).split('\n').length;
    result.usedComponents.push({
      name,
      line,
      parent: null,
      isDynamic: false,
      isKebabCase: /^[a-z]+(-[a-z0-9]+)+$/.test(name),
    });
  }

  // Template refs
  const refRegex = /\bref="([^"]+)"/g;
  while ((match = refRegex.exec(template)) !== null) {
    const refValue = match[1];
    if (!refValue) continue;
    const line = template.substring(0, match.index).split('\n').length;
    result.templateRefs.push({ refValue, tag: 'unknown', line });
  }

  // Event handlers @click="..."
  const eventRegex = /@(\w[\w:-]*)\s*=\s*"([^"]+)"/g;
  while ((match = eventRegex.exec(template)) !== null) {
    const eventName = match[1];
    const handlerExpr = match[2];
    if (!eventName || !handlerExpr) continue;
    const line = template.substring(0, match.index).split('\n').length;
    const handlers = parseHandlers(handlerExpr);
    for (const h of handlers) {
      result.eventHandlers.push({
        eventName,
        handlerName: h.name,
        tag: 'unknown',
        line,
        modifiers: h.modifiers,
        isExternal: BUILTIN_FUNCTIONS.has(h.name),
      });
    }
    if (!result.events.includes(eventName)) result.events.push(eventName);
  }

  // v-on:click="..."
  const vOnRegex = /v-on:(\w[\w:-]*)\s*=\s*"([^"]+)"/g;
  while ((match = vOnRegex.exec(template)) !== null) {
    const eventName = match[1];
    const handlerExpr = match[2];
    if (!eventName || !handlerExpr) continue;
    const line = template.substring(0, match.index).split('\n').length;
    const handlers = parseHandlers(handlerExpr);
    for (const h of handlers) {
      result.eventHandlers.push({
        eventName,
        handlerName: h.name,
        tag: 'unknown',
        line,
        modifiers: h.modifiers,
        isExternal: BUILTIN_FUNCTIONS.has(h.name),
      });
    }
    if (!result.events.includes(eventName)) result.events.push(eventName);
  }

  // Интерполяции {{ ... }}
  const interpRegex = /\{\{([^}]+)\}\}/g;
  while ((match = interpRegex.exec(template)) !== null) {
    const expr = match[1]?.trim();
    if (!expr) continue;
    const line = template.substring(0, match.index).split('\n').length;
    result.expressions.push({
      expression: expr,
      kind: 'interpolation',
      line,
      rootIdentifiers: extractRootIdentifiers(expr),
    });
  }

  // Динамические компоненты <component :is="...">
  const dynCompRegex = /<component\s+:is="([^"]+)"/g;
  while ((match = dynCompRegex.exec(template)) !== null) {
    const isExpr = match[1];
    if (!isExpr) continue;
    const line = template.substring(0, match.index).split('\n').length;
    result.dynamicComponents.push({ isExpression: isExpr, line });
  }

  // Слоты
  const slotRegex = /<slot\s+(?:name="([^"]+)")?/g;
  while ((match = slotRegex.exec(template)) !== null) {
    const slotName = match[1] || 'default';
    if (!result.slots.includes(slotName)) result.slots.push(slotName);
  }

  const templateSlotRegex = /<template\s+#(\w+)/g;
  while ((match = templateSlotRegex.exec(template)) !== null) {
    const slotName = match[1];
    if (slotName && !result.slots.includes(slotName)) result.slots.push(slotName);
  }

  // Директивы
  const directiveRegex = /\b(v-(?:if|for|show|model|else|else-if|html|text|pre|once|memo))\b/g;
  while ((match = directiveRegex.exec(template)) !== null) {
    const vDir = match[1];
    if (vDir && !result.directives.includes(vDir)) result.directives.push(vDir);
  }

  // ✅ v4.0.0: v-else-if / v-else через regex (fallback)
  const conditionalRegex = /\bv-(if|else-if|else)\b(?:\s*=\s*"([^"]+)")?/g;
  while ((match = conditionalRegex.exec(template)) !== null) {
    const kind = match[1];
    const conditionExpression = match[2];
    if (!kind) continue;
    const line = template.substring(0, match.index).split('\n').length;

    let directive: TemplateConditionalUsage['directive'] = 'v-if';
    if (kind === 'else-if') directive = 'v-else-if';
    else if (kind === 'else') directive = 'v-else';

    // Проверяем, нет ли уже такой записи на этой строке
    const exists = result.conditionals.some(c => c.line === line && c.directive === directive);
    if (!exists) {
      result.conditionals.push({
        directive,
        line,
        conditionExpression,
      });
    }
  }

  // v-bind (root-идентификаторы)
  const vBindRegex = /:(\w[\w-]*)\s*=\s*"([^"]+)"/g;
  while ((match = vBindRegex.exec(template)) !== null) {
    if (!result.directives.includes('v-bind')) result.directives.push('v-bind');
    const expr = match[2];
    if (expr) {
      const line = template.substring(0, match.index).split('\n').length;
      result.expressions.push({
        expression: expr,
        kind: 'binding',
        line,
        rootIdentifiers: extractRootIdentifiers(expr),
      });
    }
  }
}

// ============================================
// CSS ИЗ <style>
// ============================================

function extractCssFromStyles(
  descriptor: SFCDescriptor,
  result: VueComponentAnalysis['template']
): void {
  if (!descriptor.styles || descriptor.styles.length === 0) return;

  for (const style of descriptor.styles) {
    const content = style.content || '';
    if (!content) continue;

    extractCssVariables(content, result);

    // :deep(selector)
    const deepRegex = /:deep\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = deepRegex.exec(content)) !== null) {
      const selector = match[1]?.trim();
      if (!selector) continue;
      const line = content.substring(0, match.index).split('\n').length;
      if (!result.deepSelectors.some(d => d.selector === selector)) {
        result.deepSelectors.push({ selector, line });
      }
    }

    // v-bind(expr) в CSS
    const vBindRegex = /v-bind\(([^)]+)\)/g;
    while ((match = vBindRegex.exec(content)) !== null) {
      const expr = match[1]?.trim();
      if (!expr) continue;
      const line = content.substring(0, match.index).split('\n').length;
      result.expressions.push({
        expression: expr,
        kind: 'binding',
        line,
        rootIdentifiers: extractRootIdentifiers(expr),
      });
    }
  }
}

/**
 * Извлекает CSS-переменные с балансировкой скобок.
 */
function extractCssVariables(content: string, result: VueComponentAnalysis['template']): void {
  let i = 0;
  const len = content.length;

  while (i < len) {
    if (content[i] === '-' && content[i + 1] === '-') {
      const nameStart = i;
      i += 2;
      while (i < len && /[\w-]/.test(content[i] || '')) i++;
      const name = content.slice(nameStart, i);

      while (i < len && /\s/.test(content[i] || '')) i++;

      if (content[i] !== ':') continue;
      i++;

      while (i < len && /\s/.test(content[i] || '')) i++;

      const valueStart = i;
      let depth = 0;
      let inString = false;
      let stringChar = '';

      while (i < len) {
        const ch = content[i];

        if (inString) {
          if (ch === stringChar && content[i - 1] !== '\\') inString = false;
        } else if (ch === '"' || ch === "'") {
          inString = true;
          stringChar = ch;
        } else if (ch === '(' || ch === '[') {
          depth++;
        } else if (ch === ')' || ch === ']') {
          depth--;
        } else if (ch === ';' && depth === 0) {
          break;
        } else if (ch === '}' && depth === 0) {
          break;
        }

        i++;
      }

      const rawValue = content.slice(valueStart, i).trim();
      const isMultiline = rawValue.includes('\n');
      const line = content.substring(0, nameStart).split('\n').length;

      if (!result.cssVariables.some(v => v.name === name)) {
        result.cssVariables.push({
          name,
          value: rawValue || undefined,
          line,
          isMultiline,
        });
      }

      if (content[i] === ';') i++;
    } else {
      i++;
    }
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  analyzeTemplate,
};
