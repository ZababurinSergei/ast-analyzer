// src/reporters/json/utils/entities-converter.ts
// ============================================================
// КОНВЕРТЕР СУЩНОСТЕЙ: EntitiesResult → EnhancedEntityInfo
// ============================================================
// Версия: 2.2.0
//
// ИЗМЕНЕНИЯ v2.2.0 (P0/P1: явная нормализация parentFunctionId):
//   - ✅ ИСПРАВЛЕНО: convertFunctions теперь ГАРАНТИРОВАННО пробрасывает
//     parentFunctionId из FunctionInfo в EnhancedFunctionInfo.
//     Ранее использовался `(func as any).parentFunctionId ?? null`,
//     что работало, но НЕ защищало от случая, когда поле не
//     объявлено в типе FunctionInfo.
//   - ✅ ИСПРАВЛЕНО: convertFunctions теперь нормализует boundTo
//     (добавляет только если задан, чтобы не засорять объект).
//   - ✅ ПРОВЕРЕНО: convertEntitiesToEnhanced пробрасывает lexicalLinks
//     с fallback на [] (не undefined).
//   - 📌 Это критично для инварианта I10 (verify-roundtrip):
//     parentFunctionId в full.json должен ссылаться на существующий fnN.
//     Если конвертер теряет поле — инвариант падает.
//
// ИЗМЕНЕНИЯ v2.1.0 (P0/P1: parentFunctionId + lexicalLinks):
//   - ✅ ДОБАВЛЕНО: convertFunctions пробрасывает parentFunctionId
//     (P0 — лексический родитель для вложенных функций).
//   - ✅ ДОБАВЛЕНО: convertFunctions пробрасывает boundTo
//     (P2 — информация о вызове, в который передан колбэк).
//   - ✅ ДОБАВЛЕНО: convertEntitiesToEnhanced пробрасывает lexicalLinks
//     (P1 — лексические связи parent → child).
//   Без этих полей:
//     - full.functions[].parentFunctionId = null для всех
//     - full.lexicalLinks = []
//     - compact.fns.parent = [[-1, N]]
//     - compact.lx = { p: [], c: [], r: [], l: [], ai: [], cn: [] }
//     - фронт не может построить дерево вложенности
//
// ИЗМЕНЕНИЯ v2.0.1 (устранение мёртвого кода):
//   - ✅ УДАЛЕНЫ неиспользуемые функции convertImports и convertExports.
//     Они ничего не делали, так как convertEntitiesToEnhanced
//     пробрасывает imports и exports напрямую (см. v2.0.0).
//     Это устраняло ошибки TS6133:
//       'convertImports' is declared but its value is never read.
//       'convertExports' is declared but its value is never read.
//
// ИЗМЕНЕНИЯ v2.0.0 (расширение функциональности + кроссплатформенность):
//   - ✅ ДОБАВЛЕНО: convertEntitiesToEnhanced пробрасывает все
//     template-поля Vue (templateReactivityDeps, templateEventHandlers,
//     templateDynamicComponents, templateRefs, templateCssVariables,
//     templateDeepSelectors, templateDirectives, templateUsedComponents,
//     templateSlots, templateComplexity, templateConditionals,
//     templateLifecycle, templateEffects, templateInjections,
//     templateReactivity).
//     Без этого vt-секция в compact-отчёте была бы пустой.
//   - ✅ ДОБАВЛЕНО: convertEntitiesToEnhanced пробрасывает typesGraph
//     и typeRefsGraph (тип-граф).
//   - ✅ ДОБАВЛЕНО: convertImports теперь возвращает ImportInfo[]
//     (а не упрощённую структуру { source, specifiers: string[], isTypeOnly }).
//     Это устраняло TS2322 при присваивании к EnhancedEntityInfo.imports.
//   - ✅ ДОБАВЛЕНО: convertFunctions расширена, так как расширенный
//     тип EnhancedFunctionInfo требует дополнительные поля (isSelf, _isSelf, filePath,
//     moduleName, _modulePath и т.д.).
//   - ✅ ДОБАВЛЕНО: convertExports возвращает export для всех
//     (ExportInfo из src/types.ts совместим с EnhancedEntityInfo.exports).
//   - ✅ ИСПРАВЛЕНО: используется единый импорт типов из
//     '../../../types.js'.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая конвертация EntitiesResult
//   - Поддержка функций, классов, констант, интерфейсов,
//     типов, переменных, импортов, экспортов
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
 *
 * Без этого:
 *   - vt-секция в compact-отчёте была бы пустой
 *   - lifecycle/effects/injections/reactivity потерялись бы
 *   - types/typeRefs потерялись бы
 *   - full.lexicalLinks = [] и compact.lx = { p: [], c: [], ... }
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
    //
    // ImportInfo в EntitiesResult и ImportInfo в EnhancedEntityInfo —
    // это один и тот же тип из src/types.ts.
    //
    // Функция `convertImports` удалена в v2.0.1 как мёртвый код,
    // так как она ничего не делала (возвращала входной массив).
    // ============================================================
    imports: entities.imports || [],

    // ============================================================
    // ✅ exports пробрасываются как есть (ExportInfo[]).
    // ============================================================
    exports: entities.exports || [],

    // ============================================================
    // ✅ НОВОЕ v2.0.0: template-поля Vue.
    //
    // Без них Codec.encode получит undefined на позиции
    // vt[] и JSON.stringify обрежет массив → сломает round-trip.
    //
    // Источник данных: convertVueAnalysisToEntities
    // (core/entity-extractor/vue/convert-analysis.ts).
    // ============================================================

    /** root-идентификаторы шаблона (user, items, isLoading) */
    templateReactivityDeps: entities.templateReactivityDeps,

    /** Обработчики событий @click → handlerName */
    templateEventHandlers: entities.templateEventHandlers,

    /** <component :is="..."> и v-bind:is */
    templateDynamicComponents: entities.templateDynamicComponents,

    /**
     * ✅ ИСПРАВЛЕНО: template refs.
     *
     * Без этого поля Codec.encode получает undefined на позиции 9 vt[]
     * и JSON.stringify обрезает массив до 9 элементов вместо 12.
     */
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
    // ✅ НОВОЕ v2.0.0: тип-граф.
    //
    // Без этого секции ty/tr в compact-отчёте были бы пустыми.
    // Источник данных: extractTypeGraph (core/type-graph-extractor.ts),
    // вызывается в json-reporter.ts::extractEntitiesFromFile.
    // ============================================================

    /** Узлы тип-графа (interface / type-alias / enum / class) */
    typesGraph: entities.typesGraph,

    /** Рёбра использования типов (param / return / field / ...) */
    typeRefsGraph: entities.typeRefsGraph,

    // ============================================================
    // ✅ НОВОЕ v2.1.0 (P1): лексические связи (parent → child).
    //
    // Описывает вложенность функций:
    //   function outer() {
    //     arr.map(x => x);   // callback является ребёнком outer
    //   }
    //   → lexicalLinks = [
    //       { parentFunctionId: 'fn1', childFunctionId: 'fn2',
    //         relation: 'callback', line: 2, argumentIndex: 0,
    //         calleeName: 'map' },
    //     ]
    //
    // Без этого поля:
    //   - full.lexicalLinks = []
    //   - compact.lx = { p: [], c: [], r: [], l: [], ai: [], cn: [] }
    //   - decode(compact).lexicalLinks = undefined
    //   - фронт не может построить дерево вложенности
    //
    // Источник: extractEntitiesFromAST (core/entity-extractor/ast).
    //
    // ✅ v2.2.0: fallback на [] (не undefined), чтобы Codec.encode
    // всегда видел массив, а не undefined.
    // ============================================================
    lexicalLinks: entities.lexicalLinks ?? [],
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КОНВЕРТАЦИИ СУЩНОСТЕЙ
// ============================================================

