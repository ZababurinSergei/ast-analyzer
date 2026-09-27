// src/types-vue-template.ts
// ============================================================
// ТИПЫ VUE-ШАБЛОНА (вынесены для разрыва циклического импорта)
// ============================================================
// Версия: 1.0.0
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ ЭТОТ ФАЙЛ
// ════════════════════════════════════════════════════════════
//
// Раньше типы ComponentUsage, HtmlElementUsage, ComponentProp и т.д.
// жили в `src/reporters/codec/codec-types.ts`. Но codec-types.ts
// импортирует типы из `src/types.ts` (TemplateEventHandler и др.),
// а `src/types.ts` хочет импортировать ComponentUsage/HtmlElementUsage
// из codec-types.ts → получается ЦИКЛ:
//
//   types.ts → codec-types.ts → types.ts
//
// TypeScript такое не любит: типы могут стать `any`, ломается
// автодополнение, vitest/ts-node могут падать на этапе загрузки.
//
// ════════════════════════════════════════════════════════════
// РЕШЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Все типы Vue-шаблона вынесены СЮДА — в отдельный файл без
// зависимостей от `types.ts` и `codec-types.ts`.
//
// Теперь:
//   - `types.ts`        импортирует отсюда
//   - `codec-types.ts`  импортирует отсюда
//   - `codec-types.ts`  реэкспортирует отсюда для обратной совместимости
//
// Цикл разорван.
//
// ════════════════════════════════════════════════════════════
// СОДЕРЖИМОЕ
// ════════════════════════════════════════════════════════════
//
//   1. SourceChainItem          — элемент цепочки источников
//   2. ComponentProp            — prop компонента/элемента
//   3. ComponentEvent           — обработчик события
//   4. ComponentDirective       — директива Vue
//   5. ComponentSlot            — слот компонента
//   6. HtmlInterpolation        — интерполяция {{ expr }}
//   7. ComponentUsage           — использование компонента
//   8. HtmlElementUsage         — использование HTML-элемента
//   9. DomApiEffect             — эффект DOM API-вызова
//  10. DomApiTargetKind         — вид target DOM API-вызова
//  11. DomApiArgKind            — вид аргумента DOM API-вызова
//  12. DomApiArgSource          — источник разрешения аргумента
//  13. DomApiArg                — разрешённый аргумент
//  14. DomApiContext            — контекст DOM API-вызова
//
// ⚠️ ВАЖНО: эти типы используются как в codec-слое, так и в
// entities-слое. Их НЕЛЬЗЯ размещать в codec-types.ts или types.ts
// без риска циклического импорта.
// ============================================================

// ============================================================
// 1. SOURCE CHAIN (цепочка источников значения)
// ============================================================

/**
 * Элемент цепочки источников.
 *
 * ════════════════════════════════════════════════════════════
 * НАЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   Описывает, откуда пришло значение переменной в шаблоне.
 *   Используется в компонентах для трассировки источников props
 *   и обработчиков событий.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // В шаблоне: <Child :title="user.name" />
 *   //
 *   // SourceChainItem[]:
 *   //   [
 *   //     { kind: 'prop', symbol: 'user' },
 *   //     { kind: 'member', symbol: 'name' },
 *   //   ]
 */
export interface SourceChainItem {
  /** Вид источника */
  kind: 'local' | 'import' | 'prop' | 'emit' | 'global' | 'literal' | 'member' | 'call' | 'unknown';

  /** Символ (имя переменной, члена, функции) */
  symbol: string;

  /** ID функции, если источник — вызов функции */
  functionId?: string;

  /** Дополнительный подвид (для local) */
  subkind?: 'ref' | 'computed' | 'watch' | 'function' | 'method' | 'constant' | 'composable';

  /** ID файла-источника (для import) */
  sourceFileId?: string;
}

// ============================================================
// 2. COMPONENT PROP
// ============================================================

/**
 * Prop, переданный в компонент или HTML-элемент.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   <!-- В шаблоне: -->
 *   <AiToolbar :user-toolbar-items="props.toolbarItems" />
 *
 *   // ComponentProp:
 *   {
 *     id: 'cu1:cp1',
 *     usageId: 'cu1',
 *     name: 'user-toolbar-items',
 *     value: 'props.toolbarItems',
 *     kind: 'dynamic',
 *     line: 5,
 *     identifier: 'props',
 *     memberChain: ['props', 'toolbarItems'],
 *     sourceChain: [
 *       { kind: 'prop', symbol: 'props' },
 *       { kind: 'member', symbol: 'toolbarItems' },
 *     ],
 *   }
 */
