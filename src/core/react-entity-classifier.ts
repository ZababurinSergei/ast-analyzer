// src/core/react-entity-classifier.ts
// ============================================================
// КЛАССИФИКАТОР REACT-СУЩНОСТЕЙ
// ============================================================
// Версия: 1.4.0 (flow-секции)
//
// ИЗМЕНЕНИЯ v1.4.0:
//   - ✅ ДОБАВЛЕНО: flow-типы:
//       • EventFlowStep
//       • ReactEventFlow
//       • ReactStateFlow
//       • ReactRenderNode
//       • ReactFnJsxUsage
//   - ✅ РАСШИРЕНО: ReactEntities полями stateFlows/eventFlows/
//     renderTree/fnJsxUsage.
//   - ✅ РАСШИРЕНО: инициализация result — новые секции как [].
//
// ИЗМЕНЕНИЯ v1.3.0:
//   - ✅ УБРАНО: вся диагностика console.log с префиксом
//     [classifyReact]. debugInfo по-прежнему сохраняется
//     в result.__debug, но не печатается.
//
// ИЗМЕНЕНИЯ v1.2.0:
//   - ✅ ДОБАВЛЕНО: диагностический console.log для КАЖДОГО
//     файла в sortedFilePaths.
//   - ✅ ДОБАВЛЕНО: расширенный debugInfo (массивы tsxFilePaths
//     и otherFilePaths).
//
// ИЗМЕНЕНИЯ v1.1.0:
//   - ✅ ФОЛБЭК: если path.extname не даёт .tsx/.jsx, проверяем
//     filePath.endsWith('.tsx') / '.jsx'.
//   - ✅ ДОБАВЛЕНО: debugInfo на результате.
//
// НАЗНАЧЕНИЕ
// ----------
// Собирает структурированные React-сущности из FullJSON
// на основе entitiesMap. Симметричен classifyVueEntities.
//
// ЧТО СОБИРАЕТ
// ------------
//   • components      — React-компоненты (.tsx/.jsx)
//   • hooks           — useState/useEffect/... хуки
//   • effects         — useEffect/useLayoutEffect с deps
//   • contexts        — createContext + useContext
//   • memoization     — useMemo/useCallback/React.memo
//   • refs            — useRef + forwardRef
//   • jsxElements     — элементы JSX с ElementAttr[]
//   • jsxEvents       — onClick/onChange/... с handler
//   • conditionals    — && / || / ?: в JSX
//   • componentUsages — где используются компоненты
//   • stateFlows      — state ↔ mutation ↔ read ↔ render (v17.1.0)
//   • eventFlows      — event → handler → call → state → render (v17.1.0)
//   • renderTree      — иерархия JSX с зависимостями (v17.1.0)
//   • fnJsxUsage      — обратный индекс: функция → JSX (v17.1.0)
//
// ПРИНЦИП
// -------
//   1. Стабильный порядок (sortedFilePaths).
//   2. Генерация глобально уникальных ID:
//        rc1, rc2, ... (React Component)
//        rh1, rh2, ... (React Hook)
//        re1, re2, ... (React Effect)
//        rctx1, rctx2, ... (React Context)
//        rm1, rm2, ... (React Memoization)
//        rr1, rr2, ... (React Ref)
//        rj1, rj2, ... (React JSX element)
//        rje1, rje2, ... (React JSX event)
//        rcd1, rcd2, ... (React Conditional)
//        rsf1, rsf2, ... (React State Flow)
//        ref1, ref2, ... (React Event Flow)
//   3. Опциональность — если React-кода нет, всё пустое.
//
// СВЯЗЬ С VUE
// -----------
//   Vue:   core/vue-entity-classifier.ts
//   React: core/react-entity-classifier.ts  ← этот файл
// ============================================================

import path from 'path';
import type { EntitiesResult } from '../types.js';

// ============================================================
// ОСНОВНОЙ ИНТЕРФЕЙС
// ============================================================

/**
 * Классифицированные React-сущности для FullJSON.react.
 */
