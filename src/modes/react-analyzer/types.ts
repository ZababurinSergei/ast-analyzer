// src/modes/react-analyzer/types.ts
// ============================================================
// ТИПЫ ДЛЯ REACT-АНАЛИЗАТОРА
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Типы для analyzeReactComponent() — парсер .tsx/.jsx через
// @typescript-eslint/parser (уже в зависимостях).
//
// СИММЕТРИЯ С VUE
// ---------------
//   Vue:   modes/vue-analyzer/types.ts — VueComponentAnalysis
//   React: modes/react-analyzer/types.ts — ReactComponentAnalysis ← этот файл
//
// ОТЛИЧИЯ ОТ VUE
// --------------
//   • Нет <template> — JSX прямо в .tsx.
//   • Нет <script setup> — всё в одной области.
//   • Нет macros (defineProps/defineEmits) — props через типы.
//   • Нет SFC-блоков — один файл.
//   • Вместо CSS-переменных — styled-components / CSS-in-JS (не парсим).
// ============================================================

import type {
  ElementAttr,
  JsxNodeKind,
  ReactComponentKind,
  ReactHookKind,
  ReactEffectKind,
  EventHandlerSource,
} from '../../core/react-entity-classifier.js';

// ============================================================
// ОСНОВНОЙ ИНТЕРФЕЙС
// ============================================================

/**
 * Результат анализа одного .tsx/.jsx файла.
 */
export interface ReactComponentAnalysis {
  /** Имя файла (без расширения) */
  fileName: string;
  /** Абсолютный путь */
  filePath: string;
  /** Есть ли TS-синтаксис (по расширению .tsx или наличию type-аннотаций) */
  isTS: boolean;
  /** Размер в байтах */
  size: number;
  /** Количество строк */
  lines: number;

  /** Компоненты в файле */
  components: AnalyzedComponent[];

  /** Хуки, найденные во всём файле */
  hooks: AnalyzedHook[];

  /** Импорты */
  imports: AnalyzedImport[];

  /** Экспорты */
  exports: AnalyzedExport[];

  /** Статистика */
  stats: {
    componentCount: number;
    hookCount: number;
    jsxElementCount: number;
    jsxEventCount: number;
    conditionalCount: number;
    importCount: number;
    exportCount: number;
  };
}

// ============================================================
// КОМПОНЕНТ
// ============================================================

/**
 * Проанализированный React-компонент.
 */
export interface AnalyzedComponent {
  /** Имя компонента */
  name: string;
  /** Вид */
  kind: ReactComponentKind;
  /** Строка объявления */
  line: number;
  /** Колонка */
  column?: number;
  /** Имена props (из типов или destructuring) */
  props: string[];
  /** Экспортируется */
  isExported: boolean;
  /** Экспортируется по умолчанию */
  isDefaultExport: boolean;
  /** Мемоизирован */
  isMemoized: boolean;
  /** forwardRef */
  isForwardRef: boolean;
  /** Хуки внутри компонента */
  hooks: AnalyzedHook[];
  /** JSX-элементы внутри компонента */
  jsxElements: AnalyzedJsxElement[];
  /** JSX-события внутри компонента */
  jsxEvents: AnalyzedJsxEvent[];
  /** Условный рендеринг внутри компонента */
  conditionals: AnalyzedConditional[];
  /** Использования компонентов внутри компонента */
  componentUsages: AnalyzedComponentUsage[];
}

// ============================================================
// HOOK
// ============================================================

/**
 * Проанализированный React-хук.
 */
export interface AnalyzedHook {
  kind: ReactHookKind;
  line: number;
  column?: number;
  /** Для useState/useReducer: имя state */
  stateName?: string;
  /** Для useState: имя setter */
  setterName?: string;
  /** Начальное значение (как строка) */
  initialValue?: string;
  /** Для useEffect/useMemo/useCallback: deps */
  deps?: string[];
  /** Для useEffect: есть cleanup */
  hasCleanup?: boolean;
  /** Для useEffect: вид (mount/update/every/layout/insertion) */
  effectKind?: ReactEffectKind;
  /** Для useContext: имя контекста */
  contextName?: string;
  /** Для useRef: имя переменной */
  refName?: string;
  /** Используется в рендере (читается в JSX) */
  usedInRender?: boolean;
}

// ============================================================
// JSX ELEMENT
// ============================================================

/**
 * Проанализированный JSX-элемент.
 */
export interface AnalyzedJsxElement {
  kind: JsxNodeKind;
  tagName: string;
  line: number;
  column?: number;
  /** Структурированные атрибуты */
  attrs: ElementAttr[];
  /** Дочерние элементы (индексы внутри компонента) */
  children: string[];
  /** Текст (для text) */
  textContent?: string;
  /** Выражение (для expression) */
  expression?: string;
  /** Идентификаторы в expression */
  expressionRefs?: string[];
  /** Индекс родителя (внутри компонента) */
  parentElementId: string | null;
  /** Вид условия (для conditional) */
  conditionalKind?: '&&' | '||' | '?:';
}

// ============================================================
// JSX EVENT
// ============================================================

/**
 * Проанализированное JSX-событие.
 */
export interface AnalyzedJsxEvent {
  /** Индекс JSX-элемента внутри компонента */
  elementId: string;
  /** Имя события: onClick, onChange */
  eventName: string;
  /** Строка */
  line: number;
  /** Имя handler */
  handler: string;
  /** Источник handler */
  source: EventHandlerSource;
}

// ============================================================
// CONDITIONAL
// ============================================================

/**
 * Проанализированное условие в JSX.
 */
export interface AnalyzedConditional {
  kind: '&&' | '||' | '?:';
  condition: string;
  refs: string[];
  line: number;
  /** ID элементов под условием (индексы) */
  guards: string[];
}

// ============================================================
// COMPONENT USAGE
// ============================================================

/**
 * Проанализированное использование компонента.
 */
export interface AnalyzedComponentUsage {
  /** ID JSX-элемента (индекс) */
  usageId: string;
  /** Имя компонента */
  tagName: string;
  /** Строка */
  line: number;
  /** Внешний */
  isExternal: boolean;
  /** Имена props */
  props: string[];
  /** Имена events */
  events: string[];
  /** Дети */
  slots: string[];
}

// ============================================================
// IMPORT / EXPORT
// ============================================================

/**
 * Проанализированный импорт.
 */
export interface AnalyzedImport {
  source: string;
  specifiers: {
    imported: string;
    local: string;
    isTypeOnly: boolean;
  }[];
  isTypeOnly: boolean;
  line: number;
}

/**
 * Проанализированный экспорт.
 */
export interface AnalyzedExport {
  name: string;
  kind: 'named' | 'default';
  isTypeOnly: boolean;
  line: number;
}

// ============================================================
// ОПЦИИ АНАЛИЗА
// ============================================================

/**
 * Опции анализа.
 */
export interface AnalyzeReactOptions {
  /** Включать AST */
  includeAst?: boolean;
  /** Максимальная глубина обхода JSX */
  maxDepth?: number;
  /** Подробный вывод */
  verbose?: boolean;
  /** Проект-корень (для резолва) */
  projectRoot?: string;
}