export interface ComponentProp {
  /** ID: `${usageId}:cp${n}` (например, cu1:cp6) */
  id: string;

  /** ID использования (cu1, he5) */
  usageId: string;

  /** Имя prop ('user-toolbar-items') */
  name: string;

  /** Значение ('props.toolbarItems') */
  value: string;

  /** Вид prop */
  kind: 'static' | 'dynamic' | 'boolean' | 'spread';

  /** Номер строки */
  line: number;

  /** Идентификатор (первый в цепочке) или null */
  identifier: string | null;

  /** Цепочка member-доступов ['props', 'toolbarItems'] */
  memberChain?: string[];

  /** Литеральное значение (если prop — литерал) */
  literalValue?: string | number | boolean | null;

  /** Цепочка источников */
  sourceChain: SourceChainItem[];
}

// ============================================================
// 3. COMPONENT EVENT
// ============================================================

/**
 * Обработчик события на компоненте/элементе.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   <!-- В шаблоне: -->
 *   <AiToolbar @column-chooser-change="setColumnsVisibility" />
 *
 *   // ComponentEvent:
 *   {
 *     id: 'cu1:ce1',
 *     usageId: 'cu1',
 *     eventName: 'column-chooser-change',
 *     handler: 'setColumnsVisibility',
 *     handlerFunctionId: 'fn42',
 *     handlerSource: 'local',
 *     modifiers: [],
 *     line: 5,
 *     handlerChain: [
 *       { kind: 'local', symbol: 'setColumnsVisibility', functionId: 'fn42' },
 *     ],
 *   }
 */
export interface ComponentEvent {
  /** ID: `${usageId}:ce${n}` */
  id: string;

  /** ID использования */
  usageId: string;

  /** Имя события ('column-chooser-change') */
  eventName: string;

  /** Обработчик из шаблона ('setColumnsVisibility') */
  handler: string;

  /** ID функции-обработчика или null */
  handlerFunctionId: string | null;

  /** Источник обработчика */
  handlerSource: 'local' | 'import' | 'global' | 'inline' | 'unknown';

  /** Модификаторы (.stop, .prevent, ...) */
  modifiers: string[];

  /** Номер строки */
  line: number;

  /** Цепочка источников обработчика */
  handlerChain: SourceChainItem[];
}

// ============================================================
// 4. COMPONENT DIRECTIVE
// ============================================================

/**
 * Директива Vue на компоненте/элементе.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   <!-- В шаблоне: -->
 *   <AiToolbar v-if="!props.isPopover" v-model:title="title" />
 *
 *   // ComponentDirective:
 *   [
 *     {
 *       id: 'cu1:cd1',
 *       usageId: 'cu1',
 *       name: 'v-if',
 *       modifiers: [],
 *       value: '!props.isPopover',
 *       line: 5,
 *     },
 *     {
 *       id: 'cu1:cd2',
 *       usageId: 'cu1',
 *       name: 'v-model',
 *       argument: 'title',
 *       modifiers: [],
 *       value: 'title',
 *       line: 5,
 *     },
 *   ]
 */
export interface ComponentDirective {
  /** ID: `${usageId}:cd${n}` */
  id: string;

  /** ID использования */
  usageId: string;

  /** Имя директивы ('v-if') */
  name: string;

  /** Аргумент (для v-model:title → 'title') */
  argument?: string;

  /** Модификаторы */
  modifiers: string[];

  /** Значение директивы */
  value: string;

  /** Номер строки */
  line: number;
}

// ============================================================
// 5. COMPONENT SLOT
// ============================================================

/**
 * Слот, определённый на компоненте.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   <!-- В шаблоне: -->
 *   <AiToolbar>
 *     <template #header="{ title }">
 *       <span>{{ title }}</span>
 *     </template>
 *   </AiToolbar>
 *
 *   // ComponentSlot:
 *   {
 *     id: 'cu1:csl1',
 *     usageId: 'cu1',
 *     slotName: 'header',
 *     isScoped: true,
 *     scopeNames: ['title'],
 *     line: 6,
 *   }
 */
export interface ComponentSlot {
  /** ID: `${usageId}:csl${n}` */
  id: string;

  /** ID использования */
  usageId: string;

  /** Имя слота ('header', 'default') */
  slotName: string;

  /** Есть ли scope у слота */
  isScoped: boolean;

  /** Имена scope-переменных */
  scopeNames: string[];