export interface ReactEntities {
  /** React-компоненты */
  components: ReactComponentEntity[];
  /** Хуки React */
  hooks: ReactHookEntity[];
  /** Эффекты (useEffect/useLayoutEffect) */
  effects: ReactEffectEntity[];
  /** Контексты */
  contexts: ReactContextEntity[];
  /** Мемоизация (useMemo/useCallback/React.memo) */
  memoization: ReactMemoEntity[];
  /** Ссылки (useRef/forwardRef) */
  refs: ReactRefEntity[];
  /** JSX-элементы */
  jsxElements: JsxElementEntity[];
  /** JSX-события */
  jsxEvents: JsxEventEntity[];
  /** Условный рендеринг в JSX */
  conditionals: ReactConditionalEntity[];
  /** Использования компонентов (обратный индекс) */
  componentUsages: ReactComponentUsage[];

  // ✅ v17.1.0: FLOW-секции
  /** Потоки состояния (state ↔ mutation ↔ read ↔ render) */
  stateFlows: ReactStateFlow[];
  /** Потоки событий (event → handler → call → state → render) */
  eventFlows: ReactEventFlow[];
  /** Дерево рендера (иерархия JSX с зависимостями) */
  renderTree: ReactRenderNode[];
  /** Обратный индекс: функция → JSX-элементы */
  fnJsxUsage: ReactFnJsxUsage[];
}

// ============================================================
// 1. REACT COMPONENT
// ============================================================

/**
 * Вид React-компонента.
 */
export type ReactComponentKind = 'function' | 'arrow' | 'class' | 'memo' | 'forwardRef' | 'lazy';

/**
 * React-компонент.
 */
export interface ReactComponentEntity {
  /** ID (rc1, rc2, ...) */
  id: string;
  /** Путь к файлу (абсолютный, резолвится позже) */
  fileId: string;
  /** ID модуля (заполняется позже) */
  moduleId: string;
  /** Имя компонента (PascalCase) */
  name: string;
  /** Вид компонента */
  kind: ReactComponentKind;
  /** Строка объявления */
  line: number;
  /** Props (имена) */
  props: string[];
  /** ID hooks внутри компонента */
  hooks: string[];
  /** ID JSX-элементов внутри компонента */
  jsxElements: string[];
  /** Мемоизирован (React.memo) */
  isMemoized: boolean;
  /** Обёрнут в forwardRef */
  isForwardRef: boolean;
  /** Экспортируется по умолчанию */
  isDefaultExport: boolean;
  /** Экспортируется */
  isExported: boolean;
}

// ============================================================
// 2. REACT HOOK
// ============================================================

/**
 * Вид хука.
 */
export type ReactHookKind =
  | 'useState'
  | 'useReducer'
  | 'useEffect'
  | 'useLayoutEffect'
  | 'useInsertionEffect'
  | 'useMemo'
  | 'useCallback'
  | 'useRef'
  | 'useContext'
  | 'useImperativeHandle'
  | 'useTransition'
  | 'useDeferredValue'
  | 'useActionState'
  | 'useOptimistic'
  | 'useFormStatus'
  | 'use';

/**
 * React-хук.
 */
export interface ReactHookEntity {
  /** ID (rh1, rh2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID родительского компонента */
  componentId: string;
  /** Вид хука */
  kind: ReactHookKind;
  /** Строка вызова */
  line: number;
  /** Имя state-переменной (для useState/useReducer) */
  stateName?: string;
  /** Имя setter-функции (для useState) */
  setterName?: string;
  /** Начальное значение (как строка) */
  initialValue?: string;
  /** Зависимости (для useEffect/useMemo/useCallback) */
  deps?: string[];
  /** Есть ли cleanup-функция (для useEffect) */
  hasCleanup?: boolean;
  /** Используется в рендере (читается в JSX) */
  usedInRender?: boolean;
}

// ============================================================
// 3. REACT EFFECT
// ============================================================

/**
 * Вид эффекта.
 */
export type ReactEffectKind = 'mount' | 'update' | 'every' | 'layout' | 'insertion';

/**
 * React-эффект (useEffect/useLayoutEffect).
 */
export interface ReactEffectEntity {
  /** ID (re1, re2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID родительского компонента */
  componentId: string;
  /** ID hook (rhN) */
  hookId: string;
  /** Вид эффекта */
  kind: ReactEffectKind;
  /** Строка вызова */
  line: number;
  /** Зависимости (из deps-массива) */
  deps: string[];
  /** Есть ли cleanup */
  hasCleanup: boolean;
  /** Читает ли state/props */
  reads: string[];
  /** Мутирует ли state */
  mutates: string[];
}

// ============================================================
// 4. REACT CONTEXT
// ============================================================

