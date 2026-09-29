// src/core/vue-template-parser.ts
// ============================================================
// VUE TEMPLATE PARSER
// ============================================================
// Версия: 1.2.0
//
// ИЗМЕНЕНИЯ v1.2.0 (FIX: identifier/literalValue/memberChain для props):
//   - ✅ ИСПРАВЛЕНО: `extractComponentUsage` и `extractHtmlElement` теперь
//     заполняют `identifier`, `memberChain`, `literalValue` для каждого
//     prop через `extractIdentifierFromValue`, `extractMemberChainFromValue`,
//     `extractLiteralFromValue` (из `../reporters/compact/ids/value-extractors.js`).
//
//     ПРИЧИНА:
//       До v1.2.0 поля `identifier` и `literalValue` ВСЕГДА были `null`/
//       `undefined`, потому что `parseVueTemplate` ставил `identifier: null`.
//
//       Дальше по цепочке:
//         parseVueTemplate → EntitiesResult.templateComponentUsages
//           → processComponentUsage (присваивает новые id, НЕ трогает idn/lv)
//           → encodeVueSection (в codec-encode.ts)
//           → encodeComponentPropsInline (пишет idn=-1, lv=-1)
//
//       В результате в `index.json` (compact) массивы `idn[]` и `lv[]`
//       были все `-1` для 866 элементов, а `index.full.json` содержал
//       реальные значения (`identifier: "ai"`, `literalValue: 25`).
//       Round-trip L1/L2/DL падали с diffCount=20.
//
//     РЕШЕНИЕ:
//       Заполнять `identifier`/`literalValue`/`memberChain` ПРЯМО в
//       `parseVueTemplate` при создании `ComponentProp`. Это ЕДИНСТВЕННЫЙ
//       источник, откуда props попадают в `allComponentProps` в
//       `encodeVueSection`, и, следовательно, в `compact.componentProps.idn/lv`.
//
//     СИМПТОМ ДО ФИКСА (verify-roundtrip.ts):
//       $.vue.componentProps[0].identifier  a: null  b: "ai"
//       $.vue.componentProps[1].literalValue a: undefined  b: 25
//       L1/L2/DL — FAIL (diffCount=20)
//
//     СИМПТОМ ПОСЛЕ ФИКСА:
//       L1/L2/DL — PASS (diffCount=0)
//
// ИЗМЕНЕНИЯ v1.1.0 (FIX: пустые componentUsages/htmlElements):
//   - ✅ ИСПРАВЛЕНО: descriptor.template.ast в @vue/compiler-sfc
//     версии 3.4+ НЕ заполняется автоматически. Добавлен fallback
//     через compileTemplate() — официальный API для получения AST.
//   - ✅ ИСПРАВЛЕНО: walk() теперь корректно обрабатывает NODE_ROOT
//     (type === 0). Ранее корневой узел мог попадать в блок
//     «Прочее» и обходить children без правильной классификации.
//   - ✅ ДОБАВЛЕНО: диагностика в result.errors с точной причиной
//     (parseSFC errors, compileTemplate errors, ast === null).
//   - ✅ ДОБАВЛЕНО: экспорт функции getTemplateAst() для переиспользования.
//   - ✅ УТОЧНЕНО: NODE_ROOT = 0 обрабатывается как контейнер.
//   - ✅ ДОБАВЛЕНО: NODE_TEXT и NODE_COMMENT обрабатываются явно.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия. Парсинг <template> через @vue/compiler-sfc.
//   - Извлечение ComponentUsage[] и HtmlElementUsage[].
//   - Извлечение props, events, directives, slots, interpolations.
//   - Классификация тегов: компонент (PascalCase / kebab-case) vs
//     HTML-элемент (нижний регистр без дефисов).
//
// НАЗНАЧЕНИЕ
// ----------
// Парсит <template> Vue SFC через @vue/compiler-sfc и извлекает:
//   - ComponentUsage[]    — использования дочерних компонентов
//   - HtmlElementUsage[]  — использования HTML-элементов
//
// Каждый usage содержит:
//   - props (ComponentProp[])             — атрибуты и :bind
//   - events (ComponentEvent[])           — @event
//   - directives (ComponentDirective[])   — v-if / v-for / v-model / ...
//   - slots (ComponentSlot[])             — <template #slot> (только для компонентов)
//   - interpolations (HtmlInterpolation[]) — {{ }} (только для HTML-элементов)
//
// ════════════════════════════════════════════════════════════
// ИСТОЧНИКИ ДАННЫХ
// ════════════════════════════════════════════════════════════
//
//   @vue/compiler-sfc — уже в зависимостях.
//   parse(sfcSource) → SFCDescriptor с .template.ast.
//
//   ⚠️ ВАЖНО: в @vue/compiler-sfc 3.4+ поле `.template.ast`
//   может быть undefined, если parse() не передан
//   compilerOptions.template. Тогда используется fallback
//   через compileTemplate().
//
// ════════════════════════════════════════════════════════════
// ТИПЫ УЗЛОВ VUE AST
// ════════════════════════════════════════════════════════════
//
//   NODE_ROOT          = 0   — корень шаблона
//   NODE_ELEMENT       = 1   — <div>, <Comp>
//   NODE_TEXT          = 2   — текст
//   NODE_COMMENT       = 3   — комментарий
//   NODE_INTERPOLATION = 5   — {{ expr }}
//   NODE_ATTRIBUTE     = 6   — статический атрибут: name="value"
//   NODE_DIRECTIVE     = 7   — v-bind / v-on / v-if / ...
//
// ════════════════════════════════════════════════════════════
// СОГЛАШЕНИЯ ОБ ID
// ════════════════════════════════════════════════════════════
//
//   ComponentUsage.id       — глобальный: `cu1`, `cu2`, ...
//   HtmlElementUsage.id     — глобальный: `he1`, `he2`, ...
//
//   ComponentProp.id        — локальный: `${usageId}:cp${n}`
//   ComponentEvent.id       — локальный: `${usageId}:ce${n}`
//   ComponentDirective.id   — локальный: `${usageId}:cd${n}`
//   ComponentSlot.id        — локальный: `${usageId}:csl${n}`
//   HtmlInterpolation.id    — локальный: `${elementId}:hi${n}`
//
// ════════════════════════════════════════════════════════════
// КЛАССИФИКАЦИЯ ТЕГОВ
// ════════════════════════════════════════════════════════════
//
//   ComponentTag:
//     - PascalCase:  AiToolbar, NDataTable
//     - kebab-case:  ai-toolbar, n-data-table
//
//   HtmlTag:
//     - div, span, p, a, button, input, ...
//     - исключая Vue-встроенные: template, slot, component, transition, ...
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   <template>
//     <div>
//       <AiToolbar
//         :user-toolbar-items="props.toolbarItems"
//         :is-data-modified="isDirty"
//         @column-chooser-change="setColumnsVisibility"
//         v-if="!props.isPopover"
//       >
//         <template #header>
//           <span>{{ title }}</span>
//         </template>
//       </AiToolbar>
//     </div>
//   </template>
//
//   Результат:
//     componentUsages: [
//       {
//         id: 'cu1',
//         tag: 'AiToolbar',
//         props: [
//           { id: 'cu1:cp1', name: 'user-toolbar-items', value: 'props.toolbarItems',
//             kind: 'dynamic', identifier: 'props',
//             memberChain: ['props', 'toolbarItems'], literalValue: undefined },
//           { id: 'cu1:cp2', name: 'is-data-modified',   value: 'isDirty',
//             kind: 'dynamic', identifier: 'isDirty',
//             memberChain: undefined,          literalValue: undefined },
//         ],
//         events: [
//           { id: 'cu1:ce1', eventName: 'column-chooser-change',
//             handler: 'setColumnsVisibility' },
//         ],
//         directives: [
//           { id: 'cu1:cd1', name: 'v-if', value: '!props.isPopover' },
//         ],
//         slots: [
//           { id: 'cu1:csl1', slotName: 'header' },
//         ],
//       },
//     ]
//
//     htmlElements: [
//       {
//         id: 'he1',
//         tag: 'div',
//         interpolations: [],
//       },
//       {
//         id: 'he2',
//         tag: 'span',
//         interpolations: [
//           { id: 'he2:hi1', expression: 'title' },
//         ],
//       },
//     ]
//
// ============================================================

