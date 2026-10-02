// src/reporters/json/utils/entities-converter.ts
// ============================================================
// КОНВЕРТЕР СУЩНОСТЕЙ: EntitiesResult → EnhancedEntityInfo
// ============================================================
// Версия: 2.3.0
//
// ИЗМЕНЕНИЯ v2.3.0 (v17.0.0: React-сущности):
//   - ✅ ДОБАВЛЕНО: convertEntitiesToEnhanced пробрасывает
//     React-поля из EntitiesResult в EnhancedEntityInfo:
//       • reactComponents
//       • reactHooks
//       • reactEffects
//       • reactContexts
//       • reactMemoization
//       • reactRefs
//       • reactJsxElements
//       • reactJsxEvents
//       • reactConditionals
//       • reactComponentUsages
//   - 🎯 Без этих полей pass7React не видит React-данные:
//     collectFullJSON получает enhancedMap, а не оригинальный
//     entitiesMap.
//   - 📌 Синхронизировано с:
//       • src/types.ts::EnhancedEntityInfo (расширен)
//       • src/pipeline/stages/normalize-entities.ts
//         ::propagateTemplateFields (дублирует для подстраховки)
//
// ИЗМЕНЕНИЯ v2.2.0 (P0/P1: явная нормализация parentFunctionId):
//   - ✅ ИСПРАВЛЕНО: convertFunctions теперь ГАРАНТИРОВАННО пробрасывает
//     parentFunctionId из FunctionInfo в EnhancedFunctionInfo.
//   - ✅ ИСПРАВЛЕНО: convertFunctions теперь нормализует boundTo
//     (добавляет только если задан, чтобы не засорять объект).
//   - ✅ ПРОВЕРЕНО: convertEntitiesToEnhanced пробрасывает lexicalLinks
//     с fallback на [] (не undefined).
//
// ИЗМЕНЕНИЯ v2.1.0 (P0/P1: parentFunctionId + lexicalLinks):
//   - ✅ ДОБАВЛЕНО: convertFunctions пробрасывает parentFunctionId.
//   - ✅ ДОБАВЛЕНО: convertFunctions пробрасывает boundTo.
//   - ✅ ДОБАВЛЕНО: convertEntitiesToEnhanced пробрасывает lexicalLinks.
//
// ИЗМЕНЕНИЯ v2.0.1 (устранение мёртвого кода):
//   - ✅ УДАЛЕНЫ неиспользуемые convertImports и convertExports.
//
// ИЗМЕНЕНИЯ v2.0.0 (расширение функциональности + кроссплатформенность):
//   - ✅ ДОБАВЛЕНО: convertEntitiesToEnhanced пробрасывает все
//     template-поля Vue (templateReactivityDeps, ...).
//   - ✅ ДОБАВЛЕНО: convertEntitiesToEnhanced пробрасывает typesGraph
//     и typeRefsGraph.
//   - ✅ ДОБАВЛЕНО: convertFunctions расширена.
//   - ✅ ДОБАВЛЕНО: convertExports возвращает export для всех.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая конвертация EntitiesResult
// ============================================================

import type {
  EntitiesResult,
  EnhancedEntityInfo,
  EnhancedFunctionInfo,
  EnhancedConstantInfo,
  EnhancedVariableInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  EnhancedClassInfo,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
} from '../../../types.js';

import { createDefaultSecurity } from '../../modules/types.js';

// ============================================================
// СОЗДАНИЕ ПУСТОГО EntitiesResult
// ============================================================

/**
 * Создаёт пустой EntitiesResult.
 *
 * Используется как fallback, когда:
 *   - файл не удалось распарсить
 *   - файл пустой
 *   - произошла ошибка извлечения
 *
 * @param filePath — путь к файлу (для moduleName)
 * @returns пустой EntitiesResult
 */
export function createEmptyEntitiesResult(filePath: string = ''): EntitiesResult {
  return {
    functions: [],
    classes: [],
    constants: [],
    interfaces: [],
    types: [],
    variables: [],
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: filePath ? extractModuleName(filePath) : '',
    filePath: filePath || '',
  };
}

// ============================================================
// ГЛАВНАЯ КОНВЕРТАЦИЯ: EntitiesResult → EnhancedEntityInfo
// ============================================================