/**
 * Вид использования контекста.
 */
export type ReactContextKind = 'create' | 'provide' | 'consume';

/**
 * React-контекст.
 */
export interface ReactContextEntity {
  /** ID (rctx1, rctx2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID компонента, где создан/используется */
  componentId: string;
  /** Вид: create / provide / consume */
  kind: ReactContextKind;
  /** Строка */
  line: number;
  /** Имя контекста (если есть) */
  name?: string;
}

// ============================================================
// 5. REACT MEMOIZATION
// ============================================================

/**
 * Вид мемоизации.
 */
export type ReactMemoKind = 'memo' | 'useMemo' | 'useCallback';

/**
 * React-мемоизация.
 */
export interface ReactMemoEntity {
  /** ID (rm1, rm2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID родительского компонента */
  componentId: string;
  /** Вид */
  kind: ReactMemoKind;
  /** Строка */
  line: number;
  /** Зависимости */
  deps?: string[];
}

// ============================================================
// 6. REACT REF
// ============================================================

/**
 * React-ref (useRef/forwardRef).
 */
export interface ReactRefEntity {
  /** ID (rr1, rr2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID родительского компонента */
  componentId: string;
  /** Строка */
  line: number;
  /** Имя ref-переменной */
  name?: string;
  /** Обёрнут в forwardRef */
  isForwardRef: boolean;
}

// ============================================================
// 7. JSX ELEMENT + ElementAttr
// ============================================================

/**
 * Вид JSX-элемента.
 */
export type JsxNodeKind =
  'element' | 'component' | 'fragment' | 'text' | 'expression' | 'spread' | 'conditional';

/**
 * Вид значения атрибута JSX.
 */
export type ElementAttrKind = 'string' | 'expression' | 'handler' | 'boolean' | 'spread';

/**
 * Структурированный атрибут JSX-элемента.
 *
 * ✅ v17.0.0 (Фаза A): полностью структурирован.
 */
export interface ElementAttr {
  /** Имя атрибута: 'onClick', 'open', 'className' */
  name: string;
  /** Сырое значение: '{handleClick}', '"primary"' */
  rawValue: string;
  /** Разобранное значение: 'handleClick', 'primary' */
  value: string;
  /** Тип значения */
  kind: ElementAttrKind;
  /** Идентификаторы, использованные в value */
  refs: string[];
  /** Ссылка на функцию (если handler) */
  handlerFunctionId?: string;
  /** Ссылка на state (если из useState) */
  stateRef?: string;
}

/**
 * JSX-элемент.
 */
export interface JsxElementEntity {
  /** ID (rj1, rj2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID родительского компонента */
  componentId: string;
  /** Вид */
  kind: JsxNodeKind;
  /** Имя тега/компонента */
  tagName: string;
  /** Строка */
  line: number;
  /** Колонка */
  column?: number;

  // ✅ v17.0.0: структурированные атрибуты
  attrs: ElementAttr[];

  /** ID дочерних элементов */
  children: string[];

  /** Текст (для text) */
  textContent?: string;
  /** Выражение (для expression) */
  expression?: string;
  /** Идентификаторы в expression */
  expressionRefs?: string[];

  /** ID родительского элемента */
  parentElementId: string | null;

  /** Вид условия (для conditional) */
  conditionalKind?: '&&' | '||' | '?:';

  // ✅ v17.0.0: обратные индексы
  /** ID событий на этом элементе */
  eventIds: string[];
  /** ID hooks, чьи state/setter используются */
  stateUsages: string[];
  /** ID componentProps (входящие props) */
  propUsages: string[];
  /** ID calls (вызовы внутри expression) */
  callExpressions: string[];
}

// ============================================================
// 8. JSX EVENT
// ============================================================

/**
 * Источник handler-функции.
 */
export type EventHandlerSource = 'local' | 'import' | 'global' | 'inline' | 'unknown';

/**
 * JSX-событие (onClick/onChange/...).
 */
export interface JsxEventEntity {
  /** ID (rje1, rje2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID JSX-элемента, на котором событие */
  elementId: string;
  /** Имя события: 'onClick', 'onChange' */
  eventName: string;
  /** Строка */
  line: number;
  /** Имя handler-функции: 'handleClick' */
  handler: string;
  /** ID функции handler (если разрешена) */
  handlerFunctionId?: string;
  /** Источник handler */
  source: EventHandlerSource;
  /** Модификаторы (если есть) */
  modifiers?: string[];
}