import { parse as parseSFC, compileTemplate } from '@vue/compiler-sfc';
import type {
  ComponentUsage,
  HtmlElementUsage,
  ComponentProp,
  ComponentEvent,
  ComponentDirective,
  ComponentSlot,
  HtmlInterpolation,
} from '../reporters/codec/codec-types.js';

// ✅ v1.2.0: импорт extract*FromValue для заполнения identifier/memberChain/literalValue
import {
  extractIdentifierFromValue,
  extractMemberChainFromValue,
  extractLiteralFromValue,
} from '../reporters/compact/ids/value-extractors.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

/** Тип узла Vue AST: ROOT (корень шаблона) */
const NODE_ROOT = 0;

/** Тип узла Vue AST: <div>, <Comp> */
const NODE_ELEMENT = 1;

/** Тип узла Vue AST: текст */
const NODE_TEXT = 2;

/** Тип узла Vue AST: комментарий */
const NODE_COMMENT = 3;

/** Тип узла Vue AST: {{ expr }} */
const NODE_INTERPOLATION = 5;

/** Тип prop Vue AST: статический атрибут name="value" */
const NODE_ATTRIBUTE = 6;

/** Тип prop Vue AST: директива v-bind / v-on / v-if / ... */
const NODE_DIRECTIVE = 7;