/**
 * Конвертирует EntitiesResult в EnhancedEntityInfo.
 *
 * Используется в:
 *   - buildEnhancedPackageLockReport
 *   - buildPackages (через enhancedEntitiesMap)
 *   - extractEntitiesFromFile
 *
 * С v2.0.0: пробрасывает все template-поля Vue и тип-граф.
 * С v2.1.0: пробрасывает lexicalLinks (P1 — лексические связи).
 * С v2.3.0: пробрасывает все React-поля (v17.0.0).
 *
 * Без этого:
 *   - vt-секция в compact-отчёте была бы пустой
 *   - lifecycle/effects/injections/reactivity потерялись бы
 *   - types/typeRefs потерялись бы
 *   - full.lexicalLinks = [] и compact.lx = { p: [], c: [], ... }
 *   - pass7React не видит React-сущности (нет react-секции в JSON)
 *
 * @param entities — результат extractEntities / extractEntitiesFromFile
 * @returns EnhancedEntityInfo
 */
export function convertEntitiesToEnhanced(entities: EntitiesResult): EnhancedEntityInfo {
  return {
    // ============================================================
    // Основные сущности
    // ============================================================
    functions: convertFunctions(entities.functions || []),
    constants: convertConstants(entities.constants || []),
    variables: convertVariables(entities.variables || []),
    interfaces: convertInterfaces(entities.interfaces || []),
    types: convertTypes(entities.types || []),
    classes: convertClasses(entities.classes || []),

    // ============================================================
    // ✅ imports пробрасываются как есть.
    // ============================================================
    imports: entities.imports || [],

    // ============================================================
    // ✅ exports пробрасываются как есть (ExportInfo[]).
    // ============================================================
    exports: entities.exports || [],

    // ============================================================
    // ✅ v2.0.0: template-поля Vue.
    // ============================================================

    /** root-идентификаторы шаблона (user, items, isLoading) */
    templateReactivityDeps: entities.templateReactivityDeps,

    /** Обработчики событий @click → handlerName */
    templateEventHandlers: entities.templateEventHandlers,

    /** <component :is="..."> и v-bind:is */
    templateDynamicComponents: entities.templateDynamicComponents,

    /** template refs (ref="dataTable" → exposedMethods) */
    templateRefs: entities.templateRefs,

    /** CSS-переменные из <style> */
    templateCssVariables: entities.templateCssVariables,

    /** :deep() селекторы */
    templateDeepSelectors: entities.templateDeepSelectors,

    /** Директивы (v-html, v-text, v-pre, v-once, v-memo, v-model, ...) */
    templateDirectives: entities.templateDirectives,

    /** Использованные компоненты (PascalCase + kebab-case) */
    templateUsedComponents: entities.templateUsedComponents,

    /** Слоты (из <slot name="..."> и defineSlots<T>()) */
    templateSlots: entities.templateSlots,

    /** Сложность шаблона */
    templateComplexity: entities.templateComplexity,

    /** ✅ условный рендеринг (v-if / v-else-if / v-else) */
    templateConditionals: entities.templateConditionals,

    /** ✅ хуки жизненного цикла (onMounted, onUnmounted, ...) */
    templateLifecycle: entities.templateLifecycle,

    /** ✅ Side-effects (setTimeout, clearTimeout, AbortController, ...) */
    templateEffects: entities.templateEffects,

    /** ✅ Ребра provide / inject */
    templateInjections: entities.templateInjections,

    /** ✅ Реактивные связи (computed, watch, ref, reactive, ...) */
    templateReactivity: entities.templateReactivity,

    // ============================================================
    // ✅ v2.0.0: тип-граф.
    // ============================================================

    /** Узлы тип-графа (interface / type-alias / enum / class) */
    typesGraph: entities.typesGraph,

    /** Рёбра использования типов (param / return / field / ...) */
    typeRefsGraph: entities.typeRefsGraph,

    // ============================================================
    // ✅ v2.1.0 (P1): лексические связи (parent → child).
    //
    // ✅ v2.2.0: fallback на [] (не undefined), чтобы Codec.encode
    // всегда видел массив, а не undefined.
    // ============================================================
    lexicalLinks: entities.lexicalLinks ?? [],

    // ============================================================
    // ✅ v2.3.0 (v17.0.0): React-сущности
    // ============================================================
    //
    // Без этих полей pass7React не видит React-данные:
    // collectFullJSON получает enhancedMap, а не entitiesMap.
    //
    // Все поля — опциональные. Для .ts/.js/.vue они undefined.
    // Для .tsx/.jsx — заполнены в parse-typescript.ts.
    //
    // Симметрично пробросу templateXxx-полей выше.
    // ============================================================

    /** React-компоненты (function/arrow/class/memo/forwardRef/lazy) */
    reactComponents: entities.reactComponents,

    /** React-хуки (useState/useEffect/...) */
    reactHooks: entities.reactHooks,

    /** React-эффекты (useEffect/useLayoutEffect) */
    reactEffects: entities.reactEffects,

    /** React-контексты (createContext/useContext) */
    reactContexts: entities.reactContexts,

    /** React-мемоизация (useMemo/useCallback/React.memo) */
    reactMemoization: entities.reactMemoization,

    /** React-refs (useRef/forwardRef) */
    reactRefs: entities.reactRefs,

    /** JSX-элементы */
    reactJsxElements: entities.reactJsxElements,

    /** JSX-события (onClick/onChange/...) */
    reactJsxEvents: entities.reactJsxEvents,

    /** Условный рендеринг в JSX (&&/||/?:) */
    reactConditionals: entities.reactConditionals,

    /** Использования React-компонентов */
    reactComponentUsages: entities.reactComponentUsages,
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КОНВЕРТАЦИИ СУЩНОСТЕЙ
// ============================================================

/**
 * Конвертирует FunctionInfo[] в EnhancedFunctionInfo[].
 *
 * ✅ v2.1.0 (P0): пробрасывает parentFunctionId.
 * ✅ v2.1.0 (P2): пробрасывает boundTo.
 * ✅ v2.2.0: явная нормализация parentFunctionId (через FunctionInfo),
 *            boundTo добавляется только если задан.
 */
function convertFunctions(functions: FunctionInfo[]): EnhancedEntityInfo['functions'] {
  return functions.map((func): EnhancedFunctionInfo => {
    // ✅ v2.2.0: явно типизируем parentFunctionId.
    const parentFunctionId: string | null = (func as any).parentFunctionId ?? null;

    // ✅ v2.2.0: boundTo добавляем условно.
    const boundTo = (func as any).boundTo;

    const enhanced: EnhancedFunctionInfo = {
      // ---------- Основные поля ----------
      name: func.name || 'anonymous',
      id: func.id,

      // ---------- Параметры ----------
      params: ensureArray(func.params),
      paramTypes:
        ensureArray((func as any).paramTypes).length > 0
          ? (func as any).paramTypes
          : ensureArray(func.params).map(() => 'any'),

      // ---------- Строки ----------
      line: func.line || 0,
      startLine: func.startLine || func.line || 0,
      endLine: func.endLine || func.line || 0,

      // ---------- Флаги ----------
      isAsync: func.isAsync || false,
      isExported: func.isExported || false,
      isMethod: func.isMethod || false,
      isNested: func.isNested || false,
      isArrow: func.isArrow || false,
      isEventHandler: func.isEventHandler || false,

      // ---------- Классы и наследование ----------
      className: func.className || '',
      parentFunction: func.parentFunction || '',

      // ---------- События ----------
      eventType: func.eventType || '',

      // ---------- Вызовы ----------
      calls: ensureArray(func.calls),
      calledBy: ensureArray(func.calledBy),

      // ---------- Типы ----------
      returnType: func.returnType || 'any',

      // ---------- Тело ----------
      body: func.body || '',

      // ---------- Глубина и сложность ----------
      depth: func.depth || 0,
      complexity: func.complexity || 1,

      // ---------- Безопасность ----------
      security: func.security || createDefaultSecurity(),

      // ---------- Ссылки ----------
      vscode: func.vscode || '',

      // ---------- Сигнатура ----------
      signature: (func as any).signature || '',

      // ---------- Расширенные связи ----------
      callsInfo: ensureArray((func as any).callsInfo),
      calledByInfo: ensureArray((func as any).calledByInfo),
      importedBy: ensureArray((func as any).importedBy),

      // ---------- ✅ v2.2.0 (P0): лексический родитель ----------
      parentFunctionId,

      // ---------- Служебное ----------
      _safeInfo: null,

      // ---------- Расширенные поля (обратная совместимость) ----------
      isSelf: func.isSelf,
      _isSelf: func._isSelf,
      filePath: func.filePath,
      moduleName: func.moduleName,
      _modulePath: func._modulePath,
      moduleId: func.moduleId,
      fileId: func.fileId,
      _uniqueKey: func._uniqueKey,
      _fullPath: func._fullPath,
      isConst: func.isConst,
      isMacro: func.isMacro,
      isComposable: func.isComposable,
      source: func.source,
      isExposed: func.isExposed,
    };

    // ✅ v2.2.0 (P2): boundTo добавляем только если задан.
    if (boundTo) {
      enhanced.boundTo = boundTo;
    }

    return enhanced;
  });
}

/**
 * Конвертирует ConstantInfo[] в EnhancedConstantInfo[].
 */
function convertConstants(constants: ConstantInfo[]): EnhancedEntityInfo['constants'] {
  return constants.map((c): EnhancedConstantInfo => ({
    name: c.name || 'unknown',
    line: c.line || 0,
    isExported: c.isExported || false,
    type: c.type || 'any',
    value: c.value,
    _safeInfo: null,
  }));
}

/**
 * Конвертирует VariableInfo[] в EnhancedVariableInfo[].
 */
function convertVariables(variables: VariableInfo[]): EnhancedEntityInfo['variables'] {
  return variables.map((v): EnhancedVariableInfo => ({
    name: v.name || 'unknown',
    line: v.line || 0,
    isExported: v.isExported || false,
    type: v.type || 'any',
    value: v.value,
    _safeInfo: null,
  }));
}

/**
 * Конвертирует InterfaceInfo[] в EnhancedInterfaceInfo[].
 */
function convertInterfaces(interfaces: InterfaceInfo[]): EnhancedEntityInfo['interfaces'] {
  return interfaces.map((i): EnhancedInterfaceInfo => ({
    name: i.name || 'unknown',
    properties: ensureArray(i.properties),
    line: i.line || 0,
    startLine: i.startLine || i.line || 0,
    endLine: i.endLine || i.line || 0,
    isExported: i.isExported || false,
    extends: ensureArray(i.extends),
    _safeInfo: null,
  }));
}

/**
 * Конвертирует TypeInfo[] в EnhancedTypeInfo[].
 */
function convertTypes(types: TypeInfo[]): EnhancedEntityInfo['types'] {
  return types.map((t): EnhancedTypeInfo => ({
    name: t.name || 'unknown',
    definition: t.definition || 'unknown',
    line: t.line || 0,
    isExported: t.isExported || false,
    _safeInfo: null,
  }));
}

/**
 * Конвертирует ClassInfo[] в EnhancedClassInfo[].
 */
function convertClasses(classes: ClassInfo[]): EnhancedEntityInfo['classes'] {
  return classes.map((c): EnhancedClassInfo => ({
    name: c.name || 'unknown',
    methods: ensureArray(c.methods),
    properties: ensureArray(c.properties),
    line: c.line || 0,
    startLine: c.startLine || c.line || 0,
    endLine: c.endLine || c.line || 0,
    isExported: c.isExported || false,
    extends: c.extends,
    implements: ensureArray(c.implements),
    _safeInfo: null,
  }));
}

// ============================================================
// ✅ v2.0.1: функции convertImports и convertExports УДАЛЕНЫ
// ============================================================

// ============================================================
// Вспомогательные функции
// ============================================================

/**
 * Проверяет, что значение — массив.
 */
function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '[]') return [];
    if (
      trimmed === '' ||
      trimmed === 'null' ||
      trimmed === 'undefined' ||
      trimmed === '[object Object]'
    ) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Извлекает имя модуля из пути к файлу (basename без расширения).
 */
function extractModuleName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() || '';
  return fileName.replace(/\.[^.]+$/, '');
}

// ============================================================
// Экспорт по умолчанию
// ============================================================

export default {
  createEmptyEntitiesResult,
  convertEntitiesToEnhanced,
};