  /** Номер строки */
  line: number;
}

// ============================================================
// 6. HTML INTERPOLATION
// ============================================================

/**
 * Интерполяция `{{ expr }}` внутри HTML-элемента.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   <!-- В шаблоне: -->
 *   <span>{{ user.name }}</span>
 *
 *   // HtmlInterpolation:
 *   {
 *     id: 'he2:hi1',
 *     usageId: 'he2',
 *     expression: 'user.name',
 *     sourceChain: [
 *       { kind: 'prop', symbol: 'user' },
 *       { kind: 'member', symbol: 'name' },
 *     ],
 *     line: 5,
 *   }
 */
export interface HtmlInterpolation {
  /** ID: `${usageId}:hi${n}` */
  id: string;

  /** ID использования (he5) */
  usageId: string;

  /** Выражение ('count', 'user.name') */
  expression: string;

  /** Цепочка источников */
  sourceChain: SourceChainItem[];

  /** Номер строки */
  line: number;
}

// ============================================================
// 7. COMPONENT USAGE
// ============================================================

/**
 * Использование компонента в <template>.
 *
 * ════════════════════════════════════════════════════════════
 * НАЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   Описывает один тег компонента в шаблоне, включая все
 *   переданные props, обработчики событий, директивы и слоты.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   <!-- В шаблоне: -->
 *   <AiToolbar
 *     :user-toolbar-items="props.toolbarItems"
 *     :is-data-modified="isDirty"
 *     @column-chooser-change="setColumnsVisibility"
 *     v-if="!props.isPopover"
 *   >
 *     <template #header>...</template>
 *   </AiToolbar>
 *
 *   // ComponentUsage:
 *   {
 *     id: 'cu1',
 *     parentFileId: 'f18',
 *     tag: 'AiToolbar',
 *     componentFileId: 'f87',
 *     source: 'local',
 *     line: 5,
 *     props: [...],
 *     events: [...],
 *     directives: [...],
 *     slots: [...],
 *   }
 */
export interface ComponentUsage {
  /** Уникальный ID (cu1, cu2, ...) — глобальный счётчик */
  id: string;

  /** ID файла-родителя (f1, f2, ...) */
  parentFileId: string;

  /** Тег компонента (AiToolbar) */
  tag: string;

  /** ID файла-компонента (f87) или null */
  componentFileId: string | null;

  /** Источник: локальный, глобальный, встроенный, динамический */
  source: 'local' | 'global' | 'builtin' | 'dynamic' | 'unknown';

  /** Имя пакета (для внешних) */
  packageName?: string;

  /** Номер строки */
  line: number;

  /** Номер колонки (отсутствует → -1 в CompactJSON) */
  column?: number;

  /** Props, переданные в компонент */
  props: ComponentProp[];

  /** Events, обработанные на компоненте */
  events: ComponentEvent[];

  /** Директивы на компоненте */
  directives: ComponentDirective[];

  /** Слоты, определённые на компоненте */
  slots: ComponentSlot[];
}

// ============================================================
// 8. HTML ELEMENT USAGE
// ============================================================

/**
 * Использование HTML-элемента в <template>.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   <!-- В шаблоне: -->
 *   <span class="badge">{{ count }}</span>
 *
 *   // HtmlElementUsage:
 *   {
 *     id: 'he2',
 *     parentFileId: 'f18',
 *     tag: 'span',
 *     line: 5,
 *     props: [{ name: 'class', value: 'badge', kind: 'static', ... }],
 *     directives: [],
 *     events: [],
 *     interpolations: [
 *       { id: 'he2:hi1', usageId: 'he2', expression: 'count', ... },
 *     ],
 *   }
 */
export interface HtmlElementUsage {
  /** Уникальный ID (he1, he2, ...) — глобальный счётчик */
  id: string;

  /** ID файла-родителя */
  parentFileId: string;

  /** Тег элемента ('div', 'span') */
  tag: string;

  /** Номер строки */
  line: number;

  /** Номер колонки */
  column?: number;

  /** Props на элементе */
  props: ComponentProp[];

  /** Директивы на элементе */
  directives: ComponentDirective[];

  /** Events на элементе */
  events: ComponentEvent[];

  /** Интерполяции внутри элемента */
  interpolations: HtmlInterpolation[];
}

// ============================================================
// 9. DOM API — ЭФФЕКТ
// ============================================================