/**
 * Vue-встроенные теги, которые НЕ являются компонентами
 * (даже если написаны в PascalCase или kebab-case).
 */
const VUE_BUILTIN_TAGS = new Set<string>([
  'template',
  'slot',
  'component',
  'transition',
  'transition-group',
  'keep-alive',
  'teleport',
  'suspense',
]);

/**
 * HTML-теги (нижний регистр, без дефисов и CamelCase).
 * Используется для быстрой классификации.
 */
const HTML_TAGS = new Set<string>([
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
]);

/**
 * Директивы, которые попадают в ComponentDirective / HtmlElementUsage.directives.
 *
 * НЕ включают v-bind / v-on — они обрабатываются отдельно (props/events).
 * НЕ включают v-slot — обрабатывается отдельно (slots).
 */
const TRACKED_DIRECTIVES = new Set<string>([
  'if',
  'else-if',
  'else',
  'for',
  'show',
  'model',
  'html',
  'text',
  'pre',
  'once',
  'memo',
  'cloak',
  'custom',
]);

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Контекст парсинга.
 */
export interface ParseCtx {
  /** Абсолютный путь к .vue файлу */
  filePath: string;

  /** ID файла (f60) — если известен */
  fileId?: string;
}

/**
 * Результат парсинга шаблона.
 */
export interface ParseResult {
  /** Использования дочерних компонентов */
  componentUsages: ComponentUsage[];

  /** Использования HTML-элементов */
  htmlElements: HtmlElementUsage[];

  /** Ошибки парсинга (для диагностики) */
  errors: string[];
}

/**
 * ✅ v1.1.0: Результат получения AST шаблона.
 */
export interface TemplateAstResult {
  /** AST шаблона или null */
  ast: any | null;

  /** Ошибки парсинга */
  errors: string[];
}