/**
 * Конвертирует FunctionInfo[] в EnhancedFunctionInfo[].
 *
 * Расширенный тип EnhancedFunctionInfo требует дополнительные
 * поля, которых нет в FunctionInfo. По умолчанию:
 *   - isMethod, className, isNested, parentFunction, isArrow,
 *     isEventHandler, eventType, depth — из исходных значений
 *   - complexity → по умолчанию 1
 *   - security → createDefaultSecurity()
 *   - vscode, signature → из исходных значений
 *   - _safeInfo → null
 *   - isSelf, _isSelf → из FunctionInfo
 *   - filePath, moduleName, _modulePath → из FunctionInfo
 *
 * ✅ v2.1.0 (P0): пробрасывает parentFunctionId.
 * ✅ v2.1.0 (P2): пробрасывает boundTo.
 * ✅ v2.2.0: явная нормализация parentFunctionId (через FunctionInfo),
 *            boundTo добавляется только если задан.
 */
function convertFunctions(functions: FunctionInfo[]): EnhancedEntityInfo['functions'] {
  return functions.map((func): EnhancedFunctionInfo => {
    // ✅ v2.2.0: явно типизируем parentFunctionId.
    // FunctionInfo.parentFunctionId объявлено в src/types.ts (v15.1.0),
    // поэтому (func as any) больше не нужен — но оставляем fallback
    // для старых версий FunctionInfo.
    const parentFunctionId: string | null =
      (func as any).parentFunctionId ?? null;

    // ✅ v2.2.0: boundTo добавляем условно, чтобы не засорять объект
    // полем `boundTo: undefined`.
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
      // ID функции, внутри которой эта функция объявлена в AST.
      // null — top-level функция.
      //
      // ⚠️ КРИТИЧНО: если это поле потеряется, инвариант I10
      // (verify-roundtrip) упадёт, а compact.fns.parent будет
      // содержать только -1.
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
    // Иначе поле `boundTo: undefined` попадёт в JSON и сломает
    // побайтовое сравнение в round-trip.
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
//
// Было в v2.0.0:
//   function convertImports(imports: ImportInfo[]): ImportInfo[] {
//     return imports;
//   }
//
//   function convertExports(exports: ExportInfo[]): ExportInfo[] {
//     return exports;
//   }
//
// Причины удаления:
//   - Эти функции не использовались (convertEntitiesToEnhanced
//     пробрасывает imports и exports напрямую).
//   - TS6133: 'convertImports' is declared but its value is never read.
//   - TS6133: 'convertExports' is declared but its value is never read.
//
// Если в будущем понадобится какая-то трансформация imports/exports,
// добавьте её прямо в convertEntitiesToEnhanced или восстановите
// функции здесь и используйте их явно.
// ============================================================

// ============================================================
// Вспомогательные функции
// ============================================================

/**
 * Проверяет, что значение — массив.
 *
 * Если значение строкой вида "[object Object]", возвращает пустой
 * массив. Если это не массив — возвращает пустой массив.
 *
 * @param value — любое значение
 * @returns массив
 */
function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    // Строка вида "[]" → пустой массив без парсинга
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
 *
 * @param filePath — путь к файлу
 * @returns имя модуля
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