/**
 * Эффект DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * ЗНАЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - 'write' — вызов влияет на UI (изменяет DOM)
 *   - 'read'  — вызов только читает DOM (не влияет на UI)
 *   - 'mixed' — комбинированный эффект
 */
export type DomApiEffect = 'write' | 'read' | 'mixed';

// ============================================================
// 10. DOM API — ВИД TARGET
// ============================================================

/**
 * Вид target DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * ЗНАЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - 'document'  — document.*
 *   - 'window'    — window.*
 *   - 'element'   — прямой DOM-элемент
 *   - 'query'     — document.querySelector(...)
 *   - 'ref'       — ref (Vue template ref)
 *   - 'variable'  — локальная переменная
 *   - 'unknown'   — не определено
 */
export type DomApiTargetKind =
  'document' | 'window' | 'element' | 'query' | 'ref' | 'variable' | 'unknown';

// ============================================================
// 11. DOM API — ВИД АРГУМЕНТА
// ============================================================

/**
 * Вид аргумента DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * ЗНАЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - 'literal-string'  — 'foo'
 *   - 'literal-number'  — 42
 *   - 'literal-bool'    — true / false
 *   - 'identifier'      — someVar
 *   - 'member'          — obj.prop
 *   - 'call'            — someFunc()
 *   - 'arrow'           — () => {}
 *   - 'object'          — { ... }
 */
export type DomApiArgKind =
  | 'literal-string'
  | 'literal-number'
  | 'literal-bool'
  | 'identifier'
  | 'member'
  | 'call'
  | 'arrow'
  | 'object';

// ============================================================
// 12. DOM API — ИСТОЧНИК АРГУМЕНТА
// ============================================================

/**
 * Источник разрешения аргумента.
 *
 * ════════════════════════════════════════════════════════════
 * ЗНАЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - 'local'   — локальная переменная
 *   - 'import'  — импорт из другого файла
 *   - 'global'  — глобальная переменная
 *   - 'unknown' — не разрешено
 */
export type DomApiArgSource = 'local' | 'import' | 'global' | 'unknown';

// ============================================================
// 13. DOM API — АРГУМЕНТ
// ============================================================

/**
 * Разрешённый аргумент DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // В коде:
 *   element.addEventListener('click', handleClick);
 *
 *   // DomApiArg[]:
 *   [
 *     {
 *       index: 0,
 *       raw: "'click'",
 *       kind: 'literal-string',
 *     },
 *     {
 *       index: 1,
 *       raw: 'handleClick',
 *       kind: 'identifier',
 *       resolvedFunctionId: 'fn42',
 *       resolvedSource: 'local',
 *     },
 *   ]
 */
export interface DomApiArg {
  /** Индекс аргумента в вызове (0-based) */
  index: number;

  /** Сырое значение из кода */
  raw: string;

  /** Вид аргумента */
  kind: DomApiArgKind;

  /** ID функции (если аргумент — функция) */
  resolvedFunctionId?: string;

  /** Источник разрешения */
  resolvedSource?: DomApiArgSource;
}

// ============================================================
// 14. DOM API — КОНТЕКСТ
// ============================================================

/**
 * Контекст DOM API-вызова.
 *
 * ════════════════════════════════════════════════════════════
 * НАЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   Опциональные детали, специфичные для категории вызова:
 *   - eventName для addEventListener
 *   - cssSelector для querySelector
 *   - className для classList.add
 *   и т.д.
 */
export interface DomApiContext {
  /** Имя события (для add-event-listener) */
  eventName?: string;

  /** ID функции-обработчика (для add-event-listener) */
  handlerFunctionId?: string | null;

  /** Источник обработчика */
  handlerSource?: 'local' | 'import' | 'global' | 'inline' | 'unknown';

  /** CSS-селектор (для query-selector) */
  cssSelector?: string;

  /** HTML-значение (для inner-html) */
  htmlValue?: string;

  /** Имя класса (для class-list) */
  className?: string;

  /** Имя стиля (для style-set) */
  styleProp?: string;

  /** Имя атрибута (для set-attribute) */
  attributeName?: string;

  /** Опции observer (для mutation-observer) */
  observeOptions?: string[];
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
//
// Все типы экспортируются через `export interface` / `export type`
// выше. Default-экспорт оставлен пустым — для совместимости с
// инструментами, которые ожидают default export.
//
// Использование:
//   import type { ComponentUsage } from './types-vue-template.js';  // ✅
//   import types from './types-vue-template.js';                    // ⚠️ не рекомендуется
// ============================================================

export default {
  // Только типы — значения отсутствуют.
};