// ============================================================
// ✅ v1.1.0: ПОЛУЧЕНИЕ AST ШАБЛОНА
// ============================================================
//
// КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
//   В @vue/compiler-sfc 3.4+ descriptor.template.ast может быть
//   undefined, если parse() не передан compilerOptions.template
//   или если parse() был вызван без template-секции.
//
//   Решение: fallback через compileTemplate() — официальный API
//   для получения AST шаблона.
//
// АЛГОРИТМ:
//   1. Парсим SFC через parse().
//   2. Если descriptor.template.ast — есть, используем его.
//   3. Иначе — вызываем compileTemplate() для получения AST.
//   4. Если и там пусто — возвращаем null + диагностику.
// ============================================================

/**
 * Получает AST шаблона из SFC-источника.
 *
 * @param sfcSource — содержимое .vue файла
 * @param filePath  — путь к файлу (для диагностики)
 * @returns { ast, errors }
 */
export function getTemplateAst(sfcSource: string, filePath: string): TemplateAstResult {
  const errors: string[] = [];

  // ────────────────────────────────────────────────────────
  // Защита от пустого входа
  // ────────────────────────────────────────────────────────
  if (!sfcSource || typeof sfcSource !== 'string') {
    return { ast: null, errors: ['Empty sfcSource'] };
  }

  // ────────────────────────────────────────────────────────
  // Шаг 1: parseSFC
  // ────────────────────────────────────────────────────────
  let descriptor: any;
  try {
    const parsed = parseSFC(sfcSource, { filename: filePath });
    descriptor = parsed.descriptor;

    if (parsed.errors && parsed.errors.length > 0) {
      for (const err of parsed.errors) {
        errors.push(`parseSFC: ${String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`parseSFC exception: ${err instanceof Error ? err.message : String(err)}`);
    return { ast: null, errors };
  }

  if (!descriptor) {
    errors.push('parseSFC: descriptor is null');
    return { ast: null, errors };
  }

  if (!descriptor.template) {
    errors.push('parseSFC: no <template> in SFC');
    return { ast: null, errors };
  }

  // ────────────────────────────────────────────────────────
  // Шаг 2: пробуем descriptor.template.ast
  // ────────────────────────────────────────────────────────
  if (descriptor.template.ast) {
    return { ast: descriptor.template.ast, errors };
  }

  // ────────────────────────────────────────────────────────
  // Шаг 3: fallback — compileTemplate()
  // ────────────────────────────────────────────────────────
  try {
    const compiled = compileTemplate({
      source: descriptor.template.content,
      filename: filePath,
      id: filePath,
    });

    if (compiled.errors && compiled.errors.length > 0) {
      for (const err of compiled.errors) {
        errors.push(`compileTemplate: ${String(err)}`);
      }
    }

    if (!compiled.ast) {
      errors.push('compileTemplate: ast is null');
      return { ast: null, errors };
    }

    return { ast: compiled.ast, errors };
  } catch (err) {
    errors.push(`compileTemplate exception: ${err instanceof Error ? err.message : String(err)}`);
    return { ast: null, errors };
  }
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Парсит <template> Vue SFC и извлекает ComponentUsage[] + HtmlElementUsage[].
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. getTemplateAst(sfcSource, filePath) → templateAst
 *   2. Если templateAst === null → вернуть пустой результат + errors
 *   3. Обход templateAst:
 *      a. NODE_ROOT — обходим children
 *      b. NODE_ELEMENT:
 *         - isComponentTag(tag) → ComponentUsage | HtmlElementUsage
 *      c. NODE_INTERPOLATION — добавить в parent.interpolations
 *      d. NODE_TEXT / NODE_COMMENT — пропустить
 *      e. рекурсивный обход children
 *   4. Возврат { componentUsages, htmlElements, errors }
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 *   - Ошибки getTemplateAst — собираются в result.errors.
 *   - Некорректные узлы — пропускаются.
 *   - Пустой шаблон — возвращается пустой результат.
 *
 * @param sfcSource — содержимое .vue файла
 * @param ctx       — контекст (filePath, fileId)
 * @returns ParseResult
 */
export function parseVueTemplate(sfcSource: string, ctx: ParseCtx): ParseResult {
  const result: ParseResult = {
    componentUsages: [],
    htmlElements: [],
    errors: [],
  };

  if (!sfcSource || typeof sfcSource !== 'string') {
    return result;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 1: получаем AST шаблона
  // ────────────────────────────────────────────────────────
  const { ast: templateAst, errors } = getTemplateAst(sfcSource, ctx.filePath);

  if (errors.length > 0) {
    result.errors.push(...errors);
  }

  if (!templateAst) {
    result.errors.push('templateAst is null — no componentUsages/htmlElements extracted');
    return result;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 2: счётчики для id
  // ────────────────────────────────────────────────────────
  let usageCounter = 0;
  let elementCounter = 0;

  // ────────────────────────────────────────────────────────
  // Шаг 3: рекурсивный обход
  // ────────────────────────────────────────────────────────
  const walk = (
    node: any,
    parentTag: string | null,
    parentElement: HtmlElementUsage | null
  ): void => {
    if (!node || typeof node !== 'object') return;

    // ───── ROOT (type === 0): контейнер, обходим детей ─────
    if (node.type === NODE_ROOT && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child, parentTag, parentElement);
      }
      return;
    }

    // ───── TEXT / COMMENT: пропускаем ─────
    if (node.type === NODE_TEXT || node.type === NODE_COMMENT) {
      return;
    }

    // ───── ELEMENT ─────
    if (node.type === NODE_ELEMENT && node.tag) {
      const isComponent = isComponentTag(node.tag);

      if (isComponent) {
        usageCounter++;
        const id = `cu${usageCounter}`;
        const usage = extractComponentUsage(node, id, ctx);
        result.componentUsages.push(usage);

        // Обход детей компонента — parentElement не передаём,
        // т.к. children компонента обрабатываются как слоты
        for (const child of node.children || []) {
          walk(child, node.tag, null);
        }
      } else {
        elementCounter++;
        const id = `he${elementCounter}`;
        const element = extractHtmlElement(node, id, ctx);
        result.htmlElements.push(element);

        // Обход детей — parentElement передаётся для interpolations
        for (const child of node.children || []) {
          walk(child, node.tag, element);
        }
      }
      return;
    }

    // ───── INTERPOLATION {{ expr }} ─────
    if (node.type === NODE_INTERPOLATION && parentElement) {
      const interp = extractInterpolation(node, parentElement);
      if (interp) {
        parentElement.interpolations.push(interp);
      }
      return;
    }

    // ───── Прочее: рекурсивный обход ─────
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child, parentTag, parentElement);
      }
    }
  };

  walk(templateAst, null, null);

  // ────────────────────────────────────────────────────────
  // Шаг 4: диагностика — если ast был, но ничего не нашли
  // ────────────────────────────────────────────────────────
  if (result.componentUsages.length === 0 && result.htmlElements.length === 0) {
    const astChildren = Array.isArray(templateAst.children) ? templateAst.children.length : 'n/a';
    result.errors.push(
      `templateAst present (type=${templateAst.type}, children=${astChildren}) but 0 usages extracted`
    );
  }

  return result;
}

// ============================================================
// КЛАССИФИКАЦИЯ ТЕГОВ
// ============================================================

/**
 * Проверяет, является ли тег компонентом.
 *
 * Компонент:
 *   - PascalCase:  AiToolbar, NDataTable
 *   - kebab-case с дефисом: ai-toolbar, n-data-table
 *
 * НЕ компонент:
 *   - HTML-теги: div, span, a, ...
 *   - Vue-встроенные: template, slot, component, transition, ...
 *
 * @param tag — имя тега
 * @returns true, если это компонент
 */
export function isComponentTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;

  // Vue-встроенные — никогда не компоненты
  if (VUE_BUILTIN_TAGS.has(tag)) return false;

  // HTML-теги (нижний регистр, без дефисов)
  if (HTML_TAGS.has(tag)) return false;

  // PascalCase: первая буква заглавная
  if (/^[A-Z]/.test(tag)) return true;

  // kebab-case с дефисом и только строчные: ai-toolbar
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag)) return true;

  // Всё остальное — не компонент (нижний регистр без дефисов, кастомные HTML)
  return false;
}

/**
 * Проверяет, является ли тег HTML-элементом.
 */
export function isHtmlElementTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;
  return HTML_TAGS.has(tag);
}

/**
 * Проверяет, является ли тег Vue-встроенным.
 */
export function isVueBuiltinTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;
  return VUE_BUILTIN_TAGS.has(tag);
}

// ============================================================
// ИЗВЛЕЧЕНИЕ ComponentUsage
// ============================================================

/**
 * Извлекает ComponentUsage из узла Vue AST.
 *
 * @param node — узел <Comp>
 * @param id   — сгенерированный id (cu1, cu2, ...)
 * @param ctx  — контекст парсинга
 * @returns ComponentUsage
 */
function extractComponentUsage(node: any, id: string, _ctx: ParseCtx): ComponentUsage {
  const props: ComponentProp[] = [];
  const events: ComponentEvent[] = [];
  const directives: ComponentDirective[] = [];
  const slots: ComponentSlot[] = [];

  // Обработка props узла
  for (const prop of node.props || []) {
    processProp(prop, id, props, events, directives, slots);
  }

  // Обработка слотов из children (<template #slot>)
  extractSlotsFromChildren(node.children || [], id, slots);

  return {
    id,
    parentFileId: '',
    tag: node.tag || '',
    componentFileId: null,
    source: 'unknown',
    line: node.loc?.start?.line ?? 0,
    column: node.loc?.start?.column ?? 0,
    props,
    events,
    directives,
    slots,
  };
}

// ============================================================
// ИЗВЛЕЧЕНИЕ HtmlElementUsage
// ============================================================

/**
 * Извлекает HtmlElementUsage из узла Vue AST.
 *
 * @param node — узел <div>
 * @param id   — сгенерированный id (he1, he2, ...)
 * @param ctx  — контекст парсинга
 * @returns HtmlElementUsage
 */
function extractHtmlElement(node: any, id: string, _ctx: ParseCtx): HtmlElementUsage {
  const props: ComponentProp[] = [];
  const events: ComponentEvent[] = [];
  const directives: ComponentDirective[] = [];
  const slots: ComponentSlot[] = []; // HTML-элементы не имеют слотов
  const interpolations: HtmlInterpolation[] = [];

  for (const prop of node.props || []) {
    processProp(prop, id, props, events, directives, slots);
  }

  return {
    id,
    parentFileId: '',
    tag: node.tag || '',
    line: node.loc?.start?.line ?? 0,
    column: node.loc?.start?.column ?? 0,
    props,
    events,
    directives,
    interpolations,
  };
}

// ============================================================
// ИЗВЛЕЧЕНИЕ HtmlInterpolation
// ============================================================

/**
 * Извлекает HtmlInterpolation из узла {{ expr }}.
 *
 * @param node    — узел NODE_INTERPOLATION
 * @param parent  — родительский HtmlElementUsage
 * @returns HtmlInterpolation или null
 */
function extractInterpolation(node: any, parent: HtmlElementUsage): HtmlInterpolation | null {
  if (!node || !node.content) return null;

  const expression = typeof node.content === 'string' ? node.content : node.content.content || '';

  if (!expression) return null;

  const id = `${parent.id}:hi${parent.interpolations.length + 1}`;

  return {
    id,
    usageId: parent.id,
    expression,
    sourceChain: [],
    line: node.loc?.start?.line ?? 0,
  };
}

// ============================================================
// ОБРАБОТКА PROPS (ATTRIBUTE + DIRECTIVE)
// ============================================================

/**
 * Обрабатывает один prop узла Vue AST и добавляет его в соответствующий массив.
 *
 * @param prop       — prop из node.props
 * @param baseId     — базовый id (cu1 / he1)
 * @param props      — массив props (мутируется)
 * @param events     — массив events (мутируется)
 * @param directives — массив directives (мутируется)
 * @param slots      — массив slots (мутируется)
 */
function processProp(
  prop: any,
  baseId: string,
  props: ComponentProp[],
  events: ComponentEvent[],
  directives: ComponentDirective[],
  slots: ComponentSlot[]
): void {
  if (!prop || typeof prop !== 'object') return;

  // ────────────────────────────────────────────────────────
  // ATTRIBUTE (статический)
  // ────────────────────────────────────────────────────────
  if (prop.type === NODE_ATTRIBUTE) {
    const name = prop.name || '';
    const value = prop.value?.content || '';

    // Слот-атрибут: #slot или v-slot
    if (name.startsWith('#')) {
      const slotName = name.slice(1) || 'default';
      slots.push({
        id: `${baseId}:csl${slots.length + 1}`,
        usageId: baseId,
        slotName,
        isScoped: false,
        scopeNames: [],
        line: prop.loc?.start?.line ?? 0,
      });
      return;
    }

    // ✅ v1.2.0: заполняем identifier/memberChain/literalValue
    props.push({
      id: `${baseId}:cp${props.length + 1}`,
      usageId: baseId,
      name,
      value,
      kind: prop.value ? 'static' : 'boolean',
      line: prop.loc?.start?.line ?? 0,
      identifier: extractIdentifierFromValue(value),
      memberChain: extractMemberChainFromValue(value),
      literalValue: extractLiteralFromValue(value),
      sourceChain: [],
    });
    return;
  }

  // ────────────────────────────────────────────────────────
  // DIRECTIVE (v-bind / v-on / v-if / v-slot / ...)
  // ────────────────────────────────────────────────────────
  if (prop.type === NODE_DIRECTIVE) {
    const dirName = prop.name || '';
    const argName = prop.arg?.content || '';
    const expValue = prop.exp?.content || '';
    const modifiers = (prop.modifiers || [])
      .map((m: any) => (typeof m === 'string' ? m : m?.content || ''))
      .filter(Boolean);

    // ───── v-bind (props) ─────
    if (dirName === 'bind') {
      // Динамический слот: v-bind:#slot
      if (argName && argName.startsWith('#')) {
        slots.push({
          id: `${baseId}:csl${slots.length + 1}`,
          usageId: baseId,
          slotName: argName.slice(1) || 'default',
          isScoped: false,
          scopeNames: [],
          line: prop.loc?.start?.line ?? 0,
        });
        return;
      }

      // v-bind="obj" (spread)
      if (!argName) {
        // ✅ v1.2.0: для spread значение — объект, identifier = переменная объекта
        props.push({
          id: `${baseId}:cp${props.length + 1}`,
          usageId: baseId,
          name: '',
          value: expValue,
          kind: 'spread',
          line: prop.loc?.start?.line ?? 0,
          identifier: extractIdentifierFromValue(expValue),
          memberChain: extractMemberChainFromValue(expValue),
          literalValue: extractLiteralFromValue(expValue),
          sourceChain: [],
        });
        return;
      }

      // ✅ v1.2.0: заполняем identifier/memberChain/literalValue
      props.push({
        id: `${baseId}:cp${props.length + 1}`,
        usageId: baseId,
        name: argName,
        value: expValue,
        kind: 'dynamic',
        line: prop.loc?.start?.line ?? 0,
        identifier: extractIdentifierFromValue(expValue),
        memberChain: extractMemberChainFromValue(expValue),
        literalValue: extractLiteralFromValue(expValue),
        sourceChain: [],
      });
      return;
    }

    // ───── v-on (events) ─────
    if (dirName === 'on') {
      events.push({
        id: `${baseId}:ce${events.length + 1}`,
        usageId: baseId,
        eventName: argName || '',
        handler: expValue,
        modifiers,
        line: prop.loc?.start?.line ?? 0,
        handlerFunctionId: null,
        handlerSource: 'unknown',
        handlerChain: [],
      });
      return;
    }

    // ───── v-slot (slots) ─────
    if (dirName === 'slot') {
      const slotName = argName || 'default';
      const scopeNames = expValue
        ? expValue
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      slots.push({
        id: `${baseId}:csl${slots.length + 1}`,
        usageId: baseId,
        slotName,
        isScoped: true,
        scopeNames,
        line: prop.loc?.start?.line ?? 0,
      });
      return;
    }

    // ───── v-if / v-for / v-model / v-show / ... ─────
    if (TRACKED_DIRECTIVES.has(dirName)) {
      directives.push({
        id: `${baseId}:cd${directives.length + 1}`,
        usageId: baseId,
        name: `v-${dirName}`,
        value: expValue,
        argument: argName || undefined,
        modifiers,
        line: prop.loc?.start?.line ?? 0,
      });
      return;
    }

    // ───── Кастомные директивы (v-myDir) ─────
    if (dirName) {
      directives.push({
        id: `${baseId}:cd${directives.length + 1}`,
        usageId: baseId,
        name: `v-${dirName}`,
        value: expValue,
        argument: argName || undefined,
        modifiers,
        line: prop.loc?.start?.line ?? 0,
      });
    }
  }
}

// ============================================================
// ИЗВЛЕЧЕНИЕ SLOTS ИЗ CHILDREN
// ============================================================

/**
 * Извлекает слоты из children компонента (<template #slot>).
 *
 * ⚠️ Слоты уже частично обрабатываются в processProp (атрибуты #slot
 * и директивы v-slot). Эта функция обрабатывает children-узлы
 * <template #header>, которые не являются props текущего узла,
 * а являются детьми.
 *
 * @param children — node.children
 * @param baseId   — базовый id (cu1)
 * @param slots    — массив slots (мутируется)
 */
function extractSlotsFromChildren(children: any[], baseId: string, slots: ComponentSlot[]): void {
  for (const child of children) {
    if (!child || child.type !== NODE_ELEMENT) continue;
    if (child.tag !== 'template') continue;

    // Ищем prop типа v-slot или #slot
    for (const prop of child.props || []) {
      // #slotName (ATTRIBUTE)
      if (prop.type === NODE_ATTRIBUTE && prop.name?.startsWith('#')) {
        const slotName = prop.name.slice(1) || 'default';

        // Проверяем, что такого слота ещё нет
        const exists = slots.some(s => s.slotName === slotName);
        if (!exists) {
          slots.push({
            id: `${baseId}:csl${slots.length + 1}`,
            usageId: baseId,
            slotName,
            isScoped: false,
            scopeNames: [],
            line: child.loc?.start?.line ?? 0,
          });
        }
      }

      // v-slot:slotName (DIRECTIVE)
      if (prop.type === NODE_DIRECTIVE && prop.name === 'slot') {
        const slotName = prop.arg?.content || 'default';
        const expValue = prop.exp?.content || '';
        const scopeNames = expValue
          ? expValue
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

        const exists = slots.some(s => s.slotName === slotName);
        if (!exists) {
          slots.push({
            id: `${baseId}:csl${slots.length + 1}`,
            usageId: baseId,
            slotName,
            isScoped: true,
            scopeNames,
            line: child.loc?.start?.line ?? 0,
          });
        }
      }
    }
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  parseVueTemplate,
  getTemplateAst,
  isComponentTag,
  isHtmlElementTag,
  isVueBuiltinTag,
};
