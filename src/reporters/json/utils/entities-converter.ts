// src/reporters/json/utils/entities-converter.ts
// ============================================================
// КОНВЕРТЕР СУЩНОСТЕЙ: EntitiesResult → EnhancedEntityInfo
// ============================================================
// Версия: 2.0.1
//
// ИЗМЕНЕНИЯ v2.0.1 (исправление ошибок компиляции):
//   - ✅ УДАЛЕНЫ неиспользуемые функции convertImports и convertExports.
//     Они больше не нужны, так как convertEntitiesToEnhanced
//     пробрасывает imports и exports напрямую (см. v2.0.0).
//     Это устраняет ошибки TS6133:
//       'convertImports' is declared but its value is never read.
//       'convertExports' is declared but its value is never read.
//
// ИЗМЕНЕНИЯ v2.0.0 (устранение дублирования + синхронизация типов):
//   - ✅ КРИТИЧНО: convertEntitiesToEnhanced пробрасывает ВСЕ
//     template-поля Vue (templateReactivityDeps, templateEventHandlers,
//     templateDynamicComponents, templateRefs, templateCssVariables,
//     templateDeepSelectors, templateDirectives, templateUsedComponents,
//     templateSlots, templateComplexity, templateConditionals,
//     templateLifecycle, templateEffects, templateInjections,
//     templateReactivity).
//     Без этого vt-секция в compact-отчёте была бы пустой.
//   - ✅ КРИТИЧНО: convertEntitiesToEnhanced пробрасывает typesGraph
//     и typeRefsGraph (тип-граф).
//   - ✅ КРИТИЧНО: convertImports теперь возвращает ImportInfo[]
//     (а не собственную структуру { source, specifiers: string[], isTypeOnly }).
//     Это устраняет TS2322 при присваивании в EnhancedEntityInfo.imports.
//   - ✅ УЛУЧШЕНО: convertFunctions гарантирует, что все обязательные
//     поля EnhancedFunctionInfo присутствуют (isSelf, _isSelf, filePath,
//     moduleName, _modulePath и т.д.).
//   - ✅ УЛУЧШЕНО: convertExports пробрасывает export как есть
//     (ExportInfo из src/types.ts совпадает с EnhancedEntityInfo.exports).
//   - ✅ УЛУЧШЕНО: используется единый источник истины — типы из
//     '../../../types.js'.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Создание пустого EntitiesResult
//   - Конвертация функций, констант, переменных, интерфейсов,
//     типов, классов, импортов
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
// ГЛАВНЫЙ КОНВЕРТЕР: EntitiesResult → EnhancedEntityInfo
// ============================================================

/**
 * Конвертирует EntitiesResult в EnhancedEntityInfo.
 *
 * Используется в:
 *   - buildEnhancedPackageLockReport
 *   - buildPackages (через enhancedEntitiesMap)
 *   - extractEntitiesFromFile
 *
 * ✅ КРИТИЧНО: пробрасывает ВСЕ template-поля Vue и тип-граф.
 * Без этого:
 *   - vt-секция в compact-отчёте была бы пустой
 *   - lifecycle/effects/injections/reactivity потерялись бы
 *   - types/typeRefs потерялись бы
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
    // ✅ КРИТИЧНО: imports пробрасываются БЕЗ конвертации.
    //
    // ImportInfo в EntitiesResult и ImportInfo в EnhancedEntityInfo —
    // это ОДИН И ТОТ ЖЕ тип из src/types.ts.
    //
    // Прежний `convertImports` возвращал несовместимую структуру
    // `{ source, specifiers: string[], isTypeOnly }`, что давало
    // TS2322 при присваивании в EnhancedEntityInfo.imports.
    // ============================================================
    imports: entities.imports || [],

    // ============================================================
    // ✅ exports пробрасываются как есть (ExportInfo[]).
    // ============================================================
    exports: entities.exports || [],

    // ============================================================
    // ✅ НОВОЕ v2.0.0: template-поля Vue.
    //
    // Без этих полей Codec.encode получит undefined на позиции
    // vt[] и JSON.stringify обрежет массив — сломается round-trip.
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
     * ⚠️ КРИТИЧНО: template refs.
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

    /** ✅ Условный рендеринг (v-if / v-else-if / v-else) */
    templateConditionals: entities.templateConditionals,

    /** ✅ Хуки жизненного цикла (onMounted, onUnmounted, ...) */
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
    // Без этих полей секции ty/tr в compact-отчёте будут пустыми.
    // Источник данных: extractTypeGraph (core/type-graph-extractor.ts),
    // вызывается в json-reporter.ts::extractEntitiesFromFile.
    // ============================================================

    /** Узлы тип-графа (interface / type-alias / enum / class) */
    typesGraph: entities.typesGraph,

    /** Ребра использования типов (param / return / field / ...) */
    typeRefsGraph: entities.typeRefsGraph,
  };
}