// ============================================================
// 9. CONDITIONAL
// ============================================================

/**
 * Условный рендеринг в JSX.
 */
export interface ReactConditionalEntity {
  /** ID (rcd1, rcd2, ...) */
  id: string;
  /** Путь к файлу */
  fileId: string;
  /** ID родительского компонента */
  componentId: string;
  /** Вид: &&, ||, ?: */
  kind: '&&' | '||' | '?:';
  /** Выражение условия */
  condition: string;
  /** Идентификаторы в условии */
  refs: string[];
  /** Строка */
  line: number;
  /** ID элементов под условием */
  guards: string[];
}

// ============================================================
// 10. COMPONENT USAGE
// ============================================================

/**
 * Использование React-компонента.
 */
export interface ReactComponentUsage {
  /** ID (rcu1, rcu2, ...) */
  id: string;
  /** ID JSX-элемента, где используется */
  usageId: string;
  /** Имя компонента */
  tagName: string;
  /** ID родительского компонента */
  parentComponentId: string;
  /** Строка */
  line: number;
  /** ID целевого компонента (если разрешён) */
  targetComponentId?: string;
  /** Откуда импортирован (fileId) */
  importedFrom?: string;
  /** Внешний (из node_modules) */
  isExternal: boolean;
  /** Имена props, переданных компоненту */
  props: string[];
  /** Имена events, переданных компоненту */
  events: string[];
  /** Дети (slots) */
  slots: string[];
}

// ============================================================
// 11. FLOW-СУЩНОСТИ (v17.1.0)
// ============================================================
//
// Четыре новые секции для трассировки потоков:
//   • stateFlows   — state ↔ mutation ↔ read ↔ render
//   • eventFlows   — event → handler → call → state → render
//   • renderTree   — иерархия JSX с зависимостями
//   • fnJsxUsage   — обратный индекс: функция → JSX
//
// Все секции — производные от components/hooks/jsxElements/jsxEvents.
// Строятся в modes/react-analyzer/flows/*.ts.
// ============================================================

/**
 * Один шаг в цепочке eventFlow.
 */
export interface EventFlowStep {
  /** Тип шага */
  step: 'event' | 'handler' | 'call' | 'state' | 'render';
  /** ID сущности (rjeN / fnN / cN / rhN / rjN) */
  refId: string;
  /** Человекочитаемая метка */
  label: string;
  /** Строка */
  line: number;
}

/**
 * Поток события: onClick → handler → call → setState → render.
 */
export interface ReactEventFlow {
  /** ID (ref1, ref2, ...) */
  id: string;
  /** ID события (rjeN) */
  eventId: string;
  /** Имя события (onClick) */
  eventName: string;
  /** ID JSX-элемента (rjN) */
  elementId: string;
  /** ID функции handler (fnN или '') */
  handlerFunctionId: string;
  /** Имя handler-функции (handleClick) */
  handlerName: string;
  /** Что вызывает handler */
  calls: Array<{
    functionId: string;
    calleeName: string;
    line: number;
  }>;
  /** ID hooks, которые мутируются */
  mutatedStates: string[];
  /** ID компонентов, которые ре-рендерятся */
  reRendered: string[];
  /** Цепочка шагов */
  chain: EventFlowStep[];
}

/**
 * Поток состояния: где мутируется, где читается, где рендерится.
 */
export interface ReactStateFlow {
  /** ID (rsf1, rsf2, ...) */
  id: string;
  /** ID hook (rhN) */
  hookId: string;
  /** Имя state-переменной (isOpen) */
  stateName: string;
  /** Имя setter-функции (setIsOpen) */
  setterName: string;
  /** Кто мутирует (вызывает setterName) */
  mutatedBy: Array<{
    functionId: string;
    callId: string;
    line: number;
  }>;
  /** Кто читает (stateName в теле функции) */
  readBy: Array<{
    functionId: string;
    line: number;
  }>;
  /** Где используется в JSX */
  renderedIn: Array<{
    jsxElementId: string;
    attrName: string;
    kind: 'attr' | 'text' | 'conditional' | 'handler';
    line: number;
  }>;
}

/**
 * Узел дерева рендера (плоский список с parentId).
 */