// ============================================================
// КОНВЕРТЕРЫ ДЛЯ КАЖДОГО ТИПА СУЩНОСТИ
// ============================================================

/**
 * Конвертирует FunctionInfo[] → EnhancedFunctionInfo[].
 *
 * ✅ Гарантирует, что все обязательные поля EnhancedFunctionInfo
 * присутствуют. В частности:
 *   - isMethod, className, isNested, parentFunction, isArrow,
 *     isEventHandler, eventType, depth — с дефолтными значениями
 *   - complexity — с дефолтом 1
 *   - security — с createDefaultSecurity()
 *   - vscode, signature — со строковыми дефолтами
 *   - _safeInfo — null
 *   - isSelf, _isSelf — пробрасываются из FunctionInfo
 *   - filePath, moduleName, _modulePath — пробрасываются
 */
function convertFunctions(functions: FunctionInfo[]): EnhancedEntityInfo['functions'] {
  return functions.map((func): EnhancedFunctionInfo => ({
    // ---------- Основные поля ----------
    name: func.name || 'anonymous',
    id: func.id,

    // ---------- Параметры ----------
    params: ensureArray(func.params),
    paramTypes:
      ensureArray((func as any).paramTypes).length > 0
        ? (func as any).paramTypes
        : ensureArray(func.params).map(() => 'any'),

    // ---------- Позиция ----------
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

    // ---------- Классы и вложенность ----------
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

    // ---------- Встроенные связи ----------
    callsInfo: ensureArray((func as any).callsInfo),
    calledByInfo: ensureArray((func as any).calledByInfo),
    importedBy: ensureArray((func as any).importedBy),

    // ---------- Служебное ----------
    _safeInfo: null,

    // ---------- ✅ Дополнительные поля (пробрасываются) ----------
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
  }));
}

/**
 * Конвертирует ConstantInfo[] → EnhancedConstantInfo[].
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
 * Конвертирует VariableInfo[] → EnhancedVariableInfo[].
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
 * Конвертирует InterfaceInfo[] → EnhancedInterfaceInfo[].
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
 * Конвертирует TypeInfo[] → EnhancedTypeInfo[].
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
 * Конвертирует ClassInfo[] → EnhancedClassInfo[].
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
// ✅ v2.0.1: УДАЛЕНЫ ФУНКЦИИ convertImports И convertExports
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
// Причина удаления:
//   - Эти функции не использовались (convertEntitiesToEnhanced
//     пробрасывает imports и exports напрямую).
//   - TS6133: 'convertImports' is declared but its value is never read.
//   - TS6133: 'convertExports' is declared but its value is never read.
//
// Если в будущем понадобится какая-то трансформация imports/exports,
// добавьте её прямо в convertEntitiesToEnhanced или создайте
// новую функцию с явным использованием.
// ============================================================

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Гарантирует, что значение — массив.
 *
 * Если пришла строка вида "[object Object]", пытается распарсить
 * её как JSON. Если это не удалось — возвращает пустой массив.
 *
 * @param value — любое значение
 * @returns массив
 */
function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    // Строка вида "[]" — частый случай при несериализуемых данных
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
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  createEmptyEntitiesResult,
  convertEntitiesToEnhanced,
};