export interface ReactRenderNode {
  /** ID JSX-элемента (rjN) */
  elementId: string;
  /** Имя тега/компонента */
  tagName: string;
  /** Вид */
  kind: 'element' | 'component' | 'fragment';
  /** ID родителя (или null) */
  parentId: string | null;
  /** Что влияет на рендер */
  dependsOn: {
    stateIds: string[];
    propIds: string[];
    contextIds: string[];
  };
  /** Условный рендеринг */
  conditionals: Array<{
    kind: '&&' | '||' | '?:';
    condition: string;
    refs: string[];
  }>;
}

/**
 * Обратный индекс: функция → JSX-элементы, где она используется.
 */
export interface ReactFnJsxUsage {
  /** ID функции (fnN) */
  functionId: string;
  /** Имя функции (handleClick) */
  functionName: string;
  /** Где используется */
  usedIn: Array<{
    jsxElementId: string;
    usage: 'handler' | 'value' | 'condition' | 'render';
    line: number;
  }>;
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ: ПРОВЕРКА РАСШИРЕНИЯ
// ============================================================

/**
 * ✅ v1.1.0: проверка — является ли путь React-файлом (.tsx/.jsx).
 *
 * Раньше использовался только `path.extname`. Но если filePath
 * приходит как абсолютный путь или с нестандартным расширением,
 * `path.extname` может не сработать.
 *
 * Фолбэк: `endsWith('.tsx')` / `endsWith('.jsx')`.
 */
function isReactFilePath(filePath: string): boolean {
  if (!filePath) return false;

  // 1. Основной путь — через extname
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.tsx' || ext === '.jsx') return true;

  // 2. Фолбэк — endsWith
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) return true;

  return false;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Классифицирует React-сущности из entitiesMap.
 *
 * Алгоритм:
 *   1. Сортирует ключи (стабильный порядок).
 *   2. Для каждого .tsx/.jsx файла:
 *      a. Читает React-поля из EntitiesResult.
 *      b. Генерирует глобально уникальные ID.
 *   3. Возвращает ReactEntities.
 */
export function classifyReactEntities(entitiesMap: Record<string, EntitiesResult>): ReactEntities {
  const result: ReactEntities = {
    components: [],
    hooks: [],
    effects: [],
    contexts: [],
    memoization: [],
    refs: [],
    jsxElements: [],
    jsxEvents: [],
    conditionals: [],
    componentUsages: [],

    // ✅ v17.1.0: FLOW-секции
    stateFlows: [],
    eventFlows: [],
    renderTree: [],
    fnJsxUsage: [],
  };

  // Стабильный порядок обхода
  const sortedFilePaths = Object.keys(entitiesMap).sort();

  // Счётчики
  let componentCounter = 0;
  let hookCounter = 0;
  let effectCounter = 0;
  let contextCounter = 0;
  let memoCounter = 0;
  let refCounter = 0;
  let jsxCounter = 0;
  let jsxEventCounter = 0;
  let conditionalCounter = 0;
  let usageCounter = 0;

  // ✅ v1.1.0: диагностика — собираем статистику по всем файлам
  // (без console.log — debugInfo пишется в result.__debug)
  const debugInfo: {
    totalFiles: number;
    tsxFiles: number;
    withReactComponents: number;
    tsxFilePaths: string[];
    otherFilePaths: string[];
  } = {
    totalFiles: sortedFilePaths.length,
    tsxFiles: 0,
    withReactComponents: 0,
    tsxFilePaths: [],
    otherFilePaths: [],
  };

  // ════════════════════════════════════════════════════════════
  // Основной цикл — классификация
  // ════════════════════════════════════════════════════════════
  for (const filePath of sortedFilePaths) {
    // ✅ v1.1.0: используем isReactFilePath (фолбэк на endsWith)
    if (!isReactFilePath(filePath)) {
      debugInfo.otherFilePaths.push(filePath);
      continue;
    }

    debugInfo.tsxFiles++;
    debugInfo.tsxFilePaths.push(filePath);

    const entities = entitiesMap[filePath];
    if (!entities) continue;

    const e = entities as any;

    // ✅ v1.1.0: проверяем, есть ли React-поля
    if (Array.isArray(e.reactComponents) && e.reactComponents.length > 0) {
      debugInfo.withReactComponents++;
    }

    // ============================================================
    // 1. COMPONENTS
    // ============================================================
    if (Array.isArray(e.reactComponents)) {
      for (const c of e.reactComponents) {
        componentCounter++;
        result.components.push({
          id: `rc${componentCounter}`,
          fileId: filePath,
          moduleId: '',
          name: c.name ?? `Component${componentCounter}`,
          kind: c.kind ?? 'function',
          line: c.line ?? 0,
          props: c.props ?? [],
          hooks: [],
          jsxElements: [],
          isMemoized: c.isMemoized ?? false,
          isForwardRef: c.isForwardRef ?? false,
          isDefaultExport: c.isDefaultExport ?? false,
          isExported: c.isExported ?? false,
        });
      }
    }

    // ============================================================
    // 2. HOOKS
    // ============================================================
    if (Array.isArray(e.reactHooks)) {
      for (const h of e.reactHooks) {
        hookCounter++;
        result.hooks.push({
          id: `rh${hookCounter}`,
          fileId: filePath,
          componentId: h.componentId ?? '',
          kind: h.kind ?? 'useState',
          line: h.line ?? 0,
          stateName: h.stateName,
          setterName: h.setterName,
          initialValue: h.initialValue,
          deps: h.deps ?? [],
          hasCleanup: h.hasCleanup ?? false,
          usedInRender: h.usedInRender ?? false,
        });
      }
    }

    // ============================================================
    // 3. EFFECTS
    // ============================================================
    if (Array.isArray(e.reactEffects)) {
      for (const ef of e.reactEffects) {
        effectCounter++;
        result.effects.push({
          id: `re${effectCounter}`,
          fileId: filePath,
          componentId: ef.componentId ?? '',
          hookId: ef.hookId ?? '',
          kind: ef.kind ?? 'mount',
          line: ef.line ?? 0,
          deps: ef.deps ?? [],
          hasCleanup: ef.hasCleanup ?? false,
          reads: ef.reads ?? [],
          mutates: ef.mutates ?? [],
        });
      }
    }

    // ============================================================
    // 4. CONTEXTS
    // ============================================================
    if (Array.isArray(e.reactContexts)) {
      for (const ctx of e.reactContexts) {
        contextCounter++;
        result.contexts.push({
          id: `rctx${contextCounter}`,
          fileId: filePath,
          componentId: ctx.componentId ?? '',
          kind: ctx.kind ?? 'create',
          line: ctx.line ?? 0,
          name: ctx.name,
        });
      }
    }

    // ============================================================
    // 5. MEMOIZATION
    // ============================================================
    if (Array.isArray(e.reactMemoization)) {
      for (const m of e.reactMemoization) {
        memoCounter++;
        result.memoization.push({
          id: `rm${memoCounter}`,
          fileId: filePath,
          componentId: m.componentId ?? '',
          kind: m.kind ?? 'memo',
          line: m.line ?? 0,
          deps: m.deps ?? [],
        });
      }
    }

    // ============================================================
    // 6. REFS
    // ============================================================
    if (Array.isArray(e.reactRefs)) {
      for (const r of e.reactRefs) {
        refCounter++;
        result.refs.push({
          id: `rr${refCounter}`,
          fileId: filePath,
          componentId: r.componentId ?? '',
          line: r.line ?? 0,
          name: r.name,
          isForwardRef: r.isForwardRef ?? false,
        });
      }
    }

    // ============================================================
    // 7. JSX ELEMENTS (v1.4.0: маппинг jsx_N → rjN)
    // ============================================================
    //
    // Parser генерирует внутренние ID (`jsx_0`, `jsx_1`), а classifier
    // присваивает глобальные (`rj1`, `rj2`). Все ссылки (parentElementId,
    // jsxEvents.elementId, componentUsages.usageId) содержат внутренние ID.
    // Строим маппинг `usageId → globalId` и резолвим ссылки.
    // ============================================================
    const usageIdMap = new Map<string, string>();
    if (Array.isArray(e.reactJsxElements)) {
      for (const el of e.reactJsxElements) {
        jsxCounter++;
        const globalId = `rj${jsxCounter}`;
        const usageId = (el as any).usageId ?? '';
        if (usageId) usageIdMap.set(usageId, globalId);

        result.jsxElements.push({
          id: globalId,
          fileId: filePath,
          componentId: el.componentId ?? '',
          kind: el.kind ?? 'element',
          tagName: el.tagName ?? '',
          line: el.line ?? 0,
          column: el.column,
          attrs: el.attrs ?? [],
          children: el.children ?? [],
          textContent: el.textContent,
          expression: el.expression,
          expressionRefs: el.expressionRefs ?? [],
          parentElementId: el.parentElementId ?? null,
          conditionalKind: el.conditionalKind,
          eventIds: el.eventIds ?? [],
          stateUsages: el.stateUsages ?? [],
          propUsages: el.propUsages ?? [],
          callExpressions: el.callExpressions ?? [],
        });
      }
    }

    // ── Резолв parentElementId через маппинг ──
    for (const el of result.jsxElements) {
      if (el.parentElementId) {
        if (usageIdMap.has(el.parentElementId)) {
          el.parentElementId = usageIdMap.get(el.parentElementId)!;
        } else if (el.parentElementId.startsWith('jsx_')) {
          el.parentElementId = null;
        }
      }
    }

    // ============================================================
    // 8. JSX EVENTS
    // ============================================================
    if (Array.isArray(e.reactJsxEvents)) {
      for (const ev of e.reactJsxEvents) {
        jsxEventCounter++;
        const rawElementId = ev.elementId ?? '';
        const resolvedElementId = usageIdMap.get(rawElementId) ?? rawElementId;
        result.jsxEvents.push({
          id: `rje${jsxEventCounter}`,
          fileId: filePath,
          elementId: resolvedElementId,
          eventName: ev.eventName ?? '',
          line: ev.line ?? 0,
          handler: ev.handler ?? '',
          handlerFunctionId: ev.handlerFunctionId,
          source: ev.source ?? 'unknown',
          modifiers: ev.modifiers ?? [],
        });
      }
    }

    // ============================================================
    // 9. CONDITIONALS
    // ============================================================
    if (Array.isArray(e.reactConditionals)) {
      for (const cd of e.reactConditionals) {
        conditionalCounter++;
        result.conditionals.push({
          id: `rcd${conditionalCounter}`,
          fileId: filePath,
          componentId: cd.componentId ?? '',
          kind: cd.kind ?? '&&',
          condition: cd.condition ?? '',
          refs: cd.refs ?? [],
          line: cd.line ?? 0,
          guards: cd.guards ?? [],
        });
      }
    }

    // ============================================================
    // 10. COMPONENT USAGES
    // ============================================================
    if (Array.isArray(e.reactComponentUsages)) {
      for (const u of e.reactComponentUsages) {
        usageCounter++;
        const rawUsageId = u.usageId ?? '';
        const resolvedUsageId = usageIdMap.get(rawUsageId) ?? rawUsageId;
        result.componentUsages.push({
          id: `rcu${usageCounter}`,
          usageId: resolvedUsageId,
          tagName: u.tagName ?? '',
          parentComponentId: u.parentComponentId ?? '',
          line: u.line ?? 0,
          targetComponentId: u.targetComponentId,
          importedFrom: u.importedFrom,
          isExternal: u.isExternal ?? false,
          props: u.props ?? [],
          events: u.events ?? [],
          slots: u.slots ?? [],
        });
      }
    }
  }

  // ✅ v1.1.0: сохраняем debug-информацию на результате
  (result as any).__debug = debugInfo;

  // ============================================================
  // ✅ WS-64: РАЗЛОЖИТЬ hooks ПО components
  // ============================================================
  // После сбора result.hooks (плоский список) и result.components —
  // связываем их: для каждого component находим все hooks
  // с componentId === c.name и записываем их id в c.hooks.
  //
  // ПРИЧИНА:
  //   parseHook в parser.ts теперь заполняет hook.componentId = name.
  //   react-entity-classifier передаёт h.componentId в result.hooks.
  //   Но components[].hooks оставался пустым — этот блок исправляет.
  {
    const hooksByComponentName = new Map<string, string[]>();
    for (const h of result.hooks) {
      const cid = h.componentId;
      if (!cid) continue;
      if (!hooksByComponentName.has(cid)) {
        hooksByComponentName.set(cid, []);
      }
      hooksByComponentName.get(cid)!.push(h.id);
    }

    for (const c of result.components) {
      const hookIds = hooksByComponentName.get(c.name);
      if (hookIds && hookIds.length > 0) {
        c.hooks = hookIds;
      }
    }
  }




  return result;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  classifyReactEntities,
};
